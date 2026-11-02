"use strict";

/**
 * Domain-neutral Context Popover shell and state controller.
 *
 * The shared controller owns only shell rendering, Tippy positioning, state
 * presentation, and component-local lifecycle. Domains own authorization,
 * data, templates, requests, actions, and suppression policy.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
(function (window, document, wp) {
  'use strict';

  var api = window.wpbc_shared_ui_context_popover || {};
  var active_controller = null;
  var visible_controllers = [];
  var registered_controllers = {};
  var layer_open_event = 'wpbc:shared-ui-layer-open';
  var layer_close_event = 'wpbc:shared-ui-layer-close';
  var legacy_popover_selector = '.popover_bottom.popover_click';
  var tooltip_owner_selector = '.tooltip_top, .tooltip_bottom, .tooltip_left, .tooltip_right, .tooltip_right_offset, [data-wpbc-ui-catalog-overflow-tooltip]';
  var clipped_title_tooltip_selector = '[data-wpbc-ui-catalog-overflow-tooltip], .wpbc_ui_listing__overflow_tooltip';
  var reserved_owner_selector = '[data-wpbc-shared-ui-popover]';
  var blocking_layer_types = ['context_popover', 'modal', 'inspector', 'disclosure', 'review', 'apply'];
  var suspending_layer_types = ['modal', 'inspector', 'review', 'apply'];
  var automatic_close_reasons = ['pointer_exit', 'outside_pointer', 'outside_focus', 'external_scroll', 'replacement'];
  var explicit_close_reasons = ['explicit_close', 'escape', 'inspector_handoff', 'destroy', 'authorization_invalidation', 'programmatic', 'uncontrolled_library_hide'];
  var suspension_reasons = ['blocking_layer', 'reference_refresh', 'reference_unavailable'];
  var allowed_placements = ['auto', 'auto-start', 'auto-end', 'top', 'top-start', 'top-end', 'bottom', 'bottom-start', 'bottom-end', 'left', 'left-start', 'left-end', 'right', 'right-start', 'right-end'];

  /**
   * Normalize a component identifier for DOM and ownership attributes.
   *
   * @param {*} candidate Candidate component identifier.
   * @return {string} Safe identifier, or an empty string when invalid.
   */
  function normalize_id(candidate) {
    return String(candidate || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
  }

  /**
   * Normalize a floating-layer descriptor to the public metadata boundary.
   *
   * The returned object deliberately contains only interaction identifiers.
   * Domain records, nonces, form values, and authorization state are never
   * accepted or forwarded by the shared protocol.
   *
   * @param {*} candidate Candidate descriptor.
   * @return {Object|null} Four-key layer descriptor or null when invalid.
   */
  function normalize_layer_descriptor(candidate) {
    var descriptor;
    if (!candidate || 'object' !== typeof candidate) {
      return null;
    }
    descriptor = {
      layer_type: normalize_id(candidate.layer_type),
      instance_id: normalize_id(candidate.instance_id),
      owner_id: normalize_id(candidate.owner_id),
      interaction_group: normalize_id(candidate.interaction_group)
    };
    if (!descriptor.layer_type || !descriptor.instance_id) {
      return null;
    }
    return descriptor;
  }

  /**
   * Dispatch one domain-neutral shared floating-layer lifecycle event.
   *
   * @param {string} event_name Open or close protocol event name.
   * @param {Object} candidate  Candidate layer descriptor.
   * @return {boolean} True when a normalized event was dispatched.
   */
  function dispatch_layer_event(event_name, candidate) {
    var descriptor = normalize_layer_descriptor(candidate);
    var layer_event;
    if (!descriptor || -1 === [layer_open_event, layer_close_event].indexOf(event_name)) {
      return false;
    }
    if ('function' === typeof window.CustomEvent) {
      layer_event = new window.CustomEvent(event_name, {
        bubbles: false,
        detail: descriptor
      });
    } else {
      layer_event = document.createEvent('CustomEvent');
      layer_event.initCustomEvent(event_name, false, false, descriptor);
    }
    document.dispatchEvent(layer_event);
    return true;
  }

  /**
   * Normalize a supported Context Popover mode.
   *
   * @param {*} candidate Candidate mode.
   * @return {string} `interactive` or `preview`.
   */
  function normalize_mode(candidate) {
    return 'interactive' === String(candidate || '') ? 'interactive' : 'preview';
  }

  /**
   * Normalize the optional pin policy.
   *
   * Pinning is deliberately disabled unless a domain opts into the neutral
   * manual policy. The shared controller never infers whether domain content
   * is safe to retain.
   *
   * @param {*} candidate Candidate pin policy.
   * @return {string} `manual` or `none`.
   */
  function normalize_pin_policy(candidate) {
    return 'manual' === String(candidate || '') ? 'manual' : 'none';
  }

  /**
   * Normalize external-scroll behavior for one popover instance.
   *
   * Existing consumers dismiss by default. The retain policy is an explicit,
   * domain-neutral opt-in for surfaces whose controls must remain reachable
   * while their page scrolls; Popper continues to own positioning.
   *
   * @param {*} candidate Candidate external-scroll policy.
   * @return {string} `retain` or `dismiss`.
   */
  function normalize_external_scroll_policy(candidate) {
    return 'retain' === String(candidate || '') ? 'retain' : 'dismiss';
  }

  /**
   * Normalize the optional automatic-dismiss policy.
   *
   * Explicit surfaces reject pointer-exit, outside-pointer, outside-focus,
   * external-scroll, and replacement dismissal. Close, Escape, authorization
   * invalidation, and caller programmatic closure remain available.
   *
   * @param {*} candidate Candidate dismissal policy.
   * @return {string} `explicit` or `automatic`.
   */
  function normalize_dismiss_policy(candidate) {
    return 'explicit' === String(candidate || '') ? 'explicit' : 'automatic';
  }

  /**
   * Normalize the optional Tippy portal host.
   *
   * @param {*} candidate Candidate portal host.
   * @return {HTMLElement} Connected element host, or the document body.
   */
  function normalize_portal_host(candidate) {
    return candidate && 1 === candidate.nodeType && candidate.isConnected ? candidate : document.body;
  }

  /**
   * Normalize the Popper positioning strategy.
   *
   * @param {*} candidate Candidate strategy.
   * @return {string} `absolute` or `fixed`.
   */
  function normalize_positioning_strategy(candidate) {
    return 'absolute' === String(candidate || '') ? 'absolute' : 'fixed';
  }

  /**
   * Normalize the optional live-reference failure policy.
   *
   * Existing consumers retain the established fallback rectangle. A strict
   * owner opts out of remembered coordinates so a detached domain owner cannot
   * leave a visible surface pointing at stale screen geometry.
   *
   * @param {*} candidate Candidate reference policy.
   * @return {string} `strict_live_owner` or `fallback`.
   */
  function normalize_reference_policy(candidate) {
    return 'strict_live_owner' === String(candidate || '') ? 'strict_live_owner' : 'fallback';
  }

  /**
   * Normalize a close or suspension reason before lifecycle state changes.
   *
   * @param {*} candidate Candidate reason.
   * @return {string} Allow-listed reason, or an empty string when invalid.
   */
  function normalize_close_reason(candidate) {
    candidate = String(candidate || '');
    if (-1 !== automatic_close_reasons.indexOf(candidate) || -1 !== explicit_close_reasons.indexOf(candidate) || -1 !== suspension_reasons.indexOf(candidate)) {
      return candidate;
    }
    return '';
  }

  /**
   * Report whether a reason is an automatic transient dismissal.
   *
   * @param {string} reason Normalized reason.
   * @return {boolean} True for automatic dismissal.
   */
  function is_automatic_close_reason(reason) {
    return -1 !== automatic_close_reasons.indexOf(reason);
  }

  /**
   * Put one visible controller at the top of shared surface ordering.
   *
   * @param {Object} controller Context Popover controller.
   * @return {void}
   */
  function register_visible_controller(controller) {
    visible_controllers = visible_controllers.filter(function (candidate) {
      return candidate !== controller;
    });
    visible_controllers.push(controller);
    active_controller = controller;
  }

  /**
   * Remove one controller from visible ordering.
   *
   * @param {Object} controller Context Popover controller.
   * @return {void}
   */
  function unregister_visible_controller(controller) {
    visible_controllers = visible_controllers.filter(function (candidate) {
      return candidate !== controller;
    });
    active_controller = visible_controllers.length ? visible_controllers[visible_controllers.length - 1] : null;
  }

  /**
   * Report whether a controller participates in visible arbitration.
   *
   * @param {Object} controller Context Popover controller.
   * @return {boolean} True when visibly registered.
   */
  function is_visible_controller(controller) {
    return -1 !== visible_controllers.indexOf(controller);
  }

  /**
   * Request replacement dismissal from every other visible controller.
   *
   * Pinned controllers reject this automatic reason while transient consumers
   * preserve their established single-active-surface behavior.
   *
   * @param {Object} opening_controller Controller about to open.
   * @return {void}
   */
  function arbitrate_visible_controllers(opening_controller) {
    visible_controllers.slice().forEach(function (visible_controller) {
      if (visible_controller !== opening_controller) {
        visible_controller.request_close('replacement', false);
      }
    });
  }

  /**
   * Resolve Escape to the focused owner, then the topmost eligible surface.
   *
   * @param {Node|null} event_target Current Escape target.
   * @return {Object|null} Controller that owns this Escape, or null.
   */
  function get_escape_controller(event_target) {
    var focused_owner = null;
    var focused_child_owns_escape = false;
    var focused_shared_layer = null;
    var topmost_owner = null;
    var ordered_controllers = visible_controllers.slice().reverse();
    var event_element = get_element(event_target);
    ordered_controllers.some(function (visible_controller) {
      if (visible_controller.owns_node(event_target)) {
        if (visible_controller.can_handle_escape()) {
          focused_owner = visible_controller;
        } else {
          focused_child_owns_escape = true;
        }
        return true;
      }
      return false;
    });
    if (focused_owner) {
      return focused_owner;
    }
    if (focused_child_owns_escape) {
      return null;
    }
    focused_shared_layer = event_element ? event_element.closest('[data-wpbc-shared-ui-layer-instance]') : null;
    if (focused_shared_layer) {
      return null;
    }
    ordered_controllers.some(function (visible_controller) {
      if (visible_controller.can_handle_escape()) {
        topmost_owner = visible_controller;
        return true;
      }
      return false;
    });
    return topmost_owner;
  }

  /**
   * Normalize the pointer reference geometry requested by a domain adapter.
   *
   * `point` keeps the original frozen pointer point. `trigger_block_edge`
   * retains the pointer's inline coordinate for the arrow while using the
   * trigger's top and bottom edges for vertical placement.
   *
   * @param {*} candidate Candidate pointer anchor mode.
   * @return {string} Allow-listed pointer anchor mode.
   */
  function normalize_pointer_anchor(candidate) {
    return 'trigger_block_edge' === String(candidate || '') ? 'trigger_block_edge' : 'point';
  }

  /**
   * Normalize a Popper placement against the shared allow list.
   *
   * @param {*} candidate Candidate placement.
   * @return {string} Allow-listed placement.
   */
  function normalize_placement(candidate) {
    candidate = String(candidate || '');
    return -1 === allowed_placements.indexOf(candidate) ? 'auto-start' : candidate;
  }

  /**
   * Normalize an ordered Popper placement list without duplicate values.
   *
   * Domains may use this neutral option when their surface must remain on one
   * axis, for example above or below a long horizontal trigger. Popper still
   * owns flipping and viewport-overflow prevention.
   *
   * @param {*} candidate Candidate placement list.
   * @return {Array<string>} Ordered allow-listed placements.
   */
  function normalize_placement_list(candidate) {
    var normalized_placements = [];
    if (!Array.isArray(candidate)) {
      return normalized_placements;
    }
    candidate.forEach(function (placement) {
      placement = String(placement || '');
      if (-1 !== allowed_placements.indexOf(placement) && -1 === normalized_placements.indexOf(placement)) {
        normalized_placements.push(placement);
      }
    });
    return normalized_placements;
  }

  /**
   * Normalize one bounded delay in milliseconds.
   *
   * @param {*}      candidate Candidate delay.
   * @param {number} fallback  Delay used when the candidate is not finite.
   * @return {number} Integer delay between zero and two seconds.
   */
  function normalize_delay(candidate, fallback) {
    var delay = Number(candidate);
    if (!Number.isFinite(delay)) {
      delay = fallback;
    }
    return Math.min(2000, Math.max(0, Math.round(delay)));
  }

  /**
   * Normalize one domain-neutral CSS-pixel length.
   *
   * @param {*}      candidate Candidate CSS-pixel length.
   * @param {number} fallback  Length used when the candidate is not finite.
   * @param {number} minimum   Smallest permitted length.
   * @param {number} maximum   Largest permitted length.
   * @return {number} Bounded integer CSS-pixel length.
   */
  function normalize_length(candidate, fallback, minimum, maximum) {
    candidate = Number(candidate);
    if (!Number.isFinite(candidate)) {
      candidate = fallback;
    }
    return Math.max(minimum, Math.min(maximum, Math.round(candidate)));
  }

  /**
   * Normalize a domain-neutral popover width preference.
   *
   * The bounded value is presentation metadata only. It cannot select a
   * template or change domain behavior, and existing consumers keep the
   * established fallback when they do not opt in.
   *
   * @param {*}      candidate Candidate CSS-pixel width.
   * @param {number} fallback  Width used when the candidate is not finite.
   * @param {number} minimum   Smallest permitted width.
   * @param {number} maximum   Largest permitted width.
   * @return {number} Bounded integer CSS-pixel width.
   */
  function normalize_width(candidate, fallback, minimum, maximum) {
    return normalize_length(candidate, fallback, minimum, maximum);
  }

  /**
   * Convert an arbitrary scalar to bounded plain text.
   *
   * @param {*}      candidate  Candidate text.
   * @param {number} max_length Maximum returned characters.
   * @return {string} Bounded plain text.
   */
  function normalize_text(candidate, max_length) {
    if (null === candidate || 'undefined' === typeof candidate || 'string' !== typeof candidate && 'number' !== typeof candidate) {
      return '';
    }
    return String(candidate).slice(0, max_length);
  }

  /**
   * Read one positive integer layer token from the document root.
   *
   * @param {string} token_name CSS custom-property name.
   * @param {number} fallback   Fallback layer value.
   * @return {number} Positive integer z-index.
   */
  function get_layer_token(token_name, fallback) {
    var candidate = window.getComputedStyle(document.documentElement).getPropertyValue(token_name);
    var layer = Math.round(Number(String(candidate || '').trim()));
    return Number.isFinite(layer) && 0 < layer ? layer : fallback;
  }

  /**
   * Normalize an optional per-instance floating-layer index.
   *
   * Domains may opt a surface into an existing host stacking contract without
   * changing the shared default used by every other Context Popover consumer.
   *
   * @param {*}      candidate Candidate z-index.
   * @param {number} fallback  Default shared layer.
   * @return {number} Positive bounded integer z-index.
   */
  function normalize_layer_index(candidate, fallback) {
    candidate = Math.round(Number(candidate));
    if (!Number.isFinite(candidate) || 0 >= candidate) {
      candidate = fallback;
    }
    return Math.min(1000000, candidate);
  }

  /**
   * Normalize an optional Popper collision boundary.
   *
   * The boundary is presentation geometry only. A disconnected or non-element
   * value retains the established viewport behavior.
   *
   * @param {*} candidate Candidate boundary element.
   * @return {HTMLElement|string} Connected element or the viewport fallback.
   */
  function normalize_positioning_boundary(candidate) {
    return candidate && 1 === candidate.nodeType && candidate.isConnected ? candidate : 'viewport';
  }

  /**
   * Normalize a rectangle for a Tippy virtual reference.
   *
   * @param {Object|null} candidate Candidate DOMRect-like object.
   * @return {Object|null} Complete finite rectangle or null.
   */
  function normalize_reference_rect(candidate) {
    var left;
    var top;
    var width;
    var height;
    if (!candidate || 'object' !== typeof candidate) {
      return null;
    }
    left = Number(candidate.left);
    top = Number(candidate.top);
    width = Math.max(0, Number(candidate.width) || 0);
    height = Math.max(0, Number(candidate.height) || 0);
    if (!Number.isFinite(left) || !Number.isFinite(top)) {
      return null;
    }
    return {
      x: left,
      y: top,
      left: left,
      top: top,
      right: left + width,
      bottom: top + height,
      width: width,
      height: height
    };
  }

  /**
   * Create a zero-size virtual-reference rectangle at viewport coordinates.
   *
   * @param {number} client_x Horizontal viewport coordinate.
   * @param {number} client_y Vertical viewport coordinate.
   * @return {Object} Complete zero-size DOMRect-like value.
   */
  function create_point_reference_rect(client_x, client_y) {
    return {
      x: client_x,
      y: client_y,
      left: client_x,
      top: client_y,
      right: client_x,
      bottom: client_y,
      width: 0,
      height: 0
    };
  }

  /**
   * Return an inert off-screen rectangle for a temporarily unavailable strict owner.
   *
   * This rectangle is never used as a visible fallback. It only satisfies
   * Popper's synchronous virtual-element contract until the domain's coalesced
   * geometry path suspends the surface.
   *
   * @return {Object} Zero-sized off-screen rectangle.
   */
  function create_unavailable_reference_rect() {
    return {
      x: -10000,
      y: -10000,
      left: -10000,
      top: -10000,
      right: -10000,
      bottom: -10000,
      width: 0,
      height: 0
    };
  }

  /**
   * Create the pointer reference requested by the domain adapter.
   *
   * Trigger-edge mode is useful for short horizontal objects: Popper places
   * the surface above or below the complete object while its arrow remains
   * aligned with the pointer's horizontal position. Its returned getter keeps
   * that pointer offset attached to the live trigger while native document or
   * host scrolling changes the trigger's viewport rectangle. Point mode keeps
   * the established frozen coordinate contract.
   *
   * @param {HTMLElement|null} trigger             Activating trigger.
   * @param {number}           client_x            Horizontal viewport coordinate.
   * @param {number}           client_y            Vertical viewport coordinate.
   * @param {string}           pointer_anchor_mode Normalized pointer anchor mode.
   * @return {Object|Function|null} Frozen point, live getter, or null.
   */
  function create_pointer_reference_rect(trigger, client_x, client_y, pointer_anchor_mode) {
    var pointer_inline_offset;
    var trigger_rect;
    if ('trigger_block_edge' !== pointer_anchor_mode) {
      return create_point_reference_rect(client_x, client_y);
    }
    if (!trigger || !trigger.isConnected || 'function' !== typeof trigger.getBoundingClientRect) {
      return null;
    }
    trigger_rect = normalize_reference_rect(trigger.getBoundingClientRect());
    if (!trigger_rect || !is_reference_rect_in_viewport(trigger_rect)) {
      return null;
    }
    pointer_inline_offset = Math.max(0, Math.min(trigger_rect.width, client_x - trigger_rect.left));
    return function () {
      var current_pointer_x;
      var current_trigger_rect;
      if (!trigger.isConnected) {
        return null;
      }
      current_trigger_rect = normalize_reference_rect(trigger.getBoundingClientRect());
      if (!current_trigger_rect) {
        return null;
      }
      current_pointer_x = current_trigger_rect.left + Math.min(pointer_inline_offset, current_trigger_rect.width);
      return {
        x: current_pointer_x,
        y: current_trigger_rect.top,
        left: current_pointer_x,
        top: current_trigger_rect.top,
        right: current_pointer_x,
        bottom: current_trigger_rect.bottom,
        width: 0,
        height: current_trigger_rect.height
      };
    };
  }

  /**
   * Determine whether a reference rectangle intersects the current viewport.
   *
   * A disconnected or scrolled-away trigger must not be allowed to position a
   * visible popover from the private sentinel at the document origin.
   *
   * @param {Object|null} reference_rect Normalized reference rectangle.
   * @return {boolean} True when at least one point intersects the viewport.
   */
  function is_reference_rect_in_viewport(reference_rect) {
    var viewport_width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    var viewport_height = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    return Boolean(reference_rect && 0 < viewport_width && 0 < viewport_height && reference_rect.right >= 0 && reference_rect.bottom >= 0 && reference_rect.left <= viewport_width && reference_rect.top <= viewport_height);
  }

  /**
   * Create a harmless private reference used only while Tippy is hidden.
   *
   * Visible opens are validated separately. Keeping the dormant reference at
   * the viewport center prevents a hidden sentinel at `(0, 0)` from becoming
   * an accidental visible fallback during a Tippy lifecycle transition.
   *
   * @return {Object} Zero-size rectangle at the viewport center.
   */
  function create_viewport_center_reference_rect() {
    var viewport_width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    var viewport_height = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    return create_point_reference_rect(viewport_width / 2, viewport_height / 2);
  }

  /**
   * Create one Context Popover shell controller.
   *
   * The caller must supply authorized, locally rendered content. This method
   * sends no request, selects no domain template, and creates no trigger-side
   * Tippy property. Tippy is attached only to a private sentinel.
   *
   * @param {Object} options Executable options and localized shell labels.
   * @return {Object|null} Component controller or null when dependencies or
   *                       required configuration are unavailable.
   */
  function create(options) {
    var settings = options && 'object' === typeof options ? options : {};
    var component_id = normalize_id(settings.id);
    var mode = normalize_mode(settings.mode);
    var pointer_anchor = normalize_pointer_anchor(settings.pointer_anchor);
    var owner_id = normalize_id(settings.owner_id) || component_id;
    var interaction_group = normalize_id(settings.interaction_group) || component_id;
    var pin_policy = normalize_pin_policy(settings.pin_policy);
    var external_scroll_policy = normalize_external_scroll_policy(settings.external_scroll_policy);
    var dismiss_policy = normalize_dismiss_policy(settings.dismiss_policy);
    var reference_policy = normalize_reference_policy(settings.reference_policy);
    var portal_host = normalize_portal_host(settings.portal_host);
    var pinned_portal_host = normalize_portal_host(settings.pinned_portal_host);
    var positioning_strategy = normalize_positioning_strategy(settings.positioning_strategy);
    var fit_on_first_open = true === settings.fit_on_first_open;
    var pin_to_viewport = true === settings.pin_to_viewport;
    var draggable_when_pinned = pin_to_viewport && true === settings.draggable_when_pinned;
    var resizable_when_pinned = pin_to_viewport && true === settings.resizable_when_pinned;
    var context_popover_priority = true === settings.context_popover_priority;
    var layer_descriptor;
    var registered_child_layers = {};
    var open_child_layers = {};
    var suspending_layers = {};
    var layer_open_announced = false;
    var shell_template;
    var shell_wrapper;
    var surface;
    var sentinel;
    var tippy_instance;
    var current_trigger = null;
    var described_trigger = null;
    var reference_rect_provider = null;
    var reference_tracks_trigger = false;
    var last_valid_reference_rect = null;
    var activation_method = 'none';
    var fallback_placements = normalize_placement_list(settings.fallback_placements);
    var allow_flip = false !== settings.allow_flip;
    var get_initial_placement_bounds = 'function' === typeof settings.get_initial_placement_bounds ? settings.get_initial_placement_bounds : null;
    var positioning_boundary = normalize_positioning_boundary(settings.positioning_boundary);
    var prevent_overflow = fit_on_first_open || false !== settings.prevent_overflow;
    var initial_fit_pending = false;
    var initial_fit_captured = false;
    var initial_fit_adjustment = {
      x: 0,
      y: 0
    };
    var pinned_viewport_position = null;
    var pinned_viewport_size = null;
    var active_drag = null;
    var active_resize = null;
    var flip_options = {
      boundary: positioning_boundary,
      rootBoundary: 'viewport',
      padding: 8
    };
    var popper_modifiers = [{
      enabled: allow_flip,
      name: 'flip',
      options: flip_options
    }];
    var show_delay_ms = normalize_delay(settings.show_delay_ms, 350);
    var hide_delay_ms = normalize_delay(settings.hide_delay_ms, 120);
    var external_scroll_grace_ms = normalize_delay(settings.external_scroll_grace_ms, 250);
    var maximum_width = normalize_width(settings.maximum_width, 550, 240, 760);
    var preferred_width = normalize_width(settings.preferred_width, 'interactive' === mode ? 420 : 360, 240, maximum_width);
    var fixed_unpinned_height = normalize_length(settings.fixed_unpinned_height, 0, 0, 1200);
    var boundary_cross_axis = true === settings.boundary_cross_axis;
    var prevent_overflow_alt_axis = boundary_cross_axis && !(fit_on_first_open && 0 < fixed_unpinned_height);
    var maximum_resized_width = resizable_when_pinned ? normalize_width(settings.maximum_resized_width, maximum_width, maximum_width, 1600) : maximum_width;
    var minimum_resized_width = Math.min(maximum_width, 320);
    var minimum_resized_height = 180;
    var layer_z_index = normalize_layer_index(settings.layer_z_index, get_layer_token('--wpbc_shared_ui__context-popover-z-index', 100110));
    var hide_arrow_when_pinned = true === settings.hide_arrow_when_pinned;
    var boundary_tether = false !== settings.boundary_tether;
    var pending_show_timer = 0;
    var pending_close_timer = 0;
    var pending_focus_check_timer = 0;
    var pending_focus_entry_timer = 0;
    var suppressed_focus_timer = 0;
    var pending_surface_constraint_frame = 0;
    var pending_pointer_trigger = null;
    var pending_pointer_id = null;
    var latest_pointer_coordinates = null;
    var suppressed_focus_trigger = null;
    var pointer_inside_composite = false;
    var retained_scroll_until = 0;
    var pinned = false;
    var suspended = false;
    var suspension_reason = '';
    var external_suspension_hold = false;
    var approved_tippy_hide_reason = '';
    var owns_trigger_aria = true === settings.owns_trigger_aria;
    var owned_trigger_aria = null;
    var state = 'idle';
    var destroyed = false;
    var viewport_padding = 8;
    var available_height_property = '--wpbc_shared_ui_context_popover__available-height';
    var available_inline_size_property = '--wpbc_shared_ui_context_popover__available-inline-size';
    var fixed_unpinned_height_property = '--wpbc_shared_ui_context_popover__fixed-unpinned-height';
    var resized_width_property = '--wpbc_shared_ui_context_popover__resized-width';
    var resized_height_property = '--wpbc_shared_ui_context_popover__resized-height';
    var loading;
    var loading_label;
    var content;
    var empty;
    var error;
    var error_message;
    var retry_button;
    var pin_button;
    var pin_button_label;
    var drag_button;
    var resize_button;
    var status;
    var heading;
    var header_content;
    var default_heading = '';
    var controller;

    /*
     * A scroll-owned portal may deliberately rely on its ancestor's native
     * clipping instead of being translated back into the Visual Viewport.
     * All existing consumers retain Popper overflow prevention by default.
     */
    if (prevent_overflow) {
      popper_modifiers.push({
        name: 'preventOverflow',
        options: {
          /*
           * For top/bottom placements Popper's mainAxis is inline and its
           * altAxis is vertical. An alt-axis correction may therefore move
           * an exact-height surface across the reference it must point to.
           */
          mainAxis: true,
          altAxis: prevent_overflow_alt_axis,
          boundary: positioning_boundary,
          rootBoundary: 'viewport',
          padding: 8,
          tether: boundary_tether
        }
      });
    } else {
      popper_modifiers.push({
        enabled: false,
        name: 'preventOverflow'
      });
    }
    if (fit_on_first_open) {
      popper_modifiers.push({
        name: 'wpbcInitialFit',
        enabled: true,
        phase: 'main',
        requires: ['popperOffsets'],
        requiresIfExists: ['preventOverflow'],
        fn: apply_initial_fit_modifier
      });
    }
    if (pin_to_viewport) {
      popper_modifiers.push({
        name: 'wpbcPinnedViewport',
        enabled: true,
        phase: 'beforeWrite',
        requires: ['computeStyles'],
        fn: apply_pinned_viewport_modifier
      });
    }
    layer_descriptor = normalize_layer_descriptor({
      layer_type: 'context_popover',
      instance_id: component_id,
      owner_id: owner_id,
      interaction_group: interaction_group
    });
    if (!component_id || !wp || 'function' !== typeof wp.template || 'function' !== typeof window.wpbc_tippy || !document.getElementById('tmpl-wpbc-shared-ui-context-popover-shell') || registered_controllers[component_id] || document.getElementById(component_id)) {
      return null;
    }
    if (allow_flip && fallback_placements.length) {
      flip_options.fallbackPlacements = fallback_placements;
    }
    shell_template = wp.template('wpbc-shared-ui-context-popover-shell');
    shell_wrapper = document.createElement('div');
    shell_wrapper.innerHTML = shell_template({
      id: component_id,
      mode: mode,
      owner_id: owner_id,
      interaction_group: interaction_group,
      pin_enabled: 'manual' === pin_policy,
      drag_enabled: draggable_when_pinned,
      drag_label: normalize_text(settings.drag_label, 160),
      resize_enabled: resizable_when_pinned,
      resize_label: normalize_text(settings.resize_label, 160),
      pin_label: normalize_text(settings.pin_label, 160),
      pinned_label: normalize_text(settings.pinned_label, 160),
      unpin_label: normalize_text(settings.unpin_label, 160),
      title: normalize_text(settings.title, 200),
      close_label: normalize_text(settings.close_label, 160),
      loading_label: normalize_text(settings.loading_label, 240),
      empty_label: normalize_text(settings.empty_label, 500),
      error_label: normalize_text(settings.error_label, 500),
      retry_label: normalize_text(settings.retry_label, 160)
    }).trim();
    surface = shell_wrapper.firstElementChild;
    if (!surface) {
      return null;
    }
    surface.style.setProperty('--wpbc_shared_ui_context_popover__preferred-width', preferred_width + 'px');
    if (0 < fixed_unpinned_height) {
      surface.style.setProperty(fixed_unpinned_height_property, fixed_unpinned_height + 'px');
      surface.setAttribute('data-wpbc-shared-ui-context-popover-fixed-unpinned-height', 'true');
    }
    constrain_surface_to_positioning_boundary();
    loading = surface.querySelector('[data-wpbc-shared-ui-context-popover-loading]');
    loading_label = surface.querySelector('[data-wpbc-shared-ui-context-popover-loading-label]');
    content = surface.querySelector('[data-wpbc-shared-ui-context-popover-content]');
    empty = surface.querySelector('[data-wpbc-shared-ui-context-popover-empty]');
    error = surface.querySelector('[data-wpbc-shared-ui-context-popover-error]');
    error_message = error ? error.querySelector('p') : null;
    retry_button = surface.querySelector('[data-wpbc-shared-ui-context-popover-retry]');
    pin_button = surface.querySelector('[data-wpbc-shared-ui-context-popover-pin]');
    pin_button_label = pin_button ? pin_button.querySelector('[data-wpbc-shared-ui-context-popover-pin-label]') : null;
    drag_button = surface.querySelector('[data-wpbc-shared-ui-context-popover-drag]');
    resize_button = surface.querySelector('[data-wpbc-shared-ui-context-popover-resize]');
    status = surface.querySelector('[data-wpbc-shared-ui-context-popover-status]');
    heading = surface.querySelector('[data-wpbc-shared-ui-context-popover-heading]');
    header_content = surface.querySelector('[data-wpbc-shared-ui-context-popover-header-content]');
    default_heading = heading ? heading.textContent : '';
    if (!loading || !content || !empty || !error || !retry_button || !status || 'manual' === pin_policy && (!pin_button || !pin_button_label) || draggable_when_pinned && !drag_button || resizable_when_pinned && !resize_button) {
      return null;
    }
    sentinel = document.createElement('span');
    sentinel.className = 'wpbc_shared_ui_context_popover__sentinel';
    sentinel.setAttribute('data-wpbc-shared-ui-context-popover-sentinel', component_id);
    sentinel.setAttribute('aria-hidden', 'true');
    document.body.appendChild(sentinel);

    /**
     * Resolve the current virtual reference without altering the trigger.
     *
     * @return {Object} Current finite reference rectangle.
     */
    function get_reference_rect() {
      var candidate_rect = null;
      var normalized_rect;
      try {
        candidate_rect = 'function' === typeof reference_rect_provider ? reference_rect_provider() : reference_rect_provider;
      } catch (error) {
        candidate_rect = null;
      }
      normalized_rect = normalize_reference_rect(candidate_rect);
      if (normalized_rect && (reference_tracks_trigger || is_reference_rect_in_viewport(normalized_rect))) {
        last_valid_reference_rect = normalized_rect;
        return last_valid_reference_rect;
      }
      if ('strict_live_owner' === reference_policy) {
        return create_unavailable_reference_rect();
      }
      if (current_trigger && current_trigger.isConnected && 'function' === typeof current_trigger.getBoundingClientRect) {
        normalized_rect = normalize_reference_rect(current_trigger.getBoundingClientRect());
        if (normalized_rect && (reference_tracks_trigger || is_reference_rect_in_viewport(normalized_rect))) {
          last_valid_reference_rect = normalized_rect;
          return last_valid_reference_rect;
        }
      }
      if (last_valid_reference_rect) {
        return last_valid_reference_rect;
      }
      return create_viewport_center_reference_rect();
    }

    /**
     * Preserve only the overflow correction calculated for the current open.
     *
     * Popper may fit the surface into the visible boundary once, but later
     * scroll updates must retain that first correction so a scroll-owned
     * portal continues to move and clip with its canvas.
     *
     * @param {Object} modifier_arguments Popper modifier state wrapper.
     * @return {void}
     */
    function apply_initial_fit_modifier(modifier_arguments) {
      var modifier_data;
      var current_x;
      var current_y;
      if (!fit_on_first_open || pinned || !modifier_arguments || !modifier_arguments.state || !modifier_arguments.state.modifiersData || !modifier_arguments.state.modifiersData.popperOffsets || !initial_fit_pending && !initial_fit_captured) {
        return;
      }
      modifier_data = modifier_arguments.state.modifiersData.preventOverflow || {};
      current_x = Number.isFinite(modifier_data.x) ? modifier_data.x : 0;
      current_y = Number.isFinite(modifier_data.y) ? modifier_data.y : 0;
      if (initial_fit_pending || !initial_fit_captured) {
        initial_fit_adjustment = {
          x: current_x,
          y: current_y
        };
        initial_fit_pending = false;
        initial_fit_captured = true;
        return;
      }
      modifier_arguments.state.modifiersData.popperOffsets.x += initial_fit_adjustment.x - current_x;
      modifier_arguments.state.modifiersData.popperOffsets.y += initial_fit_adjustment.y - current_y;
    }

    /**
     * Return the current Visual Viewport rectangle in layout coordinates.
     *
     * @return {Object} Finite left, top, right, bottom, width, and height.
     */
    function get_visual_viewport_bounds() {
      var visual_viewport = window.visualViewport;
      var left = visual_viewport && Number.isFinite(visual_viewport.offsetLeft) ? visual_viewport.offsetLeft : 0;
      var top = visual_viewport && Number.isFinite(visual_viewport.offsetTop) ? visual_viewport.offsetTop : 0;
      var width = visual_viewport && Number.isFinite(visual_viewport.width) ? visual_viewport.width : Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      var height = visual_viewport && Number.isFinite(visual_viewport.height) ? visual_viewport.height : Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
      return {
        left: left,
        top: top,
        right: left + width,
        bottom: top + height,
        width: width,
        height: height
      };
    }

    /**
     * Keep a pinned surface reachable inside the current Visual Viewport.
     *
     * @param {number} left Requested viewport-relative left coordinate.
     * @param {number} top  Requested viewport-relative top coordinate.
     * @return {Object} Clamped left and top coordinates.
     */
    function clamp_pinned_viewport_position(left, top) {
      var viewport_bounds = get_visual_viewport_bounds();
      var surface_rect = surface.getBoundingClientRect();
      var surface_width = Math.max(1, surface_rect.width || preferred_width);
      var surface_height = Math.max(1, surface_rect.height || 1);
      var minimum_left = viewport_bounds.left + viewport_padding;
      var minimum_top = viewport_bounds.top + viewport_padding;
      var maximum_left = Math.max(minimum_left, viewport_bounds.right - viewport_padding - surface_width);
      var maximum_top = Math.max(minimum_top, viewport_bounds.bottom - viewport_padding - surface_height);
      return {
        left: Math.min(maximum_left, Math.max(minimum_left, Number.isFinite(left) ? left : minimum_left)),
        top: Math.min(maximum_top, Math.max(minimum_top, Number.isFinite(top) ? top : minimum_top))
      };
    }

    /**
     * Override Popper output only while the opted-in surface is viewport pinned.
     *
     * @param {Object} modifier_arguments Popper modifier state wrapper.
     * @return {void}
     */
    function apply_pinned_viewport_modifier(modifier_arguments) {
      var popper_styles;
      if (!pinned || !pinned_viewport_position || !modifier_arguments || !modifier_arguments.state) {
        return;
      }
      popper_styles = modifier_arguments.state.styles.popper || {};
      popper_styles.position = 'fixed';
      popper_styles.left = '0';
      popper_styles.top = '0';
      popper_styles.right = 'auto';
      popper_styles.bottom = 'auto';
      popper_styles.transform = 'translate3d(' + pinned_viewport_position.left + 'px, ' + pinned_viewport_position.top + 'px, 0)';
      modifier_arguments.state.styles.popper = popper_styles;
    }

    /**
     * Recreate Popper geometry after moving between canvas and viewport portals.
     *
     * @return {void}
     */
    function apply_positioning_mode() {
      var active_portal_host;
      var active_positioning_strategy;
      if (!tippy_instance || !tippy_instance.popper) {
        return;
      }
      active_portal_host = pinned && pin_to_viewport ? pinned_portal_host : portal_host;
      active_positioning_strategy = pinned && pin_to_viewport ? 'fixed' : positioning_strategy;
      tippy_instance.setProps({
        appendTo: function () {
          return active_portal_host;
        },
        maxWidth: pinned && resizable_when_pinned ? maximum_resized_width : maximum_width,
        popperOptions: {
          strategy: active_positioning_strategy,
          modifiers: popper_modifiers
        }
      });
      if (tippy_instance.popper.parentNode !== active_portal_host) {
        active_portal_host.appendChild(tippy_instance.popper);
      }
      if (tippy_instance.popperInstance) {
        tippy_instance.popperInstance.forceUpdate();
      }
    }

    /**
     * Create the live reference provider configured for one domain trigger.
     *
     * Domains may constrain visibility through `get_reference_rect`; existing
     * consumers continue to use the native trigger rectangle.
     *
     * @param {HTMLElement} trigger Connected domain trigger.
     * @return {Function} Live DOMRect-like provider.
     */
    function create_trigger_reference_provider(trigger) {
      return function () {
        if ('function' === typeof settings.get_reference_rect) {
          return settings.get_reference_rect(trigger);
        }
        return trigger.getBoundingClientRect();
      };
    }

    /**
     * Resolve and validate an explicit virtual-reference provider before show.
     *
     * @param {Object|Function|null} reference_rect         DOMRect-like value or getter.
     * @param {boolean}              allow_outside_viewport Whether a retained viewport pin may use an off-screen owner.
     * @return {Object|null} Visible normalized rectangle or null.
     */
    function resolve_open_reference_rect(reference_rect, allow_outside_viewport) {
      var candidate_rect = null;
      var normalized_rect;
      try {
        candidate_rect = 'function' === typeof reference_rect ? reference_rect() : reference_rect;
      } catch (error) {
        candidate_rect = null;
      }
      normalized_rect = normalize_reference_rect(candidate_rect);
      return normalized_rect && (allow_outside_viewport || is_reference_rect_in_viewport(normalized_rect)) ? normalized_rect : null;
    }

    /**
     * Remove the pending pointer activation timer and its temporary listeners.
     *
     * @return {void}
     */
    function cancel_pending_open() {
      if (pending_show_timer) {
        window.clearTimeout(pending_show_timer);
        pending_show_timer = 0;
      }
      document.removeEventListener('pointermove', capture_pending_pointer, true);
      if (pending_pointer_trigger) {
        pending_pointer_trigger.removeEventListener('pointerleave', cancel_pending_open);
      }
      pending_pointer_trigger = null;
      pending_pointer_id = null;
      latest_pointer_coordinates = null;
    }

    /**
     * Remember pointer movement only while a delayed activation is pending.
     *
     * The last coordinates are frozen when the delay completes. No listener
     * remains after opening, so the visible surface never follows the cursor.
     *
     * @param {PointerEvent} event Pointer movement event.
     * @return {void}
     */
    function capture_pending_pointer(event) {
      if (null !== pending_pointer_id && event.pointerId !== pending_pointer_id) {
        return;
      }
      if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
        latest_pointer_coordinates = {
          x: event.clientX,
          y: event.clientY
        };
      }
    }

    /**
     * Resolve an event or focus node to an Element when possible.
     *
     * @param {Node|null} candidate Candidate DOM node.
     * @return {Element|null} Element candidate or its parent Element.
     */
    function get_element(candidate) {
      if (!candidate) {
        return null;
      }
      if (1 === candidate.nodeType) {
        return candidate;
      }
      return candidate.parentElement || null;
    }

    /**
     * Determine whether a node belongs directly to this popover surface.
     *
     * @param {Node|null} candidate Candidate pointer, focus, or scroll node.
     * @return {boolean} True for the surface or an explicitly owned portal.
     */
    function is_direct_popover_owned_node(candidate) {
      var candidate_element = get_element(candidate);
      var owner_selector = '[data-wpbc-shared-ui-context-popover-owner="' + component_id + '"]';
      if (!candidate_element) {
        return false;
      }
      if (surface === candidate_element || surface.contains(candidate_element)) {
        return true;
      }
      return Boolean(candidate_element.closest(owner_selector));
    }

    /**
     * Recognize a foreign Tippy portal whose reference belongs to this surface.
     *
     * The controller reads Tippy's public instance relationship only. It never
     * hides, destroys, reconfigures, or replaces the child instance.
     *
     * @param {Node|null} candidate Candidate node inside a Tippy popper.
     * @return {boolean} True when the Tippy reference is directly owned here.
     */
    function is_owned_child_tippy_node(candidate) {
      var candidate_element = get_element(candidate);
      var tippy_root;
      var child_tippy;
      if (!candidate_element || !candidate_element.closest) {
        return false;
      }
      tippy_root = candidate_element.closest('[data-tippy-root]');
      child_tippy = tippy_root && tippy_root._tippy;
      if (!child_tippy || !child_tippy.reference) {
        return false;
      }
      return is_direct_popover_owned_node(child_tippy.reference);
    }

    /**
     * Determine whether a node belongs to the surface or a portaled owned child.
     *
     * Owned external surfaces must carry the controller's stable instance ID.
     * This relationship is interaction metadata, not authorization.
     *
     * @param {Node|null} candidate Candidate pointer, focus, or scroll node.
     * @return {boolean} True when the node belongs to this popover surface.
     */
    function is_popover_owned_node(candidate) {
      return is_direct_popover_owned_node(candidate) || is_owned_child_tippy_node(candidate);
    }

    /**
     * Determine whether an event target belongs to a clipped-title tooltip.
     *
     * @param {Node|null} candidate Candidate event target.
     * @return {boolean} True when the catalog overflow-tooltip owner applies.
     */
    function is_clipped_title_tooltip_target(candidate) {
      var candidate_element = get_element(candidate);
      return Boolean(candidate_element && candidate_element.closest && candidate_element.closest(clipped_title_tooltip_selector));
    }

    /**
     * Verify that a domain trigger does not already belong to another owner.
     *
     * Standard tooltip targets may be opted into Context Popover priority by
     * the domain. Legacy click popovers and registered shared owners are never
     * claimed by this controller.
     *
     * @param {HTMLElement|null} trigger Candidate domain trigger.
     * @return {boolean} True when Context Popover may use the trigger.
     */
    function can_use_trigger(trigger) {
      if (!trigger || 1 !== trigger.nodeType || !trigger.closest) {
        return false;
      }
      if (trigger.closest(legacy_popover_selector) || trigger.closest(reserved_owner_selector)) {
        return false;
      }
      if (trigger.closest(tooltip_owner_selector)) {
        return context_popover_priority;
      }
      return true;
    }

    /**
     * Register one child floating layer that belongs to this interaction group.
     *
     * Registration affects collision and lifecycle ownership only. It does not
     * grant access to content, data, or actions inside either component.
     *
     * @param {Object} candidate Candidate child layer descriptor.
     * @return {boolean} True when the child descriptor was registered.
     */
    function register_child_layer(candidate) {
      var descriptor = normalize_layer_descriptor(candidate);
      if (!descriptor || descriptor.instance_id === component_id) {
        return false;
      }
      registered_child_layers[descriptor.instance_id] = descriptor;
      return true;
    }

    /**
     * Remove one child layer registration without altering its UI instance.
     *
     * @param {*} child_instance_id Stable child layer instance ID.
     * @return {boolean} True when a registration was removed.
     */
    function unregister_child_layer(child_instance_id) {
      child_instance_id = normalize_id(child_instance_id);
      if (!child_instance_id || !registered_child_layers[child_instance_id]) {
        return false;
      }
      delete registered_child_layers[child_instance_id];
      delete open_child_layers[child_instance_id];
      return true;
    }

    /**
     * Determine whether a layer event belongs to this composite interaction.
     *
     * @param {Object} descriptor Normalized layer descriptor.
     * @return {boolean} True for this layer, an owned child, or a shared group.
     */
    function is_related_layer(descriptor) {
      var registered_child;
      if (!descriptor) {
        return false;
      }
      if (descriptor.layer_type === layer_descriptor.layer_type && descriptor.instance_id === component_id) {
        return true;
      }
      registered_child = registered_child_layers[descriptor.instance_id];
      if (registered_child && registered_child.layer_type === descriptor.layer_type) {
        return true;
      }
      if (descriptor.owner_id && (descriptor.owner_id === component_id || descriptor.owner_id === owner_id)) {
        return true;
      }
      return Boolean(descriptor.interaction_group && descriptor.interaction_group === interaction_group);
    }

    /**
     * Determine whether any registered child layer has announced itself open.
     *
     * @return {boolean} True while at least one related child remains open.
     */
    function has_open_child_layers() {
      return 0 < Object.keys(open_child_layers).length;
    }

    /**
     * Close for a blocking unrelated shared layer while preserving child layers.
     *
     * @param {CustomEvent} event Shared floating-layer open event.
     * @return {void}
     */
    function handle_layer_open(event) {
      var descriptor = normalize_layer_descriptor(event ? event.detail : null);
      if (!descriptor) {
        return;
      }
      if (is_related_layer(descriptor)) {
        if (descriptor.instance_id !== component_id) {
          open_child_layers[descriptor.instance_id] = descriptor;
        }
        return;
      }
      if (-1 !== blocking_layer_types.indexOf(descriptor.layer_type) && (is_visible_controller(controller) || pending_show_timer || suspended)) {
        if (pinned && -1 !== suspending_layer_types.indexOf(descriptor.layer_type)) {
          suspending_layers[descriptor.instance_id] = descriptor;
          suspend('blocking_layer', true);
          return;
        }
        request_close('explicit' === dismiss_policy && 'context_popover' !== descriptor.layer_type ? 'programmatic' : 'replacement', false);
      }
    }

    /**
     * Forget only the open state of a related child layer.
     *
     * @param {CustomEvent} event Shared floating-layer close event.
     * @return {void}
     */
    function handle_layer_close(event) {
      var descriptor = normalize_layer_descriptor(event ? event.detail : null);
      var open_child;
      var suspending_layer;
      suspending_layer = descriptor ? suspending_layers[descriptor.instance_id] : null;
      if (suspending_layer && suspending_layer.layer_type === descriptor.layer_type) {
        delete suspending_layers[descriptor.instance_id];
        if (suspended && !Object.keys(suspending_layers).length && !external_suspension_hold) {
          resume(false);
        }
      }
      open_child = descriptor ? open_child_layers[descriptor.instance_id] : null;
      if (open_child && open_child.layer_type === descriptor.layer_type) {
        delete open_child_layers[descriptor.instance_id];
        if (is_visible_controller(controller) && !pointer_inside_composite && !is_composite_node(document.activeElement)) {
          schedule_close();
        }
      }
    }

    /**
     * Announce this Context Popover once per visible lifecycle.
     *
     * @return {void}
     */
    function announce_layer_open() {
      if (layer_open_announced) {
        return;
      }
      layer_open_announced = dispatch_layer_event(layer_open_event, layer_descriptor);
    }

    /**
     * Announce this Context Popover close after releasing its visible state.
     *
     * @return {void}
     */
    function announce_layer_close() {
      if (!layer_open_announced) {
        return;
      }
      layer_open_announced = false;
      dispatch_layer_event(layer_close_event, layer_descriptor);
    }

    /**
     * Determine whether a node is within the complete composite region.
     *
     * @param {Node|null} candidate Candidate pointer or focus node.
     * @return {boolean} True for the active trigger, surface, or owned child.
     */
    function is_composite_node(candidate) {
      var candidate_element = get_element(candidate);
      if (!candidate_element) {
        return false;
      }
      if (current_trigger && (current_trigger === candidate_element || current_trigger.contains(candidate_element))) {
        return true;
      }
      return is_popover_owned_node(candidate_element);
    }

    /**
     * Cancel a delayed composite-region close.
     *
     * @return {void}
     */
    function cancel_pending_close() {
      if (pending_close_timer) {
        window.clearTimeout(pending_close_timer);
        pending_close_timer = 0;
      }
    }

    /**
     * Cancel delayed focus ownership work.
     *
     * @return {void}
     */
    function cancel_pending_focus() {
      if (pending_focus_check_timer) {
        window.clearTimeout(pending_focus_check_timer);
        pending_focus_check_timer = 0;
      }
      if (pending_focus_entry_timer) {
        window.clearTimeout(pending_focus_entry_timer);
        pending_focus_entry_timer = 0;
      }
      if (suppressed_focus_timer) {
        window.clearTimeout(suppressed_focus_timer);
        suppressed_focus_timer = 0;
      }
      suppressed_focus_trigger = null;
    }

    /**
     * Cancel every delayed open, close, and focus transition.
     *
     * Pin changes use this boundary so no callback queued under the previous
     * policy can mutate the new state.
     *
     * @return {void}
     */
    function cancel_interaction_timers() {
      cancel_pending_open();
      cancel_pending_close();
      cancel_pending_focus();
    }

    /**
     * Stop the active pointer drag and release its temporary document listeners.
     *
     * @return {void}
     */
    function finish_pinned_drag() {
      var pointer_id;
      if (!active_drag) {
        return;
      }
      pointer_id = active_drag.pointer_id;
      document.removeEventListener('pointermove', handle_pinned_drag_pointer_move, true);
      document.removeEventListener('pointerup', finish_pinned_drag, true);
      document.removeEventListener('pointercancel', finish_pinned_drag, true);
      active_drag = null;
      surface.removeAttribute('data-wpbc-shared-ui-context-popover-dragging');
      if (drag_button && drag_button.hasPointerCapture && drag_button.releasePointerCapture && Number.isFinite(pointer_id) && drag_button.hasPointerCapture(pointer_id)) {
        try {
          drag_button.releasePointerCapture(pointer_id);
        } catch (error) {
          // The user agent may already have released capture on pointerup.
        }
      }
    }

    /**
     * Commit one clamped viewport position and refresh the pinned Popper output.
     *
     * @param {number} left Requested left coordinate.
     * @param {number} top  Requested top coordinate.
     * @return {void}
     */
    function move_pinned_surface(left, top) {
      if (!pinned || !pin_to_viewport) {
        return;
      }
      pinned_viewport_position = clamp_pinned_viewport_position(left, top);
      if (tippy_instance && tippy_instance.popperInstance) {
        tippy_instance.popperInstance.forceUpdate();
      }
    }

    /**
     * Begin dragging an opted-in pinned surface from its accessible handle.
     *
     * @param {PointerEvent} event Pointer-down event on the drag handle.
     * @return {void}
     */
    function handle_pinned_drag_pointer_down(event) {
      if (!pinned || !draggable_when_pinned || Number.isFinite(event.button) && 0 !== event.button) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      active_drag = {
        pointer_id: event.pointerId,
        start_x: event.clientX,
        start_y: event.clientY,
        origin_left: pinned_viewport_position ? pinned_viewport_position.left : 0,
        origin_top: pinned_viewport_position ? pinned_viewport_position.top : 0
      };
      surface.setAttribute('data-wpbc-shared-ui-context-popover-dragging', 'true');
      if (drag_button.setPointerCapture && Number.isFinite(event.pointerId)) {
        try {
          drag_button.setPointerCapture(event.pointerId);
        } catch (error) {
          // Document listeners retain the gesture when capture is unavailable.
        }
      }
      document.addEventListener('pointermove', handle_pinned_drag_pointer_move, true);
      document.addEventListener('pointerup', finish_pinned_drag, true);
      document.addEventListener('pointercancel', finish_pinned_drag, true);
    }

    /**
     * Move the pinned surface with the active pointer gesture.
     *
     * @param {PointerEvent} event Captured pointer movement.
     * @return {void}
     */
    function handle_pinned_drag_pointer_move(event) {
      if (!active_drag || event.pointerId !== active_drag.pointer_id) {
        return;
      }
      event.preventDefault();
      move_pinned_surface(active_drag.origin_left + event.clientX - active_drag.start_x, active_drag.origin_top + event.clientY - active_drag.start_y);
    }

    /**
     * Move a pinned surface from the keyboard-accessible drag handle.
     *
     * Arrow keys move by ten pixels; Shift+Arrow provides one-pixel precision.
     *
     * @param {KeyboardEvent} event Drag-handle keyboard event.
     * @return {void}
     */
    function handle_pinned_drag_keydown(event) {
      var offset_x = 0;
      var offset_y = 0;
      var distance = event.shiftKey ? 1 : 10;
      if (!pinned || !draggable_when_pinned || !pinned_viewport_position) {
        return;
      }
      if ('ArrowLeft' === event.key) {
        offset_x = -distance;
      } else if ('ArrowRight' === event.key) {
        offset_x = distance;
      } else if ('ArrowUp' === event.key) {
        offset_y = -distance;
      } else if ('ArrowDown' === event.key) {
        offset_y = distance;
      } else {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      move_pinned_surface(pinned_viewport_position.left + offset_x, pinned_viewport_position.top + offset_y);
    }

    /**
     * Report whether the surface currently uses right-to-left inline flow.
     *
     * The resize handle sits at the logical inline end, so RTL width changes
     * keep the physical right edge fixed while the left edge moves.
     *
     * @return {boolean} True when the computed surface direction is RTL.
     */
    function is_surface_right_to_left() {
      return 'rtl' === window.getComputedStyle(surface).direction;
    }

    /**
     * Stop the active pointer resize and release temporary document listeners.
     *
     * @param {PointerEvent} [event] Optional pointer completion event.
     * @return {void}
     */
    function finish_pinned_resize(event) {
      var pointer_id;
      if (!active_resize) {
        return;
      }
      if (event && Number.isFinite(event.pointerId) && event.pointerId !== active_resize.pointer_id) {
        return;
      }
      pointer_id = active_resize.pointer_id;
      document.removeEventListener('pointermove', handle_pinned_resize_pointer_move, true);
      document.removeEventListener('pointerup', finish_pinned_resize, true);
      document.removeEventListener('pointercancel', finish_pinned_resize, true);
      active_resize = null;
      surface.removeAttribute('data-wpbc-shared-ui-context-popover-resizing');
      if (resize_button && resize_button.hasPointerCapture && resize_button.releasePointerCapture && Number.isFinite(pointer_id) && resize_button.hasPointerCapture(pointer_id)) {
        try {
          resize_button.releasePointerCapture(pointer_id);
        } catch (error) {
          // The user agent may already have released capture on pointerup.
        }
      }
    }

    /**
     * Remove a user-selected pinned size and restore domain default dimensions.
     *
     * @return {void}
     */
    function clear_pinned_surface_size() {
      pinned_viewport_size = null;
      surface.removeAttribute('data-wpbc-shared-ui-context-popover-resized');
      surface.style.removeProperty(resized_width_property);
      surface.style.removeProperty(resized_height_property);
    }

    /**
     * Commit a bounded size for one viewport-pinned surface.
     *
     * Width never exceeds the controller's configured maximum. Height and both
     * dimensions remain within the Visual Viewport from the current pinned
     * position. RTL resizing preserves the physical right edge because its
     * logical resize handle is on the left.
     *
     * @param {number}  requested_width  Requested CSS-pixel width.
     * @param {number}  requested_height Requested CSS-pixel height.
     * @param {boolean} anchor_right     Whether to keep the physical right edge fixed.
     * @return {boolean} True when a pinned size was committed.
     */
    function resize_pinned_surface(requested_width, requested_height, anchor_right) {
      var viewport_bounds;
      var surface_rect;
      var current_position;
      var minimum_left;
      var maximum_available_width;
      var maximum_available_height;
      var bounded_minimum_width;
      var bounded_minimum_height;
      var resized_width;
      var resized_height;
      var fixed_right;
      var resized_left;
      if (!pinned || !pin_to_viewport || !resizable_when_pinned) {
        return false;
      }
      viewport_bounds = get_visual_viewport_bounds();
      surface_rect = surface.getBoundingClientRect();
      current_position = pinned_viewport_position || clamp_pinned_viewport_position(surface_rect.left, surface_rect.top);
      minimum_left = viewport_bounds.left + viewport_padding;
      fixed_right = current_position.left + Math.max(1, surface_rect.width || preferred_width);
      maximum_available_width = anchor_right ? fixed_right - minimum_left : viewport_bounds.right - viewport_padding - current_position.left;
      maximum_available_width = Math.max(1, Math.min(maximum_resized_width, maximum_available_width));
      maximum_available_height = Math.max(1, viewport_bounds.bottom - viewport_padding - current_position.top);
      bounded_minimum_width = Math.min(minimum_resized_width, maximum_available_width);
      bounded_minimum_height = Math.min(minimum_resized_height, maximum_available_height);
      requested_width = Number.isFinite(requested_width) ? requested_width : surface_rect.width;
      requested_height = Number.isFinite(requested_height) ? requested_height : surface_rect.height;
      resized_width = Math.min(maximum_available_width, Math.max(bounded_minimum_width, Math.round(requested_width)));
      resized_height = Math.min(maximum_available_height, Math.max(bounded_minimum_height, Math.round(requested_height)));
      resized_left = anchor_right ? fixed_right - resized_width : current_position.left;
      surface.style.setProperty(resized_width_property, resized_width + 'px');
      surface.style.setProperty(resized_height_property, resized_height + 'px');
      surface.setAttribute('data-wpbc-shared-ui-context-popover-resized', 'true');
      pinned_viewport_size = {
        width: resized_width,
        height: resized_height
      };
      pinned_viewport_position = clamp_pinned_viewport_position(resized_left, current_position.top);
      if (tippy_instance && tippy_instance.popperInstance) {
        tippy_instance.popperInstance.forceUpdate();
      }
      return true;
    }

    /**
     * Begin resizing an opted-in pinned surface from its corner control.
     *
     * @param {PointerEvent} event Pointer-down event on the resize control.
     * @return {void}
     */
    function handle_pinned_resize_pointer_down(event) {
      var surface_rect;
      if (!pinned || !resizable_when_pinned || Number.isFinite(event.button) && 0 !== event.button) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      surface_rect = surface.getBoundingClientRect();
      active_resize = {
        pointer_id: event.pointerId,
        start_x: event.clientX,
        start_y: event.clientY,
        origin_width: Math.max(1, surface_rect.width || preferred_width),
        origin_height: Math.max(1, surface_rect.height || minimum_resized_height),
        anchor_right: is_surface_right_to_left()
      };
      surface.setAttribute('data-wpbc-shared-ui-context-popover-resizing', 'true');
      if (resize_button.setPointerCapture && Number.isFinite(event.pointerId)) {
        try {
          resize_button.setPointerCapture(event.pointerId);
        } catch (error) {
          // Document listeners retain the gesture when capture is unavailable.
        }
      }
      document.addEventListener('pointermove', handle_pinned_resize_pointer_move, true);
      document.addEventListener('pointerup', finish_pinned_resize, true);
      document.addEventListener('pointercancel', finish_pinned_resize, true);
    }

    /**
     * Resize the pinned surface with the active pointer gesture.
     *
     * @param {PointerEvent} event Captured pointer movement.
     * @return {void}
     */
    function handle_pinned_resize_pointer_move(event) {
      var inline_delta;
      if (!active_resize || event.pointerId !== active_resize.pointer_id) {
        return;
      }
      event.preventDefault();
      inline_delta = active_resize.anchor_right ? active_resize.start_x - event.clientX : event.clientX - active_resize.start_x;
      resize_pinned_surface(active_resize.origin_width + inline_delta, active_resize.origin_height + event.clientY - active_resize.start_y, active_resize.anchor_right);
    }

    /**
     * Resize a pinned surface from its keyboard-accessible corner control.
     *
     * Horizontal Arrow keys change width from the logical inline end. Vertical
     * Arrow keys change height; Shift+Arrow provides one-pixel precision.
     *
     * @param {KeyboardEvent} event Resize-control keyboard event.
     * @return {void}
     */
    function handle_pinned_resize_keydown(event) {
      var surface_rect;
      var width_delta = 0;
      var height_delta = 0;
      var distance = event.shiftKey ? 1 : 10;
      var anchor_right;
      if (!pinned || !resizable_when_pinned) {
        return;
      }
      anchor_right = is_surface_right_to_left();
      if ('ArrowLeft' === event.key) {
        width_delta = anchor_right ? distance : -distance;
      } else if ('ArrowRight' === event.key) {
        width_delta = anchor_right ? -distance : distance;
      } else if ('ArrowUp' === event.key) {
        height_delta = -distance;
      } else if ('ArrowDown' === event.key) {
        height_delta = distance;
      } else {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      surface_rect = surface.getBoundingClientRect();
      resize_pinned_surface(surface_rect.width + width_delta, surface_rect.height + height_delta, anchor_right);
    }

    /**
     * Synchronize the optional neutral pin control.
     *
     * @return {void}
     */
    function synchronize_pin_control() {
      var pin_label;
      if (tippy_instance && tippy_instance.popper) {
        if (hide_arrow_when_pinned && pinned) {
          tippy_instance.popper.setAttribute('data-wpbc-shared-ui-context-popover-hide-arrow', 'true');
        } else {
          tippy_instance.popper.removeAttribute('data-wpbc-shared-ui-context-popover-hide-arrow');
        }
      }
      if (drag_button) {
        drag_button.hidden = !pinned;
        drag_button.disabled = !pinned;
      }
      if (resize_button) {
        resize_button.hidden = !pinned;
        resize_button.disabled = !pinned;
      }
      surface.setAttribute('data-wpbc-shared-ui-context-popover-pinned', pinned ? 'true' : 'false');
      if (!pin_button || !pin_button_label) {
        return;
      }
      pin_label = pinned ? String(pin_button.getAttribute('data-pinned-label') || '') : String(pin_button.getAttribute('data-pin-label') || '');
      pin_button.setAttribute('aria-pressed', pinned ? 'true' : 'false');
      pin_button.setAttribute('aria-label', pinned ? String(pin_button.getAttribute('data-unpin-label') || pin_label) : pin_label);
      pin_button_label.textContent = pin_label;
    }

    /**
     * Change the neutral pin state for an opted-in controller.
     *
     * @param {boolean} should_pin Requested pin state.
     * @return {boolean} True when the requested state is active.
     */
    function set_pinned(should_pin) {
      var popper_rect;
      should_pin = Boolean(should_pin);
      if (destroyed || 'manual' !== pin_policy || should_pin && !current_trigger) {
        return false;
      }
      cancel_interaction_timers();
      if (should_pin && !pinned && pin_to_viewport && tippy_instance && tippy_instance.popper) {
        popper_rect = tippy_instance.popper.getBoundingClientRect();
        pinned_viewport_position = clamp_pinned_viewport_position(popper_rect.left, popper_rect.top);
      }
      if (!should_pin) {
        finish_pinned_drag();
        finish_pinned_resize();
        clear_pinned_surface_size();
      }
      pinned = should_pin;
      if (pinned && current_trigger && !pin_to_viewport) {
        reference_rect_provider = create_trigger_reference_provider(current_trigger);
        reference_tracks_trigger = true;
        update_reference(reference_rect_provider);
      }
      if (!pinned) {
        pinned_viewport_position = null;
      }
      apply_positioning_mode();
      synchronize_pin_control();
      schedule_surface_constraint_update();
      if ('function' === typeof settings.on_pin_change) {
        settings.on_pin_change(controller, pinned);
      }
      if (!pinned && suspended) {
        close_approved(false, 'programmatic');
        return true;
      }
      if (!pinned && !suspended && is_visible_controller(controller) && !pointer_inside_composite && !is_composite_node(document.activeElement)) {
        schedule_close();
      }
      return pinned === should_pin;
    }

    /**
     * Report whether this controller currently retains pin identity.
     *
     * @return {boolean} True when pinned.
     */
    function is_pinned() {
      return pinned;
    }

    /**
     * Close after a bounded pointer corridor unless focus or pointer returned.
     *
     * @return {void}
     */
    function schedule_close() {
      if (destroyed || !is_visible_controller(controller) || !tippy_instance.state.isVisible) {
        return;
      }
      cancel_pending_close();
      pending_close_timer = window.setTimeout(function () {
        pending_close_timer = 0;
        if (pointer_inside_composite || is_composite_node(document.activeElement) || has_open_child_layers()) {
          return;
        }
        request_close('pointer_exit', false);
      }, hide_delay_ms);
    }

    /**
     * Record and optionally update trigger ARIA only after explicit ownership.
     *
     * Timeline booking cards do not grant this ownership because their ARIA
     * relationship belongs to the Booking Inspector.
     *
     * @param {HTMLElement} trigger Trigger being opened.
     * @return {void}
     */
    function claim_trigger_aria(trigger) {
      var requested_popup;
      if (!owns_trigger_aria || !trigger) {
        return;
      }
      if (owned_trigger_aria && owned_trigger_aria.trigger === trigger) {
        trigger.setAttribute('aria-expanded', 'true');
        return;
      }
      owned_trigger_aria = {
        trigger: trigger,
        had_expanded: trigger.hasAttribute('aria-expanded'),
        expanded: trigger.getAttribute('aria-expanded'),
        had_haspopup: trigger.hasAttribute('aria-haspopup'),
        haspopup: trigger.getAttribute('aria-haspopup')
      };
      trigger.setAttribute('aria-expanded', 'true');
      requested_popup = String(settings.aria_haspopup || '');
      if (-1 !== ['true', 'menu', 'listbox', 'tree', 'grid', 'dialog'].indexOf(requested_popup)) {
        trigger.setAttribute('aria-haspopup', requested_popup);
      }
    }

    /**
     * Release explicitly owned trigger ARIA without touching default consumers.
     *
     * @return {void}
     */
    function release_trigger_aria() {
      var trigger;
      if (!owned_trigger_aria) {
        return;
      }
      trigger = owned_trigger_aria.trigger;
      if (trigger && trigger.isConnected) {
        if (owned_trigger_aria.had_expanded) {
          trigger.setAttribute('aria-expanded', owned_trigger_aria.expanded);
        } else {
          trigger.removeAttribute('aria-expanded');
        }
        if (owned_trigger_aria.had_haspopup) {
          trigger.setAttribute('aria-haspopup', owned_trigger_aria.haspopup);
        } else {
          trigger.removeAttribute('aria-haspopup');
        }
      }
      owned_trigger_aria = null;
    }

    /**
     * Find and focus the first enabled control inside this owned surface.
     *
     * @return {boolean} True when an owned control received focus.
     */
    function focus_first_control() {
      var owner_selector = '[data-wpbc-shared-ui-context-popover-owner="' + component_id + '"]';
      var focusable_selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      var owned_surfaces = document.querySelectorAll(owner_selector);
      var focused = false;
      Array.prototype.some.call(owned_surfaces, function (owned_surface) {
        return Array.prototype.some.call(owned_surface.querySelectorAll(focusable_selector), function (control) {
          if (control.hidden || control.closest('[hidden], [aria-hidden="true"]')) {
            return false;
          }
          control.focus();
          focused = document.activeElement === control;
          return focused;
        });
      });
      return focused;
    }

    /**
     * Test the default or domain-supplied focus-entry keyboard command.
     *
     * @param {KeyboardEvent} event   Candidate keyboard event.
     * @param {HTMLElement}  trigger Candidate trigger.
     * @return {boolean} True when the event requests focus inside the popover.
     */
    function is_focus_entry_command(event, trigger) {
      if (event && event.altKey && !event.ctrlKey && !event.metaKey && 'ArrowDown' === event.key) {
        return true;
      }
      if ('function' === typeof settings.is_focus_entry_key) {
        try {
          return true === settings.is_focus_entry_key(event, trigger, controller);
        } catch (error) {
          return false;
        }
      }
      return false;
    }

    /**
     * Remove only this surface's accessible description token.
     *
     * @return {void}
     */
    function remove_description() {
      var description_ids;
      if (!described_trigger) {
        return;
      }
      description_ids = String(described_trigger.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (description_id) {
        return description_id && component_id !== description_id;
      });
      if (description_ids.length) {
        described_trigger.setAttribute('aria-describedby', description_ids.join(' '));
      } else {
        described_trigger.removeAttribute('aria-describedby');
      }
      described_trigger = null;
    }

    /**
     * Add the preview surface as one description without replacing other IDs.
     *
     * @return {void}
     */
    function add_description() {
      var description_ids;
      remove_description();
      if ('preview' !== mode || !current_trigger) {
        return;
      }
      description_ids = String(current_trigger.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      if (-1 === description_ids.indexOf(component_id)) {
        description_ids.push(component_id);
      }
      current_trigger.setAttribute('aria-describedby', description_ids.join(' '));
      described_trigger = current_trigger;
    }

    /**
     * Hide all shell state hosts before activating one state.
     *
     * @return {void}
     */
    function hide_state_hosts() {
      loading.hidden = true;
      content.hidden = true;
      empty.hidden = true;
      error.hidden = true;
    }

    /**
     * Return the visible viewport's vertical bounds for fixed positioning.
     *
     * The Visual Viewport values keep the constraint correct during browser
     * zoom without assigning the popover's actual coordinates.
     *
     * @return {Object} Numeric top and bottom viewport coordinates.
     */
    function get_vertical_viewport_bounds() {
      var visual_viewport = window.visualViewport;
      var viewport_top = visual_viewport && Number.isFinite(visual_viewport.offsetTop) ? visual_viewport.offsetTop : 0;
      var viewport_height = visual_viewport && Number.isFinite(visual_viewport.height) ? visual_viewport.height : Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
      return {
        top: viewport_top,
        bottom: viewport_top + viewport_height
      };
    }

    /**
     * Resolve the vertical bounds used only for first-open side selection.
     *
     * Consumers with a clipped or sticky host may supply a live rectangle. The
     * rectangle is intersected with the Visual Viewport so browser zoom remains
     * authoritative. Invalid consumer output falls back to the viewport contract.
     *
     * @return {Object} Numeric top and bottom coordinates in viewport space.
     */
    function get_initial_vertical_placement_bounds() {
      var viewport_bounds = get_vertical_viewport_bounds();
      var candidate_bounds;
      var candidate_rectangle;
      if (!get_initial_placement_bounds) {
        return viewport_bounds;
      }
      try {
        candidate_rectangle = normalize_reference_rect(get_initial_placement_bounds());
      } catch (error) {
        candidate_rectangle = null;
      }
      if (!candidate_rectangle) {
        return viewport_bounds;
      }
      candidate_bounds = {
        top: Math.max(viewport_bounds.top, candidate_rectangle.top),
        bottom: Math.min(viewport_bounds.bottom, candidate_rectangle.bottom)
      };
      return candidate_bounds.bottom > candidate_bounds.top ? candidate_bounds : viewport_bounds;
    }

    /**
     * Measure the vertical room available on one reference side.
     *
     * Initial side selection uses the Visual Viewport intersected with an optional
     * consumer-supplied visible host rectangle. The selected side is then retained
     * while a scroll-owned host moves and clips the surface beneath sticky UI.
     *
     * @param {string} placement     Allow-listed Popper placement.
     * @param {Object} reference_rect Normalized reference rectangle.
     * @return {number} Available pixels, or negative infinity for a non-vertical side.
     */
    function get_vertical_placement_space(placement, reference_rect) {
      var placement_side = String(placement || '').split('-')[0];
      var visible_bounds = get_initial_vertical_placement_bounds();
      var reference_gap = 10;
      if ('bottom' === placement_side) {
        return visible_bounds.bottom - reference_rect.bottom - reference_gap - viewport_padding;
      }
      if ('top' === placement_side) {
        return reference_rect.top - reference_gap - visible_bounds.top - viewport_padding;
      }
      return Number.NEGATIVE_INFINITY;
    }

    /**
     * Choose an allowed vertical side before the first Popper measurement.
     *
     * A fixed-height surface can make the requested side too short. In that
     * case, allowing preventOverflow to translate the same placement would
     * move the surface across its reference. Prefer a configured fallback that
     * fits, or the side with the most room when neither side can fully fit.
     * Popper remains responsible for exact coordinates, collision correction,
     * and arrow alignment.
     *
     * @param {Object} reference_rect Normalized reference rectangle.
     * @return {string} Requested or fallback allow-listed placement.
     */
    function resolve_initial_placement(reference_rect) {
      var requested_placement = normalize_placement(settings.placement);
      var requested_side = requested_placement.split('-')[0];
      var surface_rect;
      var required_height;
      var requested_space;
      var best_placement = requested_placement;
      var best_space;
      if (!fit_on_first_open || pinned || 0 >= fixed_unpinned_height || -1 === ['top', 'bottom'].indexOf(requested_side)) {
        return requested_placement;
      }
      surface_rect = surface.getBoundingClientRect();
      required_height = Math.max(fixed_unpinned_height, Number.isFinite(surface_rect.height) ? surface_rect.height : 0);
      requested_space = get_vertical_placement_space(requested_placement, reference_rect);
      if (requested_space >= required_height) {
        return requested_placement;
      }
      best_space = requested_space;
      fallback_placements.some(function (fallback_placement) {
        var fallback_side = fallback_placement.split('-')[0];
        var fallback_space;
        if (-1 === ['top', 'bottom'].indexOf(fallback_side)) {
          return false;
        }
        fallback_space = get_vertical_placement_space(fallback_placement, reference_rect);
        if (fallback_space > best_space) {
          best_placement = fallback_placement;
          best_space = fallback_space;
        }
        return fallback_space >= required_height;
      });
      return best_placement;
    }

    /**
     * Bound the surface width to an opted-in host boundary and viewport.
     *
     * Popper remains responsible for coordinates. This method supplies only a
     * CSS width limit so an oversized body portal cannot paint across a frozen
     * sibling pane when the host's visible canvas is narrower than the preferred
     * surface width.
     *
     * @return {void}
     */
    function constrain_surface_to_positioning_boundary() {
      var boundary_rect;
      var visual_viewport = window.visualViewport;
      var viewport_left;
      var viewport_width;
      var visible_left;
      var visible_right;
      if (pinned && pin_to_viewport || 'viewport' === positioning_boundary || !positioning_boundary.isConnected) {
        surface.style.removeProperty(available_inline_size_property);
        return;
      }
      boundary_rect = positioning_boundary.getBoundingClientRect();
      viewport_left = visual_viewport && Number.isFinite(visual_viewport.offsetLeft) ? visual_viewport.offsetLeft : 0;
      viewport_width = visual_viewport && Number.isFinite(visual_viewport.width) ? visual_viewport.width : Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      visible_left = Math.max(boundary_rect.left, viewport_left);
      visible_right = Math.min(boundary_rect.right, viewport_left + viewport_width);
      surface.style.setProperty(available_inline_size_property, Math.max(1, Math.floor(visible_right - visible_left - 2 * viewport_padding)) + 'px');
    }

    /**
     * Remove a height retained from an earlier visible placement.
     *
     * @return {void}
     */
    function clear_surface_height_constraint() {
      surface.style.removeProperty(available_height_property);
    }

    /**
     * Include or exclude the Tippy root from layout and scrollable overflow.
     *
     * A hidden absolutely positioned root can otherwise retain stale transformed
     * coordinates inside a scrolling portal and enlarge that portal's scrollable
     * overflow after its domain content has been rerendered.
     *
     * @param {boolean} should_participate Whether the root may affect layout overflow.
     * @return {void}
     */
    function set_popper_layout_participation(should_participate) {
      if (!tippy_instance || !tippy_instance.popper) {
        return;
      }
      if (should_participate) {
        tippy_instance.popper.removeAttribute('hidden');
        return;
      }
      tippy_instance.popper.setAttribute('hidden', '');
    }

    /**
     * Return the base placement currently committed by Popper and Tippy.
     *
     * Tippy stores `data-placement` on its inner `.tippy-box`, not on the
     * outer popper node. Popper state is authoritative; the DOM attributes
     * remain compatibility fallbacks for versions that expose state later.
     *
     * @return {string} Base placement, or an empty string when unavailable.
     */
    function get_current_placement() {
      var placement = '';
      var tippy_box;
      if (tippy_instance && tippy_instance.popperInstance && tippy_instance.popperInstance.state) {
        placement = String(tippy_instance.popperInstance.state.placement || '');
      }
      if (!placement && tippy_instance && tippy_instance.popper) {
        placement = String(tippy_instance.popper.getAttribute('data-popper-placement') || '');
        tippy_box = tippy_instance.popper.querySelector('.tippy-box[data-placement]');
        if (!placement && tippy_box) {
          placement = String(tippy_box.getAttribute('data-placement') || '');
        }
      }
      return placement.split('-')[0];
    }

    /**
     * Bound growing content to the space on its currently rendered side.
     *
     * The trigger-facing edge comes from the reference rectangle rather than a
     * surface that Popper may already have translated to contain oversized
     * content. This keeps the arrow attached and delegates overflow to the shell.
     *
     * @return {void}
     */
    function constrain_surface_to_current_placement() {
      var placement;
      var reference_rect;
      var viewport_bounds;
      var available_height;
      var reference_gap = 10;
      if (!tippy_instance || !tippy_instance.state.isVisible || !tippy_instance.popper || !surface.getClientRects().length) {
        return;
      }
      if (pinned && pin_to_viewport && pinned_viewport_position) {
        viewport_bounds = get_vertical_viewport_bounds();
        available_height = viewport_bounds.bottom - viewport_bounds.top - 2 * viewport_padding;
        surface.style.setProperty(available_height_property, Math.max(1, Math.floor(available_height)) + 'px');
        move_pinned_surface(pinned_viewport_position.left, pinned_viewport_position.top);
        return;
      }
      placement = get_current_placement();
      if (-1 === ['top', 'bottom', 'left', 'right'].indexOf(placement)) {
        return;
      }
      reference_rect = get_reference_rect();
      viewport_bounds = get_vertical_viewport_bounds();
      if ('bottom' === placement) {
        available_height = viewport_bounds.bottom - reference_rect.bottom - reference_gap - viewport_padding;
      } else if ('top' === placement) {
        available_height = reference_rect.top - reference_gap - viewport_bounds.top - viewport_padding;
      } else {
        available_height = viewport_bounds.bottom - viewport_bounds.top - 2 * viewport_padding;
      }
      if (0 < available_height) {
        surface.style.setProperty(available_height_property, Math.max(1, Math.floor(available_height)) + 'px');
      }
    }

    /**
     * Cancel a queued post-layout viewport constraint.
     *
     * @return {void}
     */
    function cancel_surface_constraint_update() {
      if (pending_surface_constraint_frame) {
        window.cancelAnimationFrame(pending_surface_constraint_frame);
        pending_surface_constraint_frame = 0;
      }
    }

    /**
     * Recompute the surface limit after Popper has committed current geometry.
     *
     * State templates may be installed before the manual Tippy instance becomes
     * visible. Batching the mounted, shown, replacement, and viewport paths into
     * one animation frame prevents the first open from retaining the 100vh
     * fallback and avoids repeated synchronous layout work.
     *
     * @return {void}
     */
    function schedule_surface_constraint_update() {
      if (destroyed || pending_surface_constraint_frame) {
        return;
      }
      pending_surface_constraint_frame = window.requestAnimationFrame(function () {
        pending_surface_constraint_frame = 0;
        if (destroyed || !tippy_instance || !tippy_instance.state.isVisible) {
          return;
        }
        constrain_surface_to_positioning_boundary();
        if (tippy_instance.popperInstance) {
          tippy_instance.popperInstance.forceUpdate();
        }
        constrain_surface_to_current_placement();
        if (tippy_instance.popperInstance) {
          tippy_instance.popperInstance.forceUpdate();
        }
      });
    }

    /**
     * Commit a shell state and its polite announcement.
     *
     * @param {string}  next_state  Allow-listed shell state.
     * @param {string}  announcement Plain localized announcement.
     * @param {boolean} is_busy     Whether the shell remains busy.
     * @return {void}
     */
    function commit_state(next_state, announcement, is_busy) {
      state = next_state;
      surface.setAttribute('data-wpbc-shared-ui-context-popover-state', next_state);
      surface.setAttribute('aria-busy', is_busy ? 'true' : 'false');
      status.textContent = normalize_text(announcement, 500);
      if (tippy_instance && tippy_instance.popperInstance) {
        tippy_instance.popperInstance.forceUpdate();
      }
      schedule_surface_constraint_update();
    }

    /**
     * Show the neutral idle shell without state content.
     *
     * @param {string} announcement Optional localized announcement.
     * @return {void}
     */
    function set_idle(announcement) {
      constrain_surface_to_current_placement();
      hide_state_hosts();
      content.textContent = '';
      commit_state('idle', announcement, false);
    }

    /**
     * Show the loading state with a caller-owned localized label.
     *
     * @param {string} message Localized loading label.
     * @return {void}
     */
    function set_loading(message) {
      message = normalize_text(message, 240);
      constrain_surface_to_current_placement();
      hide_state_hosts();
      content.textContent = '';
      if (loading_label && message) {
        loading_label.textContent = message;
      }
      loading.hidden = false;
      commit_state('loading', message, true);
    }

    /**
     * Show caller-rendered content from an allow-listed local template.
     *
     * The shared shell deliberately does not sanitize or authorize the supplied
     * markup. Callers must render an authorized DTO through a fixed WordPress
     * template before invoking this method.
     *
     * @param {string} rendered_content Locally rendered authorized markup.
     * @param {string} announcement    Localized completion announcement.
     * @return {void}
     */
    function set_content(rendered_content, announcement) {
      constrain_surface_to_current_placement();
      hide_state_hosts();
      content.innerHTML = String(rendered_content || '');
      content.hidden = false;
      commit_state('content', announcement, false);
    }

    /**
     * Update the stable shell heading without replacing shell controls.
     *
     * @param {string} title Plain localized title.
     * @return {void}
     */
    function set_title(title) {
      title = normalize_text(title, 200);
      if (heading) {
        heading.textContent = title;
      }
    }

    /**
     * Replace the visible heading with caller-rendered domain header content.
     *
     * The shell-owned heading remains the accessible dialog name. The supplied
     * markup must come from an allow-listed local WordPress template.
     *
     * @param {string} rendered_header Domain header markup.
     * @param {string} accessible_title Plain localized dialog title.
     * @return {void}
     */
    function set_header(rendered_header, accessible_title) {
      if (!heading || !header_content) {
        return;
      }
      heading.textContent = normalize_text(accessible_title, 200) || default_heading;
      heading.classList.add('wpbc_shared_ui_context_popover__heading--visually-hidden');
      header_content.innerHTML = String(rendered_header || '');
      header_content.hidden = false;
      schedule_surface_constraint_update();
    }

    /**
     * Restore the shell's plain default heading.
     *
     * @param {string} accessible_title Optional replacement title.
     * @return {void}
     */
    function reset_header(accessible_title) {
      if (!heading || !header_content) {
        return;
      }
      heading.textContent = normalize_text(accessible_title, 200) || default_heading;
      heading.classList.remove('wpbc_shared_ui_context_popover__heading--visually-hidden');
      header_content.textContent = '';
      header_content.hidden = true;
      schedule_surface_constraint_update();
    }

    /**
     * Report caller-owned partial work without replacing visible content.
     *
     * This neutral API exists for composite domain views whose known content
     * must remain visible while one internal region loads. Domains remain
     * responsible for setting aria-busy on the affected region itself.
     *
     * @param {boolean} is_busy      Whether partial work remains active.
     * @param {string}  announcement Plain localized live announcement.
     * @return {void}
     */
    function set_busy(is_busy, announcement) {
      surface.setAttribute('aria-busy', is_busy ? 'true' : 'false');
      status.textContent = normalize_text(announcement, 500);
      if (tippy_instance && tippy_instance.popperInstance) {
        tippy_instance.popperInstance.forceUpdate();
      }
      schedule_surface_constraint_update();
    }

    /**
     * Show a plain-text empty state.
     *
     * @param {string} message Localized empty-state message.
     * @return {void}
     */
    function set_empty(message) {
      var paragraph = empty.querySelector('p');
      message = normalize_text(message, 500);
      constrain_surface_to_current_placement();
      hide_state_hosts();
      content.textContent = '';
      if (paragraph && message) {
        paragraph.textContent = message;
      }
      empty.hidden = false;
      commit_state('empty', message, false);
    }

    /**
     * Show a recoverable plain-text error and optional retry action.
     *
     * @param {string} message     Localized error message.
     * @param {string} retry_label Localized retry label; empty hides retry.
     * @return {void}
     */
    function set_error(message, retry_label) {
      message = normalize_text(message, 500);
      retry_label = normalize_text(retry_label, 160);
      constrain_surface_to_current_placement();
      hide_state_hosts();
      content.textContent = '';
      if (error_message) {
        error_message.textContent = message;
      }
      retry_button.hidden = !retry_label || 'function' !== typeof settings.on_retry;
      if (retry_label) {
        retry_button.textContent = retry_label;
      }
      error.hidden = false;
      commit_state('error', message, false);
    }

    /**
     * Open the shell against an explicit virtual-reference provider.
     *
     * @param {HTMLElement|null}    trigger                     Activating domain trigger.
     * @param {Object|Function|null} reference_rect              DOMRect-like value or getter.
     * @param {string}               requested_activation_method Internal activation-source label.
     * @return {boolean} True when the open request was accepted.
     */
    function open_with_reference(trigger, reference_rect, requested_activation_method) {
      var initial_placement;
      var resolved_reference_rect;
      if (destroyed || suspended || !trigger || 1 !== trigger.nodeType || !trigger.isConnected || !can_use_trigger(trigger)) {
        return false;
      }
      if (pinned && current_trigger && current_trigger !== trigger) {
        return false;
      }
      resolved_reference_rect = resolve_open_reference_rect(reference_rect);
      if (!resolved_reference_rect) {
        return false;
      }
      arbitrate_visible_controllers(controller);
      cancel_pending_close();
      if (current_trigger && current_trigger !== trigger) {
        remove_description();
        release_trigger_aria();
      }
      current_trigger = trigger;
      reference_rect_provider = reference_rect;
      reference_tracks_trigger = 'function' === typeof reference_rect;
      last_valid_reference_rect = resolved_reference_rect;
      activation_method = requested_activation_method;
      pointer_inside_composite = 'pointer' === requested_activation_method;
      initial_fit_pending = fit_on_first_open;
      initial_fit_captured = false;
      initial_fit_adjustment = {
        x: 0,
        y: 0
      };
      clear_surface_height_constraint();
      surface.hidden = false;
      set_popper_layout_participation(true);
      initial_placement = resolve_initial_placement(resolved_reference_rect);
      tippy_instance.setProps({
        getReferenceClientRect: get_reference_rect,
        interactive: true,
        placement: initial_placement
      });
      add_description();
      claim_trigger_aria(trigger);
      tippy_instance.show();
      register_visible_controller(controller);
      announce_layer_open();
      if ('function' === typeof settings.on_open) {
        settings.on_open(controller, trigger);
      }
      return true;
    }

    /**
     * Open against the trigger's live element rectangle.
     *
     * This general element-relative method never reads remembered pointer
     * coordinates. Keyboard activation delegates to the same live getter.
     *
     * @param {HTMLElement|null} trigger Activating domain trigger.
     * @return {boolean} True when the open request was accepted.
     */
    function open(trigger) {
      cancel_pending_open();
      return open_with_reference(trigger, create_trigger_reference_provider(trigger), 'element');
    }

    /**
     * Open from keyboard focus using the trigger's current rectangle.
     *
     * @param {HTMLElement|null} trigger Focused domain trigger.
     * @return {boolean} True when the open request was accepted.
     */
    function open_keyboard(trigger) {
      cancel_pending_open();
      if (suppressed_focus_trigger === trigger) {
        suppressed_focus_trigger = null;
        return false;
      }
      return open_with_reference(trigger, create_trigger_reference_provider(trigger), 'keyboard');
    }

    /**
     * Move focus from a trigger into the first owned popover control.
     *
     * Domains may delegate keydown events to this method. Alt+ArrowDown is
     * always supported; `is_focus_entry_key` may add one domain command.
     *
     * @param {HTMLElement|null} trigger Trigger receiving the keyboard event.
     * @param {KeyboardEvent}     event   Trigger keyboard event.
     * @return {boolean} True when the command was recognized.
     */
    function handle_trigger_keydown(trigger, event) {
      if (destroyed || !trigger || !event || !can_use_trigger(trigger) || !is_focus_entry_command(event, trigger)) {
        return false;
      }
      event.preventDefault();
      event.stopPropagation();
      if (current_trigger !== trigger || !tippy_instance.state.isVisible) {
        open_keyboard(trigger);
      }
      if (pending_focus_entry_timer) {
        window.clearTimeout(pending_focus_entry_timer);
      }
      pending_focus_entry_timer = window.setTimeout(function () {
        pending_focus_entry_timer = 0;
        if (is_visible_controller(controller) && tippy_instance.state.isVisible) {
          focus_first_control();
        }
      }, 0);
      return true;
    }

    /**
     * Schedule pointer activation and resolve its reference at delay expiry.
     *
     * @param {HTMLElement|null} trigger Activating domain trigger.
     * @param {PointerEvent}     event   Initial pointer event.
     * @return {boolean} True when a valid delayed open was scheduled.
     */
    function schedule_pointer_open(trigger, event) {
      if (destroyed || !trigger || 1 !== trigger.nodeType || !trigger.isConnected || !can_use_trigger(trigger) || !event || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
        return false;
      }
      if (is_visible_controller(controller) && current_trigger === trigger && tippy_instance.state.isVisible) {
        pointer_inside_composite = true;
        cancel_pending_close();
        return true;
      }
      cancel_pending_open();
      pending_pointer_trigger = trigger;
      pending_pointer_id = Number.isFinite(event.pointerId) ? event.pointerId : null;
      latest_pointer_coordinates = {
        x: event.clientX,
        y: event.clientY
      };
      document.addEventListener('pointermove', capture_pending_pointer, true);
      trigger.addEventListener('pointerleave', cancel_pending_open);
      pending_show_timer = window.setTimeout(function () {
        var delayed_trigger = pending_pointer_trigger;
        var frozen_pointer = latest_pointer_coordinates;
        cancel_pending_open();
        if (!delayed_trigger || !frozen_pointer) {
          return;
        }
        open_with_reference(delayed_trigger, 'function' === typeof settings.get_reference_rect ? create_trigger_reference_provider(delayed_trigger) : create_pointer_reference_rect(delayed_trigger, frozen_pointer.x, frozen_pointer.y, pointer_anchor), 'pointer');
      }, show_delay_ms);
      return true;
    }

    /**
     * Finalize an approved close after policy has accepted its reason.
     *
     * @param {boolean} restore_focus Whether focus returns to the trigger.
     * @param {string}  reason        Normalized approved close reason.
     * @return {void}
     */
    function finalize_close(restore_focus, reason) {
      var focus_target = current_trigger;
      var had_owned_state;
      var should_restore;
      had_owned_state = Boolean(pending_show_timer || current_trigger || tippy_instance.state.isVisible || is_visible_controller(controller) || suspended);
      cancel_interaction_timers();
      if (!had_owned_state) {
        return;
      }
      should_restore = Boolean(restore_focus && focus_target && focus_target.isConnected);
      remove_description();
      release_trigger_aria();
      unregister_visible_controller(controller);
      pointer_inside_composite = false;
      finish_pinned_drag();
      finish_pinned_resize();
      clear_pinned_surface_size();
      pinned = false;
      pinned_viewport_position = null;
      initial_fit_pending = false;
      initial_fit_captured = false;
      suspended = false;
      suspension_reason = '';
      external_suspension_hold = false;
      suspending_layers = {};
      synchronize_pin_control();
      apply_positioning_mode();
      surface.removeAttribute('data-wpbc-shared-ui-context-popover-suspended');
      current_trigger = null;
      reference_rect_provider = null;
      reference_tracks_trigger = false;
      last_valid_reference_rect = null;
      activation_method = 'none';
      open_child_layers = {};
      announce_layer_close();
      if (should_restore && 'function' === typeof focus_target.focus) {
        suppressed_focus_trigger = focus_target;
        if (suppressed_focus_timer) {
          window.clearTimeout(suppressed_focus_timer);
        }
        focus_target.focus();
        suppressed_focus_timer = window.setTimeout(function () {
          suppressed_focus_trigger = null;
          suppressed_focus_timer = 0;
        }, 0);
      }
      if ('function' === typeof settings.on_close) {
        settings.on_close(controller, reason);
      }
    }

    /**
     * Close the owned Tippy instance after policy approval.
     *
     * @param {boolean} restore_focus Whether focus returns to the trigger.
     * @param {string}  reason        Normalized approved close reason.
     * @return {void}
     */
    function close_approved(restore_focus, reason) {
      if (tippy_instance.state.isVisible) {
        approved_tippy_hide_reason = reason;
        tippy_instance.hide();
        if (approved_tippy_hide_reason === reason) {
          approved_tippy_hide_reason = '';
        }
      }
      finalize_close(restore_focus, reason);
    }

    /**
     * Request a reasoned close before mutating owned lifecycle state.
     *
     * Automatic reasons are rejected while pinned. Explicit and authority
     * reasons remain available. Suspension reasons retain an opted-in pin.
     *
     * @param {string}  reason        Dismissal or suspension reason.
     * @param {boolean} restore_focus Whether focus returns to the trigger.
     * @return {boolean} True when the request was accepted.
     */
    function request_close(reason, restore_focus) {
      reason = normalize_close_reason(reason);
      if (destroyed || !reason) {
        return false;
      }
      if ('explicit' === dismiss_policy && is_automatic_close_reason(reason)) {
        return false;
      }
      if ('retain' === external_scroll_policy && 'pointer_exit' === reason && Date.now() < retained_scroll_until) {
        return false;
      }
      if (pinned && -1 !== suspension_reasons.indexOf(reason)) {
        return suspend(reason);
      }
      if (pinned && is_automatic_close_reason(reason)) {
        return false;
      }
      close_approved(Boolean(restore_focus), reason);
      return true;
    }

    /**
     * Preserve compatibility for existing explicit controller consumers.
     *
     * @param {boolean} restore_focus Whether focus returns to the trigger.
     * @return {void}
     */
    function close(restore_focus) {
      request_close('programmatic', restore_focus);
    }

    /**
     * Temporarily hide an opted-in pinned surface without clearing identity.
     *
     * @param {string}  reason                Neutral suspension reason.
     * @param {boolean} [layer_owned=false] True when a shared layer owns the hold.
     * @return {boolean} True when the pinned identity was retained.
     */
    function suspend(reason, layer_owned) {
      reason = normalize_close_reason(reason);
      if (destroyed || !pinned || -1 === suspension_reasons.indexOf(reason) || !current_trigger) {
        return false;
      }
      if (!layer_owned) {
        external_suspension_hold = true;
      }
      cancel_interaction_timers();
      if (suspended) {
        if ('reference_refresh' === reason) {
          suspension_reason = reason;
          surface.setAttribute('data-wpbc-shared-ui-context-popover-suspended', reason);
        }
        return true;
      }
      suspended = true;
      suspension_reason = reason;
      surface.setAttribute('data-wpbc-shared-ui-context-popover-suspended', reason);
      remove_description();
      release_trigger_aria();
      unregister_visible_controller(controller);
      approved_tippy_hide_reason = reason;
      tippy_instance.hide();
      if (approved_tippy_hide_reason === reason) {
        approved_tippy_hide_reason = '';
      }
      announce_layer_close();
      if ('function' === typeof settings.on_suspend) {
        settings.on_suspend(controller, reason);
      }
      return true;
    }

    /**
     * Restore a safely retained pinned surface after blocking ownership ends.
     *
     * @param {boolean} [release_external_hold=true] True to release an adapter hold.
     * @return {boolean} True when the surface resumed.
     */
    function resume(release_external_hold) {
      var resolved_reference_rect;
      if (false !== release_external_hold) {
        external_suspension_hold = false;
      }
      if (destroyed || !pinned || !suspended || external_suspension_hold || Object.keys(suspending_layers).length || !current_trigger || !current_trigger.isConnected) {
        return false;
      }
      resolved_reference_rect = resolve_open_reference_rect(reference_rect_provider, pin_to_viewport);
      if (!resolved_reference_rect) {
        return false;
      }
      last_valid_reference_rect = resolved_reference_rect;
      suspended = false;
      suspension_reason = '';
      surface.removeAttribute('data-wpbc-shared-ui-context-popover-suspended');
      surface.hidden = false;
      set_popper_layout_participation(true);
      tippy_instance.setProps({
        getReferenceClientRect: get_reference_rect,
        interactive: true,
        placement: normalize_placement(settings.placement)
      });
      add_description();
      claim_trigger_aria(current_trigger);
      tippy_instance.show();
      register_visible_controller(controller);
      announce_layer_open();
      if ('function' === typeof settings.on_resume) {
        settings.on_resume(controller, current_trigger);
      }
      return true;
    }

    /**
     * Rebind retained identity to a replacement domain trigger.
     *
     * The domain remains responsible for proving that the replacement trigger
     * has the same authorized meaning. Shared code validates only DOM ownership
     * and reference geometry.
     *
     * @param {HTMLElement|null}    trigger        Replacement trigger.
     * @param {Object|Function|null} reference_rect Optional reference provider.
     * @return {boolean} True when rebinding succeeded.
     */
    function rebind_trigger(trigger, reference_rect) {
      var requested_reference = reference_rect || create_trigger_reference_provider(trigger);
      var resolved_reference_rect;
      if (destroyed || !current_trigger || !trigger || 1 !== trigger.nodeType || !trigger.isConnected || !can_use_trigger(trigger)) {
        return false;
      }
      resolved_reference_rect = resolve_open_reference_rect(requested_reference, pinned && pin_to_viewport);
      if (!resolved_reference_rect && !('strict_live_owner' === reference_policy && pinned && suspended)) {
        return false;
      }
      cancel_interaction_timers();
      remove_description();
      release_trigger_aria();
      current_trigger = trigger;
      reference_rect_provider = requested_reference;
      reference_tracks_trigger = 'function' === typeof requested_reference;
      last_valid_reference_rect = resolved_reference_rect;
      if (!suspended) {
        add_description();
        claim_trigger_aria(trigger);
        update_reference();
      }
      if ('function' === typeof settings.on_rebind) {
        settings.on_rebind(controller, trigger);
      }
      return true;
    }

    /**
     * Recalculate the current Popper position after caller-owned content or
     * reference geometry changes.
     *
     * @param {Object|Function|null} reference_rect Optional replacement getter.
     * @return {boolean} True when a current live reference was measured.
     */
    function update_reference(reference_rect) {
      var resolved_reference_rect;
      if (reference_rect) {
        reference_rect_provider = reference_rect;
        reference_tracks_trigger = 'function' === typeof reference_rect;
      }
      resolved_reference_rect = resolve_open_reference_rect(reference_rect_provider, pinned && pin_to_viewport);
      if (!resolved_reference_rect) {
        if ('strict_live_owner' === reference_policy) {
          last_valid_reference_rect = null;
          if (pinned) {
            suspend('reference_unavailable');
          } else {
            request_close('external_scroll', false);
          }
        }
        return false;
      }
      last_valid_reference_rect = resolved_reference_rect;
      if (tippy_instance.popperInstance) {
        tippy_instance.popperInstance.forceUpdate();
      }
      schedule_surface_constraint_update();
      return true;
    }

    /**
     * Refresh only the neutral viewport constraint after viewport geometry moves.
     *
     * @return {void}
     */
    function handle_viewport_geometry_change() {
      if (is_visible_controller(controller)) {
        if (pinned && pin_to_viewport && pinned_viewport_position) {
          if (pinned_viewport_size) {
            resize_pinned_surface(pinned_viewport_size.width, pinned_viewport_size.height, false);
          }
          move_pinned_surface(pinned_viewport_position.left, pinned_viewport_position.top);
          schedule_surface_constraint_update();
        } else if ('strict_live_owner' === reference_policy) {
          update_reference();
        } else {
          schedule_surface_constraint_update();
        }
      }
    }

    /**
     * Pin the surface while the pointer is anywhere in the composite region.
     *
     * @param {PointerEvent} event Pointer-over event.
     * @return {void}
     */
    function handle_document_pointer_over(event) {
      if (!is_visible_controller(controller) || !is_composite_node(event.target)) {
        return;
      }
      pointer_inside_composite = true;
      cancel_pending_close();
    }

    /**
     * Start the pointer corridor delay after leaving the complete region.
     *
     * @param {PointerEvent} event Pointer-out event.
     * @return {void}
     */
    function handle_document_pointer_out(event) {
      if (!is_visible_controller(controller) || !is_composite_node(event.target) || is_composite_node(event.relatedTarget)) {
        return;
      }
      pointer_inside_composite = false;
      schedule_close();
    }

    /**
     * Close before an outside pointer action without cancelling that action.
     *
     * @param {PointerEvent} event Captured pointer-down event.
     * @return {void}
     */
    function handle_document_pointer_down(event) {
      if (is_clipped_title_tooltip_target(event.target)) {
        return;
      }
      if ((is_visible_controller(controller) || pending_show_timer) && !is_composite_node(event.target)) {
        request_close('outside_pointer', false);
      }
    }

    /**
     * Pin the surface whenever focus enters any composite-region control.
     *
     * @param {FocusEvent} event Focus-in event.
     * @return {void}
     */
    function handle_document_focus_in(event) {
      if (!is_visible_controller(controller) || !is_composite_node(event.target)) {
        return;
      }
      if (pending_focus_check_timer) {
        window.clearTimeout(pending_focus_check_timer);
        pending_focus_check_timer = 0;
      }
      if (pending_focus_entry_timer) {
        window.clearTimeout(pending_focus_entry_timer);
        pending_focus_entry_timer = 0;
      }
      cancel_pending_close();
    }

    /**
     * Close after focus has settled outside the complete composite region.
     *
     * @param {FocusEvent} event Focus-out event.
     * @return {void}
     */
    function handle_document_focus_out(event) {
      if (!is_visible_controller(controller) || !is_composite_node(event.target)) {
        return;
      }
      if (pending_focus_check_timer) {
        window.clearTimeout(pending_focus_check_timer);
      }
      pending_focus_check_timer = window.setTimeout(function () {
        pending_focus_check_timer = 0;
        if (is_visible_controller(controller) && !is_composite_node(document.activeElement)) {
          request_close('outside_focus', false);
        }
      }, 0);
    }

    /**
     * Retain an opted-in surface while external scrolling changes geometry.
     *
     * The short grace period prevents a synthetic pointer exit caused only by
     * moving content beneath a stationary pointer from closing the surface.
     * Explicit outside-pointer, focus, Close, and Escape paths remain active.
     *
     * @return {void}
     */
    function retain_during_external_scroll() {
      retained_scroll_until = Date.now() + external_scroll_grace_ms;
      cancel_pending_open();
      cancel_pending_close();
      if (is_visible_controller(controller)) {
        schedule_surface_constraint_update();
      }
    }

    /**
     * Apply the configured policy to a scroll outside the owned surface.
     *
     * @param {Event} event Captured scroll event.
     * @return {void}
     */
    function handle_document_scroll(event) {
      if (is_popover_owned_node(event.target)) {
        return;
      }
      if (is_visible_controller(controller) || pending_show_timer) {
        if ('retain' === external_scroll_policy) {
          retain_during_external_scroll();
          return;
        }
        if (!request_close('external_scroll', false) && pinned && 'strict_live_owner' === reference_policy) {
          update_reference();
        }
      }
    }

    /**
     * Apply the configured policy when the document viewport itself scrolls.
     *
     * @return {void}
     */
    function handle_window_scroll() {
      if (is_visible_controller(controller) || pending_show_timer) {
        if ('retain' === external_scroll_policy) {
          retain_during_external_scroll();
          return;
        }
        if (!request_close('external_scroll', false) && pinned && 'strict_live_owner' === reference_policy) {
          update_reference();
        }
      }
    }

    /**
     * Prevent surface activation from reaching unrelated document consumers.
     *
     * Target controls still receive their native event and local handlers.
     * External owned portals remain unstopped because their widgets may require
     * document delegation and their body portal is outside the Timeline subtree.
     *
     * @param {Event} event Pointer-down or click event.
     * @return {void}
     */
    function handle_owned_activation(event) {
      if (is_visible_controller(controller) && is_popover_owned_node(event.target)) {
        event.stopPropagation();
      }
    }

    /**
     * Destroy only this component's surface, Tippy sentinel, and listeners.
     *
     * @return {void}
     */
    function destroy() {
      if (destroyed) {
        return;
      }
      request_close('destroy', false);
      cancel_interaction_timers();
      cancel_surface_constraint_update();
      finish_pinned_drag();
      finish_pinned_resize();
      clear_pinned_surface_size();
      destroyed = true;
      remove_description();
      release_trigger_aria();
      surface.removeEventListener('click', handle_surface_click);
      surface.removeEventListener('pointerdown', handle_owned_activation);
      if (drag_button) {
        drag_button.removeEventListener('pointerdown', handle_pinned_drag_pointer_down);
        drag_button.removeEventListener('keydown', handle_pinned_drag_keydown);
      }
      if (resize_button) {
        resize_button.removeEventListener('pointerdown', handle_pinned_resize_pointer_down);
        resize_button.removeEventListener('keydown', handle_pinned_resize_keydown);
      }
      document.removeEventListener('keydown', handle_document_keydown, true);
      document.removeEventListener('pointerover', handle_document_pointer_over, true);
      document.removeEventListener('pointerout', handle_document_pointer_out, true);
      document.removeEventListener('pointerdown', handle_document_pointer_down, true);
      document.removeEventListener('focusin', handle_document_focus_in, true);
      document.removeEventListener('focusout', handle_document_focus_out, true);
      document.removeEventListener('scroll', handle_document_scroll, true);
      document.removeEventListener(layer_open_event, handle_layer_open);
      document.removeEventListener(layer_close_event, handle_layer_close);
      window.removeEventListener('scroll', handle_window_scroll);
      window.removeEventListener('resize', handle_viewport_geometry_change);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handle_viewport_geometry_change);
        window.visualViewport.removeEventListener('scroll', handle_viewport_geometry_change);
      }
      tippy_instance.destroy();
      if (sentinel.parentNode) {
        sentinel.parentNode.removeChild(sentinel);
      }
      unregister_visible_controller(controller);
      delete registered_controllers[component_id];
      current_trigger = null;
      reference_rect_provider = null;
      reference_tracks_trigger = false;
      last_valid_reference_rect = null;
      activation_method = 'none';
      pointer_inside_composite = false;
      suppressed_focus_trigger = null;
      registered_child_layers = {};
      open_child_layers = {};
      suspending_layers = {};
    }

    /**
     * Handle shared close and recoverable-error controls.
     *
     * @param {MouseEvent} event Surface click event.
     * @return {void}
     */
    function handle_surface_click(event) {
      event.stopPropagation();
      if (event.target.closest('[data-wpbc-shared-ui-context-popover-pin]')) {
        event.preventDefault();
        set_pinned(!pinned);
        return;
      }
      if (event.target.closest('[data-wpbc-shared-ui-context-popover-close]')) {
        event.preventDefault();
        request_close('explicit_close', true);
        return;
      }
      if (event.target.closest('[data-wpbc-shared-ui-context-popover-retry]') && 'function' === typeof settings.on_retry) {
        event.preventDefault();
        settings.on_retry(controller);
      }
    }

    /**
     * Close only the active owned surface when Escape is pressed.
     *
     * @param {KeyboardEvent} event Document keyboard event.
     * @return {void}
     */
    function handle_document_keydown(event) {
      if ('Escape' === event.key && get_escape_controller(event.target) === controller && tippy_instance.state.isVisible) {
        event.preventDefault();
        event.stopImmediatePropagation();
        request_close('escape', true);
      }
    }
    tippy_instance = window.wpbc_tippy(sentinel, {
      allowHTML: true,
      arrow: true,
      appendTo: function () {
        return portal_host;
      },
      aria: {
        content: null,
        expanded: false
      },
      content: surface,
      duration: [120, 0],
      getReferenceClientRect: get_reference_rect,
      hideOnClick: false,
      interactive: true,
      interactiveBorder: 10,
      interactiveDebounce: 30,
      maxWidth: maximum_width,
      offset: [0, 10],
      placement: normalize_placement(settings.placement),
      popperOptions: {
        strategy: positioning_strategy,
        modifiers: popper_modifiers
      },
      role: null,
      showOnCreate: false,
      theme: 'wpbc-shared-ui-context-popover',
      touch: false,
      trigger: 'manual',
      zIndex: layer_z_index,
      onHide: function () {
        var approved_reason = approved_tippy_hide_reason;
        if (approved_reason) {
          approved_tippy_hide_reason = '';
          return true;
        }
        if (pinned) {
          return false;
        }
        finalize_close(false, 'uncontrolled_library_hide');
        return true;
      },
      onMount: function () {
        schedule_surface_constraint_update();
      },
      onShown: function () {
        schedule_surface_constraint_update();
      },
      onHidden: function () {
        cancel_surface_constraint_update();
        surface.hidden = true;
        set_popper_layout_participation(false);
        clear_surface_height_constraint();
      }
    });
    if (!tippy_instance) {
      if (sentinel.parentNode) {
        sentinel.parentNode.removeChild(sentinel);
      }
      return null;
    }
    surface.addEventListener('click', handle_surface_click);
    surface.addEventListener('pointerdown', handle_owned_activation);
    if (drag_button) {
      drag_button.addEventListener('pointerdown', handle_pinned_drag_pointer_down);
      drag_button.addEventListener('keydown', handle_pinned_drag_keydown);
    }
    if (resize_button) {
      resize_button.addEventListener('pointerdown', handle_pinned_resize_pointer_down);
      resize_button.addEventListener('keydown', handle_pinned_resize_keydown);
    }
    document.addEventListener('keydown', handle_document_keydown, true);
    document.addEventListener('pointerover', handle_document_pointer_over, true);
    document.addEventListener('pointerout', handle_document_pointer_out, true);
    document.addEventListener('pointerdown', handle_document_pointer_down, true);
    document.addEventListener('focusin', handle_document_focus_in, true);
    document.addEventListener('focusout', handle_document_focus_out, true);
    document.addEventListener('scroll', handle_document_scroll, true);
    document.addEventListener(layer_open_event, handle_layer_open);
    document.addEventListener(layer_close_event, handle_layer_close);
    window.addEventListener('scroll', handle_window_scroll, {
      passive: true
    });
    window.addEventListener('resize', handle_viewport_geometry_change, {
      passive: true
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handle_viewport_geometry_change, {
        passive: true
      });
      window.visualViewport.addEventListener('scroll', handle_viewport_geometry_change, {
        passive: true
      });
    }
    set_idle('');
    controller = {
      open: open,
      open_keyboard: open_keyboard,
      handle_trigger_keydown: handle_trigger_keydown,
      focus_first_control: focus_first_control,
      schedule_pointer_open: schedule_pointer_open,
      cancel_pending_open: cancel_pending_open,
      cancel_pending_close: cancel_pending_close,
      register_child_layer: register_child_layer,
      unregister_child_layer: unregister_child_layer,
      can_use_trigger: can_use_trigger,
      close: close,
      request_close: request_close,
      set_pinned: set_pinned,
      is_pinned: is_pinned,
      suspend: suspend,
      resume: resume,
      rebind_trigger: rebind_trigger,
      destroy: destroy,
      set_idle: set_idle,
      set_loading: set_loading,
      set_content: set_content,
      set_title: set_title,
      set_header: set_header,
      reset_header: reset_header,
      set_busy: set_busy,
      set_empty: set_empty,
      set_error: set_error,
      update_reference: update_reference,
      get_state: function () {
        return state;
      },
      get_mode: function () {
        return mode;
      },
      get_surface: function () {
        return surface;
      },
      get_activation_method: function () {
        return activation_method;
      },
      get_reference_rect: function () {
        return get_reference_rect();
      },
      is_open: function () {
        return Boolean(tippy_instance.state.isVisible);
      },
      is_suspended: function () {
        return suspended;
      },
      get_suspension_reason: function () {
        return suspension_reason;
      },
      owns_node: function (candidate) {
        return is_composite_node(candidate);
      },
      can_handle_escape: function () {
        return Boolean(is_visible_controller(controller) && tippy_instance.state.isVisible && !has_open_child_layers());
      }
    };
    synchronize_pin_control();
    registered_controllers[component_id] = controller;
    return controller;
  }

  /**
   * Close the active shared Context Popover, if any.
   *
   * @param {boolean} restore_focus Whether an interactive surface restores focus.
   * @return {void}
   */
  function close_active(restore_focus) {
    if (active_controller) {
      active_controller.request_close('programmatic', Boolean(restore_focus));
    }
  }
  api.create = create;
  api.register = create;
  api.close_active = close_active;
  api.notify_layer_open = function (descriptor) {
    return dispatch_layer_event(layer_open_event, descriptor);
  };
  api.notify_layer_close = function (descriptor) {
    return dispatch_layer_event(layer_close_event, descriptor);
  };
  window.wpbc_shared_ui_context_popover = api;
})(window, document, window.wp);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvX3NoYXJlZF91aS9jb250ZXh0LXBvcG92ZXIvX291dC9jb250ZXh0LXBvcG92ZXIuanMiLCJuYW1lcyI6WyJ3aW5kb3ciLCJkb2N1bWVudCIsIndwIiwiYXBpIiwid3BiY19zaGFyZWRfdWlfY29udGV4dF9wb3BvdmVyIiwiYWN0aXZlX2NvbnRyb2xsZXIiLCJ2aXNpYmxlX2NvbnRyb2xsZXJzIiwicmVnaXN0ZXJlZF9jb250cm9sbGVycyIsImxheWVyX29wZW5fZXZlbnQiLCJsYXllcl9jbG9zZV9ldmVudCIsImxlZ2FjeV9wb3BvdmVyX3NlbGVjdG9yIiwidG9vbHRpcF9vd25lcl9zZWxlY3RvciIsImNsaXBwZWRfdGl0bGVfdG9vbHRpcF9zZWxlY3RvciIsInJlc2VydmVkX293bmVyX3NlbGVjdG9yIiwiYmxvY2tpbmdfbGF5ZXJfdHlwZXMiLCJzdXNwZW5kaW5nX2xheWVyX3R5cGVzIiwiYXV0b21hdGljX2Nsb3NlX3JlYXNvbnMiLCJleHBsaWNpdF9jbG9zZV9yZWFzb25zIiwic3VzcGVuc2lvbl9yZWFzb25zIiwiYWxsb3dlZF9wbGFjZW1lbnRzIiwibm9ybWFsaXplX2lkIiwiY2FuZGlkYXRlIiwiU3RyaW5nIiwicmVwbGFjZSIsInNsaWNlIiwibm9ybWFsaXplX2xheWVyX2Rlc2NyaXB0b3IiLCJkZXNjcmlwdG9yIiwibGF5ZXJfdHlwZSIsImluc3RhbmNlX2lkIiwib3duZXJfaWQiLCJpbnRlcmFjdGlvbl9ncm91cCIsImRpc3BhdGNoX2xheWVyX2V2ZW50IiwiZXZlbnRfbmFtZSIsImxheWVyX2V2ZW50IiwiaW5kZXhPZiIsIkN1c3RvbUV2ZW50IiwiYnViYmxlcyIsImRldGFpbCIsImNyZWF0ZUV2ZW50IiwiaW5pdEN1c3RvbUV2ZW50IiwiZGlzcGF0Y2hFdmVudCIsIm5vcm1hbGl6ZV9tb2RlIiwibm9ybWFsaXplX3Bpbl9wb2xpY3kiLCJub3JtYWxpemVfZXh0ZXJuYWxfc2Nyb2xsX3BvbGljeSIsIm5vcm1hbGl6ZV9kaXNtaXNzX3BvbGljeSIsIm5vcm1hbGl6ZV9wb3J0YWxfaG9zdCIsIm5vZGVUeXBlIiwiaXNDb25uZWN0ZWQiLCJib2R5Iiwibm9ybWFsaXplX3Bvc2l0aW9uaW5nX3N0cmF0ZWd5Iiwibm9ybWFsaXplX3JlZmVyZW5jZV9wb2xpY3kiLCJub3JtYWxpemVfY2xvc2VfcmVhc29uIiwiaXNfYXV0b21hdGljX2Nsb3NlX3JlYXNvbiIsInJlYXNvbiIsInJlZ2lzdGVyX3Zpc2libGVfY29udHJvbGxlciIsImNvbnRyb2xsZXIiLCJmaWx0ZXIiLCJwdXNoIiwidW5yZWdpc3Rlcl92aXNpYmxlX2NvbnRyb2xsZXIiLCJsZW5ndGgiLCJpc192aXNpYmxlX2NvbnRyb2xsZXIiLCJhcmJpdHJhdGVfdmlzaWJsZV9jb250cm9sbGVycyIsIm9wZW5pbmdfY29udHJvbGxlciIsImZvckVhY2giLCJ2aXNpYmxlX2NvbnRyb2xsZXIiLCJyZXF1ZXN0X2Nsb3NlIiwiZ2V0X2VzY2FwZV9jb250cm9sbGVyIiwiZXZlbnRfdGFyZ2V0IiwiZm9jdXNlZF9vd25lciIsImZvY3VzZWRfY2hpbGRfb3duc19lc2NhcGUiLCJmb2N1c2VkX3NoYXJlZF9sYXllciIsInRvcG1vc3Rfb3duZXIiLCJvcmRlcmVkX2NvbnRyb2xsZXJzIiwicmV2ZXJzZSIsImV2ZW50X2VsZW1lbnQiLCJnZXRfZWxlbWVudCIsInNvbWUiLCJvd25zX25vZGUiLCJjYW5faGFuZGxlX2VzY2FwZSIsImNsb3Nlc3QiLCJub3JtYWxpemVfcG9pbnRlcl9hbmNob3IiLCJub3JtYWxpemVfcGxhY2VtZW50Iiwibm9ybWFsaXplX3BsYWNlbWVudF9saXN0Iiwibm9ybWFsaXplZF9wbGFjZW1lbnRzIiwiQXJyYXkiLCJpc0FycmF5IiwicGxhY2VtZW50Iiwibm9ybWFsaXplX2RlbGF5IiwiZmFsbGJhY2siLCJkZWxheSIsIk51bWJlciIsImlzRmluaXRlIiwiTWF0aCIsIm1pbiIsIm1heCIsInJvdW5kIiwibm9ybWFsaXplX2xlbmd0aCIsIm1pbmltdW0iLCJtYXhpbXVtIiwibm9ybWFsaXplX3dpZHRoIiwibm9ybWFsaXplX3RleHQiLCJtYXhfbGVuZ3RoIiwiZ2V0X2xheWVyX3Rva2VuIiwidG9rZW5fbmFtZSIsImdldENvbXB1dGVkU3R5bGUiLCJkb2N1bWVudEVsZW1lbnQiLCJnZXRQcm9wZXJ0eVZhbHVlIiwibGF5ZXIiLCJ0cmltIiwibm9ybWFsaXplX2xheWVyX2luZGV4Iiwibm9ybWFsaXplX3Bvc2l0aW9uaW5nX2JvdW5kYXJ5Iiwibm9ybWFsaXplX3JlZmVyZW5jZV9yZWN0IiwibGVmdCIsInRvcCIsIndpZHRoIiwiaGVpZ2h0IiwieCIsInkiLCJyaWdodCIsImJvdHRvbSIsImNyZWF0ZV9wb2ludF9yZWZlcmVuY2VfcmVjdCIsImNsaWVudF94IiwiY2xpZW50X3kiLCJjcmVhdGVfdW5hdmFpbGFibGVfcmVmZXJlbmNlX3JlY3QiLCJjcmVhdGVfcG9pbnRlcl9yZWZlcmVuY2VfcmVjdCIsInRyaWdnZXIiLCJwb2ludGVyX2FuY2hvcl9tb2RlIiwicG9pbnRlcl9pbmxpbmVfb2Zmc2V0IiwidHJpZ2dlcl9yZWN0IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwiaXNfcmVmZXJlbmNlX3JlY3RfaW5fdmlld3BvcnQiLCJjdXJyZW50X3BvaW50ZXJfeCIsImN1cnJlbnRfdHJpZ2dlcl9yZWN0IiwicmVmZXJlbmNlX3JlY3QiLCJ2aWV3cG9ydF93aWR0aCIsImNsaWVudFdpZHRoIiwiaW5uZXJXaWR0aCIsInZpZXdwb3J0X2hlaWdodCIsImNsaWVudEhlaWdodCIsImlubmVySGVpZ2h0IiwiQm9vbGVhbiIsImNyZWF0ZV92aWV3cG9ydF9jZW50ZXJfcmVmZXJlbmNlX3JlY3QiLCJjcmVhdGUiLCJvcHRpb25zIiwic2V0dGluZ3MiLCJjb21wb25lbnRfaWQiLCJpZCIsIm1vZGUiLCJwb2ludGVyX2FuY2hvciIsInBpbl9wb2xpY3kiLCJleHRlcm5hbF9zY3JvbGxfcG9saWN5IiwiZGlzbWlzc19wb2xpY3kiLCJyZWZlcmVuY2VfcG9saWN5IiwicG9ydGFsX2hvc3QiLCJwaW5uZWRfcG9ydGFsX2hvc3QiLCJwb3NpdGlvbmluZ19zdHJhdGVneSIsImZpdF9vbl9maXJzdF9vcGVuIiwicGluX3RvX3ZpZXdwb3J0IiwiZHJhZ2dhYmxlX3doZW5fcGlubmVkIiwicmVzaXphYmxlX3doZW5fcGlubmVkIiwiY29udGV4dF9wb3BvdmVyX3ByaW9yaXR5IiwibGF5ZXJfZGVzY3JpcHRvciIsInJlZ2lzdGVyZWRfY2hpbGRfbGF5ZXJzIiwib3Blbl9jaGlsZF9sYXllcnMiLCJzdXNwZW5kaW5nX2xheWVycyIsImxheWVyX29wZW5fYW5ub3VuY2VkIiwic2hlbGxfdGVtcGxhdGUiLCJzaGVsbF93cmFwcGVyIiwic3VyZmFjZSIsInNlbnRpbmVsIiwidGlwcHlfaW5zdGFuY2UiLCJjdXJyZW50X3RyaWdnZXIiLCJkZXNjcmliZWRfdHJpZ2dlciIsInJlZmVyZW5jZV9yZWN0X3Byb3ZpZGVyIiwicmVmZXJlbmNlX3RyYWNrc190cmlnZ2VyIiwibGFzdF92YWxpZF9yZWZlcmVuY2VfcmVjdCIsImFjdGl2YXRpb25fbWV0aG9kIiwiZmFsbGJhY2tfcGxhY2VtZW50cyIsImFsbG93X2ZsaXAiLCJnZXRfaW5pdGlhbF9wbGFjZW1lbnRfYm91bmRzIiwicG9zaXRpb25pbmdfYm91bmRhcnkiLCJwcmV2ZW50X292ZXJmbG93IiwiaW5pdGlhbF9maXRfcGVuZGluZyIsImluaXRpYWxfZml0X2NhcHR1cmVkIiwiaW5pdGlhbF9maXRfYWRqdXN0bWVudCIsInBpbm5lZF92aWV3cG9ydF9wb3NpdGlvbiIsInBpbm5lZF92aWV3cG9ydF9zaXplIiwiYWN0aXZlX2RyYWciLCJhY3RpdmVfcmVzaXplIiwiZmxpcF9vcHRpb25zIiwiYm91bmRhcnkiLCJyb290Qm91bmRhcnkiLCJwYWRkaW5nIiwicG9wcGVyX21vZGlmaWVycyIsImVuYWJsZWQiLCJuYW1lIiwic2hvd19kZWxheV9tcyIsImhpZGVfZGVsYXlfbXMiLCJleHRlcm5hbF9zY3JvbGxfZ3JhY2VfbXMiLCJtYXhpbXVtX3dpZHRoIiwicHJlZmVycmVkX3dpZHRoIiwiZml4ZWRfdW5waW5uZWRfaGVpZ2h0IiwiYm91bmRhcnlfY3Jvc3NfYXhpcyIsInByZXZlbnRfb3ZlcmZsb3dfYWx0X2F4aXMiLCJtYXhpbXVtX3Jlc2l6ZWRfd2lkdGgiLCJtaW5pbXVtX3Jlc2l6ZWRfd2lkdGgiLCJtaW5pbXVtX3Jlc2l6ZWRfaGVpZ2h0IiwibGF5ZXJfel9pbmRleCIsImhpZGVfYXJyb3dfd2hlbl9waW5uZWQiLCJib3VuZGFyeV90ZXRoZXIiLCJwZW5kaW5nX3Nob3dfdGltZXIiLCJwZW5kaW5nX2Nsb3NlX3RpbWVyIiwicGVuZGluZ19mb2N1c19jaGVja190aW1lciIsInBlbmRpbmdfZm9jdXNfZW50cnlfdGltZXIiLCJzdXBwcmVzc2VkX2ZvY3VzX3RpbWVyIiwicGVuZGluZ19zdXJmYWNlX2NvbnN0cmFpbnRfZnJhbWUiLCJwZW5kaW5nX3BvaW50ZXJfdHJpZ2dlciIsInBlbmRpbmdfcG9pbnRlcl9pZCIsImxhdGVzdF9wb2ludGVyX2Nvb3JkaW5hdGVzIiwic3VwcHJlc3NlZF9mb2N1c190cmlnZ2VyIiwicG9pbnRlcl9pbnNpZGVfY29tcG9zaXRlIiwicmV0YWluZWRfc2Nyb2xsX3VudGlsIiwicGlubmVkIiwic3VzcGVuZGVkIiwic3VzcGVuc2lvbl9yZWFzb24iLCJleHRlcm5hbF9zdXNwZW5zaW9uX2hvbGQiLCJhcHByb3ZlZF90aXBweV9oaWRlX3JlYXNvbiIsIm93bnNfdHJpZ2dlcl9hcmlhIiwib3duZWRfdHJpZ2dlcl9hcmlhIiwic3RhdGUiLCJkZXN0cm95ZWQiLCJ2aWV3cG9ydF9wYWRkaW5nIiwiYXZhaWxhYmxlX2hlaWdodF9wcm9wZXJ0eSIsImF2YWlsYWJsZV9pbmxpbmVfc2l6ZV9wcm9wZXJ0eSIsImZpeGVkX3VucGlubmVkX2hlaWdodF9wcm9wZXJ0eSIsInJlc2l6ZWRfd2lkdGhfcHJvcGVydHkiLCJyZXNpemVkX2hlaWdodF9wcm9wZXJ0eSIsImxvYWRpbmciLCJsb2FkaW5nX2xhYmVsIiwiY29udGVudCIsImVtcHR5IiwiZXJyb3IiLCJlcnJvcl9tZXNzYWdlIiwicmV0cnlfYnV0dG9uIiwicGluX2J1dHRvbiIsInBpbl9idXR0b25fbGFiZWwiLCJkcmFnX2J1dHRvbiIsInJlc2l6ZV9idXR0b24iLCJzdGF0dXMiLCJoZWFkaW5nIiwiaGVhZGVyX2NvbnRlbnQiLCJkZWZhdWx0X2hlYWRpbmciLCJtYWluQXhpcyIsImFsdEF4aXMiLCJ0ZXRoZXIiLCJwaGFzZSIsInJlcXVpcmVzIiwicmVxdWlyZXNJZkV4aXN0cyIsImZuIiwiYXBwbHlfaW5pdGlhbF9maXRfbW9kaWZpZXIiLCJhcHBseV9waW5uZWRfdmlld3BvcnRfbW9kaWZpZXIiLCJ0ZW1wbGF0ZSIsIndwYmNfdGlwcHkiLCJnZXRFbGVtZW50QnlJZCIsImZhbGxiYWNrUGxhY2VtZW50cyIsImNyZWF0ZUVsZW1lbnQiLCJpbm5lckhUTUwiLCJwaW5fZW5hYmxlZCIsImRyYWdfZW5hYmxlZCIsImRyYWdfbGFiZWwiLCJyZXNpemVfZW5hYmxlZCIsInJlc2l6ZV9sYWJlbCIsInBpbl9sYWJlbCIsInBpbm5lZF9sYWJlbCIsInVucGluX2xhYmVsIiwidGl0bGUiLCJjbG9zZV9sYWJlbCIsImVtcHR5X2xhYmVsIiwiZXJyb3JfbGFiZWwiLCJyZXRyeV9sYWJlbCIsImZpcnN0RWxlbWVudENoaWxkIiwic3R5bGUiLCJzZXRQcm9wZXJ0eSIsInNldEF0dHJpYnV0ZSIsImNvbnN0cmFpbl9zdXJmYWNlX3RvX3Bvc2l0aW9uaW5nX2JvdW5kYXJ5IiwicXVlcnlTZWxlY3RvciIsInRleHRDb250ZW50IiwiY2xhc3NOYW1lIiwiYXBwZW5kQ2hpbGQiLCJnZXRfcmVmZXJlbmNlX3JlY3QiLCJjYW5kaWRhdGVfcmVjdCIsIm5vcm1hbGl6ZWRfcmVjdCIsIm1vZGlmaWVyX2FyZ3VtZW50cyIsIm1vZGlmaWVyX2RhdGEiLCJjdXJyZW50X3giLCJjdXJyZW50X3kiLCJtb2RpZmllcnNEYXRhIiwicG9wcGVyT2Zmc2V0cyIsInByZXZlbnRPdmVyZmxvdyIsImdldF92aXN1YWxfdmlld3BvcnRfYm91bmRzIiwidmlzdWFsX3ZpZXdwb3J0IiwidmlzdWFsVmlld3BvcnQiLCJvZmZzZXRMZWZ0Iiwib2Zmc2V0VG9wIiwiY2xhbXBfcGlubmVkX3ZpZXdwb3J0X3Bvc2l0aW9uIiwidmlld3BvcnRfYm91bmRzIiwic3VyZmFjZV9yZWN0Iiwic3VyZmFjZV93aWR0aCIsInN1cmZhY2VfaGVpZ2h0IiwibWluaW11bV9sZWZ0IiwibWluaW11bV90b3AiLCJtYXhpbXVtX2xlZnQiLCJtYXhpbXVtX3RvcCIsInBvcHBlcl9zdHlsZXMiLCJzdHlsZXMiLCJwb3BwZXIiLCJwb3NpdGlvbiIsInRyYW5zZm9ybSIsImFwcGx5X3Bvc2l0aW9uaW5nX21vZGUiLCJhY3RpdmVfcG9ydGFsX2hvc3QiLCJhY3RpdmVfcG9zaXRpb25pbmdfc3RyYXRlZ3kiLCJzZXRQcm9wcyIsImFwcGVuZFRvIiwibWF4V2lkdGgiLCJwb3BwZXJPcHRpb25zIiwic3RyYXRlZ3kiLCJtb2RpZmllcnMiLCJwYXJlbnROb2RlIiwicG9wcGVySW5zdGFuY2UiLCJmb3JjZVVwZGF0ZSIsImNyZWF0ZV90cmlnZ2VyX3JlZmVyZW5jZV9wcm92aWRlciIsInJlc29sdmVfb3Blbl9yZWZlcmVuY2VfcmVjdCIsImFsbG93X291dHNpZGVfdmlld3BvcnQiLCJjYW5jZWxfcGVuZGluZ19vcGVuIiwiY2xlYXJUaW1lb3V0IiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImNhcHR1cmVfcGVuZGluZ19wb2ludGVyIiwiZXZlbnQiLCJwb2ludGVySWQiLCJjbGllbnRYIiwiY2xpZW50WSIsInBhcmVudEVsZW1lbnQiLCJpc19kaXJlY3RfcG9wb3Zlcl9vd25lZF9ub2RlIiwiY2FuZGlkYXRlX2VsZW1lbnQiLCJvd25lcl9zZWxlY3RvciIsImNvbnRhaW5zIiwiaXNfb3duZWRfY2hpbGRfdGlwcHlfbm9kZSIsInRpcHB5X3Jvb3QiLCJjaGlsZF90aXBweSIsIl90aXBweSIsInJlZmVyZW5jZSIsImlzX3BvcG92ZXJfb3duZWRfbm9kZSIsImlzX2NsaXBwZWRfdGl0bGVfdG9vbHRpcF90YXJnZXQiLCJjYW5fdXNlX3RyaWdnZXIiLCJyZWdpc3Rlcl9jaGlsZF9sYXllciIsInVucmVnaXN0ZXJfY2hpbGRfbGF5ZXIiLCJjaGlsZF9pbnN0YW5jZV9pZCIsImlzX3JlbGF0ZWRfbGF5ZXIiLCJyZWdpc3RlcmVkX2NoaWxkIiwiaGFzX29wZW5fY2hpbGRfbGF5ZXJzIiwiT2JqZWN0Iiwia2V5cyIsImhhbmRsZV9sYXllcl9vcGVuIiwic3VzcGVuZCIsImhhbmRsZV9sYXllcl9jbG9zZSIsIm9wZW5fY2hpbGQiLCJzdXNwZW5kaW5nX2xheWVyIiwicmVzdW1lIiwiaXNfY29tcG9zaXRlX25vZGUiLCJhY3RpdmVFbGVtZW50Iiwic2NoZWR1bGVfY2xvc2UiLCJhbm5vdW5jZV9sYXllcl9vcGVuIiwiYW5ub3VuY2VfbGF5ZXJfY2xvc2UiLCJjYW5jZWxfcGVuZGluZ19jbG9zZSIsImNhbmNlbF9wZW5kaW5nX2ZvY3VzIiwiY2FuY2VsX2ludGVyYWN0aW9uX3RpbWVycyIsImZpbmlzaF9waW5uZWRfZHJhZyIsInBvaW50ZXJfaWQiLCJoYW5kbGVfcGlubmVkX2RyYWdfcG9pbnRlcl9tb3ZlIiwicmVtb3ZlQXR0cmlidXRlIiwiaGFzUG9pbnRlckNhcHR1cmUiLCJyZWxlYXNlUG9pbnRlckNhcHR1cmUiLCJtb3ZlX3Bpbm5lZF9zdXJmYWNlIiwiaGFuZGxlX3Bpbm5lZF9kcmFnX3BvaW50ZXJfZG93biIsImJ1dHRvbiIsInByZXZlbnREZWZhdWx0Iiwic3RvcFByb3BhZ2F0aW9uIiwic3RhcnRfeCIsInN0YXJ0X3kiLCJvcmlnaW5fbGVmdCIsIm9yaWdpbl90b3AiLCJzZXRQb2ludGVyQ2FwdHVyZSIsImFkZEV2ZW50TGlzdGVuZXIiLCJoYW5kbGVfcGlubmVkX2RyYWdfa2V5ZG93biIsIm9mZnNldF94Iiwib2Zmc2V0X3kiLCJkaXN0YW5jZSIsInNoaWZ0S2V5Iiwia2V5IiwiaXNfc3VyZmFjZV9yaWdodF90b19sZWZ0IiwiZGlyZWN0aW9uIiwiZmluaXNoX3Bpbm5lZF9yZXNpemUiLCJoYW5kbGVfcGlubmVkX3Jlc2l6ZV9wb2ludGVyX21vdmUiLCJjbGVhcl9waW5uZWRfc3VyZmFjZV9zaXplIiwicmVtb3ZlUHJvcGVydHkiLCJyZXNpemVfcGlubmVkX3N1cmZhY2UiLCJyZXF1ZXN0ZWRfd2lkdGgiLCJyZXF1ZXN0ZWRfaGVpZ2h0IiwiYW5jaG9yX3JpZ2h0IiwiY3VycmVudF9wb3NpdGlvbiIsIm1heGltdW1fYXZhaWxhYmxlX3dpZHRoIiwibWF4aW11bV9hdmFpbGFibGVfaGVpZ2h0IiwiYm91bmRlZF9taW5pbXVtX3dpZHRoIiwiYm91bmRlZF9taW5pbXVtX2hlaWdodCIsInJlc2l6ZWRfd2lkdGgiLCJyZXNpemVkX2hlaWdodCIsImZpeGVkX3JpZ2h0IiwicmVzaXplZF9sZWZ0IiwiaGFuZGxlX3Bpbm5lZF9yZXNpemVfcG9pbnRlcl9kb3duIiwib3JpZ2luX3dpZHRoIiwib3JpZ2luX2hlaWdodCIsImlubGluZV9kZWx0YSIsImhhbmRsZV9waW5uZWRfcmVzaXplX2tleWRvd24iLCJ3aWR0aF9kZWx0YSIsImhlaWdodF9kZWx0YSIsInN5bmNocm9uaXplX3Bpbl9jb250cm9sIiwiaGlkZGVuIiwiZGlzYWJsZWQiLCJnZXRBdHRyaWJ1dGUiLCJzZXRfcGlubmVkIiwic2hvdWxkX3BpbiIsInBvcHBlcl9yZWN0IiwidXBkYXRlX3JlZmVyZW5jZSIsInNjaGVkdWxlX3N1cmZhY2VfY29uc3RyYWludF91cGRhdGUiLCJvbl9waW5fY2hhbmdlIiwiY2xvc2VfYXBwcm92ZWQiLCJpc19waW5uZWQiLCJpc1Zpc2libGUiLCJzZXRUaW1lb3V0IiwiY2xhaW1fdHJpZ2dlcl9hcmlhIiwicmVxdWVzdGVkX3BvcHVwIiwiaGFkX2V4cGFuZGVkIiwiaGFzQXR0cmlidXRlIiwiZXhwYW5kZWQiLCJoYWRfaGFzcG9wdXAiLCJoYXNwb3B1cCIsImFyaWFfaGFzcG9wdXAiLCJyZWxlYXNlX3RyaWdnZXJfYXJpYSIsImZvY3VzX2ZpcnN0X2NvbnRyb2wiLCJmb2N1c2FibGVfc2VsZWN0b3IiLCJvd25lZF9zdXJmYWNlcyIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJmb2N1c2VkIiwicHJvdG90eXBlIiwiY2FsbCIsIm93bmVkX3N1cmZhY2UiLCJjb250cm9sIiwiZm9jdXMiLCJpc19mb2N1c19lbnRyeV9jb21tYW5kIiwiYWx0S2V5IiwiY3RybEtleSIsIm1ldGFLZXkiLCJpc19mb2N1c19lbnRyeV9rZXkiLCJyZW1vdmVfZGVzY3JpcHRpb24iLCJkZXNjcmlwdGlvbl9pZHMiLCJzcGxpdCIsImRlc2NyaXB0aW9uX2lkIiwiam9pbiIsImFkZF9kZXNjcmlwdGlvbiIsImhpZGVfc3RhdGVfaG9zdHMiLCJnZXRfdmVydGljYWxfdmlld3BvcnRfYm91bmRzIiwidmlld3BvcnRfdG9wIiwiZ2V0X2luaXRpYWxfdmVydGljYWxfcGxhY2VtZW50X2JvdW5kcyIsImNhbmRpZGF0ZV9ib3VuZHMiLCJjYW5kaWRhdGVfcmVjdGFuZ2xlIiwiZ2V0X3ZlcnRpY2FsX3BsYWNlbWVudF9zcGFjZSIsInBsYWNlbWVudF9zaWRlIiwidmlzaWJsZV9ib3VuZHMiLCJyZWZlcmVuY2VfZ2FwIiwiTkVHQVRJVkVfSU5GSU5JVFkiLCJyZXNvbHZlX2luaXRpYWxfcGxhY2VtZW50IiwicmVxdWVzdGVkX3BsYWNlbWVudCIsInJlcXVlc3RlZF9zaWRlIiwicmVxdWlyZWRfaGVpZ2h0IiwicmVxdWVzdGVkX3NwYWNlIiwiYmVzdF9wbGFjZW1lbnQiLCJiZXN0X3NwYWNlIiwiZmFsbGJhY2tfcGxhY2VtZW50IiwiZmFsbGJhY2tfc2lkZSIsImZhbGxiYWNrX3NwYWNlIiwiYm91bmRhcnlfcmVjdCIsInZpZXdwb3J0X2xlZnQiLCJ2aXNpYmxlX2xlZnQiLCJ2aXNpYmxlX3JpZ2h0IiwiZmxvb3IiLCJjbGVhcl9zdXJmYWNlX2hlaWdodF9jb25zdHJhaW50Iiwic2V0X3BvcHBlcl9sYXlvdXRfcGFydGljaXBhdGlvbiIsInNob3VsZF9wYXJ0aWNpcGF0ZSIsImdldF9jdXJyZW50X3BsYWNlbWVudCIsInRpcHB5X2JveCIsImNvbnN0cmFpbl9zdXJmYWNlX3RvX2N1cnJlbnRfcGxhY2VtZW50IiwiYXZhaWxhYmxlX2hlaWdodCIsImdldENsaWVudFJlY3RzIiwiY2FuY2VsX3N1cmZhY2VfY29uc3RyYWludF91cGRhdGUiLCJjYW5jZWxBbmltYXRpb25GcmFtZSIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsImNvbW1pdF9zdGF0ZSIsIm5leHRfc3RhdGUiLCJhbm5vdW5jZW1lbnQiLCJpc19idXN5Iiwic2V0X2lkbGUiLCJzZXRfbG9hZGluZyIsIm1lc3NhZ2UiLCJzZXRfY29udGVudCIsInJlbmRlcmVkX2NvbnRlbnQiLCJzZXRfdGl0bGUiLCJzZXRfaGVhZGVyIiwicmVuZGVyZWRfaGVhZGVyIiwiYWNjZXNzaWJsZV90aXRsZSIsImNsYXNzTGlzdCIsImFkZCIsInJlc2V0X2hlYWRlciIsInJlbW92ZSIsInNldF9idXN5Iiwic2V0X2VtcHR5IiwicGFyYWdyYXBoIiwic2V0X2Vycm9yIiwib25fcmV0cnkiLCJvcGVuX3dpdGhfcmVmZXJlbmNlIiwicmVxdWVzdGVkX2FjdGl2YXRpb25fbWV0aG9kIiwiaW5pdGlhbF9wbGFjZW1lbnQiLCJyZXNvbHZlZF9yZWZlcmVuY2VfcmVjdCIsImdldFJlZmVyZW5jZUNsaWVudFJlY3QiLCJpbnRlcmFjdGl2ZSIsInNob3ciLCJvbl9vcGVuIiwib3BlbiIsIm9wZW5fa2V5Ym9hcmQiLCJoYW5kbGVfdHJpZ2dlcl9rZXlkb3duIiwic2NoZWR1bGVfcG9pbnRlcl9vcGVuIiwiZGVsYXllZF90cmlnZ2VyIiwiZnJvemVuX3BvaW50ZXIiLCJmaW5hbGl6ZV9jbG9zZSIsInJlc3RvcmVfZm9jdXMiLCJmb2N1c190YXJnZXQiLCJoYWRfb3duZWRfc3RhdGUiLCJzaG91bGRfcmVzdG9yZSIsIm9uX2Nsb3NlIiwiaGlkZSIsIkRhdGUiLCJub3ciLCJjbG9zZSIsImxheWVyX293bmVkIiwib25fc3VzcGVuZCIsInJlbGVhc2VfZXh0ZXJuYWxfaG9sZCIsIm9uX3Jlc3VtZSIsInJlYmluZF90cmlnZ2VyIiwicmVxdWVzdGVkX3JlZmVyZW5jZSIsIm9uX3JlYmluZCIsImhhbmRsZV92aWV3cG9ydF9nZW9tZXRyeV9jaGFuZ2UiLCJoYW5kbGVfZG9jdW1lbnRfcG9pbnRlcl9vdmVyIiwidGFyZ2V0IiwiaGFuZGxlX2RvY3VtZW50X3BvaW50ZXJfb3V0IiwicmVsYXRlZFRhcmdldCIsImhhbmRsZV9kb2N1bWVudF9wb2ludGVyX2Rvd24iLCJoYW5kbGVfZG9jdW1lbnRfZm9jdXNfaW4iLCJoYW5kbGVfZG9jdW1lbnRfZm9jdXNfb3V0IiwicmV0YWluX2R1cmluZ19leHRlcm5hbF9zY3JvbGwiLCJoYW5kbGVfZG9jdW1lbnRfc2Nyb2xsIiwiaGFuZGxlX3dpbmRvd19zY3JvbGwiLCJoYW5kbGVfb3duZWRfYWN0aXZhdGlvbiIsImRlc3Ryb3kiLCJoYW5kbGVfc3VyZmFjZV9jbGljayIsImhhbmRsZV9kb2N1bWVudF9rZXlkb3duIiwicmVtb3ZlQ2hpbGQiLCJzdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24iLCJhbGxvd0hUTUwiLCJhcnJvdyIsImFyaWEiLCJkdXJhdGlvbiIsImhpZGVPbkNsaWNrIiwiaW50ZXJhY3RpdmVCb3JkZXIiLCJpbnRlcmFjdGl2ZURlYm91bmNlIiwib2Zmc2V0Iiwicm9sZSIsInNob3dPbkNyZWF0ZSIsInRoZW1lIiwidG91Y2giLCJ6SW5kZXgiLCJvbkhpZGUiLCJhcHByb3ZlZF9yZWFzb24iLCJvbk1vdW50Iiwib25TaG93biIsIm9uSGlkZGVuIiwicGFzc2l2ZSIsImdldF9zdGF0ZSIsImdldF9tb2RlIiwiZ2V0X3N1cmZhY2UiLCJnZXRfYWN0aXZhdGlvbl9tZXRob2QiLCJpc19vcGVuIiwiaXNfc3VzcGVuZGVkIiwiZ2V0X3N1c3BlbnNpb25fcmVhc29uIiwiY2xvc2VfYWN0aXZlIiwicmVnaXN0ZXIiLCJub3RpZnlfbGF5ZXJfb3BlbiIsIm5vdGlmeV9sYXllcl9jbG9zZSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL19zaGFyZWRfdWkvY29udGV4dC1wb3BvdmVyL19zcmMvY29udGV4dC1wb3BvdmVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogRG9tYWluLW5ldXRyYWwgQ29udGV4dCBQb3BvdmVyIHNoZWxsIGFuZCBzdGF0ZSBjb250cm9sbGVyLlxuICpcbiAqIFRoZSBzaGFyZWQgY29udHJvbGxlciBvd25zIG9ubHkgc2hlbGwgcmVuZGVyaW5nLCBUaXBweSBwb3NpdGlvbmluZywgc3RhdGVcbiAqIHByZXNlbnRhdGlvbiwgYW5kIGNvbXBvbmVudC1sb2NhbCBsaWZlY3ljbGUuIERvbWFpbnMgb3duIGF1dGhvcml6YXRpb24sXG4gKiBkYXRhLCB0ZW1wbGF0ZXMsIHJlcXVlc3RzLCBhY3Rpb25zLCBhbmQgc3VwcHJlc3Npb24gcG9saWN5LlxuICpcbiAqIEBwYWNrYWdlIEJvb2tpbmcgQ2FsZW5kYXJcbiAqIEBzaW5jZSAgIDEyLjAuMFxuICovXG4oIGZ1bmN0aW9uICggd2luZG93LCBkb2N1bWVudCwgd3AgKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHR2YXIgYXBpID0gd2luZG93LndwYmNfc2hhcmVkX3VpX2NvbnRleHRfcG9wb3ZlciB8fCB7fTtcblx0dmFyIGFjdGl2ZV9jb250cm9sbGVyID0gbnVsbDtcblx0dmFyIHZpc2libGVfY29udHJvbGxlcnMgPSBbXTtcblx0dmFyIHJlZ2lzdGVyZWRfY29udHJvbGxlcnMgPSB7fTtcblx0dmFyIGxheWVyX29wZW5fZXZlbnQgPSAnd3BiYzpzaGFyZWQtdWktbGF5ZXItb3Blbic7XG5cdHZhciBsYXllcl9jbG9zZV9ldmVudCA9ICd3cGJjOnNoYXJlZC11aS1sYXllci1jbG9zZSc7XG5cdHZhciBsZWdhY3lfcG9wb3Zlcl9zZWxlY3RvciA9ICcucG9wb3Zlcl9ib3R0b20ucG9wb3Zlcl9jbGljayc7XG5cdHZhciB0b29sdGlwX293bmVyX3NlbGVjdG9yID0gJy50b29sdGlwX3RvcCwgLnRvb2x0aXBfYm90dG9tLCAudG9vbHRpcF9sZWZ0LCAudG9vbHRpcF9yaWdodCwgLnRvb2x0aXBfcmlnaHRfb2Zmc2V0LCBbZGF0YS13cGJjLXVpLWNhdGFsb2ctb3ZlcmZsb3ctdG9vbHRpcF0nO1xuXHR2YXIgY2xpcHBlZF90aXRsZV90b29sdGlwX3NlbGVjdG9yID0gJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1vdmVyZmxvdy10b29sdGlwXSwgLndwYmNfdWlfbGlzdGluZ19fb3ZlcmZsb3dfdG9vbHRpcCc7XG5cdHZhciByZXNlcnZlZF9vd25lcl9zZWxlY3RvciA9ICdbZGF0YS13cGJjLXNoYXJlZC11aS1wb3BvdmVyXSc7XG5cdHZhciBibG9ja2luZ19sYXllcl90eXBlcyA9IFsgJ2NvbnRleHRfcG9wb3ZlcicsICdtb2RhbCcsICdpbnNwZWN0b3InLCAnZGlzY2xvc3VyZScsICdyZXZpZXcnLCAnYXBwbHknIF07XG5cdHZhciBzdXNwZW5kaW5nX2xheWVyX3R5cGVzID0gWyAnbW9kYWwnLCAnaW5zcGVjdG9yJywgJ3JldmlldycsICdhcHBseScgXTtcblx0dmFyIGF1dG9tYXRpY19jbG9zZV9yZWFzb25zID0gW1xuXHRcdCdwb2ludGVyX2V4aXQnLFxuXHRcdCdvdXRzaWRlX3BvaW50ZXInLFxuXHRcdCdvdXRzaWRlX2ZvY3VzJyxcblx0XHQnZXh0ZXJuYWxfc2Nyb2xsJyxcblx0XHQncmVwbGFjZW1lbnQnXG5cdF07XG5cdHZhciBleHBsaWNpdF9jbG9zZV9yZWFzb25zID0gW1xuXHRcdCdleHBsaWNpdF9jbG9zZScsXG5cdFx0J2VzY2FwZScsXG5cdFx0J2luc3BlY3Rvcl9oYW5kb2ZmJyxcblx0XHQnZGVzdHJveScsXG5cdFx0J2F1dGhvcml6YXRpb25faW52YWxpZGF0aW9uJyxcblx0XHQncHJvZ3JhbW1hdGljJyxcblx0XHQndW5jb250cm9sbGVkX2xpYnJhcnlfaGlkZSdcblx0XTtcblx0dmFyIHN1c3BlbnNpb25fcmVhc29ucyA9IFsgJ2Jsb2NraW5nX2xheWVyJywgJ3JlZmVyZW5jZV9yZWZyZXNoJywgJ3JlZmVyZW5jZV91bmF2YWlsYWJsZScgXTtcblx0dmFyIGFsbG93ZWRfcGxhY2VtZW50cyA9IFtcblx0XHQnYXV0bycsXG5cdFx0J2F1dG8tc3RhcnQnLFxuXHRcdCdhdXRvLWVuZCcsXG5cdFx0J3RvcCcsXG5cdFx0J3RvcC1zdGFydCcsXG5cdFx0J3RvcC1lbmQnLFxuXHRcdCdib3R0b20nLFxuXHRcdCdib3R0b20tc3RhcnQnLFxuXHRcdCdib3R0b20tZW5kJyxcblx0XHQnbGVmdCcsXG5cdFx0J2xlZnQtc3RhcnQnLFxuXHRcdCdsZWZ0LWVuZCcsXG5cdFx0J3JpZ2h0Jyxcblx0XHQncmlnaHQtc3RhcnQnLFxuXHRcdCdyaWdodC1lbmQnXG5cdF07XG5cblx0LyoqXG5cdCAqIE5vcm1hbGl6ZSBhIGNvbXBvbmVudCBpZGVudGlmaWVyIGZvciBET00gYW5kIG93bmVyc2hpcCBhdHRyaWJ1dGVzLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IGNhbmRpZGF0ZSBDYW5kaWRhdGUgY29tcG9uZW50IGlkZW50aWZpZXIuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gU2FmZSBpZGVudGlmaWVyLCBvciBhbiBlbXB0eSBzdHJpbmcgd2hlbiBpbnZhbGlkLlxuXHQgKi9cblx0ZnVuY3Rpb24gbm9ybWFsaXplX2lkKCBjYW5kaWRhdGUgKSB7XG5cdFx0cmV0dXJuIFN0cmluZyggY2FuZGlkYXRlIHx8ICcnICkucmVwbGFjZSggL1teQS1aYS16MC05Xy1dL2csICcnICkuc2xpY2UoIDAsIDEyMCApO1xuXHR9XG5cblx0LyoqXG5cdCAqIE5vcm1hbGl6ZSBhIGZsb2F0aW5nLWxheWVyIGRlc2NyaXB0b3IgdG8gdGhlIHB1YmxpYyBtZXRhZGF0YSBib3VuZGFyeS5cblx0ICpcblx0ICogVGhlIHJldHVybmVkIG9iamVjdCBkZWxpYmVyYXRlbHkgY29udGFpbnMgb25seSBpbnRlcmFjdGlvbiBpZGVudGlmaWVycy5cblx0ICogRG9tYWluIHJlY29yZHMsIG5vbmNlcywgZm9ybSB2YWx1ZXMsIGFuZCBhdXRob3JpemF0aW9uIHN0YXRlIGFyZSBuZXZlclxuXHQgKiBhY2NlcHRlZCBvciBmb3J3YXJkZWQgYnkgdGhlIHNoYXJlZCBwcm90b2NvbC5cblx0ICpcblx0ICogQHBhcmFtIHsqfSBjYW5kaWRhdGUgQ2FuZGlkYXRlIGRlc2NyaXB0b3IuXG5cdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBGb3VyLWtleSBsYXllciBkZXNjcmlwdG9yIG9yIG51bGwgd2hlbiBpbnZhbGlkLlxuXHQgKi9cblx0ZnVuY3Rpb24gbm9ybWFsaXplX2xheWVyX2Rlc2NyaXB0b3IoIGNhbmRpZGF0ZSApIHtcblx0XHR2YXIgZGVzY3JpcHRvcjtcblxuXHRcdGlmICggISBjYW5kaWRhdGUgfHwgJ29iamVjdCcgIT09IHR5cGVvZiBjYW5kaWRhdGUgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0ZGVzY3JpcHRvciA9IHtcblx0XHRcdGxheWVyX3R5cGU6IG5vcm1hbGl6ZV9pZCggY2FuZGlkYXRlLmxheWVyX3R5cGUgKSxcblx0XHRcdGluc3RhbmNlX2lkOiBub3JtYWxpemVfaWQoIGNhbmRpZGF0ZS5pbnN0YW5jZV9pZCApLFxuXHRcdFx0b3duZXJfaWQ6IG5vcm1hbGl6ZV9pZCggY2FuZGlkYXRlLm93bmVyX2lkICksXG5cdFx0XHRpbnRlcmFjdGlvbl9ncm91cDogbm9ybWFsaXplX2lkKCBjYW5kaWRhdGUuaW50ZXJhY3Rpb25fZ3JvdXAgKVxuXHRcdH07XG5cdFx0aWYgKCAhIGRlc2NyaXB0b3IubGF5ZXJfdHlwZSB8fCAhIGRlc2NyaXB0b3IuaW5zdGFuY2VfaWQgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRyZXR1cm4gZGVzY3JpcHRvcjtcblx0fVxuXG5cdC8qKlxuXHQgKiBEaXNwYXRjaCBvbmUgZG9tYWluLW5ldXRyYWwgc2hhcmVkIGZsb2F0aW5nLWxheWVyIGxpZmVjeWNsZSBldmVudC5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50X25hbWUgT3BlbiBvciBjbG9zZSBwcm90b2NvbCBldmVudCBuYW1lLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY2FuZGlkYXRlICBDYW5kaWRhdGUgbGF5ZXIgZGVzY3JpcHRvci5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGEgbm9ybWFsaXplZCBldmVudCB3YXMgZGlzcGF0Y2hlZC5cblx0ICovXG5cdGZ1bmN0aW9uIGRpc3BhdGNoX2xheWVyX2V2ZW50KCBldmVudF9uYW1lLCBjYW5kaWRhdGUgKSB7XG5cdFx0dmFyIGRlc2NyaXB0b3IgPSBub3JtYWxpemVfbGF5ZXJfZGVzY3JpcHRvciggY2FuZGlkYXRlICk7XG5cdFx0dmFyIGxheWVyX2V2ZW50O1xuXG5cdFx0aWYgKCAhIGRlc2NyaXB0b3IgfHwgLTEgPT09IFsgbGF5ZXJfb3Blbl9ldmVudCwgbGF5ZXJfY2xvc2VfZXZlbnQgXS5pbmRleE9mKCBldmVudF9uYW1lICkgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5DdXN0b21FdmVudCApIHtcblx0XHRcdGxheWVyX2V2ZW50ID0gbmV3IHdpbmRvdy5DdXN0b21FdmVudCggZXZlbnRfbmFtZSwge1xuXHRcdFx0XHRidWJibGVzOiBmYWxzZSxcblx0XHRcdFx0ZGV0YWlsOiBkZXNjcmlwdG9yXG5cdFx0XHR9ICk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGxheWVyX2V2ZW50ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoICdDdXN0b21FdmVudCcgKTtcblx0XHRcdGxheWVyX2V2ZW50LmluaXRDdXN0b21FdmVudCggZXZlbnRfbmFtZSwgZmFsc2UsIGZhbHNlLCBkZXNjcmlwdG9yICk7XG5cdFx0fVxuXHRcdGRvY3VtZW50LmRpc3BhdGNoRXZlbnQoIGxheWVyX2V2ZW50ICk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBOb3JtYWxpemUgYSBzdXBwb3J0ZWQgQ29udGV4dCBQb3BvdmVyIG1vZGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gY2FuZGlkYXRlIENhbmRpZGF0ZSBtb2RlLlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IGBpbnRlcmFjdGl2ZWAgb3IgYHByZXZpZXdgLlxuXHQgKi9cblx0ZnVuY3Rpb24gbm9ybWFsaXplX21vZGUoIGNhbmRpZGF0ZSApIHtcblx0XHRyZXR1cm4gJ2ludGVyYWN0aXZlJyA9PT0gU3RyaW5nKCBjYW5kaWRhdGUgfHwgJycgKSA/ICdpbnRlcmFjdGl2ZScgOiAncHJldmlldyc7XG5cdH1cblxuXHQvKipcblx0ICogTm9ybWFsaXplIHRoZSBvcHRpb25hbCBwaW4gcG9saWN5LlxuXHQgKlxuXHQgKiBQaW5uaW5nIGlzIGRlbGliZXJhdGVseSBkaXNhYmxlZCB1bmxlc3MgYSBkb21haW4gb3B0cyBpbnRvIHRoZSBuZXV0cmFsXG5cdCAqIG1hbnVhbCBwb2xpY3kuIFRoZSBzaGFyZWQgY29udHJvbGxlciBuZXZlciBpbmZlcnMgd2hldGhlciBkb21haW4gY29udGVudFxuXHQgKiBpcyBzYWZlIHRvIHJldGFpbi5cblx0ICpcblx0ICogQHBhcmFtIHsqfSBjYW5kaWRhdGUgQ2FuZGlkYXRlIHBpbiBwb2xpY3kuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gYG1hbnVhbGAgb3IgYG5vbmVgLlxuXHQgKi9cblx0ZnVuY3Rpb24gbm9ybWFsaXplX3Bpbl9wb2xpY3koIGNhbmRpZGF0ZSApIHtcblx0XHRyZXR1cm4gJ21hbnVhbCcgPT09IFN0cmluZyggY2FuZGlkYXRlIHx8ICcnICkgPyAnbWFudWFsJyA6ICdub25lJztcblx0fVxuXG5cdC8qKlxuXHQgKiBOb3JtYWxpemUgZXh0ZXJuYWwtc2Nyb2xsIGJlaGF2aW9yIGZvciBvbmUgcG9wb3ZlciBpbnN0YW5jZS5cblx0ICpcblx0ICogRXhpc3RpbmcgY29uc3VtZXJzIGRpc21pc3MgYnkgZGVmYXVsdC4gVGhlIHJldGFpbiBwb2xpY3kgaXMgYW4gZXhwbGljaXQsXG5cdCAqIGRvbWFpbi1uZXV0cmFsIG9wdC1pbiBmb3Igc3VyZmFjZXMgd2hvc2UgY29udHJvbHMgbXVzdCByZW1haW4gcmVhY2hhYmxlXG5cdCAqIHdoaWxlIHRoZWlyIHBhZ2Ugc2Nyb2xsczsgUG9wcGVyIGNvbnRpbnVlcyB0byBvd24gcG9zaXRpb25pbmcuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gY2FuZGlkYXRlIENhbmRpZGF0ZSBleHRlcm5hbC1zY3JvbGwgcG9saWN5LlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IGByZXRhaW5gIG9yIGBkaXNtaXNzYC5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9leHRlcm5hbF9zY3JvbGxfcG9saWN5KCBjYW5kaWRhdGUgKSB7XG5cdFx0cmV0dXJuICdyZXRhaW4nID09PSBTdHJpbmcoIGNhbmRpZGF0ZSB8fCAnJyApID8gJ3JldGFpbicgOiAnZGlzbWlzcyc7XG5cdH1cblxuXHQvKipcblx0ICogTm9ybWFsaXplIHRoZSBvcHRpb25hbCBhdXRvbWF0aWMtZGlzbWlzcyBwb2xpY3kuXG5cdCAqXG5cdCAqIEV4cGxpY2l0IHN1cmZhY2VzIHJlamVjdCBwb2ludGVyLWV4aXQsIG91dHNpZGUtcG9pbnRlciwgb3V0c2lkZS1mb2N1cyxcblx0ICogZXh0ZXJuYWwtc2Nyb2xsLCBhbmQgcmVwbGFjZW1lbnQgZGlzbWlzc2FsLiBDbG9zZSwgRXNjYXBlLCBhdXRob3JpemF0aW9uXG5cdCAqIGludmFsaWRhdGlvbiwgYW5kIGNhbGxlciBwcm9ncmFtbWF0aWMgY2xvc3VyZSByZW1haW4gYXZhaWxhYmxlLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IGNhbmRpZGF0ZSBDYW5kaWRhdGUgZGlzbWlzc2FsIHBvbGljeS5cblx0ICogQHJldHVybiB7c3RyaW5nfSBgZXhwbGljaXRgIG9yIGBhdXRvbWF0aWNgLlxuXHQgKi9cblx0ZnVuY3Rpb24gbm9ybWFsaXplX2Rpc21pc3NfcG9saWN5KCBjYW5kaWRhdGUgKSB7XG5cdFx0cmV0dXJuICdleHBsaWNpdCcgPT09IFN0cmluZyggY2FuZGlkYXRlIHx8ICcnICkgPyAnZXhwbGljaXQnIDogJ2F1dG9tYXRpYyc7XG5cdH1cblxuXHQvKipcblx0ICogTm9ybWFsaXplIHRoZSBvcHRpb25hbCBUaXBweSBwb3J0YWwgaG9zdC5cblx0ICpcblx0ICogQHBhcmFtIHsqfSBjYW5kaWRhdGUgQ2FuZGlkYXRlIHBvcnRhbCBob3N0LlxuXHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudH0gQ29ubmVjdGVkIGVsZW1lbnQgaG9zdCwgb3IgdGhlIGRvY3VtZW50IGJvZHkuXG5cdCAqL1xuXHRmdW5jdGlvbiBub3JtYWxpemVfcG9ydGFsX2hvc3QoIGNhbmRpZGF0ZSApIHtcblx0XHRyZXR1cm4gY2FuZGlkYXRlXG5cdFx0XHQmJiAxID09PSBjYW5kaWRhdGUubm9kZVR5cGVcblx0XHRcdCYmIGNhbmRpZGF0ZS5pc0Nvbm5lY3RlZFxuXHRcdFx0PyBjYW5kaWRhdGVcblx0XHRcdDogZG9jdW1lbnQuYm9keTtcblx0fVxuXG5cdC8qKlxuXHQgKiBOb3JtYWxpemUgdGhlIFBvcHBlciBwb3NpdGlvbmluZyBzdHJhdGVneS5cblx0ICpcblx0ICogQHBhcmFtIHsqfSBjYW5kaWRhdGUgQ2FuZGlkYXRlIHN0cmF0ZWd5LlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IGBhYnNvbHV0ZWAgb3IgYGZpeGVkYC5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9wb3NpdGlvbmluZ19zdHJhdGVneSggY2FuZGlkYXRlICkge1xuXHRcdHJldHVybiAnYWJzb2x1dGUnID09PSBTdHJpbmcoIGNhbmRpZGF0ZSB8fCAnJyApID8gJ2Fic29sdXRlJyA6ICdmaXhlZCc7XG5cdH1cblxuXHQvKipcblx0ICogTm9ybWFsaXplIHRoZSBvcHRpb25hbCBsaXZlLXJlZmVyZW5jZSBmYWlsdXJlIHBvbGljeS5cblx0ICpcblx0ICogRXhpc3RpbmcgY29uc3VtZXJzIHJldGFpbiB0aGUgZXN0YWJsaXNoZWQgZmFsbGJhY2sgcmVjdGFuZ2xlLiBBIHN0cmljdFxuXHQgKiBvd25lciBvcHRzIG91dCBvZiByZW1lbWJlcmVkIGNvb3JkaW5hdGVzIHNvIGEgZGV0YWNoZWQgZG9tYWluIG93bmVyIGNhbm5vdFxuXHQgKiBsZWF2ZSBhIHZpc2libGUgc3VyZmFjZSBwb2ludGluZyBhdCBzdGFsZSBzY3JlZW4gZ2VvbWV0cnkuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gY2FuZGlkYXRlIENhbmRpZGF0ZSByZWZlcmVuY2UgcG9saWN5LlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IGBzdHJpY3RfbGl2ZV9vd25lcmAgb3IgYGZhbGxiYWNrYC5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9yZWZlcmVuY2VfcG9saWN5KCBjYW5kaWRhdGUgKSB7XG5cdFx0cmV0dXJuICdzdHJpY3RfbGl2ZV9vd25lcicgPT09IFN0cmluZyggY2FuZGlkYXRlIHx8ICcnICkgPyAnc3RyaWN0X2xpdmVfb3duZXInIDogJ2ZhbGxiYWNrJztcblx0fVxuXG5cdC8qKlxuXHQgKiBOb3JtYWxpemUgYSBjbG9zZSBvciBzdXNwZW5zaW9uIHJlYXNvbiBiZWZvcmUgbGlmZWN5Y2xlIHN0YXRlIGNoYW5nZXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gY2FuZGlkYXRlIENhbmRpZGF0ZSByZWFzb24uXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gQWxsb3ctbGlzdGVkIHJlYXNvbiwgb3IgYW4gZW1wdHkgc3RyaW5nIHdoZW4gaW52YWxpZC5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9jbG9zZV9yZWFzb24oIGNhbmRpZGF0ZSApIHtcblx0XHRjYW5kaWRhdGUgPSBTdHJpbmcoIGNhbmRpZGF0ZSB8fCAnJyApO1xuXHRcdGlmIChcblx0XHRcdC0xICE9PSBhdXRvbWF0aWNfY2xvc2VfcmVhc29ucy5pbmRleE9mKCBjYW5kaWRhdGUgKVxuXHRcdFx0fHwgLTEgIT09IGV4cGxpY2l0X2Nsb3NlX3JlYXNvbnMuaW5kZXhPZiggY2FuZGlkYXRlIClcblx0XHRcdHx8IC0xICE9PSBzdXNwZW5zaW9uX3JlYXNvbnMuaW5kZXhPZiggY2FuZGlkYXRlIClcblx0XHQpIHtcblx0XHRcdHJldHVybiBjYW5kaWRhdGU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICcnO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlcG9ydCB3aGV0aGVyIGEgcmVhc29uIGlzIGFuIGF1dG9tYXRpYyB0cmFuc2llbnQgZGlzbWlzc2FsLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gcmVhc29uIE5vcm1hbGl6ZWQgcmVhc29uLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIGZvciBhdXRvbWF0aWMgZGlzbWlzc2FsLlxuXHQgKi9cblx0ZnVuY3Rpb24gaXNfYXV0b21hdGljX2Nsb3NlX3JlYXNvbiggcmVhc29uICkge1xuXHRcdHJldHVybiAtMSAhPT0gYXV0b21hdGljX2Nsb3NlX3JlYXNvbnMuaW5kZXhPZiggcmVhc29uICk7XG5cdH1cblxuXHQvKipcblx0ICogUHV0IG9uZSB2aXNpYmxlIGNvbnRyb2xsZXIgYXQgdGhlIHRvcCBvZiBzaGFyZWQgc3VyZmFjZSBvcmRlcmluZy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbnRyb2xsZXIgQ29udGV4dCBQb3BvdmVyIGNvbnRyb2xsZXIuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiByZWdpc3Rlcl92aXNpYmxlX2NvbnRyb2xsZXIoIGNvbnRyb2xsZXIgKSB7XG5cdFx0dmlzaWJsZV9jb250cm9sbGVycyA9IHZpc2libGVfY29udHJvbGxlcnMuZmlsdGVyKCBmdW5jdGlvbiAoIGNhbmRpZGF0ZSApIHtcblx0XHRcdHJldHVybiBjYW5kaWRhdGUgIT09IGNvbnRyb2xsZXI7XG5cdFx0fSApO1xuXHRcdHZpc2libGVfY29udHJvbGxlcnMucHVzaCggY29udHJvbGxlciApO1xuXHRcdGFjdGl2ZV9jb250cm9sbGVyID0gY29udHJvbGxlcjtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZW1vdmUgb25lIGNvbnRyb2xsZXIgZnJvbSB2aXNpYmxlIG9yZGVyaW5nLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29udHJvbGxlciBDb250ZXh0IFBvcG92ZXIgY29udHJvbGxlci5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHVucmVnaXN0ZXJfdmlzaWJsZV9jb250cm9sbGVyKCBjb250cm9sbGVyICkge1xuXHRcdHZpc2libGVfY29udHJvbGxlcnMgPSB2aXNpYmxlX2NvbnRyb2xsZXJzLmZpbHRlciggZnVuY3Rpb24gKCBjYW5kaWRhdGUgKSB7XG5cdFx0XHRyZXR1cm4gY2FuZGlkYXRlICE9PSBjb250cm9sbGVyO1xuXHRcdH0gKTtcblx0XHRhY3RpdmVfY29udHJvbGxlciA9IHZpc2libGVfY29udHJvbGxlcnMubGVuZ3RoXG5cdFx0XHQ/IHZpc2libGVfY29udHJvbGxlcnNbIHZpc2libGVfY29udHJvbGxlcnMubGVuZ3RoIC0gMSBdXG5cdFx0XHQ6IG51bGw7XG5cdH1cblxuXHQvKipcblx0ICogUmVwb3J0IHdoZXRoZXIgYSBjb250cm9sbGVyIHBhcnRpY2lwYXRlcyBpbiB2aXNpYmxlIGFyYml0cmF0aW9uLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29udHJvbGxlciBDb250ZXh0IFBvcG92ZXIgY29udHJvbGxlci5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHZpc2libHkgcmVnaXN0ZXJlZC5cblx0ICovXG5cdGZ1bmN0aW9uIGlzX3Zpc2libGVfY29udHJvbGxlciggY29udHJvbGxlciApIHtcblx0XHRyZXR1cm4gLTEgIT09IHZpc2libGVfY29udHJvbGxlcnMuaW5kZXhPZiggY29udHJvbGxlciApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlcXVlc3QgcmVwbGFjZW1lbnQgZGlzbWlzc2FsIGZyb20gZXZlcnkgb3RoZXIgdmlzaWJsZSBjb250cm9sbGVyLlxuXHQgKlxuXHQgKiBQaW5uZWQgY29udHJvbGxlcnMgcmVqZWN0IHRoaXMgYXV0b21hdGljIHJlYXNvbiB3aGlsZSB0cmFuc2llbnQgY29uc3VtZXJzXG5cdCAqIHByZXNlcnZlIHRoZWlyIGVzdGFibGlzaGVkIHNpbmdsZS1hY3RpdmUtc3VyZmFjZSBiZWhhdmlvci5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IG9wZW5pbmdfY29udHJvbGxlciBDb250cm9sbGVyIGFib3V0IHRvIG9wZW4uXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBhcmJpdHJhdGVfdmlzaWJsZV9jb250cm9sbGVycyggb3BlbmluZ19jb250cm9sbGVyICkge1xuXHRcdHZpc2libGVfY29udHJvbGxlcnMuc2xpY2UoKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHZpc2libGVfY29udHJvbGxlciApIHtcblx0XHRcdGlmICggdmlzaWJsZV9jb250cm9sbGVyICE9PSBvcGVuaW5nX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRcdHZpc2libGVfY29udHJvbGxlci5yZXF1ZXN0X2Nsb3NlKCAncmVwbGFjZW1lbnQnLCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXNvbHZlIEVzY2FwZSB0byB0aGUgZm9jdXNlZCBvd25lciwgdGhlbiB0aGUgdG9wbW9zdCBlbGlnaWJsZSBzdXJmYWNlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge05vZGV8bnVsbH0gZXZlbnRfdGFyZ2V0IEN1cnJlbnQgRXNjYXBlIHRhcmdldC5cblx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IENvbnRyb2xsZXIgdGhhdCBvd25zIHRoaXMgRXNjYXBlLCBvciBudWxsLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2VzY2FwZV9jb250cm9sbGVyKCBldmVudF90YXJnZXQgKSB7XG5cdFx0dmFyIGZvY3VzZWRfb3duZXIgPSBudWxsO1xuXHRcdHZhciBmb2N1c2VkX2NoaWxkX293bnNfZXNjYXBlID0gZmFsc2U7XG5cdFx0dmFyIGZvY3VzZWRfc2hhcmVkX2xheWVyID0gbnVsbDtcblx0XHR2YXIgdG9wbW9zdF9vd25lciA9IG51bGw7XG5cdFx0dmFyIG9yZGVyZWRfY29udHJvbGxlcnMgPSB2aXNpYmxlX2NvbnRyb2xsZXJzLnNsaWNlKCkucmV2ZXJzZSgpO1xuXHRcdHZhciBldmVudF9lbGVtZW50ID0gZ2V0X2VsZW1lbnQoIGV2ZW50X3RhcmdldCApO1xuXG5cdFx0b3JkZXJlZF9jb250cm9sbGVycy5zb21lKCBmdW5jdGlvbiAoIHZpc2libGVfY29udHJvbGxlciApIHtcblx0XHRcdGlmICggdmlzaWJsZV9jb250cm9sbGVyLm93bnNfbm9kZSggZXZlbnRfdGFyZ2V0ICkgKSB7XG5cdFx0XHRcdGlmICggdmlzaWJsZV9jb250cm9sbGVyLmNhbl9oYW5kbGVfZXNjYXBlKCkgKSB7XG5cdFx0XHRcdFx0Zm9jdXNlZF9vd25lciA9IHZpc2libGVfY29udHJvbGxlcjtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRmb2N1c2VkX2NoaWxkX293bnNfZXNjYXBlID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9ICk7XG5cdFx0aWYgKCBmb2N1c2VkX293bmVyICkge1xuXHRcdFx0cmV0dXJuIGZvY3VzZWRfb3duZXI7XG5cdFx0fVxuXHRcdGlmICggZm9jdXNlZF9jaGlsZF9vd25zX2VzY2FwZSApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRmb2N1c2VkX3NoYXJlZF9sYXllciA9IGV2ZW50X2VsZW1lbnRcblx0XHRcdD8gZXZlbnRfZWxlbWVudC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1zaGFyZWQtdWktbGF5ZXItaW5zdGFuY2VdJyApXG5cdFx0XHQ6IG51bGw7XG5cdFx0aWYgKCBmb2N1c2VkX3NoYXJlZF9sYXllciApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRvcmRlcmVkX2NvbnRyb2xsZXJzLnNvbWUoIGZ1bmN0aW9uICggdmlzaWJsZV9jb250cm9sbGVyICkge1xuXHRcdFx0aWYgKCB2aXNpYmxlX2NvbnRyb2xsZXIuY2FuX2hhbmRsZV9lc2NhcGUoKSApIHtcblx0XHRcdFx0dG9wbW9zdF9vd25lciA9IHZpc2libGVfY29udHJvbGxlcjtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIHRvcG1vc3Rfb3duZXI7XG5cdH1cblxuXHQvKipcblx0ICogTm9ybWFsaXplIHRoZSBwb2ludGVyIHJlZmVyZW5jZSBnZW9tZXRyeSByZXF1ZXN0ZWQgYnkgYSBkb21haW4gYWRhcHRlci5cblx0ICpcblx0ICogYHBvaW50YCBrZWVwcyB0aGUgb3JpZ2luYWwgZnJvemVuIHBvaW50ZXIgcG9pbnQuIGB0cmlnZ2VyX2Jsb2NrX2VkZ2VgXG5cdCAqIHJldGFpbnMgdGhlIHBvaW50ZXIncyBpbmxpbmUgY29vcmRpbmF0ZSBmb3IgdGhlIGFycm93IHdoaWxlIHVzaW5nIHRoZVxuXHQgKiB0cmlnZ2VyJ3MgdG9wIGFuZCBib3R0b20gZWRnZXMgZm9yIHZlcnRpY2FsIHBsYWNlbWVudC5cblx0ICpcblx0ICogQHBhcmFtIHsqfSBjYW5kaWRhdGUgQ2FuZGlkYXRlIHBvaW50ZXIgYW5jaG9yIG1vZGUuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gQWxsb3ctbGlzdGVkIHBvaW50ZXIgYW5jaG9yIG1vZGUuXG5cdCAqL1xuXHRmdW5jdGlvbiBub3JtYWxpemVfcG9pbnRlcl9hbmNob3IoIGNhbmRpZGF0ZSApIHtcblx0XHRyZXR1cm4gJ3RyaWdnZXJfYmxvY2tfZWRnZScgPT09IFN0cmluZyggY2FuZGlkYXRlIHx8ICcnICkgPyAndHJpZ2dlcl9ibG9ja19lZGdlJyA6ICdwb2ludCc7XG5cdH1cblxuXHQvKipcblx0ICogTm9ybWFsaXplIGEgUG9wcGVyIHBsYWNlbWVudCBhZ2FpbnN0IHRoZSBzaGFyZWQgYWxsb3cgbGlzdC5cblx0ICpcblx0ICogQHBhcmFtIHsqfSBjYW5kaWRhdGUgQ2FuZGlkYXRlIHBsYWNlbWVudC5cblx0ICogQHJldHVybiB7c3RyaW5nfSBBbGxvdy1saXN0ZWQgcGxhY2VtZW50LlxuXHQgKi9cblx0ZnVuY3Rpb24gbm9ybWFsaXplX3BsYWNlbWVudCggY2FuZGlkYXRlICkge1xuXHRcdGNhbmRpZGF0ZSA9IFN0cmluZyggY2FuZGlkYXRlIHx8ICcnICk7XG5cblx0XHRyZXR1cm4gLTEgPT09IGFsbG93ZWRfcGxhY2VtZW50cy5pbmRleE9mKCBjYW5kaWRhdGUgKSA/ICdhdXRvLXN0YXJ0JyA6IGNhbmRpZGF0ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBOb3JtYWxpemUgYW4gb3JkZXJlZCBQb3BwZXIgcGxhY2VtZW50IGxpc3Qgd2l0aG91dCBkdXBsaWNhdGUgdmFsdWVzLlxuXHQgKlxuXHQgKiBEb21haW5zIG1heSB1c2UgdGhpcyBuZXV0cmFsIG9wdGlvbiB3aGVuIHRoZWlyIHN1cmZhY2UgbXVzdCByZW1haW4gb24gb25lXG5cdCAqIGF4aXMsIGZvciBleGFtcGxlIGFib3ZlIG9yIGJlbG93IGEgbG9uZyBob3Jpem9udGFsIHRyaWdnZXIuIFBvcHBlciBzdGlsbFxuXHQgKiBvd25zIGZsaXBwaW5nIGFuZCB2aWV3cG9ydC1vdmVyZmxvdyBwcmV2ZW50aW9uLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IGNhbmRpZGF0ZSBDYW5kaWRhdGUgcGxhY2VtZW50IGxpc3QuXG5cdCAqIEByZXR1cm4ge0FycmF5PHN0cmluZz59IE9yZGVyZWQgYWxsb3ctbGlzdGVkIHBsYWNlbWVudHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBub3JtYWxpemVfcGxhY2VtZW50X2xpc3QoIGNhbmRpZGF0ZSApIHtcblx0XHR2YXIgbm9ybWFsaXplZF9wbGFjZW1lbnRzID0gW107XG5cblx0XHRpZiAoICEgQXJyYXkuaXNBcnJheSggY2FuZGlkYXRlICkgKSB7XG5cdFx0XHRyZXR1cm4gbm9ybWFsaXplZF9wbGFjZW1lbnRzO1xuXHRcdH1cblx0XHRjYW5kaWRhdGUuZm9yRWFjaCggZnVuY3Rpb24gKCBwbGFjZW1lbnQgKSB7XG5cdFx0XHRwbGFjZW1lbnQgPSBTdHJpbmcoIHBsYWNlbWVudCB8fCAnJyApO1xuXHRcdFx0aWYgKFxuXHRcdFx0XHQtMSAhPT0gYWxsb3dlZF9wbGFjZW1lbnRzLmluZGV4T2YoIHBsYWNlbWVudCApXG5cdFx0XHRcdCYmIC0xID09PSBub3JtYWxpemVkX3BsYWNlbWVudHMuaW5kZXhPZiggcGxhY2VtZW50IClcblx0XHRcdCkge1xuXHRcdFx0XHRub3JtYWxpemVkX3BsYWNlbWVudHMucHVzaCggcGxhY2VtZW50ICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIG5vcm1hbGl6ZWRfcGxhY2VtZW50cztcblx0fVxuXG5cdC8qKlxuXHQgKiBOb3JtYWxpemUgb25lIGJvdW5kZWQgZGVsYXkgaW4gbWlsbGlzZWNvbmRzLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9ICAgICAgY2FuZGlkYXRlIENhbmRpZGF0ZSBkZWxheS5cblx0ICogQHBhcmFtIHtudW1iZXJ9IGZhbGxiYWNrICBEZWxheSB1c2VkIHdoZW4gdGhlIGNhbmRpZGF0ZSBpcyBub3QgZmluaXRlLlxuXHQgKiBAcmV0dXJuIHtudW1iZXJ9IEludGVnZXIgZGVsYXkgYmV0d2VlbiB6ZXJvIGFuZCB0d28gc2Vjb25kcy5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9kZWxheSggY2FuZGlkYXRlLCBmYWxsYmFjayApIHtcblx0XHR2YXIgZGVsYXkgPSBOdW1iZXIoIGNhbmRpZGF0ZSApO1xuXG5cdFx0aWYgKCAhIE51bWJlci5pc0Zpbml0ZSggZGVsYXkgKSApIHtcblx0XHRcdGRlbGF5ID0gZmFsbGJhY2s7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIE1hdGgubWluKCAyMDAwLCBNYXRoLm1heCggMCwgTWF0aC5yb3VuZCggZGVsYXkgKSApICk7XG5cdH1cblxuXHQvKipcblx0ICogTm9ybWFsaXplIG9uZSBkb21haW4tbmV1dHJhbCBDU1MtcGl4ZWwgbGVuZ3RoLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9ICAgICAgY2FuZGlkYXRlIENhbmRpZGF0ZSBDU1MtcGl4ZWwgbGVuZ3RoLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gZmFsbGJhY2sgIExlbmd0aCB1c2VkIHdoZW4gdGhlIGNhbmRpZGF0ZSBpcyBub3QgZmluaXRlLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gbWluaW11bSAgIFNtYWxsZXN0IHBlcm1pdHRlZCBsZW5ndGguXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBtYXhpbXVtICAgTGFyZ2VzdCBwZXJtaXR0ZWQgbGVuZ3RoLlxuXHQgKiBAcmV0dXJuIHtudW1iZXJ9IEJvdW5kZWQgaW50ZWdlciBDU1MtcGl4ZWwgbGVuZ3RoLlxuXHQgKi9cblx0ZnVuY3Rpb24gbm9ybWFsaXplX2xlbmd0aCggY2FuZGlkYXRlLCBmYWxsYmFjaywgbWluaW11bSwgbWF4aW11bSApIHtcblx0XHRjYW5kaWRhdGUgPSBOdW1iZXIoIGNhbmRpZGF0ZSApO1xuXHRcdGlmICggISBOdW1iZXIuaXNGaW5pdGUoIGNhbmRpZGF0ZSApICkge1xuXHRcdFx0Y2FuZGlkYXRlID0gZmFsbGJhY2s7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIE1hdGgubWF4KCBtaW5pbXVtLCBNYXRoLm1pbiggbWF4aW11bSwgTWF0aC5yb3VuZCggY2FuZGlkYXRlICkgKSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIE5vcm1hbGl6ZSBhIGRvbWFpbi1uZXV0cmFsIHBvcG92ZXIgd2lkdGggcHJlZmVyZW5jZS5cblx0ICpcblx0ICogVGhlIGJvdW5kZWQgdmFsdWUgaXMgcHJlc2VudGF0aW9uIG1ldGFkYXRhIG9ubHkuIEl0IGNhbm5vdCBzZWxlY3QgYVxuXHQgKiB0ZW1wbGF0ZSBvciBjaGFuZ2UgZG9tYWluIGJlaGF2aW9yLCBhbmQgZXhpc3RpbmcgY29uc3VtZXJzIGtlZXAgdGhlXG5cdCAqIGVzdGFibGlzaGVkIGZhbGxiYWNrIHdoZW4gdGhleSBkbyBub3Qgb3B0IGluLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9ICAgICAgY2FuZGlkYXRlIENhbmRpZGF0ZSBDU1MtcGl4ZWwgd2lkdGguXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBmYWxsYmFjayAgV2lkdGggdXNlZCB3aGVuIHRoZSBjYW5kaWRhdGUgaXMgbm90IGZpbml0ZS5cblx0ICogQHBhcmFtIHtudW1iZXJ9IG1pbmltdW0gICBTbWFsbGVzdCBwZXJtaXR0ZWQgd2lkdGguXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBtYXhpbXVtICAgTGFyZ2VzdCBwZXJtaXR0ZWQgd2lkdGguXG5cdCAqIEByZXR1cm4ge251bWJlcn0gQm91bmRlZCBpbnRlZ2VyIENTUy1waXhlbCB3aWR0aC5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV93aWR0aCggY2FuZGlkYXRlLCBmYWxsYmFjaywgbWluaW11bSwgbWF4aW11bSApIHtcblx0XHRyZXR1cm4gbm9ybWFsaXplX2xlbmd0aCggY2FuZGlkYXRlLCBmYWxsYmFjaywgbWluaW11bSwgbWF4aW11bSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnQgYW4gYXJiaXRyYXJ5IHNjYWxhciB0byBib3VuZGVkIHBsYWluIHRleHQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gICAgICBjYW5kaWRhdGUgIENhbmRpZGF0ZSB0ZXh0LlxuXHQgKiBAcGFyYW0ge251bWJlcn0gbWF4X2xlbmd0aCBNYXhpbXVtIHJldHVybmVkIGNoYXJhY3RlcnMuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gQm91bmRlZCBwbGFpbiB0ZXh0LlxuXHQgKi9cblx0ZnVuY3Rpb24gbm9ybWFsaXplX3RleHQoIGNhbmRpZGF0ZSwgbWF4X2xlbmd0aCApIHtcblx0XHRpZiAoIG51bGwgPT09IGNhbmRpZGF0ZSB8fCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIGNhbmRpZGF0ZSB8fCAoICdzdHJpbmcnICE9PSB0eXBlb2YgY2FuZGlkYXRlICYmICdudW1iZXInICE9PSB0eXBlb2YgY2FuZGlkYXRlICkgKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFN0cmluZyggY2FuZGlkYXRlICkuc2xpY2UoIDAsIG1heF9sZW5ndGggKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZWFkIG9uZSBwb3NpdGl2ZSBpbnRlZ2VyIGxheWVyIHRva2VuIGZyb20gdGhlIGRvY3VtZW50IHJvb3QuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0b2tlbl9uYW1lIENTUyBjdXN0b20tcHJvcGVydHkgbmFtZS5cblx0ICogQHBhcmFtIHtudW1iZXJ9IGZhbGxiYWNrICAgRmFsbGJhY2sgbGF5ZXIgdmFsdWUuXG5cdCAqIEByZXR1cm4ge251bWJlcn0gUG9zaXRpdmUgaW50ZWdlciB6LWluZGV4LlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2xheWVyX3Rva2VuKCB0b2tlbl9uYW1lLCBmYWxsYmFjayApIHtcblx0XHR2YXIgY2FuZGlkYXRlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCApLmdldFByb3BlcnR5VmFsdWUoIHRva2VuX25hbWUgKTtcblx0XHR2YXIgbGF5ZXIgPSBNYXRoLnJvdW5kKCBOdW1iZXIoIFN0cmluZyggY2FuZGlkYXRlIHx8ICcnICkudHJpbSgpICkgKTtcblxuXHRcdHJldHVybiBOdW1iZXIuaXNGaW5pdGUoIGxheWVyICkgJiYgMCA8IGxheWVyID8gbGF5ZXIgOiBmYWxsYmFjaztcblx0fVxuXG5cdC8qKlxuXHQgKiBOb3JtYWxpemUgYW4gb3B0aW9uYWwgcGVyLWluc3RhbmNlIGZsb2F0aW5nLWxheWVyIGluZGV4LlxuXHQgKlxuXHQgKiBEb21haW5zIG1heSBvcHQgYSBzdXJmYWNlIGludG8gYW4gZXhpc3RpbmcgaG9zdCBzdGFja2luZyBjb250cmFjdCB3aXRob3V0XG5cdCAqIGNoYW5naW5nIHRoZSBzaGFyZWQgZGVmYXVsdCB1c2VkIGJ5IGV2ZXJ5IG90aGVyIENvbnRleHQgUG9wb3ZlciBjb25zdW1lci5cblx0ICpcblx0ICogQHBhcmFtIHsqfSAgICAgIGNhbmRpZGF0ZSBDYW5kaWRhdGUgei1pbmRleC5cblx0ICogQHBhcmFtIHtudW1iZXJ9IGZhbGxiYWNrICBEZWZhdWx0IHNoYXJlZCBsYXllci5cblx0ICogQHJldHVybiB7bnVtYmVyfSBQb3NpdGl2ZSBib3VuZGVkIGludGVnZXIgei1pbmRleC5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9sYXllcl9pbmRleCggY2FuZGlkYXRlLCBmYWxsYmFjayApIHtcblx0XHRjYW5kaWRhdGUgPSBNYXRoLnJvdW5kKCBOdW1iZXIoIGNhbmRpZGF0ZSApICk7XG5cdFx0aWYgKCAhIE51bWJlci5pc0Zpbml0ZSggY2FuZGlkYXRlICkgfHwgMCA+PSBjYW5kaWRhdGUgKSB7XG5cdFx0XHRjYW5kaWRhdGUgPSBmYWxsYmFjaztcblx0XHR9XG5cblx0XHRyZXR1cm4gTWF0aC5taW4oIDEwMDAwMDAsIGNhbmRpZGF0ZSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIE5vcm1hbGl6ZSBhbiBvcHRpb25hbCBQb3BwZXIgY29sbGlzaW9uIGJvdW5kYXJ5LlxuXHQgKlxuXHQgKiBUaGUgYm91bmRhcnkgaXMgcHJlc2VudGF0aW9uIGdlb21ldHJ5IG9ubHkuIEEgZGlzY29ubmVjdGVkIG9yIG5vbi1lbGVtZW50XG5cdCAqIHZhbHVlIHJldGFpbnMgdGhlIGVzdGFibGlzaGVkIHZpZXdwb3J0IGJlaGF2aW9yLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IGNhbmRpZGF0ZSBDYW5kaWRhdGUgYm91bmRhcnkgZWxlbWVudC5cblx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR8c3RyaW5nfSBDb25uZWN0ZWQgZWxlbWVudCBvciB0aGUgdmlld3BvcnQgZmFsbGJhY2suXG5cdCAqL1xuXHRmdW5jdGlvbiBub3JtYWxpemVfcG9zaXRpb25pbmdfYm91bmRhcnkoIGNhbmRpZGF0ZSApIHtcblx0XHRyZXR1cm4gY2FuZGlkYXRlICYmIDEgPT09IGNhbmRpZGF0ZS5ub2RlVHlwZSAmJiBjYW5kaWRhdGUuaXNDb25uZWN0ZWQgPyBjYW5kaWRhdGUgOiAndmlld3BvcnQnO1xuXHR9XG5cblx0LyoqXG5cdCAqIE5vcm1hbGl6ZSBhIHJlY3RhbmdsZSBmb3IgYSBUaXBweSB2aXJ0dWFsIHJlZmVyZW5jZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R8bnVsbH0gY2FuZGlkYXRlIENhbmRpZGF0ZSBET01SZWN0LWxpa2Ugb2JqZWN0LlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gQ29tcGxldGUgZmluaXRlIHJlY3RhbmdsZSBvciBudWxsLlxuXHQgKi9cblx0ZnVuY3Rpb24gbm9ybWFsaXplX3JlZmVyZW5jZV9yZWN0KCBjYW5kaWRhdGUgKSB7XG5cdFx0dmFyIGxlZnQ7XG5cdFx0dmFyIHRvcDtcblx0XHR2YXIgd2lkdGg7XG5cdFx0dmFyIGhlaWdodDtcblxuXHRcdGlmICggISBjYW5kaWRhdGUgfHwgJ29iamVjdCcgIT09IHR5cGVvZiBjYW5kaWRhdGUgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0bGVmdCA9IE51bWJlciggY2FuZGlkYXRlLmxlZnQgKTtcblx0XHR0b3AgPSBOdW1iZXIoIGNhbmRpZGF0ZS50b3AgKTtcblx0XHR3aWR0aCA9IE1hdGgubWF4KCAwLCBOdW1iZXIoIGNhbmRpZGF0ZS53aWR0aCApIHx8IDAgKTtcblx0XHRoZWlnaHQgPSBNYXRoLm1heCggMCwgTnVtYmVyKCBjYW5kaWRhdGUuaGVpZ2h0ICkgfHwgMCApO1xuXHRcdGlmICggISBOdW1iZXIuaXNGaW5pdGUoIGxlZnQgKSB8fCAhIE51bWJlci5pc0Zpbml0ZSggdG9wICkgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0eDogbGVmdCxcblx0XHRcdHk6IHRvcCxcblx0XHRcdGxlZnQ6IGxlZnQsXG5cdFx0XHR0b3A6IHRvcCxcblx0XHRcdHJpZ2h0OiBsZWZ0ICsgd2lkdGgsXG5cdFx0XHRib3R0b206IHRvcCArIGhlaWdodCxcblx0XHRcdHdpZHRoOiB3aWR0aCxcblx0XHRcdGhlaWdodDogaGVpZ2h0XG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGUgYSB6ZXJvLXNpemUgdmlydHVhbC1yZWZlcmVuY2UgcmVjdGFuZ2xlIGF0IHZpZXdwb3J0IGNvb3JkaW5hdGVzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge251bWJlcn0gY2xpZW50X3ggSG9yaXpvbnRhbCB2aWV3cG9ydCBjb29yZGluYXRlLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gY2xpZW50X3kgVmVydGljYWwgdmlld3BvcnQgY29vcmRpbmF0ZS5cblx0ICogQHJldHVybiB7T2JqZWN0fSBDb21wbGV0ZSB6ZXJvLXNpemUgRE9NUmVjdC1saWtlIHZhbHVlLlxuXHQgKi9cblx0ZnVuY3Rpb24gY3JlYXRlX3BvaW50X3JlZmVyZW5jZV9yZWN0KCBjbGllbnRfeCwgY2xpZW50X3kgKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHg6IGNsaWVudF94LFxuXHRcdFx0eTogY2xpZW50X3ksXG5cdFx0XHRsZWZ0OiBjbGllbnRfeCxcblx0XHRcdHRvcDogY2xpZW50X3ksXG5cdFx0XHRyaWdodDogY2xpZW50X3gsXG5cdFx0XHRib3R0b206IGNsaWVudF95LFxuXHRcdFx0d2lkdGg6IDAsXG5cdFx0XHRoZWlnaHQ6IDBcblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiBhbiBpbmVydCBvZmYtc2NyZWVuIHJlY3RhbmdsZSBmb3IgYSB0ZW1wb3JhcmlseSB1bmF2YWlsYWJsZSBzdHJpY3Qgb3duZXIuXG5cdCAqXG5cdCAqIFRoaXMgcmVjdGFuZ2xlIGlzIG5ldmVyIHVzZWQgYXMgYSB2aXNpYmxlIGZhbGxiYWNrLiBJdCBvbmx5IHNhdGlzZmllc1xuXHQgKiBQb3BwZXIncyBzeW5jaHJvbm91cyB2aXJ0dWFsLWVsZW1lbnQgY29udHJhY3QgdW50aWwgdGhlIGRvbWFpbidzIGNvYWxlc2NlZFxuXHQgKiBnZW9tZXRyeSBwYXRoIHN1c3BlbmRzIHRoZSBzdXJmYWNlLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IFplcm8tc2l6ZWQgb2ZmLXNjcmVlbiByZWN0YW5nbGUuXG5cdCAqL1xuXHRmdW5jdGlvbiBjcmVhdGVfdW5hdmFpbGFibGVfcmVmZXJlbmNlX3JlY3QoKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHg6IC0xMDAwMCxcblx0XHRcdHk6IC0xMDAwMCxcblx0XHRcdGxlZnQ6IC0xMDAwMCxcblx0XHRcdHRvcDogLTEwMDAwLFxuXHRcdFx0cmlnaHQ6IC0xMDAwMCxcblx0XHRcdGJvdHRvbTogLTEwMDAwLFxuXHRcdFx0d2lkdGg6IDAsXG5cdFx0XHRoZWlnaHQ6IDBcblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZSB0aGUgcG9pbnRlciByZWZlcmVuY2UgcmVxdWVzdGVkIGJ5IHRoZSBkb21haW4gYWRhcHRlci5cblx0ICpcblx0ICogVHJpZ2dlci1lZGdlIG1vZGUgaXMgdXNlZnVsIGZvciBzaG9ydCBob3Jpem9udGFsIG9iamVjdHM6IFBvcHBlciBwbGFjZXNcblx0ICogdGhlIHN1cmZhY2UgYWJvdmUgb3IgYmVsb3cgdGhlIGNvbXBsZXRlIG9iamVjdCB3aGlsZSBpdHMgYXJyb3cgcmVtYWluc1xuXHQgKiBhbGlnbmVkIHdpdGggdGhlIHBvaW50ZXIncyBob3Jpem9udGFsIHBvc2l0aW9uLiBJdHMgcmV0dXJuZWQgZ2V0dGVyIGtlZXBzXG5cdCAqIHRoYXQgcG9pbnRlciBvZmZzZXQgYXR0YWNoZWQgdG8gdGhlIGxpdmUgdHJpZ2dlciB3aGlsZSBuYXRpdmUgZG9jdW1lbnQgb3Jcblx0ICogaG9zdCBzY3JvbGxpbmcgY2hhbmdlcyB0aGUgdHJpZ2dlcidzIHZpZXdwb3J0IHJlY3RhbmdsZS4gUG9pbnQgbW9kZSBrZWVwc1xuXHQgKiB0aGUgZXN0YWJsaXNoZWQgZnJvemVuIGNvb3JkaW5hdGUgY29udHJhY3QuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gdHJpZ2dlciAgICAgICAgICAgICBBY3RpdmF0aW5nIHRyaWdnZXIuXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSAgICAgICAgICAgY2xpZW50X3ggICAgICAgICAgICBIb3Jpem9udGFsIHZpZXdwb3J0IGNvb3JkaW5hdGUuXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSAgICAgICAgICAgY2xpZW50X3kgICAgICAgICAgICBWZXJ0aWNhbCB2aWV3cG9ydCBjb29yZGluYXRlLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgIHBvaW50ZXJfYW5jaG9yX21vZGUgTm9ybWFsaXplZCBwb2ludGVyIGFuY2hvciBtb2RlLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8RnVuY3Rpb258bnVsbH0gRnJvemVuIHBvaW50LCBsaXZlIGdldHRlciwgb3IgbnVsbC5cblx0ICovXG5cdGZ1bmN0aW9uIGNyZWF0ZV9wb2ludGVyX3JlZmVyZW5jZV9yZWN0KCB0cmlnZ2VyLCBjbGllbnRfeCwgY2xpZW50X3ksIHBvaW50ZXJfYW5jaG9yX21vZGUgKSB7XG5cdFx0dmFyIHBvaW50ZXJfaW5saW5lX29mZnNldDtcblx0XHR2YXIgdHJpZ2dlcl9yZWN0O1xuXG5cdFx0aWYgKCAndHJpZ2dlcl9ibG9ja19lZGdlJyAhPT0gcG9pbnRlcl9hbmNob3JfbW9kZSApIHtcblx0XHRcdHJldHVybiBjcmVhdGVfcG9pbnRfcmVmZXJlbmNlX3JlY3QoIGNsaWVudF94LCBjbGllbnRfeSApO1xuXHRcdH1cblx0XHRpZiAoICEgdHJpZ2dlciB8fCAhIHRyaWdnZXIuaXNDb25uZWN0ZWQgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHRyaWdnZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0ICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHRyaWdnZXJfcmVjdCA9IG5vcm1hbGl6ZV9yZWZlcmVuY2VfcmVjdCggdHJpZ2dlci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSApO1xuXHRcdGlmICggISB0cmlnZ2VyX3JlY3QgfHwgISBpc19yZWZlcmVuY2VfcmVjdF9pbl92aWV3cG9ydCggdHJpZ2dlcl9yZWN0ICkgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0cG9pbnRlcl9pbmxpbmVfb2Zmc2V0ID0gTWF0aC5tYXgoIDAsIE1hdGgubWluKCB0cmlnZ2VyX3JlY3Qud2lkdGgsIGNsaWVudF94IC0gdHJpZ2dlcl9yZWN0LmxlZnQgKSApO1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciBjdXJyZW50X3BvaW50ZXJfeDtcblx0XHRcdHZhciBjdXJyZW50X3RyaWdnZXJfcmVjdDtcblxuXHRcdFx0aWYgKCAhIHRyaWdnZXIuaXNDb25uZWN0ZWQgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0Y3VycmVudF90cmlnZ2VyX3JlY3QgPSBub3JtYWxpemVfcmVmZXJlbmNlX3JlY3QoIHRyaWdnZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkgKTtcblx0XHRcdGlmICggISBjdXJyZW50X3RyaWdnZXJfcmVjdCApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRjdXJyZW50X3BvaW50ZXJfeCA9IGN1cnJlbnRfdHJpZ2dlcl9yZWN0LmxlZnQgKyBNYXRoLm1pbiggcG9pbnRlcl9pbmxpbmVfb2Zmc2V0LCBjdXJyZW50X3RyaWdnZXJfcmVjdC53aWR0aCApO1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR4OiBjdXJyZW50X3BvaW50ZXJfeCxcblx0XHRcdFx0eTogY3VycmVudF90cmlnZ2VyX3JlY3QudG9wLFxuXHRcdFx0XHRsZWZ0OiBjdXJyZW50X3BvaW50ZXJfeCxcblx0XHRcdFx0dG9wOiBjdXJyZW50X3RyaWdnZXJfcmVjdC50b3AsXG5cdFx0XHRcdHJpZ2h0OiBjdXJyZW50X3BvaW50ZXJfeCxcblx0XHRcdFx0Ym90dG9tOiBjdXJyZW50X3RyaWdnZXJfcmVjdC5ib3R0b20sXG5cdFx0XHRcdHdpZHRoOiAwLFxuXHRcdFx0XHRoZWlnaHQ6IGN1cnJlbnRfdHJpZ2dlcl9yZWN0LmhlaWdodFxuXHRcdFx0fTtcblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIERldGVybWluZSB3aGV0aGVyIGEgcmVmZXJlbmNlIHJlY3RhbmdsZSBpbnRlcnNlY3RzIHRoZSBjdXJyZW50IHZpZXdwb3J0LlxuXHQgKlxuXHQgKiBBIGRpc2Nvbm5lY3RlZCBvciBzY3JvbGxlZC1hd2F5IHRyaWdnZXIgbXVzdCBub3QgYmUgYWxsb3dlZCB0byBwb3NpdGlvbiBhXG5cdCAqIHZpc2libGUgcG9wb3ZlciBmcm9tIHRoZSBwcml2YXRlIHNlbnRpbmVsIGF0IHRoZSBkb2N1bWVudCBvcmlnaW4uXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fG51bGx9IHJlZmVyZW5jZV9yZWN0IE5vcm1hbGl6ZWQgcmVmZXJlbmNlIHJlY3RhbmdsZS5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGF0IGxlYXN0IG9uZSBwb2ludCBpbnRlcnNlY3RzIHRoZSB2aWV3cG9ydC5cblx0ICovXG5cdGZ1bmN0aW9uIGlzX3JlZmVyZW5jZV9yZWN0X2luX3ZpZXdwb3J0KCByZWZlcmVuY2VfcmVjdCApIHtcblx0XHR2YXIgdmlld3BvcnRfd2lkdGggPSBNYXRoLm1heCggZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudFdpZHRoIHx8IDAsIHdpbmRvdy5pbm5lcldpZHRoIHx8IDAgKTtcblx0XHR2YXIgdmlld3BvcnRfaGVpZ2h0ID0gTWF0aC5tYXgoIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQgfHwgMCwgd2luZG93LmlubmVySGVpZ2h0IHx8IDAgKTtcblxuXHRcdHJldHVybiBCb29sZWFuKFxuXHRcdFx0cmVmZXJlbmNlX3JlY3Rcblx0XHRcdCYmIDAgPCB2aWV3cG9ydF93aWR0aFxuXHRcdFx0JiYgMCA8IHZpZXdwb3J0X2hlaWdodFxuXHRcdFx0JiYgcmVmZXJlbmNlX3JlY3QucmlnaHQgPj0gMFxuXHRcdFx0JiYgcmVmZXJlbmNlX3JlY3QuYm90dG9tID49IDBcblx0XHRcdCYmIHJlZmVyZW5jZV9yZWN0LmxlZnQgPD0gdmlld3BvcnRfd2lkdGhcblx0XHRcdCYmIHJlZmVyZW5jZV9yZWN0LnRvcCA8PSB2aWV3cG9ydF9oZWlnaHRcblx0XHQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBhIGhhcm1sZXNzIHByaXZhdGUgcmVmZXJlbmNlIHVzZWQgb25seSB3aGlsZSBUaXBweSBpcyBoaWRkZW4uXG5cdCAqXG5cdCAqIFZpc2libGUgb3BlbnMgYXJlIHZhbGlkYXRlZCBzZXBhcmF0ZWx5LiBLZWVwaW5nIHRoZSBkb3JtYW50IHJlZmVyZW5jZSBhdFxuXHQgKiB0aGUgdmlld3BvcnQgY2VudGVyIHByZXZlbnRzIGEgaGlkZGVuIHNlbnRpbmVsIGF0IGAoMCwgMClgIGZyb20gYmVjb21pbmdcblx0ICogYW4gYWNjaWRlbnRhbCB2aXNpYmxlIGZhbGxiYWNrIGR1cmluZyBhIFRpcHB5IGxpZmVjeWNsZSB0cmFuc2l0aW9uLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IFplcm8tc2l6ZSByZWN0YW5nbGUgYXQgdGhlIHZpZXdwb3J0IGNlbnRlci5cblx0ICovXG5cdGZ1bmN0aW9uIGNyZWF0ZV92aWV3cG9ydF9jZW50ZXJfcmVmZXJlbmNlX3JlY3QoKSB7XG5cdFx0dmFyIHZpZXdwb3J0X3dpZHRoID0gTWF0aC5tYXgoIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aCB8fCAwLCB3aW5kb3cuaW5uZXJXaWR0aCB8fCAwICk7XG5cdFx0dmFyIHZpZXdwb3J0X2hlaWdodCA9IE1hdGgubWF4KCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50SGVpZ2h0IHx8IDAsIHdpbmRvdy5pbm5lckhlaWdodCB8fCAwICk7XG5cblx0XHRyZXR1cm4gY3JlYXRlX3BvaW50X3JlZmVyZW5jZV9yZWN0KCB2aWV3cG9ydF93aWR0aCAvIDIsIHZpZXdwb3J0X2hlaWdodCAvIDIgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGUgb25lIENvbnRleHQgUG9wb3ZlciBzaGVsbCBjb250cm9sbGVyLlxuXHQgKlxuXHQgKiBUaGUgY2FsbGVyIG11c3Qgc3VwcGx5IGF1dGhvcml6ZWQsIGxvY2FsbHkgcmVuZGVyZWQgY29udGVudC4gVGhpcyBtZXRob2Rcblx0ICogc2VuZHMgbm8gcmVxdWVzdCwgc2VsZWN0cyBubyBkb21haW4gdGVtcGxhdGUsIGFuZCBjcmVhdGVzIG5vIHRyaWdnZXItc2lkZVxuXHQgKiBUaXBweSBwcm9wZXJ0eS4gVGlwcHkgaXMgYXR0YWNoZWQgb25seSB0byBhIHByaXZhdGUgc2VudGluZWwuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIEV4ZWN1dGFibGUgb3B0aW9ucyBhbmQgbG9jYWxpemVkIHNoZWxsIGxhYmVscy5cblx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IENvbXBvbmVudCBjb250cm9sbGVyIG9yIG51bGwgd2hlbiBkZXBlbmRlbmNpZXMgb3Jcblx0ICogICAgICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkIGNvbmZpZ3VyYXRpb24gYXJlIHVuYXZhaWxhYmxlLlxuXHQgKi9cblx0ZnVuY3Rpb24gY3JlYXRlKCBvcHRpb25zICkge1xuXHRcdHZhciBzZXR0aW5ncyA9IG9wdGlvbnMgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBvcHRpb25zID8gb3B0aW9ucyA6IHt9O1xuXHRcdHZhciBjb21wb25lbnRfaWQgPSBub3JtYWxpemVfaWQoIHNldHRpbmdzLmlkICk7XG5cdFx0dmFyIG1vZGUgPSBub3JtYWxpemVfbW9kZSggc2V0dGluZ3MubW9kZSApO1xuXHRcdHZhciBwb2ludGVyX2FuY2hvciA9IG5vcm1hbGl6ZV9wb2ludGVyX2FuY2hvciggc2V0dGluZ3MucG9pbnRlcl9hbmNob3IgKTtcblx0XHR2YXIgb3duZXJfaWQgPSBub3JtYWxpemVfaWQoIHNldHRpbmdzLm93bmVyX2lkICkgfHwgY29tcG9uZW50X2lkO1xuXHRcdHZhciBpbnRlcmFjdGlvbl9ncm91cCA9IG5vcm1hbGl6ZV9pZCggc2V0dGluZ3MuaW50ZXJhY3Rpb25fZ3JvdXAgKSB8fCBjb21wb25lbnRfaWQ7XG5cdFx0dmFyIHBpbl9wb2xpY3kgPSBub3JtYWxpemVfcGluX3BvbGljeSggc2V0dGluZ3MucGluX3BvbGljeSApO1xuXHRcdHZhciBleHRlcm5hbF9zY3JvbGxfcG9saWN5ID0gbm9ybWFsaXplX2V4dGVybmFsX3Njcm9sbF9wb2xpY3koIHNldHRpbmdzLmV4dGVybmFsX3Njcm9sbF9wb2xpY3kgKTtcblx0XHR2YXIgZGlzbWlzc19wb2xpY3kgPSBub3JtYWxpemVfZGlzbWlzc19wb2xpY3koIHNldHRpbmdzLmRpc21pc3NfcG9saWN5ICk7XG5cdFx0dmFyIHJlZmVyZW5jZV9wb2xpY3kgPSBub3JtYWxpemVfcmVmZXJlbmNlX3BvbGljeSggc2V0dGluZ3MucmVmZXJlbmNlX3BvbGljeSApO1xuXHRcdHZhciBwb3J0YWxfaG9zdCA9IG5vcm1hbGl6ZV9wb3J0YWxfaG9zdCggc2V0dGluZ3MucG9ydGFsX2hvc3QgKTtcblx0XHR2YXIgcGlubmVkX3BvcnRhbF9ob3N0ID0gbm9ybWFsaXplX3BvcnRhbF9ob3N0KCBzZXR0aW5ncy5waW5uZWRfcG9ydGFsX2hvc3QgKTtcblx0XHR2YXIgcG9zaXRpb25pbmdfc3RyYXRlZ3kgPSBub3JtYWxpemVfcG9zaXRpb25pbmdfc3RyYXRlZ3koIHNldHRpbmdzLnBvc2l0aW9uaW5nX3N0cmF0ZWd5ICk7XG5cdFx0dmFyIGZpdF9vbl9maXJzdF9vcGVuID0gdHJ1ZSA9PT0gc2V0dGluZ3MuZml0X29uX2ZpcnN0X29wZW47XG5cdFx0dmFyIHBpbl90b192aWV3cG9ydCA9IHRydWUgPT09IHNldHRpbmdzLnBpbl90b192aWV3cG9ydDtcblx0XHR2YXIgZHJhZ2dhYmxlX3doZW5fcGlubmVkID0gcGluX3RvX3ZpZXdwb3J0ICYmIHRydWUgPT09IHNldHRpbmdzLmRyYWdnYWJsZV93aGVuX3Bpbm5lZDtcblx0XHR2YXIgcmVzaXphYmxlX3doZW5fcGlubmVkID0gcGluX3RvX3ZpZXdwb3J0ICYmIHRydWUgPT09IHNldHRpbmdzLnJlc2l6YWJsZV93aGVuX3Bpbm5lZDtcblx0XHR2YXIgY29udGV4dF9wb3BvdmVyX3ByaW9yaXR5ID0gdHJ1ZSA9PT0gc2V0dGluZ3MuY29udGV4dF9wb3BvdmVyX3ByaW9yaXR5O1xuXHRcdHZhciBsYXllcl9kZXNjcmlwdG9yO1xuXHRcdHZhciByZWdpc3RlcmVkX2NoaWxkX2xheWVycyA9IHt9O1xuXHRcdHZhciBvcGVuX2NoaWxkX2xheWVycyA9IHt9O1xuXHRcdHZhciBzdXNwZW5kaW5nX2xheWVycyA9IHt9O1xuXHRcdHZhciBsYXllcl9vcGVuX2Fubm91bmNlZCA9IGZhbHNlO1xuXHRcdHZhciBzaGVsbF90ZW1wbGF0ZTtcblx0XHR2YXIgc2hlbGxfd3JhcHBlcjtcblx0XHR2YXIgc3VyZmFjZTtcblx0XHR2YXIgc2VudGluZWw7XG5cdFx0dmFyIHRpcHB5X2luc3RhbmNlO1xuXHRcdHZhciBjdXJyZW50X3RyaWdnZXIgPSBudWxsO1xuXHRcdHZhciBkZXNjcmliZWRfdHJpZ2dlciA9IG51bGw7XG5cdFx0dmFyIHJlZmVyZW5jZV9yZWN0X3Byb3ZpZGVyID0gbnVsbDtcblx0XHR2YXIgcmVmZXJlbmNlX3RyYWNrc190cmlnZ2VyID0gZmFsc2U7XG5cdFx0dmFyIGxhc3RfdmFsaWRfcmVmZXJlbmNlX3JlY3QgPSBudWxsO1xuXHRcdHZhciBhY3RpdmF0aW9uX21ldGhvZCA9ICdub25lJztcblx0XHR2YXIgZmFsbGJhY2tfcGxhY2VtZW50cyA9IG5vcm1hbGl6ZV9wbGFjZW1lbnRfbGlzdCggc2V0dGluZ3MuZmFsbGJhY2tfcGxhY2VtZW50cyApO1xuXHRcdHZhciBhbGxvd19mbGlwID0gZmFsc2UgIT09IHNldHRpbmdzLmFsbG93X2ZsaXA7XG5cdFx0dmFyIGdldF9pbml0aWFsX3BsYWNlbWVudF9ib3VuZHMgPSAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc2V0dGluZ3MuZ2V0X2luaXRpYWxfcGxhY2VtZW50X2JvdW5kc1xuXHRcdFx0PyBzZXR0aW5ncy5nZXRfaW5pdGlhbF9wbGFjZW1lbnRfYm91bmRzXG5cdFx0XHQ6IG51bGw7XG5cdFx0dmFyIHBvc2l0aW9uaW5nX2JvdW5kYXJ5ID0gbm9ybWFsaXplX3Bvc2l0aW9uaW5nX2JvdW5kYXJ5KCBzZXR0aW5ncy5wb3NpdGlvbmluZ19ib3VuZGFyeSApO1xuXHRcdHZhciBwcmV2ZW50X292ZXJmbG93ID0gZml0X29uX2ZpcnN0X29wZW4gfHwgZmFsc2UgIT09IHNldHRpbmdzLnByZXZlbnRfb3ZlcmZsb3c7XG5cdFx0dmFyIGluaXRpYWxfZml0X3BlbmRpbmcgPSBmYWxzZTtcblx0XHR2YXIgaW5pdGlhbF9maXRfY2FwdHVyZWQgPSBmYWxzZTtcblx0XHR2YXIgaW5pdGlhbF9maXRfYWRqdXN0bWVudCA9IHtcblx0XHRcdHg6IDAsXG5cdFx0XHR5OiAwXG5cdFx0fTtcblx0XHR2YXIgcGlubmVkX3ZpZXdwb3J0X3Bvc2l0aW9uID0gbnVsbDtcblx0XHR2YXIgcGlubmVkX3ZpZXdwb3J0X3NpemUgPSBudWxsO1xuXHRcdHZhciBhY3RpdmVfZHJhZyA9IG51bGw7XG5cdFx0dmFyIGFjdGl2ZV9yZXNpemUgPSBudWxsO1xuXHRcdHZhciBmbGlwX29wdGlvbnMgPSB7XG5cdFx0XHRib3VuZGFyeTogcG9zaXRpb25pbmdfYm91bmRhcnksXG5cdFx0XHRyb290Qm91bmRhcnk6ICd2aWV3cG9ydCcsXG5cdFx0XHRwYWRkaW5nOiA4XG5cdFx0fTtcblx0XHR2YXIgcG9wcGVyX21vZGlmaWVycyA9IFtcblx0XHRcdHtcblx0XHRcdFx0ZW5hYmxlZDogYWxsb3dfZmxpcCxcblx0XHRcdFx0bmFtZTogJ2ZsaXAnLFxuXHRcdFx0XHRvcHRpb25zOiBmbGlwX29wdGlvbnNcblx0XHRcdH1cblx0XHRdO1xuXHRcdHZhciBzaG93X2RlbGF5X21zID0gbm9ybWFsaXplX2RlbGF5KCBzZXR0aW5ncy5zaG93X2RlbGF5X21zLCAzNTAgKTtcblx0XHR2YXIgaGlkZV9kZWxheV9tcyA9IG5vcm1hbGl6ZV9kZWxheSggc2V0dGluZ3MuaGlkZV9kZWxheV9tcywgMTIwICk7XG5cdFx0dmFyIGV4dGVybmFsX3Njcm9sbF9ncmFjZV9tcyA9IG5vcm1hbGl6ZV9kZWxheSggc2V0dGluZ3MuZXh0ZXJuYWxfc2Nyb2xsX2dyYWNlX21zLCAyNTAgKTtcblx0XHR2YXIgbWF4aW11bV93aWR0aCA9IG5vcm1hbGl6ZV93aWR0aCggc2V0dGluZ3MubWF4aW11bV93aWR0aCwgNTUwLCAyNDAsIDc2MCApO1xuXHRcdHZhciBwcmVmZXJyZWRfd2lkdGggPSBub3JtYWxpemVfd2lkdGgoIHNldHRpbmdzLnByZWZlcnJlZF93aWR0aCwgJ2ludGVyYWN0aXZlJyA9PT0gbW9kZSA/IDQyMCA6IDM2MCwgMjQwLCBtYXhpbXVtX3dpZHRoICk7XG5cdFx0dmFyIGZpeGVkX3VucGlubmVkX2hlaWdodCA9IG5vcm1hbGl6ZV9sZW5ndGgoIHNldHRpbmdzLmZpeGVkX3VucGlubmVkX2hlaWdodCwgMCwgMCwgMTIwMCApO1xuXHRcdHZhciBib3VuZGFyeV9jcm9zc19heGlzID0gdHJ1ZSA9PT0gc2V0dGluZ3MuYm91bmRhcnlfY3Jvc3NfYXhpcztcblx0XHR2YXIgcHJldmVudF9vdmVyZmxvd19hbHRfYXhpcyA9IGJvdW5kYXJ5X2Nyb3NzX2F4aXMgJiYgISAoIGZpdF9vbl9maXJzdF9vcGVuICYmIDAgPCBmaXhlZF91bnBpbm5lZF9oZWlnaHQgKTtcblx0XHR2YXIgbWF4aW11bV9yZXNpemVkX3dpZHRoID0gcmVzaXphYmxlX3doZW5fcGlubmVkXG5cdFx0XHQ/IG5vcm1hbGl6ZV93aWR0aCggc2V0dGluZ3MubWF4aW11bV9yZXNpemVkX3dpZHRoLCBtYXhpbXVtX3dpZHRoLCBtYXhpbXVtX3dpZHRoLCAxNjAwIClcblx0XHRcdDogbWF4aW11bV93aWR0aDtcblx0XHR2YXIgbWluaW11bV9yZXNpemVkX3dpZHRoID0gTWF0aC5taW4oIG1heGltdW1fd2lkdGgsIDMyMCApO1xuXHRcdHZhciBtaW5pbXVtX3Jlc2l6ZWRfaGVpZ2h0ID0gMTgwO1xuXHRcdHZhciBsYXllcl96X2luZGV4ID0gbm9ybWFsaXplX2xheWVyX2luZGV4KFxuXHRcdFx0c2V0dGluZ3MubGF5ZXJfel9pbmRleCxcblx0XHRcdGdldF9sYXllcl90b2tlbiggJy0td3BiY19zaGFyZWRfdWlfX2NvbnRleHQtcG9wb3Zlci16LWluZGV4JywgMTAwMTEwIClcblx0XHQpO1xuXHRcdHZhciBoaWRlX2Fycm93X3doZW5fcGlubmVkID0gdHJ1ZSA9PT0gc2V0dGluZ3MuaGlkZV9hcnJvd193aGVuX3Bpbm5lZDtcblx0XHR2YXIgYm91bmRhcnlfdGV0aGVyID0gZmFsc2UgIT09IHNldHRpbmdzLmJvdW5kYXJ5X3RldGhlcjtcblx0XHR2YXIgcGVuZGluZ19zaG93X3RpbWVyID0gMDtcblx0XHR2YXIgcGVuZGluZ19jbG9zZV90aW1lciA9IDA7XG5cdFx0dmFyIHBlbmRpbmdfZm9jdXNfY2hlY2tfdGltZXIgPSAwO1xuXHRcdHZhciBwZW5kaW5nX2ZvY3VzX2VudHJ5X3RpbWVyID0gMDtcblx0XHR2YXIgc3VwcHJlc3NlZF9mb2N1c190aW1lciA9IDA7XG5cdFx0dmFyIHBlbmRpbmdfc3VyZmFjZV9jb25zdHJhaW50X2ZyYW1lID0gMDtcblx0XHR2YXIgcGVuZGluZ19wb2ludGVyX3RyaWdnZXIgPSBudWxsO1xuXHRcdHZhciBwZW5kaW5nX3BvaW50ZXJfaWQgPSBudWxsO1xuXHRcdHZhciBsYXRlc3RfcG9pbnRlcl9jb29yZGluYXRlcyA9IG51bGw7XG5cdFx0dmFyIHN1cHByZXNzZWRfZm9jdXNfdHJpZ2dlciA9IG51bGw7XG5cdFx0dmFyIHBvaW50ZXJfaW5zaWRlX2NvbXBvc2l0ZSA9IGZhbHNlO1xuXHRcdHZhciByZXRhaW5lZF9zY3JvbGxfdW50aWwgPSAwO1xuXHRcdHZhciBwaW5uZWQgPSBmYWxzZTtcblx0XHR2YXIgc3VzcGVuZGVkID0gZmFsc2U7XG5cdFx0dmFyIHN1c3BlbnNpb25fcmVhc29uID0gJyc7XG5cdFx0dmFyIGV4dGVybmFsX3N1c3BlbnNpb25faG9sZCA9IGZhbHNlO1xuXHRcdHZhciBhcHByb3ZlZF90aXBweV9oaWRlX3JlYXNvbiA9ICcnO1xuXHRcdHZhciBvd25zX3RyaWdnZXJfYXJpYSA9IHRydWUgPT09IHNldHRpbmdzLm93bnNfdHJpZ2dlcl9hcmlhO1xuXHRcdHZhciBvd25lZF90cmlnZ2VyX2FyaWEgPSBudWxsO1xuXHRcdHZhciBzdGF0ZSA9ICdpZGxlJztcblx0XHR2YXIgZGVzdHJveWVkID0gZmFsc2U7XG5cdFx0dmFyIHZpZXdwb3J0X3BhZGRpbmcgPSA4O1xuXHRcdHZhciBhdmFpbGFibGVfaGVpZ2h0X3Byb3BlcnR5ID0gJy0td3BiY19zaGFyZWRfdWlfY29udGV4dF9wb3BvdmVyX19hdmFpbGFibGUtaGVpZ2h0Jztcblx0XHR2YXIgYXZhaWxhYmxlX2lubGluZV9zaXplX3Byb3BlcnR5ID0gJy0td3BiY19zaGFyZWRfdWlfY29udGV4dF9wb3BvdmVyX19hdmFpbGFibGUtaW5saW5lLXNpemUnO1xuXHRcdHZhciBmaXhlZF91bnBpbm5lZF9oZWlnaHRfcHJvcGVydHkgPSAnLS13cGJjX3NoYXJlZF91aV9jb250ZXh0X3BvcG92ZXJfX2ZpeGVkLXVucGlubmVkLWhlaWdodCc7XG5cdFx0dmFyIHJlc2l6ZWRfd2lkdGhfcHJvcGVydHkgPSAnLS13cGJjX3NoYXJlZF91aV9jb250ZXh0X3BvcG92ZXJfX3Jlc2l6ZWQtd2lkdGgnO1xuXHRcdHZhciByZXNpemVkX2hlaWdodF9wcm9wZXJ0eSA9ICctLXdwYmNfc2hhcmVkX3VpX2NvbnRleHRfcG9wb3Zlcl9fcmVzaXplZC1oZWlnaHQnO1xuXHRcdHZhciBsb2FkaW5nO1xuXHRcdHZhciBsb2FkaW5nX2xhYmVsO1xuXHRcdHZhciBjb250ZW50O1xuXHRcdHZhciBlbXB0eTtcblx0XHR2YXIgZXJyb3I7XG5cdFx0dmFyIGVycm9yX21lc3NhZ2U7XG5cdFx0dmFyIHJldHJ5X2J1dHRvbjtcblx0XHR2YXIgcGluX2J1dHRvbjtcblx0XHR2YXIgcGluX2J1dHRvbl9sYWJlbDtcblx0XHR2YXIgZHJhZ19idXR0b247XG5cdFx0dmFyIHJlc2l6ZV9idXR0b247XG5cdFx0dmFyIHN0YXR1cztcblx0XHR2YXIgaGVhZGluZztcblx0XHR2YXIgaGVhZGVyX2NvbnRlbnQ7XG5cdFx0dmFyIGRlZmF1bHRfaGVhZGluZyA9ICcnO1xuXHRcdHZhciBjb250cm9sbGVyO1xuXG5cdFx0Lypcblx0XHQgKiBBIHNjcm9sbC1vd25lZCBwb3J0YWwgbWF5IGRlbGliZXJhdGVseSByZWx5IG9uIGl0cyBhbmNlc3RvcidzIG5hdGl2ZVxuXHRcdCAqIGNsaXBwaW5nIGluc3RlYWQgb2YgYmVpbmcgdHJhbnNsYXRlZCBiYWNrIGludG8gdGhlIFZpc3VhbCBWaWV3cG9ydC5cblx0XHQgKiBBbGwgZXhpc3RpbmcgY29uc3VtZXJzIHJldGFpbiBQb3BwZXIgb3ZlcmZsb3cgcHJldmVudGlvbiBieSBkZWZhdWx0LlxuXHRcdCAqL1xuXHRcdGlmICggcHJldmVudF9vdmVyZmxvdyApIHtcblx0XHRcdHBvcHBlcl9tb2RpZmllcnMucHVzaCgge1xuXHRcdFx0XHRuYW1lOiAncHJldmVudE92ZXJmbG93Jyxcblx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdC8qXG5cdFx0XHRcdFx0ICogRm9yIHRvcC9ib3R0b20gcGxhY2VtZW50cyBQb3BwZXIncyBtYWluQXhpcyBpcyBpbmxpbmUgYW5kIGl0c1xuXHRcdFx0XHRcdCAqIGFsdEF4aXMgaXMgdmVydGljYWwuIEFuIGFsdC1heGlzIGNvcnJlY3Rpb24gbWF5IHRoZXJlZm9yZSBtb3ZlXG5cdFx0XHRcdFx0ICogYW4gZXhhY3QtaGVpZ2h0IHN1cmZhY2UgYWNyb3NzIHRoZSByZWZlcmVuY2UgaXQgbXVzdCBwb2ludCB0by5cblx0XHRcdFx0XHQgKi9cblx0XHRcdFx0XHRtYWluQXhpczogdHJ1ZSxcblx0XHRcdFx0XHRhbHRBeGlzOiBwcmV2ZW50X292ZXJmbG93X2FsdF9heGlzLFxuXHRcdFx0XHRcdGJvdW5kYXJ5OiBwb3NpdGlvbmluZ19ib3VuZGFyeSxcblx0XHRcdFx0XHRyb290Qm91bmRhcnk6ICd2aWV3cG9ydCcsXG5cdFx0XHRcdFx0cGFkZGluZzogOCxcblx0XHRcdFx0XHR0ZXRoZXI6IGJvdW5kYXJ5X3RldGhlclxuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHBvcHBlcl9tb2RpZmllcnMucHVzaCgge1xuXHRcdFx0XHRlbmFibGVkOiBmYWxzZSxcblx0XHRcdFx0bmFtZTogJ3ByZXZlbnRPdmVyZmxvdydcblx0XHRcdH0gKTtcblx0XHR9XG5cdFx0aWYgKCBmaXRfb25fZmlyc3Rfb3BlbiApIHtcblx0XHRcdHBvcHBlcl9tb2RpZmllcnMucHVzaCgge1xuXHRcdFx0XHRuYW1lOiAnd3BiY0luaXRpYWxGaXQnLFxuXHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRwaGFzZTogJ21haW4nLFxuXHRcdFx0XHRyZXF1aXJlczogWyAncG9wcGVyT2Zmc2V0cycgXSxcblx0XHRcdFx0cmVxdWlyZXNJZkV4aXN0czogWyAncHJldmVudE92ZXJmbG93JyBdLFxuXHRcdFx0XHRmbjogYXBwbHlfaW5pdGlhbF9maXRfbW9kaWZpZXJcblx0XHRcdH0gKTtcblx0XHR9XG5cdFx0aWYgKCBwaW5fdG9fdmlld3BvcnQgKSB7XG5cdFx0XHRwb3BwZXJfbW9kaWZpZXJzLnB1c2goIHtcblx0XHRcdFx0bmFtZTogJ3dwYmNQaW5uZWRWaWV3cG9ydCcsXG5cdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdHBoYXNlOiAnYmVmb3JlV3JpdGUnLFxuXHRcdFx0XHRyZXF1aXJlczogWyAnY29tcHV0ZVN0eWxlcycgXSxcblx0XHRcdFx0Zm46IGFwcGx5X3Bpbm5lZF92aWV3cG9ydF9tb2RpZmllclxuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdGxheWVyX2Rlc2NyaXB0b3IgPSBub3JtYWxpemVfbGF5ZXJfZGVzY3JpcHRvcigge1xuXHRcdFx0bGF5ZXJfdHlwZTogJ2NvbnRleHRfcG9wb3ZlcicsXG5cdFx0XHRpbnN0YW5jZV9pZDogY29tcG9uZW50X2lkLFxuXHRcdFx0b3duZXJfaWQ6IG93bmVyX2lkLFxuXHRcdFx0aW50ZXJhY3Rpb25fZ3JvdXA6IGludGVyYWN0aW9uX2dyb3VwXG5cdFx0fSApO1xuXG5cdFx0aWYgKFxuXHRcdFx0ISBjb21wb25lbnRfaWRcblx0XHRcdHx8ICEgd3Bcblx0XHRcdHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiB3cC50ZW1wbGF0ZVxuXHRcdFx0fHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy53cGJjX3RpcHB5XG5cdFx0XHR8fCAhIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAndG1wbC13cGJjLXNoYXJlZC11aS1jb250ZXh0LXBvcG92ZXItc2hlbGwnIClcblx0XHRcdHx8IHJlZ2lzdGVyZWRfY29udHJvbGxlcnNbIGNvbXBvbmVudF9pZCBdXG5cdFx0XHR8fCBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggY29tcG9uZW50X2lkIClcblx0XHQpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRpZiAoIGFsbG93X2ZsaXAgJiYgZmFsbGJhY2tfcGxhY2VtZW50cy5sZW5ndGggKSB7XG5cdFx0XHRmbGlwX29wdGlvbnMuZmFsbGJhY2tQbGFjZW1lbnRzID0gZmFsbGJhY2tfcGxhY2VtZW50cztcblx0XHR9XG5cblx0XHRzaGVsbF90ZW1wbGF0ZSA9IHdwLnRlbXBsYXRlKCAnd3BiYy1zaGFyZWQtdWktY29udGV4dC1wb3BvdmVyLXNoZWxsJyApO1xuXHRcdHNoZWxsX3dyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHRcdHNoZWxsX3dyYXBwZXIuaW5uZXJIVE1MID0gc2hlbGxfdGVtcGxhdGUoIHtcblx0XHRcdGlkOiBjb21wb25lbnRfaWQsXG5cdFx0XHRtb2RlOiBtb2RlLFxuXHRcdFx0b3duZXJfaWQ6IG93bmVyX2lkLFxuXHRcdFx0aW50ZXJhY3Rpb25fZ3JvdXA6IGludGVyYWN0aW9uX2dyb3VwLFxuXHRcdFx0cGluX2VuYWJsZWQ6ICdtYW51YWwnID09PSBwaW5fcG9saWN5LFxuXHRcdFx0ZHJhZ19lbmFibGVkOiBkcmFnZ2FibGVfd2hlbl9waW5uZWQsXG5cdFx0XHRkcmFnX2xhYmVsOiBub3JtYWxpemVfdGV4dCggc2V0dGluZ3MuZHJhZ19sYWJlbCwgMTYwICksXG5cdFx0XHRyZXNpemVfZW5hYmxlZDogcmVzaXphYmxlX3doZW5fcGlubmVkLFxuXHRcdFx0cmVzaXplX2xhYmVsOiBub3JtYWxpemVfdGV4dCggc2V0dGluZ3MucmVzaXplX2xhYmVsLCAxNjAgKSxcblx0XHRcdHBpbl9sYWJlbDogbm9ybWFsaXplX3RleHQoIHNldHRpbmdzLnBpbl9sYWJlbCwgMTYwICksXG5cdFx0XHRwaW5uZWRfbGFiZWw6IG5vcm1hbGl6ZV90ZXh0KCBzZXR0aW5ncy5waW5uZWRfbGFiZWwsIDE2MCApLFxuXHRcdFx0dW5waW5fbGFiZWw6IG5vcm1hbGl6ZV90ZXh0KCBzZXR0aW5ncy51bnBpbl9sYWJlbCwgMTYwICksXG5cdFx0XHR0aXRsZTogbm9ybWFsaXplX3RleHQoIHNldHRpbmdzLnRpdGxlLCAyMDAgKSxcblx0XHRcdGNsb3NlX2xhYmVsOiBub3JtYWxpemVfdGV4dCggc2V0dGluZ3MuY2xvc2VfbGFiZWwsIDE2MCApLFxuXHRcdFx0bG9hZGluZ19sYWJlbDogbm9ybWFsaXplX3RleHQoIHNldHRpbmdzLmxvYWRpbmdfbGFiZWwsIDI0MCApLFxuXHRcdFx0ZW1wdHlfbGFiZWw6IG5vcm1hbGl6ZV90ZXh0KCBzZXR0aW5ncy5lbXB0eV9sYWJlbCwgNTAwICksXG5cdFx0XHRlcnJvcl9sYWJlbDogbm9ybWFsaXplX3RleHQoIHNldHRpbmdzLmVycm9yX2xhYmVsLCA1MDAgKSxcblx0XHRcdHJldHJ5X2xhYmVsOiBub3JtYWxpemVfdGV4dCggc2V0dGluZ3MucmV0cnlfbGFiZWwsIDE2MCApXG5cdFx0fSApLnRyaW0oKTtcblx0XHRzdXJmYWNlID0gc2hlbGxfd3JhcHBlci5maXJzdEVsZW1lbnRDaGlsZDtcblx0XHRpZiAoICEgc3VyZmFjZSApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRzdXJmYWNlLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjX3NoYXJlZF91aV9jb250ZXh0X3BvcG92ZXJfX3ByZWZlcnJlZC13aWR0aCcsIHByZWZlcnJlZF93aWR0aCArICdweCcgKTtcblx0XHRpZiAoIDAgPCBmaXhlZF91bnBpbm5lZF9oZWlnaHQgKSB7XG5cdFx0XHRzdXJmYWNlLnN0eWxlLnNldFByb3BlcnR5KCBmaXhlZF91bnBpbm5lZF9oZWlnaHRfcHJvcGVydHksIGZpeGVkX3VucGlubmVkX2hlaWdodCArICdweCcgKTtcblx0XHRcdHN1cmZhY2Uuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXNoYXJlZC11aS1jb250ZXh0LXBvcG92ZXItZml4ZWQtdW5waW5uZWQtaGVpZ2h0JywgJ3RydWUnICk7XG5cdFx0fVxuXHRcdGNvbnN0cmFpbl9zdXJmYWNlX3RvX3Bvc2l0aW9uaW5nX2JvdW5kYXJ5KCk7XG5cblx0XHRsb2FkaW5nID0gc3VyZmFjZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zaGFyZWQtdWktY29udGV4dC1wb3BvdmVyLWxvYWRpbmddJyApO1xuXHRcdGxvYWRpbmdfbGFiZWwgPSBzdXJmYWNlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNoYXJlZC11aS1jb250ZXh0LXBvcG92ZXItbG9hZGluZy1sYWJlbF0nICk7XG5cdFx0Y29udGVudCA9IHN1cmZhY2UucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2hhcmVkLXVpLWNvbnRleHQtcG9wb3Zlci1jb250ZW50XScgKTtcblx0XHRlbXB0eSA9IHN1cmZhY2UucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2hhcmVkLXVpLWNvbnRleHQtcG9wb3Zlci1lbXB0eV0nICk7XG5cdFx0ZXJyb3IgPSBzdXJmYWNlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNoYXJlZC11aS1jb250ZXh0LXBvcG92ZXItZXJyb3JdJyApO1xuXHRcdGVycm9yX21lc3NhZ2UgPSBlcnJvciA/IGVycm9yLnF1ZXJ5U2VsZWN0b3IoICdwJyApIDogbnVsbDtcblx0XHRyZXRyeV9idXR0b24gPSBzdXJmYWNlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNoYXJlZC11aS1jb250ZXh0LXBvcG92ZXItcmV0cnldJyApO1xuXHRcdHBpbl9idXR0b24gPSBzdXJmYWNlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNoYXJlZC11aS1jb250ZXh0LXBvcG92ZXItcGluXScgKTtcblx0XHRwaW5fYnV0dG9uX2xhYmVsID0gcGluX2J1dHRvbiA/IHBpbl9idXR0b24ucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2hhcmVkLXVpLWNvbnRleHQtcG9wb3Zlci1waW4tbGFiZWxdJyApIDogbnVsbDtcblx0XHRkcmFnX2J1dHRvbiA9IHN1cmZhY2UucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2hhcmVkLXVpLWNvbnRleHQtcG9wb3Zlci1kcmFnXScgKTtcblx0XHRyZXNpemVfYnV0dG9uID0gc3VyZmFjZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zaGFyZWQtdWktY29udGV4dC1wb3BvdmVyLXJlc2l6ZV0nICk7XG5cdFx0c3RhdHVzID0gc3VyZmFjZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zaGFyZWQtdWktY29udGV4dC1wb3BvdmVyLXN0YXR1c10nICk7XG5cdFx0aGVhZGluZyA9IHN1cmZhY2UucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2hhcmVkLXVpLWNvbnRleHQtcG9wb3Zlci1oZWFkaW5nXScgKTtcblx0XHRoZWFkZXJfY29udGVudCA9IHN1cmZhY2UucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2hhcmVkLXVpLWNvbnRleHQtcG9wb3Zlci1oZWFkZXItY29udGVudF0nICk7XG5cdFx0ZGVmYXVsdF9oZWFkaW5nID0gaGVhZGluZyA/IGhlYWRpbmcudGV4dENvbnRlbnQgOiAnJztcblx0XHRpZiAoXG5cdFx0XHQhIGxvYWRpbmdcblx0XHRcdHx8ICEgY29udGVudFxuXHRcdFx0fHwgISBlbXB0eVxuXHRcdFx0fHwgISBlcnJvclxuXHRcdFx0fHwgISByZXRyeV9idXR0b25cblx0XHRcdHx8ICEgc3RhdHVzXG5cdFx0XHR8fCAoICdtYW51YWwnID09PSBwaW5fcG9saWN5ICYmICggISBwaW5fYnV0dG9uIHx8ICEgcGluX2J1dHRvbl9sYWJlbCApIClcblx0XHRcdHx8ICggZHJhZ2dhYmxlX3doZW5fcGlubmVkICYmICEgZHJhZ19idXR0b24gKVxuXHRcdFx0fHwgKCByZXNpemFibGVfd2hlbl9waW5uZWQgJiYgISByZXNpemVfYnV0dG9uIClcblx0XHQpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHNlbnRpbmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3NwYW4nICk7XG5cdFx0c2VudGluZWwuY2xhc3NOYW1lID0gJ3dwYmNfc2hhcmVkX3VpX2NvbnRleHRfcG9wb3Zlcl9fc2VudGluZWwnO1xuXHRcdHNlbnRpbmVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1zaGFyZWQtdWktY29udGV4dC1wb3BvdmVyLXNlbnRpbmVsJywgY29tcG9uZW50X2lkICk7XG5cdFx0c2VudGluZWwuc2V0QXR0cmlidXRlKCAnYXJpYS1oaWRkZW4nLCAndHJ1ZScgKTtcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCBzZW50aW5lbCApO1xuXG5cdFx0LyoqXG5cdFx0ICogUmVzb2x2ZSB0aGUgY3VycmVudCB2aXJ0dWFsIHJlZmVyZW5jZSB3aXRob3V0IGFsdGVyaW5nIHRoZSB0cmlnZ2VyLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBDdXJyZW50IGZpbml0ZSByZWZlcmVuY2UgcmVjdGFuZ2xlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9yZWZlcmVuY2VfcmVjdCgpIHtcblx0XHRcdHZhciBjYW5kaWRhdGVfcmVjdCA9IG51bGw7XG5cdFx0XHR2YXIgbm9ybWFsaXplZF9yZWN0O1xuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjYW5kaWRhdGVfcmVjdCA9ICdmdW5jdGlvbicgPT09IHR5cGVvZiByZWZlcmVuY2VfcmVjdF9wcm92aWRlciA/IHJlZmVyZW5jZV9yZWN0X3Byb3ZpZGVyKCkgOiByZWZlcmVuY2VfcmVjdF9wcm92aWRlcjtcblx0XHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdFx0Y2FuZGlkYXRlX3JlY3QgPSBudWxsO1xuXHRcdFx0fVxuXHRcdFx0bm9ybWFsaXplZF9yZWN0ID0gbm9ybWFsaXplX3JlZmVyZW5jZV9yZWN0KCBjYW5kaWRhdGVfcmVjdCApO1xuXG5cdFx0XHRpZiAoIG5vcm1hbGl6ZWRfcmVjdCAmJiAoIHJlZmVyZW5jZV90cmFja3NfdHJpZ2dlciB8fCBpc19yZWZlcmVuY2VfcmVjdF9pbl92aWV3cG9ydCggbm9ybWFsaXplZF9yZWN0ICkgKSApIHtcblx0XHRcdFx0bGFzdF92YWxpZF9yZWZlcmVuY2VfcmVjdCA9IG5vcm1hbGl6ZWRfcmVjdDtcblx0XHRcdFx0cmV0dXJuIGxhc3RfdmFsaWRfcmVmZXJlbmNlX3JlY3Q7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdzdHJpY3RfbGl2ZV9vd25lcicgPT09IHJlZmVyZW5jZV9wb2xpY3kgKSB7XG5cdFx0XHRcdHJldHVybiBjcmVhdGVfdW5hdmFpbGFibGVfcmVmZXJlbmNlX3JlY3QoKTtcblx0XHRcdH1cblx0XHRcdGlmICggY3VycmVudF90cmlnZ2VyICYmIGN1cnJlbnRfdHJpZ2dlci5pc0Nvbm5lY3RlZCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgY3VycmVudF90cmlnZ2VyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCApIHtcblx0XHRcdFx0bm9ybWFsaXplZF9yZWN0ID0gbm9ybWFsaXplX3JlZmVyZW5jZV9yZWN0KCBjdXJyZW50X3RyaWdnZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkgKTtcblx0XHRcdFx0aWYgKCBub3JtYWxpemVkX3JlY3QgJiYgKCByZWZlcmVuY2VfdHJhY2tzX3RyaWdnZXIgfHwgaXNfcmVmZXJlbmNlX3JlY3RfaW5fdmlld3BvcnQoIG5vcm1hbGl6ZWRfcmVjdCApICkgKSB7XG5cdFx0XHRcdFx0bGFzdF92YWxpZF9yZWZlcmVuY2VfcmVjdCA9IG5vcm1hbGl6ZWRfcmVjdDtcblx0XHRcdFx0XHRyZXR1cm4gbGFzdF92YWxpZF9yZWZlcmVuY2VfcmVjdDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCBsYXN0X3ZhbGlkX3JlZmVyZW5jZV9yZWN0ICkge1xuXHRcdFx0XHRyZXR1cm4gbGFzdF92YWxpZF9yZWZlcmVuY2VfcmVjdDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGNyZWF0ZV92aWV3cG9ydF9jZW50ZXJfcmVmZXJlbmNlX3JlY3QoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBQcmVzZXJ2ZSBvbmx5IHRoZSBvdmVyZmxvdyBjb3JyZWN0aW9uIGNhbGN1bGF0ZWQgZm9yIHRoZSBjdXJyZW50IG9wZW4uXG5cdFx0ICpcblx0XHQgKiBQb3BwZXIgbWF5IGZpdCB0aGUgc3VyZmFjZSBpbnRvIHRoZSB2aXNpYmxlIGJvdW5kYXJ5IG9uY2UsIGJ1dCBsYXRlclxuXHRcdCAqIHNjcm9sbCB1cGRhdGVzIG11c3QgcmV0YWluIHRoYXQgZmlyc3QgY29ycmVjdGlvbiBzbyBhIHNjcm9sbC1vd25lZFxuXHRcdCAqIHBvcnRhbCBjb250aW51ZXMgdG8gbW92ZSBhbmQgY2xpcCB3aXRoIGl0cyBjYW52YXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gbW9kaWZpZXJfYXJndW1lbnRzIFBvcHBlciBtb2RpZmllciBzdGF0ZSB3cmFwcGVyLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYXBwbHlfaW5pdGlhbF9maXRfbW9kaWZpZXIoIG1vZGlmaWVyX2FyZ3VtZW50cyApIHtcblx0XHRcdHZhciBtb2RpZmllcl9kYXRhO1xuXHRcdFx0dmFyIGN1cnJlbnRfeDtcblx0XHRcdHZhciBjdXJyZW50X3k7XG5cblx0XHRcdGlmIChcblx0XHRcdFx0ISBmaXRfb25fZmlyc3Rfb3BlblxuXHRcdFx0XHR8fCBwaW5uZWRcblx0XHRcdFx0fHwgISBtb2RpZmllcl9hcmd1bWVudHNcblx0XHRcdFx0fHwgISBtb2RpZmllcl9hcmd1bWVudHMuc3RhdGVcblx0XHRcdFx0fHwgISBtb2RpZmllcl9hcmd1bWVudHMuc3RhdGUubW9kaWZpZXJzRGF0YVxuXHRcdFx0XHR8fCAhIG1vZGlmaWVyX2FyZ3VtZW50cy5zdGF0ZS5tb2RpZmllcnNEYXRhLnBvcHBlck9mZnNldHNcblx0XHRcdFx0fHwgKCAhIGluaXRpYWxfZml0X3BlbmRpbmcgJiYgISBpbml0aWFsX2ZpdF9jYXB0dXJlZCApXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bW9kaWZpZXJfZGF0YSA9IG1vZGlmaWVyX2FyZ3VtZW50cy5zdGF0ZS5tb2RpZmllcnNEYXRhLnByZXZlbnRPdmVyZmxvdyB8fCB7fTtcblx0XHRcdGN1cnJlbnRfeCA9IE51bWJlci5pc0Zpbml0ZSggbW9kaWZpZXJfZGF0YS54ICkgPyBtb2RpZmllcl9kYXRhLnggOiAwO1xuXHRcdFx0Y3VycmVudF95ID0gTnVtYmVyLmlzRmluaXRlKCBtb2RpZmllcl9kYXRhLnkgKSA/IG1vZGlmaWVyX2RhdGEueSA6IDA7XG5cdFx0XHRpZiAoIGluaXRpYWxfZml0X3BlbmRpbmcgfHwgISBpbml0aWFsX2ZpdF9jYXB0dXJlZCApIHtcblx0XHRcdFx0aW5pdGlhbF9maXRfYWRqdXN0bWVudCA9IHtcblx0XHRcdFx0XHR4OiBjdXJyZW50X3gsXG5cdFx0XHRcdFx0eTogY3VycmVudF95XG5cdFx0XHRcdH07XG5cdFx0XHRcdGluaXRpYWxfZml0X3BlbmRpbmcgPSBmYWxzZTtcblx0XHRcdFx0aW5pdGlhbF9maXRfY2FwdHVyZWQgPSB0cnVlO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRtb2RpZmllcl9hcmd1bWVudHMuc3RhdGUubW9kaWZpZXJzRGF0YS5wb3BwZXJPZmZzZXRzLnggKz0gaW5pdGlhbF9maXRfYWRqdXN0bWVudC54IC0gY3VycmVudF94O1xuXHRcdFx0bW9kaWZpZXJfYXJndW1lbnRzLnN0YXRlLm1vZGlmaWVyc0RhdGEucG9wcGVyT2Zmc2V0cy55ICs9IGluaXRpYWxfZml0X2FkanVzdG1lbnQueSAtIGN1cnJlbnRfeTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gdGhlIGN1cnJlbnQgVmlzdWFsIFZpZXdwb3J0IHJlY3RhbmdsZSBpbiBsYXlvdXQgY29vcmRpbmF0ZXMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IEZpbml0ZSBsZWZ0LCB0b3AsIHJpZ2h0LCBib3R0b20sIHdpZHRoLCBhbmQgaGVpZ2h0LlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF92aXN1YWxfdmlld3BvcnRfYm91bmRzKCkge1xuXHRcdFx0dmFyIHZpc3VhbF92aWV3cG9ydCA9IHdpbmRvdy52aXN1YWxWaWV3cG9ydDtcblx0XHRcdHZhciBsZWZ0ID0gdmlzdWFsX3ZpZXdwb3J0ICYmIE51bWJlci5pc0Zpbml0ZSggdmlzdWFsX3ZpZXdwb3J0Lm9mZnNldExlZnQgKSA/IHZpc3VhbF92aWV3cG9ydC5vZmZzZXRMZWZ0IDogMDtcblx0XHRcdHZhciB0b3AgPSB2aXN1YWxfdmlld3BvcnQgJiYgTnVtYmVyLmlzRmluaXRlKCB2aXN1YWxfdmlld3BvcnQub2Zmc2V0VG9wICkgPyB2aXN1YWxfdmlld3BvcnQub2Zmc2V0VG9wIDogMDtcblx0XHRcdHZhciB3aWR0aCA9IHZpc3VhbF92aWV3cG9ydCAmJiBOdW1iZXIuaXNGaW5pdGUoIHZpc3VhbF92aWV3cG9ydC53aWR0aCApXG5cdFx0XHRcdD8gdmlzdWFsX3ZpZXdwb3J0LndpZHRoXG5cdFx0XHRcdDogTWF0aC5tYXgoIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aCB8fCAwLCB3aW5kb3cuaW5uZXJXaWR0aCB8fCAwICk7XG5cdFx0XHR2YXIgaGVpZ2h0ID0gdmlzdWFsX3ZpZXdwb3J0ICYmIE51bWJlci5pc0Zpbml0ZSggdmlzdWFsX3ZpZXdwb3J0LmhlaWdodCApXG5cdFx0XHRcdD8gdmlzdWFsX3ZpZXdwb3J0LmhlaWdodFxuXHRcdFx0XHQ6IE1hdGgubWF4KCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50SGVpZ2h0IHx8IDAsIHdpbmRvdy5pbm5lckhlaWdodCB8fCAwICk7XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGxlZnQ6IGxlZnQsXG5cdFx0XHRcdHRvcDogdG9wLFxuXHRcdFx0XHRyaWdodDogbGVmdCArIHdpZHRoLFxuXHRcdFx0XHRib3R0b206IHRvcCArIGhlaWdodCxcblx0XHRcdFx0d2lkdGg6IHdpZHRoLFxuXHRcdFx0XHRoZWlnaHQ6IGhlaWdodFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBLZWVwIGEgcGlubmVkIHN1cmZhY2UgcmVhY2hhYmxlIGluc2lkZSB0aGUgY3VycmVudCBWaXN1YWwgVmlld3BvcnQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gbGVmdCBSZXF1ZXN0ZWQgdmlld3BvcnQtcmVsYXRpdmUgbGVmdCBjb29yZGluYXRlLlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSB0b3AgIFJlcXVlc3RlZCB2aWV3cG9ydC1yZWxhdGl2ZSB0b3AgY29vcmRpbmF0ZS5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IENsYW1wZWQgbGVmdCBhbmQgdG9wIGNvb3JkaW5hdGVzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNsYW1wX3Bpbm5lZF92aWV3cG9ydF9wb3NpdGlvbiggbGVmdCwgdG9wICkge1xuXHRcdFx0dmFyIHZpZXdwb3J0X2JvdW5kcyA9IGdldF92aXN1YWxfdmlld3BvcnRfYm91bmRzKCk7XG5cdFx0XHR2YXIgc3VyZmFjZV9yZWN0ID0gc3VyZmFjZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdHZhciBzdXJmYWNlX3dpZHRoID0gTWF0aC5tYXgoIDEsIHN1cmZhY2VfcmVjdC53aWR0aCB8fCBwcmVmZXJyZWRfd2lkdGggKTtcblx0XHRcdHZhciBzdXJmYWNlX2hlaWdodCA9IE1hdGgubWF4KCAxLCBzdXJmYWNlX3JlY3QuaGVpZ2h0IHx8IDEgKTtcblx0XHRcdHZhciBtaW5pbXVtX2xlZnQgPSB2aWV3cG9ydF9ib3VuZHMubGVmdCArIHZpZXdwb3J0X3BhZGRpbmc7XG5cdFx0XHR2YXIgbWluaW11bV90b3AgPSB2aWV3cG9ydF9ib3VuZHMudG9wICsgdmlld3BvcnRfcGFkZGluZztcblx0XHRcdHZhciBtYXhpbXVtX2xlZnQgPSBNYXRoLm1heCggbWluaW11bV9sZWZ0LCB2aWV3cG9ydF9ib3VuZHMucmlnaHQgLSB2aWV3cG9ydF9wYWRkaW5nIC0gc3VyZmFjZV93aWR0aCApO1xuXHRcdFx0dmFyIG1heGltdW1fdG9wID0gTWF0aC5tYXgoIG1pbmltdW1fdG9wLCB2aWV3cG9ydF9ib3VuZHMuYm90dG9tIC0gdmlld3BvcnRfcGFkZGluZyAtIHN1cmZhY2VfaGVpZ2h0ICk7XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGxlZnQ6IE1hdGgubWluKCBtYXhpbXVtX2xlZnQsIE1hdGgubWF4KCBtaW5pbXVtX2xlZnQsIE51bWJlci5pc0Zpbml0ZSggbGVmdCApID8gbGVmdCA6IG1pbmltdW1fbGVmdCApICksXG5cdFx0XHRcdHRvcDogTWF0aC5taW4oIG1heGltdW1fdG9wLCBNYXRoLm1heCggbWluaW11bV90b3AsIE51bWJlci5pc0Zpbml0ZSggdG9wICkgPyB0b3AgOiBtaW5pbXVtX3RvcCApIClcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogT3ZlcnJpZGUgUG9wcGVyIG91dHB1dCBvbmx5IHdoaWxlIHRoZSBvcHRlZC1pbiBzdXJmYWNlIGlzIHZpZXdwb3J0IHBpbm5lZC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBtb2RpZmllcl9hcmd1bWVudHMgUG9wcGVyIG1vZGlmaWVyIHN0YXRlIHdyYXBwZXIuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBhcHBseV9waW5uZWRfdmlld3BvcnRfbW9kaWZpZXIoIG1vZGlmaWVyX2FyZ3VtZW50cyApIHtcblx0XHRcdHZhciBwb3BwZXJfc3R5bGVzO1xuXG5cdFx0XHRpZiAoICEgcGlubmVkIHx8ICEgcGlubmVkX3ZpZXdwb3J0X3Bvc2l0aW9uIHx8ICEgbW9kaWZpZXJfYXJndW1lbnRzIHx8ICEgbW9kaWZpZXJfYXJndW1lbnRzLnN0YXRlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRwb3BwZXJfc3R5bGVzID0gbW9kaWZpZXJfYXJndW1lbnRzLnN0YXRlLnN0eWxlcy5wb3BwZXIgfHwge307XG5cdFx0XHRwb3BwZXJfc3R5bGVzLnBvc2l0aW9uID0gJ2ZpeGVkJztcblx0XHRcdHBvcHBlcl9zdHlsZXMubGVmdCA9ICcwJztcblx0XHRcdHBvcHBlcl9zdHlsZXMudG9wID0gJzAnO1xuXHRcdFx0cG9wcGVyX3N0eWxlcy5yaWdodCA9ICdhdXRvJztcblx0XHRcdHBvcHBlcl9zdHlsZXMuYm90dG9tID0gJ2F1dG8nO1xuXHRcdFx0cG9wcGVyX3N0eWxlcy50cmFuc2Zvcm0gPSAndHJhbnNsYXRlM2QoJyArIHBpbm5lZF92aWV3cG9ydF9wb3NpdGlvbi5sZWZ0ICsgJ3B4LCAnICsgcGlubmVkX3ZpZXdwb3J0X3Bvc2l0aW9uLnRvcCArICdweCwgMCknO1xuXHRcdFx0bW9kaWZpZXJfYXJndW1lbnRzLnN0YXRlLnN0eWxlcy5wb3BwZXIgPSBwb3BwZXJfc3R5bGVzO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlY3JlYXRlIFBvcHBlciBnZW9tZXRyeSBhZnRlciBtb3ZpbmcgYmV0d2VlbiBjYW52YXMgYW5kIHZpZXdwb3J0IHBvcnRhbHMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGFwcGx5X3Bvc2l0aW9uaW5nX21vZGUoKSB7XG5cdFx0XHR2YXIgYWN0aXZlX3BvcnRhbF9ob3N0O1xuXHRcdFx0dmFyIGFjdGl2ZV9wb3NpdGlvbmluZ19zdHJhdGVneTtcblxuXHRcdFx0aWYgKCAhIHRpcHB5X2luc3RhbmNlIHx8ICEgdGlwcHlfaW5zdGFuY2UucG9wcGVyICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRhY3RpdmVfcG9ydGFsX2hvc3QgPSBwaW5uZWQgJiYgcGluX3RvX3ZpZXdwb3J0ID8gcGlubmVkX3BvcnRhbF9ob3N0IDogcG9ydGFsX2hvc3Q7XG5cdFx0XHRhY3RpdmVfcG9zaXRpb25pbmdfc3RyYXRlZ3kgPSBwaW5uZWQgJiYgcGluX3RvX3ZpZXdwb3J0ID8gJ2ZpeGVkJyA6IHBvc2l0aW9uaW5nX3N0cmF0ZWd5O1xuXHRcdFx0dGlwcHlfaW5zdGFuY2Uuc2V0UHJvcHMoIHtcblx0XHRcdFx0YXBwZW5kVG86IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRyZXR1cm4gYWN0aXZlX3BvcnRhbF9ob3N0O1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRtYXhXaWR0aDogcGlubmVkICYmIHJlc2l6YWJsZV93aGVuX3Bpbm5lZCA/IG1heGltdW1fcmVzaXplZF93aWR0aCA6IG1heGltdW1fd2lkdGgsXG5cdFx0XHRcdHBvcHBlck9wdGlvbnM6IHtcblx0XHRcdFx0XHRzdHJhdGVneTogYWN0aXZlX3Bvc2l0aW9uaW5nX3N0cmF0ZWd5LFxuXHRcdFx0XHRcdG1vZGlmaWVyczogcG9wcGVyX21vZGlmaWVyc1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIHRpcHB5X2luc3RhbmNlLnBvcHBlci5wYXJlbnROb2RlICE9PSBhY3RpdmVfcG9ydGFsX2hvc3QgKSB7XG5cdFx0XHRcdGFjdGl2ZV9wb3J0YWxfaG9zdC5hcHBlbmRDaGlsZCggdGlwcHlfaW5zdGFuY2UucG9wcGVyICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRpcHB5X2luc3RhbmNlLnBvcHBlckluc3RhbmNlICkge1xuXHRcdFx0XHR0aXBweV9pbnN0YW5jZS5wb3BwZXJJbnN0YW5jZS5mb3JjZVVwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENyZWF0ZSB0aGUgbGl2ZSByZWZlcmVuY2UgcHJvdmlkZXIgY29uZmlndXJlZCBmb3Igb25lIGRvbWFpbiB0cmlnZ2VyLlxuXHRcdCAqXG5cdFx0ICogRG9tYWlucyBtYXkgY29uc3RyYWluIHZpc2liaWxpdHkgdGhyb3VnaCBgZ2V0X3JlZmVyZW5jZV9yZWN0YDsgZXhpc3Rpbmdcblx0XHQgKiBjb25zdW1lcnMgY29udGludWUgdG8gdXNlIHRoZSBuYXRpdmUgdHJpZ2dlciByZWN0YW5nbGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSB0cmlnZ2VyIENvbm5lY3RlZCBkb21haW4gdHJpZ2dlci5cblx0XHQgKiBAcmV0dXJuIHtGdW5jdGlvbn0gTGl2ZSBET01SZWN0LWxpa2UgcHJvdmlkZXIuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY3JlYXRlX3RyaWdnZXJfcmVmZXJlbmNlX3Byb3ZpZGVyKCB0cmlnZ2VyICkge1xuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc2V0dGluZ3MuZ2V0X3JlZmVyZW5jZV9yZWN0ICkge1xuXHRcdFx0XHRcdHJldHVybiBzZXR0aW5ncy5nZXRfcmVmZXJlbmNlX3JlY3QoIHRyaWdnZXIgKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB0cmlnZ2VyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXNvbHZlIGFuZCB2YWxpZGF0ZSBhbiBleHBsaWNpdCB2aXJ0dWFsLXJlZmVyZW5jZSBwcm92aWRlciBiZWZvcmUgc2hvdy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufG51bGx9IHJlZmVyZW5jZV9yZWN0ICAgICAgICAgRE9NUmVjdC1saWtlIHZhbHVlIG9yIGdldHRlci5cblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59ICAgICAgICAgICAgICBhbGxvd19vdXRzaWRlX3ZpZXdwb3J0IFdoZXRoZXIgYSByZXRhaW5lZCB2aWV3cG9ydCBwaW4gbWF5IHVzZSBhbiBvZmYtc2NyZWVuIG93bmVyLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBWaXNpYmxlIG5vcm1hbGl6ZWQgcmVjdGFuZ2xlIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVzb2x2ZV9vcGVuX3JlZmVyZW5jZV9yZWN0KCByZWZlcmVuY2VfcmVjdCwgYWxsb3dfb3V0c2lkZV92aWV3cG9ydCApIHtcblx0XHRcdHZhciBjYW5kaWRhdGVfcmVjdCA9IG51bGw7XG5cdFx0XHR2YXIgbm9ybWFsaXplZF9yZWN0O1xuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjYW5kaWRhdGVfcmVjdCA9ICdmdW5jdGlvbicgPT09IHR5cGVvZiByZWZlcmVuY2VfcmVjdCA/IHJlZmVyZW5jZV9yZWN0KCkgOiByZWZlcmVuY2VfcmVjdDtcblx0XHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdFx0Y2FuZGlkYXRlX3JlY3QgPSBudWxsO1xuXHRcdFx0fVxuXHRcdFx0bm9ybWFsaXplZF9yZWN0ID0gbm9ybWFsaXplX3JlZmVyZW5jZV9yZWN0KCBjYW5kaWRhdGVfcmVjdCApO1xuXG5cdFx0XHRyZXR1cm4gbm9ybWFsaXplZF9yZWN0ICYmICggYWxsb3dfb3V0c2lkZV92aWV3cG9ydCB8fCBpc19yZWZlcmVuY2VfcmVjdF9pbl92aWV3cG9ydCggbm9ybWFsaXplZF9yZWN0ICkgKVxuXHRcdFx0XHQ/IG5vcm1hbGl6ZWRfcmVjdFxuXHRcdFx0XHQ6IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVtb3ZlIHRoZSBwZW5kaW5nIHBvaW50ZXIgYWN0aXZhdGlvbiB0aW1lciBhbmQgaXRzIHRlbXBvcmFyeSBsaXN0ZW5lcnMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNhbmNlbF9wZW5kaW5nX29wZW4oKSB7XG5cdFx0XHRpZiAoIHBlbmRpbmdfc2hvd190aW1lciApIHtcblx0XHRcdFx0d2luZG93LmNsZWFyVGltZW91dCggcGVuZGluZ19zaG93X3RpbWVyICk7XG5cdFx0XHRcdHBlbmRpbmdfc2hvd190aW1lciA9IDA7XG5cdFx0XHR9XG5cdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCAncG9pbnRlcm1vdmUnLCBjYXB0dXJlX3BlbmRpbmdfcG9pbnRlciwgdHJ1ZSApO1xuXHRcdFx0aWYgKCBwZW5kaW5nX3BvaW50ZXJfdHJpZ2dlciApIHtcblx0XHRcdFx0cGVuZGluZ19wb2ludGVyX3RyaWdnZXIucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJsZWF2ZScsIGNhbmNlbF9wZW5kaW5nX29wZW4gKTtcblx0XHRcdH1cblx0XHRcdHBlbmRpbmdfcG9pbnRlcl90cmlnZ2VyID0gbnVsbDtcblx0XHRcdHBlbmRpbmdfcG9pbnRlcl9pZCA9IG51bGw7XG5cdFx0XHRsYXRlc3RfcG9pbnRlcl9jb29yZGluYXRlcyA9IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVtZW1iZXIgcG9pbnRlciBtb3ZlbWVudCBvbmx5IHdoaWxlIGEgZGVsYXllZCBhY3RpdmF0aW9uIGlzIHBlbmRpbmcuXG5cdFx0ICpcblx0XHQgKiBUaGUgbGFzdCBjb29yZGluYXRlcyBhcmUgZnJvemVuIHdoZW4gdGhlIGRlbGF5IGNvbXBsZXRlcy4gTm8gbGlzdGVuZXJcblx0XHQgKiByZW1haW5zIGFmdGVyIG9wZW5pbmcsIHNvIHRoZSB2aXNpYmxlIHN1cmZhY2UgbmV2ZXIgZm9sbG93cyB0aGUgY3Vyc29yLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtQb2ludGVyRXZlbnR9IGV2ZW50IFBvaW50ZXIgbW92ZW1lbnQgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjYXB0dXJlX3BlbmRpbmdfcG9pbnRlciggZXZlbnQgKSB7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdG51bGwgIT09IHBlbmRpbmdfcG9pbnRlcl9pZFxuXHRcdFx0XHQmJiBldmVudC5wb2ludGVySWQgIT09IHBlbmRpbmdfcG9pbnRlcl9pZFxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggTnVtYmVyLmlzRmluaXRlKCBldmVudC5jbGllbnRYICkgJiYgTnVtYmVyLmlzRmluaXRlKCBldmVudC5jbGllbnRZICkgKSB7XG5cdFx0XHRcdGxhdGVzdF9wb2ludGVyX2Nvb3JkaW5hdGVzID0ge1xuXHRcdFx0XHRcdHg6IGV2ZW50LmNsaWVudFgsXG5cdFx0XHRcdFx0eTogZXZlbnQuY2xpZW50WVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc29sdmUgYW4gZXZlbnQgb3IgZm9jdXMgbm9kZSB0byBhbiBFbGVtZW50IHdoZW4gcG9zc2libGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge05vZGV8bnVsbH0gY2FuZGlkYXRlIENhbmRpZGF0ZSBET00gbm9kZS5cblx0XHQgKiBAcmV0dXJuIHtFbGVtZW50fG51bGx9IEVsZW1lbnQgY2FuZGlkYXRlIG9yIGl0cyBwYXJlbnQgRWxlbWVudC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfZWxlbWVudCggY2FuZGlkYXRlICkge1xuXHRcdFx0aWYgKCAhIGNhbmRpZGF0ZSApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIDEgPT09IGNhbmRpZGF0ZS5ub2RlVHlwZSApIHtcblx0XHRcdFx0cmV0dXJuIGNhbmRpZGF0ZTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGNhbmRpZGF0ZS5wYXJlbnRFbGVtZW50IHx8IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRGV0ZXJtaW5lIHdoZXRoZXIgYSBub2RlIGJlbG9uZ3MgZGlyZWN0bHkgdG8gdGhpcyBwb3BvdmVyIHN1cmZhY2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge05vZGV8bnVsbH0gY2FuZGlkYXRlIENhbmRpZGF0ZSBwb2ludGVyLCBmb2N1cywgb3Igc2Nyb2xsIG5vZGUuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSBmb3IgdGhlIHN1cmZhY2Ugb3IgYW4gZXhwbGljaXRseSBvd25lZCBwb3J0YWwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaXNfZGlyZWN0X3BvcG92ZXJfb3duZWRfbm9kZSggY2FuZGlkYXRlICkge1xuXHRcdFx0dmFyIGNhbmRpZGF0ZV9lbGVtZW50ID0gZ2V0X2VsZW1lbnQoIGNhbmRpZGF0ZSApO1xuXHRcdFx0dmFyIG93bmVyX3NlbGVjdG9yID0gJ1tkYXRhLXdwYmMtc2hhcmVkLXVpLWNvbnRleHQtcG9wb3Zlci1vd25lcj1cIicgKyBjb21wb25lbnRfaWQgKyAnXCJdJztcblxuXHRcdFx0aWYgKCAhIGNhbmRpZGF0ZV9lbGVtZW50ICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHN1cmZhY2UgPT09IGNhbmRpZGF0ZV9lbGVtZW50IHx8IHN1cmZhY2UuY29udGFpbnMoIGNhbmRpZGF0ZV9lbGVtZW50ICkgKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gQm9vbGVhbiggY2FuZGlkYXRlX2VsZW1lbnQuY2xvc2VzdCggb3duZXJfc2VsZWN0b3IgKSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlY29nbml6ZSBhIGZvcmVpZ24gVGlwcHkgcG9ydGFsIHdob3NlIHJlZmVyZW5jZSBiZWxvbmdzIHRvIHRoaXMgc3VyZmFjZS5cblx0XHQgKlxuXHRcdCAqIFRoZSBjb250cm9sbGVyIHJlYWRzIFRpcHB5J3MgcHVibGljIGluc3RhbmNlIHJlbGF0aW9uc2hpcCBvbmx5LiBJdCBuZXZlclxuXHRcdCAqIGhpZGVzLCBkZXN0cm95cywgcmVjb25maWd1cmVzLCBvciByZXBsYWNlcyB0aGUgY2hpbGQgaW5zdGFuY2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge05vZGV8bnVsbH0gY2FuZGlkYXRlIENhbmRpZGF0ZSBub2RlIGluc2lkZSBhIFRpcHB5IHBvcHBlci5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIFRpcHB5IHJlZmVyZW5jZSBpcyBkaXJlY3RseSBvd25lZCBoZXJlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGlzX293bmVkX2NoaWxkX3RpcHB5X25vZGUoIGNhbmRpZGF0ZSApIHtcblx0XHRcdHZhciBjYW5kaWRhdGVfZWxlbWVudCA9IGdldF9lbGVtZW50KCBjYW5kaWRhdGUgKTtcblx0XHRcdHZhciB0aXBweV9yb290O1xuXHRcdFx0dmFyIGNoaWxkX3RpcHB5O1xuXG5cdFx0XHRpZiAoICEgY2FuZGlkYXRlX2VsZW1lbnQgfHwgISBjYW5kaWRhdGVfZWxlbWVudC5jbG9zZXN0ICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHR0aXBweV9yb290ID0gY2FuZGlkYXRlX2VsZW1lbnQuY2xvc2VzdCggJ1tkYXRhLXRpcHB5LXJvb3RdJyApO1xuXHRcdFx0Y2hpbGRfdGlwcHkgPSB0aXBweV9yb290ICYmIHRpcHB5X3Jvb3QuX3RpcHB5O1xuXHRcdFx0aWYgKCAhIGNoaWxkX3RpcHB5IHx8ICEgY2hpbGRfdGlwcHkucmVmZXJlbmNlICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBpc19kaXJlY3RfcG9wb3Zlcl9vd25lZF9ub2RlKCBjaGlsZF90aXBweS5yZWZlcmVuY2UgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBEZXRlcm1pbmUgd2hldGhlciBhIG5vZGUgYmVsb25ncyB0byB0aGUgc3VyZmFjZSBvciBhIHBvcnRhbGVkIG93bmVkIGNoaWxkLlxuXHRcdCAqXG5cdFx0ICogT3duZWQgZXh0ZXJuYWwgc3VyZmFjZXMgbXVzdCBjYXJyeSB0aGUgY29udHJvbGxlcidzIHN0YWJsZSBpbnN0YW5jZSBJRC5cblx0XHQgKiBUaGlzIHJlbGF0aW9uc2hpcCBpcyBpbnRlcmFjdGlvbiBtZXRhZGF0YSwgbm90IGF1dGhvcml6YXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge05vZGV8bnVsbH0gY2FuZGlkYXRlIENhbmRpZGF0ZSBwb2ludGVyLCBmb2N1cywgb3Igc2Nyb2xsIG5vZGUuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBub2RlIGJlbG9uZ3MgdG8gdGhpcyBwb3BvdmVyIHN1cmZhY2UuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaXNfcG9wb3Zlcl9vd25lZF9ub2RlKCBjYW5kaWRhdGUgKSB7XG5cdFx0XHRyZXR1cm4gaXNfZGlyZWN0X3BvcG92ZXJfb3duZWRfbm9kZSggY2FuZGlkYXRlICkgfHwgaXNfb3duZWRfY2hpbGRfdGlwcHlfbm9kZSggY2FuZGlkYXRlICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRGV0ZXJtaW5lIHdoZXRoZXIgYW4gZXZlbnQgdGFyZ2V0IGJlbG9uZ3MgdG8gYSBjbGlwcGVkLXRpdGxlIHRvb2x0aXAuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge05vZGV8bnVsbH0gY2FuZGlkYXRlIENhbmRpZGF0ZSBldmVudCB0YXJnZXQuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBjYXRhbG9nIG92ZXJmbG93LXRvb2x0aXAgb3duZXIgYXBwbGllcy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpc19jbGlwcGVkX3RpdGxlX3Rvb2x0aXBfdGFyZ2V0KCBjYW5kaWRhdGUgKSB7XG5cdFx0XHR2YXIgY2FuZGlkYXRlX2VsZW1lbnQgPSBnZXRfZWxlbWVudCggY2FuZGlkYXRlICk7XG5cblx0XHRcdHJldHVybiBCb29sZWFuKCBjYW5kaWRhdGVfZWxlbWVudCAmJiBjYW5kaWRhdGVfZWxlbWVudC5jbG9zZXN0ICYmIGNhbmRpZGF0ZV9lbGVtZW50LmNsb3Nlc3QoIGNsaXBwZWRfdGl0bGVfdG9vbHRpcF9zZWxlY3RvciApICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogVmVyaWZ5IHRoYXQgYSBkb21haW4gdHJpZ2dlciBkb2VzIG5vdCBhbHJlYWR5IGJlbG9uZyB0byBhbm90aGVyIG93bmVyLlxuXHRcdCAqXG5cdFx0ICogU3RhbmRhcmQgdG9vbHRpcCB0YXJnZXRzIG1heSBiZSBvcHRlZCBpbnRvIENvbnRleHQgUG9wb3ZlciBwcmlvcml0eSBieVxuXHRcdCAqIHRoZSBkb21haW4uIExlZ2FjeSBjbGljayBwb3BvdmVycyBhbmQgcmVnaXN0ZXJlZCBzaGFyZWQgb3duZXJzIGFyZSBuZXZlclxuXHRcdCAqIGNsYWltZWQgYnkgdGhpcyBjb250cm9sbGVyLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSB0cmlnZ2VyIENhbmRpZGF0ZSBkb21haW4gdHJpZ2dlci5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gQ29udGV4dCBQb3BvdmVyIG1heSB1c2UgdGhlIHRyaWdnZXIuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2FuX3VzZV90cmlnZ2VyKCB0cmlnZ2VyICkge1xuXHRcdFx0aWYgKCAhIHRyaWdnZXIgfHwgMSAhPT0gdHJpZ2dlci5ub2RlVHlwZSB8fCAhIHRyaWdnZXIuY2xvc2VzdCApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0cmlnZ2VyLmNsb3Nlc3QoIGxlZ2FjeV9wb3BvdmVyX3NlbGVjdG9yICkgfHwgdHJpZ2dlci5jbG9zZXN0KCByZXNlcnZlZF9vd25lcl9zZWxlY3RvciApICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRyaWdnZXIuY2xvc2VzdCggdG9vbHRpcF9vd25lcl9zZWxlY3RvciApICkge1xuXHRcdFx0XHRyZXR1cm4gY29udGV4dF9wb3BvdmVyX3ByaW9yaXR5O1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWdpc3RlciBvbmUgY2hpbGQgZmxvYXRpbmcgbGF5ZXIgdGhhdCBiZWxvbmdzIHRvIHRoaXMgaW50ZXJhY3Rpb24gZ3JvdXAuXG5cdFx0ICpcblx0XHQgKiBSZWdpc3RyYXRpb24gYWZmZWN0cyBjb2xsaXNpb24gYW5kIGxpZmVjeWNsZSBvd25lcnNoaXAgb25seS4gSXQgZG9lcyBub3Rcblx0XHQgKiBncmFudCBhY2Nlc3MgdG8gY29udGVudCwgZGF0YSwgb3IgYWN0aW9ucyBpbnNpZGUgZWl0aGVyIGNvbXBvbmVudC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBjYW5kaWRhdGUgQ2FuZGlkYXRlIGNoaWxkIGxheWVyIGRlc2NyaXB0b3IuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBjaGlsZCBkZXNjcmlwdG9yIHdhcyByZWdpc3RlcmVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlZ2lzdGVyX2NoaWxkX2xheWVyKCBjYW5kaWRhdGUgKSB7XG5cdFx0XHR2YXIgZGVzY3JpcHRvciA9IG5vcm1hbGl6ZV9sYXllcl9kZXNjcmlwdG9yKCBjYW5kaWRhdGUgKTtcblxuXHRcdFx0aWYgKCAhIGRlc2NyaXB0b3IgfHwgZGVzY3JpcHRvci5pbnN0YW5jZV9pZCA9PT0gY29tcG9uZW50X2lkICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRyZWdpc3RlcmVkX2NoaWxkX2xheWVyc1sgZGVzY3JpcHRvci5pbnN0YW5jZV9pZCBdID0gZGVzY3JpcHRvcjtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVtb3ZlIG9uZSBjaGlsZCBsYXllciByZWdpc3RyYXRpb24gd2l0aG91dCBhbHRlcmluZyBpdHMgVUkgaW5zdGFuY2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0geyp9IGNoaWxkX2luc3RhbmNlX2lkIFN0YWJsZSBjaGlsZCBsYXllciBpbnN0YW5jZSBJRC5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gYSByZWdpc3RyYXRpb24gd2FzIHJlbW92ZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gdW5yZWdpc3Rlcl9jaGlsZF9sYXllciggY2hpbGRfaW5zdGFuY2VfaWQgKSB7XG5cdFx0XHRjaGlsZF9pbnN0YW5jZV9pZCA9IG5vcm1hbGl6ZV9pZCggY2hpbGRfaW5zdGFuY2VfaWQgKTtcblxuXHRcdFx0aWYgKCAhIGNoaWxkX2luc3RhbmNlX2lkIHx8ICEgcmVnaXN0ZXJlZF9jaGlsZF9sYXllcnNbIGNoaWxkX2luc3RhbmNlX2lkIF0gKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGRlbGV0ZSByZWdpc3RlcmVkX2NoaWxkX2xheWVyc1sgY2hpbGRfaW5zdGFuY2VfaWQgXTtcblx0XHRcdGRlbGV0ZSBvcGVuX2NoaWxkX2xheWVyc1sgY2hpbGRfaW5zdGFuY2VfaWQgXTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRGV0ZXJtaW5lIHdoZXRoZXIgYSBsYXllciBldmVudCBiZWxvbmdzIHRvIHRoaXMgY29tcG9zaXRlIGludGVyYWN0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGRlc2NyaXB0b3IgTm9ybWFsaXplZCBsYXllciBkZXNjcmlwdG9yLlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgZm9yIHRoaXMgbGF5ZXIsIGFuIG93bmVkIGNoaWxkLCBvciBhIHNoYXJlZCBncm91cC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpc19yZWxhdGVkX2xheWVyKCBkZXNjcmlwdG9yICkge1xuXHRcdFx0dmFyIHJlZ2lzdGVyZWRfY2hpbGQ7XG5cblx0XHRcdGlmICggISBkZXNjcmlwdG9yICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGRlc2NyaXB0b3IubGF5ZXJfdHlwZSA9PT0gbGF5ZXJfZGVzY3JpcHRvci5sYXllcl90eXBlICYmIGRlc2NyaXB0b3IuaW5zdGFuY2VfaWQgPT09IGNvbXBvbmVudF9pZCApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRyZWdpc3RlcmVkX2NoaWxkID0gcmVnaXN0ZXJlZF9jaGlsZF9sYXllcnNbIGRlc2NyaXB0b3IuaW5zdGFuY2VfaWQgXTtcblx0XHRcdGlmICggcmVnaXN0ZXJlZF9jaGlsZCAmJiByZWdpc3RlcmVkX2NoaWxkLmxheWVyX3R5cGUgPT09IGRlc2NyaXB0b3IubGF5ZXJfdHlwZSApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGRlc2NyaXB0b3Iub3duZXJfaWQgJiYgKCBkZXNjcmlwdG9yLm93bmVyX2lkID09PSBjb21wb25lbnRfaWQgfHwgZGVzY3JpcHRvci5vd25lcl9pZCA9PT0gb3duZXJfaWQgKSApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBCb29sZWFuKCBkZXNjcmlwdG9yLmludGVyYWN0aW9uX2dyb3VwICYmIGRlc2NyaXB0b3IuaW50ZXJhY3Rpb25fZ3JvdXAgPT09IGludGVyYWN0aW9uX2dyb3VwICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRGV0ZXJtaW5lIHdoZXRoZXIgYW55IHJlZ2lzdGVyZWQgY2hpbGQgbGF5ZXIgaGFzIGFubm91bmNlZCBpdHNlbGYgb3Blbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hpbGUgYXQgbGVhc3Qgb25lIHJlbGF0ZWQgY2hpbGQgcmVtYWlucyBvcGVuLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhc19vcGVuX2NoaWxkX2xheWVycygpIHtcblx0XHRcdHJldHVybiAwIDwgT2JqZWN0LmtleXMoIG9wZW5fY2hpbGRfbGF5ZXJzICkubGVuZ3RoO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENsb3NlIGZvciBhIGJsb2NraW5nIHVucmVsYXRlZCBzaGFyZWQgbGF5ZXIgd2hpbGUgcHJlc2VydmluZyBjaGlsZCBsYXllcnMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0N1c3RvbUV2ZW50fSBldmVudCBTaGFyZWQgZmxvYXRpbmctbGF5ZXIgb3BlbiBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9sYXllcl9vcGVuKCBldmVudCApIHtcblx0XHRcdHZhciBkZXNjcmlwdG9yID0gbm9ybWFsaXplX2xheWVyX2Rlc2NyaXB0b3IoIGV2ZW50ID8gZXZlbnQuZGV0YWlsIDogbnVsbCApO1xuXG5cdFx0XHRpZiAoICEgZGVzY3JpcHRvciApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBpc19yZWxhdGVkX2xheWVyKCBkZXNjcmlwdG9yICkgKSB7XG5cdFx0XHRcdGlmICggZGVzY3JpcHRvci5pbnN0YW5jZV9pZCAhPT0gY29tcG9uZW50X2lkICkge1xuXHRcdFx0XHRcdG9wZW5fY2hpbGRfbGF5ZXJzWyBkZXNjcmlwdG9yLmluc3RhbmNlX2lkIF0gPSBkZXNjcmlwdG9yO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChcblx0XHRcdFx0LTEgIT09IGJsb2NraW5nX2xheWVyX3R5cGVzLmluZGV4T2YoIGRlc2NyaXB0b3IubGF5ZXJfdHlwZSApXG5cdFx0XHRcdCYmICggaXNfdmlzaWJsZV9jb250cm9sbGVyKCBjb250cm9sbGVyICkgfHwgcGVuZGluZ19zaG93X3RpbWVyIHx8IHN1c3BlbmRlZCApXG5cdFx0XHQpIHtcblx0XHRcdFx0aWYgKCBwaW5uZWQgJiYgLTEgIT09IHN1c3BlbmRpbmdfbGF5ZXJfdHlwZXMuaW5kZXhPZiggZGVzY3JpcHRvci5sYXllcl90eXBlICkgKSB7XG5cdFx0XHRcdFx0c3VzcGVuZGluZ19sYXllcnNbIGRlc2NyaXB0b3IuaW5zdGFuY2VfaWQgXSA9IGRlc2NyaXB0b3I7XG5cdFx0XHRcdFx0c3VzcGVuZCggJ2Jsb2NraW5nX2xheWVyJywgdHJ1ZSApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXF1ZXN0X2Nsb3NlKFxuXHRcdFx0XHRcdCdleHBsaWNpdCcgPT09IGRpc21pc3NfcG9saWN5ICYmICdjb250ZXh0X3BvcG92ZXInICE9PSBkZXNjcmlwdG9yLmxheWVyX3R5cGVcblx0XHRcdFx0XHRcdD8gJ3Byb2dyYW1tYXRpYydcblx0XHRcdFx0XHRcdDogJ3JlcGxhY2VtZW50Jyxcblx0XHRcdFx0XHRmYWxzZVxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEZvcmdldCBvbmx5IHRoZSBvcGVuIHN0YXRlIG9mIGEgcmVsYXRlZCBjaGlsZCBsYXllci5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Q3VzdG9tRXZlbnR9IGV2ZW50IFNoYXJlZCBmbG9hdGluZy1sYXllciBjbG9zZSBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9sYXllcl9jbG9zZSggZXZlbnQgKSB7XG5cdFx0XHR2YXIgZGVzY3JpcHRvciA9IG5vcm1hbGl6ZV9sYXllcl9kZXNjcmlwdG9yKCBldmVudCA/IGV2ZW50LmRldGFpbCA6IG51bGwgKTtcblx0XHRcdHZhciBvcGVuX2NoaWxkO1xuXHRcdFx0dmFyIHN1c3BlbmRpbmdfbGF5ZXI7XG5cblx0XHRcdHN1c3BlbmRpbmdfbGF5ZXIgPSBkZXNjcmlwdG9yID8gc3VzcGVuZGluZ19sYXllcnNbIGRlc2NyaXB0b3IuaW5zdGFuY2VfaWQgXSA6IG51bGw7XG5cdFx0XHRpZiAoIHN1c3BlbmRpbmdfbGF5ZXIgJiYgc3VzcGVuZGluZ19sYXllci5sYXllcl90eXBlID09PSBkZXNjcmlwdG9yLmxheWVyX3R5cGUgKSB7XG5cdFx0XHRcdGRlbGV0ZSBzdXNwZW5kaW5nX2xheWVyc1sgZGVzY3JpcHRvci5pbnN0YW5jZV9pZCBdO1xuXHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0c3VzcGVuZGVkXG5cdFx0XHRcdFx0JiYgISBPYmplY3Qua2V5cyggc3VzcGVuZGluZ19sYXllcnMgKS5sZW5ndGhcblx0XHRcdFx0XHQmJiAhIGV4dGVybmFsX3N1c3BlbnNpb25faG9sZFxuXHRcdFx0XHQpIHtcblx0XHRcdFx0XHRyZXN1bWUoIGZhbHNlICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdG9wZW5fY2hpbGQgPSBkZXNjcmlwdG9yID8gb3Blbl9jaGlsZF9sYXllcnNbIGRlc2NyaXB0b3IuaW5zdGFuY2VfaWQgXSA6IG51bGw7XG5cdFx0XHRpZiAoIG9wZW5fY2hpbGQgJiYgb3Blbl9jaGlsZC5sYXllcl90eXBlID09PSBkZXNjcmlwdG9yLmxheWVyX3R5cGUgKSB7XG5cdFx0XHRcdGRlbGV0ZSBvcGVuX2NoaWxkX2xheWVyc1sgZGVzY3JpcHRvci5pbnN0YW5jZV9pZCBdO1xuXHRcdFx0XHRpZiAoIGlzX3Zpc2libGVfY29udHJvbGxlciggY29udHJvbGxlciApICYmICEgcG9pbnRlcl9pbnNpZGVfY29tcG9zaXRlICYmICEgaXNfY29tcG9zaXRlX25vZGUoIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgKSApIHtcblx0XHRcdFx0XHRzY2hlZHVsZV9jbG9zZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQW5ub3VuY2UgdGhpcyBDb250ZXh0IFBvcG92ZXIgb25jZSBwZXIgdmlzaWJsZSBsaWZlY3ljbGUuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGFubm91bmNlX2xheWVyX29wZW4oKSB7XG5cdFx0XHRpZiAoIGxheWVyX29wZW5fYW5ub3VuY2VkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRsYXllcl9vcGVuX2Fubm91bmNlZCA9IGRpc3BhdGNoX2xheWVyX2V2ZW50KCBsYXllcl9vcGVuX2V2ZW50LCBsYXllcl9kZXNjcmlwdG9yICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQW5ub3VuY2UgdGhpcyBDb250ZXh0IFBvcG92ZXIgY2xvc2UgYWZ0ZXIgcmVsZWFzaW5nIGl0cyB2aXNpYmxlIHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBhbm5vdW5jZV9sYXllcl9jbG9zZSgpIHtcblx0XHRcdGlmICggISBsYXllcl9vcGVuX2Fubm91bmNlZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bGF5ZXJfb3Blbl9hbm5vdW5jZWQgPSBmYWxzZTtcblx0XHRcdGRpc3BhdGNoX2xheWVyX2V2ZW50KCBsYXllcl9jbG9zZV9ldmVudCwgbGF5ZXJfZGVzY3JpcHRvciApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIERldGVybWluZSB3aGV0aGVyIGEgbm9kZSBpcyB3aXRoaW4gdGhlIGNvbXBsZXRlIGNvbXBvc2l0ZSByZWdpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge05vZGV8bnVsbH0gY2FuZGlkYXRlIENhbmRpZGF0ZSBwb2ludGVyIG9yIGZvY3VzIG5vZGUuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSBmb3IgdGhlIGFjdGl2ZSB0cmlnZ2VyLCBzdXJmYWNlLCBvciBvd25lZCBjaGlsZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpc19jb21wb3NpdGVfbm9kZSggY2FuZGlkYXRlICkge1xuXHRcdFx0dmFyIGNhbmRpZGF0ZV9lbGVtZW50ID0gZ2V0X2VsZW1lbnQoIGNhbmRpZGF0ZSApO1xuXG5cdFx0XHRpZiAoICEgY2FuZGlkYXRlX2VsZW1lbnQgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICggY3VycmVudF90cmlnZ2VyICYmICggY3VycmVudF90cmlnZ2VyID09PSBjYW5kaWRhdGVfZWxlbWVudCB8fCBjdXJyZW50X3RyaWdnZXIuY29udGFpbnMoIGNhbmRpZGF0ZV9lbGVtZW50ICkgKSApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBpc19wb3BvdmVyX293bmVkX25vZGUoIGNhbmRpZGF0ZV9lbGVtZW50ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2FuY2VsIGEgZGVsYXllZCBjb21wb3NpdGUtcmVnaW9uIGNsb3NlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjYW5jZWxfcGVuZGluZ19jbG9zZSgpIHtcblx0XHRcdGlmICggcGVuZGluZ19jbG9zZV90aW1lciApIHtcblx0XHRcdFx0d2luZG93LmNsZWFyVGltZW91dCggcGVuZGluZ19jbG9zZV90aW1lciApO1xuXHRcdFx0XHRwZW5kaW5nX2Nsb3NlX3RpbWVyID0gMDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDYW5jZWwgZGVsYXllZCBmb2N1cyBvd25lcnNoaXAgd29yay5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2FuY2VsX3BlbmRpbmdfZm9jdXMoKSB7XG5cdFx0XHRpZiAoIHBlbmRpbmdfZm9jdXNfY2hlY2tfdGltZXIgKSB7XG5cdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIHBlbmRpbmdfZm9jdXNfY2hlY2tfdGltZXIgKTtcblx0XHRcdFx0cGVuZGluZ19mb2N1c19jaGVja190aW1lciA9IDA7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHBlbmRpbmdfZm9jdXNfZW50cnlfdGltZXIgKSB7XG5cdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIHBlbmRpbmdfZm9jdXNfZW50cnlfdGltZXIgKTtcblx0XHRcdFx0cGVuZGluZ19mb2N1c19lbnRyeV90aW1lciA9IDA7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHN1cHByZXNzZWRfZm9jdXNfdGltZXIgKSB7XG5cdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIHN1cHByZXNzZWRfZm9jdXNfdGltZXIgKTtcblx0XHRcdFx0c3VwcHJlc3NlZF9mb2N1c190aW1lciA9IDA7XG5cdFx0XHR9XG5cdFx0XHRzdXBwcmVzc2VkX2ZvY3VzX3RyaWdnZXIgPSBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENhbmNlbCBldmVyeSBkZWxheWVkIG9wZW4sIGNsb3NlLCBhbmQgZm9jdXMgdHJhbnNpdGlvbi5cblx0XHQgKlxuXHRcdCAqIFBpbiBjaGFuZ2VzIHVzZSB0aGlzIGJvdW5kYXJ5IHNvIG5vIGNhbGxiYWNrIHF1ZXVlZCB1bmRlciB0aGUgcHJldmlvdXNcblx0XHQgKiBwb2xpY3kgY2FuIG11dGF0ZSB0aGUgbmV3IHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjYW5jZWxfaW50ZXJhY3Rpb25fdGltZXJzKCkge1xuXHRcdFx0Y2FuY2VsX3BlbmRpbmdfb3BlbigpO1xuXHRcdFx0Y2FuY2VsX3BlbmRpbmdfY2xvc2UoKTtcblx0XHRcdGNhbmNlbF9wZW5kaW5nX2ZvY3VzKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3RvcCB0aGUgYWN0aXZlIHBvaW50ZXIgZHJhZyBhbmQgcmVsZWFzZSBpdHMgdGVtcG9yYXJ5IGRvY3VtZW50IGxpc3RlbmVycy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZmluaXNoX3Bpbm5lZF9kcmFnKCkge1xuXHRcdFx0dmFyIHBvaW50ZXJfaWQ7XG5cblx0XHRcdGlmICggISBhY3RpdmVfZHJhZyApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cG9pbnRlcl9pZCA9IGFjdGl2ZV9kcmFnLnBvaW50ZXJfaWQ7XG5cdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCAncG9pbnRlcm1vdmUnLCBoYW5kbGVfcGlubmVkX2RyYWdfcG9pbnRlcl9tb3ZlLCB0cnVlICk7XG5cdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCAncG9pbnRlcnVwJywgZmluaXNoX3Bpbm5lZF9kcmFnLCB0cnVlICk7XG5cdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCAncG9pbnRlcmNhbmNlbCcsIGZpbmlzaF9waW5uZWRfZHJhZywgdHJ1ZSApO1xuXHRcdFx0YWN0aXZlX2RyYWcgPSBudWxsO1xuXHRcdFx0c3VyZmFjZS5yZW1vdmVBdHRyaWJ1dGUoICdkYXRhLXdwYmMtc2hhcmVkLXVpLWNvbnRleHQtcG9wb3Zlci1kcmFnZ2luZycgKTtcblx0XHRcdGlmIChcblx0XHRcdFx0ZHJhZ19idXR0b25cblx0XHRcdFx0JiYgZHJhZ19idXR0b24uaGFzUG9pbnRlckNhcHR1cmVcblx0XHRcdFx0JiYgZHJhZ19idXR0b24ucmVsZWFzZVBvaW50ZXJDYXB0dXJlXG5cdFx0XHRcdCYmIE51bWJlci5pc0Zpbml0ZSggcG9pbnRlcl9pZCApXG5cdFx0XHRcdCYmIGRyYWdfYnV0dG9uLmhhc1BvaW50ZXJDYXB0dXJlKCBwb2ludGVyX2lkIClcblx0XHRcdCkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGRyYWdfYnV0dG9uLnJlbGVhc2VQb2ludGVyQ2FwdHVyZSggcG9pbnRlcl9pZCApO1xuXHRcdFx0XHR9IGNhdGNoICggZXJyb3IgKSB7XG5cdFx0XHRcdFx0Ly8gVGhlIHVzZXIgYWdlbnQgbWF5IGFscmVhZHkgaGF2ZSByZWxlYXNlZCBjYXB0dXJlIG9uIHBvaW50ZXJ1cC5cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENvbW1pdCBvbmUgY2xhbXBlZCB2aWV3cG9ydCBwb3NpdGlvbiBhbmQgcmVmcmVzaCB0aGUgcGlubmVkIFBvcHBlciBvdXRwdXQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gbGVmdCBSZXF1ZXN0ZWQgbGVmdCBjb29yZGluYXRlLlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSB0b3AgIFJlcXVlc3RlZCB0b3AgY29vcmRpbmF0ZS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG1vdmVfcGlubmVkX3N1cmZhY2UoIGxlZnQsIHRvcCApIHtcblx0XHRcdGlmICggISBwaW5uZWQgfHwgISBwaW5fdG9fdmlld3BvcnQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHBpbm5lZF92aWV3cG9ydF9wb3NpdGlvbiA9IGNsYW1wX3Bpbm5lZF92aWV3cG9ydF9wb3NpdGlvbiggbGVmdCwgdG9wICk7XG5cdFx0XHRpZiAoIHRpcHB5X2luc3RhbmNlICYmIHRpcHB5X2luc3RhbmNlLnBvcHBlckluc3RhbmNlICkge1xuXHRcdFx0XHR0aXBweV9pbnN0YW5jZS5wb3BwZXJJbnN0YW5jZS5mb3JjZVVwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEJlZ2luIGRyYWdnaW5nIGFuIG9wdGVkLWluIHBpbm5lZCBzdXJmYWNlIGZyb20gaXRzIGFjY2Vzc2libGUgaGFuZGxlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtQb2ludGVyRXZlbnR9IGV2ZW50IFBvaW50ZXItZG93biBldmVudCBvbiB0aGUgZHJhZyBoYW5kbGUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfcGlubmVkX2RyYWdfcG9pbnRlcl9kb3duKCBldmVudCApIHtcblx0XHRcdGlmICggISBwaW5uZWQgfHwgISBkcmFnZ2FibGVfd2hlbl9waW5uZWQgfHwgKCBOdW1iZXIuaXNGaW5pdGUoIGV2ZW50LmJ1dHRvbiApICYmIDAgIT09IGV2ZW50LmJ1dHRvbiApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRhY3RpdmVfZHJhZyA9IHtcblx0XHRcdFx0cG9pbnRlcl9pZDogZXZlbnQucG9pbnRlcklkLFxuXHRcdFx0XHRzdGFydF94OiBldmVudC5jbGllbnRYLFxuXHRcdFx0XHRzdGFydF95OiBldmVudC5jbGllbnRZLFxuXHRcdFx0XHRvcmlnaW5fbGVmdDogcGlubmVkX3ZpZXdwb3J0X3Bvc2l0aW9uID8gcGlubmVkX3ZpZXdwb3J0X3Bvc2l0aW9uLmxlZnQgOiAwLFxuXHRcdFx0XHRvcmlnaW5fdG9wOiBwaW5uZWRfdmlld3BvcnRfcG9zaXRpb24gPyBwaW5uZWRfdmlld3BvcnRfcG9zaXRpb24udG9wIDogMFxuXHRcdFx0fTtcblx0XHRcdHN1cmZhY2Uuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXNoYXJlZC11aS1jb250ZXh0LXBvcG92ZXItZHJhZ2dpbmcnLCAndHJ1ZScgKTtcblx0XHRcdGlmICggZHJhZ19idXR0b24uc2V0UG9pbnRlckNhcHR1cmUgJiYgTnVtYmVyLmlzRmluaXRlKCBldmVudC5wb2ludGVySWQgKSApIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRkcmFnX2J1dHRvbi5zZXRQb2ludGVyQ2FwdHVyZSggZXZlbnQucG9pbnRlcklkICk7XG5cdFx0XHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdFx0XHQvLyBEb2N1bWVudCBsaXN0ZW5lcnMgcmV0YWluIHRoZSBnZXN0dXJlIHdoZW4gY2FwdHVyZSBpcyB1bmF2YWlsYWJsZS5cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJtb3ZlJywgaGFuZGxlX3Bpbm5lZF9kcmFnX3BvaW50ZXJfbW92ZSwgdHJ1ZSApO1xuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJ1cCcsIGZpbmlzaF9waW5uZWRfZHJhZywgdHJ1ZSApO1xuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJjYW5jZWwnLCBmaW5pc2hfcGlubmVkX2RyYWcsIHRydWUgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBNb3ZlIHRoZSBwaW5uZWQgc3VyZmFjZSB3aXRoIHRoZSBhY3RpdmUgcG9pbnRlciBnZXN0dXJlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtQb2ludGVyRXZlbnR9IGV2ZW50IENhcHR1cmVkIHBvaW50ZXIgbW92ZW1lbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfcGlubmVkX2RyYWdfcG9pbnRlcl9tb3ZlKCBldmVudCApIHtcblx0XHRcdGlmICggISBhY3RpdmVfZHJhZyB8fCBldmVudC5wb2ludGVySWQgIT09IGFjdGl2ZV9kcmFnLnBvaW50ZXJfaWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRtb3ZlX3Bpbm5lZF9zdXJmYWNlKFxuXHRcdFx0XHRhY3RpdmVfZHJhZy5vcmlnaW5fbGVmdCArIGV2ZW50LmNsaWVudFggLSBhY3RpdmVfZHJhZy5zdGFydF94LFxuXHRcdFx0XHRhY3RpdmVfZHJhZy5vcmlnaW5fdG9wICsgZXZlbnQuY2xpZW50WSAtIGFjdGl2ZV9kcmFnLnN0YXJ0X3lcblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTW92ZSBhIHBpbm5lZCBzdXJmYWNlIGZyb20gdGhlIGtleWJvYXJkLWFjY2Vzc2libGUgZHJhZyBoYW5kbGUuXG5cdFx0ICpcblx0XHQgKiBBcnJvdyBrZXlzIG1vdmUgYnkgdGVuIHBpeGVsczsgU2hpZnQrQXJyb3cgcHJvdmlkZXMgb25lLXBpeGVsIHByZWNpc2lvbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7S2V5Ym9hcmRFdmVudH0gZXZlbnQgRHJhZy1oYW5kbGUga2V5Ym9hcmQgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfcGlubmVkX2RyYWdfa2V5ZG93biggZXZlbnQgKSB7XG5cdFx0XHR2YXIgb2Zmc2V0X3ggPSAwO1xuXHRcdFx0dmFyIG9mZnNldF95ID0gMDtcblx0XHRcdHZhciBkaXN0YW5jZSA9IGV2ZW50LnNoaWZ0S2V5ID8gMSA6IDEwO1xuXG5cdFx0XHRpZiAoICEgcGlubmVkIHx8ICEgZHJhZ2dhYmxlX3doZW5fcGlubmVkIHx8ICEgcGlubmVkX3ZpZXdwb3J0X3Bvc2l0aW9uICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdBcnJvd0xlZnQnID09PSBldmVudC5rZXkgKSB7XG5cdFx0XHRcdG9mZnNldF94ID0gLWRpc3RhbmNlO1xuXHRcdFx0fSBlbHNlIGlmICggJ0Fycm93UmlnaHQnID09PSBldmVudC5rZXkgKSB7XG5cdFx0XHRcdG9mZnNldF94ID0gZGlzdGFuY2U7XG5cdFx0XHR9IGVsc2UgaWYgKCAnQXJyb3dVcCcgPT09IGV2ZW50LmtleSApIHtcblx0XHRcdFx0b2Zmc2V0X3kgPSAtZGlzdGFuY2U7XG5cdFx0XHR9IGVsc2UgaWYgKCAnQXJyb3dEb3duJyA9PT0gZXZlbnQua2V5ICkge1xuXHRcdFx0XHRvZmZzZXRfeSA9IGRpc3RhbmNlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0bW92ZV9waW5uZWRfc3VyZmFjZShcblx0XHRcdFx0cGlubmVkX3ZpZXdwb3J0X3Bvc2l0aW9uLmxlZnQgKyBvZmZzZXRfeCxcblx0XHRcdFx0cGlubmVkX3ZpZXdwb3J0X3Bvc2l0aW9uLnRvcCArIG9mZnNldF95XG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlcG9ydCB3aGV0aGVyIHRoZSBzdXJmYWNlIGN1cnJlbnRseSB1c2VzIHJpZ2h0LXRvLWxlZnQgaW5saW5lIGZsb3cuXG5cdFx0ICpcblx0XHQgKiBUaGUgcmVzaXplIGhhbmRsZSBzaXRzIGF0IHRoZSBsb2dpY2FsIGlubGluZSBlbmQsIHNvIFJUTCB3aWR0aCBjaGFuZ2VzXG5cdFx0ICoga2VlcCB0aGUgcGh5c2ljYWwgcmlnaHQgZWRnZSBmaXhlZCB3aGlsZSB0aGUgbGVmdCBlZGdlIG1vdmVzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBjb21wdXRlZCBzdXJmYWNlIGRpcmVjdGlvbiBpcyBSVEwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaXNfc3VyZmFjZV9yaWdodF90b19sZWZ0KCkge1xuXHRcdFx0cmV0dXJuICdydGwnID09PSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSggc3VyZmFjZSApLmRpcmVjdGlvbjtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTdG9wIHRoZSBhY3RpdmUgcG9pbnRlciByZXNpemUgYW5kIHJlbGVhc2UgdGVtcG9yYXJ5IGRvY3VtZW50IGxpc3RlbmVycy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7UG9pbnRlckV2ZW50fSBbZXZlbnRdIE9wdGlvbmFsIHBvaW50ZXIgY29tcGxldGlvbiBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGZpbmlzaF9waW5uZWRfcmVzaXplKCBldmVudCApIHtcblx0XHRcdHZhciBwb2ludGVyX2lkO1xuXG5cdFx0XHRpZiAoICEgYWN0aXZlX3Jlc2l6ZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKFxuXHRcdFx0XHRldmVudFxuXHRcdFx0XHQmJiBOdW1iZXIuaXNGaW5pdGUoIGV2ZW50LnBvaW50ZXJJZCApXG5cdFx0XHRcdCYmIGV2ZW50LnBvaW50ZXJJZCAhPT0gYWN0aXZlX3Jlc2l6ZS5wb2ludGVyX2lkXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cG9pbnRlcl9pZCA9IGFjdGl2ZV9yZXNpemUucG9pbnRlcl9pZDtcblx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdwb2ludGVybW92ZScsIGhhbmRsZV9waW5uZWRfcmVzaXplX3BvaW50ZXJfbW92ZSwgdHJ1ZSApO1xuXHRcdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJ1cCcsIGZpbmlzaF9waW5uZWRfcmVzaXplLCB0cnVlICk7XG5cdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCAncG9pbnRlcmNhbmNlbCcsIGZpbmlzaF9waW5uZWRfcmVzaXplLCB0cnVlICk7XG5cdFx0XHRhY3RpdmVfcmVzaXplID0gbnVsbDtcblx0XHRcdHN1cmZhY2UucmVtb3ZlQXR0cmlidXRlKCAnZGF0YS13cGJjLXNoYXJlZC11aS1jb250ZXh0LXBvcG92ZXItcmVzaXppbmcnICk7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdHJlc2l6ZV9idXR0b25cblx0XHRcdFx0JiYgcmVzaXplX2J1dHRvbi5oYXNQb2ludGVyQ2FwdHVyZVxuXHRcdFx0XHQmJiByZXNpemVfYnV0dG9uLnJlbGVhc2VQb2ludGVyQ2FwdHVyZVxuXHRcdFx0XHQmJiBOdW1iZXIuaXNGaW5pdGUoIHBvaW50ZXJfaWQgKVxuXHRcdFx0XHQmJiByZXNpemVfYnV0dG9uLmhhc1BvaW50ZXJDYXB0dXJlKCBwb2ludGVyX2lkIClcblx0XHRcdCkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdHJlc2l6ZV9idXR0b24ucmVsZWFzZVBvaW50ZXJDYXB0dXJlKCBwb2ludGVyX2lkICk7XG5cdFx0XHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdFx0XHQvLyBUaGUgdXNlciBhZ2VudCBtYXkgYWxyZWFkeSBoYXZlIHJlbGVhc2VkIGNhcHR1cmUgb24gcG9pbnRlcnVwLlxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVtb3ZlIGEgdXNlci1zZWxlY3RlZCBwaW5uZWQgc2l6ZSBhbmQgcmVzdG9yZSBkb21haW4gZGVmYXVsdCBkaW1lbnNpb25zLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjbGVhcl9waW5uZWRfc3VyZmFjZV9zaXplKCkge1xuXHRcdFx0cGlubmVkX3ZpZXdwb3J0X3NpemUgPSBudWxsO1xuXHRcdFx0c3VyZmFjZS5yZW1vdmVBdHRyaWJ1dGUoICdkYXRhLXdwYmMtc2hhcmVkLXVpLWNvbnRleHQtcG9wb3Zlci1yZXNpemVkJyApO1xuXHRcdFx0c3VyZmFjZS5zdHlsZS5yZW1vdmVQcm9wZXJ0eSggcmVzaXplZF93aWR0aF9wcm9wZXJ0eSApO1xuXHRcdFx0c3VyZmFjZS5zdHlsZS5yZW1vdmVQcm9wZXJ0eSggcmVzaXplZF9oZWlnaHRfcHJvcGVydHkgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDb21taXQgYSBib3VuZGVkIHNpemUgZm9yIG9uZSB2aWV3cG9ydC1waW5uZWQgc3VyZmFjZS5cblx0XHQgKlxuXHRcdCAqIFdpZHRoIG5ldmVyIGV4Y2VlZHMgdGhlIGNvbnRyb2xsZXIncyBjb25maWd1cmVkIG1heGltdW0uIEhlaWdodCBhbmQgYm90aFxuXHRcdCAqIGRpbWVuc2lvbnMgcmVtYWluIHdpdGhpbiB0aGUgVmlzdWFsIFZpZXdwb3J0IGZyb20gdGhlIGN1cnJlbnQgcGlubmVkXG5cdFx0ICogcG9zaXRpb24uIFJUTCByZXNpemluZyBwcmVzZXJ2ZXMgdGhlIHBoeXNpY2FsIHJpZ2h0IGVkZ2UgYmVjYXVzZSBpdHNcblx0XHQgKiBsb2dpY2FsIHJlc2l6ZSBoYW5kbGUgaXMgb24gdGhlIGxlZnQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gIHJlcXVlc3RlZF93aWR0aCAgUmVxdWVzdGVkIENTUy1waXhlbCB3aWR0aC5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gIHJlcXVlc3RlZF9oZWlnaHQgUmVxdWVzdGVkIENTUy1waXhlbCBoZWlnaHQuXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBhbmNob3JfcmlnaHQgICAgIFdoZXRoZXIgdG8ga2VlcCB0aGUgcGh5c2ljYWwgcmlnaHQgZWRnZSBmaXhlZC5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gYSBwaW5uZWQgc2l6ZSB3YXMgY29tbWl0dGVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlc2l6ZV9waW5uZWRfc3VyZmFjZSggcmVxdWVzdGVkX3dpZHRoLCByZXF1ZXN0ZWRfaGVpZ2h0LCBhbmNob3JfcmlnaHQgKSB7XG5cdFx0XHR2YXIgdmlld3BvcnRfYm91bmRzO1xuXHRcdFx0dmFyIHN1cmZhY2VfcmVjdDtcblx0XHRcdHZhciBjdXJyZW50X3Bvc2l0aW9uO1xuXHRcdFx0dmFyIG1pbmltdW1fbGVmdDtcblx0XHRcdHZhciBtYXhpbXVtX2F2YWlsYWJsZV93aWR0aDtcblx0XHRcdHZhciBtYXhpbXVtX2F2YWlsYWJsZV9oZWlnaHQ7XG5cdFx0XHR2YXIgYm91bmRlZF9taW5pbXVtX3dpZHRoO1xuXHRcdFx0dmFyIGJvdW5kZWRfbWluaW11bV9oZWlnaHQ7XG5cdFx0XHR2YXIgcmVzaXplZF93aWR0aDtcblx0XHRcdHZhciByZXNpemVkX2hlaWdodDtcblx0XHRcdHZhciBmaXhlZF9yaWdodDtcblx0XHRcdHZhciByZXNpemVkX2xlZnQ7XG5cblx0XHRcdGlmICggISBwaW5uZWQgfHwgISBwaW5fdG9fdmlld3BvcnQgfHwgISByZXNpemFibGVfd2hlbl9waW5uZWQgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHZpZXdwb3J0X2JvdW5kcyA9IGdldF92aXN1YWxfdmlld3BvcnRfYm91bmRzKCk7XG5cdFx0XHRzdXJmYWNlX3JlY3QgPSBzdXJmYWNlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0Y3VycmVudF9wb3NpdGlvbiA9IHBpbm5lZF92aWV3cG9ydF9wb3NpdGlvbiB8fCBjbGFtcF9waW5uZWRfdmlld3BvcnRfcG9zaXRpb24oIHN1cmZhY2VfcmVjdC5sZWZ0LCBzdXJmYWNlX3JlY3QudG9wICk7XG5cdFx0XHRtaW5pbXVtX2xlZnQgPSB2aWV3cG9ydF9ib3VuZHMubGVmdCArIHZpZXdwb3J0X3BhZGRpbmc7XG5cdFx0XHRmaXhlZF9yaWdodCA9IGN1cnJlbnRfcG9zaXRpb24ubGVmdCArIE1hdGgubWF4KCAxLCBzdXJmYWNlX3JlY3Qud2lkdGggfHwgcHJlZmVycmVkX3dpZHRoICk7XG5cdFx0XHRtYXhpbXVtX2F2YWlsYWJsZV93aWR0aCA9IGFuY2hvcl9yaWdodFxuXHRcdFx0XHQ/IGZpeGVkX3JpZ2h0IC0gbWluaW11bV9sZWZ0XG5cdFx0XHRcdDogdmlld3BvcnRfYm91bmRzLnJpZ2h0IC0gdmlld3BvcnRfcGFkZGluZyAtIGN1cnJlbnRfcG9zaXRpb24ubGVmdDtcblx0XHRcdG1heGltdW1fYXZhaWxhYmxlX3dpZHRoID0gTWF0aC5tYXgoIDEsIE1hdGgubWluKCBtYXhpbXVtX3Jlc2l6ZWRfd2lkdGgsIG1heGltdW1fYXZhaWxhYmxlX3dpZHRoICkgKTtcblx0XHRcdG1heGltdW1fYXZhaWxhYmxlX2hlaWdodCA9IE1hdGgubWF4KCAxLCB2aWV3cG9ydF9ib3VuZHMuYm90dG9tIC0gdmlld3BvcnRfcGFkZGluZyAtIGN1cnJlbnRfcG9zaXRpb24udG9wICk7XG5cdFx0XHRib3VuZGVkX21pbmltdW1fd2lkdGggPSBNYXRoLm1pbiggbWluaW11bV9yZXNpemVkX3dpZHRoLCBtYXhpbXVtX2F2YWlsYWJsZV93aWR0aCApO1xuXHRcdFx0Ym91bmRlZF9taW5pbXVtX2hlaWdodCA9IE1hdGgubWluKCBtaW5pbXVtX3Jlc2l6ZWRfaGVpZ2h0LCBtYXhpbXVtX2F2YWlsYWJsZV9oZWlnaHQgKTtcblx0XHRcdHJlcXVlc3RlZF93aWR0aCA9IE51bWJlci5pc0Zpbml0ZSggcmVxdWVzdGVkX3dpZHRoICkgPyByZXF1ZXN0ZWRfd2lkdGggOiBzdXJmYWNlX3JlY3Qud2lkdGg7XG5cdFx0XHRyZXF1ZXN0ZWRfaGVpZ2h0ID0gTnVtYmVyLmlzRmluaXRlKCByZXF1ZXN0ZWRfaGVpZ2h0ICkgPyByZXF1ZXN0ZWRfaGVpZ2h0IDogc3VyZmFjZV9yZWN0LmhlaWdodDtcblx0XHRcdHJlc2l6ZWRfd2lkdGggPSBNYXRoLm1pbiggbWF4aW11bV9hdmFpbGFibGVfd2lkdGgsIE1hdGgubWF4KCBib3VuZGVkX21pbmltdW1fd2lkdGgsIE1hdGgucm91bmQoIHJlcXVlc3RlZF93aWR0aCApICkgKTtcblx0XHRcdHJlc2l6ZWRfaGVpZ2h0ID0gTWF0aC5taW4oIG1heGltdW1fYXZhaWxhYmxlX2hlaWdodCwgTWF0aC5tYXgoIGJvdW5kZWRfbWluaW11bV9oZWlnaHQsIE1hdGgucm91bmQoIHJlcXVlc3RlZF9oZWlnaHQgKSApICk7XG5cdFx0XHRyZXNpemVkX2xlZnQgPSBhbmNob3JfcmlnaHQgPyBmaXhlZF9yaWdodCAtIHJlc2l6ZWRfd2lkdGggOiBjdXJyZW50X3Bvc2l0aW9uLmxlZnQ7XG5cblx0XHRcdHN1cmZhY2Uuc3R5bGUuc2V0UHJvcGVydHkoIHJlc2l6ZWRfd2lkdGhfcHJvcGVydHksIHJlc2l6ZWRfd2lkdGggKyAncHgnICk7XG5cdFx0XHRzdXJmYWNlLnN0eWxlLnNldFByb3BlcnR5KCByZXNpemVkX2hlaWdodF9wcm9wZXJ0eSwgcmVzaXplZF9oZWlnaHQgKyAncHgnICk7XG5cdFx0XHRzdXJmYWNlLnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1zaGFyZWQtdWktY29udGV4dC1wb3BvdmVyLXJlc2l6ZWQnLCAndHJ1ZScgKTtcblx0XHRcdHBpbm5lZF92aWV3cG9ydF9zaXplID0ge1xuXHRcdFx0XHR3aWR0aDogcmVzaXplZF93aWR0aCxcblx0XHRcdFx0aGVpZ2h0OiByZXNpemVkX2hlaWdodFxuXHRcdFx0fTtcblx0XHRcdHBpbm5lZF92aWV3cG9ydF9wb3NpdGlvbiA9IGNsYW1wX3Bpbm5lZF92aWV3cG9ydF9wb3NpdGlvbiggcmVzaXplZF9sZWZ0LCBjdXJyZW50X3Bvc2l0aW9uLnRvcCApO1xuXHRcdFx0aWYgKCB0aXBweV9pbnN0YW5jZSAmJiB0aXBweV9pbnN0YW5jZS5wb3BwZXJJbnN0YW5jZSApIHtcblx0XHRcdFx0dGlwcHlfaW5zdGFuY2UucG9wcGVySW5zdGFuY2UuZm9yY2VVcGRhdGUoKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQmVnaW4gcmVzaXppbmcgYW4gb3B0ZWQtaW4gcGlubmVkIHN1cmZhY2UgZnJvbSBpdHMgY29ybmVyIGNvbnRyb2wuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge1BvaW50ZXJFdmVudH0gZXZlbnQgUG9pbnRlci1kb3duIGV2ZW50IG9uIHRoZSByZXNpemUgY29udHJvbC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9waW5uZWRfcmVzaXplX3BvaW50ZXJfZG93biggZXZlbnQgKSB7XG5cdFx0XHR2YXIgc3VyZmFjZV9yZWN0O1xuXG5cdFx0XHRpZiAoICEgcGlubmVkIHx8ICEgcmVzaXphYmxlX3doZW5fcGlubmVkIHx8ICggTnVtYmVyLmlzRmluaXRlKCBldmVudC5idXR0b24gKSAmJiAwICE9PSBldmVudC5idXR0b24gKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0c3VyZmFjZV9yZWN0ID0gc3VyZmFjZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdGFjdGl2ZV9yZXNpemUgPSB7XG5cdFx0XHRcdHBvaW50ZXJfaWQ6IGV2ZW50LnBvaW50ZXJJZCxcblx0XHRcdFx0c3RhcnRfeDogZXZlbnQuY2xpZW50WCxcblx0XHRcdFx0c3RhcnRfeTogZXZlbnQuY2xpZW50WSxcblx0XHRcdFx0b3JpZ2luX3dpZHRoOiBNYXRoLm1heCggMSwgc3VyZmFjZV9yZWN0LndpZHRoIHx8IHByZWZlcnJlZF93aWR0aCApLFxuXHRcdFx0XHRvcmlnaW5faGVpZ2h0OiBNYXRoLm1heCggMSwgc3VyZmFjZV9yZWN0LmhlaWdodCB8fCBtaW5pbXVtX3Jlc2l6ZWRfaGVpZ2h0ICksXG5cdFx0XHRcdGFuY2hvcl9yaWdodDogaXNfc3VyZmFjZV9yaWdodF90b19sZWZ0KClcblx0XHRcdH07XG5cdFx0XHRzdXJmYWNlLnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1zaGFyZWQtdWktY29udGV4dC1wb3BvdmVyLXJlc2l6aW5nJywgJ3RydWUnICk7XG5cdFx0XHRpZiAoIHJlc2l6ZV9idXR0b24uc2V0UG9pbnRlckNhcHR1cmUgJiYgTnVtYmVyLmlzRmluaXRlKCBldmVudC5wb2ludGVySWQgKSApIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRyZXNpemVfYnV0dG9uLnNldFBvaW50ZXJDYXB0dXJlKCBldmVudC5wb2ludGVySWQgKTtcblx0XHRcdFx0fSBjYXRjaCAoIGVycm9yICkge1xuXHRcdFx0XHRcdC8vIERvY3VtZW50IGxpc3RlbmVycyByZXRhaW4gdGhlIGdlc3R1cmUgd2hlbiBjYXB0dXJlIGlzIHVuYXZhaWxhYmxlLlxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAncG9pbnRlcm1vdmUnLCBoYW5kbGVfcGlubmVkX3Jlc2l6ZV9wb2ludGVyX21vdmUsIHRydWUgKTtcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdwb2ludGVydXAnLCBmaW5pc2hfcGlubmVkX3Jlc2l6ZSwgdHJ1ZSApO1xuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJjYW5jZWwnLCBmaW5pc2hfcGlubmVkX3Jlc2l6ZSwgdHJ1ZSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc2l6ZSB0aGUgcGlubmVkIHN1cmZhY2Ugd2l0aCB0aGUgYWN0aXZlIHBvaW50ZXIgZ2VzdHVyZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7UG9pbnRlckV2ZW50fSBldmVudCBDYXB0dXJlZCBwb2ludGVyIG1vdmVtZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX3Bpbm5lZF9yZXNpemVfcG9pbnRlcl9tb3ZlKCBldmVudCApIHtcblx0XHRcdHZhciBpbmxpbmVfZGVsdGE7XG5cblx0XHRcdGlmICggISBhY3RpdmVfcmVzaXplIHx8IGV2ZW50LnBvaW50ZXJJZCAhPT0gYWN0aXZlX3Jlc2l6ZS5wb2ludGVyX2lkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0aW5saW5lX2RlbHRhID0gYWN0aXZlX3Jlc2l6ZS5hbmNob3JfcmlnaHRcblx0XHRcdFx0PyBhY3RpdmVfcmVzaXplLnN0YXJ0X3ggLSBldmVudC5jbGllbnRYXG5cdFx0XHRcdDogZXZlbnQuY2xpZW50WCAtIGFjdGl2ZV9yZXNpemUuc3RhcnRfeDtcblx0XHRcdHJlc2l6ZV9waW5uZWRfc3VyZmFjZShcblx0XHRcdFx0YWN0aXZlX3Jlc2l6ZS5vcmlnaW5fd2lkdGggKyBpbmxpbmVfZGVsdGEsXG5cdFx0XHRcdGFjdGl2ZV9yZXNpemUub3JpZ2luX2hlaWdodCArIGV2ZW50LmNsaWVudFkgLSBhY3RpdmVfcmVzaXplLnN0YXJ0X3ksXG5cdFx0XHRcdGFjdGl2ZV9yZXNpemUuYW5jaG9yX3JpZ2h0XG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc2l6ZSBhIHBpbm5lZCBzdXJmYWNlIGZyb20gaXRzIGtleWJvYXJkLWFjY2Vzc2libGUgY29ybmVyIGNvbnRyb2wuXG5cdFx0ICpcblx0XHQgKiBIb3Jpem9udGFsIEFycm93IGtleXMgY2hhbmdlIHdpZHRoIGZyb20gdGhlIGxvZ2ljYWwgaW5saW5lIGVuZC4gVmVydGljYWxcblx0XHQgKiBBcnJvdyBrZXlzIGNoYW5nZSBoZWlnaHQ7IFNoaWZ0K0Fycm93IHByb3ZpZGVzIG9uZS1waXhlbCBwcmVjaXNpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0tleWJvYXJkRXZlbnR9IGV2ZW50IFJlc2l6ZS1jb250cm9sIGtleWJvYXJkIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX3Bpbm5lZF9yZXNpemVfa2V5ZG93biggZXZlbnQgKSB7XG5cdFx0XHR2YXIgc3VyZmFjZV9yZWN0O1xuXHRcdFx0dmFyIHdpZHRoX2RlbHRhID0gMDtcblx0XHRcdHZhciBoZWlnaHRfZGVsdGEgPSAwO1xuXHRcdFx0dmFyIGRpc3RhbmNlID0gZXZlbnQuc2hpZnRLZXkgPyAxIDogMTA7XG5cdFx0XHR2YXIgYW5jaG9yX3JpZ2h0O1xuXG5cdFx0XHRpZiAoICEgcGlubmVkIHx8ICEgcmVzaXphYmxlX3doZW5fcGlubmVkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRhbmNob3JfcmlnaHQgPSBpc19zdXJmYWNlX3JpZ2h0X3RvX2xlZnQoKTtcblx0XHRcdGlmICggJ0Fycm93TGVmdCcgPT09IGV2ZW50LmtleSApIHtcblx0XHRcdFx0d2lkdGhfZGVsdGEgPSBhbmNob3JfcmlnaHQgPyBkaXN0YW5jZSA6IC1kaXN0YW5jZTtcblx0XHRcdH0gZWxzZSBpZiAoICdBcnJvd1JpZ2h0JyA9PT0gZXZlbnQua2V5ICkge1xuXHRcdFx0XHR3aWR0aF9kZWx0YSA9IGFuY2hvcl9yaWdodCA/IC1kaXN0YW5jZSA6IGRpc3RhbmNlO1xuXHRcdFx0fSBlbHNlIGlmICggJ0Fycm93VXAnID09PSBldmVudC5rZXkgKSB7XG5cdFx0XHRcdGhlaWdodF9kZWx0YSA9IC1kaXN0YW5jZTtcblx0XHRcdH0gZWxzZSBpZiAoICdBcnJvd0Rvd24nID09PSBldmVudC5rZXkgKSB7XG5cdFx0XHRcdGhlaWdodF9kZWx0YSA9IGRpc3RhbmNlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0c3VyZmFjZV9yZWN0ID0gc3VyZmFjZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdHJlc2l6ZV9waW5uZWRfc3VyZmFjZShcblx0XHRcdFx0c3VyZmFjZV9yZWN0LndpZHRoICsgd2lkdGhfZGVsdGEsXG5cdFx0XHRcdHN1cmZhY2VfcmVjdC5oZWlnaHQgKyBoZWlnaHRfZGVsdGEsXG5cdFx0XHRcdGFuY2hvcl9yaWdodFxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTeW5jaHJvbml6ZSB0aGUgb3B0aW9uYWwgbmV1dHJhbCBwaW4gY29udHJvbC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3luY2hyb25pemVfcGluX2NvbnRyb2woKSB7XG5cdFx0XHR2YXIgcGluX2xhYmVsO1xuXG5cdFx0XHRpZiAoIHRpcHB5X2luc3RhbmNlICYmIHRpcHB5X2luc3RhbmNlLnBvcHBlciApIHtcblx0XHRcdFx0aWYgKCBoaWRlX2Fycm93X3doZW5fcGlubmVkICYmIHBpbm5lZCApIHtcblx0XHRcdFx0XHR0aXBweV9pbnN0YW5jZS5wb3BwZXIuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXNoYXJlZC11aS1jb250ZXh0LXBvcG92ZXItaGlkZS1hcnJvdycsICd0cnVlJyApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRpcHB5X2luc3RhbmNlLnBvcHBlci5yZW1vdmVBdHRyaWJ1dGUoICdkYXRhLXdwYmMtc2hhcmVkLXVpLWNvbnRleHQtcG9wb3Zlci1oaWRlLWFycm93JyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICggZHJhZ19idXR0b24gKSB7XG5cdFx0XHRcdGRyYWdfYnV0dG9uLmhpZGRlbiA9ICEgcGlubmVkO1xuXHRcdFx0XHRkcmFnX2J1dHRvbi5kaXNhYmxlZCA9ICEgcGlubmVkO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCByZXNpemVfYnV0dG9uICkge1xuXHRcdFx0XHRyZXNpemVfYnV0dG9uLmhpZGRlbiA9ICEgcGlubmVkO1xuXHRcdFx0XHRyZXNpemVfYnV0dG9uLmRpc2FibGVkID0gISBwaW5uZWQ7XG5cdFx0XHR9XG5cdFx0XHRzdXJmYWNlLnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1zaGFyZWQtdWktY29udGV4dC1wb3BvdmVyLXBpbm5lZCcsIHBpbm5lZCA/ICd0cnVlJyA6ICdmYWxzZScgKTtcblx0XHRcdGlmICggISBwaW5fYnV0dG9uIHx8ICEgcGluX2J1dHRvbl9sYWJlbCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cGluX2xhYmVsID0gcGlubmVkXG5cdFx0XHRcdD8gU3RyaW5nKCBwaW5fYnV0dG9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtcGlubmVkLWxhYmVsJyApIHx8ICcnIClcblx0XHRcdFx0OiBTdHJpbmcoIHBpbl9idXR0b24uZ2V0QXR0cmlidXRlKCAnZGF0YS1waW4tbGFiZWwnICkgfHwgJycgKTtcblx0XHRcdHBpbl9idXR0b24uc2V0QXR0cmlidXRlKCAnYXJpYS1wcmVzc2VkJywgcGlubmVkID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdFx0cGluX2J1dHRvbi5zZXRBdHRyaWJ1dGUoXG5cdFx0XHRcdCdhcmlhLWxhYmVsJyxcblx0XHRcdFx0cGlubmVkXG5cdFx0XHRcdFx0PyBTdHJpbmcoIHBpbl9idXR0b24uZ2V0QXR0cmlidXRlKCAnZGF0YS11bnBpbi1sYWJlbCcgKSB8fCBwaW5fbGFiZWwgKVxuXHRcdFx0XHRcdDogcGluX2xhYmVsXG5cdFx0XHQpO1xuXHRcdFx0cGluX2J1dHRvbl9sYWJlbC50ZXh0Q29udGVudCA9IHBpbl9sYWJlbDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDaGFuZ2UgdGhlIG5ldXRyYWwgcGluIHN0YXRlIGZvciBhbiBvcHRlZC1pbiBjb250cm9sbGVyLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBzaG91bGRfcGluIFJlcXVlc3RlZCBwaW4gc3RhdGUuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSByZXF1ZXN0ZWQgc3RhdGUgaXMgYWN0aXZlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNldF9waW5uZWQoIHNob3VsZF9waW4gKSB7XG5cdFx0XHR2YXIgcG9wcGVyX3JlY3Q7XG5cblx0XHRcdHNob3VsZF9waW4gPSBCb29sZWFuKCBzaG91bGRfcGluICk7XG5cdFx0XHRpZiAoIGRlc3Ryb3llZCB8fCAnbWFudWFsJyAhPT0gcGluX3BvbGljeSB8fCAoIHNob3VsZF9waW4gJiYgISBjdXJyZW50X3RyaWdnZXIgKSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0Y2FuY2VsX2ludGVyYWN0aW9uX3RpbWVycygpO1xuXHRcdFx0aWYgKCBzaG91bGRfcGluICYmICEgcGlubmVkICYmIHBpbl90b192aWV3cG9ydCAmJiB0aXBweV9pbnN0YW5jZSAmJiB0aXBweV9pbnN0YW5jZS5wb3BwZXIgKSB7XG5cdFx0XHRcdHBvcHBlcl9yZWN0ID0gdGlwcHlfaW5zdGFuY2UucG9wcGVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0XHRwaW5uZWRfdmlld3BvcnRfcG9zaXRpb24gPSBjbGFtcF9waW5uZWRfdmlld3BvcnRfcG9zaXRpb24oIHBvcHBlcl9yZWN0LmxlZnQsIHBvcHBlcl9yZWN0LnRvcCApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHNob3VsZF9waW4gKSB7XG5cdFx0XHRcdGZpbmlzaF9waW5uZWRfZHJhZygpO1xuXHRcdFx0XHRmaW5pc2hfcGlubmVkX3Jlc2l6ZSgpO1xuXHRcdFx0XHRjbGVhcl9waW5uZWRfc3VyZmFjZV9zaXplKCk7XG5cdFx0XHR9XG5cdFx0XHRwaW5uZWQgPSBzaG91bGRfcGluO1xuXHRcdFx0aWYgKCBwaW5uZWQgJiYgY3VycmVudF90cmlnZ2VyICYmICEgcGluX3RvX3ZpZXdwb3J0ICkge1xuXHRcdFx0XHRyZWZlcmVuY2VfcmVjdF9wcm92aWRlciA9IGNyZWF0ZV90cmlnZ2VyX3JlZmVyZW5jZV9wcm92aWRlciggY3VycmVudF90cmlnZ2VyICk7XG5cdFx0XHRcdHJlZmVyZW5jZV90cmFja3NfdHJpZ2dlciA9IHRydWU7XG5cdFx0XHRcdHVwZGF0ZV9yZWZlcmVuY2UoIHJlZmVyZW5jZV9yZWN0X3Byb3ZpZGVyICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgcGlubmVkICkge1xuXHRcdFx0XHRwaW5uZWRfdmlld3BvcnRfcG9zaXRpb24gPSBudWxsO1xuXHRcdFx0fVxuXHRcdFx0YXBwbHlfcG9zaXRpb25pbmdfbW9kZSgpO1xuXHRcdFx0c3luY2hyb25pemVfcGluX2NvbnRyb2woKTtcblx0XHRcdHNjaGVkdWxlX3N1cmZhY2VfY29uc3RyYWludF91cGRhdGUoKTtcblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHNldHRpbmdzLm9uX3Bpbl9jaGFuZ2UgKSB7XG5cdFx0XHRcdHNldHRpbmdzLm9uX3Bpbl9jaGFuZ2UoIGNvbnRyb2xsZXIsIHBpbm5lZCApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHBpbm5lZCAmJiBzdXNwZW5kZWQgKSB7XG5cdFx0XHRcdGNsb3NlX2FwcHJvdmVkKCBmYWxzZSwgJ3Byb2dyYW1tYXRpYycgKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoXG5cdFx0XHRcdCEgcGlubmVkXG5cdFx0XHRcdCYmICEgc3VzcGVuZGVkXG5cdFx0XHRcdCYmIGlzX3Zpc2libGVfY29udHJvbGxlciggY29udHJvbGxlciApXG5cdFx0XHRcdCYmICEgcG9pbnRlcl9pbnNpZGVfY29tcG9zaXRlXG5cdFx0XHRcdCYmICEgaXNfY29tcG9zaXRlX25vZGUoIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgKVxuXHRcdFx0KSB7XG5cdFx0XHRcdHNjaGVkdWxlX2Nsb3NlKCk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBwaW5uZWQgPT09IHNob3VsZF9waW47XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVwb3J0IHdoZXRoZXIgdGhpcyBjb250cm9sbGVyIGN1cnJlbnRseSByZXRhaW5zIHBpbiBpZGVudGl0eS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBwaW5uZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaXNfcGlubmVkKCkge1xuXHRcdFx0cmV0dXJuIHBpbm5lZDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDbG9zZSBhZnRlciBhIGJvdW5kZWQgcG9pbnRlciBjb3JyaWRvciB1bmxlc3MgZm9jdXMgb3IgcG9pbnRlciByZXR1cm5lZC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2NoZWR1bGVfY2xvc2UoKSB7XG5cdFx0XHRpZiAoIGRlc3Ryb3llZCB8fCAhIGlzX3Zpc2libGVfY29udHJvbGxlciggY29udHJvbGxlciApIHx8ICEgdGlwcHlfaW5zdGFuY2Uuc3RhdGUuaXNWaXNpYmxlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjYW5jZWxfcGVuZGluZ19jbG9zZSgpO1xuXHRcdFx0cGVuZGluZ19jbG9zZV90aW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHBlbmRpbmdfY2xvc2VfdGltZXIgPSAwO1xuXHRcdFx0XHRpZiAoIHBvaW50ZXJfaW5zaWRlX2NvbXBvc2l0ZSB8fCBpc19jb21wb3NpdGVfbm9kZSggZG9jdW1lbnQuYWN0aXZlRWxlbWVudCApIHx8IGhhc19vcGVuX2NoaWxkX2xheWVycygpICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXF1ZXN0X2Nsb3NlKCAncG9pbnRlcl9leGl0JywgZmFsc2UgKTtcblx0XHRcdH0sIGhpZGVfZGVsYXlfbXMgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWNvcmQgYW5kIG9wdGlvbmFsbHkgdXBkYXRlIHRyaWdnZXIgQVJJQSBvbmx5IGFmdGVyIGV4cGxpY2l0IG93bmVyc2hpcC5cblx0XHQgKlxuXHRcdCAqIFRpbWVsaW5lIGJvb2tpbmcgY2FyZHMgZG8gbm90IGdyYW50IHRoaXMgb3duZXJzaGlwIGJlY2F1c2UgdGhlaXIgQVJJQVxuXHRcdCAqIHJlbGF0aW9uc2hpcCBiZWxvbmdzIHRvIHRoZSBCb29raW5nIEluc3BlY3Rvci5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHRyaWdnZXIgVHJpZ2dlciBiZWluZyBvcGVuZWQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjbGFpbV90cmlnZ2VyX2FyaWEoIHRyaWdnZXIgKSB7XG5cdFx0XHR2YXIgcmVxdWVzdGVkX3BvcHVwO1xuXG5cdFx0XHRpZiAoICEgb3duc190cmlnZ2VyX2FyaWEgfHwgISB0cmlnZ2VyICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIG93bmVkX3RyaWdnZXJfYXJpYSAmJiBvd25lZF90cmlnZ2VyX2FyaWEudHJpZ2dlciA9PT0gdHJpZ2dlciApIHtcblx0XHRcdFx0dHJpZ2dlci5zZXRBdHRyaWJ1dGUoICdhcmlhLWV4cGFuZGVkJywgJ3RydWUnICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdG93bmVkX3RyaWdnZXJfYXJpYSA9IHtcblx0XHRcdFx0dHJpZ2dlcjogdHJpZ2dlcixcblx0XHRcdFx0aGFkX2V4cGFuZGVkOiB0cmlnZ2VyLmhhc0F0dHJpYnV0ZSggJ2FyaWEtZXhwYW5kZWQnICksXG5cdFx0XHRcdGV4cGFuZGVkOiB0cmlnZ2VyLmdldEF0dHJpYnV0ZSggJ2FyaWEtZXhwYW5kZWQnICksXG5cdFx0XHRcdGhhZF9oYXNwb3B1cDogdHJpZ2dlci5oYXNBdHRyaWJ1dGUoICdhcmlhLWhhc3BvcHVwJyApLFxuXHRcdFx0XHRoYXNwb3B1cDogdHJpZ2dlci5nZXRBdHRyaWJ1dGUoICdhcmlhLWhhc3BvcHVwJyApXG5cdFx0XHR9O1xuXHRcdFx0dHJpZ2dlci5zZXRBdHRyaWJ1dGUoICdhcmlhLWV4cGFuZGVkJywgJ3RydWUnICk7XG5cdFx0XHRyZXF1ZXN0ZWRfcG9wdXAgPSBTdHJpbmcoIHNldHRpbmdzLmFyaWFfaGFzcG9wdXAgfHwgJycgKTtcblx0XHRcdGlmICggLTEgIT09IFsgJ3RydWUnLCAnbWVudScsICdsaXN0Ym94JywgJ3RyZWUnLCAnZ3JpZCcsICdkaWFsb2cnIF0uaW5kZXhPZiggcmVxdWVzdGVkX3BvcHVwICkgKSB7XG5cdFx0XHRcdHRyaWdnZXIuc2V0QXR0cmlidXRlKCAnYXJpYS1oYXNwb3B1cCcsIHJlcXVlc3RlZF9wb3B1cCApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbGVhc2UgZXhwbGljaXRseSBvd25lZCB0cmlnZ2VyIEFSSUEgd2l0aG91dCB0b3VjaGluZyBkZWZhdWx0IGNvbnN1bWVycy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVsZWFzZV90cmlnZ2VyX2FyaWEoKSB7XG5cdFx0XHR2YXIgdHJpZ2dlcjtcblxuXHRcdFx0aWYgKCAhIG93bmVkX3RyaWdnZXJfYXJpYSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dHJpZ2dlciA9IG93bmVkX3RyaWdnZXJfYXJpYS50cmlnZ2VyO1xuXHRcdFx0aWYgKCB0cmlnZ2VyICYmIHRyaWdnZXIuaXNDb25uZWN0ZWQgKSB7XG5cdFx0XHRcdGlmICggb3duZWRfdHJpZ2dlcl9hcmlhLmhhZF9leHBhbmRlZCApIHtcblx0XHRcdFx0XHR0cmlnZ2VyLnNldEF0dHJpYnV0ZSggJ2FyaWEtZXhwYW5kZWQnLCBvd25lZF90cmlnZ2VyX2FyaWEuZXhwYW5kZWQgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0cmlnZ2VyLnJlbW92ZUF0dHJpYnV0ZSggJ2FyaWEtZXhwYW5kZWQnICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBvd25lZF90cmlnZ2VyX2FyaWEuaGFkX2hhc3BvcHVwICkge1xuXHRcdFx0XHRcdHRyaWdnZXIuc2V0QXR0cmlidXRlKCAnYXJpYS1oYXNwb3B1cCcsIG93bmVkX3RyaWdnZXJfYXJpYS5oYXNwb3B1cCApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRyaWdnZXIucmVtb3ZlQXR0cmlidXRlKCAnYXJpYS1oYXNwb3B1cCcgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0b3duZWRfdHJpZ2dlcl9hcmlhID0gbnVsbDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBGaW5kIGFuZCBmb2N1cyB0aGUgZmlyc3QgZW5hYmxlZCBjb250cm9sIGluc2lkZSB0aGlzIG93bmVkIHN1cmZhY2UuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gYW4gb3duZWQgY29udHJvbCByZWNlaXZlZCBmb2N1cy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBmb2N1c19maXJzdF9jb250cm9sKCkge1xuXHRcdFx0dmFyIG93bmVyX3NlbGVjdG9yID0gJ1tkYXRhLXdwYmMtc2hhcmVkLXVpLWNvbnRleHQtcG9wb3Zlci1vd25lcj1cIicgKyBjb21wb25lbnRfaWQgKyAnXCJdJztcblx0XHRcdHZhciBmb2N1c2FibGVfc2VsZWN0b3IgPSAnYVtocmVmXSwgYnV0dG9uOm5vdChbZGlzYWJsZWRdKSwgaW5wdXQ6bm90KFtkaXNhYmxlZF0pLCBzZWxlY3Q6bm90KFtkaXNhYmxlZF0pLCB0ZXh0YXJlYTpub3QoW2Rpc2FibGVkXSksIFt0YWJpbmRleF06bm90KFt0YWJpbmRleD1cIi0xXCJdKSc7XG5cdFx0XHR2YXIgb3duZWRfc3VyZmFjZXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCBvd25lcl9zZWxlY3RvciApO1xuXHRcdFx0dmFyIGZvY3VzZWQgPSBmYWxzZTtcblxuXHRcdFx0QXJyYXkucHJvdG90eXBlLnNvbWUuY2FsbCggb3duZWRfc3VyZmFjZXMsIGZ1bmN0aW9uICggb3duZWRfc3VyZmFjZSApIHtcblx0XHRcdFx0cmV0dXJuIEFycmF5LnByb3RvdHlwZS5zb21lLmNhbGwoIG93bmVkX3N1cmZhY2UucXVlcnlTZWxlY3RvckFsbCggZm9jdXNhYmxlX3NlbGVjdG9yICksIGZ1bmN0aW9uICggY29udHJvbCApIHtcblx0XHRcdFx0XHRpZiAoIGNvbnRyb2wuaGlkZGVuIHx8IGNvbnRyb2wuY2xvc2VzdCggJ1toaWRkZW5dLCBbYXJpYS1oaWRkZW49XCJ0cnVlXCJdJyApICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb250cm9sLmZvY3VzKCk7XG5cdFx0XHRcdFx0Zm9jdXNlZCA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgPT09IGNvbnRyb2w7XG5cblx0XHRcdFx0XHRyZXR1cm4gZm9jdXNlZDtcblx0XHRcdFx0fSApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gZm9jdXNlZDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBUZXN0IHRoZSBkZWZhdWx0IG9yIGRvbWFpbi1zdXBwbGllZCBmb2N1cy1lbnRyeSBrZXlib2FyZCBjb21tYW5kLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBldmVudCAgIENhbmRpZGF0ZSBrZXlib2FyZCBldmVudC5cblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSAgdHJpZ2dlciBDYW5kaWRhdGUgdHJpZ2dlci5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGV2ZW50IHJlcXVlc3RzIGZvY3VzIGluc2lkZSB0aGUgcG9wb3Zlci5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpc19mb2N1c19lbnRyeV9jb21tYW5kKCBldmVudCwgdHJpZ2dlciApIHtcblx0XHRcdGlmICggZXZlbnQgJiYgZXZlbnQuYWx0S2V5ICYmICEgZXZlbnQuY3RybEtleSAmJiAhIGV2ZW50Lm1ldGFLZXkgJiYgJ0Fycm93RG93bicgPT09IGV2ZW50LmtleSApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiBzZXR0aW5ncy5pc19mb2N1c19lbnRyeV9rZXkgKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWUgPT09IHNldHRpbmdzLmlzX2ZvY3VzX2VudHJ5X2tleSggZXZlbnQsIHRyaWdnZXIsIGNvbnRyb2xsZXIgKTtcblx0XHRcdFx0fSBjYXRjaCAoIGVycm9yICkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVtb3ZlIG9ubHkgdGhpcyBzdXJmYWNlJ3MgYWNjZXNzaWJsZSBkZXNjcmlwdGlvbiB0b2tlbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVtb3ZlX2Rlc2NyaXB0aW9uKCkge1xuXHRcdFx0dmFyIGRlc2NyaXB0aW9uX2lkcztcblxuXHRcdFx0aWYgKCAhIGRlc2NyaWJlZF90cmlnZ2VyICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRkZXNjcmlwdGlvbl9pZHMgPSBTdHJpbmcoIGRlc2NyaWJlZF90cmlnZ2VyLmdldEF0dHJpYnV0ZSggJ2FyaWEtZGVzY3JpYmVkYnknICkgfHwgJycgKS5zcGxpdCggL1xccysvICkuZmlsdGVyKCBmdW5jdGlvbiAoIGRlc2NyaXB0aW9uX2lkICkge1xuXHRcdFx0XHRyZXR1cm4gZGVzY3JpcHRpb25faWQgJiYgY29tcG9uZW50X2lkICE9PSBkZXNjcmlwdGlvbl9pZDtcblx0XHRcdH0gKTtcblx0XHRcdGlmICggZGVzY3JpcHRpb25faWRzLmxlbmd0aCApIHtcblx0XHRcdFx0ZGVzY3JpYmVkX3RyaWdnZXIuc2V0QXR0cmlidXRlKCAnYXJpYS1kZXNjcmliZWRieScsIGRlc2NyaXB0aW9uX2lkcy5qb2luKCAnICcgKSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZGVzY3JpYmVkX3RyaWdnZXIucmVtb3ZlQXR0cmlidXRlKCAnYXJpYS1kZXNjcmliZWRieScgKTtcblx0XHRcdH1cblx0XHRcdGRlc2NyaWJlZF90cmlnZ2VyID0gbnVsbDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBZGQgdGhlIHByZXZpZXcgc3VyZmFjZSBhcyBvbmUgZGVzY3JpcHRpb24gd2l0aG91dCByZXBsYWNpbmcgb3RoZXIgSURzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBhZGRfZGVzY3JpcHRpb24oKSB7XG5cdFx0XHR2YXIgZGVzY3JpcHRpb25faWRzO1xuXG5cdFx0XHRyZW1vdmVfZGVzY3JpcHRpb24oKTtcblx0XHRcdGlmICggJ3ByZXZpZXcnICE9PSBtb2RlIHx8ICEgY3VycmVudF90cmlnZ2VyICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRkZXNjcmlwdGlvbl9pZHMgPSBTdHJpbmcoIGN1cnJlbnRfdHJpZ2dlci5nZXRBdHRyaWJ1dGUoICdhcmlhLWRlc2NyaWJlZGJ5JyApIHx8ICcnICkuc3BsaXQoIC9cXHMrLyApLmZpbHRlciggQm9vbGVhbiApO1xuXHRcdFx0aWYgKCAtMSA9PT0gZGVzY3JpcHRpb25faWRzLmluZGV4T2YoIGNvbXBvbmVudF9pZCApICkge1xuXHRcdFx0XHRkZXNjcmlwdGlvbl9pZHMucHVzaCggY29tcG9uZW50X2lkICk7XG5cdFx0XHR9XG5cdFx0XHRjdXJyZW50X3RyaWdnZXIuc2V0QXR0cmlidXRlKCAnYXJpYS1kZXNjcmliZWRieScsIGRlc2NyaXB0aW9uX2lkcy5qb2luKCAnICcgKSApO1xuXHRcdFx0ZGVzY3JpYmVkX3RyaWdnZXIgPSBjdXJyZW50X3RyaWdnZXI7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSGlkZSBhbGwgc2hlbGwgc3RhdGUgaG9zdHMgYmVmb3JlIGFjdGl2YXRpbmcgb25lIHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoaWRlX3N0YXRlX2hvc3RzKCkge1xuXHRcdFx0bG9hZGluZy5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0Y29udGVudC5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0ZW1wdHkuaGlkZGVuID0gdHJ1ZTtcblx0XHRcdGVycm9yLmhpZGRlbiA9IHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSB2aXNpYmxlIHZpZXdwb3J0J3MgdmVydGljYWwgYm91bmRzIGZvciBmaXhlZCBwb3NpdGlvbmluZy5cblx0XHQgKlxuXHRcdCAqIFRoZSBWaXN1YWwgVmlld3BvcnQgdmFsdWVzIGtlZXAgdGhlIGNvbnN0cmFpbnQgY29ycmVjdCBkdXJpbmcgYnJvd3NlclxuXHRcdCAqIHpvb20gd2l0aG91dCBhc3NpZ25pbmcgdGhlIHBvcG92ZXIncyBhY3R1YWwgY29vcmRpbmF0ZXMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IE51bWVyaWMgdG9wIGFuZCBib3R0b20gdmlld3BvcnQgY29vcmRpbmF0ZXMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3ZlcnRpY2FsX3ZpZXdwb3J0X2JvdW5kcygpIHtcblx0XHRcdHZhciB2aXN1YWxfdmlld3BvcnQgPSB3aW5kb3cudmlzdWFsVmlld3BvcnQ7XG5cdFx0XHR2YXIgdmlld3BvcnRfdG9wID0gdmlzdWFsX3ZpZXdwb3J0ICYmIE51bWJlci5pc0Zpbml0ZSggdmlzdWFsX3ZpZXdwb3J0Lm9mZnNldFRvcCApXG5cdFx0XHRcdD8gdmlzdWFsX3ZpZXdwb3J0Lm9mZnNldFRvcFxuXHRcdFx0XHQ6IDA7XG5cdFx0XHR2YXIgdmlld3BvcnRfaGVpZ2h0ID0gdmlzdWFsX3ZpZXdwb3J0ICYmIE51bWJlci5pc0Zpbml0ZSggdmlzdWFsX3ZpZXdwb3J0LmhlaWdodCApXG5cdFx0XHRcdD8gdmlzdWFsX3ZpZXdwb3J0LmhlaWdodFxuXHRcdFx0XHQ6IE1hdGgubWF4KCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50SGVpZ2h0IHx8IDAsIHdpbmRvdy5pbm5lckhlaWdodCB8fCAwICk7XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHRvcDogdmlld3BvcnRfdG9wLFxuXHRcdFx0XHRib3R0b206IHZpZXdwb3J0X3RvcCArIHZpZXdwb3J0X2hlaWdodFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXNvbHZlIHRoZSB2ZXJ0aWNhbCBib3VuZHMgdXNlZCBvbmx5IGZvciBmaXJzdC1vcGVuIHNpZGUgc2VsZWN0aW9uLlxuXHRcdCAqXG5cdFx0ICogQ29uc3VtZXJzIHdpdGggYSBjbGlwcGVkIG9yIHN0aWNreSBob3N0IG1heSBzdXBwbHkgYSBsaXZlIHJlY3RhbmdsZS4gVGhlXG5cdFx0ICogcmVjdGFuZ2xlIGlzIGludGVyc2VjdGVkIHdpdGggdGhlIFZpc3VhbCBWaWV3cG9ydCBzbyBicm93c2VyIHpvb20gcmVtYWluc1xuXHRcdCAqIGF1dGhvcml0YXRpdmUuIEludmFsaWQgY29uc3VtZXIgb3V0cHV0IGZhbGxzIGJhY2sgdG8gdGhlIHZpZXdwb3J0IGNvbnRyYWN0LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBOdW1lcmljIHRvcCBhbmQgYm90dG9tIGNvb3JkaW5hdGVzIGluIHZpZXdwb3J0IHNwYWNlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9pbml0aWFsX3ZlcnRpY2FsX3BsYWNlbWVudF9ib3VuZHMoKSB7XG5cdFx0XHR2YXIgdmlld3BvcnRfYm91bmRzID0gZ2V0X3ZlcnRpY2FsX3ZpZXdwb3J0X2JvdW5kcygpO1xuXHRcdFx0dmFyIGNhbmRpZGF0ZV9ib3VuZHM7XG5cdFx0XHR2YXIgY2FuZGlkYXRlX3JlY3RhbmdsZTtcblxuXHRcdFx0aWYgKCAhIGdldF9pbml0aWFsX3BsYWNlbWVudF9ib3VuZHMgKSB7XG5cdFx0XHRcdHJldHVybiB2aWV3cG9ydF9ib3VuZHM7XG5cdFx0XHR9XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjYW5kaWRhdGVfcmVjdGFuZ2xlID0gbm9ybWFsaXplX3JlZmVyZW5jZV9yZWN0KCBnZXRfaW5pdGlhbF9wbGFjZW1lbnRfYm91bmRzKCkgKTtcblx0XHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdFx0Y2FuZGlkYXRlX3JlY3RhbmdsZSA9IG51bGw7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgY2FuZGlkYXRlX3JlY3RhbmdsZSApIHtcblx0XHRcdFx0cmV0dXJuIHZpZXdwb3J0X2JvdW5kcztcblx0XHRcdH1cblx0XHRcdGNhbmRpZGF0ZV9ib3VuZHMgPSB7XG5cdFx0XHRcdHRvcDogTWF0aC5tYXgoIHZpZXdwb3J0X2JvdW5kcy50b3AsIGNhbmRpZGF0ZV9yZWN0YW5nbGUudG9wICksXG5cdFx0XHRcdGJvdHRvbTogTWF0aC5taW4oIHZpZXdwb3J0X2JvdW5kcy5ib3R0b20sIGNhbmRpZGF0ZV9yZWN0YW5nbGUuYm90dG9tIClcblx0XHRcdH07XG5cblx0XHRcdHJldHVybiBjYW5kaWRhdGVfYm91bmRzLmJvdHRvbSA+IGNhbmRpZGF0ZV9ib3VuZHMudG9wID8gY2FuZGlkYXRlX2JvdW5kcyA6IHZpZXdwb3J0X2JvdW5kcztcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBNZWFzdXJlIHRoZSB2ZXJ0aWNhbCByb29tIGF2YWlsYWJsZSBvbiBvbmUgcmVmZXJlbmNlIHNpZGUuXG5cdFx0ICpcblx0XHQgKiBJbml0aWFsIHNpZGUgc2VsZWN0aW9uIHVzZXMgdGhlIFZpc3VhbCBWaWV3cG9ydCBpbnRlcnNlY3RlZCB3aXRoIGFuIG9wdGlvbmFsXG5cdFx0ICogY29uc3VtZXItc3VwcGxpZWQgdmlzaWJsZSBob3N0IHJlY3RhbmdsZS4gVGhlIHNlbGVjdGVkIHNpZGUgaXMgdGhlbiByZXRhaW5lZFxuXHRcdCAqIHdoaWxlIGEgc2Nyb2xsLW93bmVkIGhvc3QgbW92ZXMgYW5kIGNsaXBzIHRoZSBzdXJmYWNlIGJlbmVhdGggc3RpY2t5IFVJLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHBsYWNlbWVudCAgICAgQWxsb3ctbGlzdGVkIFBvcHBlciBwbGFjZW1lbnQuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJlZmVyZW5jZV9yZWN0IE5vcm1hbGl6ZWQgcmVmZXJlbmNlIHJlY3RhbmdsZS5cblx0XHQgKiBAcmV0dXJuIHtudW1iZXJ9IEF2YWlsYWJsZSBwaXhlbHMsIG9yIG5lZ2F0aXZlIGluZmluaXR5IGZvciBhIG5vbi12ZXJ0aWNhbCBzaWRlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF92ZXJ0aWNhbF9wbGFjZW1lbnRfc3BhY2UoIHBsYWNlbWVudCwgcmVmZXJlbmNlX3JlY3QgKSB7XG5cdFx0XHR2YXIgcGxhY2VtZW50X3NpZGUgPSBTdHJpbmcoIHBsYWNlbWVudCB8fCAnJyApLnNwbGl0KCAnLScgKVswXTtcblx0XHRcdHZhciB2aXNpYmxlX2JvdW5kcyA9IGdldF9pbml0aWFsX3ZlcnRpY2FsX3BsYWNlbWVudF9ib3VuZHMoKTtcblx0XHRcdHZhciByZWZlcmVuY2VfZ2FwID0gMTA7XG5cblx0XHRcdGlmICggJ2JvdHRvbScgPT09IHBsYWNlbWVudF9zaWRlICkge1xuXHRcdFx0XHRyZXR1cm4gdmlzaWJsZV9ib3VuZHMuYm90dG9tIC0gcmVmZXJlbmNlX3JlY3QuYm90dG9tIC0gcmVmZXJlbmNlX2dhcCAtIHZpZXdwb3J0X3BhZGRpbmc7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICd0b3AnID09PSBwbGFjZW1lbnRfc2lkZSApIHtcblx0XHRcdFx0cmV0dXJuIHJlZmVyZW5jZV9yZWN0LnRvcCAtIHJlZmVyZW5jZV9nYXAgLSB2aXNpYmxlX2JvdW5kcy50b3AgLSB2aWV3cG9ydF9wYWRkaW5nO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gTnVtYmVyLk5FR0FUSVZFX0lORklOSVRZO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENob29zZSBhbiBhbGxvd2VkIHZlcnRpY2FsIHNpZGUgYmVmb3JlIHRoZSBmaXJzdCBQb3BwZXIgbWVhc3VyZW1lbnQuXG5cdFx0ICpcblx0XHQgKiBBIGZpeGVkLWhlaWdodCBzdXJmYWNlIGNhbiBtYWtlIHRoZSByZXF1ZXN0ZWQgc2lkZSB0b28gc2hvcnQuIEluIHRoYXRcblx0XHQgKiBjYXNlLCBhbGxvd2luZyBwcmV2ZW50T3ZlcmZsb3cgdG8gdHJhbnNsYXRlIHRoZSBzYW1lIHBsYWNlbWVudCB3b3VsZFxuXHRcdCAqIG1vdmUgdGhlIHN1cmZhY2UgYWNyb3NzIGl0cyByZWZlcmVuY2UuIFByZWZlciBhIGNvbmZpZ3VyZWQgZmFsbGJhY2sgdGhhdFxuXHRcdCAqIGZpdHMsIG9yIHRoZSBzaWRlIHdpdGggdGhlIG1vc3Qgcm9vbSB3aGVuIG5laXRoZXIgc2lkZSBjYW4gZnVsbHkgZml0LlxuXHRcdCAqIFBvcHBlciByZW1haW5zIHJlc3BvbnNpYmxlIGZvciBleGFjdCBjb29yZGluYXRlcywgY29sbGlzaW9uIGNvcnJlY3Rpb24sXG5cdFx0ICogYW5kIGFycm93IGFsaWdubWVudC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZWZlcmVuY2VfcmVjdCBOb3JtYWxpemVkIHJlZmVyZW5jZSByZWN0YW5nbGUuXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBSZXF1ZXN0ZWQgb3IgZmFsbGJhY2sgYWxsb3ctbGlzdGVkIHBsYWNlbWVudC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXNvbHZlX2luaXRpYWxfcGxhY2VtZW50KCByZWZlcmVuY2VfcmVjdCApIHtcblx0XHRcdHZhciByZXF1ZXN0ZWRfcGxhY2VtZW50ID0gbm9ybWFsaXplX3BsYWNlbWVudCggc2V0dGluZ3MucGxhY2VtZW50ICk7XG5cdFx0XHR2YXIgcmVxdWVzdGVkX3NpZGUgPSByZXF1ZXN0ZWRfcGxhY2VtZW50LnNwbGl0KCAnLScgKVswXTtcblx0XHRcdHZhciBzdXJmYWNlX3JlY3Q7XG5cdFx0XHR2YXIgcmVxdWlyZWRfaGVpZ2h0O1xuXHRcdFx0dmFyIHJlcXVlc3RlZF9zcGFjZTtcblx0XHRcdHZhciBiZXN0X3BsYWNlbWVudCA9IHJlcXVlc3RlZF9wbGFjZW1lbnQ7XG5cdFx0XHR2YXIgYmVzdF9zcGFjZTtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHQhIGZpdF9vbl9maXJzdF9vcGVuXG5cdFx0XHRcdHx8IHBpbm5lZFxuXHRcdFx0XHR8fCAwID49IGZpeGVkX3VucGlubmVkX2hlaWdodFxuXHRcdFx0XHR8fCAtMSA9PT0gWyAndG9wJywgJ2JvdHRvbScgXS5pbmRleE9mKCByZXF1ZXN0ZWRfc2lkZSApXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIHJlcXVlc3RlZF9wbGFjZW1lbnQ7XG5cdFx0XHR9XG5cdFx0XHRzdXJmYWNlX3JlY3QgPSBzdXJmYWNlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0cmVxdWlyZWRfaGVpZ2h0ID0gTWF0aC5tYXgoXG5cdFx0XHRcdGZpeGVkX3VucGlubmVkX2hlaWdodCxcblx0XHRcdFx0TnVtYmVyLmlzRmluaXRlKCBzdXJmYWNlX3JlY3QuaGVpZ2h0ICkgPyBzdXJmYWNlX3JlY3QuaGVpZ2h0IDogMFxuXHRcdFx0KTtcblx0XHRcdHJlcXVlc3RlZF9zcGFjZSA9IGdldF92ZXJ0aWNhbF9wbGFjZW1lbnRfc3BhY2UoIHJlcXVlc3RlZF9wbGFjZW1lbnQsIHJlZmVyZW5jZV9yZWN0ICk7XG5cdFx0XHRpZiAoIHJlcXVlc3RlZF9zcGFjZSA+PSByZXF1aXJlZF9oZWlnaHQgKSB7XG5cdFx0XHRcdHJldHVybiByZXF1ZXN0ZWRfcGxhY2VtZW50O1xuXHRcdFx0fVxuXHRcdFx0YmVzdF9zcGFjZSA9IHJlcXVlc3RlZF9zcGFjZTtcblx0XHRcdGZhbGxiYWNrX3BsYWNlbWVudHMuc29tZSggZnVuY3Rpb24gKCBmYWxsYmFja19wbGFjZW1lbnQgKSB7XG5cdFx0XHRcdHZhciBmYWxsYmFja19zaWRlID0gZmFsbGJhY2tfcGxhY2VtZW50LnNwbGl0KCAnLScgKVswXTtcblx0XHRcdFx0dmFyIGZhbGxiYWNrX3NwYWNlO1xuXG5cdFx0XHRcdGlmICggLTEgPT09IFsgJ3RvcCcsICdib3R0b20nIF0uaW5kZXhPZiggZmFsbGJhY2tfc2lkZSApICkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRmYWxsYmFja19zcGFjZSA9IGdldF92ZXJ0aWNhbF9wbGFjZW1lbnRfc3BhY2UoIGZhbGxiYWNrX3BsYWNlbWVudCwgcmVmZXJlbmNlX3JlY3QgKTtcblx0XHRcdFx0aWYgKCBmYWxsYmFja19zcGFjZSA+IGJlc3Rfc3BhY2UgKSB7XG5cdFx0XHRcdFx0YmVzdF9wbGFjZW1lbnQgPSBmYWxsYmFja19wbGFjZW1lbnQ7XG5cdFx0XHRcdFx0YmVzdF9zcGFjZSA9IGZhbGxiYWNrX3NwYWNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBmYWxsYmFja19zcGFjZSA+PSByZXF1aXJlZF9oZWlnaHQ7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiBiZXN0X3BsYWNlbWVudDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBCb3VuZCB0aGUgc3VyZmFjZSB3aWR0aCB0byBhbiBvcHRlZC1pbiBob3N0IGJvdW5kYXJ5IGFuZCB2aWV3cG9ydC5cblx0XHQgKlxuXHRcdCAqIFBvcHBlciByZW1haW5zIHJlc3BvbnNpYmxlIGZvciBjb29yZGluYXRlcy4gVGhpcyBtZXRob2Qgc3VwcGxpZXMgb25seSBhXG5cdFx0ICogQ1NTIHdpZHRoIGxpbWl0IHNvIGFuIG92ZXJzaXplZCBib2R5IHBvcnRhbCBjYW5ub3QgcGFpbnQgYWNyb3NzIGEgZnJvemVuXG5cdFx0ICogc2libGluZyBwYW5lIHdoZW4gdGhlIGhvc3QncyB2aXNpYmxlIGNhbnZhcyBpcyBuYXJyb3dlciB0aGFuIHRoZSBwcmVmZXJyZWRcblx0XHQgKiBzdXJmYWNlIHdpZHRoLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjb25zdHJhaW5fc3VyZmFjZV90b19wb3NpdGlvbmluZ19ib3VuZGFyeSgpIHtcblx0XHRcdHZhciBib3VuZGFyeV9yZWN0O1xuXHRcdFx0dmFyIHZpc3VhbF92aWV3cG9ydCA9IHdpbmRvdy52aXN1YWxWaWV3cG9ydDtcblx0XHRcdHZhciB2aWV3cG9ydF9sZWZ0O1xuXHRcdFx0dmFyIHZpZXdwb3J0X3dpZHRoO1xuXHRcdFx0dmFyIHZpc2libGVfbGVmdDtcblx0XHRcdHZhciB2aXNpYmxlX3JpZ2h0O1xuXG5cdFx0XHRpZiAoICggcGlubmVkICYmIHBpbl90b192aWV3cG9ydCApIHx8ICd2aWV3cG9ydCcgPT09IHBvc2l0aW9uaW5nX2JvdW5kYXJ5IHx8ICEgcG9zaXRpb25pbmdfYm91bmRhcnkuaXNDb25uZWN0ZWQgKSB7XG5cdFx0XHRcdHN1cmZhY2Uuc3R5bGUucmVtb3ZlUHJvcGVydHkoIGF2YWlsYWJsZV9pbmxpbmVfc2l6ZV9wcm9wZXJ0eSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRib3VuZGFyeV9yZWN0ID0gcG9zaXRpb25pbmdfYm91bmRhcnkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHR2aWV3cG9ydF9sZWZ0ID0gdmlzdWFsX3ZpZXdwb3J0ICYmIE51bWJlci5pc0Zpbml0ZSggdmlzdWFsX3ZpZXdwb3J0Lm9mZnNldExlZnQgKVxuXHRcdFx0XHQ/IHZpc3VhbF92aWV3cG9ydC5vZmZzZXRMZWZ0XG5cdFx0XHRcdDogMDtcblx0XHRcdHZpZXdwb3J0X3dpZHRoID0gdmlzdWFsX3ZpZXdwb3J0ICYmIE51bWJlci5pc0Zpbml0ZSggdmlzdWFsX3ZpZXdwb3J0LndpZHRoIClcblx0XHRcdFx0PyB2aXN1YWxfdmlld3BvcnQud2lkdGhcblx0XHRcdFx0OiBNYXRoLm1heCggZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudFdpZHRoIHx8IDAsIHdpbmRvdy5pbm5lcldpZHRoIHx8IDAgKTtcblx0XHRcdHZpc2libGVfbGVmdCA9IE1hdGgubWF4KCBib3VuZGFyeV9yZWN0LmxlZnQsIHZpZXdwb3J0X2xlZnQgKTtcblx0XHRcdHZpc2libGVfcmlnaHQgPSBNYXRoLm1pbiggYm91bmRhcnlfcmVjdC5yaWdodCwgdmlld3BvcnRfbGVmdCArIHZpZXdwb3J0X3dpZHRoICk7XG5cdFx0XHRzdXJmYWNlLnN0eWxlLnNldFByb3BlcnR5KFxuXHRcdFx0XHRhdmFpbGFibGVfaW5saW5lX3NpemVfcHJvcGVydHksXG5cdFx0XHRcdE1hdGgubWF4KCAxLCBNYXRoLmZsb29yKCB2aXNpYmxlX3JpZ2h0IC0gdmlzaWJsZV9sZWZ0IC0gKCAyICogdmlld3BvcnRfcGFkZGluZyApICkgKSArICdweCdcblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVtb3ZlIGEgaGVpZ2h0IHJldGFpbmVkIGZyb20gYW4gZWFybGllciB2aXNpYmxlIHBsYWNlbWVudC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2xlYXJfc3VyZmFjZV9oZWlnaHRfY29uc3RyYWludCgpIHtcblx0XHRcdHN1cmZhY2Uuc3R5bGUucmVtb3ZlUHJvcGVydHkoIGF2YWlsYWJsZV9oZWlnaHRfcHJvcGVydHkgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBJbmNsdWRlIG9yIGV4Y2x1ZGUgdGhlIFRpcHB5IHJvb3QgZnJvbSBsYXlvdXQgYW5kIHNjcm9sbGFibGUgb3ZlcmZsb3cuXG5cdFx0ICpcblx0XHQgKiBBIGhpZGRlbiBhYnNvbHV0ZWx5IHBvc2l0aW9uZWQgcm9vdCBjYW4gb3RoZXJ3aXNlIHJldGFpbiBzdGFsZSB0cmFuc2Zvcm1lZFxuXHRcdCAqIGNvb3JkaW5hdGVzIGluc2lkZSBhIHNjcm9sbGluZyBwb3J0YWwgYW5kIGVubGFyZ2UgdGhhdCBwb3J0YWwncyBzY3JvbGxhYmxlXG5cdFx0ICogb3ZlcmZsb3cgYWZ0ZXIgaXRzIGRvbWFpbiBjb250ZW50IGhhcyBiZWVuIHJlcmVuZGVyZWQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IHNob3VsZF9wYXJ0aWNpcGF0ZSBXaGV0aGVyIHRoZSByb290IG1heSBhZmZlY3QgbGF5b3V0IG92ZXJmbG93LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X3BvcHBlcl9sYXlvdXRfcGFydGljaXBhdGlvbiggc2hvdWxkX3BhcnRpY2lwYXRlICkge1xuXHRcdFx0aWYgKCAhIHRpcHB5X2luc3RhbmNlIHx8ICEgdGlwcHlfaW5zdGFuY2UucG9wcGVyICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHNob3VsZF9wYXJ0aWNpcGF0ZSApIHtcblx0XHRcdFx0dGlwcHlfaW5zdGFuY2UucG9wcGVyLnJlbW92ZUF0dHJpYnV0ZSggJ2hpZGRlbicgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGlwcHlfaW5zdGFuY2UucG9wcGVyLnNldEF0dHJpYnV0ZSggJ2hpZGRlbicsICcnICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBiYXNlIHBsYWNlbWVudCBjdXJyZW50bHkgY29tbWl0dGVkIGJ5IFBvcHBlciBhbmQgVGlwcHkuXG5cdFx0ICpcblx0XHQgKiBUaXBweSBzdG9yZXMgYGRhdGEtcGxhY2VtZW50YCBvbiBpdHMgaW5uZXIgYC50aXBweS1ib3hgLCBub3Qgb24gdGhlXG5cdFx0ICogb3V0ZXIgcG9wcGVyIG5vZGUuIFBvcHBlciBzdGF0ZSBpcyBhdXRob3JpdGF0aXZlOyB0aGUgRE9NIGF0dHJpYnV0ZXNcblx0XHQgKiByZW1haW4gY29tcGF0aWJpbGl0eSBmYWxsYmFja3MgZm9yIHZlcnNpb25zIHRoYXQgZXhwb3NlIHN0YXRlIGxhdGVyLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBCYXNlIHBsYWNlbWVudCwgb3IgYW4gZW1wdHkgc3RyaW5nIHdoZW4gdW5hdmFpbGFibGUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2N1cnJlbnRfcGxhY2VtZW50KCkge1xuXHRcdFx0dmFyIHBsYWNlbWVudCA9ICcnO1xuXHRcdFx0dmFyIHRpcHB5X2JveDtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHR0aXBweV9pbnN0YW5jZVxuXHRcdFx0XHQmJiB0aXBweV9pbnN0YW5jZS5wb3BwZXJJbnN0YW5jZVxuXHRcdFx0XHQmJiB0aXBweV9pbnN0YW5jZS5wb3BwZXJJbnN0YW5jZS5zdGF0ZVxuXHRcdFx0KSB7XG5cdFx0XHRcdHBsYWNlbWVudCA9IFN0cmluZyggdGlwcHlfaW5zdGFuY2UucG9wcGVySW5zdGFuY2Uuc3RhdGUucGxhY2VtZW50IHx8ICcnICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgcGxhY2VtZW50ICYmIHRpcHB5X2luc3RhbmNlICYmIHRpcHB5X2luc3RhbmNlLnBvcHBlciApIHtcblx0XHRcdFx0cGxhY2VtZW50ID0gU3RyaW5nKCB0aXBweV9pbnN0YW5jZS5wb3BwZXIuZ2V0QXR0cmlidXRlKCAnZGF0YS1wb3BwZXItcGxhY2VtZW50JyApIHx8ICcnICk7XG5cdFx0XHRcdHRpcHB5X2JveCA9IHRpcHB5X2luc3RhbmNlLnBvcHBlci5xdWVyeVNlbGVjdG9yKCAnLnRpcHB5LWJveFtkYXRhLXBsYWNlbWVudF0nICk7XG5cdFx0XHRcdGlmICggISBwbGFjZW1lbnQgJiYgdGlwcHlfYm94ICkge1xuXHRcdFx0XHRcdHBsYWNlbWVudCA9IFN0cmluZyggdGlwcHlfYm94LmdldEF0dHJpYnV0ZSggJ2RhdGEtcGxhY2VtZW50JyApIHx8ICcnICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHBsYWNlbWVudC5zcGxpdCggJy0nIClbMF07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQm91bmQgZ3Jvd2luZyBjb250ZW50IHRvIHRoZSBzcGFjZSBvbiBpdHMgY3VycmVudGx5IHJlbmRlcmVkIHNpZGUuXG5cdFx0ICpcblx0XHQgKiBUaGUgdHJpZ2dlci1mYWNpbmcgZWRnZSBjb21lcyBmcm9tIHRoZSByZWZlcmVuY2UgcmVjdGFuZ2xlIHJhdGhlciB0aGFuIGFcblx0XHQgKiBzdXJmYWNlIHRoYXQgUG9wcGVyIG1heSBhbHJlYWR5IGhhdmUgdHJhbnNsYXRlZCB0byBjb250YWluIG92ZXJzaXplZFxuXHRcdCAqIGNvbnRlbnQuIFRoaXMga2VlcHMgdGhlIGFycm93IGF0dGFjaGVkIGFuZCBkZWxlZ2F0ZXMgb3ZlcmZsb3cgdG8gdGhlIHNoZWxsLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjb25zdHJhaW5fc3VyZmFjZV90b19jdXJyZW50X3BsYWNlbWVudCgpIHtcblx0XHRcdHZhciBwbGFjZW1lbnQ7XG5cdFx0XHR2YXIgcmVmZXJlbmNlX3JlY3Q7XG5cdFx0XHR2YXIgdmlld3BvcnRfYm91bmRzO1xuXHRcdFx0dmFyIGF2YWlsYWJsZV9oZWlnaHQ7XG5cdFx0XHR2YXIgcmVmZXJlbmNlX2dhcCA9IDEwO1xuXG5cdFx0XHRpZiAoXG5cdFx0XHRcdCEgdGlwcHlfaW5zdGFuY2Vcblx0XHRcdFx0fHwgISB0aXBweV9pbnN0YW5jZS5zdGF0ZS5pc1Zpc2libGVcblx0XHRcdFx0fHwgISB0aXBweV9pbnN0YW5jZS5wb3BwZXJcblx0XHRcdFx0fHwgISBzdXJmYWNlLmdldENsaWVudFJlY3RzKCkubGVuZ3RoXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBwaW5uZWQgJiYgcGluX3RvX3ZpZXdwb3J0ICYmIHBpbm5lZF92aWV3cG9ydF9wb3NpdGlvbiApIHtcblx0XHRcdFx0dmlld3BvcnRfYm91bmRzID0gZ2V0X3ZlcnRpY2FsX3ZpZXdwb3J0X2JvdW5kcygpO1xuXHRcdFx0XHRhdmFpbGFibGVfaGVpZ2h0ID0gdmlld3BvcnRfYm91bmRzLmJvdHRvbSAtIHZpZXdwb3J0X2JvdW5kcy50b3AgLSAoIDIgKiB2aWV3cG9ydF9wYWRkaW5nICk7XG5cdFx0XHRcdHN1cmZhY2Uuc3R5bGUuc2V0UHJvcGVydHkoXG5cdFx0XHRcdFx0YXZhaWxhYmxlX2hlaWdodF9wcm9wZXJ0eSxcblx0XHRcdFx0XHRNYXRoLm1heCggMSwgTWF0aC5mbG9vciggYXZhaWxhYmxlX2hlaWdodCApICkgKyAncHgnXG5cdFx0XHRcdCk7XG5cdFx0XHRcdG1vdmVfcGlubmVkX3N1cmZhY2UoIHBpbm5lZF92aWV3cG9ydF9wb3NpdGlvbi5sZWZ0LCBwaW5uZWRfdmlld3BvcnRfcG9zaXRpb24udG9wICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHBsYWNlbWVudCA9IGdldF9jdXJyZW50X3BsYWNlbWVudCgpO1xuXHRcdFx0aWYgKCAtMSA9PT0gWyAndG9wJywgJ2JvdHRvbScsICdsZWZ0JywgJ3JpZ2h0JyBdLmluZGV4T2YoIHBsYWNlbWVudCApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyZWZlcmVuY2VfcmVjdCA9IGdldF9yZWZlcmVuY2VfcmVjdCgpO1xuXHRcdFx0dmlld3BvcnRfYm91bmRzID0gZ2V0X3ZlcnRpY2FsX3ZpZXdwb3J0X2JvdW5kcygpO1xuXHRcdFx0aWYgKCAnYm90dG9tJyA9PT0gcGxhY2VtZW50ICkge1xuXHRcdFx0XHRhdmFpbGFibGVfaGVpZ2h0ID0gdmlld3BvcnRfYm91bmRzLmJvdHRvbSAtIHJlZmVyZW5jZV9yZWN0LmJvdHRvbSAtIHJlZmVyZW5jZV9nYXAgLSB2aWV3cG9ydF9wYWRkaW5nO1xuXHRcdFx0fSBlbHNlIGlmICggJ3RvcCcgPT09IHBsYWNlbWVudCApIHtcblx0XHRcdFx0YXZhaWxhYmxlX2hlaWdodCA9IHJlZmVyZW5jZV9yZWN0LnRvcCAtIHJlZmVyZW5jZV9nYXAgLSB2aWV3cG9ydF9ib3VuZHMudG9wIC0gdmlld3BvcnRfcGFkZGluZztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGF2YWlsYWJsZV9oZWlnaHQgPSB2aWV3cG9ydF9ib3VuZHMuYm90dG9tIC0gdmlld3BvcnRfYm91bmRzLnRvcCAtICggMiAqIHZpZXdwb3J0X3BhZGRpbmcgKTtcblx0XHRcdH1cblx0XHRcdGlmICggMCA8IGF2YWlsYWJsZV9oZWlnaHQgKSB7XG5cdFx0XHRcdHN1cmZhY2Uuc3R5bGUuc2V0UHJvcGVydHkoXG5cdFx0XHRcdFx0YXZhaWxhYmxlX2hlaWdodF9wcm9wZXJ0eSxcblx0XHRcdFx0XHRNYXRoLm1heCggMSwgTWF0aC5mbG9vciggYXZhaWxhYmxlX2hlaWdodCApICkgKyAncHgnXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2FuY2VsIGEgcXVldWVkIHBvc3QtbGF5b3V0IHZpZXdwb3J0IGNvbnN0cmFpbnQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNhbmNlbF9zdXJmYWNlX2NvbnN0cmFpbnRfdXBkYXRlKCkge1xuXHRcdFx0aWYgKCBwZW5kaW5nX3N1cmZhY2VfY29uc3RyYWludF9mcmFtZSApIHtcblx0XHRcdFx0d2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lKCBwZW5kaW5nX3N1cmZhY2VfY29uc3RyYWludF9mcmFtZSApO1xuXHRcdFx0XHRwZW5kaW5nX3N1cmZhY2VfY29uc3RyYWludF9mcmFtZSA9IDA7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVjb21wdXRlIHRoZSBzdXJmYWNlIGxpbWl0IGFmdGVyIFBvcHBlciBoYXMgY29tbWl0dGVkIGN1cnJlbnQgZ2VvbWV0cnkuXG5cdFx0ICpcblx0XHQgKiBTdGF0ZSB0ZW1wbGF0ZXMgbWF5IGJlIGluc3RhbGxlZCBiZWZvcmUgdGhlIG1hbnVhbCBUaXBweSBpbnN0YW5jZSBiZWNvbWVzXG5cdFx0ICogdmlzaWJsZS4gQmF0Y2hpbmcgdGhlIG1vdW50ZWQsIHNob3duLCByZXBsYWNlbWVudCwgYW5kIHZpZXdwb3J0IHBhdGhzIGludG9cblx0XHQgKiBvbmUgYW5pbWF0aW9uIGZyYW1lIHByZXZlbnRzIHRoZSBmaXJzdCBvcGVuIGZyb20gcmV0YWluaW5nIHRoZSAxMDB2aFxuXHRcdCAqIGZhbGxiYWNrIGFuZCBhdm9pZHMgcmVwZWF0ZWQgc3luY2hyb25vdXMgbGF5b3V0IHdvcmsuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNjaGVkdWxlX3N1cmZhY2VfY29uc3RyYWludF91cGRhdGUoKSB7XG5cdFx0XHRpZiAoIGRlc3Ryb3llZCB8fCBwZW5kaW5nX3N1cmZhY2VfY29uc3RyYWludF9mcmFtZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cGVuZGluZ19zdXJmYWNlX2NvbnN0cmFpbnRfZnJhbWUgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHBlbmRpbmdfc3VyZmFjZV9jb25zdHJhaW50X2ZyYW1lID0gMDtcblx0XHRcdFx0aWYgKCBkZXN0cm95ZWQgfHwgISB0aXBweV9pbnN0YW5jZSB8fCAhIHRpcHB5X2luc3RhbmNlLnN0YXRlLmlzVmlzaWJsZSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3RyYWluX3N1cmZhY2VfdG9fcG9zaXRpb25pbmdfYm91bmRhcnkoKTtcblx0XHRcdFx0aWYgKCB0aXBweV9pbnN0YW5jZS5wb3BwZXJJbnN0YW5jZSApIHtcblx0XHRcdFx0XHR0aXBweV9pbnN0YW5jZS5wb3BwZXJJbnN0YW5jZS5mb3JjZVVwZGF0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0cmFpbl9zdXJmYWNlX3RvX2N1cnJlbnRfcGxhY2VtZW50KCk7XG5cdFx0XHRcdGlmICggdGlwcHlfaW5zdGFuY2UucG9wcGVySW5zdGFuY2UgKSB7XG5cdFx0XHRcdFx0dGlwcHlfaW5zdGFuY2UucG9wcGVySW5zdGFuY2UuZm9yY2VVcGRhdGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENvbW1pdCBhIHNoZWxsIHN0YXRlIGFuZCBpdHMgcG9saXRlIGFubm91bmNlbWVudC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgbmV4dF9zdGF0ZSAgQWxsb3ctbGlzdGVkIHNoZWxsIHN0YXRlLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgYW5ub3VuY2VtZW50IFBsYWluIGxvY2FsaXplZCBhbm5vdW5jZW1lbnQuXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBpc19idXN5ICAgICBXaGV0aGVyIHRoZSBzaGVsbCByZW1haW5zIGJ1c3kuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjb21taXRfc3RhdGUoIG5leHRfc3RhdGUsIGFubm91bmNlbWVudCwgaXNfYnVzeSApIHtcblx0XHRcdHN0YXRlID0gbmV4dF9zdGF0ZTtcblx0XHRcdHN1cmZhY2Uuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXNoYXJlZC11aS1jb250ZXh0LXBvcG92ZXItc3RhdGUnLCBuZXh0X3N0YXRlICk7XG5cdFx0XHRzdXJmYWNlLnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsIGlzX2J1c3kgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0XHRzdGF0dXMudGV4dENvbnRlbnQgPSBub3JtYWxpemVfdGV4dCggYW5ub3VuY2VtZW50LCA1MDAgKTtcblx0XHRcdGlmICggdGlwcHlfaW5zdGFuY2UgJiYgdGlwcHlfaW5zdGFuY2UucG9wcGVySW5zdGFuY2UgKSB7XG5cdFx0XHRcdHRpcHB5X2luc3RhbmNlLnBvcHBlckluc3RhbmNlLmZvcmNlVXBkYXRlKCk7XG5cdFx0XHR9XG5cdFx0XHRzY2hlZHVsZV9zdXJmYWNlX2NvbnN0cmFpbnRfdXBkYXRlKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU2hvdyB0aGUgbmV1dHJhbCBpZGxlIHNoZWxsIHdpdGhvdXQgc3RhdGUgY29udGVudC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBhbm5vdW5jZW1lbnQgT3B0aW9uYWwgbG9jYWxpemVkIGFubm91bmNlbWVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNldF9pZGxlKCBhbm5vdW5jZW1lbnQgKSB7XG5cdFx0XHRjb25zdHJhaW5fc3VyZmFjZV90b19jdXJyZW50X3BsYWNlbWVudCgpO1xuXHRcdFx0aGlkZV9zdGF0ZV9ob3N0cygpO1xuXHRcdFx0Y29udGVudC50ZXh0Q29udGVudCA9ICcnO1xuXHRcdFx0Y29tbWl0X3N0YXRlKCAnaWRsZScsIGFubm91bmNlbWVudCwgZmFsc2UgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTaG93IHRoZSBsb2FkaW5nIHN0YXRlIHdpdGggYSBjYWxsZXItb3duZWQgbG9jYWxpemVkIGxhYmVsLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgTG9jYWxpemVkIGxvYWRpbmcgbGFiZWwuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfbG9hZGluZyggbWVzc2FnZSApIHtcblx0XHRcdG1lc3NhZ2UgPSBub3JtYWxpemVfdGV4dCggbWVzc2FnZSwgMjQwICk7XG5cdFx0XHRjb25zdHJhaW5fc3VyZmFjZV90b19jdXJyZW50X3BsYWNlbWVudCgpO1xuXHRcdFx0aGlkZV9zdGF0ZV9ob3N0cygpO1xuXHRcdFx0Y29udGVudC50ZXh0Q29udGVudCA9ICcnO1xuXHRcdFx0aWYgKCBsb2FkaW5nX2xhYmVsICYmIG1lc3NhZ2UgKSB7XG5cdFx0XHRcdGxvYWRpbmdfbGFiZWwudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuXHRcdFx0fVxuXHRcdFx0bG9hZGluZy5oaWRkZW4gPSBmYWxzZTtcblx0XHRcdGNvbW1pdF9zdGF0ZSggJ2xvYWRpbmcnLCBtZXNzYWdlLCB0cnVlICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU2hvdyBjYWxsZXItcmVuZGVyZWQgY29udGVudCBmcm9tIGFuIGFsbG93LWxpc3RlZCBsb2NhbCB0ZW1wbGF0ZS5cblx0XHQgKlxuXHRcdCAqIFRoZSBzaGFyZWQgc2hlbGwgZGVsaWJlcmF0ZWx5IGRvZXMgbm90IHNhbml0aXplIG9yIGF1dGhvcml6ZSB0aGUgc3VwcGxpZWRcblx0XHQgKiBtYXJrdXAuIENhbGxlcnMgbXVzdCByZW5kZXIgYW4gYXV0aG9yaXplZCBEVE8gdGhyb3VnaCBhIGZpeGVkIFdvcmRQcmVzc1xuXHRcdCAqIHRlbXBsYXRlIGJlZm9yZSBpbnZva2luZyB0aGlzIG1ldGhvZC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSByZW5kZXJlZF9jb250ZW50IExvY2FsbHkgcmVuZGVyZWQgYXV0aG9yaXplZCBtYXJrdXAuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGFubm91bmNlbWVudCAgICBMb2NhbGl6ZWQgY29tcGxldGlvbiBhbm5vdW5jZW1lbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfY29udGVudCggcmVuZGVyZWRfY29udGVudCwgYW5ub3VuY2VtZW50ICkge1xuXHRcdFx0Y29uc3RyYWluX3N1cmZhY2VfdG9fY3VycmVudF9wbGFjZW1lbnQoKTtcblx0XHRcdGhpZGVfc3RhdGVfaG9zdHMoKTtcblx0XHRcdGNvbnRlbnQuaW5uZXJIVE1MID0gU3RyaW5nKCByZW5kZXJlZF9jb250ZW50IHx8ICcnICk7XG5cdFx0XHRjb250ZW50LmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0Y29tbWl0X3N0YXRlKCAnY29udGVudCcsIGFubm91bmNlbWVudCwgZmFsc2UgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBVcGRhdGUgdGhlIHN0YWJsZSBzaGVsbCBoZWFkaW5nIHdpdGhvdXQgcmVwbGFjaW5nIHNoZWxsIGNvbnRyb2xzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHRpdGxlIFBsYWluIGxvY2FsaXplZCB0aXRsZS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNldF90aXRsZSggdGl0bGUgKSB7XG5cdFx0XHR0aXRsZSA9IG5vcm1hbGl6ZV90ZXh0KCB0aXRsZSwgMjAwICk7XG5cdFx0XHRpZiAoIGhlYWRpbmcgKSB7XG5cdFx0XHRcdGhlYWRpbmcudGV4dENvbnRlbnQgPSB0aXRsZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXBsYWNlIHRoZSB2aXNpYmxlIGhlYWRpbmcgd2l0aCBjYWxsZXItcmVuZGVyZWQgZG9tYWluIGhlYWRlciBjb250ZW50LlxuXHRcdCAqXG5cdFx0ICogVGhlIHNoZWxsLW93bmVkIGhlYWRpbmcgcmVtYWlucyB0aGUgYWNjZXNzaWJsZSBkaWFsb2cgbmFtZS4gVGhlIHN1cHBsaWVkXG5cdFx0ICogbWFya3VwIG11c3QgY29tZSBmcm9tIGFuIGFsbG93LWxpc3RlZCBsb2NhbCBXb3JkUHJlc3MgdGVtcGxhdGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcmVuZGVyZWRfaGVhZGVyIERvbWFpbiBoZWFkZXIgbWFya3VwLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBhY2Nlc3NpYmxlX3RpdGxlIFBsYWluIGxvY2FsaXplZCBkaWFsb2cgdGl0bGUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfaGVhZGVyKCByZW5kZXJlZF9oZWFkZXIsIGFjY2Vzc2libGVfdGl0bGUgKSB7XG5cdFx0XHRpZiAoICEgaGVhZGluZyB8fCAhIGhlYWRlcl9jb250ZW50ICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRoZWFkaW5nLnRleHRDb250ZW50ID0gbm9ybWFsaXplX3RleHQoIGFjY2Vzc2libGVfdGl0bGUsIDIwMCApIHx8IGRlZmF1bHRfaGVhZGluZztcblx0XHRcdGhlYWRpbmcuY2xhc3NMaXN0LmFkZCggJ3dwYmNfc2hhcmVkX3VpX2NvbnRleHRfcG9wb3Zlcl9faGVhZGluZy0tdmlzdWFsbHktaGlkZGVuJyApO1xuXHRcdFx0aGVhZGVyX2NvbnRlbnQuaW5uZXJIVE1MID0gU3RyaW5nKCByZW5kZXJlZF9oZWFkZXIgfHwgJycgKTtcblx0XHRcdGhlYWRlcl9jb250ZW50LmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0c2NoZWR1bGVfc3VyZmFjZV9jb25zdHJhaW50X3VwZGF0ZSgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc3RvcmUgdGhlIHNoZWxsJ3MgcGxhaW4gZGVmYXVsdCBoZWFkaW5nLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGFjY2Vzc2libGVfdGl0bGUgT3B0aW9uYWwgcmVwbGFjZW1lbnQgdGl0bGUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXNldF9oZWFkZXIoIGFjY2Vzc2libGVfdGl0bGUgKSB7XG5cdFx0XHRpZiAoICEgaGVhZGluZyB8fCAhIGhlYWRlcl9jb250ZW50ICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRoZWFkaW5nLnRleHRDb250ZW50ID0gbm9ybWFsaXplX3RleHQoIGFjY2Vzc2libGVfdGl0bGUsIDIwMCApIHx8IGRlZmF1bHRfaGVhZGluZztcblx0XHRcdGhlYWRpbmcuY2xhc3NMaXN0LnJlbW92ZSggJ3dwYmNfc2hhcmVkX3VpX2NvbnRleHRfcG9wb3Zlcl9faGVhZGluZy0tdmlzdWFsbHktaGlkZGVuJyApO1xuXHRcdFx0aGVhZGVyX2NvbnRlbnQudGV4dENvbnRlbnQgPSAnJztcblx0XHRcdGhlYWRlcl9jb250ZW50LmhpZGRlbiA9IHRydWU7XG5cdFx0XHRzY2hlZHVsZV9zdXJmYWNlX2NvbnN0cmFpbnRfdXBkYXRlKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVwb3J0IGNhbGxlci1vd25lZCBwYXJ0aWFsIHdvcmsgd2l0aG91dCByZXBsYWNpbmcgdmlzaWJsZSBjb250ZW50LlxuXHRcdCAqXG5cdFx0ICogVGhpcyBuZXV0cmFsIEFQSSBleGlzdHMgZm9yIGNvbXBvc2l0ZSBkb21haW4gdmlld3Mgd2hvc2Uga25vd24gY29udGVudFxuXHRcdCAqIG11c3QgcmVtYWluIHZpc2libGUgd2hpbGUgb25lIGludGVybmFsIHJlZ2lvbiBsb2Fkcy4gRG9tYWlucyByZW1haW5cblx0XHQgKiByZXNwb25zaWJsZSBmb3Igc2V0dGluZyBhcmlhLWJ1c3kgb24gdGhlIGFmZmVjdGVkIHJlZ2lvbiBpdHNlbGYuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX2J1c3kgICAgICBXaGV0aGVyIHBhcnRpYWwgd29yayByZW1haW5zIGFjdGl2ZS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gIGFubm91bmNlbWVudCBQbGFpbiBsb2NhbGl6ZWQgbGl2ZSBhbm5vdW5jZW1lbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfYnVzeSggaXNfYnVzeSwgYW5ub3VuY2VtZW50ICkge1xuXHRcdFx0c3VyZmFjZS5zZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knLCBpc19idXN5ID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdFx0c3RhdHVzLnRleHRDb250ZW50ID0gbm9ybWFsaXplX3RleHQoIGFubm91bmNlbWVudCwgNTAwICk7XG5cdFx0XHRpZiAoIHRpcHB5X2luc3RhbmNlICYmIHRpcHB5X2luc3RhbmNlLnBvcHBlckluc3RhbmNlICkge1xuXHRcdFx0XHR0aXBweV9pbnN0YW5jZS5wb3BwZXJJbnN0YW5jZS5mb3JjZVVwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdFx0c2NoZWR1bGVfc3VyZmFjZV9jb25zdHJhaW50X3VwZGF0ZSgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNob3cgYSBwbGFpbi10ZXh0IGVtcHR5IHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgTG9jYWxpemVkIGVtcHR5LXN0YXRlIG1lc3NhZ2UuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfZW1wdHkoIG1lc3NhZ2UgKSB7XG5cdFx0XHR2YXIgcGFyYWdyYXBoID0gZW1wdHkucXVlcnlTZWxlY3RvciggJ3AnICk7XG5cblx0XHRcdG1lc3NhZ2UgPSBub3JtYWxpemVfdGV4dCggbWVzc2FnZSwgNTAwICk7XG5cdFx0XHRjb25zdHJhaW5fc3VyZmFjZV90b19jdXJyZW50X3BsYWNlbWVudCgpO1xuXHRcdFx0aGlkZV9zdGF0ZV9ob3N0cygpO1xuXHRcdFx0Y29udGVudC50ZXh0Q29udGVudCA9ICcnO1xuXHRcdFx0aWYgKCBwYXJhZ3JhcGggJiYgbWVzc2FnZSApIHtcblx0XHRcdFx0cGFyYWdyYXBoLnRleHRDb250ZW50ID0gbWVzc2FnZTtcblx0XHRcdH1cblx0XHRcdGVtcHR5LmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0Y29tbWl0X3N0YXRlKCAnZW1wdHknLCBtZXNzYWdlLCBmYWxzZSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNob3cgYSByZWNvdmVyYWJsZSBwbGFpbi10ZXh0IGVycm9yIGFuZCBvcHRpb25hbCByZXRyeSBhY3Rpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSAgICAgTG9jYWxpemVkIGVycm9yIG1lc3NhZ2UuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHJldHJ5X2xhYmVsIExvY2FsaXplZCByZXRyeSBsYWJlbDsgZW1wdHkgaGlkZXMgcmV0cnkuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfZXJyb3IoIG1lc3NhZ2UsIHJldHJ5X2xhYmVsICkge1xuXHRcdFx0bWVzc2FnZSA9IG5vcm1hbGl6ZV90ZXh0KCBtZXNzYWdlLCA1MDAgKTtcblx0XHRcdHJldHJ5X2xhYmVsID0gbm9ybWFsaXplX3RleHQoIHJldHJ5X2xhYmVsLCAxNjAgKTtcblx0XHRcdGNvbnN0cmFpbl9zdXJmYWNlX3RvX2N1cnJlbnRfcGxhY2VtZW50KCk7XG5cdFx0XHRoaWRlX3N0YXRlX2hvc3RzKCk7XG5cdFx0XHRjb250ZW50LnRleHRDb250ZW50ID0gJyc7XG5cdFx0XHRpZiAoIGVycm9yX21lc3NhZ2UgKSB7XG5cdFx0XHRcdGVycm9yX21lc3NhZ2UudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuXHRcdFx0fVxuXHRcdFx0cmV0cnlfYnV0dG9uLmhpZGRlbiA9ICEgcmV0cnlfbGFiZWwgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHNldHRpbmdzLm9uX3JldHJ5O1xuXHRcdFx0aWYgKCByZXRyeV9sYWJlbCApIHtcblx0XHRcdFx0cmV0cnlfYnV0dG9uLnRleHRDb250ZW50ID0gcmV0cnlfbGFiZWw7XG5cdFx0XHR9XG5cdFx0XHRlcnJvci5oaWRkZW4gPSBmYWxzZTtcblx0XHRcdGNvbW1pdF9zdGF0ZSggJ2Vycm9yJywgbWVzc2FnZSwgZmFsc2UgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBPcGVuIHRoZSBzaGVsbCBhZ2FpbnN0IGFuIGV4cGxpY2l0IHZpcnR1YWwtcmVmZXJlbmNlIHByb3ZpZGVyLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSAgICB0cmlnZ2VyICAgICAgICAgICAgICAgICAgICAgQWN0aXZhdGluZyBkb21haW4gdHJpZ2dlci5cblx0XHQgKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbnxudWxsfSByZWZlcmVuY2VfcmVjdCAgICAgICAgICAgICAgRE9NUmVjdC1saWtlIHZhbHVlIG9yIGdldHRlci5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICByZXF1ZXN0ZWRfYWN0aXZhdGlvbl9tZXRob2QgSW50ZXJuYWwgYWN0aXZhdGlvbi1zb3VyY2UgbGFiZWwuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBvcGVuIHJlcXVlc3Qgd2FzIGFjY2VwdGVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG9wZW5fd2l0aF9yZWZlcmVuY2UoIHRyaWdnZXIsIHJlZmVyZW5jZV9yZWN0LCByZXF1ZXN0ZWRfYWN0aXZhdGlvbl9tZXRob2QgKSB7XG5cdFx0XHR2YXIgaW5pdGlhbF9wbGFjZW1lbnQ7XG5cdFx0XHR2YXIgcmVzb2x2ZWRfcmVmZXJlbmNlX3JlY3Q7XG5cblx0XHRcdGlmICggZGVzdHJveWVkIHx8IHN1c3BlbmRlZCB8fCAhIHRyaWdnZXIgfHwgMSAhPT0gdHJpZ2dlci5ub2RlVHlwZSB8fCAhIHRyaWdnZXIuaXNDb25uZWN0ZWQgfHwgISBjYW5fdXNlX3RyaWdnZXIoIHRyaWdnZXIgKSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBwaW5uZWQgJiYgY3VycmVudF90cmlnZ2VyICYmIGN1cnJlbnRfdHJpZ2dlciAhPT0gdHJpZ2dlciApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0cmVzb2x2ZWRfcmVmZXJlbmNlX3JlY3QgPSByZXNvbHZlX29wZW5fcmVmZXJlbmNlX3JlY3QoIHJlZmVyZW5jZV9yZWN0ICk7XG5cdFx0XHRpZiAoICEgcmVzb2x2ZWRfcmVmZXJlbmNlX3JlY3QgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGFyYml0cmF0ZV92aXNpYmxlX2NvbnRyb2xsZXJzKCBjb250cm9sbGVyICk7XG5cdFx0XHRjYW5jZWxfcGVuZGluZ19jbG9zZSgpO1xuXHRcdFx0aWYgKCBjdXJyZW50X3RyaWdnZXIgJiYgY3VycmVudF90cmlnZ2VyICE9PSB0cmlnZ2VyICkge1xuXHRcdFx0XHRyZW1vdmVfZGVzY3JpcHRpb24oKTtcblx0XHRcdFx0cmVsZWFzZV90cmlnZ2VyX2FyaWEoKTtcblx0XHRcdH1cblx0XHRcdGN1cnJlbnRfdHJpZ2dlciA9IHRyaWdnZXI7XG5cdFx0XHRyZWZlcmVuY2VfcmVjdF9wcm92aWRlciA9IHJlZmVyZW5jZV9yZWN0O1xuXHRcdFx0cmVmZXJlbmNlX3RyYWNrc190cmlnZ2VyID0gJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHJlZmVyZW5jZV9yZWN0O1xuXHRcdFx0bGFzdF92YWxpZF9yZWZlcmVuY2VfcmVjdCA9IHJlc29sdmVkX3JlZmVyZW5jZV9yZWN0O1xuXHRcdFx0YWN0aXZhdGlvbl9tZXRob2QgPSByZXF1ZXN0ZWRfYWN0aXZhdGlvbl9tZXRob2Q7XG5cdFx0XHRwb2ludGVyX2luc2lkZV9jb21wb3NpdGUgPSAncG9pbnRlcicgPT09IHJlcXVlc3RlZF9hY3RpdmF0aW9uX21ldGhvZDtcblx0XHRcdGluaXRpYWxfZml0X3BlbmRpbmcgPSBmaXRfb25fZmlyc3Rfb3Blbjtcblx0XHRcdGluaXRpYWxfZml0X2NhcHR1cmVkID0gZmFsc2U7XG5cdFx0XHRpbml0aWFsX2ZpdF9hZGp1c3RtZW50ID0ge1xuXHRcdFx0XHR4OiAwLFxuXHRcdFx0XHR5OiAwXG5cdFx0XHR9O1xuXHRcdFx0Y2xlYXJfc3VyZmFjZV9oZWlnaHRfY29uc3RyYWludCgpO1xuXHRcdFx0c3VyZmFjZS5oaWRkZW4gPSBmYWxzZTtcblx0XHRcdHNldF9wb3BwZXJfbGF5b3V0X3BhcnRpY2lwYXRpb24oIHRydWUgKTtcblx0XHRcdGluaXRpYWxfcGxhY2VtZW50ID0gcmVzb2x2ZV9pbml0aWFsX3BsYWNlbWVudCggcmVzb2x2ZWRfcmVmZXJlbmNlX3JlY3QgKTtcblx0XHRcdHRpcHB5X2luc3RhbmNlLnNldFByb3BzKCB7XG5cdFx0XHRcdGdldFJlZmVyZW5jZUNsaWVudFJlY3Q6IGdldF9yZWZlcmVuY2VfcmVjdCxcblx0XHRcdFx0aW50ZXJhY3RpdmU6IHRydWUsXG5cdFx0XHRcdHBsYWNlbWVudDogaW5pdGlhbF9wbGFjZW1lbnRcblx0XHRcdH0gKTtcblx0XHRcdGFkZF9kZXNjcmlwdGlvbigpO1xuXHRcdFx0Y2xhaW1fdHJpZ2dlcl9hcmlhKCB0cmlnZ2VyICk7XG5cdFx0XHR0aXBweV9pbnN0YW5jZS5zaG93KCk7XG5cdFx0XHRyZWdpc3Rlcl92aXNpYmxlX2NvbnRyb2xsZXIoIGNvbnRyb2xsZXIgKTtcblx0XHRcdGFubm91bmNlX2xheWVyX29wZW4oKTtcblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHNldHRpbmdzLm9uX29wZW4gKSB7XG5cdFx0XHRcdHNldHRpbmdzLm9uX29wZW4oIGNvbnRyb2xsZXIsIHRyaWdnZXIgKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogT3BlbiBhZ2FpbnN0IHRoZSB0cmlnZ2VyJ3MgbGl2ZSBlbGVtZW50IHJlY3RhbmdsZS5cblx0XHQgKlxuXHRcdCAqIFRoaXMgZ2VuZXJhbCBlbGVtZW50LXJlbGF0aXZlIG1ldGhvZCBuZXZlciByZWFkcyByZW1lbWJlcmVkIHBvaW50ZXJcblx0XHQgKiBjb29yZGluYXRlcy4gS2V5Ym9hcmQgYWN0aXZhdGlvbiBkZWxlZ2F0ZXMgdG8gdGhlIHNhbWUgbGl2ZSBnZXR0ZXIuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fG51bGx9IHRyaWdnZXIgQWN0aXZhdGluZyBkb21haW4gdHJpZ2dlci5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIG9wZW4gcmVxdWVzdCB3YXMgYWNjZXB0ZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gb3BlbiggdHJpZ2dlciApIHtcblx0XHRcdGNhbmNlbF9wZW5kaW5nX29wZW4oKTtcblxuXHRcdFx0cmV0dXJuIG9wZW5fd2l0aF9yZWZlcmVuY2UoIHRyaWdnZXIsIGNyZWF0ZV90cmlnZ2VyX3JlZmVyZW5jZV9wcm92aWRlciggdHJpZ2dlciApLCAnZWxlbWVudCcgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBPcGVuIGZyb20ga2V5Ym9hcmQgZm9jdXMgdXNpbmcgdGhlIHRyaWdnZXIncyBjdXJyZW50IHJlY3RhbmdsZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gdHJpZ2dlciBGb2N1c2VkIGRvbWFpbiB0cmlnZ2VyLlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgb3BlbiByZXF1ZXN0IHdhcyBhY2NlcHRlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBvcGVuX2tleWJvYXJkKCB0cmlnZ2VyICkge1xuXHRcdFx0Y2FuY2VsX3BlbmRpbmdfb3BlbigpO1xuXHRcdFx0aWYgKCBzdXBwcmVzc2VkX2ZvY3VzX3RyaWdnZXIgPT09IHRyaWdnZXIgKSB7XG5cdFx0XHRcdHN1cHByZXNzZWRfZm9jdXNfdHJpZ2dlciA9IG51bGw7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG9wZW5fd2l0aF9yZWZlcmVuY2UoIHRyaWdnZXIsIGNyZWF0ZV90cmlnZ2VyX3JlZmVyZW5jZV9wcm92aWRlciggdHJpZ2dlciApLCAna2V5Ym9hcmQnICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTW92ZSBmb2N1cyBmcm9tIGEgdHJpZ2dlciBpbnRvIHRoZSBmaXJzdCBvd25lZCBwb3BvdmVyIGNvbnRyb2wuXG5cdFx0ICpcblx0XHQgKiBEb21haW5zIG1heSBkZWxlZ2F0ZSBrZXlkb3duIGV2ZW50cyB0byB0aGlzIG1ldGhvZC4gQWx0K0Fycm93RG93biBpc1xuXHRcdCAqIGFsd2F5cyBzdXBwb3J0ZWQ7IGBpc19mb2N1c19lbnRyeV9rZXlgIG1heSBhZGQgb25lIGRvbWFpbiBjb21tYW5kLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSB0cmlnZ2VyIFRyaWdnZXIgcmVjZWl2aW5nIHRoZSBrZXlib2FyZCBldmVudC5cblx0XHQgKiBAcGFyYW0ge0tleWJvYXJkRXZlbnR9ICAgICBldmVudCAgIFRyaWdnZXIga2V5Ym9hcmQgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBjb21tYW5kIHdhcyByZWNvZ25pemVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV90cmlnZ2VyX2tleWRvd24oIHRyaWdnZXIsIGV2ZW50ICkge1xuXHRcdFx0aWYgKCBkZXN0cm95ZWQgfHwgISB0cmlnZ2VyIHx8ICEgZXZlbnQgfHwgISBjYW5fdXNlX3RyaWdnZXIoIHRyaWdnZXIgKSB8fCAhIGlzX2ZvY3VzX2VudHJ5X2NvbW1hbmQoIGV2ZW50LCB0cmlnZ2VyICkgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdGlmICggY3VycmVudF90cmlnZ2VyICE9PSB0cmlnZ2VyIHx8ICEgdGlwcHlfaW5zdGFuY2Uuc3RhdGUuaXNWaXNpYmxlICkge1xuXHRcdFx0XHRvcGVuX2tleWJvYXJkKCB0cmlnZ2VyICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHBlbmRpbmdfZm9jdXNfZW50cnlfdGltZXIgKSB7XG5cdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIHBlbmRpbmdfZm9jdXNfZW50cnlfdGltZXIgKTtcblx0XHRcdH1cblx0XHRcdHBlbmRpbmdfZm9jdXNfZW50cnlfdGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRwZW5kaW5nX2ZvY3VzX2VudHJ5X3RpbWVyID0gMDtcblx0XHRcdFx0aWYgKCBpc192aXNpYmxlX2NvbnRyb2xsZXIoIGNvbnRyb2xsZXIgKSAmJiB0aXBweV9pbnN0YW5jZS5zdGF0ZS5pc1Zpc2libGUgKSB7XG5cdFx0XHRcdFx0Zm9jdXNfZmlyc3RfY29udHJvbCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCAwICk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNjaGVkdWxlIHBvaW50ZXIgYWN0aXZhdGlvbiBhbmQgcmVzb2x2ZSBpdHMgcmVmZXJlbmNlIGF0IGRlbGF5IGV4cGlyeS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gdHJpZ2dlciBBY3RpdmF0aW5nIGRvbWFpbiB0cmlnZ2VyLlxuXHRcdCAqIEBwYXJhbSB7UG9pbnRlckV2ZW50fSAgICAgZXZlbnQgICBJbml0aWFsIHBvaW50ZXIgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGEgdmFsaWQgZGVsYXllZCBvcGVuIHdhcyBzY2hlZHVsZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2NoZWR1bGVfcG9pbnRlcl9vcGVuKCB0cmlnZ2VyLCBldmVudCApIHtcblx0XHRcdGlmIChcblx0XHRcdFx0ZGVzdHJveWVkXG5cdFx0XHRcdHx8ICEgdHJpZ2dlclxuXHRcdFx0XHR8fCAxICE9PSB0cmlnZ2VyLm5vZGVUeXBlXG5cdFx0XHRcdHx8ICEgdHJpZ2dlci5pc0Nvbm5lY3RlZFxuXHRcdFx0XHR8fCAhIGNhbl91c2VfdHJpZ2dlciggdHJpZ2dlciApXG5cdFx0XHRcdHx8ICEgZXZlbnRcblx0XHRcdFx0fHwgISBOdW1iZXIuaXNGaW5pdGUoIGV2ZW50LmNsaWVudFggKVxuXHRcdFx0XHR8fCAhIE51bWJlci5pc0Zpbml0ZSggZXZlbnQuY2xpZW50WSApXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBpc192aXNpYmxlX2NvbnRyb2xsZXIoIGNvbnRyb2xsZXIgKSAmJiBjdXJyZW50X3RyaWdnZXIgPT09IHRyaWdnZXIgJiYgdGlwcHlfaW5zdGFuY2Uuc3RhdGUuaXNWaXNpYmxlICkge1xuXHRcdFx0XHRwb2ludGVyX2luc2lkZV9jb21wb3NpdGUgPSB0cnVlO1xuXHRcdFx0XHRjYW5jZWxfcGVuZGluZ19jbG9zZSgpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0Y2FuY2VsX3BlbmRpbmdfb3BlbigpO1xuXHRcdFx0cGVuZGluZ19wb2ludGVyX3RyaWdnZXIgPSB0cmlnZ2VyO1xuXHRcdFx0cGVuZGluZ19wb2ludGVyX2lkID0gTnVtYmVyLmlzRmluaXRlKCBldmVudC5wb2ludGVySWQgKSA/IGV2ZW50LnBvaW50ZXJJZCA6IG51bGw7XG5cdFx0XHRsYXRlc3RfcG9pbnRlcl9jb29yZGluYXRlcyA9IHtcblx0XHRcdFx0eDogZXZlbnQuY2xpZW50WCxcblx0XHRcdFx0eTogZXZlbnQuY2xpZW50WVxuXHRcdFx0fTtcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdwb2ludGVybW92ZScsIGNhcHR1cmVfcGVuZGluZ19wb2ludGVyLCB0cnVlICk7XG5cdFx0XHR0cmlnZ2VyLmFkZEV2ZW50TGlzdGVuZXIoICdwb2ludGVybGVhdmUnLCBjYW5jZWxfcGVuZGluZ19vcGVuICk7XG5cdFx0XHRwZW5kaW5nX3Nob3dfdGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHR2YXIgZGVsYXllZF90cmlnZ2VyID0gcGVuZGluZ19wb2ludGVyX3RyaWdnZXI7XG5cdFx0XHRcdHZhciBmcm96ZW5fcG9pbnRlciA9IGxhdGVzdF9wb2ludGVyX2Nvb3JkaW5hdGVzO1xuXG5cdFx0XHRcdGNhbmNlbF9wZW5kaW5nX29wZW4oKTtcblx0XHRcdFx0aWYgKCAhIGRlbGF5ZWRfdHJpZ2dlciB8fCAhIGZyb3plbl9wb2ludGVyICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRvcGVuX3dpdGhfcmVmZXJlbmNlKFxuXHRcdFx0XHRcdGRlbGF5ZWRfdHJpZ2dlcixcblx0XHRcdFx0XHQnZnVuY3Rpb24nID09PSB0eXBlb2Ygc2V0dGluZ3MuZ2V0X3JlZmVyZW5jZV9yZWN0XG5cdFx0XHRcdFx0XHQ/IGNyZWF0ZV90cmlnZ2VyX3JlZmVyZW5jZV9wcm92aWRlciggZGVsYXllZF90cmlnZ2VyIClcblx0XHRcdFx0XHRcdDogY3JlYXRlX3BvaW50ZXJfcmVmZXJlbmNlX3JlY3QoIGRlbGF5ZWRfdHJpZ2dlciwgZnJvemVuX3BvaW50ZXIueCwgZnJvemVuX3BvaW50ZXIueSwgcG9pbnRlcl9hbmNob3IgKSxcblx0XHRcdFx0XHQncG9pbnRlcidcblx0XHRcdFx0KTtcblx0XHRcdH0sIHNob3dfZGVsYXlfbXMgKTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRmluYWxpemUgYW4gYXBwcm92ZWQgY2xvc2UgYWZ0ZXIgcG9saWN5IGhhcyBhY2NlcHRlZCBpdHMgcmVhc29uLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSByZXN0b3JlX2ZvY3VzIFdoZXRoZXIgZm9jdXMgcmV0dXJucyB0byB0aGUgdHJpZ2dlci5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gIHJlYXNvbiAgICAgICAgTm9ybWFsaXplZCBhcHByb3ZlZCBjbG9zZSByZWFzb24uXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBmaW5hbGl6ZV9jbG9zZSggcmVzdG9yZV9mb2N1cywgcmVhc29uICkge1xuXHRcdFx0dmFyIGZvY3VzX3RhcmdldCA9IGN1cnJlbnRfdHJpZ2dlcjtcblx0XHRcdHZhciBoYWRfb3duZWRfc3RhdGU7XG5cdFx0XHR2YXIgc2hvdWxkX3Jlc3RvcmU7XG5cblx0XHRcdGhhZF9vd25lZF9zdGF0ZSA9IEJvb2xlYW4oXG5cdFx0XHRcdHBlbmRpbmdfc2hvd190aW1lclxuXHRcdFx0XHR8fCBjdXJyZW50X3RyaWdnZXJcblx0XHRcdFx0fHwgdGlwcHlfaW5zdGFuY2Uuc3RhdGUuaXNWaXNpYmxlXG5cdFx0XHRcdHx8IGlzX3Zpc2libGVfY29udHJvbGxlciggY29udHJvbGxlciApXG5cdFx0XHRcdHx8IHN1c3BlbmRlZFxuXHRcdFx0KTtcblx0XHRcdGNhbmNlbF9pbnRlcmFjdGlvbl90aW1lcnMoKTtcblx0XHRcdGlmICggISBoYWRfb3duZWRfc3RhdGUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHNob3VsZF9yZXN0b3JlID0gQm9vbGVhbiggcmVzdG9yZV9mb2N1cyAmJiBmb2N1c190YXJnZXQgJiYgZm9jdXNfdGFyZ2V0LmlzQ29ubmVjdGVkICk7XG5cdFx0XHRyZW1vdmVfZGVzY3JpcHRpb24oKTtcblx0XHRcdHJlbGVhc2VfdHJpZ2dlcl9hcmlhKCk7XG5cdFx0XHR1bnJlZ2lzdGVyX3Zpc2libGVfY29udHJvbGxlciggY29udHJvbGxlciApO1xuXHRcdFx0cG9pbnRlcl9pbnNpZGVfY29tcG9zaXRlID0gZmFsc2U7XG5cdFx0XHRmaW5pc2hfcGlubmVkX2RyYWcoKTtcblx0XHRcdGZpbmlzaF9waW5uZWRfcmVzaXplKCk7XG5cdFx0XHRjbGVhcl9waW5uZWRfc3VyZmFjZV9zaXplKCk7XG5cdFx0XHRwaW5uZWQgPSBmYWxzZTtcblx0XHRcdHBpbm5lZF92aWV3cG9ydF9wb3NpdGlvbiA9IG51bGw7XG5cdFx0XHRpbml0aWFsX2ZpdF9wZW5kaW5nID0gZmFsc2U7XG5cdFx0XHRpbml0aWFsX2ZpdF9jYXB0dXJlZCA9IGZhbHNlO1xuXHRcdFx0c3VzcGVuZGVkID0gZmFsc2U7XG5cdFx0XHRzdXNwZW5zaW9uX3JlYXNvbiA9ICcnO1xuXHRcdFx0ZXh0ZXJuYWxfc3VzcGVuc2lvbl9ob2xkID0gZmFsc2U7XG5cdFx0XHRzdXNwZW5kaW5nX2xheWVycyA9IHt9O1xuXHRcdFx0c3luY2hyb25pemVfcGluX2NvbnRyb2woKTtcblx0XHRcdGFwcGx5X3Bvc2l0aW9uaW5nX21vZGUoKTtcblx0XHRcdHN1cmZhY2UucmVtb3ZlQXR0cmlidXRlKCAnZGF0YS13cGJjLXNoYXJlZC11aS1jb250ZXh0LXBvcG92ZXItc3VzcGVuZGVkJyApO1xuXHRcdFx0Y3VycmVudF90cmlnZ2VyID0gbnVsbDtcblx0XHRcdHJlZmVyZW5jZV9yZWN0X3Byb3ZpZGVyID0gbnVsbDtcblx0XHRcdHJlZmVyZW5jZV90cmFja3NfdHJpZ2dlciA9IGZhbHNlO1xuXHRcdFx0bGFzdF92YWxpZF9yZWZlcmVuY2VfcmVjdCA9IG51bGw7XG5cdFx0XHRhY3RpdmF0aW9uX21ldGhvZCA9ICdub25lJztcblx0XHRcdG9wZW5fY2hpbGRfbGF5ZXJzID0ge307XG5cdFx0XHRhbm5vdW5jZV9sYXllcl9jbG9zZSgpO1xuXHRcdFx0aWYgKCBzaG91bGRfcmVzdG9yZSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgZm9jdXNfdGFyZ2V0LmZvY3VzICkge1xuXHRcdFx0XHRzdXBwcmVzc2VkX2ZvY3VzX3RyaWdnZXIgPSBmb2N1c190YXJnZXQ7XG5cdFx0XHRcdGlmICggc3VwcHJlc3NlZF9mb2N1c190aW1lciApIHtcblx0XHRcdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCBzdXBwcmVzc2VkX2ZvY3VzX3RpbWVyICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Zm9jdXNfdGFyZ2V0LmZvY3VzKCk7XG5cdFx0XHRcdHN1cHByZXNzZWRfZm9jdXNfdGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdHN1cHByZXNzZWRfZm9jdXNfdHJpZ2dlciA9IG51bGw7XG5cdFx0XHRcdFx0c3VwcHJlc3NlZF9mb2N1c190aW1lciA9IDA7XG5cdFx0XHRcdH0sIDAgKTtcblx0XHRcdH1cblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHNldHRpbmdzLm9uX2Nsb3NlICkge1xuXHRcdFx0XHRzZXR0aW5ncy5vbl9jbG9zZSggY29udHJvbGxlciwgcmVhc29uICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2xvc2UgdGhlIG93bmVkIFRpcHB5IGluc3RhbmNlIGFmdGVyIHBvbGljeSBhcHByb3ZhbC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gcmVzdG9yZV9mb2N1cyBXaGV0aGVyIGZvY3VzIHJldHVybnMgdG8gdGhlIHRyaWdnZXIuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9ICByZWFzb24gICAgICAgIE5vcm1hbGl6ZWQgYXBwcm92ZWQgY2xvc2UgcmVhc29uLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2xvc2VfYXBwcm92ZWQoIHJlc3RvcmVfZm9jdXMsIHJlYXNvbiApIHtcblx0XHRcdGlmICggdGlwcHlfaW5zdGFuY2Uuc3RhdGUuaXNWaXNpYmxlICkge1xuXHRcdFx0XHRhcHByb3ZlZF90aXBweV9oaWRlX3JlYXNvbiA9IHJlYXNvbjtcblx0XHRcdFx0dGlwcHlfaW5zdGFuY2UuaGlkZSgpO1xuXHRcdFx0XHRpZiAoIGFwcHJvdmVkX3RpcHB5X2hpZGVfcmVhc29uID09PSByZWFzb24gKSB7XG5cdFx0XHRcdFx0YXBwcm92ZWRfdGlwcHlfaGlkZV9yZWFzb24gPSAnJztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZmluYWxpemVfY2xvc2UoIHJlc3RvcmVfZm9jdXMsIHJlYXNvbiApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlcXVlc3QgYSByZWFzb25lZCBjbG9zZSBiZWZvcmUgbXV0YXRpbmcgb3duZWQgbGlmZWN5Y2xlIHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQXV0b21hdGljIHJlYXNvbnMgYXJlIHJlamVjdGVkIHdoaWxlIHBpbm5lZC4gRXhwbGljaXQgYW5kIGF1dGhvcml0eVxuXHRcdCAqIHJlYXNvbnMgcmVtYWluIGF2YWlsYWJsZS4gU3VzcGVuc2lvbiByZWFzb25zIHJldGFpbiBhbiBvcHRlZC1pbiBwaW4uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gIHJlYXNvbiAgICAgICAgRGlzbWlzc2FsIG9yIHN1c3BlbnNpb24gcmVhc29uLlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gcmVzdG9yZV9mb2N1cyBXaGV0aGVyIGZvY3VzIHJldHVybnMgdG8gdGhlIHRyaWdnZXIuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSByZXF1ZXN0IHdhcyBhY2NlcHRlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXF1ZXN0X2Nsb3NlKCByZWFzb24sIHJlc3RvcmVfZm9jdXMgKSB7XG5cdFx0XHRyZWFzb24gPSBub3JtYWxpemVfY2xvc2VfcmVhc29uKCByZWFzb24gKTtcblx0XHRcdGlmICggZGVzdHJveWVkIHx8ICEgcmVhc29uICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdleHBsaWNpdCcgPT09IGRpc21pc3NfcG9saWN5ICYmIGlzX2F1dG9tYXRpY19jbG9zZV9yZWFzb24oIHJlYXNvbiApICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoXG5cdFx0XHRcdCdyZXRhaW4nID09PSBleHRlcm5hbF9zY3JvbGxfcG9saWN5XG5cdFx0XHRcdCYmICdwb2ludGVyX2V4aXQnID09PSByZWFzb25cblx0XHRcdFx0JiYgRGF0ZS5ub3coKSA8IHJldGFpbmVkX3Njcm9sbF91bnRpbFxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICggcGlubmVkICYmIC0xICE9PSBzdXNwZW5zaW9uX3JlYXNvbnMuaW5kZXhPZiggcmVhc29uICkgKSB7XG5cdFx0XHRcdHJldHVybiBzdXNwZW5kKCByZWFzb24gKTtcblx0XHRcdH1cblx0XHRcdGlmICggcGlubmVkICYmIGlzX2F1dG9tYXRpY19jbG9zZV9yZWFzb24oIHJlYXNvbiApICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRjbG9zZV9hcHByb3ZlZCggQm9vbGVhbiggcmVzdG9yZV9mb2N1cyApLCByZWFzb24gKTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUHJlc2VydmUgY29tcGF0aWJpbGl0eSBmb3IgZXhpc3RpbmcgZXhwbGljaXQgY29udHJvbGxlciBjb25zdW1lcnMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IHJlc3RvcmVfZm9jdXMgV2hldGhlciBmb2N1cyByZXR1cm5zIHRvIHRoZSB0cmlnZ2VyLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2xvc2UoIHJlc3RvcmVfZm9jdXMgKSB7XG5cdFx0XHRyZXF1ZXN0X2Nsb3NlKCAncHJvZ3JhbW1hdGljJywgcmVzdG9yZV9mb2N1cyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFRlbXBvcmFyaWx5IGhpZGUgYW4gb3B0ZWQtaW4gcGlubmVkIHN1cmZhY2Ugd2l0aG91dCBjbGVhcmluZyBpZGVudGl0eS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgcmVhc29uICAgICAgICAgICAgICAgIE5ldXRyYWwgc3VzcGVuc2lvbiByZWFzb24uXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBbbGF5ZXJfb3duZWQ9ZmFsc2VdIFRydWUgd2hlbiBhIHNoYXJlZCBsYXllciBvd25zIHRoZSBob2xkLlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgcGlubmVkIGlkZW50aXR5IHdhcyByZXRhaW5lZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzdXNwZW5kKCByZWFzb24sIGxheWVyX293bmVkICkge1xuXHRcdFx0cmVhc29uID0gbm9ybWFsaXplX2Nsb3NlX3JlYXNvbiggcmVhc29uICk7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdGRlc3Ryb3llZFxuXHRcdFx0XHR8fCAhIHBpbm5lZFxuXHRcdFx0XHR8fCAtMSA9PT0gc3VzcGVuc2lvbl9yZWFzb25zLmluZGV4T2YoIHJlYXNvbiApXG5cdFx0XHRcdHx8ICEgY3VycmVudF90cmlnZ2VyXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIGxheWVyX293bmVkICkge1xuXHRcdFx0XHRleHRlcm5hbF9zdXNwZW5zaW9uX2hvbGQgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0Y2FuY2VsX2ludGVyYWN0aW9uX3RpbWVycygpO1xuXHRcdFx0aWYgKCBzdXNwZW5kZWQgKSB7XG5cdFx0XHRcdGlmICggJ3JlZmVyZW5jZV9yZWZyZXNoJyA9PT0gcmVhc29uICkge1xuXHRcdFx0XHRcdHN1c3BlbnNpb25fcmVhc29uID0gcmVhc29uO1xuXHRcdFx0XHRcdHN1cmZhY2Uuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXNoYXJlZC11aS1jb250ZXh0LXBvcG92ZXItc3VzcGVuZGVkJywgcmVhc29uICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRzdXNwZW5kZWQgPSB0cnVlO1xuXHRcdFx0c3VzcGVuc2lvbl9yZWFzb24gPSByZWFzb247XG5cdFx0XHRzdXJmYWNlLnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1zaGFyZWQtdWktY29udGV4dC1wb3BvdmVyLXN1c3BlbmRlZCcsIHJlYXNvbiApO1xuXHRcdFx0cmVtb3ZlX2Rlc2NyaXB0aW9uKCk7XG5cdFx0XHRyZWxlYXNlX3RyaWdnZXJfYXJpYSgpO1xuXHRcdFx0dW5yZWdpc3Rlcl92aXNpYmxlX2NvbnRyb2xsZXIoIGNvbnRyb2xsZXIgKTtcblx0XHRcdGFwcHJvdmVkX3RpcHB5X2hpZGVfcmVhc29uID0gcmVhc29uO1xuXHRcdFx0dGlwcHlfaW5zdGFuY2UuaGlkZSgpO1xuXHRcdFx0aWYgKCBhcHByb3ZlZF90aXBweV9oaWRlX3JlYXNvbiA9PT0gcmVhc29uICkge1xuXHRcdFx0XHRhcHByb3ZlZF90aXBweV9oaWRlX3JlYXNvbiA9ICcnO1xuXHRcdFx0fVxuXHRcdFx0YW5ub3VuY2VfbGF5ZXJfY2xvc2UoKTtcblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHNldHRpbmdzLm9uX3N1c3BlbmQgKSB7XG5cdFx0XHRcdHNldHRpbmdzLm9uX3N1c3BlbmQoIGNvbnRyb2xsZXIsIHJlYXNvbiApO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXN0b3JlIGEgc2FmZWx5IHJldGFpbmVkIHBpbm5lZCBzdXJmYWNlIGFmdGVyIGJsb2NraW5nIG93bmVyc2hpcCBlbmRzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBbcmVsZWFzZV9leHRlcm5hbF9ob2xkPXRydWVdIFRydWUgdG8gcmVsZWFzZSBhbiBhZGFwdGVyIGhvbGQuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBzdXJmYWNlIHJlc3VtZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVzdW1lKCByZWxlYXNlX2V4dGVybmFsX2hvbGQgKSB7XG5cdFx0XHR2YXIgcmVzb2x2ZWRfcmVmZXJlbmNlX3JlY3Q7XG5cblx0XHRcdGlmICggZmFsc2UgIT09IHJlbGVhc2VfZXh0ZXJuYWxfaG9sZCApIHtcblx0XHRcdFx0ZXh0ZXJuYWxfc3VzcGVuc2lvbl9ob2xkID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoXG5cdFx0XHRcdGRlc3Ryb3llZFxuXHRcdFx0XHR8fCAhIHBpbm5lZFxuXHRcdFx0XHR8fCAhIHN1c3BlbmRlZFxuXHRcdFx0XHR8fCBleHRlcm5hbF9zdXNwZW5zaW9uX2hvbGRcblx0XHRcdFx0fHwgT2JqZWN0LmtleXMoIHN1c3BlbmRpbmdfbGF5ZXJzICkubGVuZ3RoXG5cdFx0XHRcdHx8ICEgY3VycmVudF90cmlnZ2VyXG5cdFx0XHRcdHx8ICEgY3VycmVudF90cmlnZ2VyLmlzQ29ubmVjdGVkXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0cmVzb2x2ZWRfcmVmZXJlbmNlX3JlY3QgPSByZXNvbHZlX29wZW5fcmVmZXJlbmNlX3JlY3QoIHJlZmVyZW5jZV9yZWN0X3Byb3ZpZGVyLCBwaW5fdG9fdmlld3BvcnQgKTtcblx0XHRcdGlmICggISByZXNvbHZlZF9yZWZlcmVuY2VfcmVjdCApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0bGFzdF92YWxpZF9yZWZlcmVuY2VfcmVjdCA9IHJlc29sdmVkX3JlZmVyZW5jZV9yZWN0O1xuXHRcdFx0c3VzcGVuZGVkID0gZmFsc2U7XG5cdFx0XHRzdXNwZW5zaW9uX3JlYXNvbiA9ICcnO1xuXHRcdFx0c3VyZmFjZS5yZW1vdmVBdHRyaWJ1dGUoICdkYXRhLXdwYmMtc2hhcmVkLXVpLWNvbnRleHQtcG9wb3Zlci1zdXNwZW5kZWQnICk7XG5cdFx0XHRzdXJmYWNlLmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0c2V0X3BvcHBlcl9sYXlvdXRfcGFydGljaXBhdGlvbiggdHJ1ZSApO1xuXHRcdFx0dGlwcHlfaW5zdGFuY2Uuc2V0UHJvcHMoIHtcblx0XHRcdFx0Z2V0UmVmZXJlbmNlQ2xpZW50UmVjdDogZ2V0X3JlZmVyZW5jZV9yZWN0LFxuXHRcdFx0XHRpbnRlcmFjdGl2ZTogdHJ1ZSxcblx0XHRcdFx0cGxhY2VtZW50OiBub3JtYWxpemVfcGxhY2VtZW50KCBzZXR0aW5ncy5wbGFjZW1lbnQgKVxuXHRcdFx0fSApO1xuXHRcdFx0YWRkX2Rlc2NyaXB0aW9uKCk7XG5cdFx0XHRjbGFpbV90cmlnZ2VyX2FyaWEoIGN1cnJlbnRfdHJpZ2dlciApO1xuXHRcdFx0dGlwcHlfaW5zdGFuY2Uuc2hvdygpO1xuXHRcdFx0cmVnaXN0ZXJfdmlzaWJsZV9jb250cm9sbGVyKCBjb250cm9sbGVyICk7XG5cdFx0XHRhbm5vdW5jZV9sYXllcl9vcGVuKCk7XG5cdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiBzZXR0aW5ncy5vbl9yZXN1bWUgKSB7XG5cdFx0XHRcdHNldHRpbmdzLm9uX3Jlc3VtZSggY29udHJvbGxlciwgY3VycmVudF90cmlnZ2VyICk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlYmluZCByZXRhaW5lZCBpZGVudGl0eSB0byBhIHJlcGxhY2VtZW50IGRvbWFpbiB0cmlnZ2VyLlxuXHRcdCAqXG5cdFx0ICogVGhlIGRvbWFpbiByZW1haW5zIHJlc3BvbnNpYmxlIGZvciBwcm92aW5nIHRoYXQgdGhlIHJlcGxhY2VtZW50IHRyaWdnZXJcblx0XHQgKiBoYXMgdGhlIHNhbWUgYXV0aG9yaXplZCBtZWFuaW5nLiBTaGFyZWQgY29kZSB2YWxpZGF0ZXMgb25seSBET00gb3duZXJzaGlwXG5cdFx0ICogYW5kIHJlZmVyZW5jZSBnZW9tZXRyeS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gICAgdHJpZ2dlciAgICAgICAgUmVwbGFjZW1lbnQgdHJpZ2dlci5cblx0XHQgKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbnxudWxsfSByZWZlcmVuY2VfcmVjdCBPcHRpb25hbCByZWZlcmVuY2UgcHJvdmlkZXIuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHJlYmluZGluZyBzdWNjZWVkZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmViaW5kX3RyaWdnZXIoIHRyaWdnZXIsIHJlZmVyZW5jZV9yZWN0ICkge1xuXHRcdFx0dmFyIHJlcXVlc3RlZF9yZWZlcmVuY2UgPSByZWZlcmVuY2VfcmVjdCB8fCBjcmVhdGVfdHJpZ2dlcl9yZWZlcmVuY2VfcHJvdmlkZXIoIHRyaWdnZXIgKTtcblx0XHRcdHZhciByZXNvbHZlZF9yZWZlcmVuY2VfcmVjdDtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHRkZXN0cm95ZWRcblx0XHRcdFx0fHwgISBjdXJyZW50X3RyaWdnZXJcblx0XHRcdFx0fHwgISB0cmlnZ2VyXG5cdFx0XHRcdHx8IDEgIT09IHRyaWdnZXIubm9kZVR5cGVcblx0XHRcdFx0fHwgISB0cmlnZ2VyLmlzQ29ubmVjdGVkXG5cdFx0XHRcdHx8ICEgY2FuX3VzZV90cmlnZ2VyKCB0cmlnZ2VyIClcblx0XHRcdCkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRyZXNvbHZlZF9yZWZlcmVuY2VfcmVjdCA9IHJlc29sdmVfb3Blbl9yZWZlcmVuY2VfcmVjdCggcmVxdWVzdGVkX3JlZmVyZW5jZSwgcGlubmVkICYmIHBpbl90b192aWV3cG9ydCApO1xuXHRcdFx0aWYgKFxuXHRcdFx0XHQhIHJlc29sdmVkX3JlZmVyZW5jZV9yZWN0XG5cdFx0XHRcdCYmICEgKFxuXHRcdFx0XHRcdCdzdHJpY3RfbGl2ZV9vd25lcicgPT09IHJlZmVyZW5jZV9wb2xpY3lcblx0XHRcdFx0XHQmJiBwaW5uZWRcblx0XHRcdFx0XHQmJiBzdXNwZW5kZWRcblx0XHRcdFx0KVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGNhbmNlbF9pbnRlcmFjdGlvbl90aW1lcnMoKTtcblx0XHRcdHJlbW92ZV9kZXNjcmlwdGlvbigpO1xuXHRcdFx0cmVsZWFzZV90cmlnZ2VyX2FyaWEoKTtcblx0XHRcdGN1cnJlbnRfdHJpZ2dlciA9IHRyaWdnZXI7XG5cdFx0XHRyZWZlcmVuY2VfcmVjdF9wcm92aWRlciA9IHJlcXVlc3RlZF9yZWZlcmVuY2U7XG5cdFx0XHRyZWZlcmVuY2VfdHJhY2tzX3RyaWdnZXIgPSAnZnVuY3Rpb24nID09PSB0eXBlb2YgcmVxdWVzdGVkX3JlZmVyZW5jZTtcblx0XHRcdGxhc3RfdmFsaWRfcmVmZXJlbmNlX3JlY3QgPSByZXNvbHZlZF9yZWZlcmVuY2VfcmVjdDtcblx0XHRcdGlmICggISBzdXNwZW5kZWQgKSB7XG5cdFx0XHRcdGFkZF9kZXNjcmlwdGlvbigpO1xuXHRcdFx0XHRjbGFpbV90cmlnZ2VyX2FyaWEoIHRyaWdnZXIgKTtcblx0XHRcdFx0dXBkYXRlX3JlZmVyZW5jZSgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc2V0dGluZ3Mub25fcmViaW5kICkge1xuXHRcdFx0XHRzZXR0aW5ncy5vbl9yZWJpbmQoIGNvbnRyb2xsZXIsIHRyaWdnZXIgKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVjYWxjdWxhdGUgdGhlIGN1cnJlbnQgUG9wcGVyIHBvc2l0aW9uIGFmdGVyIGNhbGxlci1vd25lZCBjb250ZW50IG9yXG5cdFx0ICogcmVmZXJlbmNlIGdlb21ldHJ5IGNoYW5nZXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbnxudWxsfSByZWZlcmVuY2VfcmVjdCBPcHRpb25hbCByZXBsYWNlbWVudCBnZXR0ZXIuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGEgY3VycmVudCBsaXZlIHJlZmVyZW5jZSB3YXMgbWVhc3VyZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gdXBkYXRlX3JlZmVyZW5jZSggcmVmZXJlbmNlX3JlY3QgKSB7XG5cdFx0XHR2YXIgcmVzb2x2ZWRfcmVmZXJlbmNlX3JlY3Q7XG5cblx0XHRcdGlmICggcmVmZXJlbmNlX3JlY3QgKSB7XG5cdFx0XHRcdHJlZmVyZW5jZV9yZWN0X3Byb3ZpZGVyID0gcmVmZXJlbmNlX3JlY3Q7XG5cdFx0XHRcdHJlZmVyZW5jZV90cmFja3NfdHJpZ2dlciA9ICdmdW5jdGlvbicgPT09IHR5cGVvZiByZWZlcmVuY2VfcmVjdDtcblx0XHRcdH1cblx0XHRcdHJlc29sdmVkX3JlZmVyZW5jZV9yZWN0ID0gcmVzb2x2ZV9vcGVuX3JlZmVyZW5jZV9yZWN0KCByZWZlcmVuY2VfcmVjdF9wcm92aWRlciwgcGlubmVkICYmIHBpbl90b192aWV3cG9ydCApO1xuXHRcdFx0aWYgKCAhIHJlc29sdmVkX3JlZmVyZW5jZV9yZWN0ICkge1xuXHRcdFx0XHRpZiAoICdzdHJpY3RfbGl2ZV9vd25lcicgPT09IHJlZmVyZW5jZV9wb2xpY3kgKSB7XG5cdFx0XHRcdFx0bGFzdF92YWxpZF9yZWZlcmVuY2VfcmVjdCA9IG51bGw7XG5cdFx0XHRcdFx0aWYgKCBwaW5uZWQgKSB7XG5cdFx0XHRcdFx0XHRzdXNwZW5kKCAncmVmZXJlbmNlX3VuYXZhaWxhYmxlJyApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXF1ZXN0X2Nsb3NlKCAnZXh0ZXJuYWxfc2Nyb2xsJywgZmFsc2UgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRsYXN0X3ZhbGlkX3JlZmVyZW5jZV9yZWN0ID0gcmVzb2x2ZWRfcmVmZXJlbmNlX3JlY3Q7XG5cdFx0XHRpZiAoIHRpcHB5X2luc3RhbmNlLnBvcHBlckluc3RhbmNlICkge1xuXHRcdFx0XHR0aXBweV9pbnN0YW5jZS5wb3BwZXJJbnN0YW5jZS5mb3JjZVVwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdFx0c2NoZWR1bGVfc3VyZmFjZV9jb25zdHJhaW50X3VwZGF0ZSgpO1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWZyZXNoIG9ubHkgdGhlIG5ldXRyYWwgdmlld3BvcnQgY29uc3RyYWludCBhZnRlciB2aWV3cG9ydCBnZW9tZXRyeSBtb3Zlcy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX3ZpZXdwb3J0X2dlb21ldHJ5X2NoYW5nZSgpIHtcblx0XHRcdGlmICggaXNfdmlzaWJsZV9jb250cm9sbGVyKCBjb250cm9sbGVyICkgKSB7XG5cdFx0XHRcdGlmICggcGlubmVkICYmIHBpbl90b192aWV3cG9ydCAmJiBwaW5uZWRfdmlld3BvcnRfcG9zaXRpb24gKSB7XG5cdFx0XHRcdFx0aWYgKCBwaW5uZWRfdmlld3BvcnRfc2l6ZSApIHtcblx0XHRcdFx0XHRcdHJlc2l6ZV9waW5uZWRfc3VyZmFjZSggcGlubmVkX3ZpZXdwb3J0X3NpemUud2lkdGgsIHBpbm5lZF92aWV3cG9ydF9zaXplLmhlaWdodCwgZmFsc2UgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bW92ZV9waW5uZWRfc3VyZmFjZSggcGlubmVkX3ZpZXdwb3J0X3Bvc2l0aW9uLmxlZnQsIHBpbm5lZF92aWV3cG9ydF9wb3NpdGlvbi50b3AgKTtcblx0XHRcdFx0XHRzY2hlZHVsZV9zdXJmYWNlX2NvbnN0cmFpbnRfdXBkYXRlKCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoICdzdHJpY3RfbGl2ZV9vd25lcicgPT09IHJlZmVyZW5jZV9wb2xpY3kgKSB7XG5cdFx0XHRcdFx0dXBkYXRlX3JlZmVyZW5jZSgpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHNjaGVkdWxlX3N1cmZhY2VfY29uc3RyYWludF91cGRhdGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFBpbiB0aGUgc3VyZmFjZSB3aGlsZSB0aGUgcG9pbnRlciBpcyBhbnl3aGVyZSBpbiB0aGUgY29tcG9zaXRlIHJlZ2lvbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7UG9pbnRlckV2ZW50fSBldmVudCBQb2ludGVyLW92ZXIgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfZG9jdW1lbnRfcG9pbnRlcl9vdmVyKCBldmVudCApIHtcblx0XHRcdGlmICggISBpc192aXNpYmxlX2NvbnRyb2xsZXIoIGNvbnRyb2xsZXIgKSB8fCAhIGlzX2NvbXBvc2l0ZV9ub2RlKCBldmVudC50YXJnZXQgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cG9pbnRlcl9pbnNpZGVfY29tcG9zaXRlID0gdHJ1ZTtcblx0XHRcdGNhbmNlbF9wZW5kaW5nX2Nsb3NlKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3RhcnQgdGhlIHBvaW50ZXIgY29ycmlkb3IgZGVsYXkgYWZ0ZXIgbGVhdmluZyB0aGUgY29tcGxldGUgcmVnaW9uLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtQb2ludGVyRXZlbnR9IGV2ZW50IFBvaW50ZXItb3V0IGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2RvY3VtZW50X3BvaW50ZXJfb3V0KCBldmVudCApIHtcblx0XHRcdGlmIChcblx0XHRcdFx0ISBpc192aXNpYmxlX2NvbnRyb2xsZXIoIGNvbnRyb2xsZXIgKVxuXHRcdFx0XHR8fCAhIGlzX2NvbXBvc2l0ZV9ub2RlKCBldmVudC50YXJnZXQgKVxuXHRcdFx0XHR8fCBpc19jb21wb3NpdGVfbm9kZSggZXZlbnQucmVsYXRlZFRhcmdldCApXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cG9pbnRlcl9pbnNpZGVfY29tcG9zaXRlID0gZmFsc2U7XG5cdFx0XHRzY2hlZHVsZV9jbG9zZSgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENsb3NlIGJlZm9yZSBhbiBvdXRzaWRlIHBvaW50ZXIgYWN0aW9uIHdpdGhvdXQgY2FuY2VsbGluZyB0aGF0IGFjdGlvbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7UG9pbnRlckV2ZW50fSBldmVudCBDYXB0dXJlZCBwb2ludGVyLWRvd24gZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfZG9jdW1lbnRfcG9pbnRlcl9kb3duKCBldmVudCApIHtcblx0XHRcdGlmICggaXNfY2xpcHBlZF90aXRsZV90b29sdGlwX3RhcmdldCggZXZlbnQudGFyZ2V0ICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChcblx0XHRcdFx0KCBpc192aXNpYmxlX2NvbnRyb2xsZXIoIGNvbnRyb2xsZXIgKSB8fCBwZW5kaW5nX3Nob3dfdGltZXIgKVxuXHRcdFx0XHQmJiAhIGlzX2NvbXBvc2l0ZV9ub2RlKCBldmVudC50YXJnZXQgKVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJlcXVlc3RfY2xvc2UoICdvdXRzaWRlX3BvaW50ZXInLCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFBpbiB0aGUgc3VyZmFjZSB3aGVuZXZlciBmb2N1cyBlbnRlcnMgYW55IGNvbXBvc2l0ZS1yZWdpb24gY29udHJvbC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Rm9jdXNFdmVudH0gZXZlbnQgRm9jdXMtaW4gZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfZG9jdW1lbnRfZm9jdXNfaW4oIGV2ZW50ICkge1xuXHRcdFx0aWYgKCAhIGlzX3Zpc2libGVfY29udHJvbGxlciggY29udHJvbGxlciApIHx8ICEgaXNfY29tcG9zaXRlX25vZGUoIGV2ZW50LnRhcmdldCApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHBlbmRpbmdfZm9jdXNfY2hlY2tfdGltZXIgKSB7XG5cdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIHBlbmRpbmdfZm9jdXNfY2hlY2tfdGltZXIgKTtcblx0XHRcdFx0cGVuZGluZ19mb2N1c19jaGVja190aW1lciA9IDA7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHBlbmRpbmdfZm9jdXNfZW50cnlfdGltZXIgKSB7XG5cdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIHBlbmRpbmdfZm9jdXNfZW50cnlfdGltZXIgKTtcblx0XHRcdFx0cGVuZGluZ19mb2N1c19lbnRyeV90aW1lciA9IDA7XG5cdFx0XHR9XG5cdFx0XHRjYW5jZWxfcGVuZGluZ19jbG9zZSgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENsb3NlIGFmdGVyIGZvY3VzIGhhcyBzZXR0bGVkIG91dHNpZGUgdGhlIGNvbXBsZXRlIGNvbXBvc2l0ZSByZWdpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0ZvY3VzRXZlbnR9IGV2ZW50IEZvY3VzLW91dCBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9kb2N1bWVudF9mb2N1c19vdXQoIGV2ZW50ICkge1xuXHRcdFx0aWYgKCAhIGlzX3Zpc2libGVfY29udHJvbGxlciggY29udHJvbGxlciApIHx8ICEgaXNfY29tcG9zaXRlX25vZGUoIGV2ZW50LnRhcmdldCApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHBlbmRpbmdfZm9jdXNfY2hlY2tfdGltZXIgKSB7XG5cdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIHBlbmRpbmdfZm9jdXNfY2hlY2tfdGltZXIgKTtcblx0XHRcdH1cblx0XHRcdHBlbmRpbmdfZm9jdXNfY2hlY2tfdGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRwZW5kaW5nX2ZvY3VzX2NoZWNrX3RpbWVyID0gMDtcblx0XHRcdFx0aWYgKCBpc192aXNpYmxlX2NvbnRyb2xsZXIoIGNvbnRyb2xsZXIgKSAmJiAhIGlzX2NvbXBvc2l0ZV9ub2RlKCBkb2N1bWVudC5hY3RpdmVFbGVtZW50ICkgKSB7XG5cdFx0XHRcdFx0cmVxdWVzdF9jbG9zZSggJ291dHNpZGVfZm9jdXMnLCBmYWxzZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCAwICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0YWluIGFuIG9wdGVkLWluIHN1cmZhY2Ugd2hpbGUgZXh0ZXJuYWwgc2Nyb2xsaW5nIGNoYW5nZXMgZ2VvbWV0cnkuXG5cdFx0ICpcblx0XHQgKiBUaGUgc2hvcnQgZ3JhY2UgcGVyaW9kIHByZXZlbnRzIGEgc3ludGhldGljIHBvaW50ZXIgZXhpdCBjYXVzZWQgb25seSBieVxuXHRcdCAqIG1vdmluZyBjb250ZW50IGJlbmVhdGggYSBzdGF0aW9uYXJ5IHBvaW50ZXIgZnJvbSBjbG9zaW5nIHRoZSBzdXJmYWNlLlxuXHRcdCAqIEV4cGxpY2l0IG91dHNpZGUtcG9pbnRlciwgZm9jdXMsIENsb3NlLCBhbmQgRXNjYXBlIHBhdGhzIHJlbWFpbiBhY3RpdmUuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJldGFpbl9kdXJpbmdfZXh0ZXJuYWxfc2Nyb2xsKCkge1xuXHRcdFx0cmV0YWluZWRfc2Nyb2xsX3VudGlsID0gRGF0ZS5ub3coKSArIGV4dGVybmFsX3Njcm9sbF9ncmFjZV9tcztcblx0XHRcdGNhbmNlbF9wZW5kaW5nX29wZW4oKTtcblx0XHRcdGNhbmNlbF9wZW5kaW5nX2Nsb3NlKCk7XG5cdFx0XHRpZiAoIGlzX3Zpc2libGVfY29udHJvbGxlciggY29udHJvbGxlciApICkge1xuXHRcdFx0XHRzY2hlZHVsZV9zdXJmYWNlX2NvbnN0cmFpbnRfdXBkYXRlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQXBwbHkgdGhlIGNvbmZpZ3VyZWQgcG9saWN5IHRvIGEgc2Nyb2xsIG91dHNpZGUgdGhlIG93bmVkIHN1cmZhY2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCBDYXB0dXJlZCBzY3JvbGwgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfZG9jdW1lbnRfc2Nyb2xsKCBldmVudCApIHtcblx0XHRcdGlmICggaXNfcG9wb3Zlcl9vd25lZF9ub2RlKCBldmVudC50YXJnZXQgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBpc192aXNpYmxlX2NvbnRyb2xsZXIoIGNvbnRyb2xsZXIgKSB8fCBwZW5kaW5nX3Nob3dfdGltZXIgKSB7XG5cdFx0XHRcdGlmICggJ3JldGFpbicgPT09IGV4dGVybmFsX3Njcm9sbF9wb2xpY3kgKSB7XG5cdFx0XHRcdFx0cmV0YWluX2R1cmluZ19leHRlcm5hbF9zY3JvbGwoKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhIHJlcXVlc3RfY2xvc2UoICdleHRlcm5hbF9zY3JvbGwnLCBmYWxzZSApICYmIHBpbm5lZCAmJiAnc3RyaWN0X2xpdmVfb3duZXInID09PSByZWZlcmVuY2VfcG9saWN5ICkge1xuXHRcdFx0XHRcdHVwZGF0ZV9yZWZlcmVuY2UoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFwcGx5IHRoZSBjb25maWd1cmVkIHBvbGljeSB3aGVuIHRoZSBkb2N1bWVudCB2aWV3cG9ydCBpdHNlbGYgc2Nyb2xscy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX3dpbmRvd19zY3JvbGwoKSB7XG5cdFx0XHRpZiAoIGlzX3Zpc2libGVfY29udHJvbGxlciggY29udHJvbGxlciApIHx8IHBlbmRpbmdfc2hvd190aW1lciApIHtcblx0XHRcdFx0aWYgKCAncmV0YWluJyA9PT0gZXh0ZXJuYWxfc2Nyb2xsX3BvbGljeSApIHtcblx0XHRcdFx0XHRyZXRhaW5fZHVyaW5nX2V4dGVybmFsX3Njcm9sbCgpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICEgcmVxdWVzdF9jbG9zZSggJ2V4dGVybmFsX3Njcm9sbCcsIGZhbHNlICkgJiYgcGlubmVkICYmICdzdHJpY3RfbGl2ZV9vd25lcicgPT09IHJlZmVyZW5jZV9wb2xpY3kgKSB7XG5cdFx0XHRcdFx0dXBkYXRlX3JlZmVyZW5jZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUHJldmVudCBzdXJmYWNlIGFjdGl2YXRpb24gZnJvbSByZWFjaGluZyB1bnJlbGF0ZWQgZG9jdW1lbnQgY29uc3VtZXJzLlxuXHRcdCAqXG5cdFx0ICogVGFyZ2V0IGNvbnRyb2xzIHN0aWxsIHJlY2VpdmUgdGhlaXIgbmF0aXZlIGV2ZW50IGFuZCBsb2NhbCBoYW5kbGVycy5cblx0XHQgKiBFeHRlcm5hbCBvd25lZCBwb3J0YWxzIHJlbWFpbiB1bnN0b3BwZWQgYmVjYXVzZSB0aGVpciB3aWRnZXRzIG1heSByZXF1aXJlXG5cdFx0ICogZG9jdW1lbnQgZGVsZWdhdGlvbiBhbmQgdGhlaXIgYm9keSBwb3J0YWwgaXMgb3V0c2lkZSB0aGUgVGltZWxpbmUgc3VidHJlZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50IFBvaW50ZXItZG93biBvciBjbGljayBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9vd25lZF9hY3RpdmF0aW9uKCBldmVudCApIHtcblx0XHRcdGlmICggaXNfdmlzaWJsZV9jb250cm9sbGVyKCBjb250cm9sbGVyICkgJiYgaXNfcG9wb3Zlcl9vd25lZF9ub2RlKCBldmVudC50YXJnZXQgKSApIHtcblx0XHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRGVzdHJveSBvbmx5IHRoaXMgY29tcG9uZW50J3Mgc3VyZmFjZSwgVGlwcHkgc2VudGluZWwsIGFuZCBsaXN0ZW5lcnMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG5cdFx0XHRpZiAoIGRlc3Ryb3llZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cmVxdWVzdF9jbG9zZSggJ2Rlc3Ryb3knLCBmYWxzZSApO1xuXHRcdFx0Y2FuY2VsX2ludGVyYWN0aW9uX3RpbWVycygpO1xuXHRcdFx0Y2FuY2VsX3N1cmZhY2VfY29uc3RyYWludF91cGRhdGUoKTtcblx0XHRcdGZpbmlzaF9waW5uZWRfZHJhZygpO1xuXHRcdFx0ZmluaXNoX3Bpbm5lZF9yZXNpemUoKTtcblx0XHRcdGNsZWFyX3Bpbm5lZF9zdXJmYWNlX3NpemUoKTtcblx0XHRcdGRlc3Ryb3llZCA9IHRydWU7XG5cdFx0XHRyZW1vdmVfZGVzY3JpcHRpb24oKTtcblx0XHRcdHJlbGVhc2VfdHJpZ2dlcl9hcmlhKCk7XG5cdFx0XHRzdXJmYWNlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjbGljaycsIGhhbmRsZV9zdXJmYWNlX2NsaWNrICk7XG5cdFx0XHRzdXJmYWNlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdwb2ludGVyZG93bicsIGhhbmRsZV9vd25lZF9hY3RpdmF0aW9uICk7XG5cdFx0XHRpZiAoIGRyYWdfYnV0dG9uICkge1xuXHRcdFx0XHRkcmFnX2J1dHRvbi5yZW1vdmVFdmVudExpc3RlbmVyKCAncG9pbnRlcmRvd24nLCBoYW5kbGVfcGlubmVkX2RyYWdfcG9pbnRlcl9kb3duICk7XG5cdFx0XHRcdGRyYWdfYnV0dG9uLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgaGFuZGxlX3Bpbm5lZF9kcmFnX2tleWRvd24gKTtcblx0XHRcdH1cblx0XHRcdGlmICggcmVzaXplX2J1dHRvbiApIHtcblx0XHRcdFx0cmVzaXplX2J1dHRvbi5yZW1vdmVFdmVudExpc3RlbmVyKCAncG9pbnRlcmRvd24nLCBoYW5kbGVfcGlubmVkX3Jlc2l6ZV9wb2ludGVyX2Rvd24gKTtcblx0XHRcdFx0cmVzaXplX2J1dHRvbi5yZW1vdmVFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIGhhbmRsZV9waW5uZWRfcmVzaXplX2tleWRvd24gKTtcblx0XHRcdH1cblx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgaGFuZGxlX2RvY3VtZW50X2tleWRvd24sIHRydWUgKTtcblx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdwb2ludGVyb3ZlcicsIGhhbmRsZV9kb2N1bWVudF9wb2ludGVyX292ZXIsIHRydWUgKTtcblx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdwb2ludGVyb3V0JywgaGFuZGxlX2RvY3VtZW50X3BvaW50ZXJfb3V0LCB0cnVlICk7XG5cdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCAncG9pbnRlcmRvd24nLCBoYW5kbGVfZG9jdW1lbnRfcG9pbnRlcl9kb3duLCB0cnVlICk7XG5cdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnZm9jdXNpbicsIGhhbmRsZV9kb2N1bWVudF9mb2N1c19pbiwgdHJ1ZSApO1xuXHRcdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2ZvY3Vzb3V0JywgaGFuZGxlX2RvY3VtZW50X2ZvY3VzX291dCwgdHJ1ZSApO1xuXHRcdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3Njcm9sbCcsIGhhbmRsZV9kb2N1bWVudF9zY3JvbGwsIHRydWUgKTtcblx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoIGxheWVyX29wZW5fZXZlbnQsIGhhbmRsZV9sYXllcl9vcGVuICk7XG5cdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCBsYXllcl9jbG9zZV9ldmVudCwgaGFuZGxlX2xheWVyX2Nsb3NlICk7XG5cdFx0XHR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3Njcm9sbCcsIGhhbmRsZV93aW5kb3dfc2Nyb2xsICk7XG5cdFx0XHR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3Jlc2l6ZScsIGhhbmRsZV92aWV3cG9ydF9nZW9tZXRyeV9jaGFuZ2UgKTtcblx0XHRcdGlmICggd2luZG93LnZpc3VhbFZpZXdwb3J0ICkge1xuXHRcdFx0XHR3aW5kb3cudmlzdWFsVmlld3BvcnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3Jlc2l6ZScsIGhhbmRsZV92aWV3cG9ydF9nZW9tZXRyeV9jaGFuZ2UgKTtcblx0XHRcdFx0d2luZG93LnZpc3VhbFZpZXdwb3J0LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdzY3JvbGwnLCBoYW5kbGVfdmlld3BvcnRfZ2VvbWV0cnlfY2hhbmdlICk7XG5cdFx0XHR9XG5cdFx0XHR0aXBweV9pbnN0YW5jZS5kZXN0cm95KCk7XG5cdFx0XHRpZiAoIHNlbnRpbmVsLnBhcmVudE5vZGUgKSB7XG5cdFx0XHRcdHNlbnRpbmVsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoIHNlbnRpbmVsICk7XG5cdFx0XHR9XG5cdFx0XHR1bnJlZ2lzdGVyX3Zpc2libGVfY29udHJvbGxlciggY29udHJvbGxlciApO1xuXHRcdFx0ZGVsZXRlIHJlZ2lzdGVyZWRfY29udHJvbGxlcnNbIGNvbXBvbmVudF9pZCBdO1xuXHRcdFx0Y3VycmVudF90cmlnZ2VyID0gbnVsbDtcblx0XHRcdHJlZmVyZW5jZV9yZWN0X3Byb3ZpZGVyID0gbnVsbDtcblx0XHRcdHJlZmVyZW5jZV90cmFja3NfdHJpZ2dlciA9IGZhbHNlO1xuXHRcdFx0bGFzdF92YWxpZF9yZWZlcmVuY2VfcmVjdCA9IG51bGw7XG5cdFx0XHRhY3RpdmF0aW9uX21ldGhvZCA9ICdub25lJztcblx0XHRcdHBvaW50ZXJfaW5zaWRlX2NvbXBvc2l0ZSA9IGZhbHNlO1xuXHRcdFx0c3VwcHJlc3NlZF9mb2N1c190cmlnZ2VyID0gbnVsbDtcblx0XHRcdHJlZ2lzdGVyZWRfY2hpbGRfbGF5ZXJzID0ge307XG5cdFx0XHRvcGVuX2NoaWxkX2xheWVycyA9IHt9O1xuXHRcdFx0c3VzcGVuZGluZ19sYXllcnMgPSB7fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBIYW5kbGUgc2hhcmVkIGNsb3NlIGFuZCByZWNvdmVyYWJsZS1lcnJvciBjb250cm9scy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7TW91c2VFdmVudH0gZXZlbnQgU3VyZmFjZSBjbGljayBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9zdXJmYWNlX2NsaWNrKCBldmVudCApIHtcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0aWYgKCBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtc2hhcmVkLXVpLWNvbnRleHQtcG9wb3Zlci1waW5dJyApICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRzZXRfcGlubmVkKCAhIHBpbm5lZCApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1zaGFyZWQtdWktY29udGV4dC1wb3BvdmVyLWNsb3NlXScgKSApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0cmVxdWVzdF9jbG9zZSggJ2V4cGxpY2l0X2Nsb3NlJywgdHJ1ZSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1zaGFyZWQtdWktY29udGV4dC1wb3BvdmVyLXJldHJ5XScgKSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc2V0dGluZ3Mub25fcmV0cnkgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHNldHRpbmdzLm9uX3JldHJ5KCBjb250cm9sbGVyICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2xvc2Ugb25seSB0aGUgYWN0aXZlIG93bmVkIHN1cmZhY2Ugd2hlbiBFc2NhcGUgaXMgcHJlc3NlZC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7S2V5Ym9hcmRFdmVudH0gZXZlbnQgRG9jdW1lbnQga2V5Ym9hcmQgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfZG9jdW1lbnRfa2V5ZG93biggZXZlbnQgKSB7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdCdFc2NhcGUnID09PSBldmVudC5rZXlcblx0XHRcdFx0JiYgZ2V0X2VzY2FwZV9jb250cm9sbGVyKCBldmVudC50YXJnZXQgKSA9PT0gY29udHJvbGxlclxuXHRcdFx0XHQmJiB0aXBweV9pbnN0YW5jZS5zdGF0ZS5pc1Zpc2libGVcblx0XHRcdCkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0cmVxdWVzdF9jbG9zZSggJ2VzY2FwZScsIHRydWUgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aXBweV9pbnN0YW5jZSA9IHdpbmRvdy53cGJjX3RpcHB5KCBzZW50aW5lbCwge1xuXHRcdFx0YWxsb3dIVE1MOiB0cnVlLFxuXHRcdFx0YXJyb3c6IHRydWUsXG5cdFx0XHRhcHBlbmRUbzogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gcG9ydGFsX2hvc3Q7XG5cdFx0XHR9LFxuXHRcdFx0YXJpYToge1xuXHRcdFx0XHRjb250ZW50OiBudWxsLFxuXHRcdFx0XHRleHBhbmRlZDogZmFsc2Vcblx0XHRcdH0sXG5cdFx0XHRjb250ZW50OiBzdXJmYWNlLFxuXHRcdFx0ZHVyYXRpb246IFsgMTIwLCAwIF0sXG5cdFx0XHRnZXRSZWZlcmVuY2VDbGllbnRSZWN0OiBnZXRfcmVmZXJlbmNlX3JlY3QsXG5cdFx0XHRoaWRlT25DbGljazogZmFsc2UsXG5cdFx0XHRpbnRlcmFjdGl2ZTogdHJ1ZSxcblx0XHRcdGludGVyYWN0aXZlQm9yZGVyOiAxMCxcblx0XHRcdGludGVyYWN0aXZlRGVib3VuY2U6IDMwLFxuXHRcdFx0bWF4V2lkdGg6IG1heGltdW1fd2lkdGgsXG5cdFx0XHRvZmZzZXQ6IFsgMCwgMTAgXSxcblx0XHRcdHBsYWNlbWVudDogbm9ybWFsaXplX3BsYWNlbWVudCggc2V0dGluZ3MucGxhY2VtZW50ICksXG5cdFx0XHRwb3BwZXJPcHRpb25zOiB7XG5cdFx0XHRcdHN0cmF0ZWd5OiBwb3NpdGlvbmluZ19zdHJhdGVneSxcblx0XHRcdFx0bW9kaWZpZXJzOiBwb3BwZXJfbW9kaWZpZXJzXG5cdFx0XHR9LFxuXHRcdFx0cm9sZTogbnVsbCxcblx0XHRcdHNob3dPbkNyZWF0ZTogZmFsc2UsXG5cdFx0XHR0aGVtZTogJ3dwYmMtc2hhcmVkLXVpLWNvbnRleHQtcG9wb3ZlcicsXG5cdFx0XHR0b3VjaDogZmFsc2UsXG5cdFx0XHR0cmlnZ2VyOiAnbWFudWFsJyxcblx0XHRcdHpJbmRleDogbGF5ZXJfel9pbmRleCxcblx0XHRcdG9uSGlkZTogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHR2YXIgYXBwcm92ZWRfcmVhc29uID0gYXBwcm92ZWRfdGlwcHlfaGlkZV9yZWFzb247XG5cblx0XHRcdFx0aWYgKCBhcHByb3ZlZF9yZWFzb24gKSB7XG5cdFx0XHRcdFx0YXBwcm92ZWRfdGlwcHlfaGlkZV9yZWFzb24gPSAnJztcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHBpbm5lZCApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZmluYWxpemVfY2xvc2UoIGZhbHNlLCAndW5jb250cm9sbGVkX2xpYnJhcnlfaGlkZScgKTtcblxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH0sXG5cdFx0XHRvbk1vdW50OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHNjaGVkdWxlX3N1cmZhY2VfY29uc3RyYWludF91cGRhdGUoKTtcblx0XHRcdH0sXG5cdFx0XHRvblNob3duOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHNjaGVkdWxlX3N1cmZhY2VfY29uc3RyYWludF91cGRhdGUoKTtcblx0XHRcdH0sXG5cdFx0XHRvbkhpZGRlbjogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRjYW5jZWxfc3VyZmFjZV9jb25zdHJhaW50X3VwZGF0ZSgpO1xuXHRcdFx0XHRzdXJmYWNlLmhpZGRlbiA9IHRydWU7XG5cdFx0XHRcdHNldF9wb3BwZXJfbGF5b3V0X3BhcnRpY2lwYXRpb24oIGZhbHNlICk7XG5cdFx0XHRcdGNsZWFyX3N1cmZhY2VfaGVpZ2h0X2NvbnN0cmFpbnQoKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHRpZiAoICEgdGlwcHlfaW5zdGFuY2UgKSB7XG5cdFx0XHRpZiAoIHNlbnRpbmVsLnBhcmVudE5vZGUgKSB7XG5cdFx0XHRcdHNlbnRpbmVsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoIHNlbnRpbmVsICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRzdXJmYWNlLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGhhbmRsZV9zdXJmYWNlX2NsaWNrICk7XG5cdFx0c3VyZmFjZS5hZGRFdmVudExpc3RlbmVyKCAncG9pbnRlcmRvd24nLCBoYW5kbGVfb3duZWRfYWN0aXZhdGlvbiApO1xuXHRcdGlmICggZHJhZ19idXR0b24gKSB7XG5cdFx0XHRkcmFnX2J1dHRvbi5hZGRFdmVudExpc3RlbmVyKCAncG9pbnRlcmRvd24nLCBoYW5kbGVfcGlubmVkX2RyYWdfcG9pbnRlcl9kb3duICk7XG5cdFx0XHRkcmFnX2J1dHRvbi5hZGRFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIGhhbmRsZV9waW5uZWRfZHJhZ19rZXlkb3duICk7XG5cdFx0fVxuXHRcdGlmICggcmVzaXplX2J1dHRvbiApIHtcblx0XHRcdHJlc2l6ZV9idXR0b24uYWRkRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJkb3duJywgaGFuZGxlX3Bpbm5lZF9yZXNpemVfcG9pbnRlcl9kb3duICk7XG5cdFx0XHRyZXNpemVfYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgaGFuZGxlX3Bpbm5lZF9yZXNpemVfa2V5ZG93biApO1xuXHRcdH1cblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIGhhbmRsZV9kb2N1bWVudF9rZXlkb3duLCB0cnVlICk7XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJvdmVyJywgaGFuZGxlX2RvY3VtZW50X3BvaW50ZXJfb3ZlciwgdHJ1ZSApO1xuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdwb2ludGVyb3V0JywgaGFuZGxlX2RvY3VtZW50X3BvaW50ZXJfb3V0LCB0cnVlICk7XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJkb3duJywgaGFuZGxlX2RvY3VtZW50X3BvaW50ZXJfZG93biwgdHJ1ZSApO1xuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdmb2N1c2luJywgaGFuZGxlX2RvY3VtZW50X2ZvY3VzX2luLCB0cnVlICk7XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ2ZvY3Vzb3V0JywgaGFuZGxlX2RvY3VtZW50X2ZvY3VzX291dCwgdHJ1ZSApO1xuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdzY3JvbGwnLCBoYW5kbGVfZG9jdW1lbnRfc2Nyb2xsLCB0cnVlICk7XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggbGF5ZXJfb3Blbl9ldmVudCwgaGFuZGxlX2xheWVyX29wZW4gKTtcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCBsYXllcl9jbG9zZV9ldmVudCwgaGFuZGxlX2xheWVyX2Nsb3NlICk7XG5cdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICdzY3JvbGwnLCBoYW5kbGVfd2luZG93X3Njcm9sbCwgeyBwYXNzaXZlOiB0cnVlIH0gKTtcblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3Jlc2l6ZScsIGhhbmRsZV92aWV3cG9ydF9nZW9tZXRyeV9jaGFuZ2UsIHsgcGFzc2l2ZTogdHJ1ZSB9ICk7XG5cdFx0aWYgKCB3aW5kb3cudmlzdWFsVmlld3BvcnQgKSB7XG5cdFx0XHR3aW5kb3cudmlzdWFsVmlld3BvcnQuYWRkRXZlbnRMaXN0ZW5lciggJ3Jlc2l6ZScsIGhhbmRsZV92aWV3cG9ydF9nZW9tZXRyeV9jaGFuZ2UsIHsgcGFzc2l2ZTogdHJ1ZSB9ICk7XG5cdFx0XHR3aW5kb3cudmlzdWFsVmlld3BvcnQuYWRkRXZlbnRMaXN0ZW5lciggJ3Njcm9sbCcsIGhhbmRsZV92aWV3cG9ydF9nZW9tZXRyeV9jaGFuZ2UsIHsgcGFzc2l2ZTogdHJ1ZSB9ICk7XG5cdFx0fVxuXHRcdHNldF9pZGxlKCAnJyApO1xuXG5cdFx0Y29udHJvbGxlciA9IHtcblx0XHRcdG9wZW46IG9wZW4sXG5cdFx0XHRvcGVuX2tleWJvYXJkOiBvcGVuX2tleWJvYXJkLFxuXHRcdFx0aGFuZGxlX3RyaWdnZXJfa2V5ZG93bjogaGFuZGxlX3RyaWdnZXJfa2V5ZG93bixcblx0XHRcdGZvY3VzX2ZpcnN0X2NvbnRyb2w6IGZvY3VzX2ZpcnN0X2NvbnRyb2wsXG5cdFx0XHRzY2hlZHVsZV9wb2ludGVyX29wZW46IHNjaGVkdWxlX3BvaW50ZXJfb3Blbixcblx0XHRcdGNhbmNlbF9wZW5kaW5nX29wZW46IGNhbmNlbF9wZW5kaW5nX29wZW4sXG5cdFx0XHRjYW5jZWxfcGVuZGluZ19jbG9zZTogY2FuY2VsX3BlbmRpbmdfY2xvc2UsXG5cdFx0XHRyZWdpc3Rlcl9jaGlsZF9sYXllcjogcmVnaXN0ZXJfY2hpbGRfbGF5ZXIsXG5cdFx0XHR1bnJlZ2lzdGVyX2NoaWxkX2xheWVyOiB1bnJlZ2lzdGVyX2NoaWxkX2xheWVyLFxuXHRcdFx0Y2FuX3VzZV90cmlnZ2VyOiBjYW5fdXNlX3RyaWdnZXIsXG5cdFx0XHRjbG9zZTogY2xvc2UsXG5cdFx0XHRyZXF1ZXN0X2Nsb3NlOiByZXF1ZXN0X2Nsb3NlLFxuXHRcdFx0c2V0X3Bpbm5lZDogc2V0X3Bpbm5lZCxcblx0XHRcdGlzX3Bpbm5lZDogaXNfcGlubmVkLFxuXHRcdFx0c3VzcGVuZDogc3VzcGVuZCxcblx0XHRcdHJlc3VtZTogcmVzdW1lLFxuXHRcdFx0cmViaW5kX3RyaWdnZXI6IHJlYmluZF90cmlnZ2VyLFxuXHRcdFx0ZGVzdHJveTogZGVzdHJveSxcblx0XHRcdHNldF9pZGxlOiBzZXRfaWRsZSxcblx0XHRcdHNldF9sb2FkaW5nOiBzZXRfbG9hZGluZyxcblx0XHRcdHNldF9jb250ZW50OiBzZXRfY29udGVudCxcblx0XHRcdHNldF90aXRsZTogc2V0X3RpdGxlLFxuXHRcdFx0c2V0X2hlYWRlcjogc2V0X2hlYWRlcixcblx0XHRcdHJlc2V0X2hlYWRlcjogcmVzZXRfaGVhZGVyLFxuXHRcdFx0c2V0X2J1c3k6IHNldF9idXN5LFxuXHRcdFx0c2V0X2VtcHR5OiBzZXRfZW1wdHksXG5cdFx0XHRzZXRfZXJyb3I6IHNldF9lcnJvcixcblx0XHRcdHVwZGF0ZV9yZWZlcmVuY2U6IHVwZGF0ZV9yZWZlcmVuY2UsXG5cdFx0XHRnZXRfc3RhdGU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIHN0YXRlO1xuXHRcdFx0fSxcblx0XHRcdGdldF9tb2RlOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBtb2RlO1xuXHRcdFx0fSxcblx0XHRcdGdldF9zdXJmYWNlOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBzdXJmYWNlO1xuXHRcdFx0fSxcblx0XHRcdGdldF9hY3RpdmF0aW9uX21ldGhvZDogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gYWN0aXZhdGlvbl9tZXRob2Q7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0X3JlZmVyZW5jZV9yZWN0OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBnZXRfcmVmZXJlbmNlX3JlY3QoKTtcblx0XHRcdH0sXG5cdFx0XHRpc19vcGVuOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBCb29sZWFuKCB0aXBweV9pbnN0YW5jZS5zdGF0ZS5pc1Zpc2libGUgKTtcblx0XHRcdH0sXG5cdFx0XHRpc19zdXNwZW5kZWQ6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIHN1c3BlbmRlZDtcblx0XHRcdH0sXG5cdFx0XHRnZXRfc3VzcGVuc2lvbl9yZWFzb246IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIHN1c3BlbnNpb25fcmVhc29uO1xuXHRcdFx0fSxcblx0XHRcdG93bnNfbm9kZTogZnVuY3Rpb24gKCBjYW5kaWRhdGUgKSB7XG5cdFx0XHRcdHJldHVybiBpc19jb21wb3NpdGVfbm9kZSggY2FuZGlkYXRlICk7XG5cdFx0XHR9LFxuXHRcdFx0Y2FuX2hhbmRsZV9lc2NhcGU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIEJvb2xlYW4oXG5cdFx0XHRcdFx0aXNfdmlzaWJsZV9jb250cm9sbGVyKCBjb250cm9sbGVyIClcblx0XHRcdFx0XHQmJiB0aXBweV9pbnN0YW5jZS5zdGF0ZS5pc1Zpc2libGVcblx0XHRcdFx0XHQmJiAhIGhhc19vcGVuX2NoaWxkX2xheWVycygpXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRzeW5jaHJvbml6ZV9waW5fY29udHJvbCgpO1xuXHRcdHJlZ2lzdGVyZWRfY29udHJvbGxlcnNbIGNvbXBvbmVudF9pZCBdID0gY29udHJvbGxlcjtcblxuXHRcdHJldHVybiBjb250cm9sbGVyO1xuXHR9XG5cblx0LyoqXG5cdCAqIENsb3NlIHRoZSBhY3RpdmUgc2hhcmVkIENvbnRleHQgUG9wb3ZlciwgaWYgYW55LlxuXHQgKlxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IHJlc3RvcmVfZm9jdXMgV2hldGhlciBhbiBpbnRlcmFjdGl2ZSBzdXJmYWNlIHJlc3RvcmVzIGZvY3VzLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gY2xvc2VfYWN0aXZlKCByZXN0b3JlX2ZvY3VzICkge1xuXHRcdGlmICggYWN0aXZlX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRhY3RpdmVfY29udHJvbGxlci5yZXF1ZXN0X2Nsb3NlKCAncHJvZ3JhbW1hdGljJywgQm9vbGVhbiggcmVzdG9yZV9mb2N1cyApICk7XG5cdFx0fVxuXHR9XG5cblx0YXBpLmNyZWF0ZSA9IGNyZWF0ZTtcblx0YXBpLnJlZ2lzdGVyID0gY3JlYXRlO1xuXHRhcGkuY2xvc2VfYWN0aXZlID0gY2xvc2VfYWN0aXZlO1xuXHRhcGkubm90aWZ5X2xheWVyX29wZW4gPSBmdW5jdGlvbiAoIGRlc2NyaXB0b3IgKSB7XG5cdFx0cmV0dXJuIGRpc3BhdGNoX2xheWVyX2V2ZW50KCBsYXllcl9vcGVuX2V2ZW50LCBkZXNjcmlwdG9yICk7XG5cdH07XG5cdGFwaS5ub3RpZnlfbGF5ZXJfY2xvc2UgPSBmdW5jdGlvbiAoIGRlc2NyaXB0b3IgKSB7XG5cdFx0cmV0dXJuIGRpc3BhdGNoX2xheWVyX2V2ZW50KCBsYXllcl9jbG9zZV9ldmVudCwgZGVzY3JpcHRvciApO1xuXHR9O1xuXHR3aW5kb3cud3BiY19zaGFyZWRfdWlfY29udGV4dF9wb3BvdmVyID0gYXBpO1xufSggd2luZG93LCBkb2N1bWVudCwgd2luZG93LndwICkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFLFdBQVdBLE1BQU0sRUFBRUMsUUFBUSxFQUFFQyxFQUFFLEVBQUc7RUFDbkMsWUFBWTs7RUFFWixJQUFJQyxHQUFHLEdBQUdILE1BQU0sQ0FBQ0ksOEJBQThCLElBQUksQ0FBQyxDQUFDO0VBQ3JELElBQUlDLGlCQUFpQixHQUFHLElBQUk7RUFDNUIsSUFBSUMsbUJBQW1CLEdBQUcsRUFBRTtFQUM1QixJQUFJQyxzQkFBc0IsR0FBRyxDQUFDLENBQUM7RUFDL0IsSUFBSUMsZ0JBQWdCLEdBQUcsMkJBQTJCO0VBQ2xELElBQUlDLGlCQUFpQixHQUFHLDRCQUE0QjtFQUNwRCxJQUFJQyx1QkFBdUIsR0FBRywrQkFBK0I7RUFDN0QsSUFBSUMsc0JBQXNCLEdBQUcsOEhBQThIO0VBQzNKLElBQUlDLDhCQUE4QixHQUFHLDZFQUE2RTtFQUNsSCxJQUFJQyx1QkFBdUIsR0FBRywrQkFBK0I7RUFDN0QsSUFBSUMsb0JBQW9CLEdBQUcsQ0FBRSxpQkFBaUIsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFFO0VBQ3ZHLElBQUlDLHNCQUFzQixH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TUFDRG1LLFlBQVksRUFBRSxTQUFBQSxDQUFBLEVBQVk7UUFDekIsT0FBT3pYLFNBQVM7TUFDakIsQ0FBQztNQUNEMFgscUJBQXFCLEVBQUUsU0FBQUEsQ0FBQSxFQUFZO1FBQ2xDLE9BQU96WCxpQkFBaUI7TUFDekIsQ0FBQztNQUNEbkosU0FBUyxFQUFFLFNBQUFBLENBQVd4RCxTQUFTLEVBQUc7UUFDakMsT0FBTzJWLGlCQUFpQixDQUFFM1YsU0FBVSxDQUFDO01BQ3RDLENBQUM7TUFDRHlELGlCQUFpQixFQUFFLFNBQUFBLENBQUEsRUFBWTtRQUM5QixPQUFPOEQsT0FBTyxDQUNiaEYscUJBQXFCLENBQUVMLFVBQVcsQ0FBQyxJQUNoQ21ILGNBQWMsQ0FBQzJELEtBQUssQ0FBQ2dOLFNBQVMsSUFDOUIsQ0FBRTlFLHFCQUFxQixDQUFDLENBQzVCLENBQUM7TUFDRjtJQUNELENBQUM7SUFDRGtFLHVCQUF1QixDQUFDLENBQUM7SUFDekJsYSxzQkFBc0IsQ0FBRTBJLFlBQVksQ0FBRSxHQUFHMUYsVUFBVTtJQUVuRCxPQUFPQSxVQUFVO0VBQ2xCOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNtaUIsWUFBWUEsQ0FBRTNELGFBQWEsRUFBRztJQUN0QyxJQUFLMWhCLGlCQUFpQixFQUFHO01BQ3hCQSxpQkFBaUIsQ0FBQzRELGFBQWEsQ0FBRSxjQUFjLEVBQUUyRSxPQUFPLENBQUVtWixhQUFjLENBQUUsQ0FBQztJQUM1RTtFQUNEO0VBRUE1aEIsR0FBRyxDQUFDMkksTUFBTSxHQUFHQSxNQUFNO0VBQ25CM0ksR0FBRyxDQUFDd2xCLFFBQVEsR0FBRzdjLE1BQU07RUFDckIzSSxHQUFHLENBQUN1bEIsWUFBWSxHQUFHQSxZQUFZO0VBQy9CdmxCLEdBQUcsQ0FBQ3lsQixpQkFBaUIsR0FBRyxVQUFXbGtCLFVBQVUsRUFBRztJQUMvQyxPQUFPSyxvQkFBb0IsQ0FBRXZCLGdCQUFnQixFQUFFa0IsVUFBVyxDQUFDO0VBQzVELENBQUM7RUFDRHZCLEdBQUcsQ0FBQzBsQixrQkFBa0IsR0FBRyxVQUFXbmtCLFVBQVUsRUFBRztJQUNoRCxPQUFPSyxvQkFBb0IsQ0FBRXRCLGlCQUFpQixFQUFFaUIsVUFBVyxDQUFDO0VBQzdELENBQUM7RUFDRDFCLE1BQU0sQ0FBQ0ksOEJBQThCLEdBQUdELEdBQUc7QUFDNUMsQ0FBQyxFQUFFSCxNQUFNLEVBQUVDLFFBQVEsRUFBRUQsTUFBTSxDQUFDRSxFQUFHLENBQUMiLCJpZ25vcmVMaXN0IjpbXX0=
