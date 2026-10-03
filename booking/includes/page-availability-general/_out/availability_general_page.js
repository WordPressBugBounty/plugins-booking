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

  /**
   * Return the bounded interval limit for one Working Time editor.
   *
   * @param {jQuery} $weekdays Working Time weekday wrapper.
   * @return {number} Maximum intervals per weekday.
   */
  function get_max_working_time_intervals($weekdays) {
    var configured_limit = parseInt($weekdays.attr('data-max-intervals'), 10);
    var localized_limit = parseInt(cfg.max_working_time_intervals, 10);
    return Math.max(1, Math.min(48, configured_limit || localized_limit || 8));
  }

  /**
   * Read all visible interval controls for one weekday.
   *
   * @param {jQuery} $day_row Weekday row.
   * @return {Object[]} Canonical interval records.
   */
  function collect_working_time_day_intervals($day_row) {
    var intervals = [];
    $day_row.find('[data-wpbc-working-time-interval="1"]').each(function () {
      var $interval = $(this);
      intervals.push({
        start_second: time_to_seconds($interval.find('.wpbc_ag_working_time_start').val()),
        end_second: time_to_seconds($interval.find('.wpbc_ag_working_time_end').val())
      });
    });
    return intervals;
  }

  /**
   * Rebuild dynamic names, IDs, and label associations after a row mutation.
   *
   * @param {jQuery} $day_row Weekday row.
   * @return {void}
   */
  function reindex_working_time_day($day_row) {
    var $weekdays = $day_row.closest('[data-wpbc-working-time-weekdays]');
    var prefix = String($weekdays.attr('data-wpbc-working-time-weekdays') || '');
    var day = parseInt($day_row.attr('data-wpbc-working-time-day'), 10);
    $day_row.find('[data-wpbc-working-time-interval="1"]').each(function (interval_index) {
      var $interval = $(this);
      var start_id = prefix + '_start_' + day + '_' + interval_index;
      var end_id = prefix + '_end_' + day + '_' + interval_index;
      var $labels = $interval.find('label');
      $interval.attr('data-interval-index', interval_index);
      $interval.find('.wpbc_ag_working_time_start').attr('id', start_id).attr('name', prefix + '_start[' + day + '][]');
      $interval.find('.wpbc_ag_working_time_end').attr('id', end_id).attr('name', prefix + '_end[' + day + '][]');
      $labels.eq(0).attr('for', start_id);
      $labels.eq(1).attr('for', end_id);
    });
  }

  /**
   * Refresh one weekday's enabled controls and interval-limit state.
   *
   * @param {jQuery} $day_row Weekday row.
   * @return {void}
   */
  function refresh_working_time_day($day_row) {
    var $weekdays = $day_row.closest('[data-wpbc-working-time-weekdays]');
    var $toggle = $day_row.find('[data-wpbc-working-time-day-toggle="1"]').first();
    var $resource_custom = $day_row.closest('[data-wpbc-working-time-resource-custom="1"]');
    var is_block_disabled = $day_row.closest('.wpbc_ag_working_time_block').hasClass('is-disabled') || $resource_custom.length && !$resource_custom.hasClass('is-visible');
    var is_day_enabled = !is_block_disabled && $toggle.prop('checked');
    var interval_count = $day_row.find('[data-wpbc-working-time-interval="1"]').length;
    var max_intervals = get_max_working_time_intervals($weekdays);
    $day_row.toggleClass('is-enabled', $toggle.prop('checked'));
    $toggle.prop('disabled', is_block_disabled);
    $day_row.find('.wpbc_ag_working_time_start, .wpbc_ag_working_time_end, [data-wpbc-remove-working-time-interval]').prop('disabled', !is_day_enabled);
    $day_row.find('[data-wpbc-add-working-time-interval]').prop('disabled', !is_day_enabled || interval_count >= max_intervals);
  }

  /**
   * Find a non-overlapping one-hour interval proposal.
   *
   * @param {Object[]} intervals Current weekday intervals.
   * @return {Object|null} Proposed interval, or null when the day has no gap.
   */
  function find_working_time_interval_proposal(intervals) {
    var sorted_intervals = intervals.slice().sort(function (first_interval, second_interval) {
      return first_interval.start_second - second_interval.start_second;
    });
    var preferred_start = sorted_intervals.length ? sorted_intervals[sorted_intervals.length - 1].end_second : 9 * 3600;
    var candidates = [];
    var candidate_start;
    for (candidate_start = 0; candidate_start <= 23 * 3600; candidate_start += 1800) {
      if (candidate_start >= preferred_start) {
        candidates.push(candidate_start);
      }
    }
    for (candidate_start = 0; candidate_start < preferred_start && candidate_start <= 23 * 3600; candidate_start += 1800) {
      candidates.push(candidate_start);
    }
    candidate_start = null;
    candidates.some(function (proposed_start) {
      var proposed_end = proposed_start + 3600;
      var overlaps = sorted_intervals.some(function (interval) {
        return proposed_start < interval.end_second && proposed_end > interval.start_second;
      });
      if (proposed_end <= 86400 && !overlaps) {
        candidate_start = proposed_start;
        return true;
      }
      return false;
    });
    return null === candidate_start ? null : {
      start_second: candidate_start,
      end_second: candidate_start + 3600
    };
  }

  /**
   * Append an interval by cloning the server-rendered allow-listed controls.
   *
   * @param {jQuery} $day_row Weekday row.
   * @param {Object} interval Canonical interval record.
   * @return {jQuery} Appended interval node.
   */
  function append_working_time_interval($day_row, interval) {
    var $container = $day_row.find('[data-wpbc-working-time-intervals="1"]').first();
    var $prototype = $container.find('[data-wpbc-working-time-interval="1"]').first();
    var $interval = $prototype.clone(false, false);
    $interval.find('.wpbc_ag_working_time_start').val(seconds_to_time(interval.start_second));
    $interval.find('.wpbc_ag_working_time_end').val(seconds_to_time(interval.end_second));
    $container.append($interval);
    reindex_working_time_day($day_row);
    return $interval;
  }

  /**
   * Add the next available one-hour interval to a weekday.
   *
   * @param {HTMLElement} button Add-interval button.
   * @return {void}
   */
  function add_working_time_interval(button) {
    var $day_row = $(button).closest('[data-wpbc-working-time-day]');
    var $weekdays = $day_row.closest('[data-wpbc-working-time-weekdays]');
    var intervals = collect_working_time_day_intervals($day_row);
    var max_intervals = get_max_working_time_intervals($weekdays);
    var proposal;
    var $interval;
    if (intervals.length >= max_intervals) {
      show_message(cfg.i18n && cfg.i18n.interval_limit || 'No additional one-hour interval is available for this weekday.', 'error', 6000);
      return;
    }
    proposal = find_working_time_interval_proposal(intervals);
    if (!proposal) {
      show_message(cfg.i18n && cfg.i18n.interval_limit || 'No additional one-hour interval is available for this weekday.', 'error', 6000);
      return;
    }
    $interval = append_working_time_interval($day_row, proposal);
    $day_row.find('[data-wpbc-working-time-day-toggle="1"]').prop('checked', true);
    refresh_working_time_day($day_row);
    $interval.find('.wpbc_ag_working_time_start').trigger('focus');
    schedule_preview_refresh();
  }

  /**
   * Remove one weekday interval, closing the weekday when it is the last one.
   *
   * Keeping one disabled interval in the DOM preserves an allow-listed control
   * prototype for reopening the day or adding a later interval.
   *
   * @param {HTMLElement} button Remove-interval button.
   * @return {void}
   */
  function remove_working_time_interval(button) {
    var $button = $(button);
    var $day_row = $button.closest('[data-wpbc-working-time-day]');
    var $intervals = $day_row.find('[data-wpbc-working-time-interval="1"]');
    var $focus_target;
    if ($intervals.length > 1) {
      $button.closest('[data-wpbc-working-time-interval="1"]').remove();
      $focus_target = $day_row.find('[data-wpbc-add-working-time-interval="1"]').first();
    } else {
      $day_row.find('[data-wpbc-working-time-day-toggle="1"]').prop('checked', false);
      $focus_target = $day_row.find('[data-wpbc-working-time-day-toggle="1"]').first();
    }
    reindex_working_time_day($day_row);
    refresh_working_time_day($day_row);
    $focus_target.trigger('focus');
    schedule_preview_refresh();
  }
  function collect_working_time_weekdays(prefix) {
    var $form = get_form();
    var weekdays = {};
    $form.find('[data-wpbc-working-time-weekdays="' + prefix + '"] .wpbc_ag_working_time_row').each(function () {
      var $row = $(this);
      var day = parseInt($row.attr('data-wpbc-working-time-day'), 10);
      weekdays[day] = [];
      if (!$row.find('[data-wpbc-working-time-day-toggle="1"]').prop('checked')) {
        return;
      }
      weekdays[day] = collect_working_time_day_intervals($row);
    });
    return weekdays;
  }
  function set_working_time_weekdays(prefix, weekdays) {
    var $wrap = get_form().find('[data-wpbc-working-time-weekdays="' + prefix + '"]');
    $wrap.find('.wpbc_ag_working_time_row').each(function () {
      var $row = $(this);
      var day = parseInt($row.attr('data-wpbc-working-time-day'), 10);
      var intervals = weekdays && $.isArray(weekdays[day]) ? weekdays[day] : [];
      var display_intervals = intervals.length ? intervals : [{
        start_second: 32400,
        end_second: 64800
      }];
      var $container = $row.find('[data-wpbc-working-time-intervals="1"]').first();
      var $prototype = $container.find('[data-wpbc-working-time-interval="1"]').first().clone(false, false);
      $container.empty().append($prototype);
      $prototype.find('.wpbc_ag_working_time_start').val(seconds_to_time(display_intervals[0].start_second));
      $prototype.find('.wpbc_ag_working_time_end').val(seconds_to_time(display_intervals[0].end_second));
      display_intervals.slice(1).forEach(function (interval) {
        append_working_time_interval($row, interval);
      });
      $row.find('[data-wpbc-working-time-day-toggle="1"]').prop('checked', intervals.length > 0);
      reindex_working_time_day($row);
    });
  }
  function refresh_working_time_panels() {
    var is_enabled = get_form().find('input[name="booking_working_time_enabled"]').prop('checked');
    var mode = get_form().find('input[name="booking_working_time_resource_mode"]:checked').val() || 'inherit';
    var $resource_custom = get_form().find('[data-wpbc-working-time-resource-custom]');
    $resource_custom.toggleClass('is-visible', mode === 'custom');
    get_form().find('.wpbc_ag_working_time_block').toggleClass('is-disabled', !is_enabled);
    get_form().find('.wpbc_ag_working_time_block').each(function () {
      $(this).find('input, select, button').prop('disabled', !is_enabled);
    });
    get_form().find('[data-wpbc-working-time-day]').each(function () {
      refresh_working_time_day($(this));
    });
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
      var day = parseInt($row.attr('data-wpbc-working-time-day'), 10);
      defaultStart[day] = [];
      defaultEnd[day] = [];
      $row.find('[data-wpbc-working-time-interval="1"]').each(function () {
        defaultStart[day].push($(this).find('.wpbc_ag_working_time_start').val() || '09:00');
        defaultEnd[day].push($(this).find('.wpbc_ag_working_time_end').val() || '18:00');
      });
      if ($row.find('[data-wpbc-working-time-day-toggle="1"]').prop('checked')) {
        defaultDays.push(day);
      }
    });
    $form.find('[data-wpbc-working-time-weekdays="booking_working_time_resource"] .wpbc_ag_working_time_row').each(function () {
      var $row = $(this);
      var day = parseInt($row.attr('data-wpbc-working-time-day'), 10);
      resourceStart[day] = [];
      resourceEnd[day] = [];
      $row.find('[data-wpbc-working-time-interval="1"]').each(function () {
        resourceStart[day].push($(this).find('.wpbc_ag_working_time_start').val() || '09:00');
        resourceEnd[day].push($(this).find('.wpbc_ag_working_time_end').val() || '18:00');
      });
      if ($row.find('[data-wpbc-working-time-day-toggle="1"]').prop('checked')) {
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
        if (response.data.settings.working_time) {
          apply_working_time_settings_to_form(response.data.settings.working_time, $('#wpbc_ag_resource_id').val());
        }
      }
      load_calendar_preview();
      document.dispatchEvent(new CustomEvent('wpbc:availability-general:settings-saved', {
        detail: {
          settings: response.data && response.data.settings ? response.data.settings : {}
        }
      }));
      show_message(response.data && response.data.message || cfg.i18n && cfg.i18n.saved || 'General availability settings updated.', 'success', 2000);
    }).fail(function (jq_xhr) {
      var response_message = jq_xhr && jq_xhr.responseJSON && jq_xhr.responseJSON.data && jq_xhr.responseJSON.data.message ? jq_xhr.responseJSON.data.message : '';
      show_message(response_message || cfg.i18n && cfg.i18n.save_failed || 'Unable to save general availability settings.', 'error', 10000);
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
  $(document).on('change', '[data-wpbc-working-time-day-toggle="1"]', function () {
    refresh_working_time_day($(this).closest('[data-wpbc-working-time-day]'));
  });
  $(document).on('click', '[data-wpbc-add-working-time-interval="1"]', function () {
    add_working_time_interval(this);
  });
  $(document).on('click', '[data-wpbc-remove-working-time-interval="1"]', function () {
    remove_working_time_interval(this);
  });
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1hdmFpbGFiaWxpdHktZ2VuZXJhbC9fb3V0L2F2YWlsYWJpbGl0eV9nZW5lcmFsX3BhZ2UuanMiLCJuYW1lcyI6WyIkIiwidyIsImNmZyIsIndwYmNfYXZhaWxhYmlsaXR5X2dlbmVyYWxfcGFnZSIsInByZXZpZXdfdGltZXIiLCJwcmV2aWV3X2ZyYW1lIiwicHJldmlld19hamF4Iiwib2JzZXJ2ZXIiLCJwcmV2aWV3X3VuYXZhaWxhYmxlX2NsYXNzZXMiLCJ0cmltX3RleHQiLCJ2YWx1ZSIsIlN0cmluZyIsInRyaW0iLCJzd2l0Y2hfcGFuZWwiLCIkdGFiIiwicGFuZWxfaWQiLCJhdHRyIiwiJHRhYnMiLCJjbG9zZXN0IiwiZmluZCIsIiRwYW5lbHMiLCJyZW1vdmVBdHRyIiwidG9nZ2xlX2dyb3VwIiwiJGJ1dHRvbiIsIiRncm91cCIsIiRmaWVsZHMiLCJpc19vcGVuIiwiaGFzQ2xhc3MiLCJ0b2dnbGVDbGFzcyIsInByb3AiLCJjbG9zZV9ncm91cCIsInJlbW92ZUNsYXNzIiwib3Blbl9ncm91cCIsImdyb3VwX25hbWUiLCJpc19leGNsdXNpdmUiLCJsZW5ndGgiLCJzaWJsaW5ncyIsImVhY2giLCJhZGRDbGFzcyIsInNjcm9sbF90b19ncm91cCIsIiRzY3JvbGxfcGFyZW50Iiwic2Nyb2xsX3BhcmVudF9lbCIsImdyb3VwX2VsIiwic2Nyb2xsX3RvcCIsInBhcmVudF9yZWN0IiwiZ3JvdXBfcmVjdCIsInBhcmVudHMiLCIkY2FuZGlkYXRlIiwib3ZlcmZsb3dfeSIsImNzcyIsInRlc3QiLCJzY3JvbGxIZWlnaHQiLCJjbGllbnRIZWlnaHQiLCJmaXJzdCIsImdldCIsInNjcm9sbEludG9WaWV3IiwiYmxvY2siLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJzY3JvbGxUb3AiLCJ0b3AiLCJzdG9wIiwiYW5pbWF0ZSIsIk1hdGgiLCJtYXgiLCJhcHBseV9vcGVuX3NlY3Rpb25fZnJvbV91cmwiLCJzZWN0aW9uX2dyb3VwcyIsIndlZWtkYXlzIiwiZnJvbV90b2RheSIsImJ1ZmZlciIsIndvcmtpbmdfdGltZSIsIm9wZW5fc2VjdGlvbiIsImluZGV4IiwiZGVsYXkiLCJzZXRUaW1lb3V0IiwicmVmcmVzaF9idWZmZXJfZmllbGRzIiwidmFsIiwiJHBhbmVsIiwiZGF0YSIsImlzX2J1ZmZlcl9hdmFpbGFibGUiLCJpc19hdmFpbGFibGVfbGltaXRfYXZhaWxhYmxlIiwic3luY19yYW5nZV9mcm9tX3NlbGVjdCIsInNlbGVjdCIsIiRzZWxlY3QiLCJuYW1lIiwic2VsZWN0ZWRfaW5kZXgiLCJzZWxlY3RlZF90ZXh0IiwidGV4dCIsIiRyYW5nZSIsIiR2YWx1ZSIsInN5bmNfc2VsZWN0X2Zyb21fcmFuZ2UiLCJyYW5nZSIsInBhcnNlSW50Iiwic3luY19hbGxfcmFuZ2VzIiwic3RlcF9zZWxlY3RfdmFsdWUiLCJidXR0b24iLCJzdGVwIiwiY3VycmVudF9pbmRleCIsIm5leHRfaW5kZXgiLCJtaW4iLCJ0cmlnZ2VyIiwiZ2V0X2Zvcm0iLCJjb2xsZWN0X3NldHRpbmdzIiwiJGZvcm0iLCJwdXNoIiwiYm9va2luZ191bmF2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5IiwiYm9va2luZ19hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheSIsImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfaW5fb3V0IiwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9taW51dGVzX2luIiwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9taW51dGVzX291dCIsImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfZGF5c19pbiIsImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfZGF5c19vdXQiLCJnZXRfd29ya2luZ190aW1lX3NldHRpbmdzX2Zyb21fZm9ybSIsInNldF9zZWxlY3RfdmFsdWUiLCIkZmllbGQiLCJhcHBseV9zZXR0aW5nc190b19mb3JtIiwic2V0dGluZ3MiLCJkYXlfbnVtIiwiYXBwbHlfd29ya2luZ190aW1lX3NldHRpbmdzX3RvX2Zvcm0iLCJzY2hlZHVsZV9wcmV2aWV3X3JlZnJlc2giLCJkYXRlX2Zyb21fc3FsIiwic3FsX2RhdGUiLCJwYXJ0cyIsInNwbGl0IiwiRGF0ZSIsImdldF90b2RheV9kYXRlIiwiYXJyIiwiX3dwYmMiLCJnZXRfb3RoZXJfcGFyYW0iLCJub3ciLCJnZXRGdWxsWWVhciIsImdldE1vbnRoIiwiZ2V0RGF0ZSIsImdldF9yZWFsX3RvZGF5X2RhdGUiLCJkYXlzX2JldHdlZW4iLCJkYXRlX2EiLCJkYXRlX2IiLCJmbG9vciIsImdldFRpbWUiLCJhZGRfZGF5cyIsImRhdGUiLCJkYXlzIiwic2hpZnRlZF9kYXRlIiwic2V0RGF0ZSIsImRhdGVfdG9fc3FsIiwibW9udGgiLCJkYXkiLCJnZXRfc3FsX2RhdGVfZnJvbV9jZWxsIiwiY2VsbCIsImNsYXNzZXMiLCJjbGFzc05hbWUiLCJpIiwiaW5kZXhPZiIsInJlcGxhY2UiLCJ1bmF2YWlsYWJsZV9mcm9tX3RvZGF5X2FwcGxpZXMiLCJjZWxsX2RhdGUiLCJ0b2RheV9kYXRlIiwibWludXRlcyIsInVuYXZhaWxhYmxlX3VudGlsIiwiZ2V0X29wdGlvbl90ZXh0Iiwic2VsZWN0b3IiLCJnZXRfZGF5c192YWx1ZSIsInRpbWVfdG9fc2Vjb25kcyIsInRpbWUiLCJob3VycyIsIm1pbnMiLCJzZWNvbmRzX3RvX3RpbWUiLCJzZWNvbmRzIiwiZ2V0X21heF93b3JraW5nX3RpbWVfaW50ZXJ2YWxzIiwiJHdlZWtkYXlzIiwiY29uZmlndXJlZF9saW1pdCIsImxvY2FsaXplZF9saW1pdCIsIm1heF93b3JraW5nX3RpbWVfaW50ZXJ2YWxzIiwiY29sbGVjdF93b3JraW5nX3RpbWVfZGF5X2ludGVydmFscyIsIiRkYXlfcm93IiwiaW50ZXJ2YWxzIiwiJGludGVydmFsIiwic3RhcnRfc2Vjb25kIiwiZW5kX3NlY29uZCIsInJlaW5kZXhfd29ya2luZ190aW1lX2RheSIsInByZWZpeCIsImludGVydmFsX2luZGV4Iiwic3RhcnRfaWQiLCJlbmRfaWQiLCIkbGFiZWxzIiwiZXEiLCJyZWZyZXNoX3dvcmtpbmdfdGltZV9kYXkiLCIkdG9nZ2xlIiwiJHJlc291cmNlX2N1c3RvbSIsImlzX2Jsb2NrX2Rpc2FibGVkIiwiaXNfZGF5X2VuYWJsZWQiLCJpbnRlcnZhbF9jb3VudCIsIm1heF9pbnRlcnZhbHMiLCJmaW5kX3dvcmtpbmdfdGltZV9pbnRlcnZhbF9wcm9wb3NhbCIsInNvcnRlZF9pbnRlcnZhbHMiLCJzbGljZSIsInNvcnQiLCJmaXJzdF9pbnRlcnZhbCIsInNlY29uZF9pbnRlcnZhbCIsInByZWZlcnJlZF9zdGFydCIsImNhbmRpZGF0ZXMiLCJjYW5kaWRhdGVfc3RhcnQiLCJzb21lIiwicHJvcG9zZWRfc3RhcnQiLCJwcm9wb3NlZF9lbmQiLCJvdmVybGFwcyIsImludGVydmFsIiwiYXBwZW5kX3dvcmtpbmdfdGltZV9pbnRlcnZhbCIsIiRjb250YWluZXIiLCIkcHJvdG90eXBlIiwiY2xvbmUiLCJhcHBlbmQiLCJhZGRfd29ya2luZ190aW1lX2ludGVydmFsIiwicHJvcG9zYWwiLCJzaG93X21lc3NhZ2UiLCJpMThuIiwiaW50ZXJ2YWxfbGltaXQiLCJyZW1vdmVfd29ya2luZ190aW1lX2ludGVydmFsIiwiJGludGVydmFscyIsIiRmb2N1c190YXJnZXQiLCJyZW1vdmUiLCJjb2xsZWN0X3dvcmtpbmdfdGltZV93ZWVrZGF5cyIsIiRyb3ciLCJzZXRfd29ya2luZ190aW1lX3dlZWtkYXlzIiwiJHdyYXAiLCJpc0FycmF5IiwiZGlzcGxheV9pbnRlcnZhbHMiLCJlbXB0eSIsImZvckVhY2giLCJyZWZyZXNoX3dvcmtpbmdfdGltZV9wYW5lbHMiLCJpc19lbmFibGVkIiwibW9kZSIsInJlc291cmNlSWQiLCJ3b3JraW5nVGltZSIsImV4dGVuZCIsImRlZmF1bHRfc2V0dGluZ3MiLCJkZWZhdWx0IiwicmVzb3VyY2VzIiwiZW5hYmxlZCIsInJlc291cmNlU2V0dGluZ3MiLCJhcHBlbmRfd29ya2luZ190aW1lX3BheWxvYWQiLCJwYXlsb2FkIiwiZGVmYXVsdERheXMiLCJyZXNvdXJjZURheXMiLCJkZWZhdWx0U3RhcnQiLCJkZWZhdWx0RW5kIiwicmVzb3VyY2VTdGFydCIsInJlc291cmNlRW5kIiwiYm9va2luZ193b3JraW5nX3RpbWVfZW5hYmxlZCIsImJvb2tpbmdfd29ya2luZ190aW1lX3Jlc291cmNlX2lkIiwiYm9va2luZ193b3JraW5nX3RpbWVfcmVzb3VyY2VfbW9kZSIsImJvb2tpbmdfd29ya2luZ190aW1lX2RlZmF1bHRfZGF5cyIsImJvb2tpbmdfd29ya2luZ190aW1lX2RlZmF1bHRfc3RhcnQiLCJib29raW5nX3dvcmtpbmdfdGltZV9kZWZhdWx0X2VuZCIsImJvb2tpbmdfd29ya2luZ190aW1lX3Jlc291cmNlX2RheXMiLCJib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZV9zdGFydCIsImJvb2tpbmdfd29ya2luZ190aW1lX3Jlc291cmNlX2VuZCIsInVwZGF0ZV93cGJjX3ByZXZpZXdfcGFyYW1zIiwic2V0X290aGVyX3BhcmFtIiwiY29uY2F0IiwidXBkYXRlX2J1ZmZlcl9wcmV2aWV3X25vdGUiLCIkbm90ZXMiLCIkY2FsZW5kYXIiLCIkbm90ZSIsInR5cGUiLCJiZWZvcmVfdGV4dCIsImFmdGVyX3RleHQiLCJtZXNzYWdlIiwiYnVmZmVyX3ByZXZpZXciLCJiZWZvcmVfYm9va2luZyIsImFmdGVyX2Jvb2tpbmciLCJodG1sIiwibm9fYnVmZmVyIiwiYXBwbHlfYnVmZmVyX2RheXNfcHJldmlldyIsImJlZm9yZV9kYXlzIiwiYWZ0ZXJfZGF5cyIsImRhdGVfY2VsbHMiLCJib29rZWRfZGF0ZXMiLCIkY2VsbCIsImJvb2tlZF9kYXRlIiwib2Zmc2V0IiwidGFyZ2V0X3NxbF9kYXRlIiwiJHRhcmdldF9jZWxsIiwicmVtZW1iZXJfcHJldmlld19vcmlnaW4iLCJjbGVhcl9wcmV2aWV3X2NlbGwiLCJoYWRfZGF0ZV91c2VyX3VuYXZhaWxhYmxlIiwiYXBwbHlfY2FsZW5kYXJfcHJldmlldyIsImF2YWlsYWJsZV9saW1pdCIsIm1ha2VfdW5hdmFpbGFibGUiLCJyZWFzb25fY2xhc3MiLCJwcmV2aW91c19yZWFzb24iLCJoYWRfZ2VuZXJhbF9wcmV2aWV3IiwiZ2V0RGF5IiwicXVldWVfcHJldmlld19yZWZyZXNoIiwicmVxdWVzdEFuaW1hdGlvbkZyYW1lIiwiY2xlYXJUaW1lb3V0IiwidXBkYXRlX2hpbnRzIiwiaGludHMiLCJib29raW5nX3VuYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXlfX2hpbnQiLCJib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5X19oaW50IiwiZHVyYXRpb24iLCJ3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSIsImFsZXJ0Iiwic2V0X2J1c3kiLCJidXN5IiwiYnVzeV90ZXh0Iiwic2F2aW5nIiwicmVwbGFjZV9jYWxlbmRhcl9wYW5lbCIsIiRob2xkZXIiLCJwYXJzZUhUTUwiLCJkb2N1bWVudCIsIiRuZXdfcGFuZWwiLCIkb2xkX3BhbmVsIiwiJHNjcmlwdHMiLCJyZXBsYWNlV2l0aCIsImNvZGUiLCJ0ZXh0Q29udGVudCIsImlubmVySFRNTCIsInNyYyIsImFqYXgiLCJ1cmwiLCJkYXRhVHlwZSIsImNhY2hlIiwiZ2xvYmFsRXZhbCIsInNldF9jYWxlbmRhcl9sb2FkaW5nIiwiaXNfbG9hZGluZyIsImxvYWRpbmdfdGV4dCIsImxvYWRpbmciLCIkbG9hZGluZyIsImxhc3QiLCJnZXRfcHJldmlld19wYXlsb2FkIiwiYWN0aW9uIiwicHJldmlld19hY3Rpb24iLCJub25jZSIsInJlc291cmNlX2lkIiwibW9udGhzX2NvdW50IiwibG9hZF9jYWxlbmRhcl9wcmV2aWV3IiwiY3VycmVudF9wcmV2aWV3X2FqYXgiLCJhamF4X3VybCIsInByZXZpZXdfZmFpbGVkIiwicmVhZHlTdGF0ZSIsImFib3J0IiwibWV0aG9kIiwiZG9uZSIsInJlc3BvbnNlIiwic3VjY2VzcyIsIm9ic2VydmVfY2FsZW5kYXJfY2hhbmdlcyIsImZhaWwiLCJqcV94aHIiLCJ0ZXh0X3N0YXR1cyIsImFsd2F5cyIsInNhdmVfc2V0dGluZ3MiLCJib29raW5nX3VuYXZhaWxhYmxlX2RheXMiLCJzYXZlX2ZhaWxlZCIsImRpc3BhdGNoRXZlbnQiLCJDdXN0b21FdmVudCIsImRldGFpbCIsInNhdmVkIiwicmVzcG9uc2VfbWVzc2FnZSIsInJlc3BvbnNlSlNPTiIsInJlc2V0X3NldHRpbmdzIiwiY29uZmlybV9tZXNzYWdlIiwicmVzZXRfY29uZmlybSIsImNvbmZpcm0iLCJyZXNldF9hcHBsaWVkIiwidGFyZ2V0IiwicXVlcnlTZWxlY3RvciIsIk11dGF0aW9uT2JzZXJ2ZXIiLCJkaXNjb25uZWN0Iiwib2JzZXJ2ZSIsImNoaWxkTGlzdCIsInN1YnRyZWUiLCJvbiIsImV2ZW50IiwicHJldmVudERlZmF1bHQiLCJyZWFkeSIsImpRdWVyeSIsIndpbmRvdyJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtYXZhaWxhYmlsaXR5LWdlbmVyYWwvX3NyYy9hdmFpbGFiaWxpdHlfZ2VuZXJhbF9wYWdlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBHZW5lcmFsIEF2YWlsYWJpbGl0eSBVSS5cclxuICovXHJcbiggZnVuY3Rpb24gKCAkLCB3ICkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0dmFyIGNmZyA9IHcud3BiY19hdmFpbGFiaWxpdHlfZ2VuZXJhbF9wYWdlIHx8IHt9O1xyXG5cdHZhciBwcmV2aWV3X3RpbWVyID0gMDtcclxuXHR2YXIgcHJldmlld19mcmFtZSA9IDA7XHJcblx0dmFyIHByZXZpZXdfYWpheCA9IG51bGw7XHJcblx0dmFyIG9ic2VydmVyID0gbnVsbDtcclxuXHR2YXIgcHJldmlld191bmF2YWlsYWJsZV9jbGFzc2VzID0gJ3dwYmNfYWdfcHJldmlld191bmF2YWlsYWJsZSB3cGJjX2FnX3ByZXZpZXdfd2Vla2RheV91bmF2YWlsYWJsZSB3cGJjX2FnX3ByZXZpZXdfZnJvbV90b2RheV91bmF2YWlsYWJsZSB3cGJjX2FnX3ByZXZpZXdfbGltaXRfYXZhaWxhYmxlX2Zyb21fdG9kYXkgd3BiY19hZ19wcmV2aWV3X2J1ZmZlcl91bmF2YWlsYWJsZSB3ZWVrZGF5X3VuYXZhaWxhYmxlIGZyb21fdG9kYXlfdW5hdmFpbGFibGUgbGltaXRfYXZhaWxhYmxlX2Zyb21fdG9kYXkgYnVmZmVyX3VuYXZhaWxhYmxlJztcclxuXHJcblx0ZnVuY3Rpb24gdHJpbV90ZXh0KCB2YWx1ZSApIHtcclxuXHRcdHJldHVybiBTdHJpbmcoIHZhbHVlIHx8ICcnICkudHJpbSgpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc3dpdGNoX3BhbmVsKCAkdGFiICkge1xyXG5cdFx0dmFyIHBhbmVsX2lkID0gJHRhYi5hdHRyKCAnYXJpYS1jb250cm9scycgKTtcclxuXHRcdHZhciAkdGFicyA9ICR0YWIuY2xvc2VzdCggJy53cGJjX2FnX3JpZ2h0YmFyX3RhYnMnICkuZmluZCggJ1tyb2xlPVwidGFiXCJdJyApO1xyXG5cdFx0dmFyICRwYW5lbHMgPSAkKCAnLndwYmNfYWdfcmlnaHRiYXJfcGFuZWxzIFtyb2xlPVwidGFicGFuZWxcIl0nICk7XHJcblxyXG5cdFx0JHRhYnMuYXR0ciggJ2FyaWEtc2VsZWN0ZWQnLCAnZmFsc2UnICk7XHJcblx0XHQkdGFiLmF0dHIoICdhcmlhLXNlbGVjdGVkJywgJ3RydWUnICk7XHJcblxyXG5cdFx0JHBhbmVscy5hdHRyKCAnaGlkZGVuJywgJ2hpZGRlbicgKS5hdHRyKCAnYXJpYS1oaWRkZW4nLCAndHJ1ZScgKTtcclxuXHRcdCQoICcjJyArIHBhbmVsX2lkICkucmVtb3ZlQXR0ciggJ2hpZGRlbicgKS5hdHRyKCAnYXJpYS1oaWRkZW4nLCAnZmFsc2UnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB0b2dnbGVfZ3JvdXAoICRidXR0b24gKSB7XHJcblx0XHR2YXIgJGdyb3VwID0gJGJ1dHRvbi5jbG9zZXN0KCAnLndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwJyApO1xyXG5cdFx0dmFyICRmaWVsZHMgPSAkZ3JvdXAuZmluZCggJz4gLmdyb3VwX19maWVsZHMnICk7XHJcblx0XHR2YXIgaXNfb3BlbiA9ICRncm91cC5oYXNDbGFzcyggJ2lzLW9wZW4nICk7XHJcblxyXG5cdFx0JGdyb3VwLnRvZ2dsZUNsYXNzKCAnaXMtb3BlbicsICEgaXNfb3BlbiApO1xyXG5cdFx0JGJ1dHRvbi5hdHRyKCAnYXJpYS1leHBhbmRlZCcsIGlzX29wZW4gPyAnZmFsc2UnIDogJ3RydWUnICk7XHJcblx0XHQkZmllbGRzLnByb3AoICdoaWRkZW4nLCBpc19vcGVuICkuYXR0ciggJ2FyaWEtaGlkZGVuJywgaXNfb3BlbiA/ICd0cnVlJyA6ICdmYWxzZScgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGNsb3NlX2dyb3VwKCAkZ3JvdXAgKSB7XHJcblx0XHR2YXIgJGJ1dHRvbiA9ICRncm91cC5maW5kKCAnPiAuZ3JvdXBfX2hlYWRlcicgKTtcclxuXHRcdHZhciAkZmllbGRzID0gJGdyb3VwLmZpbmQoICc+IC5ncm91cF9fZmllbGRzJyApO1xyXG5cclxuXHRcdCRncm91cC5yZW1vdmVDbGFzcyggJ2lzLW9wZW4nICk7XHJcblx0XHQkYnV0dG9uLmF0dHIoICdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyApO1xyXG5cdFx0JGZpZWxkcy5wcm9wKCAnaGlkZGVuJywgdHJ1ZSApLmF0dHIoICdhcmlhLWhpZGRlbicsICd0cnVlJyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gb3Blbl9ncm91cCggZ3JvdXBfbmFtZSwgaXNfZXhjbHVzaXZlICkge1xyXG5cdFx0dmFyICRncm91cCA9ICQoICcud3BiY191aV9fY29sbGFwc2libGVfZ3JvdXBbZGF0YS1ncm91cD1cIicgKyBncm91cF9uYW1lICsgJ1wiXScgKTtcclxuXHRcdHZhciAkYnV0dG9uID0gJGdyb3VwLmZpbmQoICc+IC5ncm91cF9faGVhZGVyJyApO1xyXG5cdFx0dmFyICRmaWVsZHMgPSAkZ3JvdXAuZmluZCggJz4gLmdyb3VwX19maWVsZHMnICk7XHJcblxyXG5cdFx0aWYgKCAhICRncm91cC5sZW5ndGggKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGlzX2V4Y2x1c2l2ZSApIHtcclxuXHRcdFx0JGdyb3VwLnNpYmxpbmdzKCAnLndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRjbG9zZV9ncm91cCggJCggdGhpcyApICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQkZ3JvdXAuYWRkQ2xhc3MoICdpcy1vcGVuJyApO1xyXG5cdFx0JGJ1dHRvbi5hdHRyKCAnYXJpYS1leHBhbmRlZCcsICd0cnVlJyApO1xyXG5cdFx0JGZpZWxkcy5wcm9wKCAnaGlkZGVuJywgZmFsc2UgKS5hdHRyKCAnYXJpYS1oaWRkZW4nLCAnZmFsc2UnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzY3JvbGxfdG9fZ3JvdXAoIGdyb3VwX25hbWUgKSB7XHJcblx0XHR2YXIgJGdyb3VwID0gJCggJy53cGJjX3VpX19jb2xsYXBzaWJsZV9ncm91cFtkYXRhLWdyb3VwPVwiJyArIGdyb3VwX25hbWUgKyAnXCJdJyApO1xyXG5cdFx0dmFyICRzY3JvbGxfcGFyZW50ID0gJCgpO1xyXG5cdFx0dmFyIHNjcm9sbF9wYXJlbnRfZWw7XHJcblx0XHR2YXIgZ3JvdXBfZWw7XHJcblx0XHR2YXIgc2Nyb2xsX3RvcDtcclxuXHRcdHZhciBwYXJlbnRfcmVjdDtcclxuXHRcdHZhciBncm91cF9yZWN0O1xyXG5cclxuXHRcdGlmICggISAkZ3JvdXAubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JGdyb3VwLnBhcmVudHMoKS5lYWNoKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHZhciAkY2FuZGlkYXRlID0gJCggdGhpcyApO1xyXG5cdFx0XHR2YXIgb3ZlcmZsb3dfeSA9ICRjYW5kaWRhdGUuY3NzKCAnb3ZlcmZsb3cteScgKTtcclxuXHJcblx0XHRcdGlmIChcclxuXHRcdFx0XHQkY2FuZGlkYXRlLmhhc0NsYXNzKCAnc2ltcGxlYmFyLWNvbnRlbnQtd3JhcHBlcicgKVxyXG5cdFx0XHRcdHx8IChcclxuXHRcdFx0XHRcdC8oYXV0b3xzY3JvbGwpLy50ZXN0KCBvdmVyZmxvd195IClcclxuXHRcdFx0XHRcdCYmIHRoaXMuc2Nyb2xsSGVpZ2h0ID4gdGhpcy5jbGllbnRIZWlnaHRcclxuXHRcdFx0XHQpXHJcblx0XHRcdCkge1xyXG5cdFx0XHRcdCRzY3JvbGxfcGFyZW50ID0gJGNhbmRpZGF0ZTtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHJcblx0XHRpZiAoICEgJHNjcm9sbF9wYXJlbnQubGVuZ3RoICkge1xyXG5cdFx0XHQkc2Nyb2xsX3BhcmVudCA9ICRncm91cC5jbG9zZXN0KCAnLndwYmNfdWlfZWxfX3ZlcnRfcmlnaHRfYmFyX19jb250ZW50JyApLmZpbmQoICcuc2ltcGxlYmFyLWNvbnRlbnQtd3JhcHBlcicgKS5maXJzdCgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISAkc2Nyb2xsX3BhcmVudC5sZW5ndGggKSB7XHJcblx0XHRcdCRncm91cC5nZXQoIDAgKS5zY3JvbGxJbnRvVmlldyggeyBibG9jazogJ25lYXJlc3QnIH0gKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHNjcm9sbF9wYXJlbnRfZWwgPSAkc2Nyb2xsX3BhcmVudC5nZXQoIDAgKTtcclxuXHRcdGdyb3VwX2VsICAgICAgICAgPSAkZ3JvdXAuZ2V0KCAwICk7XHJcblx0XHRwYXJlbnRfcmVjdCAgICAgID0gc2Nyb2xsX3BhcmVudF9lbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuXHRcdGdyb3VwX3JlY3QgICAgICAgPSBncm91cF9lbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuXHRcdHNjcm9sbF90b3AgICAgICAgPSAkc2Nyb2xsX3BhcmVudC5zY3JvbGxUb3AoKSArIGdyb3VwX3JlY3QudG9wIC0gcGFyZW50X3JlY3QudG9wIC0gMTA7XHJcblxyXG5cdFx0JHNjcm9sbF9wYXJlbnQuc3RvcCgpLmFuaW1hdGUoIHsgc2Nyb2xsVG9wOiBNYXRoLm1heCggMCwgc2Nyb2xsX3RvcCApIH0sIDE4MCApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYXBwbHlfb3Blbl9zZWN0aW9uX2Zyb21fdXJsKCkge1xyXG5cdFx0dmFyIHNlY3Rpb25fZ3JvdXBzID0ge1xyXG5cdFx0XHR3ZWVrZGF5czogJ2dlbmVyYWwtYXZhaWxhYmlsaXR5LXdlZWtkYXlzJyxcclxuXHRcdFx0ZnJvbV90b2RheTogJ2dlbmVyYWwtYXZhaWxhYmlsaXR5LWZyb20tdG9kYXknLFxyXG5cdFx0XHRidWZmZXI6ICdnZW5lcmFsLWF2YWlsYWJpbGl0eS1idWZmZXInLFxyXG5cdFx0XHR3b3JraW5nX3RpbWU6ICdnZW5lcmFsLWF2YWlsYWJpbGl0eS13b3JraW5nLXRpbWUnXHJcblx0XHR9O1xyXG5cdFx0dmFyIGdyb3VwX25hbWUgPSBzZWN0aW9uX2dyb3Vwc1sgY2ZnLm9wZW5fc2VjdGlvbiBdIHx8ICcnO1xyXG5cclxuXHRcdGlmICggJycgPT09IGdyb3VwX25hbWUgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRvcGVuX2dyb3VwKCBncm91cF9uYW1lLCB0cnVlICk7XHJcblx0XHQkLmVhY2goIFsgMTIwLCA2NTAgXSwgZnVuY3Rpb24gKCBpbmRleCwgZGVsYXkgKSB7XHJcblx0XHRcdHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRzY3JvbGxfdG9fZ3JvdXAoIGdyb3VwX25hbWUgKTtcclxuXHRcdFx0fSwgZGVsYXkgKTtcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJlZnJlc2hfYnVmZmVyX2ZpZWxkcygpIHtcclxuXHRcdHZhciB2YWx1ZSA9ICQoICdpbnB1dFtuYW1lPVwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9pbl9vdXRcIl06Y2hlY2tlZCcgKS52YWwoKSB8fCAnJztcclxuXHJcblx0XHQkKCAnLndwYmNfYWdfYnVmZmVyX2ZpZWxkcycgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHZhciAkcGFuZWwgPSAkKCB0aGlzICk7XHJcblx0XHRcdCRwYW5lbC50b2dnbGVDbGFzcyggJ2lzLXZpc2libGUnLCAkcGFuZWwuZGF0YSggJ2J1ZmZlci1wYW5lbCcgKSA9PT0gdmFsdWUgKTtcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGlzX2J1ZmZlcl9hdmFpbGFibGUoKSB7XHJcblx0XHRyZXR1cm4gISAoIGNmZy5pc19idWZmZXJfYXZhaWxhYmxlID09PSBmYWxzZSB8fCBjZmcuaXNfYnVmZmVyX2F2YWlsYWJsZSA9PT0gJ2ZhbHNlJyB8fCBjZmcuaXNfYnVmZmVyX2F2YWlsYWJsZSA9PT0gMCB8fCBjZmcuaXNfYnVmZmVyX2F2YWlsYWJsZSA9PT0gJzAnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpc19hdmFpbGFibGVfbGltaXRfYXZhaWxhYmxlKCkge1xyXG5cdFx0cmV0dXJuICEgKCBjZmcuaXNfYXZhaWxhYmxlX2xpbWl0X2F2YWlsYWJsZSA9PT0gZmFsc2UgfHwgY2ZnLmlzX2F2YWlsYWJsZV9saW1pdF9hdmFpbGFibGUgPT09ICdmYWxzZScgfHwgY2ZnLmlzX2F2YWlsYWJsZV9saW1pdF9hdmFpbGFibGUgPT09IDAgfHwgY2ZnLmlzX2F2YWlsYWJsZV9saW1pdF9hdmFpbGFibGUgPT09ICcwJyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc3luY19yYW5nZV9mcm9tX3NlbGVjdCggc2VsZWN0ICkge1xyXG5cdFx0dmFyICRzZWxlY3QgPSAkKCBzZWxlY3QgKTtcclxuXHRcdHZhciBuYW1lID0gJHNlbGVjdC5hdHRyKCAnbmFtZScgKTtcclxuXHRcdHZhciBzZWxlY3RlZF9pbmRleCA9ICRzZWxlY3QucHJvcCggJ3NlbGVjdGVkSW5kZXgnICk7XHJcblx0XHR2YXIgc2VsZWN0ZWRfdGV4dCA9IHRyaW1fdGV4dCggJHNlbGVjdC5maW5kKCAnb3B0aW9uOnNlbGVjdGVkJyApLnRleHQoKSApO1xyXG5cdFx0dmFyICRyYW5nZSA9ICQoICdbZGF0YS13cGJjLWFnLXJhbmdlLWZvcj1cIicgKyBuYW1lICsgJ1wiXScgKTtcclxuXHRcdHZhciAkdmFsdWUgPSAkKCAnW2RhdGEtd3BiYy1hZy1yYW5nZS12YWx1ZS1mb3I9XCInICsgbmFtZSArICdcIl0nICk7XHJcblxyXG5cdFx0aWYgKCAhICRyYW5nZS5sZW5ndGggKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQkcmFuZ2UudmFsKCBzZWxlY3RlZF9pbmRleCA8IDAgPyAwIDogc2VsZWN0ZWRfaW5kZXggKTtcclxuXHRcdCR2YWx1ZS50ZXh0KCBzZWxlY3RlZF90ZXh0ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzeW5jX3NlbGVjdF9mcm9tX3JhbmdlKCByYW5nZSApIHtcclxuXHRcdHZhciAkcmFuZ2UgPSAkKCByYW5nZSApO1xyXG5cdFx0dmFyIG5hbWUgPSAkcmFuZ2UuYXR0ciggJ2RhdGEtd3BiYy1hZy1yYW5nZS1mb3InICk7XHJcblx0XHR2YXIgJHNlbGVjdCA9ICQoICdbbmFtZT1cIicgKyBuYW1lICsgJ1wiXScgKTtcclxuXHRcdHZhciBpbmRleCA9IHBhcnNlSW50KCAkcmFuZ2UudmFsKCksIDEwICkgfHwgMDtcclxuXHJcblx0XHRpZiAoICEgJHNlbGVjdC5sZW5ndGggKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQkc2VsZWN0LnByb3AoICdzZWxlY3RlZEluZGV4JywgaW5kZXggKTtcclxuXHRcdHN5bmNfcmFuZ2VfZnJvbV9zZWxlY3QoICRzZWxlY3QgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHN5bmNfYWxsX3JhbmdlcygpIHtcclxuXHRcdCQoICdbZGF0YS13cGJjLWFnLXJhbmdlLWZvcl0nICkuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR2YXIgbmFtZSA9ICQoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLWFnLXJhbmdlLWZvcicgKTtcclxuXHRcdFx0c3luY19yYW5nZV9mcm9tX3NlbGVjdCggJCggJ1tuYW1lPVwiJyArIG5hbWUgKyAnXCJdJyApLmZpcnN0KCkgKTtcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHN0ZXBfc2VsZWN0X3ZhbHVlKCBidXR0b24gKSB7XHJcblx0XHR2YXIgJGJ1dHRvbiA9ICQoIGJ1dHRvbiApO1xyXG5cdFx0dmFyIG5hbWUgPSAkYnV0dG9uLmF0dHIoICdkYXRhLXdwYmMtYWctc3RlcHBlcicgKTtcclxuXHRcdHZhciBzdGVwID0gcGFyc2VJbnQoICRidXR0b24uYXR0ciggJ2RhdGEtc3RlcCcgKSwgMTAgKSB8fCAwO1xyXG5cdFx0dmFyICRzZWxlY3QgPSAkKCAnW25hbWU9XCInICsgbmFtZSArICdcIl0nICkuZmlyc3QoKTtcclxuXHRcdHZhciBjdXJyZW50X2luZGV4O1xyXG5cdFx0dmFyIG5leHRfaW5kZXg7XHJcblxyXG5cdFx0aWYgKCAhICRzZWxlY3QubGVuZ3RoIHx8ICRzZWxlY3QucHJvcCggJ2Rpc2FibGVkJyApICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Y3VycmVudF9pbmRleCA9ICRzZWxlY3QucHJvcCggJ3NlbGVjdGVkSW5kZXgnICk7XHJcblx0XHRuZXh0X2luZGV4ID0gTWF0aC5tYXgoIDAsIE1hdGgubWluKCAkc2VsZWN0LmZpbmQoICdvcHRpb24nICkubGVuZ3RoIC0gMSwgY3VycmVudF9pbmRleCArIHN0ZXAgKSApO1xyXG5cclxuXHRcdGlmICggbmV4dF9pbmRleCA9PT0gY3VycmVudF9pbmRleCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRzZWxlY3QucHJvcCggJ3NlbGVjdGVkSW5kZXgnLCBuZXh0X2luZGV4ICkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9mb3JtKCkge1xyXG5cdFx0cmV0dXJuICQoICdbZGF0YS13cGJjLWFnLXNldHRpbmdzLWZvcm09XCIxXCJdJyApLmZpcnN0KCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBjb2xsZWN0X3NldHRpbmdzKCkge1xyXG5cdFx0dmFyICRmb3JtID0gZ2V0X2Zvcm0oKTtcclxuXHRcdHZhciB3ZWVrZGF5cyA9IFtdO1xyXG5cclxuXHRcdCRmb3JtLmZpbmQoICdpbnB1dFtuYW1lPVwiYm9va2luZ191bmF2YWlsYWJsZV9kYXlzW11cIl06Y2hlY2tlZCcgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHdlZWtkYXlzLnB1c2goIHBhcnNlSW50KCB0aGlzLnZhbHVlLCAxMCApICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0d2Vla2RheXM6IHdlZWtkYXlzLFxyXG5cdFx0XHRib29raW5nX3VuYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXk6ICRmb3JtLmZpbmQoICdbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheVwiXScgKS52YWwoKSB8fCAnMCcsXHJcblx0XHRcdGJvb2tpbmdfYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXk6ICRmb3JtLmZpbmQoICdbbmFtZT1cImJvb2tpbmdfYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXlcIl0nICkudmFsKCkgfHwgJycsXHJcblx0XHRcdGJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfaW5fb3V0OiAkZm9ybS5maW5kKCAnW25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2luX291dFwiXTpjaGVja2VkJyApLnZhbCgpIHx8ICcnLFxyXG5cdFx0XHRib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX21pbnV0ZXNfaW46ICRmb3JtLmZpbmQoICdbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfbWludXRlc19pblwiXScgKS52YWwoKSB8fCAnJyxcclxuXHRcdFx0Ym9va2luZ191bmF2YWlsYWJsZV9leHRyYV9taW51dGVzX291dDogJGZvcm0uZmluZCggJ1tuYW1lPVwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9taW51dGVzX291dFwiXScgKS52YWwoKSB8fCAnJyxcclxuXHRcdFx0Ym9va2luZ191bmF2YWlsYWJsZV9leHRyYV9kYXlzX2luOiAkZm9ybS5maW5kKCAnW25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfaW5cIl0nICkudmFsKCkgfHwgJycsXHJcblx0XHRcdGJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfZGF5c19vdXQ6ICRmb3JtLmZpbmQoICdbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfZGF5c19vdXRcIl0nICkudmFsKCkgfHwgJycsXHJcblx0XHRcdHdvcmtpbmdfdGltZTogZ2V0X3dvcmtpbmdfdGltZV9zZXR0aW5nc19mcm9tX2Zvcm0oKVxyXG5cdFx0fTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNldF9zZWxlY3RfdmFsdWUoIG5hbWUsIHZhbHVlICkge1xyXG5cdFx0dmFyICRmaWVsZCA9IGdldF9mb3JtKCkuZmluZCggJ1tuYW1lPVwiJyArIG5hbWUgKyAnXCJdJyApLmZpcnN0KCk7XHJcblxyXG5cdFx0aWYgKCAhICRmaWVsZC5sZW5ndGggKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQkZmllbGQudmFsKCB2YWx1ZSApO1xyXG5cdFx0aWYgKCBTdHJpbmcoICRmaWVsZC52YWwoKSApICE9PSBTdHJpbmcoIHZhbHVlICkgKSB7XHJcblx0XHRcdCRmaWVsZC5wcm9wKCAnc2VsZWN0ZWRJbmRleCcsIDAgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGFwcGx5X3NldHRpbmdzX3RvX2Zvcm0oIHNldHRpbmdzICkge1xyXG5cdFx0dmFyICRmb3JtID0gZ2V0X2Zvcm0oKTtcclxuXHRcdHZhciB3ZWVrZGF5cyA9IHNldHRpbmdzICYmIHNldHRpbmdzLndlZWtkYXlzID8gc2V0dGluZ3Mud2Vla2RheXMgOiBbXTtcclxuXHJcblx0XHRpZiAoICEgJGZvcm0ubGVuZ3RoIHx8ICEgc2V0dGluZ3MgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQkZm9ybS5maW5kKCAnaW5wdXRbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c1tdXCJdJyApLnByb3AoICdjaGVja2VkJywgZmFsc2UgKTtcclxuXHRcdCQuZWFjaCggd2Vla2RheXMsIGZ1bmN0aW9uICggaW5kZXgsIGRheV9udW0gKSB7XHJcblx0XHRcdCRmb3JtLmZpbmQoICdpbnB1dFtuYW1lPVwiYm9va2luZ191bmF2YWlsYWJsZV9kYXlzW11cIl1bdmFsdWU9XCInICsgcGFyc2VJbnQoIGRheV9udW0sIDEwICkgKyAnXCJdJyApLnByb3AoICdjaGVja2VkJywgdHJ1ZSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdHNldF9zZWxlY3RfdmFsdWUoICdib29raW5nX3VuYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXknLCBzZXR0aW5ncy5ib29raW5nX3VuYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXkgfHwgJzAnICk7XHJcblx0XHRzZXRfc2VsZWN0X3ZhbHVlKCAnYm9va2luZ19hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheScsIHNldHRpbmdzLmJvb2tpbmdfYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXkgfHwgJycgKTtcclxuXHRcdHNldF9zZWxlY3RfdmFsdWUoICdib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX21pbnV0ZXNfaW4nLCBzZXR0aW5ncy5ib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX21pbnV0ZXNfaW4gfHwgJycgKTtcclxuXHRcdHNldF9zZWxlY3RfdmFsdWUoICdib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX21pbnV0ZXNfb3V0Jywgc2V0dGluZ3MuYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9taW51dGVzX291dCB8fCAnJyApO1xyXG5cdFx0c2V0X3NlbGVjdF92YWx1ZSggJ2Jvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfZGF5c19pbicsIHNldHRpbmdzLmJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfZGF5c19pbiB8fCAnJyApO1xyXG5cdFx0c2V0X3NlbGVjdF92YWx1ZSggJ2Jvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfZGF5c19vdXQnLCBzZXR0aW5ncy5ib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfb3V0IHx8ICcnICk7XHJcblxyXG5cdFx0JGZvcm0uZmluZCggJ2lucHV0W25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2luX291dFwiXScgKS5wcm9wKCAnY2hlY2tlZCcsIGZhbHNlICk7XHJcblx0XHQkZm9ybS5maW5kKCAnaW5wdXRbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfaW5fb3V0XCJdW3ZhbHVlPVwiJyArICggc2V0dGluZ3MuYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9pbl9vdXQgfHwgJycgKSArICdcIl0nICkucHJvcCggJ2NoZWNrZWQnLCB0cnVlICk7XHJcblx0XHRhcHBseV93b3JraW5nX3RpbWVfc2V0dGluZ3NfdG9fZm9ybSggc2V0dGluZ3Mud29ya2luZ190aW1lIHx8IHt9LCAkKCAnI3dwYmNfYWdfcmVzb3VyY2VfaWQnICkudmFsKCkgKTtcclxuXHJcblx0XHRyZWZyZXNoX2J1ZmZlcl9maWVsZHMoKTtcclxuXHRcdHN5bmNfYWxsX3JhbmdlcygpO1xyXG5cdFx0c2NoZWR1bGVfcHJldmlld19yZWZyZXNoKCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBkYXRlX2Zyb21fc3FsKCBzcWxfZGF0ZSApIHtcclxuXHRcdHZhciBwYXJ0cyA9IFN0cmluZyggc3FsX2RhdGUgfHwgJycgKS5zcGxpdCggJy0nICk7XHJcblx0XHRpZiAoIHBhcnRzLmxlbmd0aCAhPT0gMyApIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gbmV3IERhdGUoIHBhcnNlSW50KCBwYXJ0c1swXSwgMTAgKSwgcGFyc2VJbnQoIHBhcnRzWzFdLCAxMCApIC0gMSwgcGFyc2VJbnQoIHBhcnRzWzJdLCAxMCApLCAwLCAwLCAwICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfdG9kYXlfZGF0ZSgpIHtcclxuXHRcdHZhciBhcnIgPSB3Ll93cGJjICYmIHR5cGVvZiB3Ll93cGJjLmdldF9vdGhlcl9wYXJhbSA9PT0gJ2Z1bmN0aW9uJyA/IHcuX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyApIDogbnVsbDtcclxuXHRcdGlmICggYXJyICYmIGFyci5sZW5ndGggPj0gMyApIHtcclxuXHRcdFx0cmV0dXJuIG5ldyBEYXRlKCBwYXJzZUludCggYXJyWzBdLCAxMCApLCBwYXJzZUludCggYXJyWzFdLCAxMCApIC0gMSwgcGFyc2VJbnQoIGFyclsyXSwgMTAgKSwgMCwgMCwgMCApO1xyXG5cdFx0fVxyXG5cdFx0dmFyIG5vdyA9IG5ldyBEYXRlKCk7XHJcblx0XHRyZXR1cm4gbmV3IERhdGUoIG5vdy5nZXRGdWxsWWVhcigpLCBub3cuZ2V0TW9udGgoKSwgbm93LmdldERhdGUoKSwgMCwgMCwgMCApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X3JlYWxfdG9kYXlfZGF0ZSgpIHtcclxuXHRcdHZhciBhcnIgPSB3Ll93cGJjICYmIHR5cGVvZiB3Ll93cGJjLmdldF9vdGhlcl9wYXJhbSA9PT0gJ2Z1bmN0aW9uJyA/IHcuX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGltZV9sb2NhbF9hcnInICkgOiBudWxsO1xyXG5cdFx0aWYgKCBhcnIgJiYgYXJyLmxlbmd0aCA+PSAzICkge1xyXG5cdFx0XHRyZXR1cm4gbmV3IERhdGUoIHBhcnNlSW50KCBhcnJbMF0sIDEwICksIHBhcnNlSW50KCBhcnJbMV0sIDEwICkgLSAxLCBwYXJzZUludCggYXJyWzJdLCAxMCApLCAwLCAwLCAwICk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gZ2V0X3RvZGF5X2RhdGUoKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGRheXNfYmV0d2VlbiggZGF0ZV9hLCBkYXRlX2IgKSB7XHJcblx0XHRyZXR1cm4gTWF0aC5mbG9vciggKCBkYXRlX2EuZ2V0VGltZSgpIC0gZGF0ZV9iLmdldFRpbWUoKSApIC8gODY0MDAwMDAgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGFkZF9kYXlzKCBkYXRlLCBkYXlzICkge1xyXG5cdFx0dmFyIHNoaWZ0ZWRfZGF0ZSA9IG5ldyBEYXRlKCBkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSwgZGF0ZS5nZXREYXRlKCksIDAsIDAsIDAgKTtcclxuXHRcdHNoaWZ0ZWRfZGF0ZS5zZXREYXRlKCBzaGlmdGVkX2RhdGUuZ2V0RGF0ZSgpICsgZGF5cyApO1xyXG5cdFx0cmV0dXJuIHNoaWZ0ZWRfZGF0ZTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGRhdGVfdG9fc3FsKCBkYXRlICkge1xyXG5cdFx0dmFyIG1vbnRoID0gU3RyaW5nKCBkYXRlLmdldE1vbnRoKCkgKyAxICk7XHJcblx0XHR2YXIgZGF5ID0gU3RyaW5nKCBkYXRlLmdldERhdGUoKSApO1xyXG5cclxuXHRcdGlmICggbW9udGgubGVuZ3RoIDwgMiApIHtcclxuXHRcdFx0bW9udGggPSAnMCcgKyBtb250aDtcclxuXHRcdH1cclxuXHRcdGlmICggZGF5Lmxlbmd0aCA8IDIgKSB7XHJcblx0XHRcdGRheSA9ICcwJyArIGRheTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZGF0ZS5nZXRGdWxsWWVhcigpICsgJy0nICsgbW9udGggKyAnLScgKyBkYXk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfc3FsX2RhdGVfZnJvbV9jZWxsKCBjZWxsICkge1xyXG5cdFx0dmFyIGNsYXNzZXMgPSBTdHJpbmcoIGNlbGwuY2xhc3NOYW1lIHx8ICcnICkuc3BsaXQoIC9cXHMrLyApO1xyXG5cdFx0dmFyIGk7XHJcblx0XHRmb3IgKCBpID0gMDsgaSA8IGNsYXNzZXMubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdGlmICggY2xhc3Nlc1tpXS5pbmRleE9mKCAnc3FsX2RhdGVfJyApID09PSAwICkge1xyXG5cdFx0XHRcdHJldHVybiBjbGFzc2VzW2ldLnJlcGxhY2UoICdzcWxfZGF0ZV8nLCAnJyApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gJyc7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB1bmF2YWlsYWJsZV9mcm9tX3RvZGF5X2FwcGxpZXMoIGNlbGxfZGF0ZSwgdG9kYXlfZGF0ZSwgdmFsdWUgKSB7XHJcblx0XHR2YXIgbWludXRlcztcclxuXHRcdHZhciBub3c7XHJcblx0XHR2YXIgdW5hdmFpbGFibGVfdW50aWw7XHJcblxyXG5cdFx0aWYgKCAhIHZhbHVlIHx8IHZhbHVlID09PSAnMCcgKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIC9tJC8udGVzdCggdmFsdWUgKSApIHtcclxuXHRcdFx0bWludXRlcyA9IHBhcnNlSW50KCB2YWx1ZSwgMTAgKTtcclxuXHRcdFx0aWYgKCAhIG1pbnV0ZXMgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblx0XHRcdG5vdyA9IG5ldyBEYXRlKCk7XHJcblx0XHRcdHVuYXZhaWxhYmxlX3VudGlsID0gbmV3IERhdGUoIG5vdy5nZXRUaW1lKCkgKyAoICggbWludXRlcyAtIDEgKSAqIDYwMDAwICkgKTtcclxuXHRcdFx0dW5hdmFpbGFibGVfdW50aWwgPSBuZXcgRGF0ZSggdW5hdmFpbGFibGVfdW50aWwuZ2V0RnVsbFllYXIoKSwgdW5hdmFpbGFibGVfdW50aWwuZ2V0TW9udGgoKSwgdW5hdmFpbGFibGVfdW50aWwuZ2V0RGF0ZSgpLCAwLCAwLCAwICk7XHJcblx0XHRcdHJldHVybiBjZWxsX2RhdGUuZ2V0VGltZSgpIDw9IHVuYXZhaWxhYmxlX3VudGlsLmdldFRpbWUoKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZGF5c19iZXR3ZWVuKCBjZWxsX2RhdGUsIHRvZGF5X2RhdGUgKSA8IHBhcnNlSW50KCB2YWx1ZSwgMTAgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9vcHRpb25fdGV4dCggc2VsZWN0b3IgKSB7XHJcblx0XHR2YXIgdGV4dCA9ICQoIHNlbGVjdG9yICkuZmluZCggJ29wdGlvbjpzZWxlY3RlZCcgKS50ZXh0KCk7XHJcblx0XHRyZXR1cm4gdHJpbV90ZXh0KCB0ZXh0ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfZGF5c192YWx1ZSggdmFsdWUgKSB7XHJcblx0XHRpZiAoICEgdmFsdWUgfHwgISAvZCQvLnRlc3QoIHZhbHVlICkgKSB7XHJcblx0XHRcdHJldHVybiAwO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHBhcnNlSW50KCB2YWx1ZSwgMTAgKSB8fCAwO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdGltZV90b19zZWNvbmRzKCB0aW1lICkge1xyXG5cdFx0dmFyIHBhcnRzID0gU3RyaW5nKCB0aW1lIHx8ICcnICkuc3BsaXQoICc6JyApO1xyXG5cdFx0dmFyIGhvdXJzO1xyXG5cdFx0dmFyIG1pbnM7XHJcblxyXG5cdFx0aWYgKCBwYXJ0cy5sZW5ndGggPCAyICkge1xyXG5cdFx0XHRyZXR1cm4gMDtcclxuXHRcdH1cclxuXHJcblx0XHRob3VycyA9IE1hdGgubWF4KCAwLCBNYXRoLm1pbiggMjQsIHBhcnNlSW50KCBwYXJ0c1swXSwgMTAgKSB8fCAwICkgKTtcclxuXHRcdG1pbnMgPSBob3VycyA9PT0gMjQgPyAwIDogTWF0aC5tYXgoIDAsIE1hdGgubWluKCA1OSwgcGFyc2VJbnQoIHBhcnRzWzFdLCAxMCApIHx8IDAgKSApO1xyXG5cclxuXHRcdHJldHVybiBNYXRoLm1pbiggODY0MDAsICggaG91cnMgKiAzNjAwICkgKyAoIG1pbnMgKiA2MCApICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZWNvbmRzX3RvX3RpbWUoIHNlY29uZHMgKSB7XG5cdFx0dmFyIGhvdXJzO1xyXG5cdFx0dmFyIG1pbnM7XHJcblxyXG5cdFx0c2Vjb25kcyA9IE1hdGgubWF4KCAwLCBNYXRoLm1pbiggODY0MDAsIHBhcnNlSW50KCBzZWNvbmRzLCAxMCApIHx8IDAgKSApO1xyXG5cdFx0aG91cnMgPSBNYXRoLmZsb29yKCBzZWNvbmRzIC8gMzYwMCApO1xyXG5cdFx0bWlucyA9IE1hdGguZmxvb3IoICggc2Vjb25kcyAlIDM2MDAgKSAvIDYwICk7XHJcblxyXG5cdFx0cmV0dXJuICggaG91cnMgPCAxMCA/ICcwJyA6ICcnICkgKyBob3VycyArICc6JyArICggbWlucyA8IDEwID8gJzAnIDogJycgKSArIG1pbnM7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIHRoZSBib3VuZGVkIGludGVydmFsIGxpbWl0IGZvciBvbmUgV29ya2luZyBUaW1lIGVkaXRvci5cblx0ICpcblx0ICogQHBhcmFtIHtqUXVlcnl9ICR3ZWVrZGF5cyBXb3JraW5nIFRpbWUgd2Vla2RheSB3cmFwcGVyLlxuXHQgKiBAcmV0dXJuIHtudW1iZXJ9IE1heGltdW0gaW50ZXJ2YWxzIHBlciB3ZWVrZGF5LlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X21heF93b3JraW5nX3RpbWVfaW50ZXJ2YWxzKCAkd2Vla2RheXMgKSB7XG5cdFx0dmFyIGNvbmZpZ3VyZWRfbGltaXQgPSBwYXJzZUludCggJHdlZWtkYXlzLmF0dHIoICdkYXRhLW1heC1pbnRlcnZhbHMnICksIDEwICk7XG5cdFx0dmFyIGxvY2FsaXplZF9saW1pdCA9IHBhcnNlSW50KCBjZmcubWF4X3dvcmtpbmdfdGltZV9pbnRlcnZhbHMsIDEwICk7XG5cblx0XHRyZXR1cm4gTWF0aC5tYXgoIDEsIE1hdGgubWluKCA0OCwgY29uZmlndXJlZF9saW1pdCB8fCBsb2NhbGl6ZWRfbGltaXQgfHwgOCApICk7XG5cdH1cblxuXHQvKipcblx0ICogUmVhZCBhbGwgdmlzaWJsZSBpbnRlcnZhbCBjb250cm9scyBmb3Igb25lIHdlZWtkYXkuXG5cdCAqXG5cdCAqIEBwYXJhbSB7alF1ZXJ5fSAkZGF5X3JvdyBXZWVrZGF5IHJvdy5cblx0ICogQHJldHVybiB7T2JqZWN0W119IENhbm9uaWNhbCBpbnRlcnZhbCByZWNvcmRzLlxuXHQgKi9cblx0ZnVuY3Rpb24gY29sbGVjdF93b3JraW5nX3RpbWVfZGF5X2ludGVydmFscyggJGRheV9yb3cgKSB7XG5cdFx0dmFyIGludGVydmFscyA9IFtdO1xuXG5cdFx0JGRheV9yb3cuZmluZCggJ1tkYXRhLXdwYmMtd29ya2luZy10aW1lLWludGVydmFsPVwiMVwiXScgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgJGludGVydmFsID0gJCggdGhpcyApO1xuXG5cdFx0XHRpbnRlcnZhbHMucHVzaCgge1xuXHRcdFx0XHRzdGFydF9zZWNvbmQ6IHRpbWVfdG9fc2Vjb25kcyggJGludGVydmFsLmZpbmQoICcud3BiY19hZ193b3JraW5nX3RpbWVfc3RhcnQnICkudmFsKCkgKSxcblx0XHRcdFx0ZW5kX3NlY29uZDogdGltZV90b19zZWNvbmRzKCAkaW50ZXJ2YWwuZmluZCggJy53cGJjX2FnX3dvcmtpbmdfdGltZV9lbmQnICkudmFsKCkgKVxuXHRcdFx0fSApO1xuXHRcdH0gKTtcblxuXHRcdHJldHVybiBpbnRlcnZhbHM7XG5cdH1cblxuXHQvKipcblx0ICogUmVidWlsZCBkeW5hbWljIG5hbWVzLCBJRHMsIGFuZCBsYWJlbCBhc3NvY2lhdGlvbnMgYWZ0ZXIgYSByb3cgbXV0YXRpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSB7alF1ZXJ5fSAkZGF5X3JvdyBXZWVrZGF5IHJvdy5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHJlaW5kZXhfd29ya2luZ190aW1lX2RheSggJGRheV9yb3cgKSB7XG5cdFx0dmFyICR3ZWVrZGF5cyA9ICRkYXlfcm93LmNsb3Nlc3QoICdbZGF0YS13cGJjLXdvcmtpbmctdGltZS13ZWVrZGF5c10nICk7XG5cdFx0dmFyIHByZWZpeCA9IFN0cmluZyggJHdlZWtkYXlzLmF0dHIoICdkYXRhLXdwYmMtd29ya2luZy10aW1lLXdlZWtkYXlzJyApIHx8ICcnICk7XG5cdFx0dmFyIGRheSA9IHBhcnNlSW50KCAkZGF5X3Jvdy5hdHRyKCAnZGF0YS13cGJjLXdvcmtpbmctdGltZS1kYXknICksIDEwICk7XG5cblx0XHQkZGF5X3Jvdy5maW5kKCAnW2RhdGEtd3BiYy13b3JraW5nLXRpbWUtaW50ZXJ2YWw9XCIxXCJdJyApLmVhY2goIGZ1bmN0aW9uICggaW50ZXJ2YWxfaW5kZXggKSB7XG5cdFx0XHR2YXIgJGludGVydmFsID0gJCggdGhpcyApO1xuXHRcdFx0dmFyIHN0YXJ0X2lkID0gcHJlZml4ICsgJ19zdGFydF8nICsgZGF5ICsgJ18nICsgaW50ZXJ2YWxfaW5kZXg7XG5cdFx0XHR2YXIgZW5kX2lkID0gcHJlZml4ICsgJ19lbmRfJyArIGRheSArICdfJyArIGludGVydmFsX2luZGV4O1xuXHRcdFx0dmFyICRsYWJlbHMgPSAkaW50ZXJ2YWwuZmluZCggJ2xhYmVsJyApO1xuXG5cdFx0XHQkaW50ZXJ2YWwuYXR0ciggJ2RhdGEtaW50ZXJ2YWwtaW5kZXgnLCBpbnRlcnZhbF9pbmRleCApO1xuXHRcdFx0JGludGVydmFsLmZpbmQoICcud3BiY19hZ193b3JraW5nX3RpbWVfc3RhcnQnIClcblx0XHRcdFx0LmF0dHIoICdpZCcsIHN0YXJ0X2lkIClcblx0XHRcdFx0LmF0dHIoICduYW1lJywgcHJlZml4ICsgJ19zdGFydFsnICsgZGF5ICsgJ11bXScgKTtcblx0XHRcdCRpbnRlcnZhbC5maW5kKCAnLndwYmNfYWdfd29ya2luZ190aW1lX2VuZCcgKVxuXHRcdFx0XHQuYXR0ciggJ2lkJywgZW5kX2lkIClcblx0XHRcdFx0LmF0dHIoICduYW1lJywgcHJlZml4ICsgJ19lbmRbJyArIGRheSArICddW10nICk7XG5cdFx0XHQkbGFiZWxzLmVxKCAwICkuYXR0ciggJ2ZvcicsIHN0YXJ0X2lkICk7XG5cdFx0XHQkbGFiZWxzLmVxKCAxICkuYXR0ciggJ2ZvcicsIGVuZF9pZCApO1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZWZyZXNoIG9uZSB3ZWVrZGF5J3MgZW5hYmxlZCBjb250cm9scyBhbmQgaW50ZXJ2YWwtbGltaXQgc3RhdGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7alF1ZXJ5fSAkZGF5X3JvdyBXZWVrZGF5IHJvdy5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHJlZnJlc2hfd29ya2luZ190aW1lX2RheSggJGRheV9yb3cgKSB7XG5cdFx0dmFyICR3ZWVrZGF5cyA9ICRkYXlfcm93LmNsb3Nlc3QoICdbZGF0YS13cGJjLXdvcmtpbmctdGltZS13ZWVrZGF5c10nICk7XG5cdFx0dmFyICR0b2dnbGUgPSAkZGF5X3Jvdy5maW5kKCAnW2RhdGEtd3BiYy13b3JraW5nLXRpbWUtZGF5LXRvZ2dsZT1cIjFcIl0nICkuZmlyc3QoKTtcblx0XHR2YXIgJHJlc291cmNlX2N1c3RvbSA9ICRkYXlfcm93LmNsb3Nlc3QoICdbZGF0YS13cGJjLXdvcmtpbmctdGltZS1yZXNvdXJjZS1jdXN0b209XCIxXCJdJyApO1xuXHRcdHZhciBpc19ibG9ja19kaXNhYmxlZCA9ICRkYXlfcm93LmNsb3Nlc3QoICcud3BiY19hZ193b3JraW5nX3RpbWVfYmxvY2snICkuaGFzQ2xhc3MoICdpcy1kaXNhYmxlZCcgKVxuXHRcdFx0fHwgKCAkcmVzb3VyY2VfY3VzdG9tLmxlbmd0aCAmJiAhICRyZXNvdXJjZV9jdXN0b20uaGFzQ2xhc3MoICdpcy12aXNpYmxlJyApICk7XG5cdFx0dmFyIGlzX2RheV9lbmFibGVkID0gISBpc19ibG9ja19kaXNhYmxlZCAmJiAkdG9nZ2xlLnByb3AoICdjaGVja2VkJyApO1xuXHRcdHZhciBpbnRlcnZhbF9jb3VudCA9ICRkYXlfcm93LmZpbmQoICdbZGF0YS13cGJjLXdvcmtpbmctdGltZS1pbnRlcnZhbD1cIjFcIl0nICkubGVuZ3RoO1xuXHRcdHZhciBtYXhfaW50ZXJ2YWxzID0gZ2V0X21heF93b3JraW5nX3RpbWVfaW50ZXJ2YWxzKCAkd2Vla2RheXMgKTtcblxuXHRcdCRkYXlfcm93LnRvZ2dsZUNsYXNzKCAnaXMtZW5hYmxlZCcsICR0b2dnbGUucHJvcCggJ2NoZWNrZWQnICkgKTtcblx0XHQkdG9nZ2xlLnByb3AoICdkaXNhYmxlZCcsIGlzX2Jsb2NrX2Rpc2FibGVkICk7XG5cdFx0JGRheV9yb3cuZmluZCggJy53cGJjX2FnX3dvcmtpbmdfdGltZV9zdGFydCwgLndwYmNfYWdfd29ya2luZ190aW1lX2VuZCwgW2RhdGEtd3BiYy1yZW1vdmUtd29ya2luZy10aW1lLWludGVydmFsXScgKS5wcm9wKCAnZGlzYWJsZWQnLCAhIGlzX2RheV9lbmFibGVkICk7XG5cdFx0JGRheV9yb3cuZmluZCggJ1tkYXRhLXdwYmMtYWRkLXdvcmtpbmctdGltZS1pbnRlcnZhbF0nICkucHJvcCggJ2Rpc2FibGVkJywgISBpc19kYXlfZW5hYmxlZCB8fCBpbnRlcnZhbF9jb3VudCA+PSBtYXhfaW50ZXJ2YWxzICk7XG5cdH1cblxuXHQvKipcblx0ICogRmluZCBhIG5vbi1vdmVybGFwcGluZyBvbmUtaG91ciBpbnRlcnZhbCBwcm9wb3NhbC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3RbXX0gaW50ZXJ2YWxzIEN1cnJlbnQgd2Vla2RheSBpbnRlcnZhbHMuXG5cdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBQcm9wb3NlZCBpbnRlcnZhbCwgb3IgbnVsbCB3aGVuIHRoZSBkYXkgaGFzIG5vIGdhcC5cblx0ICovXG5cdGZ1bmN0aW9uIGZpbmRfd29ya2luZ190aW1lX2ludGVydmFsX3Byb3Bvc2FsKCBpbnRlcnZhbHMgKSB7XG5cdFx0dmFyIHNvcnRlZF9pbnRlcnZhbHMgPSBpbnRlcnZhbHMuc2xpY2UoKS5zb3J0KCBmdW5jdGlvbiAoIGZpcnN0X2ludGVydmFsLCBzZWNvbmRfaW50ZXJ2YWwgKSB7XG5cdFx0XHRyZXR1cm4gZmlyc3RfaW50ZXJ2YWwuc3RhcnRfc2Vjb25kIC0gc2Vjb25kX2ludGVydmFsLnN0YXJ0X3NlY29uZDtcblx0XHR9ICk7XG5cdFx0dmFyIHByZWZlcnJlZF9zdGFydCA9IHNvcnRlZF9pbnRlcnZhbHMubGVuZ3RoID8gc29ydGVkX2ludGVydmFsc1sgc29ydGVkX2ludGVydmFscy5sZW5ndGggLSAxIF0uZW5kX3NlY29uZCA6IDkgKiAzNjAwO1xuXHRcdHZhciBjYW5kaWRhdGVzID0gW107XG5cdFx0dmFyIGNhbmRpZGF0ZV9zdGFydDtcblxuXHRcdGZvciAoIGNhbmRpZGF0ZV9zdGFydCA9IDA7IGNhbmRpZGF0ZV9zdGFydCA8PSAyMyAqIDM2MDA7IGNhbmRpZGF0ZV9zdGFydCArPSAxODAwICkge1xuXHRcdFx0aWYgKCBjYW5kaWRhdGVfc3RhcnQgPj0gcHJlZmVycmVkX3N0YXJ0ICkge1xuXHRcdFx0XHRjYW5kaWRhdGVzLnB1c2goIGNhbmRpZGF0ZV9zdGFydCApO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRmb3IgKCBjYW5kaWRhdGVfc3RhcnQgPSAwOyBjYW5kaWRhdGVfc3RhcnQgPCBwcmVmZXJyZWRfc3RhcnQgJiYgY2FuZGlkYXRlX3N0YXJ0IDw9IDIzICogMzYwMDsgY2FuZGlkYXRlX3N0YXJ0ICs9IDE4MDAgKSB7XG5cdFx0XHRjYW5kaWRhdGVzLnB1c2goIGNhbmRpZGF0ZV9zdGFydCApO1xuXHRcdH1cblxuXHRcdGNhbmRpZGF0ZV9zdGFydCA9IG51bGw7XG5cdFx0Y2FuZGlkYXRlcy5zb21lKCBmdW5jdGlvbiAoIHByb3Bvc2VkX3N0YXJ0ICkge1xuXHRcdFx0dmFyIHByb3Bvc2VkX2VuZCA9IHByb3Bvc2VkX3N0YXJ0ICsgMzYwMDtcblx0XHRcdHZhciBvdmVybGFwcyA9IHNvcnRlZF9pbnRlcnZhbHMuc29tZSggZnVuY3Rpb24gKCBpbnRlcnZhbCApIHtcblx0XHRcdFx0cmV0dXJuIHByb3Bvc2VkX3N0YXJ0IDwgaW50ZXJ2YWwuZW5kX3NlY29uZCAmJiBwcm9wb3NlZF9lbmQgPiBpbnRlcnZhbC5zdGFydF9zZWNvbmQ7XG5cdFx0XHR9ICk7XG5cblx0XHRcdGlmICggcHJvcG9zZWRfZW5kIDw9IDg2NDAwICYmICEgb3ZlcmxhcHMgKSB7XG5cdFx0XHRcdGNhbmRpZGF0ZV9zdGFydCA9IHByb3Bvc2VkX3N0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gbnVsbCA9PT0gY2FuZGlkYXRlX3N0YXJ0ID8gbnVsbCA6IHtcblx0XHRcdHN0YXJ0X3NlY29uZDogY2FuZGlkYXRlX3N0YXJ0LFxuXHRcdFx0ZW5kX3NlY29uZDogY2FuZGlkYXRlX3N0YXJ0ICsgMzYwMFxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogQXBwZW5kIGFuIGludGVydmFsIGJ5IGNsb25pbmcgdGhlIHNlcnZlci1yZW5kZXJlZCBhbGxvdy1saXN0ZWQgY29udHJvbHMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7alF1ZXJ5fSAkZGF5X3JvdyBXZWVrZGF5IHJvdy5cblx0ICogQHBhcmFtIHtPYmplY3R9IGludGVydmFsIENhbm9uaWNhbCBpbnRlcnZhbCByZWNvcmQuXG5cdCAqIEByZXR1cm4ge2pRdWVyeX0gQXBwZW5kZWQgaW50ZXJ2YWwgbm9kZS5cblx0ICovXG5cdGZ1bmN0aW9uIGFwcGVuZF93b3JraW5nX3RpbWVfaW50ZXJ2YWwoICRkYXlfcm93LCBpbnRlcnZhbCApIHtcblx0XHR2YXIgJGNvbnRhaW5lciA9ICRkYXlfcm93LmZpbmQoICdbZGF0YS13cGJjLXdvcmtpbmctdGltZS1pbnRlcnZhbHM9XCIxXCJdJyApLmZpcnN0KCk7XG5cdFx0dmFyICRwcm90b3R5cGUgPSAkY29udGFpbmVyLmZpbmQoICdbZGF0YS13cGJjLXdvcmtpbmctdGltZS1pbnRlcnZhbD1cIjFcIl0nICkuZmlyc3QoKTtcblx0XHR2YXIgJGludGVydmFsID0gJHByb3RvdHlwZS5jbG9uZSggZmFsc2UsIGZhbHNlICk7XG5cblx0XHQkaW50ZXJ2YWwuZmluZCggJy53cGJjX2FnX3dvcmtpbmdfdGltZV9zdGFydCcgKS52YWwoIHNlY29uZHNfdG9fdGltZSggaW50ZXJ2YWwuc3RhcnRfc2Vjb25kICkgKTtcblx0XHQkaW50ZXJ2YWwuZmluZCggJy53cGJjX2FnX3dvcmtpbmdfdGltZV9lbmQnICkudmFsKCBzZWNvbmRzX3RvX3RpbWUoIGludGVydmFsLmVuZF9zZWNvbmQgKSApO1xuXHRcdCRjb250YWluZXIuYXBwZW5kKCAkaW50ZXJ2YWwgKTtcblx0XHRyZWluZGV4X3dvcmtpbmdfdGltZV9kYXkoICRkYXlfcm93ICk7XG5cblx0XHRyZXR1cm4gJGludGVydmFsO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFkZCB0aGUgbmV4dCBhdmFpbGFibGUgb25lLWhvdXIgaW50ZXJ2YWwgdG8gYSB3ZWVrZGF5LlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBidXR0b24gQWRkLWludGVydmFsIGJ1dHRvbi5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGFkZF93b3JraW5nX3RpbWVfaW50ZXJ2YWwoIGJ1dHRvbiApIHtcblx0XHR2YXIgJGRheV9yb3cgPSAkKCBidXR0b24gKS5jbG9zZXN0KCAnW2RhdGEtd3BiYy13b3JraW5nLXRpbWUtZGF5XScgKTtcblx0XHR2YXIgJHdlZWtkYXlzID0gJGRheV9yb3cuY2xvc2VzdCggJ1tkYXRhLXdwYmMtd29ya2luZy10aW1lLXdlZWtkYXlzXScgKTtcblx0XHR2YXIgaW50ZXJ2YWxzID0gY29sbGVjdF93b3JraW5nX3RpbWVfZGF5X2ludGVydmFscyggJGRheV9yb3cgKTtcblx0XHR2YXIgbWF4X2ludGVydmFscyA9IGdldF9tYXhfd29ya2luZ190aW1lX2ludGVydmFscyggJHdlZWtkYXlzICk7XG5cdFx0dmFyIHByb3Bvc2FsO1xuXHRcdHZhciAkaW50ZXJ2YWw7XG5cblx0XHRpZiAoIGludGVydmFscy5sZW5ndGggPj0gbWF4X2ludGVydmFscyApIHtcblx0XHRcdHNob3dfbWVzc2FnZSggKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5pbnRlcnZhbF9saW1pdCApIHx8ICdObyBhZGRpdGlvbmFsIG9uZS1ob3VyIGludGVydmFsIGlzIGF2YWlsYWJsZSBmb3IgdGhpcyB3ZWVrZGF5LicsICdlcnJvcicsIDYwMDAgKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRwcm9wb3NhbCA9IGZpbmRfd29ya2luZ190aW1lX2ludGVydmFsX3Byb3Bvc2FsKCBpbnRlcnZhbHMgKTtcblx0XHRpZiAoICEgcHJvcG9zYWwgKSB7XG5cdFx0XHRzaG93X21lc3NhZ2UoICggY2ZnLmkxOG4gJiYgY2ZnLmkxOG4uaW50ZXJ2YWxfbGltaXQgKSB8fCAnTm8gYWRkaXRpb25hbCBvbmUtaG91ciBpbnRlcnZhbCBpcyBhdmFpbGFibGUgZm9yIHRoaXMgd2Vla2RheS4nLCAnZXJyb3InLCA2MDAwICk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0JGludGVydmFsID0gYXBwZW5kX3dvcmtpbmdfdGltZV9pbnRlcnZhbCggJGRheV9yb3csIHByb3Bvc2FsICk7XG5cdFx0JGRheV9yb3cuZmluZCggJ1tkYXRhLXdwYmMtd29ya2luZy10aW1lLWRheS10b2dnbGU9XCIxXCJdJyApLnByb3AoICdjaGVja2VkJywgdHJ1ZSApO1xuXHRcdHJlZnJlc2hfd29ya2luZ190aW1lX2RheSggJGRheV9yb3cgKTtcblx0XHQkaW50ZXJ2YWwuZmluZCggJy53cGJjX2FnX3dvcmtpbmdfdGltZV9zdGFydCcgKS50cmlnZ2VyKCAnZm9jdXMnICk7XG5cdFx0c2NoZWR1bGVfcHJldmlld19yZWZyZXNoKCk7XG5cdH1cblxuXHQvKipcblx0ICogUmVtb3ZlIG9uZSB3ZWVrZGF5IGludGVydmFsLCBjbG9zaW5nIHRoZSB3ZWVrZGF5IHdoZW4gaXQgaXMgdGhlIGxhc3Qgb25lLlxuXHQgKlxuXHQgKiBLZWVwaW5nIG9uZSBkaXNhYmxlZCBpbnRlcnZhbCBpbiB0aGUgRE9NIHByZXNlcnZlcyBhbiBhbGxvdy1saXN0ZWQgY29udHJvbFxuXHQgKiBwcm90b3R5cGUgZm9yIHJlb3BlbmluZyB0aGUgZGF5IG9yIGFkZGluZyBhIGxhdGVyIGludGVydmFsLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBidXR0b24gUmVtb3ZlLWludGVydmFsIGJ1dHRvbi5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHJlbW92ZV93b3JraW5nX3RpbWVfaW50ZXJ2YWwoIGJ1dHRvbiApIHtcblx0XHR2YXIgJGJ1dHRvbiA9ICQoIGJ1dHRvbiApO1xuXHRcdHZhciAkZGF5X3JvdyA9ICRidXR0b24uY2xvc2VzdCggJ1tkYXRhLXdwYmMtd29ya2luZy10aW1lLWRheV0nICk7XG5cdFx0dmFyICRpbnRlcnZhbHMgPSAkZGF5X3Jvdy5maW5kKCAnW2RhdGEtd3BiYy13b3JraW5nLXRpbWUtaW50ZXJ2YWw9XCIxXCJdJyApO1xuXHRcdHZhciAkZm9jdXNfdGFyZ2V0O1xuXG5cdFx0aWYgKCAkaW50ZXJ2YWxzLmxlbmd0aCA+IDEgKSB7XG5cdFx0XHQkYnV0dG9uLmNsb3Nlc3QoICdbZGF0YS13cGJjLXdvcmtpbmctdGltZS1pbnRlcnZhbD1cIjFcIl0nICkucmVtb3ZlKCk7XG5cdFx0XHQkZm9jdXNfdGFyZ2V0ID0gJGRheV9yb3cuZmluZCggJ1tkYXRhLXdwYmMtYWRkLXdvcmtpbmctdGltZS1pbnRlcnZhbD1cIjFcIl0nICkuZmlyc3QoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0JGRheV9yb3cuZmluZCggJ1tkYXRhLXdwYmMtd29ya2luZy10aW1lLWRheS10b2dnbGU9XCIxXCJdJyApLnByb3AoICdjaGVja2VkJywgZmFsc2UgKTtcblx0XHRcdCRmb2N1c190YXJnZXQgPSAkZGF5X3Jvdy5maW5kKCAnW2RhdGEtd3BiYy13b3JraW5nLXRpbWUtZGF5LXRvZ2dsZT1cIjFcIl0nICkuZmlyc3QoKTtcblx0XHR9XG5cblx0XHRyZWluZGV4X3dvcmtpbmdfdGltZV9kYXkoICRkYXlfcm93ICk7XG5cdFx0cmVmcmVzaF93b3JraW5nX3RpbWVfZGF5KCAkZGF5X3JvdyApO1xuXHRcdCRmb2N1c190YXJnZXQudHJpZ2dlciggJ2ZvY3VzJyApO1xuXHRcdHNjaGVkdWxlX3ByZXZpZXdfcmVmcmVzaCgpO1xuXHR9XG5cclxuXHRmdW5jdGlvbiBjb2xsZWN0X3dvcmtpbmdfdGltZV93ZWVrZGF5cyggcHJlZml4ICkge1xuXHRcdHZhciAkZm9ybSA9IGdldF9mb3JtKCk7XG5cdFx0dmFyIHdlZWtkYXlzID0ge307XG5cblx0XHQkZm9ybS5maW5kKCAnW2RhdGEtd3BiYy13b3JraW5nLXRpbWUtd2Vla2RheXM9XCInICsgcHJlZml4ICsgJ1wiXSAud3BiY19hZ193b3JraW5nX3RpbWVfcm93JyApLmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciAkcm93ID0gJCggdGhpcyApO1xuXHRcdFx0dmFyIGRheSA9IHBhcnNlSW50KCAkcm93LmF0dHIoICdkYXRhLXdwYmMtd29ya2luZy10aW1lLWRheScgKSwgMTAgKTtcblxuXHRcdFx0d2Vla2RheXNbIGRheSBdID0gW107XG5cdFx0XHRpZiAoICEgJHJvdy5maW5kKCAnW2RhdGEtd3BiYy13b3JraW5nLXRpbWUtZGF5LXRvZ2dsZT1cIjFcIl0nICkucHJvcCggJ2NoZWNrZWQnICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0d2Vla2RheXNbIGRheSBdID0gY29sbGVjdF93b3JraW5nX3RpbWVfZGF5X2ludGVydmFscyggJHJvdyApO1xuXHRcdH0gKTtcblxyXG5cdFx0cmV0dXJuIHdlZWtkYXlzO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2V0X3dvcmtpbmdfdGltZV93ZWVrZGF5cyggcHJlZml4LCB3ZWVrZGF5cyApIHtcblx0XHR2YXIgJHdyYXAgPSBnZXRfZm9ybSgpLmZpbmQoICdbZGF0YS13cGJjLXdvcmtpbmctdGltZS13ZWVrZGF5cz1cIicgKyBwcmVmaXggKyAnXCJdJyApO1xuXG5cdFx0JHdyYXAuZmluZCggJy53cGJjX2FnX3dvcmtpbmdfdGltZV9yb3cnICkuZWFjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyICRyb3cgPSAkKCB0aGlzICk7XG5cdFx0XHR2YXIgZGF5ID0gcGFyc2VJbnQoICRyb3cuYXR0ciggJ2RhdGEtd3BiYy13b3JraW5nLXRpbWUtZGF5JyApLCAxMCApO1xuXHRcdFx0dmFyIGludGVydmFscyA9IHdlZWtkYXlzICYmICQuaXNBcnJheSggd2Vla2RheXNbIGRheSBdICkgPyB3ZWVrZGF5c1sgZGF5IF0gOiBbXTtcblx0XHRcdHZhciBkaXNwbGF5X2ludGVydmFscyA9IGludGVydmFscy5sZW5ndGggPyBpbnRlcnZhbHMgOiBbIHsgc3RhcnRfc2Vjb25kOiAzMjQwMCwgZW5kX3NlY29uZDogNjQ4MDAgfSBdO1xuXHRcdFx0dmFyICRjb250YWluZXIgPSAkcm93LmZpbmQoICdbZGF0YS13cGJjLXdvcmtpbmctdGltZS1pbnRlcnZhbHM9XCIxXCJdJyApLmZpcnN0KCk7XG5cdFx0XHR2YXIgJHByb3RvdHlwZSA9ICRjb250YWluZXIuZmluZCggJ1tkYXRhLXdwYmMtd29ya2luZy10aW1lLWludGVydmFsPVwiMVwiXScgKS5maXJzdCgpLmNsb25lKCBmYWxzZSwgZmFsc2UgKTtcblxuXHRcdFx0JGNvbnRhaW5lci5lbXB0eSgpLmFwcGVuZCggJHByb3RvdHlwZSApO1xuXHRcdFx0JHByb3RvdHlwZS5maW5kKCAnLndwYmNfYWdfd29ya2luZ190aW1lX3N0YXJ0JyApLnZhbCggc2Vjb25kc190b190aW1lKCBkaXNwbGF5X2ludGVydmFsc1swXS5zdGFydF9zZWNvbmQgKSApO1xuXHRcdFx0JHByb3RvdHlwZS5maW5kKCAnLndwYmNfYWdfd29ya2luZ190aW1lX2VuZCcgKS52YWwoIHNlY29uZHNfdG9fdGltZSggZGlzcGxheV9pbnRlcnZhbHNbMF0uZW5kX3NlY29uZCApICk7XG5cdFx0XHRkaXNwbGF5X2ludGVydmFscy5zbGljZSggMSApLmZvckVhY2goIGZ1bmN0aW9uICggaW50ZXJ2YWwgKSB7XG5cdFx0XHRcdGFwcGVuZF93b3JraW5nX3RpbWVfaW50ZXJ2YWwoICRyb3csIGludGVydmFsICk7XG5cdFx0XHR9ICk7XG5cdFx0XHQkcm93LmZpbmQoICdbZGF0YS13cGJjLXdvcmtpbmctdGltZS1kYXktdG9nZ2xlPVwiMVwiXScgKS5wcm9wKCAnY2hlY2tlZCcsIGludGVydmFscy5sZW5ndGggPiAwICk7XG5cdFx0XHRyZWluZGV4X3dvcmtpbmdfdGltZV9kYXkoICRyb3cgKTtcblx0XHR9ICk7XG5cdH1cblxyXG5cdGZ1bmN0aW9uIHJlZnJlc2hfd29ya2luZ190aW1lX3BhbmVscygpIHtcblx0XHR2YXIgaXNfZW5hYmxlZCA9IGdldF9mb3JtKCkuZmluZCggJ2lucHV0W25hbWU9XCJib29raW5nX3dvcmtpbmdfdGltZV9lbmFibGVkXCJdJyApLnByb3AoICdjaGVja2VkJyApO1xuXHRcdHZhciBtb2RlID0gZ2V0X2Zvcm0oKS5maW5kKCAnaW5wdXRbbmFtZT1cImJvb2tpbmdfd29ya2luZ190aW1lX3Jlc291cmNlX21vZGVcIl06Y2hlY2tlZCcgKS52YWwoKSB8fCAnaW5oZXJpdCc7XG5cdFx0dmFyICRyZXNvdXJjZV9jdXN0b20gPSBnZXRfZm9ybSgpLmZpbmQoICdbZGF0YS13cGJjLXdvcmtpbmctdGltZS1yZXNvdXJjZS1jdXN0b21dJyApO1xuXG5cdFx0JHJlc291cmNlX2N1c3RvbS50b2dnbGVDbGFzcyggJ2lzLXZpc2libGUnLCBtb2RlID09PSAnY3VzdG9tJyApO1xuXG5cdFx0Z2V0X2Zvcm0oKVxuXHRcdFx0LmZpbmQoICcud3BiY19hZ193b3JraW5nX3RpbWVfYmxvY2snIClcblx0XHRcdC50b2dnbGVDbGFzcyggJ2lzLWRpc2FibGVkJywgISBpc19lbmFibGVkICk7XG5cblx0XHRnZXRfZm9ybSgpLmZpbmQoICcud3BiY19hZ193b3JraW5nX3RpbWVfYmxvY2snICkuZWFjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0JCggdGhpcyApLmZpbmQoICdpbnB1dCwgc2VsZWN0LCBidXR0b24nICkucHJvcCggJ2Rpc2FibGVkJywgISBpc19lbmFibGVkICk7XG5cdFx0fSApO1xuXHRcdGdldF9mb3JtKCkuZmluZCggJ1tkYXRhLXdwYmMtd29ya2luZy10aW1lLWRheV0nICkuZWFjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0cmVmcmVzaF93b3JraW5nX3RpbWVfZGF5KCAkKCB0aGlzICkgKTtcblx0XHR9ICk7XG5cdH1cblxyXG5cdGZ1bmN0aW9uIGdldF93b3JraW5nX3RpbWVfc2V0dGluZ3NfZnJvbV9mb3JtKCkge1xyXG5cdFx0dmFyICRmb3JtID0gZ2V0X2Zvcm0oKTtcclxuXHRcdHZhciByZXNvdXJjZUlkID0gcGFyc2VJbnQoICRmb3JtLmZpbmQoICdbZGF0YS13cGJjLXdvcmtpbmctdGltZS1yZXNvdXJjZS1pZF0nICkudmFsKCksIDEwICkgfHwgcGFyc2VJbnQoICQoICcjd3BiY19hZ19yZXNvdXJjZV9pZCcgKS52YWwoKSwgMTAgKSB8fCAwO1xyXG5cdFx0dmFyIHdvcmtpbmdUaW1lID0gJC5leHRlbmQoIHRydWUsIHt9LCBjZmcuc2V0dGluZ3MgJiYgY2ZnLnNldHRpbmdzLndvcmtpbmdfdGltZSA/IGNmZy5zZXR0aW5ncy53b3JraW5nX3RpbWUgOiAoIGNmZy5kZWZhdWx0X3NldHRpbmdzICYmIGNmZy5kZWZhdWx0X3NldHRpbmdzLndvcmtpbmdfdGltZSA/IGNmZy5kZWZhdWx0X3NldHRpbmdzLndvcmtpbmdfdGltZSA6IHt9ICkgKTtcclxuXHJcblx0XHRpZiAoICEgd29ya2luZ1RpbWUuZGVmYXVsdCApIHtcclxuXHRcdFx0d29ya2luZ1RpbWUuZGVmYXVsdCA9IHt9O1xyXG5cdFx0fVxyXG5cdFx0aWYgKCAhIHdvcmtpbmdUaW1lLnJlc291cmNlcyApIHtcclxuXHRcdFx0d29ya2luZ1RpbWUucmVzb3VyY2VzID0ge307XHJcblx0XHR9XHJcblxyXG5cdFx0d29ya2luZ1RpbWUuZW5hYmxlZCA9ICRmb3JtLmZpbmQoICdpbnB1dFtuYW1lPVwiYm9va2luZ193b3JraW5nX3RpbWVfZW5hYmxlZFwiXScgKS5wcm9wKCAnY2hlY2tlZCcgKSA/ICdPbicgOiAnT2ZmJztcclxuXHRcdHdvcmtpbmdUaW1lLmRlZmF1bHQud2Vla2RheXMgPSBjb2xsZWN0X3dvcmtpbmdfdGltZV93ZWVrZGF5cyggJ2Jvb2tpbmdfd29ya2luZ190aW1lX2RlZmF1bHQnICk7XHJcblxyXG5cdFx0aWYgKCByZXNvdXJjZUlkID4gMCApIHtcclxuXHRcdFx0d29ya2luZ1RpbWUucmVzb3VyY2VzWyByZXNvdXJjZUlkIF0gPSB7XHJcblx0XHRcdFx0bW9kZTogJGZvcm0uZmluZCggJ2lucHV0W25hbWU9XCJib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZV9tb2RlXCJdOmNoZWNrZWQnICkudmFsKCkgfHwgJ2luaGVyaXQnLFxyXG5cdFx0XHRcdHdlZWtkYXlzOiBjb2xsZWN0X3dvcmtpbmdfdGltZV93ZWVrZGF5cyggJ2Jvb2tpbmdfd29ya2luZ190aW1lX3Jlc291cmNlJyApXHJcblx0XHRcdH07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHdvcmtpbmdUaW1lO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYXBwbHlfd29ya2luZ190aW1lX3NldHRpbmdzX3RvX2Zvcm0oIHdvcmtpbmdUaW1lLCByZXNvdXJjZUlkICkge1xyXG5cdFx0dmFyIHJlc291cmNlU2V0dGluZ3M7XHJcblxyXG5cdFx0d29ya2luZ1RpbWUgPSB3b3JraW5nVGltZSB8fCB7fTtcclxuXHRcdHJlc291cmNlSWQgPSBwYXJzZUludCggcmVzb3VyY2VJZCwgMTAgKSB8fCBwYXJzZUludCggJCggJyN3cGJjX2FnX3Jlc291cmNlX2lkJyApLnZhbCgpLCAxMCApIHx8IDA7XHJcblx0XHRyZXNvdXJjZVNldHRpbmdzID0gd29ya2luZ1RpbWUucmVzb3VyY2VzICYmIHdvcmtpbmdUaW1lLnJlc291cmNlc1sgcmVzb3VyY2VJZCBdID8gd29ya2luZ1RpbWUucmVzb3VyY2VzWyByZXNvdXJjZUlkIF0gOiB7XHJcblx0XHRcdG1vZGU6ICdpbmhlcml0JyxcclxuXHRcdFx0d2Vla2RheXM6IHdvcmtpbmdUaW1lLmRlZmF1bHQgJiYgd29ya2luZ1RpbWUuZGVmYXVsdC53ZWVrZGF5cyA/IHdvcmtpbmdUaW1lLmRlZmF1bHQud2Vla2RheXMgOiB7fVxyXG5cdFx0fTtcclxuXHJcblx0XHRnZXRfZm9ybSgpLmZpbmQoICdpbnB1dFtuYW1lPVwiYm9va2luZ193b3JraW5nX3RpbWVfZW5hYmxlZFwiXScgKS5wcm9wKCAnY2hlY2tlZCcsIHdvcmtpbmdUaW1lLmVuYWJsZWQgPT09ICdPbicgKTtcclxuXHRcdGdldF9mb3JtKCkuZmluZCggJ1tkYXRhLXdwYmMtd29ya2luZy10aW1lLXJlc291cmNlLWlkXScgKS52YWwoIHJlc291cmNlSWQgKTtcclxuXHRcdHNldF93b3JraW5nX3RpbWVfd2Vla2RheXMoICdib29raW5nX3dvcmtpbmdfdGltZV9kZWZhdWx0Jywgd29ya2luZ1RpbWUuZGVmYXVsdCAmJiB3b3JraW5nVGltZS5kZWZhdWx0LndlZWtkYXlzID8gd29ya2luZ1RpbWUuZGVmYXVsdC53ZWVrZGF5cyA6IHt9ICk7XHJcblx0XHRnZXRfZm9ybSgpLmZpbmQoICdpbnB1dFtuYW1lPVwiYm9va2luZ193b3JraW5nX3RpbWVfcmVzb3VyY2VfbW9kZVwiXVt2YWx1ZT1cIicgKyAoIHJlc291cmNlU2V0dGluZ3MubW9kZSB8fCAnaW5oZXJpdCcgKSArICdcIl0nICkucHJvcCggJ2NoZWNrZWQnLCB0cnVlICk7XHJcblx0XHRzZXRfd29ya2luZ190aW1lX3dlZWtkYXlzKCAnYm9va2luZ193b3JraW5nX3RpbWVfcmVzb3VyY2UnLCByZXNvdXJjZVNldHRpbmdzLndlZWtkYXlzIHx8ICggd29ya2luZ1RpbWUuZGVmYXVsdCA/IHdvcmtpbmdUaW1lLmRlZmF1bHQud2Vla2RheXMgOiB7fSApICk7XHJcblx0XHRyZWZyZXNoX3dvcmtpbmdfdGltZV9wYW5lbHMoKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGFwcGVuZF93b3JraW5nX3RpbWVfcGF5bG9hZCggcGF5bG9hZCApIHtcblx0XHR2YXIgJGZvcm0gPSBnZXRfZm9ybSgpO1xyXG5cdFx0dmFyIGRlZmF1bHREYXlzID0gW107XHJcblx0XHR2YXIgcmVzb3VyY2VEYXlzID0gW107XHJcblx0XHR2YXIgZGVmYXVsdFN0YXJ0ID0ge307XHJcblx0XHR2YXIgZGVmYXVsdEVuZCA9IHt9O1xyXG5cdFx0dmFyIHJlc291cmNlU3RhcnQgPSB7fTtcclxuXHRcdHZhciByZXNvdXJjZUVuZCA9IHt9O1xyXG5cclxuXHRcdCRmb3JtLmZpbmQoICdbZGF0YS13cGJjLXdvcmtpbmctdGltZS13ZWVrZGF5cz1cImJvb2tpbmdfd29ya2luZ190aW1lX2RlZmF1bHRcIl0gLndwYmNfYWdfd29ya2luZ190aW1lX3JvdycgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgJHJvdyA9ICQoIHRoaXMgKTtcblx0XHRcdHZhciBkYXkgPSBwYXJzZUludCggJHJvdy5hdHRyKCAnZGF0YS13cGJjLXdvcmtpbmctdGltZS1kYXknICksIDEwICk7XG5cblx0XHRcdGRlZmF1bHRTdGFydFsgZGF5IF0gPSBbXTtcblx0XHRcdGRlZmF1bHRFbmRbIGRheSBdID0gW107XG5cdFx0XHQkcm93LmZpbmQoICdbZGF0YS13cGJjLXdvcmtpbmctdGltZS1pbnRlcnZhbD1cIjFcIl0nICkuZWFjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRkZWZhdWx0U3RhcnRbIGRheSBdLnB1c2goICQoIHRoaXMgKS5maW5kKCAnLndwYmNfYWdfd29ya2luZ190aW1lX3N0YXJ0JyApLnZhbCgpIHx8ICcwOTowMCcgKTtcblx0XHRcdFx0ZGVmYXVsdEVuZFsgZGF5IF0ucHVzaCggJCggdGhpcyApLmZpbmQoICcud3BiY19hZ193b3JraW5nX3RpbWVfZW5kJyApLnZhbCgpIHx8ICcxODowMCcgKTtcblx0XHRcdH0gKTtcblx0XHRcdGlmICggJHJvdy5maW5kKCAnW2RhdGEtd3BiYy13b3JraW5nLXRpbWUtZGF5LXRvZ2dsZT1cIjFcIl0nICkucHJvcCggJ2NoZWNrZWQnICkgKSB7XG5cdFx0XHRcdGRlZmF1bHREYXlzLnB1c2goIGRheSApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblxyXG5cdFx0JGZvcm0uZmluZCggJ1tkYXRhLXdwYmMtd29ya2luZy10aW1lLXdlZWtkYXlzPVwiYm9va2luZ193b3JraW5nX3RpbWVfcmVzb3VyY2VcIl0gLndwYmNfYWdfd29ya2luZ190aW1lX3JvdycgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgJHJvdyA9ICQoIHRoaXMgKTtcblx0XHRcdHZhciBkYXkgPSBwYXJzZUludCggJHJvdy5hdHRyKCAnZGF0YS13cGJjLXdvcmtpbmctdGltZS1kYXknICksIDEwICk7XG5cblx0XHRcdHJlc291cmNlU3RhcnRbIGRheSBdID0gW107XG5cdFx0XHRyZXNvdXJjZUVuZFsgZGF5IF0gPSBbXTtcblx0XHRcdCRyb3cuZmluZCggJ1tkYXRhLXdwYmMtd29ya2luZy10aW1lLWludGVydmFsPVwiMVwiXScgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJlc291cmNlU3RhcnRbIGRheSBdLnB1c2goICQoIHRoaXMgKS5maW5kKCAnLndwYmNfYWdfd29ya2luZ190aW1lX3N0YXJ0JyApLnZhbCgpIHx8ICcwOTowMCcgKTtcblx0XHRcdFx0cmVzb3VyY2VFbmRbIGRheSBdLnB1c2goICQoIHRoaXMgKS5maW5kKCAnLndwYmNfYWdfd29ya2luZ190aW1lX2VuZCcgKS52YWwoKSB8fCAnMTg6MDAnICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoICRyb3cuZmluZCggJ1tkYXRhLXdwYmMtd29ya2luZy10aW1lLWRheS10b2dnbGU9XCIxXCJdJyApLnByb3AoICdjaGVja2VkJyApICkge1xuXHRcdFx0XHRyZXNvdXJjZURheXMucHVzaCggZGF5ICk7XG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0cGF5bG9hZC5ib29raW5nX3dvcmtpbmdfdGltZV9lbmFibGVkID0gJGZvcm0uZmluZCggJ2lucHV0W25hbWU9XCJib29raW5nX3dvcmtpbmdfdGltZV9lbmFibGVkXCJdJyApLnByb3AoICdjaGVja2VkJyApID8gJ09uJyA6ICcnO1xyXG5cdFx0cGF5bG9hZC5ib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZV9pZCA9ICRmb3JtLmZpbmQoICdbZGF0YS13cGJjLXdvcmtpbmctdGltZS1yZXNvdXJjZS1pZF0nICkudmFsKCkgfHwgJCggJyN3cGJjX2FnX3Jlc291cmNlX2lkJyApLnZhbCgpIHx8ICcnO1xyXG5cdFx0cGF5bG9hZC5ib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZV9tb2RlID0gJGZvcm0uZmluZCggJ2lucHV0W25hbWU9XCJib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZV9tb2RlXCJdOmNoZWNrZWQnICkudmFsKCkgfHwgJ2luaGVyaXQnO1xyXG5cdFx0cGF5bG9hZC5ib29raW5nX3dvcmtpbmdfdGltZV9kZWZhdWx0X2RheXMgPSBkZWZhdWx0RGF5cztcclxuXHRcdHBheWxvYWQuYm9va2luZ193b3JraW5nX3RpbWVfZGVmYXVsdF9zdGFydCA9IGRlZmF1bHRTdGFydDtcclxuXHRcdHBheWxvYWQuYm9va2luZ193b3JraW5nX3RpbWVfZGVmYXVsdF9lbmQgPSBkZWZhdWx0RW5kO1xyXG5cdFx0cGF5bG9hZC5ib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZV9kYXlzID0gcmVzb3VyY2VEYXlzO1xyXG5cdFx0cGF5bG9hZC5ib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZV9zdGFydCA9IHJlc291cmNlU3RhcnQ7XHJcblx0XHRwYXlsb2FkLmJvb2tpbmdfd29ya2luZ190aW1lX3Jlc291cmNlX2VuZCA9IHJlc291cmNlRW5kO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdXBkYXRlX3dwYmNfcHJldmlld19wYXJhbXMoIHNldHRpbmdzICkge1xyXG5cdFx0aWYgKCAhIHcuX3dwYmMgfHwgdHlwZW9mIHcuX3dwYmMuc2V0X290aGVyX3BhcmFtICE9PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dy5fd3BiYy5zZXRfb3RoZXJfcGFyYW0oICdhdmFpbGFiaWxpdHlfX3dlZWtfZGF5c191bmF2YWlsYWJsZScsIHNldHRpbmdzLndlZWtkYXlzLmNvbmNhdCggWyA5OTkgXSApICk7XHJcblx0XHR3Ll93cGJjLnNldF9vdGhlcl9wYXJhbSggJ2F2YWlsYWJpbGl0eV9fYXZhaWxhYmxlX2Zyb21fdG9kYXknLCBpc19hdmFpbGFibGVfbGltaXRfYXZhaWxhYmxlKCkgPyAoIHNldHRpbmdzLmJvb2tpbmdfYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXkgfHwgJycgKSA6ICcnICk7XHJcblx0XHR3Ll93cGJjLnNldF9vdGhlcl9wYXJhbSggJ2F2YWlsYWJpbGl0eV9fdW5hdmFpbGFibGVfZnJvbV90b2RheScsIHNldHRpbmdzLmJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheSB8fCAnMCcgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHVwZGF0ZV9idWZmZXJfcHJldmlld19ub3RlKCBzZXR0aW5ncyApIHtcclxuXHRcdHZhciAkbm90ZXMgPSAkKCAnW2RhdGEtd3BiYy1hZy1jYWxlbmRhci1ub3Rlcz1cIjFcIl0nICkuZmlyc3QoKTtcclxuXHRcdHZhciAkY2FsZW5kYXIgPSAkKCAnW2RhdGEtd3BiYy1hZy1jYWxlbmRhci1wYW5lbD1cIjFcIl0nICkuZmlyc3QoKTtcclxuXHRcdHZhciAkbm90ZSA9ICRub3Rlcy5maW5kKCAnLndwYmNfYWdfYnVmZmVyX3ByZXZpZXdfbm90ZScgKTtcclxuXHRcdHZhciB0eXBlID0gc2V0dGluZ3MuYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9pbl9vdXQgfHwgJyc7XHJcblx0XHR2YXIgYmVmb3JlX3RleHQgPSAnJztcclxuXHRcdHZhciBhZnRlcl90ZXh0ID0gJyc7XHJcblx0XHR2YXIgbWVzc2FnZSA9ICcnO1xyXG5cclxuXHRcdGlmICggISAkbm90ZXMubGVuZ3RoIHx8ICEgJGNhbGVuZGFyLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISAkbm90ZS5sZW5ndGggKSB7XHJcblx0XHRcdCRub3RlID0gJCggJzxkaXYgY2xhc3M9XCJ3cGJjX2FnX2J1ZmZlcl9wcmV2aWV3X25vdGVcIiBhcmlhLWxpdmU9XCJwb2xpdGVcIj48L2Rpdj4nICk7XHJcblx0XHRcdCRub3Rlcy5hcHBlbmQoICRub3RlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAhIGlzX2J1ZmZlcl9hdmFpbGFibGUoKSApIHtcclxuXHRcdFx0JGNhbGVuZGFyLnJlbW92ZUNsYXNzKCAnd3BiY19hZ19wcmV2aWV3X2J1ZmZlcl9hY3RpdmUnICk7XHJcblx0XHRcdCRub3RlLmF0dHIoICdoaWRkZW4nLCAnaGlkZGVuJyApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JGNhbGVuZGFyLnRvZ2dsZUNsYXNzKCAnd3BiY19hZ19wcmV2aWV3X2J1ZmZlcl9hY3RpdmUnLCAhISB0eXBlICk7XHJcblxyXG5cdFx0aWYgKCB0eXBlID09PSAnbScgKSB7XHJcblx0XHRcdGJlZm9yZV90ZXh0ID0gZ2V0X29wdGlvbl90ZXh0KCAnW25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX21pbnV0ZXNfaW5cIl0nICkgfHwgJy0nO1xyXG5cdFx0XHRhZnRlcl90ZXh0ID0gZ2V0X29wdGlvbl90ZXh0KCAnW25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX21pbnV0ZXNfb3V0XCJdJyApIHx8ICctJztcclxuXHRcdH0gZWxzZSBpZiAoIHR5cGUgPT09ICdkJyApIHtcclxuXHRcdFx0YmVmb3JlX3RleHQgPSBnZXRfb3B0aW9uX3RleHQoICdbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfZGF5c19pblwiXScgKSB8fCAnLSc7XHJcblx0XHRcdGFmdGVyX3RleHQgPSBnZXRfb3B0aW9uX3RleHQoICdbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfZGF5c19vdXRcIl0nICkgfHwgJy0nO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggdHlwZSApIHtcclxuXHRcdFx0bWVzc2FnZSA9ICc8c3Ryb25nPicgKyAoIGNmZy5pMThuICYmIGNmZy5pMThuLmJ1ZmZlcl9wcmV2aWV3ID8gY2ZnLmkxOG4uYnVmZmVyX3ByZXZpZXcgOiAnQnVmZmVyIHByZXZpZXcnICkgKyAnOjwvc3Ryb25nPiAnICtcclxuXHRcdFx0XHQoIGNmZy5pMThuICYmIGNmZy5pMThuLmJlZm9yZV9ib29raW5nID8gY2ZnLmkxOG4uYmVmb3JlX2Jvb2tpbmcgOiAnQmVmb3JlIGJvb2tpbmcnICkgKyAnICcgKyBiZWZvcmVfdGV4dCArXHJcblx0XHRcdFx0JyAvICcgKyAoIGNmZy5pMThuICYmIGNmZy5pMThuLmFmdGVyX2Jvb2tpbmcgPyBjZmcuaTE4bi5hZnRlcl9ib29raW5nIDogJ0FmdGVyIGJvb2tpbmcnICkgKyAnICcgKyBhZnRlcl90ZXh0O1xyXG5cdFx0XHRpZiAoICRub3RlLmh0bWwoKSAhPT0gbWVzc2FnZSApIHtcclxuXHRcdFx0XHQkbm90ZS5odG1sKCBtZXNzYWdlICk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCAkbm90ZS5hdHRyKCAnaGlkZGVuJyApICkge1xyXG5cdFx0XHRcdCRub3RlLnJlbW92ZUF0dHIoICdoaWRkZW4nICk7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdG1lc3NhZ2UgPSBjZmcuaTE4biAmJiBjZmcuaTE4bi5ub19idWZmZXIgPyBjZmcuaTE4bi5ub19idWZmZXIgOiAnTm8gYm9va2luZyBidWZmZXIgaXMgc2VsZWN0ZWQuJztcclxuXHRcdFx0aWYgKCAkbm90ZS50ZXh0KCkgIT09IG1lc3NhZ2UgKSB7XHJcblx0XHRcdFx0JG5vdGUudGV4dCggbWVzc2FnZSApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggISAkbm90ZS5hdHRyKCAnaGlkZGVuJyApICkge1xyXG5cdFx0XHRcdCRub3RlLmF0dHIoICdoaWRkZW4nLCAnaGlkZGVuJyApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBhcHBseV9idWZmZXJfZGF5c19wcmV2aWV3KCBzZXR0aW5ncyApIHtcclxuXHRcdHZhciAkY2FsZW5kYXIgPSAkKCAnW2RhdGEtd3BiYy1hZy1jYWxlbmRhci1wYW5lbD1cIjFcIl0nICk7XHJcblx0XHR2YXIgYmVmb3JlX2RheXMgPSBnZXRfZGF5c192YWx1ZSggc2V0dGluZ3MuYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9kYXlzX2luICk7XHJcblx0XHR2YXIgYWZ0ZXJfZGF5cyA9IGdldF9kYXlzX3ZhbHVlKCBzZXR0aW5ncy5ib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfb3V0ICk7XHJcblx0XHR2YXIgZGF0ZV9jZWxscyA9IHt9O1xyXG5cdFx0dmFyIGJvb2tlZF9kYXRlcyA9IFtdO1xyXG5cclxuXHRcdGlmICggISBpc19idWZmZXJfYXZhaWxhYmxlKCkgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIHNldHRpbmdzLmJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfaW5fb3V0ICE9PSAnZCcgfHwgKCAhIGJlZm9yZV9kYXlzICYmICEgYWZ0ZXJfZGF5cyApICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JGNhbGVuZGFyLmZpbmQoICcuZGF0ZXBpY2stZGF5cy1jZWxsJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0dmFyICRjZWxsID0gJCggdGhpcyApO1xyXG5cdFx0XHR2YXIgc3FsX2RhdGUgPSBnZXRfc3FsX2RhdGVfZnJvbV9jZWxsKCB0aGlzICk7XHJcblx0XHRcdHZhciBjZWxsX2RhdGU7XHJcblxyXG5cdFx0XHRpZiAoICEgc3FsX2RhdGUgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRkYXRlX2NlbGxzWyBzcWxfZGF0ZSBdID0gJGNlbGw7XHJcblxyXG5cdFx0XHRpZiAoICRjZWxsLmhhc0NsYXNzKCAnZGF0ZV9hcHByb3ZlZCcgKSB8fCAkY2VsbC5oYXNDbGFzcyggJ2RhdGUyYXBwcm92ZScgKSApIHtcclxuXHRcdFx0XHRjZWxsX2RhdGUgPSBkYXRlX2Zyb21fc3FsKCBzcWxfZGF0ZSApO1xyXG5cdFx0XHRcdGlmICggY2VsbF9kYXRlICkge1xyXG5cdFx0XHRcdFx0Ym9va2VkX2RhdGVzLnB1c2goIGNlbGxfZGF0ZSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cclxuXHRcdCQuZWFjaCggYm9va2VkX2RhdGVzLCBmdW5jdGlvbiAoIGluZGV4LCBib29rZWRfZGF0ZSApIHtcclxuXHRcdFx0dmFyIG9mZnNldDtcclxuXHRcdFx0dmFyIHRhcmdldF9zcWxfZGF0ZTtcclxuXHRcdFx0dmFyICR0YXJnZXRfY2VsbDtcclxuXHJcblx0XHRcdGZvciAoIG9mZnNldCA9IGJlZm9yZV9kYXlzICogLTE7IG9mZnNldCA8IDA7IG9mZnNldCsrICkge1xyXG5cdFx0XHRcdHRhcmdldF9zcWxfZGF0ZSA9IGRhdGVfdG9fc3FsKCBhZGRfZGF5cyggYm9va2VkX2RhdGUsIG9mZnNldCApICk7XHJcblx0XHRcdFx0JHRhcmdldF9jZWxsID0gZGF0ZV9jZWxsc1sgdGFyZ2V0X3NxbF9kYXRlIF07XHJcblx0XHRcdFx0aWYgKCAkdGFyZ2V0X2NlbGwgJiYgISAkdGFyZ2V0X2NlbGwuaGFzQ2xhc3MoICdkYXRlX2FwcHJvdmVkJyApICYmICEgJHRhcmdldF9jZWxsLmhhc0NsYXNzKCAnZGF0ZTJhcHByb3ZlJyApICkge1xyXG5cdFx0XHRcdFx0cmVtZW1iZXJfcHJldmlld19vcmlnaW4oICR0YXJnZXRfY2VsbCApO1xyXG5cdFx0XHRcdFx0JHRhcmdldF9jZWxsLmFkZENsYXNzKCAnZGF0ZV91c2VyX3VuYXZhaWxhYmxlIHdwYmNfYWdfcHJldmlld191bmF2YWlsYWJsZSB3cGJjX2FnX3ByZXZpZXdfYnVmZmVyX3VuYXZhaWxhYmxlIGJ1ZmZlcl91bmF2YWlsYWJsZScgKTtcclxuXHRcdFx0XHRcdCR0YXJnZXRfY2VsbC5hdHRyKCAnZGF0YS13cGJjLWFnLXByZXZpZXctcmVhc29uJywgJ3dwYmNfYWdfcHJldmlld19idWZmZXJfdW5hdmFpbGFibGUnICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRmb3IgKCBvZmZzZXQgPSAxOyBvZmZzZXQgPD0gYWZ0ZXJfZGF5czsgb2Zmc2V0KysgKSB7XHJcblx0XHRcdFx0dGFyZ2V0X3NxbF9kYXRlID0gZGF0ZV90b19zcWwoIGFkZF9kYXlzKCBib29rZWRfZGF0ZSwgb2Zmc2V0ICkgKTtcclxuXHRcdFx0XHQkdGFyZ2V0X2NlbGwgPSBkYXRlX2NlbGxzWyB0YXJnZXRfc3FsX2RhdGUgXTtcclxuXHRcdFx0XHRpZiAoICR0YXJnZXRfY2VsbCAmJiAhICR0YXJnZXRfY2VsbC5oYXNDbGFzcyggJ2RhdGVfYXBwcm92ZWQnICkgJiYgISAkdGFyZ2V0X2NlbGwuaGFzQ2xhc3MoICdkYXRlMmFwcHJvdmUnICkgKSB7XHJcblx0XHRcdFx0XHRyZW1lbWJlcl9wcmV2aWV3X29yaWdpbiggJHRhcmdldF9jZWxsICk7XHJcblx0XHRcdFx0XHQkdGFyZ2V0X2NlbGwuYWRkQ2xhc3MoICdkYXRlX3VzZXJfdW5hdmFpbGFibGUgd3BiY19hZ19wcmV2aWV3X3VuYXZhaWxhYmxlIHdwYmNfYWdfcHJldmlld19idWZmZXJfdW5hdmFpbGFibGUgYnVmZmVyX3VuYXZhaWxhYmxlJyApO1xyXG5cdFx0XHRcdFx0JHRhcmdldF9jZWxsLmF0dHIoICdkYXRhLXdwYmMtYWctcHJldmlldy1yZWFzb24nLCAnd3BiY19hZ19wcmV2aWV3X2J1ZmZlcl91bmF2YWlsYWJsZScgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJlbWVtYmVyX3ByZXZpZXdfb3JpZ2luKCAkY2VsbCApIHtcclxuXHRcdGlmICggdHlwZW9mICRjZWxsLmF0dHIoICdkYXRhLXdwYmMtYWctb3JpZ2luYWwtZGF0ZS11c2VyLXVuYXZhaWxhYmxlJyApID09PSAndW5kZWZpbmVkJyApIHtcclxuXHRcdFx0JGNlbGwuYXR0ciggJ2RhdGEtd3BiYy1hZy1vcmlnaW5hbC1kYXRlLXVzZXItdW5hdmFpbGFibGUnLCAkY2VsbC5oYXNDbGFzcyggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScgKSA/ICcxJyA6ICcwJyApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gY2xlYXJfcHJldmlld19jZWxsKCAkY2VsbCApIHtcclxuXHRcdHZhciBoYWRfZGF0ZV91c2VyX3VuYXZhaWxhYmxlID0gJGNlbGwuYXR0ciggJ2RhdGEtd3BiYy1hZy1vcmlnaW5hbC1kYXRlLXVzZXItdW5hdmFpbGFibGUnICkgPT09ICcxJztcclxuXHJcblx0XHQkY2VsbC5yZW1vdmVDbGFzcyggcHJldmlld191bmF2YWlsYWJsZV9jbGFzc2VzICk7XHJcblx0XHQkY2VsbC5yZW1vdmVBdHRyKCAnZGF0YS13cGJjLWFnLXByZXZpZXctcmVhc29uJyApO1xyXG5cdFx0JGNlbGwucmVtb3ZlQXR0ciggJ2RhdGEtd3BiYy1hZy1vcmlnaW5hbC1kYXRlLXVzZXItdW5hdmFpbGFibGUnICk7XHJcblxyXG5cdFx0aWYgKCAhIGhhZF9kYXRlX3VzZXJfdW5hdmFpbGFibGUgKSB7XHJcblx0XHRcdCRjZWxsLnJlbW92ZUNsYXNzKCAnZGF0ZV91c2VyX3VuYXZhaWxhYmxlJyApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYXBwbHlfY2FsZW5kYXJfcHJldmlldygpIHtcclxuXHRcdHZhciBzZXR0aW5ncyA9IGNvbGxlY3Rfc2V0dGluZ3MoKTtcclxuXHRcdHZhciB0b2RheV9kYXRlID0gZ2V0X3JlYWxfdG9kYXlfZGF0ZSgpO1xyXG5cdFx0dmFyIGF2YWlsYWJsZV9saW1pdCA9IGlzX2F2YWlsYWJsZV9saW1pdF9hdmFpbGFibGUoKSA/IHBhcnNlSW50KCBzZXR0aW5ncy5ib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5IHx8ICcwJywgMTAgKSA6IDA7XHJcblx0XHR2YXIgJGNhbGVuZGFyID0gJCggJ1tkYXRhLXdwYmMtYWctY2FsZW5kYXItcGFuZWw9XCIxXCJdJyApO1xyXG5cclxuXHRcdHVwZGF0ZV93cGJjX3ByZXZpZXdfcGFyYW1zKCBzZXR0aW5ncyApO1xyXG5cdFx0dXBkYXRlX2J1ZmZlcl9wcmV2aWV3X25vdGUoIHNldHRpbmdzICk7XHJcblxyXG5cdFx0JGNhbGVuZGFyLmZpbmQoICcuZGF0ZXBpY2stZGF5cy1jZWxsJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0dmFyIGNlbGwgPSB0aGlzO1xyXG5cdFx0XHR2YXIgJGNlbGwgPSAkKCBjZWxsICk7XHJcblx0XHRcdHZhciBzcWxfZGF0ZSA9IGdldF9zcWxfZGF0ZV9mcm9tX2NlbGwoIGNlbGwgKTtcclxuXHRcdFx0dmFyIGNlbGxfZGF0ZSA9IGRhdGVfZnJvbV9zcWwoIHNxbF9kYXRlICk7XHJcblx0XHRcdHZhciBtYWtlX3VuYXZhaWxhYmxlID0gZmFsc2U7XHJcblx0XHRcdHZhciByZWFzb25fY2xhc3MgPSAnJztcclxuXHRcdFx0dmFyIHByZXZpb3VzX3JlYXNvbiA9ICRjZWxsLmF0dHIoICdkYXRhLXdwYmMtYWctcHJldmlldy1yZWFzb24nICkgfHwgJyc7XHJcblx0XHRcdHZhciBoYWRfZ2VuZXJhbF9wcmV2aWV3ID0gISEgcHJldmlvdXNfcmVhc29uIHx8ICRjZWxsLmhhc0NsYXNzKCAnd3BiY19hZ19wcmV2aWV3X3VuYXZhaWxhYmxlJyApIHx8ICRjZWxsLmhhc0NsYXNzKCAnd2Vla2RheV91bmF2YWlsYWJsZScgKSB8fCAkY2VsbC5oYXNDbGFzcyggJ2Zyb21fdG9kYXlfdW5hdmFpbGFibGUnICkgfHwgJGNlbGwuaGFzQ2xhc3MoICdsaW1pdF9hdmFpbGFibGVfZnJvbV90b2RheScgKSB8fCAkY2VsbC5oYXNDbGFzcyggJ2J1ZmZlcl91bmF2YWlsYWJsZScgKTtcclxuXHJcblx0XHRcdGlmICggISBjZWxsX2RhdGUgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIHNldHRpbmdzLndlZWtkYXlzLmluZGV4T2YoIGNlbGxfZGF0ZS5nZXREYXkoKSApID4gLTEgKSB7XHJcblx0XHRcdFx0bWFrZV91bmF2YWlsYWJsZSA9IHRydWU7XHJcblx0XHRcdFx0cmVhc29uX2NsYXNzID0gJ3dwYmNfYWdfcHJldmlld193ZWVrZGF5X3VuYXZhaWxhYmxlJztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCB1bmF2YWlsYWJsZV9mcm9tX3RvZGF5X2FwcGxpZXMoIGNlbGxfZGF0ZSwgdG9kYXlfZGF0ZSwgc2V0dGluZ3MuYm9va2luZ191bmF2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5ICkgKSB7XHJcblx0XHRcdFx0bWFrZV91bmF2YWlsYWJsZSA9IHRydWU7XHJcblx0XHRcdFx0cmVhc29uX2NsYXNzID0gJ3dwYmNfYWdfcHJldmlld19mcm9tX3RvZGF5X3VuYXZhaWxhYmxlJztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBhdmFpbGFibGVfbGltaXQgPiAwICYmIGRheXNfYmV0d2VlbiggY2VsbF9kYXRlLCB0b2RheV9kYXRlICkgPj0gYXZhaWxhYmxlX2xpbWl0ICkge1xyXG5cdFx0XHRcdG1ha2VfdW5hdmFpbGFibGUgPSB0cnVlO1xyXG5cdFx0XHRcdHJlYXNvbl9jbGFzcyA9ICd3cGJjX2FnX3ByZXZpZXdfbGltaXRfYXZhaWxhYmxlX2Zyb21fdG9kYXknO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIG1ha2VfdW5hdmFpbGFibGUgKSB7XHJcblx0XHRcdFx0aWYgKCBwcmV2aW91c19yZWFzb24gIT09IHJlYXNvbl9jbGFzcyApIHtcclxuXHRcdFx0XHRcdGlmICggaGFkX2dlbmVyYWxfcHJldmlldyApIHtcclxuXHRcdFx0XHRcdFx0Y2xlYXJfcHJldmlld19jZWxsKCAkY2VsbCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0cmVtZW1iZXJfcHJldmlld19vcmlnaW4oICRjZWxsICk7XHJcblx0XHRcdFx0XHQkY2VsbC5hZGRDbGFzcyggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZSB3cGJjX2FnX3ByZXZpZXdfdW5hdmFpbGFibGUgJyArIHJlYXNvbl9jbGFzcyApO1xyXG5cdFx0XHRcdFx0JGNlbGwuYXR0ciggJ2RhdGEtd3BiYy1hZy1wcmV2aWV3LXJlYXNvbicsIHJlYXNvbl9jbGFzcyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBlbHNlIGlmICggaGFkX2dlbmVyYWxfcHJldmlldyApIHtcclxuXHRcdFx0XHRjbGVhcl9wcmV2aWV3X2NlbGwoICRjZWxsICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHJcblx0XHRhcHBseV9idWZmZXJfZGF5c19wcmV2aWV3KCBzZXR0aW5ncyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcXVldWVfcHJldmlld19yZWZyZXNoKCkge1xyXG5cdFx0aWYgKCBwcmV2aWV3X2ZyYW1lICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCB3LnJlcXVlc3RBbmltYXRpb25GcmFtZSApIHtcclxuXHRcdFx0cHJldmlld19mcmFtZSA9IHcucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0cHJldmlld19mcmFtZSA9IDA7XHJcblx0XHRcdFx0YXBwbHlfY2FsZW5kYXJfcHJldmlldygpO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRwcmV2aWV3X2ZyYW1lID0gdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0cHJldmlld19mcmFtZSA9IDA7XHJcblx0XHRcdFx0YXBwbHlfY2FsZW5kYXJfcHJldmlldygpO1xyXG5cdFx0XHR9LCAwICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzY2hlZHVsZV9wcmV2aWV3X3JlZnJlc2goIGRlbGF5ICkge1xyXG5cdFx0Y2xlYXJUaW1lb3V0KCBwcmV2aWV3X3RpbWVyICk7XHJcblx0XHRkZWxheSA9IHBhcnNlSW50KCBkZWxheSwgMTAgKSB8fCAwO1xyXG5cclxuXHRcdGlmICggZGVsYXkgPiAwICkge1xyXG5cdFx0XHRwcmV2aWV3X3RpbWVyID0gc2V0VGltZW91dCggcXVldWVfcHJldmlld19yZWZyZXNoLCBkZWxheSApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0cXVldWVfcHJldmlld19yZWZyZXNoKCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB1cGRhdGVfaGludHMoIGhpbnRzICkge1xyXG5cdFx0aWYgKCAhIGhpbnRzICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCB0eXBlb2YgaGludHMuYm9va2luZ191bmF2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5X19oaW50ICE9PSAndW5kZWZpbmVkJyApIHtcclxuXHRcdFx0JCggJ1tkYXRhLXdwYmMtYWctaGludD1cImJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheVwiXScgKS5odG1sKFxyXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIndwYmNfYWdfaGludF91bmF2YWlsYWJsZVwiPicgKyAkKCAnW2RhdGEtd3BiYy1hZy1oaW50PVwiYm9va2luZ191bmF2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5XCJdIC53cGJjX2FnX2hpbnRfdW5hdmFpbGFibGUnICkuZmlyc3QoKS50ZXh0KCkgKyAnPC9zcGFuPicgK1xyXG5cdFx0XHRcdGhpbnRzLmJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheV9faGludFxyXG5cdFx0XHQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggdHlwZW9mIGhpbnRzLmJvb2tpbmdfYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXlfX2hpbnQgIT09ICd1bmRlZmluZWQnICkge1xyXG5cdFx0XHQkKCAnW2RhdGEtd3BiYy1hZy1oaW50PVwiYm9va2luZ19hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheVwiXScgKS5odG1sKFxyXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIndwYmNfYWdfaGludF9hdmFpbGFibGVcIj4nICsgJCggJ1tkYXRhLXdwYmMtYWctaGludD1cImJvb2tpbmdfYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXlcIl0gLndwYmNfYWdfaGludF9hdmFpbGFibGUnICkuZmlyc3QoKS50ZXh0KCkgKyAnPC9zcGFuPicgK1xyXG5cdFx0XHRcdGhpbnRzLmJvb2tpbmdfYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXlfX2hpbnRcclxuXHRcdFx0KTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNob3dfbWVzc2FnZSggbWVzc2FnZSwgdHlwZSwgZHVyYXRpb24gKSB7XHJcblx0XHRpZiAoIHR5cGVvZiB3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHR3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCBtZXNzYWdlLCB0eXBlIHx8ICdpbmZvJywgZHVyYXRpb24gfHwgMjAwMCwgZmFsc2UgKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHcuYWxlcnQoIG1lc3NhZ2UgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNldF9idXN5KCAkYnV0dG9uLCBidXN5ICkge1xyXG5cdFx0dmFyIGJ1c3lfdGV4dDtcclxuXHJcblx0XHRpZiAoICEgJGJ1dHRvbiB8fCAhICRidXR0b24ubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBidXN5ICkge1xyXG5cdFx0XHRpZiAoICEgJGJ1dHRvbi5kYXRhKCAnd3BiYy1hZy1vcmlnaW5hbC1odG1sJyApICkge1xyXG5cdFx0XHRcdCRidXR0b24uZGF0YSggJ3dwYmMtYWctb3JpZ2luYWwtaHRtbCcsICRidXR0b24uaHRtbCgpICk7XHJcblx0XHRcdH1cclxuXHRcdFx0YnVzeV90ZXh0ID0gJGJ1dHRvbi5kYXRhKCAnd3BiYy11LWJ1c3ktdGV4dCcgKSB8fCAoIGNmZy5pMThuICYmIGNmZy5pMThuLnNhdmluZyApIHx8ICdTYXZpbmcuLi4nO1xyXG5cdFx0XHQkYnV0dG9uLmFkZENsYXNzKCAnd3BiY19hZ19pc19zYXZpbmcnICkuYXR0ciggJ2FyaWEtYnVzeScsICd0cnVlJyApLmh0bWwoICc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX3JvdGF0ZV9yaWdodCB3cGJjX3NwaW5cIj48L2k+PHNwYW4gY2xhc3M9XCJpbi1idXR0b24tdGV4dFwiPiZuYnNwOyZuYnNwOycgKyBidXN5X3RleHQgKyAnPC9zcGFuPicgKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdCRidXR0b24ucmVtb3ZlQ2xhc3MoICd3cGJjX2FnX2lzX3NhdmluZycgKS5yZW1vdmVBdHRyKCAnYXJpYS1idXN5JyApO1xyXG5cdFx0XHRpZiAoICRidXR0b24uZGF0YSggJ3dwYmMtYWctb3JpZ2luYWwtaHRtbCcgKSApIHtcclxuXHRcdFx0XHQkYnV0dG9uLmh0bWwoICRidXR0b24uZGF0YSggJ3dwYmMtYWctb3JpZ2luYWwtaHRtbCcgKSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByZXBsYWNlX2NhbGVuZGFyX3BhbmVsKCBodG1sICkge1xyXG5cdFx0dmFyICRob2xkZXIgPSAkKCAnPGRpdiAvPicgKS5hcHBlbmQoICQucGFyc2VIVE1MKCBodG1sLCBkb2N1bWVudCwgdHJ1ZSApICk7XHJcblx0XHR2YXIgJG5ld19wYW5lbCA9ICRob2xkZXIuZmluZCggJ1tkYXRhLXdwYmMtYWctY2FsZW5kYXItcGFuZWw9XCIxXCJdJyApLmZpcnN0KCk7XHJcblx0XHR2YXIgJG9sZF9wYW5lbCA9ICQoICdbZGF0YS13cGJjLWFnLWNhbGVuZGFyLXBhbmVsPVwiMVwiXScgKS5maXJzdCgpO1xyXG5cdFx0dmFyICRzY3JpcHRzO1xyXG5cclxuXHRcdGlmICggISAkbmV3X3BhbmVsLmxlbmd0aCB8fCAhICRvbGRfcGFuZWwubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JHNjcmlwdHMgPSAkbmV3X3BhbmVsLmZpbmQoICdzY3JpcHQnICkucmVtb3ZlKCk7XHJcblx0XHQkb2xkX3BhbmVsLnJlcGxhY2VXaXRoKCAkbmV3X3BhbmVsICk7XHJcblxyXG5cdFx0JHNjcmlwdHMuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR2YXIgY29kZSA9IHRoaXMudGV4dCB8fCB0aGlzLnRleHRDb250ZW50IHx8IHRoaXMuaW5uZXJIVE1MIHx8ICcnO1xyXG5cdFx0XHR2YXIgc3JjID0gdGhpcy5zcmMgfHwgJyc7XHJcblxyXG5cdFx0XHRpZiAoIHNyYyApIHtcclxuXHRcdFx0XHQkLmFqYXgoIHtcclxuXHRcdFx0XHRcdHVybDogc3JjLFxyXG5cdFx0XHRcdFx0ZGF0YVR5cGU6ICdzY3JpcHQnLFxyXG5cdFx0XHRcdFx0Y2FjaGU6IHRydWVcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH0gZWxzZSBpZiAoIGNvZGUgKSB7XHJcblx0XHRcdFx0JC5nbG9iYWxFdmFsKCBjb2RlICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNldF9jYWxlbmRhcl9sb2FkaW5nKCBpc19sb2FkaW5nICkge1xyXG5cdFx0dmFyICRjYWxlbmRhciA9ICQoICdbZGF0YS13cGJjLWFnLWNhbGVuZGFyLXBhbmVsPVwiMVwiXScgKS5maXJzdCgpO1xyXG5cdFx0dmFyIGxvYWRpbmdfdGV4dCA9IGNmZy5pMThuICYmIGNmZy5pMThuLmxvYWRpbmcgPyBjZmcuaTE4bi5sb2FkaW5nIDogJ0xvYWRpbmcnO1xyXG5cdFx0dmFyICRsb2FkaW5nO1xyXG5cclxuXHRcdGlmICggISAkY2FsZW5kYXIubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBpc19sb2FkaW5nICkge1xyXG5cdFx0XHQkbG9hZGluZyA9ICRjYWxlbmRhci5maW5kKCAnLndwYmNfY2FsZW5kYXJfbG9hZGluZycgKS5maXJzdCgpO1xyXG5cdFx0XHRpZiAoICEgJGxvYWRpbmcubGVuZ3RoICkge1xyXG5cdFx0XHRcdCRsb2FkaW5nID0gJChcclxuXHRcdFx0XHRcdCc8ZGl2IGNsYXNzPVwid3BiY19jYWxlbmRhcl9sb2FkaW5nIHdwYmNfYWdfY2FsZW5kYXJfbG9hZGluZ1wiPicgK1xyXG5cdFx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJ3cGJjX2ljbl9hdXRvcmVuZXcgd3BiY19zcGluXCI+PC9zcGFuPiZuYnNwOyZuYnNwOycgK1xyXG5cdFx0XHRcdFx0XHQnPHNwYW4+PC9zcGFuPicgK1xyXG5cdFx0XHRcdFx0JzwvZGl2PidcclxuXHRcdFx0XHQpO1xyXG5cdFx0XHRcdCRsb2FkaW5nLmZpbmQoICdzcGFuJyApLmxhc3QoKS50ZXh0KCBsb2FkaW5nX3RleHQgKyAnLi4uJyApO1xyXG5cdFx0XHRcdCRjYWxlbmRhci5hcHBlbmQoICRsb2FkaW5nICk7XHJcblx0XHRcdH1cclxuXHRcdFx0JGNhbGVuZGFyLmFkZENsYXNzKCAnaXMtbG9hZGluZycgKS5hdHRyKCAnYXJpYS1idXN5JywgJ3RydWUnICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHQkY2FsZW5kYXIucmVtb3ZlQ2xhc3MoICdpcy1sb2FkaW5nJyApLnJlbW92ZUF0dHIoICdhcmlhLWJ1c3knICk7XHJcblx0XHRcdCRjYWxlbmRhci5maW5kKCAnLndwYmNfY2FsZW5kYXJfbG9hZGluZycgKS5yZW1vdmUoKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9wcmV2aWV3X3BheWxvYWQoKSB7XHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRhY3Rpb246IGNmZy5wcmV2aWV3X2FjdGlvbiB8fCAnV1BCQ19BSlhfQVZBSUxBQklMSVRZX0dFTkVSQUxfUFJFVklFVycsXHJcblx0XHRcdG5vbmNlOiBjZmcubm9uY2UgfHwgJycsXHJcblx0XHRcdHJlc291cmNlX2lkOiAkKCAnI3dwYmNfYWdfcmVzb3VyY2VfaWQnICkudmFsKCkgfHwgJycsXHJcblx0XHRcdG1vbnRoc19jb3VudDogJCggJyN3cGJjX2FnX21vbnRoc19jb3VudCcgKS52YWwoKSB8fCAnJ1xyXG5cdFx0fTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGxvYWRfY2FsZW5kYXJfcHJldmlldygpIHtcclxuXHRcdHZhciAkY2FsZW5kYXIgPSAkKCAnW2RhdGEtd3BiYy1hZy1jYWxlbmRhci1wYW5lbD1cIjFcIl0nICkuZmlyc3QoKTtcclxuXHRcdHZhciBjdXJyZW50X3ByZXZpZXdfYWpheDtcclxuXHJcblx0XHRpZiAoICEgY2ZnLmFqYXhfdXJsICkge1xyXG5cdFx0XHRzaG93X21lc3NhZ2UoICggY2ZnLmkxOG4gJiYgY2ZnLmkxOG4ucHJldmlld19mYWlsZWQgKSB8fCAnVW5hYmxlIHRvIHJlZnJlc2ggY2FsZW5kYXIgcHJldmlldy4nLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBwcmV2aWV3X2FqYXggJiYgcHJldmlld19hamF4LnJlYWR5U3RhdGUgIT09IDQgKSB7XHJcblx0XHRcdHByZXZpZXdfYWpheC5hYm9ydCgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHNldF9jYWxlbmRhcl9sb2FkaW5nKCB0cnVlICk7XHJcblxyXG5cdFx0Y3VycmVudF9wcmV2aWV3X2FqYXggPSAkLmFqYXgoIHtcclxuXHRcdFx0dXJsOiBjZmcuYWpheF91cmwsXHJcblx0XHRcdG1ldGhvZDogJ1BPU1QnLFxyXG5cdFx0XHRkYXRhVHlwZTogJ2pzb24nLFxyXG5cdFx0XHRkYXRhOiBnZXRfcHJldmlld19wYXlsb2FkKClcclxuXHRcdH0gKTtcclxuXHRcdHByZXZpZXdfYWpheCA9IGN1cnJlbnRfcHJldmlld19hamF4O1xyXG5cclxuXHRcdGN1cnJlbnRfcHJldmlld19hamF4LmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XHJcblx0XHRcdGlmICggISByZXNwb25zZSB8fCAhIHJlc3BvbnNlLnN1Y2Nlc3MgfHwgISByZXNwb25zZS5kYXRhIHx8ICEgcmVzcG9uc2UuZGF0YS5odG1sICkge1xyXG5cdFx0XHRcdHNob3dfbWVzc2FnZSggKCByZXNwb25zZSAmJiByZXNwb25zZS5kYXRhICYmIHJlc3BvbnNlLmRhdGEubWVzc2FnZSApIHx8ICggY2ZnLmkxOG4gJiYgY2ZnLmkxOG4ucHJldmlld19mYWlsZWQgKSB8fCAnVW5hYmxlIHRvIHJlZnJlc2ggY2FsZW5kYXIgcHJldmlldy4nLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmVwbGFjZV9jYWxlbmRhcl9wYW5lbCggcmVzcG9uc2UuZGF0YS5odG1sICk7XHJcblx0XHRcdCQoICdbZGF0YS13cGJjLWFnLXBhZ2U9XCIxXCJdJyApLmF0dHIoICdkYXRhLXdwYmMtYWctcmVzb3VyY2UtaWQnLCByZXNwb25zZS5kYXRhLnJlc291cmNlX2lkIHx8ICcnICk7XHJcblx0XHRcdG9ic2VydmVfY2FsZW5kYXJfY2hhbmdlcygpO1xyXG5cdFx0XHRzY2hlZHVsZV9wcmV2aWV3X3JlZnJlc2goKTtcclxuXHRcdFx0c2V0VGltZW91dCggc2NoZWR1bGVfcHJldmlld19yZWZyZXNoLCA2MDAgKTtcclxuXHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIGpxX3hociwgdGV4dF9zdGF0dXMgKSB7XHJcblx0XHRcdGlmICggdGV4dF9zdGF0dXMgIT09ICdhYm9ydCcgKSB7XHJcblx0XHRcdFx0c2hvd19tZXNzYWdlKCAoIGNmZy5pMThuICYmIGNmZy5pMThuLnByZXZpZXdfZmFpbGVkICkgfHwgJ1VuYWJsZSB0byByZWZyZXNoIGNhbGVuZGFyIHByZXZpZXcuJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApLmFsd2F5cyggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRpZiAoIHByZXZpZXdfYWpheCA9PT0gY3VycmVudF9wcmV2aWV3X2FqYXggKSB7XHJcblx0XHRcdFx0c2V0X2NhbGVuZGFyX2xvYWRpbmcoIGZhbHNlICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNhdmVfc2V0dGluZ3MoIGJ1dHRvbiApIHtcclxuXHRcdHZhciAkYnV0dG9uID0gJCggYnV0dG9uICk7XHJcblx0XHR2YXIgc2V0dGluZ3MgPSBjb2xsZWN0X3NldHRpbmdzKCk7XHJcblx0XHR2YXIgcGF5bG9hZCA9ICQuZXh0ZW5kKCB7fSwgc2V0dGluZ3MsIHtcclxuXHRcdFx0YWN0aW9uOiBjZmcuYWN0aW9uIHx8ICdXUEJDX0FKWF9BVkFJTEFCSUxJVFlfR0VORVJBTF9TQVZFJyxcclxuXHRcdFx0bm9uY2U6IGNmZy5ub25jZSB8fCAnJyxcclxuXHRcdFx0Ym9va2luZ191bmF2YWlsYWJsZV9kYXlzOiBzZXR0aW5ncy53ZWVrZGF5c1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdGFwcGVuZF93b3JraW5nX3RpbWVfcGF5bG9hZCggcGF5bG9hZCApO1xyXG5cclxuXHRcdGlmICggISBjZmcuYWpheF91cmwgKSB7XHJcblx0XHRcdHNob3dfbWVzc2FnZSggKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5zYXZlX2ZhaWxlZCApIHx8ICdVbmFibGUgdG8gc2F2ZSBnZW5lcmFsIGF2YWlsYWJpbGl0eSBzZXR0aW5ncy4nLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0c2V0X2J1c3koICRidXR0b24sIHRydWUgKTtcclxuXHJcblx0XHQkLmFqYXgoIHtcclxuXHRcdFx0dXJsOiBjZmcuYWpheF91cmwsXHJcblx0XHRcdG1ldGhvZDogJ1BPU1QnLFxyXG5cdFx0XHRkYXRhVHlwZTogJ2pzb24nLFxyXG5cdFx0XHRkYXRhOiBwYXlsb2FkXHJcblx0XHR9ICkuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcclxuXHRcdFx0aWYgKCAhIHJlc3BvbnNlIHx8ICEgcmVzcG9uc2Uuc3VjY2VzcyApIHtcclxuXHRcdFx0XHRzaG93X21lc3NhZ2UoICggcmVzcG9uc2UgJiYgcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLm1lc3NhZ2UgKSB8fCAoIGNmZy5pMThuICYmIGNmZy5pMThuLnNhdmVfZmFpbGVkICkgfHwgJ1VuYWJsZSB0byBzYXZlIGdlbmVyYWwgYXZhaWxhYmlsaXR5IHNldHRpbmdzLicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5zZXR0aW5ncyAmJiByZXNwb25zZS5kYXRhLnNldHRpbmdzLmhpbnRzICkge1xyXG5cdFx0XHRcdHVwZGF0ZV9oaW50cyggcmVzcG9uc2UuZGF0YS5zZXR0aW5ncy5oaW50cyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLnNldHRpbmdzICkge1xuXHRcdFx0XHRjZmcuc2V0dGluZ3MgPSByZXNwb25zZS5kYXRhLnNldHRpbmdzO1xuXHRcdFx0XHRpZiAoIHJlc3BvbnNlLmRhdGEuc2V0dGluZ3Mud29ya2luZ190aW1lICkge1xuXHRcdFx0XHRcdGFwcGx5X3dvcmtpbmdfdGltZV9zZXR0aW5nc190b19mb3JtKCByZXNwb25zZS5kYXRhLnNldHRpbmdzLndvcmtpbmdfdGltZSwgJCggJyN3cGJjX2FnX3Jlc291cmNlX2lkJyApLnZhbCgpICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxyXG5cdFx0XHRsb2FkX2NhbGVuZGFyX3ByZXZpZXcoKTtcclxuXHRcdFx0ZG9jdW1lbnQuZGlzcGF0Y2hFdmVudCggbmV3IEN1c3RvbUV2ZW50KCAnd3BiYzphdmFpbGFiaWxpdHktZ2VuZXJhbDpzZXR0aW5ncy1zYXZlZCcsIHtcclxuXHRcdFx0XHRkZXRhaWw6IHtcclxuXHRcdFx0XHRcdHNldHRpbmdzOiByZXNwb25zZS5kYXRhICYmIHJlc3BvbnNlLmRhdGEuc2V0dGluZ3MgPyByZXNwb25zZS5kYXRhLnNldHRpbmdzIDoge31cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKSApO1xyXG5cdFx0XHRzaG93X21lc3NhZ2UoICggcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLm1lc3NhZ2UgKSB8fCAoIGNmZy5pMThuICYmIGNmZy5pMThuLnNhdmVkICkgfHwgJ0dlbmVyYWwgYXZhaWxhYmlsaXR5IHNldHRpbmdzIHVwZGF0ZWQuJywgJ3N1Y2Nlc3MnLCAyMDAwICk7XHJcblx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCBqcV94aHIgKSB7XG5cdFx0XHR2YXIgcmVzcG9uc2VfbWVzc2FnZSA9IGpxX3hociAmJiBqcV94aHIucmVzcG9uc2VKU09OICYmIGpxX3hoci5yZXNwb25zZUpTT04uZGF0YSAmJiBqcV94aHIucmVzcG9uc2VKU09OLmRhdGEubWVzc2FnZVxuXHRcdFx0XHQ/IGpxX3hoci5yZXNwb25zZUpTT04uZGF0YS5tZXNzYWdlXG5cdFx0XHRcdDogJyc7XG5cblx0XHRcdHNob3dfbWVzc2FnZSggcmVzcG9uc2VfbWVzc2FnZSB8fCAoIGNmZy5pMThuICYmIGNmZy5pMThuLnNhdmVfZmFpbGVkICkgfHwgJ1VuYWJsZSB0byBzYXZlIGdlbmVyYWwgYXZhaWxhYmlsaXR5IHNldHRpbmdzLicsICdlcnJvcicsIDEwMDAwICk7XG5cdFx0fSApLmFsd2F5cyggZnVuY3Rpb24gKCkge1xuXHRcdFx0c2V0X2J1c3koICRidXR0b24sIGZhbHNlICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByZXNldF9zZXR0aW5ncyggYnV0dG9uICkge1xyXG5cdFx0dmFyIGNvbmZpcm1fbWVzc2FnZSA9ICggY2ZnLmkxOG4gJiYgY2ZnLmkxOG4ucmVzZXRfY29uZmlybSApIHx8ICdSZXNldCBnZW5lcmFsIGF2YWlsYWJpbGl0eSBzZXR0aW5ncyB0byBkZWZhdWx0IHZhbHVlcz8nO1xyXG5cdFx0dmFyIGRlZmF1bHRfc2V0dGluZ3MgPSBjZmcuZGVmYXVsdF9zZXR0aW5ncyB8fCB7XHJcblx0XHRcdHdlZWtkYXlzOiBbXSxcclxuXHRcdFx0Ym9va2luZ191bmF2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5OiAnMCcsXHJcblx0XHRcdGJvb2tpbmdfYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXk6ICcnLFxyXG5cdFx0XHRib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2luX291dDogJycsXHJcblx0XHRcdGJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfbWludXRlc19pbjogJycsXHJcblx0XHRcdGJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfbWludXRlc19vdXQ6ICcnLFxyXG5cdFx0XHRib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfaW46ICcnLFxyXG5cdFx0XHRib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfb3V0OiAnJyxcclxuXHRcdFx0d29ya2luZ190aW1lOiB7fVxyXG5cdFx0fTtcclxuXHJcblx0XHRpZiAoICEgdy5jb25maXJtKCBjb25maXJtX21lc3NhZ2UgKSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGFwcGx5X3NldHRpbmdzX3RvX2Zvcm0oIGRlZmF1bHRfc2V0dGluZ3MgKTtcclxuXHRcdGxvYWRfY2FsZW5kYXJfcHJldmlldygpO1xyXG5cdFx0c2hvd19tZXNzYWdlKCAoIGNmZy5pMThuICYmIGNmZy5pMThuLnJlc2V0X2FwcGxpZWQgKSB8fCAnRGVmYXVsdCBhdmFpbGFiaWxpdHkgc2V0dGluZ3MgYXJlIHJlYWR5IGZvciBwcmV2aWV3LiBDbGljayBTYXZlIENoYW5nZXMgdG8gYXBwbHkgdGhlbS4nLCAnc3VjY2VzcycsIDQwMDAgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIG9ic2VydmVfY2FsZW5kYXJfY2hhbmdlcygpIHtcclxuXHRcdHZhciB0YXJnZXQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1hZy1jYWxlbmRhci1wYW5lbD1cIjFcIl0nICk7XHJcblxyXG5cdFx0aWYgKCAhIHRhcmdldCB8fCAhIHcuTXV0YXRpb25PYnNlcnZlciApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggb2JzZXJ2ZXIgKSB7XHJcblx0XHRcdG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcclxuXHRcdH1cclxuXHJcblx0XHRvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCBzY2hlZHVsZV9wcmV2aWV3X3JlZnJlc2ggKTtcclxuXHRcdG9ic2VydmVyLm9ic2VydmUoIHRhcmdldCwge1xyXG5cdFx0XHRjaGlsZExpc3Q6IHRydWUsXHJcblx0XHRcdHN1YnRyZWU6IHRydWVcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19hZ19yaWdodGJhcl90YWJzIFtyb2xlPVwidGFiXCJdJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0c3dpdGNoX3BhbmVsKCAkKCB0aGlzICkgKTtcclxuXHR9ICk7XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19hZ19yaWdodGJhcl9wYW5lbHMgLmdyb3VwX19oZWFkZXInLCBmdW5jdGlvbiAoKSB7XHJcblx0XHR0b2dnbGVfZ3JvdXAoICQoIHRoaXMgKSApO1xyXG5cdH0gKTtcclxuXHJcblx0JCggZG9jdW1lbnQgKS5vbiggJ3N1Ym1pdCcsICdbZGF0YS13cGJjLWFnLXByZXZpZXctdG9vbGJhcj1cIjFcIl0nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdGxvYWRfY2FsZW5kYXJfcHJldmlldygpO1xyXG5cdH0gKTtcclxuXHJcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICcjd3BiY19hZ19yZXNvdXJjZV9pZCwgI3dwYmNfYWdfbW9udGhzX2NvdW50JywgbG9hZF9jYWxlbmRhcl9wcmV2aWV3ICk7XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnI3dwYmNfYWdfcmVzb3VyY2VfaWQnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRjZmcuc2V0dGluZ3MgPSBjZmcuc2V0dGluZ3MgfHwge307XHJcblx0XHRjZmcuc2V0dGluZ3Mud29ya2luZ190aW1lID0gZ2V0X3dvcmtpbmdfdGltZV9zZXR0aW5nc19mcm9tX2Zvcm0oKTtcclxuXHRcdGFwcGx5X3dvcmtpbmdfdGltZV9zZXR0aW5nc190b19mb3JtKCBjZmcuc2V0dGluZ3Mud29ya2luZ190aW1lLCAkKCB0aGlzICkudmFsKCkgKTtcclxuXHR9ICk7XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdpbnB1dCBjaGFuZ2UnLCAnW2RhdGEtd3BiYy1hZy1yYW5nZS1mb3JdJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0c3luY19zZWxlY3RfZnJvbV9yYW5nZSggdGhpcyApO1xyXG5cdFx0c2NoZWR1bGVfcHJldmlld19yZWZyZXNoKCk7XHJcblx0fSApO1xyXG5cclxuXHQkKCBkb2N1bWVudCApLm9uKCAnY2hhbmdlJywgJ1tkYXRhLXdwYmMtYWctc2V0dGluZ3MtZm9ybT1cIjFcIl0gc2VsZWN0JywgZnVuY3Rpb24gKCkge1xyXG5cdFx0c3luY19yYW5nZV9mcm9tX3NlbGVjdCggdGhpcyApO1xyXG5cdH0gKTtcclxuXHJcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJ1tkYXRhLXdwYmMtYWctc3RlcHBlcl0nLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRzdGVwX3NlbGVjdF92YWx1ZSggdGhpcyApO1xyXG5cdH0gKTtcclxuXHJcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICdpbnB1dFtuYW1lPVwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9pbl9vdXRcIl0nLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZWZyZXNoX2J1ZmZlcl9maWVsZHMoKTtcclxuXHRcdHNjaGVkdWxlX3ByZXZpZXdfcmVmcmVzaCgpO1xyXG5cdH0gKTtcclxuXHJcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICdpbnB1dFtuYW1lPVwiYm9va2luZ193b3JraW5nX3RpbWVfZW5hYmxlZFwiXScsIHJlZnJlc2hfd29ya2luZ190aW1lX3BhbmVscyApO1xyXG5cclxuXHQkKCBkb2N1bWVudCApLm9uKCAnY2hhbmdlJywgJ2lucHV0W25hbWU9XCJib29raW5nX3dvcmtpbmdfdGltZV9yZXNvdXJjZV9tb2RlXCJdJywgcmVmcmVzaF93b3JraW5nX3RpbWVfcGFuZWxzICk7XG5cblx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICdbZGF0YS13cGJjLXdvcmtpbmctdGltZS1kYXktdG9nZ2xlPVwiMVwiXScsIGZ1bmN0aW9uICgpIHtcblx0XHRyZWZyZXNoX3dvcmtpbmdfdGltZV9kYXkoICQoIHRoaXMgKS5jbG9zZXN0KCAnW2RhdGEtd3BiYy13b3JraW5nLXRpbWUtZGF5XScgKSApO1xuXHR9ICk7XG5cblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJ1tkYXRhLXdwYmMtYWRkLXdvcmtpbmctdGltZS1pbnRlcnZhbD1cIjFcIl0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0YWRkX3dvcmtpbmdfdGltZV9pbnRlcnZhbCggdGhpcyApO1xuXHR9ICk7XG5cblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJ1tkYXRhLXdwYmMtcmVtb3ZlLXdvcmtpbmctdGltZS1pbnRlcnZhbD1cIjFcIl0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0cmVtb3ZlX3dvcmtpbmdfdGltZV9pbnRlcnZhbCggdGhpcyApO1xuXHR9ICk7XG5cclxuXHQkKCBkb2N1bWVudCApLm9uKCAnY2hhbmdlJywgJ1tkYXRhLXdwYmMtYWctc2V0dGluZ3MtZm9ybT1cIjFcIl0gaW5wdXQsIFtkYXRhLXdwYmMtYWctc2V0dGluZ3MtZm9ybT1cIjFcIl0gc2VsZWN0Jywgc2NoZWR1bGVfcHJldmlld19yZWZyZXNoICk7XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdzdWJtaXQnLCAnW2RhdGEtd3BiYy1hZy1zZXR0aW5ncy1mb3JtPVwiMVwiXScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0c2F2ZV9zZXR0aW5ncyggJCggJ1tkYXRhLXdwYmMtYWctc2F2ZT1cIjFcIl0nICkuZmlyc3QoKSApO1xyXG5cdH0gKTtcclxuXHJcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJ1tkYXRhLXdwYmMtYWctc2F2ZT1cIjFcIl0nLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRzYXZlX3NldHRpbmdzKCB0aGlzICk7XHJcblx0fSApO1xyXG5cclxuXHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnW2RhdGEtd3BiYy1hZy1yZXNldD1cIjFcIl0nLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXNldF9zZXR0aW5ncyggdGhpcyApO1xyXG5cdH0gKTtcclxuXHJcblx0JCggZG9jdW1lbnQgKS5yZWFkeSggZnVuY3Rpb24gKCkge1xyXG5cdFx0YXBwbHlfd29ya2luZ190aW1lX3NldHRpbmdzX3RvX2Zvcm0oICggY2ZnLnNldHRpbmdzICYmIGNmZy5zZXR0aW5ncy53b3JraW5nX3RpbWUgKSB8fCAoIGNmZy5kZWZhdWx0X3NldHRpbmdzICYmIGNmZy5kZWZhdWx0X3NldHRpbmdzLndvcmtpbmdfdGltZSApIHx8IHt9LCAkKCAnI3dwYmNfYWdfcmVzb3VyY2VfaWQnICkudmFsKCkgKTtcclxuXHRcdGFwcGx5X29wZW5fc2VjdGlvbl9mcm9tX3VybCgpO1xyXG5cdFx0cmVmcmVzaF9idWZmZXJfZmllbGRzKCk7XHJcblx0XHRzeW5jX2FsbF9yYW5nZXMoKTtcclxuXHRcdG9ic2VydmVfY2FsZW5kYXJfY2hhbmdlcygpO1xyXG5cdFx0c2NoZWR1bGVfcHJldmlld19yZWZyZXNoKCk7XHJcblx0XHRzZXRUaW1lb3V0KCBzY2hlZHVsZV9wcmV2aWV3X3JlZnJlc2gsIDYwMCApO1xyXG5cdH0gKTtcclxufSggalF1ZXJ5LCB3aW5kb3cg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
