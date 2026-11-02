"use strict";

/**
 * Domain-neutral shared administration date-jump interactions.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
(function (window, document, $) {
  'use strict';

  var root_selector = '[data-wpbc-shared-ui-date-jump]';
  var input_selector = '[data-wpbc-shared-ui-date-jump-input]';
  var toggle_selector = '[data-wpbc-shared-ui-date-jump-toggle]';
  var datepick_marker_attribute = 'data-wpbc-shared-ui-date-jump-datepick';
  var datepick_owner_attribute = 'data-wpbc-shared-ui-date-jump-owner';
  var component_state_key = 'wpbc_shared_ui_date_jump_state';

  /**
   * Parse one strict ISO calendar date without timezone conversion.
   *
   * @param {string} date_value Candidate YYYY-MM-DD value.
   * @return {Date|null} Local Date instance or null.
   */
  function parse_iso_date(date_value) {
    var match = String(date_value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    var parsed_date;
    if (!match) {
      return null;
    }
    parsed_date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (parsed_date.getFullYear() !== Number(match[1]) || parsed_date.getMonth() !== Number(match[2]) - 1 || parsed_date.getDate() !== Number(match[3])) {
      return null;
    }
    return parsed_date;
  }

  /**
   * Return the single popup owned by the bundled Booking Calendar datepicker.
   *
   * @return {jQuery} Datepicker popup, or an empty jQuery collection.
   */
  function get_datepick_popup() {
    if ($.datepick && $.datepick.dpDiv && $.datepick.dpDiv.length) {
      return $.datepick.dpDiv;
    }
    return $('#datepick-div').first();
  }

  /**
   * Return private interaction state for one rendered component.
   *
   * @param {HTMLElement} root Component root.
   * @return {Object} Mutable component-local state.
   */
  function get_component_state(root) {
    var state = $.data(root, component_state_key);
    if (!state) {
      state = {
        pending_selected_date: '',
        position_frame: 0,
        restore_toggle_focus: false,
        was_open_on_pointer_down: false
      };
      $.data(root, component_state_key, state);
    }
    return state;
  }

  /**
   * Determine whether the shared singleton datepicker is open for one input.
   *
   * @param {HTMLElement} input Date input.
   * @return {boolean} True when the popup is open for the supplied input.
   */
  function is_datepicker_open_for_input(input) {
    var current_instance = $.datepick ? $.datepick._curInst : null;
    var current_input = current_instance && current_instance.input ? current_instance.input[0] : null;
    return Boolean($.datepick && $.datepick._datepickerShowing && current_input === input);
  }

  /**
   * Read one pixel-valued component token with a safe numeric fallback.
   *
   * @param {HTMLElement} root           Component root.
   * @param {string}      property_name  CSS custom property name.
   * @param {number}      fallback_value Value used when the token is unavailable.
   * @return {number} Parsed non-negative pixel value.
   */
  function get_pixel_token(root, property_name, fallback_value) {
    var parsed_value = parseFloat(window.getComputedStyle(root).getPropertyValue(property_name));
    return Number.isFinite(parsed_value) && parsed_value >= 0 ? parsed_value : fallback_value;
  }

  /**
   * Position the portaled datepicker against the visible disclosure button.
   *
   * The bundled datepicker normally anchors itself to its associated input.
   * This component keeps that input visually hidden, so the visible toggle is
   * the stable interaction and placement anchor instead.
   *
   * @param {HTMLElement} root Component root.
   * @return {void}
   */
  function position_datepick_popup(root) {
    var toggle = root.querySelector(toggle_selector);
    var $popup = get_datepick_popup();
    var popup = $popup[0];
    var toggle_rectangle;
    var popup_rectangle;
    var viewport_width;
    var viewport_height;
    var scroll_x;
    var scroll_y;
    var viewport_gutter;
    var popup_gap;
    var minimum_left;
    var maximum_left;
    var left;
    var below;
    var above;
    var top;
    var is_rtl;
    if (!toggle || !popup || !root.classList.contains('is-open') || !is_datepicker_open_for_input(root.querySelector(input_selector))) {
      return;
    }
    toggle_rectangle = toggle.getBoundingClientRect();
    popup_rectangle = popup.getBoundingClientRect();
    viewport_width = document.documentElement.clientWidth || window.innerWidth;
    viewport_height = document.documentElement.clientHeight || window.innerHeight;
    scroll_x = window.pageXOffset || document.documentElement.scrollLeft || 0;
    scroll_y = window.pageYOffset || document.documentElement.scrollTop || 0;
    viewport_gutter = get_pixel_token(root, '--wpbc_shared_ui_date_jump__viewport-edge-gap', 8);
    popup_gap = get_pixel_token(root, '--wpbc_shared_ui_date_jump__popup-gap', 6);
    minimum_left = scroll_x + viewport_gutter;
    maximum_left = Math.max(minimum_left, scroll_x + viewport_width - popup_rectangle.width - viewport_gutter);
    is_rtl = 'rtl' === window.getComputedStyle(root).direction;
    left = is_rtl ? toggle_rectangle.left + scroll_x : toggle_rectangle.right + scroll_x - popup_rectangle.width;
    left = Math.min(Math.max(left, minimum_left), maximum_left);
    below = toggle_rectangle.bottom + scroll_y + popup_gap;
    above = toggle_rectangle.top + scroll_y - popup_rectangle.height - popup_gap;
    top = below;
    if (below + popup_rectangle.height > scroll_y + viewport_height - viewport_gutter && above >= scroll_y + viewport_gutter) {
      top = above;
    }
    $popup.css({
      left: Math.round(left) + 'px',
      position: 'absolute',
      top: Math.round(Math.max(scroll_y + viewport_gutter, top)) + 'px'
    });
  }

  /**
   * Schedule one placement pass after datepicker rendering or viewport movement.
   *
   * @param {HTMLElement} root Component root.
   * @return {void}
   */
  function schedule_datepick_position(root) {
    var state = get_component_state(root);
    var request_frame = window.requestAnimationFrame || function (callback) {
      return window.setTimeout(callback, 16);
    };
    if (state.position_frame) {
      return;
    }
    state.position_frame = request_frame(function () {
      state.position_frame = 0;
      position_datepick_popup(root);
    });
  }

  /**
   * Cancel a pending placement pass for a closing component.
   *
   * @param {HTMLElement} root Component root.
   * @return {void}
   */
  function cancel_datepick_position(root) {
    var state = get_component_state(root);
    var cancel_frame = window.cancelAnimationFrame || window.clearTimeout;
    if (state.position_frame) {
      cancel_frame.call(window, state.position_frame);
      state.position_frame = 0;
    }
  }

  /**
   * Mark the shared singleton datepicker as owned by this component.
   *
   * @param {HTMLElement} root Component root.
   * @return {void}
   */
  function mark_datepick_popup(root) {
    get_datepick_popup().attr(datepick_marker_attribute, 'true').attr(datepick_owner_attribute, root.getAttribute('data-wpbc-shared-ui-date-jump') || '');
  }

  /**
   * Release the singleton datepicker marker only when this component owns it.
   *
   * @param {HTMLElement} root Component root.
   * @return {void}
   */
  function unmark_datepick_popup(root) {
    var owner_id = root.getAttribute('data-wpbc-shared-ui-date-jump') || '';
    get_datepick_popup().each(function () {
      var $popup = $(this);
      if (owner_id === $popup.attr(datepick_owner_attribute)) {
        $popup.removeAttr(datepick_owner_attribute).removeAttr(datepick_marker_attribute);
      }
    });
  }

  /**
   * Dispatch one neutral bubbling component event.
   *
   * @param {HTMLElement} root         Component root.
   * @param {string}      event_name   Custom event name.
   * @param {Object}      event_detail Scalar event values.
   * @return {void}
   */
  function dispatch_component_event(root, event_name, event_detail) {
    var component_event;
    if ('function' === typeof window.CustomEvent) {
      component_event = new window.CustomEvent(event_name, {
        bubbles: true,
        detail: event_detail
      });
    } else {
      component_event = document.createEvent('CustomEvent');
      component_event.initCustomEvent(event_name, true, false, event_detail);
    }
    root.dispatchEvent(component_event);
  }

  /**
   * Open an initialized standard datepicker for the component input.
   *
   * @param {HTMLElement} input Date input.
   * @param {HTMLElement} root  Component root.
   * @return {void}
   */
  function show_datepicker(input, root) {
    var state;
    if (!input || !$.datepick || !$.datepick._showDatepick || !$(input).hasClass($.datepick.markerClassName)) {
      return;
    }
    state = get_component_state(root);
    if (state.was_open_on_pointer_down || is_datepicker_open_for_input(input)) {
      state.was_open_on_pointer_down = false;
      state.restore_toggle_focus = true;
      if ($.datepick._datepickerShowing) {
        $.datepick._hideDatepick(null, '');
      }
      return;
    }
    state.was_open_on_pointer_down = false;
    if ($.datepick._datepickerShowing && $.datepick._hideDatepick) {
      $.datepick._hideDatepick(null, '');
    }
    if ($.datepick._lastInput === input) {
      $.datepick._lastInput = null;
    }
    state.restore_toggle_focus = true;
    $.datepick._showDatepick(input);
    position_datepick_popup(root);
    schedule_datepick_position(root);
  }

  /**
   * Initialize the standard datepicker for one date-jump component.
   *
   * @param {HTMLElement} root Component root.
   * @return {boolean} True when this call initialized the component.
   */
  function initialize_datepicker(root) {
    var input = root.querySelector(input_selector);
    var toggle = root.querySelector(toggle_selector);
    var first_day = Math.max(0, Math.min(6, Number(root.getAttribute('data-first-day')) || 0));
    var state;
    if (!input || !toggle || !$.fn.datepick || root.hasAttribute('data-datepick-initialized')) {
      return false;
    }
    root.setAttribute('data-datepick-initialized', 'true');
    state = get_component_state(root);
    $(input).datepick({
      beforeShow: function () {
        root.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
        mark_datepick_popup(root);
      },
      beforeShowDay: function () {
        return [true, 'date_available'];
      },
      onSelect: function (selected_date) {
        var selected_value = String(selected_date || '').split(/\s+-\s+|,\s*/)[0];
        if (!parse_iso_date(selected_value)) {
          return;
        }
        input.value = selected_value;
        root.setAttribute('data-selected-date', selected_value);
        state.pending_selected_date = selected_value;
        state.restore_toggle_focus = true;
      },
      onClose: function () {
        cancel_datepick_position(root);
        root.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        window.setTimeout(function () {
          var selected_value = state.pending_selected_date;
          unmark_datepick_popup(root);
          if (state.restore_toggle_focus && document.documentElement.contains(toggle)) {
            state.restore_toggle_focus = false;
            toggle.focus();
          }
          if (selected_value) {
            state.pending_selected_date = '';
            dispatch_component_event(root, 'wpbc:shared-ui-date-jump-select', {
              id: root.getAttribute('data-wpbc-shared-ui-date-jump') || '',
              date: selected_value
            });
          }
        }, 0);
      },
      showOn: 'focus',
      showAnim: 'show',
      duration: '',
      multiSelect: 0,
      numberOfMonths: 1,
      stepMonths: 1,
      prevText: '&lsaquo;',
      nextText: '&rsaquo;',
      dateFormat: 'yy-mm-dd',
      changeMonth: false,
      changeYear: false,
      minDate: null,
      maxDate: null,
      showStatus: false,
      multiSeparator: ', ',
      closeAtTop: null,
      firstDay: first_day,
      gotoCurrent: false,
      hideIfNoPrevNext: true,
      useThemeRoller: false,
      mandatory: true
    });
    return true;
  }

  /**
   * Preserve pre-activation state before the datepicker outside-click handler.
   *
   * The bundled datepicker closes portaled popups during mousedown. Recording
   * the prior state lets a second disclosure activation remain a true close
   * instead of closing on mousedown and reopening during the following click.
   *
   * @param {MouseEvent} event Capturing mousedown event.
   * @return {void}
   */
  function handle_pointer_down(event) {
    var toggle = event.target.closest ? event.target.closest(toggle_selector) : null;
    var root = toggle ? toggle.closest(root_selector) : null;
    var input = root ? root.querySelector(input_selector) : null;
    if (root && input) {
      get_component_state(root).was_open_on_pointer_down = is_datepicker_open_for_input(input);
    }
  }

  /**
   * Handle the split action and datepicker toggle through delegation.
   *
   * @param {MouseEvent} event Browser click event.
   * @return {void}
   */
  function handle_click(event) {
    var action = event.target.closest('[data-wpbc-shared-ui-date-jump-action]');
    var toggle = event.target.closest(toggle_selector);
    var root = action || toggle ? event.target.closest(root_selector) : null;
    var input;
    if (!root) {
      return;
    }
    if (action) {
      dispatch_component_event(root, 'wpbc:shared-ui-date-jump-action', {
        id: root.getAttribute('data-wpbc-shared-ui-date-jump') || ''
      });
      return;
    }
    initialize_datepicker(root);
    input = root.querySelector(input_selector);
    if (input && $.datepick && $(input).hasClass($.datepick.markerClassName)) {
      show_datepicker(input, root);
    }
  }

  /**
   * Keep an open portaled datepicker attached to its visible disclosure.
   *
   * @return {void}
   */
  function handle_viewport_change() {
    Array.prototype.forEach.call(document.querySelectorAll(root_selector + '.is-open'), function (root) {
      schedule_datepick_position(root);
    });
  }
  document.addEventListener('mousedown', handle_pointer_down, true);
  document.addEventListener('click', handle_click);
  document.addEventListener('scroll', handle_viewport_change, true);
  window.addEventListener('resize', handle_viewport_change);
})(window, document, window.jQuery);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvX3NoYXJlZF91aS9kYXRlLWp1bXAvX291dC9kYXRlLWp1bXAuanMiLCJuYW1lcyI6WyJ3aW5kb3ciLCJkb2N1bWVudCIsIiQiLCJyb290X3NlbGVjdG9yIiwiaW5wdXRfc2VsZWN0b3IiLCJ0b2dnbGVfc2VsZWN0b3IiLCJkYXRlcGlja19tYXJrZXJfYXR0cmlidXRlIiwiZGF0ZXBpY2tfb3duZXJfYXR0cmlidXRlIiwiY29tcG9uZW50X3N0YXRlX2tleSIsInBhcnNlX2lzb19kYXRlIiwiZGF0ZV92YWx1ZSIsIm1hdGNoIiwiU3RyaW5nIiwicGFyc2VkX2RhdGUiLCJEYXRlIiwiTnVtYmVyIiwiZ2V0RnVsbFllYXIiLCJnZXRNb250aCIsImdldERhdGUiLCJnZXRfZGF0ZXBpY2tfcG9wdXAiLCJkYXRlcGljayIsImRwRGl2IiwibGVuZ3RoIiwiZmlyc3QiLCJnZXRfY29tcG9uZW50X3N0YXRlIiwicm9vdCIsInN0YXRlIiwiZGF0YSIsInBlbmRpbmdfc2VsZWN0ZWRfZGF0ZSIsInBvc2l0aW9uX2ZyYW1lIiwicmVzdG9yZV90b2dnbGVfZm9jdXMiLCJ3YXNfb3Blbl9vbl9wb2ludGVyX2Rvd24iLCJpc19kYXRlcGlja2VyX29wZW5fZm9yX2lucHV0IiwiaW5wdXQiLCJjdXJyZW50X2luc3RhbmNlIiwiX2N1ckluc3QiLCJjdXJyZW50X2lucHV0IiwiQm9vbGVhbiIsIl9kYXRlcGlja2VyU2hvd2luZyIsImdldF9waXhlbF90b2tlbiIsInByb3BlcnR5X25hbWUiLCJmYWxsYmFja192YWx1ZSIsInBhcnNlZF92YWx1ZSIsInBhcnNlRmxvYXQiLCJnZXRDb21wdXRlZFN0eWxlIiwiZ2V0UHJvcGVydHlWYWx1ZSIsImlzRmluaXRlIiwicG9zaXRpb25fZGF0ZXBpY2tfcG9wdXAiLCJ0b2dnbGUiLCJxdWVyeVNlbGVjdG9yIiwiJHBvcHVwIiwicG9wdXAiLCJ0b2dnbGVfcmVjdGFuZ2xlIiwicG9wdXBfcmVjdGFuZ2xlIiwidmlld3BvcnRfd2lkdGgiLCJ2aWV3cG9ydF9oZWlnaHQiLCJzY3JvbGxfeCIsInNjcm9sbF95Iiwidmlld3BvcnRfZ3V0dGVyIiwicG9wdXBfZ2FwIiwibWluaW11bV9sZWZ0IiwibWF4aW11bV9sZWZ0IiwibGVmdCIsImJlbG93IiwiYWJvdmUiLCJ0b3AiLCJpc19ydGwiLCJjbGFzc0xpc3QiLCJjb250YWlucyIsImdldEJvdW5kaW5nQ2xpZW50UmVjdCIsImRvY3VtZW50RWxlbWVudCIsImNsaWVudFdpZHRoIiwiaW5uZXJXaWR0aCIsImNsaWVudEhlaWdodCIsImlubmVySGVpZ2h0IiwicGFnZVhPZmZzZXQiLCJzY3JvbGxMZWZ0IiwicGFnZVlPZmZzZXQiLCJzY3JvbGxUb3AiLCJNYXRoIiwibWF4Iiwid2lkdGgiLCJkaXJlY3Rpb24iLCJyaWdodCIsIm1pbiIsImJvdHRvbSIsImhlaWdodCIsImNzcyIsInJvdW5kIiwicG9zaXRpb24iLCJzY2hlZHVsZV9kYXRlcGlja19wb3NpdGlvbiIsInJlcXVlc3RfZnJhbWUiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJjYWxsYmFjayIsInNldFRpbWVvdXQiLCJjYW5jZWxfZGF0ZXBpY2tfcG9zaXRpb24iLCJjYW5jZWxfZnJhbWUiLCJjYW5jZWxBbmltYXRpb25GcmFtZSIsImNsZWFyVGltZW91dCIsImNhbGwiLCJtYXJrX2RhdGVwaWNrX3BvcHVwIiwiYXR0ciIsImdldEF0dHJpYnV0ZSIsInVubWFya19kYXRlcGlja19wb3B1cCIsIm93bmVyX2lkIiwiZWFjaCIsInJlbW92ZUF0dHIiLCJkaXNwYXRjaF9jb21wb25lbnRfZXZlbnQiLCJldmVudF9uYW1lIiwiZXZlbnRfZGV0YWlsIiwiY29tcG9uZW50X2V2ZW50IiwiQ3VzdG9tRXZlbnQiLCJidWJibGVzIiwiZGV0YWlsIiwiY3JlYXRlRXZlbnQiLCJpbml0Q3VzdG9tRXZlbnQiLCJkaXNwYXRjaEV2ZW50Iiwic2hvd19kYXRlcGlja2VyIiwiX3Nob3dEYXRlcGljayIsImhhc0NsYXNzIiwibWFya2VyQ2xhc3NOYW1lIiwiX2hpZGVEYXRlcGljayIsIl9sYXN0SW5wdXQiLCJpbml0aWFsaXplX2RhdGVwaWNrZXIiLCJmaXJzdF9kYXkiLCJmbiIsImhhc0F0dHJpYnV0ZSIsInNldEF0dHJpYnV0ZSIsImJlZm9yZVNob3ciLCJhZGQiLCJiZWZvcmVTaG93RGF5Iiwib25TZWxlY3QiLCJzZWxlY3RlZF9kYXRlIiwic2VsZWN0ZWRfdmFsdWUiLCJzcGxpdCIsInZhbHVlIiwib25DbG9zZSIsInJlbW92ZSIsImZvY3VzIiwiaWQiLCJkYXRlIiwic2hvd09uIiwic2hvd0FuaW0iLCJkdXJhdGlvbiIsIm11bHRpU2VsZWN0IiwibnVtYmVyT2ZNb250aHMiLCJzdGVwTW9udGhzIiwicHJldlRleHQiLCJuZXh0VGV4dCIsImRhdGVGb3JtYXQiLCJjaGFuZ2VNb250aCIsImNoYW5nZVllYXIiLCJtaW5EYXRlIiwibWF4RGF0ZSIsInNob3dTdGF0dXMiLCJtdWx0aVNlcGFyYXRvciIsImNsb3NlQXRUb3AiLCJmaXJzdERheSIsImdvdG9DdXJyZW50IiwiaGlkZUlmTm9QcmV2TmV4dCIsInVzZVRoZW1lUm9sbGVyIiwibWFuZGF0b3J5IiwiaGFuZGxlX3BvaW50ZXJfZG93biIsImV2ZW50IiwidGFyZ2V0IiwiY2xvc2VzdCIsImhhbmRsZV9jbGljayIsImFjdGlvbiIsImhhbmRsZV92aWV3cG9ydF9jaGFuZ2UiLCJBcnJheSIsInByb3RvdHlwZSIsImZvckVhY2giLCJxdWVyeVNlbGVjdG9yQWxsIiwiYWRkRXZlbnRMaXN0ZW5lciIsImpRdWVyeSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL19zaGFyZWRfdWkvZGF0ZS1qdW1wL19zcmMvZGF0ZS1qdW1wLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogRG9tYWluLW5ldXRyYWwgc2hhcmVkIGFkbWluaXN0cmF0aW9uIGRhdGUtanVtcCBpbnRlcmFjdGlvbnMuXG4gKlxuICogQHBhY2thZ2UgQm9va2luZyBDYWxlbmRhclxuICogQHNpbmNlICAgMTIuMC4wXG4gKi9cbiggZnVuY3Rpb24gKCB3aW5kb3csIGRvY3VtZW50LCAkICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIHJvb3Rfc2VsZWN0b3IgPSAnW2RhdGEtd3BiYy1zaGFyZWQtdWktZGF0ZS1qdW1wXSc7XG5cdHZhciBpbnB1dF9zZWxlY3RvciA9ICdbZGF0YS13cGJjLXNoYXJlZC11aS1kYXRlLWp1bXAtaW5wdXRdJztcblx0dmFyIHRvZ2dsZV9zZWxlY3RvciA9ICdbZGF0YS13cGJjLXNoYXJlZC11aS1kYXRlLWp1bXAtdG9nZ2xlXSc7XG5cdHZhciBkYXRlcGlja19tYXJrZXJfYXR0cmlidXRlID0gJ2RhdGEtd3BiYy1zaGFyZWQtdWktZGF0ZS1qdW1wLWRhdGVwaWNrJztcblx0dmFyIGRhdGVwaWNrX293bmVyX2F0dHJpYnV0ZSA9ICdkYXRhLXdwYmMtc2hhcmVkLXVpLWRhdGUtanVtcC1vd25lcic7XG5cdHZhciBjb21wb25lbnRfc3RhdGVfa2V5ID0gJ3dwYmNfc2hhcmVkX3VpX2RhdGVfanVtcF9zdGF0ZSc7XG5cblx0LyoqXG5cdCAqIFBhcnNlIG9uZSBzdHJpY3QgSVNPIGNhbGVuZGFyIGRhdGUgd2l0aG91dCB0aW1lem9uZSBjb252ZXJzaW9uLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZGF0ZV92YWx1ZSBDYW5kaWRhdGUgWVlZWS1NTS1ERCB2YWx1ZS5cblx0ICogQHJldHVybiB7RGF0ZXxudWxsfSBMb2NhbCBEYXRlIGluc3RhbmNlIG9yIG51bGwuXG5cdCAqL1xuXHRmdW5jdGlvbiBwYXJzZV9pc29fZGF0ZSggZGF0ZV92YWx1ZSApIHtcblx0XHR2YXIgbWF0Y2ggPSBTdHJpbmcoIGRhdGVfdmFsdWUgfHwgJycgKS5tYXRjaCggL14oXFxkezR9KS0oXFxkezJ9KS0oXFxkezJ9KSQvICk7XG5cdFx0dmFyIHBhcnNlZF9kYXRlO1xuXG5cdFx0aWYgKCAhIG1hdGNoICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHBhcnNlZF9kYXRlID0gbmV3IERhdGUoIE51bWJlciggbWF0Y2hbIDEgXSApLCBOdW1iZXIoIG1hdGNoWyAyIF0gKSAtIDEsIE51bWJlciggbWF0Y2hbIDMgXSApICk7XG5cdFx0aWYgKFxuXHRcdFx0cGFyc2VkX2RhdGUuZ2V0RnVsbFllYXIoKSAhPT0gTnVtYmVyKCBtYXRjaFsgMSBdICkgfHxcblx0XHRcdHBhcnNlZF9kYXRlLmdldE1vbnRoKCkgIT09IE51bWJlciggbWF0Y2hbIDIgXSApIC0gMSB8fFxuXHRcdFx0cGFyc2VkX2RhdGUuZ2V0RGF0ZSgpICE9PSBOdW1iZXIoIG1hdGNoWyAzIF0gKVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHJldHVybiBwYXJzZWRfZGF0ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gdGhlIHNpbmdsZSBwb3B1cCBvd25lZCBieSB0aGUgYnVuZGxlZCBCb29raW5nIENhbGVuZGFyIGRhdGVwaWNrZXIuXG5cdCAqXG5cdCAqIEByZXR1cm4ge2pRdWVyeX0gRGF0ZXBpY2tlciBwb3B1cCwgb3IgYW4gZW1wdHkgalF1ZXJ5IGNvbGxlY3Rpb24uXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfZGF0ZXBpY2tfcG9wdXAoKSB7XG5cdFx0aWYgKCAkLmRhdGVwaWNrICYmICQuZGF0ZXBpY2suZHBEaXYgJiYgJC5kYXRlcGljay5kcERpdi5sZW5ndGggKSB7XG5cdFx0XHRyZXR1cm4gJC5kYXRlcGljay5kcERpdjtcblx0XHR9XG5cdFx0cmV0dXJuICQoICcjZGF0ZXBpY2stZGl2JyApLmZpcnN0KCk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIHByaXZhdGUgaW50ZXJhY3Rpb24gc3RhdGUgZm9yIG9uZSByZW5kZXJlZCBjb21wb25lbnQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvb3QgQ29tcG9uZW50IHJvb3QuXG5cdCAqIEByZXR1cm4ge09iamVjdH0gTXV0YWJsZSBjb21wb25lbnQtbG9jYWwgc3RhdGUuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfY29tcG9uZW50X3N0YXRlKCByb290ICkge1xuXHRcdHZhciBzdGF0ZSA9ICQuZGF0YSggcm9vdCwgY29tcG9uZW50X3N0YXRlX2tleSApO1xuXG5cdFx0aWYgKCAhIHN0YXRlICkge1xuXHRcdFx0c3RhdGUgPSB7XG5cdFx0XHRcdHBlbmRpbmdfc2VsZWN0ZWRfZGF0ZTogJycsXG5cdFx0XHRcdHBvc2l0aW9uX2ZyYW1lOiAwLFxuXHRcdFx0XHRyZXN0b3JlX3RvZ2dsZV9mb2N1czogZmFsc2UsXG5cdFx0XHRcdHdhc19vcGVuX29uX3BvaW50ZXJfZG93bjogZmFsc2Vcblx0XHRcdH07XG5cdFx0XHQkLmRhdGEoIHJvb3QsIGNvbXBvbmVudF9zdGF0ZV9rZXksIHN0YXRlICk7XG5cdFx0fVxuXHRcdHJldHVybiBzdGF0ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBEZXRlcm1pbmUgd2hldGhlciB0aGUgc2hhcmVkIHNpbmdsZXRvbiBkYXRlcGlja2VyIGlzIG9wZW4gZm9yIG9uZSBpbnB1dC5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gaW5wdXQgRGF0ZSBpbnB1dC5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBwb3B1cCBpcyBvcGVuIGZvciB0aGUgc3VwcGxpZWQgaW5wdXQuXG5cdCAqL1xuXHRmdW5jdGlvbiBpc19kYXRlcGlja2VyX29wZW5fZm9yX2lucHV0KCBpbnB1dCApIHtcblx0XHR2YXIgY3VycmVudF9pbnN0YW5jZSA9ICQuZGF0ZXBpY2sgPyAkLmRhdGVwaWNrLl9jdXJJbnN0IDogbnVsbDtcblx0XHR2YXIgY3VycmVudF9pbnB1dCA9IGN1cnJlbnRfaW5zdGFuY2UgJiYgY3VycmVudF9pbnN0YW5jZS5pbnB1dCA/IGN1cnJlbnRfaW5zdGFuY2UuaW5wdXRbIDAgXSA6IG51bGw7XG5cblx0XHRyZXR1cm4gQm9vbGVhbiggJC5kYXRlcGljayAmJiAkLmRhdGVwaWNrLl9kYXRlcGlja2VyU2hvd2luZyAmJiBjdXJyZW50X2lucHV0ID09PSBpbnB1dCApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlYWQgb25lIHBpeGVsLXZhbHVlZCBjb21wb25lbnQgdG9rZW4gd2l0aCBhIHNhZmUgbnVtZXJpYyBmYWxsYmFjay5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm9vdCAgICAgICAgICAgQ29tcG9uZW50IHJvb3QuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSAgICAgIHByb3BlcnR5X25hbWUgIENTUyBjdXN0b20gcHJvcGVydHkgbmFtZS5cblx0ICogQHBhcmFtIHtudW1iZXJ9ICAgICAgZmFsbGJhY2tfdmFsdWUgVmFsdWUgdXNlZCB3aGVuIHRoZSB0b2tlbiBpcyB1bmF2YWlsYWJsZS5cblx0ICogQHJldHVybiB7bnVtYmVyfSBQYXJzZWQgbm9uLW5lZ2F0aXZlIHBpeGVsIHZhbHVlLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X3BpeGVsX3Rva2VuKCByb290LCBwcm9wZXJ0eV9uYW1lLCBmYWxsYmFja192YWx1ZSApIHtcblx0XHR2YXIgcGFyc2VkX3ZhbHVlID0gcGFyc2VGbG9hdCggd2luZG93LmdldENvbXB1dGVkU3R5bGUoIHJvb3QgKS5nZXRQcm9wZXJ0eVZhbHVlKCBwcm9wZXJ0eV9uYW1lICkgKTtcblxuXHRcdHJldHVybiBOdW1iZXIuaXNGaW5pdGUoIHBhcnNlZF92YWx1ZSApICYmIHBhcnNlZF92YWx1ZSA+PSAwID8gcGFyc2VkX3ZhbHVlIDogZmFsbGJhY2tfdmFsdWU7XG5cdH1cblxuXHQvKipcblx0ICogUG9zaXRpb24gdGhlIHBvcnRhbGVkIGRhdGVwaWNrZXIgYWdhaW5zdCB0aGUgdmlzaWJsZSBkaXNjbG9zdXJlIGJ1dHRvbi5cblx0ICpcblx0ICogVGhlIGJ1bmRsZWQgZGF0ZXBpY2tlciBub3JtYWxseSBhbmNob3JzIGl0c2VsZiB0byBpdHMgYXNzb2NpYXRlZCBpbnB1dC5cblx0ICogVGhpcyBjb21wb25lbnQga2VlcHMgdGhhdCBpbnB1dCB2aXN1YWxseSBoaWRkZW4sIHNvIHRoZSB2aXNpYmxlIHRvZ2dsZSBpc1xuXHQgKiB0aGUgc3RhYmxlIGludGVyYWN0aW9uIGFuZCBwbGFjZW1lbnQgYW5jaG9yIGluc3RlYWQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvb3QgQ29tcG9uZW50IHJvb3QuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBwb3NpdGlvbl9kYXRlcGlja19wb3B1cCggcm9vdCApIHtcblx0XHR2YXIgdG9nZ2xlID0gcm9vdC5xdWVyeVNlbGVjdG9yKCB0b2dnbGVfc2VsZWN0b3IgKTtcblx0XHR2YXIgJHBvcHVwID0gZ2V0X2RhdGVwaWNrX3BvcHVwKCk7XG5cdFx0dmFyIHBvcHVwID0gJHBvcHVwWyAwIF07XG5cdFx0dmFyIHRvZ2dsZV9yZWN0YW5nbGU7XG5cdFx0dmFyIHBvcHVwX3JlY3RhbmdsZTtcblx0XHR2YXIgdmlld3BvcnRfd2lkdGg7XG5cdFx0dmFyIHZpZXdwb3J0X2hlaWdodDtcblx0XHR2YXIgc2Nyb2xsX3g7XG5cdFx0dmFyIHNjcm9sbF95O1xuXHRcdHZhciB2aWV3cG9ydF9ndXR0ZXI7XG5cdFx0dmFyIHBvcHVwX2dhcDtcblx0XHR2YXIgbWluaW11bV9sZWZ0O1xuXHRcdHZhciBtYXhpbXVtX2xlZnQ7XG5cdFx0dmFyIGxlZnQ7XG5cdFx0dmFyIGJlbG93O1xuXHRcdHZhciBhYm92ZTtcblx0XHR2YXIgdG9wO1xuXHRcdHZhciBpc19ydGw7XG5cblx0XHRpZiAoICEgdG9nZ2xlIHx8ICEgcG9wdXAgfHwgISByb290LmNsYXNzTGlzdC5jb250YWlucyggJ2lzLW9wZW4nICkgfHwgISBpc19kYXRlcGlja2VyX29wZW5fZm9yX2lucHV0KCByb290LnF1ZXJ5U2VsZWN0b3IoIGlucHV0X3NlbGVjdG9yICkgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dG9nZ2xlX3JlY3RhbmdsZSA9IHRvZ2dsZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRwb3B1cF9yZWN0YW5nbGUgPSBwb3B1cC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHR2aWV3cG9ydF93aWR0aCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aCB8fCB3aW5kb3cuaW5uZXJXaWR0aDtcblx0XHR2aWV3cG9ydF9oZWlnaHQgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50SGVpZ2h0IHx8IHdpbmRvdy5pbm5lckhlaWdodDtcblx0XHRzY3JvbGxfeCA9IHdpbmRvdy5wYWdlWE9mZnNldCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsTGVmdCB8fCAwO1xuXHRcdHNjcm9sbF95ID0gd2luZG93LnBhZ2VZT2Zmc2V0IHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxUb3AgfHwgMDtcblx0XHR2aWV3cG9ydF9ndXR0ZXIgPSBnZXRfcGl4ZWxfdG9rZW4oIHJvb3QsICctLXdwYmNfc2hhcmVkX3VpX2RhdGVfanVtcF9fdmlld3BvcnQtZWRnZS1nYXAnLCA4ICk7XG5cdFx0cG9wdXBfZ2FwID0gZ2V0X3BpeGVsX3Rva2VuKCByb290LCAnLS13cGJjX3NoYXJlZF91aV9kYXRlX2p1bXBfX3BvcHVwLWdhcCcsIDYgKTtcblx0XHRtaW5pbXVtX2xlZnQgPSBzY3JvbGxfeCArIHZpZXdwb3J0X2d1dHRlcjtcblx0XHRtYXhpbXVtX2xlZnQgPSBNYXRoLm1heCggbWluaW11bV9sZWZ0LCBzY3JvbGxfeCArIHZpZXdwb3J0X3dpZHRoIC0gcG9wdXBfcmVjdGFuZ2xlLndpZHRoIC0gdmlld3BvcnRfZ3V0dGVyICk7XG5cdFx0aXNfcnRsID0gJ3J0bCcgPT09IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKCByb290ICkuZGlyZWN0aW9uO1xuXHRcdGxlZnQgPSBpc19ydGwgPyB0b2dnbGVfcmVjdGFuZ2xlLmxlZnQgKyBzY3JvbGxfeCA6IHRvZ2dsZV9yZWN0YW5nbGUucmlnaHQgKyBzY3JvbGxfeCAtIHBvcHVwX3JlY3RhbmdsZS53aWR0aDtcblx0XHRsZWZ0ID0gTWF0aC5taW4oIE1hdGgubWF4KCBsZWZ0LCBtaW5pbXVtX2xlZnQgKSwgbWF4aW11bV9sZWZ0ICk7XG5cdFx0YmVsb3cgPSB0b2dnbGVfcmVjdGFuZ2xlLmJvdHRvbSArIHNjcm9sbF95ICsgcG9wdXBfZ2FwO1xuXHRcdGFib3ZlID0gdG9nZ2xlX3JlY3RhbmdsZS50b3AgKyBzY3JvbGxfeSAtIHBvcHVwX3JlY3RhbmdsZS5oZWlnaHQgLSBwb3B1cF9nYXA7XG5cdFx0dG9wID0gYmVsb3c7XG5cdFx0aWYgKCBiZWxvdyArIHBvcHVwX3JlY3RhbmdsZS5oZWlnaHQgPiBzY3JvbGxfeSArIHZpZXdwb3J0X2hlaWdodCAtIHZpZXdwb3J0X2d1dHRlciAmJiBhYm92ZSA+PSBzY3JvbGxfeSArIHZpZXdwb3J0X2d1dHRlciApIHtcblx0XHRcdHRvcCA9IGFib3ZlO1xuXHRcdH1cblx0XHQkcG9wdXAuY3NzKCB7XG5cdFx0XHRsZWZ0OiBNYXRoLnJvdW5kKCBsZWZ0ICkgKyAncHgnLFxuXHRcdFx0cG9zaXRpb246ICdhYnNvbHV0ZScsXG5cdFx0XHR0b3A6IE1hdGgucm91bmQoIE1hdGgubWF4KCBzY3JvbGxfeSArIHZpZXdwb3J0X2d1dHRlciwgdG9wICkgKSArICdweCdcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogU2NoZWR1bGUgb25lIHBsYWNlbWVudCBwYXNzIGFmdGVyIGRhdGVwaWNrZXIgcmVuZGVyaW5nIG9yIHZpZXdwb3J0IG1vdmVtZW50LlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByb290IENvbXBvbmVudCByb290LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2NoZWR1bGVfZGF0ZXBpY2tfcG9zaXRpb24oIHJvb3QgKSB7XG5cdFx0dmFyIHN0YXRlID0gZ2V0X2NvbXBvbmVudF9zdGF0ZSggcm9vdCApO1xuXHRcdHZhciByZXF1ZXN0X2ZyYW1lID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSB8fCBmdW5jdGlvbiAoIGNhbGxiYWNrICkge1xuXHRcdFx0cmV0dXJuIHdpbmRvdy5zZXRUaW1lb3V0KCBjYWxsYmFjaywgMTYgKTtcblx0XHR9O1xuXG5cdFx0aWYgKCBzdGF0ZS5wb3NpdGlvbl9mcmFtZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0c3RhdGUucG9zaXRpb25fZnJhbWUgPSByZXF1ZXN0X2ZyYW1lKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRzdGF0ZS5wb3NpdGlvbl9mcmFtZSA9IDA7XG5cdFx0XHRwb3NpdGlvbl9kYXRlcGlja19wb3B1cCggcm9vdCApO1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDYW5jZWwgYSBwZW5kaW5nIHBsYWNlbWVudCBwYXNzIGZvciBhIGNsb3NpbmcgY29tcG9uZW50LlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByb290IENvbXBvbmVudCByb290LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gY2FuY2VsX2RhdGVwaWNrX3Bvc2l0aW9uKCByb290ICkge1xuXHRcdHZhciBzdGF0ZSA9IGdldF9jb21wb25lbnRfc3RhdGUoIHJvb3QgKTtcblx0XHR2YXIgY2FuY2VsX2ZyYW1lID0gd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lIHx8IHdpbmRvdy5jbGVhclRpbWVvdXQ7XG5cblx0XHRpZiAoIHN0YXRlLnBvc2l0aW9uX2ZyYW1lICkge1xuXHRcdFx0Y2FuY2VsX2ZyYW1lLmNhbGwoIHdpbmRvdywgc3RhdGUucG9zaXRpb25fZnJhbWUgKTtcblx0XHRcdHN0YXRlLnBvc2l0aW9uX2ZyYW1lID0gMDtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogTWFyayB0aGUgc2hhcmVkIHNpbmdsZXRvbiBkYXRlcGlja2VyIGFzIG93bmVkIGJ5IHRoaXMgY29tcG9uZW50LlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByb290IENvbXBvbmVudCByb290LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gbWFya19kYXRlcGlja19wb3B1cCggcm9vdCApIHtcblx0XHRnZXRfZGF0ZXBpY2tfcG9wdXAoKVxuXHRcdFx0LmF0dHIoIGRhdGVwaWNrX21hcmtlcl9hdHRyaWJ1dGUsICd0cnVlJyApXG5cdFx0XHQuYXR0ciggZGF0ZXBpY2tfb3duZXJfYXR0cmlidXRlLCByb290LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1zaGFyZWQtdWktZGF0ZS1qdW1wJyApIHx8ICcnICk7XG5cdH1cblxuXHQvKipcblx0ICogUmVsZWFzZSB0aGUgc2luZ2xldG9uIGRhdGVwaWNrZXIgbWFya2VyIG9ubHkgd2hlbiB0aGlzIGNvbXBvbmVudCBvd25zIGl0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByb290IENvbXBvbmVudCByb290LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gdW5tYXJrX2RhdGVwaWNrX3BvcHVwKCByb290ICkge1xuXHRcdHZhciBvd25lcl9pZCA9IHJvb3QuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXNoYXJlZC11aS1kYXRlLWp1bXAnICkgfHwgJyc7XG5cblx0XHRnZXRfZGF0ZXBpY2tfcG9wdXAoKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgJHBvcHVwID0gJCggdGhpcyApO1xuXG5cdFx0XHRpZiAoIG93bmVyX2lkID09PSAkcG9wdXAuYXR0ciggZGF0ZXBpY2tfb3duZXJfYXR0cmlidXRlICkgKSB7XG5cdFx0XHRcdCRwb3B1cC5yZW1vdmVBdHRyKCBkYXRlcGlja19vd25lcl9hdHRyaWJ1dGUgKS5yZW1vdmVBdHRyKCBkYXRlcGlja19tYXJrZXJfYXR0cmlidXRlICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIERpc3BhdGNoIG9uZSBuZXV0cmFsIGJ1YmJsaW5nIGNvbXBvbmVudCBldmVudC5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm9vdCAgICAgICAgIENvbXBvbmVudCByb290LlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICBldmVudF9uYW1lICAgQ3VzdG9tIGV2ZW50IG5hbWUuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGV2ZW50X2RldGFpbCBTY2FsYXIgZXZlbnQgdmFsdWVzLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gZGlzcGF0Y2hfY29tcG9uZW50X2V2ZW50KCByb290LCBldmVudF9uYW1lLCBldmVudF9kZXRhaWwgKSB7XG5cdFx0dmFyIGNvbXBvbmVudF9ldmVudDtcblxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5DdXN0b21FdmVudCApIHtcblx0XHRcdGNvbXBvbmVudF9ldmVudCA9IG5ldyB3aW5kb3cuQ3VzdG9tRXZlbnQoIGV2ZW50X25hbWUsIHtcblx0XHRcdFx0YnViYmxlczogdHJ1ZSxcblx0XHRcdFx0ZGV0YWlsOiBldmVudF9kZXRhaWxcblx0XHRcdH0gKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29tcG9uZW50X2V2ZW50ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoICdDdXN0b21FdmVudCcgKTtcblx0XHRcdGNvbXBvbmVudF9ldmVudC5pbml0Q3VzdG9tRXZlbnQoIGV2ZW50X25hbWUsIHRydWUsIGZhbHNlLCBldmVudF9kZXRhaWwgKTtcblx0XHR9XG5cdFx0cm9vdC5kaXNwYXRjaEV2ZW50KCBjb21wb25lbnRfZXZlbnQgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBPcGVuIGFuIGluaXRpYWxpemVkIHN0YW5kYXJkIGRhdGVwaWNrZXIgZm9yIHRoZSBjb21wb25lbnQgaW5wdXQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGlucHV0IERhdGUgaW5wdXQuXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvb3QgIENvbXBvbmVudCByb290LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2hvd19kYXRlcGlja2VyKCBpbnB1dCwgcm9vdCApIHtcblx0XHR2YXIgc3RhdGU7XG5cblx0XHRpZiAoICEgaW5wdXQgfHwgISAkLmRhdGVwaWNrIHx8ICEgJC5kYXRlcGljay5fc2hvd0RhdGVwaWNrIHx8ICEgJCggaW5wdXQgKS5oYXNDbGFzcyggJC5kYXRlcGljay5tYXJrZXJDbGFzc05hbWUgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0c3RhdGUgPSBnZXRfY29tcG9uZW50X3N0YXRlKCByb290ICk7XG5cdFx0aWYgKCBzdGF0ZS53YXNfb3Blbl9vbl9wb2ludGVyX2Rvd24gfHwgaXNfZGF0ZXBpY2tlcl9vcGVuX2Zvcl9pbnB1dCggaW5wdXQgKSApIHtcblx0XHRcdHN0YXRlLndhc19vcGVuX29uX3BvaW50ZXJfZG93biA9IGZhbHNlO1xuXHRcdFx0c3RhdGUucmVzdG9yZV90b2dnbGVfZm9jdXMgPSB0cnVlO1xuXHRcdFx0aWYgKCAkLmRhdGVwaWNrLl9kYXRlcGlja2VyU2hvd2luZyApIHtcblx0XHRcdFx0JC5kYXRlcGljay5faGlkZURhdGVwaWNrKCBudWxsLCAnJyApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRzdGF0ZS53YXNfb3Blbl9vbl9wb2ludGVyX2Rvd24gPSBmYWxzZTtcblx0XHRpZiAoICQuZGF0ZXBpY2suX2RhdGVwaWNrZXJTaG93aW5nICYmICQuZGF0ZXBpY2suX2hpZGVEYXRlcGljayApIHtcblx0XHRcdCQuZGF0ZXBpY2suX2hpZGVEYXRlcGljayggbnVsbCwgJycgKTtcblx0XHR9XG5cdFx0aWYgKCAkLmRhdGVwaWNrLl9sYXN0SW5wdXQgPT09IGlucHV0ICkge1xuXHRcdFx0JC5kYXRlcGljay5fbGFzdElucHV0ID0gbnVsbDtcblx0XHR9XG5cdFx0c3RhdGUucmVzdG9yZV90b2dnbGVfZm9jdXMgPSB0cnVlO1xuXHRcdCQuZGF0ZXBpY2suX3Nob3dEYXRlcGljayggaW5wdXQgKTtcblx0XHRwb3NpdGlvbl9kYXRlcGlja19wb3B1cCggcm9vdCApO1xuXHRcdHNjaGVkdWxlX2RhdGVwaWNrX3Bvc2l0aW9uKCByb290ICk7XG5cdH1cblxuXHQvKipcblx0ICogSW5pdGlhbGl6ZSB0aGUgc3RhbmRhcmQgZGF0ZXBpY2tlciBmb3Igb25lIGRhdGUtanVtcCBjb21wb25lbnQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvb3QgQ29tcG9uZW50IHJvb3QuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGlzIGNhbGwgaW5pdGlhbGl6ZWQgdGhlIGNvbXBvbmVudC5cblx0ICovXG5cdGZ1bmN0aW9uIGluaXRpYWxpemVfZGF0ZXBpY2tlciggcm9vdCApIHtcblx0XHR2YXIgaW5wdXQgPSByb290LnF1ZXJ5U2VsZWN0b3IoIGlucHV0X3NlbGVjdG9yICk7XG5cdFx0dmFyIHRvZ2dsZSA9IHJvb3QucXVlcnlTZWxlY3RvciggdG9nZ2xlX3NlbGVjdG9yICk7XG5cdFx0dmFyIGZpcnN0X2RheSA9IE1hdGgubWF4KCAwLCBNYXRoLm1pbiggNiwgTnVtYmVyKCByb290LmdldEF0dHJpYnV0ZSggJ2RhdGEtZmlyc3QtZGF5JyApICkgfHwgMCApICk7XG5cdFx0dmFyIHN0YXRlO1xuXG5cdFx0aWYgKCAhIGlucHV0IHx8ICEgdG9nZ2xlIHx8ICEgJC5mbi5kYXRlcGljayB8fCByb290Lmhhc0F0dHJpYnV0ZSggJ2RhdGEtZGF0ZXBpY2staW5pdGlhbGl6ZWQnICkgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJvb3Quc2V0QXR0cmlidXRlKCAnZGF0YS1kYXRlcGljay1pbml0aWFsaXplZCcsICd0cnVlJyApO1xuXHRcdHN0YXRlID0gZ2V0X2NvbXBvbmVudF9zdGF0ZSggcm9vdCApO1xuXHRcdCQoIGlucHV0ICkuZGF0ZXBpY2soIHtcblx0XHRcdGJlZm9yZVNob3c6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cm9vdC5jbGFzc0xpc3QuYWRkKCAnaXMtb3BlbicgKTtcblx0XHRcdFx0dG9nZ2xlLnNldEF0dHJpYnV0ZSggJ2FyaWEtZXhwYW5kZWQnLCAndHJ1ZScgKTtcblx0XHRcdFx0bWFya19kYXRlcGlja19wb3B1cCggcm9vdCApO1xuXHRcdFx0fSxcblx0XHRcdGJlZm9yZVNob3dEYXk6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIFsgdHJ1ZSwgJ2RhdGVfYXZhaWxhYmxlJyBdO1xuXHRcdFx0fSxcblx0XHRcdG9uU2VsZWN0OiBmdW5jdGlvbiAoIHNlbGVjdGVkX2RhdGUgKSB7XG5cdFx0XHRcdHZhciBzZWxlY3RlZF92YWx1ZSA9IFN0cmluZyggc2VsZWN0ZWRfZGF0ZSB8fCAnJyApLnNwbGl0KCAvXFxzKy1cXHMrfCxcXHMqLyApWyAwIF07XG5cblx0XHRcdFx0aWYgKCAhIHBhcnNlX2lzb19kYXRlKCBzZWxlY3RlZF92YWx1ZSApICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpbnB1dC52YWx1ZSA9IHNlbGVjdGVkX3ZhbHVlO1xuXHRcdFx0XHRyb290LnNldEF0dHJpYnV0ZSggJ2RhdGEtc2VsZWN0ZWQtZGF0ZScsIHNlbGVjdGVkX3ZhbHVlICk7XG5cdFx0XHRcdHN0YXRlLnBlbmRpbmdfc2VsZWN0ZWRfZGF0ZSA9IHNlbGVjdGVkX3ZhbHVlO1xuXHRcdFx0XHRzdGF0ZS5yZXN0b3JlX3RvZ2dsZV9mb2N1cyA9IHRydWU7XG5cdFx0XHR9LFxuXHRcdFx0b25DbG9zZTogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRjYW5jZWxfZGF0ZXBpY2tfcG9zaXRpb24oIHJvb3QgKTtcblx0XHRcdFx0cm9vdC5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtb3BlbicgKTtcblx0XHRcdFx0dG9nZ2xlLnNldEF0dHJpYnV0ZSggJ2FyaWEtZXhwYW5kZWQnLCAnZmFsc2UnICk7XG5cdFx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0dmFyIHNlbGVjdGVkX3ZhbHVlID0gc3RhdGUucGVuZGluZ19zZWxlY3RlZF9kYXRlO1xuXG5cdFx0XHRcdFx0dW5tYXJrX2RhdGVwaWNrX3BvcHVwKCByb290ICk7XG5cdFx0XHRcdFx0aWYgKCBzdGF0ZS5yZXN0b3JlX3RvZ2dsZV9mb2N1cyAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY29udGFpbnMoIHRvZ2dsZSApICkge1xuXHRcdFx0XHRcdFx0c3RhdGUucmVzdG9yZV90b2dnbGVfZm9jdXMgPSBmYWxzZTtcblx0XHRcdFx0XHRcdHRvZ2dsZS5mb2N1cygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIHNlbGVjdGVkX3ZhbHVlICkge1xuXHRcdFx0XHRcdFx0c3RhdGUucGVuZGluZ19zZWxlY3RlZF9kYXRlID0gJyc7XG5cdFx0XHRcdFx0XHRkaXNwYXRjaF9jb21wb25lbnRfZXZlbnQoIHJvb3QsICd3cGJjOnNoYXJlZC11aS1kYXRlLWp1bXAtc2VsZWN0Jywge1xuXHRcdFx0XHRcdFx0XHRpZDogcm9vdC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtc2hhcmVkLXVpLWRhdGUtanVtcCcgKSB8fCAnJyxcblx0XHRcdFx0XHRcdFx0ZGF0ZTogc2VsZWN0ZWRfdmFsdWVcblx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sIDAgKTtcblx0XHRcdH0sXG5cdFx0XHRzaG93T246ICdmb2N1cycsXG5cdFx0XHRzaG93QW5pbTogJ3Nob3cnLFxuXHRcdFx0ZHVyYXRpb246ICcnLFxuXHRcdFx0bXVsdGlTZWxlY3Q6IDAsXG5cdFx0XHRudW1iZXJPZk1vbnRoczogMSxcblx0XHRcdHN0ZXBNb250aHM6IDEsXG5cdFx0XHRwcmV2VGV4dDogJyZsc2FxdW87Jyxcblx0XHRcdG5leHRUZXh0OiAnJnJzYXF1bzsnLFxuXHRcdFx0ZGF0ZUZvcm1hdDogJ3l5LW1tLWRkJyxcblx0XHRcdGNoYW5nZU1vbnRoOiBmYWxzZSxcblx0XHRcdGNoYW5nZVllYXI6IGZhbHNlLFxuXHRcdFx0bWluRGF0ZTogbnVsbCxcblx0XHRcdG1heERhdGU6IG51bGwsXG5cdFx0XHRzaG93U3RhdHVzOiBmYWxzZSxcblx0XHRcdG11bHRpU2VwYXJhdG9yOiAnLCAnLFxuXHRcdFx0Y2xvc2VBdFRvcDogbnVsbCxcblx0XHRcdGZpcnN0RGF5OiBmaXJzdF9kYXksXG5cdFx0XHRnb3RvQ3VycmVudDogZmFsc2UsXG5cdFx0XHRoaWRlSWZOb1ByZXZOZXh0OiB0cnVlLFxuXHRcdFx0dXNlVGhlbWVSb2xsZXI6IGZhbHNlLFxuXHRcdFx0bWFuZGF0b3J5OiB0cnVlXG5cdFx0fSApO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIFByZXNlcnZlIHByZS1hY3RpdmF0aW9uIHN0YXRlIGJlZm9yZSB0aGUgZGF0ZXBpY2tlciBvdXRzaWRlLWNsaWNrIGhhbmRsZXIuXG5cdCAqXG5cdCAqIFRoZSBidW5kbGVkIGRhdGVwaWNrZXIgY2xvc2VzIHBvcnRhbGVkIHBvcHVwcyBkdXJpbmcgbW91c2Vkb3duLiBSZWNvcmRpbmdcblx0ICogdGhlIHByaW9yIHN0YXRlIGxldHMgYSBzZWNvbmQgZGlzY2xvc3VyZSBhY3RpdmF0aW9uIHJlbWFpbiBhIHRydWUgY2xvc2Vcblx0ICogaW5zdGVhZCBvZiBjbG9zaW5nIG9uIG1vdXNlZG93biBhbmQgcmVvcGVuaW5nIGR1cmluZyB0aGUgZm9sbG93aW5nIGNsaWNrLlxuXHQgKlxuXHQgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGV2ZW50IENhcHR1cmluZyBtb3VzZWRvd24gZXZlbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBoYW5kbGVfcG9pbnRlcl9kb3duKCBldmVudCApIHtcblx0XHR2YXIgdG9nZ2xlID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QgPyBldmVudC50YXJnZXQuY2xvc2VzdCggdG9nZ2xlX3NlbGVjdG9yICkgOiBudWxsO1xuXHRcdHZhciByb290ID0gdG9nZ2xlID8gdG9nZ2xlLmNsb3Nlc3QoIHJvb3Rfc2VsZWN0b3IgKSA6IG51bGw7XG5cdFx0dmFyIGlucHV0ID0gcm9vdCA/IHJvb3QucXVlcnlTZWxlY3RvciggaW5wdXRfc2VsZWN0b3IgKSA6IG51bGw7XG5cblx0XHRpZiAoIHJvb3QgJiYgaW5wdXQgKSB7XG5cdFx0XHRnZXRfY29tcG9uZW50X3N0YXRlKCByb290ICkud2FzX29wZW5fb25fcG9pbnRlcl9kb3duID0gaXNfZGF0ZXBpY2tlcl9vcGVuX2Zvcl9pbnB1dCggaW5wdXQgKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogSGFuZGxlIHRoZSBzcGxpdCBhY3Rpb24gYW5kIGRhdGVwaWNrZXIgdG9nZ2xlIHRocm91Z2ggZGVsZWdhdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHtNb3VzZUV2ZW50fSBldmVudCBCcm93c2VyIGNsaWNrIGV2ZW50LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gaGFuZGxlX2NsaWNrKCBldmVudCApIHtcblx0XHR2YXIgYWN0aW9uID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXNoYXJlZC11aS1kYXRlLWp1bXAtYWN0aW9uXScgKTtcblx0XHR2YXIgdG9nZ2xlID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoIHRvZ2dsZV9zZWxlY3RvciApO1xuXHRcdHZhciByb290ID0gYWN0aW9uIHx8IHRvZ2dsZSA/IGV2ZW50LnRhcmdldC5jbG9zZXN0KCByb290X3NlbGVjdG9yICkgOiBudWxsO1xuXHRcdHZhciBpbnB1dDtcblxuXHRcdGlmICggISByb290ICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIGFjdGlvbiApIHtcblx0XHRcdGRpc3BhdGNoX2NvbXBvbmVudF9ldmVudCggcm9vdCwgJ3dwYmM6c2hhcmVkLXVpLWRhdGUtanVtcC1hY3Rpb24nLCB7XG5cdFx0XHRcdGlkOiByb290LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1zaGFyZWQtdWktZGF0ZS1qdW1wJyApIHx8ICcnXG5cdFx0XHR9ICk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGluaXRpYWxpemVfZGF0ZXBpY2tlciggcm9vdCApO1xuXHRcdGlucHV0ID0gcm9vdC5xdWVyeVNlbGVjdG9yKCBpbnB1dF9zZWxlY3RvciApO1xuXHRcdGlmICggaW5wdXQgJiYgJC5kYXRlcGljayAmJiAkKCBpbnB1dCApLmhhc0NsYXNzKCAkLmRhdGVwaWNrLm1hcmtlckNsYXNzTmFtZSApICkge1xuXHRcdFx0c2hvd19kYXRlcGlja2VyKCBpbnB1dCwgcm9vdCApO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBLZWVwIGFuIG9wZW4gcG9ydGFsZWQgZGF0ZXBpY2tlciBhdHRhY2hlZCB0byBpdHMgdmlzaWJsZSBkaXNjbG9zdXJlLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gaGFuZGxlX3ZpZXdwb3J0X2NoYW5nZSgpIHtcblx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCByb290X3NlbGVjdG9yICsgJy5pcy1vcGVuJyApLCBmdW5jdGlvbiAoIHJvb3QgKSB7XG5cdFx0XHRzY2hlZHVsZV9kYXRlcGlja19wb3NpdGlvbiggcm9vdCApO1xuXHRcdH0gKTtcblx0fVxuXG5cdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdtb3VzZWRvd24nLCBoYW5kbGVfcG9pbnRlcl9kb3duLCB0cnVlICk7XG5cdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGhhbmRsZV9jbGljayApO1xuXHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnc2Nyb2xsJywgaGFuZGxlX3ZpZXdwb3J0X2NoYW5nZSwgdHJ1ZSApO1xuXHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3Jlc2l6ZScsIGhhbmRsZV92aWV3cG9ydF9jaGFuZ2UgKTtcbn0oIHdpbmRvdywgZG9jdW1lbnQsIHdpbmRvdy5qUXVlcnkgKSApO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFLFdBQVdBLE1BQU0sRUFBRUMsUUFBUSxFQUFFQyxDQUFDLEVBQUc7RUFDbEMsWUFBWTs7RUFFWixJQUFJQyxhQUFhLEdBQUcsaUNBQWlDO0VBQ3JELElBQUlDLGNBQWMsR0FBRyx1Q0FBdUM7RUFDNUQsSUFBSUMsZUFBZSxHQUFHLHdDQUF3QztFQUM5RCxJQUFJQyx5QkFBeUIsR0FBRyx3Q0FBd0M7RUFDeEUsSUFBSUMsd0JBQXdCLEdBQUcscUNBQXFDO0VBQ3BFLElBQUlDLG1CQUFtQixHQUFHLGdDQUFnQzs7RUFFMUQ7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0MsY0FBY0EsQ0FBRUMsVUFBVSxFQUFHO0lBQ3JDLElBQUlDLEtBQUssR0FBR0MsTUFBTSxDQUFFRixVQUFVLElBQUksRUFBRyxDQUFDLENBQUNDLEtBQUssQ0FBRSwyQkFBNEIsQ0FBQztJQUMzRSxJQUFJRSxXQUFXO0lBRWYsSUFBSyxDQUFFRixLQUFLLEVBQUc7TUFDZCxPQUFPLElBQUk7SUFDWjtJQUNBRSxXQUFXLEdBQUcsSUFBSUMsSUFBSSxDQUFFQyxNQUFNLENBQUVKLEtBQUssQ0FBRSxDQUFDLENBQUcsQ0FBQyxFQUFFSSxNQUFNLENBQUVKLEtBQUssQ0FBRSxDQUFDLENBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRUksTUFBTSxDQUFFSixLQUFLLENBQUUsQ0FBQyxDQUFHLENBQUUsQ0FBQztJQUM5RixJQUNDRSxXQUFXLENBQUNHLFdBQVcsQ0FBQyxDQUFDLEtBQUtELE1BQU0sQ0FBRUosS0FBSyxDQUFFLENBQUMsQ0FBRyxDQUFDLElBQ2xERSxXQUFXLENBQUNJLFFBQVEsQ0FBQyxDQUFDLEtBQUtGLE1BQU0sQ0FBRUosS0FBSyxDQUFFLENBQUMsQ0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUNuREUsV0FBVyxDQUFDSyxPQUFPLENBQUMsQ0FBQyxLQUFLSCxNQUFNLENBQUVKLEtBQUssQ0FBRSxDQUFDLENBQUcsQ0FBQyxFQUM3QztNQUNELE9BQU8sSUFBSTtJQUNaO0lBQ0EsT0FBT0UsV0FBVztFQUNuQjs7RUFFQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU00sa0JBQWtCQSxDQUFBLEVBQUc7SUFDN0IsSUFBS2pCLENBQUMsQ0FBQ2tCLFFBQVEsSUFBSWxCLENBQUMsQ0FBQ2tCLFFBQVEsQ0FBQ0MsS0FBSyxJQUFJbkIsQ0FBQyxDQUFDa0IsUUFBUSxDQUFDQyxLQUFLLENBQUNDLE1BQU0sRUFBRztNQUNoRSxPQUFPcEIsQ0FBQyxDQUFDa0IsUUFBUSxDQUFDQyxLQUFLO0lBQ3hCO0lBQ0EsT0FBT25CLENBQUMsQ0FBRSxlQUFnQixDQUFDLENBQUNxQixLQUFLLENBQUMsQ0FBQztFQUNwQzs7RUFFQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTQyxtQkFBbUJBLENBQUVDLElBQUksRUFBRztJQUNwQyxJQUFJQyxLQUFLLEdBQUd4QixDQUFDLENBQUN5QixJQUFJLENBQUVGLElBQUksRUFBRWpCLG1CQUFvQixDQUFDO0lBRS9DLElBQUssQ0FBRWtCLEtBQUssRUFBRztNQUNkQSxLQUFLLEdBQUc7UUFDUEUscUJBQXFCLEVBQUUsRUFBRTtRQUN6QkMsY0FBYyxFQUFFLENBQUM7UUFDakJDLG9CQUFvQixFQUFFLEtBQUs7UUFDM0JDLHdCQUF3QixFQUFFO01BQzNCLENBQUM7TUFDRDdCLENBQUMsQ0FBQ3lCLElBQUksQ0FBRUYsSUFBSSxFQUFFakIsbUJBQW1CLEVBQUVrQixLQUFNLENBQUM7SUFDM0M7SUFDQSxPQUFPQSxLQUFLO0VBQ2I7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU00sNEJBQTRCQSxDQUFFQyxLQUFLLEVBQUc7SUFDOUMsSUFBSUMsZ0JBQWdCLEdBQUdoQyxDQUFDLENBQUNrQixRQUFRLEdBQUdsQixDQUFDLENBQUNrQixRQUFRLENBQUNlLFFBQVEsR0FBRyxJQUFJO0lBQzlELElBQUlDLGFBQWEsR0FBR0YsZ0JBQWdCLElBQUlBLGdCQUFnQixDQUFDRCxLQUFLLEdBQUdDLGdCQUFnQixDQUFDRCxLQUFLLENBQUUsQ0FBQyxDQUFFLEdBQUcsSUFBSTtJQUVuRyxPQUFPSSxPQUFPLENBQUVuQyxDQUFDLENBQUNrQixRQUFRLElBQUlsQixDQUFDLENBQUNrQixRQUFRLENBQUNrQixrQkFBa0IsSUFBSUYsYUFBYSxLQUFLSCxLQUFNLENBQUM7RUFDekY7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNNLGVBQWVBLENBQUVkLElBQUksRUFBRWUsYUFBYSxFQUFFQyxjQUFjLEVBQUc7SUFDL0QsSUFBSUMsWUFBWSxHQUFHQyxVQUFVLENBQUUzQyxNQUFNLENBQUM0QyxnQkFBZ0IsQ0FBRW5CLElBQUssQ0FBQyxDQUFDb0IsZ0JBQWdCLENBQUVMLGFBQWMsQ0FBRSxDQUFDO0lBRWxHLE9BQU96QixNQUFNLENBQUMrQixRQUFRLENBQUVKLFlBQWEsQ0FBQyxJQUFJQSxZQUFZLElBQUksQ0FBQyxHQUFHQSxZQUFZLEdBQUdELGNBQWM7RUFDNUY7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTTSx1QkFBdUJBLENBQUV0QixJQUFJLEVBQUc7SUFDeEMsSUFBSXVCLE1BQU0sR0FBR3ZCLElBQUksQ0FBQ3dCLGFBQWEsQ0FBRTVDLGVBQWdCLENBQUM7SUFDbEQsSUFBSTZDLE1BQU0sR0FBRy9CLGtCQUFrQixDQUFDLENBQUM7SUFDakMsSUFBSWdDLEtBQUssR0FBR0QsTUFBTSxDQUFFLENBQUMsQ0FBRTtJQUN2QixJQUFJRSxnQkFBZ0I7SUFDcEIsSUFBSUMsZUFBZTtJQUNuQixJQUFJQyxjQUFjO0lBQ2xCLElBQUlDLGVBQWU7SUFDbkIsSUFBSUMsUUFBUTtJQUNaLElBQUlDLFFBQVE7SUFDWixJQUFJQyxlQUFlO0lBQ25CLElBQUlDLFNBQVM7SUFDYixJQUFJQyxZQUFZO0lBQ2hCLElBQUlDLFlBQVk7SUFDaEIsSUFBSUMsSUFBSTtJQUNSLElBQUlDLEtBQUs7SUFDVCxJQUFJQyxLQUFLO0lBQ1QsSUFBSUMsR0FBRztJQUNQLElBQUlDLE1BQU07SUFFVixJQUFLLENBQUVsQixNQUFNLElBQUksQ0FBRUcsS0FBSyxJQUFJLENBQUUxQixJQUFJLENBQUMwQyxTQUFTLENBQUNDLFFBQVEsQ0FBRSxTQUFVLENBQUMsSUFBSSxDQUFFcEMsNEJBQTRCLENBQUVQLElBQUksQ0FBQ3dCLGFBQWEsQ0FBRTdDLGNBQWUsQ0FBRSxDQUFDLEVBQUc7TUFDOUk7SUFDRDtJQUNBZ0QsZ0JBQWdCLEdBQUdKLE1BQU0sQ0FBQ3FCLHFCQUFxQixDQUFDLENBQUM7SUFDakRoQixlQUFlLEdBQUdGLEtBQUssQ0FBQ2tCLHFCQUFxQixDQUFDLENBQUM7SUFDL0NmLGNBQWMsR0FBR3JELFFBQVEsQ0FBQ3FFLGVBQWUsQ0FBQ0MsV0FBVyxJQUFJdkUsTUFBTSxDQUFDd0UsVUFBVTtJQUMxRWpCLGVBQWUsR0FBR3RELFFBQVEsQ0FBQ3FFLGVBQWUsQ0FBQ0csWUFBWSxJQUFJekUsTUFBTSxDQUFDMEUsV0FBVztJQUM3RWxCLFFBQVEsR0FBR3hELE1BQU0sQ0FBQzJFLFdBQVcsSUFBSTFFLFFBQVEsQ0FBQ3FFLGVBQWUsQ0FBQ00sVUFBVSxJQUFJLENBQUM7SUFDekVuQixRQUFRLEdBQUd6RCxNQUFNLENBQUM2RSxXQUFXLElBQUk1RSxRQUFRLENBQUNxRSxlQUFlLENBQUNRLFNBQVMsSUFBSSxDQUFDO0lBQ3hFcEIsZUFBZSxHQUFHbkIsZUFBZSxDQUFFZCxJQUFJLEVBQUUsK0NBQStDLEVBQUUsQ0FBRSxDQUFDO0lBQzdGa0MsU0FBUyxHQUFHcEIsZUFBZSxDQUFFZCxJQUFJLEVBQUUsdUNBQXVDLEVBQUUsQ0FBRSxDQUFDO0lBQy9FbUMsWUFBWSxHQUFHSixRQUFRLEdBQUdFLGVBQWU7SUFDekNHLFlBQVksR0FBR2tCLElBQUksQ0FBQ0MsR0FBRyxDQUFFcEIsWUFBWSxFQUFFSixRQUFRLEdBQUdGLGNBQWMsR0FBR0QsZUFBZSxDQUFDNEIsS0FBSyxHQUFHdkIsZUFBZ0IsQ0FBQztJQUM1R1EsTUFBTSxHQUFHLEtBQUssS0FBS2xFLE1BQU0sQ0FBQzRDLGdCQUFnQixDQUFFbkIsSUFBSyxDQUFDLENBQUN5RCxTQUFTO0lBQzVEcEIsSUFBSSxHQUFHSSxNQUFNLEdBQUdkLGdCQUFnQixDQUFDVSxJQUFJLEdBQUdOLFFBQVEsR0FBR0osZ0JBQWdCLENBQUMrQixLQUFLLEdBQUczQixRQUFRLEdBQUdILGVBQWUsQ0FBQzRCLEtBQUs7SUFDNUduQixJQUFJLEdBQUdpQixJQUFJLENBQUNLLEdBQUcsQ0FBRUwsSUFBSSxDQUFDQyxHQUFHLENBQUVsQixJQUFJLEVBQUVGLFlBQWEsQ0FBQyxFQUFFQyxZQUFhLENBQUM7SUFDL0RFLEtBQUssR0FBR1gsZ0JBQWdCLENBQUNpQyxNQUFNLEdBQUc1QixRQUFRLEdBQUdFLFNBQVM7SUFDdERLLEtBQUssR0FBR1osZ0JBQWdCLENBQUNhLEdBQUcsR0FBR1IsUUFBUSxHQUFHSixlQUFlLENBQUNpQyxNQUFNLEdBQUczQixTQUFTO0lBQzVFTSxHQUFHLEdBQUdGLEtBQUs7SUFDWCxJQUFLQSxLQUFLLEdBQUdWLGVBQWUsQ0FBQ2lDLE1BQU0sR0FBRzdCLFFBQVEsR0FBR0YsZUFBZSxHQUFHRyxlQUFlLElBQUlNLEtBQUssSUFBSVAsUUFBUSxHQUFHQyxlQUFlLEVBQUc7TUFDM0hPLEdBQUcsR0FBR0QsS0FBSztJQUNaO0lBQ0FkLE1BQU0sQ0FBQ3FDLEdBQUcsQ0FBRTtNQUNYekIsSUFBSSxFQUFFaUIsSUFBSSxDQUFDUyxLQUFLLENBQUUxQixJQUFLLENBQUMsR0FBRyxJQUFJO01BQy9CMkIsUUFBUSxFQUFFLFVBQVU7TUFDcEJ4QixHQUFHLEVBQUVjLElBQUksQ0FBQ1MsS0FBSyxDQUFFVCxJQUFJLENBQUNDLEdBQUcsQ0FBRXZCLFFBQVEsR0FBR0MsZUFBZSxFQUFFTyxHQUFJLENBQUUsQ0FBQyxHQUFHO0lBQ2xFLENBQUUsQ0FBQztFQUNKOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVN5QiwwQkFBMEJBLENBQUVqRSxJQUFJLEVBQUc7SUFDM0MsSUFBSUMsS0FBSyxHQUFHRixtQkFBbUIsQ0FBRUMsSUFBSyxDQUFDO0lBQ3ZDLElBQUlrRSxhQUFhLEdBQUczRixNQUFNLENBQUM0RixxQkFBcUIsSUFBSSxVQUFXQyxRQUFRLEVBQUc7TUFDekUsT0FBTzdGLE1BQU0sQ0FBQzhGLFVBQVUsQ0FBRUQsUUFBUSxFQUFFLEVBQUcsQ0FBQztJQUN6QyxDQUFDO0lBRUQsSUFBS25FLEtBQUssQ0FBQ0csY0FBYyxFQUFHO01BQzNCO0lBQ0Q7SUFDQUgsS0FBSyxDQUFDRyxjQUFjLEdBQUc4RCxhQUFhLENBQUUsWUFBWTtNQUNqRGpFLEtBQUssQ0FBQ0csY0FBYyxHQUFHLENBQUM7TUFDeEJrQix1QkFBdUIsQ0FBRXRCLElBQUssQ0FBQztJQUNoQyxDQUFFLENBQUM7RUFDSjs7RUFFQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTc0Usd0JBQXdCQSxDQUFFdEUsSUFBSSxFQUFHO0lBQ3pDLElBQUlDLEtBQUssR0FBR0YsbUJBQW1CLENBQUVDLElBQUssQ0FBQztJQUN2QyxJQUFJdUUsWUFBWSxHQUFHaEcsTUFBTSxDQUFDaUcsb0JBQW9CLElBQUlqRyxNQUFNLENBQUNrRyxZQUFZO0lBRXJFLElBQUt4RSxLQUFLLENBQUNHLGNBQWMsRUFBRztNQUMzQm1FLFlBQVksQ0FBQ0csSUFBSSxDQUFFbkcsTUFBTSxFQUFFMEIsS0FBSyxDQUFDRyxjQUFlLENBQUM7TUFDakRILEtBQUssQ0FBQ0csY0FBYyxHQUFHLENBQUM7SUFDekI7RUFDRDs7RUFFQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTdUUsbUJBQW1CQSxDQUFFM0UsSUFBSSxFQUFHO0lBQ3BDTixrQkFBa0IsQ0FBQyxDQUFDLENBQ2xCa0YsSUFBSSxDQUFFL0YseUJBQXlCLEVBQUUsTUFBTyxDQUFDLENBQ3pDK0YsSUFBSSxDQUFFOUYsd0JBQXdCLEVBQUVrQixJQUFJLENBQUM2RSxZQUFZLENBQUUsK0JBQWdDLENBQUMsSUFBSSxFQUFHLENBQUM7RUFDL0Y7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0MscUJBQXFCQSxDQUFFOUUsSUFBSSxFQUFHO0lBQ3RDLElBQUkrRSxRQUFRLEdBQUcvRSxJQUFJLENBQUM2RSxZQUFZLENBQUUsK0JBQWdDLENBQUMsSUFBSSxFQUFFO0lBRXpFbkYsa0JBQWtCLENBQUMsQ0FBQyxDQUFDc0YsSUFBSSxDQUFFLFlBQVk7TUFDdEMsSUFBSXZELE1BQU0sR0FBR2hELENBQUMsQ0FBRSxJQUFLLENBQUM7TUFFdEIsSUFBS3NHLFFBQVEsS0FBS3RELE1BQU0sQ0FBQ21ELElBQUksQ0FBRTlGLHdCQUF5QixDQUFDLEVBQUc7UUFDM0QyQyxNQUFNLENBQUN3RCxVQUFVLENBQUVuRyx3QkFBeUIsQ0FBQyxDQUFDbUcsVUFBVSxDQUFFcEcseUJBQTBCLENBQUM7TUFDdEY7SUFDRCxDQUFFLENBQUM7RUFDSjs7RUFFQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU3FHLHdCQUF3QkEsQ0FBRWxGLElBQUksRUFBRW1GLFVBQVUsRUFBRUMsWUFBWSxFQUFHO0lBQ25FLElBQUlDLGVBQWU7SUFFbkIsSUFBSyxVQUFVLEtBQUssT0FBTzlHLE1BQU0sQ0FBQytHLFdBQVcsRUFBRztNQUMvQ0QsZUFBZSxHQUFHLElBQUk5RyxNQUFNLENBQUMrRyxXQUFXLENBQUVILFVBQVUsRUFBRTtRQUNyREksT0FBTyxFQUFFLElBQUk7UUFDYkMsTUFBTSxFQUFFSjtNQUNULENBQUUsQ0FBQztJQUNKLENBQUMsTUFBTTtNQUNOQyxlQUFlLEdBQUc3RyxRQUFRLENBQUNpSCxXQUFXLENBQUUsYUFBYyxDQUFDO01BQ3ZESixlQUFlLENBQUNLLGVBQWUsQ0FBRVAsVUFBVSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUVDLFlBQWEsQ0FBQztJQUN6RTtJQUNBcEYsSUFBSSxDQUFDMkYsYUFBYSxDQUFFTixlQUFnQixDQUFDO0VBQ3RDOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU08sZUFBZUEsQ0FBRXBGLEtBQUssRUFBRVIsSUFBSSxFQUFHO0lBQ3ZDLElBQUlDLEtBQUs7SUFFVCxJQUFLLENBQUVPLEtBQUssSUFBSSxDQUFFL0IsQ0FBQyxDQUFDa0IsUUFBUSxJQUFJLENBQUVsQixDQUFDLENBQUNrQixRQUFRLENBQUNrRyxhQUFhLElBQUksQ0FBRXBILENBQUMsQ0FBRStCLEtBQU0sQ0FBQyxDQUFDc0YsUUFBUSxDQUFFckgsQ0FBQyxDQUFDa0IsUUFBUSxDQUFDb0csZUFBZ0IsQ0FBQyxFQUFHO01BQ25IO0lBQ0Q7SUFDQTlGLEtBQUssR0FBR0YsbUJBQW1CLENBQUVDLElBQUssQ0FBQztJQUNuQyxJQUFLQyxLQUFLLENBQUNLLHdCQUF3QixJQUFJQyw0QkFBNEIsQ0FBRUMsS0FBTSxDQUFDLEVBQUc7TUFDOUVQLEtBQUssQ0FBQ0ssd0JBQXdCLEdBQUcsS0FBSztNQUN0Q0wsS0FBSyxDQUFDSSxvQkFBb0IsR0FBRyxJQUFJO01BQ2pDLElBQUs1QixDQUFDLENBQUNrQixRQUFRLENBQUNrQixrQkFBa0IsRUFBRztRQUNwQ3BDLENBQUMsQ0FBQ2tCLFFBQVEsQ0FBQ3FHLGFBQWEsQ0FBRSxJQUFJLEVBQUUsRUFBRyxDQUFDO01BQ3JDO01BQ0E7SUFDRDtJQUNBL0YsS0FBSyxDQUFDSyx3QkFBd0IsR0FBRyxLQUFLO0lBQ3RDLElBQUs3QixDQUFDLENBQUNrQixRQUFRLENBQUNrQixrQkFBa0IsSUFBSXBDLENBQUMsQ0FBQ2tCLFFBQVEsQ0FBQ3FHLGFBQWEsRUFBRztNQUNoRXZILENBQUMsQ0FBQ2tCLFFBQVEsQ0FBQ3FHLGFBQWEsQ0FBRSxJQUFJLEVBQUUsRUFBRyxDQUFDO0lBQ3JDO0lBQ0EsSUFBS3ZILENBQUMsQ0FBQ2tCLFFBQVEsQ0FBQ3NHLFVBQVUsS0FBS3pGLEtBQUssRUFBRztNQUN0Qy9CLENBQUMsQ0FBQ2tCLFFBQVEsQ0FBQ3NHLFVBQVUsR0FBRyxJQUFJO0lBQzdCO0lBQ0FoRyxLQUFLLENBQUNJLG9CQUFvQixHQUFHLElBQUk7SUFDakM1QixDQUFDLENBQUNrQixRQUFRLENBQUNrRyxhQUFhLENBQUVyRixLQUFNLENBQUM7SUFDakNjLHVCQUF1QixDQUFFdEIsSUFBSyxDQUFDO0lBQy9CaUUsMEJBQTBCLENBQUVqRSxJQUFLLENBQUM7RUFDbkM7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU2tHLHFCQUFxQkEsQ0FBRWxHLElBQUksRUFBRztJQUN0QyxJQUFJUSxLQUFLLEdBQUdSLElBQUksQ0FBQ3dCLGFBQWEsQ0FBRTdDLGNBQWUsQ0FBQztJQUNoRCxJQUFJNEMsTUFBTSxHQUFHdkIsSUFBSSxDQUFDd0IsYUFBYSxDQUFFNUMsZUFBZ0IsQ0FBQztJQUNsRCxJQUFJdUgsU0FBUyxHQUFHN0MsSUFBSSxDQUFDQyxHQUFHLENBQUUsQ0FBQyxFQUFFRCxJQUFJLENBQUNLLEdBQUcsQ0FBRSxDQUFDLEVBQUVyRSxNQUFNLENBQUVVLElBQUksQ0FBQzZFLFlBQVksQ0FBRSxnQkFBaUIsQ0FBRSxDQUFDLElBQUksQ0FBRSxDQUFFLENBQUM7SUFDbEcsSUFBSTVFLEtBQUs7SUFFVCxJQUFLLENBQUVPLEtBQUssSUFBSSxDQUFFZSxNQUFNLElBQUksQ0FBRTlDLENBQUMsQ0FBQzJILEVBQUUsQ0FBQ3pHLFFBQVEsSUFBSUssSUFBSSxDQUFDcUcsWUFBWSxDQUFFLDJCQUE0QixDQUFDLEVBQUc7TUFDakcsT0FBTyxLQUFLO0lBQ2I7SUFDQXJHLElBQUksQ0FBQ3NHLFlBQVksQ0FBRSwyQkFBMkIsRUFBRSxNQUFPLENBQUM7SUFDeERyRyxLQUFLLEdBQUdGLG1CQUFtQixDQUFFQyxJQUFLLENBQUM7SUFDbkN2QixDQUFDLENBQUUrQixLQUFNLENBQUMsQ0FBQ2IsUUFBUSxDQUFFO01BQ3BCNEcsVUFBVSxFQUFFLFNBQUFBLENBQUEsRUFBWTtRQUN2QnZHLElBQUksQ0FBQzBDLFNBQVMsQ0FBQzhELEdBQUcsQ0FBRSxTQUFVLENBQUM7UUFDL0JqRixNQUFNLENBQUMrRSxZQUFZLENBQUUsZUFBZSxFQUFFLE1BQU8sQ0FBQztRQUM5QzNCLG1CQUFtQixDQUFFM0UsSUFBSyxDQUFDO01BQzVCLENBQUM7TUFDRHlHLGFBQWEsRUFBRSxTQUFBQSxDQUFBLEVBQVk7UUFDMUIsT0FBTyxDQUFFLElBQUksRUFBRSxnQkFBZ0IsQ0FBRTtNQUNsQyxDQUFDO01BQ0RDLFFBQVEsRUFBRSxTQUFBQSxDQUFXQyxhQUFhLEVBQUc7UUFDcEMsSUFBSUMsY0FBYyxHQUFHekgsTUFBTSxDQUFFd0gsYUFBYSxJQUFJLEVBQUcsQ0FBQyxDQUFDRSxLQUFLLENBQUUsY0FBZSxDQUFDLENBQUUsQ0FBQyxDQUFFO1FBRS9FLElBQUssQ0FBRTdILGNBQWMsQ0FBRTRILGNBQWUsQ0FBQyxFQUFHO1VBQ3pDO1FBQ0Q7UUFDQXBHLEtBQUssQ0FBQ3NHLEtBQUssR0FBR0YsY0FBYztRQUM1QjVHLElBQUksQ0FBQ3NHLFlBQVksQ0FBRSxvQkFBb0IsRUFBRU0sY0FBZSxDQUFDO1FBQ3pEM0csS0FBSyxDQUFDRSxxQkFBcUIsR0FBR3lHLGNBQWM7UUFDNUMzRyxLQUFLLENBQUNJLG9CQUFvQixHQUFHLElBQUk7TUFDbEMsQ0FBQztNQUNEMEcsT0FBTyxFQUFFLFNBQUFBLENBQUEsRUFBWTtRQUNwQnpDLHdCQUF3QixDQUFFdEUsSUFBSyxDQUFDO1FBQ2hDQSxJQUFJLENBQUMwQyxTQUFTLENBQUNzRSxNQUFNLENBQUUsU0FBVSxDQUFDO1FBQ2xDekYsTUFBTSxDQUFDK0UsWUFBWSxDQUFFLGVBQWUsRUFBRSxPQUFRLENBQUM7UUFDL0MvSCxNQUFNLENBQUM4RixVQUFVLENBQUUsWUFBWTtVQUM5QixJQUFJdUMsY0FBYyxHQUFHM0csS0FBSyxDQUFDRSxxQkFBcUI7VUFFaEQyRSxxQkFBcUIsQ0FBRTlFLElBQUssQ0FBQztVQUM3QixJQUFLQyxLQUFLLENBQUNJLG9CQUFvQixJQUFJN0IsUUFBUSxDQUFDcUUsZUFBZSxDQUFDRixRQUFRLENBQUVwQixNQUFPLENBQUMsRUFBRztZQUNoRnRCLEtBQUssQ0FBQ0ksb0JBQW9CLEdBQUcsS0FBSztZQUNsQ2tCLE1BQU0sQ0FBQzBGLEtBQUssQ0FBQyxDQUFDO1VBQ2Y7VUFDQSxJQUFLTCxjQUFjLEVBQUc7WUFDckIzRyxLQUFLLENBQUNFLHFCQUFxQixHQUFHLEVBQUU7WUFDaEMrRSx3QkFBd0IsQ0FBRWxGLElBQUksRUFBRSxpQ0FBaUMsRUFBRTtjQUNsRWtILEVBQUUsRUFBRWxILElBQUksQ0FBQzZFLFlBQVksQ0FBRSwrQkFBZ0MsQ0FBQyxJQUFJLEVBQUU7Y0FDOURzQyxJQUFJLEVBQUVQO1lBQ1AsQ0FBRSxDQUFDO1VBQ0o7UUFDRCxDQUFDLEVBQUUsQ0FBRSxDQUFDO01BQ1AsQ0FBQztNQUNEUSxNQUFNLEVBQUUsT0FBTztNQUNmQyxRQUFRLEVBQUUsTUFBTTtNQUNoQkMsUUFBUSxFQUFFLEVBQUU7TUFDWkMsV0FBVyxFQUFFLENBQUM7TUFDZEMsY0FBYyxFQUFFLENBQUM7TUFDakJDLFVBQVUsRUFBRSxDQUFDO01BQ2JDLFFBQVEsRUFBRSxVQUFVO01BQ3BCQyxRQUFRLEVBQUUsVUFBVTtNQUNwQkMsVUFBVSxFQUFFLFVBQVU7TUFDdEJDLFdBQVcsRUFBRSxLQUFLO01BQ2xCQyxVQUFVLEVBQUUsS0FBSztNQUNqQkMsT0FBTyxFQUFFLElBQUk7TUFDYkMsT0FBTyxFQUFFLElBQUk7TUFDYkMsVUFBVSxFQUFFLEtBQUs7TUFDakJDLGNBQWMsRUFBRSxJQUFJO01BQ3BCQyxVQUFVLEVBQUUsSUFBSTtNQUNoQkMsUUFBUSxFQUFFakMsU0FBUztNQUNuQmtDLFdBQVcsRUFBRSxLQUFLO01BQ2xCQyxnQkFBZ0IsRUFBRSxJQUFJO01BQ3RCQyxjQUFjLEVBQUUsS0FBSztNQUNyQkMsU0FBUyxFQUFFO0lBQ1osQ0FBRSxDQUFDO0lBQ0gsT0FBTyxJQUFJO0VBQ1o7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTQyxtQkFBbUJBLENBQUVDLEtBQUssRUFBRztJQUNyQyxJQUFJbkgsTUFBTSxHQUFHbUgsS0FBSyxDQUFDQyxNQUFNLENBQUNDLE9BQU8sR0FBR0YsS0FBSyxDQUFDQyxNQUFNLENBQUNDLE9BQU8sQ0FBRWhLLGVBQWdCLENBQUMsR0FBRyxJQUFJO0lBQ2xGLElBQUlvQixJQUFJLEdBQUd1QixNQUFNLEdBQUdBLE1BQU0sQ0FBQ3FILE9BQU8sQ0FBRWxLLGFBQWMsQ0FBQyxHQUFHLElBQUk7SUFDMUQsSUFBSThCLEtBQUssR0FBR1IsSUFBSSxHQUFHQSxJQUFJLENBQUN3QixhQUFhLENBQUU3QyxjQUFlLENBQUMsR0FBRyxJQUFJO0lBRTlELElBQUtxQixJQUFJLElBQUlRLEtBQUssRUFBRztNQUNwQlQsbUJBQW1CLENBQUVDLElBQUssQ0FBQyxDQUFDTSx3QkFBd0IsR0FBR0MsNEJBQTRCLENBQUVDLEtBQU0sQ0FBQztJQUM3RjtFQUNEOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNxSSxZQUFZQSxDQUFFSCxLQUFLLEVBQUc7SUFDOUIsSUFBSUksTUFBTSxHQUFHSixLQUFLLENBQUNDLE1BQU0sQ0FBQ0MsT0FBTyxDQUFFLHdDQUF5QyxDQUFDO0lBQzdFLElBQUlySCxNQUFNLEdBQUdtSCxLQUFLLENBQUNDLE1BQU0sQ0FBQ0MsT0FBTyxDQUFFaEssZUFBZ0IsQ0FBQztJQUNwRCxJQUFJb0IsSUFBSSxHQUFHOEksTUFBTSxJQUFJdkgsTUFBTSxHQUFHbUgsS0FBSyxDQUFDQyxNQUFNLENBQUNDLE9BQU8sQ0FBRWxLLGFBQWMsQ0FBQyxHQUFHLElBQUk7SUFDMUUsSUFBSThCLEtBQUs7SUFFVCxJQUFLLENBQUVSLElBQUksRUFBRztNQUNiO0lBQ0Q7SUFDQSxJQUFLOEksTUFBTSxFQUFHO01BQ2I1RCx3QkFBd0IsQ0FBRWxGLElBQUksRUFBRSxpQ0FBaUMsRUFBRTtRQUNsRWtILEVBQUUsRUFBRWxILElBQUksQ0FBQzZFLFlBQVksQ0FBRSwrQkFBZ0MsQ0FBQyxJQUFJO01BQzdELENBQUUsQ0FBQztNQUNIO0lBQ0Q7SUFDQXFCLHFCQUFxQixDQUFFbEcsSUFBSyxDQUFDO0lBQzdCUSxLQUFLLEdBQUdSLElBQUksQ0FBQ3dCLGFBQWEsQ0FBRTdDLGNBQWUsQ0FBQztJQUM1QyxJQUFLNkIsS0FBSyxJQUFJL0IsQ0FBQyxDQUFDa0IsUUFBUSxJQUFJbEIsQ0FBQyxDQUFFK0IsS0FBTSxDQUFDLENBQUNzRixRQUFRLENBQUVySCxDQUFDLENBQUNrQixRQUFRLENBQUNvRyxlQUFnQixDQUFDLEVBQUc7TUFDL0VILGVBQWUsQ0FBRXBGLEtBQUssRUFBRVIsSUFBSyxDQUFDO0lBQy9CO0VBQ0Q7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVMrSSxzQkFBc0JBLENBQUEsRUFBRztJQUNqQ0MsS0FBSyxDQUFDQyxTQUFTLENBQUNDLE9BQU8sQ0FBQ3hFLElBQUksQ0FBRWxHLFFBQVEsQ0FBQzJLLGdCQUFnQixDQUFFekssYUFBYSxHQUFHLFVBQVcsQ0FBQyxFQUFFLFVBQVdzQixJQUFJLEVBQUc7TUFDeEdpRSwwQkFBMEIsQ0FBRWpFLElBQUssQ0FBQztJQUNuQyxDQUFFLENBQUM7RUFDSjtFQUVBeEIsUUFBUSxDQUFDNEssZ0JBQWdCLENBQUUsV0FBVyxFQUFFWCxtQkFBbUIsRUFBRSxJQUFLLENBQUM7RUFDbkVqSyxRQUFRLENBQUM0SyxnQkFBZ0IsQ0FBRSxPQUFPLEVBQUVQLFlBQWEsQ0FBQztFQUNsRHJLLFFBQVEsQ0FBQzRLLGdCQUFnQixDQUFFLFFBQVEsRUFBRUwsc0JBQXNCLEVBQUUsSUFBSyxDQUFDO0VBQ25FeEssTUFBTSxDQUFDNkssZ0JBQWdCLENBQUUsUUFBUSxFQUFFTCxzQkFBdUIsQ0FBQztBQUM1RCxDQUFDLEVBQUV4SyxNQUFNLEVBQUVDLFFBQVEsRUFBRUQsTUFBTSxDQUFDOEssTUFBTyxDQUFDIiwiaWdub3JlTGlzdCI6W119
