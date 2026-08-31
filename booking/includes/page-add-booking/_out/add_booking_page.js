"use strict";

/** Add Booking administrator inspector interactions. */
(function ($) {
  'use strict';

  var active_days_selection_override = '';
  var days_selection_enforcement_timers = [];

  /**
   * Show the panel controlled by one compact right-sidebar tab.
   *
   * @param {jQuery} $tab Selected tab button.
   * @return {void}
   */
  function switch_right_panel($tab) {
    var panel_id = $tab.attr('aria-controls');
    var $tabs = $tab.closest('.wpbc_add_booking__rightbar_tabs').find('[role="tab"]');
    var $panels = $('.wpbc_add_booking__rightbar').find('[role="tabpanel"]');
    if (!panel_id || !$('#' + panel_id).length) {
      return;
    }
    $tabs.attr('aria-selected', 'false');
    $tab.attr('aria-selected', 'true');
    $panels.attr({
      hidden: true,
      'aria-hidden': 'true'
    });
    $('#' + panel_id).removeAttr('hidden').attr('aria-hidden', 'false');
  }

  /**
   * Expand an inspector group and focus one of its controls.
   *
   * The shared collapsible controller is used when available so exclusive
   * groups and ARIA state stay synchronized. The header click is a safe
   * fallback for older Booking Calendar admin bundles.
   *
   * @param {string} group_name Group data key.
   * @param {string} focus_selector Optional control to focus after expansion.
   * @return {void}
   */
  function open_settings_group(group_name, focus_selector) {
    var $group = $('.wpbc_add_booking__inspector_settings .wpbc_ui__collapsible_group[data-group="' + group_name + '"]').first();
    var root;
    var controller;
    if (!$group.length) {
      return;
    }
    root = $group.closest('.wpbc_collapsible').get(0);
    controller = root && root.__wpbc_collapsible_instance ? root.__wpbc_collapsible_instance : null;
    if (controller && 'function' === typeof controller.expand) {
      controller.expand($group.get(0));
    } else {
      $group.siblings('.wpbc_ui__collapsible_group').each(function () {
        var $sibling = $(this);
        $sibling.removeClass('is-open');
        $sibling.children('.group__header').attr('aria-expanded', 'false');
        $sibling.children('.group__fields').attr({
          hidden: true,
          'aria-hidden': 'true'
        });
      });
      $group.addClass('is-open');
      $group.children('.group__header').attr('aria-expanded', 'true');
      $group.children('.group__fields').removeAttr('hidden').attr('aria-hidden', 'false');
    }
    window.requestAnimationFrame(function () {
      $group.get(0).scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
      if (focus_selector) {
        window.setTimeout(function () {
          $(focus_selector).first().trigger('focus');
        }, 250);
      }
    });
  }

  /**
   * Synchronize Booking Tools status links with their current toggle values.
   *
   * @return {void}
   */
  function refresh_booking_tools_summary() {
    var $summary = $('.wpbc_add_booking__setup_summary').first();
    var enabled_label;
    var disabled_label;
    if (!$summary.length) {
      return;
    }
    enabled_label = $summary.attr('data-wpbc-add-booking-enabled-label') || 'Enabled';
    disabled_label = $summary.attr('data-wpbc-add-booking-disabled-label') || 'Disabled';
    $summary.find('[data-wpbc-add-booking-summary="emails"]').text($('#is_send_email_for_pending').is(':checked') ? enabled_label : disabled_label);
    $summary.find('[data-wpbc-add-booking-summary="allow-past"]').text($('#is_allow_bookings_in_past').is(':checked') ? enabled_label : disabled_label);
  }

  /**
   * Get the Add Booking date-selection radio container.
   *
   * @return {jQuery} Date-selection container, when rendered.
   */
  function get_days_selection_container() {
    return $('[data-wpbc-add-booking-days-selection="1"]').first();
  }

  /**
   * Normalize calendar engine modes to the three administrator radio choices.
   *
   * @param {string} mode Calendar or radio mode.
   * @return {string} single, multiple, range, or an empty string.
   */
  function normalize_days_selection_mode(mode) {
    mode = String(mode || '');
    if ('fixed' === mode || 'dynamic' === mode || 'range' === mode) {
      return 'range';
    }
    return 'single' === mode || 'multiple' === mode ? mode : '';
  }

  /**
   * Get the current Add Booking resource ID from the radio control context.
   *
   * @return {number} Positive resource ID, or zero when unavailable.
   */
  function get_days_selection_resource_id() {
    var resource_id = parseInt(get_days_selection_container().attr('data-wpbc-resource-id'), 10);
    if (!resource_id && window.wpbc_add_booking_component_context) {
      resource_id = parseInt(window.wpbc_add_booking_component_context.resource_id, 10);
    }
    return resource_id > 0 ? resource_id : 0;
  }

  /**
   * Read one calendar parameter without exposing page state globally.
   *
   * @param {number} resource_id Booking resource ID.
   * @param {string} parameter_name Calendar parameter name.
   * @return {*} Current parameter value, or null when the calendar is unavailable.
   */
  function get_calendar_parameter(resource_id, parameter_name) {
    if (!window._wpbc || !window._wpbc.calendar || 'function' !== typeof window._wpbc.calendar__get_param_value) {
      return null;
    }
    return window._wpbc.calendar__get_param_value(resource_id, parameter_name);
  }

  /**
   * Normalize an array or comma-separated calendar parameter into integers.
   *
   * @param {Array|number|string} parameter_value Calendar parameter value.
   * @param {Array} fallback_value Value returned when no valid numbers exist.
   * @return {Array} Integer values.
   */
  function normalize_calendar_number_list(parameter_value, fallback_value) {
    var values = Array.isArray(parameter_value) ? parameter_value : String(parameter_value || '').split(',');
    var normalized_values = [];
    $.each(values, function (index, number_value) {
      var parsed_number = parseInt(number_value, 10);
      if (!isNaN(parsed_number)) {
        normalized_values.push(parsed_number);
      }
    });
    return normalized_values.length ? normalized_values : fallback_value;
  }

  /**
   * Get the fixed/dynamic engine to use for the Range days radio choice.
   *
   * @return {string} fixed or dynamic.
   */
  function get_range_engine_mode() {
    var range_engine_mode = String(get_days_selection_container().attr('data-wpbc-range-engine-mode') || 'dynamic');
    return 'fixed' === range_engine_mode ? 'fixed' : 'dynamic';
  }

  /**
   * Update the checked radio and visible setup summary from an effective mode.
   *
   * @param {string} mode Calendar or radio mode.
   * @return {void}
   */
  function sync_days_selection_controls(mode) {
    var normalized_mode = normalize_days_selection_mode(mode);
    var $container = get_days_selection_container();
    var $radio;
    var mode_label;
    if (!normalized_mode || !$container.length) {
      return;
    }
    $radio = $container.find('input[name="wpbc_add_booking_days_selection_mode"][value="' + normalized_mode + '"]');
    if (1 !== $radio.length) {
      return;
    }
    $radio.prop('checked', true);
    mode_label = $radio.attr('data-wpbc-days-selection-label') || normalized_mode;
    $('[data-wpbc-add-booking-summary="days-selection"]').text(mode_label);
  }

  /**
   * Clear selected dates before changing their selection semantics.
   *
   * Customer fields remain untouched. Existing calendar helpers are used when
   * available so Datepick state and the hidden selected-date field stay aligned.
   *
   * @param {number} resource_id Booking resource ID.
   * @return {void}
   */
  function clear_selected_booking_dates(resource_id) {
    var $date_field = $('#date_booking' + resource_id);
    if (!$date_field.length || !String($date_field.val() || '').trim()) {
      return;
    }
    if ('function' === typeof window.wpbc_calendar__unselect_all_dates) {
      window.wpbc_calendar__unselect_all_dates(resource_id);
    } else {
      $date_field.val('');
    }
    if ('function' === typeof window.wpbc_disable_time_fields_in_booking_form) {
      window.wpbc_disable_time_fields_in_booking_form(resource_id);
    }
  }

  /**
   * Apply one radio mode through the shared immediate calendar helpers.
   *
   * Range mode retains the configured fixed/dynamic subtype and its existing
   * number-of-days and weekday parameters. No settings are saved.
   *
   * @param {string} mode Requested radio mode.
   * @param {boolean} clear_dates Whether an existing selection must be cleared.
   * @return {boolean} True when the requested helper was applied or already active.
   */
  function apply_days_selection_mode(mode, clear_dates) {
    var normalized_mode = normalize_days_selection_mode(mode);
    var resource_id = get_days_selection_resource_id();
    var desired_engine_mode = 'range' === normalized_mode ? get_range_engine_mode() : normalized_mode;
    var current_engine_mode;
    var fixed_days_number;
    if (!normalized_mode || !resource_id) {
      return false;
    }
    current_engine_mode = String(get_calendar_parameter(resource_id, 'days_select_mode') || '');
    if (desired_engine_mode === current_engine_mode) {
      sync_days_selection_controls(normalized_mode);
      return true;
    }
    if (clear_dates) {
      clear_selected_booking_dates(resource_id);
    }
    if ('single' === normalized_mode && 'function' === typeof window.wpbc_cal_days_select__single) {
      window.wpbc_cal_days_select__single(resource_id);
    } else if ('multiple' === normalized_mode && 'function' === typeof window.wpbc_cal_days_select__multiple) {
      window.wpbc_cal_days_select__multiple(resource_id);
    } else if ('range' === normalized_mode && 'fixed' === desired_engine_mode && 'function' === typeof window.wpbc_cal_days_select__fixed) {
      fixed_days_number = parseInt(get_calendar_parameter(resource_id, 'fixed__days_num'), 10);
      window.wpbc_cal_days_select__fixed(resource_id, fixed_days_number > 0 ? fixed_days_number : 3, normalize_calendar_number_list(get_calendar_parameter(resource_id, 'fixed__week_days__start'), [-1]));
    } else if ('range' === normalized_mode && 'function' === typeof window.wpbc_cal_days_select__range_mode) {
      window.wpbc_cal_days_select__range_mode(resource_id);
    } else {
      return false;
    }
    sync_days_selection_controls(normalized_mode);
    return true;
  }

  /**
   * Synchronize controls with the calendar, or enforce a user-selected override.
   *
   * @return {void}
   */
  function synchronize_days_selection_mode() {
    var resource_id = get_days_selection_resource_id();
    var current_engine_mode;
    if (!resource_id) {
      return;
    }
    if (active_days_selection_override) {
      apply_days_selection_mode(active_days_selection_override, false);
      return;
    }
    current_engine_mode = get_calendar_parameter(resource_id, 'days_select_mode');
    sync_days_selection_controls(current_engine_mode);
  }

  /**
   * Recheck mode after the selected Booking Form's legacy delayed initializer.
   *
   * Existing timers are cancelled so repeated clicks cannot accumulate work.
   * Reapplication occurs only when the calendar engine mode was changed by a
   * later initializer, avoiding unnecessary calendar renders.
   *
   * @return {void}
   */
  function schedule_days_selection_synchronization() {
    $.each(days_selection_enforcement_timers, function (index, timer_id) {
      window.clearTimeout(timer_id);
    });
    days_selection_enforcement_timers = [];
    $.each([0, 120, 1150, 2200], function (index, delay) {
      days_selection_enforcement_timers.push(window.setTimeout(synchronize_days_selection_mode, delay));
    });
  }

  /**
   * Copy the authoritative cost-correction number into its convenience slider.
   *
   * The slider intentionally keeps its 0-1000 exploration range. Exact values,
   * including decimals and totals above 1000, remain unchanged in the number input.
   *
   * @return {void}
   */
  function synchronize_cost_correction_range() {
    var $number_field = $('#wpbc_add_booking_cost_correction');
    var $range = $('.wpbc_add_booking__cost_correction [data-wpbc-admin-cost-correction-range="1"]').first();
    var number_value;
    if (!$number_field.length || !$range.length) {
      return;
    }
    number_value = Number($number_field.val());
    if ('' === String($number_field.val() || '').trim() || !isFinite(number_value)) {
      $range.val('0');
      return;
    }
    $range.val(String(number_value));
  }

  /**
   * Copy the convenience slider into the authoritative number input.
   *
   * @return {void}
   */
  function synchronize_cost_correction_number() {
    var $number_field = $('#wpbc_add_booking_cost_correction');
    var $range = $('.wpbc_add_booking__cost_correction [data-wpbc-admin-cost-correction-range="1"]').first();
    if (!$number_field.length || !$range.length) {
      return;
    }
    $number_field.val($range.val()).trigger('input');
  }

  /**
   * Add an explicitly entered correction to the outgoing Add Booking request.
   *
   * The control is outside the Booking Form element and therefore is not part of
   * the legacy serialized form data. The server authorizes and normalizes this
   * dedicated value before it reaches the Business Small cost pipeline.
   *
   * @param {Event} event jQuery event.
   * @param {number} resource_id Submitted Booking resource ID.
   * @param {Object} params Mutable booking-create request parameters.
   * @return {void}
   */
  function add_cost_correction_to_booking_request(event, resource_id, params) {
    var number_field = document.getElementById('wpbc_add_booking_cost_correction');
    var raw_cost;
    if (!params || !number_field) {
      return;
    }
    delete params.wpbc_admin_cost_correction;
    raw_cost = String(number_field.value || '').trim();
    if ('' === raw_cost || !number_field.checkValidity()) {
      return;
    }
    params.wpbc_admin_cost_correction = raw_cost;
  }
  $(document).on('click', '.wpbc_add_booking__rightbar_tabs [role="tab"]', function () {
    switch_right_panel($(this));
  });
  $(document).on('click', '.wpbc_add_booking__setup_summary_link', function (event) {
    event.preventDefault();
    open_settings_group($(this).attr('data-wpbc-add-booking-open-group'), $(this).attr('data-wpbc-add-booking-focus') || '');
  });
  $(document).on('change', '#is_send_email_for_pending, #is_allow_bookings_in_past', refresh_booking_tools_summary);
  $(document).on('input', '#wpbc_add_booking_cost_correction', synchronize_cost_correction_range);
  $(document).on('input', '.wpbc_add_booking__cost_correction [data-wpbc-admin-cost-correction-range="1"]', synchronize_cost_correction_number);
  $('body').on('wpbc_before_booking_create.wpbc_add_booking_cost_correction', add_cost_correction_to_booking_request);
  $(document).on('click', 'input[name="wpbc_add_booking_days_selection_mode"]', function () {
    active_days_selection_override = normalize_days_selection_mode($(this).val());
    apply_days_selection_mode(active_days_selection_override, true);
    schedule_days_selection_synchronization();
  });
  $(refresh_booking_tools_summary);
  $(synchronize_cost_correction_range);
  $(schedule_days_selection_synchronization);
})(jQuery);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1hZGQtYm9va2luZy9fb3V0L2FkZF9ib29raW5nX3BhZ2UuanMiLCJuYW1lcyI6WyIkIiwiYWN0aXZlX2RheXNfc2VsZWN0aW9uX292ZXJyaWRlIiwiZGF5c19zZWxlY3Rpb25fZW5mb3JjZW1lbnRfdGltZXJzIiwic3dpdGNoX3JpZ2h0X3BhbmVsIiwiJHRhYiIsInBhbmVsX2lkIiwiYXR0ciIsIiR0YWJzIiwiY2xvc2VzdCIsImZpbmQiLCIkcGFuZWxzIiwibGVuZ3RoIiwiaGlkZGVuIiwicmVtb3ZlQXR0ciIsIm9wZW5fc2V0dGluZ3NfZ3JvdXAiLCJncm91cF9uYW1lIiwiZm9jdXNfc2VsZWN0b3IiLCIkZ3JvdXAiLCJmaXJzdCIsInJvb3QiLCJjb250cm9sbGVyIiwiZ2V0IiwiX193cGJjX2NvbGxhcHNpYmxlX2luc3RhbmNlIiwiZXhwYW5kIiwic2libGluZ3MiLCJlYWNoIiwiJHNpYmxpbmciLCJyZW1vdmVDbGFzcyIsImNoaWxkcmVuIiwiYWRkQ2xhc3MiLCJ3aW5kb3ciLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJzY3JvbGxJbnRvVmlldyIsImJlaGF2aW9yIiwiYmxvY2siLCJzZXRUaW1lb3V0IiwidHJpZ2dlciIsInJlZnJlc2hfYm9va2luZ190b29sc19zdW1tYXJ5IiwiJHN1bW1hcnkiLCJlbmFibGVkX2xhYmVsIiwiZGlzYWJsZWRfbGFiZWwiLCJ0ZXh0IiwiaXMiLCJnZXRfZGF5c19zZWxlY3Rpb25fY29udGFpbmVyIiwibm9ybWFsaXplX2RheXNfc2VsZWN0aW9uX21vZGUiLCJtb2RlIiwiU3RyaW5nIiwiZ2V0X2RheXNfc2VsZWN0aW9uX3Jlc291cmNlX2lkIiwicmVzb3VyY2VfaWQiLCJwYXJzZUludCIsIndwYmNfYWRkX2Jvb2tpbmdfY29tcG9uZW50X2NvbnRleHQiLCJnZXRfY2FsZW5kYXJfcGFyYW1ldGVyIiwicGFyYW1ldGVyX25hbWUiLCJfd3BiYyIsImNhbGVuZGFyIiwiY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSIsIm5vcm1hbGl6ZV9jYWxlbmRhcl9udW1iZXJfbGlzdCIsInBhcmFtZXRlcl92YWx1ZSIsImZhbGxiYWNrX3ZhbHVlIiwidmFsdWVzIiwiQXJyYXkiLCJpc0FycmF5Iiwic3BsaXQiLCJub3JtYWxpemVkX3ZhbHVlcyIsImluZGV4IiwibnVtYmVyX3ZhbHVlIiwicGFyc2VkX251bWJlciIsImlzTmFOIiwicHVzaCIsImdldF9yYW5nZV9lbmdpbmVfbW9kZSIsInJhbmdlX2VuZ2luZV9tb2RlIiwic3luY19kYXlzX3NlbGVjdGlvbl9jb250cm9scyIsIm5vcm1hbGl6ZWRfbW9kZSIsIiRjb250YWluZXIiLCIkcmFkaW8iLCJtb2RlX2xhYmVsIiwicHJvcCIsImNsZWFyX3NlbGVjdGVkX2Jvb2tpbmdfZGF0ZXMiLCIkZGF0ZV9maWVsZCIsInZhbCIsInRyaW0iLCJ3cGJjX2NhbGVuZGFyX191bnNlbGVjdF9hbGxfZGF0ZXMiLCJ3cGJjX2Rpc2FibGVfdGltZV9maWVsZHNfaW5fYm9va2luZ19mb3JtIiwiYXBwbHlfZGF5c19zZWxlY3Rpb25fbW9kZSIsImNsZWFyX2RhdGVzIiwiZGVzaXJlZF9lbmdpbmVfbW9kZSIsImN1cnJlbnRfZW5naW5lX21vZGUiLCJmaXhlZF9kYXlzX251bWJlciIsIndwYmNfY2FsX2RheXNfc2VsZWN0X19zaW5nbGUiLCJ3cGJjX2NhbF9kYXlzX3NlbGVjdF9fbXVsdGlwbGUiLCJ3cGJjX2NhbF9kYXlzX3NlbGVjdF9fZml4ZWQiLCJ3cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmFuZ2VfbW9kZSIsInN5bmNocm9uaXplX2RheXNfc2VsZWN0aW9uX21vZGUiLCJzY2hlZHVsZV9kYXlzX3NlbGVjdGlvbl9zeW5jaHJvbml6YXRpb24iLCJ0aW1lcl9pZCIsImNsZWFyVGltZW91dCIsImRlbGF5Iiwic3luY2hyb25pemVfY29zdF9jb3JyZWN0aW9uX3JhbmdlIiwiJG51bWJlcl9maWVsZCIsIiRyYW5nZSIsIk51bWJlciIsImlzRmluaXRlIiwic3luY2hyb25pemVfY29zdF9jb3JyZWN0aW9uX251bWJlciIsImFkZF9jb3N0X2NvcnJlY3Rpb25fdG9fYm9va2luZ19yZXF1ZXN0IiwiZXZlbnQiLCJwYXJhbXMiLCJudW1iZXJfZmllbGQiLCJkb2N1bWVudCIsImdldEVsZW1lbnRCeUlkIiwicmF3X2Nvc3QiLCJ3cGJjX2FkbWluX2Nvc3RfY29ycmVjdGlvbiIsInZhbHVlIiwiY2hlY2tWYWxpZGl0eSIsIm9uIiwicHJldmVudERlZmF1bHQiLCJqUXVlcnkiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWFkZC1ib29raW5nL19zcmMvYWRkX2Jvb2tpbmdfcGFnZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiogQWRkIEJvb2tpbmcgYWRtaW5pc3RyYXRvciBpbnNwZWN0b3IgaW50ZXJhY3Rpb25zLiAqL1xuKCBmdW5jdGlvbiAoICQgKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHR2YXIgYWN0aXZlX2RheXNfc2VsZWN0aW9uX292ZXJyaWRlID0gJyc7XG5cdHZhciBkYXlzX3NlbGVjdGlvbl9lbmZvcmNlbWVudF90aW1lcnMgPSBbXTtcblxuXHQvKipcblx0ICogU2hvdyB0aGUgcGFuZWwgY29udHJvbGxlZCBieSBvbmUgY29tcGFjdCByaWdodC1zaWRlYmFyIHRhYi5cblx0ICpcblx0ICogQHBhcmFtIHtqUXVlcnl9ICR0YWIgU2VsZWN0ZWQgdGFiIGJ1dHRvbi5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHN3aXRjaF9yaWdodF9wYW5lbCggJHRhYiApIHtcblx0XHR2YXIgcGFuZWxfaWQgPSAkdGFiLmF0dHIoICdhcmlhLWNvbnRyb2xzJyApO1xuXHRcdHZhciAkdGFicyA9ICR0YWIuY2xvc2VzdCggJy53cGJjX2FkZF9ib29raW5nX19yaWdodGJhcl90YWJzJyApLmZpbmQoICdbcm9sZT1cInRhYlwiXScgKTtcblx0XHR2YXIgJHBhbmVscyA9ICQoICcud3BiY19hZGRfYm9va2luZ19fcmlnaHRiYXInICkuZmluZCggJ1tyb2xlPVwidGFicGFuZWxcIl0nICk7XG5cblx0XHRpZiAoICEgcGFuZWxfaWQgfHwgISAkKCAnIycgKyBwYW5lbF9pZCApLmxlbmd0aCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQkdGFicy5hdHRyKCAnYXJpYS1zZWxlY3RlZCcsICdmYWxzZScgKTtcblx0XHQkdGFiLmF0dHIoICdhcmlhLXNlbGVjdGVkJywgJ3RydWUnICk7XG5cdFx0JHBhbmVscy5hdHRyKCB7IGhpZGRlbjogdHJ1ZSwgJ2FyaWEtaGlkZGVuJzogJ3RydWUnIH0gKTtcblx0XHQkKCAnIycgKyBwYW5lbF9pZCApLnJlbW92ZUF0dHIoICdoaWRkZW4nICkuYXR0ciggJ2FyaWEtaGlkZGVuJywgJ2ZhbHNlJyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIEV4cGFuZCBhbiBpbnNwZWN0b3IgZ3JvdXAgYW5kIGZvY3VzIG9uZSBvZiBpdHMgY29udHJvbHMuXG5cdCAqXG5cdCAqIFRoZSBzaGFyZWQgY29sbGFwc2libGUgY29udHJvbGxlciBpcyB1c2VkIHdoZW4gYXZhaWxhYmxlIHNvIGV4Y2x1c2l2ZVxuXHQgKiBncm91cHMgYW5kIEFSSUEgc3RhdGUgc3RheSBzeW5jaHJvbml6ZWQuIFRoZSBoZWFkZXIgY2xpY2sgaXMgYSBzYWZlXG5cdCAqIGZhbGxiYWNrIGZvciBvbGRlciBCb29raW5nIENhbGVuZGFyIGFkbWluIGJ1bmRsZXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBncm91cF9uYW1lIEdyb3VwIGRhdGEga2V5LlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZm9jdXNfc2VsZWN0b3IgT3B0aW9uYWwgY29udHJvbCB0byBmb2N1cyBhZnRlciBleHBhbnNpb24uXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBvcGVuX3NldHRpbmdzX2dyb3VwKCBncm91cF9uYW1lLCBmb2N1c19zZWxlY3RvciApIHtcblx0XHR2YXIgJGdyb3VwID0gJCggJy53cGJjX2FkZF9ib29raW5nX19pbnNwZWN0b3Jfc2V0dGluZ3MgLndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwW2RhdGEtZ3JvdXA9XCInICsgZ3JvdXBfbmFtZSArICdcIl0nICkuZmlyc3QoKTtcblx0XHR2YXIgcm9vdDtcblx0XHR2YXIgY29udHJvbGxlcjtcblxuXHRcdGlmICggISAkZ3JvdXAubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJvb3QgPSAkZ3JvdXAuY2xvc2VzdCggJy53cGJjX2NvbGxhcHNpYmxlJyApLmdldCggMCApO1xuXHRcdGNvbnRyb2xsZXIgPSByb290ICYmIHJvb3QuX193cGJjX2NvbGxhcHNpYmxlX2luc3RhbmNlID8gcm9vdC5fX3dwYmNfY29sbGFwc2libGVfaW5zdGFuY2UgOiBudWxsO1xuXG5cdFx0aWYgKCBjb250cm9sbGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBjb250cm9sbGVyLmV4cGFuZCApIHtcblx0XHRcdGNvbnRyb2xsZXIuZXhwYW5kKCAkZ3JvdXAuZ2V0KCAwICkgKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0JGdyb3VwLnNpYmxpbmdzKCAnLndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0dmFyICRzaWJsaW5nID0gJCggdGhpcyApO1xuXG5cdFx0XHRcdCRzaWJsaW5nLnJlbW92ZUNsYXNzKCAnaXMtb3BlbicgKTtcblx0XHRcdFx0JHNpYmxpbmcuY2hpbGRyZW4oICcuZ3JvdXBfX2hlYWRlcicgKS5hdHRyKCAnYXJpYS1leHBhbmRlZCcsICdmYWxzZScgKTtcblx0XHRcdFx0JHNpYmxpbmcuY2hpbGRyZW4oICcuZ3JvdXBfX2ZpZWxkcycgKS5hdHRyKCB7IGhpZGRlbjogdHJ1ZSwgJ2FyaWEtaGlkZGVuJzogJ3RydWUnIH0gKTtcblx0XHRcdH0gKTtcblx0XHRcdCRncm91cC5hZGRDbGFzcyggJ2lzLW9wZW4nICk7XG5cdFx0XHQkZ3JvdXAuY2hpbGRyZW4oICcuZ3JvdXBfX2hlYWRlcicgKS5hdHRyKCAnYXJpYS1leHBhbmRlZCcsICd0cnVlJyApO1xuXHRcdFx0JGdyb3VwLmNoaWxkcmVuKCAnLmdyb3VwX19maWVsZHMnICkucmVtb3ZlQXR0ciggJ2hpZGRlbicgKS5hdHRyKCAnYXJpYS1oaWRkZW4nLCAnZmFsc2UnICk7XG5cdFx0fVxuXG5cdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZnVuY3Rpb24gKCkge1xuXHRcdFx0JGdyb3VwLmdldCggMCApLnNjcm9sbEludG9WaWV3KCB7IGJlaGF2aW9yOiAnc21vb3RoJywgYmxvY2s6ICdzdGFydCcgfSApO1xuXHRcdFx0aWYgKCBmb2N1c19zZWxlY3RvciApIHtcblx0XHRcdFx0d2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHQkKCBmb2N1c19zZWxlY3RvciApLmZpcnN0KCkudHJpZ2dlciggJ2ZvY3VzJyApO1xuXHRcdFx0XHR9LCAyNTAgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogU3luY2hyb25pemUgQm9va2luZyBUb29scyBzdGF0dXMgbGlua3Mgd2l0aCB0aGVpciBjdXJyZW50IHRvZ2dsZSB2YWx1ZXMuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiByZWZyZXNoX2Jvb2tpbmdfdG9vbHNfc3VtbWFyeSgpIHtcblx0XHR2YXIgJHN1bW1hcnkgPSAkKCAnLndwYmNfYWRkX2Jvb2tpbmdfX3NldHVwX3N1bW1hcnknICkuZmlyc3QoKTtcblx0XHR2YXIgZW5hYmxlZF9sYWJlbDtcblx0XHR2YXIgZGlzYWJsZWRfbGFiZWw7XG5cblx0XHRpZiAoICEgJHN1bW1hcnkubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGVuYWJsZWRfbGFiZWwgPSAkc3VtbWFyeS5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLWVuYWJsZWQtbGFiZWwnICkgfHwgJ0VuYWJsZWQnO1xuXHRcdGRpc2FibGVkX2xhYmVsID0gJHN1bW1hcnkuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1kaXNhYmxlZC1sYWJlbCcgKSB8fCAnRGlzYWJsZWQnO1xuXG5cdFx0JHN1bW1hcnkuZmluZCggJ1tkYXRhLXdwYmMtYWRkLWJvb2tpbmctc3VtbWFyeT1cImVtYWlsc1wiXScgKS50ZXh0KFxuXHRcdFx0JCggJyNpc19zZW5kX2VtYWlsX2Zvcl9wZW5kaW5nJyApLmlzKCAnOmNoZWNrZWQnICkgPyBlbmFibGVkX2xhYmVsIDogZGlzYWJsZWRfbGFiZWxcblx0XHQpO1xuXHRcdCRzdW1tYXJ5LmZpbmQoICdbZGF0YS13cGJjLWFkZC1ib29raW5nLXN1bW1hcnk9XCJhbGxvdy1wYXN0XCJdJyApLnRleHQoXG5cdFx0XHQkKCAnI2lzX2FsbG93X2Jvb2tpbmdzX2luX3Bhc3QnICkuaXMoICc6Y2hlY2tlZCcgKSA/IGVuYWJsZWRfbGFiZWwgOiBkaXNhYmxlZF9sYWJlbFxuXHRcdCk7XG5cdH1cblxuXHQvKipcblx0ICogR2V0IHRoZSBBZGQgQm9va2luZyBkYXRlLXNlbGVjdGlvbiByYWRpbyBjb250YWluZXIuXG5cdCAqXG5cdCAqIEByZXR1cm4ge2pRdWVyeX0gRGF0ZS1zZWxlY3Rpb24gY29udGFpbmVyLCB3aGVuIHJlbmRlcmVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2RheXNfc2VsZWN0aW9uX2NvbnRhaW5lcigpIHtcblx0XHRyZXR1cm4gJCggJ1tkYXRhLXdwYmMtYWRkLWJvb2tpbmctZGF5cy1zZWxlY3Rpb249XCIxXCJdJyApLmZpcnN0KCk7XG5cdH1cblxuXHQvKipcblx0ICogTm9ybWFsaXplIGNhbGVuZGFyIGVuZ2luZSBtb2RlcyB0byB0aGUgdGhyZWUgYWRtaW5pc3RyYXRvciByYWRpbyBjaG9pY2VzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gbW9kZSBDYWxlbmRhciBvciByYWRpbyBtb2RlLlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IHNpbmdsZSwgbXVsdGlwbGUsIHJhbmdlLCBvciBhbiBlbXB0eSBzdHJpbmcuXG5cdCAqL1xuXHRmdW5jdGlvbiBub3JtYWxpemVfZGF5c19zZWxlY3Rpb25fbW9kZSggbW9kZSApIHtcblx0XHRtb2RlID0gU3RyaW5nKCBtb2RlIHx8ICcnICk7XG5cblx0XHRpZiAoICdmaXhlZCcgPT09IG1vZGUgfHwgJ2R5bmFtaWMnID09PSBtb2RlIHx8ICdyYW5nZScgPT09IG1vZGUgKSB7XG5cdFx0XHRyZXR1cm4gJ3JhbmdlJztcblx0XHR9XG5cblx0XHRyZXR1cm4gJ3NpbmdsZScgPT09IG1vZGUgfHwgJ211bHRpcGxlJyA9PT0gbW9kZSA/IG1vZGUgOiAnJztcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXQgdGhlIGN1cnJlbnQgQWRkIEJvb2tpbmcgcmVzb3VyY2UgSUQgZnJvbSB0aGUgcmFkaW8gY29udHJvbCBjb250ZXh0LlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtudW1iZXJ9IFBvc2l0aXZlIHJlc291cmNlIElELCBvciB6ZXJvIHdoZW4gdW5hdmFpbGFibGUuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfZGF5c19zZWxlY3Rpb25fcmVzb3VyY2VfaWQoKSB7XG5cdFx0dmFyIHJlc291cmNlX2lkID0gcGFyc2VJbnQoIGdldF9kYXlzX3NlbGVjdGlvbl9jb250YWluZXIoKS5hdHRyKCAnZGF0YS13cGJjLXJlc291cmNlLWlkJyApLCAxMCApO1xuXG5cdFx0aWYgKCAhIHJlc291cmNlX2lkICYmIHdpbmRvdy53cGJjX2FkZF9ib29raW5nX2NvbXBvbmVudF9jb250ZXh0ICkge1xuXHRcdFx0cmVzb3VyY2VfaWQgPSBwYXJzZUludCggd2luZG93LndwYmNfYWRkX2Jvb2tpbmdfY29tcG9uZW50X2NvbnRleHQucmVzb3VyY2VfaWQsIDEwICk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc291cmNlX2lkID4gMCA/IHJlc291cmNlX2lkIDogMDtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZWFkIG9uZSBjYWxlbmRhciBwYXJhbWV0ZXIgd2l0aG91dCBleHBvc2luZyBwYWdlIHN0YXRlIGdsb2JhbGx5LlxuXHQgKlxuXHQgKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgQm9va2luZyByZXNvdXJjZSBJRC5cblx0ICogQHBhcmFtIHtzdHJpbmd9IHBhcmFtZXRlcl9uYW1lIENhbGVuZGFyIHBhcmFtZXRlciBuYW1lLlxuXHQgKiBAcmV0dXJuIHsqfSBDdXJyZW50IHBhcmFtZXRlciB2YWx1ZSwgb3IgbnVsbCB3aGVuIHRoZSBjYWxlbmRhciBpcyB1bmF2YWlsYWJsZS5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9jYWxlbmRhcl9wYXJhbWV0ZXIoIHJlc291cmNlX2lkLCBwYXJhbWV0ZXJfbmFtZSApIHtcblx0XHRpZiAoICEgd2luZG93Ll93cGJjIHx8ICEgd2luZG93Ll93cGJjLmNhbGVuZGFyIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiB3aW5kb3cuX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHJldHVybiB3aW5kb3cuX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsIHBhcmFtZXRlcl9uYW1lICk7XG5cdH1cblxuXHQvKipcblx0ICogTm9ybWFsaXplIGFuIGFycmF5IG9yIGNvbW1hLXNlcGFyYXRlZCBjYWxlbmRhciBwYXJhbWV0ZXIgaW50byBpbnRlZ2Vycy5cblx0ICpcblx0ICogQHBhcmFtIHtBcnJheXxudW1iZXJ8c3RyaW5nfSBwYXJhbWV0ZXJfdmFsdWUgQ2FsZW5kYXIgcGFyYW1ldGVyIHZhbHVlLlxuXHQgKiBAcGFyYW0ge0FycmF5fSBmYWxsYmFja192YWx1ZSBWYWx1ZSByZXR1cm5lZCB3aGVuIG5vIHZhbGlkIG51bWJlcnMgZXhpc3QuXG5cdCAqIEByZXR1cm4ge0FycmF5fSBJbnRlZ2VyIHZhbHVlcy5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9jYWxlbmRhcl9udW1iZXJfbGlzdCggcGFyYW1ldGVyX3ZhbHVlLCBmYWxsYmFja192YWx1ZSApIHtcblx0XHR2YXIgdmFsdWVzID0gQXJyYXkuaXNBcnJheSggcGFyYW1ldGVyX3ZhbHVlICkgPyBwYXJhbWV0ZXJfdmFsdWUgOiBTdHJpbmcoIHBhcmFtZXRlcl92YWx1ZSB8fCAnJyApLnNwbGl0KCAnLCcgKTtcblx0XHR2YXIgbm9ybWFsaXplZF92YWx1ZXMgPSBbXTtcblxuXHRcdCQuZWFjaCggdmFsdWVzLCBmdW5jdGlvbiAoIGluZGV4LCBudW1iZXJfdmFsdWUgKSB7XG5cdFx0XHR2YXIgcGFyc2VkX251bWJlciA9IHBhcnNlSW50KCBudW1iZXJfdmFsdWUsIDEwICk7XG5cblx0XHRcdGlmICggISBpc05hTiggcGFyc2VkX251bWJlciApICkge1xuXHRcdFx0XHRub3JtYWxpemVkX3ZhbHVlcy5wdXNoKCBwYXJzZWRfbnVtYmVyICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIG5vcm1hbGl6ZWRfdmFsdWVzLmxlbmd0aCA/IG5vcm1hbGl6ZWRfdmFsdWVzIDogZmFsbGJhY2tfdmFsdWU7XG5cdH1cblxuXHQvKipcblx0ICogR2V0IHRoZSBmaXhlZC9keW5hbWljIGVuZ2luZSB0byB1c2UgZm9yIHRoZSBSYW5nZSBkYXlzIHJhZGlvIGNob2ljZS5cblx0ICpcblx0ICogQHJldHVybiB7c3RyaW5nfSBmaXhlZCBvciBkeW5hbWljLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X3JhbmdlX2VuZ2luZV9tb2RlKCkge1xuXHRcdHZhciByYW5nZV9lbmdpbmVfbW9kZSA9IFN0cmluZyggZ2V0X2RheXNfc2VsZWN0aW9uX2NvbnRhaW5lcigpLmF0dHIoICdkYXRhLXdwYmMtcmFuZ2UtZW5naW5lLW1vZGUnICkgfHwgJ2R5bmFtaWMnICk7XG5cblx0XHRyZXR1cm4gJ2ZpeGVkJyA9PT0gcmFuZ2VfZW5naW5lX21vZGUgPyAnZml4ZWQnIDogJ2R5bmFtaWMnO1xuXHR9XG5cblx0LyoqXG5cdCAqIFVwZGF0ZSB0aGUgY2hlY2tlZCByYWRpbyBhbmQgdmlzaWJsZSBzZXR1cCBzdW1tYXJ5IGZyb20gYW4gZWZmZWN0aXZlIG1vZGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBtb2RlIENhbGVuZGFyIG9yIHJhZGlvIG1vZGUuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzeW5jX2RheXNfc2VsZWN0aW9uX2NvbnRyb2xzKCBtb2RlICkge1xuXHRcdHZhciBub3JtYWxpemVkX21vZGUgPSBub3JtYWxpemVfZGF5c19zZWxlY3Rpb25fbW9kZSggbW9kZSApO1xuXHRcdHZhciAkY29udGFpbmVyID0gZ2V0X2RheXNfc2VsZWN0aW9uX2NvbnRhaW5lcigpO1xuXHRcdHZhciAkcmFkaW87XG5cdFx0dmFyIG1vZGVfbGFiZWw7XG5cblx0XHRpZiAoICEgbm9ybWFsaXplZF9tb2RlIHx8ICEgJGNvbnRhaW5lci5sZW5ndGggKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0JHJhZGlvID0gJGNvbnRhaW5lci5maW5kKCAnaW5wdXRbbmFtZT1cIndwYmNfYWRkX2Jvb2tpbmdfZGF5c19zZWxlY3Rpb25fbW9kZVwiXVt2YWx1ZT1cIicgKyBub3JtYWxpemVkX21vZGUgKyAnXCJdJyApO1xuXHRcdGlmICggMSAhPT0gJHJhZGlvLmxlbmd0aCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQkcmFkaW8ucHJvcCggJ2NoZWNrZWQnLCB0cnVlICk7XG5cdFx0bW9kZV9sYWJlbCA9ICRyYWRpby5hdHRyKCAnZGF0YS13cGJjLWRheXMtc2VsZWN0aW9uLWxhYmVsJyApIHx8IG5vcm1hbGl6ZWRfbW9kZTtcblx0XHQkKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy1zdW1tYXJ5PVwiZGF5cy1zZWxlY3Rpb25cIl0nICkudGV4dCggbW9kZV9sYWJlbCApO1xuXHR9XG5cblx0LyoqXG5cdCAqIENsZWFyIHNlbGVjdGVkIGRhdGVzIGJlZm9yZSBjaGFuZ2luZyB0aGVpciBzZWxlY3Rpb24gc2VtYW50aWNzLlxuXHQgKlxuXHQgKiBDdXN0b21lciBmaWVsZHMgcmVtYWluIHVudG91Y2hlZC4gRXhpc3RpbmcgY2FsZW5kYXIgaGVscGVycyBhcmUgdXNlZCB3aGVuXG5cdCAqIGF2YWlsYWJsZSBzbyBEYXRlcGljayBzdGF0ZSBhbmQgdGhlIGhpZGRlbiBzZWxlY3RlZC1kYXRlIGZpZWxkIHN0YXkgYWxpZ25lZC5cblx0ICpcblx0ICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIEJvb2tpbmcgcmVzb3VyY2UgSUQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBjbGVhcl9zZWxlY3RlZF9ib29raW5nX2RhdGVzKCByZXNvdXJjZV9pZCApIHtcblx0XHR2YXIgJGRhdGVfZmllbGQgPSAkKCAnI2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApO1xuXG5cdFx0aWYgKCAhICRkYXRlX2ZpZWxkLmxlbmd0aCB8fCAhIFN0cmluZyggJGRhdGVfZmllbGQudmFsKCkgfHwgJycgKS50cmltKCkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfY2FsZW5kYXJfX3Vuc2VsZWN0X2FsbF9kYXRlcyApIHtcblx0XHRcdHdpbmRvdy53cGJjX2NhbGVuZGFyX191bnNlbGVjdF9hbGxfZGF0ZXMoIHJlc291cmNlX2lkICk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdCRkYXRlX2ZpZWxkLnZhbCggJycgKTtcblx0XHR9XG5cblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19kaXNhYmxlX3RpbWVfZmllbGRzX2luX2Jvb2tpbmdfZm9ybSApIHtcblx0XHRcdHdpbmRvdy53cGJjX2Rpc2FibGVfdGltZV9maWVsZHNfaW5fYm9va2luZ19mb3JtKCByZXNvdXJjZV9pZCApO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBBcHBseSBvbmUgcmFkaW8gbW9kZSB0aHJvdWdoIHRoZSBzaGFyZWQgaW1tZWRpYXRlIGNhbGVuZGFyIGhlbHBlcnMuXG5cdCAqXG5cdCAqIFJhbmdlIG1vZGUgcmV0YWlucyB0aGUgY29uZmlndXJlZCBmaXhlZC9keW5hbWljIHN1YnR5cGUgYW5kIGl0cyBleGlzdGluZ1xuXHQgKiBudW1iZXItb2YtZGF5cyBhbmQgd2Vla2RheSBwYXJhbWV0ZXJzLiBObyBzZXR0aW5ncyBhcmUgc2F2ZWQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBtb2RlIFJlcXVlc3RlZCByYWRpbyBtb2RlLlxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IGNsZWFyX2RhdGVzIFdoZXRoZXIgYW4gZXhpc3Rpbmcgc2VsZWN0aW9uIG11c3QgYmUgY2xlYXJlZC5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSByZXF1ZXN0ZWQgaGVscGVyIHdhcyBhcHBsaWVkIG9yIGFscmVhZHkgYWN0aXZlLlxuXHQgKi9cblx0ZnVuY3Rpb24gYXBwbHlfZGF5c19zZWxlY3Rpb25fbW9kZSggbW9kZSwgY2xlYXJfZGF0ZXMgKSB7XG5cdFx0dmFyIG5vcm1hbGl6ZWRfbW9kZSA9IG5vcm1hbGl6ZV9kYXlzX3NlbGVjdGlvbl9tb2RlKCBtb2RlICk7XG5cdFx0dmFyIHJlc291cmNlX2lkID0gZ2V0X2RheXNfc2VsZWN0aW9uX3Jlc291cmNlX2lkKCk7XG5cdFx0dmFyIGRlc2lyZWRfZW5naW5lX21vZGUgPSAncmFuZ2UnID09PSBub3JtYWxpemVkX21vZGUgPyBnZXRfcmFuZ2VfZW5naW5lX21vZGUoKSA6IG5vcm1hbGl6ZWRfbW9kZTtcblx0XHR2YXIgY3VycmVudF9lbmdpbmVfbW9kZTtcblx0XHR2YXIgZml4ZWRfZGF5c19udW1iZXI7XG5cblx0XHRpZiAoICEgbm9ybWFsaXplZF9tb2RlIHx8ICEgcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y3VycmVudF9lbmdpbmVfbW9kZSA9IFN0cmluZyggZ2V0X2NhbGVuZGFyX3BhcmFtZXRlciggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApIHx8ICcnICk7XG5cdFx0aWYgKCBkZXNpcmVkX2VuZ2luZV9tb2RlID09PSBjdXJyZW50X2VuZ2luZV9tb2RlICkge1xuXHRcdFx0c3luY19kYXlzX3NlbGVjdGlvbl9jb250cm9scyggbm9ybWFsaXplZF9tb2RlICk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAoIGNsZWFyX2RhdGVzICkge1xuXHRcdFx0Y2xlYXJfc2VsZWN0ZWRfYm9va2luZ19kYXRlcyggcmVzb3VyY2VfaWQgKTtcblx0XHR9XG5cblx0XHRpZiAoICdzaW5nbGUnID09PSBub3JtYWxpemVkX21vZGUgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX2NhbF9kYXlzX3NlbGVjdF9fc2luZ2xlICkge1xuXHRcdFx0d2luZG93LndwYmNfY2FsX2RheXNfc2VsZWN0X19zaW5nbGUoIHJlc291cmNlX2lkICk7XG5cdFx0fSBlbHNlIGlmICggJ211bHRpcGxlJyA9PT0gbm9ybWFsaXplZF9tb2RlICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19jYWxfZGF5c19zZWxlY3RfX211bHRpcGxlICkge1xuXHRcdFx0d2luZG93LndwYmNfY2FsX2RheXNfc2VsZWN0X19tdWx0aXBsZSggcmVzb3VyY2VfaWQgKTtcblx0XHR9IGVsc2UgaWYgKCAncmFuZ2UnID09PSBub3JtYWxpemVkX21vZGUgJiYgJ2ZpeGVkJyA9PT0gZGVzaXJlZF9lbmdpbmVfbW9kZSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfY2FsX2RheXNfc2VsZWN0X19maXhlZCApIHtcblx0XHRcdGZpeGVkX2RheXNfbnVtYmVyID0gcGFyc2VJbnQoIGdldF9jYWxlbmRhcl9wYXJhbWV0ZXIoIHJlc291cmNlX2lkLCAnZml4ZWRfX2RheXNfbnVtJyApLCAxMCApO1xuXHRcdFx0d2luZG93LndwYmNfY2FsX2RheXNfc2VsZWN0X19maXhlZChcblx0XHRcdFx0cmVzb3VyY2VfaWQsXG5cdFx0XHRcdGZpeGVkX2RheXNfbnVtYmVyID4gMCA/IGZpeGVkX2RheXNfbnVtYmVyIDogMyxcblx0XHRcdFx0bm9ybWFsaXplX2NhbGVuZGFyX251bWJlcl9saXN0KCBnZXRfY2FsZW5kYXJfcGFyYW1ldGVyKCByZXNvdXJjZV9pZCwgJ2ZpeGVkX193ZWVrX2RheXNfX3N0YXJ0JyApLCBbIC0xIF0gKVxuXHRcdFx0KTtcblx0XHR9IGVsc2UgaWYgKCAncmFuZ2UnID09PSBub3JtYWxpemVkX21vZGUgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmFuZ2VfbW9kZSApIHtcblx0XHRcdHdpbmRvdy53cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmFuZ2VfbW9kZSggcmVzb3VyY2VfaWQgKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHN5bmNfZGF5c19zZWxlY3Rpb25fY29udHJvbHMoIG5vcm1hbGl6ZWRfbW9kZSApO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIFN5bmNocm9uaXplIGNvbnRyb2xzIHdpdGggdGhlIGNhbGVuZGFyLCBvciBlbmZvcmNlIGEgdXNlci1zZWxlY3RlZCBvdmVycmlkZS5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHN5bmNocm9uaXplX2RheXNfc2VsZWN0aW9uX21vZGUoKSB7XG5cdFx0dmFyIHJlc291cmNlX2lkID0gZ2V0X2RheXNfc2VsZWN0aW9uX3Jlc291cmNlX2lkKCk7XG5cdFx0dmFyIGN1cnJlbnRfZW5naW5lX21vZGU7XG5cblx0XHRpZiAoICEgcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCBhY3RpdmVfZGF5c19zZWxlY3Rpb25fb3ZlcnJpZGUgKSB7XG5cdFx0XHRhcHBseV9kYXlzX3NlbGVjdGlvbl9tb2RlKCBhY3RpdmVfZGF5c19zZWxlY3Rpb25fb3ZlcnJpZGUsIGZhbHNlICk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y3VycmVudF9lbmdpbmVfbW9kZSA9IGdldF9jYWxlbmRhcl9wYXJhbWV0ZXIoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKTtcblx0XHRzeW5jX2RheXNfc2VsZWN0aW9uX2NvbnRyb2xzKCBjdXJyZW50X2VuZ2luZV9tb2RlICk7XG5cdH1cblxuXHQvKipcblx0ICogUmVjaGVjayBtb2RlIGFmdGVyIHRoZSBzZWxlY3RlZCBCb29raW5nIEZvcm0ncyBsZWdhY3kgZGVsYXllZCBpbml0aWFsaXplci5cblx0ICpcblx0ICogRXhpc3RpbmcgdGltZXJzIGFyZSBjYW5jZWxsZWQgc28gcmVwZWF0ZWQgY2xpY2tzIGNhbm5vdCBhY2N1bXVsYXRlIHdvcmsuXG5cdCAqIFJlYXBwbGljYXRpb24gb2NjdXJzIG9ubHkgd2hlbiB0aGUgY2FsZW5kYXIgZW5naW5lIG1vZGUgd2FzIGNoYW5nZWQgYnkgYVxuXHQgKiBsYXRlciBpbml0aWFsaXplciwgYXZvaWRpbmcgdW5uZWNlc3NhcnkgY2FsZW5kYXIgcmVuZGVycy5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHNjaGVkdWxlX2RheXNfc2VsZWN0aW9uX3N5bmNocm9uaXphdGlvbigpIHtcblx0XHQkLmVhY2goIGRheXNfc2VsZWN0aW9uX2VuZm9yY2VtZW50X3RpbWVycywgZnVuY3Rpb24gKCBpbmRleCwgdGltZXJfaWQgKSB7XG5cdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCB0aW1lcl9pZCApO1xuXHRcdH0gKTtcblx0XHRkYXlzX3NlbGVjdGlvbl9lbmZvcmNlbWVudF90aW1lcnMgPSBbXTtcblxuXHRcdCQuZWFjaCggWyAwLCAxMjAsIDExNTAsIDIyMDAgXSwgZnVuY3Rpb24gKCBpbmRleCwgZGVsYXkgKSB7XG5cdFx0XHRkYXlzX3NlbGVjdGlvbl9lbmZvcmNlbWVudF90aW1lcnMucHVzaCggd2luZG93LnNldFRpbWVvdXQoIHN5bmNocm9uaXplX2RheXNfc2VsZWN0aW9uX21vZGUsIGRlbGF5ICkgKTtcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogQ29weSB0aGUgYXV0aG9yaXRhdGl2ZSBjb3N0LWNvcnJlY3Rpb24gbnVtYmVyIGludG8gaXRzIGNvbnZlbmllbmNlIHNsaWRlci5cblx0ICpcblx0ICogVGhlIHNsaWRlciBpbnRlbnRpb25hbGx5IGtlZXBzIGl0cyAwLTEwMDAgZXhwbG9yYXRpb24gcmFuZ2UuIEV4YWN0IHZhbHVlcyxcblx0ICogaW5jbHVkaW5nIGRlY2ltYWxzIGFuZCB0b3RhbHMgYWJvdmUgMTAwMCwgcmVtYWluIHVuY2hhbmdlZCBpbiB0aGUgbnVtYmVyIGlucHV0LlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY2hyb25pemVfY29zdF9jb3JyZWN0aW9uX3JhbmdlKCkge1xuXHRcdHZhciAkbnVtYmVyX2ZpZWxkID0gJCggJyN3cGJjX2FkZF9ib29raW5nX2Nvc3RfY29ycmVjdGlvbicgKTtcblx0XHR2YXIgJHJhbmdlID0gJCggJy53cGJjX2FkZF9ib29raW5nX19jb3N0X2NvcnJlY3Rpb24gW2RhdGEtd3BiYy1hZG1pbi1jb3N0LWNvcnJlY3Rpb24tcmFuZ2U9XCIxXCJdJyApLmZpcnN0KCk7XG5cdFx0dmFyIG51bWJlcl92YWx1ZTtcblxuXHRcdGlmICggISAkbnVtYmVyX2ZpZWxkLmxlbmd0aCB8fCAhICRyYW5nZS5sZW5ndGggKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bnVtYmVyX3ZhbHVlID0gTnVtYmVyKCAkbnVtYmVyX2ZpZWxkLnZhbCgpICk7XG5cdFx0aWYgKCAnJyA9PT0gU3RyaW5nKCAkbnVtYmVyX2ZpZWxkLnZhbCgpIHx8ICcnICkudHJpbSgpIHx8ICEgaXNGaW5pdGUoIG51bWJlcl92YWx1ZSApICkge1xuXHRcdFx0JHJhbmdlLnZhbCggJzAnICk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0JHJhbmdlLnZhbCggU3RyaW5nKCBudW1iZXJfdmFsdWUgKSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvcHkgdGhlIGNvbnZlbmllbmNlIHNsaWRlciBpbnRvIHRoZSBhdXRob3JpdGF0aXZlIG51bWJlciBpbnB1dC5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHN5bmNocm9uaXplX2Nvc3RfY29ycmVjdGlvbl9udW1iZXIoKSB7XG5cdFx0dmFyICRudW1iZXJfZmllbGQgPSAkKCAnI3dwYmNfYWRkX2Jvb2tpbmdfY29zdF9jb3JyZWN0aW9uJyApO1xuXHRcdHZhciAkcmFuZ2UgPSAkKCAnLndwYmNfYWRkX2Jvb2tpbmdfX2Nvc3RfY29ycmVjdGlvbiBbZGF0YS13cGJjLWFkbWluLWNvc3QtY29ycmVjdGlvbi1yYW5nZT1cIjFcIl0nICkuZmlyc3QoKTtcblxuXHRcdGlmICggISAkbnVtYmVyX2ZpZWxkLmxlbmd0aCB8fCAhICRyYW5nZS5sZW5ndGggKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0JG51bWJlcl9maWVsZC52YWwoICRyYW5nZS52YWwoKSApLnRyaWdnZXIoICdpbnB1dCcgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBZGQgYW4gZXhwbGljaXRseSBlbnRlcmVkIGNvcnJlY3Rpb24gdG8gdGhlIG91dGdvaW5nIEFkZCBCb29raW5nIHJlcXVlc3QuXG5cdCAqXG5cdCAqIFRoZSBjb250cm9sIGlzIG91dHNpZGUgdGhlIEJvb2tpbmcgRm9ybSBlbGVtZW50IGFuZCB0aGVyZWZvcmUgaXMgbm90IHBhcnQgb2Zcblx0ICogdGhlIGxlZ2FjeSBzZXJpYWxpemVkIGZvcm0gZGF0YS4gVGhlIHNlcnZlciBhdXRob3JpemVzIGFuZCBub3JtYWxpemVzIHRoaXNcblx0ICogZGVkaWNhdGVkIHZhbHVlIGJlZm9yZSBpdCByZWFjaGVzIHRoZSBCdXNpbmVzcyBTbWFsbCBjb3N0IHBpcGVsaW5lLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCBqUXVlcnkgZXZlbnQuXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBTdWJtaXR0ZWQgQm9va2luZyByZXNvdXJjZSBJRC5cblx0ICogQHBhcmFtIHtPYmplY3R9IHBhcmFtcyBNdXRhYmxlIGJvb2tpbmctY3JlYXRlIHJlcXVlc3QgcGFyYW1ldGVycy5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGFkZF9jb3N0X2NvcnJlY3Rpb25fdG9fYm9va2luZ19yZXF1ZXN0KCBldmVudCwgcmVzb3VyY2VfaWQsIHBhcmFtcyApIHtcblx0XHR2YXIgbnVtYmVyX2ZpZWxkID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2FkZF9ib29raW5nX2Nvc3RfY29ycmVjdGlvbicgKTtcblx0XHR2YXIgcmF3X2Nvc3Q7XG5cblx0XHRpZiAoICEgcGFyYW1zIHx8ICEgbnVtYmVyX2ZpZWxkICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGRlbGV0ZSBwYXJhbXMud3BiY19hZG1pbl9jb3N0X2NvcnJlY3Rpb247XG5cdFx0cmF3X2Nvc3QgPSBTdHJpbmcoIG51bWJlcl9maWVsZC52YWx1ZSB8fCAnJyApLnRyaW0oKTtcblx0XHRpZiAoICcnID09PSByYXdfY29zdCB8fCAhIG51bWJlcl9maWVsZC5jaGVja1ZhbGlkaXR5KCkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cGFyYW1zLndwYmNfYWRtaW5fY29zdF9jb3JyZWN0aW9uID0gcmF3X2Nvc3Q7XG5cdH1cblxuXHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnLndwYmNfYWRkX2Jvb2tpbmdfX3JpZ2h0YmFyX3RhYnMgW3JvbGU9XCJ0YWJcIl0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0c3dpdGNoX3JpZ2h0X3BhbmVsKCAkKCB0aGlzICkgKTtcblx0fSApO1xuXG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19hZGRfYm9va2luZ19fc2V0dXBfc3VtbWFyeV9saW5rJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdG9wZW5fc2V0dGluZ3NfZ3JvdXAoICQoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLW9wZW4tZ3JvdXAnICksICQoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLWZvY3VzJyApIHx8ICcnICk7XG5cdH0gKTtcblxuXHQkKCBkb2N1bWVudCApLm9uKCAnY2hhbmdlJywgJyNpc19zZW5kX2VtYWlsX2Zvcl9wZW5kaW5nLCAjaXNfYWxsb3dfYm9va2luZ3NfaW5fcGFzdCcsIHJlZnJlc2hfYm9va2luZ190b29sc19zdW1tYXJ5ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdpbnB1dCcsICcjd3BiY19hZGRfYm9va2luZ19jb3N0X2NvcnJlY3Rpb24nLCBzeW5jaHJvbml6ZV9jb3N0X2NvcnJlY3Rpb25fcmFuZ2UgKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2lucHV0JywgJy53cGJjX2FkZF9ib29raW5nX19jb3N0X2NvcnJlY3Rpb24gW2RhdGEtd3BiYy1hZG1pbi1jb3N0LWNvcnJlY3Rpb24tcmFuZ2U9XCIxXCJdJywgc3luY2hyb25pemVfY29zdF9jb3JyZWN0aW9uX251bWJlciApO1xuXHQkKCAnYm9keScgKS5vbiggJ3dwYmNfYmVmb3JlX2Jvb2tpbmdfY3JlYXRlLndwYmNfYWRkX2Jvb2tpbmdfY29zdF9jb3JyZWN0aW9uJywgYWRkX2Nvc3RfY29ycmVjdGlvbl90b19ib29raW5nX3JlcXVlc3QgKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJ2lucHV0W25hbWU9XCJ3cGJjX2FkZF9ib29raW5nX2RheXNfc2VsZWN0aW9uX21vZGVcIl0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0YWN0aXZlX2RheXNfc2VsZWN0aW9uX292ZXJyaWRlID0gbm9ybWFsaXplX2RheXNfc2VsZWN0aW9uX21vZGUoICQoIHRoaXMgKS52YWwoKSApO1xuXHRcdGFwcGx5X2RheXNfc2VsZWN0aW9uX21vZGUoIGFjdGl2ZV9kYXlzX3NlbGVjdGlvbl9vdmVycmlkZSwgdHJ1ZSApO1xuXHRcdHNjaGVkdWxlX2RheXNfc2VsZWN0aW9uX3N5bmNocm9uaXphdGlvbigpO1xuXHR9ICk7XG5cdCQoIHJlZnJlc2hfYm9va2luZ190b29sc19zdW1tYXJ5ICk7XG5cdCQoIHN5bmNocm9uaXplX2Nvc3RfY29ycmVjdGlvbl9yYW5nZSApO1xuXHQkKCBzY2hlZHVsZV9kYXlzX3NlbGVjdGlvbl9zeW5jaHJvbml6YXRpb24gKTtcbn0oIGpRdWVyeSApICk7XG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDRSxXQUFXQSxDQUFDLEVBQUc7RUFDaEIsWUFBWTs7RUFFWixJQUFJQyw4QkFBOEIsR0FBRyxFQUFFO0VBQ3ZDLElBQUlDLGlDQUFpQyxHQUFHLEVBQUU7O0VBRTFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLGtCQUFrQkEsQ0FBRUMsSUFBSSxFQUFHO0lBQ25DLElBQUlDLFFBQVEsR0FBR0QsSUFBSSxDQUFDRSxJQUFJLENBQUUsZUFBZ0IsQ0FBQztJQUMzQyxJQUFJQyxLQUFLLEdBQUdILElBQUksQ0FBQ0ksT0FBTyxDQUFFLGtDQUFtQyxDQUFDLENBQUNDLElBQUksQ0FBRSxjQUFlLENBQUM7SUFDckYsSUFBSUMsT0FBTyxHQUFHVixDQUFDLENBQUUsNkJBQThCLENBQUMsQ0FBQ1MsSUFBSSxDQUFFLG1CQUFvQixDQUFDO0lBRTVFLElBQUssQ0FBRUosUUFBUSxJQUFJLENBQUVMLENBQUMsQ0FBRSxHQUFHLEdBQUdLLFFBQVMsQ0FBQyxDQUFDTSxNQUFNLEVBQUc7TUFDakQ7SUFDRDtJQUVBSixLQUFLLENBQUNELElBQUksQ0FBRSxlQUFlLEVBQUUsT0FBUSxDQUFDO0lBQ3RDRixJQUFJLENBQUNFLElBQUksQ0FBRSxlQUFlLEVBQUUsTUFBTyxDQUFDO0lBQ3BDSSxPQUFPLENBQUNKLElBQUksQ0FBRTtNQUFFTSxNQUFNLEVBQUUsSUFBSTtNQUFFLGFBQWEsRUFBRTtJQUFPLENBQUUsQ0FBQztJQUN2RFos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
