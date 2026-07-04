"use strict";

/**
 * Appearance / Theme settings page UI.
 */
(function ($, w) {
  'use strict';

  var cfg = w.wpbc_settings_themes_page || {};
  var preview_ajax = null;
  var preview_timer = 0;
  var preview_notice_timer = 0;
  var preview_notice_message_timer = 0;
  function trim_text(value) {
    return String(value || '').trim();
  }
  function make_asset_url(path) {
    path = String(path || '');
    if (/^https?:\/\//i.test(path) || /^\/\//.test(path)) {
      return path;
    }
    return String(cfg.plugin_url || '').replace(/\/$/, '') + path;
  }
  function show_message(message, type, delay) {
    if (typeof w.wpbc_admin_show_message === 'function') {
      w.wpbc_admin_show_message(message, type || 'info', delay || 4000, false);
    }
  }
  function pulse_element($element, duration) {
    if (!$element || !$element.length) {
      return;
    }
    $element.removeClass('wpbc_theme_attention_pulse').each(function () {
      void this.offsetWidth;
    }).addClass('wpbc_theme_attention_pulse');
    setTimeout(function () {
      $element.removeClass('wpbc_theme_attention_pulse');
    }, duration || 2100);
  }
  function pulse_latest_warning_notice() {
    clearTimeout(preview_notice_message_timer);
    preview_notice_message_timer = setTimeout(function () {
      pulse_element($('#ajax_working .wpbc_inner_message.notice-warning').last());
    }, 50);
  }
  function show_highlighted_notice(message, type, delay, $control) {
    if ($control && $control.length) {
      pulse_element($control);
    }
    show_message(message, type || 'warning', delay || 9000);
    pulse_latest_warning_notice();
  }
  function switch_panel($tab) {
    var panel_id = $tab.attr('aria-controls');
    var $tabs = $tab.closest('.wpbc_theme_rightbar_tabs').find('[role="tab"]');
    var $panels = $('.wpbc_theme_rightbar_panels [role="tabpanel"]');
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
  function get_form() {
    return $('[data-wpbc-theme-settings-form="1"]').first();
  }
  function collect_payload() {
    var $form = get_form();
    var data = {};
    $.each($form.serializeArray(), function (index, item) {
      data[item.name] = item.value;
    });
    data.booking_timeslot_picker = $form.find('[name="booking_timeslot_picker"]').prop('checked') ? 'On' : 'Off';
    data.resource_id = $('#wpbc_theme_resource_id').val() || '';
    data.months_count = $('#wpbc_theme_months_count').val() || '';
    data.preview_mode = $('#wpbc_theme_preview_mode').val() || 'calendar';
    data.custom_booking_form = $('#wpbc_theme_custom_form').val() || 'standard';
    return data;
  }
  function apply_form_theme() {
    var theme = get_form().find('[name="booking_form_theme"]:checked').val() || '';
    var $preview = $('[data-wpbc-theme-preview="1"]');
    $preview.removeClass('wpbc_theme_dark_1');
    if (theme) {
      $preview.addClass(theme);
    }
    $('.wpbc_theme_choice').removeClass('is-selected');
    get_form().find('[name="booking_form_theme"]:checked').closest('.wpbc_theme_choice').addClass('is-selected');
  }
  function apply_calendar_skin() {
    var $select = $('[data-wpbc-theme-calendar-skin="1"]');
    var value = $select.find('option:selected').attr('data-wpbc-calendar-skin-url') || $select.val() || '';
    var skin_url = value ? make_asset_url(value) : '';
    if (skin_url && typeof w.wpbc__calendar__change_skin === 'function' && $('#wpbc-calendar-skin-css').length) {
      w.wpbc__calendar__change_skin(skin_url);
    }
  }
  function apply_time_skin() {
    var value = $('[data-wpbc-theme-time-skin="1"]').val() || '';
    var skin_url = value ? make_asset_url(value) : '';
    if (skin_url && typeof w.wpbc__css__change_skin === 'function' && $('#wpbc-time_picker-skin-css').length) {
      w.wpbc__css__change_skin(skin_url, 'wpbc-time_picker-skin-css');
    }
  }
  function select_if_option_exists($select, value) {
    var $option;
    if (!$select.length || !value) {
      return false;
    }
    $option = $select.find('option[value="' + value + '"]');
    if (!$option.length) {
      return false;
    }
    if ($select.val() === value) {
      return false;
    }
    $select.val(value).trigger('change');
    return true;
  }
  function parse_number_list(value) {
    if (Array.isArray(value)) {
      return $.map(value, function (item) {
        var parsed = parseInt(item, 10);
        return isNaN(parsed) ? null : parsed;
      });
    }
    return $.map(String(value || '').split(/\s*,\s*/), function (item) {
      var parsed = parseInt(item, 10);
      return '' === item || isNaN(parsed) ? null : parsed;
    });
  }
  function set_calendar_param(resource_id, key, value) {
    if (w._wpbc && typeof w._wpbc.calendar__set_param_value === 'function') {
      w._wpbc.calendar__set_param_value(resource_id, key, value);
    }
  }
  function apply_days_selection_to_calendar(resource_id, days_selection, should_reinit) {
    var ds = days_selection || {};
    var fixed_week_days;
    var dynamic_specific;
    var dynamic_week_days;
    if (!resource_id || !w._wpbc || typeof w._wpbc.calendar__set_param_value !== 'function') {
      return;
    }
    fixed_week_days = parse_number_list(ds.fixed__week_days__start);
    dynamic_specific = parse_number_list(ds.dynamic__days_specific);
    dynamic_week_days = parse_number_list(ds.dynamic__week_days__start);
    set_calendar_param(resource_id, 'days_select_mode', String(ds.days_select_mode || 'multiple'));
    set_calendar_param(resource_id, 'fixed__days_num', parseInt(ds.fixed__days_num || 0, 10));
    set_calendar_param(resource_id, 'fixed__week_days__start', fixed_week_days.length ? fixed_week_days : [-1]);
    set_calendar_param(resource_id, 'dynamic__days_min', parseInt(ds.dynamic__days_min || 0, 10));
    set_calendar_param(resource_id, 'dynamic__days_max', parseInt(ds.dynamic__days_max || 0, 10));
    set_calendar_param(resource_id, 'dynamic__days_specific', dynamic_specific);
    set_calendar_param(resource_id, 'dynamic__week_days__start', dynamic_week_days.length ? dynamic_week_days : [-1]);
    if (typeof w.wpbc__conditions__SAVE_INITIAL__days_selection_params__bm === 'function') {
      w.wpbc__conditions__SAVE_INITIAL__days_selection_params__bm(resource_id);
    }
    if (should_reinit && typeof w.wpbc_cal__re_init === 'function') {
      w.wpbc_cal__re_init(resource_id);
    }
  }
  function ensure_calendar_only_days_selection() {
    var $preview = $('[data-wpbc-theme-preview="1"]').first();
    var preview_mode = $preview.attr('data-preview-mode') || $('#wpbc_theme_preview_mode').val() || 'calendar';
    var resource_id = parseInt($preview.attr('data-resource-id') || 0, 10);
    var expected = cfg.days_selection || {};
    var expected_mode = String(expected.days_select_mode || 'multiple');
    var current_mode = null;
    var $calendar;
    var should_reinit = false;
    if ('calendar' !== preview_mode || !resource_id || !expected_mode) {
      return;
    }
    if (!w._wpbc || typeof w._wpbc.calendar__get_param_value !== 'function') {
      return;
    }
    current_mode = w._wpbc.calendar__get_param_value(resource_id, 'days_select_mode');
    if (String(current_mode || '') === expected_mode) {
      return;
    }
    $calendar = $('#calendar_booking' + resource_id);
    should_reinit = $calendar.length && $calendar.hasClass('hasDatepick');
    apply_days_selection_to_calendar(resource_id, expected, should_reinit);
  }
  function apply_related_skins_for_theme(theme) {
    var calendar_skin = theme ? '/css/skins/24_9__dark_1.css' : '/css/skins/25_5__square_1.css';
    var time_skin = theme ? '/css/time_picker_skins/black.css' : '/css/time_picker_skins/light__24_8.css';
    select_if_option_exists($('[data-wpbc-theme-calendar-skin="1"]'), calendar_skin);
    select_if_option_exists($('[data-wpbc-theme-time-skin="1"]'), time_skin);
  }
  function pulse_preview_mode_control() {
    var $control = $('.wpbc_theme_control_preview_mode').first();
    pulse_element($control);
    clearTimeout(preview_notice_timer);
    preview_notice_timer = setTimeout(function () {
      $control.removeClass('wpbc_theme_attention_pulse');
    }, 2100);
  }
  function get_preview_notice_message(notice_type) {
    var i18n = cfg.i18n || {};
    if ('form' === notice_type) {
      return i18n.form_preview_option_notice || 'This option is visible in the Booking form preview. Switch Preview to Booking form to inspect it.';
    }
    return '';
  }
  function maybe_show_preview_notice($source) {
    var notice_type = $source.attr('data-wpbc-theme-preview-notice') || '';
    var preview_mode = $('#wpbc_theme_preview_mode').val() || 'calendar';
    var message = get_preview_notice_message(notice_type);
    var $control = $('.wpbc_theme_control_preview_mode').first();
    if (!message) {
      return;
    }
    if ('form' === notice_type && 'calendar' !== preview_mode) {
      return;
    }
    if ('form' === notice_type) {
      pulse_preview_mode_control();
      show_highlighted_notice(message, 'warning', 9000);
      return;
    }
    show_highlighted_notice(message, 'warning', 9000, $control);
  }
  function show_calendar_only_theme_notice() {
    var preview_mode = $('#wpbc_theme_preview_mode').val() || 'calendar';
    if ('calendar' !== preview_mode) {
      return;
    }
    pulse_preview_mode_control();
    show_highlighted_notice(cfg.i18n && cfg.i18n.calendar_only_theme_notice ? cfg.i18n.calendar_only_theme_notice : 'Preview is set to Calendar only. Switch Preview to Booking form to inspect the form theme.', 'warning', 9000);
  }
  function sync_time_picker_preview() {
    var is_enabled = get_form().find('[name="booking_timeslot_picker"]').prop('checked');
    var $preview = $('[data-wpbc-theme-preview="1"]');
    var time_selectors = 'select[name^="rangetime"], select[name^="starttime"], select[name^="endtime"], select[name^="durationtime"]';
    if (w._wpbc && typeof w._wpbc.set_other_param === 'function') {
      w._wpbc.set_other_param('is_enabled_booking_timeslot_picker', !!is_enabled);
    }
    if (is_enabled) {
      if (w._wpbc && typeof w.wpbc_hook__init_timeselector === 'function') {
        w.wpbc_hook__init_timeselector();
      }
      return;
    }
    $preview.find('.wpbc_times_selector').remove();
    $preview.find(time_selectors).show();
  }
  function refresh_preview_mode_controls() {
    var preview_mode = $('#wpbc_theme_preview_mode').val() || 'calendar';
    $('[data-wpbc-theme-form-control="1"]').toggleClass('is-visible', 'form' === preview_mode);
  }
  function set_calendar_loading(is_loading) {
    var $panel = $('[data-wpbc-theme-calendar-panel="1"]');
    $panel.toggleClass('is-loading', !!is_loading);
    $panel.find('.wpbc_theme_calendar_loading').remove();
    if (is_loading) {
      $panel.append('<div class="wpbc_calendar_loading wpbc_theme_calendar_loading">' + '<span class="wpbc_icn_autorenew wpbc_animation_spin"></span>&nbsp;' + trim_text(cfg.i18n && cfg.i18n.loading ? cfg.i18n.loading : 'Loading') + '</div>');
    }
  }
  function refresh_preview() {
    var data = collect_payload();
    if (preview_ajax && preview_ajax.readyState !== 4) {
      preview_ajax.abort();
    }
    data.action = cfg.preview_action;
    data.nonce = cfg.nonce;
    set_calendar_loading(true);
    preview_ajax = $.post(cfg.ajax_url, data).done(function (response) {
      if (response && response.success && response.data && response.data.html) {
        $('[data-wpbc-theme-preview="1"]').replaceWith(response.data.html);
        if (response.data.days_selection) {
          cfg.days_selection = response.data.days_selection;
        }
        apply_form_theme();
        apply_calendar_skin();
        apply_time_skin();
        ensure_calendar_only_days_selection();
        sync_time_picker_preview();
        return;
      }
      show_message(response && response.data && response.data.message ? response.data.message : cfg.i18n && cfg.i18n.preview_failed ? cfg.i18n.preview_failed : 'Unable to refresh calendar preview.', 'error', 10000);
    }).fail(function (xhr, text_status) {
      if ('abort' === text_status) {
        return;
      }
      show_message(cfg.i18n && cfg.i18n.preview_failed ? cfg.i18n.preview_failed : 'Unable to refresh calendar preview.', 'error', 10000);
    }).always(function () {
      set_calendar_loading(false);
    });
  }
  function schedule_preview_refresh() {
    clearTimeout(preview_timer);
    preview_timer = setTimeout(refresh_preview, 180);
  }
  function save_settings() {
    var $button = $('[data-wpbc-theme-save="1"]');
    var original_text = $button.data('wpbc-original-text');
    var data = collect_payload();
    if (!original_text) {
      original_text = $button.html();
      $button.data('wpbc-original-text', original_text);
    }
    data.action = cfg.action;
    data.nonce = cfg.nonce;
    $button.addClass('disabled').attr('aria-disabled', 'true');
    $button.find('.in-button-text').html('&nbsp;&nbsp;' + trim_text(cfg.i18n && cfg.i18n.saving ? cfg.i18n.saving : 'Saving') + '...');
    $.post(cfg.ajax_url, data).done(function (response) {
      if (response && response.success) {
        show_message(response.data && response.data.message ? response.data.message : cfg.i18n && cfg.i18n.saved ? cfg.i18n.saved : 'Saved', 'success', 3000);
        cfg.settings = response.data && response.data.settings ? response.data.settings : cfg.settings;
        return;
      }
      show_message(response && response.data && response.data.message ? response.data.message : cfg.i18n && cfg.i18n.save_failed ? cfg.i18n.save_failed : 'Unable to save appearance settings.', 'error', 10000);
    }).fail(function () {
      show_message(cfg.i18n && cfg.i18n.save_failed ? cfg.i18n.save_failed : 'Unable to save appearance settings.', 'error', 10000);
    }).always(function () {
      $button.removeClass('disabled').removeAttr('aria-disabled').html(original_text);
    });
  }
  function bind_events() {
    $(document).on('click', '.wpbc_theme_rightbar_tabs [role="tab"]', function (event) {
      event.preventDefault();
      switch_panel($(this));
    });
    $(document).on('click', '.wpbc_theme_premium_dismiss a', function (event) {
      event.stopPropagation();
    });
    $(document).on('click', '.wpbc_theme_rightbar_panels .wpbc_ui__collapsible_group > .group__header', function (event) {
      event.preventDefault();
      toggle_group($(this));
    });
    $(document).on('click', '[data-wpbc-theme-save="1"]', function (event) {
      event.preventDefault();
      if (!$(this).hasClass('disabled')) {
        save_settings();
      }
    });
    $(document).on('submit', '[data-wpbc-theme-settings-form="1"]', function () {
      return true;
    });
    $(document).on('change', '[name="booking_form_theme"]', function () {
      apply_form_theme();
      apply_related_skins_for_theme($(this).val() || '');
      show_calendar_only_theme_notice();
    });
    $(document).on('change', '[data-wpbc-theme-calendar-skin="1"]', function () {
      apply_calendar_skin();
    });
    $(document).on('change', '[data-wpbc-theme-time-skin="1"]', function () {
      apply_time_skin();
    });
    $(document).on('change', '[name="booking_timeslot_picker"]', function () {
      sync_time_picker_preview();
      schedule_preview_refresh();
    });
    $(document).on('change', '[data-wpbc-theme-preview-notice]', function () {
      maybe_show_preview_notice($(this));
    });
    $(document).on('change', '#wpbc_theme_resource_id, #wpbc_theme_months_count, #wpbc_theme_custom_form', function () {
      schedule_preview_refresh();
    });
    $(document).on('change', '#wpbc_theme_preview_mode', function () {
      refresh_preview_mode_controls();
      schedule_preview_refresh();
    });
  }
  $(function () {
    if (!$('[data-wpbc-theme-page="1"]').length) {
      return;
    }
    bind_events();
    refresh_preview_mode_controls();
    apply_form_theme();
    ensure_calendar_only_days_selection();
    sync_time_picker_preview();
  });
})(jQuery, window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR0aW5ncy10aGVtZXMvX291dC9zZXR0aW5nc190aGVtZXNfcGFnZS5qcyIsIm5hbWVzIjpbIiQiLCJ3IiwiY2ZnIiwid3BiY19zZXR0aW5nc190aGVtZXNfcGFnZSIsInByZXZpZXdfYWpheCIsInByZXZpZXdfdGltZXIiLCJwcmV2aWV3X25vdGljZV90aW1lciIsInByZXZpZXdfbm90aWNlX21lc3NhZ2VfdGltZXIiLCJ0cmltX3RleHQiLCJ2YWx1ZSIsIlN0cmluZyIsInRyaW0iLCJtYWtlX2Fzc2V0X3VybCIsInBhdGgiLCJ0ZXN0IiwicGx1Z2luX3VybCIsInJlcGxhY2UiLCJzaG93X21lc3NhZ2UiLCJtZXNzYWdlIiwidHlwZSIsImRlbGF5Iiwid3BiY19hZG1pbl9zaG93X21lc3NhZ2UiLCJwdWxzZV9lbGVtZW50IiwiJGVsZW1lbnQiLCJkdXJhdGlvbiIsImxlbmd0aCIsInJlbW92ZUNsYXNzIiwiZWFjaCIsIm9mZnNldFdpZHRoIiwiYWRkQ2xhc3MiLCJzZXRUaW1lb3V0IiwicHVsc2VfbGF0ZXN0X3dhcm5pbmdfbm90aWNlIiwiY2xlYXJUaW1lb3V0IiwibGFzdCIsInNob3dfaGlnaGxpZ2h0ZWRfbm90aWNlIiwiJGNvbnRyb2wiLCJzd2l0Y2hfcGFuZWwiLCIkdGFiIiwicGFuZWxfaWQiLCJhdHRyIiwiJHRhYnMiLCJjbG9zZXN0IiwiZmluZCIsIiRwYW5lbHMiLCJyZW1vdmVBdHRyIiwidG9nZ2xlX2dyb3VwIiwiJGJ1dHRvbiIsIiRncm91cCIsIiRmaWVsZHMiLCJpc19vcGVuIiwiaGFzQ2xhc3MiLCJ0b2dnbGVDbGFzcyIsInByb3AiLCJnZXRfZm9ybSIsImZpcnN0IiwiY29sbGVjdF9wYXlsb2FkIiwiJGZvcm0iLCJkYXRhIiwic2VyaWFsaXplQXJyYXkiLCJpbmRleCIsIml0ZW0iLCJuYW1lIiwiYm9va2luZ190aW1lc2xvdF9waWNrZXIiLCJyZXNvdXJjZV9pZCIsInZhbCIsIm1vbnRoc19jb3VudCIsInByZXZpZXdfbW9kZSIsImN1c3RvbV9ib29raW5nX2Zvcm0iLCJhcHBseV9mb3JtX3RoZW1lIiwidGhlbWUiLCIkcHJldmlldyIsImFwcGx5X2NhbGVuZGFyX3NraW4iLCIkc2VsZWN0Iiwic2tpbl91cmwiLCJ3cGJjX19jYWxlbmRhcl9fY2hhbmdlX3NraW4iLCJhcHBseV90aW1lX3NraW4iLCJ3cGJjX19jc3NfX2NoYW5nZV9za2luIiwic2VsZWN0X2lmX29wdGlvbl9leGlzdHMiLCIkb3B0aW9uIiwidHJpZ2dlciIsInBhcnNlX251bWJlcl9saXN0IiwiQXJyYXkiLCJpc0FycmF5IiwibWFwIiwicGFyc2VkIiwicGFyc2VJbnQiLCJpc05hTiIsInNwbGl0Iiwic2V0X2NhbGVuZGFyX3BhcmFtIiwia2V5IiwiX3dwYmMiLCJjYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlIiwiYXBwbHlfZGF5c19zZWxlY3Rpb25fdG9fY2FsZW5kYXIiLCJkYXlzX3NlbGVjdGlvbiIsInNob3VsZF9yZWluaXQiLCJkcyIsImZpeGVkX3dlZWtfZGF5cyIsImR5bmFtaWNfc3BlY2lmaWMiLCJkeW5hbWljX3dlZWtfZGF5cyIsImZpeGVkX193ZWVrX2RheXNfX3N0YXJ0IiwiZHluYW1pY19fZGF5c19zcGVjaWZpYyIsImR5bmFtaWNfX3dlZWtfZGF5c19fc3RhcnQiLCJkYXlzX3NlbGVjdF9tb2RlIiwiZml4ZWRfX2RheXNfbnVtIiwiZHluYW1pY19fZGF5c19taW4iLCJkeW5hbWljX19kYXlzX21heCIsIndwYmNfX2NvbmRpdGlvbnNfX1NBVkVfSU5JVElBTF9fZGF5c19zZWxlY3Rpb25fcGFyYW1zX19ibSIsIndwYmNfY2FsX19yZV9pbml0IiwiZW5zdXJlX2NhbGVuZGFyX29ubHlfZGF5c19zZWxlY3Rpb24iLCJleHBlY3RlZCIsImV4cGVjdGVkX21vZGUiLCJjdXJyZW50X21vZGUiLCIkY2FsZW5kYXIiLCJjYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlIiwiYXBwbHlfcmVsYXRlZF9za2luc19mb3JfdGhlbWUiLCJjYWxlbmRhcl9za2luIiwidGltZV9za2luIiwicHVsc2VfcHJldmlld19tb2RlX2NvbnRyb2wiLCJnZXRfcHJldmlld19ub3RpY2VfbWVzc2FnZSIsIm5vdGljZV90eXBlIiwiaTE4biIsImZvcm1fcHJldmlld19vcHRpb25fbm90aWNlIiwibWF5YmVfc2hvd19wcmV2aWV3X25vdGljZSIsIiRzb3VyY2UiLCJzaG93X2NhbGVuZGFyX29ubHlfdGhlbWVfbm90aWNlIiwiY2FsZW5kYXJfb25seV90aGVtZV9ub3RpY2UiLCJzeW5jX3RpbWVfcGlja2VyX3ByZXZpZXciLCJpc19lbmFibGVkIiwidGltZV9zZWxlY3RvcnMiLCJzZXRfb3RoZXJfcGFyYW0iLCJ3cGJjX2hvb2tfX2luaXRfdGltZXNlbGVjdG9yIiwicmVtb3ZlIiwic2hvdyIsInJlZnJlc2hfcHJldmlld19tb2RlX2NvbnRyb2xzIiwic2V0X2NhbGVuZGFyX2xvYWRpbmciLCJpc19sb2FkaW5nIiwiJHBhbmVsIiwiYXBwZW5kIiwibG9hZGluZyIsInJlZnJlc2hfcHJldmlldyIsInJlYWR5U3RhdGUiLCJhYm9ydCIsImFjdGlvbiIsInByZXZpZXdfYWN0aW9uIiwibm9uY2UiLCJwb3N0IiwiYWpheF91cmwiLCJkb25lIiwicmVzcG9uc2UiLCJzdWNjZXNzIiwiaHRtbCIsInJlcGxhY2VXaXRoIiwicHJldmlld19mYWlsZWQiLCJmYWlsIiwieGhyIiwidGV4dF9zdGF0dXMiLCJhbHdheXMiLCJzY2hlZHVsZV9wcmV2aWV3X3JlZnJlc2giLCJzYXZlX3NldHRpbmdzIiwib3JpZ2luYWxfdGV4dCIsInNhdmluZyIsInNhdmVkIiwic2V0dGluZ3MiLCJzYXZlX2ZhaWxlZCIsImJpbmRfZXZlbnRzIiwiZG9jdW1lbnQiLCJvbiIsImV2ZW50IiwicHJldmVudERlZmF1bHQiLCJzdG9wUHJvcGFnYXRpb24iLCJqUXVlcnkiLCJ3aW5kb3ciXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLXNldHRpbmdzLXRoZW1lcy9fc3JjL3NldHRpbmdzX3RoZW1lc19wYWdlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQXBwZWFyYW5jZSAvIFRoZW1lIHNldHRpbmdzIHBhZ2UgVUkuXG4gKi9cbiggZnVuY3Rpb24gKCAkLCB3ICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIGNmZyA9IHcud3BiY19zZXR0aW5nc190aGVtZXNfcGFnZSB8fCB7fTtcblx0dmFyIHByZXZpZXdfYWpheCA9IG51bGw7XG5cdHZhciBwcmV2aWV3X3RpbWVyID0gMDtcblx0dmFyIHByZXZpZXdfbm90aWNlX3RpbWVyID0gMDtcblx0dmFyIHByZXZpZXdfbm90aWNlX21lc3NhZ2VfdGltZXIgPSAwO1xuXG5cdGZ1bmN0aW9uIHRyaW1fdGV4dCggdmFsdWUgKSB7XG5cdFx0cmV0dXJuIFN0cmluZyggdmFsdWUgfHwgJycgKS50cmltKCk7XG5cdH1cblxuXHRmdW5jdGlvbiBtYWtlX2Fzc2V0X3VybCggcGF0aCApIHtcblx0XHRwYXRoID0gU3RyaW5nKCBwYXRoIHx8ICcnICk7XG5cdFx0aWYgKCAvXmh0dHBzPzpcXC9cXC8vaS50ZXN0KCBwYXRoICkgfHwgL15cXC9cXC8vLnRlc3QoIHBhdGggKSApIHtcblx0XHRcdHJldHVybiBwYXRoO1xuXHRcdH1cblx0XHRyZXR1cm4gU3RyaW5nKCBjZmcucGx1Z2luX3VybCB8fCAnJyApLnJlcGxhY2UoIC9cXC8kLywgJycgKSArIHBhdGg7XG5cdH1cblxuXHRmdW5jdGlvbiBzaG93X21lc3NhZ2UoIG1lc3NhZ2UsIHR5cGUsIGRlbGF5ICkge1xuXHRcdGlmICggdHlwZW9mIHcud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHR3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCBtZXNzYWdlLCB0eXBlIHx8ICdpbmZvJywgZGVsYXkgfHwgNDAwMCwgZmFsc2UgKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBwdWxzZV9lbGVtZW50KCAkZWxlbWVudCwgZHVyYXRpb24gKSB7XG5cdFx0aWYgKCAhICRlbGVtZW50IHx8ICEgJGVsZW1lbnQubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdCRlbGVtZW50XG5cdFx0XHQucmVtb3ZlQ2xhc3MoICd3cGJjX3RoZW1lX2F0dGVudGlvbl9wdWxzZScgKVxuXHRcdFx0LmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0dm9pZCB0aGlzLm9mZnNldFdpZHRoO1xuXHRcdFx0fSApXG5cdFx0XHQuYWRkQ2xhc3MoICd3cGJjX3RoZW1lX2F0dGVudGlvbl9wdWxzZScgKTtcblxuXHRcdHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdCRlbGVtZW50LnJlbW92ZUNsYXNzKCAnd3BiY190aGVtZV9hdHRlbnRpb25fcHVsc2UnICk7XG5cdFx0fSwgZHVyYXRpb24gfHwgMjEwMCApO1xuXHR9XG5cblx0ZnVuY3Rpb24gcHVsc2VfbGF0ZXN0X3dhcm5pbmdfbm90aWNlKCkge1xuXHRcdGNsZWFyVGltZW91dCggcHJldmlld19ub3RpY2VfbWVzc2FnZV90aW1lciApO1xuXHRcdHByZXZpZXdfbm90aWNlX21lc3NhZ2VfdGltZXIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRwdWxzZV9lbGVtZW50KCAkKCAnI2FqYXhfd29ya2luZyAud3BiY19pbm5lcl9tZXNzYWdlLm5vdGljZS13YXJuaW5nJyApLmxhc3QoKSApO1xuXHRcdH0sIDUwICk7XG5cdH1cblxuXHRmdW5jdGlvbiBzaG93X2hpZ2hsaWdodGVkX25vdGljZSggbWVzc2FnZSwgdHlwZSwgZGVsYXksICRjb250cm9sICkge1xuXHRcdGlmICggJGNvbnRyb2wgJiYgJGNvbnRyb2wubGVuZ3RoICkge1xuXHRcdFx0cHVsc2VfZWxlbWVudCggJGNvbnRyb2wgKTtcblx0XHR9XG5cblx0XHRzaG93X21lc3NhZ2UoIG1lc3NhZ2UsIHR5cGUgfHwgJ3dhcm5pbmcnLCBkZWxheSB8fCA5MDAwICk7XG5cdFx0cHVsc2VfbGF0ZXN0X3dhcm5pbmdfbm90aWNlKCk7XG5cdH1cblxuXHRmdW5jdGlvbiBzd2l0Y2hfcGFuZWwoICR0YWIgKSB7XG5cdFx0dmFyIHBhbmVsX2lkID0gJHRhYi5hdHRyKCAnYXJpYS1jb250cm9scycgKTtcblx0XHR2YXIgJHRhYnMgPSAkdGFiLmNsb3Nlc3QoICcud3BiY190aGVtZV9yaWdodGJhcl90YWJzJyApLmZpbmQoICdbcm9sZT1cInRhYlwiXScgKTtcblx0XHR2YXIgJHBhbmVscyA9ICQoICcud3BiY190aGVtZV9yaWdodGJhcl9wYW5lbHMgW3JvbGU9XCJ0YWJwYW5lbFwiXScgKTtcblxuXHRcdCR0YWJzLmF0dHIoICdhcmlhLXNlbGVjdGVkJywgJ2ZhbHNlJyApO1xuXHRcdCR0YWIuYXR0ciggJ2FyaWEtc2VsZWN0ZWQnLCAndHJ1ZScgKTtcblxuXHRcdCRwYW5lbHMuYXR0ciggJ2hpZGRlbicsICdoaWRkZW4nICkuYXR0ciggJ2FyaWEtaGlkZGVuJywgJ3RydWUnICk7XG5cdFx0JCggJyMnICsgcGFuZWxfaWQgKS5yZW1vdmVBdHRyKCAnaGlkZGVuJyApLmF0dHIoICdhcmlhLWhpZGRlbicsICdmYWxzZScgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHRvZ2dsZV9ncm91cCggJGJ1dHRvbiApIHtcblx0XHR2YXIgJGdyb3VwID0gJGJ1dHRvbi5jbG9zZXN0KCAnLndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwJyApO1xuXHRcdHZhciAkZmllbGRzID0gJGdyb3VwLmZpbmQoICc+IC5ncm91cF9fZmllbGRzJyApO1xuXHRcdHZhciBpc19vcGVuID0gJGdyb3VwLmhhc0NsYXNzKCAnaXMtb3BlbicgKTtcblxuXHRcdCRncm91cC50b2dnbGVDbGFzcyggJ2lzLW9wZW4nLCAhIGlzX29wZW4gKTtcblx0XHQkYnV0dG9uLmF0dHIoICdhcmlhLWV4cGFuZGVkJywgaXNfb3BlbiA/ICdmYWxzZScgOiAndHJ1ZScgKTtcblx0XHQkZmllbGRzLnByb3AoICdoaWRkZW4nLCBpc19vcGVuICkuYXR0ciggJ2FyaWEtaGlkZGVuJywgaXNfb3BlbiA/ICd0cnVlJyA6ICdmYWxzZScgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldF9mb3JtKCkge1xuXHRcdHJldHVybiAkKCAnW2RhdGEtd3BiYy10aGVtZS1zZXR0aW5ncy1mb3JtPVwiMVwiXScgKS5maXJzdCgpO1xuXHR9XG5cblx0ZnVuY3Rpb24gY29sbGVjdF9wYXlsb2FkKCkge1xuXHRcdHZhciAkZm9ybSA9IGdldF9mb3JtKCk7XG5cdFx0dmFyIGRhdGEgPSB7fTtcblxuXHRcdCQuZWFjaCggJGZvcm0uc2VyaWFsaXplQXJyYXkoKSwgZnVuY3Rpb24gKCBpbmRleCwgaXRlbSApIHtcblx0XHRcdGRhdGFbIGl0ZW0ubmFtZSBdID0gaXRlbS52YWx1ZTtcblx0XHR9ICk7XG5cblx0XHRkYXRhLmJvb2tpbmdfdGltZXNsb3RfcGlja2VyID0gJGZvcm0uZmluZCggJ1tuYW1lPVwiYm9va2luZ190aW1lc2xvdF9waWNrZXJcIl0nICkucHJvcCggJ2NoZWNrZWQnICkgPyAnT24nIDogJ09mZic7XG5cdFx0ZGF0YS5yZXNvdXJjZV9pZCA9ICQoICcjd3BiY190aGVtZV9yZXNvdXJjZV9pZCcgKS52YWwoKSB8fCAnJztcblx0XHRkYXRhLm1vbnRoc19jb3VudCA9ICQoICcjd3BiY190aGVtZV9tb250aHNfY291bnQnICkudmFsKCkgfHwgJyc7XG5cdFx0ZGF0YS5wcmV2aWV3X21vZGUgPSAkKCAnI3dwYmNfdGhlbWVfcHJldmlld19tb2RlJyApLnZhbCgpIHx8ICdjYWxlbmRhcic7XG5cdFx0ZGF0YS5jdXN0b21fYm9va2luZ19mb3JtID0gJCggJyN3cGJjX3RoZW1lX2N1c3RvbV9mb3JtJyApLnZhbCgpIHx8ICdzdGFuZGFyZCc7XG5cblx0XHRyZXR1cm4gZGF0YTtcblx0fVxuXG5cdGZ1bmN0aW9uIGFwcGx5X2Zvcm1fdGhlbWUoKSB7XG5cdFx0dmFyIHRoZW1lID0gZ2V0X2Zvcm0oKS5maW5kKCAnW25hbWU9XCJib29raW5nX2Zvcm1fdGhlbWVcIl06Y2hlY2tlZCcgKS52YWwoKSB8fCAnJztcblx0XHR2YXIgJHByZXZpZXcgPSAkKCAnW2RhdGEtd3BiYy10aGVtZS1wcmV2aWV3PVwiMVwiXScgKTtcblxuXHRcdCRwcmV2aWV3LnJlbW92ZUNsYXNzKCAnd3BiY190aGVtZV9kYXJrXzEnICk7XG5cdFx0aWYgKCB0aGVtZSApIHtcblx0XHRcdCRwcmV2aWV3LmFkZENsYXNzKCB0aGVtZSApO1xuXHRcdH1cblxuXHRcdCQoICcud3BiY190aGVtZV9jaG9pY2UnICkucmVtb3ZlQ2xhc3MoICdpcy1zZWxlY3RlZCcgKTtcblx0XHRnZXRfZm9ybSgpLmZpbmQoICdbbmFtZT1cImJvb2tpbmdfZm9ybV90aGVtZVwiXTpjaGVja2VkJyApLmNsb3Nlc3QoICcud3BiY190aGVtZV9jaG9pY2UnICkuYWRkQ2xhc3MoICdpcy1zZWxlY3RlZCcgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGFwcGx5X2NhbGVuZGFyX3NraW4oKSB7XG5cdFx0dmFyICRzZWxlY3QgPSAkKCAnW2RhdGEtd3BiYy10aGVtZS1jYWxlbmRhci1za2luPVwiMVwiXScgKTtcblx0XHR2YXIgdmFsdWUgPSAkc2VsZWN0LmZpbmQoICdvcHRpb246c2VsZWN0ZWQnICkuYXR0ciggJ2RhdGEtd3BiYy1jYWxlbmRhci1za2luLXVybCcgKSB8fCAkc2VsZWN0LnZhbCgpIHx8ICcnO1xuXHRcdHZhciBza2luX3VybCA9IHZhbHVlID8gbWFrZV9hc3NldF91cmwoIHZhbHVlICkgOiAnJztcblxuXHRcdGlmICggc2tpbl91cmwgJiYgdHlwZW9mIHcud3BiY19fY2FsZW5kYXJfX2NoYW5nZV9za2luID09PSAnZnVuY3Rpb24nICYmICQoICcjd3BiYy1jYWxlbmRhci1za2luLWNzcycgKS5sZW5ndGggKSB7XG5cdFx0XHR3LndwYmNfX2NhbGVuZGFyX19jaGFuZ2Vfc2tpbiggc2tpbl91cmwgKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBhcHBseV90aW1lX3NraW4oKSB7XG5cdFx0dmFyIHZhbHVlID0gJCggJ1tkYXRhLXdwYmMtdGhlbWUtdGltZS1za2luPVwiMVwiXScgKS52YWwoKSB8fCAnJztcblx0XHR2YXIgc2tpbl91cmwgPSB2YWx1ZSA/IG1ha2VfYXNzZXRfdXJsKCB2YWx1ZSApIDogJyc7XG5cblx0XHRpZiAoIHNraW5fdXJsICYmIHR5cGVvZiB3LndwYmNfX2Nzc19fY2hhbmdlX3NraW4gPT09ICdmdW5jdGlvbicgJiYgJCggJyN3cGJjLXRpbWVfcGlja2VyLXNraW4tY3NzJyApLmxlbmd0aCApIHtcblx0XHRcdHcud3BiY19fY3NzX19jaGFuZ2Vfc2tpbiggc2tpbl91cmwsICd3cGJjLXRpbWVfcGlja2VyLXNraW4tY3NzJyApO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHNlbGVjdF9pZl9vcHRpb25fZXhpc3RzKCAkc2VsZWN0LCB2YWx1ZSApIHtcblx0XHR2YXIgJG9wdGlvbjtcblxuXHRcdGlmICggISAkc2VsZWN0Lmxlbmd0aCB8fCAhIHZhbHVlICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdCRvcHRpb24gPSAkc2VsZWN0LmZpbmQoICdvcHRpb25bdmFsdWU9XCInICsgdmFsdWUgKyAnXCJdJyApO1xuXHRcdGlmICggISAkb3B0aW9uLmxlbmd0aCApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoICRzZWxlY3QudmFsKCkgPT09IHZhbHVlICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdCRzZWxlY3QudmFsKCB2YWx1ZSApLnRyaWdnZXIoICdjaGFuZ2UnICk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRmdW5jdGlvbiBwYXJzZV9udW1iZXJfbGlzdCggdmFsdWUgKSB7XG5cdFx0aWYgKCBBcnJheS5pc0FycmF5KCB2YWx1ZSApICkge1xuXHRcdFx0cmV0dXJuICQubWFwKCB2YWx1ZSwgZnVuY3Rpb24gKCBpdGVtICkge1xuXHRcdFx0XHR2YXIgcGFyc2VkID0gcGFyc2VJbnQoIGl0ZW0sIDEwICk7XG5cdFx0XHRcdHJldHVybiBpc05hTiggcGFyc2VkICkgPyBudWxsIDogcGFyc2VkO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdHJldHVybiAkLm1hcCggU3RyaW5nKCB2YWx1ZSB8fCAnJyApLnNwbGl0KCAvXFxzKixcXHMqLyApLCBmdW5jdGlvbiAoIGl0ZW0gKSB7XG5cdFx0XHR2YXIgcGFyc2VkID0gcGFyc2VJbnQoIGl0ZW0sIDEwICk7XG5cdFx0XHRyZXR1cm4gKCAnJyA9PT0gaXRlbSB8fCBpc05hTiggcGFyc2VkICkgKSA/IG51bGwgOiBwYXJzZWQ7XG5cdFx0fSApO1xuXHR9XG5cblx0ZnVuY3Rpb24gc2V0X2NhbGVuZGFyX3BhcmFtKCByZXNvdXJjZV9pZCwga2V5LCB2YWx1ZSApIHtcblx0XHRpZiAoIHcuX3dwYmMgJiYgdHlwZW9mIHcuX3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdHcuX3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsIGtleSwgdmFsdWUgKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBhcHBseV9kYXlzX3NlbGVjdGlvbl90b19jYWxlbmRhciggcmVzb3VyY2VfaWQsIGRheXNfc2VsZWN0aW9uLCBzaG91bGRfcmVpbml0ICkge1xuXHRcdHZhciBkcyA9IGRheXNfc2VsZWN0aW9uIHx8IHt9O1xuXHRcdHZhciBmaXhlZF93ZWVrX2RheXM7XG5cdFx0dmFyIGR5bmFtaWNfc3BlY2lmaWM7XG5cdFx0dmFyIGR5bmFtaWNfd2Vla19kYXlzO1xuXG5cdFx0aWYgKCAhIHJlc291cmNlX2lkIHx8ICEgdy5fd3BiYyB8fCB0eXBlb2Ygdy5fd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlICE9PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGZpeGVkX3dlZWtfZGF5cyA9IHBhcnNlX251bWJlcl9saXN0KCBkcy5maXhlZF9fd2Vla19kYXlzX19zdGFydCApO1xuXHRcdGR5bmFtaWNfc3BlY2lmaWMgPSBwYXJzZV9udW1iZXJfbGlzdCggZHMuZHluYW1pY19fZGF5c19zcGVjaWZpYyApO1xuXHRcdGR5bmFtaWNfd2Vla19kYXlzID0gcGFyc2VfbnVtYmVyX2xpc3QoIGRzLmR5bmFtaWNfX3dlZWtfZGF5c19fc3RhcnQgKTtcblxuXHRcdHNldF9jYWxlbmRhcl9wYXJhbSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJywgU3RyaW5nKCBkcy5kYXlzX3NlbGVjdF9tb2RlIHx8ICdtdWx0aXBsZScgKSApO1xuXHRcdHNldF9jYWxlbmRhcl9wYXJhbSggcmVzb3VyY2VfaWQsICdmaXhlZF9fZGF5c19udW0nLCBwYXJzZUludCggZHMuZml4ZWRfX2RheXNfbnVtIHx8IDAsIDEwICkgKTtcblx0XHRzZXRfY2FsZW5kYXJfcGFyYW0oIHJlc291cmNlX2lkLCAnZml4ZWRfX3dlZWtfZGF5c19fc3RhcnQnLCBmaXhlZF93ZWVrX2RheXMubGVuZ3RoID8gZml4ZWRfd2Vla19kYXlzIDogWyAtMSBdICk7XG5cdFx0c2V0X2NhbGVuZGFyX3BhcmFtKCByZXNvdXJjZV9pZCwgJ2R5bmFtaWNfX2RheXNfbWluJywgcGFyc2VJbnQoIGRzLmR5bmFtaWNfX2RheXNfbWluIHx8IDAsIDEwICkgKTtcblx0XHRzZXRfY2FsZW5kYXJfcGFyYW0oIHJlc291cmNlX2lkLCAnZHluYW1pY19fZGF5c19tYXgnLCBwYXJzZUludCggZHMuZHluYW1pY19fZGF5c19tYXggfHwgMCwgMTAgKSApO1xuXHRcdHNldF9jYWxlbmRhcl9wYXJhbSggcmVzb3VyY2VfaWQsICdkeW5hbWljX19kYXlzX3NwZWNpZmljJywgZHluYW1pY19zcGVjaWZpYyApO1xuXHRcdHNldF9jYWxlbmRhcl9wYXJhbSggcmVzb3VyY2VfaWQsICdkeW5hbWljX193ZWVrX2RheXNfX3N0YXJ0JywgZHluYW1pY193ZWVrX2RheXMubGVuZ3RoID8gZHluYW1pY193ZWVrX2RheXMgOiBbIC0xIF0gKTtcblxuXHRcdGlmICggdHlwZW9mIHcud3BiY19fY29uZGl0aW9uc19fU0FWRV9JTklUSUFMX19kYXlzX3NlbGVjdGlvbl9wYXJhbXNfX2JtID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0dy53cGJjX19jb25kaXRpb25zX19TQVZFX0lOSVRJQUxfX2RheXNfc2VsZWN0aW9uX3BhcmFtc19fYm0oIHJlc291cmNlX2lkICk7XG5cdFx0fVxuXG5cdFx0aWYgKCBzaG91bGRfcmVpbml0ICYmIHR5cGVvZiB3LndwYmNfY2FsX19yZV9pbml0ID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0dy53cGJjX2NhbF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBlbnN1cmVfY2FsZW5kYXJfb25seV9kYXlzX3NlbGVjdGlvbigpIHtcblx0XHR2YXIgJHByZXZpZXcgPSAkKCAnW2RhdGEtd3BiYy10aGVtZS1wcmV2aWV3PVwiMVwiXScgKS5maXJzdCgpO1xuXHRcdHZhciBwcmV2aWV3X21vZGUgPSAkcHJldmlldy5hdHRyKCAnZGF0YS1wcmV2aWV3LW1vZGUnICkgfHwgJCggJyN3cGJjX3RoZW1lX3ByZXZpZXdfbW9kZScgKS52YWwoKSB8fCAnY2FsZW5kYXInO1xuXHRcdHZhciByZXNvdXJjZV9pZCA9IHBhcnNlSW50KCAkcHJldmlldy5hdHRyKCAnZGF0YS1yZXNvdXJjZS1pZCcgKSB8fCAwLCAxMCApO1xuXHRcdHZhciBleHBlY3RlZCA9IGNmZy5kYXlzX3NlbGVjdGlvbiB8fCB7fTtcblx0XHR2YXIgZXhwZWN0ZWRfbW9kZSA9IFN0cmluZyggZXhwZWN0ZWQuZGF5c19zZWxlY3RfbW9kZSB8fCAnbXVsdGlwbGUnICk7XG5cdFx0dmFyIGN1cnJlbnRfbW9kZSA9IG51bGw7XG5cdFx0dmFyICRjYWxlbmRhcjtcblx0XHR2YXIgc2hvdWxkX3JlaW5pdCA9IGZhbHNlO1xuXG5cdFx0aWYgKCAnY2FsZW5kYXInICE9PSBwcmV2aWV3X21vZGUgfHwgISByZXNvdXJjZV9pZCB8fCAhIGV4cGVjdGVkX21vZGUgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCAhIHcuX3dwYmMgfHwgdHlwZW9mIHcuX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSAhPT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjdXJyZW50X21vZGUgPSB3Ll93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKTtcblx0XHRpZiAoIFN0cmluZyggY3VycmVudF9tb2RlIHx8ICcnICkgPT09IGV4cGVjdGVkX21vZGUgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0JGNhbGVuZGFyID0gJCggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICk7XG5cdFx0c2hvdWxkX3JlaW5pdCA9ICRjYWxlbmRhci5sZW5ndGggJiYgJGNhbGVuZGFyLmhhc0NsYXNzKCAnaGFzRGF0ZXBpY2snICk7XG5cblx0XHRhcHBseV9kYXlzX3NlbGVjdGlvbl90b19jYWxlbmRhciggcmVzb3VyY2VfaWQsIGV4cGVjdGVkLCBzaG91bGRfcmVpbml0ICk7XG5cdH1cblxuXHRmdW5jdGlvbiBhcHBseV9yZWxhdGVkX3NraW5zX2Zvcl90aGVtZSggdGhlbWUgKSB7XG5cdFx0dmFyIGNhbGVuZGFyX3NraW4gPSB0aGVtZSA/ICcvY3NzL3NraW5zLzI0XzlfX2RhcmtfMS5jc3MnIDogJy9jc3Mvc2tpbnMvMjVfNV9fc3F1YXJlXzEuY3NzJztcblx0XHR2YXIgdGltZV9za2luID0gdGhlbWUgPyAnL2Nzcy90aW1lX3BpY2tlcl9za2lucy9ibGFjay5jc3MnIDogJy9jc3MvdGltZV9waWNrZXJfc2tpbnMvbGlnaHRfXzI0XzguY3NzJztcblxuXHRcdHNlbGVjdF9pZl9vcHRpb25fZXhpc3RzKCAkKCAnW2RhdGEtd3BiYy10aGVtZS1jYWxlbmRhci1za2luPVwiMVwiXScgKSwgY2FsZW5kYXJfc2tpbiApO1xuXHRcdHNlbGVjdF9pZl9vcHRpb25fZXhpc3RzKCAkKCAnW2RhdGEtd3BiYy10aGVtZS10aW1lLXNraW49XCIxXCJdJyApLCB0aW1lX3NraW4gKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHB1bHNlX3ByZXZpZXdfbW9kZV9jb250cm9sKCkge1xuXHRcdHZhciAkY29udHJvbCA9ICQoICcud3BiY190aGVtZV9jb250cm9sX3ByZXZpZXdfbW9kZScgKS5maXJzdCgpO1xuXG5cdFx0cHVsc2VfZWxlbWVudCggJGNvbnRyb2wgKTtcblxuXHRcdGNsZWFyVGltZW91dCggcHJldmlld19ub3RpY2VfdGltZXIgKTtcblx0XHRwcmV2aWV3X25vdGljZV90aW1lciA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdCRjb250cm9sLnJlbW92ZUNsYXNzKCAnd3BiY190aGVtZV9hdHRlbnRpb25fcHVsc2UnICk7XG5cdFx0fSwgMjEwMCApO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0X3ByZXZpZXdfbm90aWNlX21lc3NhZ2UoIG5vdGljZV90eXBlICkge1xuXHRcdHZhciBpMThuID0gY2ZnLmkxOG4gfHwge307XG5cblx0XHRpZiAoICdmb3JtJyA9PT0gbm90aWNlX3R5cGUgKSB7XG5cdFx0XHRyZXR1cm4gaTE4bi5mb3JtX3ByZXZpZXdfb3B0aW9uX25vdGljZSB8fCAnVGhpcyBvcHRpb24gaXMgdmlzaWJsZSBpbiB0aGUgQm9va2luZyBmb3JtIHByZXZpZXcuIFN3aXRjaCBQcmV2aWV3IHRvIEJvb2tpbmcgZm9ybSB0byBpbnNwZWN0IGl0Lic7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICcnO1xuXHR9XG5cblx0ZnVuY3Rpb24gbWF5YmVfc2hvd19wcmV2aWV3X25vdGljZSggJHNvdXJjZSApIHtcblx0XHR2YXIgbm90aWNlX3R5cGUgPSAkc291cmNlLmF0dHIoICdkYXRhLXdwYmMtdGhlbWUtcHJldmlldy1ub3RpY2UnICkgfHwgJyc7XG5cdFx0dmFyIHByZXZpZXdfbW9kZSA9ICQoICcjd3BiY190aGVtZV9wcmV2aWV3X21vZGUnICkudmFsKCkgfHwgJ2NhbGVuZGFyJztcblx0XHR2YXIgbWVzc2FnZSA9IGdldF9wcmV2aWV3X25vdGljZV9tZXNzYWdlKCBub3RpY2VfdHlwZSApO1xuXHRcdHZhciAkY29udHJvbCA9ICQoICcud3BiY190aGVtZV9jb250cm9sX3ByZXZpZXdfbW9kZScgKS5maXJzdCgpO1xuXG5cdFx0aWYgKCAhIG1lc3NhZ2UgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCAnZm9ybScgPT09IG5vdGljZV90eXBlICYmICdjYWxlbmRhcicgIT09IHByZXZpZXdfbW9kZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoICdmb3JtJyA9PT0gbm90aWNlX3R5cGUgKSB7XG5cdFx0XHRwdWxzZV9wcmV2aWV3X21vZGVfY29udHJvbCgpO1xuXHRcdFx0c2hvd19oaWdobGlnaHRlZF9ub3RpY2UoIG1lc3NhZ2UsICd3YXJuaW5nJywgOTAwMCApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHNob3dfaGlnaGxpZ2h0ZWRfbm90aWNlKCBtZXNzYWdlLCAnd2FybmluZycsIDkwMDAsICRjb250cm9sICk7XG5cdH1cblxuXHRmdW5jdGlvbiBzaG93X2NhbGVuZGFyX29ubHlfdGhlbWVfbm90aWNlKCkge1xuXHRcdHZhciBwcmV2aWV3X21vZGUgPSAkKCAnI3dwYmNfdGhlbWVfcHJldmlld19tb2RlJyApLnZhbCgpIHx8ICdjYWxlbmRhcic7XG5cblx0XHRpZiAoICdjYWxlbmRhcicgIT09IHByZXZpZXdfbW9kZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRwdWxzZV9wcmV2aWV3X21vZGVfY29udHJvbCgpO1xuXHRcdHNob3dfaGlnaGxpZ2h0ZWRfbm90aWNlKFxuXHRcdFx0Y2ZnLmkxOG4gJiYgY2ZnLmkxOG4uY2FsZW5kYXJfb25seV90aGVtZV9ub3RpY2UgPyBjZmcuaTE4bi5jYWxlbmRhcl9vbmx5X3RoZW1lX25vdGljZSA6ICdQcmV2aWV3IGlzIHNldCB0byBDYWxlbmRhciBvbmx5LiBTd2l0Y2ggUHJldmlldyB0byBCb29raW5nIGZvcm0gdG8gaW5zcGVjdCB0aGUgZm9ybSB0aGVtZS4nLFxuXHRcdFx0J3dhcm5pbmcnLFxuXHRcdFx0OTAwMFxuXHRcdCk7XG5cdH1cblxuXHRmdW5jdGlvbiBzeW5jX3RpbWVfcGlja2VyX3ByZXZpZXcoKSB7XG5cdFx0dmFyIGlzX2VuYWJsZWQgPSBnZXRfZm9ybSgpLmZpbmQoICdbbmFtZT1cImJvb2tpbmdfdGltZXNsb3RfcGlja2VyXCJdJyApLnByb3AoICdjaGVja2VkJyApO1xuXHRcdHZhciAkcHJldmlldyA9ICQoICdbZGF0YS13cGJjLXRoZW1lLXByZXZpZXc9XCIxXCJdJyApO1xuXHRcdHZhciB0aW1lX3NlbGVjdG9ycyA9ICdzZWxlY3RbbmFtZV49XCJyYW5nZXRpbWVcIl0sIHNlbGVjdFtuYW1lXj1cInN0YXJ0dGltZVwiXSwgc2VsZWN0W25hbWVePVwiZW5kdGltZVwiXSwgc2VsZWN0W25hbWVePVwiZHVyYXRpb250aW1lXCJdJztcblxuXHRcdGlmICggdy5fd3BiYyAmJiB0eXBlb2Ygdy5fd3BiYy5zZXRfb3RoZXJfcGFyYW0gPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHR3Ll93cGJjLnNldF9vdGhlcl9wYXJhbSggJ2lzX2VuYWJsZWRfYm9va2luZ190aW1lc2xvdF9waWNrZXInLCAhISBpc19lbmFibGVkICk7XG5cdFx0fVxuXG5cdFx0aWYgKCBpc19lbmFibGVkICkge1xuXHRcdFx0aWYgKCB3Ll93cGJjICYmIHR5cGVvZiB3LndwYmNfaG9va19faW5pdF90aW1lc2VsZWN0b3IgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdHcud3BiY19ob29rX19pbml0X3RpbWVzZWxlY3RvcigpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdCRwcmV2aWV3LmZpbmQoICcud3BiY190aW1lc19zZWxlY3RvcicgKS5yZW1vdmUoKTtcblx0XHQkcHJldmlldy5maW5kKCB0aW1lX3NlbGVjdG9ycyApLnNob3coKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHJlZnJlc2hfcHJldmlld19tb2RlX2NvbnRyb2xzKCkge1xuXHRcdHZhciBwcmV2aWV3X21vZGUgPSAkKCAnI3dwYmNfdGhlbWVfcHJldmlld19tb2RlJyApLnZhbCgpIHx8ICdjYWxlbmRhcic7XG5cdFx0JCggJ1tkYXRhLXdwYmMtdGhlbWUtZm9ybS1jb250cm9sPVwiMVwiXScgKS50b2dnbGVDbGFzcyggJ2lzLXZpc2libGUnLCAnZm9ybScgPT09IHByZXZpZXdfbW9kZSApO1xuXHR9XG5cblx0ZnVuY3Rpb24gc2V0X2NhbGVuZGFyX2xvYWRpbmcoIGlzX2xvYWRpbmcgKSB7XG5cdFx0dmFyICRwYW5lbCA9ICQoICdbZGF0YS13cGJjLXRoZW1lLWNhbGVuZGFyLXBhbmVsPVwiMVwiXScgKTtcblxuXHRcdCRwYW5lbC50b2dnbGVDbGFzcyggJ2lzLWxvYWRpbmcnLCAhISBpc19sb2FkaW5nICk7XG5cdFx0JHBhbmVsLmZpbmQoICcud3BiY190aGVtZV9jYWxlbmRhcl9sb2FkaW5nJyApLnJlbW92ZSgpO1xuXG5cdFx0aWYgKCBpc19sb2FkaW5nICkge1xuXHRcdFx0JHBhbmVsLmFwcGVuZChcblx0XHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjX2NhbGVuZGFyX2xvYWRpbmcgd3BiY190aGVtZV9jYWxlbmRhcl9sb2FkaW5nXCI+JyArXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwid3BiY19pY25fYXV0b3JlbmV3IHdwYmNfYW5pbWF0aW9uX3NwaW5cIj48L3NwYW4+Jm5ic3A7JyArXG5cdFx0XHRcdFx0dHJpbV90ZXh0KCBjZmcuaTE4biAmJiBjZmcuaTE4bi5sb2FkaW5nID8gY2ZnLmkxOG4ubG9hZGluZyA6ICdMb2FkaW5nJyApICtcblx0XHRcdFx0JzwvZGl2Pidcblx0XHRcdCk7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gcmVmcmVzaF9wcmV2aWV3KCkge1xuXHRcdHZhciBkYXRhID0gY29sbGVjdF9wYXlsb2FkKCk7XG5cblx0XHRpZiAoIHByZXZpZXdfYWpheCAmJiBwcmV2aWV3X2FqYXgucmVhZHlTdGF0ZSAhPT0gNCApIHtcblx0XHRcdHByZXZpZXdfYWpheC5hYm9ydCgpO1xuXHRcdH1cblxuXHRcdGRhdGEuYWN0aW9uID0gY2ZnLnByZXZpZXdfYWN0aW9uO1xuXHRcdGRhdGEubm9uY2UgPSBjZmcubm9uY2U7XG5cblx0XHRzZXRfY2FsZW5kYXJfbG9hZGluZyggdHJ1ZSApO1xuXHRcdHByZXZpZXdfYWpheCA9ICQucG9zdCggY2ZnLmFqYXhfdXJsLCBkYXRhIClcblx0XHRcdC5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0XHRpZiAoIHJlc3BvbnNlICYmIHJlc3BvbnNlLnN1Y2Nlc3MgJiYgcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLmh0bWwgKSB7XG5cdFx0XHRcdFx0JCggJ1tkYXRhLXdwYmMtdGhlbWUtcHJldmlldz1cIjFcIl0nICkucmVwbGFjZVdpdGgoIHJlc3BvbnNlLmRhdGEuaHRtbCApO1xuXHRcdFx0XHRcdGlmICggcmVzcG9uc2UuZGF0YS5kYXlzX3NlbGVjdGlvbiApIHtcblx0XHRcdFx0XHRcdGNmZy5kYXlzX3NlbGVjdGlvbiA9IHJlc3BvbnNlLmRhdGEuZGF5c19zZWxlY3Rpb247XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGFwcGx5X2Zvcm1fdGhlbWUoKTtcblx0XHRcdFx0XHRhcHBseV9jYWxlbmRhcl9za2luKCk7XG5cdFx0XHRcdFx0YXBwbHlfdGltZV9za2luKCk7XG5cdFx0XHRcdFx0ZW5zdXJlX2NhbGVuZGFyX29ubHlfZGF5c19zZWxlY3Rpb24oKTtcblx0XHRcdFx0XHRzeW5jX3RpbWVfcGlja2VyX3ByZXZpZXcoKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRzaG93X21lc3NhZ2UoXG5cdFx0XHRcdFx0cmVzcG9uc2UgJiYgcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLm1lc3NhZ2UgPyByZXNwb25zZS5kYXRhLm1lc3NhZ2UgOiAoIGNmZy5pMThuICYmIGNmZy5pMThuLnByZXZpZXdfZmFpbGVkID8gY2ZnLmkxOG4ucHJldmlld19mYWlsZWQgOiAnVW5hYmxlIHRvIHJlZnJlc2ggY2FsZW5kYXIgcHJldmlldy4nICksXG5cdFx0XHRcdFx0J2Vycm9yJyxcblx0XHRcdFx0XHQxMDAwMFxuXHRcdFx0XHQpO1xuXHRcdFx0fSApXG5cdFx0XHQuZmFpbCggZnVuY3Rpb24gKCB4aHIsIHRleHRfc3RhdHVzICkge1xuXHRcdFx0XHRpZiAoICdhYm9ydCcgPT09IHRleHRfc3RhdHVzICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRzaG93X21lc3NhZ2UoIGNmZy5pMThuICYmIGNmZy5pMThuLnByZXZpZXdfZmFpbGVkID8gY2ZnLmkxOG4ucHJldmlld19mYWlsZWQgOiAnVW5hYmxlIHRvIHJlZnJlc2ggY2FsZW5kYXIgcHJldmlldy4nLCAnZXJyb3InLCAxMDAwMCApO1xuXHRcdFx0fSApXG5cdFx0XHQuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHNldF9jYWxlbmRhcl9sb2FkaW5nKCBmYWxzZSApO1xuXHRcdFx0fSApO1xuXHR9XG5cblx0ZnVuY3Rpb24gc2NoZWR1bGVfcHJldmlld19yZWZyZXNoKCkge1xuXHRcdGNsZWFyVGltZW91dCggcHJldmlld190aW1lciApO1xuXHRcdHByZXZpZXdfdGltZXIgPSBzZXRUaW1lb3V0KCByZWZyZXNoX3ByZXZpZXcsIDE4MCApO1xuXHR9XG5cblx0ZnVuY3Rpb24gc2F2ZV9zZXR0aW5ncygpIHtcblx0XHR2YXIgJGJ1dHRvbiA9ICQoICdbZGF0YS13cGJjLXRoZW1lLXNhdmU9XCIxXCJdJyApO1xuXHRcdHZhciBvcmlnaW5hbF90ZXh0ID0gJGJ1dHRvbi5kYXRhKCAnd3BiYy1vcmlnaW5hbC10ZXh0JyApO1xuXHRcdHZhciBkYXRhID0gY29sbGVjdF9wYXlsb2FkKCk7XG5cblx0XHRpZiAoICEgb3JpZ2luYWxfdGV4dCApIHtcblx0XHRcdG9yaWdpbmFsX3RleHQgPSAkYnV0dG9uLmh0bWwoKTtcblx0XHRcdCRidXR0b24uZGF0YSggJ3dwYmMtb3JpZ2luYWwtdGV4dCcsIG9yaWdpbmFsX3RleHQgKTtcblx0XHR9XG5cblx0XHRkYXRhLmFjdGlvbiA9IGNmZy5hY3Rpb247XG5cdFx0ZGF0YS5ub25jZSA9IGNmZy5ub25jZTtcblxuXHRcdCRidXR0b24uYWRkQ2xhc3MoICdkaXNhYmxlZCcgKS5hdHRyKCAnYXJpYS1kaXNhYmxlZCcsICd0cnVlJyApO1xuXHRcdCRidXR0b24uZmluZCggJy5pbi1idXR0b24tdGV4dCcgKS5odG1sKCAnJm5ic3A7Jm5ic3A7JyArIHRyaW1fdGV4dCggY2ZnLmkxOG4gJiYgY2ZnLmkxOG4uc2F2aW5nID8gY2ZnLmkxOG4uc2F2aW5nIDogJ1NhdmluZycgKSArICcuLi4nICk7XG5cblx0XHQkLnBvc3QoIGNmZy5hamF4X3VybCwgZGF0YSApXG5cdFx0XHQuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdFx0aWYgKCByZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzICkge1xuXHRcdFx0XHRcdHNob3dfbWVzc2FnZSggcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLm1lc3NhZ2UgPyByZXNwb25zZS5kYXRhLm1lc3NhZ2UgOiAoIGNmZy5pMThuICYmIGNmZy5pMThuLnNhdmVkID8gY2ZnLmkxOG4uc2F2ZWQgOiAnU2F2ZWQnICksICdzdWNjZXNzJywgMzAwMCApO1xuXHRcdFx0XHRcdGNmZy5zZXR0aW5ncyA9IHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5zZXR0aW5ncyA/IHJlc3BvbnNlLmRhdGEuc2V0dGluZ3MgOiBjZmcuc2V0dGluZ3M7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0c2hvd19tZXNzYWdlKFxuXHRcdFx0XHRcdHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5tZXNzYWdlID8gcmVzcG9uc2UuZGF0YS5tZXNzYWdlIDogKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5zYXZlX2ZhaWxlZCA/IGNmZy5pMThuLnNhdmVfZmFpbGVkIDogJ1VuYWJsZSB0byBzYXZlIGFwcGVhcmFuY2Ugc2V0dGluZ3MuJyApLFxuXHRcdFx0XHRcdCdlcnJvcicsXG5cdFx0XHRcdFx0MTAwMDBcblx0XHRcdFx0KTtcblx0XHRcdH0gKVxuXHRcdFx0LmZhaWwoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0c2hvd19tZXNzYWdlKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5zYXZlX2ZhaWxlZCA/IGNmZy5pMThuLnNhdmVfZmFpbGVkIDogJ1VuYWJsZSB0byBzYXZlIGFwcGVhcmFuY2Ugc2V0dGluZ3MuJywgJ2Vycm9yJywgMTAwMDAgKTtcblx0XHRcdH0gKVxuXHRcdFx0LmFsd2F5cyggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHQkYnV0dG9uLnJlbW92ZUNsYXNzKCAnZGlzYWJsZWQnICkucmVtb3ZlQXR0ciggJ2FyaWEtZGlzYWJsZWQnICkuaHRtbCggb3JpZ2luYWxfdGV4dCApO1xuXHRcdFx0fSApO1xuXHR9XG5cblx0ZnVuY3Rpb24gYmluZF9ldmVudHMoKSB7XG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJy53cGJjX3RoZW1lX3JpZ2h0YmFyX3RhYnMgW3JvbGU9XCJ0YWJcIl0nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHN3aXRjaF9wYW5lbCggJCggdGhpcyApICk7XG5cdFx0fSApO1xuXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJy53cGJjX3RoZW1lX3ByZW1pdW1fZGlzbWlzcyBhJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdH0gKTtcblxuXHRcdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY190aGVtZV9yaWdodGJhcl9wYW5lbHMgLndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwID4gLmdyb3VwX19oZWFkZXInLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHRvZ2dsZV9ncm91cCggJCggdGhpcyApICk7XG5cdFx0fSApO1xuXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJ1tkYXRhLXdwYmMtdGhlbWUtc2F2ZT1cIjFcIl0nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGlmICggISAkKCB0aGlzICkuaGFzQ2xhc3MoICdkaXNhYmxlZCcgKSApIHtcblx0XHRcdFx0c2F2ZV9zZXR0aW5ncygpO1xuXHRcdFx0fVxuXHRcdH0gKTtcblxuXHRcdCQoIGRvY3VtZW50ICkub24oICdzdWJtaXQnLCAnW2RhdGEtd3BiYy10aGVtZS1zZXR0aW5ncy1mb3JtPVwiMVwiXScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gKTtcblxuXHRcdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnW25hbWU9XCJib29raW5nX2Zvcm1fdGhlbWVcIl0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRhcHBseV9mb3JtX3RoZW1lKCk7XG5cdFx0XHRhcHBseV9yZWxhdGVkX3NraW5zX2Zvcl90aGVtZSggJCggdGhpcyApLnZhbCgpIHx8ICcnICk7XG5cdFx0XHRzaG93X2NhbGVuZGFyX29ubHlfdGhlbWVfbm90aWNlKCk7XG5cdFx0fSApO1xuXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICdbZGF0YS13cGJjLXRoZW1lLWNhbGVuZGFyLXNraW49XCIxXCJdJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0YXBwbHlfY2FsZW5kYXJfc2tpbigpO1xuXHRcdH0gKTtcblxuXHRcdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnW2RhdGEtd3BiYy10aGVtZS10aW1lLXNraW49XCIxXCJdJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0YXBwbHlfdGltZV9za2luKCk7XG5cdFx0fSApO1xuXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICdbbmFtZT1cImJvb2tpbmdfdGltZXNsb3RfcGlja2VyXCJdJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0c3luY190aW1lX3BpY2tlcl9wcmV2aWV3KCk7XG5cdFx0XHRzY2hlZHVsZV9wcmV2aWV3X3JlZnJlc2goKTtcblx0XHR9ICk7XG5cblx0XHQkKCBkb2N1bWVudCApLm9uKCAnY2hhbmdlJywgJ1tkYXRhLXdwYmMtdGhlbWUtcHJldmlldy1ub3RpY2VdJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0bWF5YmVfc2hvd19wcmV2aWV3X25vdGljZSggJCggdGhpcyApICk7XG5cdFx0fSApO1xuXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICcjd3BiY190aGVtZV9yZXNvdXJjZV9pZCwgI3dwYmNfdGhlbWVfbW9udGhzX2NvdW50LCAjd3BiY190aGVtZV9jdXN0b21fZm9ybScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdHNjaGVkdWxlX3ByZXZpZXdfcmVmcmVzaCgpO1xuXHRcdH0gKTtcblxuXHRcdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnI3dwYmNfdGhlbWVfcHJldmlld19tb2RlJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0cmVmcmVzaF9wcmV2aWV3X21vZGVfY29udHJvbHMoKTtcblx0XHRcdHNjaGVkdWxlX3ByZXZpZXdfcmVmcmVzaCgpO1xuXHRcdH0gKTtcblx0fVxuXG5cdCQoIGZ1bmN0aW9uICgpIHtcblx0XHRpZiAoICEgJCggJ1tkYXRhLXdwYmMtdGhlbWUtcGFnZT1cIjFcIl0nICkubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGJpbmRfZXZlbnRzKCk7XG5cdFx0cmVmcmVzaF9wcmV2aWV3X21vZGVfY29udHJvbHMoKTtcblx0XHRhcHBseV9mb3JtX3RoZW1lKCk7XG5cdFx0ZW5zdXJlX2NhbGVuZGFyX29ubHlfZGF5c19zZWxlY3Rpb24oKTtcblx0XHRzeW5jX3RpbWVfcGlja2VyX3ByZXZpZXcoKTtcblx0fSApO1xufSggalF1ZXJ5LCB3aW5kb3cgKSApO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNFLFdBQVdBLENBQUMsRUFBRUMsQ0FBQyxFQUFHO0VBQ25CLFlBQVk7O0VBRVosSUFBSUMsR0FBRyxHQUFHRCxDQUFDLENBQUNFLHlCQUF5QixJQUFJLENBQUMsQ0FBQztFQUMzQyxJQUFJQyxZQUFZLEdBQUcsSUFBSTtFQUN2QixJQUFJQyxhQUFhLEdBQUcsQ0FBQztFQUNyQixJQUFJQyxvQkFBb0IsR0FBRyxDQUFDO0VBQzVCLElBQUlDLDRCQUE0QixHQUFHLENBQUM7RUFFcEMsU0FBU0MsU0FBU0EsQ0FBRUMsS0FBSyxFQUFHO0lBQzNCLE9BQU9DLE1BQU0sQ0FBRUQsS0FBSyxJQUFJLEVBQUcsQ0FBQyxDQUFDRSxJQUFJLENBQUMsQ0FBQztFQUNwQztFQUVBLFNBQVNDLGNBQWNBLENBQUVDLElBQUksRUFBRztJQUMvQkEsSUFBSSxHQUFHSCxNQUFNLENBQUVHLElBQUksSUFBSSxFQUFHLENBQUM7SUFDM0IsSUFBSyxlQUFlLENBQUNDLElBQUksQ0FBRUQsSUFBSyxDQUFDLElBQUksT0FBTyxDQUFDQyxJQUFJLENBQUVELElBQUssQ0FBQyxFQUFHO01BQzNELE9BQU9BLElBQUk7SUFDWjtJQUNBLE9BQU9ILE1BQU0sQ0FBRVIsR0FBRyxDQUFDYSxVQUFVLElBQUksRUFBRyxDQUFDLENBQUNDLE9BQU8sQ0FBRSxLQUFLLEVBQUUsRUFBRyxDQUFDLEdBQUdILElBQUk7RUFDbEU7RUFFQSxTQUFTSSxZQUFZQSxDQUFFQyxPQUFPLEVBQUVDLElBQUksRUFBRUMsS0FBSyxFQUFHO0lBQzdDLElBQUssT0FBT25CLENBQUMsQ0FBQ29CLHVCQUF1QixLQUFLLFVBQVUsRUFBRztNQUN0RHBCLENBQUMsQ0FBQ29CLHVCQUF1QixDQUFFSCxPQUFPLEVBQUVDLElBQUksSUFBSSxNQUFNLEVBQUVDLEtBQUssSUFBSSxJ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
