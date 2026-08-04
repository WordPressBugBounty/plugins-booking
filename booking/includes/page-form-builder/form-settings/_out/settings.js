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
  let pending_time_picker_skin_button = null;
  let previous_time_picker_skin_url = '';

  // Last received settings pack (from AJAX).
  let last_settings_pack = null;

  // Small retry, because DOM can be re-rendered after apply event.
  let raf_id = 0;
  let retry_count = 0;
  const retry_max = 20;
  const fallback_form_style_option_keys = ['booking_form_style', 'booking_form_accent_enabled', 'booking_form_accent_color', 'booking_form_custom_background_color', 'booking_form_custom_border_color', 'booking_form_custom_border_width', 'booking_form_custom_border_radius', 'booking_form_custom_padding_vertical', 'booking_form_custom_padding_horizontal', 'booking_form_custom_text_color', 'booking_form_custom_field_background_color', 'booking_form_custom_field_text_color', 'booking_form_custom_field_border_color', 'booking_form_custom_button_background_color', 'booking_form_custom_button_text_color', 'booking_form_custom_button_border_color', 'booking_form_custom_button_hover_background_color', 'booking_form_custom_button_hover_text_color', 'booking_form_custom_button_hover_border_color', 'booking_form_custom_secondary_button_background_color', 'booking_form_custom_secondary_button_text_color', 'booking_form_custom_secondary_button_border_color', 'booking_form_custom_secondary_button_hover_background_color', 'booking_form_custom_secondary_button_hover_text_color', 'booking_form_custom_secondary_button_hover_border_color', 'booking_form_custom_button_border_width', 'booking_form_custom_button_border_radius', 'booking_form_theme', 'booking_form_container_style', 'booking_form_background_color', 'booking_form_border_color', 'booking_form_border_width', 'booking_form_border_radius', 'booking_form_padding', 'booking_form_text_color', 'booking_form_field_background_color', 'booking_form_field_text_color', 'booking_form_field_border_color'];

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
    const localized_custom_style = w.wpbc_bfb_settings_vars && w.wpbc_bfb_settings_vars.custom_form_style_defaults ? w.wpbc_bfb_settings_vars.custom_form_style_defaults : {};
    const localized_form_accent = w.wpbc_bfb_settings_vars && w.wpbc_bfb_settings_vars.form_accent_defaults ? w.wpbc_bfb_settings_vars.form_accent_defaults : {};
    return Object.assign({
      booking_form_accent_enabled: 'Off',
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
    }, localized_custom_style, localized_form_accent);
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

  /**
   * Switch the global time-picker skin to the form-aware Automatic skin.
   *
   * The option is saved through the existing nonce-protected option saver.
   * Legacy skins are changed only by this explicit user action.
   *
   * @param {HTMLButtonElement} button Accent action button.
   * @returns {boolean} Whether an AJAX option save was started.
   */
  function switch_time_picker_to_automatic(button) {
    const automatic_skin = '/css/time_picker_skins/form_style.css';
    const current_skin = button ? String(button.getAttribute('data-wpbc-time-picker-skin-current') || '') : '';
    const automatic_url = button ? String(button.getAttribute('data-wpbc-time-picker-skin-url') || '') : '';
    if (!button || current_skin.slice(-automatic_skin.length) === automatic_skin) {
      return false;
    }
    if (typeof w.wpbc_save_option_from_element !== 'function') {
      return false;
    }
    const time_api = w.WPBC_BFB_Core && w.WPBC_BFB_Core.Time ? w.WPBC_BFB_Core.Time : null;
    if (automatic_url) {
      previous_time_picker_skin_url = d.getElementById('wpbc-time_picker-skin-css') ? String(d.getElementById('wpbc-time_picker-skin-css').getAttribute('href') || '') : '';
      if (time_api && typeof time_api.apply_picker_skin_url === 'function') {
        time_api.apply_picker_skin_url(automatic_url);
      } else if (typeof w.wpbc__css__change_skin === 'function' && d.getElementById('wpbc-time_picker-skin-css')) {
        w.wpbc__css__change_skin(automatic_url, 'wpbc-time_picker-skin-css');
      }
    }
    pending_time_picker_skin_button = button;
    button.setAttribute('data-wpbc-u-save-value', automatic_skin);
    w.wpbc_save_option_from_element(button);
    return true;
  }

  /**
   * Mark the Automatic skin as current after the option saver confirms it.
   *
   * @returns {void}
   */
  w.wpbc_bfb_time_picker_skin_saved = function () {
    if (pending_time_picker_skin_button) {
      pending_time_picker_skin_button.setAttribute('data-wpbc-time-picker-skin-current', '/css/time_picker_skins/form_style.css');
    }
    if (w.WPBC_BFB_Core && w.WPBC_BFB_Core.Time && typeof w.WPBC_BFB_Core.Time.ui_set_picker_skin_value === 'function') {
      w.WPBC_BFB_Core.Time.ui_set_picker_skin_value('/css/time_picker_skins/form_style.css');
    }
    pending_time_picker_skin_button = null;
    previous_time_picker_skin_url = '';
  };
  if (w.jQuery) {
    w.jQuery(d).on('wpbc:option:afterSave.wpbcBfbTimePickerSkin', function (event, response) {
      if (!pending_time_picker_skin_button || response && response.success) {
        return;
      }
      const previous_skin = String(pending_time_picker_skin_button.getAttribute('data-wpbc-time-picker-skin-current') || '');
      const time_api = w.WPBC_BFB_Core && w.WPBC_BFB_Core.Time ? w.WPBC_BFB_Core.Time : null;
      if (previous_time_picker_skin_url && time_api && typeof time_api.apply_picker_skin_url === 'function') {
        time_api.apply_picker_skin_url(previous_time_picker_skin_url);
      } else if (previous_time_picker_skin_url && typeof w.wpbc__css__change_skin === 'function') {
        w.wpbc__css__change_skin(previous_time_picker_skin_url, 'wpbc-time_picker-skin-css');
      }
      if (w.WPBC_BFB_Core && w.WPBC_BFB_Core.Time && typeof w.WPBC_BFB_Core.Time.ui_set_picker_skin_value === 'function') {
        w.WPBC_BFB_Core.Time.ui_set_picker_skin_value(previous_skin);
      }
      pending_time_picker_skin_button = null;
      previous_time_picker_skin_url = '';
    });
  }

  /**
   * Ask accent-capable field packs to copy the current accent into their
   * existing editable color properties. Field packs update the counters.
   *
   * @param {HTMLButtonElement} button Action button.
   * @returns {void}
   */
  api.apply_accent_to_components = function (button) {
    const toggle = d.getElementById('booking_form_accent_enabled');
    const color_control = d.getElementById('booking_form_accent_color');
    const status = d.querySelector('[data-wpbc-bfb-accent-components-status="1"]');
    const i18n = w.wpbc_bfb_settings_vars && w.wpbc_bfb_settings_vars.i18n ? w.wpbc_bfb_settings_vars.i18n : {};
    const default_appearance = get_default_custom_appearance_settings();
    const accent_color = color_control && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(color_control.value || '').trim()) ? String(color_control.value).trim() : String(default_appearance.booking_form_accent_color || '').trim();
    if (!toggle || !toggle.checked) {
      if (status) {
        status.textContent = i18n.accent_enable_first || 'Enable Custom accent color first.';
      }
      return;
    }
    if (button) {
      button.disabled = true;
    }
    const apply_to_builder = function (builder) {
      const detail = {
        accent_color: accent_color,
        builder: builder || w.wpbc_bfb || null,
        matched: 0,
        updated: 0
      };
      try {
        d.dispatchEvent(new CustomEvent('wpbc:bfb:apply-accent-to-components', {
          bubbles: true,
          detail: detail
        }));
      } catch (_e) {}
      const time_picker_save_started = switch_time_picker_to_automatic(button);
      if (status) {
        if (detail.updated > 0) {
          status.textContent = 1 === detail.updated ? i18n.accent_applied_one || 'Accent applied to one form element. Save Form to keep the change.' : String(i18n.accent_applied_many || 'Accent applied to %d form elements. Save Form to keep the changes.').replace('%d', String(detail.updated));
        } else if (detail.matched > 0) {
          status.textContent = i18n.accent_already_applied || 'All supported form elements already have the current accent color.';
        } else {
          status.textContent = i18n.accent_no_elements || 'No accent-capable form elements were found.';
        }
        if (time_picker_save_started) {
          status.textContent += ' ' + (i18n.accent_time_picker_automatic || 'Time slots now use Automatic — Match Booking Form.');
        }
      }
      if (detail.updated > 0) {
        try {
          d.dispatchEvent(new CustomEvent('wpbc:bfb:structure:change', {
            bubbles: true,
            detail: {
              source: 'apply-accent-to-components',
              updated: detail.updated
            }
          }));
        } catch (_e2) {}
      }
      if (detail.builder && typeof detail.builder._announce === 'function') {
        detail.builder._announce(status ? status.textContent : i18n.accent_applied_announcement || 'Form accent applied.');
      }
      if (button && !time_picker_save_started) {
        button.disabled = false;
      }
    };
    if (w.wpbc_bfb_api && w.wpbc_bfb_api.ready && typeof w.wpbc_bfb_api.ready.then === 'function') {
      w.wpbc_bfb_api.ready.then(apply_to_builder);
      return;
    }
    apply_to_builder(w.wpbc_bfb || null);
  };
  d.addEventListener('click', function (e) {
    const btn = e && e.target && e.target.closest ? e.target.closest('[data-wpbc-bfb-apply-accent-components="1"]') : null;
    if (!btn) {
      return;
    }
    e.preventDefault();
    api.apply_accent_to_components(btn);
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZm9ybS1zZXR0aW5ncy9fb3V0L3NldHRpbmdzLmpzIiwibmFtZXMiOlsidyIsImQiLCJhcGkiLCJXUEJDX0JGQl9Gb3JtU2V0dGluZ3MiLCJwZW5kaW5nX3RpbWVfcGlja2VyX3NraW5fYnV0dG9uIiwicHJldmlvdXNfdGltZV9waWNrZXJfc2tpbl91cmwiLCJsYXN0X3NldHRpbmdzX3BhY2siLCJyYWZfaWQiLCJyZXRyeV9jb3VudCIsInJldHJ5X21heCIsImZhbGxiYWNrX2Zvcm1fc3R5bGVfb3B0aW9uX2tleXMiLCJxdWVyeV9hbGwiLCJyb290Iiwic2VsZWN0b3IiLCJBcnJheSIsImZyb20iLCJxdWVyeVNlbGVjdG9yQWxsIiwiY3NzX2VzY2FwZSIsInZhbHVlIiwidiIsIlN0cmluZyIsIkNTUyIsImVzY2FwZSIsInJlcGxhY2UiLCJpc19vbiIsInRyaW0iLCJ0b0xvd2VyQ2FzZSIsInNldF9pbml0aWFsX2F0dHIiLCJlbCIsInNldEF0dHJpYnV0ZSIsInRyaWdnZXJfY2hhbmdlIiwiZGlzcGF0Y2hFdmVudCIsIkV2ZW50IiwiYnViYmxlcyIsIl8iLCJ0cmlnZ2VyX2lucHV0IiwiZmluZF9yb3dzIiwic2NvcGUiLCJyb3dzIiwiZmlsdGVyIiwicm93IiwiZ2V0QXR0cmlidXRlIiwiaGFzX2FueV9yb3dzIiwibGVuZ3RoIiwiaW5pdF9jb2xvcmlzX3BpY2tlcnMiLCJDb2xvcmlzIiwiaW5wdXRzIiwiZm9yRWFjaCIsImlucHV0IiwiY2xhc3NMaXN0IiwiY29udGFpbnMiLCJhZGQiLCJhbHBoYSIsImZvcm1hdCIsInRoZW1lTW9kZSIsIm9uQ2hhbmdlIiwiY29sb3IiLCJDdXN0b21FdmVudCIsImRldGFpbCIsImN1cnJlbnRFbCIsIl9lIiwiZSIsImNvbnNvbGUiLCJ3YXJuIiwiZ2V0X2RlZmF1bHRfY3VzdG9tX2FwcGVhcmFuY2Vfc2V0dGluZ3MiLCJsb2NhbGl6ZWRfY3VzdG9tX3N0eWxlIiwid3BiY19iZmJfc2V0dGluZ3NfdmFycyIsImN1c3RvbV9mb3JtX3N0eWxlX2RlZmF1bHRzIiwibG9jYWxpemVkX2Zvcm1fYWNjZW50IiwiZm9ybV9hY2NlbnRfZGVmYXVsdHMiLCJPYmplY3QiLCJhc3NpZ24iLCJib29raW5nX2Zvcm1fYWNjZW50X2VuYWJsZWQiLCJib29raW5nX2Zvcm1fY3VzdG9tX2JhY2tncm91bmRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX3dpZHRoIiwiYm9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfcmFkaXVzIiwiYm9va2luZ19mb3JtX2N1c3RvbV9wYWRkaW5nX3ZlcnRpY2FsIiwiYm9va2luZ19mb3JtX2N1c3RvbV9wYWRkaW5nX2hvcml6b250YWwiLCJib29raW5nX2Zvcm1fY3VzdG9tX3RleHRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JhY2tncm91bmRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX3RleHRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX2ZpZWxkX2JvcmRlcl9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JhY2tncm91bmRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl90ZXh0X2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYm9yZGVyX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfYmFja2dyb3VuZF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX3RleHRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl9ib3JkZXJfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fYmFja2dyb3VuZF9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl90ZXh0X2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2JvcmRlcl9jb2xvciIsImJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl9iYWNrZ3JvdW5kX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX3RleHRfY29sb3IiLCJib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfYm9yZGVyX2NvbG9yIiwiYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYm9yZGVyX3dpZHRoIiwiYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYm9yZGVyX3JhZGl1cyIsImdldF9mb3JtX3N0eWxlX29wdGlvbl9rZXlzIiwibG9jYWxpemVkIiwiaXNBcnJheSIsImZvcm1fc3R5bGVfb3B0aW9uX2tleXMiLCJzdHJpcF9mb3JtX3N0eWxlX29wdGlvbnNfZnJvbV9wYWNrIiwic2V0dGluZ3NfcGFjayIsIm9wdGlvbnMiLCJrZXkiLCJzZXRfdmFsdWVfZm9yX3JvdyIsIm9wdHMiLCJyb3dfdHlwZSIsInJvd19rZXkiLCJkb190cmlnZ2VyX2V2ZW50cyIsIndyYXAiLCJxdWVyeVNlbGVjdG9yIiwiY29udHJvbF9pZCIsInRhcmdldF92YWx1ZSIsInJhZGlvcyIsImNoZWNrZWRfcmFkaW8iLCJyYWRpbyIsInNob3VsZF9jaGVjayIsImNoZWNrZWQiLCJjaG9pY2UiLCJjbG9zZXN0IiwidG9nZ2xlIiwiY2hlY2tib3giLCJzZWxlY3QiLCJ3cml0ZXIiLCJjb21iaW5lZCIsImdyb3VwIiwidmVydGljYWxfaW5wdXQiLCJob3Jpem9udGFsX2lucHV0IiwicGFyc2VkIiwicGFyc2Vfc3BhY2luZ192YWx1ZSIsInZlcnRpY2FsIiwiaG9yaXpvbnRhbCIsImNvbnRyb2wiLCJhcHBseV9mbGF0X3NldHRpbmdzIiwiZmxhdF9zZXR0aW5ncyIsInByb3RvdHlwZSIsImhhc093blByb3BlcnR5IiwiY2FsbCIsImFwcGx5IiwicmVzZXRfY3VzdG9tX2FwcGVhcmFuY2UiLCJkZWZhdWx0cyIsImNzc192YXJzIiwia2V5cyIsIldQQkNfQkZCX1NldHRpbmdzX0VmZmVjdHMiLCJhcHBseV9hbGwiLCJzb3VyY2UiLCJzZXR0aW5ncyIsImNvbGxlY3QiLCJvdXQiLCJ0eXBlIiwiaGlkZGVuIiwiZ2V0X3NwYWNpbmdfdmFsdWUiLCJmYWxsYmFjayIsIm1hdGNoZXMiLCJtYXRjaCIsImlzTmFOIiwiTnVtYmVyIiwicmVhcHBseV9sYXN0IiwiaW5pdCIsInNjaGVkdWxlX2FwcGx5X3JldHJ5IiwiYWRkRXZlbnRMaXN0ZW5lciIsInRhcmdldF9wYWNrIiwiY29sbGVjdGVkIiwiayIsImJ0biIsInRhcmdldCIsInByZXZlbnREZWZhdWx0Iiwic3dpdGNoX3RpbWVfcGlja2VyX3RvX2F1dG9tYXRpYyIsImJ1dHRvbiIsImF1dG9tYXRpY19za2luIiwiY3VycmVudF9za2luIiwiYXV0b21hdGljX3VybCIsInNsaWNlIiwid3BiY19zYXZlX29wdGlvbl9mcm9tX2VsZW1lbnQiLCJ0aW1lX2FwaSIsIldQQkNfQkZCX0NvcmUiLCJUaW1lIiwiZ2V0RWxlbWVudEJ5SWQiLCJhcHBseV9waWNrZXJfc2tpbl91cmwiLCJ3cGJjX19jc3NfX2NoYW5nZV9za2luIiwid3BiY19iZmJfdGltZV9waWNrZXJfc2tpbl9zYXZlZCIsInVpX3NldF9waWNrZXJfc2tpbl92YWx1ZSIsImpRdWVyeSIsIm9uIiwiZXZlbnQiLCJyZXNwb25zZSIsInN1Y2Nlc3MiLCJwcmV2aW91c19za2luIiwiYXBwbHlfYWNjZW50X3RvX2NvbXBvbmVudHMiLCJjb2xvcl9jb250cm9sIiwic3RhdHVzIiwiaTE4biIsImRlZmF1bHRfYXBwZWFyYW5jZSIsImFjY2VudF9jb2xvciIsInRlc3QiLCJib29raW5nX2Zvcm1fYWNjZW50X2NvbG9yIiwidGV4dENvbnRlbnQiLCJhY2NlbnRfZW5hYmxlX2ZpcnN0IiwiZGlzYWJsZWQiLCJhcHBseV90b19idWlsZGVyIiwiYnVpbGRlciIsIndwYmNfYmZiIiwibWF0Y2hlZCIsInVwZGF0ZWQiLCJ0aW1lX3BpY2tlcl9zYXZlX3N0YXJ0ZWQiLCJhY2NlbnRfYXBwbGllZF9vbmUiLCJhY2NlbnRfYXBwbGllZF9tYW55IiwiYWNjZW50X2FscmVhZHlfYXBwbGllZCIsImFjY2VudF9ub19lbGVtZW50cyIsImFjY2VudF90aW1lX3BpY2tlcl9hdXRvbWF0aWMiLCJfZTIiLCJfYW5ub3VuY2UiLCJhY2NlbnRfYXBwbGllZF9hbm5vdW5jZW1lbnQiLCJ3cGJjX2JmYl9hcGkiLCJyZWFkeSIsInRoZW4iLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJiaW5kX2J1aWxkZXJfdGltaW5nX2hvb2siLCJidWlsZGVyX2luc3RhbmNlIiwiY29yZSIsImV2ZW50cyIsIldQQkNfQkZCX0V2ZW50cyIsImJ1cyIsIlNUUlVDVFVSRV9MT0FERUQiLCJzZXRUaW1lb3V0IiwiX19CIiwicmVhZHlTdGF0ZSIsIndpbmRvdyIsImRvY3VtZW50Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZm9ybS1zZXR0aW5ncy9fc3JjL3NldHRpbmdzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbHMgd2luZG93LCBkb2N1bWVudCAqL1xyXG4oZnVuY3Rpb24gKHcsIGQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdC8qKlxyXG5cdCAqIEJGQiBGb3JtIFNldHRpbmdzIFVJIGJyaWRnZS5cclxuXHQgKlxyXG5cdCAqIExpc3RlbnMgdG86XHJcblx0ICogLSB3cGJjOmJmYjpmb3JtX3NldHRpbmdzOmFwcGx5ICAgKGZyb20gQUpBWCBsb2FkKSAgLT4gYXBwbHkgdG8gY29udHJvbHNcclxuXHQgKiAtIHdwYmM6YmZiOmZvcm1fc2V0dGluZ3M6Y29sbGVjdCAoZnJvbSBBSkFYIHNhdmUpICAtPiBjb2xsZWN0IGZyb20gY29udHJvbHNcclxuXHQgKlxyXG5cdCAqIE9wdGlvbmFsOlxyXG5cdCAqIC0gcmUtYXBwbHkgYWZ0ZXIgQnVpbGRlciBTVFJVQ1RVUkVfTE9BREVEICh0aW1pbmcgaG9vayBvbmx5KVxyXG5cdCAqL1xyXG5cdGNvbnN0IGFwaSA9ICh3LldQQkNfQkZCX0Zvcm1TZXR0aW5ncyA9IHcuV1BCQ19CRkJfRm9ybVNldHRpbmdzIHx8IHt9KTtcblx0bGV0IHBlbmRpbmdfdGltZV9waWNrZXJfc2tpbl9idXR0b24gPSBudWxsO1xuXHRsZXQgcHJldmlvdXNfdGltZV9waWNrZXJfc2tpbl91cmwgPSAnJztcblxyXG5cdC8vIExhc3QgcmVjZWl2ZWQgc2V0dGluZ3MgcGFjayAoZnJvbSBBSkFYKS5cclxuXHRsZXQgbGFzdF9zZXR0aW5nc19wYWNrID0gbnVsbDtcclxuXHJcblx0Ly8gU21hbGwgcmV0cnksIGJlY2F1c2UgRE9NIGNhbiBiZSByZS1yZW5kZXJlZCBhZnRlciBhcHBseSBldmVudC5cclxuXHRsZXQgcmFmX2lkICAgICAgPSAwO1xyXG5cdGxldCByZXRyeV9jb3VudCA9IDA7XG5cdGNvbnN0IHJldHJ5X21heCA9IDIwO1xuXHRjb25zdCBmYWxsYmFja19mb3JtX3N0eWxlX29wdGlvbl9rZXlzID0gW1xuXHRcdCdib29raW5nX2Zvcm1fc3R5bGUnLFxuXHRcdCdib29raW5nX2Zvcm1fYWNjZW50X2VuYWJsZWQnLFxuXHRcdCdib29raW5nX2Zvcm1fYWNjZW50X2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9iYWNrZ3JvdW5kX2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9ib3JkZXJfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl93aWR0aCcsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX3JhZGl1cycsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fcGFkZGluZ192ZXJ0aWNhbCcsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fcGFkZGluZ19ob3Jpem9udGFsJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV90ZXh0X2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9maWVsZF9iYWNrZ3JvdW5kX2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9maWVsZF90ZXh0X2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9maWVsZF9ib3JkZXJfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9iYWNrZ3JvdW5kX2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fdGV4dF9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JvcmRlcl9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2hvdmVyX2JhY2tncm91bmRfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX2J1dHRvbl9ob3Zlcl90ZXh0X2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfYm9yZGVyX2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2JhY2tncm91bmRfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fdGV4dF9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ib3JkZXJfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfYmFja2dyb3VuZF9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl90ZXh0X2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX2JvcmRlcl9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JvcmRlcl93aWR0aCcsXG5cdFx0J2Jvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JvcmRlcl9yYWRpdXMnLFxuXHRcdCdib29raW5nX2Zvcm1fdGhlbWUnLFxuXHRcdCdib29raW5nX2Zvcm1fY29udGFpbmVyX3N0eWxlJyxcblx0XHQnYm9va2luZ19mb3JtX2JhY2tncm91bmRfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fYm9yZGVyX2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2JvcmRlcl93aWR0aCcsXG5cdFx0J2Jvb2tpbmdfZm9ybV9ib3JkZXJfcmFkaXVzJyxcblx0XHQnYm9va2luZ19mb3JtX3BhZGRpbmcnLFxuXHRcdCdib29raW5nX2Zvcm1fdGV4dF9jb2xvcicsXG5cdFx0J2Jvb2tpbmdfZm9ybV9maWVsZF9iYWNrZ3JvdW5kX2NvbG9yJyxcblx0XHQnYm9va2luZ19mb3JtX2ZpZWxkX3RleHRfY29sb3InLFxuXHRcdCdib29raW5nX2Zvcm1fZmllbGRfYm9yZGVyX2NvbG9yJ1xuXHRdO1xuXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gU21hbGwgaGVscGVyc1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdGZ1bmN0aW9uIHF1ZXJ5X2FsbChyb290LCBzZWxlY3Rvcikge1xyXG5cdFx0cmV0dXJuIEFycmF5LmZyb20oKHJvb3QgfHwgZCkucXVlcnlTZWxlY3RvckFsbChzZWxlY3RvcikpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gY3NzX2VzY2FwZSh2YWx1ZSkge1xyXG5cdFx0Y29uc3QgdiA9IFN0cmluZyh2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSk7XHJcblx0XHRpZiAody5DU1MgJiYgdHlwZW9mIHcuQ1NTLmVzY2FwZSA9PT0gJ2Z1bmN0aW9uJykgcmV0dXJuIHcuQ1NTLmVzY2FwZSh2KTtcclxuXHRcdHJldHVybiB2LnJlcGxhY2UoL1teYS16QS1aMC05X1xcLV0vZywgJ1xcXFwkJicpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaXNfb24odmFsdWUpIHtcclxuXHRcdGNvbnN0IHYgPSBTdHJpbmcodmFsdWUgPT0gbnVsbCA/ICcnIDogdmFsdWUpLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0cmV0dXJuICh2ID09PSAnb24nIHx8IHYgPT09ICcxJyB8fCB2ID09PSAndHJ1ZScgfHwgdiA9PT0gJ3llcycpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2V0X2luaXRpYWxfYXR0cihlbCwgdmFsdWUpIHtcclxuXHRcdGlmICghZWwpIHJldHVybjtcclxuXHRcdGVsLnNldEF0dHJpYnV0ZSgnZGF0YS13cGJjLWJmYi1mcy1pbml0aWFsJywgU3RyaW5nKHZhbHVlID09IG51bGwgPyAnJyA6IHZhbHVlKSk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB0cmlnZ2VyX2NoYW5nZShlbCkge1xyXG5cdFx0aWYgKCFlbCkgcmV0dXJuO1xyXG5cdFx0dHJ5IHsgZWwuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2NoYW5nZScsIHsgYnViYmxlczogdHJ1ZSB9KSk7IH0gY2F0Y2ggKF8pIHt9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB0cmlnZ2VyX2lucHV0KGVsKSB7XHJcblx0XHRpZiAoICFlbCApIHJldHVybjtcclxuXHRcdHRyeSB7IGVsLmRpc3BhdGNoRXZlbnQoIG5ldyBFdmVudCggJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0gKSApOyB9IGNhdGNoICggXyApIHt9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBmaW5kX3Jvd3Moc2NvcGUpIHtcclxuXHRcdGNvbnN0IHJvd3MgPSBxdWVyeV9hbGwoZCwgJy53cGJjLXNldHRpbmdbZGF0YS1rZXldJyk7XHJcblx0XHRpZiAoIXNjb3BlKSByZXR1cm4gcm93cztcclxuXHJcblx0XHRyZXR1cm4gcm93cy5maWx0ZXIoZnVuY3Rpb24gKHJvdykge1xyXG5cdFx0XHRyZXR1cm4gU3RyaW5nKHJvdy5nZXRBdHRyaWJ1dGUoJ2RhdGEtc2NvcGUnKSB8fCAnJykgPT09IFN0cmluZyhzY29wZSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGhhc19hbnlfcm93cygpIHtcblx0XHRyZXR1cm4gcXVlcnlfYWxsKGQsICcud3BiYy1zZXR0aW5nW2RhdGEta2V5XScpLmxlbmd0aCA+IDA7XG5cdH1cblxuXHRmdW5jdGlvbiBpbml0X2NvbG9yaXNfcGlja2Vycyhyb290KSB7XG5cdFx0aWYgKCAhIHJvb3QgfHwgISB3LkNvbG9yaXMgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5wdXRzID0gcXVlcnlfYWxsKHJvb3QsICdpbnB1dFtkYXRhLXdwYmMtYmZiLWZzLXR5cGU9XCJjb2xvclwiXVtkYXRhLWNvbG9yaXNdLCBpbnB1dFtkYXRhLWluc3BlY3Rvci10eXBlPVwiY29sb3JcIl1bZGF0YS1jb2xvcmlzXScpO1xuXHRcdGlmICggISBpbnB1dHMubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlucHV0cy5mb3JFYWNoKGZ1bmN0aW9uIChpbnB1dCkge1xuXHRcdFx0aWYgKGlucHV0LmNsYXNzTGlzdC5jb250YWlucygnd3BiY19iZmJfY29sb3JpcycpKSByZXR1cm47XG5cdFx0XHRpbnB1dC5jbGFzc0xpc3QuYWRkKCd3cGJjX2JmYl9jb2xvcmlzJyk7XG5cdFx0fSk7XG5cblx0XHR0cnkge1xuXHRcdFx0dy5Db2xvcmlzKHtcblx0XHRcdFx0ZWwgICAgICAgOiAnLndwYmNfYmZiX2NvbG9yaXMnLFxuXHRcdFx0XHRhbHBoYSAgICA6IGZhbHNlLFxuXHRcdFx0XHRmb3JtYXQgICA6ICdoZXgnLFxuXHRcdFx0XHR0aGVtZU1vZGU6ICdhdXRvJyxcblx0XHRcdFx0b25DaGFuZ2UgOiBmdW5jdGlvbiAoY29sb3IsIGlucHV0KSB7XG5cdFx0XHRcdFx0aWYgKCAhIGlucHV0ICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0aW5wdXQuZGlzcGF0Y2hFdmVudCggbmV3IEN1c3RvbUV2ZW50KCAnd3BiYzpiZmI6Y29sb3JpczpjaGFuZ2UnLCB7XG5cdFx0XHRcdFx0XHRcdGJ1YmJsZXM6IHRydWUsXG5cdFx0XHRcdFx0XHRcdGRldGFpbCA6IHtcblx0XHRcdFx0XHRcdFx0XHRjb2xvciAgICA6IGNvbG9yLFxuXHRcdFx0XHRcdFx0XHRcdGN1cnJlbnRFbDogaW5wdXRcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSApICk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoIF9lICkge31cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc29sZS53YXJuKCdXUEJDIEZvcm0gU2V0dGluZ3M6IENvbG9yaXMgaW5pdCBmYWlsZWQ6JywgZSk7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0X2RlZmF1bHRfY3VzdG9tX2FwcGVhcmFuY2Vfc2V0dGluZ3MoKSB7XG5cdFx0Y29uc3QgbG9jYWxpemVkX2N1c3RvbV9zdHlsZSA9IHcud3BiY19iZmJfc2V0dGluZ3NfdmFycyAmJiB3LndwYmNfYmZiX3NldHRpbmdzX3ZhcnMuY3VzdG9tX2Zvcm1fc3R5bGVfZGVmYXVsdHNcblx0XHRcdD8gdy53cGJjX2JmYl9zZXR0aW5nc192YXJzLmN1c3RvbV9mb3JtX3N0eWxlX2RlZmF1bHRzXG5cdFx0XHQ6IHt9O1xuXHRcdGNvbnN0IGxvY2FsaXplZF9mb3JtX2FjY2VudCA9IHcud3BiY19iZmJfc2V0dGluZ3NfdmFycyAmJiB3LndwYmNfYmZiX3NldHRpbmdzX3ZhcnMuZm9ybV9hY2NlbnRfZGVmYXVsdHNcblx0XHRcdD8gdy53cGJjX2JmYl9zZXR0aW5nc192YXJzLmZvcm1fYWNjZW50X2RlZmF1bHRzXG5cdFx0XHQ6IHt9O1xuXG5cdFx0cmV0dXJuIE9iamVjdC5hc3NpZ24oIHtcblx0XHRcdGJvb2tpbmdfZm9ybV9hY2NlbnRfZW5hYmxlZDogJ09mZicsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2JhY2tncm91bmRfY29sb3IgICAgICAgOiAnI2ZmZmZmZicsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl9jb2xvciAgICAgICAgICAgOiAnI2NjY2NjYycsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX2JvcmRlcl93aWR0aCAgICAgICAgICAgOiAnMXB4Jyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYm9yZGVyX3JhZGl1cyAgICAgICAgICA6ICcycHgnLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9wYWRkaW5nX3ZlcnRpY2FsICAgICAgIDogJzEwcHgnLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9wYWRkaW5nX2hvcml6b250YWwgICAgIDogJzMwcHgnLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV90ZXh0X2NvbG9yICAgICAgICAgICAgIDogJyMxZDIzMjcnLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9maWVsZF9iYWNrZ3JvdW5kX2NvbG9yIDogJyNmZmZmZmYnLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9maWVsZF90ZXh0X2NvbG9yICAgICAgIDogJyMzYzQzNGEnLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9maWVsZF9ib3JkZXJfY29sb3IgICAgIDogJyNjY2NjY2MnLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYmFja2dyb3VuZF9jb2xvcjogJyMwNjZhYWInLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fdGV4dF9jb2xvciAgICAgIDogJyNmZmZmZmYnLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYm9yZGVyX2NvbG9yICAgIDogJyMwNjZhYWInLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfYmFja2dyb3VuZF9jb2xvcjogJyMwNTU1ODknLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfdGV4dF9jb2xvcjogJyNmZmZmZmYnLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9idXR0b25faG92ZXJfYm9yZGVyX2NvbG9yOiAnIzA1NTU4OScsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25fYmFja2dyb3VuZF9jb2xvcjogJyNmZGZkZmQnLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX3RleHRfY29sb3I6ICcjNDQ0NDQ0Jyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ib3JkZXJfY29sb3I6ICcjZWVlZWVlJyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fc2Vjb25kYXJ5X2J1dHRvbl9ob3Zlcl9iYWNrZ3JvdW5kX2NvbG9yOiAnI2ZkZmRmZCcsXG5cdFx0XHRib29raW5nX2Zvcm1fY3VzdG9tX3NlY29uZGFyeV9idXR0b25faG92ZXJfdGV4dF9jb2xvcjogJyM0NDQ0NDQnLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9zZWNvbmRhcnlfYnV0dG9uX2hvdmVyX2JvcmRlcl9jb2xvcjogJyM0ZDkxY2QnLFxuXHRcdFx0Ym9va2luZ19mb3JtX2N1c3RvbV9idXR0b25fYm9yZGVyX3dpZHRoICAgICAgOiAnMXB4Jyxcblx0XHRcdGJvb2tpbmdfZm9ybV9jdXN0b21fYnV0dG9uX2JvcmRlcl9yYWRpdXMgICAgIDogJzNweCdcblx0XHR9LCBsb2NhbGl6ZWRfY3VzdG9tX3N0eWxlLCBsb2NhbGl6ZWRfZm9ybV9hY2NlbnQgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldF9mb3JtX3N0eWxlX29wdGlvbl9rZXlzKCkge1xuXHRcdGNvbnN0IGxvY2FsaXplZCA9IHcud3BiY19iZmJfc2V0dGluZ3NfdmFycyAmJiBBcnJheS5pc0FycmF5KCB3LndwYmNfYmZiX3NldHRpbmdzX3ZhcnMuZm9ybV9zdHlsZV9vcHRpb25fa2V5cyApXG5cdFx0XHQ/IHcud3BiY19iZmJfc2V0dGluZ3NfdmFycy5mb3JtX3N0eWxlX29wdGlvbl9rZXlzXG5cdFx0XHQ6IFtdO1xuXG5cdFx0cmV0dXJuIGxvY2FsaXplZC5sZW5ndGggPyBsb2NhbGl6ZWQgOiBmYWxsYmFja19mb3JtX3N0eWxlX29wdGlvbl9rZXlzO1xuXHR9XG5cblx0ZnVuY3Rpb24gc3RyaXBfZm9ybV9zdHlsZV9vcHRpb25zX2Zyb21fcGFjayhzZXR0aW5nc19wYWNrKSB7XG5cdFx0aWYgKCFzZXR0aW5nc19wYWNrIHx8IHR5cGVvZiBzZXR0aW5nc19wYWNrICE9PSAnb2JqZWN0JykgcmV0dXJuIHNldHRpbmdzX3BhY2s7XG5cdFx0aWYgKCFzZXR0aW5nc19wYWNrLm9wdGlvbnMgfHwgdHlwZW9mIHNldHRpbmdzX3BhY2sub3B0aW9ucyAhPT0gJ29iamVjdCcpIHJldHVybiBzZXR0aW5nc19wYWNrO1xuXG5cdFx0Z2V0X2Zvcm1fc3R5bGVfb3B0aW9uX2tleXMoKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcblx0XHRcdGRlbGV0ZSBzZXR0aW5nc19wYWNrLm9wdGlvbnNba2V5XTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBzZXR0aW5nc19wYWNrO1xuXHR9XG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFJvdyBzZXR0ZXJcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRmdW5jdGlvbiBzZXRfdmFsdWVfZm9yX3Jvdyhyb3csIHZhbHVlLCBvcHRzKSB7XHJcblx0XHRpZiAoIXJvdykgcmV0dXJuO1xyXG5cclxuXHRcdGNvbnN0IHJvd190eXBlID0gU3RyaW5nKHJvdy5nZXRBdHRyaWJ1dGUoJ2RhdGEtdHlwZScpIHx8ICcnKTtcclxuXHRcdGNvbnN0IHJvd19rZXkgID0gU3RyaW5nKHJvdy5nZXRBdHRyaWJ1dGUoJ2RhdGEta2V5JykgfHwgJycpO1xyXG5cdFx0Y29uc3QgZG9fdHJpZ2dlcl9ldmVudHMgPSAhIShvcHRzICYmIG9wdHMudHJpZ2dlcl9jaGFuZ2UpO1xyXG5cclxuXHRcdGlmICghcm93X2tleSkgcmV0dXJuO1xyXG5cclxuXHRcdC8vIFJhZGlvIGdyb3VwXHJcblx0XHRpZiAocm93X3R5cGUgPT09ICdyYWRpbycpIHtcclxuXHRcdFx0Y29uc3Qgd3JhcCA9IHJvdy5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX2Zvcm1fc2V0dGluZ19yYWRpb1tkYXRhLXdwYmMtYmZiLWZzLWNvbnRyb2xpZF0nKTtcclxuXHRcdFx0Y29uc3QgY29udHJvbF9pZCA9IHdyYXAgPyBTdHJpbmcod3JhcC5nZXRBdHRyaWJ1dGUoJ2RhdGEtd3BiYy1iZmItZnMtY29udHJvbGlkJykgfHwgJycpIDogJyc7XHJcblx0XHRcdGlmICghY29udHJvbF9pZCkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Y29uc3QgdGFyZ2V0X3ZhbHVlID0gU3RyaW5nKHZhbHVlID09IG51bGwgPyAnJyA6IHZhbHVlKTtcclxuXHRcdFx0Y29uc3QgcmFkaW9zID0gcXVlcnlfYWxsKHJvdywgJ2lucHV0W3R5cGU9XCJyYWRpb1wiXVtuYW1lPVwiJyArIGNzc19lc2NhcGUoY29udHJvbF9pZCkgKyAnXCJdJyk7XHJcblxyXG5cdFx0XHRsZXQgY2hlY2tlZF9yYWRpbyA9IG51bGw7XG5cdFx0XHRyYWRpb3MuZm9yRWFjaChmdW5jdGlvbiAocmFkaW8pIHtcblx0XHRcdFx0Y29uc3Qgc2hvdWxkX2NoZWNrID0gKFN0cmluZyhyYWRpby52YWx1ZSkgPT09IHRhcmdldF92YWx1ZSk7XG5cdFx0XHRcdHJhZGlvLmNoZWNrZWQgPSBzaG91bGRfY2hlY2s7XG5cdFx0XHRcdGlmIChzaG91bGRfY2hlY2spIGNoZWNrZWRfcmFkaW8gPSByYWRpbztcblxuXHRcdFx0XHRjb25zdCBjaG9pY2UgPSByYWRpby5jbG9zZXN0ID8gcmFkaW8uY2xvc2VzdCgnLndwYmNfdGhlbWVfY2hvaWNlJykgOiBudWxsO1xuXHRcdFx0XHRpZiAoIGNob2ljZSApIHtcblx0XHRcdFx0XHRjaG9pY2UuY2xhc3NMaXN0LnRvZ2dsZSgnaXMtc2VsZWN0ZWQnLCBzaG91bGRfY2hlY2spO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxyXG5cdFx0XHRpZiAod3JhcCkgc2V0X2luaXRpYWxfYXR0cih3cmFwLCB0YXJnZXRfdmFsdWUpO1xyXG5cdFx0XHRpZiAoZG9fdHJpZ2dlcl9ldmVudHMgJiYgY2hlY2tlZF9yYWRpbykgdHJpZ2dlcl9jaGFuZ2UoY2hlY2tlZF9yYWRpbyk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBUb2dnbGVcclxuXHRcdGlmIChyb3dfdHlwZSA9PT0gJ3RvZ2dsZScpIHtcclxuXHRcdFx0Y29uc3QgY2hlY2tib3ggPVxyXG5cdFx0XHRcdHJvdy5xdWVyeVNlbGVjdG9yKCdpbnB1dFt0eXBlPVwiY2hlY2tib3hcIl1bZGF0YS13cGJjLWJmYi1mcy10eXBlPVwidG9nZ2xlXCJdJykgfHxcclxuXHRcdFx0XHRyb3cucXVlcnlTZWxlY3RvcignaW5wdXRbdHlwZT1cImNoZWNrYm94XCJdJyk7XHJcblxyXG5cdFx0XHRpZiAoIWNoZWNrYm94KSByZXR1cm47XHJcblxyXG5cdFx0XHRjb25zdCBjaGVja2VkID0gaXNfb24odmFsdWUpO1xyXG5cdFx0XHRjaGVja2JveC5jaGVja2VkID0gY2hlY2tlZDtcclxuXHRcdFx0Y2hlY2tib3guc2V0QXR0cmlidXRlKCdhcmlhLWNoZWNrZWQnLCBjaGVja2VkID8gJ3RydWUnIDogJ2ZhbHNlJyk7XHJcblxyXG5cdFx0XHRzZXRfaW5pdGlhbF9hdHRyKGNoZWNrYm94LCBjaGVja2VkID8gJ09uJyA6ICdPZmYnKTtcclxuXHRcdFx0aWYgKGRvX3RyaWdnZXJfZXZlbnRzKSB0cmlnZ2VyX2NoYW5nZShjaGVja2JveCk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBTZWxlY3RcclxuXHRcdGlmIChyb3dfdHlwZSA9PT0gJ3NlbGVjdCcpIHtcclxuXHRcdFx0Y29uc3Qgc2VsZWN0ID1cclxuXHRcdFx0XHRyb3cucXVlcnlTZWxlY3Rvcignc2VsZWN0W2RhdGEtd3BiYy1iZmItZnMtdHlwZT1cInNlbGVjdFwiXScpIHx8XHJcblx0XHRcdFx0cm93LnF1ZXJ5U2VsZWN0b3IoJ3NlbGVjdCcpO1xyXG5cclxuXHRcdFx0aWYgKCFzZWxlY3QpIHJldHVybjtcclxuXHJcblx0XHRcdHNlbGVjdC52YWx1ZSA9IFN0cmluZyh2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSk7XHJcblx0XHRcdHNldF9pbml0aWFsX2F0dHIoc2VsZWN0LCBzZWxlY3QudmFsdWUpO1xyXG5cdFx0XHRpZiAoZG9fdHJpZ2dlcl9ldmVudHMpIHRyaWdnZXJfY2hhbmdlKHNlbGVjdCk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBMZW5ndGg6IGhpZGRlbiBjb21iaW5lZCArIG51bS91bml0XG5cdFx0aWYgKCByb3dfdHlwZSA9PT0gJ2xlbmd0aCcgKSB7XG5cdFx0XHQvLyBKUyBzbGlkZXIgbGVuZ3RoIGNvbnRyb2w6IC0gaGlkZGVuIHdyaXRlciBjYXJyaWVzIEZTIG1hcmtlcnMgYW5kIG11c3QgcmVjZWl2ZSBpbnB1dCBldmVudCBzbyB3cGJjX3NsaWRlcl9sZW5fZ3JvdXBzLmpzIHN5bmNzIFVJLlxyXG5cdFx0XHRjb25zdCB3cml0ZXIgPVxyXG5cdFx0XHRcdFx0ICByb3cucXVlcnlTZWxlY3RvciggJ2lucHV0W2RhdGEtd3BiY19zbGlkZXJfbGVuX3dyaXRlcl1bZGF0YS13cGJjLWJmYi1mcy10eXBlPVwibGVuZ3RoXCJdJyApIHx8XHJcblx0XHRcdFx0XHQgIHJvdy5xdWVyeVNlbGVjdG9yKCAnaW5wdXRbZGF0YS13cGJjLWJmYi1mcy10eXBlPVwibGVuZ3RoXCJdJyApO1xyXG5cdFx0XHRpZiAoICF3cml0ZXIgKSByZXR1cm47XHJcblxyXG5cdFx0XHRjb25zdCBjb21iaW5lZCA9IFN0cmluZyggdmFsdWUgPT0gbnVsbCA/ICcnIDogdmFsdWUgKTtcclxuXHRcdFx0d3JpdGVyLnZhbHVlICAgPSBjb21iaW5lZDtcclxuXHRcdFx0c2V0X2luaXRpYWxfYXR0ciggd3JpdGVyLCBjb21iaW5lZCApO1xyXG5cdFx0XHRpZiAoIGRvX3RyaWdnZXJfZXZlbnRzICkgdHJpZ2dlcl9pbnB1dCggd3JpdGVyICk7XHJcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBTcGFjaW5nOiB0d28gbnVtYmVyIGlucHV0cyBzYXZlZCBpbnRvIGEgaGlkZGVuIENTUyBzaG9ydGhhbmQgd3JpdGVyLlxuXHRcdGlmICggcm93X3R5cGUgPT09ICdzcGFjaW5nJyApIHtcblx0XHRcdGNvbnN0IGdyb3VwID0gcm93LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19zcGFjaW5nX2dyb3VwJyApO1xuXHRcdFx0Y29uc3QgdmVydGljYWxfaW5wdXQgPSBncm91cCA/IGdyb3VwLnF1ZXJ5U2VsZWN0b3IoICdpbnB1dFtkYXRhLXdwYmNfc3BhY2luZ192ZXJ0aWNhbF0nICkgOiBudWxsO1xuXHRcdFx0Y29uc3QgaG9yaXpvbnRhbF9pbnB1dCA9IGdyb3VwID8gZ3JvdXAucXVlcnlTZWxlY3RvciggJ2lucHV0W2RhdGEtd3BiY19zcGFjaW5nX2hvcml6b250YWxdJyApIDogbnVsbDtcblx0XHRcdGNvbnN0IHdyaXRlciA9IGdyb3VwID8gZ3JvdXAucXVlcnlTZWxlY3RvciggJ2lucHV0W2RhdGEtd3BiY19zcGFjaW5nX3dyaXRlcl0nICkgOiBudWxsO1xuXHRcdFx0Y29uc3QgcGFyc2VkID0gcGFyc2Vfc3BhY2luZ192YWx1ZSggdmFsdWUgKTtcblxuXHRcdFx0aWYgKCAhIHdyaXRlciApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIHZlcnRpY2FsX2lucHV0ICkge1xuXHRcdFx0XHR2ZXJ0aWNhbF9pbnB1dC52YWx1ZSA9IHBhcnNlZC52ZXJ0aWNhbDtcblx0XHRcdH1cblx0XHRcdGlmICggaG9yaXpvbnRhbF9pbnB1dCApIHtcblx0XHRcdFx0aG9yaXpvbnRhbF9pbnB1dC52YWx1ZSA9IHBhcnNlZC5ob3Jpem9udGFsO1xuXHRcdFx0fVxuXHRcdFx0d3JpdGVyLnZhbHVlID0gcGFyc2VkLmNvbWJpbmVkO1xuXHRcdFx0c2V0X2luaXRpYWxfYXR0ciggd3JpdGVyLCBwYXJzZWQuY29tYmluZWQgKTtcblx0XHRcdGlmICggZG9fdHJpZ2dlcl9ldmVudHMgKSB0cmlnZ2VyX2lucHV0KCB3cml0ZXIgKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBSYW5nZSAoc2xpZGVyIG51bWJlcik6IHdyaXRlciBpcyB0aGUgbnVtYmVyIGlucHV0LlxyXG5cdFx0aWYgKHJvd190eXBlID09PSAncmFuZ2UnKSB7XHJcblx0XHRcdGNvbnN0IHdyaXRlciA9XHJcblx0XHRcdFx0cm93LnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W2RhdGEtd3BiY19zbGlkZXJfcmFuZ2Vfd3JpdGVyXScpIHx8XHJcblx0XHRcdFx0cm93LnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W2RhdGEtd3BiYy1iZmItZnMta2V5PVwiJyArIGNzc19lc2NhcGUocm93X2tleSkgKyAnXCJdJykgfHxcclxuXHRcdFx0XHRyb3cucXVlcnlTZWxlY3RvcignaW5wdXRbdHlwZT1cIm51bWJlclwiXScpO1xyXG5cdFx0XHRpZiAoIXdyaXRlcikgcmV0dXJuO1xyXG5cclxuXHRcdFx0d3JpdGVyLnZhbHVlID0gU3RyaW5nKHZhbHVlID09IG51bGwgPyAnJyA6IHZhbHVlKTtcclxuXHRcdFx0c2V0X2luaXRpYWxfYXR0cih3cml0ZXIsIHdyaXRlci52YWx1ZSk7XHJcblx0XHRcdGlmIChkb190cmlnZ2VyX2V2ZW50cykgdHJpZ2dlcl9pbnB1dCh3cml0ZXIpO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gRGVmYXVsdDogaW5wdXQvdGV4dGFyZWFcclxuXHRcdGNvbnN0IGNvbnRyb2wgPVxyXG5cdFx0XHRyb3cucXVlcnlTZWxlY3RvcignW2RhdGEtd3BiYy1iZmItZnMta2V5PVwiJyArIGNzc19lc2NhcGUocm93X2tleSkgKyAnXCJdJykgfHxcclxuXHRcdFx0cm93LnF1ZXJ5U2VsZWN0b3IoJ2lucHV0LHRleHRhcmVhJyk7XHJcblxyXG5cdFx0aWYgKCFjb250cm9sKSByZXR1cm47XHJcblxyXG5cdFx0Y29udHJvbC52YWx1ZSA9IFN0cmluZyh2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSk7XHJcblx0XHRzZXRfaW5pdGlhbF9hdHRyKGNvbnRyb2wsIGNvbnRyb2wudmFsdWUpO1xyXG5cdFx0Ly8gRm9yIG5vcm1hbCBpbnB1dHMsIFwiaW5wdXRcIiBnaXZlcyBiZXR0ZXIgcmVhY3Rpdml0eSB0aGFuIFwiY2hhbmdlXCIuXHJcblx0XHRpZiAoZG9fdHJpZ2dlcl9ldmVudHMpIHRyaWdnZXJfaW5wdXQoY29udHJvbCk7XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFB1YmxpYyBBUElcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHQvKipcclxuXHQgKiBBcHBseSBGTEFUIG9iamVjdCAoa2V5PT52YWx1ZSkgdG8gcm93cyBvZiBzb21lIHNjb3BlLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGFwcGx5X2ZsYXRfc2V0dGluZ3MoZmxhdF9zZXR0aW5ncywgc2NvcGUsIG9wdHMpIHtcclxuXHRcdGlmICghZmxhdF9zZXR0aW5ncyB8fCB0eXBlb2YgZmxhdF9zZXR0aW5ncyAhPT0gJ29iamVjdCcpIHJldHVybjtcclxuXHJcblx0XHRmaW5kX3Jvd3Moc2NvcGUpLmZvckVhY2goZnVuY3Rpb24gKHJvdykge1xyXG5cdFx0XHRjb25zdCBrZXkgPSBTdHJpbmcocm93LmdldEF0dHJpYnV0ZSgnZGF0YS1rZXknKSB8fCAnJyk7XHJcblx0XHRcdGlmICgha2V5KSByZXR1cm47XHJcblx0XHRcdGlmICghT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGZsYXRfc2V0dGluZ3MsIGtleSkpIHJldHVybjtcclxuXHRcdFx0c2V0X3ZhbHVlX2Zvcl9yb3cocm93LCBmbGF0X3NldHRpbmdzW2tleV0sIG9wdHMpO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBBcHBseSBzZXR0aW5ncy5cclxuXHQgKlxyXG5cdCAqIFN1cHBvcnRzOlxyXG5cdCAqIC0gZmxhdDogeyBib29raW5nX2Zvcm1fbGF5b3V0X3dpZHRoOiAnMTAwJScsIC4uLiB9XHJcblx0ICogLSBwYWNrOiB7IG9wdGlvbnM6IHsuLi59LCBjc3NfdmFyczogey4uLn0gfSAgIChPcHRpb24gQSlcclxuXHQgKi9cclxuXHRhcGkuYXBwbHkgPSBmdW5jdGlvbiAoc2V0dGluZ3NfcGFjaywgc2NvcGUsIG9wdHMpIHtcblx0XHRpZiAoIXNldHRpbmdzX3BhY2sgfHwgdHlwZW9mIHNldHRpbmdzX3BhY2sgIT09ICdvYmplY3QnKSByZXR1cm47XG5cdFx0aWYgKCFzZXR0aW5nc19wYWNrLm9wdGlvbnMgfHwgdHlwZW9mIHNldHRpbmdzX3BhY2sub3B0aW9ucyAhPT0gJ29iamVjdCcpIHJldHVybjsgLy8gc3RyaWN0IE9wdGlvbiBBXG5cdFx0c3RyaXBfZm9ybV9zdHlsZV9vcHRpb25zX2Zyb21fcGFjayhzZXR0aW5nc19wYWNrKTtcblx0XHRhcHBseV9mbGF0X3NldHRpbmdzKHNldHRpbmdzX3BhY2sub3B0aW9ucywgc2NvcGUgfHwgJ2Zvcm0nLCBvcHRzKTtcblx0fTtcblxuXHRhcGkucmVzZXRfY3VzdG9tX2FwcGVhcmFuY2UgPSBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZGVmYXVsdHMgPSBnZXRfZGVmYXVsdF9jdXN0b21fYXBwZWFyYW5jZV9zZXR0aW5ncygpO1xuXG5cdFx0aWYgKCAhIGxhc3Rfc2V0dGluZ3NfcGFjayB8fCB0eXBlb2YgbGFzdF9zZXR0aW5nc19wYWNrICE9PSAnb2JqZWN0JyApIHtcblx0XHRcdGxhc3Rfc2V0dGluZ3NfcGFjayA9IHsgb3B0aW9uczoge30sIGNzc192YXJzOiB7fSB9O1xuXHRcdH1cblx0XHRpZiAoICEgbGFzdF9zZXR0aW5nc19wYWNrLm9wdGlvbnMgfHwgdHlwZW9mIGxhc3Rfc2V0dGluZ3NfcGFjay5vcHRpb25zICE9PSAnb2JqZWN0JyApIHtcblx0XHRcdGxhc3Rfc2V0dGluZ3NfcGFjay5vcHRpb25zID0ge307XG5cdFx0fVxuXHRcdE9iamVjdC5rZXlzKCBkZWZhdWx0cyApLmZvckVhY2goIGZ1bmN0aW9uIChrZXkpIHtcblx0XHRcdGxhc3Rfc2V0dGluZ3NfcGFjay5vcHRpb25zW2tleV0gPSBkZWZhdWx0c1trZXldO1xuXHRcdH0gKTtcblxuXHRcdGFwcGx5X2ZsYXRfc2V0dGluZ3MoIGRlZmF1bHRzLCAnZ2xvYmFsJywgeyB0cmlnZ2VyX2NoYW5nZTogdHJ1ZSB9ICk7XG5cdFx0aW5pdF9jb2xvcmlzX3BpY2tlcnMoIGQgKTtcblxuXHRcdGlmICggdy5XUEJDX0JGQl9TZXR0aW5nc19FZmZlY3RzICYmIHR5cGVvZiB3LldQQkNfQkZCX1NldHRpbmdzX0VmZmVjdHMuYXBwbHlfYWxsID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0dy5XUEJDX0JGQl9TZXR0aW5nc19FZmZlY3RzLmFwcGx5X2FsbCggZGVmYXVsdHMsIHsgc291cmNlOiAncmVzZXQtY3VzdG9tLWFwcGVhcmFuY2UnLCBvcHRpb25zOiBkZWZhdWx0cyB9ICk7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGQuZGlzcGF0Y2hFdmVudCggbmV3IEN1c3RvbUV2ZW50KCAnd3BiYzpiZmI6Zm9ybV9zZXR0aW5nczpjaGFuZ2VkJywge1xuXHRcdFx0XHRidWJibGVzOiB0cnVlLFxuXHRcdFx0XHRkZXRhaWwgOiB7XG5cdFx0XHRcdFx0c291cmNlICA6ICdyZXNldC1jdXN0b20tYXBwZWFyYW5jZScsXG5cdFx0XHRcdFx0c2V0dGluZ3M6IHsgb3B0aW9uczogT2JqZWN0LmFzc2lnbigge30sIGRlZmF1bHRzICkgfVxuXHRcdFx0XHR9XG5cdFx0XHR9ICkgKTtcblx0XHR9IGNhdGNoICggX2UgKSB7fVxuXHR9O1xuXHJcblx0LyoqXHJcblx0ICogQ29sbGVjdCBjdXJyZW50IHZhbHVlcyAoZmxhdCBvYmplY3QpLlxyXG5cdCAqL1xyXG5cdGFwaS5jb2xsZWN0ID0gZnVuY3Rpb24gKHNjb3BlKSB7XHJcblx0XHRjb25zdCBvdXQgPSB7fTtcclxuXHJcblx0XHRmaW5kX3Jvd3Moc2NvcGUgfHwgJ2Zvcm0nKS5mb3JFYWNoKGZ1bmN0aW9uIChyb3cpIHtcclxuXHRcdFx0Y29uc3Qga2V5ICA9IFN0cmluZyhyb3cuZ2V0QXR0cmlidXRlKCdkYXRhLWtleScpIHx8ICcnKTtcclxuXHRcdFx0Y29uc3QgdHlwZSA9IFN0cmluZyhyb3cuZ2V0QXR0cmlidXRlKCdkYXRhLXR5cGUnKSB8fCAnJyk7XHJcblx0XHRcdGlmICgha2V5KSByZXR1cm47XHJcblxyXG5cdFx0XHRpZiAodHlwZSA9PT0gJ3JhZGlvJykge1xyXG5cdFx0XHRcdGNvbnN0IHdyYXAgPSByb3cucXVlcnlTZWxlY3RvcignLndwYmNfYmZiX19mb3JtX3NldHRpbmdfcmFkaW9bZGF0YS13cGJjLWJmYi1mcy1jb250cm9saWRdJyk7XHJcblx0XHRcdFx0Y29uc3QgY29udHJvbF9pZCA9IHdyYXAgPyBTdHJpbmcod3JhcC5nZXRBdHRyaWJ1dGUoJ2RhdGEtd3BiYy1iZmItZnMtY29udHJvbGlkJykgfHwgJycpIDogJyc7XHJcblx0XHRcdFx0aWYgKCFjb250cm9sX2lkKSByZXR1cm47XHJcblxyXG5cdFx0XHRcdGNvbnN0IGNoZWNrZWQgPSByb3cucXVlcnlTZWxlY3RvcignaW5wdXRbdHlwZT1cInJhZGlvXCJdW25hbWU9XCInICsgY3NzX2VzY2FwZShjb250cm9sX2lkKSArICdcIl06Y2hlY2tlZCcpO1xyXG5cdFx0XHRcdG91dFtrZXldID0gY2hlY2tlZCA/IFN0cmluZyhjaGVja2VkLnZhbHVlKSA6ICcnO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKHR5cGUgPT09ICd0b2dnbGUnKSB7XHJcblx0XHRcdFx0Y29uc3QgY2hlY2tib3ggPVxyXG5cdFx0XHRcdFx0cm93LnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W3R5cGU9XCJjaGVja2JveFwiXVtkYXRhLXdwYmMtYmZiLWZzLXR5cGU9XCJ0b2dnbGVcIl0nKSB8fFxyXG5cdFx0XHRcdFx0cm93LnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W3R5cGU9XCJjaGVja2JveFwiXScpO1xyXG5cdFx0XHRcdG91dFtrZXldID0gY2hlY2tib3ggJiYgY2hlY2tib3guY2hlY2tlZCA/ICdPbicgOiAnT2ZmJztcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICh0eXBlID09PSAnc2VsZWN0Jykge1xyXG5cdFx0XHRcdGNvbnN0IHNlbGVjdCA9IHJvdy5xdWVyeVNlbGVjdG9yKCdzZWxlY3QnKTtcclxuXHRcdFx0XHRvdXRba2V5XSA9IHNlbGVjdCA/IFN0cmluZyhzZWxlY3QudmFsdWUpIDogJyc7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAodHlwZSA9PT0gJ2xlbmd0aCcpIHtcblx0XHRcdFx0Y29uc3QgaGlkZGVuID0gcm93LnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W2RhdGEtd3BiYy1iZmItZnMtdHlwZT1cImxlbmd0aFwiXScpO1xuXHRcdFx0XHRvdXRba2V5XSA9IGhpZGRlbiA/IFN0cmluZyhoaWRkZW4udmFsdWUgfHwgJycpIDogJyc7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHR5cGUgPT09ICdzcGFjaW5nJykge1xuXHRcdFx0XHRvdXRba2V5XSA9IGdldF9zcGFjaW5nX3ZhbHVlKHJvdyk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHR5cGUgPT09ICdyYW5nZScpIHtcclxuXHRcdFx0XHRjb25zdCB3cml0ZXIgPVxyXG5cdFx0XHRcdFx0cm93LnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W2RhdGEtd3BiY19zbGlkZXJfcmFuZ2Vfd3JpdGVyXScpIHx8XHJcblx0XHRcdFx0XHRyb3cucXVlcnlTZWxlY3RvcignaW5wdXRbdHlwZT1cIm51bWJlclwiXScpIHx8XHJcblx0XHRcdFx0XHRyb3cucXVlcnlTZWxlY3RvcignaW5wdXRbdHlwZT1cInJhbmdlXCJdJyk7XHJcblx0XHRcdFx0b3V0W2tleV0gPSB3cml0ZXIgPyBTdHJpbmcod3JpdGVyLnZhbHVlIHx8ICcnKSA6ICcnO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCBjb250cm9sID0gcm93LnF1ZXJ5U2VsZWN0b3IoJ2lucHV0LHRleHRhcmVhJyk7XHJcblx0XHRcdG91dFtrZXldID0gY29udHJvbCA/IFN0cmluZyhjb250cm9sLnZhbHVlIHx8ICcnKSA6ICcnO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0cmV0dXJuIG91dDtcblx0fTtcblxuXHRmdW5jdGlvbiBwYXJzZV9zcGFjaW5nX3ZhbHVlKHZhbHVlKSB7XG5cdFx0Y29uc3QgZmFsbGJhY2sgPSB7IHZlcnRpY2FsOiAnMTAnLCBob3Jpem9udGFsOiAnMzAnLCBjb21iaW5lZDogJzEwcHggMzBweCcgfTtcblx0XHRjb25zdCBtYXRjaGVzID0gU3RyaW5nKHZhbHVlID09IG51bGwgPyAnJyA6IHZhbHVlKS5tYXRjaCgvLT9cXGQrKD86XFwuXFxkKyk/L2cpIHx8IFtdO1xuXHRcdGxldCB2ZXJ0aWNhbCA9IG1hdGNoZXNbMF0gIT0gbnVsbCA/IFN0cmluZyhtYXRjaGVzWzBdKSA6IGZhbGxiYWNrLnZlcnRpY2FsO1xuXHRcdGxldCBob3Jpem9udGFsID0gbWF0Y2hlc1sxXSAhPSBudWxsID8gU3RyaW5nKG1hdGNoZXNbMV0pIDogdmVydGljYWw7XG5cblx0XHRpZiAoaXNOYU4oTnVtYmVyKHZlcnRpY2FsKSkpIHtcblx0XHRcdHZlcnRpY2FsID0gZmFsbGJhY2sudmVydGljYWw7XG5cdFx0fVxuXHRcdGlmIChpc05hTihOdW1iZXIoaG9yaXpvbnRhbCkpKSB7XG5cdFx0XHRob3Jpem9udGFsID0gZmFsbGJhY2suaG9yaXpvbnRhbDtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0dmVydGljYWwgIDogdmVydGljYWwsXG5cdFx0XHRob3Jpem9udGFsOiBob3Jpem9udGFsLFxuXHRcdFx0Y29tYmluZWQgIDogdmVydGljYWwgKyAncHggJyArIGhvcml6b250YWwgKyAncHgnXG5cdFx0fTtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldF9zcGFjaW5nX3ZhbHVlKHJvdykge1xuXHRcdGNvbnN0IGdyb3VwID0gcm93ID8gcm93LnF1ZXJ5U2VsZWN0b3IoJy53cGJjX3NwYWNpbmdfZ3JvdXAnKSA6IG51bGw7XG5cdFx0Y29uc3QgdmVydGljYWxfaW5wdXQgPSBncm91cCA/IGdyb3VwLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W2RhdGEtd3BiY19zcGFjaW5nX3ZlcnRpY2FsXScpIDogbnVsbDtcblx0XHRjb25zdCBob3Jpem9udGFsX2lucHV0ID0gZ3JvdXAgPyBncm91cC5xdWVyeVNlbGVjdG9yKCdpbnB1dFtkYXRhLXdwYmNfc3BhY2luZ19ob3Jpem9udGFsXScpIDogbnVsbDtcblx0XHRjb25zdCB3cml0ZXIgPSBncm91cCA/IGdyb3VwLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W2RhdGEtd3BiY19zcGFjaW5nX3dyaXRlcl0nKSA6IG51bGw7XG5cdFx0Y29uc3QgdmVydGljYWwgPSB2ZXJ0aWNhbF9pbnB1dCA/IFN0cmluZyh2ZXJ0aWNhbF9pbnB1dC52YWx1ZSB8fCAnMCcpIDogJzAnO1xuXHRcdGNvbnN0IGhvcml6b250YWwgPSBob3Jpem9udGFsX2lucHV0ID8gU3RyaW5nKGhvcml6b250YWxfaW5wdXQudmFsdWUgfHwgdmVydGljYWwpIDogdmVydGljYWw7XG5cdFx0Y29uc3QgY29tYmluZWQgPSBwYXJzZV9zcGFjaW5nX3ZhbHVlKHZlcnRpY2FsICsgJ3B4ICcgKyBob3Jpem9udGFsICsgJ3B4JykuY29tYmluZWQ7XG5cblx0XHRpZiAod3JpdGVyKSB7XG5cdFx0XHR3cml0ZXIudmFsdWUgPSBjb21iaW5lZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gY29tYmluZWQ7XG5cdH1cblxuXHQvKipcblx0ICogUmUtYXBwbHkgbGFzdCByZWNlaXZlZCBzZXR0aW5ncyAodXNlZnVsIGFmdGVyIERPTSByZS1yZW5kZXIpLlxuXHQgKi9cclxuXHRhcGkucmVhcHBseV9sYXN0ID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0aWYgKCFsYXN0X3NldHRpbmdzX3BhY2spIHJldHVybjtcclxuXHRcdGFwaS5hcHBseShsYXN0X3NldHRpbmdzX3BhY2ssICdmb3JtJywgeyB0cmlnZ2VyX2NoYW5nZTogdHJ1ZSB9KTtcclxuXHR9O1xyXG5cclxuXHRhcGkuaW5pdCA9IGZ1bmN0aW9uICgpIHtcblx0XHRpbml0X2NvbG9yaXNfcGlja2VycyhkKTtcblxuXHRcdC8vIElmIGFwcGx5IGV2ZW50IGZpcmVkIGJlZm9yZSBpbml0LCB0cnkgYWdhaW4gbm93LlxuXHRcdGlmIChsYXN0X3NldHRpbmdzX3BhY2spIHNjaGVkdWxlX2FwcGx5X3JldHJ5KCk7XG5cdH07XG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIERPTSBFdmVudHMgKEFKQVggbGF5ZXIpXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0Ly8gU2F2ZTogbGV0IG1vZHVsZXMgY29udHJpYnV0ZSBpbnRvIHsgb3B0aW9uczp7fSwgY3NzX3ZhcnM6e30gfVxyXG5cdGQuYWRkRXZlbnRMaXN0ZW5lcignd3BiYzpiZmI6Zm9ybV9zZXR0aW5nczpjb2xsZWN0JywgZnVuY3Rpb24gKGUpIHtcclxuXHRcdGNvbnN0IGRldGFpbCA9IChlICYmIGUuZGV0YWlsKSA/IGUuZGV0YWlsIDoge307XHJcblx0XHRjb25zdCB0YXJnZXRfcGFjayA9IGRldGFpbC5zZXR0aW5ncztcclxuXHJcblx0XHRpZiAoIXRhcmdldF9wYWNrIHx8IHR5cGVvZiB0YXJnZXRfcGFjayAhPT0gJ29iamVjdCcpIHJldHVybjtcclxuXHJcblx0XHQvLyBPcHRpb24gQTogd3JpdGUgaW50byB0YXJnZXRfcGFjay5vcHRpb25zXHJcblx0XHRpZiAoIXRhcmdldF9wYWNrLm9wdGlvbnMgfHwgdHlwZW9mIHRhcmdldF9wYWNrLm9wdGlvbnMgIT09ICdvYmplY3QnKSB7XHJcblx0XHRcdHRhcmdldF9wYWNrLm9wdGlvbnMgPSB7fTtcclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCBjb2xsZWN0ZWQgPSBhcGkuY29sbGVjdCgnZm9ybScpO1xuXHRcdE9iamVjdC5rZXlzKGNvbGxlY3RlZCkuZm9yRWFjaChmdW5jdGlvbiAoaykge1xuXHRcdFx0dGFyZ2V0X3BhY2sub3B0aW9uc1trXSA9IGNvbGxlY3RlZFtrXTtcblx0XHR9KTtcblx0XHRzdHJpcF9mb3JtX3N0eWxlX29wdGlvbnNfZnJvbV9wYWNrKHRhcmdldF9wYWNrKTtcblx0fSk7XG5cclxuXHQvLyBMb2FkOiByZWNlaXZlIHNldHRpbmdzIGZyb20gQUpBWCBhbmQgYXBwbHkuXHJcblx0ZC5hZGRFdmVudExpc3RlbmVyKCd3cGJjOmJmYjpmb3JtX3NldHRpbmdzOmFwcGx5JywgZnVuY3Rpb24gKGUpIHtcblx0XHRjb25zdCBkZXRhaWwgPSAoZSAmJiBlLmRldGFpbCkgPyBlLmRldGFpbCA6IHt9O1xuXG5cdFx0bGFzdF9zZXR0aW5nc19wYWNrID0gZGV0YWlsLnNldHRpbmdzIHx8IG51bGw7XG5cblx0XHRyZXRyeV9jb3VudCA9IDA7XG5cdFx0c2NoZWR1bGVfYXBwbHlfcmV0cnkoKTtcblx0fSk7XG5cblx0ZC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbiAoZSkge1xuXHRcdGNvbnN0IGJ0biA9IGUgJiYgZS50YXJnZXQgJiYgZS50YXJnZXQuY2xvc2VzdCA/IGUudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJmYi1yZXNldC1jdXN0b20tYXBwZWFyYW5jZV0nICkgOiBudWxsO1xuXHRcdGlmICggISBidG4gKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGFwaS5yZXNldF9jdXN0b21fYXBwZWFyYW5jZSgpO1xuXHR9LCBmYWxzZSApO1xuXG5cdC8qKlxuXHQgKiBTd2l0Y2ggdGhlIGdsb2JhbCB0aW1lLXBpY2tlciBza2luIHRvIHRoZSBmb3JtLWF3YXJlIEF1dG9tYXRpYyBza2luLlxuXHQgKlxuXHQgKiBUaGUgb3B0aW9uIGlzIHNhdmVkIHRocm91Z2ggdGhlIGV4aXN0aW5nIG5vbmNlLXByb3RlY3RlZCBvcHRpb24gc2F2ZXIuXG5cdCAqIExlZ2FjeSBza2lucyBhcmUgY2hhbmdlZCBvbmx5IGJ5IHRoaXMgZXhwbGljaXQgdXNlciBhY3Rpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGJ1dHRvbiBBY2NlbnQgYWN0aW9uIGJ1dHRvbi5cblx0ICogQHJldHVybnMge2Jvb2xlYW59IFdoZXRoZXIgYW4gQUpBWCBvcHRpb24gc2F2ZSB3YXMgc3RhcnRlZC5cblx0ICovXG5cdGZ1bmN0aW9uIHN3aXRjaF90aW1lX3BpY2tlcl90b19hdXRvbWF0aWMoYnV0dG9uKSB7XG5cdFx0Y29uc3QgYXV0b21hdGljX3NraW4gPSAnL2Nzcy90aW1lX3BpY2tlcl9za2lucy9mb3JtX3N0eWxlLmNzcyc7XG5cdFx0Y29uc3QgY3VycmVudF9za2luID0gYnV0dG9uID8gU3RyaW5nKCBidXR0b24uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWUtcGlja2VyLXNraW4tY3VycmVudCcgKSB8fCAnJyApIDogJyc7XG5cdFx0Y29uc3QgYXV0b21hdGljX3VybCA9IGJ1dHRvbiA/IFN0cmluZyggYnV0dG9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lLXBpY2tlci1za2luLXVybCcgKSB8fCAnJyApIDogJyc7XG5cblx0XHRpZiAoICEgYnV0dG9uIHx8IGN1cnJlbnRfc2tpbi5zbGljZSggLWF1dG9tYXRpY19za2luLmxlbmd0aCApID09PSBhdXRvbWF0aWNfc2tpbiApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKCB0eXBlb2Ygdy53cGJjX3NhdmVfb3B0aW9uX2Zyb21fZWxlbWVudCAhPT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCB0aW1lX2FwaSA9IHcuV1BCQ19CRkJfQ29yZSAmJiB3LldQQkNfQkZCX0NvcmUuVGltZSA/IHcuV1BCQ19CRkJfQ29yZS5UaW1lIDogbnVsbDtcblx0XHRpZiAoIGF1dG9tYXRpY191cmwgKSB7XG5cdFx0XHRwcmV2aW91c190aW1lX3BpY2tlcl9za2luX3VybCA9IGQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjLXRpbWVfcGlja2VyLXNraW4tY3NzJyApXG5cdFx0XHRcdD8gU3RyaW5nKCBkLmdldEVsZW1lbnRCeUlkKCAnd3BiYy10aW1lX3BpY2tlci1za2luLWNzcycgKS5nZXRBdHRyaWJ1dGUoICdocmVmJyApIHx8ICcnIClcblx0XHRcdFx0OiAnJztcblx0XHRcdGlmICggdGltZV9hcGkgJiYgdHlwZW9mIHRpbWVfYXBpLmFwcGx5X3BpY2tlcl9za2luX3VybCA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0dGltZV9hcGkuYXBwbHlfcGlja2VyX3NraW5fdXJsKCBhdXRvbWF0aWNfdXJsICk7XG5cdFx0XHR9IGVsc2UgaWYgKCB0eXBlb2Ygdy53cGJjX19jc3NfX2NoYW5nZV9za2luID09PSAnZnVuY3Rpb24nICYmIGQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjLXRpbWVfcGlja2VyLXNraW4tY3NzJyApICkge1xuXHRcdFx0XHR3LndwYmNfX2Nzc19fY2hhbmdlX3NraW4oIGF1dG9tYXRpY191cmwsICd3cGJjLXRpbWVfcGlja2VyLXNraW4tY3NzJyApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHBlbmRpbmdfdGltZV9waWNrZXJfc2tpbl9idXR0b24gPSBidXR0b247XG5cdFx0YnV0dG9uLnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11LXNhdmUtdmFsdWUnLCBhdXRvbWF0aWNfc2tpbiApO1xuXHRcdHcud3BiY19zYXZlX29wdGlvbl9mcm9tX2VsZW1lbnQoIGJ1dHRvbiApO1xuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvKipcblx0ICogTWFyayB0aGUgQXV0b21hdGljIHNraW4gYXMgY3VycmVudCBhZnRlciB0aGUgb3B0aW9uIHNhdmVyIGNvbmZpcm1zIGl0LlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7dm9pZH1cblx0ICovXG5cdHcud3BiY19iZmJfdGltZV9waWNrZXJfc2tpbl9zYXZlZCA9IGZ1bmN0aW9uICgpIHtcblx0XHRpZiAoIHBlbmRpbmdfdGltZV9waWNrZXJfc2tpbl9idXR0b24gKSB7XG5cdFx0XHRwZW5kaW5nX3RpbWVfcGlja2VyX3NraW5fYnV0dG9uLnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lLXBpY2tlci1za2luLWN1cnJlbnQnLCAnL2Nzcy90aW1lX3BpY2tlcl9za2lucy9mb3JtX3N0eWxlLmNzcycgKTtcblx0XHR9XG5cdFx0aWYgKCB3LldQQkNfQkZCX0NvcmUgJiYgdy5XUEJDX0JGQl9Db3JlLlRpbWUgJiYgdHlwZW9mIHcuV1BCQ19CRkJfQ29yZS5UaW1lLnVpX3NldF9waWNrZXJfc2tpbl92YWx1ZSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdHcuV1BCQ19CRkJfQ29yZS5UaW1lLnVpX3NldF9waWNrZXJfc2tpbl92YWx1ZSggJy9jc3MvdGltZV9waWNrZXJfc2tpbnMvZm9ybV9zdHlsZS5jc3MnICk7XG5cdFx0fVxuXHRcdHBlbmRpbmdfdGltZV9waWNrZXJfc2tpbl9idXR0b24gPSBudWxsO1xuXHRcdHByZXZpb3VzX3RpbWVfcGlja2VyX3NraW5fdXJsID0gJyc7XG5cdH07XG5cblx0aWYgKCB3LmpRdWVyeSApIHtcblx0XHR3LmpRdWVyeSggZCApLm9uKCAnd3BiYzpvcHRpb246YWZ0ZXJTYXZlLndwYmNCZmJUaW1lUGlja2VyU2tpbicsIGZ1bmN0aW9uIChldmVudCwgcmVzcG9uc2UpIHtcblx0XHRcdGlmICggISBwZW5kaW5nX3RpbWVfcGlja2VyX3NraW5fYnV0dG9uIHx8ICggcmVzcG9uc2UgJiYgcmVzcG9uc2Uuc3VjY2VzcyApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBwcmV2aW91c19za2luID0gU3RyaW5nKCBwZW5kaW5nX3RpbWVfcGlja2VyX3NraW5fYnV0dG9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lLXBpY2tlci1za2luLWN1cnJlbnQnICkgfHwgJycgKTtcblxuXHRcdFx0Y29uc3QgdGltZV9hcGkgPSB3LldQQkNfQkZCX0NvcmUgJiYgdy5XUEJDX0JGQl9Db3JlLlRpbWUgPyB3LldQQkNfQkZCX0NvcmUuVGltZSA6IG51bGw7XG5cdFx0XHRpZiAoIHByZXZpb3VzX3RpbWVfcGlja2VyX3NraW5fdXJsICYmIHRpbWVfYXBpICYmIHR5cGVvZiB0aW1lX2FwaS5hcHBseV9waWNrZXJfc2tpbl91cmwgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdHRpbWVfYXBpLmFwcGx5X3BpY2tlcl9za2luX3VybCggcHJldmlvdXNfdGltZV9waWNrZXJfc2tpbl91cmwgKTtcblx0XHRcdH0gZWxzZSBpZiAoIHByZXZpb3VzX3RpbWVfcGlja2VyX3NraW5fdXJsICYmIHR5cGVvZiB3LndwYmNfX2Nzc19fY2hhbmdlX3NraW4gPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdHcud3BiY19fY3NzX19jaGFuZ2Vfc2tpbiggcHJldmlvdXNfdGltZV9waWNrZXJfc2tpbl91cmwsICd3cGJjLXRpbWVfcGlja2VyLXNraW4tY3NzJyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB3LldQQkNfQkZCX0NvcmUgJiYgdy5XUEJDX0JGQl9Db3JlLlRpbWUgJiYgdHlwZW9mIHcuV1BCQ19CRkJfQ29yZS5UaW1lLnVpX3NldF9waWNrZXJfc2tpbl92YWx1ZSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0dy5XUEJDX0JGQl9Db3JlLlRpbWUudWlfc2V0X3BpY2tlcl9za2luX3ZhbHVlKCBwcmV2aW91c19za2luICk7XG5cdFx0XHR9XG5cdFx0XHRwZW5kaW5nX3RpbWVfcGlja2VyX3NraW5fYnV0dG9uID0gbnVsbDtcblx0XHRcdHByZXZpb3VzX3RpbWVfcGlja2VyX3NraW5fdXJsID0gJyc7XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFzayBhY2NlbnQtY2FwYWJsZSBmaWVsZCBwYWNrcyB0byBjb3B5IHRoZSBjdXJyZW50IGFjY2VudCBpbnRvIHRoZWlyXG5cdCAqIGV4aXN0aW5nIGVkaXRhYmxlIGNvbG9yIHByb3BlcnRpZXMuIEZpZWxkIHBhY2tzIHVwZGF0ZSB0aGUgY291bnRlcnMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGJ1dHRvbiBBY3Rpb24gYnV0dG9uLlxuXHQgKiBAcmV0dXJucyB7dm9pZH1cblx0ICovXG5cdGFwaS5hcHBseV9hY2NlbnRfdG9fY29tcG9uZW50cyA9IGZ1bmN0aW9uIChidXR0b24pIHtcblx0XHRjb25zdCB0b2dnbGUgPSBkLmdldEVsZW1lbnRCeUlkKCAnYm9va2luZ19mb3JtX2FjY2VudF9lbmFibGVkJyApO1xuXHRcdGNvbnN0IGNvbG9yX2NvbnRyb2wgPSBkLmdldEVsZW1lbnRCeUlkKCAnYm9va2luZ19mb3JtX2FjY2VudF9jb2xvcicgKTtcblx0XHRjb25zdCBzdGF0dXMgPSBkLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJmYi1hY2NlbnQtY29tcG9uZW50cy1zdGF0dXM9XCIxXCJdJyApO1xuXHRcdGNvbnN0IGkxOG4gPSB3LndwYmNfYmZiX3NldHRpbmdzX3ZhcnMgJiYgdy53cGJjX2JmYl9zZXR0aW5nc192YXJzLmkxOG4gPyB3LndwYmNfYmZiX3NldHRpbmdzX3ZhcnMuaTE4biA6IHt9O1xuXHRcdGNvbnN0IGRlZmF1bHRfYXBwZWFyYW5jZSA9IGdldF9kZWZhdWx0X2N1c3RvbV9hcHBlYXJhbmNlX3NldHRpbmdzKCk7XG5cdFx0Y29uc3QgYWNjZW50X2NvbG9yID0gY29sb3JfY29udHJvbCAmJiAvXiMoPzpbMC05YS1mXXszfXxbMC05YS1mXXs2fSkkL2kudGVzdCggU3RyaW5nKCBjb2xvcl9jb250cm9sLnZhbHVlIHx8ICcnICkudHJpbSgpIClcblx0XHRcdD8gU3RyaW5nKCBjb2xvcl9jb250cm9sLnZhbHVlICkudHJpbSgpXG5cdFx0XHQ6IFN0cmluZyggZGVmYXVsdF9hcHBlYXJhbmNlLmJvb2tpbmdfZm9ybV9hY2NlbnRfY29sb3IgfHwgJycgKS50cmltKCk7XG5cblx0XHRpZiAoICEgdG9nZ2xlIHx8ICEgdG9nZ2xlLmNoZWNrZWQgKSB7XG5cdFx0XHRpZiAoIHN0YXR1cyApIHtcblx0XHRcdFx0c3RhdHVzLnRleHRDb250ZW50ID0gaTE4bi5hY2NlbnRfZW5hYmxlX2ZpcnN0IHx8ICdFbmFibGUgQ3VzdG9tIGFjY2VudCBjb2xvciBmaXJzdC4nO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICggYnV0dG9uICkge1xuXHRcdFx0YnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCBhcHBseV90b19idWlsZGVyID0gZnVuY3Rpb24gKGJ1aWxkZXIpIHtcblx0XHRcdGNvbnN0IGRldGFpbCA9IHtcblx0XHRcdFx0YWNjZW50X2NvbG9yOiBhY2NlbnRfY29sb3IsXG5cdFx0XHRcdGJ1aWxkZXIgICAgIDogYnVpbGRlciB8fCB3LndwYmNfYmZiIHx8IG51bGwsXG5cdFx0XHRcdG1hdGNoZWQgICAgIDogMCxcblx0XHRcdFx0dXBkYXRlZCAgICAgOiAwXG5cdFx0XHR9O1xuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRkLmRpc3BhdGNoRXZlbnQoIG5ldyBDdXN0b21FdmVudCggJ3dwYmM6YmZiOmFwcGx5LWFjY2VudC10by1jb21wb25lbnRzJywge1xuXHRcdFx0XHRcdGJ1YmJsZXM6IHRydWUsXG5cdFx0XHRcdFx0ZGV0YWlsIDogZGV0YWlsXG5cdFx0XHRcdH0gKSApO1xuXHRcdFx0fSBjYXRjaCAoIF9lICkge31cblxuXHRcdFx0Y29uc3QgdGltZV9waWNrZXJfc2F2ZV9zdGFydGVkID0gc3dpdGNoX3RpbWVfcGlja2VyX3RvX2F1dG9tYXRpYyggYnV0dG9uICk7XG5cblx0XHRcdGlmICggc3RhdHVzICkge1xuXHRcdFx0XHRpZiAoIGRldGFpbC51cGRhdGVkID4gMCApIHtcblx0XHRcdFx0XHRzdGF0dXMudGV4dENvbnRlbnQgPSAoIDEgPT09IGRldGFpbC51cGRhdGVkIClcblx0XHRcdFx0XHRcdD8gKCBpMThuLmFjY2VudF9hcHBsaWVkX29uZSB8fCAnQWNjZW50IGFwcGxpZWQgdG8gb25lIGZvcm0gZWxlbWVudC4gU2F2ZSBGb3JtIHRvIGtlZXAgdGhlIGNoYW5nZS4nIClcblx0XHRcdFx0XHRcdDogU3RyaW5nKCBpMThuLmFjY2VudF9hcHBsaWVkX21hbnkgfHwgJ0FjY2VudCBhcHBsaWVkIHRvICVkIGZvcm0gZWxlbWVudHMuIFNhdmUgRm9ybSB0byBrZWVwIHRoZSBjaGFuZ2VzLicgKS5yZXBsYWNlKCAnJWQnLCBTdHJpbmcoIGRldGFpbC51cGRhdGVkICkgKTtcblx0XHRcdFx0fSBlbHNlIGlmICggZGV0YWlsLm1hdGNoZWQgPiAwICkge1xuXHRcdFx0XHRcdHN0YXR1cy50ZXh0Q29udGVudCA9IGkxOG4uYWNjZW50X2FscmVhZHlfYXBwbGllZCB8fCAnQWxsIHN1cHBvcnRlZCBmb3JtIGVsZW1lbnRzIGFscmVhZHkgaGF2ZSB0aGUgY3VycmVudCBhY2NlbnQgY29sb3IuJztcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRzdGF0dXMudGV4dENvbnRlbnQgPSBpMThuLmFjY2VudF9ub19lbGVtZW50cyB8fCAnTm8gYWNjZW50LWNhcGFibGUgZm9ybSBlbGVtZW50cyB3ZXJlIGZvdW5kLic7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0aW1lX3BpY2tlcl9zYXZlX3N0YXJ0ZWQgKSB7XG5cdFx0XHRcdFx0c3RhdHVzLnRleHRDb250ZW50ICs9ICcgJyArICggaTE4bi5hY2NlbnRfdGltZV9waWNrZXJfYXV0b21hdGljIHx8ICdUaW1lIHNsb3RzIG5vdyB1c2UgQXV0b21hdGljIOKAlCBNYXRjaCBCb29raW5nIEZvcm0uJyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICggZGV0YWlsLnVwZGF0ZWQgPiAwICkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGQuZGlzcGF0Y2hFdmVudCggbmV3IEN1c3RvbUV2ZW50KCAnd3BiYzpiZmI6c3RydWN0dXJlOmNoYW5nZScsIHtcblx0XHRcdFx0XHRcdGJ1YmJsZXM6IHRydWUsXG5cdFx0XHRcdFx0XHRkZXRhaWwgOiB7IHNvdXJjZTogJ2FwcGx5LWFjY2VudC10by1jb21wb25lbnRzJywgdXBkYXRlZDogZGV0YWlsLnVwZGF0ZWQgfVxuXHRcdFx0XHRcdH0gKSApO1xuXHRcdFx0XHR9IGNhdGNoICggX2UyICkge31cblx0XHRcdH1cblxuXHRcdFx0aWYgKCBkZXRhaWwuYnVpbGRlciAmJiB0eXBlb2YgZGV0YWlsLmJ1aWxkZXIuX2Fubm91bmNlID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0XHRkZXRhaWwuYnVpbGRlci5fYW5ub3VuY2UoIHN0YXR1cyA/IHN0YXR1cy50ZXh0Q29udGVudCA6ICggaTE4bi5hY2NlbnRfYXBwbGllZF9hbm5vdW5jZW1lbnQgfHwgJ0Zvcm0gYWNjZW50IGFwcGxpZWQuJyApICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGJ1dHRvbiAmJiAhIHRpbWVfcGlja2VyX3NhdmVfc3RhcnRlZCApIHtcblx0XHRcdFx0YnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGlmICggdy53cGJjX2JmYl9hcGkgJiYgdy53cGJjX2JmYl9hcGkucmVhZHkgJiYgdHlwZW9mIHcud3BiY19iZmJfYXBpLnJlYWR5LnRoZW4gPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHR3LndwYmNfYmZiX2FwaS5yZWFkeS50aGVuKCBhcHBseV90b19idWlsZGVyICk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0YXBwbHlfdG9fYnVpbGRlciggdy53cGJjX2JmYiB8fCBudWxsICk7XG5cdH07XG5cblx0ZC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbiAoZSkge1xuXHRcdGNvbnN0IGJ0biA9IGUgJiYgZS50YXJnZXQgJiYgZS50YXJnZXQuY2xvc2VzdCA/IGUudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJmYi1hcHBseS1hY2NlbnQtY29tcG9uZW50cz1cIjFcIl0nICkgOiBudWxsO1xuXHRcdGlmICggISBidG4gKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGFwaS5hcHBseV9hY2NlbnRfdG9fY29tcG9uZW50cyggYnRuICk7XG5cdH0sIGZhbHNlICk7XG5cclxuXHRmdW5jdGlvbiBzY2hlZHVsZV9hcHBseV9yZXRyeSgpIHtcclxuXHRcdGlmIChyYWZfaWQpIHJldHVybjtcclxuXHJcblx0XHRyYWZfaWQgPSB3LnJlcXVlc3RBbmltYXRpb25GcmFtZShmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHJhZl9pZCA9IDA7XHJcblxyXG5cdFx0XHQvLyBJZiBzZXR0aW5ncyBVSSBub3QgcHJlc2VudCB5ZXQsIHJldHJ5IGEgZmV3IGZyYW1lcy5cclxuXHRcdFx0aWYgKCFoYXNfYW55X3Jvd3MoKSkge1xyXG5cdFx0XHRcdHJldHJ5X2NvdW50Kys7XHJcblx0XHRcdFx0aWYgKHJldHJ5X2NvdW50IDwgcmV0cnlfbWF4KSBzY2hlZHVsZV9hcHBseV9yZXRyeSgpO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0YXBpLnJlYXBwbHlfbGFzdCgpO1xuXHRcdFx0aW5pdF9jb2xvcmlzX3BpY2tlcnMoZCk7XG5cdFx0fSk7XG5cdH1cblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gT3B0aW9uYWwgQnVpbGRlciB0aW1pbmcgaG9vayAoU1RSVUNUVVJFX0xPQURFRCkgLT4gcmVhcHBseV9sYXN0KClcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRmdW5jdGlvbiBiaW5kX2J1aWxkZXJfdGltaW5nX2hvb2soYnVpbGRlcl9pbnN0YW5jZSkge1xyXG5cdFx0Y29uc3QgY29yZSA9IHcuV1BCQ19CRkJfQ29yZTtcclxuXHRcdGNvbnN0IGV2ZW50cyA9IChjb3JlICYmIGNvcmUuV1BCQ19CRkJfRXZlbnRzKSA/IGNvcmUuV1BCQ19CRkJfRXZlbnRzIDogKHcuV1BCQ19CRkJfRXZlbnRzIHx8IG51bGwpO1xyXG5cclxuXHJcblx0XHRpZiAoIWJ1aWxkZXJfaW5zdGFuY2UgfHwgIWJ1aWxkZXJfaW5zdGFuY2UuYnVzIHx8ICFldmVudHMgfHwgIWV2ZW50cy5TVFJVQ1RVUkVfTE9BREVEKSByZXR1cm47XHJcblxyXG5cdFx0YnVpbGRlcl9pbnN0YW5jZS5idXMub24oZXZlbnRzLlNUUlVDVFVSRV9MT0FERUQsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0Ly8gQnVpbGRlciBtYXkgcmUtcmVuZGVyIHNldHRpbmdzIHBhbmVsIGFmdGVyIHN0cnVjdHVyZSBsb2FkLlxyXG5cdFx0XHQvLyBSZS1hcHBseSBsYXN0IHNldHRpbmdzIHBhY2sgKGlmIGFueSkuXHJcblx0XHRcdHJldHJ5X2NvdW50ID0gMDtcclxuXHRcdFx0c2NoZWR1bGVfYXBwbHlfcmV0cnkoKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0aWYgKHcud3BiY19iZmJfYXBpICYmIHcud3BiY19iZmJfYXBpLnJlYWR5ICYmIHR5cGVvZiB3LndwYmNfYmZiX2FwaS5yZWFkeS50aGVuID09PSAnZnVuY3Rpb24nKSB7XHJcblx0XHR3LndwYmNfYmZiX2FwaS5yZWFkeS50aGVuKGJpbmRfYnVpbGRlcl90aW1pbmdfaG9vayk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24gKCkgeyBpZiAody5fX0IpIHsgYmluZF9idWlsZGVyX3RpbWluZ19ob29rKCB3Ll9fQiApOyB9IH0sIDApO1xyXG5cdH1cclxuXHJcblx0Ly8gRE9NIHJlYWR5IGluaXQuXHJcblx0aWYgKGQucmVhZHlTdGF0ZSA9PT0gJ2xvYWRpbmcnKSBkLmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBhcGkuaW5pdCk7XHJcblx0ZWxzZSBhcGkuaW5pdCgpO1xyXG5cclxufSkod2luZG93LCBkb2N1bWVudCk7XHJcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBLENBQUMsVUFBVUEsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7RUFDaEIsWUFBWTs7RUFFWjtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLE1BQU1DLEdBQUcsR0FBSUYsQ0FBQyxDQUFDRyxx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
