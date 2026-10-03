"use strict";

/**
 * Drive the Setup Wizard Date Selection editor and real calendar preview.
 *
 * Canonical Booking Calendar helpers remain responsible for selection rules.
 * This adapter changes only request-local calendar parameters and draft fields;
 * it does not save settings or submit a booking.
 *
 * @package Booking Calendar
 */
(function (window, document) {
  'use strict';

  var module_config = window.wpbc_setup_wizard_date_selection || {
    i18n: {}
  };

  /**
   * Create one isolated Date Selection step adapter.
   *
   * @param {Object} config Localized limits and messages.
   * @return {Object} Adapter accepted by the shared wizard shell.
   */
  function create_date_selection_adapter(config) {
    var shell_api = null;
    var editor = null;
    var apply_timers = [];
    var preview_data_timer = null;
    var last_selected_mode = '';

    /**
     * Return one localized message with a safe fallback.
     *
     * @param {string} key      Translation key.
     * @param {string} fallback Fallback message.
     * @return {string} Translation or fallback.
     */
    function get_message(key, fallback) {
      return config.i18n && config.i18n[key] ? String(config.i18n[key]) : fallback;
    }

    /**
     * Return the selected mode identifier.
     *
     * @return {string} Selected mode or an empty string.
     */
    function get_selected_mode() {
      var selected = get_selected_mode_control();
      return selected ? selected.value : '';
    }

    /**
     * Return the selected server-authorized mode control.
     *
     * @return {HTMLElement|null} Selected radio control or null.
     */
    function get_selected_mode_control() {
      return editor ? editor.node.querySelector('[data-wpbc-date-selection-mode]:checked') : null;
    }

    /**
     * Read one dependent-setting state from the selected mode policy.
     *
     * @param {string} setting_name Policy setting name in camel case.
     * @return {string} Policy state or `hidden_off`.
     */
    function get_mode_policy_state(setting_name) {
      var selected_mode_control = get_selected_mode_control();
      if (!selected_mode_control || !selected_mode_control.dataset[setting_name]) {
        return 'hidden_off';
      }
      return String(selected_mode_control.dataset[setting_name]);
    }

    /**
     * Apply defaults only when the customer changes the Date Selection mode.
     *
     * Time-based Customer Journeys default recurrent selected-time behavior to
     * on for Multiple days, while leaving the visible option editable afterward.
     * Tracking the previous mode prevents later synchronization from overwriting
     * an explicit customer choice.
     *
     * @param {HTMLElement|null} mode_control Changed mode radio control.
     * @return {void}
     */
    function apply_selected_mode_defaults(mode_control) {
      var selected_mode;
      var recurrent_policy;
      var recurrent_toggle;
      if (!editor || !mode_control || !mode_control.checked) {
        return;
      }
      selected_mode = String(mode_control.value || '');
      if (selected_mode === last_selected_mode) {
        return;
      }
      last_selected_mode = selected_mode;
      recurrent_policy = String(mode_control.dataset.wpbcDateSelectionPolicyRecurrentTime || '');
      if ('optional_default_on' !== recurrent_policy) {
        return;
      }
      recurrent_toggle = editor.node.querySelector('[data-wpbc-date-selection-toggle="date_selection_recurrent_time"]');
      if (recurrent_toggle) {
        recurrent_toggle.checked = true;
      }
    }

    /**
     * Parse one bounded integer control.
     *
     * @param {string} selector Control selector below the editor.
     * @param {number} fallback Value used for an absent or invalid control.
     * @return {number} Parsed integer.
     */
    function get_integer(selector, fallback) {
      var control = editor ? editor.node.querySelector(selector) : null;
      var parsed = control ? parseInt(control.value, 10) : NaN;
      return isNaN(parsed) ? fallback : parsed;
    }

    /**
     * Convert one weekday transport field to the canonical number array.
     *
     * @param {string} mode Range mode owning the transport field.
     * @return {number[]} Weekday numbers or the unrestricted marker.
     */
    function get_weekdays(mode) {
      var transport = editor ? editor.node.querySelector('[data-wpbc-date-selection-weekday-transport="' + mode + '"]') : null;
      var values = transport ? String(transport.value || '').split(',') : [];
      var weekdays = values.map(function (value) {
        return parseInt(value, 10);
      }).filter(function (value) {
        return -1 === value || value >= 0 && value <= 6;
      });
      return weekdays.length ? weekdays : [-1];
    }

    /**
     * Parse the released comma-and-range syntax into canonical day lengths.
     *
     * This intentionally mirrors the server validator instead of evaluating
     * input text. An empty expression means that every length within the
     * configured minimum and maximum is allowed.
     *
     * @param {string} raw_specific_days Untrusted text field value.
     * @return {number[]|null} Sorted unique lengths, an empty array, or null when invalid.
     */
    function parse_specific_days(raw_specific_days) {
      var maximum_days = parseInt(config.max_dynamic_days || 1095, 10);
      var specific_expression = String(raw_specific_days || '').trim();
      var specific_days = [];
      if ('' === specific_expression) {
        return specific_days;
      }
      if (specific_expression.length > 500 || !/^\d+(?:\s*-\s*\d+)?(?:\s*,\s*\d+(?:\s*-\s*\d+)?)*$/.test(specific_expression)) {
        return null;
      }
      specific_expression.split(',').forEach(function (specific_part) {
        var range_bounds = specific_part.trim().split(/\s*-\s*/).map(function (range_bound) {
          return parseInt(range_bound, 10);
        });
        var range_start = Math.min.apply(null, range_bounds);
        var range_end = Math.max.apply(null, range_bounds);
        var specific_day;
        if (null === specific_days) {
          return;
        }
        if (range_start < 1 || range_end > maximum_days) {
          specific_days = null;
          return;
        }
        for (specific_day = range_start; specific_day <= range_end; specific_day++) {
          if (-1 === specific_days.indexOf(specific_day)) {
            specific_days.push(specific_day);
          }
        }
      });
      return null === specific_days ? null : specific_days.sort(function (first_day, second_day) {
        return first_day - second_day;
      });
    }

    /**
     * Return the specific flexible-range lengths from the current editor.
     *
     * @return {number[]|null} Canonical lengths, an empty array, or null when invalid.
     */
    function get_specific_days() {
      var control = editor ? editor.node.querySelector('[data-wpbc-date-selection-specific]') : null;
      return parse_specific_days(control ? control.value : '');
    }

    /**
     * Write visible weekday button state into its scalar transport field.
     *
     * @param {string} mode Range mode owning the controls.
     * @return {void}
     */
    function sync_weekday_transport(mode) {
      var group = editor ? editor.node.querySelector('[data-wpbc-date-selection-weekdays="' + mode + '"]') : null;
      var transport = editor ? editor.node.querySelector('[data-wpbc-date-selection-weekday-transport="' + mode + '"]') : null;
      var selected = [];
      if (!group || !transport) {
        return;
      }
      group.querySelectorAll('[data-weekday][aria-pressed="true"]').forEach(function (button) {
        selected.push(parseInt(button.dataset.weekday, 10));
      });
      selected = selected.filter(function (value) {
        return !isNaN(value) && value >= 0 && value <= 6;
      }).sort(function (first_value, second_value) {
        return first_value - second_value;
      });
      transport.value = 7 === selected.length || 0 === selected.length ? '-1' : selected.join(',');
    }

    /**
     * Apply a canonical weekday preset to the visible buttons and transport.
     *
     * The `-1` unrestricted marker is presented as all seven weekdays selected
     * so the allowed-start-days state remains explicit to sighted users.
     *
     * @param {string} mode         Range mode owning the controls.
     * @param {string} raw_weekdays Canonical comma list or `-1` for any day.
     * @return {void}
     */
    function apply_weekday_preset(mode, raw_weekdays) {
      var group = editor ? editor.node.querySelector('[data-wpbc-date-selection-weekdays="' + mode + '"]') : null;
      var weekdays = '-1' === raw_weekdays ? [0, 1, 2, 3, 4, 5, 6] : String(raw_weekdays || '').split(',').map(function (raw_weekday) {
        return parseInt(raw_weekday, 10);
      }).filter(function (weekday) {
        return !isNaN(weekday) && weekday >= 0 && weekday <= 6;
      });
      if (!group) {
        return;
      }
      group.querySelectorAll('[data-weekday]').forEach(function (button) {
        var is_selected = -1 !== weekdays.indexOf(parseInt(button.dataset.weekday, 10));
        button.setAttribute('aria-pressed', is_selected ? 'true' : 'false');
        button.classList.toggle('is-selected', is_selected);
      });
      sync_weekday_transport(mode);
    }

    /**
     * Synchronize visible switches into their allow-listed hidden fields.
     *
     * @return {void}
     */
    function sync_toggle_transports() {
      if (!editor) {
        return;
      }
      editor.node.querySelectorAll('[data-wpbc-date-selection-toggle]').forEach(function (toggle) {
        var field_name = toggle.dataset.wpbcDateSelectionToggle;
        var transport = editor.node.querySelector('[name="' + field_name + '"]');
        var policy_state = String(toggle.dataset.wpbcDateSelectionPolicyState || '');
        if (transport) {
          if ('required_on' === policy_state || 'hidden_on' === policy_state) {
            transport.value = 'On';
          } else if ('hidden_off' === policy_state) {
            transport.value = 'Off';
          } else {
            transport.value = toggle.checked && !toggle.disabled ? 'On' : 'Off';
          }
        }
      });
    }

    /**
     * Explain configuration-driven disabled toggle states.
     *
     * Native disabled inputs do not receive pointer or keyboard focus. The
     * surrounding toggle remains hoverable and becomes keyboard focusable only
     * while a documented dependency or edition rule disables its input.
     *
     * @return {void}
     */
    function sync_disabled_toggle_tooltips() {
      if (!editor) {
        return;
      }
      editor.node.querySelectorAll('[data-wpbc-date-selection-disabled-tooltip]').forEach(function (tooltip_wrapper) {
        var toggle = tooltip_wrapper.querySelector('[data-wpbc-date-selection-toggle]');
        var description_id = String(tooltip_wrapper.dataset.wpbcDateSelectionDisabledTooltip || '');
        var description = description_id ? document.getElementById(description_id) : null;
        var disabled_reason = toggle && toggle.disabled ? String(toggle.dataset.wpbcDateSelectionDisabledReason || '') : '';
        if (disabled_reason) {
          tooltip_wrapper.setAttribute('title', disabled_reason);
          tooltip_wrapper.setAttribute('tabindex', '0');
          tooltip_wrapper.setAttribute('aria-describedby', description_id);
          tooltip_wrapper.dataset.wpbcDateSelectionDisabledTooltipActive = '1';
        } else {
          tooltip_wrapper.removeAttribute('title');
          tooltip_wrapper.removeAttribute('tabindex');
          tooltip_wrapper.removeAttribute('aria-describedby');
          delete tooltip_wrapper.dataset.wpbcDateSelectionDisabledTooltipActive;
        }
        if (description) {
          description.textContent = disabled_reason;
        }
      });
    }

    /**
     * Enforce canonical changeover, recurrent-time, and check-out dependencies.
     *
     * Booking Calendar treats changeover processing as mutually exclusive with
     * recurrent time and an independently available check-out date. A check-out
     * date also has no meaning for single or independent-date selections. Hide
     * incompatible controls and normalize their request-local draft state.
     *
     * @return {void}
     */
    function sync_changeover_dependencies() {
      var changeover_toggle;
      var changeover_controls;
      var changeover_fields;
      var checkout_option;
      var checkout_toggle;
      var checkout_tooltip_wrapper;
      var checkout_disabled_reason;
      var recurrent_toggle;
      var recurrent_option;
      var behavior_section;
      var changeover_is_active;
      var checkout_is_supported;
      var changeover_policy;
      var recurrent_policy;
      var checkout_policy;
      if (!editor || !editor.changeover) {
        return;
      }
      changeover_toggle = editor.node.querySelector('[data-wpbc-date-selection-toggle="date_selection_changeover_enabled"]');
      changeover_controls = editor.changeover.querySelector('[data-wpbc-date-selection-changeover-controls]');
      changeover_fields = editor.changeover.querySelector('[data-wpbc-date-selection-changeover-fields]');
      checkout_option = editor.node.querySelector('[data-wpbc-date-selection-checkout-option]');
      checkout_toggle = editor.node.querySelector('[data-wpbc-date-selection-toggle="date_selection_checkout_available"]');
      checkout_tooltip_wrapper = checkout_toggle ? checkout_toggle.closest('[data-wpbc-date-selection-disabled-tooltip]') : null;
      recurrent_toggle = editor.node.querySelector('[data-wpbc-date-selection-toggle="date_selection_recurrent_time"]');
      recurrent_option = editor.node.querySelector('[data-wpbc-date-selection-recurrent-option]');
      behavior_section = editor.node.querySelector('[data-wpbc-date-selection-behavior]');
      changeover_policy = get_mode_policy_state('wpbcDateSelectionPolicyChangeover');
      recurrent_policy = get_mode_policy_state('wpbcDateSelectionPolicyRecurrentTime');
      checkout_policy = get_mode_policy_state('wpbcDateSelectionPolicyCheckoutAvailable');
      checkout_is_supported = 'optional' === checkout_policy;
      if (changeover_toggle) {
        changeover_toggle.dataset.wpbcDateSelectionPolicyState = changeover_policy;
        if ('required_on' === changeover_policy) {
          changeover_toggle.checked = true;
          changeover_toggle.disabled = true;
        } else if ('hidden_off' === changeover_policy) {
          changeover_toggle.checked = false;
        } else {
          changeover_toggle.disabled = '1' === changeover_toggle.dataset.wpbcDateSelectionEditionLocked;
        }
      }
      changeover_is_active = Boolean(changeover_toggle && changeover_toggle.checked && 'hidden_off' !== changeover_policy);
      editor.changeover.hidden = -1 === ['optional', 'required_on'].indexOf(changeover_policy);
      if (changeover_controls) {
        changeover_controls.hidden = !changeover_is_active;
      }
      if (changeover_fields) {
        changeover_fields.hidden = !changeover_is_active;
      }
      if (recurrent_option) {
        recurrent_option.hidden = -1 === ['optional', 'optional_default_on', 'required_on'].indexOf(recurrent_policy);
      }
      if (recurrent_toggle) {
        recurrent_toggle.dataset.wpbcDateSelectionPolicyState = recurrent_policy;
        recurrent_toggle.disabled = 'required_on' === recurrent_policy;
        if ('hidden_on' === recurrent_policy || 'required_on' === recurrent_policy) {
          recurrent_toggle.checked = true;
        } else if (-1 === ['optional', 'optional_default_on'].indexOf(recurrent_policy) || changeover_is_active) {
          recurrent_toggle.checked = false;
        }
      }
      if (checkout_option) {
        checkout_option.hidden = !checkout_is_supported;
        checkout_option.dataset.wpbcDateSelectionPolicyState = checkout_policy;
      }
      if (checkout_toggle) {
        checkout_toggle.dataset.wpbcDateSelectionPolicyState = checkout_policy;
        checkout_toggle.disabled = '1' === checkout_toggle.dataset.wpbcDateSelectionEditionLocked || changeover_is_active || !checkout_is_supported;
        checkout_disabled_reason = '';
        if (checkout_tooltip_wrapper && '1' === checkout_toggle.dataset.wpbcDateSelectionEditionLocked) {
          checkout_disabled_reason = checkout_tooltip_wrapper.dataset.wpbcDateSelectionCheckoutReasonEdition || '';
        } else if (checkout_tooltip_wrapper && changeover_is_active) {
          checkout_disabled_reason = checkout_tooltip_wrapper.dataset.wpbcDateSelectionCheckoutReasonChangeover || '';
        } else if (checkout_tooltip_wrapper && !checkout_is_supported) {
          checkout_disabled_reason = checkout_tooltip_wrapper.dataset.wpbcDateSelectionCheckoutReasonMode || '';
        }
        checkout_toggle.dataset.wpbcDateSelectionDisabledReason = checkout_disabled_reason;
        if (changeover_is_active || !checkout_is_supported) {
          checkout_toggle.checked = false;
        }
      }
      if (behavior_section) {
        behavior_section.hidden = -1 === ['optional', 'optional_default_on', 'required_on'].indexOf(recurrent_policy) && !checkout_is_supported;
      }
    }

    /**
     * Let the most recently activated mutually exclusive option win.
     *
     * @param {HTMLElement|null} toggle Changed Date Selection toggle.
     * @return {void}
     */
    function apply_exclusive_toggle_action(toggle) {
      var field_name;
      var conflicting_toggle;
      if (!editor || !toggle || !toggle.checked) {
        return;
      }
      field_name = toggle.dataset.wpbcDateSelectionToggle || '';
      if ('date_selection_changeover_enabled' === field_name) {
        conflicting_toggle = editor.node.querySelector('[data-wpbc-date-selection-toggle="date_selection_recurrent_time"]');
      } else if ('date_selection_recurrent_time' === field_name) {
        conflicting_toggle = editor.node.querySelector('[data-wpbc-date-selection-toggle="date_selection_changeover_enabled"]');
      }
      if (conflicting_toggle) {
        conflicting_toggle.checked = false;
      }
    }

    /**
     * Synchronize the non-mutating calendar-legend configuration preview.
     *
     * All preview nodes are rendered by PHP. This method changes only text,
     * visibility, and layout classes; it never constructs or evaluates markup.
     *
     * @return {void}
     */
    function sync_legend_preview() {
      var legend_toggle;
      var legend_settings;
      var legend_preview;
      var show_numbers_toggle;
      var vertical_toggle;
      var day_number;
      if (!editor || !editor.legend) {
        return;
      }
      legend_toggle = editor.node.querySelector('[data-wpbc-date-selection-toggle="date_selection_legend_enabled"]');
      legend_settings = editor.legend.querySelector('[data-wpbc-date-selection-legend-settings]');
      legend_preview = editor.node.querySelector('[data-wpbc-date-selection-legend-preview]');
      show_numbers_toggle = editor.node.querySelector('[data-wpbc-date-selection-toggle="date_selection_legend_show_numbers"]');
      vertical_toggle = editor.node.querySelector('[data-wpbc-date-selection-toggle="date_selection_legend_vertical"]');
      day_number = legend_preview ? String(legend_preview.dataset.wpbcDateSelectionLegendDayNumber || '') : '';
      if (legend_settings) {
        legend_settings.hidden = !legend_toggle || !legend_toggle.checked;
      }
      if (!legend_preview) {
        return;
      }
      legend_preview.hidden = !legend_toggle || !legend_toggle.checked;
      legend_preview.classList.toggle('is-vertical', Boolean(vertical_toggle && vertical_toggle.checked));
      legend_preview.querySelectorAll('[data-wpbc-date-selection-legend-preview-item]').forEach(function (preview_item) {
        var legend_id = preview_item.dataset.wpbcDateSelectionLegendPreviewItem;
        var item_toggle = editor.node.querySelector('[data-wpbc-date-selection-toggle="date_selection_legend_item_' + legend_id + '"]');
        var title_control = editor.node.querySelector('[data-wpbc-date-selection-legend-title="' + legend_id + '"]');
        var title_node = preview_item.querySelector('.wpdev_hint_with_text .block_text:last-child');
        var title = title_control ? String(title_control.value || '').trim() : '';
        preview_item.hidden = !item_toggle || !item_toggle.checked;
        if (title_node && title_control) {
          title_node.textContent = title || title_control.placeholder || '';
        }
        preview_item.querySelectorAll('.wpbc_calendar_legend_day_cell_height .date-cell-content > a, .wpbc_calendar_legend_day_cell_height .date-cell-content > span').forEach(function (date_node) {
          date_node.textContent = show_numbers_toggle && show_numbers_toggle.checked ? day_number : '';
        });
      });
    }

    /**
     * Synchronize canonical changeover classes in the calendar and legend.
     *
     * Booking Calendar owns the underlying day status and SVG markup. This
     * adapter changes only the same ancestor and day-state classes used by the
     * released calendar renderer, so triangle and split-day presentation stay
     * consistent without constructing or evaluating HTML.
     *
     * @return {void}
     */
    function sync_changeover_preview_classes() {
      var changeover_transport;
      var triangles_transport;
      var changeover_is_active;
      var triangles_are_active;
      var partially_item;
      var partially_day;
      var legend_table;
      var legend_wrapper;
      var changeover_classes;
      if (!editor) {
        return;
      }
      changeover_transport = editor.node.querySelector('[name="date_selection_changeover_enabled"]');
      triangles_transport = editor.node.querySelector('[name="date_selection_triangles"]');
      changeover_is_active = Boolean(changeover_transport && 'On' === changeover_transport.value);
      triangles_are_active = Boolean(changeover_is_active && triangles_transport && 'On' === triangles_transport.value);
      if (editor.calendar) {
        editor.calendar.classList.toggle('wpbc_change_over_triangle', triangles_are_active);
        editor.calendar.querySelectorAll('.wpbc_calendar_wraper').forEach(function (calendar_wrapper) {
          calendar_wrapper.classList.toggle('wpbc_change_over_triangle', triangles_are_active);
        });
      }
      partially_item = editor.node.querySelector('[data-wpbc-date-selection-legend-preview-item="partially"]');
      if (!partially_item) {
        return;
      }
      partially_day = partially_item.querySelector('.wpbc_calendar_legend_day_cell_height');
      if (partially_day) {
        changeover_classes = ['date_approved', 'check_in_time', 'check_out_time', 'check_in_time_date_approved', 'check_out_time_date2approve'];
        changeover_classes.forEach(function (class_name) {
          partially_day.classList.toggle(class_name, changeover_is_active);
        });
        partially_day.classList.toggle('date2approve', !changeover_is_active);
        partially_day.classList.toggle('times_clock', !changeover_is_active);
      }
      legend_table = partially_item.querySelector('.wpbc_calendar_legend_table_width_height');
      legend_wrapper = legend_table ? legend_table.parentElement : null;
      if (legend_wrapper) {
        legend_wrapper.classList.toggle('wpbc_change_over_triangle', triangles_are_active);
      }
    }

    /**
     * Reload canonical day-status data with authorized draft overrides.
     *
     * The shared calendar endpoint calculates booking boundaries. A dedicated
     * Setup Wizard nonce and capability check authorize these request-local
     * values; no setting or booking is written by this request.
     *
     * @return {void}
     */
    function refresh_changeover_preview_data() {
      var changeover_transport;
      var triangles_transport;
      var recurrent_transport;
      var checkout_transport;
      if (!editor || !editor.calendar || !config.preview_nonce || 'function' !== typeof window.wpbc_calendar__load_data__ajx) {
        return;
      }
      changeover_transport = editor.node.querySelector('[name="date_selection_changeover_enabled"]');
      triangles_transport = editor.node.querySelector('[name="date_selection_triangles"]');
      recurrent_transport = editor.node.querySelector('[name="date_selection_recurrent_time"]');
      checkout_transport = editor.node.querySelector('[name="date_selection_checkout_available"]');
      window.wpbc_calendar__load_data__ajx({
        resource_id: editor.resource_id,
        booking_hash: '',
        request_uri: '',
        custom_form: 'standard',
        aggregate_resource_id_str: '',
        aggregate_type: 'all',
        skip_general_availability: 0,
        classic_booking_context_token: '',
        wpbc_settings_calendar_preview: 1,
        wpbc_setup_wizard_date_selection_preview: 1,
        wpbc_setup_wizard_date_selection_preview_nonce: String(config.preview_nonce),
        wpbc_settings_calendar_preview_changeover: changeover_transport && 'On' === changeover_transport.value ? 'On' : 'Off',
        wpbc_settings_calendar_preview_triangles: triangles_transport && 'On' === triangles_transport.value ? 'On' : 'Off',
        wpbc_settings_calendar_preview_recurrent_time: recurrent_transport && 'On' === recurrent_transport.value ? 'On' : 'Off',
        wpbc_settings_calendar_preview_last_checkout: checkout_transport && 'On' === checkout_transport.value ? 'On' : 'Off',
        wpbc_settings_calendar_preview_show_legend: 'Off'
      });
    }

    /**
     * Debounce request-local day-status refreshes after related toggles change.
     *
     * @return {void}
     */
    function schedule_changeover_data_refresh() {
      if (preview_data_timer) {
        window.clearTimeout(preview_data_timer);
      }
      preview_data_timer = window.setTimeout(refresh_changeover_preview_data, 180);
    }

    /**
     * Return the authoritative number field paired with one presentation slider.
     *
     * @param {string} field_name Date Selection draft field name.
     * @return {HTMLInputElement|null} Matching number field, or null.
     */
    function get_number_control(field_name) {
      return editor ? editor.node.querySelector('[data-wpbc-date-selection-number="' + field_name + '"]') : null;
    }

    /**
     * Copy one valid authoritative number value into its presentation slider.
     *
     * Invalid exact values remain visible for native and wizard validation; the
     * slider must not silently coerce them into an apparently valid draft.
     *
     * @param {HTMLInputElement} number_control Authoritative number field.
     * @return {void}
     */
    function sync_range_from_number(number_control) {
      var field_name = number_control ? number_control.dataset.wpbcDateSelectionNumber : '';
      var range_control = field_name && editor ? editor.node.querySelector('[data-wpbc-date-selection-range="' + field_name + '"]') : null;
      if (!range_control || '' === number_control.value || !number_control.checkValidity()) {
        return;
      }
      range_control.value = number_control.value;
    }

    /**
     * Copy one presentation slider value into its authoritative number field.
     *
     * @param {HTMLInputElement} range_control Presentation range control.
     * @return {void}
     */
    function sync_number_from_range(range_control) {
      var field_name = range_control ? range_control.dataset.wpbcDateSelectionRange : '';
      var number_control = get_number_control(field_name);
      if (!number_control || number_control.disabled || range_control.disabled) {
        return;
      }
      number_control.value = range_control.value;
    }

    /**
     * Align every presentation slider with its authoritative number field.
     *
     * @return {void}
     */
    function sync_number_ranges() {
      if (!editor) {
        return;
      }
      editor.node.querySelectorAll('[data-wpbc-date-selection-number]').forEach(sync_range_from_number);
    }

    /**
     * Apply one trusted preset value through the authoritative number control.
     *
     * @param {string} field_name Draft field name.
     * @param {string} raw_value  Server-defined integer value.
     * @return {void}
     */
    function apply_number_preset(field_name, raw_value) {
      var number_control = get_number_control(field_name);
      if (!number_control || number_control.disabled || !/^\d+$/.test(String(raw_value))) {
        return;
      }
      number_control.value = String(raw_value);
      sync_range_from_number(number_control);
    }

    /**
     * Apply a server-defined specific-length preset as one coherent draft.
     *
     * Clear intentionally omits the range and weekday data attributes, so it
     * removes only the specific-length restriction and preserves manual rules.
     *
     * @param {HTMLElement} preset_button   Activated preset button.
     * @param {HTMLInputElement} text_control Specific-length text field.
     * @return {void}
     */
    function apply_specific_day_preset(preset_button, text_control) {
      text_control.value = preset_button.dataset.wpbcDateSelectionSpecificPreset || '';
      if (preset_button.hasAttribute('data-wpbc-date-selection-preset-minimum')) {
        apply_number_preset('date_selection_dynamic_min', preset_button.dataset.wpbcDateSelectionPresetMinimum);
      }
      if (preset_button.hasAttribute('data-wpbc-date-selection-preset-maximum')) {
        apply_number_preset('date_selection_dynamic_max', preset_button.dataset.wpbcDateSelectionPresetMaximum);
      }
      if (preset_button.hasAttribute('data-wpbc-date-selection-preset-weekdays')) {
        apply_weekday_preset('dynamic', preset_button.dataset.wpbcDateSelectionPresetWeekdays);
      }
      shell_api.clear_field_error('date_selection_dynamic_min');
      shell_api.clear_field_error('date_selection_dynamic_max');
      shell_api.clear_field_error('date_selection_dynamic_specific');
      shell_api.clear_field_error('date_selection_dynamic_weekdays');
    }

    /**
     * Update selected cards, settings panels, and changeover visibility.
     *
     * @return {void}
     */
    function render_editor_state() {
      var mode = get_selected_mode();
      if (!editor) {
        return;
      }
      editor.node.querySelectorAll('.wpbc_setup_wizard__date-selection-mode-card').forEach(function (card) {
        var radio = card.querySelector('[data-wpbc-date-selection-mode]');
        card.classList.toggle('is-selected', Boolean(radio && radio.checked));
      });
      editor.node.querySelectorAll('[data-wpbc-date-selection-panel]').forEach(function (panel) {
        panel.hidden = panel.dataset.wpbcDateSelectionPanel !== mode;
      });
      sync_changeover_dependencies();
    }

    /**
     * Set one canonical request-local calendar parameter.
     *
     * @param {string} key   Calendar parameter name.
     * @param {*}      value Parameter value.
     * @return {void}
     */
    function set_calendar_parameter(key, value) {
      if (editor && window._wpbc && 'function' === typeof window._wpbc.calendar__set_param_value) {
        window._wpbc.calendar__set_param_value(editor.resource_id, key, value);
      }
    }

    /**
     * Normalize the legacy calendar scroll target before a released mode helper runs.
     *
     * The core calendar accepts either false or a two-value month/year array. The
     * request-local preview can initially expose null, which the legacy helper
     * otherwise attempts to index while reinitializing the calendar.
     *
     * @return {void}
     */
    function normalize_calendar_scroll_target() {
      var scroll_target;
      if (!editor || !window._wpbc || 'function' !== typeof window._wpbc.calendar__get_param_value || 'function' !== typeof window._wpbc.calendar__set_param_value) {
        return;
      }
      scroll_target = window._wpbc.calendar__get_param_value(editor.resource_id, 'calendar_scroll_to');
      if (false !== scroll_target && (!Array.isArray(scroll_target) || scroll_target.length < 2 || null === scroll_target[0] || null === scroll_target[1])) {
        set_calendar_parameter('calendar_scroll_to', false);
      }
    }

    /**
     * Apply the current draft through the real Booking Calendar mode helpers.
     *
     * @return {boolean} True when the calendar runtime was ready.
     */
    function apply_preview_policy() {
      var mode;
      var changeover;
      var recurrent_time;
      var triangles;
      var calendar_node;
      var fixed_days;
      var fixed_weekdays;
      var dynamic_min;
      var dynamic_max;
      var dynamic_specific;
      var dynamic_weekdays;
      if (!editor) {
        return false;
      }
      sync_changeover_preview_classes();
      if (!window._wpbc || 'function' !== typeof window._wpbc.calendar__set_param_value) {
        return false;
      }
      calendar_node = document.getElementById('calendar_booking' + editor.resource_id);
      if (!calendar_node) {
        return false;
      }
      mode = get_selected_mode();
      changeover = editor.node.querySelector('[name="date_selection_changeover_enabled"]');
      recurrent_time = editor.node.querySelector('[name="date_selection_recurrent_time"]');
      triangles = editor.node.querySelector('[name="date_selection_triangles"]');
      fixed_days = get_integer('[name="date_selection_fixed_days"]', 3);
      fixed_weekdays = get_weekdays('fixed');
      dynamic_min = get_integer('[name="date_selection_dynamic_min"]', 1);
      dynamic_max = get_integer('[name="date_selection_dynamic_max"]', 1);
      dynamic_specific = get_specific_days();
      dynamic_weekdays = get_weekdays('dynamic');
      dynamic_specific = null === dynamic_specific ? [] : dynamic_specific;
      set_calendar_parameter('is_enabled_change_over', Boolean(changeover && 'On' === changeover.value));
      set_calendar_parameter('booking_recurrent_time', recurrent_time && 'On' === recurrent_time.value ? 'On' : 'Off');
      set_calendar_parameter('days_select_mode', mode);
      set_calendar_parameter('fixed__days_num', fixed_days);
      set_calendar_parameter('fixed__week_days__start', fixed_weekdays);
      set_calendar_parameter('dynamic__days_min', dynamic_min);
      set_calendar_parameter('dynamic__days_max', dynamic_max);
      set_calendar_parameter('dynamic__days_specific', dynamic_specific);
      set_calendar_parameter('dynamic__week_days__start', dynamic_weekdays);
      normalize_calendar_scroll_target();
      if ('function' === typeof window._wpbc.set_other_param) {
        window._wpbc.set_other_param('is_enabled_change_over', Boolean(changeover && 'On' === changeover.value));
      }
      if ('function' === typeof window.wpbc__conditions__SAVE_INITIAL__days_selection_params__bm) {
        window.wpbc__conditions__SAVE_INITIAL__days_selection_params__bm(editor.resource_id);
      }
      if ('single' === mode && 'function' === typeof window.wpbc_cal_days_select__single) {
        window.wpbc_cal_days_select__single(editor.resource_id);
        return true;
      }
      if ('multiple' === mode && 'function' === typeof window.wpbc_cal_days_select__multiple) {
        window.wpbc_cal_days_select__multiple(editor.resource_id);
        return true;
      }
      if ('fixed' === mode && 'function' === typeof window.wpbc_cal_days_select__fixed) {
        window.wpbc_cal_days_select__fixed(editor.resource_id, fixed_days, fixed_weekdays);
        return true;
      }
      if ('dynamic' === mode && 'function' === typeof window.wpbc_cal_days_select__range) {
        window.wpbc_cal_days_select__range(editor.resource_id, dynamic_min, dynamic_max, dynamic_specific, dynamic_weekdays);
        return true;
      }
      return false;
    }

    /**
     * Reapply policy after immediate interaction and delayed calendar bootstrap.
     *
     * @return {void}
     */
    function schedule_preview_update() {
      apply_timers.forEach(function (timer_id) {
        window.clearTimeout(timer_id);
      });
      apply_timers = [0, 120, 420, 900, 1400].map(function (delay) {
        return window.setTimeout(apply_preview_policy, delay);
      });
    }

    /**
     * Synchronize all presentation controls before draft collection.
     *
     * @return {void}
     */
    function sync() {
      sync_weekday_transport('fixed');
      sync_weekday_transport('dynamic');
      sync_changeover_dependencies();
      sync_disabled_toggle_tooltips();
      sync_toggle_transports();
      sync_legend_preview();
      sync_changeover_preview_classes();
      sync_number_ranges();
    }

    /**
     * Validate coupled date-selection values before navigation.
     *
     * Server-side field allow-lists remain authoritative. This prevents an
     * internally inconsistent flexible range from being sent as a draft.
     *
     * @return {HTMLElement|null} First invalid control, or null.
     */
    function validate() {
      var mode = get_selected_mode();
      var fixed_days = get_integer('[name="date_selection_fixed_days"]', 0);
      var dynamic_min = get_integer('[name="date_selection_dynamic_min"]', 0);
      var dynamic_max = get_integer('[name="date_selection_dynamic_max"]', 0);
      var dynamic_specific = get_specific_days();
      var fixed_control = editor.node.querySelector('[name="date_selection_fixed_days"]');
      var dynamic_min_control = editor.node.querySelector('[name="date_selection_dynamic_min"]');
      var dynamic_max_control = editor.node.querySelector('[name="date_selection_dynamic_max"]');
      var dynamic_specific_control = editor.node.querySelector('[data-wpbc-date-selection-specific]');
      if (!mode) {
        shell_api.set_field_error('date_selection_mode', get_message('mode_required', 'Choose how customers select dates.'));
        return editor.node.querySelector('[data-wpbc-date-selection-mode]');
      }
      if (fixed_days < 1 || fixed_days > parseInt(config.max_fixed_days || 180, 10)) {
        shell_api.set_field_error('date_selection_fixed_days', get_message('fixed_days_invalid', 'Enter a valid fixed range.'));
        return fixed_control;
      }
      shell_api.clear_field_error('date_selection_fixed_days');
      if (dynamic_min < 1 || dynamic_max < dynamic_min || dynamic_max > parseInt(config.max_dynamic_days || 1095, 10)) {
        shell_api.set_field_error('date_selection_dynamic_min', get_message('dynamic_days_invalid', 'Enter a valid flexible range.'));
        shell_api.set_field_error('date_selection_dynamic_max', get_message('dynamic_days_invalid', 'Enter a valid flexible range.'));
        return dynamic_min < 1 ? dynamic_min_control : dynamic_max_control;
      }
      shell_api.clear_field_error('date_selection_dynamic_min');
      shell_api.clear_field_error('date_selection_dynamic_max');
      if (null === dynamic_specific || dynamic_specific.some(function (specific_day) {
        return specific_day < dynamic_min || specific_day > dynamic_max;
      })) {
        shell_api.set_field_error('date_selection_dynamic_specific', get_message('specific_days_invalid', 'Enter comma-separated day lengths within the flexible range, for example 7,14,21,28.'));
        return dynamic_specific_control;
      }
      shell_api.clear_field_error('date_selection_dynamic_specific');
      return null;
    }

    /**
     * Handle editor controls without constructing dynamic HTML.
     *
     * @param {Event} event Browser input or click event.
     * @return {void}
     */
    function handle_interaction(event) {
      var weekday_button = event.target.closest('[data-wpbc-date-selection-weekdays] [data-weekday]');
      var number_control = event.target.closest('[data-wpbc-date-selection-number]');
      var range_control = event.target.closest('[data-wpbc-date-selection-range]');
      var specific_preset = event.target.closest('[data-wpbc-date-selection-specific-preset]');
      var specific_control = editor ? editor.node.querySelector('[data-wpbc-date-selection-specific]') : null;
      var changed_mode = event.target.closest('[data-wpbc-date-selection-mode]');
      var changed_toggle = event.target.closest('[data-wpbc-date-selection-toggle]');
      var changed_toggle_name = changed_toggle ? String(changed_toggle.dataset.wpbcDateSelectionToggle || '') : '';
      var editor_control = event.target.closest('[data-wpbc-date-selection-mode], [data-wpbc-date-selection-number], [data-wpbc-date-selection-range], [data-wpbc-date-selection-specific], [data-wpbc-date-selection-specific-preset], [data-wpbc-date-selection-toggle], [data-wpbc-date-selection-legend-title], [data-wpbc-date-selection-weekdays] [data-weekday], [name="date_selection_check_in_time"], [name="date_selection_check_out_time"]');
      if (!editor_control || event.target.closest('[data-wpbc-date-selection-calendar]')) {
        return;
      }
      if (weekday_button && !weekday_button.disabled) {
        event.preventDefault();
        weekday_button.setAttribute('aria-pressed', 'true' === weekday_button.getAttribute('aria-pressed') ? 'false' : 'true');
        weekday_button.classList.toggle('is-selected', 'true' === weekday_button.getAttribute('aria-pressed'));
        sync_weekday_transport(weekday_button.closest('[data-wpbc-date-selection-weekdays]').dataset.wpbcDateSelectionWeekdays);
      }
      if (specific_preset && specific_control && !specific_preset.disabled && !specific_control.disabled) {
        event.preventDefault();
        apply_specific_day_preset(specific_preset, specific_control);
      }
      if (range_control) {
        sync_number_from_range(range_control);
      } else if (number_control) {
        sync_range_from_number(number_control);
      }
      apply_exclusive_toggle_action(changed_toggle);
      apply_selected_mode_defaults(changed_mode);
      sync();
      render_editor_state();
      schedule_preview_update();
      if (changed_mode || 'date_selection_changeover_enabled' === changed_toggle_name || 'date_selection_recurrent_time' === changed_toggle_name || 'date_selection_checkout_available' === changed_toggle_name) {
        schedule_changeover_data_refresh();
      }
    }
    return {
      /**
       * Initialize the editor below the authorized wizard shell.
       *
       * @param {Object} api Shared shell services.
       * @return {void}
       */
      initialize: function (api) {
        var node = api.root.querySelector('[data-wpbc-date-selection-editor]');
        if (!node) {
          return;
        }
        shell_api = api;
        editor = {
          node: node,
          resource_id: parseInt(node.dataset.resourceId, 10) || 1,
          calendar: node.querySelector('[data-wpbc-date-selection-calendar]'),
          changeover: node.querySelector('[data-wpbc-date-selection-changeover]'),
          legend: node.querySelector('[data-wpbc-date-selection-legend]')
        };
        last_selected_mode = get_selected_mode();
        node.addEventListener('change', handle_interaction);
        node.addEventListener('input', handle_interaction);
        node.addEventListener('click', handle_interaction);
        sync();
        render_editor_state();
        schedule_preview_update();
      },
      sync: sync,
      validate: validate
    };
  }

  /**
   * Register after the shared shell exposes its module adapter API.
   *
   * @return {void}
   */
  function register_adapter() {
    if (window.wpbc_setup_wizard_api && 'function' === typeof window.wpbc_setup_wizard_api.register_step_adapter) {
      window.wpbc_setup_wizard_api.register_step_adapter(create_date_selection_adapter(module_config));
    }
  }
  window.wpbc_setup_editor_modules = window.wpbc_setup_editor_modules || {};
  window.wpbc_setup_editor_modules.date_selection = {
    create: create_date_selection_adapter
  };
  if ('loading' === document.readyState) {
    document.addEventListener('DOMContentLoaded', register_adapter);
  } else {
    register_adapter();
  }
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR1cC13aXphcmQvc3RlcC1kYXRlLXNlbGVjdGlvbi9fb3V0L3N0ZXAtZGF0ZS1zZWxlY3Rpb24uanMiLCJuYW1lcyI6WyJ3aW5kb3ciLCJkb2N1bWVudCIsIm1vZHVsZV9jb25maWciLCJ3cGJjX3NldHVwX3dpemFyZF9kYXRlX3NlbGVjdGlvbiIsImkxOG4iLCJjcmVhdGVfZGF0ZV9zZWxlY3Rpb25fYWRhcHRlciIsImNvbmZpZyIsInNoZWxsX2FwaSIsImVkaXRvciIsImFwcGx5X3RpbWVycyIsInByZXZpZXdfZGF0YV90aW1lciIsImxhc3Rfc2VsZWN0ZWRfbW9kZSIsImdldF9tZXNzYWdlIiwia2V5IiwiZmFsbGJhY2siLCJTdHJpbmciLCJnZXRfc2VsZWN0ZWRfbW9kZSIsInNlbGVjdGVkIiwiZ2V0X3NlbGVjdGVkX21vZGVfY29udHJvbCIsInZhbHVlIiwibm9kZSIsInF1ZXJ5U2VsZWN0b3IiLCJnZXRfbW9kZV9wb2xpY3lfc3RhdGUiLCJzZXR0aW5nX25hbWUiLCJzZWxlY3RlZF9tb2RlX2NvbnRyb2wiLCJkYXRhc2V0IiwiYXBwbHlfc2VsZWN0ZWRfbW9kZV9kZWZhdWx0cyIsIm1vZGVfY29udHJvbCIsInNlbGVjdGVkX21vZGUiLCJyZWN1cnJlbnRfcG9saWN5IiwicmVjdXJyZW50X3RvZ2dsZSIsImNoZWNrZWQiLCJ3cGJjRGF0ZVNlbGVjdGlvblBvbGljeVJlY3VycmVudFRpbWUiLCJnZXRfaW50ZWdlciIsInNlbGVjdG9yIiwiY29udHJvbCIsInBhcnNlZCIsInBhcnNlSW50IiwiTmFOIiwiaXNOYU4iLCJnZXRfd2Vla2RheXMiLCJtb2RlIiwidHJhbnNwb3J0IiwidmFsdWVzIiwic3BsaXQiLCJ3ZWVrZGF5cyIsIm1hcCIsImZpbHRlciIsImxlbmd0aCIsInBhcnNlX3NwZWNpZmljX2RheXMiLCJyYXdfc3BlY2lmaWNfZGF5cyIsIm1heGltdW1fZGF5cyIsIm1heF9keW5hbWljX2RheXMiLCJzcGVjaWZpY19leHByZXNzaW9uIiwidHJpbSIsInNwZWNpZmljX2RheXMiLCJ0ZXN0IiwiZm9yRWFjaCIsInNwZWNpZmljX3BhcnQiLCJyYW5nZV9ib3VuZHMiLCJyYW5nZV9ib3VuZCIsInJhbmdlX3N0YXJ0IiwiTWF0aCIsIm1pbiIsImFwcGx5IiwicmFuZ2VfZW5kIiwibWF4Iiwic3BlY2lmaWNfZGF5IiwiaW5kZXhPZiIsInB1c2giLCJzb3J0IiwiZmlyc3RfZGF5Iiwic2Vjb25kX2RheSIsImdldF9zcGVjaWZpY19kYXlzIiwic3luY193ZWVrZGF5X3RyYW5zcG9ydCIsImdyb3VwIiwicXVlcnlTZWxlY3RvckFsbCIsImJ1dHRvbiIsIndlZWtkYXkiLCJmaXJzdF92YWx1ZSIsInNlY29uZF92YWx1ZSIsImpvaW4iLCJhcHBseV93ZWVrZGF5X3ByZXNldCIsInJhd193ZWVrZGF5cyIsInJhd193ZWVrZGF5IiwiaXNfc2VsZWN0ZWQiLCJzZXRBdHRyaWJ1dGUiLCJjbGFzc0xpc3QiLCJ0b2dnbGUiLCJzeW5jX3RvZ2dsZV90cmFuc3BvcnRzIiwiZmllbGRfbmFtZSIsIndwYmNEYXRlU2VsZWN0aW9uVG9nZ2xlIiwicG9saWN5X3N0YXRlIiwid3BiY0RhdGVTZWxlY3Rpb25Qb2xpY3lTdGF0ZSIsImRpc2FibGVkIiwic3luY19kaXNhYmxlZF90b2dnbGVfdG9vbHRpcHMiLCJ0b29sdGlwX3dyYXBwZXIiLCJkZXNjcmlwdGlvbl9pZCIsIndwYmNEYXRlU2VsZWN0aW9uRGlzYWJsZWRUb29sdGlwIiwiZGVzY3JpcHRpb24iLCJnZXRFbGVtZW50QnlJZCIsImRpc2FibGVkX3JlYXNvbiIsIndwYmNEYXRlU2VsZWN0aW9uRGlzYWJsZWRSZWFzb24iLCJ3cGJjRGF0ZVNlbGVjdGlvbkRpc2FibGVkVG9vbHRpcEFjdGl2ZSIsInJlbW92ZUF0dHJpYnV0ZSIsInRleHRDb250ZW50Iiwic3luY19jaGFuZ2VvdmVyX2RlcGVuZGVuY2llcyIsImNoYW5nZW92ZXJfdG9nZ2xlIiwiY2hhbmdlb3Zlcl9jb250cm9scyIsImNoYW5nZW92ZXJfZmllbGRzIiwiY2hlY2tvdXRfb3B0aW9uIiwiY2hlY2tvdXRfdG9nZ2xlIiwiY2hlY2tvdXRfdG9vbHRpcF93cmFwcGVyIiwiY2hlY2tvdXRfZGlzYWJsZWRfcmVhc29uIiwicmVjdXJyZW50X29wdGlvbiIsImJlaGF2aW9yX3NlY3Rpb24iLCJjaGFuZ2VvdmVyX2lzX2FjdGl2ZSIsImNoZWNrb3V0X2lzX3N1cHBvcnRlZCIsImNoYW5nZW92ZXJfcG9saWN5IiwiY2hlY2tvdXRfcG9saWN5IiwiY2hhbmdlb3ZlciIsImNsb3Nlc3QiLCJ3cGJjRGF0ZVNlbGVjdGlvbkVkaXRpb25Mb2NrZWQiLCJCb29sZWFuIiwiaGlkZGVuIiwid3BiY0RhdGVTZWxlY3Rpb25DaGVja291dFJlYXNvbkVkaXRpb24iLCJ3cGJjRGF0ZVNlbGVjdGlvbkNoZWNrb3V0UmVhc29uQ2hhbmdlb3ZlciIsIndwYmNEYXRlU2VsZWN0aW9uQ2hlY2tvdXRSZWFzb25Nb2RlIiwiYXBwbHlfZXhjbHVzaXZlX3RvZ2dsZV9hY3Rpb24iLCJjb25mbGljdGluZ190b2dnbGUiLCJzeW5jX2xlZ2VuZF9wcmV2aWV3IiwibGVnZW5kX3RvZ2dsZSIsImxlZ2VuZF9zZXR0aW5ncyIsImxlZ2VuZF9wcmV2aWV3Iiwic2hvd19udW1iZXJzX3RvZ2dsZSIsInZlcnRpY2FsX3RvZ2dsZSIsImRheV9udW1iZXIiLCJsZWdlbmQiLCJ3cGJjRGF0ZVNlbGVjdGlvbkxlZ2VuZERheU51bWJlciIsInByZXZpZXdfaXRlbSIsImxlZ2VuZF9pZCIsIndwYmNEYXRlU2VsZWN0aW9uTGVnZW5kUHJldmlld0l0ZW0iLCJpdGVtX3RvZ2dsZSIsInRpdGxlX2NvbnRyb2wiLCJ0aXRsZV9ub2RlIiwidGl0bGUiLCJwbGFjZWhvbGRlciIsImRhdGVfbm9kZSIsInN5bmNfY2hhbmdlb3Zlcl9wcmV2aWV3X2NsYXNzZXMiLCJjaGFuZ2VvdmVyX3RyYW5zcG9ydCIsInRyaWFuZ2xlc190cmFuc3BvcnQiLCJ0cmlhbmdsZXNfYXJlX2FjdGl2ZSIsInBhcnRpYWxseV9pdGVtIiwicGFydGlhbGx5X2RheSIsImxlZ2VuZF90YWJsZSIsImxlZ2VuZF93cmFwcGVyIiwiY2hhbmdlb3Zlcl9jbGFzc2VzIiwiY2FsZW5kYXIiLCJjYWxlbmRhcl93cmFwcGVyIiwiY2xhc3NfbmFtZSIsInBhcmVudEVsZW1lbnQiLCJyZWZyZXNoX2NoYW5nZW92ZXJfcHJldmlld19kYXRhIiwicmVjdXJyZW50X3RyYW5zcG9ydCIsImNoZWNrb3V0X3RyYW5zcG9ydCIsInByZXZpZXdfbm9uY2UiLCJ3cGJjX2NhbGVuZGFyX19sb2FkX2RhdGFfX2FqeCIsInJlc291cmNlX2lkIiwiYm9va2luZ19oYXNoIiwicmVxdWVzdF91cmkiLCJjdXN0b21fZm9ybSIsImFnZ3JlZ2F0ZV9yZXNvdXJjZV9pZF9zdHIiLCJhZ2dyZWdhdGVfdHlwZSIsInNraXBfZ2VuZXJhbF9hdmFpbGFiaWxpdHkiLCJjbGFzc2ljX2Jvb2tpbmdfY29udGV4dF90b2tlbiIsIndwYmNfc2V0dGluZ3NfY2FsZW5kYXJfcHJldmlldyIsIndwYmNfc2V0dXBfd2l6YXJkX2RhdGVfc2VsZWN0aW9uX3ByZXZpZXciLCJ3cGJjX3NldHVwX3dpemFyZF9kYXRlX3NlbGVjdGlvbl9wcmV2aWV3X25vbmNlIiwid3BiY19zZXR0aW5nc19jYWxlbmRhcl9wcmV2aWV3X2NoYW5nZW92ZXIiLCJ3cGJjX3NldHRpbmdzX2NhbGVuZGFyX3ByZXZpZXdfdHJpYW5nbGVzIiwid3BiY19zZXR0aW5nc19jYWxlbmRhcl9wcmV2aWV3X3JlY3VycmVudF90aW1lIiwid3BiY19zZXR0aW5nc19jYWxlbmRhcl9wcmV2aWV3X2xhc3RfY2hlY2tvdXQiLCJ3cGJjX3NldHRpbmdzX2NhbGVuZGFyX3ByZXZpZXdfc2hvd19sZWdlbmQiLCJzY2hlZHVsZV9jaGFuZ2VvdmVyX2RhdGFfcmVmcmVzaCIsImNsZWFyVGltZW91dCIsInNldFRpbWVvdXQiLCJnZXRfbnVtYmVyX2NvbnRyb2wiLCJzeW5jX3JhbmdlX2Zyb21fbnVtYmVyIiwibnVtYmVyX2NvbnRyb2wiLCJ3cGJjRGF0ZVNlbGVjdGlvbk51bWJlciIsInJhbmdlX2NvbnRyb2wiLCJjaGVja1ZhbGlkaXR5Iiwic3luY19udW1iZXJfZnJvbV9yYW5nZSIsIndwYmNEYXRlU2VsZWN0aW9uUmFuZ2UiLCJzeW5jX251bWJlcl9yYW5nZXMiLCJhcHBseV9udW1iZXJfcHJlc2V0IiwicmF3X3ZhbHVlIiwiYXBwbHlfc3BlY2lmaWNfZGF5X3ByZXNldCIsInByZXNldF9idXR0b24iLCJ0ZXh0X2NvbnRyb2wiLCJ3cGJjRGF0ZVNlbGVjdGlvblNwZWNpZmljUHJlc2V0IiwiaGFzQXR0cmlidXRlIiwid3BiY0RhdGVTZWxlY3Rpb25QcmVzZXRNaW5pbXVtIiwid3BiY0RhdGVTZWxlY3Rpb25QcmVzZXRNYXhpbXVtIiwid3BiY0RhdGVTZWxlY3Rpb25QcmVzZXRXZWVrZGF5cyIsImNsZWFyX2ZpZWxkX2Vycm9yIiwicmVuZGVyX2VkaXRvcl9zdGF0ZSIsImNhcmQiLCJyYWRpbyIsInBhbmVsIiwid3BiY0RhdGVTZWxlY3Rpb25QYW5lbCIsInNldF9jYWxlbmRhcl9wYXJhbWV0ZXIiLCJfd3BiYyIsImNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUiLCJub3JtYWxpemVfY2FsZW5kYXJfc2Nyb2xsX3RhcmdldCIsInNjcm9sbF90YXJnZXQiLCJjYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlIiwiQXJyYXkiLCJpc0FycmF5IiwiYXBwbHlfcHJldmlld19wb2xpY3kiLCJyZWN1cnJlbnRfdGltZSIsInRyaWFuZ2xlcyIsImNhbGVuZGFyX25vZGUiLCJmaXhlZF9kYXlzIiwiZml4ZWRfd2Vla2RheXMiLCJkeW5hbWljX21pbiIsImR5bmFtaWNfbWF4IiwiZHluYW1pY19zcGVjaWZpYyIsImR5bmFtaWNfd2Vla2RheXMiLCJzZXRfb3RoZXJfcGFyYW0iLCJ3cGJjX19jb25kaXRpb25zX19TQVZFX0lOSVRJQUxfX2RheXNfc2VsZWN0aW9uX3BhcmFtc19fYm0iLCJ3cGJjX2NhbF9kYXlzX3NlbGVjdF9fc2luZ2xlIiwid3BiY19jYWxfZGF5c19zZWxlY3RfX211bHRpcGxlIiwid3BiY19jYWxfZGF5c19zZWxlY3RfX2ZpeGVkIiwid3BiY19jYWxfZGF5c19zZWxlY3RfX3JhbmdlIiwic2NoZWR1bGVfcHJldmlld191cGRhdGUiLCJ0aW1lcl9pZCIsImRlbGF5Iiwic3luYyIsInZhbGlkYXRlIiwiZml4ZWRfY29udHJvbCIsImR5bmFtaWNfbWluX2NvbnRyb2wiLCJkeW5hbWljX21heF9jb250cm9sIiwiZHluYW1pY19zcGVjaWZpY19jb250cm9sIiwic2V0X2ZpZWxkX2Vycm9yIiwibWF4X2ZpeGVkX2RheXMiLCJzb21lIiwiaGFuZGxlX2ludGVyYWN0aW9uIiwiZXZlbnQiLCJ3ZWVrZGF5X2J1dHRvbiIsInRhcmdldCIsInNwZWNpZmljX3ByZXNldCIsInNwZWNpZmljX2NvbnRyb2wiLCJjaGFuZ2VkX21vZGUiLCJjaGFuZ2VkX3RvZ2dsZSIsImNoYW5nZWRfdG9nZ2xlX25hbWUiLCJlZGl0b3JfY29udHJvbCIsInByZXZlbnREZWZhdWx0IiwiZ2V0QXR0cmlidXRlIiwid3BiY0RhdGVTZWxlY3Rpb25XZWVrZGF5cyIsImluaXRpYWxpemUiLCJhcGkiLCJyb290IiwicmVzb3VyY2VJZCIsImFkZEV2ZW50TGlzdGVuZXIiLCJyZWdpc3Rlcl9hZGFwdGVyIiwid3BiY19zZXR1cF93aXphcmRfYXBpIiwicmVnaXN0ZXJfc3RlcF9hZGFwdGVyIiwid3BiY19zZXR1cF9lZGl0b3JfbW9kdWxlcyIsImRhdGVfc2VsZWN0aW9uIiwiY3JlYXRlIiwicmVhZHlTdGF0ZSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2Utc2V0dXAtd2l6YXJkL3N0ZXAtZGF0ZS1zZWxlY3Rpb24vX3NyYy9zdGVwLWRhdGUtc2VsZWN0aW9uLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogRHJpdmUgdGhlIFNldHVwIFdpemFyZCBEYXRlIFNlbGVjdGlvbiBlZGl0b3IgYW5kIHJlYWwgY2FsZW5kYXIgcHJldmlldy5cbiAqXG4gKiBDYW5vbmljYWwgQm9va2luZyBDYWxlbmRhciBoZWxwZXJzIHJlbWFpbiByZXNwb25zaWJsZSBmb3Igc2VsZWN0aW9uIHJ1bGVzLlxuICogVGhpcyBhZGFwdGVyIGNoYW5nZXMgb25seSByZXF1ZXN0LWxvY2FsIGNhbGVuZGFyIHBhcmFtZXRlcnMgYW5kIGRyYWZ0IGZpZWxkcztcbiAqIGl0IGRvZXMgbm90IHNhdmUgc2V0dGluZ3Mgb3Igc3VibWl0IGEgYm9va2luZy5cbiAqXG4gKiBAcGFja2FnZSBCb29raW5nIENhbGVuZGFyXG4gKi9cbiggZnVuY3Rpb24gKCB3aW5kb3csIGRvY3VtZW50ICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIG1vZHVsZV9jb25maWcgPSB3aW5kb3cud3BiY19zZXR1cF93aXphcmRfZGF0ZV9zZWxlY3Rpb24gfHwgeyBpMThuOiB7fSB9O1xuXG5cdC8qKlxuXHQgKiBDcmVhdGUgb25lIGlzb2xhdGVkIERhdGUgU2VsZWN0aW9uIHN0ZXAgYWRhcHRlci5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBMb2NhbGl6ZWQgbGltaXRzIGFuZCBtZXNzYWdlcy5cblx0ICogQHJldHVybiB7T2JqZWN0fSBBZGFwdGVyIGFjY2VwdGVkIGJ5IHRoZSBzaGFyZWQgd2l6YXJkIHNoZWxsLlxuXHQgKi9cblx0ZnVuY3Rpb24gY3JlYXRlX2RhdGVfc2VsZWN0aW9uX2FkYXB0ZXIoIGNvbmZpZyApIHtcblx0XHR2YXIgc2hlbGxfYXBpID0gbnVsbDtcblx0XHR2YXIgZWRpdG9yID0gbnVsbDtcblx0XHR2YXIgYXBwbHlfdGltZXJzID0gW107XG5cdFx0dmFyIHByZXZpZXdfZGF0YV90aW1lciA9IG51bGw7XG5cdFx0dmFyIGxhc3Rfc2VsZWN0ZWRfbW9kZSA9ICcnO1xuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIG9uZSBsb2NhbGl6ZWQgbWVzc2FnZSB3aXRoIGEgc2FmZSBmYWxsYmFjay5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgICAgICBUcmFuc2xhdGlvbiBrZXkuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGZhbGxiYWNrIEZhbGxiYWNrIG1lc3NhZ2UuXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBUcmFuc2xhdGlvbiBvciBmYWxsYmFjay5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfbWVzc2FnZSgga2V5LCBmYWxsYmFjayApIHtcblx0XHRcdHJldHVybiBjb25maWcuaTE4biAmJiBjb25maWcuaTE4blsga2V5IF0gPyBTdHJpbmcoIGNvbmZpZy5pMThuWyBrZXkgXSApIDogZmFsbGJhY2s7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBzZWxlY3RlZCBtb2RlIGlkZW50aWZpZXIuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IFNlbGVjdGVkIG1vZGUgb3IgYW4gZW1wdHkgc3RyaW5nLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9zZWxlY3RlZF9tb2RlKCkge1xuXHRcdFx0dmFyIHNlbGVjdGVkID0gZ2V0X3NlbGVjdGVkX21vZGVfY29udHJvbCgpO1xuXG5cdFx0XHRyZXR1cm4gc2VsZWN0ZWQgPyBzZWxlY3RlZC52YWx1ZSA6ICcnO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgc2VsZWN0ZWQgc2VydmVyLWF1dGhvcml6ZWQgbW9kZSBjb250cm9sLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR8bnVsbH0gU2VsZWN0ZWQgcmFkaW8gY29udHJvbCBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9zZWxlY3RlZF9tb2RlX2NvbnRyb2woKSB7XG5cdFx0XHRyZXR1cm4gZWRpdG9yID8gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tbW9kZV06Y2hlY2tlZCcgKSA6IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVhZCBvbmUgZGVwZW5kZW50LXNldHRpbmcgc3RhdGUgZnJvbSB0aGUgc2VsZWN0ZWQgbW9kZSBwb2xpY3kuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gc2V0dGluZ19uYW1lIFBvbGljeSBzZXR0aW5nIG5hbWUgaW4gY2FtZWwgY2FzZS5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IFBvbGljeSBzdGF0ZSBvciBgaGlkZGVuX29mZmAuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X21vZGVfcG9saWN5X3N0YXRlKCBzZXR0aW5nX25hbWUgKSB7XG5cdFx0XHR2YXIgc2VsZWN0ZWRfbW9kZV9jb250cm9sID0gZ2V0X3NlbGVjdGVkX21vZGVfY29udHJvbCgpO1xuXG5cdFx0XHRpZiAoICEgc2VsZWN0ZWRfbW9kZV9jb250cm9sIHx8ICEgc2VsZWN0ZWRfbW9kZV9jb250cm9sLmRhdGFzZXRbIHNldHRpbmdfbmFtZSBdICkge1xuXHRcdFx0XHRyZXR1cm4gJ2hpZGRlbl9vZmYnO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gU3RyaW5nKCBzZWxlY3RlZF9tb2RlX2NvbnRyb2wuZGF0YXNldFsgc2V0dGluZ19uYW1lIF0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBcHBseSBkZWZhdWx0cyBvbmx5IHdoZW4gdGhlIGN1c3RvbWVyIGNoYW5nZXMgdGhlIERhdGUgU2VsZWN0aW9uIG1vZGUuXG5cdFx0ICpcblx0XHQgKiBUaW1lLWJhc2VkIEN1c3RvbWVyIEpvdXJuZXlzIGRlZmF1bHQgcmVjdXJyZW50IHNlbGVjdGVkLXRpbWUgYmVoYXZpb3IgdG9cblx0XHQgKiBvbiBmb3IgTXVsdGlwbGUgZGF5cywgd2hpbGUgbGVhdmluZyB0aGUgdmlzaWJsZSBvcHRpb24gZWRpdGFibGUgYWZ0ZXJ3YXJkLlxuXHRcdCAqIFRyYWNraW5nIHRoZSBwcmV2aW91cyBtb2RlIHByZXZlbnRzIGxhdGVyIHN5bmNocm9uaXphdGlvbiBmcm9tIG92ZXJ3cml0aW5nXG5cdFx0ICogYW4gZXhwbGljaXQgY3VzdG9tZXIgY2hvaWNlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSBtb2RlX2NvbnRyb2wgQ2hhbmdlZCBtb2RlIHJhZGlvIGNvbnRyb2wuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBhcHBseV9zZWxlY3RlZF9tb2RlX2RlZmF1bHRzKCBtb2RlX2NvbnRyb2wgKSB7XG5cdFx0XHR2YXIgc2VsZWN0ZWRfbW9kZTtcblx0XHRcdHZhciByZWN1cnJlbnRfcG9saWN5O1xuXHRcdFx0dmFyIHJlY3VycmVudF90b2dnbGU7XG5cblx0XHRcdGlmICggISBlZGl0b3IgfHwgISBtb2RlX2NvbnRyb2wgfHwgISBtb2RlX2NvbnRyb2wuY2hlY2tlZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRzZWxlY3RlZF9tb2RlID0gU3RyaW5nKCBtb2RlX2NvbnRyb2wudmFsdWUgfHwgJycgKTtcblx0XHRcdGlmICggc2VsZWN0ZWRfbW9kZSA9PT0gbGFzdF9zZWxlY3RlZF9tb2RlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRsYXN0X3NlbGVjdGVkX21vZGUgPSBzZWxlY3RlZF9tb2RlO1xuXHRcdFx0cmVjdXJyZW50X3BvbGljeSA9IFN0cmluZyggbW9kZV9jb250cm9sLmRhdGFzZXQud3BiY0RhdGVTZWxlY3Rpb25Qb2xpY3lSZWN1cnJlbnRUaW1lIHx8ICcnICk7XG5cdFx0XHRpZiAoICdvcHRpb25hbF9kZWZhdWx0X29uJyAhPT0gcmVjdXJyZW50X3BvbGljeSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRyZWN1cnJlbnRfdG9nZ2xlID0gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tdG9nZ2xlPVwiZGF0ZV9zZWxlY3Rpb25fcmVjdXJyZW50X3RpbWVcIl0nICk7XG5cdFx0XHRpZiAoIHJlY3VycmVudF90b2dnbGUgKSB7XG5cdFx0XHRcdHJlY3VycmVudF90b2dnbGUuY2hlY2tlZCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUGFyc2Ugb25lIGJvdW5kZWQgaW50ZWdlciBjb250cm9sLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHNlbGVjdG9yIENvbnRyb2wgc2VsZWN0b3IgYmVsb3cgdGhlIGVkaXRvci5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gZmFsbGJhY2sgVmFsdWUgdXNlZCBmb3IgYW4gYWJzZW50IG9yIGludmFsaWQgY29udHJvbC5cblx0XHQgKiBAcmV0dXJuIHtudW1iZXJ9IFBhcnNlZCBpbnRlZ2VyLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9pbnRlZ2VyKCBzZWxlY3RvciwgZmFsbGJhY2sgKSB7XG5cdFx0XHR2YXIgY29udHJvbCA9IGVkaXRvciA/IGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3IoIHNlbGVjdG9yICkgOiBudWxsO1xuXHRcdFx0dmFyIHBhcnNlZCA9IGNvbnRyb2wgPyBwYXJzZUludCggY29udHJvbC52YWx1ZSwgMTAgKSA6IE5hTjtcblxuXHRcdFx0cmV0dXJuIGlzTmFOKCBwYXJzZWQgKSA/IGZhbGxiYWNrIDogcGFyc2VkO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENvbnZlcnQgb25lIHdlZWtkYXkgdHJhbnNwb3J0IGZpZWxkIHRvIHRoZSBjYW5vbmljYWwgbnVtYmVyIGFycmF5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG1vZGUgUmFuZ2UgbW9kZSBvd25pbmcgdGhlIHRyYW5zcG9ydCBmaWVsZC5cblx0XHQgKiBAcmV0dXJuIHtudW1iZXJbXX0gV2Vla2RheSBudW1iZXJzIG9yIHRoZSB1bnJlc3RyaWN0ZWQgbWFya2VyLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF93ZWVrZGF5cyggbW9kZSApIHtcblx0XHRcdHZhciB0cmFuc3BvcnQgPSBlZGl0b3IgPyBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1kYXRlLXNlbGVjdGlvbi13ZWVrZGF5LXRyYW5zcG9ydD1cIicgKyBtb2RlICsgJ1wiXScgKSA6IG51bGw7XG5cdFx0XHR2YXIgdmFsdWVzID0gdHJhbnNwb3J0ID8gU3RyaW5nKCB0cmFuc3BvcnQudmFsdWUgfHwgJycgKS5zcGxpdCggJywnICkgOiBbXTtcblx0XHRcdHZhciB3ZWVrZGF5cyA9IHZhbHVlcy5tYXAoIGZ1bmN0aW9uICggdmFsdWUgKSB7XG5cdFx0XHRcdHJldHVybiBwYXJzZUludCggdmFsdWUsIDEwICk7XG5cdFx0XHR9ICkuZmlsdGVyKCBmdW5jdGlvbiAoIHZhbHVlICkge1xuXHRcdFx0XHRyZXR1cm4gLTEgPT09IHZhbHVlIHx8ICggdmFsdWUgPj0gMCAmJiB2YWx1ZSA8PSA2ICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiB3ZWVrZGF5cy5sZW5ndGggPyB3ZWVrZGF5cyA6IFsgLTEgXTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBQYXJzZSB0aGUgcmVsZWFzZWQgY29tbWEtYW5kLXJhbmdlIHN5bnRheCBpbnRvIGNhbm9uaWNhbCBkYXkgbGVuZ3Rocy5cblx0XHQgKlxuXHRcdCAqIFRoaXMgaW50ZW50aW9uYWxseSBtaXJyb3JzIHRoZSBzZXJ2ZXIgdmFsaWRhdG9yIGluc3RlYWQgb2YgZXZhbHVhdGluZ1xuXHRcdCAqIGlucHV0IHRleHQuIEFuIGVtcHR5IGV4cHJlc3Npb24gbWVhbnMgdGhhdCBldmVyeSBsZW5ndGggd2l0aGluIHRoZVxuXHRcdCAqIGNvbmZpZ3VyZWQgbWluaW11bSBhbmQgbWF4aW11bSBpcyBhbGxvd2VkLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHJhd19zcGVjaWZpY19kYXlzIFVudHJ1c3RlZCB0ZXh0IGZpZWxkIHZhbHVlLlxuXHRcdCAqIEByZXR1cm4ge251bWJlcltdfG51bGx9IFNvcnRlZCB1bmlxdWUgbGVuZ3RocywgYW4gZW1wdHkgYXJyYXksIG9yIG51bGwgd2hlbiBpbnZhbGlkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHBhcnNlX3NwZWNpZmljX2RheXMoIHJhd19zcGVjaWZpY19kYXlzICkge1xuXHRcdFx0dmFyIG1heGltdW1fZGF5cyA9IHBhcnNlSW50KCBjb25maWcubWF4X2R5bmFtaWNfZGF5cyB8fCAxMDk1LCAxMCApO1xuXHRcdFx0dmFyIHNwZWNpZmljX2V4cHJlc3Npb24gPSBTdHJpbmcoIHJhd19zcGVjaWZpY19kYXlzIHx8ICcnICkudHJpbSgpO1xuXHRcdFx0dmFyIHNwZWNpZmljX2RheXMgPSBbXTtcblxuXHRcdFx0aWYgKCAnJyA9PT0gc3BlY2lmaWNfZXhwcmVzc2lvbiApIHtcblx0XHRcdFx0cmV0dXJuIHNwZWNpZmljX2RheXM7XG5cdFx0XHR9XG5cdFx0XHRpZiAoXG5cdFx0XHRcdHNwZWNpZmljX2V4cHJlc3Npb24ubGVuZ3RoID4gNTAwXG5cdFx0XHRcdHx8ICEgL15cXGQrKD86XFxzKi1cXHMqXFxkKyk/KD86XFxzKixcXHMqXFxkKyg/OlxccyotXFxzKlxcZCspPykqJC8udGVzdCggc3BlY2lmaWNfZXhwcmVzc2lvbiApXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdHNwZWNpZmljX2V4cHJlc3Npb24uc3BsaXQoICcsJyApLmZvckVhY2goIGZ1bmN0aW9uICggc3BlY2lmaWNfcGFydCApIHtcblx0XHRcdFx0dmFyIHJhbmdlX2JvdW5kcyA9IHNwZWNpZmljX3BhcnQudHJpbSgpLnNwbGl0KCAvXFxzKi1cXHMqLyApLm1hcCggZnVuY3Rpb24gKCByYW5nZV9ib3VuZCApIHtcblx0XHRcdFx0XHRyZXR1cm4gcGFyc2VJbnQoIHJhbmdlX2JvdW5kLCAxMCApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdHZhciByYW5nZV9zdGFydCA9IE1hdGgubWluLmFwcGx5KCBudWxsLCByYW5nZV9ib3VuZHMgKTtcblx0XHRcdFx0dmFyIHJhbmdlX2VuZCA9IE1hdGgubWF4LmFwcGx5KCBudWxsLCByYW5nZV9ib3VuZHMgKTtcblx0XHRcdFx0dmFyIHNwZWNpZmljX2RheTtcblxuXHRcdFx0XHRpZiAoIG51bGwgPT09IHNwZWNpZmljX2RheXMgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCByYW5nZV9zdGFydCA8IDEgfHwgcmFuZ2VfZW5kID4gbWF4aW11bV9kYXlzICkge1xuXHRcdFx0XHRcdHNwZWNpZmljX2RheXMgPSBudWxsO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGZvciAoIHNwZWNpZmljX2RheSA9IHJhbmdlX3N0YXJ0OyBzcGVjaWZpY19kYXkgPD0gcmFuZ2VfZW5kOyBzcGVjaWZpY19kYXkrKyApIHtcblx0XHRcdFx0XHRpZiAoIC0xID09PSBzcGVjaWZpY19kYXlzLmluZGV4T2YoIHNwZWNpZmljX2RheSApICkge1xuXHRcdFx0XHRcdFx0c3BlY2lmaWNfZGF5cy5wdXNoKCBzcGVjaWZpY19kYXkgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIG51bGwgPT09IHNwZWNpZmljX2RheXMgPyBudWxsIDogc3BlY2lmaWNfZGF5cy5zb3J0KCBmdW5jdGlvbiAoIGZpcnN0X2RheSwgc2Vjb25kX2RheSApIHtcblx0XHRcdFx0cmV0dXJuIGZpcnN0X2RheSAtIHNlY29uZF9kYXk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBzcGVjaWZpYyBmbGV4aWJsZS1yYW5nZSBsZW5ndGhzIGZyb20gdGhlIGN1cnJlbnQgZWRpdG9yLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7bnVtYmVyW118bnVsbH0gQ2Fub25pY2FsIGxlbmd0aHMsIGFuIGVtcHR5IGFycmF5LCBvciBudWxsIHdoZW4gaW52YWxpZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfc3BlY2lmaWNfZGF5cygpIHtcblx0XHRcdHZhciBjb250cm9sID0gZWRpdG9yID8gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tc3BlY2lmaWNdJyApIDogbnVsbDtcblxuXHRcdFx0cmV0dXJuIHBhcnNlX3NwZWNpZmljX2RheXMoIGNvbnRyb2wgPyBjb250cm9sLnZhbHVlIDogJycgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBXcml0ZSB2aXNpYmxlIHdlZWtkYXkgYnV0dG9uIHN0YXRlIGludG8gaXRzIHNjYWxhciB0cmFuc3BvcnQgZmllbGQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbW9kZSBSYW5nZSBtb2RlIG93bmluZyB0aGUgY29udHJvbHMuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzeW5jX3dlZWtkYXlfdHJhbnNwb3J0KCBtb2RlICkge1xuXHRcdFx0dmFyIGdyb3VwID0gZWRpdG9yID8gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24td2Vla2RheXM9XCInICsgbW9kZSArICdcIl0nICkgOiBudWxsO1xuXHRcdFx0dmFyIHRyYW5zcG9ydCA9IGVkaXRvciA/IGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWRhdGUtc2VsZWN0aW9uLXdlZWtkYXktdHJhbnNwb3J0PVwiJyArIG1vZGUgKyAnXCJdJyApIDogbnVsbDtcblx0XHRcdHZhciBzZWxlY3RlZCA9IFtdO1xuXG5cdFx0XHRpZiAoICEgZ3JvdXAgfHwgISB0cmFuc3BvcnQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Z3JvdXAucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdlZWtkYXldW2FyaWEtcHJlc3NlZD1cInRydWVcIl0nICkuZm9yRWFjaCggZnVuY3Rpb24gKCBidXR0b24gKSB7XG5cdFx0XHRcdHNlbGVjdGVkLnB1c2goIHBhcnNlSW50KCBidXR0b24uZGF0YXNldC53ZWVrZGF5LCAxMCApICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRzZWxlY3RlZCA9IHNlbGVjdGVkLmZpbHRlciggZnVuY3Rpb24gKCB2YWx1ZSApIHtcblx0XHRcdFx0cmV0dXJuICEgaXNOYU4oIHZhbHVlICkgJiYgdmFsdWUgPj0gMCAmJiB2YWx1ZSA8PSA2O1xuXHRcdFx0fSApLnNvcnQoIGZ1bmN0aW9uICggZmlyc3RfdmFsdWUsIHNlY29uZF92YWx1ZSApIHtcblx0XHRcdFx0cmV0dXJuIGZpcnN0X3ZhbHVlIC0gc2Vjb25kX3ZhbHVlO1xuXHRcdFx0fSApO1xuXG5cdFx0XHR0cmFuc3BvcnQudmFsdWUgPSA3ID09PSBzZWxlY3RlZC5sZW5ndGggfHwgMCA9PT0gc2VsZWN0ZWQubGVuZ3RoID8gJy0xJyA6IHNlbGVjdGVkLmpvaW4oICcsJyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFwcGx5IGEgY2Fub25pY2FsIHdlZWtkYXkgcHJlc2V0IHRvIHRoZSB2aXNpYmxlIGJ1dHRvbnMgYW5kIHRyYW5zcG9ydC5cblx0XHQgKlxuXHRcdCAqIFRoZSBgLTFgIHVucmVzdHJpY3RlZCBtYXJrZXIgaXMgcHJlc2VudGVkIGFzIGFsbCBzZXZlbiB3ZWVrZGF5cyBzZWxlY3RlZFxuXHRcdCAqIHNvIHRoZSBhbGxvd2VkLXN0YXJ0LWRheXMgc3RhdGUgcmVtYWlucyBleHBsaWNpdCB0byBzaWdodGVkIHVzZXJzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG1vZGUgICAgICAgICBSYW5nZSBtb2RlIG93bmluZyB0aGUgY29udHJvbHMuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHJhd193ZWVrZGF5cyBDYW5vbmljYWwgY29tbWEgbGlzdCBvciBgLTFgIGZvciBhbnkgZGF5LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYXBwbHlfd2Vla2RheV9wcmVzZXQoIG1vZGUsIHJhd193ZWVrZGF5cyApIHtcblx0XHRcdHZhciBncm91cCA9IGVkaXRvciA/IGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWRhdGUtc2VsZWN0aW9uLXdlZWtkYXlzPVwiJyArIG1vZGUgKyAnXCJdJyApIDogbnVsbDtcblx0XHRcdHZhciB3ZWVrZGF5cyA9ICctMScgPT09IHJhd193ZWVrZGF5cyA/IFsgMCwgMSwgMiwgMywgNCwgNSwgNiBdIDogU3RyaW5nKCByYXdfd2Vla2RheXMgfHwgJycgKS5zcGxpdCggJywnICkubWFwKCBmdW5jdGlvbiAoIHJhd193ZWVrZGF5ICkge1xuXHRcdFx0XHRyZXR1cm4gcGFyc2VJbnQoIHJhd193ZWVrZGF5LCAxMCApO1xuXHRcdFx0fSApLmZpbHRlciggZnVuY3Rpb24gKCB3ZWVrZGF5ICkge1xuXHRcdFx0XHRyZXR1cm4gISBpc05hTiggd2Vla2RheSApICYmIHdlZWtkYXkgPj0gMCAmJiB3ZWVrZGF5IDw9IDY7XG5cdFx0XHR9ICk7XG5cblx0XHRcdGlmICggISBncm91cCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRncm91cC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd2Vla2RheV0nICkuZm9yRWFjaCggZnVuY3Rpb24gKCBidXR0b24gKSB7XG5cdFx0XHRcdHZhciBpc19zZWxlY3RlZCA9IC0xICE9PSB3ZWVrZGF5cy5pbmRleE9mKCBwYXJzZUludCggYnV0dG9uLmRhdGFzZXQud2Vla2RheSwgMTAgKSApO1xuXG5cdFx0XHRcdGJ1dHRvbi5zZXRBdHRyaWJ1dGUoICdhcmlhLXByZXNzZWQnLCBpc19zZWxlY3RlZCA/ICd0cnVlJyA6ICdmYWxzZScgKTtcblx0XHRcdFx0YnV0dG9uLmNsYXNzTGlzdC50b2dnbGUoICdpcy1zZWxlY3RlZCcsIGlzX3NlbGVjdGVkICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRzeW5jX3dlZWtkYXlfdHJhbnNwb3J0KCBtb2RlICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3luY2hyb25pemUgdmlzaWJsZSBzd2l0Y2hlcyBpbnRvIHRoZWlyIGFsbG93LWxpc3RlZCBoaWRkZW4gZmllbGRzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzeW5jX3RvZ2dsZV90cmFuc3BvcnRzKCkge1xuXHRcdFx0aWYgKCAhIGVkaXRvciApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1kYXRlLXNlbGVjdGlvbi10b2dnbGVdJyApLmZvckVhY2goIGZ1bmN0aW9uICggdG9nZ2xlICkge1xuXHRcdFx0XHR2YXIgZmllbGRfbmFtZSA9IHRvZ2dsZS5kYXRhc2V0LndwYmNEYXRlU2VsZWN0aW9uVG9nZ2xlO1xuXHRcdFx0XHR2YXIgdHJhbnNwb3J0ID0gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tuYW1lPVwiJyArIGZpZWxkX25hbWUgKyAnXCJdJyApO1xuXHRcdFx0XHR2YXIgcG9saWN5X3N0YXRlID0gU3RyaW5nKCB0b2dnbGUuZGF0YXNldC53cGJjRGF0ZVNlbGVjdGlvblBvbGljeVN0YXRlIHx8ICcnICk7XG5cblx0XHRcdFx0aWYgKCB0cmFuc3BvcnQgKSB7XG5cdFx0XHRcdFx0aWYgKCAncmVxdWlyZWRfb24nID09PSBwb2xpY3lfc3RhdGUgfHwgJ2hpZGRlbl9vbicgPT09IHBvbGljeV9zdGF0ZSApIHtcblx0XHRcdFx0XHRcdHRyYW5zcG9ydC52YWx1ZSA9ICdPbic7XG5cdFx0XHRcdFx0fSBlbHNlIGlmICggJ2hpZGRlbl9vZmYnID09PSBwb2xpY3lfc3RhdGUgKSB7XG5cdFx0XHRcdFx0XHR0cmFuc3BvcnQudmFsdWUgPSAnT2ZmJztcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dHJhbnNwb3J0LnZhbHVlID0gdG9nZ2xlLmNoZWNrZWQgJiYgISB0b2dnbGUuZGlzYWJsZWQgPyAnT24nIDogJ09mZic7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRXhwbGFpbiBjb25maWd1cmF0aW9uLWRyaXZlbiBkaXNhYmxlZCB0b2dnbGUgc3RhdGVzLlxuXHRcdCAqXG5cdFx0ICogTmF0aXZlIGRpc2FibGVkIGlucHV0cyBkbyBub3QgcmVjZWl2ZSBwb2ludGVyIG9yIGtleWJvYXJkIGZvY3VzLiBUaGVcblx0XHQgKiBzdXJyb3VuZGluZyB0b2dnbGUgcmVtYWlucyBob3ZlcmFibGUgYW5kIGJlY29tZXMga2V5Ym9hcmQgZm9jdXNhYmxlIG9ubHlcblx0XHQgKiB3aGlsZSBhIGRvY3VtZW50ZWQgZGVwZW5kZW5jeSBvciBlZGl0aW9uIHJ1bGUgZGlzYWJsZXMgaXRzIGlucHV0LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzeW5jX2Rpc2FibGVkX3RvZ2dsZV90b29sdGlwcygpIHtcblx0XHRcdGlmICggISBlZGl0b3IgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0ZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tZGlzYWJsZWQtdG9vbHRpcF0nICkuZm9yRWFjaCggZnVuY3Rpb24gKCB0b29sdGlwX3dyYXBwZXIgKSB7XG5cdFx0XHRcdHZhciB0b2dnbGUgPSB0b29sdGlwX3dyYXBwZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tdG9nZ2xlXScgKTtcblx0XHRcdFx0dmFyIGRlc2NyaXB0aW9uX2lkID0gU3RyaW5nKCB0b29sdGlwX3dyYXBwZXIuZGF0YXNldC53cGJjRGF0ZVNlbGVjdGlvbkRpc2FibGVkVG9vbHRpcCB8fCAnJyApO1xuXHRcdFx0XHR2YXIgZGVzY3JpcHRpb24gPSBkZXNjcmlwdGlvbl9pZCA/IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBkZXNjcmlwdGlvbl9pZCApIDogbnVsbDtcblx0XHRcdFx0dmFyIGRpc2FibGVkX3JlYXNvbiA9IHRvZ2dsZSAmJiB0b2dnbGUuZGlzYWJsZWQgPyBTdHJpbmcoIHRvZ2dsZS5kYXRhc2V0LndwYmNEYXRlU2VsZWN0aW9uRGlzYWJsZWRSZWFzb24gfHwgJycgKSA6ICcnO1xuXG5cdFx0XHRcdGlmICggZGlzYWJsZWRfcmVhc29uICkge1xuXHRcdFx0XHRcdHRvb2x0aXBfd3JhcHBlci5zZXRBdHRyaWJ1dGUoICd0aXRsZScsIGRpc2FibGVkX3JlYXNvbiApO1xuXHRcdFx0XHRcdHRvb2x0aXBfd3JhcHBlci5zZXRBdHRyaWJ1dGUoICd0YWJpbmRleCcsICcwJyApO1xuXHRcdFx0XHRcdHRvb2x0aXBfd3JhcHBlci5zZXRBdHRyaWJ1dGUoICdhcmlhLWRlc2NyaWJlZGJ5JywgZGVzY3JpcHRpb25faWQgKTtcblx0XHRcdFx0XHR0b29sdGlwX3dyYXBwZXIuZGF0YXNldC53cGJjRGF0ZVNlbGVjdGlvbkRpc2FibGVkVG9vbHRpcEFjdGl2ZSA9ICcxJztcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0b29sdGlwX3dyYXBwZXIucmVtb3ZlQXR0cmlidXRlKCAndGl0bGUnICk7XG5cdFx0XHRcdFx0dG9vbHRpcF93cmFwcGVyLnJlbW92ZUF0dHJpYnV0ZSggJ3RhYmluZGV4JyApO1xuXHRcdFx0XHRcdHRvb2x0aXBfd3JhcHBlci5yZW1vdmVBdHRyaWJ1dGUoICdhcmlhLWRlc2NyaWJlZGJ5JyApO1xuXHRcdFx0XHRcdGRlbGV0ZSB0b29sdGlwX3dyYXBwZXIuZGF0YXNldC53cGJjRGF0ZVNlbGVjdGlvbkRpc2FibGVkVG9vbHRpcEFjdGl2ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICggZGVzY3JpcHRpb24gKSB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb24udGV4dENvbnRlbnQgPSBkaXNhYmxlZF9yZWFzb247XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBFbmZvcmNlIGNhbm9uaWNhbCBjaGFuZ2VvdmVyLCByZWN1cnJlbnQtdGltZSwgYW5kIGNoZWNrLW91dCBkZXBlbmRlbmNpZXMuXG5cdFx0ICpcblx0XHQgKiBCb29raW5nIENhbGVuZGFyIHRyZWF0cyBjaGFuZ2VvdmVyIHByb2Nlc3NpbmcgYXMgbXV0dWFsbHkgZXhjbHVzaXZlIHdpdGhcblx0XHQgKiByZWN1cnJlbnQgdGltZSBhbmQgYW4gaW5kZXBlbmRlbnRseSBhdmFpbGFibGUgY2hlY2stb3V0IGRhdGUuIEEgY2hlY2stb3V0XG5cdFx0ICogZGF0ZSBhbHNvIGhhcyBubyBtZWFuaW5nIGZvciBzaW5nbGUgb3IgaW5kZXBlbmRlbnQtZGF0ZSBzZWxlY3Rpb25zLiBIaWRlXG5cdFx0ICogaW5jb21wYXRpYmxlIGNvbnRyb2xzIGFuZCBub3JtYWxpemUgdGhlaXIgcmVxdWVzdC1sb2NhbCBkcmFmdCBzdGF0ZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3luY19jaGFuZ2VvdmVyX2RlcGVuZGVuY2llcygpIHtcblx0XHRcdHZhciBjaGFuZ2VvdmVyX3RvZ2dsZTtcblx0XHRcdHZhciBjaGFuZ2VvdmVyX2NvbnRyb2xzO1xuXHRcdFx0dmFyIGNoYW5nZW92ZXJfZmllbGRzO1xuXHRcdFx0dmFyIGNoZWNrb3V0X29wdGlvbjtcblx0XHRcdHZhciBjaGVja291dF90b2dnbGU7XG5cdFx0XHR2YXIgY2hlY2tvdXRfdG9vbHRpcF93cmFwcGVyO1xuXHRcdFx0dmFyIGNoZWNrb3V0X2Rpc2FibGVkX3JlYXNvbjtcblx0XHRcdHZhciByZWN1cnJlbnRfdG9nZ2xlO1xuXHRcdFx0dmFyIHJlY3VycmVudF9vcHRpb247XG5cdFx0XHR2YXIgYmVoYXZpb3Jfc2VjdGlvbjtcblx0XHRcdHZhciBjaGFuZ2VvdmVyX2lzX2FjdGl2ZTtcblx0XHRcdHZhciBjaGVja291dF9pc19zdXBwb3J0ZWQ7XG5cdFx0XHR2YXIgY2hhbmdlb3Zlcl9wb2xpY3k7XG5cdFx0XHR2YXIgcmVjdXJyZW50X3BvbGljeTtcblx0XHRcdHZhciBjaGVja291dF9wb2xpY3k7XG5cblx0XHRcdGlmICggISBlZGl0b3IgfHwgISBlZGl0b3IuY2hhbmdlb3ZlciApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjaGFuZ2VvdmVyX3RvZ2dsZSA9IGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWRhdGUtc2VsZWN0aW9uLXRvZ2dsZT1cImRhdGVfc2VsZWN0aW9uX2NoYW5nZW92ZXJfZW5hYmxlZFwiXScgKTtcblx0XHRcdGNoYW5nZW92ZXJfY29udHJvbHMgPSBlZGl0b3IuY2hhbmdlb3Zlci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1kYXRlLXNlbGVjdGlvbi1jaGFuZ2VvdmVyLWNvbnRyb2xzXScgKTtcblx0XHRcdGNoYW5nZW92ZXJfZmllbGRzID0gZWRpdG9yLmNoYW5nZW92ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tY2hhbmdlb3Zlci1maWVsZHNdJyApO1xuXHRcdFx0Y2hlY2tvdXRfb3B0aW9uID0gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tY2hlY2tvdXQtb3B0aW9uXScgKTtcblx0XHRcdGNoZWNrb3V0X3RvZ2dsZSA9IGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWRhdGUtc2VsZWN0aW9uLXRvZ2dsZT1cImRhdGVfc2VsZWN0aW9uX2NoZWNrb3V0X2F2YWlsYWJsZVwiXScgKTtcblx0XHRcdGNoZWNrb3V0X3Rvb2x0aXBfd3JhcHBlciA9IGNoZWNrb3V0X3RvZ2dsZSA/IGNoZWNrb3V0X3RvZ2dsZS5jbG9zZXN0KCAnW2RhdGEtd3BiYy1kYXRlLXNlbGVjdGlvbi1kaXNhYmxlZC10b29sdGlwXScgKSA6IG51bGw7XG5cdFx0XHRyZWN1cnJlbnRfdG9nZ2xlID0gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tdG9nZ2xlPVwiZGF0ZV9zZWxlY3Rpb25fcmVjdXJyZW50X3RpbWVcIl0nICk7XG5cdFx0XHRyZWN1cnJlbnRfb3B0aW9uID0gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tcmVjdXJyZW50LW9wdGlvbl0nICk7XG5cdFx0XHRiZWhhdmlvcl9zZWN0aW9uID0gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tYmVoYXZpb3JdJyApO1xuXHRcdFx0Y2hhbmdlb3Zlcl9wb2xpY3kgPSBnZXRfbW9kZV9wb2xpY3lfc3RhdGUoICd3cGJjRGF0ZVNlbGVjdGlvblBvbGljeUNoYW5nZW92ZXInICk7XG5cdFx0XHRyZWN1cnJlbnRfcG9saWN5ID0gZ2V0X21vZGVfcG9saWN5X3N0YXRlKCAnd3BiY0RhdGVTZWxlY3Rpb25Qb2xpY3lSZWN1cnJlbnRUaW1lJyApO1xuXHRcdFx0Y2hlY2tvdXRfcG9saWN5ID0gZ2V0X21vZGVfcG9saWN5X3N0YXRlKCAnd3BiY0RhdGVTZWxlY3Rpb25Qb2xpY3lDaGVja291dEF2YWlsYWJsZScgKTtcblx0XHRcdGNoZWNrb3V0X2lzX3N1cHBvcnRlZCA9ICdvcHRpb25hbCcgPT09IGNoZWNrb3V0X3BvbGljeTtcblxuXHRcdFx0aWYgKCBjaGFuZ2VvdmVyX3RvZ2dsZSApIHtcblx0XHRcdFx0Y2hhbmdlb3Zlcl90b2dnbGUuZGF0YXNldC53cGJjRGF0ZVNlbGVjdGlvblBvbGljeVN0YXRlID0gY2hhbmdlb3Zlcl9wb2xpY3k7XG5cdFx0XHRcdGlmICggJ3JlcXVpcmVkX29uJyA9PT0gY2hhbmdlb3Zlcl9wb2xpY3kgKSB7XG5cdFx0XHRcdFx0Y2hhbmdlb3Zlcl90b2dnbGUuY2hlY2tlZCA9IHRydWU7XG5cdFx0XHRcdFx0Y2hhbmdlb3Zlcl90b2dnbGUuZGlzYWJsZWQgPSB0cnVlO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCAnaGlkZGVuX29mZicgPT09IGNoYW5nZW92ZXJfcG9saWN5ICkge1xuXHRcdFx0XHRcdGNoYW5nZW92ZXJfdG9nZ2xlLmNoZWNrZWQgPSBmYWxzZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjaGFuZ2VvdmVyX3RvZ2dsZS5kaXNhYmxlZCA9ICcxJyA9PT0gY2hhbmdlb3Zlcl90b2dnbGUuZGF0YXNldC53cGJjRGF0ZVNlbGVjdGlvbkVkaXRpb25Mb2NrZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGNoYW5nZW92ZXJfaXNfYWN0aXZlID0gQm9vbGVhbiggY2hhbmdlb3Zlcl90b2dnbGUgJiYgY2hhbmdlb3Zlcl90b2dnbGUuY2hlY2tlZCAmJiAnaGlkZGVuX29mZicgIT09IGNoYW5nZW92ZXJfcG9saWN5ICk7XG5cblx0XHRcdGVkaXRvci5jaGFuZ2VvdmVyLmhpZGRlbiA9IC0xID09PSBbICdvcHRpb25hbCcsICdyZXF1aXJlZF9vbicgXS5pbmRleE9mKCBjaGFuZ2VvdmVyX3BvbGljeSApO1xuXG5cdFx0XHRpZiAoIGNoYW5nZW92ZXJfY29udHJvbHMgKSB7XG5cdFx0XHRcdGNoYW5nZW92ZXJfY29udHJvbHMuaGlkZGVuID0gISBjaGFuZ2VvdmVyX2lzX2FjdGl2ZTtcblx0XHRcdH1cblx0XHRcdGlmICggY2hhbmdlb3Zlcl9maWVsZHMgKSB7XG5cdFx0XHRcdGNoYW5nZW92ZXJfZmllbGRzLmhpZGRlbiA9ICEgY2hhbmdlb3Zlcl9pc19hY3RpdmU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHJlY3VycmVudF9vcHRpb24gKSB7XG5cdFx0XHRcdHJlY3VycmVudF9vcHRpb24uaGlkZGVuID0gLTEgPT09IFsgJ29wdGlvbmFsJywgJ29wdGlvbmFsX2RlZmF1bHRfb24nLCAncmVxdWlyZWRfb24nIF0uaW5kZXhPZiggcmVjdXJyZW50X3BvbGljeSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCByZWN1cnJlbnRfdG9nZ2xlICkge1xuXHRcdFx0XHRyZWN1cnJlbnRfdG9nZ2xlLmRhdGFzZXQud3BiY0RhdGVTZWxlY3Rpb25Qb2xpY3lTdGF0ZSA9IHJlY3VycmVudF9wb2xpY3k7XG5cdFx0XHRcdHJlY3VycmVudF90b2dnbGUuZGlzYWJsZWQgPSAncmVxdWlyZWRfb24nID09PSByZWN1cnJlbnRfcG9saWN5O1xuXHRcdFx0XHRpZiAoICdoaWRkZW5fb24nID09PSByZWN1cnJlbnRfcG9saWN5IHx8ICdyZXF1aXJlZF9vbicgPT09IHJlY3VycmVudF9wb2xpY3kgKSB7XG5cdFx0XHRcdFx0cmVjdXJyZW50X3RvZ2dsZS5jaGVja2VkID0gdHJ1ZTtcblx0XHRcdFx0fSBlbHNlIGlmICggLTEgPT09IFsgJ29wdGlvbmFsJywgJ29wdGlvbmFsX2RlZmF1bHRfb24nIF0uaW5kZXhPZiggcmVjdXJyZW50X3BvbGljeSApIHx8IGNoYW5nZW92ZXJfaXNfYWN0aXZlICkge1xuXHRcdFx0XHRcdHJlY3VycmVudF90b2dnbGUuY2hlY2tlZCA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNoZWNrb3V0X29wdGlvbiApIHtcblx0XHRcdFx0Y2hlY2tvdXRfb3B0aW9uLmhpZGRlbiA9ICEgY2hlY2tvdXRfaXNfc3VwcG9ydGVkO1xuXHRcdFx0XHRjaGVja291dF9vcHRpb24uZGF0YXNldC53cGJjRGF0ZVNlbGVjdGlvblBvbGljeVN0YXRlID0gY2hlY2tvdXRfcG9saWN5O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjaGVja291dF90b2dnbGUgKSB7XG5cdFx0XHRcdGNoZWNrb3V0X3RvZ2dsZS5kYXRhc2V0LndwYmNEYXRlU2VsZWN0aW9uUG9saWN5U3RhdGUgPSBjaGVja291dF9wb2xpY3k7XG5cdFx0XHRcdGNoZWNrb3V0X3RvZ2dsZS5kaXNhYmxlZCA9ICcxJyA9PT0gY2hlY2tvdXRfdG9nZ2xlLmRhdGFzZXQud3BiY0RhdGVTZWxlY3Rpb25FZGl0aW9uTG9ja2VkIHx8IGNoYW5nZW92ZXJfaXNfYWN0aXZlIHx8ICEgY2hlY2tvdXRfaXNfc3VwcG9ydGVkO1xuXHRcdFx0XHRjaGVja291dF9kaXNhYmxlZF9yZWFzb24gPSAnJztcblx0XHRcdFx0aWYgKCBjaGVja291dF90b29sdGlwX3dyYXBwZXIgJiYgJzEnID09PSBjaGVja291dF90b2dnbGUuZGF0YXNldC53cGJjRGF0ZVNlbGVjdGlvbkVkaXRpb25Mb2NrZWQgKSB7XG5cdFx0XHRcdFx0Y2hlY2tvdXRfZGlzYWJsZWRfcmVhc29uID0gY2hlY2tvdXRfdG9vbHRpcF93cmFwcGVyLmRhdGFzZXQud3BiY0RhdGVTZWxlY3Rpb25DaGVja291dFJlYXNvbkVkaXRpb24gfHwgJyc7XG5cdFx0XHRcdH0gZWxzZSBpZiAoIGNoZWNrb3V0X3Rvb2x0aXBfd3JhcHBlciAmJiBjaGFuZ2VvdmVyX2lzX2FjdGl2ZSApIHtcblx0XHRcdFx0XHRjaGVja291dF9kaXNhYmxlZF9yZWFzb24gPSBjaGVja291dF90b29sdGlwX3dyYXBwZXIuZGF0YXNldC53cGJjRGF0ZVNlbGVjdGlvbkNoZWNrb3V0UmVhc29uQ2hhbmdlb3ZlciB8fCAnJztcblx0XHRcdFx0fSBlbHNlIGlmICggY2hlY2tvdXRfdG9vbHRpcF93cmFwcGVyICYmICEgY2hlY2tvdXRfaXNfc3VwcG9ydGVkICkge1xuXHRcdFx0XHRcdGNoZWNrb3V0X2Rpc2FibGVkX3JlYXNvbiA9IGNoZWNrb3V0X3Rvb2x0aXBfd3JhcHBlci5kYXRhc2V0LndwYmNEYXRlU2VsZWN0aW9uQ2hlY2tvdXRSZWFzb25Nb2RlIHx8ICcnO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNoZWNrb3V0X3RvZ2dsZS5kYXRhc2V0LndwYmNEYXRlU2VsZWN0aW9uRGlzYWJsZWRSZWFzb24gPSBjaGVja291dF9kaXNhYmxlZF9yZWFzb247XG5cdFx0XHRcdGlmICggY2hhbmdlb3Zlcl9pc19hY3RpdmUgfHwgISBjaGVja291dF9pc19zdXBwb3J0ZWQgKSB7XG5cdFx0XHRcdFx0Y2hlY2tvdXRfdG9nZ2xlLmNoZWNrZWQgPSBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCBiZWhhdmlvcl9zZWN0aW9uICkge1xuXHRcdFx0XHRiZWhhdmlvcl9zZWN0aW9uLmhpZGRlbiA9IC0xID09PSBbICdvcHRpb25hbCcsICdvcHRpb25hbF9kZWZhdWx0X29uJywgJ3JlcXVpcmVkX29uJyBdLmluZGV4T2YoIHJlY3VycmVudF9wb2xpY3kgKSAmJiAhIGNoZWNrb3V0X2lzX3N1cHBvcnRlZDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBMZXQgdGhlIG1vc3QgcmVjZW50bHkgYWN0aXZhdGVkIG11dHVhbGx5IGV4Y2x1c2l2ZSBvcHRpb24gd2luLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSB0b2dnbGUgQ2hhbmdlZCBEYXRlIFNlbGVjdGlvbiB0b2dnbGUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBhcHBseV9leGNsdXNpdmVfdG9nZ2xlX2FjdGlvbiggdG9nZ2xlICkge1xuXHRcdFx0dmFyIGZpZWxkX25hbWU7XG5cdFx0XHR2YXIgY29uZmxpY3RpbmdfdG9nZ2xlO1xuXG5cdFx0XHRpZiAoICEgZWRpdG9yIHx8ICEgdG9nZ2xlIHx8ICEgdG9nZ2xlLmNoZWNrZWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0ZmllbGRfbmFtZSA9IHRvZ2dsZS5kYXRhc2V0LndwYmNEYXRlU2VsZWN0aW9uVG9nZ2xlIHx8ICcnO1xuXHRcdFx0aWYgKCAnZGF0ZV9zZWxlY3Rpb25fY2hhbmdlb3Zlcl9lbmFibGVkJyA9PT0gZmllbGRfbmFtZSApIHtcblx0XHRcdFx0Y29uZmxpY3RpbmdfdG9nZ2xlID0gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tdG9nZ2xlPVwiZGF0ZV9zZWxlY3Rpb25fcmVjdXJyZW50X3RpbWVcIl0nICk7XG5cdFx0XHR9IGVsc2UgaWYgKCAnZGF0ZV9zZWxlY3Rpb25fcmVjdXJyZW50X3RpbWUnID09PSBmaWVsZF9uYW1lICkge1xuXHRcdFx0XHRjb25mbGljdGluZ190b2dnbGUgPSBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1kYXRlLXNlbGVjdGlvbi10b2dnbGU9XCJkYXRlX3NlbGVjdGlvbl9jaGFuZ2VvdmVyX2VuYWJsZWRcIl0nICk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICggY29uZmxpY3RpbmdfdG9nZ2xlICkge1xuXHRcdFx0XHRjb25mbGljdGluZ190b2dnbGUuY2hlY2tlZCA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN5bmNocm9uaXplIHRoZSBub24tbXV0YXRpbmcgY2FsZW5kYXItbGVnZW5kIGNvbmZpZ3VyYXRpb24gcHJldmlldy5cblx0XHQgKlxuXHRcdCAqIEFsbCBwcmV2aWV3IG5vZGVzIGFyZSByZW5kZXJlZCBieSBQSFAuIFRoaXMgbWV0aG9kIGNoYW5nZXMgb25seSB0ZXh0LFxuXHRcdCAqIHZpc2liaWxpdHksIGFuZCBsYXlvdXQgY2xhc3NlczsgaXQgbmV2ZXIgY29uc3RydWN0cyBvciBldmFsdWF0ZXMgbWFya3VwLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzeW5jX2xlZ2VuZF9wcmV2aWV3KCkge1xuXHRcdFx0dmFyIGxlZ2VuZF90b2dnbGU7XG5cdFx0XHR2YXIgbGVnZW5kX3NldHRpbmdzO1xuXHRcdFx0dmFyIGxlZ2VuZF9wcmV2aWV3O1xuXHRcdFx0dmFyIHNob3dfbnVtYmVyc190b2dnbGU7XG5cdFx0XHR2YXIgdmVydGljYWxfdG9nZ2xlO1xuXHRcdFx0dmFyIGRheV9udW1iZXI7XG5cblx0XHRcdGlmICggISBlZGl0b3IgfHwgISBlZGl0b3IubGVnZW5kICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGxlZ2VuZF90b2dnbGUgPSBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1kYXRlLXNlbGVjdGlvbi10b2dnbGU9XCJkYXRlX3NlbGVjdGlvbl9sZWdlbmRfZW5hYmxlZFwiXScgKTtcblx0XHRcdGxlZ2VuZF9zZXR0aW5ncyA9IGVkaXRvci5sZWdlbmQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tbGVnZW5kLXNldHRpbmdzXScgKTtcblx0XHRcdGxlZ2VuZF9wcmV2aWV3ID0gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tbGVnZW5kLXByZXZpZXddJyApO1xuXHRcdFx0c2hvd19udW1iZXJzX3RvZ2dsZSA9IGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWRhdGUtc2VsZWN0aW9uLXRvZ2dsZT1cImRhdGVfc2VsZWN0aW9uX2xlZ2VuZF9zaG93X251bWJlcnNcIl0nICk7XG5cdFx0XHR2ZXJ0aWNhbF90b2dnbGUgPSBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1kYXRlLXNlbGVjdGlvbi10b2dnbGU9XCJkYXRlX3NlbGVjdGlvbl9sZWdlbmRfdmVydGljYWxcIl0nICk7XG5cdFx0XHRkYXlfbnVtYmVyID0gbGVnZW5kX3ByZXZpZXcgPyBTdHJpbmcoIGxlZ2VuZF9wcmV2aWV3LmRhdGFzZXQud3BiY0RhdGVTZWxlY3Rpb25MZWdlbmREYXlOdW1iZXIgfHwgJycgKSA6ICcnO1xuXG5cdFx0XHRpZiAoIGxlZ2VuZF9zZXR0aW5ncyApIHtcblx0XHRcdFx0bGVnZW5kX3NldHRpbmdzLmhpZGRlbiA9ICEgbGVnZW5kX3RvZ2dsZSB8fCAhIGxlZ2VuZF90b2dnbGUuY2hlY2tlZDtcblx0XHRcdH1cblx0XHRcdGlmICggISBsZWdlbmRfcHJldmlldyApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRsZWdlbmRfcHJldmlldy5oaWRkZW4gPSAhIGxlZ2VuZF90b2dnbGUgfHwgISBsZWdlbmRfdG9nZ2xlLmNoZWNrZWQ7XG5cdFx0XHRsZWdlbmRfcHJldmlldy5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtdmVydGljYWwnLCBCb29sZWFuKCB2ZXJ0aWNhbF90b2dnbGUgJiYgdmVydGljYWxfdG9nZ2xlLmNoZWNrZWQgKSApO1xuXHRcdFx0bGVnZW5kX3ByZXZpZXcucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tbGVnZW5kLXByZXZpZXctaXRlbV0nICkuZm9yRWFjaCggZnVuY3Rpb24gKCBwcmV2aWV3X2l0ZW0gKSB7XG5cdFx0XHRcdHZhciBsZWdlbmRfaWQgPSBwcmV2aWV3X2l0ZW0uZGF0YXNldC53cGJjRGF0ZVNlbGVjdGlvbkxlZ2VuZFByZXZpZXdJdGVtO1xuXHRcdFx0XHR2YXIgaXRlbV90b2dnbGUgPSBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1kYXRlLXNlbGVjdGlvbi10b2dnbGU9XCJkYXRlX3NlbGVjdGlvbl9sZWdlbmRfaXRlbV8nICsgbGVnZW5kX2lkICsgJ1wiXScgKTtcblx0XHRcdFx0dmFyIHRpdGxlX2NvbnRyb2wgPSBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1kYXRlLXNlbGVjdGlvbi1sZWdlbmQtdGl0bGU9XCInICsgbGVnZW5kX2lkICsgJ1wiXScgKTtcblx0XHRcdFx0dmFyIHRpdGxlX25vZGUgPSBwcmV2aWV3X2l0ZW0ucXVlcnlTZWxlY3RvciggJy53cGRldl9oaW50X3dpdGhfdGV4dCAuYmxvY2tfdGV4dDpsYXN0LWNoaWxkJyApO1xuXHRcdFx0XHR2YXIgdGl0bGUgPSB0aXRsZV9jb250cm9sID8gU3RyaW5nKCB0aXRsZV9jb250cm9sLnZhbHVlIHx8ICcnICkudHJpbSgpIDogJyc7XG5cblx0XHRcdFx0cHJldmlld19pdGVtLmhpZGRlbiA9ICEgaXRlbV90b2dnbGUgfHwgISBpdGVtX3RvZ2dsZS5jaGVja2VkO1xuXHRcdFx0XHRpZiAoIHRpdGxlX25vZGUgJiYgdGl0bGVfY29udHJvbCApIHtcblx0XHRcdFx0XHR0aXRsZV9ub2RlLnRleHRDb250ZW50ID0gdGl0bGUgfHwgdGl0bGVfY29udHJvbC5wbGFjZWhvbGRlciB8fCAnJztcblx0XHRcdFx0fVxuXHRcdFx0XHRwcmV2aWV3X2l0ZW0ucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2NhbGVuZGFyX2xlZ2VuZF9kYXlfY2VsbF9oZWlnaHQgLmRhdGUtY2VsbC1jb250ZW50ID4gYSwgLndwYmNfY2FsZW5kYXJfbGVnZW5kX2RheV9jZWxsX2hlaWdodCAuZGF0ZS1jZWxsLWNvbnRlbnQgPiBzcGFuJyApLmZvckVhY2goIGZ1bmN0aW9uICggZGF0ZV9ub2RlICkge1xuXHRcdFx0XHRcdGRhdGVfbm9kZS50ZXh0Q29udGVudCA9IHNob3dfbnVtYmVyc190b2dnbGUgJiYgc2hvd19udW1iZXJzX3RvZ2dsZS5jaGVja2VkID8gZGF5X251bWJlciA6ICcnO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3luY2hyb25pemUgY2Fub25pY2FsIGNoYW5nZW92ZXIgY2xhc3NlcyBpbiB0aGUgY2FsZW5kYXIgYW5kIGxlZ2VuZC5cblx0XHQgKlxuXHRcdCAqIEJvb2tpbmcgQ2FsZW5kYXIgb3ducyB0aGUgdW5kZXJseWluZyBkYXkgc3RhdHVzIGFuZCBTVkcgbWFya3VwLiBUaGlzXG5cdFx0ICogYWRhcHRlciBjaGFuZ2VzIG9ubHkgdGhlIHNhbWUgYW5jZXN0b3IgYW5kIGRheS1zdGF0ZSBjbGFzc2VzIHVzZWQgYnkgdGhlXG5cdFx0ICogcmVsZWFzZWQgY2FsZW5kYXIgcmVuZGVyZXIsIHNvIHRyaWFuZ2xlIGFuZCBzcGxpdC1kYXkgcHJlc2VudGF0aW9uIHN0YXlcblx0XHQgKiBjb25zaXN0ZW50IHdpdGhvdXQgY29uc3RydWN0aW5nIG9yIGV2YWx1YXRpbmcgSFRNTC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3luY19jaGFuZ2VvdmVyX3ByZXZpZXdfY2xhc3NlcygpIHtcblx0XHRcdHZhciBjaGFuZ2VvdmVyX3RyYW5zcG9ydDtcblx0XHRcdHZhciB0cmlhbmdsZXNfdHJhbnNwb3J0O1xuXHRcdFx0dmFyIGNoYW5nZW92ZXJfaXNfYWN0aXZlO1xuXHRcdFx0dmFyIHRyaWFuZ2xlc19hcmVfYWN0aXZlO1xuXHRcdFx0dmFyIHBhcnRpYWxseV9pdGVtO1xuXHRcdFx0dmFyIHBhcnRpYWxseV9kYXk7XG5cdFx0XHR2YXIgbGVnZW5kX3RhYmxlO1xuXHRcdFx0dmFyIGxlZ2VuZF93cmFwcGVyO1xuXHRcdFx0dmFyIGNoYW5nZW92ZXJfY2xhc3NlcztcblxuXHRcdFx0aWYgKCAhIGVkaXRvciApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjaGFuZ2VvdmVyX3RyYW5zcG9ydCA9IGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbbmFtZT1cImRhdGVfc2VsZWN0aW9uX2NoYW5nZW92ZXJfZW5hYmxlZFwiXScgKTtcblx0XHRcdHRyaWFuZ2xlc190cmFuc3BvcnQgPSBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW25hbWU9XCJkYXRlX3NlbGVjdGlvbl90cmlhbmdsZXNcIl0nICk7XG5cdFx0XHRjaGFuZ2VvdmVyX2lzX2FjdGl2ZSA9IEJvb2xlYW4oIGNoYW5nZW92ZXJfdHJhbnNwb3J0ICYmICdPbicgPT09IGNoYW5nZW92ZXJfdHJhbnNwb3J0LnZhbHVlICk7XG5cdFx0XHR0cmlhbmdsZXNfYXJlX2FjdGl2ZSA9IEJvb2xlYW4oIGNoYW5nZW92ZXJfaXNfYWN0aXZlICYmIHRyaWFuZ2xlc190cmFuc3BvcnQgJiYgJ09uJyA9PT0gdHJpYW5nbGVzX3RyYW5zcG9ydC52YWx1ZSApO1xuXG5cdFx0XHRpZiAoIGVkaXRvci5jYWxlbmRhciApIHtcblx0XHRcdFx0ZWRpdG9yLmNhbGVuZGFyLmNsYXNzTGlzdC50b2dnbGUoICd3cGJjX2NoYW5nZV9vdmVyX3RyaWFuZ2xlJywgdHJpYW5nbGVzX2FyZV9hY3RpdmUgKTtcblx0XHRcdFx0ZWRpdG9yLmNhbGVuZGFyLnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19jYWxlbmRhcl93cmFwZXInICkuZm9yRWFjaCggZnVuY3Rpb24gKCBjYWxlbmRhcl93cmFwcGVyICkge1xuXHRcdFx0XHRcdGNhbGVuZGFyX3dyYXBwZXIuY2xhc3NMaXN0LnRvZ2dsZSggJ3dwYmNfY2hhbmdlX292ZXJfdHJpYW5nbGUnLCB0cmlhbmdsZXNfYXJlX2FjdGl2ZSApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cblx0XHRcdHBhcnRpYWxseV9pdGVtID0gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tbGVnZW5kLXByZXZpZXctaXRlbT1cInBhcnRpYWxseVwiXScgKTtcblx0XHRcdGlmICggISBwYXJ0aWFsbHlfaXRlbSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRwYXJ0aWFsbHlfZGF5ID0gcGFydGlhbGx5X2l0ZW0ucXVlcnlTZWxlY3RvciggJy53cGJjX2NhbGVuZGFyX2xlZ2VuZF9kYXlfY2VsbF9oZWlnaHQnICk7XG5cdFx0XHRpZiAoIHBhcnRpYWxseV9kYXkgKSB7XG5cdFx0XHRcdGNoYW5nZW92ZXJfY2xhc3NlcyA9IFtcblx0XHRcdFx0XHQnZGF0ZV9hcHByb3ZlZCcsXG5cdFx0XHRcdFx0J2NoZWNrX2luX3RpbWUnLFxuXHRcdFx0XHRcdCdjaGVja19vdXRfdGltZScsXG5cdFx0XHRcdFx0J2NoZWNrX2luX3RpbWVfZGF0ZV9hcHByb3ZlZCcsXG5cdFx0XHRcdFx0J2NoZWNrX291dF90aW1lX2RhdGUyYXBwcm92ZSdcblx0XHRcdFx0XTtcblx0XHRcdFx0Y2hhbmdlb3Zlcl9jbGFzc2VzLmZvckVhY2goIGZ1bmN0aW9uICggY2xhc3NfbmFtZSApIHtcblx0XHRcdFx0XHRwYXJ0aWFsbHlfZGF5LmNsYXNzTGlzdC50b2dnbGUoIGNsYXNzX25hbWUsIGNoYW5nZW92ZXJfaXNfYWN0aXZlICk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0cGFydGlhbGx5X2RheS5jbGFzc0xpc3QudG9nZ2xlKCAnZGF0ZTJhcHByb3ZlJywgISBjaGFuZ2VvdmVyX2lzX2FjdGl2ZSApO1xuXHRcdFx0XHRwYXJ0aWFsbHlfZGF5LmNsYXNzTGlzdC50b2dnbGUoICd0aW1lc19jbG9jaycsICEgY2hhbmdlb3Zlcl9pc19hY3RpdmUgKTtcblx0XHRcdH1cblxuXHRcdFx0bGVnZW5kX3RhYmxlID0gcGFydGlhbGx5X2l0ZW0ucXVlcnlTZWxlY3RvciggJy53cGJjX2NhbGVuZGFyX2xlZ2VuZF90YWJsZV93aWR0aF9oZWlnaHQnICk7XG5cdFx0XHRsZWdlbmRfd3JhcHBlciA9IGxlZ2VuZF90YWJsZSA/IGxlZ2VuZF90YWJsZS5wYXJlbnRFbGVtZW50IDogbnVsbDtcblx0XHRcdGlmICggbGVnZW5kX3dyYXBwZXIgKSB7XG5cdFx0XHRcdGxlZ2VuZF93cmFwcGVyLmNsYXNzTGlzdC50b2dnbGUoICd3cGJjX2NoYW5nZV9vdmVyX3RyaWFuZ2xlJywgdHJpYW5nbGVzX2FyZV9hY3RpdmUgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWxvYWQgY2Fub25pY2FsIGRheS1zdGF0dXMgZGF0YSB3aXRoIGF1dGhvcml6ZWQgZHJhZnQgb3ZlcnJpZGVzLlxuXHRcdCAqXG5cdFx0ICogVGhlIHNoYXJlZCBjYWxlbmRhciBlbmRwb2ludCBjYWxjdWxhdGVzIGJvb2tpbmcgYm91bmRhcmllcy4gQSBkZWRpY2F0ZWRcblx0XHQgKiBTZXR1cCBXaXphcmQgbm9uY2UgYW5kIGNhcGFiaWxpdHkgY2hlY2sgYXV0aG9yaXplIHRoZXNlIHJlcXVlc3QtbG9jYWxcblx0XHQgKiB2YWx1ZXM7IG5vIHNldHRpbmcgb3IgYm9va2luZyBpcyB3cml0dGVuIGJ5IHRoaXMgcmVxdWVzdC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVmcmVzaF9jaGFuZ2VvdmVyX3ByZXZpZXdfZGF0YSgpIHtcblx0XHRcdHZhciBjaGFuZ2VvdmVyX3RyYW5zcG9ydDtcblx0XHRcdHZhciB0cmlhbmdsZXNfdHJhbnNwb3J0O1xuXHRcdFx0dmFyIHJlY3VycmVudF90cmFuc3BvcnQ7XG5cdFx0XHR2YXIgY2hlY2tvdXRfdHJhbnNwb3J0O1xuXG5cdFx0XHRpZiAoXG5cdFx0XHRcdCEgZWRpdG9yXG5cdFx0XHRcdHx8ICEgZWRpdG9yLmNhbGVuZGFyXG5cdFx0XHRcdHx8ICEgY29uZmlnLnByZXZpZXdfbm9uY2Vcblx0XHRcdFx0fHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy53cGJjX2NhbGVuZGFyX19sb2FkX2RhdGFfX2FqeFxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y2hhbmdlb3Zlcl90cmFuc3BvcnQgPSBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW25hbWU9XCJkYXRlX3NlbGVjdGlvbl9jaGFuZ2VvdmVyX2VuYWJsZWRcIl0nICk7XG5cdFx0XHR0cmlhbmdsZXNfdHJhbnNwb3J0ID0gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tuYW1lPVwiZGF0ZV9zZWxlY3Rpb25fdHJpYW5nbGVzXCJdJyApO1xuXHRcdFx0cmVjdXJyZW50X3RyYW5zcG9ydCA9IGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbbmFtZT1cImRhdGVfc2VsZWN0aW9uX3JlY3VycmVudF90aW1lXCJdJyApO1xuXHRcdFx0Y2hlY2tvdXRfdHJhbnNwb3J0ID0gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tuYW1lPVwiZGF0ZV9zZWxlY3Rpb25fY2hlY2tvdXRfYXZhaWxhYmxlXCJdJyApO1xuXG5cdFx0XHR3aW5kb3cud3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hangoIHtcblx0XHRcdFx0cmVzb3VyY2VfaWQ6IGVkaXRvci5yZXNvdXJjZV9pZCxcblx0XHRcdFx0Ym9va2luZ19oYXNoOiAnJyxcblx0XHRcdFx0cmVxdWVzdF91cmk6ICcnLFxuXHRcdFx0XHRjdXN0b21fZm9ybTogJ3N0YW5kYXJkJyxcblx0XHRcdFx0YWdncmVnYXRlX3Jlc291cmNlX2lkX3N0cjogJycsXG5cdFx0XHRcdGFnZ3JlZ2F0ZV90eXBlOiAnYWxsJyxcblx0XHRcdFx0c2tpcF9nZW5lcmFsX2F2YWlsYWJpbGl0eTogMCxcblx0XHRcdFx0Y2xhc3NpY19ib29raW5nX2NvbnRleHRfdG9rZW46ICcnLFxuXHRcdFx0XHR3cGJjX3NldHRpbmdzX2NhbGVuZGFyX3ByZXZpZXc6IDEsXG5cdFx0XHRcdHdwYmNfc2V0dXBfd2l6YXJkX2RhdGVfc2VsZWN0aW9uX3ByZXZpZXc6IDEsXG5cdFx0XHRcdHdwYmNfc2V0dXBfd2l6YXJkX2RhdGVfc2VsZWN0aW9uX3ByZXZpZXdfbm9uY2U6IFN0cmluZyggY29uZmlnLnByZXZpZXdfbm9uY2UgKSxcblx0XHRcdFx0d3BiY19zZXR0aW5nc19jYWxlbmRhcl9wcmV2aWV3X2NoYW5nZW92ZXI6IGNoYW5nZW92ZXJfdHJhbnNwb3J0ICYmICdPbicgPT09IGNoYW5nZW92ZXJfdHJhbnNwb3J0LnZhbHVlID8gJ09uJyA6ICdPZmYnLFxuXHRcdFx0XHR3cGJjX3NldHRpbmdzX2NhbGVuZGFyX3ByZXZpZXdfdHJpYW5nbGVzOiB0cmlhbmdsZXNfdHJhbnNwb3J0ICYmICdPbicgPT09IHRyaWFuZ2xlc190cmFuc3BvcnQudmFsdWUgPyAnT24nIDogJ09mZicsXG5cdFx0XHRcdHdwYmNfc2V0dGluZ3NfY2FsZW5kYXJfcHJldmlld19yZWN1cnJlbnRfdGltZTogcmVjdXJyZW50X3RyYW5zcG9ydCAmJiAnT24nID09PSByZWN1cnJlbnRfdHJhbnNwb3J0LnZhbHVlID8gJ09uJyA6ICdPZmYnLFxuXHRcdFx0XHR3cGJjX3NldHRpbmdzX2NhbGVuZGFyX3ByZXZpZXdfbGFzdF9jaGVja291dDogY2hlY2tvdXRfdHJhbnNwb3J0ICYmICdPbicgPT09IGNoZWNrb3V0X3RyYW5zcG9ydC52YWx1ZSA/ICdPbicgOiAnT2ZmJyxcblx0XHRcdFx0d3BiY19zZXR0aW5nc19jYWxlbmRhcl9wcmV2aWV3X3Nob3dfbGVnZW5kOiAnT2ZmJ1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIERlYm91bmNlIHJlcXVlc3QtbG9jYWwgZGF5LXN0YXR1cyByZWZyZXNoZXMgYWZ0ZXIgcmVsYXRlZCB0b2dnbGVzIGNoYW5nZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2NoZWR1bGVfY2hhbmdlb3Zlcl9kYXRhX3JlZnJlc2goKSB7XG5cdFx0XHRpZiAoIHByZXZpZXdfZGF0YV90aW1lciApIHtcblx0XHRcdFx0d2luZG93LmNsZWFyVGltZW91dCggcHJldmlld19kYXRhX3RpbWVyICk7XG5cdFx0XHR9XG5cdFx0XHRwcmV2aWV3X2RhdGFfdGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCggcmVmcmVzaF9jaGFuZ2VvdmVyX3ByZXZpZXdfZGF0YSwgMTgwICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBhdXRob3JpdGF0aXZlIG51bWJlciBmaWVsZCBwYWlyZWQgd2l0aCBvbmUgcHJlc2VudGF0aW9uIHNsaWRlci5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBmaWVsZF9uYW1lIERhdGUgU2VsZWN0aW9uIGRyYWZ0IGZpZWxkIG5hbWUuXG5cdFx0ICogQHJldHVybiB7SFRNTElucHV0RWxlbWVudHxudWxsfSBNYXRjaGluZyBudW1iZXIgZmllbGQsIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X251bWJlcl9jb250cm9sKCBmaWVsZF9uYW1lICkge1xuXHRcdFx0cmV0dXJuIGVkaXRvciA/IGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWRhdGUtc2VsZWN0aW9uLW51bWJlcj1cIicgKyBmaWVsZF9uYW1lICsgJ1wiXScgKSA6IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29weSBvbmUgdmFsaWQgYXV0aG9yaXRhdGl2ZSBudW1iZXIgdmFsdWUgaW50byBpdHMgcHJlc2VudGF0aW9uIHNsaWRlci5cblx0XHQgKlxuXHRcdCAqIEludmFsaWQgZXhhY3QgdmFsdWVzIHJlbWFpbiB2aXNpYmxlIGZvciBuYXRpdmUgYW5kIHdpemFyZCB2YWxpZGF0aW9uOyB0aGVcblx0XHQgKiBzbGlkZXIgbXVzdCBub3Qgc2lsZW50bHkgY29lcmNlIHRoZW0gaW50byBhbiBhcHBhcmVudGx5IHZhbGlkIGRyYWZ0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MSW5wdXRFbGVtZW50fSBudW1iZXJfY29udHJvbCBBdXRob3JpdGF0aXZlIG51bWJlciBmaWVsZC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHN5bmNfcmFuZ2VfZnJvbV9udW1iZXIoIG51bWJlcl9jb250cm9sICkge1xuXHRcdFx0dmFyIGZpZWxkX25hbWUgPSBudW1iZXJfY29udHJvbCA/IG51bWJlcl9jb250cm9sLmRhdGFzZXQud3BiY0RhdGVTZWxlY3Rpb25OdW1iZXIgOiAnJztcblx0XHRcdHZhciByYW5nZV9jb250cm9sID0gZmllbGRfbmFtZSAmJiBlZGl0b3IgPyBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1kYXRlLXNlbGVjdGlvbi1yYW5nZT1cIicgKyBmaWVsZF9uYW1lICsgJ1wiXScgKSA6IG51bGw7XG5cblx0XHRcdGlmICggISByYW5nZV9jb250cm9sIHx8ICcnID09PSBudW1iZXJfY29udHJvbC52YWx1ZSB8fCAhIG51bWJlcl9jb250cm9sLmNoZWNrVmFsaWRpdHkoKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRyYW5nZV9jb250cm9sLnZhbHVlID0gbnVtYmVyX2NvbnRyb2wudmFsdWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29weSBvbmUgcHJlc2VudGF0aW9uIHNsaWRlciB2YWx1ZSBpbnRvIGl0cyBhdXRob3JpdGF0aXZlIG51bWJlciBmaWVsZC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTElucHV0RWxlbWVudH0gcmFuZ2VfY29udHJvbCBQcmVzZW50YXRpb24gcmFuZ2UgY29udHJvbC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHN5bmNfbnVtYmVyX2Zyb21fcmFuZ2UoIHJhbmdlX2NvbnRyb2wgKSB7XG5cdFx0XHR2YXIgZmllbGRfbmFtZSA9IHJhbmdlX2NvbnRyb2wgPyByYW5nZV9jb250cm9sLmRhdGFzZXQud3BiY0RhdGVTZWxlY3Rpb25SYW5nZSA6ICcnO1xuXHRcdFx0dmFyIG51bWJlcl9jb250cm9sID0gZ2V0X251bWJlcl9jb250cm9sKCBmaWVsZF9uYW1lICk7XG5cblx0XHRcdGlmICggISBudW1iZXJfY29udHJvbCB8fCBudW1iZXJfY29udHJvbC5kaXNhYmxlZCB8fCByYW5nZV9jb250cm9sLmRpc2FibGVkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdG51bWJlcl9jb250cm9sLnZhbHVlID0gcmFuZ2VfY29udHJvbC52YWx1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBbGlnbiBldmVyeSBwcmVzZW50YXRpb24gc2xpZGVyIHdpdGggaXRzIGF1dGhvcml0YXRpdmUgbnVtYmVyIGZpZWxkLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzeW5jX251bWJlcl9yYW5nZXMoKSB7XG5cdFx0XHRpZiAoICEgZWRpdG9yICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLWRhdGUtc2VsZWN0aW9uLW51bWJlcl0nICkuZm9yRWFjaCggc3luY19yYW5nZV9mcm9tX251bWJlciApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFwcGx5IG9uZSB0cnVzdGVkIHByZXNldCB2YWx1ZSB0aHJvdWdoIHRoZSBhdXRob3JpdGF0aXZlIG51bWJlciBjb250cm9sLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGZpZWxkX25hbWUgRHJhZnQgZmllbGQgbmFtZS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcmF3X3ZhbHVlICBTZXJ2ZXItZGVmaW5lZCBpbnRlZ2VyIHZhbHVlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYXBwbHlfbnVtYmVyX3ByZXNldCggZmllbGRfbmFtZSwgcmF3X3ZhbHVlICkge1xuXHRcdFx0dmFyIG51bWJlcl9jb250cm9sID0gZ2V0X251bWJlcl9jb250cm9sKCBmaWVsZF9uYW1lICk7XG5cblx0XHRcdGlmICggISBudW1iZXJfY29udHJvbCB8fCBudW1iZXJfY29udHJvbC5kaXNhYmxlZCB8fCAhIC9eXFxkKyQvLnRlc3QoIFN0cmluZyggcmF3X3ZhbHVlICkgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRudW1iZXJfY29udHJvbC52YWx1ZSA9IFN0cmluZyggcmF3X3ZhbHVlICk7XG5cdFx0XHRzeW5jX3JhbmdlX2Zyb21fbnVtYmVyKCBudW1iZXJfY29udHJvbCApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFwcGx5IGEgc2VydmVyLWRlZmluZWQgc3BlY2lmaWMtbGVuZ3RoIHByZXNldCBhcyBvbmUgY29oZXJlbnQgZHJhZnQuXG5cdFx0ICpcblx0XHQgKiBDbGVhciBpbnRlbnRpb25hbGx5IG9taXRzIHRoZSByYW5nZSBhbmQgd2Vla2RheSBkYXRhIGF0dHJpYnV0ZXMsIHNvIGl0XG5cdFx0ICogcmVtb3ZlcyBvbmx5IHRoZSBzcGVjaWZpYy1sZW5ndGggcmVzdHJpY3Rpb24gYW5kIHByZXNlcnZlcyBtYW51YWwgcnVsZXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwcmVzZXRfYnV0dG9uICAgQWN0aXZhdGVkIHByZXNldCBidXR0b24uXG5cdFx0ICogQHBhcmFtIHtIVE1MSW5wdXRFbGVtZW50fSB0ZXh0X2NvbnRyb2wgU3BlY2lmaWMtbGVuZ3RoIHRleHQgZmllbGQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBhcHBseV9zcGVjaWZpY19kYXlfcHJlc2V0KCBwcmVzZXRfYnV0dG9uLCB0ZXh0X2NvbnRyb2wgKSB7XG5cdFx0XHR0ZXh0X2NvbnRyb2wudmFsdWUgPSBwcmVzZXRfYnV0dG9uLmRhdGFzZXQud3BiY0RhdGVTZWxlY3Rpb25TcGVjaWZpY1ByZXNldCB8fCAnJztcblxuXHRcdFx0aWYgKCBwcmVzZXRfYnV0dG9uLmhhc0F0dHJpYnV0ZSggJ2RhdGEtd3BiYy1kYXRlLXNlbGVjdGlvbi1wcmVzZXQtbWluaW11bScgKSApIHtcblx0XHRcdFx0YXBwbHlfbnVtYmVyX3ByZXNldCggJ2RhdGVfc2VsZWN0aW9uX2R5bmFtaWNfbWluJywgcHJlc2V0X2J1dHRvbi5kYXRhc2V0LndwYmNEYXRlU2VsZWN0aW9uUHJlc2V0TWluaW11bSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBwcmVzZXRfYnV0dG9uLmhhc0F0dHJpYnV0ZSggJ2RhdGEtd3BiYy1kYXRlLXNlbGVjdGlvbi1wcmVzZXQtbWF4aW11bScgKSApIHtcblx0XHRcdFx0YXBwbHlfbnVtYmVyX3ByZXNldCggJ2RhdGVfc2VsZWN0aW9uX2R5bmFtaWNfbWF4JywgcHJlc2V0X2J1dHRvbi5kYXRhc2V0LndwYmNEYXRlU2VsZWN0aW9uUHJlc2V0TWF4aW11bSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBwcmVzZXRfYnV0dG9uLmhhc0F0dHJpYnV0ZSggJ2RhdGEtd3BiYy1kYXRlLXNlbGVjdGlvbi1wcmVzZXQtd2Vla2RheXMnICkgKSB7XG5cdFx0XHRcdGFwcGx5X3dlZWtkYXlfcHJlc2V0KCAnZHluYW1pYycsIHByZXNldF9idXR0b24uZGF0YXNldC53cGJjRGF0ZVNlbGVjdGlvblByZXNldFdlZWtkYXlzICk7XG5cdFx0XHR9XG5cblx0XHRcdHNoZWxsX2FwaS5jbGVhcl9maWVsZF9lcnJvciggJ2RhdGVfc2VsZWN0aW9uX2R5bmFtaWNfbWluJyApO1xuXHRcdFx0c2hlbGxfYXBpLmNsZWFyX2ZpZWxkX2Vycm9yKCAnZGF0ZV9zZWxlY3Rpb25fZHluYW1pY19tYXgnICk7XG5cdFx0XHRzaGVsbF9hcGkuY2xlYXJfZmllbGRfZXJyb3IoICdkYXRlX3NlbGVjdGlvbl9keW5hbWljX3NwZWNpZmljJyApO1xuXHRcdFx0c2hlbGxfYXBpLmNsZWFyX2ZpZWxkX2Vycm9yKCAnZGF0ZV9zZWxlY3Rpb25fZHluYW1pY193ZWVrZGF5cycgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBVcGRhdGUgc2VsZWN0ZWQgY2FyZHMsIHNldHRpbmdzIHBhbmVscywgYW5kIGNoYW5nZW92ZXIgdmlzaWJpbGl0eS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX2VkaXRvcl9zdGF0ZSgpIHtcblx0XHRcdHZhciBtb2RlID0gZ2V0X3NlbGVjdGVkX21vZGUoKTtcblxuXHRcdFx0aWYgKCAhIGVkaXRvciApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfc2V0dXBfd2l6YXJkX19kYXRlLXNlbGVjdGlvbi1tb2RlLWNhcmQnICkuZm9yRWFjaCggZnVuY3Rpb24gKCBjYXJkICkge1xuXHRcdFx0XHR2YXIgcmFkaW8gPSBjYXJkLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWRhdGUtc2VsZWN0aW9uLW1vZGVdJyApO1xuXHRcdFx0XHRjYXJkLmNsYXNzTGlzdC50b2dnbGUoICdpcy1zZWxlY3RlZCcsIEJvb2xlYW4oIHJhZGlvICYmIHJhZGlvLmNoZWNrZWQgKSApO1xuXHRcdFx0fSApO1xuXHRcdFx0ZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tcGFuZWxdJyApLmZvckVhY2goIGZ1bmN0aW9uICggcGFuZWwgKSB7XG5cdFx0XHRcdHBhbmVsLmhpZGRlbiA9IHBhbmVsLmRhdGFzZXQud3BiY0RhdGVTZWxlY3Rpb25QYW5lbCAhPT0gbW9kZTtcblx0XHRcdH0gKTtcblxuXHRcdFx0c3luY19jaGFuZ2VvdmVyX2RlcGVuZGVuY2llcygpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNldCBvbmUgY2Fub25pY2FsIHJlcXVlc3QtbG9jYWwgY2FsZW5kYXIgcGFyYW1ldGVyLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGtleSAgIENhbGVuZGFyIHBhcmFtZXRlciBuYW1lLlxuXHRcdCAqIEBwYXJhbSB7Kn0gICAgICB2YWx1ZSBQYXJhbWV0ZXIgdmFsdWUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfY2FsZW5kYXJfcGFyYW1ldGVyKCBrZXksIHZhbHVlICkge1xuXHRcdFx0aWYgKCBlZGl0b3IgJiYgd2luZG93Ll93cGJjICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuX3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSApIHtcblx0XHRcdFx0d2luZG93Ll93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUoIGVkaXRvci5yZXNvdXJjZV9pZCwga2V5LCB2YWx1ZSApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE5vcm1hbGl6ZSB0aGUgbGVnYWN5IGNhbGVuZGFyIHNjcm9sbCB0YXJnZXQgYmVmb3JlIGEgcmVsZWFzZWQgbW9kZSBoZWxwZXIgcnVucy5cblx0XHQgKlxuXHRcdCAqIFRoZSBjb3JlIGNhbGVuZGFyIGFjY2VwdHMgZWl0aGVyIGZhbHNlIG9yIGEgdHdvLXZhbHVlIG1vbnRoL3llYXIgYXJyYXkuIFRoZVxuXHRcdCAqIHJlcXVlc3QtbG9jYWwgcHJldmlldyBjYW4gaW5pdGlhbGx5IGV4cG9zZSBudWxsLCB3aGljaCB0aGUgbGVnYWN5IGhlbHBlclxuXHRcdCAqIG90aGVyd2lzZSBhdHRlbXB0cyB0byBpbmRleCB3aGlsZSByZWluaXRpYWxpemluZyB0aGUgY2FsZW5kYXIuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG5vcm1hbGl6ZV9jYWxlbmRhcl9zY3JvbGxfdGFyZ2V0KCkge1xuXHRcdFx0dmFyIHNjcm9sbF90YXJnZXQ7XG5cblx0XHRcdGlmIChcblx0XHRcdFx0ISBlZGl0b3Jcblx0XHRcdFx0fHwgISB3aW5kb3cuX3dwYmNcblx0XHRcdFx0fHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy5fd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlXG5cdFx0XHRcdHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiB3aW5kb3cuX3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0c2Nyb2xsX3RhcmdldCA9IHdpbmRvdy5fd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCBlZGl0b3IucmVzb3VyY2VfaWQsICdjYWxlbmRhcl9zY3JvbGxfdG8nICk7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdGZhbHNlICE9PSBzY3JvbGxfdGFyZ2V0XG5cdFx0XHRcdCYmIChcblx0XHRcdFx0XHQhIEFycmF5LmlzQXJyYXkoIHNjcm9sbF90YXJnZXQgKVxuXHRcdFx0XHRcdHx8IHNjcm9sbF90YXJnZXQubGVuZ3RoIDwgMlxuXHRcdFx0XHRcdHx8IG51bGwgPT09IHNjcm9sbF90YXJnZXRbIDAgXVxuXHRcdFx0XHRcdHx8IG51bGwgPT09IHNjcm9sbF90YXJnZXRbIDEgXVxuXHRcdFx0XHQpXG5cdFx0XHQpIHtcblx0XHRcdFx0c2V0X2NhbGVuZGFyX3BhcmFtZXRlciggJ2NhbGVuZGFyX3Njcm9sbF90bycsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQXBwbHkgdGhlIGN1cnJlbnQgZHJhZnQgdGhyb3VnaCB0aGUgcmVhbCBCb29raW5nIENhbGVuZGFyIG1vZGUgaGVscGVycy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgY2FsZW5kYXIgcnVudGltZSB3YXMgcmVhZHkuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYXBwbHlfcHJldmlld19wb2xpY3koKSB7XG5cdFx0XHR2YXIgbW9kZTtcblx0XHRcdHZhciBjaGFuZ2VvdmVyO1xuXHRcdFx0dmFyIHJlY3VycmVudF90aW1lO1xuXHRcdFx0dmFyIHRyaWFuZ2xlcztcblx0XHRcdHZhciBjYWxlbmRhcl9ub2RlO1xuXHRcdFx0dmFyIGZpeGVkX2RheXM7XG5cdFx0XHR2YXIgZml4ZWRfd2Vla2RheXM7XG5cdFx0XHR2YXIgZHluYW1pY19taW47XG5cdFx0XHR2YXIgZHluYW1pY19tYXg7XG5cdFx0XHR2YXIgZHluYW1pY19zcGVjaWZpYztcblx0XHRcdHZhciBkeW5hbWljX3dlZWtkYXlzO1xuXG5cdFx0XHRpZiAoICEgZWRpdG9yICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdHN5bmNfY2hhbmdlb3Zlcl9wcmV2aWV3X2NsYXNzZXMoKTtcblxuXHRcdFx0aWYgKCAhIHdpbmRvdy5fd3BiYyB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93Ll93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0Y2FsZW5kYXJfbm9kZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnY2FsZW5kYXJfYm9va2luZycgKyBlZGl0b3IucmVzb3VyY2VfaWQgKTtcblx0XHRcdGlmICggISBjYWxlbmRhcl9ub2RlICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdG1vZGUgPSBnZXRfc2VsZWN0ZWRfbW9kZSgpO1xuXHRcdFx0Y2hhbmdlb3ZlciA9IGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbbmFtZT1cImRhdGVfc2VsZWN0aW9uX2NoYW5nZW92ZXJfZW5hYmxlZFwiXScgKTtcblx0XHRcdHJlY3VycmVudF90aW1lID0gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tuYW1lPVwiZGF0ZV9zZWxlY3Rpb25fcmVjdXJyZW50X3RpbWVcIl0nICk7XG5cdFx0XHR0cmlhbmdsZXMgPSBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW25hbWU9XCJkYXRlX3NlbGVjdGlvbl90cmlhbmdsZXNcIl0nICk7XG5cdFx0XHRmaXhlZF9kYXlzID0gZ2V0X2ludGVnZXIoICdbbmFtZT1cImRhdGVfc2VsZWN0aW9uX2ZpeGVkX2RheXNcIl0nLCAzICk7XG5cdFx0XHRmaXhlZF93ZWVrZGF5cyA9IGdldF93ZWVrZGF5cyggJ2ZpeGVkJyApO1xuXHRcdFx0ZHluYW1pY19taW4gPSBnZXRfaW50ZWdlciggJ1tuYW1lPVwiZGF0ZV9zZWxlY3Rpb25fZHluYW1pY19taW5cIl0nLCAxICk7XG5cdFx0XHRkeW5hbWljX21heCA9IGdldF9pbnRlZ2VyKCAnW25hbWU9XCJkYXRlX3NlbGVjdGlvbl9keW5hbWljX21heFwiXScsIDEgKTtcblx0XHRcdGR5bmFtaWNfc3BlY2lmaWMgPSBnZXRfc3BlY2lmaWNfZGF5cygpO1xuXHRcdFx0ZHluYW1pY193ZWVrZGF5cyA9IGdldF93ZWVrZGF5cyggJ2R5bmFtaWMnICk7XG5cdFx0XHRkeW5hbWljX3NwZWNpZmljID0gbnVsbCA9PT0gZHluYW1pY19zcGVjaWZpYyA/IFtdIDogZHluYW1pY19zcGVjaWZpYztcblxuXHRcdFx0c2V0X2NhbGVuZGFyX3BhcmFtZXRlciggJ2lzX2VuYWJsZWRfY2hhbmdlX292ZXInLCBCb29sZWFuKCBjaGFuZ2VvdmVyICYmICdPbicgPT09IGNoYW5nZW92ZXIudmFsdWUgKSApO1xuXHRcdFx0c2V0X2NhbGVuZGFyX3BhcmFtZXRlciggJ2Jvb2tpbmdfcmVjdXJyZW50X3RpbWUnLCByZWN1cnJlbnRfdGltZSAmJiAnT24nID09PSByZWN1cnJlbnRfdGltZS52YWx1ZSA/ICdPbicgOiAnT2ZmJyApO1xuXHRcdFx0c2V0X2NhbGVuZGFyX3BhcmFtZXRlciggJ2RheXNfc2VsZWN0X21vZGUnLCBtb2RlICk7XG5cdFx0XHRzZXRfY2FsZW5kYXJfcGFyYW1ldGVyKCAnZml4ZWRfX2RheXNfbnVtJywgZml4ZWRfZGF5cyApO1xuXHRcdFx0c2V0X2NhbGVuZGFyX3BhcmFtZXRlciggJ2ZpeGVkX193ZWVrX2RheXNfX3N0YXJ0JywgZml4ZWRfd2Vla2RheXMgKTtcblx0XHRcdHNldF9jYWxlbmRhcl9wYXJhbWV0ZXIoICdkeW5hbWljX19kYXlzX21pbicsIGR5bmFtaWNfbWluICk7XG5cdFx0XHRzZXRfY2FsZW5kYXJfcGFyYW1ldGVyKCAnZHluYW1pY19fZGF5c19tYXgnLCBkeW5hbWljX21heCApO1xuXHRcdFx0c2V0X2NhbGVuZGFyX3BhcmFtZXRlciggJ2R5bmFtaWNfX2RheXNfc3BlY2lmaWMnLCBkeW5hbWljX3NwZWNpZmljICk7XG5cdFx0XHRzZXRfY2FsZW5kYXJfcGFyYW1ldGVyKCAnZHluYW1pY19fd2Vla19kYXlzX19zdGFydCcsIGR5bmFtaWNfd2Vla2RheXMgKTtcblx0XHRcdG5vcm1hbGl6ZV9jYWxlbmRhcl9zY3JvbGxfdGFyZ2V0KCk7XG5cdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuX3dwYmMuc2V0X290aGVyX3BhcmFtICkge1xuXHRcdFx0XHR3aW5kb3cuX3dwYmMuc2V0X290aGVyX3BhcmFtKCAnaXNfZW5hYmxlZF9jaGFuZ2Vfb3ZlcicsIEJvb2xlYW4oIGNoYW5nZW92ZXIgJiYgJ09uJyA9PT0gY2hhbmdlb3Zlci52YWx1ZSApICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19fY29uZGl0aW9uc19fU0FWRV9JTklUSUFMX19kYXlzX3NlbGVjdGlvbl9wYXJhbXNfX2JtICkge1xuXHRcdFx0XHR3aW5kb3cud3BiY19fY29uZGl0aW9uc19fU0FWRV9JTklUSUFMX19kYXlzX3NlbGVjdGlvbl9wYXJhbXNfX2JtKCBlZGl0b3IucmVzb3VyY2VfaWQgKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCAnc2luZ2xlJyA9PT0gbW9kZSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfY2FsX2RheXNfc2VsZWN0X19zaW5nbGUgKSB7XG5cdFx0XHRcdHdpbmRvdy53cGJjX2NhbF9kYXlzX3NlbGVjdF9fc2luZ2xlKCBlZGl0b3IucmVzb3VyY2VfaWQgKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdtdWx0aXBsZScgPT09IG1vZGUgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX2NhbF9kYXlzX3NlbGVjdF9fbXVsdGlwbGUgKSB7XG5cdFx0XHRcdHdpbmRvdy53cGJjX2NhbF9kYXlzX3NlbGVjdF9fbXVsdGlwbGUoIGVkaXRvci5yZXNvdXJjZV9pZCApO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggJ2ZpeGVkJyA9PT0gbW9kZSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfY2FsX2RheXNfc2VsZWN0X19maXhlZCApIHtcblx0XHRcdFx0d2luZG93LndwYmNfY2FsX2RheXNfc2VsZWN0X19maXhlZChcblx0XHRcdFx0XHRlZGl0b3IucmVzb3VyY2VfaWQsXG5cdFx0XHRcdFx0Zml4ZWRfZGF5cyxcblx0XHRcdFx0XHRmaXhlZF93ZWVrZGF5c1xuXHRcdFx0XHQpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggJ2R5bmFtaWMnID09PSBtb2RlICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19jYWxfZGF5c19zZWxlY3RfX3JhbmdlICkge1xuXHRcdFx0XHR3aW5kb3cud3BiY19jYWxfZGF5c19zZWxlY3RfX3JhbmdlKFxuXHRcdFx0XHRcdGVkaXRvci5yZXNvdXJjZV9pZCxcblx0XHRcdFx0XHRkeW5hbWljX21pbixcblx0XHRcdFx0XHRkeW5hbWljX21heCxcblx0XHRcdFx0XHRkeW5hbWljX3NwZWNpZmljLFxuXHRcdFx0XHRcdGR5bmFtaWNfd2Vla2RheXNcblx0XHRcdFx0KTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWFwcGx5IHBvbGljeSBhZnRlciBpbW1lZGlhdGUgaW50ZXJhY3Rpb24gYW5kIGRlbGF5ZWQgY2FsZW5kYXIgYm9vdHN0cmFwLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzY2hlZHVsZV9wcmV2aWV3X3VwZGF0ZSgpIHtcblx0XHRcdGFwcGx5X3RpbWVycy5mb3JFYWNoKCBmdW5jdGlvbiAoIHRpbWVyX2lkICkge1xuXHRcdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCB0aW1lcl9pZCApO1xuXHRcdFx0fSApO1xuXHRcdFx0YXBwbHlfdGltZXJzID0gWyAwLCAxMjAsIDQyMCwgOTAwLCAxNDAwIF0ubWFwKCBmdW5jdGlvbiAoIGRlbGF5ICkge1xuXHRcdFx0XHRyZXR1cm4gd2luZG93LnNldFRpbWVvdXQoIGFwcGx5X3ByZXZpZXdfcG9saWN5LCBkZWxheSApO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN5bmNocm9uaXplIGFsbCBwcmVzZW50YXRpb24gY29udHJvbHMgYmVmb3JlIGRyYWZ0IGNvbGxlY3Rpb24uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHN5bmMoKSB7XG5cdFx0XHRzeW5jX3dlZWtkYXlfdHJhbnNwb3J0KCAnZml4ZWQnICk7XG5cdFx0XHRzeW5jX3dlZWtkYXlfdHJhbnNwb3J0KCAnZHluYW1pYycgKTtcblx0XHRcdHN5bmNfY2hhbmdlb3Zlcl9kZXBlbmRlbmNpZXMoKTtcblx0XHRcdHN5bmNfZGlzYWJsZWRfdG9nZ2xlX3Rvb2x0aXBzKCk7XG5cdFx0XHRzeW5jX3RvZ2dsZV90cmFuc3BvcnRzKCk7XG5cdFx0XHRzeW5jX2xlZ2VuZF9wcmV2aWV3KCk7XG5cdFx0XHRzeW5jX2NoYW5nZW92ZXJfcHJldmlld19jbGFzc2VzKCk7XG5cdFx0XHRzeW5jX251bWJlcl9yYW5nZXMoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBWYWxpZGF0ZSBjb3VwbGVkIGRhdGUtc2VsZWN0aW9uIHZhbHVlcyBiZWZvcmUgbmF2aWdhdGlvbi5cblx0XHQgKlxuXHRcdCAqIFNlcnZlci1zaWRlIGZpZWxkIGFsbG93LWxpc3RzIHJlbWFpbiBhdXRob3JpdGF0aXZlLiBUaGlzIHByZXZlbnRzIGFuXG5cdFx0ICogaW50ZXJuYWxseSBpbmNvbnNpc3RlbnQgZmxleGlibGUgcmFuZ2UgZnJvbSBiZWluZyBzZW50IGFzIGEgZHJhZnQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfSBGaXJzdCBpbnZhbGlkIGNvbnRyb2wsIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gdmFsaWRhdGUoKSB7XG5cdFx0XHR2YXIgbW9kZSA9IGdldF9zZWxlY3RlZF9tb2RlKCk7XG5cdFx0XHR2YXIgZml4ZWRfZGF5cyA9IGdldF9pbnRlZ2VyKCAnW25hbWU9XCJkYXRlX3NlbGVjdGlvbl9maXhlZF9kYXlzXCJdJywgMCApO1xuXHRcdFx0dmFyIGR5bmFtaWNfbWluID0gZ2V0X2ludGVnZXIoICdbbmFtZT1cImRhdGVfc2VsZWN0aW9uX2R5bmFtaWNfbWluXCJdJywgMCApO1xuXHRcdFx0dmFyIGR5bmFtaWNfbWF4ID0gZ2V0X2ludGVnZXIoICdbbmFtZT1cImRhdGVfc2VsZWN0aW9uX2R5bmFtaWNfbWF4XCJdJywgMCApO1xuXHRcdFx0dmFyIGR5bmFtaWNfc3BlY2lmaWMgPSBnZXRfc3BlY2lmaWNfZGF5cygpO1xuXHRcdFx0dmFyIGZpeGVkX2NvbnRyb2wgPSBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW25hbWU9XCJkYXRlX3NlbGVjdGlvbl9maXhlZF9kYXlzXCJdJyApO1xuXHRcdFx0dmFyIGR5bmFtaWNfbWluX2NvbnRyb2wgPSBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW25hbWU9XCJkYXRlX3NlbGVjdGlvbl9keW5hbWljX21pblwiXScgKTtcblx0XHRcdHZhciBkeW5hbWljX21heF9jb250cm9sID0gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tuYW1lPVwiZGF0ZV9zZWxlY3Rpb25fZHluYW1pY19tYXhcIl0nICk7XG5cdFx0XHR2YXIgZHluYW1pY19zcGVjaWZpY19jb250cm9sID0gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tc3BlY2lmaWNdJyApO1xuXG5cdFx0XHRpZiAoICEgbW9kZSApIHtcblx0XHRcdFx0c2hlbGxfYXBpLnNldF9maWVsZF9lcnJvciggJ2RhdGVfc2VsZWN0aW9uX21vZGUnLCBnZXRfbWVzc2FnZSggJ21vZGVfcmVxdWlyZWQnLCAnQ2hvb3NlIGhvdyBjdXN0b21lcnMgc2VsZWN0IGRhdGVzLicgKSApO1xuXHRcdFx0XHRyZXR1cm4gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tbW9kZV0nICk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICggZml4ZWRfZGF5cyA8IDEgfHwgZml4ZWRfZGF5cyA+IHBhcnNlSW50KCBjb25maWcubWF4X2ZpeGVkX2RheXMgfHwgMTgwLCAxMCApICkge1xuXHRcdFx0XHRzaGVsbF9hcGkuc2V0X2ZpZWxkX2Vycm9yKCAnZGF0ZV9zZWxlY3Rpb25fZml4ZWRfZGF5cycsIGdldF9tZXNzYWdlKCAnZml4ZWRfZGF5c19pbnZhbGlkJywgJ0VudGVyIGEgdmFsaWQgZml4ZWQgcmFuZ2UuJyApICk7XG5cdFx0XHRcdHJldHVybiBmaXhlZF9jb250cm9sO1xuXHRcdFx0fVxuXHRcdFx0c2hlbGxfYXBpLmNsZWFyX2ZpZWxkX2Vycm9yKCAnZGF0ZV9zZWxlY3Rpb25fZml4ZWRfZGF5cycgKTtcblxuXHRcdFx0aWYgKCBkeW5hbWljX21pbiA8IDEgfHwgZHluYW1pY19tYXggPCBkeW5hbWljX21pbiB8fCBkeW5hbWljX21heCA+IHBhcnNlSW50KCBjb25maWcubWF4X2R5bmFtaWNfZGF5cyB8fCAxMDk1LCAxMCApICkge1xuXHRcdFx0XHRzaGVsbF9hcGkuc2V0X2ZpZWxkX2Vycm9yKCAnZGF0ZV9zZWxlY3Rpb25fZHluYW1pY19taW4nLCBnZXRfbWVzc2FnZSggJ2R5bmFtaWNfZGF5c19pbnZhbGlkJywgJ0VudGVyIGEgdmFsaWQgZmxleGlibGUgcmFuZ2UuJyApICk7XG5cdFx0XHRcdHNoZWxsX2FwaS5zZXRfZmllbGRfZXJyb3IoICdkYXRlX3NlbGVjdGlvbl9keW5hbWljX21heCcsIGdldF9tZXNzYWdlKCAnZHluYW1pY19kYXlzX2ludmFsaWQnLCAnRW50ZXIgYSB2YWxpZCBmbGV4aWJsZSByYW5nZS4nICkgKTtcblx0XHRcdFx0cmV0dXJuIGR5bmFtaWNfbWluIDwgMSA/IGR5bmFtaWNfbWluX2NvbnRyb2wgOiBkeW5hbWljX21heF9jb250cm9sO1xuXHRcdFx0fVxuXHRcdFx0c2hlbGxfYXBpLmNsZWFyX2ZpZWxkX2Vycm9yKCAnZGF0ZV9zZWxlY3Rpb25fZHluYW1pY19taW4nICk7XG5cdFx0XHRzaGVsbF9hcGkuY2xlYXJfZmllbGRfZXJyb3IoICdkYXRlX3NlbGVjdGlvbl9keW5hbWljX21heCcgKTtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHRudWxsID09PSBkeW5hbWljX3NwZWNpZmljXG5cdFx0XHRcdHx8IGR5bmFtaWNfc3BlY2lmaWMuc29tZSggZnVuY3Rpb24gKCBzcGVjaWZpY19kYXkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHNwZWNpZmljX2RheSA8IGR5bmFtaWNfbWluIHx8IHNwZWNpZmljX2RheSA+IGR5bmFtaWNfbWF4O1xuXHRcdFx0XHR9IClcblx0XHRcdCkge1xuXHRcdFx0XHRzaGVsbF9hcGkuc2V0X2ZpZWxkX2Vycm9yKCAnZGF0ZV9zZWxlY3Rpb25fZHluYW1pY19zcGVjaWZpYycsIGdldF9tZXNzYWdlKCAnc3BlY2lmaWNfZGF5c19pbnZhbGlkJywgJ0VudGVyIGNvbW1hLXNlcGFyYXRlZCBkYXkgbGVuZ3RocyB3aXRoaW4gdGhlIGZsZXhpYmxlIHJhbmdlLCBmb3IgZXhhbXBsZSA3LDE0LDIxLDI4LicgKSApO1xuXHRcdFx0XHRyZXR1cm4gZHluYW1pY19zcGVjaWZpY19jb250cm9sO1xuXHRcdFx0fVxuXHRcdFx0c2hlbGxfYXBpLmNsZWFyX2ZpZWxkX2Vycm9yKCAnZGF0ZV9zZWxlY3Rpb25fZHluYW1pY19zcGVjaWZpYycgKTtcblxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSGFuZGxlIGVkaXRvciBjb250cm9scyB3aXRob3V0IGNvbnN0cnVjdGluZyBkeW5hbWljIEhUTUwuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCBCcm93c2VyIGlucHV0IG9yIGNsaWNrIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2ludGVyYWN0aW9uKCBldmVudCApIHtcblx0XHRcdHZhciB3ZWVrZGF5X2J1dHRvbiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1kYXRlLXNlbGVjdGlvbi13ZWVrZGF5c10gW2RhdGEtd2Vla2RheV0nICk7XG5cdFx0XHR2YXIgbnVtYmVyX2NvbnRyb2wgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tbnVtYmVyXScgKTtcblx0XHRcdHZhciByYW5nZV9jb250cm9sID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWRhdGUtc2VsZWN0aW9uLXJhbmdlXScgKTtcblx0XHRcdHZhciBzcGVjaWZpY19wcmVzZXQgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tc3BlY2lmaWMtcHJlc2V0XScgKTtcblx0XHRcdHZhciBzcGVjaWZpY19jb250cm9sID0gZWRpdG9yID8gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tc3BlY2lmaWNdJyApIDogbnVsbDtcblx0XHRcdHZhciBjaGFuZ2VkX21vZGUgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tbW9kZV0nICk7XG5cdFx0XHR2YXIgY2hhbmdlZF90b2dnbGUgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tdG9nZ2xlXScgKTtcblx0XHRcdHZhciBjaGFuZ2VkX3RvZ2dsZV9uYW1lID0gY2hhbmdlZF90b2dnbGUgPyBTdHJpbmcoIGNoYW5nZWRfdG9nZ2xlLmRhdGFzZXQud3BiY0RhdGVTZWxlY3Rpb25Ub2dnbGUgfHwgJycgKSA6ICcnO1xuXHRcdFx0dmFyIGVkaXRvcl9jb250cm9sID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWRhdGUtc2VsZWN0aW9uLW1vZGVdLCBbZGF0YS13cGJjLWRhdGUtc2VsZWN0aW9uLW51bWJlcl0sIFtkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tcmFuZ2VdLCBbZGF0YS13cGJjLWRhdGUtc2VsZWN0aW9uLXNwZWNpZmljXSwgW2RhdGEtd3BiYy1kYXRlLXNlbGVjdGlvbi1zcGVjaWZpYy1wcmVzZXRdLCBbZGF0YS13cGJjLWRhdGUtc2VsZWN0aW9uLXRvZ2dsZV0sIFtkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tbGVnZW5kLXRpdGxlXSwgW2RhdGEtd3BiYy1kYXRlLXNlbGVjdGlvbi13ZWVrZGF5c10gW2RhdGEtd2Vla2RheV0sIFtuYW1lPVwiZGF0ZV9zZWxlY3Rpb25fY2hlY2tfaW5fdGltZVwiXSwgW25hbWU9XCJkYXRlX3NlbGVjdGlvbl9jaGVja19vdXRfdGltZVwiXScgKTtcblxuXHRcdFx0aWYgKCAhIGVkaXRvcl9jb250cm9sIHx8IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1kYXRlLXNlbGVjdGlvbi1jYWxlbmRhcl0nICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCB3ZWVrZGF5X2J1dHRvbiAmJiAhIHdlZWtkYXlfYnV0dG9uLmRpc2FibGVkICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR3ZWVrZGF5X2J1dHRvbi5zZXRBdHRyaWJ1dGUoICdhcmlhLXByZXNzZWQnLCAndHJ1ZScgPT09IHdlZWtkYXlfYnV0dG9uLmdldEF0dHJpYnV0ZSggJ2FyaWEtcHJlc3NlZCcgKSA/ICdmYWxzZScgOiAndHJ1ZScgKTtcblx0XHRcdFx0d2Vla2RheV9idXR0b24uY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLXNlbGVjdGVkJywgJ3RydWUnID09PSB3ZWVrZGF5X2J1dHRvbi5nZXRBdHRyaWJ1dGUoICdhcmlhLXByZXNzZWQnICkgKTtcblx0XHRcdFx0c3luY193ZWVrZGF5X3RyYW5zcG9ydCggd2Vla2RheV9idXR0b24uY2xvc2VzdCggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24td2Vla2RheXNdJyApLmRhdGFzZXQud3BiY0RhdGVTZWxlY3Rpb25XZWVrZGF5cyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzcGVjaWZpY19wcmVzZXQgJiYgc3BlY2lmaWNfY29udHJvbCAmJiAhIHNwZWNpZmljX3ByZXNldC5kaXNhYmxlZCAmJiAhIHNwZWNpZmljX2NvbnRyb2wuZGlzYWJsZWQgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGFwcGx5X3NwZWNpZmljX2RheV9wcmVzZXQoIHNwZWNpZmljX3ByZXNldCwgc3BlY2lmaWNfY29udHJvbCApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCByYW5nZV9jb250cm9sICkge1xuXHRcdFx0XHRzeW5jX251bWJlcl9mcm9tX3JhbmdlKCByYW5nZV9jb250cm9sICk7XG5cdFx0XHR9IGVsc2UgaWYgKCBudW1iZXJfY29udHJvbCApIHtcblx0XHRcdFx0c3luY19yYW5nZV9mcm9tX251bWJlciggbnVtYmVyX2NvbnRyb2wgKTtcblx0XHRcdH1cblx0XHRcdGFwcGx5X2V4Y2x1c2l2ZV90b2dnbGVfYWN0aW9uKCBjaGFuZ2VkX3RvZ2dsZSApO1xuXHRcdFx0YXBwbHlfc2VsZWN0ZWRfbW9kZV9kZWZhdWx0cyggY2hhbmdlZF9tb2RlICk7XG5cblx0XHRcdHN5bmMoKTtcblx0XHRcdHJlbmRlcl9lZGl0b3Jfc3RhdGUoKTtcblx0XHRcdHNjaGVkdWxlX3ByZXZpZXdfdXBkYXRlKCk7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdGNoYW5nZWRfbW9kZVxuXHRcdFx0XHR8fCAnZGF0ZV9zZWxlY3Rpb25fY2hhbmdlb3Zlcl9lbmFibGVkJyA9PT0gY2hhbmdlZF90b2dnbGVfbmFtZVxuXHRcdFx0XHR8fCAnZGF0ZV9zZWxlY3Rpb25fcmVjdXJyZW50X3RpbWUnID09PSBjaGFuZ2VkX3RvZ2dsZV9uYW1lXG5cdFx0XHRcdHx8ICdkYXRlX3NlbGVjdGlvbl9jaGVja291dF9hdmFpbGFibGUnID09PSBjaGFuZ2VkX3RvZ2dsZV9uYW1lXG5cdFx0XHQpIHtcblx0XHRcdFx0c2NoZWR1bGVfY2hhbmdlb3Zlcl9kYXRhX3JlZnJlc2goKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0LyoqXG5cdFx0XHQgKiBJbml0aWFsaXplIHRoZSBlZGl0b3IgYmVsb3cgdGhlIGF1dGhvcml6ZWQgd2l6YXJkIHNoZWxsLlxuXHRcdFx0ICpcblx0XHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBhcGkgU2hhcmVkIHNoZWxsIHNlcnZpY2VzLlxuXHRcdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHRcdCAqL1xuXHRcdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24gKCBhcGkgKSB7XG5cdFx0XHRcdHZhciBub2RlID0gYXBpLnJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tZWRpdG9yXScgKTtcblxuXHRcdFx0XHRpZiAoICEgbm9kZSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRzaGVsbF9hcGkgPSBhcGk7XG5cdFx0XHRcdGVkaXRvciA9IHtcblx0XHRcdFx0XHRub2RlOiBub2RlLFxuXHRcdFx0XHRcdHJlc291cmNlX2lkOiBwYXJzZUludCggbm9kZS5kYXRhc2V0LnJlc291cmNlSWQsIDEwICkgfHwgMSxcblx0XHRcdFx0XHRjYWxlbmRhcjogbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1kYXRlLXNlbGVjdGlvbi1jYWxlbmRhcl0nICksXG5cdFx0XHRcdFx0Y2hhbmdlb3Zlcjogbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1kYXRlLXNlbGVjdGlvbi1jaGFuZ2VvdmVyXScgKSxcblx0XHRcdFx0XHRsZWdlbmQ6IG5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZGF0ZS1zZWxlY3Rpb24tbGVnZW5kXScgKVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRsYXN0X3NlbGVjdGVkX21vZGUgPSBnZXRfc2VsZWN0ZWRfbW9kZSgpO1xuXHRcdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBoYW5kbGVfaW50ZXJhY3Rpb24gKTtcblx0XHRcdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCBoYW5kbGVfaW50ZXJhY3Rpb24gKTtcblx0XHRcdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBoYW5kbGVfaW50ZXJhY3Rpb24gKTtcblx0XHRcdFx0c3luYygpO1xuXHRcdFx0XHRyZW5kZXJfZWRpdG9yX3N0YXRlKCk7XG5cdFx0XHRcdHNjaGVkdWxlX3ByZXZpZXdfdXBkYXRlKCk7XG5cdFx0XHR9LFxuXHRcdFx0c3luYzogc3luYyxcblx0XHRcdHZhbGlkYXRlOiB2YWxpZGF0ZVxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogUmVnaXN0ZXIgYWZ0ZXIgdGhlIHNoYXJlZCBzaGVsbCBleHBvc2VzIGl0cyBtb2R1bGUgYWRhcHRlciBBUEkuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiByZWdpc3Rlcl9hZGFwdGVyKCkge1xuXHRcdGlmICggd2luZG93LndwYmNfc2V0dXBfd2l6YXJkX2FwaSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfc2V0dXBfd2l6YXJkX2FwaS5yZWdpc3Rlcl9zdGVwX2FkYXB0ZXIgKSB7XG5cdFx0XHR3aW5kb3cud3BiY19zZXR1cF93aXphcmRfYXBpLnJlZ2lzdGVyX3N0ZXBfYWRhcHRlciggY3JlYXRlX2RhdGVfc2VsZWN0aW9uX2FkYXB0ZXIoIG1vZHVsZV9jb25maWcgKSApO1xuXHRcdH1cblx0fVxuXG5cdHdpbmRvdy53cGJjX3NldHVwX2VkaXRvcl9tb2R1bGVzID0gd2luZG93LndwYmNfc2V0dXBfZWRpdG9yX21vZHVsZXMgfHwge307XG5cdHdpbmRvdy53cGJjX3NldHVwX2VkaXRvcl9tb2R1bGVzLmRhdGVfc2VsZWN0aW9uID0ge1xuXHRcdGNyZWF0ZTogY3JlYXRlX2RhdGVfc2VsZWN0aW9uX2FkYXB0ZXJcblx0fTtcblxuXHRpZiAoICdsb2FkaW5nJyA9PT0gZG9jdW1lbnQucmVhZHlTdGF0ZSApIHtcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnRE9NQ29udGVudExvYWRlZCcsIHJlZ2lzdGVyX2FkYXB0ZXIgKTtcblx0fSBlbHNlIHtcblx0XHRyZWdpc3Rlcl9hZGFwdGVyKCk7XG5cdH1cbn0oIHdpbmRvdywgZG9jdW1lbnQgKSApO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFLFdBQVdBLE1BQU0sRUFBRUMsUUFBUSxFQUFHO0VBQy9CLFlBQVk7O0VBRVosSUFBSUMsYUFBYSxHQUFHRixNQUFNLENBQUNHLGdDQUFnQyxJQUFJO0lBQUVDLElBQUksRUFBRSxDQUFDO0VBQUUsQ0FBQzs7RUFFM0U7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0MsNkJBQTZCQSxDQUFFQyxNQUFNLEVBQUc7SUFDaEQsSUFBSUMsU0FBUyxHQUFHLElBQUk7SUFDcEIs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
