"use strict";

/**
 * General Availability UI.
 */
(function ($, w) {
  'use strict';

  var cfg = w.wpbc_availability_general_page || {};
  var preview_timer = 0;
  var preview_frame = 0;
  var preview_ajax = null;
  var observer = null;
  var preview_unavailable_classes = 'wpbc_ag_preview_unavailable wpbc_ag_preview_weekday_unavailable wpbc_ag_preview_from_today_unavailable wpbc_ag_preview_limit_available_from_today wpbc_ag_preview_buffer_unavailable weekday_unavailable from_today_unavailable limit_available_from_today buffer_unavailable';
  function trim_text(value) {
    return String(value || '').trim();
  }
  function switch_panel($tab) {
    var panel_id = $tab.attr('aria-controls');
    var $tabs = $tab.closest('.wpbc_ag_rightbar_tabs').find('[role="tab"]');
    var $panels = $('.wpbc_ag_rightbar_panels [role="tabpanel"]');
    $tabs.attr('aria-selected', 'false');
    $tab.attr('aria-selected', 'true');
    $panels.attr('hidden', 'hidden').attr('aria-hidden', 'true');
    $('#' + panel_id).removeAttr('hidden').attr('aria-hidden', 'false');
  }
  function toggle_group($button) {
    var $group = $button.closest('.wpbc_ui__collapsible_group');
    var $fields = $group.find('> .group__fields');
    var is_open = $group.hasClass('is-open');
    $group.toggleClass('is-open', !is_open);
    $button.attr('aria-expanded', is_open ? 'false' : 'true');
    $fields.prop('hidden', is_open).attr('aria-hidden', is_open ? 'true' : 'false');
  }
  function close_group($group) {
    var $button = $group.find('> .group__header');
    var $fields = $group.find('> .group__fields');
    $group.removeClass('is-open');
    $button.attr('aria-expanded', 'false');
    $fields.prop('hidden', true).attr('aria-hidden', 'true');
  }
  function open_group(group_name, is_exclusive) {
    var $group = $('.wpbc_ui__collapsible_group[data-group="' + group_name + '"]');
    var $button = $group.find('> .group__header');
    var $fields = $group.find('> .group__fields');
    if (!$group.length) {
      return;
    }
    if (is_exclusive) {
      $group.siblings('.wpbc_ui__collapsible_group').each(function () {
        close_group($(this));
      });
    }
    $group.addClass('is-open');
    $button.attr('aria-expanded', 'true');
    $fields.prop('hidden', false).attr('aria-hidden', 'false');
  }
  function scroll_to_group(group_name) {
    var $group = $('.wpbc_ui__collapsible_group[data-group="' + group_name + '"]');
    var $scroll_parent;
    var scroll_top;
    if (!$group.length) {
      return;
    }
    $scroll_parent = $group.closest('.wpbc_ui_el__vert_right_bar__content, .wpbc_rightbar_palette, .wpbc_ag_rightbar_panels').first();
    if (!$scroll_parent.length) {
      $group.get(0).scrollIntoView({
        block: 'start'
      });
      return;
    }
    scroll_top = $scroll_parent.scrollTop() + $group.position().top - 10;
    $scroll_parent.stop().animate({
      scrollTop: Math.max(0, scroll_top)
    }, 180);
  }
  function apply_open_section_from_url() {
    if ('working_time' !== cfg.open_section) {
      return;
    }
    open_group('general-availability-working-time', true);
    setTimeout(function () {
      scroll_to_group('general-availability-working-time');
    }, 120);
  }
  function refresh_buffer_fields() {
    var value = $('input[name="booking_unavailable_extra_in_out"]:checked').val() || '';
    $('.wpbc_ag_buffer_fields').each(function () {
      var $panel = $(this);
      $panel.toggleClass('is-visible', $panel.data('buffer-panel') === value);
    });
  }
  function is_buffer_available() {
    return !(cfg.is_buffer_available === false || cfg.is_buffer_available === 'false' || cfg.is_buffer_available === 0 || cfg.is_buffer_available === '0');
  }
  function is_available_limit_available() {
    return !(cfg.is_available_limit_available === false || cfg.is_available_limit_available === 'false' || cfg.is_available_limit_available === 0 || cfg.is_available_limit_available === '0');
  }
  function sync_range_from_select(select) {
    var $select = $(select);
    var name = $select.attr('name');
    var selected_index = $select.prop('selectedIndex');
    var selected_text = trim_text($select.find('option:selected').text());
    var $range = $('[data-wpbc-ag-range-for="' + name + '"]');
    var $value = $('[data-wpbc-ag-range-value-for="' + name + '"]');
    if (!$range.length) {
      return;
    }
    $range.val(selected_index < 0 ? 0 : selected_index);
    $value.text(selected_text);
  }
  function sync_select_from_range(range) {
    var $range = $(range);
    var name = $range.attr('data-wpbc-ag-range-for');
    var $select = $('[name="' + name + '"]');
    var index = parseInt($range.val(), 10) || 0;
    if (!$select.length) {
      return;
    }
    $select.prop('selectedIndex', index);
    sync_range_from_select($select);
  }
  function sync_all_ranges() {
    $('[data-wpbc-ag-range-for]').each(function () {
      var name = $(this).attr('data-wpbc-ag-range-for');
      sync_range_from_select($('[name="' + name + '"]').first());
    });
  }
  function step_select_value(button) {
    var $button = $(button);
    var name = $button.attr('data-wpbc-ag-stepper');
    var step = parseInt($button.attr('data-step'), 10) || 0;
    var $select = $('[name="' + name + '"]').first();
    var current_index;
    var next_index;
    if (!$select.length || $select.prop('disabled')) {
      return;
    }
    current_index = $select.prop('selectedIndex');
    next_index = Math.max(0, Math.min($select.find('option').length - 1, current_index + step));
    if (next_index === current_index) {
      return;
    }
    $select.prop('selectedIndex', next_index).trigger('change');
  }
  function get_form() {
    return $('[data-wpbc-ag-settings-form="1"]').first();
  }
  function collect_settings() {
    var $form = get_form();
    var weekdays = [];
    $form.find('input[name="booking_unavailable_days[]"]:checked').each(function () {
      weekdays.push(parseInt(this.value, 10));
    });
    return {
      weekdays: weekdays,
      booking_unavailable_days_num_from_today: $form.find('[name="booking_unavailable_days_num_from_today"]').val() || '0',
      booking_available_days_num_from_today: $form.find('[name="booking_available_days_num_from_today"]').val() || '',
      booking_unavailable_extra_in_out: $form.find('[name="booking_unavailable_extra_in_out"]:checked').val() || '',
      booking_unavailable_extra_minutes_in: $form.find('[name="booking_unavailable_extra_minutes_in"]').val() || '',
      booking_unavailable_extra_minutes_out: $form.find('[name="booking_unavailable_extra_minutes_out"]').val() || '',
      booking_unavailable_extra_days_in: $form.find('[name="booking_unavailable_extra_days_in"]').val() || '',
      booking_unavailable_extra_days_out: $form.find('[name="booking_unavailable_extra_days_out"]').val() || '',
      working_time: get_working_time_settings_from_form()
    };
  }
  function set_select_value(name, value) {
    var $field = get_form().find('[name="' + name + '"]').first();
    if (!$field.length) {
      return;
    }
    $field.val(value);
    if (String($field.val()) !== String(value)) {
      $field.prop('selectedIndex', 0);
    }
  }
  function apply_settings_to_form(settings) {
    var $form = get_form();
    var weekdays = settings && settings.weekdays ? settings.weekdays : [];
    if (!$form.length || !settings) {
      return;
    }
    $form.find('input[name="booking_unavailable_days[]"]').prop('checked', false);
    $.each(weekdays, function (index, day_num) {
      $form.find('input[name="booking_unavailable_days[]"][value="' + parseInt(day_num, 10) + '"]').prop('checked', true);
    });
    set_select_value('booking_unavailable_days_num_from_today', settings.booking_unavailable_days_num_from_today || '0');
    set_select_value('booking_available_days_num_from_today', settings.booking_available_days_num_from_today || '');
    set_select_value('booking_unavailable_extra_minutes_in', settings.booking_unavailable_extra_minutes_in || '');
    set_select_value('booking_unavailable_extra_minutes_out', settings.booking_unavailable_extra_minutes_out || '');
    set_select_value('booking_unavailable_extra_days_in', settings.booking_unavailable_extra_days_in || '');
    set_select_value('booking_unavailable_extra_days_out', settings.booking_unavailable_extra_days_out || '');
    $form.find('input[name="booking_unavailable_extra_in_out"]').prop('checked', false);
    $form.find('input[name="booking_unavailable_extra_in_out"][value="' + (settings.booking_unavailable_extra_in_out || '') + '"]').prop('checked', true);
    apply_working_time_settings_to_form(settings.working_time || {}, $('#wpbc_ag_resource_id').val());
    refresh_buffer_fields();
    sync_all_ranges();
    schedule_preview_refresh();
  }
  function date_from_sql(sql_date) {
    var parts = String(sql_date || '').split('-');
    if (parts.length !== 3) {
      return null;
    }
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 0, 0, 0);
  }
  function get_today_date() {
    var arr = w._wpbc && typeof w._wpbc.get_other_param === 'function' ? w._wpbc.get_other_param('today_arr') : null;
    if (arr && arr.length >= 3) {
      return new Date(parseInt(arr[0], 10), parseInt(arr[1], 10) - 1, parseInt(arr[2], 10), 0, 0, 0);
    }
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  }
  function get_real_today_date() {
    var arr = w._wpbc && typeof w._wpbc.get_other_param === 'function' ? w._wpbc.get_other_param('time_local_arr') : null;
    if (arr && arr.length >= 3) {
      return new Date(parseInt(arr[0], 10), parseInt(arr[1], 10) - 1, parseInt(arr[2], 10), 0, 0, 0);
    }
    return get_today_date();
  }
  function days_between(date_a, date_b) {
    return Math.floor((date_a.getTime() - date_b.getTime()) / 86400000);
  }
  function add_days(date, days) {
    var shifted_date = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
    shifted_date.setDate(shifted_date.getDate() + days);
    return shifted_date;
  }
  function date_to_sql(date) {
    var month = String(date.getMonth() + 1);
    var day = String(date.getDate());
    if (month.length < 2) {
      month = '0' + month;
    }
    if (day.length < 2) {
      day = '0' + day;
    }
    return date.getFullYear() + '-' + month + '-' + day;
  }
  function get_sql_date_from_cell(cell) {
    var classes = String(cell.className || '').split(/\s+/);
    var i;
    for (i = 0; i < classes.length; i++) {
      if (classes[i].indexOf('sql_date_') === 0) {
        return classes[i].replace('sql_date_', '');
      }
    }
    return '';
  }
  function unavailable_from_today_applies(cell_date, today_date, value) {
    var minutes;
    var now;
    var unavailable_until;
    if (!value || value === '0') {
      return false;
    }
    if (/m$/.test(value)) {
      minutes = parseInt(value, 10);
      if (!minutes) {
        return false;
      }
      now = new Date();
      unavailable_until = new Date(now.getTime() + (minutes - 1) * 60000);
      unavailable_until = new Date(unavailable_until.getFullYear(), unavailable_until.getMonth(), unavailable_until.getDate(), 0, 0, 0);
      return cell_date.getTime() <= unavailable_until.getTime();
    }
    return days_between(cell_date, today_date) < parseInt(value, 10);
  }
  function get_option_text(selector) {
    var text = $(selector).find('option:selected').text();
    return trim_text(text);
  }
  function get_days_value(value) {
    if (!value || !/d$/.test(value)) {
      return 0;
    }
    return parseInt(value, 10) || 0;
  }
  function time_to_seconds(time) {
    var parts = String(time || '').split(':');
    var hours;
    var mins;
    if (parts.length < 2) {
      return 0;
    }
    hours = Math.max(0, Math.min(24, parseInt(parts[0], 10) || 0));
    mins = hours === 24 ? 0 : Math.max(0, Math.min(59, parseInt(parts[1], 10) || 0));
    return Math.min(86400, hours * 3600 + mins * 60);
  }
  function seconds_to_time(seconds) {
    var hours;
    var mins;
    seconds = Math.max(0, Math.min(86400, parseInt(seconds, 10) || 0));
    hours = Math.floor(seconds / 3600);
    mins = Math.floor(seconds % 3600 / 60);
    return (hours < 10 ? '0' : '') + hours + ':' + (mins < 10 ? '0' : '') + mins;
  }
  function collect_working_time_weekdays(prefix) {
    var $form = get_form();
    var weekdays = {};
    $form.find('[data-wpbc-working-time-weekdays="' + prefix + '"] .wpbc_ag_working_time_row').each(function () {
      var $row = $(this);
      var day = parseInt($row.find('input[type="checkbox"]').val(), 10);
      weekdays[day] = [];
      if (!$row.find('input[type="checkbox"]').prop('checked')) {
        return;
      }
      weekdays[day].push({
        start_second: time_to_seconds($row.find('.wpbc_ag_working_time_start').val()),
        end_second: time_to_seconds($row.find('.wpbc_ag_working_time_end').val())
      });
    });
    return weekdays;
  }
  function set_working_time_weekdays(prefix, weekdays) {
    var $wrap = get_form().find('[data-wpbc-working-time-weekdays="' + prefix + '"]');
    $wrap.find('.wpbc_ag_working_time_row').each(function () {
      var $row = $(this);
      var day = parseInt($row.find('input[type="checkbox"]').val(), 10);
      var intervals = weekdays && weekdays[day] ? weekdays[day] : [];
      var interval = intervals.length ? intervals[0] : {
        start_second: 32400,
        end_second: 64800
      };
      $row.find('input[type="checkbox"]').prop('checked', intervals.length > 0);
      $row.find('.wpbc_ag_working_time_start').val(seconds_to_time(interval.start_second));
      $row.find('.wpbc_ag_working_time_end').val(seconds_to_time(interval.end_second));
    });
  }
  function refresh_working_time_panels() {
    var is_enabled = get_form().find('input[name="booking_working_time_enabled"]').prop('checked');
    var mode = get_form().find('input[name="booking_working_time_resource_mode"]:checked').val() || 'inherit';
    get_form().find('.wpbc_ag_working_time_block').toggleClass('is-disabled', !is_enabled).find('input, select, button').prop('disabled', !is_enabled);
    get_form().find('[data-wpbc-working-time-resource-custom]').toggleClass('is-visible', mode === 'custom');
  }
  function get_working_time_settings_from_form() {
    var $form = get_form();
    var resourceId = parseInt($form.find('[data-wpbc-working-time-resource-id]').val(), 10) || parseInt($('#wpbc_ag_resource_id').val(), 10) || 0;
    var workingTime = $.extend(true, {}, cfg.settings && cfg.settings.working_time ? cfg.settings.working_time : cfg.default_settings && cfg.default_settings.working_time ? cfg.default_settings.working_time : {});
    if (!workingTime.default) {
      workingTime.default = {};
    }
    if (!workingTime.resources) {
      workingTime.resources = {};
    }
    workingTime.enabled = $form.find('input[name="booking_working_time_enabled"]').prop('checked') ? 'On' : 'Off';
    workingTime.default.weekdays = collect_working_time_weekdays('booking_working_time_default');
    if (resourceId > 0) {
      workingTime.resources[resourceId] = {
        mode: $form.find('input[name="booking_working_time_resource_mode"]:checked').val() || 'inherit',
        weekdays: collect_working_time_weekdays('booking_working_time_resource')
      };
    }
    return workingTime;
  }
  function apply_working_time_settings_to_form(workingTime, resourceId) {
    var resourceSettings;
    workingTime = workingTime || {};
    resourceId = parseInt(resourceId, 10) || parseInt($('#wpbc_ag_resource_id').val(), 10) || 0;
    resourceSettings = workingTime.resources && workingTime.resources[resourceId] ? workingTime.resources[resourceId] : {
      mode: 'inherit',
      weekdays: workingTime.default && workingTime.default.weekdays ? workingTime.default.weekdays : {}
    };
    get_form().find('input[name="booking_working_time_enabled"]').prop('checked', workingTime.enabled === 'On');
    get_form().find('[data-wpbc-working-time-resource-id]').val(resourceId);
    set_working_time_weekdays('booking_working_time_default', workingTime.default && workingTime.default.weekdays ? workingTime.default.weekdays : {});
    get_form().find('input[name="booking_working_time_resource_mode"][value="' + (resourceSettings.mode || 'inherit') + '"]').prop('checked', true);
    set_working_time_weekdays('booking_working_time_resource', resourceSettings.weekdays || (workingTime.default ? workingTime.default.weekdays : {}));
    refresh_working_time_panels();
  }
  function append_working_time_payload(payload) {
    var $form = get_form();
    var defaultDays = [];
    var resourceDays = [];
    var defaultStart = {};
    var defaultEnd = {};
    var resourceStart = {};
    var resourceEnd = {};
    $form.find('[data-wpbc-working-time-weekdays="booking_working_time_default"] .wpbc_ag_working_time_row').each(function () {
      var $row = $(this);
      var day = parseInt($row.find('input[type="checkbox"]').val(), 10);
      defaultStart[day] = $row.find('.wpbc_ag_working_time_start').val() || '09:00';
      defaultEnd[day] = $row.find('.wpbc_ag_working_time_end').val() || '18:00';
      if ($row.find('input[type="checkbox"]').prop('checked')) {
        defaultDays.push(day);
      }
    });
    $form.find('[data-wpbc-working-time-weekdays="booking_working_time_resource"] .wpbc_ag_working_time_row').each(function () {
      var $row = $(this);
      var day = parseInt($row.find('input[type="checkbox"]').val(), 10);
      resourceStart[day] = $row.find('.wpbc_ag_working_time_start').val() || '09:00';
      resourceEnd[day] = $row.find('.wpbc_ag_working_time_end').val() || '18:00';
      if ($row.find('input[type="checkbox"]').prop('checked')) {
        resourceDays.push(day);
      }
    });
    payload.booking_working_time_enabled = $form.find('input[name="booking_working_time_enabled"]').prop('checked') ? 'On' : '';
    payload.booking_working_time_resource_id = $form.find('[data-wpbc-working-time-resource-id]').val() || $('#wpbc_ag_resource_id').val() || '';
    payload.booking_working_time_resource_mode = $form.find('input[name="booking_working_time_resource_mode"]:checked').val() || 'inherit';
    payload.booking_working_time_default_days = defaultDays;
    payload.booking_working_time_default_start = defaultStart;
    payload.booking_working_time_default_end = defaultEnd;
    payload.booking_working_time_resource_days = resourceDays;
    payload.booking_working_time_resource_start = resourceStart;
    payload.booking_working_time_resource_end = resourceEnd;
  }
  function update_wpbc_preview_params(settings) {
    if (!w._wpbc || typeof w._wpbc.set_other_param !== 'function') {
      return;
    }
    w._wpbc.set_other_param('availability__week_days_unavailable', settings.weekdays.concat([999]));
    w._wpbc.set_other_param('availability__available_from_today', is_available_limit_available() ? settings.booking_available_days_num_from_today || '' : '');
    w._wpbc.set_other_param('availability__unavailable_from_today', settings.booking_unavailable_days_num_from_today || '0');
  }
  function update_buffer_preview_note(settings) {
    var $notes = $('[data-wpbc-ag-calendar-notes="1"]').first();
    var $calendar = $('[data-wpbc-ag-calendar-panel="1"]').first();
    var $note = $notes.find('.wpbc_ag_buffer_preview_note');
    var type = settings.booking_unavailable_extra_in_out || '';
    var before_text = '';
    var after_text = '';
    var message = '';
    if (!$notes.length || !$calendar.length) {
      return;
    }
    if (!$note.length) {
      $note = $('<div class="wpbc_ag_buffer_preview_note" aria-live="polite"></div>');
      $notes.append($note);
    }
    if (!is_buffer_available()) {
      $calendar.removeClass('wpbc_ag_preview_buffer_active');
      $note.attr('hidden', 'hidden');
      return;
    }
    $calendar.toggleClass('wpbc_ag_preview_buffer_active', !!type);
    if (type === 'm') {
      before_text = get_option_text('[name="booking_unavailable_extra_minutes_in"]') || '-';
      after_text = get_option_text('[name="booking_unavailable_extra_minutes_out"]') || '-';
    } else if (type === 'd') {
      before_text = get_option_text('[name="booking_unavailable_extra_days_in"]') || '-';
      after_text = get_option_text('[name="booking_unavailable_extra_days_out"]') || '-';
    }
    if (type) {
      message = '<strong>' + (cfg.i18n && cfg.i18n.buffer_preview ? cfg.i18n.buffer_preview : 'Buffer preview') + ':</strong> ' + (cfg.i18n && cfg.i18n.before_booking ? cfg.i18n.before_booking : 'Before booking') + ' ' + before_text + ' / ' + (cfg.i18n && cfg.i18n.after_booking ? cfg.i18n.after_booking : 'After booking') + ' ' + after_text;
      if ($note.html() !== message) {
        $note.html(message);
      }
      if ($note.attr('hidden')) {
        $note.removeAttr('hidden');
      }
    } else {
      message = cfg.i18n && cfg.i18n.no_buffer ? cfg.i18n.no_buffer : 'No booking buffer is selected.';
      if ($note.text() !== message) {
        $note.text(message);
      }
      if (!$note.attr('hidden')) {
        $note.attr('hidden', 'hidden');
      }
    }
  }
  function apply_buffer_days_preview(settings) {
    var $calendar = $('[data-wpbc-ag-calendar-panel="1"]');
    var before_days = get_days_value(settings.booking_unavailable_extra_days_in);
    var after_days = get_days_value(settings.booking_unavailable_extra_days_out);
    var date_cells = {};
    var booked_dates = [];
    if (!is_buffer_available()) {
      return;
    }
    if (settings.booking_unavailable_extra_in_out !== 'd' || !before_days && !after_days) {
      return;
    }
    $calendar.find('.datepick-days-cell').each(function () {
      var $cell = $(this);
      var sql_date = get_sql_date_from_cell(this);
      var cell_date;
      if (!sql_date) {
        return;
      }
      date_cells[sql_date] = $cell;
      if ($cell.hasClass('date_approved') || $cell.hasClass('date2approve')) {
        cell_date = date_from_sql(sql_date);
        if (cell_date) {
          booked_dates.push(cell_date);
        }
      }
    });
    $.each(booked_dates, function (index, booked_date) {
      var offset;
      var target_sql_date;
      var $target_cell;
      for (offset = before_days * -1; offset < 0; offset++) {
        target_sql_date = date_to_sql(add_days(booked_date, offset));
        $target_cell = date_cells[target_sql_date];
        if ($target_cell && !$target_cell.hasClass('date_approved') && !$target_cell.hasClass('date2approve')) {
          remember_preview_origin($target_cell);
          $target_cell.addClass('date_user_unavailable wpbc_ag_preview_unavailable wpbc_ag_preview_buffer_unavailable buffer_unavailable');
          $target_cell.attr('data-wpbc-ag-preview-reason', 'wpbc_ag_preview_buffer_unavailable');
        }
      }
      for (offset = 1; offset <= after_days; offset++) {
        target_sql_date = date_to_sql(add_days(booked_date, offset));
        $target_cell = date_cells[target_sql_date];
        if ($target_cell && !$target_cell.hasClass('date_approved') && !$target_cell.hasClass('date2approve')) {
          remember_preview_origin($target_cell);
          $target_cell.addClass('date_user_unavailable wpbc_ag_preview_unavailable wpbc_ag_preview_buffer_unavailable buffer_unavailable');
          $target_cell.attr('data-wpbc-ag-preview-reason', 'wpbc_ag_preview_buffer_unavailable');
        }
      }
    });
  }
  function remember_preview_origin($cell) {
    if (typeof $cell.attr('data-wpbc-ag-original-date-user-unavailable') === 'undefined') {
      $cell.attr('data-wpbc-ag-original-date-user-unavailable', $cell.hasClass('date_user_unavailable') ? '1' : '0');
    }
  }
  function clear_preview_cell($cell) {
    var had_date_user_unavailable = $cell.attr('data-wpbc-ag-original-date-user-unavailable') === '1';
    $cell.removeClass(preview_unavailable_classes);
    $cell.removeAttr('data-wpbc-ag-preview-reason');
    $cell.removeAttr('data-wpbc-ag-original-date-user-unavailable');
    if (!had_date_user_unavailable) {
      $cell.removeClass('date_user_unavailable');
    }
  }
  function apply_calendar_preview() {
    var settings = collect_settings();
    var today_date = get_real_today_date();
    var available_limit = is_available_limit_available() ? parseInt(settings.booking_available_days_num_from_today || '0', 10) : 0;
    var $calendar = $('[data-wpbc-ag-calendar-panel="1"]');
    update_wpbc_preview_params(settings);
    update_buffer_preview_note(settings);
    $calendar.find('.datepick-days-cell').each(function () {
      var cell = this;
      var $cell = $(cell);
      var sql_date = get_sql_date_from_cell(cell);
      var cell_date = date_from_sql(sql_date);
      var make_unavailable = false;
      var reason_class = '';
      var previous_reason = $cell.attr('data-wpbc-ag-preview-reason') || '';
      var had_general_preview = !!previous_reason || $cell.hasClass('wpbc_ag_preview_unavailable') || $cell.hasClass('weekday_unavailable') || $cell.hasClass('from_today_unavailable') || $cell.hasClass('limit_available_from_today') || $cell.hasClass('buffer_unavailable');
      if (!cell_date) {
        return;
      }
      if (settings.weekdays.indexOf(cell_date.getDay()) > -1) {
        make_unavailable = true;
        reason_class = 'wpbc_ag_preview_weekday_unavailable';
      }
      if (unavailable_from_today_applies(cell_date, today_date, settings.booking_unavailable_days_num_from_today)) {
        make_unavailable = true;
        reason_class = 'wpbc_ag_preview_from_today_unavailable';
      }
      if (available_limit > 0 && days_between(cell_date, today_date) >= available_limit) {
        make_unavailable = true;
        reason_class = 'wpbc_ag_preview_limit_available_from_today';
      }
      if (make_unavailable) {
        if (previous_reason !== reason_class) {
          if (had_general_preview) {
            clear_preview_cell($cell);
          }
          remember_preview_origin($cell);
          $cell.addClass('date_user_unavailable wpbc_ag_preview_unavailable ' + reason_class);
          $cell.attr('data-wpbc-ag-preview-reason', reason_class);
        }
      } else if (had_general_preview) {
        clear_preview_cell($cell);
      }
    });
    apply_buffer_days_preview(settings);
  }
  function queue_preview_refresh() {
    if (preview_frame) {
      return;
    }
    if (w.requestAnimationFrame) {
      preview_frame = w.requestAnimationFrame(function () {
        preview_frame = 0;
        apply_calendar_preview();
      });
    } else {
      preview_frame = w.setTimeout(function () {
        preview_frame = 0;
        apply_calendar_preview();
      }, 0);
    }
  }
  function schedule_preview_refresh(delay) {
    clearTimeout(preview_timer);
    delay = parseInt(delay, 10) || 0;
    if (delay > 0) {
      preview_timer = setTimeout(queue_preview_refresh, delay);
      return;
    }
    queue_preview_refresh();
  }
  function update_hints(hints) {
    if (!hints) {
      return;
    }
    if (typeof hints.booking_unavailable_days_num_from_today__hint !== 'undefined') {
      $('[data-wpbc-ag-hint="booking_unavailable_days_num_from_today"]').html('<span class="wpbc_ag_hint_unavailable">' + $('[data-wpbc-ag-hint="booking_unavailable_days_num_from_today"] .wpbc_ag_hint_unavailable').first().text() + '</span>' + hints.booking_unavailable_days_num_from_today__hint);
    }
    if (typeof hints.booking_available_days_num_from_today__hint !== 'undefined') {
      $('[data-wpbc-ag-hint="booking_available_days_num_from_today"]').html('<span class="wpbc_ag_hint_available">' + $('[data-wpbc-ag-hint="booking_available_days_num_from_today"] .wpbc_ag_hint_available').first().text() + '</span>' + hints.booking_available_days_num_from_today__hint);
    }
  }
  function show_message(message, type, duration) {
    if (typeof w.wpbc_admin_show_message === 'function') {
      w.wpbc_admin_show_message(message, type || 'info', duration || 2000, false);
    } else {
      w.alert(message);
    }
  }
  function set_busy($button, busy) {
    var busy_text;
    if (!$button || !$button.length) {
      return;
    }
    if (busy) {
      if (!$button.data('wpbc-ag-original-html')) {
        $button.data('wpbc-ag-original-html', $button.html());
      }
      busy_text = $button.data('wpbc-u-busy-text') || cfg.i18n && cfg.i18n.saving || 'Saving...';
      $button.addClass('wpbc_ag_is_saving').attr('aria-busy', 'true').html('<i class="menu_icon icon-1x wpbc_icn_rotate_right wpbc_spin"></i><span class="in-button-text">&nbsp;&nbsp;' + busy_text + '</span>');
    } else {
      $button.removeClass('wpbc_ag_is_saving').removeAttr('aria-busy');
      if ($button.data('wpbc-ag-original-html')) {
        $button.html($button.data('wpbc-ag-original-html'));
      }
    }
  }
  function replace_calendar_panel(html) {
    var $holder = $('<div />').append($.parseHTML(html, document, true));
    var $new_panel = $holder.find('[data-wpbc-ag-calendar-panel="1"]').first();
    var $old_panel = $('[data-wpbc-ag-calendar-panel="1"]').first();
    var $scripts;
    if (!$new_panel.length || !$old_panel.length) {
      return;
    }
    $scripts = $new_panel.find('script').remove();
    $old_panel.replaceWith($new_panel);
    $scripts.each(function () {
      var code = this.text || this.textContent || this.innerHTML || '';
      var src = this.src || '';
      if (src) {
        $.ajax({
          url: src,
          dataType: 'script',
          cache: true
        });
      } else if (code) {
        $.globalEval(code);
      }
    });
  }
  function set_calendar_loading(is_loading) {
    var $calendar = $('[data-wpbc-ag-calendar-panel="1"]').first();
    var loading_text = cfg.i18n && cfg.i18n.loading ? cfg.i18n.loading : 'Loading';
    var $loading;
    if (!$calendar.length) {
      return;
    }
    if (is_loading) {
      $loading = $calendar.find('.wpbc_calendar_loading').first();
      if (!$loading.length) {
        $loading = $('<div class="wpbc_calendar_loading wpbc_ag_calendar_loading">' + '<span class="wpbc_icn_autorenew wpbc_spin"></span>&nbsp;&nbsp;' + '<span></span>' + '</div>');
        $loading.find('span').last().text(loading_text + '...');
        $calendar.append($loading);
      }
      $calendar.addClass('is-loading').attr('aria-busy', 'true');
    } else {
      $calendar.removeClass('is-loading').removeAttr('aria-busy');
      $calendar.find('.wpbc_calendar_loading').remove();
    }
  }
  function get_preview_payload() {
    return {
      action: cfg.preview_action || 'WPBC_AJX_AVAILABILITY_GENERAL_PREVIEW',
      nonce: cfg.nonce || '',
      resource_id: $('#wpbc_ag_resource_id').val() || '',
      months_count: $('#wpbc_ag_months_count').val() || ''
    };
  }
  function load_calendar_preview() {
    var $calendar = $('[data-wpbc-ag-calendar-panel="1"]').first();
    var current_preview_ajax;
    if (!cfg.ajax_url) {
      show_message(cfg.i18n && cfg.i18n.preview_failed || 'Unable to refresh calendar preview.', 'error', 10000);
      return;
    }
    if (preview_ajax && preview_ajax.readyState !== 4) {
      preview_ajax.abort();
    }
    set_calendar_loading(true);
    current_preview_ajax = $.ajax({
      url: cfg.ajax_url,
      method: 'POST',
      dataType: 'json',
      data: get_preview_payload()
    });
    preview_ajax = current_preview_ajax;
    current_preview_ajax.done(function (response) {
      if (!response || !response.success || !response.data || !response.data.html) {
        show_message(response && response.data && response.data.message || cfg.i18n && cfg.i18n.preview_failed || 'Unable to refresh calendar preview.', 'error', 10000);
        return;
      }
      replace_calendar_panel(response.data.html);
      $('[data-wpbc-ag-page="1"]').attr('data-wpbc-ag-resource-id', response.data.resource_id || '');
      observe_calendar_changes();
      schedule_preview_refresh();
      setTimeout(schedule_preview_refresh, 600);
    }).fail(function (jq_xhr, text_status) {
      if (text_status !== 'abort') {
        show_message(cfg.i18n && cfg.i18n.preview_failed || 'Unable to refresh calendar preview.', 'error', 10000);
      }
    }).always(function () {
      if (preview_ajax === current_preview_ajax) {
        set_calendar_loading(false);
      }
    });
  }
  function save_settings(button) {
    var $button = $(button);
    var settings = collect_settings();
    var payload = $.extend({}, settings, {
      action: cfg.action || 'WPBC_AJX_AVAILABILITY_GENERAL_SAVE',
      nonce: cfg.nonce || '',
      booking_unavailable_days: settings.weekdays
    });
    append_working_time_payload(payload);
    if (!cfg.ajax_url) {
      show_message(cfg.i18n && cfg.i18n.save_failed || 'Unable to save general availability settings.', 'error', 10000);
      return;
    }
    set_busy($button, true);
    $.ajax({
      url: cfg.ajax_url,
      method: 'POST',
      dataType: 'json',
      data: payload
    }).done(function (response) {
      if (!response || !response.success) {
        show_message(response && response.data && response.data.message || cfg.i18n && cfg.i18n.save_failed || 'Unable to save general availability settings.', 'error', 10000);
        return;
      }
      if (response.data && response.data.settings && response.data.settings.hints) {
        update_hints(response.data.settings.hints);
      }
      if (response.data && response.data.settings) {
        cfg.settings = response.data.settings;
      }
      load_calendar_preview();
      show_message(response.data && response.data.message || cfg.i18n && cfg.i18n.saved || 'General availability settings updated.', 'success', 2000);
    }).fail(function () {
      show_message(cfg.i18n && cfg.i18n.save_failed || 'Unable to save general availability settings.', 'error', 10000);
    }).always(function () {
      set_busy($button, false);
    });
  }
  function reset_settings(button) {
    var confirm_message = cfg.i18n && cfg.i18n.reset_confirm || 'Reset general availability settings to default values?';
    var default_settings = cfg.default_settings || {
      weekdays: [],
      booking_unavailable_days_num_from_today: '0',
      booking_available_days_num_from_today: '',
      booking_unavailable_extra_in_out: '',
      booking_unavailable_extra_minutes_in: '',
      booking_unavailable_extra_minutes_out: '',
      booking_unavailable_extra_days_in: '',
      booking_unavailable_extra_days_out: '',
      working_time: {}
    };
    if (!w.confirm(confirm_message)) {
      return;
    }
    apply_settings_to_form(default_settings);
    load_calendar_preview();
    show_message(cfg.i18n && cfg.i18n.reset_applied || 'Default availability settings are ready for preview. Click Save Changes to apply them.', 'success', 4000);
  }
  function observe_calendar_changes() {
    var target = document.querySelector('[data-wpbc-ag-calendar-panel="1"]');
    if (!target || !w.MutationObserver) {
      return;
    }
    if (observer) {
      observer.disconnect();
    }
    observer = new MutationObserver(schedule_preview_refresh);
    observer.observe(target, {
      childList: true,
      subtree: true
    });
  }
  $(document).on('click', '.wpbc_ag_rightbar_tabs [role="tab"]', function () {
    switch_panel($(this));
  });
  $(document).on('click', '.wpbc_ag_rightbar_panels .group__header', function () {
    toggle_group($(this));
  });
  $(document).on('submit', '[data-wpbc-ag-preview-toolbar="1"]', function (event) {
    event.preventDefault();
    load_calendar_preview();
  });
  $(document).on('change', '#wpbc_ag_resource_id, #wpbc_ag_months_count', load_calendar_preview);
  $(document).on('change', '#wpbc_ag_resource_id', function () {
    cfg.settings = cfg.settings || {};
    cfg.settings.working_time = get_working_time_settings_from_form();
    apply_working_time_settings_to_form(cfg.settings.working_time, $(this).val());
  });
  $(document).on('input change', '[data-wpbc-ag-range-for]', function () {
    sync_select_from_range(this);
    schedule_preview_refresh();
  });
  $(document).on('change', '[data-wpbc-ag-settings-form="1"] select', function () {
    sync_range_from_select(this);
  });
  $(document).on('click', '[data-wpbc-ag-stepper]', function () {
    step_select_value(this);
  });
  $(document).on('change', 'input[name="booking_unavailable_extra_in_out"]', function () {
    refresh_buffer_fields();
    schedule_preview_refresh();
  });
  $(document).on('change', 'input[name="booking_working_time_enabled"]', refresh_working_time_panels);
  $(document).on('change', 'input[name="booking_working_time_resource_mode"]', refresh_working_time_panels);
  $(document).on('change', '[data-wpbc-ag-settings-form="1"] input, [data-wpbc-ag-settings-form="1"] select', schedule_preview_refresh);
  $(document).on('submit', '[data-wpbc-ag-settings-form="1"]', function (event) {
    event.preventDefault();
    save_settings($('[data-wpbc-ag-save="1"]').first());
  });
  $(document).on('click', '[data-wpbc-ag-save="1"]', function () {
    save_settings(this);
  });
  $(document).on('click', '[data-wpbc-ag-reset="1"]', function () {
    reset_settings(this);
  });
  $(document).ready(function () {
    apply_working_time_settings_to_form(cfg.settings && cfg.settings.working_time || cfg.default_settings && cfg.default_settings.working_time || {}, $('#wpbc_ag_resource_id').val());
    apply_open_section_from_url();
    refresh_buffer_fields();
    sync_all_ranges();
    observe_calendar_changes();
    schedule_preview_refresh();
    setTimeout(schedule_preview_refresh, 600);
  });
})(jQuery, window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1hdmFpbGFiaWxpdHktZ2VuZXJhbC9fb3V0L2F2YWlsYWJpbGl0eV9nZW5lcmFsX3BhZ2UuanMiLCJuYW1lcyI6WyIkIiwidyIsImNmZyIsIndwYmNfYXZhaWxhYmlsaXR5X2dlbmVyYWxfcGFnZSIsInByZXZpZXdfdGltZXIiLCJwcmV2aWV3X2ZyYW1lIiwicHJldmlld19hamF4Iiwib2JzZXJ2ZXIiLCJwcmV2aWV3X3VuYXZhaWxhYmxlX2NsYXNzZXMiLCJ0cmltX3RleHQiLCJ2YWx1ZSIsIlN0cmluZyIsInRyaW0iLCJzd2l0Y2hfcGFuZWwiLCIkdGFiIiwicGFuZWxfaWQiLCJhdHRyIiwiJHRhYnMiLCJjbG9zZXN0IiwiZmluZCIsIiRwYW5lbHMiLCJyZW1vdmVBdHRyIiwidG9nZ2xlX2dyb3VwIiwiJGJ1dHRvbiIsIiRncm91cCIsIiRmaWVsZHMiLCJpc19vcGVuIiwiaGFzQ2xhc3MiLCJ0b2dnbGVDbGFzcyIsInByb3AiLCJjbG9zZV9ncm91cCIsInJlbW92ZUNsYXNzIiwib3Blbl9ncm91cCIsImdyb3VwX25hbWUiLCJpc19leGNsdXNpdmUiLCJsZW5ndGgiLCJzaWJsaW5ncyIsImVhY2giLCJhZGRDbGFzcyIsInNjcm9sbF90b19ncm91cCIsIiRzY3JvbGxfcGFyZW50Iiwic2Nyb2xsX3RvcCIsImZpcnN0IiwiZ2V0Iiwic2Nyb2xsSW50b1ZpZXciLCJibG9jayIsInNjcm9sbFRvcCIsInBvc2l0aW9uIiwidG9wIiwic3RvcCIsImFuaW1hdGUiLCJNYXRoIiwibWF4IiwiYXBwbHlfb3Blbl9zZWN0aW9uX2Zyb21fdXJsIiwib3Blbl9zZWN0aW9uIiwic2V0VGltZW91dCIsInJlZnJlc2hfYnVmZmVyX2ZpZWxkcyIsInZhbCIsIiRwYW5lbCIsImRhdGEiLCJpc19idWZmZXJfYXZhaWxhYmxlIiwiaXNfYXZhaWxhYmxlX2xpbWl0X2F2YWlsYWJsZSIsInN5bmNfcmFuZ2VfZnJvbV9zZWxlY3QiLCJzZWxlY3QiLCIkc2VsZWN0IiwibmFtZSIsInNlbGVjdGVkX2luZGV4Iiwic2VsZWN0ZWRfdGV4dCIsInRleHQiLCIkcmFuZ2UiLCIkdmFsdWUiLCJzeW5jX3NlbGVjdF9mcm9tX3JhbmdlIiwicmFuZ2UiLCJpbmRleCIsInBhcnNlSW50Iiwic3luY19hbGxfcmFuZ2VzIiwic3RlcF9zZWxlY3RfdmFsdWUiLCJidXR0b24iLCJzdGVwIiwiY3VycmVudF9pbmRleCIsIm5leHRfaW5kZXgiLCJtaW4iLCJ0cmlnZ2VyIiwiZ2V0X2Zvcm0iLCJjb2xsZWN0X3NldHRpbmdzIiwiJGZvcm0iLCJ3ZWVrZGF5cyIsInB1c2giLCJib29raW5nX3VuYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXkiLCJib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5IiwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9pbl9vdXQiLCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX21pbnV0ZXNfaW4iLCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX21pbnV0ZXNfb3V0IiwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9kYXlzX2luIiwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9kYXlzX291dCIsIndvcmtpbmdfdGltZSIsImdldF93b3JraW5nX3RpbWVfc2V0dGluZ3NfZnJvbV9mb3JtIiwic2V0X3NlbGVjdF92YWx1ZSIsIiRmaWVsZCIsImFwcGx5X3NldHRpbmdzX3RvX2Zvcm0iLCJzZXR0aW5ncyIsImRheV9udW0iLCJhcHBseV93b3JraW5nX3RpbWVfc2V0dGluZ3NfdG9fZm9ybSIsInNjaGVkdWxlX3ByZXZpZXdfcmVmcmVzaCIsImRhdGVfZnJvbV9zcWwiLCJzcWxfZGF0ZSIsInBhcnRzIiwic3BsaXQiLCJEYXRlIiwiZ2V0X3RvZGF5X2RhdGUiLCJhcnIiLCJfd3BiYyIsImdldF9vdGhlcl9wYXJhbSIsIm5vdyIsImdldEZ1bGxZZWFyIiwiZ2V0TW9udGgiLCJnZXREYXRlIiwiZ2V0X3JlYWxfdG9kYXlfZGF0ZSIsImRheXNfYmV0d2VlbiIsImRhdGVfYSIsImRhdGVfYiIsImZsb29yIiwiZ2V0VGltZSIsImFkZF9kYXlzIiwiZGF0ZSIsImRheXMiLCJzaGlmdGVkX2RhdGUiLCJzZXREYXRlIiwiZGF0ZV90b19zcWwiLCJtb250aCIsImRheSIsImdldF9zcWxfZGF0ZV9mcm9tX2NlbGwiLCJjZWxsIiwiY2xhc3NlcyIsImNsYXNzTmFtZSIsImkiLCJpbmRleE9mIiwicmVwbGFjZSIsInVuYXZhaWxhYmxlX2Zyb21fdG9kYXlfYXBwbGllcyIsImNlbGxfZGF0ZSIsInRvZGF5X2RhdGUiLCJtaW51dGVzIiwidW5hdmFpbGFibGVfdW50aWwiLCJ0ZXN0IiwiZ2V0X29wdGlvbl90ZXh0Iiwic2VsZWN0b3IiLCJnZXRfZGF5c192YWx1ZSIsInRpbWVfdG9fc2Vjb25kcyIsInRpbWUiLCJob3VycyIsIm1pbnMiLCJzZWNvbmRzX3RvX3RpbWUiLCJzZWNvbmRzIiwiY29sbGVjdF93b3JraW5nX3RpbWVfd2Vla2RheXMiLCJwcmVmaXgiLCIkcm93Iiwic3RhcnRfc2Vjb25kIiwiZW5kX3NlY29uZCIsInNldF93b3JraW5nX3RpbWVfd2Vla2RheXMiLCIkd3JhcCIsImludGVydmFscyIsImludGVydmFsIiwicmVmcmVzaF93b3JraW5nX3RpbWVfcGFuZWxzIiwiaXNfZW5hYmxlZCIsIm1vZGUiLCJyZXNvdXJjZUlkIiwid29ya2luZ1RpbWUiLCJleHRlbmQiLCJkZWZhdWx0X3NldHRpbmdzIiwiZGVmYXVsdCIsInJlc291cmNlcyIsImVuYWJsZWQiLCJyZXNvdXJjZVNldHRpbmdzIiwiYXBwZW5kX3dvcmtpbmdfdGltZV9wYXlsb2FkIiwicGF5bG9hZCIsImRlZmF1bHREYXlzIiwicmVzb3VyY2VEYXlzIiwiZGVmYXVsdFN0YXJ0IiwiZGVmYXVsdEVuZCIsInJlc291cmNlU3RhcnQiLCJyZXNvdXJjZUVuZCIsImJvb2tpbmdfd29ya2luZ190aW1lX2VuYWJsZWQiLCJib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZV9pZCIsImJvb2tpbmdfd29ya2luZ190aW1lX3Jlc291cmNlX21vZGUiLCJib29raW5nX3dvcmtpbmdfdGltZV9kZWZhdWx0X2RheXMiLCJib29raW5nX3dvcmtpbmdfdGltZV9kZWZhdWx0X3N0YXJ0IiwiYm9va2luZ193b3JraW5nX3RpbWVfZGVmYXVsdF9lbmQiLCJib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZV9kYXlzIiwiYm9va2luZ193b3JraW5nX3RpbWVfcmVzb3VyY2Vfc3RhcnQiLCJib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZV9lbmQiLCJ1cGRhdGVfd3BiY19wcmV2aWV3X3BhcmFtcyIsInNldF9vdGhlcl9wYXJhbSIsImNvbmNhdCIsInVwZGF0ZV9idWZmZXJfcHJldmlld19ub3RlIiwiJG5vdGVzIiwiJGNhbGVuZGFyIiwiJG5vdGUiLCJ0eXBlIiwiYmVmb3JlX3RleHQiLCJhZnRlcl90ZXh0IiwibWVzc2FnZSIsImFwcGVuZCIsImkxOG4iLCJidWZmZXJfcHJldmlldyIsImJlZm9yZV9ib29raW5nIiwiYWZ0ZXJfYm9va2luZyIsImh0bWwiLCJub19idWZmZXIiLCJhcHBseV9idWZmZXJfZGF5c19wcmV2aWV3IiwiYmVmb3JlX2RheXMiLCJhZnRlcl9kYXlzIiwiZGF0ZV9jZWxscyIsImJvb2tlZF9kYXRlcyIsIiRjZWxsIiwiYm9va2VkX2RhdGUiLCJvZmZzZXQiLCJ0YXJnZXRfc3FsX2RhdGUiLCIkdGFyZ2V0X2NlbGwiLCJyZW1lbWJlcl9wcmV2aWV3X29yaWdpbiIsImNsZWFyX3ByZXZpZXdfY2VsbCIsImhhZF9kYXRlX3VzZXJfdW5hdmFpbGFibGUiLCJhcHBseV9jYWxlbmRhcl9wcmV2aWV3IiwiYXZhaWxhYmxlX2xpbWl0IiwibWFrZV91bmF2YWlsYWJsZSIsInJlYXNvbl9jbGFzcyIsInByZXZpb3VzX3JlYXNvbiIsImhhZF9nZW5lcmFsX3ByZXZpZXciLCJnZXREYXkiLCJxdWV1ZV9wcmV2aWV3X3JlZnJlc2giLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJkZWxheSIsImNsZWFyVGltZW91dCIsInVwZGF0ZV9oaW50cyIsImhpbnRzIiwiYm9va2luZ191bmF2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5X19oaW50IiwiYm9va2luZ19hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheV9faGludCIsInNob3dfbWVzc2FnZSIsImR1cmF0aW9uIiwid3BiY19hZG1pbl9zaG93X21lc3NhZ2UiLCJhbGVydCIsInNldF9idXN5IiwiYnVzeSIsImJ1c3lfdGV4dCIsInNhdmluZyIsInJlcGxhY2VfY2FsZW5kYXJfcGFuZWwiLCIkaG9sZGVyIiwicGFyc2VIVE1MIiwiZG9jdW1lbnQiLCIkbmV3X3BhbmVsIiwiJG9sZF9wYW5lbCIsIiRzY3JpcHRzIiwicmVtb3ZlIiwicmVwbGFjZVdpdGgiLCJjb2RlIiwidGV4dENvbnRlbnQiLCJpbm5lckhUTUwiLCJzcmMiLCJhamF4IiwidXJsIiwiZGF0YVR5cGUiLCJjYWNoZSIsImdsb2JhbEV2YWwiLCJzZXRfY2FsZW5kYXJfbG9hZGluZyIsImlzX2xvYWRpbmciLCJsb2FkaW5nX3RleHQiLCJsb2FkaW5nIiwiJGxvYWRpbmciLCJsYXN0IiwiZ2V0X3ByZXZpZXdfcGF5bG9hZCIsImFjdGlvbiIsInByZXZpZXdfYWN0aW9uIiwibm9uY2UiLCJyZXNvdXJjZV9pZCIsIm1vbnRoc19jb3VudCIsImxvYWRfY2FsZW5kYXJfcHJldmlldyIsImN1cnJlbnRfcHJldmlld19hamF4IiwiYWpheF91cmwiLCJwcmV2aWV3X2ZhaWxlZCIsInJlYWR5U3RhdGUiLCJhYm9ydCIsIm1ldGhvZCIsImRvbmUiLCJyZXNwb25zZSIsInN1Y2Nlc3MiLCJvYnNlcnZlX2NhbGVuZGFyX2NoYW5nZXMiLCJmYWlsIiwianFfeGhyIiwidGV4dF9zdGF0dXMiLCJhbHdheXMiLCJzYXZlX3NldHRpbmdzIiwiYm9va2luZ191bmF2YWlsYWJsZV9kYXlzIiwic2F2ZV9mYWlsZWQiLCJzYXZlZCIsInJlc2V0X3NldHRpbmdzIiwiY29uZmlybV9tZXNzYWdlIiwicmVzZXRfY29uZmlybSIsImNvbmZpcm0iLCJyZXNldF9hcHBsaWVkIiwidGFyZ2V0IiwicXVlcnlTZWxlY3RvciIsIk11dGF0aW9uT2JzZXJ2ZXIiLCJkaXNjb25uZWN0Iiwib2JzZXJ2ZSIsImNoaWxkTGlzdCIsInN1YnRyZWUiLCJvbiIsImV2ZW50IiwicHJldmVudERlZmF1bHQiLCJyZWFkeSIsImpRdWVyeSIsIndpbmRvdyJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtYXZhaWxhYmlsaXR5LWdlbmVyYWwvX3NyYy9hdmFpbGFiaWxpdHlfZ2VuZXJhbF9wYWdlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBHZW5lcmFsIEF2YWlsYWJpbGl0eSBVSS5cclxuICovXHJcbiggZnVuY3Rpb24gKCAkLCB3ICkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0dmFyIGNmZyA9IHcud3BiY19hdmFpbGFiaWxpdHlfZ2VuZXJhbF9wYWdlIHx8IHt9O1xyXG5cdHZhciBwcmV2aWV3X3RpbWVyID0gMDtcclxuXHR2YXIgcHJldmlld19mcmFtZSA9IDA7XHJcblx0dmFyIHByZXZpZXdfYWpheCA9IG51bGw7XHJcblx0dmFyIG9ic2VydmVyID0gbnVsbDtcclxuXHR2YXIgcHJldmlld191bmF2YWlsYWJsZV9jbGFzc2VzID0gJ3dwYmNfYWdfcHJldmlld191bmF2YWlsYWJsZSB3cGJjX2FnX3ByZXZpZXdfd2Vla2RheV91bmF2YWlsYWJsZSB3cGJjX2FnX3ByZXZpZXdfZnJvbV90b2RheV91bmF2YWlsYWJsZSB3cGJjX2FnX3ByZXZpZXdfbGltaXRfYXZhaWxhYmxlX2Zyb21fdG9kYXkgd3BiY19hZ19wcmV2aWV3X2J1ZmZlcl91bmF2YWlsYWJsZSB3ZWVrZGF5X3VuYXZhaWxhYmxlIGZyb21fdG9kYXlfdW5hdmFpbGFibGUgbGltaXRfYXZhaWxhYmxlX2Zyb21fdG9kYXkgYnVmZmVyX3VuYXZhaWxhYmxlJztcclxuXHJcblx0ZnVuY3Rpb24gdHJpbV90ZXh0KCB2YWx1ZSApIHtcclxuXHRcdHJldHVybiBTdHJpbmcoIHZhbHVlIHx8ICcnICkudHJpbSgpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc3dpdGNoX3BhbmVsKCAkdGFiICkge1xyXG5cdFx0dmFyIHBhbmVsX2lkID0gJHRhYi5hdHRyKCAnYXJpYS1jb250cm9scycgKTtcclxuXHRcdHZhciAkdGFicyA9ICR0YWIuY2xvc2VzdCggJy53cGJjX2FnX3JpZ2h0YmFyX3RhYnMnICkuZmluZCggJ1tyb2xlPVwidGFiXCJdJyApO1xyXG5cdFx0dmFyICRwYW5lbHMgPSAkKCAnLndwYmNfYWdfcmlnaHRiYXJfcGFuZWxzIFtyb2xlPVwidGFicGFuZWxcIl0nICk7XHJcblxyXG5cdFx0JHRhYnMuYXR0ciggJ2FyaWEtc2VsZWN0ZWQnLCAnZmFsc2UnICk7XHJcblx0XHQkdGFiLmF0dHIoICdhcmlhLXNlbGVjdGVkJywgJ3RydWUnICk7XHJcblxyXG5cdFx0JHBhbmVscy5hdHRyKCAnaGlkZGVuJywgJ2hpZGRlbicgKS5hdHRyKCAnYXJpYS1oaWRkZW4nLCAndHJ1ZScgKTtcclxuXHRcdCQoICcjJyArIHBhbmVsX2lkICkucmVtb3ZlQXR0ciggJ2hpZGRlbicgKS5hdHRyKCAnYXJpYS1oaWRkZW4nLCAnZmFsc2UnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB0b2dnbGVfZ3JvdXAoICRidXR0b24gKSB7XHJcblx0XHR2YXIgJGdyb3VwID0gJGJ1dHRvbi5jbG9zZXN0KCAnLndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwJyApO1xyXG5cdFx0dmFyICRmaWVsZHMgPSAkZ3JvdXAuZmluZCggJz4gLmdyb3VwX19maWVsZHMnICk7XHJcblx0XHR2YXIgaXNfb3BlbiA9ICRncm91cC5oYXNDbGFzcyggJ2lzLW9wZW4nICk7XHJcblxyXG5cdFx0JGdyb3VwLnRvZ2dsZUNsYXNzKCAnaXMtb3BlbicsICEgaXNfb3BlbiApO1xyXG5cdFx0JGJ1dHRvbi5hdHRyKCAnYXJpYS1leHBhbmRlZCcsIGlzX29wZW4gPyAnZmFsc2UnIDogJ3RydWUnICk7XHJcblx0XHQkZmllbGRzLnByb3AoICdoaWRkZW4nLCBpc19vcGVuICkuYXR0ciggJ2FyaWEtaGlkZGVuJywgaXNfb3BlbiA/ICd0cnVlJyA6ICdmYWxzZScgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGNsb3NlX2dyb3VwKCAkZ3JvdXAgKSB7XHJcblx0XHR2YXIgJGJ1dHRvbiA9ICRncm91cC5maW5kKCAnPiAuZ3JvdXBfX2hlYWRlcicgKTtcclxuXHRcdHZhciAkZmllbGRzID0gJGdyb3VwLmZpbmQoICc+IC5ncm91cF9fZmllbGRzJyApO1xyXG5cclxuXHRcdCRncm91cC5yZW1vdmVDbGFzcyggJ2lzLW9wZW4nICk7XHJcblx0XHQkYnV0dG9uLmF0dHIoICdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyApO1xyXG5cdFx0JGZpZWxkcy5wcm9wKCAnaGlkZGVuJywgdHJ1ZSApLmF0dHIoICdhcmlhLWhpZGRlbicsICd0cnVlJyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gb3Blbl9ncm91cCggZ3JvdXBfbmFtZSwgaXNfZXhjbHVzaXZlICkge1xyXG5cdFx0dmFyICRncm91cCA9ICQoICcud3BiY191aV9fY29sbGFwc2libGVfZ3JvdXBbZGF0YS1ncm91cD1cIicgKyBncm91cF9uYW1lICsgJ1wiXScgKTtcclxuXHRcdHZhciAkYnV0dG9uID0gJGdyb3VwLmZpbmQoICc+IC5ncm91cF9faGVhZGVyJyApO1xyXG5cdFx0dmFyICRmaWVsZHMgPSAkZ3JvdXAuZmluZCggJz4gLmdyb3VwX19maWVsZHMnICk7XHJcblxyXG5cdFx0aWYgKCAhICRncm91cC5sZW5ndGggKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGlzX2V4Y2x1c2l2ZSApIHtcclxuXHRcdFx0JGdyb3VwLnNpYmxpbmdzKCAnLndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRjbG9zZV9ncm91cCggJCggdGhpcyApICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQkZ3JvdXAuYWRkQ2xhc3MoICdpcy1vcGVuJyApO1xyXG5cdFx0JGJ1dHRvbi5hdHRyKCAnYXJpYS1leHBhbmRlZCcsICd0cnVlJyApO1xyXG5cdFx0JGZpZWxkcy5wcm9wKCAnaGlkZGVuJywgZmFsc2UgKS5hdHRyKCAnYXJpYS1oaWRkZW4nLCAnZmFsc2UnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzY3JvbGxfdG9fZ3JvdXAoIGdyb3VwX25hbWUgKSB7XHJcblx0XHR2YXIgJGdyb3VwID0gJCggJy53cGJjX3VpX19jb2xsYXBzaWJsZV9ncm91cFtkYXRhLWdyb3VwPVwiJyArIGdyb3VwX25hbWUgKyAnXCJdJyApO1xyXG5cdFx0dmFyICRzY3JvbGxfcGFyZW50O1xyXG5cdFx0dmFyIHNjcm9sbF90b3A7XHJcblxyXG5cdFx0aWYgKCAhICRncm91cC5sZW5ndGggKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQkc2Nyb2xsX3BhcmVudCA9ICRncm91cC5jbG9zZXN0KCAnLndwYmNfdWlfZWxfX3ZlcnRfcmlnaHRfYmFyX19jb250ZW50LCAud3BiY19yaWdodGJhcl9wYWxldHRlLCAud3BiY19hZ19yaWdodGJhcl9wYW5lbHMnICkuZmlyc3QoKTtcclxuXHJcblx0XHRpZiAoICEgJHNjcm9sbF9wYXJlbnQubGVuZ3RoICkge1xyXG5cdFx0XHQkZ3JvdXAuZ2V0KCAwICkuc2Nyb2xsSW50b1ZpZXcoIHsgYmxvY2s6ICdzdGFydCcgfSApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0c2Nyb2xsX3RvcCA9ICRzY3JvbGxfcGFyZW50LnNjcm9sbFRvcCgpICsgJGdyb3VwLnBvc2l0aW9uKCkudG9wIC0gMTA7XHJcblx0XHQkc2Nyb2xsX3BhcmVudC5zdG9wKCkuYW5pbWF0ZSggeyBzY3JvbGxUb3A6IE1hdGgubWF4KCAwLCBzY3JvbGxfdG9wICkgfSwgMTgwICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBhcHBseV9vcGVuX3NlY3Rpb25fZnJvbV91cmwoKSB7XHJcblx0XHRpZiAoICd3b3JraW5nX3RpbWUnICE9PSBjZmcub3Blbl9zZWN0aW9uICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0b3Blbl9ncm91cCggJ2dlbmVyYWwtYXZhaWxhYmlsaXR5LXdvcmtpbmctdGltZScsIHRydWUgKTtcclxuXHRcdHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0c2Nyb2xsX3RvX2dyb3VwKCAnZ2VuZXJhbC1hdmFpbGFiaWxpdHktd29ya2luZy10aW1lJyApO1xyXG5cdFx0fSwgMTIwICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByZWZyZXNoX2J1ZmZlcl9maWVsZHMoKSB7XHJcblx0XHR2YXIgdmFsdWUgPSAkKCAnaW5wdXRbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfaW5fb3V0XCJdOmNoZWNrZWQnICkudmFsKCkgfHwgJyc7XHJcblxyXG5cdFx0JCggJy53cGJjX2FnX2J1ZmZlcl9maWVsZHMnICkuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR2YXIgJHBhbmVsID0gJCggdGhpcyApO1xyXG5cdFx0XHQkcGFuZWwudG9nZ2xlQ2xhc3MoICdpcy12aXNpYmxlJywgJHBhbmVsLmRhdGEoICdidWZmZXItcGFuZWwnICkgPT09IHZhbHVlICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpc19idWZmZXJfYXZhaWxhYmxlKCkge1xyXG5cdFx0cmV0dXJuICEgKCBjZmcuaXNfYnVmZmVyX2F2YWlsYWJsZSA9PT0gZmFsc2UgfHwgY2ZnLmlzX2J1ZmZlcl9hdmFpbGFibGUgPT09ICdmYWxzZScgfHwgY2ZnLmlzX2J1ZmZlcl9hdmFpbGFibGUgPT09IDAgfHwgY2ZnLmlzX2J1ZmZlcl9hdmFpbGFibGUgPT09ICcwJyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaXNfYXZhaWxhYmxlX2xpbWl0X2F2YWlsYWJsZSgpIHtcclxuXHRcdHJldHVybiAhICggY2ZnLmlzX2F2YWlsYWJsZV9saW1pdF9hdmFpbGFibGUgPT09IGZhbHNlIHx8IGNmZy5pc19hdmFpbGFibGVfbGltaXRfYXZhaWxhYmxlID09PSAnZmFsc2UnIHx8IGNmZy5pc19hdmFpbGFibGVfbGltaXRfYXZhaWxhYmxlID09PSAwIHx8IGNmZy5pc19hdmFpbGFibGVfbGltaXRfYXZhaWxhYmxlID09PSAnMCcgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHN5bmNfcmFuZ2VfZnJvbV9zZWxlY3QoIHNlbGVjdCApIHtcclxuXHRcdHZhciAkc2VsZWN0ID0gJCggc2VsZWN0ICk7XHJcblx0XHR2YXIgbmFtZSA9ICRzZWxlY3QuYXR0ciggJ25hbWUnICk7XHJcblx0XHR2YXIgc2VsZWN0ZWRfaW5kZXggPSAkc2VsZWN0LnByb3AoICdzZWxlY3RlZEluZGV4JyApO1xyXG5cdFx0dmFyIHNlbGVjdGVkX3RleHQgPSB0cmltX3RleHQoICRzZWxlY3QuZmluZCggJ29wdGlvbjpzZWxlY3RlZCcgKS50ZXh0KCkgKTtcclxuXHRcdHZhciAkcmFuZ2UgPSAkKCAnW2RhdGEtd3BiYy1hZy1yYW5nZS1mb3I9XCInICsgbmFtZSArICdcIl0nICk7XHJcblx0XHR2YXIgJHZhbHVlID0gJCggJ1tkYXRhLXdwYmMtYWctcmFuZ2UtdmFsdWUtZm9yPVwiJyArIG5hbWUgKyAnXCJdJyApO1xyXG5cclxuXHRcdGlmICggISAkcmFuZ2UubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JHJhbmdlLnZhbCggc2VsZWN0ZWRfaW5kZXggPCAwID8gMCA6IHNlbGVjdGVkX2luZGV4ICk7XHJcblx0XHQkdmFsdWUudGV4dCggc2VsZWN0ZWRfdGV4dCApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc3luY19zZWxlY3RfZnJvbV9yYW5nZSggcmFuZ2UgKSB7XHJcblx0XHR2YXIgJHJhbmdlID0gJCggcmFuZ2UgKTtcclxuXHRcdHZhciBuYW1lID0gJHJhbmdlLmF0dHIoICdkYXRhLXdwYmMtYWctcmFuZ2UtZm9yJyApO1xyXG5cdFx0dmFyICRzZWxlY3QgPSAkKCAnW25hbWU9XCInICsgbmFtZSArICdcIl0nICk7XHJcblx0XHR2YXIgaW5kZXggPSBwYXJzZUludCggJHJhbmdlLnZhbCgpLCAxMCApIHx8IDA7XHJcblxyXG5cdFx0aWYgKCAhICRzZWxlY3QubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JHNlbGVjdC5wcm9wKCAnc2VsZWN0ZWRJbmRleCcsIGluZGV4ICk7XHJcblx0XHRzeW5jX3JhbmdlX2Zyb21fc2VsZWN0KCAkc2VsZWN0ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzeW5jX2FsbF9yYW5nZXMoKSB7XHJcblx0XHQkKCAnW2RhdGEtd3BiYy1hZy1yYW5nZS1mb3JdJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0dmFyIG5hbWUgPSAkKCB0aGlzICkuYXR0ciggJ2RhdGEtd3BiYy1hZy1yYW5nZS1mb3InICk7XHJcblx0XHRcdHN5bmNfcmFuZ2VfZnJvbV9zZWxlY3QoICQoICdbbmFtZT1cIicgKyBuYW1lICsgJ1wiXScgKS5maXJzdCgpICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzdGVwX3NlbGVjdF92YWx1ZSggYnV0dG9uICkge1xyXG5cdFx0dmFyICRidXR0b24gPSAkKCBidXR0b24gKTtcclxuXHRcdHZhciBuYW1lID0gJGJ1dHRvbi5hdHRyKCAnZGF0YS13cGJjLWFnLXN0ZXBwZXInICk7XHJcblx0XHR2YXIgc3RlcCA9IHBhcnNlSW50KCAkYnV0dG9uLmF0dHIoICdkYXRhLXN0ZXAnICksIDEwICkgfHwgMDtcclxuXHRcdHZhciAkc2VsZWN0ID0gJCggJ1tuYW1lPVwiJyArIG5hbWUgKyAnXCJdJyApLmZpcnN0KCk7XHJcblx0XHR2YXIgY3VycmVudF9pbmRleDtcclxuXHRcdHZhciBuZXh0X2luZGV4O1xyXG5cclxuXHRcdGlmICggISAkc2VsZWN0Lmxlbmd0aCB8fCAkc2VsZWN0LnByb3AoICdkaXNhYmxlZCcgKSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGN1cnJlbnRfaW5kZXggPSAkc2VsZWN0LnByb3AoICdzZWxlY3RlZEluZGV4JyApO1xyXG5cdFx0bmV4dF9pbmRleCA9IE1hdGgubWF4KCAwLCBNYXRoLm1pbiggJHNlbGVjdC5maW5kKCAnb3B0aW9uJyApLmxlbmd0aCAtIDEsIGN1cnJlbnRfaW5kZXggKyBzdGVwICkgKTtcclxuXHJcblx0XHRpZiAoIG5leHRfaW5kZXggPT09IGN1cnJlbnRfaW5kZXggKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQkc2VsZWN0LnByb3AoICdzZWxlY3RlZEluZGV4JywgbmV4dF9pbmRleCApLnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfZm9ybSgpIHtcclxuXHRcdHJldHVybiAkKCAnW2RhdGEtd3BiYy1hZy1zZXR0aW5ncy1mb3JtPVwiMVwiXScgKS5maXJzdCgpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gY29sbGVjdF9zZXR0aW5ncygpIHtcclxuXHRcdHZhciAkZm9ybSA9IGdldF9mb3JtKCk7XHJcblx0XHR2YXIgd2Vla2RheXMgPSBbXTtcclxuXHJcblx0XHQkZm9ybS5maW5kKCAnaW5wdXRbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c1tdXCJdOmNoZWNrZWQnICkuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR3ZWVrZGF5cy5wdXNoKCBwYXJzZUludCggdGhpcy52YWx1ZSwgMTAgKSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHdlZWtkYXlzOiB3ZWVrZGF5cyxcclxuXHRcdFx0Ym9va2luZ191bmF2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5OiAkZm9ybS5maW5kKCAnW25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXlcIl0nICkudmFsKCkgfHwgJzAnLFxyXG5cdFx0XHRib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5OiAkZm9ybS5maW5kKCAnW25hbWU9XCJib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5XCJdJyApLnZhbCgpIHx8ICcnLFxyXG5cdFx0XHRib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2luX291dDogJGZvcm0uZmluZCggJ1tuYW1lPVwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9pbl9vdXRcIl06Y2hlY2tlZCcgKS52YWwoKSB8fCAnJyxcclxuXHRcdFx0Ym9va2luZ191bmF2YWlsYWJsZV9leHRyYV9taW51dGVzX2luOiAkZm9ybS5maW5kKCAnW25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX21pbnV0ZXNfaW5cIl0nICkudmFsKCkgfHwgJycsXHJcblx0XHRcdGJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfbWludXRlc19vdXQ6ICRmb3JtLmZpbmQoICdbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfbWludXRlc19vdXRcIl0nICkudmFsKCkgfHwgJycsXHJcblx0XHRcdGJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfZGF5c19pbjogJGZvcm0uZmluZCggJ1tuYW1lPVwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9kYXlzX2luXCJdJyApLnZhbCgpIHx8ICcnLFxyXG5cdFx0XHRib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfb3V0OiAkZm9ybS5maW5kKCAnW25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfb3V0XCJdJyApLnZhbCgpIHx8ICcnLFxyXG5cdFx0XHR3b3JraW5nX3RpbWU6IGdldF93b3JraW5nX3RpbWVfc2V0dGluZ3NfZnJvbV9mb3JtKClcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZXRfc2VsZWN0X3ZhbHVlKCBuYW1lLCB2YWx1ZSApIHtcclxuXHRcdHZhciAkZmllbGQgPSBnZXRfZm9ybSgpLmZpbmQoICdbbmFtZT1cIicgKyBuYW1lICsgJ1wiXScgKS5maXJzdCgpO1xyXG5cclxuXHRcdGlmICggISAkZmllbGQubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JGZpZWxkLnZhbCggdmFsdWUgKTtcclxuXHRcdGlmICggU3RyaW5nKCAkZmllbGQudmFsKCkgKSAhPT0gU3RyaW5nKCB2YWx1ZSApICkge1xyXG5cdFx0XHQkZmllbGQucHJvcCggJ3NlbGVjdGVkSW5kZXgnLCAwICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBhcHBseV9zZXR0aW5nc190b19mb3JtKCBzZXR0aW5ncyApIHtcclxuXHRcdHZhciAkZm9ybSA9IGdldF9mb3JtKCk7XHJcblx0XHR2YXIgd2Vla2RheXMgPSBzZXR0aW5ncyAmJiBzZXR0aW5ncy53ZWVrZGF5cyA/IHNldHRpbmdzLndlZWtkYXlzIDogW107XHJcblxyXG5cdFx0aWYgKCAhICRmb3JtLmxlbmd0aCB8fCAhIHNldHRpbmdzICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JGZvcm0uZmluZCggJ2lucHV0W25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2RheXNbXVwiXScgKS5wcm9wKCAnY2hlY2tlZCcsIGZhbHNlICk7XHJcblx0XHQkLmVhY2goIHdlZWtkYXlzLCBmdW5jdGlvbiAoIGluZGV4LCBkYXlfbnVtICkge1xyXG5cdFx0XHQkZm9ybS5maW5kKCAnaW5wdXRbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c1tdXCJdW3ZhbHVlPVwiJyArIHBhcnNlSW50KCBkYXlfbnVtLCAxMCApICsgJ1wiXScgKS5wcm9wKCAnY2hlY2tlZCcsIHRydWUgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRzZXRfc2VsZWN0X3ZhbHVlKCAnYm9va2luZ191bmF2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5Jywgc2V0dGluZ3MuYm9va2luZ191bmF2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5IHx8ICcwJyApO1xyXG5cdFx0c2V0X3NlbGVjdF92YWx1ZSggJ2Jvb2tpbmdfYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXknLCBzZXR0aW5ncy5ib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5IHx8ICcnICk7XHJcblx0XHRzZXRfc2VsZWN0X3ZhbHVlKCAnYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9taW51dGVzX2luJywgc2V0dGluZ3MuYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9taW51dGVzX2luIHx8ICcnICk7XHJcblx0XHRzZXRfc2VsZWN0X3ZhbHVlKCAnYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9taW51dGVzX291dCcsIHNldHRpbmdzLmJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfbWludXRlc19vdXQgfHwgJycgKTtcclxuXHRcdHNldF9zZWxlY3RfdmFsdWUoICdib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfaW4nLCBzZXR0aW5ncy5ib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfaW4gfHwgJycgKTtcclxuXHRcdHNldF9zZWxlY3RfdmFsdWUoICdib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfb3V0Jywgc2V0dGluZ3MuYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9kYXlzX291dCB8fCAnJyApO1xyXG5cclxuXHRcdCRmb3JtLmZpbmQoICdpbnB1dFtuYW1lPVwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9pbl9vdXRcIl0nICkucHJvcCggJ2NoZWNrZWQnLCBmYWxzZSApO1xyXG5cdFx0JGZvcm0uZmluZCggJ2lucHV0W25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2luX291dFwiXVt2YWx1ZT1cIicgKyAoIHNldHRpbmdzLmJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfaW5fb3V0IHx8ICcnICkgKyAnXCJdJyApLnByb3AoICdjaGVja2VkJywgdHJ1ZSApO1xyXG5cdFx0YXBwbHlfd29ya2luZ190aW1lX3NldHRpbmdzX3RvX2Zvcm0oIHNldHRpbmdzLndvcmtpbmdfdGltZSB8fCB7fSwgJCggJyN3cGJjX2FnX3Jlc291cmNlX2lkJyApLnZhbCgpICk7XHJcblxyXG5cdFx0cmVmcmVzaF9idWZmZXJfZmllbGRzKCk7XHJcblx0XHRzeW5jX2FsbF9yYW5nZXMoKTtcclxuXHRcdHNjaGVkdWxlX3ByZXZpZXdfcmVmcmVzaCgpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZGF0ZV9mcm9tX3NxbCggc3FsX2RhdGUgKSB7XHJcblx0XHR2YXIgcGFydHMgPSBTdHJpbmcoIHNxbF9kYXRlIHx8ICcnICkuc3BsaXQoICctJyApO1xyXG5cdFx0aWYgKCBwYXJ0cy5sZW5ndGggIT09IDMgKSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIG5ldyBEYXRlKCBwYXJzZUludCggcGFydHNbMF0sIDEwICksIHBhcnNlSW50KCBwYXJ0c1sxXSwgMTAgKSAtIDEsIHBhcnNlSW50KCBwYXJ0c1syXSwgMTAgKSwgMCwgMCwgMCApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X3RvZGF5X2RhdGUoKSB7XHJcblx0XHR2YXIgYXJyID0gdy5fd3BiYyAmJiB0eXBlb2Ygdy5fd3BiYy5nZXRfb3RoZXJfcGFyYW0gPT09ICdmdW5jdGlvbicgPyB3Ll93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgKSA6IG51bGw7XHJcblx0XHRpZiAoIGFyciAmJiBhcnIubGVuZ3RoID49IDMgKSB7XHJcblx0XHRcdHJldHVybiBuZXcgRGF0ZSggcGFyc2VJbnQoIGFyclswXSwgMTAgKSwgcGFyc2VJbnQoIGFyclsxXSwgMTAgKSAtIDEsIHBhcnNlSW50KCBhcnJbMl0sIDEwICksIDAsIDAsIDAgKTtcclxuXHRcdH1cclxuXHRcdHZhciBub3cgPSBuZXcgRGF0ZSgpO1xyXG5cdFx0cmV0dXJuIG5ldyBEYXRlKCBub3cuZ2V0RnVsbFllYXIoKSwgbm93LmdldE1vbnRoKCksIG5vdy5nZXREYXRlKCksIDAsIDAsIDAgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9yZWFsX3RvZGF5X2RhdGUoKSB7XHJcblx0XHR2YXIgYXJyID0gdy5fd3BiYyAmJiB0eXBlb2Ygdy5fd3BiYy5nZXRfb3RoZXJfcGFyYW0gPT09ICdmdW5jdGlvbicgPyB3Ll93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RpbWVfbG9jYWxfYXJyJyApIDogbnVsbDtcclxuXHRcdGlmICggYXJyICYmIGFyci5sZW5ndGggPj0gMyApIHtcclxuXHRcdFx0cmV0dXJuIG5ldyBEYXRlKCBwYXJzZUludCggYXJyWzBdLCAxMCApLCBwYXJzZUludCggYXJyWzFdLCAxMCApIC0gMSwgcGFyc2VJbnQoIGFyclsyXSwgMTAgKSwgMCwgMCwgMCApO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIGdldF90b2RheV9kYXRlKCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBkYXlzX2JldHdlZW4oIGRhdGVfYSwgZGF0ZV9iICkge1xyXG5cdFx0cmV0dXJuIE1hdGguZmxvb3IoICggZGF0ZV9hLmdldFRpbWUoKSAtIGRhdGVfYi5nZXRUaW1lKCkgKSAvIDg2NDAwMDAwICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBhZGRfZGF5cyggZGF0ZSwgZGF5cyApIHtcclxuXHRcdHZhciBzaGlmdGVkX2RhdGUgPSBuZXcgRGF0ZSggZGF0ZS5nZXRGdWxsWWVhcigpLCBkYXRlLmdldE1vbnRoKCksIGRhdGUuZ2V0RGF0ZSgpLCAwLCAwLCAwICk7XHJcblx0XHRzaGlmdGVkX2RhdGUuc2V0RGF0ZSggc2hpZnRlZF9kYXRlLmdldERhdGUoKSArIGRheXMgKTtcclxuXHRcdHJldHVybiBzaGlmdGVkX2RhdGU7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBkYXRlX3RvX3NxbCggZGF0ZSApIHtcclxuXHRcdHZhciBtb250aCA9IFN0cmluZyggZGF0ZS5nZXRNb250aCgpICsgMSApO1xyXG5cdFx0dmFyIGRheSA9IFN0cmluZyggZGF0ZS5nZXREYXRlKCkgKTtcclxuXHJcblx0XHRpZiAoIG1vbnRoLmxlbmd0aCA8IDIgKSB7XHJcblx0XHRcdG1vbnRoID0gJzAnICsgbW9udGg7XHJcblx0XHR9XHJcblx0XHRpZiAoIGRheS5sZW5ndGggPCAyICkge1xyXG5cdFx0XHRkYXkgPSAnMCcgKyBkYXk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGRhdGUuZ2V0RnVsbFllYXIoKSArICctJyArIG1vbnRoICsgJy0nICsgZGF5O1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X3NxbF9kYXRlX2Zyb21fY2VsbCggY2VsbCApIHtcclxuXHRcdHZhciBjbGFzc2VzID0gU3RyaW5nKCBjZWxsLmNsYXNzTmFtZSB8fCAnJyApLnNwbGl0KCAvXFxzKy8gKTtcclxuXHRcdHZhciBpO1xyXG5cdFx0Zm9yICggaSA9IDA7IGkgPCBjbGFzc2VzLmxlbmd0aDsgaSsrICkge1xyXG5cdFx0XHRpZiAoIGNsYXNzZXNbaV0uaW5kZXhPZiggJ3NxbF9kYXRlXycgKSA9PT0gMCApIHtcclxuXHRcdFx0XHRyZXR1cm4gY2xhc3Nlc1tpXS5yZXBsYWNlKCAnc3FsX2RhdGVfJywgJycgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0cmV0dXJuICcnO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdW5hdmFpbGFibGVfZnJvbV90b2RheV9hcHBsaWVzKCBjZWxsX2RhdGUsIHRvZGF5X2RhdGUsIHZhbHVlICkge1xyXG5cdFx0dmFyIG1pbnV0ZXM7XHJcblx0XHR2YXIgbm93O1xyXG5cdFx0dmFyIHVuYXZhaWxhYmxlX3VudGlsO1xyXG5cclxuXHRcdGlmICggISB2YWx1ZSB8fCB2YWx1ZSA9PT0gJzAnICkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAvbSQvLnRlc3QoIHZhbHVlICkgKSB7XHJcblx0XHRcdG1pbnV0ZXMgPSBwYXJzZUludCggdmFsdWUsIDEwICk7XHJcblx0XHRcdGlmICggISBtaW51dGVzICkge1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRub3cgPSBuZXcgRGF0ZSgpO1xyXG5cdFx0XHR1bmF2YWlsYWJsZV91bnRpbCA9IG5ldyBEYXRlKCBub3cuZ2V0VGltZSgpICsgKCAoIG1pbnV0ZXMgLSAxICkgKiA2MDAwMCApICk7XHJcblx0XHRcdHVuYXZhaWxhYmxlX3VudGlsID0gbmV3IERhdGUoIHVuYXZhaWxhYmxlX3VudGlsLmdldEZ1bGxZZWFyKCksIHVuYXZhaWxhYmxlX3VudGlsLmdldE1vbnRoKCksIHVuYXZhaWxhYmxlX3VudGlsLmdldERhdGUoKSwgMCwgMCwgMCApO1xyXG5cdFx0XHRyZXR1cm4gY2VsbF9kYXRlLmdldFRpbWUoKSA8PSB1bmF2YWlsYWJsZV91bnRpbC5nZXRUaW1lKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGRheXNfYmV0d2VlbiggY2VsbF9kYXRlLCB0b2RheV9kYXRlICkgPCBwYXJzZUludCggdmFsdWUsIDEwICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfb3B0aW9uX3RleHQoIHNlbGVjdG9yICkge1xyXG5cdFx0dmFyIHRleHQgPSAkKCBzZWxlY3RvciApLmZpbmQoICdvcHRpb246c2VsZWN0ZWQnICkudGV4dCgpO1xyXG5cdFx0cmV0dXJuIHRyaW1fdGV4dCggdGV4dCApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X2RheXNfdmFsdWUoIHZhbHVlICkge1xyXG5cdFx0aWYgKCAhIHZhbHVlIHx8ICEgL2QkLy50ZXN0KCB2YWx1ZSApICkge1xyXG5cdFx0XHRyZXR1cm4gMDtcclxuXHRcdH1cclxuXHRcdHJldHVybiBwYXJzZUludCggdmFsdWUsIDEwICkgfHwgMDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHRpbWVfdG9fc2Vjb25kcyggdGltZSApIHtcclxuXHRcdHZhciBwYXJ0cyA9IFN0cmluZyggdGltZSB8fCAnJyApLnNwbGl0KCAnOicgKTtcclxuXHRcdHZhciBob3VycztcclxuXHRcdHZhciBtaW5zO1xyXG5cclxuXHRcdGlmICggcGFydHMubGVuZ3RoIDwgMiApIHtcclxuXHRcdFx0cmV0dXJuIDA7XHJcblx0XHR9XHJcblxyXG5cdFx0aG91cnMgPSBNYXRoLm1heCggMCwgTWF0aC5taW4oIDI0LCBwYXJzZUludCggcGFydHNbMF0sIDEwICkgfHwgMCApICk7XHJcblx0XHRtaW5zID0gaG91cnMgPT09IDI0ID8gMCA6IE1hdGgubWF4KCAwLCBNYXRoLm1pbiggNTksIHBhcnNlSW50KCBwYXJ0c1sxXSwgMTAgKSB8fCAwICkgKTtcclxuXHJcblx0XHRyZXR1cm4gTWF0aC5taW4oIDg2NDAwLCAoIGhvdXJzICogMzYwMCApICsgKCBtaW5zICogNjAgKSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2Vjb25kc190b190aW1lKCBzZWNvbmRzICkge1xyXG5cdFx0dmFyIGhvdXJzO1xyXG5cdFx0dmFyIG1pbnM7XHJcblxyXG5cdFx0c2Vjb25kcyA9IE1hdGgubWF4KCAwLCBNYXRoLm1pbiggODY0MDAsIHBhcnNlSW50KCBzZWNvbmRzLCAxMCApIHx8IDAgKSApO1xyXG5cdFx0aG91cnMgPSBNYXRoLmZsb29yKCBzZWNvbmRzIC8gMzYwMCApO1xyXG5cdFx0bWlucyA9IE1hdGguZmxvb3IoICggc2Vjb25kcyAlIDM2MDAgKSAvIDYwICk7XHJcblxyXG5cdFx0cmV0dXJuICggaG91cnMgPCAxMCA/ICcwJyA6ICcnICkgKyBob3VycyArICc6JyArICggbWlucyA8IDEwID8gJzAnIDogJycgKSArIG1pbnM7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBjb2xsZWN0X3dvcmtpbmdfdGltZV93ZWVrZGF5cyggcHJlZml4ICkge1xyXG5cdFx0dmFyICRmb3JtID0gZ2V0X2Zvcm0oKTtcclxuXHRcdHZhciB3ZWVrZGF5cyA9IHt9O1xyXG5cclxuXHRcdCRmb3JtLmZpbmQoICdbZGF0YS13cGJjLXdvcmtpbmctdGltZS13ZWVrZGF5cz1cIicgKyBwcmVmaXggKyAnXCJdIC53cGJjX2FnX3dvcmtpbmdfdGltZV9yb3cnICkuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR2YXIgJHJvdyA9ICQoIHRoaXMgKTtcclxuXHRcdFx0dmFyIGRheSA9IHBhcnNlSW50KCAkcm93LmZpbmQoICdpbnB1dFt0eXBlPVwiY2hlY2tib3hcIl0nICkudmFsKCksIDEwICk7XHJcblxyXG5cdFx0XHR3ZWVrZGF5c1sgZGF5IF0gPSBbXTtcclxuXHRcdFx0aWYgKCAhICRyb3cuZmluZCggJ2lucHV0W3R5cGU9XCJjaGVja2JveFwiXScgKS5wcm9wKCAnY2hlY2tlZCcgKSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHdlZWtkYXlzWyBkYXkgXS5wdXNoKCB7XHJcblx0XHRcdFx0c3RhcnRfc2Vjb25kOiB0aW1lX3RvX3NlY29uZHMoICRyb3cuZmluZCggJy53cGJjX2FnX3dvcmtpbmdfdGltZV9zdGFydCcgKS52YWwoKSApLFxyXG5cdFx0XHRcdGVuZF9zZWNvbmQ6IHRpbWVfdG9fc2Vjb25kcyggJHJvdy5maW5kKCAnLndwYmNfYWdfd29ya2luZ190aW1lX2VuZCcgKS52YWwoKSApXHJcblx0XHRcdH0gKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRyZXR1cm4gd2Vla2RheXM7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZXRfd29ya2luZ190aW1lX3dlZWtkYXlzKCBwcmVmaXgsIHdlZWtkYXlzICkge1xyXG5cdFx0dmFyICR3cmFwID0gZ2V0X2Zvcm0oKS5maW5kKCAnW2RhdGEtd3BiYy13b3JraW5nLXRpbWUtd2Vla2RheXM9XCInICsgcHJlZml4ICsgJ1wiXScgKTtcclxuXHJcblx0XHQkd3JhcC5maW5kKCAnLndwYmNfYWdfd29ya2luZ190aW1lX3JvdycgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHZhciAkcm93ID0gJCggdGhpcyApO1xyXG5cdFx0XHR2YXIgZGF5ID0gcGFyc2VJbnQoICRyb3cuZmluZCggJ2lucHV0W3R5cGU9XCJjaGVja2JveFwiXScgKS52YWwoKSwgMTAgKTtcclxuXHRcdFx0dmFyIGludGVydmFscyA9IHdlZWtkYXlzICYmIHdlZWtkYXlzWyBkYXkgXSA/IHdlZWtkYXlzWyBkYXkgXSA6IFtdO1xyXG5cdFx0XHR2YXIgaW50ZXJ2YWwgPSBpbnRlcnZhbHMubGVuZ3RoID8gaW50ZXJ2YWxzWzBdIDogeyBzdGFydF9zZWNvbmQ6IDMyNDAwLCBlbmRfc2Vjb25kOiA2NDgwMCB9O1xyXG5cclxuXHRcdFx0JHJvdy5maW5kKCAnaW5wdXRbdHlwZT1cImNoZWNrYm94XCJdJyApLnByb3AoICdjaGVja2VkJywgaW50ZXJ2YWxzLmxlbmd0aCA+IDAgKTtcclxuXHRcdFx0JHJvdy5maW5kKCAnLndwYmNfYWdfd29ya2luZ190aW1lX3N0YXJ0JyApLnZhbCggc2Vjb25kc190b190aW1lKCBpbnRlcnZhbC5zdGFydF9zZWNvbmQgKSApO1xyXG5cdFx0XHQkcm93LmZpbmQoICcud3BiY19hZ193b3JraW5nX3RpbWVfZW5kJyApLnZhbCggc2Vjb25kc190b190aW1lKCBpbnRlcnZhbC5lbmRfc2Vjb25kICkgKTtcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJlZnJlc2hfd29ya2luZ190aW1lX3BhbmVscygpIHtcclxuXHRcdHZhciBpc19lbmFibGVkID0gZ2V0X2Zvcm0oKS5maW5kKCAnaW5wdXRbbmFtZT1cImJvb2tpbmdfd29ya2luZ190aW1lX2VuYWJsZWRcIl0nICkucHJvcCggJ2NoZWNrZWQnICk7XHJcblx0XHR2YXIgbW9kZSA9IGdldF9mb3JtKCkuZmluZCggJ2lucHV0W25hbWU9XCJib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZV9tb2RlXCJdOmNoZWNrZWQnICkudmFsKCkgfHwgJ2luaGVyaXQnO1xyXG5cclxuXHRcdGdldF9mb3JtKClcclxuXHRcdFx0LmZpbmQoICcud3BiY19hZ193b3JraW5nX3RpbWVfYmxvY2snIClcclxuXHRcdFx0LnRvZ2dsZUNsYXNzKCAnaXMtZGlzYWJsZWQnLCAhIGlzX2VuYWJsZWQgKVxyXG5cdFx0XHQuZmluZCggJ2lucHV0LCBzZWxlY3QsIGJ1dHRvbicgKVxyXG5cdFx0XHQucHJvcCggJ2Rpc2FibGVkJywgISBpc19lbmFibGVkICk7XHJcblxyXG5cdFx0Z2V0X2Zvcm0oKS5maW5kKCAnW2RhdGEtd3BiYy13b3JraW5nLXRpbWUtcmVzb3VyY2UtY3VzdG9tXScgKS50b2dnbGVDbGFzcyggJ2lzLXZpc2libGUnLCBtb2RlID09PSAnY3VzdG9tJyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X3dvcmtpbmdfdGltZV9zZXR0aW5nc19mcm9tX2Zvcm0oKSB7XHJcblx0XHR2YXIgJGZvcm0gPSBnZXRfZm9ybSgpO1xyXG5cdFx0dmFyIHJlc291cmNlSWQgPSBwYXJzZUludCggJGZvcm0uZmluZCggJ1tkYXRhLXdwYmMtd29ya2luZy10aW1lLXJlc291cmNlLWlkXScgKS52YWwoKSwgMTAgKSB8fCBwYXJzZUludCggJCggJyN3cGJjX2FnX3Jlc291cmNlX2lkJyApLnZhbCgpLCAxMCApIHx8IDA7XHJcblx0XHR2YXIgd29ya2luZ1RpbWUgPSAkLmV4dGVuZCggdHJ1ZSwge30sIGNmZy5zZXR0aW5ncyAmJiBjZmcuc2V0dGluZ3Mud29ya2luZ190aW1lID8gY2ZnLnNldHRpbmdzLndvcmtpbmdfdGltZSA6ICggY2ZnLmRlZmF1bHRfc2V0dGluZ3MgJiYgY2ZnLmRlZmF1bHRfc2V0dGluZ3Mud29ya2luZ190aW1lID8gY2ZnLmRlZmF1bHRfc2V0dGluZ3Mud29ya2luZ190aW1lIDoge30gKSApO1xyXG5cclxuXHRcdGlmICggISB3b3JraW5nVGltZS5kZWZhdWx0ICkge1xyXG5cdFx0XHR3b3JraW5nVGltZS5kZWZhdWx0ID0ge307XHJcblx0XHR9XHJcblx0XHRpZiAoICEgd29ya2luZ1RpbWUucmVzb3VyY2VzICkge1xyXG5cdFx0XHR3b3JraW5nVGltZS5yZXNvdXJjZXMgPSB7fTtcclxuXHRcdH1cclxuXHJcblx0XHR3b3JraW5nVGltZS5lbmFibGVkID0gJGZvcm0uZmluZCggJ2lucHV0W25hbWU9XCJib29raW5nX3dvcmtpbmdfdGltZV9lbmFibGVkXCJdJyApLnByb3AoICdjaGVja2VkJyApID8gJ09uJyA6ICdPZmYnO1xyXG5cdFx0d29ya2luZ1RpbWUuZGVmYXVsdC53ZWVrZGF5cyA9IGNvbGxlY3Rfd29ya2luZ190aW1lX3dlZWtkYXlzKCAnYm9va2luZ193b3JraW5nX3RpbWVfZGVmYXVsdCcgKTtcclxuXHJcblx0XHRpZiAoIHJlc291cmNlSWQgPiAwICkge1xyXG5cdFx0XHR3b3JraW5nVGltZS5yZXNvdXJjZXNbIHJlc291cmNlSWQgXSA9IHtcclxuXHRcdFx0XHRtb2RlOiAkZm9ybS5maW5kKCAnaW5wdXRbbmFtZT1cImJvb2tpbmdfd29ya2luZ190aW1lX3Jlc291cmNlX21vZGVcIl06Y2hlY2tlZCcgKS52YWwoKSB8fCAnaW5oZXJpdCcsXHJcblx0XHRcdFx0d2Vla2RheXM6IGNvbGxlY3Rfd29ya2luZ190aW1lX3dlZWtkYXlzKCAnYm9va2luZ193b3JraW5nX3RpbWVfcmVzb3VyY2UnIClcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gd29ya2luZ1RpbWU7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBhcHBseV93b3JraW5nX3RpbWVfc2V0dGluZ3NfdG9fZm9ybSggd29ya2luZ1RpbWUsIHJlc291cmNlSWQgKSB7XHJcblx0XHR2YXIgcmVzb3VyY2VTZXR0aW5ncztcclxuXHJcblx0XHR3b3JraW5nVGltZSA9IHdvcmtpbmdUaW1lIHx8IHt9O1xyXG5cdFx0cmVzb3VyY2VJZCA9IHBhcnNlSW50KCByZXNvdXJjZUlkLCAxMCApIHx8IHBhcnNlSW50KCAkKCAnI3dwYmNfYWdfcmVzb3VyY2VfaWQnICkudmFsKCksIDEwICkgfHwgMDtcclxuXHRcdHJlc291cmNlU2V0dGluZ3MgPSB3b3JraW5nVGltZS5yZXNvdXJjZXMgJiYgd29ya2luZ1RpbWUucmVzb3VyY2VzWyByZXNvdXJjZUlkIF0gPyB3b3JraW5nVGltZS5yZXNvdXJjZXNbIHJlc291cmNlSWQgXSA6IHtcclxuXHRcdFx0bW9kZTogJ2luaGVyaXQnLFxyXG5cdFx0XHR3ZWVrZGF5czogd29ya2luZ1RpbWUuZGVmYXVsdCAmJiB3b3JraW5nVGltZS5kZWZhdWx0LndlZWtkYXlzID8gd29ya2luZ1RpbWUuZGVmYXVsdC53ZWVrZGF5cyA6IHt9XHJcblx0XHR9O1xyXG5cclxuXHRcdGdldF9mb3JtKCkuZmluZCggJ2lucHV0W25hbWU9XCJib29raW5nX3dvcmtpbmdfdGltZV9lbmFibGVkXCJdJyApLnByb3AoICdjaGVja2VkJywgd29ya2luZ1RpbWUuZW5hYmxlZCA9PT0gJ09uJyApO1xyXG5cdFx0Z2V0X2Zvcm0oKS5maW5kKCAnW2RhdGEtd3BiYy13b3JraW5nLXRpbWUtcmVzb3VyY2UtaWRdJyApLnZhbCggcmVzb3VyY2VJZCApO1xyXG5cdFx0c2V0X3dvcmtpbmdfdGltZV93ZWVrZGF5cyggJ2Jvb2tpbmdfd29ya2luZ190aW1lX2RlZmF1bHQnLCB3b3JraW5nVGltZS5kZWZhdWx0ICYmIHdvcmtpbmdUaW1lLmRlZmF1bHQud2Vla2RheXMgPyB3b3JraW5nVGltZS5kZWZhdWx0LndlZWtkYXlzIDoge30gKTtcclxuXHRcdGdldF9mb3JtKCkuZmluZCggJ2lucHV0W25hbWU9XCJib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZV9tb2RlXCJdW3ZhbHVlPVwiJyArICggcmVzb3VyY2VTZXR0aW5ncy5tb2RlIHx8ICdpbmhlcml0JyApICsgJ1wiXScgKS5wcm9wKCAnY2hlY2tlZCcsIHRydWUgKTtcclxuXHRcdHNldF93b3JraW5nX3RpbWVfd2Vla2RheXMoICdib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZScsIHJlc291cmNlU2V0dGluZ3Mud2Vla2RheXMgfHwgKCB3b3JraW5nVGltZS5kZWZhdWx0ID8gd29ya2luZ1RpbWUuZGVmYXVsdC53ZWVrZGF5cyA6IHt9ICkgKTtcclxuXHRcdHJlZnJlc2hfd29ya2luZ190aW1lX3BhbmVscygpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYXBwZW5kX3dvcmtpbmdfdGltZV9wYXlsb2FkKCBwYXlsb2FkICkge1xyXG5cdFx0dmFyICRmb3JtID0gZ2V0X2Zvcm0oKTtcclxuXHRcdHZhciBkZWZhdWx0RGF5cyA9IFtdO1xyXG5cdFx0dmFyIHJlc291cmNlRGF5cyA9IFtdO1xyXG5cdFx0dmFyIGRlZmF1bHRTdGFydCA9IHt9O1xyXG5cdFx0dmFyIGRlZmF1bHRFbmQgPSB7fTtcclxuXHRcdHZhciByZXNvdXJjZVN0YXJ0ID0ge307XHJcblx0XHR2YXIgcmVzb3VyY2VFbmQgPSB7fTtcclxuXHJcblx0XHQkZm9ybS5maW5kKCAnW2RhdGEtd3BiYy13b3JraW5nLXRpbWUtd2Vla2RheXM9XCJib29raW5nX3dvcmtpbmdfdGltZV9kZWZhdWx0XCJdIC53cGJjX2FnX3dvcmtpbmdfdGltZV9yb3cnICkuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR2YXIgJHJvdyA9ICQoIHRoaXMgKTtcclxuXHRcdFx0dmFyIGRheSA9IHBhcnNlSW50KCAkcm93LmZpbmQoICdpbnB1dFt0eXBlPVwiY2hlY2tib3hcIl0nICkudmFsKCksIDEwICk7XHJcblxyXG5cdFx0XHRkZWZhdWx0U3RhcnRbIGRheSBdID0gJHJvdy5maW5kKCAnLndwYmNfYWdfd29ya2luZ190aW1lX3N0YXJ0JyApLnZhbCgpIHx8ICcwOTowMCc7XHJcblx0XHRcdGRlZmF1bHRFbmRbIGRheSBdID0gJHJvdy5maW5kKCAnLndwYmNfYWdfd29ya2luZ190aW1lX2VuZCcgKS52YWwoKSB8fCAnMTg6MDAnO1xyXG5cdFx0XHRpZiAoICRyb3cuZmluZCggJ2lucHV0W3R5cGU9XCJjaGVja2JveFwiXScgKS5wcm9wKCAnY2hlY2tlZCcgKSApIHtcclxuXHRcdFx0XHRkZWZhdWx0RGF5cy5wdXNoKCBkYXkgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cclxuXHRcdCRmb3JtLmZpbmQoICdbZGF0YS13cGJjLXdvcmtpbmctdGltZS13ZWVrZGF5cz1cImJvb2tpbmdfd29ya2luZ190aW1lX3Jlc291cmNlXCJdIC53cGJjX2FnX3dvcmtpbmdfdGltZV9yb3cnICkuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR2YXIgJHJvdyA9ICQoIHRoaXMgKTtcclxuXHRcdFx0dmFyIGRheSA9IHBhcnNlSW50KCAkcm93LmZpbmQoICdpbnB1dFt0eXBlPVwiY2hlY2tib3hcIl0nICkudmFsKCksIDEwICk7XHJcblxyXG5cdFx0XHRyZXNvdXJjZVN0YXJ0WyBkYXkgXSA9ICRyb3cuZmluZCggJy53cGJjX2FnX3dvcmtpbmdfdGltZV9zdGFydCcgKS52YWwoKSB8fCAnMDk6MDAnO1xyXG5cdFx0XHRyZXNvdXJjZUVuZFsgZGF5IF0gPSAkcm93LmZpbmQoICcud3BiY19hZ193b3JraW5nX3RpbWVfZW5kJyApLnZhbCgpIHx8ICcxODowMCc7XHJcblx0XHRcdGlmICggJHJvdy5maW5kKCAnaW5wdXRbdHlwZT1cImNoZWNrYm94XCJdJyApLnByb3AoICdjaGVja2VkJyApICkge1xyXG5cdFx0XHRcdHJlc291cmNlRGF5cy5wdXNoKCBkYXkgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cclxuXHRcdHBheWxvYWQuYm9va2luZ193b3JraW5nX3RpbWVfZW5hYmxlZCA9ICRmb3JtLmZpbmQoICdpbnB1dFtuYW1lPVwiYm9va2luZ193b3JraW5nX3RpbWVfZW5hYmxlZFwiXScgKS5wcm9wKCAnY2hlY2tlZCcgKSA/ICdPbicgOiAnJztcclxuXHRcdHBheWxvYWQuYm9va2luZ193b3JraW5nX3RpbWVfcmVzb3VyY2VfaWQgPSAkZm9ybS5maW5kKCAnW2RhdGEtd3BiYy13b3JraW5nLXRpbWUtcmVzb3VyY2UtaWRdJyApLnZhbCgpIHx8ICQoICcjd3BiY19hZ19yZXNvdXJjZV9pZCcgKS52YWwoKSB8fCAnJztcclxuXHRcdHBheWxvYWQuYm9va2luZ193b3JraW5nX3RpbWVfcmVzb3VyY2VfbW9kZSA9ICRmb3JtLmZpbmQoICdpbnB1dFtuYW1lPVwiYm9va2luZ193b3JraW5nX3RpbWVfcmVzb3VyY2VfbW9kZVwiXTpjaGVja2VkJyApLnZhbCgpIHx8ICdpbmhlcml0JztcclxuXHRcdHBheWxvYWQuYm9va2luZ193b3JraW5nX3RpbWVfZGVmYXVsdF9kYXlzID0gZGVmYXVsdERheXM7XHJcblx0XHRwYXlsb2FkLmJvb2tpbmdfd29ya2luZ190aW1lX2RlZmF1bHRfc3RhcnQgPSBkZWZhdWx0U3RhcnQ7XHJcblx0XHRwYXlsb2FkLmJvb2tpbmdfd29ya2luZ190aW1lX2RlZmF1bHRfZW5kID0gZGVmYXVsdEVuZDtcclxuXHRcdHBheWxvYWQuYm9va2luZ193b3JraW5nX3RpbWVfcmVzb3VyY2VfZGF5cyA9IHJlc291cmNlRGF5cztcclxuXHRcdHBheWxvYWQuYm9va2luZ193b3JraW5nX3RpbWVfcmVzb3VyY2Vfc3RhcnQgPSByZXNvdXJjZVN0YXJ0O1xyXG5cdFx0cGF5bG9hZC5ib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZV9lbmQgPSByZXNvdXJjZUVuZDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHVwZGF0ZV93cGJjX3ByZXZpZXdfcGFyYW1zKCBzZXR0aW5ncyApIHtcclxuXHRcdGlmICggISB3Ll93cGJjIHx8IHR5cGVvZiB3Ll93cGJjLnNldF9vdGhlcl9wYXJhbSAhPT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHcuX3dwYmMuc2V0X290aGVyX3BhcmFtKCAnYXZhaWxhYmlsaXR5X193ZWVrX2RheXNfdW5hdmFpbGFibGUnLCBzZXR0aW5ncy53ZWVrZGF5cy5jb25jYXQoIFsgOTk5IF0gKSApO1xyXG5cdFx0dy5fd3BiYy5zZXRfb3RoZXJfcGFyYW0oICdhdmFpbGFiaWxpdHlfX2F2YWlsYWJsZV9mcm9tX3RvZGF5JywgaXNfYXZhaWxhYmxlX2xpbWl0X2F2YWlsYWJsZSgpID8gKCBzZXR0aW5ncy5ib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5IHx8ICcnICkgOiAnJyApO1xyXG5cdFx0dy5fd3BiYy5zZXRfb3RoZXJfcGFyYW0oICdhdmFpbGFiaWxpdHlfX3VuYXZhaWxhYmxlX2Zyb21fdG9kYXknLCBzZXR0aW5ncy5ib29raW5nX3VuYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXkgfHwgJzAnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB1cGRhdGVfYnVmZmVyX3ByZXZpZXdfbm90ZSggc2V0dGluZ3MgKSB7XHJcblx0XHR2YXIgJG5vdGVzID0gJCggJ1tkYXRhLXdwYmMtYWctY2FsZW5kYXItbm90ZXM9XCIxXCJdJyApLmZpcnN0KCk7XHJcblx0XHR2YXIgJGNhbGVuZGFyID0gJCggJ1tkYXRhLXdwYmMtYWctY2FsZW5kYXItcGFuZWw9XCIxXCJdJyApLmZpcnN0KCk7XHJcblx0XHR2YXIgJG5vdGUgPSAkbm90ZXMuZmluZCggJy53cGJjX2FnX2J1ZmZlcl9wcmV2aWV3X25vdGUnICk7XHJcblx0XHR2YXIgdHlwZSA9IHNldHRpbmdzLmJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfaW5fb3V0IHx8ICcnO1xyXG5cdFx0dmFyIGJlZm9yZV90ZXh0ID0gJyc7XHJcblx0XHR2YXIgYWZ0ZXJfdGV4dCA9ICcnO1xyXG5cdFx0dmFyIG1lc3NhZ2UgPSAnJztcclxuXHJcblx0XHRpZiAoICEgJG5vdGVzLmxlbmd0aCB8fCAhICRjYWxlbmRhci5sZW5ndGggKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICEgJG5vdGUubGVuZ3RoICkge1xyXG5cdFx0XHQkbm90ZSA9ICQoICc8ZGl2IGNsYXNzPVwid3BiY19hZ19idWZmZXJfcHJldmlld19ub3RlXCIgYXJpYS1saXZlPVwicG9saXRlXCI+PC9kaXY+JyApO1xyXG5cdFx0XHQkbm90ZXMuYXBwZW5kKCAkbm90ZSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISBpc19idWZmZXJfYXZhaWxhYmxlKCkgKSB7XHJcblx0XHRcdCRjYWxlbmRhci5yZW1vdmVDbGFzcyggJ3dwYmNfYWdfcHJldmlld19idWZmZXJfYWN0aXZlJyApO1xyXG5cdFx0XHQkbm90ZS5hdHRyKCAnaGlkZGVuJywgJ2hpZGRlbicgKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRjYWxlbmRhci50b2dnbGVDbGFzcyggJ3dwYmNfYWdfcHJldmlld19idWZmZXJfYWN0aXZlJywgISEgdHlwZSApO1xyXG5cclxuXHRcdGlmICggdHlwZSA9PT0gJ20nICkge1xyXG5cdFx0XHRiZWZvcmVfdGV4dCA9IGdldF9vcHRpb25fdGV4dCggJ1tuYW1lPVwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9taW51dGVzX2luXCJdJyApIHx8ICctJztcclxuXHRcdFx0YWZ0ZXJfdGV4dCA9IGdldF9vcHRpb25fdGV4dCggJ1tuYW1lPVwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9taW51dGVzX291dFwiXScgKSB8fCAnLSc7XHJcblx0XHR9IGVsc2UgaWYgKCB0eXBlID09PSAnZCcgKSB7XHJcblx0XHRcdGJlZm9yZV90ZXh0ID0gZ2V0X29wdGlvbl90ZXh0KCAnW25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfaW5cIl0nICkgfHwgJy0nO1xyXG5cdFx0XHRhZnRlcl90ZXh0ID0gZ2V0X29wdGlvbl90ZXh0KCAnW25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfb3V0XCJdJyApIHx8ICctJztcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIHR5cGUgKSB7XHJcblx0XHRcdG1lc3NhZ2UgPSAnPHN0cm9uZz4nICsgKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5idWZmZXJfcHJldmlldyA/IGNmZy5pMThuLmJ1ZmZlcl9wcmV2aWV3IDogJ0J1ZmZlciBwcmV2aWV3JyApICsgJzo8L3N0cm9uZz4gJyArXHJcblx0XHRcdFx0KCBjZmcuaTE4biAmJiBjZmcuaTE4bi5iZWZvcmVfYm9va2luZyA/IGNmZy5pMThuLmJlZm9yZV9ib29raW5nIDogJ0JlZm9yZSBib29raW5nJyApICsgJyAnICsgYmVmb3JlX3RleHQgK1xyXG5cdFx0XHRcdCcgLyAnICsgKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5hZnRlcl9ib29raW5nID8gY2ZnLmkxOG4uYWZ0ZXJfYm9va2luZyA6ICdBZnRlciBib29raW5nJyApICsgJyAnICsgYWZ0ZXJfdGV4dDtcclxuXHRcdFx0aWYgKCAkbm90ZS5odG1sKCkgIT09IG1lc3NhZ2UgKSB7XHJcblx0XHRcdFx0JG5vdGUuaHRtbCggbWVzc2FnZSApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggJG5vdGUuYXR0ciggJ2hpZGRlbicgKSApIHtcclxuXHRcdFx0XHQkbm90ZS5yZW1vdmVBdHRyKCAnaGlkZGVuJyApO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRtZXNzYWdlID0gY2ZnLmkxOG4gJiYgY2ZnLmkxOG4ubm9fYnVmZmVyID8gY2ZnLmkxOG4ubm9fYnVmZmVyIDogJ05vIGJvb2tpbmcgYnVmZmVyIGlzIHNlbGVjdGVkLic7XHJcblx0XHRcdGlmICggJG5vdGUudGV4dCgpICE9PSBtZXNzYWdlICkge1xyXG5cdFx0XHRcdCRub3RlLnRleHQoIG1lc3NhZ2UgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoICEgJG5vdGUuYXR0ciggJ2hpZGRlbicgKSApIHtcclxuXHRcdFx0XHQkbm90ZS5hdHRyKCAnaGlkZGVuJywgJ2hpZGRlbicgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYXBwbHlfYnVmZmVyX2RheXNfcHJldmlldyggc2V0dGluZ3MgKSB7XHJcblx0XHR2YXIgJGNhbGVuZGFyID0gJCggJ1tkYXRhLXdwYmMtYWctY2FsZW5kYXItcGFuZWw9XCIxXCJdJyApO1xyXG5cdFx0dmFyIGJlZm9yZV9kYXlzID0gZ2V0X2RheXNfdmFsdWUoIHNldHRpbmdzLmJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfZGF5c19pbiApO1xyXG5cdFx0dmFyIGFmdGVyX2RheXMgPSBnZXRfZGF5c192YWx1ZSggc2V0dGluZ3MuYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9kYXlzX291dCApO1xyXG5cdFx0dmFyIGRhdGVfY2VsbHMgPSB7fTtcclxuXHRcdHZhciBib29rZWRfZGF0ZXMgPSBbXTtcclxuXHJcblx0XHRpZiAoICEgaXNfYnVmZmVyX2F2YWlsYWJsZSgpICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBzZXR0aW5ncy5ib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2luX291dCAhPT0gJ2QnIHx8ICggISBiZWZvcmVfZGF5cyAmJiAhIGFmdGVyX2RheXMgKSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRjYWxlbmRhci5maW5kKCAnLmRhdGVwaWNrLWRheXMtY2VsbCcgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHZhciAkY2VsbCA9ICQoIHRoaXMgKTtcclxuXHRcdFx0dmFyIHNxbF9kYXRlID0gZ2V0X3NxbF9kYXRlX2Zyb21fY2VsbCggdGhpcyApO1xyXG5cdFx0XHR2YXIgY2VsbF9kYXRlO1xyXG5cclxuXHRcdFx0aWYgKCAhIHNxbF9kYXRlICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZGF0ZV9jZWxsc1sgc3FsX2RhdGUgXSA9ICRjZWxsO1xyXG5cclxuXHRcdFx0aWYgKCAkY2VsbC5oYXNDbGFzcyggJ2RhdGVfYXBwcm92ZWQnICkgfHwgJGNlbGwuaGFzQ2xhc3MoICdkYXRlMmFwcHJvdmUnICkgKSB7XHJcblx0XHRcdFx0Y2VsbF9kYXRlID0gZGF0ZV9mcm9tX3NxbCggc3FsX2RhdGUgKTtcclxuXHRcdFx0XHRpZiAoIGNlbGxfZGF0ZSApIHtcclxuXHRcdFx0XHRcdGJvb2tlZF9kYXRlcy5wdXNoKCBjZWxsX2RhdGUgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHJcblx0XHQkLmVhY2goIGJvb2tlZF9kYXRlcywgZnVuY3Rpb24gKCBpbmRleCwgYm9va2VkX2RhdGUgKSB7XHJcblx0XHRcdHZhciBvZmZzZXQ7XHJcblx0XHRcdHZhciB0YXJnZXRfc3FsX2RhdGU7XHJcblx0XHRcdHZhciAkdGFyZ2V0X2NlbGw7XHJcblxyXG5cdFx0XHRmb3IgKCBvZmZzZXQgPSBiZWZvcmVfZGF5cyAqIC0xOyBvZmZzZXQgPCAwOyBvZmZzZXQrKyApIHtcclxuXHRcdFx0XHR0YXJnZXRfc3FsX2RhdGUgPSBkYXRlX3RvX3NxbCggYWRkX2RheXMoIGJvb2tlZF9kYXRlLCBvZmZzZXQgKSApO1xyXG5cdFx0XHRcdCR0YXJnZXRfY2VsbCA9IGRhdGVfY2VsbHNbIHRhcmdldF9zcWxfZGF0ZSBdO1xyXG5cdFx0XHRcdGlmICggJHRhcmdldF9jZWxsICYmICEgJHRhcmdldF9jZWxsLmhhc0NsYXNzKCAnZGF0ZV9hcHByb3ZlZCcgKSAmJiAhICR0YXJnZXRfY2VsbC5oYXNDbGFzcyggJ2RhdGUyYXBwcm92ZScgKSApIHtcclxuXHRcdFx0XHRcdHJlbWVtYmVyX3ByZXZpZXdfb3JpZ2luKCAkdGFyZ2V0X2NlbGwgKTtcclxuXHRcdFx0XHRcdCR0YXJnZXRfY2VsbC5hZGRDbGFzcyggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZSB3cGJjX2FnX3ByZXZpZXdfdW5hdmFpbGFibGUgd3BiY19hZ19wcmV2aWV3X2J1ZmZlcl91bmF2YWlsYWJsZSBidWZmZXJfdW5hdmFpbGFibGUnICk7XHJcblx0XHRcdFx0XHQkdGFyZ2V0X2NlbGwuYXR0ciggJ2RhdGEtd3BiYy1hZy1wcmV2aWV3LXJlYXNvbicsICd3cGJjX2FnX3ByZXZpZXdfYnVmZmVyX3VuYXZhaWxhYmxlJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Zm9yICggb2Zmc2V0ID0gMTsgb2Zmc2V0IDw9IGFmdGVyX2RheXM7IG9mZnNldCsrICkge1xyXG5cdFx0XHRcdHRhcmdldF9zcWxfZGF0ZSA9IGRhdGVfdG9fc3FsKCBhZGRfZGF5cyggYm9va2VkX2RhdGUsIG9mZnNldCApICk7XHJcblx0XHRcdFx0JHRhcmdldF9jZWxsID0gZGF0ZV9jZWxsc1sgdGFyZ2V0X3NxbF9kYXRlIF07XHJcblx0XHRcdFx0aWYgKCAkdGFyZ2V0X2NlbGwgJiYgISAkdGFyZ2V0X2NlbGwuaGFzQ2xhc3MoICdkYXRlX2FwcHJvdmVkJyApICYmICEgJHRhcmdldF9jZWxsLmhhc0NsYXNzKCAnZGF0ZTJhcHByb3ZlJyApICkge1xyXG5cdFx0XHRcdFx0cmVtZW1iZXJfcHJldmlld19vcmlnaW4oICR0YXJnZXRfY2VsbCApO1xyXG5cdFx0XHRcdFx0JHRhcmdldF9jZWxsLmFkZENsYXNzKCAnZGF0ZV91c2VyX3VuYXZhaWxhYmxlIHdwYmNfYWdfcHJldmlld191bmF2YWlsYWJsZSB3cGJjX2FnX3ByZXZpZXdfYnVmZmVyX3VuYXZhaWxhYmxlIGJ1ZmZlcl91bmF2YWlsYWJsZScgKTtcclxuXHRcdFx0XHRcdCR0YXJnZXRfY2VsbC5hdHRyKCAnZGF0YS13cGJjLWFnLXByZXZpZXctcmVhc29uJywgJ3dwYmNfYWdfcHJldmlld19idWZmZXJfdW5hdmFpbGFibGUnICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByZW1lbWJlcl9wcmV2aWV3X29yaWdpbiggJGNlbGwgKSB7XHJcblx0XHRpZiAoIHR5cGVvZiAkY2VsbC5hdHRyKCAnZGF0YS13cGJjLWFnLW9yaWdpbmFsLWRhdGUtdXNlci11bmF2YWlsYWJsZScgKSA9PT0gJ3VuZGVmaW5lZCcgKSB7XHJcblx0XHRcdCRjZWxsLmF0dHIoICdkYXRhLXdwYmMtYWctb3JpZ2luYWwtZGF0ZS11c2VyLXVuYXZhaWxhYmxlJywgJGNlbGwuaGFzQ2xhc3MoICdkYXRlX3VzZXJfdW5hdmFpbGFibGUnICkgPyAnMScgOiAnMCcgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGNsZWFyX3ByZXZpZXdfY2VsbCggJGNlbGwgKSB7XHJcblx0XHR2YXIgaGFkX2RhdGVfdXNlcl91bmF2YWlsYWJsZSA9ICRjZWxsLmF0dHIoICdkYXRhLXdwYmMtYWctb3JpZ2luYWwtZGF0ZS11c2VyLXVuYXZhaWxhYmxlJyApID09PSAnMSc7XHJcblxyXG5cdFx0JGNlbGwucmVtb3ZlQ2xhc3MoIHByZXZpZXdfdW5hdmFpbGFibGVfY2xhc3NlcyApO1xyXG5cdFx0JGNlbGwucmVtb3ZlQXR0ciggJ2RhdGEtd3BiYy1hZy1wcmV2aWV3LXJlYXNvbicgKTtcclxuXHRcdCRjZWxsLnJlbW92ZUF0dHIoICdkYXRhLXdwYmMtYWctb3JpZ2luYWwtZGF0ZS11c2VyLXVuYXZhaWxhYmxlJyApO1xyXG5cclxuXHRcdGlmICggISBoYWRfZGF0ZV91c2VyX3VuYXZhaWxhYmxlICkge1xyXG5cdFx0XHQkY2VsbC5yZW1vdmVDbGFzcyggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGFwcGx5X2NhbGVuZGFyX3ByZXZpZXcoKSB7XHJcblx0XHR2YXIgc2V0dGluZ3MgPSBjb2xsZWN0X3NldHRpbmdzKCk7XHJcblx0XHR2YXIgdG9kYXlfZGF0ZSA9IGdldF9yZWFsX3RvZGF5X2RhdGUoKTtcclxuXHRcdHZhciBhdmFpbGFibGVfbGltaXQgPSBpc19hdmFpbGFibGVfbGltaXRfYXZhaWxhYmxlKCkgPyBwYXJzZUludCggc2V0dGluZ3MuYm9va2luZ19hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheSB8fCAnMCcsIDEwICkgOiAwO1xyXG5cdFx0dmFyICRjYWxlbmRhciA9ICQoICdbZGF0YS13cGJjLWFnLWNhbGVuZGFyLXBhbmVsPVwiMVwiXScgKTtcclxuXHJcblx0XHR1cGRhdGVfd3BiY19wcmV2aWV3X3BhcmFtcyggc2V0dGluZ3MgKTtcclxuXHRcdHVwZGF0ZV9idWZmZXJfcHJldmlld19ub3RlKCBzZXR0aW5ncyApO1xyXG5cclxuXHRcdCRjYWxlbmRhci5maW5kKCAnLmRhdGVwaWNrLWRheXMtY2VsbCcgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHZhciBjZWxsID0gdGhpcztcclxuXHRcdFx0dmFyICRjZWxsID0gJCggY2VsbCApO1xyXG5cdFx0XHR2YXIgc3FsX2RhdGUgPSBnZXRfc3FsX2RhdGVfZnJvbV9jZWxsKCBjZWxsICk7XHJcblx0XHRcdHZhciBjZWxsX2RhdGUgPSBkYXRlX2Zyb21fc3FsKCBzcWxfZGF0ZSApO1xyXG5cdFx0XHR2YXIgbWFrZV91bmF2YWlsYWJsZSA9IGZhbHNlO1xyXG5cdFx0XHR2YXIgcmVhc29uX2NsYXNzID0gJyc7XHJcblx0XHRcdHZhciBwcmV2aW91c19yZWFzb24gPSAkY2VsbC5hdHRyKCAnZGF0YS13cGJjLWFnLXByZXZpZXctcmVhc29uJyApIHx8ICcnO1xyXG5cdFx0XHR2YXIgaGFkX2dlbmVyYWxfcHJldmlldyA9ICEhIHByZXZpb3VzX3JlYXNvbiB8fCAkY2VsbC5oYXNDbGFzcyggJ3dwYmNfYWdfcHJldmlld191bmF2YWlsYWJsZScgKSB8fCAkY2VsbC5oYXNDbGFzcyggJ3dlZWtkYXlfdW5hdmFpbGFibGUnICkgfHwgJGNlbGwuaGFzQ2xhc3MoICdmcm9tX3RvZGF5X3VuYXZhaWxhYmxlJyApIHx8ICRjZWxsLmhhc0NsYXNzKCAnbGltaXRfYXZhaWxhYmxlX2Zyb21fdG9kYXknICkgfHwgJGNlbGwuaGFzQ2xhc3MoICdidWZmZXJfdW5hdmFpbGFibGUnICk7XHJcblxyXG5cdFx0XHRpZiAoICEgY2VsbF9kYXRlICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBzZXR0aW5ncy53ZWVrZGF5cy5pbmRleE9mKCBjZWxsX2RhdGUuZ2V0RGF5KCkgKSA+IC0xICkge1xyXG5cdFx0XHRcdG1ha2VfdW5hdmFpbGFibGUgPSB0cnVlO1xyXG5cdFx0XHRcdHJlYXNvbl9jbGFzcyA9ICd3cGJjX2FnX3ByZXZpZXdfd2Vla2RheV91bmF2YWlsYWJsZSc7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggdW5hdmFpbGFibGVfZnJvbV90b2RheV9hcHBsaWVzKCBjZWxsX2RhdGUsIHRvZGF5X2RhdGUsIHNldHRpbmdzLmJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheSApICkge1xyXG5cdFx0XHRcdG1ha2VfdW5hdmFpbGFibGUgPSB0cnVlO1xyXG5cdFx0XHRcdHJlYXNvbl9jbGFzcyA9ICd3cGJjX2FnX3ByZXZpZXdfZnJvbV90b2RheV91bmF2YWlsYWJsZSc7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggYXZhaWxhYmxlX2xpbWl0ID4gMCAmJiBkYXlzX2JldHdlZW4oIGNlbGxfZGF0ZSwgdG9kYXlfZGF0ZSApID49IGF2YWlsYWJsZV9saW1pdCApIHtcclxuXHRcdFx0XHRtYWtlX3VuYXZhaWxhYmxlID0gdHJ1ZTtcclxuXHRcdFx0XHRyZWFzb25fY2xhc3MgPSAnd3BiY19hZ19wcmV2aWV3X2xpbWl0X2F2YWlsYWJsZV9mcm9tX3RvZGF5JztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBtYWtlX3VuYXZhaWxhYmxlICkge1xyXG5cdFx0XHRcdGlmICggcHJldmlvdXNfcmVhc29uICE9PSByZWFzb25fY2xhc3MgKSB7XHJcblx0XHRcdFx0XHRpZiAoIGhhZF9nZW5lcmFsX3ByZXZpZXcgKSB7XHJcblx0XHRcdFx0XHRcdGNsZWFyX3ByZXZpZXdfY2VsbCggJGNlbGwgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHJlbWVtYmVyX3ByZXZpZXdfb3JpZ2luKCAkY2VsbCApO1xyXG5cdFx0XHRcdFx0JGNlbGwuYWRkQ2xhc3MoICdkYXRlX3VzZXJfdW5hdmFpbGFibGUgd3BiY19hZ19wcmV2aWV3X3VuYXZhaWxhYmxlICcgKyByZWFzb25fY2xhc3MgKTtcclxuXHRcdFx0XHRcdCRjZWxsLmF0dHIoICdkYXRhLXdwYmMtYWctcHJldmlldy1yZWFzb24nLCByZWFzb25fY2xhc3MgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gZWxzZSBpZiAoIGhhZF9nZW5lcmFsX3ByZXZpZXcgKSB7XHJcblx0XHRcdFx0Y2xlYXJfcHJldmlld19jZWxsKCAkY2VsbCApO1xyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0YXBwbHlfYnVmZmVyX2RheXNfcHJldmlldyggc2V0dGluZ3MgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHF1ZXVlX3ByZXZpZXdfcmVmcmVzaCgpIHtcclxuXHRcdGlmICggcHJldmlld19mcmFtZSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgKSB7XHJcblx0XHRcdHByZXZpZXdfZnJhbWUgPSB3LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHByZXZpZXdfZnJhbWUgPSAwO1xyXG5cdFx0XHRcdGFwcGx5X2NhbGVuZGFyX3ByZXZpZXcoKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cHJldmlld19mcmFtZSA9IHcuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHByZXZpZXdfZnJhbWUgPSAwO1xyXG5cdFx0XHRcdGFwcGx5X2NhbGVuZGFyX3ByZXZpZXcoKTtcclxuXHRcdFx0fSwgMCApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2NoZWR1bGVfcHJldmlld19yZWZyZXNoKCBkZWxheSApIHtcclxuXHRcdGNsZWFyVGltZW91dCggcHJldmlld190aW1lciApO1xyXG5cdFx0ZGVsYXkgPSBwYXJzZUludCggZGVsYXksIDEwICkgfHwgMDtcclxuXHJcblx0XHRpZiAoIGRlbGF5ID4gMCApIHtcclxuXHRcdFx0cHJldmlld190aW1lciA9IHNldFRpbWVvdXQoIHF1ZXVlX3ByZXZpZXdfcmVmcmVzaCwgZGVsYXkgKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHF1ZXVlX3ByZXZpZXdfcmVmcmVzaCgpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdXBkYXRlX2hpbnRzKCBoaW50cyApIHtcclxuXHRcdGlmICggISBoaW50cyApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggdHlwZW9mIGhpbnRzLmJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheV9faGludCAhPT0gJ3VuZGVmaW5lZCcgKSB7XHJcblx0XHRcdCQoICdbZGF0YS13cGJjLWFnLWhpbnQ9XCJib29raW5nX3VuYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXlcIl0nICkuaHRtbChcclxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJ3cGJjX2FnX2hpbnRfdW5hdmFpbGFibGVcIj4nICsgJCggJ1tkYXRhLXdwYmMtYWctaGludD1cImJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheVwiXSAud3BiY19hZ19oaW50X3VuYXZhaWxhYmxlJyApLmZpcnN0KCkudGV4dCgpICsgJzwvc3Bhbj4nICtcclxuXHRcdFx0XHRoaW50cy5ib29raW5nX3VuYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXlfX2hpbnRcclxuXHRcdFx0KTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIHR5cGVvZiBoaW50cy5ib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5X19oaW50ICE9PSAndW5kZWZpbmVkJyApIHtcclxuXHRcdFx0JCggJ1tkYXRhLXdwYmMtYWctaGludD1cImJvb2tpbmdfYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXlcIl0nICkuaHRtbChcclxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJ3cGJjX2FnX2hpbnRfYXZhaWxhYmxlXCI+JyArICQoICdbZGF0YS13cGJjLWFnLWhpbnQ9XCJib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5XCJdIC53cGJjX2FnX2hpbnRfYXZhaWxhYmxlJyApLmZpcnN0KCkudGV4dCgpICsgJzwvc3Bhbj4nICtcclxuXHRcdFx0XHRoaW50cy5ib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5X19oaW50XHJcblx0XHRcdCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzaG93X21lc3NhZ2UoIG1lc3NhZ2UsIHR5cGUsIGR1cmF0aW9uICkge1xyXG5cdFx0aWYgKCB0eXBlb2Ygdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0dy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggbWVzc2FnZSwgdHlwZSB8fCAnaW5mbycsIGR1cmF0aW9uIHx8IDIwMDAsIGZhbHNlICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR3LmFsZXJ0KCBtZXNzYWdlICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZXRfYnVzeSggJGJ1dHRvbiwgYnVzeSApIHtcclxuXHRcdHZhciBidXN5X3RleHQ7XHJcblxyXG5cdFx0aWYgKCAhICRidXR0b24gfHwgISAkYnV0dG9uLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggYnVzeSApIHtcclxuXHRcdFx0aWYgKCAhICRidXR0b24uZGF0YSggJ3dwYmMtYWctb3JpZ2luYWwtaHRtbCcgKSApIHtcclxuXHRcdFx0XHQkYnV0dG9uLmRhdGEoICd3cGJjLWFnLW9yaWdpbmFsLWh0bWwnLCAkYnV0dG9uLmh0bWwoKSApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGJ1c3lfdGV4dCA9ICRidXR0b24uZGF0YSggJ3dwYmMtdS1idXN5LXRleHQnICkgfHwgKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5zYXZpbmcgKSB8fCAnU2F2aW5nLi4uJztcclxuXHRcdFx0JGJ1dHRvbi5hZGRDbGFzcyggJ3dwYmNfYWdfaXNfc2F2aW5nJyApLmF0dHIoICdhcmlhLWJ1c3knLCAndHJ1ZScgKS5odG1sKCAnPGkgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9yb3RhdGVfcmlnaHQgd3BiY19zcGluXCI+PC9pPjxzcGFuIGNsYXNzPVwiaW4tYnV0dG9uLXRleHRcIj4mbmJzcDsmbmJzcDsnICsgYnVzeV90ZXh0ICsgJzwvc3Bhbj4nICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHQkYnV0dG9uLnJlbW92ZUNsYXNzKCAnd3BiY19hZ19pc19zYXZpbmcnICkucmVtb3ZlQXR0ciggJ2FyaWEtYnVzeScgKTtcclxuXHRcdFx0aWYgKCAkYnV0dG9uLmRhdGEoICd3cGJjLWFnLW9yaWdpbmFsLWh0bWwnICkgKSB7XHJcblx0XHRcdFx0JGJ1dHRvbi5odG1sKCAkYnV0dG9uLmRhdGEoICd3cGJjLWFnLW9yaWdpbmFsLWh0bWwnICkgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcmVwbGFjZV9jYWxlbmRhcl9wYW5lbCggaHRtbCApIHtcclxuXHRcdHZhciAkaG9sZGVyID0gJCggJzxkaXYgLz4nICkuYXBwZW5kKCAkLnBhcnNlSFRNTCggaHRtbCwgZG9jdW1lbnQsIHRydWUgKSApO1xyXG5cdFx0dmFyICRuZXdfcGFuZWwgPSAkaG9sZGVyLmZpbmQoICdbZGF0YS13cGJjLWFnLWNhbGVuZGFyLXBhbmVsPVwiMVwiXScgKS5maXJzdCgpO1xyXG5cdFx0dmFyICRvbGRfcGFuZWwgPSAkKCAnW2RhdGEtd3BiYy1hZy1jYWxlbmRhci1wYW5lbD1cIjFcIl0nICkuZmlyc3QoKTtcclxuXHRcdHZhciAkc2NyaXB0cztcclxuXHJcblx0XHRpZiAoICEgJG5ld19wYW5lbC5sZW5ndGggfHwgISAkb2xkX3BhbmVsLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRzY3JpcHRzID0gJG5ld19wYW5lbC5maW5kKCAnc2NyaXB0JyApLnJlbW92ZSgpO1xyXG5cdFx0JG9sZF9wYW5lbC5yZXBsYWNlV2l0aCggJG5ld19wYW5lbCApO1xyXG5cclxuXHRcdCRzY3JpcHRzLmVhY2goIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0dmFyIGNvZGUgPSB0aGlzLnRleHQgfHwgdGhpcy50ZXh0Q29udGVudCB8fCB0aGlzLmlubmVySFRNTCB8fCAnJztcclxuXHRcdFx0dmFyIHNyYyA9IHRoaXMuc3JjIHx8ICcnO1xyXG5cclxuXHRcdFx0aWYgKCBzcmMgKSB7XHJcblx0XHRcdFx0JC5hamF4KCB7XHJcblx0XHRcdFx0XHR1cmw6IHNyYyxcclxuXHRcdFx0XHRcdGRhdGFUeXBlOiAnc2NyaXB0JyxcclxuXHRcdFx0XHRcdGNhY2hlOiB0cnVlXHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9IGVsc2UgaWYgKCBjb2RlICkge1xyXG5cdFx0XHRcdCQuZ2xvYmFsRXZhbCggY29kZSApO1xyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZXRfY2FsZW5kYXJfbG9hZGluZyggaXNfbG9hZGluZyApIHtcclxuXHRcdHZhciAkY2FsZW5kYXIgPSAkKCAnW2RhdGEtd3BiYy1hZy1jYWxlbmRhci1wYW5lbD1cIjFcIl0nICkuZmlyc3QoKTtcclxuXHRcdHZhciBsb2FkaW5nX3RleHQgPSBjZmcuaTE4biAmJiBjZmcuaTE4bi5sb2FkaW5nID8gY2ZnLmkxOG4ubG9hZGluZyA6ICdMb2FkaW5nJztcclxuXHRcdHZhciAkbG9hZGluZztcclxuXHJcblx0XHRpZiAoICEgJGNhbGVuZGFyLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggaXNfbG9hZGluZyApIHtcclxuXHRcdFx0JGxvYWRpbmcgPSAkY2FsZW5kYXIuZmluZCggJy53cGJjX2NhbGVuZGFyX2xvYWRpbmcnICkuZmlyc3QoKTtcclxuXHRcdFx0aWYgKCAhICRsb2FkaW5nLmxlbmd0aCApIHtcclxuXHRcdFx0XHQkbG9hZGluZyA9ICQoXHJcblx0XHRcdFx0XHQnPGRpdiBjbGFzcz1cIndwYmNfY2FsZW5kYXJfbG9hZGluZyB3cGJjX2FnX2NhbGVuZGFyX2xvYWRpbmdcIj4nICtcclxuXHRcdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwid3BiY19pY25fYXV0b3JlbmV3IHdwYmNfc3BpblwiPjwvc3Bhbj4mbmJzcDsmbmJzcDsnICtcclxuXHRcdFx0XHRcdFx0JzxzcGFuPjwvc3Bhbj4nICtcclxuXHRcdFx0XHRcdCc8L2Rpdj4nXHJcblx0XHRcdFx0KTtcclxuXHRcdFx0XHQkbG9hZGluZy5maW5kKCAnc3BhbicgKS5sYXN0KCkudGV4dCggbG9hZGluZ190ZXh0ICsgJy4uLicgKTtcclxuXHRcdFx0XHQkY2FsZW5kYXIuYXBwZW5kKCAkbG9hZGluZyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdCRjYWxlbmRhci5hZGRDbGFzcyggJ2lzLWxvYWRpbmcnICkuYXR0ciggJ2FyaWEtYnVzeScsICd0cnVlJyApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0JGNhbGVuZGFyLnJlbW92ZUNsYXNzKCAnaXMtbG9hZGluZycgKS5yZW1vdmVBdHRyKCAnYXJpYS1idXN5JyApO1xyXG5cdFx0XHQkY2FsZW5kYXIuZmluZCggJy53cGJjX2NhbGVuZGFyX2xvYWRpbmcnICkucmVtb3ZlKCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfcHJldmlld19wYXlsb2FkKCkge1xyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0YWN0aW9uOiBjZmcucHJldmlld19hY3Rpb24gfHwgJ1dQQkNfQUpYX0FWQUlMQUJJTElUWV9HRU5FUkFMX1BSRVZJRVcnLFxyXG5cdFx0XHRub25jZTogY2ZnLm5vbmNlIHx8ICcnLFxyXG5cdFx0XHRyZXNvdXJjZV9pZDogJCggJyN3cGJjX2FnX3Jlc291cmNlX2lkJyApLnZhbCgpIHx8ICcnLFxyXG5cdFx0XHRtb250aHNfY291bnQ6ICQoICcjd3BiY19hZ19tb250aHNfY291bnQnICkudmFsKCkgfHwgJydcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBsb2FkX2NhbGVuZGFyX3ByZXZpZXcoKSB7XHJcblx0XHR2YXIgJGNhbGVuZGFyID0gJCggJ1tkYXRhLXdwYmMtYWctY2FsZW5kYXItcGFuZWw9XCIxXCJdJyApLmZpcnN0KCk7XHJcblx0XHR2YXIgY3VycmVudF9wcmV2aWV3X2FqYXg7XHJcblxyXG5cdFx0aWYgKCAhIGNmZy5hamF4X3VybCApIHtcclxuXHRcdFx0c2hvd19tZXNzYWdlKCAoIGNmZy5pMThuICYmIGNmZy5pMThuLnByZXZpZXdfZmFpbGVkICkgfHwgJ1VuYWJsZSB0byByZWZyZXNoIGNhbGVuZGFyIHByZXZpZXcuJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggcHJldmlld19hamF4ICYmIHByZXZpZXdfYWpheC5yZWFkeVN0YXRlICE9PSA0ICkge1xyXG5cdFx0XHRwcmV2aWV3X2FqYXguYWJvcnQoKTtcclxuXHRcdH1cclxuXHJcblx0XHRzZXRfY2FsZW5kYXJfbG9hZGluZyggdHJ1ZSApO1xyXG5cclxuXHRcdGN1cnJlbnRfcHJldmlld19hamF4ID0gJC5hamF4KCB7XHJcblx0XHRcdHVybDogY2ZnLmFqYXhfdXJsLFxyXG5cdFx0XHRtZXRob2Q6ICdQT1NUJyxcclxuXHRcdFx0ZGF0YVR5cGU6ICdqc29uJyxcclxuXHRcdFx0ZGF0YTogZ2V0X3ByZXZpZXdfcGF5bG9hZCgpXHJcblx0XHR9ICk7XHJcblx0XHRwcmV2aWV3X2FqYXggPSBjdXJyZW50X3ByZXZpZXdfYWpheDtcclxuXHJcblx0XHRjdXJyZW50X3ByZXZpZXdfYWpheC5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xyXG5cdFx0XHRpZiAoICEgcmVzcG9uc2UgfHwgISByZXNwb25zZS5zdWNjZXNzIHx8ICEgcmVzcG9uc2UuZGF0YSB8fCAhIHJlc3BvbnNlLmRhdGEuaHRtbCApIHtcclxuXHRcdFx0XHRzaG93X21lc3NhZ2UoICggcmVzcG9uc2UgJiYgcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLm1lc3NhZ2UgKSB8fCAoIGNmZy5pMThuICYmIGNmZy5pMThuLnByZXZpZXdfZmFpbGVkICkgfHwgJ1VuYWJsZSB0byByZWZyZXNoIGNhbGVuZGFyIHByZXZpZXcuJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJlcGxhY2VfY2FsZW5kYXJfcGFuZWwoIHJlc3BvbnNlLmRhdGEuaHRtbCApO1xyXG5cdFx0XHQkKCAnW2RhdGEtd3BiYy1hZy1wYWdlPVwiMVwiXScgKS5hdHRyKCAnZGF0YS13cGJjLWFnLXJlc291cmNlLWlkJywgcmVzcG9uc2UuZGF0YS5yZXNvdXJjZV9pZCB8fCAnJyApO1xyXG5cdFx0XHRvYnNlcnZlX2NhbGVuZGFyX2NoYW5nZXMoKTtcclxuXHRcdFx0c2NoZWR1bGVfcHJldmlld19yZWZyZXNoKCk7XHJcblx0XHRcdHNldFRpbWVvdXQoIHNjaGVkdWxlX3ByZXZpZXdfcmVmcmVzaCwgNjAwICk7XHJcblx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCBqcV94aHIsIHRleHRfc3RhdHVzICkge1xyXG5cdFx0XHRpZiAoIHRleHRfc3RhdHVzICE9PSAnYWJvcnQnICkge1xyXG5cdFx0XHRcdHNob3dfbWVzc2FnZSggKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5wcmV2aWV3X2ZhaWxlZCApIHx8ICdVbmFibGUgdG8gcmVmcmVzaCBjYWxlbmRhciBwcmV2aWV3LicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKS5hbHdheXMoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0aWYgKCBwcmV2aWV3X2FqYXggPT09IGN1cnJlbnRfcHJldmlld19hamF4ICkge1xyXG5cdFx0XHRcdHNldF9jYWxlbmRhcl9sb2FkaW5nKCBmYWxzZSApO1xyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzYXZlX3NldHRpbmdzKCBidXR0b24gKSB7XHJcblx0XHR2YXIgJGJ1dHRvbiA9ICQoIGJ1dHRvbiApO1xyXG5cdFx0dmFyIHNldHRpbmdzID0gY29sbGVjdF9zZXR0aW5ncygpO1xyXG5cdFx0dmFyIHBheWxvYWQgPSAkLmV4dGVuZCgge30sIHNldHRpbmdzLCB7XHJcblx0XHRcdGFjdGlvbjogY2ZnLmFjdGlvbiB8fCAnV1BCQ19BSlhfQVZBSUxBQklMSVRZX0dFTkVSQUxfU0FWRScsXHJcblx0XHRcdG5vbmNlOiBjZmcubm9uY2UgfHwgJycsXHJcblx0XHRcdGJvb2tpbmdfdW5hdmFpbGFibGVfZGF5czogc2V0dGluZ3Mud2Vla2RheXNcclxuXHRcdH0gKTtcclxuXHJcblx0XHRhcHBlbmRfd29ya2luZ190aW1lX3BheWxvYWQoIHBheWxvYWQgKTtcclxuXHJcblx0XHRpZiAoICEgY2ZnLmFqYXhfdXJsICkge1xyXG5cdFx0XHRzaG93X21lc3NhZ2UoICggY2ZnLmkxOG4gJiYgY2ZnLmkxOG4uc2F2ZV9mYWlsZWQgKSB8fCAnVW5hYmxlIHRvIHNhdmUgZ2VuZXJhbCBhdmFpbGFiaWxpdHkgc2V0dGluZ3MuJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHNldF9idXN5KCAkYnV0dG9uLCB0cnVlICk7XHJcblxyXG5cdFx0JC5hamF4KCB7XHJcblx0XHRcdHVybDogY2ZnLmFqYXhfdXJsLFxyXG5cdFx0XHRtZXRob2Q6ICdQT1NUJyxcclxuXHRcdFx0ZGF0YVR5cGU6ICdqc29uJyxcclxuXHRcdFx0ZGF0YTogcGF5bG9hZFxyXG5cdFx0fSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XHJcblx0XHRcdGlmICggISByZXNwb25zZSB8fCAhIHJlc3BvbnNlLnN1Y2Nlc3MgKSB7XHJcblx0XHRcdFx0c2hvd19tZXNzYWdlKCAoIHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5tZXNzYWdlICkgfHwgKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5zYXZlX2ZhaWxlZCApIHx8ICdVbmFibGUgdG8gc2F2ZSBnZW5lcmFsIGF2YWlsYWJpbGl0eSBzZXR0aW5ncy4nLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCByZXNwb25zZS5kYXRhICYmIHJlc3BvbnNlLmRhdGEuc2V0dGluZ3MgJiYgcmVzcG9uc2UuZGF0YS5zZXR0aW5ncy5oaW50cyApIHtcclxuXHRcdFx0XHR1cGRhdGVfaGludHMoIHJlc3BvbnNlLmRhdGEuc2V0dGluZ3MuaGludHMgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5zZXR0aW5ncyApIHtcclxuXHRcdFx0XHRjZmcuc2V0dGluZ3MgPSByZXNwb25zZS5kYXRhLnNldHRpbmdzO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRsb2FkX2NhbGVuZGFyX3ByZXZpZXcoKTtcclxuXHRcdFx0c2hvd19tZXNzYWdlKCAoIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5tZXNzYWdlICkgfHwgKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5zYXZlZCApIHx8ICdHZW5lcmFsIGF2YWlsYWJpbGl0eSBzZXR0aW5ncyB1cGRhdGVkLicsICdzdWNjZXNzJywgMjAwMCApO1xyXG5cdFx0fSApLmZhaWwoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0c2hvd19tZXNzYWdlKCAoIGNmZy5pMThuICYmIGNmZy5pMThuLnNhdmVfZmFpbGVkICkgfHwgJ1VuYWJsZSB0byBzYXZlIGdlbmVyYWwgYXZhaWxhYmlsaXR5IHNldHRpbmdzLicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHR9ICkuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHNldF9idXN5KCAkYnV0dG9uLCBmYWxzZSApO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcmVzZXRfc2V0dGluZ3MoIGJ1dHRvbiApIHtcclxuXHRcdHZhciBjb25maXJtX21lc3NhZ2UgPSAoIGNmZy5pMThuICYmIGNmZy5pMThuLnJlc2V0X2NvbmZpcm0gKSB8fCAnUmVzZXQgZ2VuZXJhbCBhdmFpbGFiaWxpdHkgc2V0dGluZ3MgdG8gZGVmYXVsdCB2YWx1ZXM/JztcclxuXHRcdHZhciBkZWZhdWx0X3NldHRpbmdzID0gY2ZnLmRlZmF1bHRfc2V0dGluZ3MgfHwge1xyXG5cdFx0XHR3ZWVrZGF5czogW10sXHJcblx0XHRcdGJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheTogJzAnLFxyXG5cdFx0XHRib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5OiAnJyxcclxuXHRcdFx0Ym9va2luZ191bmF2YWlsYWJsZV9leHRyYV9pbl9vdXQ6ICcnLFxyXG5cdFx0XHRib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX21pbnV0ZXNfaW46ICcnLFxyXG5cdFx0XHRib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX21pbnV0ZXNfb3V0OiAnJyxcclxuXHRcdFx0Ym9va2luZ191bmF2YWlsYWJsZV9leHRyYV9kYXlzX2luOiAnJyxcclxuXHRcdFx0Ym9va2luZ191bmF2YWlsYWJsZV9leHRyYV9kYXlzX291dDogJycsXHJcblx0XHRcdHdvcmtpbmdfdGltZToge31cclxuXHRcdH07XHJcblxyXG5cdFx0aWYgKCAhIHcuY29uZmlybSggY29uZmlybV9tZXNzYWdlICkgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRhcHBseV9zZXR0aW5nc190b19mb3JtKCBkZWZhdWx0X3NldHRpbmdzICk7XHJcblx0XHRsb2FkX2NhbGVuZGFyX3ByZXZpZXcoKTtcclxuXHRcdHNob3dfbWVzc2FnZSggKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5yZXNldF9hcHBsaWVkICkgfHwgJ0RlZmF1bHQgYXZhaWxhYmlsaXR5IHNldHRpbmdzIGFyZSByZWFkeSBmb3IgcHJldmlldy4gQ2xpY2sgU2F2ZSBDaGFuZ2VzIHRvIGFwcGx5IHRoZW0uJywgJ3N1Y2Nlc3MnLCA0MDAwICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBvYnNlcnZlX2NhbGVuZGFyX2NoYW5nZXMoKSB7XHJcblx0XHR2YXIgdGFyZ2V0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYWctY2FsZW5kYXItcGFuZWw9XCIxXCJdJyApO1xyXG5cclxuXHRcdGlmICggISB0YXJnZXQgfHwgISB3Lk11dGF0aW9uT2JzZXJ2ZXIgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIG9ic2VydmVyICkge1xyXG5cdFx0XHRvYnNlcnZlci5kaXNjb25uZWN0KCk7XHJcblx0XHR9XHJcblxyXG5cdFx0b2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlciggc2NoZWR1bGVfcHJldmlld19yZWZyZXNoICk7XHJcblx0XHRvYnNlcnZlci5vYnNlcnZlKCB0YXJnZXQsIHtcclxuXHRcdFx0Y2hpbGRMaXN0OiB0cnVlLFxyXG5cdFx0XHRzdWJ0cmVlOiB0cnVlXHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnLndwYmNfYWdfcmlnaHRiYXJfdGFicyBbcm9sZT1cInRhYlwiXScsIGZ1bmN0aW9uICgpIHtcclxuXHRcdHN3aXRjaF9wYW5lbCggJCggdGhpcyApICk7XHJcblx0fSApO1xyXG5cclxuXHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnLndwYmNfYWdfcmlnaHRiYXJfcGFuZWxzIC5ncm91cF9faGVhZGVyJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0dG9nZ2xlX2dyb3VwKCAkKCB0aGlzICkgKTtcclxuXHR9ICk7XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdzdWJtaXQnLCAnW2RhdGEtd3BiYy1hZy1wcmV2aWV3LXRvb2xiYXI9XCIxXCJdJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRsb2FkX2NhbGVuZGFyX3ByZXZpZXcoKTtcclxuXHR9ICk7XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnI3dwYmNfYWdfcmVzb3VyY2VfaWQsICN3cGJjX2FnX21vbnRoc19jb3VudCcsIGxvYWRfY2FsZW5kYXJfcHJldmlldyApO1xyXG5cclxuXHQkKCBkb2N1bWVudCApLm9uKCAnY2hhbmdlJywgJyN3cGJjX2FnX3Jlc291cmNlX2lkJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0Y2ZnLnNldHRpbmdzID0gY2ZnLnNldHRpbmdzIHx8IHt9O1xyXG5cdFx0Y2ZnLnNldHRpbmdzLndvcmtpbmdfdGltZSA9IGdldF93b3JraW5nX3RpbWVfc2V0dGluZ3NfZnJvbV9mb3JtKCk7XHJcblx0XHRhcHBseV93b3JraW5nX3RpbWVfc2V0dGluZ3NfdG9fZm9ybSggY2ZnLnNldHRpbmdzLndvcmtpbmdfdGltZSwgJCggdGhpcyApLnZhbCgpICk7XHJcblx0fSApO1xyXG5cclxuXHQkKCBkb2N1bWVudCApLm9uKCAnaW5wdXQgY2hhbmdlJywgJ1tkYXRhLXdwYmMtYWctcmFuZ2UtZm9yXScsIGZ1bmN0aW9uICgpIHtcclxuXHRcdHN5bmNfc2VsZWN0X2Zyb21fcmFuZ2UoIHRoaXMgKTtcclxuXHRcdHNjaGVkdWxlX3ByZXZpZXdfcmVmcmVzaCgpO1xyXG5cdH0gKTtcclxuXHJcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICdbZGF0YS13cGJjLWFnLXNldHRpbmdzLWZvcm09XCIxXCJdIHNlbGVjdCcsIGZ1bmN0aW9uICgpIHtcclxuXHRcdHN5bmNfcmFuZ2VfZnJvbV9zZWxlY3QoIHRoaXMgKTtcclxuXHR9ICk7XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICdbZGF0YS13cGJjLWFnLXN0ZXBwZXJdJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0c3RlcF9zZWxlY3RfdmFsdWUoIHRoaXMgKTtcclxuXHR9ICk7XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnaW5wdXRbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfaW5fb3V0XCJdJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0cmVmcmVzaF9idWZmZXJfZmllbGRzKCk7XHJcblx0XHRzY2hlZHVsZV9wcmV2aWV3X3JlZnJlc2goKTtcclxuXHR9ICk7XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnaW5wdXRbbmFtZT1cImJvb2tpbmdfd29ya2luZ190aW1lX2VuYWJsZWRcIl0nLCByZWZyZXNoX3dvcmtpbmdfdGltZV9wYW5lbHMgKTtcclxuXHJcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICdpbnB1dFtuYW1lPVwiYm9va2luZ193b3JraW5nX3RpbWVfcmVzb3VyY2VfbW9kZVwiXScsIHJlZnJlc2hfd29ya2luZ190aW1lX3BhbmVscyApO1xyXG5cclxuXHQkKCBkb2N1bWVudCApLm9uKCAnY2hhbmdlJywgJ1tkYXRhLXdwYmMtYWctc2V0dGluZ3MtZm9ybT1cIjFcIl0gaW5wdXQsIFtkYXRhLXdwYmMtYWctc2V0dGluZ3MtZm9ybT1cIjFcIl0gc2VsZWN0Jywgc2NoZWR1bGVfcHJldmlld19yZWZyZXNoICk7XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdzdWJtaXQnLCAnW2RhdGEtd3BiYy1hZy1zZXR0aW5ncy1mb3JtPVwiMVwiXScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0c2F2ZV9zZXR0aW5ncyggJCggJ1tkYXRhLXdwYmMtYWctc2F2ZT1cIjFcIl0nICkuZmlyc3QoKSApO1xyXG5cdH0gKTtcclxuXHJcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJ1tkYXRhLXdwYmMtYWctc2F2ZT1cIjFcIl0nLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRzYXZlX3NldHRpbmdzKCB0aGlzICk7XHJcblx0fSApO1xyXG5cclxuXHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnW2RhdGEtd3BiYy1hZy1yZXNldD1cIjFcIl0nLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXNldF9zZXR0aW5ncyggdGhpcyApO1xyXG5cdH0gKTtcclxuXHJcblx0JCggZG9jdW1lbnQgKS5yZWFkeSggZnVuY3Rpb24gKCkge1xyXG5cdFx0YXBwbHlfd29ya2luZ190aW1lX3NldHRpbmdzX3RvX2Zvcm0oICggY2ZnLnNldHRpbmdzICYmIGNmZy5zZXR0aW5ncy53b3JraW5nX3RpbWUgKSB8fCAoIGNmZy5kZWZhdWx0X3NldHRpbmdzICYmIGNmZy5kZWZhdWx0X3NldHRpbmdzLndvcmtpbmdfdGltZSApIHx8IHt9LCAkKCAnI3dwYmNfYWdfcmVzb3VyY2VfaWQnICkudmFsKCkgKTtcclxuXHRcdGFwcGx5X29wZW5fc2VjdGlvbl9mcm9tX3VybCgpO1xyXG5cdFx0cmVmcmVzaF9idWZmZXJfZmllbGRzKCk7XHJcblx0XHRzeW5jX2FsbF9yYW5nZXMoKTtcclxuXHRcdG9ic2VydmVfY2FsZW5kYXJfY2hhbmdlcygpO1xyXG5cdFx0c2NoZWR1bGVfcHJldmlld19yZWZyZXNoKCk7XHJcblx0XHRzZXRUaW1lb3V0KCBzY2hlZHVsZV9wcmV2aWV3X3JlZnJlc2gsIDYwMCApO1xyXG5cdH0gKTtcclxufSggalF1ZXJ5LCB3aW5kb3cgKSApO1xyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0UsV0FBV0EsQ0FBQyxFQUFFQyxDQUFDLEVBQUc7RUFDbkIsWUFBWTs7RUFFWixJQUFJQyxHQUFHLEdBQUdELENBQUMsQ0FBQ0UsOEJBQThCLElBQUksQ0FBQyxDQUFDO0VBQ2hELElBQUlDLGFBQWEsR0FBRyxDQUFDO0VBQ3JCLElBQUlDLGFBQWEsR0FBRyxDQUFDO0VBQ3JCLElBQUlDLFlBQVksR0FBRyxJQUFJO0VBQ3ZCLElBQUlDLFFBQVEsR0FBRyxJQUFJO0VBQ25CLElBQUlDLDJCQUEyQixHQUFHLCtRQUErUTtFQUVqVCxTQUFTQyxTQUFTQSxDQUFFQyxLQUFLLEVBQUc7SUFDM0IsT0FBT0MsTUFBTSxDQUFFRCxLQUFLLElBQUksRUFBRyxDQUFDLENBQUNFLElBQUksQ0FBQyxDQUFDO0VBQ3BDO0VBRUEs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
