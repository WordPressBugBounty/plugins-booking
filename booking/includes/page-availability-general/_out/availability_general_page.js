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
    var $scroll_parent = $();
    var scroll_parent_el;
    var group_el;
    var scroll_top;
    var parent_rect;
    var group_rect;
    if (!$group.length) {
      return;
    }
    $group.parents().each(function () {
      var $candidate = $(this);
      var overflow_y = $candidate.css('overflow-y');
      if ($candidate.hasClass('simplebar-content-wrapper') || /(auto|scroll)/.test(overflow_y) && this.scrollHeight > this.clientHeight) {
        $scroll_parent = $candidate;
        return false;
      }
    });
    if (!$scroll_parent.length) {
      $scroll_parent = $group.closest('.wpbc_ui_el__vert_right_bar__content').find('.simplebar-content-wrapper').first();
    }
    if (!$scroll_parent.length) {
      $group.get(0).scrollIntoView({
        block: 'nearest'
      });
      return;
    }
    scroll_parent_el = $scroll_parent.get(0);
    group_el = $group.get(0);
    parent_rect = scroll_parent_el.getBoundingClientRect();
    group_rect = group_el.getBoundingClientRect();
    scroll_top = $scroll_parent.scrollTop() + group_rect.top - parent_rect.top - 10;
    $scroll_parent.stop().animate({
      scrollTop: Math.max(0, scroll_top)
    }, 180);
  }
  function apply_open_section_from_url() {
    var section_groups = {
      weekdays: 'general-availability-weekdays',
      from_today: 'general-availability-from-today',
      buffer: 'general-availability-buffer',
      working_time: 'general-availability-working-time'
    };
    var group_name = section_groups[cfg.open_section] || '';
    if ('' === group_name) {
      return;
    }
    open_group(group_name, true);
    $.each([120, 650], function (index, delay) {
      setTimeout(function () {
        scroll_to_group(group_name);
      }, delay);
    });
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
      document.dispatchEvent(new CustomEvent('wpbc:availability-general:settings-saved', {
        detail: {
          settings: response.data && response.data.settings ? response.data.settings : {}
        }
      }));
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1hdmFpbGFiaWxpdHktZ2VuZXJhbC9fb3V0L2F2YWlsYWJpbGl0eV9nZW5lcmFsX3BhZ2UuanMiLCJuYW1lcyI6WyIkIiwidyIsImNmZyIsIndwYmNfYXZhaWxhYmlsaXR5X2dlbmVyYWxfcGFnZSIsInByZXZpZXdfdGltZXIiLCJwcmV2aWV3X2ZyYW1lIiwicHJldmlld19hamF4Iiwib2JzZXJ2ZXIiLCJwcmV2aWV3X3VuYXZhaWxhYmxlX2NsYXNzZXMiLCJ0cmltX3RleHQiLCJ2YWx1ZSIsIlN0cmluZyIsInRyaW0iLCJzd2l0Y2hfcGFuZWwiLCIkdGFiIiwicGFuZWxfaWQiLCJhdHRyIiwiJHRhYnMiLCJjbG9zZXN0IiwiZmluZCIsIiRwYW5lbHMiLCJyZW1vdmVBdHRyIiwidG9nZ2xlX2dyb3VwIiwiJGJ1dHRvbiIsIiRncm91cCIsIiRmaWVsZHMiLCJpc19vcGVuIiwiaGFzQ2xhc3MiLCJ0b2dnbGVDbGFzcyIsInByb3AiLCJjbG9zZV9ncm91cCIsInJlbW92ZUNsYXNzIiwib3Blbl9ncm91cCIsImdyb3VwX25hbWUiLCJpc19leGNsdXNpdmUiLCJsZW5ndGgiLCJzaWJsaW5ncyIsImVhY2giLCJhZGRDbGFzcyIsInNjcm9sbF90b19ncm91cCIsIiRzY3JvbGxfcGFyZW50Iiwic2Nyb2xsX3BhcmVudF9lbCIsImdyb3VwX2VsIiwic2Nyb2xsX3RvcCIsInBhcmVudF9yZWN0IiwiZ3JvdXBfcmVjdCIsInBhcmVudHMiLCIkY2FuZGlkYXRlIiwib3ZlcmZsb3dfeSIsImNzcyIsInRlc3QiLCJzY3JvbGxIZWlnaHQiLCJjbGllbnRIZWlnaHQiLCJmaXJzdCIsImdldCIsInNjcm9sbEludG9WaWV3IiwiYmxvY2siLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJzY3JvbGxUb3AiLCJ0b3AiLCJzdG9wIiwiYW5pbWF0ZSIsIk1hdGgiLCJtYXgiLCJhcHBseV9vcGVuX3NlY3Rpb25fZnJvbV91cmwiLCJzZWN0aW9uX2dyb3VwcyIsIndlZWtkYXlzIiwiZnJvbV90b2RheSIsImJ1ZmZlciIsIndvcmtpbmdfdGltZSIsIm9wZW5fc2VjdGlvbiIsImluZGV4IiwiZGVsYXkiLCJzZXRUaW1lb3V0IiwicmVmcmVzaF9idWZmZXJfZmllbGRzIiwidmFsIiwiJHBhbmVsIiwiZGF0YSIsImlzX2J1ZmZlcl9hdmFpbGFibGUiLCJpc19hdmFpbGFibGVfbGltaXRfYXZhaWxhYmxlIiwic3luY19yYW5nZV9mcm9tX3NlbGVjdCIsInNlbGVjdCIsIiRzZWxlY3QiLCJuYW1lIiwic2VsZWN0ZWRfaW5kZXgiLCJzZWxlY3RlZF90ZXh0IiwidGV4dCIsIiRyYW5nZSIsIiR2YWx1ZSIsInN5bmNfc2VsZWN0X2Zyb21fcmFuZ2UiLCJyYW5nZSIsInBhcnNlSW50Iiwic3luY19hbGxfcmFuZ2VzIiwic3RlcF9zZWxlY3RfdmFsdWUiLCJidXR0b24iLCJzdGVwIiwiY3VycmVudF9pbmRleCIsIm5leHRfaW5kZXgiLCJtaW4iLCJ0cmlnZ2VyIiwiZ2V0X2Zvcm0iLCJjb2xsZWN0X3NldHRpbmdzIiwiJGZvcm0iLCJwdXNoIiwiYm9va2luZ191bmF2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5IiwiYm9va2luZ19hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheSIsImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfaW5fb3V0IiwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9taW51dGVzX2luIiwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9taW51dGVzX291dCIsImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfZGF5c19pbiIsImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfZGF5c19vdXQiLCJnZXRfd29ya2luZ190aW1lX3NldHRpbmdzX2Zyb21fZm9ybSIsInNldF9zZWxlY3RfdmFsdWUiLCIkZmllbGQiLCJhcHBseV9zZXR0aW5nc190b19mb3JtIiwic2V0dGluZ3MiLCJkYXlfbnVtIiwiYXBwbHlfd29ya2luZ190aW1lX3NldHRpbmdzX3RvX2Zvcm0iLCJzY2hlZHVsZV9wcmV2aWV3X3JlZnJlc2giLCJkYXRlX2Zyb21fc3FsIiwic3FsX2RhdGUiLCJwYXJ0cyIsInNwbGl0IiwiRGF0ZSIsImdldF90b2RheV9kYXRlIiwiYXJyIiwiX3dwYmMiLCJnZXRfb3RoZXJfcGFyYW0iLCJub3ciLCJnZXRGdWxsWWVhciIsImdldE1vbnRoIiwiZ2V0RGF0ZSIsImdldF9yZWFsX3RvZGF5X2RhdGUiLCJkYXlzX2JldHdlZW4iLCJkYXRlX2EiLCJkYXRlX2IiLCJmbG9vciIsImdldFRpbWUiLCJhZGRfZGF5cyIsImRhdGUiLCJkYXlzIiwic2hpZnRlZF9kYXRlIiwic2V0RGF0ZSIsImRhdGVfdG9fc3FsIiwibW9udGgiLCJkYXkiLCJnZXRfc3FsX2RhdGVfZnJvbV9jZWxsIiwiY2VsbCIsImNsYXNzZXMiLCJjbGFzc05hbWUiLCJpIiwiaW5kZXhPZiIsInJlcGxhY2UiLCJ1bmF2YWlsYWJsZV9mcm9tX3RvZGF5X2FwcGxpZXMiLCJjZWxsX2RhdGUiLCJ0b2RheV9kYXRlIiwibWludXRlcyIsInVuYXZhaWxhYmxlX3VudGlsIiwiZ2V0X29wdGlvbl90ZXh0Iiwic2VsZWN0b3IiLCJnZXRfZGF5c192YWx1ZSIsInRpbWVfdG9fc2Vjb25kcyIsInRpbWUiLCJob3VycyIsIm1pbnMiLCJzZWNvbmRzX3RvX3RpbWUiLCJzZWNvbmRzIiwiY29sbGVjdF93b3JraW5nX3RpbWVfd2Vla2RheXMiLCJwcmVmaXgiLCIkcm93Iiwic3RhcnRfc2Vjb25kIiwiZW5kX3NlY29uZCIsInNldF93b3JraW5nX3RpbWVfd2Vla2RheXMiLCIkd3JhcCIsImludGVydmFscyIsImludGVydmFsIiwicmVmcmVzaF93b3JraW5nX3RpbWVfcGFuZWxzIiwiaXNfZW5hYmxlZCIsIm1vZGUiLCJyZXNvdXJjZUlkIiwid29ya2luZ1RpbWUiLCJleHRlbmQiLCJkZWZhdWx0X3NldHRpbmdzIiwiZGVmYXVsdCIsInJlc291cmNlcyIsImVuYWJsZWQiLCJyZXNvdXJjZVNldHRpbmdzIiwiYXBwZW5kX3dvcmtpbmdfdGltZV9wYXlsb2FkIiwicGF5bG9hZCIsImRlZmF1bHREYXlzIiwicmVzb3VyY2VEYXlzIiwiZGVmYXVsdFN0YXJ0IiwiZGVmYXVsdEVuZCIsInJlc291cmNlU3RhcnQiLCJyZXNvdXJjZUVuZCIsImJvb2tpbmdfd29ya2luZ190aW1lX2VuYWJsZWQiLCJib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZV9pZCIsImJvb2tpbmdfd29ya2luZ190aW1lX3Jlc291cmNlX21vZGUiLCJib29raW5nX3dvcmtpbmdfdGltZV9kZWZhdWx0X2RheXMiLCJib29raW5nX3dvcmtpbmdfdGltZV9kZWZhdWx0X3N0YXJ0IiwiYm9va2luZ193b3JraW5nX3RpbWVfZGVmYXVsdF9lbmQiLCJib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZV9kYXlzIiwiYm9va2luZ193b3JraW5nX3RpbWVfcmVzb3VyY2Vfc3RhcnQiLCJib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZV9lbmQiLCJ1cGRhdGVfd3BiY19wcmV2aWV3X3BhcmFtcyIsInNldF9vdGhlcl9wYXJhbSIsImNvbmNhdCIsInVwZGF0ZV9idWZmZXJfcHJldmlld19ub3RlIiwiJG5vdGVzIiwiJGNhbGVuZGFyIiwiJG5vdGUiLCJ0eXBlIiwiYmVmb3JlX3RleHQiLCJhZnRlcl90ZXh0IiwibWVzc2FnZSIsImFwcGVuZCIsImkxOG4iLCJidWZmZXJfcHJldmlldyIsImJlZm9yZV9ib29raW5nIiwiYWZ0ZXJfYm9va2luZyIsImh0bWwiLCJub19idWZmZXIiLCJhcHBseV9idWZmZXJfZGF5c19wcmV2aWV3IiwiYmVmb3JlX2RheXMiLCJhZnRlcl9kYXlzIiwiZGF0ZV9jZWxscyIsImJvb2tlZF9kYXRlcyIsIiRjZWxsIiwiYm9va2VkX2RhdGUiLCJvZmZzZXQiLCJ0YXJnZXRfc3FsX2RhdGUiLCIkdGFyZ2V0X2NlbGwiLCJyZW1lbWJlcl9wcmV2aWV3X29yaWdpbiIsImNsZWFyX3ByZXZpZXdfY2VsbCIsImhhZF9kYXRlX3VzZXJfdW5hdmFpbGFibGUiLCJhcHBseV9jYWxlbmRhcl9wcmV2aWV3IiwiYXZhaWxhYmxlX2xpbWl0IiwibWFrZV91bmF2YWlsYWJsZSIsInJlYXNvbl9jbGFzcyIsInByZXZpb3VzX3JlYXNvbiIsImhhZF9nZW5lcmFsX3ByZXZpZXciLCJnZXREYXkiLCJxdWV1ZV9wcmV2aWV3X3JlZnJlc2giLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJjbGVhclRpbWVvdXQiLCJ1cGRhdGVfaGludHMiLCJoaW50cyIsImJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheV9faGludCIsImJvb2tpbmdfYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXlfX2hpbnQiLCJzaG93X21lc3NhZ2UiLCJkdXJhdGlvbiIsIndwYmNfYWRtaW5fc2hvd19tZXNzYWdlIiwiYWxlcnQiLCJzZXRfYnVzeSIsImJ1c3kiLCJidXN5X3RleHQiLCJzYXZpbmciLCJyZXBsYWNlX2NhbGVuZGFyX3BhbmVsIiwiJGhvbGRlciIsInBhcnNlSFRNTCIsImRvY3VtZW50IiwiJG5ld19wYW5lbCIsIiRvbGRfcGFuZWwiLCIkc2NyaXB0cyIsInJlbW92ZSIsInJlcGxhY2VXaXRoIiwiY29kZSIsInRleHRDb250ZW50IiwiaW5uZXJIVE1MIiwic3JjIiwiYWpheCIsInVybCIsImRhdGFUeXBlIiwiY2FjaGUiLCJnbG9iYWxFdmFsIiwic2V0X2NhbGVuZGFyX2xvYWRpbmciLCJpc19sb2FkaW5nIiwibG9hZGluZ190ZXh0IiwibG9hZGluZyIsIiRsb2FkaW5nIiwibGFzdCIsImdldF9wcmV2aWV3X3BheWxvYWQiLCJhY3Rpb24iLCJwcmV2aWV3X2FjdGlvbiIsIm5vbmNlIiwicmVzb3VyY2VfaWQiLCJtb250aHNfY291bnQiLCJsb2FkX2NhbGVuZGFyX3ByZXZpZXciLCJjdXJyZW50X3ByZXZpZXdfYWpheCIsImFqYXhfdXJsIiwicHJldmlld19mYWlsZWQiLCJyZWFkeVN0YXRlIiwiYWJvcnQiLCJtZXRob2QiLCJkb25lIiwicmVzcG9uc2UiLCJzdWNjZXNzIiwib2JzZXJ2ZV9jYWxlbmRhcl9jaGFuZ2VzIiwiZmFpbCIsImpxX3hociIsInRleHRfc3RhdHVzIiwiYWx3YXlzIiwic2F2ZV9zZXR0aW5ncyIsImJvb2tpbmdfdW5hdmFpbGFibGVfZGF5cyIsInNhdmVfZmFpbGVkIiwiZGlzcGF0Y2hFdmVudCIsIkN1c3RvbUV2ZW50IiwiZGV0YWlsIiwic2F2ZWQiLCJyZXNldF9zZXR0aW5ncyIsImNvbmZpcm1fbWVzc2FnZSIsInJlc2V0X2NvbmZpcm0iLCJjb25maXJtIiwicmVzZXRfYXBwbGllZCIsInRhcmdldCIsInF1ZXJ5U2VsZWN0b3IiLCJNdXRhdGlvbk9ic2VydmVyIiwiZGlzY29ubmVjdCIsIm9ic2VydmUiLCJjaGlsZExpc3QiLCJzdWJ0cmVlIiwib24iLCJldmVudCIsInByZXZlbnREZWZhdWx0IiwicmVhZHkiLCJqUXVlcnkiLCJ3aW5kb3ciXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWF2YWlsYWJpbGl0eS1nZW5lcmFsL19zcmMvYXZhaWxhYmlsaXR5X2dlbmVyYWxfcGFnZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogR2VuZXJhbCBBdmFpbGFiaWxpdHkgVUkuXHJcbiAqL1xyXG4oIGZ1bmN0aW9uICggJCwgdyApIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdHZhciBjZmcgPSB3LndwYmNfYXZhaWxhYmlsaXR5X2dlbmVyYWxfcGFnZSB8fCB7fTtcclxuXHR2YXIgcHJldmlld190aW1lciA9IDA7XHJcblx0dmFyIHByZXZpZXdfZnJhbWUgPSAwO1xyXG5cdHZhciBwcmV2aWV3X2FqYXggPSBudWxsO1xyXG5cdHZhciBvYnNlcnZlciA9IG51bGw7XHJcblx0dmFyIHByZXZpZXdfdW5hdmFpbGFibGVfY2xhc3NlcyA9ICd3cGJjX2FnX3ByZXZpZXdfdW5hdmFpbGFibGUgd3BiY19hZ19wcmV2aWV3X3dlZWtkYXlfdW5hdmFpbGFibGUgd3BiY19hZ19wcmV2aWV3X2Zyb21fdG9kYXlfdW5hdmFpbGFibGUgd3BiY19hZ19wcmV2aWV3X2xpbWl0X2F2YWlsYWJsZV9mcm9tX3RvZGF5IHdwYmNfYWdfcHJldmlld19idWZmZXJfdW5hdmFpbGFibGUgd2Vla2RheV91bmF2YWlsYWJsZSBmcm9tX3RvZGF5X3VuYXZhaWxhYmxlIGxpbWl0X2F2YWlsYWJsZV9mcm9tX3RvZGF5IGJ1ZmZlcl91bmF2YWlsYWJsZSc7XHJcblxyXG5cdGZ1bmN0aW9uIHRyaW1fdGV4dCggdmFsdWUgKSB7XHJcblx0XHRyZXR1cm4gU3RyaW5nKCB2YWx1ZSB8fCAnJyApLnRyaW0oKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHN3aXRjaF9wYW5lbCggJHRhYiApIHtcclxuXHRcdHZhciBwYW5lbF9pZCA9ICR0YWIuYXR0ciggJ2FyaWEtY29udHJvbHMnICk7XHJcblx0XHR2YXIgJHRhYnMgPSAkdGFiLmNsb3Nlc3QoICcud3BiY19hZ19yaWdodGJhcl90YWJzJyApLmZpbmQoICdbcm9sZT1cInRhYlwiXScgKTtcclxuXHRcdHZhciAkcGFuZWxzID0gJCggJy53cGJjX2FnX3JpZ2h0YmFyX3BhbmVscyBbcm9sZT1cInRhYnBhbmVsXCJdJyApO1xyXG5cclxuXHRcdCR0YWJzLmF0dHIoICdhcmlhLXNlbGVjdGVkJywgJ2ZhbHNlJyApO1xyXG5cdFx0JHRhYi5hdHRyKCAnYXJpYS1zZWxlY3RlZCcsICd0cnVlJyApO1xyXG5cclxuXHRcdCRwYW5lbHMuYXR0ciggJ2hpZGRlbicsICdoaWRkZW4nICkuYXR0ciggJ2FyaWEtaGlkZGVuJywgJ3RydWUnICk7XHJcblx0XHQkKCAnIycgKyBwYW5lbF9pZCApLnJlbW92ZUF0dHIoICdoaWRkZW4nICkuYXR0ciggJ2FyaWEtaGlkZGVuJywgJ2ZhbHNlJyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdG9nZ2xlX2dyb3VwKCAkYnV0dG9uICkge1xyXG5cdFx0dmFyICRncm91cCA9ICRidXR0b24uY2xvc2VzdCggJy53cGJjX3VpX19jb2xsYXBzaWJsZV9ncm91cCcgKTtcclxuXHRcdHZhciAkZmllbGRzID0gJGdyb3VwLmZpbmQoICc+IC5ncm91cF9fZmllbGRzJyApO1xyXG5cdFx0dmFyIGlzX29wZW4gPSAkZ3JvdXAuaGFzQ2xhc3MoICdpcy1vcGVuJyApO1xyXG5cclxuXHRcdCRncm91cC50b2dnbGVDbGFzcyggJ2lzLW9wZW4nLCAhIGlzX29wZW4gKTtcclxuXHRcdCRidXR0b24uYXR0ciggJ2FyaWEtZXhwYW5kZWQnLCBpc19vcGVuID8gJ2ZhbHNlJyA6ICd0cnVlJyApO1xyXG5cdFx0JGZpZWxkcy5wcm9wKCAnaGlkZGVuJywgaXNfb3BlbiApLmF0dHIoICdhcmlhLWhpZGRlbicsIGlzX29wZW4gPyAndHJ1ZScgOiAnZmFsc2UnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBjbG9zZV9ncm91cCggJGdyb3VwICkge1xyXG5cdFx0dmFyICRidXR0b24gPSAkZ3JvdXAuZmluZCggJz4gLmdyb3VwX19oZWFkZXInICk7XHJcblx0XHR2YXIgJGZpZWxkcyA9ICRncm91cC5maW5kKCAnPiAuZ3JvdXBfX2ZpZWxkcycgKTtcclxuXHJcblx0XHQkZ3JvdXAucmVtb3ZlQ2xhc3MoICdpcy1vcGVuJyApO1xyXG5cdFx0JGJ1dHRvbi5hdHRyKCAnYXJpYS1leHBhbmRlZCcsICdmYWxzZScgKTtcclxuXHRcdCRmaWVsZHMucHJvcCggJ2hpZGRlbicsIHRydWUgKS5hdHRyKCAnYXJpYS1oaWRkZW4nLCAndHJ1ZScgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIG9wZW5fZ3JvdXAoIGdyb3VwX25hbWUsIGlzX2V4Y2x1c2l2ZSApIHtcclxuXHRcdHZhciAkZ3JvdXAgPSAkKCAnLndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwW2RhdGEtZ3JvdXA9XCInICsgZ3JvdXBfbmFtZSArICdcIl0nICk7XHJcblx0XHR2YXIgJGJ1dHRvbiA9ICRncm91cC5maW5kKCAnPiAuZ3JvdXBfX2hlYWRlcicgKTtcclxuXHRcdHZhciAkZmllbGRzID0gJGdyb3VwLmZpbmQoICc+IC5ncm91cF9fZmllbGRzJyApO1xyXG5cclxuXHRcdGlmICggISAkZ3JvdXAubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBpc19leGNsdXNpdmUgKSB7XHJcblx0XHRcdCRncm91cC5zaWJsaW5ncyggJy53cGJjX3VpX19jb2xsYXBzaWJsZV9ncm91cCcgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0Y2xvc2VfZ3JvdXAoICQoIHRoaXMgKSApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0JGdyb3VwLmFkZENsYXNzKCAnaXMtb3BlbicgKTtcclxuXHRcdCRidXR0b24uYXR0ciggJ2FyaWEtZXhwYW5kZWQnLCAndHJ1ZScgKTtcclxuXHRcdCRmaWVsZHMucHJvcCggJ2hpZGRlbicsIGZhbHNlICkuYXR0ciggJ2FyaWEtaGlkZGVuJywgJ2ZhbHNlJyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2Nyb2xsX3RvX2dyb3VwKCBncm91cF9uYW1lICkge1xyXG5cdFx0dmFyICRncm91cCA9ICQoICcud3BiY191aV9fY29sbGFwc2libGVfZ3JvdXBbZGF0YS1ncm91cD1cIicgKyBncm91cF9uYW1lICsgJ1wiXScgKTtcclxuXHRcdHZhciAkc2Nyb2xsX3BhcmVudCA9ICQoKTtcclxuXHRcdHZhciBzY3JvbGxfcGFyZW50X2VsO1xyXG5cdFx0dmFyIGdyb3VwX2VsO1xyXG5cdFx0dmFyIHNjcm9sbF90b3A7XHJcblx0XHR2YXIgcGFyZW50X3JlY3Q7XHJcblx0XHR2YXIgZ3JvdXBfcmVjdDtcclxuXHJcblx0XHRpZiAoICEgJGdyb3VwLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRncm91cC5wYXJlbnRzKCkuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR2YXIgJGNhbmRpZGF0ZSA9ICQoIHRoaXMgKTtcclxuXHRcdFx0dmFyIG92ZXJmbG93X3kgPSAkY2FuZGlkYXRlLmNzcyggJ292ZXJmbG93LXknICk7XHJcblxyXG5cdFx0XHRpZiAoXHJcblx0XHRcdFx0JGNhbmRpZGF0ZS5oYXNDbGFzcyggJ3NpbXBsZWJhci1jb250ZW50LXdyYXBwZXInIClcclxuXHRcdFx0XHR8fCAoXHJcblx0XHRcdFx0XHQvKGF1dG98c2Nyb2xsKS8udGVzdCggb3ZlcmZsb3dfeSApXHJcblx0XHRcdFx0XHQmJiB0aGlzLnNjcm9sbEhlaWdodCA+IHRoaXMuY2xpZW50SGVpZ2h0XHJcblx0XHRcdFx0KVxyXG5cdFx0XHQpIHtcclxuXHRcdFx0XHQkc2Nyb2xsX3BhcmVudCA9ICRjYW5kaWRhdGU7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0aWYgKCAhICRzY3JvbGxfcGFyZW50Lmxlbmd0aCApIHtcclxuXHRcdFx0JHNjcm9sbF9wYXJlbnQgPSAkZ3JvdXAuY2xvc2VzdCggJy53cGJjX3VpX2VsX192ZXJ0X3JpZ2h0X2Jhcl9fY29udGVudCcgKS5maW5kKCAnLnNpbXBsZWJhci1jb250ZW50LXdyYXBwZXInICkuZmlyc3QoKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICEgJHNjcm9sbF9wYXJlbnQubGVuZ3RoICkge1xyXG5cdFx0XHQkZ3JvdXAuZ2V0KCAwICkuc2Nyb2xsSW50b1ZpZXcoIHsgYmxvY2s6ICduZWFyZXN0JyB9ICk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRzY3JvbGxfcGFyZW50X2VsID0gJHNjcm9sbF9wYXJlbnQuZ2V0KCAwICk7XHJcblx0XHRncm91cF9lbCAgICAgICAgID0gJGdyb3VwLmdldCggMCApO1xyXG5cdFx0cGFyZW50X3JlY3QgICAgICA9IHNjcm9sbF9wYXJlbnRfZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcblx0XHRncm91cF9yZWN0ICAgICAgID0gZ3JvdXBfZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcblx0XHRzY3JvbGxfdG9wICAgICAgID0gJHNjcm9sbF9wYXJlbnQuc2Nyb2xsVG9wKCkgKyBncm91cF9yZWN0LnRvcCAtIHBhcmVudF9yZWN0LnRvcCAtIDEwO1xyXG5cclxuXHRcdCRzY3JvbGxfcGFyZW50LnN0b3AoKS5hbmltYXRlKCB7IHNjcm9sbFRvcDogTWF0aC5tYXgoIDAsIHNjcm9sbF90b3AgKSB9LCAxODAgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGFwcGx5X29wZW5fc2VjdGlvbl9mcm9tX3VybCgpIHtcclxuXHRcdHZhciBzZWN0aW9uX2dyb3VwcyA9IHtcclxuXHRcdFx0d2Vla2RheXM6ICdnZW5lcmFsLWF2YWlsYWJpbGl0eS13ZWVrZGF5cycsXHJcblx0XHRcdGZyb21fdG9kYXk6ICdnZW5lcmFsLWF2YWlsYWJpbGl0eS1mcm9tLXRvZGF5JyxcclxuXHRcdFx0YnVmZmVyOiAnZ2VuZXJhbC1hdmFpbGFiaWxpdHktYnVmZmVyJyxcclxuXHRcdFx0d29ya2luZ190aW1lOiAnZ2VuZXJhbC1hdmFpbGFiaWxpdHktd29ya2luZy10aW1lJ1xyXG5cdFx0fTtcclxuXHRcdHZhciBncm91cF9uYW1lID0gc2VjdGlvbl9ncm91cHNbIGNmZy5vcGVuX3NlY3Rpb24gXSB8fCAnJztcclxuXHJcblx0XHRpZiAoICcnID09PSBncm91cF9uYW1lICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0b3Blbl9ncm91cCggZ3JvdXBfbmFtZSwgdHJ1ZSApO1xyXG5cdFx0JC5lYWNoKCBbIDEyMCwgNjUwIF0sIGZ1bmN0aW9uICggaW5kZXgsIGRlbGF5ICkge1xyXG5cdFx0XHRzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0c2Nyb2xsX3RvX2dyb3VwKCBncm91cF9uYW1lICk7XHJcblx0XHRcdH0sIGRlbGF5ICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByZWZyZXNoX2J1ZmZlcl9maWVsZHMoKSB7XHJcblx0XHR2YXIgdmFsdWUgPSAkKCAnaW5wdXRbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfaW5fb3V0XCJdOmNoZWNrZWQnICkudmFsKCkgfHwgJyc7XHJcblxyXG5cdFx0JCggJy53cGJjX2FnX2J1ZmZlcl9maWVsZHMnICkuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR2YXIgJHBhbmVsID0gJCggdGhpcyApO1xyXG5cdFx0XHQkcGFuZWwudG9nZ2xlQ2xhc3MoICdpcy12aXNpYmxlJywgJHBhbmVsLmRhdGEoICdidWZmZXItcGFuZWwnICkgPT09IHZhbHVlICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpc19idWZmZXJfYXZhaWxhYmxlKCkge1xyXG5cdFx0cmV0dXJuICEgKCBjZmcuaXNfYnVmZmVyX2F2YWlsYWJsZSA9PT0gZmFsc2UgfHwgY2ZnLmlzX2J1ZmZlcl9hdmFpbGFibGUgPT09ICdmYWxzZScgfHwgY2ZnLmlzX2J1ZmZlcl9hdmFpbGFibGUgPT09IDAgfHwgY2ZnLmlzX2J1ZmZlcl9hdmFpbGFibGUgPT09ICcwJyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaXNfYXZhaWxhYmxlX2xpbWl0X2F2YWlsYWJsZSgpIHtcclxuXHRcdHJldHVybiAhICggY2ZnLmlzX2F2YWlsYWJsZV9saW1pdF9hdmFpbGFibGUgPT09IGZhbHNlIHx8IGNmZy5pc19hdmFpbGFibGVfbGltaXRfYXZhaWxhYmxlID09PSAnZmFsc2UnIHx8IGNmZy5pc19hdmFpbGFibGVfbGltaXRfYXZhaWxhYmxlID09PSAwIHx8IGNmZy5pc19hdmFpbGFibGVfbGltaXRfYXZhaWxhYmxlID09PSAnMCcgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHN5bmNfcmFuZ2VfZnJvbV9zZWxlY3QoIHNlbGVjdCApIHtcclxuXHRcdHZhciAkc2VsZWN0ID0gJCggc2VsZWN0ICk7XHJcblx0XHR2YXIgbmFtZSA9ICRzZWxlY3QuYXR0ciggJ25hbWUnICk7XHJcblx0XHR2YXIgc2VsZWN0ZWRfaW5kZXggPSAkc2VsZWN0LnByb3AoICdzZWxlY3RlZEluZGV4JyApO1xyXG5cdFx0dmFyIHNlbGVjdGVkX3RleHQgPSB0cmltX3RleHQoICRzZWxlY3QuZmluZCggJ29wdGlvbjpzZWxlY3RlZCcgKS50ZXh0KCkgKTtcclxuXHRcdHZhciAkcmFuZ2UgPSAkKCAnW2RhdGEtd3BiYy1hZy1yYW5nZS1mb3I9XCInICsgbmFtZSArICdcIl0nICk7XHJcblx0XHR2YXIgJHZhbHVlID0gJCggJ1tkYXRhLXdwYmMtYWctcmFuZ2UtdmFsdWUtZm9yPVwiJyArIG5hbWUgKyAnXCJdJyApO1xyXG5cclxuXHRcdGlmICggISAkcmFuZ2UubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JHJhbmdlLnZhbCggc2VsZWN0ZWRfaW5kZXggPCAwID8gMCA6IHNlbGVjdGVkX2luZGV4ICk7XHJcblx0XHQkdmFsdWUudGV4dCggc2VsZWN0ZWRfdGV4dCApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc3luY19zZWxlY3RfZnJvbV9yYW5nZSggcmFuZ2UgKSB7XHJcblx0XHR2YXIgJHJhbmdlID0gJCggcmFuZ2UgKTtcclxuXHRcdHZhciBuYW1lID0gJHJhbmdlLmF0dHIoICdkYXRhLXdwYmMtYWctcmFuZ2UtZm9yJyApO1xyXG5cdFx0dmFyICRzZWxlY3QgPSAkKCAnW25hbWU9XCInICsgbmFtZSArICdcIl0nICk7XHJcblx0XHR2YXIgaW5kZXggPSBwYXJzZUludCggJHJhbmdlLnZhbCgpLCAxMCApIHx8IDA7XHJcblxyXG5cdFx0aWYgKCAhICRzZWxlY3QubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JHNlbGVjdC5wcm9wKCAnc2VsZWN0ZWRJbmRleCcsIGluZGV4ICk7XHJcblx0XHRzeW5jX3JhbmdlX2Zyb21fc2VsZWN0KCAkc2VsZWN0ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzeW5jX2FsbF9yYW5nZXMoKSB7XHJcblx0XHQkKCAnW2RhdGEtd3BiYy1hZy1yYW5nZS1mb3JdJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0dmFyIG5hbWUgPSAkKCB0aGlzICkuYXR0ciggJ2RhdGEtd3BiYy1hZy1yYW5nZS1mb3InICk7XHJcblx0XHRcdHN5bmNfcmFuZ2VfZnJvbV9zZWxlY3QoICQoICdbbmFtZT1cIicgKyBuYW1lICsgJ1wiXScgKS5maXJzdCgpICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzdGVwX3NlbGVjdF92YWx1ZSggYnV0dG9uICkge1xyXG5cdFx0dmFyICRidXR0b24gPSAkKCBidXR0b24gKTtcclxuXHRcdHZhciBuYW1lID0gJGJ1dHRvbi5hdHRyKCAnZGF0YS13cGJjLWFnLXN0ZXBwZXInICk7XHJcblx0XHR2YXIgc3RlcCA9IHBhcnNlSW50KCAkYnV0dG9uLmF0dHIoICdkYXRhLXN0ZXAnICksIDEwICkgfHwgMDtcclxuXHRcdHZhciAkc2VsZWN0ID0gJCggJ1tuYW1lPVwiJyArIG5hbWUgKyAnXCJdJyApLmZpcnN0KCk7XHJcblx0XHR2YXIgY3VycmVudF9pbmRleDtcclxuXHRcdHZhciBuZXh0X2luZGV4O1xyXG5cclxuXHRcdGlmICggISAkc2VsZWN0Lmxlbmd0aCB8fCAkc2VsZWN0LnByb3AoICdkaXNhYmxlZCcgKSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGN1cnJlbnRfaW5kZXggPSAkc2VsZWN0LnByb3AoICdzZWxlY3RlZEluZGV4JyApO1xyXG5cdFx0bmV4dF9pbmRleCA9IE1hdGgubWF4KCAwLCBNYXRoLm1pbiggJHNlbGVjdC5maW5kKCAnb3B0aW9uJyApLmxlbmd0aCAtIDEsIGN1cnJlbnRfaW5kZXggKyBzdGVwICkgKTtcclxuXHJcblx0XHRpZiAoIG5leHRfaW5kZXggPT09IGN1cnJlbnRfaW5kZXggKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQkc2VsZWN0LnByb3AoICdzZWxlY3RlZEluZGV4JywgbmV4dF9pbmRleCApLnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfZm9ybSgpIHtcclxuXHRcdHJldHVybiAkKCAnW2RhdGEtd3BiYy1hZy1zZXR0aW5ncy1mb3JtPVwiMVwiXScgKS5maXJzdCgpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gY29sbGVjdF9zZXR0aW5ncygpIHtcclxuXHRcdHZhciAkZm9ybSA9IGdldF9mb3JtKCk7XHJcblx0XHR2YXIgd2Vla2RheXMgPSBbXTtcclxuXHJcblx0XHQkZm9ybS5maW5kKCAnaW5wdXRbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c1tdXCJdOmNoZWNrZWQnICkuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR3ZWVrZGF5cy5wdXNoKCBwYXJzZUludCggdGhpcy52YWx1ZSwgMTAgKSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHdlZWtkYXlzOiB3ZWVrZGF5cyxcclxuXHRcdFx0Ym9va2luZ191bmF2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5OiAkZm9ybS5maW5kKCAnW25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXlcIl0nICkudmFsKCkgfHwgJzAnLFxyXG5cdFx0XHRib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5OiAkZm9ybS5maW5kKCAnW25hbWU9XCJib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5XCJdJyApLnZhbCgpIHx8ICcnLFxyXG5cdFx0XHRib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2luX291dDogJGZvcm0uZmluZCggJ1tuYW1lPVwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9pbl9vdXRcIl06Y2hlY2tlZCcgKS52YWwoKSB8fCAnJyxcclxuXHRcdFx0Ym9va2luZ191bmF2YWlsYWJsZV9leHRyYV9taW51dGVzX2luOiAkZm9ybS5maW5kKCAnW25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX21pbnV0ZXNfaW5cIl0nICkudmFsKCkgfHwgJycsXHJcblx0XHRcdGJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfbWludXRlc19vdXQ6ICRmb3JtLmZpbmQoICdbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfbWludXRlc19vdXRcIl0nICkudmFsKCkgfHwgJycsXHJcblx0XHRcdGJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfZGF5c19pbjogJGZvcm0uZmluZCggJ1tuYW1lPVwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9kYXlzX2luXCJdJyApLnZhbCgpIHx8ICcnLFxyXG5cdFx0XHRib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfb3V0OiAkZm9ybS5maW5kKCAnW25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfb3V0XCJdJyApLnZhbCgpIHx8ICcnLFxyXG5cdFx0XHR3b3JraW5nX3RpbWU6IGdldF93b3JraW5nX3RpbWVfc2V0dGluZ3NfZnJvbV9mb3JtKClcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZXRfc2VsZWN0X3ZhbHVlKCBuYW1lLCB2YWx1ZSApIHtcclxuXHRcdHZhciAkZmllbGQgPSBnZXRfZm9ybSgpLmZpbmQoICdbbmFtZT1cIicgKyBuYW1lICsgJ1wiXScgKS5maXJzdCgpO1xyXG5cclxuXHRcdGlmICggISAkZmllbGQubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JGZpZWxkLnZhbCggdmFsdWUgKTtcclxuXHRcdGlmICggU3RyaW5nKCAkZmllbGQudmFsKCkgKSAhPT0gU3RyaW5nKCB2YWx1ZSApICkge1xyXG5cdFx0XHQkZmllbGQucHJvcCggJ3NlbGVjdGVkSW5kZXgnLCAwICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBhcHBseV9zZXR0aW5nc190b19mb3JtKCBzZXR0aW5ncyApIHtcclxuXHRcdHZhciAkZm9ybSA9IGdldF9mb3JtKCk7XHJcblx0XHR2YXIgd2Vla2RheXMgPSBzZXR0aW5ncyAmJiBzZXR0aW5ncy53ZWVrZGF5cyA/IHNldHRpbmdzLndlZWtkYXlzIDogW107XHJcblxyXG5cdFx0aWYgKCAhICRmb3JtLmxlbmd0aCB8fCAhIHNldHRpbmdzICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JGZvcm0uZmluZCggJ2lucHV0W25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2RheXNbXVwiXScgKS5wcm9wKCAnY2hlY2tlZCcsIGZhbHNlICk7XHJcblx0XHQkLmVhY2goIHdlZWtkYXlzLCBmdW5jdGlvbiAoIGluZGV4LCBkYXlfbnVtICkge1xyXG5cdFx0XHQkZm9ybS5maW5kKCAnaW5wdXRbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c1tdXCJdW3ZhbHVlPVwiJyArIHBhcnNlSW50KCBkYXlfbnVtLCAxMCApICsgJ1wiXScgKS5wcm9wKCAnY2hlY2tlZCcsIHRydWUgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRzZXRfc2VsZWN0X3ZhbHVlKCAnYm9va2luZ191bmF2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5Jywgc2V0dGluZ3MuYm9va2luZ191bmF2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5IHx8ICcwJyApO1xyXG5cdFx0c2V0X3NlbGVjdF92YWx1ZSggJ2Jvb2tpbmdfYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXknLCBzZXR0aW5ncy5ib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5IHx8ICcnICk7XHJcblx0XHRzZXRfc2VsZWN0X3ZhbHVlKCAnYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9taW51dGVzX2luJywgc2V0dGluZ3MuYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9taW51dGVzX2luIHx8ICcnICk7XHJcblx0XHRzZXRfc2VsZWN0X3ZhbHVlKCAnYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9taW51dGVzX291dCcsIHNldHRpbmdzLmJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfbWludXRlc19vdXQgfHwgJycgKTtcclxuXHRcdHNldF9zZWxlY3RfdmFsdWUoICdib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfaW4nLCBzZXR0aW5ncy5ib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfaW4gfHwgJycgKTtcclxuXHRcdHNldF9zZWxlY3RfdmFsdWUoICdib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfb3V0Jywgc2V0dGluZ3MuYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9kYXlzX291dCB8fCAnJyApO1xyXG5cclxuXHRcdCRmb3JtLmZpbmQoICdpbnB1dFtuYW1lPVwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9pbl9vdXRcIl0nICkucHJvcCggJ2NoZWNrZWQnLCBmYWxzZSApO1xyXG5cdFx0JGZvcm0uZmluZCggJ2lucHV0W25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2luX291dFwiXVt2YWx1ZT1cIicgKyAoIHNldHRpbmdzLmJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfaW5fb3V0IHx8ICcnICkgKyAnXCJdJyApLnByb3AoICdjaGVja2VkJywgdHJ1ZSApO1xyXG5cdFx0YXBwbHlfd29ya2luZ190aW1lX3NldHRpbmdzX3RvX2Zvcm0oIHNldHRpbmdzLndvcmtpbmdfdGltZSB8fCB7fSwgJCggJyN3cGJjX2FnX3Jlc291cmNlX2lkJyApLnZhbCgpICk7XHJcblxyXG5cdFx0cmVmcmVzaF9idWZmZXJfZmllbGRzKCk7XHJcblx0XHRzeW5jX2FsbF9yYW5nZXMoKTtcclxuXHRcdHNjaGVkdWxlX3ByZXZpZXdfcmVmcmVzaCgpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZGF0ZV9mcm9tX3NxbCggc3FsX2RhdGUgKSB7XHJcblx0XHR2YXIgcGFydHMgPSBTdHJpbmcoIHNxbF9kYXRlIHx8ICcnICkuc3BsaXQoICctJyApO1xyXG5cdFx0aWYgKCBwYXJ0cy5sZW5ndGggIT09IDMgKSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIG5ldyBEYXRlKCBwYXJzZUludCggcGFydHNbMF0sIDEwICksIHBhcnNlSW50KCBwYXJ0c1sxXSwgMTAgKSAtIDEsIHBhcnNlSW50KCBwYXJ0c1syXSwgMTAgKSwgMCwgMCwgMCApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X3RvZGF5X2RhdGUoKSB7XHJcblx0XHR2YXIgYXJyID0gdy5fd3BiYyAmJiB0eXBlb2Ygdy5fd3BiYy5nZXRfb3RoZXJfcGFyYW0gPT09ICdmdW5jdGlvbicgPyB3Ll93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgKSA6IG51bGw7XHJcblx0XHRpZiAoIGFyciAmJiBhcnIubGVuZ3RoID49IDMgKSB7XHJcblx0XHRcdHJldHVybiBuZXcgRGF0ZSggcGFyc2VJbnQoIGFyclswXSwgMTAgKSwgcGFyc2VJbnQoIGFyclsxXSwgMTAgKSAtIDEsIHBhcnNlSW50KCBhcnJbMl0sIDEwICksIDAsIDAsIDAgKTtcclxuXHRcdH1cclxuXHRcdHZhciBub3cgPSBuZXcgRGF0ZSgpO1xyXG5cdFx0cmV0dXJuIG5ldyBEYXRlKCBub3cuZ2V0RnVsbFllYXIoKSwgbm93LmdldE1vbnRoKCksIG5vdy5nZXREYXRlKCksIDAsIDAsIDAgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9yZWFsX3RvZGF5X2RhdGUoKSB7XHJcblx0XHR2YXIgYXJyID0gdy5fd3BiYyAmJiB0eXBlb2Ygdy5fd3BiYy5nZXRfb3RoZXJfcGFyYW0gPT09ICdmdW5jdGlvbicgPyB3Ll93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RpbWVfbG9jYWxfYXJyJyApIDogbnVsbDtcclxuXHRcdGlmICggYXJyICYmIGFyci5sZW5ndGggPj0gMyApIHtcclxuXHRcdFx0cmV0dXJuIG5ldyBEYXRlKCBwYXJzZUludCggYXJyWzBdLCAxMCApLCBwYXJzZUludCggYXJyWzFdLCAxMCApIC0gMSwgcGFyc2VJbnQoIGFyclsyXSwgMTAgKSwgMCwgMCwgMCApO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIGdldF90b2RheV9kYXRlKCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBkYXlzX2JldHdlZW4oIGRhdGVfYSwgZGF0ZV9iICkge1xyXG5cdFx0cmV0dXJuIE1hdGguZmxvb3IoICggZGF0ZV9hLmdldFRpbWUoKSAtIGRhdGVfYi5nZXRUaW1lKCkgKSAvIDg2NDAwMDAwICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBhZGRfZGF5cyggZGF0ZSwgZGF5cyApIHtcclxuXHRcdHZhciBzaGlmdGVkX2RhdGUgPSBuZXcgRGF0ZSggZGF0ZS5nZXRGdWxsWWVhcigpLCBkYXRlLmdldE1vbnRoKCksIGRhdGUuZ2V0RGF0ZSgpLCAwLCAwLCAwICk7XHJcblx0XHRzaGlmdGVkX2RhdGUuc2V0RGF0ZSggc2hpZnRlZF9kYXRlLmdldERhdGUoKSArIGRheXMgKTtcclxuXHRcdHJldHVybiBzaGlmdGVkX2RhdGU7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBkYXRlX3RvX3NxbCggZGF0ZSApIHtcclxuXHRcdHZhciBtb250aCA9IFN0cmluZyggZGF0ZS5nZXRNb250aCgpICsgMSApO1xyXG5cdFx0dmFyIGRheSA9IFN0cmluZyggZGF0ZS5nZXREYXRlKCkgKTtcclxuXHJcblx0XHRpZiAoIG1vbnRoLmxlbmd0aCA8IDIgKSB7XHJcblx0XHRcdG1vbnRoID0gJzAnICsgbW9udGg7XHJcblx0XHR9XHJcblx0XHRpZiAoIGRheS5sZW5ndGggPCAyICkge1xyXG5cdFx0XHRkYXkgPSAnMCcgKyBkYXk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGRhdGUuZ2V0RnVsbFllYXIoKSArICctJyArIG1vbnRoICsgJy0nICsgZGF5O1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X3NxbF9kYXRlX2Zyb21fY2VsbCggY2VsbCApIHtcclxuXHRcdHZhciBjbGFzc2VzID0gU3RyaW5nKCBjZWxsLmNsYXNzTmFtZSB8fCAnJyApLnNwbGl0KCAvXFxzKy8gKTtcclxuXHRcdHZhciBpO1xyXG5cdFx0Zm9yICggaSA9IDA7IGkgPCBjbGFzc2VzLmxlbmd0aDsgaSsrICkge1xyXG5cdFx0XHRpZiAoIGNsYXNzZXNbaV0uaW5kZXhPZiggJ3NxbF9kYXRlXycgKSA9PT0gMCApIHtcclxuXHRcdFx0XHRyZXR1cm4gY2xhc3Nlc1tpXS5yZXBsYWNlKCAnc3FsX2RhdGVfJywgJycgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0cmV0dXJuICcnO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdW5hdmFpbGFibGVfZnJvbV90b2RheV9hcHBsaWVzKCBjZWxsX2RhdGUsIHRvZGF5X2RhdGUsIHZhbHVlICkge1xyXG5cdFx0dmFyIG1pbnV0ZXM7XHJcblx0XHR2YXIgbm93O1xyXG5cdFx0dmFyIHVuYXZhaWxhYmxlX3VudGlsO1xyXG5cclxuXHRcdGlmICggISB2YWx1ZSB8fCB2YWx1ZSA9PT0gJzAnICkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAvbSQvLnRlc3QoIHZhbHVlICkgKSB7XHJcblx0XHRcdG1pbnV0ZXMgPSBwYXJzZUludCggdmFsdWUsIDEwICk7XHJcblx0XHRcdGlmICggISBtaW51dGVzICkge1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRub3cgPSBuZXcgRGF0ZSgpO1xyXG5cdFx0XHR1bmF2YWlsYWJsZV91bnRpbCA9IG5ldyBEYXRlKCBub3cuZ2V0VGltZSgpICsgKCAoIG1pbnV0ZXMgLSAxICkgKiA2MDAwMCApICk7XHJcblx0XHRcdHVuYXZhaWxhYmxlX3VudGlsID0gbmV3IERhdGUoIHVuYXZhaWxhYmxlX3VudGlsLmdldEZ1bGxZZWFyKCksIHVuYXZhaWxhYmxlX3VudGlsLmdldE1vbnRoKCksIHVuYXZhaWxhYmxlX3VudGlsLmdldERhdGUoKSwgMCwgMCwgMCApO1xyXG5cdFx0XHRyZXR1cm4gY2VsbF9kYXRlLmdldFRpbWUoKSA8PSB1bmF2YWlsYWJsZV91bnRpbC5nZXRUaW1lKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGRheXNfYmV0d2VlbiggY2VsbF9kYXRlLCB0b2RheV9kYXRlICkgPCBwYXJzZUludCggdmFsdWUsIDEwICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfb3B0aW9uX3RleHQoIHNlbGVjdG9yICkge1xyXG5cdFx0dmFyIHRleHQgPSAkKCBzZWxlY3RvciApLmZpbmQoICdvcHRpb246c2VsZWN0ZWQnICkudGV4dCgpO1xyXG5cdFx0cmV0dXJuIHRyaW1fdGV4dCggdGV4dCApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X2RheXNfdmFsdWUoIHZhbHVlICkge1xyXG5cdFx0aWYgKCAhIHZhbHVlIHx8ICEgL2QkLy50ZXN0KCB2YWx1ZSApICkge1xyXG5cdFx0XHRyZXR1cm4gMDtcclxuXHRcdH1cclxuXHRcdHJldHVybiBwYXJzZUludCggdmFsdWUsIDEwICkgfHwgMDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHRpbWVfdG9fc2Vjb25kcyggdGltZSApIHtcclxuXHRcdHZhciBwYXJ0cyA9IFN0cmluZyggdGltZSB8fCAnJyApLnNwbGl0KCAnOicgKTtcclxuXHRcdHZhciBob3VycztcclxuXHRcdHZhciBtaW5zO1xyXG5cclxuXHRcdGlmICggcGFydHMubGVuZ3RoIDwgMiApIHtcclxuXHRcdFx0cmV0dXJuIDA7XHJcblx0XHR9XHJcblxyXG5cdFx0aG91cnMgPSBNYXRoLm1heCggMCwgTWF0aC5taW4oIDI0LCBwYXJzZUludCggcGFydHNbMF0sIDEwICkgfHwgMCApICk7XHJcblx0XHRtaW5zID0gaG91cnMgPT09IDI0ID8gMCA6IE1hdGgubWF4KCAwLCBNYXRoLm1pbiggNTksIHBhcnNlSW50KCBwYXJ0c1sxXSwgMTAgKSB8fCAwICkgKTtcclxuXHJcblx0XHRyZXR1cm4gTWF0aC5taW4oIDg2NDAwLCAoIGhvdXJzICogMzYwMCApICsgKCBtaW5zICogNjAgKSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2Vjb25kc190b190aW1lKCBzZWNvbmRzICkge1xyXG5cdFx0dmFyIGhvdXJzO1xyXG5cdFx0dmFyIG1pbnM7XHJcblxyXG5cdFx0c2Vjb25kcyA9IE1hdGgubWF4KCAwLCBNYXRoLm1pbiggODY0MDAsIHBhcnNlSW50KCBzZWNvbmRzLCAxMCApIHx8IDAgKSApO1xyXG5cdFx0aG91cnMgPSBNYXRoLmZsb29yKCBzZWNvbmRzIC8gMzYwMCApO1xyXG5cdFx0bWlucyA9IE1hdGguZmxvb3IoICggc2Vjb25kcyAlIDM2MDAgKSAvIDYwICk7XHJcblxyXG5cdFx0cmV0dXJuICggaG91cnMgPCAxMCA/ICcwJyA6ICcnICkgKyBob3VycyArICc6JyArICggbWlucyA8IDEwID8gJzAnIDogJycgKSArIG1pbnM7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBjb2xsZWN0X3dvcmtpbmdfdGltZV93ZWVrZGF5cyggcHJlZml4ICkge1xyXG5cdFx0dmFyICRmb3JtID0gZ2V0X2Zvcm0oKTtcclxuXHRcdHZhciB3ZWVrZGF5cyA9IHt9O1xyXG5cclxuXHRcdCRmb3JtLmZpbmQoICdbZGF0YS13cGJjLXdvcmtpbmctdGltZS13ZWVrZGF5cz1cIicgKyBwcmVmaXggKyAnXCJdIC53cGJjX2FnX3dvcmtpbmdfdGltZV9yb3cnICkuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR2YXIgJHJvdyA9ICQoIHRoaXMgKTtcclxuXHRcdFx0dmFyIGRheSA9IHBhcnNlSW50KCAkcm93LmZpbmQoICdpbnB1dFt0eXBlPVwiY2hlY2tib3hcIl0nICkudmFsKCksIDEwICk7XHJcblxyXG5cdFx0XHR3ZWVrZGF5c1sgZGF5IF0gPSBbXTtcclxuXHRcdFx0aWYgKCAhICRyb3cuZmluZCggJ2lucHV0W3R5cGU9XCJjaGVja2JveFwiXScgKS5wcm9wKCAnY2hlY2tlZCcgKSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHdlZWtkYXlzWyBkYXkgXS5wdXNoKCB7XHJcblx0XHRcdFx0c3RhcnRfc2Vjb25kOiB0aW1lX3RvX3NlY29uZHMoICRyb3cuZmluZCggJy53cGJjX2FnX3dvcmtpbmdfdGltZV9zdGFydCcgKS52YWwoKSApLFxyXG5cdFx0XHRcdGVuZF9zZWNvbmQ6IHRpbWVfdG9fc2Vjb25kcyggJHJvdy5maW5kKCAnLndwYmNfYWdfd29ya2luZ190aW1lX2VuZCcgKS52YWwoKSApXHJcblx0XHRcdH0gKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRyZXR1cm4gd2Vla2RheXM7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZXRfd29ya2luZ190aW1lX3dlZWtkYXlzKCBwcmVmaXgsIHdlZWtkYXlzICkge1xyXG5cdFx0dmFyICR3cmFwID0gZ2V0X2Zvcm0oKS5maW5kKCAnW2RhdGEtd3BiYy13b3JraW5nLXRpbWUtd2Vla2RheXM9XCInICsgcHJlZml4ICsgJ1wiXScgKTtcclxuXHJcblx0XHQkd3JhcC5maW5kKCAnLndwYmNfYWdfd29ya2luZ190aW1lX3JvdycgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHZhciAkcm93ID0gJCggdGhpcyApO1xyXG5cdFx0XHR2YXIgZGF5ID0gcGFyc2VJbnQoICRyb3cuZmluZCggJ2lucHV0W3R5cGU9XCJjaGVja2JveFwiXScgKS52YWwoKSwgMTAgKTtcclxuXHRcdFx0dmFyIGludGVydmFscyA9IHdlZWtkYXlzICYmIHdlZWtkYXlzWyBkYXkgXSA/IHdlZWtkYXlzWyBkYXkgXSA6IFtdO1xyXG5cdFx0XHR2YXIgaW50ZXJ2YWwgPSBpbnRlcnZhbHMubGVuZ3RoID8gaW50ZXJ2YWxzWzBdIDogeyBzdGFydF9zZWNvbmQ6IDMyNDAwLCBlbmRfc2Vjb25kOiA2NDgwMCB9O1xyXG5cclxuXHRcdFx0JHJvdy5maW5kKCAnaW5wdXRbdHlwZT1cImNoZWNrYm94XCJdJyApLnByb3AoICdjaGVja2VkJywgaW50ZXJ2YWxzLmxlbmd0aCA+IDAgKTtcclxuXHRcdFx0JHJvdy5maW5kKCAnLndwYmNfYWdfd29ya2luZ190aW1lX3N0YXJ0JyApLnZhbCggc2Vjb25kc190b190aW1lKCBpbnRlcnZhbC5zdGFydF9zZWNvbmQgKSApO1xyXG5cdFx0XHQkcm93LmZpbmQoICcud3BiY19hZ193b3JraW5nX3RpbWVfZW5kJyApLnZhbCggc2Vjb25kc190b190aW1lKCBpbnRlcnZhbC5lbmRfc2Vjb25kICkgKTtcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJlZnJlc2hfd29ya2luZ190aW1lX3BhbmVscygpIHtcclxuXHRcdHZhciBpc19lbmFibGVkID0gZ2V0X2Zvcm0oKS5maW5kKCAnaW5wdXRbbmFtZT1cImJvb2tpbmdfd29ya2luZ190aW1lX2VuYWJsZWRcIl0nICkucHJvcCggJ2NoZWNrZWQnICk7XHJcblx0XHR2YXIgbW9kZSA9IGdldF9mb3JtKCkuZmluZCggJ2lucHV0W25hbWU9XCJib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZV9tb2RlXCJdOmNoZWNrZWQnICkudmFsKCkgfHwgJ2luaGVyaXQnO1xyXG5cclxuXHRcdGdldF9mb3JtKClcclxuXHRcdFx0LmZpbmQoICcud3BiY19hZ193b3JraW5nX3RpbWVfYmxvY2snIClcclxuXHRcdFx0LnRvZ2dsZUNsYXNzKCAnaXMtZGlzYWJsZWQnLCAhIGlzX2VuYWJsZWQgKVxyXG5cdFx0XHQuZmluZCggJ2lucHV0LCBzZWxlY3QsIGJ1dHRvbicgKVxyXG5cdFx0XHQucHJvcCggJ2Rpc2FibGVkJywgISBpc19lbmFibGVkICk7XHJcblxyXG5cdFx0Z2V0X2Zvcm0oKS5maW5kKCAnW2RhdGEtd3BiYy13b3JraW5nLXRpbWUtcmVzb3VyY2UtY3VzdG9tXScgKS50b2dnbGVDbGFzcyggJ2lzLXZpc2libGUnLCBtb2RlID09PSAnY3VzdG9tJyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X3dvcmtpbmdfdGltZV9zZXR0aW5nc19mcm9tX2Zvcm0oKSB7XHJcblx0XHR2YXIgJGZvcm0gPSBnZXRfZm9ybSgpO1xyXG5cdFx0dmFyIHJlc291cmNlSWQgPSBwYXJzZUludCggJGZvcm0uZmluZCggJ1tkYXRhLXdwYmMtd29ya2luZy10aW1lLXJlc291cmNlLWlkXScgKS52YWwoKSwgMTAgKSB8fCBwYXJzZUludCggJCggJyN3cGJjX2FnX3Jlc291cmNlX2lkJyApLnZhbCgpLCAxMCApIHx8IDA7XHJcblx0XHR2YXIgd29ya2luZ1RpbWUgPSAkLmV4dGVuZCggdHJ1ZSwge30sIGNmZy5zZXR0aW5ncyAmJiBjZmcuc2V0dGluZ3Mud29ya2luZ190aW1lID8gY2ZnLnNldHRpbmdzLndvcmtpbmdfdGltZSA6ICggY2ZnLmRlZmF1bHRfc2V0dGluZ3MgJiYgY2ZnLmRlZmF1bHRfc2V0dGluZ3Mud29ya2luZ190aW1lID8gY2ZnLmRlZmF1bHRfc2V0dGluZ3Mud29ya2luZ190aW1lIDoge30gKSApO1xyXG5cclxuXHRcdGlmICggISB3b3JraW5nVGltZS5kZWZhdWx0ICkge1xyXG5cdFx0XHR3b3JraW5nVGltZS5kZWZhdWx0ID0ge307XHJcblx0XHR9XHJcblx0XHRpZiAoICEgd29ya2luZ1RpbWUucmVzb3VyY2VzICkge1xyXG5cdFx0XHR3b3JraW5nVGltZS5yZXNvdXJjZXMgPSB7fTtcclxuXHRcdH1cclxuXHJcblx0XHR3b3JraW5nVGltZS5lbmFibGVkID0gJGZvcm0uZmluZCggJ2lucHV0W25hbWU9XCJib29raW5nX3dvcmtpbmdfdGltZV9lbmFibGVkXCJdJyApLnByb3AoICdjaGVja2VkJyApID8gJ09uJyA6ICdPZmYnO1xyXG5cdFx0d29ya2luZ1RpbWUuZGVmYXVsdC53ZWVrZGF5cyA9IGNvbGxlY3Rfd29ya2luZ190aW1lX3dlZWtkYXlzKCAnYm9va2luZ193b3JraW5nX3RpbWVfZGVmYXVsdCcgKTtcclxuXHJcblx0XHRpZiAoIHJlc291cmNlSWQgPiAwICkge1xyXG5cdFx0XHR3b3JraW5nVGltZS5yZXNvdXJjZXNbIHJlc291cmNlSWQgXSA9IHtcclxuXHRcdFx0XHRtb2RlOiAkZm9ybS5maW5kKCAnaW5wdXRbbmFtZT1cImJvb2tpbmdfd29ya2luZ190aW1lX3Jlc291cmNlX21vZGVcIl06Y2hlY2tlZCcgKS52YWwoKSB8fCAnaW5oZXJpdCcsXHJcblx0XHRcdFx0d2Vla2RheXM6IGNvbGxlY3Rfd29ya2luZ190aW1lX3dlZWtkYXlzKCAnYm9va2luZ193b3JraW5nX3RpbWVfcmVzb3VyY2UnIClcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gd29ya2luZ1RpbWU7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBhcHBseV93b3JraW5nX3RpbWVfc2V0dGluZ3NfdG9fZm9ybSggd29ya2luZ1RpbWUsIHJlc291cmNlSWQgKSB7XHJcblx0XHR2YXIgcmVzb3VyY2VTZXR0aW5ncztcclxuXHJcblx0XHR3b3JraW5nVGltZSA9IHdvcmtpbmdUaW1lIHx8IHt9O1xyXG5cdFx0cmVzb3VyY2VJZCA9IHBhcnNlSW50KCByZXNvdXJjZUlkLCAxMCApIHx8IHBhcnNlSW50KCAkKCAnI3dwYmNfYWdfcmVzb3VyY2VfaWQnICkudmFsKCksIDEwICkgfHwgMDtcclxuXHRcdHJlc291cmNlU2V0dGluZ3MgPSB3b3JraW5nVGltZS5yZXNvdXJjZXMgJiYgd29ya2luZ1RpbWUucmVzb3VyY2VzWyByZXNvdXJjZUlkIF0gPyB3b3JraW5nVGltZS5yZXNvdXJjZXNbIHJlc291cmNlSWQgXSA6IHtcclxuXHRcdFx0bW9kZTogJ2luaGVyaXQnLFxyXG5cdFx0XHR3ZWVrZGF5czogd29ya2luZ1RpbWUuZGVmYXVsdCAmJiB3b3JraW5nVGltZS5kZWZhdWx0LndlZWtkYXlzID8gd29ya2luZ1RpbWUuZGVmYXVsdC53ZWVrZGF5cyA6IHt9XHJcblx0XHR9O1xyXG5cclxuXHRcdGdldF9mb3JtKCkuZmluZCggJ2lucHV0W25hbWU9XCJib29raW5nX3dvcmtpbmdfdGltZV9lbmFibGVkXCJdJyApLnByb3AoICdjaGVja2VkJywgd29ya2luZ1RpbWUuZW5hYmxlZCA9PT0gJ09uJyApO1xyXG5cdFx0Z2V0X2Zvcm0oKS5maW5kKCAnW2RhdGEtd3BiYy13b3JraW5nLXRpbWUtcmVzb3VyY2UtaWRdJyApLnZhbCggcmVzb3VyY2VJZCApO1xyXG5cdFx0c2V0X3dvcmtpbmdfdGltZV93ZWVrZGF5cyggJ2Jvb2tpbmdfd29ya2luZ190aW1lX2RlZmF1bHQnLCB3b3JraW5nVGltZS5kZWZhdWx0ICYmIHdvcmtpbmdUaW1lLmRlZmF1bHQud2Vla2RheXMgPyB3b3JraW5nVGltZS5kZWZhdWx0LndlZWtkYXlzIDoge30gKTtcclxuXHRcdGdldF9mb3JtKCkuZmluZCggJ2lucHV0W25hbWU9XCJib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZV9tb2RlXCJdW3ZhbHVlPVwiJyArICggcmVzb3VyY2VTZXR0aW5ncy5tb2RlIHx8ICdpbmhlcml0JyApICsgJ1wiXScgKS5wcm9wKCAnY2hlY2tlZCcsIHRydWUgKTtcclxuXHRcdHNldF93b3JraW5nX3RpbWVfd2Vla2RheXMoICdib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZScsIHJlc291cmNlU2V0dGluZ3Mud2Vla2RheXMgfHwgKCB3b3JraW5nVGltZS5kZWZhdWx0ID8gd29ya2luZ1RpbWUuZGVmYXVsdC53ZWVrZGF5cyA6IHt9ICkgKTtcclxuXHRcdHJlZnJlc2hfd29ya2luZ190aW1lX3BhbmVscygpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYXBwZW5kX3dvcmtpbmdfdGltZV9wYXlsb2FkKCBwYXlsb2FkICkge1xyXG5cdFx0dmFyICRmb3JtID0gZ2V0X2Zvcm0oKTtcclxuXHRcdHZhciBkZWZhdWx0RGF5cyA9IFtdO1xyXG5cdFx0dmFyIHJlc291cmNlRGF5cyA9IFtdO1xyXG5cdFx0dmFyIGRlZmF1bHRTdGFydCA9IHt9O1xyXG5cdFx0dmFyIGRlZmF1bHRFbmQgPSB7fTtcclxuXHRcdHZhciByZXNvdXJjZVN0YXJ0ID0ge307XHJcblx0XHR2YXIgcmVzb3VyY2VFbmQgPSB7fTtcclxuXHJcblx0XHQkZm9ybS5maW5kKCAnW2RhdGEtd3BiYy13b3JraW5nLXRpbWUtd2Vla2RheXM9XCJib29raW5nX3dvcmtpbmdfdGltZV9kZWZhdWx0XCJdIC53cGJjX2FnX3dvcmtpbmdfdGltZV9yb3cnICkuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR2YXIgJHJvdyA9ICQoIHRoaXMgKTtcclxuXHRcdFx0dmFyIGRheSA9IHBhcnNlSW50KCAkcm93LmZpbmQoICdpbnB1dFt0eXBlPVwiY2hlY2tib3hcIl0nICkudmFsKCksIDEwICk7XHJcblxyXG5cdFx0XHRkZWZhdWx0U3RhcnRbIGRheSBdID0gJHJvdy5maW5kKCAnLndwYmNfYWdfd29ya2luZ190aW1lX3N0YXJ0JyApLnZhbCgpIHx8ICcwOTowMCc7XHJcblx0XHRcdGRlZmF1bHRFbmRbIGRheSBdID0gJHJvdy5maW5kKCAnLndwYmNfYWdfd29ya2luZ190aW1lX2VuZCcgKS52YWwoKSB8fCAnMTg6MDAnO1xyXG5cdFx0XHRpZiAoICRyb3cuZmluZCggJ2lucHV0W3R5cGU9XCJjaGVja2JveFwiXScgKS5wcm9wKCAnY2hlY2tlZCcgKSApIHtcclxuXHRcdFx0XHRkZWZhdWx0RGF5cy5wdXNoKCBkYXkgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cclxuXHRcdCRmb3JtLmZpbmQoICdbZGF0YS13cGJjLXdvcmtpbmctdGltZS13ZWVrZGF5cz1cImJvb2tpbmdfd29ya2luZ190aW1lX3Jlc291cmNlXCJdIC53cGJjX2FnX3dvcmtpbmdfdGltZV9yb3cnICkuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR2YXIgJHJvdyA9ICQoIHRoaXMgKTtcclxuXHRcdFx0dmFyIGRheSA9IHBhcnNlSW50KCAkcm93LmZpbmQoICdpbnB1dFt0eXBlPVwiY2hlY2tib3hcIl0nICkudmFsKCksIDEwICk7XHJcblxyXG5cdFx0XHRyZXNvdXJjZVN0YXJ0WyBkYXkgXSA9ICRyb3cuZmluZCggJy53cGJjX2FnX3dvcmtpbmdfdGltZV9zdGFydCcgKS52YWwoKSB8fCAnMDk6MDAnO1xyXG5cdFx0XHRyZXNvdXJjZUVuZFsgZGF5IF0gPSAkcm93LmZpbmQoICcud3BiY19hZ193b3JraW5nX3RpbWVfZW5kJyApLnZhbCgpIHx8ICcxODowMCc7XHJcblx0XHRcdGlmICggJHJvdy5maW5kKCAnaW5wdXRbdHlwZT1cImNoZWNrYm94XCJdJyApLnByb3AoICdjaGVja2VkJyApICkge1xyXG5cdFx0XHRcdHJlc291cmNlRGF5cy5wdXNoKCBkYXkgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cclxuXHRcdHBheWxvYWQuYm9va2luZ193b3JraW5nX3RpbWVfZW5hYmxlZCA9ICRmb3JtLmZpbmQoICdpbnB1dFtuYW1lPVwiYm9va2luZ193b3JraW5nX3RpbWVfZW5hYmxlZFwiXScgKS5wcm9wKCAnY2hlY2tlZCcgKSA/ICdPbicgOiAnJztcclxuXHRcdHBheWxvYWQuYm9va2luZ193b3JraW5nX3RpbWVfcmVzb3VyY2VfaWQgPSAkZm9ybS5maW5kKCAnW2RhdGEtd3BiYy13b3JraW5nLXRpbWUtcmVzb3VyY2UtaWRdJyApLnZhbCgpIHx8ICQoICcjd3BiY19hZ19yZXNvdXJjZV9pZCcgKS52YWwoKSB8fCAnJztcclxuXHRcdHBheWxvYWQuYm9va2luZ193b3JraW5nX3RpbWVfcmVzb3VyY2VfbW9kZSA9ICRmb3JtLmZpbmQoICdpbnB1dFtuYW1lPVwiYm9va2luZ193b3JraW5nX3RpbWVfcmVzb3VyY2VfbW9kZVwiXTpjaGVja2VkJyApLnZhbCgpIHx8ICdpbmhlcml0JztcclxuXHRcdHBheWxvYWQuYm9va2luZ193b3JraW5nX3RpbWVfZGVmYXVsdF9kYXlzID0gZGVmYXVsdERheXM7XHJcblx0XHRwYXlsb2FkLmJvb2tpbmdfd29ya2luZ190aW1lX2RlZmF1bHRfc3RhcnQgPSBkZWZhdWx0U3RhcnQ7XHJcblx0XHRwYXlsb2FkLmJvb2tpbmdfd29ya2luZ190aW1lX2RlZmF1bHRfZW5kID0gZGVmYXVsdEVuZDtcclxuXHRcdHBheWxvYWQuYm9va2luZ193b3JraW5nX3RpbWVfcmVzb3VyY2VfZGF5cyA9IHJlc291cmNlRGF5cztcclxuXHRcdHBheWxvYWQuYm9va2luZ193b3JraW5nX3RpbWVfcmVzb3VyY2Vfc3RhcnQgPSByZXNvdXJjZVN0YXJ0O1xyXG5cdFx0cGF5bG9hZC5ib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZV9lbmQgPSByZXNvdXJjZUVuZDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHVwZGF0ZV93cGJjX3ByZXZpZXdfcGFyYW1zKCBzZXR0aW5ncyApIHtcclxuXHRcdGlmICggISB3Ll93cGJjIHx8IHR5cGVvZiB3Ll93cGJjLnNldF9vdGhlcl9wYXJhbSAhPT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHcuX3dwYmMuc2V0X290aGVyX3BhcmFtKCAnYXZhaWxhYmlsaXR5X193ZWVrX2RheXNfdW5hdmFpbGFibGUnLCBzZXR0aW5ncy53ZWVrZGF5cy5jb25jYXQoIFsgOTk5IF0gKSApO1xyXG5cdFx0dy5fd3BiYy5zZXRfb3RoZXJfcGFyYW0oICdhdmFpbGFiaWxpdHlfX2F2YWlsYWJsZV9mcm9tX3RvZGF5JywgaXNfYXZhaWxhYmxlX2xpbWl0X2F2YWlsYWJsZSgpID8gKCBzZXR0aW5ncy5ib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5IHx8ICcnICkgOiAnJyApO1xyXG5cdFx0dy5fd3BiYy5zZXRfb3RoZXJfcGFyYW0oICdhdmFpbGFiaWxpdHlfX3VuYXZhaWxhYmxlX2Zyb21fdG9kYXknLCBzZXR0aW5ncy5ib29raW5nX3VuYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXkgfHwgJzAnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB1cGRhdGVfYnVmZmVyX3ByZXZpZXdfbm90ZSggc2V0dGluZ3MgKSB7XHJcblx0XHR2YXIgJG5vdGVzID0gJCggJ1tkYXRhLXdwYmMtYWctY2FsZW5kYXItbm90ZXM9XCIxXCJdJyApLmZpcnN0KCk7XHJcblx0XHR2YXIgJGNhbGVuZGFyID0gJCggJ1tkYXRhLXdwYmMtYWctY2FsZW5kYXItcGFuZWw9XCIxXCJdJyApLmZpcnN0KCk7XHJcblx0XHR2YXIgJG5vdGUgPSAkbm90ZXMuZmluZCggJy53cGJjX2FnX2J1ZmZlcl9wcmV2aWV3X25vdGUnICk7XHJcblx0XHR2YXIgdHlwZSA9IHNldHRpbmdzLmJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfaW5fb3V0IHx8ICcnO1xyXG5cdFx0dmFyIGJlZm9yZV90ZXh0ID0gJyc7XHJcblx0XHR2YXIgYWZ0ZXJfdGV4dCA9ICcnO1xyXG5cdFx0dmFyIG1lc3NhZ2UgPSAnJztcclxuXHJcblx0XHRpZiAoICEgJG5vdGVzLmxlbmd0aCB8fCAhICRjYWxlbmRhci5sZW5ndGggKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICEgJG5vdGUubGVuZ3RoICkge1xyXG5cdFx0XHQkbm90ZSA9ICQoICc8ZGl2IGNsYXNzPVwid3BiY19hZ19idWZmZXJfcHJldmlld19ub3RlXCIgYXJpYS1saXZlPVwicG9saXRlXCI+PC9kaXY+JyApO1xyXG5cdFx0XHQkbm90ZXMuYXBwZW5kKCAkbm90ZSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISBpc19idWZmZXJfYXZhaWxhYmxlKCkgKSB7XHJcblx0XHRcdCRjYWxlbmRhci5yZW1vdmVDbGFzcyggJ3dwYmNfYWdfcHJldmlld19idWZmZXJfYWN0aXZlJyApO1xyXG5cdFx0XHQkbm90ZS5hdHRyKCAnaGlkZGVuJywgJ2hpZGRlbicgKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRjYWxlbmRhci50b2dnbGVDbGFzcyggJ3dwYmNfYWdfcHJldmlld19idWZmZXJfYWN0aXZlJywgISEgdHlwZSApO1xyXG5cclxuXHRcdGlmICggdHlwZSA9PT0gJ20nICkge1xyXG5cdFx0XHRiZWZvcmVfdGV4dCA9IGdldF9vcHRpb25fdGV4dCggJ1tuYW1lPVwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9taW51dGVzX2luXCJdJyApIHx8ICctJztcclxuXHRcdFx0YWZ0ZXJfdGV4dCA9IGdldF9vcHRpb25fdGV4dCggJ1tuYW1lPVwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9taW51dGVzX291dFwiXScgKSB8fCAnLSc7XHJcblx0XHR9IGVsc2UgaWYgKCB0eXBlID09PSAnZCcgKSB7XHJcblx0XHRcdGJlZm9yZV90ZXh0ID0gZ2V0X29wdGlvbl90ZXh0KCAnW25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfaW5cIl0nICkgfHwgJy0nO1xyXG5cdFx0XHRhZnRlcl90ZXh0ID0gZ2V0X29wdGlvbl90ZXh0KCAnW25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfb3V0XCJdJyApIHx8ICctJztcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIHR5cGUgKSB7XHJcblx0XHRcdG1lc3NhZ2UgPSAnPHN0cm9uZz4nICsgKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5idWZmZXJfcHJldmlldyA/IGNmZy5pMThuLmJ1ZmZlcl9wcmV2aWV3IDogJ0J1ZmZlciBwcmV2aWV3JyApICsgJzo8L3N0cm9uZz4gJyArXHJcblx0XHRcdFx0KCBjZmcuaTE4biAmJiBjZmcuaTE4bi5iZWZvcmVfYm9va2luZyA/IGNmZy5pMThuLmJlZm9yZV9ib29raW5nIDogJ0JlZm9yZSBib29raW5nJyApICsgJyAnICsgYmVmb3JlX3RleHQgK1xyXG5cdFx0XHRcdCcgLyAnICsgKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5hZnRlcl9ib29raW5nID8gY2ZnLmkxOG4uYWZ0ZXJfYm9va2luZyA6ICdBZnRlciBib29raW5nJyApICsgJyAnICsgYWZ0ZXJfdGV4dDtcclxuXHRcdFx0aWYgKCAkbm90ZS5odG1sKCkgIT09IG1lc3NhZ2UgKSB7XHJcblx0XHRcdFx0JG5vdGUuaHRtbCggbWVzc2FnZSApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggJG5vdGUuYXR0ciggJ2hpZGRlbicgKSApIHtcclxuXHRcdFx0XHQkbm90ZS5yZW1vdmVBdHRyKCAnaGlkZGVuJyApO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRtZXNzYWdlID0gY2ZnLmkxOG4gJiYgY2ZnLmkxOG4ubm9fYnVmZmVyID8gY2ZnLmkxOG4ubm9fYnVmZmVyIDogJ05vIGJvb2tpbmcgYnVmZmVyIGlzIHNlbGVjdGVkLic7XHJcblx0XHRcdGlmICggJG5vdGUudGV4dCgpICE9PSBtZXNzYWdlICkge1xyXG5cdFx0XHRcdCRub3RlLnRleHQoIG1lc3NhZ2UgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoICEgJG5vdGUuYXR0ciggJ2hpZGRlbicgKSApIHtcclxuXHRcdFx0XHQkbm90ZS5hdHRyKCAnaGlkZGVuJywgJ2hpZGRlbicgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYXBwbHlfYnVmZmVyX2RheXNfcHJldmlldyggc2V0dGluZ3MgKSB7XHJcblx0XHR2YXIgJGNhbGVuZGFyID0gJCggJ1tkYXRhLXdwYmMtYWctY2FsZW5kYXItcGFuZWw9XCIxXCJdJyApO1xyXG5cdFx0dmFyIGJlZm9yZV9kYXlzID0gZ2V0X2RheXNfdmFsdWUoIHNldHRpbmdzLmJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfZGF5c19pbiApO1xyXG5cdFx0dmFyIGFmdGVyX2RheXMgPSBnZXRfZGF5c192YWx1ZSggc2V0dGluZ3MuYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9kYXlzX291dCApO1xyXG5cdFx0dmFyIGRhdGVfY2VsbHMgPSB7fTtcclxuXHRcdHZhciBib29rZWRfZGF0ZXMgPSBbXTtcclxuXHJcblx0XHRpZiAoICEgaXNfYnVmZmVyX2F2YWlsYWJsZSgpICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBzZXR0aW5ncy5ib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2luX291dCAhPT0gJ2QnIHx8ICggISBiZWZvcmVfZGF5cyAmJiAhIGFmdGVyX2RheXMgKSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRjYWxlbmRhci5maW5kKCAnLmRhdGVwaWNrLWRheXMtY2VsbCcgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHZhciAkY2VsbCA9ICQoIHRoaXMgKTtcclxuXHRcdFx0dmFyIHNxbF9kYXRlID0gZ2V0X3NxbF9kYXRlX2Zyb21fY2VsbCggdGhpcyApO1xyXG5cdFx0XHR2YXIgY2VsbF9kYXRlO1xyXG5cclxuXHRcdFx0aWYgKCAhIHNxbF9kYXRlICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZGF0ZV9jZWxsc1sgc3FsX2RhdGUgXSA9ICRjZWxsO1xyXG5cclxuXHRcdFx0aWYgKCAkY2VsbC5oYXNDbGFzcyggJ2RhdGVfYXBwcm92ZWQnICkgfHwgJGNlbGwuaGFzQ2xhc3MoICdkYXRlMmFwcHJvdmUnICkgKSB7XHJcblx0XHRcdFx0Y2VsbF9kYXRlID0gZGF0ZV9mcm9tX3NxbCggc3FsX2RhdGUgKTtcclxuXHRcdFx0XHRpZiAoIGNlbGxfZGF0ZSApIHtcclxuXHRcdFx0XHRcdGJvb2tlZF9kYXRlcy5wdXNoKCBjZWxsX2RhdGUgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHJcblx0XHQkLmVhY2goIGJvb2tlZF9kYXRlcywgZnVuY3Rpb24gKCBpbmRleCwgYm9va2VkX2RhdGUgKSB7XHJcblx0XHRcdHZhciBvZmZzZXQ7XHJcblx0XHRcdHZhciB0YXJnZXRfc3FsX2RhdGU7XHJcblx0XHRcdHZhciAkdGFyZ2V0X2NlbGw7XHJcblxyXG5cdFx0XHRmb3IgKCBvZmZzZXQgPSBiZWZvcmVfZGF5cyAqIC0xOyBvZmZzZXQgPCAwOyBvZmZzZXQrKyApIHtcclxuXHRcdFx0XHR0YXJnZXRfc3FsX2RhdGUgPSBkYXRlX3RvX3NxbCggYWRkX2RheXMoIGJvb2tlZF9kYXRlLCBvZmZzZXQgKSApO1xyXG5cdFx0XHRcdCR0YXJnZXRfY2VsbCA9IGRhdGVfY2VsbHNbIHRhcmdldF9zcWxfZGF0ZSBdO1xyXG5cdFx0XHRcdGlmICggJHRhcmdldF9jZWxsICYmICEgJHRhcmdldF9jZWxsLmhhc0NsYXNzKCAnZGF0ZV9hcHByb3ZlZCcgKSAmJiAhICR0YXJnZXRfY2VsbC5oYXNDbGFzcyggJ2RhdGUyYXBwcm92ZScgKSApIHtcclxuXHRcdFx0XHRcdHJlbWVtYmVyX3ByZXZpZXdfb3JpZ2luKCAkdGFyZ2V0X2NlbGwgKTtcclxuXHRcdFx0XHRcdCR0YXJnZXRfY2VsbC5hZGRDbGFzcyggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZSB3cGJjX2FnX3ByZXZpZXdfdW5hdmFpbGFibGUgd3BiY19hZ19wcmV2aWV3X2J1ZmZlcl91bmF2YWlsYWJsZSBidWZmZXJfdW5hdmFpbGFibGUnICk7XHJcblx0XHRcdFx0XHQkdGFyZ2V0X2NlbGwuYXR0ciggJ2RhdGEtd3BiYy1hZy1wcmV2aWV3LXJlYXNvbicsICd3cGJjX2FnX3ByZXZpZXdfYnVmZmVyX3VuYXZhaWxhYmxlJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Zm9yICggb2Zmc2V0ID0gMTsgb2Zmc2V0IDw9IGFmdGVyX2RheXM7IG9mZnNldCsrICkge1xyXG5cdFx0XHRcdHRhcmdldF9zcWxfZGF0ZSA9IGRhdGVfdG9fc3FsKCBhZGRfZGF5cyggYm9va2VkX2RhdGUsIG9mZnNldCApICk7XHJcblx0XHRcdFx0JHRhcmdldF9jZWxsID0gZGF0ZV9jZWxsc1sgdGFyZ2V0X3NxbF9kYXRlIF07XHJcblx0XHRcdFx0aWYgKCAkdGFyZ2V0X2NlbGwgJiYgISAkdGFyZ2V0X2NlbGwuaGFzQ2xhc3MoICdkYXRlX2FwcHJvdmVkJyApICYmICEgJHRhcmdldF9jZWxsLmhhc0NsYXNzKCAnZGF0ZTJhcHByb3ZlJyApICkge1xyXG5cdFx0XHRcdFx0cmVtZW1iZXJfcHJldmlld19vcmlnaW4oICR0YXJnZXRfY2VsbCApO1xyXG5cdFx0XHRcdFx0JHRhcmdldF9jZWxsLmFkZENsYXNzKCAnZGF0ZV91c2VyX3VuYXZhaWxhYmxlIHdwYmNfYWdfcHJldmlld191bmF2YWlsYWJsZSB3cGJjX2FnX3ByZXZpZXdfYnVmZmVyX3VuYXZhaWxhYmxlIGJ1ZmZlcl91bmF2YWlsYWJsZScgKTtcclxuXHRcdFx0XHRcdCR0YXJnZXRfY2VsbC5hdHRyKCAnZGF0YS13cGJjLWFnLXByZXZpZXctcmVhc29uJywgJ3dwYmNfYWdfcHJldmlld19idWZmZXJfdW5hdmFpbGFibGUnICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByZW1lbWJlcl9wcmV2aWV3X29yaWdpbiggJGNlbGwgKSB7XHJcblx0XHRpZiAoIHR5cGVvZiAkY2VsbC5hdHRyKCAnZGF0YS13cGJjLWFnLW9yaWdpbmFsLWRhdGUtdXNlci11bmF2YWlsYWJsZScgKSA9PT0gJ3VuZGVmaW5lZCcgKSB7XHJcblx0XHRcdCRjZWxsLmF0dHIoICdkYXRhLXdwYmMtYWctb3JpZ2luYWwtZGF0ZS11c2VyLXVuYXZhaWxhYmxlJywgJGNlbGwuaGFzQ2xhc3MoICdkYXRlX3VzZXJfdW5hdmFpbGFibGUnICkgPyAnMScgOiAnMCcgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGNsZWFyX3ByZXZpZXdfY2VsbCggJGNlbGwgKSB7XHJcblx0XHR2YXIgaGFkX2RhdGVfdXNlcl91bmF2YWlsYWJsZSA9ICRjZWxsLmF0dHIoICdkYXRhLXdwYmMtYWctb3JpZ2luYWwtZGF0ZS11c2VyLXVuYXZhaWxhYmxlJyApID09PSAnMSc7XHJcblxyXG5cdFx0JGNlbGwucmVtb3ZlQ2xhc3MoIHByZXZpZXdfdW5hdmFpbGFibGVfY2xhc3NlcyApO1xyXG5cdFx0JGNlbGwucmVtb3ZlQXR0ciggJ2RhdGEtd3BiYy1hZy1wcmV2aWV3LXJlYXNvbicgKTtcclxuXHRcdCRjZWxsLnJlbW92ZUF0dHIoICdkYXRhLXdwYmMtYWctb3JpZ2luYWwtZGF0ZS11c2VyLXVuYXZhaWxhYmxlJyApO1xyXG5cclxuXHRcdGlmICggISBoYWRfZGF0ZV91c2VyX3VuYXZhaWxhYmxlICkge1xyXG5cdFx0XHQkY2VsbC5yZW1vdmVDbGFzcyggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGFwcGx5X2NhbGVuZGFyX3ByZXZpZXcoKSB7XHJcblx0XHR2YXIgc2V0dGluZ3MgPSBjb2xsZWN0X3NldHRpbmdzKCk7XHJcblx0XHR2YXIgdG9kYXlfZGF0ZSA9IGdldF9yZWFsX3RvZGF5X2RhdGUoKTtcclxuXHRcdHZhciBhdmFpbGFibGVfbGltaXQgPSBpc19hdmFpbGFibGVfbGltaXRfYXZhaWxhYmxlKCkgPyBwYXJzZUludCggc2V0dGluZ3MuYm9va2luZ19hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheSB8fCAnMCcsIDEwICkgOiAwO1xyXG5cdFx0dmFyICRjYWxlbmRhciA9ICQoICdbZGF0YS13cGJjLWFnLWNhbGVuZGFyLXBhbmVsPVwiMVwiXScgKTtcclxuXHJcblx0XHR1cGRhdGVfd3BiY19wcmV2aWV3X3BhcmFtcyggc2V0dGluZ3MgKTtcclxuXHRcdHVwZGF0ZV9idWZmZXJfcHJldmlld19ub3RlKCBzZXR0aW5ncyApO1xyXG5cclxuXHRcdCRjYWxlbmRhci5maW5kKCAnLmRhdGVwaWNrLWRheXMtY2VsbCcgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHZhciBjZWxsID0gdGhpcztcclxuXHRcdFx0dmFyICRjZWxsID0gJCggY2VsbCApO1xyXG5cdFx0XHR2YXIgc3FsX2RhdGUgPSBnZXRfc3FsX2RhdGVfZnJvbV9jZWxsKCBjZWxsICk7XHJcblx0XHRcdHZhciBjZWxsX2RhdGUgPSBkYXRlX2Zyb21fc3FsKCBzcWxfZGF0ZSApO1xyXG5cdFx0XHR2YXIgbWFrZV91bmF2YWlsYWJsZSA9IGZhbHNlO1xyXG5cdFx0XHR2YXIgcmVhc29uX2NsYXNzID0gJyc7XHJcblx0XHRcdHZhciBwcmV2aW91c19yZWFzb24gPSAkY2VsbC5hdHRyKCAnZGF0YS13cGJjLWFnLXByZXZpZXctcmVhc29uJyApIHx8ICcnO1xyXG5cdFx0XHR2YXIgaGFkX2dlbmVyYWxfcHJldmlldyA9ICEhIHByZXZpb3VzX3JlYXNvbiB8fCAkY2VsbC5oYXNDbGFzcyggJ3dwYmNfYWdfcHJldmlld191bmF2YWlsYWJsZScgKSB8fCAkY2VsbC5oYXNDbGFzcyggJ3dlZWtkYXlfdW5hdmFpbGFibGUnICkgfHwgJGNlbGwuaGFzQ2xhc3MoICdmcm9tX3RvZGF5X3VuYXZhaWxhYmxlJyApIHx8ICRjZWxsLmhhc0NsYXNzKCAnbGltaXRfYXZhaWxhYmxlX2Zyb21fdG9kYXknICkgfHwgJGNlbGwuaGFzQ2xhc3MoICdidWZmZXJfdW5hdmFpbGFibGUnICk7XHJcblxyXG5cdFx0XHRpZiAoICEgY2VsbF9kYXRlICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBzZXR0aW5ncy53ZWVrZGF5cy5pbmRleE9mKCBjZWxsX2RhdGUuZ2V0RGF5KCkgKSA+IC0xICkge1xyXG5cdFx0XHRcdG1ha2VfdW5hdmFpbGFibGUgPSB0cnVlO1xyXG5cdFx0XHRcdHJlYXNvbl9jbGFzcyA9ICd3cGJjX2FnX3ByZXZpZXdfd2Vla2RheV91bmF2YWlsYWJsZSc7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggdW5hdmFpbGFibGVfZnJvbV90b2RheV9hcHBsaWVzKCBjZWxsX2RhdGUsIHRvZGF5X2RhdGUsIHNldHRpbmdzLmJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheSApICkge1xyXG5cdFx0XHRcdG1ha2VfdW5hdmFpbGFibGUgPSB0cnVlO1xyXG5cdFx0XHRcdHJlYXNvbl9jbGFzcyA9ICd3cGJjX2FnX3ByZXZpZXdfZnJvbV90b2RheV91bmF2YWlsYWJsZSc7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggYXZhaWxhYmxlX2xpbWl0ID4gMCAmJiBkYXlzX2JldHdlZW4oIGNlbGxfZGF0ZSwgdG9kYXlfZGF0ZSApID49IGF2YWlsYWJsZV9saW1pdCApIHtcclxuXHRcdFx0XHRtYWtlX3VuYXZhaWxhYmxlID0gdHJ1ZTtcclxuXHRcdFx0XHRyZWFzb25fY2xhc3MgPSAnd3BiY19hZ19wcmV2aWV3X2xpbWl0X2F2YWlsYWJsZV9mcm9tX3RvZGF5JztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBtYWtlX3VuYXZhaWxhYmxlICkge1xyXG5cdFx0XHRcdGlmICggcHJldmlvdXNfcmVhc29uICE9PSByZWFzb25fY2xhc3MgKSB7XHJcblx0XHRcdFx0XHRpZiAoIGhhZF9nZW5lcmFsX3ByZXZpZXcgKSB7XHJcblx0XHRcdFx0XHRcdGNsZWFyX3ByZXZpZXdfY2VsbCggJGNlbGwgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHJlbWVtYmVyX3ByZXZpZXdfb3JpZ2luKCAkY2VsbCApO1xyXG5cdFx0XHRcdFx0JGNlbGwuYWRkQ2xhc3MoICdkYXRlX3VzZXJfdW5hdmFpbGFibGUgd3BiY19hZ19wcmV2aWV3X3VuYXZhaWxhYmxlICcgKyByZWFzb25fY2xhc3MgKTtcclxuXHRcdFx0XHRcdCRjZWxsLmF0dHIoICdkYXRhLXdwYmMtYWctcHJldmlldy1yZWFzb24nLCByZWFzb25fY2xhc3MgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gZWxzZSBpZiAoIGhhZF9nZW5lcmFsX3ByZXZpZXcgKSB7XHJcblx0XHRcdFx0Y2xlYXJfcHJldmlld19jZWxsKCAkY2VsbCApO1xyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0YXBwbHlfYnVmZmVyX2RheXNfcHJldmlldyggc2V0dGluZ3MgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHF1ZXVlX3ByZXZpZXdfcmVmcmVzaCgpIHtcclxuXHRcdGlmICggcHJldmlld19mcmFtZSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgKSB7XHJcblx0XHRcdHByZXZpZXdfZnJhbWUgPSB3LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHByZXZpZXdfZnJhbWUgPSAwO1xyXG5cdFx0XHRcdGFwcGx5X2NhbGVuZGFyX3ByZXZpZXcoKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cHJldmlld19mcmFtZSA9IHcuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHByZXZpZXdfZnJhbWUgPSAwO1xyXG5cdFx0XHRcdGFwcGx5X2NhbGVuZGFyX3ByZXZpZXcoKTtcclxuXHRcdFx0fSwgMCApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2NoZWR1bGVfcHJldmlld19yZWZyZXNoKCBkZWxheSApIHtcclxuXHRcdGNsZWFyVGltZW91dCggcHJldmlld190aW1lciApO1xyXG5cdFx0ZGVsYXkgPSBwYXJzZUludCggZGVsYXksIDEwICkgfHwgMDtcclxuXHJcblx0XHRpZiAoIGRlbGF5ID4gMCApIHtcclxuXHRcdFx0cHJldmlld190aW1lciA9IHNldFRpbWVvdXQoIHF1ZXVlX3ByZXZpZXdfcmVmcmVzaCwgZGVsYXkgKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHF1ZXVlX3ByZXZpZXdfcmVmcmVzaCgpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdXBkYXRlX2hpbnRzKCBoaW50cyApIHtcclxuXHRcdGlmICggISBoaW50cyApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggdHlwZW9mIGhpbnRzLmJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheV9faGludCAhPT0gJ3VuZGVmaW5lZCcgKSB7XHJcblx0XHRcdCQoICdbZGF0YS13cGJjLWFnLWhpbnQ9XCJib29raW5nX3VuYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXlcIl0nICkuaHRtbChcclxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJ3cGJjX2FnX2hpbnRfdW5hdmFpbGFibGVcIj4nICsgJCggJ1tkYXRhLXdwYmMtYWctaGludD1cImJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheVwiXSAud3BiY19hZ19oaW50X3VuYXZhaWxhYmxlJyApLmZpcnN0KCkudGV4dCgpICsgJzwvc3Bhbj4nICtcclxuXHRcdFx0XHRoaW50cy5ib29raW5nX3VuYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXlfX2hpbnRcclxuXHRcdFx0KTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIHR5cGVvZiBoaW50cy5ib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5X19oaW50ICE9PSAndW5kZWZpbmVkJyApIHtcclxuXHRcdFx0JCggJ1tkYXRhLXdwYmMtYWctaGludD1cImJvb2tpbmdfYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXlcIl0nICkuaHRtbChcclxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJ3cGJjX2FnX2hpbnRfYXZhaWxhYmxlXCI+JyArICQoICdbZGF0YS13cGJjLWFnLWhpbnQ9XCJib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5XCJdIC53cGJjX2FnX2hpbnRfYXZhaWxhYmxlJyApLmZpcnN0KCkudGV4dCgpICsgJzwvc3Bhbj4nICtcclxuXHRcdFx0XHRoaW50cy5ib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5X19oaW50XHJcblx0XHRcdCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzaG93X21lc3NhZ2UoIG1lc3NhZ2UsIHR5cGUsIGR1cmF0aW9uICkge1xyXG5cdFx0aWYgKCB0eXBlb2Ygdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0dy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggbWVzc2FnZSwgdHlwZSB8fCAnaW5mbycsIGR1cmF0aW9uIHx8IDIwMDAsIGZhbHNlICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR3LmFsZXJ0KCBtZXNzYWdlICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZXRfYnVzeSggJGJ1dHRvbiwgYnVzeSApIHtcclxuXHRcdHZhciBidXN5X3RleHQ7XHJcblxyXG5cdFx0aWYgKCAhICRidXR0b24gfHwgISAkYnV0dG9uLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggYnVzeSApIHtcclxuXHRcdFx0aWYgKCAhICRidXR0b24uZGF0YSggJ3dwYmMtYWctb3JpZ2luYWwtaHRtbCcgKSApIHtcclxuXHRcdFx0XHQkYnV0dG9uLmRhdGEoICd3cGJjLWFnLW9yaWdpbmFsLWh0bWwnLCAkYnV0dG9uLmh0bWwoKSApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGJ1c3lfdGV4dCA9ICRidXR0b24uZGF0YSggJ3dwYmMtdS1idXN5LXRleHQnICkgfHwgKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5zYXZpbmcgKSB8fCAnU2F2aW5nLi4uJztcclxuXHRcdFx0JGJ1dHRvbi5hZGRDbGFzcyggJ3dwYmNfYWdfaXNfc2F2aW5nJyApLmF0dHIoICdhcmlhLWJ1c3knLCAndHJ1ZScgKS5odG1sKCAnPGkgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9yb3RhdGVfcmlnaHQgd3BiY19zcGluXCI+PC9pPjxzcGFuIGNsYXNzPVwiaW4tYnV0dG9uLXRleHRcIj4mbmJzcDsmbmJzcDsnICsgYnVzeV90ZXh0ICsgJzwvc3Bhbj4nICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHQkYnV0dG9uLnJlbW92ZUNsYXNzKCAnd3BiY19hZ19pc19zYXZpbmcnICkucmVtb3ZlQXR0ciggJ2FyaWEtYnVzeScgKTtcclxuXHRcdFx0aWYgKCAkYnV0dG9uLmRhdGEoICd3cGJjLWFnLW9yaWdpbmFsLWh0bWwnICkgKSB7XHJcblx0XHRcdFx0JGJ1dHRvbi5odG1sKCAkYnV0dG9uLmRhdGEoICd3cGJjLWFnLW9yaWdpbmFsLWh0bWwnICkgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcmVwbGFjZV9jYWxlbmRhcl9wYW5lbCggaHRtbCApIHtcclxuXHRcdHZhciAkaG9sZGVyID0gJCggJzxkaXYgLz4nICkuYXBwZW5kKCAkLnBhcnNlSFRNTCggaHRtbCwgZG9jdW1lbnQsIHRydWUgKSApO1xyXG5cdFx0dmFyICRuZXdfcGFuZWwgPSAkaG9sZGVyLmZpbmQoICdbZGF0YS13cGJjLWFnLWNhbGVuZGFyLXBhbmVsPVwiMVwiXScgKS5maXJzdCgpO1xyXG5cdFx0dmFyICRvbGRfcGFuZWwgPSAkKCAnW2RhdGEtd3BiYy1hZy1jYWxlbmRhci1wYW5lbD1cIjFcIl0nICkuZmlyc3QoKTtcclxuXHRcdHZhciAkc2NyaXB0cztcclxuXHJcblx0XHRpZiAoICEgJG5ld19wYW5lbC5sZW5ndGggfHwgISAkb2xkX3BhbmVsLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRzY3JpcHRzID0gJG5ld19wYW5lbC5maW5kKCAnc2NyaXB0JyApLnJlbW92ZSgpO1xyXG5cdFx0JG9sZF9wYW5lbC5yZXBsYWNlV2l0aCggJG5ld19wYW5lbCApO1xyXG5cclxuXHRcdCRzY3JpcHRzLmVhY2goIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0dmFyIGNvZGUgPSB0aGlzLnRleHQgfHwgdGhpcy50ZXh0Q29udGVudCB8fCB0aGlzLmlubmVySFRNTCB8fCAnJztcclxuXHRcdFx0dmFyIHNyYyA9IHRoaXMuc3JjIHx8ICcnO1xyXG5cclxuXHRcdFx0aWYgKCBzcmMgKSB7XHJcblx0XHRcdFx0JC5hamF4KCB7XHJcblx0XHRcdFx0XHR1cmw6IHNyYyxcclxuXHRcdFx0XHRcdGRhdGFUeXBlOiAnc2NyaXB0JyxcclxuXHRcdFx0XHRcdGNhY2hlOiB0cnVlXHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9IGVsc2UgaWYgKCBjb2RlICkge1xyXG5cdFx0XHRcdCQuZ2xvYmFsRXZhbCggY29kZSApO1xyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZXRfY2FsZW5kYXJfbG9hZGluZyggaXNfbG9hZGluZyApIHtcclxuXHRcdHZhciAkY2FsZW5kYXIgPSAkKCAnW2RhdGEtd3BiYy1hZy1jYWxlbmRhci1wYW5lbD1cIjFcIl0nICkuZmlyc3QoKTtcclxuXHRcdHZhciBsb2FkaW5nX3RleHQgPSBjZmcuaTE4biAmJiBjZmcuaTE4bi5sb2FkaW5nID8gY2ZnLmkxOG4ubG9hZGluZyA6ICdMb2FkaW5nJztcclxuXHRcdHZhciAkbG9hZGluZztcclxuXHJcblx0XHRpZiAoICEgJGNhbGVuZGFyLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggaXNfbG9hZGluZyApIHtcclxuXHRcdFx0JGxvYWRpbmcgPSAkY2FsZW5kYXIuZmluZCggJy53cGJjX2NhbGVuZGFyX2xvYWRpbmcnICkuZmlyc3QoKTtcclxuXHRcdFx0aWYgKCAhICRsb2FkaW5nLmxlbmd0aCApIHtcclxuXHRcdFx0XHQkbG9hZGluZyA9ICQoXHJcblx0XHRcdFx0XHQnPGRpdiBjbGFzcz1cIndwYmNfY2FsZW5kYXJfbG9hZGluZyB3cGJjX2FnX2NhbGVuZGFyX2xvYWRpbmdcIj4nICtcclxuXHRcdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwid3BiY19pY25fYXV0b3JlbmV3IHdwYmNfc3BpblwiPjwvc3Bhbj4mbmJzcDsmbmJzcDsnICtcclxuXHRcdFx0XHRcdFx0JzxzcGFuPjwvc3Bhbj4nICtcclxuXHRcdFx0XHRcdCc8L2Rpdj4nXHJcblx0XHRcdFx0KTtcclxuXHRcdFx0XHQkbG9hZGluZy5maW5kKCAnc3BhbicgKS5sYXN0KCkudGV4dCggbG9hZGluZ190ZXh0ICsgJy4uLicgKTtcclxuXHRcdFx0XHQkY2FsZW5kYXIuYXBwZW5kKCAkbG9hZGluZyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdCRjYWxlbmRhci5hZGRDbGFzcyggJ2lzLWxvYWRpbmcnICkuYXR0ciggJ2FyaWEtYnVzeScsICd0cnVlJyApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0JGNhbGVuZGFyLnJlbW92ZUNsYXNzKCAnaXMtbG9hZGluZycgKS5yZW1vdmVBdHRyKCAnYXJpYS1idXN5JyApO1xyXG5cdFx0XHQkY2FsZW5kYXIuZmluZCggJy53cGJjX2NhbGVuZGFyX2xvYWRpbmcnICkucmVtb3ZlKCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfcHJldmlld19wYXlsb2FkKCkge1xyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0YWN0aW9uOiBjZmcucHJldmlld19hY3Rpb24gfHwgJ1dQQkNfQUpYX0FWQUlMQUJJTElUWV9HRU5FUkFMX1BSRVZJRVcnLFxyXG5cdFx0XHRub25jZTogY2ZnLm5vbmNlIHx8ICcnLFxyXG5cdFx0XHRyZXNvdXJjZV9pZDogJCggJyN3cGJjX2FnX3Jlc291cmNlX2lkJyApLnZhbCgpIHx8ICcnLFxyXG5cdFx0XHRtb250aHNfY291bnQ6ICQoICcjd3BiY19hZ19tb250aHNfY291bnQnICkudmFsKCkgfHwgJydcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBsb2FkX2NhbGVuZGFyX3ByZXZpZXcoKSB7XHJcblx0XHR2YXIgJGNhbGVuZGFyID0gJCggJ1tkYXRhLXdwYmMtYWctY2FsZW5kYXItcGFuZWw9XCIxXCJdJyApLmZpcnN0KCk7XHJcblx0XHR2YXIgY3VycmVudF9wcmV2aWV3X2FqYXg7XHJcblxyXG5cdFx0aWYgKCAhIGNmZy5hamF4X3VybCApIHtcclxuXHRcdFx0c2hvd19tZXNzYWdlKCAoIGNmZy5pMThuICYmIGNmZy5pMThuLnByZXZpZXdfZmFpbGVkICkgfHwgJ1VuYWJsZSB0byByZWZyZXNoIGNhbGVuZGFyIHByZXZpZXcuJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggcHJldmlld19hamF4ICYmIHByZXZpZXdfYWpheC5yZWFkeVN0YXRlICE9PSA0ICkge1xyXG5cdFx0XHRwcmV2aWV3X2FqYXguYWJvcnQoKTtcclxuXHRcdH1cclxuXHJcblx0XHRzZXRfY2FsZW5kYXJfbG9hZGluZyggdHJ1ZSApO1xyXG5cclxuXHRcdGN1cnJlbnRfcHJldmlld19hamF4ID0gJC5hamF4KCB7XHJcblx0XHRcdHVybDogY2ZnLmFqYXhfdXJsLFxyXG5cdFx0XHRtZXRob2Q6ICdQT1NUJyxcclxuXHRcdFx0ZGF0YVR5cGU6ICdqc29uJyxcclxuXHRcdFx0ZGF0YTogZ2V0X3ByZXZpZXdfcGF5bG9hZCgpXHJcblx0XHR9ICk7XHJcblx0XHRwcmV2aWV3X2FqYXggPSBjdXJyZW50X3ByZXZpZXdfYWpheDtcclxuXHJcblx0XHRjdXJyZW50X3ByZXZpZXdfYWpheC5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xyXG5cdFx0XHRpZiAoICEgcmVzcG9uc2UgfHwgISByZXNwb25zZS5zdWNjZXNzIHx8ICEgcmVzcG9uc2UuZGF0YSB8fCAhIHJlc3BvbnNlLmRhdGEuaHRtbCApIHtcclxuXHRcdFx0XHRzaG93X21lc3NhZ2UoICggcmVzcG9uc2UgJiYgcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLm1lc3NhZ2UgKSB8fCAoIGNmZy5pMThuICYmIGNmZy5pMThuLnByZXZpZXdfZmFpbGVkICkgfHwgJ1VuYWJsZSB0byByZWZyZXNoIGNhbGVuZGFyIHByZXZpZXcuJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJlcGxhY2VfY2FsZW5kYXJfcGFuZWwoIHJlc3BvbnNlLmRhdGEuaHRtbCApO1xyXG5cdFx0XHQkKCAnW2RhdGEtd3BiYy1hZy1wYWdlPVwiMVwiXScgKS5hdHRyKCAnZGF0YS13cGJjLWFnLXJlc291cmNlLWlkJywgcmVzcG9uc2UuZGF0YS5yZXNvdXJjZV9pZCB8fCAnJyApO1xyXG5cdFx0XHRvYnNlcnZlX2NhbGVuZGFyX2NoYW5nZXMoKTtcclxuXHRcdFx0c2NoZWR1bGVfcHJldmlld19yZWZyZXNoKCk7XHJcblx0XHRcdHNldFRpbWVvdXQoIHNjaGVkdWxlX3ByZXZpZXdfcmVmcmVzaCwgNjAwICk7XHJcblx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCBqcV94aHIsIHRleHRfc3RhdHVzICkge1xyXG5cdFx0XHRpZiAoIHRleHRfc3RhdHVzICE9PSAnYWJvcnQnICkge1xyXG5cdFx0XHRcdHNob3dfbWVzc2FnZSggKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5wcmV2aWV3X2ZhaWxlZCApIHx8ICdVbmFibGUgdG8gcmVmcmVzaCBjYWxlbmRhciBwcmV2aWV3LicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKS5hbHdheXMoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0aWYgKCBwcmV2aWV3X2FqYXggPT09IGN1cnJlbnRfcHJldmlld19hamF4ICkge1xyXG5cdFx0XHRcdHNldF9jYWxlbmRhcl9sb2FkaW5nKCBmYWxzZSApO1xyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzYXZlX3NldHRpbmdzKCBidXR0b24gKSB7XHJcblx0XHR2YXIgJGJ1dHRvbiA9ICQoIGJ1dHRvbiApO1xyXG5cdFx0dmFyIHNldHRpbmdzID0gY29sbGVjdF9zZXR0aW5ncygpO1xyXG5cdFx0dmFyIHBheWxvYWQgPSAkLmV4dGVuZCgge30sIHNldHRpbmdzLCB7XHJcblx0XHRcdGFjdGlvbjogY2ZnLmFjdGlvbiB8fCAnV1BCQ19BSlhfQVZBSUxBQklMSVRZX0dFTkVSQUxfU0FWRScsXHJcblx0XHRcdG5vbmNlOiBjZmcubm9uY2UgfHwgJycsXHJcblx0XHRcdGJvb2tpbmdfdW5hdmFpbGFibGVfZGF5czogc2V0dGluZ3Mud2Vla2RheXNcclxuXHRcdH0gKTtcclxuXHJcblx0XHRhcHBlbmRfd29ya2luZ190aW1lX3BheWxvYWQoIHBheWxvYWQgKTtcclxuXHJcblx0XHRpZiAoICEgY2ZnLmFqYXhfdXJsICkge1xyXG5cdFx0XHRzaG93X21lc3NhZ2UoICggY2ZnLmkxOG4gJiYgY2ZnLmkxOG4uc2F2ZV9mYWlsZWQgKSB8fCAnVW5hYmxlIHRvIHNhdmUgZ2VuZXJhbCBhdmFpbGFiaWxpdHkgc2V0dGluZ3MuJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHNldF9idXN5KCAkYnV0dG9uLCB0cnVlICk7XHJcblxyXG5cdFx0JC5hamF4KCB7XHJcblx0XHRcdHVybDogY2ZnLmFqYXhfdXJsLFxyXG5cdFx0XHRtZXRob2Q6ICdQT1NUJyxcclxuXHRcdFx0ZGF0YVR5cGU6ICdqc29uJyxcclxuXHRcdFx0ZGF0YTogcGF5bG9hZFxyXG5cdFx0fSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XHJcblx0XHRcdGlmICggISByZXNwb25zZSB8fCAhIHJlc3BvbnNlLnN1Y2Nlc3MgKSB7XHJcblx0XHRcdFx0c2hvd19tZXNzYWdlKCAoIHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5tZXNzYWdlICkgfHwgKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5zYXZlX2ZhaWxlZCApIHx8ICdVbmFibGUgdG8gc2F2ZSBnZW5lcmFsIGF2YWlsYWJpbGl0eSBzZXR0aW5ncy4nLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCByZXNwb25zZS5kYXRhICYmIHJlc3BvbnNlLmRhdGEuc2V0dGluZ3MgJiYgcmVzcG9uc2UuZGF0YS5zZXR0aW5ncy5oaW50cyApIHtcclxuXHRcdFx0XHR1cGRhdGVfaGludHMoIHJlc3BvbnNlLmRhdGEuc2V0dGluZ3MuaGludHMgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5zZXR0aW5ncyApIHtcclxuXHRcdFx0XHRjZmcuc2V0dGluZ3MgPSByZXNwb25zZS5kYXRhLnNldHRpbmdzO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRsb2FkX2NhbGVuZGFyX3ByZXZpZXcoKTtcclxuXHRcdFx0ZG9jdW1lbnQuZGlzcGF0Y2hFdmVudCggbmV3IEN1c3RvbUV2ZW50KCAnd3BiYzphdmFpbGFiaWxpdHktZ2VuZXJhbDpzZXR0aW5ncy1zYXZlZCcsIHtcclxuXHRcdFx0XHRkZXRhaWw6IHtcclxuXHRcdFx0XHRcdHNldHRpbmdzOiByZXNwb25zZS5kYXRhICYmIHJlc3BvbnNlLmRhdGEuc2V0dGluZ3MgPyByZXNwb25zZS5kYXRhLnNldHRpbmdzIDoge31cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKSApO1xyXG5cdFx0XHRzaG93X21lc3NhZ2UoICggcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLm1lc3NhZ2UgKSB8fCAoIGNmZy5pMThuICYmIGNmZy5pMThuLnNhdmVkICkgfHwgJ0dlbmVyYWwgYXZhaWxhYmlsaXR5IHNldHRpbmdzIHVwZGF0ZWQuJywgJ3N1Y2Nlc3MnLCAyMDAwICk7XHJcblx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRzaG93X21lc3NhZ2UoICggY2ZnLmkxOG4gJiYgY2ZnLmkxOG4uc2F2ZV9mYWlsZWQgKSB8fCAnVW5hYmxlIHRvIHNhdmUgZ2VuZXJhbCBhdmFpbGFiaWxpdHkgc2V0dGluZ3MuJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdH0gKS5hbHdheXMoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0c2V0X2J1c3koICRidXR0b24sIGZhbHNlICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByZXNldF9zZXR0aW5ncyggYnV0dG9uICkge1xyXG5cdFx0dmFyIGNvbmZpcm1fbWVzc2FnZSA9ICggY2ZnLmkxOG4gJiYgY2ZnLmkxOG4ucmVzZXRfY29uZmlybSApIHx8ICdSZXNldCBnZW5lcmFsIGF2YWlsYWJpbGl0eSBzZXR0aW5ncyB0byBkZWZhdWx0IHZhbHVlcz8nO1xyXG5cdFx0dmFyIGRlZmF1bHRfc2V0dGluZ3MgPSBjZmcuZGVmYXVsdF9zZXR0aW5ncyB8fCB7XHJcblx0XHRcdHdlZWtkYXlzOiBbXSxcclxuXHRcdFx0Ym9va2luZ191bmF2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5OiAnMCcsXHJcblx0XHRcdGJvb2tpbmdfYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXk6ICcnLFxyXG5cdFx0XHRib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2luX291dDogJycsXHJcblx0XHRcdGJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfbWludXRlc19pbjogJycsXHJcblx0XHRcdGJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfbWludXRlc19vdXQ6ICcnLFxyXG5cdFx0XHRib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfaW46ICcnLFxyXG5cdFx0XHRib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfb3V0OiAnJyxcclxuXHRcdFx0d29ya2luZ190aW1lOiB7fVxyXG5cdFx0fTtcclxuXHJcblx0XHRpZiAoICEgdy5jb25maXJtKCBjb25maXJtX21lc3NhZ2UgKSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGFwcGx5X3NldHRpbmdzX3RvX2Zvcm0oIGRlZmF1bHRfc2V0dGluZ3MgKTtcclxuXHRcdGxvYWRfY2FsZW5kYXJfcHJldmlldygpO1xyXG5cdFx0c2hvd19tZXNzYWdlKCAoIGNmZy5pMThuICYmIGNmZy5pMThuLnJlc2V0X2FwcGxpZWQgKSB8fCAnRGVmYXVsdCBhdmFpbGFiaWxpdHkgc2V0dGluZ3MgYXJlIHJlYWR5IGZvciBwcmV2aWV3LiBDbGljayBTYXZlIENoYW5nZXMgdG8gYXBwbHkgdGhlbS4nLCAnc3VjY2VzcycsIDQwMDAgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIG9ic2VydmVfY2FsZW5kYXJfY2hhbmdlcygpIHtcclxuXHRcdHZhciB0YXJnZXQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1hZy1jYWxlbmRhci1wYW5lbD1cIjFcIl0nICk7XHJcblxyXG5cdFx0aWYgKCAhIHRhcmdldCB8fCAhIHcuTXV0YXRpb25PYnNlcnZlciApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggb2JzZXJ2ZXIgKSB7XHJcblx0XHRcdG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcclxuXHRcdH1cclxuXHJcblx0XHRvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCBzY2hlZHVsZV9wcmV2aWV3X3JlZnJlc2ggKTtcclxuXHRcdG9ic2VydmVyLm9ic2VydmUoIHRhcmdldCwge1xyXG5cdFx0XHRjaGlsZExpc3Q6IHRydWUsXHJcblx0XHRcdHN1YnRyZWU6IHRydWVcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19hZ19yaWdodGJhcl90YWJzIFtyb2xlPVwidGFiXCJdJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0c3dpdGNoX3BhbmVsKCAkKCB0aGlzICkgKTtcclxuXHR9ICk7XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19hZ19yaWdodGJhcl9wYW5lbHMgLmdyb3VwX19oZWFkZXInLCBmdW5jdGlvbiAoKSB7XHJcblx0XHR0b2dnbGVfZ3JvdXAoICQoIHRoaXMgKSApO1xyXG5cdH0gKTtcclxuXHJcblx0JCggZG9jdW1lbnQgKS5vbiggJ3N1Ym1pdCcsICdbZGF0YS13cGJjLWFnLXByZXZpZXctdG9vbGJhcj1cIjFcIl0nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdGxvYWRfY2FsZW5kYXJfcHJldmlldygpO1xyXG5cdH0gKTtcclxuXHJcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICcjd3BiY19hZ19yZXNvdXJjZV9pZCwgI3dwYmNfYWdfbW9udGhzX2NvdW50JywgbG9hZF9jYWxlbmRhcl9wcmV2aWV3ICk7XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnI3dwYmNfYWdfcmVzb3VyY2VfaWQnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRjZmcuc2V0dGluZ3MgPSBjZmcuc2V0dGluZ3MgfHwge307XHJcblx0XHRjZmcuc2V0dGluZ3Mud29ya2luZ190aW1lID0gZ2V0X3dvcmtpbmdfdGltZV9zZXR0aW5nc19mcm9tX2Zvcm0oKTtcclxuXHRcdGFwcGx5X3dvcmtpbmdfdGltZV9zZXR0aW5nc190b19mb3JtKCBjZmcuc2V0dGluZ3Mud29ya2luZ190aW1lLCAkKCB0aGlzICkudmFsKCkgKTtcclxuXHR9ICk7XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdpbnB1dCBjaGFuZ2UnLCAnW2RhdGEtd3BiYy1hZy1yYW5nZS1mb3JdJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0c3luY19zZWxlY3RfZnJvbV9yYW5nZSggdGhpcyApO1xyXG5cdFx0c2NoZWR1bGVfcHJldmlld19yZWZyZXNoKCk7XHJcblx0fSApO1xyXG5cclxuXHQkKCBkb2N1bWVudCApLm9uKCAnY2hhbmdlJywgJ1tkYXRhLXdwYmMtYWctc2V0dGluZ3MtZm9ybT1cIjFcIl0gc2VsZWN0JywgZnVuY3Rpb24gKCkge1xyXG5cdFx0c3luY19yYW5nZV9mcm9tX3NlbGVjdCggdGhpcyApO1xyXG5cdH0gKTtcclxuXHJcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJ1tkYXRhLXdwYmMtYWctc3RlcHBlcl0nLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRzdGVwX3NlbGVjdF92YWx1ZSggdGhpcyApO1xyXG5cdH0gKTtcclxuXHJcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICdpbnB1dFtuYW1lPVwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9pbl9vdXRcIl0nLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZWZyZXNoX2J1ZmZlcl9maWVsZHMoKTtcclxuXHRcdHNjaGVkdWxlX3ByZXZpZXdfcmVmcmVzaCgpO1xyXG5cdH0gKTtcclxuXHJcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICdpbnB1dFtuYW1lPVwiYm9va2luZ193b3JraW5nX3RpbWVfZW5hYmxlZFwiXScsIHJlZnJlc2hfd29ya2luZ190aW1lX3BhbmVscyApO1xyXG5cclxuXHQkKCBkb2N1bWVudCApLm9uKCAnY2hhbmdlJywgJ2lucHV0W25hbWU9XCJib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZV9tb2RlXCJdJywgcmVmcmVzaF93b3JraW5nX3RpbWVfcGFuZWxzICk7XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnW2RhdGEtd3BiYy1hZy1zZXR0aW5ncy1mb3JtPVwiMVwiXSBpbnB1dCwgW2RhdGEtd3BiYy1hZy1zZXR0aW5ncy1mb3JtPVwiMVwiXSBzZWxlY3QnLCBzY2hlZHVsZV9wcmV2aWV3X3JlZnJlc2ggKTtcclxuXHJcblx0JCggZG9jdW1lbnQgKS5vbiggJ3N1Ym1pdCcsICdbZGF0YS13cGJjLWFnLXNldHRpbmdzLWZvcm09XCIxXCJdJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRzYXZlX3NldHRpbmdzKCAkKCAnW2RhdGEtd3BiYy1hZy1zYXZlPVwiMVwiXScgKS5maXJzdCgpICk7XHJcblx0fSApO1xyXG5cclxuXHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnW2RhdGEtd3BiYy1hZy1zYXZlPVwiMVwiXScsIGZ1bmN0aW9uICgpIHtcclxuXHRcdHNhdmVfc2V0dGluZ3MoIHRoaXMgKTtcclxuXHR9ICk7XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICdbZGF0YS13cGJjLWFnLXJlc2V0PVwiMVwiXScsIGZ1bmN0aW9uICgpIHtcclxuXHRcdHJlc2V0X3NldHRpbmdzKCB0aGlzICk7XHJcblx0fSApO1xyXG5cclxuXHQkKCBkb2N1bWVudCApLnJlYWR5KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRhcHBseV93b3JraW5nX3RpbWVfc2V0dGluZ3NfdG9fZm9ybSggKCBjZmcuc2V0dGluZ3MgJiYgY2ZnLnNldHRpbmdzLndvcmtpbmdfdGltZSApIHx8ICggY2ZnLmRlZmF1bHRfc2V0dGluZ3MgJiYgY2ZnLmRlZmF1bHRfc2V0dGluZ3Mud29ya2luZ190aW1lICkgfHwge30sICQoICcjd3BiY19hZ19yZXNvdXJjZV9pZCcgKS52YWwoKSApO1xyXG5cdFx0YXBwbHlfb3Blbl9zZWN0aW9uX2Zyb21fdXJsKCk7XHJcblx0XHRyZWZyZXNoX2J1ZmZlcl9maWVsZHMoKTtcclxuXHRcdHN5bmNfYWxsX3JhbmdlcygpO1xyXG5cdFx0b2JzZXJ2ZV9jYWxlbmRhcl9jaGFuZ2VzKCk7XHJcblx0XHRzY2hlZHVsZV9wcmV2aWV3X3JlZnJlc2goKTtcclxuXHRcdHNldFRpbWVvdXQoIHNjaGVkdWxlX3ByZXZpZXdfcmVmcmVzaCwgNjAwICk7XHJcblx0fSApO1xyXG59KCBqUXVlcnksIHdpbmRvdyApICk7XHJcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDRSxXQUFXQSxDQUFDLEVBQUVDLENBQUMsRUFBRztFQUNuQixZQUFZOztFQUVaLElBQUlDLEdBQUcsR0FBR0QsQ0FBQyxDQUFDRSw4QkFBOEIsSUFBSSxDQUFDLENBQUM7RUFDaEQsSUFBSUMsYUFBYSxHQUFHLENBQUM7RUFDckIsSUFBSUMsYUFBYSxHQUFHLENBQUM7RUFDckIsSUFBSUMsWUFBWSxHQUFHLElBQUk7RUFDdkIsSUFBSUMsUUFBUSxHQUFHLElBQUk7RUFDbkIsSUFBSUMsMkJBQTJCLEdBQUcsK1FBQStRO0VBRWpULFNBQVNDLFNBQVNBLENBQUVDLEtBQUssRUFBRztJQUMzQixPQUFPQyxNQUFNLENBQUVELEtBQUssSUFBSSxFQUFHLENBQUMsQ0FBQ0UsSUFBSSxDQUFDLENBQUM7RUFDcEM7RUFFQSxTQUFTQyxZQUFZQSxDQUFFQyxJQUFJLEVBQUc7SUFDN0IsSUFBSUMsUUFBUSxHQUFHRCxJQUFJLENBQUNFLElBQUksQ0FBRSxlQUFnQixDQUFDO0lBQzNDLElBQUlDLEtBQUssR0FBR0gsSUFBSSxDQUFDSSxPQUFPLENBQUUsd0JBQXlCLENBQUMsQ0FBQ0MsSUFBSSxDQUFFLGNBQWUsQ0FBQztJ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
