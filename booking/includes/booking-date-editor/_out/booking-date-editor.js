"use strict";

/**
 * Booking Date Editor native-calendar adapter.
 *
 * The controller opens only from an authorized Booking Inspector DTO. It asks
 * the Date Editor read endpoint for canonical calendar markup and bounded
 * initialization values, then delegates bookings and availability loading to
 * the standard native calendar request.
 *
 * Native WPBC APIs used here:
 *
 * - `window._wpbc` stores the standard calendar and page parameters.
 * - `window.wpbc_calendar_show()` initializes the existing datepicker.
 * - `window.wpbc_calendar__load_data__ajx()` requests canonical bookings and
 *   unavailable dates through `WPBC_AJX_CALENDAR_LOAD`.
 * - `window.wpbc_calendar__get_inst()` returns the mounted datepick instance.
 * - `window.wpbc_get__selected_dates_sql__as_arr()` returns every canonical
 *   selected date, including the middle dates represented only in the hidden
 *   field by native dynamic-range mode.
 * - `window.wpbc_cal_days_select__multiple()` enables native individual-date
 *   selection.
 * - `window.wpbc_cal_days_select__re_init()` and
 *   `window.wpbc_cal__re_init()` apply restored native policy parameters.
 * - `window.wpbc_calendar__scroll_to()` displays the first selected month.
 * - `window._wpbc.balancer__remove_from__wait_list()` removes a queued native
 *   load that has not created a cancellable request yet.
 * - `jQuery.datepick._formatDate()` and `_updateDatepick()` synchronize the
 *   existing instance without simulating clicks or changing availability.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

(function (window, document, $) {
  'use strict';

  var EVENT_NAMESPACE = '.wpbcBookingDateEditor';
  var AJAX_CAPTURE_NAMESPACE = '.wpbcBookingDateEditorAjax';
  var MODE_INDIVIDUAL = 'individual';
  var MODE_POLICY = 'policy';
  var TIME_APPLICATION_FULL_DAY = 'full_day';
  var TIME_APPLICATION_BOUNDARY = 'boundary';
  var TIME_APPLICATION_PER_DATE = 'per_date';
  var NATIVE_LOAD_TIMEOUT_MS = 20000;
  var active_adapter = null;
  var calendar_parameter_names = ['is_enabled_change_over', 'calendar_scroll_to', 'calendar_dates_start', 'calendar_dates_end', 'booking_max_monthes_in_calendar', 'booking_start_day_weeek', 'calendar_number_of_months', 'days_select_mode', 'fixed__days_num', 'fixed__week_days__start', 'dynamic__days_min', 'dynamic__days_max', 'dynamic__days_specific', 'dynamic__week_days__start', 'range_selection_guidance_is_enabled', 'booking_date_format', 'booking_time_format', 'is_parent_resource', 'booking_capacity_field', 'booking_is_dissbale_booking_for_different_sub_resources', 'booking_recurrent_time', 'saved_variable___days_select_initial', 'conditions'];
  var other_parameter_names = ['this_page_booking_hash', 'this_page_allow_past', 'this_page_allow_past_arr'];
  var secure_parameter_names = ['nonce', 'user_id', 'locale'];
  var request_parameter_names = ['resource_id', 'booking_hash', 'request_uri', 'custom_form', 'allow_past', 'aggregate_resource_id_str', 'aggregate_type', 'skip_general_availability', 'classic_booking_context_token'];

  /**
   * Normalize one Resource identifier.
   *
   * @param {*} resource_id Candidate Resource identifier.
   *
   * @return {number} Positive Resource identifier, or zero when invalid.
   */
  function normalize_resource_id(resource_id) {
    resource_id = parseInt(resource_id, 10);
    return resource_id > 0 ? resource_id : 0;
  }

  /**
   * Normalize one Booking identifier.
   *
   * @param {*} booking_id Candidate Booking identifier.
   *
   * @return {number} Positive Booking identifier, or zero when invalid.
   */
  function normalize_booking_id(booking_id) {
    booking_id = parseInt(booking_id, 10);
    return booking_id > 0 ? booking_id : 0;
  }

  /**
   * Parse one strict ISO calendar date without a timezone conversion.
   *
   * @param {*} iso_date Candidate `YYYY-MM-DD` value.
   *
   * @return {Date|null} Local midnight date, or null when invalid.
   */
  function parse_iso_date(iso_date) {
    var date_match = String(iso_date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    var parsed_date;
    if (!date_match) {
      return null;
    }
    parsed_date = new Date(parseInt(date_match[1], 10), parseInt(date_match[2], 10) - 1, parseInt(date_match[3], 10), 0, 0, 0, 0);
    if (parsed_date.getFullYear() !== parseInt(date_match[1], 10) || parsed_date.getMonth() !== parseInt(date_match[2], 10) - 1 || parsed_date.getDate() !== parseInt(date_match[3], 10)) {
      return null;
    }
    return parsed_date;
  }

  /**
   * Format one local calendar date as a stable ISO value.
   *
   * @param {Date} selected_date Native datepicker date.
   *
   * @return {string} `YYYY-MM-DD`, or an empty string when invalid.
   */
  function format_iso_date(selected_date) {
    var year;
    var month;
    var day;
    if (!selected_date || isNaN(selected_date.getTime())) {
      return '';
    }
    year = String(selected_date.getFullYear());
    month = String(selected_date.getMonth() + 1);
    day = String(selected_date.getDate());
    return year + '-' + (month.length < 2 ? '0' + month : month) + '-' + (day.length < 2 ? '0' + day : day);
  }

  /**
   * Normalize, deduplicate, and order ISO date values.
   *
   * @param {*} selected_dates Candidate date array.
   *
   * @return {Array<string>} Ordered valid ISO dates.
   */
  function normalize_iso_dates(selected_dates) {
    var unique_dates = {};
    if (!Array.isArray(selected_dates)) {
      return [];
    }
    selected_dates.forEach(function (selected_date) {
      var parsed_date = parse_iso_date(selected_date);
      var normalized_date = parsed_date ? format_iso_date(parsed_date) : '';
      if (normalized_date) {
        unique_dates[normalized_date] = true;
      }
    });
    return Object.keys(unique_dates).sort();
  }

  /**
   * Normalize one exact-minute browser time without rounding.
   *
   * @param {*} time_value Candidate `HH:MM` value.
   *
   * @return {string} Exact 24-hour minute value, or an empty string.
   */
  function normalize_exact_minute_time(time_value) {
    time_value = String(time_value || '');
    return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time_value) ? time_value : '';
  }

  /**
   * Copy only the server-defined native calendar parameter allow list.
   *
   * @param {*} calendar_parameters Candidate parameter record.
   *
   * @return {Object} Executable-free allow-listed parameter record.
   */
  function normalize_calendar_parameters(calendar_parameters) {
    var normalized_parameters = {};
    if (!calendar_parameters || 'object' !== typeof calendar_parameters || Array.isArray(calendar_parameters)) {
      return normalized_parameters;
    }
    calendar_parameter_names.forEach(function (parameter_name) {
      if (Object.prototype.hasOwnProperty.call(calendar_parameters, parameter_name)) {
        normalized_parameters[parameter_name] = calendar_parameters[parameter_name];
      }
    });
    return normalized_parameters;
  }

  /**
   * Copy scalar values from one explicit allow list.
   *
   * @param {*}             candidate_values Candidate executable-free record.
   * @param {Array<string>} allowed_names    Accepted property names.
   *
   * @return {Object} Bounded scalar record.
   */
  function normalize_scalar_parameters(candidate_values, allowed_names) {
    var normalized_values = {};
    if (!candidate_values || 'object' !== typeof candidate_values || Array.isArray(candidate_values)) {
      return normalized_values;
    }
    allowed_names.forEach(function (parameter_name) {
      var parameter_value;
      if (!Object.prototype.hasOwnProperty.call(candidate_values, parameter_name)) {
        return;
      }
      parameter_value = candidate_values[parameter_name];
      if (null === parameter_value || -1 !== ['string', 'number', 'boolean'].indexOf(typeof parameter_value)) {
        normalized_values[parameter_name] = parameter_value;
      }
    });
    return normalized_values;
  }

  /**
   * Remove every child node from a Date Editor calendar host.
   *
   * @param {Element|null} host Calendar host element.
   *
   * @return {void}
   */
  function clear_host(host) {
    if (!host) {
      return;
    }
    while (host.firstChild) {
      host.removeChild(host.firstChild);
    }
  }

  /**
   * Capture one native calendar registry entry before a temporary mount.
   *
   * The native calendar runtime stores Resource parameters in one global
   * registry. A shallow property copy is sufficient here because the adapter
   * replaces top-level parameters and does not mutate nested values inherited
   * from another owner.
   *
   * @param {number} resource_id Booking Resource ID.
   *
   * @return {Object|null} Restorable registry snapshot, or null when unavailable.
   */
  function capture_native_calendar_registry_entry(resource_id) {
    var calendars;
    var registry_key;
    var registry_entry;
    var parameters = {};
    if (!window._wpbc || 'function' !== typeof window._wpbc.calendars_all__get || !resource_id) {
      return null;
    }
    calendars = window._wpbc.calendars_all__get();
    calendars = calendars && 'object' === typeof calendars && !Array.isArray(calendars) ? calendars : {};
    registry_key = 'calendar_' + resource_id;
    if (!Object.prototype.hasOwnProperty.call(calendars, registry_key)) {
      return {
        key: registry_key,
        existed: false,
        parameters: null
      };
    }
    registry_entry = calendars[registry_key];
    if (registry_entry && 'object' === typeof registry_entry && !Array.isArray(registry_entry)) {
      Object.keys(registry_entry).forEach(function (parameter_name) {
        parameters[parameter_name] = registry_entry[parameter_name];
      });
    }
    return {
      key: registry_key,
      existed: true,
      parameters: parameters
    };
  }

  /**
   * Restore or remove one temporary native calendar registry entry.
   *
   * Existing entries are restored without replacing other Resource entries.
   * Entries created solely for an Inspector mount are removed so later mounts
   * cannot inherit stale policy parameters from an earlier Resource.
   *
   * @param {Object|null} registry_snapshot Snapshot returned by the capture helper.
   *
   * @return {boolean} True when the registry was restored.
   */
  function restore_native_calendar_registry_entry(registry_snapshot) {
    var calendars;
    if (!registry_snapshot || 'string' !== typeof registry_snapshot.key || !window._wpbc || 'function' !== typeof window._wpbc.calendars_all__get || 'function' !== typeof window._wpbc.calendars_all__set) {
      return false;
    }
    calendars = window._wpbc.calendars_all__get();
    calendars = calendars && 'object' === typeof calendars && !Array.isArray(calendars) ? calendars : {};
    if (registry_snapshot.existed) {
      calendars[registry_snapshot.key] = registry_snapshot.parameters || {};
    } else {
      delete calendars[registry_snapshot.key];
    }
    window._wpbc.calendars_all__set(calendars);
    return true;
  }

  /**
   * Create one dormant native-calendar adapter.
   *
   * Only one adapter may own a mounted native calendar because WPBC calendars
   * are keyed globally by Resource ID and use stable DOM identifiers.
   *
   * @return {Object} Controlled adapter API for the future Date Editor controller.
   */
  function create_native_calendar_adapter() {
    var host = null;
    var resource_id = 0;
    var load_generation = 0;
    var pending_calendar_request = null;
    var policy_parameters = {};
    var calendar_registry_snapshot = null;
    var previous_other_parameters = {};
    var previous_secure_parameters = {};

    /**
     * Confirm that every required native calendar API is available.
     *
     * @return {boolean} True when the standard runtime is ready.
     */
    function has_native_api() {
      return Boolean(window._wpbc && 'function' === typeof window._wpbc.calendars_all__get && 'function' === typeof window._wpbc.calendars_all__set && 'function' === typeof window._wpbc.calendar__set_parameters && 'function' === typeof window._wpbc.calendar__get_param_value && 'function' === typeof window._wpbc.set_other_param && 'function' === typeof window._wpbc.get_other_param && 'function' === typeof window._wpbc.set_secure_param && 'function' === typeof window._wpbc.get_secure_param && 'function' === typeof window.wpbc_calendar_show && 'function' === typeof window.wpbc_calendar__load_data__ajx && 'function' === typeof window.wpbc_calendar__get_inst && $.datepick && 'function' === typeof $.datepick._formatDate && 'function' === typeof $.datepick._updateDatepick);
    }

    /**
     * Preserve and apply native AJAX security parameters for this mount.
     *
     * Native security state is global. The active-instance guard and teardown
     * restoration ensure this editor cannot leak its nonce or locale into a
     * later calendar consumer on the same administration page.
     *
     * @param {*} secure_parameters Authorized native security parameters.
     *
     * @return {void}
     */
    function apply_secure_parameters(secure_parameters) {
      var normalized_parameters = normalize_scalar_parameters(secure_parameters, secure_parameter_names);
      secure_parameter_names.forEach(function (parameter_name) {
        if (!Object.prototype.hasOwnProperty.call(normalized_parameters, parameter_name)) {
          return;
        }
        previous_secure_parameters[parameter_name] = window._wpbc.get_secure_param(parameter_name);
        window._wpbc.set_secure_param(parameter_name, normalized_parameters[parameter_name]);
      });
    }

    /**
     * Store and apply bounded native calendar parameters.
     *
     * @param {Object} calendar_parameters Allow-listed server values.
     *
     * @return {void}
     */
    function apply_calendar_parameters(calendar_parameters) {
      var normalized_parameters = normalize_calendar_parameters(calendar_parameters);
      window._wpbc.calendar__set_parameters(resource_id, normalized_parameters);
    }

    /**
     * Store and apply the narrow global edit context used by native calendars.
     *
     * @param {*} context_parameters Candidate edit-context record.
     *
     * @return {void}
     */
    function apply_context_parameters(context_parameters) {
      if (!context_parameters || 'object' !== typeof context_parameters || Array.isArray(context_parameters)) {
        return;
      }
      other_parameter_names.forEach(function (parameter_name) {
        if (!Object.prototype.hasOwnProperty.call(context_parameters, parameter_name)) {
          return;
        }
        previous_other_parameters[parameter_name] = window._wpbc.get_other_param(parameter_name);
        window._wpbc.set_other_param(parameter_name, context_parameters[parameter_name]);
      });
    }

    /**
     * Read the complete canonical selection from the native calendar.
     *
     * Dynamic range mode stores only its boundary dates on the datepick instance,
     * while the native helper returns the complete selection represented by the
     * calendar's canonical hidden value. The instance remains a compatibility
     * fallback for older native runtimes that do not expose that helper.
     *
     * @return {Array<string>} Ordered selected ISO dates.
     */
    function get_selected_dates() {
      var calendar_instance;
      var selected_dates;
      if (!resource_id || 'function' !== typeof window.wpbc_calendar__get_inst) {
        return [];
      }
      if ('function' === typeof window.wpbc_get__selected_dates_sql__as_arr) {
        return normalize_iso_dates(window.wpbc_get__selected_dates_sql__as_arr(resource_id));
      }
      calendar_instance = window.wpbc_calendar__get_inst(resource_id);
      selected_dates = calendar_instance && Array.isArray(calendar_instance.dates) ? calendar_instance.dates.map(format_iso_date) : [];
      return normalize_iso_dates(selected_dates);
    }

    /**
     * Restore exact authorized dates without availability-gated click replay.
     *
     * This operation changes selection only. Existing availability data and day
     * styling remain owned by the native calendar AJAX response.
     *
     * @param {Array<string>} selected_dates Exact saved or draft ISO dates.
     *
     * @return {boolean} True when the mounted instance was synchronized.
     */
    function set_exact_selected_dates(selected_dates) {
      var normalized_dates = normalize_iso_dates(selected_dates);
      var calendar_instance = window.wpbc_calendar__get_inst(resource_id);
      var native_dates;
      var hidden_date_field;
      var applied_dates;
      if (!calendar_instance) {
        return false;
      }
      native_dates = normalized_dates.map(parse_iso_date).filter(function (selected_date) {
        return null !== selected_date;
      });
      hidden_date_field = document.getElementById('date_booking' + resource_id);
      calendar_instance.stayOpen = false;
      calendar_instance.dates = native_dates;
      if (hidden_date_field) {
        hidden_date_field.value = native_dates.map(function (selected_date) {
          return $.datepick._formatDate(calendar_instance, selected_date);
        }).join(', ');
      }
      $.datepick._updateDatepick(calendar_instance);
      if (native_dates.length && 'function' === typeof window.wpbc_calendar__scroll_to) {
        window.wpbc_calendar__scroll_to(resource_id, native_dates[0].getFullYear(), native_dates[0].getMonth() + 1);
      }
      applied_dates = get_selected_dates();
      return normalized_dates.join('|') === applied_dates.join('|');
    }

    /**
     * Mount canonical server-rendered calendar markup and initialize datepick.
     *
     * @param {Element} calendar_host Empty Date Editor calendar host.
     * @param {Object} mount_configuration Authorized, executable-free configuration.
     *
     * @return {boolean} True when this adapter owns an initialized calendar.
     */
    function mount(calendar_host, mount_configuration) {
      var requested_resource_id;
      var existing_calendar;
      mount_configuration = mount_configuration || {};
      requested_resource_id = normalize_resource_id(mount_configuration.resource_id);
      if (active_adapter || !has_native_api() || !calendar_host || 1 !== calendar_host.nodeType || !requested_resource_id || 'string' !== typeof mount_configuration.calendar_html) {
        return false;
      }
      existing_calendar = document.getElementById('calendar_booking' + requested_resource_id);
      if (existing_calendar && !calendar_host.contains(existing_calendar)) {
        return false;
      }
      active_adapter = adapter_api;
      host = calendar_host;
      resource_id = requested_resource_id;
      calendar_registry_snapshot = capture_native_calendar_registry_entry(resource_id);
      policy_parameters = normalize_calendar_parameters(mount_configuration.policy_parameters);
      apply_calendar_parameters(mount_configuration.calendar_parameters);
      apply_context_parameters(mount_configuration.context_parameters);
      apply_secure_parameters(mount_configuration.secure_parameters);
      host.innerHTML = mount_configuration.calendar_html;
      if (!document.getElementById('calendar_booking' + resource_id) || false === window.wpbc_calendar_show(resource_id)) {
        teardown();
        return false;
      }
      return true;
    }

    /**
     * Start the canonical WPBC calendar-data request for this Resource.
     *
     * @param {Object}   request_parameters Standard calendar request parameters.
     * @param {Function} on_loaded          Called only for this adapter's current load.
     * @param {Function} on_failed          Called for a non-aborted matching request failure.
     *
     * @return {boolean} True when the request was dispatched.
     */
    function load(request_parameters, on_loaded, on_failed) {
      var current_generation;
      var normalized_request;
      var capture_handler;
      if (active_adapter !== adapter_api || !resource_id || 'function' !== typeof window.wpbc_calendar__load_data__ajx) {
        return false;
      }
      abort_load();
      current_generation = load_generation;
      normalized_request = normalize_scalar_parameters(request_parameters, request_parameter_names);
      normalized_request.resource_id = resource_id;
      $('body').off('wpbc_calendar_ajx__loaded_data' + EVENT_NAMESPACE);
      $('body').on('wpbc_calendar_ajx__loaded_data' + EVENT_NAMESPACE, function (event, loaded_resource_id) {
        if (active_adapter !== adapter_api || current_generation !== load_generation || resource_id !== normalize_resource_id(loaded_resource_id) || !pending_calendar_request || 4 !== pending_calendar_request.readyState) {
          return;
        }
        $('body').off('wpbc_calendar_ajx__loaded_data' + EVENT_NAMESPACE);
        $(document).off('ajaxSend' + AJAX_CAPTURE_NAMESPACE);
        pending_calendar_request = null;
        if ('function' === typeof on_loaded) {
          on_loaded(resource_id);
        }
      });
      capture_handler = function (event, jq_xhr, ajax_settings) {
        var request_body = String(ajax_settings && ajax_settings.data ? ajax_settings.data : '');
        var decoded_body;
        try {
          decoded_body = decodeURIComponent(request_body.replace(/\+/g, '%20'));
        } catch (decode_error) {
          decoded_body = request_body;
        }
        if (!/(?:^|&)action=WPBC_AJX_CALENDAR_LOAD(?:&|$)/.test(decoded_body) || !new RegExp('(?:^|&)calendar_request_params\\[resource_id\\]=' + resource_id + '(?:&|$)').test(decoded_body)) {
          return;
        }
        $(document).off('ajaxSend' + AJAX_CAPTURE_NAMESPACE, capture_handler);
        pending_calendar_request = jq_xhr;
        jq_xhr.fail(function (failed_request, request_status) {
          if ('abort' === request_status || active_adapter !== adapter_api || current_generation !== load_generation) {
            return;
          }
          $('body').off('wpbc_calendar_ajx__loaded_data' + EVENT_NAMESPACE);
          pending_calendar_request = null;
          if ('function' === typeof on_failed) {
            on_failed(failed_request);
          }
        });
      };
      $(document).off('ajaxSend' + AJAX_CAPTURE_NAMESPACE);
      $(document).on('ajaxSend' + AJAX_CAPTURE_NAMESPACE, capture_handler);
      window.wpbc_calendar__load_data__ajx(normalized_request);
      return true;
    }

    /**
     * Abort the adapter's matching native request and invalidate its callbacks.
     *
     * @return {void}
     */
    function abort_load() {
      load_generation += 1;
      $('body').off('wpbc_calendar_ajx__loaded_data' + EVENT_NAMESPACE);
      $(document).off('ajaxSend' + AJAX_CAPTURE_NAMESPACE);
      if (window._wpbc && 'function' === typeof window._wpbc.balancer__remove_from__wait_list && resource_id) {
        window._wpbc.balancer__remove_from__wait_list(resource_id, 'wpbc_calendar__load_data__ajx');
      }
      if (pending_calendar_request && 'function' === typeof pending_calendar_request.abort) {
        pending_calendar_request.abort();
      }
      pending_calendar_request = null;
    }

    /**
     * Switch between native policy and individual-date selection.
     *
     * @param {string} selection_mode `policy` or `individual`.
     *
     * @return {boolean} True when the native selection mode was applied.
     */
    function set_selection_mode(selection_mode) {
      var selected_dates;
      if (active_adapter !== adapter_api || !resource_id) {
        return false;
      }
      selected_dates = get_selected_dates();
      if (MODE_INDIVIDUAL === selection_mode) {
        if ('function' !== typeof window.wpbc_cal_days_select__multiple) {
          return false;
        }
        window.wpbc_cal_days_select__multiple(resource_id);
      } else if (MODE_POLICY === selection_mode) {
        if ('function' !== typeof window.wpbc_cal_days_select__re_init || 'function' !== typeof window.wpbc_cal__re_init) {
          return false;
        }
        window._wpbc.calendar__set_parameters(resource_id, policy_parameters);
        window.wpbc_cal_days_select__re_init(resource_id);
        window.wpbc_cal__re_init(resource_id);
      } else {
        return false;
      }

      // Policy changes may reject the existing shape. Preserve it directly when
      // possible, but keep the editor usable when the policy cannot reselect it.
      set_exact_selected_dates(selected_dates);
      return true;
    }

    /**
     * Tear down only state owned by this adapter.
     *
     * @return {void}
     */
    function teardown() {
      var calendar_element;
      abort_load();
      calendar_element = resource_id ? document.getElementById('calendar_booking' + resource_id) : null;
      if (calendar_element && $.fn.datepick) {
        try {
          $(calendar_element).datepick('destroy');
        } catch (destroy_error) {
          // A partially initialized calendar still needs its owned markup removed.
        }
      }
      if (window._wpbc && resource_id) {
        restore_native_calendar_registry_entry(calendar_registry_snapshot);
        Object.keys(previous_other_parameters).forEach(function (parameter_name) {
          window._wpbc.set_other_param(parameter_name, previous_other_parameters[parameter_name]);
        });
        Object.keys(previous_secure_parameters).forEach(function (parameter_name) {
          window._wpbc.set_secure_param(parameter_name, previous_secure_parameters[parameter_name]);
        });
      }
      clear_host(host);
      host = null;
      resource_id = 0;
      policy_parameters = {};
      calendar_registry_snapshot = null;
      previous_other_parameters = {};
      previous_secure_parameters = {};
      if (active_adapter === adapter_api) {
        active_adapter = null;
      }
    }
    var adapter_api = {
      mount: mount,
      load: load,
      abort_load: abort_load,
      set_exact_selected_dates: set_exact_selected_dates,
      set_selection_mode: set_selection_mode,
      get_selected_dates: get_selected_dates,
      teardown: teardown
    };
    return adapter_api;
  }

  /**
   * Clone the small JSON-safe Date Editor draft contract.
   *
   * @param {Object} editor_draft Date Editor draft.
   *
   * @return {Object} Independent draft copy.
   */
  function clone_editor_draft(editor_draft) {
    editor_draft = editor_draft && 'object' === typeof editor_draft ? editor_draft : {};
    return {
      selection_method: MODE_INDIVIDUAL === editor_draft.selection_method ? MODE_INDIVIDUAL : MODE_POLICY,
      time_application: -1 !== [TIME_APPLICATION_FULL_DAY, TIME_APPLICATION_BOUNDARY, TIME_APPLICATION_PER_DATE].indexOf(editor_draft.time_application) ? editor_draft.time_application : TIME_APPLICATION_FULL_DAY,
      start_time: normalize_exact_minute_time(editor_draft.start_time),
      end_time: normalize_exact_minute_time(editor_draft.end_time),
      selected_dates: normalize_iso_dates(editor_draft.selected_dates)
    };
  }

  /**
   * Create the immutable authorized saved snapshot.
   *
   * Freezing both levels prevents hydration fallback or later interaction from
   * silently rewriting the canonical comparison source.
   *
   * @param {Object} editor_draft Authorized initial Date Editor values.
   *
   * @return {Object} Frozen saved snapshot.
   */
  function freeze_editor_draft(editor_draft) {
    var frozen_draft = clone_editor_draft(editor_draft);
    Object.freeze(frozen_draft.selected_dates);
    return Object.freeze(frozen_draft);
  }

  /**
   * Build the semantic proposal used for dirty comparison.
   *
   * Full-day proposals retain time inputs in browser memory so switching modes
   * is lossless, but the effective proposal deliberately has no boundaries.
   *
   * @param {Object} editor_draft Saved or mutable browser draft.
   *
   * @return {Object} Normalized non-persistent proposal.
   */
  function get_effective_editor_draft(editor_draft) {
    var effective_draft = clone_editor_draft(editor_draft);
    if (TIME_APPLICATION_FULL_DAY === effective_draft.time_application) {
      effective_draft.start_time = '';
      effective_draft.end_time = '';
    }
    return effective_draft;
  }

  /**
   * Substitute ordered time values into one localized label template.
   *
   * @param {string}        label_template Localized `%s` or numbered placeholder template.
   * @param {Array<string>} time_values    Exact-minute replacement values.
   *
   * @return {string} Localized time label.
   */
  function format_editor_time_label(label_template, time_values) {
    var formatted_label = String(label_template || '');
    time_values.forEach(function (time_value, time_index) {
      formatted_label = formatted_label.replace('%' + (time_index + 1) + '$s', time_value);
      if (0 === time_index) {
        formatted_label = formatted_label.replace('%s', time_value);
      }
    });
    return formatted_label;
  }

  /**
   * Create the Date Editor interaction controller inside one Inspector shell.
   *
   * The controller owns browser drafts, native-calendar lifecycle, review
   * presentation, and transport to the authoritative apply endpoint. It never
   * authorizes a booking or treats native calendar state as persistence
   * authority.
   *
   * @param {HTMLElement} inspector_shell Booking Inspector shell root.
   * @param {Object}      configuration   Server-owned Date Editor configuration.
   * @param {Object}      options         Inspector-owned transport and focus callbacks.
   *
   * @return {Object|null} Date Editor controller, or null when inactive.
   */
  function create_controller(inspector_shell, configuration, options) {
    var settings = configuration && 'object' === typeof configuration ? configuration : {};
    var controller_options = options && 'object' === typeof options ? options : {};
    var i18n = settings.i18n && 'object' === typeof settings.i18n ? settings.i18n : {};
    var read_settings = settings.read && 'object' === typeof settings.read ? settings.read : {};
    var review_settings = settings.review && 'object' === typeof settings.review ? settings.review : {};
    var apply_settings = settings.apply && 'object' === typeof settings.apply ? settings.apply : {};
    var template = window.wp && 'function' === typeof window.wp.template && settings.template_id ? window.wp.template(settings.template_id) : null;
    var review_template = window.wp && 'function' === typeof window.wp.template && settings.review_template_id ? window.wp.template(settings.review_template_id) : null;
    var inspector_panel = inspector_shell ? inspector_shell.querySelector('.wpbc_shared_ui_inspector__panel') : null;
    var layer = null;
    var opener = null;
    var read_request = null;
    var review_request = null;
    var apply_request = null;
    var native_adapter = null;
    var active_editor = null;
    var active_review = null;
    var pending_apply_result = null;
    var saved_draft = null;
    var draft = null;
    var controller_generation = 0;
    var review_generation = 0;
    var apply_generation = 0;
    var native_load_timer = null;
    var dirty = false;
    if (!settings.active || !inspector_shell || !inspector_panel || !template || !review_template || !window.jQuery) {
      return null;
    }

    /**
     * Announce and display one lifecycle message with accessible severity.
     *
     * @param {string}  message       Localized status message.
     * @param {boolean} show_visually Whether the message needs a visible strip.
     * @param {string}  [status_type] Optional warning or error severity.
     *
     * @return {void}
     */
    function set_status(message, show_visually, status_type) {
      var status = layer ? layer.querySelector('[data-wpbc-booking-date-editor-status]') : null;
      var is_visible = Boolean(show_visually && message);
      var normalized_status_type = 'error' === status_type ? 'error' : 'warning';
      if (status) {
        status.textContent = String(message || '');
        status.classList.toggle('is-visible', is_visible);
        status.classList.toggle('is-warning', is_visible && 'warning' === normalized_status_type);
        status.classList.toggle('is-error', is_visible && 'error' === normalized_status_type);
        status.classList.remove('is-emphasized');
        status.setAttribute('role', is_visible && 'error' === normalized_status_type ? 'alert' : 'status');
        status.setAttribute('aria-live', is_visible && 'error' === normalized_status_type ? 'assertive' : 'polite');
        if (is_visible) {
          // Restart the bounded emphasis when the same validation message is repeated.
          void status.offsetWidth;
          status.classList.add('is-emphasized');
        }
      }
    }

    /**
     * Show the established centered Inspector loading presentation.
     *
     * The visible loader mirrors the shared Inspector shell. Lifecycle text is
     * also copied to the hidden live region so loading remains announced without
     * reserving a persistent message strip above the editor.
     *
     * @param {string} message Localized loading message.
     *
     * @return {void}
     */
    function show_loading(message) {
      var loading = layer ? layer.querySelector('[data-wpbc-booking-date-editor-loading]') : null;
      var loading_label = loading ? loading.querySelector('[data-wpbc-booking-date-editor-loading-label]') : null;
      var error_box = layer ? layer.querySelector('[data-wpbc-booking-date-editor-error]') : null;
      var editor_view = layer ? layer.querySelector('[data-wpbc-booking-date-editor-view="editor"]') : null;
      var review_view = layer ? layer.querySelector('[data-wpbc-booking-date-editor-view="review"]') : null;
      if (error_box) {
        error_box.hidden = true;
      }
      if (editor_view) {
        editor_view.hidden = true;
      }
      if (review_view) {
        review_view.hidden = true;
      }
      if (loading_label) {
        loading_label.textContent = String(message || i18n.loading_dates || '');
      }
      if (loading) {
        loading.hidden = false;
      }
      set_status(message, false);
      if (layer) {
        layer.setAttribute('aria-busy', 'true');
      }
    }

    /**
     * Clear the native load timeout.
     *
     * @return {void}
     */
    function clear_native_load_timer() {
      if (null !== native_load_timer) {
        window.clearTimeout(native_load_timer);
        native_load_timer = null;
      }
    }

    /**
     * Notify the Inspector when this secondary layer changes dirty state.
     *
     * @return {void}
     */
    function update_dirty_state() {
      var next_dirty = Boolean(saved_draft && draft && JSON.stringify(get_effective_editor_draft(saved_draft)) !== JSON.stringify(get_effective_editor_draft(draft)));
      if (dirty === next_dirty) {
        return;
      }
      dirty = next_dirty;
      if ('function' === typeof controller_options.on_dirty_change) {
        controller_options.on_dirty_change(dirty);
      }
    }

    /**
     * Remove the active layer and restore every native global it changed.
     *
     * @return {void}
     */
    function teardown_layer() {
      controller_generation += 1;
      review_generation += 1;
      apply_generation += 1;
      clear_native_load_timer();
      if (read_request && 'function' === typeof read_request.abort) {
        read_request.abort();
      }
      read_request = null;
      if (review_request && 'function' === typeof review_request.abort) {
        review_request.abort();
      }
      review_request = null;
      if (apply_request && 'function' === typeof apply_request.abort) {
        apply_request.abort();
      }
      apply_request = null;
      if (native_adapter) {
        native_adapter.teardown();
      }
      native_adapter = null;
      if (layer) {
        window.jQuery(layer).off('date_selected' + EVENT_NAMESPACE);
        layer.remove();
      }
      layer = null;
      active_editor = null;
      active_review = null;
      pending_apply_result = null;
      saved_draft = null;
      draft = null;
      dirty = false;
      if ('function' === typeof controller_options.on_dirty_change) {
        controller_options.on_dirty_change(false);
      }
    }

    /**
     * Resolve the best current focus target after the layer closes.
     *
     * @return {HTMLElement|null} Connected focus target or null.
     */
    function get_restore_focus_target() {
      var fallback_focus;
      if (opener && opener.isConnected && 'function' === typeof opener.focus) {
        return opener;
      }
      fallback_focus = 'function' === typeof controller_options.get_restore_focus ? controller_options.get_restore_focus() : null;
      return fallback_focus && fallback_focus.isConnected && 'function' === typeof fallback_focus.focus ? fallback_focus : null;
    }

    /**
     * Close the secondary layer with optional dirty protection.
     *
     * @param {boolean} restore_focus Whether to restore the activating control.
     * @param {boolean} force         Whether an already-approved parent close skips prompting.
     *
     * @return {boolean} True when the layer is closed or was already closed.
     */
    function close(restore_focus, force) {
      var focus_target;
      if (!layer) {
        return true;
      }
      if (dirty && !force && !window.confirm(i18n.discard_changes || '')) {
        return false;
      }
      focus_target = restore_focus ? get_restore_focus_target() : null;
      teardown_layer();
      opener = null;
      if (focus_target) {
        window.setTimeout(function () {
          if (focus_target.isConnected) {
            focus_target.focus();
          }
        }, 0);
      }
      return true;
    }

    /**
     * Render a fresh single Date Editor layer from the allow-listed template.
     *
     * @param {Object} template_values Authorized or empty presentation values.
     *
     * @return {HTMLElement|null} Rendered layer.
     */
    function render_layer(template_values) {
      var render_host = document.createElement('div');
      var rendered_layer;
      var restore_layer_focus = Boolean(layer && layer.contains(document.activeElement));
      if (layer) {
        layer.remove();
        layer = null;
      }
      render_host.innerHTML = template(Object.assign({
        inspector_id: 'wpbc_booking_inspector',
        i18n: i18n,
        selected_dates: []
      }, template_values || {}));
      rendered_layer = render_host.querySelector('[data-wpbc-booking-date-editor-layer]');
      if (!rendered_layer) {
        return null;
      }
      inspector_panel.appendChild(rendered_layer);
      layer = rendered_layer;
      layer.hidden = false;
      if (restore_layer_focus) {
        window.requestAnimationFrame(function () {
          if (layer) {
            layer.focus();
          }
        });
      }
      return layer;
    }

    /**
     * Toggle the editable/error presentation without replacing native markup.
     *
     * @param {string}  message    Safe localized or endpoint-normalized message.
     * @param {boolean} allow_retry Whether Retry remains available.
     *
     * @return {void}
     */
    function show_error(message, allow_retry) {
      var loading = layer ? layer.querySelector('[data-wpbc-booking-date-editor-loading]') : null;
      var error_box = layer ? layer.querySelector('[data-wpbc-booking-date-editor-error]') : null;
      var error_message = error_box ? error_box.querySelector('[data-wpbc-booking-date-editor-error-message]') : null;
      var retry_button = error_box ? error_box.querySelector('[data-wpbc-booking-date-editor-retry]') : null;
      var editor_view = layer ? layer.querySelector('[data-wpbc-booking-date-editor-view="editor"]') : null;
      var calendar_host = layer ? layer.querySelector('[data-wpbc-booking-date-editor-calendar-host]') : null;
      clear_native_load_timer();
      if (loading) {
        loading.hidden = true;
      }
      if (editor_view) {
        editor_view.hidden = true;
      }
      if (error_box) {
        error_box.hidden = false;
      }
      if (error_message) {
        error_message.textContent = String(message || i18n.load_error || '');
      }
      if (retry_button) {
        retry_button.hidden = !allow_retry;
      }
      if (calendar_host) {
        calendar_host.setAttribute('aria-busy', 'false');
      }
      set_status(message, false);
      layer.setAttribute('aria-busy', 'false');
    }

    /**
     * Show controls after the native calendar has loaded.
     *
     * @param {string}  message        Completion or non-terminal warning.
     * @param {boolean} display_warning Whether the message is an actionable visible warning.
     *
     * @return {void}
     */
    function show_ready(message, display_warning) {
      var loading = layer ? layer.querySelector('[data-wpbc-booking-date-editor-loading]') : null;
      var error_box = layer ? layer.querySelector('[data-wpbc-booking-date-editor-error]') : null;
      var editor_view = layer ? layer.querySelector('[data-wpbc-booking-date-editor-view="editor"]') : null;
      var calendar_host = layer ? layer.querySelector('[data-wpbc-booking-date-editor-calendar-host]') : null;
      if (loading) {
        loading.hidden = true;
      }
      if (error_box) {
        error_box.hidden = true;
      }
      if (editor_view) {
        editor_view.hidden = false;
      }
      if (calendar_host) {
        calendar_host.setAttribute('aria-busy', 'false');
      }
      set_status(message, display_warning, 'warning');
      layer.setAttribute('aria-busy', 'false');
    }

    /**
     * Determine whether the local draft is complete enough for server review.
     *
     * This is advisory only. The review endpoint repeats strict normalization,
     * authorization, policy, time, and availability validation.
     *
     * @return {boolean} True when the Review changes request may be submitted.
     */
    function is_draft_reviewable() {
      if (!draft || !dirty || !draft.selected_dates.length) {
        return false;
      }
      return TIME_APPLICATION_FULL_DAY === draft.time_application || Boolean(normalize_exact_minute_time(draft.start_time) && normalize_exact_minute_time(draft.end_time));
    }

    /**
     * Synchronize time-control visibility and selected-date summaries.
     *
     * @return {void}
     */
    function render_draft_state() {
      var time_fields = layer ? layer.querySelector('[data-wpbc-booking-date-editor-time-fields]') : null;
      var time_help = layer ? layer.querySelector('[data-wpbc-booking-date-editor-time-help]') : null;
      var time_controls = layer ? layer.querySelectorAll('[data-wpbc-booking-date-editor-time]') : [];
      var selected_list = layer ? layer.querySelector('[data-wpbc-booking-date-editor-selected-dates]') : null;
      var selected_output = layer ? layer.querySelector('[data-wpbc-booking-date-editor-summary="selected_dates"]') : null;
      var calendar_output = layer ? layer.querySelector('[data-wpbc-booking-date-editor-summary="calendar_days"]') : null;
      var nights_output = layer ? layer.querySelector('[data-wpbc-booking-date-editor-summary="nights"]') : null;
      var time_output = layer ? layer.querySelector('[data-wpbc-booking-date-editor-summary="time"]') : null;
      var review_button = layer ? layer.querySelector('[data-wpbc-booking-date-editor-review]') : null;
      var is_full_day;
      var time_interval;
      if (!draft) {
        return;
      }
      is_full_day = TIME_APPLICATION_FULL_DAY === draft.time_application;
      time_interval = format_editor_time_label(i18n.time_interval || '%1$s – %2$s', [draft.start_time, draft.end_time]);
      if (time_fields) {
        time_fields.hidden = is_full_day;
      }
      if (time_help) {
        time_help.hidden = TIME_APPLICATION_PER_DATE !== draft.time_application;
      }
      Array.prototype.forEach.call(time_controls, function (time_control) {
        time_control.disabled = is_full_day;
      });
      if (selected_output) {
        selected_output.textContent = String(draft.selected_dates.length);
      }
      if (calendar_output) {
        calendar_output.textContent = String(draft.selected_dates.length);
      }
      if (nights_output) {
        nights_output.textContent = String(TIME_APPLICATION_BOUNDARY === draft.time_application ? Math.max(0, draft.selected_dates.length - 1) : 0);
      }
      if (time_output) {
        time_output.textContent = is_full_day ? String(i18n.full_day || i18n.full_days || '') : time_interval;
      }
      if (selected_list) {
        selected_list.textContent = '';
        if (!draft.selected_dates.length) {
          var empty_entry = document.createElement('li');
          empty_entry.className = 'wpbc_booking_inspector__muted';
          empty_entry.textContent = String(i18n.no_selected_dates || '');
          selected_list.appendChild(empty_entry);
        } else {
          draft.selected_dates.forEach(function (selected_date, date_index) {
            var date_entry = document.createElement('li');
            var date_value = document.createElement('span');
            var date_meta = document.createElement('span');
            var is_first_date = 0 === date_index;
            var is_last_date = draft.selected_dates.length - 1 === date_index;
            date_value.setAttribute('data-wpbc-booking-date-editor-selected-date-value', '');
            date_value.textContent = selected_date;
            date_meta.className = 'wpbc_booking_inspector__date_editor_selected_date_meta';
            date_meta.setAttribute('data-wpbc-booking-date-editor-selected-date-meta', '');
            if (is_full_day) {
              date_meta.textContent = String(i18n.full_day || i18n.full_days || '');
            } else if (TIME_APPLICATION_PER_DATE === draft.time_application || is_first_date && is_last_date) {
              date_meta.textContent = time_interval;
            } else if (is_first_date) {
              date_meta.textContent = format_editor_time_label(i18n.starts_at_time || 'Starts at %s', [draft.start_time]);
            } else if (is_last_date) {
              date_meta.textContent = format_editor_time_label(i18n.ends_at_time || 'Ends at %s', [draft.end_time]);
            } else {
              date_meta.textContent = String(i18n.full_day || i18n.full_days || '');
            }
            date_entry.appendChild(date_value);
            date_entry.appendChild(date_meta);
            selected_list.appendChild(date_entry);
          });
        }
      }
      update_dirty_state();
      if (review_button) {
        review_button.disabled = !is_draft_reviewable();
        review_button.setAttribute('aria-disabled', is_draft_reviewable() ? 'false' : 'true');
      }
    }

    /**
     * Hydrate every current draft date after the matching native loaded event.
     *
     * A short animation-frame retry accommodates the datepicker's own refresh.
     * Failure is non-terminal: individual selection remains available and the
     * user receives a warning instead of a closed or unusable editor.
     *
     * @param {number} generation Current controller generation.
     * @param {number} attempt    Zero-based hydration attempt.
     *
     * @return {void}
     */
    function hydrate_draft_dates(generation, attempt) {
      var hydration_complete;
      if (generation !== controller_generation || !native_adapter || !draft) {
        return;
      }
      hydration_complete = native_adapter.set_exact_selected_dates(draft.selected_dates);
      if (hydration_complete) {
        draft.selected_dates = native_adapter.get_selected_dates();
        render_draft_state();
        show_ready(i18n.calendar_loaded || '', false);
        return;
      }
      if (attempt < 3) {
        window.requestAnimationFrame(function () {
          hydrate_draft_dates(generation, attempt + 1);
        });
        return;
      }
      native_adapter.set_selection_mode(MODE_INDIVIDUAL);
      hydration_complete = native_adapter.set_exact_selected_dates(draft.selected_dates);
      draft.selection_method = MODE_INDIVIDUAL;
      Array.prototype.forEach.call(layer.querySelectorAll('[data-wpbc-booking-date-editor-selection-method]'), function (control) {
        control.checked = MODE_INDIVIDUAL === control.value;
      });
      draft.selected_dates = hydration_complete ? native_adapter.get_selected_dates() : draft.selected_dates.slice(0);
      render_draft_state();
      show_ready(i18n.hydration_warning || '', true);
    }

    /**
     * Mount and load the standard native calendar for an authorized editor DTO.
     *
     * @param {number} generation Current controller generation.
     *
     * @return {void}
     */
    function mount_native_calendar(generation) {
      var calendar = active_editor && active_editor.calendar ? active_editor.calendar : {};
      var calendar_host = layer ? layer.querySelector('[data-wpbc-booking-date-editor-calendar-host]') : null;
      native_adapter = create_native_calendar_adapter();
      if (calendar_host) {
        calendar_host.setAttribute('aria-busy', 'true');
      }
      if (!native_adapter.mount(calendar_host, {
        resource_id: active_editor.resource_id,
        calendar_html: calendar.html || '',
        calendar_parameters: calendar.calendar_parameters || {},
        policy_parameters: calendar.policy_parameters || {},
        context_parameters: calendar.context_parameters || {},
        secure_parameters: calendar.secure_parameters || {}
      })) {
        show_error(i18n.calendar_error || '', true);
        return;
      }
      window.jQuery(layer).off('date_selected' + EVENT_NAMESPACE).on('date_selected' + EVENT_NAMESPACE, function (event, selected_resource_id, clicked_dates, selected_dates) {
        if (generation !== controller_generation || normalize_resource_id(selected_resource_id) !== normalize_resource_id(active_editor.resource_id) || !draft) {
          return;
        }
        draft.selected_dates = normalize_iso_dates(selected_dates);
        render_draft_state();
      });
      set_status(i18n.loading_calendar || '', false);
      clear_native_load_timer();
      native_load_timer = window.setTimeout(function () {
        if (generation === controller_generation && layer) {
          native_adapter.abort_load();
          show_error(i18n.calendar_error || '', true);
        }
      }, NATIVE_LOAD_TIMEOUT_MS);
      if (!native_adapter.load(calendar.request_parameters || {}, function () {
        clear_native_load_timer();
        if (generation !== controller_generation || !draft) {
          return;
        }
        // Mode initialization and exact hydration are separate. A policy mode
        // rejection cannot turn a readable calendar into a terminal error.
        native_adapter.set_selection_mode(draft.selection_method);
        hydrate_draft_dates(generation, 0);
      }, function () {
        clear_native_load_timer();
        if (generation === controller_generation) {
          show_error(i18n.calendar_error || '', true);
        }
      })) {
        show_error(i18n.calendar_error || '', true);
      }
    }

    /**
     * Render an authorized read response and begin the native follow-up load.
     *
     * @param {Object} editor_dto Authorized Date Editor DTO.
     * @param {number} generation Current controller generation.
     *
     * @return {void}
     */
    function initialize_editor(editor_dto, generation) {
      var initial = editor_dto && editor_dto.initial ? editor_dto.initial : {};
      active_editor = editor_dto;
      if (!editor_dto.supported) {
        render_layer({
          supported: false,
          fallback: editor_dto.fallback || {},
          i18n: i18n
        });
        show_error(i18n.unsupported_dates || '', false);
        return;
      }
      saved_draft = freeze_editor_draft(initial);
      draft = clone_editor_draft(initial);
      render_layer(Object.assign({}, draft, {
        resource_id: editor_dto.resource_id,
        supported: true,
        i18n: i18n
      }));
      if (!layer) {
        return;
      }
      show_loading(i18n.loading_dates || '');
      render_draft_state();
      mount_native_calendar(generation);
    }

    /**
     * Request a fresh authorized editor DTO for the active booking.
     *
     * @return {void}
     */
    function request_editor() {
      var generation;
      var pending_request;
      var booking_id = active_editor ? normalize_booking_id(active_editor.booking_id) : 0;
      if (!booking_id || !controller_options.url || !controller_options.source || !read_settings.action || !read_settings.nonce) {
        show_error(i18n.load_error || '', true);
        return;
      }
      controller_generation += 1;
      generation = controller_generation;
      if (read_request && 'function' === typeof read_request.abort) {
        read_request.abort();
      }
      if (review_request && 'function' === typeof review_request.abort) {
        review_request.abort();
      }
      review_generation += 1;
      review_request = null;
      active_review = null;
      pending_apply_result = null;
      if (native_adapter) {
        native_adapter.teardown();
        native_adapter = null;
      }
      clear_native_load_timer();
      show_loading(i18n.loading_dates || '');
      pending_request = window.jQuery.ajax({
        url: controller_options.url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: read_settings.action,
          nonce: read_settings.nonce,
          booking_id: booking_id,
          source: controller_options.source
        }
      }).done(function (response) {
        if (generation !== controller_generation || !response || !response.success || !response.data || !response.data.editor) {
          return;
        }
        initialize_editor(response.data.editor, generation);
      }).fail(function (failed_request, request_status) {
        var error = failed_request.responseJSON && failed_request.responseJSON.data ? failed_request.responseJSON.data : {};
        if ('abort' === request_status || generation !== controller_generation || !layer) {
          return;
        }
        show_error(error.message || i18n.load_error || '', true);
      }).always(function () {
        if (read_request === pending_request) {
          read_request = null;
        }
      });
      read_request = pending_request;
    }

    /**
     * Render one authorized review DTO through the domain-owned template.
     *
     * @param {Object} review_response Signed server review response.
     *
     * @return {void}
     */
    function render_review(review_response) {
      var loading = layer ? layer.querySelector('[data-wpbc-booking-date-editor-loading]') : null;
      var error_box = layer ? layer.querySelector('[data-wpbc-booking-date-editor-error]') : null;
      var editor_view = layer ? layer.querySelector('[data-wpbc-booking-date-editor-view="editor"]') : null;
      var review_view = layer ? layer.querySelector('[data-wpbc-booking-date-editor-view="review"]') : null;
      var review_content = review_view ? review_view.querySelector('[data-wpbc-booking-date-editor-review-content]') : null;
      var review_title = review_view ? review_view.querySelector('h4') : null;
      var back_button = review_view ? review_view.querySelector('[data-wpbc-booking-date-editor-back]') : null;
      var apply_button = review_view ? review_view.querySelector('[data-wpbc-booking-date-editor-apply]') : null;
      if (!review_view || !review_content || !review_response || !review_response.review || !review_response.plan || !review_response.token || !review_response.expires_at) {
        show_ready('', false);
        set_status(i18n.review_error || '', true, 'error');
        return;
      }
      active_review = review_response;
      review_content.innerHTML = review_template({
        review: review_response.review || {},
        i18n: i18n
      });
      if (loading) {
        loading.hidden = true;
      }
      if (error_box) {
        error_box.hidden = true;
      }
      if (editor_view) {
        editor_view.hidden = true;
      }
      review_view.hidden = false;
      if (apply_button) {
        apply_button.disabled = false;
        apply_button.setAttribute('aria-disabled', 'false');
        apply_button.textContent = pending_apply_result ? i18n.retry_readback || i18n.retry || '' : i18n.apply_changes || '';
      }
      if (back_button) {
        back_button.disabled = Boolean(pending_apply_result);
        back_button.setAttribute('aria-disabled', pending_apply_result ? 'true' : 'false');
      }
      set_status('', false);
      layer.setAttribute('aria-busy', 'false');
      if (review_title) {
        review_title.focus();
      }
    }

    /**
     * Return from the review to the unchanged mutable browser draft.
     *
     * @return {void}
     */
    function show_editor_from_review() {
      var editor_view = layer ? layer.querySelector('[data-wpbc-booking-date-editor-view="editor"]') : null;
      var review_view = layer ? layer.querySelector('[data-wpbc-booking-date-editor-view="review"]') : null;
      var review_button = editor_view ? editor_view.querySelector('[data-wpbc-booking-date-editor-review]') : null;
      if (pending_apply_result) {
        set_status(i18n.readback_error || i18n.apply_error || '', true, 'error');
        return;
      }
      active_review = null;
      if (review_view) {
        review_view.hidden = true;
      }
      if (editor_view) {
        editor_view.hidden = false;
      }
      set_status('', false);
      if (review_button) {
        review_button.focus();
      }
    }

    /**
     * Request one signed, non-mutating review for the current draft.
     *
     * @return {void}
     */
    function request_review() {
      var generation;
      var pending_request;
      if (!is_draft_reviewable() || !active_editor || !active_editor.source_fingerprint || !controller_options.url || !controller_options.source || !review_settings.action || !review_settings.nonce) {
        set_status(i18n.review_error || '', true, 'error');
        return;
      }
      review_generation += 1;
      generation = review_generation;
      if (review_request && 'function' === typeof review_request.abort) {
        review_request.abort();
      }
      show_loading(i18n.loading_review || '');
      pending_request = window.jQuery.ajax({
        url: controller_options.url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: review_settings.action,
          nonce: review_settings.nonce,
          booking_id: active_editor.booking_id,
          source: controller_options.source,
          source_fingerprint: active_editor.source_fingerprint,
          proposal: JSON.stringify(get_effective_editor_draft(draft))
        }
      }).done(function (response) {
        if (generation !== review_generation || !response || !response.success || !response.data) {
          return;
        }
        render_review(response.data);
      }).fail(function (failed_request, request_status) {
        var error = failed_request.responseJSON && failed_request.responseJSON.data ? failed_request.responseJSON.data : {};
        if ('abort' === request_status || generation !== review_generation || !layer) {
          return;
        }
        show_ready('', false);
        set_status(error.message || i18n.review_error || '', true, 'error');
      }).always(function () {
        if (review_request === pending_request) {
          review_request = null;
        }
      });
      review_request = pending_request;
    }

    /**
     * Return one safe canonical-readback failure message.
     *
     * @param {*} readback_error Rejection value from the Inspector adapter.
     *
     * @return {string} Safe localized or adapter-provided message.
     */
    function get_readback_error_message(readback_error) {
      if (readback_error && 'string' === typeof readback_error.message && readback_error.message) {
        return readback_error.message;
      }
      return i18n.readback_error || i18n.apply_error || '';
    }

    /**
     * Ask the Inspector to reread and render the authoritative booking.
     *
     * The Date Editor keeps its dirty review state until this asynchronous
     * boundary resolves with the canonical Inspector DTO. A rejected readback
     * never renders the apply response as booking state, and Retry refresh
     * repeats only this read instead of submitting the signed mutation again.
     *
     * @param {Object} submitted_review Signed review displayed during apply.
     *
     * @return {void}
     */
    function request_canonical_readback(submitted_review) {
      var callback_result;
      var generation;
      if (!pending_apply_result || 'function' !== typeof controller_options.on_applied) {
        render_review(submitted_review);
        set_status(i18n.readback_error || i18n.apply_error || '', true, 'error');
        return;
      }
      apply_generation += 1;
      generation = apply_generation;
      show_loading(i18n.refreshing_booking || i18n.loading_dates || '');
      try {
        callback_result = controller_options.on_applied(pending_apply_result);
      } catch (readback_exception) {
        callback_result = null;
      }
      if (!callback_result || 'function' !== typeof callback_result.then && 'function' !== typeof callback_result.done) {
        render_review(submitted_review);
        set_status(i18n.readback_error || i18n.apply_error || '', true, 'error');
        return;
      }
      window.jQuery.when(callback_result).done(function (canonical_booking) {
        if (generation !== apply_generation || !layer || !canonical_booking || Number(canonical_booking.booking_id || 0) !== Number(pending_apply_result.booking_id || 0)) {
          return;
        }
        pending_apply_result = null;
        dirty = false;
        close(true, true);
      }).fail(function (readback_error) {
        if (generation !== apply_generation || !layer) {
          return;
        }
        render_review(submitted_review);
        set_status(get_readback_error_message(readback_error), true, 'error');
      });
    }

    /**
     * Apply the currently displayed signed review through the domain endpoint.
     *
     * Only the server-issued plan and signature are submitted. The mutable
     * browser draft and native calendar selection are intentionally omitted.
     *
     * @return {void}
     */
    function request_apply() {
      var generation;
      var pending_request;
      var submitted_review = active_review;
      if (pending_apply_result) {
        request_canonical_readback(submitted_review);
        return;
      }
      if (!submitted_review || !submitted_review.plan || !submitted_review.token || !active_editor || !controller_options.url || !controller_options.source || !apply_settings.action || !apply_settings.nonce) {
        set_status(i18n.apply_error || '', true, 'error');
        return;
      }
      apply_generation += 1;
      generation = apply_generation;
      if (apply_request && 'function' === typeof apply_request.abort) {
        apply_request.abort();
      }
      show_loading(i18n.applying_changes || '');
      pending_request = window.jQuery.ajax({
        url: controller_options.url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: apply_settings.action,
          nonce: apply_settings.nonce,
          booking_id: active_editor.booking_id,
          source: controller_options.source,
          plan: JSON.stringify(submitted_review.plan),
          token: submitted_review.token,
          send_modified_email: 'function' === typeof controller_options.get_send_modified_email_intent && controller_options.get_send_modified_email_intent() ? 1 : 0
        }
      }).done(function (response) {
        var apply_result;
        if (generation !== apply_generation) {
          return;
        }
        if (!response || !response.success || !response.data || !response.data.canonical) {
          render_review(submitted_review);
          set_status(i18n.apply_error || '', true, 'error');
          return;
        }
        apply_result = response.data;
        pending_apply_result = apply_result;
        request_canonical_readback(submitted_review);
      }).fail(function (failed_request, request_status) {
        var error = failed_request.responseJSON && failed_request.responseJSON.data ? failed_request.responseJSON.data : {};
        if ('abort' === request_status || generation !== apply_generation || !layer) {
          return;
        }
        render_review(submitted_review);
        set_status(error.message || i18n.apply_error || '', true, 'error');
      }).always(function () {
        if (apply_request === pending_request) {
          apply_request = null;
        }
      });
      apply_request = pending_request;
    }

    /**
     * Open the Date Editor for one Inspector-authorized booking.
     *
     * @param {HTMLElement} trigger         Change dates button.
     * @param {Object}      booking_context Booking identifier from the loaded Inspector DTO.
     *
     * @return {boolean} True when opening began.
     */
    function open(trigger, booking_context) {
      var booking_id = booking_context ? normalize_booking_id(booking_context.booking_id) : 0;
      if (!booking_id || !close(false, false)) {
        return false;
      }
      opener = trigger;
      active_editor = {
        booking_id: booking_id
      };
      if (!render_layer({
        i18n: i18n
      })) {
        return false;
      }
      show_loading(i18n.loading_dates || '');
      window.requestAnimationFrame(function () {
        if (layer) {
          layer.focus();
        }
      });
      request_editor();
      return true;
    }

    /**
     * Synchronize the visible controls from the mutable browser draft.
     *
     * @return {void}
     */
    function synchronize_controls_from_draft() {
      if (!layer || !draft) {
        return;
      }
      Array.prototype.forEach.call(layer.querySelectorAll('[data-wpbc-booking-date-editor-selection-method]'), function (control) {
        control.checked = draft.selection_method === control.value;
      });
      Array.prototype.forEach.call(layer.querySelectorAll('[data-wpbc-booking-date-editor-time-application]'), function (control) {
        control.checked = draft.time_application === control.value;
      });
      Array.prototype.forEach.call(layer.querySelectorAll('[data-wpbc-booking-date-editor-time]'), function (control) {
        control.value = draft[control.getAttribute('data-wpbc-booking-date-editor-time')] || '';
      });
    }

    /**
     * Handle secondary-layer buttons without leaking behavior into Inspector.
     *
     * @param {MouseEvent} event Inspector-shell click event.
     *
     * @return {void}
     */
    function handle_click(event) {
      var reset_button;
      var review_button;
      var back_button;
      var apply_button;
      var mode_was_restored;
      var dates_were_restored;
      if (!layer || !layer.contains(event.target)) {
        return;
      }
      if (event.target.closest('[data-wpbc-booking-date-editor-close]')) {
        event.preventDefault();
        close(true, false);
        return;
      }
      if (event.target.closest('[data-wpbc-booking-date-editor-retry]')) {
        event.preventDefault();
        request_editor();
        return;
      }
      review_button = event.target.closest('[data-wpbc-booking-date-editor-review]');
      if (review_button && !review_button.disabled) {
        event.preventDefault();
        request_review();
        return;
      }
      back_button = event.target.closest('[data-wpbc-booking-date-editor-back]');
      if (back_button) {
        event.preventDefault();
        show_editor_from_review();
        return;
      }
      apply_button = event.target.closest('[data-wpbc-booking-date-editor-apply]');
      if (apply_button && !apply_button.disabled) {
        event.preventDefault();
        request_apply();
        return;
      }
      reset_button = event.target.closest('[data-wpbc-booking-date-editor-reset]');
      if (reset_button && saved_draft && draft && native_adapter) {
        event.preventDefault();
        active_review = null;
        draft = clone_editor_draft(saved_draft);
        mode_was_restored = native_adapter.set_selection_mode(draft.selection_method);
        dates_were_restored = mode_was_restored && native_adapter.set_exact_selected_dates(draft.selected_dates);
        synchronize_controls_from_draft();
        render_draft_state();
        set_status(dates_were_restored ? i18n.calendar_loaded || '' : i18n.hydration_warning || '', !dates_were_restored);
      }
    }

    /**
     * Synchronize native mode and time controls into the browser draft.
     *
     * @param {Event} event Inspector-shell change/input event.
     *
     * @return {void}
     */
    function handle_change(event) {
      var selection_control;
      var time_application_control;
      var time_control;
      var requested_selection_method;
      var time_control_key;
      if (!layer || !layer.contains(event.target) || !draft) {
        return;
      }
      selection_control = event.target.closest('[data-wpbc-booking-date-editor-selection-method]');
      time_application_control = event.target.closest('[data-wpbc-booking-date-editor-time-application]');
      time_control = event.target.closest('[data-wpbc-booking-date-editor-time]');
      if (selection_control) {
        requested_selection_method = MODE_INDIVIDUAL === selection_control.value ? MODE_INDIVIDUAL : MODE_POLICY;
        if (native_adapter && !native_adapter.set_selection_mode(requested_selection_method)) {
          synchronize_controls_from_draft();
          set_status(i18n.hydration_warning || '', true);
          return;
        }
        draft.selection_method = requested_selection_method;
        draft.selected_dates = native_adapter ? native_adapter.get_selected_dates() : draft.selected_dates;
      } else if (time_application_control) {
        draft.time_application = -1 !== [TIME_APPLICATION_FULL_DAY, TIME_APPLICATION_BOUNDARY, TIME_APPLICATION_PER_DATE].indexOf(time_application_control.value) ? time_application_control.value : TIME_APPLICATION_FULL_DAY;
      } else if (time_control) {
        time_control_key = time_control.getAttribute('data-wpbc-booking-date-editor-time');
        if (-1 === ['start_time', 'end_time'].indexOf(time_control_key)) {
          return;
        }
        draft[time_control_key] = normalize_exact_minute_time(time_control.value);
      } else {
        return;
      }
      active_review = null;
      render_draft_state();
    }

    /**
     * Close only the secondary layer on Escape before the parent shell sees it.
     *
     * @param {KeyboardEvent} event Inspector-shell keyboard event.
     *
     * @return {void}
     */
    function handle_keydown(event) {
      if ('Escape' !== event.key || !layer) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      close(true, false);
    }
    inspector_shell.addEventListener('click', handle_click);
    inspector_shell.addEventListener('change', handle_change);
    inspector_shell.addEventListener('input', handle_change);
    inspector_shell.addEventListener('keydown', handle_keydown, true);
    return {
      open: open,
      is_open: function () {
        return Boolean(layer);
      },
      is_dirty: function () {
        return dirty;
      },
      confirm_discard: function () {
        return !dirty || window.confirm(i18n.discard_changes || '');
      },
      prepare_for_parent_switch: function () {
        return close(false, false);
      },
      force_close: function () {
        close(false, true);
      },
      destroy: function () {
        close(false, true);
        inspector_shell.removeEventListener('click', handle_click);
        inspector_shell.removeEventListener('change', handle_change);
        inspector_shell.removeEventListener('input', handle_change);
        inspector_shell.removeEventListener('keydown', handle_keydown, true);
      }
    };
  }
  window.wpbc_booking_date_editor = window.wpbc_booking_date_editor || {};
  window.wpbc_booking_date_editor.create_native_calendar_adapter = create_native_calendar_adapter;
  window.wpbc_booking_date_editor.create_controller = create_controller;
})(window, document, jQuery);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvYm9va2luZy1kYXRlLWVkaXRvci9fb3V0L2Jvb2tpbmctZGF0ZS1lZGl0b3IuanMiLCJuYW1lcyI6WyJ3aW5kb3ciLCJkb2N1bWVudCIsIiQiLCJFVkVOVF9OQU1FU1BBQ0UiLCJBSkFYX0NBUFRVUkVfTkFNRVNQQUNFIiwiTU9ERV9JTkRJVklEVUFMIiwiTU9ERV9QT0xJQ1kiLCJUSU1FX0FQUExJQ0FUSU9OX0ZVTExfREFZIiwiVElNRV9BUFBMSUNBVElPTl9CT1VOREFSWSIsIlRJTUVfQVBQTElDQVRJT05fUEVSX0RBVEUiLCJOQVRJVkVfTE9BRF9USU1FT1VUX01TIiwiYWN0aXZlX2FkYXB0ZXIiLCJjYWxlbmRhcl9wYXJhbWV0ZXJfbmFtZXMiLCJvdGhlcl9wYXJhbWV0ZXJfbmFtZXMiLCJzZWN1cmVfcGFyYW1ldGVyX25hbWVzIiwicmVxdWVzdF9wYXJhbWV0ZXJfbmFtZXMiLCJub3JtYWxpemVfcmVzb3VyY2VfaWQiLCJyZXNvdXJjZV9pZCIsInBhcnNlSW50Iiwibm9ybWFsaXplX2Jvb2tpbmdfaWQiLCJib29raW5nX2lkIiwicGFyc2VfaXNvX2RhdGUiLCJpc29fZGF0ZSIsImRhdGVfbWF0Y2giLCJTdHJpbmciLCJtYXRjaCIsInBhcnNlZF9kYXRlIiwiRGF0ZSIsImdldEZ1bGxZZWFyIiwiZ2V0TW9udGgiLCJnZXREYXRlIiwiZm9ybWF0X2lzb19kYXRlIiwic2VsZWN0ZWRfZGF0ZSIsInllYXIiLCJtb250aCIsImRheSIsImlzTmFOIiwiZ2V0VGltZSIsImxlbmd0aCIsIm5vcm1hbGl6ZV9pc29fZGF0ZXMiLCJzZWxlY3RlZF9kYXRlcyIsInVuaXF1ZV9kYXRlcyIsIkFycmF5IiwiaXNBcnJheSIsImZvckVhY2giLCJub3JtYWxpemVkX2RhdGUiLCJPYmplY3QiLCJrZXlzIiwic29ydCIsIm5vcm1hbGl6ZV9leGFjdF9taW51dGVfdGltZSIsInRpbWVfdmFsdWUiLCJ0ZXN0Iiwibm9ybWFsaXplX2NhbGVuZGFyX3BhcmFtZXRlcnMiLCJjYWxlbmRhcl9wYXJhbWV0ZXJzIiwibm9ybWFsaXplZF9wYXJhbWV0ZXJzIiwicGFyYW1ldGVyX25hbWUiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJub3JtYWxpemVfc2NhbGFyX3BhcmFtZXRlcnMiLCJjYW5kaWRhdGVfdmFsdWVzIiwiYWxsb3dlZF9uYW1lcyIsIm5vcm1hbGl6ZWRfdmFsdWVzIiwicGFyYW1ldGVyX3ZhbHVlIiwiaW5kZXhPZiIsImNsZWFyX2hvc3QiLCJob3N0IiwiZmlyc3RDaGlsZCIsInJlbW92ZUNoaWxkIiwiY2FwdHVyZV9uYXRpdmVfY2FsZW5kYXJfcmVnaXN0cnlfZW50cnkiLCJjYWxlbmRhcnMiLCJyZWdpc3RyeV9rZXkiLCJyZWdpc3RyeV9lbnRyeSIsInBhcmFtZXRlcnMiLCJfd3BiYyIsImNhbGVuZGFyc19hbGxfX2dldCIsImtleSIsImV4aXN0ZWQiLCJyZXN0b3JlX25hdGl2ZV9jYWxlbmRhcl9yZWdpc3RyeV9lbnRyeSIsInJlZ2lzdHJ5X3NuYXBzaG90IiwiY2FsZW5kYXJzX2FsbF9fc2V0IiwiY3JlYXRlX25hdGl2ZV9jYWxlbmRhcl9hZGFwdGVyIiwibG9hZF9nZW5lcmF0aW9uIiwicGVuZGluZ19jYWxlbmRhcl9yZXF1ZXN0IiwicG9saWN5X3BhcmFtZXRlcnMiLCJjYWxlbmRhcl9yZWdpc3RyeV9zbmFwc2hvdCIsInByZXZpb3VzX290aGVyX3BhcmFtZXRlcnMiLCJwcmV2aW91c19zZWN1cmVfcGFyYW1ldGVycyIsImhhc19uYXRpdmVfYXBpIiwiQm9vbGVhbiIsImNhbGVuZGFyX19zZXRfcGFyYW1ldGVycyIsImNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUiLCJzZXRfb3RoZXJfcGFyYW0iLCJnZXRfb3RoZXJfcGFyYW0iLCJzZXRfc2VjdXJlX3BhcmFtIiwiZ2V0X3NlY3VyZV9wYXJhbSIsIndwYmNfY2FsZW5kYXJfc2hvdyIsIndwYmNfY2FsZW5kYXJfX2xvYWRfZGF0YV9fYWp4Iiwid3BiY19jYWxlbmRhcl9fZ2V0X2luc3QiLCJkYXRlcGljayIsIl9mb3JtYXREYXRlIiwiX3VwZGF0ZURhdGVwaWNrIiwiYXBwbHlfc2VjdXJlX3BhcmFtZXRlcnMiLCJzZWN1cmVfcGFyYW1ldGVycyIsImFwcGx5X2NhbGVuZGFyX3BhcmFtZXRlcnMiLCJhcHBseV9jb250ZXh0X3BhcmFtZXRlcnMiLCJjb250ZXh0X3BhcmFtZXRlcnMiLCJnZXRfc2VsZWN0ZWRfZGF0ZXMiLCJjYWxlbmRhcl9pbnN0YW5jZSIsIndwYmNfZ2V0X19zZWxlY3RlZF9kYXRlc19zcWxfX2FzX2FyciIsImRhdGVzIiwibWFwIiwic2V0X2V4YWN0X3NlbGVjdGVkX2RhdGVzIiwibm9ybWFsaXplZF9kYXRlcyIsIm5hdGl2ZV9kYXRlcyIsImhpZGRlbl9kYXRlX2ZpZWxkIiwiYXBwbGllZF9kYXRlcyIsImZpbHRlciIsImdldEVsZW1lbnRCeUlkIiwic3RheU9wZW4iLCJ2YWx1ZSIsImpvaW4iLCJ3cGJjX2NhbGVuZGFyX19zY3JvbGxfdG8iLCJtb3VudCIsImNhbGVuZGFyX2hvc3QiLCJtb3VudF9jb25maWd1cmF0aW9uIiwicmVxdWVzdGVkX3Jlc291cmNlX2lkIiwiZXhpc3RpbmdfY2FsZW5kYXIiLCJub2RlVHlwZSIsImNhbGVuZGFyX2h0bWwiLCJjb250YWlucyIsImFkYXB0ZXJfYXBpIiwiaW5uZXJIVE1MIiwidGVhcmRvd24iLCJsb2FkIiwicmVxdWVzdF9wYXJhbWV0ZXJzIiwib25fbG9hZGVkIiwib25fZmFpbGVkIiwiY3VycmVudF9nZW5lcmF0aW9uIiwibm9ybWFsaXplZF9yZXF1ZXN0IiwiY2FwdHVyZV9oYW5kbGVyIiwiYWJvcnRfbG9hZCIsIm9mZiIsIm9uIiwiZXZlbnQiLCJsb2FkZWRfcmVzb3VyY2VfaWQiLCJyZWFkeVN0YXRlIiwianFfeGhyIiwiYWpheF9zZXR0aW5ncyIsInJlcXVlc3RfYm9keSIsImRhdGEiLCJkZWNvZGVkX2JvZHkiLCJkZWNvZGVVUklDb21wb25lbnQiLCJyZXBsYWNlIiwiZGVjb2RlX2Vycm9yIiwiUmVnRXhwIiwiZmFpbCIsImZhaWxlZF9yZXF1ZXN0IiwicmVxdWVzdF9zdGF0dXMiLCJiYWxhbmNlcl9fcmVtb3ZlX2Zyb21fX3dhaXRfbGlzdCIsImFib3J0Iiwic2V0X3NlbGVjdGlvbl9tb2RlIiwic2VsZWN0aW9uX21vZGUiLCJ3cGJjX2NhbF9kYXlzX3NlbGVjdF9fbXVsdGlwbGUiLCJ3cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmVfaW5pdCIsIndwYmNfY2FsX19yZV9pbml0IiwiY2FsZW5kYXJfZWxlbWVudCIsImZuIiwiZGVzdHJveV9lcnJvciIsImNsb25lX2VkaXRvcl9kcmFmdCIsImVkaXRvcl9kcmFmdCIsInNlbGVjdGlvbl9tZXRob2QiLCJ0aW1lX2FwcGxpY2F0aW9uIiwic3RhcnRfdGltZSIsImVuZF90aW1lIiwiZnJlZXplX2VkaXRvcl9kcmFmdCIsImZyb3plbl9kcmFmdCIsImZyZWV6ZSIsImdldF9lZmZlY3RpdmVfZWRpdG9yX2RyYWZ0IiwiZWZmZWN0aXZlX2RyYWZ0IiwiZm9ybWF0X2VkaXRvcl90aW1lX2xhYmVsIiwibGFiZWxfdGVtcGxhdGUiLCJ0aW1lX3ZhbHVlcyIsImZvcm1hdHRlZF9sYWJlbCIsInRpbWVfaW5kZXgiLCJjcmVhdGVfY29udHJvbGxlciIsImluc3BlY3Rvcl9zaGVsbCIsImNvbmZpZ3VyYXRpb24iLCJvcHRpb25zIiwic2V0dGluZ3MiLCJjb250cm9sbGVyX29wdGlvbnMiLCJpMThuIiwicmVhZF9zZXR0aW5ncyIsInJlYWQiLCJyZXZpZXdfc2V0dGluZ3MiLCJyZXZpZXciLCJhcHBseV9zZXR0aW5ncyIsImFwcGx5IiwidGVtcGxhdGUiLCJ3cCIsInRlbXBsYXRlX2lkIiwicmV2aWV3X3RlbXBsYXRlIiwicmV2aWV3X3RlbXBsYXRlX2lkIiwiaW5zcGVjdG9yX3BhbmVsIiwicXVlcnlTZWxlY3RvciIsImxheWVyIiwib3BlbmVyIiwicmVhZF9yZXF1ZXN0IiwicmV2aWV3X3JlcXVlc3QiLCJhcHBseV9yZXF1ZXN0IiwibmF0aXZlX2FkYXB0ZXIiLCJhY3RpdmVfZWRpdG9yIiwiYWN0aXZlX3JldmlldyIsInBlbmRpbmdfYXBwbHlfcmVzdWx0Iiwic2F2ZWRfZHJhZnQiLCJkcmFmdCIsImNvbnRyb2xsZXJfZ2VuZXJhdGlvbiIsInJldmlld19nZW5lcmF0aW9uIiwiYXBwbHlfZ2VuZXJhdGlvbiIsIm5hdGl2ZV9sb2FkX3RpbWVyIiwiZGlydHkiLCJhY3RpdmUiLCJqUXVlcnkiLCJzZXRfc3RhdHVzIiwibWVzc2FnZSIsInNob3dfdmlzdWFsbHkiLCJzdGF0dXNfdHlwZSIsInN0YXR1cyIsImlzX3Zpc2libGUiLCJub3JtYWxpemVkX3N0YXR1c190eXBlIiwidGV4dENvbnRlbnQiLCJjbGFzc0xpc3QiLCJ0b2dnbGUiLCJyZW1vdmUiLCJzZXRBdHRyaWJ1dGUiLCJvZmZzZXRXaWR0aCIsImFkZCIsInNob3dfbG9hZGluZyIsImxvYWRpbmciLCJsb2FkaW5nX2xhYmVsIiwiZXJyb3JfYm94IiwiZWRpdG9yX3ZpZXciLCJyZXZpZXdfdmlldyIsImhpZGRlbiIsImxvYWRpbmdfZGF0ZXMiLCJjbGVhcl9uYXRpdmVfbG9hZF90aW1lciIsImNsZWFyVGltZW91dCIsInVwZGF0ZV9kaXJ0eV9zdGF0ZSIsIm5leHRfZGlydHkiLCJKU09OIiwic3RyaW5naWZ5Iiwib25fZGlydHlfY2hhbmdlIiwidGVhcmRvd25fbGF5ZXIiLCJnZXRfcmVzdG9yZV9mb2N1c190YXJnZXQiLCJmYWxsYmFja19mb2N1cyIsImlzQ29ubmVjdGVkIiwiZm9jdXMiLCJnZXRfcmVzdG9yZV9mb2N1cyIsImNsb3NlIiwicmVzdG9yZV9mb2N1cyIsImZvcmNlIiwiZm9jdXNfdGFyZ2V0IiwiY29uZmlybSIsImRpc2NhcmRfY2hhbmdlcyIsInNldFRpbWVvdXQiLCJyZW5kZXJfbGF5ZXIiLCJ0ZW1wbGF0ZV92YWx1ZXMiLCJyZW5kZXJfaG9zdCIsImNyZWF0ZUVsZW1lbnQiLCJyZW5kZXJlZF9sYXllciIsInJlc3RvcmVfbGF5ZXJfZm9jdXMiLCJhY3RpdmVFbGVtZW50IiwiYXNzaWduIiwiaW5zcGVjdG9yX2lkIiwiYXBwZW5kQ2hpbGQiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJzaG93X2Vycm9yIiwiYWxsb3dfcmV0cnkiLCJlcnJvcl9tZXNzYWdlIiwicmV0cnlfYnV0dG9uIiwibG9hZF9lcnJvciIsInNob3dfcmVhZHkiLCJkaXNwbGF5X3dhcm5pbmciLCJpc19kcmFmdF9yZXZpZXdhYmxlIiwicmVuZGVyX2RyYWZ0X3N0YXRlIiwidGltZV9maWVsZHMiLCJ0aW1lX2hlbHAiLCJ0aW1lX2NvbnRyb2xzIiwicXVlcnlTZWxlY3RvckFsbCIsInNlbGVjdGVkX2xpc3QiLCJzZWxlY3RlZF9vdXRwdXQiLCJjYWxlbmRhcl9vdXRwdXQiLCJuaWdodHNfb3V0cHV0IiwidGltZV9vdXRwdXQiLCJyZXZpZXdfYnV0dG9uIiwiaXNfZnVsbF9kYXkiLCJ0aW1lX2ludGVydmFsIiwidGltZV9jb250cm9sIiwiZGlzYWJsZWQiLCJNYXRoIiwibWF4IiwiZnVsbF9kYXkiLCJmdWxsX2RheXMiLCJlbXB0eV9lbnRyeSIsImNsYXNzTmFtZSIsIm5vX3NlbGVjdGVkX2RhdGVzIiwiZGF0ZV9pbmRleCIsImRhdGVfZW50cnkiLCJkYXRlX3ZhbHVlIiwiZGF0ZV9tZXRhIiwiaXNfZmlyc3RfZGF0ZSIsImlzX2xhc3RfZGF0ZSIsInN0YXJ0c19hdF90aW1lIiwiZW5kc19hdF90aW1lIiwiaHlkcmF0ZV9kcmFmdF9kYXRlcyIsImdlbmVyYXRpb24iLCJhdHRlbXB0IiwiaHlkcmF0aW9uX2NvbXBsZXRlIiwiY2FsZW5kYXJfbG9hZGVkIiwiY29udHJvbCIsImNoZWNrZWQiLCJzbGljZSIsImh5ZHJhdGlvbl93YXJuaW5nIiwibW91bnRfbmF0aXZlX2NhbGVuZGFyIiwiY2FsZW5kYXIiLCJodG1sIiwiY2FsZW5kYXJfZXJyb3IiLCJzZWxlY3RlZF9yZXNvdXJjZV9pZCIsImNsaWNrZWRfZGF0ZXMiLCJsb2FkaW5nX2NhbGVuZGFyIiwiaW5pdGlhbGl6ZV9lZGl0b3IiLCJlZGl0b3JfZHRvIiwiaW5pdGlhbCIsInN1cHBvcnRlZCIsImZhbGxiYWNrIiwidW5zdXBwb3J0ZWRfZGF0ZXMiLCJyZXF1ZXN0X2VkaXRvciIsInBlbmRpbmdfcmVxdWVzdCIsInVybCIsInNvdXJjZSIsImFjdGlvbiIsIm5vbmNlIiwiYWpheCIsIm1ldGhvZCIsImRhdGFUeXBlIiwiZG9uZSIsInJlc3BvbnNlIiwic3VjY2VzcyIsImVkaXRvciIsImVycm9yIiwicmVzcG9uc2VKU09OIiwiYWx3YXlzIiwicmVuZGVyX3JldmlldyIsInJldmlld19yZXNwb25zZSIsInJldmlld19jb250ZW50IiwicmV2aWV3X3RpdGxlIiwiYmFja19idXR0b24iLCJhcHBseV9idXR0b24iLCJwbGFuIiwidG9rZW4iLCJleHBpcmVzX2F0IiwicmV2aWV3X2Vycm9yIiwicmV0cnlfcmVhZGJhY2siLCJyZXRyeSIsImFwcGx5X2NoYW5nZXMiLCJzaG93X2VkaXRvcl9mcm9tX3JldmlldyIsInJlYWRiYWNrX2Vycm9yIiwiYXBwbHlfZXJyb3IiLCJyZXF1ZXN0X3JldmlldyIsInNvdXJjZV9maW5nZXJwcmludCIsImxvYWRpbmdfcmV2aWV3IiwicHJvcG9zYWwiLCJnZXRfcmVhZGJhY2tfZXJyb3JfbWVzc2FnZSIsInJlcXVlc3RfY2Fub25pY2FsX3JlYWRiYWNrIiwic3VibWl0dGVkX3JldmlldyIsImNhbGxiYWNrX3Jlc3VsdCIsIm9uX2FwcGxpZWQiLCJyZWZyZXNoaW5nX2Jvb2tpbmciLCJyZWFkYmFja19leGNlcHRpb24iLCJ0aGVuIiwid2hlbiIsImNhbm9uaWNhbF9ib29raW5nIiwiTnVtYmVyIiwicmVxdWVzdF9hcHBseSIsImFwcGx5aW5nX2NoYW5nZXMiLCJzZW5kX21vZGlmaWVkX2VtYWlsIiwiZ2V0X3NlbmRfbW9kaWZpZWRfZW1haWxfaW50ZW50IiwiYXBwbHlfcmVzdWx0IiwiY2Fub25pY2FsIiwib3BlbiIsInRyaWdnZXIiLCJib29raW5nX2NvbnRleHQiLCJzeW5jaHJvbml6ZV9jb250cm9sc19mcm9tX2RyYWZ0IiwiZ2V0QXR0cmlidXRlIiwiaGFuZGxlX2NsaWNrIiwicmVzZXRfYnV0dG9uIiwibW9kZV93YXNfcmVzdG9yZWQiLCJkYXRlc193ZXJlX3Jlc3RvcmVkIiwidGFyZ2V0IiwiY2xvc2VzdCIsInByZXZlbnREZWZhdWx0IiwiaGFuZGxlX2NoYW5nZSIsInNlbGVjdGlvbl9jb250cm9sIiwidGltZV9hcHBsaWNhdGlvbl9jb250cm9sIiwicmVxdWVzdGVkX3NlbGVjdGlvbl9tZXRob2QiLCJ0aW1lX2NvbnRyb2xfa2V5IiwiaGFuZGxlX2tleWRvd24iLCJzdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24iLCJhZGRFdmVudExpc3RlbmVyIiwiaXNfb3BlbiIsImlzX2RpcnR5IiwiY29uZmlybV9kaXNjYXJkIiwicHJlcGFyZV9mb3JfcGFyZW50X3N3aXRjaCIsImZvcmNlX2Nsb3NlIiwiZGVzdHJveSIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJ3cGJjX2Jvb2tpbmdfZGF0ZV9lZGl0b3IiXSwic291cmNlcyI6WyJpbmNsdWRlcy9ib29raW5nLWRhdGUtZWRpdG9yL19zcmMvYm9va2luZy1kYXRlLWVkaXRvci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEJvb2tpbmcgRGF0ZSBFZGl0b3IgbmF0aXZlLWNhbGVuZGFyIGFkYXB0ZXIuXG4gKlxuICogVGhlIGNvbnRyb2xsZXIgb3BlbnMgb25seSBmcm9tIGFuIGF1dGhvcml6ZWQgQm9va2luZyBJbnNwZWN0b3IgRFRPLiBJdCBhc2tzXG4gKiB0aGUgRGF0ZSBFZGl0b3IgcmVhZCBlbmRwb2ludCBmb3IgY2Fub25pY2FsIGNhbGVuZGFyIG1hcmt1cCBhbmQgYm91bmRlZFxuICogaW5pdGlhbGl6YXRpb24gdmFsdWVzLCB0aGVuIGRlbGVnYXRlcyBib29raW5ncyBhbmQgYXZhaWxhYmlsaXR5IGxvYWRpbmcgdG9cbiAqIHRoZSBzdGFuZGFyZCBuYXRpdmUgY2FsZW5kYXIgcmVxdWVzdC5cbiAqXG4gKiBOYXRpdmUgV1BCQyBBUElzIHVzZWQgaGVyZTpcbiAqXG4gKiAtIGB3aW5kb3cuX3dwYmNgIHN0b3JlcyB0aGUgc3RhbmRhcmQgY2FsZW5kYXIgYW5kIHBhZ2UgcGFyYW1ldGVycy5cbiAqIC0gYHdpbmRvdy53cGJjX2NhbGVuZGFyX3Nob3coKWAgaW5pdGlhbGl6ZXMgdGhlIGV4aXN0aW5nIGRhdGVwaWNrZXIuXG4gKiAtIGB3aW5kb3cud3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hangoKWAgcmVxdWVzdHMgY2Fub25pY2FsIGJvb2tpbmdzIGFuZFxuICogICB1bmF2YWlsYWJsZSBkYXRlcyB0aHJvdWdoIGBXUEJDX0FKWF9DQUxFTkRBUl9MT0FEYC5cbiAqIC0gYHdpbmRvdy53cGJjX2NhbGVuZGFyX19nZXRfaW5zdCgpYCByZXR1cm5zIHRoZSBtb3VudGVkIGRhdGVwaWNrIGluc3RhbmNlLlxuICogLSBgd2luZG93LndwYmNfZ2V0X19zZWxlY3RlZF9kYXRlc19zcWxfX2FzX2FycigpYCByZXR1cm5zIGV2ZXJ5IGNhbm9uaWNhbFxuICogICBzZWxlY3RlZCBkYXRlLCBpbmNsdWRpbmcgdGhlIG1pZGRsZSBkYXRlcyByZXByZXNlbnRlZCBvbmx5IGluIHRoZSBoaWRkZW5cbiAqICAgZmllbGQgYnkgbmF0aXZlIGR5bmFtaWMtcmFuZ2UgbW9kZS5cbiAqIC0gYHdpbmRvdy53cGJjX2NhbF9kYXlzX3NlbGVjdF9fbXVsdGlwbGUoKWAgZW5hYmxlcyBuYXRpdmUgaW5kaXZpZHVhbC1kYXRlXG4gKiAgIHNlbGVjdGlvbi5cbiAqIC0gYHdpbmRvdy53cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmVfaW5pdCgpYCBhbmRcbiAqICAgYHdpbmRvdy53cGJjX2NhbF9fcmVfaW5pdCgpYCBhcHBseSByZXN0b3JlZCBuYXRpdmUgcG9saWN5IHBhcmFtZXRlcnMuXG4gKiAtIGB3aW5kb3cud3BiY19jYWxlbmRhcl9fc2Nyb2xsX3RvKClgIGRpc3BsYXlzIHRoZSBmaXJzdCBzZWxlY3RlZCBtb250aC5cbiAqIC0gYHdpbmRvdy5fd3BiYy5iYWxhbmNlcl9fcmVtb3ZlX2Zyb21fX3dhaXRfbGlzdCgpYCByZW1vdmVzIGEgcXVldWVkIG5hdGl2ZVxuICogICBsb2FkIHRoYXQgaGFzIG5vdCBjcmVhdGVkIGEgY2FuY2VsbGFibGUgcmVxdWVzdCB5ZXQuXG4gKiAtIGBqUXVlcnkuZGF0ZXBpY2suX2Zvcm1hdERhdGUoKWAgYW5kIGBfdXBkYXRlRGF0ZXBpY2soKWAgc3luY2hyb25pemUgdGhlXG4gKiAgIGV4aXN0aW5nIGluc3RhbmNlIHdpdGhvdXQgc2ltdWxhdGluZyBjbGlja3Mgb3IgY2hhbmdpbmcgYXZhaWxhYmlsaXR5LlxuICpcbiAqIEBwYWNrYWdlIEJvb2tpbmcgQ2FsZW5kYXJcbiAqIEBzaW5jZSAgIDEyLjAuMFxuICovXG5cbiggZnVuY3Rpb24gKCB3aW5kb3csIGRvY3VtZW50LCAkICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIEVWRU5UX05BTUVTUEFDRSA9ICcud3BiY0Jvb2tpbmdEYXRlRWRpdG9yJztcblx0dmFyIEFKQVhfQ0FQVFVSRV9OQU1FU1BBQ0UgPSAnLndwYmNCb29raW5nRGF0ZUVkaXRvckFqYXgnO1xuXHR2YXIgTU9ERV9JTkRJVklEVUFMID0gJ2luZGl2aWR1YWwnO1xuXHR2YXIgTU9ERV9QT0xJQ1kgPSAncG9saWN5Jztcblx0dmFyIFRJTUVfQVBQTElDQVRJT05fRlVMTF9EQVkgPSAnZnVsbF9kYXknO1xuXHR2YXIgVElNRV9BUFBMSUNBVElPTl9CT1VOREFSWSA9ICdib3VuZGFyeSc7XG5cdHZhciBUSU1FX0FQUExJQ0FUSU9OX1BFUl9EQVRFID0gJ3Blcl9kYXRlJztcblx0dmFyIE5BVElWRV9MT0FEX1RJTUVPVVRfTVMgPSAyMDAwMDtcblx0dmFyIGFjdGl2ZV9hZGFwdGVyID0gbnVsbDtcblx0dmFyIGNhbGVuZGFyX3BhcmFtZXRlcl9uYW1lcyA9IFtcblx0XHQnaXNfZW5hYmxlZF9jaGFuZ2Vfb3ZlcicsXG5cdFx0J2NhbGVuZGFyX3Njcm9sbF90bycsXG5cdFx0J2NhbGVuZGFyX2RhdGVzX3N0YXJ0Jyxcblx0XHQnY2FsZW5kYXJfZGF0ZXNfZW5kJyxcblx0XHQnYm9va2luZ19tYXhfbW9udGhlc19pbl9jYWxlbmRhcicsXG5cdFx0J2Jvb2tpbmdfc3RhcnRfZGF5X3dlZWVrJyxcblx0XHQnY2FsZW5kYXJfbnVtYmVyX29mX21vbnRocycsXG5cdFx0J2RheXNfc2VsZWN0X21vZGUnLFxuXHRcdCdmaXhlZF9fZGF5c19udW0nLFxuXHRcdCdmaXhlZF9fd2Vla19kYXlzX19zdGFydCcsXG5cdFx0J2R5bmFtaWNfX2RheXNfbWluJyxcblx0XHQnZHluYW1pY19fZGF5c19tYXgnLFxuXHRcdCdkeW5hbWljX19kYXlzX3NwZWNpZmljJyxcblx0XHQnZHluYW1pY19fd2Vla19kYXlzX19zdGFydCcsXG5cdFx0J3JhbmdlX3NlbGVjdGlvbl9ndWlkYW5jZV9pc19lbmFibGVkJyxcblx0XHQnYm9va2luZ19kYXRlX2Zvcm1hdCcsXG5cdFx0J2Jvb2tpbmdfdGltZV9mb3JtYXQnLFxuXHRcdCdpc19wYXJlbnRfcmVzb3VyY2UnLFxuXHRcdCdib29raW5nX2NhcGFjaXR5X2ZpZWxkJyxcblx0XHQnYm9va2luZ19pc19kaXNzYmFsZV9ib29raW5nX2Zvcl9kaWZmZXJlbnRfc3ViX3Jlc291cmNlcycsXG5cdFx0J2Jvb2tpbmdfcmVjdXJyZW50X3RpbWUnLFxuXHRcdCdzYXZlZF92YXJpYWJsZV9fX2RheXNfc2VsZWN0X2luaXRpYWwnLFxuXHRcdCdjb25kaXRpb25zJ1xuXHRdO1xuXHR2YXIgb3RoZXJfcGFyYW1ldGVyX25hbWVzID0gW1xuXHRcdCd0aGlzX3BhZ2VfYm9va2luZ19oYXNoJyxcblx0XHQndGhpc19wYWdlX2FsbG93X3Bhc3QnLFxuXHRcdCd0aGlzX3BhZ2VfYWxsb3dfcGFzdF9hcnInXG5cdF07XG5cdHZhciBzZWN1cmVfcGFyYW1ldGVyX25hbWVzID0gWyAnbm9uY2UnLCAndXNlcl9pZCcsICdsb2NhbGUnIF07XG5cdHZhciByZXF1ZXN0X3BhcmFtZXRlcl9uYW1lcyA9IFtcblx0XHQncmVzb3VyY2VfaWQnLFxuXHRcdCdib29raW5nX2hhc2gnLFxuXHRcdCdyZXF1ZXN0X3VyaScsXG5cdFx0J2N1c3RvbV9mb3JtJyxcblx0XHQnYWxsb3dfcGFzdCcsXG5cdFx0J2FnZ3JlZ2F0ZV9yZXNvdXJjZV9pZF9zdHInLFxuXHRcdCdhZ2dyZWdhdGVfdHlwZScsXG5cdFx0J3NraXBfZ2VuZXJhbF9hdmFpbGFiaWxpdHknLFxuXHRcdCdjbGFzc2ljX2Jvb2tpbmdfY29udGV4dF90b2tlbidcblx0XTtcblxuXHQvKipcblx0ICogTm9ybWFsaXplIG9uZSBSZXNvdXJjZSBpZGVudGlmaWVyLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IHJlc291cmNlX2lkIENhbmRpZGF0ZSBSZXNvdXJjZSBpZGVudGlmaWVyLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtudW1iZXJ9IFBvc2l0aXZlIFJlc291cmNlIGlkZW50aWZpZXIsIG9yIHplcm8gd2hlbiBpbnZhbGlkLlxuXHQgKi9cblx0ZnVuY3Rpb24gbm9ybWFsaXplX3Jlc291cmNlX2lkKCByZXNvdXJjZV9pZCApIHtcblx0XHRyZXNvdXJjZV9pZCA9IHBhcnNlSW50KCByZXNvdXJjZV9pZCwgMTAgKTtcblxuXHRcdHJldHVybiByZXNvdXJjZV9pZCA+IDAgPyByZXNvdXJjZV9pZCA6IDA7XG5cdH1cblxuXHQvKipcblx0ICogTm9ybWFsaXplIG9uZSBCb29raW5nIGlkZW50aWZpZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gYm9va2luZ19pZCBDYW5kaWRhdGUgQm9va2luZyBpZGVudGlmaWVyLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtudW1iZXJ9IFBvc2l0aXZlIEJvb2tpbmcgaWRlbnRpZmllciwgb3IgemVybyB3aGVuIGludmFsaWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBub3JtYWxpemVfYm9va2luZ19pZCggYm9va2luZ19pZCApIHtcblx0XHRib29raW5nX2lkID0gcGFyc2VJbnQoIGJvb2tpbmdfaWQsIDEwICk7XG5cblx0XHRyZXR1cm4gYm9va2luZ19pZCA+IDAgPyBib29raW5nX2lkIDogMDtcblx0fVxuXG5cdC8qKlxuXHQgKiBQYXJzZSBvbmUgc3RyaWN0IElTTyBjYWxlbmRhciBkYXRlIHdpdGhvdXQgYSB0aW1lem9uZSBjb252ZXJzaW9uLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IGlzb19kYXRlIENhbmRpZGF0ZSBgWVlZWS1NTS1ERGAgdmFsdWUuXG5cdCAqXG5cdCAqIEByZXR1cm4ge0RhdGV8bnVsbH0gTG9jYWwgbWlkbmlnaHQgZGF0ZSwgb3IgbnVsbCB3aGVuIGludmFsaWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBwYXJzZV9pc29fZGF0ZSggaXNvX2RhdGUgKSB7XG5cdFx0dmFyIGRhdGVfbWF0Y2ggPSBTdHJpbmcoIGlzb19kYXRlIHx8ICcnICkubWF0Y2goIC9eKFxcZHs0fSktKFxcZHsyfSktKFxcZHsyfSkkLyApO1xuXHRcdHZhciBwYXJzZWRfZGF0ZTtcblxuXHRcdGlmICggISBkYXRlX21hdGNoICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0cGFyc2VkX2RhdGUgPSBuZXcgRGF0ZShcblx0XHRcdHBhcnNlSW50KCBkYXRlX21hdGNoWyAxIF0sIDEwICksXG5cdFx0XHRwYXJzZUludCggZGF0ZV9tYXRjaFsgMiBdLCAxMCApIC0gMSxcblx0XHRcdHBhcnNlSW50KCBkYXRlX21hdGNoWyAzIF0sIDEwICksXG5cdFx0XHQwLFxuXHRcdFx0MCxcblx0XHRcdDAsXG5cdFx0XHQwXG5cdFx0KTtcblxuXHRcdGlmIChcblx0XHRcdHBhcnNlZF9kYXRlLmdldEZ1bGxZZWFyKCkgIT09IHBhcnNlSW50KCBkYXRlX21hdGNoWyAxIF0sIDEwICkgfHxcblx0XHRcdHBhcnNlZF9kYXRlLmdldE1vbnRoKCkgIT09IHBhcnNlSW50KCBkYXRlX21hdGNoWyAyIF0sIDEwICkgLSAxIHx8XG5cdFx0XHRwYXJzZWRfZGF0ZS5nZXREYXRlKCkgIT09IHBhcnNlSW50KCBkYXRlX21hdGNoWyAzIF0sIDEwIClcblx0XHQpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHJldHVybiBwYXJzZWRfZGF0ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBGb3JtYXQgb25lIGxvY2FsIGNhbGVuZGFyIGRhdGUgYXMgYSBzdGFibGUgSVNPIHZhbHVlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0RhdGV9IHNlbGVjdGVkX2RhdGUgTmF0aXZlIGRhdGVwaWNrZXIgZGF0ZS5cblx0ICpcblx0ICogQHJldHVybiB7c3RyaW5nfSBgWVlZWS1NTS1ERGAsIG9yIGFuIGVtcHR5IHN0cmluZyB3aGVuIGludmFsaWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBmb3JtYXRfaXNvX2RhdGUoIHNlbGVjdGVkX2RhdGUgKSB7XG5cdFx0dmFyIHllYXI7XG5cdFx0dmFyIG1vbnRoO1xuXHRcdHZhciBkYXk7XG5cblx0XHRpZiAoICEgc2VsZWN0ZWRfZGF0ZSB8fCBpc05hTiggc2VsZWN0ZWRfZGF0ZS5nZXRUaW1lKCkgKSApIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cblx0XHR5ZWFyID0gU3RyaW5nKCBzZWxlY3RlZF9kYXRlLmdldEZ1bGxZZWFyKCkgKTtcblx0XHRtb250aCA9IFN0cmluZyggc2VsZWN0ZWRfZGF0ZS5nZXRNb250aCgpICsgMSApO1xuXHRcdGRheSA9IFN0cmluZyggc2VsZWN0ZWRfZGF0ZS5nZXREYXRlKCkgKTtcblxuXHRcdHJldHVybiB5ZWFyICsgJy0nICsgKCBtb250aC5sZW5ndGggPCAyID8gJzAnICsgbW9udGggOiBtb250aCApICsgJy0nICsgKCBkYXkubGVuZ3RoIDwgMiA/ICcwJyArIGRheSA6IGRheSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIE5vcm1hbGl6ZSwgZGVkdXBsaWNhdGUsIGFuZCBvcmRlciBJU08gZGF0ZSB2YWx1ZXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gc2VsZWN0ZWRfZGF0ZXMgQ2FuZGlkYXRlIGRhdGUgYXJyYXkuXG5cdCAqXG5cdCAqIEByZXR1cm4ge0FycmF5PHN0cmluZz59IE9yZGVyZWQgdmFsaWQgSVNPIGRhdGVzLlxuXHQgKi9cblx0ZnVuY3Rpb24gbm9ybWFsaXplX2lzb19kYXRlcyggc2VsZWN0ZWRfZGF0ZXMgKSB7XG5cdFx0dmFyIHVuaXF1ZV9kYXRlcyA9IHt9O1xuXG5cdFx0aWYgKCAhIEFycmF5LmlzQXJyYXkoIHNlbGVjdGVkX2RhdGVzICkgKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0c2VsZWN0ZWRfZGF0ZXMuZm9yRWFjaCggZnVuY3Rpb24gKCBzZWxlY3RlZF9kYXRlICkge1xuXHRcdFx0dmFyIHBhcnNlZF9kYXRlID0gcGFyc2VfaXNvX2RhdGUoIHNlbGVjdGVkX2RhdGUgKTtcblx0XHRcdHZhciBub3JtYWxpemVkX2RhdGUgPSBwYXJzZWRfZGF0ZSA/IGZvcm1hdF9pc29fZGF0ZSggcGFyc2VkX2RhdGUgKSA6ICcnO1xuXG5cdFx0XHRpZiAoIG5vcm1hbGl6ZWRfZGF0ZSApIHtcblx0XHRcdFx0dW5pcXVlX2RhdGVzWyBub3JtYWxpemVkX2RhdGUgXSA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIE9iamVjdC5rZXlzKCB1bmlxdWVfZGF0ZXMgKS5zb3J0KCk7XG5cdH1cblxuXHQvKipcblx0ICogTm9ybWFsaXplIG9uZSBleGFjdC1taW51dGUgYnJvd3NlciB0aW1lIHdpdGhvdXQgcm91bmRpbmcuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gdGltZV92YWx1ZSBDYW5kaWRhdGUgYEhIOk1NYCB2YWx1ZS5cblx0ICpcblx0ICogQHJldHVybiB7c3RyaW5nfSBFeGFjdCAyNC1ob3VyIG1pbnV0ZSB2YWx1ZSwgb3IgYW4gZW1wdHkgc3RyaW5nLlxuXHQgKi9cblx0ZnVuY3Rpb24gbm9ybWFsaXplX2V4YWN0X21pbnV0ZV90aW1lKCB0aW1lX3ZhbHVlICkge1xuXHRcdHRpbWVfdmFsdWUgPSBTdHJpbmcoIHRpbWVfdmFsdWUgfHwgJycgKTtcblxuXHRcdHJldHVybiAvXig/OlswMV1cXGR8MlswLTNdKTpbMC01XVxcZCQvLnRlc3QoIHRpbWVfdmFsdWUgKSA/IHRpbWVfdmFsdWUgOiAnJztcblx0fVxuXG5cdC8qKlxuXHQgKiBDb3B5IG9ubHkgdGhlIHNlcnZlci1kZWZpbmVkIG5hdGl2ZSBjYWxlbmRhciBwYXJhbWV0ZXIgYWxsb3cgbGlzdC5cblx0ICpcblx0ICogQHBhcmFtIHsqfSBjYWxlbmRhcl9wYXJhbWV0ZXJzIENhbmRpZGF0ZSBwYXJhbWV0ZXIgcmVjb3JkLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IEV4ZWN1dGFibGUtZnJlZSBhbGxvdy1saXN0ZWQgcGFyYW1ldGVyIHJlY29yZC5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9jYWxlbmRhcl9wYXJhbWV0ZXJzKCBjYWxlbmRhcl9wYXJhbWV0ZXJzICkge1xuXHRcdHZhciBub3JtYWxpemVkX3BhcmFtZXRlcnMgPSB7fTtcblxuXHRcdGlmICggISBjYWxlbmRhcl9wYXJhbWV0ZXJzIHx8ICdvYmplY3QnICE9PSB0eXBlb2YgY2FsZW5kYXJfcGFyYW1ldGVycyB8fCBBcnJheS5pc0FycmF5KCBjYWxlbmRhcl9wYXJhbWV0ZXJzICkgKSB7XG5cdFx0XHRyZXR1cm4gbm9ybWFsaXplZF9wYXJhbWV0ZXJzO1xuXHRcdH1cblxuXHRcdGNhbGVuZGFyX3BhcmFtZXRlcl9uYW1lcy5mb3JFYWNoKCBmdW5jdGlvbiAoIHBhcmFtZXRlcl9uYW1lICkge1xuXHRcdFx0aWYgKCBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIGNhbGVuZGFyX3BhcmFtZXRlcnMsIHBhcmFtZXRlcl9uYW1lICkgKSB7XG5cdFx0XHRcdG5vcm1hbGl6ZWRfcGFyYW1ldGVyc1sgcGFyYW1ldGVyX25hbWUgXSA9IGNhbGVuZGFyX3BhcmFtZXRlcnNbIHBhcmFtZXRlcl9uYW1lIF07XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIG5vcm1hbGl6ZWRfcGFyYW1ldGVycztcblx0fVxuXG5cdC8qKlxuXHQgKiBDb3B5IHNjYWxhciB2YWx1ZXMgZnJvbSBvbmUgZXhwbGljaXQgYWxsb3cgbGlzdC5cblx0ICpcblx0ICogQHBhcmFtIHsqfSAgICAgICAgICAgICBjYW5kaWRhdGVfdmFsdWVzIENhbmRpZGF0ZSBleGVjdXRhYmxlLWZyZWUgcmVjb3JkLlxuXHQgKiBAcGFyYW0ge0FycmF5PHN0cmluZz59IGFsbG93ZWRfbmFtZXMgICAgQWNjZXB0ZWQgcHJvcGVydHkgbmFtZXMuXG5cdCAqXG5cdCAqIEByZXR1cm4ge09iamVjdH0gQm91bmRlZCBzY2FsYXIgcmVjb3JkLlxuXHQgKi9cblx0ZnVuY3Rpb24gbm9ybWFsaXplX3NjYWxhcl9wYXJhbWV0ZXJzKCBjYW5kaWRhdGVfdmFsdWVzLCBhbGxvd2VkX25hbWVzICkge1xuXHRcdHZhciBub3JtYWxpemVkX3ZhbHVlcyA9IHt9O1xuXG5cdFx0aWYgKCAhIGNhbmRpZGF0ZV92YWx1ZXMgfHwgJ29iamVjdCcgIT09IHR5cGVvZiBjYW5kaWRhdGVfdmFsdWVzIHx8IEFycmF5LmlzQXJyYXkoIGNhbmRpZGF0ZV92YWx1ZXMgKSApIHtcblx0XHRcdHJldHVybiBub3JtYWxpemVkX3ZhbHVlcztcblx0XHR9XG5cblx0XHRhbGxvd2VkX25hbWVzLmZvckVhY2goIGZ1bmN0aW9uICggcGFyYW1ldGVyX25hbWUgKSB7XG5cdFx0XHR2YXIgcGFyYW1ldGVyX3ZhbHVlO1xuXG5cdFx0XHRpZiAoICEgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBjYW5kaWRhdGVfdmFsdWVzLCBwYXJhbWV0ZXJfbmFtZSApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRwYXJhbWV0ZXJfdmFsdWUgPSBjYW5kaWRhdGVfdmFsdWVzWyBwYXJhbWV0ZXJfbmFtZSBdO1xuXHRcdFx0aWYgKCBudWxsID09PSBwYXJhbWV0ZXJfdmFsdWUgfHwgLTEgIT09IFsgJ3N0cmluZycsICdudW1iZXInLCAnYm9vbGVhbicgXS5pbmRleE9mKCB0eXBlb2YgcGFyYW1ldGVyX3ZhbHVlICkgKSB7XG5cdFx0XHRcdG5vcm1hbGl6ZWRfdmFsdWVzWyBwYXJhbWV0ZXJfbmFtZSBdID0gcGFyYW1ldGVyX3ZhbHVlO1xuXHRcdFx0fVxuXHRcdH0gKTtcblxuXHRcdHJldHVybiBub3JtYWxpemVkX3ZhbHVlcztcblx0fVxuXG5cdC8qKlxuXHQgKiBSZW1vdmUgZXZlcnkgY2hpbGQgbm9kZSBmcm9tIGEgRGF0ZSBFZGl0b3IgY2FsZW5kYXIgaG9zdC5cblx0ICpcblx0ICogQHBhcmFtIHtFbGVtZW50fG51bGx9IGhvc3QgQ2FsZW5kYXIgaG9zdCBlbGVtZW50LlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gY2xlYXJfaG9zdCggaG9zdCApIHtcblx0XHRpZiAoICEgaG9zdCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR3aGlsZSAoIGhvc3QuZmlyc3RDaGlsZCApIHtcblx0XHRcdGhvc3QucmVtb3ZlQ2hpbGQoIGhvc3QuZmlyc3RDaGlsZCApO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBDYXB0dXJlIG9uZSBuYXRpdmUgY2FsZW5kYXIgcmVnaXN0cnkgZW50cnkgYmVmb3JlIGEgdGVtcG9yYXJ5IG1vdW50LlxuXHQgKlxuXHQgKiBUaGUgbmF0aXZlIGNhbGVuZGFyIHJ1bnRpbWUgc3RvcmVzIFJlc291cmNlIHBhcmFtZXRlcnMgaW4gb25lIGdsb2JhbFxuXHQgKiByZWdpc3RyeS4gQSBzaGFsbG93IHByb3BlcnR5IGNvcHkgaXMgc3VmZmljaWVudCBoZXJlIGJlY2F1c2UgdGhlIGFkYXB0ZXJcblx0ICogcmVwbGFjZXMgdG9wLWxldmVsIHBhcmFtZXRlcnMgYW5kIGRvZXMgbm90IG11dGF0ZSBuZXN0ZWQgdmFsdWVzIGluaGVyaXRlZFxuXHQgKiBmcm9tIGFub3RoZXIgb3duZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBCb29raW5nIFJlc291cmNlIElELlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gUmVzdG9yYWJsZSByZWdpc3RyeSBzbmFwc2hvdCwgb3IgbnVsbCB3aGVuIHVuYXZhaWxhYmxlLlxuXHQgKi9cblx0ZnVuY3Rpb24gY2FwdHVyZV9uYXRpdmVfY2FsZW5kYXJfcmVnaXN0cnlfZW50cnkoIHJlc291cmNlX2lkICkge1xuXHRcdHZhciBjYWxlbmRhcnM7XG5cdFx0dmFyIHJlZ2lzdHJ5X2tleTtcblx0XHR2YXIgcmVnaXN0cnlfZW50cnk7XG5cdFx0dmFyIHBhcmFtZXRlcnMgPSB7fTtcblxuXHRcdGlmIChcblx0XHRcdCEgd2luZG93Ll93cGJjIHx8XG5cdFx0XHQnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93Ll93cGJjLmNhbGVuZGFyc19hbGxfX2dldCB8fFxuXHRcdFx0ISByZXNvdXJjZV9pZFxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y2FsZW5kYXJzID0gd2luZG93Ll93cGJjLmNhbGVuZGFyc19hbGxfX2dldCgpO1xuXHRcdGNhbGVuZGFycyA9IGNhbGVuZGFycyAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIGNhbGVuZGFycyAmJiAhIEFycmF5LmlzQXJyYXkoIGNhbGVuZGFycyApID8gY2FsZW5kYXJzIDoge307XG5cdFx0cmVnaXN0cnlfa2V5ID0gJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZDtcblxuXHRcdGlmICggISBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIGNhbGVuZGFycywgcmVnaXN0cnlfa2V5ICkgKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRrZXk6IHJlZ2lzdHJ5X2tleSxcblx0XHRcdFx0ZXhpc3RlZDogZmFsc2UsXG5cdFx0XHRcdHBhcmFtZXRlcnM6IG51bGxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0cmVnaXN0cnlfZW50cnkgPSBjYWxlbmRhcnNbIHJlZ2lzdHJ5X2tleSBdO1xuXHRcdGlmICggcmVnaXN0cnlfZW50cnkgJiYgJ29iamVjdCcgPT09IHR5cGVvZiByZWdpc3RyeV9lbnRyeSAmJiAhIEFycmF5LmlzQXJyYXkoIHJlZ2lzdHJ5X2VudHJ5ICkgKSB7XG5cdFx0XHRPYmplY3Qua2V5cyggcmVnaXN0cnlfZW50cnkgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHBhcmFtZXRlcl9uYW1lICkge1xuXHRcdFx0XHRwYXJhbWV0ZXJzWyBwYXJhbWV0ZXJfbmFtZSBdID0gcmVnaXN0cnlfZW50cnlbIHBhcmFtZXRlcl9uYW1lIF07XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGtleTogcmVnaXN0cnlfa2V5LFxuXHRcdFx0ZXhpc3RlZDogdHJ1ZSxcblx0XHRcdHBhcmFtZXRlcnM6IHBhcmFtZXRlcnNcblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlc3RvcmUgb3IgcmVtb3ZlIG9uZSB0ZW1wb3JhcnkgbmF0aXZlIGNhbGVuZGFyIHJlZ2lzdHJ5IGVudHJ5LlxuXHQgKlxuXHQgKiBFeGlzdGluZyBlbnRyaWVzIGFyZSByZXN0b3JlZCB3aXRob3V0IHJlcGxhY2luZyBvdGhlciBSZXNvdXJjZSBlbnRyaWVzLlxuXHQgKiBFbnRyaWVzIGNyZWF0ZWQgc29sZWx5IGZvciBhbiBJbnNwZWN0b3IgbW91bnQgYXJlIHJlbW92ZWQgc28gbGF0ZXIgbW91bnRzXG5cdCAqIGNhbm5vdCBpbmhlcml0IHN0YWxlIHBvbGljeSBwYXJhbWV0ZXJzIGZyb20gYW4gZWFybGllciBSZXNvdXJjZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R8bnVsbH0gcmVnaXN0cnlfc25hcHNob3QgU25hcHNob3QgcmV0dXJuZWQgYnkgdGhlIGNhcHR1cmUgaGVscGVyLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIHJlZ2lzdHJ5IHdhcyByZXN0b3JlZC5cblx0ICovXG5cdGZ1bmN0aW9uIHJlc3RvcmVfbmF0aXZlX2NhbGVuZGFyX3JlZ2lzdHJ5X2VudHJ5KCByZWdpc3RyeV9zbmFwc2hvdCApIHtcblx0XHR2YXIgY2FsZW5kYXJzO1xuXG5cdFx0aWYgKFxuXHRcdFx0ISByZWdpc3RyeV9zbmFwc2hvdCB8fFxuXHRcdFx0J3N0cmluZycgIT09IHR5cGVvZiByZWdpc3RyeV9zbmFwc2hvdC5rZXkgfHxcblx0XHRcdCEgd2luZG93Ll93cGJjIHx8XG5cdFx0XHQnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93Ll93cGJjLmNhbGVuZGFyc19hbGxfX2dldCB8fFxuXHRcdFx0J2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy5fd3BiYy5jYWxlbmRhcnNfYWxsX19zZXRcblx0XHQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjYWxlbmRhcnMgPSB3aW5kb3cuX3dwYmMuY2FsZW5kYXJzX2FsbF9fZ2V0KCk7XG5cdFx0Y2FsZW5kYXJzID0gY2FsZW5kYXJzICYmICdvYmplY3QnID09PSB0eXBlb2YgY2FsZW5kYXJzICYmICEgQXJyYXkuaXNBcnJheSggY2FsZW5kYXJzICkgPyBjYWxlbmRhcnMgOiB7fTtcblxuXHRcdGlmICggcmVnaXN0cnlfc25hcHNob3QuZXhpc3RlZCApIHtcblx0XHRcdGNhbGVuZGFyc1sgcmVnaXN0cnlfc25hcHNob3Qua2V5IF0gPSByZWdpc3RyeV9zbmFwc2hvdC5wYXJhbWV0ZXJzIHx8IHt9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkZWxldGUgY2FsZW5kYXJzWyByZWdpc3RyeV9zbmFwc2hvdC5rZXkgXTtcblx0XHR9XG5cblx0XHR3aW5kb3cuX3dwYmMuY2FsZW5kYXJzX2FsbF9fc2V0KCBjYWxlbmRhcnMgKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBvbmUgZG9ybWFudCBuYXRpdmUtY2FsZW5kYXIgYWRhcHRlci5cblx0ICpcblx0ICogT25seSBvbmUgYWRhcHRlciBtYXkgb3duIGEgbW91bnRlZCBuYXRpdmUgY2FsZW5kYXIgYmVjYXVzZSBXUEJDIGNhbGVuZGFyc1xuXHQgKiBhcmUga2V5ZWQgZ2xvYmFsbHkgYnkgUmVzb3VyY2UgSUQgYW5kIHVzZSBzdGFibGUgRE9NIGlkZW50aWZpZXJzLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IENvbnRyb2xsZWQgYWRhcHRlciBBUEkgZm9yIHRoZSBmdXR1cmUgRGF0ZSBFZGl0b3IgY29udHJvbGxlci5cblx0ICovXG5cdGZ1bmN0aW9uIGNyZWF0ZV9uYXRpdmVfY2FsZW5kYXJfYWRhcHRlcigpIHtcblx0XHR2YXIgaG9zdCA9IG51bGw7XG5cdFx0dmFyIHJlc291cmNlX2lkID0gMDtcblx0XHR2YXIgbG9hZF9nZW5lcmF0aW9uID0gMDtcblx0XHR2YXIgcGVuZGluZ19jYWxlbmRhcl9yZXF1ZXN0ID0gbnVsbDtcblx0XHR2YXIgcG9saWN5X3BhcmFtZXRlcnMgPSB7fTtcblx0XHR2YXIgY2FsZW5kYXJfcmVnaXN0cnlfc25hcHNob3QgPSBudWxsO1xuXHRcdHZhciBwcmV2aW91c19vdGhlcl9wYXJhbWV0ZXJzID0ge307XG5cdFx0dmFyIHByZXZpb3VzX3NlY3VyZV9wYXJhbWV0ZXJzID0ge307XG5cblx0XHQvKipcblx0XHQgKiBDb25maXJtIHRoYXQgZXZlcnkgcmVxdWlyZWQgbmF0aXZlIGNhbGVuZGFyIEFQSSBpcyBhdmFpbGFibGUuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIHN0YW5kYXJkIHJ1bnRpbWUgaXMgcmVhZHkuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFzX25hdGl2ZV9hcGkoKSB7XG5cdFx0XHRyZXR1cm4gQm9vbGVhbihcblx0XHRcdFx0d2luZG93Ll93cGJjICYmXG5cdFx0XHRcdCdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuX3dwYmMuY2FsZW5kYXJzX2FsbF9fZ2V0ICYmXG5cdFx0XHRcdCdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuX3dwYmMuY2FsZW5kYXJzX2FsbF9fc2V0ICYmXG5cdFx0XHRcdCdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuX3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzICYmXG5cdFx0XHRcdCdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSAmJlxuXHRcdFx0XHQnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93Ll93cGJjLnNldF9vdGhlcl9wYXJhbSAmJlxuXHRcdFx0XHQnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93Ll93cGJjLmdldF9vdGhlcl9wYXJhbSAmJlxuXHRcdFx0XHQnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93Ll93cGJjLnNldF9zZWN1cmVfcGFyYW0gJiZcblx0XHRcdFx0J2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5fd3BiYy5nZXRfc2VjdXJlX3BhcmFtICYmXG5cdFx0XHRcdCdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19jYWxlbmRhcl9zaG93ICYmXG5cdFx0XHRcdCdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hanggJiZcblx0XHRcdFx0J2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX2NhbGVuZGFyX19nZXRfaW5zdCAmJlxuXHRcdFx0XHQkLmRhdGVwaWNrICYmXG5cdFx0XHRcdCdmdW5jdGlvbicgPT09IHR5cGVvZiAkLmRhdGVwaWNrLl9mb3JtYXREYXRlICYmXG5cdFx0XHRcdCdmdW5jdGlvbicgPT09IHR5cGVvZiAkLmRhdGVwaWNrLl91cGRhdGVEYXRlcGlja1xuXHRcdFx0KTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBQcmVzZXJ2ZSBhbmQgYXBwbHkgbmF0aXZlIEFKQVggc2VjdXJpdHkgcGFyYW1ldGVycyBmb3IgdGhpcyBtb3VudC5cblx0XHQgKlxuXHRcdCAqIE5hdGl2ZSBzZWN1cml0eSBzdGF0ZSBpcyBnbG9iYWwuIFRoZSBhY3RpdmUtaW5zdGFuY2UgZ3VhcmQgYW5kIHRlYXJkb3duXG5cdFx0ICogcmVzdG9yYXRpb24gZW5zdXJlIHRoaXMgZWRpdG9yIGNhbm5vdCBsZWFrIGl0cyBub25jZSBvciBsb2NhbGUgaW50byBhXG5cdFx0ICogbGF0ZXIgY2FsZW5kYXIgY29uc3VtZXIgb24gdGhlIHNhbWUgYWRtaW5pc3RyYXRpb24gcGFnZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Kn0gc2VjdXJlX3BhcmFtZXRlcnMgQXV0aG9yaXplZCBuYXRpdmUgc2VjdXJpdHkgcGFyYW1ldGVycy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYXBwbHlfc2VjdXJlX3BhcmFtZXRlcnMoIHNlY3VyZV9wYXJhbWV0ZXJzICkge1xuXHRcdFx0dmFyIG5vcm1hbGl6ZWRfcGFyYW1ldGVycyA9IG5vcm1hbGl6ZV9zY2FsYXJfcGFyYW1ldGVycyggc2VjdXJlX3BhcmFtZXRlcnMsIHNlY3VyZV9wYXJhbWV0ZXJfbmFtZXMgKTtcblxuXHRcdFx0c2VjdXJlX3BhcmFtZXRlcl9uYW1lcy5mb3JFYWNoKCBmdW5jdGlvbiAoIHBhcmFtZXRlcl9uYW1lICkge1xuXHRcdFx0XHRpZiAoICEgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBub3JtYWxpemVkX3BhcmFtZXRlcnMsIHBhcmFtZXRlcl9uYW1lICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHByZXZpb3VzX3NlY3VyZV9wYXJhbWV0ZXJzWyBwYXJhbWV0ZXJfbmFtZSBdID0gd2luZG93Ll93cGJjLmdldF9zZWN1cmVfcGFyYW0oIHBhcmFtZXRlcl9uYW1lICk7XG5cdFx0XHRcdHdpbmRvdy5fd3BiYy5zZXRfc2VjdXJlX3BhcmFtKCBwYXJhbWV0ZXJfbmFtZSwgbm9ybWFsaXplZF9wYXJhbWV0ZXJzWyBwYXJhbWV0ZXJfbmFtZSBdICk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3RvcmUgYW5kIGFwcGx5IGJvdW5kZWQgbmF0aXZlIGNhbGVuZGFyIHBhcmFtZXRlcnMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gY2FsZW5kYXJfcGFyYW1ldGVycyBBbGxvdy1saXN0ZWQgc2VydmVyIHZhbHVlcy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYXBwbHlfY2FsZW5kYXJfcGFyYW1ldGVycyggY2FsZW5kYXJfcGFyYW1ldGVycyApIHtcblx0XHRcdHZhciBub3JtYWxpemVkX3BhcmFtZXRlcnMgPSBub3JtYWxpemVfY2FsZW5kYXJfcGFyYW1ldGVycyggY2FsZW5kYXJfcGFyYW1ldGVycyApO1xuXG5cdFx0XHR3aW5kb3cuX3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzKCByZXNvdXJjZV9pZCwgbm9ybWFsaXplZF9wYXJhbWV0ZXJzICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3RvcmUgYW5kIGFwcGx5IHRoZSBuYXJyb3cgZ2xvYmFsIGVkaXQgY29udGV4dCB1c2VkIGJ5IG5hdGl2ZSBjYWxlbmRhcnMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0geyp9IGNvbnRleHRfcGFyYW1ldGVycyBDYW5kaWRhdGUgZWRpdC1jb250ZXh0IHJlY29yZC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYXBwbHlfY29udGV4dF9wYXJhbWV0ZXJzKCBjb250ZXh0X3BhcmFtZXRlcnMgKSB7XG5cdFx0XHRpZiAoICEgY29udGV4dF9wYXJhbWV0ZXJzIHx8ICdvYmplY3QnICE9PSB0eXBlb2YgY29udGV4dF9wYXJhbWV0ZXJzIHx8IEFycmF5LmlzQXJyYXkoIGNvbnRleHRfcGFyYW1ldGVycyApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdG90aGVyX3BhcmFtZXRlcl9uYW1lcy5mb3JFYWNoKCBmdW5jdGlvbiAoIHBhcmFtZXRlcl9uYW1lICkge1xuXHRcdFx0XHRpZiAoICEgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBjb250ZXh0X3BhcmFtZXRlcnMsIHBhcmFtZXRlcl9uYW1lICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHByZXZpb3VzX290aGVyX3BhcmFtZXRlcnNbIHBhcmFtZXRlcl9uYW1lIF0gPSB3aW5kb3cuX3dwYmMuZ2V0X290aGVyX3BhcmFtKCBwYXJhbWV0ZXJfbmFtZSApO1xuXHRcdFx0XHR3aW5kb3cuX3dwYmMuc2V0X290aGVyX3BhcmFtKCBwYXJhbWV0ZXJfbmFtZSwgY29udGV4dF9wYXJhbWV0ZXJzWyBwYXJhbWV0ZXJfbmFtZSBdICk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVhZCB0aGUgY29tcGxldGUgY2Fub25pY2FsIHNlbGVjdGlvbiBmcm9tIHRoZSBuYXRpdmUgY2FsZW5kYXIuXG5cdFx0ICpcblx0XHQgKiBEeW5hbWljIHJhbmdlIG1vZGUgc3RvcmVzIG9ubHkgaXRzIGJvdW5kYXJ5IGRhdGVzIG9uIHRoZSBkYXRlcGljayBpbnN0YW5jZSxcblx0XHQgKiB3aGlsZSB0aGUgbmF0aXZlIGhlbHBlciByZXR1cm5zIHRoZSBjb21wbGV0ZSBzZWxlY3Rpb24gcmVwcmVzZW50ZWQgYnkgdGhlXG5cdFx0ICogY2FsZW5kYXIncyBjYW5vbmljYWwgaGlkZGVuIHZhbHVlLiBUaGUgaW5zdGFuY2UgcmVtYWlucyBhIGNvbXBhdGliaWxpdHlcblx0XHQgKiBmYWxsYmFjayBmb3Igb2xkZXIgbmF0aXZlIHJ1bnRpbWVzIHRoYXQgZG8gbm90IGV4cG9zZSB0aGF0IGhlbHBlci5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge0FycmF5PHN0cmluZz59IE9yZGVyZWQgc2VsZWN0ZWQgSVNPIGRhdGVzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9zZWxlY3RlZF9kYXRlcygpIHtcblx0XHRcdHZhciBjYWxlbmRhcl9pbnN0YW5jZTtcblx0XHRcdHZhciBzZWxlY3RlZF9kYXRlcztcblxuXHRcdFx0aWYgKCAhIHJlc291cmNlX2lkIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiB3aW5kb3cud3BiY19jYWxlbmRhcl9fZ2V0X2luc3QgKSB7XG5cdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfZ2V0X19zZWxlY3RlZF9kYXRlc19zcWxfX2FzX2FyciApIHtcblx0XHRcdFx0cmV0dXJuIG5vcm1hbGl6ZV9pc29fZGF0ZXMoIHdpbmRvdy53cGJjX2dldF9fc2VsZWN0ZWRfZGF0ZXNfc3FsX19hc19hcnIoIHJlc291cmNlX2lkICkgKTtcblx0XHRcdH1cblxuXHRcdFx0Y2FsZW5kYXJfaW5zdGFuY2UgPSB3aW5kb3cud3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkICk7XG5cdFx0XHRzZWxlY3RlZF9kYXRlcyA9IGNhbGVuZGFyX2luc3RhbmNlICYmIEFycmF5LmlzQXJyYXkoIGNhbGVuZGFyX2luc3RhbmNlLmRhdGVzIClcblx0XHRcdFx0PyBjYWxlbmRhcl9pbnN0YW5jZS5kYXRlcy5tYXAoIGZvcm1hdF9pc29fZGF0ZSApXG5cdFx0XHRcdDogW107XG5cblx0XHRcdHJldHVybiBub3JtYWxpemVfaXNvX2RhdGVzKCBzZWxlY3RlZF9kYXRlcyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc3RvcmUgZXhhY3QgYXV0aG9yaXplZCBkYXRlcyB3aXRob3V0IGF2YWlsYWJpbGl0eS1nYXRlZCBjbGljayByZXBsYXkuXG5cdFx0ICpcblx0XHQgKiBUaGlzIG9wZXJhdGlvbiBjaGFuZ2VzIHNlbGVjdGlvbiBvbmx5LiBFeGlzdGluZyBhdmFpbGFiaWxpdHkgZGF0YSBhbmQgZGF5XG5cdFx0ICogc3R5bGluZyByZW1haW4gb3duZWQgYnkgdGhlIG5hdGl2ZSBjYWxlbmRhciBBSkFYIHJlc3BvbnNlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtBcnJheTxzdHJpbmc+fSBzZWxlY3RlZF9kYXRlcyBFeGFjdCBzYXZlZCBvciBkcmFmdCBJU08gZGF0ZXMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIG1vdW50ZWQgaW5zdGFuY2Ugd2FzIHN5bmNocm9uaXplZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfZXhhY3Rfc2VsZWN0ZWRfZGF0ZXMoIHNlbGVjdGVkX2RhdGVzICkge1xuXHRcdFx0dmFyIG5vcm1hbGl6ZWRfZGF0ZXMgPSBub3JtYWxpemVfaXNvX2RhdGVzKCBzZWxlY3RlZF9kYXRlcyApO1xuXHRcdFx0dmFyIGNhbGVuZGFyX2luc3RhbmNlID0gd2luZG93LndwYmNfY2FsZW5kYXJfX2dldF9pbnN0KCByZXNvdXJjZV9pZCApO1xuXHRcdFx0dmFyIG5hdGl2ZV9kYXRlcztcblx0XHRcdHZhciBoaWRkZW5fZGF0ZV9maWVsZDtcblx0XHRcdHZhciBhcHBsaWVkX2RhdGVzO1xuXG5cdFx0XHRpZiAoICEgY2FsZW5kYXJfaW5zdGFuY2UgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0bmF0aXZlX2RhdGVzID0gbm9ybWFsaXplZF9kYXRlcy5tYXAoIHBhcnNlX2lzb19kYXRlICkuZmlsdGVyKCBmdW5jdGlvbiAoIHNlbGVjdGVkX2RhdGUgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsICE9PSBzZWxlY3RlZF9kYXRlO1xuXHRcdFx0fSApO1xuXHRcdFx0aGlkZGVuX2RhdGVfZmllbGQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApO1xuXG5cdFx0XHRjYWxlbmRhcl9pbnN0YW5jZS5zdGF5T3BlbiA9IGZhbHNlO1xuXHRcdFx0Y2FsZW5kYXJfaW5zdGFuY2UuZGF0ZXMgPSBuYXRpdmVfZGF0ZXM7XG5cdFx0XHRpZiAoIGhpZGRlbl9kYXRlX2ZpZWxkICkge1xuXHRcdFx0XHRoaWRkZW5fZGF0ZV9maWVsZC52YWx1ZSA9IG5hdGl2ZV9kYXRlcy5tYXAoIGZ1bmN0aW9uICggc2VsZWN0ZWRfZGF0ZSApIHtcblx0XHRcdFx0XHRyZXR1cm4gJC5kYXRlcGljay5fZm9ybWF0RGF0ZSggY2FsZW5kYXJfaW5zdGFuY2UsIHNlbGVjdGVkX2RhdGUgKTtcblx0XHRcdFx0fSApLmpvaW4oICcsICcgKTtcblx0XHRcdH1cblx0XHRcdCQuZGF0ZXBpY2suX3VwZGF0ZURhdGVwaWNrKCBjYWxlbmRhcl9pbnN0YW5jZSApO1xuXG5cdFx0XHRpZiAoIG5hdGl2ZV9kYXRlcy5sZW5ndGggJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX2NhbGVuZGFyX19zY3JvbGxfdG8gKSB7XG5cdFx0XHRcdHdpbmRvdy53cGJjX2NhbGVuZGFyX19zY3JvbGxfdG8oXG5cdFx0XHRcdFx0cmVzb3VyY2VfaWQsXG5cdFx0XHRcdFx0bmF0aXZlX2RhdGVzWyAwIF0uZ2V0RnVsbFllYXIoKSxcblx0XHRcdFx0XHRuYXRpdmVfZGF0ZXNbIDAgXS5nZXRNb250aCgpICsgMVxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXG5cdFx0XHRhcHBsaWVkX2RhdGVzID0gZ2V0X3NlbGVjdGVkX2RhdGVzKCk7XG5cblx0XHRcdHJldHVybiBub3JtYWxpemVkX2RhdGVzLmpvaW4oICd8JyApID09PSBhcHBsaWVkX2RhdGVzLmpvaW4oICd8JyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE1vdW50IGNhbm9uaWNhbCBzZXJ2ZXItcmVuZGVyZWQgY2FsZW5kYXIgbWFya3VwIGFuZCBpbml0aWFsaXplIGRhdGVwaWNrLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFbGVtZW50fSBjYWxlbmRhcl9ob3N0IEVtcHR5IERhdGUgRWRpdG9yIGNhbGVuZGFyIGhvc3QuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IG1vdW50X2NvbmZpZ3VyYXRpb24gQXV0aG9yaXplZCwgZXhlY3V0YWJsZS1mcmVlIGNvbmZpZ3VyYXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhpcyBhZGFwdGVyIG93bnMgYW4gaW5pdGlhbGl6ZWQgY2FsZW5kYXIuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbW91bnQoIGNhbGVuZGFyX2hvc3QsIG1vdW50X2NvbmZpZ3VyYXRpb24gKSB7XG5cdFx0XHR2YXIgcmVxdWVzdGVkX3Jlc291cmNlX2lkO1xuXHRcdFx0dmFyIGV4aXN0aW5nX2NhbGVuZGFyO1xuXG5cdFx0XHRtb3VudF9jb25maWd1cmF0aW9uID0gbW91bnRfY29uZmlndXJhdGlvbiB8fCB7fTtcblx0XHRcdHJlcXVlc3RlZF9yZXNvdXJjZV9pZCA9IG5vcm1hbGl6ZV9yZXNvdXJjZV9pZCggbW91bnRfY29uZmlndXJhdGlvbi5yZXNvdXJjZV9pZCApO1xuXG5cdFx0XHRpZiAoXG5cdFx0XHRcdGFjdGl2ZV9hZGFwdGVyIHx8XG5cdFx0XHRcdCEgaGFzX25hdGl2ZV9hcGkoKSB8fFxuXHRcdFx0XHQhIGNhbGVuZGFyX2hvc3QgfHxcblx0XHRcdFx0MSAhPT0gY2FsZW5kYXJfaG9zdC5ub2RlVHlwZSB8fFxuXHRcdFx0XHQhIHJlcXVlc3RlZF9yZXNvdXJjZV9pZCB8fFxuXHRcdFx0XHQnc3RyaW5nJyAhPT0gdHlwZW9mIG1vdW50X2NvbmZpZ3VyYXRpb24uY2FsZW5kYXJfaHRtbFxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0ZXhpc3RpbmdfY2FsZW5kYXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVxdWVzdGVkX3Jlc291cmNlX2lkICk7XG5cdFx0XHRpZiAoIGV4aXN0aW5nX2NhbGVuZGFyICYmICEgY2FsZW5kYXJfaG9zdC5jb250YWlucyggZXhpc3RpbmdfY2FsZW5kYXIgKSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRhY3RpdmVfYWRhcHRlciA9IGFkYXB0ZXJfYXBpO1xuXHRcdFx0aG9zdCA9IGNhbGVuZGFyX2hvc3Q7XG5cdFx0XHRyZXNvdXJjZV9pZCA9IHJlcXVlc3RlZF9yZXNvdXJjZV9pZDtcblx0XHRcdGNhbGVuZGFyX3JlZ2lzdHJ5X3NuYXBzaG90ID0gY2FwdHVyZV9uYXRpdmVfY2FsZW5kYXJfcmVnaXN0cnlfZW50cnkoIHJlc291cmNlX2lkICk7XG5cdFx0XHRwb2xpY3lfcGFyYW1ldGVycyA9IG5vcm1hbGl6ZV9jYWxlbmRhcl9wYXJhbWV0ZXJzKCBtb3VudF9jb25maWd1cmF0aW9uLnBvbGljeV9wYXJhbWV0ZXJzICk7XG5cdFx0XHRhcHBseV9jYWxlbmRhcl9wYXJhbWV0ZXJzKCBtb3VudF9jb25maWd1cmF0aW9uLmNhbGVuZGFyX3BhcmFtZXRlcnMgKTtcblx0XHRcdGFwcGx5X2NvbnRleHRfcGFyYW1ldGVycyggbW91bnRfY29uZmlndXJhdGlvbi5jb250ZXh0X3BhcmFtZXRlcnMgKTtcblx0XHRcdGFwcGx5X3NlY3VyZV9wYXJhbWV0ZXJzKCBtb3VudF9jb25maWd1cmF0aW9uLnNlY3VyZV9wYXJhbWV0ZXJzICk7XG5cdFx0XHRob3N0LmlubmVySFRNTCA9IG1vdW50X2NvbmZpZ3VyYXRpb24uY2FsZW5kYXJfaHRtbDtcblxuXHRcdFx0aWYgKCAhIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApIHx8IGZhbHNlID09PSB3aW5kb3cud3BiY19jYWxlbmRhcl9zaG93KCByZXNvdXJjZV9pZCApICkge1xuXHRcdFx0XHR0ZWFyZG93bigpO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN0YXJ0IHRoZSBjYW5vbmljYWwgV1BCQyBjYWxlbmRhci1kYXRhIHJlcXVlc3QgZm9yIHRoaXMgUmVzb3VyY2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICByZXF1ZXN0X3BhcmFtZXRlcnMgU3RhbmRhcmQgY2FsZW5kYXIgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuXHRcdCAqIEBwYXJhbSB7RnVuY3Rpb259IG9uX2xvYWRlZCAgICAgICAgICBDYWxsZWQgb25seSBmb3IgdGhpcyBhZGFwdGVyJ3MgY3VycmVudCBsb2FkLlxuXHRcdCAqIEBwYXJhbSB7RnVuY3Rpb259IG9uX2ZhaWxlZCAgICAgICAgICBDYWxsZWQgZm9yIGEgbm9uLWFib3J0ZWQgbWF0Y2hpbmcgcmVxdWVzdCBmYWlsdXJlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSByZXF1ZXN0IHdhcyBkaXNwYXRjaGVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGxvYWQoIHJlcXVlc3RfcGFyYW1ldGVycywgb25fbG9hZGVkLCBvbl9mYWlsZWQgKSB7XG5cdFx0XHR2YXIgY3VycmVudF9nZW5lcmF0aW9uO1xuXHRcdFx0dmFyIG5vcm1hbGl6ZWRfcmVxdWVzdDtcblx0XHRcdHZhciBjYXB0dXJlX2hhbmRsZXI7XG5cblx0XHRcdGlmICggYWN0aXZlX2FkYXB0ZXIgIT09IGFkYXB0ZXJfYXBpIHx8ICEgcmVzb3VyY2VfaWQgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy53cGJjX2NhbGVuZGFyX19sb2FkX2RhdGFfX2FqeCApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRhYm9ydF9sb2FkKCk7XG5cdFx0XHRjdXJyZW50X2dlbmVyYXRpb24gPSBsb2FkX2dlbmVyYXRpb247XG5cdFx0XHRub3JtYWxpemVkX3JlcXVlc3QgPSBub3JtYWxpemVfc2NhbGFyX3BhcmFtZXRlcnMoIHJlcXVlc3RfcGFyYW1ldGVycywgcmVxdWVzdF9wYXJhbWV0ZXJfbmFtZXMgKTtcblx0XHRcdG5vcm1hbGl6ZWRfcmVxdWVzdC5yZXNvdXJjZV9pZCA9IHJlc291cmNlX2lkO1xuXHRcdFx0JCggJ2JvZHknICkub2ZmKCAnd3BiY19jYWxlbmRhcl9hanhfX2xvYWRlZF9kYXRhJyArIEVWRU5UX05BTUVTUEFDRSApO1xuXHRcdFx0JCggJ2JvZHknICkub24oICd3cGJjX2NhbGVuZGFyX2FqeF9fbG9hZGVkX2RhdGEnICsgRVZFTlRfTkFNRVNQQUNFLCBmdW5jdGlvbiAoIGV2ZW50LCBsb2FkZWRfcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdGlmIChcblx0XHRcdFx0XHRhY3RpdmVfYWRhcHRlciAhPT0gYWRhcHRlcl9hcGkgfHxcblx0XHRcdFx0XHRjdXJyZW50X2dlbmVyYXRpb24gIT09IGxvYWRfZ2VuZXJhdGlvbiB8fFxuXHRcdFx0XHRcdHJlc291cmNlX2lkICE9PSBub3JtYWxpemVfcmVzb3VyY2VfaWQoIGxvYWRlZF9yZXNvdXJjZV9pZCApIHx8XG5cdFx0XHRcdFx0ISBwZW5kaW5nX2NhbGVuZGFyX3JlcXVlc3QgfHxcblx0XHRcdFx0XHQ0ICE9PSBwZW5kaW5nX2NhbGVuZGFyX3JlcXVlc3QucmVhZHlTdGF0ZVxuXHRcdFx0XHQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQkKCAnYm9keScgKS5vZmYoICd3cGJjX2NhbGVuZGFyX2FqeF9fbG9hZGVkX2RhdGEnICsgRVZFTlRfTkFNRVNQQUNFICk7XG5cdFx0XHRcdCQoIGRvY3VtZW50ICkub2ZmKCAnYWpheFNlbmQnICsgQUpBWF9DQVBUVVJFX05BTUVTUEFDRSApO1xuXHRcdFx0XHRwZW5kaW5nX2NhbGVuZGFyX3JlcXVlc3QgPSBudWxsO1xuXHRcdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiBvbl9sb2FkZWQgKSB7XG5cdFx0XHRcdFx0b25fbG9hZGVkKCByZXNvdXJjZV9pZCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRjYXB0dXJlX2hhbmRsZXIgPSBmdW5jdGlvbiAoIGV2ZW50LCBqcV94aHIsIGFqYXhfc2V0dGluZ3MgKSB7XG5cdFx0XHRcdHZhciByZXF1ZXN0X2JvZHkgPSBTdHJpbmcoIGFqYXhfc2V0dGluZ3MgJiYgYWpheF9zZXR0aW5ncy5kYXRhID8gYWpheF9zZXR0aW5ncy5kYXRhIDogJycgKTtcblx0XHRcdFx0dmFyIGRlY29kZWRfYm9keTtcblxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGRlY29kZWRfYm9keSA9IGRlY29kZVVSSUNvbXBvbmVudCggcmVxdWVzdF9ib2R5LnJlcGxhY2UoIC9cXCsvZywgJyUyMCcgKSApO1xuXHRcdFx0XHR9IGNhdGNoICggZGVjb2RlX2Vycm9yICkge1xuXHRcdFx0XHRcdGRlY29kZWRfYm9keSA9IHJlcXVlc3RfYm9keTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0ISAvKD86XnwmKWFjdGlvbj1XUEJDX0FKWF9DQUxFTkRBUl9MT0FEKD86JnwkKS8udGVzdCggZGVjb2RlZF9ib2R5ICkgfHxcblx0XHRcdFx0XHQhIG5ldyBSZWdFeHAoICcoPzpefCYpY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXNcXFxcW3Jlc291cmNlX2lkXFxcXF09JyArIHJlc291cmNlX2lkICsgJyg/OiZ8JCknICkudGVzdCggZGVjb2RlZF9ib2R5IClcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdCQoIGRvY3VtZW50ICkub2ZmKCAnYWpheFNlbmQnICsgQUpBWF9DQVBUVVJFX05BTUVTUEFDRSwgY2FwdHVyZV9oYW5kbGVyICk7XG5cdFx0XHRcdHBlbmRpbmdfY2FsZW5kYXJfcmVxdWVzdCA9IGpxX3hocjtcblx0XHRcdFx0anFfeGhyLmZhaWwoIGZ1bmN0aW9uICggZmFpbGVkX3JlcXVlc3QsIHJlcXVlc3Rfc3RhdHVzICkge1xuXHRcdFx0XHRcdGlmIChcblx0XHRcdFx0XHQnYWJvcnQnID09PSByZXF1ZXN0X3N0YXR1cyB8fFxuXHRcdFx0XHRcdGFjdGl2ZV9hZGFwdGVyICE9PSBhZGFwdGVyX2FwaSB8fFxuXHRcdFx0XHRcdGN1cnJlbnRfZ2VuZXJhdGlvbiAhPT0gbG9hZF9nZW5lcmF0aW9uXG5cdFx0XHRcdCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHQkKCAnYm9keScgKS5vZmYoICd3cGJjX2NhbGVuZGFyX2FqeF9fbG9hZGVkX2RhdGEnICsgRVZFTlRfTkFNRVNQQUNFICk7XG5cdFx0XHRcdFx0cGVuZGluZ19jYWxlbmRhcl9yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiBvbl9mYWlsZWQgKSB7XG5cdFx0XHRcdFx0XHRvbl9mYWlsZWQoIGZhaWxlZF9yZXF1ZXN0ICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9O1xuXHRcdFx0JCggZG9jdW1lbnQgKS5vZmYoICdhamF4U2VuZCcgKyBBSkFYX0NBUFRVUkVfTkFNRVNQQUNFICk7XG5cdFx0XHQkKCBkb2N1bWVudCApLm9uKCAnYWpheFNlbmQnICsgQUpBWF9DQVBUVVJFX05BTUVTUEFDRSwgY2FwdHVyZV9oYW5kbGVyICk7XG5cdFx0XHR3aW5kb3cud3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hangoIG5vcm1hbGl6ZWRfcmVxdWVzdCApO1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBYm9ydCB0aGUgYWRhcHRlcidzIG1hdGNoaW5nIG5hdGl2ZSByZXF1ZXN0IGFuZCBpbnZhbGlkYXRlIGl0cyBjYWxsYmFja3MuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGFib3J0X2xvYWQoKSB7XG5cdFx0XHRsb2FkX2dlbmVyYXRpb24gKz0gMTtcblx0XHRcdCQoICdib2R5JyApLm9mZiggJ3dwYmNfY2FsZW5kYXJfYWp4X19sb2FkZWRfZGF0YScgKyBFVkVOVF9OQU1FU1BBQ0UgKTtcblx0XHRcdCQoIGRvY3VtZW50ICkub2ZmKCAnYWpheFNlbmQnICsgQUpBWF9DQVBUVVJFX05BTUVTUEFDRSApO1xuXHRcdFx0aWYgKCB3aW5kb3cuX3dwYmMgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5fd3BiYy5iYWxhbmNlcl9fcmVtb3ZlX2Zyb21fX3dhaXRfbGlzdCAmJiByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0d2luZG93Ll93cGJjLmJhbGFuY2VyX19yZW1vdmVfZnJvbV9fd2FpdF9saXN0KCByZXNvdXJjZV9pZCwgJ3dwYmNfY2FsZW5kYXJfX2xvYWRfZGF0YV9fYWp4JyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBwZW5kaW5nX2NhbGVuZGFyX3JlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHBlbmRpbmdfY2FsZW5kYXJfcmVxdWVzdC5hYm9ydCApIHtcblx0XHRcdFx0cGVuZGluZ19jYWxlbmRhcl9yZXF1ZXN0LmFib3J0KCk7XG5cdFx0XHR9XG5cdFx0XHRwZW5kaW5nX2NhbGVuZGFyX3JlcXVlc3QgPSBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN3aXRjaCBiZXR3ZWVuIG5hdGl2ZSBwb2xpY3kgYW5kIGluZGl2aWR1YWwtZGF0ZSBzZWxlY3Rpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gc2VsZWN0aW9uX21vZGUgYHBvbGljeWAgb3IgYGluZGl2aWR1YWxgLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBuYXRpdmUgc2VsZWN0aW9uIG1vZGUgd2FzIGFwcGxpZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X3NlbGVjdGlvbl9tb2RlKCBzZWxlY3Rpb25fbW9kZSApIHtcblx0XHRcdHZhciBzZWxlY3RlZF9kYXRlcztcblxuXHRcdFx0aWYgKCBhY3RpdmVfYWRhcHRlciAhPT0gYWRhcHRlcl9hcGkgfHwgISByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRzZWxlY3RlZF9kYXRlcyA9IGdldF9zZWxlY3RlZF9kYXRlcygpO1xuXHRcdFx0aWYgKCBNT0RFX0lORElWSURVQUwgPT09IHNlbGVjdGlvbl9tb2RlICkge1xuXHRcdFx0XHRpZiAoICdmdW5jdGlvbicgIT09IHR5cGVvZiB3aW5kb3cud3BiY19jYWxfZGF5c19zZWxlY3RfX211bHRpcGxlICkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHR3aW5kb3cud3BiY19jYWxfZGF5c19zZWxlY3RfX211bHRpcGxlKCByZXNvdXJjZV9pZCApO1xuXHRcdFx0fSBlbHNlIGlmICggTU9ERV9QT0xJQ1kgPT09IHNlbGVjdGlvbl9tb2RlICkge1xuXHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0J2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy53cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmVfaW5pdCB8fFxuXHRcdFx0XHRcdCdmdW5jdGlvbicgIT09IHR5cGVvZiB3aW5kb3cud3BiY19jYWxfX3JlX2luaXRcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHdpbmRvdy5fd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtZXRlcnMoIHJlc291cmNlX2lkLCBwb2xpY3lfcGFyYW1ldGVycyApO1xuXHRcdFx0XHR3aW5kb3cud3BiY19jYWxfZGF5c19zZWxlY3RfX3JlX2luaXQoIHJlc291cmNlX2lkICk7XG5cdFx0XHRcdHdpbmRvdy53cGJjX2NhbF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUG9saWN5IGNoYW5nZXMgbWF5IHJlamVjdCB0aGUgZXhpc3Rpbmcgc2hhcGUuIFByZXNlcnZlIGl0IGRpcmVjdGx5IHdoZW5cblx0XHRcdC8vIHBvc3NpYmxlLCBidXQga2VlcCB0aGUgZWRpdG9yIHVzYWJsZSB3aGVuIHRoZSBwb2xpY3kgY2Fubm90IHJlc2VsZWN0IGl0LlxuXHRcdFx0c2V0X2V4YWN0X3NlbGVjdGVkX2RhdGVzKCBzZWxlY3RlZF9kYXRlcyApO1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBUZWFyIGRvd24gb25seSBzdGF0ZSBvd25lZCBieSB0aGlzIGFkYXB0ZXIuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHRlYXJkb3duKCkge1xuXHRcdFx0dmFyIGNhbGVuZGFyX2VsZW1lbnQ7XG5cblx0XHRcdGFib3J0X2xvYWQoKTtcblxuXHRcdFx0Y2FsZW5kYXJfZWxlbWVudCA9IHJlc291cmNlX2lkID8gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkgOiBudWxsO1xuXHRcdFx0aWYgKCBjYWxlbmRhcl9lbGVtZW50ICYmICQuZm4uZGF0ZXBpY2sgKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0JCggY2FsZW5kYXJfZWxlbWVudCApLmRhdGVwaWNrKCAnZGVzdHJveScgKTtcblx0XHRcdFx0fSBjYXRjaCAoIGRlc3Ryb3lfZXJyb3IgKSB7XG5cdFx0XHRcdFx0Ly8gQSBwYXJ0aWFsbHkgaW5pdGlhbGl6ZWQgY2FsZW5kYXIgc3RpbGwgbmVlZHMgaXRzIG93bmVkIG1hcmt1cCByZW1vdmVkLlxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICggd2luZG93Ll93cGJjICYmIHJlc291cmNlX2lkICkge1xuXHRcdFx0XHRyZXN0b3JlX25hdGl2ZV9jYWxlbmRhcl9yZWdpc3RyeV9lbnRyeSggY2FsZW5kYXJfcmVnaXN0cnlfc25hcHNob3QgKTtcblx0XHRcdFx0T2JqZWN0LmtleXMoIHByZXZpb3VzX290aGVyX3BhcmFtZXRlcnMgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHBhcmFtZXRlcl9uYW1lICkge1xuXHRcdFx0XHRcdHdpbmRvdy5fd3BiYy5zZXRfb3RoZXJfcGFyYW0oIHBhcmFtZXRlcl9uYW1lLCBwcmV2aW91c19vdGhlcl9wYXJhbWV0ZXJzWyBwYXJhbWV0ZXJfbmFtZSBdICk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0T2JqZWN0LmtleXMoIHByZXZpb3VzX3NlY3VyZV9wYXJhbWV0ZXJzICkuZm9yRWFjaCggZnVuY3Rpb24gKCBwYXJhbWV0ZXJfbmFtZSApIHtcblx0XHRcdFx0XHR3aW5kb3cuX3dwYmMuc2V0X3NlY3VyZV9wYXJhbSggcGFyYW1ldGVyX25hbWUsIHByZXZpb3VzX3NlY3VyZV9wYXJhbWV0ZXJzWyBwYXJhbWV0ZXJfbmFtZSBdICk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblxuXHRcdFx0Y2xlYXJfaG9zdCggaG9zdCApO1xuXHRcdFx0aG9zdCA9IG51bGw7XG5cdFx0XHRyZXNvdXJjZV9pZCA9IDA7XG5cdFx0XHRwb2xpY3lfcGFyYW1ldGVycyA9IHt9O1xuXHRcdFx0Y2FsZW5kYXJfcmVnaXN0cnlfc25hcHNob3QgPSBudWxsO1xuXHRcdFx0cHJldmlvdXNfb3RoZXJfcGFyYW1ldGVycyA9IHt9O1xuXHRcdFx0cHJldmlvdXNfc2VjdXJlX3BhcmFtZXRlcnMgPSB7fTtcblx0XHRcdGlmICggYWN0aXZlX2FkYXB0ZXIgPT09IGFkYXB0ZXJfYXBpICkge1xuXHRcdFx0XHRhY3RpdmVfYWRhcHRlciA9IG51bGw7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dmFyIGFkYXB0ZXJfYXBpID0ge1xuXHRcdFx0bW91bnQ6IG1vdW50LFxuXHRcdFx0bG9hZDogbG9hZCxcblx0XHRcdGFib3J0X2xvYWQ6IGFib3J0X2xvYWQsXG5cdFx0XHRzZXRfZXhhY3Rfc2VsZWN0ZWRfZGF0ZXM6IHNldF9leGFjdF9zZWxlY3RlZF9kYXRlcyxcblx0XHRcdHNldF9zZWxlY3Rpb25fbW9kZTogc2V0X3NlbGVjdGlvbl9tb2RlLFxuXHRcdFx0Z2V0X3NlbGVjdGVkX2RhdGVzOiBnZXRfc2VsZWN0ZWRfZGF0ZXMsXG5cdFx0XHR0ZWFyZG93bjogdGVhcmRvd25cblx0XHR9O1xuXG5cdFx0cmV0dXJuIGFkYXB0ZXJfYXBpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENsb25lIHRoZSBzbWFsbCBKU09OLXNhZmUgRGF0ZSBFZGl0b3IgZHJhZnQgY29udHJhY3QuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBlZGl0b3JfZHJhZnQgRGF0ZSBFZGl0b3IgZHJhZnQuXG5cdCAqXG5cdCAqIEByZXR1cm4ge09iamVjdH0gSW5kZXBlbmRlbnQgZHJhZnQgY29weS5cblx0ICovXG5cdGZ1bmN0aW9uIGNsb25lX2VkaXRvcl9kcmFmdCggZWRpdG9yX2RyYWZ0ICkge1xuXHRcdGVkaXRvcl9kcmFmdCA9IGVkaXRvcl9kcmFmdCAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIGVkaXRvcl9kcmFmdCA/IGVkaXRvcl9kcmFmdCA6IHt9O1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHNlbGVjdGlvbl9tZXRob2Q6IE1PREVfSU5ESVZJRFVBTCA9PT0gZWRpdG9yX2RyYWZ0LnNlbGVjdGlvbl9tZXRob2QgPyBNT0RFX0lORElWSURVQUwgOiBNT0RFX1BPTElDWSxcblx0XHRcdHRpbWVfYXBwbGljYXRpb246IC0xICE9PSBbIFRJTUVfQVBQTElDQVRJT05fRlVMTF9EQVksIFRJTUVfQVBQTElDQVRJT05fQk9VTkRBUlksIFRJTUVfQVBQTElDQVRJT05fUEVSX0RBVEUgXS5pbmRleE9mKCBlZGl0b3JfZHJhZnQudGltZV9hcHBsaWNhdGlvbiApID8gZWRpdG9yX2RyYWZ0LnRpbWVfYXBwbGljYXRpb24gOiBUSU1FX0FQUExJQ0FUSU9OX0ZVTExfREFZLFxuXHRcdFx0c3RhcnRfdGltZTogbm9ybWFsaXplX2V4YWN0X21pbnV0ZV90aW1lKCBlZGl0b3JfZHJhZnQuc3RhcnRfdGltZSApLFxuXHRcdFx0ZW5kX3RpbWU6IG5vcm1hbGl6ZV9leGFjdF9taW51dGVfdGltZSggZWRpdG9yX2RyYWZ0LmVuZF90aW1lICksXG5cdFx0XHRzZWxlY3RlZF9kYXRlczogbm9ybWFsaXplX2lzb19kYXRlcyggZWRpdG9yX2RyYWZ0LnNlbGVjdGVkX2RhdGVzIClcblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZSB0aGUgaW1tdXRhYmxlIGF1dGhvcml6ZWQgc2F2ZWQgc25hcHNob3QuXG5cdCAqXG5cdCAqIEZyZWV6aW5nIGJvdGggbGV2ZWxzIHByZXZlbnRzIGh5ZHJhdGlvbiBmYWxsYmFjayBvciBsYXRlciBpbnRlcmFjdGlvbiBmcm9tXG5cdCAqIHNpbGVudGx5IHJld3JpdGluZyB0aGUgY2Fub25pY2FsIGNvbXBhcmlzb24gc291cmNlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gZWRpdG9yX2RyYWZ0IEF1dGhvcml6ZWQgaW5pdGlhbCBEYXRlIEVkaXRvciB2YWx1ZXMuXG5cdCAqXG5cdCAqIEByZXR1cm4ge09iamVjdH0gRnJvemVuIHNhdmVkIHNuYXBzaG90LlxuXHQgKi9cblx0ZnVuY3Rpb24gZnJlZXplX2VkaXRvcl9kcmFmdCggZWRpdG9yX2RyYWZ0ICkge1xuXHRcdHZhciBmcm96ZW5fZHJhZnQgPSBjbG9uZV9lZGl0b3JfZHJhZnQoIGVkaXRvcl9kcmFmdCApO1xuXG5cdFx0T2JqZWN0LmZyZWV6ZSggZnJvemVuX2RyYWZ0LnNlbGVjdGVkX2RhdGVzICk7XG5cblx0XHRyZXR1cm4gT2JqZWN0LmZyZWV6ZSggZnJvemVuX2RyYWZ0ICk7XG5cdH1cblxuXHQvKipcblx0ICogQnVpbGQgdGhlIHNlbWFudGljIHByb3Bvc2FsIHVzZWQgZm9yIGRpcnR5IGNvbXBhcmlzb24uXG5cdCAqXG5cdCAqIEZ1bGwtZGF5IHByb3Bvc2FscyByZXRhaW4gdGltZSBpbnB1dHMgaW4gYnJvd3NlciBtZW1vcnkgc28gc3dpdGNoaW5nIG1vZGVzXG5cdCAqIGlzIGxvc3NsZXNzLCBidXQgdGhlIGVmZmVjdGl2ZSBwcm9wb3NhbCBkZWxpYmVyYXRlbHkgaGFzIG5vIGJvdW5kYXJpZXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBlZGl0b3JfZHJhZnQgU2F2ZWQgb3IgbXV0YWJsZSBicm93c2VyIGRyYWZ0LlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IE5vcm1hbGl6ZWQgbm9uLXBlcnNpc3RlbnQgcHJvcG9zYWwuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfZWZmZWN0aXZlX2VkaXRvcl9kcmFmdCggZWRpdG9yX2RyYWZ0ICkge1xuXHRcdHZhciBlZmZlY3RpdmVfZHJhZnQgPSBjbG9uZV9lZGl0b3JfZHJhZnQoIGVkaXRvcl9kcmFmdCApO1xuXG5cdFx0aWYgKCBUSU1FX0FQUExJQ0FUSU9OX0ZVTExfREFZID09PSBlZmZlY3RpdmVfZHJhZnQudGltZV9hcHBsaWNhdGlvbiApIHtcblx0XHRcdGVmZmVjdGl2ZV9kcmFmdC5zdGFydF90aW1lID0gJyc7XG5cdFx0XHRlZmZlY3RpdmVfZHJhZnQuZW5kX3RpbWUgPSAnJztcblx0XHR9XG5cblx0XHRyZXR1cm4gZWZmZWN0aXZlX2RyYWZ0O1xuXHR9XG5cblx0LyoqXG5cdCAqIFN1YnN0aXR1dGUgb3JkZXJlZCB0aW1lIHZhbHVlcyBpbnRvIG9uZSBsb2NhbGl6ZWQgbGFiZWwgdGVtcGxhdGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgbGFiZWxfdGVtcGxhdGUgTG9jYWxpemVkIGAlc2Agb3IgbnVtYmVyZWQgcGxhY2Vob2xkZXIgdGVtcGxhdGUuXG5cdCAqIEBwYXJhbSB7QXJyYXk8c3RyaW5nPn0gdGltZV92YWx1ZXMgICAgRXhhY3QtbWludXRlIHJlcGxhY2VtZW50IHZhbHVlcy5cblx0ICpcblx0ICogQHJldHVybiB7c3RyaW5nfSBMb2NhbGl6ZWQgdGltZSBsYWJlbC5cblx0ICovXG5cdGZ1bmN0aW9uIGZvcm1hdF9lZGl0b3JfdGltZV9sYWJlbCggbGFiZWxfdGVtcGxhdGUsIHRpbWVfdmFsdWVzICkge1xuXHRcdHZhciBmb3JtYXR0ZWRfbGFiZWwgPSBTdHJpbmcoIGxhYmVsX3RlbXBsYXRlIHx8ICcnICk7XG5cblx0XHR0aW1lX3ZhbHVlcy5mb3JFYWNoKCBmdW5jdGlvbiAoIHRpbWVfdmFsdWUsIHRpbWVfaW5kZXggKSB7XG5cdFx0XHRmb3JtYXR0ZWRfbGFiZWwgPSBmb3JtYXR0ZWRfbGFiZWwucmVwbGFjZSggJyUnICsgKCB0aW1lX2luZGV4ICsgMSApICsgJyRzJywgdGltZV92YWx1ZSApO1xuXHRcdFx0aWYgKCAwID09PSB0aW1lX2luZGV4ICkge1xuXHRcdFx0XHRmb3JtYXR0ZWRfbGFiZWwgPSBmb3JtYXR0ZWRfbGFiZWwucmVwbGFjZSggJyVzJywgdGltZV92YWx1ZSApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblxuXHRcdHJldHVybiBmb3JtYXR0ZWRfbGFiZWw7XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlIHRoZSBEYXRlIEVkaXRvciBpbnRlcmFjdGlvbiBjb250cm9sbGVyIGluc2lkZSBvbmUgSW5zcGVjdG9yIHNoZWxsLlxuXHQgKlxuXHQgKiBUaGUgY29udHJvbGxlciBvd25zIGJyb3dzZXIgZHJhZnRzLCBuYXRpdmUtY2FsZW5kYXIgbGlmZWN5Y2xlLCByZXZpZXdcblx0ICogcHJlc2VudGF0aW9uLCBhbmQgdHJhbnNwb3J0IHRvIHRoZSBhdXRob3JpdGF0aXZlIGFwcGx5IGVuZHBvaW50LiBJdCBuZXZlclxuXHQgKiBhdXRob3JpemVzIGEgYm9va2luZyBvciB0cmVhdHMgbmF0aXZlIGNhbGVuZGFyIHN0YXRlIGFzIHBlcnNpc3RlbmNlXG5cdCAqIGF1dGhvcml0eS5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gaW5zcGVjdG9yX3NoZWxsIEJvb2tpbmcgSW5zcGVjdG9yIHNoZWxsIHJvb3QuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGNvbmZpZ3VyYXRpb24gICBTZXJ2ZXItb3duZWQgRGF0ZSBFZGl0b3IgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgb3B0aW9ucyAgICAgICAgIEluc3BlY3Rvci1vd25lZCB0cmFuc3BvcnQgYW5kIGZvY3VzIGNhbGxiYWNrcy5cblx0ICpcblx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IERhdGUgRWRpdG9yIGNvbnRyb2xsZXIsIG9yIG51bGwgd2hlbiBpbmFjdGl2ZS5cblx0ICovXG5cdGZ1bmN0aW9uIGNyZWF0ZV9jb250cm9sbGVyKCBpbnNwZWN0b3Jfc2hlbGwsIGNvbmZpZ3VyYXRpb24sIG9wdGlvbnMgKSB7XG5cdFx0dmFyIHNldHRpbmdzID0gY29uZmlndXJhdGlvbiAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIGNvbmZpZ3VyYXRpb24gPyBjb25maWd1cmF0aW9uIDoge307XG5cdFx0dmFyIGNvbnRyb2xsZXJfb3B0aW9ucyA9IG9wdGlvbnMgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBvcHRpb25zID8gb3B0aW9ucyA6IHt9O1xuXHRcdHZhciBpMThuID0gc2V0dGluZ3MuaTE4biAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIHNldHRpbmdzLmkxOG4gPyBzZXR0aW5ncy5pMThuIDoge307XG5cdFx0dmFyIHJlYWRfc2V0dGluZ3MgPSBzZXR0aW5ncy5yZWFkICYmICdvYmplY3QnID09PSB0eXBlb2Ygc2V0dGluZ3MucmVhZCA/IHNldHRpbmdzLnJlYWQgOiB7fTtcblx0XHR2YXIgcmV2aWV3X3NldHRpbmdzID0gc2V0dGluZ3MucmV2aWV3ICYmICdvYmplY3QnID09PSB0eXBlb2Ygc2V0dGluZ3MucmV2aWV3ID8gc2V0dGluZ3MucmV2aWV3IDoge307XG5cdFx0dmFyIGFwcGx5X3NldHRpbmdzID0gc2V0dGluZ3MuYXBwbHkgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBzZXR0aW5ncy5hcHBseSA/IHNldHRpbmdzLmFwcGx5IDoge307XG5cdFx0dmFyIHRlbXBsYXRlID0gd2luZG93LndwICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3AudGVtcGxhdGUgJiYgc2V0dGluZ3MudGVtcGxhdGVfaWRcblx0XHRcdD8gd2luZG93LndwLnRlbXBsYXRlKCBzZXR0aW5ncy50ZW1wbGF0ZV9pZCApXG5cdFx0XHQ6IG51bGw7XG5cdFx0dmFyIHJldmlld190ZW1wbGF0ZSA9IHdpbmRvdy53cCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwLnRlbXBsYXRlICYmIHNldHRpbmdzLnJldmlld190ZW1wbGF0ZV9pZFxuXHRcdFx0PyB3aW5kb3cud3AudGVtcGxhdGUoIHNldHRpbmdzLnJldmlld190ZW1wbGF0ZV9pZCApXG5cdFx0XHQ6IG51bGw7XG5cdFx0dmFyIGluc3BlY3Rvcl9wYW5lbCA9IGluc3BlY3Rvcl9zaGVsbCA/IGluc3BlY3Rvcl9zaGVsbC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfc2hhcmVkX3VpX2luc3BlY3Rvcl9fcGFuZWwnICkgOiBudWxsO1xuXHRcdHZhciBsYXllciA9IG51bGw7XG5cdFx0dmFyIG9wZW5lciA9IG51bGw7XG5cdFx0dmFyIHJlYWRfcmVxdWVzdCA9IG51bGw7XG5cdFx0dmFyIHJldmlld19yZXF1ZXN0ID0gbnVsbDtcblx0XHR2YXIgYXBwbHlfcmVxdWVzdCA9IG51bGw7XG5cdFx0dmFyIG5hdGl2ZV9hZGFwdGVyID0gbnVsbDtcblx0XHR2YXIgYWN0aXZlX2VkaXRvciA9IG51bGw7XG5cdFx0dmFyIGFjdGl2ZV9yZXZpZXcgPSBudWxsO1xuXHRcdHZhciBwZW5kaW5nX2FwcGx5X3Jlc3VsdCA9IG51bGw7XG5cdFx0dmFyIHNhdmVkX2RyYWZ0ID0gbnVsbDtcblx0XHR2YXIgZHJhZnQgPSBudWxsO1xuXHRcdHZhciBjb250cm9sbGVyX2dlbmVyYXRpb24gPSAwO1xuXHRcdHZhciByZXZpZXdfZ2VuZXJhdGlvbiA9IDA7XG5cdFx0dmFyIGFwcGx5X2dlbmVyYXRpb24gPSAwO1xuXHRcdHZhciBuYXRpdmVfbG9hZF90aW1lciA9IG51bGw7XG5cdFx0dmFyIGRpcnR5ID0gZmFsc2U7XG5cblx0XHRpZiAoICEgc2V0dGluZ3MuYWN0aXZlIHx8ICEgaW5zcGVjdG9yX3NoZWxsIHx8ICEgaW5zcGVjdG9yX3BhbmVsIHx8ICEgdGVtcGxhdGUgfHwgISByZXZpZXdfdGVtcGxhdGUgfHwgISB3aW5kb3cualF1ZXJ5ICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQW5ub3VuY2UgYW5kIGRpc3BsYXkgb25lIGxpZmVjeWNsZSBtZXNzYWdlIHdpdGggYWNjZXNzaWJsZSBzZXZlcml0eS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgbWVzc2FnZSAgICAgICBMb2NhbGl6ZWQgc3RhdHVzIG1lc3NhZ2UuXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBzaG93X3Zpc3VhbGx5IFdoZXRoZXIgdGhlIG1lc3NhZ2UgbmVlZHMgYSB2aXNpYmxlIHN0cmlwLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgW3N0YXR1c190eXBlXSBPcHRpb25hbCB3YXJuaW5nIG9yIGVycm9yIHNldmVyaXR5LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfc3RhdHVzKCBtZXNzYWdlLCBzaG93X3Zpc3VhbGx5LCBzdGF0dXNfdHlwZSApIHtcblx0XHRcdHZhciBzdGF0dXMgPSBsYXllciA/IGxheWVyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctZGF0ZS1lZGl0b3Itc3RhdHVzXScgKSA6IG51bGw7XG5cdFx0XHR2YXIgaXNfdmlzaWJsZSA9IEJvb2xlYW4oIHNob3dfdmlzdWFsbHkgJiYgbWVzc2FnZSApO1xuXHRcdFx0dmFyIG5vcm1hbGl6ZWRfc3RhdHVzX3R5cGUgPSAnZXJyb3InID09PSBzdGF0dXNfdHlwZSA/ICdlcnJvcicgOiAnd2FybmluZyc7XG5cblx0XHRcdGlmICggc3RhdHVzICkge1xuXHRcdFx0XHRzdGF0dXMudGV4dENvbnRlbnQgPSBTdHJpbmcoIG1lc3NhZ2UgfHwgJycgKTtcblx0XHRcdFx0c3RhdHVzLmNsYXNzTGlzdC50b2dnbGUoICdpcy12aXNpYmxlJywgaXNfdmlzaWJsZSApO1xuXHRcdFx0XHRzdGF0dXMuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLXdhcm5pbmcnLCBpc192aXNpYmxlICYmICd3YXJuaW5nJyA9PT0gbm9ybWFsaXplZF9zdGF0dXNfdHlwZSApO1xuXHRcdFx0XHRzdGF0dXMuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWVycm9yJywgaXNfdmlzaWJsZSAmJiAnZXJyb3InID09PSBub3JtYWxpemVkX3N0YXR1c190eXBlICk7XG5cdFx0XHRcdHN0YXR1cy5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtZW1waGFzaXplZCcgKTtcblx0XHRcdFx0c3RhdHVzLnNldEF0dHJpYnV0ZSggJ3JvbGUnLCBpc192aXNpYmxlICYmICdlcnJvcicgPT09IG5vcm1hbGl6ZWRfc3RhdHVzX3R5cGUgPyAnYWxlcnQnIDogJ3N0YXR1cycgKTtcblx0XHRcdFx0c3RhdHVzLnNldEF0dHJpYnV0ZSggJ2FyaWEtbGl2ZScsIGlzX3Zpc2libGUgJiYgJ2Vycm9yJyA9PT0gbm9ybWFsaXplZF9zdGF0dXNfdHlwZSA/ICdhc3NlcnRpdmUnIDogJ3BvbGl0ZScgKTtcblxuXHRcdFx0XHRpZiAoIGlzX3Zpc2libGUgKSB7XG5cdFx0XHRcdFx0Ly8gUmVzdGFydCB0aGUgYm91bmRlZCBlbXBoYXNpcyB3aGVuIHRoZSBzYW1lIHZhbGlkYXRpb24gbWVzc2FnZSBpcyByZXBlYXRlZC5cblx0XHRcdFx0XHR2b2lkIHN0YXR1cy5vZmZzZXRXaWR0aDtcblx0XHRcdFx0XHRzdGF0dXMuY2xhc3NMaXN0LmFkZCggJ2lzLWVtcGhhc2l6ZWQnICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTaG93IHRoZSBlc3RhYmxpc2hlZCBjZW50ZXJlZCBJbnNwZWN0b3IgbG9hZGluZyBwcmVzZW50YXRpb24uXG5cdFx0ICpcblx0XHQgKiBUaGUgdmlzaWJsZSBsb2FkZXIgbWlycm9ycyB0aGUgc2hhcmVkIEluc3BlY3RvciBzaGVsbC4gTGlmZWN5Y2xlIHRleHQgaXNcblx0XHQgKiBhbHNvIGNvcGllZCB0byB0aGUgaGlkZGVuIGxpdmUgcmVnaW9uIHNvIGxvYWRpbmcgcmVtYWlucyBhbm5vdW5jZWQgd2l0aG91dFxuXHRcdCAqIHJlc2VydmluZyBhIHBlcnNpc3RlbnQgbWVzc2FnZSBzdHJpcCBhYm92ZSB0aGUgZWRpdG9yLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgTG9jYWxpemVkIGxvYWRpbmcgbWVzc2FnZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2hvd19sb2FkaW5nKCBtZXNzYWdlICkge1xuXHRcdFx0dmFyIGxvYWRpbmcgPSBsYXllciA/IGxheWVyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctZGF0ZS1lZGl0b3ItbG9hZGluZ10nICkgOiBudWxsO1xuXHRcdFx0dmFyIGxvYWRpbmdfbGFiZWwgPSBsb2FkaW5nID8gbG9hZGluZy5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLWRhdGUtZWRpdG9yLWxvYWRpbmctbGFiZWxdJyApIDogbnVsbDtcblx0XHRcdHZhciBlcnJvcl9ib3ggPSBsYXllciA/IGxheWVyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctZGF0ZS1lZGl0b3ItZXJyb3JdJyApIDogbnVsbDtcblx0XHRcdHZhciBlZGl0b3JfdmlldyA9IGxheWVyID8gbGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci12aWV3PVwiZWRpdG9yXCJdJyApIDogbnVsbDtcblx0XHRcdHZhciByZXZpZXdfdmlldyA9IGxheWVyID8gbGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci12aWV3PVwicmV2aWV3XCJdJyApIDogbnVsbDtcblxuXHRcdFx0aWYgKCBlcnJvcl9ib3ggKSB7XG5cdFx0XHRcdGVycm9yX2JveC5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBlZGl0b3JfdmlldyApIHtcblx0XHRcdFx0ZWRpdG9yX3ZpZXcuaGlkZGVuID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggcmV2aWV3X3ZpZXcgKSB7XG5cdFx0XHRcdHJldmlld192aWV3LmhpZGRlbiA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGxvYWRpbmdfbGFiZWwgKSB7XG5cdFx0XHRcdGxvYWRpbmdfbGFiZWwudGV4dENvbnRlbnQgPSBTdHJpbmcoIG1lc3NhZ2UgfHwgaTE4bi5sb2FkaW5nX2RhdGVzIHx8ICcnICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGxvYWRpbmcgKSB7XG5cdFx0XHRcdGxvYWRpbmcuaGlkZGVuID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRzZXRfc3RhdHVzKCBtZXNzYWdlLCBmYWxzZSApO1xuXHRcdFx0aWYgKCBsYXllciApIHtcblx0XHRcdFx0bGF5ZXIuc2V0QXR0cmlidXRlKCAnYXJpYS1idXN5JywgJ3RydWUnICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2xlYXIgdGhlIG5hdGl2ZSBsb2FkIHRpbWVvdXQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNsZWFyX25hdGl2ZV9sb2FkX3RpbWVyKCkge1xuXHRcdFx0aWYgKCBudWxsICE9PSBuYXRpdmVfbG9hZF90aW1lciApIHtcblx0XHRcdFx0d2luZG93LmNsZWFyVGltZW91dCggbmF0aXZlX2xvYWRfdGltZXIgKTtcblx0XHRcdFx0bmF0aXZlX2xvYWRfdGltZXIgPSBudWxsO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE5vdGlmeSB0aGUgSW5zcGVjdG9yIHdoZW4gdGhpcyBzZWNvbmRhcnkgbGF5ZXIgY2hhbmdlcyBkaXJ0eSBzdGF0ZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gdXBkYXRlX2RpcnR5X3N0YXRlKCkge1xuXHRcdFx0dmFyIG5leHRfZGlydHkgPSBCb29sZWFuKFxuXHRcdFx0XHRzYXZlZF9kcmFmdCAmJlxuXHRcdFx0XHRkcmFmdCAmJlxuXHRcdFx0XHRKU09OLnN0cmluZ2lmeSggZ2V0X2VmZmVjdGl2ZV9lZGl0b3JfZHJhZnQoIHNhdmVkX2RyYWZ0ICkgKSAhPT0gSlNPTi5zdHJpbmdpZnkoIGdldF9lZmZlY3RpdmVfZWRpdG9yX2RyYWZ0KCBkcmFmdCApIClcblx0XHRcdCk7XG5cblx0XHRcdGlmICggZGlydHkgPT09IG5leHRfZGlydHkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGRpcnR5ID0gbmV4dF9kaXJ0eTtcblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNvbnRyb2xsZXJfb3B0aW9ucy5vbl9kaXJ0eV9jaGFuZ2UgKSB7XG5cdFx0XHRcdGNvbnRyb2xsZXJfb3B0aW9ucy5vbl9kaXJ0eV9jaGFuZ2UoIGRpcnR5ICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVtb3ZlIHRoZSBhY3RpdmUgbGF5ZXIgYW5kIHJlc3RvcmUgZXZlcnkgbmF0aXZlIGdsb2JhbCBpdCBjaGFuZ2VkLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB0ZWFyZG93bl9sYXllcigpIHtcblx0XHRcdGNvbnRyb2xsZXJfZ2VuZXJhdGlvbiArPSAxO1xuXHRcdFx0cmV2aWV3X2dlbmVyYXRpb24gKz0gMTtcblx0XHRcdGFwcGx5X2dlbmVyYXRpb24gKz0gMTtcblx0XHRcdGNsZWFyX25hdGl2ZV9sb2FkX3RpbWVyKCk7XG5cdFx0XHRpZiAoIHJlYWRfcmVxdWVzdCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgcmVhZF9yZXF1ZXN0LmFib3J0ICkge1xuXHRcdFx0XHRyZWFkX3JlcXVlc3QuYWJvcnQoKTtcblx0XHRcdH1cblx0XHRcdHJlYWRfcmVxdWVzdCA9IG51bGw7XG5cdFx0XHRpZiAoIHJldmlld19yZXF1ZXN0ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiByZXZpZXdfcmVxdWVzdC5hYm9ydCApIHtcblx0XHRcdFx0cmV2aWV3X3JlcXVlc3QuYWJvcnQoKTtcblx0XHRcdH1cblx0XHRcdHJldmlld19yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdGlmICggYXBwbHlfcmVxdWVzdCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgYXBwbHlfcmVxdWVzdC5hYm9ydCApIHtcblx0XHRcdFx0YXBwbHlfcmVxdWVzdC5hYm9ydCgpO1xuXHRcdFx0fVxuXHRcdFx0YXBwbHlfcmVxdWVzdCA9IG51bGw7XG5cdFx0XHRpZiAoIG5hdGl2ZV9hZGFwdGVyICkge1xuXHRcdFx0XHRuYXRpdmVfYWRhcHRlci50ZWFyZG93bigpO1xuXHRcdFx0fVxuXHRcdFx0bmF0aXZlX2FkYXB0ZXIgPSBudWxsO1xuXHRcdFx0aWYgKCBsYXllciApIHtcblx0XHRcdFx0d2luZG93LmpRdWVyeSggbGF5ZXIgKS5vZmYoICdkYXRlX3NlbGVjdGVkJyArIEVWRU5UX05BTUVTUEFDRSApO1xuXHRcdFx0XHRsYXllci5yZW1vdmUoKTtcblx0XHRcdH1cblx0XHRcdGxheWVyID0gbnVsbDtcblx0XHRcdGFjdGl2ZV9lZGl0b3IgPSBudWxsO1xuXHRcdFx0YWN0aXZlX3JldmlldyA9IG51bGw7XG5cdFx0XHRwZW5kaW5nX2FwcGx5X3Jlc3VsdCA9IG51bGw7XG5cdFx0XHRzYXZlZF9kcmFmdCA9IG51bGw7XG5cdFx0XHRkcmFmdCA9IG51bGw7XG5cdFx0XHRkaXJ0eSA9IGZhbHNlO1xuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29udHJvbGxlcl9vcHRpb25zLm9uX2RpcnR5X2NoYW5nZSApIHtcblx0XHRcdFx0Y29udHJvbGxlcl9vcHRpb25zLm9uX2RpcnR5X2NoYW5nZSggZmFsc2UgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXNvbHZlIHRoZSBiZXN0IGN1cnJlbnQgZm9jdXMgdGFyZ2V0IGFmdGVyIHRoZSBsYXllciBjbG9zZXMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfSBDb25uZWN0ZWQgZm9jdXMgdGFyZ2V0IG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3Jlc3RvcmVfZm9jdXNfdGFyZ2V0KCkge1xuXHRcdFx0dmFyIGZhbGxiYWNrX2ZvY3VzO1xuXG5cdFx0XHRpZiAoIG9wZW5lciAmJiBvcGVuZXIuaXNDb25uZWN0ZWQgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIG9wZW5lci5mb2N1cyApIHtcblx0XHRcdFx0cmV0dXJuIG9wZW5lcjtcblx0XHRcdH1cblx0XHRcdGZhbGxiYWNrX2ZvY3VzID0gJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNvbnRyb2xsZXJfb3B0aW9ucy5nZXRfcmVzdG9yZV9mb2N1c1xuXHRcdFx0XHQ/IGNvbnRyb2xsZXJfb3B0aW9ucy5nZXRfcmVzdG9yZV9mb2N1cygpXG5cdFx0XHRcdDogbnVsbDtcblxuXHRcdFx0cmV0dXJuIGZhbGxiYWNrX2ZvY3VzICYmIGZhbGxiYWNrX2ZvY3VzLmlzQ29ubmVjdGVkICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBmYWxsYmFja19mb2N1cy5mb2N1c1xuXHRcdFx0XHQ/IGZhbGxiYWNrX2ZvY3VzXG5cdFx0XHRcdDogbnVsbDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDbG9zZSB0aGUgc2Vjb25kYXJ5IGxheWVyIHdpdGggb3B0aW9uYWwgZGlydHkgcHJvdGVjdGlvbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gcmVzdG9yZV9mb2N1cyBXaGV0aGVyIHRvIHJlc3RvcmUgdGhlIGFjdGl2YXRpbmcgY29udHJvbC5cblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGZvcmNlICAgICAgICAgV2hldGhlciBhbiBhbHJlYWR5LWFwcHJvdmVkIHBhcmVudCBjbG9zZSBza2lwcyBwcm9tcHRpbmcuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGxheWVyIGlzIGNsb3NlZCBvciB3YXMgYWxyZWFkeSBjbG9zZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2xvc2UoIHJlc3RvcmVfZm9jdXMsIGZvcmNlICkge1xuXHRcdFx0dmFyIGZvY3VzX3RhcmdldDtcblxuXHRcdFx0aWYgKCAhIGxheWVyICkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggZGlydHkgJiYgISBmb3JjZSAmJiAhIHdpbmRvdy5jb25maXJtKCBpMThuLmRpc2NhcmRfY2hhbmdlcyB8fCAnJyApICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRmb2N1c190YXJnZXQgPSByZXN0b3JlX2ZvY3VzID8gZ2V0X3Jlc3RvcmVfZm9jdXNfdGFyZ2V0KCkgOiBudWxsO1xuXHRcdFx0dGVhcmRvd25fbGF5ZXIoKTtcblx0XHRcdG9wZW5lciA9IG51bGw7XG5cdFx0XHRpZiAoIGZvY3VzX3RhcmdldCApIHtcblx0XHRcdFx0d2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRpZiAoIGZvY3VzX3RhcmdldC5pc0Nvbm5lY3RlZCApIHtcblx0XHRcdFx0XHRcdGZvY3VzX3RhcmdldC5mb2N1cygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSwgMCApO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgYSBmcmVzaCBzaW5nbGUgRGF0ZSBFZGl0b3IgbGF5ZXIgZnJvbSB0aGUgYWxsb3ctbGlzdGVkIHRlbXBsYXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHRlbXBsYXRlX3ZhbHVlcyBBdXRob3JpemVkIG9yIGVtcHR5IHByZXNlbnRhdGlvbiB2YWx1ZXMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfSBSZW5kZXJlZCBsYXllci5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZW5kZXJfbGF5ZXIoIHRlbXBsYXRlX3ZhbHVlcyApIHtcblx0XHRcdHZhciByZW5kZXJfaG9zdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdFx0XHR2YXIgcmVuZGVyZWRfbGF5ZXI7XG5cdFx0XHR2YXIgcmVzdG9yZV9sYXllcl9mb2N1cyA9IEJvb2xlYW4oIGxheWVyICYmIGxheWVyLmNvbnRhaW5zKCBkb2N1bWVudC5hY3RpdmVFbGVtZW50ICkgKTtcblxuXHRcdFx0aWYgKCBsYXllciApIHtcblx0XHRcdFx0bGF5ZXIucmVtb3ZlKCk7XG5cdFx0XHRcdGxheWVyID0gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJlbmRlcl9ob3N0LmlubmVySFRNTCA9IHRlbXBsYXRlKCBPYmplY3QuYXNzaWduKCB7XG5cdFx0XHRcdGluc3BlY3Rvcl9pZDogJ3dwYmNfYm9va2luZ19pbnNwZWN0b3InLFxuXHRcdFx0XHRpMThuOiBpMThuLFxuXHRcdFx0XHRzZWxlY3RlZF9kYXRlczogW11cblx0XHRcdH0sIHRlbXBsYXRlX3ZhbHVlcyB8fCB7fSApICk7XG5cdFx0XHRyZW5kZXJlZF9sYXllciA9IHJlbmRlcl9ob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctZGF0ZS1lZGl0b3ItbGF5ZXJdJyApO1xuXHRcdFx0aWYgKCAhIHJlbmRlcmVkX2xheWVyICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGluc3BlY3Rvcl9wYW5lbC5hcHBlbmRDaGlsZCggcmVuZGVyZWRfbGF5ZXIgKTtcblx0XHRcdGxheWVyID0gcmVuZGVyZWRfbGF5ZXI7XG5cdFx0XHRsYXllci5oaWRkZW4gPSBmYWxzZTtcblx0XHRcdGlmICggcmVzdG9yZV9sYXllcl9mb2N1cyApIHtcblx0XHRcdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdGlmICggbGF5ZXIgKSB7XG5cdFx0XHRcdFx0XHRsYXllci5mb2N1cygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gbGF5ZXI7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogVG9nZ2xlIHRoZSBlZGl0YWJsZS9lcnJvciBwcmVzZW50YXRpb24gd2l0aG91dCByZXBsYWNpbmcgbmF0aXZlIG1hcmt1cC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgbWVzc2FnZSAgICBTYWZlIGxvY2FsaXplZCBvciBlbmRwb2ludC1ub3JtYWxpemVkIG1lc3NhZ2UuXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBhbGxvd19yZXRyeSBXaGV0aGVyIFJldHJ5IHJlbWFpbnMgYXZhaWxhYmxlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzaG93X2Vycm9yKCBtZXNzYWdlLCBhbGxvd19yZXRyeSApIHtcblx0XHRcdHZhciBsb2FkaW5nID0gbGF5ZXIgPyBsYXllci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLWRhdGUtZWRpdG9yLWxvYWRpbmddJyApIDogbnVsbDtcblx0XHRcdHZhciBlcnJvcl9ib3ggPSBsYXllciA/IGxheWVyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctZGF0ZS1lZGl0b3ItZXJyb3JdJyApIDogbnVsbDtcblx0XHRcdHZhciBlcnJvcl9tZXNzYWdlID0gZXJyb3JfYm94ID8gZXJyb3JfYm94LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctZGF0ZS1lZGl0b3ItZXJyb3ItbWVzc2FnZV0nICkgOiBudWxsO1xuXHRcdFx0dmFyIHJldHJ5X2J1dHRvbiA9IGVycm9yX2JveCA/IGVycm9yX2JveC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLWRhdGUtZWRpdG9yLXJldHJ5XScgKSA6IG51bGw7XG5cdFx0XHR2YXIgZWRpdG9yX3ZpZXcgPSBsYXllciA/IGxheWVyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctZGF0ZS1lZGl0b3Itdmlldz1cImVkaXRvclwiXScgKSA6IG51bGw7XG5cdFx0XHR2YXIgY2FsZW5kYXJfaG9zdCA9IGxheWVyID8gbGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci1jYWxlbmRhci1ob3N0XScgKSA6IG51bGw7XG5cblx0XHRcdGNsZWFyX25hdGl2ZV9sb2FkX3RpbWVyKCk7XG5cdFx0XHRpZiAoIGxvYWRpbmcgKSB7XG5cdFx0XHRcdGxvYWRpbmcuaGlkZGVuID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggZWRpdG9yX3ZpZXcgKSB7XG5cdFx0XHRcdGVkaXRvcl92aWV3LmhpZGRlbiA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGVycm9yX2JveCApIHtcblx0XHRcdFx0ZXJyb3JfYm94LmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBlcnJvcl9tZXNzYWdlICkge1xuXHRcdFx0XHRlcnJvcl9tZXNzYWdlLnRleHRDb250ZW50ID0gU3RyaW5nKCBtZXNzYWdlIHx8IGkxOG4ubG9hZF9lcnJvciB8fCAnJyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCByZXRyeV9idXR0b24gKSB7XG5cdFx0XHRcdHJldHJ5X2J1dHRvbi5oaWRkZW4gPSAhIGFsbG93X3JldHJ5O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjYWxlbmRhcl9ob3N0ICkge1xuXHRcdFx0XHRjYWxlbmRhcl9ob3N0LnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsICdmYWxzZScgKTtcblx0XHRcdH1cblx0XHRcdHNldF9zdGF0dXMoIG1lc3NhZ2UsIGZhbHNlICk7XG5cdFx0XHRsYXllci5zZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knLCAnZmFsc2UnICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU2hvdyBjb250cm9scyBhZnRlciB0aGUgbmF0aXZlIGNhbGVuZGFyIGhhcyBsb2FkZWQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gIG1lc3NhZ2UgICAgICAgIENvbXBsZXRpb24gb3Igbm9uLXRlcm1pbmFsIHdhcm5pbmcuXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBkaXNwbGF5X3dhcm5pbmcgV2hldGhlciB0aGUgbWVzc2FnZSBpcyBhbiBhY3Rpb25hYmxlIHZpc2libGUgd2FybmluZy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2hvd19yZWFkeSggbWVzc2FnZSwgZGlzcGxheV93YXJuaW5nICkge1xuXHRcdFx0dmFyIGxvYWRpbmcgPSBsYXllciA/IGxheWVyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctZGF0ZS1lZGl0b3ItbG9hZGluZ10nICkgOiBudWxsO1xuXHRcdFx0dmFyIGVycm9yX2JveCA9IGxheWVyID8gbGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci1lcnJvcl0nICkgOiBudWxsO1xuXHRcdFx0dmFyIGVkaXRvcl92aWV3ID0gbGF5ZXIgPyBsYXllci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLWRhdGUtZWRpdG9yLXZpZXc9XCJlZGl0b3JcIl0nICkgOiBudWxsO1xuXHRcdFx0dmFyIGNhbGVuZGFyX2hvc3QgPSBsYXllciA/IGxheWVyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctZGF0ZS1lZGl0b3ItY2FsZW5kYXItaG9zdF0nICkgOiBudWxsO1xuXG5cdFx0XHRpZiAoIGxvYWRpbmcgKSB7XG5cdFx0XHRcdGxvYWRpbmcuaGlkZGVuID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggZXJyb3JfYm94ICkge1xuXHRcdFx0XHRlcnJvcl9ib3guaGlkZGVuID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggZWRpdG9yX3ZpZXcgKSB7XG5cdFx0XHRcdGVkaXRvcl92aWV3LmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjYWxlbmRhcl9ob3N0ICkge1xuXHRcdFx0XHRjYWxlbmRhcl9ob3N0LnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsICdmYWxzZScgKTtcblx0XHRcdH1cblx0XHRcdHNldF9zdGF0dXMoIG1lc3NhZ2UsIGRpc3BsYXlfd2FybmluZywgJ3dhcm5pbmcnICk7XG5cdFx0XHRsYXllci5zZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knLCAnZmFsc2UnICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRGV0ZXJtaW5lIHdoZXRoZXIgdGhlIGxvY2FsIGRyYWZ0IGlzIGNvbXBsZXRlIGVub3VnaCBmb3Igc2VydmVyIHJldmlldy5cblx0XHQgKlxuXHRcdCAqIFRoaXMgaXMgYWR2aXNvcnkgb25seS4gVGhlIHJldmlldyBlbmRwb2ludCByZXBlYXRzIHN0cmljdCBub3JtYWxpemF0aW9uLFxuXHRcdCAqIGF1dGhvcml6YXRpb24sIHBvbGljeSwgdGltZSwgYW5kIGF2YWlsYWJpbGl0eSB2YWxpZGF0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBSZXZpZXcgY2hhbmdlcyByZXF1ZXN0IG1heSBiZSBzdWJtaXR0ZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaXNfZHJhZnRfcmV2aWV3YWJsZSgpIHtcblx0XHRcdGlmICggISBkcmFmdCB8fCAhIGRpcnR5IHx8ICEgZHJhZnQuc2VsZWN0ZWRfZGF0ZXMubGVuZ3RoICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBUSU1FX0FQUExJQ0FUSU9OX0ZVTExfREFZID09PSBkcmFmdC50aW1lX2FwcGxpY2F0aW9uIHx8IEJvb2xlYW4oXG5cdFx0XHRcdG5vcm1hbGl6ZV9leGFjdF9taW51dGVfdGltZSggZHJhZnQuc3RhcnRfdGltZSApICYmIG5vcm1hbGl6ZV9leGFjdF9taW51dGVfdGltZSggZHJhZnQuZW5kX3RpbWUgKVxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTeW5jaHJvbml6ZSB0aW1lLWNvbnRyb2wgdmlzaWJpbGl0eSBhbmQgc2VsZWN0ZWQtZGF0ZSBzdW1tYXJpZXMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9kcmFmdF9zdGF0ZSgpIHtcblx0XHRcdHZhciB0aW1lX2ZpZWxkcyA9IGxheWVyID8gbGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci10aW1lLWZpZWxkc10nICkgOiBudWxsO1xuXHRcdFx0dmFyIHRpbWVfaGVscCA9IGxheWVyID8gbGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci10aW1lLWhlbHBdJyApIDogbnVsbDtcblx0XHRcdHZhciB0aW1lX2NvbnRyb2xzID0gbGF5ZXIgPyBsYXllci5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1ib29raW5nLWRhdGUtZWRpdG9yLXRpbWVdJyApIDogW107XG5cdFx0XHR2YXIgc2VsZWN0ZWRfbGlzdCA9IGxheWVyID8gbGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci1zZWxlY3RlZC1kYXRlc10nICkgOiBudWxsO1xuXHRcdFx0dmFyIHNlbGVjdGVkX291dHB1dCA9IGxheWVyID8gbGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci1zdW1tYXJ5PVwic2VsZWN0ZWRfZGF0ZXNcIl0nICkgOiBudWxsO1xuXHRcdFx0dmFyIGNhbGVuZGFyX291dHB1dCA9IGxheWVyID8gbGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci1zdW1tYXJ5PVwiY2FsZW5kYXJfZGF5c1wiXScgKSA6IG51bGw7XG5cdFx0XHR2YXIgbmlnaHRzX291dHB1dCA9IGxheWVyID8gbGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci1zdW1tYXJ5PVwibmlnaHRzXCJdJyApIDogbnVsbDtcblx0XHRcdHZhciB0aW1lX291dHB1dCA9IGxheWVyID8gbGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci1zdW1tYXJ5PVwidGltZVwiXScgKSA6IG51bGw7XG5cdFx0XHR2YXIgcmV2aWV3X2J1dHRvbiA9IGxheWVyID8gbGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci1yZXZpZXddJyApIDogbnVsbDtcblx0XHRcdHZhciBpc19mdWxsX2RheTtcblx0XHRcdHZhciB0aW1lX2ludGVydmFsO1xuXG5cdFx0XHRpZiAoICEgZHJhZnQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlzX2Z1bGxfZGF5ID0gVElNRV9BUFBMSUNBVElPTl9GVUxMX0RBWSA9PT0gZHJhZnQudGltZV9hcHBsaWNhdGlvbjtcblx0XHRcdHRpbWVfaW50ZXJ2YWwgPSBmb3JtYXRfZWRpdG9yX3RpbWVfbGFiZWwoXG5cdFx0XHRcdGkxOG4udGltZV9pbnRlcnZhbCB8fCAnJTEkcyDigJMgJTIkcycsXG5cdFx0XHRcdFsgZHJhZnQuc3RhcnRfdGltZSwgZHJhZnQuZW5kX3RpbWUgXVxuXHRcdFx0KTtcblx0XHRcdGlmICggdGltZV9maWVsZHMgKSB7XG5cdFx0XHRcdHRpbWVfZmllbGRzLmhpZGRlbiA9IGlzX2Z1bGxfZGF5O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aW1lX2hlbHAgKSB7XG5cdFx0XHRcdHRpbWVfaGVscC5oaWRkZW4gPSBUSU1FX0FQUExJQ0FUSU9OX1BFUl9EQVRFICE9PSBkcmFmdC50aW1lX2FwcGxpY2F0aW9uO1xuXHRcdFx0fVxuXHRcdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCggdGltZV9jb250cm9scywgZnVuY3Rpb24gKCB0aW1lX2NvbnRyb2wgKSB7XG5cdFx0XHRcdHRpbWVfY29udHJvbC5kaXNhYmxlZCA9IGlzX2Z1bGxfZGF5O1xuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCBzZWxlY3RlZF9vdXRwdXQgKSB7XG5cdFx0XHRcdHNlbGVjdGVkX291dHB1dC50ZXh0Q29udGVudCA9IFN0cmluZyggZHJhZnQuc2VsZWN0ZWRfZGF0ZXMubGVuZ3RoICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNhbGVuZGFyX291dHB1dCApIHtcblx0XHRcdFx0Y2FsZW5kYXJfb3V0cHV0LnRleHRDb250ZW50ID0gU3RyaW5nKCBkcmFmdC5zZWxlY3RlZF9kYXRlcy5sZW5ndGggKTtcblx0XHRcdH1cblx0XHRcdGlmICggbmlnaHRzX291dHB1dCApIHtcblx0XHRcdFx0bmlnaHRzX291dHB1dC50ZXh0Q29udGVudCA9IFN0cmluZyggVElNRV9BUFBMSUNBVElPTl9CT1VOREFSWSA9PT0gZHJhZnQudGltZV9hcHBsaWNhdGlvbiA/IE1hdGgubWF4KCAwLCBkcmFmdC5zZWxlY3RlZF9kYXRlcy5sZW5ndGggLSAxICkgOiAwICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRpbWVfb3V0cHV0ICkge1xuXHRcdFx0XHR0aW1lX291dHB1dC50ZXh0Q29udGVudCA9IGlzX2Z1bGxfZGF5ID8gU3RyaW5nKCBpMThuLmZ1bGxfZGF5IHx8IGkxOG4uZnVsbF9kYXlzIHx8ICcnICkgOiB0aW1lX2ludGVydmFsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzZWxlY3RlZF9saXN0ICkge1xuXHRcdFx0XHRzZWxlY3RlZF9saXN0LnRleHRDb250ZW50ID0gJyc7XG5cdFx0XHRcdGlmICggISBkcmFmdC5zZWxlY3RlZF9kYXRlcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0dmFyIGVtcHR5X2VudHJ5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2xpJyApO1xuXHRcdFx0XHRcdGVtcHR5X2VudHJ5LmNsYXNzTmFtZSA9ICd3cGJjX2Jvb2tpbmdfaW5zcGVjdG9yX19tdXRlZCc7XG5cdFx0XHRcdFx0ZW1wdHlfZW50cnkudGV4dENvbnRlbnQgPSBTdHJpbmcoIGkxOG4ubm9fc2VsZWN0ZWRfZGF0ZXMgfHwgJycgKTtcblx0XHRcdFx0XHRzZWxlY3RlZF9saXN0LmFwcGVuZENoaWxkKCBlbXB0eV9lbnRyeSApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGRyYWZ0LnNlbGVjdGVkX2RhdGVzLmZvckVhY2goIGZ1bmN0aW9uICggc2VsZWN0ZWRfZGF0ZSwgZGF0ZV9pbmRleCApIHtcblx0XHRcdFx0XHRcdHZhciBkYXRlX2VudHJ5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2xpJyApO1xuXHRcdFx0XHRcdFx0dmFyIGRhdGVfdmFsdWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKTtcblx0XHRcdFx0XHRcdHZhciBkYXRlX21ldGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKTtcblx0XHRcdFx0XHRcdHZhciBpc19maXJzdF9kYXRlID0gMCA9PT0gZGF0ZV9pbmRleDtcblx0XHRcdFx0XHRcdHZhciBpc19sYXN0X2RhdGUgPSBkcmFmdC5zZWxlY3RlZF9kYXRlcy5sZW5ndGggLSAxID09PSBkYXRlX2luZGV4O1xuXG5cdFx0XHRcdFx0XHRkYXRlX3ZhbHVlLnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLWRhdGUtZWRpdG9yLXNlbGVjdGVkLWRhdGUtdmFsdWUnLCAnJyApO1xuXHRcdFx0XHRcdFx0ZGF0ZV92YWx1ZS50ZXh0Q29udGVudCA9IHNlbGVjdGVkX2RhdGU7XG5cdFx0XHRcdFx0XHRkYXRlX21ldGEuY2xhc3NOYW1lID0gJ3dwYmNfYm9va2luZ19pbnNwZWN0b3JfX2RhdGVfZWRpdG9yX3NlbGVjdGVkX2RhdGVfbWV0YSc7XG5cdFx0XHRcdFx0XHRkYXRlX21ldGEuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJvb2tpbmctZGF0ZS1lZGl0b3Itc2VsZWN0ZWQtZGF0ZS1tZXRhJywgJycgKTtcblx0XHRcdFx0XHRcdGlmICggaXNfZnVsbF9kYXkgKSB7XG5cdFx0XHRcdFx0XHRcdGRhdGVfbWV0YS50ZXh0Q29udGVudCA9IFN0cmluZyggaTE4bi5mdWxsX2RheSB8fCBpMThuLmZ1bGxfZGF5cyB8fCAnJyApO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmICggVElNRV9BUFBMSUNBVElPTl9QRVJfREFURSA9PT0gZHJhZnQudGltZV9hcHBsaWNhdGlvbiB8fCAoIGlzX2ZpcnN0X2RhdGUgJiYgaXNfbGFzdF9kYXRlICkgKSB7XG5cdFx0XHRcdFx0XHRcdGRhdGVfbWV0YS50ZXh0Q29udGVudCA9IHRpbWVfaW50ZXJ2YWw7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKCBpc19maXJzdF9kYXRlICkge1xuXHRcdFx0XHRcdFx0XHRkYXRlX21ldGEudGV4dENvbnRlbnQgPSBmb3JtYXRfZWRpdG9yX3RpbWVfbGFiZWwoIGkxOG4uc3RhcnRzX2F0X3RpbWUgfHwgJ1N0YXJ0cyBhdCAlcycsIFsgZHJhZnQuc3RhcnRfdGltZSBdICk7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKCBpc19sYXN0X2RhdGUgKSB7XG5cdFx0XHRcdFx0XHRcdGRhdGVfbWV0YS50ZXh0Q29udGVudCA9IGZvcm1hdF9lZGl0b3JfdGltZV9sYWJlbCggaTE4bi5lbmRzX2F0X3RpbWUgfHwgJ0VuZHMgYXQgJXMnLCBbIGRyYWZ0LmVuZF90aW1lIF0gKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGRhdGVfbWV0YS50ZXh0Q29udGVudCA9IFN0cmluZyggaTE4bi5mdWxsX2RheSB8fCBpMThuLmZ1bGxfZGF5cyB8fCAnJyApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZGF0ZV9lbnRyeS5hcHBlbmRDaGlsZCggZGF0ZV92YWx1ZSApO1xuXHRcdFx0XHRcdFx0ZGF0ZV9lbnRyeS5hcHBlbmRDaGlsZCggZGF0ZV9tZXRhICk7XG5cdFx0XHRcdFx0XHRzZWxlY3RlZF9saXN0LmFwcGVuZENoaWxkKCBkYXRlX2VudHJ5ICk7XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR1cGRhdGVfZGlydHlfc3RhdGUoKTtcblx0XHRcdGlmICggcmV2aWV3X2J1dHRvbiApIHtcblx0XHRcdFx0cmV2aWV3X2J1dHRvbi5kaXNhYmxlZCA9ICEgaXNfZHJhZnRfcmV2aWV3YWJsZSgpO1xuXHRcdFx0XHRyZXZpZXdfYnV0dG9uLnNldEF0dHJpYnV0ZSggJ2FyaWEtZGlzYWJsZWQnLCBpc19kcmFmdF9yZXZpZXdhYmxlKCkgPyAnZmFsc2UnIDogJ3RydWUnICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSHlkcmF0ZSBldmVyeSBjdXJyZW50IGRyYWZ0IGRhdGUgYWZ0ZXIgdGhlIG1hdGNoaW5nIG5hdGl2ZSBsb2FkZWQgZXZlbnQuXG5cdFx0ICpcblx0XHQgKiBBIHNob3J0IGFuaW1hdGlvbi1mcmFtZSByZXRyeSBhY2NvbW1vZGF0ZXMgdGhlIGRhdGVwaWNrZXIncyBvd24gcmVmcmVzaC5cblx0XHQgKiBGYWlsdXJlIGlzIG5vbi10ZXJtaW5hbDogaW5kaXZpZHVhbCBzZWxlY3Rpb24gcmVtYWlucyBhdmFpbGFibGUgYW5kIHRoZVxuXHRcdCAqIHVzZXIgcmVjZWl2ZXMgYSB3YXJuaW5nIGluc3RlYWQgb2YgYSBjbG9zZWQgb3IgdW51c2FibGUgZWRpdG9yLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGdlbmVyYXRpb24gQ3VycmVudCBjb250cm9sbGVyIGdlbmVyYXRpb24uXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGF0dGVtcHQgICAgWmVyby1iYXNlZCBoeWRyYXRpb24gYXR0ZW1wdC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaHlkcmF0ZV9kcmFmdF9kYXRlcyggZ2VuZXJhdGlvbiwgYXR0ZW1wdCApIHtcblx0XHRcdHZhciBoeWRyYXRpb25fY29tcGxldGU7XG5cblx0XHRcdGlmICggZ2VuZXJhdGlvbiAhPT0gY29udHJvbGxlcl9nZW5lcmF0aW9uIHx8ICEgbmF0aXZlX2FkYXB0ZXIgfHwgISBkcmFmdCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aHlkcmF0aW9uX2NvbXBsZXRlID0gbmF0aXZlX2FkYXB0ZXIuc2V0X2V4YWN0X3NlbGVjdGVkX2RhdGVzKCBkcmFmdC5zZWxlY3RlZF9kYXRlcyApO1xuXHRcdFx0aWYgKCBoeWRyYXRpb25fY29tcGxldGUgKSB7XG5cdFx0XHRcdGRyYWZ0LnNlbGVjdGVkX2RhdGVzID0gbmF0aXZlX2FkYXB0ZXIuZ2V0X3NlbGVjdGVkX2RhdGVzKCk7XG5cdFx0XHRcdHJlbmRlcl9kcmFmdF9zdGF0ZSgpO1xuXHRcdFx0XHRzaG93X3JlYWR5KCBpMThuLmNhbGVuZGFyX2xvYWRlZCB8fCAnJywgZmFsc2UgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBhdHRlbXB0IDwgMyApIHtcblx0XHRcdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdGh5ZHJhdGVfZHJhZnRfZGF0ZXMoIGdlbmVyYXRpb24sIGF0dGVtcHQgKyAxICk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRuYXRpdmVfYWRhcHRlci5zZXRfc2VsZWN0aW9uX21vZGUoIE1PREVfSU5ESVZJRFVBTCApO1xuXHRcdFx0aHlkcmF0aW9uX2NvbXBsZXRlID0gbmF0aXZlX2FkYXB0ZXIuc2V0X2V4YWN0X3NlbGVjdGVkX2RhdGVzKCBkcmFmdC5zZWxlY3RlZF9kYXRlcyApO1xuXHRcdFx0ZHJhZnQuc2VsZWN0aW9uX21ldGhvZCA9IE1PREVfSU5ESVZJRFVBTDtcblx0XHRcdEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoIGxheWVyLnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLWJvb2tpbmctZGF0ZS1lZGl0b3Itc2VsZWN0aW9uLW1ldGhvZF0nICksIGZ1bmN0aW9uICggY29udHJvbCApIHtcblx0XHRcdFx0Y29udHJvbC5jaGVja2VkID0gTU9ERV9JTkRJVklEVUFMID09PSBjb250cm9sLnZhbHVlO1xuXHRcdFx0fSApO1xuXHRcdFx0ZHJhZnQuc2VsZWN0ZWRfZGF0ZXMgPSBoeWRyYXRpb25fY29tcGxldGUgPyBuYXRpdmVfYWRhcHRlci5nZXRfc2VsZWN0ZWRfZGF0ZXMoKSA6IGRyYWZ0LnNlbGVjdGVkX2RhdGVzLnNsaWNlKCAwICk7XG5cdFx0XHRyZW5kZXJfZHJhZnRfc3RhdGUoKTtcblx0XHRcdHNob3dfcmVhZHkoIGkxOG4uaHlkcmF0aW9uX3dhcm5pbmcgfHwgJycsIHRydWUgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBNb3VudCBhbmQgbG9hZCB0aGUgc3RhbmRhcmQgbmF0aXZlIGNhbGVuZGFyIGZvciBhbiBhdXRob3JpemVkIGVkaXRvciBEVE8uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gZ2VuZXJhdGlvbiBDdXJyZW50IGNvbnRyb2xsZXIgZ2VuZXJhdGlvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbW91bnRfbmF0aXZlX2NhbGVuZGFyKCBnZW5lcmF0aW9uICkge1xuXHRcdFx0dmFyIGNhbGVuZGFyID0gYWN0aXZlX2VkaXRvciAmJiBhY3RpdmVfZWRpdG9yLmNhbGVuZGFyID8gYWN0aXZlX2VkaXRvci5jYWxlbmRhciA6IHt9O1xuXHRcdFx0dmFyIGNhbGVuZGFyX2hvc3QgPSBsYXllciA/IGxheWVyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctZGF0ZS1lZGl0b3ItY2FsZW5kYXItaG9zdF0nICkgOiBudWxsO1xuXG5cdFx0XHRuYXRpdmVfYWRhcHRlciA9IGNyZWF0ZV9uYXRpdmVfY2FsZW5kYXJfYWRhcHRlcigpO1xuXHRcdFx0aWYgKCBjYWxlbmRhcl9ob3N0ICkge1xuXHRcdFx0XHRjYWxlbmRhcl9ob3N0LnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsICd0cnVlJyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIG5hdGl2ZV9hZGFwdGVyLm1vdW50KCBjYWxlbmRhcl9ob3N0LCB7XG5cdFx0XHRcdHJlc291cmNlX2lkOiBhY3RpdmVfZWRpdG9yLnJlc291cmNlX2lkLFxuXHRcdFx0XHRjYWxlbmRhcl9odG1sOiBjYWxlbmRhci5odG1sIHx8ICcnLFxuXHRcdFx0XHRjYWxlbmRhcl9wYXJhbWV0ZXJzOiBjYWxlbmRhci5jYWxlbmRhcl9wYXJhbWV0ZXJzIHx8IHt9LFxuXHRcdFx0XHRwb2xpY3lfcGFyYW1ldGVyczogY2FsZW5kYXIucG9saWN5X3BhcmFtZXRlcnMgfHwge30sXG5cdFx0XHRcdGNvbnRleHRfcGFyYW1ldGVyczogY2FsZW5kYXIuY29udGV4dF9wYXJhbWV0ZXJzIHx8IHt9LFxuXHRcdFx0XHRzZWN1cmVfcGFyYW1ldGVyczogY2FsZW5kYXIuc2VjdXJlX3BhcmFtZXRlcnMgfHwge31cblx0XHRcdH0gKSApIHtcblx0XHRcdFx0c2hvd19lcnJvciggaTE4bi5jYWxlbmRhcl9lcnJvciB8fCAnJywgdHJ1ZSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHdpbmRvdy5qUXVlcnkoIGxheWVyICkub2ZmKCAnZGF0ZV9zZWxlY3RlZCcgKyBFVkVOVF9OQU1FU1BBQ0UgKS5vbiggJ2RhdGVfc2VsZWN0ZWQnICsgRVZFTlRfTkFNRVNQQUNFLCBmdW5jdGlvbiAoIGV2ZW50LCBzZWxlY3RlZF9yZXNvdXJjZV9pZCwgY2xpY2tlZF9kYXRlcywgc2VsZWN0ZWRfZGF0ZXMgKSB7XG5cdFx0XHRcdGlmICggZ2VuZXJhdGlvbiAhPT0gY29udHJvbGxlcl9nZW5lcmF0aW9uIHx8IG5vcm1hbGl6ZV9yZXNvdXJjZV9pZCggc2VsZWN0ZWRfcmVzb3VyY2VfaWQgKSAhPT0gbm9ybWFsaXplX3Jlc291cmNlX2lkKCBhY3RpdmVfZWRpdG9yLnJlc291cmNlX2lkICkgfHwgISBkcmFmdCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0ZHJhZnQuc2VsZWN0ZWRfZGF0ZXMgPSBub3JtYWxpemVfaXNvX2RhdGVzKCBzZWxlY3RlZF9kYXRlcyApO1xuXHRcdFx0XHRyZW5kZXJfZHJhZnRfc3RhdGUoKTtcblx0XHRcdH0gKTtcblx0XHRcdHNldF9zdGF0dXMoIGkxOG4ubG9hZGluZ19jYWxlbmRhciB8fCAnJywgZmFsc2UgKTtcblx0XHRcdGNsZWFyX25hdGl2ZV9sb2FkX3RpbWVyKCk7XG5cdFx0XHRuYXRpdmVfbG9hZF90aW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmICggZ2VuZXJhdGlvbiA9PT0gY29udHJvbGxlcl9nZW5lcmF0aW9uICYmIGxheWVyICkge1xuXHRcdFx0XHRcdG5hdGl2ZV9hZGFwdGVyLmFib3J0X2xvYWQoKTtcblx0XHRcdFx0XHRzaG93X2Vycm9yKCBpMThuLmNhbGVuZGFyX2Vycm9yIHx8ICcnLCB0cnVlICk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIE5BVElWRV9MT0FEX1RJTUVPVVRfTVMgKTtcblx0XHRcdGlmICggISBuYXRpdmVfYWRhcHRlci5sb2FkKCBjYWxlbmRhci5yZXF1ZXN0X3BhcmFtZXRlcnMgfHwge30sIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0Y2xlYXJfbmF0aXZlX2xvYWRfdGltZXIoKTtcblx0XHRcdFx0aWYgKCBnZW5lcmF0aW9uICE9PSBjb250cm9sbGVyX2dlbmVyYXRpb24gfHwgISBkcmFmdCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gTW9kZSBpbml0aWFsaXphdGlvbiBhbmQgZXhhY3QgaHlkcmF0aW9uIGFyZSBzZXBhcmF0ZS4gQSBwb2xpY3kgbW9kZVxuXHRcdFx0XHQvLyByZWplY3Rpb24gY2Fubm90IHR1cm4gYSByZWFkYWJsZSBjYWxlbmRhciBpbnRvIGEgdGVybWluYWwgZXJyb3IuXG5cdFx0XHRcdG5hdGl2ZV9hZGFwdGVyLnNldF9zZWxlY3Rpb25fbW9kZSggZHJhZnQuc2VsZWN0aW9uX21ldGhvZCApO1xuXHRcdFx0XHRoeWRyYXRlX2RyYWZ0X2RhdGVzKCBnZW5lcmF0aW9uLCAwICk7XG5cdFx0XHR9LCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGNsZWFyX25hdGl2ZV9sb2FkX3RpbWVyKCk7XG5cdFx0XHRcdGlmICggZ2VuZXJhdGlvbiA9PT0gY29udHJvbGxlcl9nZW5lcmF0aW9uICkge1xuXHRcdFx0XHRcdHNob3dfZXJyb3IoIGkxOG4uY2FsZW5kYXJfZXJyb3IgfHwgJycsIHRydWUgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApICkge1xuXHRcdFx0XHRzaG93X2Vycm9yKCBpMThuLmNhbGVuZGFyX2Vycm9yIHx8ICcnLCB0cnVlICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVuZGVyIGFuIGF1dGhvcml6ZWQgcmVhZCByZXNwb25zZSBhbmQgYmVnaW4gdGhlIG5hdGl2ZSBmb2xsb3ctdXAgbG9hZC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBlZGl0b3JfZHRvIEF1dGhvcml6ZWQgRGF0ZSBFZGl0b3IgRFRPLlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBnZW5lcmF0aW9uIEN1cnJlbnQgY29udHJvbGxlciBnZW5lcmF0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbml0aWFsaXplX2VkaXRvciggZWRpdG9yX2R0bywgZ2VuZXJhdGlvbiApIHtcblx0XHRcdHZhciBpbml0aWFsID0gZWRpdG9yX2R0byAmJiBlZGl0b3JfZHRvLmluaXRpYWwgPyBlZGl0b3JfZHRvLmluaXRpYWwgOiB7fTtcblxuXHRcdFx0YWN0aXZlX2VkaXRvciA9IGVkaXRvcl9kdG87XG5cdFx0XHRpZiAoICEgZWRpdG9yX2R0by5zdXBwb3J0ZWQgKSB7XG5cdFx0XHRcdHJlbmRlcl9sYXllcigge1xuXHRcdFx0XHRcdHN1cHBvcnRlZDogZmFsc2UsXG5cdFx0XHRcdFx0ZmFsbGJhY2s6IGVkaXRvcl9kdG8uZmFsbGJhY2sgfHwge30sXG5cdFx0XHRcdFx0aTE4bjogaTE4blxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdHNob3dfZXJyb3IoIGkxOG4udW5zdXBwb3J0ZWRfZGF0ZXMgfHwgJycsIGZhbHNlICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0c2F2ZWRfZHJhZnQgPSBmcmVlemVfZWRpdG9yX2RyYWZ0KCBpbml0aWFsICk7XG5cdFx0XHRkcmFmdCA9IGNsb25lX2VkaXRvcl9kcmFmdCggaW5pdGlhbCApO1xuXHRcdFx0cmVuZGVyX2xheWVyKCBPYmplY3QuYXNzaWduKCB7fSwgZHJhZnQsIHtcblx0XHRcdFx0cmVzb3VyY2VfaWQ6IGVkaXRvcl9kdG8ucmVzb3VyY2VfaWQsXG5cdFx0XHRcdHN1cHBvcnRlZDogdHJ1ZSxcblx0XHRcdFx0aTE4bjogaTE4blxuXHRcdFx0fSApICk7XG5cdFx0XHRpZiAoICEgbGF5ZXIgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHNob3dfbG9hZGluZyggaTE4bi5sb2FkaW5nX2RhdGVzIHx8ICcnICk7XG5cdFx0XHRyZW5kZXJfZHJhZnRfc3RhdGUoKTtcblx0XHRcdG1vdW50X25hdGl2ZV9jYWxlbmRhciggZ2VuZXJhdGlvbiApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlcXVlc3QgYSBmcmVzaCBhdXRob3JpemVkIGVkaXRvciBEVE8gZm9yIHRoZSBhY3RpdmUgYm9va2luZy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVxdWVzdF9lZGl0b3IoKSB7XG5cdFx0XHR2YXIgZ2VuZXJhdGlvbjtcblx0XHRcdHZhciBwZW5kaW5nX3JlcXVlc3Q7XG5cdFx0XHR2YXIgYm9va2luZ19pZCA9IGFjdGl2ZV9lZGl0b3IgPyBub3JtYWxpemVfYm9va2luZ19pZCggYWN0aXZlX2VkaXRvci5ib29raW5nX2lkICkgOiAwO1xuXG5cdFx0XHRpZiAoICEgYm9va2luZ19pZCB8fCAhIGNvbnRyb2xsZXJfb3B0aW9ucy51cmwgfHwgISBjb250cm9sbGVyX29wdGlvbnMuc291cmNlIHx8ICEgcmVhZF9zZXR0aW5ncy5hY3Rpb24gfHwgISByZWFkX3NldHRpbmdzLm5vbmNlICkge1xuXHRcdFx0XHRzaG93X2Vycm9yKCBpMThuLmxvYWRfZXJyb3IgfHwgJycsIHRydWUgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29udHJvbGxlcl9nZW5lcmF0aW9uICs9IDE7XG5cdFx0XHRnZW5lcmF0aW9uID0gY29udHJvbGxlcl9nZW5lcmF0aW9uO1xuXHRcdFx0aWYgKCByZWFkX3JlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHJlYWRfcmVxdWVzdC5hYm9ydCApIHtcblx0XHRcdFx0cmVhZF9yZXF1ZXN0LmFib3J0KCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHJldmlld19yZXF1ZXN0ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiByZXZpZXdfcmVxdWVzdC5hYm9ydCApIHtcblx0XHRcdFx0cmV2aWV3X3JlcXVlc3QuYWJvcnQoKTtcblx0XHRcdH1cblx0XHRcdHJldmlld19nZW5lcmF0aW9uICs9IDE7XG5cdFx0XHRyZXZpZXdfcmVxdWVzdCA9IG51bGw7XG5cdFx0XHRhY3RpdmVfcmV2aWV3ID0gbnVsbDtcblx0XHRcdHBlbmRpbmdfYXBwbHlfcmVzdWx0ID0gbnVsbDtcblx0XHRcdGlmICggbmF0aXZlX2FkYXB0ZXIgKSB7XG5cdFx0XHRcdG5hdGl2ZV9hZGFwdGVyLnRlYXJkb3duKCk7XG5cdFx0XHRcdG5hdGl2ZV9hZGFwdGVyID0gbnVsbDtcblx0XHRcdH1cblx0XHRcdGNsZWFyX25hdGl2ZV9sb2FkX3RpbWVyKCk7XG5cdFx0XHRzaG93X2xvYWRpbmcoIGkxOG4ubG9hZGluZ19kYXRlcyB8fCAnJyApO1xuXHRcdFx0cGVuZGluZ19yZXF1ZXN0ID0gd2luZG93LmpRdWVyeS5hamF4KCB7XG5cdFx0XHRcdHVybDogY29udHJvbGxlcl9vcHRpb25zLnVybCxcblx0XHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRcdGRhdGFUeXBlOiAnanNvbicsXG5cdFx0XHRcdGRhdGE6IHtcblx0XHRcdFx0XHRhY3Rpb246IHJlYWRfc2V0dGluZ3MuYWN0aW9uLFxuXHRcdFx0XHRcdG5vbmNlOiByZWFkX3NldHRpbmdzLm5vbmNlLFxuXHRcdFx0XHRcdGJvb2tpbmdfaWQ6IGJvb2tpbmdfaWQsXG5cdFx0XHRcdFx0c291cmNlOiBjb250cm9sbGVyX29wdGlvbnMuc291cmNlXG5cdFx0XHRcdH1cblx0XHRcdH0gKS5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0XHRpZiAoIGdlbmVyYXRpb24gIT09IGNvbnRyb2xsZXJfZ2VuZXJhdGlvbiB8fCAhIHJlc3BvbnNlIHx8ICEgcmVzcG9uc2Uuc3VjY2VzcyB8fCAhIHJlc3BvbnNlLmRhdGEgfHwgISByZXNwb25zZS5kYXRhLmVkaXRvciApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aW5pdGlhbGl6ZV9lZGl0b3IoIHJlc3BvbnNlLmRhdGEuZWRpdG9yLCBnZW5lcmF0aW9uICk7XG5cdFx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCBmYWlsZWRfcmVxdWVzdCwgcmVxdWVzdF9zdGF0dXMgKSB7XG5cdFx0XHRcdHZhciBlcnJvciA9IGZhaWxlZF9yZXF1ZXN0LnJlc3BvbnNlSlNPTiAmJiBmYWlsZWRfcmVxdWVzdC5yZXNwb25zZUpTT04uZGF0YSA/IGZhaWxlZF9yZXF1ZXN0LnJlc3BvbnNlSlNPTi5kYXRhIDoge307XG5cblx0XHRcdFx0aWYgKCAnYWJvcnQnID09PSByZXF1ZXN0X3N0YXR1cyB8fCBnZW5lcmF0aW9uICE9PSBjb250cm9sbGVyX2dlbmVyYXRpb24gfHwgISBsYXllciApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0c2hvd19lcnJvciggZXJyb3IubWVzc2FnZSB8fCBpMThuLmxvYWRfZXJyb3IgfHwgJycsIHRydWUgKTtcblx0XHRcdH0gKS5hbHdheXMoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKCByZWFkX3JlcXVlc3QgPT09IHBlbmRpbmdfcmVxdWVzdCApIHtcblx0XHRcdFx0XHRyZWFkX3JlcXVlc3QgPSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRyZWFkX3JlcXVlc3QgPSBwZW5kaW5nX3JlcXVlc3Q7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVuZGVyIG9uZSBhdXRob3JpemVkIHJldmlldyBEVE8gdGhyb3VnaCB0aGUgZG9tYWluLW93bmVkIHRlbXBsYXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJldmlld19yZXNwb25zZSBTaWduZWQgc2VydmVyIHJldmlldyByZXNwb25zZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX3JldmlldyggcmV2aWV3X3Jlc3BvbnNlICkge1xuXHRcdFx0dmFyIGxvYWRpbmcgPSBsYXllciA/IGxheWVyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctZGF0ZS1lZGl0b3ItbG9hZGluZ10nICkgOiBudWxsO1xuXHRcdFx0dmFyIGVycm9yX2JveCA9IGxheWVyID8gbGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci1lcnJvcl0nICkgOiBudWxsO1xuXHRcdFx0dmFyIGVkaXRvcl92aWV3ID0gbGF5ZXIgPyBsYXllci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLWRhdGUtZWRpdG9yLXZpZXc9XCJlZGl0b3JcIl0nICkgOiBudWxsO1xuXHRcdFx0dmFyIHJldmlld192aWV3ID0gbGF5ZXIgPyBsYXllci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLWRhdGUtZWRpdG9yLXZpZXc9XCJyZXZpZXdcIl0nICkgOiBudWxsO1xuXHRcdFx0dmFyIHJldmlld19jb250ZW50ID0gcmV2aWV3X3ZpZXcgPyByZXZpZXdfdmlldy5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLWRhdGUtZWRpdG9yLXJldmlldy1jb250ZW50XScgKSA6IG51bGw7XG5cdFx0XHR2YXIgcmV2aWV3X3RpdGxlID0gcmV2aWV3X3ZpZXcgPyByZXZpZXdfdmlldy5xdWVyeVNlbGVjdG9yKCAnaDQnICkgOiBudWxsO1xuXHRcdFx0dmFyIGJhY2tfYnV0dG9uID0gcmV2aWV3X3ZpZXcgPyByZXZpZXdfdmlldy5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLWRhdGUtZWRpdG9yLWJhY2tdJyApIDogbnVsbDtcblx0XHRcdHZhciBhcHBseV9idXR0b24gPSByZXZpZXdfdmlldyA/IHJldmlld192aWV3LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctZGF0ZS1lZGl0b3ItYXBwbHldJyApIDogbnVsbDtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHQhIHJldmlld192aWV3IHx8XG5cdFx0XHRcdCEgcmV2aWV3X2NvbnRlbnQgfHxcblx0XHRcdFx0ISByZXZpZXdfcmVzcG9uc2UgfHxcblx0XHRcdFx0ISByZXZpZXdfcmVzcG9uc2UucmV2aWV3IHx8XG5cdFx0XHRcdCEgcmV2aWV3X3Jlc3BvbnNlLnBsYW4gfHxcblx0XHRcdFx0ISByZXZpZXdfcmVzcG9uc2UudG9rZW4gfHxcblx0XHRcdFx0ISByZXZpZXdfcmVzcG9uc2UuZXhwaXJlc19hdFxuXHRcdFx0KSB7XG5cdFx0XHRcdHNob3dfcmVhZHkoICcnLCBmYWxzZSApO1xuXHRcdFx0XHRzZXRfc3RhdHVzKCBpMThuLnJldmlld19lcnJvciB8fCAnJywgdHJ1ZSwgJ2Vycm9yJyApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRhY3RpdmVfcmV2aWV3ID0gcmV2aWV3X3Jlc3BvbnNlO1xuXHRcdFx0cmV2aWV3X2NvbnRlbnQuaW5uZXJIVE1MID0gcmV2aWV3X3RlbXBsYXRlKCB7XG5cdFx0XHRcdHJldmlldzogcmV2aWV3X3Jlc3BvbnNlLnJldmlldyB8fCB7fSxcblx0XHRcdFx0aTE4bjogaTE4blxuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCBsb2FkaW5nICkge1xuXHRcdFx0XHRsb2FkaW5nLmhpZGRlbiA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGVycm9yX2JveCApIHtcblx0XHRcdFx0ZXJyb3JfYm94LmhpZGRlbiA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGVkaXRvcl92aWV3ICkge1xuXHRcdFx0XHRlZGl0b3Jfdmlldy5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0cmV2aWV3X3ZpZXcuaGlkZGVuID0gZmFsc2U7XG5cdFx0XHRpZiAoIGFwcGx5X2J1dHRvbiApIHtcblx0XHRcdFx0YXBwbHlfYnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG5cdFx0XHRcdGFwcGx5X2J1dHRvbi5zZXRBdHRyaWJ1dGUoICdhcmlhLWRpc2FibGVkJywgJ2ZhbHNlJyApO1xuXHRcdFx0XHRhcHBseV9idXR0b24udGV4dENvbnRlbnQgPSBwZW5kaW5nX2FwcGx5X3Jlc3VsdCA/ICggaTE4bi5yZXRyeV9yZWFkYmFjayB8fCBpMThuLnJldHJ5IHx8ICcnICkgOiAoIGkxOG4uYXBwbHlfY2hhbmdlcyB8fCAnJyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBiYWNrX2J1dHRvbiApIHtcblx0XHRcdFx0YmFja19idXR0b24uZGlzYWJsZWQgPSBCb29sZWFuKCBwZW5kaW5nX2FwcGx5X3Jlc3VsdCApO1xuXHRcdFx0XHRiYWNrX2J1dHRvbi5zZXRBdHRyaWJ1dGUoICdhcmlhLWRpc2FibGVkJywgcGVuZGluZ19hcHBseV9yZXN1bHQgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0XHR9XG5cdFx0XHRzZXRfc3RhdHVzKCAnJywgZmFsc2UgKTtcblx0XHRcdGxheWVyLnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsICdmYWxzZScgKTtcblx0XHRcdGlmICggcmV2aWV3X3RpdGxlICkge1xuXHRcdFx0XHRyZXZpZXdfdGl0bGUuZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gZnJvbSB0aGUgcmV2aWV3IHRvIHRoZSB1bmNoYW5nZWQgbXV0YWJsZSBicm93c2VyIGRyYWZ0LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzaG93X2VkaXRvcl9mcm9tX3JldmlldygpIHtcblx0XHRcdHZhciBlZGl0b3JfdmlldyA9IGxheWVyID8gbGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci12aWV3PVwiZWRpdG9yXCJdJyApIDogbnVsbDtcblx0XHRcdHZhciByZXZpZXdfdmlldyA9IGxheWVyID8gbGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci12aWV3PVwicmV2aWV3XCJdJyApIDogbnVsbDtcblx0XHRcdHZhciByZXZpZXdfYnV0dG9uID0gZWRpdG9yX3ZpZXcgPyBlZGl0b3Jfdmlldy5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLWRhdGUtZWRpdG9yLXJldmlld10nICkgOiBudWxsO1xuXG5cdFx0XHRpZiAoIHBlbmRpbmdfYXBwbHlfcmVzdWx0ICkge1xuXHRcdFx0XHRzZXRfc3RhdHVzKCBpMThuLnJlYWRiYWNrX2Vycm9yIHx8IGkxOG4uYXBwbHlfZXJyb3IgfHwgJycsIHRydWUsICdlcnJvcicgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRhY3RpdmVfcmV2aWV3ID0gbnVsbDtcblx0XHRcdGlmICggcmV2aWV3X3ZpZXcgKSB7XG5cdFx0XHRcdHJldmlld192aWV3LmhpZGRlbiA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGVkaXRvcl92aWV3ICkge1xuXHRcdFx0XHRlZGl0b3Jfdmlldy5oaWRkZW4gPSBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHNldF9zdGF0dXMoICcnLCBmYWxzZSApO1xuXHRcdFx0aWYgKCByZXZpZXdfYnV0dG9uICkge1xuXHRcdFx0XHRyZXZpZXdfYnV0dG9uLmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVxdWVzdCBvbmUgc2lnbmVkLCBub24tbXV0YXRpbmcgcmV2aWV3IGZvciB0aGUgY3VycmVudCBkcmFmdC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVxdWVzdF9yZXZpZXcoKSB7XG5cdFx0XHR2YXIgZ2VuZXJhdGlvbjtcblx0XHRcdHZhciBwZW5kaW5nX3JlcXVlc3Q7XG5cblx0XHRcdGlmIChcblx0XHRcdFx0ISBpc19kcmFmdF9yZXZpZXdhYmxlKCkgfHxcblx0XHRcdFx0ISBhY3RpdmVfZWRpdG9yIHx8XG5cdFx0XHRcdCEgYWN0aXZlX2VkaXRvci5zb3VyY2VfZmluZ2VycHJpbnQgfHxcblx0XHRcdFx0ISBjb250cm9sbGVyX29wdGlvbnMudXJsIHx8XG5cdFx0XHRcdCEgY29udHJvbGxlcl9vcHRpb25zLnNvdXJjZSB8fFxuXHRcdFx0XHQhIHJldmlld19zZXR0aW5ncy5hY3Rpb24gfHxcblx0XHRcdFx0ISByZXZpZXdfc2V0dGluZ3Mubm9uY2Vcblx0XHRcdCkge1xuXHRcdFx0XHRzZXRfc3RhdHVzKCBpMThuLnJldmlld19lcnJvciB8fCAnJywgdHJ1ZSwgJ2Vycm9yJyApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHJldmlld19nZW5lcmF0aW9uICs9IDE7XG5cdFx0XHRnZW5lcmF0aW9uID0gcmV2aWV3X2dlbmVyYXRpb247XG5cdFx0XHRpZiAoIHJldmlld19yZXF1ZXN0ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiByZXZpZXdfcmVxdWVzdC5hYm9ydCApIHtcblx0XHRcdFx0cmV2aWV3X3JlcXVlc3QuYWJvcnQoKTtcblx0XHRcdH1cblx0XHRcdHNob3dfbG9hZGluZyggaTE4bi5sb2FkaW5nX3JldmlldyB8fCAnJyApO1xuXHRcdFx0cGVuZGluZ19yZXF1ZXN0ID0gd2luZG93LmpRdWVyeS5hamF4KCB7XG5cdFx0XHRcdHVybDogY29udHJvbGxlcl9vcHRpb25zLnVybCxcblx0XHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRcdGRhdGFUeXBlOiAnanNvbicsXG5cdFx0XHRcdGRhdGE6IHtcblx0XHRcdFx0XHRhY3Rpb246IHJldmlld19zZXR0aW5ncy5hY3Rpb24sXG5cdFx0XHRcdFx0bm9uY2U6IHJldmlld19zZXR0aW5ncy5ub25jZSxcblx0XHRcdFx0XHRib29raW5nX2lkOiBhY3RpdmVfZWRpdG9yLmJvb2tpbmdfaWQsXG5cdFx0XHRcdFx0c291cmNlOiBjb250cm9sbGVyX29wdGlvbnMuc291cmNlLFxuXHRcdFx0XHRcdHNvdXJjZV9maW5nZXJwcmludDogYWN0aXZlX2VkaXRvci5zb3VyY2VfZmluZ2VycHJpbnQsXG5cdFx0XHRcdFx0cHJvcG9zYWw6IEpTT04uc3RyaW5naWZ5KCBnZXRfZWZmZWN0aXZlX2VkaXRvcl9kcmFmdCggZHJhZnQgKSApXG5cdFx0XHRcdH1cblx0XHRcdH0gKS5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0XHRpZiAoIGdlbmVyYXRpb24gIT09IHJldmlld19nZW5lcmF0aW9uIHx8ICEgcmVzcG9uc2UgfHwgISByZXNwb25zZS5zdWNjZXNzIHx8ICEgcmVzcG9uc2UuZGF0YSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVuZGVyX3JldmlldyggcmVzcG9uc2UuZGF0YSApO1xuXHRcdFx0fSApLmZhaWwoIGZ1bmN0aW9uICggZmFpbGVkX3JlcXVlc3QsIHJlcXVlc3Rfc3RhdHVzICkge1xuXHRcdFx0XHR2YXIgZXJyb3IgPSBmYWlsZWRfcmVxdWVzdC5yZXNwb25zZUpTT04gJiYgZmFpbGVkX3JlcXVlc3QucmVzcG9uc2VKU09OLmRhdGEgPyBmYWlsZWRfcmVxdWVzdC5yZXNwb25zZUpTT04uZGF0YSA6IHt9O1xuXG5cdFx0XHRcdGlmICggJ2Fib3J0JyA9PT0gcmVxdWVzdF9zdGF0dXMgfHwgZ2VuZXJhdGlvbiAhPT0gcmV2aWV3X2dlbmVyYXRpb24gfHwgISBsYXllciApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0c2hvd19yZWFkeSggJycsIGZhbHNlICk7XG5cdFx0XHRcdHNldF9zdGF0dXMoIGVycm9yLm1lc3NhZ2UgfHwgaTE4bi5yZXZpZXdfZXJyb3IgfHwgJycsIHRydWUsICdlcnJvcicgKTtcblx0XHRcdH0gKS5hbHdheXMoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKCByZXZpZXdfcmVxdWVzdCA9PT0gcGVuZGluZ19yZXF1ZXN0ICkge1xuXHRcdFx0XHRcdHJldmlld19yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0cmV2aWV3X3JlcXVlc3QgPSBwZW5kaW5nX3JlcXVlc3Q7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIG9uZSBzYWZlIGNhbm9uaWNhbC1yZWFkYmFjayBmYWlsdXJlIG1lc3NhZ2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0geyp9IHJlYWRiYWNrX2Vycm9yIFJlamVjdGlvbiB2YWx1ZSBmcm9tIHRoZSBJbnNwZWN0b3IgYWRhcHRlci5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gU2FmZSBsb2NhbGl6ZWQgb3IgYWRhcHRlci1wcm92aWRlZCBtZXNzYWdlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9yZWFkYmFja19lcnJvcl9tZXNzYWdlKCByZWFkYmFja19lcnJvciApIHtcblx0XHRcdGlmICggcmVhZGJhY2tfZXJyb3IgJiYgJ3N0cmluZycgPT09IHR5cGVvZiByZWFkYmFja19lcnJvci5tZXNzYWdlICYmIHJlYWRiYWNrX2Vycm9yLm1lc3NhZ2UgKSB7XG5cdFx0XHRcdHJldHVybiByZWFkYmFja19lcnJvci5tZXNzYWdlO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gaTE4bi5yZWFkYmFja19lcnJvciB8fCBpMThuLmFwcGx5X2Vycm9yIHx8ICcnO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFzayB0aGUgSW5zcGVjdG9yIHRvIHJlcmVhZCBhbmQgcmVuZGVyIHRoZSBhdXRob3JpdGF0aXZlIGJvb2tpbmcuXG5cdFx0ICpcblx0XHQgKiBUaGUgRGF0ZSBFZGl0b3Iga2VlcHMgaXRzIGRpcnR5IHJldmlldyBzdGF0ZSB1bnRpbCB0aGlzIGFzeW5jaHJvbm91c1xuXHRcdCAqIGJvdW5kYXJ5IHJlc29sdmVzIHdpdGggdGhlIGNhbm9uaWNhbCBJbnNwZWN0b3IgRFRPLiBBIHJlamVjdGVkIHJlYWRiYWNrXG5cdFx0ICogbmV2ZXIgcmVuZGVycyB0aGUgYXBwbHkgcmVzcG9uc2UgYXMgYm9va2luZyBzdGF0ZSwgYW5kIFJldHJ5IHJlZnJlc2hcblx0XHQgKiByZXBlYXRzIG9ubHkgdGhpcyByZWFkIGluc3RlYWQgb2Ygc3VibWl0dGluZyB0aGUgc2lnbmVkIG11dGF0aW9uIGFnYWluLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHN1Ym1pdHRlZF9yZXZpZXcgU2lnbmVkIHJldmlldyBkaXNwbGF5ZWQgZHVyaW5nIGFwcGx5LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXF1ZXN0X2Nhbm9uaWNhbF9yZWFkYmFjayggc3VibWl0dGVkX3JldmlldyApIHtcblx0XHRcdHZhciBjYWxsYmFja19yZXN1bHQ7XG5cdFx0XHR2YXIgZ2VuZXJhdGlvbjtcblxuXHRcdFx0aWYgKCAhIHBlbmRpbmdfYXBwbHlfcmVzdWx0IHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBjb250cm9sbGVyX29wdGlvbnMub25fYXBwbGllZCApIHtcblx0XHRcdFx0cmVuZGVyX3Jldmlldyggc3VibWl0dGVkX3JldmlldyApO1xuXHRcdFx0XHRzZXRfc3RhdHVzKCBpMThuLnJlYWRiYWNrX2Vycm9yIHx8IGkxOG4uYXBwbHlfZXJyb3IgfHwgJycsIHRydWUsICdlcnJvcicgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRhcHBseV9nZW5lcmF0aW9uICs9IDE7XG5cdFx0XHRnZW5lcmF0aW9uID0gYXBwbHlfZ2VuZXJhdGlvbjtcblx0XHRcdHNob3dfbG9hZGluZyggaTE4bi5yZWZyZXNoaW5nX2Jvb2tpbmcgfHwgaTE4bi5sb2FkaW5nX2RhdGVzIHx8ICcnICk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjYWxsYmFja19yZXN1bHQgPSBjb250cm9sbGVyX29wdGlvbnMub25fYXBwbGllZCggcGVuZGluZ19hcHBseV9yZXN1bHQgKTtcblx0XHRcdH0gY2F0Y2ggKCByZWFkYmFja19leGNlcHRpb24gKSB7XG5cdFx0XHRcdGNhbGxiYWNrX3Jlc3VsdCA9IG51bGw7XG5cdFx0XHR9XG5cdFx0XHRpZiAoXG5cdFx0XHRcdCEgY2FsbGJhY2tfcmVzdWx0IHx8XG5cdFx0XHRcdCggJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIGNhbGxiYWNrX3Jlc3VsdC50aGVuICYmICdmdW5jdGlvbicgIT09IHR5cGVvZiBjYWxsYmFja19yZXN1bHQuZG9uZSApXG5cdFx0XHQpIHtcblx0XHRcdFx0cmVuZGVyX3Jldmlldyggc3VibWl0dGVkX3JldmlldyApO1xuXHRcdFx0XHRzZXRfc3RhdHVzKCBpMThuLnJlYWRiYWNrX2Vycm9yIHx8IGkxOG4uYXBwbHlfZXJyb3IgfHwgJycsIHRydWUsICdlcnJvcicgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR3aW5kb3cualF1ZXJ5LndoZW4oIGNhbGxiYWNrX3Jlc3VsdCApLmRvbmUoIGZ1bmN0aW9uICggY2Fub25pY2FsX2Jvb2tpbmcgKSB7XG5cdFx0XHRcdGlmIChcblx0XHRcdFx0XHRnZW5lcmF0aW9uICE9PSBhcHBseV9nZW5lcmF0aW9uIHx8XG5cdFx0XHRcdFx0ISBsYXllciB8fFxuXHRcdFx0XHRcdCEgY2Fub25pY2FsX2Jvb2tpbmcgfHxcblx0XHRcdFx0XHROdW1iZXIoIGNhbm9uaWNhbF9ib29raW5nLmJvb2tpbmdfaWQgfHwgMCApICE9PSBOdW1iZXIoIHBlbmRpbmdfYXBwbHlfcmVzdWx0LmJvb2tpbmdfaWQgfHwgMCApXG5cdFx0XHRcdCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRwZW5kaW5nX2FwcGx5X3Jlc3VsdCA9IG51bGw7XG5cdFx0XHRcdGRpcnR5ID0gZmFsc2U7XG5cdFx0XHRcdGNsb3NlKCB0cnVlLCB0cnVlICk7XG5cdFx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCByZWFkYmFja19lcnJvciApIHtcblx0XHRcdFx0aWYgKCBnZW5lcmF0aW9uICE9PSBhcHBseV9nZW5lcmF0aW9uIHx8ICEgbGF5ZXIgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlbmRlcl9yZXZpZXcoIHN1Ym1pdHRlZF9yZXZpZXcgKTtcblx0XHRcdFx0c2V0X3N0YXR1cyggZ2V0X3JlYWRiYWNrX2Vycm9yX21lc3NhZ2UoIHJlYWRiYWNrX2Vycm9yICksIHRydWUsICdlcnJvcicgKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBcHBseSB0aGUgY3VycmVudGx5IGRpc3BsYXllZCBzaWduZWQgcmV2aWV3IHRocm91Z2ggdGhlIGRvbWFpbiBlbmRwb2ludC5cblx0XHQgKlxuXHRcdCAqIE9ubHkgdGhlIHNlcnZlci1pc3N1ZWQgcGxhbiBhbmQgc2lnbmF0dXJlIGFyZSBzdWJtaXR0ZWQuIFRoZSBtdXRhYmxlXG5cdFx0ICogYnJvd3NlciBkcmFmdCBhbmQgbmF0aXZlIGNhbGVuZGFyIHNlbGVjdGlvbiBhcmUgaW50ZW50aW9uYWxseSBvbWl0dGVkLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXF1ZXN0X2FwcGx5KCkge1xuXHRcdFx0dmFyIGdlbmVyYXRpb247XG5cdFx0XHR2YXIgcGVuZGluZ19yZXF1ZXN0O1xuXHRcdFx0dmFyIHN1Ym1pdHRlZF9yZXZpZXcgPSBhY3RpdmVfcmV2aWV3O1xuXG5cdFx0XHRpZiAoIHBlbmRpbmdfYXBwbHlfcmVzdWx0ICkge1xuXHRcdFx0XHRyZXF1ZXN0X2Nhbm9uaWNhbF9yZWFkYmFjayggc3VibWl0dGVkX3JldmlldyApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChcblx0XHRcdFx0ISBzdWJtaXR0ZWRfcmV2aWV3IHx8XG5cdFx0XHRcdCEgc3VibWl0dGVkX3Jldmlldy5wbGFuIHx8XG5cdFx0XHRcdCEgc3VibWl0dGVkX3Jldmlldy50b2tlbiB8fFxuXHRcdFx0XHQhIGFjdGl2ZV9lZGl0b3IgfHxcblx0XHRcdFx0ISBjb250cm9sbGVyX29wdGlvbnMudXJsIHx8XG5cdFx0XHRcdCEgY29udHJvbGxlcl9vcHRpb25zLnNvdXJjZSB8fFxuXHRcdFx0XHQhIGFwcGx5X3NldHRpbmdzLmFjdGlvbiB8fFxuXHRcdFx0XHQhIGFwcGx5X3NldHRpbmdzLm5vbmNlXG5cdFx0XHQpIHtcblx0XHRcdFx0c2V0X3N0YXR1cyggaTE4bi5hcHBseV9lcnJvciB8fCAnJywgdHJ1ZSwgJ2Vycm9yJyApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGFwcGx5X2dlbmVyYXRpb24gKz0gMTtcblx0XHRcdGdlbmVyYXRpb24gPSBhcHBseV9nZW5lcmF0aW9uO1xuXHRcdFx0aWYgKCBhcHBseV9yZXF1ZXN0ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBhcHBseV9yZXF1ZXN0LmFib3J0ICkge1xuXHRcdFx0XHRhcHBseV9yZXF1ZXN0LmFib3J0KCk7XG5cdFx0XHR9XG5cdFx0XHRzaG93X2xvYWRpbmcoIGkxOG4uYXBwbHlpbmdfY2hhbmdlcyB8fCAnJyApO1xuXHRcdFx0cGVuZGluZ19yZXF1ZXN0ID0gd2luZG93LmpRdWVyeS5hamF4KCB7XG5cdFx0XHRcdHVybDogY29udHJvbGxlcl9vcHRpb25zLnVybCxcblx0XHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRcdGRhdGFUeXBlOiAnanNvbicsXG5cdFx0XHRcdGRhdGE6IHtcblx0XHRcdFx0XHRhY3Rpb246IGFwcGx5X3NldHRpbmdzLmFjdGlvbixcblx0XHRcdFx0XHRub25jZTogYXBwbHlfc2V0dGluZ3Mubm9uY2UsXG5cdFx0XHRcdFx0Ym9va2luZ19pZDogYWN0aXZlX2VkaXRvci5ib29raW5nX2lkLFxuXHRcdFx0XHRcdHNvdXJjZTogY29udHJvbGxlcl9vcHRpb25zLnNvdXJjZSxcblx0XHRcdFx0XHRwbGFuOiBKU09OLnN0cmluZ2lmeSggc3VibWl0dGVkX3Jldmlldy5wbGFuICksXG5cdFx0XHRcdFx0dG9rZW46IHN1Ym1pdHRlZF9yZXZpZXcudG9rZW4sXG5cdFx0XHRcdFx0c2VuZF9tb2RpZmllZF9lbWFpbDogJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNvbnRyb2xsZXJfb3B0aW9ucy5nZXRfc2VuZF9tb2RpZmllZF9lbWFpbF9pbnRlbnQgJiYgY29udHJvbGxlcl9vcHRpb25zLmdldF9zZW5kX21vZGlmaWVkX2VtYWlsX2ludGVudCgpID8gMSA6IDBcblx0XHRcdFx0fVxuXHRcdFx0fSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRcdHZhciBhcHBseV9yZXN1bHQ7XG5cblx0XHRcdFx0aWYgKCBnZW5lcmF0aW9uICE9PSBhcHBseV9nZW5lcmF0aW9uICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICEgcmVzcG9uc2UgfHwgISByZXNwb25zZS5zdWNjZXNzIHx8ICEgcmVzcG9uc2UuZGF0YSB8fCAhIHJlc3BvbnNlLmRhdGEuY2Fub25pY2FsICkge1xuXHRcdFx0XHRcdHJlbmRlcl9yZXZpZXcoIHN1Ym1pdHRlZF9yZXZpZXcgKTtcblx0XHRcdFx0XHRzZXRfc3RhdHVzKCBpMThuLmFwcGx5X2Vycm9yIHx8ICcnLCB0cnVlLCAnZXJyb3InICk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGFwcGx5X3Jlc3VsdCA9IHJlc3BvbnNlLmRhdGE7XG5cdFx0XHRcdHBlbmRpbmdfYXBwbHlfcmVzdWx0ID0gYXBwbHlfcmVzdWx0O1xuXHRcdFx0XHRyZXF1ZXN0X2Nhbm9uaWNhbF9yZWFkYmFjayggc3VibWl0dGVkX3JldmlldyApO1xuXHRcdFx0fSApLmZhaWwoIGZ1bmN0aW9uICggZmFpbGVkX3JlcXVlc3QsIHJlcXVlc3Rfc3RhdHVzICkge1xuXHRcdFx0XHR2YXIgZXJyb3IgPSBmYWlsZWRfcmVxdWVzdC5yZXNwb25zZUpTT04gJiYgZmFpbGVkX3JlcXVlc3QucmVzcG9uc2VKU09OLmRhdGEgPyBmYWlsZWRfcmVxdWVzdC5yZXNwb25zZUpTT04uZGF0YSA6IHt9O1xuXG5cdFx0XHRcdGlmICggJ2Fib3J0JyA9PT0gcmVxdWVzdF9zdGF0dXMgfHwgZ2VuZXJhdGlvbiAhPT0gYXBwbHlfZ2VuZXJhdGlvbiB8fCAhIGxheWVyICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZW5kZXJfcmV2aWV3KCBzdWJtaXR0ZWRfcmV2aWV3ICk7XG5cdFx0XHRcdHNldF9zdGF0dXMoIGVycm9yLm1lc3NhZ2UgfHwgaTE4bi5hcHBseV9lcnJvciB8fCAnJywgdHJ1ZSwgJ2Vycm9yJyApO1xuXHRcdFx0fSApLmFsd2F5cyggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRpZiAoIGFwcGx5X3JlcXVlc3QgPT09IHBlbmRpbmdfcmVxdWVzdCApIHtcblx0XHRcdFx0XHRhcHBseV9yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0YXBwbHlfcmVxdWVzdCA9IHBlbmRpbmdfcmVxdWVzdDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBPcGVuIHRoZSBEYXRlIEVkaXRvciBmb3Igb25lIEluc3BlY3Rvci1hdXRob3JpemVkIGJvb2tpbmcuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSB0cmlnZ2VyICAgICAgICAgQ2hhbmdlIGRhdGVzIGJ1dHRvbi5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBib29raW5nX2NvbnRleHQgQm9va2luZyBpZGVudGlmaWVyIGZyb20gdGhlIGxvYWRlZCBJbnNwZWN0b3IgRFRPLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIG9wZW5pbmcgYmVnYW4uXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gb3BlbiggdHJpZ2dlciwgYm9va2luZ19jb250ZXh0ICkge1xuXHRcdFx0dmFyIGJvb2tpbmdfaWQgPSBib29raW5nX2NvbnRleHQgPyBub3JtYWxpemVfYm9va2luZ19pZCggYm9va2luZ19jb250ZXh0LmJvb2tpbmdfaWQgKSA6IDA7XG5cblx0XHRcdGlmICggISBib29raW5nX2lkIHx8ICEgY2xvc2UoIGZhbHNlLCBmYWxzZSApICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRvcGVuZXIgPSB0cmlnZ2VyO1xuXHRcdFx0YWN0aXZlX2VkaXRvciA9IHsgYm9va2luZ19pZDogYm9va2luZ19pZCB9O1xuXHRcdFx0aWYgKCAhIHJlbmRlcl9sYXllciggeyBpMThuOiBpMThuIH0gKSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0c2hvd19sb2FkaW5nKCBpMThuLmxvYWRpbmdfZGF0ZXMgfHwgJycgKTtcblx0XHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKCBsYXllciApIHtcblx0XHRcdFx0XHRsYXllci5mb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRyZXF1ZXN0X2VkaXRvcigpO1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTeW5jaHJvbml6ZSB0aGUgdmlzaWJsZSBjb250cm9scyBmcm9tIHRoZSBtdXRhYmxlIGJyb3dzZXIgZHJhZnQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHN5bmNocm9uaXplX2NvbnRyb2xzX2Zyb21fZHJhZnQoKSB7XG5cdFx0XHRpZiAoICEgbGF5ZXIgfHwgISBkcmFmdCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBsYXllci5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1ib29raW5nLWRhdGUtZWRpdG9yLXNlbGVjdGlvbi1tZXRob2RdJyApLCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHRcdGNvbnRyb2wuY2hlY2tlZCA9IGRyYWZ0LnNlbGVjdGlvbl9tZXRob2QgPT09IGNvbnRyb2wudmFsdWU7XG5cdFx0XHR9ICk7XG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBsYXllci5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1ib29raW5nLWRhdGUtZWRpdG9yLXRpbWUtYXBwbGljYXRpb25dJyApLCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHRcdGNvbnRyb2wuY2hlY2tlZCA9IGRyYWZ0LnRpbWVfYXBwbGljYXRpb24gPT09IGNvbnRyb2wudmFsdWU7XG5cdFx0XHR9ICk7XG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBsYXllci5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1ib29raW5nLWRhdGUtZWRpdG9yLXRpbWVdJyApLCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHRcdGNvbnRyb2wudmFsdWUgPSBkcmFmdFsgY29udHJvbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci10aW1lJyApIF0gfHwgJyc7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSGFuZGxlIHNlY29uZGFyeS1sYXllciBidXR0b25zIHdpdGhvdXQgbGVha2luZyBiZWhhdmlvciBpbnRvIEluc3BlY3Rvci5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7TW91c2VFdmVudH0gZXZlbnQgSW5zcGVjdG9yLXNoZWxsIGNsaWNrIGV2ZW50LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfY2xpY2soIGV2ZW50ICkge1xuXHRcdFx0dmFyIHJlc2V0X2J1dHRvbjtcblx0XHRcdHZhciByZXZpZXdfYnV0dG9uO1xuXHRcdFx0dmFyIGJhY2tfYnV0dG9uO1xuXHRcdFx0dmFyIGFwcGx5X2J1dHRvbjtcblx0XHRcdHZhciBtb2RlX3dhc19yZXN0b3JlZDtcblx0XHRcdHZhciBkYXRlc193ZXJlX3Jlc3RvcmVkO1xuXG5cdFx0XHRpZiAoICEgbGF5ZXIgfHwgISBsYXllci5jb250YWlucyggZXZlbnQudGFyZ2V0ICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctZGF0ZS1lZGl0b3ItY2xvc2VdJyApICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRjbG9zZSggdHJ1ZSwgZmFsc2UgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci1yZXRyeV0nICkgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHJlcXVlc3RfZWRpdG9yKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHJldmlld19idXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci1yZXZpZXddJyApO1xuXHRcdFx0aWYgKCByZXZpZXdfYnV0dG9uICYmICEgcmV2aWV3X2J1dHRvbi5kaXNhYmxlZCApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0cmVxdWVzdF9yZXZpZXcoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0YmFja19idXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci1iYWNrXScgKTtcblx0XHRcdGlmICggYmFja19idXR0b24gKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHNob3dfZWRpdG9yX2Zyb21fcmV2aWV3KCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGFwcGx5X2J1dHRvbiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1ib29raW5nLWRhdGUtZWRpdG9yLWFwcGx5XScgKTtcblx0XHRcdGlmICggYXBwbHlfYnV0dG9uICYmICEgYXBwbHlfYnV0dG9uLmRpc2FibGVkICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRyZXF1ZXN0X2FwcGx5KCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHJlc2V0X2J1dHRvbiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1ib29raW5nLWRhdGUtZWRpdG9yLXJlc2V0XScgKTtcblx0XHRcdGlmICggcmVzZXRfYnV0dG9uICYmIHNhdmVkX2RyYWZ0ICYmIGRyYWZ0ICYmIG5hdGl2ZV9hZGFwdGVyICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRhY3RpdmVfcmV2aWV3ID0gbnVsbDtcblx0XHRcdFx0ZHJhZnQgPSBjbG9uZV9lZGl0b3JfZHJhZnQoIHNhdmVkX2RyYWZ0ICk7XG5cdFx0XHRcdG1vZGVfd2FzX3Jlc3RvcmVkID0gbmF0aXZlX2FkYXB0ZXIuc2V0X3NlbGVjdGlvbl9tb2RlKCBkcmFmdC5zZWxlY3Rpb25fbWV0aG9kICk7XG5cdFx0XHRcdGRhdGVzX3dlcmVfcmVzdG9yZWQgPSBtb2RlX3dhc19yZXN0b3JlZCAmJiBuYXRpdmVfYWRhcHRlci5zZXRfZXhhY3Rfc2VsZWN0ZWRfZGF0ZXMoIGRyYWZ0LnNlbGVjdGVkX2RhdGVzICk7XG5cdFx0XHRcdHN5bmNocm9uaXplX2NvbnRyb2xzX2Zyb21fZHJhZnQoKTtcblx0XHRcdFx0cmVuZGVyX2RyYWZ0X3N0YXRlKCk7XG5cdFx0XHRcdHNldF9zdGF0dXMoXG5cdFx0XHRcdFx0ZGF0ZXNfd2VyZV9yZXN0b3JlZCA/ICggaTE4bi5jYWxlbmRhcl9sb2FkZWQgfHwgJycgKSA6ICggaTE4bi5oeWRyYXRpb25fd2FybmluZyB8fCAnJyApLFxuXHRcdFx0XHRcdCEgZGF0ZXNfd2VyZV9yZXN0b3JlZFxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN5bmNocm9uaXplIG5hdGl2ZSBtb2RlIGFuZCB0aW1lIGNvbnRyb2xzIGludG8gdGhlIGJyb3dzZXIgZHJhZnQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCBJbnNwZWN0b3Itc2hlbGwgY2hhbmdlL2lucHV0IGV2ZW50LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfY2hhbmdlKCBldmVudCApIHtcblx0XHRcdHZhciBzZWxlY3Rpb25fY29udHJvbDtcblx0XHRcdHZhciB0aW1lX2FwcGxpY2F0aW9uX2NvbnRyb2w7XG5cdFx0XHR2YXIgdGltZV9jb250cm9sO1xuXHRcdFx0dmFyIHJlcXVlc3RlZF9zZWxlY3Rpb25fbWV0aG9kO1xuXHRcdFx0dmFyIHRpbWVfY29udHJvbF9rZXk7XG5cblx0XHRcdGlmICggISBsYXllciB8fCAhIGxheWVyLmNvbnRhaW5zKCBldmVudC50YXJnZXQgKSB8fCAhIGRyYWZ0ICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRzZWxlY3Rpb25fY29udHJvbCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1ib29raW5nLWRhdGUtZWRpdG9yLXNlbGVjdGlvbi1tZXRob2RdJyApO1xuXHRcdFx0dGltZV9hcHBsaWNhdGlvbl9jb250cm9sID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctZGF0ZS1lZGl0b3ItdGltZS1hcHBsaWNhdGlvbl0nICk7XG5cdFx0XHR0aW1lX2NvbnRyb2wgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci10aW1lXScgKTtcblx0XHRcdGlmICggc2VsZWN0aW9uX2NvbnRyb2wgKSB7XG5cdFx0XHRcdHJlcXVlc3RlZF9zZWxlY3Rpb25fbWV0aG9kID0gTU9ERV9JTkRJVklEVUFMID09PSBzZWxlY3Rpb25fY29udHJvbC52YWx1ZSA/IE1PREVfSU5ESVZJRFVBTCA6IE1PREVfUE9MSUNZO1xuXHRcdFx0XHRpZiAoIG5hdGl2ZV9hZGFwdGVyICYmICEgbmF0aXZlX2FkYXB0ZXIuc2V0X3NlbGVjdGlvbl9tb2RlKCByZXF1ZXN0ZWRfc2VsZWN0aW9uX21ldGhvZCApICkge1xuXHRcdFx0XHRcdHN5bmNocm9uaXplX2NvbnRyb2xzX2Zyb21fZHJhZnQoKTtcblx0XHRcdFx0XHRzZXRfc3RhdHVzKCBpMThuLmh5ZHJhdGlvbl93YXJuaW5nIHx8ICcnLCB0cnVlICk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGRyYWZ0LnNlbGVjdGlvbl9tZXRob2QgPSByZXF1ZXN0ZWRfc2VsZWN0aW9uX21ldGhvZDtcblx0XHRcdFx0ZHJhZnQuc2VsZWN0ZWRfZGF0ZXMgPSBuYXRpdmVfYWRhcHRlciA/IG5hdGl2ZV9hZGFwdGVyLmdldF9zZWxlY3RlZF9kYXRlcygpIDogZHJhZnQuc2VsZWN0ZWRfZGF0ZXM7XG5cdFx0XHR9IGVsc2UgaWYgKCB0aW1lX2FwcGxpY2F0aW9uX2NvbnRyb2wgKSB7XG5cdFx0XHRcdGRyYWZ0LnRpbWVfYXBwbGljYXRpb24gPSAtMSAhPT0gWyBUSU1FX0FQUExJQ0FUSU9OX0ZVTExfREFZLCBUSU1FX0FQUExJQ0FUSU9OX0JPVU5EQVJZLCBUSU1FX0FQUExJQ0FUSU9OX1BFUl9EQVRFIF0uaW5kZXhPZiggdGltZV9hcHBsaWNhdGlvbl9jb250cm9sLnZhbHVlIClcblx0XHRcdFx0XHQ/IHRpbWVfYXBwbGljYXRpb25fY29udHJvbC52YWx1ZVxuXHRcdFx0XHRcdDogVElNRV9BUFBMSUNBVElPTl9GVUxMX0RBWTtcblx0XHRcdH0gZWxzZSBpZiAoIHRpbWVfY29udHJvbCApIHtcblx0XHRcdFx0dGltZV9jb250cm9sX2tleSA9IHRpbWVfY29udHJvbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci10aW1lJyApO1xuXHRcdFx0XHRpZiAoIC0xID09PSBbICdzdGFydF90aW1lJywgJ2VuZF90aW1lJyBdLmluZGV4T2YoIHRpbWVfY29udHJvbF9rZXkgKSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0ZHJhZnRbIHRpbWVfY29udHJvbF9rZXkgXSA9IG5vcm1hbGl6ZV9leGFjdF9taW51dGVfdGltZSggdGltZV9jb250cm9sLnZhbHVlICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRhY3RpdmVfcmV2aWV3ID0gbnVsbDtcblx0XHRcdHJlbmRlcl9kcmFmdF9zdGF0ZSgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENsb3NlIG9ubHkgdGhlIHNlY29uZGFyeSBsYXllciBvbiBFc2NhcGUgYmVmb3JlIHRoZSBwYXJlbnQgc2hlbGwgc2VlcyBpdC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7S2V5Ym9hcmRFdmVudH0gZXZlbnQgSW5zcGVjdG9yLXNoZWxsIGtleWJvYXJkIGV2ZW50LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfa2V5ZG93biggZXZlbnQgKSB7XG5cdFx0XHRpZiAoICdFc2NhcGUnICE9PSBldmVudC5rZXkgfHwgISBsYXllciApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0Y2xvc2UoIHRydWUsIGZhbHNlICk7XG5cdFx0fVxuXG5cdFx0aW5zcGVjdG9yX3NoZWxsLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGhhbmRsZV9jbGljayApO1xuXHRcdGluc3BlY3Rvcl9zaGVsbC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgaGFuZGxlX2NoYW5nZSApO1xuXHRcdGluc3BlY3Rvcl9zaGVsbC5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCBoYW5kbGVfY2hhbmdlICk7XG5cdFx0aW5zcGVjdG9yX3NoZWxsLmFkZEV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgaGFuZGxlX2tleWRvd24sIHRydWUgKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRvcGVuOiBvcGVuLFxuXHRcdFx0aXNfb3BlbjogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gQm9vbGVhbiggbGF5ZXIgKTtcblx0XHRcdH0sXG5cdFx0XHRpc19kaXJ0eTogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gZGlydHk7XG5cdFx0XHR9LFxuXHRcdFx0Y29uZmlybV9kaXNjYXJkOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiAhIGRpcnR5IHx8IHdpbmRvdy5jb25maXJtKCBpMThuLmRpc2NhcmRfY2hhbmdlcyB8fCAnJyApO1xuXHRcdFx0fSxcblx0XHRcdHByZXBhcmVfZm9yX3BhcmVudF9zd2l0Y2g6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIGNsb3NlKCBmYWxzZSwgZmFsc2UgKTtcblx0XHRcdH0sXG5cdFx0XHRmb3JjZV9jbG9zZTogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRjbG9zZSggZmFsc2UsIHRydWUgKTtcblx0XHRcdH0sXG5cdFx0XHRkZXN0cm95OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGNsb3NlKCBmYWxzZSwgdHJ1ZSApO1xuXHRcdFx0XHRpbnNwZWN0b3Jfc2hlbGwucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgaGFuZGxlX2NsaWNrICk7XG5cdFx0XHRcdGluc3BlY3Rvcl9zaGVsbC5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgaGFuZGxlX2NoYW5nZSApO1xuXHRcdFx0XHRpbnNwZWN0b3Jfc2hlbGwucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgaGFuZGxlX2NoYW5nZSApO1xuXHRcdFx0XHRpbnNwZWN0b3Jfc2hlbGwucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCBoYW5kbGVfa2V5ZG93biwgdHJ1ZSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHR3aW5kb3cud3BiY19ib29raW5nX2RhdGVfZWRpdG9yID0gd2luZG93LndwYmNfYm9va2luZ19kYXRlX2VkaXRvciB8fCB7fTtcblx0d2luZG93LndwYmNfYm9va2luZ19kYXRlX2VkaXRvci5jcmVhdGVfbmF0aXZlX2NhbGVuZGFyX2FkYXB0ZXIgPSBjcmVhdGVfbmF0aXZlX2NhbGVuZGFyX2FkYXB0ZXI7XG5cdHdpbmRvdy53cGJjX2Jvb2tpbmdfZGF0ZV9lZGl0b3IuY3JlYXRlX2NvbnRyb2xsZXIgPSBjcmVhdGVfY29udHJvbGxlcjtcbn0oIHdpbmRvdywgZG9jdW1lbnQsIGpRdWVyeSApICk7XG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUUsV0FBV0EsTUFBTSxFQUFFQyxRQUFRLEVBQUVDLENBQUMsRUFBRztFQUNsQyxZQUFZOztFQUVaLElBQUlDLGVBQWUsR0FBRyx3QkFBd0I7RUFDOUMsSUFBSUMsc0JBQXNCLEdBQUcsNEJBQTRCO0VBQ3pELElBQUlDLGVBQWUsR0FBRyxZQUFZO0VBQ2xDLElBQUlDLFdBQVcsR0FBRyxRQUFRO0VBQzFCLElBQUlDLHlCQUF5QixHQUFHLFVBQVU7RUFDMUMsSUFBSUMseUJBQXlCLEdBQUcsVUFBVTtFQUMxQyxJQUFJQyx5QkFBeUIsR0FBRyxVQUFVO0VBQzFDLElBQUlDLHNCQUFzQixHQUFHLEtBQUs7RUFDbEMsSUFBSUMsY0FBYyxHQUFHLElBQUk7RUFDekIsSUFBSUMsd0JBQXdCLEdBQUcsQ0FDOUIsd0JBQXdCLEVBQ3hCLG9CQUFvQixFQUNwQixzQkFBc0IsRUFDdEIsb0JBQW9CLEVBQ3BCLGlDQUFpQyxFQUNqQyx5QkFBeUIsRUFDekIsMkJBQTJCLEVBQzNCLGtCQUFrQixFQUNsQixpQkFBaUIsRUFDakIseUJBQXlCLEVBQ3pCLG1CQUFtQixFQUNuQixtQkFBbUIsRUFDbkIsd0JBQXdCLEVBQ3hCLDJCQUEyQixFQUMzQixxQ0FBcUMsRUFDckMscUJBQXFCLEVBQ3JCLHFCQUFxQixFQUNyQixvQkFBb0IsRUFDcEIsd0JBQXdCLEVBQ3hCLHlEQUF5RCxFQUN6RCx3QkFBd0IsRUFDeEIsc0NBQXNDLEVBQ3RDLFlBQVksQ0FDWjtFQUNELElBQUlDLHFCQUFxQixHQUFHLENBQzNCLHdCQUF3QixFQUN4QixzQkFBc0IsRUFDdEIsMEJBQTBCLENBQzFCO0VBQ0QsSUFBSUMsc0JBQXNCLEdBQUcsQ0FBRSxPQUFPLEVBQUUsU0FBUyxFQUFFLFFBQVEsQ0FBRTtFQUM3RCxJQUFJQyx1QkFBdUIsR0FBRyxDQUM3QixhQUFhLEVBQ2IsY0FBYyxFQUNkLGFBQWEsRUFDYixhQUFhLEVBQ2IsWUFBWSxFQUNaLDJCQUEyQixFQUMzQixnQkFBZ0IsRUFDaEIsMkJBQTJCLEVBQzNCLCtCQUErQixDQUMvQjs7RUFFRDtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLHFCQUFxQkEsQ0FBRUMsV0FBVyxFQUFHO0lBQzdDQSxXQUFXLEdBQUdDLFFBQVEsQ0FBRUQsV0FBVyxFQUFFLEVBQUcsQ0FBQztJQUV6QyxPQUFPQSxXQUFXLEdBQUcsQ0FBQyxHQUFHQSxXQUFXLEdBQUcsQ0FBQztFQUN6Qzs7RUFFQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNFLG9CQUFvQkEsQ0FBRUMsVUFBVSxFQUFHO0lBQzNDQSxVQUFVLEdBQUdGLFFBQVEsQ0FBRUUsVUFBVSxFQUFFLEVBQUcsQ0FBQztJQUV2QyxPQUFPQSxVQUFVLEdBQUcsQ0FBQyxHQUFHQSxVQUFVLEdBQUcsQ0FBQztFQUN2Qzs7RUFFQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLGNBQWNBLENBQUVDLFFBQVEsRUFBRztJQUNuQyxJQUFJQyxVQUFVLEdBQUdDLE1BQU0sQ0FBRUYsUUFBUSxJQUFJLEVBQUcsQ0FBQyxDQUFDRyxLQUFLLENBQUUsMkJBQTRCLENBQUM7SUFDOUUsSUFBSUMsV0FBVztJQUVmLElBQUssQ0FBRUgsVUFBVSxFQUFHO01BQ25CLE9BQU8sSUFBSTtJQUNaO0lBRUFHLFdBQVcsR0FBRyxJQUFJQyxJQUFJLENBQ3JCVCxRQUFRLENBQUVLLFVBQVUsQ0FBRSxDQUFDLENBQUUsRUFBRSxFQUFHLENBQUMsRUFDL0JMLFFBQVEsQ0FBRUssVUFBVSxDQUFFLENBQUMsQ0FBRSxFQUFFLEVBQUcsQ0FBQyxHQUFHLENBQUMsRUFDbkNMLFFBQVEsQ0FBRUssVUFBVSxDQUFFLENBQUMsQ0FBRSxFQUFFLEVBQUcsQ0FBQyxFQUMvQixDQUFDLEVBQ0QsQ0FBQyxFQUNELENBQUMsRUFDRCxDQUNELENBQUM7SUFFRCxJQUNDRyxXQUFXLENBQUNFLFdBQVcsQ0FBQyxDQUFDLEtBQUtWLFFBQVEsQ0FBRUssVUFBVSxDQUFFLENBQUMsQ0FBRSxFQUFFLEVBQUcsQ0FBQyxJQUM3REcsV0FBVyxDQUFDRyxRQUFRLENBQUMsQ0FBQyxLQUFLWCxRQUFRLENBQUVLLFVBQVUsQ0FBRSxDQUFDLENBQUUsRUFBRSxFQUFHLENBQUMsR0FBRyxDQUFDLElBQzlERyxXQUFXLENBQUNJLE9BQU8sQ0FBQyxDQUFDLEtBQUtaLFFBQVEsQ0FBRUssVUFBVSxDQUFFLENBQUMsQ0FBRSxFQUFFLEVBQUcsQ0FBQyxFQUN4RDtNQUNELE9BQU8sSUFBSTtJQUNaO0lBRUEsT0FBT0csV0FBVztFQUNuQjs7RUFFQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNLLGVBQWVBLENBQUVDLGFBQWEsRUFBRztJQUN6QyxJQUFJQyxJQUFJO0lBQ1IsSUFBSUMsS0FBSztJQUNULElBQUlDLEdBQUc7SUFFUCxJQUFLLENBQUVILGFBQWEsSUFBSUksS0FBSyxDQUFFSixhQUFhLENBQUNLLE9BQU8sQ0FBQyxDQUFFLENBQUMsRUFBRztNQUMxRCxPQUFPLEVBQUU7SUFDVjtJQUVBSixJQUFJLEdBQUdULE1BQU0sQ0FBRVEsYUFBYSxDQUFDSixXQUFXLENBQUMsQ0FBRSxDQUFDO0lBQzVDTSxLQUFLLEdBQUdWLE1BQU0sQ0FBRVEsYUFBYSxDQUFDSCxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUUsQ0FBQztJQUM5Q00sR0FBRyxHQUFHWCxNQUFNLENBQUVRLGFBQWEsQ0FBQ0YsT0FBTyxDQUFDLENBQUUsQ0FBQztJQUV2QyxPQUFPRyxJQUFJLEdBQUcsR0FBRyxJQUFLQyxLQUFLLENBQUNJLE1BQU0sR0FBRyxDQUFDLEdBQUcsR0FBRyxHQUFHSixLQUFLLEdBQUdBLEtBQUssQ0FBRSxHQUFHLEdBQUcsSUFBS0MsR0FBRyxDQUFDRyxNQUFNLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBR0gsR0FBRyxHQUFHQSxHQUFHLENBQUU7RUFDNUc7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTSSxtQkFBbUJBLENBQUVDLGNBQWMsRUFBRztJQUM5QyxJQUFJQyxZQUFZLEdBQUcsQ0FBQyxDQUFDO0lBRXJCLElBQUssQ0FBRUMsS0FBSyxDQUFDQyxPQUFPLENBQUVILGNBQWUsQ0FBQyxFQUFHO01BQ3hDLE9BQU8sRUFBRTtJQUNWO0lBRUFBLGNBQWMsQ0FBQ0ksT0FBTyxDQUFFLFVBQVdaLGFBQWEsRUFBRztNQUNsRCxJQUFJTixXQUFXLEdBQUdMLGNBQWMsQ0FBRVcsYUFBYyxDQUFDO01BQ2pELElBQUlhLGVBQWUsR0FBR25CLFdBQVcsR0FBR0ssZUFBZSxDQUFFTCxXQUFZLENBQUMsR0FBRyxFQUFFO01BRXZFLElBQUttQixlQUFlLEVBQUc7UUFDdEJKLFlBQVksQ0FBRUksZUFBZSxDQUFFLEdBQUcsSUFBSTtNQUN2QztJQUNELENBQUUsQ0FBQztJQUVILE9BQU9DLE1BQU0sQ0FBQ0MsSUFBSSxDQUFFTixZQUFhLENBQUMsQ0FBQ08sSUFBSSxDQUFDLENBQUM7RUFDMUM7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTQywyQkFBMkJBLENBQUVDLFVBQVUsRUFBRztJQUNsREEsVUFBVSxHQUFHMUIsTUFBTSxDQUFFMEIsVUFBVSxJQUFJLEVBQUcsQ0FBQztJQUV2QyxPQUFPLDZCQUE2QixDQUFDQyxJQUFJLENBQUVELFVBQVcsQ0FBQyxHQUFHQSxVQUFVLEdBQUcsRUFBRTtFQUMxRTs7RUFFQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNFLDZCQUE2QkEsQ0FBRUMsbUJBQW1CLEVBQUc7SUFDN0QsSUFBSUMscUJBQXFCLEdBQUcsQ0FBQyxDQUFDO0lBRTlCLElBQUssQ0FBRUQsbUJBQW1CLElBQUksUUFBUSxLQUFLLE9BQU9BLG1CQUFtQixJQUFJWCxLQUFLLENBQUNDLE9BQU8sQ0FBRVUsbUJBQW9CLENBQUMsRUFBRztNQUMvRyxPQUFPQyxxQkFBcUI7SUFDN0I7SUFFQTFDLHdCQUF3QixDQUFDZ0MsT0FBTyxDQUFFLFVBQVdXLGNBQWMsRUFBRztNQUM3RCxJQUFLVCxNQUFNLENBQUNVLFNBQVMsQ0FBQ0MsY0FBYyxDQUFDQyxJQUFJLENBQUVMLG1CQUFtQixFQUFFRSxjQUFlLENBQUMsRUFBRztRQUNsRkQscUJBQXFCLENBQUVDLGNBQWMsQ0FBRSxHQUFHRixtQkFBbUIsQ0FBRUUsY0FBYyxDQUFFO01BQ2hGO0lBQ0QsQ0FBRSxDQUFDO0lBRUgsT0FBT0QscUJBQXFCO0VBQzdCOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTSywyQkFBMkJBLENBQUVDLGdCQUFnQixFQUFFQyxhQUFhLEVBQUc7SUFDdkUsSUFBSUMsaUJBQWlCLEdBQUcsQ0FBQyxDQUFDO0lBRTFCLElBQUssQ0FBRUYsZ0JBQWdCLElBQUksUUFBUSxLQUFLLE9BQU9BLGdCQUFnQixJQUFJbEIsS0FBSyxDQUFDQyxPQUFPLENBQUVpQixnQkFBaUIsQ0FBQyxFQUFHO01BQ3RHLE9BQU9FLGlCQUFpQjtJQUN6QjtJQUVBRCxhQUFhLENBQUNqQixPQUFPLENBQUUsVUFBV1csY0FBYyxFQUFHO01BQ2xELElBQUlRLGVBQWU7TUFFbkIsSUFBSyxDQUFFakIsTUFBTSxDQUFDVSxTQUFTLENBQUNDLGNBQWMsQ0FBQ0MsSUFBSSxDQUFFRSxnQkFBZ0IsRUFBRUwsY0FBZSxDQUFDLEVBQUc7UUFDakY7TUFDRDtNQUNBUSxlQUFlLEdBQUdILGdCQUFnQixDQUFFTCxjQUFjLENBQUU7TUFDcEQsSUFBSyxJQUFJLEtBQUtRLGVBQWUsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFFLENBQUNDLE9BQU8sQ0FBRSxPQUFPRCxlQUFnQixDQUFDLEVBQUc7UUFDN0dELGlCQUFpQixDQUFFUCxjQUFjLENBQUUsR0FBR1EsZUFBZTtNQUN0RDtJQUNELENBQUUsQ0FBQztJQUVILE9BQU9ELGlCQUFpQjtFQUN6Qjs7RUFFQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNHLFVBQVVBLENBQUVDLElBQUksRUFBRztJQUMzQixJQUFLLENBQUVBLElBQUksRUFBRztNQUNiO0lBQ0Q7SUFFQSxPQUFRQSxJQUFJLENBQUNDLFVBQVUsRUFBRztNQUN6QkQsSUFBSSxDQUFDRSxXQUFXLENBQUVGLElBQUksQ0FBQ0MsVUFBVyxDQUFDO0lBQ3BDO0VBQ0Q7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0Usc0NBQXNDQSxDQUFFcEQsV0FBVyxFQUFHO0lBQzlELElBQUlxRCxTQUFTO0lBQ2IsSUFBSUMsWUFBWTtJQUNoQixJQUFJQyxjQUFjO0lBQ2xCLElBQUlDLFVBQVUsR0FBRyxDQUFDLENBQUM7SUFFbkIsSUFDQyxDQUFFekUsTUFBTSxDQUFDMEUsS0FBSyxJQUNkLFVBQVUsS0FBSyxPQUFPMUUsTUFBTSxDQUFDMEUsS0FBSyxDQUFDQyxrQkFBa0IsSUFDckQsQ0FBRTFELFdBQVcsRUFDWjtNQUNELE9BQU8sSUFBSTtJQUNaO0lBRUFxRCxTQUFTLEdBQUd0RSxNQUFNLENBQUMwRSxLQUFLLENBQUNDLGtCQUFrQixDQUFDLENBQUM7SUFDN0NMLFNBQVMsR0FBR0EsU0FBUyxJQUFJLFFBQVEsS0FBSyxPQUFPQSxTQUFTLElBQUksQ0FBRTVCLEtBQUssQ0FBQ0MsT0FBTyxDQUFFMkIsU0FBVSxDQUFDLEdBQUdBLFNBQVMsR0FBRyxDQUFDLENBQUM7SUFDdkdDLFlBQVksR0FBRyxXQUFXLEdBQUd0RCxXQUFXO0lBRXhDLElBQUssQ0FBRTZCLE1BQU0sQ0FBQ1UsU0FBUyxDQUFDQyxjQUFjLENBQUNDLElBQUksQ0FBRVksU0FBUyxFQUFFQyxZQUFhLENBQUMsRUFBRztNQUN4RSxPQUFPO1FBQ05LLEdBQUcsRUFBRUwsWUFBWTtRQUNqQk0sT0FBTyxFQUFFLEtBQUs7UUFDZEosVUFBVSxFQUFFO01BQ2IsQ0FBQztJQUNGO0lBRUFELGNBQWMsR0FBR0YsU0FBUyxDQUFFQyxZQUFZLENBQUU7SUFDMUMsSUFBS0MsY0FBYyxJQUFJLFFBQVEsS0FBSyxPQUFPQSxjQUFjLElBQUksQ0FBRTlCLEtBQUssQ0FBQ0MsT0FBTyxDQUFFNkIsY0FBZSxDQUFDLEVBQUc7TUFDaEcxQixNQUFNLENBQUNDLElBQUksQ0FBRXlCLGNBQWUsQ0FBQyxDQUFDNUIsT0FBTyxDQUFFLFVBQVdXLGNBQWMsRUFBRztRQUNsRWtCLFVBQVUsQ0FBRWxCLGNBQWMsQ0FBRSxHQUFHaUIsY0FBYyxDQUFFakIsY0FBYyxDQUFFO01BQ2hFLENBQUUsQ0FBQztJQUNKO0lBRUEsT0FBTztNQUNOcUIsR0FBRyxFQUFFTCxZQUFZO01BQ2pCTSxPQUFPLEVBQUUsSUFBSTtNQUNiSixVQUFVLEVBQUVBO0lBQ2IsQ0FBQztFQUNGOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTSyxzQ0FBc0NBLENBQUVDLGlCQUFpQixFQUFHO0lBQ3BFLElBQUlULFNBQVM7SUFFYixJQUNDLENBQUVTLGlCQUFpQixJQUNuQixRQUFRLEtBQUssT0FBT0EsaUJBQWlCLENBQUNILEdBQUcsSUFDekMsQ0FBRTVFLE1BQU0sQ0FBQzBFLEtBQUssSUFDZCxVQUFVLEtBQUssT0FBTzFFLE1BQU0sQ0FBQzBFLEtBQUssQ0FBQ0Msa0JBQWtCLElBQ3JELFVBQVUsS0FBSyxPQUFPM0UsTUFBTSxDQUFDMEUsS0FBSyxDQUFDTSxrQkFBa0IsRUFDcEQ7TUFDRCxPQUFPLEtBQUs7SUFDYjtJQUVBVixTQUFTLEdBQUd0RSxNQUFNLENBQUMwRSxLQUFLLENBQUNDLGtCQUFrQixDQUFDLENBQUM7SUFDN0NMLFNBQVMsR0FBR0EsU0FBUyxJQUFJLFFBQVEsS0FBSyxPQUFPQSxTQUFTLElBQUksQ0FBRTVCLEtBQUssQ0FBQ0MsT0FBTyxDQUFFMkIsU0FBVSxDQUFDLEdBQUdBLFNBQVMsR0FBRyxDQUFDLENBQUM7SUFFdkcsSUFBS1MsaUJBQWlCLENBQUNGLE9BQU8sRUFBRztNQUNoQ1AsU0FBUyxDQUFFUyxpQkFBaUIsQ0FBQ0gsR0FBRyxDQUFFLEdBQUdHLGlCQUFpQixDQUFDTixVQUFVLElBQUksQ0FBQyxDQUFDO0lBQ3hFLENBQUMsTUFBTTtNQUNOLE9BQU9ILFNBQVMsQ0FBRVMsaUJBQWlCLENBQUNILEdBQUcsQ0FBRTtJQUMxQztJQUVBNUUsTUFBTSxDQUFDMEUsS0FBSyxDQUFDTSxrQkFBa0IsQ0FBRVYsU0FBVSxDQUFDO0lBRTVDLE9BQU8sSUFBSTtFQUNaOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTVyw4QkFBOEJBLENBQUEsRUFBRztJQUN6QyxJQUFJZixJQUFJLEdBQUcsSUFBSTtJQUNmLElBQUlqRCxXQUFXLEdBQUcsQ0FBQztJQUNuQixJQUFJaUUsZUFBZSxHQUFHLENBQUM7SUFDdkIsSUFBSUMsd0JBQXdCLEdBQUcsSUFBSTtJQUNuQyxJQUFJQyxpQkFBaUIsR0FBRyxDQUFDLENBQUM7SUFDMUIsSUFBSUMsMEJBQTBCLEdBQUcsSUFBSTtJQUNyQyxJQUFJQyx5QkFBeUIsR0FBRyxDQUFDLENBQUM7SUFDbEMsSUFBSUMsMEJBQTBCLEdBQUcsQ0FBQyxDQUFDOztJQUVuQztBQUNGO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0MsY0FBY0EsQ0FBQSxFQUFHO01BQ3pCLE9BQU9DLE9BQU8sQ0FDYnpGLE1BQU0sQ0FBQzBFLEtBQUssSUFDWixVQUFVLEtBQUssT0FBTzFFLE1BQU0sQ0FBQzBFLEtBQUssQ0FBQ0Msa0JBQWtCLElBQ3JELFVBQVUsS0FBSyxPQUFPM0UsTUFBTSxDQUFDMEUsS0FBSyxDQUFDTSxrQkFBa0IsSUFDckQsVUFBVSxLQUFLLE9BQU9oRixNQUFNLENBQUMwRSxLQUFLLENBQUNnQix3QkFBd0IsSUFDM0QsVUFBVSxLQUFLLE9BQU8xRixNQUFNLENBQUMwRSxLQUFLLENBQUNpQix5QkFBeUIsSUFDNUQsVUFBVSxLQUFLLE9BQU8zRixNQUFNLENBQUMwRSxLQUFLLENBQUNrQixlQUFlLElBQ2xELFVBQVUsS0FBSyxPQUFPNUYsTUFBTSxDQUFDMEUsS0FBSyxDQUFDbUIsZUFBZSxJQUNsRCxVQUFVLEtBQUssT0FBTzdGLE1BQU0sQ0FBQzBFLEtBQUssQ0FBQ29CLGdCQUFnQixJQUNuRCxVQUFVLEtBQUssT0FBTzlGLE1BQU0sQ0FBQzBFLEtBQUssQ0FBQ3FCLGdCQUFnQixJQUNuRCxVQUFVLEtBQUssT0FBTy9GLE1BQU0sQ0FBQ2dHLGtCQUFrQixJQUMvQyxVQUFVLEtBQUssT0FBT2hHLE1BQU0sQ0FBQ2lHLDZCQUE2QixJQUMxRCxVQUFVLEtBQUssT0FBT2pHLE1BQU0sQ0FBQ2tHLHVCQUF1QixJQUNwRGhHLENBQUMsQ0FBQ2lHLFFBQVEsSUFDVixVQUFVLEtBQUssT0FBT2pHLENBQUMsQ0FBQ2lHLFFBQVEsQ0FBQ0MsV0FBVyxJQUM1QyxVQUFVLEtBQUssT0FBT2xHLENBQUMsQ0FBQ2lHLFFBQVEsQ0FBQ0UsZUFDbEMsQ0FBQztJQUNGOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTQyx1QkFBdUJBLENBQUVDLGlCQUFpQixFQUFHO01BQ3JELElBQUlqRCxxQkFBcUIsR0FBR0ssMkJBQTJCLENBQUU0QyxpQkFBaUIsRUFBRXpGLHNCQUF1QixDQUFDO01BRXBHQSxzQkFBc0IsQ0FBQzhCLE9BQU8sQ0FBRSxVQUFXVyxjQUFjLEVBQUc7UUFDM0QsSUFBSyxDQUFFVCxNQUFNLENBQUNVLFNBQVMsQ0FBQ0MsY0FBYyxDQUFDQyxJQUFJLENBQUVKLHFCQUFxQixFQUFFQyxjQUFlLENBQUMsRUFBRztVQUN0RjtRQUNEO1FBQ0FnQywwQkFBMEIsQ0FBRWhDLGNBQWMsQ0FBRSxHQUFHdkQsTUFBTSxDQUFDMEUsS0FBSyxDQUFDcUIsZ0JBQWdCLENBQUV4QyxjQUFlLENBQUM7UUFDOUZ2RCxNQUFNLENBQUMwRSxLQUFLLENBQUNvQixnQkFBZ0IsQ0FBRXZDLGNBQWMsRUFBRUQscUJBQXFCLENBQUVDLGNBQWMsQ0FBRyxDQUFDO01BQ3pGLENBQUUsQ0FBQztJQUNKOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU2lELHlCQUF5QkEsQ0FBRW5ELG1CQUFtQixFQUFHO01BQ3pELElBQUlDLHFCQUFxQixHQUFHRiw2QkFBNkIsQ0FBRUMsbUJBQW9CLENBQUM7TUFFaEZyRCxNQUFNLENBQUMwRSxLQUFLLENBQUNnQix3QkFBd0IsQ0FBRXpFLFdBQVcsRUFBRXFDLHFCQUFzQixDQUFDO0lBQzVFOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU21ELHdCQUF3QkEsQ0FBRUMsa0JBQWtCLEVBQUc7TUFDdkQsSUFBSyxDQUFFQSxrQkFBa0IsSUFBSSxRQUFRLEtBQUssT0FBT0Esa0JBQWtCLElBQUloRSxLQUFLLENBQUNDLE9BQU8sQ0FBRStELGtCQUFtQixDQUFDLEVBQUc7UUFDNUc7TUFDRDtNQUVBN0YscUJBQXFCLENBQUMrQixPQUFPLENBQUUsVUFBV1csY0FBYyxFQUFHO1FBQzFELElBQUssQ0FBRVQsTUFBTSxDQUFDVSxTQUFTLENBQUNDLGNBQWMsQ0FBQ0MsSUFBSSxDQUFFZ0Qsa0JBQWtCLEVBQUVuRCxjQUFlLENBQUMsRUFBRztVQUNuRjtRQUNEO1FBQ0ErQix5QkFBeUIsQ0FBRS9CLGNBQWMsQ0FBRSxHQUFHdkQsTUFBTSxDQUFDMEUsS0FBSyxDQUFDbUIsZUFBZSxDQUFFdEMsY0FBZSxDQUFDO1FBQzVGdkQsTUFBTSxDQUFDMEUsS0FBSyxDQUFDa0IsZUFBZSxDQUFFckMsY0FBYyxFQUFFbUQsa0JBQWtCLENBQUVuRCxjQUFjLENBQUcsQ0FBQztNQUNyRixDQUFFLENBQUM7SUFDSjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNvRCxrQkFBa0JBLENBQUEsRUFBRztNQUM3QixJQUFJQyxpQkFBaUI7TUFDckIsSUFBSXBFLGNBQWM7TUFFbEIsSUFBSyxDQUFFdkIsV0FBVyxJQUFJLFVBQVUsS0FBSyxPQUFPakIsTUFBTSxDQUFDa0csdUJBQXVCLEVBQUc7UUFDNUUsT0FBTyxFQUFFO01BQ1Y7TUFFQSxJQUFLLFVBQVUsS0FBSyxPQUFPbEcsTUFBTSxDQUFDNkcsb0NBQW9DLEVBQUc7UUFDeEUsT0FBT3RFLG1CQUFtQixDQUFFdkMsTUFBTSxDQUFDNkcsb0NBQW9DLENBQUU1RixXQUFZLENBQUUsQ0FBQztNQUN6RjtNQUVBMkYsaUJBQWlCLEdBQUc1RyxNQUFNLENBQUNrRyx1QkFBdUIsQ0FBRWpGLFdBQVksQ0FBQztNQUNqRXVCLGNBQWMsR0FBR29FLGlCQUFpQixJQUFJbEUsS0FBSyxDQUFDQyxPQUFPLENBQUVpRSxpQkFBaUIsQ0FBQ0UsS0FBTSxDQUFDLEdBQzNFRixpQkFBaUIsQ0FBQ0UsS0FBSyxDQUFDQyxHQUFHLENBQUVoRixlQUFnQixDQUFDLEdBQzlDLEVBQUU7TUFFTCxPQUFPUSxtQkFBbUIsQ0FBRUMsY0FBZSxDQUFDO0lBQzdDOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU3dFLHdCQUF3QkEsQ0FBRXhFLGNBQWMsRUFBRztNQUNuRCxJQUFJeUUsZ0JBQWdCLEdBQUcxRSxtQkFBbUIsQ0FBRUMsY0FBZSxDQUFDO01BQzVELElBQUlvRSxpQkFBaUIsR0FBRzVHLE1BQU0sQ0FBQ2tHLHVCQUF1QixDQUFFakYsV0FBWSxDQUFDO01BQ3JFLElBQUlpRyxZQUFZO01BQ2hCLElBQUlDLGlCQUFpQjtNQUNyQixJQUFJQyxhQUFhO01BRWpCLElBQUssQ0FBRVIsaUJBQWlCLEVBQUc7UUFDMUIsT0FBTyxLQUFLO01BQ2I7TUFFQU0sWUFBWSxHQUFHRCxnQkFBZ0IsQ0FBQ0YsR0FBRyxDQUFFMUYsY0FBZSxDQUFDLENBQUNnRyxNQUFNLENBQUUsVUFBV3JGLGFBQWEsRUFBRztRQUN4RixPQUFPLElBQUksS0FBS0EsYUFBYTtNQUM5QixDQUFFLENBQUM7TUFDSG1GLGlCQUFpQixHQUFHbEgsUUFBUSxDQUFDcUgsY0FBYyxDQUFFLGNBQWMsR0FBR3JHLFdBQVksQ0FBQztNQUUzRTJGLGlCQUFpQixDQUFDVyxRQUFRLEdBQUcsS0FBSztNQUNsQ1gsaUJBQWlCLENBQUNFLEtBQUssR0FBR0ksWUFBWTtNQUN0QyxJQUFLQyxpQkFBaUIsRUFBRztRQUN4QkEsaUJBQWlCLENBQUNLLEtBQUssR0FBR04sWUFBWSxDQUFDSCxHQUFHLENBQUUsVUFBVy9FLGFBQWEsRUFBRztVQUN0RSxPQUFPOUIsQ0FBQyxDQUFDaUcsUUFBUSxDQUFDQyxXQUFXLENBQUVRLGlCQUFpQixFQUFFNUUsYUFBYyxDQUFDO1FBQ2xFLENBQUUsQ0FBQyxDQUFDeUYsSUFBSSxDQUFFLElBQUssQ0FBQztNQUNqQjtNQUNBdkgsQ0FBQyxDQUFDaUcsUUFBUSxDQUFDRSxlQUFlLENBQUVPLGlCQUFrQixDQUFDO01BRS9DLElBQUtNLFlBQVksQ0FBQzVFLE1BQU0sSUFBSSxVQUFVLEtBQUssT0FBT3RDLE1BQU0sQ0FBQzBILHdCQUF3QixFQUFHO1FBQ25GMUgsTUFBTSxDQUFDMEgsd0JBQXdCLENBQzlCekcsV0FBVyxFQUNYaUcsWUFBWSxDQUFFLENBQUMsQ0FBRSxDQUFDdEYsV0FBVyxDQUFDLENBQUMsRUFDL0JzRixZQUFZLENBQUUsQ0FBQyxDQUFFLENBQUNyRixRQUFRLENBQUMsQ0FBQyxHQUFHLENBQ2hDLENBQUM7TUFDRjtNQUVBdUYsYUFBYSxHQUFHVCxrQkFBa0IsQ0FBQyxDQUFDO01BRXBDLE9BQU9NLGdCQUFnQixDQUFDUSxJQUFJLENBQUUsR0FBSSxDQUFDLEtBQUtMLGFBQWEsQ0FBQ0ssSUFBSSxDQUFFLEdBQUksQ0FBQztJQUNsRTs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0UsS0FBS0EsQ0FBRUMsYUFBYSxFQUFFQyxtQkFBbUIsRUFBRztNQUNwRCxJQUFJQyxxQkFBcUI7TUFDekIsSUFBSUMsaUJBQWlCO01BRXJCRixtQkFBbUIsR0FBR0EsbUJBQW1CLElBQUksQ0FBQyxDQUFDO01BQy9DQyxxQkFBcUIsR0FBRzlHLHFCQUFxQixDQUFFNkcsbUJBQW1CLENBQUM1RyxXQUFZLENBQUM7TUFFaEYsSUFDQ04sY0FBYyxJQUNkLENBQUU2RSxjQUFjLENBQUMsQ0FBQyxJQUNsQixDQUFFb0MsYUFBYSxJQUNmLENBQUMsS0FBS0EsYUFBYSxDQUFDSSxRQUFRLElBQzVCLENBQUVGLHFCQUFxQixJQUN2QixRQUFRLEtBQUssT0FBT0QsbUJBQW1CLENBQUNJLGFBQWEsRUFDcEQ7UUFDRCxPQUFPLEtBQUs7TUFDYjtNQUVBRixpQkFBaUIsR0FBRzlILFFBQVEsQ0FBQ3FILGNBQWMsQ0FBRSxrQkFBa0IsR0FBR1EscUJBQXNCLENBQUM7TUFDekYsSUFBS0MsaUJBQWlCLElBQUksQ0FBRUgsYUFBYSxDQUFDTSxRQUFRLENBQUVILGlCQUFrQixDQUFDLEVBQUc7UUFDekUsT0FBTyxLQUFLO01BQ2I7TUFFQXBILGNBQWMsR0FBR3dILFdBQVc7TUFDNUJqRSxJQUFJLEdBQUcwRCxhQUFhO01BQ3BCM0csV0FBVyxHQUFHNkcscUJBQXFCO01BQ25DekMsMEJBQTBCLEdBQUdoQixzQ0FBc0MsQ0FBRXBELFdBQVksQ0FBQztNQUNsRm1FLGlCQUFpQixHQUFHaEMsNkJBQTZCLENBQUV5RSxtQkFBbUIsQ0FBQ3pDLGlCQUFrQixDQUFDO01BQzFGb0IseUJBQXlCLENBQUVxQixtQkFBbUIsQ0FBQ3hFLG1CQUFvQixDQUFDO01BQ3BFb0Qsd0JBQXdCLENBQUVvQixtQkFBbUIsQ0FBQ25CLGtCQUFtQixDQUFDO01BQ2xFSix1QkFBdUIsQ0FBRXVCLG1CQUFtQixDQUFDdEIsaUJBQWtCLENBQUM7TUFDaEVyQyxJQUFJLENBQUNrRSxTQUFTLEdBQUdQLG1CQUFtQixDQUFDSSxhQUFhO01BRWxELElBQUssQ0FBRWhJLFFBQVEsQ0FBQ3FILGNBQWMsQ0FBRSxrQkFBa0IsR0FBR3JHLFdBQVksQ0FBQyxJQUFJLEtBQUssS0FBS2pCLE1BQU0sQ0FBQ2dHLGtCQUFrQixDQUFFL0UsV0FBWSxDQUFDLEVBQUc7UUFDMUhvSCxRQUFRLENBQUMsQ0FBQztRQUNWLE9BQU8sS0FBSztNQUNiO01BRUEsT0FBTyxJQUFJO0lBQ1o7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0MsSUFBSUEsQ0FBRUMsa0JBQWtCLEVBQUVDLFNBQVMsRUFBRUMsU0FBUyxFQUFHO01BQ3pELElBQUlDLGtCQUFrQjtNQUN0QixJQUFJQyxrQkFBa0I7TUFDdEIsSUFBSUMsZUFBZTtNQUVuQixJQUFLakksY0FBYyxLQUFLd0gsV0FBVyxJQUFJLENBQUVsSCxXQUFXLElBQUksVUFBVSxLQUFLLE9BQU9qQixNQUFNLENBQUNpRyw2QkFBNkIsRUFBRztRQUNwSCxPQUFPLEtBQUs7TUFDYjtNQUVBNEMsVUFBVSxDQUFDLENBQUM7TUFDWkgsa0JBQWtCLEdBQUd4RCxlQUFlO01BQ3BDeUQsa0JBQWtCLEdBQUdoRiwyQkFBMkIsQ0FBRTRFLGtCQUFrQixFQUFFeEgsdUJBQXdCLENBQUM7TUFDL0Y0SCxrQkFBa0IsQ0FBQzFILFdBQVcsR0FBR0EsV0FBVztNQUM1Q2YsQ0FBQyxDQUFFLE1BQU8sQ0FBQyxDQUFDNEksR0FBRyxDQUFFLGdDQUFnQyxHQUFHM0ksZUFBZ0IsQ0FBQztNQUNyRUQsQ0FBQyxDQUFFLE1BQU8sQ0FBQyxDQUFDNkksRUFBRSxDQUFFLGdDQUFnQyxHQUFHNUksZUFBZSxFQUFFLFVBQVc2SSxLQUFLLEVBQUVDLGtCQUFrQixFQUFHO1FBQzFHLElBQ0N0SSxjQUFjLEtBQUt3SCxXQUFXLElBQzlCTyxrQkFBa0IsS0FBS3hELGVBQWUsSUFDdENqRSxXQUFXLEtBQUtELHFCQUFxQixDQUFFaUksa0JBQW1CLENBQUMsSUFDM0QsQ0FBRTlELHdCQUF3QixJQUMxQixDQUFDLEtBQUtBLHdCQUF3QixDQUFDK0QsVUFBVSxFQUN4QztVQUNEO1FBQ0Q7UUFFQWhKLENBQUMsQ0FBRSxNQUFPLENBQUMsQ0FBQzRJLEdBQUcsQ0FBRSxnQ0FBZ0MsR0FBRzNJLGVBQWdCLENBQUM7UUFDckVELENBQUMsQ0FBRUQsUUFBUyxDQUFDLENBQUM2SSxHQUFHLENBQUUsVUFBVSxHQUFHMUksc0JBQXVCLENBQUM7UUFDeEQrRSx3QkFBd0IsR0FBRyxJQUFJO1FBQy9CLElBQUssVUFBVSxLQUFLLE9BQU9xRCxTQUFTLEVBQUc7VUFDdENBLFNBQVMsQ0FBRXZILFdBQVksQ0FBQztRQUN6QjtNQUNELENBQUUsQ0FBQztNQUNIMkgsZUFBZSxHQUFHLFNBQUFBLENBQVdJLEtBQUssRUFBRUcsTUFBTSxFQUFFQyxhQUFhLEVBQUc7UUFDM0QsSUFBSUMsWUFBWSxHQUFHN0gsTUFBTSxDQUFFNEgsYUFBYSxJQUFJQSxhQUFhLENBQUNFLElBQUksR0FBR0YsYUFBYSxDQUFDRSxJQUFJLEdBQUcsRUFBRyxDQUFDO1FBQzFGLElBQUlDLFlBQVk7UUFFaEIsSUFBSTtVQUNIQSxZQUFZLEdBQUdDLGtCQUFrQixDQUFFSCxZQUFZLENBQUNJLE9BQU8sQ0FBRSxLQUFLLEVBQUUsS0FBTSxDQUFFLENBQUM7UUFDMUUsQ0FBQyxDQUFDLE9BQVFDLFlBQVksRUFBRztVQUN4QkgsWUFBWSxHQUFHRixZQUFZO1FBQzVCO1FBQ0EsSUFDQyxDQUFFLDZDQUE2QyxDQUFDbEcsSUFBSSxDQUFFb0csWUFBYSxDQUFDLElBQ3BFLENBQUUsSUFBSUksTUFBTSxDQUFFLGtEQUFrRCxHQUFHMUksV0FBVyxHQUFHLFNBQVUsQ0FBQyxDQUFDa0MsSUFBSSxDQUFFb0csWUFBYSxDQUFDLEVBQ2hIO1VBQ0Q7UUFDRDtRQUNBckosQ0FBQyxDQUFFRCxRQUFTLENBQUMsQ0FBQzZJLEdBQUcsQ0FBRSxVQUFVLEdBQUcxSSxzQkFBc0IsRUFBRXdJLGVBQWdCLENBQUM7UUFDekV6RCx3QkFBd0IsR0FBR2dFLE1BQU07UUFDakNBLE1BQU0sQ0FBQ1MsSUFBSSxDQUFFLFVBQVdDLGNBQWMsRUFBRUMsY0FBYyxFQUFHO1VBQ3hELElBQ0EsT0FBTyxLQUFLQSxjQUFjLElBQzFCbkosY0FBYyxLQUFLd0gsV0FBVyxJQUM5Qk8sa0JBQWtCLEtBQUt4RCxlQUFlLEVBQ3JDO1lBQ0E7VUFDRDtVQUNBaEYsQ0FBQyxDQUFFLE1BQU8sQ0FBQyxDQUFDNEksR0FBRyxDQUFFLGdDQUFnQyxHQUFHM0ksZUFBZ0IsQ0FBQztVQUNyRWdGLHdCQUF3QixHQUFHLElBQUk7VUFDL0IsSUFBSyxVQUFVLEtBQUssT0FBT3NELFNBQVMsRUFBRztZQUN0Q0EsU0FBUyxDQUFFb0IsY0FBZSxDQUFDO1VBQzVCO1FBQ0QsQ0FBRSxDQUFDO01BQ0osQ0FBQztNQUNEM0osQ0FBQyxDQUFFRCxRQUFTLENBQUMsQ0FBQzZJLEdBQUcsQ0FBRSxVQUFVLEdBQUcxSSxzQkFBdUIsQ0FBQztNQUN4REYsQ0FBQyxDQUFFRCxRQUFTLENBQUMsQ0FBQzhJLEVBQUUsQ0FBRSxVQUFVLEdBQUczSSxzQkFBc0IsRUFBRXdJLGVBQWdCLENBQUM7TUFDeEU1SSxNQUFNLENBQUNpRyw2QkFBNkIsQ0FBRTBDLGtCQUFtQixDQUFDO01BRTFELE9BQU8sSUFBSTtJQUNaOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTRSxVQUFVQSxDQUFBLEVBQUc7TUFDckIzRCxlQUFlLElBQUksQ0FBQztNQUNwQmhGLENBQUMsQ0FBRSxNQUFPLENBQUMsQ0FBQzRJLEdBQUcsQ0FBRSxnQ0FBZ0MsR0FBRzNJLGVBQWdCLENBQUM7TUFDckVELENBQUMsQ0FBRUQsUUFBUyxDQUFDLENBQUM2SSxHQUFHLENBQUUsVUFBVSxHQUFHMUksc0JBQXVCLENBQUM7TUFDeEQsSUFBS0osTUFBTSxDQUFDMEUsS0FBSyxJQUFJLFVBQVUsS0FBSyxPQUFPMUUsTUFBTSxDQUFDMEUsS0FBSyxDQUFDcUYsZ0NBQWdDLElBQUk5SSxXQUFXLEVBQUc7UUFDekdqQixNQUFNLENBQUMwRSxLQUFLLENBQUNxRixnQ0FBZ0MsQ0FBRTlJLFdBQVcsRUFBRSwrQkFBZ0MsQ0FBQztNQUM5RjtNQUNBLElBQUtrRSx3QkFBd0IsSUFBSSxVQUFVLEtBQUssT0FBT0Esd0JBQXdCLENBQUM2RSxLQUFLLEVBQUc7UUFDdkY3RSx3QkFBd0IsQ0FBQzZFLEtBQUssQ0FBQyxDQUFDO01BQ2pDO01BQ0E3RSx3QkFBd0IsR0FBRyxJQUFJO0lBQ2hDOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBUzhFLGtCQUFrQkEsQ0FBRUMsY0FBYyxFQUFHO01BQzdDLElBQUkxSCxjQUFjO01BRWxCLElBQUs3QixjQUFjLEtBQUt3SCxXQUFXLElBQUksQ0FBRWxILFdBQVcsRUFBRztRQUN0RCxPQUFPLEtBQUs7TUFDYjtNQUVBdUIsY0FBYyxHQUFHbUUsa0JBQWtCLENBQUMsQ0FBQztNQUNyQyxJQUFLdEcsZUFBZSxLQUFLNkosY0FBYyxFQUFHO1FBQ3pDLElBQUssVUFBVSxLQUFLLE9BQU9sSyxNQUFNLENBQUNtSyw4QkFBOEIsRUFBRztVQUNsRSxPQUFPLEtBQUs7UUFDYjtRQUNBbkssTUFBTSxDQUFDbUssOEJBQThCLENBQUVsSixXQUFZLENBQUM7TUFDckQsQ0FBQyxNQUFNLElBQUtYLFdBQVcsS0FBSzRKLGNBQWMsRUFBRztRQUM1QyxJQUNDLFVBQVUsS0FBSyxPQUFPbEssTUFBTSxDQUFDb0ssNkJBQTZCLElBQzFELFVBQVUsS0FBSyxPQUFPcEssTUFBTSxDQUFDcUssaUJBQWlCLEVBQzdDO1VBQ0QsT0FBTyxLQUFLO1FBQ2I7UUFDQXJLLE1BQU0sQ0FBQzBFLEtBQUssQ0FBQ2dCLHdCQUF3QixDQUFFekUsV0FBVyxFQUFFbUUsaUJBQWtCLENBQUM7UUFDdkVwRixNQUFNLENBQUNvSyw2QkFBNkIsQ0FBRW5KLFdBQVksQ0FBQztRQUNuRGpCLE1BQU0sQ0FBQ3FLLGlCQUFpQixDQUFFcEosV0FBWSxDQUFDO01BQ3hDLENBQUMsTUFBTTtRQUNOLE9BQU8sS0FBSztNQUNiOztNQUVBO01BQ0E7TUFDQStGLHdCQUF3QixDQUFFeEUsY0FBZSxDQUFDO01BRTFDLE9BQU8sSUFBSTtJQUNaOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTNkYsUUFBUUEsQ0FBQSxFQUFHO01BQ25CLElBQUlpQyxnQkFBZ0I7TUFFcEJ6QixVQUFVLENBQUMsQ0FBQztNQUVaeUIsZ0JBQWdCLEdBQUdySixXQUFXLEdBQUdoQixRQUFRLENBQUNxSCxjQUFjLENBQUUsa0JBQWtCLEdBQUdyRyxXQUFZLENBQUMsR0FBRyxJQUFJO01BQ25HLElBQUtxSixnQkFBZ0IsSUFBSXBLLENBQUMsQ0FBQ3FLLEVBQUUsQ0FBQ3BFLFFBQVEsRUFBRztRQUN4QyxJQUFJO1VBQ0hqRyxDQUFDLENBQUVvSyxnQkFBaUIsQ0FBQyxDQUFDbkUsUUFBUSxDQUFFLFNBQVUsQ0FBQztRQUM1QyxDQUFDLENBQUMsT0FBUXFFLGFBQWEsRUFBRztVQUN6QjtRQUFBO01BRUY7TUFFQSxJQUFLeEssTUFBTSxDQUFDMEUsS0FBSyxJQUFJekQsV0FBVyxFQUFHO1FBQ2xDNkQsc0NBQXNDLENBQUVPLDBCQUEyQixDQUFDO1FBQ3BFdkMsTUFBTSxDQUFDQyxJQUFJLENBQUV1Qyx5QkFBMEIsQ0FBQyxDQUFDMUMsT0FBTyxDQUFFLFVBQVdXLGNBQWMsRUFBRztVQUM3RXZELE1BQU0sQ0FBQzBFLEtBQUssQ0FBQ2tCLGVBQWUsQ0FBRXJDLGNBQWMsRUFBRStCLHlCQUF5QixDQUFFL0IsY0FBYyxDQUFHLENBQUM7UUFDNUYsQ0FBRSxDQUFDO1FBQ0hULE1BQU0sQ0FBQ0MsSUFBSSxDQUFFd0MsMEJBQTJCLENBQUMsQ0FBQzNDLE9BQU8sQ0FBRSxVQUFXVyxjQUFjLEVBQUc7VUFDOUV2RCxNQUFNLENBQUMwRSxLQUFLLENBQUNvQixnQkFBZ0IsQ0FBRXZDLGNBQWMsRUFBRWdDLDBCQUEwQixDQUFFaEMsY0FBYyxDQUFHLENBQUM7UUFDOUYsQ0FBRSxDQUFDO01BQ0o7TUFFQVUsVUFBVSxDQUFFQyxJQUFLLENBQUM7TUFDbEJBLElBQUksR0FBRyxJQUFJO01BQ1hqRCxXQUFXLEdBQUcsQ0FBQztNQUNmbUUsaUJBQWlCLEdBQUcsQ0FBQyxDQUFDO01BQ3RCQywwQkFBMEIsR0FBRyxJQUFJO01BQ2pDQyx5QkFBeUIsR0FBRyxDQUFDLENBQUM7TUFDOUJDLDBCQUEwQixHQUFHLENBQUMsQ0FBQztNQUMvQixJQUFLNUUsY0FBYyxLQUFLd0gsV0FBVyxFQUFHO1FBQ3JDeEgsY0FBYyxHQUFHLElBQUk7TUFDdEI7SUFDRDtJQUVBLElBQUl3SCxXQUFXLEdBQUc7TUFDakJSLEtBQUssRUFBRUEsS0FBSztNQUNaVyxJQUFJLEVBQUVBLElBQUk7TUFDVk8sVUFBVSxFQUFFQSxVQUFVO01BQ3RCN0Isd0JBQXdCLEVBQUVBLHdCQUF3QjtNQUNsRGlELGtCQUFrQixFQUFFQSxrQkFBa0I7TUFDdEN0RCxrQkFBa0IsRUFBRUEsa0JBQWtCO01BQ3RDMEIsUUFBUSxFQUFFQTtJQUNYLENBQUM7SUFFRCxPQUFPRixXQUFXO0VBQ25COztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU3NDLGtCQUFrQkEsQ0FBRUMsWUFBWSxFQUFHO0lBQzNDQSxZQUFZLEdBQUdBLFlBQVksSUFBSSxRQUFRLEtBQUssT0FBT0EsWUFBWSxHQUFHQSxZQUFZLEdBQUcsQ0FBQyxDQUFDO0lBRW5GLE9BQU87TUFDTkMsZ0JBQWdCLEVBQUV0SyxlQUFlLEtBQUtxSyxZQUFZLENBQUNDLGdCQUFnQixHQUFHdEssZUFBZSxHQUFHQyxXQUFXO01BQ25Hc0ssZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBRXJLLHlCQUF5QixFQUFFQyx5QkFBeUIsRUFBRUMseUJBQXlCLENBQUUsQ0FBQ3VELE9BQU8sQ0FBRTBHLFlBQVksQ0FBQ0UsZ0JBQWlCLENBQUMsR0FBR0YsWUFBWSxDQUFDRSxnQkFBZ0IsR0FBR3JLLHlCQUF5QjtNQUNqTnNLLFVBQVUsRUFBRTVILDJCQUEyQixDQUFFeUgsWUFBWSxDQUFDRyxVQUFXLENBQUM7TUFDbEVDLFFBQVEsRUFBRTdILDJCQUEyQixDQUFFeUgsWUFBWSxDQUFDSSxRQUFTLENBQUM7TUFDOUR0SSxjQUFjLEVBQUVELG1CQUFtQixDQUFFbUksWUFBWSxDQUFDbEksY0FBZTtJQUNsRSxDQUFDO0VBQ0Y7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTdUksbUJBQW1CQSxDQUFFTCxZQUFZLEVBQUc7SUFDNUMsSUFBSU0sWUFBWSxHQUFHUCxrQkFBa0IsQ0FBRUMsWUFBYSxDQUFDO0lBRXJENUgsTUFBTSxDQUFDbUksTUFBTSxDQUFFRCxZQUFZLENBQUN4SSxjQUFlLENBQUM7SUFFNUMsT0FBT00sTUFBTSxDQUFDbUksTUFBTSxDQUFFRCxZQUFhLENBQUM7RUFDckM7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTRSwwQkFBMEJBLENBQUVSLFlBQVksRUFBRztJQUNuRCxJQUFJUyxlQUFlLEdBQUdWLGtCQUFrQixDQUFFQyxZQUFhLENBQUM7SUFFeEQsSUFBS25LLHlCQUF5QixLQUFLNEssZUFBZSxDQUFDUCxnQkFBZ0IsRUFBRztNQUNyRU8sZUFBZSxDQUFDTixVQUFVLEdBQUcsRUFBRTtNQUMvQk0sZUFBZSxDQUFDTCxRQUFRLEdBQUcsRUFBRTtJQUM5QjtJQUVBLE9BQU9LLGVBQWU7RUFDdkI7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLHdCQUF3QkEsQ0FBRUMsY0FBYyxFQUFFQyxXQUFXLEVBQUc7SUFDaEUsSUFBSUMsZUFBZSxHQUFHL0osTUFBTSxDQUFFNkosY0FBYyxJQUFJLEVBQUcsQ0FBQztJQUVwREMsV0FBVyxDQUFDMUksT0FBTyxDQUFFLFVBQVdNLFVBQVUsRUFBRXNJLFVBQVUsRUFBRztNQUN4REQsZUFBZSxHQUFHQSxlQUFlLENBQUM5QixPQUFPLENBQUUsR0FBRyxJQUFLK0IsVUFBVSxHQUFHLENBQUMsQ0FBRSxHQUFHLElBQUksRUFBRXRJLFVBQVcsQ0FBQztNQUN4RixJQUFLLENBQUMsS0FBS3NJLFVBQVUsRUFBRztRQUN2QkQsZUFBZSxHQUFHQSxlQUFlLENBQUM5QixPQUFPLENBQUUsSUFBSSxFQUFFdkcsVUFBVyxDQUFDO01BQzlEO0lBQ0QsQ0FBRSxDQUFDO0lBRUgsT0FBT3FJLGVBQWU7RUFDdkI7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNFLGlCQUFpQkEsQ0FBRUMsZUFBZSxFQUFFQyxhQUFhLEVBQUVDLE9BQU8sRUFBRztJQUNyRSxJQUFJQyxRQUFRLEdBQUdGLGFBQWEsSUFBSSxRQUFRLEtBQUssT0FBT0EsYUFBYSxHQUFHQSxhQUFhLEdBQUcsQ0FBQyxDQUFDO0lBQ3RGLElBQUlHLGtCQUFrQixHQUFHRixPQUFPLElBQUksUUFBUSxLQUFLLE9BQU9BLE9BQU8sR0FBR0EsT0FBTyxHQUFHLENBQUMsQ0FBQztJQUM5RSxJQUFJRyxJQUFJLEdBQUdGLFFBQVEsQ0FBQ0UsSUFBSSxJQUFJLFFBQVEsS0FBSyxPQUFPRixRQUFRLENBQUNFLElBQUksR0FBR0YsUUFBUSxDQUFDRSxJQUFJLEdBQUcsQ0FBQyxDQUFDO0lBQ2xGLElBQUlDLGFBQWEsR0FBR0gsUUFBUSxDQUFDSSxJQUFJLElBQUksUUFBUSxLQUFLLE9BQU9KLFFBQVEsQ0FBQ0ksSUFBSSxHQUFHSixRQUFRLENBQUNJLElBQUksR0FBRyxDQUFDLENBQUM7SUFDM0YsSUFBSUMsZUFBZSxHQUFHTCxRQUFRLENBQUNNLE1BQU0sSUFBSSxRQUFRLEtBQUssT0FBT04sUUFBUSxDQUFDTSxNQUFNLEdBQUdOLFFBQVEsQ0FBQ00sTUFBTSxHQUFHLENBQUMsQ0FBQztJQUNuRyxJQUFJQyxjQUFjLEdBQUdQLFFBQVEsQ0FBQ1EsS0FBSyxJQUFJLFFBQVEsS0FBSyxPQUFPUixRQUFRLENBQUNRLEtBQUssR0FBR1IsUUFBUSxDQUFDUSxLQUFLLEdBQUcsQ0FBQyxDQUFDO0lBQy9GLElBQUlDLFFBQVEsR0FBR3RNLE1BQU0sQ0FBQ3VNLEVBQUUsSUFBSSxVQUFVLEtBQUssT0FBT3ZNLE1BQU0sQ0FBQ3VNLEVBQUUsQ0FBQ0QsUUFBUSxJQUFJVCxRQUFRLENBQUNXLFdBQVcsR0FDekZ4TSxNQUFNLENBQUN1TSxFQUFFLENBQUNELFFBQVEsQ0FBRVQsUUFBUSxDQUFDVyxXQUFZLENBQUMsR0FDMUMsSUFBSTtJQUNQLElBQUlDLGVBQWUsR0FBR3pNLE1BQU0sQ0FBQ3VNLEVBQUUsSUFBSSxVQUFVLEtBQUssT0FBT3ZNLE1BQU0sQ0FBQ3VNLEVBQUUsQ0FBQ0QsUUFBUSxJQUFJVCxRQUFRLENBQUNhLGtCQUFrQixHQUN2RzFNLE1BQU0sQ0FBQ3VNLEVBQUUsQ0FBQ0QsUUFBUSxDQUFFVCxRQUFRLENBQUNhLGtCQUFtQixDQUFDLEdBQ2pELElBQUk7SUFDUCxJQUFJQyxlQUFlLEdBQUdqQixlQUFlLEdBQUdBLGVBQWUsQ0FBQ2tCLGFBQWEsQ0FBRSxrQ0FBbUMsQ0FBQyxHQUFHLElBQUk7SUFDbEgsSUFBSUMsS0FBSyxHQUFHLElBQUk7SUFDaEIsSUFBSUMsTUFBTSxHQUFHLElBQUk7SUFDakIsSUFBSUMsWUFBWSxHQUFHLElBQUk7SUFDdkIsSUFBSUMsY0FBYyxHQUFHLElBQUk7SUFDekIsSUFBSUMsYUFBYSxHQUFHLElBQUk7SUFDeEIsSUFBSUMsY0FBYyxHQUFHLElBQUk7SUFDekIsSUFBSUMsYUFBYSxHQUFHLElBQUk7SUFDeEIsSUFBSUMsYUFBYSxHQUFHLElBQUk7SUFDeEIsSUFBSUMsb0JBQW9CLEdBQUcsSUFBSTtJQUMvQixJQUFJQyxXQUFXLEdBQUcsSUFBSTtJQUN0QixJQUFJQyxLQUFLLEdBQUcsSUFBSTtJQUNoQixJQUFJQyxxQkFBcUIsR0FBRyxDQUFDO0lBQzdCLElBQUlDLGlCQUFpQixHQUFHLENBQUM7SUFDekIsSUFBSUMsZ0JBQWdCLEdBQUcsQ0FBQztJQUN4QixJQUFJQyxpQkFBaUIsR0FBRyxJQUFJO0lBQzVCLElBQUlDLEtBQUssR0FBRyxLQUFLO0lBRWpCLElBQUssQ0FBRS9CLFFBQVEsQ0FBQ2dDLE1BQU0sSUFBSSxDQUFFbkMsZUFBZSxJQUFJLENBQUVpQixlQUFlLElBQUksQ0FBRUwsUUFBUSxJQUFJLENBQUVHLGVBQWUsSUFBSSxDQUFFek0sTUFBTSxDQUFDOE4sTUFBTSxFQUFHO01BQ3hILE9BQU8sSUFBSTtJQUNaOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNDLFVBQVVBLENBQUVDLE9BQU8sRUFBRUMsYUFBYSxFQUFFQyxXQUFXLEVBQUc7TUFDMUQsSUFBSUMsTUFBTSxHQUFHdEIsS0FBSyxHQUFHQSxLQUFLLENBQUNELGFBQWEsQ0FBRSx3Q0FBeUMsQ0FBQyxHQUFHLElBQUk7TUFDM0YsSUFBSXdCLFVBQVUsR0FBRzNJLE9BQU8sQ0FBRXdJLGFBQWEsSUFBSUQsT0FBUSxDQUFDO01BQ3BELElBQUlLLHNCQUFzQixHQUFHLE9BQU8sS0FBS0gsV0FBVyxHQUFHLE9BQU8sR0FBRyxTQUFTO01BRTFFLElBQUtDLE1BQU0sRUFBRztRQUNiQSxNQUFNLENBQUNHLFdBQVcsR0FBRzlNLE1BQU0sQ0FBRXdNLE9BQU8sSUFBSSxFQUFHLENBQUM7UUFDNUNHLE1BQU0sQ0FBQ0ksU0FBUyxDQUFDQyxNQUFNLENBQUUsWUFBWSxFQUFFSixVQUFXLENBQUM7UUFDbkRELE1BQU0sQ0FBQ0ksU0FBUyxDQUFDQyxNQUFNLENBQUUsWUFBWSxFQUFFSixVQUFVLElBQUksU0FBUyxLQUFLQyxzQkFBdUIsQ0FBQztRQUMzRkYsTUFBTSxDQUFDSSxTQUFTLENBQUNDLE1BQU0sQ0FBRSxVQUFVLEVBQUVKLFVBQVUsSUFBSSxPQUFPLEtBQUtDLHNCQUF1QixDQUFDO1FBQ3ZGRixNQUFNLENBQUNJLFNBQVMsQ0FBQ0UsTUFBTSxDQUFFLGVBQWdCLENBQUM7UUFDMUNOLE1BQU0sQ0FBQ08sWUFBWSxDQUFFLE1BQU0sRUFBRU4sVUFBVSxJQUFJLE9BQU8sS0FBS0Msc0JBQXNCLEdBQUcsT0FBTyxHQUFHLFFBQVMsQ0FBQztRQUNwR0YsTUFBTSxDQUFDTyxZQUFZLENBQUUsV0FBVyxFQUFFTixVQUFVLElBQUksT0FBTyxLQUFLQyxzQkFBc0IsR0FBRyxXQUFXLEdBQUcsUUFBUyxDQUFDO1FBRTdHLElBQUtELFVBQVUsRUFBRztVQUNqQjtVQUNBLEtBQUtELE1BQU0sQ0FBQ1EsV0FBVztVQUN2QlIsTUFBTSxDQUFDSSxTQUFTLENBQUNLLEdBQUcsQ0FBRSxlQUFnQixDQUFDO1FBQ3hDO01BQ0Q7SUFDRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0MsWUFBWUEsQ0FBRWIsT0FBTyxFQUFHO01BQ2hDLElBQUljLE9BQU8sR0FBR2pDLEtBQUssR0FBR0EsS0FBSyxDQUFDRCxhQUFhLENBQUUseUNBQTBDLENBQUMsR0FBRyxJQUFJO01BQzdGLElBQUltQyxhQUFhLEdBQUdELE9BQU8sR0FBR0EsT0FBTyxDQUFDbEMsYUFBYSxDQUFFLCtDQUFnRCxDQUFDLEdBQUcsSUFBSTtNQUM3RyxJQUFJb0MsU0FBUyxHQUFHbkMsS0FBSyxHQUFHQSxLQUFLLENBQUNELGFBQWEsQ0FBRSx1Q0FBd0MsQ0FBQyxHQUFHLElBQUk7TUFDN0YsSUFBSXFDLFdBQVcsR0FBR3BDLEtBQUssR0FBR0EsS0FBSyxDQUFDRCxhQUFhLENBQUUsK0NBQWdELENBQUMsR0FBRyxJQUFJO01BQ3ZHLElBQUlzQyxXQUFXLEdBQUdyQyxLQUFLLEdBQUdBLEtBQUssQ0FBQ0QsYUFBYSxDQUFFLCtDQUFnRCxDQUFDLEdBQUcsSUFBSTtNQUV2RyxJQUFLb0MsU0FBUyxFQUFHO1FBQ2hCQSxTQUFTLENBQUNHLE1BQU0sR0FBRyxJQUFJO01BQ3hCO01BQ0EsSUFBS0YsV0FBVyxFQUFHO1FBQ2xCQSxXQUFXLENBQUNFLE1BQU0sR0FBRyxJQUFJO01BQzFCO01BQ0EsSUFBS0QsV0FBVyxFQUFHO1FBQ2xCQSxXQUFXLENBQUNDLE1BQU0sR0FBRyxJQUFJO01BQzFCO01BQ0EsSUFBS0osYUFBYSxFQUFHO1FBQ3BCQSxhQUFhLENBQUNULFdBQVcsR0FBRzlNLE1BQU0sQ0FBRXdNLE9BQU8sSUFBSWpDLElBQUksQ0FBQ3FELGFBQWEsSUFBSSxFQUFHLENBQUM7TUFDMUU7TUFDQSxJQUFLTixPQUFPLEVBQUc7UUFDZEEsT0FBTyxDQUFDSyxNQUFNLEdBQUcsS0FBSztNQUN2QjtNQUNBcEIsVUFBVSxDQUFFQyxPQUFPLEVBQUUsS0FBTSxDQUFDO01BQzVCLElBQUtuQixLQUFLLEVBQUc7UUFDWkEsS0FBSyxDQUFDNkIsWUFBWSxDQUFFLFdBQVcsRUFBRSxNQUFPLENBQUM7TUFDMUM7SUFDRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU1csdUJBQXVCQSxDQUFBLEVBQUc7TUFDbEMsSUFBSyxJQUFJLEtBQUsxQixpQkFBaUIsRUFBRztRQUNqQzNOLE1BQU0sQ0FBQ3NQLFlBQVksQ0FBRTNCLGlCQUFrQixDQUFDO1FBQ3hDQSxpQkFBaUIsR0FBRyxJQUFJO01BQ3pCO0lBQ0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVM0QixrQkFBa0JBLENBQUEsRUFBRztNQUM3QixJQUFJQyxVQUFVLEdBQUcvSixPQUFPLENBQ3ZCNkgsV0FBVyxJQUNYQyxLQUFLLElBQ0xrQyxJQUFJLENBQUNDLFNBQVMsQ0FBRXhFLDBCQUEwQixDQUFFb0MsV0FBWSxDQUFFLENBQUMsS0FBS21DLElBQUksQ0FBQ0MsU0FBUyxDQUFFeEUsMEJBQTBCLENBQUVxQyxLQUFNLENBQUUsQ0FDckgsQ0FBQztNQUVELElBQUtLLEtBQUssS0FBSzRCLFVBQVUsRUFBRztRQUMzQjtNQUNEO01BQ0E1QixLQUFLLEdBQUc0QixVQUFVO01BQ2xCLElBQUssVUFBVSxLQUFLLE9BQU8xRCxrQkFBa0IsQ0FBQzZELGVBQWUsRUFBRztRQUMvRDdELGtCQUFrQixDQUFDNkQsZUFBZSxDQUFFL0IsS0FBTSxDQUFDO01BQzVDO0lBQ0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNnQyxjQUFjQSxDQUFBLEVBQUc7TUFDekJwQyxxQkFBcUIsSUFBSSxDQUFDO01BQzFCQyxpQkFBaUIsSUFBSSxDQUFDO01BQ3RCQyxnQkFBZ0IsSUFBSSxDQUFDO01BQ3JCMkIsdUJBQXVCLENBQUMsQ0FBQztNQUN6QixJQUFLdEMsWUFBWSxJQUFJLFVBQVUsS0FBSyxPQUFPQSxZQUFZLENBQUMvQyxLQUFLLEVBQUc7UUFDL0QrQyxZQUFZLENBQUMvQyxLQUFLLENBQUMsQ0FBQztNQUNyQjtNQUNBK0MsWUFBWSxHQUFHLElBQUk7TUFDbkIsSUFBS0MsY0FBYyxJQUFJLFVBQVUsS0FBSyxPQUFPQSxjQUFjLENBQUNoRCxLQUFLLEVBQUc7UUFDbkVnRCxjQUFjLENBQUNoRCxLQUFLLENBQUMsQ0FBQztNQUN2QjtNQUNBZ0QsY0FBYyxHQUFHLElBQUk7TUFDckIsSUFBS0MsYUFBYSxJQUFJLFVBQVUsS0FBSyxPQUFPQSxhQUFhLENBQUNqRCxLQUFLLEVBQUc7UUFDakVpRCxhQUFhLENBQUNqRCxLQUFLLENBQUMsQ0FBQztNQUN0QjtNQUNBaUQsYUFBYSxHQUFHLElBQUk7TUFDcEIsSUFBS0MsY0FBYyxFQUFHO1FBQ3JCQSxjQUFjLENBQUM3RSxRQUFRLENBQUMsQ0FBQztNQUMxQjtNQUNBNkUsY0FBYyxHQUFHLElBQUk7TUFDckIsSUFBS0wsS0FBSyxFQUFHO1FBQ1o3TSxNQUFNLENBQUM4TixNQUFNLENBQUVqQixLQUFNLENBQUMsQ0FBQy9ELEdBQUcsQ0FBRSxlQUFlLEdBQUczSSxlQUFnQixDQUFDO1FBQy9EME0sS0FBSyxDQUFDNEIsTUFBTSxDQUFDLENBQUM7TUFDZjtNQUNBNUIsS0FBSyxHQUFHLElBQUk7TUFDWk0sYUFBYSxHQUFHLElBQUk7TUFDcEJDLGFBQWEsR0FBRyxJQUFJO01BQ3BCQyxvQkFBb0IsR0FBRyxJQUFJO01BQzNCQyxXQUFXLEdBQUcsSUFBSTtNQUNsQkMsS0FBSyxHQUFHLElBQUk7TUFDWkssS0FBSyxHQUFHLEtBQUs7TUFDYixJQUFLLFVBQVUsS0FBSyxPQUFPOUIsa0JBQWtCLENBQUM2RCxlQUFlLEVBQUc7UUFDL0Q3RCxrQkFBa0IsQ0FBQzZELGVBQWUsQ0FBRSxLQUFNLENBQUM7TUFDNUM7SUFDRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0Usd0JBQXdCQSxDQUFBLEVBQUc7TUFDbkMsSUFBSUMsY0FBYztNQUVsQixJQUFLaEQsTUFBTSxJQUFJQSxNQUFNLENBQUNpRCxXQUFXLElBQUksVUFBVSxLQUFLLE9BQU9qRCxNQUFNLENBQUNrRCxLQUFLLEVBQUc7UUFDekUsT0FBT2xELE1BQU07TUFDZDtNQUNBZ0QsY0FBYyxHQUFHLFVBQVUsS0FBSyxPQUFPaEUsa0JBQWtCLENBQUNtRSxpQkFBaUIsR0FDeEVuRSxrQkFBa0IsQ0FBQ21FLGlCQUFpQixDQUFDLENBQUMsR0FDdEMsSUFBSTtNQUVQLE9BQU9ILGNBQWMsSUFBSUEsY0FBYyxDQUFDQyxXQUFXLElBQUksVUFBVSxLQUFLLE9BQU9ELGNBQWMsQ0FBQ0UsS0FBSyxHQUM5RkYsY0FBYyxHQUNkLElBQUk7SUFDUjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0ksS0FBS0EsQ0FBRUMsYUFBYSxFQUFFQyxLQUFLLEVBQUc7TUFDdEMsSUFBSUMsWUFBWTtNQUVoQixJQUFLLENBQUV4RCxLQUFLLEVBQUc7UUFDZCxPQUFPLElBQUk7TUFDWjtNQUNBLElBQUtlLEtBQUssSUFBSSxDQUFFd0MsS0FBSyxJQUFJLENBQUVwUSxNQUFNLENBQUNzUSxPQUFPLENBQUV2RSxJQUFJLENBQUN3RSxlQUFlLElBQUksRUFBRyxDQUFDLEVBQUc7UUFDekUsT0FBTyxLQUFLO01BQ2I7TUFDQUYsWUFBWSxHQUFHRixhQUFhLEdBQUdOLHdCQUF3QixDQUFDLENBQUMsR0FBRyxJQUFJO01BQ2hFRCxjQUFjLENBQUMsQ0FBQztNQUNoQjlDLE1BQU0sR0FBRyxJQUFJO01BQ2IsSUFBS3VELFlBQVksRUFBRztRQUNuQnJRLE1BQU0sQ0FBQ3dRLFVBQVUsQ0FBRSxZQUFZO1VBQzlCLElBQUtILFlBQVksQ0FBQ04sV0FBVyxFQUFHO1lBQy9CTSxZQUFZLENBQUNMLEtBQUssQ0FBQyxDQUFDO1VBQ3JCO1FBQ0QsQ0FBQyxFQUFFLENBQUUsQ0FBQztNQUNQO01BRUEsT0FBTyxJQUFJO0lBQ1o7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTUyxZQUFZQSxDQUFFQyxlQUFlLEVBQUc7TUFDeEMsSUFBSUMsV0FBVyxHQUFHMVEsUUFBUSxDQUFDMlEsYUFBYSxDQUFFLEtBQU0sQ0FBQztNQUNqRCxJQUFJQyxjQUFjO01BQ2xCLElBQUlDLG1CQUFtQixHQUFHckwsT0FBTyxDQUFFb0gsS0FBSyxJQUFJQSxLQUFLLENBQUMzRSxRQUFRLENBQUVqSSxRQUFRLENBQUM4USxhQUFjLENBQUUsQ0FBQztNQUV0RixJQUFLbEUsS0FBSyxFQUFHO1FBQ1pBLEtBQUssQ0FBQzRCLE1BQU0sQ0FBQyxDQUFDO1FBQ2Q1QixLQUFLLEdBQUcsSUFBSTtNQUNiO01BQ0E4RCxXQUFXLENBQUN2SSxTQUFTLEdBQUdrRSxRQUFRLENBQUV4SixNQUFNLENBQUNrTyxNQUFNLENBQUU7UUFDaERDLFlBQVksRUFBRSx3QkFBd0I7UUFDdENsRixJQUFJLEVBQUVBLElBQUk7UUFDVnZKLGNBQWMsRUFBRTtNQUNqQixDQUFDLEVBQUVrTyxlQUFlLElBQUksQ0FBQyxDQUFFLENBQUUsQ0FBQztNQUM1QkcsY0FBYyxHQUFHRixXQUFXLENBQUMvRCxhQUFhLENBQUUsdUNBQXdDLENBQUM7TUFDckYsSUFBSyxDQUFFaUUsY0FBYyxFQUFHO1FBQ3ZCLE9BQU8sSUFBSTtNQUNaO01BQ0FsRSxlQUFlLENBQUN1RSxXQUFXLENBQUVMLGNBQWUsQ0FBQztNQUM3Q2hFLEtBQUssR0FBR2dFLGNBQWM7TUFDdEJoRSxLQUFLLENBQUNzQyxNQUFNLEdBQUcsS0FBSztNQUNwQixJQUFLMkIsbUJBQW1CLEVBQUc7UUFDMUI5USxNQUFNLENBQUNtUixxQkFBcUIsQ0FBRSxZQUFZO1VBQ3pDLElBQUt0RSxLQUFLLEVBQUc7WUFDWkEsS0FBSyxDQUFDbUQsS0FBSyxDQUFDLENBQUM7VUFDZDtRQUNELENBQUUsQ0FBQztNQUNKO01BRUEsT0FBT25ELEtBQUs7SUFDYjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU3VFLFVBQVVBLENBQUVwRCxPQUFPLEVBQUVxRCxXQUFXLEVBQUc7TUFDM0MsSUFBSXZDLE9BQU8sR0FBR2pDLEtBQUssR0FBR0EsS0FBSyxDQUFDRCxhQUFhLENBQUUseUNBQTBDLENBQUMsR0FBRyxJQUFJO01BQzdGLElBQUlvQyxTQUFTLEdBQUduQyxLQUFLLEdBQUdBLEtBQUssQ0FBQ0QsYUFBYSxDQUFFLHVDQUF3QyxDQUFDLEdBQUcsSUFBSTtNQUM3RixJQUFJMEUsYUFBYSxHQUFHdEMsU0FBUyxHQUFHQSxTQUFTLENBQUNwQyxhQUFhLENBQUUsK0NBQWdELENBQUMsR0FBRyxJQUFJO01BQ2pILElBQUkyRSxZQUFZLEdBQUd2QyxTQUFTLEdBQUdBLFNBQVMsQ0FBQ3BDLGFBQWEsQ0FBRSx1Q0FBd0MsQ0FBQyxHQUFHLElBQUk7TUFDeEcsSUFBSXFDLFdBQVcsR0FBR3BDLEtBQUssR0FBR0EsS0FBSyxDQUFDRCxhQUFhLENBQUUsK0NBQWdELENBQUMsR0FBRyxJQUFJO01BQ3ZHLElBQUloRixhQUFhLEdBQUdpRixLQUFLLEdBQUdBLEtBQUssQ0FBQ0QsYUFBYSxDQUFFLCtDQUFnRCxDQUFDLEdBQUcsSUFBSTtNQUV6R3lDLHVCQUF1QixDQUFDLENBQUM7TUFDekIsSUFBS1AsT0FBTyxFQUFHO1FBQ2RBLE9BQU8sQ0FBQ0ssTUFBTSxHQUFHLElBQUk7TUFDdEI7TUFDQSxJQUFLRixXQUFXLEVBQUc7UUFDbEJBLFdBQVcsQ0FBQ0UsTUFBTSxHQUFHLElBQUk7TUFDMUI7TUFDQSxJQUFLSCxTQUFTLEVBQUc7UUFDaEJBLFNBQVMsQ0FBQ0csTUFBTSxHQUFHLEtBQUs7TUFDekI7TUFDQSxJQUFLbUMsYUFBYSxFQUFHO1FBQ3BCQSxhQUFhLENBQUNoRCxXQUFXLEdBQUc5TSxNQUFNLENBQUV3TSxPQUFPLElBQUlqQyxJQUFJLENBQUN5RixVQUFVLElBQUksRUFBRyxDQUFDO01BQ3ZFO01BQ0EsSUFBS0QsWUFBWSxFQUFHO1FBQ25CQSxZQUFZLENBQUNwQyxNQUFNLEdBQUcsQ0FBRWtDLFdBQVc7TUFDcEM7TUFDQSxJQUFLekosYUFBYSxFQUFHO1FBQ3BCQSxhQUFhLENBQUM4RyxZQUFZLENBQUUsV0FBVyxFQUFFLE9BQVEsQ0FBQztNQUNuRDtNQUNBWCxVQUFVLENBQUVDLE9BQU8sRUFBRSxLQUFNLENBQUM7TUFDNUJuQixLQUFLLENBQUM2QixZQUFZLENBQUUsV0FBVyxFQUFFLE9BQVEsQ0FBQztJQUMzQzs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBUytDLFVBQVVBLENBQUV6RCxPQUFPLEVBQUUwRCxlQUFlLEVBQUc7TUFDL0MsSUFBSTVDLE9BQU8sR0FBR2pDLEtBQUssR0FBR0EsS0FBSyxDQUFDRCxhQUFhLENBQUUseUNBQTBDLENBQUMsR0FBRyxJQUFJO01BQzdGLElBQUlvQyxTQUFTLEdBQUduQyxLQUFLLEdBQUdBLEtBQUssQ0FBQ0QsYUFBYSxDQUFFLHVDQUF3QyxDQUFDLEdBQUcsSUFBSTtNQUM3RixJQUFJcUMsV0FBVyxHQUFHcEMsS0FBSyxHQUFHQSxLQUFLLENBQUNELGFBQWEsQ0FBRSwrQ0FBZ0QsQ0FBQyxHQUFHLElBQUk7TUFDdkcsSUFBSWhGLGFBQWEsR0FBR2lGLEtBQUssR0FBR0EsS0FBSyxDQUFDRCxhQUFhLENBQUUsK0NBQWdELENBQUMsR0FBRyxJQUFJO01BRXpHLElBQUtrQyxPQUFPLEVBQUc7UUFDZEEsT0FBTyxDQUFDSyxNQUFNLEdBQUcsSUFBSTtNQUN0QjtNQUNBLElBQUtILFNBQVMsRUFBRztRQUNoQkEsU0FBUyxDQUFDRyxNQUFNLEdBQUcsSUFBSTtNQUN4QjtNQUNBLElBQUtGLFdBQVcsRUFBRztRQUNsQkEsV0FBVyxDQUFDRSxNQUFNLEdBQUcsS0FBSztNQUMzQjtNQUNBLElBQUt2SCxhQUFhLEVBQUc7UUFDcEJBLGFBQWEsQ0FBQzhHLFlBQVksQ0FBRSxXQUFXLEVBQUUsT0FBUSxDQUFDO01BQ25EO01BQ0FYLFVBQVUsQ0FBRUMsT0FBTyxFQUFFMEQsZUFBZSxFQUFFLFNBQVUsQ0FBQztNQUNqRDdFLEtBQUssQ0FBQzZCLFlBQVksQ0FBRSxXQUFXLEVBQUUsT0FBUSxDQUFDO0lBQzNDOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTaUQsbUJBQW1CQSxDQUFBLEVBQUc7TUFDOUIsSUFBSyxDQUFFcEUsS0FBSyxJQUFJLENBQUVLLEtBQUssSUFBSSxDQUFFTCxLQUFLLENBQUMvSyxjQUFjLENBQUNGLE1BQU0sRUFBRztRQUMxRCxPQUFPLEtBQUs7TUFDYjtNQUVBLE9BQU8vQix5QkFBeUIsS0FBS2dOLEtBQUssQ0FBQzNDLGdCQUFnQixJQUFJbkYsT0FBTyxDQUNyRXhDLDJCQUEyQixDQUFFc0ssS0FBSyxDQUFDMUMsVUFBVyxDQUFDLElBQUk1SCwyQkFBMkIsQ0FBRXNLLEtBQUssQ0FBQ3pDLFFBQVMsQ0FDaEcsQ0FBQztJQUNGOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTOEcsa0JBQWtCQSxDQUFBLEVBQUc7TUFDN0IsSUFBSUMsV0FBVyxHQUFHaEYsS0FBSyxHQUFHQSxLQUFLLENBQUNELGFBQWEsQ0FBRSw2Q0FBOEMsQ0FBQyxHQUFHLElBQUk7TUFDckcsSUFBSWtGLFNBQVMsR0FBR2pGLEtBQUssR0FBR0EsS0FBSyxDQUFDRCxhQUFhLENBQUUsMkNBQTRDLENBQUMsR0FBRyxJQUFJO01BQ2pHLElBQUltRixhQUFhLEdBQUdsRixLQUFLLEdBQUdBLEtBQUssQ0FBQ21GLGdCQUFnQixDQUFFLHNDQUF1QyxDQUFDLEdBQUcsRUFBRTtNQUNqRyxJQUFJQyxhQUFhLEdBQUdwRixLQUFLLEdBQUdBLEtBQUssQ0FBQ0QsYUFBYSxDQUFFLGdEQUFpRCxDQUFDLEdBQUcsSUFBSTtNQUMxRyxJQUFJc0YsZUFBZSxHQUFHckYsS0FBSyxHQUFHQSxLQUFLLENBQUNELGFBQWEsQ0FBRSwwREFBMkQsQ0FBQyxHQUFHLElBQUk7TUFDdEgsSUFBSXVGLGVBQWUsR0FBR3RGLEtBQUssR0FBR0EsS0FBSyxDQUFDRCxhQUFhLENBQUUseURBQTBELENBQUMsR0FBRyxJQUFJO01BQ3JILElBQUl3RixhQUFhLEdBQUd2RixLQUFLLEdBQUdBLEtBQUssQ0FBQ0QsYUFBYSxDQUFFLGtEQUFtRCxDQUFDLEdBQUcsSUFBSTtNQUM1RyxJQUFJeUYsV0FBVyxHQUFHeEYsS0FBSyxHQUFHQSxLQUFLLENBQUNELGFBQWEsQ0FBRSxnREFBaUQsQ0FBQyxHQUFHLElBQUk7TUFDeEcsSUFBSTBGLGFBQWEsR0FBR3pGLEtBQUssR0FBR0EsS0FBSyxDQUFDRCxhQUFhLENBQUUsd0NBQXlDLENBQUMsR0FBRyxJQUFJO01BQ2xHLElBQUkyRixXQUFXO01BQ2YsSUFBSUMsYUFBYTtNQUVqQixJQUFLLENBQUVqRixLQUFLLEVBQUc7UUFDZDtNQUNEO01BQ0FnRixXQUFXLEdBQUdoUyx5QkFBeUIsS0FBS2dOLEtBQUssQ0FBQzNDLGdCQUFnQjtNQUNsRTRILGFBQWEsR0FBR3BILHdCQUF3QixDQUN2Q1csSUFBSSxDQUFDeUcsYUFBYSxJQUFJLGFBQWEsRUFDbkMsQ0FBRWpGLEtBQUssQ0FBQzFDLFVBQVUsRUFBRTBDLEtBQUssQ0FBQ3pDLFFBQVEsQ0FDbkMsQ0FBQztNQUNELElBQUsrRyxXQUFXLEVBQUc7UUFDbEJBLFdBQVcsQ0FBQzFDLE1BQU0sR0FBR29ELFdBQVc7TUFDakM7TUFDQSxJQUFLVCxTQUFTLEVBQUc7UUFDaEJBLFNBQVMsQ0FBQzNDLE1BQU0sR0FBRzFPLHlCQUF5QixLQUFLOE0sS0FBSyxDQUFDM0MsZ0JBQWdCO01BQ3hFO01BQ0FsSSxLQUFLLENBQUNjLFNBQVMsQ0FBQ1osT0FBTyxDQUFDYyxJQUFJLENBQUVxTyxhQUFhLEVBQUUsVUFBV1UsWUFBWSxFQUFHO1FBQ3RFQSxZQUFZLENBQUNDLFFBQVEsR0FBR0gsV0FBVztNQUNwQyxDQUFFLENBQUM7TUFDSCxJQUFLTCxlQUFlLEVBQUc7UUFDdEJBLGVBQWUsQ0FBQzVELFdBQVcsR0FBRzlNLE1BQU0sQ0FBRStMLEtBQUssQ0FBQy9LLGNBQWMsQ0FBQ0YsTUFBTyxDQUFDO01BQ3BFO01BQ0EsSUFBSzZQLGVBQWUsRUFBRztRQUN0QkEsZUFBZSxDQUFDN0QsV0FBVyxHQUFHOU0sTUFBTSxDQUFFK0wsS0FBSyxDQUFDL0ssY0FBYyxDQUFDRixNQUFPLENBQUM7TUFDcEU7TUFDQSxJQUFLOFAsYUFBYSxFQUFHO1FBQ3BCQSxhQUFhLENBQUM5RCxXQUFXLEdBQUc5TSxNQUFNLENBQUVoQix5QkFBeUIsS0FBSytNLEtBQUssQ0FBQzNDLGdCQUFnQixHQUFHK0gsSUFBSSxDQUFDQyxHQUFHLENBQUUsQ0FBQyxFQUFFckYsS0FBSyxDQUFDL0ssY0FBYyxDQUFDRixNQUFNLEdBQUcsQ0FBRSxDQUFDLEdBQUcsQ0FBRSxDQUFDO01BQ2hKO01BQ0EsSUFBSytQLFdBQVcsRUFBRztRQUNsQkEsV0FBVyxDQUFDL0QsV0FBVyxHQUFHaUUsV0FBVyxHQUFHL1EsTUFBTSxDQUFFdUssSUFBSSxDQUFDOEcsUUFBUSxJQUFJOUcsSUFBSSxDQUFDK0csU0FBUyxJQUFJLEVBQUcsQ0FBQyxHQUFHTixhQUFhO01BQ3hHO01BQ0EsSUFBS1AsYUFBYSxFQUFHO1FBQ3BCQSxhQUFhLENBQUMzRCxXQUFXLEdBQUcsRUFBRTtRQUM5QixJQUFLLENBQUVmLEtBQUssQ0FBQy9LLGNBQWMsQ0FBQ0YsTUFBTSxFQUFHO1VBQ3BDLElBQUl5USxXQUFXLEdBQUc5UyxRQUFRLENBQUMyUSxhQUFhLENBQUUsSUFBSyxDQUFDO1VBQ2hEbUMsV0FBVyxDQUFDQyxTQUFTLEdBQUcsK0JBQStCO1VBQ3ZERCxXQUFXLENBQUN6RSxXQUFXLEdBQUc5TSxNQUFNLENBQUV1SyxJQUFJLENBQUNrSCxpQkFBaUIsSUFBSSxFQUFHLENBQUM7VUFDaEVoQixhQUFhLENBQUNmLFdBQVcsQ0FBRTZCLFdBQVksQ0FBQztRQUN6QyxDQUFDLE1BQU07VUFDTnhGLEtBQUssQ0FBQy9LLGNBQWMsQ0FBQ0ksT0FBTyxDQUFFLFVBQVdaLGFBQWEsRUFBRWtSLFVBQVUsRUFBRztZQUNwRSxJQUFJQyxVQUFVLEdBQUdsVCxRQUFRLENBQUMyUSxhQUFhLENBQUUsSUFBSyxDQUFDO1lBQy9DLElBQUl3QyxVQUFVLEdBQUduVCxRQUFRLENBQUMyUSxhQUFhLENBQUUsTUFBTyxDQUFDO1lBQ2pELElBQUl5QyxTQUFTLEdBQUdwVCxRQUFRLENBQUMyUSxhQUFhLENBQUUsTUFBTyxDQUFDO1lBQ2hELElBQUkwQyxhQUFhLEdBQUcsQ0FBQyxLQUFLSixVQUFVO1lBQ3BDLElBQUlLLFlBQVksR0FBR2hHLEtBQUssQ0FBQy9LLGNBQWMsQ0FBQ0YsTUFBTSxHQUFHLENBQUMsS0FBSzRRLFVBQVU7WUFFakVFLFVBQVUsQ0FBQzFFLFlBQVksQ0FBRSxtREFBbUQsRUFBRSxFQUFHLENBQUM7WUFDbEYwRSxVQUFVLENBQUM5RSxXQUFXLEdBQUd0TSxhQUFhO1lBQ3RDcVIsU0FBUyxDQUFDTCxTQUFTLEdBQUcsd0RBQXdEO1lBQzlFSyxTQUFTLENBQUMzRSxZQUFZLENBQUUsa0RBQWtELEVBQUUsRUFBRyxDQUFDO1lBQ2hGLElBQUs2RCxXQUFXLEVBQUc7Y0FDbEJjLFNBQVMsQ0FBQy9FLFdBQVcsR0FBRzlNLE1BQU0sQ0FBRXVLLElBQUksQ0FBQzhHLFFBQVEsSUFBSTlHLElBQUksQ0FBQytHLFNBQVMsSUFBSSxFQUFHLENBQUM7WUFDeEUsQ0FBQyxNQUFNLElBQUtyUyx5QkFBeUIsS0FBSzhNLEtBQUssQ0FBQzNDLGdCQUFnQixJQUFNMEksYUFBYSxJQUFJQyxZQUFjLEVBQUc7Y0FDdkdGLFNBQVMsQ0FBQy9FLFdBQVcsR0FBR2tFLGFBQWE7WUFDdEMsQ0FBQyxNQUFNLElBQUtjLGFBQWEsRUFBRztjQUMzQkQsU0FBUyxDQUFDL0UsV0FBVyxHQUFHbEQsd0JBQXdCLENBQUVXLElBQUksQ0FBQ3lILGNBQWMsSUFBSSxjQUFjLEVBQUUsQ0FBRWpHLEtBQUssQ0FBQzFDLFVBQVUsQ0FBRyxDQUFDO1lBQ2hILENBQUMsTUFBTSxJQUFLMEksWUFBWSxFQUFHO2NBQzFCRixTQUFTLENBQUMvRSxXQUFXLEdBQUdsRCx3QkFBd0IsQ0FBRVcsSUFBSSxDQUFDMEgsWUFBWSxJQUFJLFlBQVksRUFBRSxDQUFFbEcsS0FBSyxDQUFDekMsUUFBUSxDQUFHLENBQUM7WUFDMUcsQ0FBQyxNQUFNO2NBQ051SSxTQUFTLENBQUMvRSxXQUFXLEdBQUc5TSxNQUFNLENBQUV1SyxJQUFJLENBQUM4RyxRQUFRLElBQUk5RyxJQUFJLENBQUMrRyxTQUFTLElBQUksRUFBRyxDQUFDO1lBQ3hFO1lBQ0FLLFVBQVUsQ0FBQ2pDLFdBQVcsQ0FBRWtDLFVBQVcsQ0FBQztZQUNwQ0QsVUFBVSxDQUFDakMsV0FBVyxDQUFFbUMsU0FBVSxDQUFDO1lBQ25DcEIsYUFBYSxDQUFDZixXQUFXLENBQUVpQyxVQUFXLENBQUM7VUFDeEMsQ0FBRSxDQUFDO1FBQ0o7TUFDRDtNQUNBNUQsa0JBQWtCLENBQUMsQ0FBQztNQUNwQixJQUFLK0MsYUFBYSxFQUFHO1FBQ3BCQSxhQUFhLENBQUNJLFFBQVEsR0FBRyxDQUFFZixtQkFBbUIsQ0FBQyxDQUFDO1FBQ2hEVyxhQUFhLENBQUM1RCxZQUFZLENBQUUsZUFBZSxFQUFFaUQsbUJBQW1CLENBQUMsQ0FBQyxHQUFHLE9BQU8sR0FBRyxNQUFPLENBQUM7TUFDeEY7SUFDRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTK0IsbUJBQW1CQSxDQUFFQyxVQUFVLEVBQUVDLE9BQU8sRUFBRztNQUNuRCxJQUFJQyxrQkFBa0I7TUFFdEIsSUFBS0YsVUFBVSxLQUFLbkcscUJBQXFCLElBQUksQ0FBRU4sY0FBYyxJQUFJLENBQUVLLEtBQUssRUFBRztRQUMxRTtNQUNEO01BQ0FzRyxrQkFBa0IsR0FBRzNHLGNBQWMsQ0FBQ2xHLHdCQUF3QixDQUFFdUcsS0FBSyxDQUFDL0ssY0FBZSxDQUFDO01BQ3BGLElBQUtxUixrQkFBa0IsRUFBRztRQUN6QnRHLEtBQUssQ0FBQy9LLGNBQWMsR0FBRzBLLGNBQWMsQ0FBQ3ZHLGtCQUFrQixDQUFDLENBQUM7UUFDMURpTCxrQkFBa0IsQ0FBQyxDQUFDO1FBQ3BCSCxVQUFVLENBQUUxRixJQUFJLENBQUMrSCxlQUFlLElBQUksRUFBRSxFQUFFLEtBQU0sQ0FBQztRQUMvQztNQUNEO01BQ0EsSUFBS0YsT0FBTyxHQUFHLENBQUMsRUFBRztRQUNsQjVULE1BQU0sQ0FBQ21SLHFCQUFxQixDQUFFLFlBQVk7VUFDekN1QyxtQkFBbUIsQ0FBRUMsVUFBVSxFQUFFQyxPQUFPLEdBQUcsQ0FBRSxDQUFDO1FBQy9DLENBQUUsQ0FBQztRQUNIO01BQ0Q7TUFFQTFHLGNBQWMsQ0FBQ2pELGtCQUFrQixDQUFFNUosZUFBZ0IsQ0FBQztNQUNwRHdULGtCQUFrQixHQUFHM0csY0FBYyxDQUFDbEcsd0JBQXdCLENBQUV1RyxLQUFLLENBQUMvSyxjQUFlLENBQUM7TUFDcEYrSyxLQUFLLENBQUM1QyxnQkFBZ0IsR0FBR3RLLGVBQWU7TUFDeENxQyxLQUFLLENBQUNjLFNBQVMsQ0FBQ1osT0FBTyxDQUFDYyxJQUFJLENBQUVtSixLQUFLLENBQUNtRixnQkFBZ0IsQ0FBRSxrREFBbUQsQ0FBQyxFQUFFLFVBQVcrQixPQUFPLEVBQUc7UUFDaElBLE9BQU8sQ0FBQ0MsT0FBTyxHQUFHM1QsZUFBZSxLQUFLMFQsT0FBTyxDQUFDdk0sS0FBSztNQUNwRCxDQUFFLENBQUM7TUFDSCtGLEtBQUssQ0FBQy9LLGNBQWMsR0FBR3FSLGtCQUFrQixHQUFHM0csY0FBYyxDQUFDdkcsa0JBQWtCLENBQUMsQ0FBQyxHQUFHNEcsS0FBSyxDQUFDL0ssY0FBYyxDQUFDeVIsS0FBSyxDQUFFLENBQUUsQ0FBQztNQUNqSHJDLGtCQUFrQixDQUFDLENBQUM7TUFDcEJILFVBQVUsQ0FBRTFGLElBQUksQ0FBQ21JLGlCQUFpQixJQUFJLEVBQUUsRUFBRSxJQUFLLENBQUM7SUFDakQ7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTQyxxQkFBcUJBLENBQUVSLFVBQVUsRUFBRztNQUM1QyxJQUFJUyxRQUFRLEdBQUdqSCxhQUFhLElBQUlBLGFBQWEsQ0FBQ2lILFFBQVEsR0FBR2pILGFBQWEsQ0FBQ2lILFFBQVEsR0FBRyxDQUFDLENBQUM7TUFDcEYsSUFBSXhNLGFBQWEsR0FBR2lGLEtBQUssR0FBR0EsS0FBSyxDQUFDRCxhQUFhLENBQUUsK0NBQWdELENBQUMsR0FBRyxJQUFJO01BRXpHTSxjQUFjLEdBQUdqSSw4QkFBOEIsQ0FBQyxDQUFDO01BQ2pELElBQUsyQyxhQUFhLEVBQUc7UUFDcEJBLGFBQWEsQ0FBQzhHLFlBQVksQ0FBRSxXQUFXLEVBQUUsTUFBTyxDQUFDO01BQ2xEO01BQ0EsSUFBSyxDQUFFeEIsY0FBYyxDQUFDdkYsS0FBSyxDQUFFQyxhQUFhLEVBQUU7UUFDM0MzRyxXQUFXLEVBQUVrTSxhQUFhLENBQUNsTSxXQUFXO1FBQ3RDZ0gsYUFBYSxFQUFFbU0sUUFBUSxDQUFDQyxJQUFJLElBQUksRUFBRTtRQUNsQ2hSLG1CQUFtQixFQUFFK1EsUUFBUSxDQUFDL1EsbUJBQW1CLElBQUksQ0FBQyxDQUFDO1FBQ3ZEK0IsaUJBQWlCLEVBQUVnUCxRQUFRLENBQUNoUCxpQkFBaUIsSUFBSSxDQUFDLENBQUM7UUFDbkRzQixrQkFBa0IsRUFBRTBOLFFBQVEsQ0FBQzFOLGtCQUFrQixJQUFJLENBQUMsQ0FBQztRQUNyREgsaUJBQWlCLEVBQUU2TixRQUFRLENBQUM3TixpQkFBaUIsSUFBSSxDQUFDO01BQ25ELENBQUUsQ0FBQyxFQUFHO1FBQ0w2SyxVQUFVLENBQUVyRixJQUFJLENBQUN1SSxjQUFjLElBQUksRUFBRSxFQUFFLElBQUssQ0FBQztRQUM3QztNQUNEO01BRUF0VSxNQUFNLENBQUM4TixNQUFNLENBQUVqQixLQUFNLENBQUMsQ0FBQy9ELEdBQUcsQ0FBRSxlQUFlLEdBQUczSSxlQUFnQixDQUFDLENBQUM0SSxFQUFFLENBQUUsZUFBZSxHQUFHNUksZUFBZSxFQUFFLFVBQVc2SSxLQUFLLEVBQUV1TCxvQkFBb0IsRUFBRUMsYUFBYSxFQUFFaFMsY0FBYyxFQUFHO1FBQzlLLElBQUttUixVQUFVLEtBQUtuRyxxQkFBcUIsSUFBSXhNLHFCQUFxQixDQUFFdVQsb0JBQXFCLENBQUMsS0FBS3ZULHFCQUFxQixDQUFFbU0sYUFBYSxDQUFDbE0sV0FBWSxDQUFDLElBQUksQ0FBRXNNLEtBQUssRUFBRztVQUM5SjtRQUNEO1FBQ0FBLEtBQUssQ0FBQy9LLGNBQWMsR0FBR0QsbUJBQW1CLENBQUVDLGNBQWUsQ0FBQztRQUM1RG9QLGtCQUFrQixDQUFDLENBQUM7TUFDckIsQ0FBRSxDQUFDO01BQ0g3RCxVQUFVLENBQUVoQyxJQUFJLENBQUMwSSxnQkFBZ0IsSUFBSSxFQUFFLEVBQUUsS0FBTSxDQUFDO01BQ2hEcEYsdUJBQXVCLENBQUMsQ0FBQztNQUN6QjFCLGlCQUFpQixHQUFHM04sTUFBTSxDQUFDd1EsVUFBVSxDQUFFLFlBQVk7UUFDbEQsSUFBS21ELFVBQVUsS0FBS25HLHFCQUFxQixJQUFJWCxLQUFLLEVBQUc7VUFDcERLLGNBQWMsQ0FBQ3JFLFVBQVUsQ0FBQyxDQUFDO1VBQzNCdUksVUFBVSxDQUFFckYsSUFBSSxDQUFDdUksY0FBYyxJQUFJLEVBQUUsRUFBRSxJQUFLLENBQUM7UUFDOUM7TUFDRCxDQUFDLEVBQUU1VCxzQkFBdUIsQ0FBQztNQUMzQixJQUFLLENBQUV3TSxjQUFjLENBQUM1RSxJQUFJLENBQUU4TCxRQUFRLENBQUM3TCxrQkFBa0IsSUFBSSxDQUFDLENBQUMsRUFBRSxZQUFZO1FBQzFFOEcsdUJBQXVCLENBQUMsQ0FBQztRQUN6QixJQUFLc0UsVUFBVSxLQUFLbkcscUJBQXFCLElBQUksQ0FBRUQsS0FBSyxFQUFHO1VBQ3REO1FBQ0Q7UUFDQTtRQUNBO1FBQ0FMLGNBQWMsQ0FBQ2pELGtCQUFrQixDQUFFc0QsS0FBSyxDQUFDNUMsZ0JBQWlCLENBQUM7UUFDM0QrSSxtQkFBbUIsQ0FBRUMsVUFBVSxFQUFFLENBQUUsQ0FBQztNQUNyQyxDQUFDLEVBQUUsWUFBWTtRQUNkdEUsdUJBQXVCLENBQUMsQ0FBQztRQUN6QixJQUFLc0UsVUFBVSxLQUFLbkcscUJBQXFCLEVBQUc7VUFDM0M0RCxVQUFVLENBQUVyRixJQUFJLENBQUN1SSxjQUFjLElBQUksRUFBRSxFQUFFLElBQUssQ0FBQztRQUM5QztNQUNELENBQUUsQ0FBQyxFQUFHO1FBQ0xsRCxVQUFVLENBQUVyRixJQUFJLENBQUN1SSxjQUFjLElBQUksRUFBRSxFQUFFLElBQUssQ0FBQztNQUM5QztJQUNEOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTSSxpQkFBaUJBLENBQUVDLFVBQVUsRUFBRWhCLFVBQVUsRUFBRztNQUNwRCxJQUFJaUIsT0FBTyxHQUFHRCxVQUFVLElBQUlBLFVBQVUsQ0FBQ0MsT0FBTyxHQUFHRCxVQUFVLENBQUNDLE9BQU8sR0FBRyxDQUFDLENBQUM7TUFFeEV6SCxhQUFhLEdBQUd3SCxVQUFVO01BQzFCLElBQUssQ0FBRUEsVUFBVSxDQUFDRSxTQUFTLEVBQUc7UUFDN0JwRSxZQUFZLENBQUU7VUFDYm9FLFNBQVMsRUFBRSxLQUFLO1VBQ2hCQyxRQUFRLEVBQUVILFVBQVUsQ0FBQ0csUUFBUSxJQUFJLENBQUMsQ0FBQztVQUNuQy9JLElBQUksRUFBRUE7UUFDUCxDQUFFLENBQUM7UUFDSHFGLFVBQVUsQ0FBRXJGLElBQUksQ0FBQ2dKLGlCQUFpQixJQUFJLEVBQUUsRUFBRSxLQUFNLENBQUM7UUFDakQ7TUFDRDtNQUVBekgsV0FBVyxHQUFHdkMsbUJBQW1CLENBQUU2SixPQUFRLENBQUM7TUFDNUNySCxLQUFLLEdBQUc5QyxrQkFBa0IsQ0FBRW1LLE9BQVEsQ0FBQztNQUNyQ25FLFlBQVksQ0FBRTNOLE1BQU0sQ0FBQ2tPLE1BQU0sQ0FBRSxDQUFDLENBQUMsRUFBRXpELEtBQUssRUFBRTtRQUN2Q3RNLFdBQVcsRUFBRTBULFVBQVUsQ0FBQzFULFdBQVc7UUFDbkM0VCxTQUFTLEVBQUUsSUFBSTtRQUNmOUksSUFBSSxFQUFFQTtNQUNQLENBQUUsQ0FBRSxDQUFDO01BQ0wsSUFBSyxDQUFFYyxLQUFLLEVBQUc7UUFDZDtNQUNEO01BQ0FnQyxZQUFZLENBQUU5QyxJQUFJLENBQUNxRCxhQUFhLElBQUksRUFBRyxDQUFDO01BQ3hDd0Msa0JBQWtCLENBQUMsQ0FBQztNQUNwQnVDLHFCQUFxQixDQUFFUixVQUFXLENBQUM7SUFDcEM7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNxQixjQUFjQSxDQUFBLEVBQUc7TUFDekIsSUFBSXJCLFVBQVU7TUFDZCxJQUFJc0IsZUFBZTtNQUNuQixJQUFJN1QsVUFBVSxHQUFHK0wsYUFBYSxHQUFHaE0sb0JBQW9CLENBQUVnTSxhQUFhLENBQUMvTCxVQUFXLENBQUMsR0FBRyxDQUFDO01BRXJGLElBQUssQ0FBRUEsVUFBVSxJQUFJLENBQUUwSyxrQkFBa0IsQ0FBQ29KLEdBQUcsSUFBSSxDQUFFcEosa0JBQWtCLENBQUNxSixNQUFNLElBQUksQ0FBRW5KLGFBQWEsQ0FBQ29KLE1BQU0sSUFBSSxDQUFFcEosYUFBYSxDQUFDcUosS0FBSyxFQUFHO1FBQ2pJakUsVUFBVSxDQUFFckYsSUFBSSxDQUFDeUYsVUFBVSxJQUFJLEVBQUUsRUFBRSxJQUFLLENBQUM7UUFDekM7TUFDRDtNQUNBaEUscUJBQXFCLElBQUksQ0FBQztNQUMxQm1HLFVBQVUsR0FBR25HLHFCQUFxQjtNQUNsQyxJQUFLVCxZQUFZLElBQUksVUFBVSxLQUFLLE9BQU9BLFlBQVksQ0FBQy9DLEtBQUssRUFBRztRQUMvRCtDLFlBQVksQ0FBQy9DLEtBQUssQ0FBQyxDQUFDO01BQ3JCO01BQ0EsSUFBS2dELGNBQWMsSUFBSSxVQUFVLEtBQUssT0FBT0EsY0FBYyxDQUFDaEQsS0FBSyxFQUFHO1FBQ25FZ0QsY0FBYyxDQUFDaEQsS0FBSyxDQUFDLENBQUM7TUFDdkI7TUFDQXlELGlCQUFpQixJQUFJLENBQUM7TUFDdEJULGNBQWMsR0FBRyxJQUFJO01BQ3JCSSxhQUFhLEdBQUcsSUFBSTtNQUNwQkMsb0JBQW9CLEdBQUcsSUFBSTtNQUMzQixJQUFLSCxjQUFjLEVBQUc7UUFDckJBLGNBQWMsQ0FBQzdFLFFBQVEsQ0FBQyxDQUFDO1FBQ3pCNkUsY0FBYyxHQUFHLElBQUk7TUFDdEI7TUFDQW1DLHVCQUF1QixDQUFDLENBQUM7TUFDekJSLFlBQVksQ0FBRTlDLElBQUksQ0FBQ3FELGFBQWEsSUFBSSxFQUFHLENBQUM7TUFDeEM2RixlQUFlLEdBQUdqVixNQUFNLENBQUM4TixNQUFNLENBQUN3SCxJQUFJLENBQUU7UUFDckNKLEdBQUcsRUFBRXBKLGtCQUFrQixDQUFDb0osR0FBRztRQUMzQkssTUFBTSxFQUFFLE1BQU07UUFDZEMsUUFBUSxFQUFFLE1BQU07UUFDaEJsTSxJQUFJLEVBQUU7VUFDTDhMLE1BQU0sRUFBRXBKLGFBQWEsQ0FBQ29KLE1BQU07VUFDNUJDLEtBQUssRUFBRXJKLGFBQWEsQ0FBQ3FKLEtBQUs7VUFDMUJqVSxVQUFVLEVBQUVBLFVBQVU7VUFDdEIrVCxNQUFNLEVBQUVySixrQkFBa0IsQ0FBQ3FKO1FBQzVCO01BQ0QsQ0FBRSxDQUFDLENBQUNNLElBQUksQ0FBRSxVQUFXQyxRQUFRLEVBQUc7UUFDL0IsSUFBSy9CLFVBQVUsS0FBS25HLHFCQUFxQixJQUFJLENBQUVrSSxRQUFRLElBQUksQ0FBRUEsUUFBUSxDQUFDQyxPQUFPLElBQUksQ0FBRUQsUUFBUSxDQUFDcE0sSUFBSSxJQUFJLENBQUVvTSxRQUFRLENBQUNwTSxJQUFJLENBQUNzTSxNQUFNLEVBQUc7VUFDNUg7UUFDRDtRQUNBbEIsaUJBQWlCLENBQUVnQixRQUFRLENBQUNwTSxJQUFJLENBQUNzTSxNQUFNLEVBQUVqQyxVQUFXLENBQUM7TUFDdEQsQ0FBRSxDQUFDLENBQUMvSixJQUFJLENBQUUsVUFBV0MsY0FBYyxFQUFFQyxjQUFjLEVBQUc7UUFDckQsSUFBSStMLEtBQUssR0FBR2hNLGNBQWMsQ0FBQ2lNLFlBQVksSUFBSWpNLGNBQWMsQ0FBQ2lNLFlBQVksQ0FBQ3hNLElBQUksR0FBR08sY0FBYyxDQUFDaU0sWUFBWSxDQUFDeE0sSUFBSSxHQUFHLENBQUMsQ0FBQztRQUVuSCxJQUFLLE9BQU8sS0FBS1EsY0FBYyxJQUFJNkosVUFBVSxLQUFLbkcscUJBQXFCLElBQUksQ0FBRVgsS0FBSyxFQUFHO1VBQ3BGO1FBQ0Q7UUFDQXVFLFVBQVUsQ0FBRXlFLEtBQUssQ0FBQzdILE9BQU8sSUFBSWpDLElBQUksQ0FBQ3lGLFVBQVUsSUFBSSxFQUFFLEVBQUUsSUFBSyxDQUFDO01BQzNELENBQUUsQ0FBQyxDQUFDdUUsTUFBTSxDQUFFLFlBQVk7UUFDdkIsSUFBS2hKLFlBQVksS0FBS2tJLGVBQWUsRUFBRztVQUN2Q2xJLFlBQVksR0FBRyxJQUFJO1FBQ3BCO01BQ0QsQ0FBRSxDQUFDO01BQ0hBLFlBQVksR0FBR2tJLGVBQWU7SUFDL0I7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTZSxhQUFhQSxDQUFFQyxlQUFlLEVBQUc7TUFDekMsSUFBSW5ILE9BQU8sR0FBR2pDLEtBQUssR0FBR0EsS0FBSyxDQUFDRCxhQUFhLENBQUUseUNBQTBDLENBQUMsR0FBRyxJQUFJO01BQzdGLElBQUlvQyxTQUFTLEdBQUduQyxLQUFLLEdBQUdBLEtBQUssQ0FBQ0QsYUFBYSxDQUFFLHVDQUF3QyxDQUFDLEdBQUcsSUFBSTtNQUM3RixJQUFJcUMsV0FBVyxHQUFHcEMsS0FBSyxHQUFHQSxLQUFLLENBQUNELGFBQWEsQ0FBRSwrQ0FBZ0QsQ0FBQyxHQUFHLElBQUk7TUFDdkcsSUFBSXNDLFdBQVcsR0FBR3JDLEtBQUssR0FBR0EsS0FBSyxDQUFDRCxhQUFhLENBQUUsK0NBQWdELENBQUMsR0FBRyxJQUFJO01BQ3ZHLElBQUlzSixjQUFjLEdBQUdoSCxXQUFXLEdBQUdBLFdBQVcsQ0FBQ3RDLGFBQWEsQ0FBRSxnREFBaUQsQ0FBQyxHQUFHLElBQUk7TUFDdkgsSUFBSXVKLFlBQVksR0FBR2pILFdBQVcsR0FBR0EsV0FBVyxDQUFDdEMsYUFBYSxDQUFFLElBQUssQ0FBQyxHQUFHLElBQUk7TUFDekUsSUFBSXdKLFdBQVcsR0FBR2xILFdBQVcsR0FBR0EsV0FBVyxDQUFDdEMsYUFBYSxDQUFFLHNDQUF1QyxDQUFDLEdBQUcsSUFBSTtNQUMxRyxJQUFJeUosWUFBWSxHQUFHbkgsV0FBVyxHQUFHQSxXQUFXLENBQUN0QyxhQUFhLENBQUUsdUNBQXdDLENBQUMsR0FBRyxJQUFJO01BRTVHLElBQ0MsQ0FBRXNDLFdBQVcsSUFDYixDQUFFZ0gsY0FBYyxJQUNoQixDQUFFRCxlQUFlLElBQ2pCLENBQUVBLGVBQWUsQ0FBQzlKLE1BQU0sSUFDeEIsQ0FBRThKLGVBQWUsQ0FBQ0ssSUFBSSxJQUN0QixDQUFFTCxlQUFlLENBQUNNLEtBQUssSUFDdkIsQ0FBRU4sZUFBZSxDQUFDTyxVQUFVLEVBQzNCO1FBQ0QvRSxVQUFVLENBQUUsRUFBRSxFQUFFLEtBQU0sQ0FBQztRQUN2QjFELFVBQVUsQ0FBRWhDLElBQUksQ0FBQzBLLFlBQVksSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQVEsQ0FBQztRQUNwRDtNQUNEO01BQ0FySixhQUFhLEdBQUc2SSxlQUFlO01BQy9CQyxjQUFjLENBQUM5TixTQUFTLEdBQUdxRSxlQUFlLENBQUU7UUFDM0NOLE1BQU0sRUFBRThKLGVBQWUsQ0FBQzlKLE1BQU0sSUFBSSxDQUFDLENBQUM7UUFDcENKLElBQUksRUFBRUE7TUFDUCxDQUFFLENBQUM7TUFDSCxJQUFLK0MsT0FBTyxFQUFHO1FBQ2RBLE9BQU8sQ0FBQ0ssTUFBTSxHQUFHLElBQUk7TUFDdEI7TUFDQSxJQUFLSCxTQUFTLEVBQUc7UUFDaEJBLFNBQVMsQ0FBQ0csTUFBTSxHQUFHLElBQUk7TUFDeEI7TUFDQSxJQUFLRixXQUFXLEVBQUc7UUFDbEJBLFdBQVcsQ0FBQ0UsTUFBTSxHQUFHLElBQUk7TUFDMUI7TUFDQUQsV0FBVyxDQUFDQyxNQUFNLEdBQUcsS0FBSztNQUMxQixJQUFLa0gsWUFBWSxFQUFHO1FBQ25CQSxZQUFZLENBQUMzRCxRQUFRLEdBQUcsS0FBSztRQUM3QjJELFlBQVksQ0FBQzNILFlBQVksQ0FBRSxlQUFlLEVBQUUsT0FBUSxDQUFDO1FBQ3JEMkgsWUFBWSxDQUFDL0gsV0FBVyxHQUFHakIsb0JBQW9CLEdBQUt0QixJQUFJLENBQUMySyxjQUFjLElBQUkzSyxJQUFJLENBQUM0SyxLQUFLLElBQUksRUFBRSxHQUFPNUssSUFBSSxDQUFDNkssYUFBYSxJQUFJLEVBQUk7TUFDN0g7TUFDQSxJQUFLUixXQUFXLEVBQUc7UUFDbEJBLFdBQVcsQ0FBQzFELFFBQVEsR0FBR2pOLE9BQU8sQ0FBRTRILG9CQUFxQixDQUFDO1FBQ3REK0ksV0FBVyxDQUFDMUgsWUFBWSxDQUFFLGVBQWUsRUFBRXJCLG9CQUFvQixHQUFHLE1BQU0sR0FBRyxPQUFRLENBQUM7TUFDckY7TUFDQVUsVUFBVSxDQUFFLEVBQUUsRUFBRSxLQUFNLENBQUM7TUFDdkJsQixLQUFLLENBQUM2QixZQUFZLENBQUUsV0FBVyxFQUFFLE9BQVEsQ0FBQztNQUMxQyxJQUFLeUgsWUFBWSxFQUFHO1FBQ25CQSxZQUFZLENBQUNuRyxLQUFLLENBQUMsQ0FBQztNQUNyQjtJQUNEOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTNkcsdUJBQXVCQSxDQUFBLEVBQUc7TUFDbEMsSUFBSTVILFdBQVcsR0FBR3BDLEtBQUssR0FBR0EsS0FBSyxDQUFDRCxhQUFhLENBQUUsK0NBQWdELENBQUMsR0FBRyxJQUFJO01BQ3ZHLElBQUlzQyxXQUFXLEdBQUdyQyxLQUFLLEdBQUdBLEtBQUssQ0FBQ0QsYUFBYSxDQUFFLCtDQUFnRCxDQUFDLEdBQUcsSUFBSTtNQUN2RyxJQUFJMEYsYUFBYSxHQUFHckQsV0FBVyxHQUFHQSxXQUFXLENBQUNyQyxhQUFhLENBQUUsd0NBQXlDLENBQUMsR0FBRyxJQUFJO01BRTlHLElBQUtTLG9CQUFvQixFQUFHO1FBQzNCVSxVQUFVLENBQUVoQyxJQUFJLENBQUMrSyxjQUFjLElBQUkvSyxJQUFJLENBQUNnTCxXQUFXLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxPQUFRLENBQUM7UUFDMUU7TUFDRDtNQUVBM0osYUFBYSxHQUFHLElBQUk7TUFDcEIsSUFBSzhCLFdBQVcsRUFBRztRQUNsQkEsV0FBVyxDQUFDQyxNQUFNLEdBQUcsSUFBSTtNQUMxQjtNQUNBLElBQUtGLFdBQVcsRUFBRztRQUNsQkEsV0FBVyxDQUFDRSxNQUFNLEdBQUcsS0FBSztNQUMzQjtNQUNBcEIsVUFBVSxDQUFFLEVBQUUsRUFBRSxLQUFNLENBQUM7TUFDdkIsSUFBS3VFLGFBQWEsRUFBRztRQUNwQkEsYUFBYSxDQUFDdEMsS0FBSyxDQUFDLENBQUM7TUFDdEI7SUFDRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU2dILGNBQWNBLENBQUEsRUFBRztNQUN6QixJQUFJckQsVUFBVTtNQUNkLElBQUlzQixlQUFlO01BRW5CLElBQ0MsQ0FBRXRELG1CQUFtQixDQUFDLENBQUMsSUFDdkIsQ0FBRXhFLGFBQWEsSUFDZixDQUFFQSxhQUFhLENBQUM4SixrQkFBa0IsSUFDbEMsQ0FBRW5MLGtCQUFrQixDQUFDb0osR0FBRyxJQUN4QixDQUFFcEosa0JBQWtCLENBQUNxSixNQUFNLElBQzNCLENBQUVqSixlQUFlLENBQUNrSixNQUFNLElBQ3hCLENBQUVsSixlQUFlLENBQUNtSixLQUFLLEVBQ3RCO1FBQ0R0SCxVQUFVLENBQUVoQyxJQUFJLENBQUMwSyxZQUFZLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxPQUFRLENBQUM7UUFDcEQ7TUFDRDtNQUVBaEosaUJBQWlCLElBQUksQ0FBQztNQUN0QmtHLFVBQVUsR0FBR2xHLGlCQUFpQjtNQUM5QixJQUFLVCxjQUFjLElBQUksVUFBVSxLQUFLLE9BQU9BLGNBQWMsQ0FBQ2hELEtBQUssRUFBRztRQUNuRWdELGNBQWMsQ0FBQ2hELEtBQUssQ0FBQyxDQUFDO01BQ3ZCO01BQ0E2RSxZQUFZLENBQUU5QyxJQUFJLENBQUNtTCxjQUFjLElBQUksRUFBRyxDQUFDO01BQ3pDakMsZUFBZSxHQUFHalYsTUFBTSxDQUFDOE4sTUFBTSxDQUFDd0gsSUFBSSxDQUFFO1FBQ3JDSixHQUFHLEVBQUVwSixrQkFBa0IsQ0FBQ29KLEdBQUc7UUFDM0JLLE1BQU0sRUFBRSxNQUFNO1FBQ2RDLFFBQVEsRUFBRSxNQUFNO1FBQ2hCbE0sSUFBSSxFQUFFO1VBQ0w4TCxNQUFNLEVBQUVsSixlQUFlLENBQUNrSixNQUFNO1VBQzlCQyxLQUFLLEVBQUVuSixlQUFlLENBQUNtSixLQUFLO1VBQzVCalUsVUFBVSxFQUFFK0wsYUFBYSxDQUFDL0wsVUFBVTtVQUNwQytULE1BQU0sRUFBRXJKLGtCQUFrQixDQUFDcUosTUFBTTtVQUNqQzhCLGtCQUFrQixFQUFFOUosYUFBYSxDQUFDOEosa0JBQWtCO1VBQ3BERSxRQUFRLEVBQUUxSCxJQUFJLENBQUNDLFNBQVMsQ0FBRXhFLDBCQUEwQixDQUFFcUMsS0FBTSxDQUFFO1FBQy9EO01BQ0QsQ0FBRSxDQUFDLENBQUNrSSxJQUFJLENBQUUsVUFBV0MsUUFBUSxFQUFHO1FBQy9CLElBQUsvQixVQUFVLEtBQUtsRyxpQkFBaUIsSUFBSSxDQUFFaUksUUFBUSxJQUFJLENBQUVBLFFBQVEsQ0FBQ0MsT0FBTyxJQUFJLENBQUVELFFBQVEsQ0FBQ3BNLElBQUksRUFBRztVQUM5RjtRQUNEO1FBQ0EwTSxhQUFhLENBQUVOLFFBQVEsQ0FBQ3BNLElBQUssQ0FBQztNQUMvQixDQUFFLENBQUMsQ0FBQ00sSUFBSSxDQUFFLFVBQVdDLGNBQWMsRUFBRUMsY0FBYyxFQUFHO1FBQ3JELElBQUkrTCxLQUFLLEdBQUdoTSxjQUFjLENBQUNpTSxZQUFZLElBQUlqTSxjQUFjLENBQUNpTSxZQUFZLENBQUN4TSxJQUFJLEdBQUdPLGNBQWMsQ0FBQ2lNLFlBQVksQ0FBQ3hNLElBQUksR0FBRyxDQUFDLENBQUM7UUFFbkgsSUFBSyxPQUFPLEtBQUtRLGNBQWMsSUFBSTZKLFVBQVUsS0FBS2xHLGlCQUFpQixJQUFJLENBQUVaLEtBQUssRUFBRztVQUNoRjtRQUNEO1FBQ0E0RSxVQUFVLENBQUUsRUFBRSxFQUFFLEtBQU0sQ0FBQztRQUN2QjFELFVBQVUsQ0FBRThILEtBQUssQ0FBQzdILE9BQU8sSUFBSWpDLElBQUksQ0FBQzBLLFlBQVksSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQVEsQ0FBQztNQUN0RSxDQUFFLENBQUMsQ0FBQ1YsTUFBTSxDQUFFLFlBQVk7UUFDdkIsSUFBSy9JLGNBQWMsS0FBS2lJLGVBQWUsRUFBRztVQUN6Q2pJLGNBQWMsR0FBRyxJQUFJO1FBQ3RCO01BQ0QsQ0FBRSxDQUFDO01BQ0hBLGNBQWMsR0FBR2lJLGVBQWU7SUFDakM7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTbUMsMEJBQTBCQSxDQUFFTixjQUFjLEVBQUc7TUFDckQsSUFBS0EsY0FBYyxJQUFJLFFBQVEsS0FBSyxPQUFPQSxjQUFjLENBQUM5SSxPQUFPLElBQUk4SSxjQUFjLENBQUM5SSxPQUFPLEVBQUc7UUFDN0YsT0FBTzhJLGNBQWMsQ0FBQzlJLE9BQU87TUFDOUI7TUFFQSxPQUFPakMsSUFBSSxDQUFDK0ssY0FBYyxJQUFJL0ssSUFBSSxDQUFDZ0wsV0FBVyxJQUFJLEVBQUU7SUFDckQ7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU00sMEJBQTBCQSxDQUFFQyxnQkFBZ0IsRUFBRztNQUN2RCxJQUFJQyxlQUFlO01BQ25CLElBQUk1RCxVQUFVO01BRWQsSUFBSyxDQUFFdEcsb0JBQW9CLElBQUksVUFBVSxLQUFLLE9BQU92QixrQkFBa0IsQ0FBQzBMLFVBQVUsRUFBRztRQUNwRnhCLGFBQWEsQ0FBRXNCLGdCQUFpQixDQUFDO1FBQ2pDdkosVUFBVSxDQUFFaEMsSUFBSSxDQUFDK0ssY0FBYyxJQUFJL0ssSUFBSSxDQUFDZ0wsV0FBVyxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsT0FBUSxDQUFDO1FBQzFFO01BQ0Q7TUFFQXJKLGdCQUFnQixJQUFJLENBQUM7TUFDckJpRyxVQUFVLEdBQUdqRyxnQkFBZ0I7TUFDN0JtQixZQUFZLENBQUU5QyxJQUFJLENBQUMwTCxrQkFBa0IsSUFBSTFMLElBQUksQ0FBQ3FELGFBQWEsSUFBSSxFQUFHLENBQUM7TUFDbkUsSUFBSTtRQUNIbUksZUFBZSxHQUFHekwsa0JBQWtCLENBQUMwTCxVQUFVLENBQUVuSyxvQkFBcUIsQ0FBQztNQUN4RSxDQUFDLENBQUMsT0FBUXFLLGtCQUFrQixFQUFHO1FBQzlCSCxlQUFlLEdBQUcsSUFBSTtNQUN2QjtNQUNBLElBQ0MsQ0FBRUEsZUFBZSxJQUNmLFVBQVUsS0FBSyxPQUFPQSxlQUFlLENBQUNJLElBQUksSUFBSSxVQUFVLEtBQUssT0FBT0osZUFBZSxDQUFDOUIsSUFBTSxFQUMzRjtRQUNETyxhQUFhLENBQUVzQixnQkFBaUIsQ0FBQztRQUNqQ3ZKLFVBQVUsQ0FBRWhDLElBQUksQ0FBQytLLGNBQWMsSUFBSS9LLElBQUksQ0FBQ2dMLFdBQVcsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQVEsQ0FBQztRQUMxRTtNQUNEO01BRUEvVyxNQUFNLENBQUM4TixNQUFNLENBQUM4SixJQUFJLENBQUVMLGVBQWdCLENBQUMsQ0FBQzlCLElBQUksQ0FBRSxVQUFXb0MsaUJBQWlCLEVBQUc7UUFDMUUsSUFDQ2xFLFVBQVUsS0FBS2pHLGdCQUFnQixJQUMvQixDQUFFYixLQUFLLElBQ1AsQ0FBRWdMLGlCQUFpQixJQUNuQkMsTUFBTSxDQUFFRCxpQkFBaUIsQ0FBQ3pXLFVBQVUsSUFBSSxDQUFFLENBQUMsS0FBSzBXLE1BQU0sQ0FBRXpLLG9CQUFvQixDQUFDak0sVUFBVSxJQUFJLENBQUUsQ0FBQyxFQUM3RjtVQUNEO1FBQ0Q7UUFDQWlNLG9CQUFvQixHQUFHLElBQUk7UUFDM0JPLEtBQUssR0FBRyxLQUFLO1FBQ2JzQyxLQUFLLENBQUUsSUFBSSxFQUFFLElBQUssQ0FBQztNQUNwQixDQUFFLENBQUMsQ0FBQ3RHLElBQUksQ0FBRSxVQUFXa04sY0FBYyxFQUFHO1FBQ3JDLElBQUtuRCxVQUFVLEtBQUtqRyxnQkFBZ0IsSUFBSSxDQUFFYixLQUFLLEVBQUc7VUFDakQ7UUFDRDtRQUNBbUosYUFBYSxDQUFFc0IsZ0JBQWlCLENBQUM7UUFDakN2SixVQUFVLENBQUVxSiwwQkFBMEIsQ0FBRU4sY0FBZSxDQUFDLEVBQUUsSUFBSSxFQUFFLE9BQVEsQ0FBQztNQUMxRSxDQUFFLENBQUM7SUFDSjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU2lCLGFBQWFBLENBQUEsRUFBRztNQUN4QixJQUFJcEUsVUFBVTtNQUNkLElBQUlzQixlQUFlO01BQ25CLElBQUlxQyxnQkFBZ0IsR0FBR2xLLGFBQWE7TUFFcEMsSUFBS0Msb0JBQW9CLEVBQUc7UUFDM0JnSywwQkFBMEIsQ0FBRUMsZ0JBQWlCLENBQUM7UUFDOUM7TUFDRDtNQUVBLElBQ0MsQ0FBRUEsZ0JBQWdCLElBQ2xCLENBQUVBLGdCQUFnQixDQUFDaEIsSUFBSSxJQUN2QixDQUFFZ0IsZ0JBQWdCLENBQUNmLEtBQUssSUFDeEIsQ0FBRXBKLGFBQWEsSUFDZixDQUFFckIsa0JBQWtCLENBQUNvSixHQUFHLElBQ3hCLENBQUVwSixrQkFBa0IsQ0FBQ3FKLE1BQU0sSUFDM0IsQ0FBRS9JLGNBQWMsQ0FBQ2dKLE1BQU0sSUFDdkIsQ0FBRWhKLGNBQWMsQ0FBQ2lKLEtBQUssRUFDckI7UUFDRHRILFVBQVUsQ0FBRWhDLElBQUksQ0FBQ2dMLFdBQVcsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQVEsQ0FBQztRQUNuRDtNQUNEO01BRUFySixnQkFBZ0IsSUFBSSxDQUFDO01BQ3JCaUcsVUFBVSxHQUFHakcsZ0JBQWdCO01BQzdCLElBQUtULGFBQWEsSUFBSSxVQUFVLEtBQUssT0FBT0EsYUFBYSxDQUFDakQsS0FBSyxFQUFHO1FBQ2pFaUQsYUFBYSxDQUFDakQsS0FBSyxDQUFDLENBQUM7TUFDdEI7TUFDQTZFLFlBQVksQ0FBRTlDLElBQUksQ0FBQ2lNLGdCQUFnQixJQUFJLEVBQUcsQ0FBQztNQUMzQy9DLGVBQWUsR0FBR2pWLE1BQU0sQ0FBQzhOLE1BQU0sQ0FBQ3dILElBQUksQ0FBRTtRQUNyQ0osR0FBRyxFQUFFcEosa0JBQWtCLENBQUNvSixHQUFHO1FBQzNCSyxNQUFNLEVBQUUsTUFBTTtRQUNkQyxRQUFRLEVBQUUsTUFBTTtRQUNoQmxNLElBQUksRUFBRTtVQUNMOEwsTUFBTSxFQUFFaEosY0FBYyxDQUFDZ0osTUFBTTtVQUM3QkMsS0FBSyxFQUFFakosY0FBYyxDQUFDaUosS0FBSztVQUMzQmpVLFVBQVUsRUFBRStMLGFBQWEsQ0FBQy9MLFVBQVU7VUFDcEMrVCxNQUFNLEVBQUVySixrQkFBa0IsQ0FBQ3FKLE1BQU07VUFDakNtQixJQUFJLEVBQUU3RyxJQUFJLENBQUNDLFNBQVMsQ0FBRTRILGdCQUFnQixDQUFDaEIsSUFBSyxDQUFDO1VBQzdDQyxLQUFLLEVBQUVlLGdCQUFnQixDQUFDZixLQUFLO1VBQzdCMEIsbUJBQW1CLEVBQUUsVUFBVSxLQUFLLE9BQU9uTSxrQkFBa0IsQ0FBQ29NLDhCQUE4QixJQUFJcE0sa0JBQWtCLENBQUNvTSw4QkFBOEIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHO1FBQzNKO01BQ0QsQ0FBRSxDQUFDLENBQUN6QyxJQUFJLENBQUUsVUFBV0MsUUFBUSxFQUFHO1FBQy9CLElBQUl5QyxZQUFZO1FBRWhCLElBQUt4RSxVQUFVLEtBQUtqRyxnQkFBZ0IsRUFBRztVQUN0QztRQUNEO1FBQ0EsSUFBSyxDQUFFZ0ksUUFBUSxJQUFJLENBQUVBLFFBQVEsQ0FBQ0MsT0FBTyxJQUFJLENBQUVELFFBQVEsQ0FBQ3BNLElBQUksSUFBSSxDQUFFb00sUUFBUSxDQUFDcE0sSUFBSSxDQUFDOE8sU0FBUyxFQUFHO1VBQ3ZGcEMsYUFBYSxDQUFFc0IsZ0JBQWlCLENBQUM7VUFDakN2SixVQUFVLENBQUVoQyxJQUFJLENBQUNnTCxXQUFXLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxPQUFRLENBQUM7VUFDbkQ7UUFDRDtRQUNBb0IsWUFBWSxHQUFHekMsUUFBUSxDQUFDcE0sSUFBSTtRQUM1QitELG9CQUFvQixHQUFHOEssWUFBWTtRQUNuQ2QsMEJBQTBCLENBQUVDLGdCQUFpQixDQUFDO01BQy9DLENBQUUsQ0FBQyxDQUFDMU4sSUFBSSxDQUFFLFVBQVdDLGNBQWMsRUFBRUMsY0FBYyxFQUFHO1FBQ3JELElBQUkrTCxLQUFLLEdBQUdoTSxjQUFjLENBQUNpTSxZQUFZLElBQUlqTSxjQUFjLENBQUNpTSxZQUFZLENBQUN4TSxJQUFJLEdBQUdPLGNBQWMsQ0FBQ2lNLFlBQVksQ0FBQ3hNLElBQUksR0FBRyxDQUFDLENBQUM7UUFFbkgsSUFBSyxPQUFPLEtBQUtRLGNBQWMsSUFBSTZKLFVBQVUsS0FBS2pHLGdCQUFnQixJQUFJLENBQUViLEtBQUssRUFBRztVQUMvRTtRQUNEO1FBQ0FtSixhQUFhLENBQUVzQixnQkFBaUIsQ0FBQztRQUNqQ3ZKLFVBQVUsQ0FBRThILEtBQUssQ0FBQzdILE9BQU8sSUFBSWpDLElBQUksQ0FBQ2dMLFdBQVcsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQVEsQ0FBQztNQUNyRSxDQUFFLENBQUMsQ0FBQ2hCLE1BQU0sQ0FBRSxZQUFZO1FBQ3ZCLElBQUs5SSxhQUFhLEtBQUtnSSxlQUFlLEVBQUc7VUFDeENoSSxhQUFhLEdBQUcsSUFBSTtRQUNyQjtNQUNELENBQUUsQ0FBQztNQUNIQSxhQUFhLEdBQUdnSSxlQUFlO0lBQ2hDOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTb0QsSUFBSUEsQ0FBRUMsT0FBTyxFQUFFQyxlQUFlLEVBQUc7TUFDekMsSUFBSW5YLFVBQVUsR0FBR21YLGVBQWUsR0FBR3BYLG9CQUFvQixDQUFFb1gsZUFBZSxDQUFDblgsVUFBVyxDQUFDLEdBQUcsQ0FBQztNQUV6RixJQUFLLENBQUVBLFVBQVUsSUFBSSxDQUFFOE8sS0FBSyxDQUFFLEtBQUssRUFBRSxLQUFNLENBQUMsRUFBRztRQUM5QyxPQUFPLEtBQUs7TUFDYjtNQUNBcEQsTUFBTSxHQUFHd0wsT0FBTztNQUNoQm5MLGFBQWEsR0FBRztRQUFFL0wsVUFBVSxFQUFFQTtNQUFXLENBQUM7TUFDMUMsSUFBSyxDQUFFcVAsWUFBWSxDQUFFO1FBQUUxRSxJQUFJLEVBQUVBO01BQUssQ0FBRSxDQUFDLEVBQUc7UUFDdkMsT0FBTyxLQUFLO01BQ2I7TUFDQThDLFlBQVksQ0FBRTlDLElBQUksQ0FBQ3FELGFBQWEsSUFBSSxFQUFHLENBQUM7TUFDeENwUCxNQUFNLENBQUNtUixxQkFBcUIsQ0FBRSxZQUFZO1FBQ3pDLElBQUt0RSxLQUFLLEVBQUc7VUFDWkEsS0FBSyxDQUFDbUQsS0FBSyxDQUFDLENBQUM7UUFDZDtNQUNELENBQUUsQ0FBQztNQUNIZ0YsY0FBYyxDQUFDLENBQUM7TUFFaEIsT0FBTyxJQUFJO0lBQ1o7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVN3RCwrQkFBK0JBLENBQUEsRUFBRztNQUMxQyxJQUFLLENBQUUzTCxLQUFLLElBQUksQ0FBRVUsS0FBSyxFQUFHO1FBQ3pCO01BQ0Q7TUFFQTdLLEtBQUssQ0FBQ2MsU0FBUyxDQUFDWixPQUFPLENBQUNjLElBQUksQ0FBRW1KLEtBQUssQ0FBQ21GLGdCQUFnQixDQUFFLGtEQUFtRCxDQUFDLEVBQUUsVUFBVytCLE9BQU8sRUFBRztRQUNoSUEsT0FBTyxDQUFDQyxPQUFPLEdBQUd6RyxLQUFLLENBQUM1QyxnQkFBZ0IsS0FBS29KLE9BQU8sQ0FBQ3ZNLEtBQUs7TUFDM0QsQ0FBRSxDQUFDO01BQ0g5RSxLQUFLLENBQUNjLFNBQVMsQ0FBQ1osT0FBTyxDQUFDYyxJQUFJLENBQUVtSixLQUFLLENBQUNtRixnQkFBZ0IsQ0FBRSxrREFBbUQsQ0FBQyxFQUFFLFVBQVcrQixPQUFPLEVBQUc7UUFDaElBLE9BQU8sQ0FBQ0MsT0FBTyxHQUFHekcsS0FBSyxDQUFDM0MsZ0JBQWdCLEtBQUttSixPQUFPLENBQUN2TSxLQUFLO01BQzNELENBQUUsQ0FBQztNQUNIOUUsS0FBSyxDQUFDYyxTQUFTLENBQUNaLE9BQU8sQ0FBQ2MsSUFBSSxDQUFFbUosS0FBSyxDQUFDbUYsZ0JBQWdCLENBQUUsc0NBQXVDLENBQUMsRUFBRSxVQUFXK0IsT0FBTyxFQUFHO1FBQ3BIQSxPQUFPLENBQUN2TSxLQUFLLEdBQUcrRixLQUFLLENBQUV3RyxPQUFPLENBQUMwRSxZQUFZLENBQUUsb0NBQXFDLENBQUMsQ0FBRSxJQUFJLEVBQUU7TUFDNUYsQ0FBRSxDQUFDO0lBQ0o7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTQyxZQUFZQSxDQUFFMVAsS0FBSyxFQUFHO01BQzlCLElBQUkyUCxZQUFZO01BQ2hCLElBQUlyRyxhQUFhO01BQ2pCLElBQUk4RCxXQUFXO01BQ2YsSUFBSUMsWUFBWTtNQUNoQixJQUFJdUMsaUJBQWlCO01BQ3JCLElBQUlDLG1CQUFtQjtNQUV2QixJQUFLLENBQUVoTSxLQUFLLElBQUksQ0FBRUEsS0FBSyxDQUFDM0UsUUFBUSxDQUFFYyxLQUFLLENBQUM4UCxNQUFPLENBQUMsRUFBRztRQUNsRDtNQUNEO01BQ0EsSUFBSzlQLEtBQUssQ0FBQzhQLE1BQU0sQ0FBQ0MsT0FBTyxDQUFFLHVDQUF3QyxDQUFDLEVBQUc7UUFDdEUvUCxLQUFLLENBQUNnUSxjQUFjLENBQUMsQ0FBQztRQUN0QjlJLEtBQUssQ0FBRSxJQUFJLEVBQUUsS0FBTSxDQUFDO1FBQ3BCO01BQ0Q7TUFDQSxJQUFLbEgsS0FBSyxDQUFDOFAsTUFBTSxDQUFDQyxPQUFPLENBQUUsdUNBQXdDLENBQUMsRUFBRztRQUN0RS9QLEtBQUssQ0FBQ2dRLGNBQWMsQ0FBQyxDQUFDO1FBQ3RCaEUsY0FBYyxDQUFDLENBQUM7UUFDaEI7TUFDRDtNQUNBMUMsYUFBYSxHQUFHdEosS0FBSyxDQUFDOFAsTUFBTSxDQUFDQyxPQUFPLENBQUUsd0NBQXlDLENBQUM7TUFDaEYsSUFBS3pHLGFBQWEsSUFBSSxDQUFFQSxhQUFhLENBQUNJLFFBQVEsRUFBRztRQUNoRDFKLEtBQUssQ0FBQ2dRLGNBQWMsQ0FBQyxDQUFDO1FBQ3RCaEMsY0FBYyxDQUFDLENBQUM7UUFDaEI7TUFDRDtNQUNBWixXQUFXLEdBQUdwTixLQUFLLENBQUM4UCxNQUFNLENBQUNDLE9BQU8sQ0FBRSxzQ0FBdUMsQ0FBQztNQUM1RSxJQUFLM0MsV0FBVyxFQUFHO1FBQ2xCcE4sS0FBSyxDQUFDZ1EsY0FBYyxDQUFDLENBQUM7UUFDdEJuQyx1QkFBdUIsQ0FBQyxDQUFDO1FBQ3pCO01BQ0Q7TUFDQVIsWUFBWSxHQUFHck4sS0FBSyxDQUFDOFAsTUFBTSxDQUFDQyxPQUFPLENBQUUsdUNBQXdDLENBQUM7TUFDOUUsSUFBSzFDLFlBQVksSUFBSSxDQUFFQSxZQUFZLENBQUMzRCxRQUFRLEVBQUc7UUFDOUMxSixLQUFLLENBQUNnUSxjQUFjLENBQUMsQ0FBQztRQUN0QmpCLGFBQWEsQ0FBQyxDQUFDO1FBQ2Y7TUFDRDtNQUNBWSxZQUFZLEdBQUczUCxLQUFLLENBQUM4UCxNQUFNLENBQUNDLE9BQU8sQ0FBRSx1Q0FBd0MsQ0FBQztNQUM5RSxJQUFLSixZQUFZLElBQUlyTCxXQUFXLElBQUlDLEtBQUssSUFBSUwsY0FBYyxFQUFHO1FBQzdEbEUsS0FBSyxDQUFDZ1EsY0FBYyxDQUFDLENBQUM7UUFDdEI1TCxhQUFhLEdBQUcsSUFBSTtRQUNwQkcsS0FBSyxHQUFHOUMsa0JBQWtCLENBQUU2QyxXQUFZLENBQUM7UUFDekNzTCxpQkFBaUIsR0FBRzFMLGNBQWMsQ0FBQ2pELGtCQUFrQixDQUFFc0QsS0FBSyxDQUFDNUMsZ0JBQWlCLENBQUM7UUFDL0VrTyxtQkFBbUIsR0FBR0QsaUJBQWlCLElBQUkxTCxjQUFjLENBQUNsRyx3QkFBd0IsQ0FBRXVHLEtBQUssQ0FBQy9LLGNBQWUsQ0FBQztRQUMxR2dXLCtCQUErQixDQUFDLENBQUM7UUFDakM1RyxrQkFBa0IsQ0FBQyxDQUFDO1FBQ3BCN0QsVUFBVSxDQUNUOEssbUJBQW1CLEdBQUs5TSxJQUFJLENBQUMrSCxlQUFlLElBQUksRUFBRSxHQUFPL0gsSUFBSSxDQUFDbUksaUJBQWlCLElBQUksRUFBSSxFQUN2RixDQUFFMkUsbUJBQ0gsQ0FBQztNQUNGO0lBQ0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTSSxhQUFhQSxDQUFFalEsS0FBSyxFQUFHO01BQy9CLElBQUlrUSxpQkFBaUI7TUFDckIsSUFBSUMsd0JBQXdCO01BQzVCLElBQUkxRyxZQUFZO01BQ2hCLElBQUkyRywwQkFBMEI7TUFDOUIsSUFBSUMsZ0JBQWdCO01BRXBCLElBQUssQ0FBRXhNLEtBQUssSUFBSSxDQUFFQSxLQUFLLENBQUMzRSxRQUFRLENBQUVjLEtBQUssQ0FBQzhQLE1BQU8sQ0FBQyxJQUFJLENBQUV2TCxLQUFLLEVBQUc7UUFDN0Q7TUFDRDtNQUNBMkwsaUJBQWlCLEdBQUdsUSxLQUFLLENBQUM4UCxNQUFNLENBQUNDLE9BQU8sQ0FBRSxrREFBbUQsQ0FBQztNQUM5Rkksd0JBQXdCLEdBQUduUSxLQUFLLENBQUM4UCxNQUFNLENBQUNDLE9BQU8sQ0FBRSxrREFBbUQsQ0FBQztNQUNyR3RHLFlBQVksR0FBR3pKLEtBQUssQ0FBQzhQLE1BQU0sQ0FBQ0MsT0FBTyxDQUFFLHNDQUF1QyxDQUFDO01BQzdFLElBQUtHLGlCQUFpQixFQUFHO1FBQ3hCRSwwQkFBMEIsR0FBRy9ZLGVBQWUsS0FBSzZZLGlCQUFpQixDQUFDMVIsS0FBSyxHQUFHbkgsZUFBZSxHQUFHQyxXQUFXO1FBQ3hHLElBQUs0TSxjQUFjLElBQUksQ0FBRUEsY0FBYyxDQUFDakQsa0JBQWtCLENBQUVtUCwwQkFBMkIsQ0FBQyxFQUFHO1VBQzFGWiwrQkFBK0IsQ0FBQyxDQUFDO1VBQ2pDekssVUFBVSxDQUFFaEMsSUFBSSxDQUFDbUksaUJBQWlCLElBQUksRUFBRSxFQUFFLElBQUssQ0FBQztVQUNoRDtRQUNEO1FBQ0EzRyxLQUFLLENBQUM1QyxnQkFBZ0IsR0FBR3lPLDBCQUEwQjtRQUNuRDdMLEtBQUssQ0FBQy9LLGNBQWMsR0FBRzBLLGNBQWMsR0FBR0EsY0FBYyxDQUFDdkcsa0JBQWtCLENBQUMsQ0FBQyxHQUFHNEcsS0FBSyxDQUFDL0ssY0FBYztNQUNuRyxDQUFDLE1BQU0sSUFBSzJXLHdCQUF3QixFQUFHO1FBQ3RDNUwsS0FBSyxDQUFDM0MsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBRXJLLHlCQUF5QixFQUFFQyx5QkFBeUIsRUFBRUMseUJBQXlCLENBQUUsQ0FBQ3VELE9BQU8sQ0FBRW1WLHdCQUF3QixDQUFDM1IsS0FBTSxDQUFDLEdBQzFKMlIsd0JBQXdCLENBQUMzUixLQUFLLEdBQzlCakgseUJBQXlCO01BQzdCLENBQUMsTUFBTSxJQUFLa1MsWUFBWSxFQUFHO1FBQzFCNEcsZ0JBQWdCLEdBQUc1RyxZQUFZLENBQUNnRyxZQUFZLENBQUUsb0NBQXFDLENBQUM7UUFDcEYsSUFBSyxDQUFDLENBQUMsS0FBSyxDQUFFLFlBQVksRUFBRSxVQUFVLENBQUUsQ0FBQ3pVLE9BQU8sQ0FBRXFWLGdCQUFpQixDQUFDLEVBQUc7VUFDdEU7UUFDRDtRQUNBOUwsS0FBSyxDQUFFOEwsZ0JBQWdCLENBQUUsR0FBR3BXLDJCQUEyQixDQUFFd1AsWUFBWSxDQUFDakwsS0FBTSxDQUFDO01BQzlFLENBQUMsTUFBTTtRQUNOO01BQ0Q7TUFDQTRGLGFBQWEsR0FBRyxJQUFJO01BQ3BCd0Usa0JBQWtCLENBQUMsQ0FBQztJQUNyQjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVMwSCxjQUFjQSxDQUFFdFEsS0FBSyxFQUFHO01BQ2hDLElBQUssUUFBUSxLQUFLQSxLQUFLLENBQUNwRSxHQUFHLElBQUksQ0FBRWlJLEtBQUssRUFBRztRQUN4QztNQUNEO01BQ0E3RCxLQUFLLENBQUNnUSxjQUFjLENBQUMsQ0FBQztNQUN0QmhRLEtBQUssQ0FBQ3VRLHdCQUF3QixDQUFDLENBQUM7TUFDaENySixLQUFLLENBQUUsSUFBSSxFQUFFLEtBQU0sQ0FBQztJQUNyQjtJQUVBeEUsZUFBZSxDQUFDOE4sZ0JBQWdCLENBQUUsT0FBTyxFQUFFZCxZQUFhLENBQUM7SUFDekRoTixlQUFlLENBQUM4TixnQkFBZ0IsQ0FBRSxRQUFRLEVBQUVQLGFBQWMsQ0FBQztJQUMzRHZOLGVBQWUsQ0FBQzhOLGdCQUFnQixDQUFFLE9BQU8sRUFBRVAsYUFBYyxDQUFDO0lBQzFEdk4sZUFBZSxDQUFDOE4sZ0JBQWdCLENBQUUsU0FBUyxFQUFFRixjQUFjLEVBQUUsSUFBSyxDQUFDO0lBRW5FLE9BQU87TUFDTmpCLElBQUksRUFBRUEsSUFBSTtNQUNWb0IsT0FBTyxFQUFFLFNBQUFBLENBQUEsRUFBWTtRQUNwQixPQUFPaFUsT0FBTyxDQUFFb0gsS0FBTSxDQUFDO01BQ3hCLENBQUM7TUFDRDZNLFFBQVEsRUFBRSxTQUFBQSxDQUFBLEVBQVk7UUFDckIsT0FBTzlMLEtBQUs7TUFDYixDQUFDO01BQ0QrTCxlQUFlLEVBQUUsU0FBQUEsQ0FBQSxFQUFZO1FBQzVCLE9BQU8sQ0FBRS9MLEtBQUssSUFBSTVOLE1BQU0sQ0FBQ3NRLE9BQU8sQ0FBRXZFLElBQUksQ0FBQ3dFLGVBQWUsSUFBSSxFQUFHLENBQUM7TUFDL0QsQ0FBQztNQUNEcUoseUJBQXlCLEVBQUUsU0FBQUEsQ0FBQSxFQUFZO1FBQ3RDLE9BQU8xSixLQUFLLENBQUUsS0FBSyxFQUFFLEtBQU0sQ0FBQztNQUM3QixDQUFDO01BQ0QySixXQUFXLEVBQUUsU0FBQUEsQ0FBQSxFQUFZO1FBQ3hCM0osS0FBSyxDQUFFLEtBQUssRUFBRSxJQUFLLENBQUM7TUFDckIsQ0FBQztNQUNENEosT0FBTyxFQUFFLFNBQUFBLENBQUEsRUFBWTtRQUNwQjVKLEtBQUssQ0FBRSxLQUFLLEVBQUUsSUFBSyxDQUFDO1FBQ3BCeEUsZUFBZSxDQUFDcU8sbUJBQW1CLENBQUUsT0FBTyxFQUFFckIsWUFBYSxDQUFDO1FBQzVEaE4sZUFBZSxDQUFDcU8sbUJBQW1CLENBQUUsUUFBUSxFQUFFZCxhQUFjLENBQUM7UUFDOUR2TixlQUFlLENBQUNxTyxtQkFBbUIsQ0FBRSxPQUFPLEVBQUVkLGFBQWMsQ0FBQztRQUM3RHZOLGVBQWUsQ0FBQ3FPLG1CQUFtQixDQUFFLFNBQVMsRUFBRVQsY0FBYyxFQUFFLElBQUssQ0FBQztNQUN2RTtJQUNELENBQUM7RUFDRjtFQUVBdFosTUFBTSxDQUFDZ2Esd0JBQXdCLEdBQUdoYSxNQUFNLENBQUNnYSx3QkFBd0IsSUFBSSxDQUFDLENBQUM7RUFDdkVoYSxNQUFNLENBQUNnYSx3QkFBd0IsQ0FBQy9VLDhCQUE4QixHQUFHQSw4QkFBOEI7RUFDL0ZqRixNQUFNLENBQUNnYSx3QkFBd0IsQ0FBQ3ZPLGlCQUFpQixHQUFHQSxpQkFBaUI7QUFDdEUsQ0FBQyxFQUFFekwsTUFBTSxFQUFFQyxRQUFRLEVBQUU2TixNQUFPLENBQUMiLCJpZ25vcmVMaXN0IjpbXX0=
