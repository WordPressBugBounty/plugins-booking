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
    sync_form_style_choice();
    $.each($form.serializeArray(), function (index, item) {
      if (0 === String(item.name || '').indexOf('wpbc_setup')) {
        return;
      }
      data[item.name] = item.value;
    });
    data.booking_timeslot_picker = $form.find('[name="booking_timeslot_picker"]').prop('checked') ? 'On' : 'Off';
    data.resource_id = $('#wpbc_theme_resource_id').val() || '';
    data.months_count = $('#wpbc_theme_months_count').val() || '';
    data.preview_mode = $('#wpbc_theme_preview_mode').val() || 'calendar';
    data.custom_booking_form = $('#wpbc_theme_custom_form').val() || 'standard';
    return data;
  }
  function map_form_style_choice(value) {
    var choice = String(value || 'light_bordered');
    var current_theme = $('#booking_form_theme').val() || '';
    var parts;
    var preset;
    if ('custom' === choice) {
      return {
        theme: current_theme,
        preset: 'custom'
      };
    }
    parts = choice.split('_');
    preset = parts[1] || 'bordered';
    if (['bordered', 'none', 'soft'].indexOf(preset) === -1) {
      preset = 'bordered';
    }
    return {
      theme: 'dark' === parts[0] ? 'wpbc_theme_dark_1' : '',
      preset: preset
    };
  }
  function get_form_style_choice_from_values() {
    var theme = $('#booking_form_theme').val() || '';
    var preset = $('#booking_form_appearance_preset').val() || 'bordered';
    var prefix = theme ? 'dark' : 'light';
    if ('custom' === preset) {
      return 'custom';
    }
    if (['bordered', 'none', 'soft'].indexOf(preset) === -1) {
      preset = 'bordered';
    }
    return prefix + '_' + preset;
  }
  function sync_form_style_choice() {
    var $checked = get_form().find('[name="booking_form_style"]:checked');
    var mapped;
    if (!$checked.length) {
      return;
    }
    mapped = map_form_style_choice($checked.val());
    $('#booking_form_theme').val(mapped.theme);
    $('#booking_form_appearance_preset').val(mapped.preset);
  }
  function sync_form_style_choice_selection() {
    var choice = get_form_style_choice_from_values();
    var $choices = get_form().find('[name="booking_form_style"]');
    $choices.prop('checked', false);
    $choices.filter('[value="' + choice + '"]').prop('checked', true);
    $('.wpbc_theme_choice').removeClass('is-selected');
    $choices.filter(':checked').closest('.wpbc_theme_choice').addClass('is-selected');
  }
  function apply_form_theme() {
    var theme = $('#booking_form_theme').val() || '';
    var $preview = $('[data-wpbc-theme-preview="1"]');
    var $theme_targets = $preview.add($preview.find('.wpbc_container.wpbc_form, .wpbc_container_booking_form'));
    $theme_targets.each(function () {
      var $target = $(this);
      var classes = String(this.className || '').split(/\s+/);
      $.each(classes, function (index, class_name) {
        if (/^wpbc_theme_/.test(class_name) && !/^wpbc_theme_preview/.test(class_name)) {
          $target.removeClass(class_name);
        }
      });
    });
    if (theme) {
      $theme_targets.addClass(theme);
    }
    sync_form_style_choice_selection();
  }
  function get_form_appearance_presets() {
    return {
      bordered: {
        background: '#ffffff',
        borderColor: '#cccccc',
        borderWidth: '1px',
        radius: '2px',
        padding: '10px 30px',
        shadow: 'rgba(0, 0, 0, 0.05) 0px 2px 6px 0px'
      },
      none: {
        background: 'transparent',
        borderColor: 'transparent',
        borderWidth: '0px',
        radius: '0px',
        padding: '0px',
        shadow: 'none'
      },
      soft: {
        background: '#f9f9fa',
        borderColor: '#fff',
        borderWidth: '3px',
        radius: '8px',
        padding: '20px',
        shadow: 'rgba(15, 23, 42, 0.06) 0px 4px 16px 0px'
      }
    };
  }
  function is_dark_form_theme() {
    return 'wpbc_theme_dark_1' === String($('#booking_form_theme').val() || '');
  }
  function get_form_appearance_preset_for_theme(preset) {
    var presets = get_form_appearance_presets();
    if (!is_dark_form_theme()) {
      return presets[preset] || presets.bordered;
    }
    if ('soft' === preset) {
      return {
        background: '#1f2937',
        borderColor: '#334155',
        borderWidth: '3px',
        radius: '8px',
        padding: '20px',
        shadow: 'rgba(0, 0, 0, 0.24) 0px 4px 16px 0px'
      };
    }
    return presets[preset] || presets.bordered;
  }
  function sanitize_theme_color(value, fallback) {
    var v = String(value || '').trim();
    return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) || 'transparent' === v ? v : fallback;
  }
  function sanitize_theme_length(value, fallback) {
    var v = String(value || '').trim();
    return /^-?\d+(?:\.\d+)?(?:px|rem|em|%)$/i.test(v) ? v : fallback;
  }
  function sanitize_theme_spacing(value, fallback) {
    var v = String(value || '').trim().replace(/\s+/g, ' ');
    var parts = v ? v.split(' ') : [];
    var i;
    if (parts.length < 1 || parts.length > 4) {
      return fallback;
    }
    for (i = 0; i < parts.length; i++) {
      if (!/^-?\d+(?:\.\d+)?(?:px|rem|em|%)$/i.test(parts[i])) {
        return fallback;
      }
    }
    return parts.join(' ');
  }
  function get_form_style_presets() {
    return cfg.form_style_presets && 'object' === typeof cfg.form_style_presets ? cfg.form_style_presets : {};
  }
  function get_current_form_style() {
    var $checked = get_form().find('[name="booking_form_style"]:checked');
    return $checked.length ? String($checked.val() || 'light_bordered') : 'light_bordered';
  }
  function get_custom_form_style_defaults() {
    return $.extend({
      booking_form_custom_background_color: '#ffffff',
      booking_form_custom_border_color: '#cccccc',
      booking_form_custom_border_width: '1px',
      booking_form_custom_border_radius: '2px',
      booking_form_custom_padding_vertical: '10px',
      booking_form_custom_padding_horizontal: '30px',
      booking_form_custom_text_color: '#1d2327',
      booking_form_custom_field_background_color: '#ffffff',
      booking_form_custom_field_text_color: '#3c434a',
      booking_form_custom_field_border_color: '#cccccc',
      booking_form_custom_button_background_color: '#066aab',
      booking_form_custom_button_text_color: '#ffffff',
      booking_form_custom_button_border_color: '#066aab',
      booking_form_custom_button_hover_background_color: '#055589',
      booking_form_custom_button_hover_text_color: '#ffffff',
      booking_form_custom_button_hover_border_color: '#055589',
      booking_form_custom_secondary_button_background_color: '#fdfdfd',
      booking_form_custom_secondary_button_text_color: '#444444',
      booking_form_custom_secondary_button_border_color: '#eeeeee',
      booking_form_custom_secondary_button_hover_background_color: '#fdfdfd',
      booking_form_custom_secondary_button_hover_text_color: '#444444',
      booking_form_custom_secondary_button_hover_border_color: '#4d91cd'
    }, cfg.custom_form_style_defaults && 'object' === typeof cfg.custom_form_style_defaults ? cfg.custom_form_style_defaults : {});
  }
  function get_custom_form_style_css_vars() {
    var defaults = get_custom_form_style_defaults();
    var values = $.extend({}, defaults, cfg.settings && 'object' === typeof cfg.settings ? cfg.settings : {});
    return {
      '--wpbc-bfb-form-background': sanitize_theme_color(values.booking_form_custom_background_color, defaults.booking_form_custom_background_color),
      '--wpbc-bfb-form-border-color': sanitize_theme_color(values.booking_form_custom_border_color, defaults.booking_form_custom_border_color),
      '--wpbc-bfb-form-border-width': sanitize_theme_length(values.booking_form_custom_border_width, defaults.booking_form_custom_border_width),
      '--wpbc-bfb-form-border-radius': sanitize_theme_length(values.booking_form_custom_border_radius, defaults.booking_form_custom_border_radius),
      '--wpbc-bfb-form-padding': sanitize_theme_length(values.booking_form_custom_padding_vertical, defaults.booking_form_custom_padding_vertical) + ' ' + sanitize_theme_length(values.booking_form_custom_padding_horizontal, defaults.booking_form_custom_padding_horizontal),
      '--wpbc-bfb-form-box-shadow': 'rgba(0, 0, 0, 0.05) 0px 2px 6px 0px',
      '--wpbc_form-label-color': sanitize_theme_color(values.booking_form_custom_text_color, defaults.booking_form_custom_text_color),
      '--wpbc_form-label-sublabel-color': sanitize_theme_color(values.booking_form_custom_text_color, defaults.booking_form_custom_text_color),
      '--wpbc_form-label-error-color': '#d63637',
      '--wpbc_form-field-background-color': sanitize_theme_color(values.booking_form_custom_field_background_color, defaults.booking_form_custom_field_background_color),
      '--wpbc_form-field-menu-color': sanitize_theme_color(values.booking_form_custom_field_background_color, defaults.booking_form_custom_field_background_color),
      '--wpbc_form-field-text-color': sanitize_theme_color(values.booking_form_custom_field_text_color, defaults.booking_form_custom_field_text_color),
      '--wpbc_form-field-border-color': sanitize_theme_color(values.booking_form_custom_field_border_color, defaults.booking_form_custom_field_border_color),
      '--wpbc_form-field-border-color-spare': sanitize_theme_color(values.booking_form_custom_field_border_color, defaults.booking_form_custom_field_border_color),
      '--wpbc_form-field-focus-border-color': '#066aab',
      '--wpbc_form-field-focus-shadow-color': '#066aab',
      '--wpbc_form-field-disabled-color': 'rgba(0, 0, 0, 0.2)',
      '--wpbc_form-button-background-color': sanitize_theme_color(values.booking_form_custom_button_background_color, defaults.booking_form_custom_button_background_color),
      '--wpbc_form-button-background-color-alt': sanitize_theme_color(values.booking_form_custom_button_background_color, defaults.booking_form_custom_button_background_color),
      '--wpbc_form-button-border-color': sanitize_theme_color(values.booking_form_custom_button_border_color, defaults.booking_form_custom_button_border_color),
      '--wpbc_form-button-text-color': sanitize_theme_color(values.booking_form_custom_button_text_color, defaults.booking_form_custom_button_text_color),
      '--wpbc_form-button-text-color-alt': sanitize_theme_color(values.booking_form_custom_button_text_color, defaults.booking_form_custom_button_text_color),
      '--wpbc_form-button-hover-background-color': sanitize_theme_color(values.booking_form_custom_button_hover_background_color, defaults.booking_form_custom_button_hover_background_color),
      '--wpbc_form-button-hover-border-color': sanitize_theme_color(values.booking_form_custom_button_hover_border_color, defaults.booking_form_custom_button_hover_border_color),
      '--wpbc_form-button-hover-text-color': sanitize_theme_color(values.booking_form_custom_button_hover_text_color, defaults.booking_form_custom_button_hover_text_color),
      '--wpbc_form-choice-checked-border-color': '#066aab',
      '--wpbc_form-choice-checked-color': '#066aab',
      '--wpbc_form-choice-focus-color': '#066aab',
      '--wpbc_form-button-light-background-color': sanitize_theme_color(values.booking_form_custom_secondary_button_background_color, defaults.booking_form_custom_secondary_button_background_color),
      '--wpbc_form-button-light-border-color': sanitize_theme_color(values.booking_form_custom_secondary_button_border_color, defaults.booking_form_custom_secondary_button_border_color),
      '--wpbc_form-button-light-text-color': sanitize_theme_color(values.booking_form_custom_secondary_button_text_color, defaults.booking_form_custom_secondary_button_text_color),
      '--wpbc_form-button-light-box-shadow': '0 2px 10px 2px #ffffff54',
      '--wpbc_form-button-light-hover-background-color': sanitize_theme_color(values.booking_form_custom_secondary_button_hover_background_color, defaults.booking_form_custom_secondary_button_hover_background_color),
      '--wpbc_form-button-light-hover-border-color': sanitize_theme_color(values.booking_form_custom_secondary_button_hover_border_color, defaults.booking_form_custom_secondary_button_hover_border_color),
      '--wpbc_form-button-light-hover-text-color': sanitize_theme_color(values.booking_form_custom_secondary_button_hover_text_color, defaults.booking_form_custom_secondary_button_hover_text_color),
      '--wpbc_form-button-light-hover-box-shadow': '0 2px 10px 2px #ffffff54',
      '--wpbc_form-button-primary-hover-border-color': sanitize_theme_color(values.booking_form_custom_button_hover_border_color, defaults.booking_form_custom_button_hover_border_color),
      '--wpbc_form-page-break-color': '#066aab'
    };
  }
  function get_form_style_css_var_names() {
    var keys = [];
    var presets;
    if (Array.isArray(cfg.form_style_css_var_names) && cfg.form_style_css_var_names.length) {
      return cfg.form_style_css_var_names;
    }
    presets = get_form_style_presets();
    $.each(presets, function (preset_key, preset) {
      if (preset && preset.css_vars && 'object' === typeof preset.css_vars) {
        $.each(preset.css_vars, function (var_name) {
          if (-1 === keys.indexOf(var_name)) {
            keys.push(var_name);
          }
        });
      }
    });
    $.each(get_custom_form_style_css_vars(), function (var_name) {
      if (-1 === keys.indexOf(var_name)) {
        keys.push(var_name);
      }
    });
    return keys;
  }
  function resolve_form_style_css_vars(style) {
    var presets = get_form_style_presets();
    var preset = presets[style] || presets.light_bordered || {};
    if ('custom' === style || preset.custom) {
      return get_custom_form_style_css_vars();
    }
    return preset.css_vars && 'object' === typeof preset.css_vars ? preset.css_vars : {};
  }
  function apply_form_style_to_preview() {
    var style = get_current_form_style();
    var presets = get_form_style_presets();
    var preset = presets[style] || presets.light_bordered || {};
    var css_vars = resolve_form_style_css_vars(style);
    var css_var_names = get_form_style_css_var_names();
    var is_custom = 'custom' === style || preset.custom;
    var $preview = $('[data-wpbc-theme-preview="1"]');
    var $targets = $preview.find('.wpbc_container.wpbc_form, .wpbc_bfb_form, .wpbc_bfb__form_preview_section_container');
    $('[data-wpbc-theme-custom-appearance-notice="1"]').toggle(is_custom);
    if (!$targets.length) {
      return;
    }
    $targets.removeClass('wpbc_bfb_form_appearance_custom').each(function () {
      var style_obj = this.style;
      $.each(css_var_names, function (index, var_name) {
        style_obj.removeProperty(var_name);
      });
      $.each(css_vars, function (var_name, value) {
        if ('' !== String(value || '')) {
          style_obj.setProperty(var_name, value);
        }
      });
    });
    if (is_custom) {
      $targets.filter('.wpbc_container.wpbc_form, .wpbc_bfb_form').addClass('wpbc_bfb_form_appearance_custom');
    }
  }
  function resolve_form_appearance() {
    var preset = $('#booking_form_appearance_preset').val() || 'bordered';
    if ('custom' === preset) {
      return get_form_appearance_presets().bordered;
    }
    return get_form_appearance_preset_for_theme(preset);
  }
  function apply_form_appearance() {
    apply_form_style_to_preview();
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
        apply_form_appearance();
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
    $(document).on('change', '[name="booking_form_style"]', function () {
      sync_form_style_choice();
      apply_form_theme();
      apply_form_appearance();
      apply_related_skins_for_theme($('#booking_form_theme').val() || '');
      show_calendar_only_theme_notice();
      schedule_preview_refresh();
    });
    $(document).on('input change', '[data-wpbc-theme-appearance-control]', function () {
      apply_form_appearance();
      schedule_preview_refresh();
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
    apply_form_appearance();
    ensure_calendar_only_days_selection();
    sync_time_picker_preview();
  });
})(jQuery, window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR0aW5ncy10aGVtZXMvX291dC9zZXR0aW5nc190aGVtZXNfcGFnZS5qcyIsIm5hbWVzIjpbIiQiLCJ3IiwiY2ZnIiwid3BiY19zZXR0aW5nc190aGVtZXNfcGFnZSIsInByZXZpZXdfYWpheCIsInByZXZpZXdfdGltZXIiLCJwcmV2aWV3X25vdGljZV90aW1lciIsInByZXZpZXdfbm90aWNlX21lc3NhZ2VfdGltZXIiLCJ0cmltX3RleHQiLCJ2YWx1ZSIsIlN0cmluZyIsInRyaW0iLCJtYWtlX2Fzc2V0X3VybCIsInBhdGgiLCJ0ZXN0IiwicGx1Z2luX3VybCIsInJlcGxhY2UiLCJzaG93X21lc3NhZ2UiLCJtZXNzYWdlIiwidHlwZSIsImRlbGF5Iiwid3BiY19hZG1pbl9zaG93X21lc3NhZ2UiLCJwdWxzZV9lbGVtZW50IiwiJGVsZW1lbnQiLCJkdXJhdGlvbiIsImxlbmd0aCIsInJlbW92ZUNsYXNzIiwiZWFjaCIsIm9mZnNldFdpZHRoIiwiYWRkQ2xhc3MiLCJzZXRUaW1lb3V0IiwicHVsc2VfbGF0ZXN0X3dhcm5pbmdfbm90aWNlIiwiY2xlYXJUaW1lb3V0IiwibGFzdCIsInNob3dfaGlnaGxpZ2h0ZWRfbm90aWNlIiwiJGNvbnRyb2wiLCJzd2l0Y2hfcGFuZWwiLCIkdGFiIiwicGFuZWxfaWQiLCJhdHRyIiwiJHRhYnMiLCJjbG9zZXN0IiwiZmluZCIsIiRwYW5lbHMiLCJyZW1vdmVBdHRyIiwidG9nZ2xlX2dyb3VwIiwiJGJ1dHRvbiIsIiRncm91cCIsIiRmaWVsZHMiLCJpc19vcGVuIiwiaGFzQ2xhc3MiLCJ0b2dnbGVDbGFzcyIsInByb3AiLCJnZXRfZm9ybSIsImZpcnN0IiwiY29sbGVjdF9wYXlsb2FkIiwiJGZvcm0iLCJkYXRhIiwic3luY19mb3JtX3N0eWxlX2Nob2ljZSIsInNlcmlhbGl6ZUFycmF5IiwiaW5kZXgiLCJpdGVtIiwibmFtZSIsImluZGV4T2YiLCJib29raW5nX3RpbWVzbG90X3BpY2tlciIsInJlc291cmNlX2lkIiwidmFsIiwibW9udGhzX2NvdW50IiwicHJldmlld19tb2RlIiwiY3VzdG9tX2Jvb2tpbmdfZm9ybSIsIm1hcF9mb3JtX3N0eWxlX2Nob2ljZSIsImNob2ljZSIsImN1cnJlbnRfdGhlbWUiLCJwYXJ0cyIsInByZXNldCIsInRoZW1lIiwic3BsaXQiLCJnZXRfZm9ybV9zdHlsZV9jaG9pY2VfZnJvbV92YWx1ZXMiLCJwcmVmaXgiLCIkY2hlY2tlZCIsIm1hcHBlZCIsInN5bmNfZm9ybV9zdHlsZV9jaG9pY2Vfc2VsZWN0aW9uIiwiJGNob2ljZXMiLCJmaWx0ZXIiLCJhcHBseV9mb3JtX3RoZW1lIiwiJHByZXZpZXciLCIkdGhlbWVfdGFyZ2V0cyIsImFkZCIsIiR0YXJnZXQiLCJjbGFzc2VzIiwiY2xhc3NOYW1lIiwiY2xhc3NfbmFtZSIsImdldF9mb3JtX2FwcGVhcmFuY2VfcHJlc2V0cyIsImJvcmRlcmVkIiwiYmFja2dyb3VuZCIsImJvcmRlckNvbG9yIiwiYm9yZGVyV2lkdGgiLCJyYWRpdXMiLCJwYWRkaW5nIiwic2hhZG93Iiwibm9uZSIsInNvZnQiLCJpc19kYXJrX2Zvcm1fdGhlbWUiLCJnZXRfZm9ybV9hcHBlYXJhbmNlX3ByZXNldF9mb3JfdGhlbWUiLCJwcmVzZXRzIiwic2FuaXRpemVfdGhlbWVfY29sb3IiLCJmYWxsYmFjayIsInYiLCJzYW5pdGl6ZV90aGVtZV9sZW5ndGgiLCJzYW5pdGl6ZV90aGVtZV9zcGFjaW5nIiwiaSIsImpvaW4iLCJnZXRfZm9ybV9zdHlsZV9wcmVzZXRzIiwiZm9ybV9zdHlsZV9wcmVzZXRzIiwiZ2V0X2N1cnJlbnRfZm9ybV9zdHlsZSIsImdldF9jdXN0b21fZm9ybV9zdHlsZV9kZWZhdWx0cyIsImV4dGVuZCIsImJvb2tpbmdfZm9ybV9jdXN0b21fYmFja2dyb3VuZF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfd2lkdGgiLCJib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl9yYWRpdXMiLCJib29raW5nX2Zvcm1fY3VzdG9tX3BhZGRpbmdfdmVydGljYWwiLCJib29raW5nX2Zvcm1fY3VzdG9tX3BhZGRpbmdfaG9yaXpvbnRhbCIsImJvb2tpbmdfZm9ybV9jdXN0b21fdGV4dF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYmFja2dyb3VuZF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfdGV4dF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYm9yZGVyX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYmFja2dyb3VuZF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX3RleHRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ib3JkZXJfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl9iYWNrZ3JvdW5kX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfdGV4dF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JvcmRlcl9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9iYWNrZ3JvdW5kX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX3RleHRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fYm9yZGVyX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX2JhY2tncm91bmRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfdGV4dF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl9ib3JkZXJfY29sb3IiLCJjdXN0b21fZm9ybV9zdHlsZV9kZWZhdWx0cyIsImdldF9jdXN0b21fZm9ybV9zdHlsZV9jc3NfdmFycyIsImRlZmF1bHRzIiwidmFsdWVzIiwic2V0dGluZ3MiLCJnZXRfZm9ybV9zdHlsZV9jc3NfdmFyX25hbWVzIiwia2V5cyIsIkFycmF5IiwiaXNBcnJheSIsImZvcm1fc3R5bGVfY3NzX3Zhcl9uYW1lcyIsInByZXNldF9rZXkiLCJjc3NfdmFycyIsInZhcl9uYW1lIiwicHVzaCIsInJlc29sdmVfZm9ybV9zdHlsZV9jc3NfdmFycyIsInN0eWxlIiwibGlnaHRfYm9yZGVyZWQiLCJjdXN0b20iLCJhcHBseV9mb3JtX3N0eWxlX3RvX3ByZXZpZXciLCJjc3NfdmFyX25hbWVzIiwiaXNfY3VzdG9tIiwiJHRhcmdldHMiLCJ0b2dnbGUiLCJzdHlsZV9vYmoiLCJyZW1vdmVQcm9wZXJ0eSIsInNldFByb3BlcnR5IiwicmVzb2x2ZV9mb3JtX2FwcGVhcmFuY2UiLCJhcHBseV9mb3JtX2FwcGVhcmFuY2UiLCJhcHBseV9jYWxlbmRhcl9za2luIiwiJHNlbGVjdCIsInNraW5fdXJsIiwid3BiY19fY2FsZW5kYXJfX2NoYW5nZV9za2luIiwiYXBwbHlfdGltZV9za2luIiwid3BiY19fY3NzX19jaGFuZ2Vfc2tpbiIsInNlbGVjdF9pZl9vcHRpb25fZXhpc3RzIiwiJG9wdGlvbiIsInRyaWdnZXIiLCJwYXJzZV9udW1iZXJfbGlzdCIsIm1hcCIsInBhcnNlZCIsInBhcnNlSW50IiwiaXNOYU4iLCJzZXRfY2FsZW5kYXJfcGFyYW0iLCJrZXkiLCJfd3BiYyIsImNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUiLCJhcHBseV9kYXlzX3NlbGVjdGlvbl90b19jYWxlbmRhciIsImRheXNfc2VsZWN0aW9uIiwic2hvdWxkX3JlaW5pdCIsImRzIiwiZml4ZWRfd2Vla19kYXlzIiwiZHluYW1pY19zcGVjaWZpYyIsImR5bmFtaWNfd2Vla19kYXlzIiwiZml4ZWRfX3dlZWtfZGF5c19fc3RhcnQiLCJkeW5hbWljX19kYXlzX3NwZWNpZmljIiwiZHluYW1pY19fd2Vla19kYXlzX19zdGFydCIsImRheXNfc2VsZWN0X21vZGUiLCJmaXhlZF9fZGF5c19udW0iLCJkeW5hbWljX19kYXlzX21pbiIsImR5bmFtaWNfX2RheXNfbWF4Iiwid3BiY19fY29uZGl0aW9uc19fU0FWRV9JTklUSUFMX19kYXlzX3NlbGVjdGlvbl9wYXJhbXNfX2JtIiwid3BiY19jYWxfX3JlX2luaXQiLCJlbnN1cmVfY2FsZW5kYXJfb25seV9kYXlzX3NlbGVjdGlvbiIsImV4cGVjdGVkIiwiZXhwZWN0ZWRfbW9kZSIsImN1cnJlbnRfbW9kZSIsIiRjYWxlbmRhciIsImNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUiLCJhcHBseV9yZWxhdGVkX3NraW5zX2Zvcl90aGVtZSIsImNhbGVuZGFyX3NraW4iLCJ0aW1lX3NraW4iLCJwdWxzZV9wcmV2aWV3X21vZGVfY29udHJvbCIsImdldF9wcmV2aWV3X25vdGljZV9tZXNzYWdlIiwibm90aWNlX3R5cGUiLCJpMThuIiwiZm9ybV9wcmV2aWV3X29wdGlvbl9ub3RpY2UiLCJtYXliZV9zaG93X3ByZXZpZXdfbm90aWNlIiwiJHNvdXJjZSIsInNob3dfY2FsZW5kYXJfb25seV90aGVtZV9ub3RpY2UiLCJjYWxlbmRhcl9vbmx5X3RoZW1lX25vdGljZSIsInN5bmNfdGltZV9waWNrZXJfcHJldmlldyIsImlzX2VuYWJsZWQiLCJ0aW1lX3NlbGVjdG9ycyIsInNldF9vdGhlcl9wYXJhbSIsIndwYmNfaG9va19faW5pdF90aW1lc2VsZWN0b3IiLCJyZW1vdmUiLCJzaG93IiwicmVmcmVzaF9wcmV2aWV3X21vZGVfY29udHJvbHMiLCJzZXRfY2FsZW5kYXJfbG9hZGluZyIsImlzX2xvYWRpbmciLCIkcGFuZWwiLCJhcHBlbmQiLCJsb2FkaW5nIiwicmVmcmVzaF9wcmV2aWV3IiwicmVhZHlTdGF0ZSIsImFib3J0IiwiYWN0aW9uIiwicHJldmlld19hY3Rpb24iLCJub25jZSIsInBvc3QiLCJhamF4X3VybCIsImRvbmUiLCJyZXNwb25zZSIsInN1Y2Nlc3MiLCJodG1sIiwicmVwbGFjZVdpdGgiLCJwcmV2aWV3X2ZhaWxlZCIsImZhaWwiLCJ4aHIiLCJ0ZXh0X3N0YXR1cyIsImFsd2F5cyIsInNjaGVkdWxlX3ByZXZpZXdfcmVmcmVzaCIsInNhdmVfc2V0dGluZ3MiLCJvcmlnaW5hbF90ZXh0Iiwic2F2aW5nIiwic2F2ZWQiLCJzYXZlX2ZhaWxlZCIsImJpbmRfZXZlbnRzIiwiZG9jdW1lbnQiLCJvbiIsImV2ZW50IiwicHJldmVudERlZmF1bHQiLCJzdG9wUHJvcGFnYXRpb24iLCJqUXVlcnkiLCJ3aW5kb3ciXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLXNldHRpbmdzLXRoZW1lcy9fc3JjL3NldHRpbmdzX3RoZW1lc19wYWdlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQXBwZWFyYW5jZSAvIFRoZW1lIHNldHRpbmdzIHBhZ2UgVUkuXG4gKi9cbiggZnVuY3Rpb24gKCAkLCB3ICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIGNmZyA9IHcud3BiY19zZXR0aW5nc190aGVtZXNfcGFnZSB8fCB7fTtcblx0dmFyIHByZXZpZXdfYWpheCA9IG51bGw7XG5cdHZhciBwcmV2aWV3X3RpbWVyID0gMDtcblx0dmFyIHByZXZpZXdfbm90aWNlX3RpbWVyID0gMDtcblx0dmFyIHByZXZpZXdfbm90aWNlX21lc3NhZ2VfdGltZXIgPSAwO1xuXG5cdGZ1bmN0aW9uIHRyaW1fdGV4dCggdmFsdWUgKSB7XG5cdFx0cmV0dXJuIFN0cmluZyggdmFsdWUgfHwgJycgKS50cmltKCk7XG5cdH1cblxuXHRmdW5jdGlvbiBtYWtlX2Fzc2V0X3VybCggcGF0aCApIHtcblx0XHRwYXRoID0gU3RyaW5nKCBwYXRoIHx8ICcnICk7XG5cdFx0aWYgKCAvXmh0dHBzPzpcXC9cXC8vaS50ZXN0KCBwYXRoICkgfHwgL15cXC9cXC8vLnRlc3QoIHBhdGggKSApIHtcblx0XHRcdHJldHVybiBwYXRoO1xuXHRcdH1cblx0XHRyZXR1cm4gU3RyaW5nKCBjZmcucGx1Z2luX3VybCB8fCAnJyApLnJlcGxhY2UoIC9cXC8kLywgJycgKSArIHBhdGg7XG5cdH1cblxuXHRmdW5jdGlvbiBzaG93X21lc3NhZ2UoIG1lc3NhZ2UsIHR5cGUsIGRlbGF5ICkge1xuXHRcdGlmICggdHlwZW9mIHcud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHR3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCBtZXNzYWdlLCB0eXBlIHx8ICdpbmZvJywgZGVsYXkgfHwgNDAwMCwgZmFsc2UgKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBwdWxzZV9lbGVtZW50KCAkZWxlbWVudCwgZHVyYXRpb24gKSB7XG5cdFx0aWYgKCAhICRlbGVtZW50IHx8ICEgJGVsZW1lbnQubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdCRlbGVtZW50XG5cdFx0XHQucmVtb3ZlQ2xhc3MoICd3cGJjX3RoZW1lX2F0dGVudGlvbl9wdWxzZScgKVxuXHRcdFx0LmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0dm9pZCB0aGlzLm9mZnNldFdpZHRoO1xuXHRcdFx0fSApXG5cdFx0XHQuYWRkQ2xhc3MoICd3cGJjX3RoZW1lX2F0dGVudGlvbl9wdWxzZScgKTtcblxuXHRcdHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdCRlbGVtZW50LnJlbW92ZUNsYXNzKCAnd3BiY190aGVtZV9hdHRlbnRpb25fcHVsc2UnICk7XG5cdFx0fSwgZHVyYXRpb24gfHwgMjEwMCApO1xuXHR9XG5cblx0ZnVuY3Rpb24gcHVsc2VfbGF0ZXN0X3dhcm5pbmdfbm90aWNlKCkge1xuXHRcdGNsZWFyVGltZW91dCggcHJldmlld19ub3RpY2VfbWVzc2FnZV90aW1lciApO1xuXHRcdHByZXZpZXdfbm90aWNlX21lc3NhZ2VfdGltZXIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRwdWxzZV9lbGVtZW50KCAkKCAnI2FqYXhfd29ya2luZyAud3BiY19pbm5lcl9tZXNzYWdlLm5vdGljZS13YXJuaW5nJyApLmxhc3QoKSApO1xuXHRcdH0sIDUwICk7XG5cdH1cblxuXHRmdW5jdGlvbiBzaG93X2hpZ2hsaWdodGVkX25vdGljZSggbWVzc2FnZSwgdHlwZSwgZGVsYXksICRjb250cm9sICkge1xuXHRcdGlmICggJGNvbnRyb2wgJiYgJGNvbnRyb2wubGVuZ3RoICkge1xuXHRcdFx0cHVsc2VfZWxlbWVudCggJGNvbnRyb2wgKTtcblx0XHR9XG5cblx0XHRzaG93X21lc3NhZ2UoIG1lc3NhZ2UsIHR5cGUgfHwgJ3dhcm5pbmcnLCBkZWxheSB8fCA5MDAwICk7XG5cdFx0cHVsc2VfbGF0ZXN0X3dhcm5pbmdfbm90aWNlKCk7XG5cdH1cblxuXHRmdW5jdGlvbiBzd2l0Y2hfcGFuZWwoICR0YWIgKSB7XG5cdFx0dmFyIHBhbmVsX2lkID0gJHRhYi5hdHRyKCAnYXJpYS1jb250cm9scycgKTtcblx0XHR2YXIgJHRhYnMgPSAkdGFiLmNsb3Nlc3QoICcud3BiY190aGVtZV9yaWdodGJhcl90YWJzJyApLmZpbmQoICdbcm9sZT1cInRhYlwiXScgKTtcblx0XHR2YXIgJHBhbmVscyA9ICQoICcud3BiY190aGVtZV9yaWdodGJhcl9wYW5lbHMgW3JvbGU9XCJ0YWJwYW5lbFwiXScgKTtcblxuXHRcdCR0YWJzLmF0dHIoICdhcmlhLXNlbGVjdGVkJywgJ2ZhbHNlJyApO1xuXHRcdCR0YWIuYXR0ciggJ2FyaWEtc2VsZWN0ZWQnLCAndHJ1ZScgKTtcblxuXHRcdCRwYW5lbHMuYXR0ciggJ2hpZGRlbicsICdoaWRkZW4nICkuYXR0ciggJ2FyaWEtaGlkZGVuJywgJ3RydWUnICk7XG5cdFx0JCggJyMnICsgcGFuZWxfaWQgKS5yZW1vdmVBdHRyKCAnaGlkZGVuJyApLmF0dHIoICdhcmlhLWhpZGRlbicsICdmYWxzZScgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHRvZ2dsZV9ncm91cCggJGJ1dHRvbiApIHtcblx0XHR2YXIgJGdyb3VwID0gJGJ1dHRvbi5jbG9zZXN0KCAnLndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwJyApO1xuXHRcdHZhciAkZmllbGRzID0gJGdyb3VwLmZpbmQoICc+IC5ncm91cF9fZmllbGRzJyApO1xuXHRcdHZhciBpc19vcGVuID0gJGdyb3VwLmhhc0NsYXNzKCAnaXMtb3BlbicgKTtcblxuXHRcdCRncm91cC50b2dnbGVDbGFzcyggJ2lzLW9wZW4nLCAhIGlzX29wZW4gKTtcblx0XHQkYnV0dG9uLmF0dHIoICdhcmlhLWV4cGFuZGVkJywgaXNfb3BlbiA/ICdmYWxzZScgOiAndHJ1ZScgKTtcblx0XHQkZmllbGRzLnByb3AoICdoaWRkZW4nLCBpc19vcGVuICkuYXR0ciggJ2FyaWEtaGlkZGVuJywgaXNfb3BlbiA/ICd0cnVlJyA6ICdmYWxzZScgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldF9mb3JtKCkge1xuXHRcdHJldHVybiAkKCAnW2RhdGEtd3BiYy10aGVtZS1zZXR0aW5ncy1mb3JtPVwiMVwiXScgKS5maXJzdCgpO1xuXHR9XG5cblx0ZnVuY3Rpb24gY29sbGVjdF9wYXlsb2FkKCkge1xuXHRcdHZhciAkZm9ybSA9IGdldF9mb3JtKCk7XG5cdFx0dmFyIGRhdGEgPSB7fTtcblxuXHRcdHN5bmNfZm9ybV9zdHlsZV9jaG9pY2UoKTtcblxuXHRcdCQuZWFjaCggJGZvcm0uc2VyaWFsaXplQXJyYXkoKSwgZnVuY3Rpb24gKCBpbmRleCwgaXRlbSApIHtcblx0XHRcdGlmICggMCA9PT0gU3RyaW5nKCBpdGVtLm5hbWUgfHwgJycgKS5pbmRleE9mKCAnd3BiY19zZXR1cCcgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZGF0YVsgaXRlbS5uYW1lIF0gPSBpdGVtLnZhbHVlO1xuXHRcdH0gKTtcblxuXHRcdGRhdGEuYm9va2luZ190aW1lc2xvdF9waWNrZXIgPSAkZm9ybS5maW5kKCAnW25hbWU9XCJib29raW5nX3RpbWVzbG90X3BpY2tlclwiXScgKS5wcm9wKCAnY2hlY2tlZCcgKSA/ICdPbicgOiAnT2ZmJztcblx0XHRkYXRhLnJlc291cmNlX2lkID0gJCggJyN3cGJjX3RoZW1lX3Jlc291cmNlX2lkJyApLnZhbCgpIHx8ICcnO1xuXHRcdGRhdGEubW9udGhzX2NvdW50ID0gJCggJyN3cGJjX3RoZW1lX21vbnRoc19jb3VudCcgKS52YWwoKSB8fCAnJztcblx0XHRkYXRhLnByZXZpZXdfbW9kZSA9ICQoICcjd3BiY190aGVtZV9wcmV2aWV3X21vZGUnICkudmFsKCkgfHwgJ2NhbGVuZGFyJztcblx0XHRkYXRhLmN1c3RvbV9ib29raW5nX2Zvcm0gPSAkKCAnI3dwYmNfdGhlbWVfY3VzdG9tX2Zvcm0nICkudmFsKCkgfHwgJ3N0YW5kYXJkJztcblxuXHRcdHJldHVybiBkYXRhO1xuXHR9XG5cblx0ZnVuY3Rpb24gbWFwX2Zvcm1fc3R5bGVfY2hvaWNlKCB2YWx1ZSApIHtcblx0XHR2YXIgY2hvaWNlID0gU3RyaW5nKCB2YWx1ZSB8fCAnbGlnaHRfYm9yZGVyZWQnICk7XG5cdFx0dmFyIGN1cnJlbnRfdGhlbWUgPSAkKCAnI2Jvb2tpbmdfZm9ybV90aGVtZScgKS52YWwoKSB8fCAnJztcblx0XHR2YXIgcGFydHM7XG5cdFx0dmFyIHByZXNldDtcblxuXHRcdGlmICggJ2N1c3RvbScgPT09IGNob2ljZSApIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHRoZW1lIDogY3VycmVudF90aGVtZSxcblx0XHRcdFx0cHJlc2V0OiAnY3VzdG9tJ1xuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRwYXJ0cyA9IGNob2ljZS5zcGxpdCggJ18nICk7XG5cdFx0cHJlc2V0ID0gcGFydHNbMV0gfHwgJ2JvcmRlcmVkJztcblx0XHRpZiAoIFsgJ2JvcmRlcmVkJywgJ25vbmUnLCAnc29mdCcgXS5pbmRleE9mKCBwcmVzZXQgKSA9PT0gLTEgKSB7XG5cdFx0XHRwcmVzZXQgPSAnYm9yZGVyZWQnO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHR0aGVtZSA6ICggJ2RhcmsnID09PSBwYXJ0c1swXSApID8gJ3dwYmNfdGhlbWVfZGFya18xJyA6ICcnLFxuXHRcdFx0cHJlc2V0OiBwcmVzZXRcblx0XHR9O1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0X2Zvcm1fc3R5bGVfY2hvaWNlX2Zyb21fdmFsdWVzKCkge1xuXHRcdHZhciB0aGVtZSA9ICQoICcjYm9va2luZ19mb3JtX3RoZW1lJyApLnZhbCgpIHx8ICcnO1xuXHRcdHZhciBwcmVzZXQgPSAkKCAnI2Jvb2tpbmdfZm9ybV9hcHBlYXJhbmNlX3ByZXNldCcgKS52YWwoKSB8fCAnYm9yZGVyZWQnO1xuXHRcdHZhciBwcmVmaXggPSB0aGVtZSA/ICdkYXJrJyA6ICdsaWdodCc7XG5cblx0XHRpZiAoICdjdXN0b20nID09PSBwcmVzZXQgKSB7XG5cdFx0XHRyZXR1cm4gJ2N1c3RvbSc7XG5cdFx0fVxuXHRcdGlmICggWyAnYm9yZGVyZWQnLCAnbm9uZScsICdzb2Z0JyBdLmluZGV4T2YoIHByZXNldCApID09PSAtMSApIHtcblx0XHRcdHByZXNldCA9ICdib3JkZXJlZCc7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHByZWZpeCArICdfJyArIHByZXNldDtcblx0fVxuXG5cdGZ1bmN0aW9uIHN5bmNfZm9ybV9zdHlsZV9jaG9pY2UoKSB7XG5cdFx0dmFyICRjaGVja2VkID0gZ2V0X2Zvcm0oKS5maW5kKCAnW25hbWU9XCJib29raW5nX2Zvcm1fc3R5bGVcIl06Y2hlY2tlZCcgKTtcblx0XHR2YXIgbWFwcGVkO1xuXG5cdFx0aWYgKCAhICRjaGVja2VkLmxlbmd0aCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRtYXBwZWQgPSBtYXBfZm9ybV9zdHlsZV9jaG9pY2UoICRjaGVja2VkLnZhbCgpICk7XG5cdFx0JCggJyNib29raW5nX2Zvcm1fdGhlbWUnICkudmFsKCBtYXBwZWQudGhlbWUgKTtcblx0XHQkKCAnI2Jvb2tpbmdfZm9ybV9hcHBlYXJhbmNlX3ByZXNldCcgKS52YWwoIG1hcHBlZC5wcmVzZXQgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHN5bmNfZm9ybV9zdHlsZV9jaG9pY2Vfc2VsZWN0aW9uKCkge1xuXHRcdHZhciBjaG9pY2UgPSBnZXRfZm9ybV9zdHlsZV9jaG9pY2VfZnJvbV92YWx1ZXMoKTtcblx0XHR2YXIgJGNob2ljZXMgPSBnZXRfZm9ybSgpLmZpbmQoICdbbmFtZT1cImJvb2tpbmdfZm9ybV9zdHlsZVwiXScgKTtcblxuXHRcdCRjaG9pY2VzLnByb3AoICdjaGVja2VkJywgZmFsc2UgKTtcblx0XHQkY2hvaWNlcy5maWx0ZXIoICdbdmFsdWU9XCInICsgY2hvaWNlICsgJ1wiXScgKS5wcm9wKCAnY2hlY2tlZCcsIHRydWUgKTtcblxuXHRcdCQoICcud3BiY190aGVtZV9jaG9pY2UnICkucmVtb3ZlQ2xhc3MoICdpcy1zZWxlY3RlZCcgKTtcblx0XHQkY2hvaWNlcy5maWx0ZXIoICc6Y2hlY2tlZCcgKS5jbG9zZXN0KCAnLndwYmNfdGhlbWVfY2hvaWNlJyApLmFkZENsYXNzKCAnaXMtc2VsZWN0ZWQnICk7XG5cdH1cblxuXHRmdW5jdGlvbiBhcHBseV9mb3JtX3RoZW1lKCkge1xuXHRcdHZhciB0aGVtZSA9ICQoICcjYm9va2luZ19mb3JtX3RoZW1lJyApLnZhbCgpIHx8ICcnO1xuXHRcdHZhciAkcHJldmlldyA9ICQoICdbZGF0YS13cGJjLXRoZW1lLXByZXZpZXc9XCIxXCJdJyApO1xuXHRcdHZhciAkdGhlbWVfdGFyZ2V0cyA9ICRwcmV2aWV3LmFkZCggJHByZXZpZXcuZmluZCggJy53cGJjX2NvbnRhaW5lci53cGJjX2Zvcm0sIC53cGJjX2NvbnRhaW5lcl9ib29raW5nX2Zvcm0nICkgKTtcblxuXHRcdCR0aGVtZV90YXJnZXRzLmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciAkdGFyZ2V0ID0gJCggdGhpcyApO1xuXHRcdFx0dmFyIGNsYXNzZXMgPSBTdHJpbmcoIHRoaXMuY2xhc3NOYW1lIHx8ICcnICkuc3BsaXQoIC9cXHMrLyApO1xuXG5cdFx0XHQkLmVhY2goIGNsYXNzZXMsIGZ1bmN0aW9uICggaW5kZXgsIGNsYXNzX25hbWUgKSB7XG5cdFx0XHRcdGlmICggL153cGJjX3RoZW1lXy8udGVzdCggY2xhc3NfbmFtZSApICYmICEgL153cGJjX3RoZW1lX3ByZXZpZXcvLnRlc3QoIGNsYXNzX25hbWUgKSApIHtcblx0XHRcdFx0XHQkdGFyZ2V0LnJlbW92ZUNsYXNzKCBjbGFzc19uYW1lICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHR9ICk7XG5cdFx0aWYgKCB0aGVtZSApIHtcblx0XHRcdCR0aGVtZV90YXJnZXRzLmFkZENsYXNzKCB0aGVtZSApO1xuXHRcdH1cblxuXHRcdHN5bmNfZm9ybV9zdHlsZV9jaG9pY2Vfc2VsZWN0aW9uKCk7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRfZm9ybV9hcHBlYXJhbmNlX3ByZXNldHMoKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGJvcmRlcmVkOiB7XG5cdFx0XHRcdGJhY2tncm91bmQgOiAnI2ZmZmZmZicsXG5cdFx0XHRcdGJvcmRlckNvbG9yOiAnI2NjY2NjYycsXG5cdFx0XHRcdGJvcmRlcldpZHRoOiAnMXB4Jyxcblx0XHRcdFx0cmFkaXVzICAgICA6ICcycHgnLFxuXHRcdFx0XHRwYWRkaW5nICAgIDogJzEwcHggMzBweCcsXG5cdFx0XHRcdHNoYWRvdyAgICAgOiAncmdiYSgwLCAwLCAwLCAwLjA1KSAwcHggMnB4IDZweCAwcHgnXG5cdFx0XHR9LFxuXHRcdFx0bm9uZSAgICA6IHtcblx0XHRcdFx0YmFja2dyb3VuZCA6ICd0cmFuc3BhcmVudCcsXG5cdFx0XHRcdGJvcmRlckNvbG9yOiAndHJhbnNwYXJlbnQnLFxuXHRcdFx0XHRib3JkZXJXaWR0aDogJzBweCcsXG5cdFx0XHRcdHJhZGl1cyAgICAgOiAnMHB4Jyxcblx0XHRcdFx0cGFkZGluZyAgICA6ICcwcHgnLFxuXHRcdFx0XHRzaGFkb3cgICAgIDogJ25vbmUnXG5cdFx0XHR9LFxuXHRcdFx0c29mdCAgICA6IHtcblx0XHRcdFx0YmFja2dyb3VuZCA6ICcjZjlmOWZhJyxcblx0XHRcdFx0Ym9yZGVyQ29sb3I6ICcjZmZmJyxcblx0XHRcdFx0Ym9yZGVyV2lkdGg6ICczcHgnLFxuXHRcdFx0XHRyYWRpdXMgICAgIDogJzhweCcsXG5cdFx0XHRcdHBhZGRpbmcgICAgOiAnMjBweCcsXG5cdFx0XHRcdHNoYWRvdyAgICAgOiAncmdiYSgxNSwgMjMsIDQyLCAwLjA2KSAwcHggNHB4IDE2cHggMHB4J1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRmdW5jdGlvbiBpc19kYXJrX2Zvcm1fdGhlbWUoKSB7XG5cdFx0cmV0dXJuICd3cGJjX3RoZW1lX2RhcmtfMScgPT09IFN0cmluZyggJCggJyNib29raW5nX2Zvcm1fdGhlbWUnICkudmFsKCkgfHwgJycgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldF9mb3JtX2FwcGVhcmFuY2VfcHJlc2V0X2Zvcl90aGVtZSggcHJlc2V0ICkge1xuXHRcdHZhciBwcmVzZXRzID0gZ2V0X2Zvcm1fYXBwZWFyYW5jZV9wcmVzZXRzKCk7XG5cblx0XHRpZiAoICEgaXNfZGFya19mb3JtX3RoZW1lKCkgKSB7XG5cdFx0XHRyZXR1cm4gcHJlc2V0c1twcmVzZXRdIHx8IHByZXNldHMuYm9yZGVyZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKCAnc29mdCcgPT09IHByZXNldCApIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGJhY2tncm91bmQgOiAnIzFmMjkzNycsXG5cdFx0XHRcdGJvcmRlckNvbG9yOiAnIzMzNDE1NScsXG5cdFx0XHRcdGJvcmRlcldpZHRoOiAnM3B4Jyxcblx0XHRcdFx0cmFkaXVzICAgICA6ICc4cHgnLFxuXHRcdFx0XHRwYWRkaW5nICAgIDogJzIwcHgnLFxuXHRcdFx0XHRzaGFkb3cgICAgIDogJ3JnYmEoMCwgMCwgMCwgMC4yNCkgMHB4IDRweCAxNnB4IDBweCdcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHByZXNldHNbcHJlc2V0XSB8fCBwcmVzZXRzLmJvcmRlcmVkO1xuXHR9XG5cblx0ZnVuY3Rpb24gc2FuaXRpemVfdGhlbWVfY29sb3IoIHZhbHVlLCBmYWxsYmFjayApIHtcblx0XHR2YXIgdiA9IFN0cmluZyggdmFsdWUgfHwgJycgKS50cmltKCk7XG5cdFx0cmV0dXJuIC9eIyg/OlswLTlhLWZdezN9fFswLTlhLWZdezZ9KSQvaS50ZXN0KCB2ICkgfHwgJ3RyYW5zcGFyZW50JyA9PT0gdiA/IHYgOiBmYWxsYmFjaztcblx0fVxuXG5cdGZ1bmN0aW9uIHNhbml0aXplX3RoZW1lX2xlbmd0aCggdmFsdWUsIGZhbGxiYWNrICkge1xuXHRcdHZhciB2ID0gU3RyaW5nKCB2YWx1ZSB8fCAnJyApLnRyaW0oKTtcblx0XHRyZXR1cm4gL14tP1xcZCsoPzpcXC5cXGQrKT8oPzpweHxyZW18ZW18JSkkL2kudGVzdCggdiApID8gdiA6IGZhbGxiYWNrO1xuXHR9XG5cblx0ZnVuY3Rpb24gc2FuaXRpemVfdGhlbWVfc3BhY2luZyggdmFsdWUsIGZhbGxiYWNrICkge1xuXHRcdHZhciB2ID0gU3RyaW5nKCB2YWx1ZSB8fCAnJyApLnRyaW0oKS5yZXBsYWNlKCAvXFxzKy9nLCAnICcgKTtcblx0XHR2YXIgcGFydHMgPSB2ID8gdi5zcGxpdCggJyAnICkgOiBbXTtcblx0XHR2YXIgaTtcblxuXHRcdGlmICggcGFydHMubGVuZ3RoIDwgMSB8fCBwYXJ0cy5sZW5ndGggPiA0ICkge1xuXHRcdFx0cmV0dXJuIGZhbGxiYWNrO1xuXHRcdH1cblx0XHRmb3IgKCBpID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgaSsrICkge1xuXHRcdFx0aWYgKCAhIC9eLT9cXGQrKD86XFwuXFxkKyk/KD86cHh8cmVtfGVtfCUpJC9pLnRlc3QoIHBhcnRzW2ldICkgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxsYmFjaztcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHBhcnRzLmpvaW4oICcgJyApO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0X2Zvcm1fc3R5bGVfcHJlc2V0cygpIHtcblx0XHRyZXR1cm4gY2ZnLmZvcm1fc3R5bGVfcHJlc2V0cyAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIGNmZy5mb3JtX3N0eWxlX3ByZXNldHMgPyBjZmcuZm9ybV9zdHlsZV9wcmVzZXRzIDoge307XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRfY3VycmVudF9mb3JtX3N0eWxlKCkge1xuXHRcdHZhciAkY2hlY2tlZCA9IGdldF9mb3JtKCkuZmluZCggJ1tuYW1lPVwiYm9va2luZ19mb3JtX3N0eWxlXCJdOmNoZWNrZWQnICk7XG5cdFx0cmV0dXJuICRjaGVja2VkLmxlbmd0aCA/IFN0cmluZyggJGNoZWNrZWQudmFsKCkgfHwgJ2xpZ2h0X2JvcmRlcmVkJyApIDogJ2xpZ2h0X2JvcmRlcmVkJztcblx0fVxuXG5cdGZ1bmN0aW9uIGdldF9jdXN0b21fZm9ybV9zdHlsZV9kZWZhdWx0cygpIHtcblx0XHRyZXR1cm4gJC5leHRlbmQoIHtcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYmFja2dyb3VuZF9jb2xvciAgICAgICA6ICcjZmZmZmZmJyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX2NvbG9yICAgICAgICAgICA6ICcjY2NjY2NjJyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX3dpZHRoICAgICAgICAgICA6ICcxcHgnLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfcmFkaXVzICAgICAgICAgIDogJzJweCcsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX3BhZGRpbmdfdmVydGljYWwgICAgICAgOiAnMTBweCcsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX3BhZGRpbmdfaG9yaXpvbnRhbCAgICAgOiAnMzBweCcsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX3RleHRfY29sb3IgICAgICAgICAgICAgOiAnIzFkMjMyNycsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JhY2tncm91bmRfY29sb3IgOiAnI2ZmZmZmZicsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX3RleHRfY29sb3IgICAgICAgOiAnIzNjNDM0YScsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JvcmRlcl9jb2xvciAgICAgOiAnI2NjY2NjYycsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9iYWNrZ3JvdW5kX2NvbG9yOiAnIzA2NmFhYicsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl90ZXh0X2NvbG9yICAgICAgOiAnI2ZmZmZmZicsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ib3JkZXJfY29sb3IgICAgOiAnIzA2NmFhYicsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl9iYWNrZ3JvdW5kX2NvbG9yOiAnIzA1NTU4OScsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl90ZXh0X2NvbG9yOiAnI2ZmZmZmZicsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl9ib3JkZXJfY29sb3I6ICcjMDU1NTg5Jyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9iYWNrZ3JvdW5kX2NvbG9yOiAnI2ZkZmRmZCcsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fdGV4dF9jb2xvcjogJyM0NDQ0NDQnLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2JvcmRlcl9jb2xvcjogJyNlZWVlZWUnLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX2JhY2tncm91bmRfY29sb3I6ICcjZmRmZGZkJyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl90ZXh0X2NvbG9yOiAnIzQ0NDQ0NCcsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfYm9yZGVyX2NvbG9yOiAnIzRkOTFjZCdcblx0XHR9LCBjZmcuY3VzdG9tX2Zvcm1fc3R5bGVfZGVmYXVsdHMgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBjZmcuY3VzdG9tX2Zvcm1fc3R5bGVfZGVmYXVsdHMgPyBjZmcuY3VzdG9tX2Zvcm1fc3R5bGVfZGVmYXVsdHMgOiB7fSApO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0X2N1c3RvbV9mb3JtX3N0eWxlX2Nzc192YXJzKCkge1xuXHRcdHZhciBkZWZhdWx0cyA9IGdldF9jdXN0b21fZm9ybV9zdHlsZV9kZWZhdWx0cygpO1xuXHRcdHZhciB2YWx1ZXMgPSAkLmV4dGVuZCgge30sIGRlZmF1bHRzLCBjZmcuc2V0dGluZ3MgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBjZmcuc2V0dGluZ3MgPyBjZmcuc2V0dGluZ3MgOiB7fSApO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdCctLXdwYmMtYmZiLWZvcm0tYmFja2dyb3VuZCcgICAgICAgICAgOiBzYW5pdGl6ZV90aGVtZV9jb2xvciggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fYmFja2dyb3VuZF9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9iYWNrZ3JvdW5kX2NvbG9yICksXG5cdFx0XHQnLS13cGJjLWJmYi1mb3JtLWJvcmRlci1jb2xvcicgICAgICAgIDogc2FuaXRpemVfdGhlbWVfY29sb3IoIHZhbHVlcy5ib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfY29sb3IgKSxcblx0XHRcdCctLXdwYmMtYmZiLWZvcm0tYm9yZGVyLXdpZHRoJyAgICAgICAgOiBzYW5pdGl6ZV90aGVtZV9sZW5ndGgoIHZhbHVlcy5ib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl93aWR0aCwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfd2lkdGggKSxcblx0XHRcdCctLXdwYmMtYmZiLWZvcm0tYm9yZGVyLXJhZGl1cycgICAgICAgOiBzYW5pdGl6ZV90aGVtZV9sZW5ndGgoIHZhbHVlcy5ib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl9yYWRpdXMsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX3JhZGl1cyApLFxuXHRcdFx0Jy0td3BiYy1iZmItZm9ybS1wYWRkaW5nJyAgICAgICAgICAgICA6IHNhbml0aXplX3RoZW1lX2xlbmd0aCggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fcGFkZGluZ192ZXJ0aWNhbCwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9wYWRkaW5nX3ZlcnRpY2FsICkgKyAnICcgKyBzYW5pdGl6ZV90aGVtZV9sZW5ndGgoIHZhbHVlcy5ib29raW5nX2Zvcm1fY3VzdG9tX3BhZGRpbmdfaG9yaXpvbnRhbCwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9wYWRkaW5nX2hvcml6b250YWwgKSxcblx0XHRcdCctLXdwYmMtYmZiLWZvcm0tYm94LXNoYWRvdycgICAgICAgICAgOiAncmdiYSgwLCAwLCAwLCAwLjA1KSAwcHggMnB4IDZweCAwcHgnLFxuXHRcdFx0Jy0td3BiY19mb3JtLWxhYmVsLWNvbG9yJyAgICAgICAgICAgICA6IHNhbml0aXplX3RoZW1lX2NvbG9yKCB2YWx1ZXMuYm9va2luZ19mb3JtX2N1c3RvbV90ZXh0X2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX3RleHRfY29sb3IgKSxcblx0XHRcdCctLXdwYmNfZm9ybS1sYWJlbC1zdWJsYWJlbC1jb2xvcicgICAgOiBzYW5pdGl6ZV90aGVtZV9jb2xvciggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fdGV4dF9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV90ZXh0X2NvbG9yICksXG5cdFx0XHQnLS13cGJjX2Zvcm0tbGFiZWwtZXJyb3ItY29sb3InICAgICAgIDogJyNkNjM2MzcnLFxuXHRcdFx0Jy0td3BiY19mb3JtLWZpZWxkLWJhY2tncm91bmQtY29sb3InICA6IHNhbml0aXplX3RoZW1lX2NvbG9yKCB2YWx1ZXMuYm9va2luZ19mb3JtX2N1c3RvbV9maWVsZF9iYWNrZ3JvdW5kX2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JhY2tncm91bmRfY29sb3IgKSxcblx0XHRcdCctLXdwYmNfZm9ybS1maWVsZC1tZW51LWNvbG9yJyAgICAgICAgOiBzYW5pdGl6ZV90aGVtZV9jb2xvciggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYmFja2dyb3VuZF9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9maWVsZF9iYWNrZ3JvdW5kX2NvbG9yICksXG5cdFx0XHQnLS13cGJjX2Zvcm0tZmllbGQtdGV4dC1jb2xvcicgICAgICAgIDogc2FuaXRpemVfdGhlbWVfY29sb3IoIHZhbHVlcy5ib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX3RleHRfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfdGV4dF9jb2xvciApLFxuXHRcdFx0Jy0td3BiY19mb3JtLWZpZWxkLWJvcmRlci1jb2xvcicgICAgICA6IHNhbml0aXplX3RoZW1lX2NvbG9yKCB2YWx1ZXMuYm9va2luZ19mb3JtX2N1c3RvbV9maWVsZF9ib3JkZXJfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYm9yZGVyX2NvbG9yICksXG5cdFx0XHQnLS13cGJjX2Zvcm0tZmllbGQtYm9yZGVyLWNvbG9yLXNwYXJlJzogc2FuaXRpemVfdGhlbWVfY29sb3IoIHZhbHVlcy5ib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JvcmRlcl9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9maWVsZF9ib3JkZXJfY29sb3IgKSxcblx0XHRcdCctLXdwYmNfZm9ybS1maWVsZC1mb2N1cy1ib3JkZXItY29sb3InOiAnIzA2NmFhYicsXG5cdFx0XHQnLS13cGJjX2Zvcm0tZmllbGQtZm9jdXMtc2hhZG93LWNvbG9yJzogJyMwNjZhYWInLFxuXHRcdFx0Jy0td3BiY19mb3JtLWZpZWxkLWRpc2FibGVkLWNvbG9yJyAgICA6ICdyZ2JhKDAsIDAsIDAsIDAuMiknLFxuXHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1iYWNrZ3JvdW5kLWNvbG9yJyA6IHNhbml0aXplX3RoZW1lX2NvbG9yKCB2YWx1ZXMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYmFja2dyb3VuZF9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYmFja2dyb3VuZF9jb2xvciApLFxuXHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1iYWNrZ3JvdW5kLWNvbG9yLWFsdCc6IHNhbml0aXplX3RoZW1lX2NvbG9yKCB2YWx1ZXMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYmFja2dyb3VuZF9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYmFja2dyb3VuZF9jb2xvciApLFxuXHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1ib3JkZXItY29sb3InICAgICA6IHNhbml0aXplX3RoZW1lX2NvbG9yKCB2YWx1ZXMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYm9yZGVyX2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ib3JkZXJfY29sb3IgKSxcblx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tdGV4dC1jb2xvcicgICAgICAgOiBzYW5pdGl6ZV90aGVtZV9jb2xvciggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX3RleHRfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX3RleHRfY29sb3IgKSxcblx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tdGV4dC1jb2xvci1hbHQnICAgOiBzYW5pdGl6ZV90aGVtZV9jb2xvciggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX3RleHRfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX3RleHRfY29sb3IgKSxcblx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24taG92ZXItYmFja2dyb3VuZC1jb2xvcic6IHNhbml0aXplX3RoZW1lX2NvbG9yKCB2YWx1ZXMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfYmFja2dyb3VuZF9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfYmFja2dyb3VuZF9jb2xvciApLFxuXHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1ob3Zlci1ib3JkZXItY29sb3InOiBzYW5pdGl6ZV90aGVtZV9jb2xvciggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JvcmRlcl9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfYm9yZGVyX2NvbG9yICksXG5cdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWhvdmVyLXRleHQtY29sb3InIDogc2FuaXRpemVfdGhlbWVfY29sb3IoIHZhbHVlcy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl90ZXh0X2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl90ZXh0X2NvbG9yICksXG5cdFx0XHQnLS13cGJjX2Zvcm0tY2hvaWNlLWNoZWNrZWQtYm9yZGVyLWNvbG9yJzogJyMwNjZhYWInLFxuXHRcdFx0Jy0td3BiY19mb3JtLWNob2ljZS1jaGVja2VkLWNvbG9yJyAgICA6ICcjMDY2YWFiJyxcblx0XHRcdCctLXdwYmNfZm9ybS1jaG9pY2UtZm9jdXMtY29sb3InICAgICAgOiAnIzA2NmFhYicsXG5cdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWxpZ2h0LWJhY2tncm91bmQtY29sb3InOiBzYW5pdGl6ZV90aGVtZV9jb2xvciggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9iYWNrZ3JvdW5kX2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fYmFja2dyb3VuZF9jb2xvciApLFxuXHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1saWdodC1ib3JkZXItY29sb3InOiBzYW5pdGl6ZV90aGVtZV9jb2xvciggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ib3JkZXJfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ib3JkZXJfY29sb3IgKSxcblx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tbGlnaHQtdGV4dC1jb2xvcicgOiBzYW5pdGl6ZV90aGVtZV9jb2xvciggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl90ZXh0X2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fdGV4dF9jb2xvciApLFxuXHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1saWdodC1ib3gtc2hhZG93JyA6ICcwIDJweCAxMHB4IDJweCAjZmZmZmZmNTQnLFxuXHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1saWdodC1ob3Zlci1iYWNrZ3JvdW5kLWNvbG9yJzogc2FuaXRpemVfdGhlbWVfY29sb3IoIHZhbHVlcy5ib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfYmFja2dyb3VuZF9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX2JhY2tncm91bmRfY29sb3IgKSxcblx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tbGlnaHQtaG92ZXItYm9yZGVyLWNvbG9yJzogc2FuaXRpemVfdGhlbWVfY29sb3IoIHZhbHVlcy5ib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfYm9yZGVyX2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfYm9yZGVyX2NvbG9yICksXG5cdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWxpZ2h0LWhvdmVyLXRleHQtY29sb3InOiBzYW5pdGl6ZV90aGVtZV9jb2xvciggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl90ZXh0X2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfdGV4dF9jb2xvciApLFxuXHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1saWdodC1ob3Zlci1ib3gtc2hhZG93JzogJzAgMnB4IDEwcHggMnB4ICNmZmZmZmY1NCcsXG5cdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLXByaW1hcnktaG92ZXItYm9yZGVyLWNvbG9yJzogc2FuaXRpemVfdGhlbWVfY29sb3IoIHZhbHVlcy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl9ib3JkZXJfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JvcmRlcl9jb2xvciApLFxuXHRcdFx0Jy0td3BiY19mb3JtLXBhZ2UtYnJlYWstY29sb3InICAgICAgICA6ICcjMDY2YWFiJ1xuXHRcdH07XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRfZm9ybV9zdHlsZV9jc3NfdmFyX25hbWVzKCkge1xuXHRcdHZhciBrZXlzID0gW107XG5cdFx0dmFyIHByZXNldHM7XG5cblx0XHRpZiAoIEFycmF5LmlzQXJyYXkoIGNmZy5mb3JtX3N0eWxlX2Nzc192YXJfbmFtZXMgKSAmJiBjZmcuZm9ybV9zdHlsZV9jc3NfdmFyX25hbWVzLmxlbmd0aCApIHtcblx0XHRcdHJldHVybiBjZmcuZm9ybV9zdHlsZV9jc3NfdmFyX25hbWVzO1xuXHRcdH1cblxuXHRcdHByZXNldHMgPSBnZXRfZm9ybV9zdHlsZV9wcmVzZXRzKCk7XG5cdFx0JC5lYWNoKCBwcmVzZXRzLCBmdW5jdGlvbiAoIHByZXNldF9rZXksIHByZXNldCApIHtcblx0XHRcdGlmICggcHJlc2V0ICYmIHByZXNldC5jc3NfdmFycyAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIHByZXNldC5jc3NfdmFycyApIHtcblx0XHRcdFx0JC5lYWNoKCBwcmVzZXQuY3NzX3ZhcnMsIGZ1bmN0aW9uICggdmFyX25hbWUgKSB7XG5cdFx0XHRcdFx0aWYgKCAtMSA9PT0ga2V5cy5pbmRleE9mKCB2YXJfbmFtZSApICkge1xuXHRcdFx0XHRcdFx0a2V5cy5wdXNoKCB2YXJfbmFtZSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblxuXHRcdCQuZWFjaCggZ2V0X2N1c3RvbV9mb3JtX3N0eWxlX2Nzc192YXJzKCksIGZ1bmN0aW9uICggdmFyX25hbWUgKSB7XG5cdFx0XHRpZiAoIC0xID09PSBrZXlzLmluZGV4T2YoIHZhcl9uYW1lICkgKSB7XG5cdFx0XHRcdGtleXMucHVzaCggdmFyX25hbWUgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHRyZXR1cm4ga2V5cztcblx0fVxuXG5cdGZ1bmN0aW9uIHJlc29sdmVfZm9ybV9zdHlsZV9jc3NfdmFycyggc3R5bGUgKSB7XG5cdFx0dmFyIHByZXNldHMgPSBnZXRfZm9ybV9zdHlsZV9wcmVzZXRzKCk7XG5cdFx0dmFyIHByZXNldCA9IHByZXNldHNbIHN0eWxlIF0gfHwgcHJlc2V0cy5saWdodF9ib3JkZXJlZCB8fCB7fTtcblxuXHRcdGlmICggJ2N1c3RvbScgPT09IHN0eWxlIHx8IHByZXNldC5jdXN0b20gKSB7XG5cdFx0XHRyZXR1cm4gZ2V0X2N1c3RvbV9mb3JtX3N0eWxlX2Nzc192YXJzKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHByZXNldC5jc3NfdmFycyAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIHByZXNldC5jc3NfdmFycyA/IHByZXNldC5jc3NfdmFycyA6IHt9O1xuXHR9XG5cblx0ZnVuY3Rpb24gYXBwbHlfZm9ybV9zdHlsZV90b19wcmV2aWV3KCkge1xuXHRcdHZhciBzdHlsZSA9IGdldF9jdXJyZW50X2Zvcm1fc3R5bGUoKTtcblx0XHR2YXIgcHJlc2V0cyA9IGdldF9mb3JtX3N0eWxlX3ByZXNldHMoKTtcblx0XHR2YXIgcHJlc2V0ID0gcHJlc2V0c1sgc3R5bGUgXSB8fCBwcmVzZXRzLmxpZ2h0X2JvcmRlcmVkIHx8IHt9O1xuXHRcdHZhciBjc3NfdmFycyA9IHJlc29sdmVfZm9ybV9zdHlsZV9jc3NfdmFycyggc3R5bGUgKTtcblx0XHR2YXIgY3NzX3Zhcl9uYW1lcyA9IGdldF9mb3JtX3N0eWxlX2Nzc192YXJfbmFtZXMoKTtcblx0XHR2YXIgaXNfY3VzdG9tID0gKCAnY3VzdG9tJyA9PT0gc3R5bGUgfHwgcHJlc2V0LmN1c3RvbSApO1xuXHRcdHZhciAkcHJldmlldyA9ICQoICdbZGF0YS13cGJjLXRoZW1lLXByZXZpZXc9XCIxXCJdJyApO1xuXHRcdHZhciAkdGFyZ2V0cyA9ICRwcmV2aWV3LmZpbmQoICcud3BiY19jb250YWluZXIud3BiY19mb3JtLCAud3BiY19iZmJfZm9ybSwgLndwYmNfYmZiX19mb3JtX3ByZXZpZXdfc2VjdGlvbl9jb250YWluZXInICk7XG5cblx0XHQkKCAnW2RhdGEtd3BiYy10aGVtZS1jdXN0b20tYXBwZWFyYW5jZS1ub3RpY2U9XCIxXCJdJyApLnRvZ2dsZSggaXNfY3VzdG9tICk7XG5cblx0XHRpZiAoICEgJHRhcmdldHMubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdCR0YXJnZXRzXG5cdFx0XHQucmVtb3ZlQ2xhc3MoICd3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfY3VzdG9tJyApXG5cdFx0XHQuZWFjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHR2YXIgc3R5bGVfb2JqID0gdGhpcy5zdHlsZTtcblxuXHRcdFx0XHQkLmVhY2goIGNzc192YXJfbmFtZXMsIGZ1bmN0aW9uICggaW5kZXgsIHZhcl9uYW1lICkge1xuXHRcdFx0XHRcdHN0eWxlX29iai5yZW1vdmVQcm9wZXJ0eSggdmFyX25hbWUgKTtcblx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdCQuZWFjaCggY3NzX3ZhcnMsIGZ1bmN0aW9uICggdmFyX25hbWUsIHZhbHVlICkge1xuXHRcdFx0XHRcdGlmICggJycgIT09IFN0cmluZyggdmFsdWUgfHwgJycgKSApIHtcblx0XHRcdFx0XHRcdHN0eWxlX29iai5zZXRQcm9wZXJ0eSggdmFyX25hbWUsIHZhbHVlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9ICk7XG5cblx0XHRpZiAoIGlzX2N1c3RvbSApIHtcblx0XHRcdCR0YXJnZXRzLmZpbHRlciggJy53cGJjX2NvbnRhaW5lci53cGJjX2Zvcm0sIC53cGJjX2JmYl9mb3JtJyApLmFkZENsYXNzKCAnd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX2N1c3RvbScgKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiByZXNvbHZlX2Zvcm1fYXBwZWFyYW5jZSgpIHtcblx0XHR2YXIgcHJlc2V0ID0gJCggJyNib29raW5nX2Zvcm1fYXBwZWFyYW5jZV9wcmVzZXQnICkudmFsKCkgfHwgJ2JvcmRlcmVkJztcblxuXHRcdGlmICggJ2N1c3RvbScgPT09IHByZXNldCApIHtcblx0XHRcdHJldHVybiBnZXRfZm9ybV9hcHBlYXJhbmNlX3ByZXNldHMoKS5ib3JkZXJlZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gZ2V0X2Zvcm1fYXBwZWFyYW5jZV9wcmVzZXRfZm9yX3RoZW1lKCBwcmVzZXQgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGFwcGx5X2Zvcm1fYXBwZWFyYW5jZSgpIHtcblx0XHRhcHBseV9mb3JtX3N0eWxlX3RvX3ByZXZpZXcoKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGFwcGx5X2NhbGVuZGFyX3NraW4oKSB7XG5cdFx0dmFyICRzZWxlY3QgPSAkKCAnW2RhdGEtd3BiYy10aGVtZS1jYWxlbmRhci1za2luPVwiMVwiXScgKTtcblx0XHR2YXIgdmFsdWUgPSAkc2VsZWN0LmZpbmQoICdvcHRpb246c2VsZWN0ZWQnICkuYXR0ciggJ2RhdGEtd3BiYy1jYWxlbmRhci1za2luLXVybCcgKSB8fCAkc2VsZWN0LnZhbCgpIHx8ICcnO1xuXHRcdHZhciBza2luX3VybCA9IHZhbHVlID8gbWFrZV9hc3NldF91cmwoIHZhbHVlICkgOiAnJztcblxuXHRcdGlmICggc2tpbl91cmwgJiYgdHlwZW9mIHcud3BiY19fY2FsZW5kYXJfX2NoYW5nZV9za2luID09PSAnZnVuY3Rpb24nICYmICQoICcjd3BiYy1jYWxlbmRhci1za2luLWNzcycgKS5sZW5ndGggKSB7XG5cdFx0XHR3LndwYmNfX2NhbGVuZGFyX19jaGFuZ2Vfc2tpbiggc2tpbl91cmwgKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBhcHBseV90aW1lX3NraW4oKSB7XG5cdFx0dmFyIHZhbHVlID0gJCggJ1tkYXRhLXdwYmMtdGhlbWUtdGltZS1za2luPVwiMVwiXScgKS52YWwoKSB8fCAnJztcblx0XHR2YXIgc2tpbl91cmwgPSB2YWx1ZSA/IG1ha2VfYXNzZXRfdXJsKCB2YWx1ZSApIDogJyc7XG5cblx0XHRpZiAoIHNraW5fdXJsICYmIHR5cGVvZiB3LndwYmNfX2Nzc19fY2hhbmdlX3NraW4gPT09ICdmdW5jdGlvbicgJiYgJCggJyN3cGJjLXRpbWVfcGlja2VyLXNraW4tY3NzJyApLmxlbmd0aCApIHtcblx0XHRcdHcud3BiY19fY3NzX19jaGFuZ2Vfc2tpbiggc2tpbl91cmwsICd3cGJjLXRpbWVfcGlja2VyLXNraW4tY3NzJyApO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHNlbGVjdF9pZl9vcHRpb25fZXhpc3RzKCAkc2VsZWN0LCB2YWx1ZSApIHtcblx0XHR2YXIgJG9wdGlvbjtcblxuXHRcdGlmICggISAkc2VsZWN0Lmxlbmd0aCB8fCAhIHZhbHVlICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdCRvcHRpb24gPSAkc2VsZWN0LmZpbmQoICdvcHRpb25bdmFsdWU9XCInICsgdmFsdWUgKyAnXCJdJyApO1xuXHRcdGlmICggISAkb3B0aW9uLmxlbmd0aCApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoICRzZWxlY3QudmFsKCkgPT09IHZhbHVlICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdCRzZWxlY3QudmFsKCB2YWx1ZSApLnRyaWdnZXIoICdjaGFuZ2UnICk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRmdW5jdGlvbiBwYXJzZV9udW1iZXJfbGlzdCggdmFsdWUgKSB7XG5cdFx0aWYgKCBBcnJheS5pc0FycmF5KCB2YWx1ZSApICkge1xuXHRcdFx0cmV0dXJuICQubWFwKCB2YWx1ZSwgZnVuY3Rpb24gKCBpdGVtICkge1xuXHRcdFx0XHR2YXIgcGFyc2VkID0gcGFyc2VJbnQoIGl0ZW0sIDEwICk7XG5cdFx0XHRcdHJldHVybiBpc05hTiggcGFyc2VkICkgPyBudWxsIDogcGFyc2VkO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdHJldHVybiAkLm1hcCggU3RyaW5nKCB2YWx1ZSB8fCAnJyApLnNwbGl0KCAvXFxzKixcXHMqLyApLCBmdW5jdGlvbiAoIGl0ZW0gKSB7XG5cdFx0XHR2YXIgcGFyc2VkID0gcGFyc2VJbnQoIGl0ZW0sIDEwICk7XG5cdFx0XHRyZXR1cm4gKCAnJyA9PT0gaXRlbSB8fCBpc05hTiggcGFyc2VkICkgKSA/IG51bGwgOiBwYXJzZWQ7XG5cdFx0fSApO1xuXHR9XG5cblx0ZnVuY3Rpb24gc2V0X2NhbGVuZGFyX3BhcmFtKCByZXNvdXJjZV9pZCwga2V5LCB2YWx1ZSApIHtcblx0XHRpZiAoIHcuX3dwYmMgJiYgdHlwZW9mIHcuX3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdHcuX3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsIGtleSwgdmFsdWUgKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBhcHBseV9kYXlzX3NlbGVjdGlvbl90b19jYWxlbmRhciggcmVzb3VyY2VfaWQsIGRheXNfc2VsZWN0aW9uLCBzaG91bGRfcmVpbml0ICkge1xuXHRcdHZhciBkcyA9IGRheXNfc2VsZWN0aW9uIHx8IHt9O1xuXHRcdHZhciBmaXhlZF93ZWVrX2RheXM7XG5cdFx0dmFyIGR5bmFtaWNfc3BlY2lmaWM7XG5cdFx0dmFyIGR5bmFtaWNfd2Vla19kYXlzO1xuXG5cdFx0aWYgKCAhIHJlc291cmNlX2lkIHx8ICEgdy5fd3BiYyB8fCB0eXBlb2Ygdy5fd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlICE9PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGZpeGVkX3dlZWtfZGF5cyA9IHBhcnNlX251bWJlcl9saXN0KCBkcy5maXhlZF9fd2Vla19kYXlzX19zdGFydCApO1xuXHRcdGR5bmFtaWNfc3BlY2lmaWMgPSBwYXJzZV9udW1iZXJfbGlzdCggZHMuZHluYW1pY19fZGF5c19zcGVjaWZpYyApO1xuXHRcdGR5bmFtaWNfd2Vla19kYXlzID0gcGFyc2VfbnVtYmVyX2xpc3QoIGRzLmR5bmFtaWNfX3dlZWtfZGF5c19fc3RhcnQgKTtcblxuXHRcdHNldF9jYWxlbmRhcl9wYXJhbSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJywgU3RyaW5nKCBkcy5kYXlzX3NlbGVjdF9tb2RlIHx8ICdtdWx0aXBsZScgKSApO1xuXHRcdHNldF9jYWxlbmRhcl9wYXJhbSggcmVzb3VyY2VfaWQsICdmaXhlZF9fZGF5c19udW0nLCBwYXJzZUludCggZHMuZml4ZWRfX2RheXNfbnVtIHx8IDAsIDEwICkgKTtcblx0XHRzZXRfY2FsZW5kYXJfcGFyYW0oIHJlc291cmNlX2lkLCAnZml4ZWRfX3dlZWtfZGF5c19fc3RhcnQnLCBmaXhlZF93ZWVrX2RheXMubGVuZ3RoID8gZml4ZWRfd2Vla19kYXlzIDogWyAtMSBdICk7XG5cdFx0c2V0X2NhbGVuZGFyX3BhcmFtKCByZXNvdXJjZV9pZCwgJ2R5bmFtaWNfX2RheXNfbWluJywgcGFyc2VJbnQoIGRzLmR5bmFtaWNfX2RheXNfbWluIHx8IDAsIDEwICkgKTtcblx0XHRzZXRfY2FsZW5kYXJfcGFyYW0oIHJlc291cmNlX2lkLCAnZHluYW1pY19fZGF5c19tYXgnLCBwYXJzZUludCggZHMuZHluYW1pY19fZGF5c19tYXggfHwgMCwgMTAgKSApO1xuXHRcdHNldF9jYWxlbmRhcl9wYXJhbSggcmVzb3VyY2VfaWQsICdkeW5hbWljX19kYXlzX3NwZWNpZmljJywgZHluYW1pY19zcGVjaWZpYyApO1xuXHRcdHNldF9jYWxlbmRhcl9wYXJhbSggcmVzb3VyY2VfaWQsICdkeW5hbWljX193ZWVrX2RheXNfX3N0YXJ0JywgZHluYW1pY193ZWVrX2RheXMubGVuZ3RoID8gZHluYW1pY193ZWVrX2RheXMgOiBbIC0xIF0gKTtcblxuXHRcdGlmICggdHlwZW9mIHcud3BiY19fY29uZGl0aW9uc19fU0FWRV9JTklUSUFMX19kYXlzX3NlbGVjdGlvbl9wYXJhbXNfX2JtID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0dy53cGJjX19jb25kaXRpb25zX19TQVZFX0lOSVRJQUxfX2RheXNfc2VsZWN0aW9uX3BhcmFtc19fYm0oIHJlc291cmNlX2lkICk7XG5cdFx0fVxuXG5cdFx0aWYgKCBzaG91bGRfcmVpbml0ICYmIHR5cGVvZiB3LndwYmNfY2FsX19yZV9pbml0ID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0dy53cGJjX2NhbF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBlbnN1cmVfY2FsZW5kYXJfb25seV9kYXlzX3NlbGVjdGlvbigpIHtcblx0XHR2YXIgJHByZXZpZXcgPSAkKCAnW2RhdGEtd3BiYy10aGVtZS1wcmV2aWV3PVwiMVwiXScgKS5maXJzdCgpO1xuXHRcdHZhciBwcmV2aWV3X21vZGUgPSAkcHJldmlldy5hdHRyKCAnZGF0YS1wcmV2aWV3LW1vZGUnICkgfHwgJCggJyN3cGJjX3RoZW1lX3ByZXZpZXdfbW9kZScgKS52YWwoKSB8fCAnY2FsZW5kYXInO1xuXHRcdHZhciByZXNvdXJjZV9pZCA9IHBhcnNlSW50KCAkcHJldmlldy5hdHRyKCAnZGF0YS1yZXNvdXJjZS1pZCcgKSB8fCAwLCAxMCApO1xuXHRcdHZhciBleHBlY3RlZCA9IGNmZy5kYXlzX3NlbGVjdGlvbiB8fCB7fTtcblx0XHR2YXIgZXhwZWN0ZWRfbW9kZSA9IFN0cmluZyggZXhwZWN0ZWQuZGF5c19zZWxlY3RfbW9kZSB8fCAnbXVsdGlwbGUnICk7XG5cdFx0dmFyIGN1cnJlbnRfbW9kZSA9IG51bGw7XG5cdFx0dmFyICRjYWxlbmRhcjtcblx0XHR2YXIgc2hvdWxkX3JlaW5pdCA9IGZhbHNlO1xuXG5cdFx0aWYgKCAnY2FsZW5kYXInICE9PSBwcmV2aWV3X21vZGUgfHwgISByZXNvdXJjZV9pZCB8fCAhIGV4cGVjdGVkX21vZGUgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCAhIHcuX3dwYmMgfHwgdHlwZW9mIHcuX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSAhPT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjdXJyZW50X21vZGUgPSB3Ll93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKTtcblx0XHRpZiAoIFN0cmluZyggY3VycmVudF9tb2RlIHx8ICcnICkgPT09IGV4cGVjdGVkX21vZGUgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0JGNhbGVuZGFyID0gJCggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICk7XG5cdFx0c2hvdWxkX3JlaW5pdCA9ICRjYWxlbmRhci5sZW5ndGggJiYgJGNhbGVuZGFyLmhhc0NsYXNzKCAnaGFzRGF0ZXBpY2snICk7XG5cblx0XHRhcHBseV9kYXlzX3NlbGVjdGlvbl90b19jYWxlbmRhciggcmVzb3VyY2VfaWQsIGV4cGVjdGVkLCBzaG91bGRfcmVpbml0ICk7XG5cdH1cblxuXHRmdW5jdGlvbiBhcHBseV9yZWxhdGVkX3NraW5zX2Zvcl90aGVtZSggdGhlbWUgKSB7XG5cdFx0dmFyIGNhbGVuZGFyX3NraW4gPSB0aGVtZSA/ICcvY3NzL3NraW5zLzI0XzlfX2RhcmtfMS5jc3MnIDogJy9jc3Mvc2tpbnMvMjVfNV9fc3F1YXJlXzEuY3NzJztcblx0XHR2YXIgdGltZV9za2luID0gdGhlbWUgPyAnL2Nzcy90aW1lX3BpY2tlcl9za2lucy9ibGFjay5jc3MnIDogJy9jc3MvdGltZV9waWNrZXJfc2tpbnMvbGlnaHRfXzI0XzguY3NzJztcblxuXHRcdHNlbGVjdF9pZl9vcHRpb25fZXhpc3RzKCAkKCAnW2RhdGEtd3BiYy10aGVtZS1jYWxlbmRhci1za2luPVwiMVwiXScgKSwgY2FsZW5kYXJfc2tpbiApO1xuXHRcdHNlbGVjdF9pZl9vcHRpb25fZXhpc3RzKCAkKCAnW2RhdGEtd3BiYy10aGVtZS10aW1lLXNraW49XCIxXCJdJyApLCB0aW1lX3NraW4gKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHB1bHNlX3ByZXZpZXdfbW9kZV9jb250cm9sKCkge1xuXHRcdHZhciAkY29udHJvbCA9ICQoICcud3BiY190aGVtZV9jb250cm9sX3ByZXZpZXdfbW9kZScgKS5maXJzdCgpO1xuXG5cdFx0cHVsc2VfZWxlbWVudCggJGNvbnRyb2wgKTtcblxuXHRcdGNsZWFyVGltZW91dCggcHJldmlld19ub3RpY2VfdGltZXIgKTtcblx0XHRwcmV2aWV3X25vdGljZV90aW1lciA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdCRjb250cm9sLnJlbW92ZUNsYXNzKCAnd3BiY190aGVtZV9hdHRlbnRpb25fcHVsc2UnICk7XG5cdFx0fSwgMjEwMCApO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0X3ByZXZpZXdfbm90aWNlX21lc3NhZ2UoIG5vdGljZV90eXBlICkge1xuXHRcdHZhciBpMThuID0gY2ZnLmkxOG4gfHwge307XG5cblx0XHRpZiAoICdmb3JtJyA9PT0gbm90aWNlX3R5cGUgKSB7XG5cdFx0XHRyZXR1cm4gaTE4bi5mb3JtX3ByZXZpZXdfb3B0aW9uX25vdGljZSB8fCAnVGhpcyBvcHRpb24gaXMgdmlzaWJsZSBpbiB0aGUgQm9va2luZyBmb3JtIHByZXZpZXcuIFN3aXRjaCBQcmV2aWV3IHRvIEJvb2tpbmcgZm9ybSB0byBpbnNwZWN0IGl0Lic7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICcnO1xuXHR9XG5cblx0ZnVuY3Rpb24gbWF5YmVfc2hvd19wcmV2aWV3X25vdGljZSggJHNvdXJjZSApIHtcblx0XHR2YXIgbm90aWNlX3R5cGUgPSAkc291cmNlLmF0dHIoICdkYXRhLXdwYmMtdGhlbWUtcHJldmlldy1ub3RpY2UnICkgfHwgJyc7XG5cdFx0dmFyIHByZXZpZXdfbW9kZSA9ICQoICcjd3BiY190aGVtZV9wcmV2aWV3X21vZGUnICkudmFsKCkgfHwgJ2NhbGVuZGFyJztcblx0XHR2YXIgbWVzc2FnZSA9IGdldF9wcmV2aWV3X25vdGljZV9tZXNzYWdlKCBub3RpY2VfdHlwZSApO1xuXHRcdHZhciAkY29udHJvbCA9ICQoICcud3BiY190aGVtZV9jb250cm9sX3ByZXZpZXdfbW9kZScgKS5maXJzdCgpO1xuXG5cdFx0aWYgKCAhIG1lc3NhZ2UgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCAnZm9ybScgPT09IG5vdGljZV90eXBlICYmICdjYWxlbmRhcicgIT09IHByZXZpZXdfbW9kZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoICdmb3JtJyA9PT0gbm90aWNlX3R5cGUgKSB7XG5cdFx0XHRwdWxzZV9wcmV2aWV3X21vZGVfY29udHJvbCgpO1xuXHRcdFx0c2hvd19oaWdobGlnaHRlZF9ub3RpY2UoIG1lc3NhZ2UsICd3YXJuaW5nJywgOTAwMCApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHNob3dfaGlnaGxpZ2h0ZWRfbm90aWNlKCBtZXNzYWdlLCAnd2FybmluZycsIDkwMDAsICRjb250cm9sICk7XG5cdH1cblxuXHRmdW5jdGlvbiBzaG93X2NhbGVuZGFyX29ubHlfdGhlbWVfbm90aWNlKCkge1xuXHRcdHZhciBwcmV2aWV3X21vZGUgPSAkKCAnI3dwYmNfdGhlbWVfcHJldmlld19tb2RlJyApLnZhbCgpIHx8ICdjYWxlbmRhcic7XG5cblx0XHRpZiAoICdjYWxlbmRhcicgIT09IHByZXZpZXdfbW9kZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRwdWxzZV9wcmV2aWV3X21vZGVfY29udHJvbCgpO1xuXHRcdHNob3dfaGlnaGxpZ2h0ZWRfbm90aWNlKFxuXHRcdFx0Y2ZnLmkxOG4gJiYgY2ZnLmkxOG4uY2FsZW5kYXJfb25seV90aGVtZV9ub3RpY2UgPyBjZmcuaTE4bi5jYWxlbmRhcl9vbmx5X3RoZW1lX25vdGljZSA6ICdQcmV2aWV3IGlzIHNldCB0byBDYWxlbmRhciBvbmx5LiBTd2l0Y2ggUHJldmlldyB0byBCb29raW5nIGZvcm0gdG8gaW5zcGVjdCB0aGUgZm9ybSB0aGVtZS4nLFxuXHRcdFx0J3dhcm5pbmcnLFxuXHRcdFx0OTAwMFxuXHRcdCk7XG5cdH1cblxuXHRmdW5jdGlvbiBzeW5jX3RpbWVfcGlja2VyX3ByZXZpZXcoKSB7XG5cdFx0dmFyIGlzX2VuYWJsZWQgPSBnZXRfZm9ybSgpLmZpbmQoICdbbmFtZT1cImJvb2tpbmdfdGltZXNsb3RfcGlja2VyXCJdJyApLnByb3AoICdjaGVja2VkJyApO1xuXHRcdHZhciAkcHJldmlldyA9ICQoICdbZGF0YS13cGJjLXRoZW1lLXByZXZpZXc9XCIxXCJdJyApO1xuXHRcdHZhciB0aW1lX3NlbGVjdG9ycyA9ICdzZWxlY3RbbmFtZV49XCJyYW5nZXRpbWVcIl0sIHNlbGVjdFtuYW1lXj1cInN0YXJ0dGltZVwiXSwgc2VsZWN0W25hbWVePVwiZW5kdGltZVwiXSwgc2VsZWN0W25hbWVePVwiZHVyYXRpb250aW1lXCJdJztcblxuXHRcdGlmICggdy5fd3BiYyAmJiB0eXBlb2Ygdy5fd3BiYy5zZXRfb3RoZXJfcGFyYW0gPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHR3Ll93cGJjLnNldF9vdGhlcl9wYXJhbSggJ2lzX2VuYWJsZWRfYm9va2luZ190aW1lc2xvdF9waWNrZXInLCAhISBpc19lbmFibGVkICk7XG5cdFx0fVxuXG5cdFx0aWYgKCBpc19lbmFibGVkICkge1xuXHRcdFx0aWYgKCB3Ll93cGJjICYmIHR5cGVvZiB3LndwYmNfaG9va19faW5pdF90aW1lc2VsZWN0b3IgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdHcud3BiY19ob29rX19pbml0X3RpbWVzZWxlY3RvcigpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdCRwcmV2aWV3LmZpbmQoICcud3BiY190aW1lc19zZWxlY3RvcicgKS5yZW1vdmUoKTtcblx0XHQkcHJldmlldy5maW5kKCB0aW1lX3NlbGVjdG9ycyApLnNob3coKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHJlZnJlc2hfcHJldmlld19tb2RlX2NvbnRyb2xzKCkge1xuXHRcdHZhciBwcmV2aWV3X21vZGUgPSAkKCAnI3dwYmNfdGhlbWVfcHJldmlld19tb2RlJyApLnZhbCgpIHx8ICdjYWxlbmRhcic7XG5cdFx0JCggJ1tkYXRhLXdwYmMtdGhlbWUtZm9ybS1jb250cm9sPVwiMVwiXScgKS50b2dnbGVDbGFzcyggJ2lzLXZpc2libGUnLCAnZm9ybScgPT09IHByZXZpZXdfbW9kZSApO1xuXHR9XG5cblx0ZnVuY3Rpb24gc2V0X2NhbGVuZGFyX2xvYWRpbmcoIGlzX2xvYWRpbmcgKSB7XG5cdFx0dmFyICRwYW5lbCA9ICQoICdbZGF0YS13cGJjLXRoZW1lLWNhbGVuZGFyLXBhbmVsPVwiMVwiXScgKTtcblxuXHRcdCRwYW5lbC50b2dnbGVDbGFzcyggJ2lzLWxvYWRpbmcnLCAhISBpc19sb2FkaW5nICk7XG5cdFx0JHBhbmVsLmZpbmQoICcud3BiY190aGVtZV9jYWxlbmRhcl9sb2FkaW5nJyApLnJlbW92ZSgpO1xuXG5cdFx0aWYgKCBpc19sb2FkaW5nICkge1xuXHRcdFx0JHBhbmVsLmFwcGVuZChcblx0XHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjX2NhbGVuZGFyX2xvYWRpbmcgd3BiY190aGVtZV9jYWxlbmRhcl9sb2FkaW5nXCI+JyArXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwid3BiY19pY25fYXV0b3JlbmV3IHdwYmNfYW5pbWF0aW9uX3NwaW5cIj48L3NwYW4+Jm5ic3A7JyArXG5cdFx0XHRcdFx0dHJpbV90ZXh0KCBjZmcuaTE4biAmJiBjZmcuaTE4bi5sb2FkaW5nID8gY2ZnLmkxOG4ubG9hZGluZyA6ICdMb2FkaW5nJyApICtcblx0XHRcdFx0JzwvZGl2Pidcblx0XHRcdCk7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gcmVmcmVzaF9wcmV2aWV3KCkge1xuXHRcdHZhciBkYXRhID0gY29sbGVjdF9wYXlsb2FkKCk7XG5cblx0XHRpZiAoIHByZXZpZXdfYWpheCAmJiBwcmV2aWV3X2FqYXgucmVhZHlTdGF0ZSAhPT0gNCApIHtcblx0XHRcdHByZXZpZXdfYWpheC5hYm9ydCgpO1xuXHRcdH1cblxuXHRcdGRhdGEuYWN0aW9uID0gY2ZnLnByZXZpZXdfYWN0aW9uO1xuXHRcdGRhdGEubm9uY2UgPSBjZmcubm9uY2U7XG5cblx0XHRzZXRfY2FsZW5kYXJfbG9hZGluZyggdHJ1ZSApO1xuXHRcdHByZXZpZXdfYWpheCA9ICQucG9zdCggY2ZnLmFqYXhfdXJsLCBkYXRhIClcblx0XHRcdC5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0XHRpZiAoIHJlc3BvbnNlICYmIHJlc3BvbnNlLnN1Y2Nlc3MgJiYgcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLmh0bWwgKSB7XG5cdFx0XHRcdFx0JCggJ1tkYXRhLXdwYmMtdGhlbWUtcHJldmlldz1cIjFcIl0nICkucmVwbGFjZVdpdGgoIHJlc3BvbnNlLmRhdGEuaHRtbCApO1xuXHRcdFx0XHRcdGlmICggcmVzcG9uc2UuZGF0YS5kYXlzX3NlbGVjdGlvbiApIHtcblx0XHRcdFx0XHRcdGNmZy5kYXlzX3NlbGVjdGlvbiA9IHJlc3BvbnNlLmRhdGEuZGF5c19zZWxlY3Rpb247XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGFwcGx5X2Zvcm1fdGhlbWUoKTtcblx0XHRcdFx0XHRhcHBseV9mb3JtX2FwcGVhcmFuY2UoKTtcblx0XHRcdFx0XHRhcHBseV9jYWxlbmRhcl9za2luKCk7XG5cdFx0XHRcdFx0YXBwbHlfdGltZV9za2luKCk7XG5cdFx0XHRcdFx0ZW5zdXJlX2NhbGVuZGFyX29ubHlfZGF5c19zZWxlY3Rpb24oKTtcblx0XHRcdFx0XHRzeW5jX3RpbWVfcGlja2VyX3ByZXZpZXcoKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRzaG93X21lc3NhZ2UoXG5cdFx0XHRcdFx0cmVzcG9uc2UgJiYgcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLm1lc3NhZ2UgPyByZXNwb25zZS5kYXRhLm1lc3NhZ2UgOiAoIGNmZy5pMThuICYmIGNmZy5pMThuLnByZXZpZXdfZmFpbGVkID8gY2ZnLmkxOG4ucHJldmlld19mYWlsZWQgOiAnVW5hYmxlIHRvIHJlZnJlc2ggY2FsZW5kYXIgcHJldmlldy4nICksXG5cdFx0XHRcdFx0J2Vycm9yJyxcblx0XHRcdFx0XHQxMDAwMFxuXHRcdFx0XHQpO1xuXHRcdFx0fSApXG5cdFx0XHQuZmFpbCggZnVuY3Rpb24gKCB4aHIsIHRleHRfc3RhdHVzICkge1xuXHRcdFx0XHRpZiAoICdhYm9ydCcgPT09IHRleHRfc3RhdHVzICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRzaG93X21lc3NhZ2UoIGNmZy5pMThuICYmIGNmZy5pMThuLnByZXZpZXdfZmFpbGVkID8gY2ZnLmkxOG4ucHJldmlld19mYWlsZWQgOiAnVW5hYmxlIHRvIHJlZnJlc2ggY2FsZW5kYXIgcHJldmlldy4nLCAnZXJyb3InLCAxMDAwMCApO1xuXHRcdFx0fSApXG5cdFx0XHQuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHNldF9jYWxlbmRhcl9sb2FkaW5nKCBmYWxzZSApO1xuXHRcdFx0fSApO1xuXHR9XG5cblx0ZnVuY3Rpb24gc2NoZWR1bGVfcHJldmlld19yZWZyZXNoKCkge1xuXHRcdGNsZWFyVGltZW91dCggcHJldmlld190aW1lciApO1xuXHRcdHByZXZpZXdfdGltZXIgPSBzZXRUaW1lb3V0KCByZWZyZXNoX3ByZXZpZXcsIDE4MCApO1xuXHR9XG5cblx0ZnVuY3Rpb24gc2F2ZV9zZXR0aW5ncygpIHtcblx0XHR2YXIgJGJ1dHRvbiA9ICQoICdbZGF0YS13cGJjLXRoZW1lLXNhdmU9XCIxXCJdJyApO1xuXHRcdHZhciBvcmlnaW5hbF90ZXh0ID0gJGJ1dHRvbi5kYXRhKCAnd3BiYy1vcmlnaW5hbC10ZXh0JyApO1xuXHRcdHZhciBkYXRhID0gY29sbGVjdF9wYXlsb2FkKCk7XG5cblx0XHRpZiAoICEgb3JpZ2luYWxfdGV4dCApIHtcblx0XHRcdG9yaWdpbmFsX3RleHQgPSAkYnV0dG9uLmh0bWwoKTtcblx0XHRcdCRidXR0b24uZGF0YSggJ3dwYmMtb3JpZ2luYWwtdGV4dCcsIG9yaWdpbmFsX3RleHQgKTtcblx0XHR9XG5cblx0XHRkYXRhLmFjdGlvbiA9IGNmZy5hY3Rpb247XG5cdFx0ZGF0YS5ub25jZSA9IGNmZy5ub25jZTtcblxuXHRcdCRidXR0b24uYWRkQ2xhc3MoICdkaXNhYmxlZCcgKS5hdHRyKCAnYXJpYS1kaXNhYmxlZCcsICd0cnVlJyApO1xuXHRcdCRidXR0b24uZmluZCggJy5pbi1idXR0b24tdGV4dCcgKS5odG1sKCAnJm5ic3A7Jm5ic3A7JyArIHRyaW1fdGV4dCggY2ZnLmkxOG4gJiYgY2ZnLmkxOG4uc2F2aW5nID8gY2ZnLmkxOG4uc2F2aW5nIDogJ1NhdmluZycgKSArICcuLi4nICk7XG5cblx0XHQkLnBvc3QoIGNmZy5hamF4X3VybCwgZGF0YSApXG5cdFx0XHQuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdFx0aWYgKCByZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzICkge1xuXHRcdFx0XHRcdHNob3dfbWVzc2FnZSggcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLm1lc3NhZ2UgPyByZXNwb25zZS5kYXRhLm1lc3NhZ2UgOiAoIGNmZy5pMThuICYmIGNmZy5pMThuLnNhdmVkID8gY2ZnLmkxOG4uc2F2ZWQgOiAnU2F2ZWQnICksICdzdWNjZXNzJywgMzAwMCApO1xuXHRcdFx0XHRcdGNmZy5zZXR0aW5ncyA9IHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5zZXR0aW5ncyA/IHJlc3BvbnNlLmRhdGEuc2V0dGluZ3MgOiBjZmcuc2V0dGluZ3M7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0c2hvd19tZXNzYWdlKFxuXHRcdFx0XHRcdHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5tZXNzYWdlID8gcmVzcG9uc2UuZGF0YS5tZXNzYWdlIDogKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5zYXZlX2ZhaWxlZCA/IGNmZy5pMThuLnNhdmVfZmFpbGVkIDogJ1VuYWJsZSB0byBzYXZlIGFwcGVhcmFuY2Ugc2V0dGluZ3MuJyApLFxuXHRcdFx0XHRcdCdlcnJvcicsXG5cdFx0XHRcdFx0MTAwMDBcblx0XHRcdFx0KTtcblx0XHRcdH0gKVxuXHRcdFx0LmZhaWwoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0c2hvd19tZXNzYWdlKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5zYXZlX2ZhaWxlZCA/IGNmZy5pMThuLnNhdmVfZmFpbGVkIDogJ1VuYWJsZSB0byBzYXZlIGFwcGVhcmFuY2Ugc2V0dGluZ3MuJywgJ2Vycm9yJywgMTAwMDAgKTtcblx0XHRcdH0gKVxuXHRcdFx0LmFsd2F5cyggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHQkYnV0dG9uLnJlbW92ZUNsYXNzKCAnZGlzYWJsZWQnICkucmVtb3ZlQXR0ciggJ2FyaWEtZGlzYWJsZWQnICkuaHRtbCggb3JpZ2luYWxfdGV4dCApO1xuXHRcdFx0fSApO1xuXHR9XG5cblx0ZnVuY3Rpb24gYmluZF9ldmVudHMoKSB7XG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJy53cGJjX3RoZW1lX3JpZ2h0YmFyX3RhYnMgW3JvbGU9XCJ0YWJcIl0nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHN3aXRjaF9wYW5lbCggJCggdGhpcyApICk7XG5cdFx0fSApO1xuXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJy53cGJjX3RoZW1lX3ByZW1pdW1fZGlzbWlzcyBhJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdH0gKTtcblxuXHRcdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY190aGVtZV9yaWdodGJhcl9wYW5lbHMgLndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwID4gLmdyb3VwX19oZWFkZXInLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHRvZ2dsZV9ncm91cCggJCggdGhpcyApICk7XG5cdFx0fSApO1xuXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJ1tkYXRhLXdwYmMtdGhlbWUtc2F2ZT1cIjFcIl0nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGlmICggISAkKCB0aGlzICkuaGFzQ2xhc3MoICdkaXNhYmxlZCcgKSApIHtcblx0XHRcdFx0c2F2ZV9zZXR0aW5ncygpO1xuXHRcdFx0fVxuXHRcdH0gKTtcblxuXHRcdCQoIGRvY3VtZW50ICkub24oICdzdWJtaXQnLCAnW2RhdGEtd3BiYy10aGVtZS1zZXR0aW5ncy1mb3JtPVwiMVwiXScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gKTtcblxuXHRcdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnW25hbWU9XCJib29raW5nX2Zvcm1fdGhlbWVcIl0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRhcHBseV9mb3JtX3RoZW1lKCk7XG5cdFx0XHRhcHBseV9yZWxhdGVkX3NraW5zX2Zvcl90aGVtZSggJCggdGhpcyApLnZhbCgpIHx8ICcnICk7XG5cdFx0XHRzaG93X2NhbGVuZGFyX29ubHlfdGhlbWVfbm90aWNlKCk7XG5cdFx0fSApO1xuXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICdbbmFtZT1cImJvb2tpbmdfZm9ybV9zdHlsZVwiXScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdHN5bmNfZm9ybV9zdHlsZV9jaG9pY2UoKTtcblx0XHRcdGFwcGx5X2Zvcm1fdGhlbWUoKTtcblx0XHRcdGFwcGx5X2Zvcm1fYXBwZWFyYW5jZSgpO1xuXHRcdFx0YXBwbHlfcmVsYXRlZF9za2luc19mb3JfdGhlbWUoICQoICcjYm9va2luZ19mb3JtX3RoZW1lJyApLnZhbCgpIHx8ICcnICk7XG5cdFx0XHRzaG93X2NhbGVuZGFyX29ubHlfdGhlbWVfbm90aWNlKCk7XG5cdFx0XHRzY2hlZHVsZV9wcmV2aWV3X3JlZnJlc2goKTtcblx0XHR9ICk7XG5cblx0XHQkKCBkb2N1bWVudCApLm9uKCAnaW5wdXQgY2hhbmdlJywgJ1tkYXRhLXdwYmMtdGhlbWUtYXBwZWFyYW5jZS1jb250cm9sXScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdGFwcGx5X2Zvcm1fYXBwZWFyYW5jZSgpO1xuXHRcdFx0c2NoZWR1bGVfcHJldmlld19yZWZyZXNoKCk7XG5cdFx0fSApO1xuXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICdbZGF0YS13cGJjLXRoZW1lLWNhbGVuZGFyLXNraW49XCIxXCJdJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0YXBwbHlfY2FsZW5kYXJfc2tpbigpO1xuXHRcdH0gKTtcblxuXHRcdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnW2RhdGEtd3BiYy10aGVtZS10aW1lLXNraW49XCIxXCJdJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0YXBwbHlfdGltZV9za2luKCk7XG5cdFx0fSApO1xuXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICdbbmFtZT1cImJvb2tpbmdfdGltZXNsb3RfcGlja2VyXCJdJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0c3luY190aW1lX3BpY2tlcl9wcmV2aWV3KCk7XG5cdFx0XHRzY2hlZHVsZV9wcmV2aWV3X3JlZnJlc2goKTtcblx0XHR9ICk7XG5cblx0XHQkKCBkb2N1bWVudCApLm9uKCAnY2hhbmdlJywgJ1tkYXRhLXdwYmMtdGhlbWUtcHJldmlldy1ub3RpY2VdJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0bWF5YmVfc2hvd19wcmV2aWV3X25vdGljZSggJCggdGhpcyApICk7XG5cdFx0fSApO1xuXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICcjd3BiY190aGVtZV9yZXNvdXJjZV9pZCwgI3dwYmNfdGhlbWVfbW9udGhzX2NvdW50LCAjd3BiY190aGVtZV9jdXN0b21fZm9ybScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdHNjaGVkdWxlX3ByZXZpZXdfcmVmcmVzaCgpO1xuXHRcdH0gKTtcblxuXHRcdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnI3dwYmNfdGhlbWVfcHJldmlld19tb2RlJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0cmVmcmVzaF9wcmV2aWV3X21vZGVfY29udHJvbHMoKTtcblx0XHRcdHNjaGVkdWxlX3ByZXZpZXdfcmVmcmVzaCgpO1xuXHRcdH0gKTtcblx0fVxuXG5cdCQoIGZ1bmN0aW9uICgpIHtcblx0XHRpZiAoICEgJCggJ1tkYXRhLXdwYmMtdGhlbWUtcGFnZT1cIjFcIl0nICkubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGJpbmRfZXZlbnRzKCk7XG5cdFx0cmVmcmVzaF9wcmV2aWV3X21vZGVfY29udHJvbHMoKTtcblx0XHRhcHBseV9mb3JtX3RoZW1lKCk7XG5cdFx0YXBwbHlfZm9ybV9hcHBlYXJhbmNlKCk7XG5cdFx0ZW5zdXJlX2NhbGVuZGFyX29ubHlfZGF5c19zZWxlY3Rpb24oKTtcblx0XHRzeW5jX3RpbWVfcGlja2VyX3ByZXZpZXcoKTtcblx0fSApO1xufSggalF1ZXJ5LCB3aW5kb3cgKSApO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNFLFdBQVdBLENBQUMsRUFBRUMsQ0FBQyxFQUFHO0VBQ25CLFlBQVk7O0VBRVosSUFBSUMsR0FBRyxHQUFHRCxDQUFDLENBQUNFLHlCQUF5QixJQUFJLENBQUMsQ0FBQztFQUMzQyxJQUFJQyxZQUFZLEdBQUcsSUFBSTtFQUN2QixJQUFJQyxhQUFhLEdBQUcsQ0FBQztFQUNyQixJQUFJQyxvQkFBb0IsR0FBRyxDQUFDO0VBQzVCLElBQUlDLDRCQUE0QixHQUFHLENBQUM7RUFFcEMsU0FBU0MsU0FBU0EsQ0FBRUMsS0FBSyxFQUFHO0lBQzNCLE9BQU9DLE1BQU0sQ0FBRUQsS0FBSyxJQUFJLEVBQUcsQ0FBQyxDQUFDRSxJQUFJLENBQUMsQ0FBQztFQUNwQztFQUVBLFNBQVNDLGNBQWNBLENBQUVDLElBQUksRUFBRztJQUMvQkEsSUFBSSxHQUFHSCxNQUFNLENBQUVHLElBQUksSUFBSSxFQUFHLENBQUM7SUFDM0IsSUFBSyxlQUFlLENBQUNDLElBQUksQ0FBRUQsSUFBSyxDQUFDLElBQUksT0FBTyxDQUFDQyxJQUFJLENBQUVELElBQUssQ0FBQyxFQUFHO01BQzNELE9BQU9BLElBQUk7SUFDWjtJQUNBLE9BQU9ILE1BQU0sQ0FBRVIsR0FBRyxDQUFDYSxVQUFVLElBQUksRUFBRyxDQUFDLENBQUNDLE9BQU8sQ0FBRSxLQUFLLEVBQUUsRUFBRyxDQUFDLEdBQUdILElBQUk7RUFDbEU7RUFFQSxTQUFTSSxZQUFZQSxDQUFFQyxPQUFPLEVBQUVDLElBQUksRUFBRUMsS0FBSyxFQUFHO0lBQzdDLElBQUssT0FBT25CLENBQUMsQ0FBQ29CLHVCQUF1QixLQUFLLFVBQVUsRUFBRztNQUN0RHBCLENBQUMsQ0FBQ29CLHVCQUF1QixDQUFFSCxPQUFP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RSxDQUFDO0lBRUgxUCxDQUFDLENBQUVpUSxRQUFTLENBQUMsQ0FBQ0MsRUFBRSxDQUFFLFFBQVEsRUFBRSxxQ0FBcUMsRUFBRSxZQUFZO01BQzlFM0YsbUJBQW1CLENBQUMsQ0FBQztJQUN0QixDQUFFLENBQUM7SUFFSHZLLENBQUMsQ0FBRWlRLFFBQVMsQ0FBQyxDQUFDQyxFQUFFLENBQUUsUUFBUSxFQUFFLGlDQUFpQyxFQUFFLFlBQVk7TUFDMUV2RixlQUFlLENBQUMsQ0FBQztJQUNsQixDQUFFLENBQUM7SUFFSDNLLENBQUMsQ0FBRWlRLFFBQVMsQ0FBQyxDQUFDQyxFQUFFLENBQUUsUUFBUSxFQUFFLGtDQUFrQyxFQUFFLFlBQVk7TUFDM0V2Qyx3QkFBd0IsQ0FBQyxDQUFDO01BQzFCK0Isd0JBQXdCLENBQUMsQ0FBQztJQUMzQixDQUFFLENBQUM7SUFFSDFQLENBQUMsQ0FBRWlRLFFBQVMsQ0FBQyxDQUFDQyxFQUFFLENBQUUsUUFBUSxFQUFFLGtDQUFrQyxFQUFFLFlBQVk7TUFDM0UzQyx5QkFBeUIsQ0FBRXZOLENBQUMsQ0FBRSxJQUFLLENBQUUsQ0FBQztJQUN2QyxDQUFFLENBQUM7SUFFSEEsQ0FBQyxDQUFFaVEsUUFBUyxDQUFDLENBQUNDLEVBQUUsQ0FBRSxRQUFRLEVBQUUsNEVBQTRFLEVBQUUsWUFBWTtNQUNySFIsd0JBQXdCLENBQUMsQ0FBQztJQUMzQixDQUFFLENBQUM7SUFFSDFQLENBQUMsQ0FBRWlRLFFBQVMsQ0FBQyxDQUFDQyxFQUFFLENBQUUsUUFBUSxFQUFFLDBCQUEwQixFQUFFLFlBQVk7TUFDbkVoQyw2QkFBNkIsQ0FBQyxDQUFDO01BQy9Cd0Isd0JBQXdCLENBQUMsQ0FBQztJQUMzQixDQUFFLENBQUM7RUFDSjtFQUVBMVAsQ0FBQyxDQUFFLFlBQVk7SUFDZCxJQUFLLENBQUVBLENBQUMsQ0FBRSw0QkFBNkIsQ0FBQyxDQUFDeUIsTUFBTSxFQUFHO01BQ2pEO0lBQ0Q7SUFFQXVPLFdBQVcsQ0FBQyxDQUFDO0lBQ2I5Qiw2QkFBNkIsQ0FBQyxDQUFDO0lBQy9COUksZ0JBQWdCLENBQUMsQ0FBQztJQUNsQmtGLHFCQUFxQixDQUFDLENBQUM7SUFDdkJtQyxtQ0FBbUMsQ0FBQyxDQUFDO0lBQ3JDa0Isd0JBQXdCLENBQUMsQ0FBQztFQUMzQixDQUFFLENBQUM7QUFDSixDQUFDLEVBQUUyQyxNQUFNLEVBQUVDLE1BQU8sQ0FBQyIsImlnbm9yZUxpc3QiOltdfQ==
