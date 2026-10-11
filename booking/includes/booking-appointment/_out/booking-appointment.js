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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvYm9va2luZy1hcHBvaW50bWVudC9fb3V0L2Jvb2tpbmctYXBwb2ludG1lbnQuanMiLCJuYW1lcyI6WyJ3aW5kb3ciLCIkIiwiY29uZmlnIiwid3BiY19ib29raW5nX2FwcG9pbnRtZW50X2NvbmZpZyIsImFjdGl2ZV9uYXRpdmVfY29udGV4dHMiLCJsb2FkZWRfc2NyaXB0X3VybHMiLCJlYWNoIiwiU3RyaW5nIiwic3JjIiwiZ2V0X3NlbGVjdGVkX2lkIiwiJGZvcm0iLCJuYW1lIiwiTnVtYmVyIiwiZmluZCIsImZpcnN0IiwidmFsIiwiZmlsdGVyX2FwcG9pbnRtZW50X2NhdGFsb2ciLCIkY2F0YWxvZyIsInNlYXJjaF90ZXJtIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJ0cmltIiwiY2F0YWxvZ190eXBlIiwiYXR0ciIsInZpc2libGVfY291bnQiLCIkY2FyZCIsInNlYXJjaGFibGVfdGV4dCIsImlzX3Zpc2libGUiLCJpbmRleE9mIiwiJGNob2ljZV9pbnB1dCIsInByb3AiLCJyZW1vdmVDbGFzcyIsInRleHQiLCJwcm92aWRlcl9mb3VuZCIsInByb3ZpZGVyc19mb3VuZCIsInNlcnZpY2VfZm91bmQiLCJzZXJ2aWNlc19mb3VuZCIsInNldF9sb2FkaW5nIiwiJHJvb3QiLCJpc19sb2FkaW5nIiwidG9nZ2xlQ2xhc3MiLCJzaG93X2Vycm9yIiwibWVzc2FnZSIsImFjdGlvbl91cmwiLCJhY3Rpb25fbGFiZWwiLCIkbm90aWNlIiwiZW1wdHkiLCJhcHBlbmQiLCJlcnJvciIsImhyZWYiLCJnZXQiLCJmb2N1cyIsInRyaWdnZXIiLCJjbGVhcl9lcnJvciIsImdldF9uYXRpdmVfY29udGV4dCIsInByb3ZpZGVyX2lkIiwiY29udGV4dCIsImVsZW1lbnQiLCJkb2N1bWVudCIsImRvY3VtZW50RWxlbWVudCIsImNvbnRhaW5zIiwiaGFzX2R1cGxpY2F0ZV9wcm92aWRlcl9mb3JtIiwiZmlsdGVyIiwibGVuZ3RoIiwicmVnaXN0ZXJfbmF0aXZlX2Zvcm0iLCIkbmF0aXZlIiwiZGF0YSIsInNlcnZpY2VfaWQiLCJjb250ZXh0X3Rva2VuIiwiYWxsb3dfcGFzdCIsImV4aXN0aW5nIiwidW5yZWdpc3Rlcl9uYXRpdmVfZm9ybSIsImdldF9zdGFydF90aW1lX2ZpZWxkIiwibm90IiwiZ2V0X3NlbGVjdGVkX2RhdGVzIiwid3BiY19nZXRfX3NlbGVjdGVkX2RhdGVzX3NxbF9fYXNfYXJyIiwidmFsdWUiLCJzcGxpdCIsIm1hcCIsImRhdGVfdmFsdWUiLCJwYXJ0cyIsInRlc3QiLCJnZXRfdGltZV9zZWxlY3Rpb24iLCIkc3RhcnQiLCJkYXRlcyIsInN0YXJ0X3RpbWUiLCJjb21wbGV0ZSIsInNpZ25hdHVyZSIsImpvaW4iLCJpc190aW1lX3NlbGVjdGlvbl9zdGFnZV9hY3RpdmUiLCJzZWxlY3Rpb24iLCIkc3RlcCIsImNsb3Nlc3QiLCJpcyIsImhhc0NsYXNzIiwiZ2V0X3RpbWVfbm90aWNlX2FuY2hvciIsIiRwaWNrZXIiLCJuZXh0QWxsIiwiY2xlYXJfdGltZV9ub3RpY2UiLCJyZW1vdmUiLCJyZW1vdmVBdHRyIiwic2hvd190aW1lX25vdGljZSIsIiRhbmNob3IiLCJyb2xlIiwidmFsaWRhdGlvbl9lcnJvciIsImluc2VydEFmdGVyIiwiZ2V0X3RpbWVfdmFsaWRhdGlvbl9zdGF0ZSIsInN0YXRlIiwic2VxdWVuY2UiLCJzdGF0dXMiLCJyZXF1ZXN0IiwicHJvbWlzZSIsInRpbWVyIiwiYXZhaWxhYmlsaXR5X3NlcXVlbmNlIiwiYXZhaWxhYmlsaXR5X3JlcXVlc3QiLCJhdmFpbGFiaWxpdHlfdGltZXIiLCJhdmFpbGFibGVfc2xvdHMiLCJjbGVhcl9hcHBvaW50bWVudF9kaXNhYmxlZF90aW1lcyIsIiRvcHRpb24iLCJyZWZyZXNoX3N0YXJ0X3RpbWVfcGlja2VyIiwid3BiY190aW1lc2VsZWN0b3IiLCJnZXRfY29yZV9hdmFpbGFibGVfc3RhcnRfdGltZXMiLCJ2YWx1ZXMiLCJhcHBvaW50bWVudF9kaXNhYmxlZCIsInB1c2giLCJkZWJ1Z190aW1lX3RvX21pbnV0ZXMiLCJ0aW1lX3ZhbHVlIiwiZGVidWdfZm9ybWF0X21pbnV0ZXMiLCJ0b3RhbF9taW51dGVzIiwiZGF5X29mZnNldCIsImhvdXJzIiwiTWF0aCIsImZsb29yIiwic2xpY2UiLCJtaW51dGVzIiwibG9nX3N0YXJ0X3RpbWVfZmlsdGVyX3JlcXVlc3QiLCJzdGFydF90aW1lcyIsImNvbnNvbGUiLCJpbmZvIiwiaW5pdGlhbF9zdGFydF90aW1lcyIsImxvZ19zdGFydF90aW1lX2ZpbHRlcl9yZXN1bHQiLCJidWZmZXJfYmVmb3JlIiwiYnVmZmVyX2FmdGVyIiwiYmxvY2tlZCIsIk9iamVjdCIsImtleXMiLCJzbG90cyIsImZvckVhY2giLCJyZXN1bHQiLCJ2YWxpZCIsImVuZF90aW1lIiwic3RhcnRfbWludXRlcyIsImVuZF9taW51dGVzIiwiYXBwb2ludG1lbnRfdGltZSIsInByb3ZpZGVyX3Jlc2VydmVkIiwicmVhc29uIiwiY29kZSIsImR1cmF0aW9uX21pbnV0ZXMiLCJkdXJhdGlvbiIsImJ1ZmZlcl9iZWZvcmVfbWludXRlcyIsImJ1ZmZlcl9hZnRlcl9taW51dGVzIiwiYmxvY2tlZF9zdGFydF90aW1lcyIsIml0ZW0iLCJ0YWJsZSIsImFwcGx5X2F2YWlsYWJsZV9zdGFydF90aW1lcyIsImluaXRpYWxfc3RhcnRfdGltZSIsInNlbGVjdGVkX3ZhbHVlIiwic2VsZWN0ZWRfbWVzc2FnZSIsImxvYWRfYXZhaWxhYmxlX3N0YXJ0X3RpbWVzIiwicmVhZHlTdGF0ZSIsImFib3J0IiwicG9zdCIsImFqYXhfdXJsIiwiYWN0aW9uIiwidmFsaWRhdGVfYWN0aW9uIiwibm9uY2UiLCJkb25lIiwicmVzcG9uc2UiLCJzdWNjZXNzIiwiZmFpbCIsInhociIsInNjaGVkdWxlX2F2YWlsYWJsZV9zdGFydF90aW1lcyIsImNsZWFyVGltZW91dCIsInNldFRpbWVvdXQiLCJ2YWxpZGF0ZV90aW1lX3NlbGVjdGlvbiIsIkRlZmVycmVkIiwicmVzb2x2ZSIsImRlZmVycmVkIiwicmVqZWN0IiwicmVzcG9uc2VKU09OIiwic2NoZWR1bGVfdGltZV92YWxpZGF0aW9uIiwiY2FwdHVyZV93aXphcmRfbmF2aWdhdGlvbiIsImV2ZW50IiwiJGJ1dHRvbiIsInRhcmdldCIsIndwYmNfYXBwb2ludG1lbnRfcHJlZmxpZ2h0X2J5cGFzcyIsInRhcmdldF9tYXRjaCIsIm1hdGNoIiwiY3VycmVudF9tYXRjaCIsIiRjdXJyZW50X3N0ZXAiLCIkdGltZV9zdGVwIiwicHJldmVudERlZmF1bHQiLCJzdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24iLCJjbGljayIsImluaXRpYWxpemVfdGltZV9wcmVmbGlnaHQiLCJuYXRpdmVfZWxlbWVudCIsIndwYmNfYXBwb2ludG1lbnRfdGltZV9wcmVmbGlnaHRfcmVhZHkiLCJhZGRFdmVudExpc3RlbmVyIiwib24iLCJwcmVwYXJlX25hdGl2ZV9mb3JtIiwiJHNjb3BlIiwicmVzb3VyY2VfaWQiLCJmaWVsZF9uYW1lIiwiJGR1cmF0aW9uX2ZpZWxkcyIsIiRkZXJpdmVkX3RpbWVfZmllbGRzIiwiJGZpZWxkIiwicmVwbGFjZSIsImFkZENsYXNzIiwiJGR1cmF0aW9uX3Byb3h5IiwidGFiaW5kZXgiLCJzZWxlY3RlZCIsImdldF9hYnNvbHV0ZV9zY3JpcHRfdXJsIiwidXJsIiwiYW5jaG9yIiwiY3JlYXRlRWxlbWVudCIsImV4ZWN1dGVfc2NyaXB0cyIsInNjcmlwdHMiLCJvd25zX3N0YWdlIiwiaW5kZXgiLCJzY3JpcHQiLCJ0aGVuIiwicmVqZWN0ZWRfc3RhZ2UiLCJhYnNvbHV0ZV91cmwiLCJ1bmRlZmluZWQiLCJhamF4IiwiZGF0YVR5cGUiLCJjYWNoZSIsImdsb2JhbEV2YWwiLCJpbml0aWFsaXplX2FqYXhfZm9ybV9jb250cm9scyIsIndwYmNfaG9va19faW5pdF9ib29raW5nX2Zvcm1fd2l6YXJkX2J1dHRvbnMiLCJjbGVhbnVwX25hdGl2ZV9mb3JtIiwiJGNhbGVuZGFyIiwiZGF0ZXBpY2siLCJpbnN0YW5jZSIsIl9nZXRJbnN0IiwicmVzdG9yZV9zZXJ2aWNlX3NlbGVjdGlvbiIsIiRpbnB1dCIsImZvY3VzX3N0YWdlIiwiJHRhcmdldCIsInByZXZlbnRTY3JvbGwiLCJzY3JvbGxJbnRvVmlldyIsInJlZHVjZV9tb3Rpb24iLCJtYXRjaE1lZGlhIiwibWF0Y2hlcyIsImJlaGF2aW9yIiwiYmxvY2siLCJ3cGJjX21lc3NhZ2UiLCJyZXBsYWNlX3N0YWdlIiwiaHRtbCIsInN0YWdlIiwicmVxdWVzdF9pZCIsImlzX2N1cnJlbnRfcmVxdWVzdCIsImR1cGxpY2F0ZV9wcm92aWRlciIsInBhcnNlZCIsInBhcnNlSFRNTCIsIiRjb250YWluZXIiLCJhZGRCYWNrIiwidGV4dENvbnRlbnQiLCJjb250ZW50cyIsImluaXRpYWxpemF0aW9uX2Vycm9yIiwiZmluaXNoX3JlcXVlc3QiLCJyZW1vdmVEYXRhIiwicmVzb2x2ZV9zdGFnZSIsInByZXZpb3VzX3JlcXVlc3QiLCJjb25maWdfdG9rZW4iLCJyZXBsYWNlbWVudCIsInBhcmFtcyIsImFwcG9pbnRtZW50X3NlcnZpY2VfcmVxdWlyZWQiLCJhcHBvaW50bWVudF9jb250ZXh0X3Rva2VuIiwiYXBwb2ludG1lbnRfc2VydmljZV9pZCIsImR1cGxpY2F0ZSIsImpRdWVyeSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL2Jvb2tpbmctYXBwb2ludG1lbnQvX3NyYy9ib29raW5nLWFwcG9pbnRtZW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIiggZnVuY3Rpb24gKCB3aW5kb3csICQgKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHR2YXIgY29uZmlnID0gd2luZG93LndwYmNfYm9va2luZ19hcHBvaW50bWVudF9jb25maWcgfHwge307XG5cdHZhciBhY3RpdmVfbmF0aXZlX2NvbnRleHRzID0ge307XG5cdHZhciBsb2FkZWRfc2NyaXB0X3VybHMgPSB7fTtcblxuXHQkKCAnc2NyaXB0W3NyY10nICkuZWFjaCggZnVuY3Rpb24gKCkge1xuXHRcdGxvYWRlZF9zY3JpcHRfdXJsc1sgU3RyaW5nKCB0aGlzLnNyYyB8fCAnJyApIF0gPSB0cnVlO1xuXHR9ICk7XG5cblx0LyoqIFJldHVybiBhIG5vcm1hbGl6ZWQgaW50ZWdlciBmcm9tIGEgc2VsZWN0b3IgZmllbGQuICovXG5cdGZ1bmN0aW9uIGdldF9zZWxlY3RlZF9pZCggJGZvcm0sIG5hbWUgKSB7XG5cdFx0cmV0dXJuIE51bWJlciggJGZvcm0uZmluZCggJ1tuYW1lPVwiJyArIG5hbWUgKyAnXCJdOmNoZWNrZWQsIFtuYW1lPVwiJyArIG5hbWUgKyAnXCJdW3R5cGU9XCJoaWRkZW5cIl0nICkuZmlyc3QoKS52YWwoKSB8fCAwICk7XG5cdH1cblxuXHQvKipcblx0ICogQXBwbHkgcHVibGljIHRleHQgc2VhcmNoIHRvIG9uZSBzZXJ2ZXItYXV0aG9yaXplZCBBcHBvaW50bWVudCBjYXRhbG9nLlxuXHQgKlxuXHQgKiBAcGFyYW0ge2pRdWVyeX0gJGNhdGFsb2cgQXBwb2ludG1lbnQgY2F0YWxvZyByb290LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gZmlsdGVyX2FwcG9pbnRtZW50X2NhdGFsb2coICRjYXRhbG9nICkge1xuXHRcdHZhciBzZWFyY2hfdGVybSA9IFN0cmluZyggJGNhdGFsb2cuZmluZCggJ1tkYXRhLXdwYmMtYXBwb2ludG1lbnQtY2F0YWxvZy1zZWFyY2hdJyApLnZhbCgpIHx8ICcnICkudG9Mb2NhbGVMb3dlckNhc2UoKS50cmltKCk7XG5cdFx0dmFyIGNhdGFsb2dfdHlwZSA9IFN0cmluZyggJGNhdGFsb2cuYXR0ciggJ2RhdGEtY2F0YWxvZy10eXBlJyApIHx8ICdzZXJ2aWNlcycgKTtcblx0XHR2YXIgdmlzaWJsZV9jb3VudCA9IDA7XG5cblx0XHQkY2F0YWxvZy5maW5kKCAnW2RhdGEtd3BiYy1hcHBvaW50bWVudC1jYXRhbG9nLWNhcmRdJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciAkY2FyZCA9ICQoIHRoaXMgKTtcblx0XHRcdHZhciBzZWFyY2hhYmxlX3RleHQgPSBTdHJpbmcoICRjYXJkLmF0dHIoICdkYXRhLWFwcG9pbnRtZW50LWNhdGFsb2ctc2VhcmNoJyApIHx8ICcnICkudG9Mb2NhbGVMb3dlckNhc2UoKTtcblx0XHRcdHZhciBpc192aXNpYmxlID0gISBzZWFyY2hfdGVybSB8fCBzZWFyY2hhYmxlX3RleHQuaW5kZXhPZiggc2VhcmNoX3Rlcm0gKSAhPT0gLTE7XG5cdFx0XHR2YXIgJGNob2ljZV9pbnB1dCA9ICRjYXJkLmZpbmQoICdpbnB1dFt0eXBlPVwicmFkaW9cIl0nICkuZmlyc3QoKTtcblxuXHRcdFx0JGNhcmQucHJvcCggJ2hpZGRlbicsICEgaXNfdmlzaWJsZSApO1xuXHRcdFx0JGNob2ljZV9pbnB1dC5wcm9wKCAnZGlzYWJsZWQnLCAhIGlzX3Zpc2libGUgKTtcblx0XHRcdGlmICggaXNfdmlzaWJsZSApIHtcblx0XHRcdFx0dmlzaWJsZV9jb3VudCArPSAxO1xuXHRcdFx0fSBlbHNlIGlmICggJGNob2ljZV9pbnB1dC5wcm9wKCAnY2hlY2tlZCcgKSApIHtcblx0XHRcdFx0JGNob2ljZV9pbnB1dC5wcm9wKCAnY2hlY2tlZCcsIGZhbHNlICk7XG5cdFx0XHRcdCRjYXJkLnJlbW92ZUNsYXNzKCAnaXMtc2VsZWN0ZWQnICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0JGNhdGFsb2cuZmluZCggJ1tkYXRhLXdwYmMtYXBwb2ludG1lbnQtY2F0YWxvZy1lbXB0eV0nICkucHJvcCggJ2hpZGRlbicsIDAgIT09IHZpc2libGVfY291bnQgKTtcblx0XHQkY2F0YWxvZy5maW5kKCAnW2RhdGEtd3BiYy1hcHBvaW50bWVudC1jYXRhbG9nLXN0YXR1c10nICkudGV4dChcblx0XHRcdFN0cmluZyggdmlzaWJsZV9jb3VudCApICsgJyAnICsgKFxuXHRcdFx0XHQncHJvdmlkZXJzJyA9PT0gY2F0YWxvZ190eXBlXG5cdFx0XHRcdFx0PyAoIDEgPT09IHZpc2libGVfY291bnQgPyAoIGNvbmZpZy5wcm92aWRlcl9mb3VuZCB8fCAnUHJvdmlkZXIgZm91bmQuJyApIDogKCBjb25maWcucHJvdmlkZXJzX2ZvdW5kIHx8ICdQcm92aWRlcnMgZm91bmQuJyApIClcblx0XHRcdFx0XHQ6ICggMSA9PT0gdmlzaWJsZV9jb3VudCA/ICggY29uZmlnLnNlcnZpY2VfZm91bmQgfHwgJ1NlcnZpY2UgZm91bmQuJyApIDogKCBjb25maWcuc2VydmljZXNfZm91bmQgfHwgJ1NlcnZpY2VzIGZvdW5kLicgKSApXG5cdFx0XHQpXG5cdFx0KTtcblx0fVxuXG5cdC8qKiBUb2dnbGUgb25lIGNvbXBvbmVudCBsb2FkaW5nIHN0YXRlIHdpdGhvdXQgY2xlYXJpbmcgaXRzIGN1cnJlbnQgc3RhZ2UuICovXG5cdGZ1bmN0aW9uIHNldF9sb2FkaW5nKCAkcm9vdCwgaXNfbG9hZGluZyApIHtcblx0XHQkcm9vdC50b2dnbGVDbGFzcyggJ2lzLWxvYWRpbmcnLCBpc19sb2FkaW5nICkuYXR0ciggJ2FyaWEtYnVzeScsIGlzX2xvYWRpbmcgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0JHJvb3QuZmluZCggJz4gLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fc3RhZ2UnICkuYXR0ciggJ2FyaWEtYnVzeScsIGlzX2xvYWRpbmcgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0JHJvb3QuZmluZCggJz4gLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fbG9hZGluZycgKS5wcm9wKCAnaGlkZGVuJywgISBpc19sb2FkaW5nICkuYXR0ciggJ2FyaWEtaGlkZGVuJywgaXNfbG9hZGluZyA/ICdmYWxzZScgOiAndHJ1ZScgKTtcblx0XHQkcm9vdC5maW5kKCAnLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fc2VsZWN0aW9uX2Zvcm0gOmlucHV0JyApLnByb3AoICdkaXNhYmxlZCcsIGlzX2xvYWRpbmcgKTtcblx0XHRpZiAoICEgaXNfbG9hZGluZyApIHtcblx0XHRcdCRyb290LmZpbmQoICdbZGF0YS13cGJjLWFwcG9pbnRtZW50LWNhdGFsb2ddJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0ZmlsdGVyX2FwcG9pbnRtZW50X2NhdGFsb2coICQoIHRoaXMgKSApO1xuXHRcdFx0fSApO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBEaXNwbGF5IGFuZCBmb2N1cyBhbiBBSkFYIG9yIGluaXRpYWxpemF0aW9uIGVycm9yIGluIG9uZSBjb21wb25lbnQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7alF1ZXJ5fSAkcm9vdCAgICAgICAgQXBwb2ludG1lbnQgY29tcG9uZW50IHJvb3QuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlICAgICAgRXJyb3IgbWVzc2FnZS5cblx0ICogQHBhcmFtIHtzdHJpbmd9IGFjdGlvbl91cmwgICBPcHRpb25hbCB0cnVzdGVkIGFkbWluaXN0cmF0aW9uIGFjdGlvbiBVUkwuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBhY3Rpb25fbGFiZWwgT3B0aW9uYWwgYWN0aW9uIGxpbmsgbGFiZWwuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzaG93X2Vycm9yKCAkcm9vdCwgbWVzc2FnZSwgYWN0aW9uX3VybCwgYWN0aW9uX2xhYmVsICkge1xuXHRcdHZhciAkbm90aWNlID0gJHJvb3QuZmluZCggJz4gLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fYWpheF9ub3RpY2UnICk7XG5cdFx0JG5vdGljZS5lbXB0eSgpLmFwcGVuZCggJCggJzxzcGFuPicgKS50ZXh0KCBtZXNzYWdlIHx8IGNvbmZpZy5lcnJvciB8fCAnVW5hYmxlIHRvIGxvYWQgdGhlIEFwcG9pbnRtZW50IGZvcm0uJyApICk7XG5cdFx0aWYgKCBhY3Rpb25fdXJsICYmIGFjdGlvbl9sYWJlbCApIHtcblx0XHRcdCRub3RpY2UuYXBwZW5kKCAnICcsICQoICc8YT4nLCB7ICdjbGFzcyc6ICd3cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX25vdGljZV9hY3Rpb24nLCBocmVmOiBhY3Rpb25fdXJsLCB0ZXh0OiBhY3Rpb25fbGFiZWwgfSApICk7XG5cdFx0fVxuXHRcdCRub3RpY2UucHJvcCggJ2hpZGRlbicsIGZhbHNlICk7XG5cdFx0aWYgKCAkbm90aWNlLmdldCggMCApICYmIHR5cGVvZiAkbm90aWNlLmdldCggMCApLmZvY3VzID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0JG5vdGljZS50cmlnZ2VyKCAnZm9jdXMnICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqIENsZWFyIHRoZSBjb21wb25lbnQgQUpBWCBlcnJvci4gKi9cblx0ZnVuY3Rpb24gY2xlYXJfZXJyb3IoICRyb290ICkge1xuXHRcdCRyb290LmZpbmQoICc+IC53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX2FqYXhfbm90aWNlJyApLmVtcHR5KCkucHJvcCggJ2hpZGRlbicsIHRydWUgKTtcblx0fVxuXG5cdC8qKiBSZXR1cm4gYSByZWdpc3RlcmVkIG5hdGl2ZSBjb250ZXh0IG9ubHkgd2hpbGUgaXRzIERPTSBlbGVtZW50IGlzIGxpdmUuICovXG5cdGZ1bmN0aW9uIGdldF9uYXRpdmVfY29udGV4dCggcHJvdmlkZXJfaWQgKSB7XG5cdFx0cHJvdmlkZXJfaWQgPSBOdW1iZXIoIHByb3ZpZGVyX2lkIHx8IDAgKTtcblx0XHR2YXIgY29udGV4dCA9IGFjdGl2ZV9uYXRpdmVfY29udGV4dHNbIHByb3ZpZGVyX2lkIF07XG5cdFx0aWYgKCAhIGNvbnRleHQgfHwgISBjb250ZXh0LmVsZW1lbnQgfHwgISBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY29udGFpbnMoIGNvbnRleHQuZWxlbWVudCApICkge1xuXHRcdFx0ZGVsZXRlIGFjdGl2ZV9uYXRpdmVfY29udGV4dHNbIHByb3ZpZGVyX2lkIF07XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0cmV0dXJuIGNvbnRleHQ7XG5cdH1cblxuXHQvKiogRGV0ZWN0IGFub3RoZXIgbGl2ZSBuYXRpdmUgQm9va2luZyBDYWxlbmRhciBmb3JtIGZvciB0aGUgc2FtZSBQcm92aWRlci4gKi9cblx0ZnVuY3Rpb24gaGFzX2R1cGxpY2F0ZV9wcm92aWRlcl9mb3JtKCAkcm9vdCwgcHJvdmlkZXJfaWQgKSB7XG5cdFx0cHJvdmlkZXJfaWQgPSBOdW1iZXIoIHByb3ZpZGVyX2lkIHx8IDAgKTtcblx0XHRpZiAoICEgcHJvdmlkZXJfaWQgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0dmFyIGNvbnRleHQgPSBnZXRfbmF0aXZlX2NvbnRleHQoIHByb3ZpZGVyX2lkICk7XG5cdFx0aWYgKCBjb250ZXh0ICYmICEgJC5jb250YWlucyggJHJvb3QuZ2V0KCAwICksIGNvbnRleHQuZWxlbWVudCApICkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICQoICdbaWQ9XCJib29raW5nX2Zvcm0nICsgcHJvdmlkZXJfaWQgKyAnXCJdJyApLmZpbHRlciggZnVuY3Rpb24gKCkge1xuXHRcdFx0cmV0dXJuICEgJC5jb250YWlucyggJHJvb3QuZ2V0KCAwICksIHRoaXMgKTtcblx0XHR9ICkubGVuZ3RoID4gMDtcblx0fVxuXG5cdC8qKiBSZWdpc3RlciB0aGUgZXhhY3Qgc2lnbmVkIG5hdGl2ZSBmb3JtIGNvbnRleHQgdXNlZCBieSBib29raW5nIHN1Ym1pc3Npb24uICovXG5cdGZ1bmN0aW9uIHJlZ2lzdGVyX25hdGl2ZV9mb3JtKCAkbmF0aXZlICkge1xuXHRcdHZhciBwcm92aWRlcl9pZCA9IE51bWJlciggJG5hdGl2ZS5kYXRhKCAncHJvdmlkZXItaWQnICkgfHwgMCApO1xuXHRcdHZhciBzZXJ2aWNlX2lkID0gTnVtYmVyKCAkbmF0aXZlLmRhdGEoICdzZXJ2aWNlLWlkJyApIHx8IDAgKTtcblx0XHR2YXIgY29udGV4dF90b2tlbiA9IFN0cmluZyggJG5hdGl2ZS5hdHRyKCAnZGF0YS1hcHBvaW50bWVudC1jb250ZXh0LXRva2VuJyApIHx8ICcnICk7XG5cdFx0dmFyIGFsbG93X3Bhc3QgPSAoICcxJyA9PT0gU3RyaW5nKCAkbmF0aXZlLmF0dHIoICdkYXRhLWFsbG93LXBhc3QnICkgfHwgJzAnICkgKSA/IDEgOiAwO1xuXHRcdHZhciBleGlzdGluZyA9IGdldF9uYXRpdmVfY29udGV4dCggcHJvdmlkZXJfaWQgKTtcblxuXHRcdGlmICggISBwcm92aWRlcl9pZCB8fCAhIHNlcnZpY2VfaWQgfHwgISBjb250ZXh0X3Rva2VuICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoIGV4aXN0aW5nICYmIGV4aXN0aW5nLmVsZW1lbnQgIT09ICRuYXRpdmUuZ2V0KCAwICkgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0YWN0aXZlX25hdGl2ZV9jb250ZXh0c1sgcHJvdmlkZXJfaWQgXSA9IHtcblx0XHRcdGVsZW1lbnQ6ICRuYXRpdmUuZ2V0KCAwICksXG5cdFx0XHRzZXJ2aWNlX2lkOiBzZXJ2aWNlX2lkLFxuXHRcdFx0cHJvdmlkZXJfaWQ6IHByb3ZpZGVyX2lkLFxuXHRcdFx0Y29udGV4dF90b2tlbjogY29udGV4dF90b2tlbixcblx0XHRcdGFsbG93X3Bhc3Q6IGFsbG93X3Bhc3Rcblx0XHR9O1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqIFJlbW92ZSBhIG5hdGl2ZSBmb3JtIGZyb20gdGhlIGxvY2FsIHN1Ym1pc3Npb24tY29udGV4dCByZWdpc3RyeS4gKi9cblx0ZnVuY3Rpb24gdW5yZWdpc3Rlcl9uYXRpdmVfZm9ybSggJG5hdGl2ZSApIHtcblx0XHR2YXIgcHJvdmlkZXJfaWQgPSBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3Byb3ZpZGVyLWlkJyApIHx8IDAgKTtcblx0XHR2YXIgY29udGV4dCA9IGdldF9uYXRpdmVfY29udGV4dCggcHJvdmlkZXJfaWQgKTtcblx0XHRpZiAoIGNvbnRleHQgJiYgY29udGV4dC5lbGVtZW50ID09PSAkbmF0aXZlLmdldCggMCApICkge1xuXHRcdFx0ZGVsZXRlIGFjdGl2ZV9uYXRpdmVfY29udGV4dHNbIHByb3ZpZGVyX2lkIF07XG5cdFx0fVxuXHR9XG5cblx0LyoqIFJldHVybiB0aGUgbmF0aXZlIFN0YXJ0IFRpbWUgZmllbGQgdXNlZCBieSB0aGUgZml4ZWQgU2VydmljZSBkdXJhdGlvbi4gKi9cblx0ZnVuY3Rpb24gZ2V0X3N0YXJ0X3RpbWVfZmllbGQoICRuYXRpdmUgKSB7XG5cdFx0dmFyIHByb3ZpZGVyX2lkID0gTnVtYmVyKCAkbmF0aXZlLmRhdGEoICdwcm92aWRlci1pZCcgKSB8fCAwICk7XG5cdFx0cmV0dXJuICRuYXRpdmUuZmluZCggJ1tuYW1lPVwic3RhcnR0aW1lJyArIHByb3ZpZGVyX2lkICsgJ1wiXSwgW25hbWU9XCJzdGFydHRpbWUnICsgcHJvdmlkZXJfaWQgKyAnW11cIl0nICkubm90KCAnW2RhdGEtd3BiYy1ib29raW5nLXN1Ym1pdC1pZ25vcmU9XCIxXCJdJyApLmZpcnN0KCk7XG5cdH1cblxuXHQvKiogUmV0dXJuIHNlbGVjdGVkIGNhbGVuZGFyIGRhdGVzIGluIHRoZSBzZXJ2ZXIncyBzdHJpY3QgU1FMLWRhdGUgZm9ybWF0LiAqL1xuXHRmdW5jdGlvbiBnZXRfc2VsZWN0ZWRfZGF0ZXMoICRuYXRpdmUgKSB7XG5cdFx0dmFyIHByb3ZpZGVyX2lkID0gTnVtYmVyKCAkbmF0aXZlLmRhdGEoICdwcm92aWRlci1pZCcgKSB8fCAwICk7XG5cdFx0aWYgKCBwcm92aWRlcl9pZCAmJiB0eXBlb2Ygd2luZG93LndwYmNfZ2V0X19zZWxlY3RlZF9kYXRlc19zcWxfX2FzX2FyciA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdHJldHVybiB3aW5kb3cud3BiY19nZXRfX3NlbGVjdGVkX2RhdGVzX3NxbF9fYXNfYXJyKCBwcm92aWRlcl9pZCApO1xuXHRcdH1cblxuXHRcdHZhciB2YWx1ZSA9IFN0cmluZyggJG5hdGl2ZS5maW5kKCAnI2RhdGVfYm9va2luZycgKyBwcm92aWRlcl9pZCApLnZhbCgpIHx8ICcnICk7XG5cdFx0cmV0dXJuIHZhbHVlLnNwbGl0KCAnLCcgKS5tYXAoIGZ1bmN0aW9uICggZGF0ZV92YWx1ZSApIHtcblx0XHRcdHZhciBwYXJ0cyA9ICQudHJpbSggZGF0ZV92YWx1ZSApLnNwbGl0KCAnLicgKTtcblx0XHRcdHJldHVybiAzID09PSBwYXJ0cy5sZW5ndGggPyBwYXJ0c1sgMiBdICsgJy0nICsgcGFydHNbIDEgXSArICctJyArIHBhcnRzWyAwIF0gOiAnJztcblx0XHR9ICkuZmlsdGVyKCBmdW5jdGlvbiAoIGRhdGVfdmFsdWUgKSB7XG5cdFx0XHRyZXR1cm4gL15cXGR7NH0tXFxkezJ9LVxcZHsyfSQvLnRlc3QoIGRhdGVfdmFsdWUgKTtcblx0XHR9ICk7XG5cdH1cblxuXHQvKiogUmVhZCB0aGUgY3VycmVudCBkYXRlL3N0YXJ0IHNlbGVjdGlvbiBhbmQgaXRzIHN0YWJsZSByZXF1ZXN0IHNpZ25hdHVyZS4gKi9cblx0ZnVuY3Rpb24gZ2V0X3RpbWVfc2VsZWN0aW9uKCAkbmF0aXZlICkge1xuXHRcdHZhciAkc3RhcnQgPSBnZXRfc3RhcnRfdGltZV9maWVsZCggJG5hdGl2ZSApO1xuXHRcdHZhciBkYXRlcyA9IGdldF9zZWxlY3RlZF9kYXRlcyggJG5hdGl2ZSApO1xuXHRcdHZhciBzdGFydF90aW1lID0gJHN0YXJ0Lmxlbmd0aCA/IFN0cmluZyggJHN0YXJ0LnZhbCgpIHx8ICcnICkgOiAnJztcblx0XHRyZXR1cm4ge1xuXHRcdFx0JHN0YXJ0OiAkc3RhcnQsXG5cdFx0XHRkYXRlczogZGF0ZXMsXG5cdFx0XHRzdGFydF90aW1lOiBzdGFydF90aW1lLFxuXHRcdFx0Y29tcGxldGU6ICEhICggZGF0ZXMubGVuZ3RoICYmIC9eXFxkezEsMn06XFxkezJ9KD86OlxcZHsyfSk/JC8udGVzdCggc3RhcnRfdGltZSApICksXG5cdFx0XHRzaWduYXR1cmU6IGRhdGVzLmpvaW4oICcsJyApICsgJ3wnICsgc3RhcnRfdGltZVxuXHRcdH07XG5cdH1cblxuXHQvKiogRGV0ZXJtaW5lIHdoZXRoZXIgdGhlIFN0YXJ0IFRpbWUgZmllbGQgYmVsb25ncyB0byB0aGUgdmlzaWJsZSB3aXphcmQgc3RlcC4gKi9cblx0ZnVuY3Rpb24gaXNfdGltZV9zZWxlY3Rpb25fc3RhZ2VfYWN0aXZlKCBzZWxlY3Rpb24gKSB7XG5cdFx0dmFyICRzdGVwID0gc2VsZWN0aW9uLiRzdGFydC5jbG9zZXN0KCAnLndwYmNfd2l6YXJkX3N0ZXAnICk7XG5cdFx0cmV0dXJuICEgJHN0ZXAubGVuZ3RoIHx8ICggJHN0ZXAuaXMoICc6dmlzaWJsZScgKSAmJiAhICRzdGVwLmhhc0NsYXNzKCAnd3BiY193aXphcmRfc3RlcF9oaWRkZW4nICkgKTtcblx0fVxuXG5cdC8qKiBGaW5kIHRoZSB2aXNpYmxlIFN0YXJ0IFRpbWUgVUkgYmVuZWF0aCB3aGljaCB2YWxpZGF0aW9uIGlzIGV4cGxhaW5lZC4gKi9cblx0ZnVuY3Rpb24gZ2V0X3RpbWVfbm90aWNlX2FuY2hvciggc2VsZWN0aW9uICkge1xuXHRcdHZhciAkcGlja2VyID0gc2VsZWN0aW9uLiRzdGFydC5uZXh0QWxsKCAnLndwYmNfdGltZXNfc2VsZWN0b3InICkuZmlyc3QoKTtcblx0XHRyZXR1cm4gJHBpY2tlci5sZW5ndGggPyAkcGlja2VyIDogc2VsZWN0aW9uLiRzdGFydDtcblx0fVxuXG5cdC8qKiBSZW1vdmUgdGhlIEFwcG9pbnRtZW50IGJ1ZmZlciB3YXJuaW5nIGFuZCBpbnZhbGlkIGZpZWxkIHNlbWFudGljcy4gKi9cblx0ZnVuY3Rpb24gY2xlYXJfdGltZV9ub3RpY2UoICRuYXRpdmUgKSB7XG5cdFx0JG5hdGl2ZS5maW5kKCAnLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fdGltZV9ub3RpY2UnICkucmVtb3ZlKCk7XG5cdFx0Z2V0X3N0YXJ0X3RpbWVfZmllbGQoICRuYXRpdmUgKS5yZW1vdmVBdHRyKCAnYXJpYS1pbnZhbGlkJyApLm5leHRBbGwoICcud3BiY190aW1lc19zZWxlY3RvcicgKS5maXJzdCgpLnJlbW92ZUF0dHIoICdhcmlhLWludmFsaWQnICk7XG5cdH1cblxuXHQvKiogU2hvdyBhIHBlcnNpc3RlbnQgd2FybmluZyB1c2luZyBCb29raW5nIENhbGVuZGFyJ3MgZnJvbnRlbmQgbWVzc2FnZSBVSS4gKi9cblx0ZnVuY3Rpb24gc2hvd190aW1lX25vdGljZSggJG5hdGl2ZSwgc2VsZWN0aW9uLCBtZXNzYWdlICkge1xuXHRcdGNsZWFyX3RpbWVfbm90aWNlKCAkbmF0aXZlICk7XG5cdFx0dmFyICRhbmNob3IgPSBnZXRfdGltZV9ub3RpY2VfYW5jaG9yKCBzZWxlY3Rpb24gKTtcblx0XHRpZiAoICEgJGFuY2hvci5sZW5ndGggKSB7XG5cdFx0XHQkYW5jaG9yID0gJG5hdGl2ZS5maW5kKCAnLmJrX2NhbGVuZGFyX2ZyYW1lJyApLmZpcnN0KCk7XG5cdFx0fVxuXHRcdGlmICggISAkYW5jaG9yLmxlbmd0aCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRzZWxlY3Rpb24uJHN0YXJ0LmF0dHIoICdhcmlhLWludmFsaWQnLCAndHJ1ZScgKS5uZXh0QWxsKCAnLndwYmNfdGltZXNfc2VsZWN0b3InICkuZmlyc3QoKS5hdHRyKCAnYXJpYS1pbnZhbGlkJywgJ3RydWUnICk7XG5cdFx0JCggJzxkaXY+Jywge1xuXHRcdFx0J2NsYXNzJzogJ3dwYmNfYm9va2luZ19hcHBvaW50bWVudF9fdGltZV9ub3RpY2Ugd3BiY19mcm9udF9lbmRfX21lc3NhZ2Ugd3BiY19mZV9tZXNzYWdlIHdwYmNfZmVfbWVzc2FnZV93YXJuaW5nJyxcblx0XHRcdHJvbGU6ICdhbGVydCdcblx0XHR9ICkuYXBwZW5kKCAkKCAnPGk+JywgeyAnY2xhc3MnOiAnbWVudV9pY29uIGljb24tMXggd3BiY19pY25fd2FybmluZycsICdhcmlhLWhpZGRlbic6ICd0cnVlJyB9ICkgKVxuXHRcdFx0LmFwcGVuZCggJCggJzxzcGFuPicgKS50ZXh0KCBtZXNzYWdlIHx8IGNvbmZpZy52YWxpZGF0aW9uX2Vycm9yIHx8IGNvbmZpZy5lcnJvciApIClcblx0XHRcdC5pbnNlcnRBZnRlciggJGFuY2hvciApO1xuXHR9XG5cblx0LyoqIFJldHVybiBvciBpbml0aWFsaXplIHRoZSB2YWxpZGF0aW9uIHN0YXRlIG93bmVkIGJ5IG9uZSBuYXRpdmUgZm9ybS4gKi9cblx0ZnVuY3Rpb24gZ2V0X3RpbWVfdmFsaWRhdGlvbl9zdGF0ZSggJG5hdGl2ZSApIHtcblx0XHR2YXIgc3RhdGUgPSAkbmF0aXZlLmRhdGEoICd3cGJjLWFwcG9pbnRtZW50LXRpbWUtdmFsaWRhdGlvbicgKTtcblx0XHRpZiAoICEgc3RhdGUgKSB7XG5cdFx0XHRzdGF0ZSA9IHtcblx0XHRcdFx0c2VxdWVuY2U6IDAsXG5cdFx0XHRcdHNpZ25hdHVyZTogJycsXG5cdFx0XHRcdHN0YXR1czogJ2luY29tcGxldGUnLFxuXHRcdFx0XHRyZXF1ZXN0OiBudWxsLFxuXHRcdFx0XHRwcm9taXNlOiBudWxsLFxuXHRcdFx0XHR0aW1lcjogbnVsbCxcblx0XHRcdFx0YXZhaWxhYmlsaXR5X3NlcXVlbmNlOiAwLFxuXHRcdFx0XHRhdmFpbGFiaWxpdHlfcmVxdWVzdDogbnVsbCxcblx0XHRcdFx0YXZhaWxhYmlsaXR5X3RpbWVyOiBudWxsLFxuXHRcdFx0XHRhdmFpbGFibGVfc2xvdHM6IHt9XG5cdFx0XHR9O1xuXHRcdFx0JG5hdGl2ZS5kYXRhKCAnd3BiYy1hcHBvaW50bWVudC10aW1lLXZhbGlkYXRpb24nLCBzdGF0ZSApO1xuXHRcdH1cblx0XHRyZXR1cm4gc3RhdGU7XG5cdH1cblxuXHQvKiogUmVzdG9yZSBvbmx5IG9wdGlvbiBzdGF0ZSBwcmV2aW91c2x5IG93bmVkIGJ5IHRoZSBBcHBvaW50bWVudCBmaWx0ZXIuICovXG5cdGZ1bmN0aW9uIGNsZWFyX2FwcG9pbnRtZW50X2Rpc2FibGVkX3RpbWVzKCAkc3RhcnQgKSB7XG5cdFx0JHN0YXJ0LmZpbmQoICdvcHRpb25bZGF0YS13cGJjLWFwcG9pbnRtZW50LXVuYXZhaWxhYmxlPVwiMVwiXScgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgJG9wdGlvbiA9ICQoIHRoaXMgKTtcblx0XHRcdGlmICggISAkb3B0aW9uLmhhc0NsYXNzKCAnYm9va2VkJyApICkge1xuXHRcdFx0XHQkb3B0aW9uLnByb3AoICdkaXNhYmxlZCcsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0XHQkb3B0aW9uLnJlbW92ZUF0dHIoICdkYXRhLXdwYmMtYXBwb2ludG1lbnQtdW5hdmFpbGFibGUnICk7XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqIFJlYnVpbGQgdGhlIG9wdGlvbmFsIHBsYXRlLXN0eWxlIHBpY2tlciBmcm9tIHRoZSBmaWx0ZXJlZCBuYXRpdmUgc2VsZWN0LiAqL1xuXHRmdW5jdGlvbiByZWZyZXNoX3N0YXJ0X3RpbWVfcGlja2VyKCAkc3RhcnQgKSB7XG5cdFx0aWYgKCAkc3RhcnQubGVuZ3RoICYmIHR5cGVvZiAkc3RhcnQud3BiY190aW1lc2VsZWN0b3IgPT09ICdmdW5jdGlvbicgJiYgJHN0YXJ0Lm5leHRBbGwoICcud3BiY190aW1lc19zZWxlY3RvcicgKS5sZW5ndGggKSB7XG5cdFx0XHQkc3RhcnQud3BiY190aW1lc2VsZWN0b3IoKTtcblx0XHR9XG5cdH1cblxuXHQvKiogUmVhZCBhbGwgb3B0aW9ucyBzdGlsbCBhbGxvd2VkIGJ5IHRoZSBvcmRpbmFyeSBCb29raW5nIENhbGVuZGFyIGVuZ2luZS4gKi9cblx0ZnVuY3Rpb24gZ2V0X2NvcmVfYXZhaWxhYmxlX3N0YXJ0X3RpbWVzKCAkc3RhcnQgKSB7XG5cdFx0dmFyIHZhbHVlcyA9IFtdO1xuXHRcdCRzdGFydC5maW5kKCAnb3B0aW9uJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciAkb3B0aW9uID0gJCggdGhpcyApO1xuXHRcdFx0dmFyIHZhbHVlID0gU3RyaW5nKCAkb3B0aW9uLnZhbCgpIHx8ICcnICk7XG5cdFx0XHR2YXIgYXBwb2ludG1lbnRfZGlzYWJsZWQgPSAnMScgPT09IFN0cmluZyggJG9wdGlvbi5hdHRyKCAnZGF0YS13cGJjLWFwcG9pbnRtZW50LXVuYXZhaWxhYmxlJyApIHx8ICcnICk7XG5cdFx0XHRpZiAoIC9eXFxkezEsMn06XFxkezJ9KD86OlxcZHsyfSk/JC8udGVzdCggdmFsdWUgKSAmJiAoICEgJG9wdGlvbi5wcm9wKCAnZGlzYWJsZWQnICkgfHwgKCBhcHBvaW50bWVudF9kaXNhYmxlZCAmJiAhICRvcHRpb24uaGFzQ2xhc3MoICdib29rZWQnICkgKSApICkge1xuXHRcdFx0XHR2YWx1ZXMucHVzaCggdmFsdWUgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdFx0cmV0dXJuIHZhbHVlcztcblx0fVxuXG5cdC8qKiBDb252ZXJ0IGEgYnJvd3NlciB0aW1lIHN0cmluZyB0byBtaW51dGVzIGZyb20gdGhlIHN0YXJ0IG9mIGl0cyBkYXkuICovXG5cdGZ1bmN0aW9uIGRlYnVnX3RpbWVfdG9fbWludXRlcyggdGltZV92YWx1ZSApIHtcblx0XHR2YXIgcGFydHMgPSBTdHJpbmcoIHRpbWVfdmFsdWUgfHwgJycgKS5zcGxpdCggJzonICk7XG5cdFx0aWYgKCBwYXJ0cy5sZW5ndGggPCAyICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHJldHVybiAoIE51bWJlciggcGFydHNbIDAgXSApICogNjAgKSArIE51bWJlciggcGFydHNbIDEgXSApO1xuXHR9XG5cblx0LyoqIEZvcm1hdCBkZWJ1ZyB0aW1lIHdoaWxlIHJldGFpbmluZyBhIHByZXZpb3VzL25leHQtZGF5IGJvdW5kYXJ5LiAqL1xuXHRmdW5jdGlvbiBkZWJ1Z19mb3JtYXRfbWludXRlcyggdG90YWxfbWludXRlcyApIHtcblx0XHR2YXIgZGF5X29mZnNldCA9IDA7XG5cdFx0d2hpbGUgKCB0b3RhbF9taW51dGVzIDwgMCApIHtcblx0XHRcdHRvdGFsX21pbnV0ZXMgKz0gMTQ0MDtcblx0XHRcdGRheV9vZmZzZXQtLTtcblx0XHR9XG5cdFx0d2hpbGUgKCB0b3RhbF9taW51dGVzID49IDE0NDAgKSB7XG5cdFx0XHR0b3RhbF9taW51dGVzIC09IDE0NDA7XG5cdFx0XHRkYXlfb2Zmc2V0Kys7XG5cdFx0fVxuXHRcdHZhciBob3VycyA9ICggJzAnICsgTWF0aC5mbG9vciggdG90YWxfbWludXRlcyAvIDYwICkgKS5zbGljZSggLTIgKTtcblx0XHR2YXIgbWludXRlcyA9ICggJzAnICsgKCB0b3RhbF9taW51dGVzICUgNjAgKSApLnNsaWNlKCAtMiApO1xuXHRcdHJldHVybiBob3VycyArICc6JyArIG1pbnV0ZXMgKyAoIGRheV9vZmZzZXQgPyAnICgnICsgKCBkYXlfb2Zmc2V0ID4gMCA/ICcrJyA6ICcnICkgKyBkYXlfb2Zmc2V0ICsgJyBkYXkpJyA6ICcnICk7XG5cdH1cblxuXHQvKiogRXhwbGFpbiB0aGUgYXN5bmNocm9ub3VzIFNlcnZpY2UtYXdhcmUgYXZhaWxhYmlsaXR5IHBhc3MgaW4gdGhlIGNvbnNvbGUuICovXG5cdGZ1bmN0aW9uIGxvZ19zdGFydF90aW1lX2ZpbHRlcl9yZXF1ZXN0KCAkbmF0aXZlLCBkYXRlcywgc3RhcnRfdGltZXMgKSB7XG5cdFx0aWYgKCAhIHdpbmRvdy5jb25zb2xlIHx8IHR5cGVvZiB3aW5kb3cuY29uc29sZS5pbmZvICE9PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR3aW5kb3cuY29uc29sZS5pbmZvKFxuXHRcdFx0J1tCb29raW5nIENhbGVuZGFyIEFwcG9pbnRtZW50XSBSZWNoZWNraW5nIFN0YXJ0IFRpbWVzIHdpdGggU2VydmljZSBkdXJhdGlvbiBhbmQgYnVmZmVycy4gVGhlIGluaXRpYWwgbGlzdCBjb21lcyBmcm9tIFByb3ZpZGVyIGNhbGVuZGFyIGF2YWlsYWJpbGl0eSBhbmQgbWF5IG5vdyBiZSByZWR1Y2VkLicsXG5cdFx0XHR7XG5cdFx0XHRcdHNlcnZpY2VfaWQ6IE51bWJlciggJG5hdGl2ZS5kYXRhKCAnc2VydmljZS1pZCcgKSB8fCAwICksXG5cdFx0XHRcdHByb3ZpZGVyX2lkOiBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3Byb3ZpZGVyLWlkJyApIHx8IDAgKSxcblx0XHRcdFx0ZGF0ZXM6IGRhdGVzLnNsaWNlKCAwICksXG5cdFx0XHRcdGluaXRpYWxfc3RhcnRfdGltZXM6IHN0YXJ0X3RpbWVzLnNsaWNlKCAwIClcblx0XHRcdH1cblx0XHQpO1xuXHR9XG5cblx0LyoqIExvZyBvbmx5IHNjaGVkdWxpbmcgZGF0YSBuZWVkZWQgdG8gdW5kZXJzdGFuZCByZW1vdmVkIFN0YXJ0IFRpbWVzLiAqL1xuXHRmdW5jdGlvbiBsb2dfc3RhcnRfdGltZV9maWx0ZXJfcmVzdWx0KCAkbmF0aXZlLCBkYXRlcywgZGF0YSApIHtcblx0XHRpZiAoICEgd2luZG93LmNvbnNvbGUgfHwgdHlwZW9mIHdpbmRvdy5jb25zb2xlLmluZm8gIT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHZhciBidWZmZXJfYmVmb3JlID0gTnVtYmVyKCBkYXRhLmJ1ZmZlcl9iZWZvcmUgfHwgMCApO1xuXHRcdHZhciBidWZmZXJfYWZ0ZXIgPSBOdW1iZXIoIGRhdGEuYnVmZmVyX2FmdGVyIHx8IDAgKTtcblx0XHR2YXIgYmxvY2tlZCA9IFtdO1xuXHRcdE9iamVjdC5rZXlzKCBkYXRhLnNsb3RzIHx8IHt9ICkuZm9yRWFjaCggZnVuY3Rpb24gKCBzdGFydF90aW1lICkge1xuXHRcdFx0dmFyIHJlc3VsdCA9IGRhdGEuc2xvdHNbIHN0YXJ0X3RpbWUgXTtcblx0XHRcdGlmICggISByZXN1bHQgfHwgZmFsc2UgIT09IHJlc3VsdC52YWxpZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dmFyIGVuZF90aW1lID0gU3RyaW5nKCByZXN1bHQuZW5kX3RpbWUgfHwgJycgKTtcblx0XHRcdHZhciBzdGFydF9taW51dGVzID0gZGVidWdfdGltZV90b19taW51dGVzKCBzdGFydF90aW1lICk7XG5cdFx0XHR2YXIgZW5kX21pbnV0ZXMgPSBkZWJ1Z190aW1lX3RvX21pbnV0ZXMoIGVuZF90aW1lICk7XG5cdFx0XHRibG9ja2VkLnB1c2goIHtcblx0XHRcdFx0c3RhcnRfdGltZTogc3RhcnRfdGltZSxcblx0XHRcdFx0YXBwb2ludG1lbnRfdGltZTogZW5kX3RpbWUgPyBzdGFydF90aW1lICsgJyAtICcgKyBlbmRfdGltZSA6IHN0YXJ0X3RpbWUsXG5cdFx0XHRcdHByb3ZpZGVyX3Jlc2VydmVkOiBudWxsICE9PSBzdGFydF9taW51dGVzICYmIG51bGwgIT09IGVuZF9taW51dGVzXG5cdFx0XHRcdFx0PyBkZWJ1Z19mb3JtYXRfbWludXRlcyggc3RhcnRfbWludXRlcyAtIGJ1ZmZlcl9iZWZvcmUgKSArICcgLSAnICsgZGVidWdfZm9ybWF0X21pbnV0ZXMoIGVuZF9taW51dGVzICsgYnVmZmVyX2FmdGVyIClcblx0XHRcdFx0XHQ6ICcnLFxuXHRcdFx0XHRyZWFzb246IHJlc3VsdC5tZXNzYWdlIHx8IHJlc3VsdC5jb2RlIHx8IGNvbmZpZy52YWxpZGF0aW9uX2Vycm9yXG5cdFx0XHR9ICk7XG5cdFx0fSApO1xuXG5cdFx0d2luZG93LmNvbnNvbGUuaW5mbyhcblx0XHRcdCdbQm9va2luZyBDYWxlbmRhciBBcHBvaW50bWVudF0gU2VydmljZS1hd2FyZSBTdGFydCBUaW1lIGNoZWNrIGNvbXBsZXRlZC4nLFxuXHRcdFx0e1xuXHRcdFx0XHRzZXJ2aWNlX2lkOiBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3NlcnZpY2UtaWQnICkgfHwgMCApLFxuXHRcdFx0XHRwcm92aWRlcl9pZDogTnVtYmVyKCAkbmF0aXZlLmRhdGEoICdwcm92aWRlci1pZCcgKSB8fCAwICksXG5cdFx0XHRcdGRhdGVzOiBkYXRlcy5zbGljZSggMCApLFxuXHRcdFx0XHRkdXJhdGlvbl9taW51dGVzOiBOdW1iZXIoIGRhdGEuZHVyYXRpb24gfHwgMCApLFxuXHRcdFx0XHRidWZmZXJfYmVmb3JlX21pbnV0ZXM6IGJ1ZmZlcl9iZWZvcmUsXG5cdFx0XHRcdGJ1ZmZlcl9hZnRlcl9taW51dGVzOiBidWZmZXJfYWZ0ZXIsXG5cdFx0XHRcdGJsb2NrZWRfc3RhcnRfdGltZXM6IGJsb2NrZWQubWFwKCBmdW5jdGlvbiAoIGl0ZW0gKSB7IHJldHVybiBpdGVtLnN0YXJ0X3RpbWU7IH0gKVxuXHRcdFx0fVxuXHRcdCk7XG5cdFx0aWYgKCBibG9ja2VkLmxlbmd0aCAmJiB0eXBlb2Ygd2luZG93LmNvbnNvbGUudGFibGUgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHR3aW5kb3cuY29uc29sZS50YWJsZSggYmxvY2tlZCApO1xuXHRcdH1cblx0fVxuXG5cdC8qKiBBcHBseSBvbmUgc2VydmVyIHJlc3BvbnNlIHdpdGhvdXQgZXhwb3NpbmcgYW5vdGhlciBjdXN0b21lcidzIGJvb2tpbmcuICovXG5cdGZ1bmN0aW9uIGFwcGx5X2F2YWlsYWJsZV9zdGFydF90aW1lcyggJG5hdGl2ZSwgc2xvdHMgKSB7XG5cdFx0dmFyIHNlbGVjdGlvbiA9IGdldF90aW1lX3NlbGVjdGlvbiggJG5hdGl2ZSApO1xuXHRcdHZhciAkc3RhcnQgPSBzZWxlY3Rpb24uJHN0YXJ0O1xuXHRcdHZhciBpbml0aWFsX3N0YXJ0X3RpbWUgPSBTdHJpbmcoICRuYXRpdmUuYXR0ciggJ2RhdGEtaW5pdGlhbC1zdGFydC10aW1lJyApIHx8ICcnICk7XG5cdFx0dmFyIHNlbGVjdGVkX3ZhbHVlID0gc2VsZWN0aW9uLnN0YXJ0X3RpbWUgfHwgaW5pdGlhbF9zdGFydF90aW1lO1xuXHRcdHZhciBzZWxlY3RlZF9tZXNzYWdlID0gJyc7XG5cdFx0Y2xlYXJfYXBwb2ludG1lbnRfZGlzYWJsZWRfdGltZXMoICRzdGFydCApO1xuXG5cdFx0JHN0YXJ0LmZpbmQoICdvcHRpb24nICkuZWFjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyICRvcHRpb24gPSAkKCB0aGlzICk7XG5cdFx0XHR2YXIgdmFsdWUgPSBTdHJpbmcoICRvcHRpb24udmFsKCkgfHwgJycgKTtcblx0XHRcdHZhciByZXN1bHQgPSBzbG90cyAmJiBzbG90c1sgdmFsdWUgXSA/IHNsb3RzWyB2YWx1ZSBdIDogbnVsbDtcblx0XHRcdGlmICggcmVzdWx0ICYmIGZhbHNlID09PSByZXN1bHQudmFsaWQgJiYgISAkb3B0aW9uLmhhc0NsYXNzKCAnYm9va2VkJyApICkge1xuXHRcdFx0XHQkb3B0aW9uLnByb3AoICdkaXNhYmxlZCcsIHRydWUgKS5hdHRyKCAnZGF0YS13cGJjLWFwcG9pbnRtZW50LXVuYXZhaWxhYmxlJywgJzEnICk7XG5cdFx0XHRcdGlmICggc2VsZWN0ZWRfdmFsdWUgPT09IHZhbHVlICkge1xuXHRcdFx0XHRcdHNlbGVjdGVkX21lc3NhZ2UgPSByZXN1bHQubWVzc2FnZSB8fCBjb25maWcudmFsaWRhdGlvbl9lcnJvcjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gKTtcblxuXHRcdGlmICggc2VsZWN0ZWRfbWVzc2FnZSApIHtcblx0XHRcdCRzdGFydC52YWwoICcnICk7XG5cdFx0XHRzaG93X3RpbWVfbm90aWNlKCAkbmF0aXZlLCBzZWxlY3Rpb24sIHNlbGVjdGVkX21lc3NhZ2UgKTtcblx0XHR9IGVsc2UgaWYgKCBpbml0aWFsX3N0YXJ0X3RpbWUgJiYgc2xvdHMgJiYgc2xvdHNbIGluaXRpYWxfc3RhcnRfdGltZSBdICYmIGZhbHNlICE9PSBzbG90c1sgaW5pdGlhbF9zdGFydF90aW1lIF0udmFsaWQgKSB7XG5cdFx0XHQkc3RhcnQudmFsKCBpbml0aWFsX3N0YXJ0X3RpbWUgKTtcblx0XHR9XG5cdFx0JG5hdGl2ZS5yZW1vdmVBdHRyKCAnZGF0YS1pbml0aWFsLXN0YXJ0LXRpbWUnICk7XG5cdFx0cmVmcmVzaF9zdGFydF90aW1lX3BpY2tlciggJHN0YXJ0ICk7XG5cdH1cblxuXHQvKiogRmlsdGVyIHRoZSBjb21wbGV0ZSBTdGFydCBUaW1lIGxpc3Qgd2l0aCBvbmUgYm91bmRlZCBzZXJ2ZXIgcmVxdWVzdC4gKi9cblx0ZnVuY3Rpb24gbG9hZF9hdmFpbGFibGVfc3RhcnRfdGltZXMoICRuYXRpdmUgKSB7XG5cdFx0dmFyIHN0YXRlID0gZ2V0X3RpbWVfdmFsaWRhdGlvbl9zdGF0ZSggJG5hdGl2ZSApO1xuXHRcdHZhciAkc3RhcnQgPSBnZXRfc3RhcnRfdGltZV9maWVsZCggJG5hdGl2ZSApO1xuXHRcdHZhciBkYXRlcyA9IGdldF9zZWxlY3RlZF9kYXRlcyggJG5hdGl2ZSApO1xuXHRcdHZhciBzdGFydF90aW1lcyA9IGdldF9jb3JlX2F2YWlsYWJsZV9zdGFydF90aW1lcyggJHN0YXJ0ICk7XG5cdFx0dmFyIHNlcXVlbmNlID0gKytzdGF0ZS5hdmFpbGFiaWxpdHlfc2VxdWVuY2U7XG5cblx0XHRpZiAoIHN0YXRlLmF2YWlsYWJpbGl0eV9yZXF1ZXN0ICYmIDQgIT09IHN0YXRlLmF2YWlsYWJpbGl0eV9yZXF1ZXN0LnJlYWR5U3RhdGUgKSB7XG5cdFx0XHRzdGF0ZS5hdmFpbGFiaWxpdHlfcmVxdWVzdC5hYm9ydCgpO1xuXHRcdH1cblx0XHRpZiAoICEgJHN0YXJ0Lmxlbmd0aCB8fCAhIGRhdGVzLmxlbmd0aCB8fCAhIHN0YXJ0X3RpbWVzLmxlbmd0aCApIHtcblx0XHRcdGNsZWFyX2FwcG9pbnRtZW50X2Rpc2FibGVkX3RpbWVzKCAkc3RhcnQgKTtcblx0XHRcdHJlZnJlc2hfc3RhcnRfdGltZV9waWNrZXIoICRzdGFydCApO1xuXHRcdFx0c3RhdGUuYXZhaWxhYmxlX3Nsb3RzID0ge307XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGxvZ19zdGFydF90aW1lX2ZpbHRlcl9yZXF1ZXN0KCAkbmF0aXZlLCBkYXRlcywgc3RhcnRfdGltZXMgKTtcblxuXHRcdHN0YXRlLmF2YWlsYWJpbGl0eV9yZXF1ZXN0ID0gJC5wb3N0KCBjb25maWcuYWpheF91cmwsIHtcblx0XHRcdGFjdGlvbjogY29uZmlnLnZhbGlkYXRlX2FjdGlvbixcblx0XHRcdG5vbmNlOiBjb25maWcubm9uY2UsXG5cdFx0XHRzZXJ2aWNlX2lkOiBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3NlcnZpY2UtaWQnICkgfHwgMCApLFxuXHRcdFx0cHJvdmlkZXJfaWQ6IE51bWJlciggJG5hdGl2ZS5kYXRhKCAncHJvdmlkZXItaWQnICkgfHwgMCApLFxuXHRcdFx0Y29udGV4dF90b2tlbjogU3RyaW5nKCAkbmF0aXZlLmF0dHIoICdkYXRhLWFwcG9pbnRtZW50LWNvbnRleHQtdG9rZW4nICkgfHwgJycgKSxcblx0XHRcdGRhdGVzOiBkYXRlcyxcblx0XHRcdHN0YXJ0X3RpbWVzOiBzdGFydF90aW1lc1xuXHRcdH0gKTtcblx0XHRzdGF0ZS5hdmFpbGFiaWxpdHlfcmVxdWVzdC5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0aWYgKCBzZXF1ZW5jZSAhPT0gc3RhdGUuYXZhaWxhYmlsaXR5X3NlcXVlbmNlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR2YXIgZGF0YSA9IHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgPyByZXNwb25zZS5kYXRhIDoge307XG5cdFx0XHRpZiAoICEgcmVzcG9uc2UgfHwgISByZXNwb25zZS5zdWNjZXNzIHx8ICEgZGF0YS5zbG90cyApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0c3RhdGUuYXZhaWxhYmxlX3Nsb3RzID0gZGF0YS5zbG90cztcblx0XHRcdGxvZ19zdGFydF90aW1lX2ZpbHRlcl9yZXN1bHQoICRuYXRpdmUsIGRhdGVzLCBkYXRhICk7XG5cdFx0XHRhcHBseV9hdmFpbGFibGVfc3RhcnRfdGltZXMoICRuYXRpdmUsIGRhdGEuc2xvdHMgKTtcblx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCB4aHIsIHN0YXR1cyApIHtcblx0XHRcdGlmICggJ2Fib3J0JyA9PT0gc3RhdHVzIHx8IHNlcXVlbmNlICE9PSBzdGF0ZS5hdmFpbGFiaWxpdHlfc2VxdWVuY2UgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNsZWFyX2FwcG9pbnRtZW50X2Rpc2FibGVkX3RpbWVzKCAkc3RhcnQgKTtcblx0XHRcdHJlZnJlc2hfc3RhcnRfdGltZV9waWNrZXIoICRzdGFydCApO1xuXHRcdFx0c3RhdGUuYXZhaWxhYmxlX3Nsb3RzID0ge307XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqIERlYm91bmNlIHRoZSB3aG9sZS1saXN0IGZpbHRlciBhZnRlciBjb3JlIGF2YWlsYWJpbGl0eSBoYXMgcmVmcmVzaGVkLiAqL1xuXHRmdW5jdGlvbiBzY2hlZHVsZV9hdmFpbGFibGVfc3RhcnRfdGltZXMoICRuYXRpdmUgKSB7XG5cdFx0dmFyIHN0YXRlID0gZ2V0X3RpbWVfdmFsaWRhdGlvbl9zdGF0ZSggJG5hdGl2ZSApO1xuXHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIHN0YXRlLmF2YWlsYWJpbGl0eV90aW1lciApO1xuXHRcdHN0YXRlLmF2YWlsYWJpbGl0eV90aW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRsb2FkX2F2YWlsYWJsZV9zdGFydF90aW1lcyggJG5hdGl2ZSApO1xuXHRcdH0sIDMwICk7XG5cdH1cblxuXHQvKiogVmFsaWRhdGUgY3VycmVudCBTZXJ2aWNlIGR1cmF0aW9uL2J1ZmZlcnMgdGhyb3VnaCB0aGUgYXV0aG9yaXRhdGl2ZSBzZXJ2ZXIuICovXG5cdGZ1bmN0aW9uIHZhbGlkYXRlX3RpbWVfc2VsZWN0aW9uKCAkbmF0aXZlICkge1xuXHRcdHZhciBzZWxlY3Rpb24gPSBnZXRfdGltZV9zZWxlY3Rpb24oICRuYXRpdmUgKTtcblx0XHR2YXIgc3RhdGUgPSBnZXRfdGltZV92YWxpZGF0aW9uX3N0YXRlKCAkbmF0aXZlICk7XG5cdFx0aWYgKCAhIHNlbGVjdGlvbi5jb21wbGV0ZSApIHtcblx0XHRcdGlmICggc3RhdGUucmVxdWVzdCAmJiA0ICE9PSBzdGF0ZS5yZXF1ZXN0LnJlYWR5U3RhdGUgKSB7XG5cdFx0XHRcdHN0YXRlLnJlcXVlc3QuYWJvcnQoKTtcblx0XHRcdH1cblx0XHRcdHN0YXRlLnNpZ25hdHVyZSA9IHNlbGVjdGlvbi5zaWduYXR1cmU7XG5cdFx0XHRzdGF0ZS5zdGF0dXMgPSAnaW5jb21wbGV0ZSc7XG5cdFx0XHRzdGF0ZS5wcm9taXNlID0gbnVsbDtcblx0XHRcdGNsZWFyX3RpbWVfbm90aWNlKCAkbmF0aXZlICk7XG5cdFx0XHRyZXR1cm4gJC5EZWZlcnJlZCgpLnJlc29sdmUoIGZhbHNlLCAnaW5jb21wbGV0ZScgKS5wcm9taXNlKCk7XG5cdFx0fVxuXHRcdGlmICggc2VsZWN0aW9uLnNpZ25hdHVyZSA9PT0gc3RhdGUuc2lnbmF0dXJlICYmICd2YWxpZCcgPT09IHN0YXRlLnN0YXR1cyApIHtcblx0XHRcdHJldHVybiAkLkRlZmVycmVkKCkucmVzb2x2ZSggdHJ1ZSwgJ3ZhbGlkJyApLnByb21pc2UoKTtcblx0XHR9XG5cdFx0aWYgKCBzZWxlY3Rpb24uc2lnbmF0dXJlID09PSBzdGF0ZS5zaWduYXR1cmUgJiYgJ2ludmFsaWQnID09PSBzdGF0ZS5zdGF0dXMgKSB7XG5cdFx0XHRyZXR1cm4gJC5EZWZlcnJlZCgpLnJlc29sdmUoIGZhbHNlLCAnaW52YWxpZCcgKS5wcm9taXNlKCk7XG5cdFx0fVxuXHRcdGlmICggc2VsZWN0aW9uLnNpZ25hdHVyZSA9PT0gc3RhdGUuc2lnbmF0dXJlICYmICdwZW5kaW5nJyA9PT0gc3RhdGUuc3RhdHVzICYmIHN0YXRlLnByb21pc2UgKSB7XG5cdFx0XHRyZXR1cm4gc3RhdGUucHJvbWlzZTtcblx0XHR9XG5cdFx0aWYgKCBzdGF0ZS5yZXF1ZXN0ICYmIDQgIT09IHN0YXRlLnJlcXVlc3QucmVhZHlTdGF0ZSApIHtcblx0XHRcdHN0YXRlLnJlcXVlc3QuYWJvcnQoKTtcblx0XHR9XG5cblx0XHR2YXIgZGVmZXJyZWQgPSAkLkRlZmVycmVkKCk7XG5cdFx0dmFyIHNlcXVlbmNlID0gKytzdGF0ZS5zZXF1ZW5jZTtcblx0XHRzdGF0ZS5zaWduYXR1cmUgPSBzZWxlY3Rpb24uc2lnbmF0dXJlO1xuXHRcdHN0YXRlLnN0YXR1cyA9ICdwZW5kaW5nJztcblx0XHRzdGF0ZS5wcm9taXNlID0gZGVmZXJyZWQucHJvbWlzZSgpO1xuXHRcdGNsZWFyX3RpbWVfbm90aWNlKCAkbmF0aXZlICk7XG5cdFx0c3RhdGUucmVxdWVzdCA9ICQucG9zdCggY29uZmlnLmFqYXhfdXJsLCB7XG5cdFx0XHRhY3Rpb246IGNvbmZpZy52YWxpZGF0ZV9hY3Rpb24sXG5cdFx0XHRub25jZTogY29uZmlnLm5vbmNlLFxuXHRcdFx0c2VydmljZV9pZDogTnVtYmVyKCAkbmF0aXZlLmRhdGEoICdzZXJ2aWNlLWlkJyApIHx8IDAgKSxcblx0XHRcdHByb3ZpZGVyX2lkOiBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3Byb3ZpZGVyLWlkJyApIHx8IDAgKSxcblx0XHRcdGNvbnRleHRfdG9rZW46IFN0cmluZyggJG5hdGl2ZS5hdHRyKCAnZGF0YS1hcHBvaW50bWVudC1jb250ZXh0LXRva2VuJyApIHx8ICcnICksXG5cdFx0XHRkYXRlczogc2VsZWN0aW9uLmRhdGVzLFxuXHRcdFx0c3RhcnRfdGltZTogc2VsZWN0aW9uLnN0YXJ0X3RpbWVcblx0XHR9ICk7XG5cdFx0c3RhdGUucmVxdWVzdC5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0aWYgKCBzZXF1ZW5jZSAhPT0gc3RhdGUuc2VxdWVuY2UgfHwgc2VsZWN0aW9uLnNpZ25hdHVyZSAhPT0gZ2V0X3RpbWVfc2VsZWN0aW9uKCAkbmF0aXZlICkuc2lnbmF0dXJlICkge1xuXHRcdFx0XHRkZWZlcnJlZC5yZWplY3QoICdzdGFsZScgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dmFyIGRhdGEgPSByZXNwb25zZSAmJiByZXNwb25zZS5kYXRhID8gcmVzcG9uc2UuZGF0YSA6IHt9O1xuXHRcdFx0aWYgKCByZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzICYmIHRydWUgPT09IGRhdGEudmFsaWQgKSB7XG5cdFx0XHRcdHN0YXRlLnN0YXR1cyA9ICd2YWxpZCc7XG5cdFx0XHRcdGNsZWFyX3RpbWVfbm90aWNlKCAkbmF0aXZlICk7XG5cdFx0XHRcdGRlZmVycmVkLnJlc29sdmUoIHRydWUsICd2YWxpZCcgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0c3RhdGUuc3RhdHVzID0gJ2ludmFsaWQnO1xuXHRcdFx0c2hvd190aW1lX25vdGljZSggJG5hdGl2ZSwgc2VsZWN0aW9uLCBkYXRhLm1lc3NhZ2UgfHwgY29uZmlnLnZhbGlkYXRpb25fZXJyb3IgKTtcblx0XHRcdGRlZmVycmVkLnJlc29sdmUoIGZhbHNlLCAnaW52YWxpZCcgKTtcblx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCB4aHIsIHN0YXR1cyApIHtcblx0XHRcdGlmICggJ2Fib3J0JyA9PT0gc3RhdHVzIHx8IHNlcXVlbmNlICE9PSBzdGF0ZS5zZXF1ZW5jZSApIHtcblx0XHRcdFx0ZGVmZXJyZWQucmVqZWN0KCAnc3RhbGUnICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHZhciByZXNwb25zZSA9IHhoci5yZXNwb25zZUpTT047XG5cdFx0XHR2YXIgbWVzc2FnZSA9IHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5tZXNzYWdlID8gcmVzcG9uc2UuZGF0YS5tZXNzYWdlIDogY29uZmlnLnZhbGlkYXRpb25fZXJyb3I7XG5cdFx0XHRzdGF0ZS5zdGF0dXMgPSAnaW52YWxpZCc7XG5cdFx0XHRzaG93X3RpbWVfbm90aWNlKCAkbmF0aXZlLCBzZWxlY3Rpb24sIG1lc3NhZ2UgKTtcblx0XHRcdGRlZmVycmVkLnJlc29sdmUoIGZhbHNlLCAnaW52YWxpZCcgKTtcblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gc3RhdGUucHJvbWlzZTtcblx0fVxuXG5cdC8qKiBEZWJvdW5jZSB2YWxpZGF0aW9uIGFmdGVyIGNhbGVuZGFyIG9yIFN0YXJ0IFRpbWUgY2hhbmdlcy4gKi9cblx0ZnVuY3Rpb24gc2NoZWR1bGVfdGltZV92YWxpZGF0aW9uKCAkbmF0aXZlICkge1xuXHRcdHZhciBzdGF0ZSA9IGdldF90aW1lX3ZhbGlkYXRpb25fc3RhdGUoICRuYXRpdmUgKTtcblx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCBzdGF0ZS50aW1lciApO1xuXHRcdHN0YXRlLnN0YXR1cyA9ICdjaGFuZ2VkJztcblx0XHRjbGVhcl90aW1lX25vdGljZSggJG5hdGl2ZSApO1xuXHRcdGlmICggISBpc190aW1lX3NlbGVjdGlvbl9zdGFnZV9hY3RpdmUoIGdldF90aW1lX3NlbGVjdGlvbiggJG5hdGl2ZSApICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHN0YXRlLnRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhbGlkYXRlX3RpbWVfc2VsZWN0aW9uKCAkbmF0aXZlICk7XG5cdFx0fSwgMTIwICk7XG5cdH1cblxuXHQvKiogQmxvY2sgZm9yd2FyZCB3aXphcmQgbmF2aWdhdGlvbiB1bnRpbCB0aGUgY3VycmVudCB0aW1lIHByZWZsaWdodCBwYXNzZXMuICovXG5cdGZ1bmN0aW9uIGNhcHR1cmVfd2l6YXJkX25hdmlnYXRpb24oIGV2ZW50LCAkbmF0aXZlICkge1xuXHRcdHZhciAkYnV0dG9uID0gJCggZXZlbnQudGFyZ2V0ICkuY2xvc2VzdCggJy53cGJjX3dpemFyZF9zdGVwX2J1dHRvbicgKTtcblx0XHRpZiAoICEgJGJ1dHRvbi5sZW5ndGggfHwgISAkLmNvbnRhaW5zKCAkbmF0aXZlLmdldCggMCApLCAkYnV0dG9uLmdldCggMCApICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICggJGJ1dHRvbi5nZXQoIDAgKS53cGJjX2FwcG9pbnRtZW50X3ByZWZsaWdodF9ieXBhc3MgKSB7XG5cdFx0XHQkYnV0dG9uLmdldCggMCApLndwYmNfYXBwb2ludG1lbnRfcHJlZmxpZ2h0X2J5cGFzcyA9IGZhbHNlO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHZhciB0YXJnZXRfbWF0Y2ggPSBTdHJpbmcoICRidXR0b24uYXR0ciggJ2NsYXNzJyApIHx8ICcnICkubWF0Y2goIC93cGJjX3dpemFyZF9zdGVwXyhcXGQrKS8gKTtcblx0XHR2YXIgY3VycmVudF9tYXRjaCA9IFN0cmluZyggJGJ1dHRvbi5jbG9zZXN0KCAnLndwYmNfd2l6YXJkX3N0ZXAnICkuYXR0ciggJ2NsYXNzJyApIHx8ICcnICkubWF0Y2goIC93cGJjX3dpemFyZF9zdGVwKFxcZCspLyApO1xuXHRcdGlmICggISB0YXJnZXRfbWF0Y2ggfHwgKCBjdXJyZW50X21hdGNoICYmIE51bWJlciggdGFyZ2V0X21hdGNoWzFdICkgPD0gTnVtYmVyKCBjdXJyZW50X21hdGNoWzFdICkgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR2YXIgc2VsZWN0aW9uID0gZ2V0X3RpbWVfc2VsZWN0aW9uKCAkbmF0aXZlICk7XG5cdFx0dmFyICRjdXJyZW50X3N0ZXAgPSAkYnV0dG9uLmNsb3Nlc3QoICcud3BiY193aXphcmRfc3RlcCcgKTtcblx0XHR2YXIgJHRpbWVfc3RlcCA9IHNlbGVjdGlvbi4kc3RhcnQuY2xvc2VzdCggJy53cGJjX3dpemFyZF9zdGVwJyApO1xuXHRcdGlmICggJHRpbWVfc3RlcC5sZW5ndGggJiYgJGN1cnJlbnRfc3RlcC5sZW5ndGggJiYgJHRpbWVfc3RlcC5nZXQoIDAgKSAhPT0gJGN1cnJlbnRfc3RlcC5nZXQoIDAgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCAhIHNlbGVjdGlvbi5jb21wbGV0ZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dmFyIHN0YXRlID0gZ2V0X3RpbWVfdmFsaWRhdGlvbl9zdGF0ZSggJG5hdGl2ZSApO1xuXHRcdGlmICggc2VsZWN0aW9uLnNpZ25hdHVyZSA9PT0gc3RhdGUuc2lnbmF0dXJlICYmICd2YWxpZCcgPT09IHN0YXRlLnN0YXR1cyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdHZhbGlkYXRlX3RpbWVfc2VsZWN0aW9uKCAkbmF0aXZlICkuZG9uZSggZnVuY3Rpb24gKCB2YWxpZCApIHtcblx0XHRcdGlmICggdmFsaWQgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNvbnRhaW5zKCAkYnV0dG9uLmdldCggMCApICkgKSB7XG5cdFx0XHRcdCRidXR0b24uZ2V0KCAwICkud3BiY19hcHBvaW50bWVudF9wcmVmbGlnaHRfYnlwYXNzID0gdHJ1ZTtcblx0XHRcdFx0JGJ1dHRvbi5nZXQoIDAgKS5jbGljaygpO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0fVxuXG5cdC8qKiBBdHRhY2ggaXNvbGF0ZWQgYnVmZmVyIHByZWZsaWdodCBiZWhhdmlvciB0byBvbmUgbmF0aXZlIEFwcG9pbnRtZW50IGZvcm0uICovXG5cdGZ1bmN0aW9uIGluaXRpYWxpemVfdGltZV9wcmVmbGlnaHQoICRuYXRpdmUgKSB7XG5cdFx0aWYgKCAhIGNvbmZpZy5hamF4X3VybCB8fCAhIGNvbmZpZy52YWxpZGF0ZV9hY3Rpb24gfHwgISAkbmF0aXZlLmxlbmd0aCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dmFyIG5hdGl2ZV9lbGVtZW50ID0gJG5hdGl2ZS5nZXQoIDAgKTtcblx0XHRpZiAoIG5hdGl2ZV9lbGVtZW50LndwYmNfYXBwb2ludG1lbnRfdGltZV9wcmVmbGlnaHRfcmVhZHkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdG5hdGl2ZV9lbGVtZW50LndwYmNfYXBwb2ludG1lbnRfdGltZV9wcmVmbGlnaHRfcmVhZHkgPSB0cnVlO1xuXHRcdG5hdGl2ZV9lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHRjYXB0dXJlX3dpemFyZF9uYXZpZ2F0aW9uKCBldmVudCwgJG5hdGl2ZSApO1xuXHRcdH0sIHRydWUgKTtcblx0XHQkbmF0aXZlLm9uKCAnY2hhbmdlLndwYmNfYXBwb2ludG1lbnRfdGltZV9wcmVmbGlnaHQnLCAnW25hbWVePVwic3RhcnR0aW1lXCJdJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0c2NoZWR1bGVfdGltZV92YWxpZGF0aW9uKCAkbmF0aXZlICk7XG5cdFx0fSApO1xuXHRcdCRuYXRpdmUub24oICdkYXRlX3NlbGVjdGVkLndwYmNfYXBwb2ludG1lbnRfdGltZV9wcmVmbGlnaHQgd3BiY19ob29rX3RpbWVzbG90c19kaXNhYmxlZC53cGJjX2FwcG9pbnRtZW50X3RpbWVfcHJlZmxpZ2h0JywgZnVuY3Rpb24gKCBldmVudCwgcHJvdmlkZXJfaWQgKSB7XG5cdFx0XHRpZiAoIE51bWJlciggcHJvdmlkZXJfaWQgfHwgMCApID09PSBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3Byb3ZpZGVyLWlkJyApIHx8IDAgKSApIHtcblx0XHRcdFx0c2NoZWR1bGVfYXZhaWxhYmxlX3N0YXJ0X3RpbWVzKCAkbmF0aXZlICk7XG5cdFx0XHRcdHNjaGVkdWxlX3RpbWVfdmFsaWRhdGlvbiggJG5hdGl2ZSApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHRzY2hlZHVsZV9hdmFpbGFibGVfc3RhcnRfdGltZXMoICRuYXRpdmUgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBMb2NrIGEgbmF0aXZlIGR1cmF0aW9uIGZpZWxkIHRvIHRoZSBzZWxlY3RlZCBTZXJ2aWNlIGR1cmF0aW9uLlxuXHQgKlxuXHQgKiBUaGUgY29yZSBzYXZlIGhhbmRsZXIgaW5kZXBlbmRlbnRseSBkZXJpdmVzIGR1cmF0aW9uIGZyb20gdGhlIFNlcnZpY2Ugcm93O1xuXHQgKiB0aGlzIGNsaWVudCBzdGVwIG9ubHkga2VlcHMgdGhlIHZpc2libGUgZm9ybSBhbmQgc2VyaWFsaXplZCBkYXRhIGFsaWduZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBwcmVwYXJlX25hdGl2ZV9mb3JtKCAkc2NvcGUgKSB7XG5cdFx0dmFyICRuYXRpdmUgPSAkc2NvcGUuZmluZCggJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX25hdGl2ZV9mb3JtJyApLmZpcnN0KCk7XG5cdFx0aWYgKCAhICRuYXRpdmUubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmICggISByZWdpc3Rlcl9uYXRpdmVfZm9ybSggJG5hdGl2ZSApICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHZhciByZXNvdXJjZV9pZCA9IE51bWJlciggJG5hdGl2ZS5kYXRhKCAncHJvdmlkZXItaWQnICkgfHwgMCApO1xuXHRcdHZhciBkdXJhdGlvbiA9IFN0cmluZyggJG5hdGl2ZS5kYXRhKCAnZHVyYXRpb24nICkgfHwgJycgKTtcblx0XHR2YXIgZmllbGRfbmFtZSA9ICdkdXJhdGlvbnRpbWUnICsgcmVzb3VyY2VfaWQ7XG5cdFx0dmFyICRmb3JtID0gJG5hdGl2ZS5maW5kKCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApO1xuXHRcdCRmb3JtLmZpbmQoICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19kdXJhdGlvbl9wcm94eScgKS5yZW1vdmUoKTtcblx0XHR2YXIgJGR1cmF0aW9uX2ZpZWxkcyA9ICRmb3JtLmZpbmQoICdbbmFtZT1cIicgKyBmaWVsZF9uYW1lICsgJ1wiXSwgW25hbWU9XCInICsgZmllbGRfbmFtZSArICdbXVwiXScgKTtcblx0XHR2YXIgJGRlcml2ZWRfdGltZV9maWVsZHMgPSAkZm9ybS5maW5kKCAnW25hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXSwgW25hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1tdXCJdLCBbbmFtZT1cInJhbmdldGltZScgKyByZXNvdXJjZV9pZCArICdcIl0sIFtuYW1lPVwicmFuZ2V0aW1lJyArIHJlc291cmNlX2lkICsgJ1tdXCJdJyApO1xuXG5cdFx0JGR1cmF0aW9uX2ZpZWxkcy5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgJGZpZWxkID0gJCggdGhpcyApO1xuXHRcdFx0aWYgKCAkZmllbGQuaXMoICdzZWxlY3QnICkgJiYgISAkZmllbGQuZmluZCggJ29wdGlvblt2YWx1ZT1cIicgKyBkdXJhdGlvbi5yZXBsYWNlKCAvXCIvZywgJ1xcXFxcIicgKSArICdcIl0nICkubGVuZ3RoICkge1xuXHRcdFx0XHQkZmllbGQuYXBwZW5kKCAkKCAnPG9wdGlvbj4nLCB7IHZhbHVlOiBkdXJhdGlvbiwgdGV4dDogZHVyYXRpb24gfSApICk7XG5cdFx0XHR9XG5cdFx0XHQkZmllbGQudmFsKCBkdXJhdGlvbiApLnByb3AoICdkaXNhYmxlZCcsIHRydWUgKS5hdHRyKCAnYXJpYS1kaXNhYmxlZCcsICd0cnVlJyApO1xuXHRcdFx0JGZpZWxkLmNsb3Nlc3QoICcud3BkZXYtZm9ybS1jb250cm9sLXdyYXAnICkuYWRkQ2xhc3MoICd3cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX2ZpeGVkX2R1cmF0aW9uX2ZpZWxkJyApO1xuXHRcdH0gKTtcblx0XHQkZGVyaXZlZF90aW1lX2ZpZWxkcy5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgJGZpZWxkID0gJCggdGhpcyApO1xuXHRcdFx0JGZpZWxkLnByb3AoICdkaXNhYmxlZCcsIHRydWUgKS5hdHRyKCAnYXJpYS1kaXNhYmxlZCcsICd0cnVlJyApO1xuXHRcdFx0JGZpZWxkLmNsb3Nlc3QoICcud3BkZXYtZm9ybS1jb250cm9sLXdyYXAnICkuYWRkQ2xhc3MoICd3cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX2ZpeGVkX2R1cmF0aW9uX2ZpZWxkJyApO1xuXHRcdH0gKTtcblxuXHRcdGlmICggISAkZHVyYXRpb25fZmllbGRzLmxlbmd0aCApIHtcblx0XHRcdHZhciAkZHVyYXRpb25fcHJveHkgPSAkKCAnPHNlbGVjdD4nLCB7XG5cdFx0XHRcdG5hbWU6IGZpZWxkX25hbWUsXG5cdFx0XHRcdCdjbGFzcyc6ICd3cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX2R1cmF0aW9uX3ZhbHVlJyxcblx0XHRcdFx0J2FyaWEtaGlkZGVuJzogJ3RydWUnLFxuXHRcdFx0XHR0YWJpbmRleDogJy0xJyxcblx0XHRcdFx0J2RhdGEtd3BiYy1hcHBvaW50bWVudC1nZW5lcmF0ZWQnOiAnMSdcblx0XHRcdH0gKS5hcHBlbmQoICQoICc8b3B0aW9uPicsIHsgdmFsdWU6IGR1cmF0aW9uLCB0ZXh0OiBkdXJhdGlvbiwgc2VsZWN0ZWQ6IHRydWUgfSApICk7XG5cdFx0XHQkZm9ybS5hcHBlbmQoXG5cdFx0XHRcdCQoICc8c3Bhbj4nLCB7XG5cdFx0XHRcdFx0J2NsYXNzJzogJ3dwZGV2LWZvcm0tY29udHJvbC13cmFwIHdwYmNfYm9va2luZ19hcHBvaW50bWVudF9fZml4ZWRfZHVyYXRpb25fZmllbGQgd3BiY19ib29raW5nX2FwcG9pbnRtZW50X19kdXJhdGlvbl9wcm94eScsXG5cdFx0XHRcdFx0J2FyaWEtaGlkZGVuJzogJ3RydWUnXG5cdFx0XHRcdH0gKS5hcHBlbmQoICRkdXJhdGlvbl9wcm94eSApXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdGluaXRpYWxpemVfdGltZV9wcmVmbGlnaHQoICRuYXRpdmUgKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqIENvbnZlcnQgYSBzY3JpcHQgVVJMIHRvIHRoZSBzYW1lIGFic29sdXRlIHJlcHJlc2VudGF0aW9uIGFzIERPTSBzY3JpcHQuc3JjLiAqL1xuXHRmdW5jdGlvbiBnZXRfYWJzb2x1dGVfc2NyaXB0X3VybCggdXJsICkge1xuXHRcdHZhciBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnYScgKTtcblx0XHRhbmNob3IuaHJlZiA9IFN0cmluZyggdXJsIHx8ICcnICk7XG5cdFx0cmV0dXJuIGFuY2hvci5ocmVmO1xuXHR9XG5cblx0LyoqIEV4ZWN1dGUgcmVuZGVyZXIgc2NyaXB0cyBzZXF1ZW50aWFsbHkgd2hpbGUgdGhlIHJlcXVlc3Qgc3RpbGwgb3ducyB0aGUgc3RhZ2UuICovXG5cdGZ1bmN0aW9uIGV4ZWN1dGVfc2NyaXB0cyggc2NyaXB0cywgb3duc19zdGFnZSApIHtcblx0XHR2YXIgc2VxdWVuY2UgPSAkLkRlZmVycmVkKCkucmVzb2x2ZSgpLnByb21pc2UoKTtcblxuXHRcdCQuZWFjaCggc2NyaXB0cywgZnVuY3Rpb24gKCBpbmRleCwgc2NyaXB0ICkge1xuXHRcdFx0c2VxdWVuY2UgPSBzZXF1ZW5jZS50aGVuKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmICggISBvd25zX3N0YWdlKCkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHJlamVjdGVkX3N0YWdlKCAnJyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggc2NyaXB0LnNyYyApIHtcblx0XHRcdFx0XHR2YXIgYWJzb2x1dGVfdXJsID0gZ2V0X2Fic29sdXRlX3NjcmlwdF91cmwoIHNjcmlwdC5zcmMgKTtcblx0XHRcdFx0XHRpZiAoIGxvYWRlZF9zY3JpcHRfdXJsc1sgYWJzb2x1dGVfdXJsIF0gKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gJC5hamF4KCB7IHVybDogYWJzb2x1dGVfdXJsLCBkYXRhVHlwZTogJ3NjcmlwdCcsIGNhY2hlOiB0cnVlIH0gKS50aGVuKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRsb2FkZWRfc2NyaXB0X3VybHNbIGFic29sdXRlX3VybCBdID0gdHJ1ZTtcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBzY3JpcHQuY29kZSApIHtcblx0XHRcdFx0XHQkLmdsb2JhbEV2YWwoIHNjcmlwdC5jb2RlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH0gKTtcblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gc2VxdWVuY2U7XG5cdH1cblxuXHQvKiogSW5pdGlhbGl6ZSBjb250cm9scyB3aG9zZSBjb3JlIGhhbmRsZXJzIG5vcm1hbGx5IGJpbmQgb24gZG9jdW1lbnQgcmVhZHkuICovXG5cdGZ1bmN0aW9uIGluaXRpYWxpemVfYWpheF9mb3JtX2NvbnRyb2xzKCkge1xuXHRcdGlmICggdHlwZW9mIHdpbmRvdy53cGJjX2hvb2tfX2luaXRfYm9va2luZ19mb3JtX3dpemFyZF9idXR0b25zID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0d2luZG93LndwYmNfaG9va19faW5pdF9ib29raW5nX2Zvcm1fd2l6YXJkX2J1dHRvbnMoKTtcblx0XHR9XG5cdH1cblxuXHQvKiogRGVzdHJveSBuYXRpdmUgY2FsZW5kYXIgaW5zdGFuY2VzIGFuZCB1bnJlZ2lzdGVyIGNvbnRleHQgYmVmb3JlIHJlbW92YWwuICovXG5cdGZ1bmN0aW9uIGNsZWFudXBfbmF0aXZlX2Zvcm0oICRyb290ICkge1xuXHRcdCRyb290LmZpbmQoICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19uYXRpdmVfZm9ybScgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgJG5hdGl2ZSA9ICQoIHRoaXMgKTtcblx0XHRcdHZhciByZXNvdXJjZV9pZCA9IE51bWJlciggJG5hdGl2ZS5kYXRhKCAncHJvdmlkZXItaWQnICkgfHwgMCApO1xuXHRcdFx0dmFyICRjYWxlbmRhciA9ICRuYXRpdmUuZmluZCggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICk7XG5cblx0XHRcdHVucmVnaXN0ZXJfbmF0aXZlX2Zvcm0oICRuYXRpdmUgKTtcblx0XHRcdGlmICggISByZXNvdXJjZV9pZCB8fCAhICRjYWxlbmRhci5sZW5ndGggfHwgISAkLmRhdGVwaWNrIHx8IHR5cGVvZiAkY2FsZW5kYXIuZGF0ZXBpY2sgIT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dmFyIGluc3RhbmNlID0gdHlwZW9mICQuZGF0ZXBpY2suX2dldEluc3QgPT09ICdmdW5jdGlvbicgPyAkLmRhdGVwaWNrLl9nZXRJbnN0KCAkY2FsZW5kYXIuZ2V0KCAwICkgKSA6IG51bGw7XG5cdFx0XHRcdGlmICggaW5zdGFuY2UgKSB7XG5cdFx0XHRcdFx0JGNhbGVuZGFyLmRhdGVwaWNrKCAnZGVzdHJveScgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoIGVycm9yICkge1xuXHRcdFx0XHQkY2FsZW5kYXIucmVtb3ZlQ2xhc3MoICdoYXNEYXRlcGljaycgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdH1cblxuXHQvKiogUmVzdG9yZSB0aGUgcHJldmlvdXNseSBzZWxlY3RlZCBTZXJ2aWNlIHdoZW4gbmF2aWdhdGluZyBiYWNrIG9uZSBzdGFnZS4gKi9cblx0ZnVuY3Rpb24gcmVzdG9yZV9zZXJ2aWNlX3NlbGVjdGlvbiggJHJvb3QgKSB7XG5cdFx0dmFyIHNlcnZpY2VfaWQgPSBOdW1iZXIoICRyb290LmF0dHIoICdkYXRhLXNlbGVjdGVkLXNlcnZpY2UtaWQnICkgfHwgMCApO1xuXHRcdGlmICggISBzZXJ2aWNlX2lkICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR2YXIgJGlucHV0ID0gJHJvb3QuZmluZCggJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX3NlbGVjdGlvbl9mb3JtIFtuYW1lPVwid3BiY19hcHBvaW50bWVudF9zZXJ2aWNlXCJdW3ZhbHVlPVwiJyArIHNlcnZpY2VfaWQgKyAnXCJdJyApLmZpcnN0KCk7XG5cdFx0aWYgKCAkaW5wdXQubGVuZ3RoICkge1xuXHRcdFx0JGlucHV0LnByb3AoICdjaGVja2VkJywgdHJ1ZSApLmNsb3Nlc3QoICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19jaG9pY2UnICkuYWRkQ2xhc3MoICdpcy1zZWxlY3RlZCcgKTtcblx0XHR9XG5cdH1cblxuXHQvKiogRm9jdXMgdGhlIG5ldyBzdGFnZSBoZWFkaW5nIHdpdGhvdXQgZm9yY2luZyBtb3Rpb24gZm9yIHJlZHVjZWQtbW90aW9uIHVzZXJzLiAqL1xuXHRmdW5jdGlvbiBmb2N1c19zdGFnZSggJHJvb3QgKSB7XG5cdFx0dmFyICR0YXJnZXQgPSAkcm9vdC5maW5kKCAnPiAud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19zdGFnZSAud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19oZWFkaW5nIGgzLCA+IC53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX3N0YWdlIC53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX25vdGljZScgKS5maXJzdCgpO1xuXHRcdGlmICggJHRhcmdldC5sZW5ndGggKSB7XG5cdFx0XHQkdGFyZ2V0LmF0dHIoICd0YWJpbmRleCcsICctMScgKTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdCR0YXJnZXQuZ2V0KCAwICkuZm9jdXMoIHsgcHJldmVudFNjcm9sbDogdHJ1ZSB9ICk7XG5cdFx0XHR9IGNhdGNoICggZXJyb3IgKSB7XG5cdFx0XHRcdCR0YXJnZXQudHJpZ2dlciggJ2ZvY3VzJyApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICggJHJvb3QuZ2V0KCAwICkgJiYgdHlwZW9mICRyb290LmdldCggMCApLnNjcm9sbEludG9WaWV3ID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0dmFyIHJlZHVjZV9tb3Rpb24gPSB3aW5kb3cubWF0Y2hNZWRpYSAmJiB3aW5kb3cubWF0Y2hNZWRpYSggJyhwcmVmZXJzLXJlZHVjZWQtbW90aW9uOiByZWR1Y2UpJyApLm1hdGNoZXM7XG5cdFx0XHQkcm9vdC5nZXQoIDAgKS5zY3JvbGxJbnRvVmlldyggeyBiZWhhdmlvcjogcmVkdWNlX21vdGlvbiA/ICdhdXRvJyA6ICdzbW9vdGgnLCBibG9jazogJ25lYXJlc3QnIH0gKTtcblx0XHR9XG5cdH1cblxuXHQvKiogUmV0dXJuIGEgcmVqZWN0ZWQgcHJvbWlzZSBjYXJyeWluZyBvbmUgY29udHJvbGxlZCBpbml0aWFsaXphdGlvbiBtZXNzYWdlLiAqL1xuXHRmdW5jdGlvbiByZWplY3RlZF9zdGFnZSggbWVzc2FnZSApIHtcblx0XHR2YXIgZGVmZXJyZWQgPSAkLkRlZmVycmVkKCk7XG5cdFx0ZGVmZXJyZWQucmVqZWN0KCB7IHdwYmNfbWVzc2FnZTogbWVzc2FnZSB9ICk7XG5cdFx0cmV0dXJuIGRlZmVycmVkLnByb21pc2UoKTtcblx0fVxuXG5cdC8qKiBSZXBsYWNlIGEgc3RhZ2Ugd2hpbGUgZ3VhcmFudGVlaW5nIERPTS1iZWZvcmUtc2NyaXB0IGluaXRpYWxpemF0aW9uIG9yZGVyLiAqL1xuXHRmdW5jdGlvbiByZXBsYWNlX3N0YWdlKCAkcm9vdCwgaHRtbCwgc3RhZ2UsIHByb3ZpZGVyX2lkLCByZXF1ZXN0X2lkICkge1xuXHRcdGlmICggISBpc19jdXJyZW50X3JlcXVlc3QoICRyb290LCByZXF1ZXN0X2lkICkgKSB7XG5cdFx0XHRyZXR1cm4gcmVqZWN0ZWRfc3RhZ2UoICcnICk7XG5cdFx0fVxuXHRcdGlmICggJ2Jvb2tpbmcnID09PSBzdGFnZSAmJiBoYXNfZHVwbGljYXRlX3Byb3ZpZGVyX2Zvcm0oICRyb290LCBwcm92aWRlcl9pZCApICkge1xuXHRcdFx0cmV0dXJuIHJlamVjdGVkX3N0YWdlKCBjb25maWcuZHVwbGljYXRlX3Byb3ZpZGVyICk7XG5cdFx0fVxuXG5cdFx0dmFyIHBhcnNlZCA9ICQucGFyc2VIVE1MKCBTdHJpbmcoIGh0bWwgfHwgJycgKSwgZG9jdW1lbnQsIHRydWUgKSB8fCBbXTtcblx0XHR2YXIgc2NyaXB0cyA9IFtdO1xuXHRcdHZhciAkY29udGFpbmVyID0gJCggJzxkaXY+JyApLmFwcGVuZCggcGFyc2VkICk7XG5cblx0XHQkY29udGFpbmVyLmZpbmQoICdzY3JpcHQnICkuYWRkQmFjayggJ3NjcmlwdCcgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRzY3JpcHRzLnB1c2goIHsgc3JjOiB0aGlzLnNyYyB8fCAnJywgY29kZTogdGhpcy5zcmMgPyAnJyA6ICggdGhpcy50ZXh0IHx8IHRoaXMudGV4dENvbnRlbnQgfHwgJycgKSB9ICk7XG5cdFx0XHQkKCB0aGlzICkucmVtb3ZlKCk7XG5cdFx0fSApO1xuXG5cdFx0Y2xlYW51cF9uYXRpdmVfZm9ybSggJHJvb3QgKTtcblx0XHQkcm9vdC5hdHRyKCAnZGF0YS1hcHBvaW50bWVudC1zdGFnZScsIHN0YWdlICk7XG5cdFx0JHJvb3QuZmluZCggJz4gLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fc3RhZ2UnICkuZW1wdHkoKS5hcHBlbmQoICRjb250YWluZXIuY29udGVudHMoKSApO1xuXG5cdFx0aWYgKCAhIHByZXBhcmVfbmF0aXZlX2Zvcm0oICRyb290ICkgKSB7XG5cdFx0XHRjbGVhbnVwX25hdGl2ZV9mb3JtKCAkcm9vdCApO1xuXHRcdFx0JHJvb3QuZmluZCggJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX25hdGl2ZV9mb3JtIDppbnB1dCcgKS5wcm9wKCAnZGlzYWJsZWQnLCB0cnVlICk7XG5cdFx0XHRyZXR1cm4gcmVqZWN0ZWRfc3RhZ2UoIGNvbmZpZy5pbml0aWFsaXphdGlvbl9lcnJvciB8fCBjb25maWcuZXJyb3IgKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZXhlY3V0ZV9zY3JpcHRzKCBzY3JpcHRzLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRyZXR1cm4gaXNfY3VycmVudF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApO1xuXHRcdH0gKS50aGVuKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAoICEgaXNfY3VycmVudF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApICkge1xuXHRcdFx0XHRyZXR1cm4gcmVqZWN0ZWRfc3RhZ2UoICcnICk7XG5cdFx0XHR9XG5cdFx0XHRpbml0aWFsaXplX2FqYXhfZm9ybV9jb250cm9scygpO1xuXHRcdFx0aWYgKCAnc2VydmljZScgPT09IHN0YWdlICkge1xuXHRcdFx0XHRyZXN0b3JlX3NlcnZpY2Vfc2VsZWN0aW9uKCAkcm9vdCApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0fVxuXG5cdC8qKiBEZXRlcm1pbmUgd2hldGhlciBhbiBBSkFYIGNhbGxiYWNrIHN0aWxsIG93bnMgdGhlIGNvbXBvbmVudCBzdGF0ZS4gKi9cblx0ZnVuY3Rpb24gaXNfY3VycmVudF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApIHtcblx0XHRyZXR1cm4gTnVtYmVyKCAkcm9vdC5kYXRhKCAnd3BiYy1hcHBvaW50bWVudC1yZXF1ZXN0LWlkJyApIHx8IDAgKSA9PT0gTnVtYmVyKCByZXF1ZXN0X2lkICk7XG5cdH1cblxuXHQvKiogRmluaXNoIG9ubHkgdGhlIGN1cnJlbnQgcmVxdWVzdCBzbyBzdGFsZSBjYWxsYmFja3MgY2Fubm90IGFsdGVyIHRoZSBVSS4gKi9cblx0ZnVuY3Rpb24gZmluaXNoX3JlcXVlc3QoICRyb290LCByZXF1ZXN0X2lkICkge1xuXHRcdGlmICggISBpc19jdXJyZW50X3JlcXVlc3QoICRyb290LCByZXF1ZXN0X2lkICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdCRyb290LnJlbW92ZURhdGEoICd3cGJjLWFwcG9pbnRtZW50LXJlcXVlc3QnICk7XG5cdFx0c2V0X2xvYWRpbmcoICRyb290LCBmYWxzZSApO1xuXHR9XG5cblx0LyoqIFJlcXVlc3QgYW5kIHJlbmRlciB0aGUgbmV4dCBBcHBvaW50bWVudCB3b3JrZmxvdyBzdGFnZS4gKi9cblx0ZnVuY3Rpb24gcmVzb2x2ZV9zdGFnZSggJHJvb3QsIHNlcnZpY2VfaWQsIHByb3ZpZGVyX2lkICkge1xuXHRcdGlmICggISAkcm9vdCB8fCAhICRyb290Lmxlbmd0aCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRzZXJ2aWNlX2lkID0gTnVtYmVyKCBzZXJ2aWNlX2lkIHx8IDAgKTtcblx0XHRwcm92aWRlcl9pZCA9IE51bWJlciggcHJvdmlkZXJfaWQgfHwgMCApO1xuXHRcdGlmICggc2VydmljZV9pZCApIHtcblx0XHRcdCRyb290LmF0dHIoICdkYXRhLXNlbGVjdGVkLXNlcnZpY2UtaWQnLCBzZXJ2aWNlX2lkICk7XG5cdFx0fVxuXHRcdGlmICggcHJvdmlkZXJfaWQgKSB7XG5cdFx0XHQkcm9vdC5hdHRyKCAnZGF0YS1zZWxlY3RlZC1wcm92aWRlci1pZCcsIHByb3ZpZGVyX2lkICk7XG5cdFx0fVxuXG5cdFx0dmFyIHByZXZpb3VzX3JlcXVlc3QgPSAkcm9vdC5kYXRhKCAnd3BiYy1hcHBvaW50bWVudC1yZXF1ZXN0JyApO1xuXHRcdHZhciByZXF1ZXN0X2lkID0gTnVtYmVyKCAkcm9vdC5kYXRhKCAnd3BiYy1hcHBvaW50bWVudC1yZXF1ZXN0LWlkJyApIHx8IDAgKSArIDE7XG5cdFx0JHJvb3QuZGF0YSggJ3dwYmMtYXBwb2ludG1lbnQtcmVxdWVzdC1pZCcsIHJlcXVlc3RfaWQgKTtcblx0XHRpZiAoIHByZXZpb3VzX3JlcXVlc3QgJiYgcHJldmlvdXNfcmVxdWVzdC5yZWFkeVN0YXRlICE9PSA0ICkge1xuXHRcdFx0cHJldmlvdXNfcmVxdWVzdC5hYm9ydCgpO1xuXHRcdH1cblxuXHRcdGNsZWFyX2Vycm9yKCAkcm9vdCApO1xuXHRcdHNldF9sb2FkaW5nKCAkcm9vdCwgdHJ1ZSApO1xuXHRcdHZhciByZXF1ZXN0ID0gJC5wb3N0KCBjb25maWcuYWpheF91cmwsIHtcblx0XHRcdGFjdGlvbjogY29uZmlnLmFjdGlvbixcblx0XHRcdG5vbmNlOiBjb25maWcubm9uY2UsXG5cdFx0XHRjb25maWdfdG9rZW46ICRyb290LmF0dHIoICdkYXRhLWNvbmZpZy10b2tlbicgKSB8fCAnJyxcblx0XHRcdHNlcnZpY2VfaWQ6IHNlcnZpY2VfaWQsXG5cdFx0XHRwcm92aWRlcl9pZDogcHJvdmlkZXJfaWRcblx0XHR9ICk7XG5cdFx0JHJvb3QuZGF0YSggJ3dwYmMtYXBwb2ludG1lbnQtcmVxdWVzdCcsIHJlcXVlc3QgKTtcblxuXHRcdHJlcXVlc3QuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdGlmICggISBpc19jdXJyZW50X3JlcXVlc3QoICRyb290LCByZXF1ZXN0X2lkICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISByZXNwb25zZSB8fCAhIHJlc3BvbnNlLnN1Y2Nlc3MgfHwgISByZXNwb25zZS5kYXRhICkge1xuXHRcdFx0XHRzaG93X2Vycm9yKFxuXHRcdFx0XHRcdCRyb290LFxuXHRcdFx0XHRcdHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5tZXNzYWdlID8gcmVzcG9uc2UuZGF0YS5tZXNzYWdlIDogY29uZmlnLmVycm9yLFxuXHRcdFx0XHRcdHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgPyByZXNwb25zZS5kYXRhLmFjdGlvbl91cmwgOiAnJyxcblx0XHRcdFx0XHRyZXNwb25zZSAmJiByZXNwb25zZS5kYXRhID8gcmVzcG9uc2UuZGF0YS5hY3Rpb25fbGFiZWwgOiAnJ1xuXHRcdFx0XHQpO1xuXHRcdFx0XHRmaW5pc2hfcmVxdWVzdCggJHJvb3QsIHJlcXVlc3RfaWQgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgc3RhZ2UgPSByZXNwb25zZS5kYXRhLnN0YWdlIHx8ICcnO1xuXHRcdFx0dmFyIHJlcGxhY2VtZW50ID0gcmVwbGFjZV9zdGFnZSggJHJvb3QsIHJlc3BvbnNlLmRhdGEuaHRtbCwgc3RhZ2UsIHJlc3BvbnNlLmRhdGEucHJvdmlkZXJfaWQsIHJlcXVlc3RfaWQgKTtcblx0XHRcdHJlcGxhY2VtZW50LmRvbmUoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKCAhIGlzX2N1cnJlbnRfcmVxdWVzdCggJHJvb3QsIHJlcXVlc3RfaWQgKSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBOdW1iZXIoIHJlc3BvbnNlLmRhdGEuc2VydmljZV9pZCB8fCAwICkgKSB7XG5cdFx0XHRcdFx0JHJvb3QuYXR0ciggJ2RhdGEtc2VsZWN0ZWQtc2VydmljZS1pZCcsIE51bWJlciggcmVzcG9uc2UuZGF0YS5zZXJ2aWNlX2lkICkgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIE51bWJlciggcmVzcG9uc2UuZGF0YS5wcm92aWRlcl9pZCB8fCAwICkgKSB7XG5cdFx0XHRcdFx0JHJvb3QuYXR0ciggJ2RhdGEtc2VsZWN0ZWQtcHJvdmlkZXItaWQnLCBOdW1iZXIoIHJlc3BvbnNlLmRhdGEucHJvdmlkZXJfaWQgKSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZpbmlzaF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApO1xuXHRcdFx0XHRmb2N1c19zdGFnZSggJHJvb3QgKTtcblx0XHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIGVycm9yICkge1xuXHRcdFx0XHRpZiAoICEgaXNfY3VycmVudF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR2YXIgbWVzc2FnZSA9IGVycm9yICYmIGVycm9yLndwYmNfbWVzc2FnZSA/IGVycm9yLndwYmNfbWVzc2FnZSA6ICggY29uZmlnLmluaXRpYWxpemF0aW9uX2Vycm9yIHx8IGNvbmZpZy5lcnJvciApO1xuXHRcdFx0XHRzaG93X2Vycm9yKCAkcm9vdCwgbWVzc2FnZSApO1xuXHRcdFx0XHRmaW5pc2hfcmVxdWVzdCggJHJvb3QsIHJlcXVlc3RfaWQgKTtcblx0XHRcdH0gKTtcblx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCB4aHIsIHN0YXR1cyApIHtcblx0XHRcdGlmICggJ2Fib3J0JyA9PT0gc3RhdHVzIHx8ICEgaXNfY3VycmVudF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR2YXIgcmVzcG9uc2UgPSB4aHIucmVzcG9uc2VKU09OO1xuXHRcdFx0c2hvd19lcnJvcihcblx0XHRcdFx0JHJvb3QsXG5cdFx0XHRcdHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5tZXNzYWdlID8gcmVzcG9uc2UuZGF0YS5tZXNzYWdlIDogY29uZmlnLmVycm9yLFxuXHRcdFx0XHRyZXNwb25zZSAmJiByZXNwb25zZS5kYXRhID8gcmVzcG9uc2UuZGF0YS5hY3Rpb25fdXJsIDogJycsXG5cdFx0XHRcdHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgPyByZXNwb25zZS5kYXRhLmFjdGlvbl9sYWJlbCA6ICcnXG5cdFx0XHQpO1xuXHRcdFx0ZmluaXNoX3JlcXVlc3QoICRyb290LCByZXF1ZXN0X2lkICk7XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqIEhhbmRsZSBTZXJ2aWNlIGFuZCBQcm92aWRlciBmYWxsYmFjayBmb3JtcyB0aHJvdWdoIEFKQVguICovXG5cdCQoIGRvY3VtZW50ICkub24oICdzdWJtaXQnLCAnLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fc2VsZWN0aW9uX2Zvcm0nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdGlmICggISBjb25maWcuYWpheF91cmwgfHwgISBjb25maWcuYWN0aW9uICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdHZhciAkZm9ybSA9ICQoIHRoaXMgKTtcblx0XHR2YXIgJHJvb3QgPSAkZm9ybS5jbG9zZXN0KCAnLndwYmNfYm9va2luZ19hcHBvaW50bWVudCcgKTtcblx0XHRyZXNvbHZlX3N0YWdlKCAkcm9vdCwgZ2V0X3NlbGVjdGVkX2lkKCAkZm9ybSwgJ3dwYmNfYXBwb2ludG1lbnRfc2VydmljZScgKSwgZ2V0X3NlbGVjdGVkX2lkKCAkZm9ybSwgJ3dwYmNfYXBwb2ludG1lbnRfcHJvdmlkZXInICkgKTtcblx0fSApO1xuXG5cdC8qKiBLZWVwIHBsYXRlIHNlbGVjdGlvbiBzdHlsaW5nIGluZGVwZW5kZW50IGZyb20gQ1NTIDpoYXMoKSBzdXBwb3J0LiAqL1xuXHQkKCBkb2N1bWVudCApLm9uKCAnY2hhbmdlJywgJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX2Nob2ljZSA+IGlucHV0JywgZnVuY3Rpb24gKCkge1xuXHRcdHZhciAkaW5wdXQgPSAkKCB0aGlzICk7XG5cdFx0JGlucHV0LmNsb3Nlc3QoICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19jaG9pY2VzJyApLmZpbmQoICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19jaG9pY2UnICkucmVtb3ZlQ2xhc3MoICdpcy1zZWxlY3RlZCcgKTtcblx0XHQkaW5wdXQuY2xvc2VzdCggJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX2Nob2ljZScgKS5hZGRDbGFzcyggJ2lzLXNlbGVjdGVkJyApO1xuXHR9ICk7XG5cblx0LyoqIEZpbHRlciBTZXJ2aWNlIGFuZCBQcm92aWRlciBjYXJkcyB3aXRob3V0IGNoYW5naW5nIHRoZSBzaWduZWQgY2F0YWxvZy4gKi9cblx0JCggZG9jdW1lbnQgKS5vbiggJ2lucHV0IHNlYXJjaCcsICdbZGF0YS13cGJjLWFwcG9pbnRtZW50LWNhdGFsb2ctc2VhcmNoXScsIGZ1bmN0aW9uICgpIHtcblx0XHRmaWx0ZXJfYXBwb2ludG1lbnRfY2F0YWxvZyggJCggdGhpcyApLmNsb3Nlc3QoICdbZGF0YS13cGJjLWFwcG9pbnRtZW50LWNhdGFsb2ddJyApICk7XG5cdH0gKTtcblxuXHQvKiogUmV0dXJuIHRvIFNlcnZpY2Ugc2VsZWN0aW9uIHdoaWxlIHByZXNlcnZpbmcgdGhlIGxhc3QgdmFsaWQgU2VydmljZS4gKi9cblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnQgW2RhdGEtYXBwb2ludG1lbnQtYmFjaz1cInNlcnZpY2VcIl0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyICRyb290ID0gJCggdGhpcyApLmNsb3Nlc3QoICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50JyApO1xuXHRcdGlmICggJHJvb3QuaGFzQ2xhc3MoICdpcy1sb2FkaW5nJyApICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRyZXNvbHZlX3N0YWdlKCAkcm9vdCwgMCwgMCApO1xuXHR9ICk7XG5cblx0LyoqIFJldHVybiB0byB0aGUgZmlyc3Qgc2VsZWN0YWJsZSBBcHBvaW50bWVudCBzdGFnZSB3aXRob3V0IHJlbG9hZGluZyB0aGUgcGFnZS4gKi9cblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnQgW2RhdGEtd3BiYy1hcHBvaW50bWVudC1hY3Rpb249XCJzdGFydC1vdmVyXCJdLCAud3BiY19ib29raW5nX2FwcG9pbnRtZW50IC53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX2NoYW5nZScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0aWYgKCAhIGNvbmZpZy5hamF4X3VybCB8fCAhIGNvbmZpZy5hY3Rpb24gKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0dmFyICRyb290ID0gJCggdGhpcyApLmNsb3Nlc3QoICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50JyApO1xuXHRcdGlmICggJHJvb3QuaGFzQ2xhc3MoICdpcy1sb2FkaW5nJyApICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHQkcm9vdC5yZW1vdmVBdHRyKCAnZGF0YS1zZWxlY3RlZC1zZXJ2aWNlLWlkIGRhdGEtc2VsZWN0ZWQtcHJvdmlkZXItaWQnICk7XG5cdFx0cmVzb2x2ZV9zdGFnZSggJHJvb3QsIDAsIDAgKTtcblx0fSApO1xuXG5cdC8qKiBBZGQgdGhlIHJlZ2lzdGVyZWQgc2lnbmVkIGFuZCBzZXJ2ZXItYXV0aG9yaXplZCBjb250ZXh0IHRvIHRoZSBjb3JlIGJvb2tpbmcgcmVxdWVzdC4gKi9cblx0JCggJ2JvZHknICkub24oICd3cGJjX2JlZm9yZV9ib29raW5nX2NyZWF0ZS53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnQnLCBmdW5jdGlvbiAoIGV2ZW50LCByZXNvdXJjZV9pZCwgcGFyYW1zICkge1xuXHRcdHZhciBjb250ZXh0ID0gZ2V0X25hdGl2ZV9jb250ZXh0KCByZXNvdXJjZV9pZCApO1xuXHRcdGlmICggISBjb250ZXh0ICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRwYXJhbXMuc2VydmljZV9pZCA9IGNvbnRleHQuc2VydmljZV9pZDtcblx0XHRwYXJhbXMuYXBwb2ludG1lbnRfc2VydmljZV9yZXF1aXJlZCA9IDE7XG5cdFx0cGFyYW1zLmFwcG9pbnRtZW50X2NvbnRleHRfdG9rZW4gPSBjb250ZXh0LmNvbnRleHRfdG9rZW47XG5cdFx0cGFyYW1zLmFsbG93X3Bhc3QgPSBjb250ZXh0LmFsbG93X3Bhc3Q7XG5cdH0gKTtcblxuXHQvKiogQWRkIHRoZSBzaWduZWQgQXBwb2ludG1lbnQgcGFpciB0byB0aGUgZXhpc3RpbmcgbGl2ZS1jb3N0IHJlcXVlc3QuICovXG5cdCQoIGRvY3VtZW50ICkub24oICd3cGJjX2JlZm9yZV9jb3N0X3JlcXVlc3Qud3BiY19ib29raW5nX2FwcG9pbnRtZW50JywgZnVuY3Rpb24gKCBldmVudCwgcmVzb3VyY2VfaWQsIHBhcmFtcyApIHtcblx0XHR2YXIgY29udGV4dCA9IGdldF9uYXRpdmVfY29udGV4dCggcmVzb3VyY2VfaWQgKTtcblx0XHRpZiAoICEgY29udGV4dCB8fCAhIHBhcmFtcyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cGFyYW1zLmFwcG9pbnRtZW50X3NlcnZpY2VfaWQgPSBjb250ZXh0LnNlcnZpY2VfaWQ7XG5cdFx0cGFyYW1zLmFwcG9pbnRtZW50X2NvbnRleHRfdG9rZW4gPSBjb250ZXh0LmNvbnRleHRfdG9rZW47XG5cdH0gKTtcblxuXHQkKCBmdW5jdGlvbiAoKSB7XG5cdFx0JCggJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnQnICkuZWFjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyICRyb290ID0gJCggdGhpcyApO1xuXHRcdFx0JHJvb3QuZmluZCggJ1tkYXRhLXdwYmMtYXBwb2ludG1lbnQtY2F0YWxvZ10nICkuZWFjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRmaWx0ZXJfYXBwb2ludG1lbnRfY2F0YWxvZyggJCggdGhpcyApICk7XG5cdFx0XHR9ICk7XG5cdFx0XHR2YXIgJG5hdGl2ZSA9ICRyb290LmZpbmQoICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19uYXRpdmVfZm9ybScgKS5maXJzdCgpO1xuXHRcdFx0aWYgKCAkbmF0aXZlLmxlbmd0aCApIHtcblx0XHRcdFx0JHJvb3QuYXR0ciggJ2RhdGEtc2VsZWN0ZWQtc2VydmljZS1pZCcsIE51bWJlciggJG5hdGl2ZS5kYXRhKCAnc2VydmljZS1pZCcgKSB8fCAwICkgKTtcblx0XHRcdFx0JHJvb3QuYXR0ciggJ2RhdGEtc2VsZWN0ZWQtcHJvdmlkZXItaWQnLCBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3Byb3ZpZGVyLWlkJyApIHx8IDAgKSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHByZXBhcmVfbmF0aXZlX2Zvcm0oICRyb290ICkgKSB7XG5cdFx0XHRcdHZhciBkdXBsaWNhdGUgPSAkbmF0aXZlLmxlbmd0aCAmJiBoYXNfZHVwbGljYXRlX3Byb3ZpZGVyX2Zvcm0oICRyb290LCBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3Byb3ZpZGVyLWlkJyApIHx8IDAgKSApO1xuXHRcdFx0XHRjbGVhbnVwX25hdGl2ZV9mb3JtKCAkcm9vdCApO1xuXHRcdFx0XHQkcm9vdC5maW5kKCAnLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fbmF0aXZlX2Zvcm0gOmlucHV0JyApLnByb3AoICdkaXNhYmxlZCcsIHRydWUgKTtcblx0XHRcdFx0c2hvd19lcnJvciggJHJvb3QsIGR1cGxpY2F0ZSA/IGNvbmZpZy5kdXBsaWNhdGVfcHJvdmlkZXIgOiBjb25maWcuaW5pdGlhbGl6YXRpb25fZXJyb3IgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdH0gKTtcbn0gKSggd2luZG93LCBqUXVlcnkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQSxDQUFFLFVBQVdBLE1BQU0sRUFBRUMsQ0FBQyxFQUFHO0VBQ3hCLFlBQVk7O0VBRVosSUFBSUMsTUFBTSxHQUFHRixNQUFNLENBQUNHLCtCQUErQixJQUFJLENBQUMsQ0FBQztFQUN6RCxJQUFJQyxzQkFBc0IsR0FBRyxDQUFDLENBQUM7RUFDL0IsSUFBSUMsa0JBQWtCLEdBQUcsQ0FBQyxDQUFDO0VBRTNCSixDQUFDLENBQUUsYUFBYyxDQUFDLENBQUNLLElBQUksQ0FBRSxZQUFZO0lBQ3BDRCxrQkFBa0IsQ0FBRUUsTUFBTSxDQUFFLElBQUksQ0FBQ0MsR0FBRyxJQUFJLEVBQUcsQ0FBQyxDQUFFLEdBQUcsSUFBSTtFQUN0RCxDQUFFLENBQUM7O0VBRUg7RUFDQSxTQUFTQyxlQUFlQSxDQUFFQyxLQUFLLEVBQUVDLElBQUksRUFBRztJQUN2QyxPQUFPQyxNQUFNLENBQUVGLEtBQUssQ0FBQ0csSUFBSSxDQUFFLFNBQVMsR0FBR0YsSUFBSSxHQUFHLHFCQUFxQixHQUFHQSxJQUFJLEdBQUcsbUJBQW9CLENBQUMsQ0FBQ0csS0FBSyxDQUFDLENBQUMsQ0FBQ0MsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFFLENBQUM7RUFDeEg7O0VBRUE7QUFD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
