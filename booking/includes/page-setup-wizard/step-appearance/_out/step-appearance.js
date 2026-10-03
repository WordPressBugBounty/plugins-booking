"use strict";

/**
 * Drive the Setup Wizard Appearance controls and request-local live preview.
 *
 * @package Booking Calendar
 */
(function (window, document) {
  'use strict';

  var module_config = window.wpbc_setup_wizard_appearance || {
    i18n: {}
  };

  /**
   * Create one Appearance step adapter for the shared wizard shell.
   *
   * @param {Object} config Server-owned preset and translation configuration.
   * @return {Object} Step adapter.
   */
  function create_appearance_adapter(config) {
    var shell_api = null;
    var editor = null;
    var preview_frame_request = 0;

    /**
     * Return one translated string with a safe fallback.
     *
     * @param {string} key Translation key.
     * @param {string} fallback Fallback text.
     * @return {string} Translation or fallback.
     */
    function get_message(key, fallback) {
      return config.i18n && config.i18n[key] ? String(config.i18n[key]) : fallback;
    }

    /**
     * Return the current scalar Appearance values.
     *
     * @return {Object} Current values.
     */
    function get_values() {
      var style = editor.node.querySelector('[data-wpbc-appearance-style]:checked');
      var time_mode = editor.node.querySelector('[data-wpbc-appearance-time-mode]:checked');
      return {
        booking_form_style: style ? String(style.value || '') : '',
        booking_form_accent_color: String(editor.accent_value.value || '').toUpperCase(),
        booking_skin: String(editor.skin.value || ''),
        booking_timeslot_picker: time_mode ? String(time_mode.value || '') : ''
      };
    }

    /**
     * Update the selected presentation for style and time radios.
     *
     * @return {void}
     */
    function render_selected_controls() {
      Array.prototype.slice.call(editor.node.querySelectorAll('[data-wpbc-appearance-style]')).forEach(function (input) {
        input.closest('.wpbc_setup_wizard__appearance-style-card').classList.toggle('is-selected', input.checked);
      });
      Array.prototype.slice.call(editor.node.querySelectorAll('[data-wpbc-appearance-time-mode]')).forEach(function (input) {
        input.closest('label').classList.toggle('is-selected', input.checked);
      });
    }

    /**
     * Synchronize preset swatches and the Coloris field presentation.
     *
     * @param {string} color Canonical six-digit hexadecimal color.
     * @return {void}
     */
    function render_accent_controls(color) {
      var coloris_field;
      editor.accent_swatches.forEach(function (swatch) {
        var is_selected = String(swatch.dataset.wpbcAppearanceAccentSwatch || '').toUpperCase() === color;
        swatch.classList.toggle('is-selected', is_selected);
        swatch.setAttribute('aria-pressed', is_selected ? 'true' : 'false');
      });
      coloris_field = editor.accent_value.closest('.clr-field');
      if (coloris_field && /^#[0-9A-F]{6}$/.test(color)) {
        coloris_field.style.color = color;
      }
    }

    /**
     * Normalize the canonical Coloris accent field.
     *
     * @param {string} color Candidate six-digit hexadecimal color.
     * @return {boolean} Whether the color is valid and was normalized.
     */
    function set_accent_color(color) {
      color = String(color || '').toUpperCase();
      if (!/^#[0-9A-F]{6}$/.test(color)) {
        render_accent_controls('');
        return false;
      }
      editor.accent_value.value = color;
      render_accent_controls(color);
      shell_api.clear_field_error('booking_form_accent_color');
      return true;
    }

    /**
     * Return the server-authorized Form Style preset registry.
     *
     * @return {Object} Presets keyed by style identifier.
     */
    function get_form_style_presets() {
      return config.form_style_presets && 'object' === typeof config.form_style_presets ? config.form_style_presets : {};
    }

    /**
     * Return every CSS variable that may be applied by a Form Style preset.
     *
     * @return {string[]} CSS custom-property names.
     */
    function get_form_style_css_var_names() {
      return Array.isArray(config.form_style_css_var_names) ? config.form_style_css_var_names : [];
    }

    /**
     * Return relative luminance for a six-digit hexadecimal color.
     *
     * @param {string} color Valid six-digit hexadecimal color.
     * @return {number} WCAG relative luminance.
     */
    function get_color_luminance(color) {
      var hex = String(color || '#000000').replace('#', '');
      var channels = [0, 1, 2].map(function (index) {
        var channel = parseInt(hex.substr(index * 2, 2), 16) / 255;
        return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    }

    /**
     * Mix one hexadecimal color toward a target color.
     *
     * @param {string} color Source color.
     * @param {string} target Target color.
     * @param {number} amount Target mix ratio from zero to one.
     * @return {string} Mixed six-digit hexadecimal color.
     */
    function mix_colors(color, target, amount) {
      var source = String(color || '#000000').replace('#', '');
      var destination = String(target || '#000000').replace('#', '');
      var channels = [];
      var index;
      for (index = 0; index < 3; index++) {
        channels.push(Math.round(parseInt(source.substr(index * 2, 2), 16) + (parseInt(destination.substr(index * 2, 2), 16) - parseInt(source.substr(index * 2, 2), 16)) * amount));
      }
      return '#' + channels.map(function (channel) {
        return ('0' + channel.toString(16)).slice(-2);
      }).join('');
    }

    /**
     * Add the selected accent to one preset CSS-variable map.
     *
     * @param {Object} css_vars Preset CSS variables.
     * @param {string} accent Valid six-digit hexadecimal accent.
     * @return {Object} CSS variables with accent overlays.
     */
    function apply_accent_to_css_vars(css_vars, accent) {
      var contrast = get_color_luminance(accent) > 0.18 ? '#000000' : '#ffffff';
      var hover = mix_colors(accent, '#ffffff' === contrast ? '#000000' : '#ffffff', 0.10);
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
        '--wpbc_form-button-hover-text-color': contrast,
        '--wpbc_form-button-light-hover-border-color': accent,
        '--wpbc_form-button-primary-hover-border-color': hover,
        '--wpbc_form-page-break-color': accent
      };
      return Object.assign({}, css_vars, accent_overlay);
    }

    /**
     * Apply style classes, preset variables, and accent variables in place.
     *
     * @return {void}
     */
    function apply_form_style_to_preview() {
      var values = get_values();
      var presets = get_form_style_presets();
      var preset = presets[values.booking_form_style] || presets.light_bordered || {};
      var css_vars = preset.css_vars && 'object' === typeof preset.css_vars ? preset.css_vars : {};
      var css_var_names = get_form_style_css_var_names();
      var targets = Array.prototype.slice.call(editor.preview_root.querySelectorAll('.wpbc_container.wpbc_form, .wpbc_bfb_form, .wpbc_bfb__form_preview_section_container'));
      if (!/^#[0-9A-F]{6}$/.test(values.booking_form_accent_color)) {
        return;
      }
      css_vars = apply_accent_to_css_vars(css_vars, values.booking_form_accent_color);
      targets.forEach(function (target) {
        target.classList.remove('wpbc_theme_dark_1', 'wpbc_bfb_form_appearance_custom');
        css_var_names.forEach(function (variable_name) {
          target.style.removeProperty(variable_name);
        });
        Object.keys(css_vars).forEach(function (variable_name) {
          if ('' !== String(css_vars[variable_name] || '')) {
            target.style.setProperty(variable_name, css_vars[variable_name]);
          }
        });
        if (preset.theme_class) {
          target.classList.add(String(preset.theme_class));
        }
      });
    }

    /**
     * Apply the selected server-resolved calendar skin without rebuilding markup.
     *
     * @return {void}
     */
    function apply_calendar_skin_to_preview() {
      var option = editor.skin.options[editor.skin.selectedIndex];
      var skin_url = option ? String(option.dataset.wpbcCalendarSkinUrl || '') : '';
      if (skin_url && 'function' === typeof window.wpbc__calendar__change_skin && document.getElementById('wpbc-calendar-skin-css')) {
        window.wpbc__calendar__change_skin(skin_url);
      }
    }

    /**
     * Switch the existing time controls between select and time-picker views.
     *
     * @return {void}
     */
    function apply_time_mode_to_preview() {
      var is_enabled = 'On' === get_values().booking_timeslot_picker;
      var time_selectors = 'select[name^="rangetime"], select[name^="starttime"], select[name^="endtime"], select[name^="durationtime"]';
      if (window._wpbc && 'function' === typeof window._wpbc.set_other_param) {
        window._wpbc.set_other_param('is_enabled_booking_timeslot_picker', is_enabled);
      }
      if (is_enabled) {
        if (window._wpbc && 'function' === typeof window.wpbc_hook__init_timeselector) {
          window.wpbc_hook__init_timeselector();
        }
        return;
      }
      if ('function' === typeof window.wpbc_hook__destroy_timeselector) {
        window.wpbc_hook__destroy_timeselector(editor.preview_root);
        return;
      }
      Array.prototype.slice.call(editor.preview_root.querySelectorAll('.wpbc_times_selector')).forEach(function (selector) {
        selector.remove();
      });
      Array.prototype.slice.call(editor.preview_root.querySelectorAll(time_selectors)).forEach(function (select) {
        select.style.display = '';
      });
    }

    /**
     * Coalesce continuous Coloris input into one animation-frame update.
     *
     * @return {void}
     */
    function schedule_form_preview_update() {
      if (preview_frame_request) {
        window.cancelAnimationFrame(preview_frame_request);
      }
      preview_frame_request = window.requestAnimationFrame(function () {
        preview_frame_request = 0;
        apply_form_style_to_preview();
      });
    }

    /**
     * Handle accent shortcut activation.
     *
     * @param {MouseEvent} event Click event.
     * @return {void}
     */
    function handle_click(event) {
      var accent_swatch = event.target.closest('[data-wpbc-appearance-accent-swatch]');
      if (accent_swatch && set_accent_color(accent_swatch.dataset.wpbcAppearanceAccentSwatch)) {
        schedule_form_preview_update();
      }
    }

    /**
     * Handle canonical select and radio changes without a network request.
     *
     * @param {Event} event Change event.
     * @return {void}
     */
    function handle_change(event) {
      if (event.target.matches('[data-wpbc-appearance-style]')) {
        shell_api.clear_field_error('booking_form_style');
        render_selected_controls();
        apply_form_style_to_preview();
      } else if (event.target.matches('[data-wpbc-appearance-time-mode]')) {
        shell_api.clear_field_error('booking_timeslot_picker');
        render_selected_controls();
        apply_time_mode_to_preview();
      } else if (event.target.matches('[data-wpbc-appearance-preview-field]')) {
        shell_api.clear_field_error('booking_skin');
        apply_calendar_skin_to_preview();
      }
    }

    /**
     * Validate and apply continuous accent input.
     *
     * @param {Event} event Input event.
     * @return {void}
     */
    function handle_accent_input(event) {
      if (set_accent_color(event.target.value)) {
        schedule_form_preview_update();
      }
    }

    /**
     * Initialize this module against shell-provided APIs.
     *
     * @param {Object} registered_shell_api Shared wizard adapter services.
     * @return {void}
     */
    function initialize(registered_shell_api) {
      var editor_node;
      shell_api = registered_shell_api;
      editor_node = shell_api.root.querySelector('[data-wpbc-appearance-editor]');
      if (!editor_node) {
        return;
      }
      editor = {
        node: editor_node,
        accent_value: editor_node.querySelector('[data-wpbc-appearance-accent-value]'),
        accent_swatches: Array.prototype.slice.call(editor_node.querySelectorAll('[data-wpbc-appearance-accent-swatch]')),
        skin: editor_node.querySelector('[name="booking_skin"]'),
        preview_root: editor_node.querySelector('[data-wpbc-appearance-inline-preview]')
      };
      if (!editor.accent_value || !editor.skin || !editor.preview_root) {
        return;
      }
      editor.node.addEventListener('click', handle_click);
      editor.node.addEventListener('change', handle_change);
      editor.accent_value.addEventListener('input', handle_accent_input);
      if ('function' === typeof window.Coloris) {
        window.Coloris({
          el: '.wpbc_setup_wizard__appearance-coloris',
          alpha: false,
          format: 'hex',
          themeMode: 'auto',
          onChange: function (color, current_input) {
            if (current_input === editor.accent_value && set_accent_color(color)) {
              schedule_form_preview_update();
            }
          }
        });
      }
      render_selected_controls();
      set_accent_color(editor.accent_value.value);
      apply_form_style_to_preview();
      apply_calendar_skin_to_preview();
      apply_time_mode_to_preview();
    }

    /**
     * Validate required fields before forward navigation.
     *
     * @return {HTMLElement|null} First invalid control, or null.
     */
    function validate() {
      var values = get_values();
      if (!values.booking_form_style) {
        return shell_api.set_field_error('booking_form_style', get_message('style_required', 'Choose a starting style.'));
      }
      if (!/^#[0-9A-F]{6}$/.test(values.booking_form_accent_color)) {
        shell_api.set_field_error('booking_form_accent_color', get_message('accent_required', 'Choose a valid accent color.'));
        return editor.accent_value;
      }
      if (!values.booking_skin) {
        return shell_api.set_field_error('booking_skin', get_message('skin_required', 'Choose a calendar skin.'));
      }
      if (!values.booking_timeslot_picker) {
        return shell_api.set_field_error('booking_timeslot_picker', get_message('time_required', 'Choose how time slots are displayed.'));
      }
      return null;
    }
    return {
      initialize: initialize,
      sync: function () {},
      validate: validate
    };
  }
  window.wpbc_setup_editor_modules = window.wpbc_setup_editor_modules || {};
  window.wpbc_setup_editor_modules.appearance = {
    create: create_appearance_adapter
  };
  if (window.wpbc_setup_wizard_api && 'function' === typeof window.wpbc_setup_wizard_api.register_step_adapter) {
    window.wpbc_setup_wizard_api.register_step_adapter(create_appearance_adapter(module_config));
  }
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR1cC13aXphcmQvc3RlcC1hcHBlYXJhbmNlL19vdXQvc3RlcC1hcHBlYXJhbmNlLmpzIiwibmFtZXMiOlsid2luZG93IiwiZG9jdW1lbnQiLCJtb2R1bGVfY29uZmlnIiwid3BiY19zZXR1cF93aXphcmRfYXBwZWFyYW5jZSIsImkxOG4iLCJjcmVhdGVfYXBwZWFyYW5jZV9hZGFwdGVyIiwiY29uZmlnIiwic2hlbGxfYXBpIiwiZWRpdG9yIiwicHJldmlld19mcmFtZV9yZXF1ZXN0IiwiZ2V0X21lc3NhZ2UiLCJrZXkiLCJmYWxsYmFjayIsIlN0cmluZyIsImdldF92YWx1ZXMiLCJzdHlsZSIsIm5vZGUiLCJxdWVyeVNlbGVjdG9yIiwidGltZV9tb2RlIiwiYm9va2luZ19mb3JtX3N0eWxlIiwidmFsdWUiLCJib29raW5nX2Zvcm1fYWNjZW50X2NvbG9yIiwiYWNjZW50X3ZhbHVlIiwidG9VcHBlckNhc2UiLCJib29raW5nX3NraW4iLCJza2luIiwiYm9va2luZ190aW1lc2xvdF9waWNrZXIiLCJyZW5kZXJfc2VsZWN0ZWRfY29udHJvbHMiLCJBcnJheSIsInByb3RvdHlwZSIsInNsaWNlIiwiY2FsbCIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJmb3JFYWNoIiwiaW5wdXQiLCJjbG9zZXN0IiwiY2xhc3NMaXN0IiwidG9nZ2xlIiwiY2hlY2tlZCIsInJlbmRlcl9hY2NlbnRfY29udHJvbHMiLCJjb2xvciIsImNvbG9yaXNfZmllbGQiLCJhY2NlbnRfc3dhdGNoZXMiLCJzd2F0Y2giLCJpc19zZWxlY3RlZCIsImRhdGFzZXQiLCJ3cGJjQXBwZWFyYW5jZUFjY2VudFN3YXRjaCIsInNldEF0dHJpYnV0ZSIsInRlc3QiLCJzZXRfYWNjZW50X2NvbG9yIiwiY2xlYXJfZmllbGRfZXJyb3IiLCJnZXRfZm9ybV9zdHlsZV9wcmVzZXRzIiwiZm9ybV9zdHlsZV9wcmVzZXRzIiwiZ2V0X2Zvcm1fc3R5bGVfY3NzX3Zhcl9uYW1lcyIsImlzQXJyYXkiLCJmb3JtX3N0eWxlX2Nzc192YXJfbmFtZXMiLCJnZXRfY29sb3JfbHVtaW5hbmNlIiwiaGV4IiwicmVwbGFjZSIsImNoYW5uZWxzIiwibWFwIiwiaW5kZXgiLCJjaGFubmVsIiwicGFyc2VJbnQiLCJzdWJzdHIiLCJNYXRoIiwicG93IiwibWl4X2NvbG9ycyIsInRhcmdldCIsImFtb3VudCIsInNvdXJjZSIsImRlc3RpbmF0aW9uIiwicHVzaCIsInJvdW5kIiwidG9TdHJpbmciLCJqb2luIiwiYXBwbHlfYWNjZW50X3RvX2Nzc192YXJzIiwiY3NzX3ZhcnMiLCJhY2NlbnQiLCJjb250cmFzdCIsImhvdmVyIiwiYWNjZW50X292ZXJsYXkiLCJPYmplY3QiLCJhc3NpZ24iLCJhcHBseV9mb3JtX3N0eWxlX3RvX3ByZXZpZXciLCJ2YWx1ZXMiLCJwcmVzZXRzIiwicHJlc2V0IiwibGlnaHRfYm9yZGVyZWQiLCJjc3NfdmFyX25hbWVzIiwidGFyZ2V0cyIsInByZXZpZXdfcm9vdCIsInJlbW92ZSIsInZhcmlhYmxlX25hbWUiLCJyZW1vdmVQcm9wZXJ0eSIsImtleXMiLCJzZXRQcm9wZXJ0eSIsInRoZW1lX2NsYXNzIiwiYWRkIiwiYXBwbHlfY2FsZW5kYXJfc2tpbl90b19wcmV2aWV3Iiwib3B0aW9uIiwib3B0aW9ucyIsInNlbGVjdGVkSW5kZXgiLCJza2luX3VybCIsIndwYmNDYWxlbmRhclNraW5VcmwiLCJ3cGJjX19jYWxlbmRhcl9fY2hhbmdlX3NraW4iLCJnZXRFbGVtZW50QnlJZCIsImFwcGx5X3RpbWVfbW9kZV90b19wcmV2aWV3IiwiaXNfZW5hYmxlZCIsInRpbWVfc2VsZWN0b3JzIiwiX3dwYmMiLCJzZXRfb3RoZXJfcGFyYW0iLCJ3cGJjX2hvb2tfX2luaXRfdGltZXNlbGVjdG9yIiwid3BiY19ob29rX19kZXN0cm95X3RpbWVzZWxlY3RvciIsInNlbGVjdG9yIiwic2VsZWN0IiwiZGlzcGxheSIsInNjaGVkdWxlX2Zvcm1fcHJldmlld191cGRhdGUiLCJjYW5jZWxBbmltYXRpb25GcmFtZSIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsImhhbmRsZV9jbGljayIsImV2ZW50IiwiYWNjZW50X3N3YXRjaCIsImhhbmRsZV9jaGFuZ2UiLCJtYXRjaGVzIiwiaGFuZGxlX2FjY2VudF9pbnB1dCIsImluaXRpYWxpemUiLCJyZWdpc3RlcmVkX3NoZWxsX2FwaSIsImVkaXRvcl9ub2RlIiwicm9vdCIsImFkZEV2ZW50TGlzdGVuZXIiLCJDb2xvcmlzIiwiZWwiLCJhbHBoYSIsImZvcm1hdCIsInRoZW1lTW9kZSIsIm9uQ2hhbmdlIiwiY3VycmVudF9pbnB1dCIsInZhbGlkYXRlIiwic2V0X2ZpZWxkX2Vycm9yIiwic3luYyIsIndwYmNfc2V0dXBfZWRpdG9yX21vZHVsZXMiLCJhcHBlYXJhbmNlIiwiY3JlYXRlIiwid3BiY19zZXR1cF93aXphcmRfYXBpIiwicmVnaXN0ZXJfc3RlcF9hZGFwdGVyIl0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1zZXR1cC13aXphcmQvc3RlcC1hcHBlYXJhbmNlL19zcmMvc3RlcC1hcHBlYXJhbmNlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogRHJpdmUgdGhlIFNldHVwIFdpemFyZCBBcHBlYXJhbmNlIGNvbnRyb2xzIGFuZCByZXF1ZXN0LWxvY2FsIGxpdmUgcHJldmlldy5cbiAqXG4gKiBAcGFja2FnZSBCb29raW5nIENhbGVuZGFyXG4gKi9cbiggZnVuY3Rpb24gKCB3aW5kb3csIGRvY3VtZW50ICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIG1vZHVsZV9jb25maWcgPSB3aW5kb3cud3BiY19zZXR1cF93aXphcmRfYXBwZWFyYW5jZSB8fCB7IGkxOG46IHt9IH07XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBvbmUgQXBwZWFyYW5jZSBzdGVwIGFkYXB0ZXIgZm9yIHRoZSBzaGFyZWQgd2l6YXJkIHNoZWxsLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIFNlcnZlci1vd25lZCBwcmVzZXQgYW5kIHRyYW5zbGF0aW9uIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge09iamVjdH0gU3RlcCBhZGFwdGVyLlxuXHQgKi9cblx0ZnVuY3Rpb24gY3JlYXRlX2FwcGVhcmFuY2VfYWRhcHRlciggY29uZmlnICkge1xuXHRcdHZhciBzaGVsbF9hcGkgPSBudWxsO1xuXHRcdHZhciBlZGl0b3IgPSBudWxsO1xuXHRcdHZhciBwcmV2aWV3X2ZyYW1lX3JlcXVlc3QgPSAwO1xuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIG9uZSB0cmFuc2xhdGVkIHN0cmluZyB3aXRoIGEgc2FmZSBmYWxsYmFjay5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVHJhbnNsYXRpb24ga2V5LlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBmYWxsYmFjayBGYWxsYmFjayB0ZXh0LlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gVHJhbnNsYXRpb24gb3IgZmFsbGJhY2suXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X21lc3NhZ2UoIGtleSwgZmFsbGJhY2sgKSB7XG5cdFx0XHRyZXR1cm4gY29uZmlnLmkxOG4gJiYgY29uZmlnLmkxOG5bIGtleSBdID8gU3RyaW5nKCBjb25maWcuaTE4blsga2V5IF0gKSA6IGZhbGxiYWNrO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgY3VycmVudCBzY2FsYXIgQXBwZWFyYW5jZSB2YWx1ZXMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IEN1cnJlbnQgdmFsdWVzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF92YWx1ZXMoKSB7XG5cdFx0XHR2YXIgc3R5bGUgPSBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1hcHBlYXJhbmNlLXN0eWxlXTpjaGVja2VkJyApO1xuXHRcdFx0dmFyIHRpbWVfbW9kZSA9IGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWFwcGVhcmFuY2UtdGltZS1tb2RlXTpjaGVja2VkJyApO1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRib29raW5nX2Zvcm1fc3R5bGU6IHN0eWxlID8gU3RyaW5nKCBzdHlsZS52YWx1ZSB8fCAnJyApIDogJycsXG5cdFx0XHRcdGJvb2tpbmdfZm9ybV9hY2NlbnRfY29sb3I6IFN0cmluZyggZWRpdG9yLmFjY2VudF92YWx1ZS52YWx1ZSB8fCAnJyApLnRvVXBwZXJDYXNlKCksXG5cdFx0XHRcdGJvb2tpbmdfc2tpbjogU3RyaW5nKCBlZGl0b3Iuc2tpbi52YWx1ZSB8fCAnJyApLFxuXHRcdFx0XHRib29raW5nX3RpbWVzbG90X3BpY2tlcjogdGltZV9tb2RlID8gU3RyaW5nKCB0aW1lX21vZGUudmFsdWUgfHwgJycgKSA6ICcnXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFVwZGF0ZSB0aGUgc2VsZWN0ZWQgcHJlc2VudGF0aW9uIGZvciBzdHlsZSBhbmQgdGltZSByYWRpb3MuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9zZWxlY3RlZF9jb250cm9scygpIHtcblx0XHRcdEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1hcHBlYXJhbmNlLXN0eWxlXScgKSApLmZvckVhY2goIGZ1bmN0aW9uICggaW5wdXQgKSB7XG5cdFx0XHRcdGlucHV0LmNsb3Nlc3QoICcud3BiY19zZXR1cF93aXphcmRfX2FwcGVhcmFuY2Utc3R5bGUtY2FyZCcgKS5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtc2VsZWN0ZWQnLCBpbnB1dC5jaGVja2VkICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtYXBwZWFyYW5jZS10aW1lLW1vZGVdJyApICkuZm9yRWFjaCggZnVuY3Rpb24gKCBpbnB1dCApIHtcblx0XHRcdFx0aW5wdXQuY2xvc2VzdCggJ2xhYmVsJyApLmNsYXNzTGlzdC50b2dnbGUoICdpcy1zZWxlY3RlZCcsIGlucHV0LmNoZWNrZWQgKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTeW5jaHJvbml6ZSBwcmVzZXQgc3dhdGNoZXMgYW5kIHRoZSBDb2xvcmlzIGZpZWxkIHByZXNlbnRhdGlvbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBjb2xvciBDYW5vbmljYWwgc2l4LWRpZ2l0IGhleGFkZWNpbWFsIGNvbG9yLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX2FjY2VudF9jb250cm9scyggY29sb3IgKSB7XG5cdFx0XHR2YXIgY29sb3Jpc19maWVsZDtcblxuXHRcdFx0ZWRpdG9yLmFjY2VudF9zd2F0Y2hlcy5mb3JFYWNoKCBmdW5jdGlvbiAoIHN3YXRjaCApIHtcblx0XHRcdFx0dmFyIGlzX3NlbGVjdGVkID0gU3RyaW5nKCBzd2F0Y2guZGF0YXNldC53cGJjQXBwZWFyYW5jZUFjY2VudFN3YXRjaCB8fCAnJyApLnRvVXBwZXJDYXNlKCkgPT09IGNvbG9yO1xuXG5cdFx0XHRcdHN3YXRjaC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtc2VsZWN0ZWQnLCBpc19zZWxlY3RlZCApO1xuXHRcdFx0XHRzd2F0Y2guc2V0QXR0cmlidXRlKCAnYXJpYS1wcmVzc2VkJywgaXNfc2VsZWN0ZWQgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdGNvbG9yaXNfZmllbGQgPSBlZGl0b3IuYWNjZW50X3ZhbHVlLmNsb3Nlc3QoICcuY2xyLWZpZWxkJyApO1xuXHRcdFx0aWYgKCBjb2xvcmlzX2ZpZWxkICYmIC9eI1swLTlBLUZdezZ9JC8udGVzdCggY29sb3IgKSApIHtcblx0XHRcdFx0Y29sb3Jpc19maWVsZC5zdHlsZS5jb2xvciA9IGNvbG9yO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE5vcm1hbGl6ZSB0aGUgY2Fub25pY2FsIENvbG9yaXMgYWNjZW50IGZpZWxkLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGNvbG9yIENhbmRpZGF0ZSBzaXgtZGlnaXQgaGV4YWRlY2ltYWwgY29sb3IuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gV2hldGhlciB0aGUgY29sb3IgaXMgdmFsaWQgYW5kIHdhcyBub3JtYWxpemVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNldF9hY2NlbnRfY29sb3IoIGNvbG9yICkge1xuXHRcdFx0Y29sb3IgPSBTdHJpbmcoIGNvbG9yIHx8ICcnICkudG9VcHBlckNhc2UoKTtcblx0XHRcdGlmICggISAvXiNbMC05QS1GXXs2fSQvLnRlc3QoIGNvbG9yICkgKSB7XG5cdFx0XHRcdHJlbmRlcl9hY2NlbnRfY29udHJvbHMoICcnICk7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0ZWRpdG9yLmFjY2VudF92YWx1ZS52YWx1ZSA9IGNvbG9yO1xuXHRcdFx0cmVuZGVyX2FjY2VudF9jb250cm9scyggY29sb3IgKTtcblx0XHRcdHNoZWxsX2FwaS5jbGVhcl9maWVsZF9lcnJvciggJ2Jvb2tpbmdfZm9ybV9hY2NlbnRfY29sb3InICk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgc2VydmVyLWF1dGhvcml6ZWQgRm9ybSBTdHlsZSBwcmVzZXQgcmVnaXN0cnkuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IFByZXNldHMga2V5ZWQgYnkgc3R5bGUgaWRlbnRpZmllci5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfZm9ybV9zdHlsZV9wcmVzZXRzKCkge1xuXHRcdFx0cmV0dXJuIGNvbmZpZy5mb3JtX3N0eWxlX3ByZXNldHMgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBjb25maWcuZm9ybV9zdHlsZV9wcmVzZXRzXG5cdFx0XHRcdD8gY29uZmlnLmZvcm1fc3R5bGVfcHJlc2V0c1xuXHRcdFx0XHQ6IHt9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBldmVyeSBDU1MgdmFyaWFibGUgdGhhdCBtYXkgYmUgYXBwbGllZCBieSBhIEZvcm0gU3R5bGUgcHJlc2V0LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7c3RyaW5nW119IENTUyBjdXN0b20tcHJvcGVydHkgbmFtZXMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2Zvcm1fc3R5bGVfY3NzX3Zhcl9uYW1lcygpIHtcblx0XHRcdHJldHVybiBBcnJheS5pc0FycmF5KCBjb25maWcuZm9ybV9zdHlsZV9jc3NfdmFyX25hbWVzICkgPyBjb25maWcuZm9ybV9zdHlsZV9jc3NfdmFyX25hbWVzIDogW107XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHJlbGF0aXZlIGx1bWluYW5jZSBmb3IgYSBzaXgtZGlnaXQgaGV4YWRlY2ltYWwgY29sb3IuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gY29sb3IgVmFsaWQgc2l4LWRpZ2l0IGhleGFkZWNpbWFsIGNvbG9yLlxuXHRcdCAqIEByZXR1cm4ge251bWJlcn0gV0NBRyByZWxhdGl2ZSBsdW1pbmFuY2UuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2NvbG9yX2x1bWluYW5jZSggY29sb3IgKSB7XG5cdFx0XHR2YXIgaGV4ID0gU3RyaW5nKCBjb2xvciB8fCAnIzAwMDAwMCcgKS5yZXBsYWNlKCAnIycsICcnICk7XG5cdFx0XHR2YXIgY2hhbm5lbHMgPSBbIDAsIDEsIDIgXS5tYXAoIGZ1bmN0aW9uICggaW5kZXggKSB7XG5cdFx0XHRcdHZhciBjaGFubmVsID0gcGFyc2VJbnQoIGhleC5zdWJzdHIoIGluZGV4ICogMiwgMiApLCAxNiApIC8gMjU1O1xuXHRcdFx0XHRyZXR1cm4gY2hhbm5lbCA8PSAwLjAzOTI4ID8gY2hhbm5lbCAvIDEyLjkyIDogTWF0aC5wb3coICggY2hhbm5lbCArIDAuMDU1ICkgLyAxLjA1NSwgMi40ICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiAoIDAuMjEyNiAqIGNoYW5uZWxzWyAwIF0gKSArICggMC43MTUyICogY2hhbm5lbHNbIDEgXSApICsgKCAwLjA3MjIgKiBjaGFubmVsc1sgMiBdICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTWl4IG9uZSBoZXhhZGVjaW1hbCBjb2xvciB0b3dhcmQgYSB0YXJnZXQgY29sb3IuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gY29sb3IgU291cmNlIGNvbG9yLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0YXJnZXQgVGFyZ2V0IGNvbG9yLlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBhbW91bnQgVGFyZ2V0IG1peCByYXRpbyBmcm9tIHplcm8gdG8gb25lLlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gTWl4ZWQgc2l4LWRpZ2l0IGhleGFkZWNpbWFsIGNvbG9yLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG1peF9jb2xvcnMoIGNvbG9yLCB0YXJnZXQsIGFtb3VudCApIHtcblx0XHRcdHZhciBzb3VyY2UgPSBTdHJpbmcoIGNvbG9yIHx8ICcjMDAwMDAwJyApLnJlcGxhY2UoICcjJywgJycgKTtcblx0XHRcdHZhciBkZXN0aW5hdGlvbiA9IFN0cmluZyggdGFyZ2V0IHx8ICcjMDAwMDAwJyApLnJlcGxhY2UoICcjJywgJycgKTtcblx0XHRcdHZhciBjaGFubmVscyA9IFtdO1xuXHRcdFx0dmFyIGluZGV4O1xuXG5cdFx0XHRmb3IgKCBpbmRleCA9IDA7IGluZGV4IDwgMzsgaW5kZXgrKyApIHtcblx0XHRcdFx0Y2hhbm5lbHMucHVzaCggTWF0aC5yb3VuZCggcGFyc2VJbnQoIHNvdXJjZS5zdWJzdHIoIGluZGV4ICogMiwgMiApLCAxNiApICsgKCAoIHBhcnNlSW50KCBkZXN0aW5hdGlvbi5zdWJzdHIoIGluZGV4ICogMiwgMiApLCAxNiApIC0gcGFyc2VJbnQoIHNvdXJjZS5zdWJzdHIoIGluZGV4ICogMiwgMiApLCAxNiApICkgKiBhbW91bnQgKSApICk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiAnIycgKyBjaGFubmVscy5tYXAoIGZ1bmN0aW9uICggY2hhbm5lbCApIHtcblx0XHRcdFx0cmV0dXJuICggJzAnICsgY2hhbm5lbC50b1N0cmluZyggMTYgKSApLnNsaWNlKCAtMiApO1xuXHRcdFx0fSApLmpvaW4oICcnICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQWRkIHRoZSBzZWxlY3RlZCBhY2NlbnQgdG8gb25lIHByZXNldCBDU1MtdmFyaWFibGUgbWFwLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGNzc192YXJzIFByZXNldCBDU1MgdmFyaWFibGVzLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBhY2NlbnQgVmFsaWQgc2l4LWRpZ2l0IGhleGFkZWNpbWFsIGFjY2VudC5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IENTUyB2YXJpYWJsZXMgd2l0aCBhY2NlbnQgb3ZlcmxheXMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYXBwbHlfYWNjZW50X3RvX2Nzc192YXJzKCBjc3NfdmFycywgYWNjZW50ICkge1xuXHRcdFx0dmFyIGNvbnRyYXN0ID0gZ2V0X2NvbG9yX2x1bWluYW5jZSggYWNjZW50ICkgPiAwLjE4ID8gJyMwMDAwMDAnIDogJyNmZmZmZmYnO1xuXHRcdFx0dmFyIGhvdmVyID0gbWl4X2NvbG9ycyggYWNjZW50LCAnI2ZmZmZmZicgPT09IGNvbnRyYXN0ID8gJyMwMDAwMDAnIDogJyNmZmZmZmYnLCAwLjEwICk7XG5cdFx0XHR2YXIgYWNjZW50X292ZXJsYXkgPSB7XG5cdFx0XHRcdCctLXdwYmNfZm9ybS1hY2NlbnQtY29sb3InOiBhY2NlbnQsXG5cdFx0XHRcdCctLXdwYmNfZm9ybS1hY2NlbnQtaG92ZXItY29sb3InOiBob3Zlcixcblx0XHRcdFx0Jy0td3BiY19mb3JtLWFjY2VudC1jb250cmFzdC1jb2xvcic6IGNvbnRyYXN0LFxuXHRcdFx0XHQnLS13cGJjX2Zvcm0tZmllbGQtZm9jdXMtYm9yZGVyLWNvbG9yJzogYWNjZW50LFxuXHRcdFx0XHQnLS13cGJjX2Zvcm0tZmllbGQtZm9jdXMtc2hhZG93LWNvbG9yJzogYWNjZW50LFxuXHRcdFx0XHQnLS13cGJjX2Zvcm0tY2hvaWNlLWNoZWNrZWQtYm9yZGVyLWNvbG9yJzogYWNjZW50LFxuXHRcdFx0XHQnLS13cGJjX2Zvcm0tY2hvaWNlLWNoZWNrZWQtY29sb3InOiBhY2NlbnQsXG5cdFx0XHRcdCctLXdwYmNfZm9ybS1jaG9pY2UtZm9jdXMtY29sb3InOiBhY2NlbnQsXG5cdFx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tYmFja2dyb3VuZC1jb2xvcic6IGFjY2VudCxcblx0XHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1iYWNrZ3JvdW5kLWNvbG9yLWFsdCc6IGFjY2VudCxcblx0XHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1ib3JkZXItY29sb3InOiBhY2NlbnQsXG5cdFx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tdGV4dC1jb2xvcic6IGNvbnRyYXN0LFxuXHRcdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLXRleHQtY29sb3ItYWx0JzogY29udHJhc3QsXG5cdFx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24taG92ZXItYmFja2dyb3VuZC1jb2xvcic6IGhvdmVyLFxuXHRcdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWhvdmVyLWJvcmRlci1jb2xvcic6IGhvdmVyLFxuXHRcdFx0XHQnLS13cGJjX2Zvcm0tYnV0dG9uLWhvdmVyLXRleHQtY29sb3InOiBjb250cmFzdCxcblx0XHRcdFx0Jy0td3BiY19mb3JtLWJ1dHRvbi1saWdodC1ob3Zlci1ib3JkZXItY29sb3InOiBhY2NlbnQsXG5cdFx0XHRcdCctLXdwYmNfZm9ybS1idXR0b24tcHJpbWFyeS1ob3Zlci1ib3JkZXItY29sb3InOiBob3Zlcixcblx0XHRcdFx0Jy0td3BiY19mb3JtLXBhZ2UtYnJlYWstY29sb3InOiBhY2NlbnRcblx0XHRcdH07XG5cblx0XHRcdHJldHVybiBPYmplY3QuYXNzaWduKCB7fSwgY3NzX3ZhcnMsIGFjY2VudF9vdmVybGF5ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQXBwbHkgc3R5bGUgY2xhc3NlcywgcHJlc2V0IHZhcmlhYmxlcywgYW5kIGFjY2VudCB2YXJpYWJsZXMgaW4gcGxhY2UuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGFwcGx5X2Zvcm1fc3R5bGVfdG9fcHJldmlldygpIHtcblx0XHRcdHZhciB2YWx1ZXMgPSBnZXRfdmFsdWVzKCk7XG5cdFx0XHR2YXIgcHJlc2V0cyA9IGdldF9mb3JtX3N0eWxlX3ByZXNldHMoKTtcblx0XHRcdHZhciBwcmVzZXQgPSBwcmVzZXRzWyB2YWx1ZXMuYm9va2luZ19mb3JtX3N0eWxlIF0gfHwgcHJlc2V0cy5saWdodF9ib3JkZXJlZCB8fCB7fTtcblx0XHRcdHZhciBjc3NfdmFycyA9IHByZXNldC5jc3NfdmFycyAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIHByZXNldC5jc3NfdmFycyA/IHByZXNldC5jc3NfdmFycyA6IHt9O1xuXHRcdFx0dmFyIGNzc192YXJfbmFtZXMgPSBnZXRfZm9ybV9zdHlsZV9jc3NfdmFyX25hbWVzKCk7XG5cdFx0XHR2YXIgdGFyZ2V0cyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBlZGl0b3IucHJldmlld19yb290LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19jb250YWluZXIud3BiY19mb3JtLCAud3BiY19iZmJfZm9ybSwgLndwYmNfYmZiX19mb3JtX3ByZXZpZXdfc2VjdGlvbl9jb250YWluZXInICkgKTtcblxuXHRcdFx0aWYgKCAhIC9eI1swLTlBLUZdezZ9JC8udGVzdCggdmFsdWVzLmJvb2tpbmdfZm9ybV9hY2NlbnRfY29sb3IgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjc3NfdmFycyA9IGFwcGx5X2FjY2VudF90b19jc3NfdmFycyggY3NzX3ZhcnMsIHZhbHVlcy5ib29raW5nX2Zvcm1fYWNjZW50X2NvbG9yICk7XG5cdFx0XHR0YXJnZXRzLmZvckVhY2goIGZ1bmN0aW9uICggdGFyZ2V0ICkge1xuXHRcdFx0XHR0YXJnZXQuY2xhc3NMaXN0LnJlbW92ZSggJ3dwYmNfdGhlbWVfZGFya18xJywgJ3dwYmNfYmZiX2Zvcm1fYXBwZWFyYW5jZV9jdXN0b20nICk7XG5cdFx0XHRcdGNzc192YXJfbmFtZXMuZm9yRWFjaCggZnVuY3Rpb24gKCB2YXJpYWJsZV9uYW1lICkge1xuXHRcdFx0XHRcdHRhcmdldC5zdHlsZS5yZW1vdmVQcm9wZXJ0eSggdmFyaWFibGVfbmFtZSApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdE9iamVjdC5rZXlzKCBjc3NfdmFycyApLmZvckVhY2goIGZ1bmN0aW9uICggdmFyaWFibGVfbmFtZSApIHtcblx0XHRcdFx0XHRpZiAoICcnICE9PSBTdHJpbmcoIGNzc192YXJzWyB2YXJpYWJsZV9uYW1lIF0gfHwgJycgKSApIHtcblx0XHRcdFx0XHRcdHRhcmdldC5zdHlsZS5zZXRQcm9wZXJ0eSggdmFyaWFibGVfbmFtZSwgY3NzX3ZhcnNbIHZhcmlhYmxlX25hbWUgXSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXHRcdFx0XHRpZiAoIHByZXNldC50aGVtZV9jbGFzcyApIHtcblx0XHRcdFx0XHR0YXJnZXQuY2xhc3NMaXN0LmFkZCggU3RyaW5nKCBwcmVzZXQudGhlbWVfY2xhc3MgKSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQXBwbHkgdGhlIHNlbGVjdGVkIHNlcnZlci1yZXNvbHZlZCBjYWxlbmRhciBza2luIHdpdGhvdXQgcmVidWlsZGluZyBtYXJrdXAuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGFwcGx5X2NhbGVuZGFyX3NraW5fdG9fcHJldmlldygpIHtcblx0XHRcdHZhciBvcHRpb24gPSBlZGl0b3Iuc2tpbi5vcHRpb25zWyBlZGl0b3Iuc2tpbi5zZWxlY3RlZEluZGV4IF07XG5cdFx0XHR2YXIgc2tpbl91cmwgPSBvcHRpb24gPyBTdHJpbmcoIG9wdGlvbi5kYXRhc2V0LndwYmNDYWxlbmRhclNraW5VcmwgfHwgJycgKSA6ICcnO1xuXG5cdFx0XHRpZiAoIHNraW5fdXJsICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19fY2FsZW5kYXJfX2NoYW5nZV9za2luICYmIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiYy1jYWxlbmRhci1za2luLWNzcycgKSApIHtcblx0XHRcdFx0d2luZG93LndwYmNfX2NhbGVuZGFyX19jaGFuZ2Vfc2tpbiggc2tpbl91cmwgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTd2l0Y2ggdGhlIGV4aXN0aW5nIHRpbWUgY29udHJvbHMgYmV0d2VlbiBzZWxlY3QgYW5kIHRpbWUtcGlja2VyIHZpZXdzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBhcHBseV90aW1lX21vZGVfdG9fcHJldmlldygpIHtcblx0XHRcdHZhciBpc19lbmFibGVkID0gJ09uJyA9PT0gZ2V0X3ZhbHVlcygpLmJvb2tpbmdfdGltZXNsb3RfcGlja2VyO1xuXHRcdFx0dmFyIHRpbWVfc2VsZWN0b3JzID0gJ3NlbGVjdFtuYW1lXj1cInJhbmdldGltZVwiXSwgc2VsZWN0W25hbWVePVwic3RhcnR0aW1lXCJdLCBzZWxlY3RbbmFtZV49XCJlbmR0aW1lXCJdLCBzZWxlY3RbbmFtZV49XCJkdXJhdGlvbnRpbWVcIl0nO1xuXG5cdFx0XHRpZiAoIHdpbmRvdy5fd3BiYyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93Ll93cGJjLnNldF9vdGhlcl9wYXJhbSApIHtcblx0XHRcdFx0d2luZG93Ll93cGJjLnNldF9vdGhlcl9wYXJhbSggJ2lzX2VuYWJsZWRfYm9va2luZ190aW1lc2xvdF9waWNrZXInLCBpc19lbmFibGVkICk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICggaXNfZW5hYmxlZCApIHtcblx0XHRcdFx0aWYgKCB3aW5kb3cuX3dwYmMgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX2hvb2tfX2luaXRfdGltZXNlbGVjdG9yICkge1xuXHRcdFx0XHRcdHdpbmRvdy53cGJjX2hvb2tfX2luaXRfdGltZXNlbGVjdG9yKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfaG9va19fZGVzdHJveV90aW1lc2VsZWN0b3IgKSB7XG5cdFx0XHRcdHdpbmRvdy53cGJjX2hvb2tfX2Rlc3Ryb3lfdGltZXNlbGVjdG9yKCBlZGl0b3IucHJldmlld19yb290ICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0QXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIGVkaXRvci5wcmV2aWV3X3Jvb3QucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX3RpbWVzX3NlbGVjdG9yJyApICkuZm9yRWFjaCggZnVuY3Rpb24gKCBzZWxlY3RvciApIHtcblx0XHRcdFx0c2VsZWN0b3IucmVtb3ZlKCk7XG5cdFx0XHR9ICk7XG5cdFx0XHRBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggZWRpdG9yLnByZXZpZXdfcm9vdC5xdWVyeVNlbGVjdG9yQWxsKCB0aW1lX3NlbGVjdG9ycyApICkuZm9yRWFjaCggZnVuY3Rpb24gKCBzZWxlY3QgKSB7XG5cdFx0XHRcdHNlbGVjdC5zdHlsZS5kaXNwbGF5ID0gJyc7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29hbGVzY2UgY29udGludW91cyBDb2xvcmlzIGlucHV0IGludG8gb25lIGFuaW1hdGlvbi1mcmFtZSB1cGRhdGUuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNjaGVkdWxlX2Zvcm1fcHJldmlld191cGRhdGUoKSB7XG5cdFx0XHRpZiAoIHByZXZpZXdfZnJhbWVfcmVxdWVzdCApIHtcblx0XHRcdFx0d2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lKCBwcmV2aWV3X2ZyYW1lX3JlcXVlc3QgKTtcblx0XHRcdH1cblx0XHRcdHByZXZpZXdfZnJhbWVfcmVxdWVzdCA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cHJldmlld19mcmFtZV9yZXF1ZXN0ID0gMDtcblx0XHRcdFx0YXBwbHlfZm9ybV9zdHlsZV90b19wcmV2aWV3KCk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSGFuZGxlIGFjY2VudCBzaG9ydGN1dCBhY3RpdmF0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtNb3VzZUV2ZW50fSBldmVudCBDbGljayBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9jbGljayggZXZlbnQgKSB7XG5cdFx0XHR2YXIgYWNjZW50X3N3YXRjaCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1hcHBlYXJhbmNlLWFjY2VudC1zd2F0Y2hdJyApO1xuXG5cdFx0XHRpZiAoIGFjY2VudF9zd2F0Y2ggJiYgc2V0X2FjY2VudF9jb2xvciggYWNjZW50X3N3YXRjaC5kYXRhc2V0LndwYmNBcHBlYXJhbmNlQWNjZW50U3dhdGNoICkgKSB7XG5cdFx0XHRcdHNjaGVkdWxlX2Zvcm1fcHJldmlld191cGRhdGUoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBIYW5kbGUgY2Fub25pY2FsIHNlbGVjdCBhbmQgcmFkaW8gY2hhbmdlcyB3aXRob3V0IGEgbmV0d29yayByZXF1ZXN0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgQ2hhbmdlIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2NoYW5nZSggZXZlbnQgKSB7XG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy1hcHBlYXJhbmNlLXN0eWxlXScgKSApIHtcblx0XHRcdFx0c2hlbGxfYXBpLmNsZWFyX2ZpZWxkX2Vycm9yKCAnYm9va2luZ19mb3JtX3N0eWxlJyApO1xuXHRcdFx0XHRyZW5kZXJfc2VsZWN0ZWRfY29udHJvbHMoKTtcblx0XHRcdFx0YXBwbHlfZm9ybV9zdHlsZV90b19wcmV2aWV3KCk7XG5cdFx0XHR9IGVsc2UgaWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtYXBwZWFyYW5jZS10aW1lLW1vZGVdJyApICkge1xuXHRcdFx0XHRzaGVsbF9hcGkuY2xlYXJfZmllbGRfZXJyb3IoICdib29raW5nX3RpbWVzbG90X3BpY2tlcicgKTtcblx0XHRcdFx0cmVuZGVyX3NlbGVjdGVkX2NvbnRyb2xzKCk7XG5cdFx0XHRcdGFwcGx5X3RpbWVfbW9kZV90b19wcmV2aWV3KCk7XG5cdFx0XHR9IGVsc2UgaWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtYXBwZWFyYW5jZS1wcmV2aWV3LWZpZWxkXScgKSApIHtcblx0XHRcdFx0c2hlbGxfYXBpLmNsZWFyX2ZpZWxkX2Vycm9yKCAnYm9va2luZ19za2luJyApO1xuXHRcdFx0XHRhcHBseV9jYWxlbmRhcl9za2luX3RvX3ByZXZpZXcoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBWYWxpZGF0ZSBhbmQgYXBwbHkgY29udGludW91cyBhY2NlbnQgaW5wdXQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCBJbnB1dCBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9hY2NlbnRfaW5wdXQoIGV2ZW50ICkge1xuXHRcdFx0aWYgKCBzZXRfYWNjZW50X2NvbG9yKCBldmVudC50YXJnZXQudmFsdWUgKSApIHtcblx0XHRcdFx0c2NoZWR1bGVfZm9ybV9wcmV2aWV3X3VwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEluaXRpYWxpemUgdGhpcyBtb2R1bGUgYWdhaW5zdCBzaGVsbC1wcm92aWRlZCBBUElzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJlZ2lzdGVyZWRfc2hlbGxfYXBpIFNoYXJlZCB3aXphcmQgYWRhcHRlciBzZXJ2aWNlcy5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGluaXRpYWxpemUoIHJlZ2lzdGVyZWRfc2hlbGxfYXBpICkge1xuXHRcdFx0dmFyIGVkaXRvcl9ub2RlO1xuXG5cdFx0XHRzaGVsbF9hcGkgPSByZWdpc3RlcmVkX3NoZWxsX2FwaTtcblx0XHRcdGVkaXRvcl9ub2RlID0gc2hlbGxfYXBpLnJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYXBwZWFyYW5jZS1lZGl0b3JdJyApO1xuXHRcdFx0aWYgKCAhIGVkaXRvcl9ub2RlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGVkaXRvciA9IHtcblx0XHRcdFx0bm9kZTogZWRpdG9yX25vZGUsXG5cdFx0XHRcdGFjY2VudF92YWx1ZTogZWRpdG9yX25vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYXBwZWFyYW5jZS1hY2NlbnQtdmFsdWVdJyApLFxuXHRcdFx0XHRhY2NlbnRfc3dhdGNoZXM6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1hcHBlYXJhbmNlLWFjY2VudC1zd2F0Y2hdJyApICksXG5cdFx0XHRcdHNraW46IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbbmFtZT1cImJvb2tpbmdfc2tpblwiXScgKSxcblx0XHRcdFx0cHJldmlld19yb290OiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1hcHBlYXJhbmNlLWlubGluZS1wcmV2aWV3XScgKVxuXHRcdFx0fTtcblxuXHRcdFx0aWYgKCAhIGVkaXRvci5hY2NlbnRfdmFsdWUgfHwgISBlZGl0b3Iuc2tpbiB8fCAhIGVkaXRvci5wcmV2aWV3X3Jvb3QgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0ZWRpdG9yLm5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgaGFuZGxlX2NsaWNrICk7XG5cdFx0XHRlZGl0b3Iubm9kZS5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgaGFuZGxlX2NoYW5nZSApO1xuXHRcdFx0ZWRpdG9yLmFjY2VudF92YWx1ZS5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCBoYW5kbGVfYWNjZW50X2lucHV0ICk7XG5cdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuQ29sb3JpcyApIHtcblx0XHRcdFx0d2luZG93LkNvbG9yaXMoIHtcblx0XHRcdFx0XHRlbDogJy53cGJjX3NldHVwX3dpemFyZF9fYXBwZWFyYW5jZS1jb2xvcmlzJyxcblx0XHRcdFx0XHRhbHBoYTogZmFsc2UsXG5cdFx0XHRcdFx0Zm9ybWF0OiAnaGV4Jyxcblx0XHRcdFx0XHR0aGVtZU1vZGU6ICdhdXRvJyxcblx0XHRcdFx0XHRvbkNoYW5nZTogZnVuY3Rpb24gKCBjb2xvciwgY3VycmVudF9pbnB1dCApIHtcblx0XHRcdFx0XHRcdGlmICggY3VycmVudF9pbnB1dCA9PT0gZWRpdG9yLmFjY2VudF92YWx1ZSAmJiBzZXRfYWNjZW50X2NvbG9yKCBjb2xvciApICkge1xuXHRcdFx0XHRcdFx0XHRzY2hlZHVsZV9mb3JtX3ByZXZpZXdfdXBkYXRlKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cblx0XHRcdHJlbmRlcl9zZWxlY3RlZF9jb250cm9scygpO1xuXHRcdFx0c2V0X2FjY2VudF9jb2xvciggZWRpdG9yLmFjY2VudF92YWx1ZS52YWx1ZSApO1xuXHRcdFx0YXBwbHlfZm9ybV9zdHlsZV90b19wcmV2aWV3KCk7XG5cdFx0XHRhcHBseV9jYWxlbmRhcl9za2luX3RvX3ByZXZpZXcoKTtcblx0XHRcdGFwcGx5X3RpbWVfbW9kZV90b19wcmV2aWV3KCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogVmFsaWRhdGUgcmVxdWlyZWQgZmllbGRzIGJlZm9yZSBmb3J3YXJkIG5hdmlnYXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfSBGaXJzdCBpbnZhbGlkIGNvbnRyb2wsIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gdmFsaWRhdGUoKSB7XG5cdFx0XHR2YXIgdmFsdWVzID0gZ2V0X3ZhbHVlcygpO1xuXHRcdFx0aWYgKCAhIHZhbHVlcy5ib29raW5nX2Zvcm1fc3R5bGUgKSB7XG5cdFx0XHRcdHJldHVybiBzaGVsbF9hcGkuc2V0X2ZpZWxkX2Vycm9yKCAnYm9va2luZ19mb3JtX3N0eWxlJywgZ2V0X21lc3NhZ2UoICdzdHlsZV9yZXF1aXJlZCcsICdDaG9vc2UgYSBzdGFydGluZyBzdHlsZS4nICkgKTtcblx0XHRcdH1cblx0XHRcdGlmICggISAvXiNbMC05QS1GXXs2fSQvLnRlc3QoIHZhbHVlcy5ib29raW5nX2Zvcm1fYWNjZW50X2NvbG9yICkgKSB7XG5cdFx0XHRcdHNoZWxsX2FwaS5zZXRfZmllbGRfZXJyb3IoICdib29raW5nX2Zvcm1fYWNjZW50X2NvbG9yJywgZ2V0X21lc3NhZ2UoICdhY2NlbnRfcmVxdWlyZWQnLCAnQ2hvb3NlIGEgdmFsaWQgYWNjZW50IGNvbG9yLicgKSApO1xuXHRcdFx0XHRyZXR1cm4gZWRpdG9yLmFjY2VudF92YWx1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggISB2YWx1ZXMuYm9va2luZ19za2luICkge1xuXHRcdFx0XHRyZXR1cm4gc2hlbGxfYXBpLnNldF9maWVsZF9lcnJvciggJ2Jvb2tpbmdfc2tpbicsIGdldF9tZXNzYWdlKCAnc2tpbl9yZXF1aXJlZCcsICdDaG9vc2UgYSBjYWxlbmRhciBza2luLicgKSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHZhbHVlcy5ib29raW5nX3RpbWVzbG90X3BpY2tlciApIHtcblx0XHRcdFx0cmV0dXJuIHNoZWxsX2FwaS5zZXRfZmllbGRfZXJyb3IoICdib29raW5nX3RpbWVzbG90X3BpY2tlcicsIGdldF9tZXNzYWdlKCAndGltZV9yZXF1aXJlZCcsICdDaG9vc2UgaG93IHRpbWUgc2xvdHMgYXJlIGRpc3BsYXllZC4nICkgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRpbml0aWFsaXplOiBpbml0aWFsaXplLFxuXHRcdFx0c3luYzogZnVuY3Rpb24gKCkge30sXG5cdFx0XHR2YWxpZGF0ZTogdmFsaWRhdGVcblx0XHR9O1xuXHR9XG5cblx0d2luZG93LndwYmNfc2V0dXBfZWRpdG9yX21vZHVsZXMgPSB3aW5kb3cud3BiY19zZXR1cF9lZGl0b3JfbW9kdWxlcyB8fCB7fTtcblx0d2luZG93LndwYmNfc2V0dXBfZWRpdG9yX21vZHVsZXMuYXBwZWFyYW5jZSA9IHsgY3JlYXRlOiBjcmVhdGVfYXBwZWFyYW5jZV9hZGFwdGVyIH07XG5cblx0aWYgKCB3aW5kb3cud3BiY19zZXR1cF93aXphcmRfYXBpICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19zZXR1cF93aXphcmRfYXBpLnJlZ2lzdGVyX3N0ZXBfYWRhcHRlciApIHtcblx0XHR3aW5kb3cud3BiY19zZXR1cF93aXphcmRfYXBpLnJlZ2lzdGVyX3N0ZXBfYWRhcHRlciggY3JlYXRlX2FwcGVhcmFuY2VfYWRhcHRlciggbW9kdWxlX2NvbmZpZyApICk7XG5cdH1cbn0oIHdpbmRvdywgZG9jdW1lbnQgKSApO1xuIl0sIm1hcHBpbmdzIjoi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
