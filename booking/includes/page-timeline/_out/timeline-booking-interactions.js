"use strict";

/**
 * Timeline booking selection, control rails, Inspector, and Overview adapter.
 *
 * The module owns browser-only booking interaction state and geometry. Timeline
 * continues to own authorized window reads and rendering, while the Booking
 * Inspector and Booking Overview domains remain authoritative for their DTOs,
 * requests, templates, focus lifecycles, and permissions.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
(function (window, document) {
  'use strict';

  var module_id = 'booking_interactions';
  var extension_factories = [];

  /**
   * Register one domain-owned booking-interaction extension factory.
   *
   * The shared controller owns only lifecycle fan-out. Factories retain their
   * own data, authorization, rendering, and interaction rules. Duplicate
   * registration of the same function is idempotent.
   *
   * @param {Function} extension_factory Factory receiving neutral host context.
   * @return {boolean} True when the factory is available to future controllers.
   */
  function register_extension_factory(extension_factory) {
    if ('function' !== typeof extension_factory) {
      return false;
    }
    if (-1 === extension_factories.indexOf(extension_factory)) {
      extension_factories.push(extension_factory);
    }
    return true;
  }
  window.wpbc_timeline_booking_interactions = {
    register_extension_factory: register_extension_factory
  };

  /**
   * Create one booking-interactions controller for a Timeline mount.
   *
   * @param {Object} context Timeline-owned mount, settings, and bounded callbacks.
   * @return {Object} Booking interaction lifecycle and delegation API.
   */
  function create_booking_interactions_controller(context) {
    var mount = context.mount || null;
    var settings = context.settings || {};
    var booking_inspector_adapter = null;
    var booking_overview_tooltip_controller = null;
    var booking_resizing_controller = null;
    var extension_controllers = [];
    var suspended_booking_overflow_tooltips = [];
    var booking_selection_state = create_empty_booking_selection_state();
    var booking_inspector_refresh_generation = 0;
    var booking_control_rail_frame = 0;
    var booking_control_rail_settle_timer = 0;
    var booking_control_rail_settle_delay = 80;
    var axis_scroll_canvas = null;
    var axis_scroll_uses_scrollend = false;
    var active_time_slot_overflow = null;
    var time_slot_overflow_frame = 0;
    var is_initialized = false;

    /**
     * Invoke one optional lifecycle method on every initialized extension.
     *
     * @param {string} method_name Stable lifecycle method name.
     * @param {Array}  method_arguments Ordered method arguments.
     * @return {Array} Ordered non-undefined extension results.
     */
    function invoke_extension_method(method_name, method_arguments) {
      var results = [];
      extension_controllers.forEach(function (extension_controller) {
        var result;
        if (!extension_controller || 'function' !== typeof extension_controller[method_name]) {
          return;
        }
        result = extension_controller[method_name].apply(extension_controller, method_arguments || []);
        if ('undefined' !== typeof result) {
          results.push(result);
        }
      });
      return results;
    }

    /**
     * Report whether a focused domain extension currently owns interaction.
     *
     * @return {boolean} True when an extension reports an active interaction.
     */
    function is_extension_interacting() {
      return invoke_extension_method('is_interacting', []).some(Boolean);
    }

    /**
     * Determine whether a new external booking interaction may start.
     *
     * @return {boolean} True when Timeline and existing domains are idle.
     */
    function can_start_extension_interaction() {
      return Boolean(mount && is_initialized && ('function' !== typeof context.is_host_active || context.is_host_active()) && !is_extension_interacting() && !active_time_slot_overflow && !(booking_resizing_controller && 'function' === typeof booking_resizing_controller.is_interacting && booking_resizing_controller.is_interacting()) && !mount.classList.contains('is-request-loading') && 'true' !== mount.getAttribute('aria-busy') && !mount.querySelector('[data-wpbc-booking-inspector-trigger].is-booking-details-open') && !mount.querySelector('[data-wpbc-booking-date-editor-layer]:not([hidden]), [data-wpbc-booking-rescheduling-layer]:not([hidden])'));
    }

    /**
     * Delegate one same-Resource movement proposal to the domain-owned Review workflow.
     *
     * Expanded presentations may own different gesture geometry, but they must
     * not duplicate Booking Rescheduling Review, Apply, or canonical readback.
     * The first registered domain extension that accepts the proposal owns the
     * complete authoritative lifecycle.
     *
     * @param {Object} proposal Executable-free booking movement proposal.
     * @param {Object} state    Restored presentation and focus context.
     * @return {boolean} True when a domain extension accepted the proposal.
     */
    function review_booking_movement_proposal(proposal, state) {
      return invoke_extension_method('review_movement_proposal', [proposal, state]).some(Boolean);
    }

    /**
     * Hand one presentation-neutral resize proposal to the canonical controller.
     *
     * Time-row geometry remains extension-owned. This bridge only forwards the
     * executable-free proposal to the already mounted Booking Resizing domain.
     *
     * @param {Object} proposal Executable-free booking resize proposal.
     * @param {Object} state    Restored presentation and focus context.
     * @return {boolean} True when canonical Resize Review accepted the proposal.
     */
    function review_booking_resize_proposal(proposal, state) {
      return Boolean(booking_resizing_controller && 'function' === typeof booking_resizing_controller.review_resize_proposal && booking_resizing_controller.review_resize_proposal(proposal, state));
    }

    /**
     * Suspend or resume conflicting Timeline booking presentation adapters.
     *
     * @param {boolean} is_suspended Whether an extension owns pointer attention.
     * @param {Element} owner_card   Optional booking card owning the gesture.
     * @return {void}
     */
    function set_extension_interaction_suspended(is_suspended, owner_card) {
      if (is_suspended) {
        close_time_slot_overflow(false);
        suspend_booking_overflow_tooltips(owner_card || null);
        if (booking_overview_tooltip_controller && 'function' === typeof booking_overview_tooltip_controller.suspend) {
          booking_overview_tooltip_controller.suspend();
        }
        return;
      }
      resume_booking_overflow_tooltips();
      if (booking_overview_tooltip_controller && 'function' === typeof booking_overview_tooltip_controller.resume) {
        booking_overview_tooltip_controller.resume();
      }
    }

    /**
     * Initialize registered domain extensions through one neutral lifecycle.
     *
     * @return {void}
     */
    function initialize_extensions() {
      var extension_context = {
        mount: mount,
        settings: settings,
        callbacks: {
          can_start_interaction: can_start_extension_interaction,
          review_booking_movement_proposal: review_booking_movement_proposal,
          review_booking_resize_proposal: review_booking_resize_proposal,
          open_booking_full_reschedule: open_full_reschedule_from_handle,
          set_interaction_suspended: set_extension_interaction_suspended,
          set_axis_window_loading_locked: context.set_axis_window_loading_locked,
          show_admin_message: context.show_admin_message,
          refresh_after_apply: refresh_after_resize_apply,
          get_axis: function () {
            return settings.axis || {};
          },
          is_host_active: context.is_host_active,
          schedule_layout: schedule_booking_control_rail_layout
        }
      };
      extension_factories.forEach(function (extension_factory) {
        var extension_controller = extension_factory(extension_context);
        if (!extension_controller || 'function' !== typeof extension_controller.initialize || 'function' !== typeof extension_controller.destroy) {
          return;
        }
        extension_controllers.push(extension_controller);
        extension_controller.initialize();
      });
    }

    /**
     * Destroy every initialized domain extension in reverse ownership order.
     *
     * @return {void}
     */
    function destroy_extensions() {
      extension_controllers.slice().reverse().forEach(function (extension_controller) {
        extension_controller.destroy();
      });
      extension_controllers = [];
    }

    /**
     * Position the active time-slot list beside its existing overflow button.
     *
     * The list is temporarily portaled to the document body so row and canvas
     * clipping cannot cut it off. Scrolling only updates fixed positioning; it
     * never reconstructs the server-owned template.
     *
     * @return {void}
     */
    function position_time_slot_overflow() {
      var trigger_rectangle;
      var popover_rectangle;
      var viewport_width;
      var viewport_height;
      var viewport_margin = 8;
      var left;
      var top;
      time_slot_overflow_frame = 0;
      if (!active_time_slot_overflow || !active_time_slot_overflow.trigger.isConnected) {
        close_time_slot_overflow(false);
        return;
      }
      trigger_rectangle = active_time_slot_overflow.trigger.getBoundingClientRect();
      popover_rectangle = active_time_slot_overflow.popover.getBoundingClientRect();
      viewport_width = document.documentElement.clientWidth;
      viewport_height = document.documentElement.clientHeight;
      left = Math.min(Math.max(viewport_margin, trigger_rectangle.left), Math.max(viewport_margin, viewport_width - popover_rectangle.width - viewport_margin));
      top = trigger_rectangle.bottom + 6;
      if (top + popover_rectangle.height > viewport_height - viewport_margin) {
        top = Math.max(viewport_margin, trigger_rectangle.top - popover_rectangle.height - 6);
      }
      active_time_slot_overflow.popover.style.left = Math.round(left) + 'px';
      active_time_slot_overflow.popover.style.top = Math.round(top) + 'px';
    }

    /**
     * Schedule one geometry update for the active time-slot list.
     *
     * @return {void}
     */
    function schedule_time_slot_overflow_position() {
      if (!active_time_slot_overflow || time_slot_overflow_frame) {
        return;
      }
      time_slot_overflow_frame = window.requestAnimationFrame(position_time_slot_overflow);
    }

    /**
     * Handle document clicks while a portaled time-slot list is open.
     *
     * @param {MouseEvent} event Browser click event.
     * @return {void}
     */
    function handle_time_slot_overflow_document_click(event) {
      var close_button;
      var booking_item;
      if (!active_time_slot_overflow) {
        return;
      }
      close_button = event.target.closest('[data-wpbc-timeline-time-slot-close]');
      booking_item = event.target.closest('[data-wpbc-timeline-time-slot-item]');
      if (close_button && active_time_slot_overflow.popover.contains(close_button)) {
        event.preventDefault();
        close_time_slot_overflow(true);
        return;
      }
      if (booking_item && active_time_slot_overflow.popover.contains(booking_item)) {
        event.preventDefault();
        close_time_slot_overflow(false);
        if (booking_inspector_adapter && 'function' === typeof booking_inspector_adapter.open) {
          booking_inspector_adapter.open(booking_item);
        }
        return;
      }
      if (!active_time_slot_overflow.popover.contains(event.target) && !active_time_slot_overflow.trigger.contains(event.target)) {
        close_time_slot_overflow(false);
      }
    }

    /**
     * Close the active time-slot list and remove every transient listener.
     *
     * @param {boolean} restore_focus Whether focus returns to the overflow button.
     * @return {void}
     */
    function close_time_slot_overflow(restore_focus) {
      var overflow_state = active_time_slot_overflow;
      if (time_slot_overflow_frame) {
        window.cancelAnimationFrame(time_slot_overflow_frame);
        time_slot_overflow_frame = 0;
      }
      document.removeEventListener('click', handle_time_slot_overflow_document_click);
      document.removeEventListener('keydown', handle_time_slot_overflow_keydown);
      document.removeEventListener('scroll', schedule_time_slot_overflow_position, true);
      window.removeEventListener('resize', schedule_time_slot_overflow_position);
      active_time_slot_overflow = null;
      if (!overflow_state) {
        return;
      }
      overflow_state.trigger.setAttribute('aria-expanded', 'false');
      overflow_state.popover.hidden = true;
      overflow_state.popover.classList.remove('is-portaled');
      overflow_state.popover.style.removeProperty('left');
      overflow_state.popover.style.removeProperty('top');
      overflow_state.wrapper.appendChild(overflow_state.popover);
      if (restore_focus && overflow_state.trigger.isConnected) {
        overflow_state.trigger.focus();
      }
    }

    /**
     * Close the active time-slot list with Escape.
     *
     * @param {KeyboardEvent} event Browser keyboard event.
     * @return {void}
     */
    function handle_time_slot_overflow_keydown(event) {
      if ('Escape' !== event.key || !active_time_slot_overflow) {
        return;
      }
      event.preventDefault();
      close_time_slot_overflow(true);
    }

    /**
     * Open one existing server-rendered time-slot overflow list.
     *
     * @param {HTMLElement} trigger Overflow button inside the Timeline row.
     * @return {boolean} True when a list was opened or toggled closed.
     */
    function toggle_time_slot_overflow(trigger) {
      var wrapper = trigger.closest('[data-wpbc-timeline-time-slot-overflow]');
      var popover = wrapper ? wrapper.querySelector('[data-wpbc-timeline-time-slot-popover]') : null;
      if (!wrapper || !popover) {
        return false;
      }
      if (active_time_slot_overflow && active_time_slot_overflow.trigger === trigger) {
        close_time_slot_overflow(true);
        return true;
      }
      close_time_slot_overflow(false);
      active_time_slot_overflow = {
        wrapper: wrapper,
        trigger: trigger,
        popover: popover
      };
      trigger.setAttribute('aria-expanded', 'true');
      popover.hidden = false;
      popover.classList.add('is-portaled');
      document.body.appendChild(popover);
      document.addEventListener('click', handle_time_slot_overflow_document_click);
      document.addEventListener('keydown', handle_time_slot_overflow_keydown);
      document.addEventListener('scroll', schedule_time_slot_overflow_position, true);
      window.addEventListener('resize', schedule_time_slot_overflow_position, {
        passive: true
      });
      schedule_time_slot_overflow_position();
      window.requestAnimationFrame(function () {
        var first_item = active_time_slot_overflow && active_time_slot_overflow.popover.querySelector('[data-wpbc-timeline-time-slot-item]');
        if (first_item) {
          first_item.focus();
        }
      });
      return true;
    }

    /**
     * Create the empty selected-booking state for this Timeline page.
     *
     * Canonical booking identity is independent from a rendered segment. The
     * segment hint is retained only for focus and geometry reconciliation when
     * one booking is represented by several visible cards.
     *
     * @return {Object} Empty booking selection state.
     */
    function create_empty_booking_selection_state() {
      return {
        booking_id: 0,
        segment_hint: ''
      };
    }

    /**
     * Report whether the Timeline host can still accept asynchronous work.
     *
     * @return {boolean} True while the page controller remains active.
     */
    function is_host_active() {
      return is_initialized && ('function' !== typeof context.is_host_active || context.is_host_active());
    }

    /**
     * Return one rendered segment's canonical booking and presentation identity.
     *
     * @param {HTMLElement|null} segment Rendered booking card or selection control.
     * @return {Object} Positive booking ID and stable segment hint when valid.
     */
    function get_booking_segment_identity(segment) {
      var card = segment && segment.closest ? segment.closest('[data-wpbc-timeline-segment-id]') : null;
      if (!card || !card.getAttribute) {
        return create_empty_booking_selection_state();
      }
      return {
        booking_id: Math.max(0, Math.round(Number(card.getAttribute('data-wpbc-timeline-booking-id')) || 0)),
        segment_hint: String(card.getAttribute('data-wpbc-timeline-segment-id') || '')
      };
    }

    /**
     * Apply selected-booking state to every current segment of that booking.
     *
     * Inspector open state deliberately remains on `is-booking-details-open`.
     * Selection uses its own class and pressed state so neither Inspector nor
     * Booking Overview ARIA becomes its authority.
     *
     * @return {void}
     */
    function synchronize_booking_selection() {
      var fallback_segment_hint = '';
      var has_segment_hint = false;
      Array.prototype.forEach.call(mount.querySelectorAll('[data-wpbc-timeline-booking-select]'), function (selection_control) {
        var card = selection_control.closest('[data-wpbc-timeline-segment-id]');
        var identity = get_booking_segment_identity(selection_control);
        var is_selected = Boolean(booking_selection_state.booking_id && identity.booking_id === booking_selection_state.booking_id);
        if (card) {
          card.classList.toggle('is-booking-selected', is_selected);
        }
        selection_control.setAttribute('aria-pressed', is_selected ? 'true' : 'false');
        if (is_selected && !fallback_segment_hint) {
          fallback_segment_hint = identity.segment_hint;
        }
        if (is_selected && identity.segment_hint === booking_selection_state.segment_hint) {
          has_segment_hint = true;
        }
      });
      Array.prototype.forEach.call(mount.querySelectorAll('[data-wpbc-timeline-booking-control-rail]'), function (rail) {
        var rail_booking_id = Math.max(0, Math.round(Number(rail.getAttribute('data-wpbc-timeline-booking-id')) || 0));
        var is_selected = Boolean(booking_selection_state.booking_id && rail_booking_id === booking_selection_state.booking_id);
        var details_action = rail.querySelector('[data-wpbc-timeline-booking-details-action]');
        rail.classList.toggle('is-booking-selected', is_selected);
        if (details_action) {
          details_action.hidden = !is_selected;
        }
      });
      if (booking_selection_state.booking_id && fallback_segment_hint && !has_segment_hint) {
        booking_selection_state.segment_hint = fallback_segment_hint;
      }
    }

    /**
     * Close clipped-text hover aids owned by one selected booking card.
     *
     * Selection moves focus to the booking control for its own accessible action.
     * The control's accessible name already contains the complete booking label
     * and schedule, so previously opened pointer tooltips must not remain over the
     * selected card or reopen merely because that control retains focus.
     *
     * @param {HTMLElement|null} segment Rendered booking card or child control.
     * @return {void}
     */
    function dismiss_booking_overflow_tooltips(segment) {
      var card = segment && segment.closest ? segment.closest('[data-wpbc-timeline-segment-id]') : null;
      var tooltip_owners = card && card.querySelectorAll ? card.querySelectorAll('[data-wpbc-ui-catalog-overflow-tooltip-focus="pointer-only"]') : [];
      Array.prototype.forEach.call(tooltip_owners, function (tooltip_owner) {
        if (tooltip_owner._tippy && 'function' === typeof tooltip_owner._tippy.hide) {
          tooltip_owner._tippy.hide();
        }
      });
    }

    /**
     * Hide and disable the active card's pointer-only overflow tooltips.
     *
     * Pointer capture can otherwise leave the hover tooltip flipping above a
     * moving ghost. The exact card-owned Tippy instances are retained and
     * re-enabled once by resize teardown; no global tooltip scan is required.
     *
     * @param {HTMLElement|null} card Exact gesture-anchor card.
     * @return {void}
     */
    function suspend_booking_overflow_tooltips(card) {
      var tooltip_owners = card && card.querySelectorAll ? card.querySelectorAll('[data-wpbc-ui-catalog-overflow-tooltip-focus="pointer-only"]') : [];
      suspended_booking_overflow_tooltips = [];
      Array.prototype.forEach.call(tooltip_owners, function (tooltip_owner) {
        if (!tooltip_owner._tippy) {
          return;
        }
        if ('function' === typeof tooltip_owner._tippy.hide) {
          tooltip_owner._tippy.hide();
        }
        if ('function' === typeof tooltip_owner._tippy.disable) {
          tooltip_owner._tippy.disable();
          suspended_booking_overflow_tooltips.push(tooltip_owner._tippy);
        }
      });
    }

    /**
     * Re-enable the card-owned tooltips disabled for pointer resizing.
     *
     * @return {void}
     */
    function resume_booking_overflow_tooltips() {
      for (var tooltip_index = 0; tooltip_index < suspended_booking_overflow_tooltips.length; tooltip_index++) {
        if ('function' === typeof suspended_booking_overflow_tooltips[tooltip_index].enable) {
          suspended_booking_overflow_tooltips[tooltip_index].enable();
        }
      }
      suspended_booking_overflow_tooltips = [];
    }

    /**
     * Select one canonical booking without opening Overview or Inspector.
     *
     * @param {HTMLElement} segment Rendered Timeline booking segment.
     * @return {boolean} True when a valid booking was selected.
     */
    function select_booking_segment(segment) {
      var identity = get_booking_segment_identity(segment);
      if (!identity.booking_id || !identity.segment_hint) {
        return false;
      }
      dismiss_booking_overflow_tooltips(segment);
      booking_selection_state = identity;
      synchronize_booking_selection();
      schedule_booking_control_rail_layout();
      if (booking_resizing_controller && 'function' === typeof booking_resizing_controller.select) {
        booking_resizing_controller.select(segment);
      }
      invoke_extension_method('select_segment', [segment, booking_selection_state]);
      return true;
    }

    /**
     * Preserve a newly created booking identity across the host-owned rerender.
     *
     * The card does not exist yet, so only the authoritative positive booking ID
     * is retained. Normal refresh reconciliation supplies a current segment hint.
     *
     * @param {number} booking_id Authoritative created booking ID.
     * @return {boolean} True when the identity was accepted.
     */
    function prepare_created_booking_readback(booking_id) {
      booking_id = Math.max(0, Math.round(Number(booking_id) || 0));
      if (!booking_id) {
        return false;
      }
      booking_selection_state = {
        booking_id: booking_id,
        segment_hint: ''
      };
      return true;
    }

    /**
     * Select and highlight the authoritative created booking after Timeline readback.
     *
     * @param {number} booking_id Authoritative created booking ID.
     * @return {boolean} True when the booking is visible in the current Resource view.
     */
    function complete_created_booking_readback(booking_id) {
      var card;
      var selection_control;
      booking_id = Math.max(0, Math.round(Number(booking_id) || 0));
      if (!booking_id) {
        return false;
      }
      card = mount.querySelector('[data-wpbc-timeline-booking-id="' + String(booking_id) + '"][data-wpbc-timeline-segment-id]');
      selection_control = card ? card.querySelector('[data-wpbc-timeline-booking-select]') : null;
      if (!card || !selection_control) {
        booking_selection_state = {
          booking_id: booking_id,
          segment_hint: ''
        };
        synchronize_booking_selection();
        return false;
      }
      select_booking_segment(selection_control);
      return true;
    }

    /**
     * Open the existing read-only Booking Inspector for one visible created card.
     *
     * This optional presentation handoff runs only after the creation Inspector
     * receives an accepted host readback and closes its own shared shell.
     *
     * @param {number} booking_id Authoritative created booking ID.
     * @return {boolean} True when the read-only Inspector accepted the card.
     */
    function open_created_booking_inspector(booking_id) {
      var card;
      booking_id = Math.max(0, Math.round(Number(booking_id) || 0));
      card = booking_id ? mount.querySelector('[data-wpbc-timeline-booking-id="' + String(booking_id) + '"][data-wpbc-timeline-segment-id]') : null;
      if (!card || !booking_inspector_adapter || 'function' !== typeof booking_inspector_adapter.open) {
        return false;
      }
      booking_inspector_adapter.open(card);
      return true;
    }

    /**
     * Focus the selected control for one authoritative created booking.
     *
     * @param {number} booking_id Authoritative created booking ID.
     * @return {boolean} True when the visible booking control received focus.
     */
    function focus_created_booking(booking_id) {
      var card;
      var selection_control;
      booking_id = Math.max(0, Math.round(Number(booking_id) || 0));
      card = booking_id ? mount.querySelector('[data-wpbc-timeline-booking-id="' + String(booking_id) + '"][data-wpbc-timeline-segment-id]') : null;
      selection_control = card ? card.querySelector('[data-wpbc-timeline-booking-select]') : null;
      if (!selection_control || 'function' !== typeof selection_control.focus) {
        return false;
      }
      selection_control.focus();
      return true;
    }

    /**
     * Write one inline style only when its serialized value changed.
     *
     * @param {HTMLElement} element Element receiving the style.
     * @param {string} property_name CSS property or custom-property name.
     * @param {string} property_value Serialized CSS value.
     * @return {void}
     */
    function set_changed_style_property(element, property_name, property_value) {
      if (element.style.getPropertyValue(property_name) !== property_value) {
        element.style.setProperty(property_name, property_value);
      }
    }

    /**
     * Resolve the canonical card for an in-card or row-overlay accessory.
     *
     * @param {HTMLElement|null} accessory Accessory rail, dock, or child control.
     * @param {Map|null} card_by_segment_id Optional frame-local card lookup.
     * @return {HTMLElement|null} Canonical rendered booking card, or null.
     */
    function get_booking_accessory_card(accessory, card_by_segment_id) {
      var card = accessory && accessory.closest ? accessory.closest('[data-wpbc-timeline-segment-id]') : null;
      var rail;
      var segment_hint;
      var cards;
      if (card) {
        return card;
      }
      rail = accessory && accessory.closest ? accessory.closest('[data-wpbc-timeline-booking-control-rail]') : null;
      segment_hint = rail ? String(rail.getAttribute('data-wpbc-timeline-accessory-segment-id') || '') : '';
      if (!segment_hint) {
        return null;
      }
      if (card_by_segment_id && card_by_segment_id.has(segment_hint)) {
        return card_by_segment_id.get(segment_hint);
      }
      cards = mount.querySelectorAll('[data-wpbc-timeline-segment-id]');
      Array.prototype.some.call(cards, function (candidate) {
        if (segment_hint === String(candidate.getAttribute('data-wpbc-timeline-segment-id') || '')) {
          card = candidate;
          return true;
        }
        return false;
      });
      return card;
    }

    /**
     * Return the physically visible time-canvas rectangle.
     *
     * Bounding rectangles avoid browser-specific RTL scrollLeft models and keep
     * controls outside the frozen Resource column.
     *
     * @param {HTMLElement} canvas Timeline horizontal scroll container.
     * @return {Object} Physical left/right/top/bottom canvas boundaries.
     */
    function get_visible_time_canvas_rectangle(canvas) {
      var canvas_rectangle = canvas.getBoundingClientRect();
      var resource_column = mount.querySelector('.wpbc_timeline__resources');
      var resource_rectangle = resource_column ? resource_column.getBoundingClientRect() : null;
      var visual_viewport = window.visualViewport || null;
      var viewport_left = visual_viewport ? Math.max(0, Number(visual_viewport.offsetLeft) || 0) : 0;
      var viewport_width = visual_viewport ? Math.max(0, Number(visual_viewport.width) || 0) : Math.max(0, document.documentElement.clientWidth || window.innerWidth || 0);
      var viewport_right = viewport_width ? viewport_left + viewport_width : canvas_rectangle.right;
      var visible_left = Math.max(viewport_left, canvas_rectangle.left);
      var visible_right = Math.min(viewport_right, canvas_rectangle.right);
      if (resource_rectangle && resource_rectangle.right > visible_left && resource_rectangle.left <= visible_left) {
        visible_left = Math.max(visible_left, resource_rectangle.right);
      }
      if (resource_rectangle && resource_rectangle.left < visible_right && resource_rectangle.right >= visible_right) {
        visible_right = Math.min(visible_right, resource_rectangle.left);
      }
      return {
        left: visible_left,
        right: Math.max(visible_left, visible_right),
        top: canvas_rectangle.top,
        bottom: canvas_rectangle.bottom
      };
    }

    /**
     * Read one positive pixel token from Timeline custom properties.
     *
     * @param {CSSStyleDeclaration} computed_style Computed Timeline style.
     * @param {string} property_name CSS custom-property name.
     * @param {number} fallback_px Fallback CSS-pixel value.
     * @return {number} Positive CSS-pixel value.
     */
    function get_booking_layout_token(computed_style, property_name, fallback_px) {
      var parsed_value = parseFloat(computed_style.getPropertyValue(property_name));
      return Number.isFinite(parsed_value) && 0 < parsed_value ? parsed_value : fallback_px;
    }

    /**
     * Move a booking control rail without discarding keyboard focus.
     *
     * @param {HTMLElement} rail Control rail to move.
     * @param {HTMLElement} parent Destination parent.
     * @param {?Node} reference_node Node before which the rail is inserted.
     * @return {void}
     */
    function move_booking_control_rail(rail, parent, reference_node) {
      var focused_control = !rail.hidden && rail.contains(document.activeElement) ? document.activeElement : null;
      parent.insertBefore(rail, reference_node || null);
      if (focused_control && document.activeElement !== focused_control) {
        try {
          focused_control.focus({
            preventScroll: true
          });
        } catch (error) {
          focused_control.focus();
        }
      }
    }

    /**
     * Restore a control rail to its card-owned accessory dock.
     *
     * @param {HTMLElement} card Canonical booking card.
     * @param {HTMLElement} rail Segment control rail.
     * @return {void}
     */
    function restore_booking_control_rail(card, rail) {
      var dock = card.querySelector('.wpbc_timeline__booking_accessory_dock');
      if (!dock) {
        return;
      }
      if (rail.parentNode !== dock) {
        move_booking_control_rail(rail, dock, null);
      }
      rail.classList.remove('is-row-overlay', 'is-docked-inline-start', 'is-docked-inline-end', 'is-docked-clamped');
      card.classList.remove('is-booking-accessory-docked');
    }

    /**
     * Report whether a rail must remain a descendant of its canonical card.
     *
     * Domain extensions use this neutral geometry contract when a control's
     * interaction library requires its handle to remain inside the owning node.
     * The marker affects presentation ownership only; it grants no permission.
     *
     * @param {HTMLElement} rail Booking control rail.
     * @return {boolean} True when row-overlay detachment is prohibited.
     */
    function is_booking_control_rail_card_owned(rail) {
      return Boolean(rail && rail.hasAttribute('data-wpbc-timeline-booking-control-rail-card-owned'));
    }

    /**
     * Choose a bounded physical position beside a narrow visible segment.
     *
     * @param {Object} visible_segment Physical visible segment boundaries.
     * @param {Object} visible_canvas Physical visible canvas boundaries.
     * @param {number} rail_width Control-rail width in CSS pixels.
     * @param {number} rail_gap Gap between segment and overlay rail.
     * @return {Object} Physical left position and chosen logical side.
     */
    function get_booking_overlay_rail_position(visible_segment, visible_canvas, rail_width, rail_gap) {
      var inline_end_left = settings.is_rtl ? visible_segment.left - rail_gap - rail_width : visible_segment.right + rail_gap;
      var inline_start_left = settings.is_rtl ? visible_segment.right + rail_gap : visible_segment.left - rail_gap - rail_width;
      var fits = function (physical_left) {
        return physical_left >= visible_canvas.left && physical_left + rail_width <= visible_canvas.right;
      };
      var available_before = Math.max(0, visible_segment.left - visible_canvas.left);
      var available_after = Math.max(0, visible_canvas.right - visible_segment.right);
      var physical_left;
      var logical_side;
      if (fits(inline_end_left)) {
        physical_left = inline_end_left;
        logical_side = 'end';
      } else if (fits(inline_start_left)) {
        physical_left = inline_start_left;
        logical_side = 'start';
      } else if (available_after >= available_before) {
        physical_left = Math.min(visible_canvas.right - rail_width, visible_segment.right + rail_gap);
        logical_side = settings.is_rtl ? 'start' : 'end';
      } else {
        physical_left = Math.max(visible_canvas.left, visible_segment.left - rail_gap - rail_width);
        logical_side = settings.is_rtl ? 'end' : 'start';
      }
      physical_left = Math.max(visible_canvas.left, Math.min(visible_canvas.right - rail_width, physical_left));
      return {
        left: physical_left,
        logical_side: logical_side
      };
    }

    /**
     * Position every booking information rail against the visible canvas.
     *
     * Long cards retain CSS-sticky controls. Only a truly narrow canonical card
     * moves its rail into the row overlay, without changing booking occupancy.
     *
     * @return {void}
     */
    function layout_booking_control_rails() {
      var canvas = mount.querySelector('[data-wpbc-timeline-canvas]');
      var visible_canvas;
      var rails;
      var card_by_segment_id = new Map();
      booking_control_rail_frame = 0;
      if (!canvas || !is_host_active()) {
        return;
      }
      visible_canvas = get_visible_time_canvas_rectangle(canvas);
      Array.prototype.forEach.call(mount.querySelectorAll('[data-wpbc-timeline-segment-id]'), function (card) {
        var segment_id = String(card.getAttribute('data-wpbc-timeline-segment-id') || '');
        if (segment_id) {
          card_by_segment_id.set(segment_id, card);
        }
      });
      rails = mount.querySelectorAll('[data-wpbc-timeline-booking-control-rail]');
      Array.prototype.forEach.call(rails, function (rail) {
        var card = get_booking_accessory_card(rail, card_by_segment_id);
        var segment_host = card ? card.parentElement : null;
        var card_rectangle;
        var host_rectangle;
        var is_booking_selected;
        var visible_segment;
        var visible_width;
        var card_width;
        var computed_style;
        var accessory_size;
        var drag_indicator_size;
        var accessory_gap;
        var accessory_padding;
        var avatar_size;
        var selection_edge_reserve;
        var continuation_width;
        var accessory_count;
        var drag_indicator;
        var has_visible_drag_indicator;
        var accessory_content_width;
        var avatar;
        var has_expanded_avatar;
        var rail_width;
        var required_width;
        var expanded_required_width;
        var should_condense;
        var should_minimize;
        var start_rail_reserve;
        var end_rail_reserve;
        var start_boundary_position;
        var end_boundary_position;
        var start_boundary_visible;
        var end_boundary_visible;
        var overlay_position;
        var overlay_gap;
        var requires_clamped_overlay;
        var logical_rail_start;
        var rail_block_start;
        if (!card || !segment_host || card.hidden || card.closest('[hidden]')) {
          rail.hidden = true;
          return;
        }
        card_rectangle = card.getBoundingClientRect();
        card_width = Math.max(0, card_rectangle.width);
        visible_segment = {
          left: Math.max(card_rectangle.left, visible_canvas.left),
          right: Math.min(card_rectangle.right, visible_canvas.right)
        };
        visible_width = Math.max(0, visible_segment.right - visible_segment.left);
        if (0 >= visible_width || card_rectangle.bottom <= visible_canvas.top || card_rectangle.top >= visible_canvas.bottom) {
          rail.hidden = true;
          restore_booking_control_rail(card, rail);
          card.classList.add('is-booking-outside-visible-canvas');
          return;
        }
        rail.hidden = false;
        card.classList.remove('is-booking-outside-visible-canvas');
        is_booking_selected = card.classList.contains('is-booking-selected');
        rail.classList.toggle('is-booking-selected', is_booking_selected);
        computed_style = window.getComputedStyle(card);
        accessory_size = get_booking_layout_token(computed_style, '--wpbc_timeline_general__booking-accessory-size', 28);
        drag_indicator_size = get_booking_layout_token(computed_style, '--wpbc_timeline_general__booking-drag-indicator-size', 20);
        accessory_gap = get_booking_layout_token(computed_style, '--wpbc_timeline_general__booking-accessory-gap', 4);
        accessory_padding = get_booking_layout_token(computed_style, '--wpbc_timeline_general__booking-accessory-padding', 4);
        avatar_size = get_booking_layout_token(computed_style, '--wpbc_timeline_general__booking-avatar-size', 26);
        selection_edge_reserve = get_booking_layout_token(computed_style, '--wpbc-timeline-booking-selection-edge-reserve', 0);
        continuation_width = get_booking_layout_token(computed_style, '--wpbc_timeline_general__booking-continuation-width', 28);
        accessory_count = rail.querySelectorAll('.wpbc_timeline__booking_accessory:not([hidden])').length;
        drag_indicator = rail.querySelector('.wpbc_timeline__booking_drag_indicator:not([hidden])');
        has_visible_drag_indicator = Boolean(drag_indicator && is_booking_selected);
        if (drag_indicator && !has_visible_drag_indicator) {
          accessory_count = Math.max(0, accessory_count - 1);
        }
        accessory_content_width = Math.max(0, accessory_count - (has_visible_drag_indicator ? 1 : 0)) * accessory_size + (has_visible_drag_indicator ? drag_indicator_size : 0);
        avatar = card.querySelector('.wpbc_timeline__booking_avatar');
        has_expanded_avatar = Boolean(avatar) && !card.classList.contains('is-compact');
        rail_width = Math.max(accessory_size + 2 * accessory_padding, accessory_content_width + Math.max(0, accessory_count - 1) * accessory_gap + 2 * accessory_padding);
        start_boundary_position = settings.is_rtl ? card_rectangle.right : card_rectangle.left;
        end_boundary_position = settings.is_rtl ? card_rectangle.left : card_rectangle.right;
        start_boundary_visible = start_boundary_position >= visible_canvas.left - 0.5 && start_boundary_position <= visible_canvas.right + 0.5;
        end_boundary_visible = end_boundary_position >= visible_canvas.left - 0.5 && end_boundary_position <= visible_canvas.right + 0.5;
        start_rail_reserve = accessory_padding;
        end_rail_reserve = accessory_padding;
        if (start_boundary_visible && card.classList.contains('is-clipped-start')) {
          start_rail_reserve = Math.max(start_rail_reserve, continuation_width + accessory_gap);
        }
        if (end_boundary_visible && card.classList.contains('is-clipped-end')) {
          end_rail_reserve = Math.max(end_rail_reserve, continuation_width + accessory_gap);
        }
        expanded_required_width = rail_width + (has_expanded_avatar ? avatar_size + accessory_gap : 0) + Math.max(0, start_rail_reserve - accessory_padding) + Math.max(0, end_rail_reserve - accessory_padding) + 2 * selection_edge_reserve;
        set_changed_style_property(card, '--wpbc-timeline-booking-start-rail-reserve', Math.round(start_rail_reserve * 100) / 100 + 'px');
        set_changed_style_property(card, '--wpbc-timeline-booking-end-rail-reserve', Math.round(end_rail_reserve * 100) / 100 + 'px');
        should_condense = card_width < Math.max(120, expanded_required_width + 40);
        required_width = rail_width + Math.max(0, start_rail_reserve - accessory_padding) + Math.max(0, end_rail_reserve - accessory_padding) + 2 * selection_edge_reserve;
        should_minimize = card_width < required_width + 16;
        card.classList.toggle('is-booking-info-condensed', should_condense);
        card.classList.toggle('is-booking-info-minimal', should_minimize);
        rail.classList.toggle('is-booking-info-condensed', should_condense);
        if (card_width + 0.5 >= required_width || is_booking_control_rail_card_owned(rail)) {
          restore_booking_control_rail(card, rail);
          return;
        }
        overlay_gap = accessory_gap + selection_edge_reserve;
        overlay_position = get_booking_overlay_rail_position(visible_segment, visible_canvas, rail_width, overlay_gap);
        host_rectangle = segment_host.getBoundingClientRect();
        requires_clamped_overlay = card_rectangle.left < visible_canvas.left - 0.5 || card_rectangle.right > visible_canvas.right + 0.5;
        rail_block_start = card_rectangle.top - host_rectangle.top + Math.max(0, (card_rectangle.height - accessory_size - 6) / 2);
        if (rail.parentNode !== segment_host) {
          move_booking_control_rail(rail, segment_host, null);
        }
        rail.classList.add('is-row-overlay');
        rail.classList.toggle('is-docked-inline-start', 'start' === overlay_position.logical_side);
        rail.classList.toggle('is-docked-inline-end', 'end' === overlay_position.logical_side);
        rail.classList.toggle('is-docked-clamped', requires_clamped_overlay);
        card.classList.add('is-booking-accessory-docked');
        set_changed_style_property(rail, '--wpbc-timeline-booking-rail-block-start', Math.round(rail_block_start * 100) / 100 + 'px');
        set_changed_style_property(rail, '--wpbc-timeline-booking-rail-gap', Math.round(overlay_gap * 100) / 100 + 'px');
        if (requires_clamped_overlay) {
          logical_rail_start = settings.is_rtl ? host_rectangle.right - (overlay_position.left + rail_width) : overlay_position.left - host_rectangle.left;
          set_changed_style_property(rail, '--wpbc-timeline-booking-rail-clamped-inline-start', Math.round(logical_rail_start * 100) / 100 + 'px');
        } else {
          rail.style.removeProperty('--wpbc-timeline-booking-rail-clamped-inline-start');
        }
      });
      if (booking_overview_tooltip_controller && 'function' === typeof booking_overview_tooltip_controller.update_geometry) {
        booking_overview_tooltip_controller.update_geometry();
      }
    }

    /**
     * Request one animation-frame batch for booking control-rail geometry.
     *
     * @return {void}
     */
    function schedule_booking_control_rail_layout() {
      if (booking_control_rail_settle_timer) {
        window.clearTimeout(booking_control_rail_settle_timer);
        booking_control_rail_settle_timer = 0;
      }
      if (booking_control_rail_frame) {
        return;
      }
      booking_control_rail_frame = window.requestAnimationFrame(layout_booking_control_rails);
    }

    /**
     * Reconcile measured narrow-card fallbacks after axis motion settles.
     *
     * @return {void}
     */
    function schedule_booking_control_rail_layout_after_axis_motion() {
      if (booking_control_rail_settle_timer) {
        window.clearTimeout(booking_control_rail_settle_timer);
      }
      booking_control_rail_settle_timer = window.setTimeout(function () {
        booking_control_rail_settle_timer = 0;
        if (!is_host_active()) {
          return;
        }
        schedule_booking_control_rail_layout();
      }, booking_control_rail_settle_delay);
    }

    /**
     * Mount the reusable Booking Inspector domain in the Timeline host.
     *
     * @return {boolean} True when the adapter is available.
     */
    function initialize_booking_inspector() {
      var host = mount.querySelector('[data-wpbc-timeline-booking-inspector-host]');
      if (!host || !window.wpbc_booking_inspector_hosts || 'function' !== typeof window.wpbc_booking_inspector_hosts.create_timeline) {
        return false;
      }
      booking_inspector_adapter = window.wpbc_booking_inspector_hosts.create_timeline(mount, host, settings.booking_inspector);
      return Boolean(booking_inspector_adapter);
    }

    /**
     * Open the canonical full Reschedule dialog for a static resize handle.
     *
     * @param {HTMLElement} card   Exact selected Timeline card.
     * @param {HTMLElement} handle Accessible resize-handle button.
     * @return {void}
     */
    function open_full_reschedule_from_handle(card, handle) {
      if (booking_inspector_adapter && 'function' === typeof booking_inspector_adapter.open_rescheduling) {
        booking_inspector_adapter.open_rescheduling(card, handle);
      }
    }

    /**
     * Refresh every visible booking projection after canonical booking Apply.
     *
     * Booking Overview is invalidated before Timeline replacement. An open
     * matching Inspector performs its own authorized readback, including
     * Activity. The returned promise contains no mutation path and is therefore
     * safe for domain controllers' explicit Retry refresh actions. The shared
     * callback performs reads only and contains no resize or movement rules.
     *
     * @param {Object} apply_result Canonical server Apply result.
     * @return {Object} jQuery-compatible combined readback promise.
     */
    function refresh_after_resize_apply(apply_result) {
      var refresh_requests = [];
      var booking_id = Number(apply_result && apply_result.booking_id ? apply_result.booking_id : 0);
      if (booking_overview_tooltip_controller && 'function' === typeof booking_overview_tooltip_controller.invalidate) {
        booking_overview_tooltip_controller.invalidate(booking_id);
      }
      if (booking_inspector_adapter && 'function' === typeof booking_inspector_adapter.refresh_after_external_apply) {
        refresh_requests.push(booking_inspector_adapter.refresh_after_external_apply(apply_result));
      }
      if ('function' !== typeof context.refresh_after_resize_apply) {
        return window.jQuery.Deferred().reject({
          message: ''
        }).promise();
      }
      refresh_requests.push(context.refresh_after_resize_apply(apply_result));
      return window.jQuery.when.apply(window.jQuery, refresh_requests);
    }

    /**
     * Mount the domain-owned static booking-resizing presentation controller.
     *
     * @return {boolean} True when the booking-resizing controller is available.
     */
    function initialize_booking_resizing() {
      if (!window.wpbc_timeline_booking_resizing || 'function' !== typeof window.wpbc_timeline_booking_resizing.create_controller) {
        return false;
      }
      booking_resizing_controller = window.wpbc_timeline_booking_resizing.create_controller(mount, settings.booking_resizing || {}, {
        open_full_reschedule: open_full_reschedule_from_handle,
        refresh_after_apply: refresh_after_resize_apply,
        set_axis_window_loading_locked: context.set_axis_window_loading_locked,
        show_admin_message: context.show_admin_message,
        get_axis: function () {
          return settings.axis || {};
        },
        is_host_active: context.is_host_active,
        suspend_overview: function (card) {
          suspend_booking_overflow_tooltips(card);
          if (booking_overview_tooltip_controller && 'function' === typeof booking_overview_tooltip_controller.suspend) {
            booking_overview_tooltip_controller.suspend();
          }
        },
        resume_overview: function () {
          resume_booking_overflow_tooltips();
          if (booking_overview_tooltip_controller && 'function' === typeof booking_overview_tooltip_controller.resume) {
            booking_overview_tooltip_controller.resume();
          }
        }
      });
      return Boolean(booking_resizing_controller);
    }

    /**
     * Determine whether another Timeline interaction currently owns attention.
     *
     * @return {boolean} True while Booking Overview must remain suppressed.
     */
    function is_booking_overview_tooltip_suppressed() {
      if (is_extension_interacting()) {
        return true;
      }
      if (active_time_slot_overflow) {
        return true;
      }
      if (booking_resizing_controller && 'function' === typeof booking_resizing_controller.is_interacting && booking_resizing_controller.is_interacting()) {
        return true;
      }
      if (mount.classList.contains('is-request-loading') || 'true' === mount.getAttribute('aria-busy') || 'function' === typeof context.is_empty_range_resizing && context.is_empty_range_resizing()) {
        return true;
      }
      if (mount.querySelector('[data-wpbc-booking-inspector-trigger].is-booking-details-open')) {
        return true;
      }
      if (mount.querySelector('[data-wpbc-booking-date-editor-layer]:not([hidden]), [data-wpbc-booking-rescheduling-layer]:not([hidden]), [data-wpbc-booking-date-editor-view="review"]:not([hidden]), [data-wpbc-booking-rescheduling-view="review"]:not([hidden])')) {
        return true;
      }
      return Boolean(mount.querySelector('.sortable-chosen, .sortable-drag, .is-dragging, .is-resizing, [data-wpbc-timeline-dragging="true"], [data-wpbc-timeline-resizing="true"]'));
    }

    /**
     * Open Booking Inspector from the booking-owned Overview action.
     *
     * @param {HTMLElement} card Registered Timeline Inspector identity.
     * @return {void}
     */
    function open_booking_details_from_overview(card) {
      if (booking_inspector_adapter && 'function' === typeof booking_inspector_adapter.open) {
        booking_inspector_adapter.open(card);
      }
    }

    /**
     * Return pinned Booking Overview horizontal input to Timeline ownership.
     *
     * @param {WheelEvent} event Browser wheel event from the pinned surface.
     * @return {boolean} True when the Timeline page accepted the gesture.
     */
    function scroll_timeline_from_overview(event) {
      if ('function' !== typeof context.scroll_axis_from_external_wheel) {
        return false;
      }
      return context.scroll_axis_from_external_wheel(event);
    }

    /**
     * Mount the booking-owned adapter over the shared Context Popover.
     *
     * @return {boolean} True when the Overview adapter is available.
     */
    function initialize_booking_overview_tooltip() {
      if (!window.wpbc_booking_overview_tooltip || 'function' !== typeof window.wpbc_booking_overview_tooltip.create_controller) {
        return false;
      }
      booking_overview_tooltip_controller = window.wpbc_booking_overview_tooltip.create_controller(mount, settings.booking_overview_tooltip || {}, {
        is_suppressed: is_booking_overview_tooltip_suppressed,
        open_booking_details: open_booking_details_from_overview,
        scroll_timeline: scroll_timeline_from_overview
      });
      return Boolean(booking_overview_tooltip_controller);
    }

    /**
     * Refresh the canonical Timeline after one accepted Inspector save event.
     *
     * @param {CustomEvent} event Booking Inspector save-completion event.
     * @return {void}
     */
    function handle_booking_inspector_saved(event) {
      var event_detail = event && event.detail ? event.detail : {};
      var refresh_generation = Number(event_detail.refresh_generation || 0);
      if ('timeline' !== event_detail.source) {
        return;
      }
      if (refresh_generation && refresh_generation <= booking_inspector_refresh_generation) {
        return;
      }
      if (booking_overview_tooltip_controller && 'function' === typeof booking_overview_tooltip_controller.invalidate) {
        booking_overview_tooltip_controller.invalidate(Number(event_detail.booking_id || 0));
      }
      booking_inspector_refresh_generation = refresh_generation || booking_inspector_refresh_generation + 1;
      if ('function' === typeof context.refresh_after_inspector_save) {
        context.refresh_after_inspector_save(event_detail);
      }
    }

    /**
     * Handle booking selection through the Timeline delegated keydown path.
     *
     * @param {KeyboardEvent} event Timeline key event.
     * @return {boolean} True when the booking interaction owned the event.
     */
    function handle_keydown(event) {
      var selection_control = event.target.closest('[data-wpbc-timeline-booking-select]');
      if (is_extension_interacting()) {
        if ('Escape' !== event.key) {
          event.preventDefault();
        }
        return true;
      }
      if (booking_resizing_controller && booking_resizing_controller.handle_keydown(event)) {
        return true;
      }
      if (!selection_control || event.target !== selection_control || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || -1 === ['Enter', ' '].indexOf(event.key)) {
        return false;
      }
      event.preventDefault();
      select_booking_segment(selection_control);
      return true;
    }

    /**
     * Handle booking accessories and selection through delegated click events.
     *
     * @param {MouseEvent} event Timeline click event.
     * @return {boolean} True when a booking interaction owned the event.
     */
    function handle_click(event) {
      var time_slot_more = event.target.closest('[data-wpbc-timeline-time-slot-more]');
      var details_action = event.target.closest('[data-wpbc-timeline-booking-details-action]');
      var accessory = event.target.closest('[data-wpbc-timeline-booking-accessory]');
      var selection_control = event.target.closest('[data-wpbc-timeline-booking-select]');
      var card;
      if (is_extension_interacting()) {
        event.preventDefault();
        return true;
      }
      if (time_slot_more) {
        event.preventDefault();
        return toggle_time_slot_overflow(time_slot_more);
      }
      if (booking_resizing_controller && booking_resizing_controller.handle_click(event)) {
        return true;
      }
      if (details_action) {
        event.preventDefault();
        card = get_booking_accessory_card(details_action, null);
        if (card && booking_inspector_adapter && 'function' === typeof booking_inspector_adapter.open) {
          booking_inspector_adapter.open(card);
        }
        return true;
      }
      if (accessory) {
        return true;
      }
      if (selection_control) {
        select_booking_segment(selection_control);
        return true;
      }
      return false;
    }

    /**
     * Notify Overview before Timeline replaces every rendered booking card.
     *
     * @return {void}
     */
    function begin_refresh() {
      invoke_extension_method('begin_refresh', []);
      close_time_slot_overflow(false);
      if (booking_resizing_controller && 'function' === typeof booking_resizing_controller.begin_refresh) {
        booking_resizing_controller.begin_refresh();
      }
      if (booking_overview_tooltip_controller) {
        booking_overview_tooltip_controller.refresh();
      }
    }

    /**
     * Register one freshly rendered segment with Booking Overview.
     *
     * @param {HTMLElement} segment_element Rendered canonical segment.
     * @param {Object} segment Authorized compact booking DTO.
     * @param {Object} resource_summary Authorized Resource summary.
     * @return {void}
     */
    function register_segment(segment_element, segment, resource_summary) {
      invoke_extension_method('register_segment', [segment_element, segment, resource_summary || {}]);
      if (booking_resizing_controller && segment_element && 'function' === typeof booking_resizing_controller.register_segment) {
        booking_resizing_controller.register_segment(segment_element, segment);
      }
      if (!booking_overview_tooltip_controller || !segment_element) {
        return;
      }
      booking_overview_tooltip_controller.register(segment_element.querySelector('[data-wpbc-booking-overview-info-trigger]'), segment_element, segment, resource_summary || {});
    }

    /**
     * Begin one focused read-only projection refresh.
     *
     * The shared controller forwards only an executable-free presentation
     * identity. Domain extensions own cache invalidation and never receive
     * authority from rendered markup.
     *
     * @param {Object} refresh_context Presentation-owned accepted identity.
     * @return {void}
     */
    function begin_read_only_refresh(refresh_context) {
      invoke_extension_method('begin_read_only_refresh', [refresh_context || {}]);
    }

    /**
     * Register one read-only projection of an accepted booking segment.
     *
     * Read-only projections reuse canonical selection, Overview, and Inspector.
     * Focused domain extensions may observe the accepted canonical segment and
     * presentation context, but must independently obtain fresh server authority
     * before exposing an interaction. The supplied DTO is never reconstructed
     * from DOM attributes.
     *
     * @param {HTMLElement} segment_element Rendered read-only booking projection.
     * @param {Object} segment Accepted authorized booking segment DTO.
     * @param {Object} resource_summary Accepted authorized Resource summary.
     * @param {Object} presentation_context Presentation-only render and boundary data.
     * @return {void}
     */
    function register_read_only_segment(segment_element, segment, resource_summary, presentation_context) {
      invoke_extension_method('register_read_only_segment', [segment_element, segment, resource_summary || {}, presentation_context || {}]);
      if (!booking_overview_tooltip_controller || !segment_element) {
        return;
      }
      booking_overview_tooltip_controller.register(segment_element.querySelector('[data-wpbc-booking-overview-info-trigger]'), segment_element, segment, resource_summary || {});
    }

    /**
     * Reconcile canonical read-only booking presentation after local rendering.
     *
     * This intentionally excludes resize and movement refresh lifecycles because
     * a read-only projection must never become mutation authority.
     *
     * @return {void}
     */
    function complete_read_only_refresh(refresh_context) {
      if (booking_overview_tooltip_controller && 'function' === typeof booking_overview_tooltip_controller.complete_refresh) {
        booking_overview_tooltip_controller.complete_refresh();
      }
      if (booking_inspector_adapter && 'function' === typeof booking_inspector_adapter.refresh) {
        booking_inspector_adapter.refresh();
      }
      synchronize_booking_selection();
      invoke_extension_method('complete_read_only_refresh', [refresh_context || {}, booking_selection_state]);
      schedule_booking_control_rail_layout();
    }

    /**
     * Reconcile adapters, selection, and geometry after booking rerender.
     *
     * @return {void}
     */
    function complete_refresh() {
      if (booking_overview_tooltip_controller && 'function' === typeof booking_overview_tooltip_controller.complete_refresh) {
        booking_overview_tooltip_controller.complete_refresh();
      }
      if (booking_inspector_adapter && 'function' === typeof booking_inspector_adapter.refresh) {
        booking_inspector_adapter.refresh();
      }
      synchronize_booking_selection();
      if (booking_resizing_controller && 'function' === typeof booking_resizing_controller.complete_refresh) {
        booking_resizing_controller.complete_refresh(booking_selection_state);
      }
      invoke_extension_method('complete_refresh', [booking_selection_state]);
      schedule_booking_control_rail_layout();
    }

    /**
     * Suspend or resume Booking Overview during canonical Timeline loading.
     *
     * @param {boolean} is_loading Whether foreground replacement is active.
     * @return {void}
     */
    function set_request_loading(is_loading) {
      invoke_extension_method('set_request_loading', [Boolean(is_loading)]);
      if (is_loading && booking_overview_tooltip_controller) {
        booking_overview_tooltip_controller.suspend();
        return;
      }
      if (!is_loading && booking_overview_tooltip_controller && 'function' === typeof booking_overview_tooltip_controller.resume) {
        booking_overview_tooltip_controller.resume();
      }
    }

    /**
     * Attach the settled rail geometry lifecycle to the Timeline axis.
     *
     * @return {void}
     */
    function initialize_axis_rail_lifecycle() {
      axis_scroll_canvas = mount.querySelector('[data-wpbc-timeline-canvas]');
      if (!axis_scroll_canvas) {
        return;
      }
      axis_scroll_uses_scrollend = 'onscrollend' in axis_scroll_canvas;
      if (axis_scroll_uses_scrollend) {
        axis_scroll_canvas.addEventListener('scrollend', schedule_booking_control_rail_layout, {
          passive: true
        });
      } else {
        axis_scroll_canvas.addEventListener('scroll', schedule_booking_control_rail_layout_after_axis_motion, {
          passive: true
        });
      }
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', schedule_booking_control_rail_layout, {
          passive: true
        });
        window.visualViewport.addEventListener('scroll', schedule_booking_control_rail_layout, {
          passive: true
        });
      }
    }

    /**
     * Remove axis and viewport listeners owned by booking geometry.
     *
     * @return {void}
     */
    function destroy_axis_rail_lifecycle() {
      if (axis_scroll_canvas) {
        if (axis_scroll_uses_scrollend) {
          axis_scroll_canvas.removeEventListener('scrollend', schedule_booking_control_rail_layout);
        } else {
          axis_scroll_canvas.removeEventListener('scroll', schedule_booking_control_rail_layout_after_axis_motion);
        }
      }
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', schedule_booking_control_rail_layout);
        window.visualViewport.removeEventListener('scroll', schedule_booking_control_rail_layout);
      }
      axis_scroll_canvas = null;
      axis_scroll_uses_scrollend = false;
    }

    /**
     * Initialize adapters, canonical refresh listener, and rail lifecycle once.
     *
     * @return {void}
     */
    function initialize() {
      if (!mount || is_initialized) {
        return;
      }
      is_initialized = true;
      initialize_booking_inspector();
      initialize_booking_resizing();
      initialize_booking_overview_tooltip();
      initialize_extensions();
      initialize_axis_rail_lifecycle();
      mount.addEventListener('wpbc:booking-inspector:saved', handle_booking_inspector_saved);
    }

    /**
     * Destroy adapters, listeners, frames, timers, and browser-only state.
     *
     * @return {void}
     */
    function destroy() {
      if (!is_initialized) {
        return;
      }
      mount.removeEventListener('wpbc:booking-inspector:saved', handle_booking_inspector_saved);
      close_time_slot_overflow(false);
      destroy_extensions();
      resume_booking_overflow_tooltips();
      destroy_axis_rail_lifecycle();
      if (booking_control_rail_settle_timer) {
        window.clearTimeout(booking_control_rail_settle_timer);
        booking_control_rail_settle_timer = 0;
      }
      if (booking_control_rail_frame) {
        window.cancelAnimationFrame(booking_control_rail_frame);
        booking_control_rail_frame = 0;
      }
      if (booking_overview_tooltip_controller && 'function' === typeof booking_overview_tooltip_controller.destroy) {
        booking_overview_tooltip_controller.destroy();
      }
      if (booking_resizing_controller && 'function' === typeof booking_resizing_controller.destroy) {
        booking_resizing_controller.destroy();
      }
      if (booking_inspector_adapter && 'function' === typeof booking_inspector_adapter.destroy) {
        booking_inspector_adapter.destroy();
      }
      booking_overview_tooltip_controller = null;
      booking_resizing_controller = null;
      booking_inspector_adapter = null;
      booking_selection_state = create_empty_booking_selection_state();
      booking_inspector_refresh_generation = 0;
      is_initialized = false;
    }
    return {
      initialize: initialize,
      destroy: destroy,
      handle_click: handle_click,
      handle_keydown: handle_keydown,
      begin_refresh: begin_refresh,
      register_segment: register_segment,
      begin_read_only_refresh: begin_read_only_refresh,
      register_read_only_segment: register_read_only_segment,
      complete_refresh: complete_refresh,
      complete_read_only_refresh: complete_read_only_refresh,
      set_request_loading: set_request_loading,
      prepare_created_booking_readback: prepare_created_booking_readback,
      complete_created_booking_readback: complete_created_booking_readback,
      open_created_booking_inspector: open_created_booking_inspector,
      focus_created_booking: focus_created_booking,
      schedule_layout: schedule_booking_control_rail_layout,
      schedule_layout_after_axis_motion: schedule_booking_control_rail_layout_after_axis_motion,
      is_overview_suppressed: is_booking_overview_tooltip_suppressed
    };
  }
  if (window.wpbc_timeline_modules && 'function' === typeof window.wpbc_timeline_modules.register_factory) {
    window.wpbc_timeline_modules.register_factory(module_id, create_booking_interactions_controller);
  }
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS10aW1lbGluZS9fb3V0L3RpbWVsaW5lLWJvb2tpbmctaW50ZXJhY3Rpb25zLmpzIiwibmFtZXMiOlsid2luZG93IiwiZG9jdW1lbnQiLCJtb2R1bGVfaWQiLCJleHRlbnNpb25fZmFjdG9yaWVzIiwicmVnaXN0ZXJfZXh0ZW5zaW9uX2ZhY3RvcnkiLCJleHRlbnNpb25fZmFjdG9yeSIsImluZGV4T2YiLCJwdXNoIiwid3BiY190aW1lbGluZV9ib29raW5nX2ludGVyYWN0aW9ucyIsImNyZWF0ZV9ib29raW5nX2ludGVyYWN0aW9uc19jb250cm9sbGVyIiwiY29udGV4dCIsIm1vdW50Iiwic2V0dGluZ3MiLCJib29raW5nX2luc3BlY3Rvcl9hZGFwdGVyIiwiYm9va2luZ19vdmVydmlld190b29sdGlwX2NvbnRyb2xsZXIiLCJib29raW5nX3Jlc2l6aW5nX2NvbnRyb2xsZXIiLCJleHRlbnNpb25fY29udHJvbGxlcnMiLCJzdXNwZW5kZWRfYm9va2luZ19vdmVyZmxvd190b29sdGlwcyIsImJvb2tpbmdfc2VsZWN0aW9uX3N0YXRlIiwiY3JlYXRlX2VtcHR5X2Jvb2tpbmdfc2VsZWN0aW9uX3N0YXRlIiwiYm9va2luZ19pbnNwZWN0b3JfcmVmcmVzaF9nZW5lcmF0aW9uIiwiYm9va2luZ19jb250cm9sX3JhaWxfZnJhbWUiLCJib29raW5nX2NvbnRyb2xfcmFpbF9zZXR0bGVfdGltZXIiLCJib29raW5nX2NvbnRyb2xfcmFpbF9zZXR0bGVfZGVsYXkiLCJheGlzX3Njcm9sbF9jYW52YXMiLCJheGlzX3Njcm9sbF91c2VzX3Njcm9sbGVuZCIsImFjdGl2ZV90aW1lX3Nsb3Rfb3ZlcmZsb3ciLCJ0aW1lX3Nsb3Rfb3ZlcmZsb3dfZnJhbWUiLCJpc19pbml0aWFsaXplZCIsImludm9rZV9leHRlbnNpb25fbWV0aG9kIiwibWV0aG9kX25hbWUiLCJtZXRob2RfYXJndW1lbnRzIiwicmVzdWx0cyIsImZvckVhY2giLCJleHRlbnNpb25fY29udHJvbGxlciIsInJlc3VsdCIsImFwcGx5IiwiaXNfZXh0ZW5zaW9uX2ludGVyYWN0aW5nIiwic29tZSIsIkJvb2xlYW4iLCJjYW5fc3RhcnRfZXh0ZW5zaW9uX2ludGVyYWN0aW9uIiwiaXNfaG9zdF9hY3RpdmUiLCJpc19pbnRlcmFjdGluZyIsImNsYXNzTGlzdCIsImNvbnRhaW5zIiwiZ2V0QXR0cmlidXRlIiwicXVlcnlTZWxlY3RvciIsInJldmlld19ib29raW5nX21vdmVtZW50X3Byb3Bvc2FsIiwicHJvcG9zYWwiLCJzdGF0ZSIsInJldmlld19ib29raW5nX3Jlc2l6ZV9wcm9wb3NhbCIsInJldmlld19yZXNpemVfcHJvcG9zYWwiLCJzZXRfZXh0ZW5zaW9uX2ludGVyYWN0aW9uX3N1c3BlbmRlZCIsImlzX3N1c3BlbmRlZCIsIm93bmVyX2NhcmQiLCJjbG9zZV90aW1lX3Nsb3Rfb3ZlcmZsb3ciLCJzdXNwZW5kX2Jvb2tpbmdfb3ZlcmZsb3dfdG9vbHRpcHMiLCJzdXNwZW5kIiwicmVzdW1lX2Jvb2tpbmdfb3ZlcmZsb3dfdG9vbHRpcHMiLCJyZXN1bWUiLCJpbml0aWFsaXplX2V4dGVuc2lvbnMiLCJleHRlbnNpb25fY29udGV4dCIsImNhbGxiYWNrcyIsImNhbl9zdGFydF9pbnRlcmFjdGlvbiIsIm9wZW5fYm9va2luZ19mdWxsX3Jlc2NoZWR1bGUiLCJvcGVuX2Z1bGxfcmVzY2hlZHVsZV9mcm9tX2hhbmRsZSIsInNldF9pbnRlcmFjdGlvbl9zdXNwZW5kZWQiLCJzZXRfYXhpc193aW5kb3dfbG9hZGluZ19sb2NrZWQiLCJzaG93X2FkbWluX21lc3NhZ2UiLCJyZWZyZXNoX2FmdGVyX2FwcGx5IiwicmVmcmVzaF9hZnRlcl9yZXNpemVfYXBwbHkiLCJnZXRfYXhpcyIsImF4aXMiLCJzY2hlZHVsZV9sYXlvdXQiLCJzY2hlZHVsZV9ib29raW5nX2NvbnRyb2xfcmFpbF9sYXlvdXQiLCJpbml0aWFsaXplIiwiZGVzdHJveSIsImRlc3Ryb3lfZXh0ZW5zaW9ucyIsInNsaWNlIiwicmV2ZXJzZSIsInBvc2l0aW9uX3RpbWVfc2xvdF9vdmVyZmxvdyIsInRyaWdnZXJfcmVjdGFuZ2xlIiwicG9wb3Zlcl9yZWN0YW5nbGUiLCJ2aWV3cG9ydF93aWR0aCIsInZpZXdwb3J0X2hlaWdodCIsInZpZXdwb3J0X21hcmdpbiIsImxlZnQiLCJ0b3AiLCJ0cmlnZ2VyIiwiaXNDb25uZWN0ZWQiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJwb3BvdmVyIiwiZG9jdW1lbnRFbGVtZW50IiwiY2xpZW50V2lkdGgiLCJjbGllbnRIZWlnaHQiLCJNYXRoIiwibWluIiwibWF4Iiwid2lkdGgiLCJib3R0b20iLCJoZWlnaHQiLCJzdHlsZSIsInJvdW5kIiwic2NoZWR1bGVfdGltZV9zbG90X292ZXJmbG93X3Bvc2l0aW9uIiwicmVxdWVzdEFuaW1hdGlvbkZyYW1lIiwiaGFuZGxlX3RpbWVfc2xvdF9vdmVyZmxvd19kb2N1bWVudF9jbGljayIsImV2ZW50IiwiY2xvc2VfYnV0dG9uIiwiYm9va2luZ19pdGVtIiwidGFyZ2V0IiwiY2xvc2VzdCIsInByZXZlbnREZWZhdWx0Iiwib3BlbiIsInJlc3RvcmVfZm9jdXMiLCJvdmVyZmxvd19zdGF0ZSIsImNhbmNlbEFuaW1hdGlvbkZyYW1lIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImhhbmRsZV90aW1lX3Nsb3Rfb3ZlcmZsb3dfa2V5ZG93biIsInNldEF0dHJpYnV0ZSIsImhpZGRlbiIsInJlbW92ZSIsInJlbW92ZVByb3BlcnR5Iiwid3JhcHBlciIsImFwcGVuZENoaWxkIiwiZm9jdXMiLCJrZXkiLCJ0b2dnbGVfdGltZV9zbG90X292ZXJmbG93IiwiYWRkIiwiYm9keSIsImFkZEV2ZW50TGlzdGVuZXIiLCJwYXNzaXZlIiwiZmlyc3RfaXRlbSIsImJvb2tpbmdfaWQiLCJzZWdtZW50X2hpbnQiLCJnZXRfYm9va2luZ19zZWdtZW50X2lkZW50aXR5Iiwic2VnbWVudCIsImNhcmQiLCJOdW1iZXIiLCJTdHJpbmciLCJzeW5jaHJvbml6ZV9ib29raW5nX3NlbGVjdGlvbiIsImZhbGxiYWNrX3NlZ21lbnRfaGludCIsImhhc19zZWdtZW50X2hpbnQiLCJBcnJheSIsInByb3RvdHlwZSIsImNhbGwiLCJxdWVyeVNlbGVjdG9yQWxsIiwic2VsZWN0aW9uX2NvbnRyb2wiLCJpZGVudGl0eSIsImlzX3NlbGVjdGVkIiwidG9nZ2xlIiwicmFpbCIsInJhaWxfYm9va2luZ19pZCIsImRldGFpbHNfYWN0aW9uIiwiZGlzbWlzc19ib29raW5nX292ZXJmbG93X3Rvb2x0aXBzIiwidG9vbHRpcF9vd25lcnMiLCJ0b29sdGlwX293bmVyIiwiX3RpcHB5IiwiaGlkZSIsImRpc2FibGUiLCJ0b29sdGlwX2luZGV4IiwibGVuZ3RoIiwiZW5hYmxlIiwic2VsZWN0X2Jvb2tpbmdfc2VnbWVudCIsInNlbGVjdCIsInByZXBhcmVfY3JlYXRlZF9ib29raW5nX3JlYWRiYWNrIiwiY29tcGxldGVfY3JlYXRlZF9ib29raW5nX3JlYWRiYWNrIiwib3Blbl9jcmVhdGVkX2Jvb2tpbmdfaW5zcGVjdG9yIiwiZm9jdXNfY3JlYXRlZF9ib29raW5nIiwic2V0X2NoYW5nZWRfc3R5bGVfcHJvcGVydHkiLCJlbGVtZW50IiwicHJvcGVydHlfbmFtZSIsInByb3BlcnR5X3ZhbHVlIiwiZ2V0UHJvcGVydHlWYWx1ZSIsInNldFByb3BlcnR5IiwiZ2V0X2Jvb2tpbmdfYWNjZXNzb3J5X2NhcmQiLCJhY2Nlc3NvcnkiLCJjYXJkX2J5X3NlZ21lbnRfaWQiLCJjYXJkcyIsImhhcyIsImdldCIsImNhbmRpZGF0ZSIsImdldF92aXNpYmxlX3RpbWVfY2FudmFzX3JlY3RhbmdsZSIsImNhbnZhcyIsImNhbnZhc19yZWN0YW5nbGUiLCJyZXNvdXJjZV9jb2x1bW4iLCJyZXNvdXJjZV9yZWN0YW5nbGUiLCJ2aXN1YWxfdmlld3BvcnQiLCJ2aXN1YWxWaWV3cG9ydCIsInZpZXdwb3J0X2xlZnQiLCJvZmZzZXRMZWZ0IiwiaW5uZXJXaWR0aCIsInZpZXdwb3J0X3JpZ2h0IiwicmlnaHQiLCJ2aXNpYmxlX2xlZnQiLCJ2aXNpYmxlX3JpZ2h0IiwiZ2V0X2Jvb2tpbmdfbGF5b3V0X3Rva2VuIiwiY29tcHV0ZWRfc3R5bGUiLCJmYWxsYmFja19weCIsInBhcnNlZF92YWx1ZSIsInBhcnNlRmxvYXQiLCJpc0Zpbml0ZSIsIm1vdmVfYm9va2luZ19jb250cm9sX3JhaWwiLCJwYXJlbnQiLCJyZWZlcmVuY2Vfbm9kZSIsImZvY3VzZWRfY29udHJvbCIsImFjdGl2ZUVsZW1lbnQiLCJpbnNlcnRCZWZvcmUiLCJwcmV2ZW50U2Nyb2xsIiwiZXJyb3IiLCJyZXN0b3JlX2Jvb2tpbmdfY29udHJvbF9yYWlsIiwiZG9jayIsInBhcmVudE5vZGUiLCJpc19ib29raW5nX2NvbnRyb2xfcmFpbF9jYXJkX293bmVkIiwiaGFzQXR0cmlidXRlIiwiZ2V0X2Jvb2tpbmdfb3ZlcmxheV9yYWlsX3Bvc2l0aW9uIiwidmlzaWJsZV9zZWdtZW50IiwidmlzaWJsZV9jYW52YXMiLCJyYWlsX3dpZHRoIiwicmFpbF9nYXAiLCJpbmxpbmVfZW5kX2xlZnQiLCJpc19ydGwiLCJpbmxpbmVfc3RhcnRfbGVmdCIsImZpdHMiLCJwaHlzaWNhbF9sZWZ0IiwiYXZhaWxhYmxlX2JlZm9yZSIsImF2YWlsYWJsZV9hZnRlciIsImxvZ2ljYWxfc2lkZSIsImxheW91dF9ib29raW5nX2NvbnRyb2xfcmFpbHMiLCJyYWlscyIsIk1hcCIsInNlZ21lbnRfaWQiLCJzZXQiLCJzZWdtZW50X2hvc3QiLCJwYXJlbnRFbGVtZW50IiwiY2FyZF9yZWN0YW5nbGUiLCJob3N0X3JlY3RhbmdsZSIsImlzX2Jvb2tpbmdfc2VsZWN0ZWQiLCJ2aXNpYmxlX3dpZHRoIiwiY2FyZF93aWR0aCIsImFjY2Vzc29yeV9zaXplIiwiZHJhZ19pbmRpY2F0b3Jfc2l6ZSIsImFjY2Vzc29yeV9nYXAiLCJhY2Nlc3NvcnlfcGFkZGluZyIsImF2YXRhcl9zaXplIiwic2VsZWN0aW9uX2VkZ2VfcmVzZXJ2ZSIsImNvbnRpbnVhdGlvbl93aWR0aCIsImFjY2Vzc29yeV9jb3VudCIsImRyYWdfaW5kaWNhdG9yIiwiaGFzX3Zpc2libGVfZHJhZ19pbmRpY2F0b3IiLCJhY2Nlc3NvcnlfY29udGVudF93aWR0aCIsImF2YXRhciIsImhhc19leHBhbmRlZF9hdmF0YXIiLCJyZXF1aXJlZF93aWR0aCIsImV4cGFuZGVkX3JlcXVpcmVkX3dpZHRoIiwic2hvdWxkX2NvbmRlbnNlIiwic2hvdWxkX21pbmltaXplIiwic3RhcnRfcmFpbF9yZXNlcnZlIiwiZW5kX3JhaWxfcmVzZXJ2ZSIsInN0YXJ0X2JvdW5kYXJ5X3Bvc2l0aW9uIiwiZW5kX2JvdW5kYXJ5X3Bvc2l0aW9uIiwic3RhcnRfYm91bmRhcnlfdmlzaWJsZSIsImVuZF9ib3VuZGFyeV92aXNpYmxlIiwib3ZlcmxheV9wb3NpdGlvbiIsIm92ZXJsYXlfZ2FwIiwicmVxdWlyZXNfY2xhbXBlZF9vdmVybGF5IiwibG9naWNhbF9yYWlsX3N0YXJ0IiwicmFpbF9ibG9ja19zdGFydCIsImdldENvbXB1dGVkU3R5bGUiLCJ1cGRhdGVfZ2VvbWV0cnkiLCJjbGVhclRpbWVvdXQiLCJzY2hlZHVsZV9ib29raW5nX2NvbnRyb2xfcmFpbF9sYXlvdXRfYWZ0ZXJfYXhpc19tb3Rpb24iLCJzZXRUaW1lb3V0IiwiaW5pdGlhbGl6ZV9ib29raW5nX2luc3BlY3RvciIsImhvc3QiLCJ3cGJjX2Jvb2tpbmdfaW5zcGVjdG9yX2hvc3RzIiwiY3JlYXRlX3RpbWVsaW5lIiwiYm9va2luZ19pbnNwZWN0b3IiLCJoYW5kbGUiLCJvcGVuX3Jlc2NoZWR1bGluZyIsImFwcGx5X3Jlc3VsdCIsInJlZnJlc2hfcmVxdWVzdHMiLCJpbnZhbGlkYXRlIiwicmVmcmVzaF9hZnRlcl9leHRlcm5hbF9hcHBseSIsImpRdWVyeSIsIkRlZmVycmVkIiwicmVqZWN0IiwibWVzc2FnZSIsInByb21pc2UiLCJ3aGVuIiwiaW5pdGlhbGl6ZV9ib29raW5nX3Jlc2l6aW5nIiwid3BiY190aW1lbGluZV9ib29raW5nX3Jlc2l6aW5nIiwiY3JlYXRlX2NvbnRyb2xsZXIiLCJib29raW5nX3Jlc2l6aW5nIiwib3Blbl9mdWxsX3Jlc2NoZWR1bGUiLCJzdXNwZW5kX292ZXJ2aWV3IiwicmVzdW1lX292ZXJ2aWV3IiwiaXNfYm9va2luZ19vdmVydmlld190b29sdGlwX3N1cHByZXNzZWQiLCJpc19lbXB0eV9yYW5nZV9yZXNpemluZyIsIm9wZW5fYm9va2luZ19kZXRhaWxzX2Zyb21fb3ZlcnZpZXciLCJzY3JvbGxfdGltZWxpbmVfZnJvbV9vdmVydmlldyIsInNjcm9sbF9heGlzX2Zyb21fZXh0ZXJuYWxfd2hlZWwiLCJpbml0aWFsaXplX2Jvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcCIsIndwYmNfYm9va2luZ19vdmVydmlld190b29sdGlwIiwiYm9va2luZ19vdmVydmlld190b29sdGlwIiwiaXNfc3VwcHJlc3NlZCIsIm9wZW5fYm9va2luZ19kZXRhaWxzIiwic2Nyb2xsX3RpbWVsaW5lIiwiaGFuZGxlX2Jvb2tpbmdfaW5zcGVjdG9yX3NhdmVkIiwiZXZlbnRfZGV0YWlsIiwiZGV0YWlsIiwicmVmcmVzaF9nZW5lcmF0aW9uIiwic291cmNlIiwicmVmcmVzaF9hZnRlcl9pbnNwZWN0b3Jfc2F2ZSIsImhhbmRsZV9rZXlkb3duIiwiY3RybEtleSIsIm1ldGFLZXkiLCJhbHRLZXkiLCJzaGlmdEtleSIsImhhbmRsZV9jbGljayIsInRpbWVfc2xvdF9tb3JlIiwiYmVnaW5fcmVmcmVzaCIsInJlZnJlc2giLCJyZWdpc3Rlcl9zZWdtZW50Iiwic2VnbWVudF9lbGVtZW50IiwicmVzb3VyY2Vfc3VtbWFyeSIsInJlZ2lzdGVyIiwiYmVnaW5fcmVhZF9vbmx5X3JlZnJlc2giLCJyZWZyZXNoX2NvbnRleHQiLCJyZWdpc3Rlcl9yZWFkX29ubHlfc2VnbWVudCIsInByZXNlbnRhdGlvbl9jb250ZXh0IiwiY29tcGxldGVfcmVhZF9vbmx5X3JlZnJlc2giLCJjb21wbGV0ZV9yZWZyZXNoIiwic2V0X3JlcXVlc3RfbG9hZGluZyIsImlzX2xvYWRpbmciLCJpbml0aWFsaXplX2F4aXNfcmFpbF9saWZlY3ljbGUiLCJkZXN0cm95X2F4aXNfcmFpbF9saWZlY3ljbGUiLCJzY2hlZHVsZV9sYXlvdXRfYWZ0ZXJfYXhpc19tb3Rpb24iLCJpc19vdmVydmlld19zdXBwcmVzc2VkIiwid3BiY190aW1lbGluZV9tb2R1bGVzIiwicmVnaXN0ZXJfZmFjdG9yeSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtdGltZWxpbmUvX3NyYy90aW1lbGluZS1ib29raW5nLWludGVyYWN0aW9ucy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRpbWVsaW5lIGJvb2tpbmcgc2VsZWN0aW9uLCBjb250cm9sIHJhaWxzLCBJbnNwZWN0b3IsIGFuZCBPdmVydmlldyBhZGFwdGVyLlxuICpcbiAqIFRoZSBtb2R1bGUgb3ducyBicm93c2VyLW9ubHkgYm9va2luZyBpbnRlcmFjdGlvbiBzdGF0ZSBhbmQgZ2VvbWV0cnkuIFRpbWVsaW5lXG4gKiBjb250aW51ZXMgdG8gb3duIGF1dGhvcml6ZWQgd2luZG93IHJlYWRzIGFuZCByZW5kZXJpbmcsIHdoaWxlIHRoZSBCb29raW5nXG4gKiBJbnNwZWN0b3IgYW5kIEJvb2tpbmcgT3ZlcnZpZXcgZG9tYWlucyByZW1haW4gYXV0aG9yaXRhdGl2ZSBmb3IgdGhlaXIgRFRPcyxcbiAqIHJlcXVlc3RzLCB0ZW1wbGF0ZXMsIGZvY3VzIGxpZmVjeWNsZXMsIGFuZCBwZXJtaXNzaW9ucy5cbiAqXG4gKiBAcGFja2FnZSBCb29raW5nIENhbGVuZGFyXG4gKiBAc2luY2UgICAxMi4wLjBcbiAqL1xuKCBmdW5jdGlvbiAoIHdpbmRvdywgZG9jdW1lbnQgKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHR2YXIgbW9kdWxlX2lkID0gJ2Jvb2tpbmdfaW50ZXJhY3Rpb25zJztcblx0dmFyIGV4dGVuc2lvbl9mYWN0b3JpZXMgPSBbXTtcblxuXHQvKipcblx0ICogUmVnaXN0ZXIgb25lIGRvbWFpbi1vd25lZCBib29raW5nLWludGVyYWN0aW9uIGV4dGVuc2lvbiBmYWN0b3J5LlxuXHQgKlxuXHQgKiBUaGUgc2hhcmVkIGNvbnRyb2xsZXIgb3ducyBvbmx5IGxpZmVjeWNsZSBmYW4tb3V0LiBGYWN0b3JpZXMgcmV0YWluIHRoZWlyXG5cdCAqIG93biBkYXRhLCBhdXRob3JpemF0aW9uLCByZW5kZXJpbmcsIGFuZCBpbnRlcmFjdGlvbiBydWxlcy4gRHVwbGljYXRlXG5cdCAqIHJlZ2lzdHJhdGlvbiBvZiB0aGUgc2FtZSBmdW5jdGlvbiBpcyBpZGVtcG90ZW50LlxuXHQgKlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBleHRlbnNpb25fZmFjdG9yeSBGYWN0b3J5IHJlY2VpdmluZyBuZXV0cmFsIGhvc3QgY29udGV4dC5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBmYWN0b3J5IGlzIGF2YWlsYWJsZSB0byBmdXR1cmUgY29udHJvbGxlcnMuXG5cdCAqL1xuXHRmdW5jdGlvbiByZWdpc3Rlcl9leHRlbnNpb25fZmFjdG9yeSggZXh0ZW5zaW9uX2ZhY3RvcnkgKSB7XG5cdFx0aWYgKCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgZXh0ZW5zaW9uX2ZhY3RvcnkgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICggLTEgPT09IGV4dGVuc2lvbl9mYWN0b3JpZXMuaW5kZXhPZiggZXh0ZW5zaW9uX2ZhY3RvcnkgKSApIHtcblx0XHRcdGV4dGVuc2lvbl9mYWN0b3JpZXMucHVzaCggZXh0ZW5zaW9uX2ZhY3RvcnkgKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHdpbmRvdy53cGJjX3RpbWVsaW5lX2Jvb2tpbmdfaW50ZXJhY3Rpb25zID0ge1xuXHRcdHJlZ2lzdGVyX2V4dGVuc2lvbl9mYWN0b3J5OiByZWdpc3Rlcl9leHRlbnNpb25fZmFjdG9yeVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBDcmVhdGUgb25lIGJvb2tpbmctaW50ZXJhY3Rpb25zIGNvbnRyb2xsZXIgZm9yIGEgVGltZWxpbmUgbW91bnQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IFRpbWVsaW5lLW93bmVkIG1vdW50LCBzZXR0aW5ncywgYW5kIGJvdW5kZWQgY2FsbGJhY2tzLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IEJvb2tpbmcgaW50ZXJhY3Rpb24gbGlmZWN5Y2xlIGFuZCBkZWxlZ2F0aW9uIEFQSS5cblx0ICovXG5cdGZ1bmN0aW9uIGNyZWF0ZV9ib29raW5nX2ludGVyYWN0aW9uc19jb250cm9sbGVyKCBjb250ZXh0ICkge1xuXHRcdHZhciBtb3VudCA9IGNvbnRleHQubW91bnQgfHwgbnVsbDtcblx0XHR2YXIgc2V0dGluZ3MgPSBjb250ZXh0LnNldHRpbmdzIHx8IHt9O1xuXHRcdHZhciBib29raW5nX2luc3BlY3Rvcl9hZGFwdGVyID0gbnVsbDtcblx0XHR2YXIgYm9va2luZ19vdmVydmlld190b29sdGlwX2NvbnRyb2xsZXIgPSBudWxsO1xuXHRcdHZhciBib29raW5nX3Jlc2l6aW5nX2NvbnRyb2xsZXIgPSBudWxsO1xuXHRcdHZhciBleHRlbnNpb25fY29udHJvbGxlcnMgPSBbXTtcblx0XHR2YXIgc3VzcGVuZGVkX2Jvb2tpbmdfb3ZlcmZsb3dfdG9vbHRpcHMgPSBbXTtcblx0XHR2YXIgYm9va2luZ19zZWxlY3Rpb25fc3RhdGUgPSBjcmVhdGVfZW1wdHlfYm9va2luZ19zZWxlY3Rpb25fc3RhdGUoKTtcblx0XHR2YXIgYm9va2luZ19pbnNwZWN0b3JfcmVmcmVzaF9nZW5lcmF0aW9uID0gMDtcblx0XHR2YXIgYm9va2luZ19jb250cm9sX3JhaWxfZnJhbWUgPSAwO1xuXHRcdHZhciBib29raW5nX2NvbnRyb2xfcmFpbF9zZXR0bGVfdGltZXIgPSAwO1xuXHRcdHZhciBib29raW5nX2NvbnRyb2xfcmFpbF9zZXR0bGVfZGVsYXkgPSA4MDtcblx0XHR2YXIgYXhpc19zY3JvbGxfY2FudmFzID0gbnVsbDtcblx0XHR2YXIgYXhpc19zY3JvbGxfdXNlc19zY3JvbGxlbmQgPSBmYWxzZTtcblx0XHR2YXIgYWN0aXZlX3RpbWVfc2xvdF9vdmVyZmxvdyA9IG51bGw7XG5cdFx0dmFyIHRpbWVfc2xvdF9vdmVyZmxvd19mcmFtZSA9IDA7XG5cdFx0dmFyIGlzX2luaXRpYWxpemVkID0gZmFsc2U7XG5cblx0XHQvKipcblx0XHQgKiBJbnZva2Ugb25lIG9wdGlvbmFsIGxpZmVjeWNsZSBtZXRob2Qgb24gZXZlcnkgaW5pdGlhbGl6ZWQgZXh0ZW5zaW9uLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG1ldGhvZF9uYW1lIFN0YWJsZSBsaWZlY3ljbGUgbWV0aG9kIG5hbWUuXG5cdFx0ICogQHBhcmFtIHtBcnJheX0gIG1ldGhvZF9hcmd1bWVudHMgT3JkZXJlZCBtZXRob2QgYXJndW1lbnRzLlxuXHRcdCAqIEByZXR1cm4ge0FycmF5fSBPcmRlcmVkIG5vbi11bmRlZmluZWQgZXh0ZW5zaW9uIHJlc3VsdHMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaW52b2tlX2V4dGVuc2lvbl9tZXRob2QoIG1ldGhvZF9uYW1lLCBtZXRob2RfYXJndW1lbnRzICkge1xuXHRcdFx0dmFyIHJlc3VsdHMgPSBbXTtcblxuXHRcdFx0ZXh0ZW5zaW9uX2NvbnRyb2xsZXJzLmZvckVhY2goIGZ1bmN0aW9uICggZXh0ZW5zaW9uX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRcdHZhciByZXN1bHQ7XG5cblx0XHRcdFx0aWYgKCAhIGV4dGVuc2lvbl9jb250cm9sbGVyIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBleHRlbnNpb25fY29udHJvbGxlclsgbWV0aG9kX25hbWUgXSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVzdWx0ID0gZXh0ZW5zaW9uX2NvbnRyb2xsZXJbIG1ldGhvZF9uYW1lIF0uYXBwbHkoIGV4dGVuc2lvbl9jb250cm9sbGVyLCBtZXRob2RfYXJndW1lbnRzIHx8IFtdICk7XG5cdFx0XHRcdGlmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiByZXN1bHQgKSB7XG5cdFx0XHRcdFx0cmVzdWx0cy5wdXNoKCByZXN1bHQgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gcmVzdWx0cztcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXBvcnQgd2hldGhlciBhIGZvY3VzZWQgZG9tYWluIGV4dGVuc2lvbiBjdXJyZW50bHkgb3ducyBpbnRlcmFjdGlvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBhbiBleHRlbnNpb24gcmVwb3J0cyBhbiBhY3RpdmUgaW50ZXJhY3Rpb24uXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaXNfZXh0ZW5zaW9uX2ludGVyYWN0aW5nKCkge1xuXHRcdFx0cmV0dXJuIGludm9rZV9leHRlbnNpb25fbWV0aG9kKCAnaXNfaW50ZXJhY3RpbmcnLCBbXSApLnNvbWUoIEJvb2xlYW4gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBEZXRlcm1pbmUgd2hldGhlciBhIG5ldyBleHRlcm5hbCBib29raW5nIGludGVyYWN0aW9uIG1heSBzdGFydC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBUaW1lbGluZSBhbmQgZXhpc3RpbmcgZG9tYWlucyBhcmUgaWRsZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjYW5fc3RhcnRfZXh0ZW5zaW9uX2ludGVyYWN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIEJvb2xlYW4oXG5cdFx0XHRcdG1vdW50XG5cdFx0XHRcdCYmIGlzX2luaXRpYWxpemVkXG5cdFx0XHRcdCYmICggJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIGNvbnRleHQuaXNfaG9zdF9hY3RpdmUgfHwgY29udGV4dC5pc19ob3N0X2FjdGl2ZSgpIClcblx0XHRcdFx0JiYgISBpc19leHRlbnNpb25faW50ZXJhY3RpbmcoKVxuXHRcdFx0XHQmJiAhIGFjdGl2ZV90aW1lX3Nsb3Rfb3ZlcmZsb3dcblx0XHRcdFx0JiYgISAoIGJvb2tpbmdfcmVzaXppbmdfY29udHJvbGxlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgYm9va2luZ19yZXNpemluZ19jb250cm9sbGVyLmlzX2ludGVyYWN0aW5nICYmIGJvb2tpbmdfcmVzaXppbmdfY29udHJvbGxlci5pc19pbnRlcmFjdGluZygpIClcblx0XHRcdFx0JiYgISBtb3VudC5jbGFzc0xpc3QuY29udGFpbnMoICdpcy1yZXF1ZXN0LWxvYWRpbmcnIClcblx0XHRcdFx0JiYgJ3RydWUnICE9PSBtb3VudC5nZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knIClcblx0XHRcdFx0JiYgISBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLWluc3BlY3Rvci10cmlnZ2VyXS5pcy1ib29raW5nLWRldGFpbHMtb3BlbicgKVxuXHRcdFx0XHQmJiAhIG1vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctZGF0ZS1lZGl0b3ItbGF5ZXJdOm5vdChbaGlkZGVuXSksIFtkYXRhLXdwYmMtYm9va2luZy1yZXNjaGVkdWxpbmctbGF5ZXJdOm5vdChbaGlkZGVuXSknIClcblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRGVsZWdhdGUgb25lIHNhbWUtUmVzb3VyY2UgbW92ZW1lbnQgcHJvcG9zYWwgdG8gdGhlIGRvbWFpbi1vd25lZCBSZXZpZXcgd29ya2Zsb3cuXG5cdFx0ICpcblx0XHQgKiBFeHBhbmRlZCBwcmVzZW50YXRpb25zIG1heSBvd24gZGlmZmVyZW50IGdlc3R1cmUgZ2VvbWV0cnksIGJ1dCB0aGV5IG11c3Rcblx0XHQgKiBub3QgZHVwbGljYXRlIEJvb2tpbmcgUmVzY2hlZHVsaW5nIFJldmlldywgQXBwbHksIG9yIGNhbm9uaWNhbCByZWFkYmFjay5cblx0XHQgKiBUaGUgZmlyc3QgcmVnaXN0ZXJlZCBkb21haW4gZXh0ZW5zaW9uIHRoYXQgYWNjZXB0cyB0aGUgcHJvcG9zYWwgb3ducyB0aGVcblx0XHQgKiBjb21wbGV0ZSBhdXRob3JpdGF0aXZlIGxpZmVjeWNsZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wb3NhbCBFeGVjdXRhYmxlLWZyZWUgYm9va2luZyBtb3ZlbWVudCBwcm9wb3NhbC5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc3RhdGUgICAgUmVzdG9yZWQgcHJlc2VudGF0aW9uIGFuZCBmb2N1cyBjb250ZXh0LlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBhIGRvbWFpbiBleHRlbnNpb24gYWNjZXB0ZWQgdGhlIHByb3Bvc2FsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJldmlld19ib29raW5nX21vdmVtZW50X3Byb3Bvc2FsKCBwcm9wb3NhbCwgc3RhdGUgKSB7XG5cdFx0XHRyZXR1cm4gaW52b2tlX2V4dGVuc2lvbl9tZXRob2QoICdyZXZpZXdfbW92ZW1lbnRfcHJvcG9zYWwnLCBbIHByb3Bvc2FsLCBzdGF0ZSBdICkuc29tZSggQm9vbGVhbiApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEhhbmQgb25lIHByZXNlbnRhdGlvbi1uZXV0cmFsIHJlc2l6ZSBwcm9wb3NhbCB0byB0aGUgY2Fub25pY2FsIGNvbnRyb2xsZXIuXG5cdFx0ICpcblx0XHQgKiBUaW1lLXJvdyBnZW9tZXRyeSByZW1haW5zIGV4dGVuc2lvbi1vd25lZC4gVGhpcyBicmlkZ2Ugb25seSBmb3J3YXJkcyB0aGVcblx0XHQgKiBleGVjdXRhYmxlLWZyZWUgcHJvcG9zYWwgdG8gdGhlIGFscmVhZHkgbW91bnRlZCBCb29raW5nIFJlc2l6aW5nIGRvbWFpbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wb3NhbCBFeGVjdXRhYmxlLWZyZWUgYm9va2luZyByZXNpemUgcHJvcG9zYWwuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHN0YXRlICAgIFJlc3RvcmVkIHByZXNlbnRhdGlvbiBhbmQgZm9jdXMgY29udGV4dC5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gY2Fub25pY2FsIFJlc2l6ZSBSZXZpZXcgYWNjZXB0ZWQgdGhlIHByb3Bvc2FsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJldmlld19ib29raW5nX3Jlc2l6ZV9wcm9wb3NhbCggcHJvcG9zYWwsIHN0YXRlICkge1xuXHRcdFx0cmV0dXJuIEJvb2xlYW4oXG5cdFx0XHRcdGJvb2tpbmdfcmVzaXppbmdfY29udHJvbGxlclxuXHRcdFx0XHRcdCYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBib29raW5nX3Jlc2l6aW5nX2NvbnRyb2xsZXIucmV2aWV3X3Jlc2l6ZV9wcm9wb3NhbFxuXHRcdFx0XHRcdCYmIGJvb2tpbmdfcmVzaXppbmdfY29udHJvbGxlci5yZXZpZXdfcmVzaXplX3Byb3Bvc2FsKCBwcm9wb3NhbCwgc3RhdGUgKVxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTdXNwZW5kIG9yIHJlc3VtZSBjb25mbGljdGluZyBUaW1lbGluZSBib29raW5nIHByZXNlbnRhdGlvbiBhZGFwdGVycy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfc3VzcGVuZGVkIFdoZXRoZXIgYW4gZXh0ZW5zaW9uIG93bnMgcG9pbnRlciBhdHRlbnRpb24uXG5cdFx0ICogQHBhcmFtIHtFbGVtZW50fSBvd25lcl9jYXJkICAgT3B0aW9uYWwgYm9va2luZyBjYXJkIG93bmluZyB0aGUgZ2VzdHVyZS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNldF9leHRlbnNpb25faW50ZXJhY3Rpb25fc3VzcGVuZGVkKCBpc19zdXNwZW5kZWQsIG93bmVyX2NhcmQgKSB7XG5cdFx0XHRpZiAoIGlzX3N1c3BlbmRlZCApIHtcblx0XHRcdFx0Y2xvc2VfdGltZV9zbG90X292ZXJmbG93KCBmYWxzZSApO1xuXHRcdFx0XHRzdXNwZW5kX2Jvb2tpbmdfb3ZlcmZsb3dfdG9vbHRpcHMoIG93bmVyX2NhcmQgfHwgbnVsbCApO1xuXHRcdFx0XHRpZiAoIGJvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcF9jb250cm9sbGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBib29raW5nX292ZXJ2aWV3X3Rvb2x0aXBfY29udHJvbGxlci5zdXNwZW5kICkge1xuXHRcdFx0XHRcdGJvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcF9jb250cm9sbGVyLnN1c3BlbmQoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHJlc3VtZV9ib29raW5nX292ZXJmbG93X3Rvb2x0aXBzKCk7XG5cdFx0XHRpZiAoIGJvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcF9jb250cm9sbGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBib29raW5nX292ZXJ2aWV3X3Rvb2x0aXBfY29udHJvbGxlci5yZXN1bWUgKSB7XG5cdFx0XHRcdGJvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcF9jb250cm9sbGVyLnJlc3VtZSgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEluaXRpYWxpemUgcmVnaXN0ZXJlZCBkb21haW4gZXh0ZW5zaW9ucyB0aHJvdWdoIG9uZSBuZXV0cmFsIGxpZmVjeWNsZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaW5pdGlhbGl6ZV9leHRlbnNpb25zKCkge1xuXHRcdFx0dmFyIGV4dGVuc2lvbl9jb250ZXh0ID0ge1xuXHRcdFx0XHRtb3VudDogbW91bnQsXG5cdFx0XHRcdHNldHRpbmdzOiBzZXR0aW5ncyxcblx0XHRcdFx0Y2FsbGJhY2tzOiB7XG5cdFx0XHRcdFx0Y2FuX3N0YXJ0X2ludGVyYWN0aW9uOiBjYW5fc3RhcnRfZXh0ZW5zaW9uX2ludGVyYWN0aW9uLFxuXHRcdFx0XHRcdHJldmlld19ib29raW5nX21vdmVtZW50X3Byb3Bvc2FsOiByZXZpZXdfYm9va2luZ19tb3ZlbWVudF9wcm9wb3NhbCxcblx0XHRcdFx0XHRyZXZpZXdfYm9va2luZ19yZXNpemVfcHJvcG9zYWw6IHJldmlld19ib29raW5nX3Jlc2l6ZV9wcm9wb3NhbCxcblx0XHRcdFx0XHRvcGVuX2Jvb2tpbmdfZnVsbF9yZXNjaGVkdWxlOiBvcGVuX2Z1bGxfcmVzY2hlZHVsZV9mcm9tX2hhbmRsZSxcblx0XHRcdFx0XHRzZXRfaW50ZXJhY3Rpb25fc3VzcGVuZGVkOiBzZXRfZXh0ZW5zaW9uX2ludGVyYWN0aW9uX3N1c3BlbmRlZCxcblx0XHRcdFx0XHRzZXRfYXhpc193aW5kb3dfbG9hZGluZ19sb2NrZWQ6IGNvbnRleHQuc2V0X2F4aXNfd2luZG93X2xvYWRpbmdfbG9ja2VkLFxuXHRcdFx0XHRcdHNob3dfYWRtaW5fbWVzc2FnZTogY29udGV4dC5zaG93X2FkbWluX21lc3NhZ2UsXG5cdFx0XHRcdFx0cmVmcmVzaF9hZnRlcl9hcHBseTogcmVmcmVzaF9hZnRlcl9yZXNpemVfYXBwbHksXG5cdFx0XHRcdFx0Z2V0X2F4aXM6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdHJldHVybiBzZXR0aW5ncy5heGlzIHx8IHt9O1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0aXNfaG9zdF9hY3RpdmU6IGNvbnRleHQuaXNfaG9zdF9hY3RpdmUsXG5cdFx0XHRcdFx0c2NoZWR1bGVfbGF5b3V0OiBzY2hlZHVsZV9ib29raW5nX2NvbnRyb2xfcmFpbF9sYXlvdXRcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0ZXh0ZW5zaW9uX2ZhY3Rvcmllcy5mb3JFYWNoKCBmdW5jdGlvbiAoIGV4dGVuc2lvbl9mYWN0b3J5ICkge1xuXHRcdFx0XHR2YXIgZXh0ZW5zaW9uX2NvbnRyb2xsZXIgPSBleHRlbnNpb25fZmFjdG9yeSggZXh0ZW5zaW9uX2NvbnRleHQgKTtcblxuXHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0ISBleHRlbnNpb25fY29udHJvbGxlclxuXHRcdFx0XHRcdHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBleHRlbnNpb25fY29udHJvbGxlci5pbml0aWFsaXplXG5cdFx0XHRcdFx0fHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIGV4dGVuc2lvbl9jb250cm9sbGVyLmRlc3Ryb3lcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGV4dGVuc2lvbl9jb250cm9sbGVycy5wdXNoKCBleHRlbnNpb25fY29udHJvbGxlciApO1xuXHRcdFx0XHRleHRlbnNpb25fY29udHJvbGxlci5pbml0aWFsaXplKCk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRGVzdHJveSBldmVyeSBpbml0aWFsaXplZCBkb21haW4gZXh0ZW5zaW9uIGluIHJldmVyc2Ugb3duZXJzaGlwIG9yZGVyLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBkZXN0cm95X2V4dGVuc2lvbnMoKSB7XG5cdFx0XHRleHRlbnNpb25fY29udHJvbGxlcnMuc2xpY2UoKS5yZXZlcnNlKCkuZm9yRWFjaCggZnVuY3Rpb24gKCBleHRlbnNpb25fY29udHJvbGxlciApIHtcblx0XHRcdFx0ZXh0ZW5zaW9uX2NvbnRyb2xsZXIuZGVzdHJveSgpO1xuXHRcdFx0fSApO1xuXHRcdFx0ZXh0ZW5zaW9uX2NvbnRyb2xsZXJzID0gW107XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUG9zaXRpb24gdGhlIGFjdGl2ZSB0aW1lLXNsb3QgbGlzdCBiZXNpZGUgaXRzIGV4aXN0aW5nIG92ZXJmbG93IGJ1dHRvbi5cblx0XHQgKlxuXHRcdCAqIFRoZSBsaXN0IGlzIHRlbXBvcmFyaWx5IHBvcnRhbGVkIHRvIHRoZSBkb2N1bWVudCBib2R5IHNvIHJvdyBhbmQgY2FudmFzXG5cdFx0ICogY2xpcHBpbmcgY2Fubm90IGN1dCBpdCBvZmYuIFNjcm9sbGluZyBvbmx5IHVwZGF0ZXMgZml4ZWQgcG9zaXRpb25pbmc7IGl0XG5cdFx0ICogbmV2ZXIgcmVjb25zdHJ1Y3RzIHRoZSBzZXJ2ZXItb3duZWQgdGVtcGxhdGUuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHBvc2l0aW9uX3RpbWVfc2xvdF9vdmVyZmxvdygpIHtcblx0XHRcdHZhciB0cmlnZ2VyX3JlY3RhbmdsZTtcblx0XHRcdHZhciBwb3BvdmVyX3JlY3RhbmdsZTtcblx0XHRcdHZhciB2aWV3cG9ydF93aWR0aDtcblx0XHRcdHZhciB2aWV3cG9ydF9oZWlnaHQ7XG5cdFx0XHR2YXIgdmlld3BvcnRfbWFyZ2luID0gODtcblx0XHRcdHZhciBsZWZ0O1xuXHRcdFx0dmFyIHRvcDtcblxuXHRcdFx0dGltZV9zbG90X292ZXJmbG93X2ZyYW1lID0gMDtcblx0XHRcdGlmICggISBhY3RpdmVfdGltZV9zbG90X292ZXJmbG93IHx8ICEgYWN0aXZlX3RpbWVfc2xvdF9vdmVyZmxvdy50cmlnZ2VyLmlzQ29ubmVjdGVkICkge1xuXHRcdFx0XHRjbG9zZV90aW1lX3Nsb3Rfb3ZlcmZsb3coIGZhbHNlICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRyaWdnZXJfcmVjdGFuZ2xlID0gYWN0aXZlX3RpbWVfc2xvdF9vdmVyZmxvdy50cmlnZ2VyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0cG9wb3Zlcl9yZWN0YW5nbGUgPSBhY3RpdmVfdGltZV9zbG90X292ZXJmbG93LnBvcG92ZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHR2aWV3cG9ydF93aWR0aCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aDtcblx0XHRcdHZpZXdwb3J0X2hlaWdodCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQ7XG5cdFx0XHRsZWZ0ID0gTWF0aC5taW4oXG5cdFx0XHRcdE1hdGgubWF4KCB2aWV3cG9ydF9tYXJnaW4sIHRyaWdnZXJfcmVjdGFuZ2xlLmxlZnQgKSxcblx0XHRcdFx0TWF0aC5tYXgoIHZpZXdwb3J0X21hcmdpbiwgdmlld3BvcnRfd2lkdGggLSBwb3BvdmVyX3JlY3RhbmdsZS53aWR0aCAtIHZpZXdwb3J0X21hcmdpbiApXG5cdFx0XHQpO1xuXHRcdFx0dG9wID0gdHJpZ2dlcl9yZWN0YW5nbGUuYm90dG9tICsgNjtcblx0XHRcdGlmICggdG9wICsgcG9wb3Zlcl9yZWN0YW5nbGUuaGVpZ2h0ID4gdmlld3BvcnRfaGVpZ2h0IC0gdmlld3BvcnRfbWFyZ2luICkge1xuXHRcdFx0XHR0b3AgPSBNYXRoLm1heCggdmlld3BvcnRfbWFyZ2luLCB0cmlnZ2VyX3JlY3RhbmdsZS50b3AgLSBwb3BvdmVyX3JlY3RhbmdsZS5oZWlnaHQgLSA2ICk7XG5cdFx0XHR9XG5cdFx0XHRhY3RpdmVfdGltZV9zbG90X292ZXJmbG93LnBvcG92ZXIuc3R5bGUubGVmdCA9IE1hdGgucm91bmQoIGxlZnQgKSArICdweCc7XG5cdFx0XHRhY3RpdmVfdGltZV9zbG90X292ZXJmbG93LnBvcG92ZXIuc3R5bGUudG9wID0gTWF0aC5yb3VuZCggdG9wICkgKyAncHgnO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNjaGVkdWxlIG9uZSBnZW9tZXRyeSB1cGRhdGUgZm9yIHRoZSBhY3RpdmUgdGltZS1zbG90IGxpc3QuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNjaGVkdWxlX3RpbWVfc2xvdF9vdmVyZmxvd19wb3NpdGlvbigpIHtcblx0XHRcdGlmICggISBhY3RpdmVfdGltZV9zbG90X292ZXJmbG93IHx8IHRpbWVfc2xvdF9vdmVyZmxvd19mcmFtZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGltZV9zbG90X292ZXJmbG93X2ZyYW1lID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggcG9zaXRpb25fdGltZV9zbG90X292ZXJmbG93ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSGFuZGxlIGRvY3VtZW50IGNsaWNrcyB3aGlsZSBhIHBvcnRhbGVkIHRpbWUtc2xvdCBsaXN0IGlzIG9wZW4uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGV2ZW50IEJyb3dzZXIgY2xpY2sgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfdGltZV9zbG90X292ZXJmbG93X2RvY3VtZW50X2NsaWNrKCBldmVudCApIHtcblx0XHRcdHZhciBjbG9zZV9idXR0b247XG5cdFx0XHR2YXIgYm9va2luZ19pdGVtO1xuXG5cdFx0XHRpZiAoICEgYWN0aXZlX3RpbWVfc2xvdF9vdmVyZmxvdyApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y2xvc2VfYnV0dG9uID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtc2xvdC1jbG9zZV0nICk7XG5cdFx0XHRib29raW5nX2l0ZW0gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtdGltZS1zbG90LWl0ZW1dJyApO1xuXHRcdFx0aWYgKCBjbG9zZV9idXR0b24gJiYgYWN0aXZlX3RpbWVfc2xvdF9vdmVyZmxvdy5wb3BvdmVyLmNvbnRhaW5zKCBjbG9zZV9idXR0b24gKSApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0Y2xvc2VfdGltZV9zbG90X292ZXJmbG93KCB0cnVlICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggYm9va2luZ19pdGVtICYmIGFjdGl2ZV90aW1lX3Nsb3Rfb3ZlcmZsb3cucG9wb3Zlci5jb250YWlucyggYm9va2luZ19pdGVtICkgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGNsb3NlX3RpbWVfc2xvdF9vdmVyZmxvdyggZmFsc2UgKTtcblx0XHRcdFx0aWYgKCBib29raW5nX2luc3BlY3Rvcl9hZGFwdGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBib29raW5nX2luc3BlY3Rvcl9hZGFwdGVyLm9wZW4gKSB7XG5cdFx0XHRcdFx0Ym9va2luZ19pbnNwZWN0b3JfYWRhcHRlci5vcGVuKCBib29raW5nX2l0ZW0gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoXG5cdFx0XHRcdCEgYWN0aXZlX3RpbWVfc2xvdF9vdmVyZmxvdy5wb3BvdmVyLmNvbnRhaW5zKCBldmVudC50YXJnZXQgKVxuXHRcdFx0XHQmJiAhIGFjdGl2ZV90aW1lX3Nsb3Rfb3ZlcmZsb3cudHJpZ2dlci5jb250YWlucyggZXZlbnQudGFyZ2V0IClcblx0XHRcdCkge1xuXHRcdFx0XHRjbG9zZV90aW1lX3Nsb3Rfb3ZlcmZsb3coIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2xvc2UgdGhlIGFjdGl2ZSB0aW1lLXNsb3QgbGlzdCBhbmQgcmVtb3ZlIGV2ZXJ5IHRyYW5zaWVudCBsaXN0ZW5lci5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gcmVzdG9yZV9mb2N1cyBXaGV0aGVyIGZvY3VzIHJldHVybnMgdG8gdGhlIG92ZXJmbG93IGJ1dHRvbi5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNsb3NlX3RpbWVfc2xvdF9vdmVyZmxvdyggcmVzdG9yZV9mb2N1cyApIHtcblx0XHRcdHZhciBvdmVyZmxvd19zdGF0ZSA9IGFjdGl2ZV90aW1lX3Nsb3Rfb3ZlcmZsb3c7XG5cblx0XHRcdGlmICggdGltZV9zbG90X292ZXJmbG93X2ZyYW1lICkge1xuXHRcdFx0XHR3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUoIHRpbWVfc2xvdF9vdmVyZmxvd19mcmFtZSApO1xuXHRcdFx0XHR0aW1lX3Nsb3Rfb3ZlcmZsb3dfZnJhbWUgPSAwO1xuXHRcdFx0fVxuXHRcdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgaGFuZGxlX3RpbWVfc2xvdF9vdmVyZmxvd19kb2N1bWVudF9jbGljayApO1xuXHRcdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCBoYW5kbGVfdGltZV9zbG90X292ZXJmbG93X2tleWRvd24gKTtcblx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdzY3JvbGwnLCBzY2hlZHVsZV90aW1lX3Nsb3Rfb3ZlcmZsb3dfcG9zaXRpb24sIHRydWUgKTtcblx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCAncmVzaXplJywgc2NoZWR1bGVfdGltZV9zbG90X292ZXJmbG93X3Bvc2l0aW9uICk7XG5cdFx0XHRhY3RpdmVfdGltZV9zbG90X292ZXJmbG93ID0gbnVsbDtcblx0XHRcdGlmICggISBvdmVyZmxvd19zdGF0ZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0b3ZlcmZsb3dfc3RhdGUudHJpZ2dlci5zZXRBdHRyaWJ1dGUoICdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyApO1xuXHRcdFx0b3ZlcmZsb3dfc3RhdGUucG9wb3Zlci5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0b3ZlcmZsb3dfc3RhdGUucG9wb3Zlci5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtcG9ydGFsZWQnICk7XG5cdFx0XHRvdmVyZmxvd19zdGF0ZS5wb3BvdmVyLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnbGVmdCcgKTtcblx0XHRcdG92ZXJmbG93X3N0YXRlLnBvcG92ZXIuc3R5bGUucmVtb3ZlUHJvcGVydHkoICd0b3AnICk7XG5cdFx0XHRvdmVyZmxvd19zdGF0ZS53cmFwcGVyLmFwcGVuZENoaWxkKCBvdmVyZmxvd19zdGF0ZS5wb3BvdmVyICk7XG5cdFx0XHRpZiAoIHJlc3RvcmVfZm9jdXMgJiYgb3ZlcmZsb3dfc3RhdGUudHJpZ2dlci5pc0Nvbm5lY3RlZCApIHtcblx0XHRcdFx0b3ZlcmZsb3dfc3RhdGUudHJpZ2dlci5mb2N1cygpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENsb3NlIHRoZSBhY3RpdmUgdGltZS1zbG90IGxpc3Qgd2l0aCBFc2NhcGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0tleWJvYXJkRXZlbnR9IGV2ZW50IEJyb3dzZXIga2V5Ym9hcmQgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfdGltZV9zbG90X292ZXJmbG93X2tleWRvd24oIGV2ZW50ICkge1xuXHRcdFx0aWYgKCAnRXNjYXBlJyAhPT0gZXZlbnQua2V5IHx8ICEgYWN0aXZlX3RpbWVfc2xvdF9vdmVyZmxvdyApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGNsb3NlX3RpbWVfc2xvdF9vdmVyZmxvdyggdHJ1ZSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE9wZW4gb25lIGV4aXN0aW5nIHNlcnZlci1yZW5kZXJlZCB0aW1lLXNsb3Qgb3ZlcmZsb3cgbGlzdC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHRyaWdnZXIgT3ZlcmZsb3cgYnV0dG9uIGluc2lkZSB0aGUgVGltZWxpbmUgcm93LlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBhIGxpc3Qgd2FzIG9wZW5lZCBvciB0b2dnbGVkIGNsb3NlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB0b2dnbGVfdGltZV9zbG90X292ZXJmbG93KCB0cmlnZ2VyICkge1xuXHRcdFx0dmFyIHdyYXBwZXIgPSB0cmlnZ2VyLmNsb3Nlc3QoICdbZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtc2xvdC1vdmVyZmxvd10nICk7XG5cdFx0XHR2YXIgcG9wb3ZlciA9IHdyYXBwZXIgPyB3cmFwcGVyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtc2xvdC1wb3BvdmVyXScgKSA6IG51bGw7XG5cblx0XHRcdGlmICggISB3cmFwcGVyIHx8ICEgcG9wb3ZlciApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBhY3RpdmVfdGltZV9zbG90X292ZXJmbG93ICYmIGFjdGl2ZV90aW1lX3Nsb3Rfb3ZlcmZsb3cudHJpZ2dlciA9PT0gdHJpZ2dlciApIHtcblx0XHRcdFx0Y2xvc2VfdGltZV9zbG90X292ZXJmbG93KCB0cnVlICk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0Y2xvc2VfdGltZV9zbG90X292ZXJmbG93KCBmYWxzZSApO1xuXHRcdFx0YWN0aXZlX3RpbWVfc2xvdF9vdmVyZmxvdyA9IHtcblx0XHRcdFx0d3JhcHBlcjogd3JhcHBlcixcblx0XHRcdFx0dHJpZ2dlcjogdHJpZ2dlcixcblx0XHRcdFx0cG9wb3ZlcjogcG9wb3ZlclxuXHRcdFx0fTtcblx0XHRcdHRyaWdnZXIuc2V0QXR0cmlidXRlKCAnYXJpYS1leHBhbmRlZCcsICd0cnVlJyApO1xuXHRcdFx0cG9wb3Zlci5oaWRkZW4gPSBmYWxzZTtcblx0XHRcdHBvcG92ZXIuY2xhc3NMaXN0LmFkZCggJ2lzLXBvcnRhbGVkJyApO1xuXHRcdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggcG9wb3ZlciApO1xuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgaGFuZGxlX3RpbWVfc2xvdF9vdmVyZmxvd19kb2N1bWVudF9jbGljayApO1xuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCBoYW5kbGVfdGltZV9zbG90X292ZXJmbG93X2tleWRvd24gKTtcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdzY3JvbGwnLCBzY2hlZHVsZV90aW1lX3Nsb3Rfb3ZlcmZsb3dfcG9zaXRpb24sIHRydWUgKTtcblx0XHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAncmVzaXplJywgc2NoZWR1bGVfdGltZV9zbG90X292ZXJmbG93X3Bvc2l0aW9uLCB7IHBhc3NpdmU6IHRydWUgfSApO1xuXHRcdFx0c2NoZWR1bGVfdGltZV9zbG90X292ZXJmbG93X3Bvc2l0aW9uKCk7XG5cdFx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHZhciBmaXJzdF9pdGVtID0gYWN0aXZlX3RpbWVfc2xvdF9vdmVyZmxvdyAmJiBhY3RpdmVfdGltZV9zbG90X292ZXJmbG93LnBvcG92ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtdGltZS1zbG90LWl0ZW1dJyApO1xuXG5cdFx0XHRcdGlmICggZmlyc3RfaXRlbSApIHtcblx0XHRcdFx0XHRmaXJzdF9pdGVtLmZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ3JlYXRlIHRoZSBlbXB0eSBzZWxlY3RlZC1ib29raW5nIHN0YXRlIGZvciB0aGlzIFRpbWVsaW5lIHBhZ2UuXG5cdFx0ICpcblx0XHQgKiBDYW5vbmljYWwgYm9va2luZyBpZGVudGl0eSBpcyBpbmRlcGVuZGVudCBmcm9tIGEgcmVuZGVyZWQgc2VnbWVudC4gVGhlXG5cdFx0ICogc2VnbWVudCBoaW50IGlzIHJldGFpbmVkIG9ubHkgZm9yIGZvY3VzIGFuZCBnZW9tZXRyeSByZWNvbmNpbGlhdGlvbiB3aGVuXG5cdFx0ICogb25lIGJvb2tpbmcgaXMgcmVwcmVzZW50ZWQgYnkgc2V2ZXJhbCB2aXNpYmxlIGNhcmRzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBFbXB0eSBib29raW5nIHNlbGVjdGlvbiBzdGF0ZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjcmVhdGVfZW1wdHlfYm9va2luZ19zZWxlY3Rpb25fc3RhdGUoKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRib29raW5nX2lkOiAwLFxuXHRcdFx0XHRzZWdtZW50X2hpbnQ6ICcnXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlcG9ydCB3aGV0aGVyIHRoZSBUaW1lbGluZSBob3N0IGNhbiBzdGlsbCBhY2NlcHQgYXN5bmNocm9ub3VzIHdvcmsuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoaWxlIHRoZSBwYWdlIGNvbnRyb2xsZXIgcmVtYWlucyBhY3RpdmUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaXNfaG9zdF9hY3RpdmUoKSB7XG5cdFx0XHRyZXR1cm4gaXNfaW5pdGlhbGl6ZWQgJiYgKCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgY29udGV4dC5pc19ob3N0X2FjdGl2ZSB8fCBjb250ZXh0LmlzX2hvc3RfYWN0aXZlKCkgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gb25lIHJlbmRlcmVkIHNlZ21lbnQncyBjYW5vbmljYWwgYm9va2luZyBhbmQgcHJlc2VudGF0aW9uIGlkZW50aXR5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSBzZWdtZW50IFJlbmRlcmVkIGJvb2tpbmcgY2FyZCBvciBzZWxlY3Rpb24gY29udHJvbC5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IFBvc2l0aXZlIGJvb2tpbmcgSUQgYW5kIHN0YWJsZSBzZWdtZW50IGhpbnQgd2hlbiB2YWxpZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfYm9va2luZ19zZWdtZW50X2lkZW50aXR5KCBzZWdtZW50ICkge1xuXHRcdFx0dmFyIGNhcmQgPSBzZWdtZW50ICYmIHNlZ21lbnQuY2xvc2VzdCA/IHNlZ21lbnQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtc2VnbWVudC1pZF0nICkgOiBudWxsO1xuXG5cdFx0XHRpZiAoICEgY2FyZCB8fCAhIGNhcmQuZ2V0QXR0cmlidXRlICkge1xuXHRcdFx0XHRyZXR1cm4gY3JlYXRlX2VtcHR5X2Jvb2tpbmdfc2VsZWN0aW9uX3N0YXRlKCk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGJvb2tpbmdfaWQ6IE1hdGgubWF4KCAwLCBNYXRoLnJvdW5kKCBOdW1iZXIoIGNhcmQuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLWJvb2tpbmctaWQnICkgKSB8fCAwICkgKSxcblx0XHRcdFx0c2VnbWVudF9oaW50OiBTdHJpbmcoIGNhcmQuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXNlZ21lbnQtaWQnICkgfHwgJycgKVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBcHBseSBzZWxlY3RlZC1ib29raW5nIHN0YXRlIHRvIGV2ZXJ5IGN1cnJlbnQgc2VnbWVudCBvZiB0aGF0IGJvb2tpbmcuXG5cdFx0ICpcblx0XHQgKiBJbnNwZWN0b3Igb3BlbiBzdGF0ZSBkZWxpYmVyYXRlbHkgcmVtYWlucyBvbiBgaXMtYm9va2luZy1kZXRhaWxzLW9wZW5gLlxuXHRcdCAqIFNlbGVjdGlvbiB1c2VzIGl0cyBvd24gY2xhc3MgYW5kIHByZXNzZWQgc3RhdGUgc28gbmVpdGhlciBJbnNwZWN0b3Igbm9yXG5cdFx0ICogQm9va2luZyBPdmVydmlldyBBUklBIGJlY29tZXMgaXRzIGF1dGhvcml0eS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3luY2hyb25pemVfYm9va2luZ19zZWxlY3Rpb24oKSB7XG5cdFx0XHR2YXIgZmFsbGJhY2tfc2VnbWVudF9oaW50ID0gJyc7XG5cdFx0XHR2YXIgaGFzX3NlZ21lbnRfaGludCA9IGZhbHNlO1xuXG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBtb3VudC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLXNlbGVjdF0nICksIGZ1bmN0aW9uICggc2VsZWN0aW9uX2NvbnRyb2wgKSB7XG5cdFx0XHRcdHZhciBjYXJkID0gc2VsZWN0aW9uX2NvbnRyb2wuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtc2VnbWVudC1pZF0nICk7XG5cdFx0XHRcdHZhciBpZGVudGl0eSA9IGdldF9ib29raW5nX3NlZ21lbnRfaWRlbnRpdHkoIHNlbGVjdGlvbl9jb250cm9sICk7XG5cdFx0XHRcdHZhciBpc19zZWxlY3RlZCA9IEJvb2xlYW4oIGJvb2tpbmdfc2VsZWN0aW9uX3N0YXRlLmJvb2tpbmdfaWQgJiYgaWRlbnRpdHkuYm9va2luZ19pZCA9PT0gYm9va2luZ19zZWxlY3Rpb25fc3RhdGUuYm9va2luZ19pZCApO1xuXG5cdFx0XHRcdGlmICggY2FyZCApIHtcblx0XHRcdFx0XHRjYXJkLmNsYXNzTGlzdC50b2dnbGUoICdpcy1ib29raW5nLXNlbGVjdGVkJywgaXNfc2VsZWN0ZWQgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWxlY3Rpb25fY29udHJvbC5zZXRBdHRyaWJ1dGUoICdhcmlhLXByZXNzZWQnLCBpc19zZWxlY3RlZCA/ICd0cnVlJyA6ICdmYWxzZScgKTtcblx0XHRcdFx0aWYgKCBpc19zZWxlY3RlZCAmJiAhIGZhbGxiYWNrX3NlZ21lbnRfaGludCApIHtcblx0XHRcdFx0XHRmYWxsYmFja19zZWdtZW50X2hpbnQgPSBpZGVudGl0eS5zZWdtZW50X2hpbnQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBpc19zZWxlY3RlZCAmJiBpZGVudGl0eS5zZWdtZW50X2hpbnQgPT09IGJvb2tpbmdfc2VsZWN0aW9uX3N0YXRlLnNlZ21lbnRfaGludCApIHtcblx0XHRcdFx0XHRoYXNfc2VnbWVudF9oaW50ID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCggbW91bnQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1jb250cm9sLXJhaWxdJyApLCBmdW5jdGlvbiAoIHJhaWwgKSB7XG5cdFx0XHRcdHZhciByYWlsX2Jvb2tpbmdfaWQgPSBNYXRoLm1heCggMCwgTWF0aC5yb3VuZCggTnVtYmVyKCByYWlsLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLWlkJyApICkgfHwgMCApICk7XG5cdFx0XHRcdHZhciBpc19zZWxlY3RlZCA9IEJvb2xlYW4oIGJvb2tpbmdfc2VsZWN0aW9uX3N0YXRlLmJvb2tpbmdfaWQgJiYgcmFpbF9ib29raW5nX2lkID09PSBib29raW5nX3NlbGVjdGlvbl9zdGF0ZS5ib29raW5nX2lkICk7XG5cdFx0XHRcdHZhciBkZXRhaWxzX2FjdGlvbiA9IHJhaWwucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1kZXRhaWxzLWFjdGlvbl0nICk7XG5cblx0XHRcdFx0cmFpbC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtYm9va2luZy1zZWxlY3RlZCcsIGlzX3NlbGVjdGVkICk7XG5cdFx0XHRcdGlmICggZGV0YWlsc19hY3Rpb24gKSB7XG5cdFx0XHRcdFx0ZGV0YWlsc19hY3Rpb24uaGlkZGVuID0gISBpc19zZWxlY3RlZDtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0XHRpZiAoIGJvb2tpbmdfc2VsZWN0aW9uX3N0YXRlLmJvb2tpbmdfaWQgJiYgZmFsbGJhY2tfc2VnbWVudF9oaW50ICYmICEgaGFzX3NlZ21lbnRfaGludCApIHtcblx0XHRcdFx0Ym9va2luZ19zZWxlY3Rpb25fc3RhdGUuc2VnbWVudF9oaW50ID0gZmFsbGJhY2tfc2VnbWVudF9oaW50O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENsb3NlIGNsaXBwZWQtdGV4dCBob3ZlciBhaWRzIG93bmVkIGJ5IG9uZSBzZWxlY3RlZCBib29raW5nIGNhcmQuXG5cdFx0ICpcblx0XHQgKiBTZWxlY3Rpb24gbW92ZXMgZm9jdXMgdG8gdGhlIGJvb2tpbmcgY29udHJvbCBmb3IgaXRzIG93biBhY2Nlc3NpYmxlIGFjdGlvbi5cblx0XHQgKiBUaGUgY29udHJvbCdzIGFjY2Vzc2libGUgbmFtZSBhbHJlYWR5IGNvbnRhaW5zIHRoZSBjb21wbGV0ZSBib29raW5nIGxhYmVsXG5cdFx0ICogYW5kIHNjaGVkdWxlLCBzbyBwcmV2aW91c2x5IG9wZW5lZCBwb2ludGVyIHRvb2x0aXBzIG11c3Qgbm90IHJlbWFpbiBvdmVyIHRoZVxuXHRcdCAqIHNlbGVjdGVkIGNhcmQgb3IgcmVvcGVuIG1lcmVseSBiZWNhdXNlIHRoYXQgY29udHJvbCByZXRhaW5zIGZvY3VzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSBzZWdtZW50IFJlbmRlcmVkIGJvb2tpbmcgY2FyZCBvciBjaGlsZCBjb250cm9sLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZGlzbWlzc19ib29raW5nX292ZXJmbG93X3Rvb2x0aXBzKCBzZWdtZW50ICkge1xuXHRcdFx0dmFyIGNhcmQgPSBzZWdtZW50ICYmIHNlZ21lbnQuY2xvc2VzdCA/IHNlZ21lbnQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtc2VnbWVudC1pZF0nICkgOiBudWxsO1xuXHRcdFx0dmFyIHRvb2x0aXBfb3duZXJzID0gY2FyZCAmJiBjYXJkLnF1ZXJ5U2VsZWN0b3JBbGxcblx0XHRcdFx0PyBjYXJkLnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctb3ZlcmZsb3ctdG9vbHRpcC1mb2N1cz1cInBvaW50ZXItb25seVwiXScgKVxuXHRcdFx0XHQ6IFtdO1xuXG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCB0b29sdGlwX293bmVycywgZnVuY3Rpb24gKCB0b29sdGlwX293bmVyICkge1xuXHRcdFx0XHRpZiAoIHRvb2x0aXBfb3duZXIuX3RpcHB5ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB0b29sdGlwX293bmVyLl90aXBweS5oaWRlICkge1xuXHRcdFx0XHRcdHRvb2x0aXBfb3duZXIuX3RpcHB5LmhpZGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEhpZGUgYW5kIGRpc2FibGUgdGhlIGFjdGl2ZSBjYXJkJ3MgcG9pbnRlci1vbmx5IG92ZXJmbG93IHRvb2x0aXBzLlxuXHRcdCAqXG5cdFx0ICogUG9pbnRlciBjYXB0dXJlIGNhbiBvdGhlcndpc2UgbGVhdmUgdGhlIGhvdmVyIHRvb2x0aXAgZmxpcHBpbmcgYWJvdmUgYVxuXHRcdCAqIG1vdmluZyBnaG9zdC4gVGhlIGV4YWN0IGNhcmQtb3duZWQgVGlwcHkgaW5zdGFuY2VzIGFyZSByZXRhaW5lZCBhbmRcblx0XHQgKiByZS1lbmFibGVkIG9uY2UgYnkgcmVzaXplIHRlYXJkb3duOyBubyBnbG9iYWwgdG9vbHRpcCBzY2FuIGlzIHJlcXVpcmVkLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSBjYXJkIEV4YWN0IGdlc3R1cmUtYW5jaG9yIGNhcmQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzdXNwZW5kX2Jvb2tpbmdfb3ZlcmZsb3dfdG9vbHRpcHMoIGNhcmQgKSB7XG5cdFx0XHR2YXIgdG9vbHRpcF9vd25lcnMgPSBjYXJkICYmIGNhcmQucXVlcnlTZWxlY3RvckFsbFxuXHRcdFx0XHQ/IGNhcmQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1vdmVyZmxvdy10b29sdGlwLWZvY3VzPVwicG9pbnRlci1vbmx5XCJdJyApXG5cdFx0XHRcdDogW107XG5cblx0XHRcdHN1c3BlbmRlZF9ib29raW5nX292ZXJmbG93X3Rvb2x0aXBzID0gW107XG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCB0b29sdGlwX293bmVycywgZnVuY3Rpb24gKCB0b29sdGlwX293bmVyICkge1xuXHRcdFx0XHRpZiAoICEgdG9vbHRpcF9vd25lci5fdGlwcHkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHRvb2x0aXBfb3duZXIuX3RpcHB5LmhpZGUgKSB7XG5cdFx0XHRcdFx0dG9vbHRpcF9vd25lci5fdGlwcHkuaGlkZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHRvb2x0aXBfb3duZXIuX3RpcHB5LmRpc2FibGUgKSB7XG5cdFx0XHRcdFx0dG9vbHRpcF9vd25lci5fdGlwcHkuZGlzYWJsZSgpO1xuXHRcdFx0XHRcdHN1c3BlbmRlZF9ib29raW5nX292ZXJmbG93X3Rvb2x0aXBzLnB1c2goIHRvb2x0aXBfb3duZXIuX3RpcHB5ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZS1lbmFibGUgdGhlIGNhcmQtb3duZWQgdG9vbHRpcHMgZGlzYWJsZWQgZm9yIHBvaW50ZXIgcmVzaXppbmcuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlc3VtZV9ib29raW5nX292ZXJmbG93X3Rvb2x0aXBzKCkge1xuXHRcdFx0Zm9yICggdmFyIHRvb2x0aXBfaW5kZXggPSAwOyB0b29sdGlwX2luZGV4IDwgc3VzcGVuZGVkX2Jvb2tpbmdfb3ZlcmZsb3dfdG9vbHRpcHMubGVuZ3RoOyB0b29sdGlwX2luZGV4KysgKSB7XG5cdFx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHN1c3BlbmRlZF9ib29raW5nX292ZXJmbG93X3Rvb2x0aXBzWyB0b29sdGlwX2luZGV4IF0uZW5hYmxlICkge1xuXHRcdFx0XHRcdHN1c3BlbmRlZF9ib29raW5nX292ZXJmbG93X3Rvb2x0aXBzWyB0b29sdGlwX2luZGV4IF0uZW5hYmxlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHN1c3BlbmRlZF9ib29raW5nX292ZXJmbG93X3Rvb2x0aXBzID0gW107XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU2VsZWN0IG9uZSBjYW5vbmljYWwgYm9va2luZyB3aXRob3V0IG9wZW5pbmcgT3ZlcnZpZXcgb3IgSW5zcGVjdG9yLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gc2VnbWVudCBSZW5kZXJlZCBUaW1lbGluZSBib29raW5nIHNlZ21lbnQuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGEgdmFsaWQgYm9va2luZyB3YXMgc2VsZWN0ZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2VsZWN0X2Jvb2tpbmdfc2VnbWVudCggc2VnbWVudCApIHtcblx0XHRcdHZhciBpZGVudGl0eSA9IGdldF9ib29raW5nX3NlZ21lbnRfaWRlbnRpdHkoIHNlZ21lbnQgKTtcblxuXHRcdFx0aWYgKCAhIGlkZW50aXR5LmJvb2tpbmdfaWQgfHwgISBpZGVudGl0eS5zZWdtZW50X2hpbnQgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGRpc21pc3NfYm9va2luZ19vdmVyZmxvd190b29sdGlwcyggc2VnbWVudCApO1xuXHRcdFx0Ym9va2luZ19zZWxlY3Rpb25fc3RhdGUgPSBpZGVudGl0eTtcblx0XHRcdHN5bmNocm9uaXplX2Jvb2tpbmdfc2VsZWN0aW9uKCk7XG5cdFx0XHRzY2hlZHVsZV9ib29raW5nX2NvbnRyb2xfcmFpbF9sYXlvdXQoKTtcblx0XHRcdGlmICggYm9va2luZ19yZXNpemluZ19jb250cm9sbGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBib29raW5nX3Jlc2l6aW5nX2NvbnRyb2xsZXIuc2VsZWN0ICkge1xuXHRcdFx0XHRib29raW5nX3Jlc2l6aW5nX2NvbnRyb2xsZXIuc2VsZWN0KCBzZWdtZW50ICk7XG5cdFx0XHR9XG5cdFx0XHRpbnZva2VfZXh0ZW5zaW9uX21ldGhvZCggJ3NlbGVjdF9zZWdtZW50JywgWyBzZWdtZW50LCBib29raW5nX3NlbGVjdGlvbl9zdGF0ZSBdICk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFByZXNlcnZlIGEgbmV3bHkgY3JlYXRlZCBib29raW5nIGlkZW50aXR5IGFjcm9zcyB0aGUgaG9zdC1vd25lZCByZXJlbmRlci5cblx0XHQgKlxuXHRcdCAqIFRoZSBjYXJkIGRvZXMgbm90IGV4aXN0IHlldCwgc28gb25seSB0aGUgYXV0aG9yaXRhdGl2ZSBwb3NpdGl2ZSBib29raW5nIElEXG5cdFx0ICogaXMgcmV0YWluZWQuIE5vcm1hbCByZWZyZXNoIHJlY29uY2lsaWF0aW9uIHN1cHBsaWVzIGEgY3VycmVudCBzZWdtZW50IGhpbnQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gYm9va2luZ19pZCBBdXRob3JpdGF0aXZlIGNyZWF0ZWQgYm9va2luZyBJRC5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGlkZW50aXR5IHdhcyBhY2NlcHRlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBwcmVwYXJlX2NyZWF0ZWRfYm9va2luZ19yZWFkYmFjayggYm9va2luZ19pZCApIHtcblx0XHRcdGJvb2tpbmdfaWQgPSBNYXRoLm1heCggMCwgTWF0aC5yb3VuZCggTnVtYmVyKCBib29raW5nX2lkICkgfHwgMCApICk7XG5cdFx0XHRpZiAoICEgYm9va2luZ19pZCApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0Ym9va2luZ19zZWxlY3Rpb25fc3RhdGUgPSB7XG5cdFx0XHRcdGJvb2tpbmdfaWQ6IGJvb2tpbmdfaWQsXG5cdFx0XHRcdHNlZ21lbnRfaGludDogJydcblx0XHRcdH07XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNlbGVjdCBhbmQgaGlnaGxpZ2h0IHRoZSBhdXRob3JpdGF0aXZlIGNyZWF0ZWQgYm9va2luZyBhZnRlciBUaW1lbGluZSByZWFkYmFjay5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBib29raW5nX2lkIEF1dGhvcml0YXRpdmUgY3JlYXRlZCBib29raW5nIElELlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgYm9va2luZyBpcyB2aXNpYmxlIGluIHRoZSBjdXJyZW50IFJlc291cmNlIHZpZXcuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY29tcGxldGVfY3JlYXRlZF9ib29raW5nX3JlYWRiYWNrKCBib29raW5nX2lkICkge1xuXHRcdFx0dmFyIGNhcmQ7XG5cdFx0XHR2YXIgc2VsZWN0aW9uX2NvbnRyb2w7XG5cblx0XHRcdGJvb2tpbmdfaWQgPSBNYXRoLm1heCggMCwgTWF0aC5yb3VuZCggTnVtYmVyKCBib29raW5nX2lkICkgfHwgMCApICk7XG5cdFx0XHRpZiAoICEgYm9va2luZ19pZCApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0Y2FyZCA9IG1vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLWJvb2tpbmctaWQ9XCInICsgU3RyaW5nKCBib29raW5nX2lkICkgKyAnXCJdW2RhdGEtd3BiYy10aW1lbGluZS1zZWdtZW50LWlkXScgKTtcblx0XHRcdHNlbGVjdGlvbl9jb250cm9sID0gY2FyZCA/IGNhcmQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1zZWxlY3RdJyApIDogbnVsbDtcblx0XHRcdGlmICggISBjYXJkIHx8ICEgc2VsZWN0aW9uX2NvbnRyb2wgKSB7XG5cdFx0XHRcdGJvb2tpbmdfc2VsZWN0aW9uX3N0YXRlID0ge1xuXHRcdFx0XHRcdGJvb2tpbmdfaWQ6IGJvb2tpbmdfaWQsXG5cdFx0XHRcdFx0c2VnbWVudF9oaW50OiAnJ1xuXHRcdFx0XHR9O1xuXHRcdFx0XHRzeW5jaHJvbml6ZV9ib29raW5nX3NlbGVjdGlvbigpO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRzZWxlY3RfYm9va2luZ19zZWdtZW50KCBzZWxlY3Rpb25fY29udHJvbCApO1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBPcGVuIHRoZSBleGlzdGluZyByZWFkLW9ubHkgQm9va2luZyBJbnNwZWN0b3IgZm9yIG9uZSB2aXNpYmxlIGNyZWF0ZWQgY2FyZC5cblx0XHQgKlxuXHRcdCAqIFRoaXMgb3B0aW9uYWwgcHJlc2VudGF0aW9uIGhhbmRvZmYgcnVucyBvbmx5IGFmdGVyIHRoZSBjcmVhdGlvbiBJbnNwZWN0b3Jcblx0XHQgKiByZWNlaXZlcyBhbiBhY2NlcHRlZCBob3N0IHJlYWRiYWNrIGFuZCBjbG9zZXMgaXRzIG93biBzaGFyZWQgc2hlbGwuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gYm9va2luZ19pZCBBdXRob3JpdGF0aXZlIGNyZWF0ZWQgYm9va2luZyBJRC5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIHJlYWQtb25seSBJbnNwZWN0b3IgYWNjZXB0ZWQgdGhlIGNhcmQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gb3Blbl9jcmVhdGVkX2Jvb2tpbmdfaW5zcGVjdG9yKCBib29raW5nX2lkICkge1xuXHRcdFx0dmFyIGNhcmQ7XG5cblx0XHRcdGJvb2tpbmdfaWQgPSBNYXRoLm1heCggMCwgTWF0aC5yb3VuZCggTnVtYmVyKCBib29raW5nX2lkICkgfHwgMCApICk7XG5cdFx0XHRjYXJkID0gYm9va2luZ19pZFxuXHRcdFx0XHQ/IG1vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLWJvb2tpbmctaWQ9XCInICsgU3RyaW5nKCBib29raW5nX2lkICkgKyAnXCJdW2RhdGEtd3BiYy10aW1lbGluZS1zZWdtZW50LWlkXScgKVxuXHRcdFx0XHQ6IG51bGw7XG5cdFx0XHRpZiAoICEgY2FyZCB8fCAhIGJvb2tpbmdfaW5zcGVjdG9yX2FkYXB0ZXIgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIGJvb2tpbmdfaW5zcGVjdG9yX2FkYXB0ZXIub3BlbiApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0Ym9va2luZ19pbnNwZWN0b3JfYWRhcHRlci5vcGVuKCBjYXJkICk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEZvY3VzIHRoZSBzZWxlY3RlZCBjb250cm9sIGZvciBvbmUgYXV0aG9yaXRhdGl2ZSBjcmVhdGVkIGJvb2tpbmcuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gYm9va2luZ19pZCBBdXRob3JpdGF0aXZlIGNyZWF0ZWQgYm9va2luZyBJRC5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIHZpc2libGUgYm9va2luZyBjb250cm9sIHJlY2VpdmVkIGZvY3VzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGZvY3VzX2NyZWF0ZWRfYm9va2luZyggYm9va2luZ19pZCApIHtcblx0XHRcdHZhciBjYXJkO1xuXHRcdFx0dmFyIHNlbGVjdGlvbl9jb250cm9sO1xuXG5cdFx0XHRib29raW5nX2lkID0gTWF0aC5tYXgoIDAsIE1hdGgucm91bmQoIE51bWJlciggYm9va2luZ19pZCApIHx8IDAgKSApO1xuXHRcdFx0Y2FyZCA9IGJvb2tpbmdfaWRcblx0XHRcdFx0PyBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLWlkPVwiJyArIFN0cmluZyggYm9va2luZ19pZCApICsgJ1wiXVtkYXRhLXdwYmMtdGltZWxpbmUtc2VnbWVudC1pZF0nIClcblx0XHRcdFx0OiBudWxsO1xuXHRcdFx0c2VsZWN0aW9uX2NvbnRyb2wgPSBjYXJkID8gY2FyZC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLXNlbGVjdF0nICkgOiBudWxsO1xuXHRcdFx0aWYgKCAhIHNlbGVjdGlvbl9jb250cm9sIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBzZWxlY3Rpb25fY29udHJvbC5mb2N1cyApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0c2VsZWN0aW9uX2NvbnRyb2wuZm9jdXMoKTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogV3JpdGUgb25lIGlubGluZSBzdHlsZSBvbmx5IHdoZW4gaXRzIHNlcmlhbGl6ZWQgdmFsdWUgY2hhbmdlZC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsZW1lbnQgRWxlbWVudCByZWNlaXZpbmcgdGhlIHN0eWxlLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wZXJ0eV9uYW1lIENTUyBwcm9wZXJ0eSBvciBjdXN0b20tcHJvcGVydHkgbmFtZS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcHJvcGVydHlfdmFsdWUgU2VyaWFsaXplZCBDU1MgdmFsdWUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfY2hhbmdlZF9zdHlsZV9wcm9wZXJ0eSggZWxlbWVudCwgcHJvcGVydHlfbmFtZSwgcHJvcGVydHlfdmFsdWUgKSB7XG5cdFx0XHRpZiAoIGVsZW1lbnQuc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSggcHJvcGVydHlfbmFtZSApICE9PSBwcm9wZXJ0eV92YWx1ZSApIHtcblx0XHRcdFx0ZWxlbWVudC5zdHlsZS5zZXRQcm9wZXJ0eSggcHJvcGVydHlfbmFtZSwgcHJvcGVydHlfdmFsdWUgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXNvbHZlIHRoZSBjYW5vbmljYWwgY2FyZCBmb3IgYW4gaW4tY2FyZCBvciByb3ctb3ZlcmxheSBhY2Nlc3NvcnkuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fG51bGx9IGFjY2Vzc29yeSBBY2Nlc3NvcnkgcmFpbCwgZG9jaywgb3IgY2hpbGQgY29udHJvbC5cblx0XHQgKiBAcGFyYW0ge01hcHxudWxsfSBjYXJkX2J5X3NlZ21lbnRfaWQgT3B0aW9uYWwgZnJhbWUtbG9jYWwgY2FyZCBsb29rdXAuXG5cdFx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR8bnVsbH0gQ2Fub25pY2FsIHJlbmRlcmVkIGJvb2tpbmcgY2FyZCwgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfYm9va2luZ19hY2Nlc3NvcnlfY2FyZCggYWNjZXNzb3J5LCBjYXJkX2J5X3NlZ21lbnRfaWQgKSB7XG5cdFx0XHR2YXIgY2FyZCA9IGFjY2Vzc29yeSAmJiBhY2Nlc3NvcnkuY2xvc2VzdCA/IGFjY2Vzc29yeS5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1zZWdtZW50LWlkXScgKSA6IG51bGw7XG5cdFx0XHR2YXIgcmFpbDtcblx0XHRcdHZhciBzZWdtZW50X2hpbnQ7XG5cdFx0XHR2YXIgY2FyZHM7XG5cblx0XHRcdGlmICggY2FyZCApIHtcblx0XHRcdFx0cmV0dXJuIGNhcmQ7XG5cdFx0XHR9XG5cdFx0XHRyYWlsID0gYWNjZXNzb3J5ICYmIGFjY2Vzc29yeS5jbG9zZXN0ID8gYWNjZXNzb3J5LmNsb3Nlc3QoICdbZGF0YS13cGJjLXRpbWVsaW5lLWJvb2tpbmctY29udHJvbC1yYWlsXScgKSA6IG51bGw7XG5cdFx0XHRzZWdtZW50X2hpbnQgPSByYWlsID8gU3RyaW5nKCByYWlsLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1hY2Nlc3Nvcnktc2VnbWVudC1pZCcgKSB8fCAnJyApIDogJyc7XG5cdFx0XHRpZiAoICEgc2VnbWVudF9oaW50ICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGlmICggY2FyZF9ieV9zZWdtZW50X2lkICYmIGNhcmRfYnlfc2VnbWVudF9pZC5oYXMoIHNlZ21lbnRfaGludCApICkge1xuXHRcdFx0XHRyZXR1cm4gY2FyZF9ieV9zZWdtZW50X2lkLmdldCggc2VnbWVudF9oaW50ICk7XG5cdFx0XHR9XG5cdFx0XHRjYXJkcyA9IG1vdW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXRpbWVsaW5lLXNlZ21lbnQtaWRdJyApO1xuXHRcdFx0QXJyYXkucHJvdG90eXBlLnNvbWUuY2FsbCggY2FyZHMsIGZ1bmN0aW9uICggY2FuZGlkYXRlICkge1xuXHRcdFx0XHRpZiAoIHNlZ21lbnRfaGludCA9PT0gU3RyaW5nKCBjYW5kaWRhdGUuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXNlZ21lbnQtaWQnICkgfHwgJycgKSApIHtcblx0XHRcdFx0XHRjYXJkID0gY2FuZGlkYXRlO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIGNhcmQ7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBwaHlzaWNhbGx5IHZpc2libGUgdGltZS1jYW52YXMgcmVjdGFuZ2xlLlxuXHRcdCAqXG5cdFx0ICogQm91bmRpbmcgcmVjdGFuZ2xlcyBhdm9pZCBicm93c2VyLXNwZWNpZmljIFJUTCBzY3JvbGxMZWZ0IG1vZGVscyBhbmQga2VlcFxuXHRcdCAqIGNvbnRyb2xzIG91dHNpZGUgdGhlIGZyb3plbiBSZXNvdXJjZSBjb2x1bW4uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjYW52YXMgVGltZWxpbmUgaG9yaXpvbnRhbCBzY3JvbGwgY29udGFpbmVyLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gUGh5c2ljYWwgbGVmdC9yaWdodC90b3AvYm90dG9tIGNhbnZhcyBib3VuZGFyaWVzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF92aXNpYmxlX3RpbWVfY2FudmFzX3JlY3RhbmdsZSggY2FudmFzICkge1xuXHRcdFx0dmFyIGNhbnZhc19yZWN0YW5nbGUgPSBjYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHR2YXIgcmVzb3VyY2VfY29sdW1uID0gbW91bnQucXVlcnlTZWxlY3RvciggJy53cGJjX3RpbWVsaW5lX19yZXNvdXJjZXMnICk7XG5cdFx0XHR2YXIgcmVzb3VyY2VfcmVjdGFuZ2xlID0gcmVzb3VyY2VfY29sdW1uID8gcmVzb3VyY2VfY29sdW1uLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpIDogbnVsbDtcblx0XHRcdHZhciB2aXN1YWxfdmlld3BvcnQgPSB3aW5kb3cudmlzdWFsVmlld3BvcnQgfHwgbnVsbDtcblx0XHRcdHZhciB2aWV3cG9ydF9sZWZ0ID0gdmlzdWFsX3ZpZXdwb3J0ID8gTWF0aC5tYXgoIDAsIE51bWJlciggdmlzdWFsX3ZpZXdwb3J0Lm9mZnNldExlZnQgKSB8fCAwICkgOiAwO1xuXHRcdFx0dmFyIHZpZXdwb3J0X3dpZHRoID0gdmlzdWFsX3ZpZXdwb3J0XG5cdFx0XHRcdD8gTWF0aC5tYXgoIDAsIE51bWJlciggdmlzdWFsX3ZpZXdwb3J0LndpZHRoICkgfHwgMCApXG5cdFx0XHRcdDogTWF0aC5tYXgoIDAsIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aCB8fCB3aW5kb3cuaW5uZXJXaWR0aCB8fCAwICk7XG5cdFx0XHR2YXIgdmlld3BvcnRfcmlnaHQgPSB2aWV3cG9ydF93aWR0aCA/IHZpZXdwb3J0X2xlZnQgKyB2aWV3cG9ydF93aWR0aCA6IGNhbnZhc19yZWN0YW5nbGUucmlnaHQ7XG5cdFx0XHR2YXIgdmlzaWJsZV9sZWZ0ID0gTWF0aC5tYXgoIHZpZXdwb3J0X2xlZnQsIGNhbnZhc19yZWN0YW5nbGUubGVmdCApO1xuXHRcdFx0dmFyIHZpc2libGVfcmlnaHQgPSBNYXRoLm1pbiggdmlld3BvcnRfcmlnaHQsIGNhbnZhc19yZWN0YW5nbGUucmlnaHQgKTtcblxuXHRcdFx0aWYgKCByZXNvdXJjZV9yZWN0YW5nbGUgJiYgcmVzb3VyY2VfcmVjdGFuZ2xlLnJpZ2h0ID4gdmlzaWJsZV9sZWZ0ICYmIHJlc291cmNlX3JlY3RhbmdsZS5sZWZ0IDw9IHZpc2libGVfbGVmdCApIHtcblx0XHRcdFx0dmlzaWJsZV9sZWZ0ID0gTWF0aC5tYXgoIHZpc2libGVfbGVmdCwgcmVzb3VyY2VfcmVjdGFuZ2xlLnJpZ2h0ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHJlc291cmNlX3JlY3RhbmdsZSAmJiByZXNvdXJjZV9yZWN0YW5nbGUubGVmdCA8IHZpc2libGVfcmlnaHQgJiYgcmVzb3VyY2VfcmVjdGFuZ2xlLnJpZ2h0ID49IHZpc2libGVfcmlnaHQgKSB7XG5cdFx0XHRcdHZpc2libGVfcmlnaHQgPSBNYXRoLm1pbiggdmlzaWJsZV9yaWdodCwgcmVzb3VyY2VfcmVjdGFuZ2xlLmxlZnQgKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0bGVmdDogdmlzaWJsZV9sZWZ0LFxuXHRcdFx0XHRyaWdodDogTWF0aC5tYXgoIHZpc2libGVfbGVmdCwgdmlzaWJsZV9yaWdodCApLFxuXHRcdFx0XHR0b3A6IGNhbnZhc19yZWN0YW5nbGUudG9wLFxuXHRcdFx0XHRib3R0b206IGNhbnZhc19yZWN0YW5nbGUuYm90dG9tXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlYWQgb25lIHBvc2l0aXZlIHBpeGVsIHRva2VuIGZyb20gVGltZWxpbmUgY3VzdG9tIHByb3BlcnRpZXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0NTU1N0eWxlRGVjbGFyYXRpb259IGNvbXB1dGVkX3N0eWxlIENvbXB1dGVkIFRpbWVsaW5lIHN0eWxlLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wZXJ0eV9uYW1lIENTUyBjdXN0b20tcHJvcGVydHkgbmFtZS5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gZmFsbGJhY2tfcHggRmFsbGJhY2sgQ1NTLXBpeGVsIHZhbHVlLlxuXHRcdCAqIEByZXR1cm4ge251bWJlcn0gUG9zaXRpdmUgQ1NTLXBpeGVsIHZhbHVlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9ib29raW5nX2xheW91dF90b2tlbiggY29tcHV0ZWRfc3R5bGUsIHByb3BlcnR5X25hbWUsIGZhbGxiYWNrX3B4ICkge1xuXHRcdFx0dmFyIHBhcnNlZF92YWx1ZSA9IHBhcnNlRmxvYXQoIGNvbXB1dGVkX3N0eWxlLmdldFByb3BlcnR5VmFsdWUoIHByb3BlcnR5X25hbWUgKSApO1xuXG5cdFx0XHRyZXR1cm4gTnVtYmVyLmlzRmluaXRlKCBwYXJzZWRfdmFsdWUgKSAmJiAwIDwgcGFyc2VkX3ZhbHVlID8gcGFyc2VkX3ZhbHVlIDogZmFsbGJhY2tfcHg7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTW92ZSBhIGJvb2tpbmcgY29udHJvbCByYWlsIHdpdGhvdXQgZGlzY2FyZGluZyBrZXlib2FyZCBmb2N1cy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJhaWwgQ29udHJvbCByYWlsIHRvIG1vdmUuXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcGFyZW50IERlc3RpbmF0aW9uIHBhcmVudC5cblx0XHQgKiBAcGFyYW0gez9Ob2RlfSByZWZlcmVuY2Vfbm9kZSBOb2RlIGJlZm9yZSB3aGljaCB0aGUgcmFpbCBpcyBpbnNlcnRlZC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG1vdmVfYm9va2luZ19jb250cm9sX3JhaWwoIHJhaWwsIHBhcmVudCwgcmVmZXJlbmNlX25vZGUgKSB7XG5cdFx0XHR2YXIgZm9jdXNlZF9jb250cm9sID0gISByYWlsLmhpZGRlbiAmJiByYWlsLmNvbnRhaW5zKCBkb2N1bWVudC5hY3RpdmVFbGVtZW50IClcblx0XHRcdFx0PyBkb2N1bWVudC5hY3RpdmVFbGVtZW50XG5cdFx0XHRcdDogbnVsbDtcblxuXHRcdFx0cGFyZW50Lmluc2VydEJlZm9yZSggcmFpbCwgcmVmZXJlbmNlX25vZGUgfHwgbnVsbCApO1xuXHRcdFx0aWYgKCBmb2N1c2VkX2NvbnRyb2wgJiYgZG9jdW1lbnQuYWN0aXZlRWxlbWVudCAhPT0gZm9jdXNlZF9jb250cm9sICkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGZvY3VzZWRfY29udHJvbC5mb2N1cyggeyBwcmV2ZW50U2Nyb2xsOiB0cnVlIH0gKTtcblx0XHRcdFx0fSBjYXRjaCAoIGVycm9yICkge1xuXHRcdFx0XHRcdGZvY3VzZWRfY29udHJvbC5mb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVzdG9yZSBhIGNvbnRyb2wgcmFpbCB0byBpdHMgY2FyZC1vd25lZCBhY2Nlc3NvcnkgZG9jay5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGNhcmQgQ2Fub25pY2FsIGJvb2tpbmcgY2FyZC5cblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByYWlsIFNlZ21lbnQgY29udHJvbCByYWlsLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVzdG9yZV9ib29raW5nX2NvbnRyb2xfcmFpbCggY2FyZCwgcmFpbCApIHtcblx0XHRcdHZhciBkb2NrID0gY2FyZC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfdGltZWxpbmVfX2Jvb2tpbmdfYWNjZXNzb3J5X2RvY2snICk7XG5cblx0XHRcdGlmICggISBkb2NrICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHJhaWwucGFyZW50Tm9kZSAhPT0gZG9jayApIHtcblx0XHRcdFx0bW92ZV9ib29raW5nX2NvbnRyb2xfcmFpbCggcmFpbCwgZG9jaywgbnVsbCApO1xuXHRcdFx0fVxuXHRcdFx0cmFpbC5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtcm93LW92ZXJsYXknLCAnaXMtZG9ja2VkLWlubGluZS1zdGFydCcsICdpcy1kb2NrZWQtaW5saW5lLWVuZCcsICdpcy1kb2NrZWQtY2xhbXBlZCcgKTtcblx0XHRcdGNhcmQuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLWJvb2tpbmctYWNjZXNzb3J5LWRvY2tlZCcgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXBvcnQgd2hldGhlciBhIHJhaWwgbXVzdCByZW1haW4gYSBkZXNjZW5kYW50IG9mIGl0cyBjYW5vbmljYWwgY2FyZC5cblx0XHQgKlxuXHRcdCAqIERvbWFpbiBleHRlbnNpb25zIHVzZSB0aGlzIG5ldXRyYWwgZ2VvbWV0cnkgY29udHJhY3Qgd2hlbiBhIGNvbnRyb2wnc1xuXHRcdCAqIGludGVyYWN0aW9uIGxpYnJhcnkgcmVxdWlyZXMgaXRzIGhhbmRsZSB0byByZW1haW4gaW5zaWRlIHRoZSBvd25pbmcgbm9kZS5cblx0XHQgKiBUaGUgbWFya2VyIGFmZmVjdHMgcHJlc2VudGF0aW9uIG93bmVyc2hpcCBvbmx5OyBpdCBncmFudHMgbm8gcGVybWlzc2lvbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJhaWwgQm9va2luZyBjb250cm9sIHJhaWwuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHJvdy1vdmVybGF5IGRldGFjaG1lbnQgaXMgcHJvaGliaXRlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpc19ib29raW5nX2NvbnRyb2xfcmFpbF9jYXJkX293bmVkKCByYWlsICkge1xuXHRcdFx0cmV0dXJuIEJvb2xlYW4oIHJhaWwgJiYgcmFpbC5oYXNBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1jb250cm9sLXJhaWwtY2FyZC1vd25lZCcgKSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENob29zZSBhIGJvdW5kZWQgcGh5c2ljYWwgcG9zaXRpb24gYmVzaWRlIGEgbmFycm93IHZpc2libGUgc2VnbWVudC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSB2aXNpYmxlX3NlZ21lbnQgUGh5c2ljYWwgdmlzaWJsZSBzZWdtZW50IGJvdW5kYXJpZXMuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHZpc2libGVfY2FudmFzIFBoeXNpY2FsIHZpc2libGUgY2FudmFzIGJvdW5kYXJpZXMuXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHJhaWxfd2lkdGggQ29udHJvbC1yYWlsIHdpZHRoIGluIENTUyBwaXhlbHMuXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHJhaWxfZ2FwIEdhcCBiZXR3ZWVuIHNlZ21lbnQgYW5kIG92ZXJsYXkgcmFpbC5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IFBoeXNpY2FsIGxlZnQgcG9zaXRpb24gYW5kIGNob3NlbiBsb2dpY2FsIHNpZGUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2Jvb2tpbmdfb3ZlcmxheV9yYWlsX3Bvc2l0aW9uKCB2aXNpYmxlX3NlZ21lbnQsIHZpc2libGVfY2FudmFzLCByYWlsX3dpZHRoLCByYWlsX2dhcCApIHtcblx0XHRcdHZhciBpbmxpbmVfZW5kX2xlZnQgPSBzZXR0aW5ncy5pc19ydGxcblx0XHRcdFx0PyB2aXNpYmxlX3NlZ21lbnQubGVmdCAtIHJhaWxfZ2FwIC0gcmFpbF93aWR0aFxuXHRcdFx0XHQ6IHZpc2libGVfc2VnbWVudC5yaWdodCArIHJhaWxfZ2FwO1xuXHRcdFx0dmFyIGlubGluZV9zdGFydF9sZWZ0ID0gc2V0dGluZ3MuaXNfcnRsXG5cdFx0XHRcdD8gdmlzaWJsZV9zZWdtZW50LnJpZ2h0ICsgcmFpbF9nYXBcblx0XHRcdFx0OiB2aXNpYmxlX3NlZ21lbnQubGVmdCAtIHJhaWxfZ2FwIC0gcmFpbF93aWR0aDtcblx0XHRcdHZhciBmaXRzID0gZnVuY3Rpb24gKCBwaHlzaWNhbF9sZWZ0ICkge1xuXHRcdFx0XHRyZXR1cm4gcGh5c2ljYWxfbGVmdCA+PSB2aXNpYmxlX2NhbnZhcy5sZWZ0ICYmIHBoeXNpY2FsX2xlZnQgKyByYWlsX3dpZHRoIDw9IHZpc2libGVfY2FudmFzLnJpZ2h0O1xuXHRcdFx0fTtcblx0XHRcdHZhciBhdmFpbGFibGVfYmVmb3JlID0gTWF0aC5tYXgoIDAsIHZpc2libGVfc2VnbWVudC5sZWZ0IC0gdmlzaWJsZV9jYW52YXMubGVmdCApO1xuXHRcdFx0dmFyIGF2YWlsYWJsZV9hZnRlciA9IE1hdGgubWF4KCAwLCB2aXNpYmxlX2NhbnZhcy5yaWdodCAtIHZpc2libGVfc2VnbWVudC5yaWdodCApO1xuXHRcdFx0dmFyIHBoeXNpY2FsX2xlZnQ7XG5cdFx0XHR2YXIgbG9naWNhbF9zaWRlO1xuXG5cdFx0XHRpZiAoIGZpdHMoIGlubGluZV9lbmRfbGVmdCApICkge1xuXHRcdFx0XHRwaHlzaWNhbF9sZWZ0ID0gaW5saW5lX2VuZF9sZWZ0O1xuXHRcdFx0XHRsb2dpY2FsX3NpZGUgPSAnZW5kJztcblx0XHRcdH0gZWxzZSBpZiAoIGZpdHMoIGlubGluZV9zdGFydF9sZWZ0ICkgKSB7XG5cdFx0XHRcdHBoeXNpY2FsX2xlZnQgPSBpbmxpbmVfc3RhcnRfbGVmdDtcblx0XHRcdFx0bG9naWNhbF9zaWRlID0gJ3N0YXJ0Jztcblx0XHRcdH0gZWxzZSBpZiAoIGF2YWlsYWJsZV9hZnRlciA+PSBhdmFpbGFibGVfYmVmb3JlICkge1xuXHRcdFx0XHRwaHlzaWNhbF9sZWZ0ID0gTWF0aC5taW4oIHZpc2libGVfY2FudmFzLnJpZ2h0IC0gcmFpbF93aWR0aCwgdmlzaWJsZV9zZWdtZW50LnJpZ2h0ICsgcmFpbF9nYXAgKTtcblx0XHRcdFx0bG9naWNhbF9zaWRlID0gc2V0dGluZ3MuaXNfcnRsID8gJ3N0YXJ0JyA6ICdlbmQnO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cGh5c2ljYWxfbGVmdCA9IE1hdGgubWF4KCB2aXNpYmxlX2NhbnZhcy5sZWZ0LCB2aXNpYmxlX3NlZ21lbnQubGVmdCAtIHJhaWxfZ2FwIC0gcmFpbF93aWR0aCApO1xuXHRcdFx0XHRsb2dpY2FsX3NpZGUgPSBzZXR0aW5ncy5pc19ydGwgPyAnZW5kJyA6ICdzdGFydCc7XG5cdFx0XHR9XG5cdFx0XHRwaHlzaWNhbF9sZWZ0ID0gTWF0aC5tYXgoIHZpc2libGVfY2FudmFzLmxlZnQsIE1hdGgubWluKCB2aXNpYmxlX2NhbnZhcy5yaWdodCAtIHJhaWxfd2lkdGgsIHBoeXNpY2FsX2xlZnQgKSApO1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRsZWZ0OiBwaHlzaWNhbF9sZWZ0LFxuXHRcdFx0XHRsb2dpY2FsX3NpZGU6IGxvZ2ljYWxfc2lkZVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBQb3NpdGlvbiBldmVyeSBib29raW5nIGluZm9ybWF0aW9uIHJhaWwgYWdhaW5zdCB0aGUgdmlzaWJsZSBjYW52YXMuXG5cdFx0ICpcblx0XHQgKiBMb25nIGNhcmRzIHJldGFpbiBDU1Mtc3RpY2t5IGNvbnRyb2xzLiBPbmx5IGEgdHJ1bHkgbmFycm93IGNhbm9uaWNhbCBjYXJkXG5cdFx0ICogbW92ZXMgaXRzIHJhaWwgaW50byB0aGUgcm93IG92ZXJsYXksIHdpdGhvdXQgY2hhbmdpbmcgYm9va2luZyBvY2N1cGFuY3kuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGxheW91dF9ib29raW5nX2NvbnRyb2xfcmFpbHMoKSB7XG5cdFx0XHR2YXIgY2FudmFzID0gbW91bnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtY2FudmFzXScgKTtcblx0XHRcdHZhciB2aXNpYmxlX2NhbnZhcztcblx0XHRcdHZhciByYWlscztcblx0XHRcdHZhciBjYXJkX2J5X3NlZ21lbnRfaWQgPSBuZXcgTWFwKCk7XG5cblx0XHRcdGJvb2tpbmdfY29udHJvbF9yYWlsX2ZyYW1lID0gMDtcblx0XHRcdGlmICggISBjYW52YXMgfHwgISBpc19ob3N0X2FjdGl2ZSgpICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR2aXNpYmxlX2NhbnZhcyA9IGdldF92aXNpYmxlX3RpbWVfY2FudmFzX3JlY3RhbmdsZSggY2FudmFzICk7XG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBtb3VudC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy10aW1lbGluZS1zZWdtZW50LWlkXScgKSwgZnVuY3Rpb24gKCBjYXJkICkge1xuXHRcdFx0XHR2YXIgc2VnbWVudF9pZCA9IFN0cmluZyggY2FyZC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtc2VnbWVudC1pZCcgKSB8fCAnJyApO1xuXG5cdFx0XHRcdGlmICggc2VnbWVudF9pZCApIHtcblx0XHRcdFx0XHRjYXJkX2J5X3NlZ21lbnRfaWQuc2V0KCBzZWdtZW50X2lkLCBjYXJkICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdHJhaWxzID0gbW91bnQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1jb250cm9sLXJhaWxdJyApO1xuXHRcdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCggcmFpbHMsIGZ1bmN0aW9uICggcmFpbCApIHtcblx0XHRcdFx0dmFyIGNhcmQgPSBnZXRfYm9va2luZ19hY2Nlc3NvcnlfY2FyZCggcmFpbCwgY2FyZF9ieV9zZWdtZW50X2lkICk7XG5cdFx0XHRcdHZhciBzZWdtZW50X2hvc3QgPSBjYXJkID8gY2FyZC5wYXJlbnRFbGVtZW50IDogbnVsbDtcblx0XHRcdFx0dmFyIGNhcmRfcmVjdGFuZ2xlO1xuXHRcdFx0XHR2YXIgaG9zdF9yZWN0YW5nbGU7XG5cdFx0XHRcdHZhciBpc19ib29raW5nX3NlbGVjdGVkO1xuXHRcdFx0XHR2YXIgdmlzaWJsZV9zZWdtZW50O1xuXHRcdFx0XHR2YXIgdmlzaWJsZV93aWR0aDtcblx0XHRcdFx0dmFyIGNhcmRfd2lkdGg7XG5cdFx0XHRcdHZhciBjb21wdXRlZF9zdHlsZTtcblx0XHRcdFx0dmFyIGFjY2Vzc29yeV9zaXplO1xuXHRcdFx0XHR2YXIgZHJhZ19pbmRpY2F0b3Jfc2l6ZTtcblx0XHRcdFx0dmFyIGFjY2Vzc29yeV9nYXA7XG5cdFx0XHRcdHZhciBhY2Nlc3NvcnlfcGFkZGluZztcblx0XHRcdFx0dmFyIGF2YXRhcl9zaXplO1xuXHRcdFx0XHR2YXIgc2VsZWN0aW9uX2VkZ2VfcmVzZXJ2ZTtcblx0XHRcdFx0dmFyIGNvbnRpbnVhdGlvbl93aWR0aDtcblx0XHRcdFx0dmFyIGFjY2Vzc29yeV9jb3VudDtcblx0XHRcdFx0dmFyIGRyYWdfaW5kaWNhdG9yO1xuXHRcdFx0XHR2YXIgaGFzX3Zpc2libGVfZHJhZ19pbmRpY2F0b3I7XG5cdFx0XHRcdHZhciBhY2Nlc3NvcnlfY29udGVudF93aWR0aDtcblx0XHRcdFx0dmFyIGF2YXRhcjtcblx0XHRcdFx0dmFyIGhhc19leHBhbmRlZF9hdmF0YXI7XG5cdFx0XHRcdHZhciByYWlsX3dpZHRoO1xuXHRcdFx0XHR2YXIgcmVxdWlyZWRfd2lkdGg7XG5cdFx0XHRcdHZhciBleHBhbmRlZF9yZXF1aXJlZF93aWR0aDtcblx0XHRcdFx0dmFyIHNob3VsZF9jb25kZW5zZTtcblx0XHRcdFx0dmFyIHNob3VsZF9taW5pbWl6ZTtcblx0XHRcdFx0dmFyIHN0YXJ0X3JhaWxfcmVzZXJ2ZTtcblx0XHRcdFx0dmFyIGVuZF9yYWlsX3Jlc2VydmU7XG5cdFx0XHRcdHZhciBzdGFydF9ib3VuZGFyeV9wb3NpdGlvbjtcblx0XHRcdFx0dmFyIGVuZF9ib3VuZGFyeV9wb3NpdGlvbjtcblx0XHRcdFx0dmFyIHN0YXJ0X2JvdW5kYXJ5X3Zpc2libGU7XG5cdFx0XHRcdHZhciBlbmRfYm91bmRhcnlfdmlzaWJsZTtcblx0XHRcdFx0dmFyIG92ZXJsYXlfcG9zaXRpb247XG5cdFx0XHRcdHZhciBvdmVybGF5X2dhcDtcblx0XHRcdFx0dmFyIHJlcXVpcmVzX2NsYW1wZWRfb3ZlcmxheTtcblx0XHRcdFx0dmFyIGxvZ2ljYWxfcmFpbF9zdGFydDtcblx0XHRcdFx0dmFyIHJhaWxfYmxvY2tfc3RhcnQ7XG5cblx0XHRcdFx0aWYgKCAhIGNhcmQgfHwgISBzZWdtZW50X2hvc3QgfHwgY2FyZC5oaWRkZW4gfHwgY2FyZC5jbG9zZXN0KCAnW2hpZGRlbl0nICkgKSB7XG5cdFx0XHRcdFx0cmFpbC5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXJkX3JlY3RhbmdsZSA9IGNhcmQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRcdGNhcmRfd2lkdGggPSBNYXRoLm1heCggMCwgY2FyZF9yZWN0YW5nbGUud2lkdGggKTtcblx0XHRcdFx0dmlzaWJsZV9zZWdtZW50ID0ge1xuXHRcdFx0XHRcdGxlZnQ6IE1hdGgubWF4KCBjYXJkX3JlY3RhbmdsZS5sZWZ0LCB2aXNpYmxlX2NhbnZhcy5sZWZ0ICksXG5cdFx0XHRcdFx0cmlnaHQ6IE1hdGgubWluKCBjYXJkX3JlY3RhbmdsZS5yaWdodCwgdmlzaWJsZV9jYW52YXMucmlnaHQgKVxuXHRcdFx0XHR9O1xuXHRcdFx0XHR2aXNpYmxlX3dpZHRoID0gTWF0aC5tYXgoIDAsIHZpc2libGVfc2VnbWVudC5yaWdodCAtIHZpc2libGVfc2VnbWVudC5sZWZ0ICk7XG5cdFx0XHRcdGlmICggMCA+PSB2aXNpYmxlX3dpZHRoIHx8IGNhcmRfcmVjdGFuZ2xlLmJvdHRvbSA8PSB2aXNpYmxlX2NhbnZhcy50b3AgfHwgY2FyZF9yZWN0YW5nbGUudG9wID49IHZpc2libGVfY2FudmFzLmJvdHRvbSApIHtcblx0XHRcdFx0XHRyYWlsLmhpZGRlbiA9IHRydWU7XG5cdFx0XHRcdFx0cmVzdG9yZV9ib29raW5nX2NvbnRyb2xfcmFpbCggY2FyZCwgcmFpbCApO1xuXHRcdFx0XHRcdGNhcmQuY2xhc3NMaXN0LmFkZCggJ2lzLWJvb2tpbmctb3V0c2lkZS12aXNpYmxlLWNhbnZhcycgKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyYWlsLmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0XHRjYXJkLmNsYXNzTGlzdC5yZW1vdmUoICdpcy1ib29raW5nLW91dHNpZGUtdmlzaWJsZS1jYW52YXMnICk7XG5cdFx0XHRcdGlzX2Jvb2tpbmdfc2VsZWN0ZWQgPSBjYXJkLmNsYXNzTGlzdC5jb250YWlucyggJ2lzLWJvb2tpbmctc2VsZWN0ZWQnICk7XG5cdFx0XHRcdHJhaWwuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWJvb2tpbmctc2VsZWN0ZWQnLCBpc19ib29raW5nX3NlbGVjdGVkICk7XG5cdFx0XHRcdGNvbXB1dGVkX3N0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoIGNhcmQgKTtcblx0XHRcdFx0YWNjZXNzb3J5X3NpemUgPSBnZXRfYm9va2luZ19sYXlvdXRfdG9rZW4oIGNvbXB1dGVkX3N0eWxlLCAnLS13cGJjX3RpbWVsaW5lX2dlbmVyYWxfX2Jvb2tpbmctYWNjZXNzb3J5LXNpemUnLCAyOCApO1xuXHRcdFx0XHRkcmFnX2luZGljYXRvcl9zaXplID0gZ2V0X2Jvb2tpbmdfbGF5b3V0X3Rva2VuKCBjb21wdXRlZF9zdHlsZSwgJy0td3BiY190aW1lbGluZV9nZW5lcmFsX19ib29raW5nLWRyYWctaW5kaWNhdG9yLXNpemUnLCAyMCApO1xuXHRcdFx0XHRhY2Nlc3NvcnlfZ2FwID0gZ2V0X2Jvb2tpbmdfbGF5b3V0X3Rva2VuKCBjb21wdXRlZF9zdHlsZSwgJy0td3BiY190aW1lbGluZV9nZW5lcmFsX19ib29raW5nLWFjY2Vzc29yeS1nYXAnLCA0ICk7XG5cdFx0XHRcdGFjY2Vzc29yeV9wYWRkaW5nID0gZ2V0X2Jvb2tpbmdfbGF5b3V0X3Rva2VuKCBjb21wdXRlZF9zdHlsZSwgJy0td3BiY190aW1lbGluZV9nZW5lcmFsX19ib29raW5nLWFjY2Vzc29yeS1wYWRkaW5nJywgNCApO1xuXHRcdFx0XHRhdmF0YXJfc2l6ZSA9IGdldF9ib29raW5nX2xheW91dF90b2tlbiggY29tcHV0ZWRfc3R5bGUsICctLXdwYmNfdGltZWxpbmVfZ2VuZXJhbF9fYm9va2luZy1hdmF0YXItc2l6ZScsIDI2ICk7XG5cdFx0XHRcdHNlbGVjdGlvbl9lZGdlX3Jlc2VydmUgPSBnZXRfYm9va2luZ19sYXlvdXRfdG9rZW4oIGNvbXB1dGVkX3N0eWxlLCAnLS13cGJjLXRpbWVsaW5lLWJvb2tpbmctc2VsZWN0aW9uLWVkZ2UtcmVzZXJ2ZScsIDAgKTtcblx0XHRcdFx0Y29udGludWF0aW9uX3dpZHRoID0gZ2V0X2Jvb2tpbmdfbGF5b3V0X3Rva2VuKCBjb21wdXRlZF9zdHlsZSwgJy0td3BiY190aW1lbGluZV9nZW5lcmFsX19ib29raW5nLWNvbnRpbnVhdGlvbi13aWR0aCcsIDI4ICk7XG5cdFx0XHRcdGFjY2Vzc29yeV9jb3VudCA9IHJhaWwucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX3RpbWVsaW5lX19ib29raW5nX2FjY2Vzc29yeTpub3QoW2hpZGRlbl0pJyApLmxlbmd0aDtcblx0XHRcdFx0ZHJhZ19pbmRpY2F0b3IgPSByYWlsLnF1ZXJ5U2VsZWN0b3IoICcud3BiY190aW1lbGluZV9fYm9va2luZ19kcmFnX2luZGljYXRvcjpub3QoW2hpZGRlbl0pJyApO1xuXHRcdFx0XHRoYXNfdmlzaWJsZV9kcmFnX2luZGljYXRvciA9IEJvb2xlYW4oIGRyYWdfaW5kaWNhdG9yICYmIGlzX2Jvb2tpbmdfc2VsZWN0ZWQgKTtcblx0XHRcdFx0aWYgKCBkcmFnX2luZGljYXRvciAmJiAhIGhhc192aXNpYmxlX2RyYWdfaW5kaWNhdG9yICkge1xuXHRcdFx0XHRcdGFjY2Vzc29yeV9jb3VudCA9IE1hdGgubWF4KCAwLCBhY2Nlc3NvcnlfY291bnQgLSAxICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YWNjZXNzb3J5X2NvbnRlbnRfd2lkdGggPSAoIE1hdGgubWF4KCAwLCBhY2Nlc3NvcnlfY291bnQgLSAoIGhhc192aXNpYmxlX2RyYWdfaW5kaWNhdG9yID8gMSA6IDAgKSApICogYWNjZXNzb3J5X3NpemUgKVxuXHRcdFx0XHRcdCsgKCBoYXNfdmlzaWJsZV9kcmFnX2luZGljYXRvciA/IGRyYWdfaW5kaWNhdG9yX3NpemUgOiAwICk7XG5cdFx0XHRcdGF2YXRhciA9IGNhcmQucXVlcnlTZWxlY3RvciggJy53cGJjX3RpbWVsaW5lX19ib29raW5nX2F2YXRhcicgKTtcblx0XHRcdFx0aGFzX2V4cGFuZGVkX2F2YXRhciA9IEJvb2xlYW4oIGF2YXRhciApICYmICEgY2FyZC5jbGFzc0xpc3QuY29udGFpbnMoICdpcy1jb21wYWN0JyApO1xuXHRcdFx0XHRyYWlsX3dpZHRoID0gTWF0aC5tYXgoXG5cdFx0XHRcdFx0YWNjZXNzb3J5X3NpemUgKyAoIDIgKiBhY2Nlc3NvcnlfcGFkZGluZyApLFxuXHRcdFx0XHRcdGFjY2Vzc29yeV9jb250ZW50X3dpZHRoICsgKCBNYXRoLm1heCggMCwgYWNjZXNzb3J5X2NvdW50IC0gMSApICogYWNjZXNzb3J5X2dhcCApICsgKCAyICogYWNjZXNzb3J5X3BhZGRpbmcgKVxuXHRcdFx0XHQpO1xuXHRcdFx0XHRzdGFydF9ib3VuZGFyeV9wb3NpdGlvbiA9IHNldHRpbmdzLmlzX3J0bCA/IGNhcmRfcmVjdGFuZ2xlLnJpZ2h0IDogY2FyZF9yZWN0YW5nbGUubGVmdDtcblx0XHRcdFx0ZW5kX2JvdW5kYXJ5X3Bvc2l0aW9uID0gc2V0dGluZ3MuaXNfcnRsID8gY2FyZF9yZWN0YW5nbGUubGVmdCA6IGNhcmRfcmVjdGFuZ2xlLnJpZ2h0O1xuXHRcdFx0XHRzdGFydF9ib3VuZGFyeV92aXNpYmxlID0gc3RhcnRfYm91bmRhcnlfcG9zaXRpb24gPj0gdmlzaWJsZV9jYW52YXMubGVmdCAtIDAuNSAmJiBzdGFydF9ib3VuZGFyeV9wb3NpdGlvbiA8PSB2aXNpYmxlX2NhbnZhcy5yaWdodCArIDAuNTtcblx0XHRcdFx0ZW5kX2JvdW5kYXJ5X3Zpc2libGUgPSBlbmRfYm91bmRhcnlfcG9zaXRpb24gPj0gdmlzaWJsZV9jYW52YXMubGVmdCAtIDAuNSAmJiBlbmRfYm91bmRhcnlfcG9zaXRpb24gPD0gdmlzaWJsZV9jYW52YXMucmlnaHQgKyAwLjU7XG5cdFx0XHRcdHN0YXJ0X3JhaWxfcmVzZXJ2ZSA9IGFjY2Vzc29yeV9wYWRkaW5nO1xuXHRcdFx0XHRlbmRfcmFpbF9yZXNlcnZlID0gYWNjZXNzb3J5X3BhZGRpbmc7XG5cdFx0XHRcdGlmICggc3RhcnRfYm91bmRhcnlfdmlzaWJsZSAmJiBjYXJkLmNsYXNzTGlzdC5jb250YWlucyggJ2lzLWNsaXBwZWQtc3RhcnQnICkgKSB7XG5cdFx0XHRcdFx0c3RhcnRfcmFpbF9yZXNlcnZlID0gTWF0aC5tYXgoIHN0YXJ0X3JhaWxfcmVzZXJ2ZSwgY29udGludWF0aW9uX3dpZHRoICsgYWNjZXNzb3J5X2dhcCApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggZW5kX2JvdW5kYXJ5X3Zpc2libGUgJiYgY2FyZC5jbGFzc0xpc3QuY29udGFpbnMoICdpcy1jbGlwcGVkLWVuZCcgKSApIHtcblx0XHRcdFx0XHRlbmRfcmFpbF9yZXNlcnZlID0gTWF0aC5tYXgoIGVuZF9yYWlsX3Jlc2VydmUsIGNvbnRpbnVhdGlvbl93aWR0aCArIGFjY2Vzc29yeV9nYXAgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRleHBhbmRlZF9yZXF1aXJlZF93aWR0aCA9IHJhaWxfd2lkdGhcblx0XHRcdFx0XHQrICggaGFzX2V4cGFuZGVkX2F2YXRhciA/IGF2YXRhcl9zaXplICsgYWNjZXNzb3J5X2dhcCA6IDAgKVxuXHRcdFx0XHRcdCsgTWF0aC5tYXgoIDAsIHN0YXJ0X3JhaWxfcmVzZXJ2ZSAtIGFjY2Vzc29yeV9wYWRkaW5nIClcblx0XHRcdFx0XHQrIE1hdGgubWF4KCAwLCBlbmRfcmFpbF9yZXNlcnZlIC0gYWNjZXNzb3J5X3BhZGRpbmcgKVxuXHRcdFx0XHRcdCsgKCAyICogc2VsZWN0aW9uX2VkZ2VfcmVzZXJ2ZSApO1xuXHRcdFx0XHRzZXRfY2hhbmdlZF9zdHlsZV9wcm9wZXJ0eSggY2FyZCwgJy0td3BiYy10aW1lbGluZS1ib29raW5nLXN0YXJ0LXJhaWwtcmVzZXJ2ZScsIE1hdGgucm91bmQoIHN0YXJ0X3JhaWxfcmVzZXJ2ZSAqIDEwMCApIC8gMTAwICsgJ3B4JyApO1xuXHRcdFx0XHRzZXRfY2hhbmdlZF9zdHlsZV9wcm9wZXJ0eSggY2FyZCwgJy0td3BiYy10aW1lbGluZS1ib29raW5nLWVuZC1yYWlsLXJlc2VydmUnLCBNYXRoLnJvdW5kKCBlbmRfcmFpbF9yZXNlcnZlICogMTAwICkgLyAxMDAgKyAncHgnICk7XG5cblx0XHRcdFx0c2hvdWxkX2NvbmRlbnNlID0gY2FyZF93aWR0aCA8IE1hdGgubWF4KCAxMjAsIGV4cGFuZGVkX3JlcXVpcmVkX3dpZHRoICsgNDAgKTtcblx0XHRcdFx0cmVxdWlyZWRfd2lkdGggPSByYWlsX3dpZHRoXG5cdFx0XHRcdFx0KyBNYXRoLm1heCggMCwgc3RhcnRfcmFpbF9yZXNlcnZlIC0gYWNjZXNzb3J5X3BhZGRpbmcgKVxuXHRcdFx0XHRcdCsgTWF0aC5tYXgoIDAsIGVuZF9yYWlsX3Jlc2VydmUgLSBhY2Nlc3NvcnlfcGFkZGluZyApXG5cdFx0XHRcdFx0KyAoIDIgKiBzZWxlY3Rpb25fZWRnZV9yZXNlcnZlICk7XG5cdFx0XHRcdHNob3VsZF9taW5pbWl6ZSA9IGNhcmRfd2lkdGggPCByZXF1aXJlZF93aWR0aCArIDE2O1xuXHRcdFx0XHRjYXJkLmNsYXNzTGlzdC50b2dnbGUoICdpcy1ib29raW5nLWluZm8tY29uZGVuc2VkJywgc2hvdWxkX2NvbmRlbnNlICk7XG5cdFx0XHRcdGNhcmQuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWJvb2tpbmctaW5mby1taW5pbWFsJywgc2hvdWxkX21pbmltaXplICk7XG5cdFx0XHRcdHJhaWwuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWJvb2tpbmctaW5mby1jb25kZW5zZWQnLCBzaG91bGRfY29uZGVuc2UgKTtcblx0XHRcdFx0aWYgKCBjYXJkX3dpZHRoICsgMC41ID49IHJlcXVpcmVkX3dpZHRoIHx8IGlzX2Jvb2tpbmdfY29udHJvbF9yYWlsX2NhcmRfb3duZWQoIHJhaWwgKSApIHtcblx0XHRcdFx0XHRyZXN0b3JlX2Jvb2tpbmdfY29udHJvbF9yYWlsKCBjYXJkLCByYWlsICk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0b3ZlcmxheV9nYXAgPSBhY2Nlc3NvcnlfZ2FwICsgc2VsZWN0aW9uX2VkZ2VfcmVzZXJ2ZTtcblx0XHRcdFx0b3ZlcmxheV9wb3NpdGlvbiA9IGdldF9ib29raW5nX292ZXJsYXlfcmFpbF9wb3NpdGlvbiggdmlzaWJsZV9zZWdtZW50LCB2aXNpYmxlX2NhbnZhcywgcmFpbF93aWR0aCwgb3ZlcmxheV9nYXAgKTtcblx0XHRcdFx0aG9zdF9yZWN0YW5nbGUgPSBzZWdtZW50X2hvc3QuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRcdHJlcXVpcmVzX2NsYW1wZWRfb3ZlcmxheSA9IGNhcmRfcmVjdGFuZ2xlLmxlZnQgPCB2aXNpYmxlX2NhbnZhcy5sZWZ0IC0gMC41XG5cdFx0XHRcdFx0fHwgY2FyZF9yZWN0YW5nbGUucmlnaHQgPiB2aXNpYmxlX2NhbnZhcy5yaWdodCArIDAuNTtcblx0XHRcdFx0cmFpbF9ibG9ja19zdGFydCA9IGNhcmRfcmVjdGFuZ2xlLnRvcCAtIGhvc3RfcmVjdGFuZ2xlLnRvcCArIE1hdGgubWF4KCAwLCAoIGNhcmRfcmVjdGFuZ2xlLmhlaWdodCAtIGFjY2Vzc29yeV9zaXplIC0gNiApIC8gMiApO1xuXHRcdFx0XHRpZiAoIHJhaWwucGFyZW50Tm9kZSAhPT0gc2VnbWVudF9ob3N0ICkge1xuXHRcdFx0XHRcdG1vdmVfYm9va2luZ19jb250cm9sX3JhaWwoIHJhaWwsIHNlZ21lbnRfaG9zdCwgbnVsbCApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJhaWwuY2xhc3NMaXN0LmFkZCggJ2lzLXJvdy1vdmVybGF5JyApO1xuXHRcdFx0XHRyYWlsLmNsYXNzTGlzdC50b2dnbGUoICdpcy1kb2NrZWQtaW5saW5lLXN0YXJ0JywgJ3N0YXJ0JyA9PT0gb3ZlcmxheV9wb3NpdGlvbi5sb2dpY2FsX3NpZGUgKTtcblx0XHRcdFx0cmFpbC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtZG9ja2VkLWlubGluZS1lbmQnLCAnZW5kJyA9PT0gb3ZlcmxheV9wb3NpdGlvbi5sb2dpY2FsX3NpZGUgKTtcblx0XHRcdFx0cmFpbC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtZG9ja2VkLWNsYW1wZWQnLCByZXF1aXJlc19jbGFtcGVkX292ZXJsYXkgKTtcblx0XHRcdFx0Y2FyZC5jbGFzc0xpc3QuYWRkKCAnaXMtYm9va2luZy1hY2Nlc3NvcnktZG9ja2VkJyApO1xuXHRcdFx0XHRzZXRfY2hhbmdlZF9zdHlsZV9wcm9wZXJ0eSggcmFpbCwgJy0td3BiYy10aW1lbGluZS1ib29raW5nLXJhaWwtYmxvY2stc3RhcnQnLCBNYXRoLnJvdW5kKCByYWlsX2Jsb2NrX3N0YXJ0ICogMTAwICkgLyAxMDAgKyAncHgnICk7XG5cdFx0XHRcdHNldF9jaGFuZ2VkX3N0eWxlX3Byb3BlcnR5KCByYWlsLCAnLS13cGJjLXRpbWVsaW5lLWJvb2tpbmctcmFpbC1nYXAnLCBNYXRoLnJvdW5kKCBvdmVybGF5X2dhcCAqIDEwMCApIC8gMTAwICsgJ3B4JyApO1xuXHRcdFx0XHRpZiAoIHJlcXVpcmVzX2NsYW1wZWRfb3ZlcmxheSApIHtcblx0XHRcdFx0XHRsb2dpY2FsX3JhaWxfc3RhcnQgPSBzZXR0aW5ncy5pc19ydGxcblx0XHRcdFx0XHRcdD8gaG9zdF9yZWN0YW5nbGUucmlnaHQgLSAoIG92ZXJsYXlfcG9zaXRpb24ubGVmdCArIHJhaWxfd2lkdGggKVxuXHRcdFx0XHRcdFx0OiBvdmVybGF5X3Bvc2l0aW9uLmxlZnQgLSBob3N0X3JlY3RhbmdsZS5sZWZ0O1xuXHRcdFx0XHRcdHNldF9jaGFuZ2VkX3N0eWxlX3Byb3BlcnR5KCByYWlsLCAnLS13cGJjLXRpbWVsaW5lLWJvb2tpbmctcmFpbC1jbGFtcGVkLWlubGluZS1zdGFydCcsIE1hdGgucm91bmQoIGxvZ2ljYWxfcmFpbF9zdGFydCAqIDEwMCApIC8gMTAwICsgJ3B4JyApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJhaWwuc3R5bGUucmVtb3ZlUHJvcGVydHkoICctLXdwYmMtdGltZWxpbmUtYm9va2luZy1yYWlsLWNsYW1wZWQtaW5saW5lLXN0YXJ0JyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIGJvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcF9jb250cm9sbGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBib29raW5nX292ZXJ2aWV3X3Rvb2x0aXBfY29udHJvbGxlci51cGRhdGVfZ2VvbWV0cnkgKSB7XG5cdFx0XHRcdGJvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcF9jb250cm9sbGVyLnVwZGF0ZV9nZW9tZXRyeSgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlcXVlc3Qgb25lIGFuaW1hdGlvbi1mcmFtZSBiYXRjaCBmb3IgYm9va2luZyBjb250cm9sLXJhaWwgZ2VvbWV0cnkuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNjaGVkdWxlX2Jvb2tpbmdfY29udHJvbF9yYWlsX2xheW91dCgpIHtcblx0XHRcdGlmICggYm9va2luZ19jb250cm9sX3JhaWxfc2V0dGxlX3RpbWVyICkge1xuXHRcdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCBib29raW5nX2NvbnRyb2xfcmFpbF9zZXR0bGVfdGltZXIgKTtcblx0XHRcdFx0Ym9va2luZ19jb250cm9sX3JhaWxfc2V0dGxlX3RpbWVyID0gMDtcblx0XHRcdH1cblx0XHRcdGlmICggYm9va2luZ19jb250cm9sX3JhaWxfZnJhbWUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGJvb2tpbmdfY29udHJvbF9yYWlsX2ZyYW1lID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggbGF5b3V0X2Jvb2tpbmdfY29udHJvbF9yYWlscyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlY29uY2lsZSBtZWFzdXJlZCBuYXJyb3ctY2FyZCBmYWxsYmFja3MgYWZ0ZXIgYXhpcyBtb3Rpb24gc2V0dGxlcy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2NoZWR1bGVfYm9va2luZ19jb250cm9sX3JhaWxfbGF5b3V0X2FmdGVyX2F4aXNfbW90aW9uKCkge1xuXHRcdFx0aWYgKCBib29raW5nX2NvbnRyb2xfcmFpbF9zZXR0bGVfdGltZXIgKSB7XG5cdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIGJvb2tpbmdfY29udHJvbF9yYWlsX3NldHRsZV90aW1lciApO1xuXHRcdFx0fVxuXHRcdFx0Ym9va2luZ19jb250cm9sX3JhaWxfc2V0dGxlX3RpbWVyID0gd2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0Ym9va2luZ19jb250cm9sX3JhaWxfc2V0dGxlX3RpbWVyID0gMDtcblx0XHRcdFx0aWYgKCAhIGlzX2hvc3RfYWN0aXZlKCkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNjaGVkdWxlX2Jvb2tpbmdfY29udHJvbF9yYWlsX2xheW91dCgpO1xuXHRcdFx0fSwgYm9va2luZ19jb250cm9sX3JhaWxfc2V0dGxlX2RlbGF5ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTW91bnQgdGhlIHJldXNhYmxlIEJvb2tpbmcgSW5zcGVjdG9yIGRvbWFpbiBpbiB0aGUgVGltZWxpbmUgaG9zdC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgYWRhcHRlciBpcyBhdmFpbGFibGUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaW5pdGlhbGl6ZV9ib29raW5nX2luc3BlY3RvcigpIHtcblx0XHRcdHZhciBob3N0ID0gbW91bnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1pbnNwZWN0b3ItaG9zdF0nICk7XG5cblx0XHRcdGlmICggISBob3N0IHx8ICEgd2luZG93LndwYmNfYm9va2luZ19pbnNwZWN0b3JfaG9zdHMgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy53cGJjX2Jvb2tpbmdfaW5zcGVjdG9yX2hvc3RzLmNyZWF0ZV90aW1lbGluZSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0Ym9va2luZ19pbnNwZWN0b3JfYWRhcHRlciA9IHdpbmRvdy53cGJjX2Jvb2tpbmdfaW5zcGVjdG9yX2hvc3RzLmNyZWF0ZV90aW1lbGluZSggbW91bnQsIGhvc3QsIHNldHRpbmdzLmJvb2tpbmdfaW5zcGVjdG9yICk7XG5cblx0XHRcdHJldHVybiBCb29sZWFuKCBib29raW5nX2luc3BlY3Rvcl9hZGFwdGVyICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogT3BlbiB0aGUgY2Fub25pY2FsIGZ1bGwgUmVzY2hlZHVsZSBkaWFsb2cgZm9yIGEgc3RhdGljIHJlc2l6ZSBoYW5kbGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjYXJkICAgRXhhY3Qgc2VsZWN0ZWQgVGltZWxpbmUgY2FyZC5cblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBoYW5kbGUgQWNjZXNzaWJsZSByZXNpemUtaGFuZGxlIGJ1dHRvbi5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG9wZW5fZnVsbF9yZXNjaGVkdWxlX2Zyb21faGFuZGxlKCBjYXJkLCBoYW5kbGUgKSB7XG5cdFx0XHRpZiAoIGJvb2tpbmdfaW5zcGVjdG9yX2FkYXB0ZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGJvb2tpbmdfaW5zcGVjdG9yX2FkYXB0ZXIub3Blbl9yZXNjaGVkdWxpbmcgKSB7XG5cdFx0XHRcdGJvb2tpbmdfaW5zcGVjdG9yX2FkYXB0ZXIub3Blbl9yZXNjaGVkdWxpbmcoIGNhcmQsIGhhbmRsZSApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlZnJlc2ggZXZlcnkgdmlzaWJsZSBib29raW5nIHByb2plY3Rpb24gYWZ0ZXIgY2Fub25pY2FsIGJvb2tpbmcgQXBwbHkuXG5cdFx0ICpcblx0XHQgKiBCb29raW5nIE92ZXJ2aWV3IGlzIGludmFsaWRhdGVkIGJlZm9yZSBUaW1lbGluZSByZXBsYWNlbWVudC4gQW4gb3BlblxuXHRcdCAqIG1hdGNoaW5nIEluc3BlY3RvciBwZXJmb3JtcyBpdHMgb3duIGF1dGhvcml6ZWQgcmVhZGJhY2ssIGluY2x1ZGluZ1xuXHRcdCAqIEFjdGl2aXR5LiBUaGUgcmV0dXJuZWQgcHJvbWlzZSBjb250YWlucyBubyBtdXRhdGlvbiBwYXRoIGFuZCBpcyB0aGVyZWZvcmVcblx0XHQgKiBzYWZlIGZvciBkb21haW4gY29udHJvbGxlcnMnIGV4cGxpY2l0IFJldHJ5IHJlZnJlc2ggYWN0aW9ucy4gVGhlIHNoYXJlZFxuXHRcdCAqIGNhbGxiYWNrIHBlcmZvcm1zIHJlYWRzIG9ubHkgYW5kIGNvbnRhaW5zIG5vIHJlc2l6ZSBvciBtb3ZlbWVudCBydWxlcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBhcHBseV9yZXN1bHQgQ2Fub25pY2FsIHNlcnZlciBBcHBseSByZXN1bHQuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBqUXVlcnktY29tcGF0aWJsZSBjb21iaW5lZCByZWFkYmFjayBwcm9taXNlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlZnJlc2hfYWZ0ZXJfcmVzaXplX2FwcGx5KCBhcHBseV9yZXN1bHQgKSB7XG5cdFx0XHR2YXIgcmVmcmVzaF9yZXF1ZXN0cyA9IFtdO1xuXHRcdFx0dmFyIGJvb2tpbmdfaWQgPSBOdW1iZXIoIGFwcGx5X3Jlc3VsdCAmJiBhcHBseV9yZXN1bHQuYm9va2luZ19pZCA/IGFwcGx5X3Jlc3VsdC5ib29raW5nX2lkIDogMCApO1xuXG5cdFx0XHRpZiAoIGJvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcF9jb250cm9sbGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBib29raW5nX292ZXJ2aWV3X3Rvb2x0aXBfY29udHJvbGxlci5pbnZhbGlkYXRlICkge1xuXHRcdFx0XHRib29raW5nX292ZXJ2aWV3X3Rvb2x0aXBfY29udHJvbGxlci5pbnZhbGlkYXRlKCBib29raW5nX2lkICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGJvb2tpbmdfaW5zcGVjdG9yX2FkYXB0ZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGJvb2tpbmdfaW5zcGVjdG9yX2FkYXB0ZXIucmVmcmVzaF9hZnRlcl9leHRlcm5hbF9hcHBseSApIHtcblx0XHRcdFx0cmVmcmVzaF9yZXF1ZXN0cy5wdXNoKCBib29raW5nX2luc3BlY3Rvcl9hZGFwdGVyLnJlZnJlc2hfYWZ0ZXJfZXh0ZXJuYWxfYXBwbHkoIGFwcGx5X3Jlc3VsdCApICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdmdW5jdGlvbicgIT09IHR5cGVvZiBjb250ZXh0LnJlZnJlc2hfYWZ0ZXJfcmVzaXplX2FwcGx5ICkge1xuXHRcdFx0XHRyZXR1cm4gd2luZG93LmpRdWVyeS5EZWZlcnJlZCgpLnJlamVjdCggeyBtZXNzYWdlOiAnJyB9ICkucHJvbWlzZSgpO1xuXHRcdFx0fVxuXHRcdFx0cmVmcmVzaF9yZXF1ZXN0cy5wdXNoKCBjb250ZXh0LnJlZnJlc2hfYWZ0ZXJfcmVzaXplX2FwcGx5KCBhcHBseV9yZXN1bHQgKSApO1xuXG5cdFx0XHRyZXR1cm4gd2luZG93LmpRdWVyeS53aGVuLmFwcGx5KCB3aW5kb3cualF1ZXJ5LCByZWZyZXNoX3JlcXVlc3RzICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTW91bnQgdGhlIGRvbWFpbi1vd25lZCBzdGF0aWMgYm9va2luZy1yZXNpemluZyBwcmVzZW50YXRpb24gY29udHJvbGxlci5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgYm9va2luZy1yZXNpemluZyBjb250cm9sbGVyIGlzIGF2YWlsYWJsZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbml0aWFsaXplX2Jvb2tpbmdfcmVzaXppbmcoKSB7XG5cdFx0XHRpZiAoICEgd2luZG93LndwYmNfdGltZWxpbmVfYm9va2luZ19yZXNpemluZyB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LndwYmNfdGltZWxpbmVfYm9va2luZ19yZXNpemluZy5jcmVhdGVfY29udHJvbGxlciApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0Ym9va2luZ19yZXNpemluZ19jb250cm9sbGVyID0gd2luZG93LndwYmNfdGltZWxpbmVfYm9va2luZ19yZXNpemluZy5jcmVhdGVfY29udHJvbGxlcihcblx0XHRcdFx0bW91bnQsXG5cdFx0XHRcdHNldHRpbmdzLmJvb2tpbmdfcmVzaXppbmcgfHwge30sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRvcGVuX2Z1bGxfcmVzY2hlZHVsZTogb3Blbl9mdWxsX3Jlc2NoZWR1bGVfZnJvbV9oYW5kbGUsXG5cdFx0XHRcdFx0cmVmcmVzaF9hZnRlcl9hcHBseTogcmVmcmVzaF9hZnRlcl9yZXNpemVfYXBwbHksXG5cdFx0XHRcdFx0c2V0X2F4aXNfd2luZG93X2xvYWRpbmdfbG9ja2VkOiBjb250ZXh0LnNldF9heGlzX3dpbmRvd19sb2FkaW5nX2xvY2tlZCxcblx0XHRcdFx0XHRzaG93X2FkbWluX21lc3NhZ2U6IGNvbnRleHQuc2hvd19hZG1pbl9tZXNzYWdlLFxuXHRcdFx0XHRcdGdldF9heGlzOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gc2V0dGluZ3MuYXhpcyB8fCB7fTtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGlzX2hvc3RfYWN0aXZlOiBjb250ZXh0LmlzX2hvc3RfYWN0aXZlLFxuXHRcdFx0XHRcdHN1c3BlbmRfb3ZlcnZpZXc6IGZ1bmN0aW9uICggY2FyZCApIHtcblx0XHRcdFx0XHRcdHN1c3BlbmRfYm9va2luZ19vdmVyZmxvd190b29sdGlwcyggY2FyZCApO1xuXHRcdFx0XHRcdFx0aWYgKCBib29raW5nX292ZXJ2aWV3X3Rvb2x0aXBfY29udHJvbGxlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgYm9va2luZ19vdmVydmlld190b29sdGlwX2NvbnRyb2xsZXIuc3VzcGVuZCApIHtcblx0XHRcdFx0XHRcdFx0Ym9va2luZ19vdmVydmlld190b29sdGlwX2NvbnRyb2xsZXIuc3VzcGVuZCgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0cmVzdW1lX292ZXJ2aWV3OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRyZXN1bWVfYm9va2luZ19vdmVyZmxvd190b29sdGlwcygpO1xuXHRcdFx0XHRcdFx0aWYgKCBib29raW5nX292ZXJ2aWV3X3Rvb2x0aXBfY29udHJvbGxlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgYm9va2luZ19vdmVydmlld190b29sdGlwX2NvbnRyb2xsZXIucmVzdW1lICkge1xuXHRcdFx0XHRcdFx0XHRib29raW5nX292ZXJ2aWV3X3Rvb2x0aXBfY29udHJvbGxlci5yZXN1bWUoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cblx0XHRcdHJldHVybiBCb29sZWFuKCBib29raW5nX3Jlc2l6aW5nX2NvbnRyb2xsZXIgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBEZXRlcm1pbmUgd2hldGhlciBhbm90aGVyIFRpbWVsaW5lIGludGVyYWN0aW9uIGN1cnJlbnRseSBvd25zIGF0dGVudGlvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hpbGUgQm9va2luZyBPdmVydmlldyBtdXN0IHJlbWFpbiBzdXBwcmVzc2VkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGlzX2Jvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcF9zdXBwcmVzc2VkKCkge1xuXHRcdFx0aWYgKCBpc19leHRlbnNpb25faW50ZXJhY3RpbmcoKSApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGFjdGl2ZV90aW1lX3Nsb3Rfb3ZlcmZsb3cgKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBib29raW5nX3Jlc2l6aW5nX2NvbnRyb2xsZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGJvb2tpbmdfcmVzaXppbmdfY29udHJvbGxlci5pc19pbnRlcmFjdGluZyAmJiBib29raW5nX3Jlc2l6aW5nX2NvbnRyb2xsZXIuaXNfaW50ZXJhY3RpbmcoKSApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoXG5cdFx0XHRcdG1vdW50LmNsYXNzTGlzdC5jb250YWlucyggJ2lzLXJlcXVlc3QtbG9hZGluZycgKVxuXHRcdFx0XHR8fCAndHJ1ZScgPT09IG1vdW50LmdldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScgKVxuXHRcdFx0XHR8fCAoICdmdW5jdGlvbicgPT09IHR5cGVvZiBjb250ZXh0LmlzX2VtcHR5X3JhbmdlX3Jlc2l6aW5nICYmIGNvbnRleHQuaXNfZW1wdHlfcmFuZ2VfcmVzaXppbmcoKSApXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIG1vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctaW5zcGVjdG9yLXRyaWdnZXJdLmlzLWJvb2tpbmctZGV0YWlscy1vcGVuJyApICkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggbW91bnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci1sYXllcl06bm90KFtoaWRkZW5dKSwgW2RhdGEtd3BiYy1ib29raW5nLXJlc2NoZWR1bGluZy1sYXllcl06bm90KFtoaWRkZW5dKSwgW2RhdGEtd3BiYy1ib29raW5nLWRhdGUtZWRpdG9yLXZpZXc9XCJyZXZpZXdcIl06bm90KFtoaWRkZW5dKSwgW2RhdGEtd3BiYy1ib29raW5nLXJlc2NoZWR1bGluZy12aWV3PVwicmV2aWV3XCJdOm5vdChbaGlkZGVuXSknICkgKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gQm9vbGVhbiggbW91bnQucXVlcnlTZWxlY3RvciggJy5zb3J0YWJsZS1jaG9zZW4sIC5zb3J0YWJsZS1kcmFnLCAuaXMtZHJhZ2dpbmcsIC5pcy1yZXNpemluZywgW2RhdGEtd3BiYy10aW1lbGluZS1kcmFnZ2luZz1cInRydWVcIl0sIFtkYXRhLXdwYmMtdGltZWxpbmUtcmVzaXppbmc9XCJ0cnVlXCJdJyApICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogT3BlbiBCb29raW5nIEluc3BlY3RvciBmcm9tIHRoZSBib29raW5nLW93bmVkIE92ZXJ2aWV3IGFjdGlvbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGNhcmQgUmVnaXN0ZXJlZCBUaW1lbGluZSBJbnNwZWN0b3IgaWRlbnRpdHkuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBvcGVuX2Jvb2tpbmdfZGV0YWlsc19mcm9tX292ZXJ2aWV3KCBjYXJkICkge1xuXHRcdFx0aWYgKCBib29raW5nX2luc3BlY3Rvcl9hZGFwdGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBib29raW5nX2luc3BlY3Rvcl9hZGFwdGVyLm9wZW4gKSB7XG5cdFx0XHRcdGJvb2tpbmdfaW5zcGVjdG9yX2FkYXB0ZXIub3BlbiggY2FyZCApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBwaW5uZWQgQm9va2luZyBPdmVydmlldyBob3Jpem9udGFsIGlucHV0IHRvIFRpbWVsaW5lIG93bmVyc2hpcC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7V2hlZWxFdmVudH0gZXZlbnQgQnJvd3NlciB3aGVlbCBldmVudCBmcm9tIHRoZSBwaW5uZWQgc3VyZmFjZS5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIFRpbWVsaW5lIHBhZ2UgYWNjZXB0ZWQgdGhlIGdlc3R1cmUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2Nyb2xsX3RpbWVsaW5lX2Zyb21fb3ZlcnZpZXcoIGV2ZW50ICkge1xuXHRcdFx0aWYgKCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgY29udGV4dC5zY3JvbGxfYXhpc19mcm9tX2V4dGVybmFsX3doZWVsICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBjb250ZXh0LnNjcm9sbF9heGlzX2Zyb21fZXh0ZXJuYWxfd2hlZWwoIGV2ZW50ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTW91bnQgdGhlIGJvb2tpbmctb3duZWQgYWRhcHRlciBvdmVyIHRoZSBzaGFyZWQgQ29udGV4dCBQb3BvdmVyLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBPdmVydmlldyBhZGFwdGVyIGlzIGF2YWlsYWJsZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbml0aWFsaXplX2Jvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcCgpIHtcblx0XHRcdGlmICggISB3aW5kb3cud3BiY19ib29raW5nX292ZXJ2aWV3X3Rvb2x0aXAgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy53cGJjX2Jvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcC5jcmVhdGVfY29udHJvbGxlciApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0Ym9va2luZ19vdmVydmlld190b29sdGlwX2NvbnRyb2xsZXIgPSB3aW5kb3cud3BiY19ib29raW5nX292ZXJ2aWV3X3Rvb2x0aXAuY3JlYXRlX2NvbnRyb2xsZXIoXG5cdFx0XHRcdG1vdW50LFxuXHRcdFx0XHRzZXR0aW5ncy5ib29raW5nX292ZXJ2aWV3X3Rvb2x0aXAgfHwge30sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpc19zdXBwcmVzc2VkOiBpc19ib29raW5nX292ZXJ2aWV3X3Rvb2x0aXBfc3VwcHJlc3NlZCxcblx0XHRcdFx0XHRvcGVuX2Jvb2tpbmdfZGV0YWlsczogb3Blbl9ib29raW5nX2RldGFpbHNfZnJvbV9vdmVydmlldyxcblx0XHRcdFx0XHRzY3JvbGxfdGltZWxpbmU6IHNjcm9sbF90aW1lbGluZV9mcm9tX292ZXJ2aWV3XG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cblx0XHRcdHJldHVybiBCb29sZWFuKCBib29raW5nX292ZXJ2aWV3X3Rvb2x0aXBfY29udHJvbGxlciApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlZnJlc2ggdGhlIGNhbm9uaWNhbCBUaW1lbGluZSBhZnRlciBvbmUgYWNjZXB0ZWQgSW5zcGVjdG9yIHNhdmUgZXZlbnQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0N1c3RvbUV2ZW50fSBldmVudCBCb29raW5nIEluc3BlY3RvciBzYXZlLWNvbXBsZXRpb24gZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfYm9va2luZ19pbnNwZWN0b3Jfc2F2ZWQoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGV2ZW50X2RldGFpbCA9IGV2ZW50ICYmIGV2ZW50LmRldGFpbCA/IGV2ZW50LmRldGFpbCA6IHt9O1xuXHRcdFx0dmFyIHJlZnJlc2hfZ2VuZXJhdGlvbiA9IE51bWJlciggZXZlbnRfZGV0YWlsLnJlZnJlc2hfZ2VuZXJhdGlvbiB8fCAwICk7XG5cblx0XHRcdGlmICggJ3RpbWVsaW5lJyAhPT0gZXZlbnRfZGV0YWlsLnNvdXJjZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCByZWZyZXNoX2dlbmVyYXRpb24gJiYgcmVmcmVzaF9nZW5lcmF0aW9uIDw9IGJvb2tpbmdfaW5zcGVjdG9yX3JlZnJlc2hfZ2VuZXJhdGlvbiApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBib29raW5nX292ZXJ2aWV3X3Rvb2x0aXBfY29udHJvbGxlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgYm9va2luZ19vdmVydmlld190b29sdGlwX2NvbnRyb2xsZXIuaW52YWxpZGF0ZSApIHtcblx0XHRcdFx0Ym9va2luZ19vdmVydmlld190b29sdGlwX2NvbnRyb2xsZXIuaW52YWxpZGF0ZSggTnVtYmVyKCBldmVudF9kZXRhaWwuYm9va2luZ19pZCB8fCAwICkgKTtcblx0XHRcdH1cblx0XHRcdGJvb2tpbmdfaW5zcGVjdG9yX3JlZnJlc2hfZ2VuZXJhdGlvbiA9IHJlZnJlc2hfZ2VuZXJhdGlvbiB8fCBib29raW5nX2luc3BlY3Rvcl9yZWZyZXNoX2dlbmVyYXRpb24gKyAxO1xuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29udGV4dC5yZWZyZXNoX2FmdGVyX2luc3BlY3Rvcl9zYXZlICkge1xuXHRcdFx0XHRjb250ZXh0LnJlZnJlc2hfYWZ0ZXJfaW5zcGVjdG9yX3NhdmUoIGV2ZW50X2RldGFpbCApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEhhbmRsZSBib29raW5nIHNlbGVjdGlvbiB0aHJvdWdoIHRoZSBUaW1lbGluZSBkZWxlZ2F0ZWQga2V5ZG93biBwYXRoLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBldmVudCBUaW1lbGluZSBrZXkgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBib29raW5nIGludGVyYWN0aW9uIG93bmVkIHRoZSBldmVudC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfa2V5ZG93biggZXZlbnQgKSB7XG5cdFx0XHR2YXIgc2VsZWN0aW9uX2NvbnRyb2wgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1zZWxlY3RdJyApO1xuXG5cdFx0XHRpZiAoIGlzX2V4dGVuc2lvbl9pbnRlcmFjdGluZygpICkge1xuXHRcdFx0XHRpZiAoICdFc2NhcGUnICE9PSBldmVudC5rZXkgKSB7XG5cdFx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCBib29raW5nX3Jlc2l6aW5nX2NvbnRyb2xsZXIgJiYgYm9va2luZ19yZXNpemluZ19jb250cm9sbGVyLmhhbmRsZV9rZXlkb3duKCBldmVudCApICkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKFxuXHRcdFx0XHQhIHNlbGVjdGlvbl9jb250cm9sXG5cdFx0XHRcdHx8IGV2ZW50LnRhcmdldCAhPT0gc2VsZWN0aW9uX2NvbnRyb2xcblx0XHRcdFx0fHwgZXZlbnQuY3RybEtleVxuXHRcdFx0XHR8fCBldmVudC5tZXRhS2V5XG5cdFx0XHRcdHx8IGV2ZW50LmFsdEtleVxuXHRcdFx0XHR8fCBldmVudC5zaGlmdEtleVxuXHRcdFx0XHR8fCAtMSA9PT0gWyAnRW50ZXInLCAnICcgXS5pbmRleE9mKCBldmVudC5rZXkgKVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRzZWxlY3RfYm9va2luZ19zZWdtZW50KCBzZWxlY3Rpb25fY29udHJvbCApO1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBIYW5kbGUgYm9va2luZyBhY2Nlc3NvcmllcyBhbmQgc2VsZWN0aW9uIHRocm91Z2ggZGVsZWdhdGVkIGNsaWNrIGV2ZW50cy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7TW91c2VFdmVudH0gZXZlbnQgVGltZWxpbmUgY2xpY2sgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGEgYm9va2luZyBpbnRlcmFjdGlvbiBvd25lZCB0aGUgZXZlbnQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2NsaWNrKCBldmVudCApIHtcblx0XHRcdHZhciB0aW1lX3Nsb3RfbW9yZSA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXNsb3QtbW9yZV0nICk7XG5cdFx0XHR2YXIgZGV0YWlsc19hY3Rpb24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1kZXRhaWxzLWFjdGlvbl0nICk7XG5cdFx0XHR2YXIgYWNjZXNzb3J5ID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXRpbWVsaW5lLWJvb2tpbmctYWNjZXNzb3J5XScgKTtcblx0XHRcdHZhciBzZWxlY3Rpb25fY29udHJvbCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLXNlbGVjdF0nICk7XG5cdFx0XHR2YXIgY2FyZDtcblxuXHRcdFx0aWYgKCBpc19leHRlbnNpb25faW50ZXJhY3RpbmcoKSApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmICggdGltZV9zbG90X21vcmUgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHJldHVybiB0b2dnbGVfdGltZV9zbG90X292ZXJmbG93KCB0aW1lX3Nsb3RfbW9yZSApO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIGJvb2tpbmdfcmVzaXppbmdfY29udHJvbGxlciAmJiBib29raW5nX3Jlc2l6aW5nX2NvbnRyb2xsZXIuaGFuZGxlX2NsaWNrKCBldmVudCApICkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCBkZXRhaWxzX2FjdGlvbiApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0Y2FyZCA9IGdldF9ib29raW5nX2FjY2Vzc29yeV9jYXJkKCBkZXRhaWxzX2FjdGlvbiwgbnVsbCApO1xuXHRcdFx0XHRpZiAoIGNhcmQgJiYgYm9va2luZ19pbnNwZWN0b3JfYWRhcHRlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgYm9va2luZ19pbnNwZWN0b3JfYWRhcHRlci5vcGVuICkge1xuXHRcdFx0XHRcdGJvb2tpbmdfaW5zcGVjdG9yX2FkYXB0ZXIub3BlbiggY2FyZCApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIGFjY2Vzc29yeSApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHNlbGVjdGlvbl9jb250cm9sICkge1xuXHRcdFx0XHRzZWxlY3RfYm9va2luZ19zZWdtZW50KCBzZWxlY3Rpb25fY29udHJvbCApO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE5vdGlmeSBPdmVydmlldyBiZWZvcmUgVGltZWxpbmUgcmVwbGFjZXMgZXZlcnkgcmVuZGVyZWQgYm9va2luZyBjYXJkLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBiZWdpbl9yZWZyZXNoKCkge1xuXHRcdFx0aW52b2tlX2V4dGVuc2lvbl9tZXRob2QoICdiZWdpbl9yZWZyZXNoJywgW10gKTtcblx0XHRcdGNsb3NlX3RpbWVfc2xvdF9vdmVyZmxvdyggZmFsc2UgKTtcblx0XHRcdGlmICggYm9va2luZ19yZXNpemluZ19jb250cm9sbGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBib29raW5nX3Jlc2l6aW5nX2NvbnRyb2xsZXIuYmVnaW5fcmVmcmVzaCApIHtcblx0XHRcdFx0Ym9va2luZ19yZXNpemluZ19jb250cm9sbGVyLmJlZ2luX3JlZnJlc2goKTtcblx0XHRcdH1cblx0XHRcdGlmICggYm9va2luZ19vdmVydmlld190b29sdGlwX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRcdGJvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcF9jb250cm9sbGVyLnJlZnJlc2goKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWdpc3RlciBvbmUgZnJlc2hseSByZW5kZXJlZCBzZWdtZW50IHdpdGggQm9va2luZyBPdmVydmlldy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHNlZ21lbnRfZWxlbWVudCBSZW5kZXJlZCBjYW5vbmljYWwgc2VnbWVudC5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc2VnbWVudCBBdXRob3JpemVkIGNvbXBhY3QgYm9va2luZyBEVE8uXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJlc291cmNlX3N1bW1hcnkgQXV0aG9yaXplZCBSZXNvdXJjZSBzdW1tYXJ5LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVnaXN0ZXJfc2VnbWVudCggc2VnbWVudF9lbGVtZW50LCBzZWdtZW50LCByZXNvdXJjZV9zdW1tYXJ5ICkge1xuXHRcdFx0aW52b2tlX2V4dGVuc2lvbl9tZXRob2QoICdyZWdpc3Rlcl9zZWdtZW50JywgWyBzZWdtZW50X2VsZW1lbnQsIHNlZ21lbnQsIHJlc291cmNlX3N1bW1hcnkgfHwge30gXSApO1xuXHRcdFx0aWYgKCBib29raW5nX3Jlc2l6aW5nX2NvbnRyb2xsZXIgJiYgc2VnbWVudF9lbGVtZW50ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBib29raW5nX3Jlc2l6aW5nX2NvbnRyb2xsZXIucmVnaXN0ZXJfc2VnbWVudCApIHtcblx0XHRcdFx0Ym9va2luZ19yZXNpemluZ19jb250cm9sbGVyLnJlZ2lzdGVyX3NlZ21lbnQoIHNlZ21lbnRfZWxlbWVudCwgc2VnbWVudCApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIGJvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcF9jb250cm9sbGVyIHx8ICEgc2VnbWVudF9lbGVtZW50ICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRib29raW5nX292ZXJ2aWV3X3Rvb2x0aXBfY29udHJvbGxlci5yZWdpc3Rlcihcblx0XHRcdFx0c2VnbWVudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctb3ZlcnZpZXctaW5mby10cmlnZ2VyXScgKSxcblx0XHRcdFx0c2VnbWVudF9lbGVtZW50LFxuXHRcdFx0XHRzZWdtZW50LFxuXHRcdFx0XHRyZXNvdXJjZV9zdW1tYXJ5IHx8IHt9XG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEJlZ2luIG9uZSBmb2N1c2VkIHJlYWQtb25seSBwcm9qZWN0aW9uIHJlZnJlc2guXG5cdFx0ICpcblx0XHQgKiBUaGUgc2hhcmVkIGNvbnRyb2xsZXIgZm9yd2FyZHMgb25seSBhbiBleGVjdXRhYmxlLWZyZWUgcHJlc2VudGF0aW9uXG5cdFx0ICogaWRlbnRpdHkuIERvbWFpbiBleHRlbnNpb25zIG93biBjYWNoZSBpbnZhbGlkYXRpb24gYW5kIG5ldmVyIHJlY2VpdmVcblx0XHQgKiBhdXRob3JpdHkgZnJvbSByZW5kZXJlZCBtYXJrdXAuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmVmcmVzaF9jb250ZXh0IFByZXNlbnRhdGlvbi1vd25lZCBhY2NlcHRlZCBpZGVudGl0eS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGJlZ2luX3JlYWRfb25seV9yZWZyZXNoKCByZWZyZXNoX2NvbnRleHQgKSB7XG5cdFx0XHRpbnZva2VfZXh0ZW5zaW9uX21ldGhvZCggJ2JlZ2luX3JlYWRfb25seV9yZWZyZXNoJywgWyByZWZyZXNoX2NvbnRleHQgfHwge30gXSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlZ2lzdGVyIG9uZSByZWFkLW9ubHkgcHJvamVjdGlvbiBvZiBhbiBhY2NlcHRlZCBib29raW5nIHNlZ21lbnQuXG5cdFx0ICpcblx0XHQgKiBSZWFkLW9ubHkgcHJvamVjdGlvbnMgcmV1c2UgY2Fub25pY2FsIHNlbGVjdGlvbiwgT3ZlcnZpZXcsIGFuZCBJbnNwZWN0b3IuXG5cdFx0ICogRm9jdXNlZCBkb21haW4gZXh0ZW5zaW9ucyBtYXkgb2JzZXJ2ZSB0aGUgYWNjZXB0ZWQgY2Fub25pY2FsIHNlZ21lbnQgYW5kXG5cdFx0ICogcHJlc2VudGF0aW9uIGNvbnRleHQsIGJ1dCBtdXN0IGluZGVwZW5kZW50bHkgb2J0YWluIGZyZXNoIHNlcnZlciBhdXRob3JpdHlcblx0XHQgKiBiZWZvcmUgZXhwb3NpbmcgYW4gaW50ZXJhY3Rpb24uIFRoZSBzdXBwbGllZCBEVE8gaXMgbmV2ZXIgcmVjb25zdHJ1Y3RlZFxuXHRcdCAqIGZyb20gRE9NIGF0dHJpYnV0ZXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBzZWdtZW50X2VsZW1lbnQgUmVuZGVyZWQgcmVhZC1vbmx5IGJvb2tpbmcgcHJvamVjdGlvbi5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc2VnbWVudCBBY2NlcHRlZCBhdXRob3JpemVkIGJvb2tpbmcgc2VnbWVudCBEVE8uXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJlc291cmNlX3N1bW1hcnkgQWNjZXB0ZWQgYXV0aG9yaXplZCBSZXNvdXJjZSBzdW1tYXJ5LlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBwcmVzZW50YXRpb25fY29udGV4dCBQcmVzZW50YXRpb24tb25seSByZW5kZXIgYW5kIGJvdW5kYXJ5IGRhdGEuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZWdpc3Rlcl9yZWFkX29ubHlfc2VnbWVudCggc2VnbWVudF9lbGVtZW50LCBzZWdtZW50LCByZXNvdXJjZV9zdW1tYXJ5LCBwcmVzZW50YXRpb25fY29udGV4dCApIHtcblx0XHRcdGludm9rZV9leHRlbnNpb25fbWV0aG9kKCAncmVnaXN0ZXJfcmVhZF9vbmx5X3NlZ21lbnQnLCBbIHNlZ21lbnRfZWxlbWVudCwgc2VnbWVudCwgcmVzb3VyY2Vfc3VtbWFyeSB8fCB7fSwgcHJlc2VudGF0aW9uX2NvbnRleHQgfHwge30gXSApO1xuXHRcdFx0aWYgKCAhIGJvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcF9jb250cm9sbGVyIHx8ICEgc2VnbWVudF9lbGVtZW50ICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRib29raW5nX292ZXJ2aWV3X3Rvb2x0aXBfY29udHJvbGxlci5yZWdpc3Rlcihcblx0XHRcdFx0c2VnbWVudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctb3ZlcnZpZXctaW5mby10cmlnZ2VyXScgKSxcblx0XHRcdFx0c2VnbWVudF9lbGVtZW50LFxuXHRcdFx0XHRzZWdtZW50LFxuXHRcdFx0XHRyZXNvdXJjZV9zdW1tYXJ5IHx8IHt9XG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlY29uY2lsZSBjYW5vbmljYWwgcmVhZC1vbmx5IGJvb2tpbmcgcHJlc2VudGF0aW9uIGFmdGVyIGxvY2FsIHJlbmRlcmluZy5cblx0XHQgKlxuXHRcdCAqIFRoaXMgaW50ZW50aW9uYWxseSBleGNsdWRlcyByZXNpemUgYW5kIG1vdmVtZW50IHJlZnJlc2ggbGlmZWN5Y2xlcyBiZWNhdXNlXG5cdFx0ICogYSByZWFkLW9ubHkgcHJvamVjdGlvbiBtdXN0IG5ldmVyIGJlY29tZSBtdXRhdGlvbiBhdXRob3JpdHkuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNvbXBsZXRlX3JlYWRfb25seV9yZWZyZXNoKCByZWZyZXNoX2NvbnRleHQgKSB7XG5cdFx0XHRpZiAoIGJvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcF9jb250cm9sbGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBib29raW5nX292ZXJ2aWV3X3Rvb2x0aXBfY29udHJvbGxlci5jb21wbGV0ZV9yZWZyZXNoICkge1xuXHRcdFx0XHRib29raW5nX292ZXJ2aWV3X3Rvb2x0aXBfY29udHJvbGxlci5jb21wbGV0ZV9yZWZyZXNoKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGJvb2tpbmdfaW5zcGVjdG9yX2FkYXB0ZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGJvb2tpbmdfaW5zcGVjdG9yX2FkYXB0ZXIucmVmcmVzaCApIHtcblx0XHRcdFx0Ym9va2luZ19pbnNwZWN0b3JfYWRhcHRlci5yZWZyZXNoKCk7XG5cdFx0XHR9XG5cdFx0XHRzeW5jaHJvbml6ZV9ib29raW5nX3NlbGVjdGlvbigpO1xuXHRcdFx0aW52b2tlX2V4dGVuc2lvbl9tZXRob2QoICdjb21wbGV0ZV9yZWFkX29ubHlfcmVmcmVzaCcsIFsgcmVmcmVzaF9jb250ZXh0IHx8IHt9LCBib29raW5nX3NlbGVjdGlvbl9zdGF0ZSBdICk7XG5cdFx0XHRzY2hlZHVsZV9ib29raW5nX2NvbnRyb2xfcmFpbF9sYXlvdXQoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWNvbmNpbGUgYWRhcHRlcnMsIHNlbGVjdGlvbiwgYW5kIGdlb21ldHJ5IGFmdGVyIGJvb2tpbmcgcmVyZW5kZXIuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNvbXBsZXRlX3JlZnJlc2goKSB7XG5cdFx0XHRpZiAoIGJvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcF9jb250cm9sbGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBib29raW5nX292ZXJ2aWV3X3Rvb2x0aXBfY29udHJvbGxlci5jb21wbGV0ZV9yZWZyZXNoICkge1xuXHRcdFx0XHRib29raW5nX292ZXJ2aWV3X3Rvb2x0aXBfY29udHJvbGxlci5jb21wbGV0ZV9yZWZyZXNoKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGJvb2tpbmdfaW5zcGVjdG9yX2FkYXB0ZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGJvb2tpbmdfaW5zcGVjdG9yX2FkYXB0ZXIucmVmcmVzaCApIHtcblx0XHRcdFx0Ym9va2luZ19pbnNwZWN0b3JfYWRhcHRlci5yZWZyZXNoKCk7XG5cdFx0XHR9XG5cdFx0XHRzeW5jaHJvbml6ZV9ib29raW5nX3NlbGVjdGlvbigpO1xuXHRcdFx0aWYgKCBib29raW5nX3Jlc2l6aW5nX2NvbnRyb2xsZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGJvb2tpbmdfcmVzaXppbmdfY29udHJvbGxlci5jb21wbGV0ZV9yZWZyZXNoICkge1xuXHRcdFx0XHRib29raW5nX3Jlc2l6aW5nX2NvbnRyb2xsZXIuY29tcGxldGVfcmVmcmVzaCggYm9va2luZ19zZWxlY3Rpb25fc3RhdGUgKTtcblx0XHRcdH1cblx0XHRcdGludm9rZV9leHRlbnNpb25fbWV0aG9kKCAnY29tcGxldGVfcmVmcmVzaCcsIFsgYm9va2luZ19zZWxlY3Rpb25fc3RhdGUgXSApO1xuXHRcdFx0c2NoZWR1bGVfYm9va2luZ19jb250cm9sX3JhaWxfbGF5b3V0KCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3VzcGVuZCBvciByZXN1bWUgQm9va2luZyBPdmVydmlldyBkdXJpbmcgY2Fub25pY2FsIFRpbWVsaW5lIGxvYWRpbmcuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX2xvYWRpbmcgV2hldGhlciBmb3JlZ3JvdW5kIHJlcGxhY2VtZW50IGlzIGFjdGl2ZS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNldF9yZXF1ZXN0X2xvYWRpbmcoIGlzX2xvYWRpbmcgKSB7XG5cdFx0XHRpbnZva2VfZXh0ZW5zaW9uX21ldGhvZCggJ3NldF9yZXF1ZXN0X2xvYWRpbmcnLCBbIEJvb2xlYW4oIGlzX2xvYWRpbmcgKSBdICk7XG5cdFx0XHRpZiAoIGlzX2xvYWRpbmcgJiYgYm9va2luZ19vdmVydmlld190b29sdGlwX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRcdGJvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcF9jb250cm9sbGVyLnN1c3BlbmQoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIGlzX2xvYWRpbmcgJiYgYm9va2luZ19vdmVydmlld190b29sdGlwX2NvbnRyb2xsZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGJvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcF9jb250cm9sbGVyLnJlc3VtZSApIHtcblx0XHRcdFx0Ym9va2luZ19vdmVydmlld190b29sdGlwX2NvbnRyb2xsZXIucmVzdW1lKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQXR0YWNoIHRoZSBzZXR0bGVkIHJhaWwgZ2VvbWV0cnkgbGlmZWN5Y2xlIHRvIHRoZSBUaW1lbGluZSBheGlzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbml0aWFsaXplX2F4aXNfcmFpbF9saWZlY3ljbGUoKSB7XG5cdFx0XHRheGlzX3Njcm9sbF9jYW52YXMgPSBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1jYW52YXNdJyApO1xuXHRcdFx0aWYgKCAhIGF4aXNfc2Nyb2xsX2NhbnZhcyApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0YXhpc19zY3JvbGxfdXNlc19zY3JvbGxlbmQgPSAnb25zY3JvbGxlbmQnIGluIGF4aXNfc2Nyb2xsX2NhbnZhcztcblx0XHRcdGlmICggYXhpc19zY3JvbGxfdXNlc19zY3JvbGxlbmQgKSB7XG5cdFx0XHRcdGF4aXNfc2Nyb2xsX2NhbnZhcy5hZGRFdmVudExpc3RlbmVyKCAnc2Nyb2xsZW5kJywgc2NoZWR1bGVfYm9va2luZ19jb250cm9sX3JhaWxfbGF5b3V0LCB7IHBhc3NpdmU6IHRydWUgfSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXhpc19zY3JvbGxfY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoICdzY3JvbGwnLCBzY2hlZHVsZV9ib29raW5nX2NvbnRyb2xfcmFpbF9sYXlvdXRfYWZ0ZXJfYXhpc19tb3Rpb24sIHsgcGFzc2l2ZTogdHJ1ZSB9ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHdpbmRvdy52aXN1YWxWaWV3cG9ydCApIHtcblx0XHRcdFx0d2luZG93LnZpc3VhbFZpZXdwb3J0LmFkZEV2ZW50TGlzdGVuZXIoICdyZXNpemUnLCBzY2hlZHVsZV9ib29raW5nX2NvbnRyb2xfcmFpbF9sYXlvdXQsIHsgcGFzc2l2ZTogdHJ1ZSB9ICk7XG5cdFx0XHRcdHdpbmRvdy52aXN1YWxWaWV3cG9ydC5hZGRFdmVudExpc3RlbmVyKCAnc2Nyb2xsJywgc2NoZWR1bGVfYm9va2luZ19jb250cm9sX3JhaWxfbGF5b3V0LCB7IHBhc3NpdmU6IHRydWUgfSApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbW92ZSBheGlzIGFuZCB2aWV3cG9ydCBsaXN0ZW5lcnMgb3duZWQgYnkgYm9va2luZyBnZW9tZXRyeS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZGVzdHJveV9heGlzX3JhaWxfbGlmZWN5Y2xlKCkge1xuXHRcdFx0aWYgKCBheGlzX3Njcm9sbF9jYW52YXMgKSB7XG5cdFx0XHRcdGlmICggYXhpc19zY3JvbGxfdXNlc19zY3JvbGxlbmQgKSB7XG5cdFx0XHRcdFx0YXhpc19zY3JvbGxfY2FudmFzLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdzY3JvbGxlbmQnLCBzY2hlZHVsZV9ib29raW5nX2NvbnRyb2xfcmFpbF9sYXlvdXQgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRheGlzX3Njcm9sbF9jYW52YXMucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3Njcm9sbCcsIHNjaGVkdWxlX2Jvb2tpbmdfY29udHJvbF9yYWlsX2xheW91dF9hZnRlcl9heGlzX21vdGlvbiApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHdpbmRvdy52aXN1YWxWaWV3cG9ydCApIHtcblx0XHRcdFx0d2luZG93LnZpc3VhbFZpZXdwb3J0LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdyZXNpemUnLCBzY2hlZHVsZV9ib29raW5nX2NvbnRyb2xfcmFpbF9sYXlvdXQgKTtcblx0XHRcdFx0d2luZG93LnZpc3VhbFZpZXdwb3J0LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdzY3JvbGwnLCBzY2hlZHVsZV9ib29raW5nX2NvbnRyb2xfcmFpbF9sYXlvdXQgKTtcblx0XHRcdH1cblx0XHRcdGF4aXNfc2Nyb2xsX2NhbnZhcyA9IG51bGw7XG5cdFx0XHRheGlzX3Njcm9sbF91c2VzX3Njcm9sbGVuZCA9IGZhbHNlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEluaXRpYWxpemUgYWRhcHRlcnMsIGNhbm9uaWNhbCByZWZyZXNoIGxpc3RlbmVyLCBhbmQgcmFpbCBsaWZlY3ljbGUgb25jZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaW5pdGlhbGl6ZSgpIHtcblx0XHRcdGlmICggISBtb3VudCB8fCBpc19pbml0aWFsaXplZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aXNfaW5pdGlhbGl6ZWQgPSB0cnVlO1xuXHRcdFx0aW5pdGlhbGl6ZV9ib29raW5nX2luc3BlY3RvcigpO1xuXHRcdFx0aW5pdGlhbGl6ZV9ib29raW5nX3Jlc2l6aW5nKCk7XG5cdFx0XHRpbml0aWFsaXplX2Jvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcCgpO1xuXHRcdFx0aW5pdGlhbGl6ZV9leHRlbnNpb25zKCk7XG5cdFx0XHRpbml0aWFsaXplX2F4aXNfcmFpbF9saWZlY3ljbGUoKTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOmJvb2tpbmctaW5zcGVjdG9yOnNhdmVkJywgaGFuZGxlX2Jvb2tpbmdfaW5zcGVjdG9yX3NhdmVkICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRGVzdHJveSBhZGFwdGVycywgbGlzdGVuZXJzLCBmcmFtZXMsIHRpbWVycywgYW5kIGJyb3dzZXItb25seSBzdGF0ZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZGVzdHJveSgpIHtcblx0XHRcdGlmICggISBpc19pbml0aWFsaXplZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3dwYmM6Ym9va2luZy1pbnNwZWN0b3I6c2F2ZWQnLCBoYW5kbGVfYm9va2luZ19pbnNwZWN0b3Jfc2F2ZWQgKTtcblx0XHRcdGNsb3NlX3RpbWVfc2xvdF9vdmVyZmxvdyggZmFsc2UgKTtcblx0XHRcdGRlc3Ryb3lfZXh0ZW5zaW9ucygpO1xuXHRcdFx0cmVzdW1lX2Jvb2tpbmdfb3ZlcmZsb3dfdG9vbHRpcHMoKTtcblx0XHRcdGRlc3Ryb3lfYXhpc19yYWlsX2xpZmVjeWNsZSgpO1xuXHRcdFx0aWYgKCBib29raW5nX2NvbnRyb2xfcmFpbF9zZXR0bGVfdGltZXIgKSB7XG5cdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIGJvb2tpbmdfY29udHJvbF9yYWlsX3NldHRsZV90aW1lciApO1xuXHRcdFx0XHRib29raW5nX2NvbnRyb2xfcmFpbF9zZXR0bGVfdGltZXIgPSAwO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBib29raW5nX2NvbnRyb2xfcmFpbF9mcmFtZSApIHtcblx0XHRcdFx0d2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lKCBib29raW5nX2NvbnRyb2xfcmFpbF9mcmFtZSApO1xuXHRcdFx0XHRib29raW5nX2NvbnRyb2xfcmFpbF9mcmFtZSA9IDA7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGJvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcF9jb250cm9sbGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBib29raW5nX292ZXJ2aWV3X3Rvb2x0aXBfY29udHJvbGxlci5kZXN0cm95ICkge1xuXHRcdFx0XHRib29raW5nX292ZXJ2aWV3X3Rvb2x0aXBfY29udHJvbGxlci5kZXN0cm95KCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGJvb2tpbmdfcmVzaXppbmdfY29udHJvbGxlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgYm9va2luZ19yZXNpemluZ19jb250cm9sbGVyLmRlc3Ryb3kgKSB7XG5cdFx0XHRcdGJvb2tpbmdfcmVzaXppbmdfY29udHJvbGxlci5kZXN0cm95KCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGJvb2tpbmdfaW5zcGVjdG9yX2FkYXB0ZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGJvb2tpbmdfaW5zcGVjdG9yX2FkYXB0ZXIuZGVzdHJveSApIHtcblx0XHRcdFx0Ym9va2luZ19pbnNwZWN0b3JfYWRhcHRlci5kZXN0cm95KCk7XG5cdFx0XHR9XG5cdFx0XHRib29raW5nX292ZXJ2aWV3X3Rvb2x0aXBfY29udHJvbGxlciA9IG51bGw7XG5cdFx0XHRib29raW5nX3Jlc2l6aW5nX2NvbnRyb2xsZXIgPSBudWxsO1xuXHRcdFx0Ym9va2luZ19pbnNwZWN0b3JfYWRhcHRlciA9IG51bGw7XG5cdFx0XHRib29raW5nX3NlbGVjdGlvbl9zdGF0ZSA9IGNyZWF0ZV9lbXB0eV9ib29raW5nX3NlbGVjdGlvbl9zdGF0ZSgpO1xuXHRcdFx0Ym9va2luZ19pbnNwZWN0b3JfcmVmcmVzaF9nZW5lcmF0aW9uID0gMDtcblx0XHRcdGlzX2luaXRpYWxpemVkID0gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGluaXRpYWxpemU6IGluaXRpYWxpemUsXG5cdFx0XHRkZXN0cm95OiBkZXN0cm95LFxuXHRcdFx0aGFuZGxlX2NsaWNrOiBoYW5kbGVfY2xpY2ssXG5cdFx0XHRoYW5kbGVfa2V5ZG93bjogaGFuZGxlX2tleWRvd24sXG5cdFx0XHRiZWdpbl9yZWZyZXNoOiBiZWdpbl9yZWZyZXNoLFxuXHRcdFx0cmVnaXN0ZXJfc2VnbWVudDogcmVnaXN0ZXJfc2VnbWVudCxcblx0XHRcdGJlZ2luX3JlYWRfb25seV9yZWZyZXNoOiBiZWdpbl9yZWFkX29ubHlfcmVmcmVzaCxcblx0XHRcdHJlZ2lzdGVyX3JlYWRfb25seV9zZWdtZW50OiByZWdpc3Rlcl9yZWFkX29ubHlfc2VnbWVudCxcblx0XHRcdGNvbXBsZXRlX3JlZnJlc2g6IGNvbXBsZXRlX3JlZnJlc2gsXG5cdFx0XHRjb21wbGV0ZV9yZWFkX29ubHlfcmVmcmVzaDogY29tcGxldGVfcmVhZF9vbmx5X3JlZnJlc2gsXG5cdFx0XHRzZXRfcmVxdWVzdF9sb2FkaW5nOiBzZXRfcmVxdWVzdF9sb2FkaW5nLFxuXHRcdFx0cHJlcGFyZV9jcmVhdGVkX2Jvb2tpbmdfcmVhZGJhY2s6IHByZXBhcmVfY3JlYXRlZF9ib29raW5nX3JlYWRiYWNrLFxuXHRcdFx0Y29tcGxldGVfY3JlYXRlZF9ib29raW5nX3JlYWRiYWNrOiBjb21wbGV0ZV9jcmVhdGVkX2Jvb2tpbmdfcmVhZGJhY2ssXG5cdFx0XHRvcGVuX2NyZWF0ZWRfYm9va2luZ19pbnNwZWN0b3I6IG9wZW5fY3JlYXRlZF9ib29raW5nX2luc3BlY3Rvcixcblx0XHRcdGZvY3VzX2NyZWF0ZWRfYm9va2luZzogZm9jdXNfY3JlYXRlZF9ib29raW5nLFxuXHRcdFx0c2NoZWR1bGVfbGF5b3V0OiBzY2hlZHVsZV9ib29raW5nX2NvbnRyb2xfcmFpbF9sYXlvdXQsXG5cdFx0XHRzY2hlZHVsZV9sYXlvdXRfYWZ0ZXJfYXhpc19tb3Rpb246IHNjaGVkdWxlX2Jvb2tpbmdfY29udHJvbF9yYWlsX2xheW91dF9hZnRlcl9heGlzX21vdGlvbixcblx0XHRcdGlzX292ZXJ2aWV3X3N1cHByZXNzZWQ6IGlzX2Jvb2tpbmdfb3ZlcnZpZXdfdG9vbHRpcF9zdXBwcmVzc2VkXG5cdFx0fTtcblx0fVxuXG5cdGlmICggd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcy5yZWdpc3Rlcl9mYWN0b3J5ICkge1xuXHRcdHdpbmRvdy53cGJjX3RpbWVsaW5lX21vZHVsZXMucmVnaXN0ZXJfZmFjdG9yeSggbW9kdWxlX2lkLCBjcmVhdGVfYm9va2luZ19pbnRlcmFjdGlvbnNfY29udHJvbGxlciApO1xuXHR9XG59KCB3aW5kb3csIGRvY3VtZW50ICkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0UsV0FBV0EsTUFBTSxFQUFFQyxRQUFRLEVBQUc7RUFDL0IsWUFBWTs7RUFFWixJQUFJQyxTQUFTLEdBQUcsc0JBQXNCO0VBQ3RDLElBQUlDLG1CQUFtQixHQUFHLEVBQUU7O0VBRTVCO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0MsMEJBQTBCQSxDQUFFQyxpQkFBaUIsRUFBRztJQUN4RCxJQUFLLFVBQVUsS0FBSyxP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MkJBQTJCLElBQUksVUFBVSxLQUFLLE9BQU9BLDJCQUEyQixDQUFDNkQsT0FBTyxFQUFHO1FBQy9GN0QsMkJBQTJCLENBQUM2RCxPQUFPLENBQUMsQ0FBQztNQUN0QztNQUNBLElBQUsvRCx5QkFBeUIsSUFBSSxVQUFVLEtBQUssT0FBT0EseUJBQXlCLENBQUMrRCxPQUFPLEVBQUc7UUFDM0YvRCx5QkFBeUIsQ0FBQytELE9BQU8sQ0FBQyxDQUFDO01BQ3BDO01BQ0E5RCxtQ0FBbUMsR0FBRyxJQUFJO01BQzFDQywyQkFBMkIsR0FBRyxJQUFJO01BQ2xDRix5QkFBeUIsR0FBRyxJQUFJO01BQ2hDSyx1QkFBdUIsR0FBR0Msb0NBQW9DLENBQUMsQ0FBQztNQUNoRUMsb0NBQW9DLEdBQUcsQ0FBQztNQUN4Q1EsY0FBYyxHQUFHLEtBQUs7SUFDdkI7SUFFQSxPQUFPO01BQ04rQyxVQUFVLEVBQUVBLFVBQVU7TUFDdEJDLE9BQU8sRUFBRUEsT0FBTztNQUNoQmtQLFlBQVksRUFBRUEsWUFBWTtNQUMxQkwsY0FBYyxFQUFFQSxjQUFjO01BQzlCTyxhQUFhLEVBQUVBLGFBQWE7TUFDNUJFLGdCQUFnQixFQUFFQSxnQkFBZ0I7TUFDbENJLHVCQUF1QixFQUFFQSx1QkFBdUI7TUFDaERFLDBCQUEwQixFQUFFQSwwQkFBMEI7TUFDdERHLGdCQUFnQixFQUFFQSxnQkFBZ0I7TUFDbENELDBCQUEwQixFQUFFQSwwQkFBMEI7TUFDdERFLG1CQUFtQixFQUFFQSxtQkFBbUI7TUFDeEN4SyxnQ0FBZ0MsRUFBRUEsZ0NBQWdDO01BQ2xFQyxpQ0FBaUMsRUFBRUEsaUNBQWlDO01BQ3BFQyw4QkFBOEIsRUFBRUEsOEJBQThCO01BQzlEQyxxQkFBcUIsRUFBRUEscUJBQXFCO01BQzVDOUYsZUFBZSxFQUFFQyxvQ0FBb0M7TUFDckRzUSxpQ0FBaUMsRUFBRWxFLHNEQUFzRDtNQUN6Rm1FLHNCQUFzQixFQUFFekM7SUFDekIsQ0FBQztFQUNGO0VBRUEsSUFBS3hTLE1BQU0sQ0FBQ2tWLHFCQUFxQixJQUFJLFVBQVUsS0FBSyxPQUFPbFYsTUFBTSxDQUFDa1YscUJBQXFCLENBQUNDLGdCQUFnQixFQUFHO0lBQzFHblYsTUFBTSxDQUFDa1YscUJBQXFCLENBQUNDLGdCQUFnQixDQUFFalYsU0FBUyxFQUFFTyxzQ0FBdUMsQ0FBQztFQUNuRztBQUNELENBQUMsRUFBRVQsTUFBTSxFQUFFQyxRQUFTLENBQUMiLCJpZ25vcmVMaXN0IjpbXX0=
