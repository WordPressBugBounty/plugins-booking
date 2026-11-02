"use strict";

/** Add Booking administrator inspector interactions. */
(function ($) {
  'use strict';

  var active_days_selection_override = '';
  var days_selection_enforcement_timers = [];
  var initial_calendar_dates_applied = false;
  var initial_calendar_dates_cancelled = false;
  var is_applying_initial_calendar_dates = false;
  var initial_calendar_dates_attempts = 0;
  var initial_calendar_dates_max_attempts = 12;
  var initial_calendar_dates_event = 'wpbc_calendar_ajx__loaded_data.wpbc_add_booking_initial_dates';

  /**
   * Normalize a JSON-safe list of ISO calendar dates.
   *
   * @param {*} calendar_dates Candidate date list.
   * @return {Array<string>} Unique valid dates in their original order.
   */
  function normalize_initial_calendar_dates(calendar_dates) {
    var normalized_dates = [];
    var seen_dates = {};
    if (!Array.isArray(calendar_dates)) {
      return normalized_dates;
    }
    calendar_dates.forEach(function (calendar_date) {
      var normalized_date = String(calendar_date || '');
      var date_parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized_date);
      var native_date;
      if (!date_parts) {
        return;
      }
      native_date = new Date(parseInt(date_parts[1], 10), parseInt(date_parts[2], 10) - 1, parseInt(date_parts[3], 10));
      if (native_date.getFullYear() !== parseInt(date_parts[1], 10) || native_date.getMonth() !== parseInt(date_parts[2], 10) - 1 || native_date.getDate() !== parseInt(date_parts[3], 10) || seen_dates[normalized_date]) {
        return;
      }
      seen_dates[normalized_date] = true;
      normalized_dates.push(normalized_date);
    });
    return normalized_dates;
  }

  /**
   * Convert one validated ISO date into a local JavaScript Date.
   *
   * @param {string} calendar_date Date in `Y-m-d` format.
   * @return {Date} Local calendar date.
   */
  function parse_initial_calendar_date(calendar_date) {
    var date_parts = calendar_date.split('-');
    return new Date(parseInt(date_parts[0], 10), parseInt(date_parts[1], 10) - 1, parseInt(date_parts[2], 10));
  }

  /**
   * Read the explicit one-time calendar seed from the rendered component.
   *
   * @return {Object|null} Normalized handoff context, or null outside a handoff.
   */
  function get_initial_calendar_context() {
    var component_context = window.wpbc_add_booking_component_context || {};
    var resource_id = parseInt(component_context.resource_id, 10);
    var initial_dates = normalize_initial_calendar_dates(component_context.initial_calendar_dates);
    if (1 !== parseInt(component_context.preselect_calendar_dates, 10) || resource_id <= 0 || !initial_dates.length) {
      return null;
    }
    return {
      resource_id: resource_id,
      initial_dates: initial_dates
    };
  }

  /**
   * Seed the normal native calendar once from signed Timeline handoff context.
   *
   * Direct instance synchronization avoids replaying clicks through stale
   * availability markup. It changes only the browser selection; the canonical
   * create endpoint remains authoritative for availability and persistence.
   *
   * @return {boolean} True after the exact initial selection was applied.
   */
  function apply_initial_calendar_dates() {
    var initial_context = get_initial_calendar_context();
    var calendar_instance;
    var native_dates;
    var $date_field;
    var formatted_dates;
    if (initial_calendar_dates_applied || initial_calendar_dates_cancelled || !initial_context) {
      return initial_calendar_dates_applied;
    }
    if ('function' !== typeof window.wpbc_calendar__get_inst || !$.datepick || 'function' !== typeof $.datepick._updateDatepick) {
      return false;
    }
    calendar_instance = window.wpbc_calendar__get_inst(initial_context.resource_id);
    $date_field = $('#date_booking' + initial_context.resource_id);
    if (!calendar_instance || !$date_field.length) {
      return false;
    }
    if (String($date_field.val() || '').trim()) {
      initial_calendar_dates_cancelled = true;
      $('body').off(initial_calendar_dates_event);
      return false;
    }
    native_dates = initial_context.initial_dates.map(parse_initial_calendar_date);
    formatted_dates = native_dates.map(function (selected_date) {
      if ('function' === typeof $.datepick._formatDate) {
        return $.datepick._formatDate(calendar_instance, selected_date);
      }
      return ('0' + selected_date.getDate()).slice(-2) + '.' + ('0' + (selected_date.getMonth() + 1)).slice(-2) + '.' + selected_date.getFullYear();
    }).join(', ');
    is_applying_initial_calendar_dates = true;
    calendar_instance.stayOpen = false;
    calendar_instance.dates = native_dates;
    $date_field.val(formatted_dates);
    $.datepick._updateDatepick(calendar_instance);
    if ('function' === typeof window.wpbc_calendar__scroll_to) {
      window.wpbc_calendar__scroll_to(initial_context.resource_id, native_dates[0].getFullYear(), native_dates[0].getMonth() + 1);
    }
    if ('function' === typeof window.wpbc_disable_time_fields_in_booking_form) {
      window.wpbc_disable_time_fields_in_booking_form(initial_context.resource_id);
    }
    initial_calendar_dates_applied = true;
    $('body').off(initial_calendar_dates_event);
    try {
      $('.booking_form_div').trigger('date_selected', [initial_context.resource_id, formatted_dates, initial_context.initial_dates.slice(0)]);
    } finally {
      is_applying_initial_calendar_dates = false;
    }
    return true;
  }

  /**
   * Retry initial hydration only while the matching native calendar mounts.
   *
   * @return {void}
   */
  function schedule_initial_calendar_dates() {
    if (initial_calendar_dates_applied || initial_calendar_dates_cancelled || !get_initial_calendar_context()) {
      return;
    }
    window.requestAnimationFrame(function () {
      initial_calendar_dates_attempts++;
      if (apply_initial_calendar_dates() || initial_calendar_dates_attempts >= initial_calendar_dates_max_attempts) {
        return;
      }
      window.setTimeout(schedule_initial_calendar_dates, 100);
    });
  }

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
   * Scroll one page-owned control into view and move keyboard focus to it.
   *
   * @param {string} focus_selector Control selector.
   * @return {void}
   */
  function focus_page_control(focus_selector) {
    var $control = focus_selector ? $(focus_selector).first() : $();
    if (!$control.length) {
      return;
    }
    window.requestAnimationFrame(function () {
      $control.get(0).scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      window.setTimeout(function () {
        $control.trigger('focus');
      }, 250);
    });
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
        focus_page_control(focus_selector);
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
    var group_name = $(this).attr('data-wpbc-add-booking-open-group') || '';
    var focus_selector = $(this).attr('data-wpbc-add-booking-focus') || '';
    event.preventDefault();
    if (group_name) {
      open_settings_group(group_name, focus_selector);
    } else {
      focus_page_control(focus_selector);
    }
  });
  $(document).on('change', '#is_send_email_for_pending, #is_allow_bookings_in_past', refresh_booking_tools_summary);
  $(document).on('date_selected.wpbc_add_booking_initial_dates', '.booking_form_div', function () {
    if (!is_applying_initial_calendar_dates && !initial_calendar_dates_applied) {
      initial_calendar_dates_cancelled = true;
      $('body').off(initial_calendar_dates_event);
    }
  });
  $('body').off(initial_calendar_dates_event).on(initial_calendar_dates_event, function (event, loaded_resource_id) {
    var initial_context = get_initial_calendar_context();
    if (initial_context && initial_context.resource_id === parseInt(loaded_resource_id, 10)) {
      schedule_initial_calendar_dates();
    }
  });
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
  $(schedule_initial_calendar_dates);
})(jQuery);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1hZGQtYm9va2luZy9fb3V0L2FkZF9ib29raW5nX3BhZ2UuanMiLCJuYW1lcyI6WyIkIiwiYWN0aXZlX2RheXNfc2VsZWN0aW9uX292ZXJyaWRlIiwiZGF5c19zZWxlY3Rpb25fZW5mb3JjZW1lbnRfdGltZXJzIiwiaW5pdGlhbF9jYWxlbmRhcl9kYXRlc19hcHBsaWVkIiwiaW5pdGlhbF9jYWxlbmRhcl9kYXRlc19jYW5jZWxsZWQiLCJpc19hcHBseWluZ19pbml0aWFsX2NhbGVuZGFyX2RhdGVzIiwiaW5pdGlhbF9jYWxlbmRhcl9kYXRlc19hdHRlbXB0cyIsImluaXRpYWxfY2FsZW5kYXJfZGF0ZXNfbWF4X2F0dGVtcHRzIiwiaW5pdGlhbF9jYWxlbmRhcl9kYXRlc19ldmVudCIsIm5vcm1hbGl6ZV9pbml0aWFsX2NhbGVuZGFyX2RhdGVzIiwiY2FsZW5kYXJfZGF0ZXMiLCJub3JtYWxpemVkX2RhdGVzIiwic2Vlbl9kYXRlcyIsIkFycmF5IiwiaXNBcnJheSIsImZvckVhY2giLCJjYWxlbmRhcl9kYXRlIiwibm9ybWFsaXplZF9kYXRlIiwiU3RyaW5nIiwiZGF0ZV9wYXJ0cyIsImV4ZWMiLCJuYXRpdmVfZGF0ZSIsIkRhdGUiLCJwYXJzZUludCIsImdldEZ1bGxZZWFyIiwiZ2V0TW9udGgiLCJnZXREYXRlIiwicHVzaCIsInBhcnNlX2luaXRpYWxfY2FsZW5kYXJfZGF0ZSIsInNwbGl0IiwiZ2V0X2luaXRpYWxfY2FsZW5kYXJfY29udGV4dCIsImNvbXBvbmVudF9jb250ZXh0Iiwid2luZG93Iiwid3BiY19hZGRfYm9va2luZ19jb21wb25lbnRfY29udGV4dCIsInJlc291cmNlX2lkIiwiaW5pdGlhbF9kYXRlcyIsImluaXRpYWxfY2FsZW5kYXJfZGF0ZXMiLCJwcmVzZWxlY3RfY2FsZW5kYXJfZGF0ZXMiLCJsZW5ndGgiLCJhcHBseV9pbml0aWFsX2NhbGVuZGFyX2RhdGVzIiwiaW5pdGlhbF9jb250ZXh0IiwiY2FsZW5kYXJfaW5zdGFuY2UiLCJuYXRpdmVfZGF0ZXMiLCIkZGF0ZV9maWVsZCIsImZvcm1hdHRlZF9kYXRlcyIsIndwYmNfY2FsZW5kYXJfX2dldF9pbnN0IiwiZGF0ZXBpY2siLCJfdXBkYXRlRGF0ZXBpY2siLCJ2YWwiLCJ0cmltIiwib2ZmIiwibWFwIiwic2VsZWN0ZWRfZGF0ZSIsIl9mb3JtYXREYXRlIiwic2xpY2UiLCJqb2luIiwic3RheU9wZW4iLCJkYXRlcyIsIndwYmNfY2FsZW5kYXJfX3Njcm9sbF90byIsIndwYmNfZGlzYWJsZV90aW1lX2ZpZWxkc19pbl9ib29raW5nX2Zvcm0iLCJ0cmlnZ2VyIiwic2NoZWR1bGVfaW5pdGlhbF9jYWxlbmRhcl9kYXRlcyIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsInNldFRpbWVvdXQiLCJzd2l0Y2hfcmlnaHRfcGFuZWwiLCIkdGFiIiwicGFuZWxfaWQiLCJhdHRyIiwiJHRhYnMiLCJjbG9zZXN0IiwiZmluZCIsIiRwYW5lbHMiLCJoaWRkZW4iLCJyZW1vdmVBdHRyIiwiZm9jdXNfcGFnZV9jb250cm9sIiwiZm9jdXNfc2VsZWN0b3IiLCIkY29udHJvbCIsImZpcnN0IiwiZ2V0Iiwic2Nyb2xsSW50b1ZpZXciLCJiZWhhdmlvciIsImJsb2NrIiwib3Blbl9zZXR0aW5nc19ncm91cCIsImdyb3VwX25hbWUiLCIkZ3JvdXAiLCJyb290IiwiY29udHJvbGxlciIsIl9fd3BiY19jb2xsYXBzaWJsZV9pbnN0YW5jZSIsImV4cGFuZCIsInNpYmxpbmdzIiwiZWFjaCIsIiRzaWJsaW5nIiwicmVtb3ZlQ2xhc3MiLCJjaGlsZHJlbiIsImFkZENsYXNzIiwicmVmcmVzaF9ib29raW5nX3Rvb2xzX3N1bW1hcnkiLCIkc3VtbWFyeSIsImVuYWJsZWRfbGFiZWwiLCJkaXNhYmxlZF9sYWJlbCIsInRleHQiLCJpcyIsImdldF9kYXlzX3NlbGVjdGlvbl9jb250YWluZXIiLCJub3JtYWxpemVfZGF5c19zZWxlY3Rpb25fbW9kZSIsIm1vZGUiLCJnZXRfZGF5c19zZWxlY3Rpb25fcmVzb3VyY2VfaWQiLCJnZXRfY2FsZW5kYXJfcGFyYW1ldGVyIiwicGFyYW1ldGVyX25hbWUiLCJfd3BiYyIsImNhbGVuZGFyIiwiY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSIsIm5vcm1hbGl6ZV9jYWxlbmRhcl9udW1iZXJfbGlzdCIsInBhcmFtZXRlcl92YWx1ZSIsImZhbGxiYWNrX3ZhbHVlIiwidmFsdWVzIiwibm9ybWFsaXplZF92YWx1ZXMiLCJpbmRleCIsIm51bWJlcl92YWx1ZSIsInBhcnNlZF9udW1iZXIiLCJpc05hTiIsImdldF9yYW5nZV9lbmdpbmVfbW9kZSIsInJhbmdlX2VuZ2luZV9tb2RlIiwic3luY19kYXlzX3NlbGVjdGlvbl9jb250cm9scyIsIm5vcm1hbGl6ZWRfbW9kZSIsIiRjb250YWluZXIiLCIkcmFkaW8iLCJtb2RlX2xhYmVsIiwicHJvcCIsImNsZWFyX3NlbGVjdGVkX2Jvb2tpbmdfZGF0ZXMiLCJ3cGJjX2NhbGVuZGFyX191bnNlbGVjdF9hbGxfZGF0ZXMiLCJhcHBseV9kYXlzX3NlbGVjdGlvbl9tb2RlIiwiY2xlYXJfZGF0ZXMiLCJkZXNpcmVkX2VuZ2luZV9tb2RlIiwiY3VycmVudF9lbmdpbmVfbW9kZSIsImZpeGVkX2RheXNfbnVtYmVyIiwid3BiY19jYWxfZGF5c19zZWxlY3RfX3NpbmdsZSIsIndwYmNfY2FsX2RheXNfc2VsZWN0X19tdWx0aXBsZSIsIndwYmNfY2FsX2RheXNfc2VsZWN0X19maXhlZCIsIndwYmNfY2FsX2RheXNfc2VsZWN0X19yYW5nZV9tb2RlIiwic3luY2hyb25pemVfZGF5c19zZWxlY3Rpb25fbW9kZSIsInNjaGVkdWxlX2RheXNfc2VsZWN0aW9uX3N5bmNocm9uaXphdGlvbiIsInRpbWVyX2lkIiwiY2xlYXJUaW1lb3V0IiwiZGVsYXkiLCJzeW5jaHJvbml6ZV9jb3N0X2NvcnJlY3Rpb25fcmFuZ2UiLCIkbnVtYmVyX2ZpZWxkIiwiJHJhbmdlIiwiTnVtYmVyIiwiaXNGaW5pdGUiLCJzeW5jaHJvbml6ZV9jb3N0X2NvcnJlY3Rpb25fbnVtYmVyIiwiYWRkX2Nvc3RfY29ycmVjdGlvbl90b19ib29raW5nX3JlcXVlc3QiLCJldmVudCIsInBhcmFtcyIsIm51bWJlcl9maWVsZCIsImRvY3VtZW50IiwiZ2V0RWxlbWVudEJ5SWQiLCJyYXdfY29zdCIsIndwYmNfYWRtaW5fY29zdF9jb3JyZWN0aW9uIiwidmFsdWUiLCJjaGVja1ZhbGlkaXR5Iiwib24iLCJwcmV2ZW50RGVmYXVsdCIsImxvYWRlZF9yZXNvdXJjZV9pZCIsImpRdWVyeSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtYWRkLWJvb2tpbmcvX3NyYy9hZGRfYm9va2luZ19wYWdlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKiBBZGQgQm9va2luZyBhZG1pbmlzdHJhdG9yIGluc3BlY3RvciBpbnRlcmFjdGlvbnMuICovXG4oIGZ1bmN0aW9uICggJCApIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdHZhciBhY3RpdmVfZGF5c19zZWxlY3Rpb25fb3ZlcnJpZGUgPSAnJztcblx0dmFyIGRheXNfc2VsZWN0aW9uX2VuZm9yY2VtZW50X3RpbWVycyA9IFtdO1xuXHR2YXIgaW5pdGlhbF9jYWxlbmRhcl9kYXRlc19hcHBsaWVkID0gZmFsc2U7XG5cdHZhciBpbml0aWFsX2NhbGVuZGFyX2RhdGVzX2NhbmNlbGxlZCA9IGZhbHNlO1xuXHR2YXIgaXNfYXBwbHlpbmdfaW5pdGlhbF9jYWxlbmRhcl9kYXRlcyA9IGZhbHNlO1xuXHR2YXIgaW5pdGlhbF9jYWxlbmRhcl9kYXRlc19hdHRlbXB0cyA9IDA7XG5cdHZhciBpbml0aWFsX2NhbGVuZGFyX2RhdGVzX21heF9hdHRlbXB0cyA9IDEyO1xuXHR2YXIgaW5pdGlhbF9jYWxlbmRhcl9kYXRlc19ldmVudCA9ICd3cGJjX2NhbGVuZGFyX2FqeF9fbG9hZGVkX2RhdGEud3BiY19hZGRfYm9va2luZ19pbml0aWFsX2RhdGVzJztcblxuXHQvKipcblx0ICogTm9ybWFsaXplIGEgSlNPTi1zYWZlIGxpc3Qgb2YgSVNPIGNhbGVuZGFyIGRhdGVzLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IGNhbGVuZGFyX2RhdGVzIENhbmRpZGF0ZSBkYXRlIGxpc3QuXG5cdCAqIEByZXR1cm4ge0FycmF5PHN0cmluZz59IFVuaXF1ZSB2YWxpZCBkYXRlcyBpbiB0aGVpciBvcmlnaW5hbCBvcmRlci5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9pbml0aWFsX2NhbGVuZGFyX2RhdGVzKCBjYWxlbmRhcl9kYXRlcyApIHtcblx0XHR2YXIgbm9ybWFsaXplZF9kYXRlcyA9IFtdO1xuXHRcdHZhciBzZWVuX2RhdGVzID0ge307XG5cblx0XHRpZiAoICEgQXJyYXkuaXNBcnJheSggY2FsZW5kYXJfZGF0ZXMgKSApIHtcblx0XHRcdHJldHVybiBub3JtYWxpemVkX2RhdGVzO1xuXHRcdH1cblxuXHRcdGNhbGVuZGFyX2RhdGVzLmZvckVhY2goIGZ1bmN0aW9uICggY2FsZW5kYXJfZGF0ZSApIHtcblx0XHRcdHZhciBub3JtYWxpemVkX2RhdGUgPSBTdHJpbmcoIGNhbGVuZGFyX2RhdGUgfHwgJycgKTtcblx0XHRcdHZhciBkYXRlX3BhcnRzID0gL14oXFxkezR9KS0oXFxkezJ9KS0oXFxkezJ9KSQvLmV4ZWMoIG5vcm1hbGl6ZWRfZGF0ZSApO1xuXHRcdFx0dmFyIG5hdGl2ZV9kYXRlO1xuXG5cdFx0XHRpZiAoICEgZGF0ZV9wYXJ0cyApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRuYXRpdmVfZGF0ZSA9IG5ldyBEYXRlKFxuXHRcdFx0XHRwYXJzZUludCggZGF0ZV9wYXJ0c1sxXSwgMTAgKSxcblx0XHRcdFx0cGFyc2VJbnQoIGRhdGVfcGFydHNbMl0sIDEwICkgLSAxLFxuXHRcdFx0XHRwYXJzZUludCggZGF0ZV9wYXJ0c1szXSwgMTAgKVxuXHRcdFx0KTtcblx0XHRcdGlmIChcblx0XHRcdFx0bmF0aXZlX2RhdGUuZ2V0RnVsbFllYXIoKSAhPT0gcGFyc2VJbnQoIGRhdGVfcGFydHNbMV0sIDEwICkgfHxcblx0XHRcdFx0bmF0aXZlX2RhdGUuZ2V0TW9udGgoKSAhPT0gcGFyc2VJbnQoIGRhdGVfcGFydHNbMl0sIDEwICkgLSAxIHx8XG5cdFx0XHRcdG5hdGl2ZV9kYXRlLmdldERhdGUoKSAhPT0gcGFyc2VJbnQoIGRhdGVfcGFydHNbM10sIDEwICkgfHxcblx0XHRcdFx0c2Vlbl9kYXRlc1sgbm9ybWFsaXplZF9kYXRlIF1cblx0XHRcdCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHNlZW5fZGF0ZXNbIG5vcm1hbGl6ZWRfZGF0ZSBdID0gdHJ1ZTtcblx0XHRcdG5vcm1hbGl6ZWRfZGF0ZXMucHVzaCggbm9ybWFsaXplZF9kYXRlICk7XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIG5vcm1hbGl6ZWRfZGF0ZXM7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydCBvbmUgdmFsaWRhdGVkIElTTyBkYXRlIGludG8gYSBsb2NhbCBKYXZhU2NyaXB0IERhdGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBjYWxlbmRhcl9kYXRlIERhdGUgaW4gYFktbS1kYCBmb3JtYXQuXG5cdCAqIEByZXR1cm4ge0RhdGV9IExvY2FsIGNhbGVuZGFyIGRhdGUuXG5cdCAqL1xuXHRmdW5jdGlvbiBwYXJzZV9pbml0aWFsX2NhbGVuZGFyX2RhdGUoIGNhbGVuZGFyX2RhdGUgKSB7XG5cdFx0dmFyIGRhdGVfcGFydHMgPSBjYWxlbmRhcl9kYXRlLnNwbGl0KCAnLScgKTtcblxuXHRcdHJldHVybiBuZXcgRGF0ZShcblx0XHRcdHBhcnNlSW50KCBkYXRlX3BhcnRzWzBdLCAxMCApLFxuXHRcdFx0cGFyc2VJbnQoIGRhdGVfcGFydHNbMV0sIDEwICkgLSAxLFxuXHRcdFx0cGFyc2VJbnQoIGRhdGVfcGFydHNbMl0sIDEwIClcblx0XHQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlYWQgdGhlIGV4cGxpY2l0IG9uZS10aW1lIGNhbGVuZGFyIHNlZWQgZnJvbSB0aGUgcmVuZGVyZWQgY29tcG9uZW50LlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gTm9ybWFsaXplZCBoYW5kb2ZmIGNvbnRleHQsIG9yIG51bGwgb3V0c2lkZSBhIGhhbmRvZmYuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfaW5pdGlhbF9jYWxlbmRhcl9jb250ZXh0KCkge1xuXHRcdHZhciBjb21wb25lbnRfY29udGV4dCA9IHdpbmRvdy53cGJjX2FkZF9ib29raW5nX2NvbXBvbmVudF9jb250ZXh0IHx8IHt9O1xuXHRcdHZhciByZXNvdXJjZV9pZCA9IHBhcnNlSW50KCBjb21wb25lbnRfY29udGV4dC5yZXNvdXJjZV9pZCwgMTAgKTtcblx0XHR2YXIgaW5pdGlhbF9kYXRlcyA9IG5vcm1hbGl6ZV9pbml0aWFsX2NhbGVuZGFyX2RhdGVzKCBjb21wb25lbnRfY29udGV4dC5pbml0aWFsX2NhbGVuZGFyX2RhdGVzICk7XG5cblx0XHRpZiAoIDEgIT09IHBhcnNlSW50KCBjb21wb25lbnRfY29udGV4dC5wcmVzZWxlY3RfY2FsZW5kYXJfZGF0ZXMsIDEwICkgfHwgcmVzb3VyY2VfaWQgPD0gMCB8fCAhIGluaXRpYWxfZGF0ZXMubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlc291cmNlX2lkOiByZXNvdXJjZV9pZCxcblx0XHRcdGluaXRpYWxfZGF0ZXM6IGluaXRpYWxfZGF0ZXNcblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIFNlZWQgdGhlIG5vcm1hbCBuYXRpdmUgY2FsZW5kYXIgb25jZSBmcm9tIHNpZ25lZCBUaW1lbGluZSBoYW5kb2ZmIGNvbnRleHQuXG5cdCAqXG5cdCAqIERpcmVjdCBpbnN0YW5jZSBzeW5jaHJvbml6YXRpb24gYXZvaWRzIHJlcGxheWluZyBjbGlja3MgdGhyb3VnaCBzdGFsZVxuXHQgKiBhdmFpbGFiaWxpdHkgbWFya3VwLiBJdCBjaGFuZ2VzIG9ubHkgdGhlIGJyb3dzZXIgc2VsZWN0aW9uOyB0aGUgY2Fub25pY2FsXG5cdCAqIGNyZWF0ZSBlbmRwb2ludCByZW1haW5zIGF1dGhvcml0YXRpdmUgZm9yIGF2YWlsYWJpbGl0eSBhbmQgcGVyc2lzdGVuY2UuXG5cdCAqXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgYWZ0ZXIgdGhlIGV4YWN0IGluaXRpYWwgc2VsZWN0aW9uIHdhcyBhcHBsaWVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gYXBwbHlfaW5pdGlhbF9jYWxlbmRhcl9kYXRlcygpIHtcblx0XHR2YXIgaW5pdGlhbF9jb250ZXh0ID0gZ2V0X2luaXRpYWxfY2FsZW5kYXJfY29udGV4dCgpO1xuXHRcdHZhciBjYWxlbmRhcl9pbnN0YW5jZTtcblx0XHR2YXIgbmF0aXZlX2RhdGVzO1xuXHRcdHZhciAkZGF0ZV9maWVsZDtcblx0XHR2YXIgZm9ybWF0dGVkX2RhdGVzO1xuXG5cdFx0aWYgKCBpbml0aWFsX2NhbGVuZGFyX2RhdGVzX2FwcGxpZWQgfHwgaW5pdGlhbF9jYWxlbmRhcl9kYXRlc19jYW5jZWxsZWQgfHwgISBpbml0aWFsX2NvbnRleHQgKSB7XG5cdFx0XHRyZXR1cm4gaW5pdGlhbF9jYWxlbmRhcl9kYXRlc19hcHBsaWVkO1xuXHRcdH1cblx0XHRpZiAoICdmdW5jdGlvbicgIT09IHR5cGVvZiB3aW5kb3cud3BiY19jYWxlbmRhcl9fZ2V0X2luc3QgfHwgISAkLmRhdGVwaWNrIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiAkLmRhdGVwaWNrLl91cGRhdGVEYXRlcGljayApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjYWxlbmRhcl9pbnN0YW5jZSA9IHdpbmRvdy53cGJjX2NhbGVuZGFyX19nZXRfaW5zdCggaW5pdGlhbF9jb250ZXh0LnJlc291cmNlX2lkICk7XG5cdFx0JGRhdGVfZmllbGQgPSAkKCAnI2RhdGVfYm9va2luZycgKyBpbml0aWFsX2NvbnRleHQucmVzb3VyY2VfaWQgKTtcblx0XHRpZiAoICEgY2FsZW5kYXJfaW5zdGFuY2UgfHwgISAkZGF0ZV9maWVsZC5sZW5ndGggKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKCBTdHJpbmcoICRkYXRlX2ZpZWxkLnZhbCgpIHx8ICcnICkudHJpbSgpICkge1xuXHRcdFx0aW5pdGlhbF9jYWxlbmRhcl9kYXRlc19jYW5jZWxsZWQgPSB0cnVlO1xuXHRcdFx0JCggJ2JvZHknICkub2ZmKCBpbml0aWFsX2NhbGVuZGFyX2RhdGVzX2V2ZW50ICk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0bmF0aXZlX2RhdGVzID0gaW5pdGlhbF9jb250ZXh0LmluaXRpYWxfZGF0ZXMubWFwKCBwYXJzZV9pbml0aWFsX2NhbGVuZGFyX2RhdGUgKTtcblx0XHRmb3JtYXR0ZWRfZGF0ZXMgPSBuYXRpdmVfZGF0ZXMubWFwKCBmdW5jdGlvbiAoIHNlbGVjdGVkX2RhdGUgKSB7XG5cdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiAkLmRhdGVwaWNrLl9mb3JtYXREYXRlICkge1xuXHRcdFx0XHRyZXR1cm4gJC5kYXRlcGljay5fZm9ybWF0RGF0ZSggY2FsZW5kYXJfaW5zdGFuY2UsIHNlbGVjdGVkX2RhdGUgKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuICggJzAnICsgc2VsZWN0ZWRfZGF0ZS5nZXREYXRlKCkgKS5zbGljZSggLTIgKSArICcuJyArXG5cdFx0XHRcdCggJzAnICsgKCBzZWxlY3RlZF9kYXRlLmdldE1vbnRoKCkgKyAxICkgKS5zbGljZSggLTIgKSArICcuJyArXG5cdFx0XHRcdHNlbGVjdGVkX2RhdGUuZ2V0RnVsbFllYXIoKTtcblx0XHR9ICkuam9pbiggJywgJyApO1xuXG5cdFx0aXNfYXBwbHlpbmdfaW5pdGlhbF9jYWxlbmRhcl9kYXRlcyA9IHRydWU7XG5cdFx0Y2FsZW5kYXJfaW5zdGFuY2Uuc3RheU9wZW4gPSBmYWxzZTtcblx0XHRjYWxlbmRhcl9pbnN0YW5jZS5kYXRlcyA9IG5hdGl2ZV9kYXRlcztcblx0XHQkZGF0ZV9maWVsZC52YWwoIGZvcm1hdHRlZF9kYXRlcyApO1xuXHRcdCQuZGF0ZXBpY2suX3VwZGF0ZURhdGVwaWNrKCBjYWxlbmRhcl9pbnN0YW5jZSApO1xuXG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfY2FsZW5kYXJfX3Njcm9sbF90byApIHtcblx0XHRcdHdpbmRvdy53cGJjX2NhbGVuZGFyX19zY3JvbGxfdG8oXG5cdFx0XHRcdGluaXRpYWxfY29udGV4dC5yZXNvdXJjZV9pZCxcblx0XHRcdFx0bmF0aXZlX2RhdGVzWzBdLmdldEZ1bGxZZWFyKCksXG5cdFx0XHRcdG5hdGl2ZV9kYXRlc1swXS5nZXRNb250aCgpICsgMVxuXHRcdFx0KTtcblx0XHR9XG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfZGlzYWJsZV90aW1lX2ZpZWxkc19pbl9ib29raW5nX2Zvcm0gKSB7XG5cdFx0XHR3aW5kb3cud3BiY19kaXNhYmxlX3RpbWVfZmllbGRzX2luX2Jvb2tpbmdfZm9ybSggaW5pdGlhbF9jb250ZXh0LnJlc291cmNlX2lkICk7XG5cdFx0fVxuXG5cdFx0aW5pdGlhbF9jYWxlbmRhcl9kYXRlc19hcHBsaWVkID0gdHJ1ZTtcblx0XHQkKCAnYm9keScgKS5vZmYoIGluaXRpYWxfY2FsZW5kYXJfZGF0ZXNfZXZlbnQgKTtcblx0XHR0cnkge1xuXHRcdFx0JCggJy5ib29raW5nX2Zvcm1fZGl2JyApLnRyaWdnZXIoXG5cdFx0XHRcdCdkYXRlX3NlbGVjdGVkJyxcblx0XHRcdFx0WyBpbml0aWFsX2NvbnRleHQucmVzb3VyY2VfaWQsIGZvcm1hdHRlZF9kYXRlcywgaW5pdGlhbF9jb250ZXh0LmluaXRpYWxfZGF0ZXMuc2xpY2UoIDAgKSBdXG5cdFx0XHQpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRpc19hcHBseWluZ19pbml0aWFsX2NhbGVuZGFyX2RhdGVzID0gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvKipcblx0ICogUmV0cnkgaW5pdGlhbCBoeWRyYXRpb24gb25seSB3aGlsZSB0aGUgbWF0Y2hpbmcgbmF0aXZlIGNhbGVuZGFyIG1vdW50cy5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHNjaGVkdWxlX2luaXRpYWxfY2FsZW5kYXJfZGF0ZXMoKSB7XG5cdFx0aWYgKCBpbml0aWFsX2NhbGVuZGFyX2RhdGVzX2FwcGxpZWQgfHwgaW5pdGlhbF9jYWxlbmRhcl9kYXRlc19jYW5jZWxsZWQgfHwgISBnZXRfaW5pdGlhbF9jYWxlbmRhcl9jb250ZXh0KCkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZnVuY3Rpb24gKCkge1xuXHRcdFx0aW5pdGlhbF9jYWxlbmRhcl9kYXRlc19hdHRlbXB0cysrO1xuXHRcdFx0aWYgKCBhcHBseV9pbml0aWFsX2NhbGVuZGFyX2RhdGVzKCkgfHwgaW5pdGlhbF9jYWxlbmRhcl9kYXRlc19hdHRlbXB0cyA+PSBpbml0aWFsX2NhbGVuZGFyX2RhdGVzX21heF9hdHRlbXB0cyApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR3aW5kb3cuc2V0VGltZW91dCggc2NoZWR1bGVfaW5pdGlhbF9jYWxlbmRhcl9kYXRlcywgMTAwICk7XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFNob3cgdGhlIHBhbmVsIGNvbnRyb2xsZWQgYnkgb25lIGNvbXBhY3QgcmlnaHQtc2lkZWJhciB0YWIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7alF1ZXJ5fSAkdGFiIFNlbGVjdGVkIHRhYiBidXR0b24uXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzd2l0Y2hfcmlnaHRfcGFuZWwoICR0YWIgKSB7XG5cdFx0dmFyIHBhbmVsX2lkID0gJHRhYi5hdHRyKCAnYXJpYS1jb250cm9scycgKTtcblx0XHR2YXIgJHRhYnMgPSAkdGFiLmNsb3Nlc3QoICcud3BiY19hZGRfYm9va2luZ19fcmlnaHRiYXJfdGFicycgKS5maW5kKCAnW3JvbGU9XCJ0YWJcIl0nICk7XG5cdFx0dmFyICRwYW5lbHMgPSAkKCAnLndwYmNfYWRkX2Jvb2tpbmdfX3JpZ2h0YmFyJyApLmZpbmQoICdbcm9sZT1cInRhYnBhbmVsXCJdJyApO1xuXG5cdFx0aWYgKCAhIHBhbmVsX2lkIHx8ICEgJCggJyMnICsgcGFuZWxfaWQgKS5sZW5ndGggKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0JHRhYnMuYXR0ciggJ2FyaWEtc2VsZWN0ZWQnLCAnZmFsc2UnICk7XG5cdFx0JHRhYi5hdHRyKCAnYXJpYS1zZWxlY3RlZCcsICd0cnVlJyApO1xuXHRcdCRwYW5lbHMuYXR0ciggeyBoaWRkZW46IHRydWUsICdhcmlhLWhpZGRlbic6ICd0cnVlJyB9ICk7XG5cdFx0JCggJyMnICsgcGFuZWxfaWQgKS5yZW1vdmVBdHRyKCAnaGlkZGVuJyApLmF0dHIoICdhcmlhLWhpZGRlbicsICdmYWxzZScgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTY3JvbGwgb25lIHBhZ2Utb3duZWQgY29udHJvbCBpbnRvIHZpZXcgYW5kIG1vdmUga2V5Ym9hcmQgZm9jdXMgdG8gaXQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBmb2N1c19zZWxlY3RvciBDb250cm9sIHNlbGVjdG9yLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gZm9jdXNfcGFnZV9jb250cm9sKCBmb2N1c19zZWxlY3RvciApIHtcblx0XHR2YXIgJGNvbnRyb2wgPSBmb2N1c19zZWxlY3RvciA/ICQoIGZvY3VzX3NlbGVjdG9yICkuZmlyc3QoKSA6ICQoKTtcblxuXHRcdGlmICggISAkY29udHJvbC5sZW5ndGggKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZnVuY3Rpb24gKCkge1xuXHRcdFx0JGNvbnRyb2wuZ2V0KCAwICkuc2Nyb2xsSW50b1ZpZXcoIHsgYmVoYXZpb3I6ICdzbW9vdGgnLCBibG9jazogJ2NlbnRlcicgfSApO1xuXHRcdFx0d2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0JGNvbnRyb2wudHJpZ2dlciggJ2ZvY3VzJyApO1xuXHRcdFx0fSwgMjUwICk7XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIEV4cGFuZCBhbiBpbnNwZWN0b3IgZ3JvdXAgYW5kIGZvY3VzIG9uZSBvZiBpdHMgY29udHJvbHMuXG5cdCAqXG5cdCAqIFRoZSBzaGFyZWQgY29sbGFwc2libGUgY29udHJvbGxlciBpcyB1c2VkIHdoZW4gYXZhaWxhYmxlIHNvIGV4Y2x1c2l2ZVxuXHQgKiBncm91cHMgYW5kIEFSSUEgc3RhdGUgc3RheSBzeW5jaHJvbml6ZWQuIFRoZSBoZWFkZXIgY2xpY2sgaXMgYSBzYWZlXG5cdCAqIGZhbGxiYWNrIGZvciBvbGRlciBCb29raW5nIENhbGVuZGFyIGFkbWluIGJ1bmRsZXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBncm91cF9uYW1lIEdyb3VwIGRhdGEga2V5LlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZm9jdXNfc2VsZWN0b3IgT3B0aW9uYWwgY29udHJvbCB0byBmb2N1cyBhZnRlciBleHBhbnNpb24uXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBvcGVuX3NldHRpbmdzX2dyb3VwKCBncm91cF9uYW1lLCBmb2N1c19zZWxlY3RvciApIHtcblx0XHR2YXIgJGdyb3VwID0gJCggJy53cGJjX2FkZF9ib29raW5nX19pbnNwZWN0b3Jfc2V0dGluZ3MgLndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwW2RhdGEtZ3JvdXA9XCInICsgZ3JvdXBfbmFtZSArICdcIl0nICkuZmlyc3QoKTtcblx0XHR2YXIgcm9vdDtcblx0XHR2YXIgY29udHJvbGxlcjtcblxuXHRcdGlmICggISAkZ3JvdXAubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJvb3QgPSAkZ3JvdXAuY2xvc2VzdCggJy53cGJjX2NvbGxhcHNpYmxlJyApLmdldCggMCApO1xuXHRcdGNvbnRyb2xsZXIgPSByb290ICYmIHJvb3QuX193cGJjX2NvbGxhcHNpYmxlX2luc3RhbmNlID8gcm9vdC5fX3dwYmNfY29sbGFwc2libGVfaW5zdGFuY2UgOiBudWxsO1xuXG5cdFx0aWYgKCBjb250cm9sbGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBjb250cm9sbGVyLmV4cGFuZCApIHtcblx0XHRcdGNvbnRyb2xsZXIuZXhwYW5kKCAkZ3JvdXAuZ2V0KCAwICkgKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0JGdyb3VwLnNpYmxpbmdzKCAnLndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0dmFyICRzaWJsaW5nID0gJCggdGhpcyApO1xuXG5cdFx0XHRcdCRzaWJsaW5nLnJlbW92ZUNsYXNzKCAnaXMtb3BlbicgKTtcblx0XHRcdFx0JHNpYmxpbmcuY2hpbGRyZW4oICcuZ3JvdXBfX2hlYWRlcicgKS5hdHRyKCAnYXJpYS1leHBhbmRlZCcsICdmYWxzZScgKTtcblx0XHRcdFx0JHNpYmxpbmcuY2hpbGRyZW4oICcuZ3JvdXBfX2ZpZWxkcycgKS5hdHRyKCB7IGhpZGRlbjogdHJ1ZSwgJ2FyaWEtaGlkZGVuJzogJ3RydWUnIH0gKTtcblx0XHRcdH0gKTtcblx0XHRcdCRncm91cC5hZGRDbGFzcyggJ2lzLW9wZW4nICk7XG5cdFx0XHQkZ3JvdXAuY2hpbGRyZW4oICcuZ3JvdXBfX2hlYWRlcicgKS5hdHRyKCAnYXJpYS1leHBhbmRlZCcsICd0cnVlJyApO1xuXHRcdFx0JGdyb3VwLmNoaWxkcmVuKCAnLmdyb3VwX19maWVsZHMnICkucmVtb3ZlQXR0ciggJ2hpZGRlbicgKS5hdHRyKCAnYXJpYS1oaWRkZW4nLCAnZmFsc2UnICk7XG5cdFx0fVxuXG5cdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZnVuY3Rpb24gKCkge1xuXHRcdFx0JGdyb3VwLmdldCggMCApLnNjcm9sbEludG9WaWV3KCB7IGJlaGF2aW9yOiAnc21vb3RoJywgYmxvY2s6ICdzdGFydCcgfSApO1xuXHRcdFx0aWYgKCBmb2N1c19zZWxlY3RvciApIHtcblx0XHRcdFx0Zm9jdXNfcGFnZV9jb250cm9sKCBmb2N1c19zZWxlY3RvciApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTeW5jaHJvbml6ZSBCb29raW5nIFRvb2xzIHN0YXR1cyBsaW5rcyB3aXRoIHRoZWlyIGN1cnJlbnQgdG9nZ2xlIHZhbHVlcy5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHJlZnJlc2hfYm9va2luZ190b29sc19zdW1tYXJ5KCkge1xuXHRcdHZhciAkc3VtbWFyeSA9ICQoICcud3BiY19hZGRfYm9va2luZ19fc2V0dXBfc3VtbWFyeScgKS5maXJzdCgpO1xuXHRcdHZhciBlbmFibGVkX2xhYmVsO1xuXHRcdHZhciBkaXNhYmxlZF9sYWJlbDtcblxuXHRcdGlmICggISAkc3VtbWFyeS5sZW5ndGggKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0ZW5hYmxlZF9sYWJlbCA9ICRzdW1tYXJ5LmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctZW5hYmxlZC1sYWJlbCcgKSB8fCAnRW5hYmxlZCc7XG5cdFx0ZGlzYWJsZWRfbGFiZWwgPSAkc3VtbWFyeS5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLWRpc2FibGVkLWxhYmVsJyApIHx8ICdEaXNhYmxlZCc7XG5cblx0XHQkc3VtbWFyeS5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy1zdW1tYXJ5PVwiZW1haWxzXCJdJyApLnRleHQoXG5cdFx0XHQkKCAnI2lzX3NlbmRfZW1haWxfZm9yX3BlbmRpbmcnICkuaXMoICc6Y2hlY2tlZCcgKSA/IGVuYWJsZWRfbGFiZWwgOiBkaXNhYmxlZF9sYWJlbFxuXHRcdCk7XG5cdFx0JHN1bW1hcnkuZmluZCggJ1tkYXRhLXdwYmMtYWRkLWJvb2tpbmctc3VtbWFyeT1cImFsbG93LXBhc3RcIl0nICkudGV4dChcblx0XHRcdCQoICcjaXNfYWxsb3dfYm9va2luZ3NfaW5fcGFzdCcgKS5pcyggJzpjaGVja2VkJyApID8gZW5hYmxlZF9sYWJlbCA6IGRpc2FibGVkX2xhYmVsXG5cdFx0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXQgdGhlIEFkZCBCb29raW5nIGRhdGUtc2VsZWN0aW9uIHJhZGlvIGNvbnRhaW5lci5cblx0ICpcblx0ICogQHJldHVybiB7alF1ZXJ5fSBEYXRlLXNlbGVjdGlvbiBjb250YWluZXIsIHdoZW4gcmVuZGVyZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfZGF5c19zZWxlY3Rpb25fY29udGFpbmVyKCkge1xuXHRcdHJldHVybiAkKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy1kYXlzLXNlbGVjdGlvbj1cIjFcIl0nICkuZmlyc3QoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBOb3JtYWxpemUgY2FsZW5kYXIgZW5naW5lIG1vZGVzIHRvIHRoZSB0aHJlZSBhZG1pbmlzdHJhdG9yIHJhZGlvIGNob2ljZXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBtb2RlIENhbGVuZGFyIG9yIHJhZGlvIG1vZGUuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gc2luZ2xlLCBtdWx0aXBsZSwgcmFuZ2UsIG9yIGFuIGVtcHR5IHN0cmluZy5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9kYXlzX3NlbGVjdGlvbl9tb2RlKCBtb2RlICkge1xuXHRcdG1vZGUgPSBTdHJpbmcoIG1vZGUgfHwgJycgKTtcblxuXHRcdGlmICggJ2ZpeGVkJyA9PT0gbW9kZSB8fCAnZHluYW1pYycgPT09IG1vZGUgfHwgJ3JhbmdlJyA9PT0gbW9kZSApIHtcblx0XHRcdHJldHVybiAncmFuZ2UnO1xuXHRcdH1cblxuXHRcdHJldHVybiAnc2luZ2xlJyA9PT0gbW9kZSB8fCAnbXVsdGlwbGUnID09PSBtb2RlID8gbW9kZSA6ICcnO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldCB0aGUgY3VycmVudCBBZGQgQm9va2luZyByZXNvdXJjZSBJRCBmcm9tIHRoZSByYWRpbyBjb250cm9sIGNvbnRleHQuXG5cdCAqXG5cdCAqIEByZXR1cm4ge251bWJlcn0gUG9zaXRpdmUgcmVzb3VyY2UgSUQsIG9yIHplcm8gd2hlbiB1bmF2YWlsYWJsZS5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9kYXlzX3NlbGVjdGlvbl9yZXNvdXJjZV9pZCgpIHtcblx0XHR2YXIgcmVzb3VyY2VfaWQgPSBwYXJzZUludCggZ2V0X2RheXNfc2VsZWN0aW9uX2NvbnRhaW5lcigpLmF0dHIoICdkYXRhLXdwYmMtcmVzb3VyY2UtaWQnICksIDEwICk7XG5cblx0XHRpZiAoICEgcmVzb3VyY2VfaWQgJiYgd2luZG93LndwYmNfYWRkX2Jvb2tpbmdfY29tcG9uZW50X2NvbnRleHQgKSB7XG5cdFx0XHRyZXNvdXJjZV9pZCA9IHBhcnNlSW50KCB3aW5kb3cud3BiY19hZGRfYm9va2luZ19jb21wb25lbnRfY29udGV4dC5yZXNvdXJjZV9pZCwgMTAgKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzb3VyY2VfaWQgPiAwID8gcmVzb3VyY2VfaWQgOiAwO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlYWQgb25lIGNhbGVuZGFyIHBhcmFtZXRlciB3aXRob3V0IGV4cG9zaW5nIHBhZ2Ugc3RhdGUgZ2xvYmFsbHkuXG5cdCAqXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBCb29raW5nIHJlc291cmNlIElELlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gcGFyYW1ldGVyX25hbWUgQ2FsZW5kYXIgcGFyYW1ldGVyIG5hbWUuXG5cdCAqIEByZXR1cm4geyp9IEN1cnJlbnQgcGFyYW1ldGVyIHZhbHVlLCBvciBudWxsIHdoZW4gdGhlIGNhbGVuZGFyIGlzIHVuYXZhaWxhYmxlLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2NhbGVuZGFyX3BhcmFtZXRlciggcmVzb3VyY2VfaWQsIHBhcmFtZXRlcl9uYW1lICkge1xuXHRcdGlmICggISB3aW5kb3cuX3dwYmMgfHwgISB3aW5kb3cuX3dwYmMuY2FsZW5kYXIgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy5fd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHdpbmRvdy5fd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgcGFyYW1ldGVyX25hbWUgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBOb3JtYWxpemUgYW4gYXJyYXkgb3IgY29tbWEtc2VwYXJhdGVkIGNhbGVuZGFyIHBhcmFtZXRlciBpbnRvIGludGVnZXJzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0FycmF5fG51bWJlcnxzdHJpbmd9IHBhcmFtZXRlcl92YWx1ZSBDYWxlbmRhciBwYXJhbWV0ZXIgdmFsdWUuXG5cdCAqIEBwYXJhbSB7QXJyYXl9IGZhbGxiYWNrX3ZhbHVlIFZhbHVlIHJldHVybmVkIHdoZW4gbm8gdmFsaWQgbnVtYmVycyBleGlzdC5cblx0ICogQHJldHVybiB7QXJyYXl9IEludGVnZXIgdmFsdWVzLlxuXHQgKi9cblx0ZnVuY3Rpb24gbm9ybWFsaXplX2NhbGVuZGFyX251bWJlcl9saXN0KCBwYXJhbWV0ZXJfdmFsdWUsIGZhbGxiYWNrX3ZhbHVlICkge1xuXHRcdHZhciB2YWx1ZXMgPSBBcnJheS5pc0FycmF5KCBwYXJhbWV0ZXJfdmFsdWUgKSA/IHBhcmFtZXRlcl92YWx1ZSA6IFN0cmluZyggcGFyYW1ldGVyX3ZhbHVlIHx8ICcnICkuc3BsaXQoICcsJyApO1xuXHRcdHZhciBub3JtYWxpemVkX3ZhbHVlcyA9IFtdO1xuXG5cdFx0JC5lYWNoKCB2YWx1ZXMsIGZ1bmN0aW9uICggaW5kZXgsIG51bWJlcl92YWx1ZSApIHtcblx0XHRcdHZhciBwYXJzZWRfbnVtYmVyID0gcGFyc2VJbnQoIG51bWJlcl92YWx1ZSwgMTAgKTtcblxuXHRcdFx0aWYgKCAhIGlzTmFOKCBwYXJzZWRfbnVtYmVyICkgKSB7XG5cdFx0XHRcdG5vcm1hbGl6ZWRfdmFsdWVzLnB1c2goIHBhcnNlZF9udW1iZXIgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gbm9ybWFsaXplZF92YWx1ZXMubGVuZ3RoID8gbm9ybWFsaXplZF92YWx1ZXMgOiBmYWxsYmFja192YWx1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXQgdGhlIGZpeGVkL2R5bmFtaWMgZW5naW5lIHRvIHVzZSBmb3IgdGhlIFJhbmdlIGRheXMgcmFkaW8gY2hvaWNlLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IGZpeGVkIG9yIGR5bmFtaWMuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfcmFuZ2VfZW5naW5lX21vZGUoKSB7XG5cdFx0dmFyIHJhbmdlX2VuZ2luZV9tb2RlID0gU3RyaW5nKCBnZXRfZGF5c19zZWxlY3Rpb25fY29udGFpbmVyKCkuYXR0ciggJ2RhdGEtd3BiYy1yYW5nZS1lbmdpbmUtbW9kZScgKSB8fCAnZHluYW1pYycgKTtcblxuXHRcdHJldHVybiAnZml4ZWQnID09PSByYW5nZV9lbmdpbmVfbW9kZSA/ICdmaXhlZCcgOiAnZHluYW1pYyc7XG5cdH1cblxuXHQvKipcblx0ICogVXBkYXRlIHRoZSBjaGVja2VkIHJhZGlvIGFuZCB2aXNpYmxlIHNldHVwIHN1bW1hcnkgZnJvbSBhbiBlZmZlY3RpdmUgbW9kZS5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IG1vZGUgQ2FsZW5kYXIgb3IgcmFkaW8gbW9kZS5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHN5bmNfZGF5c19zZWxlY3Rpb25fY29udHJvbHMoIG1vZGUgKSB7XG5cdFx0dmFyIG5vcm1hbGl6ZWRfbW9kZSA9IG5vcm1hbGl6ZV9kYXlzX3NlbGVjdGlvbl9tb2RlKCBtb2RlICk7XG5cdFx0dmFyICRjb250YWluZXIgPSBnZXRfZGF5c19zZWxlY3Rpb25fY29udGFpbmVyKCk7XG5cdFx0dmFyICRyYWRpbztcblx0XHR2YXIgbW9kZV9sYWJlbDtcblxuXHRcdGlmICggISBub3JtYWxpemVkX21vZGUgfHwgISAkY29udGFpbmVyLmxlbmd0aCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQkcmFkaW8gPSAkY29udGFpbmVyLmZpbmQoICdpbnB1dFtuYW1lPVwid3BiY19hZGRfYm9va2luZ19kYXlzX3NlbGVjdGlvbl9tb2RlXCJdW3ZhbHVlPVwiJyArIG5vcm1hbGl6ZWRfbW9kZSArICdcIl0nICk7XG5cdFx0aWYgKCAxICE9PSAkcmFkaW8ubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdCRyYWRpby5wcm9wKCAnY2hlY2tlZCcsIHRydWUgKTtcblx0XHRtb2RlX2xhYmVsID0gJHJhZGlvLmF0dHIoICdkYXRhLXdwYmMtZGF5cy1zZWxlY3Rpb24tbGFiZWwnICkgfHwgbm9ybWFsaXplZF9tb2RlO1xuXHRcdCQoICdbZGF0YS13cGJjLWFkZC1ib29raW5nLXN1bW1hcnk9XCJkYXlzLXNlbGVjdGlvblwiXScgKS50ZXh0KCBtb2RlX2xhYmVsICk7XG5cdH1cblxuXHQvKipcblx0ICogQ2xlYXIgc2VsZWN0ZWQgZGF0ZXMgYmVmb3JlIGNoYW5naW5nIHRoZWlyIHNlbGVjdGlvbiBzZW1hbnRpY3MuXG5cdCAqXG5cdCAqIEN1c3RvbWVyIGZpZWxkcyByZW1haW4gdW50b3VjaGVkLiBFeGlzdGluZyBjYWxlbmRhciBoZWxwZXJzIGFyZSB1c2VkIHdoZW5cblx0ICogYXZhaWxhYmxlIHNvIERhdGVwaWNrIHN0YXRlIGFuZCB0aGUgaGlkZGVuIHNlbGVjdGVkLWRhdGUgZmllbGQgc3RheSBhbGlnbmVkLlxuXHQgKlxuXHQgKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgQm9va2luZyByZXNvdXJjZSBJRC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGNsZWFyX3NlbGVjdGVkX2Jvb2tpbmdfZGF0ZXMoIHJlc291cmNlX2lkICkge1xuXHRcdHZhciAkZGF0ZV9maWVsZCA9ICQoICcjZGF0ZV9ib29raW5nJyArIHJlc291cmNlX2lkICk7XG5cblx0XHRpZiAoICEgJGRhdGVfZmllbGQubGVuZ3RoIHx8ICEgU3RyaW5nKCAkZGF0ZV9maWVsZC52YWwoKSB8fCAnJyApLnRyaW0oKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19jYWxlbmRhcl9fdW5zZWxlY3RfYWxsX2RhdGVzICkge1xuXHRcdFx0d2luZG93LndwYmNfY2FsZW5kYXJfX3Vuc2VsZWN0X2FsbF9kYXRlcyggcmVzb3VyY2VfaWQgKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0JGRhdGVfZmllbGQudmFsKCAnJyApO1xuXHRcdH1cblxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX2Rpc2FibGVfdGltZV9maWVsZHNfaW5fYm9va2luZ19mb3JtICkge1xuXHRcdFx0d2luZG93LndwYmNfZGlzYWJsZV90aW1lX2ZpZWxkc19pbl9ib29raW5nX2Zvcm0oIHJlc291cmNlX2lkICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEFwcGx5IG9uZSByYWRpbyBtb2RlIHRocm91Z2ggdGhlIHNoYXJlZCBpbW1lZGlhdGUgY2FsZW5kYXIgaGVscGVycy5cblx0ICpcblx0ICogUmFuZ2UgbW9kZSByZXRhaW5zIHRoZSBjb25maWd1cmVkIGZpeGVkL2R5bmFtaWMgc3VidHlwZSBhbmQgaXRzIGV4aXN0aW5nXG5cdCAqIG51bWJlci1vZi1kYXlzIGFuZCB3ZWVrZGF5IHBhcmFtZXRlcnMuIE5vIHNldHRpbmdzIGFyZSBzYXZlZC5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IG1vZGUgUmVxdWVzdGVkIHJhZGlvIG1vZGUuXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gY2xlYXJfZGF0ZXMgV2hldGhlciBhbiBleGlzdGluZyBzZWxlY3Rpb24gbXVzdCBiZSBjbGVhcmVkLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIHJlcXVlc3RlZCBoZWxwZXIgd2FzIGFwcGxpZWQgb3IgYWxyZWFkeSBhY3RpdmUuXG5cdCAqL1xuXHRmdW5jdGlvbiBhcHBseV9kYXlzX3NlbGVjdGlvbl9tb2RlKCBtb2RlLCBjbGVhcl9kYXRlcyApIHtcblx0XHR2YXIgbm9ybWFsaXplZF9tb2RlID0gbm9ybWFsaXplX2RheXNfc2VsZWN0aW9uX21vZGUoIG1vZGUgKTtcblx0XHR2YXIgcmVzb3VyY2VfaWQgPSBnZXRfZGF5c19zZWxlY3Rpb25fcmVzb3VyY2VfaWQoKTtcblx0XHR2YXIgZGVzaXJlZF9lbmdpbmVfbW9kZSA9ICdyYW5nZScgPT09IG5vcm1hbGl6ZWRfbW9kZSA/IGdldF9yYW5nZV9lbmdpbmVfbW9kZSgpIDogbm9ybWFsaXplZF9tb2RlO1xuXHRcdHZhciBjdXJyZW50X2VuZ2luZV9tb2RlO1xuXHRcdHZhciBmaXhlZF9kYXlzX251bWJlcjtcblxuXHRcdGlmICggISBub3JtYWxpemVkX21vZGUgfHwgISByZXNvdXJjZV9pZCApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjdXJyZW50X2VuZ2luZV9tb2RlID0gU3RyaW5nKCBnZXRfY2FsZW5kYXJfcGFyYW1ldGVyKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkgfHwgJycgKTtcblx0XHRpZiAoIGRlc2lyZWRfZW5naW5lX21vZGUgPT09IGN1cnJlbnRfZW5naW5lX21vZGUgKSB7XG5cdFx0XHRzeW5jX2RheXNfc2VsZWN0aW9uX2NvbnRyb2xzKCBub3JtYWxpemVkX21vZGUgKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdGlmICggY2xlYXJfZGF0ZXMgKSB7XG5cdFx0XHRjbGVhcl9zZWxlY3RlZF9ib29raW5nX2RhdGVzKCByZXNvdXJjZV9pZCApO1xuXHRcdH1cblxuXHRcdGlmICggJ3NpbmdsZScgPT09IG5vcm1hbGl6ZWRfbW9kZSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfY2FsX2RheXNfc2VsZWN0X19zaW5nbGUgKSB7XG5cdFx0XHR3aW5kb3cud3BiY19jYWxfZGF5c19zZWxlY3RfX3NpbmdsZSggcmVzb3VyY2VfaWQgKTtcblx0XHR9IGVsc2UgaWYgKCAnbXVsdGlwbGUnID09PSBub3JtYWxpemVkX21vZGUgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX2NhbF9kYXlzX3NlbGVjdF9fbXVsdGlwbGUgKSB7XG5cdFx0XHR3aW5kb3cud3BiY19jYWxfZGF5c19zZWxlY3RfX211bHRpcGxlKCByZXNvdXJjZV9pZCApO1xuXHRcdH0gZWxzZSBpZiAoICdyYW5nZScgPT09IG5vcm1hbGl6ZWRfbW9kZSAmJiAnZml4ZWQnID09PSBkZXNpcmVkX2VuZ2luZV9tb2RlICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19jYWxfZGF5c19zZWxlY3RfX2ZpeGVkICkge1xuXHRcdFx0Zml4ZWRfZGF5c19udW1iZXIgPSBwYXJzZUludCggZ2V0X2NhbGVuZGFyX3BhcmFtZXRlciggcmVzb3VyY2VfaWQsICdmaXhlZF9fZGF5c19udW0nICksIDEwICk7XG5cdFx0XHR3aW5kb3cud3BiY19jYWxfZGF5c19zZWxlY3RfX2ZpeGVkKFxuXHRcdFx0XHRyZXNvdXJjZV9pZCxcblx0XHRcdFx0Zml4ZWRfZGF5c19udW1iZXIgPiAwID8gZml4ZWRfZGF5c19udW1iZXIgOiAzLFxuXHRcdFx0XHRub3JtYWxpemVfY2FsZW5kYXJfbnVtYmVyX2xpc3QoIGdldF9jYWxlbmRhcl9wYXJhbWV0ZXIoIHJlc291cmNlX2lkLCAnZml4ZWRfX3dlZWtfZGF5c19fc3RhcnQnICksIFsgLTEgXSApXG5cdFx0XHQpO1xuXHRcdH0gZWxzZSBpZiAoICdyYW5nZScgPT09IG5vcm1hbGl6ZWRfbW9kZSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfY2FsX2RheXNfc2VsZWN0X19yYW5nZV9tb2RlICkge1xuXHRcdFx0d2luZG93LndwYmNfY2FsX2RheXNfc2VsZWN0X19yYW5nZV9tb2RlKCByZXNvdXJjZV9pZCApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0c3luY19kYXlzX3NlbGVjdGlvbl9jb250cm9scyggbm9ybWFsaXplZF9tb2RlICk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvKipcblx0ICogU3luY2hyb25pemUgY29udHJvbHMgd2l0aCB0aGUgY2FsZW5kYXIsIG9yIGVuZm9yY2UgYSB1c2VyLXNlbGVjdGVkIG92ZXJyaWRlLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY2hyb25pemVfZGF5c19zZWxlY3Rpb25fbW9kZSgpIHtcblx0XHR2YXIgcmVzb3VyY2VfaWQgPSBnZXRfZGF5c19zZWxlY3Rpb25fcmVzb3VyY2VfaWQoKTtcblx0XHR2YXIgY3VycmVudF9lbmdpbmVfbW9kZTtcblxuXHRcdGlmICggISByZXNvdXJjZV9pZCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIGFjdGl2ZV9kYXlzX3NlbGVjdGlvbl9vdmVycmlkZSApIHtcblx0XHRcdGFwcGx5X2RheXNfc2VsZWN0aW9uX21vZGUoIGFjdGl2ZV9kYXlzX3NlbGVjdGlvbl9vdmVycmlkZSwgZmFsc2UgKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjdXJyZW50X2VuZ2luZV9tb2RlID0gZ2V0X2NhbGVuZGFyX3BhcmFtZXRlciggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApO1xuXHRcdHN5bmNfZGF5c19zZWxlY3Rpb25fY29udHJvbHMoIGN1cnJlbnRfZW5naW5lX21vZGUgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZWNoZWNrIG1vZGUgYWZ0ZXIgdGhlIHNlbGVjdGVkIEJvb2tpbmcgRm9ybSdzIGxlZ2FjeSBkZWxheWVkIGluaXRpYWxpemVyLlxuXHQgKlxuXHQgKiBFeGlzdGluZyB0aW1lcnMgYXJlIGNhbmNlbGxlZCBzbyByZXBlYXRlZCBjbGlja3MgY2Fubm90IGFjY3VtdWxhdGUgd29yay5cblx0ICogUmVhcHBsaWNhdGlvbiBvY2N1cnMgb25seSB3aGVuIHRoZSBjYWxlbmRhciBlbmdpbmUgbW9kZSB3YXMgY2hhbmdlZCBieSBhXG5cdCAqIGxhdGVyIGluaXRpYWxpemVyLCBhdm9pZGluZyB1bm5lY2Vzc2FyeSBjYWxlbmRhciByZW5kZXJzLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2NoZWR1bGVfZGF5c19zZWxlY3Rpb25fc3luY2hyb25pemF0aW9uKCkge1xuXHRcdCQuZWFjaCggZGF5c19zZWxlY3Rpb25fZW5mb3JjZW1lbnRfdGltZXJzLCBmdW5jdGlvbiAoIGluZGV4LCB0aW1lcl9pZCApIHtcblx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIHRpbWVyX2lkICk7XG5cdFx0fSApO1xuXHRcdGRheXNfc2VsZWN0aW9uX2VuZm9yY2VtZW50X3RpbWVycyA9IFtdO1xuXG5cdFx0JC5lYWNoKCBbIDAsIDEyMCwgMTE1MCwgMjIwMCBdLCBmdW5jdGlvbiAoIGluZGV4LCBkZWxheSApIHtcblx0XHRcdGRheXNfc2VsZWN0aW9uX2VuZm9yY2VtZW50X3RpbWVycy5wdXNoKCB3aW5kb3cuc2V0VGltZW91dCggc3luY2hyb25pemVfZGF5c19zZWxlY3Rpb25fbW9kZSwgZGVsYXkgKSApO1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb3B5IHRoZSBhdXRob3JpdGF0aXZlIGNvc3QtY29ycmVjdGlvbiBudW1iZXIgaW50byBpdHMgY29udmVuaWVuY2Ugc2xpZGVyLlxuXHQgKlxuXHQgKiBUaGUgc2xpZGVyIGludGVudGlvbmFsbHkga2VlcHMgaXRzIDAtMTAwMCBleHBsb3JhdGlvbiByYW5nZS4gRXhhY3QgdmFsdWVzLFxuXHQgKiBpbmNsdWRpbmcgZGVjaW1hbHMgYW5kIHRvdGFscyBhYm92ZSAxMDAwLCByZW1haW4gdW5jaGFuZ2VkIGluIHRoZSBudW1iZXIgaW5wdXQuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzeW5jaHJvbml6ZV9jb3N0X2NvcnJlY3Rpb25fcmFuZ2UoKSB7XG5cdFx0dmFyICRudW1iZXJfZmllbGQgPSAkKCAnI3dwYmNfYWRkX2Jvb2tpbmdfY29zdF9jb3JyZWN0aW9uJyApO1xuXHRcdHZhciAkcmFuZ2UgPSAkKCAnLndwYmNfYWRkX2Jvb2tpbmdfX2Nvc3RfY29ycmVjdGlvbiBbZGF0YS13cGJjLWFkbWluLWNvc3QtY29ycmVjdGlvbi1yYW5nZT1cIjFcIl0nICkuZmlyc3QoKTtcblx0XHR2YXIgbnVtYmVyX3ZhbHVlO1xuXG5cdFx0aWYgKCAhICRudW1iZXJfZmllbGQubGVuZ3RoIHx8ICEgJHJhbmdlLmxlbmd0aCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRudW1iZXJfdmFsdWUgPSBOdW1iZXIoICRudW1iZXJfZmllbGQudmFsKCkgKTtcblx0XHRpZiAoICcnID09PSBTdHJpbmcoICRudW1iZXJfZmllbGQudmFsKCkgfHwgJycgKS50cmltKCkgfHwgISBpc0Zpbml0ZSggbnVtYmVyX3ZhbHVlICkgKSB7XG5cdFx0XHQkcmFuZ2UudmFsKCAnMCcgKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQkcmFuZ2UudmFsKCBTdHJpbmcoIG51bWJlcl92YWx1ZSApICk7XG5cdH1cblxuXHQvKipcblx0ICogQ29weSB0aGUgY29udmVuaWVuY2Ugc2xpZGVyIGludG8gdGhlIGF1dGhvcml0YXRpdmUgbnVtYmVyIGlucHV0LlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY2hyb25pemVfY29zdF9jb3JyZWN0aW9uX251bWJlcigpIHtcblx0XHR2YXIgJG51bWJlcl9maWVsZCA9ICQoICcjd3BiY19hZGRfYm9va2luZ19jb3N0X2NvcnJlY3Rpb24nICk7XG5cdFx0dmFyICRyYW5nZSA9ICQoICcud3BiY19hZGRfYm9va2luZ19fY29zdF9jb3JyZWN0aW9uIFtkYXRhLXdwYmMtYWRtaW4tY29zdC1jb3JyZWN0aW9uLXJhbmdlPVwiMVwiXScgKS5maXJzdCgpO1xuXG5cdFx0aWYgKCAhICRudW1iZXJfZmllbGQubGVuZ3RoIHx8ICEgJHJhbmdlLmxlbmd0aCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQkbnVtYmVyX2ZpZWxkLnZhbCggJHJhbmdlLnZhbCgpICkudHJpZ2dlciggJ2lucHV0JyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFkZCBhbiBleHBsaWNpdGx5IGVudGVyZWQgY29ycmVjdGlvbiB0byB0aGUgb3V0Z29pbmcgQWRkIEJvb2tpbmcgcmVxdWVzdC5cblx0ICpcblx0ICogVGhlIGNvbnRyb2wgaXMgb3V0c2lkZSB0aGUgQm9va2luZyBGb3JtIGVsZW1lbnQgYW5kIHRoZXJlZm9yZSBpcyBub3QgcGFydCBvZlxuXHQgKiB0aGUgbGVnYWN5IHNlcmlhbGl6ZWQgZm9ybSBkYXRhLiBUaGUgc2VydmVyIGF1dGhvcml6ZXMgYW5kIG5vcm1hbGl6ZXMgdGhpc1xuXHQgKiBkZWRpY2F0ZWQgdmFsdWUgYmVmb3JlIGl0IHJlYWNoZXMgdGhlIEJ1c2luZXNzIFNtYWxsIGNvc3QgcGlwZWxpbmUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50IGpRdWVyeSBldmVudC5cblx0ICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIFN1Ym1pdHRlZCBCb29raW5nIHJlc291cmNlIElELlxuXHQgKiBAcGFyYW0ge09iamVjdH0gcGFyYW1zIE11dGFibGUgYm9va2luZy1jcmVhdGUgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gYWRkX2Nvc3RfY29ycmVjdGlvbl90b19ib29raW5nX3JlcXVlc3QoIGV2ZW50LCByZXNvdXJjZV9pZCwgcGFyYW1zICkge1xuXHRcdHZhciBudW1iZXJfZmllbGQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYWRkX2Jvb2tpbmdfY29zdF9jb3JyZWN0aW9uJyApO1xuXHRcdHZhciByYXdfY29zdDtcblxuXHRcdGlmICggISBwYXJhbXMgfHwgISBudW1iZXJfZmllbGQgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0ZGVsZXRlIHBhcmFtcy53cGJjX2FkbWluX2Nvc3RfY29ycmVjdGlvbjtcblx0XHRyYXdfY29zdCA9IFN0cmluZyggbnVtYmVyX2ZpZWxkLnZhbHVlIHx8ICcnICkudHJpbSgpO1xuXHRcdGlmICggJycgPT09IHJhd19jb3N0IHx8ICEgbnVtYmVyX2ZpZWxkLmNoZWNrVmFsaWRpdHkoKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRwYXJhbXMud3BiY19hZG1pbl9jb3N0X2NvcnJlY3Rpb24gPSByYXdfY29zdDtcblx0fVxuXG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19hZGRfYm9va2luZ19fcmlnaHRiYXJfdGFicyBbcm9sZT1cInRhYlwiXScsIGZ1bmN0aW9uICgpIHtcblx0XHRzd2l0Y2hfcmlnaHRfcGFuZWwoICQoIHRoaXMgKSApO1xuXHR9ICk7XG5cblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJy53cGJjX2FkZF9ib29raW5nX19zZXR1cF9zdW1tYXJ5X2xpbmsnLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdHZhciBncm91cF9uYW1lID0gJCggdGhpcyApLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctb3Blbi1ncm91cCcgKSB8fCAnJztcblx0XHR2YXIgZm9jdXNfc2VsZWN0b3IgPSAkKCB0aGlzICkuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1mb2N1cycgKSB8fCAnJztcblxuXHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0aWYgKCBncm91cF9uYW1lICkge1xuXHRcdFx0b3Blbl9zZXR0aW5nc19ncm91cCggZ3JvdXBfbmFtZSwgZm9jdXNfc2VsZWN0b3IgKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Zm9jdXNfcGFnZV9jb250cm9sKCBmb2N1c19zZWxlY3RvciApO1xuXHRcdH1cblx0fSApO1xuXG5cdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnI2lzX3NlbmRfZW1haWxfZm9yX3BlbmRpbmcsICNpc19hbGxvd19ib29raW5nc19pbl9wYXN0JywgcmVmcmVzaF9ib29raW5nX3Rvb2xzX3N1bW1hcnkgKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2RhdGVfc2VsZWN0ZWQud3BiY19hZGRfYm9va2luZ19pbml0aWFsX2RhdGVzJywgJy5ib29raW5nX2Zvcm1fZGl2JywgZnVuY3Rpb24gKCkge1xuXHRcdGlmICggISBpc19hcHBseWluZ19pbml0aWFsX2NhbGVuZGFyX2RhdGVzICYmICEgaW5pdGlhbF9jYWxlbmRhcl9kYXRlc19hcHBsaWVkICkge1xuXHRcdFx0aW5pdGlhbF9jYWxlbmRhcl9kYXRlc19jYW5jZWxsZWQgPSB0cnVlO1xuXHRcdFx0JCggJ2JvZHknICkub2ZmKCBpbml0aWFsX2NhbGVuZGFyX2RhdGVzX2V2ZW50ICk7XG5cdFx0fVxuXHR9ICk7XG5cdCQoICdib2R5JyApLm9mZiggaW5pdGlhbF9jYWxlbmRhcl9kYXRlc19ldmVudCApLm9uKCBpbml0aWFsX2NhbGVuZGFyX2RhdGVzX2V2ZW50LCBmdW5jdGlvbiAoIGV2ZW50LCBsb2FkZWRfcmVzb3VyY2VfaWQgKSB7XG5cdFx0dmFyIGluaXRpYWxfY29udGV4dCA9IGdldF9pbml0aWFsX2NhbGVuZGFyX2NvbnRleHQoKTtcblxuXHRcdGlmICggaW5pdGlhbF9jb250ZXh0ICYmIGluaXRpYWxfY29udGV4dC5yZXNvdXJjZV9pZCA9PT0gcGFyc2VJbnQoIGxvYWRlZF9yZXNvdXJjZV9pZCwgMTAgKSApIHtcblx0XHRcdHNjaGVkdWxlX2luaXRpYWxfY2FsZW5kYXJfZGF0ZXMoKTtcblx0XHR9XG5cdH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2lucHV0JywgJyN3cGJjX2FkZF9ib29raW5nX2Nvc3RfY29ycmVjdGlvbicsIHN5bmNocm9uaXplX2Nvc3RfY29ycmVjdGlvbl9yYW5nZSApO1xuXHQkKCBkb2N1bWVudCApLm9uKCAnaW5wdXQnLCAnLndwYmNfYWRkX2Jvb2tpbmdfX2Nvc3RfY29ycmVjdGlvbiBbZGF0YS13cGJjLWFkbWluLWNvc3QtY29ycmVjdGlvbi1yYW5nZT1cIjFcIl0nLCBzeW5jaHJvbml6ZV9jb3N0X2NvcnJlY3Rpb25fbnVtYmVyICk7XG5cdCQoICdib2R5JyApLm9uKCAnd3BiY19iZWZvcmVfYm9va2luZ19jcmVhdGUud3BiY19hZGRfYm9va2luZ19jb3N0X2NvcnJlY3Rpb24nLCBhZGRfY29zdF9jb3JyZWN0aW9uX3RvX2Jvb2tpbmdfcmVxdWVzdCApO1xuXHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnaW5wdXRbbmFtZT1cIndwYmNfYWRkX2Jvb2tpbmdfZGF5c19zZWxlY3Rpb25fbW9kZVwiXScsIGZ1bmN0aW9uICgpIHtcblx0XHRhY3RpdmVfZGF5c19zZWxlY3Rpb25fb3ZlcnJpZGUgPSBub3JtYWxpemVfZGF5c19zZWxlY3Rpb25fbW9kZSggJCggdGhpcyApLnZhbCgpICk7XG5cdFx0YXBwbHlfZGF5c19zZWxlY3Rpb25fbW9kZSggYWN0aXZlX2RheXNfc2VsZWN0aW9uX292ZXJyaWRlLCB0cnVlICk7XG5cdFx0c2NoZWR1bGVfZGF5c19zZWxlY3Rpb25fc3luY2hyb25pemF0aW9uKCk7XG5cdH0gKTtcblx0JCggcmVmcmVzaF9ib29raW5nX3Rvb2xzX3N1bW1hcnkgKTtcblx0JCggc3luY2hyb25pemVfY29zdF9jb3JyZWN0aW9uX3JhbmdlICk7XG5cdCQoIHNjaGVkdWxlX2RheXNfc2VsZWN0aW9uX3N5bmNocm9uaXphdGlvbiApO1xuXHQkKCBzY2hlZHVsZV9pbml0aWFsX2NhbGVuZGFyX2RhdGVzICk7XG59KCBqUXVlcnkgKSApO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0UsV0FBV0EsQ0FBQyxFQUFHO0VBQ2hCLFlBQVk7O0VBRVosSUFB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
