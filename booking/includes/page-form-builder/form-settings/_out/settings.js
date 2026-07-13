"use strict";

/* globals window, document */
(function (w, d) {
  'use strict';

  /**
   * BFB Form Settings UI bridge.
   *
   * Listens to:
   * - wpbc:bfb:form_settings:apply   (from AJAX load)  -> apply to controls
   * - wpbc:bfb:form_settings:collect (from AJAX save)  -> collect from controls
   *
   * Optional:
   * - re-apply after Builder STRUCTURE_LOADED (timing hook only)
   */
  const api = w.WPBC_BFB_FormSettings = w.WPBC_BFB_FormSettings || {};

  // Last received settings pack (from AJAX).
  let last_settings_pack = null;

  // Small retry, because DOM can be re-rendered after apply event.
  let raf_id = 0;
  let retry_count = 0;
  const retry_max = 20;
  const fallback_form_style_option_keys = ['booking_form_style', 'booking_form_custom_background_color', 'booking_form_custom_border_color', 'booking_form_custom_border_width', 'booking_form_custom_border_radius', 'booking_form_custom_padding_vertical', 'booking_form_custom_padding_horizontal', 'booking_form_custom_text_color', 'booking_form_custom_field_background_color', 'booking_form_custom_field_text_color', 'booking_form_custom_field_border_color', 'booking_form_custom_button_background_color', 'booking_form_custom_button_text_color', 'booking_form_custom_button_border_color', 'booking_form_custom_button_hover_background_color', 'booking_form_custom_button_hover_text_color', 'booking_form_custom_button_hover_border_color', 'booking_form_custom_secondary_button_background_color', 'booking_form_custom_secondary_button_text_color', 'booking_form_custom_secondary_button_border_color', 'booking_form_custom_secondary_button_hover_background_color', 'booking_form_custom_secondary_button_hover_text_color', 'booking_form_custom_secondary_button_hover_border_color', 'booking_form_theme', 'booking_form_container_style', 'booking_form_background_color', 'booking_form_border_color', 'booking_form_border_width', 'booking_form_border_radius', 'booking_form_padding', 'booking_form_text_color', 'booking_form_field_background_color', 'booking_form_field_text_color', 'booking_form_field_border_color'];

  // -----------------------------------------------------------------------------------------------
  // Small helpers
  // -----------------------------------------------------------------------------------------------

  function query_all(root, selector) {
    return Array.from((root || d).querySelectorAll(selector));
  }
  function css_escape(value) {
    const v = String(value == null ? '' : value);
    if (w.CSS && typeof w.CSS.escape === 'function') return w.CSS.escape(v);
    return v.replace(/[^a-zA-Z0-9_\-]/g, '\\$&');
  }
  function is_on(value) {
    const v = String(value == null ? '' : value).trim().toLowerCase();
    return v === 'on' || v === '1' || v === 'true' || v === 'yes';
  }
  function set_initial_attr(el, value) {
    if (!el) return;
    el.setAttribute('data-wpbc-bfb-fs-initial', String(value == null ? '' : value));
  }
  function trigger_change(el) {
    if (!el) return;
    try {
      el.dispatchEvent(new Event('change', {
        bubbles: true
      }));
    } catch (_) {}
  }
  function trigger_input(el) {
    if (!el) return;
    try {
      el.dispatchEvent(new Event('input', {
        bubbles: true
      }));
    } catch (_) {}
  }
  function find_rows(scope) {
    const rows = query_all(d, '.wpbc-setting[data-key]');
    if (!scope) return rows;
    return rows.filter(function (row) {
      return String(row.getAttribute('data-scope') || '') === String(scope);
    });
  }
  function has_any_rows() {
    return query_all(d, '.wpbc-setting[data-key]').length > 0;
  }
  function init_coloris_pickers(root) {
    if (!root || !w.Coloris) {
      return;
    }
    const inputs = query_all(root, 'input[data-wpbc-bfb-fs-type="color"][data-coloris], input[data-inspector-type="color"][data-coloris]');
    if (!inputs.length) {
      return;
    }
    inputs.forEach(function (input) {
      if (input.classList.contains('wpbc_bfb_coloris')) return;
      input.classList.add('wpbc_bfb_coloris');
    });
    try {
      w.Coloris({
        el: '.wpbc_bfb_coloris',
        alpha: false,
        format: 'hex',
        themeMode: 'auto',
        onChange: function (color, input) {
          if (!input) {
            return;
          }
          try {
            input.dispatchEvent(new CustomEvent('wpbc:bfb:coloris:change', {
              bubbles: true,
              detail: {
                color: color,
                currentEl: input
              }
            }));
          } catch (_e) {}
        }
      });
    } catch (e) {
      console.warn('WPBC Form Settings: Coloris init failed:', e);
    }
  }
  function get_default_custom_appearance_settings() {
    const localized = w.wpbc_bfb_settings_vars && w.wpbc_bfb_settings_vars.custom_form_style_defaults ? w.wpbc_bfb_settings_vars.custom_form_style_defaults : {};
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
  function get_form_style_option_keys() {
    const localized = w.wpbc_bfb_settings_vars && Array.isArray(w.wpbc_bfb_settings_vars.form_style_option_keys) ? w.wpbc_bfb_settings_vars.form_style_option_keys : [];
    return localized.length ? localized : fallback_form_style_option_keys;
  }
  function strip_form_style_options_from_pack(settings_pack) {
    if (!settings_pack || typeof settings_pack !== 'object') return settings_pack;
    if (!settings_pack.options || typeof settings_pack.options !== 'object') return settings_pack;
    get_form_style_option_keys().forEach(function (key) {
      delete settings_pack.options[key];
    });
    return settings_pack;
  }

  // -----------------------------------------------------------------------------------------------
  // Row setter
  // -----------------------------------------------------------------------------------------------

  function set_value_for_row(row, value, opts) {
    if (!row) return;
    const row_type = String(row.getAttribute('data-type') || '');
    const row_key = String(row.getAttribute('data-key') || '');
    const do_trigger_events = !!(opts && opts.trigger_change);
    if (!row_key) return;

    // Radio group
    if (row_type === 'radio') {
      const wrap = row.querySelector('.wpbc_bfb__form_setting_radio[data-wpbc-bfb-fs-controlid]');
      const control_id = wrap ? String(wrap.getAttribute('data-wpbc-bfb-fs-controlid') || '') : '';
      if (!control_id) return;
      const target_value = String(value == null ? '' : value);
      const radios = query_all(row, 'input[type="radio"][name="' + css_escape(control_id) + '"]');
      let checked_radio = null;
      radios.forEach(function (radio) {
        const should_check = String(radio.value) === target_value;
        radio.checked = should_check;
        if (should_check) checked_radio = radio;
        const choice = radio.closest ? radio.closest('.wpbc_theme_choice') : null;
        if (choice) {
          choice.classList.toggle('is-selected', should_check);
        }
      });
      if (wrap) set_initial_attr(wrap, target_value);
      if (do_trigger_events && checked_radio) trigger_change(checked_radio);
      return;
    }

    // Toggle
    if (row_type === 'toggle') {
      const checkbox = row.querySelector('input[type="checkbox"][data-wpbc-bfb-fs-type="toggle"]') || row.querySelector('input[type="checkbox"]');
      if (!checkbox) return;
      const checked = is_on(value);
      checkbox.checked = checked;
      checkbox.setAttribute('aria-checked', checked ? 'true' : 'false');
      set_initial_attr(checkbox, checked ? 'On' : 'Off');
      if (do_trigger_events) trigger_change(checkbox);
      return;
    }

    // Select
    if (row_type === 'select') {
      const select = row.querySelector('select[data-wpbc-bfb-fs-type="select"]') || row.querySelector('select');
      if (!select) return;
      select.value = String(value == null ? '' : value);
      set_initial_attr(select, select.value);
      if (do_trigger_events) trigger_change(select);
      return;
    }

    // Length: hidden combined + num/unit
    if (row_type === 'length') {
      // JS slider length control: - hidden writer carries FS markers and must receive input event so wpbc_slider_len_groups.js syncs UI.
      const writer = row.querySelector('input[data-wpbc_slider_len_writer][data-wpbc-bfb-fs-type="length"]') || row.querySelector('input[data-wpbc-bfb-fs-type="length"]');
      if (!writer) return;
      const combined = String(value == null ? '' : value);
      writer.value = combined;
      set_initial_attr(writer, combined);
      if (do_trigger_events) trigger_input(writer);
      return;
    }

    // Spacing: two number inputs saved into a hidden CSS shorthand writer.
    if (row_type === 'spacing') {
      const group = row.querySelector('.wpbc_spacing_group');
      const vertical_input = group ? group.querySelector('input[data-wpbc_spacing_vertical]') : null;
      const horizontal_input = group ? group.querySelector('input[data-wpbc_spacing_horizontal]') : null;
      const writer = group ? group.querySelector('input[data-wpbc_spacing_writer]') : null;
      const parsed = parse_spacing_value(value);
      if (!writer) {
        return;
      }
      if (vertical_input) {
        vertical_input.value = parsed.vertical;
      }
      if (horizontal_input) {
        horizontal_input.value = parsed.horizontal;
      }
      writer.value = parsed.combined;
      set_initial_attr(writer, parsed.combined);
      if (do_trigger_events) trigger_input(writer);
      return;
    }

    // Range (slider number): writer is the number input.
    if (row_type === 'range') {
      const writer = row.querySelector('input[data-wpbc_slider_range_writer]') || row.querySelector('input[data-wpbc-bfb-fs-key="' + css_escape(row_key) + '"]') || row.querySelector('input[type="number"]');
      if (!writer) return;
      writer.value = String(value == null ? '' : value);
      set_initial_attr(writer, writer.value);
      if (do_trigger_events) trigger_input(writer);
      return;
    }

    // Default: input/textarea
    const control = row.querySelector('[data-wpbc-bfb-fs-key="' + css_escape(row_key) + '"]') || row.querySelector('input,textarea');
    if (!control) return;
    control.value = String(value == null ? '' : value);
    set_initial_attr(control, control.value);
    // For normal inputs, "input" gives better reactivity than "change".
    if (do_trigger_events) trigger_input(control);
  }

  // -----------------------------------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------------------------------

  /**
   * Apply FLAT object (key=>value) to rows of some scope.
   */
  function apply_flat_settings(flat_settings, scope, opts) {
    if (!flat_settings || typeof flat_settings !== 'object') return;
    find_rows(scope).forEach(function (row) {
      const key = String(row.getAttribute('data-key') || '');
      if (!key) return;
      if (!Object.prototype.hasOwnProperty.call(flat_settings, key)) return;
      set_value_for_row(row, flat_settings[key], opts);
    });
  }

  /**
   * Apply settings.
   *
   * Supports:
   * - flat: { booking_form_layout_width: '100%', ... }
   * - pack: { options: {...}, css_vars: {...} }   (Option A)
   */
  api.apply = function (settings_pack, scope, opts) {
    if (!settings_pack || typeof settings_pack !== 'object') return;
    if (!settings_pack.options || typeof settings_pack.options !== 'object') return; // strict Option A
    strip_form_style_options_from_pack(settings_pack);
    apply_flat_settings(settings_pack.options, scope || 'form', opts);
  };
  api.reset_custom_appearance = function () {
    const defaults = get_default_custom_appearance_settings();
    if (!last_settings_pack || typeof last_settings_pack !== 'object') {
      last_settings_pack = {
        options: {},
        css_vars: {}
      };
    }
    if (!last_settings_pack.options || typeof last_settings_pack.options !== 'object') {
      last_settings_pack.options = {};
    }
    Object.keys(defaults).forEach(function (key) {
      last_settings_pack.options[key] = defaults[key];
    });
    apply_flat_settings(defaults, 'global', {
      trigger_change: true
    });
    init_coloris_pickers(d);
    if (w.WPBC_BFB_Settings_Effects && typeof w.WPBC_BFB_Settings_Effects.apply_all === 'function') {
      w.WPBC_BFB_Settings_Effects.apply_all(defaults, {
        source: 'reset-custom-appearance',
        options: defaults
      });
    }
    try {
      d.dispatchEvent(new CustomEvent('wpbc:bfb:form_settings:changed', {
        bubbles: true,
        detail: {
          source: 'reset-custom-appearance',
          settings: {
            options: Object.assign({}, defaults)
          }
        }
      }));
    } catch (_e) {}
  };

  /**
   * Collect current values (flat object).
   */
  api.collect = function (scope) {
    const out = {};
    find_rows(scope || 'form').forEach(function (row) {
      const key = String(row.getAttribute('data-key') || '');
      const type = String(row.getAttribute('data-type') || '');
      if (!key) return;
      if (type === 'radio') {
        const wrap = row.querySelector('.wpbc_bfb__form_setting_radio[data-wpbc-bfb-fs-controlid]');
        const control_id = wrap ? String(wrap.getAttribute('data-wpbc-bfb-fs-controlid') || '') : '';
        if (!control_id) return;
        const checked = row.querySelector('input[type="radio"][name="' + css_escape(control_id) + '"]:checked');
        out[key] = checked ? String(checked.value) : '';
        return;
      }
      if (type === 'toggle') {
        const checkbox = row.querySelector('input[type="checkbox"][data-wpbc-bfb-fs-type="toggle"]') || row.querySelector('input[type="checkbox"]');
        out[key] = checkbox && checkbox.checked ? 'On' : 'Off';
        return;
      }
      if (type === 'select') {
        const select = row.querySelector('select');
        out[key] = select ? String(select.value) : '';
        return;
      }
      if (type === 'length') {
        const hidden = row.querySelector('input[data-wpbc-bfb-fs-type="length"]');
        out[key] = hidden ? String(hidden.value || '') : '';
        return;
      }
      if (type === 'spacing') {
        out[key] = get_spacing_value(row);
        return;
      }
      if (type === 'range') {
        const writer = row.querySelector('input[data-wpbc_slider_range_writer]') || row.querySelector('input[type="number"]') || row.querySelector('input[type="range"]');
        out[key] = writer ? String(writer.value || '') : '';
        return;
      }
      const control = row.querySelector('input,textarea');
      out[key] = control ? String(control.value || '') : '';
    });
    return out;
  };
  function parse_spacing_value(value) {
    const fallback = {
      vertical: '10',
      horizontal: '30',
      combined: '10px 30px'
    };
    const matches = String(value == null ? '' : value).match(/-?\d+(?:\.\d+)?/g) || [];
    let vertical = matches[0] != null ? String(matches[0]) : fallback.vertical;
    let horizontal = matches[1] != null ? String(matches[1]) : vertical;
    if (isNaN(Number(vertical))) {
      vertical = fallback.vertical;
    }
    if (isNaN(Number(horizontal))) {
      horizontal = fallback.horizontal;
    }
    return {
      vertical: vertical,
      horizontal: horizontal,
      combined: vertical + 'px ' + horizontal + 'px'
    };
  }
  function get_spacing_value(row) {
    const group = row ? row.querySelector('.wpbc_spacing_group') : null;
    const vertical_input = group ? group.querySelector('input[data-wpbc_spacing_vertical]') : null;
    const horizontal_input = group ? group.querySelector('input[data-wpbc_spacing_horizontal]') : null;
    const writer = group ? group.querySelector('input[data-wpbc_spacing_writer]') : null;
    const vertical = vertical_input ? String(vertical_input.value || '0') : '0';
    const horizontal = horizontal_input ? String(horizontal_input.value || vertical) : vertical;
    const combined = parse_spacing_value(vertical + 'px ' + horizontal + 'px').combined;
    if (writer) {
      writer.value = combined;
    }
    return combined;
  }

  /**
   * Re-apply last received settings (useful after DOM re-render).
   */
  api.reapply_last = function () {
    if (!last_settings_pack) return;
    api.apply(last_settings_pack, 'form', {
      trigger_change: true
    });
  };
  api.init = function () {
    init_coloris_pickers(d);

    // If apply event fired before init, try again now.
    if (last_settings_pack) schedule_apply_retry();
  };

  // -----------------------------------------------------------------------------------------------
  // DOM Events (AJAX layer)
  // -----------------------------------------------------------------------------------------------

  // Save: let modules contribute into { options:{}, css_vars:{} }
  d.addEventListener('wpbc:bfb:form_settings:collect', function (e) {
    const detail = e && e.detail ? e.detail : {};
    const target_pack = detail.settings;
    if (!target_pack || typeof target_pack !== 'object') return;

    // Option A: write into target_pack.options
    if (!target_pack.options || typeof target_pack.options !== 'object') {
      target_pack.options = {};
    }
    const collected = api.collect('form');
    Object.keys(collected).forEach(function (k) {
      target_pack.options[k] = collected[k];
    });
    strip_form_style_options_from_pack(target_pack);
  });

  // Load: receive settings from AJAX and apply.
  d.addEventListener('wpbc:bfb:form_settings:apply', function (e) {
    const detail = e && e.detail ? e.detail : {};
    last_settings_pack = detail.settings || null;
    retry_count = 0;
    schedule_apply_retry();
  });
  d.addEventListener('click', function (e) {
    const btn = e && e.target && e.target.closest ? e.target.closest('[data-wpbc-bfb-reset-custom-appearance]') : null;
    if (!btn) {
      return;
    }
    e.preventDefault();
    api.reset_custom_appearance();
  }, false);
  function schedule_apply_retry() {
    if (raf_id) return;
    raf_id = w.requestAnimationFrame(function () {
      raf_id = 0;

      // If settings UI not present yet, retry a few frames.
      if (!has_any_rows()) {
        retry_count++;
        if (retry_count < retry_max) schedule_apply_retry();
        return;
      }
      api.reapply_last();
      init_coloris_pickers(d);
    });
  }

  // -----------------------------------------------------------------------------------------------
  // Optional Builder timing hook (STRUCTURE_LOADED) -> reapply_last()
  // -----------------------------------------------------------------------------------------------

  function bind_builder_timing_hook(builder_instance) {
    const core = w.WPBC_BFB_Core;
    const events = core && core.WPBC_BFB_Events ? core.WPBC_BFB_Events : w.WPBC_BFB_Events || null;
    if (!builder_instance || !builder_instance.bus || !events || !events.STRUCTURE_LOADED) return;
    builder_instance.bus.on(events.STRUCTURE_LOADED, function () {
      // Builder may re-render settings panel after structure load.
      // Re-apply last settings pack (if any).
      retry_count = 0;
      schedule_apply_retry();
    });
  }
  if (w.wpbc_bfb_api && w.wpbc_bfb_api.ready && typeof w.wpbc_bfb_api.ready.then === 'function') {
    w.wpbc_bfb_api.ready.then(bind_builder_timing_hook);
  } else {
    setTimeout(function () {
      if (w.__B) {
        bind_builder_timing_hook(w.__B);
      }
    }, 0);
  }

  // DOM ready init.
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', api.init);else api.init();
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZm9ybS1zZXR0aW5ncy9fb3V0L3NldHRpbmdzLmpzIiwibmFtZXMiOlsidyIsImQiLCJhcGkiLCJXUEJDX0JGQl9Gb3JtU2V0dGluZ3MiLCJsYXN0X3NldHRpbmdzX3BhY2siLCJyYWZfaWQiLCJyZXRyeV9jb3VudCIsInJldHJ5X21heCIsImZhbGxiYWNrX2Zvcm1fc3R5bGVfb3B0aW9uX2tleXMiLCJxdWVyeV9hbGwiLCJyb290Iiwic2VsZWN0b3IiLCJBcnJheSIsImZyb20iLCJxdWVyeVNlbGVjdG9yQWxsIiwiY3NzX2VzY2FwZSIsInZhbHVlIiwidiIsIlN0cmluZyIsIkNTUyIsImVzY2FwZSIsInJlcGxhY2UiLCJpc19vbiIsInRyaW0iLCJ0b0xvd2VyQ2FzZSIsInNldF9pbml0aWFsX2F0dHIiLCJlbCIsInNldEF0dHJpYnV0ZSIsInRyaWdnZXJfY2hhbmdlIiwiZGlzcGF0Y2hFdmVudCIsIkV2ZW50IiwiYnViYmxlcyIsIl8iLCJ0cmlnZ2VyX2lucHV0IiwiZmluZF9yb3dzIiwic2NvcGUiLCJyb3dzIiwiZmlsdGVyIiwicm93IiwiZ2V0QXR0cmlidXRlIiwiaGFzX2FueV9yb3dzIiwibGVuZ3RoIiwiaW5pdF9jb2xvcmlzX3BpY2tlcnMiLCJDb2xvcmlzIiwiaW5wdXRzIiwiZm9yRWFjaCIsImlucHV0IiwiY2xhc3NMaXN0IiwiY29udGFpbnMiLCJhZGQiLCJhbHBoYSIsImZvcm1hdCIsInRoZW1lTW9kZSIsIm9uQ2hhbmdlIiwiY29sb3IiLCJDdXN0b21FdmVudCIsImRldGFpbCIsImN1cnJlbnRFbCIsIl9lIiwiZSIsImNvbnNvbGUiLCJ3YXJuIiwiZ2V0X2RlZmF1bHRfY3VzdG9tX2FwcGVhcmFuY2Vfc2V0dGluZ3MiLCJsb2NhbGl6ZWQiLCJ3cGJjX2JmYl9zZXR0aW5nc192YXJzIiwiY3VzdG9tX2Zvcm1fc3R5bGVfZGVmYXVsdHMiLCJPYmplY3QiLCJhc3NpZ24iLCJib29raW5nX2Zvcm1fY3VzdG9tX2JhY2tncm91bmRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX3dpZHRoIiwiYm9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfcmFkaXVzIiwiYm9va2luZ19mb3JtX2N1c3RvbV9wYWRkaW5nX3ZlcnRpY2FsIiwiYm9va2luZ19mb3JtX2N1c3RvbV9wYWRkaW5nX2hvcml6b250YWwiLCJib29raW5nX2Zvcm1fY3VzdG9tX3RleHRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JhY2tncm91bmRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX3RleHRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JvcmRlcl9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JhY2tncm91bmRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl90ZXh0X2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYm9yZGVyX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfYmFja2dyb3VuZF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX3RleHRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl9ib3JkZXJfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fYmFja2dyb3VuZF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl90ZXh0X2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2JvcmRlcl9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl9iYWNrZ3JvdW5kX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX3RleHRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfYm9yZGVyX2NvbG9yIiwiZ2V0X2Zvcm1fc3R5bGVfb3B0aW9uX2tleXMiLCJpc0FycmF5IiwiZm9ybV9zdHlsZV9vcHRpb25fa2V5cyIsInN0cmlwX2Zvcm1fc3R5bGVfb3B0aW9uc19mcm9tX3BhY2siLCJzZXR0aW5nc19wYWNrIiwib3B0aW9ucyIsImtleSIsInNldF92YWx1ZV9mb3Jfcm93Iiwib3B0cyIsInJvd190eXBlIiwicm93X2tleSIsImRvX3RyaWdnZXJfZXZlbnRzIiwid3JhcCIsInF1ZXJ5U2VsZWN0b3IiLCJjb250cm9sX2lkIiwidGFyZ2V0X3ZhbHVlIiwicmFkaW9zIiwiY2hlY2tlZF9yYWRpbyIsInJhZGlvIiwic2hvdWxkX2NoZWNrIiwiY2hlY2tlZCIsImNob2ljZSIsImNsb3Nlc3QiLCJ0b2dnbGUiLCJjaGVja2JveCIsInNlbGVjdCIsIndyaXRlciIsImNvbWJpbmVkIiwiZ3JvdXAiLCJ2ZXJ0aWNhbF9pbnB1dCIsImhvcml6b250YWxfaW5wdXQiLCJwYXJzZWQiLCJwYXJzZV9zcGFjaW5nX3ZhbHVlIiwidmVydGljYWwiLCJob3Jpem9udGFsIiwiY29udHJvbCIsImFwcGx5X2ZsYXRfc2V0dGluZ3MiLCJmbGF0X3NldHRpbmdzIiwicHJvdG90eXBlIiwiaGFzT3duUHJvcGVydHkiLCJjYWxsIiwiYXBwbHkiLCJyZXNldF9jdXN0b21fYXBwZWFyYW5jZSIsImRlZmF1bHRzIiwiY3NzX3ZhcnMiLCJrZXlzIiwiV1BCQ19CRkJfU2V0dGluZ3NfRWZmZWN0cyIsImFwcGx5X2FsbCIsInNvdXJjZSIsInNldHRpbmdzIiwiY29sbGVjdCIsIm91dCIsInR5cGUiLCJoaWRkZW4iLCJnZXRfc3BhY2luZ192YWx1ZSIsImZhbGxiYWNrIiwibWF0Y2hlcyIsIm1hdGNoIiwiaXNOYU4iLCJOdW1iZXIiLCJyZWFwcGx5X2xhc3QiLCJpbml0Iiwic2NoZWR1bGVfYXBwbHlfcmV0cnkiLCJhZGRFdmVudExpc3RlbmVyIiwidGFyZ2V0X3BhY2siLCJjb2xsZWN0ZWQiLCJrIiwiYnRuIiwidGFyZ2V0IiwicHJldmVudERlZmF1bHQiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJiaW5kX2J1aWxkZXJfdGltaW5nX2hvb2siLCJidWlsZGVyX2luc3RhbmNlIiwiY29yZSIsIldQQkNfQkZCX0NvcmUiLCJldmVudHMiLCJXUEJDX0JGQl9FdmVudHMiLCJidXMiLCJTVFJVQ1RVUkVfTE9BREVEIiwib24iLCJ3cGJjX2JmYl9hcGkiLCJyZWFkeSIsInRoZW4iLCJzZXRUaW1lb3V0IiwiX19CIiwicmVhZHlTdGF0ZSIsIndpbmRvdyIsImRvY3VtZW50Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZm9ybS1zZXR0aW5ncy9fc3JjL3NldHRpbmdzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbHMgd2luZG93LCBkb2N1bWVudCAqL1xyXG4oZnVuY3Rpb24gKHcsIGQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdC8qKlxyXG5cdCAqIEJGQiBGb3JtIFNldHRpbmdzIFVJIGJyaWRnZS5cclxuXHQgKlxyXG5cdCAqIExpc3RlbnMgdG86XHJcblx0ICogLSB3cGJjOmJmYjpmb3JtX3NldHRpbmdzOmFwcGx5ICAgKGZyb20gQUpBWCBsb2FkKSAgLT4gYXBwbHkgdG8gY29udHJvbHNcclxuXHQgKiAtIHdwYmM6YmZiOmZvcm1fc2V0dGluZ3M6Y29sbGVjdCAoZnJvbSBBSkFYIHNhdmUpICAtPiBjb2xsZWN0IGZyb20gY29udHJvbHNcclxuXHQgKlxyXG5cdCAqIE9wdGlvbmFsOlxyXG5cdCAqIC0gcmUtYXBwbHkgYWZ0ZXIgQnVpbGRlciBTVFJVQ1RVUkVfTE9BREVEICh0aW1pbmcgaG9vayBvbmx5KVxyXG5cdCAqL1xyXG5cdGNvbnN0IGFwaSA9ICh3LldQQkNfQkZCX0Zvcm1TZXR0aW5ncyA9IHcuV1BCQ19CRkJfRm9ybVNldHRpbmdzIHx8IHt9KTtcclxuXHJcblx0Ly8gTGFzdCByZWNlaXZlZCBzZXR0aW5ncyBwYWNrIChmcm9tIEFKQVgpLlxyXG5cdGxldCBsYXN0X3NldHRpbmdzX3BhY2sgPSBudWxsO1xyXG5cclxuXHQvLyBTbWFsbCByZXRyeSwgYmVjYXVzZSBET00gY2FuIGJlIHJlLXJlbmRlcmVkIGFmdGVyIGFwcGx5IGV2ZW50LlxyXG5cdGxldCByYWZfaWQgICAgICA9IDA7XHJcblx0bGV0IHJldHJ5X2NvdW50ID0gMDtcblx0Y29uc3QgcmV0cnlfbWF4ID0gMjA7XG5cdGNvbnN0IGZhbGxiYWNrX2Zvcm1fc3R5bGVfb3B0aW9uX2tleXMgPSBbXG5cdFx0J2Jvb2tpbmdfZm9ybV9zdHlsZScsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fYmFja2dyb3VuZF9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfd2lkdGgnLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl9yYWRpdXMnLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX3BhZGRpbmdfdmVydGljYWwnLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX3BhZGRpbmdfaG9yaXpvbnRhbCcsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fdGV4dF9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYmFja2dyb3VuZF9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfdGV4dF9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYm9yZGVyX2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYmFja2dyb3VuZF9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX3RleHRfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ib3JkZXJfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl9iYWNrZ3JvdW5kX2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfdGV4dF9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JvcmRlcl9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9iYWNrZ3JvdW5kX2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX3RleHRfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fYm9yZGVyX2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX2JhY2tncm91bmRfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfdGV4dF9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl9ib3JkZXJfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fdGhlbWUnLFxuXHRcdCdib29raW5nX2Zvcm1fY29udGFpbmVyX3N0eWxlJyxcblx0XHQnYm9va2luZ19mb3JtX2JhY2tncm91bmRfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fYm9yZGVyX2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2JvcmRlcl93aWR0aCcsXG5cdFx0J2Jvb2tpbmdfZm9ybV9ib3JkZXJfcmFkaXVzJyxcblx0XHQnYm9va2luZ19mb3JtX3BhZGRpbmcnLFxuXHRcdCdib29raW5nX2Zvcm1fdGV4dF9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9maWVsZF9iYWNrZ3JvdW5kX2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2ZpZWxkX3RleHRfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fZmllbGRfYm9yZGVyX2NvbG9yJ1xuXHRdO1xuXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gU21hbGwgaGVscGVyc1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdGZ1bmN0aW9uIHF1ZXJ5X2FsbChyb290LCBzZWxlY3Rvcikge1xyXG5cdFx0cmV0dXJuIEFycmF5LmZyb20oKHJvb3QgfHwgZCkucXVlcnlTZWxlY3RvckFsbChzZWxlY3RvcikpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gY3NzX2VzY2FwZSh2YWx1ZSkge1xyXG5cdFx0Y29uc3QgdiA9IFN0cmluZyh2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSk7XHJcblx0XHRpZiAody5DU1MgJiYgdHlwZW9mIHcuQ1NTLmVzY2FwZSA9PT0gJ2Z1bmN0aW9uJykgcmV0dXJuIHcuQ1NTLmVzY2FwZSh2KTtcclxuXHRcdHJldHVybiB2LnJlcGxhY2UoL1teYS16QS1aMC05X1xcLV0vZywgJ1xcXFwkJicpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaXNfb24odmFsdWUpIHtcclxuXHRcdGNvbnN0IHYgPSBTdHJpbmcodmFsdWUgPT0gbnVsbCA/ICcnIDogdmFsdWUpLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0cmV0dXJuICh2ID09PSAnb24nIHx8IHYgPT09ICcxJyB8fCB2ID09PSAndHJ1ZScgfHwgdiA9PT0gJ3llcycpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2V0X2luaXRpYWxfYXR0cihlbCwgdmFsdWUpIHtcclxuXHRcdGlmICghZWwpIHJldHVybjtcclxuXHRcdGVsLnNldEF0dHJpYnV0ZSgnZGF0YS13cGJjLWJmYi1mcy1pbml0aWFsJywgU3RyaW5nKHZhbHVlID09IG51bGwgPyAnJyA6IHZhbHVlKSk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB0cmlnZ2VyX2NoYW5nZShlbCkge1xyXG5cdFx0aWYgKCFlbCkgcmV0dXJuO1xyXG5cdFx0dHJ5IHsgZWwuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2NoYW5nZScsIHsgYnViYmxlczogdHJ1ZSB9KSk7IH0gY2F0Y2ggKF8pIHt9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB0cmlnZ2VyX2lucHV0KGVsKSB7XHJcblx0XHRpZiAoICFlbCApIHJldHVybjtcclxuXHRcdHRyeSB7IGVsLmRpc3BhdGNoRXZlbnQoIG5ldyBFdmVudCggJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0gKSApOyB9IGNhdGNoICggXyApIHt9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBmaW5kX3Jvd3Moc2NvcGUpIHtcclxuXHRcdGNvbnN0IHJvd3MgPSBxdWVyeV9hbGwoZCwgJy53cGJjLXNldHRpbmdbZGF0YS1rZXldJyk7XHJcblx0XHRpZiAoIXNjb3BlKSByZXR1cm4gcm93cztcclxuXHJcblx0XHRyZXR1cm4gcm93cy5maWx0ZXIoZnVuY3Rpb24gKHJvdykge1xyXG5cdFx0XHRyZXR1cm4gU3RyaW5nKHJvdy5nZXRBdHRyaWJ1dGUoJ2RhdGEtc2NvcGUnKSB8fCAnJykgPT09IFN0cmluZyhzY29wZSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGhhc19hbnlfcm93cygpIHtcblx0XHRyZXR1cm4gcXVlcnlfYWxsKGQsICcud3BiYy1zZXR0aW5nW2RhdGEta2V5XScpLmxlbmd0aCA+IDA7XG5cdH1cblxuXHRmdW5jdGlvbiBpbml0X2NvbG9yaXNfcGlja2Vycyhyb290KSB7XG5cdFx0aWYgKCAhIHJvb3QgfHwgISB3LkNvbG9yaXMgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5wdXRzID0gcXVlcnlfYWxsKHJvb3QsICdpbnB1dFtkYXRhLXdwYmMtYmZiLWZzLXR5cGU9XCJjb2xvclwiXVtkYXRhLWNvbG9yaXNdLCBpbnB1dFtkYXRhLWluc3BlY3Rvci10eXBlPVwiY29sb3JcIl1bZGF0YS1jb2xvcmlzXScpO1xuXHRcdGlmICggISBpbnB1dHMubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlucHV0cy5mb3JFYWNoKGZ1bmN0aW9uIChpbnB1dCkge1xuXHRcdFx0aWYgKGlucHV0LmNsYXNzTGlzdC5jb250YWlucygnd3BiY19iZmJfY29sb3JpcycpKSByZXR1cm47XG5cdFx0XHRpbnB1dC5jbGFzc0xpc3QuYWRkKCd3cGJjX2JmYl9jb2xvcmlzJyk7XG5cdFx0fSk7XG5cblx0XHR0cnkge1xuXHRcdFx0dy5Db2xvcmlzKHtcblx0XHRcdFx0ZWwgICAgICAgOiAnLndwYmNfYmZiX2NvbG9yaXMnLFxuXHRcdFx0XHRhbHBoYSAgICA6IGZhbHNlLFxuXHRcdFx0XHRmb3JtYXQgICA6ICdoZXgnLFxuXHRcdFx0XHR0aGVtZU1vZGU6ICdhdXRvJyxcblx0XHRcdFx0b25DaGFuZ2UgOiBmdW5jdGlvbiAoY29sb3IsIGlucHV0KSB7XG5cdFx0XHRcdFx0aWYgKCAhIGlucHV0ICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0aW5wdXQuZGlzcGF0Y2hFdmVudCggbmV3IEN1c3RvbUV2ZW50KCAnd3BiYzpiZmI6Y29sb3JpczpjaGFuZ2UnLCB7XG5cdFx0XHRcdFx0XHRcdGJ1YmJsZXM6IHRydWUsXG5cdFx0XHRcdFx0XHRcdGRldGFpbCA6IHtcblx0XHRcdFx0XHRcdFx0XHRjb2xvciAgICA6IGNvbG9yLFxuXHRcdFx0XHRcdFx0XHRcdGN1cnJlbnRFbDogaW5wdXRcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSApICk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoIF9lICkge31cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc29sZS53YXJuKCdXUEJDIEZvcm0gU2V0dGluZ3M6IENvbG9yaXMgaW5pdCBmYWlsZWQ6JywgZSk7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0X2RlZmF1bHRfY3VzdG9tX2FwcGVhcmFuY2Vfc2V0dGluZ3MoKSB7XG5cdFx0Y29uc3QgbG9jYWxpemVkID0gdy53cGJjX2JmYl9zZXR0aW5nc192YXJzICYmIHcud3BiY19iZmJfc2V0dGluZ3NfdmFycy5jdXN0b21fZm9ybV9zdHlsZV9kZWZhdWx0c1xuXHRcdFx0PyB3LndwYmNfYmZiX3NldHRpbmdzX3ZhcnMuY3VzdG9tX2Zvcm1fc3R5bGVfZGVmYXVsdHNcblx0XHRcdDoge307XG5cblx0XHRyZXR1cm4gT2JqZWN0LmFzc2lnbigge1xuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9iYWNrZ3JvdW5kX2NvbG9yICAgICAgIDogJyNmZmZmZmYnLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfY29sb3IgICAgICAgICAgIDogJyNjY2NjY2MnLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfd2lkdGggICAgICAgICAgIDogJzFweCcsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl9yYWRpdXMgICAgICAgICAgOiAnMnB4Jyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fcGFkZGluZ192ZXJ0aWNhbCAgICAgICA6ICcxMHB4Jyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fcGFkZGluZ19ob3Jpem9udGFsICAgICA6ICczMHB4Jyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fdGV4dF9jb2xvciAgICAgICAgICAgICA6ICcjMWQyMzI3Jyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYmFja2dyb3VuZF9jb2xvciA6ICcjZmZmZmZmJyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfdGV4dF9jb2xvciAgICAgICA6ICcjM2M0MzRhJyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fZmllbGRfYm9yZGVyX2NvbG9yICAgICA6ICcjY2NjY2NjJyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JhY2tncm91bmRfY29sb3I6ICcjMDY2YWFiJyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX3RleHRfY29sb3IgICAgICA6ICcjZmZmZmZmJyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JvcmRlcl9jb2xvciAgICA6ICcjMDY2YWFiJyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JhY2tncm91bmRfY29sb3I6ICcjMDU1NTg5Jyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX3RleHRfY29sb3I6ICcjZmZmZmZmJyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JvcmRlcl9jb2xvcjogJyMwNTU1ODknLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2JhY2tncm91bmRfY29sb3I6ICcjZmRmZGZkJyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl90ZXh0X2NvbG9yOiAnIzQ0NDQ0NCcsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fYm9yZGVyX2NvbG9yOiAnI2VlZWVlZScsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfYmFja2dyb3VuZF9jb2xvcjogJyNmZGZkZmQnLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX3RleHRfY29sb3I6ICcjNDQ0NDQ0Jyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl9ib3JkZXJfY29sb3I6ICcjNGQ5MWNkJ1xuXHRcdH0sIGxvY2FsaXplZCApO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0X2Zvcm1fc3R5bGVfb3B0aW9uX2tleXMoKSB7XG5cdFx0Y29uc3QgbG9jYWxpemVkID0gdy53cGJjX2JmYl9zZXR0aW5nc192YXJzICYmIEFycmF5LmlzQXJyYXkoIHcud3BiY19iZmJfc2V0dGluZ3NfdmFycy5mb3JtX3N0eWxlX29wdGlvbl9rZXlzIClcblx0XHRcdD8gdy53cGJjX2JmYl9zZXR0aW5nc192YXJzLmZvcm1fc3R5bGVfb3B0aW9uX2tleXNcblx0XHRcdDogW107XG5cblx0XHRyZXR1cm4gbG9jYWxpemVkLmxlbmd0aCA/IGxvY2FsaXplZCA6IGZhbGxiYWNrX2Zvcm1fc3R5bGVfb3B0aW9uX2tleXM7XG5cdH1cblxuXHRmdW5jdGlvbiBzdHJpcF9mb3JtX3N0eWxlX29wdGlvbnNfZnJvbV9wYWNrKHNldHRpbmdzX3BhY2spIHtcblx0XHRpZiAoIXNldHRpbmdzX3BhY2sgfHwgdHlwZW9mIHNldHRpbmdzX3BhY2sgIT09ICdvYmplY3QnKSByZXR1cm4gc2V0dGluZ3NfcGFjaztcblx0XHRpZiAoIXNldHRpbmdzX3BhY2sub3B0aW9ucyB8fCB0eXBlb2Ygc2V0dGluZ3NfcGFjay5vcHRpb25zICE9PSAnb2JqZWN0JykgcmV0dXJuIHNldHRpbmdzX3BhY2s7XG5cblx0XHRnZXRfZm9ybV9zdHlsZV9vcHRpb25fa2V5cygpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuXHRcdFx0ZGVsZXRlIHNldHRpbmdzX3BhY2sub3B0aW9uc1trZXldO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHNldHRpbmdzX3BhY2s7XG5cdH1cblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gUm93IHNldHRlclxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdGZ1bmN0aW9uIHNldF92YWx1ZV9mb3Jfcm93KHJvdywgdmFsdWUsIG9wdHMpIHtcclxuXHRcdGlmICghcm93KSByZXR1cm47XHJcblxyXG5cdFx0Y29uc3Qgcm93X3R5cGUgPSBTdHJpbmcocm93LmdldEF0dHJpYnV0ZSgnZGF0YS10eXBlJykgfHwgJycpO1xyXG5cdFx0Y29uc3Qgcm93X2tleSAgPSBTdHJpbmcocm93LmdldEF0dHJpYnV0ZSgnZGF0YS1rZXknKSB8fCAnJyk7XHJcblx0XHRjb25zdCBkb190cmlnZ2VyX2V2ZW50cyA9ICEhKG9wdHMgJiYgb3B0cy50cmlnZ2VyX2NoYW5nZSk7XHJcblxyXG5cdFx0aWYgKCFyb3dfa2V5KSByZXR1cm47XHJcblxyXG5cdFx0Ly8gUmFkaW8gZ3JvdXBcclxuXHRcdGlmIChyb3dfdHlwZSA9PT0gJ3JhZGlvJykge1xyXG5cdFx0XHRjb25zdCB3cmFwID0gcm93LnF1ZXJ5U2VsZWN0b3IoJy53cGJjX2JmYl9fZm9ybV9zZXR0aW5nX3JhZGlvW2RhdGEtd3BiYy1iZmItZnMtY29udHJvbGlkXScpO1xyXG5cdFx0XHRjb25zdCBjb250cm9sX2lkID0gd3JhcCA/IFN0cmluZyh3cmFwLmdldEF0dHJpYnV0ZSgnZGF0YS13cGJjLWJmYi1mcy1jb250cm9saWQnKSB8fCAnJykgOiAnJztcclxuXHRcdFx0aWYgKCFjb250cm9sX2lkKSByZXR1cm47XHJcblxyXG5cdFx0XHRjb25zdCB0YXJnZXRfdmFsdWUgPSBTdHJpbmcodmFsdWUgPT0gbnVsbCA/ICcnIDogdmFsdWUpO1xyXG5cdFx0XHRjb25zdCByYWRpb3MgPSBxdWVyeV9hbGwocm93LCAnaW5wdXRbdHlwZT1cInJhZGlvXCJdW25hbWU9XCInICsgY3NzX2VzY2FwZShjb250cm9sX2lkKSArICdcIl0nKTtcclxuXHJcblx0XHRcdGxldCBjaGVja2VkX3JhZGlvID0gbnVsbDtcblx0XHRcdHJhZGlvcy5mb3JFYWNoKGZ1bmN0aW9uIChyYWRpbykge1xuXHRcdFx0XHRjb25zdCBzaG91bGRfY2hlY2sgPSAoU3RyaW5nKHJhZGlvLnZhbHVlKSA9PT0gdGFyZ2V0X3ZhbHVlKTtcblx0XHRcdFx0cmFkaW8uY2hlY2tlZCA9IHNob3VsZF9jaGVjaztcblx0XHRcdFx0aWYgKHNob3VsZF9jaGVjaykgY2hlY2tlZF9yYWRpbyA9IHJhZGlvO1xuXG5cdFx0XHRcdGNvbnN0IGNob2ljZSA9IHJhZGlvLmNsb3Nlc3QgPyByYWRpby5jbG9zZXN0KCcud3BiY190aGVtZV9jaG9pY2UnKSA6IG51bGw7XG5cdFx0XHRcdGlmICggY2hvaWNlICkge1xuXHRcdFx0XHRcdGNob2ljZS5jbGFzc0xpc3QudG9nZ2xlKCdpcy1zZWxlY3RlZCcsIHNob3VsZF9jaGVjayk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHJcblx0XHRcdGlmICh3cmFwKSBzZXRfaW5pdGlhbF9hdHRyKHdyYXAsIHRhcmdldF92YWx1ZSk7XHJcblx0XHRcdGlmIChkb190cmlnZ2VyX2V2ZW50cyAmJiBjaGVja2VkX3JhZGlvKSB0cmlnZ2VyX2NoYW5nZShjaGVja2VkX3JhZGlvKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFRvZ2dsZVxyXG5cdFx0aWYgKHJvd190eXBlID09PSAndG9nZ2xlJykge1xyXG5cdFx0XHRjb25zdCBjaGVja2JveCA9XHJcblx0XHRcdFx0cm93LnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W3R5cGU9XCJjaGVja2JveFwiXVtkYXRhLXdwYmMtYmZiLWZzLXR5cGU9XCJ0b2dnbGVcIl0nKSB8fFxyXG5cdFx0XHRcdHJvdy5xdWVyeVNlbGVjdG9yKCdpbnB1dFt0eXBlPVwiY2hlY2tib3hcIl0nKTtcclxuXHJcblx0XHRcdGlmICghY2hlY2tib3gpIHJldHVybjtcclxuXHJcblx0XHRcdGNvbnN0IGNoZWNrZWQgPSBpc19vbih2YWx1ZSk7XHJcblx0XHRcdGNoZWNrYm94LmNoZWNrZWQgPSBjaGVja2VkO1xyXG5cdFx0XHRjaGVja2JveC5zZXRBdHRyaWJ1dGUoJ2FyaWEtY2hlY2tlZCcsIGNoZWNrZWQgPyAndHJ1ZScgOiAnZmFsc2UnKTtcclxuXHJcblx0XHRcdHNldF9pbml0aWFsX2F0dHIoY2hlY2tib3gsIGNoZWNrZWQgPyAnT24nIDogJ09mZicpO1xyXG5cdFx0XHRpZiAoZG9fdHJpZ2dlcl9ldmVudHMpIHRyaWdnZXJfY2hhbmdlKGNoZWNrYm94KTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFNlbGVjdFxyXG5cdFx0aWYgKHJvd190eXBlID09PSAnc2VsZWN0Jykge1xyXG5cdFx0XHRjb25zdCBzZWxlY3QgPVxyXG5cdFx0XHRcdHJvdy5xdWVyeVNlbGVjdG9yKCdzZWxlY3RbZGF0YS13cGJjLWJmYi1mcy10eXBlPVwic2VsZWN0XCJdJykgfHxcclxuXHRcdFx0XHRyb3cucXVlcnlTZWxlY3Rvcignc2VsZWN0Jyk7XHJcblxyXG5cdFx0XHRpZiAoIXNlbGVjdCkgcmV0dXJuO1xyXG5cclxuXHRcdFx0c2VsZWN0LnZhbHVlID0gU3RyaW5nKHZhbHVlID09IG51bGwgPyAnJyA6IHZhbHVlKTtcclxuXHRcdFx0c2V0X2luaXRpYWxfYXR0cihzZWxlY3QsIHNlbGVjdC52YWx1ZSk7XHJcblx0XHRcdGlmIChkb190cmlnZ2VyX2V2ZW50cykgdHJpZ2dlcl9jaGFuZ2Uoc2VsZWN0KTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIExlbmd0aDogaGlkZGVuIGNvbWJpbmVkICsgbnVtL3VuaXRcblx0XHRpZiAoIHJvd190eXBlID09PSAnbGVuZ3RoJyApIHtcblx0XHRcdC8vIEpTIHNsaWRlciBsZW5ndGggY29udHJvbDogLSBoaWRkZW4gd3JpdGVyIGNhcnJpZXMgRlMgbWFya2VycyBhbmQgbXVzdCByZWNlaXZlIGlucHV0IGV2ZW50IHNvIHdwYmNfc2xpZGVyX2xlbl9ncm91cHMuanMgc3luY3MgVUkuXHJcblx0XHRcdGNvbnN0IHdyaXRlciA9XHJcblx0XHRcdFx0XHQgIHJvdy5xdWVyeVNlbGVjdG9yKCAnaW5wdXRbZGF0YS13cGJjX3NsaWRlcl9sZW5fd3JpdGVyXVtkYXRhLXdwYmMtYmZiLWZzLXR5cGU9XCJsZW5ndGhcIl0nICkgfHxcclxuXHRcdFx0XHRcdCAgcm93LnF1ZXJ5U2VsZWN0b3IoICdpbnB1dFtkYXRhLXdwYmMtYmZiLWZzLXR5cGU9XCJsZW5ndGhcIl0nICk7XHJcblx0XHRcdGlmICggIXdyaXRlciApIHJldHVybjtcclxuXHJcblx0XHRcdGNvbnN0IGNvbWJpbmVkID0gU3RyaW5nKCB2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSApO1xyXG5cdFx0XHR3cml0ZXIudmFsdWUgICA9IGNvbWJpbmVkO1xyXG5cdFx0XHRzZXRfaW5pdGlhbF9hdHRyKCB3cml0ZXIsIGNvbWJpbmVkICk7XHJcblx0XHRcdGlmICggZG9fdHJpZ2dlcl9ldmVudHMgKSB0cmlnZ2VyX2lucHV0KCB3cml0ZXIgKTtcclxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFNwYWNpbmc6IHR3byBudW1iZXIgaW5wdXRzIHNhdmVkIGludG8gYSBoaWRkZW4gQ1NTIHNob3J0aGFuZCB3cml0ZXIuXG5cdFx0aWYgKCByb3dfdHlwZSA9PT0gJ3NwYWNpbmcnICkge1xuXHRcdFx0Y29uc3QgZ3JvdXAgPSByb3cucXVlcnlTZWxlY3RvciggJy53cGJjX3NwYWNpbmdfZ3JvdXAnICk7XG5cdFx0XHRjb25zdCB2ZXJ0aWNhbF9pbnB1dCA9IGdyb3VwID8gZ3JvdXAucXVlcnlTZWxlY3RvciggJ2lucHV0W2RhdGEtd3BiY19zcGFjaW5nX3ZlcnRpY2FsXScgKSA6IG51bGw7XG5cdFx0XHRjb25zdCBob3Jpem9udGFsX2lucHV0ID0gZ3JvdXAgPyBncm91cC5xdWVyeVNlbGVjdG9yKCAnaW5wdXRbZGF0YS13cGJjX3NwYWNpbmdfaG9yaXpvbnRhbF0nICkgOiBudWxsO1xuXHRcdFx0Y29uc3Qgd3JpdGVyID0gZ3JvdXAgPyBncm91cC5xdWVyeVNlbGVjdG9yKCAnaW5wdXRbZGF0YS13cGJjX3NwYWNpbmdfd3JpdGVyXScgKSA6IG51bGw7XG5cdFx0XHRjb25zdCBwYXJzZWQgPSBwYXJzZV9zcGFjaW5nX3ZhbHVlKCB2YWx1ZSApO1xuXG5cdFx0XHRpZiAoICEgd3JpdGVyICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICggdmVydGljYWxfaW5wdXQgKSB7XG5cdFx0XHRcdHZlcnRpY2FsX2lucHV0LnZhbHVlID0gcGFyc2VkLnZlcnRpY2FsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBob3Jpem9udGFsX2lucHV0ICkge1xuXHRcdFx0XHRob3Jpem9udGFsX2lucHV0LnZhbHVlID0gcGFyc2VkLmhvcml6b250YWw7XG5cdFx0XHR9XG5cdFx0XHR3cml0ZXIudmFsdWUgPSBwYXJzZWQuY29tYmluZWQ7XG5cdFx0XHRzZXRfaW5pdGlhbF9hdHRyKCB3cml0ZXIsIHBhcnNlZC5jb21iaW5lZCApO1xuXHRcdFx0aWYgKCBkb190cmlnZ2VyX2V2ZW50cyApIHRyaWdnZXJfaW5wdXQoIHdyaXRlciApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFJhbmdlIChzbGlkZXIgbnVtYmVyKTogd3JpdGVyIGlzIHRoZSBudW1iZXIgaW5wdXQuXHJcblx0XHRpZiAocm93X3R5cGUgPT09ICdyYW5nZScpIHtcclxuXHRcdFx0Y29uc3Qgd3JpdGVyID1cclxuXHRcdFx0XHRyb3cucXVlcnlTZWxlY3RvcignaW5wdXRbZGF0YS13cGJjX3NsaWRlcl9yYW5nZV93cml0ZXJdJykgfHxcclxuXHRcdFx0XHRyb3cucXVlcnlTZWxlY3RvcignaW5wdXRbZGF0YS13cGJjLWJmYi1mcy1rZXk9XCInICsgY3NzX2VzY2FwZShyb3dfa2V5KSArICdcIl0nKSB8fFxyXG5cdFx0XHRcdHJvdy5xdWVyeVNlbGVjdG9yKCdpbnB1dFt0eXBlPVwibnVtYmVyXCJdJyk7XHJcblx0XHRcdGlmICghd3JpdGVyKSByZXR1cm47XHJcblxyXG5cdFx0XHR3cml0ZXIudmFsdWUgPSBTdHJpbmcodmFsdWUgPT0gbnVsbCA/ICcnIDogdmFsdWUpO1xyXG5cdFx0XHRzZXRfaW5pdGlhbF9hdHRyKHdyaXRlciwgd3JpdGVyLnZhbHVlKTtcclxuXHRcdFx0aWYgKGRvX3RyaWdnZXJfZXZlbnRzKSB0cmlnZ2VyX2lucHV0KHdyaXRlcik7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBEZWZhdWx0OiBpbnB1dC90ZXh0YXJlYVxyXG5cdFx0Y29uc3QgY29udHJvbCA9XHJcblx0XHRcdHJvdy5xdWVyeVNlbGVjdG9yKCdbZGF0YS13cGJjLWJmYi1mcy1rZXk9XCInICsgY3NzX2VzY2FwZShyb3dfa2V5KSArICdcIl0nKSB8fFxyXG5cdFx0XHRyb3cucXVlcnlTZWxlY3RvcignaW5wdXQsdGV4dGFyZWEnKTtcclxuXHJcblx0XHRpZiAoIWNvbnRyb2wpIHJldHVybjtcclxuXHJcblx0XHRjb250cm9sLnZhbHVlID0gU3RyaW5nKHZhbHVlID09IG51bGwgPyAnJyA6IHZhbHVlKTtcclxuXHRcdHNldF9pbml0aWFsX2F0dHIoY29udHJvbCwgY29udHJvbC52YWx1ZSk7XHJcblx0XHQvLyBGb3Igbm9ybWFsIGlucHV0cywgXCJpbnB1dFwiIGdpdmVzIGJldHRlciByZWFjdGl2aXR5IHRoYW4gXCJjaGFuZ2VcIi5cclxuXHRcdGlmIChkb190cmlnZ2VyX2V2ZW50cykgdHJpZ2dlcl9pbnB1dChjb250cm9sKTtcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gUHVibGljIEFQSVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdC8qKlxyXG5cdCAqIEFwcGx5IEZMQVQgb2JqZWN0IChrZXk9PnZhbHVlKSB0byByb3dzIG9mIHNvbWUgc2NvcGUuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gYXBwbHlfZmxhdF9zZXR0aW5ncyhmbGF0X3NldHRpbmdzLCBzY29wZSwgb3B0cykge1xyXG5cdFx0aWYgKCFmbGF0X3NldHRpbmdzIHx8IHR5cGVvZiBmbGF0X3NldHRpbmdzICE9PSAnb2JqZWN0JykgcmV0dXJuO1xyXG5cclxuXHRcdGZpbmRfcm93cyhzY29wZSkuZm9yRWFjaChmdW5jdGlvbiAocm93KSB7XHJcblx0XHRcdGNvbnN0IGtleSA9IFN0cmluZyhyb3cuZ2V0QXR0cmlidXRlKCdkYXRhLWtleScpIHx8ICcnKTtcclxuXHRcdFx0aWYgKCFrZXkpIHJldHVybjtcclxuXHRcdFx0aWYgKCFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZmxhdF9zZXR0aW5ncywga2V5KSkgcmV0dXJuO1xyXG5cdFx0XHRzZXRfdmFsdWVfZm9yX3Jvdyhyb3csIGZsYXRfc2V0dGluZ3Nba2V5XSwgb3B0cyk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFwcGx5IHNldHRpbmdzLlxyXG5cdCAqXHJcblx0ICogU3VwcG9ydHM6XHJcblx0ICogLSBmbGF0OiB7IGJvb2tpbmdfZm9ybV9sYXlvdXRfd2lkdGg6ICcxMDAlJywgLi4uIH1cclxuXHQgKiAtIHBhY2s6IHsgb3B0aW9uczogey4uLn0sIGNzc192YXJzOiB7Li4ufSB9ICAgKE9wdGlvbiBBKVxyXG5cdCAqL1xyXG5cdGFwaS5hcHBseSA9IGZ1bmN0aW9uIChzZXR0aW5nc19wYWNrLCBzY29wZSwgb3B0cykge1xuXHRcdGlmICghc2V0dGluZ3NfcGFjayB8fCB0eXBlb2Ygc2V0dGluZ3NfcGFjayAhPT0gJ29iamVjdCcpIHJldHVybjtcblx0XHRpZiAoIXNldHRpbmdzX3BhY2sub3B0aW9ucyB8fCB0eXBlb2Ygc2V0dGluZ3NfcGFjay5vcHRpb25zICE9PSAnb2JqZWN0JykgcmV0dXJuOyAvLyBzdHJpY3QgT3B0aW9uIEFcblx0XHRzdHJpcF9mb3JtX3N0eWxlX29wdGlvbnNfZnJvbV9wYWNrKHNldHRpbmdzX3BhY2spO1xuXHRcdGFwcGx5X2ZsYXRfc2V0dGluZ3Moc2V0dGluZ3NfcGFjay5vcHRpb25zLCBzY29wZSB8fCAnZm9ybScsIG9wdHMpO1xuXHR9O1xuXG5cdGFwaS5yZXNldF9jdXN0b21fYXBwZWFyYW5jZSA9IGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBkZWZhdWx0cyA9IGdldF9kZWZhdWx0X2N1c3RvbV9hcHBlYXJhbmNlX3NldHRpbmdzKCk7XG5cblx0XHRpZiAoICEgbGFzdF9zZXR0aW5nc19wYWNrIHx8IHR5cGVvZiBsYXN0X3NldHRpbmdzX3BhY2sgIT09ICdvYmplY3QnICkge1xuXHRcdFx0bGFzdF9zZXR0aW5nc19wYWNrID0geyBvcHRpb25zOiB7fSwgY3NzX3ZhcnM6IHt9IH07XG5cdFx0fVxuXHRcdGlmICggISBsYXN0X3NldHRpbmdzX3BhY2sub3B0aW9ucyB8fCB0eXBlb2YgbGFzdF9zZXR0aW5nc19wYWNrLm9wdGlvbnMgIT09ICdvYmplY3QnICkge1xuXHRcdFx0bGFzdF9zZXR0aW5nc19wYWNrLm9wdGlvbnMgPSB7fTtcblx0XHR9XG5cdFx0T2JqZWN0LmtleXMoIGRlZmF1bHRzICkuZm9yRWFjaCggZnVuY3Rpb24gKGtleSkge1xuXHRcdFx0bGFzdF9zZXR0aW5nc19wYWNrLm9wdGlvbnNba2V5XSA9IGRlZmF1bHRzW2tleV07XG5cdFx0fSApO1xuXG5cdFx0YXBwbHlfZmxhdF9zZXR0aW5ncyggZGVmYXVsdHMsICdnbG9iYWwnLCB7IHRyaWdnZXJfY2hhbmdlOiB0cnVlIH0gKTtcblx0XHRpbml0X2NvbG9yaXNfcGlja2VycyggZCApO1xuXG5cdFx0aWYgKCB3LldQQkNfQkZCX1NldHRpbmdzX0VmZmVjdHMgJiYgdHlwZW9mIHcuV1BCQ19CRkJfU2V0dGluZ3NfRWZmZWN0cy5hcHBseV9hbGwgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHR3LldQQkNfQkZCX1NldHRpbmdzX0VmZmVjdHMuYXBwbHlfYWxsKCBkZWZhdWx0cywgeyBzb3VyY2U6ICdyZXNldC1jdXN0b20tYXBwZWFyYW5jZScsIG9wdGlvbnM6IGRlZmF1bHRzIH0gKTtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0ZC5kaXNwYXRjaEV2ZW50KCBuZXcgQ3VzdG9tRXZlbnQoICd3cGJjOmJmYjpmb3JtX3NldHRpbmdzOmNoYW5nZWQnLCB7XG5cdFx0XHRcdGJ1YmJsZXM6IHRydWUsXG5cdFx0XHRcdGRldGFpbCA6IHtcblx0XHRcdFx0XHRzb3VyY2UgIDogJ3Jlc2V0LWN1c3RvbS1hcHBlYXJhbmNlJyxcblx0XHRcdFx0XHRzZXR0aW5nczogeyBvcHRpb25zOiBPYmplY3QuYXNzaWduKCB7fSwgZGVmYXVsdHMgKSB9XG5cdFx0XHRcdH1cblx0XHRcdH0gKSApO1xuXHRcdH0gY2F0Y2ggKCBfZSApIHt9XG5cdH07XG5cclxuXHQvKipcclxuXHQgKiBDb2xsZWN0IGN1cnJlbnQgdmFsdWVzIChmbGF0IG9iamVjdCkuXHJcblx0ICovXHJcblx0YXBpLmNvbGxlY3QgPSBmdW5jdGlvbiAoc2NvcGUpIHtcclxuXHRcdGNvbnN0IG91dCA9IHt9O1xyXG5cclxuXHRcdGZpbmRfcm93cyhzY29wZSB8fCAnZm9ybScpLmZvckVhY2goZnVuY3Rpb24gKHJvdykge1xyXG5cdFx0XHRjb25zdCBrZXkgID0gU3RyaW5nKHJvdy5nZXRBdHRyaWJ1dGUoJ2RhdGEta2V5JykgfHwgJycpO1xyXG5cdFx0XHRjb25zdCB0eXBlID0gU3RyaW5nKHJvdy5nZXRBdHRyaWJ1dGUoJ2RhdGEtdHlwZScpIHx8ICcnKTtcclxuXHRcdFx0aWYgKCFrZXkpIHJldHVybjtcclxuXHJcblx0XHRcdGlmICh0eXBlID09PSAncmFkaW8nKSB7XHJcblx0XHRcdFx0Y29uc3Qgd3JhcCA9IHJvdy5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX2Zvcm1fc2V0dGluZ19yYWRpb1tkYXRhLXdwYmMtYmZiLWZzLWNvbnRyb2xpZF0nKTtcclxuXHRcdFx0XHRjb25zdCBjb250cm9sX2lkID0gd3JhcCA/IFN0cmluZyh3cmFwLmdldEF0dHJpYnV0ZSgnZGF0YS13cGJjLWJmYi1mcy1jb250cm9saWQnKSB8fCAnJykgOiAnJztcclxuXHRcdFx0XHRpZiAoIWNvbnRyb2xfaWQpIHJldHVybjtcclxuXHJcblx0XHRcdFx0Y29uc3QgY2hlY2tlZCA9IHJvdy5xdWVyeVNlbGVjdG9yKCdpbnB1dFt0eXBlPVwicmFkaW9cIl1bbmFtZT1cIicgKyBjc3NfZXNjYXBlKGNvbnRyb2xfaWQpICsgJ1wiXTpjaGVja2VkJyk7XHJcblx0XHRcdFx0b3V0W2tleV0gPSBjaGVja2VkID8gU3RyaW5nKGNoZWNrZWQudmFsdWUpIDogJyc7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAodHlwZSA9PT0gJ3RvZ2dsZScpIHtcclxuXHRcdFx0XHRjb25zdCBjaGVja2JveCA9XHJcblx0XHRcdFx0XHRyb3cucXVlcnlTZWxlY3RvcignaW5wdXRbdHlwZT1cImNoZWNrYm94XCJdW2RhdGEtd3BiYy1iZmItZnMtdHlwZT1cInRvZ2dsZVwiXScpIHx8XHJcblx0XHRcdFx0XHRyb3cucXVlcnlTZWxlY3RvcignaW5wdXRbdHlwZT1cImNoZWNrYm94XCJdJyk7XHJcblx0XHRcdFx0b3V0W2tleV0gPSBjaGVja2JveCAmJiBjaGVja2JveC5jaGVja2VkID8gJ09uJyA6ICdPZmYnO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKHR5cGUgPT09ICdzZWxlY3QnKSB7XHJcblx0XHRcdFx0Y29uc3Qgc2VsZWN0ID0gcm93LnF1ZXJ5U2VsZWN0b3IoJ3NlbGVjdCcpO1xyXG5cdFx0XHRcdG91dFtrZXldID0gc2VsZWN0ID8gU3RyaW5nKHNlbGVjdC52YWx1ZSkgOiAnJztcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICh0eXBlID09PSAnbGVuZ3RoJykge1xuXHRcdFx0XHRjb25zdCBoaWRkZW4gPSByb3cucXVlcnlTZWxlY3RvcignaW5wdXRbZGF0YS13cGJjLWJmYi1mcy10eXBlPVwibGVuZ3RoXCJdJyk7XG5cdFx0XHRcdG91dFtrZXldID0gaGlkZGVuID8gU3RyaW5nKGhpZGRlbi52YWx1ZSB8fCAnJykgOiAnJztcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodHlwZSA9PT0gJ3NwYWNpbmcnKSB7XG5cdFx0XHRcdG91dFtrZXldID0gZ2V0X3NwYWNpbmdfdmFsdWUocm93KTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodHlwZSA9PT0gJ3JhbmdlJykge1xyXG5cdFx0XHRcdGNvbnN0IHdyaXRlciA9XHJcblx0XHRcdFx0XHRyb3cucXVlcnlTZWxlY3RvcignaW5wdXRbZGF0YS13cGJjX3NsaWRlcl9yYW5nZV93cml0ZXJdJykgfHxcclxuXHRcdFx0XHRcdHJvdy5xdWVyeVNlbGVjdG9yKCdpbnB1dFt0eXBlPVwibnVtYmVyXCJdJykgfHxcclxuXHRcdFx0XHRcdHJvdy5xdWVyeVNlbGVjdG9yKCdpbnB1dFt0eXBlPVwicmFuZ2VcIl0nKTtcclxuXHRcdFx0XHRvdXRba2V5XSA9IHdyaXRlciA/IFN0cmluZyh3cml0ZXIudmFsdWUgfHwgJycpIDogJyc7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IGNvbnRyb2wgPSByb3cucXVlcnlTZWxlY3RvcignaW5wdXQsdGV4dGFyZWEnKTtcclxuXHRcdFx0b3V0W2tleV0gPSBjb250cm9sID8gU3RyaW5nKGNvbnRyb2wudmFsdWUgfHwgJycpIDogJyc7XHJcblx0XHR9KTtcclxuXHJcblx0XHRyZXR1cm4gb3V0O1xuXHR9O1xuXG5cdGZ1bmN0aW9uIHBhcnNlX3NwYWNpbmdfdmFsdWUodmFsdWUpIHtcblx0XHRjb25zdCBmYWxsYmFjayA9IHsgdmVydGljYWw6ICcxMCcsIGhvcml6b250YWw6ICczMCcsIGNvbWJpbmVkOiAnMTBweCAzMHB4JyB9O1xuXHRcdGNvbnN0IG1hdGNoZXMgPSBTdHJpbmcodmFsdWUgPT0gbnVsbCA/ICcnIDogdmFsdWUpLm1hdGNoKC8tP1xcZCsoPzpcXC5cXGQrKT8vZykgfHwgW107XG5cdFx0bGV0IHZlcnRpY2FsID0gbWF0Y2hlc1swXSAhPSBudWxsID8gU3RyaW5nKG1hdGNoZXNbMF0pIDogZmFsbGJhY2sudmVydGljYWw7XG5cdFx0bGV0IGhvcml6b250YWwgPSBtYXRjaGVzWzFdICE9IG51bGwgPyBTdHJpbmcobWF0Y2hlc1sxXSkgOiB2ZXJ0aWNhbDtcblxuXHRcdGlmIChpc05hTihOdW1iZXIodmVydGljYWwpKSkge1xuXHRcdFx0dmVydGljYWwgPSBmYWxsYmFjay52ZXJ0aWNhbDtcblx0XHR9XG5cdFx0aWYgKGlzTmFOKE51bWJlcihob3Jpem9udGFsKSkpIHtcblx0XHRcdGhvcml6b250YWwgPSBmYWxsYmFjay5ob3Jpem9udGFsO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHR2ZXJ0aWNhbCAgOiB2ZXJ0aWNhbCxcblx0XHRcdGhvcml6b250YWw6IGhvcml6b250YWwsXG5cdFx0XHRjb21iaW5lZCAgOiB2ZXJ0aWNhbCArICdweCAnICsgaG9yaXpvbnRhbCArICdweCdcblx0XHR9O1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0X3NwYWNpbmdfdmFsdWUocm93KSB7XG5cdFx0Y29uc3QgZ3JvdXAgPSByb3cgPyByb3cucXVlcnlTZWxlY3RvcignLndwYmNfc3BhY2luZ19ncm91cCcpIDogbnVsbDtcblx0XHRjb25zdCB2ZXJ0aWNhbF9pbnB1dCA9IGdyb3VwID8gZ3JvdXAucXVlcnlTZWxlY3RvcignaW5wdXRbZGF0YS13cGJjX3NwYWNpbmdfdmVydGljYWxdJykgOiBudWxsO1xuXHRcdGNvbnN0IGhvcml6b250YWxfaW5wdXQgPSBncm91cCA/IGdyb3VwLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W2RhdGEtd3BiY19zcGFjaW5nX2hvcml6b250YWxdJykgOiBudWxsO1xuXHRcdGNvbnN0IHdyaXRlciA9IGdyb3VwID8gZ3JvdXAucXVlcnlTZWxlY3RvcignaW5wdXRbZGF0YS13cGJjX3NwYWNpbmdfd3JpdGVyXScpIDogbnVsbDtcblx0XHRjb25zdCB2ZXJ0aWNhbCA9IHZlcnRpY2FsX2lucHV0ID8gU3RyaW5nKHZlcnRpY2FsX2lucHV0LnZhbHVlIHx8ICcwJykgOiAnMCc7XG5cdFx0Y29uc3QgaG9yaXpvbnRhbCA9IGhvcml6b250YWxfaW5wdXQgPyBTdHJpbmcoaG9yaXpvbnRhbF9pbnB1dC52YWx1ZSB8fCB2ZXJ0aWNhbCkgOiB2ZXJ0aWNhbDtcblx0XHRjb25zdCBjb21iaW5lZCA9IHBhcnNlX3NwYWNpbmdfdmFsdWUodmVydGljYWwgKyAncHggJyArIGhvcml6b250YWwgKyAncHgnKS5jb21iaW5lZDtcblxuXHRcdGlmICh3cml0ZXIpIHtcblx0XHRcdHdyaXRlci52YWx1ZSA9IGNvbWJpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiBjb21iaW5lZDtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZS1hcHBseSBsYXN0IHJlY2VpdmVkIHNldHRpbmdzICh1c2VmdWwgYWZ0ZXIgRE9NIHJlLXJlbmRlcikuXG5cdCAqL1xyXG5cdGFwaS5yZWFwcGx5X2xhc3QgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRpZiAoIWxhc3Rfc2V0dGluZ3NfcGFjaykgcmV0dXJuO1xyXG5cdFx0YXBpLmFwcGx5KGxhc3Rfc2V0dGluZ3NfcGFjaywgJ2Zvcm0nLCB7IHRyaWdnZXJfY2hhbmdlOiB0cnVlIH0pO1xyXG5cdH07XHJcblxyXG5cdGFwaS5pbml0ID0gZnVuY3Rpb24gKCkge1xuXHRcdGluaXRfY29sb3Jpc19waWNrZXJzKGQpO1xuXG5cdFx0Ly8gSWYgYXBwbHkgZXZlbnQgZmlyZWQgYmVmb3JlIGluaXQsIHRyeSBhZ2FpbiBub3cuXG5cdFx0aWYgKGxhc3Rfc2V0dGluZ3NfcGFjaykgc2NoZWR1bGVfYXBwbHlfcmV0cnkoKTtcblx0fTtcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRE9NIEV2ZW50cyAoQUpBWCBsYXllcilcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHQvLyBTYXZlOiBsZXQgbW9kdWxlcyBjb250cmlidXRlIGludG8geyBvcHRpb25zOnt9LCBjc3NfdmFyczp7fSB9XHJcblx0ZC5hZGRFdmVudExpc3RlbmVyKCd3cGJjOmJmYjpmb3JtX3NldHRpbmdzOmNvbGxlY3QnLCBmdW5jdGlvbiAoZSkge1xyXG5cdFx0Y29uc3QgZGV0YWlsID0gKGUgJiYgZS5kZXRhaWwpID8gZS5kZXRhaWwgOiB7fTtcclxuXHRcdGNvbnN0IHRhcmdldF9wYWNrID0gZGV0YWlsLnNldHRpbmdzO1xyXG5cclxuXHRcdGlmICghdGFyZ2V0X3BhY2sgfHwgdHlwZW9mIHRhcmdldF9wYWNrICE9PSAnb2JqZWN0JykgcmV0dXJuO1xyXG5cclxuXHRcdC8vIE9wdGlvbiBBOiB3cml0ZSBpbnRvIHRhcmdldF9wYWNrLm9wdGlvbnNcclxuXHRcdGlmICghdGFyZ2V0X3BhY2sub3B0aW9ucyB8fCB0eXBlb2YgdGFyZ2V0X3BhY2sub3B0aW9ucyAhPT0gJ29iamVjdCcpIHtcclxuXHRcdFx0dGFyZ2V0X3BhY2sub3B0aW9ucyA9IHt9O1xyXG5cdFx0fVxyXG5cclxuXHRcdGNvbnN0IGNvbGxlY3RlZCA9IGFwaS5jb2xsZWN0KCdmb3JtJyk7XG5cdFx0T2JqZWN0LmtleXMoY29sbGVjdGVkKS5mb3JFYWNoKGZ1bmN0aW9uIChrKSB7XG5cdFx0XHR0YXJnZXRfcGFjay5vcHRpb25zW2tdID0gY29sbGVjdGVkW2tdO1xuXHRcdH0pO1xuXHRcdHN0cmlwX2Zvcm1fc3R5bGVfb3B0aW9uc19mcm9tX3BhY2sodGFyZ2V0X3BhY2spO1xuXHR9KTtcblxyXG5cdC8vIExvYWQ6IHJlY2VpdmUgc2V0dGluZ3MgZnJvbSBBSkFYIGFuZCBhcHBseS5cclxuXHRkLmFkZEV2ZW50TGlzdGVuZXIoJ3dwYmM6YmZiOmZvcm1fc2V0dGluZ3M6YXBwbHknLCBmdW5jdGlvbiAoZSkge1xuXHRcdGNvbnN0IGRldGFpbCA9IChlICYmIGUuZGV0YWlsKSA/IGUuZGV0YWlsIDoge307XG5cblx0XHRsYXN0X3NldHRpbmdzX3BhY2sgPSBkZXRhaWwuc2V0dGluZ3MgfHwgbnVsbDtcblxuXHRcdHJldHJ5X2NvdW50ID0gMDtcblx0XHRzY2hlZHVsZV9hcHBseV9yZXRyeSgpO1xuXHR9KTtcblxuXHRkLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uIChlKSB7XG5cdFx0Y29uc3QgYnRuID0gZSAmJiBlLnRhcmdldCAmJiBlLnRhcmdldC5jbG9zZXN0ID8gZS50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYmZiLXJlc2V0LWN1c3RvbS1hcHBlYXJhbmNlXScgKSA6IG51bGw7XG5cdFx0aWYgKCAhIGJ0biApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0YXBpLnJlc2V0X2N1c3RvbV9hcHBlYXJhbmNlKCk7XG5cdH0sIGZhbHNlICk7XG5cclxuXHRmdW5jdGlvbiBzY2hlZHVsZV9hcHBseV9yZXRyeSgpIHtcclxuXHRcdGlmIChyYWZfaWQpIHJldHVybjtcclxuXHJcblx0XHRyYWZfaWQgPSB3LnJlcXVlc3RBbmltYXRpb25GcmFtZShmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHJhZl9pZCA9IDA7XHJcblxyXG5cdFx0XHQvLyBJZiBzZXR0aW5ncyBVSSBub3QgcHJlc2VudCB5ZXQsIHJldHJ5IGEgZmV3IGZyYW1lcy5cclxuXHRcdFx0aWYgKCFoYXNfYW55X3Jvd3MoKSkge1xyXG5cdFx0XHRcdHJldHJ5X2NvdW50Kys7XHJcblx0XHRcdFx0aWYgKHJldHJ5X2NvdW50IDwgcmV0cnlfbWF4KSBzY2hlZHVsZV9hcHBseV9yZXRyeSgpO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0YXBpLnJlYXBwbHlfbGFzdCgpO1xuXHRcdFx0aW5pdF9jb2xvcmlzX3BpY2tlcnMoZCk7XG5cdFx0fSk7XG5cdH1cblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gT3B0aW9uYWwgQnVpbGRlciB0aW1pbmcgaG9vayAoU1RSVUNUVVJFX0xPQURFRCkgLT4gcmVhcHBseV9sYXN0KClcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRmdW5jdGlvbiBiaW5kX2J1aWxkZXJfdGltaW5nX2hvb2soYnVpbGRlcl9pbnN0YW5jZSkge1xyXG5cdFx0Y29uc3QgY29yZSA9IHcuV1BCQ19CRkJfQ29yZTtcclxuXHRcdGNvbnN0IGV2ZW50cyA9IChjb3JlICYmIGNvcmUuV1BCQ19CRkJfRXZlbnRzKSA/IGNvcmUuV1BCQ19CRkJfRXZlbnRzIDogKHcuV1BCQ19CRkJfRXZlbnRzIHx8IG51bGwpO1xyXG5cclxuXHJcblx0XHRpZiAoIWJ1aWxkZXJfaW5zdGFuY2UgfHwgIWJ1aWxkZXJfaW5zdGFuY2UuYnVzIHx8ICFldmVudHMgfHwgIWV2ZW50cy5TVFJVQ1RVUkVfTE9BREVEKSByZXR1cm47XHJcblxyXG5cdFx0YnVpbGRlcl9pbnN0YW5jZS5idXMub24oZXZlbnRzLlNUUlVDVFVSRV9MT0FERUQsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0Ly8gQnVpbGRlciBtYXkgcmUtcmVuZGVyIHNldHRpbmdzIHBhbmVsIGFmdGVyIHN0cnVjdHVyZSBsb2FkLlxyXG5cdFx0XHQvLyBSZS1hcHBseSBsYXN0IHNldHRpbmdzIHBhY2sgKGlmIGFueSkuXHJcblx0XHRcdHJldHJ5X2NvdW50ID0gMDtcclxuXHRcdFx0c2NoZWR1bGVfYXBwbHlfcmV0cnkoKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0aWYgKHcud3BiY19iZmJfYXBpICYmIHcud3BiY19iZmJfYXBpLnJlYWR5ICYmIHR5cGVvZiB3LndwYmNfYmZiX2FwaS5yZWFkeS50aGVuID09PSAnZnVuY3Rpb24nKSB7XHJcblx0XHR3LndwYmNfYmZiX2FwaS5yZWFkeS50aGVuKGJpbmRfYnVpbGRlcl90aW1pbmdfaG9vayk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24gKCkgeyBpZiAody5fX0IpIHsgYmluZF9idWlsZGVyX3RpbWluZ19ob29rKCB3Ll9fQiApOyB9IH0sIDApO1xyXG5cdH1cclxuXHJcblx0Ly8gRE9NIHJlYWR5IGluaXQuXHJcblx0aWYgKGQucmVhZHlTdGF0ZSA9PT0gJ2xvYWRpbmcnKSBkLmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBhcGkuaW5pdCk7XHJcblx0ZWxzZSBhcGkuaW5pdCgpO1xyXG5cclxufSkod2luZG93LCBkb2N1bWVudCk7XHJcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBLENBQUMsVUFBVUEsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7RUFDaEIsWUFBWTs7RUFFWjtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLE1BQU1DLEdBQUcsR0FBSUYsQ0FBQyxDQUFDRyxxQkFBcUIsR0FBR0gsQ0FBQyxDQUFDRyxxQkFBcUIsSUFBSSxDQUFDLENBQUU7O0VBRXJFO0VBQ0EsSUFBSUMsa0JBQWtCLEdBQUcsSUFBSTs7RUFFN0I7RUFDQSxJQUFJQyxNQUFNLEdBQVEsQ0FBQztFQUNuQixJQUFJQyxXQUFXLEdBQUcsQ0FBQztFQUNuQixNQUFNQyxT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
