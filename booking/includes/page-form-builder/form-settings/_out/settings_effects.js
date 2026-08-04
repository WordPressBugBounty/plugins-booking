"use strict";

/**
 * Applies effects in Canvas, after changing some settings in the right sidebar in BFB.
 *
 * @file ../includes/page-form-builder/form-settings/_src/settings_effects.js
 */
(function (w, d) {
  'use strict';

  const Effects = w.WPBC_BFB_Settings_Effects = w.WPBC_BFB_Settings_Effects || {};
  const map = Effects.map = Effects.map || Object.create(null);
  Effects.register = function (key, fn) {
    if (key && typeof fn === 'function') {
      map[String(key)] = fn;
    }
  };
  function get_canvas_root() {
    return d.querySelector('#wpbc_bfb__pages_container') || d.querySelector('.wpbc_bfb__panel--preview') || d.getElementById('wpbc_bfb__preview') || d.body || d.documentElement;
  }
  Effects.apply_one = function (key, value, ctx) {
    const fn = map[String(key)];
    if (!fn) {
      return;
    }
    try {
      fn(value, Object.assign({
        key,
        value,
        canvas: get_canvas_root()
      }, ctx || {}));
    } catch (e) {
      // keep silent in production if you prefer
      console.error('WPBC Effects error:', key, e);
    }
  };
  Effects.apply_all = function (options, ctx) {
    if (!options || typeof options !== 'object') {
      return;
    }
    Object.keys(options).forEach(function (k) {
      Effects.apply_one(k, options[k], Object.assign({
        options: options
      }, ctx || {}));
    });
  };

  /**
   * Normalize settings pack to the minimum required shape:
   * { options: {}, css_vars: {} }
   *
   * @param {*} pack
   * @return {{options:Object, css_vars:Object, bfb_options?:Object}|null}
   */
  Effects.normalize_pack = function (pack) {
    if (pack === null || typeof pack === 'undefined' || pack === '') {
      return null;
    }

    // Parse JSON string if needed.
    if (typeof pack === 'string') {
      try {
        pack = JSON.parse(pack);
      } catch (_e) {
        return null;
      }
    }
    if (!pack || typeof pack !== 'object') {
      return null;
    }

    // If user passed just {key:value} options map, wrap it.
    const has_shape = Object.prototype.hasOwnProperty.call(pack, 'options') || Object.prototype.hasOwnProperty.call(pack, 'css_vars') || Object.prototype.hasOwnProperty.call(pack, 'bfb_options');
    if (!has_shape) {
      pack = {
        options: pack,
        css_vars: {}
      };
    }
    if (!pack.options || typeof pack.options !== 'object') {
      pack.options = {};
    }
    if (!pack.css_vars || typeof pack.css_vars !== 'object') {
      pack.css_vars = {};
    }

    // bfb_options is optional; keep if valid.
    if (pack.bfb_options && typeof pack.bfb_options !== 'object') {
      delete pack.bfb_options;
    }
    return pack;
  };

  /**
   * Re-apply settings effects after a canvas rebuild / structure load.
   *
   * This is needed because structure loading can replace DOM nodes that effects target.
   *
   * @param {*} settings_pack  string|object settings_json pack (or plain options map)
   * @param {Object} [ctx]
   */
  Effects.reapply_after_canvas = function (settings_pack, ctx) {
    const pack = Effects.normalize_pack(settings_pack);
    if (!pack) {
      return;
    }

    // Apply immediately (best effort).
    Effects.apply_all(pack.options, Object.assign({
      source: 'reapply_after_canvas'
    }, ctx || {}));
    wpbc_bfb_global_form_style__apply(null, Object.assign({
      source: 'reapply_after_canvas'
    }, ctx || {}));

    // Some modules/hydration may run shortly after; do one more pass.
    setTimeout(function () {
      Effects.apply_all(pack.options, Object.assign({
        source: 'reapply_after_canvas_delayed'
      }, ctx || {}));
      wpbc_bfb_global_form_style__apply(null, Object.assign({
        source: 'reapply_after_canvas_delayed'
      }, ctx || {}));
    }, 60);
  };

  // 1) Apply from AJAX load.
  d.addEventListener('wpbc:bfb:form_settings:apply', function (e) {
    const pack = e && e.detail ? e.detail.settings : null;
    if (pack && pack.options) {
      Effects.apply_all(pack.options, {
        source: 'apply'
      });
    }
    wpbc_bfb_global_form_style__apply(null, {
      source: 'apply-global-style'
    });
  });

  // 2) Apply live from UI change (delegated).
  function css_escape(value) {
    const v = String(value == null ? '' : value);
    if (w.CSS && typeof w.CSS.escape === 'function') {
      return w.CSS.escape(v);
    }
    return v.replace(/[^a-zA-Z0-9_\-]/g, '\\$&');
  }
  function find_fs_root(el) {
    if (!el || !el.closest) {
      return null;
    }

    // 1) Direct: element or ancestor carries FS key (input/select/textarea writer, radio wrapper, etc.)
    const direct = el.closest('[data-wpbc-bfb-fs-key]');
    if (direct) {
      return direct;
    }

    // 2) Length: event came from number/unit/range inside .wpbc_slider_len_group
    const len_group = el.closest('.wpbc_slider_len_group');
    if (len_group) {
      return len_group.querySelector('input[data-wpbc_slider_len_writer][data-wpbc-bfb-fs-key]') || len_group.querySelector('input[data-wpbc-bfb-fs-type="length"][data-wpbc-bfb-fs-key]') || null;
    }

    // 3) Spacing: event came from vertical/horizontal number inside .wpbc_spacing_group.
    const spacing_group = el.closest('.wpbc_spacing_group');
    if (spacing_group) {
      return spacing_group.querySelector('input[data-wpbc_spacing_writer][data-wpbc-bfb-fs-key]') || spacing_group.querySelector('input[data-wpbc-bfb-fs-type="spacing"][data-wpbc-bfb-fs-key]') || null;
    }

    // 4) Range: event came from range input inside .wpbc_slider_range_group
    const range_group = el.closest('.wpbc_slider_range_group');
    if (range_group) {
      return range_group.querySelector('input[data-wpbc_slider_range_writer][data-wpbc-bfb-fs-key]') || range_group.querySelector('input[data-wpbc_slider_range_writer]') || null;
    }
    return null;
  }
  function read_value_from_fs_root(fs_root, original_target) {
    if (!fs_root) {
      return '';
    }
    const fs_type = String(fs_root.getAttribute('data-wpbc-bfb-fs-type') || '');

    // RADIO: read checked within wrapper.
    if (fs_type === 'radio') {
      const control_id = fs_root.getAttribute('data-wpbc-bfb-fs-controlid') || '';
      const selector = control_id ? 'input[type="radio"][name="' + css_escape(control_id) + '"]:checked' : 'input[type="radio"]:checked';
      const checked = fs_root.querySelector(selector);
      return checked ? String(checked.value || '') : '';
    }
    if (fs_type === 'spacing') {
      const group = original_target && original_target.closest ? original_target.closest('.wpbc_spacing_group') : fs_root.closest('.wpbc_spacing_group');
      const vertical_input = group ? group.querySelector('input[data-wpbc_spacing_vertical]') : null;
      const horizontal_input = group ? group.querySelector('input[data-wpbc_spacing_horizontal]') : null;
      const writer = group ? group.querySelector('input[data-wpbc_spacing_writer]') : null;
      const vertical = vertical_input ? String(vertical_input.value || '0') : '0';
      const horizontal = horizontal_input ? String(horizontal_input.value || vertical) : vertical;
      const combined = wpbc_bfb_form_appearance__normalize_spacing_numbers(vertical, horizontal);
      if (writer) {
        writer.value = combined;
      }
      return combined;
    }

    // CHECKBOX / TOGGLE
    if (original_target && original_target.type === 'checkbox' || fs_root.type === 'checkbox') {
      const cb = original_target && original_target.type === 'checkbox' ? original_target : fs_root;
      return cb.checked ? 'On' : 'Off';
    }

    // DEFAULT: writer/input/textarea/select
    if (fs_root.value != null) {
      return String(fs_root.value);
    }
    if (original_target && original_target.value != null) {
      return String(original_target.value);
    }
    return '';
  }
  function apply_change_from_target(target, event_type, event_source) {
    if (!target) {
      return;
    }
    const fs_root = find_fs_root(target);
    if (!fs_root) {
      return;
    }

    // Normalize events so each control produces exactly one effect call.
    // - toggle/select/radio/checkbox => "change" only.
    // - everything else              => "input" only.
    const fs_type = String(fs_root.getAttribute('data-wpbc-bfb-fs-type') || '');
    const tag = String(target.tagName || '').toLowerCase();
    const type = String(target.type || '').toLowerCase();
    const use_change = fs_type === 'toggle' || fs_type === 'select' || fs_type === 'radio' || type === 'checkbox' || type === 'radio' || tag === 'select';
    if (use_change && event_type !== 'change') {
      return;
    }
    if (!use_change && event_type !== 'input') {
      return;
    }
    // -------------------------------------------------------------------------------------------

    const key = fs_root.getAttribute('data-wpbc-bfb-fs-key');
    if (!key) {
      return;
    }
    const scope = fs_root.getAttribute('data-wpbc-bfb-fs-scope') || '';
    const value = read_value_from_fs_root(fs_root, target);
    Effects.apply_one(key, value, {
      source: event_source || 'ui',
      scope: scope,
      control: target,
      fs_root: fs_root
    });
  }
  function is_coloris_control(target) {
    if (!target || !target.matches) {
      return false;
    }
    return target.matches('[data-wpbc-bfb-fs-type="color"], [data-inspector-type="color"], .wpbc_bfb_coloris');
  }
  function on_change(ev) {
    // Ignore generic synthetic events dispatched by code (apply/reapply, slider sync, etc.).
    // Coloris dispatches synthetic input events while the user picks a color, so allow those color controls through.
    if (ev && ev.isTrusted === false && !is_coloris_control(ev.target)) {
      return;
    }
    apply_change_from_target(ev && ev.target, ev && ev.type, ev && ev.isTrusted === false ? 'coloris' : 'ui');
  }
  d.addEventListener('input', on_change, false);
  d.addEventListener('change', on_change, false);
  function on_coloris_pick(ev) {
    const detail = ev && ev.detail ? ev.detail : {};
    const target = detail.currentEl || detail.el || detail.input || ev.target || null;
    if (!is_coloris_control(target)) {
      return;
    }
    if (detail.color && target.value !== detail.color) {
      target.value = detail.color;
    }
    apply_change_from_target(target, 'input', 'coloris');
  }
  d.addEventListener('coloris:pick', on_coloris_pick, false);
  d.addEventListener('wpbc:bfb:coloris:change', on_coloris_pick, false);
})(window, document);
function wpbc_bfb_form_appearance__get_presets() {
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
function wpbc_bfb_form_appearance__is_dark_theme(options) {
  options = options && typeof options === 'object' ? options : {};
  return 'wpbc_theme_dark_1' === String(options.booking_form_theme || '');
}
function wpbc_bfb_form_appearance__get_preset_for_options(style, options) {
  const presets = wpbc_bfb_form_appearance__get_presets();
  if (!wpbc_bfb_form_appearance__is_dark_theme(options)) {
    return presets[style] || presets.bordered;
  }
  if ('soft' === style) {
    return {
      background: '#1f2937',
      borderColor: '#334155',
      borderWidth: '3px',
      radius: '8px',
      padding: '20px',
      shadow: 'rgba(0, 0, 0, 0.24) 0px 4px 16px 0px'
    };
  }
  return presets[style] || presets.bordered;
}
function wpbc_bfb_form_appearance__sanitize_color(value, fallback) {
  const v = String(value == null ? '' : value).trim();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) {
    return v;
  }
  if (v === 'transparent') {
    return v;
  }
  return fallback;
}
function wpbc_bfb_form_appearance__sanitize_optional_color(value) {
  return wpbc_bfb_form_appearance__sanitize_color(value, '');
}

/**
 * Resolve an opaque accent color with the PHP-localized installation default.
 *
 * The Form Style effects live outside the registration IIFE, so the default is
 * deliberately read from the shared localized payload at the point of use.
 * Invalid requested and localized values return an empty string, allowing the
 * caller to skip the accent overlay without throwing or producing invalid CSS.
 *
 * @param {*} value Requested accent color.
 * @return {string} Valid three- or six-digit hexadecimal color, or an empty string.
 */
