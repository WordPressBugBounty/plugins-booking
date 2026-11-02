"use strict";

/**
 * Domain-neutral shared administration date-range navigation interactions.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
(function (window, document, $) {
  'use strict';

  var root_selector = '[data-wpbc-shared-ui-date-range-navigation]';
  var start_selector = '[data-wpbc-shared-ui-date-range-start]';
  var end_selector = '[data-wpbc-shared-ui-date-range-end]';
  var trigger_selector = '[data-wpbc-shared-ui-popover-trigger]';
  var datepick_marker_attribute = 'data-wpbc-shared-ui-date-range-navigation-datepick';
  var component_state_key = 'wpbc_shared_ui_date_range_navigation_state';

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
   * Format a Date as a strict local ISO calendar date.
   *
   * @param {Date} date_value Calendar date.
   * @return {string} YYYY-MM-DD value.
   */
  function format_iso_date(date_value) {
    var year = date_value.getFullYear();
    var month = ('0' + String(date_value.getMonth() + 1)).slice(-2);
    var day = ('0' + String(date_value.getDate())).slice(-2);
    return year + '-' + month + '-' + day;
  }

  /**
   * Return the inclusive number of calendar days between two dates.
   *
   * UTC arithmetic prevents daylight-saving transitions from changing the
   * number of selected calendar dates.
   *
   * @param {Date} start_date Inclusive first date.
   * @param {Date} end_date   Inclusive last date.
   * @return {number} Inclusive signed day count.
   */
  function get_inclusive_day_count(start_date, end_date) {
    var start_epoch = Date.UTC(start_date.getFullYear(), start_date.getMonth(), start_date.getDate());
    var end_epoch = Date.UTC(end_date.getFullYear(), end_date.getMonth(), end_date.getDate());
    return Math.round((end_epoch - start_epoch) / 86400000) + 1;
  }

  /**
   * Add whole calendar days to one local Date without mutating the source.
   *
   * @param {Date} date_value Source calendar date.
   * @param {number} day_count Number of days to add.
   * @return {Date} Shifted calendar date.
   */
  function add_days(date_value, day_count) {
    var shifted_date = new Date(date_value.getFullYear(), date_value.getMonth(), date_value.getDate());
    shifted_date.setDate(shifted_date.getDate() + day_count);
    return shifted_date;
  }

  /**
   * Read and validate the current paired-date draft.
   *
   * @param {HTMLElement} root Component root.
   * @return {Object} Validation result and normalized dates.
   */
  function validate_draft(root) {
    var start_input = root.querySelector(start_selector);
    var end_input = root.querySelector(end_selector);
    var maximum_span_days = Math.max(1, Number(root.getAttribute('data-maximum-span-days')) || 1);
    var start_date = start_input ? parse_iso_date(start_input.value) : null;
    var end_date = end_input ? parse_iso_date(end_input.value) : null;
    var span_days = start_date && end_date ? get_inclusive_day_count(start_date, end_date) : 0;
    var is_ordered = 0 < span_days;
    var is_within_maximum = is_ordered && span_days <= maximum_span_days;
    return {
      is_valid: Boolean(start_date && end_date && is_ordered && is_within_maximum),
      is_within_maximum: is_within_maximum,
      start_date: start_date,
      end_date: end_date,
      start_value: start_date ? format_iso_date(start_date) : '',
      end_value: end_date ? format_iso_date(end_date) : '',
      span_days: span_days
    };
  }

  /**
   * Display validation state without changing the caller's authorized data.
   *
   * @param {HTMLElement} root Component root.
   * @return {Object} Current validation result.
   */
  function synchronize_validation(root) {
    var validation = validate_draft(root);
    var start_input = root.querySelector(start_selector);
    var end_input = root.querySelector(end_selector);
    var apply_button = root.querySelector('[data-wpbc-shared-ui-date-range-apply]');
    var status = root.querySelector('[data-wpbc-shared-ui-date-range-status]');
    var invalid_message = root.querySelector('[data-wpbc-shared-ui-date-range-invalid-message]');
    var maximum_message = root.querySelector('[data-wpbc-shared-ui-date-range-maximum-message]');
    var message = '';
    if (!validation.is_valid) {
      message = 0 < validation.span_days && !validation.is_within_maximum ? maximum_message ? maximum_message.textContent : '' : invalid_message ? invalid_message.textContent : '';
    }
    if (start_input) {
      start_input.setAttribute('aria-invalid', validation.start_date ? 'false' : 'true');
    }
    if (end_input) {
      end_input.setAttribute('aria-invalid', validation.end_date && 0 < validation.span_days ? 'false' : 'true');
    }
    if (apply_button) {
      apply_button.disabled = !validation.is_valid;
    }
    if (status) {
      status.textContent = message;
    }
    return validation;
  }

  /**
   * Return private interaction state for one rendered component.
   *
   * Canonical dates may change without replacing the toolbar node after an AJAX
   * response. Detecting that change resets draft sequencing so an End-first
   * interaction is again measured from the newly authorized Timeline range.
   *
   * @param {HTMLElement} root Component root.
   * @return {Object} Mutable component-local interaction state.
   */
  function get_component_state(root) {
    var canonical_start = root.getAttribute('data-start-date') || '';
    var canonical_end = root.getAttribute('data-end-date') || '';
    var state = $.data(root, component_state_key);
    if (!state) {
      state = {
        active_input: null,
        canonical_start: canonical_start,
        canonical_end: canonical_end,
        pending_end_handoff: false,
        start_was_edited: false
      };
      $.data(root, component_state_key, state);
    } else if (state.canonical_start !== canonical_start || state.canonical_end !== canonical_end) {
      state.active_input = null;
      state.canonical_start = canonical_start;
      state.canonical_end = canonical_end;
      state.pending_end_handoff = false;
      state.start_was_edited = false;
    }
    return state;
  }

  /**
   * Return dynamic options for the datepicker instance being opened.
   *
   * The bundled datepicker uses one popup for every input. Its public `option`
   * command redraws that singleton, so changing End while Start is visible can
   * transfer the rendered calendar to the wrong field. Returning options from
   * `beforeShow` configures only the instance that is about to become active.
   * End remains unconstrained when it is the first edited boundary so users can
   * move the existing inclusive range in either direction.
   *
   * @param {HTMLElement} root  Component root.
   * @param {HTMLElement} input Date input that is about to open.
   * @param {Object}      state Component-local interaction state.
   * @return {Object} Datepicker options for this open operation.
   */
  function get_datepicker_open_options(root, input, state) {
    var start_input = root.querySelector(start_selector);
    var start_date = start_input ? parse_iso_date(start_input.value) : null;
    var maximum_span_days = Math.max(1, Number(root.getAttribute('data-maximum-span-days')) || 1);
    if (!input.matches(end_selector) || !state.start_was_edited || !start_date) {
      return {
        minDate: null,
        maxDate: null
      };
    }
    return {
      minDate: start_date,
      maxDate: add_days(start_date, maximum_span_days - 1)
    };
  }

  /**
   * Preserve the canonical inclusive span when End is selected first.
   *
   * This changes only the local Start draft. It does not focus Start, open its
   * datepicker, dispatch an apply event, or write domain data.
   *
   * @param {HTMLElement} root              Component root.
   * @param {Date}        selected_end_date Newly selected End calendar date.
   * @return {void}
   */
  function preserve_span_from_selected_end(root, selected_end_date) {
    var start_input = root.querySelector(start_selector);
    var canonical_start = parse_iso_date(root.getAttribute('data-start-date') || '');
    var canonical_end = parse_iso_date(root.getAttribute('data-end-date') || '');
    var canonical_span_days = canonical_start && canonical_end ? get_inclusive_day_count(canonical_start, canonical_end) : 0;
    if (!start_input || !selected_end_date || canonical_span_days < 1) {
      return;
    }
    start_input.value = format_iso_date(add_days(selected_end_date, 1 - canonical_span_days));
  }

  /**
   * Return the single popup owned by the bundled Booking Calendar datepicker.
   *
   * The datepicker reuses one body-appended element for every input. Referencing
   * that singleton directly avoids styling inline calendars or popup elements
   * created by unrelated libraries.
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
   * Mark the shared datepicker popup for scoped presentation.
   *
   * @param {HTMLElement} root Component root that owns the portaled datepicker.
   * @return {void}
   */
  function mark_datepick_popup(root) {
    var popover = root.querySelector('[data-wpbc-shared-ui-popover]');
    var owner_id = popover ? popover.getAttribute('data-wpbc-shared-ui-popover') : '';
    var $datepick_popup = get_datepick_popup();
    $datepick_popup.attr(datepick_marker_attribute, 'true');
    if (owner_id) {
      $datepick_popup.attr('data-wpbc-shared-ui-popover-owner', owner_id);
    }
  }

  /**
   * Remove external ownership after the standard datepicker closes.
   *
   * @param {HTMLElement} root Component root that owned the datepicker.
   * @return {void}
   */
  function unmark_datepick_popup(root) {
    var popover = root.querySelector('[data-wpbc-shared-ui-popover]');
    var owner_id = popover ? popover.getAttribute('data-wpbc-shared-ui-popover') : '';
    get_datepick_popup().each(function () {
      var $datepick_popup = $(this);
      if (owner_id === $datepick_popup.attr('data-wpbc-shared-ui-popover-owner')) {
        $datepick_popup.removeAttr('data-wpbc-shared-ui-popover-owner').removeAttr(datepick_marker_attribute);
      }
    });
  }

  /**
   * Release popup ownership after the datepicker completes its close cycle.
   *
   * Switching directly between the paired inputs closes the first datepicker
   * while opening the second one in the same JavaScript turn. Deferring cleanup
   * lets the new active instance retain the component marker used for sizing,
   * positioning, and outside-click ownership.
   *
   * @param {HTMLElement} root Component root that owned the datepicker.
   * @return {void}
   */
  function schedule_datepick_popup_cleanup(root) {
    window.setTimeout(function () {
      var current_instance = $.datepick ? $.datepick._curInst : null;
      var current_input = current_instance && current_instance.input ? current_instance.input[0] : null;
      var current_root = current_input && current_input.closest ? current_input.closest(root_selector) : null;
      if ($.datepick && $.datepick._datepickerShowing && current_root === root) {
        mark_datepick_popup(root);
        return;
      }
      unmark_datepick_popup(root);
    }, 0);
  }

  /**
   * Open the standard datepicker when direct focus initialized it too late.
   *
   * Normal pointer and keyboard paths initialize from the range trigger before a
   * date field receives focus. This fallback preserves programmatic focus and
   * dynamically revealed input paths where the plugin missed that focus event.
   *
   * @param {HTMLElement} input Date input.
   * @param {HTMLElement} root  Component root.
   * @return {void}
   */
  function show_datepicker(input, root) {
    var current_instance;
    var current_input;
    if (!input || !$.datepick || !$.datepick._showDatepick || !$(input).hasClass($.datepick.markerClassName)) {
      return;
    }
    current_instance = $.datepick._curInst;
    current_input = current_instance && current_instance.input ? current_instance.input[0] : null;
    if ($.datepick._datepickerShowing && current_input === input) {
      mark_datepick_popup(root);
      return;
    }
    if ($.datepick._datepickerShowing && current_input && current_input !== input && $.datepick._hideDatepick) {
      $.datepick._hideDatepick(null, '');
    }
    if ($.datepick._lastInput === input) {
      $.datepick._lastInput = null;
    }
    $.datepick._showDatepick(input);
  }

  /**
   * Configure and open End after the Start picker has completely closed.
   *
   * The legacy datepicker shares one popup between every input. Updating End
   * options while Start is still active redraws that shared popup with End data
   * while its internal active instance still points to Start. Deferring the
   * complete transition until the close callback prevents that split state.
   *
   * @param {HTMLElement} root      Component root.
   * @param {HTMLElement} end_input End-date input.
   * @return {void}
   */
  function schedule_end_datepicker_handoff(root, end_input) {
    window.setTimeout(function () {
      var panel = root.querySelector('[data-wpbc-shared-ui-popover-panel]');
      if (!document.documentElement.contains(root) || !panel || panel.hidden || end_input.disabled) {
        return;
      }
      end_input.focus();
      show_datepicker(end_input, root);
    }, 0);
  }

  /**
   * Initialize the standard Booking Calendar datepicker for one component.
   *
   * @param {HTMLElement} root Component root.
   * @return {boolean} True when this call initialized the component.
   */
  function initialize_datepickers(root) {
    var start_input = root.querySelector(start_selector);
    var end_input = root.querySelector(end_selector);
    var first_day = Math.max(0, Math.min(6, Number(root.getAttribute('data-first-day')) || 0));
    var state;
    if (!start_input || !end_input || !$.fn.datepick || root.hasAttribute('data-datepick-initialized')) {
      return false;
    }
    root.setAttribute('data-datepick-initialized', 'true');
    state = get_component_state(root);
    [start_input, end_input].forEach(function (input) {
      $(input).datepick({
        beforeShow: function () {
          state.active_input = this;
          mark_datepick_popup(root);
          return get_datepicker_open_options(root, this, state);
        },
        beforeShowDay: function () {
          return [true, 'date_available'];
        },
        onSelect: function (selected_date) {
          var selected_input = this;
          var selected_value = String(selected_date || '').split(/\s+-\s+|,\s*/)[0];
          var parsed_selected_date = parse_iso_date(selected_value);
          if (!parsed_selected_date || selected_input !== start_input && selected_input !== end_input) {
            return;
          }
          selected_input.value = selected_value;
          if (selected_input === start_input) {
            state.start_was_edited = true;
            end_input.value = selected_value;
            state.pending_end_handoff = true;
          } else if (!state.start_was_edited) {
            preserve_span_from_selected_end(root, parsed_selected_date);
          }
          synchronize_validation(root);
        },
        onClose: function () {
          var closed_input = this;
          if (closed_input === start_input && state.pending_end_handoff) {
            state.pending_end_handoff = false;
            schedule_end_datepicker_handoff(root, end_input);
          }
          if (state.active_input === closed_input) {
            state.active_input = null;
          }
          schedule_datepick_popup_cleanup(root);
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
    });
    synchronize_validation(root);
    return true;
  }

  /**
   * Prime a component before its first date field receives focus.
   *
   * The bundled datepicker binds its own focus listener during initialization.
   * Preparing from the range trigger or the pointer-down that precedes focus
   * lets that public listener handle the first field interaction immediately.
   *
   * @param {Event} event Pointer, focus, or activation event.
   * @return {void}
   */
  function prepare_datepickers(event) {
    var target = event.target && event.target.closest ? event.target : null;
    var preparation_target = target ? target.closest(trigger_selector + ', ' + start_selector + ', ' + end_selector) : null;
    var root = preparation_target ? preparation_target.closest(root_selector) : null;
    if (root) {
      initialize_datepickers(root);
    }
  }

  /**
   * Close the range panel and optionally restore trigger focus.
   *
   * @param {HTMLElement} root          Component root.
   * @param {boolean}     restore_focus Whether to focus the range trigger.
   * @return {void}
   */
  function close_panel(root, restore_focus) {
    var popover = root.querySelector('[data-wpbc-shared-ui-popover]');
    var trigger = root.querySelector('[data-wpbc-shared-ui-popover-trigger]');
    var panel = root.querySelector('[data-wpbc-shared-ui-popover-panel]');
    if (panel) {
      panel.hidden = true;
    }
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
    }
    if (popover) {
      popover.classList.remove('is-open', 'is-panel-edge-left', 'is-panel-edge-right', 'is-panel-edge-top');
    }
    if (restore_focus && trigger) {
      trigger.focus();
    }
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
   * Handle component buttons with one delegated document listener.
   *
   * @param {MouseEvent} event Browser click event.
   * @return {void}
   */
  function handle_click(event) {
    var root = event.target.closest(root_selector);
    var shift_button;
    var apply_button;
    var reset_button;
    var start_input;
    var end_input;
    var state;
    var validation;
    if (!root) {
      return;
    }
    shift_button = event.target.closest('[data-wpbc-shared-ui-date-range-shift]');
    apply_button = event.target.closest('[data-wpbc-shared-ui-date-range-apply]');
    reset_button = event.target.closest('[data-wpbc-shared-ui-date-range-reset]');
    if (shift_button) {
      dispatch_component_event(root, 'wpbc:shared-ui-date-range-shift', {
        id: root.getAttribute('data-wpbc-shared-ui-date-range-navigation') || '',
        direction: shift_button.getAttribute('data-wpbc-shared-ui-date-range-shift') || ''
      });
      return;
    }
    if (reset_button) {
      state = get_component_state(root);
      start_input = root.querySelector(start_selector);
      end_input = root.querySelector(end_selector);
      if (start_input) {
        start_input.value = root.getAttribute('data-start-date') || '';
      }
      if (end_input) {
        end_input.value = root.getAttribute('data-end-date') || '';
      }
      state.pending_end_handoff = false;
      state.start_was_edited = false;
      synchronize_validation(root);
      if (start_input) {
        start_input.focus();
      }
      return;
    }
    if (!apply_button) {
      return;
    }
    validation = synchronize_validation(root);
    if (!validation.is_valid) {
      return;
    }
    close_panel(root, true);
    dispatch_component_event(root, 'wpbc:shared-ui-date-range-apply', {
      id: root.getAttribute('data-wpbc-shared-ui-date-range-navigation') || '',
      start_date: validation.start_value,
      end_date: validation.end_value,
      span_days: validation.span_days
    });
  }

  /**
   * Initialize and validate date fields when users interact with them.
   *
   * @param {Event} event Focus or input event.
   * @return {void}
   */
  function handle_date_field_event(event) {
    var input = event.target.closest(start_selector + ', ' + end_selector);
    var root = input ? input.closest(root_selector) : null;
    var state;
    if (!root) {
      return;
    }
    initialize_datepickers(root);
    state = get_component_state(root);
    if (input.matches(start_selector) && ('input' === event.type || 'change' === event.type)) {
      state.start_was_edited = true;
    }
    synchronize_validation(root);
    if ('click' === event.type || 'focusin' === event.type) {
      show_datepicker(input, root);
    }
  }
  document.addEventListener('mousedown', prepare_datepickers, true);
  document.addEventListener('focusin', prepare_datepickers);
  document.addEventListener('click', prepare_datepickers);
  document.addEventListener('click', handle_click);
  document.addEventListener('click', handle_date_field_event);
  document.addEventListener('focusin', handle_date_field_event);
  document.addEventListener('input', handle_date_field_event);
  document.addEventListener('change', handle_date_field_event);
})(window, document, window.jQuery);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvX3NoYXJlZF91aS9kYXRlLXJhbmdlLW5hdmlnYXRpb24vX291dC9kYXRlLXJhbmdlLW5hdmlnYXRpb24uanMiLCJuYW1lcyI6WyJ3aW5kb3ciLCJkb2N1bWVudCIsIiQiLCJyb290X3NlbGVjdG9yIiwic3RhcnRfc2VsZWN0b3IiLCJlbmRfc2VsZWN0b3IiLCJ0cmlnZ2VyX3NlbGVjdG9yIiwiZGF0ZXBpY2tfbWFya2VyX2F0dHJpYnV0ZSIsImNvbXBvbmVudF9zdGF0ZV9rZXkiLCJwYXJzZV9pc29fZGF0ZSIsImRhdGVfdmFsdWUiLCJtYXRjaCIsIlN0cmluZyIsInBhcnNlZF9kYXRlIiwiRGF0ZSIsIk51bWJlciIsImdldEZ1bGxZZWFyIiwiZ2V0TW9udGgiLCJnZXREYXRlIiwiZm9ybWF0X2lzb19kYXRlIiwieWVhciIsIm1vbnRoIiwic2xpY2UiLCJkYXkiLCJnZXRfaW5jbHVzaXZlX2RheV9jb3VudCIsInN0YXJ0X2RhdGUiLCJlbmRfZGF0ZSIsInN0YXJ0X2Vwb2NoIiwiVVRDIiwiZW5kX2Vwb2NoIiwiTWF0aCIsInJvdW5kIiwiYWRkX2RheXMiLCJkYXlfY291bnQiLCJzaGlmdGVkX2RhdGUiLCJzZXREYXRlIiwidmFsaWRhdGVfZHJhZnQiLCJyb290Iiwic3RhcnRfaW5wdXQiLCJxdWVyeVNlbGVjdG9yIiwiZW5kX2lucHV0IiwibWF4aW11bV9zcGFuX2RheXMiLCJtYXgiLCJnZXRBdHRyaWJ1dGUiLCJ2YWx1ZSIsInNwYW5fZGF5cyIsImlzX29yZGVyZWQiLCJpc193aXRoaW5fbWF4aW11bSIsImlzX3ZhbGlkIiwiQm9vbGVhbiIsInN0YXJ0X3ZhbHVlIiwiZW5kX3ZhbHVlIiwic3luY2hyb25pemVfdmFsaWRhdGlvbiIsInZhbGlkYXRpb24iLCJhcHBseV9idXR0b24iLCJzdGF0dXMiLCJpbnZhbGlkX21lc3NhZ2UiLCJtYXhpbXVtX21lc3NhZ2UiLCJtZXNzYWdlIiwidGV4dENvbnRlbnQiLCJzZXRBdHRyaWJ1dGUiLCJkaXNhYmxlZCIsImdldF9jb21wb25lbnRfc3RhdGUiLCJjYW5vbmljYWxfc3RhcnQiLCJjYW5vbmljYWxfZW5kIiwic3RhdGUiLCJkYXRhIiwiYWN0aXZlX2lucHV0IiwicGVuZGluZ19lbmRfaGFuZG9mZiIsInN0YXJ0X3dhc19lZGl0ZWQiLCJnZXRfZGF0ZXBpY2tlcl9vcGVuX29wdGlvbnMiLCJpbnB1dCIsIm1hdGNoZXMiLCJtaW5EYXRlIiwibWF4RGF0ZSIsInByZXNlcnZlX3NwYW5fZnJvbV9zZWxlY3RlZF9lbmQiLCJzZWxlY3RlZF9lbmRfZGF0ZSIsImNhbm9uaWNhbF9zcGFuX2RheXMiLCJnZXRfZGF0ZXBpY2tfcG9wdXAiLCJkYXRlcGljayIsImRwRGl2IiwibGVuZ3RoIiwiZmlyc3QiLCJtYXJrX2RhdGVwaWNrX3BvcHVwIiwicG9wb3ZlciIsIm93bmVyX2lkIiwiJGRhdGVwaWNrX3BvcHVwIiwiYXR0ciIsInVubWFya19kYXRlcGlja19wb3B1cCIsImVhY2giLCJyZW1vdmVBdHRyIiwic2NoZWR1bGVfZGF0ZXBpY2tfcG9wdXBfY2xlYW51cCIsInNldFRpbWVvdXQiLCJjdXJyZW50X2luc3RhbmNlIiwiX2N1ckluc3QiLCJjdXJyZW50X2lucHV0IiwiY3VycmVudF9yb290IiwiY2xvc2VzdCIsIl9kYXRlcGlja2VyU2hvd2luZyIsInNob3dfZGF0ZXBpY2tlciIsIl9zaG93RGF0ZXBpY2siLCJoYXNDbGFzcyIsIm1hcmtlckNsYXNzTmFtZSIsIl9oaWRlRGF0ZXBpY2siLCJfbGFzdElucHV0Iiwic2NoZWR1bGVfZW5kX2RhdGVwaWNrZXJfaGFuZG9mZiIsInBhbmVsIiwiZG9jdW1lbnRFbGVtZW50IiwiY29udGFpbnMiLCJoaWRkZW4iLCJmb2N1cyIsImluaXRpYWxpemVfZGF0ZXBpY2tlcnMiLCJmaXJzdF9kYXkiLCJtaW4iLCJmbiIsImhhc0F0dHJpYnV0ZSIsImZvckVhY2giLCJiZWZvcmVTaG93IiwiYmVmb3JlU2hvd0RheSIsIm9uU2VsZWN0Iiwic2VsZWN0ZWRfZGF0ZSIsInNlbGVjdGVkX2lucHV0Iiwic2VsZWN0ZWRfdmFsdWUiLCJzcGxpdCIsInBhcnNlZF9zZWxlY3RlZF9kYXRlIiwib25DbG9zZSIsImNsb3NlZF9pbnB1dCIsInNob3dPbiIsInNob3dBbmltIiwiZHVyYXRpb24iLCJtdWx0aVNlbGVjdCIsIm51bWJlck9mTW9udGhzIiwic3RlcE1vbnRocyIsInByZXZUZXh0IiwibmV4dFRleHQiLCJkYXRlRm9ybWF0IiwiY2hhbmdlTW9udGgiLCJjaGFuZ2VZZWFyIiwic2hvd1N0YXR1cyIsIm11bHRpU2VwYXJhdG9yIiwiY2xvc2VBdFRvcCIsImZpcnN0RGF5IiwiZ290b0N1cnJlbnQiLCJoaWRlSWZOb1ByZXZOZXh0IiwidXNlVGhlbWVSb2xsZXIiLCJtYW5kYXRvcnkiLCJwcmVwYXJlX2RhdGVwaWNrZXJzIiwiZXZlbnQiLCJ0YXJnZXQiLCJwcmVwYXJhdGlvbl90YXJnZXQiLCJjbG9zZV9wYW5lbCIsInJlc3RvcmVfZm9jdXMiLCJ0cmlnZ2VyIiwiY2xhc3NMaXN0IiwicmVtb3ZlIiwiZGlzcGF0Y2hfY29tcG9uZW50X2V2ZW50IiwiZXZlbnRfbmFtZSIsImV2ZW50X2RldGFpbCIsImNvbXBvbmVudF9ldmVudCIsIkN1c3RvbUV2ZW50IiwiYnViYmxlcyIsImRldGFpbCIsImNyZWF0ZUV2ZW50IiwiaW5pdEN1c3RvbUV2ZW50IiwiZGlzcGF0Y2hFdmVudCIsImhhbmRsZV9jbGljayIsInNoaWZ0X2J1dHRvbiIsInJlc2V0X2J1dHRvbiIsImlkIiwiZGlyZWN0aW9uIiwiaGFuZGxlX2RhdGVfZmllbGRfZXZlbnQiLCJ0eXBlIiwiYWRkRXZlbnRMaXN0ZW5lciIsImpRdWVyeSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL19zaGFyZWRfdWkvZGF0ZS1yYW5nZS1uYXZpZ2F0aW9uL19zcmMvZGF0ZS1yYW5nZS1uYXZpZ2F0aW9uLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogRG9tYWluLW5ldXRyYWwgc2hhcmVkIGFkbWluaXN0cmF0aW9uIGRhdGUtcmFuZ2UgbmF2aWdhdGlvbiBpbnRlcmFjdGlvbnMuXG4gKlxuICogQHBhY2thZ2UgQm9va2luZyBDYWxlbmRhclxuICogQHNpbmNlICAgMTIuMC4wXG4gKi9cbiggZnVuY3Rpb24gKCB3aW5kb3csIGRvY3VtZW50LCAkICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIHJvb3Rfc2VsZWN0b3IgPSAnW2RhdGEtd3BiYy1zaGFyZWQtdWktZGF0ZS1yYW5nZS1uYXZpZ2F0aW9uXSc7XG5cdHZhciBzdGFydF9zZWxlY3RvciA9ICdbZGF0YS13cGJjLXNoYXJlZC11aS1kYXRlLXJhbmdlLXN0YXJ0XSc7XG5cdHZhciBlbmRfc2VsZWN0b3IgPSAnW2RhdGEtd3BiYy1zaGFyZWQtdWktZGF0ZS1yYW5nZS1lbmRdJztcblx0dmFyIHRyaWdnZXJfc2VsZWN0b3IgPSAnW2RhdGEtd3BiYy1zaGFyZWQtdWktcG9wb3Zlci10cmlnZ2VyXSc7XG5cdHZhciBkYXRlcGlja19tYXJrZXJfYXR0cmlidXRlID0gJ2RhdGEtd3BiYy1zaGFyZWQtdWktZGF0ZS1yYW5nZS1uYXZpZ2F0aW9uLWRhdGVwaWNrJztcblx0dmFyIGNvbXBvbmVudF9zdGF0ZV9rZXkgPSAnd3BiY19zaGFyZWRfdWlfZGF0ZV9yYW5nZV9uYXZpZ2F0aW9uX3N0YXRlJztcblxuXHQvKipcblx0ICogUGFyc2Ugb25lIHN0cmljdCBJU08gY2FsZW5kYXIgZGF0ZSB3aXRob3V0IHRpbWV6b25lIGNvbnZlcnNpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBkYXRlX3ZhbHVlIENhbmRpZGF0ZSBZWVlZLU1NLUREIHZhbHVlLlxuXHQgKiBAcmV0dXJuIHtEYXRlfG51bGx9IExvY2FsIERhdGUgaW5zdGFuY2Ugb3IgbnVsbC5cblx0ICovXG5cdGZ1bmN0aW9uIHBhcnNlX2lzb19kYXRlKCBkYXRlX3ZhbHVlICkge1xuXHRcdHZhciBtYXRjaCA9IFN0cmluZyggZGF0ZV92YWx1ZSB8fCAnJyApLm1hdGNoKCAvXihcXGR7NH0pLShcXGR7Mn0pLShcXGR7Mn0pJC8gKTtcblx0XHR2YXIgcGFyc2VkX2RhdGU7XG5cblx0XHRpZiAoICEgbWF0Y2ggKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0cGFyc2VkX2RhdGUgPSBuZXcgRGF0ZSggTnVtYmVyKCBtYXRjaFsgMSBdICksIE51bWJlciggbWF0Y2hbIDIgXSApIC0gMSwgTnVtYmVyKCBtYXRjaFsgMyBdICkgKTtcblx0XHRpZiAoXG5cdFx0XHRwYXJzZWRfZGF0ZS5nZXRGdWxsWWVhcigpICE9PSBOdW1iZXIoIG1hdGNoWyAxIF0gKSB8fFxuXHRcdFx0cGFyc2VkX2RhdGUuZ2V0TW9udGgoKSAhPT0gTnVtYmVyKCBtYXRjaFsgMiBdICkgLSAxIHx8XG5cdFx0XHRwYXJzZWRfZGF0ZS5nZXREYXRlKCkgIT09IE51bWJlciggbWF0Y2hbIDMgXSApXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0cmV0dXJuIHBhcnNlZF9kYXRlO1xuXHR9XG5cblx0LyoqXG5cdCAqIEZvcm1hdCBhIERhdGUgYXMgYSBzdHJpY3QgbG9jYWwgSVNPIGNhbGVuZGFyIGRhdGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7RGF0ZX0gZGF0ZV92YWx1ZSBDYWxlbmRhciBkYXRlLlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IFlZWVktTU0tREQgdmFsdWUuXG5cdCAqL1xuXHRmdW5jdGlvbiBmb3JtYXRfaXNvX2RhdGUoIGRhdGVfdmFsdWUgKSB7XG5cdFx0dmFyIHllYXIgPSBkYXRlX3ZhbHVlLmdldEZ1bGxZZWFyKCk7XG5cdFx0dmFyIG1vbnRoID0gKCAnMCcgKyBTdHJpbmcoIGRhdGVfdmFsdWUuZ2V0TW9udGgoKSArIDEgKSApLnNsaWNlKCAtMiApO1xuXHRcdHZhciBkYXkgPSAoICcwJyArIFN0cmluZyggZGF0ZV92YWx1ZS5nZXREYXRlKCkgKSApLnNsaWNlKCAtMiApO1xuXG5cdFx0cmV0dXJuIHllYXIgKyAnLScgKyBtb250aCArICctJyArIGRheTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gdGhlIGluY2x1c2l2ZSBudW1iZXIgb2YgY2FsZW5kYXIgZGF5cyBiZXR3ZWVuIHR3byBkYXRlcy5cblx0ICpcblx0ICogVVRDIGFyaXRobWV0aWMgcHJldmVudHMgZGF5bGlnaHQtc2F2aW5nIHRyYW5zaXRpb25zIGZyb20gY2hhbmdpbmcgdGhlXG5cdCAqIG51bWJlciBvZiBzZWxlY3RlZCBjYWxlbmRhciBkYXRlcy5cblx0ICpcblx0ICogQHBhcmFtIHtEYXRlfSBzdGFydF9kYXRlIEluY2x1c2l2ZSBmaXJzdCBkYXRlLlxuXHQgKiBAcGFyYW0ge0RhdGV9IGVuZF9kYXRlICAgSW5jbHVzaXZlIGxhc3QgZGF0ZS5cblx0ICogQHJldHVybiB7bnVtYmVyfSBJbmNsdXNpdmUgc2lnbmVkIGRheSBjb3VudC5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9pbmNsdXNpdmVfZGF5X2NvdW50KCBzdGFydF9kYXRlLCBlbmRfZGF0ZSApIHtcblx0XHR2YXIgc3RhcnRfZXBvY2ggPSBEYXRlLlVUQyggc3RhcnRfZGF0ZS5nZXRGdWxsWWVhcigpLCBzdGFydF9kYXRlLmdldE1vbnRoKCksIHN0YXJ0X2RhdGUuZ2V0RGF0ZSgpICk7XG5cdFx0dmFyIGVuZF9lcG9jaCA9IERhdGUuVVRDKCBlbmRfZGF0ZS5nZXRGdWxsWWVhcigpLCBlbmRfZGF0ZS5nZXRNb250aCgpLCBlbmRfZGF0ZS5nZXREYXRlKCkgKTtcblxuXHRcdHJldHVybiBNYXRoLnJvdW5kKCAoIGVuZF9lcG9jaCAtIHN0YXJ0X2Vwb2NoICkgLyA4NjQwMDAwMCApICsgMTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBZGQgd2hvbGUgY2FsZW5kYXIgZGF5cyB0byBvbmUgbG9jYWwgRGF0ZSB3aXRob3V0IG11dGF0aW5nIHRoZSBzb3VyY2UuXG5cdCAqXG5cdCAqIEBwYXJhbSB7RGF0ZX0gZGF0ZV92YWx1ZSBTb3VyY2UgY2FsZW5kYXIgZGF0ZS5cblx0ICogQHBhcmFtIHtudW1iZXJ9IGRheV9jb3VudCBOdW1iZXIgb2YgZGF5cyB0byBhZGQuXG5cdCAqIEByZXR1cm4ge0RhdGV9IFNoaWZ0ZWQgY2FsZW5kYXIgZGF0ZS5cblx0ICovXG5cdGZ1bmN0aW9uIGFkZF9kYXlzKCBkYXRlX3ZhbHVlLCBkYXlfY291bnQgKSB7XG5cdFx0dmFyIHNoaWZ0ZWRfZGF0ZSA9IG5ldyBEYXRlKCBkYXRlX3ZhbHVlLmdldEZ1bGxZZWFyKCksIGRhdGVfdmFsdWUuZ2V0TW9udGgoKSwgZGF0ZV92YWx1ZS5nZXREYXRlKCkgKTtcblxuXHRcdHNoaWZ0ZWRfZGF0ZS5zZXREYXRlKCBzaGlmdGVkX2RhdGUuZ2V0RGF0ZSgpICsgZGF5X2NvdW50ICk7XG5cdFx0cmV0dXJuIHNoaWZ0ZWRfZGF0ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZWFkIGFuZCB2YWxpZGF0ZSB0aGUgY3VycmVudCBwYWlyZWQtZGF0ZSBkcmFmdC5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm9vdCBDb21wb25lbnQgcm9vdC5cblx0ICogQHJldHVybiB7T2JqZWN0fSBWYWxpZGF0aW9uIHJlc3VsdCBhbmQgbm9ybWFsaXplZCBkYXRlcy5cblx0ICovXG5cdGZ1bmN0aW9uIHZhbGlkYXRlX2RyYWZ0KCByb290ICkge1xuXHRcdHZhciBzdGFydF9pbnB1dCA9IHJvb3QucXVlcnlTZWxlY3Rvciggc3RhcnRfc2VsZWN0b3IgKTtcblx0XHR2YXIgZW5kX2lucHV0ID0gcm9vdC5xdWVyeVNlbGVjdG9yKCBlbmRfc2VsZWN0b3IgKTtcblx0XHR2YXIgbWF4aW11bV9zcGFuX2RheXMgPSBNYXRoLm1heCggMSwgTnVtYmVyKCByb290LmdldEF0dHJpYnV0ZSggJ2RhdGEtbWF4aW11bS1zcGFuLWRheXMnICkgKSB8fCAxICk7XG5cdFx0dmFyIHN0YXJ0X2RhdGUgPSBzdGFydF9pbnB1dCA/IHBhcnNlX2lzb19kYXRlKCBzdGFydF9pbnB1dC52YWx1ZSApIDogbnVsbDtcblx0XHR2YXIgZW5kX2RhdGUgPSBlbmRfaW5wdXQgPyBwYXJzZV9pc29fZGF0ZSggZW5kX2lucHV0LnZhbHVlICkgOiBudWxsO1xuXHRcdHZhciBzcGFuX2RheXMgPSBzdGFydF9kYXRlICYmIGVuZF9kYXRlID8gZ2V0X2luY2x1c2l2ZV9kYXlfY291bnQoIHN0YXJ0X2RhdGUsIGVuZF9kYXRlICkgOiAwO1xuXHRcdHZhciBpc19vcmRlcmVkID0gMCA8IHNwYW5fZGF5cztcblx0XHR2YXIgaXNfd2l0aGluX21heGltdW0gPSBpc19vcmRlcmVkICYmIHNwYW5fZGF5cyA8PSBtYXhpbXVtX3NwYW5fZGF5cztcblxuXHRcdHJldHVybiB7XG5cdFx0XHRpc192YWxpZDogQm9vbGVhbiggc3RhcnRfZGF0ZSAmJiBlbmRfZGF0ZSAmJiBpc19vcmRlcmVkICYmIGlzX3dpdGhpbl9tYXhpbXVtICksXG5cdFx0XHRpc193aXRoaW5fbWF4aW11bTogaXNfd2l0aGluX21heGltdW0sXG5cdFx0XHRzdGFydF9kYXRlOiBzdGFydF9kYXRlLFxuXHRcdFx0ZW5kX2RhdGU6IGVuZF9kYXRlLFxuXHRcdFx0c3RhcnRfdmFsdWU6IHN0YXJ0X2RhdGUgPyBmb3JtYXRfaXNvX2RhdGUoIHN0YXJ0X2RhdGUgKSA6ICcnLFxuXHRcdFx0ZW5kX3ZhbHVlOiBlbmRfZGF0ZSA/IGZvcm1hdF9pc29fZGF0ZSggZW5kX2RhdGUgKSA6ICcnLFxuXHRcdFx0c3Bhbl9kYXlzOiBzcGFuX2RheXNcblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIERpc3BsYXkgdmFsaWRhdGlvbiBzdGF0ZSB3aXRob3V0IGNoYW5naW5nIHRoZSBjYWxsZXIncyBhdXRob3JpemVkIGRhdGEuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvb3QgQ29tcG9uZW50IHJvb3QuXG5cdCAqIEByZXR1cm4ge09iamVjdH0gQ3VycmVudCB2YWxpZGF0aW9uIHJlc3VsdC5cblx0ICovXG5cdGZ1bmN0aW9uIHN5bmNocm9uaXplX3ZhbGlkYXRpb24oIHJvb3QgKSB7XG5cdFx0dmFyIHZhbGlkYXRpb24gPSB2YWxpZGF0ZV9kcmFmdCggcm9vdCApO1xuXHRcdHZhciBzdGFydF9pbnB1dCA9IHJvb3QucXVlcnlTZWxlY3Rvciggc3RhcnRfc2VsZWN0b3IgKTtcblx0XHR2YXIgZW5kX2lucHV0ID0gcm9vdC5xdWVyeVNlbGVjdG9yKCBlbmRfc2VsZWN0b3IgKTtcblx0XHR2YXIgYXBwbHlfYnV0dG9uID0gcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zaGFyZWQtdWktZGF0ZS1yYW5nZS1hcHBseV0nICk7XG5cdFx0dmFyIHN0YXR1cyA9IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2hhcmVkLXVpLWRhdGUtcmFuZ2Utc3RhdHVzXScgKTtcblx0XHR2YXIgaW52YWxpZF9tZXNzYWdlID0gcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zaGFyZWQtdWktZGF0ZS1yYW5nZS1pbnZhbGlkLW1lc3NhZ2VdJyApO1xuXHRcdHZhciBtYXhpbXVtX21lc3NhZ2UgPSByb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNoYXJlZC11aS1kYXRlLXJhbmdlLW1heGltdW0tbWVzc2FnZV0nICk7XG5cdFx0dmFyIG1lc3NhZ2UgPSAnJztcblxuXHRcdGlmICggISB2YWxpZGF0aW9uLmlzX3ZhbGlkICkge1xuXHRcdFx0bWVzc2FnZSA9IDAgPCB2YWxpZGF0aW9uLnNwYW5fZGF5cyAmJiAhIHZhbGlkYXRpb24uaXNfd2l0aGluX21heGltdW1cblx0XHRcdFx0PyAoIG1heGltdW1fbWVzc2FnZSA/IG1heGltdW1fbWVzc2FnZS50ZXh0Q29udGVudCA6ICcnIClcblx0XHRcdFx0OiAoIGludmFsaWRfbWVzc2FnZSA/IGludmFsaWRfbWVzc2FnZS50ZXh0Q29udGVudCA6ICcnICk7XG5cdFx0fVxuXHRcdGlmICggc3RhcnRfaW5wdXQgKSB7XG5cdFx0XHRzdGFydF9pbnB1dC5zZXRBdHRyaWJ1dGUoICdhcmlhLWludmFsaWQnLCB2YWxpZGF0aW9uLnN0YXJ0X2RhdGUgPyAnZmFsc2UnIDogJ3RydWUnICk7XG5cdFx0fVxuXHRcdGlmICggZW5kX2lucHV0ICkge1xuXHRcdFx0ZW5kX2lucHV0LnNldEF0dHJpYnV0ZSggJ2FyaWEtaW52YWxpZCcsIHZhbGlkYXRpb24uZW5kX2RhdGUgJiYgMCA8IHZhbGlkYXRpb24uc3Bhbl9kYXlzID8gJ2ZhbHNlJyA6ICd0cnVlJyApO1xuXHRcdH1cblx0XHRpZiAoIGFwcGx5X2J1dHRvbiApIHtcblx0XHRcdGFwcGx5X2J1dHRvbi5kaXNhYmxlZCA9ICEgdmFsaWRhdGlvbi5pc192YWxpZDtcblx0XHR9XG5cdFx0aWYgKCBzdGF0dXMgKSB7XG5cdFx0XHRzdGF0dXMudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuXHRcdH1cblx0XHRyZXR1cm4gdmFsaWRhdGlvbjtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gcHJpdmF0ZSBpbnRlcmFjdGlvbiBzdGF0ZSBmb3Igb25lIHJlbmRlcmVkIGNvbXBvbmVudC5cblx0ICpcblx0ICogQ2Fub25pY2FsIGRhdGVzIG1heSBjaGFuZ2Ugd2l0aG91dCByZXBsYWNpbmcgdGhlIHRvb2xiYXIgbm9kZSBhZnRlciBhbiBBSkFYXG5cdCAqIHJlc3BvbnNlLiBEZXRlY3RpbmcgdGhhdCBjaGFuZ2UgcmVzZXRzIGRyYWZ0IHNlcXVlbmNpbmcgc28gYW4gRW5kLWZpcnN0XG5cdCAqIGludGVyYWN0aW9uIGlzIGFnYWluIG1lYXN1cmVkIGZyb20gdGhlIG5ld2x5IGF1dGhvcml6ZWQgVGltZWxpbmUgcmFuZ2UuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvb3QgQ29tcG9uZW50IHJvb3QuXG5cdCAqIEByZXR1cm4ge09iamVjdH0gTXV0YWJsZSBjb21wb25lbnQtbG9jYWwgaW50ZXJhY3Rpb24gc3RhdGUuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfY29tcG9uZW50X3N0YXRlKCByb290ICkge1xuXHRcdHZhciBjYW5vbmljYWxfc3RhcnQgPSByb290LmdldEF0dHJpYnV0ZSggJ2RhdGEtc3RhcnQtZGF0ZScgKSB8fCAnJztcblx0XHR2YXIgY2Fub25pY2FsX2VuZCA9IHJvb3QuZ2V0QXR0cmlidXRlKCAnZGF0YS1lbmQtZGF0ZScgKSB8fCAnJztcblx0XHR2YXIgc3RhdGUgPSAkLmRhdGEoIHJvb3QsIGNvbXBvbmVudF9zdGF0ZV9rZXkgKTtcblxuXHRcdGlmICggISBzdGF0ZSApIHtcblx0XHRcdHN0YXRlID0ge1xuXHRcdFx0XHRhY3RpdmVfaW5wdXQ6IG51bGwsXG5cdFx0XHRcdGNhbm9uaWNhbF9zdGFydDogY2Fub25pY2FsX3N0YXJ0LFxuXHRcdFx0XHRjYW5vbmljYWxfZW5kOiBjYW5vbmljYWxfZW5kLFxuXHRcdFx0XHRwZW5kaW5nX2VuZF9oYW5kb2ZmOiBmYWxzZSxcblx0XHRcdFx0c3RhcnRfd2FzX2VkaXRlZDogZmFsc2Vcblx0XHRcdH07XG5cdFx0XHQkLmRhdGEoIHJvb3QsIGNvbXBvbmVudF9zdGF0ZV9rZXksIHN0YXRlICk7XG5cdFx0fSBlbHNlIGlmICggc3RhdGUuY2Fub25pY2FsX3N0YXJ0ICE9PSBjYW5vbmljYWxfc3RhcnQgfHwgc3RhdGUuY2Fub25pY2FsX2VuZCAhPT0gY2Fub25pY2FsX2VuZCApIHtcblx0XHRcdHN0YXRlLmFjdGl2ZV9pbnB1dCA9IG51bGw7XG5cdFx0XHRzdGF0ZS5jYW5vbmljYWxfc3RhcnQgPSBjYW5vbmljYWxfc3RhcnQ7XG5cdFx0XHRzdGF0ZS5jYW5vbmljYWxfZW5kID0gY2Fub25pY2FsX2VuZDtcblx0XHRcdHN0YXRlLnBlbmRpbmdfZW5kX2hhbmRvZmYgPSBmYWxzZTtcblx0XHRcdHN0YXRlLnN0YXJ0X3dhc19lZGl0ZWQgPSBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHN0YXRlO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiBkeW5hbWljIG9wdGlvbnMgZm9yIHRoZSBkYXRlcGlja2VyIGluc3RhbmNlIGJlaW5nIG9wZW5lZC5cblx0ICpcblx0ICogVGhlIGJ1bmRsZWQgZGF0ZXBpY2tlciB1c2VzIG9uZSBwb3B1cCBmb3IgZXZlcnkgaW5wdXQuIEl0cyBwdWJsaWMgYG9wdGlvbmBcblx0ICogY29tbWFuZCByZWRyYXdzIHRoYXQgc2luZ2xldG9uLCBzbyBjaGFuZ2luZyBFbmQgd2hpbGUgU3RhcnQgaXMgdmlzaWJsZSBjYW5cblx0ICogdHJhbnNmZXIgdGhlIHJlbmRlcmVkIGNhbGVuZGFyIHRvIHRoZSB3cm9uZyBmaWVsZC4gUmV0dXJuaW5nIG9wdGlvbnMgZnJvbVxuXHQgKiBgYmVmb3JlU2hvd2AgY29uZmlndXJlcyBvbmx5IHRoZSBpbnN0YW5jZSB0aGF0IGlzIGFib3V0IHRvIGJlY29tZSBhY3RpdmUuXG5cdCAqIEVuZCByZW1haW5zIHVuY29uc3RyYWluZWQgd2hlbiBpdCBpcyB0aGUgZmlyc3QgZWRpdGVkIGJvdW5kYXJ5IHNvIHVzZXJzIGNhblxuXHQgKiBtb3ZlIHRoZSBleGlzdGluZyBpbmNsdXNpdmUgcmFuZ2UgaW4gZWl0aGVyIGRpcmVjdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm9vdCAgQ29tcG9uZW50IHJvb3QuXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGlucHV0IERhdGUgaW5wdXQgdGhhdCBpcyBhYm91dCB0byBvcGVuLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBzdGF0ZSBDb21wb25lbnQtbG9jYWwgaW50ZXJhY3Rpb24gc3RhdGUuXG5cdCAqIEByZXR1cm4ge09iamVjdH0gRGF0ZXBpY2tlciBvcHRpb25zIGZvciB0aGlzIG9wZW4gb3BlcmF0aW9uLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2RhdGVwaWNrZXJfb3Blbl9vcHRpb25zKCByb290LCBpbnB1dCwgc3RhdGUgKSB7XG5cdFx0dmFyIHN0YXJ0X2lucHV0ID0gcm9vdC5xdWVyeVNlbGVjdG9yKCBzdGFydF9zZWxlY3RvciApO1xuXHRcdHZhciBzdGFydF9kYXRlID0gc3RhcnRfaW5wdXQgPyBwYXJzZV9pc29fZGF0ZSggc3RhcnRfaW5wdXQudmFsdWUgKSA6IG51bGw7XG5cdFx0dmFyIG1heGltdW1fc3Bhbl9kYXlzID0gTWF0aC5tYXgoIDEsIE51bWJlciggcm9vdC5nZXRBdHRyaWJ1dGUoICdkYXRhLW1heGltdW0tc3Bhbi1kYXlzJyApICkgfHwgMSApO1xuXG5cdFx0aWYgKCAhIGlucHV0Lm1hdGNoZXMoIGVuZF9zZWxlY3RvciApIHx8ICEgc3RhdGUuc3RhcnRfd2FzX2VkaXRlZCB8fCAhIHN0YXJ0X2RhdGUgKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRtaW5EYXRlOiBudWxsLFxuXHRcdFx0XHRtYXhEYXRlOiBudWxsXG5cdFx0XHR9O1xuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0bWluRGF0ZTogc3RhcnRfZGF0ZSxcblx0XHRcdG1heERhdGU6IGFkZF9kYXlzKCBzdGFydF9kYXRlLCBtYXhpbXVtX3NwYW5fZGF5cyAtIDEgKVxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogUHJlc2VydmUgdGhlIGNhbm9uaWNhbCBpbmNsdXNpdmUgc3BhbiB3aGVuIEVuZCBpcyBzZWxlY3RlZCBmaXJzdC5cblx0ICpcblx0ICogVGhpcyBjaGFuZ2VzIG9ubHkgdGhlIGxvY2FsIFN0YXJ0IGRyYWZ0LiBJdCBkb2VzIG5vdCBmb2N1cyBTdGFydCwgb3BlbiBpdHNcblx0ICogZGF0ZXBpY2tlciwgZGlzcGF0Y2ggYW4gYXBwbHkgZXZlbnQsIG9yIHdyaXRlIGRvbWFpbiBkYXRhLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByb290ICAgICAgICAgICAgICBDb21wb25lbnQgcm9vdC5cblx0ICogQHBhcmFtIHtEYXRlfSAgICAgICAgc2VsZWN0ZWRfZW5kX2RhdGUgTmV3bHkgc2VsZWN0ZWQgRW5kIGNhbGVuZGFyIGRhdGUuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBwcmVzZXJ2ZV9zcGFuX2Zyb21fc2VsZWN0ZWRfZW5kKCByb290LCBzZWxlY3RlZF9lbmRfZGF0ZSApIHtcblx0XHR2YXIgc3RhcnRfaW5wdXQgPSByb290LnF1ZXJ5U2VsZWN0b3IoIHN0YXJ0X3NlbGVjdG9yICk7XG5cdFx0dmFyIGNhbm9uaWNhbF9zdGFydCA9IHBhcnNlX2lzb19kYXRlKCByb290LmdldEF0dHJpYnV0ZSggJ2RhdGEtc3RhcnQtZGF0ZScgKSB8fCAnJyApO1xuXHRcdHZhciBjYW5vbmljYWxfZW5kID0gcGFyc2VfaXNvX2RhdGUoIHJvb3QuZ2V0QXR0cmlidXRlKCAnZGF0YS1lbmQtZGF0ZScgKSB8fCAnJyApO1xuXHRcdHZhciBjYW5vbmljYWxfc3Bhbl9kYXlzID0gY2Fub25pY2FsX3N0YXJ0ICYmIGNhbm9uaWNhbF9lbmRcblx0XHRcdD8gZ2V0X2luY2x1c2l2ZV9kYXlfY291bnQoIGNhbm9uaWNhbF9zdGFydCwgY2Fub25pY2FsX2VuZCApXG5cdFx0XHQ6IDA7XG5cblx0XHRpZiAoICEgc3RhcnRfaW5wdXQgfHwgISBzZWxlY3RlZF9lbmRfZGF0ZSB8fCBjYW5vbmljYWxfc3Bhbl9kYXlzIDwgMSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0c3RhcnRfaW5wdXQudmFsdWUgPSBmb3JtYXRfaXNvX2RhdGUoIGFkZF9kYXlzKCBzZWxlY3RlZF9lbmRfZGF0ZSwgMSAtIGNhbm9uaWNhbF9zcGFuX2RheXMgKSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiB0aGUgc2luZ2xlIHBvcHVwIG93bmVkIGJ5IHRoZSBidW5kbGVkIEJvb2tpbmcgQ2FsZW5kYXIgZGF0ZXBpY2tlci5cblx0ICpcblx0ICogVGhlIGRhdGVwaWNrZXIgcmV1c2VzIG9uZSBib2R5LWFwcGVuZGVkIGVsZW1lbnQgZm9yIGV2ZXJ5IGlucHV0LiBSZWZlcmVuY2luZ1xuXHQgKiB0aGF0IHNpbmdsZXRvbiBkaXJlY3RseSBhdm9pZHMgc3R5bGluZyBpbmxpbmUgY2FsZW5kYXJzIG9yIHBvcHVwIGVsZW1lbnRzXG5cdCAqIGNyZWF0ZWQgYnkgdW5yZWxhdGVkIGxpYnJhcmllcy5cblx0ICpcblx0ICogQHJldHVybiB7alF1ZXJ5fSBEYXRlcGlja2VyIHBvcHVwLCBvciBhbiBlbXB0eSBqUXVlcnkgY29sbGVjdGlvbi5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9kYXRlcGlja19wb3B1cCgpIHtcblx0XHRpZiAoICQuZGF0ZXBpY2sgJiYgJC5kYXRlcGljay5kcERpdiAmJiAkLmRhdGVwaWNrLmRwRGl2Lmxlbmd0aCApIHtcblx0XHRcdHJldHVybiAkLmRhdGVwaWNrLmRwRGl2O1xuXHRcdH1cblx0XHRyZXR1cm4gJCggJyNkYXRlcGljay1kaXYnICkuZmlyc3QoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBNYXJrIHRoZSBzaGFyZWQgZGF0ZXBpY2tlciBwb3B1cCBmb3Igc2NvcGVkIHByZXNlbnRhdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm9vdCBDb21wb25lbnQgcm9vdCB0aGF0IG93bnMgdGhlIHBvcnRhbGVkIGRhdGVwaWNrZXIuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBtYXJrX2RhdGVwaWNrX3BvcHVwKCByb290ICkge1xuXHRcdHZhciBwb3BvdmVyID0gcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zaGFyZWQtdWktcG9wb3Zlcl0nICk7XG5cdFx0dmFyIG93bmVyX2lkID0gcG9wb3ZlciA/IHBvcG92ZXIuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXNoYXJlZC11aS1wb3BvdmVyJyApIDogJyc7XG5cdFx0dmFyICRkYXRlcGlja19wb3B1cCA9IGdldF9kYXRlcGlja19wb3B1cCgpO1xuXG5cdFx0JGRhdGVwaWNrX3BvcHVwLmF0dHIoIGRhdGVwaWNrX21hcmtlcl9hdHRyaWJ1dGUsICd0cnVlJyApO1xuXHRcdGlmICggb3duZXJfaWQgKSB7XG5cdFx0XHQkZGF0ZXBpY2tfcG9wdXAuYXR0ciggJ2RhdGEtd3BiYy1zaGFyZWQtdWktcG9wb3Zlci1vd25lcicsIG93bmVyX2lkICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJlbW92ZSBleHRlcm5hbCBvd25lcnNoaXAgYWZ0ZXIgdGhlIHN0YW5kYXJkIGRhdGVwaWNrZXIgY2xvc2VzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByb290IENvbXBvbmVudCByb290IHRoYXQgb3duZWQgdGhlIGRhdGVwaWNrZXIuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiB1bm1hcmtfZGF0ZXBpY2tfcG9wdXAoIHJvb3QgKSB7XG5cdFx0dmFyIHBvcG92ZXIgPSByb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNoYXJlZC11aS1wb3BvdmVyXScgKTtcblx0XHR2YXIgb3duZXJfaWQgPSBwb3BvdmVyID8gcG9wb3Zlci5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtc2hhcmVkLXVpLXBvcG92ZXInICkgOiAnJztcblxuXHRcdGdldF9kYXRlcGlja19wb3B1cCgpLmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciAkZGF0ZXBpY2tfcG9wdXAgPSAkKCB0aGlzICk7XG5cblx0XHRcdGlmICggb3duZXJfaWQgPT09ICRkYXRlcGlja19wb3B1cC5hdHRyKCAnZGF0YS13cGJjLXNoYXJlZC11aS1wb3BvdmVyLW93bmVyJyApICkge1xuXHRcdFx0XHQkZGF0ZXBpY2tfcG9wdXAucmVtb3ZlQXR0ciggJ2RhdGEtd3BiYy1zaGFyZWQtdWktcG9wb3Zlci1vd25lcicgKS5yZW1vdmVBdHRyKCBkYXRlcGlja19tYXJrZXJfYXR0cmlidXRlICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlbGVhc2UgcG9wdXAgb3duZXJzaGlwIGFmdGVyIHRoZSBkYXRlcGlja2VyIGNvbXBsZXRlcyBpdHMgY2xvc2UgY3ljbGUuXG5cdCAqXG5cdCAqIFN3aXRjaGluZyBkaXJlY3RseSBiZXR3ZWVuIHRoZSBwYWlyZWQgaW5wdXRzIGNsb3NlcyB0aGUgZmlyc3QgZGF0ZXBpY2tlclxuXHQgKiB3aGlsZSBvcGVuaW5nIHRoZSBzZWNvbmQgb25lIGluIHRoZSBzYW1lIEphdmFTY3JpcHQgdHVybi4gRGVmZXJyaW5nIGNsZWFudXBcblx0ICogbGV0cyB0aGUgbmV3IGFjdGl2ZSBpbnN0YW5jZSByZXRhaW4gdGhlIGNvbXBvbmVudCBtYXJrZXIgdXNlZCBmb3Igc2l6aW5nLFxuXHQgKiBwb3NpdGlvbmluZywgYW5kIG91dHNpZGUtY2xpY2sgb3duZXJzaGlwLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByb290IENvbXBvbmVudCByb290IHRoYXQgb3duZWQgdGhlIGRhdGVwaWNrZXIuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzY2hlZHVsZV9kYXRlcGlja19wb3B1cF9jbGVhbnVwKCByb290ICkge1xuXHRcdHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgY3VycmVudF9pbnN0YW5jZSA9ICQuZGF0ZXBpY2sgPyAkLmRhdGVwaWNrLl9jdXJJbnN0IDogbnVsbDtcblx0XHRcdHZhciBjdXJyZW50X2lucHV0ID0gY3VycmVudF9pbnN0YW5jZSAmJiBjdXJyZW50X2luc3RhbmNlLmlucHV0ID8gY3VycmVudF9pbnN0YW5jZS5pbnB1dFsgMCBdIDogbnVsbDtcblx0XHRcdHZhciBjdXJyZW50X3Jvb3QgPSBjdXJyZW50X2lucHV0ICYmIGN1cnJlbnRfaW5wdXQuY2xvc2VzdCA/IGN1cnJlbnRfaW5wdXQuY2xvc2VzdCggcm9vdF9zZWxlY3RvciApIDogbnVsbDtcblxuXHRcdFx0aWYgKCAkLmRhdGVwaWNrICYmICQuZGF0ZXBpY2suX2RhdGVwaWNrZXJTaG93aW5nICYmIGN1cnJlbnRfcm9vdCA9PT0gcm9vdCApIHtcblx0XHRcdFx0bWFya19kYXRlcGlja19wb3B1cCggcm9vdCApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR1bm1hcmtfZGF0ZXBpY2tfcG9wdXAoIHJvb3QgKTtcblx0XHR9LCAwICk7XG5cdH1cblxuXHQvKipcblx0ICogT3BlbiB0aGUgc3RhbmRhcmQgZGF0ZXBpY2tlciB3aGVuIGRpcmVjdCBmb2N1cyBpbml0aWFsaXplZCBpdCB0b28gbGF0ZS5cblx0ICpcblx0ICogTm9ybWFsIHBvaW50ZXIgYW5kIGtleWJvYXJkIHBhdGhzIGluaXRpYWxpemUgZnJvbSB0aGUgcmFuZ2UgdHJpZ2dlciBiZWZvcmUgYVxuXHQgKiBkYXRlIGZpZWxkIHJlY2VpdmVzIGZvY3VzLiBUaGlzIGZhbGxiYWNrIHByZXNlcnZlcyBwcm9ncmFtbWF0aWMgZm9jdXMgYW5kXG5cdCAqIGR5bmFtaWNhbGx5IHJldmVhbGVkIGlucHV0IHBhdGhzIHdoZXJlIHRoZSBwbHVnaW4gbWlzc2VkIHRoYXQgZm9jdXMgZXZlbnQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGlucHV0IERhdGUgaW5wdXQuXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvb3QgIENvbXBvbmVudCByb290LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2hvd19kYXRlcGlja2VyKCBpbnB1dCwgcm9vdCApIHtcblx0XHR2YXIgY3VycmVudF9pbnN0YW5jZTtcblx0XHR2YXIgY3VycmVudF9pbnB1dDtcblxuXHRcdGlmICggISBpbnB1dCB8fCAhICQuZGF0ZXBpY2sgfHwgISAkLmRhdGVwaWNrLl9zaG93RGF0ZXBpY2sgfHwgISAkKCBpbnB1dCApLmhhc0NsYXNzKCAkLmRhdGVwaWNrLm1hcmtlckNsYXNzTmFtZSApICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjdXJyZW50X2luc3RhbmNlID0gJC5kYXRlcGljay5fY3VySW5zdDtcblx0XHRjdXJyZW50X2lucHV0ID0gY3VycmVudF9pbnN0YW5jZSAmJiBjdXJyZW50X2luc3RhbmNlLmlucHV0ID8gY3VycmVudF9pbnN0YW5jZS5pbnB1dFsgMCBdIDogbnVsbDtcblx0XHRpZiAoICQuZGF0ZXBpY2suX2RhdGVwaWNrZXJTaG93aW5nICYmIGN1cnJlbnRfaW5wdXQgPT09IGlucHV0ICkge1xuXHRcdFx0bWFya19kYXRlcGlja19wb3B1cCggcm9vdCApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoICQuZGF0ZXBpY2suX2RhdGVwaWNrZXJTaG93aW5nICYmIGN1cnJlbnRfaW5wdXQgJiYgY3VycmVudF9pbnB1dCAhPT0gaW5wdXQgJiYgJC5kYXRlcGljay5faGlkZURhdGVwaWNrICkge1xuXHRcdFx0JC5kYXRlcGljay5faGlkZURhdGVwaWNrKCBudWxsLCAnJyApO1xuXHRcdH1cblx0XHRpZiAoICQuZGF0ZXBpY2suX2xhc3RJbnB1dCA9PT0gaW5wdXQgKSB7XG5cdFx0XHQkLmRhdGVwaWNrLl9sYXN0SW5wdXQgPSBudWxsO1xuXHRcdH1cblx0XHQkLmRhdGVwaWNrLl9zaG93RGF0ZXBpY2soIGlucHV0ICk7XG5cdH1cblxuXHQvKipcblx0ICogQ29uZmlndXJlIGFuZCBvcGVuIEVuZCBhZnRlciB0aGUgU3RhcnQgcGlja2VyIGhhcyBjb21wbGV0ZWx5IGNsb3NlZC5cblx0ICpcblx0ICogVGhlIGxlZ2FjeSBkYXRlcGlja2VyIHNoYXJlcyBvbmUgcG9wdXAgYmV0d2VlbiBldmVyeSBpbnB1dC4gVXBkYXRpbmcgRW5kXG5cdCAqIG9wdGlvbnMgd2hpbGUgU3RhcnQgaXMgc3RpbGwgYWN0aXZlIHJlZHJhd3MgdGhhdCBzaGFyZWQgcG9wdXAgd2l0aCBFbmQgZGF0YVxuXHQgKiB3aGlsZSBpdHMgaW50ZXJuYWwgYWN0aXZlIGluc3RhbmNlIHN0aWxsIHBvaW50cyB0byBTdGFydC4gRGVmZXJyaW5nIHRoZVxuXHQgKiBjb21wbGV0ZSB0cmFuc2l0aW9uIHVudGlsIHRoZSBjbG9zZSBjYWxsYmFjayBwcmV2ZW50cyB0aGF0IHNwbGl0IHN0YXRlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByb290ICAgICAgQ29tcG9uZW50IHJvb3QuXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVuZF9pbnB1dCBFbmQtZGF0ZSBpbnB1dC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHNjaGVkdWxlX2VuZF9kYXRlcGlja2VyX2hhbmRvZmYoIHJvb3QsIGVuZF9pbnB1dCApIHtcblx0XHR3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyIHBhbmVsID0gcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zaGFyZWQtdWktcG9wb3Zlci1wYW5lbF0nICk7XG5cblx0XHRcdGlmICggISBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY29udGFpbnMoIHJvb3QgKSB8fCAhIHBhbmVsIHx8IHBhbmVsLmhpZGRlbiB8fCBlbmRfaW5wdXQuZGlzYWJsZWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGVuZF9pbnB1dC5mb2N1cygpO1xuXHRcdFx0c2hvd19kYXRlcGlja2VyKCBlbmRfaW5wdXQsIHJvb3QgKTtcblx0XHR9LCAwICk7XG5cdH1cblxuXHQvKipcblx0ICogSW5pdGlhbGl6ZSB0aGUgc3RhbmRhcmQgQm9va2luZyBDYWxlbmRhciBkYXRlcGlja2VyIGZvciBvbmUgY29tcG9uZW50LlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByb290IENvbXBvbmVudCByb290LlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhpcyBjYWxsIGluaXRpYWxpemVkIHRoZSBjb21wb25lbnQuXG5cdCAqL1xuXHRmdW5jdGlvbiBpbml0aWFsaXplX2RhdGVwaWNrZXJzKCByb290ICkge1xuXHRcdHZhciBzdGFydF9pbnB1dCA9IHJvb3QucXVlcnlTZWxlY3Rvciggc3RhcnRfc2VsZWN0b3IgKTtcblx0XHR2YXIgZW5kX2lucHV0ID0gcm9vdC5xdWVyeVNlbGVjdG9yKCBlbmRfc2VsZWN0b3IgKTtcblx0XHR2YXIgZmlyc3RfZGF5ID0gTWF0aC5tYXgoIDAsIE1hdGgubWluKCA2LCBOdW1iZXIoIHJvb3QuZ2V0QXR0cmlidXRlKCAnZGF0YS1maXJzdC1kYXknICkgKSB8fCAwICkgKTtcblx0XHR2YXIgc3RhdGU7XG5cblx0XHRpZiAoICEgc3RhcnRfaW5wdXQgfHwgISBlbmRfaW5wdXQgfHwgISAkLmZuLmRhdGVwaWNrIHx8IHJvb3QuaGFzQXR0cmlidXRlKCAnZGF0YS1kYXRlcGljay1pbml0aWFsaXplZCcgKSApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cm9vdC5zZXRBdHRyaWJ1dGUoICdkYXRhLWRhdGVwaWNrLWluaXRpYWxpemVkJywgJ3RydWUnICk7XG5cdFx0c3RhdGUgPSBnZXRfY29tcG9uZW50X3N0YXRlKCByb290ICk7XG5cblx0XHRbIHN0YXJ0X2lucHV0LCBlbmRfaW5wdXQgXS5mb3JFYWNoKCBmdW5jdGlvbiAoIGlucHV0ICkge1xuXHRcdFx0JCggaW5wdXQgKS5kYXRlcGljaygge1xuXHRcdFx0XHRiZWZvcmVTaG93OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0c3RhdGUuYWN0aXZlX2lucHV0ID0gdGhpcztcblx0XHRcdFx0XHRtYXJrX2RhdGVwaWNrX3BvcHVwKCByb290ICk7XG5cdFx0XHRcdFx0cmV0dXJuIGdldF9kYXRlcGlja2VyX29wZW5fb3B0aW9ucyggcm9vdCwgdGhpcywgc3RhdGUgKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0YmVmb3JlU2hvd0RheTogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdHJldHVybiBbIHRydWUsICdkYXRlX2F2YWlsYWJsZScgXTtcblx0XHRcdFx0fSxcblx0XHRcdFx0b25TZWxlY3Q6IGZ1bmN0aW9uICggc2VsZWN0ZWRfZGF0ZSApIHtcblx0XHRcdFx0XHR2YXIgc2VsZWN0ZWRfaW5wdXQgPSB0aGlzO1xuXHRcdFx0XHRcdHZhciBzZWxlY3RlZF92YWx1ZSA9IFN0cmluZyggc2VsZWN0ZWRfZGF0ZSB8fCAnJyApLnNwbGl0KCAvXFxzKy1cXHMrfCxcXHMqLyApWyAwIF07XG5cdFx0XHRcdFx0dmFyIHBhcnNlZF9zZWxlY3RlZF9kYXRlID0gcGFyc2VfaXNvX2RhdGUoIHNlbGVjdGVkX3ZhbHVlICk7XG5cblx0XHRcdFx0XHRpZiAoICEgcGFyc2VkX3NlbGVjdGVkX2RhdGUgfHwgKCBzZWxlY3RlZF9pbnB1dCAhPT0gc3RhcnRfaW5wdXQgJiYgc2VsZWN0ZWRfaW5wdXQgIT09IGVuZF9pbnB1dCApICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRzZWxlY3RlZF9pbnB1dC52YWx1ZSA9IHNlbGVjdGVkX3ZhbHVlO1xuXHRcdFx0XHRcdGlmICggc2VsZWN0ZWRfaW5wdXQgPT09IHN0YXJ0X2lucHV0ICkge1xuXHRcdFx0XHRcdFx0c3RhdGUuc3RhcnRfd2FzX2VkaXRlZCA9IHRydWU7XG5cdFx0XHRcdFx0XHRlbmRfaW5wdXQudmFsdWUgPSBzZWxlY3RlZF92YWx1ZTtcblx0XHRcdFx0XHRcdHN0YXRlLnBlbmRpbmdfZW5kX2hhbmRvZmYgPSB0cnVlO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoICEgc3RhdGUuc3RhcnRfd2FzX2VkaXRlZCApIHtcblx0XHRcdFx0XHRcdHByZXNlcnZlX3NwYW5fZnJvbV9zZWxlY3RlZF9lbmQoIHJvb3QsIHBhcnNlZF9zZWxlY3RlZF9kYXRlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHN5bmNocm9uaXplX3ZhbGlkYXRpb24oIHJvb3QgKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0b25DbG9zZTogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdHZhciBjbG9zZWRfaW5wdXQgPSB0aGlzO1xuXG5cdFx0XHRcdFx0aWYgKCBjbG9zZWRfaW5wdXQgPT09IHN0YXJ0X2lucHV0ICYmIHN0YXRlLnBlbmRpbmdfZW5kX2hhbmRvZmYgKSB7XG5cdFx0XHRcdFx0XHRzdGF0ZS5wZW5kaW5nX2VuZF9oYW5kb2ZmID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRzY2hlZHVsZV9lbmRfZGF0ZXBpY2tlcl9oYW5kb2ZmKCByb290LCBlbmRfaW5wdXQgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCBzdGF0ZS5hY3RpdmVfaW5wdXQgPT09IGNsb3NlZF9pbnB1dCApIHtcblx0XHRcdFx0XHRcdHN0YXRlLmFjdGl2ZV9pbnB1dCA9IG51bGw7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHNjaGVkdWxlX2RhdGVwaWNrX3BvcHVwX2NsZWFudXAoIHJvb3QgKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0c2hvd09uOiAnZm9jdXMnLFxuXHRcdFx0XHRzaG93QW5pbTogJ3Nob3cnLFxuXHRcdFx0XHRkdXJhdGlvbjogJycsXG5cdFx0XHRcdG11bHRpU2VsZWN0OiAwLFxuXHRcdFx0XHRudW1iZXJPZk1vbnRoczogMSxcblx0XHRcdFx0c3RlcE1vbnRoczogMSxcblx0XHRcdFx0cHJldlRleHQ6ICcmbHNhcXVvOycsXG5cdFx0XHRcdG5leHRUZXh0OiAnJnJzYXF1bzsnLFxuXHRcdFx0XHRkYXRlRm9ybWF0OiAneXktbW0tZGQnLFxuXHRcdFx0XHRjaGFuZ2VNb250aDogZmFsc2UsXG5cdFx0XHRcdGNoYW5nZVllYXI6IGZhbHNlLFxuXHRcdFx0XHRtaW5EYXRlOiBudWxsLFxuXHRcdFx0XHRtYXhEYXRlOiBudWxsLFxuXHRcdFx0XHRzaG93U3RhdHVzOiBmYWxzZSxcblx0XHRcdFx0bXVsdGlTZXBhcmF0b3I6ICcsICcsXG5cdFx0XHRcdGNsb3NlQXRUb3A6IG51bGwsXG5cdFx0XHRcdGZpcnN0RGF5OiBmaXJzdF9kYXksXG5cdFx0XHRcdGdvdG9DdXJyZW50OiBmYWxzZSxcblx0XHRcdFx0aGlkZUlmTm9QcmV2TmV4dDogdHJ1ZSxcblx0XHRcdFx0dXNlVGhlbWVSb2xsZXI6IGZhbHNlLFxuXHRcdFx0XHRtYW5kYXRvcnk6IHRydWVcblx0XHRcdH0gKTtcblx0XHR9ICk7XG5cdFx0c3luY2hyb25pemVfdmFsaWRhdGlvbiggcm9vdCApO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIFByaW1lIGEgY29tcG9uZW50IGJlZm9yZSBpdHMgZmlyc3QgZGF0ZSBmaWVsZCByZWNlaXZlcyBmb2N1cy5cblx0ICpcblx0ICogVGhlIGJ1bmRsZWQgZGF0ZXBpY2tlciBiaW5kcyBpdHMgb3duIGZvY3VzIGxpc3RlbmVyIGR1cmluZyBpbml0aWFsaXphdGlvbi5cblx0ICogUHJlcGFyaW5nIGZyb20gdGhlIHJhbmdlIHRyaWdnZXIgb3IgdGhlIHBvaW50ZXItZG93biB0aGF0IHByZWNlZGVzIGZvY3VzXG5cdCAqIGxldHMgdGhhdCBwdWJsaWMgbGlzdGVuZXIgaGFuZGxlIHRoZSBmaXJzdCBmaWVsZCBpbnRlcmFjdGlvbiBpbW1lZGlhdGVseS5cblx0ICpcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgUG9pbnRlciwgZm9jdXMsIG9yIGFjdGl2YXRpb24gZXZlbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBwcmVwYXJlX2RhdGVwaWNrZXJzKCBldmVudCApIHtcblx0XHR2YXIgdGFyZ2V0ID0gZXZlbnQudGFyZ2V0ICYmIGV2ZW50LnRhcmdldC5jbG9zZXN0ID8gZXZlbnQudGFyZ2V0IDogbnVsbDtcblx0XHR2YXIgcHJlcGFyYXRpb25fdGFyZ2V0ID0gdGFyZ2V0ID8gdGFyZ2V0LmNsb3Nlc3QoIHRyaWdnZXJfc2VsZWN0b3IgKyAnLCAnICsgc3RhcnRfc2VsZWN0b3IgKyAnLCAnICsgZW5kX3NlbGVjdG9yICkgOiBudWxsO1xuXHRcdHZhciByb290ID0gcHJlcGFyYXRpb25fdGFyZ2V0ID8gcHJlcGFyYXRpb25fdGFyZ2V0LmNsb3Nlc3QoIHJvb3Rfc2VsZWN0b3IgKSA6IG51bGw7XG5cblx0XHRpZiAoIHJvb3QgKSB7XG5cdFx0XHRpbml0aWFsaXplX2RhdGVwaWNrZXJzKCByb290ICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIENsb3NlIHRoZSByYW5nZSBwYW5lbCBhbmQgb3B0aW9uYWxseSByZXN0b3JlIHRyaWdnZXIgZm9jdXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvb3QgICAgICAgICAgQ29tcG9uZW50IHJvb3QuXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gICAgIHJlc3RvcmVfZm9jdXMgV2hldGhlciB0byBmb2N1cyB0aGUgcmFuZ2UgdHJpZ2dlci5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGNsb3NlX3BhbmVsKCByb290LCByZXN0b3JlX2ZvY3VzICkge1xuXHRcdHZhciBwb3BvdmVyID0gcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zaGFyZWQtdWktcG9wb3Zlcl0nICk7XG5cdFx0dmFyIHRyaWdnZXIgPSByb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNoYXJlZC11aS1wb3BvdmVyLXRyaWdnZXJdJyApO1xuXHRcdHZhciBwYW5lbCA9IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2hhcmVkLXVpLXBvcG92ZXItcGFuZWxdJyApO1xuXG5cdFx0aWYgKCBwYW5lbCApIHtcblx0XHRcdHBhbmVsLmhpZGRlbiA9IHRydWU7XG5cdFx0fVxuXHRcdGlmICggdHJpZ2dlciApIHtcblx0XHRcdHRyaWdnZXIuc2V0QXR0cmlidXRlKCAnYXJpYS1leHBhbmRlZCcsICdmYWxzZScgKTtcblx0XHR9XG5cdFx0aWYgKCBwb3BvdmVyICkge1xuXHRcdFx0cG9wb3Zlci5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtb3BlbicsICdpcy1wYW5lbC1lZGdlLWxlZnQnLCAnaXMtcGFuZWwtZWRnZS1yaWdodCcsICdpcy1wYW5lbC1lZGdlLXRvcCcgKTtcblx0XHR9XG5cdFx0aWYgKCByZXN0b3JlX2ZvY3VzICYmIHRyaWdnZXIgKSB7XG5cdFx0XHR0cmlnZ2VyLmZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIERpc3BhdGNoIG9uZSBuZXV0cmFsIGJ1YmJsaW5nIGNvbXBvbmVudCBldmVudC5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm9vdCAgICAgICAgIENvbXBvbmVudCByb290LlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICBldmVudF9uYW1lICAgQ3VzdG9tIGV2ZW50IG5hbWUuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGV2ZW50X2RldGFpbCBTY2FsYXIgZXZlbnQgdmFsdWVzLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gZGlzcGF0Y2hfY29tcG9uZW50X2V2ZW50KCByb290LCBldmVudF9uYW1lLCBldmVudF9kZXRhaWwgKSB7XG5cdFx0dmFyIGNvbXBvbmVudF9ldmVudDtcblxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5DdXN0b21FdmVudCApIHtcblx0XHRcdGNvbXBvbmVudF9ldmVudCA9IG5ldyB3aW5kb3cuQ3VzdG9tRXZlbnQoIGV2ZW50X25hbWUsIHtcblx0XHRcdFx0YnViYmxlczogdHJ1ZSxcblx0XHRcdFx0ZGV0YWlsOiBldmVudF9kZXRhaWxcblx0XHRcdH0gKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29tcG9uZW50X2V2ZW50ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoICdDdXN0b21FdmVudCcgKTtcblx0XHRcdGNvbXBvbmVudF9ldmVudC5pbml0Q3VzdG9tRXZlbnQoIGV2ZW50X25hbWUsIHRydWUsIGZhbHNlLCBldmVudF9kZXRhaWwgKTtcblx0XHR9XG5cdFx0cm9vdC5kaXNwYXRjaEV2ZW50KCBjb21wb25lbnRfZXZlbnQgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBIYW5kbGUgY29tcG9uZW50IGJ1dHRvbnMgd2l0aCBvbmUgZGVsZWdhdGVkIGRvY3VtZW50IGxpc3RlbmVyLlxuXHQgKlxuXHQgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGV2ZW50IEJyb3dzZXIgY2xpY2sgZXZlbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBoYW5kbGVfY2xpY2soIGV2ZW50ICkge1xuXHRcdHZhciByb290ID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoIHJvb3Rfc2VsZWN0b3IgKTtcblx0XHR2YXIgc2hpZnRfYnV0dG9uO1xuXHRcdHZhciBhcHBseV9idXR0b247XG5cdFx0dmFyIHJlc2V0X2J1dHRvbjtcblx0XHR2YXIgc3RhcnRfaW5wdXQ7XG5cdFx0dmFyIGVuZF9pbnB1dDtcblx0XHR2YXIgc3RhdGU7XG5cdFx0dmFyIHZhbGlkYXRpb247XG5cblx0XHRpZiAoICEgcm9vdCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0c2hpZnRfYnV0dG9uID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXNoYXJlZC11aS1kYXRlLXJhbmdlLXNoaWZ0XScgKTtcblx0XHRhcHBseV9idXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtc2hhcmVkLXVpLWRhdGUtcmFuZ2UtYXBwbHldJyApO1xuXHRcdHJlc2V0X2J1dHRvbiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1zaGFyZWQtdWktZGF0ZS1yYW5nZS1yZXNldF0nICk7XG5cblx0XHRpZiAoIHNoaWZ0X2J1dHRvbiApIHtcblx0XHRcdGRpc3BhdGNoX2NvbXBvbmVudF9ldmVudCggcm9vdCwgJ3dwYmM6c2hhcmVkLXVpLWRhdGUtcmFuZ2Utc2hpZnQnLCB7XG5cdFx0XHRcdGlkOiByb290LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1zaGFyZWQtdWktZGF0ZS1yYW5nZS1uYXZpZ2F0aW9uJyApIHx8ICcnLFxuXHRcdFx0XHRkaXJlY3Rpb246IHNoaWZ0X2J1dHRvbi5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtc2hhcmVkLXVpLWRhdGUtcmFuZ2Utc2hpZnQnICkgfHwgJydcblx0XHRcdH0gKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCByZXNldF9idXR0b24gKSB7XG5cdFx0XHRzdGF0ZSA9IGdldF9jb21wb25lbnRfc3RhdGUoIHJvb3QgKTtcblx0XHRcdHN0YXJ0X2lucHV0ID0gcm9vdC5xdWVyeVNlbGVjdG9yKCBzdGFydF9zZWxlY3RvciApO1xuXHRcdFx0ZW5kX2lucHV0ID0gcm9vdC5xdWVyeVNlbGVjdG9yKCBlbmRfc2VsZWN0b3IgKTtcblx0XHRcdGlmICggc3RhcnRfaW5wdXQgKSB7XG5cdFx0XHRcdHN0YXJ0X2lucHV0LnZhbHVlID0gcm9vdC5nZXRBdHRyaWJ1dGUoICdkYXRhLXN0YXJ0LWRhdGUnICkgfHwgJyc7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGVuZF9pbnB1dCApIHtcblx0XHRcdFx0ZW5kX2lucHV0LnZhbHVlID0gcm9vdC5nZXRBdHRyaWJ1dGUoICdkYXRhLWVuZC1kYXRlJyApIHx8ICcnO1xuXHRcdFx0fVxuXHRcdFx0c3RhdGUucGVuZGluZ19lbmRfaGFuZG9mZiA9IGZhbHNlO1xuXHRcdFx0c3RhdGUuc3RhcnRfd2FzX2VkaXRlZCA9IGZhbHNlO1xuXHRcdFx0c3luY2hyb25pemVfdmFsaWRhdGlvbiggcm9vdCApO1xuXHRcdFx0aWYgKCBzdGFydF9pbnB1dCApIHtcblx0XHRcdFx0c3RhcnRfaW5wdXQuZm9jdXMoKTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCAhIGFwcGx5X2J1dHRvbiApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dmFsaWRhdGlvbiA9IHN5bmNocm9uaXplX3ZhbGlkYXRpb24oIHJvb3QgKTtcblx0XHRpZiAoICEgdmFsaWRhdGlvbi5pc192YWxpZCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y2xvc2VfcGFuZWwoIHJvb3QsIHRydWUgKTtcblx0XHRkaXNwYXRjaF9jb21wb25lbnRfZXZlbnQoIHJvb3QsICd3cGJjOnNoYXJlZC11aS1kYXRlLXJhbmdlLWFwcGx5Jywge1xuXHRcdFx0aWQ6IHJvb3QuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXNoYXJlZC11aS1kYXRlLXJhbmdlLW5hdmlnYXRpb24nICkgfHwgJycsXG5cdFx0XHRzdGFydF9kYXRlOiB2YWxpZGF0aW9uLnN0YXJ0X3ZhbHVlLFxuXHRcdFx0ZW5kX2RhdGU6IHZhbGlkYXRpb24uZW5kX3ZhbHVlLFxuXHRcdFx0c3Bhbl9kYXlzOiB2YWxpZGF0aW9uLnNwYW5fZGF5c1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBJbml0aWFsaXplIGFuZCB2YWxpZGF0ZSBkYXRlIGZpZWxkcyB3aGVuIHVzZXJzIGludGVyYWN0IHdpdGggdGhlbS5cblx0ICpcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgRm9jdXMgb3IgaW5wdXQgZXZlbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBoYW5kbGVfZGF0ZV9maWVsZF9ldmVudCggZXZlbnQgKSB7XG5cdFx0dmFyIGlucHV0ID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoIHN0YXJ0X3NlbGVjdG9yICsgJywgJyArIGVuZF9zZWxlY3RvciApO1xuXHRcdHZhciByb290ID0gaW5wdXQgPyBpbnB1dC5jbG9zZXN0KCByb290X3NlbGVjdG9yICkgOiBudWxsO1xuXHRcdHZhciBzdGF0ZTtcblxuXHRcdGlmICggISByb290ICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpbml0aWFsaXplX2RhdGVwaWNrZXJzKCByb290ICk7XG5cdFx0c3RhdGUgPSBnZXRfY29tcG9uZW50X3N0YXRlKCByb290ICk7XG5cdFx0aWYgKCBpbnB1dC5tYXRjaGVzKCBzdGFydF9zZWxlY3RvciApICYmICggJ2lucHV0JyA9PT0gZXZlbnQudHlwZSB8fCAnY2hhbmdlJyA9PT0gZXZlbnQudHlwZSApICkge1xuXHRcdFx0c3RhdGUuc3RhcnRfd2FzX2VkaXRlZCA9IHRydWU7XG5cdFx0fVxuXHRcdHN5bmNocm9uaXplX3ZhbGlkYXRpb24oIHJvb3QgKTtcblx0XHRpZiAoICdjbGljaycgPT09IGV2ZW50LnR5cGUgfHwgJ2ZvY3VzaW4nID09PSBldmVudC50eXBlICkge1xuXHRcdFx0c2hvd19kYXRlcGlja2VyKCBpbnB1dCwgcm9vdCApO1xuXHRcdH1cblx0fVxuXG5cdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdtb3VzZWRvd24nLCBwcmVwYXJlX2RhdGVwaWNrZXJzLCB0cnVlICk7XG5cdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdmb2N1c2luJywgcHJlcGFyZV9kYXRlcGlja2VycyApO1xuXHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBwcmVwYXJlX2RhdGVwaWNrZXJzICk7XG5cdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGhhbmRsZV9jbGljayApO1xuXHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBoYW5kbGVfZGF0ZV9maWVsZF9ldmVudCApO1xuXHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnZm9jdXNpbicsIGhhbmRsZV9kYXRlX2ZpZWxkX2V2ZW50ICk7XG5cdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIGhhbmRsZV9kYXRlX2ZpZWxkX2V2ZW50ICk7XG5cdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBoYW5kbGVfZGF0ZV9maWVsZF9ldmVudCApO1xufSggd2luZG93LCBkb2N1bWVudCwgd2luZG93LmpRdWVyeSApICk7XG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0UsV0FBV0EsTUFBTSxFQUFFQyxRQUFRLEVBQUVDLENBQUMsRUFBRztFQUNsQyxZQUFZOztFQUVaLElBQUlDLGFBQWEsR0FBRyw2Q0FBNkM7RUFDakUsSUFBSUMsY0FBYyxHQUFHLHdDQUF3QztFQUM3RCxJQUFJQyxZQUFZLEdBQUcsc0NBQXNDO0VBQ3pELElBQUlDLGdCQUFnQixHQUFHLHVDQUF1QztFQUM5RCxJQUFJQyx5QkFBeUIsR0FBRyxvREFBb0Q7RUFDcEYsSUFBSUMsbUJBQW1CLEdBQUcsNENBQTRDOztFQUV0RTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTQyxjQUFjQSxDQUFFQyxVQUFVLEVBQUc7SUFDckMsSUFBSUMsS0FBSyxHQUFHQyxNQUFNLENBQUVGLFVBQVUsSUFBSSxFQUFHLENBQUMsQ0FBQ0MsS0FBSyxDQUFFLDJCQUE0QixDQUFDO0lBQzNFLElBQUlFLFdBQVc7SUFFZixJQUFLLENBQUVGLEtBQUssRUFBRztNQUNkLE9BQU8sSUFBSTtJQUNaO0lBQ0FFLFdBQVcsR0FBRyxJQUFJQyxJQUFJ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
