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
function wpbc_bfb_form_appearance__sanitize_length(value, fallback) {
  const v = String(value == null ? '' : value).trim();
  if (/^-?\d+(?:\.\d+)?(?:px|rem|em|%)$/i.test(v)) {
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
    if (!/^-?\d+(?:\.\d+)?(?:px|rem|em|%)$/i.test(parts[i])) {
      return fallback;
    }
  }
  return parts.join(' ');
}
function wpbc_bfb_form_appearance__normalize_spacing_numbers(vertical, horizontal) {
  const v = String(vertical == null ? '' : vertical).trim();
  const h = String(horizontal == null ? '' : horizontal).trim();
  const vertical_num = /^-?\d+(?:\.\d+)?$/.test(v) ? v : '0';
  const horizontal_num = /^-?\d+(?:\.\d+)?$/.test(h) ? h : vertical_num;
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
  return ['booking_form_custom_background_color', 'booking_form_custom_border_color', 'booking_form_custom_border_width', 'booking_form_custom_border_radius', 'booking_form_custom_padding_vertical', 'booking_form_custom_padding_horizontal', 'booking_form_custom_text_color', 'booking_form_custom_field_background_color', 'booking_form_custom_field_text_color', 'booking_form_custom_field_border_color', 'booking_form_custom_button_background_color', 'booking_form_custom_button_text_color', 'booking_form_custom_button_border_color', 'booking_form_custom_button_hover_background_color', 'booking_form_custom_button_hover_text_color', 'booking_form_custom_button_hover_border_color', 'booking_form_custom_secondary_button_background_color', 'booking_form_custom_secondary_button_text_color', 'booking_form_custom_secondary_button_border_color', 'booking_form_custom_secondary_button_hover_background_color', 'booking_form_custom_secondary_button_hover_text_color', 'booking_form_custom_secondary_button_hover_border_color'];
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
    booking_form_custom_secondary_button_hover_border_color: '#4d91cd'
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
function wpbc_bfb_global_form_style__resolve_css_vars(options) {
  options = options && typeof options === 'object' ? options : {};
  const style = String(options.booking_form_style || 'light_bordered');
  const presets = wpbc_bfb_global_form_style__get_presets();
  const preset = presets[style] || presets.light_bordered || {};
  const defaults = wpbc_bfb_global_form_style__get_custom_defaults();
  if ('custom' !== style) {
    return preset.css_vars && typeof preset.css_vars === 'object' ? Object.assign({}, preset.css_vars) : {};
  }
  return {
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
    '--wpbc_form-button-light-text-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_secondary_button_text_color, defaults.booking_form_custom_secondary_button_text_color),
    '--wpbc_form-button-light-box-shadow': '0 2px 10px 2px #ffffff54',
    '--wpbc_form-button-light-hover-background-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_secondary_button_hover_background_color, defaults.booking_form_custom_secondary_button_hover_background_color),
    '--wpbc_form-button-light-hover-border-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_secondary_button_hover_border_color, defaults.booking_form_custom_secondary_button_hover_border_color),
    '--wpbc_form-button-light-hover-text-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_secondary_button_hover_text_color, defaults.booking_form_custom_secondary_button_hover_text_color),
    '--wpbc_form-button-light-hover-box-shadow': '0 2px 10px 2px #ffffff54',
    '--wpbc_form-button-primary-hover-border-color': wpbc_bfb_form_appearance__sanitize_color(options.booking_form_custom_button_hover_border_color, defaults.booking_form_custom_button_hover_border_color),
    '--wpbc_form-page-break-color': '#066aab'
  };
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
  const reset_row = document.querySelector('[data-wpbc-bfb-custom-appearance-reset-row]');
  wpbc_bfb_form_appearance__set_radio_control('booking_form_style', options.booking_form_style || 'light_bordered');
  document.querySelectorAll('.wpbc_bfb__form_setting_global_custom_style').forEach(function (row) {
    row.hidden = !is_custom;
    row.setAttribute('aria-hidden', is_custom ? 'false' : 'true');
    row.classList.toggle('is-hidden', !is_custom);
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
  const root = ctx && ctx.canvas || document.getElementById('wpbc_bfb__theme_scope') || document;
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
['booking_form_style', 'booking_form_custom_background_color', 'booking_form_custom_border_color', 'booking_form_custom_border_width', 'booking_form_custom_border_radius', 'booking_form_custom_padding_vertical', 'booking_form_custom_padding_horizontal', 'booking_form_custom_text_color', 'booking_form_custom_field_background_color', 'booking_form_custom_field_text_color', 'booking_form_custom_field_border_color', 'booking_form_custom_button_background_color', 'booking_form_custom_button_text_color', 'booking_form_custom_button_border_color', 'booking_form_custom_button_hover_background_color', 'booking_form_custom_button_hover_text_color', 'booking_form_custom_button_hover_border_color', 'booking_form_custom_secondary_button_background_color', 'booking_form_custom_secondary_button_text_color', 'booking_form_custom_secondary_button_border_color', 'booking_form_custom_secondary_button_hover_background_color', 'booking_form_custom_secondary_button_hover_text_color', 'booking_form_custom_secondary_button_hover_border_color'].forEach(function (key) {
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
  if (v && !/^-?\d+(?:\.\d+)?(?:%|px|rem|em|vw|vh)$/.test(v)) {
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZm9ybS1zZXR0aW5ncy9fb3V0L3NldHRpbmdzX2VmZmVjdHMuanMiLCJuYW1lcyI6WyJ3IiwiZCIsIkVmZmVjdHMiLCJXUEJDX0JGQl9TZXR0aW5nc19FZmZlY3RzIiwibWFwIiwiT2JqZWN0IiwiY3JlYXRlIiwicmVnaXN0ZXIiLCJrZXkiLCJmbiIsIlN0cmluZyIsImdldF9jYW52YXNfcm9vdCIsInF1ZXJ5U2VsZWN0b3IiLCJnZXRFbGVtZW50QnlJZCIsImJvZHkiLCJkb2N1bWVudEVsZW1lbnQiLCJhcHBseV9vbmUiLCJ2YWx1ZSIsImN0eCIsImFzc2lnbiIsImNhbnZhcyIsImUiLCJjb25zb2xlIiwiZXJyb3IiLCJhcHBseV9hbGwiLCJvcHRpb25zIiwia2V5cyIsImZvckVhY2giLCJrIiwibm9ybWFsaXplX3BhY2siLCJwYWNrIiwiSlNPTiIsInBhcnNlIiwiX2UiLCJoYXNfc2hhcGUiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJjc3NfdmFycyIsImJmYl9vcHRpb25zIiwicmVhcHBseV9hZnRlcl9jYW52YXMiLCJzZXR0aW5nc19wYWNrIiwic291cmNlIiwid3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2FwcGx5Iiwic2V0VGltZW91dCIsImFkZEV2ZW50TGlzdGVuZXIiLCJkZXRhaWwiLCJzZXR0aW5ncyIsImNzc19lc2NhcGUiLCJ2IiwiQ1NTIiwiZXNjYXBlIiwicmVwbGFjZSIsImZpbmRfZnNfcm9vdCIsImVsIiwiY2xvc2VzdCIsImRpcmVjdCIsImxlbl9ncm91cCIsInNwYWNpbmdfZ3JvdXAiLCJyYW5nZV9ncm91cCIsInJlYWRfdmFsdWVfZnJvbV9mc19yb290IiwiZnNfcm9vdCIsIm9yaWdpbmFsX3RhcmdldCIsImZzX3R5cGUiLCJnZXRBdHRyaWJ1dGUiLCJjb250cm9sX2lkIiwic2VsZWN0b3IiLCJjaGVja2VkIiwiZ3JvdXAiLCJ2ZXJ0aWNhbF9pbnB1dCIsImhvcml6b250YWxfaW5wdXQiLCJ3cml0ZXIiLCJ2ZXJ0aWNhbCIsImhvcml6b250YWwiLCJjb21iaW5lZCIsIndwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fbm9ybWFsaXplX3NwYWNpbmdfbnVtYmVycyIsInR5cGUiLCJjYiIsImFwcGx5X2NoYW5nZV9mcm9tX3RhcmdldCIsInRhcmdldCIsImV2ZW50X3R5cGUiLCJldmVudF9zb3VyY2UiLCJ0YWciLCJ0YWdOYW1lIiwidG9Mb3dlckNhc2UiLCJ1c2VfY2hhbmdlIiwic2NvcGUiLCJjb250cm9sIiwiaXNfY29sb3Jpc19jb250cm9sIiwibWF0Y2hlcyIsIm9uX2NoYW5nZSIsImV2IiwiaXNUcnVzdGVkIiwib25fY29sb3Jpc19waWNrIiwiY3VycmVudEVsIiwiaW5wdXQiLCJjb2xvciIsIndpbmRvdyIsImRvY3VtZW50Iiwid3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19nZXRfcHJlc2V0cyIsImJvcmRlcmVkIiwiYmFja2dyb3VuZCIsImJvcmRlckNvbG9yIiwiYm9yZGVyV2lkdGgiLCJyYWRpdXMiLCJwYWRkaW5nIiwic2hhZG93Iiwibm9uZSIsInNvZnQiLCJ3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2lzX2RhcmtfdGhlbWUiLCJib29raW5nX2Zvcm1fdGhlbWUiLCJ3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2dldF9wcmVzZXRfZm9yX29wdGlvbnMiLCJzdHlsZSIsInByZXNldHMiLCJ3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2NvbG9yIiwiZmFsbGJhY2siLCJ0cmltIiwidGVzdCIsIndwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfb3B0aW9uYWxfY29sb3IiLCJ3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2xlbmd0aCIsIndwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfc3BhY2luZyIsInBhcnRzIiwic3BsaXQiLCJsZW5ndGgiLCJpIiwiam9pbiIsImgiLCJ2ZXJ0aWNhbF9udW0iLCJob3Jpem9udGFsX251bSIsIndwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fY29sbGVjdF9vcHRpb25zIiwiV1BCQ19CRkJfRm9ybVNldHRpbmdzIiwiY29sbGVjdCIsIndwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9faXNfY3VzdG9tX2NvbnRyb2xfa2V5IiwiYm9va2luZ19mb3JtX2NvbnRhaW5lcl9zdHlsZSIsIndwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2V0X2NvbnRhaW5lcl9zdHlsZV9jb250cm9sIiwid3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19nZXRfY3VzdG9tX2NvbnRyb2xfa2V5cyIsImluZGV4T2YiLCJ3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3NldF9yYWRpb19jb250cm9sIiwicm93Iiwid3JhcCIsInJhZGlvcyIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJyYWRpbyIsInNob3VsZF9jaGVjayIsImNob2ljZSIsImNsYXNzTGlzdCIsInRvZ2dsZSIsIndwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2V0X3NlbGVjdF9jb250cm9sIiwid3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19nZXRfY3VycmVudF9vcHRpb25zIiwid3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19nZXRfc3R5bGVfdmFsdWVfZnJvbV9vcHRpb25zIiwidGhlbWUiLCJwcmVmaXgiLCJ3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3N5bmNfZm9ybV9zdHlsZV9jb250cm9sIiwid3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19yZXNvbHZlX2Zvcm1fc3R5bGVfY2hvaWNlIiwiY3VycmVudF9vcHRpb25zIiwiY3VycmVudF90aGVtZSIsIndwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9faXNfdXNlcl90aGVtZV9zd2l0Y2giLCJ3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2lzX2N1c3RvbV9zdHlsZSIsIndwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc3luY19jdXN0b21fY29udHJvbHMiLCJpc19jdXN0b20iLCJyZXNldF9yb3ciLCJiYXNlX3RoZW1lX3JvdyIsImhpZGRlbiIsInNldEF0dHJpYnV0ZSIsIndwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fcmVzb2x2ZSIsImdsb2JhbF9vcHRpb25zIiwid3BiY19iZmJfc2V0dGluZ3NfdmFycyIsImdsb2JhbF9hcHBlYXJhbmNlIiwiYm9va2luZ19mb3JtX2JhY2tncm91bmRfY29sb3IiLCJib29raW5nX2Zvcm1fYm9yZGVyX2NvbG9yIiwiYm9va2luZ19mb3JtX2JvcmRlcl93aWR0aCIsImJvb2tpbmdfZm9ybV9ib3JkZXJfcmFkaXVzIiwiYm9va2luZ19mb3JtX3BhZGRpbmciLCJ3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Jlc29sdmVfZGVzaWduX2NvbG9ycyIsInRleHRDb2xvciIsImZpZWxkQmFja2dyb3VuZCIsImZpZWxkVGV4dCIsImZpZWxkQm9yZGVyIiwiYm9va2luZ19mb3JtX3RleHRfY29sb3IiLCJib29raW5nX2Zvcm1fZmllbGRfYmFja2dyb3VuZF9jb2xvciIsImJvb2tpbmdfZm9ybV9maWVsZF90ZXh0X2NvbG9yIiwiYm9va2luZ19mb3JtX2ZpZWxkX2JvcmRlcl9jb2xvciIsIndwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fYXBwbHlfdmFycyIsInJlc29sdmVkIiwiZGVzaWduIiwicm9vdCIsIndyYXBzIiwicmVtb3ZlUHJvcGVydHkiLCJzZXRQcm9wZXJ0eSIsIndwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19nZXRfdmFycyIsIndwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19nZXRfcHJlc2V0cyIsInZhcnMiLCJmb3JtX3N0eWxlX3ByZXNldHMiLCJ3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fZ2V0X2N1c3RvbV9rZXlzIiwid3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2dldF9jdXN0b21fZGVmYXVsdHMiLCJsb2NhbGl6ZWQiLCJjdXN0b21fZm9ybV9zdHlsZV9kZWZhdWx0cyIsImJvb2tpbmdfZm9ybV9jdXN0b21fYmFja2dyb3VuZF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfd2lkdGgiLCJib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl9yYWRpdXMiLCJib29raW5nX2Zvcm1fY3VzdG9tX3BhZGRpbmdfdmVydGljYWwiLCJib29raW5nX2Zvcm1fY3VzdG9tX3BhZGRpbmdfaG9yaXpvbnRhbCIsImJvb2tpbmdfZm9ybV9jdXN0b21fdGV4dF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYmFja2dyb3VuZF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfdGV4dF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYm9yZGVyX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYmFja2dyb3VuZF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX3RleHRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ib3JkZXJfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl9iYWNrZ3JvdW5kX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfdGV4dF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JvcmRlcl9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9iYWNrZ3JvdW5kX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX3RleHRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fYm9yZGVyX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX2JhY2tncm91bmRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfdGV4dF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl9ib3JkZXJfY29sb3IiLCJ3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fZ2V0X2N1cnJlbnRfb3B0aW9ucyIsImdsb2JhbF9mb3JtX3N0eWxlIiwiYm9va2luZ19mb3JtX3N0eWxlIiwid3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX3Jlc29sdmVfY3NzX3ZhcnMiLCJwcmVzZXQiLCJsaWdodF9ib3JkZXJlZCIsImRlZmF1bHRzIiwid3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2dldF9jc3NfdmFyX2tleXMiLCJBcnJheSIsImlzQXJyYXkiLCJmb3JtX3N0eWxlX2Nzc192YXJfbmFtZXMiLCJwcmVzZXRfa2V5IiwidmFyX25hbWUiLCJwdXNoIiwid3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX3N5bmNfY29udHJvbHMiLCJ0aGVtZV9jbGFzc2VzIiwiY3NzX3Zhcl9rZXlzIiwiY2xhc3NfbmFtZSIsInRoZW1lX2NsYXNzIiwicmVtb3ZlIiwiYWRkIiwiY3NzX2tleSIsIndwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc3luY19jdXN0b21fY29udHJvbHNfZnJvbV91aSIsInRoZW1lX3NlbGVjdG9yIiwiZnJvbSIsImNscyIsIndwYmNfYmZiX2FwaSIsIndpdGhfYnVpbGRlciIsIkJ1aWxkZXIiLCJjYXB0dXJlX3JpZ2h0X3NpZGViYXJfYWN0aXZlX3RhYl9yZXN0b3JlX2hhbmRsZSIsInRhYmxpc3RfZWwiLCJhY3RpdmVfdGFiX2VsIiwiY2xpY2siLCJyZXN0b3JlIiwidGFiX3Jlc3RvcmVfaGFuZGxlIiwicmVzdG9yZWQiLCJFVlMiLCJXUEJDX0JGQl9Db3JlIiwiV1BCQ19CRkJfRXZlbnRzIiwiRVZfRE9ORSIsIlNUUlVDVFVSRV9MT0FERUQiLCJDQU5WQVNfUkVGUkVTSEVEIiwiZG9fcmVzdG9yZSIsImJ1cyIsIm9mZiIsIl8iLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJvbiIsImVuYWJsZWQiLCJzZXRfcHJldmlld19tb2RlIiwicmVidWlsZCIsInJlaW5pdCJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2Zvcm0tc2V0dGluZ3MvX3NyYy9zZXR0aW5nc19lZmZlY3RzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQXBwbGllcyBlZmZlY3RzIGluIENhbnZhcywgYWZ0ZXIgY2hhbmdpbmcgc29tZSBzZXR0aW5ncyBpbiB0aGUgcmlnaHQgc2lkZWJhciBpbiBCRkIuXG4gKlxuICogQGZpbGUgLi4vaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZm9ybS1zZXR0aW5ncy9fc3JjL3NldHRpbmdzX2VmZmVjdHMuanNcbiAqL1xuKGZ1bmN0aW9uICh3LCBkKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHRjb25zdCBFZmZlY3RzID0gKHcuV1BCQ19CRkJfU2V0dGluZ3NfRWZmZWN0cyA9IHcuV1BCQ19CRkJfU2V0dGluZ3NfRWZmZWN0cyB8fCB7fSk7XG5cdGNvbnN0IG1hcCAgICAgPSAoRWZmZWN0cy5tYXAgPSBFZmZlY3RzLm1hcCB8fCBPYmplY3QuY3JlYXRlKCBudWxsICkpO1xuXG5cdEVmZmVjdHMucmVnaXN0ZXIgPSBmdW5jdGlvbiAoa2V5LCBmbikge1xuXHRcdGlmICgga2V5ICYmIHR5cGVvZiBmbiA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdG1hcFtTdHJpbmcoIGtleSApXSA9IGZuO1xuXHRcdH1cblx0fTtcblxuXHRmdW5jdGlvbiBnZXRfY2FudmFzX3Jvb3QoKSB7XG5cdFx0cmV0dXJuIChcblx0XHRcdGQucXVlcnlTZWxlY3RvciggJyN3cGJjX2JmYl9fcGFnZXNfY29udGFpbmVyJyApIHx8XG5cdFx0XHRkLnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX3BhbmVsLS1wcmV2aWV3JyApIHx8XG5cdFx0XHRkLmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX3ByZXZpZXcnICkgfHxcblx0XHRcdGQuYm9keSB8fCBkLmRvY3VtZW50RWxlbWVudFxuXHRcdCk7XG5cdH1cblxuXHRFZmZlY3RzLmFwcGx5X29uZSA9IGZ1bmN0aW9uIChrZXksIHZhbHVlLCBjdHgpIHtcblx0XHRjb25zdCBmbiA9IG1hcFtTdHJpbmcoIGtleSApXTtcblx0XHRpZiAoICEgZm4gKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRyeSB7XG5cdFx0XHRmbiggdmFsdWUsIE9iamVjdC5hc3NpZ24oIHsga2V5LCB2YWx1ZSwgY2FudmFzOiBnZXRfY2FudmFzX3Jvb3QoKSB9LCBjdHggfHwge30gKSApO1xuXHRcdH0gY2F0Y2ggKCBlICkge1xuXHRcdFx0Ly8ga2VlcCBzaWxlbnQgaW4gcHJvZHVjdGlvbiBpZiB5b3UgcHJlZmVyXG5cdFx0XHRjb25zb2xlLmVycm9yKCAnV1BCQyBFZmZlY3RzIGVycm9yOicsIGtleSwgZSApO1xuXHRcdH1cblx0fTtcblxuXHRFZmZlY3RzLmFwcGx5X2FsbCA9IGZ1bmN0aW9uIChvcHRpb25zLCBjdHgpIHtcblx0XHRpZiAoICEgb3B0aW9ucyB8fCB0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdE9iamVjdC5rZXlzKCBvcHRpb25zICkuZm9yRWFjaCggZnVuY3Rpb24gKGspIHtcblx0XHRcdEVmZmVjdHMuYXBwbHlfb25lKCBrLCBvcHRpb25zW2tdLCBPYmplY3QuYXNzaWduKCB7IG9wdGlvbnM6IG9wdGlvbnMgfSwgY3R4IHx8IHt9ICkgKTtcblx0XHR9ICk7XG5cdH07XG5cblx0LyoqXG5cdCAqIE5vcm1hbGl6ZSBzZXR0aW5ncyBwYWNrIHRvIHRoZSBtaW5pbXVtIHJlcXVpcmVkIHNoYXBlOlxuXHQgKiB7IG9wdGlvbnM6IHt9LCBjc3NfdmFyczoge30gfVxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IHBhY2tcblx0ICogQHJldHVybiB7e29wdGlvbnM6T2JqZWN0LCBjc3NfdmFyczpPYmplY3QsIGJmYl9vcHRpb25zPzpPYmplY3R9fG51bGx9XG5cdCAqL1xuXHRFZmZlY3RzLm5vcm1hbGl6ZV9wYWNrID0gZnVuY3Rpb24gKHBhY2spIHtcblxuXHRcdGlmICggcGFjayA9PT0gbnVsbCB8fCB0eXBlb2YgcGFjayA9PT0gJ3VuZGVmaW5lZCcgfHwgcGFjayA9PT0gJycgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHQvLyBQYXJzZSBKU09OIHN0cmluZyBpZiBuZWVkZWQuXG5cdFx0aWYgKCB0eXBlb2YgcGFjayA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRwYWNrID0gSlNPTi5wYXJzZSggcGFjayApO1xuXHRcdFx0fSBjYXRjaCAoIF9lICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoICEgcGFjayB8fCB0eXBlb2YgcGFjayAhPT0gJ29iamVjdCcgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHQvLyBJZiB1c2VyIHBhc3NlZCBqdXN0IHtrZXk6dmFsdWV9IG9wdGlvbnMgbWFwLCB3cmFwIGl0LlxuXHRcdGNvbnN0IGhhc19zaGFwZSA9XG5cdFx0XHRcdCAgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBwYWNrLCAnb3B0aW9ucycgKSB8fFxuXHRcdFx0XHQgIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggcGFjaywgJ2Nzc192YXJzJyApIHx8XG5cdFx0XHRcdCAgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBwYWNrLCAnYmZiX29wdGlvbnMnICk7XG5cblx0XHRpZiAoICEgaGFzX3NoYXBlICkge1xuXHRcdFx0cGFjayA9IHsgb3B0aW9uczogcGFjaywgY3NzX3ZhcnM6IHt9IH07XG5cdFx0fVxuXG5cdFx0aWYgKCAhIHBhY2sub3B0aW9ucyB8fCB0eXBlb2YgcGFjay5vcHRpb25zICE9PSAnb2JqZWN0JyApIHtcblx0XHRcdHBhY2sub3B0aW9ucyA9IHt9O1xuXHRcdH1cblx0XHRpZiAoICEgcGFjay5jc3NfdmFycyB8fCB0eXBlb2YgcGFjay5jc3NfdmFycyAhPT0gJ29iamVjdCcgKSB7XG5cdFx0XHRwYWNrLmNzc192YXJzID0ge307XG5cdFx0fVxuXG5cdFx0Ly8gYmZiX29wdGlvbnMgaXMgb3B0aW9uYWw7IGtlZXAgaWYgdmFsaWQuXG5cdFx0aWYgKCBwYWNrLmJmYl9vcHRpb25zICYmIHR5cGVvZiBwYWNrLmJmYl9vcHRpb25zICE9PSAnb2JqZWN0JyApIHtcblx0XHRcdGRlbGV0ZSBwYWNrLmJmYl9vcHRpb25zO1xuXHRcdH1cblxuXHRcdHJldHVybiBwYWNrO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBSZS1hcHBseSBzZXR0aW5ncyBlZmZlY3RzIGFmdGVyIGEgY2FudmFzIHJlYnVpbGQgLyBzdHJ1Y3R1cmUgbG9hZC5cblx0ICpcblx0ICogVGhpcyBpcyBuZWVkZWQgYmVjYXVzZSBzdHJ1Y3R1cmUgbG9hZGluZyBjYW4gcmVwbGFjZSBET00gbm9kZXMgdGhhdCBlZmZlY3RzIHRhcmdldC5cblx0ICpcblx0ICogQHBhcmFtIHsqfSBzZXR0aW5nc19wYWNrICBzdHJpbmd8b2JqZWN0IHNldHRpbmdzX2pzb24gcGFjayAob3IgcGxhaW4gb3B0aW9ucyBtYXApXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBbY3R4XVxuXHQgKi9cblx0RWZmZWN0cy5yZWFwcGx5X2FmdGVyX2NhbnZhcyA9IGZ1bmN0aW9uIChzZXR0aW5nc19wYWNrLCBjdHgpIHtcblxuXHRcdGNvbnN0IHBhY2sgPSBFZmZlY3RzLm5vcm1hbGl6ZV9wYWNrKCBzZXR0aW5nc19wYWNrICk7XG5cdFx0aWYgKCAhIHBhY2sgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gQXBwbHkgaW1tZWRpYXRlbHkgKGJlc3QgZWZmb3J0KS5cblx0XHRFZmZlY3RzLmFwcGx5X2FsbCggcGFjay5vcHRpb25zLCBPYmplY3QuYXNzaWduKCB7IHNvdXJjZTogJ3JlYXBwbHlfYWZ0ZXJfY2FudmFzJyB9LCBjdHggfHwge30gKSApO1xuXHRcdHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19hcHBseSggbnVsbCwgT2JqZWN0LmFzc2lnbiggeyBzb3VyY2U6ICdyZWFwcGx5X2FmdGVyX2NhbnZhcycgfSwgY3R4IHx8IHt9ICkgKTtcblxuXHRcdC8vIFNvbWUgbW9kdWxlcy9oeWRyYXRpb24gbWF5IHJ1biBzaG9ydGx5IGFmdGVyOyBkbyBvbmUgbW9yZSBwYXNzLlxuXHRcdHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdEVmZmVjdHMuYXBwbHlfYWxsKCBwYWNrLm9wdGlvbnMsIE9iamVjdC5hc3NpZ24oIHsgc291cmNlOiAncmVhcHBseV9hZnRlcl9jYW52YXNfZGVsYXllZCcgfSwgY3R4IHx8IHt9ICkgKTtcblx0XHRcdHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19hcHBseSggbnVsbCwgT2JqZWN0LmFzc2lnbiggeyBzb3VyY2U6ICdyZWFwcGx5X2FmdGVyX2NhbnZhc19kZWxheWVkJyB9LCBjdHggfHwge30gKSApO1xuXHRcdH0sIDYwICk7XG5cdH07XG5cblx0Ly8gMSkgQXBwbHkgZnJvbSBBSkFYIGxvYWQuXG5cdGQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6YmZiOmZvcm1fc2V0dGluZ3M6YXBwbHknLCBmdW5jdGlvbiAoZSkge1xuXHRcdGNvbnN0IHBhY2sgPSBlICYmIGUuZGV0YWlsID8gZS5kZXRhaWwuc2V0dGluZ3MgOiBudWxsO1xuXHRcdGlmICggcGFjayAmJiBwYWNrLm9wdGlvbnMgKSB7XG5cdFx0XHRFZmZlY3RzLmFwcGx5X2FsbCggcGFjay5vcHRpb25zLCB7IHNvdXJjZTogJ2FwcGx5JyB9ICk7XG5cdFx0fVxuXHRcdHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19hcHBseSggbnVsbCwgeyBzb3VyY2U6ICdhcHBseS1nbG9iYWwtc3R5bGUnIH0gKTtcblx0fSApO1xuXG5cdC8vIDIpIEFwcGx5IGxpdmUgZnJvbSBVSSBjaGFuZ2UgKGRlbGVnYXRlZCkuXG5cdGZ1bmN0aW9uIGNzc19lc2NhcGUodmFsdWUpIHtcblx0XHRjb25zdCB2ID0gU3RyaW5nKCB2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSApO1xuXHRcdGlmICggdy5DU1MgJiYgdHlwZW9mIHcuQ1NTLmVzY2FwZSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdHJldHVybiB3LkNTUy5lc2NhcGUoIHYgKTtcblx0XHR9XG5cdFx0cmV0dXJuIHYucmVwbGFjZSggL1teYS16QS1aMC05X1xcLV0vZywgJ1xcXFwkJicgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGZpbmRfZnNfcm9vdChlbCkge1xuXHRcdGlmICggISBlbCB8fCAhIGVsLmNsb3Nlc3QgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHQvLyAxKSBEaXJlY3Q6IGVsZW1lbnQgb3IgYW5jZXN0b3IgY2FycmllcyBGUyBrZXkgKGlucHV0L3NlbGVjdC90ZXh0YXJlYSB3cml0ZXIsIHJhZGlvIHdyYXBwZXIsIGV0Yy4pXG5cdFx0Y29uc3QgZGlyZWN0ID0gZWwuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYmZiLWZzLWtleV0nICk7XG5cdFx0aWYgKCBkaXJlY3QgKSB7XG5cdFx0XHRyZXR1cm4gZGlyZWN0O1xuXHRcdH1cblxuXHRcdC8vIDIpIExlbmd0aDogZXZlbnQgY2FtZSBmcm9tIG51bWJlci91bml0L3JhbmdlIGluc2lkZSAud3BiY19zbGlkZXJfbGVuX2dyb3VwXG5cdFx0Y29uc3QgbGVuX2dyb3VwID0gZWwuY2xvc2VzdCggJy53cGJjX3NsaWRlcl9sZW5fZ3JvdXAnICk7XG5cdFx0aWYgKCBsZW5fZ3JvdXAgKSB7XG5cdFx0XHRyZXR1cm4gKFxuXHRcdFx0XHRsZW5fZ3JvdXAucXVlcnlTZWxlY3RvciggJ2lucHV0W2RhdGEtd3BiY19zbGlkZXJfbGVuX3dyaXRlcl1bZGF0YS13cGJjLWJmYi1mcy1rZXldJyApIHx8XG5cdFx0XHRcdGxlbl9ncm91cC5xdWVyeVNlbGVjdG9yKCAnaW5wdXRbZGF0YS13cGJjLWJmYi1mcy10eXBlPVwibGVuZ3RoXCJdW2RhdGEtd3BiYy1iZmItZnMta2V5XScgKSB8fFxuXHRcdFx0XHRudWxsXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdC8vIDMpIFNwYWNpbmc6IGV2ZW50IGNhbWUgZnJvbSB2ZXJ0aWNhbC9ob3Jpem9udGFsIG51bWJlciBpbnNpZGUgLndwYmNfc3BhY2luZ19ncm91cC5cblx0XHRjb25zdCBzcGFjaW5nX2dyb3VwID0gZWwuY2xvc2VzdCggJy53cGJjX3NwYWNpbmdfZ3JvdXAnICk7XG5cdFx0aWYgKCBzcGFjaW5nX2dyb3VwICkge1xuXHRcdFx0cmV0dXJuIChcblx0XHRcdFx0c3BhY2luZ19ncm91cC5xdWVyeVNlbGVjdG9yKCAnaW5wdXRbZGF0YS13cGJjX3NwYWNpbmdfd3JpdGVyXVtkYXRhLXdwYmMtYmZiLWZzLWtleV0nICkgfHxcblx0XHRcdFx0c3BhY2luZ19ncm91cC5xdWVyeVNlbGVjdG9yKCAnaW5wdXRbZGF0YS13cGJjLWJmYi1mcy10eXBlPVwic3BhY2luZ1wiXVtkYXRhLXdwYmMtYmZiLWZzLWtleV0nICkgfHxcblx0XHRcdFx0bnVsbFxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHQvLyA0KSBSYW5nZTogZXZlbnQgY2FtZSBmcm9tIHJhbmdlIGlucHV0IGluc2lkZSAud3BiY19zbGlkZXJfcmFuZ2VfZ3JvdXBcblx0XHRjb25zdCByYW5nZV9ncm91cCA9IGVsLmNsb3Nlc3QoICcud3BiY19zbGlkZXJfcmFuZ2VfZ3JvdXAnICk7XG5cdFx0aWYgKCByYW5nZV9ncm91cCApIHtcblx0XHRcdHJldHVybiAoXG5cdFx0XHRcdHJhbmdlX2dyb3VwLnF1ZXJ5U2VsZWN0b3IoICdpbnB1dFtkYXRhLXdwYmNfc2xpZGVyX3JhbmdlX3dyaXRlcl1bZGF0YS13cGJjLWJmYi1mcy1rZXldJyApIHx8XG5cdFx0XHRcdHJhbmdlX2dyb3VwLnF1ZXJ5U2VsZWN0b3IoICdpbnB1dFtkYXRhLXdwYmNfc2xpZGVyX3JhbmdlX3dyaXRlcl0nICkgfHxcblx0XHRcdFx0bnVsbFxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGZ1bmN0aW9uIHJlYWRfdmFsdWVfZnJvbV9mc19yb290KGZzX3Jvb3QsIG9yaWdpbmFsX3RhcmdldCkge1xuXHRcdGlmICggISBmc19yb290ICkge1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZzX3R5cGUgPSBTdHJpbmcoIGZzX3Jvb3QuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJmYi1mcy10eXBlJyApIHx8ICcnICk7XG5cblx0XHQvLyBSQURJTzogcmVhZCBjaGVja2VkIHdpdGhpbiB3cmFwcGVyLlxuXHRcdGlmICggZnNfdHlwZSA9PT0gJ3JhZGlvJyApIHtcblx0XHRcdGNvbnN0IGNvbnRyb2xfaWQgPSBmc19yb290LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1iZmItZnMtY29udHJvbGlkJyApIHx8ICcnO1xuXHRcdFx0Y29uc3Qgc2VsZWN0b3IgICA9IGNvbnRyb2xfaWRcblx0XHRcdFx0PyAnaW5wdXRbdHlwZT1cInJhZGlvXCJdW25hbWU9XCInICsgY3NzX2VzY2FwZSggY29udHJvbF9pZCApICsgJ1wiXTpjaGVja2VkJ1xuXHRcdFx0XHQ6ICdpbnB1dFt0eXBlPVwicmFkaW9cIl06Y2hlY2tlZCc7XG5cblx0XHRcdGNvbnN0IGNoZWNrZWQgPSBmc19yb290LnF1ZXJ5U2VsZWN0b3IoIHNlbGVjdG9yICk7XG5cdFx0XHRyZXR1cm4gY2hlY2tlZCA/IFN0cmluZyggY2hlY2tlZC52YWx1ZSB8fCAnJyApIDogJyc7XG5cdFx0fVxuXG5cdFx0aWYgKCBmc190eXBlID09PSAnc3BhY2luZycgKSB7XG5cdFx0XHRjb25zdCBncm91cCA9ICggb3JpZ2luYWxfdGFyZ2V0ICYmIG9yaWdpbmFsX3RhcmdldC5jbG9zZXN0ICkgPyBvcmlnaW5hbF90YXJnZXQuY2xvc2VzdCggJy53cGJjX3NwYWNpbmdfZ3JvdXAnICkgOiBmc19yb290LmNsb3Nlc3QoICcud3BiY19zcGFjaW5nX2dyb3VwJyApO1xuXHRcdFx0Y29uc3QgdmVydGljYWxfaW5wdXQgPSBncm91cCA/IGdyb3VwLnF1ZXJ5U2VsZWN0b3IoICdpbnB1dFtkYXRhLXdwYmNfc3BhY2luZ192ZXJ0aWNhbF0nICkgOiBudWxsO1xuXHRcdFx0Y29uc3QgaG9yaXpvbnRhbF9pbnB1dCA9IGdyb3VwID8gZ3JvdXAucXVlcnlTZWxlY3RvciggJ2lucHV0W2RhdGEtd3BiY19zcGFjaW5nX2hvcml6b250YWxdJyApIDogbnVsbDtcblx0XHRcdGNvbnN0IHdyaXRlciA9IGdyb3VwID8gZ3JvdXAucXVlcnlTZWxlY3RvciggJ2lucHV0W2RhdGEtd3BiY19zcGFjaW5nX3dyaXRlcl0nICkgOiBudWxsO1xuXHRcdFx0Y29uc3QgdmVydGljYWwgPSB2ZXJ0aWNhbF9pbnB1dCA/IFN0cmluZyggdmVydGljYWxfaW5wdXQudmFsdWUgfHwgJzAnICkgOiAnMCc7XG5cdFx0XHRjb25zdCBob3Jpem9udGFsID0gaG9yaXpvbnRhbF9pbnB1dCA/IFN0cmluZyggaG9yaXpvbnRhbF9pbnB1dC52YWx1ZSB8fCB2ZXJ0aWNhbCApIDogdmVydGljYWw7XG5cdFx0XHRjb25zdCBjb21iaW5lZCA9IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fbm9ybWFsaXplX3NwYWNpbmdfbnVtYmVycyggdmVydGljYWwsIGhvcml6b250YWwgKTtcblxuXHRcdFx0aWYgKCB3cml0ZXIgKSB7XG5cdFx0XHRcdHdyaXRlci52YWx1ZSA9IGNvbWJpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gY29tYmluZWQ7XG5cdFx0fVxuXG5cdFx0Ly8gQ0hFQ0tCT1ggLyBUT0dHTEVcblx0XHRpZiAoIChvcmlnaW5hbF90YXJnZXQgJiYgb3JpZ2luYWxfdGFyZ2V0LnR5cGUgPT09ICdjaGVja2JveCcpIHx8IGZzX3Jvb3QudHlwZSA9PT0gJ2NoZWNrYm94JyApIHtcblx0XHRcdGNvbnN0IGNiID0gKG9yaWdpbmFsX3RhcmdldCAmJiBvcmlnaW5hbF90YXJnZXQudHlwZSA9PT0gJ2NoZWNrYm94JykgPyBvcmlnaW5hbF90YXJnZXQgOiBmc19yb290O1xuXHRcdFx0cmV0dXJuIGNiLmNoZWNrZWQgPyAnT24nIDogJ09mZic7XG5cdFx0fVxuXG5cdFx0Ly8gREVGQVVMVDogd3JpdGVyL2lucHV0L3RleHRhcmVhL3NlbGVjdFxuXHRcdGlmICggZnNfcm9vdC52YWx1ZSAhPSBudWxsICkge1xuXHRcdFx0cmV0dXJuIFN0cmluZyggZnNfcm9vdC52YWx1ZSApO1xuXHRcdH1cblx0XHRpZiAoIG9yaWdpbmFsX3RhcmdldCAmJiBvcmlnaW5hbF90YXJnZXQudmFsdWUgIT0gbnVsbCApIHtcblx0XHRcdHJldHVybiBTdHJpbmcoIG9yaWdpbmFsX3RhcmdldC52YWx1ZSApO1xuXHRcdH1cblxuXHRcdHJldHVybiAnJztcblx0fVxuXG5cdGZ1bmN0aW9uIGFwcGx5X2NoYW5nZV9mcm9tX3RhcmdldCh0YXJnZXQsIGV2ZW50X3R5cGUsIGV2ZW50X3NvdXJjZSkge1xuXHRcdGlmICggISB0YXJnZXQgKSB7IHJldHVybjsgfVxuXG5cdFx0Y29uc3QgZnNfcm9vdCA9IGZpbmRfZnNfcm9vdCggdGFyZ2V0ICk7XG5cdFx0aWYgKCAhIGZzX3Jvb3QgKSB7IHJldHVybjsgfVxuXG5cblx0XHQvLyBOb3JtYWxpemUgZXZlbnRzIHNvIGVhY2ggY29udHJvbCBwcm9kdWNlcyBleGFjdGx5IG9uZSBlZmZlY3QgY2FsbC5cblx0XHQvLyAtIHRvZ2dsZS9zZWxlY3QvcmFkaW8vY2hlY2tib3ggPT4gXCJjaGFuZ2VcIiBvbmx5LlxuXHRcdC8vIC0gZXZlcnl0aGluZyBlbHNlICAgICAgICAgICAgICA9PiBcImlucHV0XCIgb25seS5cblx0XHRjb25zdCBmc190eXBlID0gU3RyaW5nKCBmc19yb290LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1iZmItZnMtdHlwZScgKSB8fCAnJyApO1xuXHRcdGNvbnN0IHRhZyAgICAgPSBTdHJpbmcoIHRhcmdldC50YWdOYW1lIHx8ICcnICkudG9Mb3dlckNhc2UoKTtcblx0XHRjb25zdCB0eXBlICAgID0gU3RyaW5nKCB0YXJnZXQudHlwZSB8fCAnJyApLnRvTG93ZXJDYXNlKCk7XG5cblx0XHRjb25zdCB1c2VfY2hhbmdlID0gKGZzX3R5cGUgPT09ICd0b2dnbGUnKSB8fCAoZnNfdHlwZSA9PT0gJ3NlbGVjdCcpIHx8IChmc190eXBlID09PSAncmFkaW8nKSB8fCAodHlwZSA9PT0gJ2NoZWNrYm94JykgfHwgKHR5cGUgPT09ICdyYWRpbycpIHx8ICh0YWcgPT09ICdzZWxlY3QnKTtcblxuXHRcdGlmICggdXNlX2NoYW5nZSAmJiBldmVudF90eXBlICE9PSAnY2hhbmdlJyApIHsgcmV0dXJuOyB9XG5cdFx0aWYgKCAhIHVzZV9jaGFuZ2UgJiYgZXZlbnRfdHlwZSAhPT0gJ2lucHV0JyApIHsgcmV0dXJuOyB9XG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5cdFx0Y29uc3Qga2V5ID0gZnNfcm9vdC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYmZiLWZzLWtleScgKTtcblx0XHRpZiAoICEga2V5ICkgeyByZXR1cm47IH1cblxuXHRcdGNvbnN0IHNjb3BlID0gZnNfcm9vdC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYmZiLWZzLXNjb3BlJyApIHx8ICcnO1xuXHRcdGNvbnN0IHZhbHVlID0gcmVhZF92YWx1ZV9mcm9tX2ZzX3Jvb3QoIGZzX3Jvb3QsIHRhcmdldCApO1xuXG5cdFx0RWZmZWN0cy5hcHBseV9vbmUoIGtleSwgdmFsdWUsIHsgc291cmNlOiBldmVudF9zb3VyY2UgfHwgJ3VpJywgc2NvcGU6IHNjb3BlLCBjb250cm9sOiB0YXJnZXQsIGZzX3Jvb3Q6IGZzX3Jvb3QgfSApO1xuXHR9XG5cblx0ZnVuY3Rpb24gaXNfY29sb3Jpc19jb250cm9sKHRhcmdldCkge1xuXHRcdGlmICggISB0YXJnZXQgfHwgISB0YXJnZXQubWF0Y2hlcyApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLWJmYi1mcy10eXBlPVwiY29sb3JcIl0sIFtkYXRhLWluc3BlY3Rvci10eXBlPVwiY29sb3JcIl0sIC53cGJjX2JmYl9jb2xvcmlzJyApO1xuXHR9XG5cblx0ZnVuY3Rpb24gb25fY2hhbmdlKGV2KSB7XG5cdFx0Ly8gSWdub3JlIGdlbmVyaWMgc3ludGhldGljIGV2ZW50cyBkaXNwYXRjaGVkIGJ5IGNvZGUgKGFwcGx5L3JlYXBwbHksIHNsaWRlciBzeW5jLCBldGMuKS5cblx0XHQvLyBDb2xvcmlzIGRpc3BhdGNoZXMgc3ludGhldGljIGlucHV0IGV2ZW50cyB3aGlsZSB0aGUgdXNlciBwaWNrcyBhIGNvbG9yLCBzbyBhbGxvdyB0aG9zZSBjb2xvciBjb250cm9scyB0aHJvdWdoLlxuXHRcdGlmICggZXYgJiYgZXYuaXNUcnVzdGVkID09PSBmYWxzZSAmJiAhIGlzX2NvbG9yaXNfY29udHJvbCggZXYudGFyZ2V0ICkgKSB7IHJldHVybjsgfVxuXHRcdGFwcGx5X2NoYW5nZV9mcm9tX3RhcmdldCggZXYgJiYgZXYudGFyZ2V0LCBldiAmJiBldi50eXBlLCAoIGV2ICYmIGV2LmlzVHJ1c3RlZCA9PT0gZmFsc2UgKSA/ICdjb2xvcmlzJyA6ICd1aScgKTtcblx0fVxuXG5cdGQuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0Jywgb25fY2hhbmdlLCBmYWxzZSApO1xuXHRkLmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBvbl9jaGFuZ2UsIGZhbHNlICk7XG5cdGZ1bmN0aW9uIG9uX2NvbG9yaXNfcGljayhldikge1xuXHRcdGNvbnN0IGRldGFpbCA9IGV2ICYmIGV2LmRldGFpbCA/IGV2LmRldGFpbCA6IHt9O1xuXHRcdGNvbnN0IHRhcmdldCA9IGRldGFpbC5jdXJyZW50RWwgfHwgZGV0YWlsLmVsIHx8IGRldGFpbC5pbnB1dCB8fCBldi50YXJnZXQgfHwgbnVsbDtcblxuXHRcdGlmICggISBpc19jb2xvcmlzX2NvbnRyb2woIHRhcmdldCApICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICggZGV0YWlsLmNvbG9yICYmIHRhcmdldC52YWx1ZSAhPT0gZGV0YWlsLmNvbG9yICkge1xuXHRcdFx0dGFyZ2V0LnZhbHVlID0gZGV0YWlsLmNvbG9yO1xuXHRcdH1cblxuXHRcdGFwcGx5X2NoYW5nZV9mcm9tX3RhcmdldCggdGFyZ2V0LCAnaW5wdXQnLCAnY29sb3JpcycgKTtcblx0fVxuXHRkLmFkZEV2ZW50TGlzdGVuZXIoICdjb2xvcmlzOnBpY2snLCBvbl9jb2xvcmlzX3BpY2ssIGZhbHNlICk7XG5cdGQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6YmZiOmNvbG9yaXM6Y2hhbmdlJywgb25fY29sb3Jpc19waWNrLCBmYWxzZSApO1xuXG59KSggd2luZG93LCBkb2N1bWVudCApO1xuXG5mdW5jdGlvbiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2dldF9wcmVzZXRzKCkge1xuXHRyZXR1cm4ge1xuXHRcdGJvcmRlcmVkOiB7XG5cdFx0XHRiYWNrZ3JvdW5kIDogJyNmZmZmZmYnLFxuXHRcdFx0Ym9yZGVyQ29sb3I6ICcjY2NjY2NjJyxcblx0XHRcdGJvcmRlcldpZHRoOiAnMXB4Jyxcblx0XHRcdHJhZGl1cyAgICAgOiAnMnB4Jyxcblx0XHRcdHBhZGRpbmcgICAgOiAnMTBweCAzMHB4Jyxcblx0XHRcdHNoYWRvdyAgICAgOiAncmdiYSgwLCAwLCAwLCAwLjA1KSAwcHggMnB4IDZweCAwcHgnXG5cdFx0fSxcblx0XHRub25lICAgIDoge1xuXHRcdFx0YmFja2dyb3VuZCA6ICd0cmFuc3BhcmVudCcsXG5cdFx0XHRib3JkZXJDb2xvcjogJ3RyYW5zcGFyZW50Jyxcblx0XHRcdGJvcmRlcldpZHRoOiAnMHB4Jyxcblx0XHRcdHJhZGl1cyAgICAgOiAnMHB4Jyxcblx0XHRcdHBhZGRpbmcgICAgOiAnMHB4Jyxcblx0XHRcdHNoYWRvdyAgICAgOiAnbm9uZSdcblx0XHR9LFxuXHRcdHNvZnQgICAgOiB7XG5cdFx0XHRiYWNrZ3JvdW5kIDogJyNmOWY5ZmEnLFxuXHRcdFx0Ym9yZGVyQ29sb3I6ICcjZmZmJyxcblx0XHRcdGJvcmRlcldpZHRoOiAnM3B4Jyxcblx0XHRcdHJhZGl1cyAgICAgOiAnOHB4Jyxcblx0XHRcdHBhZGRpbmcgICAgOiAnMjBweCcsXG5cdFx0XHRzaGFkb3cgICAgIDogJ3JnYmEoMTUsIDIzLCA0MiwgMC4wNikgMHB4IDRweCAxNnB4IDBweCdcblx0XHR9XG5cdH07XG59XG5cbmZ1bmN0aW9uIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9faXNfZGFya190aGVtZShvcHRpb25zKSB7XG5cdG9wdGlvbnMgPSBvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zID09PSAnb2JqZWN0JyA/IG9wdGlvbnMgOiB7fTtcblx0cmV0dXJuICd3cGJjX3RoZW1lX2RhcmtfMScgPT09IFN0cmluZyggb3B0aW9ucy5ib29raW5nX2Zvcm1fdGhlbWUgfHwgJycgKTtcbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19nZXRfcHJlc2V0X2Zvcl9vcHRpb25zKHN0eWxlLCBvcHRpb25zKSB7XG5cdGNvbnN0IHByZXNldHMgPSB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2dldF9wcmVzZXRzKCk7XG5cblx0aWYgKCAhIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9faXNfZGFya190aGVtZSggb3B0aW9ucyApICkge1xuXHRcdHJldHVybiBwcmVzZXRzW3N0eWxlXSB8fCBwcmVzZXRzLmJvcmRlcmVkO1xuXHR9XG5cblx0aWYgKCAnc29mdCcgPT09IHN0eWxlICkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRiYWNrZ3JvdW5kIDogJyMxZjI5MzcnLFxuXHRcdFx0Ym9yZGVyQ29sb3I6ICcjMzM0MTU1Jyxcblx0XHRcdGJvcmRlcldpZHRoOiAnM3B4Jyxcblx0XHRcdHJhZGl1cyAgICAgOiAnOHB4Jyxcblx0XHRcdHBhZGRpbmcgICAgOiAnMjBweCcsXG5cdFx0XHRzaGFkb3cgICAgIDogJ3JnYmEoMCwgMCwgMCwgMC4yNCkgMHB4IDRweCAxNnB4IDBweCdcblx0XHR9O1xuXHR9XG5cblx0cmV0dXJuIHByZXNldHNbc3R5bGVdIHx8IHByZXNldHMuYm9yZGVyZWQ7XG59XG5cbmZ1bmN0aW9uIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfY29sb3IodmFsdWUsIGZhbGxiYWNrKSB7XG5cdGNvbnN0IHYgPSBTdHJpbmcoIHZhbHVlID09IG51bGwgPyAnJyA6IHZhbHVlICkudHJpbSgpO1xuXHRpZiAoIC9eIyg/OlswLTlhLWZdezN9fFswLTlhLWZdezZ9KSQvaS50ZXN0KCB2ICkgKSB7XG5cdFx0cmV0dXJuIHY7XG5cdH1cblx0aWYgKCB2ID09PSAndHJhbnNwYXJlbnQnICkge1xuXHRcdHJldHVybiB2O1xuXHR9XG5cdHJldHVybiBmYWxsYmFjaztcbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9vcHRpb25hbF9jb2xvcih2YWx1ZSkge1xuXHRyZXR1cm4gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9jb2xvciggdmFsdWUsICcnICk7XG59XG5cbmZ1bmN0aW9uIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfbGVuZ3RoKHZhbHVlLCBmYWxsYmFjaykge1xuXHRjb25zdCB2ID0gU3RyaW5nKCB2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSApLnRyaW0oKTtcblx0aWYgKCAvXi0/XFxkKyg/OlxcLlxcZCspPyg/OnB4fHJlbXxlbXwlKSQvaS50ZXN0KCB2ICkgKSB7XG5cdFx0cmV0dXJuIHY7XG5cdH1cblx0cmV0dXJuIGZhbGxiYWNrO1xufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX3NwYWNpbmcodmFsdWUsIGZhbGxiYWNrKSB7XG5cdGNvbnN0IHYgPSBTdHJpbmcoIHZhbHVlID09IG51bGwgPyAnJyA6IHZhbHVlICkudHJpbSgpLnJlcGxhY2UoIC9cXHMrL2csICcgJyApO1xuXHRjb25zdCBwYXJ0cyA9IHYgPyB2LnNwbGl0KCAnICcgKSA6IFtdO1xuXHRpZiAoIHBhcnRzLmxlbmd0aCA8IDEgfHwgcGFydHMubGVuZ3RoID4gNCApIHtcblx0XHRyZXR1cm4gZmFsbGJhY2s7XG5cdH1cblx0Zm9yICggbGV0IGkgPSAwOyBpIDwgcGFydHMubGVuZ3RoOyBpKysgKSB7XG5cdFx0aWYgKCAhIC9eLT9cXGQrKD86XFwuXFxkKyk/KD86cHh8cmVtfGVtfCUpJC9pLnRlc3QoIHBhcnRzW2ldICkgKSB7XG5cdFx0XHRyZXR1cm4gZmFsbGJhY2s7XG5cdFx0fVxuXHR9XG5cdHJldHVybiBwYXJ0cy5qb2luKCAnICcgKTtcbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19ub3JtYWxpemVfc3BhY2luZ19udW1iZXJzKHZlcnRpY2FsLCBob3Jpem9udGFsKSB7XG5cdGNvbnN0IHYgPSBTdHJpbmcoIHZlcnRpY2FsID09IG51bGwgPyAnJyA6IHZlcnRpY2FsICkudHJpbSgpO1xuXHRjb25zdCBoID0gU3RyaW5nKCBob3Jpem9udGFsID09IG51bGwgPyAnJyA6IGhvcml6b250YWwgKS50cmltKCk7XG5cdGNvbnN0IHZlcnRpY2FsX251bSA9IC9eLT9cXGQrKD86XFwuXFxkKyk/JC8udGVzdCggdiApID8gdiA6ICcwJztcblx0Y29uc3QgaG9yaXpvbnRhbF9udW0gPSAvXi0/XFxkKyg/OlxcLlxcZCspPyQvLnRlc3QoIGggKSA/IGggOiB2ZXJ0aWNhbF9udW07XG5cblx0cmV0dXJuIHZlcnRpY2FsX251bSArICdweCAnICsgaG9yaXpvbnRhbF9udW0gKyAncHgnO1xufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2NvbGxlY3Rfb3B0aW9ucyhjdHgsIGtleSwgdmFsdWUpIHtcblx0bGV0IG9wdGlvbnMgPSAoY3R4ICYmIGN0eC5vcHRpb25zICYmIHR5cGVvZiBjdHgub3B0aW9ucyA9PT0gJ29iamVjdCcpID8gT2JqZWN0LmFzc2lnbigge30sIGN0eC5vcHRpb25zICkgOiB7fTtcblxuXHRpZiAoIHdpbmRvdy5XUEJDX0JGQl9Gb3JtU2V0dGluZ3MgJiYgdHlwZW9mIHdpbmRvdy5XUEJDX0JGQl9Gb3JtU2V0dGluZ3MuY29sbGVjdCA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRvcHRpb25zID0gT2JqZWN0LmFzc2lnbiggd2luZG93LldQQkNfQkZCX0Zvcm1TZXR0aW5ncy5jb2xsZWN0KCAnZm9ybScgKSB8fCB7fSwgb3B0aW9ucyApO1xuXHR9XG5cblx0aWYgKCBrZXkgKSB7XG5cdFx0b3B0aW9uc1tTdHJpbmcoIGtleSApXSA9IHZhbHVlO1xuXHR9XG5cblx0aWYgKCB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2lzX2N1c3RvbV9jb250cm9sX2tleSgga2V5ICkgKSB7XG5cdFx0b3B0aW9ucy5ib29raW5nX2Zvcm1fY29udGFpbmVyX3N0eWxlID0gJ2N1c3RvbSc7XG5cdFx0d3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zZXRfY29udGFpbmVyX3N0eWxlX2NvbnRyb2woICdjdXN0b20nICk7XG5cdH1cblxuXHRyZXR1cm4gb3B0aW9ucztcbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19nZXRfY3VzdG9tX2NvbnRyb2xfa2V5cygpIHtcblx0cmV0dXJuIFtcblx0XHQnYm9va2luZ19mb3JtX2JhY2tncm91bmRfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fYm9yZGVyX2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2JvcmRlcl93aWR0aCcsXG5cdFx0J2Jvb2tpbmdfZm9ybV9ib3JkZXJfcmFkaXVzJyxcblx0XHQnYm9va2luZ19mb3JtX3BhZGRpbmcnLFxuXHRcdCdib29raW5nX2Zvcm1fdGV4dF9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9maWVsZF9iYWNrZ3JvdW5kX2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2ZpZWxkX3RleHRfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fZmllbGRfYm9yZGVyX2NvbG9yJ1xuXHRdO1xufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2lzX2N1c3RvbV9jb250cm9sX2tleShrZXkpIHtcblx0cmV0dXJuIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fZ2V0X2N1c3RvbV9jb250cm9sX2tleXMoKS5pbmRleE9mKCBTdHJpbmcoIGtleSB8fCAnJyApICkgIT09IC0xO1xufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3NldF9jb250YWluZXJfc3R5bGVfY29udHJvbCh2YWx1ZSkge1xuXHRjb25zdCBjb250cm9sID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYmZiLWZzLWtleT1cImJvb2tpbmdfZm9ybV9jb250YWluZXJfc3R5bGVcIl0nICk7XG5cdGlmICggISBjb250cm9sIHx8IGNvbnRyb2wudmFsdWUgPT09IHZhbHVlICkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnRyb2wudmFsdWUgPSB2YWx1ZTtcbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zZXRfcmFkaW9fY29udHJvbChrZXksIHZhbHVlKSB7XG5cdGNvbnN0IHJvdyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX2Zvcm1fc2V0dGluZ1tkYXRhLWtleT1cIicgKyBrZXkgKyAnXCJdJyApO1xuXHRpZiAoICEgcm93ICkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IHdyYXAgPSByb3cucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fZm9ybV9zZXR0aW5nX3JhZGlvW2RhdGEtd3BiYy1iZmItZnMtY29udHJvbGlkXScgKTtcblx0Y29uc3QgY29udHJvbF9pZCA9IHdyYXAgPyBTdHJpbmcoIHdyYXAuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJmYi1mcy1jb250cm9saWQnICkgfHwgJycgKSA6ICcnO1xuXHRjb25zdCByYWRpb3MgPSBjb250cm9sX2lkXG5cdFx0PyByb3cucXVlcnlTZWxlY3RvckFsbCggJ2lucHV0W3R5cGU9XCJyYWRpb1wiXVtuYW1lPVwiJyArIGNvbnRyb2xfaWQgKyAnXCJdJyApXG5cdFx0OiByb3cucXVlcnlTZWxlY3RvckFsbCggJ2lucHV0W3R5cGU9XCJyYWRpb1wiXScgKTtcblxuXHRyYWRpb3MuZm9yRWFjaCggZnVuY3Rpb24gKHJhZGlvKSB7XG5cdFx0Y29uc3Qgc2hvdWxkX2NoZWNrID0gKCBTdHJpbmcoIHJhZGlvLnZhbHVlICkgPT09IFN0cmluZyggdmFsdWUgPT0gbnVsbCA/ICcnIDogdmFsdWUgKSApO1xuXHRcdHJhZGlvLmNoZWNrZWQgPSBzaG91bGRfY2hlY2s7XG5cblx0XHRjb25zdCBjaG9pY2UgPSByYWRpby5jbG9zZXN0ID8gcmFkaW8uY2xvc2VzdCggJy53cGJjX3RoZW1lX2Nob2ljZScgKSA6IG51bGw7XG5cdFx0aWYgKCBjaG9pY2UgKSB7XG5cdFx0XHRjaG9pY2UuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLXNlbGVjdGVkJywgc2hvdWxkX2NoZWNrICk7XG5cdFx0fVxuXHR9ICk7XG59XG5cbmZ1bmN0aW9uIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2V0X3NlbGVjdF9jb250cm9sKGtleSwgdmFsdWUpIHtcblx0Y29uc3QgY29udHJvbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJmYi1mcy1rZXk9XCInICsga2V5ICsgJ1wiXScgKTtcblx0aWYgKCBjb250cm9sICkge1xuXHRcdGNvbnRyb2wudmFsdWUgPSBTdHJpbmcoIHZhbHVlID09IG51bGwgPyAnJyA6IHZhbHVlICk7XG5cdH1cbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19nZXRfY3VycmVudF9vcHRpb25zKCkge1xuXHRyZXR1cm4gd2luZG93LldQQkNfQkZCX0Zvcm1TZXR0aW5ncyAmJiB0eXBlb2Ygd2luZG93LldQQkNfQkZCX0Zvcm1TZXR0aW5ncy5jb2xsZWN0ID09PSAnZnVuY3Rpb24nXG5cdFx0PyB3aW5kb3cuV1BCQ19CRkJfRm9ybVNldHRpbmdzLmNvbGxlY3QoICdmb3JtJyApIHx8IHt9XG5cdFx0OiB7fTtcbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19nZXRfc3R5bGVfdmFsdWVfZnJvbV9vcHRpb25zKG9wdGlvbnMpIHtcblx0b3B0aW9ucyA9IG9wdGlvbnMgJiYgdHlwZW9mIG9wdGlvbnMgPT09ICdvYmplY3QnID8gb3B0aW9ucyA6IHt9O1xuXG5cdGNvbnN0IHRoZW1lID0gU3RyaW5nKCBvcHRpb25zLmJvb2tpbmdfZm9ybV90aGVtZSB8fCAnJyApO1xuXHRjb25zdCBzdHlsZSA9IFN0cmluZyggb3B0aW9ucy5ib29raW5nX2Zvcm1fY29udGFpbmVyX3N0eWxlIHx8ICdpbmhlcml0JyApO1xuXG5cdGlmICggJ2N1c3RvbScgPT09IHN0eWxlICkge1xuXHRcdHJldHVybiAnY3VzdG9tJztcblx0fVxuXHRpZiAoICdpbmhlcml0JyA9PT0gc3R5bGUgfHwgJycgPT09IHN0eWxlICkge1xuXHRcdHJldHVybiAnaW5oZXJpdCc7XG5cdH1cblxuXHRjb25zdCBwcmVmaXggPSAoICd3cGJjX3RoZW1lX2RhcmtfMScgPT09IHRoZW1lICkgPyAnZGFyaycgOiAnbGlnaHQnO1xuXHRpZiAoIFsgJ2JvcmRlcmVkJywgJ25vbmUnLCAnc29mdCcgXS5pbmRleE9mKCBzdHlsZSApID09PSAtMSApIHtcblx0XHRyZXR1cm4gcHJlZml4ICsgJ19ib3JkZXJlZCc7XG5cdH1cblxuXHRyZXR1cm4gcHJlZml4ICsgJ18nICsgc3R5bGU7XG59XG5cbmZ1bmN0aW9uIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc3luY19mb3JtX3N0eWxlX2NvbnRyb2wob3B0aW9ucykge1xuXHR3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3NldF9yYWRpb19jb250cm9sKCAnYm9va2luZ19mb3JtX3N0eWxlJywgd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19nZXRfc3R5bGVfdmFsdWVfZnJvbV9vcHRpb25zKCBvcHRpb25zICkgKTtcbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19yZXNvbHZlX2Zvcm1fc3R5bGVfY2hvaWNlKHZhbHVlKSB7XG5cdGNvbnN0IGN1cnJlbnRfb3B0aW9ucyA9IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fZ2V0X2N1cnJlbnRfb3B0aW9ucygpO1xuXHRjb25zdCBjdXJyZW50X3RoZW1lID0gU3RyaW5nKCBjdXJyZW50X29wdGlvbnMuYm9va2luZ19mb3JtX3RoZW1lIHx8ICcnICk7XG5cdGNvbnN0IGNob2ljZSA9IFN0cmluZyggdmFsdWUgfHwgJ2luaGVyaXQnICk7XG5cblx0aWYgKCAnY3VzdG9tJyA9PT0gY2hvaWNlICkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRib29raW5nX2Zvcm1fdGhlbWUgICAgICAgICAgOiBjdXJyZW50X3RoZW1lLFxuXHRcdFx0Ym9va2luZ19mb3JtX2NvbnRhaW5lcl9zdHlsZTogJ2N1c3RvbSdcblx0XHR9O1xuXHR9XG5cdGlmICggJ2luaGVyaXQnID09PSBjaG9pY2UgfHwgJycgPT09IGNob2ljZSApIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Ym9va2luZ19mb3JtX3RoZW1lICAgICAgICAgIDogJycsXG5cdFx0XHRib29raW5nX2Zvcm1fY29udGFpbmVyX3N0eWxlOiAnaW5oZXJpdCdcblx0XHR9O1xuXHR9XG5cblx0Y29uc3QgcGFydHMgPSBjaG9pY2Uuc3BsaXQoICdfJyApO1xuXHRjb25zdCB0aGVtZSA9ICggJ2RhcmsnID09PSBwYXJ0c1swXSApID8gJ3dwYmNfdGhlbWVfZGFya18xJyA6ICcnO1xuXHRjb25zdCBzdHlsZSA9IHBhcnRzWzFdIHx8ICdib3JkZXJlZCc7XG5cblx0cmV0dXJuIHtcblx0XHRib29raW5nX2Zvcm1fdGhlbWUgICAgICAgICAgOiB0aGVtZSxcblx0XHRib29raW5nX2Zvcm1fY29udGFpbmVyX3N0eWxlOiAoIFsgJ2JvcmRlcmVkJywgJ25vbmUnLCAnc29mdCcgXS5pbmRleE9mKCBzdHlsZSApID09PSAtMSApID8gJ2JvcmRlcmVkJyA6IHN0eWxlXG5cdH07XG59XG5cbmZ1bmN0aW9uIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9faXNfdXNlcl90aGVtZV9zd2l0Y2goY3R4KSB7XG5cdGNvbnN0IHNvdXJjZSA9IFN0cmluZyggY3R4ICYmIGN0eC5zb3VyY2UgPyBjdHguc291cmNlIDogJycgKTtcblx0cmV0dXJuIFsgJ3VpJywgJ2NvbG9yaXMnIF0uaW5kZXhPZiggc291cmNlICkgIT09IC0xO1xufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2lzX2N1c3RvbV9zdHlsZShvcHRpb25zKSB7XG5cdHJldHVybiBTdHJpbmcoIG9wdGlvbnMgJiYgb3B0aW9ucy5ib29raW5nX2Zvcm1fY29udGFpbmVyX3N0eWxlID8gb3B0aW9ucy5ib29raW5nX2Zvcm1fY29udGFpbmVyX3N0eWxlIDogJ2luaGVyaXQnICkgPT09ICdjdXN0b20nO1xufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3N5bmNfY3VzdG9tX2NvbnRyb2xzKG9wdGlvbnMpIHtcblx0Y29uc3QgaXNfY3VzdG9tID0gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19pc19jdXN0b21fc3R5bGUoIG9wdGlvbnMgKTtcblx0Y29uc3QgcmVzZXRfcm93ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYmZiLWN1c3RvbS1hcHBlYXJhbmNlLXJlc2V0LXJvd10nICk7XG5cdGNvbnN0IGJhc2VfdGhlbWVfcm93ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fZm9ybV9zZXR0aW5nW2RhdGEta2V5PVwiYm9va2luZ19mb3JtX3RoZW1lXCJdJyApO1xuXG5cdHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fZ2V0X2N1c3RvbV9jb250cm9sX2tleXMoKS5mb3JFYWNoKCBmdW5jdGlvbiAoa2V5KSB7XG5cdFx0Y29uc3Qgcm93ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fZm9ybV9zZXR0aW5nW2RhdGEta2V5PVwiJyArIGtleSArICdcIl0nICk7XG5cdFx0aWYgKCAhIHJvdyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cm93LmhpZGRlbiA9ICEgaXNfY3VzdG9tO1xuXHRcdHJvdy5zZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicsIGlzX2N1c3RvbSA/ICdmYWxzZScgOiAndHJ1ZScgKTtcblx0XHRyb3cuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWhpZGRlbicsICEgaXNfY3VzdG9tICk7XG5cdH0gKTtcblxuXHRpZiAoIHJlc2V0X3JvdyApIHtcblx0XHRyZXNldF9yb3cuaGlkZGVuID0gISBpc19jdXN0b207XG5cdFx0cmVzZXRfcm93LnNldEF0dHJpYnV0ZSggJ2FyaWEtaGlkZGVuJywgaXNfY3VzdG9tID8gJ2ZhbHNlJyA6ICd0cnVlJyApO1xuXHRcdHJlc2V0X3Jvdy5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtaGlkZGVuJywgISBpc19jdXN0b20gKTtcblx0fVxuXG5cdGlmICggYmFzZV90aGVtZV9yb3cgKSB7XG5cdFx0YmFzZV90aGVtZV9yb3cuaGlkZGVuID0gISBpc19jdXN0b207XG5cdFx0YmFzZV90aGVtZV9yb3cuc2V0QXR0cmlidXRlKCAnYXJpYS1oaWRkZW4nLCBpc19jdXN0b20gPyAnZmFsc2UnIDogJ3RydWUnICk7XG5cdFx0YmFzZV90aGVtZV9yb3cuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWhpZGRlbicsICEgaXNfY3VzdG9tICk7XG5cdH1cbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19yZXNvbHZlKG9wdGlvbnMpIHtcblx0bGV0IHN0eWxlICAgICA9IFN0cmluZyggb3B0aW9ucy5ib29raW5nX2Zvcm1fY29udGFpbmVyX3N0eWxlIHx8ICdpbmhlcml0JyApO1xuXG5cdGlmICggc3R5bGUgPT09ICdpbmhlcml0JyApIHtcblx0XHRjb25zdCBnbG9iYWxfb3B0aW9ucyA9IHdpbmRvdy53cGJjX2JmYl9zZXR0aW5nc192YXJzICYmIHdpbmRvdy53cGJjX2JmYl9zZXR0aW5nc192YXJzLmdsb2JhbF9hcHBlYXJhbmNlXG5cdFx0XHQ/IHdpbmRvdy53cGJjX2JmYl9zZXR0aW5nc192YXJzLmdsb2JhbF9hcHBlYXJhbmNlXG5cdFx0XHQ6IHt9O1xuXHRcdG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKCB7fSwgZ2xvYmFsX29wdGlvbnMgfHwge30gKTtcblx0XHRzdHlsZSA9IFN0cmluZyggb3B0aW9ucy5ib29raW5nX2Zvcm1fY29udGFpbmVyX3N0eWxlIHx8ICdib3JkZXJlZCcgKTtcblx0fVxuXG5cdGlmICggc3R5bGUgPT09ICdib3JkZXJlZCcgKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRpZiAoIHN0eWxlICE9PSAnY3VzdG9tJyApIHtcblx0XHRyZXR1cm4gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19nZXRfcHJlc2V0X2Zvcl9vcHRpb25zKCBzdHlsZSwgb3B0aW9ucyApO1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRiYWNrZ3JvdW5kIDogd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9jb2xvciggb3B0aW9ucy5ib29raW5nX2Zvcm1fYmFja2dyb3VuZF9jb2xvciwgJyNmZmZmZmYnICksXG5cdFx0Ym9yZGVyQ29sb3I6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX2JvcmRlcl9jb2xvciwgJyNjY2NjY2MnICksXG5cdFx0Ym9yZGVyV2lkdGg6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfbGVuZ3RoKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9ib3JkZXJfd2lkdGgsICcxcHgnICksXG5cdFx0cmFkaXVzICAgICA6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfbGVuZ3RoKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9ib3JkZXJfcmFkaXVzLCAnMnB4JyApLFxuXHRcdHBhZGRpbmcgICAgOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX3NwYWNpbmcoIG9wdGlvbnMuYm9va2luZ19mb3JtX3BhZGRpbmcsICcxMHB4IDMwcHgnICksXG5cdFx0c2hhZG93ICAgICA6ICdyZ2JhKDAsIDAsIDAsIDAuMDUpIDBweCAycHggNnB4IDBweCdcblx0fTtcbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19yZXNvbHZlX2Rlc2lnbl9jb2xvcnMob3B0aW9ucykge1xuXHRvcHRpb25zID0gb3B0aW9ucyAmJiB0eXBlb2Ygb3B0aW9ucyA9PT0gJ29iamVjdCcgPyBvcHRpb25zIDoge307XG5cblx0aWYgKCAhIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9faXNfY3VzdG9tX3N0eWxlKCBvcHRpb25zICkgKSB7XG5cdFx0aWYgKFxuXHRcdFx0d3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19pc19kYXJrX3RoZW1lKCBvcHRpb25zICkgJiZcblx0XHRcdCdub25lJyA9PT0gU3RyaW5nKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jb250YWluZXJfc3R5bGUgfHwgJycgKVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dGV4dENvbG9yICAgICAgOiAnIzFkMjMyNycsXG5cdFx0XHRcdGZpZWxkQmFja2dyb3VuZDogJycsXG5cdFx0XHRcdGZpZWxkVGV4dCAgICAgIDogJycsXG5cdFx0XHRcdGZpZWxkQm9yZGVyICAgIDogJydcblx0XHRcdH07XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHR0ZXh0Q29sb3IgICAgICA6ICcnLFxuXHRcdFx0ZmllbGRCYWNrZ3JvdW5kOiAnJyxcblx0XHRcdGZpZWxkVGV4dCAgICAgIDogJycsXG5cdFx0XHRmaWVsZEJvcmRlciAgICA6ICcnXG5cdFx0fTtcblx0fVxuXG5cdHJldHVybiB7XG5cdFx0dGV4dENvbG9yICAgICAgOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX29wdGlvbmFsX2NvbG9yKCBvcHRpb25zLmJvb2tpbmdfZm9ybV90ZXh0X2NvbG9yICksXG5cdFx0ZmllbGRCYWNrZ3JvdW5kOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX29wdGlvbmFsX2NvbG9yKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9maWVsZF9iYWNrZ3JvdW5kX2NvbG9yICksXG5cdFx0ZmllbGRUZXh0ICAgICAgOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX29wdGlvbmFsX2NvbG9yKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9maWVsZF90ZXh0X2NvbG9yICksXG5cdFx0ZmllbGRCb3JkZXIgICAgOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX29wdGlvbmFsX2NvbG9yKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9maWVsZF9ib3JkZXJfY29sb3IgKVxuXHR9O1xufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2FwcGx5X3ZhcnModmFsdWUsIGN0eCkge1xuXHRjb25zdCBvcHRpb25zID0gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19jb2xsZWN0X29wdGlvbnMoIGN0eCwgY3R4ICYmIGN0eC5rZXksIHZhbHVlICk7XG5cdGNvbnN0IHJlc29sdmVkID0gd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19yZXNvbHZlKCBvcHRpb25zICk7XG5cdGNvbnN0IGRlc2lnbiA9IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fcmVzb2x2ZV9kZXNpZ25fY29sb3JzKCBvcHRpb25zICk7XG5cdGNvbnN0IGlzX2N1c3RvbSA9IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9faXNfY3VzdG9tX3N0eWxlKCBvcHRpb25zICk7XG5cdGNvbnN0IHJvb3QgPSBjdHggJiYgY3R4LmNhbnZhcztcblxuXHR3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3N5bmNfZm9ybV9zdHlsZV9jb250cm9sKCBvcHRpb25zICk7XG5cdHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc3luY19jdXN0b21fY29udHJvbHMoIG9wdGlvbnMgKTtcblxuXHRpZiAoICEgcm9vdCB8fCAhIHJvb3QucXVlcnlTZWxlY3RvckFsbCApIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRjb25zdCB3cmFwcyA9IHJvb3QucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fZm9ybV9wcmV2aWV3X3NlY3Rpb25fY29udGFpbmVyLCAud3BiY19iZmJfZm9ybScgKTtcblx0aWYgKCAhIHdyYXBzLmxlbmd0aCApIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHR3cmFwcy5mb3JFYWNoKCBmdW5jdGlvbiAod3JhcCkge1xuXHRcdGlmICggISB3cmFwIHx8ICEgd3JhcC5zdHlsZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0d3JhcC5jbGFzc0xpc3QudG9nZ2xlKCAnd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX2N1c3RvbScsIGlzX2N1c3RvbSApO1xuXHRcdGlmICggISByZXNvbHZlZCApIHtcblx0XHRcdHdyYXAuc3R5bGUucmVtb3ZlUHJvcGVydHkoICctLXdwYmMtYmZiLWZvcm0tYmFja2dyb3VuZCcgKTtcblx0XHRcdHdyYXAuc3R5bGUucmVtb3ZlUHJvcGVydHkoICctLXdwYmMtYmZiLWZvcm0tYm9yZGVyLWNvbG9yJyApO1xuXHRcdFx0d3JhcC5zdHlsZS5yZW1vdmVQcm9wZXJ0eSggJy0td3BiYy1iZmItZm9ybS1ib3JkZXItd2lkdGgnICk7XG5cdFx0XHR3cmFwLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnLS13cGJjLWJmYi1mb3JtLWJvcmRlci1yYWRpdXMnICk7XG5cdFx0XHR3cmFwLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnLS13cGJjLWJmYi1mb3JtLXBhZGRpbmcnICk7XG5cdFx0XHR3cmFwLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnLS13cGJjLWJmYi1mb3JtLWJveC1zaGFkb3cnICk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHdyYXAuc3R5bGUuc2V0UHJvcGVydHkoICctLXdwYmMtYmZiLWZvcm0tYmFja2dyb3VuZCcsIHJlc29sdmVkLmJhY2tncm91bmQgKTtcblx0XHRcdHdyYXAuc3R5bGUuc2V0UHJvcGVydHkoICctLXdwYmMtYmZiLWZvcm0tYm9yZGVyLWNvbG9yJywgcmVzb2x2ZWQuYm9yZGVyQ29sb3IgKTtcblx0XHRcdHdyYXAuc3R5bGUuc2V0UHJvcGVydHkoICctLXdwYmMtYmZiLWZvcm0tYm9yZGVyLXdpZHRoJywgcmVzb2x2ZWQuYm9yZGVyV2lkdGggKTtcblx0XHRcdHdyYXAuc3R5bGUuc2V0UHJvcGVydHkoICctLXdwYmMtYmZiLWZvcm0tYm9yZGVyLXJhZGl1cycsIHJlc29sdmVkLnJhZGl1cyApO1xuXHRcdFx0d3JhcC5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiYy1iZmItZm9ybS1wYWRkaW5nJywgcmVzb2x2ZWQucGFkZGluZyApO1xuXHRcdFx0d3JhcC5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiYy1iZmItZm9ybS1ib3gtc2hhZG93JywgcmVzb2x2ZWQuc2hhZG93ICk7XG5cdFx0fVxuXG5cdFx0aWYgKCBkZXNpZ24udGV4dENvbG9yICkge1xuXHRcdFx0d3JhcC5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiY19mb3JtLWxhYmVsLWNvbG9yJywgZGVzaWduLnRleHRDb2xvciApO1xuXHRcdFx0d3JhcC5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiY19mb3JtLWxhYmVsLXN1YmxhYmVsLWNvbG9yJywgZGVzaWduLnRleHRDb2xvciApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR3cmFwLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnLS13cGJjX2Zvcm0tbGFiZWwtY29sb3InICk7XG5cdFx0XHR3cmFwLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnLS13cGJjX2Zvcm0tbGFiZWwtc3VibGFiZWwtY29sb3InICk7XG5cdFx0fVxuXG5cdFx0aWYgKCBkZXNpZ24uZmllbGRCYWNrZ3JvdW5kICkge1xuXHRcdFx0d3JhcC5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiY19mb3JtLWZpZWxkLWJhY2tncm91bmQtY29sb3InLCBkZXNpZ24uZmllbGRCYWNrZ3JvdW5kICk7XG5cdFx0XHR3cmFwLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjX2Zvcm0tZmllbGQtbWVudS1jb2xvcicsIGRlc2lnbi5maWVsZEJhY2tncm91bmQgKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0d3JhcC5zdHlsZS5yZW1vdmVQcm9wZXJ0eSggJy0td3BiY19mb3JtLWZpZWxkLWJhY2tncm91bmQtY29sb3InICk7XG5cdFx0XHR3cmFwLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnLS13cGJjX2Zvcm0tZmllbGQtbWVudS1jb2xvcicgKTtcblx0XHR9XG5cblx0XHRpZiAoIGRlc2lnbi5maWVsZFRleHQgKSB7XG5cdFx0XHR3cmFwLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjX2Zvcm0tZmllbGQtdGV4dC1jb2xvcicsIGRlc2lnbi5maWVsZFRleHQgKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0d3JhcC5zdHlsZS5yZW1vdmVQcm9wZXJ0eSggJy0td3BiY19mb3JtLWZpZWxkLXRleHQtY29sb3InICk7XG5cdFx0fVxuXG5cdFx0aWYgKCBkZXNpZ24uZmllbGRCb3JkZXIgKSB7XG5cdFx0XHR3cmFwLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjX2Zvcm0tZmllbGQtYm9yZGVyLWNvbG9yJywgZGVzaWduLmZpZWxkQm9yZGVyICk7XG5cdFx0XHR3cmFwLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjX2Zvcm0tZmllbGQtYm9yZGVyLWNvbG9yLXNwYXJlJywgZGVzaWduLmZpZWxkQm9yZGVyICk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHdyYXAuc3R5bGUucmVtb3ZlUHJvcGVydHkoICctLXdwYmNfZm9ybS1maWVsZC1ib3JkZXItY29sb3InICk7XG5cdFx0XHR3cmFwLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnLS13cGJjX2Zvcm0tZmllbGQtYm9yZGVyLWNvbG9yLXNwYXJlJyApO1xuXHRcdH1cblx0fSApO1xufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fZ2V0X3ZhcnMoKSB7XG5cdHJldHVybiB3aW5kb3cud3BiY19iZmJfc2V0dGluZ3NfdmFycyB8fCB7fTtcbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2dldF9wcmVzZXRzKCkge1xuXHRjb25zdCB2YXJzID0gd3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2dldF92YXJzKCk7XG5cdHJldHVybiB2YXJzLmZvcm1fc3R5bGVfcHJlc2V0cyAmJiB0eXBlb2YgdmFycy5mb3JtX3N0eWxlX3ByZXNldHMgPT09ICdvYmplY3QnID8gdmFycy5mb3JtX3N0eWxlX3ByZXNldHMgOiB7fTtcbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2dldF9jdXN0b21fa2V5cygpIHtcblx0cmV0dXJuIFtcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9iYWNrZ3JvdW5kX2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl93aWR0aCcsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX3JhZGl1cycsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fcGFkZGluZ192ZXJ0aWNhbCcsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fcGFkZGluZ19ob3Jpem9udGFsJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV90ZXh0X2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9maWVsZF9iYWNrZ3JvdW5kX2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9maWVsZF90ZXh0X2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9maWVsZF9ib3JkZXJfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9iYWNrZ3JvdW5kX2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fdGV4dF9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JvcmRlcl9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JhY2tncm91bmRfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl90ZXh0X2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfYm9yZGVyX2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2JhY2tncm91bmRfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fdGV4dF9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ib3JkZXJfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfYmFja2dyb3VuZF9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl90ZXh0X2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX2JvcmRlcl9jb2xvcidcblx0XTtcbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2dldF9jdXN0b21fZGVmYXVsdHMoKSB7XG5cdGNvbnN0IHZhcnMgPSB3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fZ2V0X3ZhcnMoKTtcblx0Y29uc3QgbG9jYWxpemVkID0gdmFycy5jdXN0b21fZm9ybV9zdHlsZV9kZWZhdWx0cyAmJiB0eXBlb2YgdmFycy5jdXN0b21fZm9ybV9zdHlsZV9kZWZhdWx0cyA9PT0gJ29iamVjdCdcblx0XHQ/IHZhcnMuY3VzdG9tX2Zvcm1fc3R5bGVfZGVmYXVsdHNcblx0XHQ6IHt9O1xuXG5cdHJldHVybiBPYmplY3QuYXNzaWduKCB7XG5cdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9iYWNrZ3JvdW5kX2NvbG9yICAgICAgIDogJyNmZmZmZmYnLFxuXHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX2NvbG9yICAgICAgICAgICA6ICcjY2NjY2NjJyxcblx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl93aWR0aCAgICAgICAgICAgOiAnMXB4Jyxcblx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl9yYWRpdXMgICAgICAgICAgOiAnMnB4Jyxcblx0XHRib29raW5nX2Zvcm1fY3VzdG9tX3BhZGRpbmdfdmVydGljYWwgICAgICAgOiAnMTBweCcsXG5cdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9wYWRkaW5nX2hvcml6b250YWwgICAgIDogJzMwcHgnLFxuXHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fdGV4dF9jb2xvciAgICAgICAgICAgICA6ICcjMWQyMzI3Jyxcblx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JhY2tncm91bmRfY29sb3IgOiAnI2ZmZmZmZicsXG5cdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9maWVsZF90ZXh0X2NvbG9yICAgICAgIDogJyMzYzQzNGEnLFxuXHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYm9yZGVyX2NvbG9yICAgICA6ICcjY2NjY2NjJyxcblx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9iYWNrZ3JvdW5kX2NvbG9yOiAnIzA2NmFhYicsXG5cdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fdGV4dF9jb2xvciAgICAgIDogJyNmZmZmZmYnLFxuXHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JvcmRlcl9jb2xvciAgICA6ICcjMDY2YWFiJyxcblx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl9iYWNrZ3JvdW5kX2NvbG9yOiAnIzA1NTU4OScsXG5cdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfdGV4dF9jb2xvcjogJyNmZmZmZmYnLFxuXHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JvcmRlcl9jb2xvcjogJyMwNTU1ODknLFxuXHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9iYWNrZ3JvdW5kX2NvbG9yOiAnI2ZkZmRmZCcsXG5cdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX3RleHRfY29sb3I6ICcjNDQ0NDQ0Jyxcblx0XHRib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fYm9yZGVyX2NvbG9yOiAnI2VlZWVlZScsXG5cdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX2JhY2tncm91bmRfY29sb3I6ICcjZmRmZGZkJyxcblx0XHRib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfdGV4dF9jb2xvcjogJyM0NDQ0NDQnLFxuXHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl9ib3JkZXJfY29sb3I6ICcjNGQ5MWNkJ1xuXHR9LCBsb2NhbGl6ZWQgKTtcbn1cblxuZnVuY3Rpb24gd3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2dldF9jdXJyZW50X29wdGlvbnMoY3R4LCBrZXksIHZhbHVlKSB7XG5cdGNvbnN0IHZhcnMgPSB3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fZ2V0X3ZhcnMoKTtcblx0bGV0IG9wdGlvbnMgPSB2YXJzLmdsb2JhbF9mb3JtX3N0eWxlICYmIHR5cGVvZiB2YXJzLmdsb2JhbF9mb3JtX3N0eWxlID09PSAnb2JqZWN0J1xuXHRcdD8gT2JqZWN0LmFzc2lnbigge30sIHZhcnMuZ2xvYmFsX2Zvcm1fc3R5bGUgKVxuXHRcdDoge307XG5cblx0aWYgKCB3aW5kb3cuV1BCQ19CRkJfRm9ybVNldHRpbmdzICYmIHR5cGVvZiB3aW5kb3cuV1BCQ19CRkJfRm9ybVNldHRpbmdzLmNvbGxlY3QgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0b3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oIG9wdGlvbnMsIHdpbmRvdy5XUEJDX0JGQl9Gb3JtU2V0dGluZ3MuY29sbGVjdCggJ2dsb2JhbCcgKSB8fCB7fSApO1xuXHR9XG5cblx0aWYgKCBjdHggJiYgY3R4Lm9wdGlvbnMgJiYgdHlwZW9mIGN0eC5vcHRpb25zID09PSAnb2JqZWN0JyApIHtcblx0XHRvcHRpb25zID0gT2JqZWN0LmFzc2lnbiggb3B0aW9ucywgY3R4Lm9wdGlvbnMgKTtcblx0fVxuXHRpZiAoIGtleSApIHtcblx0XHRvcHRpb25zW1N0cmluZygga2V5ICldID0gdmFsdWU7XG5cdH1cblx0aWYgKCAhIG9wdGlvbnMuYm9va2luZ19mb3JtX3N0eWxlICkge1xuXHRcdG9wdGlvbnMuYm9va2luZ19mb3JtX3N0eWxlID0gJ2xpZ2h0X2JvcmRlcmVkJztcblx0fVxuXG5cdHJldHVybiBvcHRpb25zO1xufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fcmVzb2x2ZV9jc3NfdmFycyhvcHRpb25zKSB7XG5cdG9wdGlvbnMgPSBvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zID09PSAnb2JqZWN0JyA/IG9wdGlvbnMgOiB7fTtcblx0Y29uc3Qgc3R5bGUgPSBTdHJpbmcoIG9wdGlvbnMuYm9va2luZ19mb3JtX3N0eWxlIHx8ICdsaWdodF9ib3JkZXJlZCcgKTtcblx0Y29uc3QgcHJlc2V0cyA9IHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19nZXRfcHJlc2V0cygpO1xuXHRjb25zdCBwcmVzZXQgPSBwcmVzZXRzW3N0eWxlXSB8fCBwcmVzZXRzLmxpZ2h0X2JvcmRlcmVkIHx8IHt9O1xuXHRjb25zdCBkZWZhdWx0cyA9IHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19nZXRfY3VzdG9tX2RlZmF1bHRzKCk7XG5cblx0aWYgKCAnY3VzdG9tJyAhPT0gc3R5bGUgKSB7XG5cdFx0cmV0dXJuIHByZXNldC5jc3NfdmFycyAmJiB0eXBlb2YgcHJlc2V0LmNzc192YXJzID09PSAnb2JqZWN0JyA/IE9iamVjdC5hc3NpZ24oIHt9LCBwcmVzZXQuY3NzX3ZhcnMgKSA6IHt9O1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHQnLS13cGJjLWJmYi1mb3JtLWJhY2tncm91bmQnICAgICAgICAgIDogd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9jb2xvciggb3B0aW9ucy5ib29raW5nX2Zvcm1fY3VzdG9tX2JhY2tncm91bmRfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fYmFja2dyb3VuZF9jb2xvciApLFxuXHRcdCctLXdwYmMtYmZiLWZvcm0tYm9yZGVyLWNvbG9yJyAgICAgICAgOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2NvbG9yKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl9jb2xvciApLFxuXHRcdCctLXdwYmMtYmZiLWZvcm0tYm9yZGVyLXdpZHRoJyAgICAgICAgOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2xlbmd0aCggb3B0aW9ucy5ib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl93aWR0aCwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfd2lkdGggKSxcblx0XHQnLS13cGJjLWJmYi1mb3JtLWJvcmRlci1yYWRpdXMnICAgICAgIDogd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9sZW5ndGgoIG9wdGlvbnMuYm9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfcmFkaXVzLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl9yYWRpdXMgKSxcblx0XHQnLS13cGJjLWJmYi1mb3JtLXBhZGRpbmcnICAgICAgICAgICAgIDogd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9sZW5ndGgoIG9wdGlvbnMuYm9va2luZ19mb3JtX2N1c3RvbV9wYWRkaW5nX3ZlcnRpY2FsLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX3BhZGRpbmdfdmVydGljYWwgKSArICcgJyArIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfbGVuZ3RoKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jdXN0b21fcGFkZGluZ19ob3Jpem9udGFsLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX3BhZGRpbmdfaG9yaXpvbnRhbCApLFxuXHRcdCctLXdwYmMtYmZiLWZvcm0tYm94LXNoYWRvdycgICAgICAgICAgOiAncmdiYSgwLCAwLCAwLCAwLjA1KSAwcHggMnB4IDZweCAwcHgnLFxuXHRcdCctLXdwYmNfZm9ybS1sYWJlbC1jb2xvcicgICAgICAgICAgICAgOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2NvbG9yKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jdXN0b21fdGV4dF9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV90ZXh0X2NvbG9yICksXG5cdFx0Jy0td3BiY19mb3JtLWxhYmVsLXN1YmxhYmVsLWNvbG9yJyAgICA6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX2N1c3RvbV90ZXh0X2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX3RleHRfY29sb3IgKSxcblx0XHQnLS13cGJjX2Zvcm0tbGFiZWwtZXJyb3ItY29sb3InICAgICAgIDogJyNkNjM2MzcnLFxuXHRcdCctLXdwYmNfZm9ybS1maWVsZC1iYWNrZ3JvdW5kLWNvbG9yJyAgOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2NvbG9yKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYmFja2dyb3VuZF9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9maWVsZF9iYWNrZ3JvdW5kX2NvbG9yICksXG5cdFx0Jy0td3BiY19mb3JtLWZpZWxkLW1lbnUtY29sb3InICAgICAgICA6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX2N1c3RvbV9maWVsZF9iYWNrZ3JvdW5kX2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JhY2tncm91bmRfY29sb3IgKSxcblx0XHQnLS13cGJjX2Zvcm0tZmllbGQtdGV4dC1jb2xvcicgICAgICAgIDogd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9jb2xvciggb3B0aW9ucy5ib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX3RleHRfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfdGV4dF9jb2xvciApLFxuXHRcdCctLXdwYmNfZm9ybS1maWVsZC1ib3JkZXItY29sb3InICAgICAgOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2NvbG9yKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYm9yZGVyX2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JvcmRlcl9jb2xvciApLFxuXHRcdCctLXdwYmNfZm9ybS1maWVsZC1ib3JkZXItY29sb3Itc3BhcmUnOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2NvbG9yKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYm9yZGVyX2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JvcmRlcl9jb2xvciApLFxuXHRcdCctLXdwYmNfZm9ybS1maWVsZC1mb2N1cy1ib3JkZXItY29sb3InOiAnIzA2NmFhYicsXG5cdFx0Jy0td3BiY19mb3JtLWZpZWxkLWZvY3VzLXNoYWRvdy1jb2xvcic6ICcjMDY2YWFiJyxcblx0XHQnLS13cGJjX2Zvcm0tZmllbGQtZGlzYWJsZWQtY29sb3InICAgIDogJ3JnYmEoMCwgMCwgMCwgMC4yKScsXG5cdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1iYWNrZ3JvdW5kLWNvbG9yJyA6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYmFja2dyb3VuZF9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYmFja2dyb3VuZF9jb2xvciApLFxuXHRcdCctLXdwYmNfZm9ybS1idXR0b24tYmFja2dyb3VuZC1jb2xvci1hbHQnOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2NvbG9yKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JhY2tncm91bmRfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JhY2tncm91bmRfY29sb3IgKSxcblx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWJvcmRlci1jb2xvcicgICAgIDogd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9jb2xvciggb3B0aW9ucy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ib3JkZXJfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JvcmRlcl9jb2xvciApLFxuXHRcdCctLXdwYmNfZm9ybS1idXR0b24tdGV4dC1jb2xvcicgICAgICAgOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2NvbG9yKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX3RleHRfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX3RleHRfY29sb3IgKSxcblx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLXRleHQtY29sb3ItYWx0JyAgIDogd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9jb2xvciggb3B0aW9ucy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl90ZXh0X2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl90ZXh0X2NvbG9yICksXG5cdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1ob3Zlci1iYWNrZ3JvdW5kLWNvbG9yJzogd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9jb2xvciggb3B0aW9ucy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl9iYWNrZ3JvdW5kX2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl9iYWNrZ3JvdW5kX2NvbG9yICksXG5cdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1ob3Zlci1ib3JkZXItY29sb3InOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2NvbG9yKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JvcmRlcl9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfYm9yZGVyX2NvbG9yICksXG5cdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1ob3Zlci10ZXh0LWNvbG9yJyA6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfdGV4dF9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfdGV4dF9jb2xvciApLFxuXHRcdCctLXdwYmNfZm9ybS1jaG9pY2UtY2hlY2tlZC1ib3JkZXItY29sb3InOiAnIzA2NmFhYicsXG5cdFx0Jy0td3BiY19mb3JtLWNob2ljZS1jaGVja2VkLWNvbG9yJyAgICA6ICcjMDY2YWFiJyxcblx0XHQnLS13cGJjX2Zvcm0tY2hvaWNlLWZvY3VzLWNvbG9yJyAgICAgIDogJyMwNjZhYWInLFxuXHRcdCctLXdwYmNfZm9ybS1idXR0b24tbGlnaHQtYmFja2dyb3VuZC1jb2xvcic6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2JhY2tncm91bmRfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9iYWNrZ3JvdW5kX2NvbG9yICksXG5cdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1saWdodC1ib3JkZXItY29sb3InOiB3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3Nhbml0aXplX2NvbG9yKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ib3JkZXJfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ib3JkZXJfY29sb3IgKSxcblx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWxpZ2h0LXRleHQtY29sb3InIDogd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9jb2xvciggb3B0aW9ucy5ib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fdGV4dF9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX3RleHRfY29sb3IgKSxcblx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWxpZ2h0LWJveC1zaGFkb3cnIDogJzAgMnB4IDEwcHggMnB4ICNmZmZmZmY1NCcsXG5cdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1saWdodC1ob3Zlci1iYWNrZ3JvdW5kLWNvbG9yJzogd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zYW5pdGl6ZV9jb2xvciggb3B0aW9ucy5ib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfYmFja2dyb3VuZF9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX2JhY2tncm91bmRfY29sb3IgKSxcblx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWxpZ2h0LWhvdmVyLWJvcmRlci1jb2xvcic6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX2JvcmRlcl9jb2xvciwgZGVmYXVsdHMuYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX2JvcmRlcl9jb2xvciApLFxuXHRcdCctLXdwYmNfZm9ybS1idXR0b24tbGlnaHQtaG92ZXItdGV4dC1jb2xvcic6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX3RleHRfY29sb3IsIGRlZmF1bHRzLmJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl90ZXh0X2NvbG9yICksXG5cdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1saWdodC1ob3Zlci1ib3gtc2hhZG93JzogJzAgMnB4IDEwcHggMnB4ICNmZmZmZmY1NCcsXG5cdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1wcmltYXJ5LWhvdmVyLWJvcmRlci1jb2xvcic6IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2FuaXRpemVfY29sb3IoIG9wdGlvbnMuYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfYm9yZGVyX2NvbG9yLCBkZWZhdWx0cy5ib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl9ib3JkZXJfY29sb3IgKSxcblx0XHQnLS13cGJjX2Zvcm0tcGFnZS1icmVhay1jb2xvcicgICAgICAgIDogJyMwNjZhYWInXG5cdH07XG59XG5cbmZ1bmN0aW9uIHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19nZXRfY3NzX3Zhcl9rZXlzKG9wdGlvbnMpIHtcblx0Y29uc3QgdmFycyA9IHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19nZXRfdmFycygpO1xuXHRjb25zdCBsb2NhbGl6ZWQgPSBBcnJheS5pc0FycmF5KCB2YXJzLmZvcm1fc3R5bGVfY3NzX3Zhcl9uYW1lcyApID8gdmFycy5mb3JtX3N0eWxlX2Nzc192YXJfbmFtZXMgOiBbXTtcblx0Y29uc3Qga2V5cyA9IFtdO1xuXHRjb25zdCBwcmVzZXRzID0gd3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2dldF9wcmVzZXRzKCk7XG5cblx0aWYgKCBsb2NhbGl6ZWQubGVuZ3RoICkge1xuXHRcdHJldHVybiBsb2NhbGl6ZWQ7XG5cdH1cblxuXHRPYmplY3Qua2V5cyggcHJlc2V0cyApLmZvckVhY2goIGZ1bmN0aW9uIChwcmVzZXRfa2V5KSB7XG5cdFx0Y29uc3QgcHJlc2V0ID0gcHJlc2V0c1twcmVzZXRfa2V5XSB8fCB7fTtcblx0XHRjb25zdCBjc3NfdmFycyA9IHByZXNldC5jc3NfdmFycyAmJiB0eXBlb2YgcHJlc2V0LmNzc192YXJzID09PSAnb2JqZWN0JyA/IHByZXNldC5jc3NfdmFycyA6IHt9O1xuXG5cdFx0T2JqZWN0LmtleXMoIGNzc192YXJzICkuZm9yRWFjaCggZnVuY3Rpb24gKHZhcl9uYW1lKSB7XG5cdFx0XHRpZiAoIGtleXMuaW5kZXhPZiggdmFyX25hbWUgKSA9PT0gLTEgKSB7XG5cdFx0XHRcdGtleXMucHVzaCggdmFyX25hbWUgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdH0gKTtcblxuXHRPYmplY3Qua2V5cyggd3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX3Jlc29sdmVfY3NzX3ZhcnMoIE9iamVjdC5hc3NpZ24oIHt9LCBvcHRpb25zIHx8IHt9LCB7IGJvb2tpbmdfZm9ybV9zdHlsZTogJ2N1c3RvbScgfSApICkgKS5mb3JFYWNoKCBmdW5jdGlvbiAodmFyX25hbWUpIHtcblx0XHRpZiAoIGtleXMuaW5kZXhPZiggdmFyX25hbWUgKSA9PT0gLTEgKSB7XG5cdFx0XHRrZXlzLnB1c2goIHZhcl9uYW1lICk7XG5cdFx0fVxuXHR9ICk7XG5cblx0cmV0dXJuIGtleXM7XG59XG5cbmZ1bmN0aW9uIHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19zeW5jX2NvbnRyb2xzKG9wdGlvbnMpIHtcblx0Y29uc3QgaXNfY3VzdG9tID0gJ2N1c3RvbScgPT09IFN0cmluZyggb3B0aW9ucyAmJiBvcHRpb25zLmJvb2tpbmdfZm9ybV9zdHlsZSA/IG9wdGlvbnMuYm9va2luZ19mb3JtX3N0eWxlIDogJycgKTtcblx0Y29uc3QgcmVzZXRfcm93ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYmZiLWN1c3RvbS1hcHBlYXJhbmNlLXJlc2V0LXJvd10nICk7XG5cblx0d3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zZXRfcmFkaW9fY29udHJvbCggJ2Jvb2tpbmdfZm9ybV9zdHlsZScsIG9wdGlvbnMuYm9va2luZ19mb3JtX3N0eWxlIHx8ICdsaWdodF9ib3JkZXJlZCcgKTtcblxuXHRkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19mb3JtX3NldHRpbmdfZ2xvYmFsX2N1c3RvbV9zdHlsZScgKS5mb3JFYWNoKCBmdW5jdGlvbiAocm93KSB7XG5cdFx0cm93LmhpZGRlbiA9ICEgaXNfY3VzdG9tO1xuXHRcdHJvdy5zZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicsIGlzX2N1c3RvbSA/ICdmYWxzZScgOiAndHJ1ZScgKTtcblx0XHRyb3cuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWhpZGRlbicsICEgaXNfY3VzdG9tICk7XG5cdH0gKTtcblxuXHRpZiAoIHJlc2V0X3JvdyApIHtcblx0XHRyZXNldF9yb3cuaGlkZGVuID0gISBpc19jdXN0b207XG5cdFx0cmVzZXRfcm93LnNldEF0dHJpYnV0ZSggJ2FyaWEtaGlkZGVuJywgaXNfY3VzdG9tID8gJ2ZhbHNlJyA6ICd0cnVlJyApO1xuXHRcdHJlc2V0X3Jvdy5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtaGlkZGVuJywgISBpc19jdXN0b20gKTtcblx0fVxufVxuXG5mdW5jdGlvbiB3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fYXBwbHkodmFsdWUsIGN0eCkge1xuXHRjb25zdCBvcHRpb25zID0gd3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX2dldF9jdXJyZW50X29wdGlvbnMoIGN0eCwgY3R4ICYmIGN0eC5rZXksIHZhbHVlICk7XG5cdGNvbnN0IHN0eWxlID0gU3RyaW5nKCBvcHRpb25zLmJvb2tpbmdfZm9ybV9zdHlsZSB8fCAnbGlnaHRfYm9yZGVyZWQnICk7XG5cdGNvbnN0IHByZXNldHMgPSB3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fZ2V0X3ByZXNldHMoKTtcblx0Y29uc3QgcHJlc2V0ID0gcHJlc2V0c1tzdHlsZV0gfHwgcHJlc2V0cy5saWdodF9ib3JkZXJlZCB8fCB7fTtcblx0Y29uc3QgY3NzX3ZhcnMgPSB3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fcmVzb2x2ZV9jc3NfdmFycyggb3B0aW9ucyApO1xuXHRjb25zdCByb290ID0gKCBjdHggJiYgY3R4LmNhbnZhcyApIHx8IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX3RoZW1lX3Njb3BlJyApIHx8IGRvY3VtZW50O1xuXHRjb25zdCB0aGVtZV9jbGFzc2VzID0gW107XG5cdGNvbnN0IGNzc192YXJfa2V5cyA9IHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19nZXRfY3NzX3Zhcl9rZXlzKCBvcHRpb25zICk7XG5cblx0d3BiY19iZmJfZ2xvYmFsX2Zvcm1fc3R5bGVfX3N5bmNfY29udHJvbHMoIG9wdGlvbnMgKTtcblxuXHRPYmplY3Qua2V5cyggcHJlc2V0cyApLmZvckVhY2goIGZ1bmN0aW9uIChwcmVzZXRfa2V5KSB7XG5cdFx0Y29uc3QgY2xhc3NfbmFtZSA9IHByZXNldHNbcHJlc2V0X2tleV0gJiYgcHJlc2V0c1twcmVzZXRfa2V5XS50aGVtZV9jbGFzcyA/IFN0cmluZyggcHJlc2V0c1twcmVzZXRfa2V5XS50aGVtZV9jbGFzcyApIDogJyc7XG5cdFx0aWYgKCBjbGFzc19uYW1lICYmIHRoZW1lX2NsYXNzZXMuaW5kZXhPZiggY2xhc3NfbmFtZSApID09PSAtMSApIHtcblx0XHRcdHRoZW1lX2NsYXNzZXMucHVzaCggY2xhc3NfbmFtZSApO1xuXHRcdH1cblx0fSApO1xuXG5cdGlmICggISByb290IHx8ICEgcm9vdC5xdWVyeVNlbGVjdG9yQWxsICkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IHNlbGVjdG9yID0gJy53cGJjX2NvbnRhaW5lci53cGJjX2Zvcm0sIC53cGJjX2JmYl9mb3JtLCAud3BiY19iZmJfX3BhZ2VzX3BhbmVsLCAud3BiY19iZmJfX2Zvcm1fcHJldmlld19zZWN0aW9uX2NvbnRhaW5lcic7XG5cdGNvbnN0IHdyYXBzID0gW107XG5cdGlmICggcm9vdC5tYXRjaGVzICYmIHJvb3QubWF0Y2hlcyggc2VsZWN0b3IgKSApIHtcblx0XHR3cmFwcy5wdXNoKCByb290ICk7XG5cdH1cblx0cm9vdC5xdWVyeVNlbGVjdG9yQWxsKCBzZWxlY3RvciApLmZvckVhY2goIGZ1bmN0aW9uICh3cmFwKSB7XG5cdFx0d3JhcHMucHVzaCggd3JhcCApO1xuXHR9ICk7XG5cblx0d3JhcHMuZm9yRWFjaCggZnVuY3Rpb24gKHdyYXApIHtcblx0XHRpZiAoICEgd3JhcCB8fCAhIHdyYXAuc3R5bGUgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoZW1lX2NsYXNzZXMuZm9yRWFjaCggZnVuY3Rpb24gKGNsYXNzX25hbWUpIHtcblx0XHRcdHdyYXAuY2xhc3NMaXN0LnJlbW92ZSggY2xhc3NfbmFtZSApO1xuXHRcdH0gKTtcblx0XHRpZiAoIHByZXNldC50aGVtZV9jbGFzcyApIHtcblx0XHRcdHdyYXAuY2xhc3NMaXN0LmFkZCggU3RyaW5nKCBwcmVzZXQudGhlbWVfY2xhc3MgKSApO1xuXHRcdH1cblx0XHR3cmFwLmNsYXNzTGlzdC50b2dnbGUoICd3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfY3VzdG9tJywgJ2N1c3RvbScgPT09IHN0eWxlICk7XG5cblx0XHRjc3NfdmFyX2tleXMuZm9yRWFjaCggZnVuY3Rpb24gKGNzc19rZXkpIHtcblx0XHRcdHdyYXAuc3R5bGUucmVtb3ZlUHJvcGVydHkoIGNzc19rZXkgKTtcblx0XHR9ICk7XG5cdFx0T2JqZWN0LmtleXMoIGNzc192YXJzICkuZm9yRWFjaCggZnVuY3Rpb24gKGNzc19rZXkpIHtcblx0XHRcdHdyYXAuc3R5bGUuc2V0UHJvcGVydHkoIGNzc19rZXksIGNzc192YXJzW2Nzc19rZXldICk7XG5cdFx0fSApO1xuXHR9ICk7XG59XG5cbltcblx0J2Jvb2tpbmdfZm9ybV9zdHlsZScsXG5cdCdib29raW5nX2Zvcm1fY3VzdG9tX2JhY2tncm91bmRfY29sb3InLFxuXHQnYm9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfY29sb3InLFxuXHQnYm9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfd2lkdGgnLFxuXHQnYm9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfcmFkaXVzJyxcblx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fcGFkZGluZ192ZXJ0aWNhbCcsXG5cdCdib29raW5nX2Zvcm1fY3VzdG9tX3BhZGRpbmdfaG9yaXpvbnRhbCcsXG5cdCdib29raW5nX2Zvcm1fY3VzdG9tX3RleHRfY29sb3InLFxuXHQnYm9va2luZ19mb3JtX2N1c3RvbV9maWVsZF9iYWNrZ3JvdW5kX2NvbG9yJyxcblx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfdGV4dF9jb2xvcicsXG5cdCdib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JvcmRlcl9jb2xvcicsXG5cdCdib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9iYWNrZ3JvdW5kX2NvbG9yJyxcblx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX3RleHRfY29sb3InLFxuXHQnYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYm9yZGVyX2NvbG9yJyxcblx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JhY2tncm91bmRfY29sb3InLFxuXHQnYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfdGV4dF9jb2xvcicsXG5cdCdib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl9ib3JkZXJfY29sb3InLFxuXHQnYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2JhY2tncm91bmRfY29sb3InLFxuXHQnYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX3RleHRfY29sb3InLFxuXHQnYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2JvcmRlcl9jb2xvcicsXG5cdCdib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfYmFja2dyb3VuZF9jb2xvcicsXG5cdCdib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfdGV4dF9jb2xvcicsXG5cdCdib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfYm9yZGVyX2NvbG9yJ1xuXS5mb3JFYWNoKCBmdW5jdGlvbiAoa2V5KSB7XG5cdFdQQkNfQkZCX1NldHRpbmdzX0VmZmVjdHMucmVnaXN0ZXIoIGtleSwgZnVuY3Rpb24gKHZhbHVlLCBjdHgpIHtcblx0XHR3cGJjX2JmYl9nbG9iYWxfZm9ybV9zdHlsZV9fYXBwbHkoIHZhbHVlLCBPYmplY3QuYXNzaWduKCB7fSwgY3R4IHx8IHt9LCB7IGtleToga2V5IH0gKSApO1xuXHR9ICk7XG59ICk7XG5cbmZ1bmN0aW9uIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc3luY19jdXN0b21fY29udHJvbHNfZnJvbV91aSgpIHtcblx0Y29uc3Qgb3B0aW9ucyA9IHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19nZXRfY3VycmVudF9vcHRpb25zKCk7XG5cdHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19zeW5jX2NvbnRyb2xzKCBvcHRpb25zICk7XG5cdHdwYmNfYmZiX2dsb2JhbF9mb3JtX3N0eWxlX19hcHBseSggbnVsbCwgeyBzb3VyY2U6ICdzeW5jLWdsb2JhbC1zdHlsZScgfSApO1xufVxuXG53cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX3N5bmNfY3VzdG9tX2NvbnRyb2xzX2Zyb21fdWkoKTtcbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdET01Db250ZW50TG9hZGVkJywgd3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zeW5jX2N1c3RvbV9jb250cm9sc19mcm9tX3VpICk7XG5cblxuLy8gQk9PS0lOR19GT1JNX1RIRU1FLlxuV1BCQ19CRkJfU2V0dGluZ3NfRWZmZWN0cy5yZWdpc3RlciggJ2Jvb2tpbmdfZm9ybV90aGVtZScsIGZ1bmN0aW9uICh2YWx1ZSwgY3R4KSB7XG5cdGNvbnN0IHJvb3QgPSAoY3R4ICYmIGN0eC5jYW52YXMpIHx8IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX3RoZW1lX3Njb3BlJyApIHx8IGRvY3VtZW50O1xuXHRpZiAoICEgcm9vdCB8fCAhIHJvb3QucXVlcnlTZWxlY3RvckFsbCApIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRpZiAoIHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9faXNfdXNlcl90aGVtZV9zd2l0Y2goIGN0eCApICkge1xuXHRcdGNvbnN0IGN1cnJlbnRfb3B0aW9ucyA9IHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fZ2V0X2N1cnJlbnRfb3B0aW9ucygpO1xuXHRcdGlmICggJ2N1c3RvbScgPT09IFN0cmluZyggY3VycmVudF9vcHRpb25zLmJvb2tpbmdfZm9ybV9jb250YWluZXJfc3R5bGUgfHwgJycgKSApIHtcblx0XHRcdGN1cnJlbnRfb3B0aW9ucy5ib29raW5nX2Zvcm1fdGhlbWUgPSB2YWx1ZTtcblx0XHRcdHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc3luY19mb3JtX3N0eWxlX2NvbnRyb2woIGN1cnJlbnRfb3B0aW9ucyApO1xuXHRcdFx0d3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19hcHBseV92YXJzKCAnY3VzdG9tJywgT2JqZWN0LmFzc2lnbigge30sIGN0eCB8fCB7fSwge1xuXHRcdFx0XHRrZXkgICAgOiAnYm9va2luZ19mb3JtX2NvbnRhaW5lcl9zdHlsZScsXG5cdFx0XHRcdHNvdXJjZSA6ICd0aGVtZS1iYXNlLWN1c3RvbScsXG5cdFx0XHRcdG9wdGlvbnM6IGN1cnJlbnRfb3B0aW9uc1xuXHRcdFx0fSApICk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHdwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9fc2V0X2NvbnRhaW5lcl9zdHlsZV9jb250cm9sKCAnYm9yZGVyZWQnICk7XG5cdFx0XHR3cGJjX2JmYl9mb3JtX2FwcGVhcmFuY2VfX2FwcGx5X3ZhcnMoICdib3JkZXJlZCcsIE9iamVjdC5hc3NpZ24oIHt9LCBjdHggfHwge30sIHsga2V5OiAnYm9va2luZ19mb3JtX2NvbnRhaW5lcl9zdHlsZScgfSApICk7XG5cdFx0fVxuXHR9IGVsc2UgaWYgKCBjdHggJiYgY3R4Lm9wdGlvbnMgKSB7XG5cdFx0d3BiY19iZmJfZm9ybV9hcHBlYXJhbmNlX19zeW5jX2Zvcm1fc3R5bGVfY29udHJvbCggY3R4Lm9wdGlvbnMgKTtcblx0fVxuXG5cdGNvbnN0IHRoZW1lX3NlbGVjdG9yID0gJy53cGJjX2NvbnRhaW5lci53cGJjX2Zvcm0sIC53cGJjX2JmYl9mb3JtLCAud3BiY19iZmJfX3BhZ2VzX3BhbmVsJztcblx0Y29uc3Qgd3JhcHMgPSBbXTtcblx0aWYgKCByb290Lm1hdGNoZXMgJiYgcm9vdC5tYXRjaGVzKCB0aGVtZV9zZWxlY3RvciApICkge1xuXHRcdHdyYXBzLnB1c2goIHJvb3QgKTtcblx0fVxuXHRyb290LnF1ZXJ5U2VsZWN0b3JBbGwoIHRoZW1lX3NlbGVjdG9yICkuZm9yRWFjaCggZnVuY3Rpb24gKHdyYXApIHtcblx0XHR3cmFwcy5wdXNoKCB3cmFwICk7XG5cdH0gKTtcblx0aWYgKCAhIHdyYXBzLmxlbmd0aCApIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHR3cmFwcy5mb3JFYWNoKCBmdW5jdGlvbiAod3JhcCkge1xuXHRcdC8vIHJlbW92ZSBhbnkgcHJldmlvdXMgdGhlbWUgY2xhc3NlcyAoc2ltcGxlICsgZnV0dXJlLXByb29mKS5cblx0XHRBcnJheS5mcm9tKCB3cmFwLmNsYXNzTGlzdCApLmZvckVhY2goIGZ1bmN0aW9uIChjbHMpIHtcblx0XHRcdGlmICggL153cGJjX3RoZW1lXy8udGVzdCggY2xzICkgKSB7XG5cdFx0XHRcdHdyYXAuY2xhc3NMaXN0LnJlbW92ZSggY2xzICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0aWYgKCB2YWx1ZSApIHtcblx0XHRcdHdyYXAuY2xhc3NMaXN0LmFkZCggU3RyaW5nKCB2YWx1ZSApICk7XG5cdFx0fVxuXHR9ICk7XG59ICk7XG5cblxuLy8gQk9PS0lOR19GT1JNX0xBWU9VVF9XSURUSCDigJQgRm9ybSB3aWR0aDogYXBwbGllcyBjb21iaW5lZCBcIjEwMCVcIiAvIFwiNjAwcHhcIiAvIFwiNDByZW1cIiB0byB0aGUgYm9va2luZyBmb3JtIGNvbnRhaW5lcnMuXG5XUEJDX0JGQl9TZXR0aW5nc19FZmZlY3RzLnJlZ2lzdGVyKCAnYm9va2luZ19mb3JtX2xheW91dF93aWR0aCcsIGZ1bmN0aW9uICh2YWx1ZSwgY3R4KSB7XG5cdGNvbnN0IHJvb3QgPSBjdHggJiYgY3R4LmNhbnZhcztcblx0aWYgKCAhIHJvb3QgfHwgISByb290LnF1ZXJ5U2VsZWN0b3JBbGwgKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3Qgd3JhcHMgPSByb290LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2Zvcm1fcHJldmlld19zZWN0aW9uX2NvbnRhaW5lcicgKTtcblx0aWYgKCAhIHdyYXBzLmxlbmd0aCApIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRjb25zdCB2ID0gU3RyaW5nKCB2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSApLnRyaW0oKTtcblxuXHQvLyBhbGxvdyBvbmx5IFwibnVtYmVyICsgdW5pdFwiLlxuXHRpZiAoIHYgJiYgISAvXi0/XFxkKyg/OlxcLlxcZCspPyg/OiV8cHh8cmVtfGVtfHZ3fHZoKSQvLnRlc3QoIHYgKSApIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHR3cmFwcy5mb3JFYWNoKFxuXHRcdGZ1bmN0aW9uICh3cmFwKSB7XG5cdFx0XHRpZiAoICEgd3JhcCB8fCAhIHdyYXAuc3R5bGUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCAhIHYgKSB7XG5cdFx0XHRcdHdyYXAuc3R5bGUucmVtb3ZlUHJvcGVydHkoICctLXdwYmMtYmZiLWJvb2tpbmdfZm9ybV9sYXlvdXRfd2lkdGgnICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR3cmFwLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjLWJmYi1ib29raW5nX2Zvcm1fbGF5b3V0X3dpZHRoJywgdiApO1xuXHRcdFx0fVxuXHRcdH1cblx0KTtcbn0gKTtcblxuXG4vLyBEZWJ1ZyBQcmV2aWV3IE1vZGUuXG5XUEJDX0JGQl9TZXR0aW5nc19FZmZlY3RzLnJlZ2lzdGVyKCAnYm9va2luZ19iZmJfcHJldmlld19tb2RlJywgZnVuY3Rpb24gKHZhbHVlLCBjdHgpIHtcblx0Y29uc3Qgcm9vdCA9IGN0eC5jYW52YXM7XG5cdGlmICggISByb290IHx8ICEgcm9vdC5xdWVyeVNlbGVjdG9yQWxsICkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IHdyYXBzID0gcm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfY29udGFpbmVyLndwYmNfZm9ybScgKTtcblx0aWYgKCAhIHdyYXBzLmxlbmd0aCApIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHQvLyBHZXQgYnVpbGRlciBhc3luYy5cblx0d3BiY19iZmJfYXBpLndpdGhfYnVpbGRlcihcblx0XHRmdW5jdGlvbiAoQnVpbGRlcikge1xuXG5cdFx0XHQvKipcblx0XHRcdCAqIENhcHR1cmUgYWN0aXZlIHJpZ2h0IHNpZGViYXIgdGFiIGFuZCByZXR1cm4gcmVzdG9yZSBoYW5kbGUuXG5cdFx0XHQgKlxuXHRcdFx0ICogQHJldHVybiB7e3Jlc3RvcmU6ZnVuY3Rpb24oKTp2b2lkfXxudWxsfVxuXHRcdFx0ICovXG5cdFx0XHRmdW5jdGlvbiBjYXB0dXJlX3JpZ2h0X3NpZGViYXJfYWN0aXZlX3RhYl9yZXN0b3JlX2hhbmRsZSgpIHtcblxuXHRcdFx0XHR2YXIgdGFibGlzdF9lbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX3JpZ2h0YmFyX3RhYnNbcm9sZT1cInRhYmxpc3RcIl0nICk7XG5cdFx0XHRcdGlmICggISB0YWJsaXN0X2VsICkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dmFyIGFjdGl2ZV90YWJfZWwgPSB0YWJsaXN0X2VsLnF1ZXJ5U2VsZWN0b3IoICdbcm9sZT1cInRhYlwiXVthcmlhLXNlbGVjdGVkPVwidHJ1ZVwiXScgKTtcblxuXHRcdFx0XHRpZiAoICEgYWN0aXZlX3RhYl9lbCApIHtcblx0XHRcdFx0XHRhY3RpdmVfdGFiX2VsID0gdGFibGlzdF9lbC5xdWVyeVNlbGVjdG9yKCAnW3JvbGU9XCJ0YWJcIl1bYXJpYS1jb250cm9scz1cIndwYmNfYmZiX19wYWxldHRlX2FkZF9uZXdcIl0nICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoICEgYWN0aXZlX3RhYl9lbCB8fCB0eXBlb2YgYWN0aXZlX3RhYl9lbC5jbGljayAhPT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0cmVzdG9yZTogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0dHJ5IHsgYWN0aXZlX3RhYl9lbC5jbGljaygpOyB9IGNhdGNoICggX2UgKSB7fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0dmFyIHRhYl9yZXN0b3JlX2hhbmRsZSA9IGNhcHR1cmVfcmlnaHRfc2lkZWJhcl9hY3RpdmVfdGFiX3Jlc3RvcmVfaGFuZGxlKCk7XG5cblx0XHRcdGxldCByZXN0b3JlZCAgPSBmYWxzZTtcblx0XHRcdHZhciBFVlMgICAgICA9IHdpbmRvdy5XUEJDX0JGQl9Db3JlICYmIHdpbmRvdy5XUEJDX0JGQl9Db3JlLldQQkNfQkZCX0V2ZW50cyA/IHdpbmRvdy5XUEJDX0JGQl9Db3JlLldQQkNfQkZCX0V2ZW50cyA6IHt9O1xuXHRcdFx0dmFyIEVWX0RPTkUgID0gRVZTLlNUUlVDVFVSRV9MT0FERUQgfHwgRVZTLkNBTlZBU19SRUZSRVNIRUQgfHwgJ3dwYmM6YmZiOnN0cnVjdHVyZS1sb2FkZWQnO1xuXG5cblx0XHRcdGZ1bmN0aW9uIGRvX3Jlc3RvcmUoKSB7XG5cdFx0XHRcdGlmICggcmVzdG9yZWQgKSB7IHJldHVybjsgfVxuXHRcdFx0XHRyZXN0b3JlZCA9IHRydWU7XG5cdFx0XHRcdHRyeSB7IEJ1aWxkZXI/LmJ1cz8ub2ZmPy4oIEVWX0RPTkUsIGRvX3Jlc3RvcmUgKTsgfSBjYXRjaCAoIF8gKSB7fVxuXHRcdFx0XHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRpZiAoICEgdGFiX3Jlc3RvcmVfaGFuZGxlICkgeyByZXR1cm47IH1cblx0XHRcdFx0XHR0YWJfcmVzdG9yZV9oYW5kbGUucmVzdG9yZSgpO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIExpc3RlbiBvbmNlIChiZXN0KSwgcGx1cyBhIGZhbGxiYWNrIGluIGNhc2UgZXZlbnQgaXNuJ3QgZmlyZWQuXG5cdFx0XHR0cnkgeyBCdWlsZGVyPy5idXM/Lm9uPy4oIEVWX0RPTkUsIGRvX3Jlc3RvcmUgKTsgfSBjYXRjaCAoIF8gKSB7fVxuXG5cblx0XHRcdHZhciBlbmFibGVkID0gKCdPbicgPT09IHZhbHVlKTtcblx0XHRcdEJ1aWxkZXIuc2V0X3ByZXZpZXdfbW9kZSggZW5hYmxlZCwgeyByZWJ1aWxkOiB0cnVlLCByZWluaXQ6IHRydWUsIHNvdXJjZTogJ3NldHRpbmdzLWVmZmVjdHMnIH0gKTtcblx0XHR9XG5cdCk7XG5cbn0gKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQyxVQUFVQSxDQUFDLEVBQUVDLENBQUMsRUFBRTtFQUNoQixZQUFZOztFQUVaLE1BQU1DLE9BQU8sR0FBSUYsQ0FBQyxDQUFDRyx5QkFBeUIsR0FBR0gsQ0FBQyxDQUFDRyx5QkFBeUIsSUFBSSxDQUFDLENBQUU7RUFDakYsTUFBTUMsR0FBRyxHQUFRRixPQUFPLENBQUNFLEdBQUcsR0FBR0YsT0FBTyxDQUFDRSxHQUFHLElBQUlDLE1BQU0sQ0FBQ0MsTUFBTSxDQUFFLElBQUssQ0FBRTtFQUVwRUosT0FBTyxDQUFDSyxRQUFRLEdBQUcsVUFBVUMsR0FBRyxFQUFFQyxFQUFFLEVBQUU7SUFDckMsSUFBS0QsR0FBRyxJQUFJLE9BQU9DLEVBQUUsS0FBSyxVQUFVLEVBQUc7TUFDdENMLEdBQUcsQ0FBQ00sTUFBTSxDQUFFRixHQUFJLENBQUMsQ0FBQyxHQUFHQyxFQUFFO0lBQ3hCO0VBQ0QsQ0FBQztFQUVELFNBQVNFLGVBQWVBLENBQUEsRUFBRztJQUMxQixPQUNDVixDQUFDLENBQUNXLGFBQWEsQ0FBRSw0QkFBNkIsQ0FBQyxJQUMvQ1gsQ0FBQyxDQUFDVyxhQUFhLENBQUUsMkJBQTRCLENBQUMsSUFDOUNYLENBQUMsQ0FBQ1ksY0FBYyxDQUFFLG1CQUFvQixDQUFDLElBQ3ZDWixDQUFDLENBQUNhLElBQUksSUFBSWIsQ0FBQyxDQUFDYyxlQUFlO0VBRTdCO0VBRUFiLE9BQU8sQ0FBQ2MsU0FBUyxHQUFHLFVBQVVSLEdBQUcsRUFBRVMsS0FBSyxFQUFFQyxHQUFHLEVBQUU7SUFDOUMsTUFBTVQsRUFBRSxHQUFHTCxHQUFH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
