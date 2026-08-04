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

  /** Toggle one component loading state without clearing its current stage. */
  function set_loading($root, is_loading) {
    $root.toggleClass('is-loading', is_loading).attr('aria-busy', is_loading ? 'true' : 'false');
    $root.find('> .wpbc_booking_appointment__stage').attr('aria-busy', is_loading ? 'true' : 'false');
    $root.find('> .wpbc_booking_appointment__loading').prop('hidden', !is_loading).attr('aria-hidden', is_loading ? 'false' : 'true');
    $root.find('.wpbc_booking_appointment__selection_form :input').prop('disabled', is_loading);
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
    var selected_value = selection.start_time;
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
    }
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvYm9va2luZy1hcHBvaW50bWVudC9fb3V0L2Jvb2tpbmctYXBwb2ludG1lbnQuanMiLCJuYW1lcyI6WyJ3aW5kb3ciLCIkIiwiY29uZmlnIiwid3BiY19ib29raW5nX2FwcG9pbnRtZW50X2NvbmZpZyIsImFjdGl2ZV9uYXRpdmVfY29udGV4dHMiLCJsb2FkZWRfc2NyaXB0X3VybHMiLCJlYWNoIiwiU3RyaW5nIiwic3JjIiwiZ2V0X3NlbGVjdGVkX2lkIiwiJGZvcm0iLCJuYW1lIiwiTnVtYmVyIiwiZmluZCIsImZpcnN0IiwidmFsIiwic2V0X2xvYWRpbmciLCIkcm9vdCIsImlzX2xvYWRpbmciLCJ0b2dnbGVDbGFzcyIsImF0dHIiLCJwcm9wIiwic2hvd19lcnJvciIsIm1lc3NhZ2UiLCJhY3Rpb25fdXJsIiwiYWN0aW9uX2xhYmVsIiwiJG5vdGljZSIsImVtcHR5IiwiYXBwZW5kIiwidGV4dCIsImVycm9yIiwiaHJlZiIsImdldCIsImZvY3VzIiwidHJpZ2dlciIsImNsZWFyX2Vycm9yIiwiZ2V0X25hdGl2ZV9jb250ZXh0IiwicHJvdmlkZXJfaWQiLCJjb250ZXh0IiwiZWxlbWVudCIsImRvY3VtZW50IiwiZG9jdW1lbnRFbGVtZW50IiwiY29udGFpbnMiLCJoYXNfZHVwbGljYXRlX3Byb3ZpZGVyX2Zvcm0iLCJmaWx0ZXIiLCJsZW5ndGgiLCJyZWdpc3Rlcl9uYXRpdmVfZm9ybSIsIiRuYXRpdmUiLCJkYXRhIiwic2VydmljZV9pZCIsImNvbnRleHRfdG9rZW4iLCJhbGxvd19wYXN0IiwiZXhpc3RpbmciLCJ1bnJlZ2lzdGVyX25hdGl2ZV9mb3JtIiwiZ2V0X3N0YXJ0X3RpbWVfZmllbGQiLCJub3QiLCJnZXRfc2VsZWN0ZWRfZGF0ZXMiLCJ3cGJjX2dldF9fc2VsZWN0ZWRfZGF0ZXNfc3FsX19hc19hcnIiLCJ2YWx1ZSIsInNwbGl0IiwibWFwIiwiZGF0ZV92YWx1ZSIsInBhcnRzIiwidHJpbSIsInRlc3QiLCJnZXRfdGltZV9zZWxlY3Rpb24iLCIkc3RhcnQiLCJkYXRlcyIsInN0YXJ0X3RpbWUiLCJjb21wbGV0ZSIsInNpZ25hdHVyZSIsImpvaW4iLCJpc190aW1lX3NlbGVjdGlvbl9zdGFnZV9hY3RpdmUiLCJzZWxlY3Rpb24iLCIkc3RlcCIsImNsb3Nlc3QiLCJpcyIsImhhc0NsYXNzIiwiZ2V0X3RpbWVfbm90aWNlX2FuY2hvciIsIiRwaWNrZXIiLCJuZXh0QWxsIiwiY2xlYXJfdGltZV9ub3RpY2UiLCJyZW1vdmUiLCJyZW1vdmVBdHRyIiwic2hvd190aW1lX25vdGljZSIsIiRhbmNob3IiLCJyb2xlIiwidmFsaWRhdGlvbl9lcnJvciIsImluc2VydEFmdGVyIiwiZ2V0X3RpbWVfdmFsaWRhdGlvbl9zdGF0ZSIsInN0YXRlIiwic2VxdWVuY2UiLCJzdGF0dXMiLCJyZXF1ZXN0IiwicHJvbWlzZSIsInRpbWVyIiwiYXZhaWxhYmlsaXR5X3NlcXVlbmNlIiwiYXZhaWxhYmlsaXR5X3JlcXVlc3QiLCJhdmFpbGFiaWxpdHlfdGltZXIiLCJhdmFpbGFibGVfc2xvdHMiLCJjbGVhcl9hcHBvaW50bWVudF9kaXNhYmxlZF90aW1lcyIsIiRvcHRpb24iLCJyZWZyZXNoX3N0YXJ0X3RpbWVfcGlja2VyIiwid3BiY190aW1lc2VsZWN0b3IiLCJnZXRfY29yZV9hdmFpbGFibGVfc3RhcnRfdGltZXMiLCJ2YWx1ZXMiLCJhcHBvaW50bWVudF9kaXNhYmxlZCIsInB1c2giLCJkZWJ1Z190aW1lX3RvX21pbnV0ZXMiLCJ0aW1lX3ZhbHVlIiwiZGVidWdfZm9ybWF0X21pbnV0ZXMiLCJ0b3RhbF9taW51dGVzIiwiZGF5X29mZnNldCIsImhvdXJzIiwiTWF0aCIsImZsb29yIiwic2xpY2UiLCJtaW51dGVzIiwibG9nX3N0YXJ0X3RpbWVfZmlsdGVyX3JlcXVlc3QiLCJzdGFydF90aW1lcyIsImNvbnNvbGUiLCJpbmZvIiwiaW5pdGlhbF9zdGFydF90aW1lcyIsImxvZ19zdGFydF90aW1lX2ZpbHRlcl9yZXN1bHQiLCJidWZmZXJfYmVmb3JlIiwiYnVmZmVyX2FmdGVyIiwiYmxvY2tlZCIsIk9iamVjdCIsImtleXMiLCJzbG90cyIsImZvckVhY2giLCJyZXN1bHQiLCJ2YWxpZCIsImVuZF90aW1lIiwic3RhcnRfbWludXRlcyIsImVuZF9taW51dGVzIiwiYXBwb2ludG1lbnRfdGltZSIsInByb3ZpZGVyX3Jlc2VydmVkIiwicmVhc29uIiwiY29kZSIsImR1cmF0aW9uX21pbnV0ZXMiLCJkdXJhdGlvbiIsImJ1ZmZlcl9iZWZvcmVfbWludXRlcyIsImJ1ZmZlcl9hZnRlcl9taW51dGVzIiwiYmxvY2tlZF9zdGFydF90aW1lcyIsIml0ZW0iLCJ0YWJsZSIsImFwcGx5X2F2YWlsYWJsZV9zdGFydF90aW1lcyIsInNlbGVjdGVkX3ZhbHVlIiwic2VsZWN0ZWRfbWVzc2FnZSIsImxvYWRfYXZhaWxhYmxlX3N0YXJ0X3RpbWVzIiwicmVhZHlTdGF0ZSIsImFib3J0IiwicG9zdCIsImFqYXhfdXJsIiwiYWN0aW9uIiwidmFsaWRhdGVfYWN0aW9uIiwibm9uY2UiLCJkb25lIiwicmVzcG9uc2UiLCJzdWNjZXNzIiwiZmFpbCIsInhociIsInNjaGVkdWxlX2F2YWlsYWJsZV9zdGFydF90aW1lcyIsImNsZWFyVGltZW91dCIsInNldFRpbWVvdXQiLCJ2YWxpZGF0ZV90aW1lX3NlbGVjdGlvbiIsIkRlZmVycmVkIiwicmVzb2x2ZSIsImRlZmVycmVkIiwicmVqZWN0IiwicmVzcG9uc2VKU09OIiwic2NoZWR1bGVfdGltZV92YWxpZGF0aW9uIiwiY2FwdHVyZV93aXphcmRfbmF2aWdhdGlvbiIsImV2ZW50IiwiJGJ1dHRvbiIsInRhcmdldCIsIndwYmNfYXBwb2ludG1lbnRfcHJlZmxpZ2h0X2J5cGFzcyIsInRhcmdldF9tYXRjaCIsIm1hdGNoIiwiY3VycmVudF9tYXRjaCIsIiRjdXJyZW50X3N0ZXAiLCIkdGltZV9zdGVwIiwicHJldmVudERlZmF1bHQiLCJzdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24iLCJjbGljayIsImluaXRpYWxpemVfdGltZV9wcmVmbGlnaHQiLCJuYXRpdmVfZWxlbWVudCIsIndwYmNfYXBwb2ludG1lbnRfdGltZV9wcmVmbGlnaHRfcmVhZHkiLCJhZGRFdmVudExpc3RlbmVyIiwib24iLCJwcmVwYXJlX25hdGl2ZV9mb3JtIiwiJHNjb3BlIiwicmVzb3VyY2VfaWQiLCJmaWVsZF9uYW1lIiwiJGR1cmF0aW9uX2ZpZWxkcyIsIiRkZXJpdmVkX3RpbWVfZmllbGRzIiwiJGZpZWxkIiwicmVwbGFjZSIsImFkZENsYXNzIiwiJGR1cmF0aW9uX3Byb3h5IiwidGFiaW5kZXgiLCJzZWxlY3RlZCIsImdldF9hYnNvbHV0ZV9zY3JpcHRfdXJsIiwidXJsIiwiYW5jaG9yIiwiY3JlYXRlRWxlbWVudCIsImV4ZWN1dGVfc2NyaXB0cyIsInNjcmlwdHMiLCJvd25zX3N0YWdlIiwiaW5kZXgiLCJzY3JpcHQiLCJ0aGVuIiwicmVqZWN0ZWRfc3RhZ2UiLCJhYnNvbHV0ZV91cmwiLCJ1bmRlZmluZWQiLCJhamF4IiwiZGF0YVR5cGUiLCJjYWNoZSIsImdsb2JhbEV2YWwiLCJpbml0aWFsaXplX2FqYXhfZm9ybV9jb250cm9scyIsIndwYmNfaG9va19faW5pdF9ib29raW5nX2Zvcm1fd2l6YXJkX2J1dHRvbnMiLCJjbGVhbnVwX25hdGl2ZV9mb3JtIiwiJGNhbGVuZGFyIiwiZGF0ZXBpY2siLCJpbnN0YW5jZSIsIl9nZXRJbnN0IiwicmVtb3ZlQ2xhc3MiLCJyZXN0b3JlX3NlcnZpY2Vfc2VsZWN0aW9uIiwiJGlucHV0IiwiZm9jdXNfc3RhZ2UiLCIkdGFyZ2V0IiwicHJldmVudFNjcm9sbCIsInNjcm9sbEludG9WaWV3IiwicmVkdWNlX21vdGlvbiIsIm1hdGNoTWVkaWEiLCJtYXRjaGVzIiwiYmVoYXZpb3IiLCJibG9jayIsIndwYmNfbWVzc2FnZSIsInJlcGxhY2Vfc3RhZ2UiLCJodG1sIiwic3RhZ2UiLCJyZXF1ZXN0X2lkIiwiaXNfY3VycmVudF9yZXF1ZXN0IiwiZHVwbGljYXRlX3Byb3ZpZGVyIiwicGFyc2VkIiwicGFyc2VIVE1MIiwiJGNvbnRhaW5lciIsImFkZEJhY2siLCJ0ZXh0Q29udGVudCIsImNvbnRlbnRzIiwiaW5pdGlhbGl6YXRpb25fZXJyb3IiLCJmaW5pc2hfcmVxdWVzdCIsInJlbW92ZURhdGEiLCJyZXNvbHZlX3N0YWdlIiwicHJldmlvdXNfcmVxdWVzdCIsImNvbmZpZ190b2tlbiIsInJlcGxhY2VtZW50IiwicGFyYW1zIiwiYXBwb2ludG1lbnRfc2VydmljZV9yZXF1aXJlZCIsImFwcG9pbnRtZW50X2NvbnRleHRfdG9rZW4iLCJhcHBvaW50bWVudF9zZXJ2aWNlX2lkIiwiZHVwbGljYXRlIiwialF1ZXJ5Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvYm9va2luZy1hcHBvaW50bWVudC9fc3JjL2Jvb2tpbmctYXBwb2ludG1lbnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiKCBmdW5jdGlvbiAoIHdpbmRvdywgJCApIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdHZhciBjb25maWcgPSB3aW5kb3cud3BiY19ib29raW5nX2FwcG9pbnRtZW50X2NvbmZpZyB8fCB7fTtcblx0dmFyIGFjdGl2ZV9uYXRpdmVfY29udGV4dHMgPSB7fTtcblx0dmFyIGxvYWRlZF9zY3JpcHRfdXJscyA9IHt9O1xuXG5cdCQoICdzY3JpcHRbc3JjXScgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0bG9hZGVkX3NjcmlwdF91cmxzWyBTdHJpbmcoIHRoaXMuc3JjIHx8ICcnICkgXSA9IHRydWU7XG5cdH0gKTtcblxuXHQvKiogUmV0dXJuIGEgbm9ybWFsaXplZCBpbnRlZ2VyIGZyb20gYSBzZWxlY3RvciBmaWVsZC4gKi9cblx0ZnVuY3Rpb24gZ2V0X3NlbGVjdGVkX2lkKCAkZm9ybSwgbmFtZSApIHtcblx0XHRyZXR1cm4gTnVtYmVyKCAkZm9ybS5maW5kKCAnW25hbWU9XCInICsgbmFtZSArICdcIl06Y2hlY2tlZCwgW25hbWU9XCInICsgbmFtZSArICdcIl1bdHlwZT1cImhpZGRlblwiXScgKS5maXJzdCgpLnZhbCgpIHx8IDAgKTtcblx0fVxuXG5cdC8qKiBUb2dnbGUgb25lIGNvbXBvbmVudCBsb2FkaW5nIHN0YXRlIHdpdGhvdXQgY2xlYXJpbmcgaXRzIGN1cnJlbnQgc3RhZ2UuICovXG5cdGZ1bmN0aW9uIHNldF9sb2FkaW5nKCAkcm9vdCwgaXNfbG9hZGluZyApIHtcblx0XHQkcm9vdC50b2dnbGVDbGFzcyggJ2lzLWxvYWRpbmcnLCBpc19sb2FkaW5nICkuYXR0ciggJ2FyaWEtYnVzeScsIGlzX2xvYWRpbmcgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0JHJvb3QuZmluZCggJz4gLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fc3RhZ2UnICkuYXR0ciggJ2FyaWEtYnVzeScsIGlzX2xvYWRpbmcgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0JHJvb3QuZmluZCggJz4gLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fbG9hZGluZycgKS5wcm9wKCAnaGlkZGVuJywgISBpc19sb2FkaW5nICkuYXR0ciggJ2FyaWEtaGlkZGVuJywgaXNfbG9hZGluZyA/ICdmYWxzZScgOiAndHJ1ZScgKTtcblx0XHQkcm9vdC5maW5kKCAnLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fc2VsZWN0aW9uX2Zvcm0gOmlucHV0JyApLnByb3AoICdkaXNhYmxlZCcsIGlzX2xvYWRpbmcgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBEaXNwbGF5IGFuZCBmb2N1cyBhbiBBSkFYIG9yIGluaXRpYWxpemF0aW9uIGVycm9yIGluIG9uZSBjb21wb25lbnQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7alF1ZXJ5fSAkcm9vdCAgICAgICAgQXBwb2ludG1lbnQgY29tcG9uZW50IHJvb3QuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlICAgICAgRXJyb3IgbWVzc2FnZS5cblx0ICogQHBhcmFtIHtzdHJpbmd9IGFjdGlvbl91cmwgICBPcHRpb25hbCB0cnVzdGVkIGFkbWluaXN0cmF0aW9uIGFjdGlvbiBVUkwuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBhY3Rpb25fbGFiZWwgT3B0aW9uYWwgYWN0aW9uIGxpbmsgbGFiZWwuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzaG93X2Vycm9yKCAkcm9vdCwgbWVzc2FnZSwgYWN0aW9uX3VybCwgYWN0aW9uX2xhYmVsICkge1xuXHRcdHZhciAkbm90aWNlID0gJHJvb3QuZmluZCggJz4gLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fYWpheF9ub3RpY2UnICk7XG5cdFx0JG5vdGljZS5lbXB0eSgpLmFwcGVuZCggJCggJzxzcGFuPicgKS50ZXh0KCBtZXNzYWdlIHx8IGNvbmZpZy5lcnJvciB8fCAnVW5hYmxlIHRvIGxvYWQgdGhlIEFwcG9pbnRtZW50IGZvcm0uJyApICk7XG5cdFx0aWYgKCBhY3Rpb25fdXJsICYmIGFjdGlvbl9sYWJlbCApIHtcblx0XHRcdCRub3RpY2UuYXBwZW5kKCAnICcsICQoICc8YT4nLCB7ICdjbGFzcyc6ICd3cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX25vdGljZV9hY3Rpb24nLCBocmVmOiBhY3Rpb25fdXJsLCB0ZXh0OiBhY3Rpb25fbGFiZWwgfSApICk7XG5cdFx0fVxuXHRcdCRub3RpY2UucHJvcCggJ2hpZGRlbicsIGZhbHNlICk7XG5cdFx0aWYgKCAkbm90aWNlLmdldCggMCApICYmIHR5cGVvZiAkbm90aWNlLmdldCggMCApLmZvY3VzID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0JG5vdGljZS50cmlnZ2VyKCAnZm9jdXMnICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqIENsZWFyIHRoZSBjb21wb25lbnQgQUpBWCBlcnJvci4gKi9cblx0ZnVuY3Rpb24gY2xlYXJfZXJyb3IoICRyb290ICkge1xuXHRcdCRyb290LmZpbmQoICc+IC53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX2FqYXhfbm90aWNlJyApLmVtcHR5KCkucHJvcCggJ2hpZGRlbicsIHRydWUgKTtcblx0fVxuXG5cdC8qKiBSZXR1cm4gYSByZWdpc3RlcmVkIG5hdGl2ZSBjb250ZXh0IG9ubHkgd2hpbGUgaXRzIERPTSBlbGVtZW50IGlzIGxpdmUuICovXG5cdGZ1bmN0aW9uIGdldF9uYXRpdmVfY29udGV4dCggcHJvdmlkZXJfaWQgKSB7XG5cdFx0cHJvdmlkZXJfaWQgPSBOdW1iZXIoIHByb3ZpZGVyX2lkIHx8IDAgKTtcblx0XHR2YXIgY29udGV4dCA9IGFjdGl2ZV9uYXRpdmVfY29udGV4dHNbIHByb3ZpZGVyX2lkIF07XG5cdFx0aWYgKCAhIGNvbnRleHQgfHwgISBjb250ZXh0LmVsZW1lbnQgfHwgISBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY29udGFpbnMoIGNvbnRleHQuZWxlbWVudCApICkge1xuXHRcdFx0ZGVsZXRlIGFjdGl2ZV9uYXRpdmVfY29udGV4dHNbIHByb3ZpZGVyX2lkIF07XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0cmV0dXJuIGNvbnRleHQ7XG5cdH1cblxuXHQvKiogRGV0ZWN0IGFub3RoZXIgbGl2ZSBuYXRpdmUgQm9va2luZyBDYWxlbmRhciBmb3JtIGZvciB0aGUgc2FtZSBQcm92aWRlci4gKi9cblx0ZnVuY3Rpb24gaGFzX2R1cGxpY2F0ZV9wcm92aWRlcl9mb3JtKCAkcm9vdCwgcHJvdmlkZXJfaWQgKSB7XG5cdFx0cHJvdmlkZXJfaWQgPSBOdW1iZXIoIHByb3ZpZGVyX2lkIHx8IDAgKTtcblx0XHRpZiAoICEgcHJvdmlkZXJfaWQgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0dmFyIGNvbnRleHQgPSBnZXRfbmF0aXZlX2NvbnRleHQoIHByb3ZpZGVyX2lkICk7XG5cdFx0aWYgKCBjb250ZXh0ICYmICEgJC5jb250YWlucyggJHJvb3QuZ2V0KCAwICksIGNvbnRleHQuZWxlbWVudCApICkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICQoICdbaWQ9XCJib29raW5nX2Zvcm0nICsgcHJvdmlkZXJfaWQgKyAnXCJdJyApLmZpbHRlciggZnVuY3Rpb24gKCkge1xuXHRcdFx0cmV0dXJuICEgJC5jb250YWlucyggJHJvb3QuZ2V0KCAwICksIHRoaXMgKTtcblx0XHR9ICkubGVuZ3RoID4gMDtcblx0fVxuXG5cdC8qKiBSZWdpc3RlciB0aGUgZXhhY3Qgc2lnbmVkIG5hdGl2ZSBmb3JtIGNvbnRleHQgdXNlZCBieSBib29raW5nIHN1Ym1pc3Npb24uICovXG5cdGZ1bmN0aW9uIHJlZ2lzdGVyX25hdGl2ZV9mb3JtKCAkbmF0aXZlICkge1xuXHRcdHZhciBwcm92aWRlcl9pZCA9IE51bWJlciggJG5hdGl2ZS5kYXRhKCAncHJvdmlkZXItaWQnICkgfHwgMCApO1xuXHRcdHZhciBzZXJ2aWNlX2lkID0gTnVtYmVyKCAkbmF0aXZlLmRhdGEoICdzZXJ2aWNlLWlkJyApIHx8IDAgKTtcblx0XHR2YXIgY29udGV4dF90b2tlbiA9IFN0cmluZyggJG5hdGl2ZS5hdHRyKCAnZGF0YS1hcHBvaW50bWVudC1jb250ZXh0LXRva2VuJyApIHx8ICcnICk7XG5cdFx0dmFyIGFsbG93X3Bhc3QgPSAoICcxJyA9PT0gU3RyaW5nKCAkbmF0aXZlLmF0dHIoICdkYXRhLWFsbG93LXBhc3QnICkgfHwgJzAnICkgKSA/IDEgOiAwO1xuXHRcdHZhciBleGlzdGluZyA9IGdldF9uYXRpdmVfY29udGV4dCggcHJvdmlkZXJfaWQgKTtcblxuXHRcdGlmICggISBwcm92aWRlcl9pZCB8fCAhIHNlcnZpY2VfaWQgfHwgISBjb250ZXh0X3Rva2VuICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoIGV4aXN0aW5nICYmIGV4aXN0aW5nLmVsZW1lbnQgIT09ICRuYXRpdmUuZ2V0KCAwICkgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0YWN0aXZlX25hdGl2ZV9jb250ZXh0c1sgcHJvdmlkZXJfaWQgXSA9IHtcblx0XHRcdGVsZW1lbnQ6ICRuYXRpdmUuZ2V0KCAwICksXG5cdFx0XHRzZXJ2aWNlX2lkOiBzZXJ2aWNlX2lkLFxuXHRcdFx0cHJvdmlkZXJfaWQ6IHByb3ZpZGVyX2lkLFxuXHRcdFx0Y29udGV4dF90b2tlbjogY29udGV4dF90b2tlbixcblx0XHRcdGFsbG93X3Bhc3Q6IGFsbG93X3Bhc3Rcblx0XHR9O1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqIFJlbW92ZSBhIG5hdGl2ZSBmb3JtIGZyb20gdGhlIGxvY2FsIHN1Ym1pc3Npb24tY29udGV4dCByZWdpc3RyeS4gKi9cblx0ZnVuY3Rpb24gdW5yZWdpc3Rlcl9uYXRpdmVfZm9ybSggJG5hdGl2ZSApIHtcblx0XHR2YXIgcHJvdmlkZXJfaWQgPSBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3Byb3ZpZGVyLWlkJyApIHx8IDAgKTtcblx0XHR2YXIgY29udGV4dCA9IGdldF9uYXRpdmVfY29udGV4dCggcHJvdmlkZXJfaWQgKTtcblx0XHRpZiAoIGNvbnRleHQgJiYgY29udGV4dC5lbGVtZW50ID09PSAkbmF0aXZlLmdldCggMCApICkge1xuXHRcdFx0ZGVsZXRlIGFjdGl2ZV9uYXRpdmVfY29udGV4dHNbIHByb3ZpZGVyX2lkIF07XG5cdFx0fVxuXHR9XG5cblx0LyoqIFJldHVybiB0aGUgbmF0aXZlIFN0YXJ0IFRpbWUgZmllbGQgdXNlZCBieSB0aGUgZml4ZWQgU2VydmljZSBkdXJhdGlvbi4gKi9cblx0ZnVuY3Rpb24gZ2V0X3N0YXJ0X3RpbWVfZmllbGQoICRuYXRpdmUgKSB7XG5cdFx0dmFyIHByb3ZpZGVyX2lkID0gTnVtYmVyKCAkbmF0aXZlLmRhdGEoICdwcm92aWRlci1pZCcgKSB8fCAwICk7XG5cdFx0cmV0dXJuICRuYXRpdmUuZmluZCggJ1tuYW1lPVwic3RhcnR0aW1lJyArIHByb3ZpZGVyX2lkICsgJ1wiXSwgW25hbWU9XCJzdGFydHRpbWUnICsgcHJvdmlkZXJfaWQgKyAnW11cIl0nICkubm90KCAnW2RhdGEtd3BiYy1ib29raW5nLXN1Ym1pdC1pZ25vcmU9XCIxXCJdJyApLmZpcnN0KCk7XG5cdH1cblxuXHQvKiogUmV0dXJuIHNlbGVjdGVkIGNhbGVuZGFyIGRhdGVzIGluIHRoZSBzZXJ2ZXIncyBzdHJpY3QgU1FMLWRhdGUgZm9ybWF0LiAqL1xuXHRmdW5jdGlvbiBnZXRfc2VsZWN0ZWRfZGF0ZXMoICRuYXRpdmUgKSB7XG5cdFx0dmFyIHByb3ZpZGVyX2lkID0gTnVtYmVyKCAkbmF0aXZlLmRhdGEoICdwcm92aWRlci1pZCcgKSB8fCAwICk7XG5cdFx0aWYgKCBwcm92aWRlcl9pZCAmJiB0eXBlb2Ygd2luZG93LndwYmNfZ2V0X19zZWxlY3RlZF9kYXRlc19zcWxfX2FzX2FyciA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdHJldHVybiB3aW5kb3cud3BiY19nZXRfX3NlbGVjdGVkX2RhdGVzX3NxbF9fYXNfYXJyKCBwcm92aWRlcl9pZCApO1xuXHRcdH1cblxuXHRcdHZhciB2YWx1ZSA9IFN0cmluZyggJG5hdGl2ZS5maW5kKCAnI2RhdGVfYm9va2luZycgKyBwcm92aWRlcl9pZCApLnZhbCgpIHx8ICcnICk7XG5cdFx0cmV0dXJuIHZhbHVlLnNwbGl0KCAnLCcgKS5tYXAoIGZ1bmN0aW9uICggZGF0ZV92YWx1ZSApIHtcblx0XHRcdHZhciBwYXJ0cyA9ICQudHJpbSggZGF0ZV92YWx1ZSApLnNwbGl0KCAnLicgKTtcblx0XHRcdHJldHVybiAzID09PSBwYXJ0cy5sZW5ndGggPyBwYXJ0c1sgMiBdICsgJy0nICsgcGFydHNbIDEgXSArICctJyArIHBhcnRzWyAwIF0gOiAnJztcblx0XHR9ICkuZmlsdGVyKCBmdW5jdGlvbiAoIGRhdGVfdmFsdWUgKSB7XG5cdFx0XHRyZXR1cm4gL15cXGR7NH0tXFxkezJ9LVxcZHsyfSQvLnRlc3QoIGRhdGVfdmFsdWUgKTtcblx0XHR9ICk7XG5cdH1cblxuXHQvKiogUmVhZCB0aGUgY3VycmVudCBkYXRlL3N0YXJ0IHNlbGVjdGlvbiBhbmQgaXRzIHN0YWJsZSByZXF1ZXN0IHNpZ25hdHVyZS4gKi9cblx0ZnVuY3Rpb24gZ2V0X3RpbWVfc2VsZWN0aW9uKCAkbmF0aXZlICkge1xuXHRcdHZhciAkc3RhcnQgPSBnZXRfc3RhcnRfdGltZV9maWVsZCggJG5hdGl2ZSApO1xuXHRcdHZhciBkYXRlcyA9IGdldF9zZWxlY3RlZF9kYXRlcyggJG5hdGl2ZSApO1xuXHRcdHZhciBzdGFydF90aW1lID0gJHN0YXJ0Lmxlbmd0aCA/IFN0cmluZyggJHN0YXJ0LnZhbCgpIHx8ICcnICkgOiAnJztcblx0XHRyZXR1cm4ge1xuXHRcdFx0JHN0YXJ0OiAkc3RhcnQsXG5cdFx0XHRkYXRlczogZGF0ZXMsXG5cdFx0XHRzdGFydF90aW1lOiBzdGFydF90aW1lLFxuXHRcdFx0Y29tcGxldGU6ICEhICggZGF0ZXMubGVuZ3RoICYmIC9eXFxkezEsMn06XFxkezJ9KD86OlxcZHsyfSk/JC8udGVzdCggc3RhcnRfdGltZSApICksXG5cdFx0XHRzaWduYXR1cmU6IGRhdGVzLmpvaW4oICcsJyApICsgJ3wnICsgc3RhcnRfdGltZVxuXHRcdH07XG5cdH1cblxuXHQvKiogRGV0ZXJtaW5lIHdoZXRoZXIgdGhlIFN0YXJ0IFRpbWUgZmllbGQgYmVsb25ncyB0byB0aGUgdmlzaWJsZSB3aXphcmQgc3RlcC4gKi9cblx0ZnVuY3Rpb24gaXNfdGltZV9zZWxlY3Rpb25fc3RhZ2VfYWN0aXZlKCBzZWxlY3Rpb24gKSB7XG5cdFx0dmFyICRzdGVwID0gc2VsZWN0aW9uLiRzdGFydC5jbG9zZXN0KCAnLndwYmNfd2l6YXJkX3N0ZXAnICk7XG5cdFx0cmV0dXJuICEgJHN0ZXAubGVuZ3RoIHx8ICggJHN0ZXAuaXMoICc6dmlzaWJsZScgKSAmJiAhICRzdGVwLmhhc0NsYXNzKCAnd3BiY193aXphcmRfc3RlcF9oaWRkZW4nICkgKTtcblx0fVxuXG5cdC8qKiBGaW5kIHRoZSB2aXNpYmxlIFN0YXJ0IFRpbWUgVUkgYmVuZWF0aCB3aGljaCB2YWxpZGF0aW9uIGlzIGV4cGxhaW5lZC4gKi9cblx0ZnVuY3Rpb24gZ2V0X3RpbWVfbm90aWNlX2FuY2hvciggc2VsZWN0aW9uICkge1xuXHRcdHZhciAkcGlja2VyID0gc2VsZWN0aW9uLiRzdGFydC5uZXh0QWxsKCAnLndwYmNfdGltZXNfc2VsZWN0b3InICkuZmlyc3QoKTtcblx0XHRyZXR1cm4gJHBpY2tlci5sZW5ndGggPyAkcGlja2VyIDogc2VsZWN0aW9uLiRzdGFydDtcblx0fVxuXG5cdC8qKiBSZW1vdmUgdGhlIEFwcG9pbnRtZW50IGJ1ZmZlciB3YXJuaW5nIGFuZCBpbnZhbGlkIGZpZWxkIHNlbWFudGljcy4gKi9cblx0ZnVuY3Rpb24gY2xlYXJfdGltZV9ub3RpY2UoICRuYXRpdmUgKSB7XG5cdFx0JG5hdGl2ZS5maW5kKCAnLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fdGltZV9ub3RpY2UnICkucmVtb3ZlKCk7XG5cdFx0Z2V0X3N0YXJ0X3RpbWVfZmllbGQoICRuYXRpdmUgKS5yZW1vdmVBdHRyKCAnYXJpYS1pbnZhbGlkJyApLm5leHRBbGwoICcud3BiY190aW1lc19zZWxlY3RvcicgKS5maXJzdCgpLnJlbW92ZUF0dHIoICdhcmlhLWludmFsaWQnICk7XG5cdH1cblxuXHQvKiogU2hvdyBhIHBlcnNpc3RlbnQgd2FybmluZyB1c2luZyBCb29raW5nIENhbGVuZGFyJ3MgZnJvbnRlbmQgbWVzc2FnZSBVSS4gKi9cblx0ZnVuY3Rpb24gc2hvd190aW1lX25vdGljZSggJG5hdGl2ZSwgc2VsZWN0aW9uLCBtZXNzYWdlICkge1xuXHRcdGNsZWFyX3RpbWVfbm90aWNlKCAkbmF0aXZlICk7XG5cdFx0dmFyICRhbmNob3IgPSBnZXRfdGltZV9ub3RpY2VfYW5jaG9yKCBzZWxlY3Rpb24gKTtcblx0XHRpZiAoICEgJGFuY2hvci5sZW5ndGggKSB7XG5cdFx0XHQkYW5jaG9yID0gJG5hdGl2ZS5maW5kKCAnLmJrX2NhbGVuZGFyX2ZyYW1lJyApLmZpcnN0KCk7XG5cdFx0fVxuXHRcdGlmICggISAkYW5jaG9yLmxlbmd0aCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRzZWxlY3Rpb24uJHN0YXJ0LmF0dHIoICdhcmlhLWludmFsaWQnLCAndHJ1ZScgKS5uZXh0QWxsKCAnLndwYmNfdGltZXNfc2VsZWN0b3InICkuZmlyc3QoKS5hdHRyKCAnYXJpYS1pbnZhbGlkJywgJ3RydWUnICk7XG5cdFx0JCggJzxkaXY+Jywge1xuXHRcdFx0J2NsYXNzJzogJ3dwYmNfYm9va2luZ19hcHBvaW50bWVudF9fdGltZV9ub3RpY2Ugd3BiY19mcm9udF9lbmRfX21lc3NhZ2Ugd3BiY19mZV9tZXNzYWdlIHdwYmNfZmVfbWVzc2FnZV93YXJuaW5nJyxcblx0XHRcdHJvbGU6ICdhbGVydCdcblx0XHR9ICkuYXBwZW5kKCAkKCAnPGk+JywgeyAnY2xhc3MnOiAnbWVudV9pY29uIGljb24tMXggd3BiY19pY25fd2FybmluZycsICdhcmlhLWhpZGRlbic6ICd0cnVlJyB9ICkgKVxuXHRcdFx0LmFwcGVuZCggJCggJzxzcGFuPicgKS50ZXh0KCBtZXNzYWdlIHx8IGNvbmZpZy52YWxpZGF0aW9uX2Vycm9yIHx8IGNvbmZpZy5lcnJvciApIClcblx0XHRcdC5pbnNlcnRBZnRlciggJGFuY2hvciApO1xuXHR9XG5cblx0LyoqIFJldHVybiBvciBpbml0aWFsaXplIHRoZSB2YWxpZGF0aW9uIHN0YXRlIG93bmVkIGJ5IG9uZSBuYXRpdmUgZm9ybS4gKi9cblx0ZnVuY3Rpb24gZ2V0X3RpbWVfdmFsaWRhdGlvbl9zdGF0ZSggJG5hdGl2ZSApIHtcblx0XHR2YXIgc3RhdGUgPSAkbmF0aXZlLmRhdGEoICd3cGJjLWFwcG9pbnRtZW50LXRpbWUtdmFsaWRhdGlvbicgKTtcblx0XHRpZiAoICEgc3RhdGUgKSB7XG5cdFx0XHRzdGF0ZSA9IHtcblx0XHRcdFx0c2VxdWVuY2U6IDAsXG5cdFx0XHRcdHNpZ25hdHVyZTogJycsXG5cdFx0XHRcdHN0YXR1czogJ2luY29tcGxldGUnLFxuXHRcdFx0XHRyZXF1ZXN0OiBudWxsLFxuXHRcdFx0XHRwcm9taXNlOiBudWxsLFxuXHRcdFx0XHR0aW1lcjogbnVsbCxcblx0XHRcdFx0YXZhaWxhYmlsaXR5X3NlcXVlbmNlOiAwLFxuXHRcdFx0XHRhdmFpbGFiaWxpdHlfcmVxdWVzdDogbnVsbCxcblx0XHRcdFx0YXZhaWxhYmlsaXR5X3RpbWVyOiBudWxsLFxuXHRcdFx0XHRhdmFpbGFibGVfc2xvdHM6IHt9XG5cdFx0XHR9O1xuXHRcdFx0JG5hdGl2ZS5kYXRhKCAnd3BiYy1hcHBvaW50bWVudC10aW1lLXZhbGlkYXRpb24nLCBzdGF0ZSApO1xuXHRcdH1cblx0XHRyZXR1cm4gc3RhdGU7XG5cdH1cblxuXHQvKiogUmVzdG9yZSBvbmx5IG9wdGlvbiBzdGF0ZSBwcmV2aW91c2x5IG93bmVkIGJ5IHRoZSBBcHBvaW50bWVudCBmaWx0ZXIuICovXG5cdGZ1bmN0aW9uIGNsZWFyX2FwcG9pbnRtZW50X2Rpc2FibGVkX3RpbWVzKCAkc3RhcnQgKSB7XG5cdFx0JHN0YXJ0LmZpbmQoICdvcHRpb25bZGF0YS13cGJjLWFwcG9pbnRtZW50LXVuYXZhaWxhYmxlPVwiMVwiXScgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgJG9wdGlvbiA9ICQoIHRoaXMgKTtcblx0XHRcdGlmICggISAkb3B0aW9uLmhhc0NsYXNzKCAnYm9va2VkJyApICkge1xuXHRcdFx0XHQkb3B0aW9uLnByb3AoICdkaXNhYmxlZCcsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0XHQkb3B0aW9uLnJlbW92ZUF0dHIoICdkYXRhLXdwYmMtYXBwb2ludG1lbnQtdW5hdmFpbGFibGUnICk7XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqIFJlYnVpbGQgdGhlIG9wdGlvbmFsIHBsYXRlLXN0eWxlIHBpY2tlciBmcm9tIHRoZSBmaWx0ZXJlZCBuYXRpdmUgc2VsZWN0LiAqL1xuXHRmdW5jdGlvbiByZWZyZXNoX3N0YXJ0X3RpbWVfcGlja2VyKCAkc3RhcnQgKSB7XG5cdFx0aWYgKCAkc3RhcnQubGVuZ3RoICYmIHR5cGVvZiAkc3RhcnQud3BiY190aW1lc2VsZWN0b3IgPT09ICdmdW5jdGlvbicgJiYgJHN0YXJ0Lm5leHRBbGwoICcud3BiY190aW1lc19zZWxlY3RvcicgKS5sZW5ndGggKSB7XG5cdFx0XHQkc3RhcnQud3BiY190aW1lc2VsZWN0b3IoKTtcblx0XHR9XG5cdH1cblxuXHQvKiogUmVhZCBhbGwgb3B0aW9ucyBzdGlsbCBhbGxvd2VkIGJ5IHRoZSBvcmRpbmFyeSBCb29raW5nIENhbGVuZGFyIGVuZ2luZS4gKi9cblx0ZnVuY3Rpb24gZ2V0X2NvcmVfYXZhaWxhYmxlX3N0YXJ0X3RpbWVzKCAkc3RhcnQgKSB7XG5cdFx0dmFyIHZhbHVlcyA9IFtdO1xuXHRcdCRzdGFydC5maW5kKCAnb3B0aW9uJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciAkb3B0aW9uID0gJCggdGhpcyApO1xuXHRcdFx0dmFyIHZhbHVlID0gU3RyaW5nKCAkb3B0aW9uLnZhbCgpIHx8ICcnICk7XG5cdFx0XHR2YXIgYXBwb2ludG1lbnRfZGlzYWJsZWQgPSAnMScgPT09IFN0cmluZyggJG9wdGlvbi5hdHRyKCAnZGF0YS13cGJjLWFwcG9pbnRtZW50LXVuYXZhaWxhYmxlJyApIHx8ICcnICk7XG5cdFx0XHRpZiAoIC9eXFxkezEsMn06XFxkezJ9KD86OlxcZHsyfSk/JC8udGVzdCggdmFsdWUgKSAmJiAoICEgJG9wdGlvbi5wcm9wKCAnZGlzYWJsZWQnICkgfHwgKCBhcHBvaW50bWVudF9kaXNhYmxlZCAmJiAhICRvcHRpb24uaGFzQ2xhc3MoICdib29rZWQnICkgKSApICkge1xuXHRcdFx0XHR2YWx1ZXMucHVzaCggdmFsdWUgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdFx0cmV0dXJuIHZhbHVlcztcblx0fVxuXG5cdC8qKiBDb252ZXJ0IGEgYnJvd3NlciB0aW1lIHN0cmluZyB0byBtaW51dGVzIGZyb20gdGhlIHN0YXJ0IG9mIGl0cyBkYXkuICovXG5cdGZ1bmN0aW9uIGRlYnVnX3RpbWVfdG9fbWludXRlcyggdGltZV92YWx1ZSApIHtcblx0XHR2YXIgcGFydHMgPSBTdHJpbmcoIHRpbWVfdmFsdWUgfHwgJycgKS5zcGxpdCggJzonICk7XG5cdFx0aWYgKCBwYXJ0cy5sZW5ndGggPCAyICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHJldHVybiAoIE51bWJlciggcGFydHNbIDAgXSApICogNjAgKSArIE51bWJlciggcGFydHNbIDEgXSApO1xuXHR9XG5cblx0LyoqIEZvcm1hdCBkZWJ1ZyB0aW1lIHdoaWxlIHJldGFpbmluZyBhIHByZXZpb3VzL25leHQtZGF5IGJvdW5kYXJ5LiAqL1xuXHRmdW5jdGlvbiBkZWJ1Z19mb3JtYXRfbWludXRlcyggdG90YWxfbWludXRlcyApIHtcblx0XHR2YXIgZGF5X29mZnNldCA9IDA7XG5cdFx0d2hpbGUgKCB0b3RhbF9taW51dGVzIDwgMCApIHtcblx0XHRcdHRvdGFsX21pbnV0ZXMgKz0gMTQ0MDtcblx0XHRcdGRheV9vZmZzZXQtLTtcblx0XHR9XG5cdFx0d2hpbGUgKCB0b3RhbF9taW51dGVzID49IDE0NDAgKSB7XG5cdFx0XHR0b3RhbF9taW51dGVzIC09IDE0NDA7XG5cdFx0XHRkYXlfb2Zmc2V0Kys7XG5cdFx0fVxuXHRcdHZhciBob3VycyA9ICggJzAnICsgTWF0aC5mbG9vciggdG90YWxfbWludXRlcyAvIDYwICkgKS5zbGljZSggLTIgKTtcblx0XHR2YXIgbWludXRlcyA9ICggJzAnICsgKCB0b3RhbF9taW51dGVzICUgNjAgKSApLnNsaWNlKCAtMiApO1xuXHRcdHJldHVybiBob3VycyArICc6JyArIG1pbnV0ZXMgKyAoIGRheV9vZmZzZXQgPyAnICgnICsgKCBkYXlfb2Zmc2V0ID4gMCA/ICcrJyA6ICcnICkgKyBkYXlfb2Zmc2V0ICsgJyBkYXkpJyA6ICcnICk7XG5cdH1cblxuXHQvKiogRXhwbGFpbiB0aGUgYXN5bmNocm9ub3VzIFNlcnZpY2UtYXdhcmUgYXZhaWxhYmlsaXR5IHBhc3MgaW4gdGhlIGNvbnNvbGUuICovXG5cdGZ1bmN0aW9uIGxvZ19zdGFydF90aW1lX2ZpbHRlcl9yZXF1ZXN0KCAkbmF0aXZlLCBkYXRlcywgc3RhcnRfdGltZXMgKSB7XG5cdFx0aWYgKCAhIHdpbmRvdy5jb25zb2xlIHx8IHR5cGVvZiB3aW5kb3cuY29uc29sZS5pbmZvICE9PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR3aW5kb3cuY29uc29sZS5pbmZvKFxuXHRcdFx0J1tCb29raW5nIENhbGVuZGFyIEFwcG9pbnRtZW50XSBSZWNoZWNraW5nIFN0YXJ0IFRpbWVzIHdpdGggU2VydmljZSBkdXJhdGlvbiBhbmQgYnVmZmVycy4gVGhlIGluaXRpYWwgbGlzdCBjb21lcyBmcm9tIFByb3ZpZGVyIGNhbGVuZGFyIGF2YWlsYWJpbGl0eSBhbmQgbWF5IG5vdyBiZSByZWR1Y2VkLicsXG5cdFx0XHR7XG5cdFx0XHRcdHNlcnZpY2VfaWQ6IE51bWJlciggJG5hdGl2ZS5kYXRhKCAnc2VydmljZS1pZCcgKSB8fCAwICksXG5cdFx0XHRcdHByb3ZpZGVyX2lkOiBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3Byb3ZpZGVyLWlkJyApIHx8IDAgKSxcblx0XHRcdFx0ZGF0ZXM6IGRhdGVzLnNsaWNlKCAwICksXG5cdFx0XHRcdGluaXRpYWxfc3RhcnRfdGltZXM6IHN0YXJ0X3RpbWVzLnNsaWNlKCAwIClcblx0XHRcdH1cblx0XHQpO1xuXHR9XG5cblx0LyoqIExvZyBvbmx5IHNjaGVkdWxpbmcgZGF0YSBuZWVkZWQgdG8gdW5kZXJzdGFuZCByZW1vdmVkIFN0YXJ0IFRpbWVzLiAqL1xuXHRmdW5jdGlvbiBsb2dfc3RhcnRfdGltZV9maWx0ZXJfcmVzdWx0KCAkbmF0aXZlLCBkYXRlcywgZGF0YSApIHtcblx0XHRpZiAoICEgd2luZG93LmNvbnNvbGUgfHwgdHlwZW9mIHdpbmRvdy5jb25zb2xlLmluZm8gIT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHZhciBidWZmZXJfYmVmb3JlID0gTnVtYmVyKCBkYXRhLmJ1ZmZlcl9iZWZvcmUgfHwgMCApO1xuXHRcdHZhciBidWZmZXJfYWZ0ZXIgPSBOdW1iZXIoIGRhdGEuYnVmZmVyX2FmdGVyIHx8IDAgKTtcblx0XHR2YXIgYmxvY2tlZCA9IFtdO1xuXHRcdE9iamVjdC5rZXlzKCBkYXRhLnNsb3RzIHx8IHt9ICkuZm9yRWFjaCggZnVuY3Rpb24gKCBzdGFydF90aW1lICkge1xuXHRcdFx0dmFyIHJlc3VsdCA9IGRhdGEuc2xvdHNbIHN0YXJ0X3RpbWUgXTtcblx0XHRcdGlmICggISByZXN1bHQgfHwgZmFsc2UgIT09IHJlc3VsdC52YWxpZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dmFyIGVuZF90aW1lID0gU3RyaW5nKCByZXN1bHQuZW5kX3RpbWUgfHwgJycgKTtcblx0XHRcdHZhciBzdGFydF9taW51dGVzID0gZGVidWdfdGltZV90b19taW51dGVzKCBzdGFydF90aW1lICk7XG5cdFx0XHR2YXIgZW5kX21pbnV0ZXMgPSBkZWJ1Z190aW1lX3RvX21pbnV0ZXMoIGVuZF90aW1lICk7XG5cdFx0XHRibG9ja2VkLnB1c2goIHtcblx0XHRcdFx0c3RhcnRfdGltZTogc3RhcnRfdGltZSxcblx0XHRcdFx0YXBwb2ludG1lbnRfdGltZTogZW5kX3RpbWUgPyBzdGFydF90aW1lICsgJyAtICcgKyBlbmRfdGltZSA6IHN0YXJ0X3RpbWUsXG5cdFx0XHRcdHByb3ZpZGVyX3Jlc2VydmVkOiBudWxsICE9PSBzdGFydF9taW51dGVzICYmIG51bGwgIT09IGVuZF9taW51dGVzXG5cdFx0XHRcdFx0PyBkZWJ1Z19mb3JtYXRfbWludXRlcyggc3RhcnRfbWludXRlcyAtIGJ1ZmZlcl9iZWZvcmUgKSArICcgLSAnICsgZGVidWdfZm9ybWF0X21pbnV0ZXMoIGVuZF9taW51dGVzICsgYnVmZmVyX2FmdGVyIClcblx0XHRcdFx0XHQ6ICcnLFxuXHRcdFx0XHRyZWFzb246IHJlc3VsdC5tZXNzYWdlIHx8IHJlc3VsdC5jb2RlIHx8IGNvbmZpZy52YWxpZGF0aW9uX2Vycm9yXG5cdFx0XHR9ICk7XG5cdFx0fSApO1xuXG5cdFx0d2luZG93LmNvbnNvbGUuaW5mbyhcblx0XHRcdCdbQm9va2luZyBDYWxlbmRhciBBcHBvaW50bWVudF0gU2VydmljZS1hd2FyZSBTdGFydCBUaW1lIGNoZWNrIGNvbXBsZXRlZC4nLFxuXHRcdFx0e1xuXHRcdFx0XHRzZXJ2aWNlX2lkOiBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3NlcnZpY2UtaWQnICkgfHwgMCApLFxuXHRcdFx0XHRwcm92aWRlcl9pZDogTnVtYmVyKCAkbmF0aXZlLmRhdGEoICdwcm92aWRlci1pZCcgKSB8fCAwICksXG5cdFx0XHRcdGRhdGVzOiBkYXRlcy5zbGljZSggMCApLFxuXHRcdFx0XHRkdXJhdGlvbl9taW51dGVzOiBOdW1iZXIoIGRhdGEuZHVyYXRpb24gfHwgMCApLFxuXHRcdFx0XHRidWZmZXJfYmVmb3JlX21pbnV0ZXM6IGJ1ZmZlcl9iZWZvcmUsXG5cdFx0XHRcdGJ1ZmZlcl9hZnRlcl9taW51dGVzOiBidWZmZXJfYWZ0ZXIsXG5cdFx0XHRcdGJsb2NrZWRfc3RhcnRfdGltZXM6IGJsb2NrZWQubWFwKCBmdW5jdGlvbiAoIGl0ZW0gKSB7IHJldHVybiBpdGVtLnN0YXJ0X3RpbWU7IH0gKVxuXHRcdFx0fVxuXHRcdCk7XG5cdFx0aWYgKCBibG9ja2VkLmxlbmd0aCAmJiB0eXBlb2Ygd2luZG93LmNvbnNvbGUudGFibGUgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHR3aW5kb3cuY29uc29sZS50YWJsZSggYmxvY2tlZCApO1xuXHRcdH1cblx0fVxuXG5cdC8qKiBBcHBseSBvbmUgc2VydmVyIHJlc3BvbnNlIHdpdGhvdXQgZXhwb3NpbmcgYW5vdGhlciBjdXN0b21lcidzIGJvb2tpbmcuICovXG5cdGZ1bmN0aW9uIGFwcGx5X2F2YWlsYWJsZV9zdGFydF90aW1lcyggJG5hdGl2ZSwgc2xvdHMgKSB7XG5cdFx0dmFyIHNlbGVjdGlvbiA9IGdldF90aW1lX3NlbGVjdGlvbiggJG5hdGl2ZSApO1xuXHRcdHZhciAkc3RhcnQgPSBzZWxlY3Rpb24uJHN0YXJ0O1xuXHRcdHZhciBzZWxlY3RlZF92YWx1ZSA9IHNlbGVjdGlvbi5zdGFydF90aW1lO1xuXHRcdHZhciBzZWxlY3RlZF9tZXNzYWdlID0gJyc7XG5cdFx0Y2xlYXJfYXBwb2ludG1lbnRfZGlzYWJsZWRfdGltZXMoICRzdGFydCApO1xuXG5cdFx0JHN0YXJ0LmZpbmQoICdvcHRpb24nICkuZWFjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyICRvcHRpb24gPSAkKCB0aGlzICk7XG5cdFx0XHR2YXIgdmFsdWUgPSBTdHJpbmcoICRvcHRpb24udmFsKCkgfHwgJycgKTtcblx0XHRcdHZhciByZXN1bHQgPSBzbG90cyAmJiBzbG90c1sgdmFsdWUgXSA/IHNsb3RzWyB2YWx1ZSBdIDogbnVsbDtcblx0XHRcdGlmICggcmVzdWx0ICYmIGZhbHNlID09PSByZXN1bHQudmFsaWQgJiYgISAkb3B0aW9uLmhhc0NsYXNzKCAnYm9va2VkJyApICkge1xuXHRcdFx0XHQkb3B0aW9uLnByb3AoICdkaXNhYmxlZCcsIHRydWUgKS5hdHRyKCAnZGF0YS13cGJjLWFwcG9pbnRtZW50LXVuYXZhaWxhYmxlJywgJzEnICk7XG5cdFx0XHRcdGlmICggc2VsZWN0ZWRfdmFsdWUgPT09IHZhbHVlICkge1xuXHRcdFx0XHRcdHNlbGVjdGVkX21lc3NhZ2UgPSByZXN1bHQubWVzc2FnZSB8fCBjb25maWcudmFsaWRhdGlvbl9lcnJvcjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gKTtcblxuXHRcdGlmICggc2VsZWN0ZWRfbWVzc2FnZSApIHtcblx0XHRcdCRzdGFydC52YWwoICcnICk7XG5cdFx0XHRzaG93X3RpbWVfbm90aWNlKCAkbmF0aXZlLCBzZWxlY3Rpb24sIHNlbGVjdGVkX21lc3NhZ2UgKTtcblx0XHR9XG5cdFx0cmVmcmVzaF9zdGFydF90aW1lX3BpY2tlciggJHN0YXJ0ICk7XG5cdH1cblxuXHQvKiogRmlsdGVyIHRoZSBjb21wbGV0ZSBTdGFydCBUaW1lIGxpc3Qgd2l0aCBvbmUgYm91bmRlZCBzZXJ2ZXIgcmVxdWVzdC4gKi9cblx0ZnVuY3Rpb24gbG9hZF9hdmFpbGFibGVfc3RhcnRfdGltZXMoICRuYXRpdmUgKSB7XG5cdFx0dmFyIHN0YXRlID0gZ2V0X3RpbWVfdmFsaWRhdGlvbl9zdGF0ZSggJG5hdGl2ZSApO1xuXHRcdHZhciAkc3RhcnQgPSBnZXRfc3RhcnRfdGltZV9maWVsZCggJG5hdGl2ZSApO1xuXHRcdHZhciBkYXRlcyA9IGdldF9zZWxlY3RlZF9kYXRlcyggJG5hdGl2ZSApO1xuXHRcdHZhciBzdGFydF90aW1lcyA9IGdldF9jb3JlX2F2YWlsYWJsZV9zdGFydF90aW1lcyggJHN0YXJ0ICk7XG5cdFx0dmFyIHNlcXVlbmNlID0gKytzdGF0ZS5hdmFpbGFiaWxpdHlfc2VxdWVuY2U7XG5cblx0XHRpZiAoIHN0YXRlLmF2YWlsYWJpbGl0eV9yZXF1ZXN0ICYmIDQgIT09IHN0YXRlLmF2YWlsYWJpbGl0eV9yZXF1ZXN0LnJlYWR5U3RhdGUgKSB7XG5cdFx0XHRzdGF0ZS5hdmFpbGFiaWxpdHlfcmVxdWVzdC5hYm9ydCgpO1xuXHRcdH1cblx0XHRpZiAoICEgJHN0YXJ0Lmxlbmd0aCB8fCAhIGRhdGVzLmxlbmd0aCB8fCAhIHN0YXJ0X3RpbWVzLmxlbmd0aCApIHtcblx0XHRcdGNsZWFyX2FwcG9pbnRtZW50X2Rpc2FibGVkX3RpbWVzKCAkc3RhcnQgKTtcblx0XHRcdHJlZnJlc2hfc3RhcnRfdGltZV9waWNrZXIoICRzdGFydCApO1xuXHRcdFx0c3RhdGUuYXZhaWxhYmxlX3Nsb3RzID0ge307XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGxvZ19zdGFydF90aW1lX2ZpbHRlcl9yZXF1ZXN0KCAkbmF0aXZlLCBkYXRlcywgc3RhcnRfdGltZXMgKTtcblxuXHRcdHN0YXRlLmF2YWlsYWJpbGl0eV9yZXF1ZXN0ID0gJC5wb3N0KCBjb25maWcuYWpheF91cmwsIHtcblx0XHRcdGFjdGlvbjogY29uZmlnLnZhbGlkYXRlX2FjdGlvbixcblx0XHRcdG5vbmNlOiBjb25maWcubm9uY2UsXG5cdFx0XHRzZXJ2aWNlX2lkOiBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3NlcnZpY2UtaWQnICkgfHwgMCApLFxuXHRcdFx0cHJvdmlkZXJfaWQ6IE51bWJlciggJG5hdGl2ZS5kYXRhKCAncHJvdmlkZXItaWQnICkgfHwgMCApLFxuXHRcdFx0Y29udGV4dF90b2tlbjogU3RyaW5nKCAkbmF0aXZlLmF0dHIoICdkYXRhLWFwcG9pbnRtZW50LWNvbnRleHQtdG9rZW4nICkgfHwgJycgKSxcblx0XHRcdGRhdGVzOiBkYXRlcyxcblx0XHRcdHN0YXJ0X3RpbWVzOiBzdGFydF90aW1lc1xuXHRcdH0gKTtcblx0XHRzdGF0ZS5hdmFpbGFiaWxpdHlfcmVxdWVzdC5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0aWYgKCBzZXF1ZW5jZSAhPT0gc3RhdGUuYXZhaWxhYmlsaXR5X3NlcXVlbmNlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR2YXIgZGF0YSA9IHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgPyByZXNwb25zZS5kYXRhIDoge307XG5cdFx0XHRpZiAoICEgcmVzcG9uc2UgfHwgISByZXNwb25zZS5zdWNjZXNzIHx8ICEgZGF0YS5zbG90cyApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0c3RhdGUuYXZhaWxhYmxlX3Nsb3RzID0gZGF0YS5zbG90cztcblx0XHRcdGxvZ19zdGFydF90aW1lX2ZpbHRlcl9yZXN1bHQoICRuYXRpdmUsIGRhdGVzLCBkYXRhICk7XG5cdFx0XHRhcHBseV9hdmFpbGFibGVfc3RhcnRfdGltZXMoICRuYXRpdmUsIGRhdGEuc2xvdHMgKTtcblx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCB4aHIsIHN0YXR1cyApIHtcblx0XHRcdGlmICggJ2Fib3J0JyA9PT0gc3RhdHVzIHx8IHNlcXVlbmNlICE9PSBzdGF0ZS5hdmFpbGFiaWxpdHlfc2VxdWVuY2UgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNsZWFyX2FwcG9pbnRtZW50X2Rpc2FibGVkX3RpbWVzKCAkc3RhcnQgKTtcblx0XHRcdHJlZnJlc2hfc3RhcnRfdGltZV9waWNrZXIoICRzdGFydCApO1xuXHRcdFx0c3RhdGUuYXZhaWxhYmxlX3Nsb3RzID0ge307XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqIERlYm91bmNlIHRoZSB3aG9sZS1saXN0IGZpbHRlciBhZnRlciBjb3JlIGF2YWlsYWJpbGl0eSBoYXMgcmVmcmVzaGVkLiAqL1xuXHRmdW5jdGlvbiBzY2hlZHVsZV9hdmFpbGFibGVfc3RhcnRfdGltZXMoICRuYXRpdmUgKSB7XG5cdFx0dmFyIHN0YXRlID0gZ2V0X3RpbWVfdmFsaWRhdGlvbl9zdGF0ZSggJG5hdGl2ZSApO1xuXHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIHN0YXRlLmF2YWlsYWJpbGl0eV90aW1lciApO1xuXHRcdHN0YXRlLmF2YWlsYWJpbGl0eV90aW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRsb2FkX2F2YWlsYWJsZV9zdGFydF90aW1lcyggJG5hdGl2ZSApO1xuXHRcdH0sIDMwICk7XG5cdH1cblxuXHQvKiogVmFsaWRhdGUgY3VycmVudCBTZXJ2aWNlIGR1cmF0aW9uL2J1ZmZlcnMgdGhyb3VnaCB0aGUgYXV0aG9yaXRhdGl2ZSBzZXJ2ZXIuICovXG5cdGZ1bmN0aW9uIHZhbGlkYXRlX3RpbWVfc2VsZWN0aW9uKCAkbmF0aXZlICkge1xuXHRcdHZhciBzZWxlY3Rpb24gPSBnZXRfdGltZV9zZWxlY3Rpb24oICRuYXRpdmUgKTtcblx0XHR2YXIgc3RhdGUgPSBnZXRfdGltZV92YWxpZGF0aW9uX3N0YXRlKCAkbmF0aXZlICk7XG5cdFx0aWYgKCAhIHNlbGVjdGlvbi5jb21wbGV0ZSApIHtcblx0XHRcdGlmICggc3RhdGUucmVxdWVzdCAmJiA0ICE9PSBzdGF0ZS5yZXF1ZXN0LnJlYWR5U3RhdGUgKSB7XG5cdFx0XHRcdHN0YXRlLnJlcXVlc3QuYWJvcnQoKTtcblx0XHRcdH1cblx0XHRcdHN0YXRlLnNpZ25hdHVyZSA9IHNlbGVjdGlvbi5zaWduYXR1cmU7XG5cdFx0XHRzdGF0ZS5zdGF0dXMgPSAnaW5jb21wbGV0ZSc7XG5cdFx0XHRzdGF0ZS5wcm9taXNlID0gbnVsbDtcblx0XHRcdGNsZWFyX3RpbWVfbm90aWNlKCAkbmF0aXZlICk7XG5cdFx0XHRyZXR1cm4gJC5EZWZlcnJlZCgpLnJlc29sdmUoIGZhbHNlLCAnaW5jb21wbGV0ZScgKS5wcm9taXNlKCk7XG5cdFx0fVxuXHRcdGlmICggc2VsZWN0aW9uLnNpZ25hdHVyZSA9PT0gc3RhdGUuc2lnbmF0dXJlICYmICd2YWxpZCcgPT09IHN0YXRlLnN0YXR1cyApIHtcblx0XHRcdHJldHVybiAkLkRlZmVycmVkKCkucmVzb2x2ZSggdHJ1ZSwgJ3ZhbGlkJyApLnByb21pc2UoKTtcblx0XHR9XG5cdFx0aWYgKCBzZWxlY3Rpb24uc2lnbmF0dXJlID09PSBzdGF0ZS5zaWduYXR1cmUgJiYgJ2ludmFsaWQnID09PSBzdGF0ZS5zdGF0dXMgKSB7XG5cdFx0XHRyZXR1cm4gJC5EZWZlcnJlZCgpLnJlc29sdmUoIGZhbHNlLCAnaW52YWxpZCcgKS5wcm9taXNlKCk7XG5cdFx0fVxuXHRcdGlmICggc2VsZWN0aW9uLnNpZ25hdHVyZSA9PT0gc3RhdGUuc2lnbmF0dXJlICYmICdwZW5kaW5nJyA9PT0gc3RhdGUuc3RhdHVzICYmIHN0YXRlLnByb21pc2UgKSB7XG5cdFx0XHRyZXR1cm4gc3RhdGUucHJvbWlzZTtcblx0XHR9XG5cdFx0aWYgKCBzdGF0ZS5yZXF1ZXN0ICYmIDQgIT09IHN0YXRlLnJlcXVlc3QucmVhZHlTdGF0ZSApIHtcblx0XHRcdHN0YXRlLnJlcXVlc3QuYWJvcnQoKTtcblx0XHR9XG5cblx0XHR2YXIgZGVmZXJyZWQgPSAkLkRlZmVycmVkKCk7XG5cdFx0dmFyIHNlcXVlbmNlID0gKytzdGF0ZS5zZXF1ZW5jZTtcblx0XHRzdGF0ZS5zaWduYXR1cmUgPSBzZWxlY3Rpb24uc2lnbmF0dXJlO1xuXHRcdHN0YXRlLnN0YXR1cyA9ICdwZW5kaW5nJztcblx0XHRzdGF0ZS5wcm9taXNlID0gZGVmZXJyZWQucHJvbWlzZSgpO1xuXHRcdGNsZWFyX3RpbWVfbm90aWNlKCAkbmF0aXZlICk7XG5cdFx0c3RhdGUucmVxdWVzdCA9ICQucG9zdCggY29uZmlnLmFqYXhfdXJsLCB7XG5cdFx0XHRhY3Rpb246IGNvbmZpZy52YWxpZGF0ZV9hY3Rpb24sXG5cdFx0XHRub25jZTogY29uZmlnLm5vbmNlLFxuXHRcdFx0c2VydmljZV9pZDogTnVtYmVyKCAkbmF0aXZlLmRhdGEoICdzZXJ2aWNlLWlkJyApIHx8IDAgKSxcblx0XHRcdHByb3ZpZGVyX2lkOiBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3Byb3ZpZGVyLWlkJyApIHx8IDAgKSxcblx0XHRcdGNvbnRleHRfdG9rZW46IFN0cmluZyggJG5hdGl2ZS5hdHRyKCAnZGF0YS1hcHBvaW50bWVudC1jb250ZXh0LXRva2VuJyApIHx8ICcnICksXG5cdFx0XHRkYXRlczogc2VsZWN0aW9uLmRhdGVzLFxuXHRcdFx0c3RhcnRfdGltZTogc2VsZWN0aW9uLnN0YXJ0X3RpbWVcblx0XHR9ICk7XG5cdFx0c3RhdGUucmVxdWVzdC5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0aWYgKCBzZXF1ZW5jZSAhPT0gc3RhdGUuc2VxdWVuY2UgfHwgc2VsZWN0aW9uLnNpZ25hdHVyZSAhPT0gZ2V0X3RpbWVfc2VsZWN0aW9uKCAkbmF0aXZlICkuc2lnbmF0dXJlICkge1xuXHRcdFx0XHRkZWZlcnJlZC5yZWplY3QoICdzdGFsZScgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dmFyIGRhdGEgPSByZXNwb25zZSAmJiByZXNwb25zZS5kYXRhID8gcmVzcG9uc2UuZGF0YSA6IHt9O1xuXHRcdFx0aWYgKCByZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzICYmIHRydWUgPT09IGRhdGEudmFsaWQgKSB7XG5cdFx0XHRcdHN0YXRlLnN0YXR1cyA9ICd2YWxpZCc7XG5cdFx0XHRcdGNsZWFyX3RpbWVfbm90aWNlKCAkbmF0aXZlICk7XG5cdFx0XHRcdGRlZmVycmVkLnJlc29sdmUoIHRydWUsICd2YWxpZCcgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0c3RhdGUuc3RhdHVzID0gJ2ludmFsaWQnO1xuXHRcdFx0c2hvd190aW1lX25vdGljZSggJG5hdGl2ZSwgc2VsZWN0aW9uLCBkYXRhLm1lc3NhZ2UgfHwgY29uZmlnLnZhbGlkYXRpb25fZXJyb3IgKTtcblx0XHRcdGRlZmVycmVkLnJlc29sdmUoIGZhbHNlLCAnaW52YWxpZCcgKTtcblx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCB4aHIsIHN0YXR1cyApIHtcblx0XHRcdGlmICggJ2Fib3J0JyA9PT0gc3RhdHVzIHx8IHNlcXVlbmNlICE9PSBzdGF0ZS5zZXF1ZW5jZSApIHtcblx0XHRcdFx0ZGVmZXJyZWQucmVqZWN0KCAnc3RhbGUnICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHZhciByZXNwb25zZSA9IHhoci5yZXNwb25zZUpTT047XG5cdFx0XHR2YXIgbWVzc2FnZSA9IHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5tZXNzYWdlID8gcmVzcG9uc2UuZGF0YS5tZXNzYWdlIDogY29uZmlnLnZhbGlkYXRpb25fZXJyb3I7XG5cdFx0XHRzdGF0ZS5zdGF0dXMgPSAnaW52YWxpZCc7XG5cdFx0XHRzaG93X3RpbWVfbm90aWNlKCAkbmF0aXZlLCBzZWxlY3Rpb24sIG1lc3NhZ2UgKTtcblx0XHRcdGRlZmVycmVkLnJlc29sdmUoIGZhbHNlLCAnaW52YWxpZCcgKTtcblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gc3RhdGUucHJvbWlzZTtcblx0fVxuXG5cdC8qKiBEZWJvdW5jZSB2YWxpZGF0aW9uIGFmdGVyIGNhbGVuZGFyIG9yIFN0YXJ0IFRpbWUgY2hhbmdlcy4gKi9cblx0ZnVuY3Rpb24gc2NoZWR1bGVfdGltZV92YWxpZGF0aW9uKCAkbmF0aXZlICkge1xuXHRcdHZhciBzdGF0ZSA9IGdldF90aW1lX3ZhbGlkYXRpb25fc3RhdGUoICRuYXRpdmUgKTtcblx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCBzdGF0ZS50aW1lciApO1xuXHRcdHN0YXRlLnN0YXR1cyA9ICdjaGFuZ2VkJztcblx0XHRjbGVhcl90aW1lX25vdGljZSggJG5hdGl2ZSApO1xuXHRcdGlmICggISBpc190aW1lX3NlbGVjdGlvbl9zdGFnZV9hY3RpdmUoIGdldF90aW1lX3NlbGVjdGlvbiggJG5hdGl2ZSApICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHN0YXRlLnRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhbGlkYXRlX3RpbWVfc2VsZWN0aW9uKCAkbmF0aXZlICk7XG5cdFx0fSwgMTIwICk7XG5cdH1cblxuXHQvKiogQmxvY2sgZm9yd2FyZCB3aXphcmQgbmF2aWdhdGlvbiB1bnRpbCB0aGUgY3VycmVudCB0aW1lIHByZWZsaWdodCBwYXNzZXMuICovXG5cdGZ1bmN0aW9uIGNhcHR1cmVfd2l6YXJkX25hdmlnYXRpb24oIGV2ZW50LCAkbmF0aXZlICkge1xuXHRcdHZhciAkYnV0dG9uID0gJCggZXZlbnQudGFyZ2V0ICkuY2xvc2VzdCggJy53cGJjX3dpemFyZF9zdGVwX2J1dHRvbicgKTtcblx0XHRpZiAoICEgJGJ1dHRvbi5sZW5ndGggfHwgISAkLmNvbnRhaW5zKCAkbmF0aXZlLmdldCggMCApLCAkYnV0dG9uLmdldCggMCApICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICggJGJ1dHRvbi5nZXQoIDAgKS53cGJjX2FwcG9pbnRtZW50X3ByZWZsaWdodF9ieXBhc3MgKSB7XG5cdFx0XHQkYnV0dG9uLmdldCggMCApLndwYmNfYXBwb2ludG1lbnRfcHJlZmxpZ2h0X2J5cGFzcyA9IGZhbHNlO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHZhciB0YXJnZXRfbWF0Y2ggPSBTdHJpbmcoICRidXR0b24uYXR0ciggJ2NsYXNzJyApIHx8ICcnICkubWF0Y2goIC93cGJjX3dpemFyZF9zdGVwXyhcXGQrKS8gKTtcblx0XHR2YXIgY3VycmVudF9tYXRjaCA9IFN0cmluZyggJGJ1dHRvbi5jbG9zZXN0KCAnLndwYmNfd2l6YXJkX3N0ZXAnICkuYXR0ciggJ2NsYXNzJyApIHx8ICcnICkubWF0Y2goIC93cGJjX3dpemFyZF9zdGVwKFxcZCspLyApO1xuXHRcdGlmICggISB0YXJnZXRfbWF0Y2ggfHwgKCBjdXJyZW50X21hdGNoICYmIE51bWJlciggdGFyZ2V0X21hdGNoWzFdICkgPD0gTnVtYmVyKCBjdXJyZW50X21hdGNoWzFdICkgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR2YXIgc2VsZWN0aW9uID0gZ2V0X3RpbWVfc2VsZWN0aW9uKCAkbmF0aXZlICk7XG5cdFx0dmFyICRjdXJyZW50X3N0ZXAgPSAkYnV0dG9uLmNsb3Nlc3QoICcud3BiY193aXphcmRfc3RlcCcgKTtcblx0XHR2YXIgJHRpbWVfc3RlcCA9IHNlbGVjdGlvbi4kc3RhcnQuY2xvc2VzdCggJy53cGJjX3dpemFyZF9zdGVwJyApO1xuXHRcdGlmICggJHRpbWVfc3RlcC5sZW5ndGggJiYgJGN1cnJlbnRfc3RlcC5sZW5ndGggJiYgJHRpbWVfc3RlcC5nZXQoIDAgKSAhPT0gJGN1cnJlbnRfc3RlcC5nZXQoIDAgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCAhIHNlbGVjdGlvbi5jb21wbGV0ZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dmFyIHN0YXRlID0gZ2V0X3RpbWVfdmFsaWRhdGlvbl9zdGF0ZSggJG5hdGl2ZSApO1xuXHRcdGlmICggc2VsZWN0aW9uLnNpZ25hdHVyZSA9PT0gc3RhdGUuc2lnbmF0dXJlICYmICd2YWxpZCcgPT09IHN0YXRlLnN0YXR1cyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdHZhbGlkYXRlX3RpbWVfc2VsZWN0aW9uKCAkbmF0aXZlICkuZG9uZSggZnVuY3Rpb24gKCB2YWxpZCApIHtcblx0XHRcdGlmICggdmFsaWQgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNvbnRhaW5zKCAkYnV0dG9uLmdldCggMCApICkgKSB7XG5cdFx0XHRcdCRidXR0b24uZ2V0KCAwICkud3BiY19hcHBvaW50bWVudF9wcmVmbGlnaHRfYnlwYXNzID0gdHJ1ZTtcblx0XHRcdFx0JGJ1dHRvbi5nZXQoIDAgKS5jbGljaygpO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0fVxuXG5cdC8qKiBBdHRhY2ggaXNvbGF0ZWQgYnVmZmVyIHByZWZsaWdodCBiZWhhdmlvciB0byBvbmUgbmF0aXZlIEFwcG9pbnRtZW50IGZvcm0uICovXG5cdGZ1bmN0aW9uIGluaXRpYWxpemVfdGltZV9wcmVmbGlnaHQoICRuYXRpdmUgKSB7XG5cdFx0aWYgKCAhIGNvbmZpZy5hamF4X3VybCB8fCAhIGNvbmZpZy52YWxpZGF0ZV9hY3Rpb24gfHwgISAkbmF0aXZlLmxlbmd0aCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dmFyIG5hdGl2ZV9lbGVtZW50ID0gJG5hdGl2ZS5nZXQoIDAgKTtcblx0XHRpZiAoIG5hdGl2ZV9lbGVtZW50LndwYmNfYXBwb2ludG1lbnRfdGltZV9wcmVmbGlnaHRfcmVhZHkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdG5hdGl2ZV9lbGVtZW50LndwYmNfYXBwb2ludG1lbnRfdGltZV9wcmVmbGlnaHRfcmVhZHkgPSB0cnVlO1xuXHRcdG5hdGl2ZV9lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHRjYXB0dXJlX3dpemFyZF9uYXZpZ2F0aW9uKCBldmVudCwgJG5hdGl2ZSApO1xuXHRcdH0sIHRydWUgKTtcblx0XHQkbmF0aXZlLm9uKCAnY2hhbmdlLndwYmNfYXBwb2ludG1lbnRfdGltZV9wcmVmbGlnaHQnLCAnW25hbWVePVwic3RhcnR0aW1lXCJdJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0c2NoZWR1bGVfdGltZV92YWxpZGF0aW9uKCAkbmF0aXZlICk7XG5cdFx0fSApO1xuXHRcdCRuYXRpdmUub24oICdkYXRlX3NlbGVjdGVkLndwYmNfYXBwb2ludG1lbnRfdGltZV9wcmVmbGlnaHQgd3BiY19ob29rX3RpbWVzbG90c19kaXNhYmxlZC53cGJjX2FwcG9pbnRtZW50X3RpbWVfcHJlZmxpZ2h0JywgZnVuY3Rpb24gKCBldmVudCwgcHJvdmlkZXJfaWQgKSB7XG5cdFx0XHRpZiAoIE51bWJlciggcHJvdmlkZXJfaWQgfHwgMCApID09PSBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3Byb3ZpZGVyLWlkJyApIHx8IDAgKSApIHtcblx0XHRcdFx0c2NoZWR1bGVfYXZhaWxhYmxlX3N0YXJ0X3RpbWVzKCAkbmF0aXZlICk7XG5cdFx0XHRcdHNjaGVkdWxlX3RpbWVfdmFsaWRhdGlvbiggJG5hdGl2ZSApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHRzY2hlZHVsZV9hdmFpbGFibGVfc3RhcnRfdGltZXMoICRuYXRpdmUgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBMb2NrIGEgbmF0aXZlIGR1cmF0aW9uIGZpZWxkIHRvIHRoZSBzZWxlY3RlZCBTZXJ2aWNlIGR1cmF0aW9uLlxuXHQgKlxuXHQgKiBUaGUgY29yZSBzYXZlIGhhbmRsZXIgaW5kZXBlbmRlbnRseSBkZXJpdmVzIGR1cmF0aW9uIGZyb20gdGhlIFNlcnZpY2Ugcm93O1xuXHQgKiB0aGlzIGNsaWVudCBzdGVwIG9ubHkga2VlcHMgdGhlIHZpc2libGUgZm9ybSBhbmQgc2VyaWFsaXplZCBkYXRhIGFsaWduZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBwcmVwYXJlX25hdGl2ZV9mb3JtKCAkc2NvcGUgKSB7XG5cdFx0dmFyICRuYXRpdmUgPSAkc2NvcGUuZmluZCggJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX25hdGl2ZV9mb3JtJyApLmZpcnN0KCk7XG5cdFx0aWYgKCAhICRuYXRpdmUubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmICggISByZWdpc3Rlcl9uYXRpdmVfZm9ybSggJG5hdGl2ZSApICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHZhciByZXNvdXJjZV9pZCA9IE51bWJlciggJG5hdGl2ZS5kYXRhKCAncHJvdmlkZXItaWQnICkgfHwgMCApO1xuXHRcdHZhciBkdXJhdGlvbiA9IFN0cmluZyggJG5hdGl2ZS5kYXRhKCAnZHVyYXRpb24nICkgfHwgJycgKTtcblx0XHR2YXIgZmllbGRfbmFtZSA9ICdkdXJhdGlvbnRpbWUnICsgcmVzb3VyY2VfaWQ7XG5cdFx0dmFyICRmb3JtID0gJG5hdGl2ZS5maW5kKCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApO1xuXHRcdCRmb3JtLmZpbmQoICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19kdXJhdGlvbl9wcm94eScgKS5yZW1vdmUoKTtcblx0XHR2YXIgJGR1cmF0aW9uX2ZpZWxkcyA9ICRmb3JtLmZpbmQoICdbbmFtZT1cIicgKyBmaWVsZF9uYW1lICsgJ1wiXSwgW25hbWU9XCInICsgZmllbGRfbmFtZSArICdbXVwiXScgKTtcblx0XHR2YXIgJGRlcml2ZWRfdGltZV9maWVsZHMgPSAkZm9ybS5maW5kKCAnW25hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXSwgW25hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1tdXCJdLCBbbmFtZT1cInJhbmdldGltZScgKyByZXNvdXJjZV9pZCArICdcIl0sIFtuYW1lPVwicmFuZ2V0aW1lJyArIHJlc291cmNlX2lkICsgJ1tdXCJdJyApO1xuXG5cdFx0JGR1cmF0aW9uX2ZpZWxkcy5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgJGZpZWxkID0gJCggdGhpcyApO1xuXHRcdFx0aWYgKCAkZmllbGQuaXMoICdzZWxlY3QnICkgJiYgISAkZmllbGQuZmluZCggJ29wdGlvblt2YWx1ZT1cIicgKyBkdXJhdGlvbi5yZXBsYWNlKCAvXCIvZywgJ1xcXFxcIicgKSArICdcIl0nICkubGVuZ3RoICkge1xuXHRcdFx0XHQkZmllbGQuYXBwZW5kKCAkKCAnPG9wdGlvbj4nLCB7IHZhbHVlOiBkdXJhdGlvbiwgdGV4dDogZHVyYXRpb24gfSApICk7XG5cdFx0XHR9XG5cdFx0XHQkZmllbGQudmFsKCBkdXJhdGlvbiApLnByb3AoICdkaXNhYmxlZCcsIHRydWUgKS5hdHRyKCAnYXJpYS1kaXNhYmxlZCcsICd0cnVlJyApO1xuXHRcdFx0JGZpZWxkLmNsb3Nlc3QoICcud3BkZXYtZm9ybS1jb250cm9sLXdyYXAnICkuYWRkQ2xhc3MoICd3cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX2ZpeGVkX2R1cmF0aW9uX2ZpZWxkJyApO1xuXHRcdH0gKTtcblx0XHQkZGVyaXZlZF90aW1lX2ZpZWxkcy5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgJGZpZWxkID0gJCggdGhpcyApO1xuXHRcdFx0JGZpZWxkLnByb3AoICdkaXNhYmxlZCcsIHRydWUgKS5hdHRyKCAnYXJpYS1kaXNhYmxlZCcsICd0cnVlJyApO1xuXHRcdFx0JGZpZWxkLmNsb3Nlc3QoICcud3BkZXYtZm9ybS1jb250cm9sLXdyYXAnICkuYWRkQ2xhc3MoICd3cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX2ZpeGVkX2R1cmF0aW9uX2ZpZWxkJyApO1xuXHRcdH0gKTtcblxuXHRcdGlmICggISAkZHVyYXRpb25fZmllbGRzLmxlbmd0aCApIHtcblx0XHRcdHZhciAkZHVyYXRpb25fcHJveHkgPSAkKCAnPHNlbGVjdD4nLCB7XG5cdFx0XHRcdG5hbWU6IGZpZWxkX25hbWUsXG5cdFx0XHRcdCdjbGFzcyc6ICd3cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX2R1cmF0aW9uX3ZhbHVlJyxcblx0XHRcdFx0J2FyaWEtaGlkZGVuJzogJ3RydWUnLFxuXHRcdFx0XHR0YWJpbmRleDogJy0xJyxcblx0XHRcdFx0J2RhdGEtd3BiYy1hcHBvaW50bWVudC1nZW5lcmF0ZWQnOiAnMSdcblx0XHRcdH0gKS5hcHBlbmQoICQoICc8b3B0aW9uPicsIHsgdmFsdWU6IGR1cmF0aW9uLCB0ZXh0OiBkdXJhdGlvbiwgc2VsZWN0ZWQ6IHRydWUgfSApICk7XG5cdFx0XHQkZm9ybS5hcHBlbmQoXG5cdFx0XHRcdCQoICc8c3Bhbj4nLCB7XG5cdFx0XHRcdFx0J2NsYXNzJzogJ3dwZGV2LWZvcm0tY29udHJvbC13cmFwIHdwYmNfYm9va2luZ19hcHBvaW50bWVudF9fZml4ZWRfZHVyYXRpb25fZmllbGQgd3BiY19ib29raW5nX2FwcG9pbnRtZW50X19kdXJhdGlvbl9wcm94eScsXG5cdFx0XHRcdFx0J2FyaWEtaGlkZGVuJzogJ3RydWUnXG5cdFx0XHRcdH0gKS5hcHBlbmQoICRkdXJhdGlvbl9wcm94eSApXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdGluaXRpYWxpemVfdGltZV9wcmVmbGlnaHQoICRuYXRpdmUgKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqIENvbnZlcnQgYSBzY3JpcHQgVVJMIHRvIHRoZSBzYW1lIGFic29sdXRlIHJlcHJlc2VudGF0aW9uIGFzIERPTSBzY3JpcHQuc3JjLiAqL1xuXHRmdW5jdGlvbiBnZXRfYWJzb2x1dGVfc2NyaXB0X3VybCggdXJsICkge1xuXHRcdHZhciBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnYScgKTtcblx0XHRhbmNob3IuaHJlZiA9IFN0cmluZyggdXJsIHx8ICcnICk7XG5cdFx0cmV0dXJuIGFuY2hvci5ocmVmO1xuXHR9XG5cblx0LyoqIEV4ZWN1dGUgcmVuZGVyZXIgc2NyaXB0cyBzZXF1ZW50aWFsbHkgd2hpbGUgdGhlIHJlcXVlc3Qgc3RpbGwgb3ducyB0aGUgc3RhZ2UuICovXG5cdGZ1bmN0aW9uIGV4ZWN1dGVfc2NyaXB0cyggc2NyaXB0cywgb3duc19zdGFnZSApIHtcblx0XHR2YXIgc2VxdWVuY2UgPSAkLkRlZmVycmVkKCkucmVzb2x2ZSgpLnByb21pc2UoKTtcblxuXHRcdCQuZWFjaCggc2NyaXB0cywgZnVuY3Rpb24gKCBpbmRleCwgc2NyaXB0ICkge1xuXHRcdFx0c2VxdWVuY2UgPSBzZXF1ZW5jZS50aGVuKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmICggISBvd25zX3N0YWdlKCkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHJlamVjdGVkX3N0YWdlKCAnJyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggc2NyaXB0LnNyYyApIHtcblx0XHRcdFx0XHR2YXIgYWJzb2x1dGVfdXJsID0gZ2V0X2Fic29sdXRlX3NjcmlwdF91cmwoIHNjcmlwdC5zcmMgKTtcblx0XHRcdFx0XHRpZiAoIGxvYWRlZF9zY3JpcHRfdXJsc1sgYWJzb2x1dGVfdXJsIF0gKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gJC5hamF4KCB7IHVybDogYWJzb2x1dGVfdXJsLCBkYXRhVHlwZTogJ3NjcmlwdCcsIGNhY2hlOiB0cnVlIH0gKS50aGVuKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRsb2FkZWRfc2NyaXB0X3VybHNbIGFic29sdXRlX3VybCBdID0gdHJ1ZTtcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBzY3JpcHQuY29kZSApIHtcblx0XHRcdFx0XHQkLmdsb2JhbEV2YWwoIHNjcmlwdC5jb2RlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH0gKTtcblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gc2VxdWVuY2U7XG5cdH1cblxuXHQvKiogSW5pdGlhbGl6ZSBjb250cm9scyB3aG9zZSBjb3JlIGhhbmRsZXJzIG5vcm1hbGx5IGJpbmQgb24gZG9jdW1lbnQgcmVhZHkuICovXG5cdGZ1bmN0aW9uIGluaXRpYWxpemVfYWpheF9mb3JtX2NvbnRyb2xzKCkge1xuXHRcdGlmICggdHlwZW9mIHdpbmRvdy53cGJjX2hvb2tfX2luaXRfYm9va2luZ19mb3JtX3dpemFyZF9idXR0b25zID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0d2luZG93LndwYmNfaG9va19faW5pdF9ib29raW5nX2Zvcm1fd2l6YXJkX2J1dHRvbnMoKTtcblx0XHR9XG5cdH1cblxuXHQvKiogRGVzdHJveSBuYXRpdmUgY2FsZW5kYXIgaW5zdGFuY2VzIGFuZCB1bnJlZ2lzdGVyIGNvbnRleHQgYmVmb3JlIHJlbW92YWwuICovXG5cdGZ1bmN0aW9uIGNsZWFudXBfbmF0aXZlX2Zvcm0oICRyb290ICkge1xuXHRcdCRyb290LmZpbmQoICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19uYXRpdmVfZm9ybScgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgJG5hdGl2ZSA9ICQoIHRoaXMgKTtcblx0XHRcdHZhciByZXNvdXJjZV9pZCA9IE51bWJlciggJG5hdGl2ZS5kYXRhKCAncHJvdmlkZXItaWQnICkgfHwgMCApO1xuXHRcdFx0dmFyICRjYWxlbmRhciA9ICRuYXRpdmUuZmluZCggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICk7XG5cblx0XHRcdHVucmVnaXN0ZXJfbmF0aXZlX2Zvcm0oICRuYXRpdmUgKTtcblx0XHRcdGlmICggISByZXNvdXJjZV9pZCB8fCAhICRjYWxlbmRhci5sZW5ndGggfHwgISAkLmRhdGVwaWNrIHx8IHR5cGVvZiAkY2FsZW5kYXIuZGF0ZXBpY2sgIT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dmFyIGluc3RhbmNlID0gdHlwZW9mICQuZGF0ZXBpY2suX2dldEluc3QgPT09ICdmdW5jdGlvbicgPyAkLmRhdGVwaWNrLl9nZXRJbnN0KCAkY2FsZW5kYXIuZ2V0KCAwICkgKSA6IG51bGw7XG5cdFx0XHRcdGlmICggaW5zdGFuY2UgKSB7XG5cdFx0XHRcdFx0JGNhbGVuZGFyLmRhdGVwaWNrKCAnZGVzdHJveScgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoIGVycm9yICkge1xuXHRcdFx0XHQkY2FsZW5kYXIucmVtb3ZlQ2xhc3MoICdoYXNEYXRlcGljaycgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdH1cblxuXHQvKiogUmVzdG9yZSB0aGUgcHJldmlvdXNseSBzZWxlY3RlZCBTZXJ2aWNlIHdoZW4gbmF2aWdhdGluZyBiYWNrIG9uZSBzdGFnZS4gKi9cblx0ZnVuY3Rpb24gcmVzdG9yZV9zZXJ2aWNlX3NlbGVjdGlvbiggJHJvb3QgKSB7XG5cdFx0dmFyIHNlcnZpY2VfaWQgPSBOdW1iZXIoICRyb290LmF0dHIoICdkYXRhLXNlbGVjdGVkLXNlcnZpY2UtaWQnICkgfHwgMCApO1xuXHRcdGlmICggISBzZXJ2aWNlX2lkICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR2YXIgJGlucHV0ID0gJHJvb3QuZmluZCggJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX3NlbGVjdGlvbl9mb3JtIFtuYW1lPVwid3BiY19hcHBvaW50bWVudF9zZXJ2aWNlXCJdW3ZhbHVlPVwiJyArIHNlcnZpY2VfaWQgKyAnXCJdJyApLmZpcnN0KCk7XG5cdFx0aWYgKCAkaW5wdXQubGVuZ3RoICkge1xuXHRcdFx0JGlucHV0LnByb3AoICdjaGVja2VkJywgdHJ1ZSApLmNsb3Nlc3QoICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19jaG9pY2UnICkuYWRkQ2xhc3MoICdpcy1zZWxlY3RlZCcgKTtcblx0XHR9XG5cdH1cblxuXHQvKiogRm9jdXMgdGhlIG5ldyBzdGFnZSBoZWFkaW5nIHdpdGhvdXQgZm9yY2luZyBtb3Rpb24gZm9yIHJlZHVjZWQtbW90aW9uIHVzZXJzLiAqL1xuXHRmdW5jdGlvbiBmb2N1c19zdGFnZSggJHJvb3QgKSB7XG5cdFx0dmFyICR0YXJnZXQgPSAkcm9vdC5maW5kKCAnPiAud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19zdGFnZSAud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19oZWFkaW5nIGgzLCA+IC53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX3N0YWdlIC53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX25vdGljZScgKS5maXJzdCgpO1xuXHRcdGlmICggJHRhcmdldC5sZW5ndGggKSB7XG5cdFx0XHQkdGFyZ2V0LmF0dHIoICd0YWJpbmRleCcsICctMScgKTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdCR0YXJnZXQuZ2V0KCAwICkuZm9jdXMoIHsgcHJldmVudFNjcm9sbDogdHJ1ZSB9ICk7XG5cdFx0XHR9IGNhdGNoICggZXJyb3IgKSB7XG5cdFx0XHRcdCR0YXJnZXQudHJpZ2dlciggJ2ZvY3VzJyApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICggJHJvb3QuZ2V0KCAwICkgJiYgdHlwZW9mICRyb290LmdldCggMCApLnNjcm9sbEludG9WaWV3ID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0dmFyIHJlZHVjZV9tb3Rpb24gPSB3aW5kb3cubWF0Y2hNZWRpYSAmJiB3aW5kb3cubWF0Y2hNZWRpYSggJyhwcmVmZXJzLXJlZHVjZWQtbW90aW9uOiByZWR1Y2UpJyApLm1hdGNoZXM7XG5cdFx0XHQkcm9vdC5nZXQoIDAgKS5zY3JvbGxJbnRvVmlldyggeyBiZWhhdmlvcjogcmVkdWNlX21vdGlvbiA/ICdhdXRvJyA6ICdzbW9vdGgnLCBibG9jazogJ25lYXJlc3QnIH0gKTtcblx0XHR9XG5cdH1cblxuXHQvKiogUmV0dXJuIGEgcmVqZWN0ZWQgcHJvbWlzZSBjYXJyeWluZyBvbmUgY29udHJvbGxlZCBpbml0aWFsaXphdGlvbiBtZXNzYWdlLiAqL1xuXHRmdW5jdGlvbiByZWplY3RlZF9zdGFnZSggbWVzc2FnZSApIHtcblx0XHR2YXIgZGVmZXJyZWQgPSAkLkRlZmVycmVkKCk7XG5cdFx0ZGVmZXJyZWQucmVqZWN0KCB7IHdwYmNfbWVzc2FnZTogbWVzc2FnZSB9ICk7XG5cdFx0cmV0dXJuIGRlZmVycmVkLnByb21pc2UoKTtcblx0fVxuXG5cdC8qKiBSZXBsYWNlIGEgc3RhZ2Ugd2hpbGUgZ3VhcmFudGVlaW5nIERPTS1iZWZvcmUtc2NyaXB0IGluaXRpYWxpemF0aW9uIG9yZGVyLiAqL1xuXHRmdW5jdGlvbiByZXBsYWNlX3N0YWdlKCAkcm9vdCwgaHRtbCwgc3RhZ2UsIHByb3ZpZGVyX2lkLCByZXF1ZXN0X2lkICkge1xuXHRcdGlmICggISBpc19jdXJyZW50X3JlcXVlc3QoICRyb290LCByZXF1ZXN0X2lkICkgKSB7XG5cdFx0XHRyZXR1cm4gcmVqZWN0ZWRfc3RhZ2UoICcnICk7XG5cdFx0fVxuXHRcdGlmICggJ2Jvb2tpbmcnID09PSBzdGFnZSAmJiBoYXNfZHVwbGljYXRlX3Byb3ZpZGVyX2Zvcm0oICRyb290LCBwcm92aWRlcl9pZCApICkge1xuXHRcdFx0cmV0dXJuIHJlamVjdGVkX3N0YWdlKCBjb25maWcuZHVwbGljYXRlX3Byb3ZpZGVyICk7XG5cdFx0fVxuXG5cdFx0dmFyIHBhcnNlZCA9ICQucGFyc2VIVE1MKCBTdHJpbmcoIGh0bWwgfHwgJycgKSwgZG9jdW1lbnQsIHRydWUgKSB8fCBbXTtcblx0XHR2YXIgc2NyaXB0cyA9IFtdO1xuXHRcdHZhciAkY29udGFpbmVyID0gJCggJzxkaXY+JyApLmFwcGVuZCggcGFyc2VkICk7XG5cblx0XHQkY29udGFpbmVyLmZpbmQoICdzY3JpcHQnICkuYWRkQmFjayggJ3NjcmlwdCcgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRzY3JpcHRzLnB1c2goIHsgc3JjOiB0aGlzLnNyYyB8fCAnJywgY29kZTogdGhpcy5zcmMgPyAnJyA6ICggdGhpcy50ZXh0IHx8IHRoaXMudGV4dENvbnRlbnQgfHwgJycgKSB9ICk7XG5cdFx0XHQkKCB0aGlzICkucmVtb3ZlKCk7XG5cdFx0fSApO1xuXG5cdFx0Y2xlYW51cF9uYXRpdmVfZm9ybSggJHJvb3QgKTtcblx0XHQkcm9vdC5hdHRyKCAnZGF0YS1hcHBvaW50bWVudC1zdGFnZScsIHN0YWdlICk7XG5cdFx0JHJvb3QuZmluZCggJz4gLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fc3RhZ2UnICkuZW1wdHkoKS5hcHBlbmQoICRjb250YWluZXIuY29udGVudHMoKSApO1xuXG5cdFx0aWYgKCAhIHByZXBhcmVfbmF0aXZlX2Zvcm0oICRyb290ICkgKSB7XG5cdFx0XHRjbGVhbnVwX25hdGl2ZV9mb3JtKCAkcm9vdCApO1xuXHRcdFx0JHJvb3QuZmluZCggJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX25hdGl2ZV9mb3JtIDppbnB1dCcgKS5wcm9wKCAnZGlzYWJsZWQnLCB0cnVlICk7XG5cdFx0XHRyZXR1cm4gcmVqZWN0ZWRfc3RhZ2UoIGNvbmZpZy5pbml0aWFsaXphdGlvbl9lcnJvciB8fCBjb25maWcuZXJyb3IgKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZXhlY3V0ZV9zY3JpcHRzKCBzY3JpcHRzLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRyZXR1cm4gaXNfY3VycmVudF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApO1xuXHRcdH0gKS50aGVuKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAoICEgaXNfY3VycmVudF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApICkge1xuXHRcdFx0XHRyZXR1cm4gcmVqZWN0ZWRfc3RhZ2UoICcnICk7XG5cdFx0XHR9XG5cdFx0XHRpbml0aWFsaXplX2FqYXhfZm9ybV9jb250cm9scygpO1xuXHRcdFx0aWYgKCAnc2VydmljZScgPT09IHN0YWdlICkge1xuXHRcdFx0XHRyZXN0b3JlX3NlcnZpY2Vfc2VsZWN0aW9uKCAkcm9vdCApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0fVxuXG5cdC8qKiBEZXRlcm1pbmUgd2hldGhlciBhbiBBSkFYIGNhbGxiYWNrIHN0aWxsIG93bnMgdGhlIGNvbXBvbmVudCBzdGF0ZS4gKi9cblx0ZnVuY3Rpb24gaXNfY3VycmVudF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApIHtcblx0XHRyZXR1cm4gTnVtYmVyKCAkcm9vdC5kYXRhKCAnd3BiYy1hcHBvaW50bWVudC1yZXF1ZXN0LWlkJyApIHx8IDAgKSA9PT0gTnVtYmVyKCByZXF1ZXN0X2lkICk7XG5cdH1cblxuXHQvKiogRmluaXNoIG9ubHkgdGhlIGN1cnJlbnQgcmVxdWVzdCBzbyBzdGFsZSBjYWxsYmFja3MgY2Fubm90IGFsdGVyIHRoZSBVSS4gKi9cblx0ZnVuY3Rpb24gZmluaXNoX3JlcXVlc3QoICRyb290LCByZXF1ZXN0X2lkICkge1xuXHRcdGlmICggISBpc19jdXJyZW50X3JlcXVlc3QoICRyb290LCByZXF1ZXN0X2lkICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdCRyb290LnJlbW92ZURhdGEoICd3cGJjLWFwcG9pbnRtZW50LXJlcXVlc3QnICk7XG5cdFx0c2V0X2xvYWRpbmcoICRyb290LCBmYWxzZSApO1xuXHR9XG5cblx0LyoqIFJlcXVlc3QgYW5kIHJlbmRlciB0aGUgbmV4dCBBcHBvaW50bWVudCB3b3JrZmxvdyBzdGFnZS4gKi9cblx0ZnVuY3Rpb24gcmVzb2x2ZV9zdGFnZSggJHJvb3QsIHNlcnZpY2VfaWQsIHByb3ZpZGVyX2lkICkge1xuXHRcdGlmICggISAkcm9vdCB8fCAhICRyb290Lmxlbmd0aCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRzZXJ2aWNlX2lkID0gTnVtYmVyKCBzZXJ2aWNlX2lkIHx8IDAgKTtcblx0XHRwcm92aWRlcl9pZCA9IE51bWJlciggcHJvdmlkZXJfaWQgfHwgMCApO1xuXHRcdGlmICggc2VydmljZV9pZCApIHtcblx0XHRcdCRyb290LmF0dHIoICdkYXRhLXNlbGVjdGVkLXNlcnZpY2UtaWQnLCBzZXJ2aWNlX2lkICk7XG5cdFx0fVxuXHRcdGlmICggcHJvdmlkZXJfaWQgKSB7XG5cdFx0XHQkcm9vdC5hdHRyKCAnZGF0YS1zZWxlY3RlZC1wcm92aWRlci1pZCcsIHByb3ZpZGVyX2lkICk7XG5cdFx0fVxuXG5cdFx0dmFyIHByZXZpb3VzX3JlcXVlc3QgPSAkcm9vdC5kYXRhKCAnd3BiYy1hcHBvaW50bWVudC1yZXF1ZXN0JyApO1xuXHRcdHZhciByZXF1ZXN0X2lkID0gTnVtYmVyKCAkcm9vdC5kYXRhKCAnd3BiYy1hcHBvaW50bWVudC1yZXF1ZXN0LWlkJyApIHx8IDAgKSArIDE7XG5cdFx0JHJvb3QuZGF0YSggJ3dwYmMtYXBwb2ludG1lbnQtcmVxdWVzdC1pZCcsIHJlcXVlc3RfaWQgKTtcblx0XHRpZiAoIHByZXZpb3VzX3JlcXVlc3QgJiYgcHJldmlvdXNfcmVxdWVzdC5yZWFkeVN0YXRlICE9PSA0ICkge1xuXHRcdFx0cHJldmlvdXNfcmVxdWVzdC5hYm9ydCgpO1xuXHRcdH1cblxuXHRcdGNsZWFyX2Vycm9yKCAkcm9vdCApO1xuXHRcdHNldF9sb2FkaW5nKCAkcm9vdCwgdHJ1ZSApO1xuXHRcdHZhciByZXF1ZXN0ID0gJC5wb3N0KCBjb25maWcuYWpheF91cmwsIHtcblx0XHRcdGFjdGlvbjogY29uZmlnLmFjdGlvbixcblx0XHRcdG5vbmNlOiBjb25maWcubm9uY2UsXG5cdFx0XHRjb25maWdfdG9rZW46ICRyb290LmF0dHIoICdkYXRhLWNvbmZpZy10b2tlbicgKSB8fCAnJyxcblx0XHRcdHNlcnZpY2VfaWQ6IHNlcnZpY2VfaWQsXG5cdFx0XHRwcm92aWRlcl9pZDogcHJvdmlkZXJfaWRcblx0XHR9ICk7XG5cdFx0JHJvb3QuZGF0YSggJ3dwYmMtYXBwb2ludG1lbnQtcmVxdWVzdCcsIHJlcXVlc3QgKTtcblxuXHRcdHJlcXVlc3QuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdGlmICggISBpc19jdXJyZW50X3JlcXVlc3QoICRyb290LCByZXF1ZXN0X2lkICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISByZXNwb25zZSB8fCAhIHJlc3BvbnNlLnN1Y2Nlc3MgfHwgISByZXNwb25zZS5kYXRhICkge1xuXHRcdFx0XHRzaG93X2Vycm9yKFxuXHRcdFx0XHRcdCRyb290LFxuXHRcdFx0XHRcdHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5tZXNzYWdlID8gcmVzcG9uc2UuZGF0YS5tZXNzYWdlIDogY29uZmlnLmVycm9yLFxuXHRcdFx0XHRcdHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgPyByZXNwb25zZS5kYXRhLmFjdGlvbl91cmwgOiAnJyxcblx0XHRcdFx0XHRyZXNwb25zZSAmJiByZXNwb25zZS5kYXRhID8gcmVzcG9uc2UuZGF0YS5hY3Rpb25fbGFiZWwgOiAnJ1xuXHRcdFx0XHQpO1xuXHRcdFx0XHRmaW5pc2hfcmVxdWVzdCggJHJvb3QsIHJlcXVlc3RfaWQgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgc3RhZ2UgPSByZXNwb25zZS5kYXRhLnN0YWdlIHx8ICcnO1xuXHRcdFx0dmFyIHJlcGxhY2VtZW50ID0gcmVwbGFjZV9zdGFnZSggJHJvb3QsIHJlc3BvbnNlLmRhdGEuaHRtbCwgc3RhZ2UsIHJlc3BvbnNlLmRhdGEucHJvdmlkZXJfaWQsIHJlcXVlc3RfaWQgKTtcblx0XHRcdHJlcGxhY2VtZW50LmRvbmUoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKCAhIGlzX2N1cnJlbnRfcmVxdWVzdCggJHJvb3QsIHJlcXVlc3RfaWQgKSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBOdW1iZXIoIHJlc3BvbnNlLmRhdGEuc2VydmljZV9pZCB8fCAwICkgKSB7XG5cdFx0XHRcdFx0JHJvb3QuYXR0ciggJ2RhdGEtc2VsZWN0ZWQtc2VydmljZS1pZCcsIE51bWJlciggcmVzcG9uc2UuZGF0YS5zZXJ2aWNlX2lkICkgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIE51bWJlciggcmVzcG9uc2UuZGF0YS5wcm92aWRlcl9pZCB8fCAwICkgKSB7XG5cdFx0XHRcdFx0JHJvb3QuYXR0ciggJ2RhdGEtc2VsZWN0ZWQtcHJvdmlkZXItaWQnLCBOdW1iZXIoIHJlc3BvbnNlLmRhdGEucHJvdmlkZXJfaWQgKSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZpbmlzaF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApO1xuXHRcdFx0XHRmb2N1c19zdGFnZSggJHJvb3QgKTtcblx0XHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIGVycm9yICkge1xuXHRcdFx0XHRpZiAoICEgaXNfY3VycmVudF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR2YXIgbWVzc2FnZSA9IGVycm9yICYmIGVycm9yLndwYmNfbWVzc2FnZSA/IGVycm9yLndwYmNfbWVzc2FnZSA6ICggY29uZmlnLmluaXRpYWxpemF0aW9uX2Vycm9yIHx8IGNvbmZpZy5lcnJvciApO1xuXHRcdFx0XHRzaG93X2Vycm9yKCAkcm9vdCwgbWVzc2FnZSApO1xuXHRcdFx0XHRmaW5pc2hfcmVxdWVzdCggJHJvb3QsIHJlcXVlc3RfaWQgKTtcblx0XHRcdH0gKTtcblx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCB4aHIsIHN0YXR1cyApIHtcblx0XHRcdGlmICggJ2Fib3J0JyA9PT0gc3RhdHVzIHx8ICEgaXNfY3VycmVudF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR2YXIgcmVzcG9uc2UgPSB4aHIucmVzcG9uc2VKU09OO1xuXHRcdFx0c2hvd19lcnJvcihcblx0XHRcdFx0JHJvb3QsXG5cdFx0XHRcdHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5tZXNzYWdlID8gcmVzcG9uc2UuZGF0YS5tZXNzYWdlIDogY29uZmlnLmVycm9yLFxuXHRcdFx0XHRyZXNwb25zZSAmJiByZXNwb25zZS5kYXRhID8gcmVzcG9uc2UuZGF0YS5hY3Rpb25fdXJsIDogJycsXG5cdFx0XHRcdHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgPyByZXNwb25zZS5kYXRhLmFjdGlvbl9sYWJlbCA6ICcnXG5cdFx0XHQpO1xuXHRcdFx0ZmluaXNoX3JlcXVlc3QoICRyb290LCByZXF1ZXN0X2lkICk7XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqIEhhbmRsZSBTZXJ2aWNlIGFuZCBQcm92aWRlciBmYWxsYmFjayBmb3JtcyB0aHJvdWdoIEFKQVguICovXG5cdCQoIGRvY3VtZW50ICkub24oICdzdWJtaXQnLCAnLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fc2VsZWN0aW9uX2Zvcm0nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdGlmICggISBjb25maWcuYWpheF91cmwgfHwgISBjb25maWcuYWN0aW9uICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdHZhciAkZm9ybSA9ICQoIHRoaXMgKTtcblx0XHR2YXIgJHJvb3QgPSAkZm9ybS5jbG9zZXN0KCAnLndwYmNfYm9va2luZ19hcHBvaW50bWVudCcgKTtcblx0XHRyZXNvbHZlX3N0YWdlKCAkcm9vdCwgZ2V0X3NlbGVjdGVkX2lkKCAkZm9ybSwgJ3dwYmNfYXBwb2ludG1lbnRfc2VydmljZScgKSwgZ2V0X3NlbGVjdGVkX2lkKCAkZm9ybSwgJ3dwYmNfYXBwb2ludG1lbnRfcHJvdmlkZXInICkgKTtcblx0fSApO1xuXG5cdC8qKiBLZWVwIHBsYXRlIHNlbGVjdGlvbiBzdHlsaW5nIGluZGVwZW5kZW50IGZyb20gQ1NTIDpoYXMoKSBzdXBwb3J0LiAqL1xuXHQkKCBkb2N1bWVudCApLm9uKCAnY2hhbmdlJywgJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX2Nob2ljZSA+IGlucHV0JywgZnVuY3Rpb24gKCkge1xuXHRcdHZhciAkaW5wdXQgPSAkKCB0aGlzICk7XG5cdFx0JGlucHV0LmNsb3Nlc3QoICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19jaG9pY2VzJyApLmZpbmQoICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19jaG9pY2UnICkucmVtb3ZlQ2xhc3MoICdpcy1zZWxlY3RlZCcgKTtcblx0XHQkaW5wdXQuY2xvc2VzdCggJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX2Nob2ljZScgKS5hZGRDbGFzcyggJ2lzLXNlbGVjdGVkJyApO1xuXHR9ICk7XG5cblx0LyoqIFJldHVybiB0byBTZXJ2aWNlIHNlbGVjdGlvbiB3aGlsZSBwcmVzZXJ2aW5nIHRoZSBsYXN0IHZhbGlkIFNlcnZpY2UuICovXG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50IFtkYXRhLWFwcG9pbnRtZW50LWJhY2s9XCJzZXJ2aWNlXCJdJywgZnVuY3Rpb24gKCkge1xuXHRcdHZhciAkcm9vdCA9ICQoIHRoaXMgKS5jbG9zZXN0KCAnLndwYmNfYm9va2luZ19hcHBvaW50bWVudCcgKTtcblx0XHRpZiAoICRyb290Lmhhc0NsYXNzKCAnaXMtbG9hZGluZycgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cmVzb2x2ZV9zdGFnZSggJHJvb3QsIDAsIDAgKTtcblx0fSApO1xuXG5cdC8qKiBSZXR1cm4gdG8gdGhlIGZpcnN0IHNlbGVjdGFibGUgQXBwb2ludG1lbnQgc3RhZ2Ugd2l0aG91dCByZWxvYWRpbmcgdGhlIHBhZ2UuICovXG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50IFtkYXRhLXdwYmMtYXBwb2ludG1lbnQtYWN0aW9uPVwic3RhcnQtb3ZlclwiXSwgLndwYmNfYm9va2luZ19hcHBvaW50bWVudCAud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19jaGFuZ2UnLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdGlmICggISBjb25maWcuYWpheF91cmwgfHwgISBjb25maWcuYWN0aW9uICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdHZhciAkcm9vdCA9ICQoIHRoaXMgKS5jbG9zZXN0KCAnLndwYmNfYm9va2luZ19hcHBvaW50bWVudCcgKTtcblx0XHRpZiAoICRyb290Lmhhc0NsYXNzKCAnaXMtbG9hZGluZycgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0JHJvb3QucmVtb3ZlQXR0ciggJ2RhdGEtc2VsZWN0ZWQtc2VydmljZS1pZCBkYXRhLXNlbGVjdGVkLXByb3ZpZGVyLWlkJyApO1xuXHRcdHJlc29sdmVfc3RhZ2UoICRyb290LCAwLCAwICk7XG5cdH0gKTtcblxuXHQvKiogQWRkIHRoZSByZWdpc3RlcmVkIHNpZ25lZCBhbmQgc2VydmVyLWF1dGhvcml6ZWQgY29udGV4dCB0byB0aGUgY29yZSBib29raW5nIHJlcXVlc3QuICovXG5cdCQoICdib2R5JyApLm9uKCAnd3BiY19iZWZvcmVfYm9va2luZ19jcmVhdGUud3BiY19ib29raW5nX2FwcG9pbnRtZW50JywgZnVuY3Rpb24gKCBldmVudCwgcmVzb3VyY2VfaWQsIHBhcmFtcyApIHtcblx0XHR2YXIgY29udGV4dCA9IGdldF9uYXRpdmVfY29udGV4dCggcmVzb3VyY2VfaWQgKTtcblx0XHRpZiAoICEgY29udGV4dCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cGFyYW1zLnNlcnZpY2VfaWQgPSBjb250ZXh0LnNlcnZpY2VfaWQ7XG5cdFx0cGFyYW1zLmFwcG9pbnRtZW50X3NlcnZpY2VfcmVxdWlyZWQgPSAxO1xuXHRcdHBhcmFtcy5hcHBvaW50bWVudF9jb250ZXh0X3Rva2VuID0gY29udGV4dC5jb250ZXh0X3Rva2VuO1xuXHRcdHBhcmFtcy5hbGxvd19wYXN0ID0gY29udGV4dC5hbGxvd19wYXN0O1xuXHR9ICk7XG5cblx0LyoqIEFkZCB0aGUgc2lnbmVkIEFwcG9pbnRtZW50IHBhaXIgdG8gdGhlIGV4aXN0aW5nIGxpdmUtY29zdCByZXF1ZXN0LiAqL1xuXHQkKCBkb2N1bWVudCApLm9uKCAnd3BiY19iZWZvcmVfY29zdF9yZXF1ZXN0LndwYmNfYm9va2luZ19hcHBvaW50bWVudCcsIGZ1bmN0aW9uICggZXZlbnQsIHJlc291cmNlX2lkLCBwYXJhbXMgKSB7XG5cdFx0dmFyIGNvbnRleHQgPSBnZXRfbmF0aXZlX2NvbnRleHQoIHJlc291cmNlX2lkICk7XG5cdFx0aWYgKCAhIGNvbnRleHQgfHwgISBwYXJhbXMgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHBhcmFtcy5hcHBvaW50bWVudF9zZXJ2aWNlX2lkID0gY29udGV4dC5zZXJ2aWNlX2lkO1xuXHRcdHBhcmFtcy5hcHBvaW50bWVudF9jb250ZXh0X3Rva2VuID0gY29udGV4dC5jb250ZXh0X3Rva2VuO1xuXHR9ICk7XG5cblx0JCggZnVuY3Rpb24gKCkge1xuXHRcdCQoICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50JyApLmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciAkcm9vdCA9ICQoIHRoaXMgKTtcblx0XHRcdHZhciAkbmF0aXZlID0gJHJvb3QuZmluZCggJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX25hdGl2ZV9mb3JtJyApLmZpcnN0KCk7XG5cdFx0XHRpZiAoICRuYXRpdmUubGVuZ3RoICkge1xuXHRcdFx0XHQkcm9vdC5hdHRyKCAnZGF0YS1zZWxlY3RlZC1zZXJ2aWNlLWlkJywgTnVtYmVyKCAkbmF0aXZlLmRhdGEoICdzZXJ2aWNlLWlkJyApIHx8IDAgKSApO1xuXHRcdFx0XHQkcm9vdC5hdHRyKCAnZGF0YS1zZWxlY3RlZC1wcm92aWRlci1pZCcsIE51bWJlciggJG5hdGl2ZS5kYXRhKCAncHJvdmlkZXItaWQnICkgfHwgMCApICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgcHJlcGFyZV9uYXRpdmVfZm9ybSggJHJvb3QgKSApIHtcblx0XHRcdFx0dmFyIGR1cGxpY2F0ZSA9ICRuYXRpdmUubGVuZ3RoICYmIGhhc19kdXBsaWNhdGVfcHJvdmlkZXJfZm9ybSggJHJvb3QsIE51bWJlciggJG5hdGl2ZS5kYXRhKCAncHJvdmlkZXItaWQnICkgfHwgMCApICk7XG5cdFx0XHRcdGNsZWFudXBfbmF0aXZlX2Zvcm0oICRyb290ICk7XG5cdFx0XHRcdCRyb290LmZpbmQoICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19uYXRpdmVfZm9ybSA6aW5wdXQnICkucHJvcCggJ2Rpc2FibGVkJywgdHJ1ZSApO1xuXHRcdFx0XHRzaG93X2Vycm9yKCAkcm9vdCwgZHVwbGljYXRlID8gY29uZmlnLmR1cGxpY2F0ZV9wcm92aWRlciA6IGNvbmZpZy5pbml0aWFsaXphdGlvbl9lcnJvciApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0fSApO1xufSApKCB3aW5kb3csIGpRdWVyeSApO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBLENBQUUsVUFBV0EsTUFBTSxFQUFFQyxDQUFDLEVBQUc7RUFDeEIsWUFBWTs7RUFFWixJQUFJQyxNQUFNLEdBQUdGLE1BQU0sQ0FBQ0csK0JBQStCLElBQUksQ0FBQyxDQUFDO0VBQ3pELElBQUlDLHNCQUFzQixHQUFHLENBQUMsQ0FBQztFQUMvQixJQUFJQyxrQkFBa0IsR0FBRyxDQUFDLENBQUM7RUFFM0JKLENBQUMsQ0FBRSxhQUFjLENBQUMsQ0FBQ0ssSUFBSSxDQUFFLFlBQVk7SUFDcENELGtCQUFrQixDQUFFRSxNQUFNLENBQUUsSUFBSSxDQUFDQyxHQUFHLElBQUksRUFBRyxDQUFDLENBQUUsR0FBRyxJQUFJO0VBQ3RELENBQUUsQ0FBQzs7RUFFSDtFQUNBLFNBQVNDLGVBQWVBLENBQUVDLEtBQUssRUFBRUMsSUFBSSxFQUFHO0lBQ3ZDLE9BQU9DLE1BQU0sQ0FBRUYsS0FBSyxDQUFDRyxJQUFJLENBQUUsU0FBUyxHQUFHRixJQUFJLEdBQUcscUJBQXFCLEdBQUdBLElBQUksR0FBRyxtQkFBb0IsQ0FBQyxDQUFDRyxLQUFLLENBQUMsQ0FBQyxDQUFDQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUUsQ0FBQztFQUN4SDs7RUFFQTtFQUNBLFNBQVNDLFdBQVdBLENBQUVDLEtBQUssRUFBRUMsVUFBVSxFQUFHO0lBQ3pDRCxLQUFLLENBQUNFLFdBQVcsQ0FBRSxZQUFZLEVBQUVELFVBQVcsQ0FBQyxDQUFDRSxJQUFJLENBQUUsV0FBVyxFQUFFRixVQUFVLEdBQUcsTUFBTSxHQUFHLE9BQVEsQ0FBQztJQUNoR0QsS0FBSyxDQUFDSixJQUFJLENBQUUsb0NBQXFDLENBQUMsQ0FBQ08sSUFBSSxDQUFFLFdBQVcs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
