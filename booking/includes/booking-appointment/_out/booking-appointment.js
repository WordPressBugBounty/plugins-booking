"use strict";

(function (window, $) {
  'use strict';

  var config = window.wpbc_booking_appointment_config || {};
  var active_native_contexts = {};
  var loaded_script_urls = {};
  $('script[src]').each(function () {
    loaded_script_urls[String(this.src || '')] = true;
  });

  /** Return a normalized integer from a selector field. */
  function get_selected_id($form, name) {
    return Number($form.find('[name="' + name + '"]:checked, [name="' + name + '"][type="hidden"]').first().val() || 0);
  }

  /**
   * Apply public text search to one server-authorized Appointment catalog.
   *
   * @param {jQuery} $catalog Appointment catalog root.
   * @return {void}
   */
  function filter_appointment_catalog($catalog) {
    var search_term = String($catalog.find('[data-wpbc-appointment-catalog-search]').val() || '').toLocaleLowerCase().trim();
    var catalog_type = String($catalog.attr('data-catalog-type') || 'services');
    var visible_count = 0;
    $catalog.find('[data-wpbc-appointment-catalog-card]').each(function () {
      var $card = $(this);
      var searchable_text = String($card.attr('data-appointment-catalog-search') || '').toLocaleLowerCase();
      var is_visible = !search_term || searchable_text.indexOf(search_term) !== -1;
      var $choice_input = $card.find('input[type="radio"]').first();
      $card.prop('hidden', !is_visible);
      $choice_input.prop('disabled', !is_visible);
      if (is_visible) {
        visible_count += 1;
      } else if ($choice_input.prop('checked')) {
        $choice_input.prop('checked', false);
        $card.removeClass('is-selected');
      }
    });
    $catalog.find('[data-wpbc-appointment-catalog-empty]').prop('hidden', 0 !== visible_count);
    $catalog.find('[data-wpbc-appointment-catalog-status]').text(String(visible_count) + ' ' + ('providers' === catalog_type ? 1 === visible_count ? config.provider_found || 'Provider found.' : config.providers_found || 'Providers found.' : 1 === visible_count ? config.service_found || 'Service found.' : config.services_found || 'Services found.'));
  }

  /** Toggle one component loading state without clearing its current stage. */
  function set_loading($root, is_loading) {
    $root.toggleClass('is-loading', is_loading).attr('aria-busy', is_loading ? 'true' : 'false');
    $root.find('> .wpbc_booking_appointment__stage').attr('aria-busy', is_loading ? 'true' : 'false');
    $root.find('> .wpbc_booking_appointment__loading').prop('hidden', !is_loading).attr('aria-hidden', is_loading ? 'false' : 'true');
    $root.find('.wpbc_booking_appointment__selection_form :input').prop('disabled', is_loading);
    if (!is_loading) {
      $root.find('[data-wpbc-appointment-catalog]').each(function () {
        filter_appointment_catalog($(this));
      });
    }
  }

  /**
   * Display and focus an AJAX or initialization error in one component.
   *
   * @param {jQuery} $root        Appointment component root.
   * @param {string} message      Error message.
   * @param {string} action_url   Optional trusted administration action URL.
   * @param {string} action_label Optional action link label.
   * @return {void}
   */
  function show_error($root, message, action_url, action_label) {
    var $notice = $root.find('> .wpbc_booking_appointment__ajax_notice');
    $notice.empty().append($('<span>').text(message || config.error || 'Unable to load the Appointment form.'));
    if (action_url && action_label) {
      $notice.append(' ', $('<a>', {
        'class': 'wpbc_booking_appointment__notice_action',
        href: action_url,
        text: action_label
      }));
    }
    $notice.prop('hidden', false);
    if ($notice.get(0) && typeof $notice.get(0).focus === 'function') {
      $notice.trigger('focus');
    }
  }

  /** Clear the component AJAX error. */
  function clear_error($root) {
    $root.find('> .wpbc_booking_appointment__ajax_notice').empty().prop('hidden', true);
  }

  /** Return a registered native context only while its DOM element is live. */
  function get_native_context(provider_id) {
    provider_id = Number(provider_id || 0);
    var context = active_native_contexts[provider_id];
    if (!context || !context.element || !document.documentElement.contains(context.element)) {
      delete active_native_contexts[provider_id];
      return null;
    }
    return context;
  }

  /** Detect another live native Booking Calendar form for the same Provider. */
  function has_duplicate_provider_form($root, provider_id) {
    provider_id = Number(provider_id || 0);
    if (!provider_id) {
      return false;
    }
    var context = get_native_context(provider_id);
    if (context && !$.contains($root.get(0), context.element)) {
      return true;
    }
    return $('[id="booking_form' + provider_id + '"]').filter(function () {
      return !$.contains($root.get(0), this);
    }).length > 0;
  }

  /** Register the exact signed native form context used by booking submission. */
  function register_native_form($native) {
    var provider_id = Number($native.data('provider-id') || 0);
    var service_id = Number($native.data('service-id') || 0);
    var context_token = String($native.attr('data-appointment-context-token') || '');
    var allow_past = '1' === String($native.attr('data-allow-past') || '0') ? 1 : 0;
    var existing = get_native_context(provider_id);
    if (!provider_id || !service_id || !context_token) {
      return false;
    }
    if (existing && existing.element !== $native.get(0)) {
      return false;
    }
    active_native_contexts[provider_id] = {
      element: $native.get(0),
      service_id: service_id,
      provider_id: provider_id,
      context_token: context_token,
      allow_past: allow_past
    };
    return true;
  }

  /** Remove a native form from the local submission-context registry. */
  function unregister_native_form($native) {
    var provider_id = Number($native.data('provider-id') || 0);
    var context = get_native_context(provider_id);
    if (context && context.element === $native.get(0)) {
      delete active_native_contexts[provider_id];
    }
  }

  /** Return the native Start Time field used by the fixed Service duration. */
  function get_start_time_field($native) {
    var provider_id = Number($native.data('provider-id') || 0);
    return $native.find('[name="starttime' + provider_id + '"], [name="starttime' + provider_id + '[]"]').not('[data-wpbc-booking-submit-ignore="1"]').first();
  }

  /** Return selected calendar dates in the server's strict SQL-date format. */
  function get_selected_dates($native) {
    var provider_id = Number($native.data('provider-id') || 0);
    if (provider_id && typeof window.wpbc_get__selected_dates_sql__as_arr === 'function') {
      return window.wpbc_get__selected_dates_sql__as_arr(provider_id);
    }
    var value = String($native.find('#date_booking' + provider_id).val() || '');
    return value.split(',').map(function (date_value) {
      var parts = $.trim(date_value).split('.');
      return 3 === parts.length ? parts[2] + '-' + parts[1] + '-' + parts[0] : '';
    }).filter(function (date_value) {
      return /^\d{4}-\d{2}-\d{2}$/.test(date_value);
    });
  }

  /**
   * Normalize the one-date seed accepted by the Appointment calendar.
   *
   * Appointment duration remains Service-owned, so the handoff seeds only the
   * start date and lets the existing availability request validate its time.
   *
   * @param {*} calendar_dates Candidate JSON date collection.
   * @return {Array<string>} Zero or one valid ISO calendar date.
   */
  function normalize_initial_calendar_dates(calendar_dates) {
    var normalized_dates = [];
    if (!Array.isArray(calendar_dates)) {
      return normalized_dates;
    }
    calendar_dates.some(function (calendar_date) {
      var normalized_date = String(calendar_date || '');
      var date_parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized_date);
      var native_date;
      if (!date_parts) {
        return false;
      }
      native_date = new Date(parseInt(date_parts[1], 10), parseInt(date_parts[2], 10) - 1, parseInt(date_parts[3], 10));
      if (native_date.getFullYear() !== parseInt(date_parts[1], 10) || native_date.getMonth() !== parseInt(date_parts[2], 10) - 1 || native_date.getDate() !== parseInt(date_parts[3], 10)) {
        return false;
      }
      normalized_dates.push(normalized_date);
      return true;
    });
    return normalized_dates;
  }

  /**
   * Read the signed, server-normalized calendar seed rendered for one form.
   *
   * @param {jQuery} $native Native Appointment form wrapper.
   * @return {Object|null} Provider and date seed, or null without a handoff.
   */
  function get_initial_calendar_context($native) {
    var provider_id = Number($native.data('provider-id') || 0);
    var calendar_dates = [];
    if ('1' !== String($native.attr('data-preselect-calendar-dates') || '') || provider_id <= 0) {
      return null;
    }
    try {
      calendar_dates = JSON.parse(String($native.attr('data-initial-calendar-dates') || '[]'));
    } catch (error) {
      calendar_dates = [];
    }
    calendar_dates = normalize_initial_calendar_dates(calendar_dates);
    return calendar_dates.length ? {
      provider_id: provider_id,
      initial_dates: calendar_dates
    } : null;
  }

  /**
   * Return isolated one-time calendar hydration state for a native form.
   *
   * The state prevents delayed datepicker initialization from overwriting a
   * date that the administrator selected manually after the form rendered.
   *
   * @param {jQuery} $native Native Appointment form wrapper.
   * @return {Object} Mutable hydration state owned by the native form element.
   */
  function get_initial_calendar_state($native) {
    var native_element = $native.get(0);
    if (!native_element.wpbc_appointment_initial_calendar_state) {
      native_element.wpbc_appointment_initial_calendar_state = {
        applied: false,
        cancelled: false,
        applying: false,
        calendar_data_loaded: false,
        attempts: 0,
        scheduled: false
      };
    }
    return native_element.wpbc_appointment_initial_calendar_state;
  }

  /**
   * Seed the visible native calendar after its availability data is ready.
   *
   * The canonical calendar helper selects through the Datepick interaction
   * path, preserving availability rules, visual selection, and the normal
   * date-selected event. Waiting for the core AJAX completion prevents its
   * later calendar redraw from removing the visible selected date.
   *
   * @param {jQuery} $native Native Appointment form wrapper.
   * @return {boolean} True after the requested date was applied.
   */
  function apply_initial_calendar_dates($native) {
    var initial_context = get_initial_calendar_context($native);
    var state = get_initial_calendar_state($native);
    var $date_field;
    var selected_dates_count = 0;
    if (state.applied || state.cancelled || !state.calendar_data_loaded || !initial_context) {
      return state.applied;
    }
    if (!document.documentElement.contains($native.get(0))) {
      state.cancelled = true;
      return false;
    }
    if ('function' !== typeof window.wpbc_auto_select_dates_in_calendar) {
      return false;
    }
    $date_field = $native.find('#date_booking' + initial_context.provider_id).first();
    if (!$date_field.length) {
      return false;
    }
    if (String($date_field.val() || '').trim()) {
      state.cancelled = true;
      return false;
    }
    state.applying = true;
    try {
      selected_dates_count = window.wpbc_auto_select_dates_in_calendar(initial_context.provider_id, initial_context.initial_dates[0]);
      state.applied = 0 < selected_dates_count;
    } finally {
      state.applying = false;
    }
    return state.applied;
  }

  /**
   * Retry calendar hydration only while the matching native form is live.
   *
   * The Booking Calendar datepicker can initialize after the Appointment stage
   * markup, so the signed seed is retried for a bounded period without polling
   * after the form has been replaced or the administrator has chosen a date.
   *
   * @param {jQuery} $native Native Appointment form wrapper.
   * @return {void}
   */
  function schedule_initial_calendar_dates($native) {
    var state = get_initial_calendar_state($native);
    if (state.applied || state.cancelled || state.scheduled || !state.calendar_data_loaded || !get_initial_calendar_context($native)) {
      return;
    }
    state.scheduled = true;
    window.requestAnimationFrame(function () {
      state.scheduled = false;
      state.attempts++;
      if (apply_initial_calendar_dates($native) || state.cancelled || state.attempts >= 12) {
        return;
      }
      window.setTimeout(function () {
        schedule_initial_calendar_dates($native);
      }, 100);
    });
  }

  /**
   * Attach one-time seed behavior while preserving a faster manual choice.
   *
   * @param {jQuery} $native Native Appointment form wrapper.
   * @return {void}
   */
  function initialize_initial_calendar_dates($native) {
    var initial_context = get_initial_calendar_context($native);
    if (!initial_context) {
      return;
    }
    $native.off('date_selected.wpbc_booking_appointment_initial_dates').on('date_selected.wpbc_booking_appointment_initial_dates', function (event, provider_id) {
      var state = get_initial_calendar_state($native);
      if (Number(provider_id || 0) === initial_context.provider_id && !state.applying && !state.applied && get_selected_dates($native).length) {
        state.cancelled = true;
      }
    });
    schedule_initial_calendar_dates($native);
  }

  /** Read the current date/start selection and its stable request signature. */
  function get_time_selection($native) {
    var $start = get_start_time_field($native);
    var dates = get_selected_dates($native);
    var start_time = $start.length ? String($start.val() || '') : '';
    return {
      $start: $start,
      dates: dates,
      start_time: start_time,
      complete: !!(dates.length && /^\d{1,2}:\d{2}(?::\d{2})?$/.test(start_time)),
      signature: dates.join(',') + '|' + start_time
    };
  }

  /** Determine whether the Start Time field belongs to the visible wizard step. */
  function is_time_selection_stage_active(selection) {
    var $step = selection.$start.closest('.wpbc_wizard_step');
    return !$step.length || $step.is(':visible') && !$step.hasClass('wpbc_wizard_step_hidden');
  }

  /** Find the visible Start Time UI beneath which validation is explained. */
  function get_time_notice_anchor(selection) {
    var $picker = selection.$start.nextAll('.wpbc_times_selector').first();
    return $picker.length ? $picker : selection.$start;
  }

  /** Remove the Appointment buffer warning and invalid field semantics. */
  function clear_time_notice($native) {
    $native.find('.wpbc_booking_appointment__time_notice').remove();
    get_start_time_field($native).removeAttr('aria-invalid').nextAll('.wpbc_times_selector').first().removeAttr('aria-invalid');
  }

  /** Show a persistent warning using Booking Calendar's frontend message UI. */
  function show_time_notice($native, selection, message) {
    clear_time_notice($native);
    var $anchor = get_time_notice_anchor(selection);
    if (!$anchor.length) {
      $anchor = $native.find('.bk_calendar_frame').first();
    }
    if (!$anchor.length) {
      return;
    }
    selection.$start.attr('aria-invalid', 'true').nextAll('.wpbc_times_selector').first().attr('aria-invalid', 'true');
    $('<div>', {
      'class': 'wpbc_booking_appointment__time_notice wpbc_front_end__message wpbc_fe_message wpbc_fe_message_warning',
      role: 'alert'
    }).append($('<i>', {
      'class': 'menu_icon icon-1x wpbc_icn_warning',
      'aria-hidden': 'true'
    })).append($('<span>').text(message || config.validation_error || config.error)).insertAfter($anchor);
  }

  /** Return or initialize the validation state owned by one native form. */
  function get_time_validation_state($native) {
    var state = $native.data('wpbc-appointment-time-validation');
    if (!state) {
      state = {
        sequence: 0,
        signature: '',
        status: 'incomplete',
        request: null,
        promise: null,
        timer: null,
        availability_sequence: 0,
        availability_request: null,
        availability_timer: null,
        available_slots: {}
      };
      $native.data('wpbc-appointment-time-validation', state);
    }
    return state;
  }

  /** Restore only option state previously owned by the Appointment filter. */
  function clear_appointment_disabled_times($start) {
    $start.find('option[data-wpbc-appointment-unavailable="1"]').each(function () {
      var $option = $(this);
      if (!$option.hasClass('booked')) {
        $option.prop('disabled', false);
      }
      $option.removeAttr('data-wpbc-appointment-unavailable');
    });
  }

  /** Rebuild the optional plate-style picker from the filtered native select. */
  function refresh_start_time_picker($start) {
    if ($start.length && typeof $start.wpbc_timeselector === 'function' && $start.nextAll('.wpbc_times_selector').length) {
      $start.wpbc_timeselector();
    }
  }

  /** Read all options still allowed by the ordinary Booking Calendar engine. */
  function get_core_available_start_times($start) {
    var values = [];
    $start.find('option').each(function () {
      var $option = $(this);
      var value = String($option.val() || '');
      var appointment_disabled = '1' === String($option.attr('data-wpbc-appointment-unavailable') || '');
      if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(value) && (!$option.prop('disabled') || appointment_disabled && !$option.hasClass('booked'))) {
        values.push(value);
      }
    });
    return values;
  }

  /** Convert a browser time string to minutes from the start of its day. */
  function debug_time_to_minutes(time_value) {
    var parts = String(time_value || '').split(':');
    if (parts.length < 2) {
      return null;
    }
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  /** Format debug time while retaining a previous/next-day boundary. */
  function debug_format_minutes(total_minutes) {
    var day_offset = 0;
    while (total_minutes < 0) {
      total_minutes += 1440;
      day_offset--;
    }
    while (total_minutes >= 1440) {
      total_minutes -= 1440;
      day_offset++;
    }
    var hours = ('0' + Math.floor(total_minutes / 60)).slice(-2);
    var minutes = ('0' + total_minutes % 60).slice(-2);
    return hours + ':' + minutes + (day_offset ? ' (' + (day_offset > 0 ? '+' : '') + day_offset + ' day)' : '');
  }

  /** Explain the asynchronous Service-aware availability pass in the console. */
  function log_start_time_filter_request($native, dates, start_times) {
    if (!window.console || typeof window.console.info !== 'function') {
      return;
    }
    window.console.info('[Booking Calendar Appointment] Rechecking Start Times with Service duration and buffers. The initial list comes from Provider calendar availability and may now be reduced.', {
      service_id: Number($native.data('service-id') || 0),
      provider_id: Number($native.data('provider-id') || 0),
      dates: dates.slice(0),
      initial_start_times: start_times.slice(0)
    });
  }

  /** Log only scheduling data needed to understand removed Start Times. */
  function log_start_time_filter_result($native, dates, data) {
    if (!window.console || typeof window.console.info !== 'function') {
      return;
    }
    var buffer_before = Number(data.buffer_before || 0);
    var buffer_after = Number(data.buffer_after || 0);
    var blocked = [];
    Object.keys(data.slots || {}).forEach(function (start_time) {
      var result = data.slots[start_time];
      if (!result || false !== result.valid) {
        return;
      }
      var end_time = String(result.end_time || '');
      var start_minutes = debug_time_to_minutes(start_time);
      var end_minutes = debug_time_to_minutes(end_time);
      blocked.push({
        start_time: start_time,
        appointment_time: end_time ? start_time + ' - ' + end_time : start_time,
        provider_reserved: null !== start_minutes && null !== end_minutes ? debug_format_minutes(start_minutes - buffer_before) + ' - ' + debug_format_minutes(end_minutes + buffer_after) : '',
        reason: result.message || result.code || config.validation_error
      });
    });
    window.console.info('[Booking Calendar Appointment] Service-aware Start Time check completed.', {
      service_id: Number($native.data('service-id') || 0),
      provider_id: Number($native.data('provider-id') || 0),
      dates: dates.slice(0),
      duration_minutes: Number(data.duration || 0),
      buffer_before_minutes: buffer_before,
      buffer_after_minutes: buffer_after,
      blocked_start_times: blocked.map(function (item) {
        return item.start_time;
      })
    });
    if (blocked.length && typeof window.console.table === 'function') {
      window.console.table(blocked);
    }
  }

  /** Apply one server response without exposing another customer's booking. */
  function apply_available_start_times($native, slots) {
    var selection = get_time_selection($native);
    var $start = selection.$start;
    var initial_start_time = String($native.attr('data-initial-start-time') || '');
    var selected_value = selection.start_time || initial_start_time;
    var selected_message = '';
    clear_appointment_disabled_times($start);
    $start.find('option').each(function () {
      var $option = $(this);
      var value = String($option.val() || '');
      var result = slots && slots[value] ? slots[value] : null;
      if (result && false === result.valid && !$option.hasClass('booked')) {
        $option.prop('disabled', true).attr('data-wpbc-appointment-unavailable', '1');
        if (selected_value === value) {
          selected_message = result.message || config.validation_error;
        }
      }
    });
    if (selected_message) {
      $start.val('');
      show_time_notice($native, selection, selected_message);
    } else if (initial_start_time && slots && slots[initial_start_time] && false !== slots[initial_start_time].valid) {
      $start.val(initial_start_time);
    }
    $native.removeAttr('data-initial-start-time');
    refresh_start_time_picker($start);
  }

  /** Filter the complete Start Time list with one bounded server request. */
  function load_available_start_times($native) {
    var state = get_time_validation_state($native);
    var $start = get_start_time_field($native);
    var dates = get_selected_dates($native);
    var start_times = get_core_available_start_times($start);
    var sequence = ++state.availability_sequence;
    if (state.availability_request && 4 !== state.availability_request.readyState) {
      state.availability_request.abort();
    }
    if (!$start.length || !dates.length || !start_times.length) {
      clear_appointment_disabled_times($start);
      refresh_start_time_picker($start);
      state.available_slots = {};
      return;
    }
    log_start_time_filter_request($native, dates, start_times);
    state.availability_request = $.post(config.ajax_url, {
      action: config.validate_action,
      nonce: config.nonce,
      service_id: Number($native.data('service-id') || 0),
      provider_id: Number($native.data('provider-id') || 0),
      context_token: String($native.attr('data-appointment-context-token') || ''),
      dates: dates,
      start_times: start_times
    });
    state.availability_request.done(function (response) {
      if (sequence !== state.availability_sequence) {
        return;
      }
      var data = response && response.data ? response.data : {};
      if (!response || !response.success || !data.slots) {
        return;
      }
      state.available_slots = data.slots;
      log_start_time_filter_result($native, dates, data);
      apply_available_start_times($native, data.slots);
    }).fail(function (xhr, status) {
      if ('abort' === status || sequence !== state.availability_sequence) {
        return;
      }
      clear_appointment_disabled_times($start);
      refresh_start_time_picker($start);
      state.available_slots = {};
    });
  }

  /** Debounce the whole-list filter after core availability has refreshed. */
  function schedule_available_start_times($native) {
    var state = get_time_validation_state($native);
    window.clearTimeout(state.availability_timer);
    state.availability_timer = window.setTimeout(function () {
      load_available_start_times($native);
    }, 30);
  }

  /** Validate current Service duration/buffers through the authoritative server. */
  function validate_time_selection($native) {
    var selection = get_time_selection($native);
    var state = get_time_validation_state($native);
    if (!selection.complete) {
      if (state.request && 4 !== state.request.readyState) {
        state.request.abort();
      }
      state.signature = selection.signature;
      state.status = 'incomplete';
      state.promise = null;
      clear_time_notice($native);
      return $.Deferred().resolve(false, 'incomplete').promise();
    }
    if (selection.signature === state.signature && 'valid' === state.status) {
      return $.Deferred().resolve(true, 'valid').promise();
    }
    if (selection.signature === state.signature && 'invalid' === state.status) {
      return $.Deferred().resolve(false, 'invalid').promise();
    }
    if (selection.signature === state.signature && 'pending' === state.status && state.promise) {
      return state.promise;
    }
    if (state.request && 4 !== state.request.readyState) {
      state.request.abort();
    }
    var deferred = $.Deferred();
    var sequence = ++state.sequence;
    state.signature = selection.signature;
    state.status = 'pending';
    state.promise = deferred.promise();
    clear_time_notice($native);
    state.request = $.post(config.ajax_url, {
      action: config.validate_action,
      nonce: config.nonce,
      service_id: Number($native.data('service-id') || 0),
      provider_id: Number($native.data('provider-id') || 0),
      context_token: String($native.attr('data-appointment-context-token') || ''),
      dates: selection.dates,
      start_time: selection.start_time
    });
    state.request.done(function (response) {
      if (sequence !== state.sequence || selection.signature !== get_time_selection($native).signature) {
        deferred.reject('stale');
        return;
      }
      var data = response && response.data ? response.data : {};
      if (response && response.success && true === data.valid) {
        state.status = 'valid';
        clear_time_notice($native);
        deferred.resolve(true, 'valid');
        return;
      }
      state.status = 'invalid';
      show_time_notice($native, selection, data.message || config.validation_error);
      deferred.resolve(false, 'invalid');
    }).fail(function (xhr, status) {
      if ('abort' === status || sequence !== state.sequence) {
        deferred.reject('stale');
        return;
      }
      var response = xhr.responseJSON;
      var message = response && response.data && response.data.message ? response.data.message : config.validation_error;
      state.status = 'invalid';
      show_time_notice($native, selection, message);
      deferred.resolve(false, 'invalid');
    });
    return state.promise;
  }

  /** Debounce validation after calendar or Start Time changes. */
  function schedule_time_validation($native) {
    var state = get_time_validation_state($native);
    window.clearTimeout(state.timer);
    state.status = 'changed';
    clear_time_notice($native);
    if (!is_time_selection_stage_active(get_time_selection($native))) {
      return;
    }
    state.timer = window.setTimeout(function () {
      validate_time_selection($native);
    }, 120);
  }

  /** Block forward wizard navigation until the current time preflight passes. */
  function capture_wizard_navigation(event, $native) {
    var $button = $(event.target).closest('.wpbc_wizard_step_button');
    if (!$button.length || !$.contains($native.get(0), $button.get(0))) {
      return;
    }
    if ($button.get(0).wpbc_appointment_preflight_bypass) {
      $button.get(0).wpbc_appointment_preflight_bypass = false;
      return;
    }
    var target_match = String($button.attr('class') || '').match(/wpbc_wizard_step_(\d+)/);
    var current_match = String($button.closest('.wpbc_wizard_step').attr('class') || '').match(/wpbc_wizard_step(\d+)/);
    if (!target_match || current_match && Number(target_match[1]) <= Number(current_match[1])) {
      return;
    }
    var selection = get_time_selection($native);
    var $current_step = $button.closest('.wpbc_wizard_step');
    var $time_step = selection.$start.closest('.wpbc_wizard_step');
    if ($time_step.length && $current_step.length && $time_step.get(0) !== $current_step.get(0)) {
      return;
    }
    if (!selection.complete) {
      return;
    }
    var state = get_time_validation_state($native);
    if (selection.signature === state.signature && 'valid' === state.status) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    validate_time_selection($native).done(function (valid) {
      if (valid && document.documentElement.contains($button.get(0))) {
        $button.get(0).wpbc_appointment_preflight_bypass = true;
        $button.get(0).click();
      }
    });
  }

  /** Attach isolated buffer preflight behavior to one native Appointment form. */
  function initialize_time_preflight($native) {
    if (!config.ajax_url || !config.validate_action || !$native.length) {
      return;
    }
    var native_element = $native.get(0);
    if (native_element.wpbc_appointment_time_preflight_ready) {
      return;
    }
    native_element.wpbc_appointment_time_preflight_ready = true;
    native_element.addEventListener('click', function (event) {
      capture_wizard_navigation(event, $native);
    }, true);
    $native.on('change.wpbc_appointment_time_preflight', '[name^="starttime"]', function () {
      schedule_time_validation($native);
    });
    $native.on('date_selected.wpbc_appointment_time_preflight wpbc_hook_timeslots_disabled.wpbc_appointment_time_preflight', function (event, provider_id) {
      if (Number(provider_id || 0) === Number($native.data('provider-id') || 0)) {
        schedule_available_start_times($native);
        schedule_time_validation($native);
      }
    });
    schedule_available_start_times($native);
  }

  /**
   * Lock a native duration field to the selected Service duration.
   *
   * The core save handler independently derives duration from the Service row;
   * this client step only keeps the visible form and serialized data aligned.
   */
  function prepare_native_form($scope) {
    var $native = $scope.find('.wpbc_booking_appointment__native_form').first();
    if (!$native.length) {
      return true;
    }
    if (!register_native_form($native)) {
      return false;
    }
    var resource_id = Number($native.data('provider-id') || 0);
    var duration = String($native.data('duration') || '');
    var field_name = 'durationtime' + resource_id;
    var $form = $native.find('#booking_form' + resource_id);
    $form.find('.wpbc_booking_appointment__duration_proxy').remove();
    var $duration_fields = $form.find('[name="' + field_name + '"], [name="' + field_name + '[]"]');
    var $derived_time_fields = $form.find('[name="endtime' + resource_id + '"], [name="endtime' + resource_id + '[]"], [name="rangetime' + resource_id + '"], [name="rangetime' + resource_id + '[]"]');
    $duration_fields.each(function () {
      var $field = $(this);
      if ($field.is('select') && !$field.find('option[value="' + duration.replace(/"/g, '\\"') + '"]').length) {
        $field.append($('<option>', {
          value: duration,
          text: duration
        }));
      }
      $field.val(duration).prop('disabled', true).attr('aria-disabled', 'true');
      $field.closest('.wpdev-form-control-wrap').addClass('wpbc_booking_appointment__fixed_duration_field');
    });
    $derived_time_fields.each(function () {
      var $field = $(this);
      $field.prop('disabled', true).attr('aria-disabled', 'true');
      $field.closest('.wpdev-form-control-wrap').addClass('wpbc_booking_appointment__fixed_duration_field');
    });
    if (!$duration_fields.length) {
      var $duration_proxy = $('<select>', {
        name: field_name,
        'class': 'wpbc_booking_appointment__duration_value',
        'aria-hidden': 'true',
        tabindex: '-1',
        'data-wpbc-appointment-generated': '1'
      }).append($('<option>', {
        value: duration,
        text: duration,
        selected: true
      }));
      $form.append($('<span>', {
        'class': 'wpdev-form-control-wrap wpbc_booking_appointment__fixed_duration_field wpbc_booking_appointment__duration_proxy',
        'aria-hidden': 'true'
      }).append($duration_proxy));
    }
    initialize_time_preflight($native);
    initialize_initial_calendar_dates($native);
    return true;
  }

  /** Convert a script URL to the same absolute representation as DOM script.src. */
  function get_absolute_script_url(url) {
    var anchor = document.createElement('a');
    anchor.href = String(url || '');
    return anchor.href;
  }

  /** Execute renderer scripts sequentially while the request still owns the stage. */
  function execute_scripts(scripts, owns_stage) {
    var sequence = $.Deferred().resolve().promise();
    $.each(scripts, function (index, script) {
      sequence = sequence.then(function () {
        if (!owns_stage()) {
          return rejected_stage('');
        }
        if (script.src) {
          var absolute_url = get_absolute_script_url(script.src);
          if (loaded_script_urls[absolute_url]) {
            return undefined;
          }
          return $.ajax({
            url: absolute_url,
            dataType: 'script',
            cache: true
          }).then(function () {
            loaded_script_urls[absolute_url] = true;
          });
        }
        if (script.code) {
          $.globalEval(script.code);
        }
        return undefined;
      });
    });
    return sequence;
  }

  /** Initialize controls whose core handlers normally bind on document ready. */
  function initialize_ajax_form_controls() {
    if (typeof window.wpbc_hook__init_booking_form_wizard_buttons === 'function') {
      window.wpbc_hook__init_booking_form_wizard_buttons();
    }
  }

  /** Destroy native calendar instances and unregister context before removal. */
  function cleanup_native_form($root) {
    $root.find('.wpbc_booking_appointment__native_form').each(function () {
      var $native = $(this);
      var resource_id = Number($native.data('provider-id') || 0);
      var $calendar = $native.find('#calendar_booking' + resource_id);
      unregister_native_form($native);
      if (!resource_id || !$calendar.length || !$.datepick || typeof $calendar.datepick !== 'function') {
        return;
      }
      try {
        var instance = typeof $.datepick._getInst === 'function' ? $.datepick._getInst($calendar.get(0)) : null;
        if (instance) {
          $calendar.datepick('destroy');
        }
      } catch (error) {
        $calendar.removeClass('hasDatepick');
      }
    });
  }

  /** Restore the previously selected Service when navigating back one stage. */
  function restore_service_selection($root) {
    var service_id = Number($root.attr('data-selected-service-id') || 0);
    if (!service_id) {
      return;
    }
    var $input = $root.find('.wpbc_booking_appointment__selection_form [name="wpbc_appointment_service"][value="' + service_id + '"]').first();
    if ($input.length) {
      $input.prop('checked', true).closest('.wpbc_booking_appointment__choice').addClass('is-selected');
    }
  }

  /** Focus the new stage heading without forcing motion for reduced-motion users. */
  function focus_stage($root) {
    var $target = $root.find('> .wpbc_booking_appointment__stage .wpbc_booking_appointment__heading h3, > .wpbc_booking_appointment__stage .wpbc_booking_appointment__notice').first();
    if ($target.length) {
      $target.attr('tabindex', '-1');
      try {
        $target.get(0).focus({
          preventScroll: true
        });
      } catch (error) {
        $target.trigger('focus');
      }
    }
    if ($root.get(0) && typeof $root.get(0).scrollIntoView === 'function') {
      var reduce_motion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      $root.get(0).scrollIntoView({
        behavior: reduce_motion ? 'auto' : 'smooth',
        block: 'nearest'
      });
    }
  }

  /** Return a rejected promise carrying one controlled initialization message. */
  function rejected_stage(message) {
    var deferred = $.Deferred();
    deferred.reject({
      wpbc_message: message
    });
    return deferred.promise();
  }

  /** Replace a stage while guaranteeing DOM-before-script initialization order. */
  function replace_stage($root, html, stage, provider_id, request_id) {
    if (!is_current_request($root, request_id)) {
      return rejected_stage('');
    }
    if ('booking' === stage && has_duplicate_provider_form($root, provider_id)) {
      return rejected_stage(config.duplicate_provider);
    }
    var parsed = $.parseHTML(String(html || ''), document, true) || [];
    var scripts = [];
    var $container = $('<div>').append(parsed);
    $container.find('script').addBack('script').each(function () {
      scripts.push({
        src: this.src || '',
        code: this.src ? '' : this.text || this.textContent || ''
      });
      $(this).remove();
    });
    cleanup_native_form($root);
    $root.attr('data-appointment-stage', stage);
    $root.find('> .wpbc_booking_appointment__stage').empty().append($container.contents());
    if (!prepare_native_form($root)) {
      cleanup_native_form($root);
      $root.find('.wpbc_booking_appointment__native_form :input').prop('disabled', true);
      return rejected_stage(config.initialization_error || config.error);
    }
    return execute_scripts(scripts, function () {
      return is_current_request($root, request_id);
    }).then(function () {
      if (!is_current_request($root, request_id)) {
        return rejected_stage('');
      }
      initialize_ajax_form_controls();
      if ('service' === stage) {
        restore_service_selection($root);
      }
    });
  }

  /** Determine whether an AJAX callback still owns the component state. */
  function is_current_request($root, request_id) {
    return Number($root.data('wpbc-appointment-request-id') || 0) === Number(request_id);
  }

  /** Finish only the current request so stale callbacks cannot alter the UI. */
  function finish_request($root, request_id) {
    if (!is_current_request($root, request_id)) {
      return;
    }
    $root.removeData('wpbc-appointment-request');
    set_loading($root, false);
  }

  /** Request and render the next Appointment workflow stage. */
  function resolve_stage($root, service_id, provider_id) {
    if (!$root || !$root.length) {
      return;
    }
    service_id = Number(service_id || 0);
    provider_id = Number(provider_id || 0);
    if (service_id) {
      $root.attr('data-selected-service-id', service_id);
    }
    if (provider_id) {
      $root.attr('data-selected-provider-id', provider_id);
    }
    var previous_request = $root.data('wpbc-appointment-request');
    var request_id = Number($root.data('wpbc-appointment-request-id') || 0) + 1;
    $root.data('wpbc-appointment-request-id', request_id);
    if (previous_request && previous_request.readyState !== 4) {
      previous_request.abort();
    }
    clear_error($root);
    set_loading($root, true);
    var request = $.post(config.ajax_url, {
      action: config.action,
      nonce: config.nonce,
      config_token: $root.attr('data-config-token') || '',
      service_id: service_id,
      provider_id: provider_id
    });
    $root.data('wpbc-appointment-request', request);
    request.done(function (response) {
      if (!is_current_request($root, request_id)) {
        return;
      }
      if (!response || !response.success || !response.data) {
        show_error($root, response && response.data && response.data.message ? response.data.message : config.error, response && response.data ? response.data.action_url : '', response && response.data ? response.data.action_label : '');
        finish_request($root, request_id);
        return;
      }
      var stage = response.data.stage || '';
      var replacement = replace_stage($root, response.data.html, stage, response.data.provider_id, request_id);
      replacement.done(function () {
        if (!is_current_request($root, request_id)) {
          return;
        }
        if (Number(response.data.service_id || 0)) {
          $root.attr('data-selected-service-id', Number(response.data.service_id));
        }
        if (Number(response.data.provider_id || 0)) {
          $root.attr('data-selected-provider-id', Number(response.data.provider_id));
        }
        finish_request($root, request_id);
        focus_stage($root);
      }).fail(function (error) {
        if (!is_current_request($root, request_id)) {
          return;
        }
        var message = error && error.wpbc_message ? error.wpbc_message : config.initialization_error || config.error;
        show_error($root, message);
        finish_request($root, request_id);
      });
    }).fail(function (xhr, status) {
      if ('abort' === status || !is_current_request($root, request_id)) {
        return;
      }
      var response = xhr.responseJSON;
      show_error($root, response && response.data && response.data.message ? response.data.message : config.error, response && response.data ? response.data.action_url : '', response && response.data ? response.data.action_label : '');
      finish_request($root, request_id);
    });
  }

  /** Handle Service and Provider fallback forms through AJAX. */
  $(document).on('submit', '.wpbc_booking_appointment__selection_form', function (event) {
    if (!config.ajax_url || !config.action) {
      return;
    }
    event.preventDefault();
    var $form = $(this);
    var $root = $form.closest('.wpbc_booking_appointment');
    resolve_stage($root, get_selected_id($form, 'wpbc_appointment_service'), get_selected_id($form, 'wpbc_appointment_provider'));
  });

  /** Keep plate selection styling independent from CSS :has() support. */
  $(document).on('change', '.wpbc_booking_appointment__choice > input', function () {
    var $input = $(this);
    $input.closest('.wpbc_booking_appointment__choices').find('.wpbc_booking_appointment__choice').removeClass('is-selected');
    $input.closest('.wpbc_booking_appointment__choice').addClass('is-selected');
  });

  /** Filter Service and Provider cards without changing the signed catalog. */
  $(document).on('input search', '[data-wpbc-appointment-catalog-search]', function () {
    filter_appointment_catalog($(this).closest('[data-wpbc-appointment-catalog]'));
  });

  /** Return to Service selection while preserving the last valid Service. */
  $(document).on('click', '.wpbc_booking_appointment [data-appointment-back="service"]', function () {
    var $root = $(this).closest('.wpbc_booking_appointment');
    if ($root.hasClass('is-loading')) {
      return;
    }
    resolve_stage($root, 0, 0);
  });

  /** Return to the first selectable Appointment stage without reloading the page. */
  $(document).on('click', '.wpbc_booking_appointment [data-wpbc-appointment-action="start-over"], .wpbc_booking_appointment .wpbc_booking_appointment__change', function (event) {
    if (!config.ajax_url || !config.action) {
      return;
    }
    event.preventDefault();
    var $root = $(this).closest('.wpbc_booking_appointment');
    if ($root.hasClass('is-loading')) {
      return;
    }
    $root.removeAttr('data-selected-service-id data-selected-provider-id');
    resolve_stage($root, 0, 0);
  });

  /** Add the registered signed and server-authorized context to the core booking request. */
  $('body').on('wpbc_before_booking_create.wpbc_booking_appointment', function (event, resource_id, params) {
    var context = get_native_context(resource_id);
    if (!context) {
      return;
    }
    params.service_id = context.service_id;
    params.appointment_service_required = 1;
    params.appointment_context_token = context.context_token;
    params.allow_past = context.allow_past;
  });

  /** Add the signed Appointment pair to the existing live-cost request. */
  $(document).on('wpbc_before_cost_request.wpbc_booking_appointment', function (event, resource_id, params) {
    var context = get_native_context(resource_id);
    if (!context || !params) {
      return;
    }
    params.appointment_service_id = context.service_id;
    params.appointment_context_token = context.context_token;
  });

  /** Retry a matching seed when the core calendar finishes AJAX hydration. */
  $('body').off('wpbc_calendar_ajx__loaded_data.wpbc_booking_appointment_initial_dates').on('wpbc_calendar_ajx__loaded_data.wpbc_booking_appointment_initial_dates', function (event, loaded_resource_id) {
    $('.wpbc_booking_appointment__native_form').each(function () {
      var $native = $(this);
      var initial_context = get_initial_calendar_context($native);
      var state;
      if (!initial_context || initial_context.provider_id !== Number(loaded_resource_id || 0)) {
        return;
      }
      state = get_initial_calendar_state($native);
      state.calendar_data_loaded = true;
      state.attempts = 0;
      schedule_initial_calendar_dates($native);
    });
  });
  $(function () {
    $('.wpbc_booking_appointment').each(function () {
      var $root = $(this);
      $root.find('[data-wpbc-appointment-catalog]').each(function () {
        filter_appointment_catalog($(this));
      });
      var $native = $root.find('.wpbc_booking_appointment__native_form').first();
      if ($native.length) {
        $root.attr('data-selected-service-id', Number($native.data('service-id') || 0));
        $root.attr('data-selected-provider-id', Number($native.data('provider-id') || 0));
      }
      if (!prepare_native_form($root)) {
        var duplicate = $native.length && has_duplicate_provider_form($root, Number($native.data('provider-id') || 0));
        cleanup_native_form($root);
        $root.find('.wpbc_booking_appointment__native_form :input').prop('disabled', true);
        show_error($root, duplicate ? config.duplicate_provider : config.initialization_error);
      }
    });
  });
})(window, jQuery);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvYm9va2luZy1hcHBvaW50bWVudC9fb3V0L2Jvb2tpbmctYXBwb2ludG1lbnQuanMiLCJuYW1lcyI6WyJ3aW5kb3ciLCIkIiwiY29uZmlnIiwid3BiY19ib29raW5nX2FwcG9pbnRtZW50X2NvbmZpZyIsImFjdGl2ZV9uYXRpdmVfY29udGV4dHMiLCJsb2FkZWRfc2NyaXB0X3VybHMiLCJlYWNoIiwiU3RyaW5nIiwic3JjIiwiZ2V0X3NlbGVjdGVkX2lkIiwiJGZvcm0iLCJuYW1lIiwiTnVtYmVyIiwiZmluZCIsImZpcnN0IiwidmFsIiwiZmlsdGVyX2FwcG9pbnRtZW50X2NhdGFsb2ciLCIkY2F0YWxvZyIsInNlYXJjaF90ZXJtIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJ0cmltIiwiY2F0YWxvZ190eXBlIiwiYXR0ciIsInZpc2libGVfY291bnQiLCIkY2FyZCIsInNlYXJjaGFibGVfdGV4dCIsImlzX3Zpc2libGUiLCJpbmRleE9mIiwiJGNob2ljZV9pbnB1dCIsInByb3AiLCJyZW1vdmVDbGFzcyIsInRleHQiLCJwcm92aWRlcl9mb3VuZCIsInByb3ZpZGVyc19mb3VuZCIsInNlcnZpY2VfZm91bmQiLCJzZXJ2aWNlc19mb3VuZCIsInNldF9sb2FkaW5nIiwiJHJvb3QiLCJpc19sb2FkaW5nIiwidG9nZ2xlQ2xhc3MiLCJzaG93X2Vycm9yIiwibWVzc2FnZSIsImFjdGlvbl91cmwiLCJhY3Rpb25fbGFiZWwiLCIkbm90aWNlIiwiZW1wdHkiLCJhcHBlbmQiLCJlcnJvciIsImhyZWYiLCJnZXQiLCJmb2N1cyIsInRyaWdnZXIiLCJjbGVhcl9lcnJvciIsImdldF9uYXRpdmVfY29udGV4dCIsInByb3ZpZGVyX2lkIiwiY29udGV4dCIsImVsZW1lbnQiLCJkb2N1bWVudCIsImRvY3VtZW50RWxlbWVudCIsImNvbnRhaW5zIiwiaGFzX2R1cGxpY2F0ZV9wcm92aWRlcl9mb3JtIiwiZmlsdGVyIiwibGVuZ3RoIiwicmVnaXN0ZXJfbmF0aXZlX2Zvcm0iLCIkbmF0aXZlIiwiZGF0YSIsInNlcnZpY2VfaWQiLCJjb250ZXh0X3Rva2VuIiwiYWxsb3dfcGFzdCIsImV4aXN0aW5nIiwidW5yZWdpc3Rlcl9uYXRpdmVfZm9ybSIsImdldF9zdGFydF90aW1lX2ZpZWxkIiwibm90IiwiZ2V0X3NlbGVjdGVkX2RhdGVzIiwid3BiY19nZXRfX3NlbGVjdGVkX2RhdGVzX3NxbF9fYXNfYXJyIiwidmFsdWUiLCJzcGxpdCIsIm1hcCIsImRhdGVfdmFsdWUiLCJwYXJ0cyIsInRlc3QiLCJub3JtYWxpemVfaW5pdGlhbF9jYWxlbmRhcl9kYXRlcyIsImNhbGVuZGFyX2RhdGVzIiwibm9ybWFsaXplZF9kYXRlcyIsIkFycmF5IiwiaXNBcnJheSIsInNvbWUiLCJjYWxlbmRhcl9kYXRlIiwibm9ybWFsaXplZF9kYXRlIiwiZGF0ZV9wYXJ0cyIsImV4ZWMiLCJuYXRpdmVfZGF0ZSIsIkRhdGUiLCJwYXJzZUludCIsImdldEZ1bGxZZWFyIiwiZ2V0TW9udGgiLCJnZXREYXRlIiwicHVzaCIsImdldF9pbml0aWFsX2NhbGVuZGFyX2NvbnRleHQiLCJKU09OIiwicGFyc2UiLCJpbml0aWFsX2RhdGVzIiwiZ2V0X2luaXRpYWxfY2FsZW5kYXJfc3RhdGUiLCJuYXRpdmVfZWxlbWVudCIsIndwYmNfYXBwb2ludG1lbnRfaW5pdGlhbF9jYWxlbmRhcl9zdGF0ZSIsImFwcGxpZWQiLCJjYW5jZWxsZWQiLCJhcHBseWluZyIsImNhbGVuZGFyX2RhdGFfbG9hZGVkIiwiYXR0ZW1wdHMiLCJzY2hlZHVsZWQiLCJhcHBseV9pbml0aWFsX2NhbGVuZGFyX2RhdGVzIiwiaW5pdGlhbF9jb250ZXh0Iiwic3RhdGUiLCIkZGF0ZV9maWVsZCIsInNlbGVjdGVkX2RhdGVzX2NvdW50Iiwid3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciIsInNjaGVkdWxlX2luaXRpYWxfY2FsZW5kYXJfZGF0ZXMiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJzZXRUaW1lb3V0IiwiaW5pdGlhbGl6ZV9pbml0aWFsX2NhbGVuZGFyX2RhdGVzIiwib2ZmIiwib24iLCJldmVudCIsImdldF90aW1lX3NlbGVjdGlvbiIsIiRzdGFydCIsImRhdGVzIiwic3RhcnRfdGltZSIsImNvbXBsZXRlIiwic2lnbmF0dXJlIiwiam9pbiIsImlzX3RpbWVfc2VsZWN0aW9uX3N0YWdlX2FjdGl2ZSIsInNlbGVjdGlvbiIsIiRzdGVwIiwiY2xvc2VzdCIsImlzIiwiaGFzQ2xhc3MiLCJnZXRfdGltZV9ub3RpY2VfYW5jaG9yIiwiJHBpY2tlciIsIm5leHRBbGwiLCJjbGVhcl90aW1lX25vdGljZSIsInJlbW92ZSIsInJlbW92ZUF0dHIiLCJzaG93X3RpbWVfbm90aWNlIiwiJGFuY2hvciIsInJvbGUiLCJ2YWxpZGF0aW9uX2Vycm9yIiwiaW5zZXJ0QWZ0ZXIiLCJnZXRfdGltZV92YWxpZGF0aW9uX3N0YXRlIiwic2VxdWVuY2UiLCJzdGF0dXMiLCJyZXF1ZXN0IiwicHJvbWlzZSIsInRpbWVyIiwiYXZhaWxhYmlsaXR5X3NlcXVlbmNlIiwiYXZhaWxhYmlsaXR5X3JlcXVlc3QiLCJhdmFpbGFiaWxpdHlfdGltZXIiLCJhdmFpbGFibGVfc2xvdHMiLCJjbGVhcl9hcHBvaW50bWVudF9kaXNhYmxlZF90aW1lcyIsIiRvcHRpb24iLCJyZWZyZXNoX3N0YXJ0X3RpbWVfcGlja2VyIiwid3BiY190aW1lc2VsZWN0b3IiLCJnZXRfY29yZV9hdmFpbGFibGVfc3RhcnRfdGltZXMiLCJ2YWx1ZXMiLCJhcHBvaW50bWVudF9kaXNhYmxlZCIsImRlYnVnX3RpbWVfdG9fbWludXRlcyIsInRpbWVfdmFsdWUiLCJkZWJ1Z19mb3JtYXRfbWludXRlcyIsInRvdGFsX21pbnV0ZXMiLCJkYXlfb2Zmc2V0IiwiaG91cnMiLCJNYXRoIiwiZmxvb3IiLCJzbGljZSIsIm1pbnV0ZXMiLCJsb2dfc3RhcnRfdGltZV9maWx0ZXJfcmVxdWVzdCIsInN0YXJ0X3RpbWVzIiwiY29uc29sZSIsImluZm8iLCJpbml0aWFsX3N0YXJ0X3RpbWVzIiwibG9nX3N0YXJ0X3RpbWVfZmlsdGVyX3Jlc3VsdCIsImJ1ZmZlcl9iZWZvcmUiLCJidWZmZXJfYWZ0ZXIiLCJibG9ja2VkIiwiT2JqZWN0Iiwia2V5cyIsInNsb3RzIiwiZm9yRWFjaCIsInJlc3VsdCIsInZhbGlkIiwiZW5kX3RpbWUiLCJzdGFydF9taW51dGVzIiwiZW5kX21pbnV0ZXMiLCJhcHBvaW50bWVudF90aW1lIiwicHJvdmlkZXJfcmVzZXJ2ZWQiLCJyZWFzb24iLCJjb2RlIiwiZHVyYXRpb25fbWludXRlcyIsImR1cmF0aW9uIiwiYnVmZmVyX2JlZm9yZV9taW51dGVzIiwiYnVmZmVyX2FmdGVyX21pbnV0ZXMiLCJibG9ja2VkX3N0YXJ0X3RpbWVzIiwiaXRlbSIsInRhYmxlIiwiYXBwbHlfYXZhaWxhYmxlX3N0YXJ0X3RpbWVzIiwiaW5pdGlhbF9zdGFydF90aW1lIiwic2VsZWN0ZWRfdmFsdWUiLCJzZWxlY3RlZF9tZXNzYWdlIiwibG9hZF9hdmFpbGFibGVfc3RhcnRfdGltZXMiLCJyZWFkeVN0YXRlIiwiYWJvcnQiLCJwb3N0IiwiYWpheF91cmwiLCJhY3Rpb24iLCJ2YWxpZGF0ZV9hY3Rpb24iLCJub25jZSIsImRvbmUiLCJyZXNwb25zZSIsInN1Y2Nlc3MiLCJmYWlsIiwieGhyIiwic2NoZWR1bGVfYXZhaWxhYmxlX3N0YXJ0X3RpbWVzIiwiY2xlYXJUaW1lb3V0IiwidmFsaWRhdGVfdGltZV9zZWxlY3Rpb24iLCJEZWZlcnJlZCIsInJlc29sdmUiLCJkZWZlcnJlZCIsInJlamVjdCIsInJlc3BvbnNlSlNPTiIsInNjaGVkdWxlX3RpbWVfdmFsaWRhdGlvbiIsImNhcHR1cmVfd2l6YXJkX25hdmlnYXRpb24iLCIkYnV0dG9uIiwidGFyZ2V0Iiwid3BiY19hcHBvaW50bWVudF9wcmVmbGlnaHRfYnlwYXNzIiwidGFyZ2V0X21hdGNoIiwibWF0Y2giLCJjdXJyZW50X21hdGNoIiwiJGN1cnJlbnRfc3RlcCIsIiR0aW1lX3N0ZXAiLCJwcmV2ZW50RGVmYXVsdCIsInN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbiIsImNsaWNrIiwiaW5pdGlhbGl6ZV90aW1lX3ByZWZsaWdodCIsIndwYmNfYXBwb2ludG1lbnRfdGltZV9wcmVmbGlnaHRfcmVhZHkiLCJhZGRFdmVudExpc3RlbmVyIiwicHJlcGFyZV9uYXRpdmVfZm9ybSIsIiRzY29wZSIsInJlc291cmNlX2lkIiwiZmllbGRfbmFtZSIsIiRkdXJhdGlvbl9maWVsZHMiLCIkZGVyaXZlZF90aW1lX2ZpZWxkcyIsIiRmaWVsZCIsInJlcGxhY2UiLCJhZGRDbGFzcyIsIiRkdXJhdGlvbl9wcm94eSIsInRhYmluZGV4Iiwic2VsZWN0ZWQiLCJnZXRfYWJzb2x1dGVfc2NyaXB0X3VybCIsInVybCIsImFuY2hvciIsImNyZWF0ZUVsZW1lbnQiLCJleGVjdXRlX3NjcmlwdHMiLCJzY3JpcHRzIiwib3duc19zdGFnZSIsImluZGV4Iiwic2NyaXB0IiwidGhlbiIsInJlamVjdGVkX3N0YWdlIiwiYWJzb2x1dGVfdXJsIiwidW5kZWZpbmVkIiwiYWpheCIsImRhdGFUeXBlIiwiY2FjaGUiLCJnbG9iYWxFdmFsIiwiaW5pdGlhbGl6ZV9hamF4X2Zvcm1fY29udHJvbHMiLCJ3cGJjX2hvb2tfX2luaXRfYm9va2luZ19mb3JtX3dpemFyZF9idXR0b25zIiwiY2xlYW51cF9uYXRpdmVfZm9ybSIsIiRjYWxlbmRhciIsImRhdGVwaWNrIiwiaW5zdGFuY2UiLCJfZ2V0SW5zdCIsInJlc3RvcmVfc2VydmljZV9zZWxlY3Rpb24iLCIkaW5wdXQiLCJmb2N1c19zdGFnZSIsIiR0YXJnZXQiLCJwcmV2ZW50U2Nyb2xsIiwic2Nyb2xsSW50b1ZpZXciLCJyZWR1Y2VfbW90aW9uIiwibWF0Y2hNZWRpYSIsIm1hdGNoZXMiLCJiZWhhdmlvciIsImJsb2NrIiwid3BiY19tZXNzYWdlIiwicmVwbGFjZV9zdGFnZSIsImh0bWwiLCJzdGFnZSIsInJlcXVlc3RfaWQiLCJpc19jdXJyZW50X3JlcXVlc3QiLCJkdXBsaWNhdGVfcHJvdmlkZXIiLCJwYXJzZWQiLCJwYXJzZUhUTUwiLCIkY29udGFpbmVyIiwiYWRkQmFjayIsInRleHRDb250ZW50IiwiY29udGVudHMiLCJpbml0aWFsaXphdGlvbl9lcnJvciIsImZpbmlzaF9yZXF1ZXN0IiwicmVtb3ZlRGF0YSIsInJlc29sdmVfc3RhZ2UiLCJwcmV2aW91c19yZXF1ZXN0IiwiY29uZmlnX3Rva2VuIiwicmVwbGFjZW1lbnQiLCJwYXJhbXMiLCJhcHBvaW50bWVudF9zZXJ2aWNlX3JlcXVpcmVkIiwiYXBwb2ludG1lbnRfY29udGV4dF90b2tlbiIsImFwcG9pbnRtZW50X3NlcnZpY2VfaWQiLCJsb2FkZWRfcmVzb3VyY2VfaWQiLCJkdXBsaWNhdGUiLCJqUXVlcnkiXSwic291cmNlcyI6WyJpbmNsdWRlcy9ib29raW5nLWFwcG9pbnRtZW50L19zcmMvYm9va2luZy1hcHBvaW50bWVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIoIGZ1bmN0aW9uICggd2luZG93LCAkICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIGNvbmZpZyA9IHdpbmRvdy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfY29uZmlnIHx8IHt9O1xuXHR2YXIgYWN0aXZlX25hdGl2ZV9jb250ZXh0cyA9IHt9O1xuXHR2YXIgbG9hZGVkX3NjcmlwdF91cmxzID0ge307XG5cblx0JCggJ3NjcmlwdFtzcmNdJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRsb2FkZWRfc2NyaXB0X3VybHNbIFN0cmluZyggdGhpcy5zcmMgfHwgJycgKSBdID0gdHJ1ZTtcblx0fSApO1xuXG5cdC8qKiBSZXR1cm4gYSBub3JtYWxpemVkIGludGVnZXIgZnJvbSBhIHNlbGVjdG9yIGZpZWxkLiAqL1xuXHRmdW5jdGlvbiBnZXRfc2VsZWN0ZWRfaWQoICRmb3JtLCBuYW1lICkge1xuXHRcdHJldHVybiBOdW1iZXIoICRmb3JtLmZpbmQoICdbbmFtZT1cIicgKyBuYW1lICsgJ1wiXTpjaGVja2VkLCBbbmFtZT1cIicgKyBuYW1lICsgJ1wiXVt0eXBlPVwiaGlkZGVuXCJdJyApLmZpcnN0KCkudmFsKCkgfHwgMCApO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFwcGx5IHB1YmxpYyB0ZXh0IHNlYXJjaCB0byBvbmUgc2VydmVyLWF1dGhvcml6ZWQgQXBwb2ludG1lbnQgY2F0YWxvZy5cblx0ICpcblx0ICogQHBhcmFtIHtqUXVlcnl9ICRjYXRhbG9nIEFwcG9pbnRtZW50IGNhdGFsb2cgcm9vdC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGZpbHRlcl9hcHBvaW50bWVudF9jYXRhbG9nKCAkY2F0YWxvZyApIHtcblx0XHR2YXIgc2VhcmNoX3Rlcm0gPSBTdHJpbmcoICRjYXRhbG9nLmZpbmQoICdbZGF0YS13cGJjLWFwcG9pbnRtZW50LWNhdGFsb2ctc2VhcmNoXScgKS52YWwoKSB8fCAnJyApLnRvTG9jYWxlTG93ZXJDYXNlKCkudHJpbSgpO1xuXHRcdHZhciBjYXRhbG9nX3R5cGUgPSBTdHJpbmcoICRjYXRhbG9nLmF0dHIoICdkYXRhLWNhdGFsb2ctdHlwZScgKSB8fCAnc2VydmljZXMnICk7XG5cdFx0dmFyIHZpc2libGVfY291bnQgPSAwO1xuXG5cdFx0JGNhdGFsb2cuZmluZCggJ1tkYXRhLXdwYmMtYXBwb2ludG1lbnQtY2F0YWxvZy1jYXJkXScgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgJGNhcmQgPSAkKCB0aGlzICk7XG5cdFx0XHR2YXIgc2VhcmNoYWJsZV90ZXh0ID0gU3RyaW5nKCAkY2FyZC5hdHRyKCAnZGF0YS1hcHBvaW50bWVudC1jYXRhbG9nLXNlYXJjaCcgKSB8fCAnJyApLnRvTG9jYWxlTG93ZXJDYXNlKCk7XG5cdFx0XHR2YXIgaXNfdmlzaWJsZSA9ICEgc2VhcmNoX3Rlcm0gfHwgc2VhcmNoYWJsZV90ZXh0LmluZGV4T2YoIHNlYXJjaF90ZXJtICkgIT09IC0xO1xuXHRcdFx0dmFyICRjaG9pY2VfaW5wdXQgPSAkY2FyZC5maW5kKCAnaW5wdXRbdHlwZT1cInJhZGlvXCJdJyApLmZpcnN0KCk7XG5cblx0XHRcdCRjYXJkLnByb3AoICdoaWRkZW4nLCAhIGlzX3Zpc2libGUgKTtcblx0XHRcdCRjaG9pY2VfaW5wdXQucHJvcCggJ2Rpc2FibGVkJywgISBpc192aXNpYmxlICk7XG5cdFx0XHRpZiAoIGlzX3Zpc2libGUgKSB7XG5cdFx0XHRcdHZpc2libGVfY291bnQgKz0gMTtcblx0XHRcdH0gZWxzZSBpZiAoICRjaG9pY2VfaW5wdXQucHJvcCggJ2NoZWNrZWQnICkgKSB7XG5cdFx0XHRcdCRjaG9pY2VfaW5wdXQucHJvcCggJ2NoZWNrZWQnLCBmYWxzZSApO1xuXHRcdFx0XHQkY2FyZC5yZW1vdmVDbGFzcyggJ2lzLXNlbGVjdGVkJyApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblxuXHRcdCRjYXRhbG9nLmZpbmQoICdbZGF0YS13cGJjLWFwcG9pbnRtZW50LWNhdGFsb2ctZW1wdHldJyApLnByb3AoICdoaWRkZW4nLCAwICE9PSB2aXNpYmxlX2NvdW50ICk7XG5cdFx0JGNhdGFsb2cuZmluZCggJ1tkYXRhLXdwYmMtYXBwb2ludG1lbnQtY2F0YWxvZy1zdGF0dXNdJyApLnRleHQoXG5cdFx0XHRTdHJpbmcoIHZpc2libGVfY291bnQgKSArICcgJyArIChcblx0XHRcdFx0J3Byb3ZpZGVycycgPT09IGNhdGFsb2dfdHlwZVxuXHRcdFx0XHRcdD8gKCAxID09PSB2aXNpYmxlX2NvdW50ID8gKCBjb25maWcucHJvdmlkZXJfZm91bmQgfHwgJ1Byb3ZpZGVyIGZvdW5kLicgKSA6ICggY29uZmlnLnByb3ZpZGVyc19mb3VuZCB8fCAnUHJvdmlkZXJzIGZvdW5kLicgKSApXG5cdFx0XHRcdFx0OiAoIDEgPT09IHZpc2libGVfY291bnQgPyAoIGNvbmZpZy5zZXJ2aWNlX2ZvdW5kIHx8ICdTZXJ2aWNlIGZvdW5kLicgKSA6ICggY29uZmlnLnNlcnZpY2VzX2ZvdW5kIHx8ICdTZXJ2aWNlcyBmb3VuZC4nICkgKVxuXHRcdFx0KVxuXHRcdCk7XG5cdH1cblxuXHQvKiogVG9nZ2xlIG9uZSBjb21wb25lbnQgbG9hZGluZyBzdGF0ZSB3aXRob3V0IGNsZWFyaW5nIGl0cyBjdXJyZW50IHN0YWdlLiAqL1xuXHRmdW5jdGlvbiBzZXRfbG9hZGluZyggJHJvb3QsIGlzX2xvYWRpbmcgKSB7XG5cdFx0JHJvb3QudG9nZ2xlQ2xhc3MoICdpcy1sb2FkaW5nJywgaXNfbG9hZGluZyApLmF0dHIoICdhcmlhLWJ1c3knLCBpc19sb2FkaW5nID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdCRyb290LmZpbmQoICc+IC53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX3N0YWdlJyApLmF0dHIoICdhcmlhLWJ1c3knLCBpc19sb2FkaW5nID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdCRyb290LmZpbmQoICc+IC53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX2xvYWRpbmcnICkucHJvcCggJ2hpZGRlbicsICEgaXNfbG9hZGluZyApLmF0dHIoICdhcmlhLWhpZGRlbicsIGlzX2xvYWRpbmcgPyAnZmFsc2UnIDogJ3RydWUnICk7XG5cdFx0JHJvb3QuZmluZCggJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX3NlbGVjdGlvbl9mb3JtIDppbnB1dCcgKS5wcm9wKCAnZGlzYWJsZWQnLCBpc19sb2FkaW5nICk7XG5cdFx0aWYgKCAhIGlzX2xvYWRpbmcgKSB7XG5cdFx0XHQkcm9vdC5maW5kKCAnW2RhdGEtd3BiYy1hcHBvaW50bWVudC1jYXRhbG9nXScgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGZpbHRlcl9hcHBvaW50bWVudF9jYXRhbG9nKCAkKCB0aGlzICkgKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogRGlzcGxheSBhbmQgZm9jdXMgYW4gQUpBWCBvciBpbml0aWFsaXphdGlvbiBlcnJvciBpbiBvbmUgY29tcG9uZW50LlxuXHQgKlxuXHQgKiBAcGFyYW0ge2pRdWVyeX0gJHJvb3QgICAgICAgIEFwcG9pbnRtZW50IGNvbXBvbmVudCByb290LlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSAgICAgIEVycm9yIG1lc3NhZ2UuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBhY3Rpb25fdXJsICAgT3B0aW9uYWwgdHJ1c3RlZCBhZG1pbmlzdHJhdGlvbiBhY3Rpb24gVVJMLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gYWN0aW9uX2xhYmVsIE9wdGlvbmFsIGFjdGlvbiBsaW5rIGxhYmVsLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2hvd19lcnJvciggJHJvb3QsIG1lc3NhZ2UsIGFjdGlvbl91cmwsIGFjdGlvbl9sYWJlbCApIHtcblx0XHR2YXIgJG5vdGljZSA9ICRyb290LmZpbmQoICc+IC53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX2FqYXhfbm90aWNlJyApO1xuXHRcdCRub3RpY2UuZW1wdHkoKS5hcHBlbmQoICQoICc8c3Bhbj4nICkudGV4dCggbWVzc2FnZSB8fCBjb25maWcuZXJyb3IgfHwgJ1VuYWJsZSB0byBsb2FkIHRoZSBBcHBvaW50bWVudCBmb3JtLicgKSApO1xuXHRcdGlmICggYWN0aW9uX3VybCAmJiBhY3Rpb25fbGFiZWwgKSB7XG5cdFx0XHQkbm90aWNlLmFwcGVuZCggJyAnLCAkKCAnPGE+JywgeyAnY2xhc3MnOiAnd3BiY19ib29raW5nX2FwcG9pbnRtZW50X19ub3RpY2VfYWN0aW9uJywgaHJlZjogYWN0aW9uX3VybCwgdGV4dDogYWN0aW9uX2xhYmVsIH0gKSApO1xuXHRcdH1cblx0XHQkbm90aWNlLnByb3AoICdoaWRkZW4nLCBmYWxzZSApO1xuXHRcdGlmICggJG5vdGljZS5nZXQoIDAgKSAmJiB0eXBlb2YgJG5vdGljZS5nZXQoIDAgKS5mb2N1cyA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdCRub3RpY2UudHJpZ2dlciggJ2ZvY3VzJyApO1xuXHRcdH1cblx0fVxuXG5cdC8qKiBDbGVhciB0aGUgY29tcG9uZW50IEFKQVggZXJyb3IuICovXG5cdGZ1bmN0aW9uIGNsZWFyX2Vycm9yKCAkcm9vdCApIHtcblx0XHQkcm9vdC5maW5kKCAnPiAud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19hamF4X25vdGljZScgKS5lbXB0eSgpLnByb3AoICdoaWRkZW4nLCB0cnVlICk7XG5cdH1cblxuXHQvKiogUmV0dXJuIGEgcmVnaXN0ZXJlZCBuYXRpdmUgY29udGV4dCBvbmx5IHdoaWxlIGl0cyBET00gZWxlbWVudCBpcyBsaXZlLiAqL1xuXHRmdW5jdGlvbiBnZXRfbmF0aXZlX2NvbnRleHQoIHByb3ZpZGVyX2lkICkge1xuXHRcdHByb3ZpZGVyX2lkID0gTnVtYmVyKCBwcm92aWRlcl9pZCB8fCAwICk7XG5cdFx0dmFyIGNvbnRleHQgPSBhY3RpdmVfbmF0aXZlX2NvbnRleHRzWyBwcm92aWRlcl9pZCBdO1xuXHRcdGlmICggISBjb250ZXh0IHx8ICEgY29udGV4dC5lbGVtZW50IHx8ICEgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNvbnRhaW5zKCBjb250ZXh0LmVsZW1lbnQgKSApIHtcblx0XHRcdGRlbGV0ZSBhY3RpdmVfbmF0aXZlX2NvbnRleHRzWyBwcm92aWRlcl9pZCBdO1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHJldHVybiBjb250ZXh0O1xuXHR9XG5cblx0LyoqIERldGVjdCBhbm90aGVyIGxpdmUgbmF0aXZlIEJvb2tpbmcgQ2FsZW5kYXIgZm9ybSBmb3IgdGhlIHNhbWUgUHJvdmlkZXIuICovXG5cdGZ1bmN0aW9uIGhhc19kdXBsaWNhdGVfcHJvdmlkZXJfZm9ybSggJHJvb3QsIHByb3ZpZGVyX2lkICkge1xuXHRcdHByb3ZpZGVyX2lkID0gTnVtYmVyKCBwcm92aWRlcl9pZCB8fCAwICk7XG5cdFx0aWYgKCAhIHByb3ZpZGVyX2lkICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHZhciBjb250ZXh0ID0gZ2V0X25hdGl2ZV9jb250ZXh0KCBwcm92aWRlcl9pZCApO1xuXHRcdGlmICggY29udGV4dCAmJiAhICQuY29udGFpbnMoICRyb290LmdldCggMCApLCBjb250ZXh0LmVsZW1lbnQgKSApIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiAkKCAnW2lkPVwiYm9va2luZ19mb3JtJyArIHByb3ZpZGVyX2lkICsgJ1wiXScgKS5maWx0ZXIoIGZ1bmN0aW9uICgpIHtcblx0XHRcdHJldHVybiAhICQuY29udGFpbnMoICRyb290LmdldCggMCApLCB0aGlzICk7XG5cdFx0fSApLmxlbmd0aCA+IDA7XG5cdH1cblxuXHQvKiogUmVnaXN0ZXIgdGhlIGV4YWN0IHNpZ25lZCBuYXRpdmUgZm9ybSBjb250ZXh0IHVzZWQgYnkgYm9va2luZyBzdWJtaXNzaW9uLiAqL1xuXHRmdW5jdGlvbiByZWdpc3Rlcl9uYXRpdmVfZm9ybSggJG5hdGl2ZSApIHtcblx0XHR2YXIgcHJvdmlkZXJfaWQgPSBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3Byb3ZpZGVyLWlkJyApIHx8IDAgKTtcblx0XHR2YXIgc2VydmljZV9pZCA9IE51bWJlciggJG5hdGl2ZS5kYXRhKCAnc2VydmljZS1pZCcgKSB8fCAwICk7XG5cdFx0dmFyIGNvbnRleHRfdG9rZW4gPSBTdHJpbmcoICRuYXRpdmUuYXR0ciggJ2RhdGEtYXBwb2ludG1lbnQtY29udGV4dC10b2tlbicgKSB8fCAnJyApO1xuXHRcdHZhciBhbGxvd19wYXN0ID0gKCAnMScgPT09IFN0cmluZyggJG5hdGl2ZS5hdHRyKCAnZGF0YS1hbGxvdy1wYXN0JyApIHx8ICcwJyApICkgPyAxIDogMDtcblx0XHR2YXIgZXhpc3RpbmcgPSBnZXRfbmF0aXZlX2NvbnRleHQoIHByb3ZpZGVyX2lkICk7XG5cblx0XHRpZiAoICEgcHJvdmlkZXJfaWQgfHwgISBzZXJ2aWNlX2lkIHx8ICEgY29udGV4dF90b2tlbiApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKCBleGlzdGluZyAmJiBleGlzdGluZy5lbGVtZW50ICE9PSAkbmF0aXZlLmdldCggMCApICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGFjdGl2ZV9uYXRpdmVfY29udGV4dHNbIHByb3ZpZGVyX2lkIF0gPSB7XG5cdFx0XHRlbGVtZW50OiAkbmF0aXZlLmdldCggMCApLFxuXHRcdFx0c2VydmljZV9pZDogc2VydmljZV9pZCxcblx0XHRcdHByb3ZpZGVyX2lkOiBwcm92aWRlcl9pZCxcblx0XHRcdGNvbnRleHRfdG9rZW46IGNvbnRleHRfdG9rZW4sXG5cdFx0XHRhbGxvd19wYXN0OiBhbGxvd19wYXN0XG5cdFx0fTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKiBSZW1vdmUgYSBuYXRpdmUgZm9ybSBmcm9tIHRoZSBsb2NhbCBzdWJtaXNzaW9uLWNvbnRleHQgcmVnaXN0cnkuICovXG5cdGZ1bmN0aW9uIHVucmVnaXN0ZXJfbmF0aXZlX2Zvcm0oICRuYXRpdmUgKSB7XG5cdFx0dmFyIHByb3ZpZGVyX2lkID0gTnVtYmVyKCAkbmF0aXZlLmRhdGEoICdwcm92aWRlci1pZCcgKSB8fCAwICk7XG5cdFx0dmFyIGNvbnRleHQgPSBnZXRfbmF0aXZlX2NvbnRleHQoIHByb3ZpZGVyX2lkICk7XG5cdFx0aWYgKCBjb250ZXh0ICYmIGNvbnRleHQuZWxlbWVudCA9PT0gJG5hdGl2ZS5nZXQoIDAgKSApIHtcblx0XHRcdGRlbGV0ZSBhY3RpdmVfbmF0aXZlX2NvbnRleHRzWyBwcm92aWRlcl9pZCBdO1xuXHRcdH1cblx0fVxuXG5cdC8qKiBSZXR1cm4gdGhlIG5hdGl2ZSBTdGFydCBUaW1lIGZpZWxkIHVzZWQgYnkgdGhlIGZpeGVkIFNlcnZpY2UgZHVyYXRpb24uICovXG5cdGZ1bmN0aW9uIGdldF9zdGFydF90aW1lX2ZpZWxkKCAkbmF0aXZlICkge1xuXHRcdHZhciBwcm92aWRlcl9pZCA9IE51bWJlciggJG5hdGl2ZS5kYXRhKCAncHJvdmlkZXItaWQnICkgfHwgMCApO1xuXHRcdHJldHVybiAkbmF0aXZlLmZpbmQoICdbbmFtZT1cInN0YXJ0dGltZScgKyBwcm92aWRlcl9pZCArICdcIl0sIFtuYW1lPVwic3RhcnR0aW1lJyArIHByb3ZpZGVyX2lkICsgJ1tdXCJdJyApLm5vdCggJ1tkYXRhLXdwYmMtYm9va2luZy1zdWJtaXQtaWdub3JlPVwiMVwiXScgKS5maXJzdCgpO1xuXHR9XG5cblx0LyoqIFJldHVybiBzZWxlY3RlZCBjYWxlbmRhciBkYXRlcyBpbiB0aGUgc2VydmVyJ3Mgc3RyaWN0IFNRTC1kYXRlIGZvcm1hdC4gKi9cblx0ZnVuY3Rpb24gZ2V0X3NlbGVjdGVkX2RhdGVzKCAkbmF0aXZlICkge1xuXHRcdHZhciBwcm92aWRlcl9pZCA9IE51bWJlciggJG5hdGl2ZS5kYXRhKCAncHJvdmlkZXItaWQnICkgfHwgMCApO1xuXHRcdGlmICggcHJvdmlkZXJfaWQgJiYgdHlwZW9mIHdpbmRvdy53cGJjX2dldF9fc2VsZWN0ZWRfZGF0ZXNfc3FsX19hc19hcnIgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRyZXR1cm4gd2luZG93LndwYmNfZ2V0X19zZWxlY3RlZF9kYXRlc19zcWxfX2FzX2FyciggcHJvdmlkZXJfaWQgKTtcblx0XHR9XG5cblx0XHR2YXIgdmFsdWUgPSBTdHJpbmcoICRuYXRpdmUuZmluZCggJyNkYXRlX2Jvb2tpbmcnICsgcHJvdmlkZXJfaWQgKS52YWwoKSB8fCAnJyApO1xuXHRcdHJldHVybiB2YWx1ZS5zcGxpdCggJywnICkubWFwKCBmdW5jdGlvbiAoIGRhdGVfdmFsdWUgKSB7XG5cdFx0XHR2YXIgcGFydHMgPSAkLnRyaW0oIGRhdGVfdmFsdWUgKS5zcGxpdCggJy4nICk7XG5cdFx0XHRyZXR1cm4gMyA9PT0gcGFydHMubGVuZ3RoID8gcGFydHNbIDIgXSArICctJyArIHBhcnRzWyAxIF0gKyAnLScgKyBwYXJ0c1sgMCBdIDogJyc7XG5cdFx0fSApLmZpbHRlciggZnVuY3Rpb24gKCBkYXRlX3ZhbHVlICkge1xuXHRcdFx0cmV0dXJuIC9eXFxkezR9LVxcZHsyfS1cXGR7Mn0kLy50ZXN0KCBkYXRlX3ZhbHVlICk7XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIE5vcm1hbGl6ZSB0aGUgb25lLWRhdGUgc2VlZCBhY2NlcHRlZCBieSB0aGUgQXBwb2ludG1lbnQgY2FsZW5kYXIuXG5cdCAqXG5cdCAqIEFwcG9pbnRtZW50IGR1cmF0aW9uIHJlbWFpbnMgU2VydmljZS1vd25lZCwgc28gdGhlIGhhbmRvZmYgc2VlZHMgb25seSB0aGVcblx0ICogc3RhcnQgZGF0ZSBhbmQgbGV0cyB0aGUgZXhpc3RpbmcgYXZhaWxhYmlsaXR5IHJlcXVlc3QgdmFsaWRhdGUgaXRzIHRpbWUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gY2FsZW5kYXJfZGF0ZXMgQ2FuZGlkYXRlIEpTT04gZGF0ZSBjb2xsZWN0aW9uLlxuXHQgKiBAcmV0dXJuIHtBcnJheTxzdHJpbmc+fSBaZXJvIG9yIG9uZSB2YWxpZCBJU08gY2FsZW5kYXIgZGF0ZS5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9pbml0aWFsX2NhbGVuZGFyX2RhdGVzKCBjYWxlbmRhcl9kYXRlcyApIHtcblx0XHR2YXIgbm9ybWFsaXplZF9kYXRlcyA9IFtdO1xuXG5cdFx0aWYgKCAhIEFycmF5LmlzQXJyYXkoIGNhbGVuZGFyX2RhdGVzICkgKSB7XG5cdFx0XHRyZXR1cm4gbm9ybWFsaXplZF9kYXRlcztcblx0XHR9XG5cblx0XHRjYWxlbmRhcl9kYXRlcy5zb21lKCBmdW5jdGlvbiAoIGNhbGVuZGFyX2RhdGUgKSB7XG5cdFx0XHR2YXIgbm9ybWFsaXplZF9kYXRlID0gU3RyaW5nKCBjYWxlbmRhcl9kYXRlIHx8ICcnICk7XG5cdFx0XHR2YXIgZGF0ZV9wYXJ0cyA9IC9eKFxcZHs0fSktKFxcZHsyfSktKFxcZHsyfSkkLy5leGVjKCBub3JtYWxpemVkX2RhdGUgKTtcblx0XHRcdHZhciBuYXRpdmVfZGF0ZTtcblxuXHRcdFx0aWYgKCAhIGRhdGVfcGFydHMgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0bmF0aXZlX2RhdGUgPSBuZXcgRGF0ZShcblx0XHRcdFx0cGFyc2VJbnQoIGRhdGVfcGFydHNbMV0sIDEwICksXG5cdFx0XHRcdHBhcnNlSW50KCBkYXRlX3BhcnRzWzJdLCAxMCApIC0gMSxcblx0XHRcdFx0cGFyc2VJbnQoIGRhdGVfcGFydHNbM10sIDEwIClcblx0XHRcdCk7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdG5hdGl2ZV9kYXRlLmdldEZ1bGxZZWFyKCkgIT09IHBhcnNlSW50KCBkYXRlX3BhcnRzWzFdLCAxMCApIHx8XG5cdFx0XHRcdG5hdGl2ZV9kYXRlLmdldE1vbnRoKCkgIT09IHBhcnNlSW50KCBkYXRlX3BhcnRzWzJdLCAxMCApIC0gMSB8fFxuXHRcdFx0XHRuYXRpdmVfZGF0ZS5nZXREYXRlKCkgIT09IHBhcnNlSW50KCBkYXRlX3BhcnRzWzNdLCAxMCApXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRub3JtYWxpemVkX2RhdGVzLnB1c2goIG5vcm1hbGl6ZWRfZGF0ZSApO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIG5vcm1hbGl6ZWRfZGF0ZXM7XG5cdH1cblxuXHQvKipcblx0ICogUmVhZCB0aGUgc2lnbmVkLCBzZXJ2ZXItbm9ybWFsaXplZCBjYWxlbmRhciBzZWVkIHJlbmRlcmVkIGZvciBvbmUgZm9ybS5cblx0ICpcblx0ICogQHBhcmFtIHtqUXVlcnl9ICRuYXRpdmUgTmF0aXZlIEFwcG9pbnRtZW50IGZvcm0gd3JhcHBlci5cblx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IFByb3ZpZGVyIGFuZCBkYXRlIHNlZWQsIG9yIG51bGwgd2l0aG91dCBhIGhhbmRvZmYuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfaW5pdGlhbF9jYWxlbmRhcl9jb250ZXh0KCAkbmF0aXZlICkge1xuXHRcdHZhciBwcm92aWRlcl9pZCA9IE51bWJlciggJG5hdGl2ZS5kYXRhKCAncHJvdmlkZXItaWQnICkgfHwgMCApO1xuXHRcdHZhciBjYWxlbmRhcl9kYXRlcyA9IFtdO1xuXG5cdFx0aWYgKCAnMScgIT09IFN0cmluZyggJG5hdGl2ZS5hdHRyKCAnZGF0YS1wcmVzZWxlY3QtY2FsZW5kYXItZGF0ZXMnICkgfHwgJycgKSB8fCBwcm92aWRlcl9pZCA8PSAwICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGNhbGVuZGFyX2RhdGVzID0gSlNPTi5wYXJzZSggU3RyaW5nKCAkbmF0aXZlLmF0dHIoICdkYXRhLWluaXRpYWwtY2FsZW5kYXItZGF0ZXMnICkgfHwgJ1tdJyApICk7XG5cdFx0fSBjYXRjaCAoIGVycm9yICkge1xuXHRcdFx0Y2FsZW5kYXJfZGF0ZXMgPSBbXTtcblx0XHR9XG5cdFx0Y2FsZW5kYXJfZGF0ZXMgPSBub3JtYWxpemVfaW5pdGlhbF9jYWxlbmRhcl9kYXRlcyggY2FsZW5kYXJfZGF0ZXMgKTtcblxuXHRcdHJldHVybiBjYWxlbmRhcl9kYXRlcy5sZW5ndGggPyB7XG5cdFx0XHRwcm92aWRlcl9pZDogcHJvdmlkZXJfaWQsXG5cdFx0XHRpbml0aWFsX2RhdGVzOiBjYWxlbmRhcl9kYXRlc1xuXHRcdH0gOiBudWxsO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiBpc29sYXRlZCBvbmUtdGltZSBjYWxlbmRhciBoeWRyYXRpb24gc3RhdGUgZm9yIGEgbmF0aXZlIGZvcm0uXG5cdCAqXG5cdCAqIFRoZSBzdGF0ZSBwcmV2ZW50cyBkZWxheWVkIGRhdGVwaWNrZXIgaW5pdGlhbGl6YXRpb24gZnJvbSBvdmVyd3JpdGluZyBhXG5cdCAqIGRhdGUgdGhhdCB0aGUgYWRtaW5pc3RyYXRvciBzZWxlY3RlZCBtYW51YWxseSBhZnRlciB0aGUgZm9ybSByZW5kZXJlZC5cblx0ICpcblx0ICogQHBhcmFtIHtqUXVlcnl9ICRuYXRpdmUgTmF0aXZlIEFwcG9pbnRtZW50IGZvcm0gd3JhcHBlci5cblx0ICogQHJldHVybiB7T2JqZWN0fSBNdXRhYmxlIGh5ZHJhdGlvbiBzdGF0ZSBvd25lZCBieSB0aGUgbmF0aXZlIGZvcm0gZWxlbWVudC5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9pbml0aWFsX2NhbGVuZGFyX3N0YXRlKCAkbmF0aXZlICkge1xuXHRcdHZhciBuYXRpdmVfZWxlbWVudCA9ICRuYXRpdmUuZ2V0KCAwICk7XG5cblx0XHRpZiAoICEgbmF0aXZlX2VsZW1lbnQud3BiY19hcHBvaW50bWVudF9pbml0aWFsX2NhbGVuZGFyX3N0YXRlICkge1xuXHRcdFx0bmF0aXZlX2VsZW1lbnQud3BiY19hcHBvaW50bWVudF9pbml0aWFsX2NhbGVuZGFyX3N0YXRlID0ge1xuXHRcdFx0XHRhcHBsaWVkOiBmYWxzZSxcblx0XHRcdFx0Y2FuY2VsbGVkOiBmYWxzZSxcblx0XHRcdFx0YXBwbHlpbmc6IGZhbHNlLFxuXHRcdFx0XHRjYWxlbmRhcl9kYXRhX2xvYWRlZDogZmFsc2UsXG5cdFx0XHRcdGF0dGVtcHRzOiAwLFxuXHRcdFx0XHRzY2hlZHVsZWQ6IGZhbHNlXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHJldHVybiBuYXRpdmVfZWxlbWVudC53cGJjX2FwcG9pbnRtZW50X2luaXRpYWxfY2FsZW5kYXJfc3RhdGU7XG5cdH1cblxuXHQvKipcblx0ICogU2VlZCB0aGUgdmlzaWJsZSBuYXRpdmUgY2FsZW5kYXIgYWZ0ZXIgaXRzIGF2YWlsYWJpbGl0eSBkYXRhIGlzIHJlYWR5LlxuXHQgKlxuXHQgKiBUaGUgY2Fub25pY2FsIGNhbGVuZGFyIGhlbHBlciBzZWxlY3RzIHRocm91Z2ggdGhlIERhdGVwaWNrIGludGVyYWN0aW9uXG5cdCAqIHBhdGgsIHByZXNlcnZpbmcgYXZhaWxhYmlsaXR5IHJ1bGVzLCB2aXN1YWwgc2VsZWN0aW9uLCBhbmQgdGhlIG5vcm1hbFxuXHQgKiBkYXRlLXNlbGVjdGVkIGV2ZW50LiBXYWl0aW5nIGZvciB0aGUgY29yZSBBSkFYIGNvbXBsZXRpb24gcHJldmVudHMgaXRzXG5cdCAqIGxhdGVyIGNhbGVuZGFyIHJlZHJhdyBmcm9tIHJlbW92aW5nIHRoZSB2aXNpYmxlIHNlbGVjdGVkIGRhdGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7alF1ZXJ5fSAkbmF0aXZlIE5hdGl2ZSBBcHBvaW50bWVudCBmb3JtIHdyYXBwZXIuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgYWZ0ZXIgdGhlIHJlcXVlc3RlZCBkYXRlIHdhcyBhcHBsaWVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gYXBwbHlfaW5pdGlhbF9jYWxlbmRhcl9kYXRlcyggJG5hdGl2ZSApIHtcblx0XHR2YXIgaW5pdGlhbF9jb250ZXh0ID0gZ2V0X2luaXRpYWxfY2FsZW5kYXJfY29udGV4dCggJG5hdGl2ZSApO1xuXHRcdHZhciBzdGF0ZSA9IGdldF9pbml0aWFsX2NhbGVuZGFyX3N0YXRlKCAkbmF0aXZlICk7XG5cdFx0dmFyICRkYXRlX2ZpZWxkO1xuXHRcdHZhciBzZWxlY3RlZF9kYXRlc19jb3VudCA9IDA7XG5cblx0XHRpZiAoIHN0YXRlLmFwcGxpZWQgfHwgc3RhdGUuY2FuY2VsbGVkIHx8ICEgc3RhdGUuY2FsZW5kYXJfZGF0YV9sb2FkZWQgfHwgISBpbml0aWFsX2NvbnRleHQgKSB7XG5cdFx0XHRyZXR1cm4gc3RhdGUuYXBwbGllZDtcblx0XHR9XG5cdFx0aWYgKCAhIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jb250YWlucyggJG5hdGl2ZS5nZXQoIDAgKSApICkge1xuXHRcdFx0c3RhdGUuY2FuY2VsbGVkID0gdHJ1ZTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LndwYmNfYXV0b19zZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXIgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0JGRhdGVfZmllbGQgPSAkbmF0aXZlLmZpbmQoICcjZGF0ZV9ib29raW5nJyArIGluaXRpYWxfY29udGV4dC5wcm92aWRlcl9pZCApLmZpcnN0KCk7XG5cdFx0aWYgKCAhICRkYXRlX2ZpZWxkLmxlbmd0aCApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoIFN0cmluZyggJGRhdGVfZmllbGQudmFsKCkgfHwgJycgKS50cmltKCkgKSB7XG5cdFx0XHRzdGF0ZS5jYW5jZWxsZWQgPSB0cnVlO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHN0YXRlLmFwcGx5aW5nID0gdHJ1ZTtcblx0XHR0cnkge1xuXHRcdFx0c2VsZWN0ZWRfZGF0ZXNfY291bnQgPSB3aW5kb3cud3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhcihcblx0XHRcdFx0aW5pdGlhbF9jb250ZXh0LnByb3ZpZGVyX2lkLFxuXHRcdFx0XHRpbml0aWFsX2NvbnRleHQuaW5pdGlhbF9kYXRlc1swXVxuXHRcdFx0KTtcblx0XHRcdHN0YXRlLmFwcGxpZWQgPSAwIDwgc2VsZWN0ZWRfZGF0ZXNfY291bnQ7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHN0YXRlLmFwcGx5aW5nID0gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN0YXRlLmFwcGxpZWQ7XG5cdH1cblxuXHQvKipcblx0ICogUmV0cnkgY2FsZW5kYXIgaHlkcmF0aW9uIG9ubHkgd2hpbGUgdGhlIG1hdGNoaW5nIG5hdGl2ZSBmb3JtIGlzIGxpdmUuXG5cdCAqXG5cdCAqIFRoZSBCb29raW5nIENhbGVuZGFyIGRhdGVwaWNrZXIgY2FuIGluaXRpYWxpemUgYWZ0ZXIgdGhlIEFwcG9pbnRtZW50IHN0YWdlXG5cdCAqIG1hcmt1cCwgc28gdGhlIHNpZ25lZCBzZWVkIGlzIHJldHJpZWQgZm9yIGEgYm91bmRlZCBwZXJpb2Qgd2l0aG91dCBwb2xsaW5nXG5cdCAqIGFmdGVyIHRoZSBmb3JtIGhhcyBiZWVuIHJlcGxhY2VkIG9yIHRoZSBhZG1pbmlzdHJhdG9yIGhhcyBjaG9zZW4gYSBkYXRlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge2pRdWVyeX0gJG5hdGl2ZSBOYXRpdmUgQXBwb2ludG1lbnQgZm9ybSB3cmFwcGVyLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2NoZWR1bGVfaW5pdGlhbF9jYWxlbmRhcl9kYXRlcyggJG5hdGl2ZSApIHtcblx0XHR2YXIgc3RhdGUgPSBnZXRfaW5pdGlhbF9jYWxlbmRhcl9zdGF0ZSggJG5hdGl2ZSApO1xuXG5cdFx0aWYgKFxuXHRcdFx0c3RhdGUuYXBwbGllZCB8fFxuXHRcdFx0c3RhdGUuY2FuY2VsbGVkIHx8XG5cdFx0XHRzdGF0ZS5zY2hlZHVsZWQgfHxcblx0XHRcdCEgc3RhdGUuY2FsZW5kYXJfZGF0YV9sb2FkZWQgfHxcblx0XHRcdCEgZ2V0X2luaXRpYWxfY2FsZW5kYXJfY29udGV4dCggJG5hdGl2ZSApXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0c3RhdGUuc2NoZWR1bGVkID0gdHJ1ZTtcblx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRzdGF0ZS5zY2hlZHVsZWQgPSBmYWxzZTtcblx0XHRcdHN0YXRlLmF0dGVtcHRzKys7XG5cdFx0XHRpZiAoIGFwcGx5X2luaXRpYWxfY2FsZW5kYXJfZGF0ZXMoICRuYXRpdmUgKSB8fCBzdGF0ZS5jYW5jZWxsZWQgfHwgc3RhdGUuYXR0ZW1wdHMgPj0gMTIgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0d2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0c2NoZWR1bGVfaW5pdGlhbF9jYWxlbmRhcl9kYXRlcyggJG5hdGl2ZSApO1xuXHRcdFx0fSwgMTAwICk7XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIEF0dGFjaCBvbmUtdGltZSBzZWVkIGJlaGF2aW9yIHdoaWxlIHByZXNlcnZpbmcgYSBmYXN0ZXIgbWFudWFsIGNob2ljZS5cblx0ICpcblx0ICogQHBhcmFtIHtqUXVlcnl9ICRuYXRpdmUgTmF0aXZlIEFwcG9pbnRtZW50IGZvcm0gd3JhcHBlci5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGluaXRpYWxpemVfaW5pdGlhbF9jYWxlbmRhcl9kYXRlcyggJG5hdGl2ZSApIHtcblx0XHR2YXIgaW5pdGlhbF9jb250ZXh0ID0gZ2V0X2luaXRpYWxfY2FsZW5kYXJfY29udGV4dCggJG5hdGl2ZSApO1xuXG5cdFx0aWYgKCAhIGluaXRpYWxfY29udGV4dCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQkbmF0aXZlLm9mZiggJ2RhdGVfc2VsZWN0ZWQud3BiY19ib29raW5nX2FwcG9pbnRtZW50X2luaXRpYWxfZGF0ZXMnICkub24oXG5cdFx0XHQnZGF0ZV9zZWxlY3RlZC53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfaW5pdGlhbF9kYXRlcycsXG5cdFx0XHRmdW5jdGlvbiAoIGV2ZW50LCBwcm92aWRlcl9pZCApIHtcblx0XHRcdFx0dmFyIHN0YXRlID0gZ2V0X2luaXRpYWxfY2FsZW5kYXJfc3RhdGUoICRuYXRpdmUgKTtcblxuXHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0TnVtYmVyKCBwcm92aWRlcl9pZCB8fCAwICkgPT09IGluaXRpYWxfY29udGV4dC5wcm92aWRlcl9pZCAmJlxuXHRcdFx0XHRcdCEgc3RhdGUuYXBwbHlpbmcgJiZcblx0XHRcdFx0XHQhIHN0YXRlLmFwcGxpZWQgJiZcblx0XHRcdFx0XHRnZXRfc2VsZWN0ZWRfZGF0ZXMoICRuYXRpdmUgKS5sZW5ndGhcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0c3RhdGUuY2FuY2VsbGVkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdCk7XG5cdFx0c2NoZWR1bGVfaW5pdGlhbF9jYWxlbmRhcl9kYXRlcyggJG5hdGl2ZSApO1xuXHR9XG5cblx0LyoqIFJlYWQgdGhlIGN1cnJlbnQgZGF0ZS9zdGFydCBzZWxlY3Rpb24gYW5kIGl0cyBzdGFibGUgcmVxdWVzdCBzaWduYXR1cmUuICovXG5cdGZ1bmN0aW9uIGdldF90aW1lX3NlbGVjdGlvbiggJG5hdGl2ZSApIHtcblx0XHR2YXIgJHN0YXJ0ID0gZ2V0X3N0YXJ0X3RpbWVfZmllbGQoICRuYXRpdmUgKTtcblx0XHR2YXIgZGF0ZXMgPSBnZXRfc2VsZWN0ZWRfZGF0ZXMoICRuYXRpdmUgKTtcblx0XHR2YXIgc3RhcnRfdGltZSA9ICRzdGFydC5sZW5ndGggPyBTdHJpbmcoICRzdGFydC52YWwoKSB8fCAnJyApIDogJyc7XG5cdFx0cmV0dXJuIHtcblx0XHRcdCRzdGFydDogJHN0YXJ0LFxuXHRcdFx0ZGF0ZXM6IGRhdGVzLFxuXHRcdFx0c3RhcnRfdGltZTogc3RhcnRfdGltZSxcblx0XHRcdGNvbXBsZXRlOiAhISAoIGRhdGVzLmxlbmd0aCAmJiAvXlxcZHsxLDJ9OlxcZHsyfSg/OjpcXGR7Mn0pPyQvLnRlc3QoIHN0YXJ0X3RpbWUgKSApLFxuXHRcdFx0c2lnbmF0dXJlOiBkYXRlcy5qb2luKCAnLCcgKSArICd8JyArIHN0YXJ0X3RpbWVcblx0XHR9O1xuXHR9XG5cblx0LyoqIERldGVybWluZSB3aGV0aGVyIHRoZSBTdGFydCBUaW1lIGZpZWxkIGJlbG9uZ3MgdG8gdGhlIHZpc2libGUgd2l6YXJkIHN0ZXAuICovXG5cdGZ1bmN0aW9uIGlzX3RpbWVfc2VsZWN0aW9uX3N0YWdlX2FjdGl2ZSggc2VsZWN0aW9uICkge1xuXHRcdHZhciAkc3RlcCA9IHNlbGVjdGlvbi4kc3RhcnQuY2xvc2VzdCggJy53cGJjX3dpemFyZF9zdGVwJyApO1xuXHRcdHJldHVybiAhICRzdGVwLmxlbmd0aCB8fCAoICRzdGVwLmlzKCAnOnZpc2libGUnICkgJiYgISAkc3RlcC5oYXNDbGFzcyggJ3dwYmNfd2l6YXJkX3N0ZXBfaGlkZGVuJyApICk7XG5cdH1cblxuXHQvKiogRmluZCB0aGUgdmlzaWJsZSBTdGFydCBUaW1lIFVJIGJlbmVhdGggd2hpY2ggdmFsaWRhdGlvbiBpcyBleHBsYWluZWQuICovXG5cdGZ1bmN0aW9uIGdldF90aW1lX25vdGljZV9hbmNob3IoIHNlbGVjdGlvbiApIHtcblx0XHR2YXIgJHBpY2tlciA9IHNlbGVjdGlvbi4kc3RhcnQubmV4dEFsbCggJy53cGJjX3RpbWVzX3NlbGVjdG9yJyApLmZpcnN0KCk7XG5cdFx0cmV0dXJuICRwaWNrZXIubGVuZ3RoID8gJHBpY2tlciA6IHNlbGVjdGlvbi4kc3RhcnQ7XG5cdH1cblxuXHQvKiogUmVtb3ZlIHRoZSBBcHBvaW50bWVudCBidWZmZXIgd2FybmluZyBhbmQgaW52YWxpZCBmaWVsZCBzZW1hbnRpY3MuICovXG5cdGZ1bmN0aW9uIGNsZWFyX3RpbWVfbm90aWNlKCAkbmF0aXZlICkge1xuXHRcdCRuYXRpdmUuZmluZCggJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX3RpbWVfbm90aWNlJyApLnJlbW92ZSgpO1xuXHRcdGdldF9zdGFydF90aW1lX2ZpZWxkKCAkbmF0aXZlICkucmVtb3ZlQXR0ciggJ2FyaWEtaW52YWxpZCcgKS5uZXh0QWxsKCAnLndwYmNfdGltZXNfc2VsZWN0b3InICkuZmlyc3QoKS5yZW1vdmVBdHRyKCAnYXJpYS1pbnZhbGlkJyApO1xuXHR9XG5cblx0LyoqIFNob3cgYSBwZXJzaXN0ZW50IHdhcm5pbmcgdXNpbmcgQm9va2luZyBDYWxlbmRhcidzIGZyb250ZW5kIG1lc3NhZ2UgVUkuICovXG5cdGZ1bmN0aW9uIHNob3dfdGltZV9ub3RpY2UoICRuYXRpdmUsIHNlbGVjdGlvbiwgbWVzc2FnZSApIHtcblx0XHRjbGVhcl90aW1lX25vdGljZSggJG5hdGl2ZSApO1xuXHRcdHZhciAkYW5jaG9yID0gZ2V0X3RpbWVfbm90aWNlX2FuY2hvciggc2VsZWN0aW9uICk7XG5cdFx0aWYgKCAhICRhbmNob3IubGVuZ3RoICkge1xuXHRcdFx0JGFuY2hvciA9ICRuYXRpdmUuZmluZCggJy5ia19jYWxlbmRhcl9mcmFtZScgKS5maXJzdCgpO1xuXHRcdH1cblx0XHRpZiAoICEgJGFuY2hvci5sZW5ndGggKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0c2VsZWN0aW9uLiRzdGFydC5hdHRyKCAnYXJpYS1pbnZhbGlkJywgJ3RydWUnICkubmV4dEFsbCggJy53cGJjX3RpbWVzX3NlbGVjdG9yJyApLmZpcnN0KCkuYXR0ciggJ2FyaWEtaW52YWxpZCcsICd0cnVlJyApO1xuXHRcdCQoICc8ZGl2PicsIHtcblx0XHRcdCdjbGFzcyc6ICd3cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX3RpbWVfbm90aWNlIHdwYmNfZnJvbnRfZW5kX19tZXNzYWdlIHdwYmNfZmVfbWVzc2FnZSB3cGJjX2ZlX21lc3NhZ2Vfd2FybmluZycsXG5cdFx0XHRyb2xlOiAnYWxlcnQnXG5cdFx0fSApLmFwcGVuZCggJCggJzxpPicsIHsgJ2NsYXNzJzogJ21lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX3dhcm5pbmcnLCAnYXJpYS1oaWRkZW4nOiAndHJ1ZScgfSApIClcblx0XHRcdC5hcHBlbmQoICQoICc8c3Bhbj4nICkudGV4dCggbWVzc2FnZSB8fCBjb25maWcudmFsaWRhdGlvbl9lcnJvciB8fCBjb25maWcuZXJyb3IgKSApXG5cdFx0XHQuaW5zZXJ0QWZ0ZXIoICRhbmNob3IgKTtcblx0fVxuXG5cdC8qKiBSZXR1cm4gb3IgaW5pdGlhbGl6ZSB0aGUgdmFsaWRhdGlvbiBzdGF0ZSBvd25lZCBieSBvbmUgbmF0aXZlIGZvcm0uICovXG5cdGZ1bmN0aW9uIGdldF90aW1lX3ZhbGlkYXRpb25fc3RhdGUoICRuYXRpdmUgKSB7XG5cdFx0dmFyIHN0YXRlID0gJG5hdGl2ZS5kYXRhKCAnd3BiYy1hcHBvaW50bWVudC10aW1lLXZhbGlkYXRpb24nICk7XG5cdFx0aWYgKCAhIHN0YXRlICkge1xuXHRcdFx0c3RhdGUgPSB7XG5cdFx0XHRcdHNlcXVlbmNlOiAwLFxuXHRcdFx0XHRzaWduYXR1cmU6ICcnLFxuXHRcdFx0XHRzdGF0dXM6ICdpbmNvbXBsZXRlJyxcblx0XHRcdFx0cmVxdWVzdDogbnVsbCxcblx0XHRcdFx0cHJvbWlzZTogbnVsbCxcblx0XHRcdFx0dGltZXI6IG51bGwsXG5cdFx0XHRcdGF2YWlsYWJpbGl0eV9zZXF1ZW5jZTogMCxcblx0XHRcdFx0YXZhaWxhYmlsaXR5X3JlcXVlc3Q6IG51bGwsXG5cdFx0XHRcdGF2YWlsYWJpbGl0eV90aW1lcjogbnVsbCxcblx0XHRcdFx0YXZhaWxhYmxlX3Nsb3RzOiB7fVxuXHRcdFx0fTtcblx0XHRcdCRuYXRpdmUuZGF0YSggJ3dwYmMtYXBwb2ludG1lbnQtdGltZS12YWxpZGF0aW9uJywgc3RhdGUgKTtcblx0XHR9XG5cdFx0cmV0dXJuIHN0YXRlO1xuXHR9XG5cblx0LyoqIFJlc3RvcmUgb25seSBvcHRpb24gc3RhdGUgcHJldmlvdXNseSBvd25lZCBieSB0aGUgQXBwb2ludG1lbnQgZmlsdGVyLiAqL1xuXHRmdW5jdGlvbiBjbGVhcl9hcHBvaW50bWVudF9kaXNhYmxlZF90aW1lcyggJHN0YXJ0ICkge1xuXHRcdCRzdGFydC5maW5kKCAnb3B0aW9uW2RhdGEtd3BiYy1hcHBvaW50bWVudC11bmF2YWlsYWJsZT1cIjFcIl0nICkuZWFjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyICRvcHRpb24gPSAkKCB0aGlzICk7XG5cdFx0XHRpZiAoICEgJG9wdGlvbi5oYXNDbGFzcyggJ2Jvb2tlZCcgKSApIHtcblx0XHRcdFx0JG9wdGlvbi5wcm9wKCAnZGlzYWJsZWQnLCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdFx0JG9wdGlvbi5yZW1vdmVBdHRyKCAnZGF0YS13cGJjLWFwcG9pbnRtZW50LXVuYXZhaWxhYmxlJyApO1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKiBSZWJ1aWxkIHRoZSBvcHRpb25hbCBwbGF0ZS1zdHlsZSBwaWNrZXIgZnJvbSB0aGUgZmlsdGVyZWQgbmF0aXZlIHNlbGVjdC4gKi9cblx0ZnVuY3Rpb24gcmVmcmVzaF9zdGFydF90aW1lX3BpY2tlciggJHN0YXJ0ICkge1xuXHRcdGlmICggJHN0YXJ0Lmxlbmd0aCAmJiB0eXBlb2YgJHN0YXJ0LndwYmNfdGltZXNlbGVjdG9yID09PSAnZnVuY3Rpb24nICYmICRzdGFydC5uZXh0QWxsKCAnLndwYmNfdGltZXNfc2VsZWN0b3InICkubGVuZ3RoICkge1xuXHRcdFx0JHN0YXJ0LndwYmNfdGltZXNlbGVjdG9yKCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqIFJlYWQgYWxsIG9wdGlvbnMgc3RpbGwgYWxsb3dlZCBieSB0aGUgb3JkaW5hcnkgQm9va2luZyBDYWxlbmRhciBlbmdpbmUuICovXG5cdGZ1bmN0aW9uIGdldF9jb3JlX2F2YWlsYWJsZV9zdGFydF90aW1lcyggJHN0YXJ0ICkge1xuXHRcdHZhciB2YWx1ZXMgPSBbXTtcblx0XHQkc3RhcnQuZmluZCggJ29wdGlvbicgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgJG9wdGlvbiA9ICQoIHRoaXMgKTtcblx0XHRcdHZhciB2YWx1ZSA9IFN0cmluZyggJG9wdGlvbi52YWwoKSB8fCAnJyApO1xuXHRcdFx0dmFyIGFwcG9pbnRtZW50X2Rpc2FibGVkID0gJzEnID09PSBTdHJpbmcoICRvcHRpb24uYXR0ciggJ2RhdGEtd3BiYy1hcHBvaW50bWVudC11bmF2YWlsYWJsZScgKSB8fCAnJyApO1xuXHRcdFx0aWYgKCAvXlxcZHsxLDJ9OlxcZHsyfSg/OjpcXGR7Mn0pPyQvLnRlc3QoIHZhbHVlICkgJiYgKCAhICRvcHRpb24ucHJvcCggJ2Rpc2FibGVkJyApIHx8ICggYXBwb2ludG1lbnRfZGlzYWJsZWQgJiYgISAkb3B0aW9uLmhhc0NsYXNzKCAnYm9va2VkJyApICkgKSApIHtcblx0XHRcdFx0dmFsdWVzLnB1c2goIHZhbHVlICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdHJldHVybiB2YWx1ZXM7XG5cdH1cblxuXHQvKiogQ29udmVydCBhIGJyb3dzZXIgdGltZSBzdHJpbmcgdG8gbWludXRlcyBmcm9tIHRoZSBzdGFydCBvZiBpdHMgZGF5LiAqL1xuXHRmdW5jdGlvbiBkZWJ1Z190aW1lX3RvX21pbnV0ZXMoIHRpbWVfdmFsdWUgKSB7XG5cdFx0dmFyIHBhcnRzID0gU3RyaW5nKCB0aW1lX3ZhbHVlIHx8ICcnICkuc3BsaXQoICc6JyApO1xuXHRcdGlmICggcGFydHMubGVuZ3RoIDwgMiApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4gKCBOdW1iZXIoIHBhcnRzWyAwIF0gKSAqIDYwICkgKyBOdW1iZXIoIHBhcnRzWyAxIF0gKTtcblx0fVxuXG5cdC8qKiBGb3JtYXQgZGVidWcgdGltZSB3aGlsZSByZXRhaW5pbmcgYSBwcmV2aW91cy9uZXh0LWRheSBib3VuZGFyeS4gKi9cblx0ZnVuY3Rpb24gZGVidWdfZm9ybWF0X21pbnV0ZXMoIHRvdGFsX21pbnV0ZXMgKSB7XG5cdFx0dmFyIGRheV9vZmZzZXQgPSAwO1xuXHRcdHdoaWxlICggdG90YWxfbWludXRlcyA8IDAgKSB7XG5cdFx0XHR0b3RhbF9taW51dGVzICs9IDE0NDA7XG5cdFx0XHRkYXlfb2Zmc2V0LS07XG5cdFx0fVxuXHRcdHdoaWxlICggdG90YWxfbWludXRlcyA+PSAxNDQwICkge1xuXHRcdFx0dG90YWxfbWludXRlcyAtPSAxNDQwO1xuXHRcdFx0ZGF5X29mZnNldCsrO1xuXHRcdH1cblx0XHR2YXIgaG91cnMgPSAoICcwJyArIE1hdGguZmxvb3IoIHRvdGFsX21pbnV0ZXMgLyA2MCApICkuc2xpY2UoIC0yICk7XG5cdFx0dmFyIG1pbnV0ZXMgPSAoICcwJyArICggdG90YWxfbWludXRlcyAlIDYwICkgKS5zbGljZSggLTIgKTtcblx0XHRyZXR1cm4gaG91cnMgKyAnOicgKyBtaW51dGVzICsgKCBkYXlfb2Zmc2V0ID8gJyAoJyArICggZGF5X29mZnNldCA+IDAgPyAnKycgOiAnJyApICsgZGF5X29mZnNldCArICcgZGF5KScgOiAnJyApO1xuXHR9XG5cblx0LyoqIEV4cGxhaW4gdGhlIGFzeW5jaHJvbm91cyBTZXJ2aWNlLWF3YXJlIGF2YWlsYWJpbGl0eSBwYXNzIGluIHRoZSBjb25zb2xlLiAqL1xuXHRmdW5jdGlvbiBsb2dfc3RhcnRfdGltZV9maWx0ZXJfcmVxdWVzdCggJG5hdGl2ZSwgZGF0ZXMsIHN0YXJ0X3RpbWVzICkge1xuXHRcdGlmICggISB3aW5kb3cuY29uc29sZSB8fCB0eXBlb2Ygd2luZG93LmNvbnNvbGUuaW5mbyAhPT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0d2luZG93LmNvbnNvbGUuaW5mbyhcblx0XHRcdCdbQm9va2luZyBDYWxlbmRhciBBcHBvaW50bWVudF0gUmVjaGVja2luZyBTdGFydCBUaW1lcyB3aXRoIFNlcnZpY2UgZHVyYXRpb24gYW5kIGJ1ZmZlcnMuIFRoZSBpbml0aWFsIGxpc3QgY29tZXMgZnJvbSBQcm92aWRlciBjYWxlbmRhciBhdmFpbGFiaWxpdHkgYW5kIG1heSBub3cgYmUgcmVkdWNlZC4nLFxuXHRcdFx0e1xuXHRcdFx0XHRzZXJ2aWNlX2lkOiBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3NlcnZpY2UtaWQnICkgfHwgMCApLFxuXHRcdFx0XHRwcm92aWRlcl9pZDogTnVtYmVyKCAkbmF0aXZlLmRhdGEoICdwcm92aWRlci1pZCcgKSB8fCAwICksXG5cdFx0XHRcdGRhdGVzOiBkYXRlcy5zbGljZSggMCApLFxuXHRcdFx0XHRpbml0aWFsX3N0YXJ0X3RpbWVzOiBzdGFydF90aW1lcy5zbGljZSggMCApXG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdC8qKiBMb2cgb25seSBzY2hlZHVsaW5nIGRhdGEgbmVlZGVkIHRvIHVuZGVyc3RhbmQgcmVtb3ZlZCBTdGFydCBUaW1lcy4gKi9cblx0ZnVuY3Rpb24gbG9nX3N0YXJ0X3RpbWVfZmlsdGVyX3Jlc3VsdCggJG5hdGl2ZSwgZGF0ZXMsIGRhdGEgKSB7XG5cdFx0aWYgKCAhIHdpbmRvdy5jb25zb2xlIHx8IHR5cGVvZiB3aW5kb3cuY29uc29sZS5pbmZvICE9PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR2YXIgYnVmZmVyX2JlZm9yZSA9IE51bWJlciggZGF0YS5idWZmZXJfYmVmb3JlIHx8IDAgKTtcblx0XHR2YXIgYnVmZmVyX2FmdGVyID0gTnVtYmVyKCBkYXRhLmJ1ZmZlcl9hZnRlciB8fCAwICk7XG5cdFx0dmFyIGJsb2NrZWQgPSBbXTtcblx0XHRPYmplY3Qua2V5cyggZGF0YS5zbG90cyB8fCB7fSApLmZvckVhY2goIGZ1bmN0aW9uICggc3RhcnRfdGltZSApIHtcblx0XHRcdHZhciByZXN1bHQgPSBkYXRhLnNsb3RzWyBzdGFydF90aW1lIF07XG5cdFx0XHRpZiAoICEgcmVzdWx0IHx8IGZhbHNlICE9PSByZXN1bHQudmFsaWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHZhciBlbmRfdGltZSA9IFN0cmluZyggcmVzdWx0LmVuZF90aW1lIHx8ICcnICk7XG5cdFx0XHR2YXIgc3RhcnRfbWludXRlcyA9IGRlYnVnX3RpbWVfdG9fbWludXRlcyggc3RhcnRfdGltZSApO1xuXHRcdFx0dmFyIGVuZF9taW51dGVzID0gZGVidWdfdGltZV90b19taW51dGVzKCBlbmRfdGltZSApO1xuXHRcdFx0YmxvY2tlZC5wdXNoKCB7XG5cdFx0XHRcdHN0YXJ0X3RpbWU6IHN0YXJ0X3RpbWUsXG5cdFx0XHRcdGFwcG9pbnRtZW50X3RpbWU6IGVuZF90aW1lID8gc3RhcnRfdGltZSArICcgLSAnICsgZW5kX3RpbWUgOiBzdGFydF90aW1lLFxuXHRcdFx0XHRwcm92aWRlcl9yZXNlcnZlZDogbnVsbCAhPT0gc3RhcnRfbWludXRlcyAmJiBudWxsICE9PSBlbmRfbWludXRlc1xuXHRcdFx0XHRcdD8gZGVidWdfZm9ybWF0X21pbnV0ZXMoIHN0YXJ0X21pbnV0ZXMgLSBidWZmZXJfYmVmb3JlICkgKyAnIC0gJyArIGRlYnVnX2Zvcm1hdF9taW51dGVzKCBlbmRfbWludXRlcyArIGJ1ZmZlcl9hZnRlciApXG5cdFx0XHRcdFx0OiAnJyxcblx0XHRcdFx0cmVhc29uOiByZXN1bHQubWVzc2FnZSB8fCByZXN1bHQuY29kZSB8fCBjb25maWcudmFsaWRhdGlvbl9lcnJvclxuXHRcdFx0fSApO1xuXHRcdH0gKTtcblxuXHRcdHdpbmRvdy5jb25zb2xlLmluZm8oXG5cdFx0XHQnW0Jvb2tpbmcgQ2FsZW5kYXIgQXBwb2ludG1lbnRdIFNlcnZpY2UtYXdhcmUgU3RhcnQgVGltZSBjaGVjayBjb21wbGV0ZWQuJyxcblx0XHRcdHtcblx0XHRcdFx0c2VydmljZV9pZDogTnVtYmVyKCAkbmF0aXZlLmRhdGEoICdzZXJ2aWNlLWlkJyApIHx8IDAgKSxcblx0XHRcdFx0cHJvdmlkZXJfaWQ6IE51bWJlciggJG5hdGl2ZS5kYXRhKCAncHJvdmlkZXItaWQnICkgfHwgMCApLFxuXHRcdFx0XHRkYXRlczogZGF0ZXMuc2xpY2UoIDAgKSxcblx0XHRcdFx0ZHVyYXRpb25fbWludXRlczogTnVtYmVyKCBkYXRhLmR1cmF0aW9uIHx8IDAgKSxcblx0XHRcdFx0YnVmZmVyX2JlZm9yZV9taW51dGVzOiBidWZmZXJfYmVmb3JlLFxuXHRcdFx0XHRidWZmZXJfYWZ0ZXJfbWludXRlczogYnVmZmVyX2FmdGVyLFxuXHRcdFx0XHRibG9ja2VkX3N0YXJ0X3RpbWVzOiBibG9ja2VkLm1hcCggZnVuY3Rpb24gKCBpdGVtICkgeyByZXR1cm4gaXRlbS5zdGFydF90aW1lOyB9IClcblx0XHRcdH1cblx0XHQpO1xuXHRcdGlmICggYmxvY2tlZC5sZW5ndGggJiYgdHlwZW9mIHdpbmRvdy5jb25zb2xlLnRhYmxlID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0d2luZG93LmNvbnNvbGUudGFibGUoIGJsb2NrZWQgKTtcblx0XHR9XG5cdH1cblxuXHQvKiogQXBwbHkgb25lIHNlcnZlciByZXNwb25zZSB3aXRob3V0IGV4cG9zaW5nIGFub3RoZXIgY3VzdG9tZXIncyBib29raW5nLiAqL1xuXHRmdW5jdGlvbiBhcHBseV9hdmFpbGFibGVfc3RhcnRfdGltZXMoICRuYXRpdmUsIHNsb3RzICkge1xuXHRcdHZhciBzZWxlY3Rpb24gPSBnZXRfdGltZV9zZWxlY3Rpb24oICRuYXRpdmUgKTtcblx0XHR2YXIgJHN0YXJ0ID0gc2VsZWN0aW9uLiRzdGFydDtcblx0XHR2YXIgaW5pdGlhbF9zdGFydF90aW1lID0gU3RyaW5nKCAkbmF0aXZlLmF0dHIoICdkYXRhLWluaXRpYWwtc3RhcnQtdGltZScgKSB8fCAnJyApO1xuXHRcdHZhciBzZWxlY3RlZF92YWx1ZSA9IHNlbGVjdGlvbi5zdGFydF90aW1lIHx8IGluaXRpYWxfc3RhcnRfdGltZTtcblx0XHR2YXIgc2VsZWN0ZWRfbWVzc2FnZSA9ICcnO1xuXHRcdGNsZWFyX2FwcG9pbnRtZW50X2Rpc2FibGVkX3RpbWVzKCAkc3RhcnQgKTtcblxuXHRcdCRzdGFydC5maW5kKCAnb3B0aW9uJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciAkb3B0aW9uID0gJCggdGhpcyApO1xuXHRcdFx0dmFyIHZhbHVlID0gU3RyaW5nKCAkb3B0aW9uLnZhbCgpIHx8ICcnICk7XG5cdFx0XHR2YXIgcmVzdWx0ID0gc2xvdHMgJiYgc2xvdHNbIHZhbHVlIF0gPyBzbG90c1sgdmFsdWUgXSA6IG51bGw7XG5cdFx0XHRpZiAoIHJlc3VsdCAmJiBmYWxzZSA9PT0gcmVzdWx0LnZhbGlkICYmICEgJG9wdGlvbi5oYXNDbGFzcyggJ2Jvb2tlZCcgKSApIHtcblx0XHRcdFx0JG9wdGlvbi5wcm9wKCAnZGlzYWJsZWQnLCB0cnVlICkuYXR0ciggJ2RhdGEtd3BiYy1hcHBvaW50bWVudC11bmF2YWlsYWJsZScsICcxJyApO1xuXHRcdFx0XHRpZiAoIHNlbGVjdGVkX3ZhbHVlID09PSB2YWx1ZSApIHtcblx0XHRcdFx0XHRzZWxlY3RlZF9tZXNzYWdlID0gcmVzdWx0Lm1lc3NhZ2UgfHwgY29uZmlnLnZhbGlkYXRpb25fZXJyb3I7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHRpZiAoIHNlbGVjdGVkX21lc3NhZ2UgKSB7XG5cdFx0XHQkc3RhcnQudmFsKCAnJyApO1xuXHRcdFx0c2hvd190aW1lX25vdGljZSggJG5hdGl2ZSwgc2VsZWN0aW9uLCBzZWxlY3RlZF9tZXNzYWdlICk7XG5cdFx0fSBlbHNlIGlmICggaW5pdGlhbF9zdGFydF90aW1lICYmIHNsb3RzICYmIHNsb3RzWyBpbml0aWFsX3N0YXJ0X3RpbWUgXSAmJiBmYWxzZSAhPT0gc2xvdHNbIGluaXRpYWxfc3RhcnRfdGltZSBdLnZhbGlkICkge1xuXHRcdFx0JHN0YXJ0LnZhbCggaW5pdGlhbF9zdGFydF90aW1lICk7XG5cdFx0fVxuXHRcdCRuYXRpdmUucmVtb3ZlQXR0ciggJ2RhdGEtaW5pdGlhbC1zdGFydC10aW1lJyApO1xuXHRcdHJlZnJlc2hfc3RhcnRfdGltZV9waWNrZXIoICRzdGFydCApO1xuXHR9XG5cblx0LyoqIEZpbHRlciB0aGUgY29tcGxldGUgU3RhcnQgVGltZSBsaXN0IHdpdGggb25lIGJvdW5kZWQgc2VydmVyIHJlcXVlc3QuICovXG5cdGZ1bmN0aW9uIGxvYWRfYXZhaWxhYmxlX3N0YXJ0X3RpbWVzKCAkbmF0aXZlICkge1xuXHRcdHZhciBzdGF0ZSA9IGdldF90aW1lX3ZhbGlkYXRpb25fc3RhdGUoICRuYXRpdmUgKTtcblx0XHR2YXIgJHN0YXJ0ID0gZ2V0X3N0YXJ0X3RpbWVfZmllbGQoICRuYXRpdmUgKTtcblx0XHR2YXIgZGF0ZXMgPSBnZXRfc2VsZWN0ZWRfZGF0ZXMoICRuYXRpdmUgKTtcblx0XHR2YXIgc3RhcnRfdGltZXMgPSBnZXRfY29yZV9hdmFpbGFibGVfc3RhcnRfdGltZXMoICRzdGFydCApO1xuXHRcdHZhciBzZXF1ZW5jZSA9ICsrc3RhdGUuYXZhaWxhYmlsaXR5X3NlcXVlbmNlO1xuXG5cdFx0aWYgKCBzdGF0ZS5hdmFpbGFiaWxpdHlfcmVxdWVzdCAmJiA0ICE9PSBzdGF0ZS5hdmFpbGFiaWxpdHlfcmVxdWVzdC5yZWFkeVN0YXRlICkge1xuXHRcdFx0c3RhdGUuYXZhaWxhYmlsaXR5X3JlcXVlc3QuYWJvcnQoKTtcblx0XHR9XG5cdFx0aWYgKCAhICRzdGFydC5sZW5ndGggfHwgISBkYXRlcy5sZW5ndGggfHwgISBzdGFydF90aW1lcy5sZW5ndGggKSB7XG5cdFx0XHRjbGVhcl9hcHBvaW50bWVudF9kaXNhYmxlZF90aW1lcyggJHN0YXJ0ICk7XG5cdFx0XHRyZWZyZXNoX3N0YXJ0X3RpbWVfcGlja2VyKCAkc3RhcnQgKTtcblx0XHRcdHN0YXRlLmF2YWlsYWJsZV9zbG90cyA9IHt9O1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRsb2dfc3RhcnRfdGltZV9maWx0ZXJfcmVxdWVzdCggJG5hdGl2ZSwgZGF0ZXMsIHN0YXJ0X3RpbWVzICk7XG5cblx0XHRzdGF0ZS5hdmFpbGFiaWxpdHlfcmVxdWVzdCA9ICQucG9zdCggY29uZmlnLmFqYXhfdXJsLCB7XG5cdFx0XHRhY3Rpb246IGNvbmZpZy52YWxpZGF0ZV9hY3Rpb24sXG5cdFx0XHRub25jZTogY29uZmlnLm5vbmNlLFxuXHRcdFx0c2VydmljZV9pZDogTnVtYmVyKCAkbmF0aXZlLmRhdGEoICdzZXJ2aWNlLWlkJyApIHx8IDAgKSxcblx0XHRcdHByb3ZpZGVyX2lkOiBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3Byb3ZpZGVyLWlkJyApIHx8IDAgKSxcblx0XHRcdGNvbnRleHRfdG9rZW46IFN0cmluZyggJG5hdGl2ZS5hdHRyKCAnZGF0YS1hcHBvaW50bWVudC1jb250ZXh0LXRva2VuJyApIHx8ICcnICksXG5cdFx0XHRkYXRlczogZGF0ZXMsXG5cdFx0XHRzdGFydF90aW1lczogc3RhcnRfdGltZXNcblx0XHR9ICk7XG5cdFx0c3RhdGUuYXZhaWxhYmlsaXR5X3JlcXVlc3QuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdGlmICggc2VxdWVuY2UgIT09IHN0YXRlLmF2YWlsYWJpbGl0eV9zZXF1ZW5jZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dmFyIGRhdGEgPSByZXNwb25zZSAmJiByZXNwb25zZS5kYXRhID8gcmVzcG9uc2UuZGF0YSA6IHt9O1xuXHRcdFx0aWYgKCAhIHJlc3BvbnNlIHx8ICEgcmVzcG9uc2Uuc3VjY2VzcyB8fCAhIGRhdGEuc2xvdHMgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHN0YXRlLmF2YWlsYWJsZV9zbG90cyA9IGRhdGEuc2xvdHM7XG5cdFx0XHRsb2dfc3RhcnRfdGltZV9maWx0ZXJfcmVzdWx0KCAkbmF0aXZlLCBkYXRlcywgZGF0YSApO1xuXHRcdFx0YXBwbHlfYXZhaWxhYmxlX3N0YXJ0X3RpbWVzKCAkbmF0aXZlLCBkYXRhLnNsb3RzICk7XG5cdFx0fSApLmZhaWwoIGZ1bmN0aW9uICggeGhyLCBzdGF0dXMgKSB7XG5cdFx0XHRpZiAoICdhYm9ydCcgPT09IHN0YXR1cyB8fCBzZXF1ZW5jZSAhPT0gc3RhdGUuYXZhaWxhYmlsaXR5X3NlcXVlbmNlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjbGVhcl9hcHBvaW50bWVudF9kaXNhYmxlZF90aW1lcyggJHN0YXJ0ICk7XG5cdFx0XHRyZWZyZXNoX3N0YXJ0X3RpbWVfcGlja2VyKCAkc3RhcnQgKTtcblx0XHRcdHN0YXRlLmF2YWlsYWJsZV9zbG90cyA9IHt9O1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKiBEZWJvdW5jZSB0aGUgd2hvbGUtbGlzdCBmaWx0ZXIgYWZ0ZXIgY29yZSBhdmFpbGFiaWxpdHkgaGFzIHJlZnJlc2hlZC4gKi9cblx0ZnVuY3Rpb24gc2NoZWR1bGVfYXZhaWxhYmxlX3N0YXJ0X3RpbWVzKCAkbmF0aXZlICkge1xuXHRcdHZhciBzdGF0ZSA9IGdldF90aW1lX3ZhbGlkYXRpb25fc3RhdGUoICRuYXRpdmUgKTtcblx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCBzdGF0ZS5hdmFpbGFiaWxpdHlfdGltZXIgKTtcblx0XHRzdGF0ZS5hdmFpbGFiaWxpdHlfdGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xuXHRcdFx0bG9hZF9hdmFpbGFibGVfc3RhcnRfdGltZXMoICRuYXRpdmUgKTtcblx0XHR9LCAzMCApO1xuXHR9XG5cblx0LyoqIFZhbGlkYXRlIGN1cnJlbnQgU2VydmljZSBkdXJhdGlvbi9idWZmZXJzIHRocm91Z2ggdGhlIGF1dGhvcml0YXRpdmUgc2VydmVyLiAqL1xuXHRmdW5jdGlvbiB2YWxpZGF0ZV90aW1lX3NlbGVjdGlvbiggJG5hdGl2ZSApIHtcblx0XHR2YXIgc2VsZWN0aW9uID0gZ2V0X3RpbWVfc2VsZWN0aW9uKCAkbmF0aXZlICk7XG5cdFx0dmFyIHN0YXRlID0gZ2V0X3RpbWVfdmFsaWRhdGlvbl9zdGF0ZSggJG5hdGl2ZSApO1xuXHRcdGlmICggISBzZWxlY3Rpb24uY29tcGxldGUgKSB7XG5cdFx0XHRpZiAoIHN0YXRlLnJlcXVlc3QgJiYgNCAhPT0gc3RhdGUucmVxdWVzdC5yZWFkeVN0YXRlICkge1xuXHRcdFx0XHRzdGF0ZS5yZXF1ZXN0LmFib3J0KCk7XG5cdFx0XHR9XG5cdFx0XHRzdGF0ZS5zaWduYXR1cmUgPSBzZWxlY3Rpb24uc2lnbmF0dXJlO1xuXHRcdFx0c3RhdGUuc3RhdHVzID0gJ2luY29tcGxldGUnO1xuXHRcdFx0c3RhdGUucHJvbWlzZSA9IG51bGw7XG5cdFx0XHRjbGVhcl90aW1lX25vdGljZSggJG5hdGl2ZSApO1xuXHRcdFx0cmV0dXJuICQuRGVmZXJyZWQoKS5yZXNvbHZlKCBmYWxzZSwgJ2luY29tcGxldGUnICkucHJvbWlzZSgpO1xuXHRcdH1cblx0XHRpZiAoIHNlbGVjdGlvbi5zaWduYXR1cmUgPT09IHN0YXRlLnNpZ25hdHVyZSAmJiAndmFsaWQnID09PSBzdGF0ZS5zdGF0dXMgKSB7XG5cdFx0XHRyZXR1cm4gJC5EZWZlcnJlZCgpLnJlc29sdmUoIHRydWUsICd2YWxpZCcgKS5wcm9taXNlKCk7XG5cdFx0fVxuXHRcdGlmICggc2VsZWN0aW9uLnNpZ25hdHVyZSA9PT0gc3RhdGUuc2lnbmF0dXJlICYmICdpbnZhbGlkJyA9PT0gc3RhdGUuc3RhdHVzICkge1xuXHRcdFx0cmV0dXJuICQuRGVmZXJyZWQoKS5yZXNvbHZlKCBmYWxzZSwgJ2ludmFsaWQnICkucHJvbWlzZSgpO1xuXHRcdH1cblx0XHRpZiAoIHNlbGVjdGlvbi5zaWduYXR1cmUgPT09IHN0YXRlLnNpZ25hdHVyZSAmJiAncGVuZGluZycgPT09IHN0YXRlLnN0YXR1cyAmJiBzdGF0ZS5wcm9taXNlICkge1xuXHRcdFx0cmV0dXJuIHN0YXRlLnByb21pc2U7XG5cdFx0fVxuXHRcdGlmICggc3RhdGUucmVxdWVzdCAmJiA0ICE9PSBzdGF0ZS5yZXF1ZXN0LnJlYWR5U3RhdGUgKSB7XG5cdFx0XHRzdGF0ZS5yZXF1ZXN0LmFib3J0KCk7XG5cdFx0fVxuXG5cdFx0dmFyIGRlZmVycmVkID0gJC5EZWZlcnJlZCgpO1xuXHRcdHZhciBzZXF1ZW5jZSA9ICsrc3RhdGUuc2VxdWVuY2U7XG5cdFx0c3RhdGUuc2lnbmF0dXJlID0gc2VsZWN0aW9uLnNpZ25hdHVyZTtcblx0XHRzdGF0ZS5zdGF0dXMgPSAncGVuZGluZyc7XG5cdFx0c3RhdGUucHJvbWlzZSA9IGRlZmVycmVkLnByb21pc2UoKTtcblx0XHRjbGVhcl90aW1lX25vdGljZSggJG5hdGl2ZSApO1xuXHRcdHN0YXRlLnJlcXVlc3QgPSAkLnBvc3QoIGNvbmZpZy5hamF4X3VybCwge1xuXHRcdFx0YWN0aW9uOiBjb25maWcudmFsaWRhdGVfYWN0aW9uLFxuXHRcdFx0bm9uY2U6IGNvbmZpZy5ub25jZSxcblx0XHRcdHNlcnZpY2VfaWQ6IE51bWJlciggJG5hdGl2ZS5kYXRhKCAnc2VydmljZS1pZCcgKSB8fCAwICksXG5cdFx0XHRwcm92aWRlcl9pZDogTnVtYmVyKCAkbmF0aXZlLmRhdGEoICdwcm92aWRlci1pZCcgKSB8fCAwICksXG5cdFx0XHRjb250ZXh0X3Rva2VuOiBTdHJpbmcoICRuYXRpdmUuYXR0ciggJ2RhdGEtYXBwb2ludG1lbnQtY29udGV4dC10b2tlbicgKSB8fCAnJyApLFxuXHRcdFx0ZGF0ZXM6IHNlbGVjdGlvbi5kYXRlcyxcblx0XHRcdHN0YXJ0X3RpbWU6IHNlbGVjdGlvbi5zdGFydF90aW1lXG5cdFx0fSApO1xuXHRcdHN0YXRlLnJlcXVlc3QuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdGlmICggc2VxdWVuY2UgIT09IHN0YXRlLnNlcXVlbmNlIHx8IHNlbGVjdGlvbi5zaWduYXR1cmUgIT09IGdldF90aW1lX3NlbGVjdGlvbiggJG5hdGl2ZSApLnNpZ25hdHVyZSApIHtcblx0XHRcdFx0ZGVmZXJyZWQucmVqZWN0KCAnc3RhbGUnICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHZhciBkYXRhID0gcmVzcG9uc2UgJiYgcmVzcG9uc2UuZGF0YSA/IHJlc3BvbnNlLmRhdGEgOiB7fTtcblx0XHRcdGlmICggcmVzcG9uc2UgJiYgcmVzcG9uc2Uuc3VjY2VzcyAmJiB0cnVlID09PSBkYXRhLnZhbGlkICkge1xuXHRcdFx0XHRzdGF0ZS5zdGF0dXMgPSAndmFsaWQnO1xuXHRcdFx0XHRjbGVhcl90aW1lX25vdGljZSggJG5hdGl2ZSApO1xuXHRcdFx0XHRkZWZlcnJlZC5yZXNvbHZlKCB0cnVlLCAndmFsaWQnICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHN0YXRlLnN0YXR1cyA9ICdpbnZhbGlkJztcblx0XHRcdHNob3dfdGltZV9ub3RpY2UoICRuYXRpdmUsIHNlbGVjdGlvbiwgZGF0YS5tZXNzYWdlIHx8IGNvbmZpZy52YWxpZGF0aW9uX2Vycm9yICk7XG5cdFx0XHRkZWZlcnJlZC5yZXNvbHZlKCBmYWxzZSwgJ2ludmFsaWQnICk7XG5cdFx0fSApLmZhaWwoIGZ1bmN0aW9uICggeGhyLCBzdGF0dXMgKSB7XG5cdFx0XHRpZiAoICdhYm9ydCcgPT09IHN0YXR1cyB8fCBzZXF1ZW5jZSAhPT0gc3RhdGUuc2VxdWVuY2UgKSB7XG5cdFx0XHRcdGRlZmVycmVkLnJlamVjdCggJ3N0YWxlJyApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR2YXIgcmVzcG9uc2UgPSB4aHIucmVzcG9uc2VKU09OO1xuXHRcdFx0dmFyIG1lc3NhZ2UgPSByZXNwb25zZSAmJiByZXNwb25zZS5kYXRhICYmIHJlc3BvbnNlLmRhdGEubWVzc2FnZSA/IHJlc3BvbnNlLmRhdGEubWVzc2FnZSA6IGNvbmZpZy52YWxpZGF0aW9uX2Vycm9yO1xuXHRcdFx0c3RhdGUuc3RhdHVzID0gJ2ludmFsaWQnO1xuXHRcdFx0c2hvd190aW1lX25vdGljZSggJG5hdGl2ZSwgc2VsZWN0aW9uLCBtZXNzYWdlICk7XG5cdFx0XHRkZWZlcnJlZC5yZXNvbHZlKCBmYWxzZSwgJ2ludmFsaWQnICk7XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIHN0YXRlLnByb21pc2U7XG5cdH1cblxuXHQvKiogRGVib3VuY2UgdmFsaWRhdGlvbiBhZnRlciBjYWxlbmRhciBvciBTdGFydCBUaW1lIGNoYW5nZXMuICovXG5cdGZ1bmN0aW9uIHNjaGVkdWxlX3RpbWVfdmFsaWRhdGlvbiggJG5hdGl2ZSApIHtcblx0XHR2YXIgc3RhdGUgPSBnZXRfdGltZV92YWxpZGF0aW9uX3N0YXRlKCAkbmF0aXZlICk7XG5cdFx0d2luZG93LmNsZWFyVGltZW91dCggc3RhdGUudGltZXIgKTtcblx0XHRzdGF0ZS5zdGF0dXMgPSAnY2hhbmdlZCc7XG5cdFx0Y2xlYXJfdGltZV9ub3RpY2UoICRuYXRpdmUgKTtcblx0XHRpZiAoICEgaXNfdGltZV9zZWxlY3Rpb25fc3RhZ2VfYWN0aXZlKCBnZXRfdGltZV9zZWxlY3Rpb24oICRuYXRpdmUgKSApICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRzdGF0ZS50aW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YWxpZGF0ZV90aW1lX3NlbGVjdGlvbiggJG5hdGl2ZSApO1xuXHRcdH0sIDEyMCApO1xuXHR9XG5cblx0LyoqIEJsb2NrIGZvcndhcmQgd2l6YXJkIG5hdmlnYXRpb24gdW50aWwgdGhlIGN1cnJlbnQgdGltZSBwcmVmbGlnaHQgcGFzc2VzLiAqL1xuXHRmdW5jdGlvbiBjYXB0dXJlX3dpemFyZF9uYXZpZ2F0aW9uKCBldmVudCwgJG5hdGl2ZSApIHtcblx0XHR2YXIgJGJ1dHRvbiA9ICQoIGV2ZW50LnRhcmdldCApLmNsb3Nlc3QoICcud3BiY193aXphcmRfc3RlcF9idXR0b24nICk7XG5cdFx0aWYgKCAhICRidXR0b24ubGVuZ3RoIHx8ICEgJC5jb250YWlucyggJG5hdGl2ZS5nZXQoIDAgKSwgJGJ1dHRvbi5nZXQoIDAgKSApICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoICRidXR0b24uZ2V0KCAwICkud3BiY19hcHBvaW50bWVudF9wcmVmbGlnaHRfYnlwYXNzICkge1xuXHRcdFx0JGJ1dHRvbi5nZXQoIDAgKS53cGJjX2FwcG9pbnRtZW50X3ByZWZsaWdodF9ieXBhc3MgPSBmYWxzZTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR2YXIgdGFyZ2V0X21hdGNoID0gU3RyaW5nKCAkYnV0dG9uLmF0dHIoICdjbGFzcycgKSB8fCAnJyApLm1hdGNoKCAvd3BiY193aXphcmRfc3RlcF8oXFxkKykvICk7XG5cdFx0dmFyIGN1cnJlbnRfbWF0Y2ggPSBTdHJpbmcoICRidXR0b24uY2xvc2VzdCggJy53cGJjX3dpemFyZF9zdGVwJyApLmF0dHIoICdjbGFzcycgKSB8fCAnJyApLm1hdGNoKCAvd3BiY193aXphcmRfc3RlcChcXGQrKS8gKTtcblx0XHRpZiAoICEgdGFyZ2V0X21hdGNoIHx8ICggY3VycmVudF9tYXRjaCAmJiBOdW1iZXIoIHRhcmdldF9tYXRjaFsxXSApIDw9IE51bWJlciggY3VycmVudF9tYXRjaFsxXSApICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dmFyIHNlbGVjdGlvbiA9IGdldF90aW1lX3NlbGVjdGlvbiggJG5hdGl2ZSApO1xuXHRcdHZhciAkY3VycmVudF9zdGVwID0gJGJ1dHRvbi5jbG9zZXN0KCAnLndwYmNfd2l6YXJkX3N0ZXAnICk7XG5cdFx0dmFyICR0aW1lX3N0ZXAgPSBzZWxlY3Rpb24uJHN0YXJ0LmNsb3Nlc3QoICcud3BiY193aXphcmRfc3RlcCcgKTtcblx0XHRpZiAoICR0aW1lX3N0ZXAubGVuZ3RoICYmICRjdXJyZW50X3N0ZXAubGVuZ3RoICYmICR0aW1lX3N0ZXAuZ2V0KCAwICkgIT09ICRjdXJyZW50X3N0ZXAuZ2V0KCAwICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICggISBzZWxlY3Rpb24uY29tcGxldGUgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHZhciBzdGF0ZSA9IGdldF90aW1lX3ZhbGlkYXRpb25fc3RhdGUoICRuYXRpdmUgKTtcblx0XHRpZiAoIHNlbGVjdGlvbi5zaWduYXR1cmUgPT09IHN0YXRlLnNpZ25hdHVyZSAmJiAndmFsaWQnID09PSBzdGF0ZS5zdGF0dXMgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0XHR2YWxpZGF0ZV90aW1lX3NlbGVjdGlvbiggJG5hdGl2ZSApLmRvbmUoIGZ1bmN0aW9uICggdmFsaWQgKSB7XG5cdFx0XHRpZiAoIHZhbGlkICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jb250YWlucyggJGJ1dHRvbi5nZXQoIDAgKSApICkge1xuXHRcdFx0XHQkYnV0dG9uLmdldCggMCApLndwYmNfYXBwb2ludG1lbnRfcHJlZmxpZ2h0X2J5cGFzcyA9IHRydWU7XG5cdFx0XHRcdCRidXR0b24uZ2V0KCAwICkuY2xpY2soKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdH1cblxuXHQvKiogQXR0YWNoIGlzb2xhdGVkIGJ1ZmZlciBwcmVmbGlnaHQgYmVoYXZpb3IgdG8gb25lIG5hdGl2ZSBBcHBvaW50bWVudCBmb3JtLiAqL1xuXHRmdW5jdGlvbiBpbml0aWFsaXplX3RpbWVfcHJlZmxpZ2h0KCAkbmF0aXZlICkge1xuXHRcdGlmICggISBjb25maWcuYWpheF91cmwgfHwgISBjb25maWcudmFsaWRhdGVfYWN0aW9uIHx8ICEgJG5hdGl2ZS5sZW5ndGggKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHZhciBuYXRpdmVfZWxlbWVudCA9ICRuYXRpdmUuZ2V0KCAwICk7XG5cdFx0aWYgKCBuYXRpdmVfZWxlbWVudC53cGJjX2FwcG9pbnRtZW50X3RpbWVfcHJlZmxpZ2h0X3JlYWR5ICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRuYXRpdmVfZWxlbWVudC53cGJjX2FwcG9pbnRtZW50X3RpbWVfcHJlZmxpZ2h0X3JlYWR5ID0gdHJ1ZTtcblx0XHRuYXRpdmVfZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0Y2FwdHVyZV93aXphcmRfbmF2aWdhdGlvbiggZXZlbnQsICRuYXRpdmUgKTtcblx0XHR9LCB0cnVlICk7XG5cdFx0JG5hdGl2ZS5vbiggJ2NoYW5nZS53cGJjX2FwcG9pbnRtZW50X3RpbWVfcHJlZmxpZ2h0JywgJ1tuYW1lXj1cInN0YXJ0dGltZVwiXScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdHNjaGVkdWxlX3RpbWVfdmFsaWRhdGlvbiggJG5hdGl2ZSApO1xuXHRcdH0gKTtcblx0XHQkbmF0aXZlLm9uKCAnZGF0ZV9zZWxlY3RlZC53cGJjX2FwcG9pbnRtZW50X3RpbWVfcHJlZmxpZ2h0IHdwYmNfaG9va190aW1lc2xvdHNfZGlzYWJsZWQud3BiY19hcHBvaW50bWVudF90aW1lX3ByZWZsaWdodCcsIGZ1bmN0aW9uICggZXZlbnQsIHByb3ZpZGVyX2lkICkge1xuXHRcdFx0aWYgKCBOdW1iZXIoIHByb3ZpZGVyX2lkIHx8IDAgKSA9PT0gTnVtYmVyKCAkbmF0aXZlLmRhdGEoICdwcm92aWRlci1pZCcgKSB8fCAwICkgKSB7XG5cdFx0XHRcdHNjaGVkdWxlX2F2YWlsYWJsZV9zdGFydF90aW1lcyggJG5hdGl2ZSApO1xuXHRcdFx0XHRzY2hlZHVsZV90aW1lX3ZhbGlkYXRpb24oICRuYXRpdmUgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdFx0c2NoZWR1bGVfYXZhaWxhYmxlX3N0YXJ0X3RpbWVzKCAkbmF0aXZlICk7XG5cdH1cblxuXHQvKipcblx0ICogTG9jayBhIG5hdGl2ZSBkdXJhdGlvbiBmaWVsZCB0byB0aGUgc2VsZWN0ZWQgU2VydmljZSBkdXJhdGlvbi5cblx0ICpcblx0ICogVGhlIGNvcmUgc2F2ZSBoYW5kbGVyIGluZGVwZW5kZW50bHkgZGVyaXZlcyBkdXJhdGlvbiBmcm9tIHRoZSBTZXJ2aWNlIHJvdztcblx0ICogdGhpcyBjbGllbnQgc3RlcCBvbmx5IGtlZXBzIHRoZSB2aXNpYmxlIGZvcm0gYW5kIHNlcmlhbGl6ZWQgZGF0YSBhbGlnbmVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gcHJlcGFyZV9uYXRpdmVfZm9ybSggJHNjb3BlICkge1xuXHRcdHZhciAkbmF0aXZlID0gJHNjb3BlLmZpbmQoICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19uYXRpdmVfZm9ybScgKS5maXJzdCgpO1xuXHRcdGlmICggISAkbmF0aXZlLmxlbmd0aCApIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAoICEgcmVnaXN0ZXJfbmF0aXZlX2Zvcm0oICRuYXRpdmUgKSApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHR2YXIgcmVzb3VyY2VfaWQgPSBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3Byb3ZpZGVyLWlkJyApIHx8IDAgKTtcblx0XHR2YXIgZHVyYXRpb24gPSBTdHJpbmcoICRuYXRpdmUuZGF0YSggJ2R1cmF0aW9uJyApIHx8ICcnICk7XG5cdFx0dmFyIGZpZWxkX25hbWUgPSAnZHVyYXRpb250aW1lJyArIHJlc291cmNlX2lkO1xuXHRcdHZhciAkZm9ybSA9ICRuYXRpdmUuZmluZCggJyNib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKTtcblx0XHQkZm9ybS5maW5kKCAnLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fZHVyYXRpb25fcHJveHknICkucmVtb3ZlKCk7XG5cdFx0dmFyICRkdXJhdGlvbl9maWVsZHMgPSAkZm9ybS5maW5kKCAnW25hbWU9XCInICsgZmllbGRfbmFtZSArICdcIl0sIFtuYW1lPVwiJyArIGZpZWxkX25hbWUgKyAnW11cIl0nICk7XG5cdFx0dmFyICRkZXJpdmVkX3RpbWVfZmllbGRzID0gJGZvcm0uZmluZCggJ1tuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdcIl0sIFtuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXSwgW25hbWU9XCJyYW5nZXRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdLCBbbmFtZT1cInJhbmdldGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXScgKTtcblxuXHRcdCRkdXJhdGlvbl9maWVsZHMuZWFjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyICRmaWVsZCA9ICQoIHRoaXMgKTtcblx0XHRcdGlmICggJGZpZWxkLmlzKCAnc2VsZWN0JyApICYmICEgJGZpZWxkLmZpbmQoICdvcHRpb25bdmFsdWU9XCInICsgZHVyYXRpb24ucmVwbGFjZSggL1wiL2csICdcXFxcXCInICkgKyAnXCJdJyApLmxlbmd0aCApIHtcblx0XHRcdFx0JGZpZWxkLmFwcGVuZCggJCggJzxvcHRpb24+JywgeyB2YWx1ZTogZHVyYXRpb24sIHRleHQ6IGR1cmF0aW9uIH0gKSApO1xuXHRcdFx0fVxuXHRcdFx0JGZpZWxkLnZhbCggZHVyYXRpb24gKS5wcm9wKCAnZGlzYWJsZWQnLCB0cnVlICkuYXR0ciggJ2FyaWEtZGlzYWJsZWQnLCAndHJ1ZScgKTtcblx0XHRcdCRmaWVsZC5jbG9zZXN0KCAnLndwZGV2LWZvcm0tY29udHJvbC13cmFwJyApLmFkZENsYXNzKCAnd3BiY19ib29raW5nX2FwcG9pbnRtZW50X19maXhlZF9kdXJhdGlvbl9maWVsZCcgKTtcblx0XHR9ICk7XG5cdFx0JGRlcml2ZWRfdGltZV9maWVsZHMuZWFjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyICRmaWVsZCA9ICQoIHRoaXMgKTtcblx0XHRcdCRmaWVsZC5wcm9wKCAnZGlzYWJsZWQnLCB0cnVlICkuYXR0ciggJ2FyaWEtZGlzYWJsZWQnLCAndHJ1ZScgKTtcblx0XHRcdCRmaWVsZC5jbG9zZXN0KCAnLndwZGV2LWZvcm0tY29udHJvbC13cmFwJyApLmFkZENsYXNzKCAnd3BiY19ib29raW5nX2FwcG9pbnRtZW50X19maXhlZF9kdXJhdGlvbl9maWVsZCcgKTtcblx0XHR9ICk7XG5cblx0XHRpZiAoICEgJGR1cmF0aW9uX2ZpZWxkcy5sZW5ndGggKSB7XG5cdFx0XHR2YXIgJGR1cmF0aW9uX3Byb3h5ID0gJCggJzxzZWxlY3Q+Jywge1xuXHRcdFx0XHRuYW1lOiBmaWVsZF9uYW1lLFxuXHRcdFx0XHQnY2xhc3MnOiAnd3BiY19ib29raW5nX2FwcG9pbnRtZW50X19kdXJhdGlvbl92YWx1ZScsXG5cdFx0XHRcdCdhcmlhLWhpZGRlbic6ICd0cnVlJyxcblx0XHRcdFx0dGFiaW5kZXg6ICctMScsXG5cdFx0XHRcdCdkYXRhLXdwYmMtYXBwb2ludG1lbnQtZ2VuZXJhdGVkJzogJzEnXG5cdFx0XHR9ICkuYXBwZW5kKCAkKCAnPG9wdGlvbj4nLCB7IHZhbHVlOiBkdXJhdGlvbiwgdGV4dDogZHVyYXRpb24sIHNlbGVjdGVkOiB0cnVlIH0gKSApO1xuXHRcdFx0JGZvcm0uYXBwZW5kKFxuXHRcdFx0XHQkKCAnPHNwYW4+Jywge1xuXHRcdFx0XHRcdCdjbGFzcyc6ICd3cGRldi1mb3JtLWNvbnRyb2wtd3JhcCB3cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX2ZpeGVkX2R1cmF0aW9uX2ZpZWxkIHdwYmNfYm9va2luZ19hcHBvaW50bWVudF9fZHVyYXRpb25fcHJveHknLFxuXHRcdFx0XHRcdCdhcmlhLWhpZGRlbic6ICd0cnVlJ1xuXHRcdFx0XHR9ICkuYXBwZW5kKCAkZHVyYXRpb25fcHJveHkgKVxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHRpbml0aWFsaXplX3RpbWVfcHJlZmxpZ2h0KCAkbmF0aXZlICk7XG5cdFx0aW5pdGlhbGl6ZV9pbml0aWFsX2NhbGVuZGFyX2RhdGVzKCAkbmF0aXZlICk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKiBDb252ZXJ0IGEgc2NyaXB0IFVSTCB0byB0aGUgc2FtZSBhYnNvbHV0ZSByZXByZXNlbnRhdGlvbiBhcyBET00gc2NyaXB0LnNyYy4gKi9cblx0ZnVuY3Rpb24gZ2V0X2Fic29sdXRlX3NjcmlwdF91cmwoIHVybCApIHtcblx0XHR2YXIgYW5jaG9yID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2EnICk7XG5cdFx0YW5jaG9yLmhyZWYgPSBTdHJpbmcoIHVybCB8fCAnJyApO1xuXHRcdHJldHVybiBhbmNob3IuaHJlZjtcblx0fVxuXG5cdC8qKiBFeGVjdXRlIHJlbmRlcmVyIHNjcmlwdHMgc2VxdWVudGlhbGx5IHdoaWxlIHRoZSByZXF1ZXN0IHN0aWxsIG93bnMgdGhlIHN0YWdlLiAqL1xuXHRmdW5jdGlvbiBleGVjdXRlX3NjcmlwdHMoIHNjcmlwdHMsIG93bnNfc3RhZ2UgKSB7XG5cdFx0dmFyIHNlcXVlbmNlID0gJC5EZWZlcnJlZCgpLnJlc29sdmUoKS5wcm9taXNlKCk7XG5cblx0XHQkLmVhY2goIHNjcmlwdHMsIGZ1bmN0aW9uICggaW5kZXgsIHNjcmlwdCApIHtcblx0XHRcdHNlcXVlbmNlID0gc2VxdWVuY2UudGhlbiggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRpZiAoICEgb3duc19zdGFnZSgpICkge1xuXHRcdFx0XHRcdHJldHVybiByZWplY3RlZF9zdGFnZSggJycgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHNjcmlwdC5zcmMgKSB7XG5cdFx0XHRcdFx0dmFyIGFic29sdXRlX3VybCA9IGdldF9hYnNvbHV0ZV9zY3JpcHRfdXJsKCBzY3JpcHQuc3JjICk7XG5cdFx0XHRcdFx0aWYgKCBsb2FkZWRfc2NyaXB0X3VybHNbIGFic29sdXRlX3VybCBdICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuICQuYWpheCggeyB1cmw6IGFic29sdXRlX3VybCwgZGF0YVR5cGU6ICdzY3JpcHQnLCBjYWNoZTogdHJ1ZSB9ICkudGhlbiggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0bG9hZGVkX3NjcmlwdF91cmxzWyBhYnNvbHV0ZV91cmwgXSA9IHRydWU7XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggc2NyaXB0LmNvZGUgKSB7XG5cdFx0XHRcdFx0JC5nbG9iYWxFdmFsKCBzY3JpcHQuY29kZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9ICk7XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIHNlcXVlbmNlO1xuXHR9XG5cblx0LyoqIEluaXRpYWxpemUgY29udHJvbHMgd2hvc2UgY29yZSBoYW5kbGVycyBub3JtYWxseSBiaW5kIG9uIGRvY3VtZW50IHJlYWR5LiAqL1xuXHRmdW5jdGlvbiBpbml0aWFsaXplX2FqYXhfZm9ybV9jb250cm9scygpIHtcblx0XHRpZiAoIHR5cGVvZiB3aW5kb3cud3BiY19ob29rX19pbml0X2Jvb2tpbmdfZm9ybV93aXphcmRfYnV0dG9ucyA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdHdpbmRvdy53cGJjX2hvb2tfX2luaXRfYm9va2luZ19mb3JtX3dpemFyZF9idXR0b25zKCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqIERlc3Ryb3kgbmF0aXZlIGNhbGVuZGFyIGluc3RhbmNlcyBhbmQgdW5yZWdpc3RlciBjb250ZXh0IGJlZm9yZSByZW1vdmFsLiAqL1xuXHRmdW5jdGlvbiBjbGVhbnVwX25hdGl2ZV9mb3JtKCAkcm9vdCApIHtcblx0XHQkcm9vdC5maW5kKCAnLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fbmF0aXZlX2Zvcm0nICkuZWFjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyICRuYXRpdmUgPSAkKCB0aGlzICk7XG5cdFx0XHR2YXIgcmVzb3VyY2VfaWQgPSBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3Byb3ZpZGVyLWlkJyApIHx8IDAgKTtcblx0XHRcdHZhciAkY2FsZW5kYXIgPSAkbmF0aXZlLmZpbmQoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApO1xuXG5cdFx0XHR1bnJlZ2lzdGVyX25hdGl2ZV9mb3JtKCAkbmF0aXZlICk7XG5cdFx0XHRpZiAoICEgcmVzb3VyY2VfaWQgfHwgISAkY2FsZW5kYXIubGVuZ3RoIHx8ICEgJC5kYXRlcGljayB8fCB0eXBlb2YgJGNhbGVuZGFyLmRhdGVwaWNrICE9PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdHZhciBpbnN0YW5jZSA9IHR5cGVvZiAkLmRhdGVwaWNrLl9nZXRJbnN0ID09PSAnZnVuY3Rpb24nID8gJC5kYXRlcGljay5fZ2V0SW5zdCggJGNhbGVuZGFyLmdldCggMCApICkgOiBudWxsO1xuXHRcdFx0XHRpZiAoIGluc3RhbmNlICkge1xuXHRcdFx0XHRcdCRjYWxlbmRhci5kYXRlcGljayggJ2Rlc3Ryb3knICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdFx0JGNhbGVuZGFyLnJlbW92ZUNsYXNzKCAnaGFzRGF0ZXBpY2snICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqIFJlc3RvcmUgdGhlIHByZXZpb3VzbHkgc2VsZWN0ZWQgU2VydmljZSB3aGVuIG5hdmlnYXRpbmcgYmFjayBvbmUgc3RhZ2UuICovXG5cdGZ1bmN0aW9uIHJlc3RvcmVfc2VydmljZV9zZWxlY3Rpb24oICRyb290ICkge1xuXHRcdHZhciBzZXJ2aWNlX2lkID0gTnVtYmVyKCAkcm9vdC5hdHRyKCAnZGF0YS1zZWxlY3RlZC1zZXJ2aWNlLWlkJyApIHx8IDAgKTtcblx0XHRpZiAoICEgc2VydmljZV9pZCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dmFyICRpbnB1dCA9ICRyb290LmZpbmQoICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19zZWxlY3Rpb25fZm9ybSBbbmFtZT1cIndwYmNfYXBwb2ludG1lbnRfc2VydmljZVwiXVt2YWx1ZT1cIicgKyBzZXJ2aWNlX2lkICsgJ1wiXScgKS5maXJzdCgpO1xuXHRcdGlmICggJGlucHV0Lmxlbmd0aCApIHtcblx0XHRcdCRpbnB1dC5wcm9wKCAnY2hlY2tlZCcsIHRydWUgKS5jbG9zZXN0KCAnLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fY2hvaWNlJyApLmFkZENsYXNzKCAnaXMtc2VsZWN0ZWQnICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqIEZvY3VzIHRoZSBuZXcgc3RhZ2UgaGVhZGluZyB3aXRob3V0IGZvcmNpbmcgbW90aW9uIGZvciByZWR1Y2VkLW1vdGlvbiB1c2Vycy4gKi9cblx0ZnVuY3Rpb24gZm9jdXNfc3RhZ2UoICRyb290ICkge1xuXHRcdHZhciAkdGFyZ2V0ID0gJHJvb3QuZmluZCggJz4gLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fc3RhZ2UgLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9faGVhZGluZyBoMywgPiAud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19zdGFnZSAud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19ub3RpY2UnICkuZmlyc3QoKTtcblx0XHRpZiAoICR0YXJnZXQubGVuZ3RoICkge1xuXHRcdFx0JHRhcmdldC5hdHRyKCAndGFiaW5kZXgnLCAnLTEnICk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHQkdGFyZ2V0LmdldCggMCApLmZvY3VzKCB7IHByZXZlbnRTY3JvbGw6IHRydWUgfSApO1xuXHRcdFx0fSBjYXRjaCAoIGVycm9yICkge1xuXHRcdFx0XHQkdGFyZ2V0LnRyaWdnZXIoICdmb2N1cycgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoICRyb290LmdldCggMCApICYmIHR5cGVvZiAkcm9vdC5nZXQoIDAgKS5zY3JvbGxJbnRvVmlldyA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdHZhciByZWR1Y2VfbW90aW9uID0gd2luZG93Lm1hdGNoTWVkaWEgJiYgd2luZG93Lm1hdGNoTWVkaWEoICcocHJlZmVycy1yZWR1Y2VkLW1vdGlvbjogcmVkdWNlKScgKS5tYXRjaGVzO1xuXHRcdFx0JHJvb3QuZ2V0KCAwICkuc2Nyb2xsSW50b1ZpZXcoIHsgYmVoYXZpb3I6IHJlZHVjZV9tb3Rpb24gPyAnYXV0bycgOiAnc21vb3RoJywgYmxvY2s6ICduZWFyZXN0JyB9ICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqIFJldHVybiBhIHJlamVjdGVkIHByb21pc2UgY2Fycnlpbmcgb25lIGNvbnRyb2xsZWQgaW5pdGlhbGl6YXRpb24gbWVzc2FnZS4gKi9cblx0ZnVuY3Rpb24gcmVqZWN0ZWRfc3RhZ2UoIG1lc3NhZ2UgKSB7XG5cdFx0dmFyIGRlZmVycmVkID0gJC5EZWZlcnJlZCgpO1xuXHRcdGRlZmVycmVkLnJlamVjdCggeyB3cGJjX21lc3NhZ2U6IG1lc3NhZ2UgfSApO1xuXHRcdHJldHVybiBkZWZlcnJlZC5wcm9taXNlKCk7XG5cdH1cblxuXHQvKiogUmVwbGFjZSBhIHN0YWdlIHdoaWxlIGd1YXJhbnRlZWluZyBET00tYmVmb3JlLXNjcmlwdCBpbml0aWFsaXphdGlvbiBvcmRlci4gKi9cblx0ZnVuY3Rpb24gcmVwbGFjZV9zdGFnZSggJHJvb3QsIGh0bWwsIHN0YWdlLCBwcm92aWRlcl9pZCwgcmVxdWVzdF9pZCApIHtcblx0XHRpZiAoICEgaXNfY3VycmVudF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApICkge1xuXHRcdFx0cmV0dXJuIHJlamVjdGVkX3N0YWdlKCAnJyApO1xuXHRcdH1cblx0XHRpZiAoICdib29raW5nJyA9PT0gc3RhZ2UgJiYgaGFzX2R1cGxpY2F0ZV9wcm92aWRlcl9mb3JtKCAkcm9vdCwgcHJvdmlkZXJfaWQgKSApIHtcblx0XHRcdHJldHVybiByZWplY3RlZF9zdGFnZSggY29uZmlnLmR1cGxpY2F0ZV9wcm92aWRlciApO1xuXHRcdH1cblxuXHRcdHZhciBwYXJzZWQgPSAkLnBhcnNlSFRNTCggU3RyaW5nKCBodG1sIHx8ICcnICksIGRvY3VtZW50LCB0cnVlICkgfHwgW107XG5cdFx0dmFyIHNjcmlwdHMgPSBbXTtcblx0XHR2YXIgJGNvbnRhaW5lciA9ICQoICc8ZGl2PicgKS5hcHBlbmQoIHBhcnNlZCApO1xuXG5cdFx0JGNvbnRhaW5lci5maW5kKCAnc2NyaXB0JyApLmFkZEJhY2soICdzY3JpcHQnICkuZWFjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0c2NyaXB0cy5wdXNoKCB7IHNyYzogdGhpcy5zcmMgfHwgJycsIGNvZGU6IHRoaXMuc3JjID8gJycgOiAoIHRoaXMudGV4dCB8fCB0aGlzLnRleHRDb250ZW50IHx8ICcnICkgfSApO1xuXHRcdFx0JCggdGhpcyApLnJlbW92ZSgpO1xuXHRcdH0gKTtcblxuXHRcdGNsZWFudXBfbmF0aXZlX2Zvcm0oICRyb290ICk7XG5cdFx0JHJvb3QuYXR0ciggJ2RhdGEtYXBwb2ludG1lbnQtc3RhZ2UnLCBzdGFnZSApO1xuXHRcdCRyb290LmZpbmQoICc+IC53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX3N0YWdlJyApLmVtcHR5KCkuYXBwZW5kKCAkY29udGFpbmVyLmNvbnRlbnRzKCkgKTtcblxuXHRcdGlmICggISBwcmVwYXJlX25hdGl2ZV9mb3JtKCAkcm9vdCApICkge1xuXHRcdFx0Y2xlYW51cF9uYXRpdmVfZm9ybSggJHJvb3QgKTtcblx0XHRcdCRyb290LmZpbmQoICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19uYXRpdmVfZm9ybSA6aW5wdXQnICkucHJvcCggJ2Rpc2FibGVkJywgdHJ1ZSApO1xuXHRcdFx0cmV0dXJuIHJlamVjdGVkX3N0YWdlKCBjb25maWcuaW5pdGlhbGl6YXRpb25fZXJyb3IgfHwgY29uZmlnLmVycm9yICk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGV4ZWN1dGVfc2NyaXB0cyggc2NyaXB0cywgZnVuY3Rpb24gKCkge1xuXHRcdFx0cmV0dXJuIGlzX2N1cnJlbnRfcmVxdWVzdCggJHJvb3QsIHJlcXVlc3RfaWQgKTtcblx0XHR9ICkudGhlbiggZnVuY3Rpb24gKCkge1xuXHRcdFx0aWYgKCAhIGlzX2N1cnJlbnRfcmVxdWVzdCggJHJvb3QsIHJlcXVlc3RfaWQgKSApIHtcblx0XHRcdFx0cmV0dXJuIHJlamVjdGVkX3N0YWdlKCAnJyApO1xuXHRcdFx0fVxuXHRcdFx0aW5pdGlhbGl6ZV9hamF4X2Zvcm1fY29udHJvbHMoKTtcblx0XHRcdGlmICggJ3NlcnZpY2UnID09PSBzdGFnZSApIHtcblx0XHRcdFx0cmVzdG9yZV9zZXJ2aWNlX3NlbGVjdGlvbiggJHJvb3QgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdH1cblxuXHQvKiogRGV0ZXJtaW5lIHdoZXRoZXIgYW4gQUpBWCBjYWxsYmFjayBzdGlsbCBvd25zIHRoZSBjb21wb25lbnQgc3RhdGUuICovXG5cdGZ1bmN0aW9uIGlzX2N1cnJlbnRfcmVxdWVzdCggJHJvb3QsIHJlcXVlc3RfaWQgKSB7XG5cdFx0cmV0dXJuIE51bWJlciggJHJvb3QuZGF0YSggJ3dwYmMtYXBwb2ludG1lbnQtcmVxdWVzdC1pZCcgKSB8fCAwICkgPT09IE51bWJlciggcmVxdWVzdF9pZCApO1xuXHR9XG5cblx0LyoqIEZpbmlzaCBvbmx5IHRoZSBjdXJyZW50IHJlcXVlc3Qgc28gc3RhbGUgY2FsbGJhY2tzIGNhbm5vdCBhbHRlciB0aGUgVUkuICovXG5cdGZ1bmN0aW9uIGZpbmlzaF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApIHtcblx0XHRpZiAoICEgaXNfY3VycmVudF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHQkcm9vdC5yZW1vdmVEYXRhKCAnd3BiYy1hcHBvaW50bWVudC1yZXF1ZXN0JyApO1xuXHRcdHNldF9sb2FkaW5nKCAkcm9vdCwgZmFsc2UgKTtcblx0fVxuXG5cdC8qKiBSZXF1ZXN0IGFuZCByZW5kZXIgdGhlIG5leHQgQXBwb2ludG1lbnQgd29ya2Zsb3cgc3RhZ2UuICovXG5cdGZ1bmN0aW9uIHJlc29sdmVfc3RhZ2UoICRyb290LCBzZXJ2aWNlX2lkLCBwcm92aWRlcl9pZCApIHtcblx0XHRpZiAoICEgJHJvb3QgfHwgISAkcm9vdC5sZW5ndGggKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0c2VydmljZV9pZCA9IE51bWJlciggc2VydmljZV9pZCB8fCAwICk7XG5cdFx0cHJvdmlkZXJfaWQgPSBOdW1iZXIoIHByb3ZpZGVyX2lkIHx8IDAgKTtcblx0XHRpZiAoIHNlcnZpY2VfaWQgKSB7XG5cdFx0XHQkcm9vdC5hdHRyKCAnZGF0YS1zZWxlY3RlZC1zZXJ2aWNlLWlkJywgc2VydmljZV9pZCApO1xuXHRcdH1cblx0XHRpZiAoIHByb3ZpZGVyX2lkICkge1xuXHRcdFx0JHJvb3QuYXR0ciggJ2RhdGEtc2VsZWN0ZWQtcHJvdmlkZXItaWQnLCBwcm92aWRlcl9pZCApO1xuXHRcdH1cblxuXHRcdHZhciBwcmV2aW91c19yZXF1ZXN0ID0gJHJvb3QuZGF0YSggJ3dwYmMtYXBwb2ludG1lbnQtcmVxdWVzdCcgKTtcblx0XHR2YXIgcmVxdWVzdF9pZCA9IE51bWJlciggJHJvb3QuZGF0YSggJ3dwYmMtYXBwb2ludG1lbnQtcmVxdWVzdC1pZCcgKSB8fCAwICkgKyAxO1xuXHRcdCRyb290LmRhdGEoICd3cGJjLWFwcG9pbnRtZW50LXJlcXVlc3QtaWQnLCByZXF1ZXN0X2lkICk7XG5cdFx0aWYgKCBwcmV2aW91c19yZXF1ZXN0ICYmIHByZXZpb3VzX3JlcXVlc3QucmVhZHlTdGF0ZSAhPT0gNCApIHtcblx0XHRcdHByZXZpb3VzX3JlcXVlc3QuYWJvcnQoKTtcblx0XHR9XG5cblx0XHRjbGVhcl9lcnJvciggJHJvb3QgKTtcblx0XHRzZXRfbG9hZGluZyggJHJvb3QsIHRydWUgKTtcblx0XHR2YXIgcmVxdWVzdCA9ICQucG9zdCggY29uZmlnLmFqYXhfdXJsLCB7XG5cdFx0XHRhY3Rpb246IGNvbmZpZy5hY3Rpb24sXG5cdFx0XHRub25jZTogY29uZmlnLm5vbmNlLFxuXHRcdFx0Y29uZmlnX3Rva2VuOiAkcm9vdC5hdHRyKCAnZGF0YS1jb25maWctdG9rZW4nICkgfHwgJycsXG5cdFx0XHRzZXJ2aWNlX2lkOiBzZXJ2aWNlX2lkLFxuXHRcdFx0cHJvdmlkZXJfaWQ6IHByb3ZpZGVyX2lkXG5cdFx0fSApO1xuXHRcdCRyb290LmRhdGEoICd3cGJjLWFwcG9pbnRtZW50LXJlcXVlc3QnLCByZXF1ZXN0ICk7XG5cblx0XHRyZXF1ZXN0LmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRpZiAoICEgaXNfY3VycmVudF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgcmVzcG9uc2UgfHwgISByZXNwb25zZS5zdWNjZXNzIHx8ICEgcmVzcG9uc2UuZGF0YSApIHtcblx0XHRcdFx0c2hvd19lcnJvcihcblx0XHRcdFx0XHQkcm9vdCxcblx0XHRcdFx0XHRyZXNwb25zZSAmJiByZXNwb25zZS5kYXRhICYmIHJlc3BvbnNlLmRhdGEubWVzc2FnZSA/IHJlc3BvbnNlLmRhdGEubWVzc2FnZSA6IGNvbmZpZy5lcnJvcixcblx0XHRcdFx0XHRyZXNwb25zZSAmJiByZXNwb25zZS5kYXRhID8gcmVzcG9uc2UuZGF0YS5hY3Rpb25fdXJsIDogJycsXG5cdFx0XHRcdFx0cmVzcG9uc2UgJiYgcmVzcG9uc2UuZGF0YSA/IHJlc3BvbnNlLmRhdGEuYWN0aW9uX2xhYmVsIDogJydcblx0XHRcdFx0KTtcblx0XHRcdFx0ZmluaXNoX3JlcXVlc3QoICRyb290LCByZXF1ZXN0X2lkICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dmFyIHN0YWdlID0gcmVzcG9uc2UuZGF0YS5zdGFnZSB8fCAnJztcblx0XHRcdHZhciByZXBsYWNlbWVudCA9IHJlcGxhY2Vfc3RhZ2UoICRyb290LCByZXNwb25zZS5kYXRhLmh0bWwsIHN0YWdlLCByZXNwb25zZS5kYXRhLnByb3ZpZGVyX2lkLCByZXF1ZXN0X2lkICk7XG5cdFx0XHRyZXBsYWNlbWVudC5kb25lKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmICggISBpc19jdXJyZW50X3JlcXVlc3QoICRyb290LCByZXF1ZXN0X2lkICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggTnVtYmVyKCByZXNwb25zZS5kYXRhLnNlcnZpY2VfaWQgfHwgMCApICkge1xuXHRcdFx0XHRcdCRyb290LmF0dHIoICdkYXRhLXNlbGVjdGVkLXNlcnZpY2UtaWQnLCBOdW1iZXIoIHJlc3BvbnNlLmRhdGEuc2VydmljZV9pZCApICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBOdW1iZXIoIHJlc3BvbnNlLmRhdGEucHJvdmlkZXJfaWQgfHwgMCApICkge1xuXHRcdFx0XHRcdCRyb290LmF0dHIoICdkYXRhLXNlbGVjdGVkLXByb3ZpZGVyLWlkJywgTnVtYmVyKCByZXNwb25zZS5kYXRhLnByb3ZpZGVyX2lkICkgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRmaW5pc2hfcmVxdWVzdCggJHJvb3QsIHJlcXVlc3RfaWQgKTtcblx0XHRcdFx0Zm9jdXNfc3RhZ2UoICRyb290ICk7XG5cdFx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCBlcnJvciApIHtcblx0XHRcdFx0aWYgKCAhIGlzX2N1cnJlbnRfcmVxdWVzdCggJHJvb3QsIHJlcXVlc3RfaWQgKSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFyIG1lc3NhZ2UgPSBlcnJvciAmJiBlcnJvci53cGJjX21lc3NhZ2UgPyBlcnJvci53cGJjX21lc3NhZ2UgOiAoIGNvbmZpZy5pbml0aWFsaXphdGlvbl9lcnJvciB8fCBjb25maWcuZXJyb3IgKTtcblx0XHRcdFx0c2hvd19lcnJvciggJHJvb3QsIG1lc3NhZ2UgKTtcblx0XHRcdFx0ZmluaXNoX3JlcXVlc3QoICRyb290LCByZXF1ZXN0X2lkICk7XG5cdFx0XHR9ICk7XG5cdFx0fSApLmZhaWwoIGZ1bmN0aW9uICggeGhyLCBzdGF0dXMgKSB7XG5cdFx0XHRpZiAoICdhYm9ydCcgPT09IHN0YXR1cyB8fCAhIGlzX2N1cnJlbnRfcmVxdWVzdCggJHJvb3QsIHJlcXVlc3RfaWQgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dmFyIHJlc3BvbnNlID0geGhyLnJlc3BvbnNlSlNPTjtcblx0XHRcdHNob3dfZXJyb3IoXG5cdFx0XHRcdCRyb290LFxuXHRcdFx0XHRyZXNwb25zZSAmJiByZXNwb25zZS5kYXRhICYmIHJlc3BvbnNlLmRhdGEubWVzc2FnZSA/IHJlc3BvbnNlLmRhdGEubWVzc2FnZSA6IGNvbmZpZy5lcnJvcixcblx0XHRcdFx0cmVzcG9uc2UgJiYgcmVzcG9uc2UuZGF0YSA/IHJlc3BvbnNlLmRhdGEuYWN0aW9uX3VybCA6ICcnLFxuXHRcdFx0XHRyZXNwb25zZSAmJiByZXNwb25zZS5kYXRhID8gcmVzcG9uc2UuZGF0YS5hY3Rpb25fbGFiZWwgOiAnJ1xuXHRcdFx0KTtcblx0XHRcdGZpbmlzaF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApO1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKiBIYW5kbGUgU2VydmljZSBhbmQgUHJvdmlkZXIgZmFsbGJhY2sgZm9ybXMgdGhyb3VnaCBBSkFYLiAqL1xuXHQkKCBkb2N1bWVudCApLm9uKCAnc3VibWl0JywgJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX3NlbGVjdGlvbl9mb3JtJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRpZiAoICEgY29uZmlnLmFqYXhfdXJsIHx8ICEgY29uZmlnLmFjdGlvbiApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHR2YXIgJGZvcm0gPSAkKCB0aGlzICk7XG5cdFx0dmFyICRyb290ID0gJGZvcm0uY2xvc2VzdCggJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnQnICk7XG5cdFx0cmVzb2x2ZV9zdGFnZSggJHJvb3QsIGdldF9zZWxlY3RlZF9pZCggJGZvcm0sICd3cGJjX2FwcG9pbnRtZW50X3NlcnZpY2UnICksIGdldF9zZWxlY3RlZF9pZCggJGZvcm0sICd3cGJjX2FwcG9pbnRtZW50X3Byb3ZpZGVyJyApICk7XG5cdH0gKTtcblxuXHQvKiogS2VlcCBwbGF0ZSBzZWxlY3Rpb24gc3R5bGluZyBpbmRlcGVuZGVudCBmcm9tIENTUyA6aGFzKCkgc3VwcG9ydC4gKi9cblx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19jaG9pY2UgPiBpbnB1dCcsIGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgJGlucHV0ID0gJCggdGhpcyApO1xuXHRcdCRpbnB1dC5jbG9zZXN0KCAnLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fY2hvaWNlcycgKS5maW5kKCAnLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fY2hvaWNlJyApLnJlbW92ZUNsYXNzKCAnaXMtc2VsZWN0ZWQnICk7XG5cdFx0JGlucHV0LmNsb3Nlc3QoICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19jaG9pY2UnICkuYWRkQ2xhc3MoICdpcy1zZWxlY3RlZCcgKTtcblx0fSApO1xuXG5cdC8qKiBGaWx0ZXIgU2VydmljZSBhbmQgUHJvdmlkZXIgY2FyZHMgd2l0aG91dCBjaGFuZ2luZyB0aGUgc2lnbmVkIGNhdGFsb2cuICovXG5cdCQoIGRvY3VtZW50ICkub24oICdpbnB1dCBzZWFyY2gnLCAnW2RhdGEtd3BiYy1hcHBvaW50bWVudC1jYXRhbG9nLXNlYXJjaF0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0ZmlsdGVyX2FwcG9pbnRtZW50X2NhdGFsb2coICQoIHRoaXMgKS5jbG9zZXN0KCAnW2RhdGEtd3BiYy1hcHBvaW50bWVudC1jYXRhbG9nXScgKSApO1xuXHR9ICk7XG5cblx0LyoqIFJldHVybiB0byBTZXJ2aWNlIHNlbGVjdGlvbiB3aGlsZSBwcmVzZXJ2aW5nIHRoZSBsYXN0IHZhbGlkIFNlcnZpY2UuICovXG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50IFtkYXRhLWFwcG9pbnRtZW50LWJhY2s9XCJzZXJ2aWNlXCJdJywgZnVuY3Rpb24gKCkge1xuXHRcdHZhciAkcm9vdCA9ICQoIHRoaXMgKS5jbG9zZXN0KCAnLndwYmNfYm9va2luZ19hcHBvaW50bWVudCcgKTtcblx0XHRpZiAoICRyb290Lmhhc0NsYXNzKCAnaXMtbG9hZGluZycgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cmVzb2x2ZV9zdGFnZSggJHJvb3QsIDAsIDAgKTtcblx0fSApO1xuXG5cdC8qKiBSZXR1cm4gdG8gdGhlIGZpcnN0IHNlbGVjdGFibGUgQXBwb2ludG1lbnQgc3RhZ2Ugd2l0aG91dCByZWxvYWRpbmcgdGhlIHBhZ2UuICovXG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50IFtkYXRhLXdwYmMtYXBwb2ludG1lbnQtYWN0aW9uPVwic3RhcnQtb3ZlclwiXSwgLndwYmNfYm9va2luZ19hcHBvaW50bWVudCAud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19jaGFuZ2UnLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdGlmICggISBjb25maWcuYWpheF91cmwgfHwgISBjb25maWcuYWN0aW9uICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdHZhciAkcm9vdCA9ICQoIHRoaXMgKS5jbG9zZXN0KCAnLndwYmNfYm9va2luZ19hcHBvaW50bWVudCcgKTtcblx0XHRpZiAoICRyb290Lmhhc0NsYXNzKCAnaXMtbG9hZGluZycgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0JHJvb3QucmVtb3ZlQXR0ciggJ2RhdGEtc2VsZWN0ZWQtc2VydmljZS1pZCBkYXRhLXNlbGVjdGVkLXByb3ZpZGVyLWlkJyApO1xuXHRcdHJlc29sdmVfc3RhZ2UoICRyb290LCAwLCAwICk7XG5cdH0gKTtcblxuXHQvKiogQWRkIHRoZSByZWdpc3RlcmVkIHNpZ25lZCBhbmQgc2VydmVyLWF1dGhvcml6ZWQgY29udGV4dCB0byB0aGUgY29yZSBib29raW5nIHJlcXVlc3QuICovXG5cdCQoICdib2R5JyApLm9uKCAnd3BiY19iZWZvcmVfYm9va2luZ19jcmVhdGUud3BiY19ib29raW5nX2FwcG9pbnRtZW50JywgZnVuY3Rpb24gKCBldmVudCwgcmVzb3VyY2VfaWQsIHBhcmFtcyApIHtcblx0XHR2YXIgY29udGV4dCA9IGdldF9uYXRpdmVfY29udGV4dCggcmVzb3VyY2VfaWQgKTtcblx0XHRpZiAoICEgY29udGV4dCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cGFyYW1zLnNlcnZpY2VfaWQgPSBjb250ZXh0LnNlcnZpY2VfaWQ7XG5cdFx0cGFyYW1zLmFwcG9pbnRtZW50X3NlcnZpY2VfcmVxdWlyZWQgPSAxO1xuXHRcdHBhcmFtcy5hcHBvaW50bWVudF9jb250ZXh0X3Rva2VuID0gY29udGV4dC5jb250ZXh0X3Rva2VuO1xuXHRcdHBhcmFtcy5hbGxvd19wYXN0ID0gY29udGV4dC5hbGxvd19wYXN0O1xuXHR9ICk7XG5cblx0LyoqIEFkZCB0aGUgc2lnbmVkIEFwcG9pbnRtZW50IHBhaXIgdG8gdGhlIGV4aXN0aW5nIGxpdmUtY29zdCByZXF1ZXN0LiAqL1xuXHQkKCBkb2N1bWVudCApLm9uKCAnd3BiY19iZWZvcmVfY29zdF9yZXF1ZXN0LndwYmNfYm9va2luZ19hcHBvaW50bWVudCcsIGZ1bmN0aW9uICggZXZlbnQsIHJlc291cmNlX2lkLCBwYXJhbXMgKSB7XG5cdFx0dmFyIGNvbnRleHQgPSBnZXRfbmF0aXZlX2NvbnRleHQoIHJlc291cmNlX2lkICk7XG5cdFx0aWYgKCAhIGNvbnRleHQgfHwgISBwYXJhbXMgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHBhcmFtcy5hcHBvaW50bWVudF9zZXJ2aWNlX2lkID0gY29udGV4dC5zZXJ2aWNlX2lkO1xuXHRcdHBhcmFtcy5hcHBvaW50bWVudF9jb250ZXh0X3Rva2VuID0gY29udGV4dC5jb250ZXh0X3Rva2VuO1xuXHR9ICk7XG5cblx0LyoqIFJldHJ5IGEgbWF0Y2hpbmcgc2VlZCB3aGVuIHRoZSBjb3JlIGNhbGVuZGFyIGZpbmlzaGVzIEFKQVggaHlkcmF0aW9uLiAqL1xuXHQkKCAnYm9keScgKS5vZmYoICd3cGJjX2NhbGVuZGFyX2FqeF9fbG9hZGVkX2RhdGEud3BiY19ib29raW5nX2FwcG9pbnRtZW50X2luaXRpYWxfZGF0ZXMnICkub24oXG5cdFx0J3dwYmNfY2FsZW5kYXJfYWp4X19sb2FkZWRfZGF0YS53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfaW5pdGlhbF9kYXRlcycsXG5cdFx0ZnVuY3Rpb24gKCBldmVudCwgbG9hZGVkX3Jlc291cmNlX2lkICkge1xuXHRcdFx0JCggJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX25hdGl2ZV9mb3JtJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0dmFyICRuYXRpdmUgPSAkKCB0aGlzICk7XG5cdFx0XHRcdHZhciBpbml0aWFsX2NvbnRleHQgPSBnZXRfaW5pdGlhbF9jYWxlbmRhcl9jb250ZXh0KCAkbmF0aXZlICk7XG5cdFx0XHRcdHZhciBzdGF0ZTtcblxuXHRcdFx0XHRpZiAoICEgaW5pdGlhbF9jb250ZXh0IHx8IGluaXRpYWxfY29udGV4dC5wcm92aWRlcl9pZCAhPT0gTnVtYmVyKCBsb2FkZWRfcmVzb3VyY2VfaWQgfHwgMCApICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHN0YXRlID0gZ2V0X2luaXRpYWxfY2FsZW5kYXJfc3RhdGUoICRuYXRpdmUgKTtcblx0XHRcdFx0c3RhdGUuY2FsZW5kYXJfZGF0YV9sb2FkZWQgPSB0cnVlO1xuXHRcdFx0XHRzdGF0ZS5hdHRlbXB0cyA9IDA7XG5cdFx0XHRcdHNjaGVkdWxlX2luaXRpYWxfY2FsZW5kYXJfZGF0ZXMoICRuYXRpdmUgKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cdCk7XG5cblx0JCggZnVuY3Rpb24gKCkge1xuXHRcdCQoICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50JyApLmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciAkcm9vdCA9ICQoIHRoaXMgKTtcblx0XHRcdCRyb290LmZpbmQoICdbZGF0YS13cGJjLWFwcG9pbnRtZW50LWNhdGFsb2ddJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0ZmlsdGVyX2FwcG9pbnRtZW50X2NhdGFsb2coICQoIHRoaXMgKSApO1xuXHRcdFx0fSApO1xuXHRcdFx0dmFyICRuYXRpdmUgPSAkcm9vdC5maW5kKCAnLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fbmF0aXZlX2Zvcm0nICkuZmlyc3QoKTtcblx0XHRcdGlmICggJG5hdGl2ZS5sZW5ndGggKSB7XG5cdFx0XHRcdCRyb290LmF0dHIoICdkYXRhLXNlbGVjdGVkLXNlcnZpY2UtaWQnLCBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3NlcnZpY2UtaWQnICkgfHwgMCApICk7XG5cdFx0XHRcdCRyb290LmF0dHIoICdkYXRhLXNlbGVjdGVkLXByb3ZpZGVyLWlkJywgTnVtYmVyKCAkbmF0aXZlLmRhdGEoICdwcm92aWRlci1pZCcgKSB8fCAwICkgKTtcblx0XHRcdH1cblx0XHRcdGlmICggISBwcmVwYXJlX25hdGl2ZV9mb3JtKCAkcm9vdCApICkge1xuXHRcdFx0XHR2YXIgZHVwbGljYXRlID0gJG5hdGl2ZS5sZW5ndGggJiYgaGFzX2R1cGxpY2F0ZV9wcm92aWRlcl9mb3JtKCAkcm9vdCwgTnVtYmVyKCAkbmF0aXZlLmRhdGEoICdwcm92aWRlci1pZCcgKSB8fCAwICkgKTtcblx0XHRcdFx0Y2xlYW51cF9uYXRpdmVfZm9ybSggJHJvb3QgKTtcblx0XHRcdFx0JHJvb3QuZmluZCggJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX25hdGl2ZV9mb3JtIDppbnB1dCcgKS5wcm9wKCAnZGlzYWJsZWQnLCB0cnVlICk7XG5cdFx0XHRcdHNob3dfZXJyb3IoICRyb290LCBkdXBsaWNhdGUgPyBjb25maWcuZHVwbGljYXRlX3Byb3ZpZGVyIDogY29uZmlnLmluaXRpYWxpemF0aW9uX2Vycm9yICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9ICk7XG59ICkoIHdpbmRvdywgalF1ZXJ5ICk7XG4iXSwibWFwcGluZ3MiOiI7O0FBQUEsQ0FBRSxVQUFXQSxN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