function wpbc_bfb_global_form_style__sanitize_accent_color(value) {
  const requested_color = String(value == null ? '' : value).trim();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(requested_color)) {
    return requested_color;
  }
  const settings_vars = window.wpbc_bfb_settings_vars && typeof window.wpbc_bfb_settings_vars === 'object' ? window.wpbc_bfb_settings_vars : {};
  const accent_defaults = settings_vars.form_accent_defaults && typeof settings_vars.form_accent_defaults === 'object' ? settings_vars.form_accent_defaults : {};
  const default_color = String(accent_defaults.booking_form_accent_color || '').trim();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(default_color) ? default_color : '';
}
function wpbc_bfb_form_appearance__sanitize_length(value, fallback) {
  const v = String(value == null ? '' : value).trim();
  if (/^\d+(?:\.\d+)?(?:px|rem|em|%)$/i.test(v)) {
    return v;
  }
  return fallback;
}
function wpbc_bfb_form_appearance__sanitize_spacing(value, fallback) {
  const v = String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  const parts = v ? v.split(' ') : [];
  if (parts.length < 1 || parts.length > 4) {
    return fallback;
  }
  for (let i = 0; i < parts.length; i++) {
    if (!/^\d+(?:\.\d+)?(?:px|rem|em|%)$/i.test(parts[i])) {
      return fallback;
    }
  }
  return parts.join(' ');
}
function wpbc_bfb_form_appearance__normalize_spacing_numbers(vertical, horizontal) {
  const v = String(vertical == null ? '' : vertical).trim();
  const h = String(horizontal == null ? '' : horizontal).trim();
  const vertical_num = /^\d+(?:\.\d+)?$/.test(v) ? v : '0';
  const horizontal_num = /^\d+(?:\.\d+)?$/.test(h) ? h : vertical_num;
  return vertical_num + 'px ' + horizontal_num + 'px';
}
function wpbc_bfb_form_appearance__collect_options(ctx, key, value) {
  let options = ctx && ctx.options && typeof ctx.options === 'object' ? Object.assign({}, ctx.options) : {};
  if (window.WPBC_BFB_FormSettings && typeof window.WPBC_BFB_FormSettings.collect === 'function') {
    options = Object.assign(window.WPBC_BFB_FormSettings.collect('form') || {}, options);
  }
  if (key) {
    options[String(key)] = value;
  }
  if (wpbc_bfb_form_appearance__is_custom_control_key(key)) {
    options.booking_form_container_style = 'custom';
    wpbc_bfb_form_appearance__set_container_style_control('custom');
  }
  return options;
}
function wpbc_bfb_form_appearance__get_custom_control_keys() {
  return ['booking_form_background_color', 'booking_form_border_color', 'booking_form_border_width', 'booking_form_border_radius', 'booking_form_padding', 'booking_form_text_color', 'booking_form_field_background_color', 'booking_form_field_text_color', 'booking_form_field_border_color'];
}
function wpbc_bfb_form_appearance__is_custom_control_key(key) {
  return wpbc_bfb_form_appearance__get_custom_control_keys().indexOf(String(key || '')) !== -1;
}
function wpbc_bfb_form_appearance__set_container_style_control(value) {
  const control = document.querySelector('[data-wpbc-bfb-fs-key="booking_form_container_style"]');
  if (!control || control.value === value) {
    return;
  }
  control.value = value;
}
function wpbc_bfb_form_appearance__set_radio_control(key, value) {
  const row = document.querySelector('.wpbc_bfb__form_setting[data-key="' + key + '"]');
  if (!row) {
    return;
  }
  const wrap = row.querySelector('.wpbc_bfb__form_setting_radio[data-wpbc-bfb-fs-controlid]');
  const control_id = wrap ? String(wrap.getAttribute('data-wpbc-bfb-fs-controlid') || '') : '';
  const radios = control_id ? row.querySelectorAll('input[type="radio"][name="' + control_id + '"]') : row.querySelectorAll('input[type="radio"]');
  radios.forEach(function (radio) {
    const should_check = String(radio.value) === String(value == null ? '' : value);
    radio.checked = should_check;
    const choice = radio.closest ? radio.closest('.wpbc_theme_choice') : null;
    if (choice) {
      choice.classList.toggle('is-selected', should_check);
    }
  });
}
function wpbc_bfb_form_appearance__set_select_control(key, value) {
  const control = document.querySelector('[data-wpbc-bfb-fs-key="' + key + '"]');
  if (control) {
    control.value = String(value == null ? '' : value);
  }
}
function wpbc_bfb_form_appearance__get_current_options() {
  return window.WPBC_BFB_FormSettings && typeof window.WPBC_BFB_FormSettings.collect === 'function' ? window.WPBC_BFB_FormSettings.collect('form') || {} : {};
}
function wpbc_bfb_form_appearance__get_style_value_from_options(options) {
  options = options && typeof options === 'object' ? options : {};
  const theme = String(options.booking_form_theme || '');
  const style = String(options.booking_form_container_style || 'inherit');
  if ('custom' === style) {
    return 'custom';
  }
  if ('inherit' === style || '' === style) {
    return 'inherit';
  }
  const prefix = 'wpbc_theme_dark_1' === theme ? 'dark' : 'light';
  if (['bordered', 'none', 'soft'].indexOf(style) === -1) {
    return prefix + '_bordered';
  }
  return prefix + '_' + style;
}
function wpbc_bfb_form_appearance__sync_form_style_control(options) {
  wpbc_bfb_form_appearance__set_radio_control('booking_form_style', wpbc_bfb_form_appearance__get_style_value_from_options(options));
}
function wpbc_bfb_form_appearance__resolve_form_style_choice(value) {
  const current_options = wpbc_bfb_form_appearance__get_current_options();
  const current_theme = String(current_options.booking_form_theme || '');
  const choice = String(value || 'inherit');
  if ('custom' === choice) {
    return {
      booking_form_theme: current_theme,
      booking_form_container_style: 'custom'
    };
  }
  if ('inherit' === choice || '' === choice) {
    return {
      booking_form_theme: '',
      booking_form_container_style: 'inherit'
    };
  }
  const parts = choice.split('_');
  const theme = 'dark' === parts[0] ? 'wpbc_theme_dark_1' : '';
  const style = parts[1] || 'bordered';
  return {
    booking_form_theme: theme,
    booking_form_container_style: ['bordered', 'none', 'soft'].indexOf(style) === -1 ? 'bordered' : style
  };
}
function wpbc_bfb_form_appearance__is_user_theme_switch(ctx) {
  const source = String(ctx && ctx.source ? ctx.source : '');
  return ['ui', 'coloris'].indexOf(source) !== -1;
}
function wpbc_bfb_form_appearance__is_custom_style(options) {
  return String(options && options.booking_form_container_style ? options.booking_form_container_style : 'inherit') === 'custom';
}
function wpbc_bfb_form_appearance__sync_custom_controls(options) {
  const is_custom = wpbc_bfb_form_appearance__is_custom_style(options);
  const reset_row = document.querySelector('[data-wpbc-bfb-custom-appearance-reset-row]');
  const base_theme_row = document.querySelector('.wpbc_bfb__form_setting[data-key="booking_form_theme"]');
  wpbc_bfb_form_appearance__get_custom_control_keys().forEach(function (key) {
    const row = document.querySelector('.wpbc_bfb__form_setting[data-key="' + key + '"]');
    if (!row) {
      return;
    }
    row.hidden = !is_custom;
    row.setAttribute('aria-hidden', is_custom ? 'false' : 'true');
    row.classList.toggle('is-hidden', !is_custom);
  });
  if (reset_row) {
    reset_row.hidden = !is_custom;
    reset_row.setAttribute('aria-hidden', is_custom ? 'false' : 'true');
    reset_row.classList.toggle('is-hidden', !is_custom);
  }
  if (base_theme_row) {
    base_theme_row.hidden = !is_custom;
    base_theme_row.setAttribute('aria-hidden', is_custom ? 'false' : 'true');
    base_theme_row.classList.toggle('is-hidden', !is_custom);
  }
}
function wpbc_bfb_form_appearance__resolve(options) {
  let style = String(options.booking_form_container_style || 'inherit');
  if (style === 'inherit') {
    const global_options = window.wpbc_bfb_settings_vars && window.wpbc_bfb_settings_vars.global_appearance ? window.wpbc_bfb_settings_vars.global_appearance : {};
    options = Object.assign({}, global_options || {});
    style = String(options.booking_form_container_style || 'bordered');
  }
  if (style === 'bordered') {
    return null;
  }
  if (style !== 'custom') {
    return wpbc_bfb_form_appearance__get_preset_for_options(style, options);
  }
  return {
    background: wpbc_bfb_form_appearance__sanitize_color(options.booking_form_background_color, '#ffffff'),
    borderColor: wpbc_bfb_form_appearance__sanitize_color(options.booking_form_border_color, '#cccccc'),
    borderWidth: wpbc_bfb_form_appearance__sanitize_length(options.booking_form_border_width, '1px'),
    radius: wpbc_bfb_form_appearance__sanitize_length(options.booking_form_border_radius, '2px'),
    padding: wpbc_bfb_form_appearance__sanitize_spacing(options.booking_form_padding, '10px 30px'),
    shadow: 'rgba(0, 0, 0, 0.05) 0px 2px 6px 0px'
  };
}
function wpbc_bfb_form_appearance__resolve_design_colors(options) {
  options = options && typeof options === 'object' ? options : {};
  if (!wpbc_bfb_form_appearance__is_custom_style(options)) {
    if (wpbc_bfb_form_appearance__is_dark_theme(options) && 'none' === String(options.booking_form_container_style || '')) {
      return {
        textColor: '#1d2327',
        fieldBackground: '',
        fieldText: '',
        fieldBorder: ''
      };
    }
    return {
      textColor: '',
      fieldBackground: '',
      fieldText: '',
      fieldBorder: ''
    };
  }
  return {
    textColor: wpbc_bfb_form_appearance__sanitize_optional_color(options.booking_form_text_color),
    fieldBackground: wpbc_bfb_form_appearance__sanitize_optional_color(options.booking_form_field_background_color),
    fieldText: wpbc_bfb_form_appearance__sanitize_optional_color(options.booking_form_field_text_color),
    fieldBorder: wpbc_bfb_form_appearance__sanitize_optional_color(options.booking_form_field_border_color)
  };
}
function wpbc_bfb_form_appearance__apply_vars(value, ctx) {
  const options = wpbc_bfb_form_appearance__collect_options(ctx, ctx && ctx.key, value);
  const resolved = wpbc_bfb_form_appearance__resolve(options);
  const design = wpbc_bfb_form_appearance__resolve_design_colors(options);
  const is_custom = wpbc_bfb_form_appearance__is_custom_style(options);
  const root = ctx && ctx.canvas;
  wpbc_bfb_form_appearance__sync_form_style_control(options);
  wpbc_bfb_form_appearance__sync_custom_controls(options);
  if (!root || !root.querySelectorAll) {
    return;
  }
  const wraps = root.querySelectorAll('.wpbc_bfb__form_preview_section_container, .wpbc_bfb_form');
  if (!wraps.length) {
    return;
  }
  wraps.forEach(function (wrap) {
    if (!wrap || !wrap.style) {
      return;
    }
    wrap.classList.toggle('wpbc_bfb_form_appearance_custom', is_custom);
    if (!resolved) {
      wrap.style.removeProperty('--wpbc-bfb-form-background');
      wrap.style.removeProperty('--wpbc-bfb-form-border-color');
      wrap.style.removeProperty('--wpbc-bfb-form-border-width');
      wrap.style.removeProperty('--wpbc-bfb-form-border-radius');
      wrap.style.removeProperty('--wpbc-bfb-form-padding');
      wrap.style.removeProperty('--wpbc-bfb-form-box-shadow');
    } else {
      wrap.style.setProperty('--wpbc-bfb-form-background', resolved.background);
      wrap.style.setProperty('--wpbc-bfb-form-border-color', resolved.borderColor);
      wrap.style.setProperty('--wpbc-bfb-form-border-width', resolved.borderWidth);
      wrap.style.setProperty('--wpbc-bfb-form-border-radius', resolved.radius);
      wrap.style.setProperty('--wpbc-bfb-form-padding', resolved.padding);
      wrap.style.setProperty('--wpbc-bfb-form-box-shadow', resolved.shadow);
    }
    if (design.textColor) {
      wrap.style.setProperty('--wpbc_form-label-color', design.textColor);
      wrap.style.setProperty('--wpbc_form-label-sublabel-color', design.textColor);
    } else {
      wrap.style.removeProperty('--wpbc_form-label-color');
      wrap.style.removeProperty('--wpbc_form-label-sublabel-color');
    }
    if (design.fieldBackground) {
      wrap.style.setProperty('--wpbc_form-field-background-color', design.fieldBackground);
      wrap.style.setProperty('--wpbc_form-field-menu-color', design.fieldBackground);
    } else {
      wrap.style.removeProperty('--wpbc_form-field-background-color');
      wrap.style.removeProperty('--wpbc_form-field-menu-color');
    }
    if (design.fieldText) {
      wrap.style.setProperty('--wpbc_form-field-text-color', design.fieldText);
    } else {
      wrap.style.removeProperty('--wpbc_form-field-text-color');
    }
    if (design.fieldBorder) {
      wrap.style.setProperty('--wpbc_form-field-border-color', design.fieldBorder);
      wrap.style.setProperty('--wpbc_form-field-border-color-spare', design.fieldBorder);
    } else {
      wrap.style.removeProperty('--wpbc_form-field-border-color');
      wrap.style.removeProperty('--wpbc_form-field-border-color-spare');
    }
  });
}
function wpbc_bfb_global_form_style__get_vars() {
  return window.wpbc_bfb_settings_vars || {};
}
function wpbc_bfb_global_form_style__get_presets() {
  const vars = wpbc_bfb_global_form_style__get_vars();
  return vars.form_style_presets && typeof vars.form_style_presets === 'object' ? vars.form_style_presets : {};
}
function wpbc_bfb_global_form_style__get_custom_keys() {
  return ['booking_form_custom_background_color', 'booking_form_custom_border_color', 'booking_form_custom_border_width', 'booking_form_custom_border_radius', 'booking_form_custom_padding_vertical', 'booking_form_custom_padding_horizontal', 'booking_form_custom_text_color', 'booking_form_custom_field_background_color', 'booking_form_custom_field_text_color', 'booking_form_custom_field_border_color', 'booking_form_custom_button_background_color', 'booking_form_custom_button_text_color', 'booking_form_custom_button_border_color', 'booking_form_custom_button_hover_background_color', 'booking_form_custom_button_hover_text_color', 'booking_form_custom_button_hover_border_color', 'booking_form_custom_secondary_button_background_color', 'booking_form_custom_secondary_button_text_color', 'booking_form_custom_secondary_button_border_color', 'booking_form_custom_secondary_button_hover_background_color', 'booking_form_custom_secondary_button_hover_text_color', 'booking_form_custom_secondary_button_hover_border_color', 'booking_form_custom_button_border_width', 'booking_form_custom_button_border_radius'];
}
function wpbc_bfb_global_form_style__get_custom_defaults() {
  const vars = wpbc_bfb_global_form_style__get_vars();
  const localized = vars.custom_form_style_defaults && typeof vars.custom_form_style_defaults === 'object' ? vars.custom_form_style_defaults : {};
  return Object.assign({
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
  }, localized);
}
function wpbc_bfb_global_form_style__get_current_options(ctx, key, value) {
  const vars = wpbc_bfb_global_form_style__get_vars();
  let options = vars.global_form_style && typeof vars.global_form_style === 'object' ? Object.assign({}, vars.global_form_style) : {};
  if (window.WPBC_BFB_FormSettings && typeof window.WPBC_BFB_FormSettings.collect === 'function') {
    options = Object.assign(options, window.WPBC_BFB_FormSettings.collect('global') || {});
  }
  if (ctx && ctx.options && typeof ctx.options === 'object') {
    options = Object.assign(options, ctx.options);
  }
  if (key) {
    options[String(key)] = value;
  }
  if (!options.booking_form_style) {
    options.booking_form_style = 'light_bordered';
  }
  return options;
}
function wpbc_bfb_global_form_style__mix_colors(color, target, amount) {
  let source = wpbc_bfb_global_form_style__sanitize_accent_color(color).replace('#', '');
  const destination = wpbc_bfb_form_appearance__sanitize_color(target, '#000000').replace('#', '');
  const channels = [];
  if (!source) {
    return '';
  }
  if (source.length === 3) {
    source = source.replace(/./g, function (value) {
      return value + value;
    });
  }
  for (let index = 0; index < 3; index++) {
    const source_channel = parseInt(source.substr(index * 2, 2), 16);
    const target_channel = parseInt(destination.substr(index * 2, 2), 16);
    channels.push(Math.round(source_channel + (target_channel - source_channel) * amount));
  }
  return '#' + channels.map(function (channel) {
    return ('0' + channel.toString(16)).slice(-2);
  }).join('');
}
function wpbc_bfb_global_form_style__get_luminance(color) {
  let hex = wpbc_bfb_global_form_style__sanitize_accent_color(color).replace('#', '');
  if (!hex) {
    return 0;
  }
  if (hex.length === 3) {
    hex = hex.replace(/./g, function (value) {
      return value + value;
    });
  }
  const channels = [0, 1, 2].map(function (index) {
    const channel = parseInt(hex.substr(index * 2, 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/**
 * Apply shared accent variables without masking explicit Custom button controls.
 *
 * @param {Object}  css_vars                      Resolved base style variables.
 * @param {Object}  options                       Current global style options.
 * @param {boolean} preserve_custom_button_colors Whether Custom button variables remain authoritative.
 * @return {Object} Resolved variables with the optional accent overlay.
 */
function wpbc_bfb_global_form_style__apply_accent(css_vars, options, preserve_custom_button_colors) {
  if (String(options.booking_form_accent_enabled || 'Off') !== 'On') {
    return css_vars;
  }
  const accent = wpbc_bfb_global_form_style__sanitize_accent_color(options.booking_form_accent_color);
  if (!accent) {
    return css_vars;
  }
  const luminance = wpbc_bfb_global_form_style__get_luminance(accent);
  const contrast = luminance > 0.18 ? '#000000' : '#ffffff';
  const hover_target = '#ffffff' === contrast ? '#000000' : '#ffffff';
  const hover = wpbc_bfb_global_form_style__mix_colors(accent, hover_target, 0.10);
  const hover_contrast = contrast;
  const accent_overlay = {
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
  return Object.assign({}, css_vars, accent_overlay);
}
function wpbc_bfb_global_form_style__resolve_css_vars(options) {
  options = options && typeof options === 'object' ? options : {};
  const style = String(options.booking_form_style || 'light_bordered');
  const presets = wpbc_bfb_global_form_style__get_presets();
  const preset = presets[style] || presets.light_bordered || {};
  const defaults = wpbc_bfb_global_form_style__get_custom_defaults();
  if ('custom' !== style) {
    return wpbc_bfb_global_form_style__apply_accent(preset.css_vars && typeof preset.css_vars === 'object' ? Object.assign({}, preset.css_vars) : {}, options);
  }
  const css_vars = {
    '--wpbc-bfb-form-background': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_background_color, defaults.booking_form_custom_background_color),
    '--wpbc-bfb-form-border-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_border_color, defaults.booking_form_custom_border_color),
    '--wpbc-bfb-form-border-width': wpbc_bfb_form_appearance__sanitize_length(options.booking_form_custom_border_width, defaults.booking_form_custom_border_width),
    '--wpbc-bfb-form-border-radius': wpbc_bfb_form_appearance__sanitize_length(options.booking_form_custom_border_radius, defaults.booking_form_custom_border_radius),
    '--wpbc-bfb-form-padding': wpbc_bfb_form_appearance__sanitize_length(options.booking_form_custom_padding_vertical, defaults.booking_form_custom_padding_vertical) + ' ' + wpbc_bfb_form_appearance__sanitize_length(options.booking_form_custom_padding_horizontal, defaults.booking_form_custom_padding_horizontal),
    '--wpbc-bfb-form-box-shadow': 'rgba(0, 0, 0, 0.05) 0px 2px 6px 0px',
    '--wpbc_form-label-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_text_color, defaults.booking_form_custom_text_color),
    '--wpbc_form-label-sublabel-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_text_color, defaults.booking_form_custom_text_color),
    '--wpbc_form-label-error-color': '#d63637',
    '--wpbc_form-field-background-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_field_background_color, defaults.booking_form_custom_field_background_color),
    '--wpbc_form-field-menu-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_field_background_color, defaults.booking_form_custom_field_background_color),
    '--wpbc_form-field-text-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_field_text_color, defaults.booking_form_custom_field_text_color),
    '--wpbc_form-field-border-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_field_border_color, defaults.booking_form_custom_field_border_color),
    '--wpbc_form-field-border-color-spare': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_field_border_color, defaults.booking_form_custom_field_border_color),
    '--wpbc_form-field-focus-border-color': '#066aab',
    '--wpbc_form-field-focus-shadow-color': '#066aab',
    '--wpbc_form-field-disabled-color': 'rgba(0, 0, 0, 0.2)',
    '--wpbc_form-button-border-radius': wpbc_bfb_form_appearance__sanitize_length(options.booking_form_custom_button_border_radius, defaults.booking_form_custom_button_border_radius),
    '--wpbc_form-button-border-style': 'solid',
    '--wpbc_form-button-border-size': wpbc_bfb_form_appearance__sanitize_length(options.booking_form_custom_button_border_width, defaults.booking_form_custom_button_border_width),
    '--wpbc_form-button-background-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_button_background_color, defaults.booking_form_custom_button_background_color),
    '--wpbc_form-button-background-color-alt': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_button_background_color, defaults.booking_form_custom_button_background_color),
    '--wpbc_form-button-border-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_button_border_color, defaults.booking_form_custom_button_border_color),
    '--wpbc_form-button-text-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_button_text_color, defaults.booking_form_custom_button_text_color),
    '--wpbc_form-button-text-color-alt': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_button_text_color, defaults.booking_form_custom_button_text_color),
    '--wpbc_form-button-hover-background-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_button_hover_background_color, defaults.booking_form_custom_button_hover_background_color),
    '--wpbc_form-button-hover-border-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_button_hover_border_color, defaults.booking_form_custom_button_hover_border_color),
    '--wpbc_form-button-hover-text-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_button_hover_text_color, defaults.booking_form_custom_button_hover_text_color),
    '--wpbc_form-choice-checked-border-color': '#066aab',
    '--wpbc_form-choice-checked-color': '#066aab',
    '--wpbc_form-choice-focus-color': '#066aab',
    '--wpbc_form-button-light-background-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_secondary_button_background_color, defaults.booking_form_custom_secondary_button_background_color),
    '--wpbc_form-button-light-border-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_secondary_button_border_color, defaults.booking_form_custom_secondary_button_border_color),
    '--wpbc_form-button-light-border-size': wpbc_bfb_form_appearance__sanitize_length(options.booking_form_custom_button_border_width, defaults.booking_form_custom_button_border_width),
    '--wpbc_form-button-light-text-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_secondary_button_text_color, defaults.booking_form_custom_secondary_button_text_color),
    '--wpbc_form-button-light-box-shadow': '0 2px 10px 2px #ffffff54',
    '--wpbc_form-button-light-hover-background-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_secondary_button_hover_background_color, defaults.booking_form_custom_secondary_button_hover_background_color),
    '--wpbc_form-button-light-hover-border-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_secondary_button_hover_border_color, defaults.booking_form_custom_secondary_button_hover_border_color),
    '--wpbc_form-button-light-hover-text-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_secondary_button_hover_text_color, defaults.booking_form_custom_secondary_button_hover_text_color),
    '--wpbc_form-button-light-hover-box-shadow': '0 2px 10px 2px #ffffff54',
    '--wpbc_form-button-primary-hover-border-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_button_hover_border_color, defaults.booking_form_custom_button_hover_border_color),
    '--wpbc_form-page-break-color': '#066aab'
  };
  return wpbc_bfb_global_form_style__apply_accent(css_vars, options, true);
}
function wpbc_bfb_global_form_style__get_css_var_keys(options) {
  const vars = wpbc_bfb_global_form_style__get_vars();
  const localized = Array.isArray(vars.form_style_css_var_names) ? vars.form_style_css_var_names : [];
  const keys = [];
  const presets = wpbc_bfb_global_form_style__get_presets();
  if (localized.length) {
    return localized;
  }
  Object.keys(presets).forEach(function (preset_key) {
    const preset = presets[preset_key] || {};
    const css_vars = preset.css_vars && typeof preset.css_vars === 'object' ? preset.css_vars : {};
    Object.keys(css_vars).forEach(function (var_name) {
      if (keys.indexOf(var_name) === -1) {
        keys.push(var_name);
      }
    });
  });
  Object.keys(wpbc_bfb_global_form_style__resolve_css_vars(Object.assign({}, options || {}, {
    booking_form_style: 'custom'
  }))).forEach(function (var_name) {
    if (keys.indexOf(var_name) === -1) {
      keys.push(var_name);
    }
  });
  return keys;
}
function wpbc_bfb_global_form_style__sync_controls(options) {
  const is_custom = 'custom' === String(options && options.booking_form_style ? options.booking_form_style : '');
  const accent_enabled = 'On' === String(options && options.booking_form_accent_enabled ? options.booking_form_accent_enabled : 'Off');
  const reset_row = document.querySelector('[data-wpbc-bfb-custom-appearance-reset-row]');
  wpbc_bfb_form_appearance__set_radio_control('booking_form_style', options.booking_form_style || 'light_bordered');
  document.querySelectorAll('.wpbc_bfb__form_setting_global_custom_style').forEach(function (row) {
    row.hidden = !is_custom;
    row.setAttribute('aria-hidden', is_custom ? 'false' : 'true');
    row.classList.toggle('is-hidden', !is_custom);
  });
  document.querySelectorAll('.wpbc_bfb__form_setting_global_accent_dependent').forEach(function (row) {
    row.hidden = !accent_enabled;
    row.setAttribute('aria-hidden', accent_enabled ? 'false' : 'true');
    row.classList.toggle('is-hidden', !accent_enabled);
  });
  if (reset_row) {
    reset_row.hidden = !is_custom;
    reset_row.setAttribute('aria-hidden', is_custom ? 'false' : 'true');
    reset_row.classList.toggle('is-hidden', !is_custom);
  }
}
function wpbc_bfb_global_form_style__apply(value, ctx) {
  const options = wpbc_bfb_global_form_style__get_current_options(ctx, ctx && ctx.key, value);
  const style = String(options.booking_form_style || 'light_bordered');
  const presets = wpbc_bfb_global_form_style__get_presets();
  const preset = presets[style] || presets.light_bordered || {};
  const css_vars = wpbc_bfb_global_form_style__resolve_css_vars(options);
  // Form Style is global. Always start at the complete Builder theme scope so
  // inline Custom tokens on an outer wrapper cannot leak into a preset when a
  // field-level update provides only the inner canvas in ctx.canvas.
  const root = document.getElementById('wpbc_bfb__theme_scope') || ctx && ctx.canvas || document;
  const theme_classes = [];
  const css_var_keys = wpbc_bfb_global_form_style__get_css_var_keys(options);
  wpbc_bfb_global_form_style__sync_controls(options);
  Object.keys(presets).forEach(function (preset_key) {
    const class_name = presets[preset_key] && presets[preset_key].theme_class ? String(presets[preset_key].theme_class) : '';
    if (class_name && theme_classes.indexOf(class_name) === -1) {
      theme_classes.push(class_name);
    }
  });
  if (!root || !root.querySelectorAll) {
    return;
  }
  const selector = '.wpbc_container.wpbc_form, .wpbc_bfb_form, .wpbc_bfb__pages_panel, .wpbc_bfb__form_preview_section_container';
  const wraps = [];
  if (root.matches && root.matches(selector)) {
    wraps.push(root);
  }
  root.querySelectorAll(selector).forEach(function (wrap) {
    wraps.push(wrap);
  });
  wraps.forEach(function (wrap) {
    if (!wrap || !wrap.style) {
      return;
    }
    theme_classes.forEach(function (class_name) {
      wrap.classList.remove(class_name);
    });
    if (preset.theme_class) {
      wrap.classList.add(String(preset.theme_class));
    }
    wrap.classList.toggle('wpbc_bfb_form_appearance_custom', 'custom' === style);
    css_var_keys.forEach(function (css_key) {
      wrap.style.removeProperty(css_key);
    });
    Object.keys(css_vars).forEach(function (css_key) {
      wrap.style.setProperty(css_key, css_vars[css_key]);
    });
  });
}
['booking_form_style', 'booking_form_accent_enabled', 'booking_form_accent_color', 'booking_form_custom_background_color', 'booking_form_custom_border_color', 'booking_form_custom_border_width', 'booking_form_custom_border_radius', 'booking_form_custom_padding_vertical', 'booking_form_custom_padding_horizontal', 'booking_form_custom_text_color', 'booking_form_custom_field_background_color', 'booking_form_custom_field_text_color', 'booking_form_custom_field_border_color', 'booking_form_custom_button_background_color', 'booking_form_custom_button_text_color', 'booking_form_custom_button_border_color', 'booking_form_custom_button_hover_background_color', 'booking_form_custom_button_hover_text_color', 'booking_form_custom_button_hover_border_color', 'booking_form_custom_secondary_button_background_color', 'booking_form_custom_secondary_button_text_color', 'booking_form_custom_secondary_button_border_color', 'booking_form_custom_secondary_button_hover_background_color', 'booking_form_custom_secondary_button_hover_text_color', 'booking_form_custom_secondary_button_hover_border_color', 'booking_form_custom_button_border_width', 'booking_form_custom_button_border_radius'].forEach(function (key) {
  WPBC_BFB_Settings_Effects.register(key, function (value, ctx) {
    wpbc_bfb_global_form_style__apply(value, Object.assign({}, ctx || {}, {
      key: key
    }));
  });
});
function wpbc_bfb_form_appearance__sync_custom_controls_from_ui() {
  const options = wpbc_bfb_global_form_style__get_current_options();
  wpbc_bfb_global_form_style__sync_controls(options);
  wpbc_bfb_global_form_style__apply(null, {
    source: 'sync-global-style'
  });
}
wpbc_bfb_form_appearance__sync_custom_controls_from_ui();
document.addEventListener('DOMContentLoaded', wpbc_bfb_form_appearance__sync_custom_controls_from_ui);

// BOOKING_FORM_THEME.
WPBC_BFB_Settings_Effects.register('booking_form_theme', function (value, ctx) {
  const root = ctx && ctx.canvas || document.getElementById('wpbc_bfb__theme_scope') || document;
  if (!root || !root.querySelectorAll) {
    return;
  }
  if (wpbc_bfb_form_appearance__is_user_theme_switch(ctx)) {
    const current_options = wpbc_bfb_form_appearance__get_current_options();
    if ('custom' === String(current_options.booking_form_container_style || '')) {
      current_options.booking_form_theme = value;
      wpbc_bfb_form_appearance__sync_form_style_control(current_options);
      wpbc_bfb_form_appearance__apply_vars('custom', Object.assign({}, ctx || {}, {
        key: 'booking_form_container_style',
        source: 'theme-base-custom',
        options: current_options
      }));
    } else {
      wpbc_bfb_form_appearance__set_container_style_control('bordered');
      wpbc_bfb_form_appearance__apply_vars('bordered', Object.assign({}, ctx || {}, {
        key: 'booking_form_container_style'
      }));
    }
  } else if (ctx && ctx.options) {
    wpbc_bfb_form_appearance__sync_form_style_control(ctx.options);
  }
  const theme_selector = '.wpbc_container.wpbc_form, .wpbc_bfb_form, .wpbc_bfb__pages_panel';
  const wraps = [];
  if (root.matches && root.matches(theme_selector)) {
    wraps.push(root);
  }
  root.querySelectorAll(theme_selector).forEach(function (wrap) {
    wraps.push(wrap);
  });
  if (!wraps.length) {
    return;
  }
  wraps.forEach(function (wrap) {
    // remove any previous theme classes (simple + future-proof).
    Array.from(wrap.classList).forEach(function (cls) {
      if (/^wpbc_theme_/.test(cls)) {
        wrap.classList.remove(cls);
      }
    });
    if (value) {
      wrap.classList.add(String(value));
    }
  });
});

// BOOKING_FORM_LAYOUT_WIDTH — Form width: applies combined "100%" / "600px" / "40rem" to the booking form containers.
WPBC_BFB_Settings_Effects.register('booking_form_layout_width', function (value, ctx) {
  const root = ctx && ctx.canvas;
  if (!root || !root.querySelectorAll) {
    return;
  }
  const wraps = root.querySelectorAll('.wpbc_bfb__form_preview_section_container');
  if (!wraps.length) {
    return;
  }
  const v = String(value == null ? '' : value).trim();

  // allow only "number + unit".
  if (v && !/^\d+(?:\.\d+)?(?:%|px|rem|em|vw|vh)$/.test(v)) {
    return;
  }
  wraps.forEach(function (wrap) {
    if (!wrap || !wrap.style) {
      return;
    }
    if (!v) {
      wrap.style.removeProperty('--wpbc-bfb-booking_form_layout_width');
    } else {
      wrap.style.setProperty('--wpbc-bfb-booking_form_layout_width', v);
    }
  });
});

// Debug Preview Mode.
WPBC_BFB_Settings_Effects.register('booking_bfb_preview_mode', function (value, ctx) {
  const root = ctx.canvas;
  if (!root || !root.querySelectorAll) {
    return;
  }
  const wraps = root.querySelectorAll('.wpbc_container.wpbc_form');
  if (!wraps.length) {
    return;
  }

  // Get builder async.
  wpbc_bfb_api.with_builder(function (Builder) {
    /**
     * Capture active right sidebar tab and return restore handle.
     *
     * @return {{restore:function():void}|null}
     */
    function capture_right_sidebar_active_tab_restore_handle() {
      var tablist_el = document.querySelector('.wpbc_bfb__rightbar_tabs[role="tablist"]');
      if (!tablist_el) {
        return null;
      }
      var active_tab_el = tablist_el.querySelector('[role="tab"][aria-selected="true"]');
      if (!active_tab_el) {
        active_tab_el = tablist_el.querySelector('[role="tab"][aria-controls="wpbc_bfb__palette_add_new"]');
      }
      if (!active_tab_el || typeof active_tab_el.click !== 'function') {
        return null;
      }
      return {
        restore: function () {
          try {
            active_tab_el.click();
          } catch (_e) {}
        }
      };
    }
    var tab_restore_handle = capture_right_sidebar_active_tab_restore_handle();
    let restored = false;
    var EVS = window.WPBC_BFB_Core && window.WPBC_BFB_Core.WPBC_BFB_Events ? window.WPBC_BFB_Core.WPBC_BFB_Events : {};
    var EV_DONE = EVS.STRUCTURE_LOADED || EVS.CANVAS_REFRESHED || 'wpbc:bfb:structure-loaded';
    function do_restore() {
      if (restored) {
        return;
      }
      restored = true;
      try {
        Builder?.bus?.off?.(EV_DONE, do_restore);
      } catch (_) {}
      requestAnimationFrame(function () {
        if (!tab_restore_handle) {
          return;
        }
        tab_restore_handle.restore();
      });
    }

    // Listen once (best), plus a fallback in case event isn't fired.
    try {
      Builder?.bus?.on?.(EV_DONE, do_restore);
    } catch (_) {}
    var enabled = 'On' === value;
    Builder.set_preview_mode(enabled, {
      rebuild: true,
      reinit: true,
      source: 'settings-effects'
    });
  });
});
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZm9ybS1zZXR0aW5ncy9fb3V0L3NldHRpbmdzX2VmZmVjdHMuanMiLCJuYW1lcyI6WyJ3IiwiZCIsIkVmZmVjdHMiLCJXUEJDX0JGQl9TZXR0aW5nc19FZmZlY3RzIiwibWFwIiwiT2JqZWN0IiwiY3JlYXRlIiwicmVnaXN0ZXIiLCJrZXkiLCJmbiIsIlN0cmluZyIsImdldF9jYW52YXNfcm9vdCIsInF1ZXJ5U2VsZWN0b3IiLCJnZXRFbGVtZW50QnlJZCIsImJvZHkiLCJkb2N1bWVudEVsZW1lbnQiLCJhcHBseV9vbmUiLCJ2YWx1ZSIsImN0eCIsImFzc2lnbiIsImNhbnZhcyIsImUiLCJjb25zb2xlIiwiZXJyb3IiLCJhcHBseV9hbGwiLCJvcHRpb25zIiwia2V5cyIsImZvckVhY2giLCJrIiwibm9ybWFsaXplX3BhY2siLCJwYWNrIiwiSlNPTiIsInBhcnNlIiwiX2UiLCJoYXNfc2hhcGUiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJjc3NfdmFycyIsImJmYl9vcHRpb25zIiwicmVhcHBseV9hZnRlcl9jYW52YXMiLCJzZXR0aW5nc19wYWNrIiwic291cmNlIiwid3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2FwcGx5Iiwic2V0VGltZW91dCIsImFkZEV2ZW50TGlzdGVuZXIiLCJkZXRhaWwiLCJzZXR0aW5ncyIsImNzc19lc2NhcGUiLCJ2IiwiQ1NTIiwiZXNjYXBlIiwicmVwbGFjZSIsImZpbmRfZnNfcm9vdCIsImVsIiwiY2xvc2VzdCIsImRpcmVjdCIsImxlbl9ncm91cCIsInNwYWNpbmdfZ3JvdXAiLCJyYW5nZV9ncm91cCIsInJlYWRfdmFsdWVfZnJvbV9mc19yb290IiwiZnNfcm9vdCIsIm9yaWdpbmFsX3RhcmdldCIsImZzX3R5cGUiLCJnZXRBdHRyaWJ1dGUiLCJjb250cm9sX2lkIiwic2VsZWN0b3IiLCJjaGVja2VkIiwiZ3JvdXAiLCJ2ZXJ0aWNhbF9pbnB1dCIsImhvcml6b250YWxfaW5wdXQiLCJ3cml0ZXIiLCJ2ZXJ0aWNhbCIsImhvcml6b250YWwiLCJjb21iaW5lZCIsIndwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fbm9ybWFsaXplX3NwYWNpbmdfbnVtYmVycyIsInR5cGUiLCJjYiIsImFwcGx5X2NoYW5nZV9mcm9tX3RhcmdldCIsInRhcmdldCIsImV2ZW50X3R5cGUiLCJldmVudF9zb3VyY2UiLCJ0YWciLCJ0YWdOYW1lIiwidG9Mb3dlckNhc2UiLCJ1c2VfY2hhbmdlIiwic2NvcGUiLCJjb250cm9sIiwiaXNfY29sb3Jpc19jb250cm9sIiwibWF0Y2hlcyIsIm9uX2NoYW5nZSIsImV2IiwiaXNUcnVzdGVkIiwib25fY29sb3Jpc19waWNrIiwiY3VycmVudEVsIiwiaW5wdXQiLCJjb2xvciIsIndpbmRvdyIsImRvY3VtZW50Iiwid3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19nZXRfcHJlc2V0cyIsImJvcmRlcmVkIiwiYmFja2dyb3VuZCIsImJvcmRlckNvbG9yIiwiYm9yZGVyV2lkdGgiLCJyYWRpdXMiLCJwYWRkaW5nIiwic2hhZG93Iiwibm9uZSIsInNvZnQiLCJ3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2lzX2RhcmtfdGhlbWUiLCJib29raW5nX2Zvcm1fdGhlbWUiLCJ3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2dldF9wcmVzZXRfZm9yX29wdGlvbnMiLCJzdHlsZSIsInByZXNldHMiLCJ3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2NvbG9yIiwiZmFsbGJhY2siLCJ0cmltIiwidGVzdCIsIndwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfb3B0aW9uYWxfY29sb3IiLCJ3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fc2FuaXRpemVfYWNjZW50X2NvbG9yIiwicmVxdWVzdGVkX2NvbG9yIiwic2V0dGluZ3NfdmFycyIsIndwYmNfYmZiX3NldHRpbmdzX3ZhcnMiLCJhY2NlbnRfZGVmYXVsdHMiLCJmb3JtX2FjY2VudF9kZWZhdWx0cyIsImRlZmF1bHRfY29sb3IiLCJib29raW5nX2Zvcm1fYWNjZW50X2NvbG9yIiwid3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9sZW5ndGgiLCJ3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX3NwYWNpbmciLCJwYXJ0cyIsInNwbGl0IiwibGVuZ3RoIiwiaSIsImpvaW4iLCJoIiwidmVydGljYWxfbnVtIiwiaG9yaXpvbnRhbF9udW0iLCJ3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2NvbGxlY3Rfb3B0aW9ucyIsIldQQkNfQkZCX0Zvcm1TZXR0aW5ncyIsImNvbGxlY3QiLCJ3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2lzX2N1c3RvbV9jb250cm9sX2tleSIsImJvb2tpbmdfZm9ybV9jb250YWluZXJfc3R5bGUiLCJ3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3NldF9jb250YWluZXJfc3R5bGVfY29udHJvbCIsIndwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fZ2V0X2N1c3RvbV9jb250cm9sX2tleXMiLCJpbmRleE9mIiwid3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zZXRfcmFkaW9fY29udHJvbCIsInJvdyIsIndyYXAiLCJyYWRpb3MiLCJxdWVyeVNlbGVjdG9yQWxsIiwicmFkaW8iLCJzaG91bGRfY2hlY2siLCJjaG9pY2UiLCJjbGFzc0xpc3QiLCJ0b2dnbGUiLCJ3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3NldF9zZWxlY3RfY29udHJvbCIsIndwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fZ2V0X2N1cnJlbnRfb3B0aW9ucyIsIndwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fZ2V0X3N0eWxlX3ZhbHVlX2Zyb21fb3B0aW9ucyIsInRoZW1lIiwicHJlZml4Iiwid3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zeW5jX2Zvcm1fc3R5bGVfY29udHJvbCIsIndwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fcmVzb2x2ZV9mb3JtX3N0eWxlX2Nob2ljZSIsImN1cnJlbnRfb3B0aW9ucyIsImN1cnJlbnRfdGhlbWUiLCJ3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2lzX3VzZXJfdGhlbWVfc3dpdGNoIiwid3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19pc19jdXN0b21fc3R5bGUiLCJ3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3N5bmNfY3VzdG9tX2NvbnRyb2xzIiwiaXNfY3VzdG9tIiwicmVzZXRfcm93IiwiYmFzZV90aGVtZV9yb3ciLCJoaWRkZW4iLCJzZXRBdHRyaWJ1dGUiLCJ3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Jlc29sdmUiLCJnbG9iYWxfb3B0aW9ucyIsImdsb2JhbF9hcHBlYXJhbmNlIiwiYm9va2luZ19mb3JtX2JhY2tncm91bmRfY29sb3IiLCJib29raW5nX2Zvcm1fYm9yZGVyX2NvbG9yIiwiYm9va2luZ19mb3JtX2JvcmRlcl93aWR0aCIsImJvb2tpbmdfZm9ybV9ib3JkZXJfcmFkaXVzIiwiYm9va2luZ19mb3JtX3BhZGRpbmciLCJ3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Jlc29sdmVfZGVzaWduX2NvbG9ycyIsInRleHRDb2xvciIsImZpZWxkQmFja2dyb3VuZCIsImZpZWxkVGV4dCIsImZpZWxkQm9yZGVyIiwiYm9va2luZ19mb3JtX3RleHRfY29sb3IiLCJib29raW5nX2Zvcm1fZmllbGRfYmFja2dyb3VuZF9jb2xvciIsImJvb2tpbmdfZm9ybV9maWVsZF90ZXh0X2NvbG9yIiwiYm9va2luZ19mb3JtX2ZpZWxkX2JvcmRlcl9jb2xvciIsIndwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fYXBwbHlfdmFycyIsInJlc29sdmVkIiwiZGVzaWduIiwicm9vdCIsIndyYXBzIiwicmVtb3ZlUHJvcGVydHkiLCJzZXRQcm9wZXJ0eSIsIndwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19nZXRfdmFycyIsIndwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19nZXRfcHJlc2V0cyIsInZhcnMiLCJmb3JtX3N0eWxlX3ByZXNldHMiLCJ3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fZ2V0X2N1c3RvbV9rZXlzIiwid3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2dldF9jdXN0b21fZGVmYXVsdHMiLCJsb2NhbGl6ZWQiLCJjdXN0b21fZm9ybV9zdHlsZV9kZWZhdWx0cyIsImJvb2tpbmdfZm9ybV9jdXN0b21fYmFja2dyb3VuZF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfd2lkdGgiLCJib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl9yYWRpdXMiLCJib29raW5nX2Zvcm1fY3VzdG9tX3BhZGRpbmdfdmVydGljYWwiLCJib29raW5nX2Zvcm1fY3VzdG9tX3BhZGRpbmdfaG9yaXpvbnRhbCIsImJvb2tpbmdfZm9ybV9jdXN0b21fdGV4dF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYmFja2dyb3VuZF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfdGV4dF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYm9yZGVyX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYmFja2dyb3VuZF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX3RleHRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ib3JkZXJfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl9iYWNrZ3JvdW5kX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfdGV4dF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JvcmRlcl9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9iYWNrZ3JvdW5kX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX3RleHRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fYm9yZGVyX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX2JhY2tncm91bmRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfdGV4dF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl9ib3JkZXJfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ib3JkZXJfd2lkdGgiLCJib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ib3JkZXJfcmFkaXVzIiwid3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2dldF9jdXJyZW50X29wdGlvbnMiLCJnbG9iYWxfZm9ybV9zdHlsZSIsImJvb2tpbmdfZm9ybV9zdHlsZSIsIndwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19taXhfY29sb3JzIiwiYW1vdW50IiwiZGVzdGluYXRpb24iLCJjaGFubmVscyIsImluZGV4Iiwic291cmNlX2NoYW5uZWwiLCJwYXJzZUludCIsInN1YnN0ciIsInRhcmdldF9jaGFubmVsIiwicHVzaCIsIk1hdGgiLCJyb3VuZCIsImNoYW5uZWwiLCJ0b1N0cmluZyIsInNsaWNlIiwid3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2dldF9sdW1pbmFuY2UiLCJoZXgiLCJwb3ciLCJ3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fYXBwbHlfYWNjZW50IiwicHJlc2VydmVfY3VzdG9tX2J1dHRvbl9jb2xvcnMiLCJib29raW5nX2Zvcm1fYWNjZW50X2VuYWJsZWQiLCJhY2NlbnQiLCJsdW1pbmFuY2UiLCJjb250cmFzdCIsImhvdmVyX3RhcmdldCIsImhvdmVyIiwiaG92ZXJfY29udHJhc3QiLCJhY2NlbnRfb3ZlcmxheSIsImNzc192YXJfbmFtZSIsIndwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19yZXNvbHZlX2Nzc192YXJzIiwicHJlc2V0IiwibGlnaHRfYm9yZGVyZWQiLCJkZWZhdWx0cyIsIndwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19nZXRfY3NzX3Zhcl9rZXlzIiwiQXJyYXkiLCJpc0FycmF5IiwiZm9ybV9zdHlsZV9jc3NfdmFyX25hbWVzIiwicHJlc2V0X2tleSIsInZhcl9uYW1lIiwid3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX3N5bmNfY29udHJvbHMiLCJhY2NlbnRfZW5hYmxlZCIsInRoZW1lX2NsYXNzZXMiLCJjc3NfdmFyX2tleXMiLCJjbGFzc19uYW1lIiwidGhlbWVfY2xhc3MiLCJyZW1vdmUiLCJhZGQiLCJjc3Nfa2V5Iiwid3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zeW5jX2N1c3RvbV9jb250cm9sc19mcm9tX3VpIiwidGhlbWVfc2VsZWN0b3IiLCJmcm9tIiwiY2xzIiwid3BiY19iZmJfYXBpIiwid2l0aF9idWlsZGVyIiwiQnVpbGRlciIsImNhcHR1cmVfcmlnaHRfc2lkZWJhcl9hY3RpdmVfdGFiX3Jlc3RvcmVfaGFuZGxlIiwidGFibGlzdF9lbCIsImFjdGl2ZV90YWJfZWwiLCJjbGljayIsInJlc3RvcmUiLCJ0YWJfcmVzdG9yZV9oYW5kbGUiLCJyZXN0b3JlZCIsIkVWUyIsIldQQkNfQkZCX0NvcmUiLCJXUEJDX0JGQl9FdmVudHMiLCJFVl9ET05FIiwiU1RSVUNUVVJFX0xPQURFRCIsIkNBTlZBU19SRUZSRVNIRUQiLCJkb19yZXN0b3JlIiwiYnVzIiwib2ZmIiwiXyIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsIm9uIiwiZW5hYmxlZCIsInNldF9wcmV2aWV3X21vZGUiLCJyZWJ1aWxkIiwicmVpbml0Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZm9ybS1zZXR0aW5ncy9fc3JjL3NldHRpbmdzX2VmZmVjdHMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBcHBsaWVzIGVmZmVjdHMgaW4gQ2FudmFzLCBhZnRlciBjaGFuZ2luZyBzb21lIHNldHRpbmdzIGluIHRoZSByaWdodCBzaWRlYmFyIGluIEJGQi5cbiAqXG4gKiBAZmlsZSAuLi9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9mb3JtLXNldHRpbmdzL19zcmMvc2V0dGluZ3NfZWZmZWN0cy5qc1xuICovXG4oZnVuY3Rpb24gKHcsIGQpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdGNvbnN0IEVmZmVjdHMgPSAody5XUEJDX0JGQl9TZXR0aW5nc19FZmZlY3RzID0gdy5XUEJDX0JGQl9TZXR0aW5nc19FZmZlY3RzIHx8IHt9KTtcblx0Y29uc3QgbWFwICAgICA9IChFZmZlY3RzLm1hcCA9IEVmZmVjdHMubWFwIHx8IE9iamVjdC5jcmVhdGUoIG51bGwgKSk7XG5cblx0RWZmZWN0cy5yZWdpc3RlciA9IGZ1bmN0aW9uIChrZXksIGZuKSB7XG5cdFx0aWYgKCBrZXkgJiYgdHlwZW9mIGZuID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0bWFwW1N0cmluZygga2V5ICldID0gZm47XG5cdFx0fVxuXHR9O1xuXG5cdGZ1bmN0aW9uIGdldF9jYW52YXNfcm9vdCgpIHtcblx0XHRyZXR1cm4gKFxuXHRcdFx0ZC5xdWVyeVNlbGVjdG9yKCAnI3dwYmNfYmZiX19wYWdlc19jb250YWluZXInICkgfHxcblx0XHRcdGQucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXcnICkgfHxcblx0XHRcdGQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9fcHJldmlldycgKSB8fFxuXHRcdFx0ZC5ib2R5IHx8IGQuZG9jdW1lbnRFbGVtZW50XG5cdFx0KTtcblx0fVxuXG5cdEVmZmVjdHMuYXBwbHlfb25lID0gZnVuY3Rpb24gKGtleSwgdmFsdWUsIGN0eCkge1xuXHRcdGNvbnN0IGZuID0gbWFwW1N0cmluZygga2V5ICldO1xuXHRcdGlmICggISBmbiApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dHJ5IHtcblx0XHRcdGZuKCB2YWx1ZSwgT2JqZWN0LmFzc2lnbiggeyBrZXksIHZhbHVlLCBjYW52YXM6IGdldF9jYW52YXNfcm9vdCgpIH0sIGN0eCB8fCB7fSApICk7XG5cdFx0fSBjYXRjaCAoIGUgKSB7XG5cdFx0XHQvLyBrZWVwIHNpbGVudCBpbiBwcm9kdWN0aW9uIGlmIHlvdSBwcmVmZXJcblx0XHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDIEVmZmVjdHMgZXJyb3I6Jywga2V5LCBlICk7XG5cdFx0fVxuXHR9O1xuXG5cdEVmZmVjdHMuYXBwbHlfYWxsID0gZnVuY3Rpb24gKG9wdGlvbnMsIGN0eCkge1xuXHRcdGlmICggISBvcHRpb25zIHx8IHR5cGVvZiBvcHRpb25zICE9PSAnb2JqZWN0JyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0T2JqZWN0LmtleXMoIG9wdGlvbnMgKS5mb3JFYWNoKCBmdW5jdGlvbiAoaykge1xuXHRcdFx0RWZmZWN0cy5hcHBseV9vbmUoIGssIG9wdGlvbnNba10sIE9iamVjdC5hc3NpZ24oIHsgb3B0aW9uczogb3B0aW9ucyB9LCBjdHggfHwge30gKSApO1xuXHRcdH0gKTtcblx0fTtcblxuXHQvKipcblx0ICogTm9ybWFsaXplIHNldHRpbmdzIHBhY2sgdG8gdGhlIG1pbmltdW0gcmVxdWlyZWQgc2hhcGU6XG5cdCAqIHsgb3B0aW9uczoge30sIGNzc192YXJzOiB7fSB9XG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gcGFja1xuXHQgKiBAcmV0dXJuIHt7b3B0aW9uczpPYmplY3QsIGNzc192YXJzOk9iamVjdCwgYmZiX29wdGlvbnM/Ok9iamVjdH18bnVsbH1cblx0ICovXG5cdEVmZmVjdHMubm9ybWFsaXplX3BhY2sgPSBmdW5jdGlvbiAocGFjaykge1xuXG5cdFx0aWYgKCBwYWNrID09PSBudWxsIHx8IHR5cGVvZiBwYWNrID09PSAndW5kZWZpbmVkJyB8fCBwYWNrID09PSAnJyApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdC8vIFBhcnNlIEpTT04gc3RyaW5nIGlmIG5lZWRlZC5cblx0XHRpZiAoIHR5cGVvZiBwYWNrID09PSAnc3RyaW5nJyApIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHBhY2sgPSBKU09OLnBhcnNlKCBwYWNrICk7XG5cdFx0XHR9IGNhdGNoICggX2UgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICggISBwYWNrIHx8IHR5cGVvZiBwYWNrICE9PSAnb2JqZWN0JyApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdC8vIElmIHVzZXIgcGFzc2VkIGp1c3Qge2tleTp2YWx1ZX0gb3B0aW9ucyBtYXAsIHdyYXAgaXQuXG5cdFx0Y29uc3QgaGFzX3NoYXBlID1cblx0XHRcdFx0ICBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIHBhY2ssICdvcHRpb25zJyApIHx8XG5cdFx0XHRcdCAgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBwYWNrLCAnY3NzX3ZhcnMnICkgfHxcblx0XHRcdFx0ICBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIHBhY2ssICdiZmJfb3B0aW9ucycgKTtcblxuXHRcdGlmICggISBoYXNfc2hhcGUgKSB7XG5cdFx0XHRwYWNrID0geyBvcHRpb25zOiBwYWNrLCBjc3NfdmFyczoge30gfTtcblx0XHR9XG5cblx0XHRpZiAoICEgcGFjay5vcHRpb25zIHx8IHR5cGVvZiBwYWNrLm9wdGlvbnMgIT09ICdvYmplY3QnICkge1xuXHRcdFx0cGFjay5vcHRpb25zID0ge307XG5cdFx0fVxuXHRcdGlmICggISBwYWNrLmNzc192YXJzIHx8IHR5cGVvZiBwYWNrLmNzc192YXJzICE9PSAnb2JqZWN0JyApIHtcblx0XHRcdHBhY2suY3NzX3ZhcnMgPSB7fTtcblx0XHR9XG5cblx0XHQvLyBiZmJfb3B0aW9ucyBpcyBvcHRpb25hbDsga2VlcCBpZiB2YWxpZC5cblx0XHRpZiAoIHBhY2suYmZiX29wdGlvbnMgJiYgdHlwZW9mIHBhY2suYmZiX29wdGlvbnMgIT09ICdvYmplY3QnICkge1xuXHRcdFx0ZGVsZXRlIHBhY2suYmZiX29wdGlvbnM7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHBhY2s7XG5cdH07XG5cblx0LyoqXG5cdCAqIFJlLWFwcGx5IHNldHRpbmdzIGVmZmVjdHMgYWZ0ZXIgYSBjYW52YXMgcmVidWlsZCAvIHN0cnVjdHVyZSBsb2FkLlxuXHQgKlxuXHQgKiBUaGlzIGlzIG5lZWRlZCBiZWNhdXNlIHN0cnVjdHVyZSBsb2FkaW5nIGNhbiByZXBsYWNlIERPTSBub2RlcyB0aGF0IGVmZmVjdHMgdGFyZ2V0LlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IHNldHRpbmdzX3BhY2sgIHN0cmluZ3xvYmplY3Qgc2V0dGluZ3NfanNvbiBwYWNrIChvciBwbGFpbiBvcHRpb25zIG1hcClcblx0ICogQHBhcmFtIHtPYmplY3R9IFtjdHhdXG5cdCAqL1xuXHRFZmZlY3RzLnJlYXBwbHlfYWZ0ZXJfY2FudmFzID0gZnVuY3Rpb24gKHNldHRpbmdzX3BhY2ssIGN0eCkge1xuXG5cdFx0Y29uc3QgcGFjayA9IEVmZmVjdHMubm9ybWFsaXplX3BhY2soIHNldHRpbmdzX3BhY2sgKTtcblx0XHRpZiAoICEgcGFjayApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBBcHBseSBpbW1lZGlhdGVseSAoYmVzdCBlZmZvcnQpLlxuXHRcdEVmZmVjdHMuYXBwbHlfYWxsKCBwYWNrLm9wdGlvbnMsIE9iamVjdC5hc3NpZ24oIHsgc291cmNlOiAncmVhcHBseV9hZnRlcl9jYW52YXMnIH0sIGN0eCB8fCB7fSApICk7XG5cdFx0d3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2FwcGx5KCBudWxsLCBPYmplY3QuYXNzaWduKCB7IHNvdXJjZTogJ3JlYXBwbHlfYWZ0ZXJfY2FudmFzJyB9LCBjdHggfHwge30gKSApO1xuXG5cdFx0Ly8gU29tZSBtb2R1bGVzL2h5ZHJhdGlvbiBtYXkgcnVuIHNob3J0bHkgYWZ0ZXI7IGRvIG9uZSBtb3JlIHBhc3MuXG5cdFx0c2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xuXHRcdFx0RWZmZWN0cy5hcHBseV9hbGwoIHBhY2sub3B0aW9ucywgT2JqZWN0LmFzc2lnbiggeyBzb3VyY2U6ICdyZWFwcGx5X2FmdGVyX2NhbnZhc19kZWxheWVkJyB9LCBjdHggfHwge30gKSApO1xuXHRcdFx0d3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2FwcGx5KCBudWxsLCBPYmplY3QuYXNzaWduKCB7IHNvdXJjZTogJ3JlYXBwbHlfYWZ0ZXJfY2FudmFzX2RlbGF5ZWQnIH0sIGN0eCB8fCB7fSApICk7XG5cdFx0fSwgNjAgKTtcblx0fTtcblxuXHQvLyAxKSBBcHBseSBmcm9tIEFKQVggbG9hZC5cblx0ZC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzpiZmI6Zm9ybV9zZXR0aW5nczphcHBseScsIGZ1bmN0aW9uIChlKSB7XG5cdFx0Y29uc3QgcGFjayA9IGUgJiYgZS5kZXRhaWwgPyBlLmRldGFpbC5zZXR0aW5ncyA6IG51bGw7XG5cdFx0aWYgKCBwYWNrICYmIHBhY2sub3B0aW9ucyApIHtcblx0XHRcdEVmZmVjdHMuYXBwbHlfYWxsKCBwYWNrLm9wdGlvbnMsIHsgc291cmNlOiAnYXBwbHknIH0gKTtcblx0XHR9XG5cdFx0d3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2FwcGx5KCBudWxsLCB7IHNvdXJjZTogJ2FwcGx5LWdsb2JhbC1zdHlsZScgfSApO1xuXHR9ICk7XG5cblx0Ly8gMikgQXBwbHkgbGl2ZSBmcm9tIFVJIGNoYW5nZSAoZGVsZWdhdGVkKS5cblx0ZnVuY3Rpb24gY3NzX2VzY2FwZSh2YWx1ZSkge1xuXHRcdGNvbnN0IHYgPSBTdHJpbmcoIHZhbHVlID09IG51bGwgPyAnJyA6IHZhbHVlICk7XG5cdFx0aWYgKCB3LkNTUyAmJiB0eXBlb2Ygdy5DU1MuZXNjYXBlID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0cmV0dXJuIHcuQ1NTLmVzY2FwZSggdiApO1xuXHRcdH1cblx0XHRyZXR1cm4gdi5yZXBsYWNlKCAvW15hLXpBLVowLTlfXFwtXS9nLCAnXFxcXCQmJyApO1xuXHR9XG5cblx0ZnVuY3Rpb24gZmluZF9mc19yb290KGVsKSB7XG5cdFx0aWYgKCAhIGVsIHx8ICEgZWwuY2xvc2VzdCApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdC8vIDEpIERpcmVjdDogZWxlbWVudCBvciBhbmNlc3RvciBjYXJyaWVzIEZTIGtleSAoaW5wdXQvc2VsZWN0L3RleHRhcmVhIHdyaXRlciwgcmFkaW8gd3JhcHBlciwgZXRjLilcblx0XHRjb25zdCBkaXJlY3QgPSBlbC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1iZmItZnMta2V5XScgKTtcblx0XHRpZiAoIGRpcmVjdCApIHtcblx0XHRcdHJldHVybiBkaXJlY3Q7XG5cdFx0fVxuXG5cdFx0Ly8gMikgTGVuZ3RoOiBldmVudCBjYW1lIGZyb20gbnVtYmVyL3VuaXQvcmFuZ2UgaW5zaWRlIC53cGJjX3NsaWRlcl9sZW5fZ3JvdXBcblx0XHRjb25zdCBsZW5fZ3JvdXAgPSBlbC5jbG9zZXN0KCAnLndwYmNfc2xpZGVyX2xlbl9ncm91cCcgKTtcblx0XHRpZiAoIGxlbl9ncm91cCApIHtcblx0XHRcdHJldHVybiAoXG5cdFx0XHRcdGxlbl9ncm91cC5xdWVyeVNlbGVjdG9yKCAnaW5wdXRbZGF0YS13cGJjX3NsaWRlcl9sZW5fd3JpdGVyXVtkYXRhLXdwYmMtYmZiLWZzLWtleV0nICkgfHxcblx0XHRcdFx0bGVuX2dyb3VwLnF1ZXJ5U2VsZWN0b3IoICdpbnB1dFtkYXRhLXdwYmMtYmZiLWZzLXR5cGU9XCJsZW5ndGhcIl1bZGF0YS13cGJjLWJmYi1mcy1rZXldJyApIHx8XG5cdFx0XHRcdG51bGxcblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0Ly8gMykgU3BhY2luZzogZXZlbnQgY2FtZSBmcm9tIHZlcnRpY2FsL2hvcml6b250YWwgbnVtYmVyIGluc2lkZSAud3BiY19zcGFjaW5nX2dyb3VwLlxuXHRcdGNvbnN0IHNwYWNpbmdfZ3JvdXAgPSBlbC5jbG9zZXN0KCAnLndwYmNfc3BhY2luZ19ncm91cCcgKTtcblx0XHRpZiAoIHNwYWNpbmdfZ3JvdXAgKSB7XG5cdFx0XHRyZXR1cm4gKFxuXHRcdFx0XHRzcGFjaW5nX2dyb3VwLnF1ZXJ5U2VsZWN0b3IoICdpbnB1dFtkYXRhLXdwYmNfc3BhY2luZ193cml0ZXJdW2RhdGEtd3BiYy1iZmItZnMta2V5XScgKSB8fFxuXHRcdFx0XHRzcGFjaW5nX2dyb3VwLnF1ZXJ5U2VsZWN0b3IoICdpbnB1dFtkYXRhLXdwYmMtYmZiLWZzLXR5cGU9XCJzcGFjaW5nXCJdW2RhdGEtd3BiYy1iZmItZnMta2V5XScgKSB8fFxuXHRcdFx0XHRudWxsXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdC8vIDQpIFJhbmdlOiBldmVudCBjYW1lIGZyb20gcmFuZ2UgaW5wdXQgaW5zaWRlIC53cGJjX3NsaWRlcl9yYW5nZV9ncm91cFxuXHRcdGNvbnN0IHJhbmdlX2dyb3VwID0gZWwuY2xvc2VzdCggJy53cGJjX3NsaWRlcl9yYW5nZV9ncm91cCcgKTtcblx0XHRpZiAoIHJhbmdlX2dyb3VwICkge1xuXHRcdFx0cmV0dXJuIChcblx0XHRcdFx0cmFuZ2VfZ3JvdXAucXVlcnlTZWxlY3RvciggJ2lucHV0W2RhdGEtd3BiY19zbGlkZXJfcmFuZ2Vfd3JpdGVyXVtkYXRhLXdwYmMtYmZiLWZzLWtleV0nICkgfHxcblx0XHRcdFx0cmFuZ2VfZ3JvdXAucXVlcnlTZWxlY3RvciggJ2lucHV0W2RhdGEtd3BiY19zbGlkZXJfcmFuZ2Vfd3JpdGVyXScgKSB8fFxuXHRcdFx0XHRudWxsXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0ZnVuY3Rpb24gcmVhZF92YWx1ZV9mcm9tX2ZzX3Jvb3QoZnNfcm9vdCwgb3JpZ2luYWxfdGFyZ2V0KSB7XG5cdFx0aWYgKCAhIGZzX3Jvb3QgKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZnNfdHlwZSA9IFN0cmluZyggZnNfcm9vdC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYmZiLWZzLXR5cGUnICkgfHwgJycgKTtcblxuXHRcdC8vIFJBRElPOiByZWFkIGNoZWNrZWQgd2l0aGluIHdyYXBwZXIuXG5cdFx0aWYgKCBmc190eXBlID09PSAncmFkaW8nICkge1xuXHRcdFx0Y29uc3QgY29udHJvbF9pZCA9IGZzX3Jvb3QuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJmYi1mcy1jb250cm9saWQnICkgfHwgJyc7XG5cdFx0XHRjb25zdCBzZWxlY3RvciAgID0gY29udHJvbF9pZFxuXHRcdFx0XHQ/ICdpbnB1dFt0eXBlPVwicmFkaW9cIl1bbmFtZT1cIicgKyBjc3NfZXNjYXBlKCBjb250cm9sX2lkICkgKyAnXCJdOmNoZWNrZWQnXG5cdFx0XHRcdDogJ2lucHV0W3R5cGU9XCJyYWRpb1wiXTpjaGVja2VkJztcblxuXHRcdFx0Y29uc3QgY2hlY2tlZCA9IGZzX3Jvb3QucXVlcnlTZWxlY3Rvciggc2VsZWN0b3IgKTtcblx0XHRcdHJldHVybiBjaGVja2VkID8gU3RyaW5nKCBjaGVja2VkLnZhbHVlIHx8ICcnICkgOiAnJztcblx0XHR9XG5cblx0XHRpZiAoIGZzX3R5cGUgPT09ICdzcGFjaW5nJyApIHtcblx0XHRcdGNvbnN0IGdyb3VwID0gKCBvcmlnaW5hbF90YXJnZXQgJiYgb3JpZ2luYWxfdGFyZ2V0LmNsb3Nlc3QgKSA/IG9yaWdpbmFsX3RhcmdldC5jbG9zZXN0KCAnLndwYmNfc3BhY2luZ19ncm91cCcgKSA6IGZzX3Jvb3QuY2xvc2VzdCggJy53cGJjX3NwYWNpbmdfZ3JvdXAnICk7XG5cdFx0XHRjb25zdCB2ZXJ0aWNhbF9pbnB1dCA9IGdyb3VwID8gZ3JvdXAucXVlcnlTZWxlY3RvciggJ2lucHV0W2RhdGEtd3BiY19zcGFjaW5nX3ZlcnRpY2FsXScgKSA6IG51bGw7XG5cdFx0XHRjb25zdCBob3Jpem9udGFsX2lucHV0ID0gZ3JvdXAgPyBncm91cC5xdWVyeVNlbGVjdG9yKCAnaW5wdXRbZGF0YS13cGJjX3NwYWNpbmdfaG9yaXpvbnRhbF0nICkgOiBudWxsO1xuXHRcdFx0Y29uc3Qgd3JpdGVyID0gZ3JvdXAgPyBncm91cC5xdWVyeVNlbGVjdG9yKCAnaW5wdXRbZGF0YS13cGJjX3NwYWNpbmdfd3JpdGVyXScgKSA6IG51bGw7XG5cdFx0XHRjb25zdCB2ZXJ0aWNhbCA9IHZlcnRpY2FsX2lucHV0ID8gU3RyaW5nKCB2ZXJ0aWNhbF9pbnB1dC52YWx1ZSB8fCAnMCcgKSA6ICcwJztcblx0XHRcdGNvbnN0IGhvcml6b250YWwgPSBob3Jpem9udGFsX2lucHV0ID8gU3RyaW5nKCBob3Jpem9udGFsX2lucHV0LnZhbHVlIHx8IHZlcnRpY2FsICkgOiB2ZXJ0aWNhbDtcblx0XHRcdGNvbnN0IGNvbWJpbmVkID0gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19ub3JtYWxpemVfc3BhY2luZ19udW1iZXJzKCB2ZXJ0aWNhbCwgaG9yaXpvbnRhbCApO1xuXG5cdFx0XHRpZiAoIHdyaXRlciApIHtcblx0XHRcdFx0d3JpdGVyLnZhbHVlID0gY29tYmluZWQ7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBjb21iaW5lZDtcblx0XHR9XG5cblx0XHQvLyBDSEVDS0JPWCAvIFRPR0dMRVxuXHRcdGlmICggKG9yaWdpbmFsX3RhcmdldCAmJiBvcmlnaW5hbF90YXJnZXQudHlwZSA9PT0gJ2NoZWNrYm94JykgfHwgZnNfcm9vdC50eXBlID09PSAnY2hlY2tib3gnICkge1xuXHRcdFx0Y29uc3QgY2IgPSAob3JpZ2luYWxfdGFyZ2V0ICYmIG9yaWdpbmFsX3RhcmdldC50eXBlID09PSAnY2hlY2tib3gnKSA/IG9yaWdpbmFsX3RhcmdldCA6IGZzX3Jvb3Q7XG5cdFx0XHRyZXR1cm4gY2IuY2hlY2tlZCA/ICdPbicgOiAnT2ZmJztcblx0XHR9XG5cblx0XHQvLyBERUZBVUxUOiB3cml0ZXIvaW5wdXQvdGV4dGFyZWEvc2VsZWN0XG5cdFx0aWYgKCBmc19yb290LnZhbHVlICE9IG51bGwgKSB7XG5cdFx0XHRyZXR1cm4gU3RyaW5nKCBmc19yb290LnZhbHVlICk7XG5cdFx0fVxuXHRcdGlmICggb3JpZ2luYWxfdGFyZ2V0ICYmIG9yaWdpbmFsX3RhcmdldC52YWx1ZSAhPSBudWxsICkge1xuXHRcdFx0cmV0dXJuIFN0cmluZyggb3JpZ2luYWxfdGFyZ2V0LnZhbHVlICk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICcnO1xuXHR9XG5cblx0ZnVuY3Rpb24gYXBwbHlfY2hhbmdlX2Zyb21fdGFyZ2V0KHRhcmdldCwgZXZlbnRfdHlwZSwgZXZlbnRfc291cmNlKSB7XG5cdFx0aWYgKCAhIHRhcmdldCApIHsgcmV0dXJuOyB9XG5cblx0XHRjb25zdCBmc19yb290ID0gZmluZF9mc19yb290KCB0YXJnZXQgKTtcblx0XHRpZiAoICEgZnNfcm9vdCApIHsgcmV0dXJuOyB9XG5cblxuXHRcdC8vIE5vcm1hbGl6ZSBldmVudHMgc28gZWFjaCBjb250cm9sIHByb2R1Y2VzIGV4YWN0bHkgb25lIGVmZmVjdCBjYWxsLlxuXHRcdC8vIC0gdG9nZ2xlL3NlbGVjdC9yYWRpby9jaGVja2JveCA9PiBcImNoYW5nZVwiIG9ubHkuXG5cdFx0Ly8gLSBldmVyeXRoaW5nIGVsc2UgICAgICAgICAgICAgID0+IFwiaW5wdXRcIiBvbmx5LlxuXHRcdGNvbnN0IGZzX3R5cGUgPSBTdHJpbmcoIGZzX3Jvb3QuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJmYi1mcy10eXBlJyApIHx8ICcnICk7XG5cdFx0Y29uc3QgdGFnICAgICA9IFN0cmluZyggdGFyZ2V0LnRhZ05hbWUgfHwgJycgKS50b0xvd2VyQ2FzZSgpO1xuXHRcdGNvbnN0IHR5cGUgICAgPSBTdHJpbmcoIHRhcmdldC50eXBlIHx8ICcnICkudG9Mb3dlckNhc2UoKTtcblxuXHRcdGNvbnN0IHVzZV9jaGFuZ2UgPSAoZnNfdHlwZSA9PT0gJ3RvZ2dsZScpIHx8IChmc190eXBlID09PSAnc2VsZWN0JykgfHwgKGZzX3R5cGUgPT09ICdyYWRpbycpIHx8ICh0eXBlID09PSAnY2hlY2tib3gnKSB8fCAodHlwZSA9PT0gJ3JhZGlvJykgfHwgKHRhZyA9PT0gJ3NlbGVjdCcpO1xuXG5cdFx0aWYgKCB1c2VfY2hhbmdlICYmIGV2ZW50X3R5cGUgIT09ICdjaGFuZ2UnICkgeyByZXR1cm47IH1cblx0XHRpZiAoICEgdXNlX2NoYW5nZSAmJiBldmVudF90eXBlICE9PSAnaW5wdXQnICkgeyByZXR1cm47IH1cblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cblx0XHRjb25zdCBrZXkgPSBmc19yb290LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1iZmItZnMta2V5JyApO1xuXHRcdGlmICggISBrZXkgKSB7IHJldHVybjsgfVxuXG5cdFx0Y29uc3Qgc2NvcGUgPSBmc19yb290LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1iZmItZnMtc2NvcGUnICkgfHwgJyc7XG5cdFx0Y29uc3QgdmFsdWUgPSByZWFkX3ZhbHVlX2Zyb21fZnNfcm9vdCggZnNfcm9vdCwgdGFyZ2V0ICk7XG5cblx0XHRFZmZlY3RzLmFwcGx5X29uZSgga2V5LCB2YWx1ZSwgeyBzb3VyY2U6IGV2ZW50X3NvdXJjZSB8fCAndWknLCBzY29wZTogc2NvcGUsIGNvbnRyb2w6IHRhcmdldCwgZnNfcm9vdDogZnNfcm9vdCB9ICk7XG5cdH1cblxuXHRmdW5jdGlvbiBpc19jb2xvcmlzX2NvbnRyb2wodGFyZ2V0KSB7XG5cdFx0aWYgKCAhIHRhcmdldCB8fCAhIHRhcmdldC5tYXRjaGVzICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtYmZiLWZzLXR5cGU9XCJjb2xvclwiXSwgW2RhdGEtaW5zcGVjdG9yLXR5cGU9XCJjb2xvclwiXSwgLndwYmNfYmZiX2NvbG9yaXMnICk7XG5cdH1cblxuXHRmdW5jdGlvbiBvbl9jaGFuZ2UoZXYpIHtcblx0XHQvLyBJZ25vcmUgZ2VuZXJpYyBzeW50aGV0aWMgZXZlbnRzIGRpc3BhdGNoZWQgYnkgY29kZSAoYXBwbHkvcmVhcHBseSwgc2xpZGVyIHN5bmMsIGV0Yy4pLlxuXHRcdC8vIENvbG9yaXMgZGlzcGF0Y2hlcyBzeW50aGV0aWMgaW5wdXQgZXZlbnRzIHdoaWxlIHRoZSB1c2VyIHBpY2tzIGEgY29sb3IsIHNvIGFsbG93IHRob3NlIGNvbG9yIGNvbnRyb2xzIHRocm91Z2guXG5cdFx0aWYgKCBldiAmJiBldi5pc1RydXN0ZWQgPT09IGZhbHNlICYmICEgaXNfY29sb3Jpc19jb250cm9sKCBldi50YXJnZXQgKSApIHsgcmV0dXJuOyB9XG5cdFx0YXBwbHlfY2hhbmdlX2Zyb21fdGFyZ2V0KCBldiAmJiBldi50YXJnZXQsIGV2ICYmIGV2LnR5cGUsICggZXYgJiYgZXYuaXNUcnVzdGVkID09PSBmYWxzZSApID8gJ2NvbG9yaXMnIDogJ3VpJyApO1xuXHR9XG5cblx0ZC5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCBvbl9jaGFuZ2UsIGZhbHNlICk7XG5cdGQuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIG9uX2NoYW5nZSwgZmFsc2UgKTtcblx0ZnVuY3Rpb24gb25fY29sb3Jpc19waWNrKGV2KSB7XG5cdFx0Y29uc3QgZGV0YWlsID0gZXYgJiYgZXYuZGV0YWlsID8gZXYuZGV0YWlsIDoge307XG5cdFx0Y29uc3QgdGFyZ2V0ID0gZGV0YWlsLmN1cnJlbnRFbCB8fCBkZXRhaWwuZWwgfHwgZGV0YWlsLmlucHV0IHx8IGV2LnRhcmdldCB8fCBudWxsO1xuXG5cdFx0aWYgKCAhIGlzX2NvbG9yaXNfY29udHJvbCggdGFyZ2V0ICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCBkZXRhaWwuY29sb3IgJiYgdGFyZ2V0LnZhbHVlICE9PSBkZXRhaWwuY29sb3IgKSB7XG5cdFx0XHR0YXJnZXQudmFsdWUgPSBkZXRhaWwuY29sb3I7XG5cdFx0fVxuXG5cdFx0YXBwbHlfY2hhbmdlX2Zyb21fdGFyZ2V0KCB0YXJnZXQsICdpbnB1dCcsICdjb2xvcmlzJyApO1xuXHR9XG5cdGQuYWRkRXZlbnRMaXN0ZW5lciggJ2NvbG9yaXM6cGljaycsIG9uX2NvbG9yaXNfcGljaywgZmFsc2UgKTtcblx0ZC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzpiZmI6Y29sb3JpczpjaGFuZ2UnLCBvbl9jb2xvcmlzX3BpY2ssIGZhbHNlICk7XG5cbn0pKCB3aW5kb3csIGRvY3VtZW50ICk7XG5cbmZ1bmN0aW9uIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fZ2V0X3ByZXNldHMoKSB7XG5cdHJldHVybiB7XG5cdFx0Ym9yZGVyZWQ6IHtcblx0XHRcdGJhY2tncm91bmQgOiAnI2ZmZmZmZicsXG5cdFx0XHRib3JkZXJDb2xvcjogJyNjY2NjY2MnLFxuXHRcdFx0Ym9yZGVyV2lkdGg6ICcxcHgnLFxuXHRcdFx0cmFkaXVzICAgICA6ICcycHgnLFxuXHRcdFx0cGFkZGluZyAgICA6ICcxMHB4IDMwcHgnLFxuXHRcdFx0c2hhZG93ICAgICA6ICdyZ2JhKDAsIDAsIDAsIDAuMDUpIDBweCAycHggNnB4IDBweCdcblx0XHR9LFxuXHRcdG5vbmUgICAgOiB7XG5cdFx0XHRiYWNrZ3JvdW5kIDogJ3RyYW5zcGFyZW50Jyxcblx0XHRcdGJvcmRlckNvbG9yOiAndHJhbnNwYXJlbnQnLFxuXHRcdFx0Ym9yZGVyV2lkdGg6ICcwcHgnLFxuXHRcdFx0cmFkaXVzICAgICA6ICcwcHgnLFxuXHRcdFx0cGFkZGluZyAgICA6ICcwcHgnLFxuXHRcdFx0c2hhZG93ICAgICA6ICdub25lJ1xuXHRcdH0sXG5cdFx0c29mdCAgICA6IHtcblx0XHRcdGJhY2tncm91bmQgOiAnI2Y5ZjlmYScsXG5cdFx0XHRib3JkZXJDb2xvcjogJyNmZmYnLFxuXHRcdFx0Ym9yZGVyV2lkdGg6ICczcHgnLFxuXHRcdFx0cmFkaXVzICAgICA6ICc4cHgnLFxuXHRcdFx0cGFkZGluZyAgICA6ICcyMHB4Jyxcblx0XHRcdHNoYWRvdyAgICAgOiAncmdiYSgxNSwgMjMsIDQyLCAwLjA2KSAwcHggNHB4IDE2cHggMHB4J1xuXHRcdH1cblx0fTtcbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19pc19kYXJrX3RoZW1lKG9wdGlvbnMpIHtcblx0b3B0aW9ucyA9IG9wdGlvbnMgJiYgdHlwZW9mIG9wdGlvbnMgPT09ICdvYmplY3QnID8gb3B0aW9ucyA6IHt9O1xuXHRyZXR1cm4gJ3dwYmNfdGhlbWVfZGFya18xJyA9PT0gU3RyaW5nKCBvcHRpb25zLmJvb2tpbmdfZm9ybV90aGVtZSB8fCAnJyApO1xufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2dldF9wcmVzZXRfZm9yX29wdGlvbnMoc3R5bGUsIG9wdGlvbnMpIHtcblx0Y29uc3QgcHJlc2V0cyA9IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fZ2V0X3ByZXNldHMoKTtcblxuXHRpZiAoICEgd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19pc19kYXJrX3RoZW1lKCBvcHRpb25zICkgKSB7XG5cdFx0cmV0dXJuIHByZXNldHNbc3R5bGVdIHx8IHByZXNldHMuYm9yZGVyZWQ7XG5cdH1cblxuXHRpZiAoICdzb2Z0JyA9PT0gc3R5bGUgKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGJhY2tncm91bmQgOiAnIzFmMjkzNycsXG5cdFx0XHRib3JkZXJDb2xvcjogJyMzMzQxNTUnLFxuXHRcdFx0Ym9yZGVyV2lkdGg6ICczcHgnLFxuXHRcdFx0cmFkaXVzICAgICA6ICc4cHgnLFxuXHRcdFx0cGFkZGluZyAgICA6ICcyMHB4Jyxcblx0XHRcdHNoYWRvdyAgICAgOiAncmdiYSgwLCAwLCAwLCAwLjI0KSAwcHggNHB4IDE2cHggMHB4J1xuXHRcdH07XG5cdH1cblxuXHRyZXR1cm4gcHJlc2V0c1tzdHlsZV0gfHwgcHJlc2V0cy5ib3JkZXJlZDtcbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9jb2xvcih2YWx1ZSwgZmFsbGJhY2spIHtcblx0Y29uc3QgdiA9IFN0cmluZyggdmFsdWUgPT0gbnVsbCA/ICcnIDogdmFsdWUgKS50cmltKCk7XG5cdGlmICggL14jKD86WzAtOWEtZl17M318WzAtOWEtZl17Nn0pJC9pLnRlc3QoIHYgKSApIHtcblx0XHRyZXR1cm4gdjtcblx0fVxuXHRpZiAoIHYgPT09ICd0cmFuc3BhcmVudCcgKSB7XG5cdFx0cmV0dXJuIHY7XG5cdH1cblx0cmV0dXJuIGZhbGxiYWNrO1xufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX29wdGlvbmFsX2NvbG9yKHZhbHVlKSB7XG5cdHJldHVybiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2NvbG9yKCB2YWx1ZSwgJycgKTtcbn1cblxuLyoqXG4gKiBSZXNvbHZlIGFuIG9wYXF1ZSBhY2NlbnQgY29sb3Igd2l0aCB0aGUgUEhQLWxvY2FsaXplZCBpbnN0YWxsYXRpb24gZGVmYXVsdC5cbiAqXG4gKiBUaGUgRm9ybSBTdHlsZSBlZmZlY3RzIGxpdmUgb3V0c2lkZSB0aGUgcmVnaXN0cmF0aW9uIElJRkUsIHNvIHRoZSBkZWZhdWx0IGlzXG4gKiBkZWxpYmVyYXRlbHkgcmVhZCBmcm9tIHRoZSBzaGFyZWQgbG9jYWxpemVkIHBheWxvYWQgYXQgdGhlIHBvaW50IG9mIHVzZS5cbiAqIEludmFsaWQgcmVxdWVzdGVkIGFuZCBsb2NhbGl6ZWQgdmFsdWVzIHJldHVybiBhbiBlbXB0eSBzdHJpbmcsIGFsbG93aW5nIHRoZVxuICogY2FsbGVyIHRvIHNraXAgdGhlIGFjY2VudCBvdmVybGF5IHdpdGhvdXQgdGhyb3dpbmcgb3IgcHJvZHVjaW5nIGludmFsaWQgQ1NTLlxuICpcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgUmVxdWVzdGVkIGFjY2VudCBjb2xvci5cbiAqIEByZXR1cm4ge3N0cmluZ30gVmFsaWQgdGhyZWUtIG9yIHNpeC1kaWdpdCBoZXhhZGVjaW1hbCBjb2xvciwgb3IgYW4gZW1wdHkgc3RyaW5nLlxuICovXG5mdW5jdGlvbiB3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fc2FuaXRpemVfYWNjZW50X2NvbG9yKHZhbHVlKSB7XG5cdGNvbnN0IHJlcXVlc3RlZF9jb2xvciA9IFN0cmluZyggdmFsdWUgPT0gbnVsbCA/ICcnIDogdmFsdWUgKS50cmltKCk7XG5cdGlmICggL14jKD86WzAtOWEtZl17M318WzAtOWEtZl17Nn0pJC9pLnRlc3QoIHJlcXVlc3RlZF9jb2xvciApICkge1xuXHRcdHJldHVybiByZXF1ZXN0ZWRfY29sb3I7XG5cdH1cblxuXHRjb25zdCBzZXR0aW5nc192YXJzID0gd2luZG93LndwYmNfYmZiX3NldHRpbmdzX3ZhcnMgJiYgdHlwZW9mIHdpbmRvdy53cGJjX2JmYl9zZXR0aW5nc192YXJzID09PSAnb2JqZWN0J1xuXHRcdD8gd2luZG93LndwYmNfYmZiX3NldHRpbmdzX3ZhcnNcblx0XHQ6IHt9O1xuXHRjb25zdCBhY2NlbnRfZGVmYXVsdHMgPSBzZXR0aW5nc192YXJzLmZvcm1fYWNjZW50X2RlZmF1bHRzICYmIHR5cGVvZiBzZXR0aW5nc192YXJzLmZvcm1fYWNjZW50X2RlZmF1bHRzID09PSAnb2JqZWN0J1xuXHRcdD8gc2V0dGluZ3NfdmFycy5mb3JtX2FjY2VudF9kZWZhdWx0c1xuXHRcdDoge307XG5cdGNvbnN0IGRlZmF1bHRfY29sb3IgPSBTdHJpbmcoIGFjY2VudF9kZWZhdWx0cy5ib29raW5nX2Zvcm1fYWNjZW50X2NvbG9yIHx8ICcnICkudHJpbSgpO1xuXG5cdHJldHVybiAvXiMoPzpbMC05YS1mXXszfXxbMC05YS1mXXs2fSkkL2kudGVzdCggZGVmYXVsdF9jb2xvciApID8gZGVmYXVsdF9jb2xvciA6ICcnO1xufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2xlbmd0aCh2YWx1ZSwgZmFsbGJhY2spIHtcblx0Y29uc3QgdiA9IFN0cmluZyggdmFsdWUgPT0gbnVsbCA/ICcnIDogdmFsdWUgKS50cmltKCk7XG5cdGlmICggL15cXGQrKD86XFwuXFxkKyk/KD86cHh8cmVtfGVtfCUpJC9pLnRlc3QoIHYgKSApIHtcblx0XHRyZXR1cm4gdjtcblx0fVxuXHRyZXR1cm4gZmFsbGJhY2s7XG59XG5cbmZ1bmN0aW9uIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfc3BhY2luZyh2YWx1ZSwgZmFsbGJhY2spIHtcblx0Y29uc3QgdiA9IFN0cmluZyggdmFsdWUgPT0gbnVsbCA/ICcnIDogdmFsdWUgKS50cmltKCkucmVwbGFjZSggL1xccysvZywgJyAnICk7XG5cdGNvbnN0IHBhcnRzID0gdiA/IHYuc3BsaXQoICcgJyApIDogW107XG5cdGlmICggcGFydHMubGVuZ3RoIDwgMSB8fCBwYXJ0cy5sZW5ndGggPiA0ICkge1xuXHRcdHJldHVybiBmYWxsYmFjaztcblx0fVxuXHRmb3IgKCBsZXQgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7IGkrKyApIHtcblx0XHRpZiAoICEgL15cXGQrKD86XFwuXFxkKyk/KD86cHh8cmVtfGVtfCUpJC9pLnRlc3QoIHBhcnRzW2ldICkgKSB7XG5cdFx0XHRyZXR1cm4gZmFsbGJhY2s7XG5cdFx0fVxuXHR9XG5cdHJldHVybiBwYXJ0cy5qb2luKCAnICcgKTtcbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19ub3JtYWxpemVfc3BhY2luZ19udW1iZXJzKHZlcnRpY2FsLCBob3Jpem9udGFsKSB7XG5cdGNvbnN0IHYgPSBTdHJpbmcoIHZlcnRpY2FsID09IG51bGwgPyAnJyA6IHZlcnRpY2FsICkudHJpbSgpO1xuXHRjb25zdCBoID0gU3RyaW5nKCBob3Jpem9udGFsID09IG51bGwgPyAnJyA6IGhvcml6b250YWwgKS50cmltKCk7XG5cdGNvbnN0IHZlcnRpY2FsX251bSA9IC9eXFxkKyg/OlxcLlxcZCspPyQvLnRlc3QoIHYgKSA/IHYgOiAnMCc7XG5cdGNvbnN0IGhvcml6b250YWxfbnVtID0gL15cXGQrKD86XFwuXFxkKyk/JC8udGVzdCggaCApID8gaCA6IHZlcnRpY2FsX251bTtcblxuXHRyZXR1cm4gdmVydGljYWxfbnVtICsgJ3B4ICcgKyBob3Jpem9udGFsX251bSArICdweCc7XG59XG5cbmZ1bmN0aW9uIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fY29sbGVjdF9vcHRpb25zKGN0eCwga2V5LCB2YWx1ZSkge1xuXHRsZXQgb3B0aW9ucyA9IChjdHggJiYgY3R4Lm9wdGlvbnMgJiYgdHlwZW9mIGN0eC5vcHRpb25zID09PSAnb2JqZWN0JykgPyBPYmplY3QuYXNzaWduKCB7fSwgY3R4Lm9wdGlvbnMgKSA6IHt9O1xuXG5cdGlmICggd2luZG93LldQQkNfQkZCX0Zvcm1TZXR0aW5ncyAmJiB0eXBlb2Ygd2luZG93LldQQkNfQkZCX0Zvcm1TZXR0aW5ncy5jb2xsZWN0ID09PSAnZnVuY3Rpb24nICkge1xuXHRcdG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKCB3aW5kb3cuV1BCQ19CRkJfRm9ybVNldHRpbmdzLmNvbGxlY3QoICdmb3JtJyApIHx8IHt9LCBvcHRpb25zICk7XG5cdH1cblxuXHRpZiAoIGtleSApIHtcblx0XHRvcHRpb25zW1N0cmluZygga2V5ICldID0gdmFsdWU7XG5cdH1cblxuXHRpZiAoIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9faXNfY3VzdG9tX2NvbnRyb2xfa2V5KCBrZXkgKSApIHtcblx0XHRvcHRpb25zLmJvb2tpbmdfZm9ybV9jb250YWluZXJfc3R5bGUgPSAnY3VzdG9tJztcblx0XHR3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3NldF9jb250YWluZXJfc3R5bGVfY29udHJvbCggJ2N1c3RvbScgKTtcblx0fVxuXG5cdHJldHVybiBvcHRpb25zO1xufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2dldF9jdXN0b21fY29udHJvbF9rZXlzKCkge1xuXHRyZXR1cm4gW1xuXHRcdCdib29raW5nX2Zvcm1fYmFja2dyb3VuZF9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9ib3JkZXJfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fYm9yZGVyX3dpZHRoJyxcblx0XHQnYm9va2luZ19mb3JtX2JvcmRlcl9yYWRpdXMnLFxuXHRcdCdib29raW5nX2Zvcm1fcGFkZGluZycsXG5cdFx0J2Jvb2tpbmdfZm9ybV90ZXh0X2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2ZpZWxkX2JhY2tncm91bmRfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fZmllbGRfdGV4dF9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9maWVsZF9ib3JkZXJfY29sb3InXG5cdF07XG59XG5cbmZ1bmN0aW9uIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9faXNfY3VzdG9tX2NvbnRyb2xfa2V5KGtleSkge1xuXHRyZXR1cm4gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19nZXRfY3VzdG9tX2NvbnRyb2xfa2V5cygpLmluZGV4T2YoIFN0cmluZygga2V5IHx8ICcnICkgKSAhPT0gLTE7XG59XG5cbmZ1bmN0aW9uIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2V0X2NvbnRhaW5lcl9zdHlsZV9jb250cm9sKHZhbHVlKSB7XG5cdGNvbnN0IGNvbnRyb2wgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1iZmItZnMta2V5PVwiYm9va2luZ19mb3JtX2NvbnRhaW5lcl9zdHlsZVwiXScgKTtcblx0aWYgKCAhIGNvbnRyb2wgfHwgY29udHJvbC52YWx1ZSA9PT0gdmFsdWUgKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29udHJvbC52YWx1ZSA9IHZhbHVlO1xufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3NldF9yYWRpb19jb250cm9sKGtleSwgdmFsdWUpIHtcblx0Y29uc3Qgcm93ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fZm9ybV9zZXR0aW5nW2RhdGEta2V5PVwiJyArIGtleSArICdcIl0nICk7XG5cdGlmICggISByb3cgKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3Qgd3JhcCA9IHJvdy5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19mb3JtX3NldHRpbmdfcmFkaW9bZGF0YS13cGJjLWJmYi1mcy1jb250cm9saWRdJyApO1xuXHRjb25zdCBjb250cm9sX2lkID0gd3JhcCA/IFN0cmluZyggd3JhcC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYmZiLWZzLWNvbnRyb2xpZCcgKSB8fCAnJyApIDogJyc7XG5cdGNvbnN0IHJhZGlvcyA9IGNvbnRyb2xfaWRcblx0XHQ/IHJvdy5xdWVyeVNlbGVjdG9yQWxsKCAnaW5wdXRbdHlwZT1cInJhZGlvXCJdW25hbWU9XCInICsgY29udHJvbF9pZCArICdcIl0nIClcblx0XHQ6IHJvdy5xdWVyeVNlbGVjdG9yQWxsKCAnaW5wdXRbdHlwZT1cInJhZGlvXCJdJyApO1xuXG5cdHJhZGlvcy5mb3JFYWNoKCBmdW5jdGlvbiAocmFkaW8pIHtcblx0XHRjb25zdCBzaG91bGRfY2hlY2sgPSAoIFN0cmluZyggcmFkaW8udmFsdWUgKSA9PT0gU3RyaW5nKCB2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSApICk7XG5cdFx0cmFkaW8uY2hlY2tlZCA9IHNob3VsZF9jaGVjaztcblxuXHRcdGNvbnN0IGNob2ljZSA9IHJhZGlvLmNsb3Nlc3QgPyByYWRpby5jbG9zZXN0KCAnLndwYmNfdGhlbWVfY2hvaWNlJyApIDogbnVsbDtcblx0XHRpZiAoIGNob2ljZSApIHtcblx0XHRcdGNob2ljZS5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtc2VsZWN0ZWQnLCBzaG91bGRfY2hlY2sgKTtcblx0XHR9XG5cdH0gKTtcbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zZXRfc2VsZWN0X2NvbnRyb2woa2V5LCB2YWx1ZSkge1xuXHRjb25zdCBjb250cm9sID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYmZiLWZzLWtleT1cIicgKyBrZXkgKyAnXCJdJyApO1xuXHRpZiAoIGNvbnRyb2wgKSB7XG5cdFx0Y29udHJvbC52YWx1ZSA9IFN0cmluZyggdmFsdWUgPT0gbnVsbCA/ICcnIDogdmFsdWUgKTtcblx0fVxufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2dldF9jdXJyZW50X29wdGlvbnMoKSB7XG5cdHJldHVybiB3aW5kb3cuV1BCQ19CRkJfRm9ybVNldHRpbmdzICYmIHR5cGVvZiB3aW5kb3cuV1BCQ19CRkJfRm9ybVNldHRpbmdzLmNvbGxlY3QgPT09ICdmdW5jdGlvbidcblx0XHQ/IHdpbmRvdy5XUEJDX0JGQl9Gb3JtU2V0dGluZ3MuY29sbGVjdCggJ2Zvcm0nICkgfHwge31cblx0XHQ6IHt9O1xufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2dldF9zdHlsZV92YWx1ZV9mcm9tX29wdGlvbnMob3B0aW9ucykge1xuXHRvcHRpb25zID0gb3B0aW9ucyAmJiB0eXBlb2Ygb3B0aW9ucyA9PT0gJ29iamVjdCcgPyBvcHRpb25zIDoge307XG5cblx0Y29uc3QgdGhlbWUgPSBTdHJpbmcoIG9wdGlvbnMuYm9va2luZ19mb3JtX3RoZW1lIHx8ICcnICk7XG5cdGNvbnN0IHN0eWxlID0gU3RyaW5nKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jb250YWluZXJfc3R5bGUgfHwgJ2luaGVyaXQnICk7XG5cblx0aWYgKCAnY3VzdG9tJyA9PT0gc3R5bGUgKSB7XG5cdFx0cmV0dXJuICdjdXN0b20nO1xuXHR9XG5cdGlmICggJ2luaGVyaXQnID09PSBzdHlsZSB8fCAnJyA9PT0gc3R5bGUgKSB7XG5cdFx0cmV0dXJuICdpbmhlcml0Jztcblx0fVxuXG5cdGNvbnN0IHByZWZpeCA9ICggJ3dwYmNfdGhlbWVfZGFya18xJyA9PT0gdGhlbWUgKSA/ICdkYXJrJyA6ICdsaWdodCc7XG5cdGlmICggWyAnYm9yZGVyZWQnLCAnbm9uZScsICdzb2Z0JyBdLmluZGV4T2YoIHN0eWxlICkgPT09IC0xICkge1xuXHRcdHJldHVybiBwcmVmaXggKyAnX2JvcmRlcmVkJztcblx0fVxuXG5cdHJldHVybiBwcmVmaXggKyAnXycgKyBzdHlsZTtcbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zeW5jX2Zvcm1fc3R5bGVfY29udHJvbChvcHRpb25zKSB7XG5cdHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2V0X3JhZGlvX2NvbnRyb2woICdib29raW5nX2Zvcm1fc3R5bGUnLCB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2dldF9zdHlsZV92YWx1ZV9mcm9tX29wdGlvbnMoIG9wdGlvbnMgKSApO1xufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Jlc29sdmVfZm9ybV9zdHlsZV9jaG9pY2UodmFsdWUpIHtcblx0Y29uc3QgY3VycmVudF9vcHRpb25zID0gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19nZXRfY3VycmVudF9vcHRpb25zKCk7XG5cdGNvbnN0IGN1cnJlbnRfdGhlbWUgPSBTdHJpbmcoIGN1cnJlbnRfb3B0aW9ucy5ib29raW5nX2Zvcm1fdGhlbWUgfHwgJycgKTtcblx0Y29uc3QgY2hvaWNlID0gU3RyaW5nKCB2YWx1ZSB8fCAnaW5oZXJpdCcgKTtcblxuXHRpZiAoICdjdXN0b20nID09PSBjaG9pY2UgKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGJvb2tpbmdfZm9ybV90aGVtZSAgICAgICAgICA6IGN1cnJlbnRfdGhlbWUsXG5cdFx0XHRib29raW5nX2Zvcm1fY29udGFpbmVyX3N0eWxlOiAnY3VzdG9tJ1xuXHRcdH07XG5cdH1cblx0aWYgKCAnaW5oZXJpdCcgPT09IGNob2ljZSB8fCAnJyA9PT0gY2hvaWNlICkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRib29raW5nX2Zvcm1fdGhlbWUgICAgICAgICAgOiAnJyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jb250YWluZXJfc3R5bGU6ICdpbmhlcml0J1xuXHRcdH07XG5cdH1cblxuXHRjb25zdCBwYXJ0cyA9IGNob2ljZS5zcGxpdCggJ18nICk7XG5cdGNvbnN0IHRoZW1lID0gKCAnZGFyaycgPT09IHBhcnRzWzBdICkgPyAnd3BiY190aGVtZV9kYXJrXzEnIDogJyc7XG5cdGNvbnN0IHN0eWxlID0gcGFydHNbMV0gfHwgJ2JvcmRlcmVkJztcblxuXHRyZXR1cm4ge1xuXHRcdGJvb2tpbmdfZm9ybV90aGVtZSAgICAgICAgICA6IHRoZW1lLFxuXHRcdGJvb2tpbmdfZm9ybV9jb250YWluZXJfc3R5bGU6ICggWyAnYm9yZGVyZWQnLCAnbm9uZScsICdzb2Z0JyBdLmluZGV4T2YoIHN0eWxlICkgPT09IC0xICkgPyAnYm9yZGVyZWQnIDogc3R5bGVcblx0fTtcbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19pc191c2VyX3RoZW1lX3N3aXRjaChjdHgpIHtcblx0Y29uc3Qgc291cmNlID0gU3RyaW5nKCBjdHggJiYgY3R4LnNvdXJjZSA/IGN0eC5zb3VyY2UgOiAnJyApO1xuXHRyZXR1cm4gWyAndWknLCAnY29sb3JpcycgXS5pbmRleE9mKCBzb3VyY2UgKSAhPT0gLTE7XG59XG5cbmZ1bmN0aW9uIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9faXNfY3VzdG9tX3N0eWxlKG9wdGlvbnMpIHtcblx0cmV0dXJuIFN0cmluZyggb3B0aW9ucyAmJiBvcHRpb25zLmJvb2tpbmdfZm9ybV9jb250YWluZXJfc3R5bGUgPyBvcHRpb25zLmJvb2tpbmdfZm9ybV9jb250YWluZXJfc3R5bGUgOiAnaW5oZXJpdCcgKSA9PT0gJ2N1c3RvbSc7XG59XG5cbmZ1bmN0aW9uIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc3luY19jdXN0b21fY29udHJvbHMob3B0aW9ucykge1xuXHRjb25zdCBpc19jdXN0b20gPSB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2lzX2N1c3RvbV9zdHlsZSggb3B0aW9ucyApO1xuXHRjb25zdCByZXNldF9yb3cgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1iZmItY3VzdG9tLWFwcGVhcmFuY2UtcmVzZXQtcm93XScgKTtcblx0Y29uc3QgYmFzZV90aGVtZV9yb3cgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19mb3JtX3NldHRpbmdbZGF0YS1rZXk9XCJib29raW5nX2Zvcm1fdGhlbWVcIl0nICk7XG5cblx0d3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19nZXRfY3VzdG9tX2NvbnRyb2xfa2V5cygpLmZvckVhY2goIGZ1bmN0aW9uIChrZXkpIHtcblx0XHRjb25zdCByb3cgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19mb3JtX3NldHRpbmdbZGF0YS1rZXk9XCInICsga2V5ICsgJ1wiXScgKTtcblx0XHRpZiAoICEgcm93ICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRyb3cuaGlkZGVuID0gISBpc19jdXN0b207XG5cdFx0cm93LnNldEF0dHJpYnV0ZSggJ2FyaWEtaGlkZGVuJywgaXNfY3VzdG9tID8gJ2ZhbHNlJyA6ICd0cnVlJyApO1xuXHRcdHJvdy5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtaGlkZGVuJywgISBpc19jdXN0b20gKTtcblx0fSApO1xuXG5cdGlmICggcmVzZXRfcm93ICkge1xuXHRcdHJlc2V0X3Jvdy5oaWRkZW4gPSAhIGlzX2N1c3RvbTtcblx0XHRyZXNldF9yb3cuc2V0QXR0cmlidXRlKCAnYXJpYS1oaWRkZW4nLCBpc19jdXN0b20gPyAnZmFsc2UnIDogJ3RydWUnICk7XG5cdFx0cmVzZXRfcm93LmNsYXNzTGlzdC50b2dnbGUoICdpcy1oaWRkZW4nLCAhIGlzX2N1c3RvbSApO1xuXHR9XG5cblx0aWYgKCBiYXNlX3RoZW1lX3JvdyApIHtcblx0XHRiYXNlX3RoZW1lX3Jvdy5oaWRkZW4gPSAhIGlzX2N1c3RvbTtcblx0XHRiYXNlX3RoZW1lX3Jvdy5zZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicsIGlzX2N1c3RvbSA/ICdmYWxzZScgOiAndHJ1ZScgKTtcblx0XHRiYXNlX3RoZW1lX3Jvdy5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtaGlkZGVuJywgISBpc19jdXN0b20gKTtcblx0fVxufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Jlc29sdmUob3B0aW9ucykge1xuXHRsZXQgc3R5bGUgICAgID0gU3RyaW5nKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jb250YWluZXJfc3R5bGUgfHwgJ2luaGVyaXQnICk7XG5cblx0aWYgKCBzdHlsZSA9PT0gJ2luaGVyaXQnICkge1xuXHRcdGNvbnN0IGdsb2JhbF9vcHRpb25zID0gd2luZG93LndwYmNfYmZiX3NldHRpbmdzX3ZhcnMgJiYgd2luZG93LndwYmNfYmZiX3NldHRpbmdzX3ZhcnMuZ2xvYmFsX2FwcGVhcmFuY2Vcblx0XHRcdD8gd2luZG93LndwYmNfYmZiX3NldHRpbmdzX3ZhcnMuZ2xvYmFsX2FwcGVhcmFuY2Vcblx0XHRcdDoge307XG5cdFx0b3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oIHt9LCBnbG9iYWxfb3B0aW9ucyB8fCB7fSApO1xuXHRcdHN0eWxlID0gU3RyaW5nKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jb250YWluZXJfc3R5bGUgfHwgJ2JvcmRlcmVkJyApO1xuXHR9XG5cblx0aWYgKCBzdHlsZSA9PT0gJ2JvcmRlcmVkJyApIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGlmICggc3R5bGUgIT09ICdjdXN0b20nICkge1xuXHRcdHJldHVybiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2dldF9wcmVzZXRfZm9yX29wdGlvbnMoIHN0eWxlLCBvcHRpb25zICk7XG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdGJhY2tncm91bmQgOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2NvbG9yKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9iYWNrZ3JvdW5kX2NvbG9yLCAnI2ZmZmZmZicgKSxcblx0XHRib3JkZXJDb2xvcjogd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9jb2xvciggb3B0aW9ucy5ib29raW5nX2Zvcm1fYm9yZGVyX2NvbG9yLCAnI2NjY2NjYycgKSxcblx0XHRib3JkZXJXaWR0aDogd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9sZW5ndGgoIG9wdGlvbnMuYm9va2luZ19mb3JtX2JvcmRlcl93aWR0aCwgJzFweCcgKSxcblx0XHRyYWRpdXMgICAgIDogd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9sZW5ndGgoIG9wdGlvbnMuYm9va2luZ19mb3JtX2JvcmRlcl9yYWRpdXMsICcycHgnICksXG5cdFx0cGFkZGluZyAgICA6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfc3BhY2luZyggb3B0aW9ucy5ib29raW5nX2Zvcm1fcGFkZGluZywgJzEwcHggMzBweCcgKSxcblx0XHRzaGFkb3cgICAgIDogJ3JnYmEoMCwgMCwgMCwgMC4wNSkgMHB4IDJweCA2cHggMHB4J1xuXHR9O1xufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Jlc29sdmVfZGVzaWduX2NvbG9ycyhvcHRpb25zKSB7XG5cdG9wdGlvbnMgPSBvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zID09PSAnb2JqZWN0JyA/IG9wdGlvbnMgOiB7fTtcblxuXHRpZiAoICEgd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19pc19jdXN0b21fc3R5bGUoIG9wdGlvbnMgKSApIHtcblx0XHRpZiAoXG5cdFx0XHR3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2lzX2RhcmtfdGhlbWUoIG9wdGlvbnMgKSAmJlxuXHRcdFx0J25vbmUnID09PSBTdHJpbmcoIG9wdGlvbnMuYm9va2luZ19mb3JtX2NvbnRhaW5lcl9zdHlsZSB8fCAnJyApXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0ZXh0Q29sb3IgICAgICA6ICcjMWQyMzI3Jyxcblx0XHRcdFx0ZmllbGRCYWNrZ3JvdW5kOiAnJyxcblx0XHRcdFx0ZmllbGRUZXh0ICAgICAgOiAnJyxcblx0XHRcdFx0ZmllbGRCb3JkZXIgICAgOiAnJ1xuXHRcdFx0fTtcblx0XHR9XG5cdFx0cmV0dXJuIHtcblx0XHRcdHRleHRDb2xvciAgICAgIDogJycsXG5cdFx0XHRmaWVsZEJhY2tncm91bmQ6ICcnLFxuXHRcdFx0ZmllbGRUZXh0ICAgICAgOiAnJyxcblx0XHRcdGZpZWxkQm9yZGVyICAgIDogJydcblx0XHR9O1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHR0ZXh0Q29sb3IgICAgICA6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfb3B0aW9uYWxfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX3RleHRfY29sb3IgKSxcblx0XHRmaWVsZEJhY2tncm91bmQ6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfb3B0aW9uYWxfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX2ZpZWxkX2JhY2tncm91bmRfY29sb3IgKSxcblx0XHRmaWVsZFRleHQgICAgICA6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfb3B0aW9uYWxfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX2ZpZWxkX3RleHRfY29sb3IgKSxcblx0XHRmaWVsZEJvcmRlciAgICA6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfb3B0aW9uYWxfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX2ZpZWxkX2JvcmRlcl9jb2xvciApXG5cdH07XG59XG5cbmZ1bmN0aW9uIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fYXBwbHlfdmFycyh2YWx1ZSwgY3R4KSB7XG5cdGNvbnN0IG9wdGlvbnMgPSB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2NvbGxlY3Rfb3B0aW9ucyggY3R4LCBjdHggJiYgY3R4LmtleSwgdmFsdWUgKTtcblx0Y29uc3QgcmVzb2x2ZWQgPSB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Jlc29sdmUoIG9wdGlvbnMgKTtcblx0Y29uc3QgZGVzaWduID0gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19yZXNvbHZlX2Rlc2lnbl9jb2xvcnMoIG9wdGlvbnMgKTtcblx0Y29uc3QgaXNfY3VzdG9tID0gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19pc19jdXN0b21fc3R5bGUoIG9wdGlvbnMgKTtcblx0Y29uc3Qgcm9vdCA9IGN0eCAmJiBjdHguY2FudmFzO1xuXG5cdHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc3luY19mb3JtX3N0eWxlX2NvbnRyb2woIG9wdGlvbnMgKTtcblx0d3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zeW5jX2N1c3RvbV9jb250cm9scyggb3B0aW9ucyApO1xuXG5cdGlmICggISByb290IHx8ICEgcm9vdC5xdWVyeVNlbGVjdG9yQWxsICkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IHdyYXBzID0gcm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19mb3JtX3ByZXZpZXdfc2VjdGlvbl9jb250YWluZXIsIC53cGJjX2JmYl9mb3JtJyApO1xuXHRpZiAoICEgd3JhcHMubGVuZ3RoICkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdHdyYXBzLmZvckVhY2goIGZ1bmN0aW9uICh3cmFwKSB7XG5cdFx0aWYgKCAhIHdyYXAgfHwgISB3cmFwLnN0eWxlICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR3cmFwLmNsYXNzTGlzdC50b2dnbGUoICd3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfY3VzdG9tJywgaXNfY3VzdG9tICk7XG5cdFx0aWYgKCAhIHJlc29sdmVkICkge1xuXHRcdFx0d3JhcC5zdHlsZS5yZW1vdmVQcm9wZXJ0eSggJy0td3BiYy1iZmItZm9ybS1iYWNrZ3JvdW5kJyApO1xuXHRcdFx0d3JhcC5zdHlsZS5yZW1vdmVQcm9wZXJ0eSggJy0td3BiYy1iZmItZm9ybS1ib3JkZXItY29sb3InICk7XG5cdFx0XHR3cmFwLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnLS13cGJjLWJmYi1mb3JtLWJvcmRlci13aWR0aCcgKTtcblx0XHRcdHdyYXAuc3R5bGUucmVtb3ZlUHJvcGVydHkoICctLXdwYmMtYmZiLWZvcm0tYm9yZGVyLXJhZGl1cycgKTtcblx0XHRcdHdyYXAuc3R5bGUucmVtb3ZlUHJvcGVydHkoICctLXdwYmMtYmZiLWZvcm0tcGFkZGluZycgKTtcblx0XHRcdHdyYXAuc3R5bGUucmVtb3ZlUHJvcGVydHkoICctLXdwYmMtYmZiLWZvcm0tYm94LXNoYWRvdycgKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0d3JhcC5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiYy1iZmItZm9ybS1iYWNrZ3JvdW5kJywgcmVzb2x2ZWQuYmFja2dyb3VuZCApO1xuXHRcdFx0d3JhcC5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiYy1iZmItZm9ybS1ib3JkZXItY29sb3InLCByZXNvbHZlZC5ib3JkZXJDb2xvciApO1xuXHRcdFx0d3JhcC5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiYy1iZmItZm9ybS1ib3JkZXItd2lkdGgnLCByZXNvbHZlZC5ib3JkZXJXaWR0aCApO1xuXHRcdFx0d3JhcC5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiYy1iZmItZm9ybS1ib3JkZXItcmFkaXVzJywgcmVzb2x2ZWQucmFkaXVzICk7XG5cdFx0XHR3cmFwLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjLWJmYi1mb3JtLXBhZGRpbmcnLCByZXNvbHZlZC5wYWRkaW5nICk7XG5cdFx0XHR3cmFwLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjLWJmYi1mb3JtLWJveC1zaGFkb3cnLCByZXNvbHZlZC5zaGFkb3cgKTtcblx0XHR9XG5cblx0XHRpZiAoIGRlc2lnbi50ZXh0Q29sb3IgKSB7XG5cdFx0XHR3cmFwLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjX2Zvcm0tbGFiZWwtY29sb3InLCBkZXNpZ24udGV4dENvbG9yICk7XG5cdFx0XHR3cmFwLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjX2Zvcm0tbGFiZWwtc3VibGFiZWwtY29sb3InLCBkZXNpZ24udGV4dENvbG9yICk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHdyYXAuc3R5bGUucmVtb3ZlUHJvcGVydHkoICctLXdwYmNfZm9ybS1sYWJlbC1jb2xvcicgKTtcblx0XHRcdHdyYXAuc3R5bGUucmVtb3ZlUHJvcGVydHkoICctLXdwYmNfZm9ybS1sYWJlbC1zdWJsYWJlbC1jb2xvcicgKTtcblx0XHR9XG5cblx0XHRpZiAoIGRlc2lnbi5maWVsZEJhY2tncm91bmQgKSB7XG5cdFx0XHR3cmFwLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjX2Zvcm0tZmllbGQtYmFja2dyb3VuZC1jb2xvcicsIGRlc2lnbi5maWVsZEJhY2tncm91bmQgKTtcblx0XHRcdHdyYXAuc3R5bGUuc2V0UHJvcGVydHkoICctLXdwYmNfZm9ybS1maWVsZC1tZW51LWNvbG9yJywgZGVzaWduLmZpZWxkQmFja2dyb3VuZCApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR3cmFwLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnLS13cGJjX2Zvcm0tZmllbGQtYmFja2dyb3VuZC1jb2xvcicgKTtcblx0XHRcdHdyYXAuc3R5bGUucmVtb3ZlUHJvcGVydHkoICctLXdwYmNfZm9ybS1maWVsZC1tZW51LWNvbG9yJyApO1xuXHRcdH1cblxuXHRcdGlmICggZGVzaWduLmZpZWxkVGV4dCApIHtcblx0XHRcdHdyYXAuc3R5bGUuc2V0UHJvcGVydHkoICctLXdwYmNfZm9ybS1maWVsZC10ZXh0LWNvbG9yJywgZGVzaWduLmZpZWxkVGV4dCApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR3cmFwLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnLS13cGJjX2Zvcm0tZmllbGQtdGV4dC1jb2xvcicgKTtcblx0XHR9XG5cblx0XHRpZiAoIGRlc2lnbi5maWVsZEJvcmRlciApIHtcblx0XHRcdHdyYXAuc3R5bGUuc2V0UHJvcGVydHkoICctLXdwYmNfZm9ybS1maWVsZC1ib3JkZXItY29sb3InLCBkZXNpZ24uZmllbGRCb3JkZXIgKTtcblx0XHRcdHdyYXAuc3R5bGUuc2V0UHJvcGVydHkoICctLXdwYmNfZm9ybS1maWVsZC1ib3JkZXItY29sb3Itc3BhcmUnLCBkZXNpZ24uZmllbGRCb3JkZXIgKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0d3JhcC5zdHlsZS5yZW1vdmVQcm9wZXJ0eSggJy0td3BiY19mb3JtLWZpZWxkLWJvcmRlci1jb2xvcicgKTtcblx0XHRcdHdyYXAuc3R5bGUucmVtb3ZlUHJvcGVydHkoICctLXdwYmNfZm9ybS1maWVsZC1ib3JkZXItY29sb3Itc3BhcmUnICk7XG5cdFx0fVxuXHR9ICk7XG59XG5cbmZ1bmN0aW9uIHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19nZXRfdmFycygpIHtcblx0cmV0dXJuIHdpbmRvdy53cGJjX2JmYl9zZXR0aW5nc192YXJzIHx8IHt9O1xufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fZ2V0X3ByZXNldHMoKSB7XG5cdGNvbnN0IHZhcnMgPSB3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fZ2V0X3ZhcnMoKTtcblx0cmV0dXJuIHZhcnMuZm9ybV9zdHlsZV9wcmVzZXRzICYmIHR5cGVvZiB2YXJzLmZvcm1fc3R5bGVfcHJlc2V0cyA9PT0gJ29iamVjdCcgPyB2YXJzLmZvcm1fc3R5bGVfcHJlc2V0cyA6IHt9O1xufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fZ2V0X2N1c3RvbV9rZXlzKCkge1xuXHRyZXR1cm4gW1xuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX2JhY2tncm91bmRfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX3dpZHRoJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfcmFkaXVzJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9wYWRkaW5nX3ZlcnRpY2FsJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9wYWRkaW5nX2hvcml6b250YWwnLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX3RleHRfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JhY2tncm91bmRfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX3RleHRfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JvcmRlcl9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JhY2tncm91bmRfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl90ZXh0X2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYm9yZGVyX2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfYmFja2dyb3VuZF9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX3RleHRfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl9ib3JkZXJfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fYmFja2dyb3VuZF9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl90ZXh0X2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2JvcmRlcl9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl9iYWNrZ3JvdW5kX2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX3RleHRfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfYm9yZGVyX2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYm9yZGVyX3dpZHRoJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYm9yZGVyX3JhZGl1cydcblx0XTtcbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2dldF9jdXN0b21fZGVmYXVsdHMoKSB7XG5cdGNvbnN0IHZhcnMgPSB3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fZ2V0X3ZhcnMoKTtcblx0Y29uc3QgbG9jYWxpemVkID0gdmFycy5jdXN0b21fZm9ybV9zdHlsZV9kZWZhdWx0cyAmJiB0eXBlb2YgdmFycy5jdXN0b21fZm9ybV9zdHlsZV9kZWZhdWx0cyA9PT0gJ29iamVjdCdcblx0XHQ/IHZhcnMuY3VzdG9tX2Zvcm1fc3R5bGVfZGVmYXVsdHNcblx0XHQ6IHt9O1xuXG5cdHJldHVybiBPYmplY3QuYXNzaWduKCB7XG5cdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9iYWNrZ3JvdW5kX2NvbG9yICAgICAgIDogJyNmZmZmZmYnLFxuXHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX2NvbG9yICAgICAgICAgICA6ICcjY2NjY2NjJyxcblx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl93aWR0aCAgICAgICAgICAgOiAnMXB4Jyxcblx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl9yYWRpdXMgICAgICAgICAgOiAnMnB4Jyxcblx0XHRib29raW5nX2Zvcm1fY3VzdG9tX3BhZGRpbmdfdmVydGljYWwgICAgICAgOiAnMTBweCcsXG5cdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9wYWRkaW5nX2hvcml6b250YWwgICAgIDogJzMwcHgnLFxuXHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fdGV4dF9jb2xvciAgICAgICAgICAgICA6ICcjMWQyMzI3Jyxcblx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JhY2tncm91bmRfY29sb3IgOiAnI2ZmZmZmZicsXG5cdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9maWVsZF90ZXh0X2NvbG9yICAgICAgIDogJyMzYzQzNGEnLFxuXHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYm9yZGVyX2NvbG9yICAgICA6ICcjY2NjY2NjJyxcblx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9iYWNrZ3JvdW5kX2NvbG9yOiAnIzA2NmFhYicsXG5cdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fdGV4dF9jb2xvciAgICAgIDogJyNmZmZmZmYnLFxuXHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JvcmRlcl9jb2xvciAgICA6ICcjMDY2YWFiJyxcblx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl9iYWNrZ3JvdW5kX2NvbG9yOiAnIzA1NTU4OScsXG5cdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfdGV4dF9jb2xvcjogJyNmZmZmZmYnLFxuXHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JvcmRlcl9jb2xvcjogJyMwNTU1ODknLFxuXHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9iYWNrZ3JvdW5kX2NvbG9yOiAnI2ZkZmRmZCcsXG5cdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX3RleHRfY29sb3I6ICcjNDQ0NDQ0Jyxcblx0XHRib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fYm9yZGVyX2NvbG9yOiAnI2VlZWVlZScsXG5cdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX2JhY2tncm91bmRfY29sb3I6ICcjZmRmZGZkJyxcblx0XHRib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfdGV4dF9jb2xvcjogJyM0NDQ0NDQnLFxuXHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl9ib3JkZXJfY29sb3I6ICcjNGQ5MWNkJyxcblx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ib3JkZXJfd2lkdGggICAgICA6ICcxcHgnLFxuXHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JvcmRlcl9yYWRpdXMgICAgIDogJzNweCdcblx0fSwgbG9jYWxpemVkICk7XG59XG5cbmZ1bmN0aW9uIHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19nZXRfY3VycmVudF9vcHRpb25zKGN0eCwga2V5LCB2YWx1ZSkge1xuXHRjb25zdCB2YXJzID0gd3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2dldF92YXJzKCk7XG5cdGxldCBvcHRpb25zID0gdmFycy5nbG9iYWxfZm9ybV9zdHlsZSAmJiB0eXBlb2YgdmFycy5nbG9iYWxfZm9ybV9zdHlsZSA9PT0gJ29iamVjdCdcblx0XHQ/IE9iamVjdC5hc3NpZ24oIHt9LCB2YXJzLmdsb2JhbF9mb3JtX3N0eWxlIClcblx0XHQ6IHt9O1xuXG5cdGlmICggd2luZG93LldQQkNfQkZCX0Zvcm1TZXR0aW5ncyAmJiB0eXBlb2Ygd2luZG93LldQQkNfQkZCX0Zvcm1TZXR0aW5ncy5jb2xsZWN0ID09PSAnZnVuY3Rpb24nICkge1xuXHRcdG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKCBvcHRpb25zLCB3aW5kb3cuV1BCQ19CRkJfRm9ybVNldHRpbmdzLmNvbGxlY3QoICdnbG9iYWwnICkgfHwge30gKTtcblx0fVxuXG5cdGlmICggY3R4ICYmIGN0eC5vcHRpb25zICYmIHR5cGVvZiBjdHgub3B0aW9ucyA9PT0gJ29iamVjdCcgKSB7XG5cdFx0b3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oIG9wdGlvbnMsIGN0eC5vcHRpb25zICk7XG5cdH1cblx0aWYgKCBrZXkgKSB7XG5cdFx0b3B0aW9uc1tTdHJpbmcoIGtleSApXSA9IHZhbHVlO1xuXHR9XG5cdGlmICggISBvcHRpb25zLmJvb2tpbmdfZm9ybV9zdHlsZSApIHtcblx0XHRvcHRpb25zLmJvb2tpbmdfZm9ybV9zdHlsZSA9ICdsaWdodF9ib3JkZXJlZCc7XG5cdH1cblxuXHRyZXR1cm4gb3B0aW9ucztcbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX21peF9jb2xvcnMoY29sb3IsIHRhcmdldCwgYW1vdW50KSB7XG5cdGxldCBzb3VyY2UgPSB3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fc2FuaXRpemVfYWNjZW50X2NvbG9yKCBjb2xvciApLnJlcGxhY2UoICcjJywgJycgKTtcblx0Y29uc3QgZGVzdGluYXRpb24gPSB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2NvbG9yKCB0YXJnZXQsICcjMDAwMDAwJyApLnJlcGxhY2UoICcjJywgJycgKTtcblx0Y29uc3QgY2hhbm5lbHMgPSBbXTtcblx0aWYgKCAhIHNvdXJjZSApIHtcblx0XHRyZXR1cm4gJyc7XG5cdH1cblx0aWYgKCBzb3VyY2UubGVuZ3RoID09PSAzICkge1xuXHRcdHNvdXJjZSA9IHNvdXJjZS5yZXBsYWNlKCAvLi9nLCBmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIHZhbHVlICsgdmFsdWU7IH0gKTtcblx0fVxuXHRmb3IgKCBsZXQgaW5kZXggPSAwOyBpbmRleCA8IDM7IGluZGV4KysgKSB7XG5cdFx0Y29uc3Qgc291cmNlX2NoYW5uZWwgPSBwYXJzZUludCggc291cmNlLnN1YnN0ciggaW5kZXggKiAyLCAyICksIDE2ICk7XG5cdFx0Y29uc3QgdGFyZ2V0X2NoYW5uZWwgPSBwYXJzZUludCggZGVzdGluYXRpb24uc3Vic3RyKCBpbmRleCAqIDIsIDIgKSwgMTYgKTtcblx0XHRjaGFubmVscy5wdXNoKCBNYXRoLnJvdW5kKCBzb3VyY2VfY2hhbm5lbCArICggKCB0YXJnZXRfY2hhbm5lbCAtIHNvdXJjZV9jaGFubmVsICkgKiBhbW91bnQgKSApICk7XG5cdH1cblx0cmV0dXJuICcjJyArIGNoYW5uZWxzLm1hcCggZnVuY3Rpb24gKGNoYW5uZWwpIHsgcmV0dXJuICggJzAnICsgY2hhbm5lbC50b1N0cmluZyggMTYgKSApLnNsaWNlKCAtMiApOyB9ICkuam9pbiggJycgKTtcbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2dldF9sdW1pbmFuY2UoY29sb3IpIHtcblx0bGV0IGhleCA9IHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19zYW5pdGl6ZV9hY2NlbnRfY29sb3IoIGNvbG9yICkucmVwbGFjZSggJyMnLCAnJyApO1xuXHRpZiAoICEgaGV4ICkge1xuXHRcdHJldHVybiAwO1xuXHR9XG5cdGlmICggaGV4Lmxlbmd0aCA9PT0gMyApIHtcblx0XHRoZXggPSBoZXgucmVwbGFjZSggLy4vZywgZnVuY3Rpb24gKHZhbHVlKSB7IHJldHVybiB2YWx1ZSArIHZhbHVlOyB9ICk7XG5cdH1cblx0Y29uc3QgY2hhbm5lbHMgPSBbIDAsIDEsIDIgXS5tYXAoIGZ1bmN0aW9uIChpbmRleCkge1xuXHRcdGNvbnN0IGNoYW5uZWwgPSBwYXJzZUludCggaGV4LnN1YnN0ciggaW5kZXggKiAyLCAyICksIDE2ICkgLyAyNTU7XG5cdFx0cmV0dXJuIGNoYW5uZWwgPD0gMC4wMzkyOCA/IGNoYW5uZWwgLyAxMi45MiA6IE1hdGgucG93KCAoIGNoYW5uZWwgKyAwLjA1NSApIC8gMS4wNTUsIDIuNCApO1xuXHR9ICk7XG5cdHJldHVybiAoIDAuMjEyNiAqIGNoYW5uZWxzWzBdICkgKyAoIDAuNzE1MiAqIGNoYW5uZWxzWzFdICkgKyAoIDAuMDcyMiAqIGNoYW5uZWxzWzJdICk7XG59XG5cbi8qKlxuICogQXBwbHkgc2hhcmVkIGFjY2VudCB2YXJpYWJsZXMgd2l0aG91dCBtYXNraW5nIGV4cGxpY2l0IEN1c3RvbSBidXR0b24gY29udHJvbHMuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9ICBjc3NfdmFycyAgICAgICAgICAgICAgICAgICAgICBSZXNvbHZlZCBiYXNlIHN0eWxlIHZhcmlhYmxlcy5cbiAqIEBwYXJhbSB7T2JqZWN0fSAgb3B0aW9ucyAgICAgICAgICAgICAgICAgICAgICAgQ3VycmVudCBnbG9iYWwgc3R5bGUgb3B0aW9ucy5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gcHJlc2VydmVfY3VzdG9tX2J1dHRvbl9jb2xvcnMgV2hldGhlciBDdXN0b20gYnV0dG9uIHZhcmlhYmxlcyByZW1haW4gYXV0aG9yaXRhdGl2ZS5cbiAqIEByZXR1cm4ge09iamVjdH0gUmVzb2x2ZWQgdmFyaWFibGVzIHdpdGggdGhlIG9wdGlvbmFsIGFjY2VudCBvdmVybGF5LlxuICovXG5mdW5jdGlvbiB3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fYXBwbHlfYWNjZW50KGNzc192YXJzLCBvcHRpb25zLCBwcmVzZXJ2ZV9jdXN0b21fYnV0dG9uX2NvbG9ycykge1xuXHRpZiAoIFN0cmluZyggb3B0aW9ucy5ib29raW5nX2Zvcm1fYWNjZW50X2VuYWJsZWQgfHwgJ09mZicgKSAhPT0gJ09uJyApIHtcblx0XHRyZXR1cm4gY3NzX3ZhcnM7XG5cdH1cblx0Y29uc3QgYWNjZW50ID0gd3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX3Nhbml0aXplX2FjY2VudF9jb2xvciggb3B0aW9ucy5ib29raW5nX2Zvcm1fYWNjZW50X2NvbG9yICk7XG5cdGlmICggISBhY2NlbnQgKSB7XG5cdFx0cmV0dXJuIGNzc192YXJzO1xuXHR9XG5cdGNvbnN0IGx1bWluYW5jZSA9IHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19nZXRfbHVtaW5hbmNlKCBhY2NlbnQgKTtcblx0Y29uc3QgY29udHJhc3QgPSBsdW1pbmFuY2UgPiAwLjE4ID8gJyMwMDAwMDAnIDogJyNmZmZmZmYnO1xuXHRjb25zdCBob3Zlcl90YXJnZXQgPSAnI2ZmZmZmZicgPT09IGNvbnRyYXN0ID8gJyMwMDAwMDAnIDogJyNmZmZmZmYnO1xuXHRjb25zdCBob3ZlciA9IHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19taXhfY29sb3JzKCBhY2NlbnQsIGhvdmVyX3RhcmdldCwgMC4xMCApO1xuXHRjb25zdCBob3Zlcl9jb250cmFzdCA9IGNvbnRyYXN0O1xuXG5cdGNvbnN0IGFjY2VudF9vdmVybGF5ID0ge1xuXHRcdCctLXdwYmNfZm9ybS1hY2NlbnQtY29sb3InOiBhY2NlbnQsXG5cdFx0Jy0td3BiY19mb3JtLWFjY2VudC1ob3Zlci1jb2xvcic6IGhvdmVyLFxuXHRcdCctLXdwYmNfZm9ybS1hY2NlbnQtY29udHJhc3QtY29sb3InOiBjb250cmFzdCxcblx0XHQnLS13cGJjX2Zvcm0tZmllbGQtZm9jdXMtYm9yZGVyLWNvbG9yJzogYWNjZW50LFxuXHRcdCctLXdwYmNfZm9ybS1maWVsZC1mb2N1cy1zaGFkb3ctY29sb3InOiBhY2NlbnQsXG5cdFx0Jy0td3BiY19mb3JtLWNob2ljZS1jaGVja2VkLWJvcmRlci1jb2xvcic6IGFjY2VudCxcblx0XHQnLS13cGJjX2Zvcm0tY2hvaWNlLWNoZWNrZWQtY29sb3InOiBhY2NlbnQsXG5cdFx0Jy0td3BiY19mb3JtLWNob2ljZS1mb2N1cy1jb2xvcic6IGFjY2VudCxcblx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWJhY2tncm91bmQtY29sb3InOiBhY2NlbnQsXG5cdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1iYWNrZ3JvdW5kLWNvbG9yLWFsdCc6IGFjY2VudCxcblx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWJvcmRlci1jb2xvcic6IGFjY2VudCxcblx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLXRleHQtY29sb3InOiBjb250cmFzdCxcblx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLXRleHQtY29sb3ItYWx0JzogY29udHJhc3QsXG5cdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1ob3Zlci1iYWNrZ3JvdW5kLWNvbG9yJzogaG92ZXIsXG5cdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1ob3Zlci1ib3JkZXItY29sb3InOiBob3Zlcixcblx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWhvdmVyLXRleHQtY29sb3InOiBob3Zlcl9jb250cmFzdCxcblx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWxpZ2h0LWhvdmVyLWJvcmRlci1jb2xvcic6IGFjY2VudCxcblx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLXByaW1hcnktaG92ZXItYm9yZGVyLWNvbG9yJzogaG92ZXIsXG5cdFx0Jy0td3BiY19mb3JtLXBhZ2UtYnJlYWstY29sb3InOiBhY2NlbnRcblx0fTtcblxuXHRpZiAoIHByZXNlcnZlX2N1c3RvbV9idXR0b25fY29sb3JzICkge1xuXHRcdFtcblx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tYmFja2dyb3VuZC1jb2xvcicsXG5cdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWJhY2tncm91bmQtY29sb3ItYWx0Jyxcblx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tYm9yZGVyLWNvbG9yJyxcblx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tdGV4dC1jb2xvcicsXG5cdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLXRleHQtY29sb3ItYWx0Jyxcblx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24taG92ZXItYmFja2dyb3VuZC1jb2xvcicsXG5cdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWhvdmVyLWJvcmRlci1jb2xvcicsXG5cdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWhvdmVyLXRleHQtY29sb3InLFxuXHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1saWdodC1ob3Zlci1ib3JkZXItY29sb3InLFxuXHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1wcmltYXJ5LWhvdmVyLWJvcmRlci1jb2xvcidcblx0XHRdLmZvckVhY2goIGZ1bmN0aW9uIChjc3NfdmFyX25hbWUpIHtcblx0XHRcdGRlbGV0ZSBhY2NlbnRfb3ZlcmxheVtjc3NfdmFyX25hbWVdO1xuXHRcdH0gKTtcblx0fVxuXG5cdHJldHVybiBPYmplY3QuYXNzaWduKCB7fSwgY3NzX3ZhcnMsIGFjY2VudF9vdmVybGF5ICk7XG59XG5cbmZ1bmN0aW9uIHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19yZXNvbHZlX2Nzc192YXJzKG9wdGlvbnMpIHtcblx0b3B0aW9ucyA9IG9wdGlvbnMgJiYgdHlwZW9mIG9wdGlvbnMgPT09ICdvYmplY3QnID8gb3B0aW9ucyA6IHt9O1xuXHRjb25zdCBzdHlsZSA9IFN0cmluZyggb3B0aW9ucy5ib29raW5nX2Zvcm1fc3R5bGUgfHwgJ2xpZ2h0X2JvcmRlcmVkJyApO1xuXHRjb25zdCBwcmVzZXRzID0gd3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2dldF9wcmVzZXRzKCk7XG5cdGNvbnN0IHByZXNldCA9IHByZXNldHNbc3R5bGVdIHx8IHByZXNldHMubGlnaHRfYm9yZGVyZWQgfHwge307XG5cdGNvbnN0IGRlZmF1bHRzID0gd3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2dldF9jdXN0b21fZGVmYXVsdHMoKTtcblxuXHRpZiAoICdjdXN0b20nICE9PSBzdHlsZSApIHtcblx0XHRyZXR1cm4gd3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2FwcGx5X2FjY2VudCggcHJlc2V0LmNzc192YXJzICYmIHR5cGVvZiBwcmVzZXQuY3NzX3ZhcnMgPT09ICdvYmplY3QnID8gT2JqZWN0LmFzc2lnbigge30sIHByZXNldC5jc3NfdmFycyApIDoge30sIG9wdGlvbnMgKTtcblx0fVxuXG5cdGNvbnN0IGNzc192YXJzID0ge1xuXHRcdCctLXdwYmMtYmZiLWZvcm0tYmFja2dyb3VuZCcgICAgICAgICAgOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2NvbG9yKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jdXN0b21fYmFja2dyb3VuZF9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9iYWNrZ3JvdW5kX2NvbG9yICksXG5cdFx0Jy0td3BiYy1iZmItZm9ybS1ib3JkZXItY29sb3InICAgICAgICA6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX2NvbG9yICksXG5cdFx0Jy0td3BiYy1iZmItZm9ybS1ib3JkZXItd2lkdGgnICAgICAgICA6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfbGVuZ3RoKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX3dpZHRoLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl93aWR0aCApLFxuXHRcdCctLXdwYmMtYmZiLWZvcm0tYm9yZGVyLXJhZGl1cycgICAgICAgOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2xlbmd0aCggb3B0aW9ucy5ib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl9yYWRpdXMsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX3JhZGl1cyApLFxuXHRcdCctLXdwYmMtYmZiLWZvcm0tcGFkZGluZycgICAgICAgICAgICAgOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2xlbmd0aCggb3B0aW9ucy5ib29raW5nX2Zvcm1fY3VzdG9tX3BhZGRpbmdfdmVydGljYWwsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fcGFkZGluZ192ZXJ0aWNhbCApICsgJyAnICsgd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9sZW5ndGgoIG9wdGlvbnMuYm9va2luZ19mb3JtX2N1c3RvbV9wYWRkaW5nX2hvcml6b250YWwsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fcGFkZGluZ19ob3Jpem9udGFsICksXG5cdFx0Jy0td3BiYy1iZmItZm9ybS1ib3gtc2hhZG93JyAgICAgICAgICA6ICdyZ2JhKDAsIDAsIDAsIDAuMDUpIDBweCAycHggNnB4IDBweCcsXG5cdFx0Jy0td3BiY19mb3JtLWxhYmVsLWNvbG9yJyAgICAgICAgICAgICA6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX2N1c3RvbV90ZXh0X2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX3RleHRfY29sb3IgKSxcblx0XHQnLS13cGJjX2Zvcm0tbGFiZWwtc3VibGFiZWwtY29sb3InICAgIDogd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9jb2xvciggb3B0aW9ucy5ib29raW5nX2Zvcm1fY3VzdG9tX3RleHRfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fdGV4dF9jb2xvciApLFxuXHRcdCctLXdwYmNfZm9ybS1sYWJlbC1lcnJvci1jb2xvcicgICAgICAgOiAnI2Q2MzYzNycsXG5cdFx0Jy0td3BiY19mb3JtLWZpZWxkLWJhY2tncm91bmQtY29sb3InICA6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX2N1c3RvbV9maWVsZF9iYWNrZ3JvdW5kX2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JhY2tncm91bmRfY29sb3IgKSxcblx0XHQnLS13cGJjX2Zvcm0tZmllbGQtbWVudS1jb2xvcicgICAgICAgIDogd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9jb2xvciggb3B0aW9ucy5ib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JhY2tncm91bmRfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYmFja2dyb3VuZF9jb2xvciApLFxuXHRcdCctLXdwYmNfZm9ybS1maWVsZC10ZXh0LWNvbG9yJyAgICAgICAgOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2NvbG9yKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfdGV4dF9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9maWVsZF90ZXh0X2NvbG9yICksXG5cdFx0Jy0td3BiY19mb3JtLWZpZWxkLWJvcmRlci1jb2xvcicgICAgICA6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX2N1c3RvbV9maWVsZF9ib3JkZXJfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYm9yZGVyX2NvbG9yICksXG5cdFx0Jy0td3BiY19mb3JtLWZpZWxkLWJvcmRlci1jb2xvci1zcGFyZSc6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX2N1c3RvbV9maWVsZF9ib3JkZXJfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYm9yZGVyX2NvbG9yICksXG5cdFx0Jy0td3BiY19mb3JtLWZpZWxkLWZvY3VzLWJvcmRlci1jb2xvcic6ICcjMDY2YWFiJyxcblx0XHQnLS13cGJjX2Zvcm0tZmllbGQtZm9jdXMtc2hhZG93LWNvbG9yJzogJyMwNjZhYWInLFxuXHRcdCctLXdwYmNfZm9ybS1maWVsZC1kaXNhYmxlZC1jb2xvcicgICAgOiAncmdiYSgwLCAwLCAwLCAwLjIpJyxcblx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWJvcmRlci1yYWRpdXMnICAgIDogd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9sZW5ndGgoIG9wdGlvbnMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYm9yZGVyX3JhZGl1cywgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYm9yZGVyX3JhZGl1cyApLFxuXHRcdCctLXdwYmNfZm9ybS1idXR0b24tYm9yZGVyLXN0eWxlJyAgICAgOiAnc29saWQnLFxuXHRcdCctLXdwYmNfZm9ybS1idXR0b24tYm9yZGVyLXNpemUnICAgICAgOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2xlbmd0aCggb3B0aW9ucy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ib3JkZXJfd2lkdGgsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JvcmRlcl93aWR0aCApLFxuXHRcdCctLXdwYmNfZm9ybS1idXR0b24tYmFja2dyb3VuZC1jb2xvcicgOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2NvbG9yKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JhY2tncm91bmRfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JhY2tncm91bmRfY29sb3IgKSxcblx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWJhY2tncm91bmQtY29sb3ItYWx0Jzogd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9jb2xvciggb3B0aW9ucy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9iYWNrZ3JvdW5kX2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9iYWNrZ3JvdW5kX2NvbG9yICksXG5cdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1ib3JkZXItY29sb3InICAgICA6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYm9yZGVyX2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ib3JkZXJfY29sb3IgKSxcblx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLXRleHQtY29sb3InICAgICAgIDogd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9jb2xvciggb3B0aW9ucy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl90ZXh0X2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl90ZXh0X2NvbG9yICksXG5cdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi10ZXh0LWNvbG9yLWFsdCcgICA6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fdGV4dF9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fdGV4dF9jb2xvciApLFxuXHRcdCctLXdwYmNfZm9ybS1idXR0b24taG92ZXItYmFja2dyb3VuZC1jb2xvcic6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfYmFja2dyb3VuZF9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfYmFja2dyb3VuZF9jb2xvciApLFxuXHRcdCctLXdwYmNfZm9ybS1idXR0b24taG92ZXItYm9yZGVyLWNvbG9yJzogd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9jb2xvciggb3B0aW9ucy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl9ib3JkZXJfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JvcmRlcl9jb2xvciApLFxuXHRcdCctLXdwYmNfZm9ybS1idXR0b24taG92ZXItdGV4dC1jb2xvcicgOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2NvbG9yKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX3RleHRfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX3RleHRfY29sb3IgKSxcblx0XHQnLS13cGJjX2Zvcm0tY2hvaWNlLWNoZWNrZWQtYm9yZGVyLWNvbG9yJzogJyMwNjZhYWInLFxuXHRcdCctLXdwYmNfZm9ybS1jaG9pY2UtY2hlY2tlZC1jb2xvcicgICAgOiAnIzA2NmFhYicsXG5cdFx0Jy0td3BiY19mb3JtLWNob2ljZS1mb2N1cy1jb2xvcicgICAgICA6ICcjMDY2YWFiJyxcblx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWxpZ2h0LWJhY2tncm91bmQtY29sb3InOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2NvbG9yKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9iYWNrZ3JvdW5kX2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fYmFja2dyb3VuZF9jb2xvciApLFxuXHRcdCctLXdwYmNfZm9ybS1idXR0b24tbGlnaHQtYm9yZGVyLWNvbG9yJzogd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9jb2xvciggb3B0aW9ucy5ib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fYm9yZGVyX2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fYm9yZGVyX2NvbG9yICksXG5cdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1saWdodC1ib3JkZXItc2l6ZSc6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfbGVuZ3RoKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JvcmRlcl93aWR0aCwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYm9yZGVyX3dpZHRoICksXG5cdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1saWdodC10ZXh0LWNvbG9yJyA6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX3RleHRfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl90ZXh0X2NvbG9yICksXG5cdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1saWdodC1ib3gtc2hhZG93JyA6ICcwIDJweCAxMHB4IDJweCAjZmZmZmZmNTQnLFxuXHRcdCctLXdwYmNfZm9ybS1idXR0b24tbGlnaHQtaG92ZXItYmFja2dyb3VuZC1jb2xvcic6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX2JhY2tncm91bmRfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl9iYWNrZ3JvdW5kX2NvbG9yICksXG5cdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1saWdodC1ob3Zlci1ib3JkZXItY29sb3InOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2NvbG9yKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl9ib3JkZXJfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl9ib3JkZXJfY29sb3IgKSxcblx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWxpZ2h0LWhvdmVyLXRleHQtY29sb3InOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2NvbG9yKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl90ZXh0X2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfdGV4dF9jb2xvciApLFxuXHRcdCctLXdwYmNfZm9ybS1idXR0b24tbGlnaHQtaG92ZXItYm94LXNoYWRvdyc6ICcwIDJweCAxMHB4IDJweCAjZmZmZmZmNTQnLFxuXHRcdCctLXdwYmNfZm9ybS1idXR0b24tcHJpbWFyeS1ob3Zlci1ib3JkZXItY29sb3InOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2NvbG9yKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JvcmRlcl9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfYm9yZGVyX2NvbG9yICksXG5cdFx0Jy0td3BiY19mb3JtLXBhZ2UtYnJlYWstY29sb3InICAgICAgICA6ICcjMDY2YWFiJ1xuXHR9O1xuXG5cdHJldHVybiB3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fYXBwbHlfYWNjZW50KCBjc3NfdmFycywgb3B0aW9ucywgdHJ1ZSApO1xufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fZ2V0X2Nzc192YXJfa2V5cyhvcHRpb25zKSB7XG5cdGNvbnN0IHZhcnMgPSB3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fZ2V0X3ZhcnMoKTtcblx0Y29uc3QgbG9jYWxpemVkID0gQXJyYXkuaXNBcnJheSggdmFycy5mb3JtX3N0eWxlX2Nzc192YXJfbmFtZXMgKSA/IHZhcnMuZm9ybV9zdHlsZV9jc3NfdmFyX25hbWVzIDogW107XG5cdGNvbnN0IGtleXMgPSBbXTtcblx0Y29uc3QgcHJlc2V0cyA9IHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19nZXRfcHJlc2V0cygpO1xuXG5cdGlmICggbG9jYWxpemVkLmxlbmd0aCApIHtcblx0XHRyZXR1cm4gbG9jYWxpemVkO1xuXHR9XG5cblx0T2JqZWN0LmtleXMoIHByZXNldHMgKS5mb3JFYWNoKCBmdW5jdGlvbiAocHJlc2V0X2tleSkge1xuXHRcdGNvbnN0IHByZXNldCA9IHByZXNldHNbcHJlc2V0X2tleV0gfHwge307XG5cdFx0Y29uc3QgY3NzX3ZhcnMgPSBwcmVzZXQuY3NzX3ZhcnMgJiYgdHlwZW9mIHByZXNldC5jc3NfdmFycyA9PT0gJ29iamVjdCcgPyBwcmVzZXQuY3NzX3ZhcnMgOiB7fTtcblxuXHRcdE9iamVjdC5rZXlzKCBjc3NfdmFycyApLmZvckVhY2goIGZ1bmN0aW9uICh2YXJfbmFtZSkge1xuXHRcdFx0aWYgKCBrZXlzLmluZGV4T2YoIHZhcl9uYW1lICkgPT09IC0xICkge1xuXHRcdFx0XHRrZXlzLnB1c2goIHZhcl9uYW1lICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9ICk7XG5cblx0T2JqZWN0LmtleXMoIHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19yZXNvbHZlX2Nzc192YXJzKCBPYmplY3QuYXNzaWduKCB7fSwgb3B0aW9ucyB8fCB7fSwgeyBib29raW5nX2Zvcm1fc3R5bGU6ICdjdXN0b20nIH0gKSApICkuZm9yRWFjaCggZnVuY3Rpb24gKHZhcl9uYW1lKSB7XG5cdFx0aWYgKCBrZXlzLmluZGV4T2YoIHZhcl9uYW1lICkgPT09IC0xICkge1xuXHRcdFx0a2V5cy5wdXNoKCB2YXJfbmFtZSApO1xuXHRcdH1cblx0fSApO1xuXG5cdHJldHVybiBrZXlzO1xufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fc3luY19jb250cm9scyhvcHRpb25zKSB7XG5cdGNvbnN0IGlzX2N1c3RvbSA9ICdjdXN0b20nID09PSBTdHJpbmcoIG9wdGlvbnMgJiYgb3B0aW9ucy5ib29raW5nX2Zvcm1fc3R5bGUgPyBvcHRpb25zLmJvb2tpbmdfZm9ybV9zdHlsZSA6ICcnICk7XG5cdGNvbnN0IGFjY2VudF9lbmFibGVkID0gJ09uJyA9PT0gU3RyaW5nKCBvcHRpb25zICYmIG9wdGlvbnMuYm9va2luZ19mb3JtX2FjY2VudF9lbmFibGVkID8gb3B0aW9ucy5ib29raW5nX2Zvcm1fYWNjZW50X2VuYWJsZWQgOiAnT2ZmJyApO1xuXHRjb25zdCByZXNldF9yb3cgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1iZmItY3VzdG9tLWFwcGVhcmFuY2UtcmVzZXQtcm93XScgKTtcblxuXHR3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3NldF9yYWRpb19jb250cm9sKCAnYm9va2luZ19mb3JtX3N0eWxlJywgb3B0aW9ucy5ib29raW5nX2Zvcm1fc3R5bGUgfHwgJ2xpZ2h0X2JvcmRlcmVkJyApO1xuXG5cdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2Zvcm1fc2V0dGluZ19nbG9iYWxfY3VzdG9tX3N0eWxlJyApLmZvckVhY2goIGZ1bmN0aW9uIChyb3cpIHtcblx0XHRyb3cuaGlkZGVuID0gISBpc19jdXN0b207XG5cdFx0cm93LnNldEF0dHJpYnV0ZSggJ2FyaWEtaGlkZGVuJywgaXNfY3VzdG9tID8gJ2ZhbHNlJyA6ICd0cnVlJyApO1xuXHRcdHJvdy5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtaGlkZGVuJywgISBpc19jdXN0b20gKTtcblx0fSApO1xuXG5cdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2Zvcm1fc2V0dGluZ19nbG9iYWxfYWNjZW50X2RlcGVuZGVudCcgKS5mb3JFYWNoKCBmdW5jdGlvbiAocm93KSB7XG5cdFx0cm93LmhpZGRlbiA9ICEgYWNjZW50X2VuYWJsZWQ7XG5cdFx0cm93LnNldEF0dHJpYnV0ZSggJ2FyaWEtaGlkZGVuJywgYWNjZW50X2VuYWJsZWQgPyAnZmFsc2UnIDogJ3RydWUnICk7XG5cdFx0cm93LmNsYXNzTGlzdC50b2dnbGUoICdpcy1oaWRkZW4nLCAhIGFjY2VudF9lbmFibGVkICk7XG5cdH0gKTtcblxuXHRpZiAoIHJlc2V0X3JvdyApIHtcblx0XHRyZXNldF9yb3cuaGlkZGVuID0gISBpc19jdXN0b207XG5cdFx0cmVzZXRfcm93LnNldEF0dHJpYnV0ZSggJ2FyaWEtaGlkZGVuJywgaXNfY3VzdG9tID8gJ2ZhbHNlJyA6ICd0cnVlJyApO1xuXHRcdHJlc2V0X3Jvdy5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtaGlkZGVuJywgISBpc19jdXN0b20gKTtcblx0fVxufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fYXBwbHkodmFsdWUsIGN0eCkge1xuXHRjb25zdCBvcHRpb25zID0gd3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2dldF9jdXJyZW50X29wdGlvbnMoIGN0eCwgY3R4ICYmIGN0eC5rZXksIHZhbHVlICk7XG5cdGNvbnN0IHN0eWxlID0gU3RyaW5nKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9zdHlsZSB8fCAnbGlnaHRfYm9yZGVyZWQnICk7XG5cdGNvbnN0IHByZXNldHMgPSB3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fZ2V0X3ByZXNldHMoKTtcblx0Y29uc3QgcHJlc2V0ID0gcHJlc2V0c1tzdHlsZV0gfHwgcHJlc2V0cy5saWdodF9ib3JkZXJlZCB8fCB7fTtcblx0Y29uc3QgY3NzX3ZhcnMgPSB3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fcmVzb2x2ZV9jc3NfdmFycyggb3B0aW9ucyApO1xuXHQvLyBGb3JtIFN0eWxlIGlzIGdsb2JhbC4gQWx3YXlzIHN0YXJ0IGF0IHRoZSBjb21wbGV0ZSBCdWlsZGVyIHRoZW1lIHNjb3BlIHNvXG5cdC8vIGlubGluZSBDdXN0b20gdG9rZW5zIG9uIGFuIG91dGVyIHdyYXBwZXIgY2Fubm90IGxlYWsgaW50byBhIHByZXNldCB3aGVuIGFcblx0Ly8gZmllbGQtbGV2ZWwgdXBkYXRlIHByb3ZpZGVzIG9ubHkgdGhlIGlubmVyIGNhbnZhcyBpbiBjdHguY2FudmFzLlxuXHRjb25zdCByb290ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9fdGhlbWVfc2NvcGUnICkgfHwgKCBjdHggJiYgY3R4LmNhbnZhcyApIHx8IGRvY3VtZW50O1xuXHRjb25zdCB0aGVtZV9jbGFzc2VzID0gW107XG5cdGNvbnN0IGNzc192YXJfa2V5cyA9IHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19nZXRfY3NzX3Zhcl9rZXlzKCBvcHRpb25zICk7XG5cblx0d3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX3N5bmNfY29udHJvbHMoIG9wdGlvbnMgKTtcblxuXHRPYmplY3Qua2V5cyggcHJlc2V0cyApLmZvckVhY2goIGZ1bmN0aW9uIChwcmVzZXRfa2V5KSB7XG5cdFx0Y29uc3QgY2xhc3NfbmFtZSA9IHByZXNldHNbcHJlc2V0X2tleV0gJiYgcHJlc2V0c1twcmVzZXRfa2V5XS50aGVtZV9jbGFzcyA/IFN0cmluZyggcHJlc2V0c1twcmVzZXRfa2V5XS50aGVtZV9jbGFzcyApIDogJyc7XG5cdFx0aWYgKCBjbGFzc19uYW1lICYmIHRoZW1lX2NsYXNzZXMuaW5kZXhPZiggY2xhc3NfbmFtZSApID09PSAtMSApIHtcblx0XHRcdHRoZW1lX2NsYXNzZXMucHVzaCggY2xhc3NfbmFtZSApO1xuXHRcdH1cblx0fSApO1xuXG5cdGlmICggISByb290IHx8ICEgcm9vdC5xdWVyeVNlbGVjdG9yQWxsICkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IHNlbGVjdG9yID0gJy53cGJjX2NvbnRhaW5lci53cGJjX2Zvcm0sIC53cGJjX2JmYl9mb3JtLCAud3BiY19iZmJfX3BhZ2VzX3BhbmVsLCAud3BiY19iZmJfX2Zvcm1fcHJldmlld19zZWN0aW9uX2NvbnRhaW5lcic7XG5cdGNvbnN0IHdyYXBzID0gW107XG5cdGlmICggcm9vdC5tYXRjaGVzICYmIHJvb3QubWF0Y2hlcyggc2VsZWN0b3IgKSApIHtcblx0XHR3cmFwcy5wdXNoKCByb290ICk7XG5cdH1cblx0cm9vdC5xdWVyeVNlbGVjdG9yQWxsKCBzZWxlY3RvciApLmZvckVhY2goIGZ1bmN0aW9uICh3cmFwKSB7XG5cdFx0d3JhcHMucHVzaCggd3JhcCApO1xuXHR9ICk7XG5cblx0d3JhcHMuZm9yRWFjaCggZnVuY3Rpb24gKHdyYXApIHtcblx0XHRpZiAoICEgd3JhcCB8fCAhIHdyYXAuc3R5bGUgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoZW1lX2NsYXNzZXMuZm9yRWFjaCggZnVuY3Rpb24gKGNsYXNzX25hbWUpIHtcblx0XHRcdHdyYXAuY2xhc3NMaXN0LnJlbW92ZSggY2xhc3NfbmFtZSApO1xuXHRcdH0gKTtcblx0XHRpZiAoIHByZXNldC50aGVtZV9jbGFzcyApIHtcblx0XHRcdHdyYXAuY2xhc3NMaXN0LmFkZCggU3RyaW5nKCBwcmVzZXQudGhlbWVfY2xhc3MgKSApO1xuXHRcdH1cblx0XHR3cmFwLmNsYXNzTGlzdC50b2dnbGUoICd3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfY3VzdG9tJywgJ2N1c3RvbScgPT09IHN0eWxlICk7XG5cblx0XHRjc3NfdmFyX2tleXMuZm9yRWFjaCggZnVuY3Rpb24gKGNzc19rZXkpIHtcblx0XHRcdHdyYXAuc3R5bGUucmVtb3ZlUHJvcGVydHkoIGNzc19rZXkgKTtcblx0XHR9ICk7XG5cdFx0T2JqZWN0LmtleXMoIGNzc192YXJzICkuZm9yRWFjaCggZnVuY3Rpb24gKGNzc19rZXkpIHtcblx0XHRcdHdyYXAuc3R5bGUuc2V0UHJvcGVydHkoIGNzc19rZXksIGNzc192YXJzW2Nzc19rZXldICk7XG5cdFx0fSApO1xuXHR9ICk7XG59XG5cbltcblx0J2Jvb2tpbmdfZm9ybV9zdHlsZScsXG5cdCdib29raW5nX2Zvcm1fYWNjZW50X2VuYWJsZWQnLFxuXHQnYm9va2luZ19mb3JtX2FjY2VudF9jb2xvcicsXG5cdCdib29raW5nX2Zvcm1fY3VzdG9tX2JhY2tncm91bmRfY29sb3InLFxuXHQnYm9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfY29sb3InLFxuXHQnYm9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfd2lkdGgnLFxuXHQnYm9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfcmFkaXVzJyxcblx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fcGFkZGluZ192ZXJ0aWNhbCcsXG5cdCdib29raW5nX2Zvcm1fY3VzdG9tX3BhZGRpbmdfaG9yaXpvbnRhbCcsXG5cdCdib29raW5nX2Zvcm1fY3VzdG9tX3RleHRfY29sb3InLFxuXHQnYm9va2luZ19mb3JtX2N1c3RvbV9maWVsZF9iYWNrZ3JvdW5kX2NvbG9yJyxcblx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfdGV4dF9jb2xvcicsXG5cdCdib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JvcmRlcl9jb2xvcicsXG5cdCdib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9iYWNrZ3JvdW5kX2NvbG9yJyxcblx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX3RleHRfY29sb3InLFxuXHQnYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYm9yZGVyX2NvbG9yJyxcblx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JhY2tncm91bmRfY29sb3InLFxuXHQnYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfdGV4dF9jb2xvcicsXG5cdCdib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl9ib3JkZXJfY29sb3InLFxuXHQnYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2JhY2tncm91bmRfY29sb3InLFxuXHQnYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX3RleHRfY29sb3InLFxuXHQnYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2JvcmRlcl9jb2xvcicsXG5cdCdib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfYmFja2dyb3VuZF9jb2xvcicsXG5cdCdib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfdGV4dF9jb2xvcicsXG5cdCdib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfYm9yZGVyX2NvbG9yJyxcblx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JvcmRlcl93aWR0aCcsXG5cdCdib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ib3JkZXJfcmFkaXVzJ1xuXS5mb3JFYWNoKCBmdW5jdGlvbiAoa2V5KSB7XG5cdFdQQkNfQkZCX1NldHRpbmdzX0VmZmVjdHMucmVnaXN0ZXIoIGtleSwgZnVuY3Rpb24gKHZhbHVlLCBjdHgpIHtcblx0XHR3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fYXBwbHkoIHZhbHVlLCBPYmplY3QuYXNzaWduKCB7fSwgY3R4IHx8IHt9LCB7IGtleToga2V5IH0gKSApO1xuXHR9ICk7XG59ICk7XG5cbmZ1bmN0aW9uIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc3luY19jdXN0b21fY29udHJvbHNfZnJvbV91aSgpIHtcblx0Y29uc3Qgb3B0aW9ucyA9IHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19nZXRfY3VycmVudF9vcHRpb25zKCk7XG5cdHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19zeW5jX2NvbnRyb2xzKCBvcHRpb25zICk7XG5cdHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19hcHBseSggbnVsbCwgeyBzb3VyY2U6ICdzeW5jLWdsb2JhbC1zdHlsZScgfSApO1xufVxuXG53cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3N5bmNfY3VzdG9tX2NvbnRyb2xzX2Zyb21fdWkoKTtcbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdET01Db250ZW50TG9hZGVkJywgd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zeW5jX2N1c3RvbV9jb250cm9sc19mcm9tX3VpICk7XG5cblxuLy8gQk9PS0lOR19GT1JNX1RIRU1FLlxuV1BCQ19CRkJfU2V0dGluZ3NfRWZmZWN0cy5yZWdpc3RlciggJ2Jvb2tpbmdfZm9ybV90aGVtZScsIGZ1bmN0aW9uICh2YWx1ZSwgY3R4KSB7XG5cdGNvbnN0IHJvb3QgPSAoY3R4ICYmIGN0eC5jYW52YXMpIHx8IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX3RoZW1lX3Njb3BlJyApIHx8IGRvY3VtZW50O1xuXHRpZiAoICEgcm9vdCB8fCAhIHJvb3QucXVlcnlTZWxlY3RvckFsbCApIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRpZiAoIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9faXNfdXNlcl90aGVtZV9zd2l0Y2goIGN0eCApICkge1xuXHRcdGNvbnN0IGN1cnJlbnRfb3B0aW9ucyA9IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fZ2V0X2N1cnJlbnRfb3B0aW9ucygpO1xuXHRcdGlmICggJ2N1c3RvbScgPT09IFN0cmluZyggY3VycmVudF9vcHRpb25zLmJvb2tpbmdfZm9ybV9jb250YWluZXJfc3R5bGUgfHwgJycgKSApIHtcblx0XHRcdGN1cnJlbnRfb3B0aW9ucy5ib29raW5nX2Zvcm1fdGhlbWUgPSB2YWx1ZTtcblx0XHRcdHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc3luY19mb3JtX3N0eWxlX2NvbnRyb2woIGN1cnJlbnRfb3B0aW9ucyApO1xuXHRcdFx0d3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19hcHBseV92YXJzKCAnY3VzdG9tJywgT2JqZWN0LmFzc2lnbigge30sIGN0eCB8fCB7fSwge1xuXHRcdFx0XHRrZXkgICAgOiAnYm9va2luZ19mb3JtX2NvbnRhaW5lcl9zdHlsZScsXG5cdFx0XHRcdHNvdXJjZSA6ICd0aGVtZS1iYXNlLWN1c3RvbScsXG5cdFx0XHRcdG9wdGlvbnM6IGN1cnJlbnRfb3B0aW9uc1xuXHRcdFx0fSApICk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2V0X2NvbnRhaW5lcl9zdHlsZV9jb250cm9sKCAnYm9yZGVyZWQnICk7XG5cdFx0XHR3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2FwcGx5X3ZhcnMoICdib3JkZXJlZCcsIE9iamVjdC5hc3NpZ24oIHt9LCBjdHggfHwge30sIHsga2V5OiAnYm9va2luZ19mb3JtX2NvbnRhaW5lcl9zdHlsZScgfSApICk7XG5cdFx0fVxuXHR9IGVsc2UgaWYgKCBjdHggJiYgY3R4Lm9wdGlvbnMgKSB7XG5cdFx0d3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zeW5jX2Zvcm1fc3R5bGVfY29udHJvbCggY3R4Lm9wdGlvbnMgKTtcblx0fVxuXG5cdGNvbnN0IHRoZW1lX3NlbGVjdG9yID0gJy53cGJjX2NvbnRhaW5lci53cGJjX2Zvcm0sIC53cGJjX2JmYl9mb3JtLCAud3BiY19iZmJfX3BhZ2VzX3BhbmVsJztcblx0Y29uc3Qgd3JhcHMgPSBbXTtcblx0aWYgKCByb290Lm1hdGNoZXMgJiYgcm9vdC5tYXRjaGVzKCB0aGVtZV9zZWxlY3RvciApICkge1xuXHRcdHdyYXBzLnB1c2goIHJvb3QgKTtcblx0fVxuXHRyb290LnF1ZXJ5U2VsZWN0b3JBbGwoIHRoZW1lX3NlbGVjdG9yICkuZm9yRWFjaCggZnVuY3Rpb24gKHdyYXApIHtcblx0XHR3cmFwcy5wdXNoKCB3cmFwICk7XG5cdH0gKTtcblx0aWYgKCAhIHdyYXBzLmxlbmd0aCApIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHR3cmFwcy5mb3JFYWNoKCBmdW5jdGlvbiAod3JhcCkge1xuXHRcdC8vIHJlbW92ZSBhbnkgcHJldmlvdXMgdGhlbWUgY2xhc3NlcyAoc2ltcGxlICsgZnV0dXJlLXByb29mKS5cblx0XHRBcnJheS5mcm9tKCB3cmFwLmNsYXNzTGlzdCApLmZvckVhY2goIGZ1bmN0aW9uIChjbHMpIHtcblx0XHRcdGlmICggL153cGJjX3RoZW1lXy8udGVzdCggY2xzICkgKSB7XG5cdFx0XHRcdHdyYXAuY2xhc3NMaXN0LnJlbW92ZSggY2xzICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0aWYgKCB2YWx1ZSApIHtcblx0XHRcdHdyYXAuY2xhc3NMaXN0LmFkZCggU3RyaW5nKCB2YWx1ZSApICk7XG5cdFx0fVxuXHR9ICk7XG59ICk7XG5cblxuLy8gQk9PS0lOR19GT1JNX0xBWU9VVF9XSURUSCDigJQgRm9ybSB3aWR0aDogYXBwbGllcyBjb21iaW5lZCBcIjEwMCVcIiAvIFwiNjAwcHhcIiAvIFwiNDByZW1cIiB0byB0aGUgYm9va2luZyBmb3JtIGNvbnRhaW5lcnMuXG5XUEJDX0JGQl9TZXR0aW5nc19FZmZlY3RzLnJlZ2lzdGVyKCAnYm9va2luZ19mb3JtX2xheW91dF93aWR0aCcsIGZ1bmN0aW9uICh2YWx1ZSwgY3R4KSB7XG5cdGNvbnN0IHJvb3QgPSBjdHggJiYgY3R4LmNhbnZhcztcblx0aWYgKCAhIHJvb3QgfHwgISByb290LnF1ZXJ5U2VsZWN0b3JBbGwgKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3Qgd3JhcHMgPSByb290LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2Zvcm1fcHJldmlld19zZWN0aW9uX2NvbnRhaW5lcicgKTtcblx0aWYgKCAhIHdyYXBzLmxlbmd0aCApIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRjb25zdCB2ID0gU3RyaW5nKCB2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSApLnRyaW0oKTtcblxuXHQvLyBhbGxvdyBvbmx5IFwibnVtYmVyICsgdW5pdFwiLlxuXHRpZiAoIHYgJiYgISAvXlxcZCsoPzpcXC5cXGQrKT8oPzolfHB4fHJlbXxlbXx2d3x2aCkkLy50ZXN0KCB2ICkgKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0d3JhcHMuZm9yRWFjaChcblx0XHRmdW5jdGlvbiAod3JhcCkge1xuXHRcdFx0aWYgKCAhIHdyYXAgfHwgISB3cmFwLnN0eWxlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICggISB2ICkge1xuXHRcdFx0XHR3cmFwLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnLS13cGJjLWJmYi1ib29raW5nX2Zvcm1fbGF5b3V0X3dpZHRoJyApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0d3JhcC5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiYy1iZmItYm9va2luZ19mb3JtX2xheW91dF93aWR0aCcsIHYgKTtcblx0XHRcdH1cblx0XHR9XG5cdCk7XG59ICk7XG5cblxuLy8gRGVidWcgUHJldmlldyBNb2RlLlxuV1BCQ19CRkJfU2V0dGluZ3NfRWZmZWN0cy5yZWdpc3RlciggJ2Jvb2tpbmdfYmZiX3ByZXZpZXdfbW9kZScsIGZ1bmN0aW9uICh2YWx1ZSwgY3R4KSB7XG5cdGNvbnN0IHJvb3QgPSBjdHguY2FudmFzO1xuXHRpZiAoICEgcm9vdCB8fCAhIHJvb3QucXVlcnlTZWxlY3RvckFsbCApIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRjb25zdCB3cmFwcyA9IHJvb3QucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2NvbnRhaW5lci53cGJjX2Zvcm0nICk7XG5cdGlmICggISB3cmFwcy5sZW5ndGggKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Ly8gR2V0IGJ1aWxkZXIgYXN5bmMuXG5cdHdwYmNfYmZiX2FwaS53aXRoX2J1aWxkZXIoXG5cdFx0ZnVuY3Rpb24gKEJ1aWxkZXIpIHtcblxuXHRcdFx0LyoqXG5cdFx0XHQgKiBDYXB0dXJlIGFjdGl2ZSByaWdodCBzaWRlYmFyIHRhYiBhbmQgcmV0dXJuIHJlc3RvcmUgaGFuZGxlLlxuXHRcdFx0ICpcblx0XHRcdCAqIEByZXR1cm4ge3tyZXN0b3JlOmZ1bmN0aW9uKCk6dm9pZH18bnVsbH1cblx0XHRcdCAqL1xuXHRcdFx0ZnVuY3Rpb24gY2FwdHVyZV9yaWdodF9zaWRlYmFyX2FjdGl2ZV90YWJfcmVzdG9yZV9oYW5kbGUoKSB7XG5cblx0XHRcdFx0dmFyIHRhYmxpc3RfZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19yaWdodGJhcl90YWJzW3JvbGU9XCJ0YWJsaXN0XCJdJyApO1xuXHRcdFx0XHRpZiAoICEgdGFibGlzdF9lbCApIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHZhciBhY3RpdmVfdGFiX2VsID0gdGFibGlzdF9lbC5xdWVyeVNlbGVjdG9yKCAnW3JvbGU9XCJ0YWJcIl1bYXJpYS1zZWxlY3RlZD1cInRydWVcIl0nICk7XG5cblx0XHRcdFx0aWYgKCAhIGFjdGl2ZV90YWJfZWwgKSB7XG5cdFx0XHRcdFx0YWN0aXZlX3RhYl9lbCA9IHRhYmxpc3RfZWwucXVlcnlTZWxlY3RvciggJ1tyb2xlPVwidGFiXCJdW2FyaWEtY29udHJvbHM9XCJ3cGJjX2JmYl9fcGFsZXR0ZV9hZGRfbmV3XCJdJyApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCAhIGFjdGl2ZV90YWJfZWwgfHwgdHlwZW9mIGFjdGl2ZV90YWJfZWwuY2xpY2sgIT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHJlc3RvcmU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdHRyeSB7IGFjdGl2ZV90YWJfZWwuY2xpY2soKTsgfSBjYXRjaCAoIF9lICkge31cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdHZhciB0YWJfcmVzdG9yZV9oYW5kbGUgPSBjYXB0dXJlX3JpZ2h0X3NpZGViYXJfYWN0aXZlX3RhYl9yZXN0b3JlX2hhbmRsZSgpO1xuXG5cdFx0XHRsZXQgcmVzdG9yZWQgID0gZmFsc2U7XG5cdFx0XHR2YXIgRVZTICAgICAgPSB3aW5kb3cuV1BCQ19CRkJfQ29yZSAmJiB3aW5kb3cuV1BCQ19CRkJfQ29yZS5XUEJDX0JGQl9FdmVudHMgPyB3aW5kb3cuV1BCQ19CRkJfQ29yZS5XUEJDX0JGQl9FdmVudHMgOiB7fTtcblx0XHRcdHZhciBFVl9ET05FICA9IEVWUy5TVFJVQ1RVUkVfTE9BREVEIHx8IEVWUy5DQU5WQVNfUkVGUkVTSEVEIHx8ICd3cGJjOmJmYjpzdHJ1Y3R1cmUtbG9hZGVkJztcblxuXG5cdFx0XHRmdW5jdGlvbiBkb19yZXN0b3JlKCkge1xuXHRcdFx0XHRpZiAoIHJlc3RvcmVkICkgeyByZXR1cm47IH1cblx0XHRcdFx0cmVzdG9yZWQgPSB0cnVlO1xuXHRcdFx0XHR0cnkgeyBCdWlsZGVyPy5idXM/Lm9mZj8uKCBFVl9ET05FLCBkb19yZXN0b3JlICk7IH0gY2F0Y2ggKCBfICkge31cblx0XHRcdFx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0aWYgKCAhIHRhYl9yZXN0b3JlX2hhbmRsZSApIHsgcmV0dXJuOyB9XG5cdFx0XHRcdFx0dGFiX3Jlc3RvcmVfaGFuZGxlLnJlc3RvcmUoKTtcblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBMaXN0ZW4gb25jZSAoYmVzdCksIHBsdXMgYSBmYWxsYmFjayBpbiBjYXNlIGV2ZW50IGlzbid0IGZpcmVkLlxuXHRcdFx0dHJ5IHsgQnVpbGRlcj8uYnVzPy5vbj8uKCBFVl9ET05FLCBkb19yZXN0b3JlICk7IH0gY2F0Y2ggKCBfICkge31cblxuXG5cdFx0XHR2YXIgZW5hYmxlZCA9ICgnT24nID09PSB2YWx1ZSk7XG5cdFx0XHRCdWlsZGVyLnNldF9wcmV2aWV3X21vZGUoIGVuYWJsZWQsIHsgcmVidWlsZDogdHJ1ZSwgcmVpbml0OiB0cnVlLCBzb3VyY2U6ICdzZXR0aW5ncy1lZmZlY3RzJyB9ICk7XG5cdFx0fVxuXHQpO1xuXG59ICk7XG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMsVUFBVUEsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7RUFDaEIsWUFBWTs7RUFFWixNQUFNQyxPQUFPLEdBQUlGLENBQUMsQ0FBQ0cseUJBQXlCLEdBQUdILENBQUMsQ0FBQ0cseUJBQXlCLElBQUksQ0FBQyxDQUFFO0VBQ2pGLE1BQU1DLEdBQUcsR0FBUUYsT0FBTyxDQUFDRSxHQUFHLEdBQUdGLE9BQU8sQ0FBQ0UsR0FBRyxJQUFJQyxNQUFNLENBQUNDLE1BQU0sQ0FBRSxJQUFLLENBQUU7RUFFcEVKLE9BQU8sQ0FBQ0ssUUFBUSxHQUFHLFVBQVVDLEdBQUcsRUFBRUMsRUFBRSxFQUFFO0lBQ3JDLElBQUtELEdBQUcsSUFBSSxPQUFPQyxFQUFFLEtBQUssVUFBVSxFQUFHO01BQ3RDTCxHQUFHLENBQUNNLE1BQU0sQ0FBRUYsR0FBSSxDQUFDLENBQUMsR0FBR0MsRUFBRTtJQUN4QjtFQUNELENBQUM7RUFFRCxTQUFTRSxlQUFlQSxDQUFBLEVBQUc7SUFDMUIsT0FDQ1YsQ0FBQyxDQUFDVyxhQUFhLENBQUUsNEJBQTZCLENBQUMsSUFDL0NYLENBQUMsQ0FBQ1csYUFBYSxDQUFFLDJCQUE0QixDQUFDLElBQzlDWCxDQUFDLENBQUNZLGNBQWMsQ0FBRSxtQkFBb0IsQ0FBQyxJQUN2Q1osQ0FBQyxDQUFDYSxJQUFJLElBQUliLENBQUMsQ0FBQ2MsZUFBZTtFQUU3QjtFQUVB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
