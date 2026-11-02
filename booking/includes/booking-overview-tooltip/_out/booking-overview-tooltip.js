"use strict";

/**
 * Booking Overview adapter for the shared Context Popover.
 *
 * The adapter owns the booking-domain DTO allow list, fixed WordPress template,
 * Timeline suppression policy, and Booking Inspector handoff. The shared
 * controller owns the configured portal, Tippy positioning, explicit-dismiss
 * lifecycle, and keyboard focus entry.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
(function (window, document, wp, $) {
  'use strict';

  window.wpbc_booking_overview_tooltip = window.wpbc_booking_overview_tooltip || {};

  /**
   * Create one host-scoped Booking Overview Context Popover adapter.
   *
   * @param {HTMLElement} root          Timeline root containing booking triggers.
   * @param {Object}      configuration Executable-free server configuration.
   * @param {Object}      callbacks     Timeline suppression and Inspector hooks.
   * @return {Object|null} Domain adapter API, or null when dependencies are absent.
   */
  function create_instance_controller(root, configuration, callbacks) {
    configuration = configuration || {};
    callbacks = callbacks || {};
    if (!root || !configuration.active || !wp || !$ || 'function' !== typeof wp.template || !window.wpbc_shared_ui_context_popover || 'function' !== typeof window.wpbc_shared_ui_context_popover.create) {
      return null;
    }
    var template = wp.template(String(configuration.template_id || ''));
    var header_template = wp.template(String(configuration.header_template_id || ''));
    var details_template = wp.template(String(configuration.details_template_id || ''));
    var summary_template = wp.template(String(configuration.summary_template_id || ''));
    var loading_template = wp.template(String(configuration.loading_template_id || ''));
    var error_template = wp.template(String(configuration.error_template_id || ''));
    var i18n = configuration.i18n && 'object' === typeof configuration.i18n ? configuration.i18n : {};
    var transport = configuration.transport && 'object' === typeof configuration.transport ? configuration.transport : {};
    var scroll_resume_delay_ms = normalize_delay(configuration.scroll_resume_delay_ms, 220, 100, 1000);
    var positioning_boundary = root.querySelector('[data-wpbc-timeline-canvas]');
    var portal_host = root.querySelector('[data-wpbc-timeline-canvas-axis-content]');
    var trigger_dtos = new window.WeakMap();
    var trigger_contexts = new window.WeakMap();
    var trigger_cards = new window.WeakMap();
    var active_trigger = null;
    var active_generation = 0;
    var render_generation = 1;
    var details_cache = new window.Map();
    var inflight_requests = new window.Map();
    var maximum_cache_entries = 24;
    var scroll_timer = 0;
    var geometry_frame = 0;
    var geometry_resize_observer = null;
    var rebind_candidates = [];
    var refresh_rebind_pending = false;
    var blocking_suspension = false;
    var is_scrolling = false;
    var visibility_states = ['hidden', 'transient', 'pinned', 'temporarily_suspended'];
    var details_states = ['idle', 'loading', 'ready', 'empty', 'error'];
    var reference_states = ['live_control', 'temporarily_missing', 'outside_visible_canvas'];
    var popover_state = create_empty_popover_state();
    var shared_controller;
    var popover_surface;
    if (!positioning_boundary || !portal_host) {
      return null;
    }
    shared_controller = window.wpbc_shared_ui_context_popover.create({
      id: String(configuration.component_id || ''),
      mode: 'interactive' === configuration.mode ? 'interactive' : 'preview',
      owner_id: String(configuration.owner_id || configuration.component_id || ''),
      interaction_group: String(configuration.interaction_group || configuration.component_id || ''),
      pin_policy: 'manual' === String(configuration.pin_policy || '') ? 'manual' : 'none',
      external_scroll_policy: 'retain' === String(configuration.external_scroll_policy || '') ? 'retain' : 'dismiss',
      dismiss_policy: 'explicit',
      external_scroll_grace_ms: scroll_resume_delay_ms,
      pin_label: normalize_text(i18n.pin, 160),
      pinned_label: normalize_text(i18n.pinned, 160),
      unpin_label: normalize_text(i18n.unpin, 160),
      drag_label: normalize_text(i18n.move, 160),
      title: normalize_text(i18n.title, 200),
      close_label: normalize_text(i18n.close, 160),
      show_delay_ms: configuration.show_delay_ms,
      hide_delay_ms: configuration.hide_delay_ms,
      pointer_anchor: 'trigger_block_edge',
      placement: 'bottom',
      fallback_placements: ['top'],
      allow_flip: false,
      get_initial_placement_bounds: get_visible_timeline_rectangle,
      owns_trigger_aria: true,
      aria_haspopup: 'dialog',
      preferred_width: configuration.preferred_width,
      maximum_width: configuration.maximum_width,
      fixed_unpinned_height: configuration.fixed_unpinned_height,
      maximum_resized_width: configuration.maximum_resized_width,
      positioning_boundary: positioning_boundary,
      portal_host: portal_host,
      positioning_strategy: 'absolute',
      layer_z_index: configuration.layer_z_index,
      prevent_overflow: false,
      boundary_cross_axis: true,
      boundary_tether: false,
      fit_on_first_open: true === configuration.fit_on_first_open,
      pin_to_viewport: true === configuration.pin_to_viewport,
      draggable_when_pinned: true === configuration.draggable_when_pinned,
      resizable_when_pinned: true === configuration.resizable_when_pinned,
      resize_label: normalize_text(i18n.resize, 160),
      reference_policy: 'strict_live_owner',
      get_reference_rect: get_live_reference_rect,
      hide_arrow_when_pinned: true,
      on_open: handle_shared_open,
      on_close: handle_shared_close,
      on_pin_change: handle_shared_pin_change,
      on_suspend: handle_shared_suspend,
      on_resume: handle_shared_resume,
      on_retry: handle_retry
    });
    popover_surface = shared_controller ? shared_controller.get_surface() : null;
    if (!shared_controller || !popover_surface) {
      return null;
    }
    popover_surface.classList.add('wpbc_booking_overview_tooltip__surface');

    /**
     * Create the independent page-memory state axes for Booking Overview.
     *
     * The owner uses canonical booking identity plus a render generation and
     * segment hint. A DOM node is deliberately not part of this serializable
     * state so a later phase can rebind after Timeline replaces card nodes.
     *
     * @return {Object} Empty visibility, details, owner, and reference state.
     */
    function create_empty_popover_state() {
      return {
        visibility: 'hidden',
        details: 'idle',
        owner: {
          booking_id: 0,
          render_generation: 0,
          segment_hint: ''
        },
        reference: 'temporarily_missing'
      };
    }

    /**
     * Commit one allow-listed popover state-axis value.
     *
     * @param {string} axis       Visibility, details, or reference axis.
     * @param {string} next_value Candidate allow-listed value.
     * @return {boolean} True when the requested value was accepted.
     */
    function set_popover_axis(axis, next_value) {
      var allowed_values = {
        visibility: visibility_states,
        details: details_states,
        reference: reference_states
      };
      if (!allowed_values[axis] || -1 === allowed_values[axis].indexOf(next_value)) {
        return false;
      }
      popover_state[axis] = next_value;
      return true;
    }

    /**
     * Resolve the stable owner context registered for one rendered trigger.
     *
     * @param {HTMLElement|null} trigger Registered Timeline booking trigger.
     * @return {Object} Canonical identity and render-generation context.
     */
    function get_trigger_context(trigger) {
      var context = trigger ? trigger_contexts.get(trigger) : null;
      return context || {
        booking_id: 0,
        render_generation: 0,
        segment_hint: ''
      };
    }

    /**
     * Return the visible viewport rectangle used by Timeline owner geometry.
     *
     * @return {Object} Physical viewport edges in CSS pixels.
     */
    function get_visual_viewport_rectangle() {
      var visual_viewport = window.visualViewport;
      var left = visual_viewport && Number.isFinite(visual_viewport.offsetLeft) ? visual_viewport.offsetLeft : 0;
      var top = visual_viewport && Number.isFinite(visual_viewport.offsetTop) ? visual_viewport.offsetTop : 0;
      var width = visual_viewport && Number.isFinite(visual_viewport.width) ? visual_viewport.width : Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      var height = visual_viewport && Number.isFinite(visual_viewport.height) ? visual_viewport.height : Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
      return {
        left: left,
        top: top,
        right: left + width,
        bottom: top + height
      };
    }

    /**
     * Resolve the Timeline area in which a Booking Overview may be anchored.
     *
     * The visible area is the intersection of the time canvas and Visual
     * Viewport below the sticky Resource/date header. Keeping this calculation
     * in the Booking adapter preserves the shared controller's domain-neutral
     * positioning contract.
     *
     * @return {Object|null} Physical visible edges in CSS pixels, or null.
     */
    function get_visible_timeline_rectangle() {
      var canvas_rectangle;
      var viewport_rectangle;
      var sticky_header;
      var sticky_rectangle;
      var visible_left;
      var visible_top;
      var visible_right;
      var visible_bottom;
      if (!positioning_boundary || !positioning_boundary.isConnected) {
        return null;
      }
      canvas_rectangle = positioning_boundary.getBoundingClientRect();
      viewport_rectangle = get_visual_viewport_rectangle();
      visible_left = Math.max(canvas_rectangle.left, viewport_rectangle.left);
      visible_top = Math.max(canvas_rectangle.top, viewport_rectangle.top);
      visible_right = Math.min(canvas_rectangle.right, viewport_rectangle.right);
      visible_bottom = Math.min(canvas_rectangle.bottom, viewport_rectangle.bottom);
      sticky_header = root.querySelector('.wpbc_timeline__sticky_header');
      if (sticky_header && sticky_header.getClientRects().length) {
        sticky_rectangle = sticky_header.getBoundingClientRect();
        if (sticky_rectangle.bottom > visible_top && sticky_rectangle.top < visible_bottom && sticky_rectangle.right > visible_left && sticky_rectangle.left < visible_right) {
          visible_top = Math.min(visible_bottom, Math.max(visible_top, sticky_rectangle.bottom));
        }
      }
      if (visible_right <= visible_left || visible_bottom <= visible_top) {
        return null;
      }
      return {
        left: visible_left,
        top: visible_top,
        right: visible_right,
        bottom: visible_bottom,
        width: visible_right - visible_left,
        height: visible_bottom - visible_top,
        x: visible_left,
        y: visible_top
      };
    }

    /**
     * Resolve one registered information button's current physical rectangle.
     *
     * @param {HTMLElement|null} trigger Registered booking information button.
     * @return {DOMRect|null} Current trigger rectangle or null when unavailable.
     */
    function get_trigger_rectangle(trigger) {
      if (!trigger || !trigger.isConnected || !root.contains(trigger)) {
        return null;
      }
      return trigger.getBoundingClientRect();
    }

    /**
     * Determine whether two physical rectangles overlap with positive area.
     *
     * @param {Object} first_rectangle  First physical rectangle.
     * @param {Object} second_rectangle Second physical rectangle.
     * @return {boolean} True when the rectangles intersect.
     */
    function rectangles_intersect(first_rectangle, second_rectangle) {
      return first_rectangle.right > second_rectangle.left && first_rectangle.left < second_rectangle.right && first_rectangle.bottom > second_rectangle.top && first_rectangle.top < second_rectangle.bottom;
    }

    /**
     * Resolve the live reference for one authorized control.
     *
     * Detached controls still return null so the strict-owner policy can suspend
     * safely. The raw rectangle lets the axis-owned portal move and clip with the
     * booking instead of being held at a browser or canvas edge.
     *
     * @param {HTMLElement|null} trigger Registered booking information button.
     * @return {Object|null} Popper-compatible reference rectangle or null.
     */
    function get_live_reference_rect(trigger) {
      return get_trigger_rectangle(trigger);
    }

    /**
     * Classify the current trigger reference without making it the owner ID.
     *
     * @param {HTMLElement|null} trigger Registered Timeline booking trigger.
     * @return {string} Allow-listed reference lifecycle state.
     */
    function get_trigger_reference_state(trigger) {
      var trigger_rectangle = get_trigger_rectangle(trigger);
      var visible_rectangle;
      if (!trigger_rectangle) {
        return 'temporarily_missing';
      }
      visible_rectangle = get_visible_timeline_rectangle();
      if (!visible_rectangle || !rectangles_intersect(trigger_rectangle, visible_rectangle)) {
        return 'outside_visible_canvas';
      }
      return 'live_control';
    }

    /**
     * Copy state for diagnostics and future Timeline rebind orchestration.
     *
     * @return {Object} Executable-free snapshot with no DOM reference.
     */
    function get_popover_state() {
      return {
        visibility: popover_state.visibility,
        details: popover_state.details,
        owner: {
          booking_id: popover_state.owner.booking_id,
          render_generation: popover_state.owner.render_generation,
          segment_hint: popover_state.owner.segment_hint
        },
        reference: popover_state.reference
      };
    }

    /**
     * Retain the trigger accepted by this adapter's shared controller.
     *
     * @param {Object}      opened_controller Shared controller instance.
     * @param {HTMLElement} trigger           Activating booking card.
     * @return {void}
     */
    function handle_shared_open(opened_controller, trigger) {
      if (opened_controller === shared_controller) {
        active_trigger = trigger;
        popover_state.owner = get_trigger_context(trigger);
        set_popover_axis('visibility', shared_controller.is_pinned() ? 'pinned' : 'transient');
        set_popover_axis('reference', get_trigger_reference_state(trigger));
        observe_active_geometry();
        load_details(trigger);
      }
    }

    /**
     * Release the active booking trigger after this shared instance closes.
     *
     * @return {void}
     */
    function handle_shared_close() {
      stop_geometry_tracking();
      active_generation += 1;
      active_trigger = null;
      popover_state = create_empty_popover_state();
    }

    /**
     * Mirror the shared neutral pin state into domain page memory.
     *
     * @param {Object}  changed_controller Shared controller instance.
     * @param {boolean} is_pinned         Current neutral pin state.
     * @return {void}
     */
    function handle_shared_pin_change(changed_controller, is_pinned) {
      if (changed_controller !== shared_controller || !active_trigger) {
        return;
      }
      set_popover_axis('visibility', is_pinned ? 'pinned' : 'transient');
      schedule_live_geometry_update();
    }

    /**
     * Retain domain identity while a blocking layer owns visual presence.
     *
     * @param {Object} suspended_controller Shared controller instance.
     * @return {void}
     */
    function handle_shared_suspend(suspended_controller) {
      if (suspended_controller === shared_controller && active_trigger) {
        set_popover_axis('visibility', 'temporarily_suspended');
        if ('temporarily_missing' !== popover_state.reference) {
          set_popover_axis('reference', get_trigger_reference_state(active_trigger));
        }
      }
    }

    /**
     * Restore pinned page-memory visibility after safe shared resumption.
     *
     * @param {Object} resumed_controller Shared controller instance.
     * @return {void}
     */
    function handle_shared_resume(resumed_controller) {
      if (resumed_controller === shared_controller && active_trigger) {
        set_popover_axis('visibility', 'pinned');
        set_popover_axis('reference', get_trigger_reference_state(active_trigger));
        observe_active_geometry();
        if (-1 !== ['idle', 'loading'].indexOf(popover_state.details)) {
          load_details(active_trigger);
        }
      }
    }

    /**
     * Cancel the single pending geometry frame owned by this adapter.
     *
     * @return {void}
     */
    function cancel_geometry_frame() {
      if (geometry_frame) {
        window.cancelAnimationFrame(geometry_frame);
        geometry_frame = 0;
      }
    }

    /**
     * Stop active owner observation when the popover no longer owns a booking.
     *
     * @return {void}
     */
    function stop_geometry_tracking() {
      cancel_geometry_frame();
      if (geometry_resize_observer) {
        geometry_resize_observer.disconnect();
      }
    }

    /**
     * Observe only the current owner and its shared layout containers.
     *
     * One controller owns one observer; no observer is allocated per booking.
     *
     * @return {void}
     */
    function observe_active_geometry() {
      var active_card = active_trigger ? trigger_cards.get(active_trigger) : null;
      var observed_nodes = [root, positioning_boundary, active_card, active_trigger];
      if ('function' !== typeof window.ResizeObserver || !active_trigger) {
        return;
      }
      if (!geometry_resize_observer) {
        geometry_resize_observer = new window.ResizeObserver(schedule_live_geometry_update);
      }
      geometry_resize_observer.disconnect();
      observed_nodes.forEach(function (observed_node, observed_index) {
        if (observed_node && observed_node.isConnected && observed_nodes.indexOf(observed_node) === observed_index) {
          geometry_resize_observer.observe(observed_node);
        }
      });
    }

    /**
     * Apply one current owner measurement after coalesced layout changes.
     *
     * @return {void}
     */
    function update_live_geometry() {
      var reference_state;
      var suspension_reason;
      if (!active_trigger || !shared_controller.is_open() && !shared_controller.is_pinned()) {
        return;
      }
      reference_state = get_trigger_reference_state(active_trigger);
      set_popover_axis('reference', reference_state);
      if ('temporarily_missing' === reference_state) {
        if (shared_controller.is_pinned()) {
          shared_controller.suspend('reference_unavailable');
        } else if (shared_controller.is_open()) {
          shared_controller.request_close('external_scroll', false);
        }
        return;
      }
      if (shared_controller.is_suspended()) {
        suspension_reason = shared_controller.get_suspension_reason();
        if (!blocking_suspension && 'reference_unavailable' === suspension_reason) {
          shared_controller.resume();
        }
        return;
      }
      shared_controller.update_reference();
    }

    /**
     * Coalesce scroll, resize, image, and observer notifications into one frame.
     *
     * @return {void}
     */
    function schedule_live_geometry_update() {
      if (geometry_frame || !active_trigger || !shared_controller.is_open() && !shared_controller.is_pinned()) {
        return;
      }
      geometry_frame = window.requestAnimationFrame(function () {
        geometry_frame = 0;
        update_live_geometry();
      });
    }

    /**
     * Retry the current booking without trusting stale error-state data.
     *
     * @return {void}
     */
    function handle_retry() {
      var trigger = active_trigger;
      var booking_id;
      if (!trigger || !trigger.isConnected || !root.contains(trigger) || !get_trigger_context(trigger).booking_id) {
        shared_controller.request_close('authorization_invalidation', false);
        return;
      }
      booking_id = get_trigger_booking_id(trigger);
      if (!get_booking_view(booking_id)) {
        shared_controller.request_close('authorization_invalidation', false);
        return;
      }
      invalidate_booking(booking_id, false);
      load_details(trigger);
    }

    /**
     * Normalize a bounded millisecond delay.
     *
     * @param {*}      candidate Candidate delay.
     * @param {number} fallback  Fallback delay.
     * @param {number} minimum   Minimum delay.
     * @param {number} maximum   Maximum delay.
     * @return {number} Bounded integer delay.
     */
    function normalize_delay(candidate, fallback, minimum, maximum) {
      candidate = Number(candidate);
      if (!Number.isFinite(candidate)) {
        candidate = fallback;
      }
      return Math.max(minimum, Math.min(maximum, Math.round(candidate)));
    }

    /**
     * Normalize one bounded tooltip DTO at the browser trust boundary.
     *
     * Unknown keys are discarded so compact card data cannot accidentally
     * expand into notes, raw form storage, ownership, or financial fields.
     *
     * @param {Object} dto Server-authorized Booking Overview DTO.
     * @return {Object|null} Executable-free allow-listed DTO, or null.
     */
    function normalize_dto(dto, resource_summary) {
      var booking_id = Math.max(0, Math.round(Number(dto && dto.booking_id) || 0));
      var resource_id = Math.max(0, Math.round(Number(dto && dto.resource_id) || 0));
      if (!dto || 1 !== Number(dto.schema_version) || !booking_id) {
        return null;
      }
      return {
        schema_version: 1,
        booking_id: booking_id,
        resource_id: resource_id,
        heading: normalize_text(dto.heading, 160),
        label: normalize_text(dto.label, 200),
        status_key: 'pending' === String(dto.status_key || '') ? 'pending' : 'approved',
        status_label: normalize_text(dto.status_label, 160),
        start_label: normalize_text(dto.start_label, 160),
        end_label: normalize_text(dto.end_label, 160),
        date_label: normalize_text(dto.date_label, 160),
        duration_label: normalize_text(dto.duration_label, 160),
        is_clipped_start: Boolean(dto.is_clipped_start),
        is_clipped_end: Boolean(dto.is_clipped_end),
        continues_before_label: normalize_text(dto.continues_before_label, 160),
        continues_after_label: normalize_text(dto.continues_after_label, 160),
        open_details_label: normalize_text(i18n.open_details, 160),
        resource: normalize_resource_summary(resource_summary, resource_id)
      };
    }

    /**
     * Reduce one already-authorized Timeline Resource list DTO for the summary.
     *
     * The Resource must match the segment's authorized Resource identity. Exact
     * booking allocations and saved financial values remain lazy-only data.
     *
     * @param {Object} resource_summary Authorized host Resource list DTO.
     * @param {number} resource_id      Expected segment Resource ID.
     * @return {Object} Bounded presentation-only Resource summary.
     */
    function normalize_resource_summary(resource_summary, resource_id) {
      var candidate_id = Math.max(0, Math.round(Number(resource_summary && resource_summary.id) || 0));
      if (!resource_id || candidate_id !== resource_id) {
        return {
          resource_id: 0,
          title: '',
          subtitle: '',
          picture_url: ''
        };
      }
      return {
        resource_id: candidate_id,
        title: normalize_text(resource_summary.title, 240),
        subtitle: normalize_text(resource_summary.subtitle, 160),
        picture_url: normalize_url(resource_summary.image_url)
      };
    }

    /**
     * Normalize the complete lazy response through an exact browser allow list.
     *
     * @param {Object} dto Server-authorized complete overview DTO.
     * @return {Object|null} Template-safe details, or null.
     */
    function normalize_details_dto(dto) {
      var booking_id = Math.max(0, Math.round(Number(dto && dto.booking_id) || 0));
      var status = dto && dto.status && 'object' === typeof dto.status ? dto.status : {};
      var resource = dto && dto.resource && 'object' === typeof dto.resource ? dto.resource : {};
      var pricing = resource.pricing && 'object' === typeof resource.pricing ? resource.pricing : {};
      var costs = dto && dto.costs && 'object' === typeof dto.costs ? dto.costs : {};
      var payment = costs.payment && 'object' === typeof costs.payment ? costs.payment : {};
      var truncation = dto && dto.truncation && 'object' === typeof dto.truncation ? dto.truncation : {};
      if (!dto || 1 !== Number(dto.schema_version) || !booking_id) {
        return null;
      }
      return {
        schema_version: 1,
        booking_id: booking_id,
        heading: normalize_text(dto.heading, 160),
        title: normalize_text(dto.title, 240),
        status: {
          key: -1 !== ['approved', 'pending'].indexOf(String(status.key || '')) ? String(status.key) : 'unknown',
          label: normalize_text(status.label, 160)
        },
        resource: {
          resource_id: Math.max(0, Math.round(Number(resource.resource_id) || 0)),
          title: normalize_text(resource.title, 240),
          description: normalize_text(resource.description, 1000),
          picture_url: normalize_url(resource.picture_url),
          allocation_count: Math.max(0, Math.round(Number(resource.allocation_count) || 0)),
          pricing: {
            supported: Boolean(pricing.supported),
            formatted_cost: normalize_text(pricing.formatted_cost, 160),
            period_label: normalize_text(pricing.period_label, 80)
          }
        },
        intervals: normalize_record_list(dto.intervals, 200, normalize_interval),
        selected_dates: normalize_record_list(dto.selected_dates, 366, normalize_selected_date),
        duration_metrics: normalize_text_list(dto.duration_metrics, 10, 200),
        fields: normalize_record_list(dto.fields, 100, normalize_field),
        costs: {
          supported: Boolean(costs.supported),
          has_saved_cost: Boolean(costs.has_saved_cost),
          saved_cost_formatted: normalize_text(costs.saved_cost_formatted, 160),
          payment: {
            state: -1 !== ['paid', 'not_paid', 'unknown'].indexOf(String(payment.state || '')) ? String(payment.state) : 'unknown',
            label: normalize_text(payment.label, 160)
          }
        },
        created_label: normalize_text(dto.created_label, 200),
        truncation: {
          intervals: Boolean(truncation.intervals),
          selected_dates: Boolean(truncation.selected_dates),
          fields: Boolean(truncation.fields)
        },
        is_truncated: Boolean(truncation.intervals || truncation.selected_dates || truncation.fields),
        open_details_label: normalize_text(i18n.open_details, 160),
        i18n: {
          resource: normalize_text(i18n.resource, 160),
          intervals: normalize_text(i18n.intervals, 160),
          selected_dates: normalize_text(i18n.selected_dates, 160),
          booking_data: normalize_text(i18n.booking_data, 160),
          saved_cost: normalize_text(i18n.saved_cost, 160),
          payment_status: normalize_text(i18n.payment_status, 160),
          created: normalize_text(i18n.created, 160),
          not_available: normalize_text(i18n.not_available, 160),
          empty_fields: normalize_text(i18n.empty_fields, 240),
          unsupported_financials: normalize_text(i18n.unsupported_financials, 240),
          truncated: normalize_text(i18n.truncated, 320)
        }
      };
    }

    /**
     * Normalize one canonical interval at the browser trust boundary.
     *
     * @param {Object} interval Candidate interval.
     * @return {Object} One normalized interval.
     */
    function normalize_interval(interval) {
      return {
        start_at: normalize_text(interval.start_at, 80),
        end_at: normalize_text(interval.end_at, 80),
        start_label: normalize_text(interval.start_label, 200),
        end_label: normalize_text(interval.end_label, 200),
        duration_label: normalize_text(interval.duration_label, 160),
        is_full_day: Boolean(interval.is_full_day),
        is_overnight: Boolean(interval.is_overnight)
      };
    }

    /**
     * Normalize one individual selected-date projection.
     *
     * @param {Object} selected_date Candidate selected date.
     * @return {Object} One normalized selected date.
     */
    function normalize_selected_date(selected_date) {
      return {
        date: normalize_text(selected_date.date, 20),
        date_label: normalize_text(selected_date.date_label, 160),
        time_label: normalize_text(selected_date.time_label, 160),
        boundary: normalize_text(selected_date.boundary, 20)
      };
    }

    /**
     * Normalize one authorized form-field display row.
     *
     * @param {Object} field Candidate form-field row.
     * @return {Object} One normalized form-field display row.
     */
    function normalize_field(field) {
      return {
        label: normalize_text(field.label, 200),
        value: normalize_text(field.value, 2000)
      };
    }

    /**
     * Normalize a bounded list of plain records.
     *
     * @param {*}        records       Candidate records.
     * @param {number}   maximum_items Maximum records.
     * @param {Function} mapper        Record mapper.
     * @return {Array} Normalized records.
     */
    function normalize_record_list(records, maximum_items, mapper) {
      return (Array.isArray(records) ? records : []).slice(0, maximum_items).filter(function (record) {
        return record && 'object' === typeof record && !Array.isArray(record);
      }).map(mapper);
    }

    /**
     * Normalize a bounded list of scalar text values.
     *
     * @param {*}      values         Candidate values.
     * @param {number} maximum_items  Maximum returned values.
     * @param {number} maximum_length Maximum characters per value.
     * @return {Array} Bounded scalar text values.
     */
    function normalize_text_list(values, maximum_items, maximum_length) {
      return (Array.isArray(values) ? values : []).slice(0, maximum_items).map(function (value) {
        return normalize_text(value, maximum_length);
      }).filter(Boolean);
    }

    /**
     * Keep only HTTP(S) or protocol-relative image URLs.
     *
     * @param {*} candidate Candidate URL.
     * @return {string} HTTP(S) image URL or an empty string.
     */
    function normalize_url(candidate) {
      candidate = normalize_text(candidate, 2000);
      return /^(https?:)?\/\//i.test(candidate) ? candidate : '';
    }

    /**
     * Convert one scalar to bounded plain text.
     *
     * @param {*}      candidate  Candidate scalar.
     * @param {number} max_length Maximum character count.
     * @return {string} Bounded plain text.
     */
    function normalize_text(candidate, max_length) {
      if (null === candidate || 'undefined' === typeof candidate || 'string' !== typeof candidate && 'number' !== typeof candidate) {
        return '';
      }
      return String(candidate).slice(0, max_length);
    }

    /**
     * Return the authoritative booking ID associated with a registered trigger.
     *
     * @param {HTMLElement} trigger Registered booking trigger.
     * @return {number} Positive booking ID, or zero.
     */
    function get_trigger_booking_id(trigger) {
      var dto = trigger ? trigger_dtos.get(trigger) : null;
      return dto ? Math.max(0, Math.round(Number(dto.booking_id) || 0)) : 0;
    }

    /**
     * Determine whether an asynchronous result still owns the visible surface.
     *
     * @param {HTMLElement} trigger    Trigger captured at request time.
     * @param {number}      generation Adapter generation captured at request time.
     * @param {Object}      owner_context Stable owner and rebind generation.
     * @return {boolean} True when the response may replace current content.
     */
    function is_current_request(trigger, generation, owner_context) {
      var current_context = get_trigger_context(trigger);
      return generation === active_generation && trigger === active_trigger && trigger.isConnected && root.contains(trigger) && shared_controller.is_open() && owner_context.booking_id === popover_state.owner.booking_id && owner_context.render_generation === popover_state.owner.render_generation && owner_context.segment_hint === popover_state.owner.segment_hint && owner_context.booking_id === current_context.booking_id && owner_context.render_generation === current_context.render_generation && owner_context.segment_hint === current_context.segment_hint;
    }

    /**
     * Return the current stable booking-owned view for one booking identity.
     *
     * @param {number} booking_id Expected canonical booking ID.
     * @return {HTMLElement|null} Current domain view, or null.
     */
    function get_booking_view(booking_id) {
      var view = popover_surface.querySelector('[data-wpbc-booking-overview-view]');
      return view && Number(view.getAttribute('data-wpbc-booking-id')) === booking_id ? view : null;
    }

    /**
     * Build common translated labels for booking-owned partial templates.
     *
     * @return {Object} Bounded presentation labels.
     */
    function get_template_i18n() {
      return {
        resource: normalize_text(i18n.resource, 160),
        start: normalize_text(i18n.start, 160),
        end: normalize_text(i18n.end, 160),
        duration: normalize_text(i18n.duration, 160),
        intervals: normalize_text(i18n.intervals, 160),
        booking_data: normalize_text(i18n.booking_data, 160),
        selected_dates: normalize_text(i18n.selected_dates, 160),
        saved_cost: normalize_text(i18n.saved_cost, 160),
        payment_status: normalize_text(i18n.payment_status, 160),
        created: normalize_text(i18n.created, 160),
        not_available: normalize_text(i18n.not_available, 160),
        empty_fields: normalize_text(i18n.empty_fields, 240),
        unsupported_financials: normalize_text(i18n.unsupported_financials, 240),
        truncated: normalize_text(i18n.truncated, 320)
      };
    }

    /**
     * Build the left summary from the authorized card schedule, then enrich it
     * with the canonical lazy Resource, interval, and selected dates.
     *
     * @param {Object}      compact_dto Authorized compact booking projection.
     * @param {Object|null} details    Optional authorized lazy projection.
     * @return {Object} Template-ready summary model.
     */
    function build_summary_model(compact_dto, details) {
      var first_interval = details && details.intervals.length ? details.intervals[0] : null;
      var resource = compact_dto.resource;
      var resource_pricing;
      if (details && details.resource.resource_id) {
        resource_pricing = details.resource.pricing;
        resource = {
          resource_id: details.resource.resource_id,
          title: details.resource.title,
          subtitle: resource_pricing.supported && resource_pricing.formatted_cost ? resource_pricing.formatted_cost + (resource_pricing.period_label ? ' / ' + resource_pricing.period_label : '') : compact_dto.resource.subtitle,
          picture_url: details.resource.picture_url || compact_dto.resource.picture_url
        };
      }
      return {
        resource: resource,
        start_label: first_interval ? first_interval.start_label : compact_dto.start_label,
        end_label: first_interval ? first_interval.end_label : compact_dto.end_label,
        duration_label: first_interval ? first_interval.duration_label : compact_dto.duration_label,
        interval_count: details ? details.intervals.length : 0,
        additional_intervals: details && 1 < details.intervals.length ? details.intervals.slice(1) : [],
        selected_dates: details ? details.selected_dates : [],
        i18n: get_template_i18n()
      };
    }

    /**
     * Render the stable booking-owned view once for the current owner.
     *
     * @param {Object} compact_dto Authorized compact booking projection.
     * @return {void}
     */
    function render_booking_view(compact_dto) {
      shared_controller.set_header(header_template({
        heading: compact_dto.heading,
        label: compact_dto.label,
        status_key: compact_dto.status_key,
        status_label: compact_dto.status_label
      }), compact_dto.heading);
      shared_controller.set_content(template({
        booking_id: compact_dto.booking_id,
        summary_html: summary_template(build_summary_model(compact_dto, null)),
        details_html: loading_template({
          message: normalize_text(i18n.loading, 240)
        }),
        open_details_label: compact_dto.open_details_label
      }), '');
      shared_controller.set_busy(true, normalize_text(i18n.loading, 240));
    }

    /**
     * Replace one booking-owned partial while preserving focus in its host.
     *
     * @param {HTMLElement} host            Stable partial host.
     * @param {string}      rendered_markup Fixed-template markup.
     * @return {void}
     */
    function replace_partial(host, rendered_markup) {
      if (!host) {
        return;
      }
      if (host.contains(document.activeElement)) {
        host.focus();
      }
      host.innerHTML = String(rendered_markup || '');
    }

    /**
     * Render complete details and ask Popper to measure the changed surface.
     *
     * @param {Object}      details    Normalized complete details.
     * @param {HTMLElement} trigger    Owning trigger.
     * @param {number}      generation Owning adapter generation.
     * @return {void}
     */
    function render_details(details, trigger, generation, owner_context) {
      var compact_dto;
      var view;
      var summary_host;
      var details_host;
      if (!is_current_request(trigger, generation, owner_context)) {
        return;
      }
      compact_dto = trigger_dtos.get(trigger);
      view = get_booking_view(details.booking_id);
      if (!compact_dto || !view) {
        return;
      }
      summary_host = view.querySelector('[data-wpbc-booking-overview-summary-host]');
      details_host = view.querySelector('[data-wpbc-booking-overview-details-host]');
      replace_partial(summary_host, summary_template(build_summary_model(compact_dto, details)));
      replace_partial(details_host, details_template(details));
      if (details_host) {
        details_host.setAttribute('aria-busy', 'false');
      }
      set_popover_axis('details', 'ready');
      shared_controller.set_busy(false, normalize_text(i18n.loaded, 240));
      window.requestAnimationFrame(function () {
        if (is_current_request(trigger, generation, owner_context)) {
          shared_controller.update_reference();
        }
      });
    }

    /**
     * Render a recoverable right-column error without replacing known summary,
     * shell controls, or the Open booking details action.
     *
     * @param {HTMLElement} trigger       Current booking owner.
     * @param {number}      generation    Current request generation.
     * @param {Object}      owner_context Stable owner and rebind generation.
     * @return {void}
     */
    function render_details_error(trigger, generation, owner_context) {
      var view;
      var details_host;
      if (!is_current_request(trigger, generation, owner_context)) {
        return;
      }
      view = get_booking_view(owner_context.booking_id);
      details_host = view ? view.querySelector('[data-wpbc-booking-overview-details-host]') : null;
      replace_partial(details_host, error_template({
        message: normalize_text(i18n.error, 500),
        retry_label: normalize_text(i18n.retry, 160)
      }));
      if (details_host) {
        details_host.setAttribute('aria-busy', 'false');
      }
      set_popover_axis('details', 'error');
      shared_controller.set_busy(false, normalize_text(i18n.error, 500));
      shared_controller.update_reference();
    }

    /**
     * Render the booking-owned right-column loading state in place.
     *
     * @param {HTMLElement} trigger Current booking owner.
     * @return {void}
     */
    function render_details_loading(trigger) {
      var booking_id = get_trigger_booking_id(trigger);
      var view = get_booking_view(booking_id);
      var details_host = view ? view.querySelector('[data-wpbc-booking-overview-details-host]') : null;
      replace_partial(details_host, loading_template({
        message: normalize_text(i18n.loading, 240)
      }));
      if (details_host) {
        details_host.setAttribute('aria-busy', 'true');
      }
      shared_controller.set_busy(true, normalize_text(i18n.loading, 240));
    }

    /**
     * Start or join one booking-details request and guard every UI update.
     *
     * @param {HTMLElement} trigger Active booking trigger.
     * @return {void}
     */
    function load_details(trigger) {
      var booking_id = get_trigger_booking_id(trigger);
      var cache_key = String(booking_id);
      var generation = active_generation + 1;
      var owner_context = get_trigger_context(trigger);
      var request_entry;
      var cached_details;
      active_generation = generation;
      set_popover_axis('details', 'loading');
      if (!booking_id || !transport.url || !transport.action || !transport.nonce || !transport.source) {
        render_details_error(trigger, generation, owner_context);
        return;
      }
      if (details_cache.has(cache_key)) {
        cached_details = details_cache.get(cache_key);
        details_cache.delete(cache_key);
        details_cache.set(cache_key, cached_details);
        render_details(cached_details, trigger, generation, owner_context);
        return;
      }
      render_details_loading(trigger);
      if (inflight_requests.has(cache_key)) {
        request_entry = inflight_requests.get(cache_key);
      } else {
        request_entry = {
          request: $.ajax({
            url: String(transport.url),
            method: 'POST',
            dataType: 'json',
            data: {
              action: String(transport.action),
              nonce: String(transport.nonce),
              source: String(transport.source),
              booking_id: booking_id
            }
          })
        };
        inflight_requests.set(cache_key, request_entry);
        request_entry.request.always(function () {
          if (inflight_requests.get(cache_key) === request_entry) {
            inflight_requests.delete(cache_key);
          }
        });
      }
      request_entry.request.done(function (response) {
        var details = normalize_details_dto(response && response.success && response.data ? response.data.overview : null);
        if (!details || details.booking_id !== booking_id) {
          render_details_error(trigger, generation, owner_context);
          return;
        }
        if (details_cache.has(cache_key)) {
          details_cache.delete(cache_key);
        }
        details_cache.set(cache_key, details);
        while (maximum_cache_entries < details_cache.size) {
          details_cache.delete(details_cache.keys().next().value);
        }
        render_details(details, trigger, generation, owner_context);
      });
      request_entry.request.fail(function (request, request_status) {
        if ('abort' === request_status) {
          return;
        }
        if (-1 !== [401, 403, 404].indexOf(Number(request && request.status))) {
          clear_details_state();
          shared_controller.request_close('authorization_invalidation', false);
          return;
        }
        render_details_error(trigger, generation, owner_context);
      });
    }

    /**
     * Abort and forget one cached or in-flight booking read.
     *
     * @param {number}  booking_id      Booking ID, or zero for no specific record.
     * @param {boolean} increment_state Whether active response generations become stale.
     * @return {void}
     */
    function invalidate_booking(booking_id, increment_state) {
      var cache_key = String(Math.max(0, Math.round(Number(booking_id) || 0)));
      var request_entry = inflight_requests.get(cache_key);
      if (increment_state) {
        active_generation += 1;
      }
      details_cache.delete(cache_key);
      if (request_entry && request_entry.request && 'function' === typeof request_entry.request.abort) {
        request_entry.request.abort();
      }
      inflight_requests.delete(cache_key);
    }

    /**
     * Abort all pending reads and clear the page-memory cache.
     *
     * @return {void}
     */
    function clear_details_state() {
      active_generation += 1;
      inflight_requests.forEach(function (request_entry) {
        if (request_entry.request && 'function' === typeof request_entry.request.abort) {
          request_entry.request.abort();
        }
      });
      inflight_requests.clear();
      details_cache.clear();
    }

    /**
     * Resolve only the dedicated registered information control.
     *
     * @param {EventTarget|null} event_target Event target.
     * @return {HTMLElement|null} Registered trigger, or null.
     */
    function get_trigger(event_target) {
      var element = event_target && 1 === event_target.nodeType ? event_target : null;
      var trigger;
      if (!element || element.closest('[data-wpbc-ui-catalog-overflow-tooltip]')) {
        return null;
      }
      trigger = element.closest('[data-wpbc-booking-overview-info-trigger]');
      return trigger && root.contains(trigger) && trigger_dtos.has(trigger) ? trigger : null;
    }

    /**
     * Verify that a dedicated trigger still belongs to its registered card.
     *
     * Narrow Timeline segments may move the same control node into a row-scoped
     * overlay after layout. In that state DOM containment is intentionally no
     * longer the identity boundary, so the domain-owned booking ID and stable
     * segment hint must match the separate card context exactly.
     *
     * @param {HTMLElement} trigger Dedicated information control.
     * @param {HTMLElement} card    Separate Timeline booking card.
     * @param {Object}      dto     Normalized compact booking DTO.
     * @return {boolean} True when containment or explicit identity proves ownership.
     */
    function trigger_belongs_to_card(trigger, card, dto) {
      var trigger_booking_id;
      var card_booking_id;
      var trigger_segment_hint;
      var card_segment_hint;
      if (card.contains(trigger)) {
        return true;
      }
      trigger_booking_id = Math.max(0, Math.round(Number(trigger.getAttribute('data-wpbc-timeline-booking-id')) || 0));
      card_booking_id = Math.max(0, Math.round(Number(card.getAttribute('data-wpbc-timeline-booking-id')) || 0));
      trigger_segment_hint = String(trigger.getAttribute('data-wpbc-timeline-segment-hint') || '');
      card_segment_hint = String(card.getAttribute('data-wpbc-timeline-segment-id') || '');
      return Boolean(trigger_booking_id && trigger_booking_id === card_booking_id && trigger_booking_id === Number(dto.booking_id) && trigger_segment_hint && trigger_segment_hint === card_segment_hint);
    }

    /**
     * Determine whether an accessible modal layer is visibly rendered.
     *
     * @return {boolean} True when at least one modal layer is visible.
     */
    function has_visible_modal_layer() {
      return Array.prototype.some.call(document.querySelectorAll('[aria-modal="true"]'), function (modal_layer) {
        if (modal_layer.hidden || modal_layer.closest('[hidden]') || modal_layer.closest('[aria-hidden="true"]')) {
          return false;
        }
        return 0 < modal_layer.getClientRects().length;
      });
    }

    /**
     * Determine whether Timeline state blocks a Booking Overview activation.
     *
     * @return {boolean} True while another layer or gesture owns attention.
     */
    function is_suppressed() {
      if (is_scrolling) {
        return true;
      }
      if ('function' === typeof callbacks.is_suppressed && callbacks.is_suppressed()) {
        return true;
      }
      return has_visible_modal_layer();
    }

    /**
     * Render the fixed booking-domain template into the shared shell.
     *
     * @param {HTMLElement} trigger Registered booking trigger.
     * @return {boolean} True when authorized compact content was prepared.
     */
    function prepare_content(trigger) {
      var dto = trigger ? trigger_dtos.get(trigger) : null;
      if (!dto || !trigger.isConnected || !root.contains(trigger)) {
        return false;
      }
      if (active_trigger && active_trigger !== trigger) {
        if (shared_controller.is_pinned()) {
          return false;
        }
        shared_controller.request_close('programmatic', false);
      }
      render_booking_view(dto);
      return true;
    }

    /**
     * Hand one registered booking card to the existing Inspector adapter.
     *
     * This is the sole booking-domain handoff used by the explicit popover action.
     * It closes the current overview without restoring focus and never changes
     * booking data.
     *
     * @param {HTMLElement} trigger Registered booking information control.
     * @param {Event|null}  event   Optional activating browser event.
     * @return {boolean} True when a current registered card was handed off.
     */
    function handoff_to_booking_inspector(trigger, event) {
      var card = trigger ? trigger_cards.get(trigger) : null;
      if (!trigger || !card || !trigger.isConnected || !card.isConnected || !root.contains(trigger) || !root.contains(card) || 'function' !== typeof callbacks.open_booking_details) {
        return false;
      }
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      shared_controller.request_close('inspector_handoff', false);
      if ('function' === typeof callbacks.open_booking_details) {
        callbacks.open_booking_details(card);
      }
      return true;
    }

    /**
     * Toggle Booking Overview from a native information-control activation.
     *
     * @param {MouseEvent} event Delegated click event.
     * @return {boolean} True when the registered overview opened or closed.
     */
    function handle_trigger_click(event) {
      var trigger = get_trigger(event.target);
      if (!trigger || is_suppressed()) {
        return false;
      }
      if (active_trigger === trigger && (shared_controller.is_open() || shared_controller.is_pinned())) {
        if (event) {
          event.preventDefault();
        }
        return shared_controller.request_close('explicit_close', false);
      }
      if (!prepare_content(trigger)) {
        return false;
      }
      if (event) {
        event.preventDefault();
      }
      return shared_controller.open(trigger);
    }

    /**
     * Suppress new activation while shared scroll policy resolves the owner.
     *
     * Both transient and pinned overviews retain their current canonical owner.
     * The coalesced geometry path follows a visible information control and
     * clamps an off-screen control to the nearest Timeline edge.
     *
     * @return {void}
     */
    function handle_scroll() {
      is_scrolling = true;
      shared_controller.cancel_pending_open();
      schedule_live_geometry_update();
      window.clearTimeout(scroll_timer);
      scroll_timer = window.setTimeout(function () {
        is_scrolling = false;
        scroll_timer = 0;
      }, scroll_resume_delay_ms);
    }

    /**
     * Recalculate current owner geometry after non-scroll layout changes.
     *
     * @return {void}
     */
    function handle_geometry_change() {
      schedule_live_geometry_update();
    }

    /**
     * Recalculate after an image changes a rendered booking row's geometry.
     *
     * @param {Event} event Captured Resource or booking image load event.
     * @return {void}
     */
    function handle_geometry_image_load(event) {
      if (event.target && 'IMG' === event.target.nodeName) {
        schedule_live_geometry_update();
      }
    }

    /**
     * Select and rebind the retained canonical booking after a complete render.
     *
     * The same visible segment hint wins. Otherwise another visible authorized
     * segment wins, followed by a connected off-screen segment that can retain
     * identity through a live reference while the canvas clips its surface.
     *
     * @return {void}
     */
    function complete_refresh_rebind() {
      var owner_booking_id = popover_state.owner.booking_id;
      var owner_segment_hint = popover_state.owner.segment_hint;
      var authorized_candidates;
      var visible_candidates;
      var selected_candidate = null;
      if (!refresh_rebind_pending) {
        return;
      }
      refresh_rebind_pending = false;
      if (!shared_controller.is_pinned() || !owner_booking_id) {
        rebind_candidates = [];
        return;
      }
      authorized_candidates = rebind_candidates.filter(function (candidate) {
        return candidate.context.booking_id === owner_booking_id && candidate.trigger.isConnected && root.contains(candidate.trigger);
      });
      visible_candidates = authorized_candidates.filter(function (candidate) {
        return 'live_control' === get_trigger_reference_state(candidate.trigger);
      });
      selected_candidate = visible_candidates.filter(function (candidate) {
        return candidate.context.segment_hint === owner_segment_hint;
      })[0] || visible_candidates[0] || authorized_candidates.filter(function (candidate) {
        return candidate.context.segment_hint === owner_segment_hint;
      })[0] || authorized_candidates[0] || null;
      rebind_candidates = [];
      if (!selected_candidate) {
        shared_controller.request_close('authorization_invalidation', false);
        return;
      }
      if (!shared_controller.rebind_trigger(selected_candidate.trigger)) {
        shared_controller.request_close('authorization_invalidation', false);
        return;
      }
      active_trigger = selected_candidate.trigger;
      popover_state.owner = selected_candidate.context;
      set_popover_axis('reference', get_trigger_reference_state(active_trigger));
      set_popover_axis('details', 'idle');
      render_booking_view(selected_candidate.dto);
      observe_active_geometry();
      if ('temporarily_missing' !== popover_state.reference && !blocking_suspension && shared_controller.is_suspended() && 'reference_refresh' === shared_controller.get_suspension_reason()) {
        shared_controller.resume();
        return;
      }
      schedule_live_geometry_update();
    }

    /**
     * Open the authoritative Booking Inspector from the popover action.
     *
     * @param {MouseEvent} event Popover click event.
     * @return {void}
     */
    function handle_popover_click(event) {
      var retry_button = event.target.closest('[data-wpbc-booking-overview-retry]');
      var open_button = event.target.closest('[data-wpbc-booking-overview-open-details]');
      var trigger = active_trigger;
      if (retry_button) {
        event.preventDefault();
        event.stopPropagation();
        handle_retry();
        return;
      }
      if (!open_button) {
        return;
      }
      handoff_to_booking_inspector(trigger, event);
    }

    /**
     * Forward pinned horizontal input to the Timeline canvas scroll owner.
     *
     * Unpinned surfaces remain canvas descendants and therefore use native
     * event bubbling. A pinned root lives under the document body, so only its
     * horizontal gesture needs the domain callback; vertical input retains the
     * native detail-body and WordPress document scroll chain.
     *
     * @param {WheelEvent} event Browser wheel event over the popover surface.
     * @return {void}
     */
    function handle_popover_wheel(event) {
      if (!shared_controller.is_pinned() || 'function' !== typeof callbacks.scroll_timeline) {
        return;
      }
      if (callbacks.scroll_timeline(event)) {
        event.preventDefault();
      }
    }
    root.addEventListener('load', handle_geometry_image_load, true);
    popover_surface.addEventListener('click', handle_popover_click);
    popover_surface.addEventListener('wheel', handle_popover_wheel, {
      passive: false
    });
    root.addEventListener('scroll', handle_scroll, true);
    window.addEventListener('scroll', handle_scroll, {
      passive: true
    });
    window.addEventListener('resize', handle_geometry_change, {
      passive: true
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handle_geometry_change, {
        passive: true
      });
      window.visualViewport.addEventListener('scroll', handle_scroll, {
        passive: true
      });
    }
    return {
      /**
       * Toggle this booking instance from its native information-control click.
       *
       * @param {HTMLElement} trigger Registered booking information control.
       * @param {MouseEvent}  event   Native click event.
       * @return {boolean} True when the popover opened or closed.
       */
      open_trigger: function (trigger, event) {
        return handle_trigger_click({
          target: trigger,
          preventDefault: function () {
            if (event && 'function' === typeof event.preventDefault) {
              event.preventDefault();
            }
          }
        });
      },
      /**
       * Move keyboard focus into an already open booking surface.
       *
       * This never opens a closed surface; click remains the only activation.
       *
       * @param {HTMLElement} trigger Registered booking information control.
       * @param {KeyboardEvent} event Focus-entry command.
       * @return {boolean} True when the command was handled.
       */
      focus_surface: function (trigger, event) {
        if (!shared_controller.is_open()) {
          return false;
        }
        return shared_controller.handle_trigger_keydown(trigger, event);
      },
      /**
       * Associate one information control and card with its overview projection.
       *
       * @param {HTMLElement} trigger Dedicated native information control.
       * @param {HTMLElement} card    Separate Timeline card/Inspector identity.
       * @param {Object}      dto              Authorized compact card projection.
       * @param {Object}      resource_summary Authorized Timeline Resource list summary.
       * @return {void}
       */
      register: function (trigger, card, dto, resource_summary) {
        var normalized_dto = normalize_dto(dto, resource_summary);
        var trigger_context;
        if (trigger && card && normalized_dto && root.contains(trigger) && root.contains(card) && trigger_belongs_to_card(trigger, card, normalized_dto) && shared_controller.can_use_trigger(trigger)) {
          trigger_dtos.set(trigger, normalized_dto);
          trigger_cards.set(trigger, card);
          trigger_context = {
            booking_id: normalized_dto.booking_id,
            render_generation: render_generation,
            segment_hint: String(card.getAttribute('data-wpbc-timeline-segment-id') || '')
          };
          trigger_contexts.set(trigger, trigger_context);
          if (refresh_rebind_pending && shared_controller.is_pinned() && popover_state.owner.booking_id === trigger_context.booking_id) {
            rebind_candidates.push({
              trigger: trigger,
              context: trigger_context,
              dto: normalized_dto
            });
          }
        }
      },
      /**
       * Finalize retained-owner authorization after all cards are registered.
       *
       * @return {void}
       */
      complete_refresh: complete_refresh_rebind,
      /**
       * Invalidate registrations before Timeline replaces card nodes.
       *
       * @return {void}
       */
      refresh: function () {
        var retain_pin = shared_controller.is_pinned();
        render_generation += 1;
        stop_geometry_tracking();
        rebind_candidates = [];
        refresh_rebind_pending = retain_pin;
        if (active_trigger) {
          set_popover_axis('visibility', 'temporarily_suspended');
          set_popover_axis('reference', 'temporarily_missing');
        }
        if (retain_pin) {
          shared_controller.suspend('reference_refresh');
        } else {
          shared_controller.request_close('programmatic', false);
        }
        clear_details_state();
        trigger_dtos = new window.WeakMap();
        trigger_contexts = new window.WeakMap();
        trigger_cards = new window.WeakMap();
      },
      /**
       * Invalidate one booking immediately after a canonical mutation.
       *
       * @param {number} booking_id Mutated booking ID.
       * @return {void}
       */
      invalidate: function (booking_id) {
        booking_id = Math.max(0, Math.round(Number(booking_id) || 0));
        if (booking_id && booking_id === popover_state.owner.booking_id) {
          invalidate_booking(booking_id, true);
          set_popover_axis('details', 'idle');
          if (shared_controller.is_pinned()) {
            set_popover_axis('visibility', 'temporarily_suspended');
            shared_controller.suspend('reference_refresh');
            return;
          }
          shared_controller.request_close('authorization_invalidation', false);
          return;
        }
        invalidate_booking(booking_id, true);
      },
      /**
       * Close this domain's popover without restoring focus.
       *
       * @return {void}
       */
      suspend: function () {
        blocking_suspension = true;
        if (shared_controller.is_pinned()) {
          shared_controller.suspend('blocking_layer');
          return;
        }
        shared_controller.request_close('programmatic', false);
      },
      /**
       * Resume a retained pin after Timeline blocking state is removed.
       *
       * Missing replacement authorization closes the retained identity instead
       * of displaying stale content against a detached reference.
       *
       * @return {void}
       */
      resume: function () {
        blocking_suspension = false;
        if (!shared_controller.is_pinned() || !shared_controller.is_suspended()) {
          return;
        }
        if (!active_trigger || !active_trigger.isConnected || !root.contains(active_trigger) || !trigger_dtos.has(active_trigger) || !trigger_cards.has(active_trigger)) {
          shared_controller.request_close('authorization_invalidation', false);
          return;
        }
        if ('temporarily_missing' === get_trigger_reference_state(active_trigger)) {
          set_popover_axis('reference', get_trigger_reference_state(active_trigger));
          schedule_live_geometry_update();
          return;
        }
        if (shared_controller.resume()) {
          set_popover_axis('visibility', 'pinned');
          set_popover_axis('reference', get_trigger_reference_state(active_trigger));
        }
      },
      /**
       * Report whether the shared controller currently displays this overview.
       *
       * @return {boolean} True when the popover is visible.
       */
      is_open: function () {
        return shared_controller.is_open();
      },
      /**
       * Notify the adapter after Timeline-owned layout changes settle.
       *
       * @return {void}
       */
      update_geometry: schedule_live_geometry_update,
      /**
       * Return the current independent popover state axes.
       *
       * @return {Object} Executable-free page-memory state snapshot.
       */
      get_state: get_popover_state,
      /**
       * Remove domain listeners and destroy only this shared controller instance.
       *
       * @return {void}
       */
      destroy: function () {
        window.clearTimeout(scroll_timer);
        stop_geometry_tracking();
        clear_details_state();
        root.removeEventListener('load', handle_geometry_image_load, true);
        popover_surface.removeEventListener('click', handle_popover_click);
        popover_surface.removeEventListener('wheel', handle_popover_wheel);
        root.removeEventListener('scroll', handle_scroll, true);
        window.removeEventListener('scroll', handle_scroll);
        window.removeEventListener('resize', handle_geometry_change);
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', handle_geometry_change);
          window.visualViewport.removeEventListener('scroll', handle_scroll);
        }
        shared_controller.destroy();
        geometry_resize_observer = null;
        rebind_candidates = [];
        trigger_dtos = new window.WeakMap();
        trigger_contexts = new window.WeakMap();
        trigger_cards = new window.WeakMap();
        active_trigger = null;
        popover_state = create_empty_popover_state();
      }
    };
  }

  /**
   * Create a Timeline-scoped manager that lazily owns one popover per booking.
   *
   * A controller is allocated only after its information button is clicked.
   * Separate booking controllers can therefore remain visible together without
   * creating document listeners for every rendered card up front.
   *
   * @param {HTMLElement} root          Timeline root containing booking triggers.
   * @param {Object}      configuration Executable-free server configuration.
   * @param {Object}      callbacks     Timeline suppression and Inspector hooks.
   * @return {Object|null} Multi-booking adapter API, or null when unavailable.
   */
  function create_controller(root, configuration, callbacks) {
    configuration = configuration || {};
    callbacks = callbacks || {};
    if (!root || !configuration.active || !window.wpbc_shared_ui_context_popover || 'function' !== typeof window.wpbc_shared_ui_context_popover.create) {
      return null;
    }
    var base_component_id = String(configuration.component_id || '').replace(/[^A-Za-z0-9_-]/g, '');
    var booking_controllers = new window.Map();
    var booking_registrations = new window.Map();
    var trigger_booking_ids = new window.WeakMap();

    /**
     * Return one positive booking identity.
     *
     * @param {*} candidate Candidate booking identity.
     * @return {number} Positive integer booking ID, or zero.
     */
    function normalize_booking_id(candidate) {
      return Math.max(0, Math.round(Number(candidate) || 0));
    }

    /**
     * Build an isolated configuration for one booking-owned surface.
     *
     * @param {number} booking_id Canonical booking identity.
     * @return {Object} Per-instance configuration.
     */
    function create_instance_configuration(booking_id) {
      var instance_configuration = {};
      var instance_id = base_component_id + '__booking_' + booking_id;
      Object.keys(configuration).forEach(function (configuration_key) {
        instance_configuration[configuration_key] = configuration[configuration_key];
      });
      instance_configuration.component_id = instance_id;
      instance_configuration.owner_id = instance_id;
      instance_configuration.interaction_group = instance_id;
      return instance_configuration;
    }

    /**
     * Register every current segment for a newly allocated booking controller.
     *
     * @param {number} booking_id Canonical booking identity.
     * @param {Object} controller Booking instance controller.
     * @return {void}
     */
    function register_current_segments(booking_id, controller) {
      var registrations = booking_registrations.get(booking_id) || [];
      registrations.forEach(function (registration) {
        controller.register(registration.trigger, registration.card, registration.dto, registration.resource_summary);
      });
    }

    /**
     * Resolve or lazily create one booking-owned popover controller.
     *
     * @param {number} booking_id Canonical booking identity.
     * @return {Object|null} Booking instance controller, or null.
     */
    function get_booking_controller(booking_id) {
      var controller = booking_controllers.get(booking_id) || null;
      if (controller) {
        return controller;
      }
      controller = create_instance_controller(root, create_instance_configuration(booking_id), callbacks);
      if (!controller) {
        return null;
      }
      booking_controllers.set(booking_id, controller);
      register_current_segments(booking_id, controller);
      return controller;
    }

    /**
     * Toggle only from a native click on a registered information button.
     *
     * Native button activation preserves Enter and Space keyboard access while
     * pointer hover and focus alone deliberately perform no opening action. A
     * second click on the same button closes only that booking's instance.
     *
     * @param {MouseEvent} event Delegated Timeline click.
     * @return {void}
     */
    function handle_trigger_click(event) {
      var element = event.target && 1 === event.target.nodeType ? event.target : null;
      var trigger = element ? element.closest('[data-wpbc-booking-overview-info-trigger]') : null;
      var booking_id;
      var controller;
      if (!trigger || !root.contains(trigger) || element.closest('[data-wpbc-ui-catalog-overflow-tooltip]')) {
        return;
      }
      booking_id = normalize_booking_id(trigger_booking_ids.get(trigger));
      controller = booking_id ? get_booking_controller(booking_id) : null;
      if (controller) {
        controller.open_trigger(trigger, event);
      }
    }

    /**
     * Move focus into an already clicked overview without opening on focus.
     *
     * @param {KeyboardEvent} event Delegated Timeline keydown.
     * @return {void}
     */
    function handle_trigger_keydown(event) {
      var element = event.target && 1 === event.target.nodeType ? event.target : null;
      var trigger = element ? element.closest('[data-wpbc-booking-overview-info-trigger]') : null;
      var booking_id = trigger ? normalize_booking_id(trigger_booking_ids.get(trigger)) : 0;
      var controller = booking_id ? booking_controllers.get(booking_id) : null;
      if (controller && controller.is_open()) {
        controller.focus_surface(trigger, event);
      }
    }
    root.addEventListener('click', handle_trigger_click);
    root.addEventListener('keydown', handle_trigger_keydown, true);
    return {
      /**
       * Register one currently rendered booking segment.
       *
       * @param {HTMLElement} trigger          Information button.
       * @param {HTMLElement} card             Timeline booking card.
       * @param {Object}      dto              Authorized compact DTO.
       * @param {Object}      resource_summary Authorized Resource summary.
       * @return {void}
       */
      register: function (trigger, card, dto, resource_summary) {
        var booking_id = normalize_booking_id(dto && dto.booking_id);
        var registrations;
        var controller;
        if (!booking_id || !trigger || !card || !root.contains(trigger) || !root.contains(card)) {
          return;
        }
        registrations = booking_registrations.get(booking_id) || [];
        registrations.push({
          trigger: trigger,
          card: card,
          dto: dto,
          resource_summary: resource_summary || {}
        });
        booking_registrations.set(booking_id, registrations);
        trigger_booking_ids.set(trigger, booking_id);
        controller = booking_controllers.get(booking_id);
        if (controller) {
          controller.register(trigger, card, dto, resource_summary || {});
        }
      },
      /**
       * Prepare every allocated controller for a Timeline rerender.
       *
       * @return {void}
       */
      refresh: function () {
        booking_controllers.forEach(function (controller) {
          controller.refresh();
        });
        booking_registrations.clear();
        trigger_booking_ids = new window.WeakMap();
      },
      /**
       * Complete authorization-aware trigger rebinding after a rerender.
       *
       * @return {void}
       */
      complete_refresh: function () {
        booking_controllers.forEach(function (controller) {
          controller.complete_refresh();
        });
      },
      /**
       * Invalidate cached data for one booking controller.
       *
       * @param {number} booking_id Canonical booking identity.
       * @return {void}
       */
      invalidate: function (booking_id) {
        var controller = booking_controllers.get(normalize_booking_id(booking_id));
        if (controller) {
          controller.invalidate(booking_id);
        }
      },
      /**
       * Suspend every allocated booking surface during blocking Timeline work.
       *
       * @return {void}
       */
      suspend: function () {
        booking_controllers.forEach(function (controller) {
          controller.suspend();
        });
      },
      /**
       * Resume every safely retained booking surface.
       *
       * @return {void}
       */
      resume: function () {
        booking_controllers.forEach(function (controller) {
          controller.resume();
        });
      },
      /**
       * Recalculate every visible booking surface after Timeline geometry changes.
       *
       * @return {void}
       */
      update_geometry: function () {
        booking_controllers.forEach(function (controller) {
          controller.update_geometry();
        });
      },
      /**
       * Report whether at least one booking surface is open.
       *
       * @return {boolean} True when at least one booking surface is open.
       */
      is_open: function () {
        var is_open = false;
        booking_controllers.forEach(function (controller) {
          is_open = is_open || controller.is_open();
        });
        return is_open;
      },
      /**
       * Destroy every booking surface and manager-owned listener.
       *
       * @return {void}
       */
      destroy: function () {
        root.removeEventListener('click', handle_trigger_click);
        root.removeEventListener('keydown', handle_trigger_keydown, true);
        booking_controllers.forEach(function (controller) {
          controller.destroy();
        });
        booking_controllers.clear();
        booking_registrations.clear();
        trigger_booking_ids = new window.WeakMap();
      }
    };
  }
  window.wpbc_booking_overview_tooltip.create_controller = create_controller;
})(window, document, window.wp, window.jQuery);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvYm9va2luZy1vdmVydmlldy10b29sdGlwL19vdXQvYm9va2luZy1vdmVydmlldy10b29sdGlwLmpzIiwibmFtZXMiOlsid2luZG93IiwiZG9jdW1lbnQiLCJ3cCIsIiQiLCJ3cGJjX2Jvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcCIsImNyZWF0ZV9pbnN0YW5jZV9jb250cm9sbGVyIiwicm9vdCIsImNvbmZpZ3VyYXRpb24iLCJjYWxsYmFja3MiLCJhY3RpdmUiLCJ0ZW1wbGF0ZSIsIndwYmNfc2hhcmVkX3VpX2NvbnRleHRfcG9wb3ZlciIsImNyZWF0ZSIsIlN0cmluZyIsInRlbXBsYXRlX2lkIiwiaGVhZGVyX3RlbXBsYXRlIiwiaGVhZGVyX3RlbXBsYXRlX2lkIiwiZGV0YWlsc190ZW1wbGF0ZSIsImRldGFpbHNfdGVtcGxhdGVfaWQiLCJzdW1tYXJ5X3RlbXBsYXRlIiwic3VtbWFyeV90ZW1wbGF0ZV9pZCIsImxvYWRpbmdfdGVtcGxhdGUiLCJsb2FkaW5nX3RlbXBsYXRlX2lkIiwiZXJyb3JfdGVtcGxhdGUiLCJlcnJvcl90ZW1wbGF0ZV9pZCIsImkxOG4iLCJ0cmFuc3BvcnQiLCJzY3JvbGxfcmVzdW1lX2RlbGF5X21zIiwibm9ybWFsaXplX2RlbGF5IiwicG9zaXRpb25pbmdfYm91bmRhcnkiLCJxdWVyeVNlbGVjdG9yIiwicG9ydGFsX2hvc3QiLCJ0cmlnZ2VyX2R0b3MiLCJXZWFrTWFwIiwidHJpZ2dlcl9jb250ZXh0cyIsInRyaWdnZXJfY2FyZHMiLCJhY3RpdmVfdHJpZ2dlciIsImFjdGl2ZV9nZW5lcmF0aW9uIiwicmVuZGVyX2dlbmVyYXRpb24iLCJkZXRhaWxzX2NhY2hlIiwiTWFwIiwiaW5mbGlnaHRfcmVxdWVzdHMiLCJtYXhpbXVtX2NhY2hlX2VudHJpZXMiLCJzY3JvbGxfdGltZXIiLCJnZW9tZXRyeV9mcmFtZSIsImdlb21ldHJ5X3Jlc2l6ZV9vYnNlcnZlciIsInJlYmluZF9jYW5kaWRhdGVzIiwicmVmcmVzaF9yZWJpbmRfcGVuZGluZyIsImJsb2NraW5nX3N1c3BlbnNpb24iLCJpc19zY3JvbGxpbmciLCJ2aXNpYmlsaXR5X3N0YXRlcyIsImRldGFpbHNfc3RhdGVzIiwicmVmZXJlbmNlX3N0YXRlcyIsInBvcG92ZXJfc3RhdGUiLCJjcmVhdGVfZW1wdHlfcG9wb3Zlcl9zdGF0ZSIsInNoYXJlZF9jb250cm9sbGVyIiwicG9wb3Zlcl9zdXJmYWNlIiwiaWQiLCJjb21wb25lbnRfaWQiLCJtb2RlIiwib3duZXJfaWQiLCJpbnRlcmFjdGlvbl9ncm91cCIsInBpbl9wb2xpY3kiLCJleHRlcm5hbF9zY3JvbGxfcG9saWN5IiwiZGlzbWlzc19wb2xpY3kiLCJleHRlcm5hbF9zY3JvbGxfZ3JhY2VfbXMiLCJwaW5fbGFiZWwiLCJub3JtYWxpemVfdGV4dCIsInBpbiIsInBpbm5lZF9sYWJlbCIsInBpbm5lZCIsInVucGluX2xhYmVsIiwidW5waW4iLCJkcmFnX2xhYmVsIiwibW92ZSIsInRpdGxlIiwiY2xvc2VfbGFiZWwiLCJjbG9zZSIsInNob3dfZGVsYXlfbXMiLCJoaWRlX2RlbGF5X21zIiwicG9pbnRlcl9hbmNob3IiLCJwbGFjZW1lbnQiLCJmYWxsYmFja19wbGFjZW1lbnRzIiwiYWxsb3dfZmxpcCIsImdldF9pbml0aWFsX3BsYWNlbWVudF9ib3VuZHMiLCJnZXRfdmlzaWJsZV90aW1lbGluZV9yZWN0YW5nbGUiLCJvd25zX3RyaWdnZXJfYXJpYSIsImFyaWFfaGFzcG9wdXAiLCJwcmVmZXJyZWRfd2lkdGgiLCJtYXhpbXVtX3dpZHRoIiwiZml4ZWRfdW5waW5uZWRfaGVpZ2h0IiwibWF4aW11bV9yZXNpemVkX3dpZHRoIiwicG9zaXRpb25pbmdfc3RyYXRlZ3kiLCJsYXllcl96X2luZGV4IiwicHJldmVudF9vdmVyZmxvdyIsImJvdW5kYXJ5X2Nyb3NzX2F4aXMiLCJib3VuZGFyeV90ZXRoZXIiLCJmaXRfb25fZmlyc3Rfb3BlbiIsInBpbl90b192aWV3cG9ydCIsImRyYWdnYWJsZV93aGVuX3Bpbm5lZCIsInJlc2l6YWJsZV93aGVuX3Bpbm5lZCIsInJlc2l6ZV9sYWJlbCIsInJlc2l6ZSIsInJlZmVyZW5jZV9wb2xpY3kiLCJnZXRfcmVmZXJlbmNlX3JlY3QiLCJnZXRfbGl2ZV9yZWZlcmVuY2VfcmVjdCIsImhpZGVfYXJyb3dfd2hlbl9waW5uZWQiLCJvbl9vcGVuIiwiaGFuZGxlX3NoYXJlZF9vcGVuIiwib25fY2xvc2UiLCJoYW5kbGVfc2hhcmVkX2Nsb3NlIiwib25fcGluX2NoYW5nZSIsImhhbmRsZV9zaGFyZWRfcGluX2NoYW5nZSIsIm9uX3N1c3BlbmQiLCJoYW5kbGVfc2hhcmVkX3N1c3BlbmQiLCJvbl9yZXN1bWUiLCJoYW5kbGVfc2hhcmVkX3Jlc3VtZSIsIm9uX3JldHJ5IiwiaGFuZGxlX3JldHJ5IiwiZ2V0X3N1cmZhY2UiLCJjbGFzc0xpc3QiLCJhZGQiLCJ2aXNpYmlsaXR5IiwiZGV0YWlscyIsIm93bmVyIiwiYm9va2luZ19pZCIsInNlZ21lbnRfaGludCIsInJlZmVyZW5jZSIsInNldF9wb3BvdmVyX2F4aXMiLCJheGlzIiwibmV4dF92YWx1ZSIsImFsbG93ZWRfdmFsdWVzIiwiaW5kZXhPZiIsImdldF90cmlnZ2VyX2NvbnRleHQiLCJ0cmlnZ2VyIiwiY29udGV4dCIsImdldCIsImdldF92aXN1YWxfdmlld3BvcnRfcmVjdGFuZ2xlIiwidmlzdWFsX3ZpZXdwb3J0IiwidmlzdWFsVmlld3BvcnQiLCJsZWZ0IiwiTnVtYmVyIiwiaXNGaW5pdGUiLCJvZmZzZXRMZWZ0IiwidG9wIiwib2Zmc2V0VG9wIiwid2lkdGgiLCJNYXRoIiwibWF4IiwiZG9jdW1lbnRFbGVtZW50IiwiY2xpZW50V2lkdGgiLCJpbm5lcldpZHRoIiwiaGVpZ2h0IiwiY2xpZW50SGVpZ2h0IiwiaW5uZXJIZWlnaHQiLCJyaWdodCIsImJvdHRvbSIsImNhbnZhc19yZWN0YW5nbGUiLCJ2aWV3cG9ydF9yZWN0YW5nbGUiLCJzdGlja3lfaGVhZGVyIiwic3RpY2t5X3JlY3RhbmdsZSIsInZpc2libGVfbGVmdCIsInZpc2libGVfdG9wIiwidmlzaWJsZV9yaWdodCIsInZpc2libGVfYm90dG9tIiwiaXNDb25uZWN0ZWQiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJtaW4iLCJnZXRDbGllbnRSZWN0cyIsImxlbmd0aCIsIngiLCJ5IiwiZ2V0X3RyaWdnZXJfcmVjdGFuZ2xlIiwiY29udGFpbnMiLCJyZWN0YW5nbGVzX2ludGVyc2VjdCIsImZpcnN0X3JlY3RhbmdsZSIsInNlY29uZF9yZWN0YW5nbGUiLCJnZXRfdHJpZ2dlcl9yZWZlcmVuY2Vfc3RhdGUiLCJ0cmlnZ2VyX3JlY3RhbmdsZSIsInZpc2libGVfcmVjdGFuZ2xlIiwiZ2V0X3BvcG92ZXJfc3RhdGUiLCJvcGVuZWRfY29udHJvbGxlciIsImlzX3Bpbm5lZCIsIm9ic2VydmVfYWN0aXZlX2dlb21ldHJ5IiwibG9hZF9kZXRhaWxzIiwic3RvcF9nZW9tZXRyeV90cmFja2luZyIsImNoYW5nZWRfY29udHJvbGxlciIsInNjaGVkdWxlX2xpdmVfZ2VvbWV0cnlfdXBkYXRlIiwic3VzcGVuZGVkX2NvbnRyb2xsZXIiLCJyZXN1bWVkX2NvbnRyb2xsZXIiLCJjYW5jZWxfZ2VvbWV0cnlfZnJhbWUiLCJjYW5jZWxBbmltYXRpb25GcmFtZSIsImRpc2Nvbm5lY3QiLCJhY3RpdmVfY2FyZCIsIm9ic2VydmVkX25vZGVzIiwiUmVzaXplT2JzZXJ2ZXIiLCJmb3JFYWNoIiwib2JzZXJ2ZWRfbm9kZSIsIm9ic2VydmVkX2luZGV4Iiwib2JzZXJ2ZSIsInVwZGF0ZV9saXZlX2dlb21ldHJ5IiwicmVmZXJlbmNlX3N0YXRlIiwic3VzcGVuc2lvbl9yZWFzb24iLCJpc19vcGVuIiwic3VzcGVuZCIsInJlcXVlc3RfY2xvc2UiLCJpc19zdXNwZW5kZWQiLCJnZXRfc3VzcGVuc2lvbl9yZWFzb24iLCJyZXN1bWUiLCJ1cGRhdGVfcmVmZXJlbmNlIiwicmVxdWVzdEFuaW1hdGlvbkZyYW1lIiwiZ2V0X3RyaWdnZXJfYm9va2luZ19pZCIsImdldF9ib29raW5nX3ZpZXciLCJpbnZhbGlkYXRlX2Jvb2tpbmciLCJjYW5kaWRhdGUiLCJmYWxsYmFjayIsIm1pbmltdW0iLCJtYXhpbXVtIiwicm91bmQiLCJub3JtYWxpemVfZHRvIiwiZHRvIiwicmVzb3VyY2Vfc3VtbWFyeSIsInJlc291cmNlX2lkIiwic2NoZW1hX3ZlcnNpb24iLCJoZWFkaW5nIiwibGFiZWwiLCJzdGF0dXNfa2V5Iiwic3RhdHVzX2xhYmVsIiwic3RhcnRfbGFiZWwiLCJlbmRfbGFiZWwiLCJkYXRlX2xhYmVsIiwiZHVyYXRpb25fbGFiZWwiLCJpc19jbGlwcGVkX3N0YXJ0IiwiQm9vbGVhbiIsImlzX2NsaXBwZWRfZW5kIiwiY29udGludWVzX2JlZm9yZV9sYWJlbCIsImNvbnRpbnVlc19hZnRlcl9sYWJlbCIsIm9wZW5fZGV0YWlsc19sYWJlbCIsIm9wZW5fZGV0YWlscyIsInJlc291cmNlIiwibm9ybWFsaXplX3Jlc291cmNlX3N1bW1hcnkiLCJjYW5kaWRhdGVfaWQiLCJzdWJ0aXRsZSIsInBpY3R1cmVfdXJsIiwibm9ybWFsaXplX3VybCIsImltYWdlX3VybCIsIm5vcm1hbGl6ZV9kZXRhaWxzX2R0byIsInN0YXR1cyIsInByaWNpbmciLCJjb3N0cyIsInBheW1lbnQiLCJ0cnVuY2F0aW9uIiwia2V5IiwiZGVzY3JpcHRpb24iLCJhbGxvY2F0aW9uX2NvdW50Iiwic3VwcG9ydGVkIiwiZm9ybWF0dGVkX2Nvc3QiLCJwZXJpb2RfbGFiZWwiLCJpbnRlcnZhbHMiLCJub3JtYWxpemVfcmVjb3JkX2xpc3QiLCJub3JtYWxpemVfaW50ZXJ2YWwiLCJzZWxlY3RlZF9kYXRlcyIsIm5vcm1hbGl6ZV9zZWxlY3RlZF9kYXRlIiwiZHVyYXRpb25fbWV0cmljcyIsIm5vcm1hbGl6ZV90ZXh0X2xpc3QiLCJmaWVsZHMiLCJub3JtYWxpemVfZmllbGQiLCJoYXNfc2F2ZWRfY29zdCIsInNhdmVkX2Nvc3RfZm9ybWF0dGVkIiwic3RhdGUiLCJjcmVhdGVkX2xhYmVsIiwiaXNfdHJ1bmNhdGVkIiwiYm9va2luZ19kYXRhIiwic2F2ZWRfY29zdCIsInBheW1lbnRfc3RhdHVzIiwiY3JlYXRlZCIsIm5vdF9hdmFpbGFibGUiLCJlbXB0eV9maWVsZHMiLCJ1bnN1cHBvcnRlZF9maW5hbmNpYWxzIiwidHJ1bmNhdGVkIiwiaW50ZXJ2YWwiLCJzdGFydF9hdCIsImVuZF9hdCIsImlzX2Z1bGxfZGF5IiwiaXNfb3Zlcm5pZ2h0Iiwic2VsZWN0ZWRfZGF0ZSIsImRhdGUiLCJ0aW1lX2xhYmVsIiwiYm91bmRhcnkiLCJmaWVsZCIsInZhbHVlIiwicmVjb3JkcyIsIm1heGltdW1faXRlbXMiLCJtYXBwZXIiLCJBcnJheSIsImlzQXJyYXkiLCJzbGljZSIsImZpbHRlciIsInJlY29yZCIsIm1hcCIsInZhbHVlcyIsIm1heGltdW1fbGVuZ3RoIiwidGVzdCIsIm1heF9sZW5ndGgiLCJpc19jdXJyZW50X3JlcXVlc3QiLCJnZW5lcmF0aW9uIiwib3duZXJfY29udGV4dCIsImN1cnJlbnRfY29udGV4dCIsInZpZXciLCJnZXRBdHRyaWJ1dGUiLCJnZXRfdGVtcGxhdGVfaTE4biIsInN0YXJ0IiwiZW5kIiwiZHVyYXRpb24iLCJidWlsZF9zdW1tYXJ5X21vZGVsIiwiY29tcGFjdF9kdG8iLCJmaXJzdF9pbnRlcnZhbCIsInJlc291cmNlX3ByaWNpbmciLCJpbnRlcnZhbF9jb3VudCIsImFkZGl0aW9uYWxfaW50ZXJ2YWxzIiwicmVuZGVyX2Jvb2tpbmdfdmlldyIsInNldF9oZWFkZXIiLCJzZXRfY29udGVudCIsInN1bW1hcnlfaHRtbCIsImRldGFpbHNfaHRtbCIsIm1lc3NhZ2UiLCJsb2FkaW5nIiwic2V0X2J1c3kiLCJyZXBsYWNlX3BhcnRpYWwiLCJob3N0IiwicmVuZGVyZWRfbWFya3VwIiwiYWN0aXZlRWxlbWVudCIsImZvY3VzIiwiaW5uZXJIVE1MIiwicmVuZGVyX2RldGFpbHMiLCJzdW1tYXJ5X2hvc3QiLCJkZXRhaWxzX2hvc3QiLCJzZXRBdHRyaWJ1dGUiLCJsb2FkZWQiLCJyZW5kZXJfZGV0YWlsc19lcnJvciIsImVycm9yIiwicmV0cnlfbGFiZWwiLCJyZXRyeSIsInJlbmRlcl9kZXRhaWxzX2xvYWRpbmciLCJjYWNoZV9rZXkiLCJyZXF1ZXN0X2VudHJ5IiwiY2FjaGVkX2RldGFpbHMiLCJ1cmwiLCJhY3Rpb24iLCJub25jZSIsInNvdXJjZSIsImhhcyIsImRlbGV0ZSIsInNldCIsInJlcXVlc3QiLCJhamF4IiwibWV0aG9kIiwiZGF0YVR5cGUiLCJkYXRhIiwiYWx3YXlzIiwiZG9uZSIsInJlc3BvbnNlIiwic3VjY2VzcyIsIm92ZXJ2aWV3Iiwic2l6ZSIsImtleXMiLCJuZXh0IiwiZmFpbCIsInJlcXVlc3Rfc3RhdHVzIiwiY2xlYXJfZGV0YWlsc19zdGF0ZSIsImluY3JlbWVudF9zdGF0ZSIsImFib3J0IiwiY2xlYXIiLCJnZXRfdHJpZ2dlciIsImV2ZW50X3RhcmdldCIsImVsZW1lbnQiLCJub2RlVHlwZSIsImNsb3Nlc3QiLCJ0cmlnZ2VyX2JlbG9uZ3NfdG9fY2FyZCIsImNhcmQiLCJ0cmlnZ2VyX2Jvb2tpbmdfaWQiLCJjYXJkX2Jvb2tpbmdfaWQiLCJ0cmlnZ2VyX3NlZ21lbnRfaGludCIsImNhcmRfc2VnbWVudF9oaW50IiwiaGFzX3Zpc2libGVfbW9kYWxfbGF5ZXIiLCJwcm90b3R5cGUiLCJzb21lIiwiY2FsbCIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJtb2RhbF9sYXllciIsImhpZGRlbiIsImlzX3N1cHByZXNzZWQiLCJwcmVwYXJlX2NvbnRlbnQiLCJoYW5kb2ZmX3RvX2Jvb2tpbmdfaW5zcGVjdG9yIiwiZXZlbnQiLCJvcGVuX2Jvb2tpbmdfZGV0YWlscyIsInByZXZlbnREZWZhdWx0Iiwic3RvcFByb3BhZ2F0aW9uIiwiaGFuZGxlX3RyaWdnZXJfY2xpY2siLCJ0YXJnZXQiLCJvcGVuIiwiaGFuZGxlX3Njcm9sbCIsImNhbmNlbF9wZW5kaW5nX29wZW4iLCJjbGVhclRpbWVvdXQiLCJzZXRUaW1lb3V0IiwiaGFuZGxlX2dlb21ldHJ5X2NoYW5nZSIsImhhbmRsZV9nZW9tZXRyeV9pbWFnZV9sb2FkIiwibm9kZU5hbWUiLCJjb21wbGV0ZV9yZWZyZXNoX3JlYmluZCIsIm93bmVyX2Jvb2tpbmdfaWQiLCJvd25lcl9zZWdtZW50X2hpbnQiLCJhdXRob3JpemVkX2NhbmRpZGF0ZXMiLCJ2aXNpYmxlX2NhbmRpZGF0ZXMiLCJzZWxlY3RlZF9jYW5kaWRhdGUiLCJyZWJpbmRfdHJpZ2dlciIsImhhbmRsZV9wb3BvdmVyX2NsaWNrIiwicmV0cnlfYnV0dG9uIiwib3Blbl9idXR0b24iLCJoYW5kbGVfcG9wb3Zlcl93aGVlbCIsInNjcm9sbF90aW1lbGluZSIsImFkZEV2ZW50TGlzdGVuZXIiLCJwYXNzaXZlIiwib3Blbl90cmlnZ2VyIiwiZm9jdXNfc3VyZmFjZSIsImhhbmRsZV90cmlnZ2VyX2tleWRvd24iLCJyZWdpc3RlciIsIm5vcm1hbGl6ZWRfZHRvIiwidHJpZ2dlcl9jb250ZXh0IiwiY2FuX3VzZV90cmlnZ2VyIiwicHVzaCIsImNvbXBsZXRlX3JlZnJlc2giLCJyZWZyZXNoIiwicmV0YWluX3BpbiIsImludmFsaWRhdGUiLCJ1cGRhdGVfZ2VvbWV0cnkiLCJnZXRfc3RhdGUiLCJkZXN0cm95IiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImNyZWF0ZV9jb250cm9sbGVyIiwiYmFzZV9jb21wb25lbnRfaWQiLCJyZXBsYWNlIiwiYm9va2luZ19jb250cm9sbGVycyIsImJvb2tpbmdfcmVnaXN0cmF0aW9ucyIsInRyaWdnZXJfYm9va2luZ19pZHMiLCJub3JtYWxpemVfYm9va2luZ19pZCIsImNyZWF0ZV9pbnN0YW5jZV9jb25maWd1cmF0aW9uIiwiaW5zdGFuY2VfY29uZmlndXJhdGlvbiIsImluc3RhbmNlX2lkIiwiT2JqZWN0IiwiY29uZmlndXJhdGlvbl9rZXkiLCJyZWdpc3Rlcl9jdXJyZW50X3NlZ21lbnRzIiwiY29udHJvbGxlciIsInJlZ2lzdHJhdGlvbnMiLCJyZWdpc3RyYXRpb24iLCJnZXRfYm9va2luZ19jb250cm9sbGVyIiwialF1ZXJ5Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvYm9va2luZy1vdmVydmlldy10b29sdGlwL19zcmMvYm9va2luZy1vdmVydmlldy10b29sdGlwLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQm9va2luZyBPdmVydmlldyBhZGFwdGVyIGZvciB0aGUgc2hhcmVkIENvbnRleHQgUG9wb3Zlci5cbiAqXG4gKiBUaGUgYWRhcHRlciBvd25zIHRoZSBib29raW5nLWRvbWFpbiBEVE8gYWxsb3cgbGlzdCwgZml4ZWQgV29yZFByZXNzIHRlbXBsYXRlLFxuICogVGltZWxpbmUgc3VwcHJlc3Npb24gcG9saWN5LCBhbmQgQm9va2luZyBJbnNwZWN0b3IgaGFuZG9mZi4gVGhlIHNoYXJlZFxuICogY29udHJvbGxlciBvd25zIHRoZSBjb25maWd1cmVkIHBvcnRhbCwgVGlwcHkgcG9zaXRpb25pbmcsIGV4cGxpY2l0LWRpc21pc3NcbiAqIGxpZmVjeWNsZSwgYW5kIGtleWJvYXJkIGZvY3VzIGVudHJ5LlxuICpcbiAqIEBwYWNrYWdlIEJvb2tpbmcgQ2FsZW5kYXJcbiAqIEBzaW5jZSAgIDEyLjAuMFxuICovXG4oIGZ1bmN0aW9uICggd2luZG93LCBkb2N1bWVudCwgd3AsICQgKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHR3aW5kb3cud3BiY19ib29raW5nX292ZXJ2aWV3X3Rvb2x0aXAgPSB3aW5kb3cud3BiY19ib29raW5nX292ZXJ2aWV3X3Rvb2x0aXAgfHwge307XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBvbmUgaG9zdC1zY29wZWQgQm9va2luZyBPdmVydmlldyBDb250ZXh0IFBvcG92ZXIgYWRhcHRlci5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm9vdCAgICAgICAgICBUaW1lbGluZSByb290IGNvbnRhaW5pbmcgYm9va2luZyB0cmlnZ2Vycy5cblx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgY29uZmlndXJhdGlvbiBFeGVjdXRhYmxlLWZyZWUgc2VydmVyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGNhbGxiYWNrcyAgICAgVGltZWxpbmUgc3VwcHJlc3Npb24gYW5kIEluc3BlY3RvciBob29rcy5cblx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IERvbWFpbiBhZGFwdGVyIEFQSSwgb3IgbnVsbCB3aGVuIGRlcGVuZGVuY2llcyBhcmUgYWJzZW50LlxuXHQgKi9cblx0ZnVuY3Rpb24gY3JlYXRlX2luc3RhbmNlX2NvbnRyb2xsZXIoIHJvb3QsIGNvbmZpZ3VyYXRpb24sIGNhbGxiYWNrcyApIHtcblx0XHRjb25maWd1cmF0aW9uID0gY29uZmlndXJhdGlvbiB8fCB7fTtcblx0XHRjYWxsYmFja3MgPSBjYWxsYmFja3MgfHwge307XG5cdFx0aWYgKFxuXHRcdFx0ISByb290XG5cdFx0XHR8fCAhIGNvbmZpZ3VyYXRpb24uYWN0aXZlXG5cdFx0XHR8fCAhIHdwXG5cdFx0XHR8fCAhICRcblx0XHRcdHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiB3cC50ZW1wbGF0ZVxuXHRcdFx0fHwgISB3aW5kb3cud3BiY19zaGFyZWRfdWlfY29udGV4dF9wb3BvdmVyXG5cdFx0XHR8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LndwYmNfc2hhcmVkX3VpX2NvbnRleHRfcG9wb3Zlci5jcmVhdGVcblx0XHQpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHZhciB0ZW1wbGF0ZSA9IHdwLnRlbXBsYXRlKCBTdHJpbmcoIGNvbmZpZ3VyYXRpb24udGVtcGxhdGVfaWQgfHwgJycgKSApO1xuXHRcdHZhciBoZWFkZXJfdGVtcGxhdGUgPSB3cC50ZW1wbGF0ZSggU3RyaW5nKCBjb25maWd1cmF0aW9uLmhlYWRlcl90ZW1wbGF0ZV9pZCB8fCAnJyApICk7XG5cdFx0dmFyIGRldGFpbHNfdGVtcGxhdGUgPSB3cC50ZW1wbGF0ZSggU3RyaW5nKCBjb25maWd1cmF0aW9uLmRldGFpbHNfdGVtcGxhdGVfaWQgfHwgJycgKSApO1xuXHRcdHZhciBzdW1tYXJ5X3RlbXBsYXRlID0gd3AudGVtcGxhdGUoIFN0cmluZyggY29uZmlndXJhdGlvbi5zdW1tYXJ5X3RlbXBsYXRlX2lkIHx8ICcnICkgKTtcblx0XHR2YXIgbG9hZGluZ190ZW1wbGF0ZSA9IHdwLnRlbXBsYXRlKCBTdHJpbmcoIGNvbmZpZ3VyYXRpb24ubG9hZGluZ190ZW1wbGF0ZV9pZCB8fCAnJyApICk7XG5cdFx0dmFyIGVycm9yX3RlbXBsYXRlID0gd3AudGVtcGxhdGUoIFN0cmluZyggY29uZmlndXJhdGlvbi5lcnJvcl90ZW1wbGF0ZV9pZCB8fCAnJyApICk7XG5cdFx0dmFyIGkxOG4gPSBjb25maWd1cmF0aW9uLmkxOG4gJiYgJ29iamVjdCcgPT09IHR5cGVvZiBjb25maWd1cmF0aW9uLmkxOG4gPyBjb25maWd1cmF0aW9uLmkxOG4gOiB7fTtcblx0XHR2YXIgdHJhbnNwb3J0ID0gY29uZmlndXJhdGlvbi50cmFuc3BvcnQgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBjb25maWd1cmF0aW9uLnRyYW5zcG9ydCA/IGNvbmZpZ3VyYXRpb24udHJhbnNwb3J0IDoge307XG5cdFx0dmFyIHNjcm9sbF9yZXN1bWVfZGVsYXlfbXMgPSBub3JtYWxpemVfZGVsYXkoIGNvbmZpZ3VyYXRpb24uc2Nyb2xsX3Jlc3VtZV9kZWxheV9tcywgMjIwLCAxMDAsIDEwMDAgKTtcblx0XHR2YXIgcG9zaXRpb25pbmdfYm91bmRhcnkgPSByb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLWNhbnZhc10nICk7XG5cdFx0dmFyIHBvcnRhbF9ob3N0ID0gcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1jYW52YXMtYXhpcy1jb250ZW50XScgKTtcblx0XHR2YXIgdHJpZ2dlcl9kdG9zID0gbmV3IHdpbmRvdy5XZWFrTWFwKCk7XG5cdFx0dmFyIHRyaWdnZXJfY29udGV4dHMgPSBuZXcgd2luZG93LldlYWtNYXAoKTtcblx0XHR2YXIgdHJpZ2dlcl9jYXJkcyA9IG5ldyB3aW5kb3cuV2Vha01hcCgpO1xuXHRcdHZhciBhY3RpdmVfdHJpZ2dlciA9IG51bGw7XG5cdFx0dmFyIGFjdGl2ZV9nZW5lcmF0aW9uID0gMDtcblx0XHR2YXIgcmVuZGVyX2dlbmVyYXRpb24gPSAxO1xuXHRcdHZhciBkZXRhaWxzX2NhY2hlID0gbmV3IHdpbmRvdy5NYXAoKTtcblx0XHR2YXIgaW5mbGlnaHRfcmVxdWVzdHMgPSBuZXcgd2luZG93Lk1hcCgpO1xuXHRcdHZhciBtYXhpbXVtX2NhY2hlX2VudHJpZXMgPSAyNDtcblx0XHR2YXIgc2Nyb2xsX3RpbWVyID0gMDtcblx0XHR2YXIgZ2VvbWV0cnlfZnJhbWUgPSAwO1xuXHRcdHZhciBnZW9tZXRyeV9yZXNpemVfb2JzZXJ2ZXIgPSBudWxsO1xuXHRcdHZhciByZWJpbmRfY2FuZGlkYXRlcyA9IFtdO1xuXHRcdHZhciByZWZyZXNoX3JlYmluZF9wZW5kaW5nID0gZmFsc2U7XG5cdFx0dmFyIGJsb2NraW5nX3N1c3BlbnNpb24gPSBmYWxzZTtcblx0XHR2YXIgaXNfc2Nyb2xsaW5nID0gZmFsc2U7XG5cdFx0dmFyIHZpc2liaWxpdHlfc3RhdGVzID0gWyAnaGlkZGVuJywgJ3RyYW5zaWVudCcsICdwaW5uZWQnLCAndGVtcG9yYXJpbHlfc3VzcGVuZGVkJyBdO1xuXHRcdHZhciBkZXRhaWxzX3N0YXRlcyA9IFsgJ2lkbGUnLCAnbG9hZGluZycsICdyZWFkeScsICdlbXB0eScsICdlcnJvcicgXTtcblx0XHR2YXIgcmVmZXJlbmNlX3N0YXRlcyA9IFsgJ2xpdmVfY29udHJvbCcsICd0ZW1wb3JhcmlseV9taXNzaW5nJywgJ291dHNpZGVfdmlzaWJsZV9jYW52YXMnIF07XG5cdFx0dmFyIHBvcG92ZXJfc3RhdGUgPSBjcmVhdGVfZW1wdHlfcG9wb3Zlcl9zdGF0ZSgpO1xuXHRcdHZhciBzaGFyZWRfY29udHJvbGxlcjtcblx0XHR2YXIgcG9wb3Zlcl9zdXJmYWNlO1xuXG5cdFx0aWYgKCAhIHBvc2l0aW9uaW5nX2JvdW5kYXJ5IHx8ICEgcG9ydGFsX2hvc3QgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRzaGFyZWRfY29udHJvbGxlciA9IHdpbmRvdy53cGJjX3NoYXJlZF91aV9jb250ZXh0X3BvcG92ZXIuY3JlYXRlKCB7XG5cdFx0XHRpZDogU3RyaW5nKCBjb25maWd1cmF0aW9uLmNvbXBvbmVudF9pZCB8fCAnJyApLFxuXHRcdFx0bW9kZTogJ2ludGVyYWN0aXZlJyA9PT0gY29uZmlndXJhdGlvbi5tb2RlID8gJ2ludGVyYWN0aXZlJyA6ICdwcmV2aWV3Jyxcblx0XHRcdG93bmVyX2lkOiBTdHJpbmcoIGNvbmZpZ3VyYXRpb24ub3duZXJfaWQgfHwgY29uZmlndXJhdGlvbi5jb21wb25lbnRfaWQgfHwgJycgKSxcblx0XHRcdGludGVyYWN0aW9uX2dyb3VwOiBTdHJpbmcoIGNvbmZpZ3VyYXRpb24uaW50ZXJhY3Rpb25fZ3JvdXAgfHwgY29uZmlndXJhdGlvbi5jb21wb25lbnRfaWQgfHwgJycgKSxcblx0XHRcdHBpbl9wb2xpY3k6ICdtYW51YWwnID09PSBTdHJpbmcoIGNvbmZpZ3VyYXRpb24ucGluX3BvbGljeSB8fCAnJyApID8gJ21hbnVhbCcgOiAnbm9uZScsXG5cdFx0XHRleHRlcm5hbF9zY3JvbGxfcG9saWN5OiAncmV0YWluJyA9PT0gU3RyaW5nKCBjb25maWd1cmF0aW9uLmV4dGVybmFsX3Njcm9sbF9wb2xpY3kgfHwgJycgKSA/ICdyZXRhaW4nIDogJ2Rpc21pc3MnLFxuXHRcdFx0ZGlzbWlzc19wb2xpY3k6ICdleHBsaWNpdCcsXG5cdFx0XHRleHRlcm5hbF9zY3JvbGxfZ3JhY2VfbXM6IHNjcm9sbF9yZXN1bWVfZGVsYXlfbXMsXG5cdFx0XHRwaW5fbGFiZWw6IG5vcm1hbGl6ZV90ZXh0KCBpMThuLnBpbiwgMTYwICksXG5cdFx0XHRwaW5uZWRfbGFiZWw6IG5vcm1hbGl6ZV90ZXh0KCBpMThuLnBpbm5lZCwgMTYwICksXG5cdFx0XHR1bnBpbl9sYWJlbDogbm9ybWFsaXplX3RleHQoIGkxOG4udW5waW4sIDE2MCApLFxuXHRcdFx0ZHJhZ19sYWJlbDogbm9ybWFsaXplX3RleHQoIGkxOG4ubW92ZSwgMTYwICksXG5cdFx0XHR0aXRsZTogbm9ybWFsaXplX3RleHQoIGkxOG4udGl0bGUsIDIwMCApLFxuXHRcdFx0Y2xvc2VfbGFiZWw6IG5vcm1hbGl6ZV90ZXh0KCBpMThuLmNsb3NlLCAxNjAgKSxcblx0XHRcdHNob3dfZGVsYXlfbXM6IGNvbmZpZ3VyYXRpb24uc2hvd19kZWxheV9tcyxcblx0XHRcdGhpZGVfZGVsYXlfbXM6IGNvbmZpZ3VyYXRpb24uaGlkZV9kZWxheV9tcyxcblx0XHRcdHBvaW50ZXJfYW5jaG9yOiAndHJpZ2dlcl9ibG9ja19lZGdlJyxcblx0XHRcdHBsYWNlbWVudDogJ2JvdHRvbScsXG5cdFx0XHRmYWxsYmFja19wbGFjZW1lbnRzOiBbICd0b3AnIF0sXG5cdFx0XHRhbGxvd19mbGlwOiBmYWxzZSxcblx0XHRcdGdldF9pbml0aWFsX3BsYWNlbWVudF9ib3VuZHM6IGdldF92aXNpYmxlX3RpbWVsaW5lX3JlY3RhbmdsZSxcblx0XHRcdG93bnNfdHJpZ2dlcl9hcmlhOiB0cnVlLFxuXHRcdFx0YXJpYV9oYXNwb3B1cDogJ2RpYWxvZycsXG5cdFx0XHRwcmVmZXJyZWRfd2lkdGg6IGNvbmZpZ3VyYXRpb24ucHJlZmVycmVkX3dpZHRoLFxuXHRcdFx0bWF4aW11bV93aWR0aDogY29uZmlndXJhdGlvbi5tYXhpbXVtX3dpZHRoLFxuXHRcdFx0Zml4ZWRfdW5waW5uZWRfaGVpZ2h0OiBjb25maWd1cmF0aW9uLmZpeGVkX3VucGlubmVkX2hlaWdodCxcblx0XHRcdG1heGltdW1fcmVzaXplZF93aWR0aDogY29uZmlndXJhdGlvbi5tYXhpbXVtX3Jlc2l6ZWRfd2lkdGgsXG5cdFx0XHRwb3NpdGlvbmluZ19ib3VuZGFyeTogcG9zaXRpb25pbmdfYm91bmRhcnksXG5cdFx0XHRwb3J0YWxfaG9zdDogcG9ydGFsX2hvc3QsXG5cdFx0XHRwb3NpdGlvbmluZ19zdHJhdGVneTogJ2Fic29sdXRlJyxcblx0XHRcdGxheWVyX3pfaW5kZXg6IGNvbmZpZ3VyYXRpb24ubGF5ZXJfel9pbmRleCxcblx0XHRcdHByZXZlbnRfb3ZlcmZsb3c6IGZhbHNlLFxuXHRcdFx0Ym91bmRhcnlfY3Jvc3NfYXhpczogdHJ1ZSxcblx0XHRcdGJvdW5kYXJ5X3RldGhlcjogZmFsc2UsXG5cdFx0XHRmaXRfb25fZmlyc3Rfb3BlbjogdHJ1ZSA9PT0gY29uZmlndXJhdGlvbi5maXRfb25fZmlyc3Rfb3Blbixcblx0XHRcdHBpbl90b192aWV3cG9ydDogdHJ1ZSA9PT0gY29uZmlndXJhdGlvbi5waW5fdG9fdmlld3BvcnQsXG5cdFx0XHRkcmFnZ2FibGVfd2hlbl9waW5uZWQ6IHRydWUgPT09IGNvbmZpZ3VyYXRpb24uZHJhZ2dhYmxlX3doZW5fcGlubmVkLFxuXHRcdFx0cmVzaXphYmxlX3doZW5fcGlubmVkOiB0cnVlID09PSBjb25maWd1cmF0aW9uLnJlc2l6YWJsZV93aGVuX3Bpbm5lZCxcblx0XHRcdHJlc2l6ZV9sYWJlbDogbm9ybWFsaXplX3RleHQoIGkxOG4ucmVzaXplLCAxNjAgKSxcblx0XHRcdHJlZmVyZW5jZV9wb2xpY3k6ICdzdHJpY3RfbGl2ZV9vd25lcicsXG5cdFx0XHRnZXRfcmVmZXJlbmNlX3JlY3Q6IGdldF9saXZlX3JlZmVyZW5jZV9yZWN0LFxuXHRcdFx0aGlkZV9hcnJvd193aGVuX3Bpbm5lZDogdHJ1ZSxcblx0XHRcdG9uX29wZW46IGhhbmRsZV9zaGFyZWRfb3Blbixcblx0XHRcdG9uX2Nsb3NlOiBoYW5kbGVfc2hhcmVkX2Nsb3NlLFxuXHRcdFx0b25fcGluX2NoYW5nZTogaGFuZGxlX3NoYXJlZF9waW5fY2hhbmdlLFxuXHRcdFx0b25fc3VzcGVuZDogaGFuZGxlX3NoYXJlZF9zdXNwZW5kLFxuXHRcdFx0b25fcmVzdW1lOiBoYW5kbGVfc2hhcmVkX3Jlc3VtZSxcblx0XHRcdG9uX3JldHJ5OiBoYW5kbGVfcmV0cnlcblx0XHR9ICk7XG5cdFx0cG9wb3Zlcl9zdXJmYWNlID0gc2hhcmVkX2NvbnRyb2xsZXIgPyBzaGFyZWRfY29udHJvbGxlci5nZXRfc3VyZmFjZSgpIDogbnVsbDtcblxuXHRcdGlmICggISBzaGFyZWRfY29udHJvbGxlciB8fCAhIHBvcG92ZXJfc3VyZmFjZSApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRwb3BvdmVyX3N1cmZhY2UuY2xhc3NMaXN0LmFkZCggJ3dwYmNfYm9va2luZ19vdmVydmlld190b29sdGlwX19zdXJmYWNlJyApO1xuXG5cdFx0LyoqXG5cdFx0ICogQ3JlYXRlIHRoZSBpbmRlcGVuZGVudCBwYWdlLW1lbW9yeSBzdGF0ZSBheGVzIGZvciBCb29raW5nIE92ZXJ2aWV3LlxuXHRcdCAqXG5cdFx0ICogVGhlIG93bmVyIHVzZXMgY2Fub25pY2FsIGJvb2tpbmcgaWRlbnRpdHkgcGx1cyBhIHJlbmRlciBnZW5lcmF0aW9uIGFuZFxuXHRcdCAqIHNlZ21lbnQgaGludC4gQSBET00gbm9kZSBpcyBkZWxpYmVyYXRlbHkgbm90IHBhcnQgb2YgdGhpcyBzZXJpYWxpemFibGVcblx0XHQgKiBzdGF0ZSBzbyBhIGxhdGVyIHBoYXNlIGNhbiByZWJpbmQgYWZ0ZXIgVGltZWxpbmUgcmVwbGFjZXMgY2FyZCBub2Rlcy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gRW1wdHkgdmlzaWJpbGl0eSwgZGV0YWlscywgb3duZXIsIGFuZCByZWZlcmVuY2Ugc3RhdGUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY3JlYXRlX2VtcHR5X3BvcG92ZXJfc3RhdGUoKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR2aXNpYmlsaXR5OiAnaGlkZGVuJyxcblx0XHRcdFx0ZGV0YWlsczogJ2lkbGUnLFxuXHRcdFx0XHRvd25lcjoge1xuXHRcdFx0XHRcdGJvb2tpbmdfaWQ6IDAsXG5cdFx0XHRcdFx0cmVuZGVyX2dlbmVyYXRpb246IDAsXG5cdFx0XHRcdFx0c2VnbWVudF9oaW50OiAnJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRyZWZlcmVuY2U6ICd0ZW1wb3JhcmlseV9taXNzaW5nJ1xuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDb21taXQgb25lIGFsbG93LWxpc3RlZCBwb3BvdmVyIHN0YXRlLWF4aXMgdmFsdWUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gYXhpcyAgICAgICBWaXNpYmlsaXR5LCBkZXRhaWxzLCBvciByZWZlcmVuY2UgYXhpcy5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbmV4dF92YWx1ZSBDYW5kaWRhdGUgYWxsb3ctbGlzdGVkIHZhbHVlLlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgcmVxdWVzdGVkIHZhbHVlIHdhcyBhY2NlcHRlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfcG9wb3Zlcl9heGlzKCBheGlzLCBuZXh0X3ZhbHVlICkge1xuXHRcdFx0dmFyIGFsbG93ZWRfdmFsdWVzID0ge1xuXHRcdFx0XHR2aXNpYmlsaXR5OiB2aXNpYmlsaXR5X3N0YXRlcyxcblx0XHRcdFx0ZGV0YWlsczogZGV0YWlsc19zdGF0ZXMsXG5cdFx0XHRcdHJlZmVyZW5jZTogcmVmZXJlbmNlX3N0YXRlc1xuXHRcdFx0fTtcblxuXHRcdFx0aWYgKCAhIGFsbG93ZWRfdmFsdWVzWyBheGlzIF0gfHwgLTEgPT09IGFsbG93ZWRfdmFsdWVzWyBheGlzIF0uaW5kZXhPZiggbmV4dF92YWx1ZSApICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRwb3BvdmVyX3N0YXRlWyBheGlzIF0gPSBuZXh0X3ZhbHVlO1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXNvbHZlIHRoZSBzdGFibGUgb3duZXIgY29udGV4dCByZWdpc3RlcmVkIGZvciBvbmUgcmVuZGVyZWQgdHJpZ2dlci5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gdHJpZ2dlciBSZWdpc3RlcmVkIFRpbWVsaW5lIGJvb2tpbmcgdHJpZ2dlci5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IENhbm9uaWNhbCBpZGVudGl0eSBhbmQgcmVuZGVyLWdlbmVyYXRpb24gY29udGV4dC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfdHJpZ2dlcl9jb250ZXh0KCB0cmlnZ2VyICkge1xuXHRcdFx0dmFyIGNvbnRleHQgPSB0cmlnZ2VyID8gdHJpZ2dlcl9jb250ZXh0cy5nZXQoIHRyaWdnZXIgKSA6IG51bGw7XG5cblx0XHRcdHJldHVybiBjb250ZXh0IHx8IHtcblx0XHRcdFx0Ym9va2luZ19pZDogMCxcblx0XHRcdFx0cmVuZGVyX2dlbmVyYXRpb246IDAsXG5cdFx0XHRcdHNlZ21lbnRfaGludDogJydcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSB2aXNpYmxlIHZpZXdwb3J0IHJlY3RhbmdsZSB1c2VkIGJ5IFRpbWVsaW5lIG93bmVyIGdlb21ldHJ5LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBQaHlzaWNhbCB2aWV3cG9ydCBlZGdlcyBpbiBDU1MgcGl4ZWxzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF92aXN1YWxfdmlld3BvcnRfcmVjdGFuZ2xlKCkge1xuXHRcdFx0dmFyIHZpc3VhbF92aWV3cG9ydCA9IHdpbmRvdy52aXN1YWxWaWV3cG9ydDtcblx0XHRcdHZhciBsZWZ0ID0gdmlzdWFsX3ZpZXdwb3J0ICYmIE51bWJlci5pc0Zpbml0ZSggdmlzdWFsX3ZpZXdwb3J0Lm9mZnNldExlZnQgKSA/IHZpc3VhbF92aWV3cG9ydC5vZmZzZXRMZWZ0IDogMDtcblx0XHRcdHZhciB0b3AgPSB2aXN1YWxfdmlld3BvcnQgJiYgTnVtYmVyLmlzRmluaXRlKCB2aXN1YWxfdmlld3BvcnQub2Zmc2V0VG9wICkgPyB2aXN1YWxfdmlld3BvcnQub2Zmc2V0VG9wIDogMDtcblx0XHRcdHZhciB3aWR0aCA9IHZpc3VhbF92aWV3cG9ydCAmJiBOdW1iZXIuaXNGaW5pdGUoIHZpc3VhbF92aWV3cG9ydC53aWR0aCApXG5cdFx0XHRcdD8gdmlzdWFsX3ZpZXdwb3J0LndpZHRoXG5cdFx0XHRcdDogTWF0aC5tYXgoIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aCB8fCAwLCB3aW5kb3cuaW5uZXJXaWR0aCB8fCAwICk7XG5cdFx0XHR2YXIgaGVpZ2h0ID0gdmlzdWFsX3ZpZXdwb3J0ICYmIE51bWJlci5pc0Zpbml0ZSggdmlzdWFsX3ZpZXdwb3J0LmhlaWdodCApXG5cdFx0XHRcdD8gdmlzdWFsX3ZpZXdwb3J0LmhlaWdodFxuXHRcdFx0XHQ6IE1hdGgubWF4KCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50SGVpZ2h0IHx8IDAsIHdpbmRvdy5pbm5lckhlaWdodCB8fCAwICk7XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGxlZnQ6IGxlZnQsXG5cdFx0XHRcdHRvcDogdG9wLFxuXHRcdFx0XHRyaWdodDogbGVmdCArIHdpZHRoLFxuXHRcdFx0XHRib3R0b206IHRvcCArIGhlaWdodFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXNvbHZlIHRoZSBUaW1lbGluZSBhcmVhIGluIHdoaWNoIGEgQm9va2luZyBPdmVydmlldyBtYXkgYmUgYW5jaG9yZWQuXG5cdFx0ICpcblx0XHQgKiBUaGUgdmlzaWJsZSBhcmVhIGlzIHRoZSBpbnRlcnNlY3Rpb24gb2YgdGhlIHRpbWUgY2FudmFzIGFuZCBWaXN1YWxcblx0XHQgKiBWaWV3cG9ydCBiZWxvdyB0aGUgc3RpY2t5IFJlc291cmNlL2RhdGUgaGVhZGVyLiBLZWVwaW5nIHRoaXMgY2FsY3VsYXRpb25cblx0XHQgKiBpbiB0aGUgQm9va2luZyBhZGFwdGVyIHByZXNlcnZlcyB0aGUgc2hhcmVkIGNvbnRyb2xsZXIncyBkb21haW4tbmV1dHJhbFxuXHRcdCAqIHBvc2l0aW9uaW5nIGNvbnRyYWN0LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IFBoeXNpY2FsIHZpc2libGUgZWRnZXMgaW4gQ1NTIHBpeGVscywgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfdmlzaWJsZV90aW1lbGluZV9yZWN0YW5nbGUoKSB7XG5cdFx0XHR2YXIgY2FudmFzX3JlY3RhbmdsZTtcblx0XHRcdHZhciB2aWV3cG9ydF9yZWN0YW5nbGU7XG5cdFx0XHR2YXIgc3RpY2t5X2hlYWRlcjtcblx0XHRcdHZhciBzdGlja3lfcmVjdGFuZ2xlO1xuXHRcdFx0dmFyIHZpc2libGVfbGVmdDtcblx0XHRcdHZhciB2aXNpYmxlX3RvcDtcblx0XHRcdHZhciB2aXNpYmxlX3JpZ2h0O1xuXHRcdFx0dmFyIHZpc2libGVfYm90dG9tO1xuXG5cdFx0XHRpZiAoXG5cdFx0XHRcdCEgcG9zaXRpb25pbmdfYm91bmRhcnlcblx0XHRcdFx0fHwgISBwb3NpdGlvbmluZ19ib3VuZGFyeS5pc0Nvbm5lY3RlZFxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0Y2FudmFzX3JlY3RhbmdsZSA9IHBvc2l0aW9uaW5nX2JvdW5kYXJ5LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0dmlld3BvcnRfcmVjdGFuZ2xlID0gZ2V0X3Zpc3VhbF92aWV3cG9ydF9yZWN0YW5nbGUoKTtcblx0XHRcdHZpc2libGVfbGVmdCA9IE1hdGgubWF4KCBjYW52YXNfcmVjdGFuZ2xlLmxlZnQsIHZpZXdwb3J0X3JlY3RhbmdsZS5sZWZ0ICk7XG5cdFx0XHR2aXNpYmxlX3RvcCA9IE1hdGgubWF4KCBjYW52YXNfcmVjdGFuZ2xlLnRvcCwgdmlld3BvcnRfcmVjdGFuZ2xlLnRvcCApO1xuXHRcdFx0dmlzaWJsZV9yaWdodCA9IE1hdGgubWluKCBjYW52YXNfcmVjdGFuZ2xlLnJpZ2h0LCB2aWV3cG9ydF9yZWN0YW5nbGUucmlnaHQgKTtcblx0XHRcdHZpc2libGVfYm90dG9tID0gTWF0aC5taW4oIGNhbnZhc19yZWN0YW5nbGUuYm90dG9tLCB2aWV3cG9ydF9yZWN0YW5nbGUuYm90dG9tICk7XG5cdFx0XHRzdGlja3lfaGVhZGVyID0gcm9vdC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfdGltZWxpbmVfX3N0aWNreV9oZWFkZXInICk7XG5cdFx0XHRpZiAoIHN0aWNreV9oZWFkZXIgJiYgc3RpY2t5X2hlYWRlci5nZXRDbGllbnRSZWN0cygpLmxlbmd0aCApIHtcblx0XHRcdFx0c3RpY2t5X3JlY3RhbmdsZSA9IHN0aWNreV9oZWFkZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRcdGlmIChcblx0XHRcdFx0XHRzdGlja3lfcmVjdGFuZ2xlLmJvdHRvbSA+IHZpc2libGVfdG9wXG5cdFx0XHRcdFx0JiYgc3RpY2t5X3JlY3RhbmdsZS50b3AgPCB2aXNpYmxlX2JvdHRvbVxuXHRcdFx0XHRcdCYmIHN0aWNreV9yZWN0YW5nbGUucmlnaHQgPiB2aXNpYmxlX2xlZnRcblx0XHRcdFx0XHQmJiBzdGlja3lfcmVjdGFuZ2xlLmxlZnQgPCB2aXNpYmxlX3JpZ2h0XG5cdFx0XHRcdCkge1xuXHRcdFx0XHRcdHZpc2libGVfdG9wID0gTWF0aC5taW4oIHZpc2libGVfYm90dG9tLCBNYXRoLm1heCggdmlzaWJsZV90b3AsIHN0aWNreV9yZWN0YW5nbGUuYm90dG9tICkgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCB2aXNpYmxlX3JpZ2h0IDw9IHZpc2libGVfbGVmdCB8fCB2aXNpYmxlX2JvdHRvbSA8PSB2aXNpYmxlX3RvcCApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGxlZnQ6IHZpc2libGVfbGVmdCxcblx0XHRcdFx0dG9wOiB2aXNpYmxlX3RvcCxcblx0XHRcdFx0cmlnaHQ6IHZpc2libGVfcmlnaHQsXG5cdFx0XHRcdGJvdHRvbTogdmlzaWJsZV9ib3R0b20sXG5cdFx0XHRcdHdpZHRoOiB2aXNpYmxlX3JpZ2h0IC0gdmlzaWJsZV9sZWZ0LFxuXHRcdFx0XHRoZWlnaHQ6IHZpc2libGVfYm90dG9tIC0gdmlzaWJsZV90b3AsXG5cdFx0XHRcdHg6IHZpc2libGVfbGVmdCxcblx0XHRcdFx0eTogdmlzaWJsZV90b3Bcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVzb2x2ZSBvbmUgcmVnaXN0ZXJlZCBpbmZvcm1hdGlvbiBidXR0b24ncyBjdXJyZW50IHBoeXNpY2FsIHJlY3RhbmdsZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gdHJpZ2dlciBSZWdpc3RlcmVkIGJvb2tpbmcgaW5mb3JtYXRpb24gYnV0dG9uLlxuXHRcdCAqIEByZXR1cm4ge0RPTVJlY3R8bnVsbH0gQ3VycmVudCB0cmlnZ2VyIHJlY3RhbmdsZSBvciBudWxsIHdoZW4gdW5hdmFpbGFibGUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3RyaWdnZXJfcmVjdGFuZ2xlKCB0cmlnZ2VyICkge1xuXHRcdFx0aWYgKCAhIHRyaWdnZXIgfHwgISB0cmlnZ2VyLmlzQ29ubmVjdGVkIHx8ICEgcm9vdC5jb250YWlucyggdHJpZ2dlciApICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRyaWdnZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRGV0ZXJtaW5lIHdoZXRoZXIgdHdvIHBoeXNpY2FsIHJlY3RhbmdsZXMgb3ZlcmxhcCB3aXRoIHBvc2l0aXZlIGFyZWEuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZmlyc3RfcmVjdGFuZ2xlICBGaXJzdCBwaHlzaWNhbCByZWN0YW5nbGUuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNlY29uZF9yZWN0YW5nbGUgU2Vjb25kIHBoeXNpY2FsIHJlY3RhbmdsZS5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIHJlY3RhbmdsZXMgaW50ZXJzZWN0LlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlY3RhbmdsZXNfaW50ZXJzZWN0KCBmaXJzdF9yZWN0YW5nbGUsIHNlY29uZF9yZWN0YW5nbGUgKSB7XG5cdFx0XHRyZXR1cm4gZmlyc3RfcmVjdGFuZ2xlLnJpZ2h0ID4gc2Vjb25kX3JlY3RhbmdsZS5sZWZ0XG5cdFx0XHRcdCYmIGZpcnN0X3JlY3RhbmdsZS5sZWZ0IDwgc2Vjb25kX3JlY3RhbmdsZS5yaWdodFxuXHRcdFx0XHQmJiBmaXJzdF9yZWN0YW5nbGUuYm90dG9tID4gc2Vjb25kX3JlY3RhbmdsZS50b3Bcblx0XHRcdFx0JiYgZmlyc3RfcmVjdGFuZ2xlLnRvcCA8IHNlY29uZF9yZWN0YW5nbGUuYm90dG9tO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc29sdmUgdGhlIGxpdmUgcmVmZXJlbmNlIGZvciBvbmUgYXV0aG9yaXplZCBjb250cm9sLlxuXHRcdCAqXG5cdFx0ICogRGV0YWNoZWQgY29udHJvbHMgc3RpbGwgcmV0dXJuIG51bGwgc28gdGhlIHN0cmljdC1vd25lciBwb2xpY3kgY2FuIHN1c3BlbmRcblx0XHQgKiBzYWZlbHkuIFRoZSByYXcgcmVjdGFuZ2xlIGxldHMgdGhlIGF4aXMtb3duZWQgcG9ydGFsIG1vdmUgYW5kIGNsaXAgd2l0aCB0aGVcblx0XHQgKiBib29raW5nIGluc3RlYWQgb2YgYmVpbmcgaGVsZCBhdCBhIGJyb3dzZXIgb3IgY2FudmFzIGVkZ2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fG51bGx9IHRyaWdnZXIgUmVnaXN0ZXJlZCBib29raW5nIGluZm9ybWF0aW9uIGJ1dHRvbi5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gUG9wcGVyLWNvbXBhdGlibGUgcmVmZXJlbmNlIHJlY3RhbmdsZSBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9saXZlX3JlZmVyZW5jZV9yZWN0KCB0cmlnZ2VyICkge1xuXHRcdFx0cmV0dXJuIGdldF90cmlnZ2VyX3JlY3RhbmdsZSggdHJpZ2dlciApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENsYXNzaWZ5IHRoZSBjdXJyZW50IHRyaWdnZXIgcmVmZXJlbmNlIHdpdGhvdXQgbWFraW5nIGl0IHRoZSBvd25lciBJRC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gdHJpZ2dlciBSZWdpc3RlcmVkIFRpbWVsaW5lIGJvb2tpbmcgdHJpZ2dlci5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IEFsbG93LWxpc3RlZCByZWZlcmVuY2UgbGlmZWN5Y2xlIHN0YXRlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF90cmlnZ2VyX3JlZmVyZW5jZV9zdGF0ZSggdHJpZ2dlciApIHtcblx0XHRcdHZhciB0cmlnZ2VyX3JlY3RhbmdsZSA9IGdldF90cmlnZ2VyX3JlY3RhbmdsZSggdHJpZ2dlciApO1xuXHRcdFx0dmFyIHZpc2libGVfcmVjdGFuZ2xlO1xuXG5cdFx0XHRpZiAoICEgdHJpZ2dlcl9yZWN0YW5nbGUgKSB7XG5cdFx0XHRcdHJldHVybiAndGVtcG9yYXJpbHlfbWlzc2luZyc7XG5cdFx0XHR9XG5cdFx0XHR2aXNpYmxlX3JlY3RhbmdsZSA9IGdldF92aXNpYmxlX3RpbWVsaW5lX3JlY3RhbmdsZSgpO1xuXHRcdFx0aWYgKCAhIHZpc2libGVfcmVjdGFuZ2xlIHx8ICEgcmVjdGFuZ2xlc19pbnRlcnNlY3QoIHRyaWdnZXJfcmVjdGFuZ2xlLCB2aXNpYmxlX3JlY3RhbmdsZSApICkge1xuXHRcdFx0XHRyZXR1cm4gJ291dHNpZGVfdmlzaWJsZV9jYW52YXMnO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gJ2xpdmVfY29udHJvbCc7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29weSBzdGF0ZSBmb3IgZGlhZ25vc3RpY3MgYW5kIGZ1dHVyZSBUaW1lbGluZSByZWJpbmQgb3JjaGVzdHJhdGlvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gRXhlY3V0YWJsZS1mcmVlIHNuYXBzaG90IHdpdGggbm8gRE9NIHJlZmVyZW5jZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfcG9wb3Zlcl9zdGF0ZSgpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHZpc2liaWxpdHk6IHBvcG92ZXJfc3RhdGUudmlzaWJpbGl0eSxcblx0XHRcdFx0ZGV0YWlsczogcG9wb3Zlcl9zdGF0ZS5kZXRhaWxzLFxuXHRcdFx0XHRvd25lcjoge1xuXHRcdFx0XHRcdGJvb2tpbmdfaWQ6IHBvcG92ZXJfc3RhdGUub3duZXIuYm9va2luZ19pZCxcblx0XHRcdFx0XHRyZW5kZXJfZ2VuZXJhdGlvbjogcG9wb3Zlcl9zdGF0ZS5vd25lci5yZW5kZXJfZ2VuZXJhdGlvbixcblx0XHRcdFx0XHRzZWdtZW50X2hpbnQ6IHBvcG92ZXJfc3RhdGUub3duZXIuc2VnbWVudF9oaW50XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHJlZmVyZW5jZTogcG9wb3Zlcl9zdGF0ZS5yZWZlcmVuY2Vcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0YWluIHRoZSB0cmlnZ2VyIGFjY2VwdGVkIGJ5IHRoaXMgYWRhcHRlcidzIHNoYXJlZCBjb250cm9sbGVyLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgb3BlbmVkX2NvbnRyb2xsZXIgU2hhcmVkIGNvbnRyb2xsZXIgaW5zdGFuY2UuXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gdHJpZ2dlciAgICAgICAgICAgQWN0aXZhdGluZyBib29raW5nIGNhcmQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfc2hhcmVkX29wZW4oIG9wZW5lZF9jb250cm9sbGVyLCB0cmlnZ2VyICkge1xuXHRcdFx0aWYgKCBvcGVuZWRfY29udHJvbGxlciA9PT0gc2hhcmVkX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRcdGFjdGl2ZV90cmlnZ2VyID0gdHJpZ2dlcjtcblx0XHRcdFx0cG9wb3Zlcl9zdGF0ZS5vd25lciA9IGdldF90cmlnZ2VyX2NvbnRleHQoIHRyaWdnZXIgKTtcblx0XHRcdFx0c2V0X3BvcG92ZXJfYXhpcyggJ3Zpc2liaWxpdHknLCBzaGFyZWRfY29udHJvbGxlci5pc19waW5uZWQoKSA/ICdwaW5uZWQnIDogJ3RyYW5zaWVudCcgKTtcblx0XHRcdFx0c2V0X3BvcG92ZXJfYXhpcyggJ3JlZmVyZW5jZScsIGdldF90cmlnZ2VyX3JlZmVyZW5jZV9zdGF0ZSggdHJpZ2dlciApICk7XG5cdFx0XHRcdG9ic2VydmVfYWN0aXZlX2dlb21ldHJ5KCk7XG5cdFx0XHRcdGxvYWRfZGV0YWlscyggdHJpZ2dlciApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbGVhc2UgdGhlIGFjdGl2ZSBib29raW5nIHRyaWdnZXIgYWZ0ZXIgdGhpcyBzaGFyZWQgaW5zdGFuY2UgY2xvc2VzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfc2hhcmVkX2Nsb3NlKCkge1xuXHRcdFx0c3RvcF9nZW9tZXRyeV90cmFja2luZygpO1xuXHRcdFx0YWN0aXZlX2dlbmVyYXRpb24gKz0gMTtcblx0XHRcdGFjdGl2ZV90cmlnZ2VyID0gbnVsbDtcblx0XHRcdHBvcG92ZXJfc3RhdGUgPSBjcmVhdGVfZW1wdHlfcG9wb3Zlcl9zdGF0ZSgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE1pcnJvciB0aGUgc2hhcmVkIG5ldXRyYWwgcGluIHN0YXRlIGludG8gZG9tYWluIHBhZ2UgbWVtb3J5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9ICBjaGFuZ2VkX2NvbnRyb2xsZXIgU2hhcmVkIGNvbnRyb2xsZXIgaW5zdGFuY2UuXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBpc19waW5uZWQgICAgICAgICBDdXJyZW50IG5ldXRyYWwgcGluIHN0YXRlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX3NoYXJlZF9waW5fY2hhbmdlKCBjaGFuZ2VkX2NvbnRyb2xsZXIsIGlzX3Bpbm5lZCApIHtcblx0XHRcdGlmICggY2hhbmdlZF9jb250cm9sbGVyICE9PSBzaGFyZWRfY29udHJvbGxlciB8fCAhIGFjdGl2ZV90cmlnZ2VyICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRzZXRfcG9wb3Zlcl9heGlzKCAndmlzaWJpbGl0eScsIGlzX3Bpbm5lZCA/ICdwaW5uZWQnIDogJ3RyYW5zaWVudCcgKTtcblx0XHRcdHNjaGVkdWxlX2xpdmVfZ2VvbWV0cnlfdXBkYXRlKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0YWluIGRvbWFpbiBpZGVudGl0eSB3aGlsZSBhIGJsb2NraW5nIGxheWVyIG93bnMgdmlzdWFsIHByZXNlbmNlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHN1c3BlbmRlZF9jb250cm9sbGVyIFNoYXJlZCBjb250cm9sbGVyIGluc3RhbmNlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX3NoYXJlZF9zdXNwZW5kKCBzdXNwZW5kZWRfY29udHJvbGxlciApIHtcblx0XHRcdGlmICggc3VzcGVuZGVkX2NvbnRyb2xsZXIgPT09IHNoYXJlZF9jb250cm9sbGVyICYmIGFjdGl2ZV90cmlnZ2VyICkge1xuXHRcdFx0XHRzZXRfcG9wb3Zlcl9heGlzKCAndmlzaWJpbGl0eScsICd0ZW1wb3JhcmlseV9zdXNwZW5kZWQnICk7XG5cdFx0XHRcdGlmICggJ3RlbXBvcmFyaWx5X21pc3NpbmcnICE9PSBwb3BvdmVyX3N0YXRlLnJlZmVyZW5jZSApIHtcblx0XHRcdFx0XHRzZXRfcG9wb3Zlcl9heGlzKCAncmVmZXJlbmNlJywgZ2V0X3RyaWdnZXJfcmVmZXJlbmNlX3N0YXRlKCBhY3RpdmVfdHJpZ2dlciApICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXN0b3JlIHBpbm5lZCBwYWdlLW1lbW9yeSB2aXNpYmlsaXR5IGFmdGVyIHNhZmUgc2hhcmVkIHJlc3VtcHRpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmVzdW1lZF9jb250cm9sbGVyIFNoYXJlZCBjb250cm9sbGVyIGluc3RhbmNlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX3NoYXJlZF9yZXN1bWUoIHJlc3VtZWRfY29udHJvbGxlciApIHtcblx0XHRcdGlmICggcmVzdW1lZF9jb250cm9sbGVyID09PSBzaGFyZWRfY29udHJvbGxlciAmJiBhY3RpdmVfdHJpZ2dlciApIHtcblx0XHRcdFx0c2V0X3BvcG92ZXJfYXhpcyggJ3Zpc2liaWxpdHknLCAncGlubmVkJyApO1xuXHRcdFx0XHRzZXRfcG9wb3Zlcl9heGlzKCAncmVmZXJlbmNlJywgZ2V0X3RyaWdnZXJfcmVmZXJlbmNlX3N0YXRlKCBhY3RpdmVfdHJpZ2dlciApICk7XG5cdFx0XHRcdG9ic2VydmVfYWN0aXZlX2dlb21ldHJ5KCk7XG5cdFx0XHRcdGlmICggLTEgIT09IFsgJ2lkbGUnLCAnbG9hZGluZycgXS5pbmRleE9mKCBwb3BvdmVyX3N0YXRlLmRldGFpbHMgKSApIHtcblx0XHRcdFx0XHRsb2FkX2RldGFpbHMoIGFjdGl2ZV90cmlnZ2VyICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDYW5jZWwgdGhlIHNpbmdsZSBwZW5kaW5nIGdlb21ldHJ5IGZyYW1lIG93bmVkIGJ5IHRoaXMgYWRhcHRlci5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2FuY2VsX2dlb21ldHJ5X2ZyYW1lKCkge1xuXHRcdFx0aWYgKCBnZW9tZXRyeV9mcmFtZSApIHtcblx0XHRcdFx0d2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lKCBnZW9tZXRyeV9mcmFtZSApO1xuXHRcdFx0XHRnZW9tZXRyeV9mcmFtZSA9IDA7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3RvcCBhY3RpdmUgb3duZXIgb2JzZXJ2YXRpb24gd2hlbiB0aGUgcG9wb3ZlciBubyBsb25nZXIgb3ducyBhIGJvb2tpbmcuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHN0b3BfZ2VvbWV0cnlfdHJhY2tpbmcoKSB7XG5cdFx0XHRjYW5jZWxfZ2VvbWV0cnlfZnJhbWUoKTtcblx0XHRcdGlmICggZ2VvbWV0cnlfcmVzaXplX29ic2VydmVyICkge1xuXHRcdFx0XHRnZW9tZXRyeV9yZXNpemVfb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE9ic2VydmUgb25seSB0aGUgY3VycmVudCBvd25lciBhbmQgaXRzIHNoYXJlZCBsYXlvdXQgY29udGFpbmVycy5cblx0XHQgKlxuXHRcdCAqIE9uZSBjb250cm9sbGVyIG93bnMgb25lIG9ic2VydmVyOyBubyBvYnNlcnZlciBpcyBhbGxvY2F0ZWQgcGVyIGJvb2tpbmcuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG9ic2VydmVfYWN0aXZlX2dlb21ldHJ5KCkge1xuXHRcdFx0dmFyIGFjdGl2ZV9jYXJkID0gYWN0aXZlX3RyaWdnZXIgPyB0cmlnZ2VyX2NhcmRzLmdldCggYWN0aXZlX3RyaWdnZXIgKSA6IG51bGw7XG5cdFx0XHR2YXIgb2JzZXJ2ZWRfbm9kZXMgPSBbIHJvb3QsIHBvc2l0aW9uaW5nX2JvdW5kYXJ5LCBhY3RpdmVfY2FyZCwgYWN0aXZlX3RyaWdnZXIgXTtcblxuXHRcdFx0aWYgKCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LlJlc2l6ZU9ic2VydmVyIHx8ICEgYWN0aXZlX3RyaWdnZXIgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISBnZW9tZXRyeV9yZXNpemVfb2JzZXJ2ZXIgKSB7XG5cdFx0XHRcdGdlb21ldHJ5X3Jlc2l6ZV9vYnNlcnZlciA9IG5ldyB3aW5kb3cuUmVzaXplT2JzZXJ2ZXIoIHNjaGVkdWxlX2xpdmVfZ2VvbWV0cnlfdXBkYXRlICk7XG5cdFx0XHR9XG5cdFx0XHRnZW9tZXRyeV9yZXNpemVfb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuXHRcdFx0b2JzZXJ2ZWRfbm9kZXMuZm9yRWFjaCggZnVuY3Rpb24gKCBvYnNlcnZlZF9ub2RlLCBvYnNlcnZlZF9pbmRleCApIHtcblx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdG9ic2VydmVkX25vZGVcblx0XHRcdFx0XHQmJiBvYnNlcnZlZF9ub2RlLmlzQ29ubmVjdGVkXG5cdFx0XHRcdFx0JiYgb2JzZXJ2ZWRfbm9kZXMuaW5kZXhPZiggb2JzZXJ2ZWRfbm9kZSApID09PSBvYnNlcnZlZF9pbmRleFxuXHRcdFx0XHQpIHtcblx0XHRcdFx0XHRnZW9tZXRyeV9yZXNpemVfb2JzZXJ2ZXIub2JzZXJ2ZSggb2JzZXJ2ZWRfbm9kZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQXBwbHkgb25lIGN1cnJlbnQgb3duZXIgbWVhc3VyZW1lbnQgYWZ0ZXIgY29hbGVzY2VkIGxheW91dCBjaGFuZ2VzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB1cGRhdGVfbGl2ZV9nZW9tZXRyeSgpIHtcblx0XHRcdHZhciByZWZlcmVuY2Vfc3RhdGU7XG5cdFx0XHR2YXIgc3VzcGVuc2lvbl9yZWFzb247XG5cblx0XHRcdGlmICggISBhY3RpdmVfdHJpZ2dlciB8fCAoICEgc2hhcmVkX2NvbnRyb2xsZXIuaXNfb3BlbigpICYmICEgc2hhcmVkX2NvbnRyb2xsZXIuaXNfcGlubmVkKCkgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cmVmZXJlbmNlX3N0YXRlID0gZ2V0X3RyaWdnZXJfcmVmZXJlbmNlX3N0YXRlKCBhY3RpdmVfdHJpZ2dlciApO1xuXHRcdFx0c2V0X3BvcG92ZXJfYXhpcyggJ3JlZmVyZW5jZScsIHJlZmVyZW5jZV9zdGF0ZSApO1xuXHRcdFx0aWYgKCAndGVtcG9yYXJpbHlfbWlzc2luZycgPT09IHJlZmVyZW5jZV9zdGF0ZSApIHtcblx0XHRcdFx0aWYgKCBzaGFyZWRfY29udHJvbGxlci5pc19waW5uZWQoKSApIHtcblx0XHRcdFx0XHRzaGFyZWRfY29udHJvbGxlci5zdXNwZW5kKCAncmVmZXJlbmNlX3VuYXZhaWxhYmxlJyApO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCBzaGFyZWRfY29udHJvbGxlci5pc19vcGVuKCkgKSB7XG5cdFx0XHRcdFx0c2hhcmVkX2NvbnRyb2xsZXIucmVxdWVzdF9jbG9zZSggJ2V4dGVybmFsX3Njcm9sbCcsIGZhbHNlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzaGFyZWRfY29udHJvbGxlci5pc19zdXNwZW5kZWQoKSApIHtcblx0XHRcdFx0c3VzcGVuc2lvbl9yZWFzb24gPSBzaGFyZWRfY29udHJvbGxlci5nZXRfc3VzcGVuc2lvbl9yZWFzb24oKTtcblx0XHRcdFx0aWYgKCAhIGJsb2NraW5nX3N1c3BlbnNpb24gJiYgJ3JlZmVyZW5jZV91bmF2YWlsYWJsZScgPT09IHN1c3BlbnNpb25fcmVhc29uICkge1xuXHRcdFx0XHRcdHNoYXJlZF9jb250cm9sbGVyLnJlc3VtZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHNoYXJlZF9jb250cm9sbGVyLnVwZGF0ZV9yZWZlcmVuY2UoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDb2FsZXNjZSBzY3JvbGwsIHJlc2l6ZSwgaW1hZ2UsIGFuZCBvYnNlcnZlciBub3RpZmljYXRpb25zIGludG8gb25lIGZyYW1lLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzY2hlZHVsZV9saXZlX2dlb21ldHJ5X3VwZGF0ZSgpIHtcblx0XHRcdGlmIChcblx0XHRcdFx0Z2VvbWV0cnlfZnJhbWVcblx0XHRcdFx0fHwgISBhY3RpdmVfdHJpZ2dlclxuXHRcdFx0XHR8fCAoICEgc2hhcmVkX2NvbnRyb2xsZXIuaXNfb3BlbigpICYmICEgc2hhcmVkX2NvbnRyb2xsZXIuaXNfcGlubmVkKCkgKVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGdlb21ldHJ5X2ZyYW1lID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRnZW9tZXRyeV9mcmFtZSA9IDA7XG5cdFx0XHRcdHVwZGF0ZV9saXZlX2dlb21ldHJ5KCk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0cnkgdGhlIGN1cnJlbnQgYm9va2luZyB3aXRob3V0IHRydXN0aW5nIHN0YWxlIGVycm9yLXN0YXRlIGRhdGEuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9yZXRyeSgpIHtcblx0XHRcdHZhciB0cmlnZ2VyID0gYWN0aXZlX3RyaWdnZXI7XG5cdFx0XHR2YXIgYm9va2luZ19pZDtcblxuXHRcdFx0aWYgKCAhIHRyaWdnZXIgfHwgISB0cmlnZ2VyLmlzQ29ubmVjdGVkIHx8ICEgcm9vdC5jb250YWlucyggdHJpZ2dlciApIHx8ICEgZ2V0X3RyaWdnZXJfY29udGV4dCggdHJpZ2dlciApLmJvb2tpbmdfaWQgKSB7XG5cdFx0XHRcdHNoYXJlZF9jb250cm9sbGVyLnJlcXVlc3RfY2xvc2UoICdhdXRob3JpemF0aW9uX2ludmFsaWRhdGlvbicsIGZhbHNlICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGJvb2tpbmdfaWQgPSBnZXRfdHJpZ2dlcl9ib29raW5nX2lkKCB0cmlnZ2VyICk7XG5cdFx0XHRpZiAoICEgZ2V0X2Jvb2tpbmdfdmlldyggYm9va2luZ19pZCApICkge1xuXHRcdFx0XHRzaGFyZWRfY29udHJvbGxlci5yZXF1ZXN0X2Nsb3NlKCAnYXV0aG9yaXphdGlvbl9pbnZhbGlkYXRpb24nLCBmYWxzZSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpbnZhbGlkYXRlX2Jvb2tpbmcoIGJvb2tpbmdfaWQsIGZhbHNlICk7XG5cdFx0XHRsb2FkX2RldGFpbHMoIHRyaWdnZXIgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBOb3JtYWxpemUgYSBib3VuZGVkIG1pbGxpc2Vjb25kIGRlbGF5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHsqfSAgICAgIGNhbmRpZGF0ZSBDYW5kaWRhdGUgZGVsYXkuXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGZhbGxiYWNrICBGYWxsYmFjayBkZWxheS5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gbWluaW11bSAgIE1pbmltdW0gZGVsYXkuXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IG1heGltdW0gICBNYXhpbXVtIGRlbGF5LlxuXHRcdCAqIEByZXR1cm4ge251bWJlcn0gQm91bmRlZCBpbnRlZ2VyIGRlbGF5LlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG5vcm1hbGl6ZV9kZWxheSggY2FuZGlkYXRlLCBmYWxsYmFjaywgbWluaW11bSwgbWF4aW11bSApIHtcblx0XHRcdGNhbmRpZGF0ZSA9IE51bWJlciggY2FuZGlkYXRlICk7XG5cdFx0XHRpZiAoICEgTnVtYmVyLmlzRmluaXRlKCBjYW5kaWRhdGUgKSApIHtcblx0XHRcdFx0Y2FuZGlkYXRlID0gZmFsbGJhY2s7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBNYXRoLm1heCggbWluaW11bSwgTWF0aC5taW4oIG1heGltdW0sIE1hdGgucm91bmQoIGNhbmRpZGF0ZSApICkgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBOb3JtYWxpemUgb25lIGJvdW5kZWQgdG9vbHRpcCBEVE8gYXQgdGhlIGJyb3dzZXIgdHJ1c3QgYm91bmRhcnkuXG5cdFx0ICpcblx0XHQgKiBVbmtub3duIGtleXMgYXJlIGRpc2NhcmRlZCBzbyBjb21wYWN0IGNhcmQgZGF0YSBjYW5ub3QgYWNjaWRlbnRhbGx5XG5cdFx0ICogZXhwYW5kIGludG8gbm90ZXMsIHJhdyBmb3JtIHN0b3JhZ2UsIG93bmVyc2hpcCwgb3IgZmluYW5jaWFsIGZpZWxkcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBkdG8gU2VydmVyLWF1dGhvcml6ZWQgQm9va2luZyBPdmVydmlldyBEVE8uXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IEV4ZWN1dGFibGUtZnJlZSBhbGxvdy1saXN0ZWQgRFRPLCBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG5vcm1hbGl6ZV9kdG8oIGR0bywgcmVzb3VyY2Vfc3VtbWFyeSApIHtcblx0XHRcdHZhciBib29raW5nX2lkID0gTWF0aC5tYXgoIDAsIE1hdGgucm91bmQoIE51bWJlciggZHRvICYmIGR0by5ib29raW5nX2lkICkgfHwgMCApICk7XG5cdFx0XHR2YXIgcmVzb3VyY2VfaWQgPSBNYXRoLm1heCggMCwgTWF0aC5yb3VuZCggTnVtYmVyKCBkdG8gJiYgZHRvLnJlc291cmNlX2lkICkgfHwgMCApICk7XG5cblx0XHRcdGlmICggISBkdG8gfHwgMSAhPT0gTnVtYmVyKCBkdG8uc2NoZW1hX3ZlcnNpb24gKSB8fCAhIGJvb2tpbmdfaWQgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRzY2hlbWFfdmVyc2lvbjogMSxcblx0XHRcdFx0Ym9va2luZ19pZDogYm9va2luZ19pZCxcblx0XHRcdFx0cmVzb3VyY2VfaWQ6IHJlc291cmNlX2lkLFxuXHRcdFx0XHRoZWFkaW5nOiBub3JtYWxpemVfdGV4dCggZHRvLmhlYWRpbmcsIDE2MCApLFxuXHRcdFx0XHRsYWJlbDogbm9ybWFsaXplX3RleHQoIGR0by5sYWJlbCwgMjAwICksXG5cdFx0XHRcdHN0YXR1c19rZXk6ICdwZW5kaW5nJyA9PT0gU3RyaW5nKCBkdG8uc3RhdHVzX2tleSB8fCAnJyApID8gJ3BlbmRpbmcnIDogJ2FwcHJvdmVkJyxcblx0XHRcdFx0c3RhdHVzX2xhYmVsOiBub3JtYWxpemVfdGV4dCggZHRvLnN0YXR1c19sYWJlbCwgMTYwICksXG5cdFx0XHRcdHN0YXJ0X2xhYmVsOiBub3JtYWxpemVfdGV4dCggZHRvLnN0YXJ0X2xhYmVsLCAxNjAgKSxcblx0XHRcdFx0ZW5kX2xhYmVsOiBub3JtYWxpemVfdGV4dCggZHRvLmVuZF9sYWJlbCwgMTYwICksXG5cdFx0XHRcdGRhdGVfbGFiZWw6IG5vcm1hbGl6ZV90ZXh0KCBkdG8uZGF0ZV9sYWJlbCwgMTYwICksXG5cdFx0XHRcdGR1cmF0aW9uX2xhYmVsOiBub3JtYWxpemVfdGV4dCggZHRvLmR1cmF0aW9uX2xhYmVsLCAxNjAgKSxcblx0XHRcdFx0aXNfY2xpcHBlZF9zdGFydDogQm9vbGVhbiggZHRvLmlzX2NsaXBwZWRfc3RhcnQgKSxcblx0XHRcdFx0aXNfY2xpcHBlZF9lbmQ6IEJvb2xlYW4oIGR0by5pc19jbGlwcGVkX2VuZCApLFxuXHRcdFx0XHRjb250aW51ZXNfYmVmb3JlX2xhYmVsOiBub3JtYWxpemVfdGV4dCggZHRvLmNvbnRpbnVlc19iZWZvcmVfbGFiZWwsIDE2MCApLFxuXHRcdFx0XHRjb250aW51ZXNfYWZ0ZXJfbGFiZWw6IG5vcm1hbGl6ZV90ZXh0KCBkdG8uY29udGludWVzX2FmdGVyX2xhYmVsLCAxNjAgKSxcblx0XHRcdFx0b3Blbl9kZXRhaWxzX2xhYmVsOiBub3JtYWxpemVfdGV4dCggaTE4bi5vcGVuX2RldGFpbHMsIDE2MCApLFxuXHRcdFx0XHRyZXNvdXJjZTogbm9ybWFsaXplX3Jlc291cmNlX3N1bW1hcnkoIHJlc291cmNlX3N1bW1hcnksIHJlc291cmNlX2lkIClcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVkdWNlIG9uZSBhbHJlYWR5LWF1dGhvcml6ZWQgVGltZWxpbmUgUmVzb3VyY2UgbGlzdCBEVE8gZm9yIHRoZSBzdW1tYXJ5LlxuXHRcdCAqXG5cdFx0ICogVGhlIFJlc291cmNlIG11c3QgbWF0Y2ggdGhlIHNlZ21lbnQncyBhdXRob3JpemVkIFJlc291cmNlIGlkZW50aXR5LiBFeGFjdFxuXHRcdCAqIGJvb2tpbmcgYWxsb2NhdGlvbnMgYW5kIHNhdmVkIGZpbmFuY2lhbCB2YWx1ZXMgcmVtYWluIGxhenktb25seSBkYXRhLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJlc291cmNlX3N1bW1hcnkgQXV0aG9yaXplZCBob3N0IFJlc291cmNlIGxpc3QgRFRPLlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCAgICAgIEV4cGVjdGVkIHNlZ21lbnQgUmVzb3VyY2UgSUQuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBCb3VuZGVkIHByZXNlbnRhdGlvbi1vbmx5IFJlc291cmNlIHN1bW1hcnkuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbm9ybWFsaXplX3Jlc291cmNlX3N1bW1hcnkoIHJlc291cmNlX3N1bW1hcnksIHJlc291cmNlX2lkICkge1xuXHRcdFx0dmFyIGNhbmRpZGF0ZV9pZCA9IE1hdGgubWF4KCAwLCBNYXRoLnJvdW5kKCBOdW1iZXIoIHJlc291cmNlX3N1bW1hcnkgJiYgcmVzb3VyY2Vfc3VtbWFyeS5pZCApIHx8IDAgKSApO1xuXG5cdFx0XHRpZiAoICEgcmVzb3VyY2VfaWQgfHwgY2FuZGlkYXRlX2lkICE9PSByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRyZXNvdXJjZV9pZDogMCxcblx0XHRcdFx0XHR0aXRsZTogJycsXG5cdFx0XHRcdFx0c3VidGl0bGU6ICcnLFxuXHRcdFx0XHRcdHBpY3R1cmVfdXJsOiAnJ1xuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRyZXNvdXJjZV9pZDogY2FuZGlkYXRlX2lkLFxuXHRcdFx0XHR0aXRsZTogbm9ybWFsaXplX3RleHQoIHJlc291cmNlX3N1bW1hcnkudGl0bGUsIDI0MCApLFxuXHRcdFx0XHRzdWJ0aXRsZTogbm9ybWFsaXplX3RleHQoIHJlc291cmNlX3N1bW1hcnkuc3VidGl0bGUsIDE2MCApLFxuXHRcdFx0XHRwaWN0dXJlX3VybDogbm9ybWFsaXplX3VybCggcmVzb3VyY2Vfc3VtbWFyeS5pbWFnZV91cmwgKVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBOb3JtYWxpemUgdGhlIGNvbXBsZXRlIGxhenkgcmVzcG9uc2UgdGhyb3VnaCBhbiBleGFjdCBicm93c2VyIGFsbG93IGxpc3QuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZHRvIFNlcnZlci1hdXRob3JpemVkIGNvbXBsZXRlIG92ZXJ2aWV3IERUTy5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gVGVtcGxhdGUtc2FmZSBkZXRhaWxzLCBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG5vcm1hbGl6ZV9kZXRhaWxzX2R0byggZHRvICkge1xuXHRcdFx0dmFyIGJvb2tpbmdfaWQgPSBNYXRoLm1heCggMCwgTWF0aC5yb3VuZCggTnVtYmVyKCBkdG8gJiYgZHRvLmJvb2tpbmdfaWQgKSB8fCAwICkgKTtcblx0XHRcdHZhciBzdGF0dXMgPSBkdG8gJiYgZHRvLnN0YXR1cyAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIGR0by5zdGF0dXMgPyBkdG8uc3RhdHVzIDoge307XG5cdFx0XHR2YXIgcmVzb3VyY2UgPSBkdG8gJiYgZHRvLnJlc291cmNlICYmICdvYmplY3QnID09PSB0eXBlb2YgZHRvLnJlc291cmNlID8gZHRvLnJlc291cmNlIDoge307XG5cdFx0XHR2YXIgcHJpY2luZyA9IHJlc291cmNlLnByaWNpbmcgJiYgJ29iamVjdCcgPT09IHR5cGVvZiByZXNvdXJjZS5wcmljaW5nID8gcmVzb3VyY2UucHJpY2luZyA6IHt9O1xuXHRcdFx0dmFyIGNvc3RzID0gZHRvICYmIGR0by5jb3N0cyAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIGR0by5jb3N0cyA/IGR0by5jb3N0cyA6IHt9O1xuXHRcdFx0dmFyIHBheW1lbnQgPSBjb3N0cy5wYXltZW50ICYmICdvYmplY3QnID09PSB0eXBlb2YgY29zdHMucGF5bWVudCA/IGNvc3RzLnBheW1lbnQgOiB7fTtcblx0XHRcdHZhciB0cnVuY2F0aW9uID0gZHRvICYmIGR0by50cnVuY2F0aW9uICYmICdvYmplY3QnID09PSB0eXBlb2YgZHRvLnRydW5jYXRpb24gPyBkdG8udHJ1bmNhdGlvbiA6IHt9O1xuXG5cdFx0XHRpZiAoICEgZHRvIHx8IDEgIT09IE51bWJlciggZHRvLnNjaGVtYV92ZXJzaW9uICkgfHwgISBib29raW5nX2lkICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0c2NoZW1hX3ZlcnNpb246IDEsXG5cdFx0XHRcdGJvb2tpbmdfaWQ6IGJvb2tpbmdfaWQsXG5cdFx0XHRcdGhlYWRpbmc6IG5vcm1hbGl6ZV90ZXh0KCBkdG8uaGVhZGluZywgMTYwICksXG5cdFx0XHRcdHRpdGxlOiBub3JtYWxpemVfdGV4dCggZHRvLnRpdGxlLCAyNDAgKSxcblx0XHRcdFx0c3RhdHVzOiB7XG5cdFx0XHRcdFx0a2V5OiAtMSAhPT0gWyAnYXBwcm92ZWQnLCAncGVuZGluZycgXS5pbmRleE9mKCBTdHJpbmcoIHN0YXR1cy5rZXkgfHwgJycgKSApID8gU3RyaW5nKCBzdGF0dXMua2V5ICkgOiAndW5rbm93bicsXG5cdFx0XHRcdFx0bGFiZWw6IG5vcm1hbGl6ZV90ZXh0KCBzdGF0dXMubGFiZWwsIDE2MCApXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHJlc291cmNlOiB7XG5cdFx0XHRcdFx0cmVzb3VyY2VfaWQ6IE1hdGgubWF4KCAwLCBNYXRoLnJvdW5kKCBOdW1iZXIoIHJlc291cmNlLnJlc291cmNlX2lkICkgfHwgMCApICksXG5cdFx0XHRcdFx0dGl0bGU6IG5vcm1hbGl6ZV90ZXh0KCByZXNvdXJjZS50aXRsZSwgMjQwICksXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5vcm1hbGl6ZV90ZXh0KCByZXNvdXJjZS5kZXNjcmlwdGlvbiwgMTAwMCApLFxuXHRcdFx0XHRcdHBpY3R1cmVfdXJsOiBub3JtYWxpemVfdXJsKCByZXNvdXJjZS5waWN0dXJlX3VybCApLFxuXHRcdFx0XHRcdGFsbG9jYXRpb25fY291bnQ6IE1hdGgubWF4KCAwLCBNYXRoLnJvdW5kKCBOdW1iZXIoIHJlc291cmNlLmFsbG9jYXRpb25fY291bnQgKSB8fCAwICkgKSxcblx0XHRcdFx0XHRwcmljaW5nOiB7XG5cdFx0XHRcdFx0XHRzdXBwb3J0ZWQ6IEJvb2xlYW4oIHByaWNpbmcuc3VwcG9ydGVkICksXG5cdFx0XHRcdFx0XHRmb3JtYXR0ZWRfY29zdDogbm9ybWFsaXplX3RleHQoIHByaWNpbmcuZm9ybWF0dGVkX2Nvc3QsIDE2MCApLFxuXHRcdFx0XHRcdFx0cGVyaW9kX2xhYmVsOiBub3JtYWxpemVfdGV4dCggcHJpY2luZy5wZXJpb2RfbGFiZWwsIDgwIClcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGludGVydmFsczogbm9ybWFsaXplX3JlY29yZF9saXN0KCBkdG8uaW50ZXJ2YWxzLCAyMDAsIG5vcm1hbGl6ZV9pbnRlcnZhbCApLFxuXHRcdFx0XHRzZWxlY3RlZF9kYXRlczogbm9ybWFsaXplX3JlY29yZF9saXN0KCBkdG8uc2VsZWN0ZWRfZGF0ZXMsIDM2Niwgbm9ybWFsaXplX3NlbGVjdGVkX2RhdGUgKSxcblx0XHRcdFx0ZHVyYXRpb25fbWV0cmljczogbm9ybWFsaXplX3RleHRfbGlzdCggZHRvLmR1cmF0aW9uX21ldHJpY3MsIDEwLCAyMDAgKSxcblx0XHRcdFx0ZmllbGRzOiBub3JtYWxpemVfcmVjb3JkX2xpc3QoIGR0by5maWVsZHMsIDEwMCwgbm9ybWFsaXplX2ZpZWxkICksXG5cdFx0XHRcdGNvc3RzOiB7XG5cdFx0XHRcdFx0c3VwcG9ydGVkOiBCb29sZWFuKCBjb3N0cy5zdXBwb3J0ZWQgKSxcblx0XHRcdFx0XHRoYXNfc2F2ZWRfY29zdDogQm9vbGVhbiggY29zdHMuaGFzX3NhdmVkX2Nvc3QgKSxcblx0XHRcdFx0XHRzYXZlZF9jb3N0X2Zvcm1hdHRlZDogbm9ybWFsaXplX3RleHQoIGNvc3RzLnNhdmVkX2Nvc3RfZm9ybWF0dGVkLCAxNjAgKSxcblx0XHRcdFx0XHRwYXltZW50OiB7XG5cdFx0XHRcdFx0XHRzdGF0ZTogLTEgIT09IFsgJ3BhaWQnLCAnbm90X3BhaWQnLCAndW5rbm93bicgXS5pbmRleE9mKCBTdHJpbmcoIHBheW1lbnQuc3RhdGUgfHwgJycgKSApID8gU3RyaW5nKCBwYXltZW50LnN0YXRlICkgOiAndW5rbm93bicsXG5cdFx0XHRcdFx0XHRsYWJlbDogbm9ybWFsaXplX3RleHQoIHBheW1lbnQubGFiZWwsIDE2MCApXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRjcmVhdGVkX2xhYmVsOiBub3JtYWxpemVfdGV4dCggZHRvLmNyZWF0ZWRfbGFiZWwsIDIwMCApLFxuXHRcdFx0XHR0cnVuY2F0aW9uOiB7XG5cdFx0XHRcdFx0aW50ZXJ2YWxzOiBCb29sZWFuKCB0cnVuY2F0aW9uLmludGVydmFscyApLFxuXHRcdFx0XHRcdHNlbGVjdGVkX2RhdGVzOiBCb29sZWFuKCB0cnVuY2F0aW9uLnNlbGVjdGVkX2RhdGVzICksXG5cdFx0XHRcdFx0ZmllbGRzOiBCb29sZWFuKCB0cnVuY2F0aW9uLmZpZWxkcyApXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGlzX3RydW5jYXRlZDogQm9vbGVhbiggdHJ1bmNhdGlvbi5pbnRlcnZhbHMgfHwgdHJ1bmNhdGlvbi5zZWxlY3RlZF9kYXRlcyB8fCB0cnVuY2F0aW9uLmZpZWxkcyApLFxuXHRcdFx0XHRvcGVuX2RldGFpbHNfbGFiZWw6IG5vcm1hbGl6ZV90ZXh0KCBpMThuLm9wZW5fZGV0YWlscywgMTYwICksXG5cdFx0XHRcdGkxOG46IHtcblx0XHRcdFx0XHRyZXNvdXJjZTogbm9ybWFsaXplX3RleHQoIGkxOG4ucmVzb3VyY2UsIDE2MCApLFxuXHRcdFx0XHRcdGludGVydmFsczogbm9ybWFsaXplX3RleHQoIGkxOG4uaW50ZXJ2YWxzLCAxNjAgKSxcblx0XHRcdFx0XHRzZWxlY3RlZF9kYXRlczogbm9ybWFsaXplX3RleHQoIGkxOG4uc2VsZWN0ZWRfZGF0ZXMsIDE2MCApLFxuXHRcdFx0XHRcdGJvb2tpbmdfZGF0YTogbm9ybWFsaXplX3RleHQoIGkxOG4uYm9va2luZ19kYXRhLCAxNjAgKSxcblx0XHRcdFx0XHRzYXZlZF9jb3N0OiBub3JtYWxpemVfdGV4dCggaTE4bi5zYXZlZF9jb3N0LCAxNjAgKSxcblx0XHRcdFx0XHRwYXltZW50X3N0YXR1czogbm9ybWFsaXplX3RleHQoIGkxOG4ucGF5bWVudF9zdGF0dXMsIDE2MCApLFxuXHRcdFx0XHRcdGNyZWF0ZWQ6IG5vcm1hbGl6ZV90ZXh0KCBpMThuLmNyZWF0ZWQsIDE2MCApLFxuXHRcdFx0XHRcdG5vdF9hdmFpbGFibGU6IG5vcm1hbGl6ZV90ZXh0KCBpMThuLm5vdF9hdmFpbGFibGUsIDE2MCApLFxuXHRcdFx0XHRcdGVtcHR5X2ZpZWxkczogbm9ybWFsaXplX3RleHQoIGkxOG4uZW1wdHlfZmllbGRzLCAyNDAgKSxcblx0XHRcdFx0XHR1bnN1cHBvcnRlZF9maW5hbmNpYWxzOiBub3JtYWxpemVfdGV4dCggaTE4bi51bnN1cHBvcnRlZF9maW5hbmNpYWxzLCAyNDAgKSxcblx0XHRcdFx0XHR0cnVuY2F0ZWQ6IG5vcm1hbGl6ZV90ZXh0KCBpMThuLnRydW5jYXRlZCwgMzIwIClcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBOb3JtYWxpemUgb25lIGNhbm9uaWNhbCBpbnRlcnZhbCBhdCB0aGUgYnJvd3NlciB0cnVzdCBib3VuZGFyeS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBpbnRlcnZhbCBDYW5kaWRhdGUgaW50ZXJ2YWwuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBPbmUgbm9ybWFsaXplZCBpbnRlcnZhbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBub3JtYWxpemVfaW50ZXJ2YWwoIGludGVydmFsICkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0c3RhcnRfYXQ6IG5vcm1hbGl6ZV90ZXh0KCBpbnRlcnZhbC5zdGFydF9hdCwgODAgKSxcblx0XHRcdFx0ZW5kX2F0OiBub3JtYWxpemVfdGV4dCggaW50ZXJ2YWwuZW5kX2F0LCA4MCApLFxuXHRcdFx0XHRzdGFydF9sYWJlbDogbm9ybWFsaXplX3RleHQoIGludGVydmFsLnN0YXJ0X2xhYmVsLCAyMDAgKSxcblx0XHRcdFx0ZW5kX2xhYmVsOiBub3JtYWxpemVfdGV4dCggaW50ZXJ2YWwuZW5kX2xhYmVsLCAyMDAgKSxcblx0XHRcdFx0ZHVyYXRpb25fbGFiZWw6IG5vcm1hbGl6ZV90ZXh0KCBpbnRlcnZhbC5kdXJhdGlvbl9sYWJlbCwgMTYwICksXG5cdFx0XHRcdGlzX2Z1bGxfZGF5OiBCb29sZWFuKCBpbnRlcnZhbC5pc19mdWxsX2RheSApLFxuXHRcdFx0XHRpc19vdmVybmlnaHQ6IEJvb2xlYW4oIGludGVydmFsLmlzX292ZXJuaWdodCApXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE5vcm1hbGl6ZSBvbmUgaW5kaXZpZHVhbCBzZWxlY3RlZC1kYXRlIHByb2plY3Rpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc2VsZWN0ZWRfZGF0ZSBDYW5kaWRhdGUgc2VsZWN0ZWQgZGF0ZS5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IE9uZSBub3JtYWxpemVkIHNlbGVjdGVkIGRhdGUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbm9ybWFsaXplX3NlbGVjdGVkX2RhdGUoIHNlbGVjdGVkX2RhdGUgKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRkYXRlOiBub3JtYWxpemVfdGV4dCggc2VsZWN0ZWRfZGF0ZS5kYXRlLCAyMCApLFxuXHRcdFx0XHRkYXRlX2xhYmVsOiBub3JtYWxpemVfdGV4dCggc2VsZWN0ZWRfZGF0ZS5kYXRlX2xhYmVsLCAxNjAgKSxcblx0XHRcdFx0dGltZV9sYWJlbDogbm9ybWFsaXplX3RleHQoIHNlbGVjdGVkX2RhdGUudGltZV9sYWJlbCwgMTYwICksXG5cdFx0XHRcdGJvdW5kYXJ5OiBub3JtYWxpemVfdGV4dCggc2VsZWN0ZWRfZGF0ZS5ib3VuZGFyeSwgMjAgKVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBOb3JtYWxpemUgb25lIGF1dGhvcml6ZWQgZm9ybS1maWVsZCBkaXNwbGF5IHJvdy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBmaWVsZCBDYW5kaWRhdGUgZm9ybS1maWVsZCByb3cuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBPbmUgbm9ybWFsaXplZCBmb3JtLWZpZWxkIGRpc3BsYXkgcm93LlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG5vcm1hbGl6ZV9maWVsZCggZmllbGQgKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRsYWJlbDogbm9ybWFsaXplX3RleHQoIGZpZWxkLmxhYmVsLCAyMDAgKSxcblx0XHRcdFx0dmFsdWU6IG5vcm1hbGl6ZV90ZXh0KCBmaWVsZC52YWx1ZSwgMjAwMCApXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE5vcm1hbGl6ZSBhIGJvdW5kZWQgbGlzdCBvZiBwbGFpbiByZWNvcmRzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHsqfSAgICAgICAgcmVjb3JkcyAgICAgICBDYW5kaWRhdGUgcmVjb3Jkcy5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gICBtYXhpbXVtX2l0ZW1zIE1heGltdW0gcmVjb3Jkcy5cblx0XHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBtYXBwZXIgICAgICAgIFJlY29yZCBtYXBwZXIuXG5cdFx0ICogQHJldHVybiB7QXJyYXl9IE5vcm1hbGl6ZWQgcmVjb3Jkcy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBub3JtYWxpemVfcmVjb3JkX2xpc3QoIHJlY29yZHMsIG1heGltdW1faXRlbXMsIG1hcHBlciApIHtcblx0XHRcdHJldHVybiAoIEFycmF5LmlzQXJyYXkoIHJlY29yZHMgKSA/IHJlY29yZHMgOiBbXSApLnNsaWNlKCAwLCBtYXhpbXVtX2l0ZW1zICkuZmlsdGVyKCBmdW5jdGlvbiAoIHJlY29yZCApIHtcblx0XHRcdFx0cmV0dXJuIHJlY29yZCAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIHJlY29yZCAmJiAhIEFycmF5LmlzQXJyYXkoIHJlY29yZCApO1xuXHRcdFx0fSApLm1hcCggbWFwcGVyICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTm9ybWFsaXplIGEgYm91bmRlZCBsaXN0IG9mIHNjYWxhciB0ZXh0IHZhbHVlcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Kn0gICAgICB2YWx1ZXMgICAgICAgICBDYW5kaWRhdGUgdmFsdWVzLlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBtYXhpbXVtX2l0ZW1zICBNYXhpbXVtIHJldHVybmVkIHZhbHVlcy5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gbWF4aW11bV9sZW5ndGggTWF4aW11bSBjaGFyYWN0ZXJzIHBlciB2YWx1ZS5cblx0XHQgKiBAcmV0dXJuIHtBcnJheX0gQm91bmRlZCBzY2FsYXIgdGV4dCB2YWx1ZXMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbm9ybWFsaXplX3RleHRfbGlzdCggdmFsdWVzLCBtYXhpbXVtX2l0ZW1zLCBtYXhpbXVtX2xlbmd0aCApIHtcblx0XHRcdHJldHVybiAoIEFycmF5LmlzQXJyYXkoIHZhbHVlcyApID8gdmFsdWVzIDogW10gKS5zbGljZSggMCwgbWF4aW11bV9pdGVtcyApLm1hcCggZnVuY3Rpb24gKCB2YWx1ZSApIHtcblx0XHRcdFx0cmV0dXJuIG5vcm1hbGl6ZV90ZXh0KCB2YWx1ZSwgbWF4aW11bV9sZW5ndGggKTtcblx0XHRcdH0gKS5maWx0ZXIoIEJvb2xlYW4gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBLZWVwIG9ubHkgSFRUUChTKSBvciBwcm90b2NvbC1yZWxhdGl2ZSBpbWFnZSBVUkxzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHsqfSBjYW5kaWRhdGUgQ2FuZGlkYXRlIFVSTC5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IEhUVFAoUykgaW1hZ2UgVVJMIG9yIGFuIGVtcHR5IHN0cmluZy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBub3JtYWxpemVfdXJsKCBjYW5kaWRhdGUgKSB7XG5cdFx0XHRjYW5kaWRhdGUgPSBub3JtYWxpemVfdGV4dCggY2FuZGlkYXRlLCAyMDAwICk7XG5cdFx0XHRyZXR1cm4gL14oaHR0cHM/Oik/XFwvXFwvL2kudGVzdCggY2FuZGlkYXRlICkgPyBjYW5kaWRhdGUgOiAnJztcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDb252ZXJ0IG9uZSBzY2FsYXIgdG8gYm91bmRlZCBwbGFpbiB0ZXh0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHsqfSAgICAgIGNhbmRpZGF0ZSAgQ2FuZGlkYXRlIHNjYWxhci5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gbWF4X2xlbmd0aCBNYXhpbXVtIGNoYXJhY3RlciBjb3VudC5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IEJvdW5kZWQgcGxhaW4gdGV4dC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBub3JtYWxpemVfdGV4dCggY2FuZGlkYXRlLCBtYXhfbGVuZ3RoICkge1xuXHRcdFx0aWYgKCBudWxsID09PSBjYW5kaWRhdGUgfHwgJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiBjYW5kaWRhdGUgfHwgKCAnc3RyaW5nJyAhPT0gdHlwZW9mIGNhbmRpZGF0ZSAmJiAnbnVtYmVyJyAhPT0gdHlwZW9mIGNhbmRpZGF0ZSApICkge1xuXHRcdFx0XHRyZXR1cm4gJyc7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBTdHJpbmcoIGNhbmRpZGF0ZSApLnNsaWNlKCAwLCBtYXhfbGVuZ3RoICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBhdXRob3JpdGF0aXZlIGJvb2tpbmcgSUQgYXNzb2NpYXRlZCB3aXRoIGEgcmVnaXN0ZXJlZCB0cmlnZ2VyLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gdHJpZ2dlciBSZWdpc3RlcmVkIGJvb2tpbmcgdHJpZ2dlci5cblx0XHQgKiBAcmV0dXJuIHtudW1iZXJ9IFBvc2l0aXZlIGJvb2tpbmcgSUQsIG9yIHplcm8uXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3RyaWdnZXJfYm9va2luZ19pZCggdHJpZ2dlciApIHtcblx0XHRcdHZhciBkdG8gPSB0cmlnZ2VyID8gdHJpZ2dlcl9kdG9zLmdldCggdHJpZ2dlciApIDogbnVsbDtcblxuXHRcdFx0cmV0dXJuIGR0byA/IE1hdGgubWF4KCAwLCBNYXRoLnJvdW5kKCBOdW1iZXIoIGR0by5ib29raW5nX2lkICkgfHwgMCApICkgOiAwO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIERldGVybWluZSB3aGV0aGVyIGFuIGFzeW5jaHJvbm91cyByZXN1bHQgc3RpbGwgb3ducyB0aGUgdmlzaWJsZSBzdXJmYWNlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gdHJpZ2dlciAgICBUcmlnZ2VyIGNhcHR1cmVkIGF0IHJlcXVlc3QgdGltZS5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gICAgICBnZW5lcmF0aW9uIEFkYXB0ZXIgZ2VuZXJhdGlvbiBjYXB0dXJlZCBhdCByZXF1ZXN0IHRpbWUuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgb3duZXJfY29udGV4dCBTdGFibGUgb3duZXIgYW5kIHJlYmluZCBnZW5lcmF0aW9uLlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgcmVzcG9uc2UgbWF5IHJlcGxhY2UgY3VycmVudCBjb250ZW50LlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGlzX2N1cnJlbnRfcmVxdWVzdCggdHJpZ2dlciwgZ2VuZXJhdGlvbiwgb3duZXJfY29udGV4dCApIHtcblx0XHRcdHZhciBjdXJyZW50X2NvbnRleHQgPSBnZXRfdHJpZ2dlcl9jb250ZXh0KCB0cmlnZ2VyICk7XG5cblx0XHRcdHJldHVybiBnZW5lcmF0aW9uID09PSBhY3RpdmVfZ2VuZXJhdGlvblxuXHRcdFx0XHQmJiB0cmlnZ2VyID09PSBhY3RpdmVfdHJpZ2dlclxuXHRcdFx0XHQmJiB0cmlnZ2VyLmlzQ29ubmVjdGVkXG5cdFx0XHRcdCYmIHJvb3QuY29udGFpbnMoIHRyaWdnZXIgKVxuXHRcdFx0XHQmJiBzaGFyZWRfY29udHJvbGxlci5pc19vcGVuKClcblx0XHRcdFx0JiYgb3duZXJfY29udGV4dC5ib29raW5nX2lkID09PSBwb3BvdmVyX3N0YXRlLm93bmVyLmJvb2tpbmdfaWRcblx0XHRcdFx0JiYgb3duZXJfY29udGV4dC5yZW5kZXJfZ2VuZXJhdGlvbiA9PT0gcG9wb3Zlcl9zdGF0ZS5vd25lci5yZW5kZXJfZ2VuZXJhdGlvblxuXHRcdFx0XHQmJiBvd25lcl9jb250ZXh0LnNlZ21lbnRfaGludCA9PT0gcG9wb3Zlcl9zdGF0ZS5vd25lci5zZWdtZW50X2hpbnRcblx0XHRcdFx0JiYgb3duZXJfY29udGV4dC5ib29raW5nX2lkID09PSBjdXJyZW50X2NvbnRleHQuYm9va2luZ19pZFxuXHRcdFx0XHQmJiBvd25lcl9jb250ZXh0LnJlbmRlcl9nZW5lcmF0aW9uID09PSBjdXJyZW50X2NvbnRleHQucmVuZGVyX2dlbmVyYXRpb25cblx0XHRcdFx0JiYgb3duZXJfY29udGV4dC5zZWdtZW50X2hpbnQgPT09IGN1cnJlbnRfY29udGV4dC5zZWdtZW50X2hpbnQ7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBjdXJyZW50IHN0YWJsZSBib29raW5nLW93bmVkIHZpZXcgZm9yIG9uZSBib29raW5nIGlkZW50aXR5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGJvb2tpbmdfaWQgRXhwZWN0ZWQgY2Fub25pY2FsIGJvb2tpbmcgSUQuXG5cdFx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR8bnVsbH0gQ3VycmVudCBkb21haW4gdmlldywgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfYm9va2luZ192aWV3KCBib29raW5nX2lkICkge1xuXHRcdFx0dmFyIHZpZXcgPSBwb3BvdmVyX3N1cmZhY2UucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1vdmVydmlldy12aWV3XScgKTtcblxuXHRcdFx0cmV0dXJuIHZpZXcgJiYgTnVtYmVyKCB2aWV3LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLWlkJyApICkgPT09IGJvb2tpbmdfaWQgPyB2aWV3IDogbnVsbDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBCdWlsZCBjb21tb24gdHJhbnNsYXRlZCBsYWJlbHMgZm9yIGJvb2tpbmctb3duZWQgcGFydGlhbCB0ZW1wbGF0ZXMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IEJvdW5kZWQgcHJlc2VudGF0aW9uIGxhYmVscy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfdGVtcGxhdGVfaTE4bigpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHJlc291cmNlOiBub3JtYWxpemVfdGV4dCggaTE4bi5yZXNvdXJjZSwgMTYwICksXG5cdFx0XHRcdHN0YXJ0OiBub3JtYWxpemVfdGV4dCggaTE4bi5zdGFydCwgMTYwICksXG5cdFx0XHRcdGVuZDogbm9ybWFsaXplX3RleHQoIGkxOG4uZW5kLCAxNjAgKSxcblx0XHRcdFx0ZHVyYXRpb246IG5vcm1hbGl6ZV90ZXh0KCBpMThuLmR1cmF0aW9uLCAxNjAgKSxcblx0XHRcdFx0aW50ZXJ2YWxzOiBub3JtYWxpemVfdGV4dCggaTE4bi5pbnRlcnZhbHMsIDE2MCApLFxuXHRcdFx0XHRib29raW5nX2RhdGE6IG5vcm1hbGl6ZV90ZXh0KCBpMThuLmJvb2tpbmdfZGF0YSwgMTYwICksXG5cdFx0XHRcdHNlbGVjdGVkX2RhdGVzOiBub3JtYWxpemVfdGV4dCggaTE4bi5zZWxlY3RlZF9kYXRlcywgMTYwICksXG5cdFx0XHRcdHNhdmVkX2Nvc3Q6IG5vcm1hbGl6ZV90ZXh0KCBpMThuLnNhdmVkX2Nvc3QsIDE2MCApLFxuXHRcdFx0XHRwYXltZW50X3N0YXR1czogbm9ybWFsaXplX3RleHQoIGkxOG4ucGF5bWVudF9zdGF0dXMsIDE2MCApLFxuXHRcdFx0XHRjcmVhdGVkOiBub3JtYWxpemVfdGV4dCggaTE4bi5jcmVhdGVkLCAxNjAgKSxcblx0XHRcdFx0bm90X2F2YWlsYWJsZTogbm9ybWFsaXplX3RleHQoIGkxOG4ubm90X2F2YWlsYWJsZSwgMTYwICksXG5cdFx0XHRcdGVtcHR5X2ZpZWxkczogbm9ybWFsaXplX3RleHQoIGkxOG4uZW1wdHlfZmllbGRzLCAyNDAgKSxcblx0XHRcdFx0dW5zdXBwb3J0ZWRfZmluYW5jaWFsczogbm9ybWFsaXplX3RleHQoIGkxOG4udW5zdXBwb3J0ZWRfZmluYW5jaWFscywgMjQwICksXG5cdFx0XHRcdHRydW5jYXRlZDogbm9ybWFsaXplX3RleHQoIGkxOG4udHJ1bmNhdGVkLCAzMjAgKVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBCdWlsZCB0aGUgbGVmdCBzdW1tYXJ5IGZyb20gdGhlIGF1dGhvcml6ZWQgY2FyZCBzY2hlZHVsZSwgdGhlbiBlbnJpY2ggaXRcblx0XHQgKiB3aXRoIHRoZSBjYW5vbmljYWwgbGF6eSBSZXNvdXJjZSwgaW50ZXJ2YWwsIGFuZCBzZWxlY3RlZCBkYXRlcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGNvbXBhY3RfZHRvIEF1dGhvcml6ZWQgY29tcGFjdCBib29raW5nIHByb2plY3Rpb24uXG5cdFx0ICogQHBhcmFtIHtPYmplY3R8bnVsbH0gZGV0YWlscyAgICBPcHRpb25hbCBhdXRob3JpemVkIGxhenkgcHJvamVjdGlvbi5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IFRlbXBsYXRlLXJlYWR5IHN1bW1hcnkgbW9kZWwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYnVpbGRfc3VtbWFyeV9tb2RlbCggY29tcGFjdF9kdG8sIGRldGFpbHMgKSB7XG5cdFx0XHR2YXIgZmlyc3RfaW50ZXJ2YWwgPSBkZXRhaWxzICYmIGRldGFpbHMuaW50ZXJ2YWxzLmxlbmd0aCA/IGRldGFpbHMuaW50ZXJ2YWxzWyAwIF0gOiBudWxsO1xuXHRcdFx0dmFyIHJlc291cmNlID0gY29tcGFjdF9kdG8ucmVzb3VyY2U7XG5cdFx0XHR2YXIgcmVzb3VyY2VfcHJpY2luZztcblxuXHRcdFx0aWYgKCBkZXRhaWxzICYmIGRldGFpbHMucmVzb3VyY2UucmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdHJlc291cmNlX3ByaWNpbmcgPSBkZXRhaWxzLnJlc291cmNlLnByaWNpbmc7XG5cdFx0XHRcdHJlc291cmNlID0ge1xuXHRcdFx0XHRcdHJlc291cmNlX2lkOiBkZXRhaWxzLnJlc291cmNlLnJlc291cmNlX2lkLFxuXHRcdFx0XHRcdHRpdGxlOiBkZXRhaWxzLnJlc291cmNlLnRpdGxlLFxuXHRcdFx0XHRcdHN1YnRpdGxlOiByZXNvdXJjZV9wcmljaW5nLnN1cHBvcnRlZCAmJiByZXNvdXJjZV9wcmljaW5nLmZvcm1hdHRlZF9jb3N0XG5cdFx0XHRcdFx0XHQ/IHJlc291cmNlX3ByaWNpbmcuZm9ybWF0dGVkX2Nvc3QgKyAoIHJlc291cmNlX3ByaWNpbmcucGVyaW9kX2xhYmVsID8gJyAvICcgKyByZXNvdXJjZV9wcmljaW5nLnBlcmlvZF9sYWJlbCA6ICcnIClcblx0XHRcdFx0XHRcdDogY29tcGFjdF9kdG8ucmVzb3VyY2Uuc3VidGl0bGUsXG5cdFx0XHRcdFx0cGljdHVyZV91cmw6IGRldGFpbHMucmVzb3VyY2UucGljdHVyZV91cmwgfHwgY29tcGFjdF9kdG8ucmVzb3VyY2UucGljdHVyZV91cmxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0cmVzb3VyY2U6IHJlc291cmNlLFxuXHRcdFx0XHRzdGFydF9sYWJlbDogZmlyc3RfaW50ZXJ2YWwgPyBmaXJzdF9pbnRlcnZhbC5zdGFydF9sYWJlbCA6IGNvbXBhY3RfZHRvLnN0YXJ0X2xhYmVsLFxuXHRcdFx0XHRlbmRfbGFiZWw6IGZpcnN0X2ludGVydmFsID8gZmlyc3RfaW50ZXJ2YWwuZW5kX2xhYmVsIDogY29tcGFjdF9kdG8uZW5kX2xhYmVsLFxuXHRcdFx0XHRkdXJhdGlvbl9sYWJlbDogZmlyc3RfaW50ZXJ2YWwgPyBmaXJzdF9pbnRlcnZhbC5kdXJhdGlvbl9sYWJlbCA6IGNvbXBhY3RfZHRvLmR1cmF0aW9uX2xhYmVsLFxuXHRcdFx0XHRpbnRlcnZhbF9jb3VudDogZGV0YWlscyA/IGRldGFpbHMuaW50ZXJ2YWxzLmxlbmd0aCA6IDAsXG5cdFx0XHRcdGFkZGl0aW9uYWxfaW50ZXJ2YWxzOiBkZXRhaWxzICYmIDEgPCBkZXRhaWxzLmludGVydmFscy5sZW5ndGggPyBkZXRhaWxzLmludGVydmFscy5zbGljZSggMSApIDogW10sXG5cdFx0XHRcdHNlbGVjdGVkX2RhdGVzOiBkZXRhaWxzID8gZGV0YWlscy5zZWxlY3RlZF9kYXRlcyA6IFtdLFxuXHRcdFx0XHRpMThuOiBnZXRfdGVtcGxhdGVfaTE4bigpXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbmRlciB0aGUgc3RhYmxlIGJvb2tpbmctb3duZWQgdmlldyBvbmNlIGZvciB0aGUgY3VycmVudCBvd25lci5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBjb21wYWN0X2R0byBBdXRob3JpemVkIGNvbXBhY3QgYm9va2luZyBwcm9qZWN0aW9uLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX2Jvb2tpbmdfdmlldyggY29tcGFjdF9kdG8gKSB7XG5cdFx0XHRzaGFyZWRfY29udHJvbGxlci5zZXRfaGVhZGVyKFxuXHRcdFx0XHRoZWFkZXJfdGVtcGxhdGUoIHtcblx0XHRcdFx0XHRoZWFkaW5nOiBjb21wYWN0X2R0by5oZWFkaW5nLFxuXHRcdFx0XHRcdGxhYmVsOiBjb21wYWN0X2R0by5sYWJlbCxcblx0XHRcdFx0XHRzdGF0dXNfa2V5OiBjb21wYWN0X2R0by5zdGF0dXNfa2V5LFxuXHRcdFx0XHRcdHN0YXR1c19sYWJlbDogY29tcGFjdF9kdG8uc3RhdHVzX2xhYmVsXG5cdFx0XHRcdH0gKSxcblx0XHRcdFx0Y29tcGFjdF9kdG8uaGVhZGluZ1xuXHRcdFx0KTtcblx0XHRcdHNoYXJlZF9jb250cm9sbGVyLnNldF9jb250ZW50KFxuXHRcdFx0XHR0ZW1wbGF0ZSgge1xuXHRcdFx0XHRcdGJvb2tpbmdfaWQ6IGNvbXBhY3RfZHRvLmJvb2tpbmdfaWQsXG5cdFx0XHRcdFx0c3VtbWFyeV9odG1sOiBzdW1tYXJ5X3RlbXBsYXRlKCBidWlsZF9zdW1tYXJ5X21vZGVsKCBjb21wYWN0X2R0bywgbnVsbCApICksXG5cdFx0XHRcdFx0ZGV0YWlsc19odG1sOiBsb2FkaW5nX3RlbXBsYXRlKCB7XG5cdFx0XHRcdFx0XHRtZXNzYWdlOiBub3JtYWxpemVfdGV4dCggaTE4bi5sb2FkaW5nLCAyNDAgKVxuXHRcdFx0XHRcdH0gKSxcblx0XHRcdFx0XHRvcGVuX2RldGFpbHNfbGFiZWw6IGNvbXBhY3RfZHRvLm9wZW5fZGV0YWlsc19sYWJlbFxuXHRcdFx0XHR9ICksXG5cdFx0XHRcdCcnXG5cdFx0XHQpO1xuXHRcdFx0c2hhcmVkX2NvbnRyb2xsZXIuc2V0X2J1c3koIHRydWUsIG5vcm1hbGl6ZV90ZXh0KCBpMThuLmxvYWRpbmcsIDI0MCApICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVwbGFjZSBvbmUgYm9va2luZy1vd25lZCBwYXJ0aWFsIHdoaWxlIHByZXNlcnZpbmcgZm9jdXMgaW4gaXRzIGhvc3QuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBob3N0ICAgICAgICAgICAgU3RhYmxlIHBhcnRpYWwgaG9zdC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICByZW5kZXJlZF9tYXJrdXAgRml4ZWQtdGVtcGxhdGUgbWFya3VwLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVwbGFjZV9wYXJ0aWFsKCBob3N0LCByZW5kZXJlZF9tYXJrdXAgKSB7XG5cdFx0XHRpZiAoICEgaG9zdCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBob3N0LmNvbnRhaW5zKCBkb2N1bWVudC5hY3RpdmVFbGVtZW50ICkgKSB7XG5cdFx0XHRcdGhvc3QuZm9jdXMoKTtcblx0XHRcdH1cblx0XHRcdGhvc3QuaW5uZXJIVE1MID0gU3RyaW5nKCByZW5kZXJlZF9tYXJrdXAgfHwgJycgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgY29tcGxldGUgZGV0YWlscyBhbmQgYXNrIFBvcHBlciB0byBtZWFzdXJlIHRoZSBjaGFuZ2VkIHN1cmZhY2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBkZXRhaWxzICAgIE5vcm1hbGl6ZWQgY29tcGxldGUgZGV0YWlscy5cblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSB0cmlnZ2VyICAgIE93bmluZyB0cmlnZ2VyLlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSAgICAgIGdlbmVyYXRpb24gT3duaW5nIGFkYXB0ZXIgZ2VuZXJhdGlvbi5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9kZXRhaWxzKCBkZXRhaWxzLCB0cmlnZ2VyLCBnZW5lcmF0aW9uLCBvd25lcl9jb250ZXh0ICkge1xuXHRcdFx0dmFyIGNvbXBhY3RfZHRvO1xuXHRcdFx0dmFyIHZpZXc7XG5cdFx0XHR2YXIgc3VtbWFyeV9ob3N0O1xuXHRcdFx0dmFyIGRldGFpbHNfaG9zdDtcblxuXHRcdFx0aWYgKCAhIGlzX2N1cnJlbnRfcmVxdWVzdCggdHJpZ2dlciwgZ2VuZXJhdGlvbiwgb3duZXJfY29udGV4dCApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb21wYWN0X2R0byA9IHRyaWdnZXJfZHRvcy5nZXQoIHRyaWdnZXIgKTtcblx0XHRcdHZpZXcgPSBnZXRfYm9va2luZ192aWV3KCBkZXRhaWxzLmJvb2tpbmdfaWQgKTtcblx0XHRcdGlmICggISBjb21wYWN0X2R0byB8fCAhIHZpZXcgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHN1bW1hcnlfaG9zdCA9IHZpZXcucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1vdmVydmlldy1zdW1tYXJ5LWhvc3RdJyApO1xuXHRcdFx0ZGV0YWlsc19ob3N0ID0gdmlldy5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLW92ZXJ2aWV3LWRldGFpbHMtaG9zdF0nICk7XG5cdFx0XHRyZXBsYWNlX3BhcnRpYWwoIHN1bW1hcnlfaG9zdCwgc3VtbWFyeV90ZW1wbGF0ZSggYnVpbGRfc3VtbWFyeV9tb2RlbCggY29tcGFjdF9kdG8sIGRldGFpbHMgKSApICk7XG5cdFx0XHRyZXBsYWNlX3BhcnRpYWwoIGRldGFpbHNfaG9zdCwgZGV0YWlsc190ZW1wbGF0ZSggZGV0YWlscyApICk7XG5cdFx0XHRpZiAoIGRldGFpbHNfaG9zdCApIHtcblx0XHRcdFx0ZGV0YWlsc19ob3N0LnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsICdmYWxzZScgKTtcblx0XHRcdH1cblx0XHRcdHNldF9wb3BvdmVyX2F4aXMoICdkZXRhaWxzJywgJ3JlYWR5JyApO1xuXHRcdFx0c2hhcmVkX2NvbnRyb2xsZXIuc2V0X2J1c3koIGZhbHNlLCBub3JtYWxpemVfdGV4dCggaTE4bi5sb2FkZWQsIDI0MCApICk7XG5cdFx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmICggaXNfY3VycmVudF9yZXF1ZXN0KCB0cmlnZ2VyLCBnZW5lcmF0aW9uLCBvd25lcl9jb250ZXh0ICkgKSB7XG5cdFx0XHRcdFx0c2hhcmVkX2NvbnRyb2xsZXIudXBkYXRlX3JlZmVyZW5jZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVuZGVyIGEgcmVjb3ZlcmFibGUgcmlnaHQtY29sdW1uIGVycm9yIHdpdGhvdXQgcmVwbGFjaW5nIGtub3duIHN1bW1hcnksXG5cdFx0ICogc2hlbGwgY29udHJvbHMsIG9yIHRoZSBPcGVuIGJvb2tpbmcgZGV0YWlscyBhY3Rpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSB0cmlnZ2VyICAgICAgIEN1cnJlbnQgYm9va2luZyBvd25lci5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gICAgICBnZW5lcmF0aW9uICAgIEN1cnJlbnQgcmVxdWVzdCBnZW5lcmF0aW9uLlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIG93bmVyX2NvbnRleHQgU3RhYmxlIG93bmVyIGFuZCByZWJpbmQgZ2VuZXJhdGlvbi5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9kZXRhaWxzX2Vycm9yKCB0cmlnZ2VyLCBnZW5lcmF0aW9uLCBvd25lcl9jb250ZXh0ICkge1xuXHRcdFx0dmFyIHZpZXc7XG5cdFx0XHR2YXIgZGV0YWlsc19ob3N0O1xuXG5cdFx0XHRpZiAoICEgaXNfY3VycmVudF9yZXF1ZXN0KCB0cmlnZ2VyLCBnZW5lcmF0aW9uLCBvd25lcl9jb250ZXh0ICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHZpZXcgPSBnZXRfYm9va2luZ192aWV3KCBvd25lcl9jb250ZXh0LmJvb2tpbmdfaWQgKTtcblx0XHRcdGRldGFpbHNfaG9zdCA9IHZpZXcgPyB2aWV3LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctb3ZlcnZpZXctZGV0YWlscy1ob3N0XScgKSA6IG51bGw7XG5cdFx0XHRyZXBsYWNlX3BhcnRpYWwoIGRldGFpbHNfaG9zdCwgZXJyb3JfdGVtcGxhdGUoIHtcblx0XHRcdFx0bWVzc2FnZTogbm9ybWFsaXplX3RleHQoIGkxOG4uZXJyb3IsIDUwMCApLFxuXHRcdFx0XHRyZXRyeV9sYWJlbDogbm9ybWFsaXplX3RleHQoIGkxOG4ucmV0cnksIDE2MCApXG5cdFx0XHR9ICkgKTtcblx0XHRcdGlmICggZGV0YWlsc19ob3N0ICkge1xuXHRcdFx0XHRkZXRhaWxzX2hvc3Quc2V0QXR0cmlidXRlKCAnYXJpYS1idXN5JywgJ2ZhbHNlJyApO1xuXHRcdFx0fVxuXHRcdFx0c2V0X3BvcG92ZXJfYXhpcyggJ2RldGFpbHMnLCAnZXJyb3InICk7XG5cdFx0XHRzaGFyZWRfY29udHJvbGxlci5zZXRfYnVzeSggZmFsc2UsIG5vcm1hbGl6ZV90ZXh0KCBpMThuLmVycm9yLCA1MDAgKSApO1xuXHRcdFx0c2hhcmVkX2NvbnRyb2xsZXIudXBkYXRlX3JlZmVyZW5jZSgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbmRlciB0aGUgYm9va2luZy1vd25lZCByaWdodC1jb2x1bW4gbG9hZGluZyBzdGF0ZSBpbiBwbGFjZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHRyaWdnZXIgQ3VycmVudCBib29raW5nIG93bmVyLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX2RldGFpbHNfbG9hZGluZyggdHJpZ2dlciApIHtcblx0XHRcdHZhciBib29raW5nX2lkID0gZ2V0X3RyaWdnZXJfYm9va2luZ19pZCggdHJpZ2dlciApO1xuXHRcdFx0dmFyIHZpZXcgPSBnZXRfYm9va2luZ192aWV3KCBib29raW5nX2lkICk7XG5cdFx0XHR2YXIgZGV0YWlsc19ob3N0ID0gdmlldyA/IHZpZXcucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1vdmVydmlldy1kZXRhaWxzLWhvc3RdJyApIDogbnVsbDtcblxuXHRcdFx0cmVwbGFjZV9wYXJ0aWFsKCBkZXRhaWxzX2hvc3QsIGxvYWRpbmdfdGVtcGxhdGUoIHtcblx0XHRcdFx0bWVzc2FnZTogbm9ybWFsaXplX3RleHQoIGkxOG4ubG9hZGluZywgMjQwIClcblx0XHRcdH0gKSApO1xuXHRcdFx0aWYgKCBkZXRhaWxzX2hvc3QgKSB7XG5cdFx0XHRcdGRldGFpbHNfaG9zdC5zZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knLCAndHJ1ZScgKTtcblx0XHRcdH1cblx0XHRcdHNoYXJlZF9jb250cm9sbGVyLnNldF9idXN5KCB0cnVlLCBub3JtYWxpemVfdGV4dCggaTE4bi5sb2FkaW5nLCAyNDAgKSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN0YXJ0IG9yIGpvaW4gb25lIGJvb2tpbmctZGV0YWlscyByZXF1ZXN0IGFuZCBndWFyZCBldmVyeSBVSSB1cGRhdGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSB0cmlnZ2VyIEFjdGl2ZSBib29raW5nIHRyaWdnZXIuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBsb2FkX2RldGFpbHMoIHRyaWdnZXIgKSB7XG5cdFx0XHR2YXIgYm9va2luZ19pZCA9IGdldF90cmlnZ2VyX2Jvb2tpbmdfaWQoIHRyaWdnZXIgKTtcblx0XHRcdHZhciBjYWNoZV9rZXkgPSBTdHJpbmcoIGJvb2tpbmdfaWQgKTtcblx0XHRcdHZhciBnZW5lcmF0aW9uID0gYWN0aXZlX2dlbmVyYXRpb24gKyAxO1xuXHRcdFx0dmFyIG93bmVyX2NvbnRleHQgPSBnZXRfdHJpZ2dlcl9jb250ZXh0KCB0cmlnZ2VyICk7XG5cdFx0XHR2YXIgcmVxdWVzdF9lbnRyeTtcblx0XHRcdHZhciBjYWNoZWRfZGV0YWlscztcblxuXHRcdFx0YWN0aXZlX2dlbmVyYXRpb24gPSBnZW5lcmF0aW9uO1xuXHRcdFx0c2V0X3BvcG92ZXJfYXhpcyggJ2RldGFpbHMnLCAnbG9hZGluZycgKTtcblx0XHRcdGlmICggISBib29raW5nX2lkIHx8ICEgdHJhbnNwb3J0LnVybCB8fCAhIHRyYW5zcG9ydC5hY3Rpb24gfHwgISB0cmFuc3BvcnQubm9uY2UgfHwgISB0cmFuc3BvcnQuc291cmNlICkge1xuXHRcdFx0XHRyZW5kZXJfZGV0YWlsc19lcnJvciggdHJpZ2dlciwgZ2VuZXJhdGlvbiwgb3duZXJfY29udGV4dCApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGRldGFpbHNfY2FjaGUuaGFzKCBjYWNoZV9rZXkgKSApIHtcblx0XHRcdFx0Y2FjaGVkX2RldGFpbHMgPSBkZXRhaWxzX2NhY2hlLmdldCggY2FjaGVfa2V5ICk7XG5cdFx0XHRcdGRldGFpbHNfY2FjaGUuZGVsZXRlKCBjYWNoZV9rZXkgKTtcblx0XHRcdFx0ZGV0YWlsc19jYWNoZS5zZXQoIGNhY2hlX2tleSwgY2FjaGVkX2RldGFpbHMgKTtcblx0XHRcdFx0cmVuZGVyX2RldGFpbHMoIGNhY2hlZF9kZXRhaWxzLCB0cmlnZ2VyLCBnZW5lcmF0aW9uLCBvd25lcl9jb250ZXh0ICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHJlbmRlcl9kZXRhaWxzX2xvYWRpbmcoIHRyaWdnZXIgKTtcblx0XHRcdGlmICggaW5mbGlnaHRfcmVxdWVzdHMuaGFzKCBjYWNoZV9rZXkgKSApIHtcblx0XHRcdFx0cmVxdWVzdF9lbnRyeSA9IGluZmxpZ2h0X3JlcXVlc3RzLmdldCggY2FjaGVfa2V5ICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXF1ZXN0X2VudHJ5ID0ge1xuXHRcdFx0XHRcdHJlcXVlc3Q6ICQuYWpheCgge1xuXHRcdFx0XHRcdFx0dXJsOiBTdHJpbmcoIHRyYW5zcG9ydC51cmwgKSxcblx0XHRcdFx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0XHRcdFx0ZGF0YVR5cGU6ICdqc29uJyxcblx0XHRcdFx0XHRcdGRhdGE6IHtcblx0XHRcdFx0XHRcdFx0YWN0aW9uOiBTdHJpbmcoIHRyYW5zcG9ydC5hY3Rpb24gKSxcblx0XHRcdFx0XHRcdFx0bm9uY2U6IFN0cmluZyggdHJhbnNwb3J0Lm5vbmNlICksXG5cdFx0XHRcdFx0XHRcdHNvdXJjZTogU3RyaW5nKCB0cmFuc3BvcnQuc291cmNlICksXG5cdFx0XHRcdFx0XHRcdGJvb2tpbmdfaWQ6IGJvb2tpbmdfaWRcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IClcblx0XHRcdFx0fTtcblx0XHRcdFx0aW5mbGlnaHRfcmVxdWVzdHMuc2V0KCBjYWNoZV9rZXksIHJlcXVlc3RfZW50cnkgKTtcblx0XHRcdFx0cmVxdWVzdF9lbnRyeS5yZXF1ZXN0LmFsd2F5cyggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdGlmICggaW5mbGlnaHRfcmVxdWVzdHMuZ2V0KCBjYWNoZV9rZXkgKSA9PT0gcmVxdWVzdF9lbnRyeSApIHtcblx0XHRcdFx0XHRcdGluZmxpZ2h0X3JlcXVlc3RzLmRlbGV0ZSggY2FjaGVfa2V5ICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cblx0XHRcdHJlcXVlc3RfZW50cnkucmVxdWVzdC5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0XHR2YXIgZGV0YWlscyA9IG5vcm1hbGl6ZV9kZXRhaWxzX2R0byggcmVzcG9uc2UgJiYgcmVzcG9uc2Uuc3VjY2VzcyAmJiByZXNwb25zZS5kYXRhID8gcmVzcG9uc2UuZGF0YS5vdmVydmlldyA6IG51bGwgKTtcblxuXHRcdFx0XHRpZiAoICEgZGV0YWlscyB8fCBkZXRhaWxzLmJvb2tpbmdfaWQgIT09IGJvb2tpbmdfaWQgKSB7XG5cdFx0XHRcdFx0cmVuZGVyX2RldGFpbHNfZXJyb3IoIHRyaWdnZXIsIGdlbmVyYXRpb24sIG93bmVyX2NvbnRleHQgKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBkZXRhaWxzX2NhY2hlLmhhcyggY2FjaGVfa2V5ICkgKSB7XG5cdFx0XHRcdFx0ZGV0YWlsc19jYWNoZS5kZWxldGUoIGNhY2hlX2tleSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGRldGFpbHNfY2FjaGUuc2V0KCBjYWNoZV9rZXksIGRldGFpbHMgKTtcblx0XHRcdFx0d2hpbGUgKCBtYXhpbXVtX2NhY2hlX2VudHJpZXMgPCBkZXRhaWxzX2NhY2hlLnNpemUgKSB7XG5cdFx0XHRcdFx0ZGV0YWlsc19jYWNoZS5kZWxldGUoIGRldGFpbHNfY2FjaGUua2V5cygpLm5leHQoKS52YWx1ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlbmRlcl9kZXRhaWxzKCBkZXRhaWxzLCB0cmlnZ2VyLCBnZW5lcmF0aW9uLCBvd25lcl9jb250ZXh0ICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRyZXF1ZXN0X2VudHJ5LnJlcXVlc3QuZmFpbCggZnVuY3Rpb24gKCByZXF1ZXN0LCByZXF1ZXN0X3N0YXR1cyApIHtcblx0XHRcdFx0aWYgKCAnYWJvcnQnID09PSByZXF1ZXN0X3N0YXR1cyApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAtMSAhPT0gWyA0MDEsIDQwMywgNDA0IF0uaW5kZXhPZiggTnVtYmVyKCByZXF1ZXN0ICYmIHJlcXVlc3Quc3RhdHVzICkgKSApIHtcblx0XHRcdFx0XHRjbGVhcl9kZXRhaWxzX3N0YXRlKCk7XG5cdFx0XHRcdFx0c2hhcmVkX2NvbnRyb2xsZXIucmVxdWVzdF9jbG9zZSggJ2F1dGhvcml6YXRpb25faW52YWxpZGF0aW9uJywgZmFsc2UgKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVuZGVyX2RldGFpbHNfZXJyb3IoIHRyaWdnZXIsIGdlbmVyYXRpb24sIG93bmVyX2NvbnRleHQgKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBYm9ydCBhbmQgZm9yZ2V0IG9uZSBjYWNoZWQgb3IgaW4tZmxpZ2h0IGJvb2tpbmcgcmVhZC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSAgYm9va2luZ19pZCAgICAgIEJvb2tpbmcgSUQsIG9yIHplcm8gZm9yIG5vIHNwZWNpZmljIHJlY29yZC5cblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGluY3JlbWVudF9zdGF0ZSBXaGV0aGVyIGFjdGl2ZSByZXNwb25zZSBnZW5lcmF0aW9ucyBiZWNvbWUgc3RhbGUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbnZhbGlkYXRlX2Jvb2tpbmcoIGJvb2tpbmdfaWQsIGluY3JlbWVudF9zdGF0ZSApIHtcblx0XHRcdHZhciBjYWNoZV9rZXkgPSBTdHJpbmcoIE1hdGgubWF4KCAwLCBNYXRoLnJvdW5kKCBOdW1iZXIoIGJvb2tpbmdfaWQgKSB8fCAwICkgKSApO1xuXHRcdFx0dmFyIHJlcXVlc3RfZW50cnkgPSBpbmZsaWdodF9yZXF1ZXN0cy5nZXQoIGNhY2hlX2tleSApO1xuXG5cdFx0XHRpZiAoIGluY3JlbWVudF9zdGF0ZSApIHtcblx0XHRcdFx0YWN0aXZlX2dlbmVyYXRpb24gKz0gMTtcblx0XHRcdH1cblx0XHRcdGRldGFpbHNfY2FjaGUuZGVsZXRlKCBjYWNoZV9rZXkgKTtcblx0XHRcdGlmICggcmVxdWVzdF9lbnRyeSAmJiByZXF1ZXN0X2VudHJ5LnJlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHJlcXVlc3RfZW50cnkucmVxdWVzdC5hYm9ydCApIHtcblx0XHRcdFx0cmVxdWVzdF9lbnRyeS5yZXF1ZXN0LmFib3J0KCk7XG5cdFx0XHR9XG5cdFx0XHRpbmZsaWdodF9yZXF1ZXN0cy5kZWxldGUoIGNhY2hlX2tleSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFib3J0IGFsbCBwZW5kaW5nIHJlYWRzIGFuZCBjbGVhciB0aGUgcGFnZS1tZW1vcnkgY2FjaGUuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNsZWFyX2RldGFpbHNfc3RhdGUoKSB7XG5cdFx0XHRhY3RpdmVfZ2VuZXJhdGlvbiArPSAxO1xuXHRcdFx0aW5mbGlnaHRfcmVxdWVzdHMuZm9yRWFjaCggZnVuY3Rpb24gKCByZXF1ZXN0X2VudHJ5ICkge1xuXHRcdFx0XHRpZiAoIHJlcXVlc3RfZW50cnkucmVxdWVzdCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgcmVxdWVzdF9lbnRyeS5yZXF1ZXN0LmFib3J0ICkge1xuXHRcdFx0XHRcdHJlcXVlc3RfZW50cnkucmVxdWVzdC5hYm9ydCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRpbmZsaWdodF9yZXF1ZXN0cy5jbGVhcigpO1xuXHRcdFx0ZGV0YWlsc19jYWNoZS5jbGVhcigpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc29sdmUgb25seSB0aGUgZGVkaWNhdGVkIHJlZ2lzdGVyZWQgaW5mb3JtYXRpb24gY29udHJvbC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7RXZlbnRUYXJnZXR8bnVsbH0gZXZlbnRfdGFyZ2V0IEV2ZW50IHRhcmdldC5cblx0XHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfSBSZWdpc3RlcmVkIHRyaWdnZXIsIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3RyaWdnZXIoIGV2ZW50X3RhcmdldCApIHtcblx0XHRcdHZhciBlbGVtZW50ID0gZXZlbnRfdGFyZ2V0ICYmIDEgPT09IGV2ZW50X3RhcmdldC5ub2RlVHlwZSA/IGV2ZW50X3RhcmdldCA6IG51bGw7XG5cdFx0XHR2YXIgdHJpZ2dlcjtcblxuXHRcdFx0aWYgKCAhIGVsZW1lbnQgfHwgZWxlbWVudC5jbG9zZXN0KCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLW92ZXJmbG93LXRvb2x0aXBdJyApICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHRyaWdnZXIgPSBlbGVtZW50LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctb3ZlcnZpZXctaW5mby10cmlnZ2VyXScgKTtcblxuXHRcdFx0cmV0dXJuIHRyaWdnZXIgJiYgcm9vdC5jb250YWlucyggdHJpZ2dlciApICYmIHRyaWdnZXJfZHRvcy5oYXMoIHRyaWdnZXIgKSA/IHRyaWdnZXIgOiBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFZlcmlmeSB0aGF0IGEgZGVkaWNhdGVkIHRyaWdnZXIgc3RpbGwgYmVsb25ncyB0byBpdHMgcmVnaXN0ZXJlZCBjYXJkLlxuXHRcdCAqXG5cdFx0ICogTmFycm93IFRpbWVsaW5lIHNlZ21lbnRzIG1heSBtb3ZlIHRoZSBzYW1lIGNvbnRyb2wgbm9kZSBpbnRvIGEgcm93LXNjb3BlZFxuXHRcdCAqIG92ZXJsYXkgYWZ0ZXIgbGF5b3V0LiBJbiB0aGF0IHN0YXRlIERPTSBjb250YWlubWVudCBpcyBpbnRlbnRpb25hbGx5IG5vXG5cdFx0ICogbG9uZ2VyIHRoZSBpZGVudGl0eSBib3VuZGFyeSwgc28gdGhlIGRvbWFpbi1vd25lZCBib29raW5nIElEIGFuZCBzdGFibGVcblx0XHQgKiBzZWdtZW50IGhpbnQgbXVzdCBtYXRjaCB0aGUgc2VwYXJhdGUgY2FyZCBjb250ZXh0IGV4YWN0bHkuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSB0cmlnZ2VyIERlZGljYXRlZCBpbmZvcm1hdGlvbiBjb250cm9sLlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGNhcmQgICAgU2VwYXJhdGUgVGltZWxpbmUgYm9va2luZyBjYXJkLlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGR0byAgICAgTm9ybWFsaXplZCBjb21wYWN0IGJvb2tpbmcgRFRPLlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBjb250YWlubWVudCBvciBleHBsaWNpdCBpZGVudGl0eSBwcm92ZXMgb3duZXJzaGlwLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHRyaWdnZXJfYmVsb25nc190b19jYXJkKCB0cmlnZ2VyLCBjYXJkLCBkdG8gKSB7XG5cdFx0XHR2YXIgdHJpZ2dlcl9ib29raW5nX2lkO1xuXHRcdFx0dmFyIGNhcmRfYm9va2luZ19pZDtcblx0XHRcdHZhciB0cmlnZ2VyX3NlZ21lbnRfaGludDtcblx0XHRcdHZhciBjYXJkX3NlZ21lbnRfaGludDtcblxuXHRcdFx0aWYgKCBjYXJkLmNvbnRhaW5zKCB0cmlnZ2VyICkgKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0dHJpZ2dlcl9ib29raW5nX2lkID0gTWF0aC5tYXgoIDAsIE1hdGgucm91bmQoIE51bWJlciggdHJpZ2dlci5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1pZCcgKSApIHx8IDAgKSApO1xuXHRcdFx0Y2FyZF9ib29raW5nX2lkID0gTWF0aC5tYXgoIDAsIE1hdGgucm91bmQoIE51bWJlciggY2FyZC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1pZCcgKSApIHx8IDAgKSApO1xuXHRcdFx0dHJpZ2dlcl9zZWdtZW50X2hpbnQgPSBTdHJpbmcoIHRyaWdnZXIuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXNlZ21lbnQtaGludCcgKSB8fCAnJyApO1xuXHRcdFx0Y2FyZF9zZWdtZW50X2hpbnQgPSBTdHJpbmcoIGNhcmQuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXNlZ21lbnQtaWQnICkgfHwgJycgKTtcblxuXHRcdFx0cmV0dXJuIEJvb2xlYW4oXG5cdFx0XHRcdHRyaWdnZXJfYm9va2luZ19pZFxuXHRcdFx0XHQmJiB0cmlnZ2VyX2Jvb2tpbmdfaWQgPT09IGNhcmRfYm9va2luZ19pZFxuXHRcdFx0XHQmJiB0cmlnZ2VyX2Jvb2tpbmdfaWQgPT09IE51bWJlciggZHRvLmJvb2tpbmdfaWQgKVxuXHRcdFx0XHQmJiB0cmlnZ2VyX3NlZ21lbnRfaGludFxuXHRcdFx0XHQmJiB0cmlnZ2VyX3NlZ21lbnRfaGludCA9PT0gY2FyZF9zZWdtZW50X2hpbnRcblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRGV0ZXJtaW5lIHdoZXRoZXIgYW4gYWNjZXNzaWJsZSBtb2RhbCBsYXllciBpcyB2aXNpYmx5IHJlbmRlcmVkLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGF0IGxlYXN0IG9uZSBtb2RhbCBsYXllciBpcyB2aXNpYmxlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhc192aXNpYmxlX21vZGFsX2xheWVyKCkge1xuXHRcdFx0cmV0dXJuIEFycmF5LnByb3RvdHlwZS5zb21lLmNhbGwoIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbYXJpYS1tb2RhbD1cInRydWVcIl0nICksIGZ1bmN0aW9uICggbW9kYWxfbGF5ZXIgKSB7XG5cdFx0XHRcdGlmICggbW9kYWxfbGF5ZXIuaGlkZGVuIHx8IG1vZGFsX2xheWVyLmNsb3Nlc3QoICdbaGlkZGVuXScgKSB8fCBtb2RhbF9sYXllci5jbG9zZXN0KCAnW2FyaWEtaGlkZGVuPVwidHJ1ZVwiXScgKSApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gMCA8IG1vZGFsX2xheWVyLmdldENsaWVudFJlY3RzKCkubGVuZ3RoO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIERldGVybWluZSB3aGV0aGVyIFRpbWVsaW5lIHN0YXRlIGJsb2NrcyBhIEJvb2tpbmcgT3ZlcnZpZXcgYWN0aXZhdGlvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hpbGUgYW5vdGhlciBsYXllciBvciBnZXN0dXJlIG93bnMgYXR0ZW50aW9uLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGlzX3N1cHByZXNzZWQoKSB7XG5cdFx0XHRpZiAoIGlzX3Njcm9sbGluZyApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiBjYWxsYmFja3MuaXNfc3VwcHJlc3NlZCAmJiBjYWxsYmFja3MuaXNfc3VwcHJlc3NlZCgpICkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGhhc192aXNpYmxlX21vZGFsX2xheWVyKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVuZGVyIHRoZSBmaXhlZCBib29raW5nLWRvbWFpbiB0ZW1wbGF0ZSBpbnRvIHRoZSBzaGFyZWQgc2hlbGwuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSB0cmlnZ2VyIFJlZ2lzdGVyZWQgYm9va2luZyB0cmlnZ2VyLlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBhdXRob3JpemVkIGNvbXBhY3QgY29udGVudCB3YXMgcHJlcGFyZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcHJlcGFyZV9jb250ZW50KCB0cmlnZ2VyICkge1xuXHRcdFx0dmFyIGR0byA9IHRyaWdnZXIgPyB0cmlnZ2VyX2R0b3MuZ2V0KCB0cmlnZ2VyICkgOiBudWxsO1xuXG5cdFx0XHRpZiAoICEgZHRvIHx8ICEgdHJpZ2dlci5pc0Nvbm5lY3RlZCB8fCAhIHJvb3QuY29udGFpbnMoIHRyaWdnZXIgKSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBhY3RpdmVfdHJpZ2dlciAmJiBhY3RpdmVfdHJpZ2dlciAhPT0gdHJpZ2dlciApIHtcblx0XHRcdFx0aWYgKCBzaGFyZWRfY29udHJvbGxlci5pc19waW5uZWQoKSApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2hhcmVkX2NvbnRyb2xsZXIucmVxdWVzdF9jbG9zZSggJ3Byb2dyYW1tYXRpYycsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0XHRyZW5kZXJfYm9va2luZ192aWV3KCBkdG8gKTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSGFuZCBvbmUgcmVnaXN0ZXJlZCBib29raW5nIGNhcmQgdG8gdGhlIGV4aXN0aW5nIEluc3BlY3RvciBhZGFwdGVyLlxuXHRcdCAqXG5cdFx0ICogVGhpcyBpcyB0aGUgc29sZSBib29raW5nLWRvbWFpbiBoYW5kb2ZmIHVzZWQgYnkgdGhlIGV4cGxpY2l0IHBvcG92ZXIgYWN0aW9uLlxuXHRcdCAqIEl0IGNsb3NlcyB0aGUgY3VycmVudCBvdmVydmlldyB3aXRob3V0IHJlc3RvcmluZyBmb2N1cyBhbmQgbmV2ZXIgY2hhbmdlc1xuXHRcdCAqIGJvb2tpbmcgZGF0YS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHRyaWdnZXIgUmVnaXN0ZXJlZCBib29raW5nIGluZm9ybWF0aW9uIGNvbnRyb2wuXG5cdFx0ICogQHBhcmFtIHtFdmVudHxudWxsfSAgZXZlbnQgICBPcHRpb25hbCBhY3RpdmF0aW5nIGJyb3dzZXIgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGEgY3VycmVudCByZWdpc3RlcmVkIGNhcmQgd2FzIGhhbmRlZCBvZmYuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZG9mZl90b19ib29raW5nX2luc3BlY3RvciggdHJpZ2dlciwgZXZlbnQgKSB7XG5cdFx0XHR2YXIgY2FyZCA9IHRyaWdnZXIgPyB0cmlnZ2VyX2NhcmRzLmdldCggdHJpZ2dlciApIDogbnVsbDtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHQhIHRyaWdnZXJcblx0XHRcdFx0fHwgISBjYXJkXG5cdFx0XHRcdHx8ICEgdHJpZ2dlci5pc0Nvbm5lY3RlZFxuXHRcdFx0XHR8fCAhIGNhcmQuaXNDb25uZWN0ZWRcblx0XHRcdFx0fHwgISByb290LmNvbnRhaW5zKCB0cmlnZ2VyIClcblx0XHRcdFx0fHwgISByb290LmNvbnRhaW5zKCBjYXJkIClcblx0XHRcdFx0fHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIGNhbGxiYWNrcy5vcGVuX2Jvb2tpbmdfZGV0YWlsc1xuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICggZXZlbnQgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0fVxuXHRcdFx0c2hhcmVkX2NvbnRyb2xsZXIucmVxdWVzdF9jbG9zZSggJ2luc3BlY3Rvcl9oYW5kb2ZmJywgZmFsc2UgKTtcblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNhbGxiYWNrcy5vcGVuX2Jvb2tpbmdfZGV0YWlscyApIHtcblx0XHRcdFx0Y2FsbGJhY2tzLm9wZW5fYm9va2luZ19kZXRhaWxzKCBjYXJkICk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFRvZ2dsZSBCb29raW5nIE92ZXJ2aWV3IGZyb20gYSBuYXRpdmUgaW5mb3JtYXRpb24tY29udHJvbCBhY3RpdmF0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtNb3VzZUV2ZW50fSBldmVudCBEZWxlZ2F0ZWQgY2xpY2sgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSByZWdpc3RlcmVkIG92ZXJ2aWV3IG9wZW5lZCBvciBjbG9zZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX3RyaWdnZXJfY2xpY2soIGV2ZW50ICkge1xuXHRcdFx0dmFyIHRyaWdnZXIgPSBnZXRfdHJpZ2dlciggZXZlbnQudGFyZ2V0ICk7XG5cblx0XHRcdGlmICggISB0cmlnZ2VyIHx8IGlzX3N1cHByZXNzZWQoKSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBhY3RpdmVfdHJpZ2dlciA9PT0gdHJpZ2dlciAmJiAoIHNoYXJlZF9jb250cm9sbGVyLmlzX29wZW4oKSB8fCBzaGFyZWRfY29udHJvbGxlci5pc19waW5uZWQoKSApICkge1xuXHRcdFx0XHRpZiAoIGV2ZW50ICkge1xuXHRcdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gc2hhcmVkX2NvbnRyb2xsZXIucmVxdWVzdF9jbG9zZSggJ2V4cGxpY2l0X2Nsb3NlJywgZmFsc2UgKTtcblx0XHRcdH1cblx0XHRcdGlmICggISBwcmVwYXJlX2NvbnRlbnQoIHRyaWdnZXIgKSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBldmVudCApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHNoYXJlZF9jb250cm9sbGVyLm9wZW4oIHRyaWdnZXIgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTdXBwcmVzcyBuZXcgYWN0aXZhdGlvbiB3aGlsZSBzaGFyZWQgc2Nyb2xsIHBvbGljeSByZXNvbHZlcyB0aGUgb3duZXIuXG5cdFx0ICpcblx0XHQgKiBCb3RoIHRyYW5zaWVudCBhbmQgcGlubmVkIG92ZXJ2aWV3cyByZXRhaW4gdGhlaXIgY3VycmVudCBjYW5vbmljYWwgb3duZXIuXG5cdFx0ICogVGhlIGNvYWxlc2NlZCBnZW9tZXRyeSBwYXRoIGZvbGxvd3MgYSB2aXNpYmxlIGluZm9ybWF0aW9uIGNvbnRyb2wgYW5kXG5cdFx0ICogY2xhbXBzIGFuIG9mZi1zY3JlZW4gY29udHJvbCB0byB0aGUgbmVhcmVzdCBUaW1lbGluZSBlZGdlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfc2Nyb2xsKCkge1xuXHRcdFx0aXNfc2Nyb2xsaW5nID0gdHJ1ZTtcblx0XHRcdHNoYXJlZF9jb250cm9sbGVyLmNhbmNlbF9wZW5kaW5nX29wZW4oKTtcblx0XHRcdHNjaGVkdWxlX2xpdmVfZ2VvbWV0cnlfdXBkYXRlKCk7XG5cdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCBzY3JvbGxfdGltZXIgKTtcblx0XHRcdHNjcm9sbF90aW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlzX3Njcm9sbGluZyA9IGZhbHNlO1xuXHRcdFx0XHRzY3JvbGxfdGltZXIgPSAwO1xuXHRcdFx0fSwgc2Nyb2xsX3Jlc3VtZV9kZWxheV9tcyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlY2FsY3VsYXRlIGN1cnJlbnQgb3duZXIgZ2VvbWV0cnkgYWZ0ZXIgbm9uLXNjcm9sbCBsYXlvdXQgY2hhbmdlcy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2dlb21ldHJ5X2NoYW5nZSgpIHtcblx0XHRcdHNjaGVkdWxlX2xpdmVfZ2VvbWV0cnlfdXBkYXRlKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVjYWxjdWxhdGUgYWZ0ZXIgYW4gaW1hZ2UgY2hhbmdlcyBhIHJlbmRlcmVkIGJvb2tpbmcgcm93J3MgZ2VvbWV0cnkuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCBDYXB0dXJlZCBSZXNvdXJjZSBvciBib29raW5nIGltYWdlIGxvYWQgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfZ2VvbWV0cnlfaW1hZ2VfbG9hZCggZXZlbnQgKSB7XG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldCAmJiAnSU1HJyA9PT0gZXZlbnQudGFyZ2V0Lm5vZGVOYW1lICkge1xuXHRcdFx0XHRzY2hlZHVsZV9saXZlX2dlb21ldHJ5X3VwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNlbGVjdCBhbmQgcmViaW5kIHRoZSByZXRhaW5lZCBjYW5vbmljYWwgYm9va2luZyBhZnRlciBhIGNvbXBsZXRlIHJlbmRlci5cblx0XHQgKlxuXHRcdCAqIFRoZSBzYW1lIHZpc2libGUgc2VnbWVudCBoaW50IHdpbnMuIE90aGVyd2lzZSBhbm90aGVyIHZpc2libGUgYXV0aG9yaXplZFxuXHRcdCAqIHNlZ21lbnQgd2lucywgZm9sbG93ZWQgYnkgYSBjb25uZWN0ZWQgb2ZmLXNjcmVlbiBzZWdtZW50IHRoYXQgY2FuIHJldGFpblxuXHRcdCAqIGlkZW50aXR5IHRocm91Z2ggYSBsaXZlIHJlZmVyZW5jZSB3aGlsZSB0aGUgY2FudmFzIGNsaXBzIGl0cyBzdXJmYWNlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjb21wbGV0ZV9yZWZyZXNoX3JlYmluZCgpIHtcblx0XHRcdHZhciBvd25lcl9ib29raW5nX2lkID0gcG9wb3Zlcl9zdGF0ZS5vd25lci5ib29raW5nX2lkO1xuXHRcdFx0dmFyIG93bmVyX3NlZ21lbnRfaGludCA9IHBvcG92ZXJfc3RhdGUub3duZXIuc2VnbWVudF9oaW50O1xuXHRcdFx0dmFyIGF1dGhvcml6ZWRfY2FuZGlkYXRlcztcblx0XHRcdHZhciB2aXNpYmxlX2NhbmRpZGF0ZXM7XG5cdFx0XHR2YXIgc2VsZWN0ZWRfY2FuZGlkYXRlID0gbnVsbDtcblxuXHRcdFx0aWYgKCAhIHJlZnJlc2hfcmViaW5kX3BlbmRpbmcgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHJlZnJlc2hfcmViaW5kX3BlbmRpbmcgPSBmYWxzZTtcblx0XHRcdGlmICggISBzaGFyZWRfY29udHJvbGxlci5pc19waW5uZWQoKSB8fCAhIG93bmVyX2Jvb2tpbmdfaWQgKSB7XG5cdFx0XHRcdHJlYmluZF9jYW5kaWRhdGVzID0gW107XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGF1dGhvcml6ZWRfY2FuZGlkYXRlcyA9IHJlYmluZF9jYW5kaWRhdGVzLmZpbHRlciggZnVuY3Rpb24gKCBjYW5kaWRhdGUgKSB7XG5cdFx0XHRcdHJldHVybiBjYW5kaWRhdGUuY29udGV4dC5ib29raW5nX2lkID09PSBvd25lcl9ib29raW5nX2lkXG5cdFx0XHRcdFx0JiYgY2FuZGlkYXRlLnRyaWdnZXIuaXNDb25uZWN0ZWRcblx0XHRcdFx0XHQmJiByb290LmNvbnRhaW5zKCBjYW5kaWRhdGUudHJpZ2dlciApO1xuXHRcdFx0fSApO1xuXHRcdFx0dmlzaWJsZV9jYW5kaWRhdGVzID0gYXV0aG9yaXplZF9jYW5kaWRhdGVzLmZpbHRlciggZnVuY3Rpb24gKCBjYW5kaWRhdGUgKSB7XG5cdFx0XHRcdHJldHVybiAnbGl2ZV9jb250cm9sJyA9PT0gZ2V0X3RyaWdnZXJfcmVmZXJlbmNlX3N0YXRlKCBjYW5kaWRhdGUudHJpZ2dlciApO1xuXHRcdFx0fSApO1xuXHRcdFx0c2VsZWN0ZWRfY2FuZGlkYXRlID0gdmlzaWJsZV9jYW5kaWRhdGVzLmZpbHRlciggZnVuY3Rpb24gKCBjYW5kaWRhdGUgKSB7XG5cdFx0XHRcdHJldHVybiBjYW5kaWRhdGUuY29udGV4dC5zZWdtZW50X2hpbnQgPT09IG93bmVyX3NlZ21lbnRfaGludDtcblx0XHRcdH0gKVsgMCBdIHx8IHZpc2libGVfY2FuZGlkYXRlc1sgMCBdIHx8IGF1dGhvcml6ZWRfY2FuZGlkYXRlcy5maWx0ZXIoIGZ1bmN0aW9uICggY2FuZGlkYXRlICkge1xuXHRcdFx0XHRyZXR1cm4gY2FuZGlkYXRlLmNvbnRleHQuc2VnbWVudF9oaW50ID09PSBvd25lcl9zZWdtZW50X2hpbnQ7XG5cdFx0XHR9IClbIDAgXSB8fCBhdXRob3JpemVkX2NhbmRpZGF0ZXNbIDAgXSB8fCBudWxsO1xuXHRcdFx0cmViaW5kX2NhbmRpZGF0ZXMgPSBbXTtcblx0XHRcdGlmICggISBzZWxlY3RlZF9jYW5kaWRhdGUgKSB7XG5cdFx0XHRcdHNoYXJlZF9jb250cm9sbGVyLnJlcXVlc3RfY2xvc2UoICdhdXRob3JpemF0aW9uX2ludmFsaWRhdGlvbicsIGZhbHNlICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISBzaGFyZWRfY29udHJvbGxlci5yZWJpbmRfdHJpZ2dlciggc2VsZWN0ZWRfY2FuZGlkYXRlLnRyaWdnZXIgKSApIHtcblx0XHRcdFx0c2hhcmVkX2NvbnRyb2xsZXIucmVxdWVzdF9jbG9zZSggJ2F1dGhvcml6YXRpb25faW52YWxpZGF0aW9uJywgZmFsc2UgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0YWN0aXZlX3RyaWdnZXIgPSBzZWxlY3RlZF9jYW5kaWRhdGUudHJpZ2dlcjtcblx0XHRcdHBvcG92ZXJfc3RhdGUub3duZXIgPSBzZWxlY3RlZF9jYW5kaWRhdGUuY29udGV4dDtcblx0XHRcdHNldF9wb3BvdmVyX2F4aXMoICdyZWZlcmVuY2UnLCBnZXRfdHJpZ2dlcl9yZWZlcmVuY2Vfc3RhdGUoIGFjdGl2ZV90cmlnZ2VyICkgKTtcblx0XHRcdHNldF9wb3BvdmVyX2F4aXMoICdkZXRhaWxzJywgJ2lkbGUnICk7XG5cdFx0XHRyZW5kZXJfYm9va2luZ192aWV3KCBzZWxlY3RlZF9jYW5kaWRhdGUuZHRvICk7XG5cdFx0XHRvYnNlcnZlX2FjdGl2ZV9nZW9tZXRyeSgpO1xuXHRcdFx0aWYgKFxuXHRcdFx0XHQndGVtcG9yYXJpbHlfbWlzc2luZycgIT09IHBvcG92ZXJfc3RhdGUucmVmZXJlbmNlXG5cdFx0XHRcdCYmICEgYmxvY2tpbmdfc3VzcGVuc2lvblxuXHRcdFx0XHQmJiBzaGFyZWRfY29udHJvbGxlci5pc19zdXNwZW5kZWQoKVxuXHRcdFx0XHQmJiAncmVmZXJlbmNlX3JlZnJlc2gnID09PSBzaGFyZWRfY29udHJvbGxlci5nZXRfc3VzcGVuc2lvbl9yZWFzb24oKVxuXHRcdFx0KSB7XG5cdFx0XHRcdHNoYXJlZF9jb250cm9sbGVyLnJlc3VtZSgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRzY2hlZHVsZV9saXZlX2dlb21ldHJ5X3VwZGF0ZSgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE9wZW4gdGhlIGF1dGhvcml0YXRpdmUgQm9va2luZyBJbnNwZWN0b3IgZnJvbSB0aGUgcG9wb3ZlciBhY3Rpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGV2ZW50IFBvcG92ZXIgY2xpY2sgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfcG9wb3Zlcl9jbGljayggZXZlbnQgKSB7XG5cdFx0XHR2YXIgcmV0cnlfYnV0dG9uID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctb3ZlcnZpZXctcmV0cnldJyApO1xuXHRcdFx0dmFyIG9wZW5fYnV0dG9uID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctb3ZlcnZpZXctb3Blbi1kZXRhaWxzXScgKTtcblx0XHRcdHZhciB0cmlnZ2VyID0gYWN0aXZlX3RyaWdnZXI7XG5cblx0XHRcdGlmICggcmV0cnlfYnV0dG9uICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0aGFuZGxlX3JldHJ5KCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISBvcGVuX2J1dHRvbiApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aGFuZG9mZl90b19ib29raW5nX2luc3BlY3RvciggdHJpZ2dlciwgZXZlbnQgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBGb3J3YXJkIHBpbm5lZCBob3Jpem9udGFsIGlucHV0IHRvIHRoZSBUaW1lbGluZSBjYW52YXMgc2Nyb2xsIG93bmVyLlxuXHRcdCAqXG5cdFx0ICogVW5waW5uZWQgc3VyZmFjZXMgcmVtYWluIGNhbnZhcyBkZXNjZW5kYW50cyBhbmQgdGhlcmVmb3JlIHVzZSBuYXRpdmVcblx0XHQgKiBldmVudCBidWJibGluZy4gQSBwaW5uZWQgcm9vdCBsaXZlcyB1bmRlciB0aGUgZG9jdW1lbnQgYm9keSwgc28gb25seSBpdHNcblx0XHQgKiBob3Jpem9udGFsIGdlc3R1cmUgbmVlZHMgdGhlIGRvbWFpbiBjYWxsYmFjazsgdmVydGljYWwgaW5wdXQgcmV0YWlucyB0aGVcblx0XHQgKiBuYXRpdmUgZGV0YWlsLWJvZHkgYW5kIFdvcmRQcmVzcyBkb2N1bWVudCBzY3JvbGwgY2hhaW4uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge1doZWVsRXZlbnR9IGV2ZW50IEJyb3dzZXIgd2hlZWwgZXZlbnQgb3ZlciB0aGUgcG9wb3ZlciBzdXJmYWNlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX3BvcG92ZXJfd2hlZWwoIGV2ZW50ICkge1xuXHRcdFx0aWYgKFxuXHRcdFx0XHQhIHNoYXJlZF9jb250cm9sbGVyLmlzX3Bpbm5lZCgpXG5cdFx0XHRcdHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBjYWxsYmFja3Muc2Nyb2xsX3RpbWVsaW5lXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjYWxsYmFja3Muc2Nyb2xsX3RpbWVsaW5lKCBldmVudCApICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ2xvYWQnLCBoYW5kbGVfZ2VvbWV0cnlfaW1hZ2VfbG9hZCwgdHJ1ZSApO1xuXHRcdHBvcG92ZXJfc3VyZmFjZS5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBoYW5kbGVfcG9wb3Zlcl9jbGljayApO1xuXHRcdHBvcG92ZXJfc3VyZmFjZS5hZGRFdmVudExpc3RlbmVyKCAnd2hlZWwnLCBoYW5kbGVfcG9wb3Zlcl93aGVlbCwgeyBwYXNzaXZlOiBmYWxzZSB9ICk7XG5cdFx0cm9vdC5hZGRFdmVudExpc3RlbmVyKCAnc2Nyb2xsJywgaGFuZGxlX3Njcm9sbCwgdHJ1ZSApO1xuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAnc2Nyb2xsJywgaGFuZGxlX3Njcm9sbCwgeyBwYXNzaXZlOiB0cnVlIH0gKTtcblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3Jlc2l6ZScsIGhhbmRsZV9nZW9tZXRyeV9jaGFuZ2UsIHsgcGFzc2l2ZTogdHJ1ZSB9ICk7XG5cdFx0aWYgKCB3aW5kb3cudmlzdWFsVmlld3BvcnQgKSB7XG5cdFx0XHR3aW5kb3cudmlzdWFsVmlld3BvcnQuYWRkRXZlbnRMaXN0ZW5lciggJ3Jlc2l6ZScsIGhhbmRsZV9nZW9tZXRyeV9jaGFuZ2UsIHsgcGFzc2l2ZTogdHJ1ZSB9ICk7XG5cdFx0XHR3aW5kb3cudmlzdWFsVmlld3BvcnQuYWRkRXZlbnRMaXN0ZW5lciggJ3Njcm9sbCcsIGhhbmRsZV9zY3JvbGwsIHsgcGFzc2l2ZTogdHJ1ZSB9ICk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdC8qKlxuXHRcdFx0ICogVG9nZ2xlIHRoaXMgYm9va2luZyBpbnN0YW5jZSBmcm9tIGl0cyBuYXRpdmUgaW5mb3JtYXRpb24tY29udHJvbCBjbGljay5cblx0XHRcdCAqXG5cdFx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSB0cmlnZ2VyIFJlZ2lzdGVyZWQgYm9va2luZyBpbmZvcm1hdGlvbiBjb250cm9sLlxuXHRcdFx0ICogQHBhcmFtIHtNb3VzZUV2ZW50fSAgZXZlbnQgICBOYXRpdmUgY2xpY2sgZXZlbnQuXG5cdFx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIHBvcG92ZXIgb3BlbmVkIG9yIGNsb3NlZC5cblx0XHRcdCAqL1xuXHRcdFx0b3Blbl90cmlnZ2VyOiBmdW5jdGlvbiAoIHRyaWdnZXIsIGV2ZW50ICkge1xuXHRcdFx0XHRyZXR1cm4gaGFuZGxlX3RyaWdnZXJfY2xpY2soIHtcblx0XHRcdFx0XHR0YXJnZXQ6IHRyaWdnZXIsXG5cdFx0XHRcdFx0cHJldmVudERlZmF1bHQ6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdGlmICggZXZlbnQgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGV2ZW50LnByZXZlbnREZWZhdWx0ICkge1xuXHRcdFx0XHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXHRcdFx0fSxcblx0XHRcdC8qKlxuXHRcdFx0ICogTW92ZSBrZXlib2FyZCBmb2N1cyBpbnRvIGFuIGFscmVhZHkgb3BlbiBib29raW5nIHN1cmZhY2UuXG5cdFx0XHQgKlxuXHRcdFx0ICogVGhpcyBuZXZlciBvcGVucyBhIGNsb3NlZCBzdXJmYWNlOyBjbGljayByZW1haW5zIHRoZSBvbmx5IGFjdGl2YXRpb24uXG5cdFx0XHQgKlxuXHRcdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gdHJpZ2dlciBSZWdpc3RlcmVkIGJvb2tpbmcgaW5mb3JtYXRpb24gY29udHJvbC5cblx0XHRcdCAqIEBwYXJhbSB7S2V5Ym9hcmRFdmVudH0gZXZlbnQgRm9jdXMtZW50cnkgY29tbWFuZC5cblx0XHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgY29tbWFuZCB3YXMgaGFuZGxlZC5cblx0XHRcdCAqL1xuXHRcdFx0Zm9jdXNfc3VyZmFjZTogZnVuY3Rpb24gKCB0cmlnZ2VyLCBldmVudCApIHtcblx0XHRcdFx0aWYgKCAhIHNoYXJlZF9jb250cm9sbGVyLmlzX29wZW4oKSApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gc2hhcmVkX2NvbnRyb2xsZXIuaGFuZGxlX3RyaWdnZXJfa2V5ZG93biggdHJpZ2dlciwgZXZlbnQgKTtcblx0XHRcdH0sXG5cdFx0XHQvKipcblx0XHRcdCAqIEFzc29jaWF0ZSBvbmUgaW5mb3JtYXRpb24gY29udHJvbCBhbmQgY2FyZCB3aXRoIGl0cyBvdmVydmlldyBwcm9qZWN0aW9uLlxuXHRcdFx0ICpcblx0XHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHRyaWdnZXIgRGVkaWNhdGVkIG5hdGl2ZSBpbmZvcm1hdGlvbiBjb250cm9sLlxuXHRcdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY2FyZCAgICBTZXBhcmF0ZSBUaW1lbGluZSBjYXJkL0luc3BlY3RvciBpZGVudGl0eS5cblx0XHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGR0byAgICAgICAgICAgICAgQXV0aG9yaXplZCBjb21wYWN0IGNhcmQgcHJvamVjdGlvbi5cblx0XHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIHJlc291cmNlX3N1bW1hcnkgQXV0aG9yaXplZCBUaW1lbGluZSBSZXNvdXJjZSBsaXN0IHN1bW1hcnkuXG5cdFx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdFx0ICovXG5cdFx0XHRyZWdpc3RlcjogZnVuY3Rpb24gKCB0cmlnZ2VyLCBjYXJkLCBkdG8sIHJlc291cmNlX3N1bW1hcnkgKSB7XG5cdFx0XHRcdHZhciBub3JtYWxpemVkX2R0byA9IG5vcm1hbGl6ZV9kdG8oIGR0bywgcmVzb3VyY2Vfc3VtbWFyeSApO1xuXHRcdFx0XHR2YXIgdHJpZ2dlcl9jb250ZXh0O1xuXG5cdFx0XHRcdGlmIChcblx0XHRcdFx0XHR0cmlnZ2VyXG5cdFx0XHRcdFx0JiYgY2FyZFxuXHRcdFx0XHRcdCYmIG5vcm1hbGl6ZWRfZHRvXG5cdFx0XHRcdFx0JiYgcm9vdC5jb250YWlucyggdHJpZ2dlciApXG5cdFx0XHRcdFx0JiYgcm9vdC5jb250YWlucyggY2FyZCApXG5cdFx0XHRcdFx0JiYgdHJpZ2dlcl9iZWxvbmdzX3RvX2NhcmQoIHRyaWdnZXIsIGNhcmQsIG5vcm1hbGl6ZWRfZHRvIClcblx0XHRcdFx0XHQmJiBzaGFyZWRfY29udHJvbGxlci5jYW5fdXNlX3RyaWdnZXIoIHRyaWdnZXIgKVxuXHRcdFx0XHQpIHtcblx0XHRcdFx0XHR0cmlnZ2VyX2R0b3Muc2V0KCB0cmlnZ2VyLCBub3JtYWxpemVkX2R0byApO1xuXHRcdFx0XHRcdHRyaWdnZXJfY2FyZHMuc2V0KCB0cmlnZ2VyLCBjYXJkICk7XG5cdFx0XHRcdFx0dHJpZ2dlcl9jb250ZXh0ID0ge1xuXHRcdFx0XHRcdFx0Ym9va2luZ19pZDogbm9ybWFsaXplZF9kdG8uYm9va2luZ19pZCxcblx0XHRcdFx0XHRcdHJlbmRlcl9nZW5lcmF0aW9uOiByZW5kZXJfZ2VuZXJhdGlvbixcblx0XHRcdFx0XHRcdHNlZ21lbnRfaGludDogU3RyaW5nKCBjYXJkLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1zZWdtZW50LWlkJyApIHx8ICcnIClcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdHRyaWdnZXJfY29udGV4dHMuc2V0KCB0cmlnZ2VyLCB0cmlnZ2VyX2NvbnRleHQgKTtcblx0XHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0XHRyZWZyZXNoX3JlYmluZF9wZW5kaW5nXG5cdFx0XHRcdFx0XHQmJiBzaGFyZWRfY29udHJvbGxlci5pc19waW5uZWQoKVxuXHRcdFx0XHRcdFx0JiYgcG9wb3Zlcl9zdGF0ZS5vd25lci5ib29raW5nX2lkID09PSB0cmlnZ2VyX2NvbnRleHQuYm9va2luZ19pZFxuXHRcdFx0XHRcdCkge1xuXHRcdFx0XHRcdFx0cmViaW5kX2NhbmRpZGF0ZXMucHVzaCgge1xuXHRcdFx0XHRcdFx0XHR0cmlnZ2VyOiB0cmlnZ2VyLFxuXHRcdFx0XHRcdFx0XHRjb250ZXh0OiB0cmlnZ2VyX2NvbnRleHQsXG5cdFx0XHRcdFx0XHRcdGR0bzogbm9ybWFsaXplZF9kdG9cblx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHQvKipcblx0XHRcdCAqIEZpbmFsaXplIHJldGFpbmVkLW93bmVyIGF1dGhvcml6YXRpb24gYWZ0ZXIgYWxsIGNhcmRzIGFyZSByZWdpc3RlcmVkLlxuXHRcdFx0ICpcblx0XHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0XHQgKi9cblx0XHRcdGNvbXBsZXRlX3JlZnJlc2g6IGNvbXBsZXRlX3JlZnJlc2hfcmViaW5kLFxuXHRcdFx0LyoqXG5cdFx0XHQgKiBJbnZhbGlkYXRlIHJlZ2lzdHJhdGlvbnMgYmVmb3JlIFRpbWVsaW5lIHJlcGxhY2VzIGNhcmQgbm9kZXMuXG5cdFx0XHQgKlxuXHRcdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHRcdCAqL1xuXHRcdFx0cmVmcmVzaDogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHR2YXIgcmV0YWluX3BpbiA9IHNoYXJlZF9jb250cm9sbGVyLmlzX3Bpbm5lZCgpO1xuXG5cdFx0XHRcdHJlbmRlcl9nZW5lcmF0aW9uICs9IDE7XG5cdFx0XHRcdHN0b3BfZ2VvbWV0cnlfdHJhY2tpbmcoKTtcblx0XHRcdFx0cmViaW5kX2NhbmRpZGF0ZXMgPSBbXTtcblx0XHRcdFx0cmVmcmVzaF9yZWJpbmRfcGVuZGluZyA9IHJldGFpbl9waW47XG5cdFx0XHRcdGlmICggYWN0aXZlX3RyaWdnZXIgKSB7XG5cdFx0XHRcdFx0c2V0X3BvcG92ZXJfYXhpcyggJ3Zpc2liaWxpdHknLCAndGVtcG9yYXJpbHlfc3VzcGVuZGVkJyApO1xuXHRcdFx0XHRcdHNldF9wb3BvdmVyX2F4aXMoICdyZWZlcmVuY2UnLCAndGVtcG9yYXJpbHlfbWlzc2luZycgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHJldGFpbl9waW4gKSB7XG5cdFx0XHRcdFx0c2hhcmVkX2NvbnRyb2xsZXIuc3VzcGVuZCggJ3JlZmVyZW5jZV9yZWZyZXNoJyApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHNoYXJlZF9jb250cm9sbGVyLnJlcXVlc3RfY2xvc2UoICdwcm9ncmFtbWF0aWMnLCBmYWxzZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNsZWFyX2RldGFpbHNfc3RhdGUoKTtcblx0XHRcdFx0dHJpZ2dlcl9kdG9zID0gbmV3IHdpbmRvdy5XZWFrTWFwKCk7XG5cdFx0XHRcdHRyaWdnZXJfY29udGV4dHMgPSBuZXcgd2luZG93LldlYWtNYXAoKTtcblx0XHRcdFx0dHJpZ2dlcl9jYXJkcyA9IG5ldyB3aW5kb3cuV2Vha01hcCgpO1xuXHRcdFx0fSxcblx0XHRcdC8qKlxuXHRcdFx0ICogSW52YWxpZGF0ZSBvbmUgYm9va2luZyBpbW1lZGlhdGVseSBhZnRlciBhIGNhbm9uaWNhbCBtdXRhdGlvbi5cblx0XHRcdCAqXG5cdFx0XHQgKiBAcGFyYW0ge251bWJlcn0gYm9va2luZ19pZCBNdXRhdGVkIGJvb2tpbmcgSUQuXG5cdFx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdFx0ICovXG5cdFx0XHRpbnZhbGlkYXRlOiBmdW5jdGlvbiAoIGJvb2tpbmdfaWQgKSB7XG5cdFx0XHRcdGJvb2tpbmdfaWQgPSBNYXRoLm1heCggMCwgTWF0aC5yb3VuZCggTnVtYmVyKCBib29raW5nX2lkICkgfHwgMCApICk7XG5cdFx0XHRcdGlmICggYm9va2luZ19pZCAmJiBib29raW5nX2lkID09PSBwb3BvdmVyX3N0YXRlLm93bmVyLmJvb2tpbmdfaWQgKSB7XG5cdFx0XHRcdFx0aW52YWxpZGF0ZV9ib29raW5nKCBib29raW5nX2lkLCB0cnVlICk7XG5cdFx0XHRcdFx0c2V0X3BvcG92ZXJfYXhpcyggJ2RldGFpbHMnLCAnaWRsZScgKTtcblx0XHRcdFx0XHRpZiAoIHNoYXJlZF9jb250cm9sbGVyLmlzX3Bpbm5lZCgpICkge1xuXHRcdFx0XHRcdFx0c2V0X3BvcG92ZXJfYXhpcyggJ3Zpc2liaWxpdHknLCAndGVtcG9yYXJpbHlfc3VzcGVuZGVkJyApO1xuXHRcdFx0XHRcdFx0c2hhcmVkX2NvbnRyb2xsZXIuc3VzcGVuZCggJ3JlZmVyZW5jZV9yZWZyZXNoJyApO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRzaGFyZWRfY29udHJvbGxlci5yZXF1ZXN0X2Nsb3NlKCAnYXV0aG9yaXphdGlvbl9pbnZhbGlkYXRpb24nLCBmYWxzZSApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpbnZhbGlkYXRlX2Jvb2tpbmcoIGJvb2tpbmdfaWQsIHRydWUgKTtcblx0XHRcdH0sXG5cdFx0XHQvKipcblx0XHRcdCAqIENsb3NlIHRoaXMgZG9tYWluJ3MgcG9wb3ZlciB3aXRob3V0IHJlc3RvcmluZyBmb2N1cy5cblx0XHRcdCAqXG5cdFx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdFx0ICovXG5cdFx0XHRzdXNwZW5kOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGJsb2NraW5nX3N1c3BlbnNpb24gPSB0cnVlO1xuXHRcdFx0XHRpZiAoIHNoYXJlZF9jb250cm9sbGVyLmlzX3Bpbm5lZCgpICkge1xuXHRcdFx0XHRcdHNoYXJlZF9jb250cm9sbGVyLnN1c3BlbmQoICdibG9ja2luZ19sYXllcicgKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0c2hhcmVkX2NvbnRyb2xsZXIucmVxdWVzdF9jbG9zZSggJ3Byb2dyYW1tYXRpYycsIGZhbHNlICk7XG5cdFx0XHR9LFxuXHRcdFx0LyoqXG5cdFx0XHQgKiBSZXN1bWUgYSByZXRhaW5lZCBwaW4gYWZ0ZXIgVGltZWxpbmUgYmxvY2tpbmcgc3RhdGUgaXMgcmVtb3ZlZC5cblx0XHRcdCAqXG5cdFx0XHQgKiBNaXNzaW5nIHJlcGxhY2VtZW50IGF1dGhvcml6YXRpb24gY2xvc2VzIHRoZSByZXRhaW5lZCBpZGVudGl0eSBpbnN0ZWFkXG5cdFx0XHQgKiBvZiBkaXNwbGF5aW5nIHN0YWxlIGNvbnRlbnQgYWdhaW5zdCBhIGRldGFjaGVkIHJlZmVyZW5jZS5cblx0XHRcdCAqXG5cdFx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdFx0ICovXG5cdFx0XHRyZXN1bWU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0YmxvY2tpbmdfc3VzcGVuc2lvbiA9IGZhbHNlO1xuXHRcdFx0XHRpZiAoICEgc2hhcmVkX2NvbnRyb2xsZXIuaXNfcGlubmVkKCkgfHwgISBzaGFyZWRfY29udHJvbGxlci5pc19zdXNwZW5kZWQoKSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdCEgYWN0aXZlX3RyaWdnZXJcblx0XHRcdFx0XHR8fCAhIGFjdGl2ZV90cmlnZ2VyLmlzQ29ubmVjdGVkXG5cdFx0XHRcdFx0fHwgISByb290LmNvbnRhaW5zKCBhY3RpdmVfdHJpZ2dlciApXG5cdFx0XHRcdFx0fHwgISB0cmlnZ2VyX2R0b3MuaGFzKCBhY3RpdmVfdHJpZ2dlciApXG5cdFx0XHRcdFx0fHwgISB0cmlnZ2VyX2NhcmRzLmhhcyggYWN0aXZlX3RyaWdnZXIgKVxuXHRcdFx0XHQpIHtcblx0XHRcdFx0XHRzaGFyZWRfY29udHJvbGxlci5yZXF1ZXN0X2Nsb3NlKCAnYXV0aG9yaXphdGlvbl9pbnZhbGlkYXRpb24nLCBmYWxzZSApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICd0ZW1wb3JhcmlseV9taXNzaW5nJyA9PT0gZ2V0X3RyaWdnZXJfcmVmZXJlbmNlX3N0YXRlKCBhY3RpdmVfdHJpZ2dlciApICkge1xuXHRcdFx0XHRcdHNldF9wb3BvdmVyX2F4aXMoICdyZWZlcmVuY2UnLCBnZXRfdHJpZ2dlcl9yZWZlcmVuY2Vfc3RhdGUoIGFjdGl2ZV90cmlnZ2VyICkgKTtcblx0XHRcdFx0XHRzY2hlZHVsZV9saXZlX2dlb21ldHJ5X3VwZGF0ZSgpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHNoYXJlZF9jb250cm9sbGVyLnJlc3VtZSgpICkge1xuXHRcdFx0XHRcdHNldF9wb3BvdmVyX2F4aXMoICd2aXNpYmlsaXR5JywgJ3Bpbm5lZCcgKTtcblx0XHRcdFx0XHRzZXRfcG9wb3Zlcl9heGlzKCAncmVmZXJlbmNlJywgZ2V0X3RyaWdnZXJfcmVmZXJlbmNlX3N0YXRlKCBhY3RpdmVfdHJpZ2dlciApICk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHQvKipcblx0XHRcdCAqIFJlcG9ydCB3aGV0aGVyIHRoZSBzaGFyZWQgY29udHJvbGxlciBjdXJyZW50bHkgZGlzcGxheXMgdGhpcyBvdmVydmlldy5cblx0XHRcdCAqXG5cdFx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIHBvcG92ZXIgaXMgdmlzaWJsZS5cblx0XHRcdCAqL1xuXHRcdFx0aXNfb3BlbjogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gc2hhcmVkX2NvbnRyb2xsZXIuaXNfb3BlbigpO1xuXHRcdFx0fSxcblx0XHRcdC8qKlxuXHRcdFx0ICogTm90aWZ5IHRoZSBhZGFwdGVyIGFmdGVyIFRpbWVsaW5lLW93bmVkIGxheW91dCBjaGFuZ2VzIHNldHRsZS5cblx0XHRcdCAqXG5cdFx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdFx0ICovXG5cdFx0XHR1cGRhdGVfZ2VvbWV0cnk6IHNjaGVkdWxlX2xpdmVfZ2VvbWV0cnlfdXBkYXRlLFxuXHRcdFx0LyoqXG5cdFx0XHQgKiBSZXR1cm4gdGhlIGN1cnJlbnQgaW5kZXBlbmRlbnQgcG9wb3ZlciBzdGF0ZSBheGVzLlxuXHRcdFx0ICpcblx0XHRcdCAqIEByZXR1cm4ge09iamVjdH0gRXhlY3V0YWJsZS1mcmVlIHBhZ2UtbWVtb3J5IHN0YXRlIHNuYXBzaG90LlxuXHRcdFx0ICovXG5cdFx0XHRnZXRfc3RhdGU6IGdldF9wb3BvdmVyX3N0YXRlLFxuXHRcdFx0LyoqXG5cdFx0XHQgKiBSZW1vdmUgZG9tYWluIGxpc3RlbmVycyBhbmQgZGVzdHJveSBvbmx5IHRoaXMgc2hhcmVkIGNvbnRyb2xsZXIgaW5zdGFuY2UuXG5cdFx0XHQgKlxuXHRcdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHRcdCAqL1xuXHRcdFx0ZGVzdHJveTogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCBzY3JvbGxfdGltZXIgKTtcblx0XHRcdFx0c3RvcF9nZW9tZXRyeV90cmFja2luZygpO1xuXHRcdFx0XHRjbGVhcl9kZXRhaWxzX3N0YXRlKCk7XG5cdFx0XHRcdHJvb3QucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2xvYWQnLCBoYW5kbGVfZ2VvbWV0cnlfaW1hZ2VfbG9hZCwgdHJ1ZSApO1xuXHRcdFx0XHRwb3BvdmVyX3N1cmZhY2UucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgaGFuZGxlX3BvcG92ZXJfY2xpY2sgKTtcblx0XHRcdFx0cG9wb3Zlcl9zdXJmYWNlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICd3aGVlbCcsIGhhbmRsZV9wb3BvdmVyX3doZWVsICk7XG5cdFx0XHRcdHJvb3QucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3Njcm9sbCcsIGhhbmRsZV9zY3JvbGwsIHRydWUgKTtcblx0XHRcdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdzY3JvbGwnLCBoYW5kbGVfc2Nyb2xsICk7XG5cdFx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCAncmVzaXplJywgaGFuZGxlX2dlb21ldHJ5X2NoYW5nZSApO1xuXHRcdFx0XHRpZiAoIHdpbmRvdy52aXN1YWxWaWV3cG9ydCApIHtcblx0XHRcdFx0XHR3aW5kb3cudmlzdWFsVmlld3BvcnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3Jlc2l6ZScsIGhhbmRsZV9nZW9tZXRyeV9jaGFuZ2UgKTtcblx0XHRcdFx0XHR3aW5kb3cudmlzdWFsVmlld3BvcnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3Njcm9sbCcsIGhhbmRsZV9zY3JvbGwgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzaGFyZWRfY29udHJvbGxlci5kZXN0cm95KCk7XG5cdFx0XHRcdGdlb21ldHJ5X3Jlc2l6ZV9vYnNlcnZlciA9IG51bGw7XG5cdFx0XHRcdHJlYmluZF9jYW5kaWRhdGVzID0gW107XG5cdFx0XHRcdHRyaWdnZXJfZHRvcyA9IG5ldyB3aW5kb3cuV2Vha01hcCgpO1xuXHRcdFx0XHR0cmlnZ2VyX2NvbnRleHRzID0gbmV3IHdpbmRvdy5XZWFrTWFwKCk7XG5cdFx0XHRcdHRyaWdnZXJfY2FyZHMgPSBuZXcgd2luZG93LldlYWtNYXAoKTtcblx0XHRcdFx0YWN0aXZlX3RyaWdnZXIgPSBudWxsO1xuXHRcdFx0XHRwb3BvdmVyX3N0YXRlID0gY3JlYXRlX2VtcHR5X3BvcG92ZXJfc3RhdGUoKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBhIFRpbWVsaW5lLXNjb3BlZCBtYW5hZ2VyIHRoYXQgbGF6aWx5IG93bnMgb25lIHBvcG92ZXIgcGVyIGJvb2tpbmcuXG5cdCAqXG5cdCAqIEEgY29udHJvbGxlciBpcyBhbGxvY2F0ZWQgb25seSBhZnRlciBpdHMgaW5mb3JtYXRpb24gYnV0dG9uIGlzIGNsaWNrZWQuXG5cdCAqIFNlcGFyYXRlIGJvb2tpbmcgY29udHJvbGxlcnMgY2FuIHRoZXJlZm9yZSByZW1haW4gdmlzaWJsZSB0b2dldGhlciB3aXRob3V0XG5cdCAqIGNyZWF0aW5nIGRvY3VtZW50IGxpc3RlbmVycyBmb3IgZXZlcnkgcmVuZGVyZWQgY2FyZCB1cCBmcm9udC5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm9vdCAgICAgICAgICBUaW1lbGluZSByb290IGNvbnRhaW5pbmcgYm9va2luZyB0cmlnZ2Vycy5cblx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgY29uZmlndXJhdGlvbiBFeGVjdXRhYmxlLWZyZWUgc2VydmVyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGNhbGxiYWNrcyAgICAgVGltZWxpbmUgc3VwcHJlc3Npb24gYW5kIEluc3BlY3RvciBob29rcy5cblx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IE11bHRpLWJvb2tpbmcgYWRhcHRlciBBUEksIG9yIG51bGwgd2hlbiB1bmF2YWlsYWJsZS5cblx0ICovXG5cdGZ1bmN0aW9uIGNyZWF0ZV9jb250cm9sbGVyKCByb290LCBjb25maWd1cmF0aW9uLCBjYWxsYmFja3MgKSB7XG5cdFx0Y29uZmlndXJhdGlvbiA9IGNvbmZpZ3VyYXRpb24gfHwge307XG5cdFx0Y2FsbGJhY2tzID0gY2FsbGJhY2tzIHx8IHt9O1xuXHRcdGlmIChcblx0XHRcdCEgcm9vdFxuXHRcdFx0fHwgISBjb25maWd1cmF0aW9uLmFjdGl2ZVxuXHRcdFx0fHwgISB3aW5kb3cud3BiY19zaGFyZWRfdWlfY29udGV4dF9wb3BvdmVyXG5cdFx0XHR8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LndwYmNfc2hhcmVkX3VpX2NvbnRleHRfcG9wb3Zlci5jcmVhdGVcblx0XHQpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHZhciBiYXNlX2NvbXBvbmVudF9pZCA9IFN0cmluZyggY29uZmlndXJhdGlvbi5jb21wb25lbnRfaWQgfHwgJycgKS5yZXBsYWNlKCAvW15BLVphLXowLTlfLV0vZywgJycgKTtcblx0XHR2YXIgYm9va2luZ19jb250cm9sbGVycyA9IG5ldyB3aW5kb3cuTWFwKCk7XG5cdFx0dmFyIGJvb2tpbmdfcmVnaXN0cmF0aW9ucyA9IG5ldyB3aW5kb3cuTWFwKCk7XG5cdFx0dmFyIHRyaWdnZXJfYm9va2luZ19pZHMgPSBuZXcgd2luZG93LldlYWtNYXAoKTtcblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBvbmUgcG9zaXRpdmUgYm9va2luZyBpZGVudGl0eS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Kn0gY2FuZGlkYXRlIENhbmRpZGF0ZSBib29raW5nIGlkZW50aXR5LlxuXHRcdCAqIEByZXR1cm4ge251bWJlcn0gUG9zaXRpdmUgaW50ZWdlciBib29raW5nIElELCBvciB6ZXJvLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG5vcm1hbGl6ZV9ib29raW5nX2lkKCBjYW5kaWRhdGUgKSB7XG5cdFx0XHRyZXR1cm4gTWF0aC5tYXgoIDAsIE1hdGgucm91bmQoIE51bWJlciggY2FuZGlkYXRlICkgfHwgMCApICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQnVpbGQgYW4gaXNvbGF0ZWQgY29uZmlndXJhdGlvbiBmb3Igb25lIGJvb2tpbmctb3duZWQgc3VyZmFjZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBib29raW5nX2lkIENhbm9uaWNhbCBib29raW5nIGlkZW50aXR5LlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gUGVyLWluc3RhbmNlIGNvbmZpZ3VyYXRpb24uXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY3JlYXRlX2luc3RhbmNlX2NvbmZpZ3VyYXRpb24oIGJvb2tpbmdfaWQgKSB7XG5cdFx0XHR2YXIgaW5zdGFuY2VfY29uZmlndXJhdGlvbiA9IHt9O1xuXHRcdFx0dmFyIGluc3RhbmNlX2lkID0gYmFzZV9jb21wb25lbnRfaWQgKyAnX19ib29raW5nXycgKyBib29raW5nX2lkO1xuXG5cdFx0XHRPYmplY3Qua2V5cyggY29uZmlndXJhdGlvbiApLmZvckVhY2goIGZ1bmN0aW9uICggY29uZmlndXJhdGlvbl9rZXkgKSB7XG5cdFx0XHRcdGluc3RhbmNlX2NvbmZpZ3VyYXRpb25bIGNvbmZpZ3VyYXRpb25fa2V5IF0gPSBjb25maWd1cmF0aW9uWyBjb25maWd1cmF0aW9uX2tleSBdO1xuXHRcdFx0fSApO1xuXHRcdFx0aW5zdGFuY2VfY29uZmlndXJhdGlvbi5jb21wb25lbnRfaWQgPSBpbnN0YW5jZV9pZDtcblx0XHRcdGluc3RhbmNlX2NvbmZpZ3VyYXRpb24ub3duZXJfaWQgPSBpbnN0YW5jZV9pZDtcblx0XHRcdGluc3RhbmNlX2NvbmZpZ3VyYXRpb24uaW50ZXJhY3Rpb25fZ3JvdXAgPSBpbnN0YW5jZV9pZDtcblxuXHRcdFx0cmV0dXJuIGluc3RhbmNlX2NvbmZpZ3VyYXRpb247XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVnaXN0ZXIgZXZlcnkgY3VycmVudCBzZWdtZW50IGZvciBhIG5ld2x5IGFsbG9jYXRlZCBib29raW5nIGNvbnRyb2xsZXIuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gYm9va2luZ19pZCBDYW5vbmljYWwgYm9va2luZyBpZGVudGl0eS5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gY29udHJvbGxlciBCb29raW5nIGluc3RhbmNlIGNvbnRyb2xsZXIuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZWdpc3Rlcl9jdXJyZW50X3NlZ21lbnRzKCBib29raW5nX2lkLCBjb250cm9sbGVyICkge1xuXHRcdFx0dmFyIHJlZ2lzdHJhdGlvbnMgPSBib29raW5nX3JlZ2lzdHJhdGlvbnMuZ2V0KCBib29raW5nX2lkICkgfHwgW107XG5cblx0XHRcdHJlZ2lzdHJhdGlvbnMuZm9yRWFjaCggZnVuY3Rpb24gKCByZWdpc3RyYXRpb24gKSB7XG5cdFx0XHRcdGNvbnRyb2xsZXIucmVnaXN0ZXIoXG5cdFx0XHRcdFx0cmVnaXN0cmF0aW9uLnRyaWdnZXIsXG5cdFx0XHRcdFx0cmVnaXN0cmF0aW9uLmNhcmQsXG5cdFx0XHRcdFx0cmVnaXN0cmF0aW9uLmR0byxcblx0XHRcdFx0XHRyZWdpc3RyYXRpb24ucmVzb3VyY2Vfc3VtbWFyeVxuXHRcdFx0XHQpO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc29sdmUgb3IgbGF6aWx5IGNyZWF0ZSBvbmUgYm9va2luZy1vd25lZCBwb3BvdmVyIGNvbnRyb2xsZXIuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gYm9va2luZ19pZCBDYW5vbmljYWwgYm9va2luZyBpZGVudGl0eS5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gQm9va2luZyBpbnN0YW5jZSBjb250cm9sbGVyLCBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9ib29raW5nX2NvbnRyb2xsZXIoIGJvb2tpbmdfaWQgKSB7XG5cdFx0XHR2YXIgY29udHJvbGxlciA9IGJvb2tpbmdfY29udHJvbGxlcnMuZ2V0KCBib29raW5nX2lkICkgfHwgbnVsbDtcblxuXHRcdFx0aWYgKCBjb250cm9sbGVyICkge1xuXHRcdFx0XHRyZXR1cm4gY29udHJvbGxlcjtcblx0XHRcdH1cblx0XHRcdGNvbnRyb2xsZXIgPSBjcmVhdGVfaW5zdGFuY2VfY29udHJvbGxlcihcblx0XHRcdFx0cm9vdCxcblx0XHRcdFx0Y3JlYXRlX2luc3RhbmNlX2NvbmZpZ3VyYXRpb24oIGJvb2tpbmdfaWQgKSxcblx0XHRcdFx0Y2FsbGJhY2tzXG5cdFx0XHQpO1xuXHRcdFx0aWYgKCAhIGNvbnRyb2xsZXIgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0Ym9va2luZ19jb250cm9sbGVycy5zZXQoIGJvb2tpbmdfaWQsIGNvbnRyb2xsZXIgKTtcblx0XHRcdHJlZ2lzdGVyX2N1cnJlbnRfc2VnbWVudHMoIGJvb2tpbmdfaWQsIGNvbnRyb2xsZXIgKTtcblxuXHRcdFx0cmV0dXJuIGNvbnRyb2xsZXI7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogVG9nZ2xlIG9ubHkgZnJvbSBhIG5hdGl2ZSBjbGljayBvbiBhIHJlZ2lzdGVyZWQgaW5mb3JtYXRpb24gYnV0dG9uLlxuXHRcdCAqXG5cdFx0ICogTmF0aXZlIGJ1dHRvbiBhY3RpdmF0aW9uIHByZXNlcnZlcyBFbnRlciBhbmQgU3BhY2Uga2V5Ym9hcmQgYWNjZXNzIHdoaWxlXG5cdFx0ICogcG9pbnRlciBob3ZlciBhbmQgZm9jdXMgYWxvbmUgZGVsaWJlcmF0ZWx5IHBlcmZvcm0gbm8gb3BlbmluZyBhY3Rpb24uIEFcblx0XHQgKiBzZWNvbmQgY2xpY2sgb24gdGhlIHNhbWUgYnV0dG9uIGNsb3NlcyBvbmx5IHRoYXQgYm9va2luZydzIGluc3RhbmNlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtNb3VzZUV2ZW50fSBldmVudCBEZWxlZ2F0ZWQgVGltZWxpbmUgY2xpY2suXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfdHJpZ2dlcl9jbGljayggZXZlbnQgKSB7XG5cdFx0XHR2YXIgZWxlbWVudCA9IGV2ZW50LnRhcmdldCAmJiAxID09PSBldmVudC50YXJnZXQubm9kZVR5cGUgPyBldmVudC50YXJnZXQgOiBudWxsO1xuXHRcdFx0dmFyIHRyaWdnZXIgPSBlbGVtZW50ID8gZWxlbWVudC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1ib29raW5nLW92ZXJ2aWV3LWluZm8tdHJpZ2dlcl0nICkgOiBudWxsO1xuXHRcdFx0dmFyIGJvb2tpbmdfaWQ7XG5cdFx0XHR2YXIgY29udHJvbGxlcjtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHQhIHRyaWdnZXJcblx0XHRcdFx0fHwgISByb290LmNvbnRhaW5zKCB0cmlnZ2VyIClcblx0XHRcdFx0fHwgZWxlbWVudC5jbG9zZXN0KCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLW92ZXJmbG93LXRvb2x0aXBdJyApXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Ym9va2luZ19pZCA9IG5vcm1hbGl6ZV9ib29raW5nX2lkKCB0cmlnZ2VyX2Jvb2tpbmdfaWRzLmdldCggdHJpZ2dlciApICk7XG5cdFx0XHRjb250cm9sbGVyID0gYm9va2luZ19pZCA/IGdldF9ib29raW5nX2NvbnRyb2xsZXIoIGJvb2tpbmdfaWQgKSA6IG51bGw7XG5cdFx0XHRpZiAoIGNvbnRyb2xsZXIgKSB7XG5cdFx0XHRcdGNvbnRyb2xsZXIub3Blbl90cmlnZ2VyKCB0cmlnZ2VyLCBldmVudCApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE1vdmUgZm9jdXMgaW50byBhbiBhbHJlYWR5IGNsaWNrZWQgb3ZlcnZpZXcgd2l0aG91dCBvcGVuaW5nIG9uIGZvY3VzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBldmVudCBEZWxlZ2F0ZWQgVGltZWxpbmUga2V5ZG93bi5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV90cmlnZ2VyX2tleWRvd24oIGV2ZW50ICkge1xuXHRcdFx0dmFyIGVsZW1lbnQgPSBldmVudC50YXJnZXQgJiYgMSA9PT0gZXZlbnQudGFyZ2V0Lm5vZGVUeXBlID8gZXZlbnQudGFyZ2V0IDogbnVsbDtcblx0XHRcdHZhciB0cmlnZ2VyID0gZWxlbWVudCA/IGVsZW1lbnQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1vdmVydmlldy1pbmZvLXRyaWdnZXJdJyApIDogbnVsbDtcblx0XHRcdHZhciBib29raW5nX2lkID0gdHJpZ2dlciA/IG5vcm1hbGl6ZV9ib29raW5nX2lkKCB0cmlnZ2VyX2Jvb2tpbmdfaWRzLmdldCggdHJpZ2dlciApICkgOiAwO1xuXHRcdFx0dmFyIGNvbnRyb2xsZXIgPSBib29raW5nX2lkID8gYm9va2luZ19jb250cm9sbGVycy5nZXQoIGJvb2tpbmdfaWQgKSA6IG51bGw7XG5cblx0XHRcdGlmICggY29udHJvbGxlciAmJiBjb250cm9sbGVyLmlzX29wZW4oKSApIHtcblx0XHRcdFx0Y29udHJvbGxlci5mb2N1c19zdXJmYWNlKCB0cmlnZ2VyLCBldmVudCApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgaGFuZGxlX3RyaWdnZXJfY2xpY2sgKTtcblx0XHRyb290LmFkZEV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgaGFuZGxlX3RyaWdnZXJfa2V5ZG93biwgdHJ1ZSApO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdC8qKlxuXHRcdFx0ICogUmVnaXN0ZXIgb25lIGN1cnJlbnRseSByZW5kZXJlZCBib29raW5nIHNlZ21lbnQuXG5cdFx0XHQgKlxuXHRcdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gdHJpZ2dlciAgICAgICAgICBJbmZvcm1hdGlvbiBidXR0b24uXG5cdFx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjYXJkICAgICAgICAgICAgIFRpbWVsaW5lIGJvb2tpbmcgY2FyZC5cblx0XHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGR0byAgICAgICAgICAgICAgQXV0aG9yaXplZCBjb21wYWN0IERUTy5cblx0XHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIHJlc291cmNlX3N1bW1hcnkgQXV0aG9yaXplZCBSZXNvdXJjZSBzdW1tYXJ5LlxuXHRcdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHRcdCAqL1xuXHRcdFx0cmVnaXN0ZXI6IGZ1bmN0aW9uICggdHJpZ2dlciwgY2FyZCwgZHRvLCByZXNvdXJjZV9zdW1tYXJ5ICkge1xuXHRcdFx0XHR2YXIgYm9va2luZ19pZCA9IG5vcm1hbGl6ZV9ib29raW5nX2lkKCBkdG8gJiYgZHRvLmJvb2tpbmdfaWQgKTtcblx0XHRcdFx0dmFyIHJlZ2lzdHJhdGlvbnM7XG5cdFx0XHRcdHZhciBjb250cm9sbGVyO1xuXG5cdFx0XHRcdGlmICggISBib29raW5nX2lkIHx8ICEgdHJpZ2dlciB8fCAhIGNhcmQgfHwgISByb290LmNvbnRhaW5zKCB0cmlnZ2VyICkgfHwgISByb290LmNvbnRhaW5zKCBjYXJkICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlZ2lzdHJhdGlvbnMgPSBib29raW5nX3JlZ2lzdHJhdGlvbnMuZ2V0KCBib29raW5nX2lkICkgfHwgW107XG5cdFx0XHRcdHJlZ2lzdHJhdGlvbnMucHVzaCgge1xuXHRcdFx0XHRcdHRyaWdnZXI6IHRyaWdnZXIsXG5cdFx0XHRcdFx0Y2FyZDogY2FyZCxcblx0XHRcdFx0XHRkdG86IGR0byxcblx0XHRcdFx0XHRyZXNvdXJjZV9zdW1tYXJ5OiByZXNvdXJjZV9zdW1tYXJ5IHx8IHt9XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0Ym9va2luZ19yZWdpc3RyYXRpb25zLnNldCggYm9va2luZ19pZCwgcmVnaXN0cmF0aW9ucyApO1xuXHRcdFx0XHR0cmlnZ2VyX2Jvb2tpbmdfaWRzLnNldCggdHJpZ2dlciwgYm9va2luZ19pZCApO1xuXHRcdFx0XHRjb250cm9sbGVyID0gYm9va2luZ19jb250cm9sbGVycy5nZXQoIGJvb2tpbmdfaWQgKTtcblx0XHRcdFx0aWYgKCBjb250cm9sbGVyICkge1xuXHRcdFx0XHRcdGNvbnRyb2xsZXIucmVnaXN0ZXIoIHRyaWdnZXIsIGNhcmQsIGR0bywgcmVzb3VyY2Vfc3VtbWFyeSB8fCB7fSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0LyoqXG5cdFx0XHQgKiBQcmVwYXJlIGV2ZXJ5IGFsbG9jYXRlZCBjb250cm9sbGVyIGZvciBhIFRpbWVsaW5lIHJlcmVuZGVyLlxuXHRcdFx0ICpcblx0XHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0XHQgKi9cblx0XHRcdHJlZnJlc2g6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0Ym9va2luZ19jb250cm9sbGVycy5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbnRyb2xsZXIgKSB7XG5cdFx0XHRcdFx0Y29udHJvbGxlci5yZWZyZXNoKCk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0Ym9va2luZ19yZWdpc3RyYXRpb25zLmNsZWFyKCk7XG5cdFx0XHRcdHRyaWdnZXJfYm9va2luZ19pZHMgPSBuZXcgd2luZG93LldlYWtNYXAoKTtcblx0XHRcdH0sXG5cdFx0XHQvKipcblx0XHRcdCAqIENvbXBsZXRlIGF1dGhvcml6YXRpb24tYXdhcmUgdHJpZ2dlciByZWJpbmRpbmcgYWZ0ZXIgYSByZXJlbmRlci5cblx0XHRcdCAqXG5cdFx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdFx0ICovXG5cdFx0XHRjb21wbGV0ZV9yZWZyZXNoOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGJvb2tpbmdfY29udHJvbGxlcnMuZm9yRWFjaCggZnVuY3Rpb24gKCBjb250cm9sbGVyICkge1xuXHRcdFx0XHRcdGNvbnRyb2xsZXIuY29tcGxldGVfcmVmcmVzaCgpO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9LFxuXHRcdFx0LyoqXG5cdFx0XHQgKiBJbnZhbGlkYXRlIGNhY2hlZCBkYXRhIGZvciBvbmUgYm9va2luZyBjb250cm9sbGVyLlxuXHRcdFx0ICpcblx0XHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBib29raW5nX2lkIENhbm9uaWNhbCBib29raW5nIGlkZW50aXR5LlxuXHRcdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHRcdCAqL1xuXHRcdFx0aW52YWxpZGF0ZTogZnVuY3Rpb24gKCBib29raW5nX2lkICkge1xuXHRcdFx0XHR2YXIgY29udHJvbGxlciA9IGJvb2tpbmdfY29udHJvbGxlcnMuZ2V0KCBub3JtYWxpemVfYm9va2luZ19pZCggYm9va2luZ19pZCApICk7XG5cblx0XHRcdFx0aWYgKCBjb250cm9sbGVyICkge1xuXHRcdFx0XHRcdGNvbnRyb2xsZXIuaW52YWxpZGF0ZSggYm9va2luZ19pZCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0LyoqXG5cdFx0XHQgKiBTdXNwZW5kIGV2ZXJ5IGFsbG9jYXRlZCBib29raW5nIHN1cmZhY2UgZHVyaW5nIGJsb2NraW5nIFRpbWVsaW5lIHdvcmsuXG5cdFx0XHQgKlxuXHRcdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHRcdCAqL1xuXHRcdFx0c3VzcGVuZDogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRib29raW5nX2NvbnRyb2xsZXJzLmZvckVhY2goIGZ1bmN0aW9uICggY29udHJvbGxlciApIHtcblx0XHRcdFx0XHRjb250cm9sbGVyLnN1c3BlbmQoKTtcblx0XHRcdFx0fSApO1xuXHRcdFx0fSxcblx0XHRcdC8qKlxuXHRcdFx0ICogUmVzdW1lIGV2ZXJ5IHNhZmVseSByZXRhaW5lZCBib29raW5nIHN1cmZhY2UuXG5cdFx0XHQgKlxuXHRcdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHRcdCAqL1xuXHRcdFx0cmVzdW1lOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGJvb2tpbmdfY29udHJvbGxlcnMuZm9yRWFjaCggZnVuY3Rpb24gKCBjb250cm9sbGVyICkge1xuXHRcdFx0XHRcdGNvbnRyb2xsZXIucmVzdW1lKCk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdH0sXG5cdFx0XHQvKipcblx0XHRcdCAqIFJlY2FsY3VsYXRlIGV2ZXJ5IHZpc2libGUgYm9va2luZyBzdXJmYWNlIGFmdGVyIFRpbWVsaW5lIGdlb21ldHJ5IGNoYW5nZXMuXG5cdFx0XHQgKlxuXHRcdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHRcdCAqL1xuXHRcdFx0dXBkYXRlX2dlb21ldHJ5OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGJvb2tpbmdfY29udHJvbGxlcnMuZm9yRWFjaCggZnVuY3Rpb24gKCBjb250cm9sbGVyICkge1xuXHRcdFx0XHRcdGNvbnRyb2xsZXIudXBkYXRlX2dlb21ldHJ5KCk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdH0sXG5cdFx0XHQvKipcblx0XHRcdCAqIFJlcG9ydCB3aGV0aGVyIGF0IGxlYXN0IG9uZSBib29raW5nIHN1cmZhY2UgaXMgb3Blbi5cblx0XHRcdCAqXG5cdFx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gYXQgbGVhc3Qgb25lIGJvb2tpbmcgc3VyZmFjZSBpcyBvcGVuLlxuXHRcdFx0ICovXG5cdFx0XHRpc19vcGVuOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHZhciBpc19vcGVuID0gZmFsc2U7XG5cblx0XHRcdFx0Ym9va2luZ19jb250cm9sbGVycy5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbnRyb2xsZXIgKSB7XG5cdFx0XHRcdFx0aXNfb3BlbiA9IGlzX29wZW4gfHwgY29udHJvbGxlci5pc19vcGVuKCk7XG5cdFx0XHRcdH0gKTtcblxuXHRcdFx0XHRyZXR1cm4gaXNfb3Blbjtcblx0XHRcdH0sXG5cdFx0XHQvKipcblx0XHRcdCAqIERlc3Ryb3kgZXZlcnkgYm9va2luZyBzdXJmYWNlIGFuZCBtYW5hZ2VyLW93bmVkIGxpc3RlbmVyLlxuXHRcdFx0ICpcblx0XHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0XHQgKi9cblx0XHRcdGRlc3Ryb3k6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cm9vdC5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2xpY2snLCBoYW5kbGVfdHJpZ2dlcl9jbGljayApO1xuXHRcdFx0XHRyb290LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgaGFuZGxlX3RyaWdnZXJfa2V5ZG93biwgdHJ1ZSApO1xuXHRcdFx0XHRib29raW5nX2NvbnRyb2xsZXJzLmZvckVhY2goIGZ1bmN0aW9uICggY29udHJvbGxlciApIHtcblx0XHRcdFx0XHRjb250cm9sbGVyLmRlc3Ryb3koKTtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRib29raW5nX2NvbnRyb2xsZXJzLmNsZWFyKCk7XG5cdFx0XHRcdGJvb2tpbmdfcmVnaXN0cmF0aW9ucy5jbGVhcigpO1xuXHRcdFx0XHR0cmlnZ2VyX2Jvb2tpbmdfaWRzID0gbmV3IHdpbmRvdy5XZWFrTWFwKCk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHdpbmRvdy53cGJjX2Jvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcC5jcmVhdGVfY29udHJvbGxlciA9IGNyZWF0ZV9jb250cm9sbGVyO1xufSggd2luZG93LCBkb2N1bWVudCwgd2luZG93LndwLCB3aW5kb3cualF1ZXJ5ICkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0UsV0FBV0EsTUFBTSxFQUFFQyxRQUFRLEVBQUVDLEVBQUUsRUFBRUMsQ0FBQyxFQUFHO0VBQ3RDLFlBQVk7O0VBRVpILE1BQU0sQ0FBQ0ksNkJBQTZCLEdBQUdKLE1BQU0sQ0FBQ0ksNkJBQTZCLElBQUksQ0FBQyxDQUFDOztFQUVqRjtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0MsMEJBQTBCQSxDQUFFQyxJQUFJLEVBQUVDLGFBQWEsRUFBRUMsU0FBUyxFQUFHO0lBQ3JFRCxhQUFhLEdBQUdBLGFBQWEsSUFBSSxDQUFDLENBQUM7SUFDbkNDLFNBQVMsR0FBR0EsU0FBUyxJQUFJLENBQUMsQ0FBQztJQUMzQixJQUNDLENBQUVGLElBQUksSUFDSCxDQUFFQyxhQUFhLENBQUNFLE1BQU0sSUFDdEIsQ0FBRVAsRUFBRSxJQUNKLENBQUVDLENBQUMsSUFDSCxVQUFVLEtBQUssT0FBT0QsRUFBRSxDQUFDUSxRQUFRLElBQ2pDLENBQUVWLE1BQU0sQ0FBQ1csOEJBQThCLElBQ3ZDLFVBQVUsS0FBSyxPQUFPWCxNQUFNLENBQUNXLDhCQUE4QixDQUFDQyxNQUFNLEVBQ3BFO01BQ0QsT0FBTyxJQUFJO0lBQ1o7SUFFQSxJQUFJRixRQUFRLEdBQUdSLEVBQUUsQ0FBQ1EsUUFBUSxDQUFFRyxNQUFNLENBQUVOLGFBQWEsQ0FBQ08sV0FBVyxJQUFJLEVBQUcsQ0FBRSxDQUFDO0lBQ3ZFLElBQUlDLGVBQWUsR0FBR2IsRUFBRSxDQUFDUSxRQUFRLENBQUVHLE1BQU0sQ0FBRU4sYUFBYSxDQUFDUyxrQkFBa0IsSUFBSSxFQUFHLENBQUUsQ0FBQztJQUNyRixJQUFJQyxnQkFBZ0IsR0FBR2YsRUFBRSxDQUFDUSxRQUFRLENBQUVHLE1BQU0sQ0FBRU4sYUFBYSxDQUFDVyxtQkFBbUIsSUFBSSxFQUFHLENBQUUsQ0FBQztJQUN2RixJQUFJQyxnQkFBZ0IsR0FBR2pCLEVBQUUsQ0FBQ1EsUUFBUSxDQUFFRyxNQUFNLENBQUVOLGFBQWEsQ0FBQ2EsbUJBQW1CLElBQUksRUFBRyxDQUFFLENBQUM7SUFDdkYsSUFBSUMsZ0JBQWdCLEdBQUduQixFQUFFLENBQUNRLFFBQVEsQ0FBRUcsTUFBTSxDQUFFTixhQUFhLENBQUNlLG1CQUFtQixJQUFJLEVBQUcsQ0FBRSxDQUFDO0lBQ3ZGLElBQUlDLGNBQWMsR0FBR3JCLEVBQUUsQ0FBQ1EsUUFBUSxDQUFFRyxNQUFNLENBQUVOLGFBQWEsQ0FBQ2lCLGlCQUFpQixJQUFJLEVBQUcsQ0FBRSxDQUFDO0lBQ25GLElBQUlDLElBQUksR0FBR2xCLGFBQWEsQ0FBQ2tCLElBQUksSUFBSSxRQUFRLEtBQUssT0FBT2xCLGFBQWEsQ0FBQ2tCLElBQUksR0FBR2xCLGFBQWEsQ0FBQ2tCLElBQUksR0FBRyxDQUFDLENBQUM7SUFDakcsSUFBSUMsU0FBUyxHQUFHbkIsYUFBYSxDQUFDbUIsU0FBUyxJQUFJLFFBQVEsS0FBSyxPQUFPbkIsYUFBYSxDQUFDbUIsU0FBUyxHQUFHbkIsYUFBYSxDQUFDbUIsU0FBUyxHQUFHLENBQUMsQ0FBQztJQUNySCxJQUFJQyxzQkFBc0IsR0FBR0MsZUFBZSxDQUFFckIsYUFBYSxDQUFDb0Isc0JBQXNCLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxJQUFLLENBQUM7SUFDcEcsSUFBSUUsb0JBQW9CLEdBQUd2QixJQUFJLENBQUN3QixhQUFhLENBQUUsNkJBQThCLENBQUM7SUFDOUUsSUFBSUMsV0FBVyxHQUFHekIsSUFBSSxDQUFDd0IsYUFBYSxDQUFFLDBDQUEyQyxDQUFDO0lBQ2xGLElBQUlFLFlBQVksR0FBRyxJQUFJaEMsTUFBTSxDQUFDaUMsT0FBTyxDQUFDLENBQUM7SUFDdkMsSUFBSUMsZ0JBQWdCLEdBQUcsSUFBSWxDLE1BQU0sQ0FBQ2lDLE9BQU8sQ0FBQyxDQUFDO0lBQzNDLElBQUlFLGFBQWEsR0FBRyxJQUFJbkMsTUFBTSxDQUFDaUMsT0FBTyxDQUFDLENBQUM7SUFDeEMsSUFBSUcsY0FBYyxHQUFHLElBQUk7SUFDekIsSUFBSUMsaUJBQWlCLEdBQUcsQ0FBQztJQUN6QixJQUFJQyxpQkFBaUIsR0FBRyxDQUFDO0lBQ3pCLElBQUlDLGFBQWEsR0FBRyxJQUFJdkMsTUFBTSxDQUFDd0MsR0FBRyxDQUFDLENBQUM7SUFDcEMsSUFBSUMsaUJBQWlCLEdBQUcsSUFBSXpDLE1BQU0sQ0FBQ3dDLEdBQUcsQ0FBQyxDQUFDO0lBQ3hDLElBQUlFLHFCQUFxQixHQUFHLEVBQUU7SUFDOUIsSUFBSUMsWUFBWSxHQUFHLENBQUM7SUFDcEIsSUFBSUMsY0FBYyxHQUFHLENBQUM7SUFDdEIsSUFBSUMsd0JBQXdCLEdBQUcsSUFBSTtJQUNuQyxJQUFJQyxpQkFBaUIsR0FBRyxFQUFFO0lBQzFCLElBQUlDLHNCQUFzQixHQUFHLEtBQUs7SUFDbEMsSUFBSUMsbUJBQW1CLEdBQUcsS0FBSztJQUMvQixJQUFJQyxZQUFZLEdBQUcsS0FBSztJQUN4QixJQUFJQyxpQkFBaUIsR0FBRyxDQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFLHVCQUF1QixDQUFFO0lBQ3BGLElBQUlDLGNBQWMsR0FBRyxDQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUU7SUFDckUsSUFBSUMsZ0JBQWdCLEdBQUcsQ0FBRSxjQUFjLEVBQUUscUJBQXFCLEVBQUUsd0JBQXdCLENBQUU7SUFDMUYsSUFBSUMsYUFBYSxHQUFHQywwQkFBMEIsQ0FBQyxDQUFDO0lBQ2hELElBQUlDLGlCQUFpQjtJQUNyQixJQUFJQyxlQUFlO0lBRW5CLElBQUssQ0FBRTNCLG9CQUFvQixJQUFJLENBQUVFLFdBQVcsRUFBRztNQUM5QyxPQUFPLElBQUk7SUFDWjtJQUVBd0IsaUJBQWlCLEdBQUd2RCxNQUFNLENBQUNXLDhCQUE4QixDQUFDQyxNQUFNLENBQUU7TUFDakU2QyxFQUFFLEVBQUU1QyxNQUFNLENBQUVOLGFBQWEsQ0FBQ21ELFlBQVksSUFBSSxFQUFHLENBQUM7TUFDOUNDLElBQUksRUFBRSxhQUFhLEtBQUtwRCxhQUFhLENBQUNvRCxJQUFJLEdBQUcsYUFBYSxHQUFHLFNBQVM7TUFDdEVDLFFBQVEsRUFBRS9DLE1BQU0sQ0FBRU4sYUFBYSxDQUFDcUQsUUFBUSxJQUFJckQsYUFBYSxDQUFDbUQsWUFBWSxJQUFJLEVBQUcsQ0FBQztNQUM5RUcsaUJBQWlCLEVBQUVoRCxNQUFNLENBQUVOLGFBQWEsQ0FBQ3NELGlCQUFpQixJQUFJdEQsYUFBYSxDQUFDbUQsWUFBWSxJQUFJLEVBQUcsQ0FBQztNQUNoR0ksVUFBVSxFQUFFLFFBQVEsS0FBS2pELE1BQU0sQ0FBRU4sYUFBYSxDQUFDdUQsVUFBVSxJQUFJLEVBQUcsQ0FBQyxHQUFHLFFBQVEsR0FBRyxNQUFNO01BQ3JGQyxzQkFBc0IsRUFBRSxRQUFRLEtBQUtsRCxNQUFNLENBQUVOLGFBQWEsQ0FBQ3dELHNCQUFzQixJQUFJLEVBQUcsQ0FBQyxHQUFHLFFBQVEsR0FBRyxTQUFTO01BQ2hIQyxjQUFjLEVBQUUsVUFBVTtNQUMxQkMsd0JBQXdCLEVBQUV0QyxzQkFBc0I7TUFDaER1QyxTQUFTLEVBQUVDLGNBQWMsQ0FBRTFDLElBQUksQ0FBQzJDLEdBQUcsRUFBRSxHQUFJLENBQUM7TUFDMUNDLFlBQVksRUFBRUYsY0FBYyxDQUFFMUMsSUFBSSxDQUFDNkMsTUFBTSxFQUFFLEdBQUksQ0FBQztNQUNoREMsV0FBVyxFQUFFSixjQUFjLENBQUUxQyxJQUFJLENBQUMrQyxLQUFLLEVBQUUsR0FBSSxDQUFDO01BQzlDQyxVQUFVLEVBQUVOLGNBQWMsQ0FBRTFDLElBQUksQ0FBQ2lELElBQUksRUFBRSxHQUFJLENBQUM7TUFDNUNDLEtBQUssRUFBRVIsY0FBYyxDQUFFMUMsSUFBSSxDQUFDa0QsS0FBSyxFQUFFLEdBQUksQ0FBQztNQUN4Q0MsV0FBVyxFQUFFVCxjQUFjLENBQUUxQyxJQUFJLENBQUNvRCxLQUFLLEVBQUUsR0FBSSxDQUFDO01BQzlDQyxhQUFhLEVBQUV2RSxhQUFhLENBQUN1RSxhQUFhO01BQzFDQyxhQUFhLEVBQUV4RSxhQUFhLENBQUN3RSxhQUFhO01BQzFDQyxjQUFjLEVBQUUsb0JBQW9CO01BQ3BDQyxTQUFTLEVBQUUsUUFBUTtNQUNuQkMsbUJBQW1CLEVBQUUsQ0FBRSxLQUFLLENBQUU7TUFDOUJDLFVBQVUsRUFBRSxLQUFLO01BQ2pCQyw0QkFBNEIsRUFBRUMsOEJBQThCO01BQzVEQyxpQkFBaUIsRUFBRSxJQUFJO01BQ3ZCQyxhQUFhLEVBQUUsUUFBUTtNQUN2QkMsZUFBZSxFQUFFakYsYUFBYSxDQUFDaUYsZUFBZTtNQUM5Q0MsYUFBYSxFQUFFbEYsYUFBYSxDQUFDa0YsYUFBYTtNQUMxQ0MscUJBQXFCLEVBQUVuRixhQUFhLENBQUNtRixxQkFBcUI7TUFDMURDLHFCQUFxQixFQUFFcEYsYUFBYSxDQUFDb0YscUJBQXFCO01BQzFEOUQsb0JBQW9CLEVBQUVBLG9CQUFvQjtNQUMxQ0UsV0FBVyxFQUFFQSxXQUFXO01BQ3hCNkQsb0JBQW9CLEVBQUUsVUFBVTtNQUNoQ0MsYUFBYSxFQUFFdEYsYUFBYSxDQUFDc0YsYUFBYTtNQUMxQ0MsZ0JBQWdCLEVBQUUsS0FBSztNQUN2QkMsbUJBQW1CLEVBQUUsSUFBSTtNQUN6QkMsZUFBZSxFQUFFLEtBQUs7TUFDdEJDLGlCQUFpQixFQUFFLElBQUksS0FBSzFGLGFBQWEsQ0FBQzBGLGlCQUFpQjtNQUMzREMsZUFBZSxFQUFFLElBQUksS0FBSzNGLGFBQWEsQ0FBQzJGLGVBQWU7TUFDdkRDLHFCQUFxQixFQUFFLElBQUksS0FBSzVGLGFBQWEsQ0FBQzRGLHFCQUFxQjtNQUNuRUMscUJBQXFCLEVBQUUsSUFBSSxLQUFLN0YsYUFBYSxDQUFDNkYscUJBQXFCO01BQ25FQyxZQUFZLEVBQUVsQyxjQUFjLENBQUUxQyxJQUFJLENBQUM2RSxNQUFNLEVBQUUsR0FBSSxDQUFDO01BQ2hEQyxnQkFBZ0IsRUFBRSxtQkFBbUI7TUFDckNDLGtCQUFrQixFQUFFQyx1QkFBdUI7TUFDM0NDLHNCQUFzQixFQUFFLElBQUk7TUFDNUJDLE9BQU8sRUFBRUMsa0JBQWtCO01BQzNCQyxRQUFRLEVBQUVDLG1CQUFtQjtNQUM3QkMsYUFBYSxFQUFFQyx3QkFBd0I7TUFDdkNDLFVBQVUsRUFBRUMscUJBQXFCO01BQ2pDQyxTQUFTLEVBQUVDLG9CQUFvQjtNQUMvQkMsUUFBUSxFQUFFQztJQUNYLENBQUUsQ0FBQztJQUNIOUQsZUFBZSxHQUFHRCxpQkFBaUIsR0FBR0EsaUJBQWlCLENBQUNnRSxXQUFXLENBQUMsQ0FBQyxHQUFHLElBQUk7SUFFNUUsSUFBSyxDQUFFaEUsaUJBQWlCLElBQUksQ0FBRUMsZUFBZSxFQUFHO01BQy9DLE9BQU8sSUFBSTtJQUNaO0lBQ0FBLGVBQWUsQ0FBQ2dFLFNBQVMsQ0FBQ0MsR0FBRyxDQUFFLHdDQUF5QyxDQUFDOztJQUV6RTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTbkUsMEJBQTBCQSxDQUFBLEVBQUc7TUFDckMsT0FBTztRQUNOb0UsVUFBVSxFQUFFLFFBQVE7UUFDcEJDLE9BQU8sRUFBRSxNQUFNO1FBQ2ZDLEtBQUssRUFBRTtVQUNOQyxVQUFVLEVBQUUsQ0FBQztVQUNidkYsaUJBQWlCLEVBQUUsQ0FBQztVQUNwQndGLFlBQVksRUFBRTtRQUNmLENBQUM7UUFDREMsU0FBUyxFQUFFO01BQ1osQ0FBQztJQUNGOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0MsZ0JBQWdCQSxDQUFFQyxJQUFJLEVBQUVDLFVBQVUsRUFBRztNQUM3QyxJQUFJQyxjQUFjLEdBQUc7UUFDcEJULFVBQVUsRUFBRXhFLGlCQUFpQjtRQUM3QnlFLE9BQU8sRUFBRXhFLGNBQWM7UUFDdkI0RSxTQUFTLEVBQUUzRTtNQUNaLENBQUM7TUFFRCxJQUFLLENBQUUrRSxjQUFjLENBQUVGLElBQUksQ0FBRSxJQUFJLENBQUMsQ0FBQyxLQUFLRSxjQUFjLENBQUVGLElBQUksQ0FBRSxDQUFDRyxPQUFPLENBQUVGLFVBQVcsQ0FBQyxFQUFHO1FBQ3RGLE9BQU8sS0FBSztNQUNiO01BQ0E3RSxhQUFhLENBQUU0RSxJQUFJLENBQUUsR0FBR0MsVUFBVTtNQUVsQyxPQUFPLElBQUk7SUFDWjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTRyxtQkFBbUJBLENBQUVDLE9BQU8sRUFBRztNQUN2QyxJQUFJQyxPQUFPLEdBQUdELE9BQU8sR0FBR3BHLGdCQUFnQixDQUFDc0csR0FBRyxDQUFFRixPQUFRLENBQUMsR0FBRyxJQUFJO01BRTlELE9BQU9DLE9BQU8sSUFBSTtRQUNqQlYsVUFBVSxFQUFFLENBQUM7UUFDYnZGLGlCQUFpQixFQUFFLENBQUM7UUFDcEJ3RixZQUFZLEVBQUU7TUFDZixDQUFDO0lBQ0Y7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNXLDZCQUE2QkEsQ0FBQSxFQUFHO01BQ3hDLElBQUlDLGVBQWUsR0FBRzFJLE1BQU0sQ0FBQzJJLGNBQWM7TUFDM0MsSUFBSUMsSUFBSSxHQUFHRixlQUFlLElBQUlHLE1BQU0sQ0FBQ0MsUUFBUSxDQUFFSixlQUFlLENBQUNLLFVBQVcsQ0FBQyxHQUFHTCxlQUFlLENBQUNLLFVBQVUsR0FBRyxDQUFDO01BQzVHLElBQUlDLEdBQUcsR0FBR04sZUFBZSxJQUFJRyxNQUFNLENBQUNDLFFBQVEsQ0FBRUosZUFBZSxDQUFDTyxTQUFVLENBQUMsR0FBR1AsZUFBZSxDQUFDTyxTQUFTLEdBQUcsQ0FBQztNQUN6RyxJQUFJQyxLQUFLLEdBQUdSLGVBQWUsSUFBSUcsTUFBTSxDQUFDQyxRQUFRLENBQUVKLGVBQWUsQ0FBQ1EsS0FBTSxDQUFDLEdBQ3BFUixlQUFlLENBQUNRLEtBQUssR0FDckJDLElBQUksQ0FBQ0MsR0FBRyxDQUFFbkosUUFBUSxDQUFDb0osZUFBZSxDQUFDQyxXQUFXLElBQUksQ0FBQyxFQUFFdEosTUFBTSxDQUFDdUosVUFBVSxJQUFJLENBQUUsQ0FBQztNQUNoRixJQUFJQyxNQUFNLEdBQUdkLGVBQWUsSUFBSUcsTUFBTSxDQUFDQyxRQUFRLENBQUVKLGVBQWUsQ0FBQ2MsTUFBTyxDQUFDLEdBQ3RFZCxlQUFlLENBQUNjLE1BQU0sR0FDdEJMLElBQUksQ0FBQ0MsR0FBRyxDQUFFbkosUUFBUSxDQUFDb0osZUFBZSxDQUFDSSxZQUFZLElBQUksQ0FBQyxFQUFFekosTUFBTSxDQUFDMEosV0FBVyxJQUFJLENBQUUsQ0FBQztNQUVsRixPQUFPO1FBQ05kLElBQUksRUFBRUEsSUFBSTtRQUNWSSxHQUFHLEVBQUVBLEdBQUc7UUFDUlcsS0FBSyxFQUFFZixJQUFJLEdBQUdNLEtBQUs7UUFDbkJVLE1BQU0sRUFBRVosR0FBRyxHQUFHUTtNQUNmLENBQUM7SUFDRjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNuRSw4QkFBOEJBLENBQUEsRUFBRztNQUN6QyxJQUFJd0UsZ0JBQWdCO01BQ3BCLElBQUlDLGtCQUFrQjtNQUN0QixJQUFJQyxhQUFhO01BQ2pCLElBQUlDLGdCQUFnQjtNQUNwQixJQUFJQyxZQUFZO01BQ2hCLElBQUlDLFdBQVc7TUFDZixJQUFJQyxhQUFhO01BQ2pCLElBQUlDLGNBQWM7TUFFbEIsSUFDQyxDQUFFdkksb0JBQW9CLElBQ25CLENBQUVBLG9CQUFvQixDQUFDd0ksV0FBVyxFQUNwQztRQUNELE9BQU8sSUFBSTtNQUNaO01BQ0FSLGdCQUFnQixHQUFHaEksb0JBQW9CLENBQUN5SSxxQkFBcUIsQ0FBQyxDQUFDO01BQy9EUixrQkFBa0IsR0FBR3JCLDZCQUE2QixDQUFDLENBQUM7TUFDcER3QixZQUFZLEdBQUdkLElBQUksQ0FBQ0MsR0FBRyxDQUFFUyxnQkFBZ0IsQ0FBQ2pCLElBQUksRUFBRWtCLGtCQUFrQixDQUFDbEIsSUFBSyxDQUFDO01BQ3pFc0IsV0FBVyxHQUFHZixJQUFJLENBQUNDLEdBQUcsQ0FBRVMsZ0JBQWdCLENBQUNiLEdBQUcsRUFBRWMsa0JBQWtCLENBQUNkLEdBQUksQ0FBQztNQUN0RW1CLGFBQWEsR0FBR2hCLElBQUksQ0FBQ29CLEdBQUcsQ0FBRVYsZ0JBQWdCLENBQUNGLEtBQUssRUFBRUcsa0JBQWtCLENBQUNILEtBQU0sQ0FBQztNQUM1RVMsY0FBYyxHQUFHakIsSUFBSSxDQUFDb0IsR0FBRyxDQUFFVixnQkFBZ0IsQ0FBQ0QsTUFBTSxFQUFFRSxrQkFBa0IsQ0FBQ0YsTUFBTyxDQUFDO01BQy9FRyxhQUFhLEdBQUd6SixJQUFJLENBQUN3QixhQUFhLENBQUUsK0JBQWdDLENBQUM7TUFDckUsSUFBS2lJLGFBQWEsSUFBSUEsYUFBYSxDQUFDUyxjQUFjLENBQUMsQ0FBQyxDQUFDQyxNQUFNLEVBQUc7UUFDN0RULGdCQUFnQixHQUFHRCxhQUFhLENBQUNPLHFCQUFxQixDQUFDLENBQUM7UUFDeEQsSUFDQ04sZ0JBQWdCLENBQUNKLE1BQU0sR0FBR00sV0FBVyxJQUNsQ0YsZ0JBQWdCLENBQUNoQixHQUFHLEdBQUdvQixjQUFjLElBQ3JDSixnQkFBZ0IsQ0FBQ0wsS0FBSyxHQUFHTSxZQUFZLElBQ3JDRCxnQkFBZ0IsQ0FBQ3BCLElBQUksR0FBR3VCLGFBQWEsRUFDdkM7VUFDREQsV0FBVyxHQUFHZixJQUFJLENBQUNvQixHQUFHLENBQUVILGNBQWMsRUFBRWpCLElBQUksQ0FBQ0MsR0FBRyxDQUFFYyxXQUFXLEVBQUVGLGdCQUFnQixDQUFDSixNQUFPLENBQUUsQ0FBQztRQUMzRjtNQUNEO01BQ0EsSUFBS08sYUFBYSxJQUFJRixZQUFZLElBQUlHLGNBQWMsSUFBSUYsV0FBVyxFQUFHO1FBQ3JFLE9BQU8sSUFBSTtNQUNaO01BRUEsT0FBTztRQUNOdEIsSUFBSSxFQUFFcUIsWUFBWTtRQUNsQmpCLEdBQUcsRUFBRWtCLFdBQVc7UUFDaEJQLEtBQUssRUFBRVEsYUFBYTtRQUNwQlAsTUFBTSxFQUFFUSxjQUFjO1FBQ3RCbEIsS0FBSyxFQUFFaUIsYUFBYSxHQUFHRixZQUFZO1FBQ25DVCxNQUFNLEVBQUVZLGNBQWMsR0FBR0YsV0FBVztRQUNwQ1EsQ0FBQyxFQUFFVCxZQUFZO1FBQ2ZVLENBQUMsRUFBRVQ7TUFDSixDQUFDO0lBQ0Y7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU1UscUJBQXFCQSxDQUFFdEMsT0FBTyxFQUFHO01BQ3pDLElBQUssQ0FBRUEsT0FBTyxJQUFJLENBQUVBLE9BQU8sQ0FBQytCLFdBQVcsSUFBSSxDQUFFL0osSUFBSSxDQUFDdUssUUFBUSxDQUFFdkMsT0FBUSxDQUFDLEVBQUc7UUFDdkUsT0FBTyxJQUFJO01BQ1o7TUFFQSxPQUFPQSxPQUFPLENBQUNnQyxxQkFBcUIsQ0FBQyxDQUFDO0lBQ3ZDOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU1Esb0JBQW9CQSxDQUFFQyxlQUFlLEVBQUVDLGdCQUFnQixFQUFHO01BQ2xFLE9BQU9ELGVBQWUsQ0FBQ3BCLEtBQUssR0FBR3FCLGdCQUFnQixDQUFDcEMsSUFBSSxJQUNoRG1DLGVBQWUsQ0FBQ25DLElBQUksR0FBR29DLGdCQUFnQixDQUFDckIsS0FBSyxJQUM3Q29CLGVBQWUsQ0FBQ25CLE1BQU0sR0FBR29CLGdCQUFnQixDQUFDaEMsR0FBRyxJQUM3QytCLGVBQWUsQ0FBQy9CLEdBQUcsR0FBR2dDLGdCQUFnQixDQUFDcEIsTUFBTTtJQUNsRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNuRCx1QkFBdUJBLENBQUU2QixPQUFPLEVBQUc7TUFDM0MsT0FBT3NDLHFCQUFxQixDQUFFdEMsT0FBUSxDQUFDO0lBQ3hDOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVMyQywyQkFBMkJBLENBQUUzQyxPQUFPLEVBQUc7TUFDL0MsSUFBSTRDLGlCQUFpQixHQUFHTixxQkFBcUIsQ0FBRXRDLE9BQVEsQ0FBQztNQUN4RCxJQUFJNkMsaUJBQWlCO01BRXJCLElBQUssQ0FBRUQsaUJBQWlCLEVBQUc7UUFDMUIsT0FBTyxxQkFBcUI7TUFDN0I7TUFDQUMsaUJBQWlCLEdBQUc5Riw4QkFBOEIsQ0FBQyxDQUFDO01BQ3BELElBQUssQ0FBRThGLGlCQUFpQixJQUFJLENBQUVMLG9CQUFvQixDQUFFSSxpQkFBaUIsRUFBRUMsaUJBQWtCLENBQUMsRUFBRztRQUM1RixPQUFPLHdCQUF3QjtNQUNoQztNQUVBLE9BQU8sY0FBYztJQUN0Qjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0MsaUJBQWlCQSxDQUFBLEVBQUc7TUFDNUIsT0FBTztRQUNOMUQsVUFBVSxFQUFFckUsYUFBYSxDQUFDcUUsVUFBVTtRQUNwQ0MsT0FBTyxFQUFFdEUsYUFBYSxDQUFDc0UsT0FBTztRQUM5QkMsS0FBSyxFQUFFO1VBQ05DLFVBQVUsRUFBRXhFLGFBQWEsQ0FBQ3VFLEtBQUssQ0FBQ0MsVUFBVTtVQUMxQ3ZGLGlCQUFpQixFQUFFZSxhQUFhLENBQUN1RSxLQUFLLENBQUN0RixpQkFBaUI7VUFDeER3RixZQUFZLEVBQUV6RSxhQUFhLENBQUN1RSxLQUFLLENBQUNFO1FBQ25DLENBQUM7UUFDREMsU0FBUyxFQUFFMUUsYUFBYSxDQUFDMEU7TUFDMUIsQ0FBQztJQUNGOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU25CLGtCQUFrQkEsQ0FBRXlFLGlCQUFpQixFQUFFL0MsT0FBTyxFQUFHO01BQ3pELElBQUsrQyxpQkFBaUIsS0FBSzlILGlCQUFpQixFQUFHO1FBQzlDbkIsY0FBYyxHQUFHa0csT0FBTztRQUN4QmpGLGFBQWEsQ0FBQ3VFLEtBQUssR0FBR1MsbUJBQW1CLENBQUVDLE9BQVEsQ0FBQztRQUNwRE4sZ0JBQWdCLENBQUUsWUFBWSxFQUFFekUsaUJBQWlCLENBQUMrSCxTQUFTLENBQUMsQ0FBQyxHQUFHLFFBQVEsR0FBRyxXQUFZLENBQUM7UUFDeEZ0RCxnQkFBZ0IsQ0FBRSxXQUFXLEVBQUVpRCwyQkFBMkIsQ0FBRTNDLE9BQVEsQ0FBRSxDQUFDO1FBQ3ZFaUQsdUJBQXVCLENBQUMsQ0FBQztRQUN6QkMsWUFBWSxDQUFFbEQsT0FBUSxDQUFDO01BQ3hCO0lBQ0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVN4QixtQkFBbUJBLENBQUEsRUFBRztNQUM5QjJFLHNCQUFzQixDQUFDLENBQUM7TUFDeEJwSixpQkFBaUIsSUFBSSxDQUFDO01BQ3RCRCxjQUFjLEdBQUcsSUFBSTtNQUNyQmlCLGFBQWEsR0FBR0MsMEJBQTBCLENBQUMsQ0FBQztJQUM3Qzs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVMwRCx3QkFBd0JBLENBQUUwRSxrQkFBa0IsRUFBRUosU0FBUyxFQUFHO01BQ2xFLElBQUtJLGtCQUFrQixLQUFLbkksaUJBQWlCLElBQUksQ0FBRW5CLGNBQWMsRUFBRztRQUNuRTtNQUNEO01BQ0E0RixnQkFBZ0IsQ0FBRSxZQUFZLEVBQUVzRCxTQUFTLEdBQUcsUUFBUSxHQUFHLFdBQVksQ0FBQztNQUNwRUssNkJBQTZCLENBQUMsQ0FBQztJQUNoQzs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTekUscUJBQXFCQSxDQUFFMEUsb0JBQW9CLEVBQUc7TUFDdEQsSUFBS0Esb0JBQW9CLEtBQUtySSxpQkFBaUIsSUFBSW5CLGNBQWMsRUFBRztRQUNuRTRGLGdCQUFnQixDQUFFLFlBQVksRUFBRSx1QkFBd0IsQ0FBQztRQUN6RCxJQUFLLHFCQUFxQixLQUFLM0UsYUFBYSxDQUFDMEUsU0FBUyxFQUFHO1VBQ3hEQyxnQkFBZ0IsQ0FBRSxXQUFXLEVBQUVpRCwyQkFBMkIsQ0FBRTdJLGNBQWUsQ0FBRSxDQUFDO1FBQy9FO01BQ0Q7SUFDRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTZ0Ysb0JBQW9CQSxDQUFFeUUsa0JBQWtCLEVBQUc7TUFDbkQsSUFBS0Esa0JBQWtCLEtBQUt0SSxpQkFBaUIsSUFBSW5CLGNBQWMsRUFBRztRQUNqRTRGLGdCQUFnQixDQUFFLFlBQVksRUFBRSxRQUFTLENBQUM7UUFDMUNBLGdCQUFnQixDQUFFLFdBQVcsRUFBRWlELDJCQUEyQixDQUFFN0ksY0FBZSxDQUFFLENBQUM7UUFDOUVtSix1QkFBdUIsQ0FBQyxDQUFDO1FBQ3pCLElBQUssQ0FBQyxDQUFDLEtBQUssQ0FBRSxNQUFNLEVBQUUsU0FBUyxDQUFFLENBQUNuRCxPQUFPLENBQUUvRSxhQUFhLENBQUNzRSxPQUFRLENBQUMsRUFBRztVQUNwRTZELFlBQVksQ0FBRXBKLGNBQWUsQ0FBQztRQUMvQjtNQUNEO0lBQ0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVMwSixxQkFBcUJBLENBQUEsRUFBRztNQUNoQyxJQUFLbEosY0FBYyxFQUFHO1FBQ3JCNUMsTUFBTSxDQUFDK0wsb0JBQW9CLENBQUVuSixjQUFlLENBQUM7UUFDN0NBLGNBQWMsR0FBRyxDQUFDO01BQ25CO0lBQ0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVM2SSxzQkFBc0JBLENBQUEsRUFBRztNQUNqQ0sscUJBQXFCLENBQUMsQ0FBQztNQUN2QixJQUFLakosd0JBQXdCLEVBQUc7UUFDL0JBLHdCQUF3QixDQUFDbUosVUFBVSxDQUFDLENBQUM7TUFDdEM7SUFDRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNULHVCQUF1QkEsQ0FBQSxFQUFHO01BQ2xDLElBQUlVLFdBQVcsR0FBRzdKLGNBQWMsR0FBR0QsYUFBYSxDQUFDcUcsR0FBRyxDQUFFcEcsY0FBZSxDQUFDLEdBQUcsSUFBSTtNQUM3RSxJQUFJOEosY0FBYyxHQUFHLENBQUU1TCxJQUFJLEVBQUV1QixvQkFBb0IsRUFBRW9LLFdBQVcsRUFBRTdKLGNBQWMsQ0FBRTtNQUVoRixJQUFLLFVBQVUsS0FBSyxPQUFPcEMsTUFBTSxDQUFDbU0sY0FBYyxJQUFJLENBQUUvSixjQUFjLEVBQUc7UUFDdEU7TUFDRDtNQUNBLElBQUssQ0FBRVMsd0JBQXdCLEVBQUc7UUFDakNBLHdCQUF3QixHQUFHLElBQUk3QyxNQUFNLENBQUNtTSxjQUFjLENBQUVSLDZCQUE4QixDQUFDO01BQ3RGO01BQ0E5SSx3QkFBd0IsQ0FBQ21KLFVBQVUsQ0FBQyxDQUFDO01BQ3JDRSxjQUFjLENBQUNFLE9BQU8sQ0FBRSxVQUFXQyxhQUFhLEVBQUVDLGNBQWMsRUFBRztRQUNsRSxJQUNDRCxhQUFhLElBQ1ZBLGFBQWEsQ0FBQ2hDLFdBQVcsSUFDekI2QixjQUFjLENBQUM5RCxPQUFPLENBQUVpRSxhQUFjLENBQUMsS0FBS0MsY0FBYyxFQUM1RDtVQUNEekosd0JBQXdCLENBQUMwSixPQUFPLENBQUVGLGFBQWMsQ0FBQztRQUNsRDtNQUNELENBQUUsQ0FBQztJQUNKOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTRyxvQkFBb0JBLENBQUEsRUFBRztNQUMvQixJQUFJQyxlQUFlO01BQ25CLElBQUlDLGlCQUFpQjtNQUVyQixJQUFLLENBQUV0SyxjQUFjLElBQU0sQ0FBRW1CLGlCQUFpQixDQUFDb0osT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFFcEosaUJBQWlCLENBQUMrSCxTQUFTLENBQUMsQ0FBRyxFQUFHO1FBQy9GO01BQ0Q7TUFDQW1CLGVBQWUsR0FBR3hCLDJCQUEyQixDQUFFN0ksY0FBZSxDQUFDO01BQy9ENEYsZ0JBQWdCLENBQUUsV0FBVyxFQUFFeUUsZUFBZ0IsQ0FBQztNQUNoRCxJQUFLLHFCQUFxQixLQUFLQSxlQUFlLEVBQUc7UUFDaEQsSUFBS2xKLGlCQUFpQixDQUFDK0gsU0FBUyxDQUFDLENBQUMsRUFBRztVQUNwQy9ILGlCQUFpQixDQUFDcUosT0FBTyxDQUFFLHVCQUF3QixDQUFDO1FBQ3JELENBQUMsTUFBTSxJQUFLckosaUJBQWlCLENBQUNvSixPQUFPLENBQUMsQ0FBQyxFQUFHO1VBQ3pDcEosaUJBQWlCLENBQUNzSixhQUFhLENBQUUsaUJBQWlCLEVBQUUsS0FBTSxDQUFDO1FBQzVEO1FBQ0E7TUFDRDtNQUNBLElBQUt0SixpQkFBaUIsQ0FBQ3VKLFlBQVksQ0FBQyxDQUFDLEVBQUc7UUFDdkNKLGlCQUFpQixHQUFHbkosaUJBQWlCLENBQUN3SixxQkFBcUIsQ0FBQyxDQUFDO1FBQzdELElBQUssQ0FBRS9KLG1CQUFtQixJQUFJLHVCQUF1QixLQUFLMEosaUJBQWlCLEVBQUc7VUFDN0VuSixpQkFBaUIsQ0FBQ3lKLE1BQU0sQ0FBQyxDQUFDO1FBQzNCO1FBQ0E7TUFDRDtNQUNBekosaUJBQWlCLENBQUMwSixnQkFBZ0IsQ0FBQyxDQUFDO0lBQ3JDOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTdEIsNkJBQTZCQSxDQUFBLEVBQUc7TUFDeEMsSUFDQy9JLGNBQWMsSUFDWCxDQUFFUixjQUFjLElBQ2QsQ0FBRW1CLGlCQUFpQixDQUFDb0osT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFFcEosaUJBQWlCLENBQUMrSCxTQUFTLENBQUMsQ0FBRyxFQUN0RTtRQUNEO01BQ0Q7TUFDQTFJLGNBQWMsR0FBRzVDLE1BQU0sQ0FBQ2tOLHFCQUFxQixDQUFFLFlBQVk7UUFDMUR0SyxjQUFjLEdBQUcsQ0FBQztRQUNsQjRKLG9CQUFvQixDQUFDLENBQUM7TUFDdkIsQ0FBRSxDQUFDO0lBQ0o7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNsRixZQUFZQSxDQUFBLEVBQUc7TUFDdkIsSUFBSWdCLE9BQU8sR0FBR2xHLGNBQWM7TUFDNUIsSUFBSXlGLFVBQVU7TUFFZCxJQUFLLENBQUVTLE9BQU8sSUFBSSxDQUFFQSxPQUFPLENBQUMrQixXQUFXLElBQUksQ0FBRS9KLElBQUksQ0FBQ3VLLFFBQVEsQ0FBRXZDLE9BQVEsQ0FBQyxJQUFJLENBQUVELG1CQUFtQixDQUFFQyxPQUFRLENBQUMsQ0FBQ1QsVUFBVSxFQUFHO1FBQ3RIdEUsaUJBQWlCLENBQUNzSixhQUFhLENBQUUsNEJBQTRCLEVBQUUsS0FBTSxDQUFDO1FBQ3RFO01BQ0Q7TUFDQWhGLFVBQVUsR0FBR3NGLHNCQUFzQixDQUFFN0UsT0FBUSxDQUFDO01BQzlDLElBQUssQ0FBRThFLGdCQUFnQixDQUFFdkYsVUFBVyxDQUFDLEVBQUc7UUFDdkN0RSxpQkFBaUIsQ0FBQ3NKLGFBQWEsQ0FBRSw0QkFBNEIsRUFBRSxLQUFNLENBQUM7UUFDdEU7TUFDRDtNQUNBUSxrQkFBa0IsQ0FBRXhGLFVBQVUsRUFBRSxLQUFNLENBQUM7TUFDdkMyRCxZQUFZLENBQUVsRCxPQUFRLENBQUM7SUFDeEI7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBUzFHLGVBQWVBLENBQUUwTCxTQUFTLEVBQUVDLFFBQVEsRUFBRUMsT0FBTyxFQUFFQyxPQUFPLEVBQUc7TUFDakVILFNBQVMsR0FBR3pFLE1BQU0sQ0FBRXlFLFNBQVUsQ0FBQztNQUMvQixJQUFLLENBQUV6RSxNQUFNLENBQUNDLFFBQVEsQ0FBRXdFLFNBQVUsQ0FBQyxFQUFHO1FBQ3JDQSxTQUFTLEdBQUdDLFFBQVE7TUFDckI7TUFFQSxPQUFPcEUsSUFBSSxDQUFDQyxHQUFHLENBQUVvRSxPQUFPLEVBQUVyRSxJQUFJLENBQUNvQixHQUFHLENBQUVrRCxPQUFPLEVBQUV0RSxJQUFJLENBQUN1RSxLQUFLLENBQUVKLFNBQVUsQ0FBRSxDQUFFLENBQUM7SUFDekU7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0ssYUFBYUEsQ0FBRUMsR0FBRyxFQUFFQyxnQkFBZ0IsRUFBRztNQUMvQyxJQUFJaEcsVUFBVSxHQUFHc0IsSUFBSSxDQUFDQyxHQUFHLENBQUUsQ0FBQyxFQUFFRCxJQUFJLENBQUN1RSxLQUFLLENBQUU3RSxNQUFNLENBQUUrRSxHQUFHLElBQUlBLEdBQUcsQ0FBQy9GLFVBQVcsQ0FBQyxJQUFJLENBQUUsQ0FBRSxDQUFDO01BQ2xGLElBQUlpRyxXQUFXLEdBQUczRSxJQUFJLENBQUNDLEdBQUcsQ0FBRSxDQUFDLEVBQUVELElBQUksQ0FBQ3VFLEtBQUssQ0FBRTdFLE1BQU0sQ0FBRStFLEdBQUcsSUFBSUEsR0FBRyxDQUFDRSxXQUFZLENBQUMsSUFBSSxDQUFFLENBQUUsQ0FBQztNQUVwRixJQUFLLENBQUVGLEdBQUcsSUFBSSxDQUFDLEtBQUsvRSxNQUFNLENBQUUrRSxHQUFHLENBQUNHLGNBQWUsQ0FBQyxJQUFJLENBQUVsRyxVQUFVLEVBQUc7UUFDbEUsT0FBTyxJQUFJO01BQ1o7TUFFQSxPQUFPO1FBQ05rRyxjQUFjLEVBQUUsQ0FBQztRQUNqQmxHLFVBQVUsRUFBRUEsVUFBVTtRQUN0QmlHLFdBQVcsRUFBRUEsV0FBVztRQUN4QkUsT0FBTyxFQUFFN0osY0FBYyxDQUFFeUosR0FBRyxDQUFDSSxPQUFPLEVBQUUsR0FBSSxDQUFDO1FBQzNDQyxLQUFLLEVBQUU5SixjQUFjLENBQUV5SixHQUFHLENBQUNLLEtBQUssRUFBRSxHQUFJLENBQUM7UUFDdkNDLFVBQVUsRUFBRSxTQUFTLEtBQUtyTixNQUFNLENBQUUrTSxHQUFHLENBQUNNLFVBQVUsSUFBSSxFQUFHLENBQUMsR0FBRyxTQUFTLEdBQUcsVUFBVTtRQUNqRkMsWUFBWSxFQUFFaEssY0FBYyxDQUFFeUosR0FBRyxDQUFDTyxZQUFZLEVBQUUsR0FBSSxDQUFDO1FBQ3JEQyxXQUFXLEVBQUVqSyxjQUFjLENBQUV5SixHQUFHLENBQUNRLFdBQVcsRUFBRSxHQUFJLENBQUM7UUFDbkRDLFNBQVMsRUFBRWxLLGNBQWMsQ0FBRXlKLEdBQUcsQ0FBQ1MsU0FBUyxFQUFFLEdBQUksQ0FBQztRQUMvQ0MsVUFBVSxFQUFFbkssY0FBYyxDQUFFeUosR0FBRyxDQUFDVSxVQUFVLEVBQUUsR0FBSSxDQUFDO1FBQ2pEQyxjQUFjLEVBQUVwSyxjQUFjLENBQUV5SixHQUFHLENBQUNXLGNBQWMsRUFBRSxHQUFJLENBQUM7UUFDekRDLGdCQUFnQixFQUFFQyxPQUFPLENBQUViLEdBQUcsQ0FBQ1ksZ0JBQWlCLENBQUM7UUFDakRFLGNBQWMsRUFBRUQsT0FBTyxDQUFFYixHQUFHLENBQUNjLGNBQWUsQ0FBQztRQUM3Q0Msc0JBQXNCLEVBQUV4SyxjQUFjLENBQUV5SixHQUFHLENBQUNlLHNCQUFzQixFQUFFLEdBQUksQ0FBQztRQUN6RUMscUJBQXFCLEVBQUV6SyxjQUFjLENBQUV5SixHQUFHLENBQUNnQixxQkFBcUIsRUFBRSxHQUFJLENBQUM7UUFDdkVDLGtCQUFrQixFQUFFMUssY0FBYyxDQUFFMUMsSUFBSSxDQUFDcU4sWUFBWSxFQUFFLEdBQUksQ0FBQztRQUM1REMsUUFBUSxFQUFFQywwQkFBMEIsQ0FBRW5CLGdCQUFnQixFQUFFQyxXQUFZO01BQ3JFLENBQUM7SUFDRjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNrQiwwQkFBMEJBLENBQUVuQixnQkFBZ0IsRUFBRUMsV0FBVyxFQUFHO01BQ3BFLElBQUltQixZQUFZLEdBQUc5RixJQUFJLENBQUNDLEdBQUcsQ0FBRSxDQUFDLEVBQUVELElBQUksQ0FBQ3VFLEtBQUssQ0FBRTdFLE1BQU0sQ0FBRWdGLGdCQUFnQixJQUFJQSxnQkFBZ0IsQ0FBQ3BLLEVBQUcsQ0FBQyxJQUFJLENBQUUsQ0FBRSxDQUFDO01BRXRHLElBQUssQ0FBRXFLLFdBQVcsSUFBSW1CLFlBQVksS0FBS25CLFdBQVcsRUFBRztRQUNwRCxPQUFPO1VBQ05BLFdBQVcsRUFBRSxDQUFDO1VBQ2RuSixLQUFLLEVBQUUsRUFBRTtVQUNUdUssUUFBUSxFQUFFLEVBQUU7VUFDWkMsV0FBVyxFQUFFO1FBQ2QsQ0FBQztNQUNGO01BRUEsT0FBTztRQUNOckIsV0FBVyxFQUFFbUIsWUFBWTtRQUN6QnRLLEtBQUssRUFBRVIsY0FBYyxDQUFFMEosZ0JBQWdCLENBQUNsSixLQUFLLEVBQUUsR0FBSSxDQUFDO1FBQ3BEdUssUUFBUSxFQUFFL0ssY0FBYyxDQUFFMEosZ0JBQWdCLENBQUNxQixRQUFRLEVBQUUsR0FBSSxDQUFDO1FBQzFEQyxXQUFXLEVBQUVDLGFBQWEsQ0FBRXZCLGdCQUFnQixDQUFDd0IsU0FBVTtNQUN4RCxDQUFDO0lBQ0Y7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0MscUJBQXFCQSxDQUFFMUIsR0FBRyxFQUFHO01BQ3JDLElBQUkvRixVQUFVLEdBQUdzQixJQUFJLENBQUNDLEdBQUcsQ0FBRSxDQUFDLEVBQUVELElBQUksQ0FBQ3VFLEtBQUssQ0FBRTdFLE1BQU0sQ0FBRStFLEdBQUcsSUFBSUEsR0FBRyxDQUFDL0YsVUFBVyxDQUFDLElBQUksQ0FBRSxDQUFFLENBQUM7TUFDbEYsSUFBSTBILE1BQU0sR0FBRzNCLEdBQUcsSUFBSUEsR0FBRyxDQUFDMkIsTUFBTSxJQUFJLFFBQVEsS0FBSyxPQUFPM0IsR0FBRyxDQUFDMkIsTUFBTSxHQUFHM0IsR0FBRyxDQUFDMkIsTUFBTSxHQUFHLENBQUMsQ0FBQztNQUNsRixJQUFJUixRQUFRLEdBQUduQixHQUFHLElBQUlBLEdBQUcsQ0FBQ21CLFFBQVEsSUFBSSxRQUFRLEtBQUssT0FBT25CLEdBQUcsQ0FBQ21CLFFBQVEsR0FBR25CLEdBQUcsQ0FBQ21CLFFBQVEsR0FBRyxDQUFDLENBQUM7TUFDMUYsSUFBSVMsT0FBTyxHQUFHVCxRQUFRLENBQUNTLE9BQU8sSUFBSSxRQUFRLEtBQUssT0FBT1QsUUFBUSxDQUFDUyxPQUFPLEdBQUdULFFBQVEsQ0FBQ1MsT0FBTyxHQUFHLENBQUMsQ0FBQztNQUM5RixJQUFJQyxLQUFLLEdBQUc3QixHQUFHLElBQUlBLEdBQUcsQ0FBQzZCLEtBQUssSUFBSSxRQUFRLEtBQUssT0FBTzdCLEdBQUcsQ0FBQzZCLEtBQUssR0FBRzdCLEdBQUcsQ0FBQzZCLEtBQUssR0FBRyxDQUFDLENBQUM7TUFDOUUsSUFBSUMsT0FBTyxHQUFHRCxLQUFLLENBQUNDLE9BQU8sSUFBSSxRQUFRLEtBQUssT0FBT0QsS0FBSyxDQUFDQyxPQUFPLEdBQUdELEtBQUssQ0FBQ0MsT0FBTyxHQUFHLENBQUMsQ0FBQztNQUNyRixJQUFJQyxVQUFVLEdBQUcvQixHQUFHLElBQUlBLEdBQUcsQ0FBQytCLFVBQVUsSUFBSSxRQUFRLEtBQUssT0FBTy9CLEdBQUcsQ0FBQytCLFVBQVUsR0FBRy9CLEdBQUcsQ0FBQytCLFVBQVUsR0FBRyxDQUFDLENBQUM7TUFFbEcsSUFBSyxDQUFFL0IsR0FBRyxJQUFJLENBQUMsS0FBSy9FLE1BQU0sQ0FBRStFLEdBQUcsQ0FBQ0csY0FBZSxDQUFDLElBQUksQ0FBRWxHLFVBQVUsRUFBRztRQUNsRSxPQUFPLElBQUk7TUFDWjtNQUVBLE9BQU87UUFDTmtHLGNBQWMsRUFBRSxDQUFDO1FBQ2pCbEcsVUFBVSxFQUFFQSxVQUFVO1FBQ3RCbUcsT0FBTyxFQUFFN0osY0FBYyxDQUFFeUosR0FBRyxDQUFDSSxPQUFPLEVBQUUsR0FBSSxDQUFDO1FBQzNDckosS0FBSyxFQUFFUixjQUFjLENBQUV5SixHQUFHLENBQUNqSixLQUFLLEVBQUUsR0FBSSxDQUFDO1FBQ3ZDNEssTUFBTSxFQUFFO1VBQ1BLLEdBQUcsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFFLFVBQVUsRUFBRSxTQUFTLENBQUUsQ0FBQ3hILE9BQU8sQ0FBRXZILE1BQU0sQ0FBRTBPLE1BQU0sQ0FBQ0ssR0FBRyxJQUFJLEVBQUcsQ0FBRSxDQUFDLEdBQUcvTyxNQUFNLENBQUUwTyxNQUFNLENBQUNLLEdBQUksQ0FBQyxHQUFHLFNBQVM7VUFDOUczQixLQUFLLEVBQUU5SixjQUFjLENBQUVvTCxNQUFNLENBQUN0QixLQUFLLEVBQUUsR0FBSTtRQUMxQyxDQUFDO1FBQ0RjLFFBQVEsRUFBRTtVQUNUakIsV0FBVyxFQUFFM0UsSUFBSSxDQUFDQyxHQUFHLENBQUUsQ0FBQyxFQUFFRCxJQUFJLENBQUN1RSxLQUFLLENBQUU3RSxNQUFNLENBQUVrRyxRQUFRLENBQUNqQixXQUFZLENBQUMsSUFBSSxDQUFFLENBQUUsQ0FBQztVQUM3RW5KLEtBQUssRUFBRVIsY0FBYyxDQUFFNEssUUFBUSxDQUFDcEssS0FBSyxFQUFFLEdBQUksQ0FBQztVQUM1Q2tMLFdBQVcsRUFBRTFMLGNBQWMsQ0FBRTRLLFFBQVEsQ0FBQ2MsV0FBVyxFQUFFLElBQUssQ0FBQztVQUN6RFYsV0FBVyxFQUFFQyxhQUFhLENBQUVMLFFBQVEsQ0FBQ0ksV0FBWSxDQUFDO1VBQ2xEVyxnQkFBZ0IsRUFBRTNHLElBQUksQ0FBQ0MsR0FBRyxDQUFFLENBQUMsRUFBRUQsSUFBSSxDQUFDdUUsS0FBSyxDQUFFN0UsTUFBTSxDQUFFa0csUUFBUSxDQUFDZSxnQkFBaUIsQ0FBQyxJQUFJLENBQUUsQ0FBRSxDQUFDO1VBQ3ZGTixPQUFPLEVBQUU7WUFDUk8sU0FBUyxFQUFFdEIsT0FBTyxDQUFFZSxPQUFPLENBQUNPLFNBQVUsQ0FBQztZQUN2Q0MsY0FBYyxFQUFFN0wsY0FBYyxDQUFFcUwsT0FBTyxDQUFDUSxjQUFjLEVBQUUsR0FBSSxDQUFDO1lBQzdEQyxZQUFZLEVBQUU5TCxjQUFjLENBQUVxTCxPQUFPLENBQUNTLFlBQVksRUFBRSxFQUFHO1VBQ3hEO1FBQ0QsQ0FBQztRQUNEQyxTQUFTLEVBQUVDLHFCQUFxQixDQUFFdkMsR0FBRyxDQUFDc0MsU0FBUyxFQUFFLEdBQUcsRUFBRUUsa0JBQW1CLENBQUM7UUFDMUVDLGNBQWMsRUFBRUYscUJBQXFCLENBQUV2QyxHQUFHLENBQUN5QyxjQUFjLEVBQUUsR0FBRyxFQUFFQyx1QkFBd0IsQ0FBQztRQUN6RkMsZ0JBQWdCLEVBQUVDLG1CQUFtQixDQUFFNUMsR0FBRyxDQUFDMkMsZ0JBQWdCLEVBQUUsRUFBRSxFQUFFLEdBQUksQ0FBQztRQUN0RUUsTUFBTSxFQUFFTixxQkFBcUIsQ0FBRXZDLEdBQUcsQ0FBQzZDLE1BQU0sRUFBRSxHQUFHLEVBQUVDLGVBQWdCLENBQUM7UUFDakVqQixLQUFLLEVBQUU7VUFDTk0sU0FBUyxFQUFFdEIsT0FBTyxDQUFFZ0IsS0FBSyxDQUFDTSxTQUFVLENBQUM7VUFDckNZLGNBQWMsRUFBRWxDLE9BQU8sQ0FBRWdCLEtBQUssQ0FBQ2tCLGNBQWUsQ0FBQztVQUMvQ0Msb0JBQW9CLEVBQUV6TSxjQUFjLENBQUVzTCxLQUFLLENBQUNtQixvQkFBb0IsRUFBRSxHQUFJLENBQUM7VUFDdkVsQixPQUFPLEVBQUU7WUFDUm1CLEtBQUssRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsU0FBUyxDQUFFLENBQUN6SSxPQUFPLENBQUV2SCxNQUFNLENBQUU2TyxPQUFPLENBQUNtQixLQUFLLElBQUksRUFBRyxDQUFFLENBQUMsR0FBR2hRLE1BQU0sQ0FBRTZPLE9BQU8sQ0FBQ21CLEtBQU0sQ0FBQyxHQUFHLFNBQVM7WUFDOUg1QyxLQUFLLEVBQUU5SixjQUFjLENBQUV1TCxPQUFPLENBQUN6QixLQUFLLEVBQUUsR0FBSTtVQUMzQztRQUNELENBQUM7UUFDRDZDLGFBQWEsRUFBRTNNLGNBQWMsQ0FBRXlKLEdBQUcsQ0FBQ2tELGFBQWEsRUFBRSxHQUFJLENBQUM7UUFDdkRuQixVQUFVLEVBQUU7VUFDWE8sU0FBUyxFQUFFekIsT0FBTyxDQUFFa0IsVUFBVSxDQUFDTyxTQUFVLENBQUM7VUFDMUNHLGNBQWMsRUFBRTVCLE9BQU8sQ0FBRWtCLFVBQVUsQ0FBQ1UsY0FBZSxDQUFDO1VBQ3BESSxNQUFNLEVBQUVoQyxPQUFPLENBQUVrQixVQUFVLENBQUNjLE1BQU87UUFDcEMsQ0FBQztRQUNETSxZQUFZLEVBQUV0QyxPQUFPLENBQUVrQixVQUFVLENBQUNPLFNBQVMsSUFBSVAsVUFBVSxDQUFDVSxjQUFjLElBQUlWLFVBQVUsQ0FBQ2MsTUFBTyxDQUFDO1FBQy9GNUIsa0JBQWtCLEVBQUUxSyxjQUFjLENBQUUxQyxJQUFJLENBQUNxTixZQUFZLEVBQUUsR0FBSSxDQUFDO1FBQzVEck4sSUFBSSxFQUFFO1VBQ0xzTixRQUFRLEVBQUU1SyxjQUFjLENBQUUxQyxJQUFJLENBQUNzTixRQUFRLEVBQUUsR0FBSSxDQUFDO1VBQzlDbUIsU0FBUyxFQUFFL0wsY0FBYyxDQUFFMUMsSUFBSSxDQUFDeU8sU0FBUyxFQUFFLEdBQUksQ0FBQztVQUNoREcsY0FBYyxFQUFFbE0sY0FBYyxDQUFFMUMsSUFBSSxDQUFDNE8sY0FBYyxFQUFFLEdBQUksQ0FBQztVQUMxRFcsWUFBWSxFQUFFN00sY0FBYyxDQUFFMUMsSUFBSSxDQUFDdVAsWUFBWSxFQUFFLEdBQUksQ0FBQztVQUN0REMsVUFBVSxFQUFFOU0sY0FBYyxDQUFFMUMsSUFBSSxDQUFDd1AsVUFBVSxFQUFFLEdBQUksQ0FBQztVQUNsREMsY0FBYyxFQUFFL00sY0FBYyxDQUFFMUMsSUFBSSxDQUFDeVAsY0FBYyxFQUFFLEdBQUksQ0FBQztVQUMxREMsT0FBTyxFQUFFaE4sY0FBYyxDQUFFMUMsSUFBSSxDQUFDMFAsT0FBTyxFQUFFLEdBQUksQ0FBQztVQUM1Q0MsYUFBYSxFQUFFak4sY0FBYyxDQUFFMUMsSUFBSSxDQUFDMlAsYUFBYSxFQUFFLEdBQUksQ0FBQztVQUN4REMsWUFBWSxFQUFFbE4sY0FBYyxDQUFFMUMsSUFBSSxDQUFDNFAsWUFBWSxFQUFFLEdBQUksQ0FBQztVQUN0REMsc0JBQXNCLEVBQUVuTixjQUFjLENBQUUxQyxJQUFJLENBQUM2UCxzQkFBc0IsRUFBRSxHQUFJLENBQUM7VUFDMUVDLFNBQVMsRUFBRXBOLGNBQWMsQ0FBRTFDLElBQUksQ0FBQzhQLFNBQVMsRUFBRSxHQUFJO1FBQ2hEO01BQ0QsQ0FBQztJQUNGOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNuQixrQkFBa0JBLENBQUVvQixRQUFRLEVBQUc7TUFDdkMsT0FBTztRQUNOQyxRQUFRLEVBQUV0TixjQUFjLENBQUVxTixRQUFRLENBQUNDLFFBQVEsRUFBRSxFQUFHLENBQUM7UUFDakRDLE1BQU0sRUFBRXZOLGNBQWMsQ0FBRXFOLFFBQVEsQ0FBQ0UsTUFBTSxFQUFFLEVBQUcsQ0FBQztRQUM3Q3RELFdBQVcsRUFBRWpLLGNBQWMsQ0FBRXFOLFFBQVEsQ0FBQ3BELFdBQVcsRUFBRSxHQUFJLENBQUM7UUFDeERDLFNBQVMsRUFBRWxLLGNBQWMsQ0FBRXFOLFFBQVEsQ0FBQ25ELFNBQVMsRUFBRSxHQUFJLENBQUM7UUFDcERFLGNBQWMsRUFBRXBLLGNBQWMsQ0FBRXFOLFFBQVEsQ0FBQ2pELGNBQWMsRUFBRSxHQUFJLENBQUM7UUFDOURvRCxXQUFXLEVBQUVsRCxPQUFPLENBQUUrQyxRQUFRLENBQUNHLFdBQVksQ0FBQztRQUM1Q0MsWUFBWSxFQUFFbkQsT0FBTyxDQUFFK0MsUUFBUSxDQUFDSSxZQUFhO01BQzlDLENBQUM7SUFDRjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTdEIsdUJBQXVCQSxDQUFFdUIsYUFBYSxFQUFHO01BQ2pELE9BQU87UUFDTkMsSUFBSSxFQUFFM04sY0FBYyxDQUFFME4sYUFBYSxDQUFDQyxJQUFJLEVBQUUsRUFBRyxDQUFDO1FBQzlDeEQsVUFBVSxFQUFFbkssY0FBYyxDQUFFME4sYUFBYSxDQUFDdkQsVUFBVSxFQUFFLEdBQUksQ0FBQztRQUMzRHlELFVBQVUsRUFBRTVOLGNBQWMsQ0FBRTBOLGFBQWEsQ0FBQ0UsVUFBVSxFQUFFLEdBQUksQ0FBQztRQUMzREMsUUFBUSxFQUFFN04sY0FBYyxDQUFFME4sYUFBYSxDQUFDRyxRQUFRLEVBQUUsRUFBRztNQUN0RCxDQUFDO0lBQ0Y7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU3RCLGVBQWVBLENBQUV1QixLQUFLLEVBQUc7TUFDakMsT0FBTztRQUNOaEUsS0FBSyxFQUFFOUosY0FBYyxDQUFFOE4sS0FBSyxDQUFDaEUsS0FBSyxFQUFFLEdBQUksQ0FBQztRQUN6Q2lFLEtBQUssRUFBRS9OLGNBQWMsQ0FBRThOLEtBQUssQ0FBQ0MsS0FBSyxFQUFFLElBQUs7TUFDMUMsQ0FBQztJQUNGOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTL0IscUJBQXFCQSxDQUFFZ0MsT0FBTyxFQUFFQyxhQUFhLEVBQUVDLE1BQU0sRUFBRztNQUNoRSxPQUFPLENBQUVDLEtBQUssQ0FBQ0MsT0FBTyxDQUFFSixPQUFRLENBQUMsR0FBR0EsT0FBTyxHQUFHLEVBQUUsRUFBR0ssS0FBSyxDQUFFLENBQUMsRUFBRUosYUFBYyxDQUFDLENBQUNLLE1BQU0sQ0FBRSxVQUFXQyxNQUFNLEVBQUc7UUFDeEcsT0FBT0EsTUFBTSxJQUFJLFFBQVEsS0FBSyxPQUFPQSxNQUFNLElBQUksQ0FBRUosS0FBSyxDQUFDQyxPQUFPLENBQUVHLE1BQU8sQ0FBQztNQUN6RSxDQUFFLENBQUMsQ0FBQ0MsR0FBRyxDQUFFTixNQUFPLENBQUM7SUFDbEI7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVM3QixtQkFBbUJBLENBQUVvQyxNQUFNLEVBQUVSLGFBQWEsRUFBRVMsY0FBYyxFQUFHO01BQ3JFLE9BQU8sQ0FBRVAsS0FBSyxDQUFDQyxPQUFPLENBQUVLLE1BQU8sQ0FBQyxHQUFHQSxNQUFNLEdBQUcsRUFBRSxFQUFHSixLQUFLLENBQUUsQ0FBQyxFQUFFSixhQUFjLENBQUMsQ0FBQ08sR0FBRyxDQUFFLFVBQVdULEtBQUssRUFBRztRQUNsRyxPQUFPL04sY0FBYyxDQUFFK04sS0FBSyxFQUFFVyxjQUFlLENBQUM7TUFDL0MsQ0FBRSxDQUFDLENBQUNKLE1BQU0sQ0FBRWhFLE9BQVEsQ0FBQztJQUN0Qjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTVyxhQUFhQSxDQUFFOUIsU0FBUyxFQUFHO01BQ25DQSxTQUFTLEdBQUduSixjQUFjLENBQUVtSixTQUFTLEVBQUUsSUFBSyxDQUFDO01BQzdDLE9BQU8sa0JBQWtCLENBQUN3RixJQUFJLENBQUV4RixTQUFVLENBQUMsR0FBR0EsU0FBUyxHQUFHLEVBQUU7SUFDN0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTbkosY0FBY0EsQ0FBRW1KLFNBQVMsRUFBRXlGLFVBQVUsRUFBRztNQUNoRCxJQUFLLElBQUksS0FBS3pGLFNBQVMsSUFBSSxXQUFXLEtBQUssT0FBT0EsU0FBUyxJQUFNLFFBQVEsS0FBSyxPQUFPQSxTQUFTLElBQUksUUFBUSxLQUFLLE9BQU9BLFNBQVcsRUFBRztRQUNuSSxPQUFPLEVBQUU7TUFDVjtNQUVBLE9BQU96TSxNQUFNLENBQUV5TSxTQUFVLENBQUMsQ0FBQ2tGLEtBQUssQ0FBRSxDQUFDLEVBQUVPLFVBQVcsQ0FBQztJQUNsRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTNUYsc0JBQXNCQSxDQUFFN0UsT0FBTyxFQUFHO01BQzFDLElBQUlzRixHQUFHLEdBQUd0RixPQUFPLEdBQUd0RyxZQUFZLENBQUN3RyxHQUFHLENBQUVGLE9BQVEsQ0FBQyxHQUFHLElBQUk7TUFFdEQsT0FBT3NGLEdBQUcsR0FBR3pFLElBQUksQ0FBQ0MsR0FBRyxDQUFFLENBQUMsRUFBRUQsSUFBSSxDQUFDdUUsS0FBSyxDQUFFN0UsTUFBTSxDQUFFK0UsR0FBRyxDQUFDL0YsVUFBVyxDQUFDLElBQUksQ0FBRSxDQUFFLENBQUMsR0FBRyxDQUFDO0lBQzVFOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTbUwsa0JBQWtCQSxDQUFFMUssT0FBTyxFQUFFMkssVUFBVSxFQUFFQyxhQUFhLEVBQUc7TUFDakUsSUFBSUMsZUFBZSxHQUFHOUssbUJBQW1CLENBQUVDLE9BQVEsQ0FBQztNQUVwRCxPQUFPMkssVUFBVSxLQUFLNVEsaUJBQWlCLElBQ25DaUcsT0FBTyxLQUFLbEcsY0FBYyxJQUMxQmtHLE9BQU8sQ0FBQytCLFdBQVcsSUFDbkIvSixJQUFJLENBQUN1SyxRQUFRLENBQUV2QyxPQUFRLENBQUMsSUFDeEIvRSxpQkFBaUIsQ0FBQ29KLE9BQU8sQ0FBQyxDQUFDLElBQzNCdUcsYUFBYSxDQUFDckwsVUFBVSxLQUFLeEUsYUFBYSxDQUFDdUUsS0FBSyxDQUFDQyxVQUFVLElBQzNEcUwsYUFBYSxDQUFDNVEsaUJBQWlCLEtBQUtlLGFBQWEsQ0FBQ3VFLEtBQUssQ0FBQ3RGLGlCQUFpQixJQUN6RTRRLGFBQWEsQ0FBQ3BMLFlBQVksS0FBS3pFLGFBQWEsQ0FBQ3VFLEtBQUssQ0FBQ0UsWUFBWSxJQUMvRG9MLGFBQWEsQ0FBQ3JMLFVBQVUsS0FBS3NMLGVBQWUsQ0FBQ3RMLFVBQVUsSUFDdkRxTCxhQUFhLENBQUM1USxpQkFBaUIsS0FBSzZRLGVBQWUsQ0FBQzdRLGlCQUFpQixJQUNyRTRRLGFBQWEsQ0FBQ3BMLFlBQVksS0FBS3FMLGVBQWUsQ0FBQ3JMLFlBQVk7SUFDaEU7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU3NGLGdCQUFnQkEsQ0FBRXZGLFVBQVUsRUFBRztNQUN2QyxJQUFJdUwsSUFBSSxHQUFHNVAsZUFBZSxDQUFDMUIsYUFBYSxDQUFFLG1DQUFvQyxDQUFDO01BRS9FLE9BQU9zUixJQUFJLElBQUl2SyxNQUFNLENBQUV1SyxJQUFJLENBQUNDLFlBQVksQ0FBRSxzQkFBdUIsQ0FBRSxDQUFDLEtBQUt4TCxVQUFVLEdBQUd1TCxJQUFJLEdBQUcsSUFBSTtJQUNsRzs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0UsaUJBQWlCQSxDQUFBLEVBQUc7TUFDNUIsT0FBTztRQUNOdkUsUUFBUSxFQUFFNUssY0FBYyxDQUFFMUMsSUFBSSxDQUFDc04sUUFBUSxFQUFFLEdBQUksQ0FBQztRQUM5Q3dFLEtBQUssRUFBRXBQLGNBQWMsQ0FBRTFDLElBQUksQ0FBQzhSLEtBQUssRUFBRSxHQUFJLENBQUM7UUFDeENDLEdBQUcsRUFBRXJQLGNBQWMsQ0FBRTFDLElBQUksQ0FBQytSLEdBQUcsRUFBRSxHQUFJLENBQUM7UUFDcENDLFFBQVEsRUFBRXRQLGNBQWMsQ0FBRTFDLElBQUksQ0FBQ2dTLFFBQVEsRUFBRSxHQUFJLENBQUM7UUFDOUN2RCxTQUFTLEVBQUUvTCxjQUFjLENBQUUxQyxJQUFJLENBQUN5TyxTQUFTLEVBQUUsR0FBSSxDQUFDO1FBQ2hEYyxZQUFZLEVBQUU3TSxjQUFjLENBQUUxQyxJQUFJLENBQUN1UCxZQUFZLEVBQUUsR0FBSSxDQUFDO1FBQ3REWCxjQUFjLEVBQUVsTSxjQUFjLENBQUUxQyxJQUFJLENBQUM0TyxjQUFjLEVBQUUsR0FBSSxDQUFDO1FBQzFEWSxVQUFVLEVBQUU5TSxjQUFjLENBQUUxQyxJQUFJLENBQUN3UCxVQUFVLEVBQUUsR0FBSSxDQUFDO1FBQ2xEQyxjQUFjLEVBQUUvTSxjQUFjLENBQUUxQyxJQUFJLENBQUN5UCxjQUFjLEVBQUUsR0FBSSxDQUFDO1FBQzFEQyxPQUFPLEVBQUVoTixjQUFjLENBQUUxQyxJQUFJLENBQUMwUCxPQUFPLEVBQUUsR0FBSSxDQUFDO1FBQzVDQyxhQUFhLEVBQUVqTixjQUFjLENBQUUxQyxJQUFJLENBQUMyUCxhQUFhLEVBQUUsR0FBSSxDQUFDO1FBQ3hEQyxZQUFZLEVBQUVsTixjQUFjLENBQUUxQyxJQUFJLENBQUM0UCxZQUFZLEVBQUUsR0FBSSxDQUFDO1FBQ3REQyxzQkFBc0IsRUFBRW5OLGNBQWMsQ0FBRTFDLElBQUksQ0FBQzZQLHNCQUFzQixFQUFFLEdBQUksQ0FBQztRQUMxRUMsU0FBUyxFQUFFcE4sY0FBYyxDQUFFMUMsSUFBSSxDQUFDOFAsU0FBUyxFQUFFLEdBQUk7TUFDaEQsQ0FBQztJQUNGOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTbUMsbUJBQW1CQSxDQUFFQyxXQUFXLEVBQUVoTSxPQUFPLEVBQUc7TUFDcEQsSUFBSWlNLGNBQWMsR0FBR2pNLE9BQU8sSUFBSUEsT0FBTyxDQUFDdUksU0FBUyxDQUFDekYsTUFBTSxHQUFHOUMsT0FBTyxDQUFDdUksU0FBUyxDQUFFLENBQUMsQ0FBRSxHQUFHLElBQUk7TUFDeEYsSUFBSW5CLFFBQVEsR0FBRzRFLFdBQVcsQ0FBQzVFLFFBQVE7TUFDbkMsSUFBSThFLGdCQUFnQjtNQUVwQixJQUFLbE0sT0FBTyxJQUFJQSxPQUFPLENBQUNvSCxRQUFRLENBQUNqQixXQUFXLEVBQUc7UUFDOUMrRixnQkFBZ0IsR0FBR2xNLE9BQU8sQ0FBQ29ILFFBQVEsQ0FBQ1MsT0FBTztRQUMzQ1QsUUFBUSxHQUFHO1VBQ1ZqQixXQUFXLEVBQUVuRyxPQUFPLENBQUNvSCxRQUFRLENBQUNqQixXQUFXO1VBQ3pDbkosS0FBSyxFQUFFZ0QsT0FBTyxDQUFDb0gsUUFBUSxDQUFDcEssS0FBSztVQUM3QnVLLFFBQVEsRUFBRTJFLGdCQUFnQixDQUFDOUQsU0FBUyxJQUFJOEQsZ0JBQWdCLENBQUM3RCxjQUFjLEdBQ3BFNkQsZ0JBQWdCLENBQUM3RCxjQUFjLElBQUs2RCxnQkFBZ0IsQ0FBQzVELFlBQVksR0FBRyxLQUFLLEdBQUc0RCxnQkFBZ0IsQ0FBQzVELFlBQVksR0FBRyxFQUFFLENBQUUsR0FDaEgwRCxXQUFXLENBQUM1RSxRQUFRLENBQUNHLFFBQVE7VUFDaENDLFdBQVcsRUFBRXhILE9BQU8sQ0FBQ29ILFFBQVEsQ0FBQ0ksV0FBVyxJQUFJd0UsV0FBVyxDQUFDNUUsUUFBUSxDQUFDSTtRQUNuRSxDQUFDO01BQ0Y7TUFFQSxPQUFPO1FBQ05KLFFBQVEsRUFBRUEsUUFBUTtRQUNsQlgsV0FBVyxFQUFFd0YsY0FBYyxHQUFHQSxjQUFjLENBQUN4RixXQUFXLEdBQUd1RixXQUFXLENBQUN2RixXQUFXO1FBQ2xGQyxTQUFTLEVBQUV1RixjQUFjLEdBQUdBLGNBQWMsQ0FBQ3ZGLFNBQVMsR0FBR3NGLFdBQVcsQ0FBQ3RGLFNBQVM7UUFDNUVFLGNBQWMsRUFBRXFGLGNBQWMsR0FBR0EsY0FBYyxDQUFDckYsY0FBYyxHQUFHb0YsV0FBVyxDQUFDcEYsY0FBYztRQUMzRnVGLGNBQWMsRUFBRW5NLE9BQU8sR0FBR0EsT0FBTyxDQUFDdUksU0FBUyxDQUFDekYsTUFBTSxHQUFHLENBQUM7UUFDdERzSixvQkFBb0IsRUFBRXBNLE9BQU8sSUFBSSxDQUFDLEdBQUdBLE9BQU8sQ0FBQ3VJLFNBQVMsQ0FBQ3pGLE1BQU0sR0FBRzlDLE9BQU8sQ0FBQ3VJLFNBQVMsQ0FBQ3NDLEtBQUssQ0FBRSxDQUFFLENBQUMsR0FBRyxFQUFFO1FBQ2pHbkMsY0FBYyxFQUFFMUksT0FBTyxHQUFHQSxPQUFPLENBQUMwSSxjQUFjLEdBQUcsRUFBRTtRQUNyRDVPLElBQUksRUFBRTZSLGlCQUFpQixDQUFDO01BQ3pCLENBQUM7SUFDRjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTVSxtQkFBbUJBLENBQUVMLFdBQVcsRUFBRztNQUMzQ3BRLGlCQUFpQixDQUFDMFEsVUFBVSxDQUMzQmxULGVBQWUsQ0FBRTtRQUNoQmlOLE9BQU8sRUFBRTJGLFdBQVcsQ0FBQzNGLE9BQU87UUFDNUJDLEtBQUssRUFBRTBGLFdBQVcsQ0FBQzFGLEtBQUs7UUFDeEJDLFVBQVUsRUFBRXlGLFdBQVcsQ0FBQ3pGLFVBQVU7UUFDbENDLFlBQVksRUFBRXdGLFdBQVcsQ0FBQ3hGO01BQzNCLENBQUUsQ0FBQyxFQUNId0YsV0FBVyxDQUFDM0YsT0FDYixDQUFDO01BQ0R6SyxpQkFBaUIsQ0FBQzJRLFdBQVcsQ0FDNUJ4VCxRQUFRLENBQUU7UUFDVG1ILFVBQVUsRUFBRThMLFdBQVcsQ0FBQzlMLFVBQVU7UUFDbENzTSxZQUFZLEVBQUVoVCxnQkFBZ0IsQ0FBRXVTLG1CQUFtQixDQUFFQyxXQUFXLEVBQUUsSUFBSyxDQUFFLENBQUM7UUFDMUVTLFlBQVksRUFBRS9TLGdCQUFnQixDQUFFO1VBQy9CZ1QsT0FBTyxFQUFFbFEsY0FBYyxDQUFFMUMsSUFBSSxDQUFDNlMsT0FBTyxFQUFFLEdBQUk7UUFDNUMsQ0FBRSxDQUFDO1FBQ0h6RixrQkFBa0IsRUFBRThFLFdBQVcsQ0FBQzlFO01BQ2pDLENBQUUsQ0FBQyxFQUNILEVBQ0QsQ0FBQztNQUNEdEwsaUJBQWlCLENBQUNnUixRQUFRLENBQUUsSUFBSSxFQUFFcFEsY0FBYyxDQUFFMUMsSUFBSSxDQUFDNlMsT0FBTyxFQUFFLEdBQUksQ0FBRSxDQUFDO0lBQ3hFOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0UsZUFBZUEsQ0FBRUMsSUFBSSxFQUFFQyxlQUFlLEVBQUc7TUFDakQsSUFBSyxDQUFFRCxJQUFJLEVBQUc7UUFDYjtNQUNEO01BQ0EsSUFBS0EsSUFBSSxDQUFDNUosUUFBUSxDQUFFNUssUUFBUSxDQUFDMFUsYUFBYyxDQUFDLEVBQUc7UUFDOUNGLElBQUksQ0FBQ0csS0FBSyxDQUFDLENBQUM7TUFDYjtNQUNBSCxJQUFJLENBQUNJLFNBQVMsR0FBR2hVLE1BQU0sQ0FBRTZULGVBQWUsSUFBSSxFQUFHLENBQUM7SUFDakQ7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNJLGNBQWNBLENBQUVuTixPQUFPLEVBQUVXLE9BQU8sRUFBRTJLLFVBQVUsRUFBRUMsYUFBYSxFQUFHO01BQ3RFLElBQUlTLFdBQVc7TUFDZixJQUFJUCxJQUFJO01BQ1IsSUFBSTJCLFlBQVk7TUFDaEIsSUFBSUMsWUFBWTtNQUVoQixJQUFLLENBQUVoQyxrQkFBa0IsQ0FBRTFLLE9BQU8sRUFBRTJLLFVBQVUsRUFBRUMsYUFBYyxDQUFDLEVBQUc7UUFDakU7TUFDRDtNQUNBUyxXQUFXLEdBQUczUixZQUFZLENBQUN3RyxHQUFHLENBQUVGLE9BQVEsQ0FBQztNQUN6QzhLLElBQUksR0FBR2hHLGdCQUFnQixDQUFFekYsT0FBTyxDQUFDRSxVQUFXLENBQUM7TUFDN0MsSUFBSyxDQUFFOEwsV0FBVyxJQUFJLENBQUVQLElBQUksRUFBRztRQUM5QjtNQUNEO01BQ0EyQixZQUFZLEdBQUczQixJQUFJLENBQUN0UixhQUFhLENBQUUsMkNBQTRDLENBQUM7TUFDaEZrVCxZQUFZLEdBQUc1QixJQUFJLENBQUN0UixhQUFhLENBQUUsMkNBQTRDLENBQUM7TUFDaEYwUyxlQUFlLENBQUVPLFlBQVksRUFBRTVULGdCQUFnQixDQUFFdVMsbUJBQW1CLENBQUVDLFdBQVcsRUFBRWhNLE9BQVEsQ0FBRSxDQUFFLENBQUM7TUFDaEc2TSxlQUFlLENBQUVRLFlBQVksRUFBRS9ULGdCQUFnQixDQUFFMEcsT0FBUSxDQUFFLENBQUM7TUFDNUQsSUFBS3FOLFlBQVksRUFBRztRQUNuQkEsWUFBWSxDQUFDQyxZQUFZLENBQUUsV0FBVyxFQUFFLE9BQVEsQ0FBQztNQUNsRDtNQUNBak4sZ0JBQWdCLENBQUUsU0FBUyxFQUFFLE9BQVEsQ0FBQztNQUN0Q3pFLGlCQUFpQixDQUFDZ1IsUUFBUSxDQUFFLEtBQUssRUFBRXBRLGNBQWMsQ0FBRTFDLElBQUksQ0FBQ3lULE1BQU0sRUFBRSxHQUFJLENBQUUsQ0FBQztNQUN2RWxWLE1BQU0sQ0FBQ2tOLHFCQUFxQixDQUFFLFlBQVk7UUFDekMsSUFBSzhGLGtCQUFrQixDQUFFMUssT0FBTyxFQUFFMkssVUFBVSxFQUFFQyxhQUFjLENBQUMsRUFBRztVQUMvRDNQLGlCQUFpQixDQUFDMEosZ0JBQWdCLENBQUMsQ0FBQztRQUNyQztNQUNELENBQUUsQ0FBQztJQUNKOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNrSSxvQkFBb0JBLENBQUU3TSxPQUFPLEVBQUUySyxVQUFVLEVBQUVDLGFBQWEsRUFBRztNQUNuRSxJQUFJRSxJQUFJO01BQ1IsSUFBSTRCLFlBQVk7TUFFaEIsSUFBSyxDQUFFaEMsa0JBQWtCLENBQUUxSyxPQUFPLEVBQUUySyxVQUFVLEVBQUVDLGFBQWMsQ0FBQyxFQUFHO1FBQ2pFO01BQ0Q7TUFDQUUsSUFBSSxHQUFHaEcsZ0JBQWdCLENBQUU4RixhQUFhLENBQUNyTCxVQUFXLENBQUM7TUFDbkRtTixZQUFZLEdBQUc1QixJQUFJLEdBQUdBLElBQUksQ0FBQ3RSLGFBQWEsQ0FBRSwyQ0FBNEMsQ0FBQyxHQUFHLElBQUk7TUFDOUYwUyxlQUFlLENBQUVRLFlBQVksRUFBRXpULGNBQWMsQ0FBRTtRQUM5QzhTLE9BQU8sRUFBRWxRLGNBQWMsQ0FBRTFDLElBQUksQ0FBQzJULEtBQUssRUFBRSxHQUFJLENBQUM7UUFDMUNDLFdBQVcsRUFBRWxSLGNBQWMsQ0FBRTFDLElBQUksQ0FBQzZULEtBQUssRUFBRSxHQUFJO01BQzlDLENBQUUsQ0FBRSxDQUFDO01BQ0wsSUFBS04sWUFBWSxFQUFHO1FBQ25CQSxZQUFZLENBQUNDLFlBQVksQ0FBRSxXQUFXLEVBQUUsT0FBUSxDQUFDO01BQ2xEO01BQ0FqTixnQkFBZ0IsQ0FBRSxTQUFTLEVBQUUsT0FBUSxDQUFDO01BQ3RDekUsaUJBQWlCLENBQUNnUixRQUFRLENBQUUsS0FBSyxFQUFFcFEsY0FBYyxDQUFFMUMsSUFBSSxDQUFDMlQsS0FBSyxFQUFFLEdBQUksQ0FBRSxDQUFDO01BQ3RFN1IsaUJBQWlCLENBQUMwSixnQkFBZ0IsQ0FBQyxDQUFDO0lBQ3JDOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNzSSxzQkFBc0JBLENBQUVqTixPQUFPLEVBQUc7TUFDMUMsSUFBSVQsVUFBVSxHQUFHc0Ysc0JBQXNCLENBQUU3RSxPQUFRLENBQUM7TUFDbEQsSUFBSThLLElBQUksR0FBR2hHLGdCQUFnQixDQUFFdkYsVUFBVyxDQUFDO01BQ3pDLElBQUltTixZQUFZLEdBQUc1QixJQUFJLEdBQUdBLElBQUksQ0FBQ3RSLGFBQWEsQ0FBRSwyQ0FBNEMsQ0FBQyxHQUFHLElBQUk7TUFFbEcwUyxlQUFlLENBQUVRLFlBQVksRUFBRTNULGdCQUFnQixDQUFFO1FBQ2hEZ1QsT0FBTyxFQUFFbFEsY0FBYyxDQUFFMUMsSUFBSSxDQUFDNlMsT0FBTyxFQUFFLEdBQUk7TUFDNUMsQ0FBRSxDQUFFLENBQUM7TUFDTCxJQUFLVSxZQUFZLEVBQUc7UUFDbkJBLFlBQVksQ0FBQ0MsWUFBWSxDQUFFLFdBQVcsRUFBRSxNQUFPLENBQUM7TUFDakQ7TUFDQTFSLGlCQUFpQixDQUFDZ1IsUUFBUSxDQUFFLElBQUksRUFBRXBRLGNBQWMsQ0FBRTFDLElBQUksQ0FBQzZTLE9BQU8sRUFBRSxHQUFJLENBQUUsQ0FBQztJQUN4RTs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTOUksWUFBWUEsQ0FBRWxELE9BQU8sRUFBRztNQUNoQyxJQUFJVCxVQUFVLEdBQUdzRixzQkFBc0IsQ0FBRTdFLE9BQVEsQ0FBQztNQUNsRCxJQUFJa04sU0FBUyxHQUFHM1UsTUFBTSxDQUFFZ0gsVUFBVyxDQUFDO01BQ3BDLElBQUlvTCxVQUFVLEdBQUc1USxpQkFBaUIsR0FBRyxDQUFDO01BQ3RDLElBQUk2USxhQUFhLEdBQUc3SyxtQkFBbUIsQ0FBRUMsT0FBUSxDQUFDO01BQ2xELElBQUltTixhQUFhO01BQ2pCLElBQUlDLGNBQWM7TUFFbEJyVCxpQkFBaUIsR0FBRzRRLFVBQVU7TUFDOUJqTCxnQkFBZ0IsQ0FBRSxTQUFTLEVBQUUsU0FBVSxDQUFDO01BQ3hDLElBQUssQ0FBRUgsVUFBVSxJQUFJLENBQUVuRyxTQUFTLENBQUNpVSxHQUFHLElBQUksQ0FBRWpVLFNBQVMsQ0FBQ2tVLE1BQU0sSUFBSSxDQUFFbFUsU0FBUyxDQUFDbVUsS0FBSyxJQUFJLENBQUVuVSxTQUFTLENBQUNvVSxNQUFNLEVBQUc7UUFDdkdYLG9CQUFvQixDQUFFN00sT0FBTyxFQUFFMkssVUFBVSxFQUFFQyxhQUFjLENBQUM7UUFDMUQ7TUFDRDtNQUNBLElBQUszUSxhQUFhLENBQUN3VCxHQUFHLENBQUVQLFNBQVUsQ0FBQyxFQUFHO1FBQ3JDRSxjQUFjLEdBQUduVCxhQUFhLENBQUNpRyxHQUFHLENBQUVnTixTQUFVLENBQUM7UUFDL0NqVCxhQUFhLENBQUN5VCxNQUFNLENBQUVSLFNBQVUsQ0FBQztRQUNqQ2pULGFBQWEsQ0FBQzBULEdBQUcsQ0FBRVQsU0FBUyxFQUFFRSxjQUFlLENBQUM7UUFDOUNaLGNBQWMsQ0FBRVksY0FBYyxFQUFFcE4sT0FBTyxFQUFFMkssVUFBVSxFQUFFQyxhQUFjLENBQUM7UUFDcEU7TUFDRDtNQUNBcUMsc0JBQXNCLENBQUVqTixPQUFRLENBQUM7TUFDakMsSUFBSzdGLGlCQUFpQixDQUFDc1QsR0FBRyxDQUFFUCxTQUFVLENBQUMsRUFBRztRQUN6Q0MsYUFBYSxHQUFHaFQsaUJBQWlCLENBQUMrRixHQUFHLENBQUVnTixTQUFVLENBQUM7TUFDbkQsQ0FBQyxNQUFNO1FBQ05DLGFBQWEsR0FBRztVQUNmUyxPQUFPLEVBQUUvVixDQUFDLENBQUNnVyxJQUFJLENBQUU7WUFDaEJSLEdBQUcsRUFBRTlVLE1BQU0sQ0FBRWEsU0FBUyxDQUFDaVUsR0FBSSxDQUFDO1lBQzVCUyxNQUFNLEVBQUUsTUFBTTtZQUNkQyxRQUFRLEVBQUUsTUFBTTtZQUNoQkMsSUFBSSxFQUFFO2NBQ0xWLE1BQU0sRUFBRS9VLE1BQU0sQ0FBRWEsU0FBUyxDQUFDa1UsTUFBTyxDQUFDO2NBQ2xDQyxLQUFLLEVBQUVoVixNQUFNLENBQUVhLFNBQVMsQ0FBQ21VLEtBQU0sQ0FBQztjQUNoQ0MsTUFBTSxFQUFFalYsTUFBTSxDQUFFYSxTQUFTLENBQUNvVSxNQUFPLENBQUM7Y0FDbENqTyxVQUFVLEVBQUVBO1lBQ2I7VUFDRCxDQUFFO1FBQ0gsQ0FBQztRQUNEcEYsaUJBQWlCLENBQUN3VCxHQUFHLENBQUVULFNBQVMsRUFBRUMsYUFBYyxDQUFDO1FBQ2pEQSxhQUFhLENBQUNTLE9BQU8sQ0FBQ0ssTUFBTSxDQUFFLFlBQVk7VUFDekMsSUFBSzlULGlCQUFpQixDQUFDK0YsR0FBRyxDQUFFZ04sU0FBVSxDQUFDLEtBQUtDLGFBQWEsRUFBRztZQUMzRGhULGlCQUFpQixDQUFDdVQsTUFBTSxDQUFFUixTQUFVLENBQUM7VUFDdEM7UUFDRCxDQUFFLENBQUM7TUFDSjtNQUVBQyxhQUFhLENBQUNTLE9BQU8sQ0FBQ00sSUFBSSxDQUFFLFVBQVdDLFFBQVEsRUFBRztRQUNqRCxJQUFJOU8sT0FBTyxHQUFHMkgscUJBQXFCLENBQUVtSCxRQUFRLElBQUlBLFFBQVEsQ0FBQ0MsT0FBTyxJQUFJRCxRQUFRLENBQUNILElBQUksR0FBR0csUUFBUSxDQUFDSCxJQUFJLENBQUNLLFFBQVEsR0FBRyxJQUFLLENBQUM7UUFFcEgsSUFBSyxDQUFFaFAsT0FBTyxJQUFJQSxPQUFPLENBQUNFLFVBQVUsS0FBS0EsVUFBVSxFQUFHO1VBQ3JEc04sb0JBQW9CLENBQUU3TSxPQUFPLEVBQUUySyxVQUFVLEVBQUVDLGFBQWMsQ0FBQztVQUMxRDtRQUNEO1FBQ0EsSUFBSzNRLGFBQWEsQ0FBQ3dULEdBQUcsQ0FBRVAsU0FBVSxDQUFDLEVBQUc7VUFDckNqVCxhQUFhLENBQUN5VCxNQUFNLENBQUVSLFNBQVUsQ0FBQztRQUNsQztRQUNBalQsYUFBYSxDQUFDMFQsR0FBRyxDQUFFVCxTQUFTLEVBQUU3TixPQUFRLENBQUM7UUFDdkMsT0FBUWpGLHFCQUFxQixHQUFHSCxhQUFhLENBQUNxVSxJQUFJLEVBQUc7VUFDcERyVSxhQUFhLENBQUN5VCxNQUFNLENBQUV6VCxhQUFhLENBQUNzVSxJQUFJLENBQUMsQ0FBQyxDQUFDQyxJQUFJLENBQUMsQ0FBQyxDQUFDNUUsS0FBTSxDQUFDO1FBQzFEO1FBQ0E0QyxjQUFjLENBQUVuTixPQUFPLEVBQUVXLE9BQU8sRUFBRTJLLFVBQVUsRUFBRUMsYUFBYyxDQUFDO01BQzlELENBQUUsQ0FBQztNQUNIdUMsYUFBYSxDQUFDUyxPQUFPLENBQUNhLElBQUksQ0FBRSxVQUFXYixPQUFPLEVBQUVjLGNBQWMsRUFBRztRQUNoRSxJQUFLLE9BQU8sS0FBS0EsY0FBYyxFQUFHO1VBQ2pDO1FBQ0Q7UUFDQSxJQUFLLENBQUMsQ0FBQyxLQUFLLENBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUUsQ0FBQzVPLE9BQU8sQ0FBRVMsTUFBTSxDQUFFcU4sT0FBTyxJQUFJQSxPQUFPLENBQUMzRyxNQUFPLENBQUUsQ0FBQyxFQUFHO1VBQzlFMEgsbUJBQW1CLENBQUMsQ0FBQztVQUNyQjFULGlCQUFpQixDQUFDc0osYUFBYSxDQUFFLDRCQUE0QixFQUFFLEtBQU0sQ0FBQztVQUN0RTtRQUNEO1FBQ0FzSSxvQkFBb0IsQ0FBRTdNLE9BQU8sRUFBRTJLLFVBQVUsRUFBRUMsYUFBYyxDQUFDO01BQzNELENBQUUsQ0FBQztJQUNKOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBUzdGLGtCQUFrQkEsQ0FBRXhGLFVBQVUsRUFBRXFQLGVBQWUsRUFBRztNQUMxRCxJQUFJMUIsU0FBUyxHQUFHM1UsTUFBTSxDQUFFc0ksSUFBSSxDQUFDQyxHQUFHLENBQUUsQ0FBQyxFQUFFRCxJQUFJLENBQUN1RSxLQUFLLENBQUU3RSxNQUFNLENBQUVoQixVQUFXLENBQUMsSUFBSSxDQUFFLENBQUUsQ0FBRSxDQUFDO01BQ2hGLElBQUk0TixhQUFhLEdBQUdoVCxpQkFBaUIsQ0FBQytGLEdBQUcsQ0FBRWdOLFNBQVUsQ0FBQztNQUV0RCxJQUFLMEIsZUFBZSxFQUFHO1FBQ3RCN1UsaUJBQWlCLElBQUksQ0FBQztNQUN2QjtNQUNBRSxhQUFhLENBQUN5VCxNQUFNLENBQUVSLFNBQVUsQ0FBQztNQUNqQyxJQUFLQyxhQUFhLElBQUlBLGFBQWEsQ0FBQ1MsT0FBTyxJQUFJLFVBQVUsS0FBSyxPQUFPVCxhQUFhLENBQUNTLE9BQU8sQ0FBQ2lCLEtBQUssRUFBRztRQUNsRzFCLGFBQWEsQ0FBQ1MsT0FBTyxDQUFDaUIsS0FBSyxDQUFDLENBQUM7TUFDOUI7TUFDQTFVLGlCQUFpQixDQUFDdVQsTUFBTSxDQUFFUixTQUFVLENBQUM7SUFDdEM7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVN5QixtQkFBbUJBLENBQUEsRUFBRztNQUM5QjVVLGlCQUFpQixJQUFJLENBQUM7TUFDdEJJLGlCQUFpQixDQUFDMkosT0FBTyxDQUFFLFVBQVdxSixhQUFhLEVBQUc7UUFDckQsSUFBS0EsYUFBYSxDQUFDUyxPQUFPLElBQUksVUFBVSxLQUFLLE9BQU9ULGFBQWEsQ0FBQ1MsT0FBTyxDQUFDaUIsS0FBSyxFQUFHO1VBQ2pGMUIsYUFBYSxDQUFDUyxPQUFPLENBQUNpQixLQUFLLENBQUMsQ0FBQztRQUM5QjtNQUNELENBQUUsQ0FBQztNQUNIMVUsaUJBQWlCLENBQUMyVSxLQUFLLENBQUMsQ0FBQztNQUN6QjdVLGFBQWEsQ0FBQzZVLEtBQUssQ0FBQyxDQUFDO0lBQ3RCOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNDLFdBQVdBLENBQUVDLFlBQVksRUFBRztNQUNwQyxJQUFJQyxPQUFPLEdBQUdELFlBQVksSUFBSSxDQUFDLEtBQUtBLFlBQVksQ0FBQ0UsUUFBUSxHQUFHRixZQUFZLEdBQUcsSUFBSTtNQUMvRSxJQUFJaFAsT0FBTztNQUVYLElBQUssQ0FBRWlQLE9BQU8sSUFBSUEsT0FBTyxDQUFDRSxPQUFPLENBQUUseUNBQTBDLENBQUMsRUFBRztRQUNoRixPQUFPLElBQUk7TUFDWjtNQUNBblAsT0FBTyxHQUFHaVAsT0FBTyxDQUFDRSxPQUFPLENBQUUsMkNBQTRDLENBQUM7TUFFeEUsT0FBT25QLE9BQU8sSUFBSWhJLElBQUksQ0FBQ3VLLFFBQVEsQ0FBRXZDLE9BQVEsQ0FBQyxJQUFJdEcsWUFBWSxDQUFDK1QsR0FBRyxDQUFFek4sT0FBUSxDQUFDLEdBQUdBLE9BQU8sR0FBRyxJQUFJO0lBQzNGOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU29QLHVCQUF1QkEsQ0FBRXBQLE9BQU8sRUFBRXFQLElBQUksRUFBRS9KLEdBQUcsRUFBRztNQUN0RCxJQUFJZ0ssa0JBQWtCO01BQ3RCLElBQUlDLGVBQWU7TUFDbkIsSUFBSUMsb0JBQW9CO01BQ3hCLElBQUlDLGlCQUFpQjtNQUVyQixJQUFLSixJQUFJLENBQUM5TSxRQUFRLENBQUV2QyxPQUFRLENBQUMsRUFBRztRQUMvQixPQUFPLElBQUk7TUFDWjtNQUNBc1Asa0JBQWtCLEdBQUd6TyxJQUFJLENBQUNDLEdBQUcsQ0FBRSxDQUFDLEVBQUVELElBQUksQ0FBQ3VFLEtBQUssQ0FBRTdFLE1BQU0sQ0FBRVAsT0FBTyxDQUFDK0ssWUFBWSxDQUFFLCtCQUFnQyxDQUFFLENBQUMsSUFBSSxDQUFFLENBQUUsQ0FBQztNQUN4SHdFLGVBQWUsR0FBRzFPLElBQUksQ0FBQ0MsR0FBRyxDQUFFLENBQUMsRUFBRUQsSUFBSSxDQUFDdUUsS0FBSyxDQUFFN0UsTUFBTSxDQUFFOE8sSUFBSSxDQUFDdEUsWUFBWSxDQUFFLCtCQUFnQyxDQUFFLENBQUMsSUFBSSxDQUFFLENBQUUsQ0FBQztNQUNsSHlFLG9CQUFvQixHQUFHalgsTUFBTSxDQUFFeUgsT0FBTyxDQUFDK0ssWUFBWSxDQUFFLGlDQUFrQyxDQUFDLElBQUksRUFBRyxDQUFDO01BQ2hHMEUsaUJBQWlCLEdBQUdsWCxNQUFNLENBQUU4VyxJQUFJLENBQUN0RSxZQUFZLENBQUUsK0JBQWdDLENBQUMsSUFBSSxFQUFHLENBQUM7TUFFeEYsT0FBTzVFLE9BQU8sQ0FDYm1KLGtCQUFrQixJQUNmQSxrQkFBa0IsS0FBS0MsZUFBZSxJQUN0Q0Qsa0JBQWtCLEtBQUsvTyxNQUFNLENBQUUrRSxHQUFHLENBQUMvRixVQUFXLENBQUMsSUFDL0NpUSxvQkFBb0IsSUFDcEJBLG9CQUFvQixLQUFLQyxpQkFDN0IsQ0FBQztJQUNGOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTQyx1QkFBdUJBLENBQUEsRUFBRztNQUNsQyxPQUFPMUYsS0FBSyxDQUFDMkYsU0FBUyxDQUFDQyxJQUFJLENBQUNDLElBQUksQ0FBRWxZLFFBQVEsQ0FBQ21ZLGdCQUFnQixDQUFFLHFCQUFzQixDQUFDLEVBQUUsVUFBV0MsV0FBVyxFQUFHO1FBQzlHLElBQUtBLFdBQVcsQ0FBQ0MsTUFBTSxJQUFJRCxXQUFXLENBQUNaLE9BQU8sQ0FBRSxVQUFXLENBQUMsSUFBSVksV0FBVyxDQUFDWixPQUFPLENBQUUsc0JBQXVCLENBQUMsRUFBRztVQUMvRyxPQUFPLEtBQUs7UUFDYjtRQUVBLE9BQU8sQ0FBQyxHQUFHWSxXQUFXLENBQUM3TixjQUFjLENBQUMsQ0FBQyxDQUFDQyxNQUFNO01BQy9DLENBQUUsQ0FBQztJQUNKOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTOE4sYUFBYUEsQ0FBQSxFQUFHO01BQ3hCLElBQUt0VixZQUFZLEVBQUc7UUFDbkIsT0FBTyxJQUFJO01BQ1o7TUFDQSxJQUFLLFVBQVUsS0FBSyxPQUFPekMsU0FBUyxDQUFDK1gsYUFBYSxJQUFJL1gsU0FBUyxDQUFDK1gsYUFBYSxDQUFDLENBQUMsRUFBRztRQUNqRixPQUFPLElBQUk7TUFDWjtNQUVBLE9BQU9QLHVCQUF1QixDQUFDLENBQUM7SUFDakM7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU1EsZUFBZUEsQ0FBRWxRLE9BQU8sRUFBRztNQUNuQyxJQUFJc0YsR0FBRyxHQUFHdEYsT0FBTyxHQUFHdEcsWUFBWSxDQUFDd0csR0FBRyxDQUFFRixPQUFRLENBQUMsR0FBRyxJQUFJO01BRXRELElBQUssQ0FBRXNGLEdBQUcsSUFBSSxDQUFFdEYsT0FBTyxDQUFDK0IsV0FBVyxJQUFJLENBQUUvSixJQUFJLENBQUN1SyxRQUFRLENBQUV2QyxPQUFRLENBQUMsRUFBRztRQUNuRSxPQUFPLEtBQUs7TUFDYjtNQUNBLElBQUtsRyxjQUFjLElBQUlBLGNBQWMsS0FBS2tHLE9BQU8sRUFBRztRQUNuRCxJQUFLL0UsaUJBQWlCLENBQUMrSCxTQUFTLENBQUMsQ0FBQyxFQUFHO1VBQ3BDLE9BQU8sS0FBSztRQUNiO1FBQ0EvSCxpQkFBaUIsQ0FBQ3NKLGFBQWEsQ0FBRSxjQUFjLEVBQUUsS0FBTSxDQUFDO01BQ3pEO01BQ0FtSCxtQkFBbUIsQ0FBRXBHLEdBQUksQ0FBQztNQUUxQixPQUFPLElBQUk7SUFDWjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBUzZLLDRCQUE0QkEsQ0FBRW5RLE9BQU8sRUFBRW9RLEtBQUssRUFBRztNQUN2RCxJQUFJZixJQUFJLEdBQUdyUCxPQUFPLEdBQUduRyxhQUFhLENBQUNxRyxHQUFHLENBQUVGLE9BQVEsQ0FBQyxHQUFHLElBQUk7TUFFeEQsSUFDQyxDQUFFQSxPQUFPLElBQ04sQ0FBRXFQLElBQUksSUFDTixDQUFFclAsT0FBTyxDQUFDK0IsV0FBVyxJQUNyQixDQUFFc04sSUFBSSxDQUFDdE4sV0FBVyxJQUNsQixDQUFFL0osSUFBSSxDQUFDdUssUUFBUSxDQUFFdkMsT0FBUSxDQUFDLElBQzFCLENBQUVoSSxJQUFJLENBQUN1SyxRQUFRLENBQUU4TSxJQUFLLENBQUMsSUFDdkIsVUFBVSxLQUFLLE9BQU9uWCxTQUFTLENBQUNtWSxvQkFBb0IsRUFDdEQ7UUFDRCxPQUFPLEtBQUs7TUFDYjtNQUNBLElBQUtELEtBQUssRUFBRztRQUNaQSxLQUFLLENBQUNFLGNBQWMsQ0FBQyxDQUFDO1FBQ3RCRixLQUFLLENBQUNHLGVBQWUsQ0FBQyxDQUFDO01BQ3hCO01BQ0F0VixpQkFBaUIsQ0FBQ3NKLGFBQWEsQ0FBRSxtQkFBbUIsRUFBRSxLQUFNLENBQUM7TUFDN0QsSUFBSyxVQUFVLEtBQUssT0FBT3JNLFNBQVMsQ0FBQ21ZLG9CQUFvQixFQUFHO1FBQzNEblksU0FBUyxDQUFDbVksb0JBQW9CLENBQUVoQixJQUFLLENBQUM7TUFDdkM7TUFFQSxPQUFPLElBQUk7SUFDWjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTbUIsb0JBQW9CQSxDQUFFSixLQUFLLEVBQUc7TUFDdEMsSUFBSXBRLE9BQU8sR0FBRytPLFdBQVcsQ0FBRXFCLEtBQUssQ0FBQ0ssTUFBTyxDQUFDO01BRXpDLElBQUssQ0FBRXpRLE9BQU8sSUFBSWlRLGFBQWEsQ0FBQyxDQUFDLEVBQUc7UUFDbkMsT0FBTyxLQUFLO01BQ2I7TUFDQSxJQUFLblcsY0FBYyxLQUFLa0csT0FBTyxLQUFNL0UsaUJBQWlCLENBQUNvSixPQUFPLENBQUMsQ0FBQyxJQUFJcEosaUJBQWlCLENBQUMrSCxTQUFTLENBQUMsQ0FBQyxDQUFFLEVBQUc7UUFDckcsSUFBS29OLEtBQUssRUFBRztVQUNaQSxLQUFLLENBQUNFLGNBQWMsQ0FBQyxDQUFDO1FBQ3ZCO1FBRUEsT0FBT3JWLGlCQUFpQixDQUFDc0osYUFBYSxDQUFFLGdCQUFnQixFQUFFLEtBQU0sQ0FBQztNQUNsRTtNQUNBLElBQUssQ0FBRTJMLGVBQWUsQ0FBRWxRLE9BQVEsQ0FBQyxFQUFHO1FBQ25DLE9BQU8sS0FBSztNQUNiO01BQ0EsSUFBS29RLEtBQUssRUFBRztRQUNaQSxLQUFLLENBQUNFLGNBQWMsQ0FBQyxDQUFDO01BQ3ZCO01BRUEsT0FBT3JWLGlCQUFpQixDQUFDeVYsSUFBSSxDQUFFMVEsT0FBUSxDQUFDO0lBQ3pDOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVMyUSxhQUFhQSxDQUFBLEVBQUc7TUFDeEJoVyxZQUFZLEdBQUcsSUFBSTtNQUNuQk0saUJBQWlCLENBQUMyVixtQkFBbUIsQ0FBQyxDQUFDO01BQ3ZDdk4sNkJBQTZCLENBQUMsQ0FBQztNQUMvQjNMLE1BQU0sQ0FBQ21aLFlBQVksQ0FBRXhXLFlBQWEsQ0FBQztNQUNuQ0EsWUFBWSxHQUFHM0MsTUFBTSxDQUFDb1osVUFBVSxDQUFFLFlBQVk7UUFDN0NuVyxZQUFZLEdBQUcsS0FBSztRQUNwQk4sWUFBWSxHQUFHLENBQUM7TUFDakIsQ0FBQyxFQUFFaEIsc0JBQXVCLENBQUM7SUFDNUI7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVMwWCxzQkFBc0JBLENBQUEsRUFBRztNQUNqQzFOLDZCQUE2QixDQUFDLENBQUM7SUFDaEM7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBUzJOLDBCQUEwQkEsQ0FBRVosS0FBSyxFQUFHO01BQzVDLElBQUtBLEtBQUssQ0FBQ0ssTUFBTSxJQUFJLEtBQUssS0FBS0wsS0FBSyxDQUFDSyxNQUFNLENBQUNRLFFBQVEsRUFBRztRQUN0RDVOLDZCQUE2QixDQUFDLENBQUM7TUFDaEM7SUFDRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTNk4sdUJBQXVCQSxDQUFBLEVBQUc7TUFDbEMsSUFBSUMsZ0JBQWdCLEdBQUdwVyxhQUFhLENBQUN1RSxLQUFLLENBQUNDLFVBQVU7TUFDckQsSUFBSTZSLGtCQUFrQixHQUFHclcsYUFBYSxDQUFDdUUsS0FBSyxDQUFDRSxZQUFZO01BQ3pELElBQUk2UixxQkFBcUI7TUFDekIsSUFBSUMsa0JBQWtCO01BQ3RCLElBQUlDLGtCQUFrQixHQUFHLElBQUk7TUFFN0IsSUFBSyxDQUFFOVcsc0JBQXNCLEVBQUc7UUFDL0I7TUFDRDtNQUNBQSxzQkFBc0IsR0FBRyxLQUFLO01BQzlCLElBQUssQ0FBRVEsaUJBQWlCLENBQUMrSCxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUVtTyxnQkFBZ0IsRUFBRztRQUM1RDNXLGlCQUFpQixHQUFHLEVBQUU7UUFDdEI7TUFDRDtNQUNBNlcscUJBQXFCLEdBQUc3VyxpQkFBaUIsQ0FBQzJQLE1BQU0sQ0FBRSxVQUFXbkYsU0FBUyxFQUFHO1FBQ3hFLE9BQU9BLFNBQVMsQ0FBQy9FLE9BQU8sQ0FBQ1YsVUFBVSxLQUFLNFIsZ0JBQWdCLElBQ3BEbk0sU0FBUyxDQUFDaEYsT0FBTyxDQUFDK0IsV0FBVyxJQUM3Qi9KLElBQUksQ0FBQ3VLLFFBQVEsQ0FBRXlDLFNBQVMsQ0FBQ2hGLE9BQVEsQ0FBQztNQUN2QyxDQUFFLENBQUM7TUFDSHNSLGtCQUFrQixHQUFHRCxxQkFBcUIsQ0FBQ2xILE1BQU0sQ0FBRSxVQUFXbkYsU0FBUyxFQUFHO1FBQ3pFLE9BQU8sY0FBYyxLQUFLckMsMkJBQTJCLENBQUVxQyxTQUFTLENBQUNoRixPQUFRLENBQUM7TUFDM0UsQ0FBRSxDQUFDO01BQ0h1UixrQkFBa0IsR0FBR0Qsa0JBQWtCLENBQUNuSCxNQUFNLENBQUUsVUFBV25GLFNBQVMsRUFBRztRQUN0RSxPQUFPQSxTQUFTLENBQUMvRSxPQUFPLENBQUNULFlBQVksS0FBSzRSLGtCQUFrQjtNQUM3RCxDQUFFLENBQUMsQ0FBRSxDQUFDLENBQUUsSUFBSUUsa0JBQWtCLENBQUUsQ0FBQyxDQUFFLElBQUlELHFCQUFxQixDQUFDbEgsTUFBTSxDQUFFLFVBQVduRixTQUFTLEVBQUc7UUFDM0YsT0FBT0EsU0FBUyxDQUFDL0UsT0FBTyxDQUFDVCxZQUFZLEtBQUs0UixrQkFBa0I7TUFDN0QsQ0FBRSxDQUFDLENBQUUsQ0FBQyxDQUFFLElBQUlDLHFCQUFxQixDQUFFLENBQUMsQ0FBRSxJQUFJLElBQUk7TUFDOUM3VyxpQkFBaUIsR0FBRyxFQUFFO01BQ3RCLElBQUssQ0FBRStXLGtCQUFrQixFQUFHO1FBQzNCdFcsaUJBQWlCLENBQUNzSixhQUFhLENBQUUsNEJBQTRCLEVBQUUsS0FBTSxDQUFDO1FBQ3RFO01BQ0Q7TUFDQSxJQUFLLENBQUV0SixpQkFBaUIsQ0FBQ3VXLGNBQWMsQ0FBRUQsa0JBQWtCLENBQUN2UixPQUFRLENBQUMsRUFBRztRQUN2RS9FLGlCQUFpQixDQUFDc0osYUFBYSxDQUFFLDRCQUE0QixFQUFFLEtBQU0sQ0FBQztRQUN0RTtNQUNEO01BQ0F6SyxjQUFjLEdBQUd5WCxrQkFBa0IsQ0FBQ3ZSLE9BQU87TUFDM0NqRixhQUFhLENBQUN1RSxLQUFLLEdBQUdpUyxrQkFBa0IsQ0FBQ3RSLE9BQU87TUFDaERQLGdCQUFnQixDQUFFLFdBQVcsRUFBRWlELDJCQUEyQixDQUFFN0ksY0FBZSxDQUFFLENBQUM7TUFDOUU0RixnQkFBZ0IsQ0FBRSxTQUFTLEVBQUUsTUFBTyxDQUFDO01BQ3JDZ00sbUJBQW1CLENBQUU2RixrQkFBa0IsQ0FBQ2pNLEdBQUksQ0FBQztNQUM3Q3JDLHVCQUF1QixDQUFDLENBQUM7TUFDekIsSUFDQyxxQkFBcUIsS0FBS2xJLGFBQWEsQ0FBQzBFLFNBQVMsSUFDOUMsQ0FBRS9FLG1CQUFtQixJQUNyQk8saUJBQWlCLENBQUN1SixZQUFZLENBQUMsQ0FBQyxJQUNoQyxtQkFBbUIsS0FBS3ZKLGlCQUFpQixDQUFDd0oscUJBQXFCLENBQUMsQ0FBQyxFQUNuRTtRQUNEeEosaUJBQWlCLENBQUN5SixNQUFNLENBQUMsQ0FBQztRQUMxQjtNQUNEO01BQ0FyQiw2QkFBNkIsQ0FBQyxDQUFDO0lBQ2hDOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNvTyxvQkFBb0JBLENBQUVyQixLQUFLLEVBQUc7TUFDdEMsSUFBSXNCLFlBQVksR0FBR3RCLEtBQUssQ0FBQ0ssTUFBTSxDQUFDdEIsT0FBTyxDQUFFLG9DQUFxQyxDQUFDO01BQy9FLElBQUl3QyxXQUFXLEdBQUd2QixLQUFLLENBQUNLLE1BQU0sQ0FBQ3RCLE9BQU8sQ0FBRSwyQ0FBNEMsQ0FBQztNQUNyRixJQUFJblAsT0FBTyxHQUFHbEcsY0FBYztNQUU1QixJQUFLNFgsWUFBWSxFQUFHO1FBQ25CdEIsS0FBSyxDQUFDRSxjQUFjLENBQUMsQ0FBQztRQUN0QkYsS0FBSyxDQUFDRyxlQUFlLENBQUMsQ0FBQztRQUN2QnZSLFlBQVksQ0FBQyxDQUFDO1FBQ2Q7TUFDRDtNQUNBLElBQUssQ0FBRTJTLFdBQVcsRUFBRztRQUNwQjtNQUNEO01BQ0F4Qiw0QkFBNEIsQ0FBRW5RLE9BQU8sRUFBRW9RLEtBQU0sQ0FBQztJQUMvQzs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU3dCLG9CQUFvQkEsQ0FBRXhCLEtBQUssRUFBRztNQUN0QyxJQUNDLENBQUVuVixpQkFBaUIsQ0FBQytILFNBQVMsQ0FBQyxDQUFDLElBQzVCLFVBQVUsS0FBSyxPQUFPOUssU0FBUyxDQUFDMlosZUFBZSxFQUNqRDtRQUNEO01BQ0Q7TUFDQSxJQUFLM1osU0FBUyxDQUFDMlosZUFBZSxDQUFFekIsS0FBTSxDQUFDLEVBQUc7UUFDekNBLEtBQUssQ0FBQ0UsY0FBYyxDQUFDLENBQUM7TUFDdkI7SUFDRDtJQUVBdFksSUFBSSxDQUFDOFosZ0JBQWdCLENBQUUsTUFBTSxFQUFFZCwwQkFBMEIsRUFBRSxJQUFLLENBQUM7SUFDakU5VixlQUFlLENBQUM0VyxnQkFBZ0IsQ0FBRSxPQUFPLEVBQUVMLG9CQUFxQixDQUFDO0lBQ2pFdlcsZUFBZSxDQUFDNFcsZ0JBQWdCLENBQUUsT0FBTyxFQUFFRixvQkFBb0IsRUFBRTtNQUFFRyxPQUFPLEVBQUU7SUFBTSxDQUFFLENBQUM7SUFDckYvWixJQUFJLENBQUM4WixnQkFBZ0IsQ0FBRSxRQUFRLEVBQUVuQixhQUFhLEVBQUUsSUFBSyxDQUFDO0lBQ3REalosTUFBTSxDQUFDb2EsZ0JBQWdCLENBQUUsUUFBUSxFQUFFbkIsYUFBYSxFQUFFO01BQUVvQixPQUFPLEVBQUU7SUFBSyxDQUFFLENBQUM7SUFDckVyYSxNQUFNLENBQUNvYSxnQkFBZ0IsQ0FBRSxRQUFRLEVBQUVmLHNCQUFzQixFQUFFO01BQUVnQixPQUFPLEVBQUU7SUFBSyxDQUFFLENBQUM7SUFDOUUsSUFBS3JhLE1BQU0sQ0FBQzJJLGNBQWMsRUFBRztNQUM1QjNJLE1BQU0sQ0FBQzJJLGNBQWMsQ0FBQ3lSLGdCQUFnQixDQUFFLFFBQVEsRUFBRWYsc0JBQXNCLEVBQUU7UUFBRWdCLE9BQU8sRUFBRTtNQUFLLENBQUUsQ0FBQztNQUM3RnJhLE1BQU0sQ0FBQzJJLGNBQWMsQ0FBQ3lSLGdCQUFnQixDQUFFLFFBQVEsRUFBRW5CLGFBQWEsRUFBRTtRQUFFb0IsT0FBTyxFQUFFO01BQUssQ0FBRSxDQUFDO0lBQ3JGO0lBRUEsT0FBTztNQUNOO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO01BQ0dDLFlBQVksRUFBRSxTQUFBQSxDQUFXaFMsT0FBTyxFQUFFb1EsS0FBSyxFQUFHO1FBQ3pDLE9BQU9JLG9CQUFvQixDQUFFO1VBQzVCQyxNQUFNLEVBQUV6USxPQUFPO1VBQ2ZzUSxjQUFjLEVBQUUsU0FBQUEsQ0FBQSxFQUFZO1lBQzNCLElBQUtGLEtBQUssSUFBSSxVQUFVLEtBQUssT0FBT0EsS0FBSyxDQUFDRSxjQUFjLEVBQUc7Y0FDMURGLEtBQUssQ0FBQ0UsY0FBYyxDQUFDLENBQUM7WUFDdkI7VUFDRDtRQUNELENBQUUsQ0FBQztNQUNKLENBQUM7TUFDRDtBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7TUFDRzJCLGFBQWEsRUFBRSxTQUFBQSxDQUFXalMsT0FBTyxFQUFFb1EsS0FBSyxFQUFHO1FBQzFDLElBQUssQ0FBRW5WLGlCQUFpQixDQUFDb0osT0FBTyxDQUFDLENBQUMsRUFBRztVQUNwQyxPQUFPLEtBQUs7UUFDYjtRQUVBLE9BQU9wSixpQkFBaUIsQ0FBQ2lYLHNCQUFzQixDQUFFbFMsT0FBTyxFQUFFb1EsS0FBTSxDQUFDO01BQ2xFLENBQUM7TUFDRDtBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7TUFDRytCLFFBQVEsRUFBRSxTQUFBQSxDQUFXblMsT0FBTyxFQUFFcVAsSUFBSSxFQUFFL0osR0FBRyxFQUFFQyxnQkFBZ0IsRUFBRztRQUMzRCxJQUFJNk0sY0FBYyxHQUFHL00sYUFBYSxDQUFFQyxHQUFHLEVBQUVDLGdCQUFpQixDQUFDO1FBQzNELElBQUk4TSxlQUFlO1FBRW5CLElBQ0NyUyxPQUFPLElBQ0pxUCxJQUFJLElBQ0orQyxjQUFjLElBQ2RwYSxJQUFJLENBQUN1SyxRQUFRLENBQUV2QyxPQUFRLENBQUMsSUFDeEJoSSxJQUFJLENBQUN1SyxRQUFRLENBQUU4TSxJQUFLLENBQUMsSUFDckJELHVCQUF1QixDQUFFcFAsT0FBTyxFQUFFcVAsSUFBSSxFQUFFK0MsY0FBZSxDQUFDLElBQ3hEblgsaUJBQWlCLENBQUNxWCxlQUFlLENBQUV0UyxPQUFRLENBQUMsRUFDOUM7VUFDRHRHLFlBQVksQ0FBQ2lVLEdBQUcsQ0FBRTNOLE9BQU8sRUFBRW9TLGNBQWUsQ0FBQztVQUMzQ3ZZLGFBQWEsQ0FBQzhULEdBQUcsQ0FBRTNOLE9BQU8sRUFBRXFQLElBQUssQ0FBQztVQUNsQ2dELGVBQWUsR0FBRztZQUNqQjlTLFVBQVUsRUFBRTZTLGNBQWMsQ0FBQzdTLFVBQVU7WUFDckN2RixpQkFBaUIsRUFBRUEsaUJBQWlCO1lBQ3BDd0YsWUFBWSxFQUFFakgsTUFBTSxDQUFFOFcsSUFBSSxDQUFDdEUsWUFBWSxDQUFFLCtCQUFnQyxDQUFDLElBQUksRUFBRztVQUNsRixDQUFDO1VBQ0RuUixnQkFBZ0IsQ0FBQytULEdBQUcsQ0FBRTNOLE9BQU8sRUFBRXFTLGVBQWdCLENBQUM7VUFDaEQsSUFDQzVYLHNCQUFzQixJQUNuQlEsaUJBQWlCLENBQUMrSCxTQUFTLENBQUMsQ0FBQyxJQUM3QmpJLGFBQWEsQ0FBQ3VFLEtBQUssQ0FBQ0MsVUFBVSxLQUFLOFMsZUFBZSxDQUFDOVMsVUFBVSxFQUMvRDtZQUNEL0UsaUJBQWlCLENBQUMrWCxJQUFJLENBQUU7Y0FDdkJ2UyxPQUFPLEVBQUVBLE9BQU87Y0FDaEJDLE9BQU8sRUFBRW9TLGVBQWU7Y0FDeEIvTSxHQUFHLEVBQUU4TTtZQUNOLENBQUUsQ0FBQztVQUNKO1FBQ0Q7TUFDRCxDQUFDO01BQ0Q7QUFDSDtBQUNBO0FBQ0E7QUFDQTtNQUNHSSxnQkFBZ0IsRUFBRXRCLHVCQUF1QjtNQUN6QztBQUNIO0FBQ0E7QUFDQTtBQUNBO01BQ0d1QixPQUFPLEVBQUUsU0FBQUEsQ0FBQSxFQUFZO1FBQ3BCLElBQUlDLFVBQVUsR0FBR3pYLGlCQUFpQixDQUFDK0gsU0FBUyxDQUFDLENBQUM7UUFFOUNoSixpQkFBaUIsSUFBSSxDQUFDO1FBQ3RCbUosc0JBQXNCLENBQUMsQ0FBQztRQUN4QjNJLGlCQUFpQixHQUFHLEVBQUU7UUFDdEJDLHNCQUFzQixHQUFHaVksVUFBVTtRQUNuQyxJQUFLNVksY0FBYyxFQUFHO1VBQ3JCNEYsZ0JBQWdCLENBQUUsWUFBWSxFQUFFLHVCQUF3QixDQUFDO1VBQ3pEQSxnQkFBZ0IsQ0FBRSxXQUFXLEVBQUUscUJBQXNCLENBQUM7UUFDdkQ7UUFDQSxJQUFLZ1QsVUFBVSxFQUFHO1VBQ2pCelgsaUJBQWlCLENBQUNxSixPQUFPLENBQUUsbUJBQW9CLENBQUM7UUFDakQsQ0FBQyxNQUFNO1VBQ05ySixpQkFBaUIsQ0FBQ3NKLGFBQWEsQ0FBRSxjQUFjLEVBQUUsS0FBTSxDQUFDO1FBQ3pEO1FBQ0FvSyxtQkFBbUIsQ0FBQyxDQUFDO1FBQ3JCalYsWUFBWSxHQUFHLElBQUloQyxNQUFNLENBQUNpQyxPQUFPLENBQUMsQ0FBQztRQUNuQ0MsZ0JBQWdCLEdBQUcsSUFBSWxDLE1BQU0sQ0FBQ2lDLE9BQU8sQ0FBQyxDQUFDO1FBQ3ZDRSxhQUFhLEdBQUcsSUFBSW5DLE1BQU0sQ0FBQ2lDLE9BQU8sQ0FBQyxDQUFDO01BQ3JDLENBQUM7TUFDRDtBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7TUFDR2daLFVBQVUsRUFBRSxTQUFBQSxDQUFXcFQsVUFBVSxFQUFHO1FBQ25DQSxVQUFVLEdBQUdzQixJQUFJLENBQUNDLEdBQUcsQ0FBRSxDQUFDLEVBQUVELElBQUksQ0FBQ3VFLEtBQUssQ0FBRTdFLE1BQU0sQ0FBRWhCLFVBQVcsQ0FBQyxJQUFJLENBQUUsQ0FBRSxDQUFDO1FBQ25FLElBQUtBLFVBQVUsSUFBSUEsVUFBVSxLQUFLeEUsYUFBYSxDQUFDdUUsS0FBSyxDQUFDQyxVQUFVLEVBQUc7VUFDbEV3RixrQkFBa0IsQ0FBRXhGLFVBQVUsRUFBRSxJQUFLLENBQUM7VUFDdENHLGdCQUFnQixDQUFFLFNBQVMsRUFBRSxNQUFPLENBQUM7VUFDckMsSUFBS3pFLGlCQUFpQixDQUFDK0gsU0FBUyxDQUFDLENBQUMsRUFBRztZQUNwQ3RELGdCQUFnQixDQUFFLFlBQVksRUFBRSx1QkFBd0IsQ0FBQztZQUN6RHpFLGlCQUFpQixDQUFDcUosT0FBTyxDQUFFLG1CQUFvQixDQUFDO1lBQ2hEO1VBQ0Q7VUFDQXJKLGlCQUFpQixDQUFDc0osYUFBYSxDQUFFLDRCQUE0QixFQUFFLEtBQU0sQ0FBQztVQUN0RTtRQUNEO1FBQ0FRLGtCQUFrQixDQUFFeEYsVUFBVSxFQUFFLElBQUssQ0FBQztNQUN2QyxDQUFDO01BQ0Q7QUFDSDtBQUNBO0FBQ0E7QUFDQTtNQUNHK0UsT0FBTyxFQUFFLFNBQUFBLENBQUEsRUFBWTtRQUNwQjVKLG1CQUFtQixHQUFHLElBQUk7UUFDMUIsSUFBS08saUJBQWlCLENBQUMrSCxTQUFTLENBQUMsQ0FBQyxFQUFHO1VBQ3BDL0gsaUJBQWlCLENBQUNxSixPQUFPLENBQUUsZ0JBQWlCLENBQUM7VUFDN0M7UUFDRDtRQUNBckosaUJBQWlCLENBQUNzSixhQUFhLENBQUUsY0FBYyxFQUFFLEtBQU0sQ0FBQztNQUN6RCxDQUFDO01BQ0Q7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtNQUNHRyxNQUFNLEVBQUUsU0FBQUEsQ0FBQSxFQUFZO1FBQ25CaEssbUJBQW1CLEdBQUcsS0FBSztRQUMzQixJQUFLLENBQUVPLGlCQUFpQixDQUFDK0gsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFFL0gsaUJBQWlCLENBQUN1SixZQUFZLENBQUMsQ0FBQyxFQUFHO1VBQzVFO1FBQ0Q7UUFDQSxJQUNDLENBQUUxSyxjQUFjLElBQ2IsQ0FBRUEsY0FBYyxDQUFDaUksV0FBVyxJQUM1QixDQUFFL0osSUFBSSxDQUFDdUssUUFBUSxDQUFFekksY0FBZSxDQUFDLElBQ2pDLENBQUVKLFlBQVksQ0FBQytULEdBQUcsQ0FBRTNULGNBQWUsQ0FBQyxJQUNwQyxDQUFFRCxhQUFhLENBQUM0VCxHQUFHLENBQUUzVCxjQUFlLENBQUMsRUFDdkM7VUFDRG1CLGlCQUFpQixDQUFDc0osYUFBYSxDQUFFLDRCQUE0QixFQUFFLEtBQU0sQ0FBQztVQUN0RTtRQUNEO1FBQ0EsSUFBSyxxQkFBcUIsS0FBSzVCLDJCQUEyQixDQUFFN0ksY0FBZSxDQUFDLEVBQUc7VUFDOUU0RixnQkFBZ0IsQ0FBRSxXQUFXLEVBQUVpRCwyQkFBMkIsQ0FBRTdJLGNBQWUsQ0FBRSxDQUFDO1VBQzlFdUosNkJBQTZCLENBQUMsQ0FBQztVQUMvQjtRQUNEO1FBQ0EsSUFBS3BJLGlCQUFpQixDQUFDeUosTUFBTSxDQUFDLENBQUMsRUFBRztVQUNqQ2hGLGdCQUFnQixDQUFFLFlBQVksRUFBRSxRQUFTLENBQUM7VUFDMUNBLGdCQUFnQixDQUFFLFdBQVcsRUFBRWlELDJCQUEyQixDQUFFN0ksY0FBZSxDQUFFLENBQUM7UUFDL0U7TUFDRCxDQUFDO01BQ0Q7QUFDSDtBQUNBO0FBQ0E7QUFDQTtNQUNHdUssT0FBTyxFQUFFLFNBQUFBLENBQUEsRUFBWTtRQUNwQixPQUFPcEosaUJBQWlCLENBQUNvSixPQUFPLENBQUMsQ0FBQztNQUNuQyxDQUFDO01BQ0Q7QUFDSDtBQUNBO0FBQ0E7QUFDQTtNQUNHdU8sZUFBZSxFQUFFdlAsNkJBQTZCO01BQzlDO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7TUFDR3dQLFNBQVMsRUFBRS9QLGlCQUFpQjtNQUM1QjtBQUNIO0FBQ0E7QUFDQTtBQUNBO01BQ0dnUSxPQUFPLEVBQUUsU0FBQUEsQ0FBQSxFQUFZO1FBQ3BCcGIsTUFBTSxDQUFDbVosWUFBWSxDQUFFeFcsWUFBYSxDQUFDO1FBQ25DOEksc0JBQXNCLENBQUMsQ0FBQztRQUN4QndMLG1CQUFtQixDQUFDLENBQUM7UUFDckIzVyxJQUFJLENBQUMrYSxtQkFBbUIsQ0FBRSxNQUFNLEVBQUUvQiwwQkFBMEIsRUFBRSxJQUFLLENBQUM7UUFDcEU5VixlQUFlLENBQUM2WCxtQkFBbUIsQ0FBRSxPQUFPLEVBQUV0QixvQkFBcUIsQ0FBQztRQUNwRXZXLGVBQWUsQ0FBQzZYLG1CQUFtQixDQUFFLE9BQU8sRUFBRW5CLG9CQUFxQixDQUFDO1FBQ3BFNVosSUFBSSxDQUFDK2EsbUJBQW1CLENBQUUsUUFBUSxFQUFFcEMsYUFBYSxFQUFFLElBQUssQ0FBQztRQUN6RGpaLE1BQU0sQ0FBQ3FiLG1CQUFtQixDQUFFLFFBQVEsRUFBRXBDLGFBQWMsQ0FBQztRQUNyRGpaLE1BQU0sQ0FBQ3FiLG1CQUFtQixDQUFFLFFBQVEsRUFBRWhDLHNCQUF1QixDQUFDO1FBQzlELElBQUtyWixNQUFNLENBQUMySSxjQUFjLEVBQUc7VUFDNUIzSSxNQUFNLENBQUMySSxjQUFjLENBQUMwUyxtQkFBbUIsQ0FBRSxRQUFRLEVBQUVoQyxzQkFBdUIsQ0FBQztVQUM3RXJaLE1BQU0sQ0FBQzJJLGNBQWMsQ0FBQzBTLG1CQUFtQixDQUFFLFFBQVEsRUFBRXBDLGFBQWMsQ0FBQztRQUNyRTtRQUNBMVYsaUJBQWlCLENBQUM2WCxPQUFPLENBQUMsQ0FBQztRQUMzQnZZLHdCQUF3QixHQUFHLElBQUk7UUFDL0JDLGlCQUFpQixHQUFHLEVBQUU7UUFDdEJkLFlBQVksR0FBRyxJQUFJaEMsTUFBTSxDQUFDaUMsT0FBTyxDQUFDLENBQUM7UUFDbkNDLGdCQUFnQixHQUFHLElBQUlsQyxNQUFNLENBQUNpQyxPQUFPLENBQUMsQ0FBQztRQUN2Q0UsYUFBYSxHQUFHLElBQUluQyxNQUFNLENBQUNpQyxPQUFPLENBQUMsQ0FBQztRQUNwQ0csY0FBYyxHQUFHLElBQUk7UUFDckJpQixhQUFhLEdBQUdDLDBCQUEwQixDQUFDLENBQUM7TUFDN0M7SUFDRCxDQUFDO0VBQ0Y7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU2dZLGlCQUFpQkEsQ0FBRWhiLElBQUksRUFBRUMsYUFBYSxFQUFFQyxTQUFTLEVBQUc7SUFDNURELGFBQWEsR0FBR0EsYUFBYSxJQUFJLENBQUMsQ0FBQztJQUNuQ0MsU0FBUyxHQUFHQSxTQUFTLElBQUksQ0FBQyxDQUFDO0lBQzNCLElBQ0MsQ0FBRUYsSUFBSSxJQUNILENBQUVDLGFBQWEsQ0FBQ0UsTUFBTSxJQUN0QixDQUFFVCxNQUFNLENBQUNXLDhCQUE4QixJQUN2QyxVQUFVLEtBQUssT0FBT1gsTUFBTSxDQUFDVyw4QkFBOEIsQ0FBQ0MsTUFBTSxFQUNwRTtNQUNELE9BQU8sSUFBSTtJQUNaO0lBRUEsSUFBSTJhLGlCQUFpQixHQUFHMWEsTUFBTSxDQUFFTixhQUFhLENBQUNtRCxZQUFZLElBQUksRUFBRyxDQUFDLENBQUM4WCxPQUFPLENBQUUsaUJBQWlCLEVBQUUsRUFBRyxDQUFDO0lBQ25HLElBQUlDLG1CQUFtQixHQUFHLElBQUl6YixNQUFNLENBQUN3QyxHQUFHLENBQUMsQ0FBQztJQUMxQyxJQUFJa1oscUJBQXFCLEdBQUcsSUFBSTFiLE1BQU0sQ0FBQ3dDLEdBQUcsQ0FBQyxDQUFDO0lBQzVDLElBQUltWixtQkFBbUIsR0FBRyxJQUFJM2IsTUFBTSxDQUFDaUMsT0FBTyxDQUFDLENBQUM7O0lBRTlDO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVMyWixvQkFBb0JBLENBQUV0TyxTQUFTLEVBQUc7TUFDMUMsT0FBT25FLElBQUksQ0FBQ0MsR0FBRyxDQUFFLENBQUMsRUFBRUQsSUFBSSxDQUFDdUUsS0FBSyxDQUFFN0UsTUFBTSxDQUFFeUUsU0FBVSxDQUFDLElBQUksQ0FBRSxDQUFFLENBQUM7SUFDN0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU3VPLDZCQUE2QkEsQ0FBRWhVLFVBQVUsRUFBRztNQUNwRCxJQUFJaVUsc0JBQXNCLEdBQUcsQ0FBQyxDQUFDO01BQy9CLElBQUlDLFdBQVcsR0FBR1IsaUJBQWlCLEdBQUcsWUFBWSxHQUFHMVQsVUFBVTtNQUUvRG1VLE1BQU0sQ0FBQ25GLElBQUksQ0FBRXRXLGFBQWMsQ0FBQyxDQUFDNkwsT0FBTyxDQUFFLFVBQVc2UCxpQkFBaUIsRUFBRztRQUNwRUgsc0JBQXNCLENBQUVHLGlCQUFpQixDQUFFLEdBQUcxYixhQUFhLENBQUUwYixpQkFBaUIsQ0FBRTtNQUNqRixDQUFFLENBQUM7TUFDSEgsc0JBQXNCLENBQUNwWSxZQUFZLEdBQUdxWSxXQUFXO01BQ2pERCxzQkFBc0IsQ0FBQ2xZLFFBQVEsR0FBR21ZLFdBQVc7TUFDN0NELHNCQUFzQixDQUFDalksaUJBQWlCLEdBQUdrWSxXQUFXO01BRXRELE9BQU9ELHNCQUFzQjtJQUM5Qjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNJLHlCQUF5QkEsQ0FBRXJVLFVBQVUsRUFBRXNVLFVBQVUsRUFBRztNQUM1RCxJQUFJQyxhQUFhLEdBQUdWLHFCQUFxQixDQUFDbFQsR0FBRyxDQUFFWCxVQUFXLENBQUMsSUFBSSxFQUFFO01BRWpFdVUsYUFBYSxDQUFDaFEsT0FBTyxDQUFFLFVBQVdpUSxZQUFZLEVBQUc7UUFDaERGLFVBQVUsQ0FBQzFCLFFBQVEsQ0FDbEI0QixZQUFZLENBQUMvVCxPQUFPLEVBQ3BCK1QsWUFBWSxDQUFDMUUsSUFBSSxFQUNqQjBFLFlBQVksQ0FBQ3pPLEdBQUcsRUFDaEJ5TyxZQUFZLENBQUN4TyxnQkFDZCxDQUFDO01BQ0YsQ0FBRSxDQUFDO0lBQ0o7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU3lPLHNCQUFzQkEsQ0FBRXpVLFVBQVUsRUFBRztNQUM3QyxJQUFJc1UsVUFBVSxHQUFHVixtQkFBbUIsQ0FBQ2pULEdBQUcsQ0FBRVgsVUFBVyxDQUFDLElBQUksSUFBSTtNQUU5RCxJQUFLc1UsVUFBVSxFQUFHO1FBQ2pCLE9BQU9BLFVBQVU7TUFDbEI7TUFDQUEsVUFBVSxHQUFHOWIsMEJBQTBCLENBQ3RDQyxJQUFJLEVBQ0p1Yiw2QkFBNkIsQ0FBRWhVLFVBQVcsQ0FBQyxFQUMzQ3JILFNBQ0QsQ0FBQztNQUNELElBQUssQ0FBRTJiLFVBQVUsRUFBRztRQUNuQixPQUFPLElBQUk7TUFDWjtNQUNBVixtQkFBbUIsQ0FBQ3hGLEdBQUcsQ0FBRXBPLFVBQVUsRUFBRXNVLFVBQVcsQ0FBQztNQUNqREQseUJBQXlCLENBQUVyVSxVQUFVLEVBQUVzVSxVQUFXLENBQUM7TUFFbkQsT0FBT0EsVUFBVTtJQUNsQjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNyRCxvQkFBb0JBLENBQUVKLEtBQUssRUFBRztNQUN0QyxJQUFJbkIsT0FBTyxHQUFHbUIsS0FBSyxDQUFDSyxNQUFNLElBQUksQ0FBQyxLQUFLTCxLQUFLLENBQUNLLE1BQU0sQ0FBQ3ZCLFFBQVEsR0FBR2tCLEtBQUssQ0FBQ0ssTUFBTSxHQUFHLElBQUk7TUFDL0UsSUFBSXpRLE9BQU8sR0FBR2lQLE9BQU8sR0FBR0EsT0FBTyxDQUFDRSxPQUFPLENBQUUsMkNBQTRDLENBQUMsR0FBRyxJQUFJO01BQzdGLElBQUk1UCxVQUFVO01BQ2QsSUFBSXNVLFVBQVU7TUFFZCxJQUNDLENBQUU3VCxPQUFPLElBQ04sQ0FBRWhJLElBQUksQ0FBQ3VLLFFBQVEsQ0FBRXZDLE9BQVEsQ0FBQyxJQUMxQmlQLE9BQU8sQ0FBQ0UsT0FBTyxDQUFFLHlDQUEwQyxDQUFDLEVBQzlEO1FBQ0Q7TUFDRDtNQUNBNVAsVUFBVSxHQUFHK1Qsb0JBQW9CLENBQUVELG1CQUFtQixDQUFDblQsR0FBRyxDQUFFRixPQUFRLENBQUUsQ0FBQztNQUN2RTZULFVBQVUsR0FBR3RVLFVBQVUsR0FBR3lVLHNCQUFzQixDQUFFelUsVUFBVyxDQUFDLEdBQUcsSUFBSTtNQUNyRSxJQUFLc1UsVUFBVSxFQUFHO1FBQ2pCQSxVQUFVLENBQUM3QixZQUFZLENBQUVoUyxPQUFPLEVBQUVvUSxLQUFNLENBQUM7TUFDMUM7SUFDRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTOEIsc0JBQXNCQSxDQUFFOUIsS0FBSyxFQUFHO01BQ3hDLElBQUluQixPQUFPLEdBQUdtQixLQUFLLENBQUNLLE1BQU0sSUFBSSxDQUFDLEtBQUtMLEtBQUssQ0FBQ0ssTUFBTSxDQUFDdkIsUUFBUSxHQUFHa0IsS0FBSyxDQUFDSyxNQUFNLEdBQUcsSUFBSTtNQUMvRSxJQUFJelEsT0FBTyxHQUFHaVAsT0FBTyxHQUFHQSxPQUFPLENBQUNFLE9BQU8sQ0FBRSwyQ0FBNEMsQ0FBQyxHQUFHLElBQUk7TUFDN0YsSUFBSTVQLFVBQVUsR0FBR1MsT0FBTyxHQUFHc1Qsb0JBQW9CLENBQUVELG1CQUFtQixDQUFDblQsR0FBRyxDQUFFRixPQUFRLENBQUUsQ0FBQyxHQUFHLENBQUM7TUFDekYsSUFBSTZULFVBQVUsR0FBR3RVLFVBQVUsR0FBRzRULG1CQUFtQixDQUFDalQsR0FBRyxDQUFFWCxVQUFXLENBQUMsR0FBRyxJQUFJO01BRTFFLElBQUtzVSxVQUFVLElBQUlBLFVBQVUsQ0FBQ3hQLE9BQU8sQ0FBQyxDQUFDLEVBQUc7UUFDekN3UCxVQUFVLENBQUM1QixhQUFhLENBQUVqUyxPQUFPLEVBQUVvUSxLQUFNLENBQUM7TUFDM0M7SUFDRDtJQUVBcFksSUFBSSxDQUFDOFosZ0JBQWdCLENBQUUsT0FBTyxFQUFFdEIsb0JBQXFCLENBQUM7SUFDdER4WSxJQUFJLENBQUM4WixnQkFBZ0IsQ0FBRSxTQUFTLEVBQUVJLHNCQUFzQixFQUFFLElBQUssQ0FBQztJQUVoRSxPQUFPO01BQ047QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO01BQ0dDLFFBQVEsRUFBRSxTQUFBQSxDQUFXblMsT0FBTyxFQUFFcVAsSUFBSSxFQUFFL0osR0FBRyxFQUFFQyxnQkFBZ0IsRUFBRztRQUMzRCxJQUFJaEcsVUFBVSxHQUFHK1Qsb0JBQW9CLENBQUVoTyxHQUFHLElBQUlBLEdBQUcsQ0FBQy9GLFVBQVcsQ0FBQztRQUM5RCxJQUFJdVUsYUFBYTtRQUNqQixJQUFJRCxVQUFVO1FBRWQsSUFBSyxDQUFFdFUsVUFBVSxJQUFJLENBQUVTLE9BQU8sSUFBSSxDQUFFcVAsSUFBSSxJQUFJLENBQUVyWCxJQUFJLENBQUN1SyxRQUFRLENBQUV2QyxPQUFRLENBQUMsSUFBSSxDQUFFaEksSUFBSSxDQUFDdUssUUFBUSxDQUFFOE0sSUFBSyxDQUFDLEVBQUc7VUFDbkc7UUFDRDtRQUNBeUUsYUFBYSxHQUFHVixxQkFBcUIsQ0FBQ2xULEdBQUcsQ0FBRVgsVUFBVyxDQUFDLElBQUksRUFBRTtRQUM3RHVVLGFBQWEsQ0FBQ3ZCLElBQUksQ0FBRTtVQUNuQnZTLE9BQU8sRUFBRUEsT0FBTztVQUNoQnFQLElBQUksRUFBRUEsSUFBSTtVQUNWL0osR0FBRyxFQUFFQSxHQUFHO1VBQ1JDLGdCQUFnQixFQUFFQSxnQkFBZ0IsSUFBSSxDQUFDO1FBQ3hDLENBQUUsQ0FBQztRQUNINk4scUJBQXFCLENBQUN6RixHQUFHLENBQUVwTyxVQUFVLEVBQUV1VSxhQUFjLENBQUM7UUFDdERULG1CQUFtQixDQUFDMUYsR0FBRyxDQUFFM04sT0FBTyxFQUFFVCxVQUFXLENBQUM7UUFDOUNzVSxVQUFVLEdBQUdWLG1CQUFtQixDQUFDalQsR0FBRyxDQUFFWCxVQUFXLENBQUM7UUFDbEQsSUFBS3NVLFVBQVUsRUFBRztVQUNqQkEsVUFBVSxDQUFDMUIsUUFBUSxDQUFFblMsT0FBTyxFQUFFcVAsSUFBSSxFQUFFL0osR0FBRyxFQUFFQyxnQkFBZ0IsSUFBSSxDQUFDLENBQUUsQ0FBQztRQUNsRTtNQUNELENBQUM7TUFDRDtBQUNIO0FBQ0E7QUFDQTtBQUNBO01BQ0drTixPQUFPLEVBQUUsU0FBQUEsQ0FBQSxFQUFZO1FBQ3BCVSxtQkFBbUIsQ0FBQ3JQLE9BQU8sQ0FBRSxVQUFXK1AsVUFBVSxFQUFHO1VBQ3BEQSxVQUFVLENBQUNwQixPQUFPLENBQUMsQ0FBQztRQUNyQixDQUFFLENBQUM7UUFDSFcscUJBQXFCLENBQUN0RSxLQUFLLENBQUMsQ0FBQztRQUM3QnVFLG1CQUFtQixHQUFHLElBQUkzYixNQUFNLENBQUNpQyxPQUFPLENBQUMsQ0FBQztNQUMzQyxDQUFDO01BQ0Q7QUFDSDtBQUNBO0FBQ0E7QUFDQTtNQUNHNlksZ0JBQWdCLEVBQUUsU0FBQUEsQ0FBQSxFQUFZO1FBQzdCVyxtQkFBbUIsQ0FBQ3JQLE9BQU8sQ0FBRSxVQUFXK1AsVUFBVSxFQUFHO1VBQ3BEQSxVQUFVLENBQUNyQixnQkFBZ0IsQ0FBQyxDQUFDO1FBQzlCLENBQUUsQ0FBQztNQUNKLENBQUM7TUFDRDtBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7TUFDR0csVUFBVSxFQUFFLFNBQUFBLENBQVdwVCxVQUFVLEVBQUc7UUFDbkMsSUFBSXNVLFVBQVUsR0FBR1YsbUJBQW1CLENBQUNqVCxHQUFHLENBQUVvVCxvQkFBb0IsQ0FBRS9ULFVBQVcsQ0FBRSxDQUFDO1FBRTlFLElBQUtzVSxVQUFVLEVBQUc7VUFDakJBLFVBQVUsQ0FBQ2xCLFVBQVUsQ0FBRXBULFVBQVcsQ0FBQztRQUNwQztNQUNELENBQUM7TUFDRDtBQUNIO0FBQ0E7QUFDQTtBQUNBO01BQ0crRSxPQUFPLEVBQUUsU0FBQUEsQ0FBQSxFQUFZO1FBQ3BCNk8sbUJBQW1CLENBQUNyUCxPQUFPLENBQUUsVUFBVytQLFVBQVUsRUFBRztVQUNwREEsVUFBVSxDQUFDdlAsT0FBTyxDQUFDLENBQUM7UUFDckIsQ0FBRSxDQUFDO01BQ0osQ0FBQztNQUNEO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7TUFDR0ksTUFBTSxFQUFFLFNBQUFBLENBQUEsRUFBWTtRQUNuQnlPLG1CQUFtQixDQUFDclAsT0FBTyxDQUFFLFVBQVcrUCxVQUFVLEVBQUc7VUFDcERBLFVBQVUsQ0FBQ25QLE1BQU0sQ0FBQyxDQUFDO1FBQ3BCLENBQUUsQ0FBQztNQUNKLENBQUM7TUFDRDtBQUNIO0FBQ0E7QUFDQTtBQUNBO01BQ0drTyxlQUFlLEVBQUUsU0FBQUEsQ0FBQSxFQUFZO1FBQzVCTyxtQkFBbUIsQ0FBQ3JQLE9BQU8sQ0FBRSxVQUFXK1AsVUFBVSxFQUFHO1VBQ3BEQSxVQUFVLENBQUNqQixlQUFlLENBQUMsQ0FBQztRQUM3QixDQUFFLENBQUM7TUFDSixDQUFDO01BQ0Q7QUFDSDtBQUNBO0FBQ0E7QUFDQTtNQUNHdk8sT0FBTyxFQUFFLFNBQUFBLENBQUEsRUFBWTtRQUNwQixJQUFJQSxPQUFPLEdBQUcsS0FBSztRQUVuQjhPLG1CQUFtQixDQUFDclAsT0FBTyxDQUFFLFVBQVcrUCxVQUFVLEVBQUc7VUFDcER4UCxPQUFPLEdBQUdBLE9BQU8sSUFBSXdQLFVBQVUsQ0FBQ3hQLE9BQU8sQ0FBQyxDQUFDO1FBQzFDLENBQUUsQ0FBQztRQUVILE9BQU9BLE9BQU87TUFDZixDQUFDO01BQ0Q7QUFDSDtBQUNBO0FBQ0E7QUFDQTtNQUNHeU8sT0FBTyxFQUFFLFNBQUFBLENBQUEsRUFBWTtRQUNwQjlhLElBQUksQ0FBQythLG1CQUFtQixDQUFFLE9BQU8sRUFBRXZDLG9CQUFxQixDQUFDO1FBQ3pEeFksSUFBSSxDQUFDK2EsbUJBQW1CLENBQUUsU0FBUyxFQUFFYixzQkFBc0IsRUFBRSxJQUFLLENBQUM7UUFDbkVpQixtQkFBbUIsQ0FBQ3JQLE9BQU8sQ0FBRSxVQUFXK1AsVUFBVSxFQUFHO1VBQ3BEQSxVQUFVLENBQUNmLE9BQU8sQ0FBQyxDQUFDO1FBQ3JCLENBQUUsQ0FBQztRQUNISyxtQkFBbUIsQ0FBQ3JFLEtBQUssQ0FBQyxDQUFDO1FBQzNCc0UscUJBQXFCLENBQUN0RSxLQUFLLENBQUMsQ0FBQztRQUM3QnVFLG1CQUFtQixHQUFHLElBQUkzYixNQUFNLENBQUNpQyxPQUFPLENBQUMsQ0FBQztNQUMzQztJQUNELENBQUM7RUFDRjtFQUVBakMsTUFBTSxDQUFDSSw2QkFBNkIsQ0FBQ2tiLGlCQUFpQixHQUFHQSxpQkFBaUI7QUFDM0UsQ0FBQyxFQUFFdGIsTUFBTSxFQUFFQyxRQUFRLEVBQUVELE1BQU0sQ0FBQ0UsRUFBRSxFQUFFRixNQUFNLENBQUN1YyxNQUFPLENBQUMiLCJpZ25vcmVMaXN0IjpbXX0=
