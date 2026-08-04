"use strict";

/**
 * Appearance / Theme settings page UI.
 */
(function ($, w) {
  'use strict';

  var cfg = w.wpbc_settings_themes_page || {};
  var localized_default_form_accent_color = String(cfg.form_accent_defaults && cfg.form_accent_defaults.booking_form_accent_color || '').trim();

  /** @type {string} Default accent supplied by the PHP configuration constant. */
  var default_form_accent_color = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(localized_default_form_accent_color) ? localized_default_form_accent_color : '';
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
    data.booking_form_accent_enabled = $form.find('[name="booking_form_accent_enabled"]').prop('checked') ? 'On' : 'Off';
    data.resource_id = $('#wpbc_theme_resource_id').val() || '';
    data.months_count = $('#wpbc_theme_months_count').val() || '';
    data.preview_mode = $('#wpbc_theme_preview_mode').val() || 'form';
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
    return /^\d+(?:\.\d+)?(?:px|rem|em|%)$/i.test(v) ? v : fallback;
  }
  function sanitize_theme_spacing(value, fallback) {
    var v = String(value || '').trim().replace(/\s+/g, ' ');
    var parts = v ? v.split(' ') : [];
    var i;
    if (parts.length < 1 || parts.length > 4) {
      return fallback;
    }
    for (i = 0; i < parts.length; i++) {
      if (!/^\d+(?:\.\d+)?(?:px|rem|em|%)$/i.test(parts[i])) {
        return fallback;
      }
    }
    return parts.join(' ');
  }
  function mix_theme_colors(color, target, amount) {
    var source = sanitize_theme_color(color, default_form_accent_color).replace('#', '');
    var destination = sanitize_theme_color(target, '#000000').replace('#', '');
    var channels = [];
    var index;
    if (3 === source.length) {
      source = source.replace(/./g, function (value) {
        return value + value;
      });
    }
    for (index = 0; index < 3; index++) {
      channels.push(Math.round(parseInt(source.substr(index * 2, 2), 16) + (parseInt(destination.substr(index * 2, 2), 16) - parseInt(source.substr(index * 2, 2), 16)) * amount));
    }
    return '#' + channels.map(function (channel) {
      return ('0' + channel.toString(16)).slice(-2);
    }).join('');
  }
  function get_theme_color_luminance(color) {
    var hex = sanitize_theme_color(color, default_form_accent_color).replace('#', '');
    var channels;
    if (3 === hex.length) {
      hex = hex.replace(/./g, function (value) {
        return value + value;
      });
    }
    channels = [0, 1, 2].map(function (index) {
      var channel = parseInt(hex.substr(index * 2, 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  /**
   * Apply the accent to preview variables while respecting Custom button controls.
   *
   * @param {Object}  css_vars                      Resolved preview variables.
   * @param {boolean} preserve_custom_button_colors Whether Custom button variables remain authoritative.
   * @return {Object} Preview variables with the optional accent overlay.
   */
  function apply_form_accent_css_vars(css_vars, preserve_custom_button_colors) {
    var enabled = get_form().find('[name="booking_form_accent_enabled"]').prop('checked');
    var accent_raw = String(get_form().find('[name="booking_form_accent_color"]').val() || '').trim();
    var accent = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent_raw) ? accent_raw : default_form_accent_color;
    var luminance;
    var hover;
    var contrast;
    var hover_contrast;
    if (!enabled) {
      return css_vars;
    }
    if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent)) {
      return css_vars;
    }
    luminance = get_theme_color_luminance(accent);
    contrast = luminance > 0.18 ? '#000000' : '#ffffff';
    hover = mix_theme_colors(accent, '#ffffff' === contrast ? '#000000' : '#ffffff', 0.10);
    hover_contrast = contrast;
    var accent_overlay = {
      '--wpbc_form-accent-color': accent,
      '--wpbc_form-accent-hover-color': hover,
      '--wpbc_form-accent-contrast-color': contrast,
      '--wpbc_form-field-focus-border-color': accent,
      '--wpbc_form-field-focus-shadow-color': accent,
      '--wpbc_form-choice-checked-border-color': accent,
      '--wpbc_form-choice-checked-color': accent,
      '--wpbc_form-choice-focus-color': accent,
      '--wpbc_form-button-background-color': accent,
      '--wpbc_form-button-background-color-alt': accent,
      '--wpbc_form-button-border-color': accent,
      '--wpbc_form-button-text-color': contrast,
      '--wpbc_form-button-text-color-alt': contrast,
      '--wpbc_form-button-hover-background-color': hover,
      '--wpbc_form-button-hover-border-color': hover,
      '--wpbc_form-button-hover-text-color': hover_contrast,
      '--wpbc_form-button-light-hover-border-color': accent,
      '--wpbc_form-button-primary-hover-border-color': hover,
      '--wpbc_form-page-break-color': accent
    };
    if (preserve_custom_button_colors) {
      ['--wpbc_form-button-background-color', '--wpbc_form-button-background-color-alt', '--wpbc_form-button-border-color', '--wpbc_form-button-text-color', '--wpbc_form-button-text-color-alt', '--wpbc_form-button-hover-background-color', '--wpbc_form-button-hover-border-color', '--wpbc_form-button-hover-text-color', '--wpbc_form-button-light-hover-border-color', '--wpbc_form-button-primary-hover-border-color'].forEach(function (css_var_name) {
        delete accent_overlay[css_var_name];
      });
    }
    return $.extend({}, css_vars, accent_overlay);
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
      booking_form_custom_secondary_button_hover_border_color: '#4d91cd',
      booking_form_custom_button_border_width: '1px',
      booking_form_custom_button_border_radius: '3px'
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
      '--wpbc_form-button-border-radius': sanitize_theme_length(values.booking_form_custom_button_border_radius, defaults.booking_form_custom_button_border_radius),
      '--wpbc_form-button-border-style': 'solid',
      '--wpbc_form-button-border-size': sanitize_theme_length(values.booking_form_custom_button_border_width, defaults.booking_form_custom_button_border_width),
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
      '--wpbc_form-button-light-border-size': sanitize_theme_length(values.booking_form_custom_button_border_width, defaults.booking_form_custom_button_border_width),
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
      return apply_form_accent_css_vars(get_custom_form_style_css_vars(), true);
    }
    return apply_form_accent_css_vars(preset.css_vars && 'object' === typeof preset.css_vars ? preset.css_vars : {});
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
    var preview_mode = $preview.attr('data-preview-mode') || $('#wpbc_theme_preview_mode').val() || 'form';
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
    var time_skin = '/css/time_picker_skins/form_style.css';
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
    var preview_mode = $('#wpbc_theme_preview_mode').val() || 'form';
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
    var preview_mode = $('#wpbc_theme_preview_mode').val() || 'form';
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
    var preview_mode = $('#wpbc_theme_preview_mode').val() || 'form';
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
      // Coloris emits continuous input events. Accent and appearance values are
      // CSS-only, so update the existing preview without rebuilding it by AJAX.
      apply_form_appearance();
    });
    $(document).on('change', '[data-wpbc-theme-accent-toggle="1"]', function () {
      $('[data-wpbc-theme-accent-dependent="1"]').toggle($(this).prop('checked'));
      apply_form_appearance();
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
    if (w.Coloris) {
      w.Coloris({
        el: '.wpbc_theme_coloris',
        alpha: false,
        format: 'hex',
        themeMode: 'auto'
      });
    }
    refresh_preview_mode_controls();
    apply_form_theme();
    apply_form_appearance();
    ensure_calendar_only_days_selection();
    sync_time_picker_preview();
  });
})(jQuery, window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR0aW5ncy10aGVtZXMvX291dC9zZXR0aW5nc190aGVtZXNfcGFnZS5qcyIsIm5hbWVzIjpbIiQiLCJ3IiwiY2ZnIiwid3BiY19zZXR0aW5nc190aGVtZXNfcGFnZSIsImxvY2FsaXplZF9kZWZhdWx0X2Zvcm1fYWNjZW50X2NvbG9yIiwiU3RyaW5nIiwiZm9ybV9hY2NlbnRfZGVmYXVsdHMiLCJib29raW5nX2Zvcm1fYWNjZW50X2NvbG9yIiwidHJpbSIsImRlZmF1bHRfZm9ybV9hY2NlbnRfY29sb3IiLCJ0ZXN0IiwicHJldmlld19hamF4IiwicHJldmlld190aW1lciIsInByZXZpZXdfbm90aWNlX3RpbWVyIiwicHJldmlld19ub3RpY2VfbWVzc2FnZV90aW1lciIsInRyaW1fdGV4dCIsInZhbHVlIiwibWFrZV9hc3NldF91cmwiLCJwYXRoIiwicGx1Z2luX3VybCIsInJlcGxhY2UiLCJzaG93X21lc3NhZ2UiLCJtZXNzYWdlIiwidHlwZSIsImRlbGF5Iiwid3BiY19hZG1pbl9zaG93X21lc3NhZ2UiLCJwdWxzZV9lbGVtZW50IiwiJGVsZW1lbnQiLCJkdXJhdGlvbiIsImxlbmd0aCIsInJlbW92ZUNsYXNzIiwiZWFjaCIsIm9mZnNldFdpZHRoIiwiYWRkQ2xhc3MiLCJzZXRUaW1lb3V0IiwicHVsc2VfbGF0ZXN0X3dhcm5pbmdfbm90aWNlIiwiY2xlYXJUaW1lb3V0IiwibGFzdCIsInNob3dfaGlnaGxpZ2h0ZWRfbm90aWNlIiwiJGNvbnRyb2wiLCJzd2l0Y2hfcGFuZWwiLCIkdGFiIiwicGFuZWxfaWQiLCJhdHRyIiwiJHRhYnMiLCJjbG9zZXN0IiwiZmluZCIsIiRwYW5lbHMiLCJyZW1vdmVBdHRyIiwidG9nZ2xlX2dyb3VwIiwiJGJ1dHRvbiIsIiRncm91cCIsIiRmaWVsZHMiLCJpc19vcGVuIiwiaGFzQ2xhc3MiLCJ0b2dnbGVDbGFzcyIsInByb3AiLCJnZXRfZm9ybSIsImZpcnN0IiwiY29sbGVjdF9wYXlsb2FkIiwiJGZvcm0iLCJkYXRhIiwic3luY19mb3JtX3N0eWxlX2Nob2ljZSIsInNlcmlhbGl6ZUFycmF5IiwiaW5kZXgiLCJpdGVtIiwibmFtZSIsImluZGV4T2YiLCJib29raW5nX3RpbWVzbG90X3BpY2tlciIsImJvb2tpbmdfZm9ybV9hY2NlbnRfZW5hYmxlZCIsInJlc291cmNlX2lkIiwidmFsIiwibW9udGhzX2NvdW50IiwicHJldmlld19tb2RlIiwiY3VzdG9tX2Jvb2tpbmdfZm9ybSIsIm1hcF9mb3JtX3N0eWxlX2Nob2ljZSIsImNob2ljZSIsImN1cnJlbnRfdGhlbWUiLCJwYXJ0cyIsInByZXNldCIsInRoZW1lIiwic3BsaXQiLCJnZXRfZm9ybV9zdHlsZV9jaG9pY2VfZnJvbV92YWx1ZXMiLCJwcmVmaXgiLCIkY2hlY2tlZCIsIm1hcHBlZCIsInN5bmNfZm9ybV9zdHlsZV9jaG9pY2Vfc2VsZWN0aW9uIiwiJGNob2ljZXMiLCJmaWx0ZXIiLCJhcHBseV9mb3JtX3RoZW1lIiwiJHByZXZpZXciLCIkdGhlbWVfdGFyZ2V0cyIsImFkZCIsIiR0YXJnZXQiLCJjbGFzc2VzIiwiY2xhc3NOYW1lIiwiY2xhc3NfbmFtZSIsImdldF9mb3JtX2FwcGVhcmFuY2VfcHJlc2V0cyIsImJvcmRlcmVkIiwiYmFja2dyb3VuZCIsImJvcmRlckNvbG9yIiwiYm9yZGVyV2lkdGgiLCJyYWRpdXMiLCJwYWRkaW5nIiwic2hhZG93Iiwibm9uZSIsInNvZnQiLCJpc19kYXJrX2Zvcm1fdGhlbWUiLCJnZXRfZm9ybV9hcHBlYXJhbmNlX3ByZXNldF9mb3JfdGhlbWUiLCJwcmVzZXRzIiwic2FuaXRpemVfdGhlbWVfY29sb3IiLCJmYWxsYmFjayIsInYiLCJzYW5pdGl6ZV90aGVtZV9sZW5ndGgiLCJzYW5pdGl6ZV90aGVtZV9zcGFjaW5nIiwiaSIsImpvaW4iLCJtaXhfdGhlbWVfY29sb3JzIiwiY29sb3IiLCJ0YXJnZXQiLCJhbW91bnQiLCJzb3VyY2UiLCJkZXN0aW5hdGlvbiIsImNoYW5uZWxzIiwicHVzaCIsIk1hdGgiLCJyb3VuZCIsInBhcnNlSW50Iiwic3Vic3RyIiwibWFwIiwiY2hhbm5lbCIsInRvU3RyaW5nIiwic2xpY2UiLCJnZXRfdGhlbWVfY29sb3JfbHVtaW5hbmNlIiwiaGV4IiwicG93IiwiYXBwbHlfZm9ybV9hY2NlbnRfY3NzX3ZhcnMiLCJjc3NfdmFycyIsInByZXNlcnZlX2N1c3RvbV9idXR0b25fY29sb3JzIiwiZW5hYmxlZCIsImFjY2VudF9yYXciLCJhY2NlbnQiLCJsdW1pbmFuY2UiLCJob3ZlciIsImNvbnRyYXN0IiwiaG92ZXJfY29udHJhc3QiLCJhY2NlbnRfb3ZlcmxheSIsImZvckVhY2giLCJjc3NfdmFyX25hbWUiLCJleHRlbmQiLCJnZXRfZm9ybV9zdHlsZV9wcmVzZXRzIiwiZm9ybV9zdHlsZV9wcmVzZXRzIiwiZ2V0X2N1cnJlbnRfZm9ybV9zdHlsZSIsImdldF9jdXN0b21fZm9ybV9zdHlsZV9kZWZhdWx0cyIsImJvb2tpbmdfZm9ybV9jdXN0b21fYmFja2dyb3VuZF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfd2lkdGgiLCJib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl9yYWRpdXMiLCJib29raW5nX2Zvcm1fY3VzdG9tX3BhZGRpbmdfdmVydGljYWwiLCJib29raW5nX2Zvcm1fY3VzdG9tX3BhZGRpbmdfaG9yaXpvbnRhbCIsImJvb2tpbmdfZm9ybV9jdXN0b21fdGV4dF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYmFja2dyb3VuZF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfdGV4dF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYm9yZGVyX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYmFja2dyb3VuZF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX3RleHRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ib3JkZXJfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl9iYWNrZ3JvdW5kX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfdGV4dF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JvcmRlcl9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9iYWNrZ3JvdW5kX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX3RleHRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fYm9yZGVyX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX2JhY2tncm91bmRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfdGV4dF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl9ib3JkZXJfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ib3JkZXJfd2lkdGgiLCJib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ib3JkZXJfcmFkaXVzIiwiY3VzdG9tX2Zvcm1fc3R5bGVfZGVmYXVsdHMiLCJnZXRfY3VzdG9tX2Zvcm1fc3R5bGVfY3NzX3ZhcnMiLCJkZWZhdWx0cyIsInZhbHVlcyIsInNldHRpbmdzIiwiZ2V0X2Zvcm1fc3R5bGVfY3NzX3Zhcl9uYW1lcyIsImtleXMiLCJBcnJheSIsImlzQXJyYXkiLCJmb3JtX3N0eWxlX2Nzc192YXJfbmFtZXMiLCJwcmVzZXRfa2V5IiwidmFyX25hbWUiLCJyZXNvbHZlX2Zvcm1fc3R5bGVfY3NzX3ZhcnMiLCJzdHlsZSIsImxpZ2h0X2JvcmRlcmVkIiwiY3VzdG9tIiwiYXBwbHlfZm9ybV9zdHlsZV90b19wcmV2aWV3IiwiY3NzX3Zhcl9uYW1lcyIsImlzX2N1c3RvbSIsIiR0YXJnZXRzIiwidG9nZ2xlIiwic3R5bGVfb2JqIiwicmVtb3ZlUHJvcGVydHkiLCJzZXRQcm9wZXJ0eSIsInJlc29sdmVfZm9ybV9hcHBlYXJhbmNlIiwiYXBwbHlfZm9ybV9hcHBlYXJhbmNlIiwiYXBwbHlfY2FsZW5kYXJfc2tpbiIsIiRzZWxlY3QiLCJza2luX3VybCIsIndwYmNfX2NhbGVuZGFyX19jaGFuZ2Vfc2tpbiIsImFwcGx5X3RpbWVfc2tpbiIsIndwYmNfX2Nzc19fY2hhbmdlX3NraW4iLCJzZWxlY3RfaWZfb3B0aW9uX2V4aXN0cyIsIiRvcHRpb24iLCJ0cmlnZ2VyIiwicGFyc2VfbnVtYmVyX2xpc3QiLCJwYXJzZWQiLCJpc05hTiIsInNldF9jYWxlbmRhcl9wYXJhbSIsImtleSIsIl93cGJjIiwiY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSIsImFwcGx5X2RheXNfc2VsZWN0aW9uX3RvX2NhbGVuZGFyIiwiZGF5c19zZWxlY3Rpb24iLCJzaG91bGRfcmVpbml0IiwiZHMiLCJmaXhlZF93ZWVrX2RheXMiLCJkeW5hbWljX3NwZWNpZmljIiwiZHluYW1pY193ZWVrX2RheXMiLCJmaXhlZF9fd2Vla19kYXlzX19zdGFydCIsImR5bmFtaWNfX2RheXNfc3BlY2lmaWMiLCJkeW5hbWljX193ZWVrX2RheXNfX3N0YXJ0IiwiZGF5c19zZWxlY3RfbW9kZSIsImZpeGVkX19kYXlzX251bSIsImR5bmFtaWNfX2RheXNfbWluIiwiZHluYW1pY19fZGF5c19tYXgiLCJ3cGJjX19jb25kaXRpb25zX19TQVZFX0lOSVRJQUxfX2RheXNfc2VsZWN0aW9uX3BhcmFtc19fYm0iLCJ3cGJjX2NhbF9fcmVfaW5pdCIsImVuc3VyZV9jYWxlbmRhcl9vbmx5X2RheXNfc2VsZWN0aW9uIiwiZXhwZWN0ZWQiLCJleHBlY3RlZF9tb2RlIiwiY3VycmVudF9tb2RlIiwiJGNhbGVuZGFyIiwiY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSIsImFwcGx5X3JlbGF0ZWRfc2tpbnNfZm9yX3RoZW1lIiwiY2FsZW5kYXJfc2tpbiIsInRpbWVfc2tpbiIsInB1bHNlX3ByZXZpZXdfbW9kZV9jb250cm9sIiwiZ2V0X3ByZXZpZXdfbm90aWNlX21lc3NhZ2UiLCJub3RpY2VfdHlwZSIsImkxOG4iLCJmb3JtX3ByZXZpZXdfb3B0aW9uX25vdGljZSIsIm1heWJlX3Nob3dfcHJldmlld19ub3RpY2UiLCIkc291cmNlIiwic2hvd19jYWxlbmRhcl9vbmx5X3RoZW1lX25vdGljZSIsImNhbGVuZGFyX29ubHlfdGhlbWVfbm90aWNlIiwic3luY190aW1lX3BpY2tlcl9wcmV2aWV3IiwiaXNfZW5hYmxlZCIsInRpbWVfc2VsZWN0b3JzIiwic2V0X290aGVyX3BhcmFtIiwid3BiY19ob29rX19pbml0X3RpbWVzZWxlY3RvciIsInJlbW92ZSIsInNob3ciLCJyZWZyZXNoX3ByZXZpZXdfbW9kZV9jb250cm9scyIsInNldF9jYWxlbmRhcl9sb2FkaW5nIiwiaXNfbG9hZGluZyIsIiRwYW5lbCIsImFwcGVuZCIsImxvYWRpbmciLCJyZWZyZXNoX3ByZXZpZXciLCJyZWFkeVN0YXRlIiwiYWJvcnQiLCJhY3Rpb24iLCJwcmV2aWV3X2FjdGlvbiIsIm5vbmNlIiwicG9zdCIsImFqYXhfdXJsIiwiZG9uZSIsInJlc3BvbnNlIiwic3VjY2VzcyIsImh0bWwiLCJyZXBsYWNlV2l0aCIsInByZXZpZXdfZmFpbGVkIiwiZmFpbCIsInhociIsInRleHRfc3RhdHVzIiwiYWx3YXlzIiwic2NoZWR1bGVfcHJldmlld19yZWZyZXNoIiwic2F2ZV9zZXR0aW5ncyIsIm9yaWdpbmFsX3RleHQiLCJzYXZpbmciLCJzYXZlZCIsInNhdmVfZmFpbGVkIiwiYmluZF9ldmVudHMiLCJkb2N1bWVudCIsIm9uIiwiZXZlbnQiLCJwcmV2ZW50RGVmYXVsdCIsInN0b3BQcm9wYWdhdGlvbiIsIkNvbG9yaXMiLCJlbCIsImFscGhhIiwiZm9ybWF0IiwidGhlbWVNb2RlIiwialF1ZXJ5Iiwid2luZG93Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1zZXR0aW5ncy10aGVtZXMvX3NyYy9zZXR0aW5nc190aGVtZXNfcGFnZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEFwcGVhcmFuY2UgLyBUaGVtZSBzZXR0aW5ncyBwYWdlIFVJLlxuICovXG4oIGZ1bmN0aW9uICggJCwgdyApIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdHZhciBjZmcgPSB3LndwYmNfc2V0dGluZ3NfdGhlbWVzX3BhZ2UgfHwge307XG5cdHZhciBsb2NhbGl6ZWRfZGVmYXVsdF9mb3JtX2FjY2VudF9jb2xvciA9IFN0cmluZyggY2ZnLmZvcm1fYWNjZW50X2RlZmF1bHRzICYmIGNmZy5mb3JtX2FjY2VudF9kZWZhdWx0cy5ib29raW5nX2Zvcm1fYWNjZW50X2NvbG9yIHx8ICcnICkudHJpbSgpO1xuXG5cdC8qKiBAdHlwZSB7c3RyaW5nfSBEZWZhdWx0IGFjY2VudCBzdXBwbGllZCBieSB0aGUgUEhQIGNvbmZpZ3VyYXRpb24gY29uc3RhbnQuICovXG5cdHZhciBkZWZhdWx0X2Zvcm1fYWNjZW50X2NvbG9yID0gL14jKD86WzAtOWEtZl17M318WzAtOWEtZl17Nn0pJC9pLnRlc3QoIGxvY2FsaXplZF9kZWZhdWx0X2Zvcm1fYWNjZW50X2NvbG9yIClcblx0XHQ/IGxvY2FsaXplZF9kZWZhdWx0X2Zvcm1fYWNjZW50X2NvbG9yXG5cdFx0OiAnJztcblx0dmFyIHByZXZpZXdfYWpheCA9IG51bGw7XG5cdHZhciBwcmV2aWV3X3RpbWVyID0gMDtcblx0dmFyIHByZXZpZXdfbm90aWNlX3RpbWVyID0gMDtcblx0dmFyIHByZXZpZXdfbm90aWNlX21lc3NhZ2VfdGltZXIgPSAwO1xuXG5cdGZ1bmN0aW9uIHRyaW1fdGV4dCggdmFsdWUgKSB7XG5cdFx0cmV0dXJuIFN0cmluZyggdmFsdWUgfHwgJycgKS50cmltKCk7XG5cdH1cblxuXHRmdW5jdGlvbiBtYWtlX2Fzc2V0X3VybCggcGF0aCApIHtcblx0XHRwYXRoID0gU3RyaW5nKCBwYXRoIHx8ICcnICk7XG5cdFx0aWYgKCAvXmh0dHBzPzpcXC9cXC8vaS50ZXN0KCBwYXRoICkgfHwgL15cXC9cXC8vLnRlc3QoIHBhdGggKSApIHtcblx0XHRcdHJldHVybiBwYXRoO1xuXHRcdH1cblx0XHRyZXR1cm4gU3RyaW5nKCBjZmcucGx1Z2luX3VybCB8fCAnJyApLnJlcGxhY2UoIC9cXC8kLywgJycgKSArIHBhdGg7XG5cdH1cblxuXHRmdW5jdGlvbiBzaG93X21lc3NhZ2UoIG1lc3NhZ2UsIHR5cGUsIGRlbGF5ICkge1xuXHRcdGlmICggdHlwZW9mIHcud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHR3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCBtZXNzYWdlLCB0eXBlIHx8ICdpbmZvJywgZGVsYXkgfHwgNDAwMCwgZmFsc2UgKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBwdWxzZV9lbGVtZW50KCAkZWxlbWVudCwgZHVyYXRpb24gKSB7XG5cdFx0aWYgKCAhICRlbGVtZW50IHx8ICEgJGVsZW1lbnQubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdCRlbGVtZW50XG5cdFx0XHQucmVtb3ZlQ2xhc3MoICd3cGJjX3RoZW1lX2F0dGVudGlvbl9wdWxzZScgKVxuXHRcdFx0LmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0dm9pZCB0aGlzLm9mZnNldFdpZHRoO1xuXHRcdFx0fSApXG5cdFx0XHQuYWRkQ2xhc3MoICd3cGJjX3RoZW1lX2F0dGVudGlvbl9wdWxzZScgKTtcblxuXHRcdHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdCRlbGVtZW50LnJlbW92ZUNsYXNzKCAnd3BiY190aGVtZV9hdHRlbnRpb25fcHVsc2UnICk7XG5cdFx0fSwgZHVyYXRpb24gfHwgMjEwMCApO1xuXHR9XG5cblx0ZnVuY3Rpb24gcHVsc2VfbGF0ZXN0X3dhcm5pbmdfbm90aWNlKCkge1xuXHRcdGNsZWFyVGltZW91dCggcHJldmlld19ub3RpY2VfbWVzc2FnZV90aW1lciApO1xuXHRcdHByZXZpZXdfbm90aWNlX21lc3NhZ2VfdGltZXIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRwdWxzZV9lbGVtZW50KCAkKCAnI2FqYXhfd29ya2luZyAud3BiY19pbm5lcl9tZXNzYWdlLm5vdGljZS13YXJuaW5nJyApLmxhc3QoKSApO1xuXHRcdH0sIDUwICk7XG5cdH1cblxuXHRmdW5jdGlvbiBzaG93X2hpZ2hsaWdodGVkX25vdGljZSggbWVzc2FnZSwgdHlwZSwgZGVsYXksICRjb250cm9sICkge1xuXHRcdGlmICggJGNvbnRyb2wgJiYgJGNvbnRyb2wubGVuZ3RoICkge1xuXHRcdFx0cHVsc2VfZWxlbWVudCggJGNvbnRyb2wgKTtcblx0XHR9XG5cblx0XHRzaG93X21lc3NhZ2UoIG1lc3NhZ2UsIHR5cGUgfHwgJ3dhcm5pbmcnLCBkZWxheSB8fCA5MDAwICk7XG5cdFx0cHVsc2VfbGF0ZXN0X3dhcm5pbmdfbm90aWNlKCk7XG5cdH1cblxuXHRmdW5jdGlvbiBzd2l0Y2hfcGFuZWwoICR0YWIgKSB7XG5cdFx0dmFyIHBhbmVsX2lkID0gJHRhYi5hdHRyKCAnYXJpYS1jb250cm9scycgKTtcblx0XHR2YXIgJHRhYnMgPSAkdGFiLmNsb3Nlc3QoICcud3BiY190aGVtZV9yaWdodGJhcl90YWJzJyApLmZpbmQoICdbcm9sZT1cInRhYlwiXScgKTtcblx0XHR2YXIgJHBhbmVscyA9ICQoICcud3BiY190aGVtZV9yaWdodGJhcl9wYW5lbHMgW3JvbGU9XCJ0YWJwYW5lbFwiXScgKTtcblxuXHRcdCR0YWJzLmF0dHIoICdhcmlhLXNlbGVjdGVkJywgJ2ZhbHNlJyApO1xuXHRcdCR0YWIuYXR0ciggJ2FyaWEtc2VsZWN0ZWQnLCAndHJ1ZScgKTtcblxuXHRcdCRwYW5lbHMuYXR0ciggJ2hpZGRlbicsICdoaWRkZW4nICkuYXR0ciggJ2FyaWEtaGlkZGVuJywgJ3RydWUnICk7XG5cdFx0JCggJyMnICsgcGFuZWxfaWQgKS5yZW1vdmVBdHRyKCAnaGlkZGVuJyApLmF0dHIoICdhcmlhLWhpZGRlbicsICdmYWxzZScgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHRvZ2dsZV9ncm91cCggJGJ1dHRvbiApIHtcblx0XHR2YXIgJGdyb3VwID0gJGJ1dHRvbi5jbG9zZXN0KCAnLndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwJyApO1xuXHRcdHZhciAkZmllbGRzID0gJGdyb3VwLmZpbmQoICc+IC5ncm91cF9fZmllbGRzJyApO1xuXHRcdHZhciBpc19vcGVuID0gJGdyb3VwLmhhc0NsYXNzKCAnaXMtb3BlbicgKTtcblxuXHRcdCRncm91cC50b2dnbGVDbGFzcyggJ2lzLW9wZW4nLCAhIGlzX29wZW4gKTtcblx0XHQkYnV0dG9uLmF0dHIoICdhcmlhLWV4cGFuZGVkJywgaXNfb3BlbiA/ICdmYWxzZScgOiAndHJ1ZScgKTtcblx0XHQkZmllbGRzLnByb3AoICdoaWRkZW4nLCBpc19vcGVuICkuYXR0ciggJ2FyaWEtaGlkZGVuJywgaXNfb3BlbiA/ICd0cnVlJyA6ICdmYWxzZScgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldF9mb3JtKCkge1xuXHRcdHJldHVybiAkKCAnW2RhdGEtd3BiYy10aGVtZS1zZXR0aW5ncy1mb3JtPVwiMVwiXScgKS5maXJzdCgpO1xuXHR9XG5cblx0ZnVuY3Rpb24gY29sbGVjdF9wYXlsb2FkKCkge1xuXHRcdHZhciAkZm9ybSA9IGdldF9mb3JtKCk7XG5cdFx0dmFyIGRhdGEgPSB7fTtcblxuXHRcdHN5bmNfZm9ybV9zdHlsZV9jaG9pY2UoKTtcblxuXHRcdCQuZWFjaCggJGZvcm0uc2VyaWFsaXplQXJyYXkoKSwgZnVuY3Rpb24gKCBpbmRleCwgaXRlbSApIHtcblx0XHRcdGlmICggMCA9PT0gU3RyaW5nKCBpdGVtLm5hbWUgfHwgJycgKS5pbmRleE9mKCAnd3BiY19zZXR1cCcgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZGF0YVsgaXRlbS5uYW1lIF0gPSBpdGVtLnZhbHVlO1xuXHRcdH0gKTtcblxuXHRcdGRhdGEuYm9va2luZ190aW1lc2xvdF9waWNrZXIgPSAkZm9ybS5maW5kKCAnW25hbWU9XCJib29raW5nX3RpbWVzbG90X3BpY2tlclwiXScgKS5wcm9wKCAnY2hlY2tlZCcgKSA/ICdPbicgOiAnT2ZmJztcblx0XHRkYXRhLmJvb2tpbmdfZm9ybV9hY2NlbnRfZW5hYmxlZCA9ICRmb3JtLmZpbmQoICdbbmFtZT1cImJvb2tpbmdfZm9ybV9hY2NlbnRfZW5hYmxlZFwiXScgKS5wcm9wKCAnY2hlY2tlZCcgKSA/ICdPbicgOiAnT2ZmJztcblx0XHRkYXRhLnJlc291cmNlX2lkID0gJCggJyN3cGJjX3RoZW1lX3Jlc291cmNlX2lkJyApLnZhbCgpIHx8ICcnO1xuXHRcdGRhdGEubW9udGhzX2NvdW50ID0gJCggJyN3cGJjX3RoZW1lX21vbnRoc19jb3VudCcgKS52YWwoKSB8fCAnJztcblx0XHRkYXRhLnByZXZpZXdfbW9kZSA9ICQoICcjd3BiY190aGVtZV9wcmV2aWV3X21vZGUnICkudmFsKCkgfHwgJ2Zvcm0nO1xuXHRcdGRhdGEuY3VzdG9tX2Jvb2tpbmdfZm9ybSA9ICQoICcjd3BiY190aGVtZV9jdXN0b21fZm9ybScgKS52YWwoKSB8fCAnc3RhbmRhcmQnO1xuXG5cdFx0cmV0dXJuIGRhdGE7XG5cdH1cblxuXHRmdW5jdGlvbiBtYXBfZm9ybV9zdHlsZV9jaG9pY2UoIHZhbHVlICkge1xuXHRcdHZhciBjaG9pY2UgPSBTdHJpbmcoIHZhbHVlIHx8ICdsaWdodF9ib3JkZXJlZCcgKTtcblx0XHR2YXIgY3VycmVudF90aGVtZSA9ICQoICcjYm9va2luZ19mb3JtX3RoZW1lJyApLnZhbCgpIHx8ICcnO1xuXHRcdHZhciBwYXJ0cztcblx0XHR2YXIgcHJlc2V0O1xuXG5cdFx0aWYgKCAnY3VzdG9tJyA9PT0gY2hvaWNlICkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dGhlbWUgOiBjdXJyZW50X3RoZW1lLFxuXHRcdFx0XHRwcmVzZXQ6ICdjdXN0b20nXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHBhcnRzID0gY2hvaWNlLnNwbGl0KCAnXycgKTtcblx0XHRwcmVzZXQgPSBwYXJ0c1sxXSB8fCAnYm9yZGVyZWQnO1xuXHRcdGlmICggWyAnYm9yZGVyZWQnLCAnbm9uZScsICdzb2Z0JyBdLmluZGV4T2YoIHByZXNldCApID09PSAtMSApIHtcblx0XHRcdHByZXNldCA9ICdib3JkZXJlZCc7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHRoZW1lIDogKCAnZGFyaycgPT09IHBhcnRzWzBdICkgPyAnd3BiY190aGVtZV9kYXJrXzEnIDogJycsXG5cdFx0XHRwcmVzZXQ6IHByZXNldFxuXHRcdH07XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRfZm9ybV9zdHlsZV9jaG9pY2VfZnJvbV92YWx1ZXMoKSB7XG5cdFx0dmFyIHRoZW1lID0gJCggJyNib29raW5nX2Zvcm1fdGhlbWUnICkudmFsKCkgfHwgJyc7XG5cdFx0dmFyIHByZXNldCA9ICQoICcjYm9va2luZ19mb3JtX2FwcGVhcmFuY2VfcHJlc2V0JyApLnZhbCgpIHx8ICdib3JkZXJlZCc7XG5cdFx0dmFyIHByZWZpeCA9IHRoZW1lID8gJ2RhcmsnIDogJ2xpZ2h0JztcblxuXHRcdGlmICggJ2N1c3RvbScgPT09IHByZXNldCApIHtcblx0XHRcdHJldHVybiAnY3VzdG9tJztcblx0XHR9XG5cdFx0aWYgKCBbICdib3JkZXJlZCcsICdub25lJywgJ3NvZnQnIF0uaW5kZXhPZiggcHJlc2V0ICkgPT09IC0xICkge1xuXHRcdFx0cHJlc2V0ID0gJ2JvcmRlcmVkJztcblx0XHR9XG5cblx0XHRyZXR1cm4gcHJlZml4ICsgJ18nICsgcHJlc2V0O1xuXHR9XG5cblx0ZnVuY3Rpb24gc3luY19mb3JtX3N0eWxlX2Nob2ljZSgpIHtcblx0XHR2YXIgJGNoZWNrZWQgPSBnZXRfZm9ybSgpLmZpbmQoICdbbmFtZT1cImJvb2tpbmdfZm9ybV9zdHlsZVwiXTpjaGVja2VkJyApO1xuXHRcdHZhciBtYXBwZWQ7XG5cblx0XHRpZiAoICEgJGNoZWNrZWQubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdG1hcHBlZCA9IG1hcF9mb3JtX3N0eWxlX2Nob2ljZSggJGNoZWNrZWQudmFsKCkgKTtcblx0XHQkKCAnI2Jvb2tpbmdfZm9ybV90aGVtZScgKS52YWwoIG1hcHBlZC50aGVtZSApO1xuXHRcdCQoICcjYm9va2luZ19mb3JtX2FwcGVhcmFuY2VfcHJlc2V0JyApLnZhbCggbWFwcGVkLnByZXNldCApO1xuXHR9XG5cblx0ZnVuY3Rpb24gc3luY19mb3JtX3N0eWxlX2Nob2ljZV9zZWxlY3Rpb24oKSB7XG5cdFx0dmFyIGNob2ljZSA9IGdldF9mb3JtX3N0eWxlX2Nob2ljZV9mcm9tX3ZhbHVlcygpO1xuXHRcdHZhciAkY2hvaWNlcyA9IGdldF9mb3JtKCkuZmluZCggJ1tuYW1lPVwiYm9va2luZ19mb3JtX3N0eWxlXCJdJyApO1xuXG5cdFx0JGNob2ljZXMucHJvcCggJ2NoZWNrZWQnLCBmYWxzZSApO1xuXHRcdCRjaG9pY2VzLmZpbHRlciggJ1t2YWx1ZT1cIicgKyBjaG9pY2UgKyAnXCJdJyApLnByb3AoICdjaGVja2VkJywgdHJ1ZSApO1xuXG5cdFx0JCggJy53cGJjX3RoZW1lX2Nob2ljZScgKS5yZW1vdmVDbGFzcyggJ2lzLXNlbGVjdGVkJyApO1xuXHRcdCRjaG9pY2VzLmZpbHRlciggJzpjaGVja2VkJyApLmNsb3Nlc3QoICcud3BiY190aGVtZV9jaG9pY2UnICkuYWRkQ2xhc3MoICdpcy1zZWxlY3RlZCcgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGFwcGx5X2Zvcm1fdGhlbWUoKSB7XG5cdFx0dmFyIHRoZW1lID0gJCggJyNib29raW5nX2Zvcm1fdGhlbWUnICkudmFsKCkgfHwgJyc7XG5cdFx0dmFyICRwcmV2aWV3ID0gJCggJ1tkYXRhLXdwYmMtdGhlbWUtcHJldmlldz1cIjFcIl0nICk7XG5cdFx0dmFyICR0aGVtZV90YXJnZXRzID0gJHByZXZpZXcuYWRkKCAkcHJldmlldy5maW5kKCAnLndwYmNfY29udGFpbmVyLndwYmNfZm9ybSwgLndwYmNfY29udGFpbmVyX2Jvb2tpbmdfZm9ybScgKSApO1xuXG5cdFx0JHRoZW1lX3RhcmdldHMuZWFjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyICR0YXJnZXQgPSAkKCB0aGlzICk7XG5cdFx0XHR2YXIgY2xhc3NlcyA9IFN0cmluZyggdGhpcy5jbGFzc05hbWUgfHwgJycgKS5zcGxpdCggL1xccysvICk7XG5cblx0XHRcdCQuZWFjaCggY2xhc3NlcywgZnVuY3Rpb24gKCBpbmRleCwgY2xhc3NfbmFtZSApIHtcblx0XHRcdFx0aWYgKCAvXndwYmNfdGhlbWVfLy50ZXN0KCBjbGFzc19uYW1lICkgJiYgISAvXndwYmNfdGhlbWVfcHJldmlldy8udGVzdCggY2xhc3NfbmFtZSApICkge1xuXHRcdFx0XHRcdCR0YXJnZXQucmVtb3ZlQ2xhc3MoIGNsYXNzX25hbWUgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdH0gKTtcblx0XHRpZiAoIHRoZW1lICkge1xuXHRcdFx0JHRoZW1lX3RhcmdldHMuYWRkQ2xhc3MoIHRoZW1lICk7XG5cdFx0fVxuXG5cdFx0c3luY19mb3JtX3N0eWxlX2Nob2ljZV9zZWxlY3Rpb24oKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldF9mb3JtX2FwcGVhcmFuY2VfcHJlc2V0cygpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Ym9yZGVyZWQ6IHtcblx0XHRcdFx0YmFja2dyb3VuZCA6ICcjZmZmZmZmJyxcblx0XHRcdFx0Ym9yZGVyQ29sb3I6ICcjY2NjY2NjJyxcblx0XHRcdFx0Ym9yZGVyV2lkdGg6ICcxcHgnLFxuXHRcdFx0XHRyYWRpdXMgICAgIDogJzJweCcsXG5cdFx0XHRcdHBhZGRpbmcgICAgOiAnMTBweCAzMHB4Jyxcblx0XHRcdFx0c2hhZG93ICAgICA6ICdyZ2JhKDAsIDAsIDAsIDAuMDUpIDBweCAycHggNnB4IDBweCdcblx0XHRcdH0sXG5cdFx0XHRub25lICAgIDoge1xuXHRcdFx0XHRiYWNrZ3JvdW5kIDogJ3RyYW5zcGFyZW50Jyxcblx0XHRcdFx0Ym9yZGVyQ29sb3I6ICd0cmFuc3BhcmVudCcsXG5cdFx0XHRcdGJvcmRlcldpZHRoOiAnMHB4Jyxcblx0XHRcdFx0cmFkaXVzICAgICA6ICcwcHgnLFxuXHRcdFx0XHRwYWRkaW5nICAgIDogJzBweCcsXG5cdFx0XHRcdHNoYWRvdyAgICAgOiAnbm9uZSdcblx0XHRcdH0sXG5cdFx0XHRzb2Z0ICAgIDoge1xuXHRcdFx0XHRiYWNrZ3JvdW5kIDogJyNmOWY5ZmEnLFxuXHRcdFx0XHRib3JkZXJDb2xvcjogJyNmZmYnLFxuXHRcdFx0XHRib3JkZXJXaWR0aDogJzNweCcsXG5cdFx0XHRcdHJhZGl1cyAgICAgOiAnOHB4Jyxcblx0XHRcdFx0cGFkZGluZyAgICA6ICcyMHB4Jyxcblx0XHRcdFx0c2hhZG93ICAgICA6ICdyZ2JhKDE1LCAyMywgNDIsIDAuMDYpIDBweCA0cHggMTZweCAwcHgnXG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdGZ1bmN0aW9uIGlzX2RhcmtfZm9ybV90aGVtZSgpIHtcblx0XHRyZXR1cm4gJ3dwYmNfdGhlbWVfZGFya18xJyA9PT0gU3RyaW5nKCAkKCAnI2Jvb2tpbmdfZm9ybV90aGVtZScgKS52YWwoKSB8fCAnJyApO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0X2Zvcm1fYXBwZWFyYW5jZV9wcmVzZXRfZm9yX3RoZW1lKCBwcmVzZXQgKSB7XG5cdFx0dmFyIHByZXNldHMgPSBnZXRfZm9ybV9hcHBlYXJhbmNlX3ByZXNldHMoKTtcblxuXHRcdGlmICggISBpc19kYXJrX2Zvcm1fdGhlbWUoKSApIHtcblx0XHRcdHJldHVybiBwcmVzZXRzW3ByZXNldF0gfHwgcHJlc2V0cy5ib3JkZXJlZDtcblx0XHR9XG5cblx0XHRpZiAoICdzb2Z0JyA9PT0gcHJlc2V0ICkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0YmFja2dyb3VuZCA6ICcjMWYyOTM3Jyxcblx0XHRcdFx0Ym9yZGVyQ29sb3I6ICcjMzM0MTU1Jyxcblx0XHRcdFx0Ym9yZGVyV2lkdGg6ICczcHgnLFxuXHRcdFx0XHRyYWRpdXMgICAgIDogJzhweCcsXG5cdFx0XHRcdHBhZGRpbmcgICAgOiAnMjBweCcsXG5cdFx0XHRcdHNoYWRvdyAgICAgOiAncmdiYSgwLCAwLCAwLCAwLjI0KSAwcHggNHB4IDE2cHggMHB4J1xuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcHJlc2V0c1twcmVzZXRdIHx8IHByZXNldHMuYm9yZGVyZWQ7XG5cdH1cblxuXHRmdW5jdGlvbiBzYW5pdGl6ZV90aGVtZV9jb2xvciggdmFsdWUsIGZhbGxiYWNrICkge1xuXHRcdHZhciB2ID0gU3RyaW5nKCB2YWx1ZSB8fCAnJyApLnRyaW0oKTtcblx0XHRyZXR1cm4gL14jKD86WzAtOWEtZl17M318WzAtOWEtZl17Nn0pJC9pLnRlc3QoIHYgKSB8fCAndHJhbnNwYXJlbnQnID09PSB2ID8gdiA6IGZhbGxiYWNrO1xuXHR9XG5cblx0ZnVuY3Rpb24gc2FuaXRpemVfdGhlbWVfbGVuZ3RoKCB2YWx1ZSwgZmFsbGJhY2sgKSB7XG5cdFx0dmFyIHYgPSBTdHJpbmcoIHZhbHVlIHx8ICcnICkudHJpbSgpO1xuXHRcdHJldHVybiAvXlxcZCsoPzpcXC5cXGQrKT8oPzpweHxyZW18ZW18JSkkL2kudGVzdCggdiApID8gdiA6IGZhbGxiYWNrO1xuXHR9XG5cblx0ZnVuY3Rpb24gc2FuaXRpemVfdGhlbWVfc3BhY2luZyggdmFsdWUsIGZhbGxiYWNrICkge1xuXHRcdHZhciB2ID0gU3RyaW5nKCB2YWx1ZSB8fCAnJyApLnRyaW0oKS5yZXBsYWNlKCAvXFxzKy9nLCAnICcgKTtcblx0XHR2YXIgcGFydHMgPSB2ID8gdi5zcGxpdCggJyAnICkgOiBbXTtcblx0XHR2YXIgaTtcblxuXHRcdGlmICggcGFydHMubGVuZ3RoIDwgMSB8fCBwYXJ0cy5sZW5ndGggPiA0ICkge1xuXHRcdFx0cmV0dXJuIGZhbGxiYWNrO1xuXHRcdH1cblx0XHRmb3IgKCBpID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgaSsrICkge1xuXHRcdFx0aWYgKCAhIC9eXFxkKyg/OlxcLlxcZCspPyg/OnB4fHJlbXxlbXwlKSQvaS50ZXN0KCBwYXJ0c1tpXSApICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsbGJhY2s7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBwYXJ0cy5qb2luKCAnICcgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIG1peF90aGVtZV9jb2xvcnMoIGNvbG9yLCB0YXJnZXQsIGFtb3VudCApIHtcblx0XHR2YXIgc291cmNlID0gc2FuaXRpemVfdGhlbWVfY29sb3IoIGNvbG9yLCBkZWZhdWx0X2Zvcm1fYWNjZW50X2NvbG9yICkucmVwbGFjZSggJyMnLCAnJyApO1xuXHRcdHZhciBkZXN0aW5hdGlvbiA9IHNhbml0aXplX3RoZW1lX2NvbG9yKCB0YXJnZXQsICcjMDAwMDAwJyApLnJlcGxhY2UoICcjJywgJycgKTtcblx0XHR2YXIgY2hhbm5lbHMgPSBbXTtcblx0XHR2YXIgaW5kZXg7XG5cblx0XHRpZiAoIDMgPT09IHNvdXJjZS5sZW5ndGggKSB7XG5cdFx0XHRzb3VyY2UgPSBzb3VyY2UucmVwbGFjZSggLy4vZywgZnVuY3Rpb24gKCB2YWx1ZSApIHsgcmV0dXJuIHZhbHVlICsgdmFsdWU7IH0gKTtcblx0XHR9XG5cdFx0Zm9yICggaW5kZXggPSAwOyBpbmRleCA8IDM7IGluZGV4KysgKSB7XG5cdFx0XHRjaGFubmVscy5wdXNoKCBNYXRoLnJvdW5kKCBwYXJzZUludCggc291cmNlLnN1YnN0ciggaW5kZXggKiAyLCAyICksIDE2ICkgKyAoICggcGFyc2VJbnQoIGRlc3RpbmF0aW9uLnN1YnN0ciggaW5kZXggKiAyLCAyICksIDE2ICkgLSBwYXJzZUludCggc291cmNlLnN1YnN0ciggaW5kZXggKiAyLCAyICksIDE2ICkgKSAqIGFtb3VudCApICkgKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gJyMnICsgY2hhbm5lbHMubWFwKCBmdW5jdGlvbiAoIGNoYW5uZWwgKSB7IHJldHVybiAoICcwJyArIGNoYW5uZWwudG9TdHJpbmcoIDE2ICkgKS5zbGljZSggLTIgKTsgfSApLmpvaW4oICcnICk7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRfdGhlbWVfY29sb3JfbHVtaW5hbmNlKCBjb2xvciApIHtcblx0XHR2YXIgaGV4ID0gc2FuaXRpemVfdGhlbWVfY29sb3IoIGNvbG9yLCBkZWZhdWx0X2Zvcm1fYWNjZW50X2NvbG9yICkucmVwbGFjZSggJyMnLCAnJyApO1xuXHRcdHZhciBjaGFubmVscztcblx0XHRpZiAoIDMgPT09IGhleC5sZW5ndGggKSB7XG5cdFx0XHRoZXggPSBoZXgucmVwbGFjZSggLy4vZywgZnVuY3Rpb24gKCB2YWx1ZSApIHsgcmV0dXJuIHZhbHVlICsgdmFsdWU7IH0gKTtcblx0XHR9XG5cdFx0Y2hhbm5lbHMgPSBbIDAsIDEsIDIgXS5tYXAoIGZ1bmN0aW9uICggaW5kZXggKSB7XG5cdFx0XHR2YXIgY2hhbm5lbCA9IHBhcnNlSW50KCBoZXguc3Vic3RyKCBpbmRleCAqIDIsIDIgKSwgMTYgKSAvIDI1NTtcblx0XHRcdHJldHVybiBjaGFubmVsIDw9IDAuMDM5MjggPyBjaGFubmVsIC8gMTIuOTIgOiBNYXRoLnBvdyggKCBjaGFubmVsICsgMC4wNTUgKSAvIDEuMDU1LCAyLjQgKTtcblx0XHR9ICk7XG5cdFx0cmV0dXJuICggMC4yMTI2ICogY2hhbm5lbHNbMF0gKSArICggMC43MTUyICogY2hhbm5lbHNbMV0gKSArICggMC4wNzIyICogY2hhbm5lbHNbMl0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBcHBseSB0aGUgYWNjZW50IHRvIHByZXZpZXcgdmFyaWFibGVzIHdoaWxlIHJlc3BlY3RpbmcgQ3VzdG9tIGJ1dHRvbiBjb250cm9scy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9ICBjc3NfdmFycyAgICAgICAgICAgICAgICAgICAgICBSZXNvbHZlZCBwcmV2aWV3IHZhcmlhYmxlcy5cblx0ICogQHBhcmFtIHtib29sZWFufSBwcmVzZXJ2ZV9jdXN0b21fYnV0dG9uX2NvbG9ycyBXaGV0aGVyIEN1c3RvbSBidXR0b24gdmFyaWFibGVzIHJlbWFpbiBhdXRob3JpdGF0aXZlLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IFByZXZpZXcgdmFyaWFibGVzIHdpdGggdGhlIG9wdGlvbmFsIGFjY2VudCBvdmVybGF5LlxuXHQgKi9cblx0ZnVuY3Rpb24gYXBwbHlfZm9ybV9hY2NlbnRfY3NzX3ZhcnMoIGNzc192YXJzLCBwcmVzZXJ2ZV9jdXN0b21fYnV0dG9uX2NvbG9ycyApIHtcblx0XHR2YXIgZW5hYmxlZCA9IGdldF9mb3JtKCkuZmluZCggJ1tuYW1lPVwiYm9va2luZ19mb3JtX2FjY2VudF9lbmFibGVkXCJdJyApLnByb3AoICdjaGVja2VkJyApO1xuXHRcdHZhciBhY2NlbnRfcmF3ID0gU3RyaW5nKCBnZXRfZm9ybSgpLmZpbmQoICdbbmFtZT1cImJvb2tpbmdfZm9ybV9hY2NlbnRfY29sb3JcIl0nICkudmFsKCkgfHwgJycgKS50cmltKCk7XG5cdFx0dmFyIGFjY2VudCA9IC9eIyg/OlswLTlhLWZdezN9fFswLTlhLWZdezZ9KSQvaS50ZXN0KCBhY2NlbnRfcmF3ICkgPyBhY2NlbnRfcmF3IDogZGVmYXVsdF9mb3JtX2FjY2VudF9jb2xvcjtcblx0XHR2YXIgbHVtaW5hbmNlO1xuXHRcdHZhciBob3Zlcjtcblx0XHR2YXIgY29udHJhc3Q7XG5cdFx0dmFyIGhvdmVyX2NvbnRyYXN0O1xuXG5cdFx0aWYgKCAhIGVuYWJsZWQgKSB7XG5cdFx0XHRyZXR1cm4gY3NzX3ZhcnM7XG5cdFx0fVxuXHRcdGlmICggISAvXiMoPzpbMC05YS1mXXszfXxbMC05YS1mXXs2fSkkL2kudGVzdCggYWNjZW50ICkgKSB7XG5cdFx0XHRyZXR1cm4gY3NzX3ZhcnM7XG5cdFx0fVxuXHRcdGx1bWluYW5jZSA9IGdldF90aGVtZV9jb2xvcl9sdW1pbmFuY2UoIGFjY2VudCApO1xuXHRcdGNvbnRyYXN0ID0gbHVtaW5hbmNlID4gMC4xOCA/ICcjMDAwMDAwJyA6ICcjZmZmZmZmJztcblx0XHRob3ZlciA9IG1peF90aGVtZV9jb2xvcnMoIGFjY2VudCwgJyNmZmZmZmYnID09PSBjb250cmFzdCA/ICcjMDAwMDAwJyA6ICcjZmZmZmZmJywgMC4xMCApO1xuXHRcdGhvdmVyX2NvbnRyYXN0ID0gY29udHJhc3Q7XG5cblx0XHR2YXIgYWNjZW50X292ZXJsYXkgPSB7XG5cdFx0XHQnLS13cGJjX2Zvcm0tYWNjZW50LWNvbG9yJzogYWNjZW50LFxuXHRcdFx0Jy0td3BiY19mb3JtLWFjY2VudC1ob3Zlci1jb2xvcic6IGhvdmVyLFxuXHRcdFx0Jy0td3BiY19mb3JtLWFjY2VudC1jb250cmFzdC1jb2xvcic6IGNvbnRyYXN0LFxuXHRcdFx0Jy0td3BiY19mb3JtLWZpZWxkLWZvY3VzLWJvcmRlci1jb2xvcic6IGFjY2VudCxcblx0XHRcdCctLXdwYmNfZm9ybS1maWVsZC1mb2N1cy1zaGFkb3ctY29sb3InOiBhY2NlbnQsXG5cdFx0XHQnLS13cGJjX2Zvcm0tY2hvaWNlLWNoZWNrZWQtYm9yZGVyLWNvbG9yJzogYWNjZW50LFxuXHRcdFx0Jy0td3BiY19mb3JtLWNob2ljZS1jaGVja2VkLWNvbG9yJzogYWNjZW50LFxuXHRcdFx0Jy0td3BiY19mb3JtLWNob2ljZS1mb2N1cy1jb2xvcic6IGFjY2VudCxcblx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tYmFja2dyb3VuZC1jb2xvcic6IGFjY2VudCxcblx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tYmFja2dyb3VuZC1jb2xvci1hbHQnOiBhY2NlbnQsXG5cdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWJvcmRlci1jb2xvcic6IGFjY2VudCxcblx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tdGV4dC1jb2xvcic6IGNvbnRyYXN0LFxuXHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi10ZXh0LWNvbG9yLWFsdCc6IGNvbnRyYXN0LFxuXHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1ob3Zlci1iYWNrZ3JvdW5kLWNvbG9yJzogaG92ZXIsXG5cdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWhvdmVyLWJvcmRlci1jb2xvcic6IGhvdmVyLFxuXHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1ob3Zlci10ZXh0LWNvbG9yJzogaG92ZXJfY29udHJhc3QsXG5cdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWxpZ2h0LWhvdmVyLWJvcmRlci1jb2xvcic6IGFjY2VudCxcblx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tcHJpbWFyeS1ob3Zlci1ib3JkZXItY29sb3InOiBob3Zlcixcblx0XHRcdCctLXdwYmNfZm9ybS1wYWdlLWJyZWFrLWNvbG9yJzogYWNjZW50XG5cdFx0fTtcblxuXHRcdGlmICggcHJlc2VydmVfY3VzdG9tX2J1dHRvbl9jb2xvcnMgKSB7XG5cdFx0XHRbXG5cdFx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tYmFja2dyb3VuZC1jb2xvcicsXG5cdFx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tYmFja2dyb3VuZC1jb2xvci1hbHQnLFxuXHRcdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWJvcmRlci1jb2xvcicsXG5cdFx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tdGV4dC1jb2xvcicsXG5cdFx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tdGV4dC1jb2xvci1hbHQnLFxuXHRcdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWhvdmVyLWJhY2tncm91bmQtY29sb3InLFxuXHRcdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWhvdmVyLWJvcmRlci1jb2xvcicsXG5cdFx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24taG92ZXItdGV4dC1jb2xvcicsXG5cdFx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tbGlnaHQtaG92ZXItYm9yZGVyLWNvbG9yJyxcblx0XHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1wcmltYXJ5LWhvdmVyLWJvcmRlci1jb2xvcidcblx0XHRcdF0uZm9yRWFjaCggZnVuY3Rpb24gKCBjc3NfdmFyX25hbWUgKSB7XG5cdFx0XHRcdGRlbGV0ZSBhY2NlbnRfb3ZlcmxheVsgY3NzX3Zhcl9uYW1lIF07XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICQuZXh0ZW5kKCB7fSwgY3NzX3ZhcnMsIGFjY2VudF9vdmVybGF5ICk7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRfZm9ybV9zdHlsZV9wcmVzZXRzKCkge1xuXHRcdHJldHVybiBjZmcuZm9ybV9zdHlsZV9wcmVzZXRzICYmICdvYmplY3QnID09PSB0eXBlb2YgY2ZnLmZvcm1fc3R5bGVfcHJlc2V0cyA/IGNmZy5mb3JtX3N0eWxlX3ByZXNldHMgOiB7fTtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldF9jdXJyZW50X2Zvcm1fc3R5bGUoKSB7XG5cdFx0dmFyICRjaGVja2VkID0gZ2V0X2Zvcm0oKS5maW5kKCAnW25hbWU9XCJib29raW5nX2Zvcm1fc3R5bGVcIl06Y2hlY2tlZCcgKTtcblx0XHRyZXR1cm4gJGNoZWNrZWQubGVuZ3RoID8gU3RyaW5nKCAkY2hlY2tlZC52YWwoKSB8fCAnbGlnaHRfYm9yZGVyZWQnICkgOiAnbGlnaHRfYm9yZGVyZWQnO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0X2N1c3RvbV9mb3JtX3N0eWxlX2RlZmF1bHRzKCkge1xuXHRcdHJldHVybiAkLmV4dGVuZCgge1xuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9iYWNrZ3JvdW5kX2NvbG9yICAgICAgIDogJyNmZmZmZmYnLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfY29sb3IgICAgICAgICAgIDogJyNjY2NjY2MnLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfd2lkdGggICAgICAgICAgIDogJzFweCcsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl9yYWRpdXMgICAgICAgICAgOiAnMnB4Jyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fcGFkZGluZ192ZXJ0aWNhbCAgICAgICA6ICcxMHB4Jyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fcGFkZGluZ19ob3Jpem9udGFsICAgICA6ICczMHB4Jyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fdGV4dF9jb2xvciAgICAgICAgICAgICA6ICcjMWQyMzI3Jyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYmFja2dyb3VuZF9jb2xvciA6ICcjZmZmZmZmJyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfdGV4dF9jb2xvciAgICAgICA6ICcjM2M0MzRhJyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYm9yZGVyX2NvbG9yICAgICA6ICcjY2NjY2NjJyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JhY2tncm91bmRfY29sb3I6ICcjMDY2YWFiJyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX3RleHRfY29sb3IgICAgICA6ICcjZmZmZmZmJyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JvcmRlcl9jb2xvciAgICA6ICcjMDY2YWFiJyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JhY2tncm91bmRfY29sb3I6ICcjMDU1NTg5Jyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX3RleHRfY29sb3I6ICcjZmZmZmZmJyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JvcmRlcl9jb2xvcjogJyMwNTU1ODknLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2JhY2tncm91bmRfY29sb3I6ICcjZmRmZGZkJyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl90ZXh0X2NvbG9yOiAnIzQ0NDQ0NCcsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fYm9yZGVyX2NvbG9yOiAnI2VlZWVlZScsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfYmFja2dyb3VuZF9jb2xvcjogJyNmZGZkZmQnLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX3RleHRfY29sb3I6ICcjNDQ0NDQ0Jyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl9ib3JkZXJfY29sb3I6ICcjNGQ5MWNkJyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JvcmRlcl93aWR0aDogJzFweCcsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ib3JkZXJfcmFkaXVzOiAnM3B4J1xuXHRcdH0sIGNmZy5jdXN0b21fZm9ybV9zdHlsZV9kZWZhdWx0cyAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIGNmZy5jdXN0b21fZm9ybV9zdHlsZV9kZWZhdWx0cyA/IGNmZy5jdXN0b21fZm9ybV9zdHlsZV9kZWZhdWx0cyA6IHt9ICk7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRfY3VzdG9tX2Zvcm1fc3R5bGVfY3NzX3ZhcnMoKSB7XG5cdFx0dmFyIGRlZmF1bHRzID0gZ2V0X2N1c3RvbV9mb3JtX3N0eWxlX2RlZmF1bHRzKCk7XG5cdFx0dmFyIHZhbHVlcyA9ICQuZXh0ZW5kKCB7fSwgZGVmYXVsdHMsIGNmZy5zZXR0aW5ncyAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIGNmZy5zZXR0aW5ncyA/IGNmZy5zZXR0aW5ncyA6IHt9ICk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0Jy0td3BiYy1iZmItZm9ybS1iYWNrZ3JvdW5kJyAgICAgICAgICA6IHNhbml0aXplX3RoZW1lX2NvbG9yKCB2YWx1ZXMuYm9va2luZ19mb3JtX2N1c3RvbV9iYWNrZ3JvdW5kX2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2JhY2tncm91bmRfY29sb3IgKSxcblx0XHRcdCctLXdwYmMtYmZiLWZvcm0tYm9yZGVyLWNvbG9yJyAgICAgICAgOiBzYW5pdGl6ZV90aGVtZV9jb2xvciggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl9jb2xvciApLFxuXHRcdFx0Jy0td3BiYy1iZmItZm9ybS1ib3JkZXItd2lkdGgnICAgICAgICA6IHNhbml0aXplX3RoZW1lX2xlbmd0aCggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX3dpZHRoLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl93aWR0aCApLFxuXHRcdFx0Jy0td3BiYy1iZmItZm9ybS1ib3JkZXItcmFkaXVzJyAgICAgICA6IHNhbml0aXplX3RoZW1lX2xlbmd0aCggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX3JhZGl1cywgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfcmFkaXVzICksXG5cdFx0XHQnLS13cGJjLWJmYi1mb3JtLXBhZGRpbmcnICAgICAgICAgICAgIDogc2FuaXRpemVfdGhlbWVfbGVuZ3RoKCB2YWx1ZXMuYm9va2luZ19mb3JtX2N1c3RvbV9wYWRkaW5nX3ZlcnRpY2FsLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX3BhZGRpbmdfdmVydGljYWwgKSArICcgJyArIHNhbml0aXplX3RoZW1lX2xlbmd0aCggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fcGFkZGluZ19ob3Jpem9udGFsLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX3BhZGRpbmdfaG9yaXpvbnRhbCApLFxuXHRcdFx0Jy0td3BiYy1iZmItZm9ybS1ib3gtc2hhZG93JyAgICAgICAgICA6ICdyZ2JhKDAsIDAsIDAsIDAuMDUpIDBweCAycHggNnB4IDBweCcsXG5cdFx0XHQnLS13cGJjX2Zvcm0tbGFiZWwtY29sb3InICAgICAgICAgICAgIDogc2FuaXRpemVfdGhlbWVfY29sb3IoIHZhbHVlcy5ib29raW5nX2Zvcm1fY3VzdG9tX3RleHRfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fdGV4dF9jb2xvciApLFxuXHRcdFx0Jy0td3BiY19mb3JtLWxhYmVsLXN1YmxhYmVsLWNvbG9yJyAgICA6IHNhbml0aXplX3RoZW1lX2NvbG9yKCB2YWx1ZXMuYm9va2luZ19mb3JtX2N1c3RvbV90ZXh0X2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX3RleHRfY29sb3IgKSxcblx0XHRcdCctLXdwYmNfZm9ybS1sYWJlbC1lcnJvci1jb2xvcicgICAgICAgOiAnI2Q2MzYzNycsXG5cdFx0XHQnLS13cGJjX2Zvcm0tZmllbGQtYmFja2dyb3VuZC1jb2xvcicgIDogc2FuaXRpemVfdGhlbWVfY29sb3IoIHZhbHVlcy5ib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JhY2tncm91bmRfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYmFja2dyb3VuZF9jb2xvciApLFxuXHRcdFx0Jy0td3BiY19mb3JtLWZpZWxkLW1lbnUtY29sb3InICAgICAgICA6IHNhbml0aXplX3RoZW1lX2NvbG9yKCB2YWx1ZXMuYm9va2luZ19mb3JtX2N1c3RvbV9maWVsZF9iYWNrZ3JvdW5kX2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JhY2tncm91bmRfY29sb3IgKSxcblx0XHRcdCctLXdwYmNfZm9ybS1maWVsZC10ZXh0LWNvbG9yJyAgICAgICAgOiBzYW5pdGl6ZV90aGVtZV9jb2xvciggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfdGV4dF9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9maWVsZF90ZXh0X2NvbG9yICksXG5cdFx0XHQnLS13cGJjX2Zvcm0tZmllbGQtYm9yZGVyLWNvbG9yJyAgICAgIDogc2FuaXRpemVfdGhlbWVfY29sb3IoIHZhbHVlcy5ib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JvcmRlcl9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9maWVsZF9ib3JkZXJfY29sb3IgKSxcblx0XHRcdCctLXdwYmNfZm9ybS1maWVsZC1ib3JkZXItY29sb3Itc3BhcmUnOiBzYW5pdGl6ZV90aGVtZV9jb2xvciggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYm9yZGVyX2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JvcmRlcl9jb2xvciApLFxuXHRcdFx0Jy0td3BiY19mb3JtLWZpZWxkLWZvY3VzLWJvcmRlci1jb2xvcic6ICcjMDY2YWFiJyxcblx0XHRcdCctLXdwYmNfZm9ybS1maWVsZC1mb2N1cy1zaGFkb3ctY29sb3InOiAnIzA2NmFhYicsXG5cdFx0XHQnLS13cGJjX2Zvcm0tZmllbGQtZGlzYWJsZWQtY29sb3InICAgIDogJ3JnYmEoMCwgMCwgMCwgMC4yKScsXG5cdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWJvcmRlci1yYWRpdXMnICAgIDogc2FuaXRpemVfdGhlbWVfbGVuZ3RoKCB2YWx1ZXMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYm9yZGVyX3JhZGl1cywgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYm9yZGVyX3JhZGl1cyApLFxuXHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1ib3JkZXItc3R5bGUnICAgICA6ICdzb2xpZCcsXG5cdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWJvcmRlci1zaXplJyAgICAgIDogc2FuaXRpemVfdGhlbWVfbGVuZ3RoKCB2YWx1ZXMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYm9yZGVyX3dpZHRoLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ib3JkZXJfd2lkdGggKSxcblx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tYmFja2dyb3VuZC1jb2xvcicgOiBzYW5pdGl6ZV90aGVtZV9jb2xvciggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JhY2tncm91bmRfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JhY2tncm91bmRfY29sb3IgKSxcblx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tYmFja2dyb3VuZC1jb2xvci1hbHQnOiBzYW5pdGl6ZV90aGVtZV9jb2xvciggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JhY2tncm91bmRfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JhY2tncm91bmRfY29sb3IgKSxcblx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tYm9yZGVyLWNvbG9yJyAgICAgOiBzYW5pdGl6ZV90aGVtZV9jb2xvciggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JvcmRlcl9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYm9yZGVyX2NvbG9yICksXG5cdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLXRleHQtY29sb3InICAgICAgIDogc2FuaXRpemVfdGhlbWVfY29sb3IoIHZhbHVlcy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl90ZXh0X2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl90ZXh0X2NvbG9yICksXG5cdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLXRleHQtY29sb3ItYWx0JyAgIDogc2FuaXRpemVfdGhlbWVfY29sb3IoIHZhbHVlcy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl90ZXh0X2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl90ZXh0X2NvbG9yICksXG5cdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWhvdmVyLWJhY2tncm91bmQtY29sb3InOiBzYW5pdGl6ZV90aGVtZV9jb2xvciggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JhY2tncm91bmRfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JhY2tncm91bmRfY29sb3IgKSxcblx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24taG92ZXItYm9yZGVyLWNvbG9yJzogc2FuaXRpemVfdGhlbWVfY29sb3IoIHZhbHVlcy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl9ib3JkZXJfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JvcmRlcl9jb2xvciApLFxuXHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1ob3Zlci10ZXh0LWNvbG9yJyA6IHNhbml0aXplX3RoZW1lX2NvbG9yKCB2YWx1ZXMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfdGV4dF9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfdGV4dF9jb2xvciApLFxuXHRcdFx0Jy0td3BiY19mb3JtLWNob2ljZS1jaGVja2VkLWJvcmRlci1jb2xvcic6ICcjMDY2YWFiJyxcblx0XHRcdCctLXdwYmNfZm9ybS1jaG9pY2UtY2hlY2tlZC1jb2xvcicgICAgOiAnIzA2NmFhYicsXG5cdFx0XHQnLS13cGJjX2Zvcm0tY2hvaWNlLWZvY3VzLWNvbG9yJyAgICAgIDogJyMwNjZhYWInLFxuXHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1saWdodC1iYWNrZ3JvdW5kLWNvbG9yJzogc2FuaXRpemVfdGhlbWVfY29sb3IoIHZhbHVlcy5ib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fYmFja2dyb3VuZF9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2JhY2tncm91bmRfY29sb3IgKSxcblx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tbGlnaHQtYm9yZGVyLWNvbG9yJzogc2FuaXRpemVfdGhlbWVfY29sb3IoIHZhbHVlcy5ib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fYm9yZGVyX2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fYm9yZGVyX2NvbG9yICksXG5cdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWxpZ2h0LWJvcmRlci1zaXplJzogc2FuaXRpemVfdGhlbWVfbGVuZ3RoKCB2YWx1ZXMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYm9yZGVyX3dpZHRoLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ib3JkZXJfd2lkdGggKSxcblx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tbGlnaHQtdGV4dC1jb2xvcicgOiBzYW5pdGl6ZV90aGVtZV9jb2xvciggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl90ZXh0X2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fdGV4dF9jb2xvciApLFxuXHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1saWdodC1ib3gtc2hhZG93JyA6ICcwIDJweCAxMHB4IDJweCAjZmZmZmZmNTQnLFxuXHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1saWdodC1ob3Zlci1iYWNrZ3JvdW5kLWNvbG9yJzogc2FuaXRpemVfdGhlbWVfY29sb3IoIHZhbHVlcy5ib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfYmFja2dyb3VuZF9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX2JhY2tncm91bmRfY29sb3IgKSxcblx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tbGlnaHQtaG92ZXItYm9yZGVyLWNvbG9yJzogc2FuaXRpemVfdGhlbWVfY29sb3IoIHZhbHVlcy5ib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfYm9yZGVyX2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfYm9yZGVyX2NvbG9yICksXG5cdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWxpZ2h0LWhvdmVyLXRleHQtY29sb3InOiBzYW5pdGl6ZV90aGVtZV9jb2xvciggdmFsdWVzLmJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl90ZXh0X2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfdGV4dF9jb2xvciApLFxuXHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1saWdodC1ob3Zlci1ib3gtc2hhZG93JzogJzAgMnB4IDEwcHggMnB4ICNmZmZmZmY1NCcsXG5cdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLXByaW1hcnktaG92ZXItYm9yZGVyLWNvbG9yJzogc2FuaXRpemVfdGhlbWVfY29sb3IoIHZhbHVlcy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl9ib3JkZXJfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JvcmRlcl9jb2xvciApLFxuXHRcdFx0Jy0td3BiY19mb3JtLXBhZ2UtYnJlYWstY29sb3InICAgICAgICA6ICcjMDY2YWFiJ1xuXHRcdH07XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRfZm9ybV9zdHlsZV9jc3NfdmFyX25hbWVzKCkge1xuXHRcdHZhciBrZXlzID0gW107XG5cdFx0dmFyIHByZXNldHM7XG5cblx0XHRpZiAoIEFycmF5LmlzQXJyYXkoIGNmZy5mb3JtX3N0eWxlX2Nzc192YXJfbmFtZXMgKSAmJiBjZmcuZm9ybV9zdHlsZV9jc3NfdmFyX25hbWVzLmxlbmd0aCApIHtcblx0XHRcdHJldHVybiBjZmcuZm9ybV9zdHlsZV9jc3NfdmFyX25hbWVzO1xuXHRcdH1cblxuXHRcdHByZXNldHMgPSBnZXRfZm9ybV9zdHlsZV9wcmVzZXRzKCk7XG5cdFx0JC5lYWNoKCBwcmVzZXRzLCBmdW5jdGlvbiAoIHByZXNldF9rZXksIHByZXNldCApIHtcblx0XHRcdGlmICggcHJlc2V0ICYmIHByZXNldC5jc3NfdmFycyAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIHByZXNldC5jc3NfdmFycyApIHtcblx0XHRcdFx0JC5lYWNoKCBwcmVzZXQuY3NzX3ZhcnMsIGZ1bmN0aW9uICggdmFyX25hbWUgKSB7XG5cdFx0XHRcdFx0aWYgKCAtMSA9PT0ga2V5cy5pbmRleE9mKCB2YXJfbmFtZSApICkge1xuXHRcdFx0XHRcdFx0a2V5cy5wdXNoKCB2YXJfbmFtZSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblxuXHRcdCQuZWFjaCggZ2V0X2N1c3RvbV9mb3JtX3N0eWxlX2Nzc192YXJzKCksIGZ1bmN0aW9uICggdmFyX25hbWUgKSB7XG5cdFx0XHRpZiAoIC0xID09PSBrZXlzLmluZGV4T2YoIHZhcl9uYW1lICkgKSB7XG5cdFx0XHRcdGtleXMucHVzaCggdmFyX25hbWUgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHRyZXR1cm4ga2V5cztcblx0fVxuXG5cdGZ1bmN0aW9uIHJlc29sdmVfZm9ybV9zdHlsZV9jc3NfdmFycyggc3R5bGUgKSB7XG5cdFx0dmFyIHByZXNldHMgPSBnZXRfZm9ybV9zdHlsZV9wcmVzZXRzKCk7XG5cdFx0dmFyIHByZXNldCA9IHByZXNldHNbIHN0eWxlIF0gfHwgcHJlc2V0cy5saWdodF9ib3JkZXJlZCB8fCB7fTtcblxuXHRcdGlmICggJ2N1c3RvbScgPT09IHN0eWxlIHx8IHByZXNldC5jdXN0b20gKSB7XG5cdFx0XHRyZXR1cm4gYXBwbHlfZm9ybV9hY2NlbnRfY3NzX3ZhcnMoIGdldF9jdXN0b21fZm9ybV9zdHlsZV9jc3NfdmFycygpLCB0cnVlICk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFwcGx5X2Zvcm1fYWNjZW50X2Nzc192YXJzKCBwcmVzZXQuY3NzX3ZhcnMgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBwcmVzZXQuY3NzX3ZhcnMgPyBwcmVzZXQuY3NzX3ZhcnMgOiB7fSApO1xuXHR9XG5cblx0ZnVuY3Rpb24gYXBwbHlfZm9ybV9zdHlsZV90b19wcmV2aWV3KCkge1xuXHRcdHZhciBzdHlsZSA9IGdldF9jdXJyZW50X2Zvcm1fc3R5bGUoKTtcblx0XHR2YXIgcHJlc2V0cyA9IGdldF9mb3JtX3N0eWxlX3ByZXNldHMoKTtcblx0XHR2YXIgcHJlc2V0ID0gcHJlc2V0c1sgc3R5bGUgXSB8fCBwcmVzZXRzLmxpZ2h0X2JvcmRlcmVkIHx8IHt9O1xuXHRcdHZhciBjc3NfdmFycyA9IHJlc29sdmVfZm9ybV9zdHlsZV9jc3NfdmFycyggc3R5bGUgKTtcblx0XHR2YXIgY3NzX3Zhcl9uYW1lcyA9IGdldF9mb3JtX3N0eWxlX2Nzc192YXJfbmFtZXMoKTtcblx0XHR2YXIgaXNfY3VzdG9tID0gKCAnY3VzdG9tJyA9PT0gc3R5bGUgfHwgcHJlc2V0LmN1c3RvbSApO1xuXHRcdHZhciAkcHJldmlldyA9ICQoICdbZGF0YS13cGJjLXRoZW1lLXByZXZpZXc9XCIxXCJdJyApO1xuXHRcdHZhciAkdGFyZ2V0cyA9ICRwcmV2aWV3LmZpbmQoICcud3BiY19jb250YWluZXIud3BiY19mb3JtLCAud3BiY19iZmJfZm9ybSwgLndwYmNfYmZiX19mb3JtX3ByZXZpZXdfc2VjdGlvbl9jb250YWluZXInICk7XG5cblx0XHQkKCAnW2RhdGEtd3BiYy10aGVtZS1jdXN0b20tYXBwZWFyYW5jZS1ub3RpY2U9XCIxXCJdJyApLnRvZ2dsZSggaXNfY3VzdG9tICk7XG5cblx0XHRpZiAoICEgJHRhcmdldHMubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdCR0YXJnZXRzXG5cdFx0XHQucmVtb3ZlQ2xhc3MoICd3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfY3VzdG9tJyApXG5cdFx0XHQuZWFjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHR2YXIgc3R5bGVfb2JqID0gdGhpcy5zdHlsZTtcblxuXHRcdFx0XHQkLmVhY2goIGNzc192YXJfbmFtZXMsIGZ1bmN0aW9uICggaW5kZXgsIHZhcl9uYW1lICkge1xuXHRcdFx0XHRcdHN0eWxlX29iai5yZW1vdmVQcm9wZXJ0eSggdmFyX25hbWUgKTtcblx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdCQuZWFjaCggY3NzX3ZhcnMsIGZ1bmN0aW9uICggdmFyX25hbWUsIHZhbHVlICkge1xuXHRcdFx0XHRcdGlmICggJycgIT09IFN0cmluZyggdmFsdWUgfHwgJycgKSApIHtcblx0XHRcdFx0XHRcdHN0eWxlX29iai5zZXRQcm9wZXJ0eSggdmFyX25hbWUsIHZhbHVlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9ICk7XG5cblx0XHRpZiAoIGlzX2N1c3RvbSApIHtcblx0XHRcdCR0YXJnZXRzLmZpbHRlciggJy53cGJjX2NvbnRhaW5lci53cGJjX2Zvcm0sIC53cGJjX2JmYl9mb3JtJyApLmFkZENsYXNzKCAnd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX2N1c3RvbScgKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiByZXNvbHZlX2Zvcm1fYXBwZWFyYW5jZSgpIHtcblx0XHR2YXIgcHJlc2V0ID0gJCggJyNib29raW5nX2Zvcm1fYXBwZWFyYW5jZV9wcmVzZXQnICkudmFsKCkgfHwgJ2JvcmRlcmVkJztcblxuXHRcdGlmICggJ2N1c3RvbScgPT09IHByZXNldCApIHtcblx0XHRcdHJldHVybiBnZXRfZm9ybV9hcHBlYXJhbmNlX3ByZXNldHMoKS5ib3JkZXJlZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gZ2V0X2Zvcm1fYXBwZWFyYW5jZV9wcmVzZXRfZm9yX3RoZW1lKCBwcmVzZXQgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGFwcGx5X2Zvcm1fYXBwZWFyYW5jZSgpIHtcblx0XHRhcHBseV9mb3JtX3N0eWxlX3RvX3ByZXZpZXcoKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGFwcGx5X2NhbGVuZGFyX3NraW4oKSB7XG5cdFx0dmFyICRzZWxlY3QgPSAkKCAnW2RhdGEtd3BiYy10aGVtZS1jYWxlbmRhci1za2luPVwiMVwiXScgKTtcblx0XHR2YXIgdmFsdWUgPSAkc2VsZWN0LmZpbmQoICdvcHRpb246c2VsZWN0ZWQnICkuYXR0ciggJ2RhdGEtd3BiYy1jYWxlbmRhci1za2luLXVybCcgKSB8fCAkc2VsZWN0LnZhbCgpIHx8ICcnO1xuXHRcdHZhciBza2luX3VybCA9IHZhbHVlID8gbWFrZV9hc3NldF91cmwoIHZhbHVlICkgOiAnJztcblxuXHRcdGlmICggc2tpbl91cmwgJiYgdHlwZW9mIHcud3BiY19fY2FsZW5kYXJfX2NoYW5nZV9za2luID09PSAnZnVuY3Rpb24nICYmICQoICcjd3BiYy1jYWxlbmRhci1za2luLWNzcycgKS5sZW5ndGggKSB7XG5cdFx0XHR3LndwYmNfX2NhbGVuZGFyX19jaGFuZ2Vfc2tpbiggc2tpbl91cmwgKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBhcHBseV90aW1lX3NraW4oKSB7XG5cdFx0dmFyIHZhbHVlID0gJCggJ1tkYXRhLXdwYmMtdGhlbWUtdGltZS1za2luPVwiMVwiXScgKS52YWwoKSB8fCAnJztcblx0XHR2YXIgc2tpbl91cmwgPSB2YWx1ZSA/IG1ha2VfYXNzZXRfdXJsKCB2YWx1ZSApIDogJyc7XG5cblx0XHRpZiAoIHNraW5fdXJsICYmIHR5cGVvZiB3LndwYmNfX2Nzc19fY2hhbmdlX3NraW4gPT09ICdmdW5jdGlvbicgJiYgJCggJyN3cGJjLXRpbWVfcGlja2VyLXNraW4tY3NzJyApLmxlbmd0aCApIHtcblx0XHRcdHcud3BiY19fY3NzX19jaGFuZ2Vfc2tpbiggc2tpbl91cmwsICd3cGJjLXRpbWVfcGlja2VyLXNraW4tY3NzJyApO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHNlbGVjdF9pZl9vcHRpb25fZXhpc3RzKCAkc2VsZWN0LCB2YWx1ZSApIHtcblx0XHR2YXIgJG9wdGlvbjtcblxuXHRcdGlmICggISAkc2VsZWN0Lmxlbmd0aCB8fCAhIHZhbHVlICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdCRvcHRpb24gPSAkc2VsZWN0LmZpbmQoICdvcHRpb25bdmFsdWU9XCInICsgdmFsdWUgKyAnXCJdJyApO1xuXHRcdGlmICggISAkb3B0aW9uLmxlbmd0aCApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoICRzZWxlY3QudmFsKCkgPT09IHZhbHVlICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdCRzZWxlY3QudmFsKCB2YWx1ZSApLnRyaWdnZXIoICdjaGFuZ2UnICk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRmdW5jdGlvbiBwYXJzZV9udW1iZXJfbGlzdCggdmFsdWUgKSB7XG5cdFx0aWYgKCBBcnJheS5pc0FycmF5KCB2YWx1ZSApICkge1xuXHRcdFx0cmV0dXJuICQubWFwKCB2YWx1ZSwgZnVuY3Rpb24gKCBpdGVtICkge1xuXHRcdFx0XHR2YXIgcGFyc2VkID0gcGFyc2VJbnQoIGl0ZW0sIDEwICk7XG5cdFx0XHRcdHJldHVybiBpc05hTiggcGFyc2VkICkgPyBudWxsIDogcGFyc2VkO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdHJldHVybiAkLm1hcCggU3RyaW5nKCB2YWx1ZSB8fCAnJyApLnNwbGl0KCAvXFxzKixcXHMqLyApLCBmdW5jdGlvbiAoIGl0ZW0gKSB7XG5cdFx0XHR2YXIgcGFyc2VkID0gcGFyc2VJbnQoIGl0ZW0sIDEwICk7XG5cdFx0XHRyZXR1cm4gKCAnJyA9PT0gaXRlbSB8fCBpc05hTiggcGFyc2VkICkgKSA/IG51bGwgOiBwYXJzZWQ7XG5cdFx0fSApO1xuXHR9XG5cblx0ZnVuY3Rpb24gc2V0X2NhbGVuZGFyX3BhcmFtKCByZXNvdXJjZV9pZCwga2V5LCB2YWx1ZSApIHtcblx0XHRpZiAoIHcuX3dwYmMgJiYgdHlwZW9mIHcuX3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdHcuX3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsIGtleSwgdmFsdWUgKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBhcHBseV9kYXlzX3NlbGVjdGlvbl90b19jYWxlbmRhciggcmVzb3VyY2VfaWQsIGRheXNfc2VsZWN0aW9uLCBzaG91bGRfcmVpbml0ICkge1xuXHRcdHZhciBkcyA9IGRheXNfc2VsZWN0aW9uIHx8IHt9O1xuXHRcdHZhciBmaXhlZF93ZWVrX2RheXM7XG5cdFx0dmFyIGR5bmFtaWNfc3BlY2lmaWM7XG5cdFx0dmFyIGR5bmFtaWNfd2Vla19kYXlzO1xuXG5cdFx0aWYgKCAhIHJlc291cmNlX2lkIHx8ICEgdy5fd3BiYyB8fCB0eXBlb2Ygdy5fd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlICE9PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGZpeGVkX3dlZWtfZGF5cyA9IHBhcnNlX251bWJlcl9saXN0KCBkcy5maXhlZF9fd2Vla19kYXlzX19zdGFydCApO1xuXHRcdGR5bmFtaWNfc3BlY2lmaWMgPSBwYXJzZV9udW1iZXJfbGlzdCggZHMuZHluYW1pY19fZGF5c19zcGVjaWZpYyApO1xuXHRcdGR5bmFtaWNfd2Vla19kYXlzID0gcGFyc2VfbnVtYmVyX2xpc3QoIGRzLmR5bmFtaWNfX3dlZWtfZGF5c19fc3RhcnQgKTtcblxuXHRcdHNldF9jYWxlbmRhcl9wYXJhbSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJywgU3RyaW5nKCBkcy5kYXlzX3NlbGVjdF9tb2RlIHx8ICdtdWx0aXBsZScgKSApO1xuXHRcdHNldF9jYWxlbmRhcl9wYXJhbSggcmVzb3VyY2VfaWQsICdmaXhlZF9fZGF5c19udW0nLCBwYXJzZUludCggZHMuZml4ZWRfX2RheXNfbnVtIHx8IDAsIDEwICkgKTtcblx0XHRzZXRfY2FsZW5kYXJfcGFyYW0oIHJlc291cmNlX2lkLCAnZml4ZWRfX3dlZWtfZGF5c19fc3RhcnQnLCBmaXhlZF93ZWVrX2RheXMubGVuZ3RoID8gZml4ZWRfd2Vla19kYXlzIDogWyAtMSBdICk7XG5cdFx0c2V0X2NhbGVuZGFyX3BhcmFtKCByZXNvdXJjZV9pZCwgJ2R5bmFtaWNfX2RheXNfbWluJywgcGFyc2VJbnQoIGRzLmR5bmFtaWNfX2RheXNfbWluIHx8IDAsIDEwICkgKTtcblx0XHRzZXRfY2FsZW5kYXJfcGFyYW0oIHJlc291cmNlX2lkLCAnZHluYW1pY19fZGF5c19tYXgnLCBwYXJzZUludCggZHMuZHluYW1pY19fZGF5c19tYXggfHwgMCwgMTAgKSApO1xuXHRcdHNldF9jYWxlbmRhcl9wYXJhbSggcmVzb3VyY2VfaWQsICdkeW5hbWljX19kYXlzX3NwZWNpZmljJywgZHluYW1pY19zcGVjaWZpYyApO1xuXHRcdHNldF9jYWxlbmRhcl9wYXJhbSggcmVzb3VyY2VfaWQsICdkeW5hbWljX193ZWVrX2RheXNfX3N0YXJ0JywgZHluYW1pY193ZWVrX2RheXMubGVuZ3RoID8gZHluYW1pY193ZWVrX2RheXMgOiBbIC0xIF0gKTtcblxuXHRcdGlmICggdHlwZW9mIHcud3BiY19fY29uZGl0aW9uc19fU0FWRV9JTklUSUFMX19kYXlzX3NlbGVjdGlvbl9wYXJhbXNfX2JtID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0dy53cGJjX19jb25kaXRpb25zX19TQVZFX0lOSVRJQUxfX2RheXNfc2VsZWN0aW9uX3BhcmFtc19fYm0oIHJlc291cmNlX2lkICk7XG5cdFx0fVxuXG5cdFx0aWYgKCBzaG91bGRfcmVpbml0ICYmIHR5cGVvZiB3LndwYmNfY2FsX19yZV9pbml0ID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0dy53cGJjX2NhbF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBlbnN1cmVfY2FsZW5kYXJfb25seV9kYXlzX3NlbGVjdGlvbigpIHtcblx0XHR2YXIgJHByZXZpZXcgPSAkKCAnW2RhdGEtd3BiYy10aGVtZS1wcmV2aWV3PVwiMVwiXScgKS5maXJzdCgpO1xuXHRcdHZhciBwcmV2aWV3X21vZGUgPSAkcHJldmlldy5hdHRyKCAnZGF0YS1wcmV2aWV3LW1vZGUnICkgfHwgJCggJyN3cGJjX3RoZW1lX3ByZXZpZXdfbW9kZScgKS52YWwoKSB8fCAnZm9ybSc7XG5cdFx0dmFyIHJlc291cmNlX2lkID0gcGFyc2VJbnQoICRwcmV2aWV3LmF0dHIoICdkYXRhLXJlc291cmNlLWlkJyApIHx8IDAsIDEwICk7XG5cdFx0dmFyIGV4cGVjdGVkID0gY2ZnLmRheXNfc2VsZWN0aW9uIHx8IHt9O1xuXHRcdHZhciBleHBlY3RlZF9tb2RlID0gU3RyaW5nKCBleHBlY3RlZC5kYXlzX3NlbGVjdF9tb2RlIHx8ICdtdWx0aXBsZScgKTtcblx0XHR2YXIgY3VycmVudF9tb2RlID0gbnVsbDtcblx0XHR2YXIgJGNhbGVuZGFyO1xuXHRcdHZhciBzaG91bGRfcmVpbml0ID0gZmFsc2U7XG5cblx0XHRpZiAoICdjYWxlbmRhcicgIT09IHByZXZpZXdfbW9kZSB8fCAhIHJlc291cmNlX2lkIHx8ICEgZXhwZWN0ZWRfbW9kZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoICEgdy5fd3BiYyB8fCB0eXBlb2Ygdy5fd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlICE9PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGN1cnJlbnRfbW9kZSA9IHcuX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApO1xuXHRcdGlmICggU3RyaW5nKCBjdXJyZW50X21vZGUgfHwgJycgKSA9PT0gZXhwZWN0ZWRfbW9kZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQkY2FsZW5kYXIgPSAkKCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKTtcblx0XHRzaG91bGRfcmVpbml0ID0gJGNhbGVuZGFyLmxlbmd0aCAmJiAkY2FsZW5kYXIuaGFzQ2xhc3MoICdoYXNEYXRlcGljaycgKTtcblxuXHRcdGFwcGx5X2RheXNfc2VsZWN0aW9uX3RvX2NhbGVuZGFyKCByZXNvdXJjZV9pZCwgZXhwZWN0ZWQsIHNob3VsZF9yZWluaXQgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGFwcGx5X3JlbGF0ZWRfc2tpbnNfZm9yX3RoZW1lKCB0aGVtZSApIHtcblx0XHR2YXIgY2FsZW5kYXJfc2tpbiA9IHRoZW1lID8gJy9jc3Mvc2tpbnMvMjRfOV9fZGFya18xLmNzcycgOiAnL2Nzcy9za2lucy8yNV81X19zcXVhcmVfMS5jc3MnO1xuXHRcdHZhciB0aW1lX3NraW4gPSAnL2Nzcy90aW1lX3BpY2tlcl9za2lucy9mb3JtX3N0eWxlLmNzcyc7XG5cblx0XHRzZWxlY3RfaWZfb3B0aW9uX2V4aXN0cyggJCggJ1tkYXRhLXdwYmMtdGhlbWUtY2FsZW5kYXItc2tpbj1cIjFcIl0nICksIGNhbGVuZGFyX3NraW4gKTtcblx0XHRzZWxlY3RfaWZfb3B0aW9uX2V4aXN0cyggJCggJ1tkYXRhLXdwYmMtdGhlbWUtdGltZS1za2luPVwiMVwiXScgKSwgdGltZV9za2luICk7XG5cdH1cblxuXHRmdW5jdGlvbiBwdWxzZV9wcmV2aWV3X21vZGVfY29udHJvbCgpIHtcblx0XHR2YXIgJGNvbnRyb2wgPSAkKCAnLndwYmNfdGhlbWVfY29udHJvbF9wcmV2aWV3X21vZGUnICkuZmlyc3QoKTtcblxuXHRcdHB1bHNlX2VsZW1lbnQoICRjb250cm9sICk7XG5cblx0XHRjbGVhclRpbWVvdXQoIHByZXZpZXdfbm90aWNlX3RpbWVyICk7XG5cdFx0cHJldmlld19ub3RpY2VfdGltZXIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHQkY29udHJvbC5yZW1vdmVDbGFzcyggJ3dwYmNfdGhlbWVfYXR0ZW50aW9uX3B1bHNlJyApO1xuXHRcdH0sIDIxMDAgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldF9wcmV2aWV3X25vdGljZV9tZXNzYWdlKCBub3RpY2VfdHlwZSApIHtcblx0XHR2YXIgaTE4biA9IGNmZy5pMThuIHx8IHt9O1xuXG5cdFx0aWYgKCAnZm9ybScgPT09IG5vdGljZV90eXBlICkge1xuXHRcdFx0cmV0dXJuIGkxOG4uZm9ybV9wcmV2aWV3X29wdGlvbl9ub3RpY2UgfHwgJ1RoaXMgb3B0aW9uIGlzIHZpc2libGUgaW4gdGhlIEJvb2tpbmcgZm9ybSBwcmV2aWV3LiBTd2l0Y2ggUHJldmlldyB0byBCb29raW5nIGZvcm0gdG8gaW5zcGVjdCBpdC4nO1xuXHRcdH1cblxuXHRcdHJldHVybiAnJztcblx0fVxuXG5cdGZ1bmN0aW9uIG1heWJlX3Nob3dfcHJldmlld19ub3RpY2UoICRzb3VyY2UgKSB7XG5cdFx0dmFyIG5vdGljZV90eXBlID0gJHNvdXJjZS5hdHRyKCAnZGF0YS13cGJjLXRoZW1lLXByZXZpZXctbm90aWNlJyApIHx8ICcnO1xuXHRcdHZhciBwcmV2aWV3X21vZGUgPSAkKCAnI3dwYmNfdGhlbWVfcHJldmlld19tb2RlJyApLnZhbCgpIHx8ICdmb3JtJztcblx0XHR2YXIgbWVzc2FnZSA9IGdldF9wcmV2aWV3X25vdGljZV9tZXNzYWdlKCBub3RpY2VfdHlwZSApO1xuXHRcdHZhciAkY29udHJvbCA9ICQoICcud3BiY190aGVtZV9jb250cm9sX3ByZXZpZXdfbW9kZScgKS5maXJzdCgpO1xuXG5cdFx0aWYgKCAhIG1lc3NhZ2UgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCAnZm9ybScgPT09IG5vdGljZV90eXBlICYmICdjYWxlbmRhcicgIT09IHByZXZpZXdfbW9kZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoICdmb3JtJyA9PT0gbm90aWNlX3R5cGUgKSB7XG5cdFx0XHRwdWxzZV9wcmV2aWV3X21vZGVfY29udHJvbCgpO1xuXHRcdFx0c2hvd19oaWdobGlnaHRlZF9ub3RpY2UoIG1lc3NhZ2UsICd3YXJuaW5nJywgOTAwMCApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHNob3dfaGlnaGxpZ2h0ZWRfbm90aWNlKCBtZXNzYWdlLCAnd2FybmluZycsIDkwMDAsICRjb250cm9sICk7XG5cdH1cblxuXHRmdW5jdGlvbiBzaG93X2NhbGVuZGFyX29ubHlfdGhlbWVfbm90aWNlKCkge1xuXHRcdHZhciBwcmV2aWV3X21vZGUgPSAkKCAnI3dwYmNfdGhlbWVfcHJldmlld19tb2RlJyApLnZhbCgpIHx8ICdmb3JtJztcblxuXHRcdGlmICggJ2NhbGVuZGFyJyAhPT0gcHJldmlld19tb2RlICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHB1bHNlX3ByZXZpZXdfbW9kZV9jb250cm9sKCk7XG5cdFx0c2hvd19oaWdobGlnaHRlZF9ub3RpY2UoXG5cdFx0XHRjZmcuaTE4biAmJiBjZmcuaTE4bi5jYWxlbmRhcl9vbmx5X3RoZW1lX25vdGljZSA/IGNmZy5pMThuLmNhbGVuZGFyX29ubHlfdGhlbWVfbm90aWNlIDogJ1ByZXZpZXcgaXMgc2V0IHRvIENhbGVuZGFyIG9ubHkuIFN3aXRjaCBQcmV2aWV3IHRvIEJvb2tpbmcgZm9ybSB0byBpbnNwZWN0IHRoZSBmb3JtIHRoZW1lLicsXG5cdFx0XHQnd2FybmluZycsXG5cdFx0XHQ5MDAwXG5cdFx0KTtcblx0fVxuXG5cdGZ1bmN0aW9uIHN5bmNfdGltZV9waWNrZXJfcHJldmlldygpIHtcblx0XHR2YXIgaXNfZW5hYmxlZCA9IGdldF9mb3JtKCkuZmluZCggJ1tuYW1lPVwiYm9va2luZ190aW1lc2xvdF9waWNrZXJcIl0nICkucHJvcCggJ2NoZWNrZWQnICk7XG5cdFx0dmFyICRwcmV2aWV3ID0gJCggJ1tkYXRhLXdwYmMtdGhlbWUtcHJldmlldz1cIjFcIl0nICk7XG5cdFx0dmFyIHRpbWVfc2VsZWN0b3JzID0gJ3NlbGVjdFtuYW1lXj1cInJhbmdldGltZVwiXSwgc2VsZWN0W25hbWVePVwic3RhcnR0aW1lXCJdLCBzZWxlY3RbbmFtZV49XCJlbmR0aW1lXCJdLCBzZWxlY3RbbmFtZV49XCJkdXJhdGlvbnRpbWVcIl0nO1xuXG5cdFx0aWYgKCB3Ll93cGJjICYmIHR5cGVvZiB3Ll93cGJjLnNldF9vdGhlcl9wYXJhbSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdHcuX3dwYmMuc2V0X290aGVyX3BhcmFtKCAnaXNfZW5hYmxlZF9ib29raW5nX3RpbWVzbG90X3BpY2tlcicsICEhIGlzX2VuYWJsZWQgKTtcblx0XHR9XG5cblx0XHRpZiAoIGlzX2VuYWJsZWQgKSB7XG5cdFx0XHRpZiAoIHcuX3dwYmMgJiYgdHlwZW9mIHcud3BiY19ob29rX19pbml0X3RpbWVzZWxlY3RvciA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0dy53cGJjX2hvb2tfX2luaXRfdGltZXNlbGVjdG9yKCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0JHByZXZpZXcuZmluZCggJy53cGJjX3RpbWVzX3NlbGVjdG9yJyApLnJlbW92ZSgpO1xuXHRcdCRwcmV2aWV3LmZpbmQoIHRpbWVfc2VsZWN0b3JzICkuc2hvdygpO1xuXHR9XG5cblx0ZnVuY3Rpb24gcmVmcmVzaF9wcmV2aWV3X21vZGVfY29udHJvbHMoKSB7XG5cdFx0dmFyIHByZXZpZXdfbW9kZSA9ICQoICcjd3BiY190aGVtZV9wcmV2aWV3X21vZGUnICkudmFsKCkgfHwgJ2Zvcm0nO1xuXHRcdCQoICdbZGF0YS13cGJjLXRoZW1lLWZvcm0tY29udHJvbD1cIjFcIl0nICkudG9nZ2xlQ2xhc3MoICdpcy12aXNpYmxlJywgJ2Zvcm0nID09PSBwcmV2aWV3X21vZGUgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHNldF9jYWxlbmRhcl9sb2FkaW5nKCBpc19sb2FkaW5nICkge1xuXHRcdHZhciAkcGFuZWwgPSAkKCAnW2RhdGEtd3BiYy10aGVtZS1jYWxlbmRhci1wYW5lbD1cIjFcIl0nICk7XG5cblx0XHQkcGFuZWwudG9nZ2xlQ2xhc3MoICdpcy1sb2FkaW5nJywgISEgaXNfbG9hZGluZyApO1xuXHRcdCRwYW5lbC5maW5kKCAnLndwYmNfdGhlbWVfY2FsZW5kYXJfbG9hZGluZycgKS5yZW1vdmUoKTtcblxuXHRcdGlmICggaXNfbG9hZGluZyApIHtcblx0XHRcdCRwYW5lbC5hcHBlbmQoXG5cdFx0XHRcdCc8ZGl2IGNsYXNzPVwid3BiY19jYWxlbmRhcl9sb2FkaW5nIHdwYmNfdGhlbWVfY2FsZW5kYXJfbG9hZGluZ1wiPicgK1xuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIndwYmNfaWNuX2F1dG9yZW5ldyB3cGJjX2FuaW1hdGlvbl9zcGluXCI+PC9zcGFuPiZuYnNwOycgK1xuXHRcdFx0XHRcdHRyaW1fdGV4dCggY2ZnLmkxOG4gJiYgY2ZnLmkxOG4ubG9hZGluZyA/IGNmZy5pMThuLmxvYWRpbmcgOiAnTG9hZGluZycgKSArXG5cdFx0XHRcdCc8L2Rpdj4nXG5cdFx0XHQpO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHJlZnJlc2hfcHJldmlldygpIHtcblx0XHR2YXIgZGF0YSA9IGNvbGxlY3RfcGF5bG9hZCgpO1xuXG5cdFx0aWYgKCBwcmV2aWV3X2FqYXggJiYgcHJldmlld19hamF4LnJlYWR5U3RhdGUgIT09IDQgKSB7XG5cdFx0XHRwcmV2aWV3X2FqYXguYWJvcnQoKTtcblx0XHR9XG5cblx0XHRkYXRhLmFjdGlvbiA9IGNmZy5wcmV2aWV3X2FjdGlvbjtcblx0XHRkYXRhLm5vbmNlID0gY2ZnLm5vbmNlO1xuXG5cdFx0c2V0X2NhbGVuZGFyX2xvYWRpbmcoIHRydWUgKTtcblx0XHRwcmV2aWV3X2FqYXggPSAkLnBvc3QoIGNmZy5hamF4X3VybCwgZGF0YSApXG5cdFx0XHQuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdFx0aWYgKCByZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5odG1sICkge1xuXHRcdFx0XHRcdCQoICdbZGF0YS13cGJjLXRoZW1lLXByZXZpZXc9XCIxXCJdJyApLnJlcGxhY2VXaXRoKCByZXNwb25zZS5kYXRhLmh0bWwgKTtcblx0XHRcdFx0XHRpZiAoIHJlc3BvbnNlLmRhdGEuZGF5c19zZWxlY3Rpb24gKSB7XG5cdFx0XHRcdFx0XHRjZmcuZGF5c19zZWxlY3Rpb24gPSByZXNwb25zZS5kYXRhLmRheXNfc2VsZWN0aW9uO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRhcHBseV9mb3JtX3RoZW1lKCk7XG5cdFx0XHRcdFx0YXBwbHlfZm9ybV9hcHBlYXJhbmNlKCk7XG5cdFx0XHRcdFx0YXBwbHlfY2FsZW5kYXJfc2tpbigpO1xuXHRcdFx0XHRcdGFwcGx5X3RpbWVfc2tpbigpO1xuXHRcdFx0XHRcdGVuc3VyZV9jYWxlbmRhcl9vbmx5X2RheXNfc2VsZWN0aW9uKCk7XG5cdFx0XHRcdFx0c3luY190aW1lX3BpY2tlcl9wcmV2aWV3KCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0c2hvd19tZXNzYWdlKFxuXHRcdFx0XHRcdHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5tZXNzYWdlID8gcmVzcG9uc2UuZGF0YS5tZXNzYWdlIDogKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5wcmV2aWV3X2ZhaWxlZCA/IGNmZy5pMThuLnByZXZpZXdfZmFpbGVkIDogJ1VuYWJsZSB0byByZWZyZXNoIGNhbGVuZGFyIHByZXZpZXcuJyApLFxuXHRcdFx0XHRcdCdlcnJvcicsXG5cdFx0XHRcdFx0MTAwMDBcblx0XHRcdFx0KTtcblx0XHRcdH0gKVxuXHRcdFx0LmZhaWwoIGZ1bmN0aW9uICggeGhyLCB0ZXh0X3N0YXR1cyApIHtcblx0XHRcdFx0aWYgKCAnYWJvcnQnID09PSB0ZXh0X3N0YXR1cyApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0c2hvd19tZXNzYWdlKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5wcmV2aWV3X2ZhaWxlZCA/IGNmZy5pMThuLnByZXZpZXdfZmFpbGVkIDogJ1VuYWJsZSB0byByZWZyZXNoIGNhbGVuZGFyIHByZXZpZXcuJywgJ2Vycm9yJywgMTAwMDAgKTtcblx0XHRcdH0gKVxuXHRcdFx0LmFsd2F5cyggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRzZXRfY2FsZW5kYXJfbG9hZGluZyggZmFsc2UgKTtcblx0XHRcdH0gKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHNjaGVkdWxlX3ByZXZpZXdfcmVmcmVzaCgpIHtcblx0XHRjbGVhclRpbWVvdXQoIHByZXZpZXdfdGltZXIgKTtcblx0XHRwcmV2aWV3X3RpbWVyID0gc2V0VGltZW91dCggcmVmcmVzaF9wcmV2aWV3LCAxODAgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHNhdmVfc2V0dGluZ3MoKSB7XG5cdFx0dmFyICRidXR0b24gPSAkKCAnW2RhdGEtd3BiYy10aGVtZS1zYXZlPVwiMVwiXScgKTtcblx0XHR2YXIgb3JpZ2luYWxfdGV4dCA9ICRidXR0b24uZGF0YSggJ3dwYmMtb3JpZ2luYWwtdGV4dCcgKTtcblx0XHR2YXIgZGF0YSA9IGNvbGxlY3RfcGF5bG9hZCgpO1xuXG5cdFx0aWYgKCAhIG9yaWdpbmFsX3RleHQgKSB7XG5cdFx0XHRvcmlnaW5hbF90ZXh0ID0gJGJ1dHRvbi5odG1sKCk7XG5cdFx0XHQkYnV0dG9uLmRhdGEoICd3cGJjLW9yaWdpbmFsLXRleHQnLCBvcmlnaW5hbF90ZXh0ICk7XG5cdFx0fVxuXG5cdFx0ZGF0YS5hY3Rpb24gPSBjZmcuYWN0aW9uO1xuXHRcdGRhdGEubm9uY2UgPSBjZmcubm9uY2U7XG5cblx0XHQkYnV0dG9uLmFkZENsYXNzKCAnZGlzYWJsZWQnICkuYXR0ciggJ2FyaWEtZGlzYWJsZWQnLCAndHJ1ZScgKTtcblx0XHQkYnV0dG9uLmZpbmQoICcuaW4tYnV0dG9uLXRleHQnICkuaHRtbCggJyZuYnNwOyZuYnNwOycgKyB0cmltX3RleHQoIGNmZy5pMThuICYmIGNmZy5pMThuLnNhdmluZyA/IGNmZy5pMThuLnNhdmluZyA6ICdTYXZpbmcnICkgKyAnLi4uJyApO1xuXG5cdFx0JC5wb3N0KCBjZmcuYWpheF91cmwsIGRhdGEgKVxuXHRcdFx0LmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRcdGlmICggcmVzcG9uc2UgJiYgcmVzcG9uc2Uuc3VjY2VzcyApIHtcblx0XHRcdFx0XHRzaG93X21lc3NhZ2UoIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5tZXNzYWdlID8gcmVzcG9uc2UuZGF0YS5tZXNzYWdlIDogKCBjZmcuaTE4biAmJiBjZmcuaTE4bi5zYXZlZCA/IGNmZy5pMThuLnNhdmVkIDogJ1NhdmVkJyApLCAnc3VjY2VzcycsIDMwMDAgKTtcblx0XHRcdFx0XHRjZmcuc2V0dGluZ3MgPSByZXNwb25zZS5kYXRhICYmIHJlc3BvbnNlLmRhdGEuc2V0dGluZ3MgPyByZXNwb25zZS5kYXRhLnNldHRpbmdzIDogY2ZnLnNldHRpbmdzO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHNob3dfbWVzc2FnZShcblx0XHRcdFx0XHRyZXNwb25zZSAmJiByZXNwb25zZS5kYXRhICYmIHJlc3BvbnNlLmRhdGEubWVzc2FnZSA/IHJlc3BvbnNlLmRhdGEubWVzc2FnZSA6ICggY2ZnLmkxOG4gJiYgY2ZnLmkxOG4uc2F2ZV9mYWlsZWQgPyBjZmcuaTE4bi5zYXZlX2ZhaWxlZCA6ICdVbmFibGUgdG8gc2F2ZSBhcHBlYXJhbmNlIHNldHRpbmdzLicgKSxcblx0XHRcdFx0XHQnZXJyb3InLFxuXHRcdFx0XHRcdDEwMDAwXG5cdFx0XHRcdCk7XG5cdFx0XHR9IClcblx0XHRcdC5mYWlsKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHNob3dfbWVzc2FnZSggY2ZnLmkxOG4gJiYgY2ZnLmkxOG4uc2F2ZV9mYWlsZWQgPyBjZmcuaTE4bi5zYXZlX2ZhaWxlZCA6ICdVbmFibGUgdG8gc2F2ZSBhcHBlYXJhbmNlIHNldHRpbmdzLicsICdlcnJvcicsIDEwMDAwICk7XG5cdFx0XHR9IClcblx0XHRcdC5hbHdheXMoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0JGJ1dHRvbi5yZW1vdmVDbGFzcyggJ2Rpc2FibGVkJyApLnJlbW92ZUF0dHIoICdhcmlhLWRpc2FibGVkJyApLmh0bWwoIG9yaWdpbmFsX3RleHQgKTtcblx0XHRcdH0gKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGJpbmRfZXZlbnRzKCkge1xuXHRcdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY190aGVtZV9yaWdodGJhcl90YWJzIFtyb2xlPVwidGFiXCJdJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRzd2l0Y2hfcGFuZWwoICQoIHRoaXMgKSApO1xuXHRcdH0gKTtcblxuXHRcdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY190aGVtZV9wcmVtaXVtX2Rpc21pc3MgYScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHR9ICk7XG5cblx0XHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnLndwYmNfdGhlbWVfcmlnaHRiYXJfcGFuZWxzIC53cGJjX3VpX19jb2xsYXBzaWJsZV9ncm91cCA+IC5ncm91cF9faGVhZGVyJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR0b2dnbGVfZ3JvdXAoICQoIHRoaXMgKSApO1xuXHRcdH0gKTtcblxuXHRcdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICdbZGF0YS13cGJjLXRoZW1lLXNhdmU9XCIxXCJdJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRpZiAoICEgJCggdGhpcyApLmhhc0NsYXNzKCAnZGlzYWJsZWQnICkgKSB7XG5cdFx0XHRcdHNhdmVfc2V0dGluZ3MoKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHQkKCBkb2N1bWVudCApLm9uKCAnc3VibWl0JywgJ1tkYXRhLXdwYmMtdGhlbWUtc2V0dGluZ3MtZm9ybT1cIjFcIl0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9ICk7XG5cblx0XHQkKCBkb2N1bWVudCApLm9uKCAnY2hhbmdlJywgJ1tuYW1lPVwiYm9va2luZ19mb3JtX3RoZW1lXCJdJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0YXBwbHlfZm9ybV90aGVtZSgpO1xuXHRcdFx0YXBwbHlfcmVsYXRlZF9za2luc19mb3JfdGhlbWUoICQoIHRoaXMgKS52YWwoKSB8fCAnJyApO1xuXHRcdFx0c2hvd19jYWxlbmRhcl9vbmx5X3RoZW1lX25vdGljZSgpO1xuXHRcdH0gKTtcblxuXHRcdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnW25hbWU9XCJib29raW5nX2Zvcm1fc3R5bGVcIl0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRzeW5jX2Zvcm1fc3R5bGVfY2hvaWNlKCk7XG5cdFx0XHRhcHBseV9mb3JtX3RoZW1lKCk7XG5cdFx0XHRhcHBseV9mb3JtX2FwcGVhcmFuY2UoKTtcblx0XHRcdGFwcGx5X3JlbGF0ZWRfc2tpbnNfZm9yX3RoZW1lKCAkKCAnI2Jvb2tpbmdfZm9ybV90aGVtZScgKS52YWwoKSB8fCAnJyApO1xuXHRcdFx0c2hvd19jYWxlbmRhcl9vbmx5X3RoZW1lX25vdGljZSgpO1xuXHRcdFx0c2NoZWR1bGVfcHJldmlld19yZWZyZXNoKCk7XG5cdFx0fSApO1xuXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ2lucHV0IGNoYW5nZScsICdbZGF0YS13cGJjLXRoZW1lLWFwcGVhcmFuY2UtY29udHJvbF0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHQvLyBDb2xvcmlzIGVtaXRzIGNvbnRpbnVvdXMgaW5wdXQgZXZlbnRzLiBBY2NlbnQgYW5kIGFwcGVhcmFuY2UgdmFsdWVzIGFyZVxuXHRcdFx0Ly8gQ1NTLW9ubHksIHNvIHVwZGF0ZSB0aGUgZXhpc3RpbmcgcHJldmlldyB3aXRob3V0IHJlYnVpbGRpbmcgaXQgYnkgQUpBWC5cblx0XHRcdGFwcGx5X2Zvcm1fYXBwZWFyYW5jZSgpO1xuXHRcdH0gKTtcblxuXHRcdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnW2RhdGEtd3BiYy10aGVtZS1hY2NlbnQtdG9nZ2xlPVwiMVwiXScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdCQoICdbZGF0YS13cGJjLXRoZW1lLWFjY2VudC1kZXBlbmRlbnQ9XCIxXCJdJyApLnRvZ2dsZSggJCggdGhpcyApLnByb3AoICdjaGVja2VkJyApICk7XG5cdFx0XHRhcHBseV9mb3JtX2FwcGVhcmFuY2UoKTtcblx0XHR9ICk7XG5cblx0XHQkKCBkb2N1bWVudCApLm9uKCAnY2hhbmdlJywgJ1tkYXRhLXdwYmMtdGhlbWUtY2FsZW5kYXItc2tpbj1cIjFcIl0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRhcHBseV9jYWxlbmRhcl9za2luKCk7XG5cdFx0fSApO1xuXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICdbZGF0YS13cGJjLXRoZW1lLXRpbWUtc2tpbj1cIjFcIl0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRhcHBseV90aW1lX3NraW4oKTtcblx0XHR9ICk7XG5cblx0XHQkKCBkb2N1bWVudCApLm9uKCAnY2hhbmdlJywgJ1tuYW1lPVwiYm9va2luZ190aW1lc2xvdF9waWNrZXJcIl0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRzeW5jX3RpbWVfcGlja2VyX3ByZXZpZXcoKTtcblx0XHRcdHNjaGVkdWxlX3ByZXZpZXdfcmVmcmVzaCgpO1xuXHRcdH0gKTtcblxuXHRcdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnW2RhdGEtd3BiYy10aGVtZS1wcmV2aWV3LW5vdGljZV0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRtYXliZV9zaG93X3ByZXZpZXdfbm90aWNlKCAkKCB0aGlzICkgKTtcblx0XHR9ICk7XG5cblx0XHQkKCBkb2N1bWVudCApLm9uKCAnY2hhbmdlJywgJyN3cGJjX3RoZW1lX3Jlc291cmNlX2lkLCAjd3BiY190aGVtZV9tb250aHNfY291bnQsICN3cGJjX3RoZW1lX2N1c3RvbV9mb3JtJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0c2NoZWR1bGVfcHJldmlld19yZWZyZXNoKCk7XG5cdFx0fSApO1xuXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICcjd3BiY190aGVtZV9wcmV2aWV3X21vZGUnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRyZWZyZXNoX3ByZXZpZXdfbW9kZV9jb250cm9scygpO1xuXHRcdFx0c2NoZWR1bGVfcHJldmlld19yZWZyZXNoKCk7XG5cdFx0fSApO1xuXHR9XG5cblx0JCggZnVuY3Rpb24gKCkge1xuXHRcdGlmICggISAkKCAnW2RhdGEtd3BiYy10aGVtZS1wYWdlPVwiMVwiXScgKS5sZW5ndGggKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0YmluZF9ldmVudHMoKTtcblx0XHRpZiAoIHcuQ29sb3JpcyApIHtcblx0XHRcdHcuQ29sb3Jpcygge1xuXHRcdFx0XHRlbDogJy53cGJjX3RoZW1lX2NvbG9yaXMnLFxuXHRcdFx0XHRhbHBoYTogZmFsc2UsXG5cdFx0XHRcdGZvcm1hdDogJ2hleCcsXG5cdFx0XHRcdHRoZW1lTW9kZTogJ2F1dG8nXG5cdFx0XHR9ICk7XG5cdFx0fVxuXHRcdHJlZnJlc2hfcHJldmlld19tb2RlX2NvbnRyb2xzKCk7XG5cdFx0YXBwbHlfZm9ybV90aGVtZSgpO1xuXHRcdGFwcGx5X2Zvcm1fYXBwZWFyYW5jZSgpO1xuXHRcdGVuc3VyZV9jYWxlbmRhcl9vbmx5X2RheXNfc2VsZWN0aW9uKCk7XG5cdFx0c3luY190aW1lX3BpY2tlcl9wcmV2aWV3KCk7XG5cdH0gKTtcbn0oIGpRdWVyeSwgd2luZG93ICkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDRSxXQUFXQSxDQUFDLEVBQUVDLENBQUMsRUFBRztFQUNuQixZQUFZOztFQUVaLElBQUlDLEdBQUcsR0FBR0QsQ0FBQyxDQUFDRSx5QkFBeUIsSUFBSSxDQUFDLENBQUM7RUFDM0MsSUFBSUMsbUNBQW1DLEdBQUdDLE1BQU0sQ0FBRUgsR0FBRyxDQUFDSSxvQkFBb0IsSUFBSUosR0FBRyxDQUFDSSxvQkFBb0IsQ0FBQ0MseUJBQXlCLElBQUksRUFBRyxDQUFDLENBQUNDLElBQUksQ0FBQyxDQUFDOztFQUUvSTtFQUNBLElBQUlDLHlCQUF5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
