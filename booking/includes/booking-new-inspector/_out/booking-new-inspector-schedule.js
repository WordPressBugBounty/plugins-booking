"use strict";

/**
 * Creation-only schedule workflow for Add New Booking Inspector.
 *
 * This source file is compiled by the normal WPBC asset process. It deliberately
 * owns no Inspector host, button, template, review, apply, or persistence logic.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

(function (window, document, $) {
  'use strict';

  var EVENT_NAMESPACE = '.wpbcBookingNewInspectorSchedule';
  var NATIVE_LOAD_TIMEOUT_MS = 30000;

  /**
   * Normalize a positive Resource identifier.
   *
   * @param {*} resource_id Candidate Resource ID.
   * @return {number} Positive Resource ID or zero.
   */
  function normalize_resource_id(resource_id) {
    resource_id = Number(resource_id);
    return Number.isInteger(resource_id) && resource_id > 0 ? resource_id : 0;
  }

  /**
   * Normalize ordered unique ISO calendar dates.
   *
   * @param {*} selected_dates Candidate date list.
   * @return {Array<string>} Ordered unique strict ISO dates.
   */
  function normalize_iso_dates(selected_dates) {
    var unique_dates = {};
    if (!Array.isArray(selected_dates)) {
      return [];
    }
    selected_dates.forEach(function (selected_date) {
      if ('string' === typeof selected_date && /^\d{4}-\d{2}-\d{2}$/.test(selected_date)) {
        unique_dates[selected_date] = selected_date;
      }
    });
    return Object.keys(unique_dates).sort();
  }

  /**
   * Normalize one exact-minute wall time.
   *
   * @param {*} time_value Candidate time.
   * @return {string} Strict HH:MM value or empty string.
   */
  function normalize_time(time_value) {
    time_value = 'string' === typeof time_value ? time_value.trim() : '';
    return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time_value) ? time_value : '';
  }

  /**
   * Clone the bounded creation schedule DTO.
   *
   * @param {*} schedule Candidate server or local schedule.
   * @return {Object} Independent normalized draft.
   */
  function clone_schedule(schedule) {
    schedule = schedule && 'object' === typeof schedule && !Array.isArray(schedule) ? schedule : {};
    return {
      selection_method: 'individual' === schedule.selection_method ? 'individual' : 'policy',
      time_application: -1 !== ['full_day', 'boundary', 'per_date'].indexOf(schedule.time_application) ? schedule.time_application : 'full_day',
      selected_dates: normalize_iso_dates(schedule.selected_dates),
      start_time: normalize_time(schedule.start_time),
      end_time: normalize_time(schedule.end_time),
      seed_source: -1 !== ['empty', 'timeline', 'draft'].indexOf(schedule.seed_source) ? schedule.seed_source : 'empty',
      exact_timeline_seed: true === schedule.exact_timeline_seed
    };
  }

  /**
   * Compare two normalized creation schedules without sharing references.
   *
   * The draft is bounded to the fixed schedule DTO, so a stable property-by-
   * property comparison is sufficient and avoids treating native calendar DOM
   * state as authoritative.
   *
   * @param {*} left_schedule  First candidate schedule.
   * @param {*} right_schedule Second candidate schedule.
   * @return {boolean} True when both normalized schedules are identical.
   */
  function schedules_are_equal(left_schedule, right_schedule) {
    var left = clone_schedule(left_schedule);
    var right = clone_schedule(right_schedule);
    return left.selection_method === right.selection_method && left.time_application === right.time_application && left.selected_dates.join('|') === right.selected_dates.join('|') && left.start_time === right.start_time && left.end_time === right.end_time && left.seed_source === right.seed_source && left.exact_timeline_seed === right.exact_timeline_seed;
  }

  /**
   * Create one dormant creation-schedule workflow.
   *
   * The workflow calls only its creation schedule read endpoint and the shared
   * native calendar adapter. Date Editor read, review, and apply actions are not
   * dependencies. The caller owns presentation and creation state transitions.
   *
   * @param {Object} configuration Authorized runtime configuration and callbacks.
   * @return {Object} Creation schedule workflow API.
   */
  function create_schedule_workflow(configuration) {
    var root;
    var calendar_host;
    var generation = 0;
    var pending_request = null;
    var native_adapter = null;
    var native_load_timer = null;
    var initial_draft = null;
    var draft = null;
    var active_response = null;
    configuration = configuration && 'object' === typeof configuration ? configuration : {};
    root = configuration.root && 1 === configuration.root.nodeType ? configuration.root : null;
    calendar_host = configuration.calendar_host && 1 === configuration.calendar_host.nodeType ? configuration.calendar_host : null;

    /**
     * Resolve the current domain-owned calendar host after a template refresh.
     *
     * @return {Element|null} Current calendar host or null.
     */
    function get_calendar_host() {
      var refreshed_host = 'function' === typeof configuration.get_calendar_host ? configuration.get_calendar_host() : null;
      if (refreshed_host && 1 === refreshed_host.nodeType) {
        calendar_host = refreshed_host;
      }
      return calendar_host;
    }

    /**
     * Report whether the local schedule differs from its immutable server seed.
     *
     * @return {boolean} True only after a successful read and a local change.
     */
    function is_dirty() {
      return Boolean(initial_draft && draft && !schedules_are_equal(initial_draft, draft));
    }

    /**
     * Notify the host that the local schedule draft changed.
     *
     * @return {void}
     */
    function notify_change() {
      if ('function' === typeof configuration.on_change && draft) {
        configuration.on_change(clone_schedule(draft), {
          is_dirty: is_dirty()
        });
      }
    }

    /**
     * Notify the host about the current loading state.
     *
     * @param {boolean} is_loading Whether a schedule or availability read is active.
     * @return {void}
     */
    function notify_loading(is_loading) {
      if ('function' === typeof configuration.on_loading) {
        configuration.on_loading(Boolean(is_loading));
      }
    }

    /**
     * Notify the host about one safe read or native-calendar failure.
     *
     * @param {*} error_value Error DTO or native failure.
     * @return {void}
     */
    function notify_error(error_value) {
      if ('function' === typeof configuration.on_error) {
        configuration.on_error(error_value || {});
      }
    }

    /**
     * Clear the bounded native availability timeout.
     *
     * @return {void}
     */
    function clear_native_timer() {
      if (native_load_timer) {
        window.clearTimeout(native_load_timer);
        native_load_timer = null;
      }
    }

    /**
     * Abort reads and remove native state owned by the current generation.
     *
     * @return {void}
     */
    function teardown_active_reads() {
      clear_native_timer();
      if (pending_request && 'function' === typeof pending_request.abort) {
        pending_request.abort();
      }
      pending_request = null;
      if (root) {
        $(root).off(EVENT_NAMESPACE);
      }
      if (native_adapter) {
        native_adapter.teardown();
      }
      native_adapter = null;
    }

    /**
     * Hydrate exact draft dates after the matching native availability response.
     *
     * @param {number} current_generation Active request generation.
     * @param {number} attempt            Zero-based animation-frame attempt.
     * @return {void}
     */
    function hydrate_dates(current_generation, attempt) {
      var hydrated;
      if (current_generation !== generation || !native_adapter || !draft) {
        return;
      }
      hydrated = native_adapter.set_exact_selected_dates(draft.selected_dates);
      if (hydrated) {
        draft.selected_dates = native_adapter.get_selected_dates();
        notify_loading(false);
        notify_change();
        return;
      }
      if (attempt < 3) {
        window.requestAnimationFrame(function () {
          hydrate_dates(current_generation, attempt + 1);
        });
        return;
      }
      if (active_response && active_response.choices && active_response.choices.selection_methods.some(function (choice) {
        return choice && 'individual' === choice.id;
      })) {
        native_adapter.set_selection_mode('individual');
        hydrated = native_adapter.set_exact_selected_dates(draft.selected_dates);
        draft.selection_method = 'individual';
      }
      draft.selected_dates = hydrated ? native_adapter.get_selected_dates() : draft.selected_dates.slice(0);
      notify_loading(false);
      notify_change();
      if (!hydrated) {
        notify_error({
          code: 'wpbc_booking_new_inspector_schedule_hydration_failed'
        });
      }
    }

    /**
     * Mount and load native availability for one current server response.
     *
     * @param {number} current_generation Active request generation.
     * @return {void}
     */
    function mount_native_calendar(current_generation) {
      var calendar = active_response && active_response.calendar ? active_response.calendar : {};
      var adapter_factory = window.wpbc_booking_date_editor && window.wpbc_booking_date_editor.create_native_calendar_adapter;
      var active_calendar_host = get_calendar_host();
      if ('function' !== typeof adapter_factory || !active_calendar_host) {
        notify_loading(false);
        notify_error({
          code: 'wpbc_booking_new_inspector_native_calendar_unavailable'
        });
        return;
      }
      native_adapter = adapter_factory();
      if (!native_adapter.mount(active_calendar_host, {
        resource_id: active_response.resource_id,
        calendar_html: calendar.html || '',
        calendar_parameters: calendar.calendar_parameters || {},
        policy_parameters: calendar.policy_parameters || {},
        context_parameters: calendar.context_parameters || {},
        secure_parameters: calendar.secure_parameters || {}
      })) {
        notify_loading(false);
        notify_error({
          code: 'wpbc_booking_new_inspector_native_calendar_unavailable'
        });
        return;
      }
      if (root) {
        $(root).off('date_selected' + EVENT_NAMESPACE).on('date_selected' + EVENT_NAMESPACE, function (event, selected_resource_id, clicked_dates, selected_dates) {
          if (current_generation !== generation || normalize_resource_id(selected_resource_id) !== normalize_resource_id(active_response.resource_id) || !draft) {
            return;
          }
          draft.selected_dates = normalize_iso_dates(selected_dates);
          draft.seed_source = 'draft';
          draft.exact_timeline_seed = false;
          notify_change();
        });
      }
      clear_native_timer();
      native_load_timer = window.setTimeout(function () {
        if (current_generation === generation && native_adapter) {
          native_adapter.abort_load();
          notify_loading(false);
          notify_error({
            code: 'wpbc_booking_new_inspector_native_calendar_timeout'
          });
        }
      }, NATIVE_LOAD_TIMEOUT_MS);
      if (!native_adapter.load(calendar.request_parameters || {}, function () {
        clear_native_timer();
        if (current_generation !== generation || !draft) {
          return;
        }
        native_adapter.set_selection_mode(draft.selection_method);
        hydrate_dates(current_generation, 0);
      }, function (failed_request) {
        clear_native_timer();
        if (current_generation === generation) {
          notify_loading(false);
          notify_error(failed_request || {
            code: 'wpbc_booking_new_inspector_native_calendar_failed'
          });
        }
      })) {
        clear_native_timer();
        notify_loading(false);
        notify_error({
          code: 'wpbc_booking_new_inspector_native_calendar_unavailable'
        });
      }
    }

    /**
     * Load an authorized creation schedule and then native availability.
     *
     * @param {Object} request_values Data-only schedule request.
     * @return {boolean} True when the schedule request was dispatched.
     */
    function load(request_values) {
      var current_generation;
      generation += 1;
      current_generation = generation;
      teardown_active_reads();
      notify_loading(true);
      pending_request = $.ajax({
        url: configuration.ajax_url || window.ajaxurl || '',
        method: 'POST',
        dataType: 'json',
        data: {
          action: configuration.action || 'wpbc_booking_new_inspector_schedule',
          nonce: configuration.nonce || '',
          request: JSON.stringify(request_values || {})
        }
      }).done(function (response) {
        var response_data;
        if (current_generation !== generation) {
          return;
        }
        pending_request = null;
        response_data = response && true === response.success && response.data ? response.data : null;
        if (!response_data || response_data.request_id !== request_values.request_id) {
          notify_loading(false);
          notify_error(response && response.data ? response.data : {});
          return;
        }
        active_response = response_data;
        initial_draft = clone_schedule(response_data.schedule);
        draft = clone_schedule(initial_draft);
        if ('function' === typeof configuration.on_ready) {
          configuration.on_ready({
            schedule: clone_schedule(draft),
            choices: response_data.choices && 'object' === typeof response_data.choices ? response_data.choices : {}
          });
        }
        notify_change();
        mount_native_calendar(current_generation);
      }).fail(function (failed_request, request_status) {
        if ('abort' === request_status || current_generation !== generation) {
          return;
        }
        pending_request = null;
        notify_loading(false);
        notify_error(failed_request && failed_request.responseJSON ? failed_request.responseJSON.data : {});
      });
      return true;
    }

    /**
     * Restore the immutable server-authorized initial draft.
     *
     * @return {boolean} True when a mounted draft was restored.
     */
    function reset() {
      var restored;
      if (!initial_draft || !native_adapter) {
        return false;
      }
      draft = clone_schedule(initial_draft);
      restored = native_adapter.set_selection_mode(draft.selection_method);
      restored = native_adapter.set_exact_selected_dates(draft.selected_dates) && restored;
      notify_change();
      return restored;
    }

    /**
     * Set one authorized local native selection mode.
     *
     * @param {string} selection_method Policy or individual.
     * @return {boolean} True when accepted and applied.
     */
    function set_selection_method(selection_method) {
      var is_authorized;
      is_authorized = active_response && active_response.choices && active_response.choices.selection_methods.some(function (choice) {
        return choice && selection_method === choice.id;
      });
      if (!is_authorized || !draft || !native_adapter || !native_adapter.set_selection_mode(selection_method)) {
        return false;
      }
      draft.selection_method = selection_method;
      draft.seed_source = 'draft';
      draft.exact_timeline_seed = false;
      notify_change();
      return true;
    }

    /**
     * Set the local time-application mode.
     *
     * @param {string} time_application Full day, boundary, or per date.
     * @return {boolean} True when the server choice list permits the mode.
     */
    function set_time_application(time_application) {
      var is_authorized;
      is_authorized = active_response && active_response.choices && active_response.choices.time_applications.some(function (choice) {
        return choice && time_application === choice.id;
      });
      if (!is_authorized || !draft) {
        return false;
      }
      draft.time_application = time_application;
      if ('full_day' === time_application) {
        draft.start_time = '';
        draft.end_time = '';
      }
      draft.seed_source = 'draft';
      draft.exact_timeline_seed = false;
      notify_change();
      return true;
    }

    /**
     * Set exact local boundary or per-date times.
     *
     * @param {string} start_time Exact HH:MM start.
     * @param {string} end_time   Exact HH:MM end.
     * @return {boolean} True when both times are valid and the draft is timed.
     */
    function set_times(start_time, end_time) {
      start_time = normalize_time(start_time);
      end_time = normalize_time(end_time);
      if (!draft || 'full_day' === draft.time_application || !start_time || !end_time) {
        return false;
      }
      draft.start_time = start_time;
      draft.end_time = end_time;
      draft.seed_source = 'draft';
      draft.exact_timeline_seed = false;
      notify_change();
      return true;
    }

    /**
     * Return an isolated copy of the current local schedule draft.
     *
     * @return {Object|null} Current draft or null before a successful read.
     */
    function get_draft() {
      return draft ? clone_schedule(draft) : null;
    }

    /**
     * Abort reads, invalidate stale callbacks, and release native calendar state.
     *
     * @return {void}
     */
    function destroy() {
      generation += 1;
      teardown_active_reads();
      initial_draft = null;
      draft = null;
      active_response = null;
      notify_loading(false);
    }
    return {
      load: load,
      reset: reset,
      set_selection_method: set_selection_method,
      set_time_application: set_time_application,
      set_times: set_times,
      get_draft: get_draft,
      is_dirty: is_dirty,
      destroy: destroy
    };
  }
  window.wpbc_booking_new_inspector = window.wpbc_booking_new_inspector || {};
  window.wpbc_booking_new_inspector.create_schedule_workflow = create_schedule_workflow;
})(window, document, jQuery);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvYm9va2luZy1uZXctaW5zcGVjdG9yL19vdXQvYm9va2luZy1uZXctaW5zcGVjdG9yLXNjaGVkdWxlLmpzIiwibmFtZXMiOlsid2luZG93IiwiZG9jdW1lbnQiLCIkIiwiRVZFTlRfTkFNRVNQQUNFIiwiTkFUSVZFX0xPQURfVElNRU9VVF9NUyIsIm5vcm1hbGl6ZV9yZXNvdXJjZV9pZCIsInJlc291cmNlX2lkIiwiTnVtYmVyIiwiaXNJbnRlZ2VyIiwibm9ybWFsaXplX2lzb19kYXRlcyIsInNlbGVjdGVkX2RhdGVzIiwidW5pcXVlX2RhdGVzIiwiQXJyYXkiLCJpc0FycmF5IiwiZm9yRWFjaCIsInNlbGVjdGVkX2RhdGUiLCJ0ZXN0IiwiT2JqZWN0Iiwia2V5cyIsInNvcnQiLCJub3JtYWxpemVfdGltZSIsInRpbWVfdmFsdWUiLCJ0cmltIiwiY2xvbmVfc2NoZWR1bGUiLCJzY2hlZHVsZSIsInNlbGVjdGlvbl9tZXRob2QiLCJ0aW1lX2FwcGxpY2F0aW9uIiwiaW5kZXhPZiIsInN0YXJ0X3RpbWUiLCJlbmRfdGltZSIsInNlZWRfc291cmNlIiwiZXhhY3RfdGltZWxpbmVfc2VlZCIsInNjaGVkdWxlc19hcmVfZXF1YWwiLCJsZWZ0X3NjaGVkdWxlIiwicmlnaHRfc2NoZWR1bGUiLCJsZWZ0IiwicmlnaHQiLCJqb2luIiwiY3JlYXRlX3NjaGVkdWxlX3dvcmtmbG93IiwiY29uZmlndXJhdGlvbiIsInJvb3QiLCJjYWxlbmRhcl9ob3N0IiwiZ2VuZXJhdGlvbiIsInBlbmRpbmdfcmVxdWVzdCIsIm5hdGl2ZV9hZGFwdGVyIiwibmF0aXZlX2xvYWRfdGltZXIiLCJpbml0aWFsX2RyYWZ0IiwiZHJhZnQiLCJhY3RpdmVfcmVzcG9uc2UiLCJub2RlVHlwZSIsImdldF9jYWxlbmRhcl9ob3N0IiwicmVmcmVzaGVkX2hvc3QiLCJpc19kaXJ0eSIsIkJvb2xlYW4iLCJub3RpZnlfY2hhbmdlIiwib25fY2hhbmdlIiwibm90aWZ5X2xvYWRpbmciLCJpc19sb2FkaW5nIiwib25fbG9hZGluZyIsIm5vdGlmeV9lcnJvciIsImVycm9yX3ZhbHVlIiwib25fZXJyb3IiLCJjbGVhcl9uYXRpdmVfdGltZXIiLCJjbGVhclRpbWVvdXQiLCJ0ZWFyZG93bl9hY3RpdmVfcmVhZHMiLCJhYm9ydCIsIm9mZiIsInRlYXJkb3duIiwiaHlkcmF0ZV9kYXRlcyIsImN1cnJlbnRfZ2VuZXJhdGlvbiIsImF0dGVtcHQiLCJoeWRyYXRlZCIsInNldF9leGFjdF9zZWxlY3RlZF9kYXRlcyIsImdldF9zZWxlY3RlZF9kYXRlcyIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsImNob2ljZXMiLCJzZWxlY3Rpb25fbWV0aG9kcyIsInNvbWUiLCJjaG9pY2UiLCJpZCIsInNldF9zZWxlY3Rpb25fbW9kZSIsInNsaWNlIiwiY29kZSIsIm1vdW50X25hdGl2ZV9jYWxlbmRhciIsImNhbGVuZGFyIiwiYWRhcHRlcl9mYWN0b3J5Iiwid3BiY19ib29raW5nX2RhdGVfZWRpdG9yIiwiY3JlYXRlX25hdGl2ZV9jYWxlbmRhcl9hZGFwdGVyIiwiYWN0aXZlX2NhbGVuZGFyX2hvc3QiLCJtb3VudCIsImNhbGVuZGFyX2h0bWwiLCJodG1sIiwiY2FsZW5kYXJfcGFyYW1ldGVycyIsInBvbGljeV9wYXJhbWV0ZXJzIiwiY29udGV4dF9wYXJhbWV0ZXJzIiwic2VjdXJlX3BhcmFtZXRlcnMiLCJvbiIsImV2ZW50Iiwic2VsZWN0ZWRfcmVzb3VyY2VfaWQiLCJjbGlja2VkX2RhdGVzIiwic2V0VGltZW91dCIsImFib3J0X2xvYWQiLCJsb2FkIiwicmVxdWVzdF9wYXJhbWV0ZXJzIiwiZmFpbGVkX3JlcXVlc3QiLCJyZXF1ZXN0X3ZhbHVlcyIsImFqYXgiLCJ1cmwiLCJhamF4X3VybCIsImFqYXh1cmwiLCJtZXRob2QiLCJkYXRhVHlwZSIsImRhdGEiLCJhY3Rpb24iLCJub25jZSIsInJlcXVlc3QiLCJKU09OIiwic3RyaW5naWZ5IiwiZG9uZSIsInJlc3BvbnNlIiwicmVzcG9uc2VfZGF0YSIsInN1Y2Nlc3MiLCJyZXF1ZXN0X2lkIiwib25fcmVhZHkiLCJmYWlsIiwicmVxdWVzdF9zdGF0dXMiLCJyZXNwb25zZUpTT04iLCJyZXNldCIsInJlc3RvcmVkIiwic2V0X3NlbGVjdGlvbl9tZXRob2QiLCJpc19hdXRob3JpemVkIiwic2V0X3RpbWVfYXBwbGljYXRpb24iLCJ0aW1lX2FwcGxpY2F0aW9ucyIsInNldF90aW1lcyIsImdldF9kcmFmdCIsImRlc3Ryb3kiLCJ3cGJjX2Jvb2tpbmdfbmV3X2luc3BlY3RvciIsImpRdWVyeSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL2Jvb2tpbmctbmV3LWluc3BlY3Rvci9fc3JjL2Jvb2tpbmctbmV3LWluc3BlY3Rvci1zY2hlZHVsZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENyZWF0aW9uLW9ubHkgc2NoZWR1bGUgd29ya2Zsb3cgZm9yIEFkZCBOZXcgQm9va2luZyBJbnNwZWN0b3IuXG4gKlxuICogVGhpcyBzb3VyY2UgZmlsZSBpcyBjb21waWxlZCBieSB0aGUgbm9ybWFsIFdQQkMgYXNzZXQgcHJvY2Vzcy4gSXQgZGVsaWJlcmF0ZWx5XG4gKiBvd25zIG5vIEluc3BlY3RvciBob3N0LCBidXR0b24sIHRlbXBsYXRlLCByZXZpZXcsIGFwcGx5LCBvciBwZXJzaXN0ZW5jZSBsb2dpYy5cbiAqXG4gKiBAcGFja2FnZSBCb29raW5nIENhbGVuZGFyXG4gKiBAc2luY2UgICAxMi4wLjBcbiAqL1xuXG4oIGZ1bmN0aW9uICggd2luZG93LCBkb2N1bWVudCwgJCApIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdHZhciBFVkVOVF9OQU1FU1BBQ0UgPSAnLndwYmNCb29raW5nTmV3SW5zcGVjdG9yU2NoZWR1bGUnO1xuXHR2YXIgTkFUSVZFX0xPQURfVElNRU9VVF9NUyA9IDMwMDAwO1xuXG5cdC8qKlxuXHQgKiBOb3JtYWxpemUgYSBwb3NpdGl2ZSBSZXNvdXJjZSBpZGVudGlmaWVyLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IHJlc291cmNlX2lkIENhbmRpZGF0ZSBSZXNvdXJjZSBJRC5cblx0ICogQHJldHVybiB7bnVtYmVyfSBQb3NpdGl2ZSBSZXNvdXJjZSBJRCBvciB6ZXJvLlxuXHQgKi9cblx0ZnVuY3Rpb24gbm9ybWFsaXplX3Jlc291cmNlX2lkKCByZXNvdXJjZV9pZCApIHtcblx0XHRyZXNvdXJjZV9pZCA9IE51bWJlciggcmVzb3VyY2VfaWQgKTtcblxuXHRcdHJldHVybiBOdW1iZXIuaXNJbnRlZ2VyKCByZXNvdXJjZV9pZCApICYmIHJlc291cmNlX2lkID4gMCA/IHJlc291cmNlX2lkIDogMDtcblx0fVxuXG5cdC8qKlxuXHQgKiBOb3JtYWxpemUgb3JkZXJlZCB1bmlxdWUgSVNPIGNhbGVuZGFyIGRhdGVzLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IHNlbGVjdGVkX2RhdGVzIENhbmRpZGF0ZSBkYXRlIGxpc3QuXG5cdCAqIEByZXR1cm4ge0FycmF5PHN0cmluZz59IE9yZGVyZWQgdW5pcXVlIHN0cmljdCBJU08gZGF0ZXMuXG5cdCAqL1xuXHRmdW5jdGlvbiBub3JtYWxpemVfaXNvX2RhdGVzKCBzZWxlY3RlZF9kYXRlcyApIHtcblx0XHR2YXIgdW5pcXVlX2RhdGVzID0ge307XG5cblx0XHRpZiAoICEgQXJyYXkuaXNBcnJheSggc2VsZWN0ZWRfZGF0ZXMgKSApIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdFx0c2VsZWN0ZWRfZGF0ZXMuZm9yRWFjaCggZnVuY3Rpb24gKCBzZWxlY3RlZF9kYXRlICkge1xuXHRcdFx0aWYgKCAnc3RyaW5nJyA9PT0gdHlwZW9mIHNlbGVjdGVkX2RhdGUgJiYgL15cXGR7NH0tXFxkezJ9LVxcZHsyfSQvLnRlc3QoIHNlbGVjdGVkX2RhdGUgKSApIHtcblx0XHRcdFx0dW5pcXVlX2RhdGVzWyBzZWxlY3RlZF9kYXRlIF0gPSBzZWxlY3RlZF9kYXRlO1xuXHRcdFx0fVxuXHRcdH0gKTtcblxuXHRcdHJldHVybiBPYmplY3Qua2V5cyggdW5pcXVlX2RhdGVzICkuc29ydCgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIE5vcm1hbGl6ZSBvbmUgZXhhY3QtbWludXRlIHdhbGwgdGltZS5cblx0ICpcblx0ICogQHBhcmFtIHsqfSB0aW1lX3ZhbHVlIENhbmRpZGF0ZSB0aW1lLlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IFN0cmljdCBISDpNTSB2YWx1ZSBvciBlbXB0eSBzdHJpbmcuXG5cdCAqL1xuXHRmdW5jdGlvbiBub3JtYWxpemVfdGltZSggdGltZV92YWx1ZSApIHtcblx0XHR0aW1lX3ZhbHVlID0gJ3N0cmluZycgPT09IHR5cGVvZiB0aW1lX3ZhbHVlID8gdGltZV92YWx1ZS50cmltKCkgOiAnJztcblxuXHRcdHJldHVybiAvXig/OlswMV1cXGR8MlswLTNdKTpbMC01XVxcZCQvLnRlc3QoIHRpbWVfdmFsdWUgKSA/IHRpbWVfdmFsdWUgOiAnJztcblx0fVxuXG5cdC8qKlxuXHQgKiBDbG9uZSB0aGUgYm91bmRlZCBjcmVhdGlvbiBzY2hlZHVsZSBEVE8uXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gc2NoZWR1bGUgQ2FuZGlkYXRlIHNlcnZlciBvciBsb2NhbCBzY2hlZHVsZS5cblx0ICogQHJldHVybiB7T2JqZWN0fSBJbmRlcGVuZGVudCBub3JtYWxpemVkIGRyYWZ0LlxuXHQgKi9cblx0ZnVuY3Rpb24gY2xvbmVfc2NoZWR1bGUoIHNjaGVkdWxlICkge1xuXHRcdHNjaGVkdWxlID0gc2NoZWR1bGUgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBzY2hlZHVsZSAmJiAhIEFycmF5LmlzQXJyYXkoIHNjaGVkdWxlICkgPyBzY2hlZHVsZSA6IHt9O1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHNlbGVjdGlvbl9tZXRob2Q6ICdpbmRpdmlkdWFsJyA9PT0gc2NoZWR1bGUuc2VsZWN0aW9uX21ldGhvZCA/ICdpbmRpdmlkdWFsJyA6ICdwb2xpY3knLFxuXHRcdFx0dGltZV9hcHBsaWNhdGlvbjogLTEgIT09IFsgJ2Z1bGxfZGF5JywgJ2JvdW5kYXJ5JywgJ3Blcl9kYXRlJyBdLmluZGV4T2YoIHNjaGVkdWxlLnRpbWVfYXBwbGljYXRpb24gKSA/IHNjaGVkdWxlLnRpbWVfYXBwbGljYXRpb24gOiAnZnVsbF9kYXknLFxuXHRcdFx0c2VsZWN0ZWRfZGF0ZXM6IG5vcm1hbGl6ZV9pc29fZGF0ZXMoIHNjaGVkdWxlLnNlbGVjdGVkX2RhdGVzICksXG5cdFx0XHRzdGFydF90aW1lOiBub3JtYWxpemVfdGltZSggc2NoZWR1bGUuc3RhcnRfdGltZSApLFxuXHRcdFx0ZW5kX3RpbWU6IG5vcm1hbGl6ZV90aW1lKCBzY2hlZHVsZS5lbmRfdGltZSApLFxuXHRcdFx0c2VlZF9zb3VyY2U6IC0xICE9PSBbICdlbXB0eScsICd0aW1lbGluZScsICdkcmFmdCcgXS5pbmRleE9mKCBzY2hlZHVsZS5zZWVkX3NvdXJjZSApID8gc2NoZWR1bGUuc2VlZF9zb3VyY2UgOiAnZW1wdHknLFxuXHRcdFx0ZXhhY3RfdGltZWxpbmVfc2VlZDogdHJ1ZSA9PT0gc2NoZWR1bGUuZXhhY3RfdGltZWxpbmVfc2VlZFxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogQ29tcGFyZSB0d28gbm9ybWFsaXplZCBjcmVhdGlvbiBzY2hlZHVsZXMgd2l0aG91dCBzaGFyaW5nIHJlZmVyZW5jZXMuXG5cdCAqXG5cdCAqIFRoZSBkcmFmdCBpcyBib3VuZGVkIHRvIHRoZSBmaXhlZCBzY2hlZHVsZSBEVE8sIHNvIGEgc3RhYmxlIHByb3BlcnR5LWJ5LVxuXHQgKiBwcm9wZXJ0eSBjb21wYXJpc29uIGlzIHN1ZmZpY2llbnQgYW5kIGF2b2lkcyB0cmVhdGluZyBuYXRpdmUgY2FsZW5kYXIgRE9NXG5cdCAqIHN0YXRlIGFzIGF1dGhvcml0YXRpdmUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gbGVmdF9zY2hlZHVsZSAgRmlyc3QgY2FuZGlkYXRlIHNjaGVkdWxlLlxuXHQgKiBAcGFyYW0geyp9IHJpZ2h0X3NjaGVkdWxlIFNlY29uZCBjYW5kaWRhdGUgc2NoZWR1bGUuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBib3RoIG5vcm1hbGl6ZWQgc2NoZWR1bGVzIGFyZSBpZGVudGljYWwuXG5cdCAqL1xuXHRmdW5jdGlvbiBzY2hlZHVsZXNfYXJlX2VxdWFsKCBsZWZ0X3NjaGVkdWxlLCByaWdodF9zY2hlZHVsZSApIHtcblx0XHR2YXIgbGVmdCA9IGNsb25lX3NjaGVkdWxlKCBsZWZ0X3NjaGVkdWxlICk7XG5cdFx0dmFyIHJpZ2h0ID0gY2xvbmVfc2NoZWR1bGUoIHJpZ2h0X3NjaGVkdWxlICk7XG5cblx0XHRyZXR1cm4gbGVmdC5zZWxlY3Rpb25fbWV0aG9kID09PSByaWdodC5zZWxlY3Rpb25fbWV0aG9kXG5cdFx0XHQmJiBsZWZ0LnRpbWVfYXBwbGljYXRpb24gPT09IHJpZ2h0LnRpbWVfYXBwbGljYXRpb25cblx0XHRcdCYmIGxlZnQuc2VsZWN0ZWRfZGF0ZXMuam9pbiggJ3wnICkgPT09IHJpZ2h0LnNlbGVjdGVkX2RhdGVzLmpvaW4oICd8JyApXG5cdFx0XHQmJiBsZWZ0LnN0YXJ0X3RpbWUgPT09IHJpZ2h0LnN0YXJ0X3RpbWVcblx0XHRcdCYmIGxlZnQuZW5kX3RpbWUgPT09IHJpZ2h0LmVuZF90aW1lXG5cdFx0XHQmJiBsZWZ0LnNlZWRfc291cmNlID09PSByaWdodC5zZWVkX3NvdXJjZVxuXHRcdFx0JiYgbGVmdC5leGFjdF90aW1lbGluZV9zZWVkID09PSByaWdodC5leGFjdF90aW1lbGluZV9zZWVkO1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBvbmUgZG9ybWFudCBjcmVhdGlvbi1zY2hlZHVsZSB3b3JrZmxvdy5cblx0ICpcblx0ICogVGhlIHdvcmtmbG93IGNhbGxzIG9ubHkgaXRzIGNyZWF0aW9uIHNjaGVkdWxlIHJlYWQgZW5kcG9pbnQgYW5kIHRoZSBzaGFyZWRcblx0ICogbmF0aXZlIGNhbGVuZGFyIGFkYXB0ZXIuIERhdGUgRWRpdG9yIHJlYWQsIHJldmlldywgYW5kIGFwcGx5IGFjdGlvbnMgYXJlIG5vdFxuXHQgKiBkZXBlbmRlbmNpZXMuIFRoZSBjYWxsZXIgb3ducyBwcmVzZW50YXRpb24gYW5kIGNyZWF0aW9uIHN0YXRlIHRyYW5zaXRpb25zLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlndXJhdGlvbiBBdXRob3JpemVkIHJ1bnRpbWUgY29uZmlndXJhdGlvbiBhbmQgY2FsbGJhY2tzLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IENyZWF0aW9uIHNjaGVkdWxlIHdvcmtmbG93IEFQSS5cblx0ICovXG5cdGZ1bmN0aW9uIGNyZWF0ZV9zY2hlZHVsZV93b3JrZmxvdyggY29uZmlndXJhdGlvbiApIHtcblx0XHR2YXIgcm9vdDtcblx0XHR2YXIgY2FsZW5kYXJfaG9zdDtcblx0XHR2YXIgZ2VuZXJhdGlvbiA9IDA7XG5cdFx0dmFyIHBlbmRpbmdfcmVxdWVzdCA9IG51bGw7XG5cdFx0dmFyIG5hdGl2ZV9hZGFwdGVyID0gbnVsbDtcblx0XHR2YXIgbmF0aXZlX2xvYWRfdGltZXIgPSBudWxsO1xuXHRcdHZhciBpbml0aWFsX2RyYWZ0ID0gbnVsbDtcblx0XHR2YXIgZHJhZnQgPSBudWxsO1xuXHRcdHZhciBhY3RpdmVfcmVzcG9uc2UgPSBudWxsO1xuXG5cdFx0Y29uZmlndXJhdGlvbiA9IGNvbmZpZ3VyYXRpb24gJiYgJ29iamVjdCcgPT09IHR5cGVvZiBjb25maWd1cmF0aW9uID8gY29uZmlndXJhdGlvbiA6IHt9O1xuXHRcdHJvb3QgPSBjb25maWd1cmF0aW9uLnJvb3QgJiYgMSA9PT0gY29uZmlndXJhdGlvbi5yb290Lm5vZGVUeXBlID8gY29uZmlndXJhdGlvbi5yb290IDogbnVsbDtcblx0XHRjYWxlbmRhcl9ob3N0ID0gY29uZmlndXJhdGlvbi5jYWxlbmRhcl9ob3N0ICYmIDEgPT09IGNvbmZpZ3VyYXRpb24uY2FsZW5kYXJfaG9zdC5ub2RlVHlwZSA/IGNvbmZpZ3VyYXRpb24uY2FsZW5kYXJfaG9zdCA6IG51bGw7XG5cblx0XHQvKipcblx0XHQgKiBSZXNvbHZlIHRoZSBjdXJyZW50IGRvbWFpbi1vd25lZCBjYWxlbmRhciBob3N0IGFmdGVyIGEgdGVtcGxhdGUgcmVmcmVzaC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge0VsZW1lbnR8bnVsbH0gQ3VycmVudCBjYWxlbmRhciBob3N0IG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2NhbGVuZGFyX2hvc3QoKSB7XG5cdFx0XHR2YXIgcmVmcmVzaGVkX2hvc3QgPSAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29uZmlndXJhdGlvbi5nZXRfY2FsZW5kYXJfaG9zdFxuXHRcdFx0XHQ/IGNvbmZpZ3VyYXRpb24uZ2V0X2NhbGVuZGFyX2hvc3QoKVxuXHRcdFx0XHQ6IG51bGw7XG5cblx0XHRcdGlmICggcmVmcmVzaGVkX2hvc3QgJiYgMSA9PT0gcmVmcmVzaGVkX2hvc3Qubm9kZVR5cGUgKSB7XG5cdFx0XHRcdGNhbGVuZGFyX2hvc3QgPSByZWZyZXNoZWRfaG9zdDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGNhbGVuZGFyX2hvc3Q7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVwb3J0IHdoZXRoZXIgdGhlIGxvY2FsIHNjaGVkdWxlIGRpZmZlcnMgZnJvbSBpdHMgaW1tdXRhYmxlIHNlcnZlciBzZWVkLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSBvbmx5IGFmdGVyIGEgc3VjY2Vzc2Z1bCByZWFkIGFuZCBhIGxvY2FsIGNoYW5nZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpc19kaXJ0eSgpIHtcblx0XHRcdHJldHVybiBCb29sZWFuKCBpbml0aWFsX2RyYWZ0ICYmIGRyYWZ0ICYmICEgc2NoZWR1bGVzX2FyZV9lcXVhbCggaW5pdGlhbF9kcmFmdCwgZHJhZnQgKSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE5vdGlmeSB0aGUgaG9zdCB0aGF0IHRoZSBsb2NhbCBzY2hlZHVsZSBkcmFmdCBjaGFuZ2VkLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBub3RpZnlfY2hhbmdlKCkge1xuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29uZmlndXJhdGlvbi5vbl9jaGFuZ2UgJiYgZHJhZnQgKSB7XG5cdFx0XHRcdGNvbmZpZ3VyYXRpb24ub25fY2hhbmdlKCBjbG9uZV9zY2hlZHVsZSggZHJhZnQgKSwgeyBpc19kaXJ0eTogaXNfZGlydHkoKSB9ICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTm90aWZ5IHRoZSBob3N0IGFib3V0IHRoZSBjdXJyZW50IGxvYWRpbmcgc3RhdGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX2xvYWRpbmcgV2hldGhlciBhIHNjaGVkdWxlIG9yIGF2YWlsYWJpbGl0eSByZWFkIGlzIGFjdGl2ZS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG5vdGlmeV9sb2FkaW5nKCBpc19sb2FkaW5nICkge1xuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29uZmlndXJhdGlvbi5vbl9sb2FkaW5nICkge1xuXHRcdFx0XHRjb25maWd1cmF0aW9uLm9uX2xvYWRpbmcoIEJvb2xlYW4oIGlzX2xvYWRpbmcgKSApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE5vdGlmeSB0aGUgaG9zdCBhYm91dCBvbmUgc2FmZSByZWFkIG9yIG5hdGl2ZS1jYWxlbmRhciBmYWlsdXJlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHsqfSBlcnJvcl92YWx1ZSBFcnJvciBEVE8gb3IgbmF0aXZlIGZhaWx1cmUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBub3RpZnlfZXJyb3IoIGVycm9yX3ZhbHVlICkge1xuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29uZmlndXJhdGlvbi5vbl9lcnJvciApIHtcblx0XHRcdFx0Y29uZmlndXJhdGlvbi5vbl9lcnJvciggZXJyb3JfdmFsdWUgfHwge30gKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDbGVhciB0aGUgYm91bmRlZCBuYXRpdmUgYXZhaWxhYmlsaXR5IHRpbWVvdXQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNsZWFyX25hdGl2ZV90aW1lcigpIHtcblx0XHRcdGlmICggbmF0aXZlX2xvYWRfdGltZXIgKSB7XG5cdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIG5hdGl2ZV9sb2FkX3RpbWVyICk7XG5cdFx0XHRcdG5hdGl2ZV9sb2FkX3RpbWVyID0gbnVsbDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBYm9ydCByZWFkcyBhbmQgcmVtb3ZlIG5hdGl2ZSBzdGF0ZSBvd25lZCBieSB0aGUgY3VycmVudCBnZW5lcmF0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB0ZWFyZG93bl9hY3RpdmVfcmVhZHMoKSB7XG5cdFx0XHRjbGVhcl9uYXRpdmVfdGltZXIoKTtcblx0XHRcdGlmICggcGVuZGluZ19yZXF1ZXN0ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBwZW5kaW5nX3JlcXVlc3QuYWJvcnQgKSB7XG5cdFx0XHRcdHBlbmRpbmdfcmVxdWVzdC5hYm9ydCgpO1xuXHRcdFx0fVxuXHRcdFx0cGVuZGluZ19yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdGlmICggcm9vdCApIHtcblx0XHRcdFx0JCggcm9vdCApLm9mZiggRVZFTlRfTkFNRVNQQUNFICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIG5hdGl2ZV9hZGFwdGVyICkge1xuXHRcdFx0XHRuYXRpdmVfYWRhcHRlci50ZWFyZG93bigpO1xuXHRcdFx0fVxuXHRcdFx0bmF0aXZlX2FkYXB0ZXIgPSBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEh5ZHJhdGUgZXhhY3QgZHJhZnQgZGF0ZXMgYWZ0ZXIgdGhlIG1hdGNoaW5nIG5hdGl2ZSBhdmFpbGFiaWxpdHkgcmVzcG9uc2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gY3VycmVudF9nZW5lcmF0aW9uIEFjdGl2ZSByZXF1ZXN0IGdlbmVyYXRpb24uXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGF0dGVtcHQgICAgICAgICAgICBaZXJvLWJhc2VkIGFuaW1hdGlvbi1mcmFtZSBhdHRlbXB0LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaHlkcmF0ZV9kYXRlcyggY3VycmVudF9nZW5lcmF0aW9uLCBhdHRlbXB0ICkge1xuXHRcdFx0dmFyIGh5ZHJhdGVkO1xuXG5cdFx0XHRpZiAoIGN1cnJlbnRfZ2VuZXJhdGlvbiAhPT0gZ2VuZXJhdGlvbiB8fCAhIG5hdGl2ZV9hZGFwdGVyIHx8ICEgZHJhZnQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGh5ZHJhdGVkID0gbmF0aXZlX2FkYXB0ZXIuc2V0X2V4YWN0X3NlbGVjdGVkX2RhdGVzKCBkcmFmdC5zZWxlY3RlZF9kYXRlcyApO1xuXHRcdFx0aWYgKCBoeWRyYXRlZCApIHtcblx0XHRcdFx0ZHJhZnQuc2VsZWN0ZWRfZGF0ZXMgPSBuYXRpdmVfYWRhcHRlci5nZXRfc2VsZWN0ZWRfZGF0ZXMoKTtcblx0XHRcdFx0bm90aWZ5X2xvYWRpbmcoIGZhbHNlICk7XG5cdFx0XHRcdG5vdGlmeV9jaGFuZ2UoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBhdHRlbXB0IDwgMyApIHtcblx0XHRcdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdGh5ZHJhdGVfZGF0ZXMoIGN1cnJlbnRfZ2VuZXJhdGlvbiwgYXR0ZW1wdCArIDEgKTtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICggYWN0aXZlX3Jlc3BvbnNlICYmIGFjdGl2ZV9yZXNwb25zZS5jaG9pY2VzICYmIGFjdGl2ZV9yZXNwb25zZS5jaG9pY2VzLnNlbGVjdGlvbl9tZXRob2RzLnNvbWUoIGZ1bmN0aW9uICggY2hvaWNlICkge1xuXHRcdFx0XHRyZXR1cm4gY2hvaWNlICYmICdpbmRpdmlkdWFsJyA9PT0gY2hvaWNlLmlkO1xuXHRcdFx0fSApICkge1xuXHRcdFx0XHRuYXRpdmVfYWRhcHRlci5zZXRfc2VsZWN0aW9uX21vZGUoICdpbmRpdmlkdWFsJyApO1xuXHRcdFx0XHRoeWRyYXRlZCA9IG5hdGl2ZV9hZGFwdGVyLnNldF9leGFjdF9zZWxlY3RlZF9kYXRlcyggZHJhZnQuc2VsZWN0ZWRfZGF0ZXMgKTtcblx0XHRcdFx0ZHJhZnQuc2VsZWN0aW9uX21ldGhvZCA9ICdpbmRpdmlkdWFsJztcblx0XHRcdH1cblx0XHRcdGRyYWZ0LnNlbGVjdGVkX2RhdGVzID0gaHlkcmF0ZWQgPyBuYXRpdmVfYWRhcHRlci5nZXRfc2VsZWN0ZWRfZGF0ZXMoKSA6IGRyYWZ0LnNlbGVjdGVkX2RhdGVzLnNsaWNlKCAwICk7XG5cdFx0XHRub3RpZnlfbG9hZGluZyggZmFsc2UgKTtcblx0XHRcdG5vdGlmeV9jaGFuZ2UoKTtcblx0XHRcdGlmICggISBoeWRyYXRlZCApIHtcblx0XHRcdFx0bm90aWZ5X2Vycm9yKCB7IGNvZGU6ICd3cGJjX2Jvb2tpbmdfbmV3X2luc3BlY3Rvcl9zY2hlZHVsZV9oeWRyYXRpb25fZmFpbGVkJyB9ICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTW91bnQgYW5kIGxvYWQgbmF0aXZlIGF2YWlsYWJpbGl0eSBmb3Igb25lIGN1cnJlbnQgc2VydmVyIHJlc3BvbnNlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGN1cnJlbnRfZ2VuZXJhdGlvbiBBY3RpdmUgcmVxdWVzdCBnZW5lcmF0aW9uLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbW91bnRfbmF0aXZlX2NhbGVuZGFyKCBjdXJyZW50X2dlbmVyYXRpb24gKSB7XG5cdFx0XHR2YXIgY2FsZW5kYXIgPSBhY3RpdmVfcmVzcG9uc2UgJiYgYWN0aXZlX3Jlc3BvbnNlLmNhbGVuZGFyID8gYWN0aXZlX3Jlc3BvbnNlLmNhbGVuZGFyIDoge307XG5cdFx0XHR2YXIgYWRhcHRlcl9mYWN0b3J5ID0gd2luZG93LndwYmNfYm9va2luZ19kYXRlX2VkaXRvciAmJiB3aW5kb3cud3BiY19ib29raW5nX2RhdGVfZWRpdG9yLmNyZWF0ZV9uYXRpdmVfY2FsZW5kYXJfYWRhcHRlcjtcblx0XHRcdHZhciBhY3RpdmVfY2FsZW5kYXJfaG9zdCA9IGdldF9jYWxlbmRhcl9ob3N0KCk7XG5cblx0XHRcdGlmICggJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIGFkYXB0ZXJfZmFjdG9yeSB8fCAhIGFjdGl2ZV9jYWxlbmRhcl9ob3N0ICkge1xuXHRcdFx0XHRub3RpZnlfbG9hZGluZyggZmFsc2UgKTtcblx0XHRcdFx0bm90aWZ5X2Vycm9yKCB7IGNvZGU6ICd3cGJjX2Jvb2tpbmdfbmV3X2luc3BlY3Rvcl9uYXRpdmVfY2FsZW5kYXJfdW5hdmFpbGFibGUnIH0gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bmF0aXZlX2FkYXB0ZXIgPSBhZGFwdGVyX2ZhY3RvcnkoKTtcblx0XHRcdGlmICggISBuYXRpdmVfYWRhcHRlci5tb3VudCggYWN0aXZlX2NhbGVuZGFyX2hvc3QsIHtcblx0XHRcdFx0cmVzb3VyY2VfaWQ6IGFjdGl2ZV9yZXNwb25zZS5yZXNvdXJjZV9pZCxcblx0XHRcdFx0Y2FsZW5kYXJfaHRtbDogY2FsZW5kYXIuaHRtbCB8fCAnJyxcblx0XHRcdFx0Y2FsZW5kYXJfcGFyYW1ldGVyczogY2FsZW5kYXIuY2FsZW5kYXJfcGFyYW1ldGVycyB8fCB7fSxcblx0XHRcdFx0cG9saWN5X3BhcmFtZXRlcnM6IGNhbGVuZGFyLnBvbGljeV9wYXJhbWV0ZXJzIHx8IHt9LFxuXHRcdFx0XHRjb250ZXh0X3BhcmFtZXRlcnM6IGNhbGVuZGFyLmNvbnRleHRfcGFyYW1ldGVycyB8fCB7fSxcblx0XHRcdFx0c2VjdXJlX3BhcmFtZXRlcnM6IGNhbGVuZGFyLnNlY3VyZV9wYXJhbWV0ZXJzIHx8IHt9XG5cdFx0XHR9ICkgKSB7XG5cdFx0XHRcdG5vdGlmeV9sb2FkaW5nKCBmYWxzZSApO1xuXHRcdFx0XHRub3RpZnlfZXJyb3IoIHsgY29kZTogJ3dwYmNfYm9va2luZ19uZXdfaW5zcGVjdG9yX25hdGl2ZV9jYWxlbmRhcl91bmF2YWlsYWJsZScgfSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICggcm9vdCApIHtcblx0XHRcdFx0JCggcm9vdCApLm9mZiggJ2RhdGVfc2VsZWN0ZWQnICsgRVZFTlRfTkFNRVNQQUNFICkub24oICdkYXRlX3NlbGVjdGVkJyArIEVWRU5UX05BTUVTUEFDRSwgZnVuY3Rpb24gKCBldmVudCwgc2VsZWN0ZWRfcmVzb3VyY2VfaWQsIGNsaWNrZWRfZGF0ZXMsIHNlbGVjdGVkX2RhdGVzICkge1xuXHRcdFx0XHRcdGlmICggY3VycmVudF9nZW5lcmF0aW9uICE9PSBnZW5lcmF0aW9uIHx8IG5vcm1hbGl6ZV9yZXNvdXJjZV9pZCggc2VsZWN0ZWRfcmVzb3VyY2VfaWQgKSAhPT0gbm9ybWFsaXplX3Jlc291cmNlX2lkKCBhY3RpdmVfcmVzcG9uc2UucmVzb3VyY2VfaWQgKSB8fCAhIGRyYWZ0ICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRkcmFmdC5zZWxlY3RlZF9kYXRlcyA9IG5vcm1hbGl6ZV9pc29fZGF0ZXMoIHNlbGVjdGVkX2RhdGVzICk7XG5cdFx0XHRcdFx0ZHJhZnQuc2VlZF9zb3VyY2UgPSAnZHJhZnQnO1xuXHRcdFx0XHRcdGRyYWZ0LmV4YWN0X3RpbWVsaW5lX3NlZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRub3RpZnlfY2hhbmdlKCk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblxuXHRcdFx0Y2xlYXJfbmF0aXZlX3RpbWVyKCk7XG5cdFx0XHRuYXRpdmVfbG9hZF90aW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmICggY3VycmVudF9nZW5lcmF0aW9uID09PSBnZW5lcmF0aW9uICYmIG5hdGl2ZV9hZGFwdGVyICkge1xuXHRcdFx0XHRcdG5hdGl2ZV9hZGFwdGVyLmFib3J0X2xvYWQoKTtcblx0XHRcdFx0XHRub3RpZnlfbG9hZGluZyggZmFsc2UgKTtcblx0XHRcdFx0XHRub3RpZnlfZXJyb3IoIHsgY29kZTogJ3dwYmNfYm9va2luZ19uZXdfaW5zcGVjdG9yX25hdGl2ZV9jYWxlbmRhcl90aW1lb3V0JyB9ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIE5BVElWRV9MT0FEX1RJTUVPVVRfTVMgKTtcblx0XHRcdGlmICggISBuYXRpdmVfYWRhcHRlci5sb2FkKCBjYWxlbmRhci5yZXF1ZXN0X3BhcmFtZXRlcnMgfHwge30sIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0Y2xlYXJfbmF0aXZlX3RpbWVyKCk7XG5cdFx0XHRcdGlmICggY3VycmVudF9nZW5lcmF0aW9uICE9PSBnZW5lcmF0aW9uIHx8ICEgZHJhZnQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG5hdGl2ZV9hZGFwdGVyLnNldF9zZWxlY3Rpb25fbW9kZSggZHJhZnQuc2VsZWN0aW9uX21ldGhvZCApO1xuXHRcdFx0XHRoeWRyYXRlX2RhdGVzKCBjdXJyZW50X2dlbmVyYXRpb24sIDAgKTtcblx0XHRcdH0sIGZ1bmN0aW9uICggZmFpbGVkX3JlcXVlc3QgKSB7XG5cdFx0XHRcdGNsZWFyX25hdGl2ZV90aW1lcigpO1xuXHRcdFx0XHRpZiAoIGN1cnJlbnRfZ2VuZXJhdGlvbiA9PT0gZ2VuZXJhdGlvbiApIHtcblx0XHRcdFx0XHRub3RpZnlfbG9hZGluZyggZmFsc2UgKTtcblx0XHRcdFx0XHRub3RpZnlfZXJyb3IoIGZhaWxlZF9yZXF1ZXN0IHx8IHsgY29kZTogJ3dwYmNfYm9va2luZ19uZXdfaW5zcGVjdG9yX25hdGl2ZV9jYWxlbmRhcl9mYWlsZWQnIH0gKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApICkge1xuXHRcdFx0XHRjbGVhcl9uYXRpdmVfdGltZXIoKTtcblx0XHRcdFx0bm90aWZ5X2xvYWRpbmcoIGZhbHNlICk7XG5cdFx0XHRcdG5vdGlmeV9lcnJvciggeyBjb2RlOiAnd3BiY19ib29raW5nX25ld19pbnNwZWN0b3JfbmF0aXZlX2NhbGVuZGFyX3VuYXZhaWxhYmxlJyB9ICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTG9hZCBhbiBhdXRob3JpemVkIGNyZWF0aW9uIHNjaGVkdWxlIGFuZCB0aGVuIG5hdGl2ZSBhdmFpbGFiaWxpdHkuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmVxdWVzdF92YWx1ZXMgRGF0YS1vbmx5IHNjaGVkdWxlIHJlcXVlc3QuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBzY2hlZHVsZSByZXF1ZXN0IHdhcyBkaXNwYXRjaGVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGxvYWQoIHJlcXVlc3RfdmFsdWVzICkge1xuXHRcdFx0dmFyIGN1cnJlbnRfZ2VuZXJhdGlvbjtcblxuXHRcdFx0Z2VuZXJhdGlvbiArPSAxO1xuXHRcdFx0Y3VycmVudF9nZW5lcmF0aW9uID0gZ2VuZXJhdGlvbjtcblx0XHRcdHRlYXJkb3duX2FjdGl2ZV9yZWFkcygpO1xuXHRcdFx0bm90aWZ5X2xvYWRpbmcoIHRydWUgKTtcblx0XHRcdHBlbmRpbmdfcmVxdWVzdCA9ICQuYWpheCgge1xuXHRcdFx0XHR1cmw6IGNvbmZpZ3VyYXRpb24uYWpheF91cmwgfHwgd2luZG93LmFqYXh1cmwgfHwgJycsXG5cdFx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0XHRkYXRhVHlwZTogJ2pzb24nLFxuXHRcdFx0XHRkYXRhOiB7XG5cdFx0XHRcdFx0YWN0aW9uOiBjb25maWd1cmF0aW9uLmFjdGlvbiB8fCAnd3BiY19ib29raW5nX25ld19pbnNwZWN0b3Jfc2NoZWR1bGUnLFxuXHRcdFx0XHRcdG5vbmNlOiBjb25maWd1cmF0aW9uLm5vbmNlIHx8ICcnLFxuXHRcdFx0XHRcdHJlcXVlc3Q6IEpTT04uc3RyaW5naWZ5KCByZXF1ZXN0X3ZhbHVlcyB8fCB7fSApXG5cdFx0XHRcdH1cblx0XHRcdH0gKS5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0XHR2YXIgcmVzcG9uc2VfZGF0YTtcblxuXHRcdFx0XHRpZiAoIGN1cnJlbnRfZ2VuZXJhdGlvbiAhPT0gZ2VuZXJhdGlvbiApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cGVuZGluZ19yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdFx0cmVzcG9uc2VfZGF0YSA9IHJlc3BvbnNlICYmIHRydWUgPT09IHJlc3BvbnNlLnN1Y2Nlc3MgJiYgcmVzcG9uc2UuZGF0YSA/IHJlc3BvbnNlLmRhdGEgOiBudWxsO1xuXHRcdFx0XHRpZiAoICEgcmVzcG9uc2VfZGF0YSB8fCByZXNwb25zZV9kYXRhLnJlcXVlc3RfaWQgIT09IHJlcXVlc3RfdmFsdWVzLnJlcXVlc3RfaWQgKSB7XG5cdFx0XHRcdFx0bm90aWZ5X2xvYWRpbmcoIGZhbHNlICk7XG5cdFx0XHRcdFx0bm90aWZ5X2Vycm9yKCByZXNwb25zZSAmJiByZXNwb25zZS5kYXRhID8gcmVzcG9uc2UuZGF0YSA6IHt9ICk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGFjdGl2ZV9yZXNwb25zZSA9IHJlc3BvbnNlX2RhdGE7XG5cdFx0XHRcdGluaXRpYWxfZHJhZnQgPSBjbG9uZV9zY2hlZHVsZSggcmVzcG9uc2VfZGF0YS5zY2hlZHVsZSApO1xuXHRcdFx0XHRkcmFmdCA9IGNsb25lX3NjaGVkdWxlKCBpbml0aWFsX2RyYWZ0ICk7XG5cdFx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNvbmZpZ3VyYXRpb24ub25fcmVhZHkgKSB7XG5cdFx0XHRcdFx0Y29uZmlndXJhdGlvbi5vbl9yZWFkeSgge1xuXHRcdFx0XHRcdFx0c2NoZWR1bGU6IGNsb25lX3NjaGVkdWxlKCBkcmFmdCApLFxuXHRcdFx0XHRcdFx0Y2hvaWNlczogcmVzcG9uc2VfZGF0YS5jaG9pY2VzICYmICdvYmplY3QnID09PSB0eXBlb2YgcmVzcG9uc2VfZGF0YS5jaG9pY2VzID8gcmVzcG9uc2VfZGF0YS5jaG9pY2VzIDoge31cblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0bm90aWZ5X2NoYW5nZSgpO1xuXHRcdFx0XHRtb3VudF9uYXRpdmVfY2FsZW5kYXIoIGN1cnJlbnRfZ2VuZXJhdGlvbiApO1xuXHRcdFx0fSApLmZhaWwoIGZ1bmN0aW9uICggZmFpbGVkX3JlcXVlc3QsIHJlcXVlc3Rfc3RhdHVzICkge1xuXHRcdFx0XHRpZiAoICdhYm9ydCcgPT09IHJlcXVlc3Rfc3RhdHVzIHx8IGN1cnJlbnRfZ2VuZXJhdGlvbiAhPT0gZ2VuZXJhdGlvbiApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cGVuZGluZ19yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdFx0bm90aWZ5X2xvYWRpbmcoIGZhbHNlICk7XG5cdFx0XHRcdG5vdGlmeV9lcnJvciggZmFpbGVkX3JlcXVlc3QgJiYgZmFpbGVkX3JlcXVlc3QucmVzcG9uc2VKU09OID8gZmFpbGVkX3JlcXVlc3QucmVzcG9uc2VKU09OLmRhdGEgOiB7fSApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXN0b3JlIHRoZSBpbW11dGFibGUgc2VydmVyLWF1dGhvcml6ZWQgaW5pdGlhbCBkcmFmdC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBhIG1vdW50ZWQgZHJhZnQgd2FzIHJlc3RvcmVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlc2V0KCkge1xuXHRcdFx0dmFyIHJlc3RvcmVkO1xuXG5cdFx0XHRpZiAoICEgaW5pdGlhbF9kcmFmdCB8fCAhIG5hdGl2ZV9hZGFwdGVyICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRkcmFmdCA9IGNsb25lX3NjaGVkdWxlKCBpbml0aWFsX2RyYWZ0ICk7XG5cdFx0XHRyZXN0b3JlZCA9IG5hdGl2ZV9hZGFwdGVyLnNldF9zZWxlY3Rpb25fbW9kZSggZHJhZnQuc2VsZWN0aW9uX21ldGhvZCApO1xuXHRcdFx0cmVzdG9yZWQgPSBuYXRpdmVfYWRhcHRlci5zZXRfZXhhY3Rfc2VsZWN0ZWRfZGF0ZXMoIGRyYWZ0LnNlbGVjdGVkX2RhdGVzICkgJiYgcmVzdG9yZWQ7XG5cdFx0XHRub3RpZnlfY2hhbmdlKCk7XG5cblx0XHRcdHJldHVybiByZXN0b3JlZDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTZXQgb25lIGF1dGhvcml6ZWQgbG9jYWwgbmF0aXZlIHNlbGVjdGlvbiBtb2RlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHNlbGVjdGlvbl9tZXRob2QgUG9saWN5IG9yIGluZGl2aWR1YWwuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGFjY2VwdGVkIGFuZCBhcHBsaWVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNldF9zZWxlY3Rpb25fbWV0aG9kKCBzZWxlY3Rpb25fbWV0aG9kICkge1xuXHRcdFx0dmFyIGlzX2F1dGhvcml6ZWQ7XG5cblx0XHRcdGlzX2F1dGhvcml6ZWQgPSBhY3RpdmVfcmVzcG9uc2UgJiYgYWN0aXZlX3Jlc3BvbnNlLmNob2ljZXMgJiYgYWN0aXZlX3Jlc3BvbnNlLmNob2ljZXMuc2VsZWN0aW9uX21ldGhvZHMuc29tZSggZnVuY3Rpb24gKCBjaG9pY2UgKSB7XG5cdFx0XHRcdHJldHVybiBjaG9pY2UgJiYgc2VsZWN0aW9uX21ldGhvZCA9PT0gY2hvaWNlLmlkO1xuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCAhIGlzX2F1dGhvcml6ZWQgfHwgISBkcmFmdCB8fCAhIG5hdGl2ZV9hZGFwdGVyIHx8ICEgbmF0aXZlX2FkYXB0ZXIuc2V0X3NlbGVjdGlvbl9tb2RlKCBzZWxlY3Rpb25fbWV0aG9kICkgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGRyYWZ0LnNlbGVjdGlvbl9tZXRob2QgPSBzZWxlY3Rpb25fbWV0aG9kO1xuXHRcdFx0ZHJhZnQuc2VlZF9zb3VyY2UgPSAnZHJhZnQnO1xuXHRcdFx0ZHJhZnQuZXhhY3RfdGltZWxpbmVfc2VlZCA9IGZhbHNlO1xuXHRcdFx0bm90aWZ5X2NoYW5nZSgpO1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTZXQgdGhlIGxvY2FsIHRpbWUtYXBwbGljYXRpb24gbW9kZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0aW1lX2FwcGxpY2F0aW9uIEZ1bGwgZGF5LCBib3VuZGFyeSwgb3IgcGVyIGRhdGUuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBzZXJ2ZXIgY2hvaWNlIGxpc3QgcGVybWl0cyB0aGUgbW9kZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfdGltZV9hcHBsaWNhdGlvbiggdGltZV9hcHBsaWNhdGlvbiApIHtcblx0XHRcdHZhciBpc19hdXRob3JpemVkO1xuXG5cdFx0XHRpc19hdXRob3JpemVkID0gYWN0aXZlX3Jlc3BvbnNlICYmIGFjdGl2ZV9yZXNwb25zZS5jaG9pY2VzICYmIGFjdGl2ZV9yZXNwb25zZS5jaG9pY2VzLnRpbWVfYXBwbGljYXRpb25zLnNvbWUoIGZ1bmN0aW9uICggY2hvaWNlICkge1xuXHRcdFx0XHRyZXR1cm4gY2hvaWNlICYmIHRpbWVfYXBwbGljYXRpb24gPT09IGNob2ljZS5pZDtcblx0XHRcdH0gKTtcblx0XHRcdGlmICggISBpc19hdXRob3JpemVkIHx8ICEgZHJhZnQgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGRyYWZ0LnRpbWVfYXBwbGljYXRpb24gPSB0aW1lX2FwcGxpY2F0aW9uO1xuXHRcdFx0aWYgKCAnZnVsbF9kYXknID09PSB0aW1lX2FwcGxpY2F0aW9uICkge1xuXHRcdFx0XHRkcmFmdC5zdGFydF90aW1lID0gJyc7XG5cdFx0XHRcdGRyYWZ0LmVuZF90aW1lID0gJyc7XG5cdFx0XHR9XG5cdFx0XHRkcmFmdC5zZWVkX3NvdXJjZSA9ICdkcmFmdCc7XG5cdFx0XHRkcmFmdC5leGFjdF90aW1lbGluZV9zZWVkID0gZmFsc2U7XG5cdFx0XHRub3RpZnlfY2hhbmdlKCk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNldCBleGFjdCBsb2NhbCBib3VuZGFyeSBvciBwZXItZGF0ZSB0aW1lcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBzdGFydF90aW1lIEV4YWN0IEhIOk1NIHN0YXJ0LlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBlbmRfdGltZSAgIEV4YWN0IEhIOk1NIGVuZC5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gYm90aCB0aW1lcyBhcmUgdmFsaWQgYW5kIHRoZSBkcmFmdCBpcyB0aW1lZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfdGltZXMoIHN0YXJ0X3RpbWUsIGVuZF90aW1lICkge1xuXHRcdFx0c3RhcnRfdGltZSA9IG5vcm1hbGl6ZV90aW1lKCBzdGFydF90aW1lICk7XG5cdFx0XHRlbmRfdGltZSA9IG5vcm1hbGl6ZV90aW1lKCBlbmRfdGltZSApO1xuXHRcdFx0aWYgKCAhIGRyYWZ0IHx8ICdmdWxsX2RheScgPT09IGRyYWZ0LnRpbWVfYXBwbGljYXRpb24gfHwgISBzdGFydF90aW1lIHx8ICEgZW5kX3RpbWUgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGRyYWZ0LnN0YXJ0X3RpbWUgPSBzdGFydF90aW1lO1xuXHRcdFx0ZHJhZnQuZW5kX3RpbWUgPSBlbmRfdGltZTtcblx0XHRcdGRyYWZ0LnNlZWRfc291cmNlID0gJ2RyYWZ0Jztcblx0XHRcdGRyYWZ0LmV4YWN0X3RpbWVsaW5lX3NlZWQgPSBmYWxzZTtcblx0XHRcdG5vdGlmeV9jaGFuZ2UoKTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIGFuIGlzb2xhdGVkIGNvcHkgb2YgdGhlIGN1cnJlbnQgbG9jYWwgc2NoZWR1bGUgZHJhZnQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gQ3VycmVudCBkcmFmdCBvciBudWxsIGJlZm9yZSBhIHN1Y2Nlc3NmdWwgcmVhZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfZHJhZnQoKSB7XG5cdFx0XHRyZXR1cm4gZHJhZnQgPyBjbG9uZV9zY2hlZHVsZSggZHJhZnQgKSA6IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQWJvcnQgcmVhZHMsIGludmFsaWRhdGUgc3RhbGUgY2FsbGJhY2tzLCBhbmQgcmVsZWFzZSBuYXRpdmUgY2FsZW5kYXIgc3RhdGUuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG5cdFx0XHRnZW5lcmF0aW9uICs9IDE7XG5cdFx0XHR0ZWFyZG93bl9hY3RpdmVfcmVhZHMoKTtcblx0XHRcdGluaXRpYWxfZHJhZnQgPSBudWxsO1xuXHRcdFx0ZHJhZnQgPSBudWxsO1xuXHRcdFx0YWN0aXZlX3Jlc3BvbnNlID0gbnVsbDtcblx0XHRcdG5vdGlmeV9sb2FkaW5nKCBmYWxzZSApO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRsb2FkOiBsb2FkLFxuXHRcdFx0cmVzZXQ6IHJlc2V0LFxuXHRcdFx0c2V0X3NlbGVjdGlvbl9tZXRob2Q6IHNldF9zZWxlY3Rpb25fbWV0aG9kLFxuXHRcdFx0c2V0X3RpbWVfYXBwbGljYXRpb246IHNldF90aW1lX2FwcGxpY2F0aW9uLFxuXHRcdFx0c2V0X3RpbWVzOiBzZXRfdGltZXMsXG5cdFx0XHRnZXRfZHJhZnQ6IGdldF9kcmFmdCxcblx0XHRcdGlzX2RpcnR5OiBpc19kaXJ0eSxcblx0XHRcdGRlc3Ryb3k6IGRlc3Ryb3lcblx0XHR9O1xuXHR9XG5cblx0d2luZG93LndwYmNfYm9va2luZ19uZXdfaW5zcGVjdG9yID0gd2luZG93LndwYmNfYm9va2luZ19uZXdfaW5zcGVjdG9yIHx8IHt9O1xuXHR3aW5kb3cud3BiY19ib29raW5nX25ld19pbnNwZWN0b3IuY3JlYXRlX3NjaGVkdWxlX3dvcmtmbG93ID0gY3JlYXRlX3NjaGVkdWxlX3dvcmtmbG93O1xufSggd2luZG93LCBkb2N1bWVudCwgalF1ZXJ5ICkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUUsV0FBV0EsTUFBTSxFQUFFQyxRQUFRLEVBQUVDLENBQUMsRUFBRztFQUNsQyxZQUFZOztFQUVaLElBQUlDLGVBQWUsR0FBRyxrQ0FBa0M7RUFDeEQsSUFBSUMsc0JBQXNCLEdBQUcsS0FBSzs7RUFFbEM7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0MscUJBQXFCQSxDQUFFQyxXQUFXLEVBQUc7SUFDN0NBLFdBQVcsR0FBR0MsTUFBTSxDQUFFRCxXQUFZLENBQUM7SUFFbkMsT0FBT0MsTUFBTSxDQUFDQyxTQUFTLENBQUVGLFdBQVksQ0FBQyxJQUFJQSxXQUFXLEdBQUcsQ0FBQyxHQUFHQSxXQUFXLEdBQUcsQ0FBQztFQUM1RTs7RUFFQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTRyxtQkFBbUJBLENBQUVDLGNBQWMsRUFBRztJQUM5QyxJQUFJQyxZQUFZLEdBQUcsQ0FBQyxDQUFDO0lBRXJCLElBQUssQ0FBRUMsS0FBSyxDQUFDQyxPQUFPLENBQUVILGNBQWUsQ0FBQyxFQUFHO01BQ3hDLE9BQU8sRUFBRTtJQUNWO0lBQ0FBLGNBQWMsQ0FBQ0ksT0FBTyxDQUFFLFVBQVdDLGFBQWEsRUFBRztNQUNsRCxJQUFLLFFBQVEsS0FBSyxPQUFPQSxh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
