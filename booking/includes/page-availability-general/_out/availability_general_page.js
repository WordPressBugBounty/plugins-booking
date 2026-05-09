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
      booking_unavailable_extra_days_out: $form.find('[name="booking_unavailable_extra_days_out"]').val() || ''
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
      booking_unavailable_extra_days_out: ''
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
    refresh_buffer_fields();
    sync_all_ranges();
    observe_calendar_changes();
    schedule_preview_refresh();
    setTimeout(schedule_preview_refresh, 600);
  });
})(jQuery, window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1hdmFpbGFiaWxpdHktZ2VuZXJhbC9fb3V0L2F2YWlsYWJpbGl0eV9nZW5lcmFsX3BhZ2UuanMiLCJuYW1lcyI6WyIkIiwidyIsImNmZyIsIndwYmNfYXZhaWxhYmlsaXR5X2dlbmVyYWxfcGFnZSIsInByZXZpZXdfdGltZXIiLCJwcmV2aWV3X2ZyYW1lIiwicHJldmlld19hamF4Iiwib2JzZXJ2ZXIiLCJwcmV2aWV3X3VuYXZhaWxhYmxlX2NsYXNzZXMiLCJ0cmltX3RleHQiLCJ2YWx1ZSIsIlN0cmluZyIsInRyaW0iLCJzd2l0Y2hfcGFuZWwiLCIkdGFiIiwicGFuZWxfaWQiLCJhdHRyIiwiJHRhYnMiLCJjbG9zZXN0IiwiZmluZCIsIiRwYW5lbHMiLCJyZW1vdmVBdHRyIiwidG9nZ2xlX2dyb3VwIiwiJGJ1dHRvbiIsIiRncm91cCIsIiRmaWVsZHMiLCJpc19vcGVuIiwiaGFzQ2xhc3MiLCJ0b2dnbGVDbGFzcyIsInByb3AiLCJyZWZyZXNoX2J1ZmZlcl9maWVsZHMiLCJ2YWwiLCJlYWNoIiwiJHBhbmVsIiwiZGF0YSIsImlzX2J1ZmZlcl9hdmFpbGFibGUiLCJpc19hdmFpbGFibGVfbGltaXRfYXZhaWxhYmxlIiwic3luY19yYW5nZV9mcm9tX3NlbGVjdCIsInNlbGVjdCIsIiRzZWxlY3QiLCJuYW1lIiwic2VsZWN0ZWRfaW5kZXgiLCJzZWxlY3RlZF90ZXh0IiwidGV4dCIsIiRyYW5nZSIsIiR2YWx1ZSIsImxlbmd0aCIsInN5bmNfc2VsZWN0X2Zyb21fcmFuZ2UiLCJyYW5nZSIsImluZGV4IiwicGFyc2VJbnQiLCJzeW5jX2FsbF9yYW5nZXMiLCJmaXJzdCIsInN0ZXBfc2VsZWN0X3ZhbHVlIiwiYnV0dG9uIiwic3RlcCIsImN1cnJlbnRfaW5kZXgiLCJuZXh0X2luZGV4IiwiTWF0aCIsIm1heCIsIm1pbiIsInRyaWdnZXIiLCJnZXRfZm9ybSIsImNvbGxlY3Rfc2V0dGluZ3MiLCIkZm9ybSIsIndlZWtkYXlzIiwicHVzaCIsImJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheSIsImJvb2tpbmdfYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXkiLCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2luX291dCIsImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfbWludXRlc19pbiIsImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfbWludXRlc19vdXQiLCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfaW4iLCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfb3V0Iiwic2V0X3NlbGVjdF92YWx1ZSIsIiRmaWVsZCIsImFwcGx5X3NldHRpbmdzX3RvX2Zvcm0iLCJzZXR0aW5ncyIsImRheV9udW0iLCJzY2hlZHVsZV9wcmV2aWV3X3JlZnJlc2giLCJkYXRlX2Zyb21fc3FsIiwic3FsX2RhdGUiLCJwYXJ0cyIsInNwbGl0IiwiRGF0ZSIsImdldF90b2RheV9kYXRlIiwiYXJyIiwiX3dwYmMiLCJnZXRfb3RoZXJfcGFyYW0iLCJub3ciLCJnZXRGdWxsWWVhciIsImdldE1vbnRoIiwiZ2V0RGF0ZSIsImdldF9yZWFsX3RvZGF5X2RhdGUiLCJkYXlzX2JldHdlZW4iLCJkYXRlX2EiLCJkYXRlX2IiLCJmbG9vciIsImdldFRpbWUiLCJhZGRfZGF5cyIsImRhdGUiLCJkYXlzIiwic2hpZnRlZF9kYXRlIiwic2V0RGF0ZSIsImRhdGVfdG9fc3FsIiwibW9udGgiLCJkYXkiLCJnZXRfc3FsX2RhdGVfZnJvbV9jZWxsIiwiY2VsbCIsImNsYXNzZXMiLCJjbGFzc05hbWUiLCJpIiwiaW5kZXhPZiIsInJlcGxhY2UiLCJ1bmF2YWlsYWJsZV9mcm9tX3RvZGF5X2FwcGxpZXMiLCJjZWxsX2RhdGUiLCJ0b2RheV9kYXRlIiwibWludXRlcyIsInVuYXZhaWxhYmxlX3VudGlsIiwidGVzdCIsImdldF9vcHRpb25fdGV4dCIsInNlbGVjdG9yIiwiZ2V0X2RheXNfdmFsdWUiLCJ1cGRhdGVfd3BiY19wcmV2aWV3X3BhcmFtcyIsInNldF9vdGhlcl9wYXJhbSIsImNvbmNhdCIsInVwZGF0ZV9idWZmZXJfcHJldmlld19ub3RlIiwiJG5vdGVzIiwiJGNhbGVuZGFyIiwiJG5vdGUiLCJ0eXBlIiwiYmVmb3JlX3RleHQiLCJhZnRlcl90ZXh0IiwibWVzc2FnZSIsImFwcGVuZCIsInJlbW92ZUNsYXNzIiwiaTE4biIsImJ1ZmZlcl9wcmV2aWV3IiwiYmVmb3JlX2Jvb2tpbmciLCJhZnRlcl9ib29raW5nIiwiaHRtbCIsIm5vX2J1ZmZlciIsImFwcGx5X2J1ZmZlcl9kYXlzX3ByZXZpZXciLCJiZWZvcmVfZGF5cyIsImFmdGVyX2RheXMiLCJkYXRlX2NlbGxzIiwiYm9va2VkX2RhdGVzIiwiJGNlbGwiLCJib29rZWRfZGF0ZSIsIm9mZnNldCIsInRhcmdldF9zcWxfZGF0ZSIsIiR0YXJnZXRfY2VsbCIsInJlbWVtYmVyX3ByZXZpZXdfb3JpZ2luIiwiYWRkQ2xhc3MiLCJjbGVhcl9wcmV2aWV3X2NlbGwiLCJoYWRfZGF0ZV91c2VyX3VuYXZhaWxhYmxlIiwiYXBwbHlfY2FsZW5kYXJfcHJldmlldyIsImF2YWlsYWJsZV9saW1pdCIsIm1ha2VfdW5hdmFpbGFibGUiLCJyZWFzb25fY2xhc3MiLCJwcmV2aW91c19yZWFzb24iLCJoYWRfZ2VuZXJhbF9wcmV2aWV3IiwiZ2V0RGF5IiwicXVldWVfcHJldmlld19yZWZyZXNoIiwicmVxdWVzdEFuaW1hdGlvbkZyYW1lIiwic2V0VGltZW91dCIsImRlbGF5IiwiY2xlYXJUaW1lb3V0IiwidXBkYXRlX2hpbnRzIiwiaGludHMiLCJib29raW5nX3VuYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXlfX2hpbnQiLCJib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5X19oaW50Iiwic2hvd19tZXNzYWdlIiwiZHVyYXRpb24iLCJ3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSIsImFsZXJ0Iiwic2V0X2J1c3kiLCJidXN5IiwiYnVzeV90ZXh0Iiwic2F2aW5nIiwicmVwbGFjZV9jYWxlbmRhcl9wYW5lbCIsIiRob2xkZXIiLCJwYXJzZUhUTUwiLCJkb2N1bWVudCIsIiRuZXdfcGFuZWwiLCIkb2xkX3BhbmVsIiwiJHNjcmlwdHMiLCJyZW1vdmUiLCJyZXBsYWNlV2l0aCIsImNvZGUiLCJ0ZXh0Q29udGVudCIsImlubmVySFRNTCIsInNyYyIsImFqYXgiLCJ1cmwiLCJkYXRhVHlwZSIsImNhY2hlIiwiZ2xvYmFsRXZhbCIsInNldF9jYWxlbmRhcl9sb2FkaW5nIiwiaXNfbG9hZGluZyIsImxvYWRpbmdfdGV4dCIsImxvYWRpbmciLCIkbG9hZGluZyIsImxhc3QiLCJnZXRfcHJldmlld19wYXlsb2FkIiwiYWN0aW9uIiwicHJldmlld19hY3Rpb24iLCJub25jZSIsInJlc291cmNlX2lkIiwibW9udGhzX2NvdW50IiwibG9hZF9jYWxlbmRhcl9wcmV2aWV3IiwiY3VycmVudF9wcmV2aWV3X2FqYXgiLCJhamF4X3VybCIsInByZXZpZXdfZmFpbGVkIiwicmVhZHlTdGF0ZSIsImFib3J0IiwibWV0aG9kIiwiZG9uZSIsInJlc3BvbnNlIiwic3VjY2VzcyIsIm9ic2VydmVfY2FsZW5kYXJfY2hhbmdlcyIsImZhaWwiLCJqcV94aHIiLCJ0ZXh0X3N0YXR1cyIsImFsd2F5cyIsInNhdmVfc2V0dGluZ3MiLCJwYXlsb2FkIiwiZXh0ZW5kIiwiYm9va2luZ191bmF2YWlsYWJsZV9kYXlzIiwic2F2ZV9mYWlsZWQiLCJzYXZlZCIsInJlc2V0X3NldHRpbmdzIiwiY29uZmlybV9tZXNzYWdlIiwicmVzZXRfY29uZmlybSIsImRlZmF1bHRfc2V0dGluZ3MiLCJjb25maXJtIiwicmVzZXRfYXBwbGllZCIsInRhcmdldCIsInF1ZXJ5U2VsZWN0b3IiLCJNdXRhdGlvbk9ic2VydmVyIiwiZGlzY29ubmVjdCIsIm9ic2VydmUiLCJjaGlsZExpc3QiLCJzdWJ0cmVlIiwib24iLCJldmVudCIsInByZXZlbnREZWZhdWx0IiwicmVhZHkiLCJqUXVlcnkiLCJ3aW5kb3ciXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWF2YWlsYWJpbGl0eS1nZW5lcmFsL19zcmMvYXZhaWxhYmlsaXR5X2dlbmVyYWxfcGFnZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogR2VuZXJhbCBBdmFpbGFiaWxpdHkgVUkuXHJcbiAqL1xyXG4oIGZ1bmN0aW9uICggJCwgdyApIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdHZhciBjZmcgPSB3LndwYmNfYXZhaWxhYmlsaXR5X2dlbmVyYWxfcGFnZSB8fCB7fTtcclxuXHR2YXIgcHJldmlld190aW1lciA9IDA7XHJcblx0dmFyIHByZXZpZXdfZnJhbWUgPSAwO1xyXG5cdHZhciBwcmV2aWV3X2FqYXggPSBudWxsO1xyXG5cdHZhciBvYnNlcnZlciA9IG51bGw7XHJcblx0dmFyIHByZXZpZXdfdW5hdmFpbGFibGVfY2xhc3NlcyA9ICd3cGJjX2FnX3ByZXZpZXdfdW5hdmFpbGFibGUgd3BiY19hZ19wcmV2aWV3X3dlZWtkYXlfdW5hdmFpbGFibGUgd3BiY19hZ19wcmV2aWV3X2Zyb21fdG9kYXlfdW5hdmFpbGFibGUgd3BiY19hZ19wcmV2aWV3X2xpbWl0X2F2YWlsYWJsZV9mcm9tX3RvZGF5IHdwYmNfYWdfcHJldmlld19idWZmZXJfdW5hdmFpbGFibGUgd2Vla2RheV91bmF2YWlsYWJsZSBmcm9tX3RvZGF5X3VuYXZhaWxhYmxlIGxpbWl0X2F2YWlsYWJsZV9mcm9tX3RvZGF5IGJ1ZmZlcl91bmF2YWlsYWJsZSc7XHJcblxyXG5cdGZ1bmN0aW9uIHRyaW1fdGV4dCggdmFsdWUgKSB7XHJcblx0XHRyZXR1cm4gU3RyaW5nKCB2YWx1ZSB8fCAnJyApLnRyaW0oKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHN3aXRjaF9wYW5lbCggJHRhYiApIHtcclxuXHRcdHZhciBwYW5lbF9pZCA9ICR0YWIuYXR0ciggJ2FyaWEtY29udHJvbHMnICk7XHJcblx0XHR2YXIgJHRhYnMgPSAkdGFiLmNsb3Nlc3QoICcud3BiY19hZ19yaWdodGJhcl90YWJzJyApLmZpbmQoICdbcm9sZT1cInRhYlwiXScgKTtcclxuXHRcdHZhciAkcGFuZWxzID0gJCggJy53cGJjX2FnX3JpZ2h0YmFyX3BhbmVscyBbcm9sZT1cInRhYnBhbmVsXCJdJyApO1xyXG5cclxuXHRcdCR0YWJzLmF0dHIoICdhcmlhLXNlbGVjdGVkJywgJ2ZhbHNlJyApO1xyXG5cdFx0JHRhYi5hdHRyKCAnYXJpYS1zZWxlY3RlZCcsICd0cnVlJyApO1xyXG5cclxuXHRcdCRwYW5lbHMuYXR0ciggJ2hpZGRlbicsICdoaWRkZW4nICkuYXR0ciggJ2FyaWEtaGlkZGVuJywgJ3RydWUnICk7XHJcblx0XHQkKCAnIycgKyBwYW5lbF9pZCApLnJlbW92ZUF0dHIoICdoaWRkZW4nICkuYXR0ciggJ2FyaWEtaGlkZGVuJywgJ2ZhbHNlJyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdG9nZ2xlX2dyb3VwKCAkYnV0dG9uICkge1xyXG5cdFx0dmFyICRncm91cCA9ICRidXR0b24uY2xvc2VzdCggJy53cGJjX3VpX19jb2xsYXBzaWJsZV9ncm91cCcgKTtcclxuXHRcdHZhciAkZmllbGRzID0gJGdyb3VwLmZpbmQoICc+IC5ncm91cF9fZmllbGRzJyApO1xyXG5cdFx0dmFyIGlzX29wZW4gPSAkZ3JvdXAuaGFzQ2xhc3MoICdpcy1vcGVuJyApO1xyXG5cclxuXHRcdCRncm91cC50b2dnbGVDbGFzcyggJ2lzLW9wZW4nLCAhIGlzX29wZW4gKTtcclxuXHRcdCRidXR0b24uYXR0ciggJ2FyaWEtZXhwYW5kZWQnLCBpc19vcGVuID8gJ2ZhbHNlJyA6ICd0cnVlJyApO1xyXG5cdFx0JGZpZWxkcy5wcm9wKCAnaGlkZGVuJywgaXNfb3BlbiApLmF0dHIoICdhcmlhLWhpZGRlbicsIGlzX29wZW4gPyAndHJ1ZScgOiAnZmFsc2UnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByZWZyZXNoX2J1ZmZlcl9maWVsZHMoKSB7XHJcblx0XHR2YXIgdmFsdWUgPSAkKCAnaW5wdXRbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfaW5fb3V0XCJdOmNoZWNrZWQnICkudmFsKCkgfHwgJyc7XHJcblxyXG5cdFx0JCggJy53cGJjX2FnX2J1ZmZlcl9maWVsZHMnICkuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR2YXIgJHBhbmVsID0gJCggdGhpcyApO1xyXG5cdFx0XHQkcGFuZWwudG9nZ2xlQ2xhc3MoICdpcy12aXNpYmxlJywgJHBhbmVsLmRhdGEoICdidWZmZXItcGFuZWwnICkgPT09IHZhbHVlICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpc19idWZmZXJfYXZhaWxhYmxlKCkge1xyXG5cdFx0cmV0dXJuICEgKCBjZmcuaXNfYnVmZmVyX2F2YWlsYWJsZSA9PT0gZmFsc2UgfHwgY2ZnLmlzX2J1ZmZlcl9hdmFpbGFibGUgPT09ICdmYWxzZScgfHwgY2ZnLmlzX2J1ZmZlcl9hdmFpbGFibGUgPT09IDAgfHwgY2ZnLmlzX2J1ZmZlcl9hdmFpbGFibGUgPT09ICcwJyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaXNfYXZhaWxhYmxlX2xpbWl0X2F2YWlsYWJsZSgpIHtcclxuXHRcdHJldHVybiAhICggY2ZnLmlzX2F2YWlsYWJsZV9saW1pdF9hdmFpbGFibGUgPT09IGZhbHNlIHx8IGNmZy5pc19hdmFpbGFibGVfbGltaXRfYXZhaWxhYmxlID09PSAnZmFsc2UnIHx8IGNmZy5pc19hdmFpbGFibGVfbGltaXRfYXZhaWxhYmxlID09PSAwIHx8IGNmZy5pc19hdmFpbGFibGVfbGltaXRfYXZhaWxhYmxlID09PSAnMCcgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHN5bmNfcmFuZ2VfZnJvbV9zZWxlY3QoIHNlbGVjdCApIHtcclxuXHRcdHZhciAkc2VsZWN0ID0gJCggc2VsZWN0ICk7XHJcblx0XHR2YXIgbmFtZSA9ICRzZWxlY3QuYXR0ciggJ25hbWUnICk7XHJcblx0XHR2YXIgc2VsZWN0ZWRfaW5kZXggPSAkc2VsZWN0LnByb3AoICdzZWxlY3RlZEluZGV4JyApO1xyXG5cdFx0dmFyIHNlbGVjdGVkX3RleHQgPSB0cmltX3RleHQoICRzZWxlY3QuZmluZCggJ29wdGlvbjpzZWxlY3RlZCcgKS50ZXh0KCkgKTtcclxuXHRcdHZhciAkcmFuZ2UgPSAkKCAnW2RhdGEtd3BiYy1hZy1yYW5nZS1mb3I9XCInICsgbmFtZSArICdcIl0nICk7XHJcblx0XHR2YXIgJHZhbHVlID0gJCggJ1tkYXRhLXdwYmMtYWctcmFuZ2UtdmFsdWUtZm9yPVwiJyArIG5hbWUgKyAnXCJdJyApO1xyXG5cclxuXHRcdGlmICggISAkcmFuZ2UubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JHJhbmdlLnZhbCggc2VsZWN0ZWRfaW5kZXggPCAwID8gMCA6IHNlbGVjdGVkX2luZGV4ICk7XHJcblx0XHQkdmFsdWUudGV4dCggc2VsZWN0ZWRfdGV4dCApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc3luY19zZWxlY3RfZnJvbV9yYW5nZSggcmFuZ2UgKSB7XHJcblx0XHR2YXIgJHJhbmdlID0gJCggcmFuZ2UgKTtcclxuXHRcdHZhciBuYW1lID0gJHJhbmdlLmF0dHIoICdkYXRhLXdwYmMtYWctcmFuZ2UtZm9yJyApO1xyXG5cdFx0dmFyICRzZWxlY3QgPSAkKCAnW25hbWU9XCInICsgbmFtZSArICdcIl0nICk7XHJcblx0XHR2YXIgaW5kZXggPSBwYXJzZUludCggJHJhbmdlLnZhbCgpLCAxMCApIHx8IDA7XHJcblxyXG5cdFx0aWYgKCAhICRzZWxlY3QubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JHNlbGVjdC5wcm9wKCAnc2VsZWN0ZWRJbmRleCcsIGluZGV4ICk7XHJcblx0XHRzeW5jX3JhbmdlX2Zyb21fc2VsZWN0KCAkc2VsZWN0ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzeW5jX2FsbF9yYW5nZXMoKSB7XHJcblx0XHQkKCAnW2RhdGEtd3BiYy1hZy1yYW5nZS1mb3JdJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0dmFyIG5hbWUgPSAkKCB0aGlzICkuYXR0ciggJ2RhdGEtd3BiYy1hZy1yYW5nZS1mb3InICk7XHJcblx0XHRcdHN5bmNfcmFuZ2VfZnJvbV9zZWxlY3QoICQoICdbbmFtZT1cIicgKyBuYW1lICsgJ1wiXScgKS5maXJzdCgpICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzdGVwX3NlbGVjdF92YWx1ZSggYnV0dG9uICkge1xyXG5cdFx0dmFyICRidXR0b24gPSAkKCBidXR0b24gKTtcclxuXHRcdHZhciBuYW1lID0gJGJ1dHRvbi5hdHRyKCAnZGF0YS13cGJjLWFnLXN0ZXBwZXInICk7XHJcblx0XHR2YXIgc3RlcCA9IHBhcnNlSW50KCAkYnV0dG9uLmF0dHIoICdkYXRhLXN0ZXAnICksIDEwICkgfHwgMDtcclxuXHRcdHZhciAkc2VsZWN0ID0gJCggJ1tuYW1lPVwiJyArIG5hbWUgKyAnXCJdJyApLmZpcnN0KCk7XHJcblx0XHR2YXIgY3VycmVudF9pbmRleDtcclxuXHRcdHZhciBuZXh0X2luZGV4O1xyXG5cclxuXHRcdGlmICggISAkc2VsZWN0Lmxlbmd0aCB8fCAkc2VsZWN0LnByb3AoICdkaXNhYmxlZCcgKSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGN1cnJlbnRfaW5kZXggPSAkc2VsZWN0LnByb3AoICdzZWxlY3RlZEluZGV4JyApO1xyXG5cdFx0bmV4dF9pbmRleCA9IE1hdGgubWF4KCAwLCBNYXRoLm1pbiggJHNlbGVjdC5maW5kKCAnb3B0aW9uJyApLmxlbmd0aCAtIDEsIGN1cnJlbnRfaW5kZXggKyBzdGVwICkgKTtcclxuXHJcblx0XHRpZiAoIG5leHRfaW5kZXggPT09IGN1cnJlbnRfaW5kZXggKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQkc2VsZWN0LnByb3AoICdzZWxlY3RlZEluZGV4JywgbmV4dF9pbmRleCApLnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfZm9ybSgpIHtcclxuXHRcdHJldHVybiAkKCAnW2RhdGEtd3BiYy1hZy1zZXR0aW5ncy1mb3JtPVwiMVwiXScgKS5maXJzdCgpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gY29sbGVjdF9zZXR0aW5ncygpIHtcclxuXHRcdHZhciAkZm9ybSA9IGdldF9mb3JtKCk7XHJcblx0XHR2YXIgd2Vla2RheXMgPSBbXTtcclxuXHJcblx0XHQkZm9ybS5maW5kKCAnaW5wdXRbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c1tdXCJdOmNoZWNrZWQnICkuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR3ZWVrZGF5cy5wdXNoKCBwYXJzZUludCggdGhpcy52YWx1ZSwgMTAgKSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHdlZWtkYXlzOiB3ZWVrZGF5cyxcclxuXHRcdFx0Ym9va2luZ191bmF2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5OiAkZm9ybS5maW5kKCAnW25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXlcIl0nICkudmFsKCkgfHwgJzAnLFxyXG5cdFx0XHRib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5OiAkZm9ybS5maW5kKCAnW25hbWU9XCJib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5XCJdJyApLnZhbCgpIHx8ICcnLFxyXG5cdFx0XHRib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2luX291dDogJGZvcm0uZmluZCggJ1tuYW1lPVwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9pbl9vdXRcIl06Y2hlY2tlZCcgKS52YWwoKSB8fCAnJyxcclxuXHRcdFx0Ym9va2luZ191bmF2YWlsYWJsZV9leHRyYV9taW51dGVzX2luOiAkZm9ybS5maW5kKCAnW25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX21pbnV0ZXNfaW5cIl0nICkudmFsKCkgfHwgJycsXHJcblx0XHRcdGJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfbWludXRlc19vdXQ6ICRmb3JtLmZpbmQoICdbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfbWludXRlc19vdXRcIl0nICkudmFsKCkgfHwgJycsXHJcblx0XHRcdGJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfZGF5c19pbjogJGZvcm0uZmluZCggJ1tuYW1lPVwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9kYXlzX2luXCJdJyApLnZhbCgpIHx8ICcnLFxyXG5cdFx0XHRib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfb3V0OiAkZm9ybS5maW5kKCAnW25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfb3V0XCJdJyApLnZhbCgpIHx8ICcnXHJcblx0XHR9O1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2V0X3NlbGVjdF92YWx1ZSggbmFtZSwgdmFsdWUgKSB7XHJcblx0XHR2YXIgJGZpZWxkID0gZ2V0X2Zvcm0oKS5maW5kKCAnW25hbWU9XCInICsgbmFtZSArICdcIl0nICkuZmlyc3QoKTtcclxuXHJcblx0XHRpZiAoICEgJGZpZWxkLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRmaWVsZC52YWwoIHZhbHVlICk7XHJcblx0XHRpZiAoIFN0cmluZyggJGZpZWxkLnZhbCgpICkgIT09IFN0cmluZyggdmFsdWUgKSApIHtcclxuXHRcdFx0JGZpZWxkLnByb3AoICdzZWxlY3RlZEluZGV4JywgMCApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYXBwbHlfc2V0dGluZ3NfdG9fZm9ybSggc2V0dGluZ3MgKSB7XHJcblx0XHR2YXIgJGZvcm0gPSBnZXRfZm9ybSgpO1xyXG5cdFx0dmFyIHdlZWtkYXlzID0gc2V0dGluZ3MgJiYgc2V0dGluZ3Mud2Vla2RheXMgPyBzZXR0aW5ncy53ZWVrZGF5cyA6IFtdO1xyXG5cclxuXHRcdGlmICggISAkZm9ybS5sZW5ndGggfHwgISBzZXR0aW5ncyApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRmb3JtLmZpbmQoICdpbnB1dFtuYW1lPVwiYm9va2luZ191bmF2YWlsYWJsZV9kYXlzW11cIl0nICkucHJvcCggJ2NoZWNrZWQnLCBmYWxzZSApO1xyXG5cdFx0JC5lYWNoKCB3ZWVrZGF5cywgZnVuY3Rpb24gKCBpbmRleCwgZGF5X251bSApIHtcclxuXHRcdFx0JGZvcm0uZmluZCggJ2lucHV0W25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2RheXNbXVwiXVt2YWx1ZT1cIicgKyBwYXJzZUludCggZGF5X251bSwgMTAgKSArICdcIl0nICkucHJvcCggJ2NoZWNrZWQnLCB0cnVlICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0c2V0X3NlbGVjdF92YWx1ZSggJ2Jvb2tpbmdfdW5hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheScsIHNldHRpbmdzLmJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheSB8fCAnMCcgKTtcclxuXHRcdHNldF9zZWxlY3RfdmFsdWUoICdib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5Jywgc2V0dGluZ3MuYm9va2luZ19hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheSB8fCAnJyApO1xyXG5cdFx0c2V0X3NlbGVjdF92YWx1ZSggJ2Jvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfbWludXRlc19pbicsIHNldHRpbmdzLmJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfbWludXRlc19pbiB8fCAnJyApO1xyXG5cdFx0c2V0X3NlbGVjdF92YWx1ZSggJ2Jvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfbWludXRlc19vdXQnLCBzZXR0aW5ncy5ib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX21pbnV0ZXNfb3V0IHx8ICcnICk7XHJcblx0XHRzZXRfc2VsZWN0X3ZhbHVlKCAnYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9kYXlzX2luJywgc2V0dGluZ3MuYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9kYXlzX2luIHx8ICcnICk7XHJcblx0XHRzZXRfc2VsZWN0X3ZhbHVlKCAnYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9kYXlzX291dCcsIHNldHRpbmdzLmJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfZGF5c19vdXQgfHwgJycgKTtcclxuXHJcblx0XHQkZm9ybS5maW5kKCAnaW5wdXRbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfaW5fb3V0XCJdJyApLnByb3AoICdjaGVja2VkJywgZmFsc2UgKTtcclxuXHRcdCRmb3JtLmZpbmQoICdpbnB1dFtuYW1lPVwiYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9pbl9vdXRcIl1bdmFsdWU9XCInICsgKCBzZXR0aW5ncy5ib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2luX291dCB8fCAnJyApICsgJ1wiXScgKS5wcm9wKCAnY2hlY2tlZCcsIHRydWUgKTtcclxuXHJcblx0XHRyZWZyZXNoX2J1ZmZlcl9maWVsZHMoKTtcclxuXHRcdHN5bmNfYWxsX3JhbmdlcygpO1xyXG5cdFx0c2NoZWR1bGVfcHJldmlld19yZWZyZXNoKCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBkYXRlX2Zyb21fc3FsKCBzcWxfZGF0ZSApIHtcclxuXHRcdHZhciBwYXJ0cyA9IFN0cmluZyggc3FsX2RhdGUgfHwgJycgKS5zcGxpdCggJy0nICk7XHJcblx0XHRpZiAoIHBhcnRzLmxlbmd0aCAhPT0gMyApIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gbmV3IERhdGUoIHBhcnNlSW50KCBwYXJ0c1swXSwgMTAgKSwgcGFyc2VJbnQoIHBhcnRzWzFdLCAxMCApIC0gMSwgcGFyc2VJbnQoIHBhcnRzWzJdLCAxMCApLCAwLCAwLCAwICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfdG9kYXlfZGF0ZSgpIHtcclxuXHRcdHZhciBhcnIgPSB3Ll93cGJjICYmIHR5cGVvZiB3Ll93cGJjLmdldF9vdGhlcl9wYXJhbSA9PT0gJ2Z1bmN0aW9uJyA/IHcuX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyApIDogbnVsbDtcclxuXHRcdGlmICggYXJyICYmIGFyci5sZW5ndGggPj0gMyApIHtcclxuXHRcdFx0cmV0dXJuIG5ldyBEYXRlKCBwYXJzZUludCggYXJyWzBdLCAxMCApLCBwYXJzZUludCggYXJyWzFdLCAxMCApIC0gMSwgcGFyc2VJbnQoIGFyclsyXSwgMTAgKSwgMCwgMCwgMCApO1xyXG5cdFx0fVxyXG5cdFx0dmFyIG5vdyA9IG5ldyBEYXRlKCk7XHJcblx0XHRyZXR1cm4gbmV3IERhdGUoIG5vdy5nZXRGdWxsWWVhcigpLCBub3cuZ2V0TW9udGgoKSwgbm93LmdldERhdGUoKSwgMCwgMCwgMCApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X3JlYWxfdG9kYXlfZGF0ZSgpIHtcclxuXHRcdHZhciBhcnIgPSB3Ll93cGJjICYmIHR5cGVvZiB3Ll93cGJjLmdldF9vdGhlcl9wYXJhbSA9PT0gJ2Z1bmN0aW9uJyA/IHcuX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGltZV9sb2NhbF9hcnInICkgOiBudWxsO1xyXG5cdFx0aWYgKCBhcnIgJiYgYXJyLmxlbmd0aCA+PSAzICkge1xyXG5cdFx0XHRyZXR1cm4gbmV3IERhdGUoIHBhcnNlSW50KCBhcnJbMF0sIDEwICksIHBhcnNlSW50KCBhcnJbMV0sIDEwICkgLSAxLCBwYXJzZUludCggYXJyWzJdLCAxMCApLCAwLCAwLCAwICk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gZ2V0X3RvZGF5X2RhdGUoKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGRheXNfYmV0d2VlbiggZGF0ZV9hLCBkYXRlX2IgKSB7XHJcblx0XHRyZXR1cm4gTWF0aC5mbG9vciggKCBkYXRlX2EuZ2V0VGltZSgpIC0gZGF0ZV9iLmdldFRpbWUoKSApIC8gODY0MDAwMDAgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGFkZF9kYXlzKCBkYXRlLCBkYXlzICkge1xyXG5cdFx0dmFyIHNoaWZ0ZWRfZGF0ZSA9IG5ldyBEYXRlKCBkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSwgZGF0ZS5nZXREYXRlKCksIDAsIDAsIDAgKTtcclxuXHRcdHNoaWZ0ZWRfZGF0ZS5zZXREYXRlKCBzaGlmdGVkX2RhdGUuZ2V0RGF0ZSgpICsgZGF5cyApO1xyXG5cdFx0cmV0dXJuIHNoaWZ0ZWRfZGF0ZTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGRhdGVfdG9fc3FsKCBkYXRlICkge1xyXG5cdFx0dmFyIG1vbnRoID0gU3RyaW5nKCBkYXRlLmdldE1vbnRoKCkgKyAxICk7XHJcblx0XHR2YXIgZGF5ID0gU3RyaW5nKCBkYXRlLmdldERhdGUoKSApO1xyXG5cclxuXHRcdGlmICggbW9udGgubGVuZ3RoIDwgMiApIHtcclxuXHRcdFx0bW9udGggPSAnMCcgKyBtb250aDtcclxuXHRcdH1cclxuXHRcdGlmICggZGF5Lmxlbmd0aCA8IDIgKSB7XHJcblx0XHRcdGRheSA9ICcwJyArIGRheTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZGF0ZS5nZXRGdWxsWWVhcigpICsgJy0nICsgbW9udGggKyAnLScgKyBkYXk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfc3FsX2RhdGVfZnJvbV9jZWxsKCBjZWxsICkge1xyXG5cdFx0dmFyIGNsYXNzZXMgPSBTdHJpbmcoIGNlbGwuY2xhc3NOYW1lIHx8ICcnICkuc3BsaXQoIC9cXHMrLyApO1xyXG5cdFx0dmFyIGk7XHJcblx0XHRmb3IgKCBpID0gMDsgaSA8IGNsYXNzZXMubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdGlmICggY2xhc3Nlc1tpXS5pbmRleE9mKCAnc3FsX2RhdGVfJyApID09PSAwICkge1xyXG5cdFx0XHRcdHJldHVybiBjbGFzc2VzW2ldLnJlcGxhY2UoICdzcWxfZGF0ZV8nLCAnJyApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gJyc7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB1bmF2YWlsYWJsZV9mcm9tX3RvZGF5X2FwcGxpZXMoIGNlbGxfZGF0ZSwgdG9kYXlfZGF0ZSwgdmFsdWUgKSB7XHJcblx0XHR2YXIgbWludXRlcztcclxuXHRcdHZhciBub3c7XHJcblx0XHR2YXIgdW5hdmFpbGFibGVfdW50aWw7XHJcblxyXG5cdFx0aWYgKCAhIHZhbHVlIHx8IHZhbHVlID09PSAnMCcgKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIC9tJC8udGVzdCggdmFsdWUgKSApIHtcclxuXHRcdFx0bWludXRlcyA9IHBhcnNlSW50KCB2YWx1ZSwgMTAgKTtcclxuXHRcdFx0aWYgKCAhIG1pbnV0ZXMgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblx0XHRcdG5vdyA9IG5ldyBEYXRlKCk7XHJcblx0XHRcdHVuYXZhaWxhYmxlX3VudGlsID0gbmV3IERhdGUoIG5vdy5nZXRUaW1lKCkgKyAoICggbWludXRlcyAtIDEgKSAqIDYwMDAwICkgKTtcclxuXHRcdFx0dW5hdmFpbGFibGVfdW50aWwgPSBuZXcgRGF0ZSggdW5hdmFpbGFibGVfdW50aWwuZ2V0RnVsbFllYXIoKSwgdW5hdmFpbGFibGVfdW50aWwuZ2V0TW9udGgoKSwgdW5hdmFpbGFibGVfdW50aWwuZ2V0RGF0ZSgpLCAwLCAwLCAwICk7XHJcblx0XHRcdHJldHVybiBjZWxsX2RhdGUuZ2V0VGltZSgpIDw9IHVuYXZhaWxhYmxlX3VudGlsLmdldFRpbWUoKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZGF5c19iZXR3ZWVuKCBjZWxsX2RhdGUsIHRvZGF5X2RhdGUgKSA8IHBhcnNlSW50KCB2YWx1ZSwgMTAgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9vcHRpb25fdGV4dCggc2VsZWN0b3IgKSB7XHJcblx0XHR2YXIgdGV4dCA9ICQoIHNlbGVjdG9yICkuZmluZCggJ29wdGlvbjpzZWxlY3RlZCcgKS50ZXh0KCk7XHJcblx0XHRyZXR1cm4gdHJpbV90ZXh0KCB0ZXh0ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfZGF5c192YWx1ZSggdmFsdWUgKSB7XHJcblx0XHRpZiAoICEgdmFsdWUgfHwgISAvZCQvLnRlc3QoIHZhbHVlICkgKSB7XHJcblx0XHRcdHJldHVybiAwO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHBhcnNlSW50KCB2YWx1ZSwgMTAgKSB8fCAwO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdXBkYXRlX3dwYmNfcHJldmlld19wYXJhbXMoIHNldHRpbmdzICkge1xyXG5cdFx0aWYgKCAhIHcuX3dwYmMgfHwgdHlwZW9mIHcuX3dwYmMuc2V0X290aGVyX3BhcmFtICE9PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dy5fd3BiYy5zZXRfb3RoZXJfcGFyYW0oICdhdmFpbGFiaWxpdHlfX3dlZWtfZGF5c191bmF2YWlsYWJsZScsIHNldHRpbmdzLndlZWtkYXlzLmNvbmNhdCggWyA5OTkgXSApICk7XHJcblx0XHR3Ll93cGJjLnNldF9vdGhlcl9wYXJhbSggJ2F2YWlsYWJpbGl0eV9fYXZhaWxhYmxlX2Zyb21fdG9kYXknLCBpc19hdmFpbGFibGVfbGltaXRfYXZhaWxhYmxlKCkgPyAoIHNldHRpbmdzLmJvb2tpbmdfYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXkgfHwgJycgKSA6ICcnICk7XHJcblx0XHR3Ll93cGJjLnNldF9vdGhlcl9wYXJhbSggJ2F2YWlsYWJpbGl0eV9fdW5hdmFpbGFibGVfZnJvbV90b2RheScsIHNldHRpbmdzLmJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheSB8fCAnMCcgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHVwZGF0ZV9idWZmZXJfcHJldmlld19ub3RlKCBzZXR0aW5ncyApIHtcclxuXHRcdHZhciAkbm90ZXMgPSAkKCAnW2RhdGEtd3BiYy1hZy1jYWxlbmRhci1ub3Rlcz1cIjFcIl0nICkuZmlyc3QoKTtcclxuXHRcdHZhciAkY2FsZW5kYXIgPSAkKCAnW2RhdGEtd3BiYy1hZy1jYWxlbmRhci1wYW5lbD1cIjFcIl0nICkuZmlyc3QoKTtcclxuXHRcdHZhciAkbm90ZSA9ICRub3Rlcy5maW5kKCAnLndwYmNfYWdfYnVmZmVyX3ByZXZpZXdfbm90ZScgKTtcclxuXHRcdHZhciB0eXBlID0gc2V0dGluZ3MuYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9pbl9vdXQgfHwgJyc7XHJcblx0XHR2YXIgYmVmb3JlX3RleHQgPSAnJztcclxuXHRcdHZhciBhZnRlcl90ZXh0ID0gJyc7XHJcblx0XHR2YXIgbWVzc2FnZSA9ICcnO1xyXG5cclxuXHRcdGlmICggISAkbm90ZXMubGVuZ3RoIHx8ICEgJGNhbGVuZGFyLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISAkbm90ZS5sZW5ndGggKSB7XHJcblx0XHRcdCRub3RlID0gJCggJzxkaXYgY2xhc3M9XCJ3cGJjX2FnX2J1ZmZlcl9wcmV2aWV3X25vdGVcIiBhcmlhLWxpdmU9XCJwb2xpdGVcIj48L2Rpdj4nICk7XHJcblx0XHRcdCRub3Rlcy5hcHBlbmQoICRub3RlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAhIGlzX2J1ZmZlcl9hdmFpbGFibGUoKSApIHtcclxuXHRcdFx0JGNhbGVuZGFyLnJlbW92ZUNsYXNzKCAnd3BiY19hZ19wcmV2aWV3X2J1ZmZlcl9hY3RpdmUnICk7XHJcblx0XHRcdCRub3RlLmF0dHIoICdoaWRkZW4nLCAnaGlkZGVuJyApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JGNhbGVuZGFyLnRvZ2dsZUNsYXNzKCAnd3BiY19hZ19wcmV2aWV3X2J1ZmZlcl9hY3RpdmUnLCAhISB0eXBlICk7XHJcblxyXG5cdFx0aWYgKCB0eXBlID09PSAnbScgKSB7XHJcblx0XHRcdGJlZm9yZV90ZXh0ID0gZ2V0X29wdGlvbl90ZXh0KCAnW25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX21pbnV0ZXNfaW5cIl0nICkgfHwgJy0nO1xyXG5cdFx0XHRhZnRlcl90ZXh0ID0gZ2V0X29wdGlvbl90ZXh0KCAnW25hbWU9XCJib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX21pbnV0ZXNfb3V0XCJdJyApIHx8ICctJztcclxuXHRcdH0gZWxzZSBpZiAoIHR5cGUgPT09ICdkJyApIHtcclxuXHRcdFx0YmVmb3JlX3RleHQgPSBnZXRfb3B0aW9uX3RleHQoICdbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfZGF5c19pblwiXScgKSB8fCAnLSc7XHJcblx0XHRcdGFmdGVyX3RleHQgPSBnZXRfb3B0aW9uX3RleHQoICdbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfZGF5c19vdXRcIl0nICkgfHwgJy0nO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggdHlwZSApIHtcclxuXHRcdFx0bWVzc2FnZSA9ICc8c3Ryb25nPicgKyAoIGNmZy5pMThuICYmIGNmZy5pMThuLmJ1ZmZlcl9wcmV2aWV3ID8gY2ZnLmkxOG4uYnVmZmVyX3ByZXZpZXcgOiAnQnVmZmVyIHByZXZpZXcnICkgKyAnOjwvc3Ryb25nPiAnICtcclxuXHRcdFx0XHQoIGNmZy5pMThuICYmIGNmZy5pMThuLmJlZm9yZV9ib29raW5nID8gY2ZnLmkxOG4uYmVmb3JlX2Jvb2tpbmcgOiAnQmVmb3JlIGJvb2tpbmcnICkgKyAnICcgKyBiZWZvcmVfdGV4dCArXHJcblx0XHRcdFx0JyAvICcgKyAoIGNmZy5pMThuICYmIGNmZy5pMThuLmFmdGVyX2Jvb2tpbmcgPyBjZmcuaTE4bi5hZnRlcl9ib29raW5nIDogJ0FmdGVyIGJvb2tpbmcnICkgKyAnICcgKyBhZnRlcl90ZXh0O1xyXG5cdFx0XHRpZiAoICRub3RlLmh0bWwoKSAhPT0gbWVzc2FnZSApIHtcclxuXHRcdFx0XHQkbm90ZS5odG1sKCBtZXNzYWdlICk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCAkbm90ZS5hdHRyKCAnaGlkZGVuJyApICkge1xyXG5cdFx0XHRcdCRub3RlLnJlbW92ZUF0dHIoICdoaWRkZW4nICk7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdG1lc3NhZ2UgPSBjZmcuaTE4biAmJiBjZmcuaTE4bi5ub19idWZmZXIgPyBjZmcuaTE4bi5ub19idWZmZXIgOiAnTm8gYm9va2luZyBidWZmZXIgaXMgc2VsZWN0ZWQuJztcclxuXHRcdFx0aWYgKCAkbm90ZS50ZXh0KCkgIT09IG1lc3NhZ2UgKSB7XHJcblx0XHRcdFx0JG5vdGUudGV4dCggbWVzc2FnZSApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggISAkbm90ZS5hdHRyKCAnaGlkZGVuJyApICkge1xyXG5cdFx0XHRcdCRub3RlLmF0dHIoICdoaWRkZW4nLCAnaGlkZGVuJyApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBhcHBseV9idWZmZXJfZGF5c19wcmV2aWV3KCBzZXR0aW5ncyApIHtcclxuXHRcdHZhciAkY2FsZW5kYXIgPSAkKCAnW2RhdGEtd3BiYy1hZy1jYWxlbmRhci1wYW5lbD1cIjFcIl0nICk7XHJcblx0XHR2YXIgYmVmb3JlX2RheXMgPSBnZXRfZGF5c192YWx1ZSggc2V0dGluZ3MuYm9va2luZ191bmF2YWlsYWJsZV9leHRyYV9kYXlzX2luICk7XHJcblx0XHR2YXIgYWZ0ZXJfZGF5cyA9IGdldF9kYXlzX3ZhbHVlKCBzZXR0aW5ncy5ib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX2RheXNfb3V0ICk7XHJcblx0XHR2YXIgZGF0ZV9jZWxscyA9IHt9O1xyXG5cdFx0dmFyIGJvb2tlZF9kYXRlcyA9IFtdO1xyXG5cclxuXHRcdGlmICggISBpc19idWZmZXJfYXZhaWxhYmxlKCkgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIHNldHRpbmdzLmJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfaW5fb3V0ICE9PSAnZCcgfHwgKCAhIGJlZm9yZV9kYXlzICYmICEgYWZ0ZXJfZGF5cyApICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JGNhbGVuZGFyLmZpbmQoICcuZGF0ZXBpY2stZGF5cy1jZWxsJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0dmFyICRjZWxsID0gJCggdGhpcyApO1xyXG5cdFx0XHR2YXIgc3FsX2RhdGUgPSBnZXRfc3FsX2RhdGVfZnJvbV9jZWxsKCB0aGlzICk7XHJcblx0XHRcdHZhciBjZWxsX2RhdGU7XHJcblxyXG5cdFx0XHRpZiAoICEgc3FsX2RhdGUgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRkYXRlX2NlbGxzWyBzcWxfZGF0ZSBdID0gJGNlbGw7XHJcblxyXG5cdFx0XHRpZiAoICRjZWxsLmhhc0NsYXNzKCAnZGF0ZV9hcHByb3ZlZCcgKSB8fCAkY2VsbC5oYXNDbGFzcyggJ2RhdGUyYXBwcm92ZScgKSApIHtcclxuXHRcdFx0XHRjZWxsX2RhdGUgPSBkYXRlX2Zyb21fc3FsKCBzcWxfZGF0ZSApO1xyXG5cdFx0XHRcdGlmICggY2VsbF9kYXRlICkge1xyXG5cdFx0XHRcdFx0Ym9va2VkX2RhdGVzLnB1c2goIGNlbGxfZGF0ZSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cclxuXHRcdCQuZWFjaCggYm9va2VkX2RhdGVzLCBmdW5jdGlvbiAoIGluZGV4LCBib29rZWRfZGF0ZSApIHtcclxuXHRcdFx0dmFyIG9mZnNldDtcclxuXHRcdFx0dmFyIHRhcmdldF9zcWxfZGF0ZTtcclxuXHRcdFx0dmFyICR0YXJnZXRfY2VsbDtcclxuXHJcblx0XHRcdGZvciAoIG9mZnNldCA9IGJlZm9yZV9kYXlzICogLTE7IG9mZnNldCA8IDA7IG9mZnNldCsrICkge1xyXG5cdFx0XHRcdHRhcmdldF9zcWxfZGF0ZSA9IGRhdGVfdG9fc3FsKCBhZGRfZGF5cyggYm9va2VkX2RhdGUsIG9mZnNldCApICk7XHJcblx0XHRcdFx0JHRhcmdldF9jZWxsID0gZGF0ZV9jZWxsc1sgdGFyZ2V0X3NxbF9kYXRlIF07XHJcblx0XHRcdFx0aWYgKCAkdGFyZ2V0X2NlbGwgJiYgISAkdGFyZ2V0X2NlbGwuaGFzQ2xhc3MoICdkYXRlX2FwcHJvdmVkJyApICYmICEgJHRhcmdldF9jZWxsLmhhc0NsYXNzKCAnZGF0ZTJhcHByb3ZlJyApICkge1xyXG5cdFx0XHRcdFx0cmVtZW1iZXJfcHJldmlld19vcmlnaW4oICR0YXJnZXRfY2VsbCApO1xyXG5cdFx0XHRcdFx0JHRhcmdldF9jZWxsLmFkZENsYXNzKCAnZGF0ZV91c2VyX3VuYXZhaWxhYmxlIHdwYmNfYWdfcHJldmlld191bmF2YWlsYWJsZSB3cGJjX2FnX3ByZXZpZXdfYnVmZmVyX3VuYXZhaWxhYmxlIGJ1ZmZlcl91bmF2YWlsYWJsZScgKTtcclxuXHRcdFx0XHRcdCR0YXJnZXRfY2VsbC5hdHRyKCAnZGF0YS13cGJjLWFnLXByZXZpZXctcmVhc29uJywgJ3dwYmNfYWdfcHJldmlld19idWZmZXJfdW5hdmFpbGFibGUnICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRmb3IgKCBvZmZzZXQgPSAxOyBvZmZzZXQgPD0gYWZ0ZXJfZGF5czsgb2Zmc2V0KysgKSB7XHJcblx0XHRcdFx0dGFyZ2V0X3NxbF9kYXRlID0gZGF0ZV90b19zcWwoIGFkZF9kYXlzKCBib29rZWRfZGF0ZSwgb2Zmc2V0ICkgKTtcclxuXHRcdFx0XHQkdGFyZ2V0X2NlbGwgPSBkYXRlX2NlbGxzWyB0YXJnZXRfc3FsX2RhdGUgXTtcclxuXHRcdFx0XHRpZiAoICR0YXJnZXRfY2VsbCAmJiAhICR0YXJnZXRfY2VsbC5oYXNDbGFzcyggJ2RhdGVfYXBwcm92ZWQnICkgJiYgISAkdGFyZ2V0X2NlbGwuaGFzQ2xhc3MoICdkYXRlMmFwcHJvdmUnICkgKSB7XHJcblx0XHRcdFx0XHRyZW1lbWJlcl9wcmV2aWV3X29yaWdpbiggJHRhcmdldF9jZWxsICk7XHJcblx0XHRcdFx0XHQkdGFyZ2V0X2NlbGwuYWRkQ2xhc3MoICdkYXRlX3VzZXJfdW5hdmFpbGFibGUgd3BiY19hZ19wcmV2aWV3X3VuYXZhaWxhYmxlIHdwYmNfYWdfcHJldmlld19idWZmZXJfdW5hdmFpbGFibGUgYnVmZmVyX3VuYXZhaWxhYmxlJyApO1xyXG5cdFx0XHRcdFx0JHRhcmdldF9jZWxsLmF0dHIoICdkYXRhLXdwYmMtYWctcHJldmlldy1yZWFzb24nLCAnd3BiY19hZ19wcmV2aWV3X2J1ZmZlcl91bmF2YWlsYWJsZScgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJlbWVtYmVyX3ByZXZpZXdfb3JpZ2luKCAkY2VsbCApIHtcclxuXHRcdGlmICggdHlwZW9mICRjZWxsLmF0dHIoICdkYXRhLXdwYmMtYWctb3JpZ2luYWwtZGF0ZS11c2VyLXVuYXZhaWxhYmxlJyApID09PSAndW5kZWZpbmVkJyApIHtcclxuXHRcdFx0JGNlbGwuYXR0ciggJ2RhdGEtd3BiYy1hZy1vcmlnaW5hbC1kYXRlLXVzZXItdW5hdmFpbGFibGUnLCAkY2VsbC5oYXNDbGFzcyggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScgKSA/ICcxJyA6ICcwJyApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gY2xlYXJfcHJldmlld19jZWxsKCAkY2VsbCApIHtcclxuXHRcdHZhciBoYWRfZGF0ZV91c2VyX3VuYXZhaWxhYmxlID0gJGNlbGwuYXR0ciggJ2RhdGEtd3BiYy1hZy1vcmlnaW5hbC1kYXRlLXVzZXItdW5hdmFpbGFibGUnICkgPT09ICcxJztcclxuXHJcblx0XHQkY2VsbC5yZW1vdmVDbGFzcyggcHJldmlld191bmF2YWlsYWJsZV9jbGFzc2VzICk7XHJcblx0XHQkY2VsbC5yZW1vdmVBdHRyKCAnZGF0YS13cGJjLWFnLXByZXZpZXctcmVhc29uJyApO1xyXG5cdFx0JGNlbGwucmVtb3ZlQXR0ciggJ2RhdGEtd3BiYy1hZy1vcmlnaW5hbC1kYXRlLXVzZXItdW5hdmFpbGFibGUnICk7XHJcblxyXG5cdFx0aWYgKCAhIGhhZF9kYXRlX3VzZXJfdW5hdmFpbGFibGUgKSB7XHJcblx0XHRcdCRjZWxsLnJlbW92ZUNsYXNzKCAnZGF0ZV91c2VyX3VuYXZhaWxhYmxlJyApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYXBwbHlfY2FsZW5kYXJfcHJldmlldygpIHtcclxuXHRcdHZhciBzZXR0aW5ncyA9IGNvbGxlY3Rfc2V0dGluZ3MoKTtcclxuXHRcdHZhciB0b2RheV9kYXRlID0gZ2V0X3JlYWxfdG9kYXlfZGF0ZSgpO1xyXG5cdFx0dmFyIGF2YWlsYWJsZV9saW1pdCA9IGlzX2F2YWlsYWJsZV9saW1pdF9hdmFpbGFibGUoKSA/IHBhcnNlSW50KCBzZXR0aW5ncy5ib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5IHx8ICcwJywgMTAgKSA6IDA7XHJcblx0XHR2YXIgJGNhbGVuZGFyID0gJCggJ1tkYXRhLXdwYmMtYWctY2FsZW5kYXItcGFuZWw9XCIxXCJdJyApO1xyXG5cclxuXHRcdHVwZGF0ZV93cGJjX3ByZXZpZXdfcGFyYW1zKCBzZXR0aW5ncyApO1xyXG5cdFx0dXBkYXRlX2J1ZmZlcl9wcmV2aWV3X25vdGUoIHNldHRpbmdzICk7XHJcblxyXG5cdFx0JGNhbGVuZGFyLmZpbmQoICcuZGF0ZXBpY2stZGF5cy1jZWxsJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0dmFyIGNlbGwgPSB0aGlzO1xyXG5cdFx0XHR2YXIgJGNlbGwgPSAkKCBjZWxsICk7XHJcblx0XHRcdHZhciBzcWxfZGF0ZSA9IGdldF9zcWxfZGF0ZV9mcm9tX2NlbGwoIGNlbGwgKTtcclxuXHRcdFx0dmFyIGNlbGxfZGF0ZSA9IGRhdGVfZnJvbV9zcWwoIHNxbF9kYXRlICk7XHJcblx0XHRcdHZhciBtYWtlX3VuYXZhaWxhYmxlID0gZmFsc2U7XHJcblx0XHRcdHZhciByZWFzb25fY2xhc3MgPSAnJztcclxuXHRcdFx0dmFyIHByZXZpb3VzX3JlYXNvbiA9ICRjZWxsLmF0dHIoICdkYXRhLXdwYmMtYWctcHJldmlldy1yZWFzb24nICkgfHwgJyc7XHJcblx0XHRcdHZhciBoYWRfZ2VuZXJhbF9wcmV2aWV3ID0gISEgcHJldmlvdXNfcmVhc29uIHx8ICRjZWxsLmhhc0NsYXNzKCAnd3BiY19hZ19wcmV2aWV3X3VuYXZhaWxhYmxlJyApIHx8ICRjZWxsLmhhc0NsYXNzKCAnd2Vla2RheV91bmF2YWlsYWJsZScgKSB8fCAkY2VsbC5oYXNDbGFzcyggJ2Zyb21fdG9kYXlfdW5hdmFpbGFibGUnICkgfHwgJGNlbGwuaGFzQ2xhc3MoICdsaW1pdF9hdmFpbGFibGVfZnJvbV90b2RheScgKSB8fCAkY2VsbC5oYXNDbGFzcyggJ2J1ZmZlcl91bmF2YWlsYWJsZScgKTtcclxuXHJcblx0XHRcdGlmICggISBjZWxsX2RhdGUgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIHNldHRpbmdzLndlZWtkYXlzLmluZGV4T2YoIGNlbGxfZGF0ZS5nZXREYXkoKSApID4gLTEgKSB7XHJcblx0XHRcdFx0bWFrZV91bmF2YWlsYWJsZSA9IHRydWU7XHJcblx0XHRcdFx0cmVhc29uX2NsYXNzID0gJ3dwYmNfYWdfcHJldmlld193ZWVrZGF5X3VuYXZhaWxhYmxlJztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCB1bmF2YWlsYWJsZV9mcm9tX3RvZGF5X2FwcGxpZXMoIGNlbGxfZGF0ZSwgdG9kYXlfZGF0ZSwgc2V0dGluZ3MuYm9va2luZ191bmF2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5ICkgKSB7XHJcblx0XHRcdFx0bWFrZV91bmF2YWlsYWJsZSA9IHRydWU7XHJcblx0XHRcdFx0cmVhc29uX2NsYXNzID0gJ3dwYmNfYWdfcHJldmlld19mcm9tX3RvZGF5X3VuYXZhaWxhYmxlJztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBhdmFpbGFibGVfbGltaXQgPiAwICYmIGRheXNfYmV0d2VlbiggY2VsbF9kYXRlLCB0b2RheV9kYXRlICkgPj0gYXZhaWxhYmxlX2xpbWl0ICkge1xyXG5cdFx0XHRcdG1ha2VfdW5hdmFpbGFibGUgPSB0cnVlO1xyXG5cdFx0XHRcdHJlYXNvbl9jbGFzcyA9ICd3cGJjX2FnX3ByZXZpZXdfbGltaXRfYXZhaWxhYmxlX2Zyb21fdG9kYXknO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIG1ha2VfdW5hdmFpbGFibGUgKSB7XHJcblx0XHRcdFx0aWYgKCBwcmV2aW91c19yZWFzb24gIT09IHJlYXNvbl9jbGFzcyApIHtcclxuXHRcdFx0XHRcdGlmICggaGFkX2dlbmVyYWxfcHJldmlldyApIHtcclxuXHRcdFx0XHRcdFx0Y2xlYXJfcHJldmlld19jZWxsKCAkY2VsbCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0cmVtZW1iZXJfcHJldmlld19vcmlnaW4oICRjZWxsICk7XHJcblx0XHRcdFx0XHQkY2VsbC5hZGRDbGFzcyggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZSB3cGJjX2FnX3ByZXZpZXdfdW5hdmFpbGFibGUgJyArIHJlYXNvbl9jbGFzcyApO1xyXG5cdFx0XHRcdFx0JGNlbGwuYXR0ciggJ2RhdGEtd3BiYy1hZy1wcmV2aWV3LXJlYXNvbicsIHJlYXNvbl9jbGFzcyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBlbHNlIGlmICggaGFkX2dlbmVyYWxfcHJldmlldyApIHtcclxuXHRcdFx0XHRjbGVhcl9wcmV2aWV3X2NlbGwoICRjZWxsICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHJcblx0XHRhcHBseV9idWZmZXJfZGF5c19wcmV2aWV3KCBzZXR0aW5ncyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcXVldWVfcHJldmlld19yZWZyZXNoKCkge1xyXG5cdFx0aWYgKCBwcmV2aWV3X2ZyYW1lICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCB3LnJlcXVlc3RBbmltYXRpb25GcmFtZSApIHtcclxuXHRcdFx0cHJldmlld19mcmFtZSA9IHcucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0cHJldmlld19mcmFtZSA9IDA7XHJcblx0XHRcdFx0YXBwbHlfY2FsZW5kYXJfcHJldmlldygpO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRwcmV2aWV3X2ZyYW1lID0gdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0cHJldmlld19mcmFtZSA9IDA7XHJcblx0XHRcdFx0YXBwbHlfY2FsZW5kYXJfcHJldmlldygpO1xyXG5cdFx0XHR9LCAwICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzY2hlZHVsZV9wcmV2aWV3X3JlZnJlc2goIGRlbGF5ICkge1xyXG5cdFx0Y2xlYXJUaW1lb3V0KCBwcmV2aWV3X3RpbWVyICk7XHJcblx0XHRkZWxheSA9IHBhcnNlSW50KCBkZWxheSwgMTAgKSB8fCAwO1xyXG5cclxuXHRcdGlmICggZGVsYXkgPiAwICkge1xyXG5cdFx0XHRwcmV2aWV3X3RpbWVyID0gc2V0VGltZW91dCggcXVldWVfcHJldmlld19yZWZyZXNoLCBkZWxheSApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0cXVldWVfcHJldmlld19yZWZyZXNoKCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB1cGRhdGVfaGludHMoIGhpbnRzICkge1xyXG5cdFx0aWYgKCAhIGhpbnRzICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCB0eXBlb2YgaGludHMuYm9va2luZ191bmF2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5X19oaW50ICE9PSAndW5kZWZpbmVkJyApIHtcclxuXHRcdFx0JCggJ1tkYXRhLXdwYmMtYWctaGludD1cImJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheVwiXScgKS5odG1sKFxyXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIndwYmNfYWdfaGludF91bmF2YWlsYWJsZVwiPicgKyAkKCAnW2RhdGEtd3BiYy1hZy1oaW50PVwiYm9va2luZ191bmF2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5XCJdIC53cGJjX2FnX2hpbnRfdW5hdmFpbGFibGUnICkuZmlyc3QoKS50ZXh0KCkgKyAnPC9zcGFuPicgK1xyXG5cdFx0XHRcdGhpbnRzLmJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheV9faGludFxyXG5cdFx0XHQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggdHlwZW9mIGhpbnRzLmJvb2tpbmdfYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXlfX2hpbnQgIT09ICd1bmRlZmluZWQnICkge1xyXG5cdFx0XHQkKCAnW2RhdGEtd3BiYy1hZy1oaW50PVwiYm9va2luZ19hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheVwiXScgKS5odG1sKFxyXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIndwYmNfYWdfaGludF9hdmFpbGFibGVcIj4nICsgJCggJ1tkYXRhLXdwYmMtYWctaGludD1cImJvb2tpbmdfYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXlcIl0gLndwYmNfYWdfaGludF9hdmFpbGFibGUnICkuZmlyc3QoKS50ZXh0KCkgKyAnPC9zcGFuPicgK1xyXG5cdFx0XHRcdGhpbnRzLmJvb2tpbmdfYXZhaWxhYmxlX2RheXNfbnVtX2Zyb21fdG9kYXlfX2hpbnRcclxuXHRcdFx0KTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNob3dfbWVzc2FnZSggbWVzc2FnZSwgdHlwZSwgZHVyYXRpb24gKSB7XHJcblx0XHRpZiAoIHR5cGVvZiB3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHR3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCBtZXNzYWdlLCB0eXBlIHx8ICdpbmZvJywgZHVyYXRpb24gfHwgMjAwMCwgZmFsc2UgKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHcuYWxlcnQoIG1lc3NhZ2UgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNldF9idXN5KCAkYnV0dG9uLCBidXN5ICkge1xyXG5cdFx0dmFyIGJ1c3lfdGV4dDtcclxuXHJcblx0XHRpZiAoICEgJGJ1dHRvbiB8fCAhICRidXR0b24ubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBidXN5ICkge1xyXG5cdFx0XHRpZiAoICEgJGJ1dHRvbi5kYXRhKCAnd3BiYy1hZy1vcmlnaW5hbC1odG1sJyApICkge1xyXG5cdFx0XHRcdCRidXR0b24uZGF0YSggJ3dwYmMtYWctb3JpZ2luYWwtaHRtbCcsICRidXR0b24uaHRtbCgpICk7XHJcblx0XHRcdH1cclxuXHRcdFx0YnVzeV90ZXh0ID0gJGJ1dHRvbi5kYXRhKCAnd3BiYy11LWJ1c3ktdGV4dCcgKSB8fCAoIGNmZy5pMThuICYmIGNmZy5pMThuLnNhdmluZyApIHx8ICdTYXZpbmcuLi4nO1xyXG5cdFx0XHQkYnV0dG9uLmFkZENsYXNzKCAnd3BiY19hZ19pc19zYXZpbmcnICkuYXR0ciggJ2FyaWEtYnVzeScsICd0cnVlJyApLmh0bWwoICc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX3JvdGF0ZV9yaWdodCB3cGJjX3NwaW5cIj48L2k+PHNwYW4gY2xhc3M9XCJpbi1idXR0b24tdGV4dFwiPiZuYnNwOyZuYnNwOycgKyBidXN5X3RleHQgKyAnPC9zcGFuPicgKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdCRidXR0b24ucmVtb3ZlQ2xhc3MoICd3cGJjX2FnX2lzX3NhdmluZycgKS5yZW1vdmVBdHRyKCAnYXJpYS1idXN5JyApO1xyXG5cdFx0XHRpZiAoICRidXR0b24uZGF0YSggJ3dwYmMtYWctb3JpZ2luYWwtaHRtbCcgKSApIHtcclxuXHRcdFx0XHQkYnV0dG9uLmh0bWwoICRidXR0b24uZGF0YSggJ3dwYmMtYWctb3JpZ2luYWwtaHRtbCcgKSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByZXBsYWNlX2NhbGVuZGFyX3BhbmVsKCBodG1sICkge1xyXG5cdFx0dmFyICRob2xkZXIgPSAkKCAnPGRpdiAvPicgKS5hcHBlbmQoICQucGFyc2VIVE1MKCBodG1sLCBkb2N1bWVudCwgdHJ1ZSApICk7XHJcblx0XHR2YXIgJG5ld19wYW5lbCA9ICRob2xkZXIuZmluZCggJ1tkYXRhLXdwYmMtYWctY2FsZW5kYXItcGFuZWw9XCIxXCJdJyApLmZpcnN0KCk7XHJcblx0XHR2YXIgJG9sZF9wYW5lbCA9ICQoICdbZGF0YS13cGJjLWFnLWNhbGVuZGFyLXBhbmVsPVwiMVwiXScgKS5maXJzdCgpO1xyXG5cdFx0dmFyICRzY3JpcHRzO1xyXG5cclxuXHRcdGlmICggISAkbmV3X3BhbmVsLmxlbmd0aCB8fCAhICRvbGRfcGFuZWwubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JHNjcmlwdHMgPSAkbmV3X3BhbmVsLmZpbmQoICdzY3JpcHQnICkucmVtb3ZlKCk7XHJcblx0XHQkb2xkX3BhbmVsLnJlcGxhY2VXaXRoKCAkbmV3X3BhbmVsICk7XHJcblxyXG5cdFx0JHNjcmlwdHMuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR2YXIgY29kZSA9IHRoaXMudGV4dCB8fCB0aGlzLnRleHRDb250ZW50IHx8IHRoaXMuaW5uZXJIVE1MIHx8ICcnO1xyXG5cdFx0XHR2YXIgc3JjID0gdGhpcy5zcmMgfHwgJyc7XHJcblxyXG5cdFx0XHRpZiAoIHNyYyApIHtcclxuXHRcdFx0XHQkLmFqYXgoIHtcclxuXHRcdFx0XHRcdHVybDogc3JjLFxyXG5cdFx0XHRcdFx0ZGF0YVR5cGU6ICdzY3JpcHQnLFxyXG5cdFx0XHRcdFx0Y2FjaGU6IHRydWVcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH0gZWxzZSBpZiAoIGNvZGUgKSB7XHJcblx0XHRcdFx0JC5nbG9iYWxFdmFsKCBjb2RlICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNldF9jYWxlbmRhcl9sb2FkaW5nKCBpc19sb2FkaW5nICkge1xyXG5cdFx0dmFyICRjYWxlbmRhciA9ICQoICdbZGF0YS13cGJjLWFnLWNhbGVuZGFyLXBhbmVsPVwiMVwiXScgKS5maXJzdCgpO1xyXG5cdFx0dmFyIGxvYWRpbmdfdGV4dCA9IGNmZy5pMThuICYmIGNmZy5pMThuLmxvYWRpbmcgPyBjZmcuaTE4bi5sb2FkaW5nIDogJ0xvYWRpbmcnO1xyXG5cdFx0dmFyICRsb2FkaW5nO1xyXG5cclxuXHRcdGlmICggISAkY2FsZW5kYXIubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBpc19sb2FkaW5nICkge1xyXG5cdFx0XHQkbG9hZGluZyA9ICRjYWxlbmRhci5maW5kKCAnLndwYmNfY2FsZW5kYXJfbG9hZGluZycgKS5maXJzdCgpO1xyXG5cdFx0XHRpZiAoICEgJGxvYWRpbmcubGVuZ3RoICkge1xyXG5cdFx0XHRcdCRsb2FkaW5nID0gJChcclxuXHRcdFx0XHRcdCc8ZGl2IGNsYXNzPVwid3BiY19jYWxlbmRhcl9sb2FkaW5nIHdwYmNfYWdfY2FsZW5kYXJfbG9hZGluZ1wiPicgK1xyXG5cdFx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJ3cGJjX2ljbl9hdXRvcmVuZXcgd3BiY19zcGluXCI+PC9zcGFuPiZuYnNwOyZuYnNwOycgK1xyXG5cdFx0XHRcdFx0XHQnPHNwYW4+PC9zcGFuPicgK1xyXG5cdFx0XHRcdFx0JzwvZGl2PidcclxuXHRcdFx0XHQpO1xyXG5cdFx0XHRcdCRsb2FkaW5nLmZpbmQoICdzcGFuJyApLmxhc3QoKS50ZXh0KCBsb2FkaW5nX3RleHQgKyAnLi4uJyApO1xyXG5cdFx0XHRcdCRjYWxlbmRhci5hcHBlbmQoICRsb2FkaW5nICk7XHJcblx0XHRcdH1cclxuXHRcdFx0JGNhbGVuZGFyLmFkZENsYXNzKCAnaXMtbG9hZGluZycgKS5hdHRyKCAnYXJpYS1idXN5JywgJ3RydWUnICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHQkY2FsZW5kYXIucmVtb3ZlQ2xhc3MoICdpcy1sb2FkaW5nJyApLnJlbW92ZUF0dHIoICdhcmlhLWJ1c3knICk7XHJcblx0XHRcdCRjYWxlbmRhci5maW5kKCAnLndwYmNfY2FsZW5kYXJfbG9hZGluZycgKS5yZW1vdmUoKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9wcmV2aWV3X3BheWxvYWQoKSB7XHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRhY3Rpb246IGNmZy5wcmV2aWV3X2FjdGlvbiB8fCAnV1BCQ19BSlhfQVZBSUxBQklMSVRZX0dFTkVSQUxfUFJFVklFVycsXHJcblx0XHRcdG5vbmNlOiBjZmcubm9uY2UgfHwgJycsXHJcblx0XHRcdHJlc291cmNlX2lkOiAkKCAnI3dwYmNfYWdfcmVzb3VyY2VfaWQnICkudmFsKCkgfHwgJycsXHJcblx0XHRcdG1vbnRoc19jb3VudDogJCggJyN3cGJjX2FnX21vbnRoc19jb3VudCcgKS52YWwoKSB8fCAnJ1xyXG5cdFx0fTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGxvYWRfY2FsZW5kYXJfcHJldmlldygpIHtcclxuXHRcdHZhciAkY2FsZW5kYXIgPSAkKCAnW2RhdGEtd3BiYy1hZy1jYWxlbmRhci1wYW5lbD1cIjFcIl0nICkuZmlyc3QoKTtcclxuXHRcdHZhciBjdXJyZW50X3ByZXZpZXdfYWpheDtcclxuXHJcblx0XHRpZiAoICEgY2ZnLmFqYXhfdXJsICkge1xyXG5cdFx0XHRzaG93X21lc3NhZ2UoICggY2ZnLmkxOG4gJiYgY2ZnLmkxOG4ucHJldmlld19mYWlsZWQgKSB8fCAnVW5hYmxlIHRvIHJlZnJlc2ggY2FsZW5kYXIgcHJldmlldy4nLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBwcmV2aWV3X2FqYXggJiYgcHJldmlld19hamF4LnJlYWR5U3RhdGUgIT09IDQgKSB7XHJcblx0XHRcdHByZXZpZXdfYWpheC5hYm9ydCgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHNldF9jYWxlbmRhcl9sb2FkaW5nKCB0cnVlICk7XHJcblxyXG5cdFx0Y3VycmVudF9wcmV2aWV3X2FqYXggPSAkLmFqYXgoIHtcclxuXHRcdFx0dXJsOiBjZmcuYWpheF91cmwsXHJcblx0XHRcdG1ldGhvZDogJ1BPU1QnLFxyXG5cdFx0XHRkYXRhVHlwZTogJ2pzb24nLFxyXG5cdFx0XHRkYXRhOiBnZXRfcHJldmlld19wYXlsb2FkKClcclxuXHRcdH0gKTtcclxuXHRcdHByZXZpZXdfYWpheCA9IGN1cnJlbnRfcHJldmlld19hamF4O1xyXG5cclxuXHRcdGN1cnJlbnRfcHJldmlld19hamF4LmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XHJcblx0XHRcdGlmICggISByZXNwb25zZSB8fCAhIHJlc3BvbnNlLnN1Y2Nlc3MgfHwgISByZXNwb25zZS5kYXRhIHx8ICEgcmVzcG9uc2UuZGF0YS5odG1sICkge1xyXG5cdFx0XHRcdHNob3dfbWVzc2FnZSggKCByZXNwb25zZSAmJiByZXNwb25zZS5kYXRhICYmIHJlc3BvbnNlLmRhdGEubWVzc2FnZSApIHx8ICggY2ZnLmkxOG4gJiYgY2ZnLmkxOG4ucHJldmlld19mYWlsZWQgKSB8fCAnVW5hYmxlIHRvIHJlZnJlc2ggY2FsZW5kYXIgcHJldmlldy4nLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmVwbGFjZV9jYWxlbmRhcl9wYW5lbCggcmVzcG9uc2UuZGF0YS5odG1sICk7XHJcblx0XHRcdCQoICdbZGF0YS13cGJjLWFnLXBhZ2U9XCIxXCJdJyApLmF0dHIoICdkYXRhLXdwYmMtYWctcmVzb3VyY2UtaWQnLCByZXNwb25zZS5kYXRhLnJlc291cmNlX2lkIHx8ICcnICk7XHJcblx0XHRcdG9ic2VydmVfY2FsZW5kYXJfY2hhbmdlcygpO1xyXG5cdFx0XHRzY2hlZHVsZV9wcmV2aWV3X3JlZnJlc2goKTtcclxuXHRcdFx0c2V0VGltZW91dCggc2NoZWR1bGVfcHJldmlld19yZWZyZXNoLCA2MDAgKTtcclxuXHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIGpxX3hociwgdGV4dF9zdGF0dXMgKSB7XHJcblx0XHRcdGlmICggdGV4dF9zdGF0dXMgIT09ICdhYm9ydCcgKSB7XHJcblx0XHRcdFx0c2hvd19tZXNzYWdlKCAoIGNmZy5pMThuICYmIGNmZy5pMThuLnByZXZpZXdfZmFpbGVkICkgfHwgJ1VuYWJsZSB0byByZWZyZXNoIGNhbGVuZGFyIHByZXZpZXcuJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApLmFsd2F5cyggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRpZiAoIHByZXZpZXdfYWpheCA9PT0gY3VycmVudF9wcmV2aWV3X2FqYXggKSB7XHJcblx0XHRcdFx0c2V0X2NhbGVuZGFyX2xvYWRpbmcoIGZhbHNlICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNhdmVfc2V0dGluZ3MoIGJ1dHRvbiApIHtcclxuXHRcdHZhciAkYnV0dG9uID0gJCggYnV0dG9uICk7XHJcblx0XHR2YXIgc2V0dGluZ3MgPSBjb2xsZWN0X3NldHRpbmdzKCk7XHJcblx0XHR2YXIgcGF5bG9hZCA9ICQuZXh0ZW5kKCB7fSwgc2V0dGluZ3MsIHtcclxuXHRcdFx0YWN0aW9uOiBjZmcuYWN0aW9uIHx8ICdXUEJDX0FKWF9BVkFJTEFCSUxJVFlfR0VORVJBTF9TQVZFJyxcclxuXHRcdFx0bm9uY2U6IGNmZy5ub25jZSB8fCAnJyxcclxuXHRcdFx0Ym9va2luZ191bmF2YWlsYWJsZV9kYXlzOiBzZXR0aW5ncy53ZWVrZGF5c1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdGlmICggISBjZmcuYWpheF91cmwgKSB7XHJcblx0XHRcdHNob3dfbWVzc2FnZSggKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5zYXZlX2ZhaWxlZCApIHx8ICdVbmFibGUgdG8gc2F2ZSBnZW5lcmFsIGF2YWlsYWJpbGl0eSBzZXR0aW5ncy4nLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0c2V0X2J1c3koICRidXR0b24sIHRydWUgKTtcclxuXHJcblx0XHQkLmFqYXgoIHtcclxuXHRcdFx0dXJsOiBjZmcuYWpheF91cmwsXHJcblx0XHRcdG1ldGhvZDogJ1BPU1QnLFxyXG5cdFx0XHRkYXRhVHlwZTogJ2pzb24nLFxyXG5cdFx0XHRkYXRhOiBwYXlsb2FkXHJcblx0XHR9ICkuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcclxuXHRcdFx0aWYgKCAhIHJlc3BvbnNlIHx8ICEgcmVzcG9uc2Uuc3VjY2VzcyApIHtcclxuXHRcdFx0XHRzaG93X21lc3NhZ2UoICggcmVzcG9uc2UgJiYgcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLm1lc3NhZ2UgKSB8fCAoIGNmZy5pMThuICYmIGNmZy5pMThuLnNhdmVfZmFpbGVkICkgfHwgJ1VuYWJsZSB0byBzYXZlIGdlbmVyYWwgYXZhaWxhYmlsaXR5IHNldHRpbmdzLicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5zZXR0aW5ncyAmJiByZXNwb25zZS5kYXRhLnNldHRpbmdzLmhpbnRzICkge1xyXG5cdFx0XHRcdHVwZGF0ZV9oaW50cyggcmVzcG9uc2UuZGF0YS5zZXR0aW5ncy5oaW50cyApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRsb2FkX2NhbGVuZGFyX3ByZXZpZXcoKTtcclxuXHRcdFx0c2hvd19tZXNzYWdlKCAoIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5tZXNzYWdlICkgfHwgKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5zYXZlZCApIHx8ICdHZW5lcmFsIGF2YWlsYWJpbGl0eSBzZXR0aW5ncyB1cGRhdGVkLicsICdzdWNjZXNzJywgMjAwMCApO1xyXG5cdFx0fSApLmZhaWwoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0c2hvd19tZXNzYWdlKCAoIGNmZy5pMThuICYmIGNmZy5pMThuLnNhdmVfZmFpbGVkICkgfHwgJ1VuYWJsZSB0byBzYXZlIGdlbmVyYWwgYXZhaWxhYmlsaXR5IHNldHRpbmdzLicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHR9ICkuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHNldF9idXN5KCAkYnV0dG9uLCBmYWxzZSApO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcmVzZXRfc2V0dGluZ3MoIGJ1dHRvbiApIHtcclxuXHRcdHZhciBjb25maXJtX21lc3NhZ2UgPSAoIGNmZy5pMThuICYmIGNmZy5pMThuLnJlc2V0X2NvbmZpcm0gKSB8fCAnUmVzZXQgZ2VuZXJhbCBhdmFpbGFiaWxpdHkgc2V0dGluZ3MgdG8gZGVmYXVsdCB2YWx1ZXM/JztcclxuXHRcdHZhciBkZWZhdWx0X3NldHRpbmdzID0gY2ZnLmRlZmF1bHRfc2V0dGluZ3MgfHwge1xyXG5cdFx0XHR3ZWVrZGF5czogW10sXHJcblx0XHRcdGJvb2tpbmdfdW5hdmFpbGFibGVfZGF5c19udW1fZnJvbV90b2RheTogJzAnLFxyXG5cdFx0XHRib29raW5nX2F2YWlsYWJsZV9kYXlzX251bV9mcm9tX3RvZGF5OiAnJyxcclxuXHRcdFx0Ym9va2luZ191bmF2YWlsYWJsZV9leHRyYV9pbl9vdXQ6ICcnLFxyXG5cdFx0XHRib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX21pbnV0ZXNfaW46ICcnLFxyXG5cdFx0XHRib29raW5nX3VuYXZhaWxhYmxlX2V4dHJhX21pbnV0ZXNfb3V0OiAnJyxcclxuXHRcdFx0Ym9va2luZ191bmF2YWlsYWJsZV9leHRyYV9kYXlzX2luOiAnJyxcclxuXHRcdFx0Ym9va2luZ191bmF2YWlsYWJsZV9leHRyYV9kYXlzX291dDogJydcclxuXHRcdH07XHJcblxyXG5cdFx0aWYgKCAhIHcuY29uZmlybSggY29uZmlybV9tZXNzYWdlICkgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRhcHBseV9zZXR0aW5nc190b19mb3JtKCBkZWZhdWx0X3NldHRpbmdzICk7XHJcblx0XHRsb2FkX2NhbGVuZGFyX3ByZXZpZXcoKTtcclxuXHRcdHNob3dfbWVzc2FnZSggKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5yZXNldF9hcHBsaWVkICkgfHwgJ0RlZmF1bHQgYXZhaWxhYmlsaXR5IHNldHRpbmdzIGFyZSByZWFkeSBmb3IgcHJldmlldy4gQ2xpY2sgU2F2ZSBDaGFuZ2VzIHRvIGFwcGx5IHRoZW0uJywgJ3N1Y2Nlc3MnLCA0MDAwICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBvYnNlcnZlX2NhbGVuZGFyX2NoYW5nZXMoKSB7XHJcblx0XHR2YXIgdGFyZ2V0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYWctY2FsZW5kYXItcGFuZWw9XCIxXCJdJyApO1xyXG5cclxuXHRcdGlmICggISB0YXJnZXQgfHwgISB3Lk11dGF0aW9uT2JzZXJ2ZXIgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIG9ic2VydmVyICkge1xyXG5cdFx0XHRvYnNlcnZlci5kaXNjb25uZWN0KCk7XHJcblx0XHR9XHJcblxyXG5cdFx0b2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlciggc2NoZWR1bGVfcHJldmlld19yZWZyZXNoICk7XHJcblx0XHRvYnNlcnZlci5vYnNlcnZlKCB0YXJnZXQsIHtcclxuXHRcdFx0Y2hpbGRMaXN0OiB0cnVlLFxyXG5cdFx0XHRzdWJ0cmVlOiB0cnVlXHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnLndwYmNfYWdfcmlnaHRiYXJfdGFicyBbcm9sZT1cInRhYlwiXScsIGZ1bmN0aW9uICgpIHtcclxuXHRcdHN3aXRjaF9wYW5lbCggJCggdGhpcyApICk7XHJcblx0fSApO1xyXG5cclxuXHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnLndwYmNfYWdfcmlnaHRiYXJfcGFuZWxzIC5ncm91cF9faGVhZGVyJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0dG9nZ2xlX2dyb3VwKCAkKCB0aGlzICkgKTtcclxuXHR9ICk7XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdzdWJtaXQnLCAnW2RhdGEtd3BiYy1hZy1wcmV2aWV3LXRvb2xiYXI9XCIxXCJdJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRsb2FkX2NhbGVuZGFyX3ByZXZpZXcoKTtcclxuXHR9ICk7XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnI3dwYmNfYWdfcmVzb3VyY2VfaWQsICN3cGJjX2FnX21vbnRoc19jb3VudCcsIGxvYWRfY2FsZW5kYXJfcHJldmlldyApO1xyXG5cclxuXHQkKCBkb2N1bWVudCApLm9uKCAnaW5wdXQgY2hhbmdlJywgJ1tkYXRhLXdwYmMtYWctcmFuZ2UtZm9yXScsIGZ1bmN0aW9uICgpIHtcclxuXHRcdHN5bmNfc2VsZWN0X2Zyb21fcmFuZ2UoIHRoaXMgKTtcclxuXHRcdHNjaGVkdWxlX3ByZXZpZXdfcmVmcmVzaCgpO1xyXG5cdH0gKTtcclxuXHJcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICdbZGF0YS13cGJjLWFnLXNldHRpbmdzLWZvcm09XCIxXCJdIHNlbGVjdCcsIGZ1bmN0aW9uICgpIHtcclxuXHRcdHN5bmNfcmFuZ2VfZnJvbV9zZWxlY3QoIHRoaXMgKTtcclxuXHR9ICk7XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICdbZGF0YS13cGJjLWFnLXN0ZXBwZXJdJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0c3RlcF9zZWxlY3RfdmFsdWUoIHRoaXMgKTtcclxuXHR9ICk7XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnaW5wdXRbbmFtZT1cImJvb2tpbmdfdW5hdmFpbGFibGVfZXh0cmFfaW5fb3V0XCJdJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0cmVmcmVzaF9idWZmZXJfZmllbGRzKCk7XHJcblx0XHRzY2hlZHVsZV9wcmV2aWV3X3JlZnJlc2goKTtcclxuXHR9ICk7XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnW2RhdGEtd3BiYy1hZy1zZXR0aW5ncy1mb3JtPVwiMVwiXSBpbnB1dCwgW2RhdGEtd3BiYy1hZy1zZXR0aW5ncy1mb3JtPVwiMVwiXSBzZWxlY3QnLCBzY2hlZHVsZV9wcmV2aWV3X3JlZnJlc2ggKTtcclxuXHJcblx0JCggZG9jdW1lbnQgKS5vbiggJ3N1Ym1pdCcsICdbZGF0YS13cGJjLWFnLXNldHRpbmdzLWZvcm09XCIxXCJdJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRzYXZlX3NldHRpbmdzKCAkKCAnW2RhdGEtd3BiYy1hZy1zYXZlPVwiMVwiXScgKS5maXJzdCgpICk7XHJcblx0fSApO1xyXG5cclxuXHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnW2RhdGEtd3BiYy1hZy1zYXZlPVwiMVwiXScsIGZ1bmN0aW9uICgpIHtcclxuXHRcdHNhdmVfc2V0dGluZ3MoIHRoaXMgKTtcclxuXHR9ICk7XHJcblxyXG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICdbZGF0YS13cGJjLWFnLXJlc2V0PVwiMVwiXScsIGZ1bmN0aW9uICgpIHtcclxuXHRcdHJlc2V0X3NldHRpbmdzKCB0aGlzICk7XHJcblx0fSApO1xyXG5cclxuXHQkKCBkb2N1bWVudCApLnJlYWR5KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZWZyZXNoX2J1ZmZlcl9maWVsZHMoKTtcclxuXHRcdHN5bmNfYWxsX3JhbmdlcygpO1xyXG5cdFx0b2JzZXJ2ZV9jYWxlbmRhcl9jaGFuZ2VzKCk7XHJcblx0XHRzY2hlZHVsZV9wcmV2aWV3X3JlZnJlc2goKTtcclxuXHRcdHNldFRpbWVvdXQoIHNjaGVkdWxlX3ByZXZpZXdfcmVmcmVzaCwgNjAwICk7XHJcblx0fSApO1xyXG59KCBqUXVlcnksIHdpbmRvdyApICk7XHJcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDRSxXQUFXQSxDQUFDLEVBQUVDLENBQUMsRUFBRztFQUNuQixZQUFZOztFQUVaLElBQUlDLEdBQUcsR0FBR0QsQ0FBQyxDQUFDRSw4QkFBOEIsSUFBSSxDQUFDLENBQUM7RUFDaEQsSUFBSUMsYUFBYSxHQUFHLENBQUM7RUFDckIsSUFBSUMsYUFBYSxHQUFHLENBQUM7RUFDckIsSUFBSUMsWUFBWSxHQUFHLElBQUk7RUFDdkIsSUFBSUMsUUFBUSxHQUFHLElBQUk7RUFDbkIsSUFBSUMsMkJBQTJCLEdBQUcsK1FBQStRO0VBRWpULFNBQVNDLFNBQVNBLENBQUVDLEtBQUssRUFBRztJQUMzQixPQUFPQyxNQUFNLENBQUVELEtBQUssSUFBSSxFQUFHLENBQUMsQ0FBQ0UsSUFBSSxDQUFDLENBQUM7RUFDcEM7RUFFQSxTQUFTQyxZQUFZQSxDQUFFQyxJQUFJLEVBQUc7SUFDN0IsSUFBSUMsUUFBUSxHQUFHRCxJQUFJLENBQUNFLElBQUksQ0FBRSxlQUFnQixDQUFDO0lBQzNDLElBQUlDLEtBQUssR0FBR0gsSUFBSSxDQUFDSSxPQUFPLENBQUUsd0JBQXlCLENBQUMsQ0FBQ0MsSUFBSSxDQUFFLGNBQWUsQ0FBQztJQUMzRSxJQUFJQyxPQUFPLEdBQUdwQixDQUFDLENBQUUsNENBQTZDLENBQUM7SUFFL0RpQixLQUFLLENBQUNELElBQUksQ0FBRSxlQUFlLEVBQUUsT0FBUSxDQUFDO0lBQ3RDRixJQUFJLENBQUNFLElBQUksQ0FBRSxlQUFlLEVBQUUsTUFBTyxDQUFDO0lBRXBDSSxPQUFPLENB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
