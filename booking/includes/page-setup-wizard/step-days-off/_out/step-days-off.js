"use strict";

/**
 * Coordinate the reusable Setup Wizard Days Off editor.
 *
 * The browser selects a bounded range with Booking Calendar's standard
	 * datepicker. Add/remove actions update a bounded browser proposal only. The
	 * shared Save boundary remains authoritative for Resource access, stale
	 * revisions, validation, and canonical Days Availability writes.
 *
 * @package Booking Calendar
 */
(function ($, window, document) {
  'use strict';

  var module_config = window.wpbc_setup_wizard_days_off || {
    i18n: {}
  };
  var request_sequence = 0;

  /**
   * Create the Days Off adapter accepted by the shared Setup Wizard shell.
   *
   * @param {Object} config Authorized endpoint and translated labels.
   * @return {Object} Step adapter.
   */
  function create_days_off_adapter(config) {
    var shell_api = null;
    var editor = null;
    var state = {};
    var all_unavailable_dates = {};
    var base_revision = '';
    var selected_first_date = '';
    var selected_last_date = '';

    /**
     * Return one translated label with a safe fallback.
     *
     * @param {string} key      Translation key.
     * @param {string} fallback Fallback text.
     * @return {string} Translation or fallback.
     */
    function get_message(key, fallback) {
      return config.i18n && config.i18n[key] ? String(config.i18n[key]) : fallback;
    }

    /**
     * Restore keyboard focus without moving the wizard or browser viewport.
     *
     * Re-rendering the unavailable-range list removes the activated delete
     * button. The replacement focus target must remain accessible without
     * making the independently scrolling wizard jump to its top.
     *
     * @param {HTMLElement|null} focus_target Remaining control to receive focus.
     * @return {void}
     */
    function focus_without_scrolling(focus_target) {
      var scroll_container = editor && editor.node ? editor.node.closest('.wpbc_setup_wizard__main') : null;
      var container_scroll_top = scroll_container ? scroll_container.scrollTop : 0;
      var container_scroll_left = scroll_container ? scroll_container.scrollLeft : 0;
      var window_scroll_x = window.pageXOffset || document.documentElement.scrollLeft || 0;
      var window_scroll_y = window.pageYOffset || document.documentElement.scrollTop || 0;
      if (!focus_target || focus_target.disabled || !document.body.contains(focus_target)) {
        return;
      }
      try {
        focus_target.focus({
          preventScroll: true
        });
      } catch (focus_error) {
        focus_target.focus();
      }
      if (scroll_container) {
        scroll_container.scrollTop = container_scroll_top;
        scroll_container.scrollLeft = container_scroll_left;
      }
      if (window.scrollTo && (window_scroll_x !== window.pageXOffset || window_scroll_y !== window.pageYOffset)) {
        window.scrollTo(window_scroll_x, window_scroll_y);
      }
    }

    /**
     * Parse one exact ISO calendar date without UTC conversion drift.
     *
     * @param {string} iso_date Date in YYYY-MM-DD format.
     * @return {Date|null} Local-midnight Date or null.
     */
    function parse_iso_date(iso_date) {
      var parts = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(iso_date || ''));
      var parsed_date;
      if (!parts) {
        return null;
      }
      parsed_date = new Date(parseInt(parts[1], 10), parseInt(parts[2], 10) - 1, parseInt(parts[3], 10));
      return parsed_date.getFullYear() === parseInt(parts[1], 10) && parsed_date.getMonth() === parseInt(parts[2], 10) - 1 && parsed_date.getDate() === parseInt(parts[3], 10) ? parsed_date : null;
    }

    /**
     * Format a Date as canonical YYYY-MM-DD.
     *
     * @param {Date} date Local Date instance.
     * @return {string} ISO date.
     */
    function format_iso_date(date) {
      var month = ('0' + String(date.getMonth() + 1)).slice(-2);
      var day = ('0' + String(date.getDate())).slice(-2);
      return String(date.getFullYear()) + '-' + month + '-' + day;
    }

    /**
     * Format one ISO date for visible labels while preserving ISO transport.
     *
     * @param {string} iso_date Canonical date.
     * @return {string} Localized short label.
     */
    function format_date_label(iso_date) {
      var date = parse_iso_date(iso_date);
      var locale = String(config.locale || '').replace('_', '-');
      if (!date || !window.Intl || !window.Intl.DateTimeFormat) {
        return iso_date;
      }
      try {
        return new window.Intl.DateTimeFormat(locale || undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }).format(date);
      } catch (locale_error) {
        return iso_date;
      }
    }

    /**
     * Return the inclusive number of selected calendar days.
     *
     * @return {number} Inclusive day count, or zero for an invalid range.
     */
    function get_selected_day_count() {
      var first_date = parse_iso_date(selected_first_date);
      var last_date = parse_iso_date(selected_last_date);
      if (!first_date || !last_date || last_date < first_date) {
        return 0;
      }
      return Math.round((last_date.getTime() - first_date.getTime()) / 86400000) + 1;
    }

    /**
     * Normalize server state to the data-only fields used by this adapter.
     *
     * @param {Object} next_state Authorized server state.
     * @return {Object} Safe normalized state.
     */
    function normalize_state(next_state) {
      next_state = next_state && 'object' === typeof next_state ? next_state : {};
      return {
        can_manage: true === next_state.can_manage,
        has_resources: true === next_state.has_resources,
        scope: 'string' === typeof next_state.scope ? next_state.scope : 'all',
        resources: Array.isArray(next_state.resources) ? next_state.resources : [],
        unavailable_dates: next_state.unavailable_dates && 'object' === typeof next_state.unavailable_dates ? next_state.unavailable_dates : {},
        date_states: next_state.date_states && 'object' === typeof next_state.date_states ? next_state.date_states : {},
        booking_date_states: next_state.booking_date_states && 'object' === typeof next_state.booking_date_states ? next_state.booking_date_states : {},
        ranges: Array.isArray(next_state.ranges) ? next_state.ranges : [],
        revision: 'string' === typeof next_state.revision ? next_state.revision : '',
        today: 'string' === typeof next_state.today ? next_state.today : '',
        is_aggregate_scope: true === next_state.is_aggregate_scope,
        default_first_date: 'string' === typeof next_state.default_first_date ? next_state.default_first_date : '',
        default_last_date: 'string' === typeof next_state.default_last_date ? next_state.default_last_date : '',
        first_day: Math.max(0, Math.min(6, parseInt(next_state.first_day || 0, 10) || 0)),
        max_range_days: Math.max(1, parseInt(next_state.max_range_days || 366, 10) || 366)
      };
    }

    /**
     * Normalize the complete staged map without sharing mutable arrays.
     *
     * @param {Object} dates_by_resource Dates keyed by Resource ID.
     * @return {Object} Safe cloned date map.
     */
    function normalize_unavailable_dates(dates_by_resource) {
      var normalized = {};
      state.resources.forEach(function (resource) {
        var resource_id = String(parseInt(resource.id, 10) || 0);
        var dates = dates_by_resource && Array.isArray(dates_by_resource[resource_id]) ? dates_by_resource[resource_id] : [];
        if ('0' === resource_id) {
          return;
        }
        normalized[resource_id] = dates.filter(function (date) {
          return null !== parse_iso_date(date);
        }).filter(function (date, index, source) {
          return source.indexOf(date) === index;
        }).sort();
      });
      return normalized;
    }

    /**
     * Return Resource IDs affected by one visible scope.
     *
     * @param {string} scope Resource ID or `all`.
     * @return {string[]} Authorized Resource IDs.
     */
    function get_scope_resource_ids(scope) {
      var resource_ids = state.resources.map(function (resource) {
        return String(parseInt(resource.id, 10) || 0);
      }).filter(function (resource_id) {
        return '0' !== resource_id;
      });
      return 'all' === scope ? resource_ids : resource_ids.filter(function (resource_id) {
        return resource_id === scope;
      });
    }

    /**
     * Expand a bounded inclusive range into ISO dates.
     *
     * @param {string} first_date First ISO date.
     * @param {string} last_date  Last ISO date.
     * @return {string[]} Inclusive date list.
     */
    function expand_date_range(first_date, last_date) {
      var cursor = parse_iso_date(first_date);
      var end = parse_iso_date(last_date);
      var dates = [];
      while (cursor && end && cursor <= end && dates.length < state.max_range_days) {
        dates.push(format_iso_date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      return dates;
    }

    /**
     * Collapse ordered ISO dates into inclusive range records.
     *
     * @param {string[]} dates ISO dates.
     * @return {Object[]} Consecutive ranges.
     */
    function collapse_dates(dates) {
      var ranges = [];
      var first_date = '';
      var last_date = '';
      dates.slice().sort().forEach(function (date) {
        var expected_next;
        if (!first_date) {
          first_date = date;
          last_date = date;
          return;
        }
        expected_next = parse_iso_date(last_date);
        expected_next.setDate(expected_next.getDate() + 1);
        if (format_iso_date(expected_next) === date) {
          last_date = date;
          return;
        }
        ranges.push({
          first_date: first_date,
          last_date: last_date
        });
        first_date = date;
        last_date = date;
      });
      if (first_date) {
        ranges.push({
          first_date: first_date,
          last_date: last_date
        });
      }
      return ranges;
    }

    /**
     * Build display ranges from the complete staged proposal.
     *
     * @param {string[]} resource_ids Scoped Resource IDs.
     * @param {string}   scope        Current scope.
     * @return {Object[]} Display range records.
     */
    function build_range_records(resource_ids, scope) {
      var range_counts = {};
      var resource_ranges = {};
      var resource_labels = {};
      var shared_added = {};
      var records = [];
      state.resources.forEach(function (resource) {
        resource_labels[String(resource.id)] = String(resource.label || '');
      });
      resource_ids.forEach(function (resource_id) {
        resource_ranges[resource_id] = collapse_dates(all_unavailable_dates[resource_id] || []);
        resource_ranges[resource_id].forEach(function (range) {
          var key = range.first_date + '|' + range.last_date;
          range_counts[key] = (range_counts[key] || 0) + 1;
        });
      });
      resource_ids.forEach(function (resource_id) {
        resource_ranges[resource_id].forEach(function (range) {
          var key = range.first_date + '|' + range.last_date;
          var is_shared = 1 < resource_ids.length && range_counts[key] === resource_ids.length;
          var range_scope = is_shared ? 'all' : 1 === resource_ids.length ? scope : resource_id;
          if (is_shared && shared_added[key]) {
            return;
          }
          records.push({
            first_date: range.first_date,
            last_date: range.last_date,
            label: format_date_label(range.first_date) + (range.first_date === range.last_date ? '' : ' \u2013 ' + format_date_label(range.last_date)),
            scope: range_scope,
            scope_label: 'all' === range_scope ? get_message('all_booking_items', 'All booking items') : resource_labels[resource_id]
          });
          if (is_shared) {
            shared_added[key] = true;
          }
        });
      });
      return records.sort(function (first_range, second_range) {
        return (first_range.first_date + '|' + first_range.scope).localeCompare(second_range.first_date + '|' + second_range.scope);
      });
    }

    /**
     * Synchronize the complete staged proposal into the shared wizard form.
     *
     * @return {void}
     */
    function sync_staged_value() {
      if (editor && editor.value) {
        editor.value.value = JSON.stringify({
          revision: base_revision,
          unavailable_dates: all_unavailable_dates
        });
      }
    }

    /**
     * Rebuild calendar and list presentation from the browser proposal.
     *
     * @param {string} requested_scope Current authorized scope.
     * @return {void}
     */
    function rebuild_staged_state(requested_scope) {
      var resource_ids = get_scope_resource_ids(requested_scope);
      var date_counts = {};
      state.scope = requested_scope;
      state.unavailable_dates = {};
      resource_ids.forEach(function (resource_id) {
        state.unavailable_dates[resource_id] = (all_unavailable_dates[resource_id] || []).slice();
        state.unavailable_dates[resource_id].forEach(function (date) {
          date_counts[date] = (date_counts[date] || 0) + 1;
        });
      });
      state.date_states = {};
      Object.keys(date_counts).forEach(function (date) {
        state.date_states[date] = date_counts[date] === resource_ids.length ? 'unavailable' : 'partially_available';
      });
      state.ranges = build_range_records(resource_ids, requested_scope);
      state.is_aggregate_scope = 'all' === requested_scope && 1 < resource_ids.length;
      apply_scope_value(requested_scope);
      if (editor.aggregate_legend) {
        editor.aggregate_legend.hidden = !state.is_aggregate_scope;
      }
      if (editor.resource_legend) {
        editor.resource_legend.hidden = state.is_aggregate_scope;
      }
      sync_staged_value();
      render_ranges();
      refresh_calendar();
    }

    /**
     * Parse the hex-escaped initial state emitted by the domain template.
     *
     * @param {HTMLElement} editor_node Editor root.
     * @return {Object} Parsed state or an empty object.
     */
    function read_initial_state(editor_node) {
      var state_node = editor_node.querySelector('[data-wpbc-days-off-state]');
      if (!state_node) {
        return {};
      }
      try {
        return JSON.parse(state_node.textContent || '{}');
      } catch (parse_error) {
        return {};
      }
    }

    /**
     * Return native Booking Calendar classes for one scoped calendar date.
     *
     * @param {Date} date Calendar date.
     * Availability remains selectable on this editor. Canonical booked-date
     * states are read-only context and follow the same full-day/time-slot class
     * vocabulary as the native Days Availability calendar.
     *
     * @return {Object} Native day classes and an accessible status title.
     */
    function get_calendar_day_presentation(date) {
      var iso_date = format_iso_date(date);
      var state_class = String(state.date_states[iso_date] || '');
      var booking_state = String(state.booking_date_states[iso_date] || '');
      var native_date_class = 'cal4date-' + String(date.getMonth() + 1) + '-' + String(date.getDate()) + '-' + String(date.getFullYear());
      var css_classes = native_date_class + ' date_available';
      var status_labels = [];
      if ('unavailable' === state_class) {
        return {
          css_classes: native_date_class + ' date_user_unavailable resource_unavailable wpbc_setup_wizard__calendar-date--unavailable',
          status_title: get_message('unavailable', 'Unavailable')
        };
      }
      if ('partially_available' === state_class) {
        css_classes += ' wpbc_resources_partially_unavailable wpbc_setup_wizard__calendar-date--partially-available';
        status_labels.push(get_message('some_resources_unavailable', 'Some booking items unavailable'));
      }
      if ('resources_have_bookings' === booking_state) {
        css_classes += ' wpbc_resources_have_bookings';
        status_labels.push(get_message('resources_have_bookings', 'Bookings exist for one or more booking items'));
      } else if ('approved_full' === booking_state) {
        css_classes = native_date_class + ' date_approved full_day_booking';
        status_labels.push(get_message('approved_booking', 'Approved booking'));
      } else if ('pending_full' === booking_state) {
        css_classes = native_date_class + ' date2approve full_day_booking';
        status_labels.push(get_message('pending_booking', 'Pending booking'));
      } else if ('approved_partial' === booking_state) {
        css_classes += ' date_approved timespartly times_clock';
        status_labels.push(get_message('partially_booked', 'Partially booked'));
      } else if ('pending_partial' === booking_state) {
        css_classes += ' date2approve timespartly times_clock';
        status_labels.push(get_message('partially_booked_pending', 'Partially booked; pending booking'));
      }
      return {
        css_classes: css_classes,
        status_title: status_labels.join('. ')
      };
    }

    /**
     * Refresh the visible selected range and action state.
     *
     * @return {void}
     */
    function render_selection_summary() {
      var day_count = get_selected_day_count();
      var count_label = 1 === day_count ? get_message('one_unavailable_day', '1 unavailable day') : get_message('many_unavailable_days', '%s unavailable days').replace('%s', String(day_count));
      editor.first_date.textContent = selected_first_date ? format_date_label(selected_first_date) : '';
      editor.last_date.textContent = selected_last_date ? format_date_label(selected_last_date) : '';
      editor.summary_range.textContent = day_count ? format_date_label(selected_first_date) + (selected_first_date === selected_last_date ? '' : ' \u2013 ' + format_date_label(selected_last_date)) : '';
      editor.summary_count.textContent = day_count ? count_label : '';
      editor.add_button.disabled = !day_count || day_count > state.max_range_days;
    }

    /**
     * Create one accessible range row using text-only DOM APIs.
     *
     * @param {Object} range Authorized range record.
     * @return {HTMLElement|null} List row or null.
     */
    function create_range_row(range) {
      var row;
      var date_label;
      var scope_label;
      var remove_button;
      var remove_icon;
      if (!range || 'string' !== typeof range.first_date || 'string' !== typeof range.last_date || 'string' !== typeof range.scope) {
        return null;
      }
      row = document.createElement('li');
      date_label = document.createElement('span');
      scope_label = document.createElement('span');
      remove_button = document.createElement('button');
      remove_icon = document.createElement('i');
      date_label.textContent = String(range.label || range.first_date);
      scope_label.textContent = String(range.scope_label || '');
      remove_button.type = 'button';
      remove_button.className = 'wpbc_setup_wizard__days-off-remove';
      remove_button.setAttribute('data-wpbc-days-off-remove', '');
      remove_button.setAttribute('data-first-date', range.first_date);
      remove_button.setAttribute('data-last-date', range.last_date);
      remove_button.setAttribute('data-scope', range.scope);
      remove_button.setAttribute('aria-label', get_message('remove_range', 'Remove unavailable date range'));
      remove_icon.className = 'menu_icon icon-1x wpbc_icn_delete_outline';
      remove_icon.setAttribute('aria-hidden', 'true');
      remove_button.appendChild(remove_icon);
      row.appendChild(date_label);
      row.appendChild(scope_label);
      row.appendChild(remove_button);
      return row;
    }

    /**
     * Replace the upcoming-range list from server-authorized records.
     *
     * @return {void}
     */
    function render_ranges() {
      editor.range_list.textContent = '';
      state.ranges.forEach(function (range) {
        var row = create_range_row(range);
        if (row) {
          editor.range_list.appendChild(row);
        }
      });
      editor.empty.hidden = 0 < editor.range_list.children.length;
    }

    /**
     * Refresh the inline calendar after server state or scope changes.
     *
     * @return {void}
     */
    function refresh_calendar() {
      if (editor.calendar.hasClass($.datepick.markerClassName)) {
        editor.calendar.datepick('refresh');
      }
    }

    /**
     * Mark only the scoped calendar area as loading.
     *
     * Resource changes are read-only and should not cover the complete wizard
     * with the mutation overlay. The disabled selector also prevents a second
     * scope change while the authoritative response is pending.
     *
     * @param {boolean} is_loading Whether an AJAX scope request is active.
     * @return {void}
     */
    function set_calendar_loading(is_loading) {
      editor.calendar_column.classList.toggle('is-loading', is_loading);
      editor.calendar_column.setAttribute('aria-busy', is_loading ? 'true' : 'false');
      editor.scope.disabled = is_loading;
      editor.node.querySelectorAll('[data-wpbc-days-off-remove]').forEach(function (remove_button) {
        remove_button.disabled = is_loading;
      });
      if (is_loading) {
        editor.add_button.disabled = true;
      } else {
        render_selection_summary();
      }
    }

    /**
     * Select the response scope only when it is still an authorized option.
     *
     * @param {string} scope Authorized scope returned by the server.
     * @return {void}
     */
    function apply_scope_value(scope) {
      var has_scope = Array.prototype.some.call(editor.scope.options, function (option) {
        return String(option.value) === scope;
      });
      if (has_scope) {
        editor.scope.value = scope;
      }
    }

    /**
     * Apply the initial server state without trusting browser-derived records.
     *
     * @param {Object} next_state Authorized response state.
     * @return {void}
     */
    function apply_state(next_state) {
      state = normalize_state(next_state);
      base_revision = state.revision;
      all_unavailable_dates = normalize_unavailable_dates(state.unavailable_dates);
      apply_scope_value(state.scope);
      if (editor.aggregate_legend) {
        editor.aggregate_legend.hidden = !state.is_aggregate_scope;
      }
      if (editor.resource_legend) {
        editor.resource_legend.hidden = state.is_aggregate_scope;
      }
      render_ranges();
      refresh_calendar();
      sync_staged_value();
    }

    /**
     * Clear only the pending browser selection and rebuild the datepicker.
     *
     * Canonical unavailable dates and booked-date context stay in server state.
     * Reinitialization removes the datepicker's private range selection without
     * mutating either domain.
     *
     * @return {void}
     */
    function clear_selected_range() {
      selected_first_date = '';
      selected_last_date = '';
      editor.error.textContent = '';
      if (editor.calendar.hasClass($.datepick.markerClassName)) {
        editor.calendar.datepick('destroy');
      }
      initialize_calendar();
      render_selection_summary();
    }

    /**
     * Return a safe AJAX error message.
     *
     * @param {Object} xhr jQuery request object.
     * @return {string} Error message.
     */
    function get_error_message(xhr) {
      if (xhr && xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message) {
        return String(xhr.responseJSON.data.message);
      }
      return get_message('error', 'Date availability could not be updated. Try again.');
    }

    /**
     * Load booking context for one authorized Resource scope.
     *
     * Canonical unavailable dates in the response are deliberately ignored so a
     * scope switch cannot discard the browser proposal waiting for Save.
     *
     * @param {string} requested_scope Resource ID or all-resources scope.
     * @return {void}
     */
    function load_scope(requested_scope) {
      var previous_scope = state.scope;
      var sequence;
      var request_id;
      var request;
      request_sequence += 1;
      sequence = request_sequence;
      request_id = 'days_off_load_' + Date.now() + '_' + sequence;
      editor.error.textContent = '';
      set_calendar_loading(true);
      request = $.ajax({
        url: config.ajax_url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: config.load_action,
          nonce: config.nonce,
          scope: requested_scope,
          request_id: request_id
        }
      });
      request.done(function (response) {
        if (sequence !== request_sequence || !response || !response.success || !response.data || response.data.request_id !== request_id) {
          return;
        }
        var loaded_state = normalize_state(response.data.state);
        state.booking_date_states = loaded_state.booking_date_states;
        state.today = loaded_state.today || state.today;
        state.first_day = loaded_state.first_day;
        state.max_range_days = loaded_state.max_range_days;
        rebuild_staged_state(loaded_state.scope);
      });
      request.fail(function (xhr) {
        var message;
        if (sequence !== request_sequence) {
          return;
        }
        apply_scope_value(previous_scope);
        message = get_error_message(xhr);
        editor.error.textContent = message;
        shell_api.set_status(message);
      });
      request.always(function () {
        if (sequence !== request_sequence) {
          return;
        }
        set_calendar_loading(false);
        editor.scope.focus();
      });
    }

    /**
     * Stage one explicit add/remove operation for the shared Save boundary.
     *
     * @param {string} operation  Add or remove.
     * @param {string} scope      Authorized scope value.
     * @param {string} first_date First ISO date.
     * @param {string} last_date  Last ISO date.
     * @param {HTMLElement|null} focus_target Focus target restored after completion.
     * @param {number}           remove_index Index of the removed row for focus recovery.
     * @return {void}
     */
    function stage_range(operation, scope, first_date, last_date, focus_target, remove_index) {
      var resource_ids = get_scope_resource_ids(scope);
      var range_dates = expand_date_range(first_date, last_date);
      if (!resource_ids.length || !range_dates.length) {
        editor.error.textContent = get_message('range_invalid', 'Select a valid unavailable date range.');
        return;
      }
      resource_ids.forEach(function (resource_id) {
        var current_dates = all_unavailable_dates[resource_id] || [];
        if ('add' === operation) {
          all_unavailable_dates[resource_id] = current_dates.concat(range_dates).filter(function (date, index, source) {
            return source.indexOf(date) === index;
          }).sort();
        } else {
          all_unavailable_dates[resource_id] = current_dates.filter(function (date) {
            return range_dates.indexOf(date) === -1;
          });
        }
      });
      editor.error.textContent = '';
      rebuild_staged_state(String(editor.scope.value || 'all'));
      if ('add' === operation) {
        clear_selected_range();
      }
      shell_api.set_status('add' === operation ? get_message('added', 'The unavailable date range is staged.') : get_message('removed', 'The unavailable date range removal is staged.'));
      window.setTimeout(function () {
        var remaining_remove_buttons = Array.prototype.slice.call(editor.node.querySelectorAll('[data-wpbc-days-off-remove]'));
        var fallback_target = null;
        if (focus_target && !focus_target.disabled && document.body.contains(focus_target)) {
          focus_without_scrolling(focus_target);
          return;
        }
        if ('remove' === operation && remaining_remove_buttons.length && remove_index >= 0) {
          fallback_target = remaining_remove_buttons[Math.min(remove_index, remaining_remove_buttons.length - 1)];
        }
        focus_without_scrolling(fallback_target || editor.scope);
      }, 0);
    }

    /**
     * Reproduce the native Booking Calendar range-hover highlight.
     *
     * @param {string} hovered_value Datepicker value supplied by the plugin.
     * @param {Date}   hovered_date  Calendar day currently under the pointer.
     * @return {boolean} True so the datepicker continues its normal handling.
     */
    function handle_calendar_hover(hovered_value, hovered_date) {
      var datepick_instance;
      var range_start;
      var cursor_date;
      var safety_count = 0;
      editor.calendar.find('.datepick-days-cell-over').removeClass('datepick-days-cell-over');
      if (!hovered_date || !$.datepick || 'function' !== typeof $.datepick._getInst) {
        return true;
      }
      datepick_instance = $.datepick._getInst(editor.calendar[0]);
      if (!datepick_instance || !datepick_instance.dates || 1 !== datepick_instance.dates.length || !datepick_instance.dates[0]) {
        return true;
      }
      range_start = new Date(datepick_instance.dates[0].getTime());
      if (hovered_date < range_start) {
        return true;
      }
      cursor_date = new Date(range_start.getTime());
      while (cursor_date <= hovered_date && safety_count <= state.max_range_days) {
        editor.calendar.find('.cal4date-' + String(cursor_date.getMonth() + 1) + '-' + String(cursor_date.getDate()) + '-' + String(cursor_date.getFullYear())).addClass('datepick-days-cell-over');
        cursor_date.setDate(cursor_date.getDate() + 1);
        safety_count += 1;
      }
      return true;
    }

    /**
     * Initialize Booking Calendar's standard two-month range datepicker.
     *
     * @return {void}
     */
    function initialize_calendar() {
      var first_date = parse_iso_date(selected_first_date);
      var last_date = parse_iso_date(selected_last_date);
      if (!$.fn.datepick) {
        editor.error.textContent = get_message('calendar_unavailable', 'The date selector could not be loaded. Reload the page and try again.');
        return;
      }
      editor.calendar.datepick({
        beforeShowDay: function (date) {
          var day_presentation = get_calendar_day_presentation(date);
          return [true, day_presentation.css_classes, day_presentation.status_title];
        },
        onHover: handle_calendar_hover,
        onSelect: function (date_string, selected_dates) {
          if (!Array.isArray(selected_dates) || !selected_dates[0]) {
            return;
          }
          selected_first_date = format_iso_date(selected_dates[0]);
          selected_last_date = format_iso_date(selected_dates[1] || selected_dates[0]);
          editor.error.textContent = '';
          render_selection_summary();
        },
        showOn: 'none',
        numberOfMonths: 2,
        stepMonths: 1,
        prevText: '&lsaquo;',
        nextText: '&rsaquo;',
        dateFormat: 'yy-mm-dd',
        changeMonth: false,
        changeYear: false,
        minDate: parse_iso_date(state.today) || 0,
        maxDate: '10y',
        showStatus: false,
        closeAtTop: false,
        firstDay: state.first_day,
        gotoCurrent: false,
        hideIfNoPrevNext: true,
        multiSeparator: ', ',
        multiSelect: 0,
        rangeSelect: true,
        rangeSeparator: ' ~ ',
        useThemeRoller: false,
        mandatory: true
      });
      if (first_date && last_date) {
        editor.calendar.datepick('setDate', first_date, last_date);
      }
    }

    /**
     * Handle Add, Clear, and Remove actions.
     *
     * @param {MouseEvent} event Delegated click event.
     * @return {void}
     */
    function handle_click(event) {
      var remove_button = event.target.closest('[data-wpbc-days-off-remove]');
      var remove_buttons;
      var remove_index;
      var day_count;
      if (event.target.closest('[data-wpbc-days-off-add]')) {
        event.preventDefault();
        day_count = get_selected_day_count();
        if (!day_count || day_count > state.max_range_days) {
          editor.error.textContent = get_message('range_invalid', 'Select a valid unavailable date range.');
          return;
        }
        stage_range('add', String(editor.scope.value || 'all'), selected_first_date, selected_last_date, editor.add_button, -1);
        return;
      }
      if (event.target.closest('[data-wpbc-days-off-clear]')) {
        event.preventDefault();
        clear_selected_range();
        return;
      }
      if (remove_button) {
        event.preventDefault();
        remove_buttons = Array.prototype.slice.call(editor.node.querySelectorAll('[data-wpbc-days-off-remove]'));
        remove_index = remove_buttons.indexOf(remove_button);
        stage_range('remove', String(remove_button.getAttribute('data-scope') || ''), String(remove_button.getAttribute('data-first-date') || ''), String(remove_button.getAttribute('data-last-date') || ''), null, remove_index);
      }
    }

    /**
     * Initialize the editor against domain-neutral shell services.
     *
     * @param {Object} registered_shell_api Shared shell services.
     * @return {void}
     */
    function initialize(registered_shell_api) {
      var editor_node;
      shell_api = registered_shell_api;
      editor_node = shell_api.root.querySelector('[data-wpbc-days-off-editor]');
      if (!editor_node) {
        return;
      }
      state = normalize_state(read_initial_state(editor_node));
      if (!state.can_manage || !state.has_resources) {
        return;
      }
      editor = {
        node: editor_node,
        calendar_column: editor_node.querySelector('[data-wpbc-days-off-calendar-column]'),
        calendar: $(editor_node.querySelector('[data-wpbc-days-off-calendar]')),
        first_date: editor_node.querySelector('[data-wpbc-days-off-first-date]'),
        last_date: editor_node.querySelector('[data-wpbc-days-off-last-date]'),
        scope: editor_node.querySelector('[data-wpbc-days-off-scope]'),
        aggregate_legend: editor_node.querySelector('[data-wpbc-days-off-aggregate-legend]'),
        resource_legend: editor_node.querySelector('[data-wpbc-days-off-resource-legend]'),
        summary_range: editor_node.querySelector('[data-wpbc-days-off-summary-range]'),
        summary_count: editor_node.querySelector('[data-wpbc-days-off-summary-count]'),
        add_button: editor_node.querySelector('[data-wpbc-days-off-add]'),
        error: editor_node.querySelector('[data-wpbc-days-off-error]'),
        range_list: editor_node.querySelector('[data-wpbc-days-off-ranges]'),
        empty: editor_node.querySelector('[data-wpbc-days-off-empty]'),
        value: shell_api.root.querySelector('[data-wpbc-days-off-value]')
      };
      base_revision = state.revision;
      all_unavailable_dates = normalize_unavailable_dates(state.unavailable_dates);
      selected_first_date = state.default_first_date || state.today;
      selected_last_date = state.default_last_date || selected_first_date;
      apply_scope_value(state.scope);
      editor.node.addEventListener('click', handle_click);
      editor.scope.addEventListener('change', function () {
        load_scope(String(editor.scope.value || 'all'));
      });
      initialize_calendar();
      render_selection_summary();
      render_ranges();
      sync_staged_value();
    }
    return {
      initialize: initialize,
      sync: sync_staged_value,
      validate: function () {
        return null;
      }
    };
  }
  window.wpbc_setup_editor_modules = window.wpbc_setup_editor_modules || {};
  window.wpbc_setup_editor_modules.days_off = {
    create: create_days_off_adapter
  };
  if (window.wpbc_setup_wizard_api && 'function' === typeof window.wpbc_setup_wizard_api.register_step_adapter) {
    window.wpbc_setup_wizard_api.register_step_adapter(create_days_off_adapter(module_config));
  }
})(jQuery, window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR1cC13aXphcmQvc3RlcC1kYXlzLW9mZi9fb3V0L3N0ZXAtZGF5cy1vZmYuanMiLCJuYW1lcyI6WyIkIiwid2luZG93IiwiZG9jdW1lbnQiLCJtb2R1bGVfY29uZmlnIiwid3BiY19zZXR1cF93aXphcmRfZGF5c19vZmYiLCJpMThuIiwicmVxdWVzdF9zZXF1ZW5jZSIsImNyZWF0ZV9kYXlzX29mZl9hZGFwdGVyIiwiY29uZmlnIiwic2hlbGxfYXBpIiwiZWRpdG9yIiwic3RhdGUiLCJhbGxfdW5hdmFpbGFibGVfZGF0ZXMiLCJiYXNlX3JldmlzaW9uIiwic2VsZWN0ZWRfZmlyc3RfZGF0ZSIsInNlbGVjdGVkX2xhc3RfZGF0ZSIsImdldF9tZXNzYWdlIiwia2V5IiwiZmFsbGJhY2siLCJTdHJpbmciLCJmb2N1c193aXRob3V0X3Njcm9sbGluZyIsImZvY3VzX3RhcmdldCIsInNjcm9sbF9jb250YWluZXIiLCJub2RlIiwiY2xvc2VzdCIsImNvbnRhaW5lcl9zY3JvbGxfdG9wIiwic2Nyb2xsVG9wIiwiY29udGFpbmVyX3Njcm9sbF9sZWZ0Iiwic2Nyb2xsTGVmdCIsIndpbmRvd19zY3JvbGxfeCIsInBhZ2VYT2Zmc2V0IiwiZG9jdW1lbnRFbGVtZW50Iiwid2luZG93X3Njcm9sbF95IiwicGFnZVlPZmZzZXQiLCJkaXNhYmxlZCIsImJvZHkiLCJjb250YWlucyIsImZvY3VzIiwicHJldmVudFNjcm9sbCIsImZvY3VzX2Vycm9yIiwic2Nyb2xsVG8iLCJwYXJzZV9pc29fZGF0ZSIsImlzb19kYXRlIiwicGFydHMiLCJleGVjIiwicGFyc2VkX2RhdGUiLCJEYXRlIiwicGFyc2VJbnQiLCJnZXRGdWxsWWVhciIsImdldE1vbnRoIiwiZ2V0RGF0ZSIsImZvcm1hdF9pc29fZGF0ZSIsImRhdGUiLCJtb250aCIsInNsaWNlIiwiZGF5IiwiZm9ybWF0X2RhdGVfbGFiZWwiLCJsb2NhbGUiLCJyZXBsYWNlIiwiSW50bCIsIkRhdGVUaW1lRm9ybWF0IiwidW5kZWZpbmVkIiwieWVhciIsImZvcm1hdCIsImxvY2FsZV9lcnJvciIsImdldF9zZWxlY3RlZF9kYXlfY291bnQiLCJmaXJzdF9kYXRlIiwibGFzdF9kYXRlIiwiTWF0aCIsInJvdW5kIiwiZ2V0VGltZSIsIm5vcm1hbGl6ZV9zdGF0ZSIsIm5leHRfc3RhdGUiLCJjYW5fbWFuYWdlIiwiaGFzX3Jlc291cmNlcyIsInNjb3BlIiwicmVzb3VyY2VzIiwiQXJyYXkiLCJpc0FycmF5IiwidW5hdmFpbGFibGVfZGF0ZXMiLCJkYXRlX3N0YXRlcyIsImJvb2tpbmdfZGF0ZV9zdGF0ZXMiLCJyYW5nZXMiLCJyZXZpc2lvbiIsInRvZGF5IiwiaXNfYWdncmVnYXRlX3Njb3BlIiwiZGVmYXVsdF9maXJzdF9kYXRlIiwiZGVmYXVsdF9sYXN0X2RhdGUiLCJmaXJzdF9kYXkiLCJtYXgiLCJtaW4iLCJtYXhfcmFuZ2VfZGF5cyIsIm5vcm1hbGl6ZV91bmF2YWlsYWJsZV9kYXRlcyIsImRhdGVzX2J5X3Jlc291cmNlIiwibm9ybWFsaXplZCIsImZvckVhY2giLCJyZXNvdXJjZSIsInJlc291cmNlX2lkIiwiaWQiLCJkYXRlcyIsImZpbHRlciIsImluZGV4Iiwic291cmNlIiwiaW5kZXhPZiIsInNvcnQiLCJnZXRfc2NvcGVfcmVzb3VyY2VfaWRzIiwicmVzb3VyY2VfaWRzIiwibWFwIiwiZXhwYW5kX2RhdGVfcmFuZ2UiLCJjdXJzb3IiLCJlbmQiLCJsZW5ndGgiLCJwdXNoIiwic2V0RGF0ZSIsImNvbGxhcHNlX2RhdGVzIiwiZXhwZWN0ZWRfbmV4dCIsImJ1aWxkX3JhbmdlX3JlY29yZHMiLCJyYW5nZV9jb3VudHMiLCJyZXNvdXJjZV9yYW5nZXMiLCJyZXNvdXJjZV9sYWJlbHMiLCJzaGFyZWRfYWRkZWQiLCJyZWNvcmRzIiwibGFiZWwiLCJyYW5nZSIsImlzX3NoYXJlZCIsInJhbmdlX3Njb3BlIiwic2NvcGVfbGFiZWwiLCJmaXJzdF9yYW5nZSIsInNlY29uZF9yYW5nZSIsImxvY2FsZUNvbXBhcmUiLCJzeW5jX3N0YWdlZF92YWx1ZSIsInZhbHVlIiwiSlNPTiIsInN0cmluZ2lmeSIsInJlYnVpbGRfc3RhZ2VkX3N0YXRlIiwicmVxdWVzdGVkX3Njb3BlIiwiZGF0ZV9jb3VudHMiLCJPYmplY3QiLCJrZXlzIiwiYXBwbHlfc2NvcGVfdmFsdWUiLCJhZ2dyZWdhdGVfbGVnZW5kIiwiaGlkZGVuIiwicmVzb3VyY2VfbGVnZW5kIiwicmVuZGVyX3JhbmdlcyIsInJlZnJlc2hfY2FsZW5kYXIiLCJyZWFkX2luaXRpYWxfc3RhdGUiLCJlZGl0b3Jfbm9kZSIsInN0YXRlX25vZGUiLCJxdWVyeVNlbGVjdG9yIiwicGFyc2UiLCJ0ZXh0Q29udGVudCIsInBhcnNlX2Vycm9yIiwiZ2V0X2NhbGVuZGFyX2RheV9wcmVzZW50YXRpb24iLCJzdGF0ZV9jbGFzcyIsImJvb2tpbmdfc3RhdGUiLCJuYXRpdmVfZGF0ZV9jbGFzcyIsImNzc19jbGFzc2VzIiwic3RhdHVzX2xhYmVscyIsInN0YXR1c190aXRsZSIsImpvaW4iLCJyZW5kZXJfc2VsZWN0aW9uX3N1bW1hcnkiLCJkYXlfY291bnQiLCJjb3VudF9sYWJlbCIsInN1bW1hcnlfcmFuZ2UiLCJzdW1tYXJ5X2NvdW50IiwiYWRkX2J1dHRvbiIsImNyZWF0ZV9yYW5nZV9yb3ciLCJyb3ciLCJkYXRlX2xhYmVsIiwicmVtb3ZlX2J1dHRvbiIsInJlbW92ZV9pY29uIiwiY3JlYXRlRWxlbWVudCIsInR5cGUiLCJjbGFzc05hbWUiLCJzZXRBdHRyaWJ1dGUiLCJhcHBlbmRDaGlsZCIsInJhbmdlX2xpc3QiLCJlbXB0eSIsImNoaWxkcmVuIiwiY2FsZW5kYXIiLCJoYXNDbGFzcyIsImRhdGVwaWNrIiwibWFya2VyQ2xhc3NOYW1lIiwic2V0X2NhbGVuZGFyX2xvYWRpbmciLCJpc19sb2FkaW5nIiwiY2FsZW5kYXJfY29sdW1uIiwiY2xhc3NMaXN0IiwidG9nZ2xlIiwicXVlcnlTZWxlY3RvckFsbCIsImhhc19zY29wZSIsInByb3RvdHlwZSIsInNvbWUiLCJjYWxsIiwib3B0aW9ucyIsIm9wdGlvbiIsImFwcGx5X3N0YXRlIiwiY2xlYXJfc2VsZWN0ZWRfcmFuZ2UiLCJlcnJvciIsImluaXRpYWxpemVfY2FsZW5kYXIiLCJnZXRfZXJyb3JfbWVzc2FnZSIsInhociIsInJlc3BvbnNlSlNPTiIsImRhdGEiLCJtZXNzYWdlIiwibG9hZF9zY29wZSIsInByZXZpb3VzX3Njb3BlIiwic2VxdWVuY2UiLCJyZXF1ZXN0X2lkIiwicmVxdWVzdCIsIm5vdyIsImFqYXgiLCJ1cmwiLCJhamF4X3VybCIsIm1ldGhvZCIsImRhdGFUeXBlIiwiYWN0aW9uIiwibG9hZF9hY3Rpb24iLCJub25jZSIsImRvbmUiLCJyZXNwb25zZSIsInN1Y2Nlc3MiLCJsb2FkZWRfc3RhdGUiLCJmYWlsIiwic2V0X3N0YXR1cyIsImFsd2F5cyIsInN0YWdlX3JhbmdlIiwib3BlcmF0aW9uIiwicmVtb3ZlX2luZGV4IiwicmFuZ2VfZGF0ZXMiLCJjdXJyZW50X2RhdGVzIiwiY29uY2F0Iiwic2V0VGltZW91dCIsInJlbWFpbmluZ19yZW1vdmVfYnV0dG9ucyIsImZhbGxiYWNrX3RhcmdldCIsImhhbmRsZV9jYWxlbmRhcl9ob3ZlciIsImhvdmVyZWRfdmFsdWUiLCJob3ZlcmVkX2RhdGUiLCJkYXRlcGlja19pbnN0YW5jZSIsInJhbmdlX3N0YXJ0IiwiY3Vyc29yX2RhdGUiLCJzYWZldHlfY291bnQiLCJmaW5kIiwicmVtb3ZlQ2xhc3MiLCJfZ2V0SW5zdCIsImFkZENsYXNzIiwiZm4iLCJiZWZvcmVTaG93RGF5IiwiZGF5X3ByZXNlbnRhdGlvbiIsIm9uSG92ZXIiLCJvblNlbGVjdCIsImRhdGVfc3RyaW5nIiwic2VsZWN0ZWRfZGF0ZXMiLCJzaG93T24iLCJudW1iZXJPZk1vbnRocyIsInN0ZXBNb250aHMiLCJwcmV2VGV4dCIsIm5leHRUZXh0IiwiZGF0ZUZvcm1hdCIsImNoYW5nZU1vbnRoIiwiY2hhbmdlWWVhciIsIm1pbkRhdGUiLCJtYXhEYXRlIiwic2hvd1N0YXR1cyIsImNsb3NlQXRUb3AiLCJmaXJzdERheSIsImdvdG9DdXJyZW50IiwiaGlkZUlmTm9QcmV2TmV4dCIsIm11bHRpU2VwYXJhdG9yIiwibXVsdGlTZWxlY3QiLCJyYW5nZVNlbGVjdCIsInJhbmdlU2VwYXJhdG9yIiwidXNlVGhlbWVSb2xsZXIiLCJtYW5kYXRvcnkiLCJoYW5kbGVfY2xpY2siLCJldmVudCIsInRhcmdldCIsInJlbW92ZV9idXR0b25zIiwicHJldmVudERlZmF1bHQiLCJnZXRBdHRyaWJ1dGUiLCJpbml0aWFsaXplIiwicmVnaXN0ZXJlZF9zaGVsbF9hcGkiLCJyb290IiwiYWRkRXZlbnRMaXN0ZW5lciIsInN5bmMiLCJ2YWxpZGF0ZSIsIndwYmNfc2V0dXBfZWRpdG9yX21vZHVsZXMiLCJkYXlzX29mZiIsImNyZWF0ZSIsIndwYmNfc2V0dXBfd2l6YXJkX2FwaSIsInJlZ2lzdGVyX3N0ZXBfYWRhcHRlciIsImpRdWVyeSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2Utc2V0dXAtd2l6YXJkL3N0ZXAtZGF5cy1vZmYvX3NyYy9zdGVwLWRheXMtb2ZmLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ29vcmRpbmF0ZSB0aGUgcmV1c2FibGUgU2V0dXAgV2l6YXJkIERheXMgT2ZmIGVkaXRvci5cbiAqXG4gKiBUaGUgYnJvd3NlciBzZWxlY3RzIGEgYm91bmRlZCByYW5nZSB3aXRoIEJvb2tpbmcgQ2FsZW5kYXIncyBzdGFuZGFyZFxuXHQgKiBkYXRlcGlja2VyLiBBZGQvcmVtb3ZlIGFjdGlvbnMgdXBkYXRlIGEgYm91bmRlZCBicm93c2VyIHByb3Bvc2FsIG9ubHkuIFRoZVxuXHQgKiBzaGFyZWQgU2F2ZSBib3VuZGFyeSByZW1haW5zIGF1dGhvcml0YXRpdmUgZm9yIFJlc291cmNlIGFjY2Vzcywgc3RhbGVcblx0ICogcmV2aXNpb25zLCB2YWxpZGF0aW9uLCBhbmQgY2Fub25pY2FsIERheXMgQXZhaWxhYmlsaXR5IHdyaXRlcy5cbiAqXG4gKiBAcGFja2FnZSBCb29raW5nIENhbGVuZGFyXG4gKi9cbiggZnVuY3Rpb24gKCAkLCB3aW5kb3csIGRvY3VtZW50ICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIG1vZHVsZV9jb25maWcgPSB3aW5kb3cud3BiY19zZXR1cF93aXphcmRfZGF5c19vZmYgfHwgeyBpMThuOiB7fSB9O1xuXHR2YXIgcmVxdWVzdF9zZXF1ZW5jZSA9IDA7XG5cblx0LyoqXG5cdCAqIENyZWF0ZSB0aGUgRGF5cyBPZmYgYWRhcHRlciBhY2NlcHRlZCBieSB0aGUgc2hhcmVkIFNldHVwIFdpemFyZCBzaGVsbC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBBdXRob3JpemVkIGVuZHBvaW50IGFuZCB0cmFuc2xhdGVkIGxhYmVscy5cblx0ICogQHJldHVybiB7T2JqZWN0fSBTdGVwIGFkYXB0ZXIuXG5cdCAqL1xuXHRmdW5jdGlvbiBjcmVhdGVfZGF5c19vZmZfYWRhcHRlciggY29uZmlnICkge1xuXHRcdHZhciBzaGVsbF9hcGkgPSBudWxsO1xuXHRcdHZhciBlZGl0b3IgPSBudWxsO1xuXHRcdHZhciBzdGF0ZSA9IHt9O1xuXHRcdHZhciBhbGxfdW5hdmFpbGFibGVfZGF0ZXMgPSB7fTtcblx0XHR2YXIgYmFzZV9yZXZpc2lvbiA9ICcnO1xuXHRcdHZhciBzZWxlY3RlZF9maXJzdF9kYXRlID0gJyc7XG5cdFx0dmFyIHNlbGVjdGVkX2xhc3RfZGF0ZSA9ICcnO1xuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIG9uZSB0cmFuc2xhdGVkIGxhYmVsIHdpdGggYSBzYWZlIGZhbGxiYWNrLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGtleSAgICAgIFRyYW5zbGF0aW9uIGtleS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZmFsbGJhY2sgRmFsbGJhY2sgdGV4dC5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IFRyYW5zbGF0aW9uIG9yIGZhbGxiYWNrLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9tZXNzYWdlKCBrZXksIGZhbGxiYWNrICkge1xuXHRcdFx0cmV0dXJuIGNvbmZpZy5pMThuICYmIGNvbmZpZy5pMThuWyBrZXkgXSA/IFN0cmluZyggY29uZmlnLmkxOG5bIGtleSBdICkgOiBmYWxsYmFjaztcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXN0b3JlIGtleWJvYXJkIGZvY3VzIHdpdGhvdXQgbW92aW5nIHRoZSB3aXphcmQgb3IgYnJvd3NlciB2aWV3cG9ydC5cblx0XHQgKlxuXHRcdCAqIFJlLXJlbmRlcmluZyB0aGUgdW5hdmFpbGFibGUtcmFuZ2UgbGlzdCByZW1vdmVzIHRoZSBhY3RpdmF0ZWQgZGVsZXRlXG5cdFx0ICogYnV0dG9uLiBUaGUgcmVwbGFjZW1lbnQgZm9jdXMgdGFyZ2V0IG11c3QgcmVtYWluIGFjY2Vzc2libGUgd2l0aG91dFxuXHRcdCAqIG1ha2luZyB0aGUgaW5kZXBlbmRlbnRseSBzY3JvbGxpbmcgd2l6YXJkIGp1bXAgdG8gaXRzIHRvcC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gZm9jdXNfdGFyZ2V0IFJlbWFpbmluZyBjb250cm9sIHRvIHJlY2VpdmUgZm9jdXMuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBmb2N1c193aXRob3V0X3Njcm9sbGluZyggZm9jdXNfdGFyZ2V0ICkge1xuXHRcdFx0dmFyIHNjcm9sbF9jb250YWluZXIgPSBlZGl0b3IgJiYgZWRpdG9yLm5vZGUgPyBlZGl0b3Iubm9kZS5jbG9zZXN0KCAnLndwYmNfc2V0dXBfd2l6YXJkX19tYWluJyApIDogbnVsbDtcblx0XHRcdHZhciBjb250YWluZXJfc2Nyb2xsX3RvcCA9IHNjcm9sbF9jb250YWluZXIgPyBzY3JvbGxfY29udGFpbmVyLnNjcm9sbFRvcCA6IDA7XG5cdFx0XHR2YXIgY29udGFpbmVyX3Njcm9sbF9sZWZ0ID0gc2Nyb2xsX2NvbnRhaW5lciA/IHNjcm9sbF9jb250YWluZXIuc2Nyb2xsTGVmdCA6IDA7XG5cdFx0XHR2YXIgd2luZG93X3Njcm9sbF94ID0gd2luZG93LnBhZ2VYT2Zmc2V0IHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxMZWZ0IHx8IDA7XG5cdFx0XHR2YXIgd2luZG93X3Njcm9sbF95ID0gd2luZG93LnBhZ2VZT2Zmc2V0IHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxUb3AgfHwgMDtcblxuXHRcdFx0aWYgKCAhIGZvY3VzX3RhcmdldCB8fCBmb2N1c190YXJnZXQuZGlzYWJsZWQgfHwgISBkb2N1bWVudC5ib2R5LmNvbnRhaW5zKCBmb2N1c190YXJnZXQgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRmb2N1c190YXJnZXQuZm9jdXMoIHsgcHJldmVudFNjcm9sbDogdHJ1ZSB9ICk7XG5cdFx0XHR9IGNhdGNoICggZm9jdXNfZXJyb3IgKSB7XG5cdFx0XHRcdGZvY3VzX3RhcmdldC5mb2N1cygpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIHNjcm9sbF9jb250YWluZXIgKSB7XG5cdFx0XHRcdHNjcm9sbF9jb250YWluZXIuc2Nyb2xsVG9wID0gY29udGFpbmVyX3Njcm9sbF90b3A7XG5cdFx0XHRcdHNjcm9sbF9jb250YWluZXIuc2Nyb2xsTGVmdCA9IGNvbnRhaW5lcl9zY3JvbGxfbGVmdDtcblx0XHRcdH1cblx0XHRcdGlmICggd2luZG93LnNjcm9sbFRvICYmICggd2luZG93X3Njcm9sbF94ICE9PSB3aW5kb3cucGFnZVhPZmZzZXQgfHwgd2luZG93X3Njcm9sbF95ICE9PSB3aW5kb3cucGFnZVlPZmZzZXQgKSApIHtcblx0XHRcdFx0d2luZG93LnNjcm9sbFRvKCB3aW5kb3dfc2Nyb2xsX3gsIHdpbmRvd19zY3JvbGxfeSApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFBhcnNlIG9uZSBleGFjdCBJU08gY2FsZW5kYXIgZGF0ZSB3aXRob3V0IFVUQyBjb252ZXJzaW9uIGRyaWZ0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGlzb19kYXRlIERhdGUgaW4gWVlZWS1NTS1ERCBmb3JtYXQuXG5cdFx0ICogQHJldHVybiB7RGF0ZXxudWxsfSBMb2NhbC1taWRuaWdodCBEYXRlIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcGFyc2VfaXNvX2RhdGUoIGlzb19kYXRlICkge1xuXHRcdFx0dmFyIHBhcnRzID0gL14oWzAtOV17NH0pLShbMC05XXsyfSktKFswLTldezJ9KSQvLmV4ZWMoIFN0cmluZyggaXNvX2RhdGUgfHwgJycgKSApO1xuXHRcdFx0dmFyIHBhcnNlZF9kYXRlO1xuXG5cdFx0XHRpZiAoICEgcGFydHMgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRwYXJzZWRfZGF0ZSA9IG5ldyBEYXRlKCBwYXJzZUludCggcGFydHNbIDEgXSwgMTAgKSwgcGFyc2VJbnQoIHBhcnRzWyAyIF0sIDEwICkgLSAxLCBwYXJzZUludCggcGFydHNbIDMgXSwgMTAgKSApO1xuXHRcdFx0cmV0dXJuIHBhcnNlZF9kYXRlLmdldEZ1bGxZZWFyKCkgPT09IHBhcnNlSW50KCBwYXJ0c1sgMSBdLCAxMCApICYmIHBhcnNlZF9kYXRlLmdldE1vbnRoKCkgPT09IHBhcnNlSW50KCBwYXJ0c1sgMiBdLCAxMCApIC0gMSAmJiBwYXJzZWRfZGF0ZS5nZXREYXRlKCkgPT09IHBhcnNlSW50KCBwYXJ0c1sgMyBdLCAxMCApID8gcGFyc2VkX2RhdGUgOiBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEZvcm1hdCBhIERhdGUgYXMgY2Fub25pY2FsIFlZWVktTU0tREQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0RhdGV9IGRhdGUgTG9jYWwgRGF0ZSBpbnN0YW5jZS5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IElTTyBkYXRlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGZvcm1hdF9pc29fZGF0ZSggZGF0ZSApIHtcblx0XHRcdHZhciBtb250aCA9ICggJzAnICsgU3RyaW5nKCBkYXRlLmdldE1vbnRoKCkgKyAxICkgKS5zbGljZSggLTIgKTtcblx0XHRcdHZhciBkYXkgPSAoICcwJyArIFN0cmluZyggZGF0ZS5nZXREYXRlKCkgKSApLnNsaWNlKCAtMiApO1xuXG5cdFx0XHRyZXR1cm4gU3RyaW5nKCBkYXRlLmdldEZ1bGxZZWFyKCkgKSArICctJyArIG1vbnRoICsgJy0nICsgZGF5O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEZvcm1hdCBvbmUgSVNPIGRhdGUgZm9yIHZpc2libGUgbGFiZWxzIHdoaWxlIHByZXNlcnZpbmcgSVNPIHRyYW5zcG9ydC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBpc29fZGF0ZSBDYW5vbmljYWwgZGF0ZS5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IExvY2FsaXplZCBzaG9ydCBsYWJlbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBmb3JtYXRfZGF0ZV9sYWJlbCggaXNvX2RhdGUgKSB7XG5cdFx0XHR2YXIgZGF0ZSA9IHBhcnNlX2lzb19kYXRlKCBpc29fZGF0ZSApO1xuXHRcdFx0dmFyIGxvY2FsZSA9IFN0cmluZyggY29uZmlnLmxvY2FsZSB8fCAnJyApLnJlcGxhY2UoICdfJywgJy0nICk7XG5cblx0XHRcdGlmICggISBkYXRlIHx8ICEgd2luZG93LkludGwgfHwgISB3aW5kb3cuSW50bC5EYXRlVGltZUZvcm1hdCApIHtcblx0XHRcdFx0cmV0dXJuIGlzb19kYXRlO1xuXHRcdFx0fVxuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IHdpbmRvdy5JbnRsLkRhdGVUaW1lRm9ybWF0KCBsb2NhbGUgfHwgdW5kZWZpbmVkLCB7XG5cdFx0XHRcdFx0eWVhcjogJ251bWVyaWMnLFxuXHRcdFx0XHRcdG1vbnRoOiAnc2hvcnQnLFxuXHRcdFx0XHRcdGRheTogJ251bWVyaWMnXG5cdFx0XHRcdH0gKS5mb3JtYXQoIGRhdGUgKTtcblx0XHRcdH0gY2F0Y2ggKCBsb2NhbGVfZXJyb3IgKSB7XG5cdFx0XHRcdHJldHVybiBpc29fZGF0ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gdGhlIGluY2x1c2l2ZSBudW1iZXIgb2Ygc2VsZWN0ZWQgY2FsZW5kYXIgZGF5cy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge251bWJlcn0gSW5jbHVzaXZlIGRheSBjb3VudCwgb3IgemVybyBmb3IgYW4gaW52YWxpZCByYW5nZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfc2VsZWN0ZWRfZGF5X2NvdW50KCkge1xuXHRcdFx0dmFyIGZpcnN0X2RhdGUgPSBwYXJzZV9pc29fZGF0ZSggc2VsZWN0ZWRfZmlyc3RfZGF0ZSApO1xuXHRcdFx0dmFyIGxhc3RfZGF0ZSA9IHBhcnNlX2lzb19kYXRlKCBzZWxlY3RlZF9sYXN0X2RhdGUgKTtcblxuXHRcdFx0aWYgKCAhIGZpcnN0X2RhdGUgfHwgISBsYXN0X2RhdGUgfHwgbGFzdF9kYXRlIDwgZmlyc3RfZGF0ZSApIHtcblx0XHRcdFx0cmV0dXJuIDA7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBNYXRoLnJvdW5kKCAoIGxhc3RfZGF0ZS5nZXRUaW1lKCkgLSBmaXJzdF9kYXRlLmdldFRpbWUoKSApIC8gODY0MDAwMDAgKSArIDE7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTm9ybWFsaXplIHNlcnZlciBzdGF0ZSB0byB0aGUgZGF0YS1vbmx5IGZpZWxkcyB1c2VkIGJ5IHRoaXMgYWRhcHRlci5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBuZXh0X3N0YXRlIEF1dGhvcml6ZWQgc2VydmVyIHN0YXRlLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gU2FmZSBub3JtYWxpemVkIHN0YXRlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG5vcm1hbGl6ZV9zdGF0ZSggbmV4dF9zdGF0ZSApIHtcblx0XHRcdG5leHRfc3RhdGUgPSBuZXh0X3N0YXRlICYmICdvYmplY3QnID09PSB0eXBlb2YgbmV4dF9zdGF0ZSA/IG5leHRfc3RhdGUgOiB7fTtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Y2FuX21hbmFnZTogdHJ1ZSA9PT0gbmV4dF9zdGF0ZS5jYW5fbWFuYWdlLFxuXHRcdFx0XHRoYXNfcmVzb3VyY2VzOiB0cnVlID09PSBuZXh0X3N0YXRlLmhhc19yZXNvdXJjZXMsXG5cdFx0XHRcdHNjb3BlOiAnc3RyaW5nJyA9PT0gdHlwZW9mIG5leHRfc3RhdGUuc2NvcGUgPyBuZXh0X3N0YXRlLnNjb3BlIDogJ2FsbCcsXG5cdFx0XHRcdHJlc291cmNlczogQXJyYXkuaXNBcnJheSggbmV4dF9zdGF0ZS5yZXNvdXJjZXMgKSA/IG5leHRfc3RhdGUucmVzb3VyY2VzIDogW10sXG5cdFx0XHRcdHVuYXZhaWxhYmxlX2RhdGVzOiBuZXh0X3N0YXRlLnVuYXZhaWxhYmxlX2RhdGVzICYmICdvYmplY3QnID09PSB0eXBlb2YgbmV4dF9zdGF0ZS51bmF2YWlsYWJsZV9kYXRlcyA/IG5leHRfc3RhdGUudW5hdmFpbGFibGVfZGF0ZXMgOiB7fSxcblx0XHRcdFx0ZGF0ZV9zdGF0ZXM6IG5leHRfc3RhdGUuZGF0ZV9zdGF0ZXMgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBuZXh0X3N0YXRlLmRhdGVfc3RhdGVzID8gbmV4dF9zdGF0ZS5kYXRlX3N0YXRlcyA6IHt9LFxuXHRcdFx0XHRib29raW5nX2RhdGVfc3RhdGVzOiBuZXh0X3N0YXRlLmJvb2tpbmdfZGF0ZV9zdGF0ZXMgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBuZXh0X3N0YXRlLmJvb2tpbmdfZGF0ZV9zdGF0ZXMgPyBuZXh0X3N0YXRlLmJvb2tpbmdfZGF0ZV9zdGF0ZXMgOiB7fSxcblx0XHRcdFx0cmFuZ2VzOiBBcnJheS5pc0FycmF5KCBuZXh0X3N0YXRlLnJhbmdlcyApID8gbmV4dF9zdGF0ZS5yYW5nZXMgOiBbXSxcblx0XHRcdFx0cmV2aXNpb246ICdzdHJpbmcnID09PSB0eXBlb2YgbmV4dF9zdGF0ZS5yZXZpc2lvbiA/IG5leHRfc3RhdGUucmV2aXNpb24gOiAnJyxcblx0XHRcdFx0dG9kYXk6ICdzdHJpbmcnID09PSB0eXBlb2YgbmV4dF9zdGF0ZS50b2RheSA/IG5leHRfc3RhdGUudG9kYXkgOiAnJyxcblx0XHRcdFx0aXNfYWdncmVnYXRlX3Njb3BlOiB0cnVlID09PSBuZXh0X3N0YXRlLmlzX2FnZ3JlZ2F0ZV9zY29wZSxcblx0XHRcdFx0ZGVmYXVsdF9maXJzdF9kYXRlOiAnc3RyaW5nJyA9PT0gdHlwZW9mIG5leHRfc3RhdGUuZGVmYXVsdF9maXJzdF9kYXRlID8gbmV4dF9zdGF0ZS5kZWZhdWx0X2ZpcnN0X2RhdGUgOiAnJyxcblx0XHRcdFx0ZGVmYXVsdF9sYXN0X2RhdGU6ICdzdHJpbmcnID09PSB0eXBlb2YgbmV4dF9zdGF0ZS5kZWZhdWx0X2xhc3RfZGF0ZSA/IG5leHRfc3RhdGUuZGVmYXVsdF9sYXN0X2RhdGUgOiAnJyxcblx0XHRcdFx0Zmlyc3RfZGF5OiBNYXRoLm1heCggMCwgTWF0aC5taW4oIDYsIHBhcnNlSW50KCBuZXh0X3N0YXRlLmZpcnN0X2RheSB8fCAwLCAxMCApIHx8IDAgKSApLFxuXHRcdFx0XHRtYXhfcmFuZ2VfZGF5czogTWF0aC5tYXgoIDEsIHBhcnNlSW50KCBuZXh0X3N0YXRlLm1heF9yYW5nZV9kYXlzIHx8IDM2NiwgMTAgKSB8fCAzNjYgKVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBOb3JtYWxpemUgdGhlIGNvbXBsZXRlIHN0YWdlZCBtYXAgd2l0aG91dCBzaGFyaW5nIG11dGFibGUgYXJyYXlzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGRhdGVzX2J5X3Jlc291cmNlIERhdGVzIGtleWVkIGJ5IFJlc291cmNlIElELlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gU2FmZSBjbG9uZWQgZGF0ZSBtYXAuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbm9ybWFsaXplX3VuYXZhaWxhYmxlX2RhdGVzKCBkYXRlc19ieV9yZXNvdXJjZSApIHtcblx0XHRcdHZhciBub3JtYWxpemVkID0ge307XG5cblx0XHRcdHN0YXRlLnJlc291cmNlcy5mb3JFYWNoKCBmdW5jdGlvbiAoIHJlc291cmNlICkge1xuXHRcdFx0XHR2YXIgcmVzb3VyY2VfaWQgPSBTdHJpbmcoIHBhcnNlSW50KCByZXNvdXJjZS5pZCwgMTAgKSB8fCAwICk7XG5cdFx0XHRcdHZhciBkYXRlcyA9IGRhdGVzX2J5X3Jlc291cmNlICYmIEFycmF5LmlzQXJyYXkoIGRhdGVzX2J5X3Jlc291cmNlWyByZXNvdXJjZV9pZCBdICkgPyBkYXRlc19ieV9yZXNvdXJjZVsgcmVzb3VyY2VfaWQgXSA6IFtdO1xuXG5cdFx0XHRcdGlmICggJzAnID09PSByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0bm9ybWFsaXplZFsgcmVzb3VyY2VfaWQgXSA9IGRhdGVzLmZpbHRlciggZnVuY3Rpb24gKCBkYXRlICkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsICE9PSBwYXJzZV9pc29fZGF0ZSggZGF0ZSApO1xuXHRcdFx0XHR9ICkuZmlsdGVyKCBmdW5jdGlvbiAoIGRhdGUsIGluZGV4LCBzb3VyY2UgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHNvdXJjZS5pbmRleE9mKCBkYXRlICkgPT09IGluZGV4O1xuXHRcdFx0XHR9ICkuc29ydCgpO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gbm9ybWFsaXplZDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gUmVzb3VyY2UgSURzIGFmZmVjdGVkIGJ5IG9uZSB2aXNpYmxlIHNjb3BlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHNjb3BlIFJlc291cmNlIElEIG9yIGBhbGxgLlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ1tdfSBBdXRob3JpemVkIFJlc291cmNlIElEcy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfc2NvcGVfcmVzb3VyY2VfaWRzKCBzY29wZSApIHtcblx0XHRcdHZhciByZXNvdXJjZV9pZHMgPSBzdGF0ZS5yZXNvdXJjZXMubWFwKCBmdW5jdGlvbiAoIHJlc291cmNlICkge1xuXHRcdFx0XHRyZXR1cm4gU3RyaW5nKCBwYXJzZUludCggcmVzb3VyY2UuaWQsIDEwICkgfHwgMCApO1xuXHRcdFx0fSApLmZpbHRlciggZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0cmV0dXJuICcwJyAhPT0gcmVzb3VyY2VfaWQ7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiAnYWxsJyA9PT0gc2NvcGUgPyByZXNvdXJjZV9pZHMgOiByZXNvdXJjZV9pZHMuZmlsdGVyKCBmdW5jdGlvbiAoIHJlc291cmNlX2lkICkge1xuXHRcdFx0XHRyZXR1cm4gcmVzb3VyY2VfaWQgPT09IHNjb3BlO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEV4cGFuZCBhIGJvdW5kZWQgaW5jbHVzaXZlIHJhbmdlIGludG8gSVNPIGRhdGVzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGZpcnN0X2RhdGUgRmlyc3QgSVNPIGRhdGUuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGxhc3RfZGF0ZSAgTGFzdCBJU08gZGF0ZS5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmdbXX0gSW5jbHVzaXZlIGRhdGUgbGlzdC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBleHBhbmRfZGF0ZV9yYW5nZSggZmlyc3RfZGF0ZSwgbGFzdF9kYXRlICkge1xuXHRcdFx0dmFyIGN1cnNvciA9IHBhcnNlX2lzb19kYXRlKCBmaXJzdF9kYXRlICk7XG5cdFx0XHR2YXIgZW5kID0gcGFyc2VfaXNvX2RhdGUoIGxhc3RfZGF0ZSApO1xuXHRcdFx0dmFyIGRhdGVzID0gW107XG5cblx0XHRcdHdoaWxlICggY3Vyc29yICYmIGVuZCAmJiBjdXJzb3IgPD0gZW5kICYmIGRhdGVzLmxlbmd0aCA8IHN0YXRlLm1heF9yYW5nZV9kYXlzICkge1xuXHRcdFx0XHRkYXRlcy5wdXNoKCBmb3JtYXRfaXNvX2RhdGUoIGN1cnNvciApICk7XG5cdFx0XHRcdGN1cnNvci5zZXREYXRlKCBjdXJzb3IuZ2V0RGF0ZSgpICsgMSApO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZGF0ZXM7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29sbGFwc2Ugb3JkZXJlZCBJU08gZGF0ZXMgaW50byBpbmNsdXNpdmUgcmFuZ2UgcmVjb3Jkcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nW119IGRhdGVzIElTTyBkYXRlcy5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3RbXX0gQ29uc2VjdXRpdmUgcmFuZ2VzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNvbGxhcHNlX2RhdGVzKCBkYXRlcyApIHtcblx0XHRcdHZhciByYW5nZXMgPSBbXTtcblx0XHRcdHZhciBmaXJzdF9kYXRlID0gJyc7XG5cdFx0XHR2YXIgbGFzdF9kYXRlID0gJyc7XG5cblx0XHRcdGRhdGVzLnNsaWNlKCkuc29ydCgpLmZvckVhY2goIGZ1bmN0aW9uICggZGF0ZSApIHtcblx0XHRcdFx0dmFyIGV4cGVjdGVkX25leHQ7XG5cblx0XHRcdFx0aWYgKCAhIGZpcnN0X2RhdGUgKSB7XG5cdFx0XHRcdFx0Zmlyc3RfZGF0ZSA9IGRhdGU7XG5cdFx0XHRcdFx0bGFzdF9kYXRlID0gZGF0ZTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0ZXhwZWN0ZWRfbmV4dCA9IHBhcnNlX2lzb19kYXRlKCBsYXN0X2RhdGUgKTtcblx0XHRcdFx0ZXhwZWN0ZWRfbmV4dC5zZXREYXRlKCBleHBlY3RlZF9uZXh0LmdldERhdGUoKSArIDEgKTtcblx0XHRcdFx0aWYgKCBmb3JtYXRfaXNvX2RhdGUoIGV4cGVjdGVkX25leHQgKSA9PT0gZGF0ZSApIHtcblx0XHRcdFx0XHRsYXN0X2RhdGUgPSBkYXRlO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRyYW5nZXMucHVzaCggeyBmaXJzdF9kYXRlOiBmaXJzdF9kYXRlLCBsYXN0X2RhdGU6IGxhc3RfZGF0ZSB9ICk7XG5cdFx0XHRcdGZpcnN0X2RhdGUgPSBkYXRlO1xuXHRcdFx0XHRsYXN0X2RhdGUgPSBkYXRlO1xuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCBmaXJzdF9kYXRlICkge1xuXHRcdFx0XHRyYW5nZXMucHVzaCggeyBmaXJzdF9kYXRlOiBmaXJzdF9kYXRlLCBsYXN0X2RhdGU6IGxhc3RfZGF0ZSB9ICk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiByYW5nZXM7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQnVpbGQgZGlzcGxheSByYW5nZXMgZnJvbSB0aGUgY29tcGxldGUgc3RhZ2VkIHByb3Bvc2FsLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmdbXX0gcmVzb3VyY2VfaWRzIFNjb3BlZCBSZXNvdXJjZSBJRHMuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9ICAgc2NvcGUgICAgICAgIEN1cnJlbnQgc2NvcGUuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0W119IERpc3BsYXkgcmFuZ2UgcmVjb3Jkcy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBidWlsZF9yYW5nZV9yZWNvcmRzKCByZXNvdXJjZV9pZHMsIHNjb3BlICkge1xuXHRcdFx0dmFyIHJhbmdlX2NvdW50cyA9IHt9O1xuXHRcdFx0dmFyIHJlc291cmNlX3JhbmdlcyA9IHt9O1xuXHRcdFx0dmFyIHJlc291cmNlX2xhYmVscyA9IHt9O1xuXHRcdFx0dmFyIHNoYXJlZF9hZGRlZCA9IHt9O1xuXHRcdFx0dmFyIHJlY29yZHMgPSBbXTtcblxuXHRcdFx0c3RhdGUucmVzb3VyY2VzLmZvckVhY2goIGZ1bmN0aW9uICggcmVzb3VyY2UgKSB7XG5cdFx0XHRcdHJlc291cmNlX2xhYmVsc1sgU3RyaW5nKCByZXNvdXJjZS5pZCApIF0gPSBTdHJpbmcoIHJlc291cmNlLmxhYmVsIHx8ICcnICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRyZXNvdXJjZV9pZHMuZm9yRWFjaCggZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0cmVzb3VyY2VfcmFuZ2VzWyByZXNvdXJjZV9pZCBdID0gY29sbGFwc2VfZGF0ZXMoIGFsbF91bmF2YWlsYWJsZV9kYXRlc1sgcmVzb3VyY2VfaWQgXSB8fCBbXSApO1xuXHRcdFx0XHRyZXNvdXJjZV9yYW5nZXNbIHJlc291cmNlX2lkIF0uZm9yRWFjaCggZnVuY3Rpb24gKCByYW5nZSApIHtcblx0XHRcdFx0XHR2YXIga2V5ID0gcmFuZ2UuZmlyc3RfZGF0ZSArICd8JyArIHJhbmdlLmxhc3RfZGF0ZTtcblxuXHRcdFx0XHRcdHJhbmdlX2NvdW50c1sga2V5IF0gPSAoIHJhbmdlX2NvdW50c1sga2V5IF0gfHwgMCApICsgMTtcblx0XHRcdFx0fSApO1xuXHRcdFx0fSApO1xuXHRcdFx0cmVzb3VyY2VfaWRzLmZvckVhY2goIGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdHJlc291cmNlX3Jhbmdlc1sgcmVzb3VyY2VfaWQgXS5mb3JFYWNoKCBmdW5jdGlvbiAoIHJhbmdlICkge1xuXHRcdFx0XHRcdHZhciBrZXkgPSByYW5nZS5maXJzdF9kYXRlICsgJ3wnICsgcmFuZ2UubGFzdF9kYXRlO1xuXHRcdFx0XHRcdHZhciBpc19zaGFyZWQgPSAxIDwgcmVzb3VyY2VfaWRzLmxlbmd0aCAmJiByYW5nZV9jb3VudHNbIGtleSBdID09PSByZXNvdXJjZV9pZHMubGVuZ3RoO1xuXHRcdFx0XHRcdHZhciByYW5nZV9zY29wZSA9IGlzX3NoYXJlZCA/ICdhbGwnIDogKCAxID09PSByZXNvdXJjZV9pZHMubGVuZ3RoID8gc2NvcGUgOiByZXNvdXJjZV9pZCApO1xuXG5cdFx0XHRcdFx0aWYgKCBpc19zaGFyZWQgJiYgc2hhcmVkX2FkZGVkWyBrZXkgXSApIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmVjb3Jkcy5wdXNoKCB7XG5cdFx0XHRcdFx0XHRmaXJzdF9kYXRlOiByYW5nZS5maXJzdF9kYXRlLFxuXHRcdFx0XHRcdFx0bGFzdF9kYXRlOiByYW5nZS5sYXN0X2RhdGUsXG5cdFx0XHRcdFx0XHRsYWJlbDogZm9ybWF0X2RhdGVfbGFiZWwoIHJhbmdlLmZpcnN0X2RhdGUgKSArICggcmFuZ2UuZmlyc3RfZGF0ZSA9PT0gcmFuZ2UubGFzdF9kYXRlID8gJycgOiAnIFxcdTIwMTMgJyArIGZvcm1hdF9kYXRlX2xhYmVsKCByYW5nZS5sYXN0X2RhdGUgKSApLFxuXHRcdFx0XHRcdFx0c2NvcGU6IHJhbmdlX3Njb3BlLFxuXHRcdFx0XHRcdFx0c2NvcGVfbGFiZWw6ICdhbGwnID09PSByYW5nZV9zY29wZSA/IGdldF9tZXNzYWdlKCAnYWxsX2Jvb2tpbmdfaXRlbXMnLCAnQWxsIGJvb2tpbmcgaXRlbXMnICkgOiByZXNvdXJjZV9sYWJlbHNbIHJlc291cmNlX2lkIF1cblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0aWYgKCBpc19zaGFyZWQgKSB7XG5cdFx0XHRcdFx0XHRzaGFyZWRfYWRkZWRbIGtleSBdID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIHJlY29yZHMuc29ydCggZnVuY3Rpb24gKCBmaXJzdF9yYW5nZSwgc2Vjb25kX3JhbmdlICkge1xuXHRcdFx0XHRyZXR1cm4gKCBmaXJzdF9yYW5nZS5maXJzdF9kYXRlICsgJ3wnICsgZmlyc3RfcmFuZ2Uuc2NvcGUgKS5sb2NhbGVDb21wYXJlKCBzZWNvbmRfcmFuZ2UuZmlyc3RfZGF0ZSArICd8JyArIHNlY29uZF9yYW5nZS5zY29wZSApO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN5bmNocm9uaXplIHRoZSBjb21wbGV0ZSBzdGFnZWQgcHJvcG9zYWwgaW50byB0aGUgc2hhcmVkIHdpemFyZCBmb3JtLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzeW5jX3N0YWdlZF92YWx1ZSgpIHtcblx0XHRcdGlmICggZWRpdG9yICYmIGVkaXRvci52YWx1ZSApIHtcblx0XHRcdFx0ZWRpdG9yLnZhbHVlLnZhbHVlID0gSlNPTi5zdHJpbmdpZnkoIHtcblx0XHRcdFx0XHRyZXZpc2lvbjogYmFzZV9yZXZpc2lvbixcblx0XHRcdFx0XHR1bmF2YWlsYWJsZV9kYXRlczogYWxsX3VuYXZhaWxhYmxlX2RhdGVzXG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWJ1aWxkIGNhbGVuZGFyIGFuZCBsaXN0IHByZXNlbnRhdGlvbiBmcm9tIHRoZSBicm93c2VyIHByb3Bvc2FsLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHJlcXVlc3RlZF9zY29wZSBDdXJyZW50IGF1dGhvcml6ZWQgc2NvcGUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZWJ1aWxkX3N0YWdlZF9zdGF0ZSggcmVxdWVzdGVkX3Njb3BlICkge1xuXHRcdFx0dmFyIHJlc291cmNlX2lkcyA9IGdldF9zY29wZV9yZXNvdXJjZV9pZHMoIHJlcXVlc3RlZF9zY29wZSApO1xuXHRcdFx0dmFyIGRhdGVfY291bnRzID0ge307XG5cblx0XHRcdHN0YXRlLnNjb3BlID0gcmVxdWVzdGVkX3Njb3BlO1xuXHRcdFx0c3RhdGUudW5hdmFpbGFibGVfZGF0ZXMgPSB7fTtcblx0XHRcdHJlc291cmNlX2lkcy5mb3JFYWNoKCBmdW5jdGlvbiAoIHJlc291cmNlX2lkICkge1xuXHRcdFx0XHRzdGF0ZS51bmF2YWlsYWJsZV9kYXRlc1sgcmVzb3VyY2VfaWQgXSA9ICggYWxsX3VuYXZhaWxhYmxlX2RhdGVzWyByZXNvdXJjZV9pZCBdIHx8IFtdICkuc2xpY2UoKTtcblx0XHRcdFx0c3RhdGUudW5hdmFpbGFibGVfZGF0ZXNbIHJlc291cmNlX2lkIF0uZm9yRWFjaCggZnVuY3Rpb24gKCBkYXRlICkge1xuXHRcdFx0XHRcdGRhdGVfY291bnRzWyBkYXRlIF0gPSAoIGRhdGVfY291bnRzWyBkYXRlIF0gfHwgMCApICsgMTtcblx0XHRcdFx0fSApO1xuXHRcdFx0fSApO1xuXHRcdFx0c3RhdGUuZGF0ZV9zdGF0ZXMgPSB7fTtcblx0XHRcdE9iamVjdC5rZXlzKCBkYXRlX2NvdW50cyApLmZvckVhY2goIGZ1bmN0aW9uICggZGF0ZSApIHtcblx0XHRcdFx0c3RhdGUuZGF0ZV9zdGF0ZXNbIGRhdGUgXSA9IGRhdGVfY291bnRzWyBkYXRlIF0gPT09IHJlc291cmNlX2lkcy5sZW5ndGggPyAndW5hdmFpbGFibGUnIDogJ3BhcnRpYWxseV9hdmFpbGFibGUnO1xuXHRcdFx0fSApO1xuXHRcdFx0c3RhdGUucmFuZ2VzID0gYnVpbGRfcmFuZ2VfcmVjb3JkcyggcmVzb3VyY2VfaWRzLCByZXF1ZXN0ZWRfc2NvcGUgKTtcblx0XHRcdHN0YXRlLmlzX2FnZ3JlZ2F0ZV9zY29wZSA9ICdhbGwnID09PSByZXF1ZXN0ZWRfc2NvcGUgJiYgMSA8IHJlc291cmNlX2lkcy5sZW5ndGg7XG5cdFx0XHRhcHBseV9zY29wZV92YWx1ZSggcmVxdWVzdGVkX3Njb3BlICk7XG5cdFx0XHRpZiAoIGVkaXRvci5hZ2dyZWdhdGVfbGVnZW5kICkge1xuXHRcdFx0XHRlZGl0b3IuYWdncmVnYXRlX2xlZ2VuZC5oaWRkZW4gPSAhIHN0YXRlLmlzX2FnZ3JlZ2F0ZV9zY29wZTtcblx0XHRcdH1cblx0XHRcdGlmICggZWRpdG9yLnJlc291cmNlX2xlZ2VuZCApIHtcblx0XHRcdFx0ZWRpdG9yLnJlc291cmNlX2xlZ2VuZC5oaWRkZW4gPSBzdGF0ZS5pc19hZ2dyZWdhdGVfc2NvcGU7XG5cdFx0XHR9XG5cdFx0XHRzeW5jX3N0YWdlZF92YWx1ZSgpO1xuXHRcdFx0cmVuZGVyX3JhbmdlcygpO1xuXHRcdFx0cmVmcmVzaF9jYWxlbmRhcigpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFBhcnNlIHRoZSBoZXgtZXNjYXBlZCBpbml0aWFsIHN0YXRlIGVtaXR0ZWQgYnkgdGhlIGRvbWFpbiB0ZW1wbGF0ZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVkaXRvcl9ub2RlIEVkaXRvciByb290LlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gUGFyc2VkIHN0YXRlIG9yIGFuIGVtcHR5IG9iamVjdC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZWFkX2luaXRpYWxfc3RhdGUoIGVkaXRvcl9ub2RlICkge1xuXHRcdFx0dmFyIHN0YXRlX25vZGUgPSBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1kYXlzLW9mZi1zdGF0ZV0nICk7XG5cblx0XHRcdGlmICggISBzdGF0ZV9ub2RlICkge1xuXHRcdFx0XHRyZXR1cm4ge307XG5cdFx0XHR9XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdHJldHVybiBKU09OLnBhcnNlKCBzdGF0ZV9ub2RlLnRleHRDb250ZW50IHx8ICd7fScgKTtcblx0XHRcdH0gY2F0Y2ggKCBwYXJzZV9lcnJvciApIHtcblx0XHRcdFx0cmV0dXJuIHt9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBuYXRpdmUgQm9va2luZyBDYWxlbmRhciBjbGFzc2VzIGZvciBvbmUgc2NvcGVkIGNhbGVuZGFyIGRhdGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0RhdGV9IGRhdGUgQ2FsZW5kYXIgZGF0ZS5cblx0XHQgKiBBdmFpbGFiaWxpdHkgcmVtYWlucyBzZWxlY3RhYmxlIG9uIHRoaXMgZWRpdG9yLiBDYW5vbmljYWwgYm9va2VkLWRhdGVcblx0XHQgKiBzdGF0ZXMgYXJlIHJlYWQtb25seSBjb250ZXh0IGFuZCBmb2xsb3cgdGhlIHNhbWUgZnVsbC1kYXkvdGltZS1zbG90IGNsYXNzXG5cdFx0ICogdm9jYWJ1bGFyeSBhcyB0aGUgbmF0aXZlIERheXMgQXZhaWxhYmlsaXR5IGNhbGVuZGFyLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBOYXRpdmUgZGF5IGNsYXNzZXMgYW5kIGFuIGFjY2Vzc2libGUgc3RhdHVzIHRpdGxlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9jYWxlbmRhcl9kYXlfcHJlc2VudGF0aW9uKCBkYXRlICkge1xuXHRcdFx0dmFyIGlzb19kYXRlID0gZm9ybWF0X2lzb19kYXRlKCBkYXRlICk7XG5cdFx0XHR2YXIgc3RhdGVfY2xhc3MgPSBTdHJpbmcoIHN0YXRlLmRhdGVfc3RhdGVzWyBpc29fZGF0ZSBdIHx8ICcnICk7XG5cdFx0XHR2YXIgYm9va2luZ19zdGF0ZSA9IFN0cmluZyggc3RhdGUuYm9va2luZ19kYXRlX3N0YXRlc1sgaXNvX2RhdGUgXSB8fCAnJyApO1xuXHRcdFx0dmFyIG5hdGl2ZV9kYXRlX2NsYXNzID0gJ2NhbDRkYXRlLScgKyBTdHJpbmcoIGRhdGUuZ2V0TW9udGgoKSArIDEgKSArICctJyArIFN0cmluZyggZGF0ZS5nZXREYXRlKCkgKSArICctJyArIFN0cmluZyggZGF0ZS5nZXRGdWxsWWVhcigpICk7XG5cdFx0XHR2YXIgY3NzX2NsYXNzZXMgPSBuYXRpdmVfZGF0ZV9jbGFzcyArICcgZGF0ZV9hdmFpbGFibGUnO1xuXHRcdFx0dmFyIHN0YXR1c19sYWJlbHMgPSBbXTtcblxuXHRcdFx0aWYgKCAndW5hdmFpbGFibGUnID09PSBzdGF0ZV9jbGFzcyApIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRjc3NfY2xhc3NlczogbmF0aXZlX2RhdGVfY2xhc3MgKyAnIGRhdGVfdXNlcl91bmF2YWlsYWJsZSByZXNvdXJjZV91bmF2YWlsYWJsZSB3cGJjX3NldHVwX3dpemFyZF9fY2FsZW5kYXItZGF0ZS0tdW5hdmFpbGFibGUnLFxuXHRcdFx0XHRcdHN0YXR1c190aXRsZTogZ2V0X21lc3NhZ2UoICd1bmF2YWlsYWJsZScsICdVbmF2YWlsYWJsZScgKVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAncGFydGlhbGx5X2F2YWlsYWJsZScgPT09IHN0YXRlX2NsYXNzICkge1xuXHRcdFx0XHRjc3NfY2xhc3NlcyArPSAnIHdwYmNfcmVzb3VyY2VzX3BhcnRpYWxseV91bmF2YWlsYWJsZSB3cGJjX3NldHVwX3dpemFyZF9fY2FsZW5kYXItZGF0ZS0tcGFydGlhbGx5LWF2YWlsYWJsZSc7XG5cdFx0XHRcdHN0YXR1c19sYWJlbHMucHVzaCggZ2V0X21lc3NhZ2UoICdzb21lX3Jlc291cmNlc191bmF2YWlsYWJsZScsICdTb21lIGJvb2tpbmcgaXRlbXMgdW5hdmFpbGFibGUnICkgKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCAncmVzb3VyY2VzX2hhdmVfYm9va2luZ3MnID09PSBib29raW5nX3N0YXRlICkge1xuXHRcdFx0XHRjc3NfY2xhc3NlcyArPSAnIHdwYmNfcmVzb3VyY2VzX2hhdmVfYm9va2luZ3MnO1xuXHRcdFx0XHRzdGF0dXNfbGFiZWxzLnB1c2goIGdldF9tZXNzYWdlKCAncmVzb3VyY2VzX2hhdmVfYm9va2luZ3MnLCAnQm9va2luZ3MgZXhpc3QgZm9yIG9uZSBvciBtb3JlIGJvb2tpbmcgaXRlbXMnICkgKTtcblx0XHRcdH0gZWxzZSBpZiAoICdhcHByb3ZlZF9mdWxsJyA9PT0gYm9va2luZ19zdGF0ZSApIHtcblx0XHRcdFx0Y3NzX2NsYXNzZXMgPSBuYXRpdmVfZGF0ZV9jbGFzcyArICcgZGF0ZV9hcHByb3ZlZCBmdWxsX2RheV9ib29raW5nJztcblx0XHRcdFx0c3RhdHVzX2xhYmVscy5wdXNoKCBnZXRfbWVzc2FnZSggJ2FwcHJvdmVkX2Jvb2tpbmcnLCAnQXBwcm92ZWQgYm9va2luZycgKSApO1xuXHRcdFx0fSBlbHNlIGlmICggJ3BlbmRpbmdfZnVsbCcgPT09IGJvb2tpbmdfc3RhdGUgKSB7XG5cdFx0XHRcdGNzc19jbGFzc2VzID0gbmF0aXZlX2RhdGVfY2xhc3MgKyAnIGRhdGUyYXBwcm92ZSBmdWxsX2RheV9ib29raW5nJztcblx0XHRcdFx0c3RhdHVzX2xhYmVscy5wdXNoKCBnZXRfbWVzc2FnZSggJ3BlbmRpbmdfYm9va2luZycsICdQZW5kaW5nIGJvb2tpbmcnICkgKTtcblx0XHRcdH0gZWxzZSBpZiAoICdhcHByb3ZlZF9wYXJ0aWFsJyA9PT0gYm9va2luZ19zdGF0ZSApIHtcblx0XHRcdFx0Y3NzX2NsYXNzZXMgKz0gJyBkYXRlX2FwcHJvdmVkIHRpbWVzcGFydGx5IHRpbWVzX2Nsb2NrJztcblx0XHRcdFx0c3RhdHVzX2xhYmVscy5wdXNoKCBnZXRfbWVzc2FnZSggJ3BhcnRpYWxseV9ib29rZWQnLCAnUGFydGlhbGx5IGJvb2tlZCcgKSApO1xuXHRcdFx0fSBlbHNlIGlmICggJ3BlbmRpbmdfcGFydGlhbCcgPT09IGJvb2tpbmdfc3RhdGUgKSB7XG5cdFx0XHRcdGNzc19jbGFzc2VzICs9ICcgZGF0ZTJhcHByb3ZlIHRpbWVzcGFydGx5IHRpbWVzX2Nsb2NrJztcblx0XHRcdFx0c3RhdHVzX2xhYmVscy5wdXNoKCBnZXRfbWVzc2FnZSggJ3BhcnRpYWxseV9ib29rZWRfcGVuZGluZycsICdQYXJ0aWFsbHkgYm9va2VkOyBwZW5kaW5nIGJvb2tpbmcnICkgKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Y3NzX2NsYXNzZXM6IGNzc19jbGFzc2VzLFxuXHRcdFx0XHRzdGF0dXNfdGl0bGU6IHN0YXR1c19sYWJlbHMuam9pbiggJy4gJyApXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlZnJlc2ggdGhlIHZpc2libGUgc2VsZWN0ZWQgcmFuZ2UgYW5kIGFjdGlvbiBzdGF0ZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX3NlbGVjdGlvbl9zdW1tYXJ5KCkge1xuXHRcdFx0dmFyIGRheV9jb3VudCA9IGdldF9zZWxlY3RlZF9kYXlfY291bnQoKTtcblx0XHRcdHZhciBjb3VudF9sYWJlbCA9IDEgPT09IGRheV9jb3VudFxuXHRcdFx0XHQ/IGdldF9tZXNzYWdlKCAnb25lX3VuYXZhaWxhYmxlX2RheScsICcxIHVuYXZhaWxhYmxlIGRheScgKVxuXHRcdFx0XHQ6IGdldF9tZXNzYWdlKCAnbWFueV91bmF2YWlsYWJsZV9kYXlzJywgJyVzIHVuYXZhaWxhYmxlIGRheXMnICkucmVwbGFjZSggJyVzJywgU3RyaW5nKCBkYXlfY291bnQgKSApO1xuXG5cdFx0XHRlZGl0b3IuZmlyc3RfZGF0ZS50ZXh0Q29udGVudCA9IHNlbGVjdGVkX2ZpcnN0X2RhdGUgPyBmb3JtYXRfZGF0ZV9sYWJlbCggc2VsZWN0ZWRfZmlyc3RfZGF0ZSApIDogJyc7XG5cdFx0XHRlZGl0b3IubGFzdF9kYXRlLnRleHRDb250ZW50ID0gc2VsZWN0ZWRfbGFzdF9kYXRlID8gZm9ybWF0X2RhdGVfbGFiZWwoIHNlbGVjdGVkX2xhc3RfZGF0ZSApIDogJyc7XG5cdFx0XHRlZGl0b3Iuc3VtbWFyeV9yYW5nZS50ZXh0Q29udGVudCA9IGRheV9jb3VudCA/IGZvcm1hdF9kYXRlX2xhYmVsKCBzZWxlY3RlZF9maXJzdF9kYXRlICkgKyAoIHNlbGVjdGVkX2ZpcnN0X2RhdGUgPT09IHNlbGVjdGVkX2xhc3RfZGF0ZSA/ICcnIDogJyBcXHUyMDEzICcgKyBmb3JtYXRfZGF0ZV9sYWJlbCggc2VsZWN0ZWRfbGFzdF9kYXRlICkgKSA6ICcnO1xuXHRcdFx0ZWRpdG9yLnN1bW1hcnlfY291bnQudGV4dENvbnRlbnQgPSBkYXlfY291bnQgPyBjb3VudF9sYWJlbCA6ICcnO1xuXHRcdFx0ZWRpdG9yLmFkZF9idXR0b24uZGlzYWJsZWQgPSAhIGRheV9jb3VudCB8fCBkYXlfY291bnQgPiBzdGF0ZS5tYXhfcmFuZ2VfZGF5cztcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDcmVhdGUgb25lIGFjY2Vzc2libGUgcmFuZ2Ugcm93IHVzaW5nIHRleHQtb25seSBET00gQVBJcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByYW5nZSBBdXRob3JpemVkIHJhbmdlIHJlY29yZC5cblx0XHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfSBMaXN0IHJvdyBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNyZWF0ZV9yYW5nZV9yb3coIHJhbmdlICkge1xuXHRcdFx0dmFyIHJvdztcblx0XHRcdHZhciBkYXRlX2xhYmVsO1xuXHRcdFx0dmFyIHNjb3BlX2xhYmVsO1xuXHRcdFx0dmFyIHJlbW92ZV9idXR0b247XG5cdFx0XHR2YXIgcmVtb3ZlX2ljb247XG5cblx0XHRcdGlmICggISByYW5nZSB8fCAnc3RyaW5nJyAhPT0gdHlwZW9mIHJhbmdlLmZpcnN0X2RhdGUgfHwgJ3N0cmluZycgIT09IHR5cGVvZiByYW5nZS5sYXN0X2RhdGUgfHwgJ3N0cmluZycgIT09IHR5cGVvZiByYW5nZS5zY29wZSApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdsaScgKTtcblx0XHRcdGRhdGVfbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKTtcblx0XHRcdHNjb3BlX2xhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3NwYW4nICk7XG5cdFx0XHRyZW1vdmVfYnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2J1dHRvbicgKTtcblx0XHRcdHJlbW92ZV9pY29uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2knICk7XG5cblx0XHRcdGRhdGVfbGFiZWwudGV4dENvbnRlbnQgPSBTdHJpbmcoIHJhbmdlLmxhYmVsIHx8IHJhbmdlLmZpcnN0X2RhdGUgKTtcblx0XHRcdHNjb3BlX2xhYmVsLnRleHRDb250ZW50ID0gU3RyaW5nKCByYW5nZS5zY29wZV9sYWJlbCB8fCAnJyApO1xuXHRcdFx0cmVtb3ZlX2J1dHRvbi50eXBlID0gJ2J1dHRvbic7XG5cdFx0XHRyZW1vdmVfYnV0dG9uLmNsYXNzTmFtZSA9ICd3cGJjX3NldHVwX3dpemFyZF9fZGF5cy1vZmYtcmVtb3ZlJztcblx0XHRcdHJlbW92ZV9idXR0b24uc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWRheXMtb2ZmLXJlbW92ZScsICcnICk7XG5cdFx0XHRyZW1vdmVfYnV0dG9uLnNldEF0dHJpYnV0ZSggJ2RhdGEtZmlyc3QtZGF0ZScsIHJhbmdlLmZpcnN0X2RhdGUgKTtcblx0XHRcdHJlbW92ZV9idXR0b24uc2V0QXR0cmlidXRlKCAnZGF0YS1sYXN0LWRhdGUnLCByYW5nZS5sYXN0X2RhdGUgKTtcblx0XHRcdHJlbW92ZV9idXR0b24uc2V0QXR0cmlidXRlKCAnZGF0YS1zY29wZScsIHJhbmdlLnNjb3BlICk7XG5cdFx0XHRyZW1vdmVfYnV0dG9uLnNldEF0dHJpYnV0ZSggJ2FyaWEtbGFiZWwnLCBnZXRfbWVzc2FnZSggJ3JlbW92ZV9yYW5nZScsICdSZW1vdmUgdW5hdmFpbGFibGUgZGF0ZSByYW5nZScgKSApO1xuXHRcdFx0cmVtb3ZlX2ljb24uY2xhc3NOYW1lID0gJ21lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX2RlbGV0ZV9vdXRsaW5lJztcblx0XHRcdHJlbW92ZV9pY29uLnNldEF0dHJpYnV0ZSggJ2FyaWEtaGlkZGVuJywgJ3RydWUnICk7XG5cdFx0XHRyZW1vdmVfYnV0dG9uLmFwcGVuZENoaWxkKCByZW1vdmVfaWNvbiApO1xuXHRcdFx0cm93LmFwcGVuZENoaWxkKCBkYXRlX2xhYmVsICk7XG5cdFx0XHRyb3cuYXBwZW5kQ2hpbGQoIHNjb3BlX2xhYmVsICk7XG5cdFx0XHRyb3cuYXBwZW5kQ2hpbGQoIHJlbW92ZV9idXR0b24gKTtcblxuXHRcdFx0cmV0dXJuIHJvdztcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXBsYWNlIHRoZSB1cGNvbWluZy1yYW5nZSBsaXN0IGZyb20gc2VydmVyLWF1dGhvcml6ZWQgcmVjb3Jkcy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX3JhbmdlcygpIHtcblx0XHRcdGVkaXRvci5yYW5nZV9saXN0LnRleHRDb250ZW50ID0gJyc7XG5cdFx0XHRzdGF0ZS5yYW5nZXMuZm9yRWFjaCggZnVuY3Rpb24gKCByYW5nZSApIHtcblx0XHRcdFx0dmFyIHJvdyA9IGNyZWF0ZV9yYW5nZV9yb3coIHJhbmdlICk7XG5cblx0XHRcdFx0aWYgKCByb3cgKSB7XG5cdFx0XHRcdFx0ZWRpdG9yLnJhbmdlX2xpc3QuYXBwZW5kQ2hpbGQoIHJvdyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRlZGl0b3IuZW1wdHkuaGlkZGVuID0gMCA8IGVkaXRvci5yYW5nZV9saXN0LmNoaWxkcmVuLmxlbmd0aDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWZyZXNoIHRoZSBpbmxpbmUgY2FsZW5kYXIgYWZ0ZXIgc2VydmVyIHN0YXRlIG9yIHNjb3BlIGNoYW5nZXMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlZnJlc2hfY2FsZW5kYXIoKSB7XG5cdFx0XHRpZiAoIGVkaXRvci5jYWxlbmRhci5oYXNDbGFzcyggJC5kYXRlcGljay5tYXJrZXJDbGFzc05hbWUgKSApIHtcblx0XHRcdFx0ZWRpdG9yLmNhbGVuZGFyLmRhdGVwaWNrKCAncmVmcmVzaCcgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBNYXJrIG9ubHkgdGhlIHNjb3BlZCBjYWxlbmRhciBhcmVhIGFzIGxvYWRpbmcuXG5cdFx0ICpcblx0XHQgKiBSZXNvdXJjZSBjaGFuZ2VzIGFyZSByZWFkLW9ubHkgYW5kIHNob3VsZCBub3QgY292ZXIgdGhlIGNvbXBsZXRlIHdpemFyZFxuXHRcdCAqIHdpdGggdGhlIG11dGF0aW9uIG92ZXJsYXkuIFRoZSBkaXNhYmxlZCBzZWxlY3RvciBhbHNvIHByZXZlbnRzIGEgc2Vjb25kXG5cdFx0ICogc2NvcGUgY2hhbmdlIHdoaWxlIHRoZSBhdXRob3JpdGF0aXZlIHJlc3BvbnNlIGlzIHBlbmRpbmcuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX2xvYWRpbmcgV2hldGhlciBhbiBBSkFYIHNjb3BlIHJlcXVlc3QgaXMgYWN0aXZlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X2NhbGVuZGFyX2xvYWRpbmcoIGlzX2xvYWRpbmcgKSB7XG5cdFx0XHRlZGl0b3IuY2FsZW5kYXJfY29sdW1uLmNsYXNzTGlzdC50b2dnbGUoICdpcy1sb2FkaW5nJywgaXNfbG9hZGluZyApO1xuXHRcdFx0ZWRpdG9yLmNhbGVuZGFyX2NvbHVtbi5zZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knLCBpc19sb2FkaW5nID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdFx0ZWRpdG9yLnNjb3BlLmRpc2FibGVkID0gaXNfbG9hZGluZztcblx0XHRcdGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLWRheXMtb2ZmLXJlbW92ZV0nICkuZm9yRWFjaCggZnVuY3Rpb24gKCByZW1vdmVfYnV0dG9uICkge1xuXHRcdFx0XHRyZW1vdmVfYnV0dG9uLmRpc2FibGVkID0gaXNfbG9hZGluZztcblx0XHRcdH0gKTtcblx0XHRcdGlmICggaXNfbG9hZGluZyApIHtcblx0XHRcdFx0ZWRpdG9yLmFkZF9idXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVuZGVyX3NlbGVjdGlvbl9zdW1tYXJ5KCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU2VsZWN0IHRoZSByZXNwb25zZSBzY29wZSBvbmx5IHdoZW4gaXQgaXMgc3RpbGwgYW4gYXV0aG9yaXplZCBvcHRpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gc2NvcGUgQXV0aG9yaXplZCBzY29wZSByZXR1cm5lZCBieSB0aGUgc2VydmVyLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYXBwbHlfc2NvcGVfdmFsdWUoIHNjb3BlICkge1xuXHRcdFx0dmFyIGhhc19zY29wZSA9IEFycmF5LnByb3RvdHlwZS5zb21lLmNhbGwoIGVkaXRvci5zY29wZS5vcHRpb25zLCBmdW5jdGlvbiAoIG9wdGlvbiApIHtcblx0XHRcdFx0cmV0dXJuIFN0cmluZyggb3B0aW9uLnZhbHVlICkgPT09IHNjb3BlO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRpZiAoIGhhc19zY29wZSApIHtcblx0XHRcdFx0ZWRpdG9yLnNjb3BlLnZhbHVlID0gc2NvcGU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQXBwbHkgdGhlIGluaXRpYWwgc2VydmVyIHN0YXRlIHdpdGhvdXQgdHJ1c3RpbmcgYnJvd3Nlci1kZXJpdmVkIHJlY29yZHMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gbmV4dF9zdGF0ZSBBdXRob3JpemVkIHJlc3BvbnNlIHN0YXRlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYXBwbHlfc3RhdGUoIG5leHRfc3RhdGUgKSB7XG5cdFx0XHRzdGF0ZSA9IG5vcm1hbGl6ZV9zdGF0ZSggbmV4dF9zdGF0ZSApO1xuXHRcdFx0YmFzZV9yZXZpc2lvbiA9IHN0YXRlLnJldmlzaW9uO1xuXHRcdFx0YWxsX3VuYXZhaWxhYmxlX2RhdGVzID0gbm9ybWFsaXplX3VuYXZhaWxhYmxlX2RhdGVzKCBzdGF0ZS51bmF2YWlsYWJsZV9kYXRlcyApO1xuXHRcdFx0YXBwbHlfc2NvcGVfdmFsdWUoIHN0YXRlLnNjb3BlICk7XG5cdFx0XHRpZiAoIGVkaXRvci5hZ2dyZWdhdGVfbGVnZW5kICkge1xuXHRcdFx0XHRlZGl0b3IuYWdncmVnYXRlX2xlZ2VuZC5oaWRkZW4gPSAhIHN0YXRlLmlzX2FnZ3JlZ2F0ZV9zY29wZTtcblx0XHRcdH1cblx0XHRcdGlmICggZWRpdG9yLnJlc291cmNlX2xlZ2VuZCApIHtcblx0XHRcdFx0ZWRpdG9yLnJlc291cmNlX2xlZ2VuZC5oaWRkZW4gPSBzdGF0ZS5pc19hZ2dyZWdhdGVfc2NvcGU7XG5cdFx0XHR9XG5cdFx0XHRyZW5kZXJfcmFuZ2VzKCk7XG5cdFx0XHRyZWZyZXNoX2NhbGVuZGFyKCk7XG5cdFx0XHRzeW5jX3N0YWdlZF92YWx1ZSgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENsZWFyIG9ubHkgdGhlIHBlbmRpbmcgYnJvd3NlciBzZWxlY3Rpb24gYW5kIHJlYnVpbGQgdGhlIGRhdGVwaWNrZXIuXG5cdFx0ICpcblx0XHQgKiBDYW5vbmljYWwgdW5hdmFpbGFibGUgZGF0ZXMgYW5kIGJvb2tlZC1kYXRlIGNvbnRleHQgc3RheSBpbiBzZXJ2ZXIgc3RhdGUuXG5cdFx0ICogUmVpbml0aWFsaXphdGlvbiByZW1vdmVzIHRoZSBkYXRlcGlja2VyJ3MgcHJpdmF0ZSByYW5nZSBzZWxlY3Rpb24gd2l0aG91dFxuXHRcdCAqIG11dGF0aW5nIGVpdGhlciBkb21haW4uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNsZWFyX3NlbGVjdGVkX3JhbmdlKCkge1xuXHRcdFx0c2VsZWN0ZWRfZmlyc3RfZGF0ZSA9ICcnO1xuXHRcdFx0c2VsZWN0ZWRfbGFzdF9kYXRlID0gJyc7XG5cdFx0XHRlZGl0b3IuZXJyb3IudGV4dENvbnRlbnQgPSAnJztcblx0XHRcdGlmICggZWRpdG9yLmNhbGVuZGFyLmhhc0NsYXNzKCAkLmRhdGVwaWNrLm1hcmtlckNsYXNzTmFtZSApICkge1xuXHRcdFx0XHRlZGl0b3IuY2FsZW5kYXIuZGF0ZXBpY2soICdkZXN0cm95JyApO1xuXHRcdFx0fVxuXHRcdFx0aW5pdGlhbGl6ZV9jYWxlbmRhcigpO1xuXHRcdFx0cmVuZGVyX3NlbGVjdGlvbl9zdW1tYXJ5KCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIGEgc2FmZSBBSkFYIGVycm9yIG1lc3NhZ2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0geGhyIGpRdWVyeSByZXF1ZXN0IG9iamVjdC5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IEVycm9yIG1lc3NhZ2UuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2Vycm9yX21lc3NhZ2UoIHhociApIHtcblx0XHRcdGlmICggeGhyICYmIHhoci5yZXNwb25zZUpTT04gJiYgeGhyLnJlc3BvbnNlSlNPTi5kYXRhICYmIHhoci5yZXNwb25zZUpTT04uZGF0YS5tZXNzYWdlICkge1xuXHRcdFx0XHRyZXR1cm4gU3RyaW5nKCB4aHIucmVzcG9uc2VKU09OLmRhdGEubWVzc2FnZSApO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZ2V0X21lc3NhZ2UoICdlcnJvcicsICdEYXRlIGF2YWlsYWJpbGl0eSBjb3VsZCBub3QgYmUgdXBkYXRlZC4gVHJ5IGFnYWluLicgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBMb2FkIGJvb2tpbmcgY29udGV4dCBmb3Igb25lIGF1dGhvcml6ZWQgUmVzb3VyY2Ugc2NvcGUuXG5cdFx0ICpcblx0XHQgKiBDYW5vbmljYWwgdW5hdmFpbGFibGUgZGF0ZXMgaW4gdGhlIHJlc3BvbnNlIGFyZSBkZWxpYmVyYXRlbHkgaWdub3JlZCBzbyBhXG5cdFx0ICogc2NvcGUgc3dpdGNoIGNhbm5vdCBkaXNjYXJkIHRoZSBicm93c2VyIHByb3Bvc2FsIHdhaXRpbmcgZm9yIFNhdmUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcmVxdWVzdGVkX3Njb3BlIFJlc291cmNlIElEIG9yIGFsbC1yZXNvdXJjZXMgc2NvcGUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBsb2FkX3Njb3BlKCByZXF1ZXN0ZWRfc2NvcGUgKSB7XG5cdFx0XHR2YXIgcHJldmlvdXNfc2NvcGUgPSBzdGF0ZS5zY29wZTtcblx0XHRcdHZhciBzZXF1ZW5jZTtcblx0XHRcdHZhciByZXF1ZXN0X2lkO1xuXHRcdFx0dmFyIHJlcXVlc3Q7XG5cblx0XHRcdHJlcXVlc3Rfc2VxdWVuY2UgKz0gMTtcblx0XHRcdHNlcXVlbmNlID0gcmVxdWVzdF9zZXF1ZW5jZTtcblx0XHRcdHJlcXVlc3RfaWQgPSAnZGF5c19vZmZfbG9hZF8nICsgRGF0ZS5ub3coKSArICdfJyArIHNlcXVlbmNlO1xuXHRcdFx0ZWRpdG9yLmVycm9yLnRleHRDb250ZW50ID0gJyc7XG5cdFx0XHRzZXRfY2FsZW5kYXJfbG9hZGluZyggdHJ1ZSApO1xuXG5cdFx0XHRyZXF1ZXN0ID0gJC5hamF4KCB7XG5cdFx0XHRcdHVybDogY29uZmlnLmFqYXhfdXJsLFxuXHRcdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdFx0ZGF0YVR5cGU6ICdqc29uJyxcblx0XHRcdFx0ZGF0YToge1xuXHRcdFx0XHRcdGFjdGlvbjogY29uZmlnLmxvYWRfYWN0aW9uLFxuXHRcdFx0XHRcdG5vbmNlOiBjb25maWcubm9uY2UsXG5cdFx0XHRcdFx0c2NvcGU6IHJlcXVlc3RlZF9zY29wZSxcblx0XHRcdFx0XHRyZXF1ZXN0X2lkOiByZXF1ZXN0X2lkXG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0cmVxdWVzdC5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0XHRpZiAoIHNlcXVlbmNlICE9PSByZXF1ZXN0X3NlcXVlbmNlIHx8ICEgcmVzcG9uc2UgfHwgISByZXNwb25zZS5zdWNjZXNzIHx8ICEgcmVzcG9uc2UuZGF0YSB8fCByZXNwb25zZS5kYXRhLnJlcXVlc3RfaWQgIT09IHJlcXVlc3RfaWQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dmFyIGxvYWRlZF9zdGF0ZSA9IG5vcm1hbGl6ZV9zdGF0ZSggcmVzcG9uc2UuZGF0YS5zdGF0ZSApO1xuXG5cdFx0XHRcdHN0YXRlLmJvb2tpbmdfZGF0ZV9zdGF0ZXMgPSBsb2FkZWRfc3RhdGUuYm9va2luZ19kYXRlX3N0YXRlcztcblx0XHRcdFx0c3RhdGUudG9kYXkgPSBsb2FkZWRfc3RhdGUudG9kYXkgfHwgc3RhdGUudG9kYXk7XG5cdFx0XHRcdHN0YXRlLmZpcnN0X2RheSA9IGxvYWRlZF9zdGF0ZS5maXJzdF9kYXk7XG5cdFx0XHRcdHN0YXRlLm1heF9yYW5nZV9kYXlzID0gbG9hZGVkX3N0YXRlLm1heF9yYW5nZV9kYXlzO1xuXHRcdFx0XHRyZWJ1aWxkX3N0YWdlZF9zdGF0ZSggbG9hZGVkX3N0YXRlLnNjb3BlICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJlcXVlc3QuZmFpbCggZnVuY3Rpb24gKCB4aHIgKSB7XG5cdFx0XHRcdHZhciBtZXNzYWdlO1xuXG5cdFx0XHRcdGlmICggc2VxdWVuY2UgIT09IHJlcXVlc3Rfc2VxdWVuY2UgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0YXBwbHlfc2NvcGVfdmFsdWUoIHByZXZpb3VzX3Njb3BlICk7XG5cdFx0XHRcdG1lc3NhZ2UgPSBnZXRfZXJyb3JfbWVzc2FnZSggeGhyICk7XG5cdFx0XHRcdGVkaXRvci5lcnJvci50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG5cdFx0XHRcdHNoZWxsX2FwaS5zZXRfc3RhdHVzKCBtZXNzYWdlICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJlcXVlc3QuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmICggc2VxdWVuY2UgIT09IHJlcXVlc3Rfc2VxdWVuY2UgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0c2V0X2NhbGVuZGFyX2xvYWRpbmcoIGZhbHNlICk7XG5cdFx0XHRcdGVkaXRvci5zY29wZS5mb2N1cygpO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN0YWdlIG9uZSBleHBsaWNpdCBhZGQvcmVtb3ZlIG9wZXJhdGlvbiBmb3IgdGhlIHNoYXJlZCBTYXZlIGJvdW5kYXJ5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG9wZXJhdGlvbiAgQWRkIG9yIHJlbW92ZS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gc2NvcGUgICAgICBBdXRob3JpemVkIHNjb3BlIHZhbHVlLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBmaXJzdF9kYXRlIEZpcnN0IElTTyBkYXRlLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBsYXN0X2RhdGUgIExhc3QgSVNPIGRhdGUuXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSBmb2N1c190YXJnZXQgRm9jdXMgdGFyZ2V0IHJlc3RvcmVkIGFmdGVyIGNvbXBsZXRpb24uXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9ICAgICAgICAgICByZW1vdmVfaW5kZXggSW5kZXggb2YgdGhlIHJlbW92ZWQgcm93IGZvciBmb2N1cyByZWNvdmVyeS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHN0YWdlX3JhbmdlKCBvcGVyYXRpb24sIHNjb3BlLCBmaXJzdF9kYXRlLCBsYXN0X2RhdGUsIGZvY3VzX3RhcmdldCwgcmVtb3ZlX2luZGV4ICkge1xuXHRcdFx0dmFyIHJlc291cmNlX2lkcyA9IGdldF9zY29wZV9yZXNvdXJjZV9pZHMoIHNjb3BlICk7XG5cdFx0XHR2YXIgcmFuZ2VfZGF0ZXMgPSBleHBhbmRfZGF0ZV9yYW5nZSggZmlyc3RfZGF0ZSwgbGFzdF9kYXRlICk7XG5cblx0XHRcdGlmICggISByZXNvdXJjZV9pZHMubGVuZ3RoIHx8ICEgcmFuZ2VfZGF0ZXMubGVuZ3RoICkge1xuXHRcdFx0XHRlZGl0b3IuZXJyb3IudGV4dENvbnRlbnQgPSBnZXRfbWVzc2FnZSggJ3JhbmdlX2ludmFsaWQnLCAnU2VsZWN0IGEgdmFsaWQgdW5hdmFpbGFibGUgZGF0ZSByYW5nZS4nICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHJlc291cmNlX2lkcy5mb3JFYWNoKCBmdW5jdGlvbiAoIHJlc291cmNlX2lkICkge1xuXHRcdFx0XHR2YXIgY3VycmVudF9kYXRlcyA9IGFsbF91bmF2YWlsYWJsZV9kYXRlc1sgcmVzb3VyY2VfaWQgXSB8fCBbXTtcblxuXHRcdFx0XHRpZiAoICdhZGQnID09PSBvcGVyYXRpb24gKSB7XG5cdFx0XHRcdFx0YWxsX3VuYXZhaWxhYmxlX2RhdGVzWyByZXNvdXJjZV9pZCBdID0gY3VycmVudF9kYXRlcy5jb25jYXQoIHJhbmdlX2RhdGVzICkuZmlsdGVyKCBmdW5jdGlvbiAoIGRhdGUsIGluZGV4LCBzb3VyY2UgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gc291cmNlLmluZGV4T2YoIGRhdGUgKSA9PT0gaW5kZXg7XG5cdFx0XHRcdFx0fSApLnNvcnQoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhbGxfdW5hdmFpbGFibGVfZGF0ZXNbIHJlc291cmNlX2lkIF0gPSBjdXJyZW50X2RhdGVzLmZpbHRlciggZnVuY3Rpb24gKCBkYXRlICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHJhbmdlX2RhdGVzLmluZGV4T2YoIGRhdGUgKSA9PT0gLTE7XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHRcdGVkaXRvci5lcnJvci50ZXh0Q29udGVudCA9ICcnO1xuXHRcdFx0cmVidWlsZF9zdGFnZWRfc3RhdGUoIFN0cmluZyggZWRpdG9yLnNjb3BlLnZhbHVlIHx8ICdhbGwnICkgKTtcblx0XHRcdGlmICggJ2FkZCcgPT09IG9wZXJhdGlvbiApIHtcblx0XHRcdFx0Y2xlYXJfc2VsZWN0ZWRfcmFuZ2UoKTtcblx0XHRcdH1cblx0XHRcdHNoZWxsX2FwaS5zZXRfc3RhdHVzKCAnYWRkJyA9PT0gb3BlcmF0aW9uID8gZ2V0X21lc3NhZ2UoICdhZGRlZCcsICdUaGUgdW5hdmFpbGFibGUgZGF0ZSByYW5nZSBpcyBzdGFnZWQuJyApIDogZ2V0X21lc3NhZ2UoICdyZW1vdmVkJywgJ1RoZSB1bmF2YWlsYWJsZSBkYXRlIHJhbmdlIHJlbW92YWwgaXMgc3RhZ2VkLicgKSApO1xuXHRcdFx0d2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0dmFyIHJlbWFpbmluZ19yZW1vdmVfYnV0dG9ucyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1kYXlzLW9mZi1yZW1vdmVdJyApICk7XG5cdFx0XHRcdHZhciBmYWxsYmFja190YXJnZXQgPSBudWxsO1xuXG5cdFx0XHRcdGlmICggZm9jdXNfdGFyZ2V0ICYmICEgZm9jdXNfdGFyZ2V0LmRpc2FibGVkICYmIGRvY3VtZW50LmJvZHkuY29udGFpbnMoIGZvY3VzX3RhcmdldCApICkge1xuXHRcdFx0XHRcdGZvY3VzX3dpdGhvdXRfc2Nyb2xsaW5nKCBmb2N1c190YXJnZXQgKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAncmVtb3ZlJyA9PT0gb3BlcmF0aW9uICYmIHJlbWFpbmluZ19yZW1vdmVfYnV0dG9ucy5sZW5ndGggJiYgcmVtb3ZlX2luZGV4ID49IDAgKSB7XG5cdFx0XHRcdFx0ZmFsbGJhY2tfdGFyZ2V0ID0gcmVtYWluaW5nX3JlbW92ZV9idXR0b25zWyBNYXRoLm1pbiggcmVtb3ZlX2luZGV4LCByZW1haW5pbmdfcmVtb3ZlX2J1dHRvbnMubGVuZ3RoIC0gMSApIF07XG5cdFx0XHRcdH1cblx0XHRcdFx0Zm9jdXNfd2l0aG91dF9zY3JvbGxpbmcoIGZhbGxiYWNrX3RhcmdldCB8fCBlZGl0b3Iuc2NvcGUgKTtcblx0XHRcdH0sIDAgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXByb2R1Y2UgdGhlIG5hdGl2ZSBCb29raW5nIENhbGVuZGFyIHJhbmdlLWhvdmVyIGhpZ2hsaWdodC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBob3ZlcmVkX3ZhbHVlIERhdGVwaWNrZXIgdmFsdWUgc3VwcGxpZWQgYnkgdGhlIHBsdWdpbi5cblx0XHQgKiBAcGFyYW0ge0RhdGV9ICAgaG92ZXJlZF9kYXRlICBDYWxlbmRhciBkYXkgY3VycmVudGx5IHVuZGVyIHRoZSBwb2ludGVyLlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgc28gdGhlIGRhdGVwaWNrZXIgY29udGludWVzIGl0cyBub3JtYWwgaGFuZGxpbmcuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2NhbGVuZGFyX2hvdmVyKCBob3ZlcmVkX3ZhbHVlLCBob3ZlcmVkX2RhdGUgKSB7XG5cdFx0XHR2YXIgZGF0ZXBpY2tfaW5zdGFuY2U7XG5cdFx0XHR2YXIgcmFuZ2Vfc3RhcnQ7XG5cdFx0XHR2YXIgY3Vyc29yX2RhdGU7XG5cdFx0XHR2YXIgc2FmZXR5X2NvdW50ID0gMDtcblxuXHRcdFx0ZWRpdG9yLmNhbGVuZGFyLmZpbmQoICcuZGF0ZXBpY2stZGF5cy1jZWxsLW92ZXInICkucmVtb3ZlQ2xhc3MoICdkYXRlcGljay1kYXlzLWNlbGwtb3ZlcicgKTtcblx0XHRcdGlmICggISBob3ZlcmVkX2RhdGUgfHwgISAkLmRhdGVwaWNrIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiAkLmRhdGVwaWNrLl9nZXRJbnN0ICkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0ZGF0ZXBpY2tfaW5zdGFuY2UgPSAkLmRhdGVwaWNrLl9nZXRJbnN0KCBlZGl0b3IuY2FsZW5kYXJbIDAgXSApO1xuXHRcdFx0aWYgKCAhIGRhdGVwaWNrX2luc3RhbmNlIHx8ICEgZGF0ZXBpY2tfaW5zdGFuY2UuZGF0ZXMgfHwgMSAhPT0gZGF0ZXBpY2tfaW5zdGFuY2UuZGF0ZXMubGVuZ3RoIHx8ICEgZGF0ZXBpY2tfaW5zdGFuY2UuZGF0ZXNbIDAgXSApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdHJhbmdlX3N0YXJ0ID0gbmV3IERhdGUoIGRhdGVwaWNrX2luc3RhbmNlLmRhdGVzWyAwIF0uZ2V0VGltZSgpICk7XG5cdFx0XHRpZiAoIGhvdmVyZWRfZGF0ZSA8IHJhbmdlX3N0YXJ0ICkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0Y3Vyc29yX2RhdGUgPSBuZXcgRGF0ZSggcmFuZ2Vfc3RhcnQuZ2V0VGltZSgpICk7XG5cdFx0XHR3aGlsZSAoIGN1cnNvcl9kYXRlIDw9IGhvdmVyZWRfZGF0ZSAmJiBzYWZldHlfY291bnQgPD0gc3RhdGUubWF4X3JhbmdlX2RheXMgKSB7XG5cdFx0XHRcdGVkaXRvci5jYWxlbmRhci5maW5kKCAnLmNhbDRkYXRlLScgKyBTdHJpbmcoIGN1cnNvcl9kYXRlLmdldE1vbnRoKCkgKyAxICkgKyAnLScgKyBTdHJpbmcoIGN1cnNvcl9kYXRlLmdldERhdGUoKSApICsgJy0nICsgU3RyaW5nKCBjdXJzb3JfZGF0ZS5nZXRGdWxsWWVhcigpICkgKS5hZGRDbGFzcyggJ2RhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApO1xuXHRcdFx0XHRjdXJzb3JfZGF0ZS5zZXREYXRlKCBjdXJzb3JfZGF0ZS5nZXREYXRlKCkgKyAxICk7XG5cdFx0XHRcdHNhZmV0eV9jb3VudCArPSAxO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBJbml0aWFsaXplIEJvb2tpbmcgQ2FsZW5kYXIncyBzdGFuZGFyZCB0d28tbW9udGggcmFuZ2UgZGF0ZXBpY2tlci5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaW5pdGlhbGl6ZV9jYWxlbmRhcigpIHtcblx0XHRcdHZhciBmaXJzdF9kYXRlID0gcGFyc2VfaXNvX2RhdGUoIHNlbGVjdGVkX2ZpcnN0X2RhdGUgKTtcblx0XHRcdHZhciBsYXN0X2RhdGUgPSBwYXJzZV9pc29fZGF0ZSggc2VsZWN0ZWRfbGFzdF9kYXRlICk7XG5cblx0XHRcdGlmICggISAkLmZuLmRhdGVwaWNrICkge1xuXHRcdFx0XHRlZGl0b3IuZXJyb3IudGV4dENvbnRlbnQgPSBnZXRfbWVzc2FnZSggJ2NhbGVuZGFyX3VuYXZhaWxhYmxlJywgJ1RoZSBkYXRlIHNlbGVjdG9yIGNvdWxkIG5vdCBiZSBsb2FkZWQuIFJlbG9hZCB0aGUgcGFnZSBhbmQgdHJ5IGFnYWluLicgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRlZGl0b3IuY2FsZW5kYXIuZGF0ZXBpY2soIHtcblx0XHRcdFx0YmVmb3JlU2hvd0RheTogZnVuY3Rpb24gKCBkYXRlICkge1xuXHRcdFx0XHRcdHZhciBkYXlfcHJlc2VudGF0aW9uID0gZ2V0X2NhbGVuZGFyX2RheV9wcmVzZW50YXRpb24oIGRhdGUgKTtcblxuXHRcdFx0XHRcdHJldHVybiBbIHRydWUsIGRheV9wcmVzZW50YXRpb24uY3NzX2NsYXNzZXMsIGRheV9wcmVzZW50YXRpb24uc3RhdHVzX3RpdGxlIF07XG5cdFx0XHRcdH0sXG5cdFx0XHRcdG9uSG92ZXI6IGhhbmRsZV9jYWxlbmRhcl9ob3Zlcixcblx0XHRcdFx0b25TZWxlY3Q6IGZ1bmN0aW9uICggZGF0ZV9zdHJpbmcsIHNlbGVjdGVkX2RhdGVzICkge1xuXHRcdFx0XHRcdGlmICggISBBcnJheS5pc0FycmF5KCBzZWxlY3RlZF9kYXRlcyApIHx8ICEgc2VsZWN0ZWRfZGF0ZXNbIDAgXSApIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRzZWxlY3RlZF9maXJzdF9kYXRlID0gZm9ybWF0X2lzb19kYXRlKCBzZWxlY3RlZF9kYXRlc1sgMCBdICk7XG5cdFx0XHRcdFx0c2VsZWN0ZWRfbGFzdF9kYXRlID0gZm9ybWF0X2lzb19kYXRlKCBzZWxlY3RlZF9kYXRlc1sgMSBdIHx8IHNlbGVjdGVkX2RhdGVzWyAwIF0gKTtcblx0XHRcdFx0XHRlZGl0b3IuZXJyb3IudGV4dENvbnRlbnQgPSAnJztcblx0XHRcdFx0XHRyZW5kZXJfc2VsZWN0aW9uX3N1bW1hcnkoKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0c2hvd09uOiAnbm9uZScsXG5cdFx0XHRcdG51bWJlck9mTW9udGhzOiAyLFxuXHRcdFx0XHRzdGVwTW9udGhzOiAxLFxuXHRcdFx0XHRwcmV2VGV4dDogJyZsc2FxdW87Jyxcblx0XHRcdFx0bmV4dFRleHQ6ICcmcnNhcXVvOycsXG5cdFx0XHRcdGRhdGVGb3JtYXQ6ICd5eS1tbS1kZCcsXG5cdFx0XHRcdGNoYW5nZU1vbnRoOiBmYWxzZSxcblx0XHRcdFx0Y2hhbmdlWWVhcjogZmFsc2UsXG5cdFx0XHRcdG1pbkRhdGU6IHBhcnNlX2lzb19kYXRlKCBzdGF0ZS50b2RheSApIHx8IDAsXG5cdFx0XHRcdG1heERhdGU6ICcxMHknLFxuXHRcdFx0XHRzaG93U3RhdHVzOiBmYWxzZSxcblx0XHRcdFx0Y2xvc2VBdFRvcDogZmFsc2UsXG5cdFx0XHRcdGZpcnN0RGF5OiBzdGF0ZS5maXJzdF9kYXksXG5cdFx0XHRcdGdvdG9DdXJyZW50OiBmYWxzZSxcblx0XHRcdFx0aGlkZUlmTm9QcmV2TmV4dDogdHJ1ZSxcblx0XHRcdFx0bXVsdGlTZXBhcmF0b3I6ICcsICcsXG5cdFx0XHRcdG11bHRpU2VsZWN0OiAwLFxuXHRcdFx0XHRyYW5nZVNlbGVjdDogdHJ1ZSxcblx0XHRcdFx0cmFuZ2VTZXBhcmF0b3I6ICcgfiAnLFxuXHRcdFx0XHR1c2VUaGVtZVJvbGxlcjogZmFsc2UsXG5cdFx0XHRcdG1hbmRhdG9yeTogdHJ1ZVxuXHRcdFx0fSApO1xuXG5cdFx0XHRpZiAoIGZpcnN0X2RhdGUgJiYgbGFzdF9kYXRlICkge1xuXHRcdFx0XHRlZGl0b3IuY2FsZW5kYXIuZGF0ZXBpY2soICdzZXREYXRlJywgZmlyc3RfZGF0ZSwgbGFzdF9kYXRlICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSGFuZGxlIEFkZCwgQ2xlYXIsIGFuZCBSZW1vdmUgYWN0aW9ucy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7TW91c2VFdmVudH0gZXZlbnQgRGVsZWdhdGVkIGNsaWNrIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2NsaWNrKCBldmVudCApIHtcblx0XHRcdHZhciByZW1vdmVfYnV0dG9uID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWRheXMtb2ZmLXJlbW92ZV0nICk7XG5cdFx0XHR2YXIgcmVtb3ZlX2J1dHRvbnM7XG5cdFx0XHR2YXIgcmVtb3ZlX2luZGV4O1xuXHRcdFx0dmFyIGRheV9jb3VudDtcblxuXHRcdFx0aWYgKCBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtZGF5cy1vZmYtYWRkXScgKSApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0ZGF5X2NvdW50ID0gZ2V0X3NlbGVjdGVkX2RheV9jb3VudCgpO1xuXHRcdFx0XHRpZiAoICEgZGF5X2NvdW50IHx8IGRheV9jb3VudCA+IHN0YXRlLm1heF9yYW5nZV9kYXlzICkge1xuXHRcdFx0XHRcdGVkaXRvci5lcnJvci50ZXh0Q29udGVudCA9IGdldF9tZXNzYWdlKCAncmFuZ2VfaW52YWxpZCcsICdTZWxlY3QgYSB2YWxpZCB1bmF2YWlsYWJsZSBkYXRlIHJhbmdlLicgKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0c3RhZ2VfcmFuZ2UoICdhZGQnLCBTdHJpbmcoIGVkaXRvci5zY29wZS52YWx1ZSB8fCAnYWxsJyApLCBzZWxlY3RlZF9maXJzdF9kYXRlLCBzZWxlY3RlZF9sYXN0X2RhdGUsIGVkaXRvci5hZGRfYnV0dG9uLCAtMSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICggZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWRheXMtb2ZmLWNsZWFyXScgKSApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0Y2xlYXJfc2VsZWN0ZWRfcmFuZ2UoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIHJlbW92ZV9idXR0b24gKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHJlbW92ZV9idXR0b25zID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLWRheXMtb2ZmLXJlbW92ZV0nICkgKTtcblx0XHRcdFx0cmVtb3ZlX2luZGV4ID0gcmVtb3ZlX2J1dHRvbnMuaW5kZXhPZiggcmVtb3ZlX2J1dHRvbiApO1xuXHRcdFx0XHRzdGFnZV9yYW5nZShcblx0XHRcdFx0XHQncmVtb3ZlJyxcblx0XHRcdFx0XHRTdHJpbmcoIHJlbW92ZV9idXR0b24uZ2V0QXR0cmlidXRlKCAnZGF0YS1zY29wZScgKSB8fCAnJyApLFxuXHRcdFx0XHRcdFN0cmluZyggcmVtb3ZlX2J1dHRvbi5nZXRBdHRyaWJ1dGUoICdkYXRhLWZpcnN0LWRhdGUnICkgfHwgJycgKSxcblx0XHRcdFx0XHRTdHJpbmcoIHJlbW92ZV9idXR0b24uZ2V0QXR0cmlidXRlKCAnZGF0YS1sYXN0LWRhdGUnICkgfHwgJycgKSxcblx0XHRcdFx0XHRudWxsLFxuXHRcdFx0XHRcdHJlbW92ZV9pbmRleFxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEluaXRpYWxpemUgdGhlIGVkaXRvciBhZ2FpbnN0IGRvbWFpbi1uZXV0cmFsIHNoZWxsIHNlcnZpY2VzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJlZ2lzdGVyZWRfc2hlbGxfYXBpIFNoYXJlZCBzaGVsbCBzZXJ2aWNlcy5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGluaXRpYWxpemUoIHJlZ2lzdGVyZWRfc2hlbGxfYXBpICkge1xuXHRcdFx0dmFyIGVkaXRvcl9ub2RlO1xuXG5cdFx0XHRzaGVsbF9hcGkgPSByZWdpc3RlcmVkX3NoZWxsX2FwaTtcblx0XHRcdGVkaXRvcl9ub2RlID0gc2hlbGxfYXBpLnJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF5cy1vZmYtZWRpdG9yXScgKTtcblx0XHRcdGlmICggISBlZGl0b3Jfbm9kZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRzdGF0ZSA9IG5vcm1hbGl6ZV9zdGF0ZSggcmVhZF9pbml0aWFsX3N0YXRlKCBlZGl0b3Jfbm9kZSApICk7XG5cdFx0XHRpZiAoICEgc3RhdGUuY2FuX21hbmFnZSB8fCAhIHN0YXRlLmhhc19yZXNvdXJjZXMgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0ZWRpdG9yID0ge1xuXHRcdFx0XHRub2RlOiBlZGl0b3Jfbm9kZSxcblx0XHRcdFx0Y2FsZW5kYXJfY29sdW1uOiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1kYXlzLW9mZi1jYWxlbmRhci1jb2x1bW5dJyApLFxuXHRcdFx0XHRjYWxlbmRhcjogJCggZWRpdG9yX25vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF5cy1vZmYtY2FsZW5kYXJdJyApICksXG5cdFx0XHRcdGZpcnN0X2RhdGU6IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWRheXMtb2ZmLWZpcnN0LWRhdGVdJyApLFxuXHRcdFx0XHRsYXN0X2RhdGU6IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWRheXMtb2ZmLWxhc3QtZGF0ZV0nICksXG5cdFx0XHRcdHNjb3BlOiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1kYXlzLW9mZi1zY29wZV0nICksXG5cdFx0XHRcdGFnZ3JlZ2F0ZV9sZWdlbmQ6IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWRheXMtb2ZmLWFnZ3JlZ2F0ZS1sZWdlbmRdJyApLFxuXHRcdFx0XHRyZXNvdXJjZV9sZWdlbmQ6IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWRheXMtb2ZmLXJlc291cmNlLWxlZ2VuZF0nICksXG5cdFx0XHRcdHN1bW1hcnlfcmFuZ2U6IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWRheXMtb2ZmLXN1bW1hcnktcmFuZ2VdJyApLFxuXHRcdFx0XHRzdW1tYXJ5X2NvdW50OiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1kYXlzLW9mZi1zdW1tYXJ5LWNvdW50XScgKSxcblx0XHRcdFx0YWRkX2J1dHRvbjogZWRpdG9yX25vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF5cy1vZmYtYWRkXScgKSxcblx0XHRcdFx0ZXJyb3I6IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWRheXMtb2ZmLWVycm9yXScgKSxcblx0XHRcdFx0cmFuZ2VfbGlzdDogZWRpdG9yX25vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF5cy1vZmYtcmFuZ2VzXScgKSxcblx0XHRcdFx0ZW1wdHk6IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWRheXMtb2ZmLWVtcHR5XScgKSxcblx0XHRcdFx0dmFsdWU6IHNoZWxsX2FwaS5yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWRheXMtb2ZmLXZhbHVlXScgKVxuXHRcdFx0fTtcblx0XHRcdGJhc2VfcmV2aXNpb24gPSBzdGF0ZS5yZXZpc2lvbjtcblx0XHRcdGFsbF91bmF2YWlsYWJsZV9kYXRlcyA9IG5vcm1hbGl6ZV91bmF2YWlsYWJsZV9kYXRlcyggc3RhdGUudW5hdmFpbGFibGVfZGF0ZXMgKTtcblxuXHRcdFx0c2VsZWN0ZWRfZmlyc3RfZGF0ZSA9IHN0YXRlLmRlZmF1bHRfZmlyc3RfZGF0ZSB8fCBzdGF0ZS50b2RheTtcblx0XHRcdHNlbGVjdGVkX2xhc3RfZGF0ZSA9IHN0YXRlLmRlZmF1bHRfbGFzdF9kYXRlIHx8IHNlbGVjdGVkX2ZpcnN0X2RhdGU7XG5cdFx0XHRhcHBseV9zY29wZV92YWx1ZSggc3RhdGUuc2NvcGUgKTtcblx0XHRcdGVkaXRvci5ub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGhhbmRsZV9jbGljayApO1xuXHRcdFx0ZWRpdG9yLnNjb3BlLmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGxvYWRfc2NvcGUoIFN0cmluZyggZWRpdG9yLnNjb3BlLnZhbHVlIHx8ICdhbGwnICkgKTtcblx0XHRcdH0gKTtcblx0XHRcdGluaXRpYWxpemVfY2FsZW5kYXIoKTtcblx0XHRcdHJlbmRlcl9zZWxlY3Rpb25fc3VtbWFyeSgpO1xuXHRcdFx0cmVuZGVyX3JhbmdlcygpO1xuXHRcdFx0c3luY19zdGFnZWRfdmFsdWUoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0aW5pdGlhbGl6ZTogaW5pdGlhbGl6ZSxcblx0XHRcdHN5bmM6IHN5bmNfc3RhZ2VkX3ZhbHVlLFxuXHRcdFx0dmFsaWRhdGU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHdpbmRvdy53cGJjX3NldHVwX2VkaXRvcl9tb2R1bGVzID0gd2luZG93LndwYmNfc2V0dXBfZWRpdG9yX21vZHVsZXMgfHwge307XG5cdHdpbmRvdy53cGJjX3NldHVwX2VkaXRvcl9tb2R1bGVzLmRheXNfb2ZmID0ge1xuXHRcdGNyZWF0ZTogY3JlYXRlX2RheXNfb2ZmX2FkYXB0ZXJcblx0fTtcblxuXHRpZiAoIHdpbmRvdy53cGJjX3NldHVwX3dpemFyZF9hcGkgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX3NldHVwX3dpemFyZF9hcGkucmVnaXN0ZXJfc3RlcF9hZGFwdGVyICkge1xuXHRcdHdpbmRvdy53cGJjX3NldHVwX3dpemFyZF9hcGkucmVnaXN0ZXJfc3RlcF9hZGFwdGVyKCBjcmVhdGVfZGF5c19vZmZfYWRhcHRlciggbW9kdWxlX2NvbmZpZyApICk7XG5cdH1cbn0oIGpRdWVyeSwgd2luZG93LCBkb2N1bWVudCApICk7XG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDRSxXQUFXQSxDQUFDLEVBQUVDLE1BQU0sRUFBRUMsUUFBUSxFQUFHO0VBQ2xDLFlBQVk7O0VBRVosSUFBSUMsYUFBYSxHQUFHRixNQUFNLENBQUNHLDBCQUEwQixJQUFJO0lBQUVDLElBQUksRUFBRSxDQUFD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
