"use strict";

/**
 * Timeline toolbar, date navigation, density, and axis-keyboard controller.
 *
 * Shared UI components continue to own their reusable disclosure, datepicker,
 * dropdown, focus, and keyboard mechanics. This Timeline-domain adapter owns
 * only the server-declared range/scale mapping, navigation request proposals,
 * visual cell-width state, and movement between rendered axis cells.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
(function (window, document, wp) {
  'use strict';

  var module_id = 'toolbar_navigation';

  /**
   * Create one Timeline toolbar and navigation controller.
   *
   * @param {Object} context Timeline settings, module references, and callbacks.
   * @return {Object} Toolbar/navigation lifecycle and interaction API.
   */
  function create_toolbar_navigation_controller(context) {
    var mount = context.mount || null;
    var settings = context.settings || {};
    var window_cache = context.window_cache || null;
    var callbacks = context.callbacks || {};
    var visual_zoom_configuration = get_visual_zoom_configuration();
    var visual_zoom_percent = visual_zoom_configuration.default_percent;
    var visual_zoom_anchor = null;
    var visual_zoom_frame = 0;
    var is_initialized = false;

    /**
     * Invoke one optional page-controller callback.
     *
     * @param {string} callback_name Stable callback key.
     * @param {...*} callback_arguments Callback arguments.
     * @return {*} Callback result or null when unavailable.
     */
    function invoke_callback(callback_name) {
      var callback = callbacks[callback_name];
      var callback_arguments = Array.prototype.slice.call(arguments, 1);
      return 'function' === typeof callback ? callback.apply(null, callback_arguments) : null;
    }

    /**
     * Normalize the executable-free visual cell-width configuration.
     *
     * @return {Object} Minimum, maximum, step, and selected default percentage.
     */
    function get_visual_zoom_configuration() {
      var configured = settings.metadata && settings.metadata.visual_zoom ? settings.metadata.visual_zoom : {};
      var stored_percent = settings.preferences ? Number(settings.preferences.visual_zoom_percent) : 0;
      var min_percent = Math.max(30, Math.min(300, Math.round(Number(configured.min_percent) || 30)));
      var max_percent = Math.max(min_percent, Math.min(300, Math.round(Number(configured.max_percent) || 300)));
      var step_percent = Math.max(1, Math.min(max_percent - min_percent || 1, Math.round(Number(configured.step_percent) || 10)));
      var configured_default_percent = Number(configured.default_percent) || 100;
      var default_percent = stored_percent || configured_default_percent;
      configured_default_percent = Math.max(min_percent, Math.min(max_percent, Math.round(configured_default_percent)));
      configured_default_percent = min_percent + Math.round((configured_default_percent - min_percent) / step_percent) * step_percent;
      configured_default_percent = Math.min(max_percent, configured_default_percent);
      default_percent = Math.max(min_percent, Math.min(max_percent, Math.round(default_percent)));
      default_percent = min_percent + Math.round((default_percent - min_percent) / step_percent) * step_percent;
      default_percent = Math.min(max_percent, default_percent);
      return {
        min_percent: min_percent,
        max_percent: max_percent,
        step_percent: step_percent,
        configured_default_percent: configured_default_percent,
        default_percent: default_percent
      };
    }

    /**
     * Return one server-declared shared UI WordPress template renderer.
     *
     * @param {string} template_key Stable shared component key.
     * @return {Function|null} WordPress template renderer or null.
     */
    function get_shared_ui_template(template_key) {
      var template_id = settings.shared_ui && settings.shared_ui.templates ? settings.shared_ui.templates[template_key] : '';
      if (!template_id || !wp || 'function' !== typeof wp.template) {
        return null;
      }
      return wp.template(template_id);
    }

    /**
     * Render one shared component into its Timeline-owned host.
     *
     * @param {Element|null} target Domain-owned host.
     * @param {string} template_key Shared component key.
     * @param {Object} view_model Executable-free component data.
     * @return {boolean} True when the component rendered.
     */
    function render_shared_ui_template(target, template_key, view_model) {
      var template = get_shared_ui_template(template_key);
      if (!target || !template) {
        return false;
      }
      target.innerHTML = template(view_model);
      return true;
    }

    /**
     * Return one exact server-declared range-and-scale option.
     *
     * @param {string} option_value Stable opaque option value.
     * @return {Object|null} Matching option metadata or null.
     */
    function get_range_scale_option(option_value) {
      var matching_option = null;
      (settings.metadata.range_scale_options || []).some(function (range_scale_option) {
        if (String(range_scale_option.value) === String(option_value)) {
          matching_option = range_scale_option;
          return true;
        }
        return false;
      });
      return matching_option;
    }

    /**
     * Format the fallback label for a custom range and current scale.
     *
     * @param {string} range_label Date-range label.
     * @param {string} scale_label Cell-scale label.
     * @return {string} Combined visible label.
     */
    function format_custom_range_label(range_label, scale_label) {
      return String(settings.i18n.advanced_combination_format || '%1$s — %2$s').replace('%1$s', String(range_label || '')).replace('%2$s', String(scale_label || ''));
    }

    /**
     * Return the option matching the current logical server window.
     *
     * @return {string} Exact option value or `custom`.
     */
    function get_matching_range_scale_option_value() {
      var matching_option_value = 'custom';
      var current_view = settings.current_axis && settings.current_axis.view ? settings.current_axis.view : settings.axis.view;
      (settings.metadata.range_scale_options || []).some(function (range_scale_option) {
        var option_months = Number(range_scale_option.window_months);
        var matches_months = 0 < option_months && option_months === Number(settings.window.window_months);
        var matches_days = 0 === option_months && 0 === Number(settings.window.window_months) && Number(range_scale_option.window_days) === Number(settings.window.window_days);
        if (String(range_scale_option.view_id) === String(current_view) && (matches_months || matches_days)) {
          matching_option_value = String(range_scale_option.value);
          return true;
        }
        return false;
      });
      return matching_option_value;
    }

    /**
     * Return one option label from ordered metadata.
     *
     * @param {Array<Object>} options Metadata records.
     * @param {string} selected_value Selected identifier.
     * @param {string} fallback_label Fallback when no record matches.
     * @return {string} Selected display label.
     */
    function get_option_label(options, selected_value, fallback_label) {
      var selected_label = fallback_label || selected_value;
      (options || []).some(function (option) {
        if (String(option.id) === String(selected_value)) {
          selected_label = option.label;
          return true;
        }
        return false;
      });
      return selected_label;
    }

    /**
     * Return the decorative icon for one Timeline cell scale.
     *
     * @param {string} view_id Timeline view identifier.
     * @return {string} Booking Calendar icon class.
     */
    function get_timeline_scale_icon_class(view_id) {
      if ('day' === String(view_id)) {
        return 'wpbc-bi-calendar3';
      }
      if (-1 !== String(view_id).indexOf('minutes')) {
        return 'wpbc-bi-stopwatch';
      }
      return 'wpbc-bi-clock';
    }

    /**
     * Render exact Timeline-owned range-and-scale options through shared UI.
     *
     * @return {void}
     */
    function render_toolbar_dropdown() {
      var host = mount.querySelector('[data-wpbc-timeline-advanced-combination-dropdown]');
      var selected_value = get_matching_range_scale_option_value();
      var selected_option = get_range_scale_option(selected_value);
      var current_view = settings.current_axis && settings.current_axis.view ? settings.current_axis.view : settings.axis.view;
      var current_group = '';
      var custom_label = format_custom_range_label(settings.i18n.custom_range, get_option_label(settings.metadata.views, current_view, current_view));
      var options = [{
        type: 'option',
        value: 'custom',
        label: custom_label,
        icon_class: get_timeline_scale_icon_class(current_view),
        disabled: true
      }];
      (settings.metadata.range_scale_options || []).forEach(function (range_scale_option) {
        if (current_group !== String(range_scale_option.preset_id)) {
          current_group = String(range_scale_option.preset_id);
          options.push({
            type: 'separator'
          });
          options.push({
            type: 'heading',
            label: range_scale_option.preset_title
          });
        }
        options.push({
          type: 'option',
          value: range_scale_option.value,
          label: range_scale_option.title,
          icon_class: get_timeline_scale_icon_class(range_scale_option.view_id),
          disabled: false
        });
      });
      render_shared_ui_template(host, 'dropdown', {
        id: 'wpbc_timeline_advanced_combination',
        label: settings.i18n.advanced_combination_label,
        described_by: 'wpbc_timeline_advanced_combination_description',
        selected_value: selected_value,
        selected_label: selected_option ? selected_option.title : custom_label,
        icon_class: get_timeline_scale_icon_class(current_view),
        options: options
      });
    }

    /**
     * Shift one strict ISO date by whole UTC calendar days.
     *
     * @param {string} iso_date YYYY-MM-DD date.
     * @param {number} day_count Signed day count.
     * @return {string} Shifted YYYY-MM-DD date, or an empty string.
     */
    function shift_iso_date(iso_date, day_count) {
      var match = String(iso_date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      var shifted_date;
      if (!match) {
        return '';
      }
      shifted_date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + day_count));
      return shifted_date.getUTCFullYear() + '-' + ('0' + String(shifted_date.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + String(shifted_date.getUTCDate())).slice(-2);
    }

    /**
     * Return inclusive date values for the current half-open server axis.
     *
     * @return {Object} Inclusive start and end YYYY-MM-DD values.
     */
    function get_current_axis_date_range() {
      var axis = settings.current_axis || settings.axis || {};
      var start_date = String(axis.start_at || '').slice(0, 10);
      var exclusive_end_date = String(axis.end_at || '').slice(0, 10);
      return {
        start_date: start_date,
        end_date: shift_iso_date(exclusive_end_date, -1)
      };
    }

    /**
     * Render Timeline dates through the shared range-navigation component.
     *
     * @return {void}
     */
    function render_date_range_navigation() {
      var host = mount.querySelector('[data-wpbc-timeline-date-range-navigation]');
      var date_range = get_current_axis_date_range();
      render_shared_ui_template(host, 'date_range_navigation', {
        id: 'wpbc_timeline_date_range',
        range_label: settings.current_axis && settings.current_axis.range_label ? settings.current_axis.range_label : settings.axis.range_label,
        start_date: date_range.start_date,
        end_date: date_range.end_date,
        first_day: settings.shared_ui ? Number(settings.shared_ui.first_day) || 0 : 0,
        maximum_span_days: settings.metadata && settings.metadata.limits ? Number(settings.metadata.limits.maximum_window_days) || 62 : 62,
        previous_label: settings.i18n.previous_window,
        next_label: settings.i18n.next_window,
        dialog_label: settings.i18n.choose_date_range,
        start_label: settings.i18n.start_date,
        end_label: settings.i18n.end_date,
        apply_label: settings.i18n.apply_date_range,
        reset_label: settings.i18n.reset_date_range,
        cancel_label: settings.i18n.cancel,
        invalid_message: settings.i18n.invalid_date_range,
        maximum_message: settings.i18n.maximum_date_range
      });
    }

    /**
     * Render the shared Today/single-date split control.
     *
     * @return {void}
     */
    function render_date_jump() {
      var host = mount.querySelector('[data-wpbc-timeline-date-jump]');
      render_shared_ui_template(host, 'date_jump', {
        id: 'wpbc_timeline_date_jump',
        action_label: settings.i18n.today,
        choose_date_label: settings.i18n.choose_jump_date,
        date_label: settings.i18n.jump_date,
        selected_date: settings.shared_ui ? String(settings.shared_ui.today_date || '') : '',
        first_day: settings.shared_ui ? Number(settings.shared_ui.first_day) || 0 : 0
      });
    }

    /**
     * Render the Timeline Reset action through the shared control button.
     *
     * @return {void}
     */
    function render_reset_preferences_button() {
      var host = mount.querySelector('[data-wpbc-timeline-reset-preferences-host]');
      render_shared_ui_template(host, 'context_popover_button', {
        id: 'wpbc_timeline_reset_preferences',
        label: settings.i18n.reset_timeline,
        description: settings.i18n.reset_timeline_description,
        icon_class: 'wpbc_icn_refresh',
        disabled: false
      });
    }

    /**
     * Synchronize rendered range values without replacing focused markup.
     *
     * @return {void}
     */
    function synchronize_date_range_navigation() {
      var root = mount.querySelector('[data-wpbc-shared-ui-date-range-navigation="wpbc_timeline_date_range"]');
      var range_label = root ? root.querySelector('[data-wpbc-shared-ui-date-range-label]') : null;
      var start_input = root ? root.querySelector('[data-wpbc-shared-ui-date-range-start]') : null;
      var end_input = root ? root.querySelector('[data-wpbc-shared-ui-date-range-end]') : null;
      var date_range = get_current_axis_date_range();
      if (!root) {
        return;
      }
      if (range_label) {
        range_label.textContent = settings.current_axis && settings.current_axis.range_label ? settings.current_axis.range_label : settings.axis.range_label;
      }
      root.setAttribute('data-start-date', date_range.start_date);
      root.setAttribute('data-end-date', date_range.end_date);
      if (root.querySelector('[data-wpbc-shared-ui-popover].is-open')) {
        return;
      }
      if (start_input) {
        start_input.value = date_range.start_date;
      }
      if (end_input) {
        end_input.value = date_range.end_date;
      }
    }

    /**
     * Synchronize a shared dropdown without replacing its focused DOM.
     *
     * @param {HTMLElement|null} dropdown_root Shared dropdown root.
     * @param {string} selected_value Selected option value.
     * @param {boolean} is_disabled Whether the trigger is disabled.
     * @param {Array<string>} disabled_values Option values to disable.
     * @return {void}
     */
    function synchronize_shared_dropdown(dropdown_root, selected_value, is_disabled, disabled_values) {
      var trigger;
      var panel;
      var value_label;
      var hidden_input;
      var selected_option = null;
      if (!dropdown_root) {
        return;
      }
      trigger = dropdown_root.querySelector('[data-wpbc-shared-ui-dropdown-trigger]');
      panel = dropdown_root.querySelector('[data-wpbc-shared-ui-dropdown-panel]');
      value_label = dropdown_root.querySelector('[data-wpbc-shared-ui-dropdown-label]');
      hidden_input = dropdown_root.querySelector('[data-wpbc-shared-ui-dropdown-input]');
      dropdown_root.setAttribute('data-wpbc-shared-ui-dropdown-value', selected_value);
      Array.prototype.forEach.call(dropdown_root.querySelectorAll('[data-wpbc-shared-ui-dropdown-option]'), function (option) {
        var option_value = option.getAttribute('data-value') || '';
        var is_selected = option_value === selected_value;
        var option_disabled = -1 !== disabled_values.indexOf(option_value);
        option.classList.toggle('is-selected', is_selected);
        option.setAttribute('aria-selected', is_selected ? 'true' : 'false');
        option.disabled = option_disabled;
        option.setAttribute('aria-disabled', option_disabled ? 'true' : 'false');
        if (is_selected) {
          selected_option = option;
        }
      });
      if (trigger) {
        trigger.disabled = is_disabled;
        if (is_disabled) {
          trigger.setAttribute('aria-expanded', 'false');
        }
      }
      if (panel && is_disabled) {
        panel.hidden = true;
        dropdown_root.classList.remove('is-open');
      }
      if (value_label && selected_option) {
        value_label.textContent = selected_option.textContent.trim();
      }
      if (hidden_input) {
        hidden_input.value = selected_value;
      }
    }

    /**
     * Apply the server axis dimensions and presentation-only density.
     *
     * @return {void}
     */
    function apply_axis_dimensions() {
      var timeline = mount.querySelector('.wpbc_timeline');
      var window_loading = settings.metadata && settings.metadata.window_loading ? settings.metadata.window_loading : {};
      var base_cell_width;
      var visual_cell_width;
      if (!timeline || !settings.axis) {
        return;
      }
      base_cell_width = Number(settings.axis.cell_width_px) || 96;
      visual_cell_width = Math.max(1, Math.round(base_cell_width * visual_zoom_percent / 100));
      timeline.style.setProperty('--wpbc-timeline-cells', Number(settings.axis.cell_count) || 1);
      timeline.style.setProperty('--wpbc-timeline-cell-width', visual_cell_width + 'px');
      timeline.style.setProperty('--wpbc-timeline-visual-zoom', visual_zoom_percent);
      timeline.style.setProperty('--wpbc_timeline_general__resource-header-height', (Number(settings.axis.header_height_px) || 96) + 'px');
      timeline.style.setProperty('--wpbc_timeline_general__edge-placeholder-cells', Math.max(1, Number(window_loading.edge_placeholder_cells) || 3));
    }

    /**
     * Select compact vertical timed labels only when localized text is clipped.
     *
     * @return {void}
     */
    function synchronize_time_label_presentation() {
      var timeline = mount.querySelector('.wpbc_timeline');
      var time_labels;
      var has_overflow = false;
      if (!timeline) {
        return;
      }
      timeline.classList.remove('has-vertical-time-labels');
      if (!settings.axis || !settings.axis.is_timed) {
        return;
      }
      time_labels = timeline.querySelectorAll('.wpbc_timeline__time_label, .wpbc_timeline__offset_label');
      Array.prototype.some.call(time_labels, function (time_label) {
        has_overflow = time_label.scrollWidth > time_label.clientWidth;
        return has_overflow;
      });
      timeline.classList.toggle('has-vertical-time-labels', has_overflow);
    }

    /**
     * Normalize a requested visual cell-width percentage.
     *
     * @param {number|string} requested_percent Untrusted range-control value.
     * @return {number} Bounded percentage aligned to the configured step.
     */
    function normalize_visual_zoom_percent(requested_percent) {
      var normalized_percent = Number(requested_percent);
      if (!Number.isFinite(normalized_percent)) {
        return visual_zoom_percent;
      }
      normalized_percent = Math.max(visual_zoom_configuration.min_percent, Math.min(visual_zoom_configuration.max_percent, normalized_percent));
      normalized_percent = visual_zoom_configuration.min_percent + Math.round((normalized_percent - visual_zoom_configuration.min_percent) / visual_zoom_configuration.step_percent) * visual_zoom_configuration.step_percent;
      return Math.min(visual_zoom_configuration.max_percent, normalized_percent);
    }

    /**
     * Synchronize the density range and its visible value.
     *
     * @return {void}
     */
    function update_visual_zoom_controls() {
      var status = mount.querySelector('[data-wpbc-timeline-visual-zoom-status]');
      var range = mount.querySelector('[data-wpbc-timeline-visual-zoom-range]');
      if (status) {
        status.textContent = visual_zoom_percent + '%';
      }
      if (range) {
        range.min = visual_zoom_configuration.min_percent;
        range.max = visual_zoom_configuration.max_percent;
        range.step = visual_zoom_configuration.step_percent;
        range.value = visual_zoom_percent;
        range.setAttribute('aria-valuetext', visual_zoom_percent + '%');
      }
    }

    /**
     * Change only the rendered cell width and retain the visible instant.
     *
     * @param {number|string} requested_percent Requested visual width percentage.
     * @return {void}
     */
    function change_visual_zoom(requested_percent) {
      var next_percent = normalize_visual_zoom_percent(requested_percent);
      if (next_percent === visual_zoom_percent) {
        update_visual_zoom_controls();
        return;
      }
      if (!visual_zoom_anchor) {
        invoke_callback('cancel_anchor_restoration');
        visual_zoom_anchor = window_cache ? window_cache.capture_axis_anchor() : null;
        invoke_callback('suspend_adjacent_loading');
      }
      visual_zoom_percent = next_percent;
      update_visual_zoom_controls();
      if (visual_zoom_frame) {
        return;
      }
      visual_zoom_frame = window.requestAnimationFrame(function () {
        if (!is_initialized) {
          visual_zoom_frame = 0;
          visual_zoom_anchor = null;
          return;
        }
        apply_axis_dimensions();
        synchronize_time_label_presentation();
        if (window_cache && visual_zoom_anchor) {
          window_cache.restore_axis_anchor(visual_zoom_anchor);
        }
        visual_zoom_anchor = null;
        visual_zoom_frame = 0;
        invoke_callback('schedule_overflow_tooltips');
        invoke_callback('schedule_edge_status');
        invoke_callback('schedule_booking_layout');
      });
    }

    /**
     * Preview a density range value without repeated announcements.
     *
     * @param {Event} event Range input event.
     * @return {void}
     */
    function handle_visual_zoom_input(event) {
      var range = event.target.closest('[data-wpbc-timeline-visual-zoom-range]');
      if (range) {
        change_visual_zoom(range.value);
      }
    }

    /**
     * Announce the committed density value.
     *
     * @param {Event} event Range change event.
     * @return {void}
     */
    function handle_visual_zoom_change(event) {
      var range = event.target.closest('[data-wpbc-timeline-visual-zoom-range]');
      if (!range) {
        return;
      }
      change_visual_zoom(range.value);
      invoke_callback('announce', String(settings.i18n.visual_zoom_updated || '').replace('{percent}', visual_zoom_percent));
      invoke_callback('save_preferences');
    }

    /**
     * Cancel an active empty-range proposal before replacing navigation state.
     *
     * @return {void}
     */
    function cancel_active_selection() {
      invoke_callback('cancel_active_selection');
    }

    /**
     * Navigate to the current instant without changing range or scale.
     *
     * @return {void}
     */
    function navigate_to_today() {
      var navigation = window_cache ? window_cache.resolve_today_navigation() : null;
      var anchor;
      if (!navigation) {
        return;
      }
      anchor = navigation.anchor;
      cancel_active_selection();
      if (navigation.is_loaded && invoke_callback('restore_loaded_anchor', anchor, {
        refresh_today: true
      })) {
        invoke_callback('save_preferences', {
          anchor_date: settings.shared_ui.today_date,
          anchor_ratio: navigation.anchor_ratio
        });
        return;
      }
      invoke_callback('request_window', invoke_callback('add_current_window_span', {
        anchor_at: anchor.at,
        anchor_ratio: navigation.anchor_ratio,
        window_position: 0,
        view: settings.current_axis ? settings.current_axis.view : settings.axis.view
      }, false), anchor, true, {
        loading: settings.i18n.loading_today,
        complete: settings.i18n.status_ready,
        persist_preferences: true
      });
    }

    /**
     * Navigate to one strict site-local date without changing range or scale.
     *
     * @param {string} iso_date Strict YYYY-MM-DD date.
     * @return {void}
     */
    function navigate_to_date(iso_date) {
      var anchor;
      var anchor_ratio;
      if (shift_iso_date(iso_date, 0) !== iso_date) {
        return;
      }
      cancel_active_selection();
      anchor_ratio = window_cache ? window_cache.get_today_request_anchor_ratio() : 0;
      anchor = window_cache ? window_cache.create_loaded_date_anchor(iso_date) : null;
      if (anchor && invoke_callback('restore_loaded_anchor', anchor, {
        announcement: settings.i18n.selected_date_loaded
      })) {
        invoke_callback('save_preferences', {
          anchor_date: iso_date,
          anchor_ratio: anchor_ratio
        });
        return;
      }
      anchor = {
        at: iso_date + 'T00:00:00+00:00',
        ratio: anchor_ratio,
        leading_cells_before: 1,
        restore_focus: false,
        target_date: iso_date
      };
      invoke_callback('request_window', invoke_callback('add_current_window_span', {
        anchor_date: iso_date,
        anchor_ratio: anchor_ratio,
        window_position: 0,
        view: settings.current_axis ? settings.current_axis.view : settings.axis.view
      }, false), anchor, true, {
        loading: settings.i18n.loading_selected_date,
        complete: settings.i18n.selected_date_loaded,
        persist_preferences: true
      });
    }

    /**
     * Load the previous or next server-authorized Timeline window.
     *
     * @param {string} direction Previous or next.
     * @return {boolean} True when a valid navigation request was dispatched.
     */
    function navigate_timeline_window(direction) {
      var anchor;
      var current_axis = settings.current_axis ? settings.current_axis : settings.axis;
      if ('previous' !== direction && 'next' !== direction) {
        return false;
      }
      anchor = {
        at: current_axis.start_at,
        ratio: 0,
        leading_cells_before: 0,
        restore_focus: false,
        use_response_start: true
      };
      invoke_callback('request_window', invoke_callback('add_current_window_span', {
        anchor_at: current_axis.start_at,
        window_position: 'previous' === direction ? -1 : 1,
        view: settings.current_axis ? settings.current_axis.view : settings.axis.view
      }, false), anchor, true, {
        loading: 'previous' === direction ? settings.i18n.loading_previous_window : settings.i18n.loading_next_window,
        complete: settings.i18n.status_ready,
        persist_preferences: true
      });
      return true;
    }

    /**
     * Apply one server-declared range-and-scale selection.
     *
     * @param {string} selected_value Stable opaque option value.
     * @return {boolean} True when the option was recognized and dispatched.
     */
    function apply_range_scale_option(selected_value) {
      var selected_option = get_range_scale_option(selected_value);
      var anchor;
      var request_values;
      if (!selected_option) {
        return false;
      }
      anchor = window_cache ? window_cache.capture_axis_anchor() : {
        at: settings.axis.anchor.at,
        ratio: 0.5
      };
      request_values = {
        anchor_at: anchor.at,
        anchor_ratio: anchor.ratio,
        window_position: 0,
        view: selected_option.view_id
      };
      if (0 < Number(selected_option.window_months)) {
        request_values.window_months = Number(selected_option.window_months);
      } else {
        request_values.window_days = Number(selected_option.window_days);
      }
      invoke_callback('request_window', request_values, anchor, true, {
        loading: settings.i18n.loading_timeline_combination,
        complete: settings.i18n.combination_loaded,
        persist_preferences: true
      });
      return true;
    }

    /**
     * Apply one strict inclusive custom date range.
     *
     * UTC calendar arithmetic validates civil dates without applying the browser
     * timezone or a daylight-saving offset. PHP still independently validates
     * the authorized axis, Resource scope, and payload budgets.
     *
     * @param {string} start_date Inclusive YYYY-MM-DD start.
     * @param {string} end_date Inclusive YYYY-MM-DD end.
     * @return {boolean} True when a valid request was dispatched.
     */
    function apply_custom_date_range(start_date, end_date) {
      var maximum_span_days = settings.metadata && settings.metadata.limits ? Number(settings.metadata.limits.maximum_window_days) || 62 : 62;
      var start_match = String(start_date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      var end_match = String(end_date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      var start_epoch;
      var end_epoch;
      var span_days;
      var anchor;
      if (!start_match || !end_match || shift_iso_date(start_date, 0) !== start_date || shift_iso_date(end_date, 0) !== end_date) {
        return false;
      }
      start_epoch = Date.UTC(Number(start_match[1]), Number(start_match[2]) - 1, Number(start_match[3]));
      end_epoch = Date.UTC(Number(end_match[1]), Number(end_match[2]) - 1, Number(end_match[3]));
      span_days = Math.round((end_epoch - start_epoch) / 86400000) + 1;
      if (span_days < 1 || span_days > maximum_span_days || shift_iso_date(start_date, span_days - 1) !== end_date) {
        return false;
      }
      anchor = {
        at: start_date + 'T00:00:00+00:00',
        ratio: 0,
        leading_cells_before: 0,
        restore_focus: false,
        use_response_start: true
      };
      invoke_callback('request_window', {
        anchor_date: start_date,
        anchor_ratio: 0,
        window_position: 0,
        window_days: span_days,
        view: settings.current_axis ? settings.current_axis.view : settings.axis.view
      }, anchor, true, {
        loading: settings.i18n.loading_date_range,
        complete: settings.i18n.status_ready,
        persist_preferences: true
      });
      return true;
    }

    /**
     * Restore configured toolbar defaults and refresh at the site-local today.
     *
     * Persistence is reset first by the page-controller callback. This method
     * applies only the server-declared default request and presentation density;
     * Resource selection and hierarchy state remain outside its ownership.
     *
     * @return {boolean} True when the default window request was dispatched.
     */
    function reset_to_defaults() {
      var default_request = settings.metadata && settings.metadata.default_window_request ? settings.metadata.default_window_request : {};
      var today_date = settings.shared_ui ? String(settings.shared_ui.today_date || '') : '';
      var anchor_ratio = window_cache ? window_cache.get_today_request_anchor_ratio() : 0;
      var request_values;
      var request_result;
      var anchor;
      if (shift_iso_date(today_date, 0) !== today_date || !default_request.view || !Number(default_request.window_days) && !Number(default_request.window_months)) {
        return false;
      }
      cancel_active_selection();
      change_visual_zoom(visual_zoom_configuration.configured_default_percent);
      invoke_callback('set_preference_anchor', today_date, anchor_ratio);
      anchor = {
        at: today_date + 'T00:00:00+00:00',
        ratio: anchor_ratio,
        leading_cells_before: 1,
        restore_focus: false,
        target_date: today_date
      };
      request_values = {
        anchor_date: today_date,
        anchor_ratio: anchor_ratio,
        window_position: 0,
        view: String(default_request.view)
      };
      if (0 < Number(default_request.window_months)) {
        request_values.window_months = Number(default_request.window_months);
      } else {
        request_values.window_days = Number(default_request.window_days);
      }
      request_result = invoke_callback('request_window', request_values, anchor, true, {
        loading: settings.i18n.resetting_timeline,
        complete: settings.i18n.timeline_reset,
        persist_preferences: false
      });
      return Boolean(request_result);
    }

    /**
     * Handle shared Timeline toolbar events.
     *
     * @param {CustomEvent} event Shared component event.
     * @return {void}
     */
    function handle_shared_event(event) {
      var detail = event.detail && 'object' === typeof event.detail ? event.detail : {};
      var component_id = String(detail.id || '');
      if ('wpbc:shared-ui-dropdown-change' === event.type && 'wpbc_timeline_advanced_combination' === component_id) {
        apply_range_scale_option(String(detail.value || ''));
      } else if ('wpbc:shared-ui-date-range-shift' === event.type && 'wpbc_timeline_date_range' === component_id) {
        navigate_timeline_window(String(detail.direction || ''));
      } else if ('wpbc:shared-ui-date-range-apply' === event.type && 'wpbc_timeline_date_range' === component_id) {
        apply_custom_date_range(String(detail.start_date || ''), String(detail.end_date || ''));
      } else if ('wpbc:shared-ui-date-jump-action' === event.type && 'wpbc_timeline_date_jump' === component_id) {
        navigate_to_today();
      } else if ('wpbc:shared-ui-date-jump-select' === event.type && 'wpbc_timeline_date_jump' === component_id) {
        navigate_to_date(String(detail.date || ''));
      }
    }

    /**
     * Handle previous/next controls delegated by the page controller.
     *
     * @param {MouseEvent} event Browser click event.
     * @return {boolean} True when this module consumed the click.
     */
    function handle_click(event) {
      var window_button = event.target.closest('[data-wpbc-timeline-window]');
      var reset_button = event.target.closest('[data-wpbc-shared-ui-context-popover-button="wpbc_timeline_reset_preferences"]');
      if (reset_button) {
        if ('true' === reset_button.getAttribute('aria-disabled')) {
          return true;
        }
        invoke_callback('reset_preferences', reset_button);
        return true;
      }
      return Boolean(window_button && navigate_timeline_window(window_button.getAttribute('data-wpbc-timeline-window')));
    }

    /**
     * Move focus between server-defined axis cells with RTL-aware arrows.
     *
     * @param {KeyboardEvent} event Key event from the axis.
     * @return {boolean} True when this module consumed the key.
     */
    function handle_keydown(event) {
      var cell = event.target.closest('[data-wpbc-timeline-axis-cell]');
      var cells;
      var current_index;
      var requested_index;
      var next_index;
      var direction;
      if (!cell || -1 === ['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(event.key)) {
        return false;
      }
      cells = mount.querySelectorAll('[data-wpbc-timeline-axis-cell]');
      current_index = Array.prototype.indexOf.call(cells, cell);
      if (0 > current_index) {
        return false;
      }
      if ('Home' === event.key) {
        requested_index = 0;
      } else if ('End' === event.key) {
        requested_index = cells.length - 1;
      } else {
        requested_index = current_index + ('ArrowRight' === event.key ? 1 : -1) * (settings.is_rtl ? -1 : 1);
      }
      next_index = Math.max(0, Math.min(cells.length - 1, requested_index));
      if (next_index === current_index) {
        if (-1 !== ['ArrowLeft', 'ArrowRight'].indexOf(event.key) && requested_index !== current_index) {
          direction = 0 > requested_index ? 'previous' : 'next';
          if (invoke_callback('activate_adjacent_intent', direction, false)) {
            invoke_callback('request_adjacent_window', direction);
            event.preventDefault();
            return true;
          }
        }
        return false;
      }
      direction = next_index < current_index ? 'previous' : 'next';
      invoke_callback('activate_adjacent_intent', direction, false);
      event.preventDefault();
      cell.setAttribute('tabindex', '-1');
      cells[next_index].setAttribute('tabindex', '0');
      cells[next_index].focus();
      cells[next_index].scrollIntoView({
        block: 'nearest',
        inline: 'nearest'
      });
      invoke_callback('synchronize_axis_scroll');
      return true;
    }

    /**
     * Render all shared toolbar controls once after the shell mounts.
     *
     * @return {void}
     */
    function render_controls() {
      render_toolbar_dropdown();
      render_date_range_navigation();
      render_date_jump();
      render_reset_preferences_button();
    }

    /**
     * Synchronize controls and dimensions after an authorized window render.
     *
     * @return {void}
     */
    function refresh_after_window_render() {
      var dropdown = mount.querySelector('[data-wpbc-shared-ui-dropdown="wpbc_timeline_advanced_combination"]');
      synchronize_date_range_navigation();
      synchronize_shared_dropdown(dropdown, get_matching_range_scale_option_value(), false, ['custom']);
      apply_axis_dimensions();
      synchronize_time_label_presentation();
      update_visual_zoom_controls();
    }

    /**
     * Initialize owned shared-control event listeners once.
     *
     * @return {void}
     */
    function initialize() {
      if (is_initialized || !mount) {
        return;
      }
      is_initialized = true;
      mount.addEventListener('input', handle_visual_zoom_input);
      mount.addEventListener('change', handle_visual_zoom_change);
      mount.addEventListener('wpbc:shared-ui-dropdown-change', handle_shared_event);
      mount.addEventListener('wpbc:shared-ui-date-range-shift', handle_shared_event);
      mount.addEventListener('wpbc:shared-ui-date-range-apply', handle_shared_event);
      mount.addEventListener('wpbc:shared-ui-date-jump-action', handle_shared_event);
      mount.addEventListener('wpbc:shared-ui-date-jump-select', handle_shared_event);
    }

    /**
     * Remove owned listeners and cancel pending density work.
     *
     * @return {void}
     */
    function destroy() {
      if (!is_initialized) {
        return;
      }
      mount.removeEventListener('input', handle_visual_zoom_input);
      mount.removeEventListener('change', handle_visual_zoom_change);
      mount.removeEventListener('wpbc:shared-ui-dropdown-change', handle_shared_event);
      mount.removeEventListener('wpbc:shared-ui-date-range-shift', handle_shared_event);
      mount.removeEventListener('wpbc:shared-ui-date-range-apply', handle_shared_event);
      mount.removeEventListener('wpbc:shared-ui-date-jump-action', handle_shared_event);
      mount.removeEventListener('wpbc:shared-ui-date-jump-select', handle_shared_event);
      if (visual_zoom_frame) {
        window.cancelAnimationFrame(visual_zoom_frame);
      }
      visual_zoom_frame = 0;
      visual_zoom_anchor = null;
      is_initialized = false;
    }

    /**
     * Return the current presentation-only cell-width percentage.
     *
     * This public diagnostic is intentionally read-only and does not expose or
     * modify authoritative Timeline request state.
     *
     * @return {number} Current bounded visual density percentage.
     */
    function get_visual_zoom_percent() {
      return visual_zoom_percent;
    }
    return {
      initialize: initialize,
      destroy: destroy,
      render_controls: render_controls,
      refresh_after_window_render: refresh_after_window_render,
      handle_click: handle_click,
      handle_keydown: handle_keydown,
      apply_range_scale_option: apply_range_scale_option,
      apply_custom_date_range: apply_custom_date_range,
      reset_to_defaults: reset_to_defaults,
      navigate_to_today: navigate_to_today,
      navigate_to_date: navigate_to_date,
      change_visual_zoom: change_visual_zoom,
      get_visual_zoom_percent: get_visual_zoom_percent
    };
  }
  if (window.wpbc_timeline_modules && 'function' === typeof window.wpbc_timeline_modules.register_factory) {
    window.wpbc_timeline_modules.register_factory(module_id, create_toolbar_navigation_controller);
  }
})(window, document, window.wp);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS10aW1lbGluZS9fb3V0L3RpbWVsaW5lLXRvb2xiYXItbmF2aWdhdGlvbi5qcyIsIm5hbWVzIjpbIndpbmRvdyIsImRvY3VtZW50Iiwid3AiLCJtb2R1bGVfaWQiLCJjcmVhdGVfdG9vbGJhcl9uYXZpZ2F0aW9uX2NvbnRyb2xsZXIiLCJjb250ZXh0IiwibW91bnQiLCJzZXR0aW5ncyIsIndpbmRvd19jYWNoZSIsImNhbGxiYWNrcyIsInZpc3VhbF96b29tX2NvbmZpZ3VyYXRpb24iLCJnZXRfdmlzdWFsX3pvb21fY29uZmlndXJhdGlvbiIsInZpc3VhbF96b29tX3BlcmNlbnQiLCJkZWZhdWx0X3BlcmNlbnQiLCJ2aXN1YWxfem9vbV9hbmNob3IiLCJ2aXN1YWxfem9vbV9mcmFtZSIsImlzX2luaXRpYWxpemVkIiwiaW52b2tlX2NhbGxiYWNrIiwiY2FsbGJhY2tfbmFtZSIsImNhbGxiYWNrIiwiY2FsbGJhY2tfYXJndW1lbnRzIiwiQXJyYXkiLCJwcm90b3R5cGUiLCJzbGljZSIsImNhbGwiLCJhcmd1bWVudHMiLCJhcHBseSIsImNvbmZpZ3VyZWQiLCJtZXRhZGF0YSIsInZpc3VhbF96b29tIiwic3RvcmVkX3BlcmNlbnQiLCJwcmVmZXJlbmNlcyIsIk51bWJlciIsIm1pbl9wZXJjZW50IiwiTWF0aCIsIm1heCIsIm1pbiIsInJvdW5kIiwibWF4X3BlcmNlbnQiLCJzdGVwX3BlcmNlbnQiLCJjb25maWd1cmVkX2RlZmF1bHRfcGVyY2VudCIsImdldF9zaGFyZWRfdWlfdGVtcGxhdGUiLCJ0ZW1wbGF0ZV9rZXkiLCJ0ZW1wbGF0ZV9pZCIsInNoYXJlZF91aSIsInRlbXBsYXRlcyIsInRlbXBsYXRlIiwicmVuZGVyX3NoYXJlZF91aV90ZW1wbGF0ZSIsInRhcmdldCIsInZpZXdfbW9kZWwiLCJpbm5lckhUTUwiLCJnZXRfcmFuZ2Vfc2NhbGVfb3B0aW9uIiwib3B0aW9uX3ZhbHVlIiwibWF0Y2hpbmdfb3B0aW9uIiwicmFuZ2Vfc2NhbGVfb3B0aW9ucyIsInNvbWUiLCJyYW5nZV9zY2FsZV9vcHRpb24iLCJTdHJpbmciLCJ2YWx1ZSIsImZvcm1hdF9jdXN0b21fcmFuZ2VfbGFiZWwiLCJyYW5nZV9sYWJlbCIsInNjYWxlX2xhYmVsIiwiaTE4biIsImFkdmFuY2VkX2NvbWJpbmF0aW9uX2Zvcm1hdCIsInJlcGxhY2UiLCJnZXRfbWF0Y2hpbmdfcmFuZ2Vfc2NhbGVfb3B0aW9uX3ZhbHVlIiwibWF0Y2hpbmdfb3B0aW9uX3ZhbHVlIiwiY3VycmVudF92aWV3IiwiY3VycmVudF9heGlzIiwidmlldyIsImF4aXMiLCJvcHRpb25fbW9udGhzIiwid2luZG93X21vbnRocyIsIm1hdGNoZXNfbW9udGhzIiwibWF0Y2hlc19kYXlzIiwid2luZG93X2RheXMiLCJ2aWV3X2lkIiwiZ2V0X29wdGlvbl9sYWJlbCIsIm9wdGlvbnMiLCJzZWxlY3RlZF92YWx1ZSIsImZhbGxiYWNrX2xhYmVsIiwic2VsZWN0ZWRfbGFiZWwiLCJvcHRpb24iLCJpZCIsImxhYmVsIiwiZ2V0X3RpbWVsaW5lX3NjYWxlX2ljb25fY2xhc3MiLCJpbmRleE9mIiwicmVuZGVyX3Rvb2xiYXJfZHJvcGRvd24iLCJob3N0IiwicXVlcnlTZWxlY3RvciIsInNlbGVjdGVkX29wdGlvbiIsImN1cnJlbnRfZ3JvdXAiLCJjdXN0b21fbGFiZWwiLCJjdXN0b21fcmFuZ2UiLCJ2aWV3cyIsInR5cGUiLCJpY29uX2NsYXNzIiwiZGlzYWJsZWQiLCJmb3JFYWNoIiwicHJlc2V0X2lkIiwicHVzaCIsInByZXNldF90aXRsZSIsInRpdGxlIiwiYWR2YW5jZWRfY29tYmluYXRpb25fbGFiZWwiLCJkZXNjcmliZWRfYnkiLCJzaGlmdF9pc29fZGF0ZSIsImlzb19kYXRlIiwiZGF5X2NvdW50IiwibWF0Y2giLCJzaGlmdGVkX2RhdGUiLCJEYXRlIiwiVVRDIiwiZ2V0VVRDRnVsbFllYXIiLCJnZXRVVENNb250aCIsImdldFVUQ0RhdGUiLCJnZXRfY3VycmVudF9heGlzX2RhdGVfcmFuZ2UiLCJzdGFydF9kYXRlIiwic3RhcnRfYXQiLCJleGNsdXNpdmVfZW5kX2RhdGUiLCJlbmRfYXQiLCJlbmRfZGF0ZSIsInJlbmRlcl9kYXRlX3JhbmdlX25hdmlnYXRpb24iLCJkYXRlX3JhbmdlIiwiZmlyc3RfZGF5IiwibWF4aW11bV9zcGFuX2RheXMiLCJsaW1pdHMiLCJtYXhpbXVtX3dpbmRvd19kYXlzIiwicHJldmlvdXNfbGFiZWwiLCJwcmV2aW91c193aW5kb3ciLCJuZXh0X2xhYmVsIiwibmV4dF93aW5kb3ciLCJkaWFsb2dfbGFiZWwiLCJjaG9vc2VfZGF0ZV9yYW5nZSIsInN0YXJ0X2xhYmVsIiwiZW5kX2xhYmVsIiwiYXBwbHlfbGFiZWwiLCJhcHBseV9kYXRlX3JhbmdlIiwicmVzZXRfbGFiZWwiLCJyZXNldF9kYXRlX3JhbmdlIiwiY2FuY2VsX2xhYmVsIiwiY2FuY2VsIiwiaW52YWxpZF9tZXNzYWdlIiwiaW52YWxpZF9kYXRlX3JhbmdlIiwibWF4aW11bV9tZXNzYWdlIiwibWF4aW11bV9kYXRlX3JhbmdlIiwicmVuZGVyX2RhdGVfanVtcCIsImFjdGlvbl9sYWJlbCIsInRvZGF5IiwiY2hvb3NlX2RhdGVfbGFiZWwiLCJjaG9vc2VfanVtcF9kYXRlIiwiZGF0ZV9sYWJlbCIsImp1bXBfZGF0ZSIsInNlbGVjdGVkX2RhdGUiLCJ0b2RheV9kYXRlIiwicmVuZGVyX3Jlc2V0X3ByZWZlcmVuY2VzX2J1dHRvbiIsInJlc2V0X3RpbWVsaW5lIiwiZGVzY3JpcHRpb24iLCJyZXNldF90aW1lbGluZV9kZXNjcmlwdGlvbiIsInN5bmNocm9uaXplX2RhdGVfcmFuZ2VfbmF2aWdhdGlvbiIsInJvb3QiLCJzdGFydF9pbnB1dCIsImVuZF9pbnB1dCIsInRleHRDb250ZW50Iiwic2V0QXR0cmlidXRlIiwic3luY2hyb25pemVfc2hhcmVkX2Ryb3Bkb3duIiwiZHJvcGRvd25fcm9vdCIsImlzX2Rpc2FibGVkIiwiZGlzYWJsZWRfdmFsdWVzIiwidHJpZ2dlciIsInBhbmVsIiwidmFsdWVfbGFiZWwiLCJoaWRkZW5faW5wdXQiLCJxdWVyeVNlbGVjdG9yQWxsIiwiZ2V0QXR0cmlidXRlIiwiaXNfc2VsZWN0ZWQiLCJvcHRpb25fZGlzYWJsZWQiLCJjbGFzc0xpc3QiLCJ0b2dnbGUiLCJoaWRkZW4iLCJyZW1vdmUiLCJ0cmltIiwiYXBwbHlfYXhpc19kaW1lbnNpb25zIiwidGltZWxpbmUiLCJ3aW5kb3dfbG9hZGluZyIsImJhc2VfY2VsbF93aWR0aCIsInZpc3VhbF9jZWxsX3dpZHRoIiwiY2VsbF93aWR0aF9weCIsInN0eWxlIiwic2V0UHJvcGVydHkiLCJjZWxsX2NvdW50IiwiaGVhZGVyX2hlaWdodF9weCIsImVkZ2VfcGxhY2Vob2xkZXJfY2VsbHMiLCJzeW5jaHJvbml6ZV90aW1lX2xhYmVsX3ByZXNlbnRhdGlvbiIsInRpbWVfbGFiZWxzIiwiaGFzX292ZXJmbG93IiwiaXNfdGltZWQiLCJ0aW1lX2xhYmVsIiwic2Nyb2xsV2lkdGgiLCJjbGllbnRXaWR0aCIsIm5vcm1hbGl6ZV92aXN1YWxfem9vbV9wZXJjZW50IiwicmVxdWVzdGVkX3BlcmNlbnQiLCJub3JtYWxpemVkX3BlcmNlbnQiLCJpc0Zpbml0ZSIsInVwZGF0ZV92aXN1YWxfem9vbV9jb250cm9scyIsInN0YXR1cyIsInJhbmdlIiwic3RlcCIsImNoYW5nZV92aXN1YWxfem9vbSIsIm5leHRfcGVyY2VudCIsImNhcHR1cmVfYXhpc19hbmNob3IiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJyZXN0b3JlX2F4aXNfYW5jaG9yIiwiaGFuZGxlX3Zpc3VhbF96b29tX2lucHV0IiwiZXZlbnQiLCJjbG9zZXN0IiwiaGFuZGxlX3Zpc3VhbF96b29tX2NoYW5nZSIsInZpc3VhbF96b29tX3VwZGF0ZWQiLCJjYW5jZWxfYWN0aXZlX3NlbGVjdGlvbiIsIm5hdmlnYXRlX3RvX3RvZGF5IiwibmF2aWdhdGlvbiIsInJlc29sdmVfdG9kYXlfbmF2aWdhdGlvbiIsImFuY2hvciIsImlzX2xvYWRlZCIsInJlZnJlc2hfdG9kYXkiLCJhbmNob3JfZGF0ZSIsImFuY2hvcl9yYXRpbyIsImFuY2hvcl9hdCIsImF0Iiwid2luZG93X3Bvc2l0aW9uIiwibG9hZGluZyIsImxvYWRpbmdfdG9kYXkiLCJjb21wbGV0ZSIsInN0YXR1c19yZWFkeSIsInBlcnNpc3RfcHJlZmVyZW5jZXMiLCJuYXZpZ2F0ZV90b19kYXRlIiwiZ2V0X3RvZGF5X3JlcXVlc3RfYW5jaG9yX3JhdGlvIiwiY3JlYXRlX2xvYWRlZF9kYXRlX2FuY2hvciIsImFubm91bmNlbWVudCIsInNlbGVjdGVkX2RhdGVfbG9hZGVkIiwicmF0aW8iLCJsZWFkaW5nX2NlbGxzX2JlZm9yZSIsInJlc3RvcmVfZm9jdXMiLCJ0YXJnZXRfZGF0ZSIsImxvYWRpbmdfc2VsZWN0ZWRfZGF0ZSIsIm5hdmlnYXRlX3RpbWVsaW5lX3dpbmRvdyIsImRpcmVjdGlvbiIsInVzZV9yZXNwb25zZV9zdGFydCIsImxvYWRpbmdfcHJldmlvdXNfd2luZG93IiwibG9hZGluZ19uZXh0X3dpbmRvdyIsImFwcGx5X3JhbmdlX3NjYWxlX29wdGlvbiIsInJlcXVlc3RfdmFsdWVzIiwibG9hZGluZ190aW1lbGluZV9jb21iaW5hdGlvbiIsImNvbWJpbmF0aW9uX2xvYWRlZCIsImFwcGx5X2N1c3RvbV9kYXRlX3JhbmdlIiwic3RhcnRfbWF0Y2giLCJlbmRfbWF0Y2giLCJzdGFydF9lcG9jaCIsImVuZF9lcG9jaCIsInNwYW5fZGF5cyIsImxvYWRpbmdfZGF0ZV9yYW5nZSIsInJlc2V0X3RvX2RlZmF1bHRzIiwiZGVmYXVsdF9yZXF1ZXN0IiwiZGVmYXVsdF93aW5kb3dfcmVxdWVzdCIsInJlcXVlc3RfcmVzdWx0IiwicmVzZXR0aW5nX3RpbWVsaW5lIiwidGltZWxpbmVfcmVzZXQiLCJCb29sZWFuIiwiaGFuZGxlX3NoYXJlZF9ldmVudCIsImRldGFpbCIsImNvbXBvbmVudF9pZCIsImRhdGUiLCJoYW5kbGVfY2xpY2siLCJ3aW5kb3dfYnV0dG9uIiwicmVzZXRfYnV0dG9uIiwiaGFuZGxlX2tleWRvd24iLCJjZWxsIiwiY2VsbHMiLCJjdXJyZW50X2luZGV4IiwicmVxdWVzdGVkX2luZGV4IiwibmV4dF9pbmRleCIsImtleSIsImxlbmd0aCIsImlzX3J0bCIsInByZXZlbnREZWZhdWx0IiwiZm9jdXMiLCJzY3JvbGxJbnRvVmlldyIsImJsb2NrIiwiaW5saW5lIiwicmVuZGVyX2NvbnRyb2xzIiwicmVmcmVzaF9hZnRlcl93aW5kb3dfcmVuZGVyIiwiZHJvcGRvd24iLCJpbml0aWFsaXplIiwiYWRkRXZlbnRMaXN0ZW5lciIsImRlc3Ryb3kiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwiY2FuY2VsQW5pbWF0aW9uRnJhbWUiLCJnZXRfdmlzdWFsX3pvb21fcGVyY2VudCIsIndwYmNfdGltZWxpbmVfbW9kdWxlcyIsInJlZ2lzdGVyX2ZhY3RvcnkiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLXRpbWVsaW5lL19zcmMvdGltZWxpbmUtdG9vbGJhci1uYXZpZ2F0aW9uLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVGltZWxpbmUgdG9vbGJhciwgZGF0ZSBuYXZpZ2F0aW9uLCBkZW5zaXR5LCBhbmQgYXhpcy1rZXlib2FyZCBjb250cm9sbGVyLlxuICpcbiAqIFNoYXJlZCBVSSBjb21wb25lbnRzIGNvbnRpbnVlIHRvIG93biB0aGVpciByZXVzYWJsZSBkaXNjbG9zdXJlLCBkYXRlcGlja2VyLFxuICogZHJvcGRvd24sIGZvY3VzLCBhbmQga2V5Ym9hcmQgbWVjaGFuaWNzLiBUaGlzIFRpbWVsaW5lLWRvbWFpbiBhZGFwdGVyIG93bnNcbiAqIG9ubHkgdGhlIHNlcnZlci1kZWNsYXJlZCByYW5nZS9zY2FsZSBtYXBwaW5nLCBuYXZpZ2F0aW9uIHJlcXVlc3QgcHJvcG9zYWxzLFxuICogdmlzdWFsIGNlbGwtd2lkdGggc3RhdGUsIGFuZCBtb3ZlbWVudCBiZXR3ZWVuIHJlbmRlcmVkIGF4aXMgY2VsbHMuXG4gKlxuICogQHBhY2thZ2UgQm9va2luZyBDYWxlbmRhclxuICogQHNpbmNlICAgMTIuMC4wXG4gKi9cbiggZnVuY3Rpb24gKCB3aW5kb3csIGRvY3VtZW50LCB3cCApIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdHZhciBtb2R1bGVfaWQgPSAndG9vbGJhcl9uYXZpZ2F0aW9uJztcblxuXHQvKipcblx0ICogQ3JlYXRlIG9uZSBUaW1lbGluZSB0b29sYmFyIGFuZCBuYXZpZ2F0aW9uIGNvbnRyb2xsZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IFRpbWVsaW5lIHNldHRpbmdzLCBtb2R1bGUgcmVmZXJlbmNlcywgYW5kIGNhbGxiYWNrcy5cblx0ICogQHJldHVybiB7T2JqZWN0fSBUb29sYmFyL25hdmlnYXRpb24gbGlmZWN5Y2xlIGFuZCBpbnRlcmFjdGlvbiBBUEkuXG5cdCAqL1xuXHRmdW5jdGlvbiBjcmVhdGVfdG9vbGJhcl9uYXZpZ2F0aW9uX2NvbnRyb2xsZXIoIGNvbnRleHQgKSB7XG5cdFx0dmFyIG1vdW50ID0gY29udGV4dC5tb3VudCB8fCBudWxsO1xuXHRcdHZhciBzZXR0aW5ncyA9IGNvbnRleHQuc2V0dGluZ3MgfHwge307XG5cdFx0dmFyIHdpbmRvd19jYWNoZSA9IGNvbnRleHQud2luZG93X2NhY2hlIHx8IG51bGw7XG5cdFx0dmFyIGNhbGxiYWNrcyA9IGNvbnRleHQuY2FsbGJhY2tzIHx8IHt9O1xuXHRcdHZhciB2aXN1YWxfem9vbV9jb25maWd1cmF0aW9uID0gZ2V0X3Zpc3VhbF96b29tX2NvbmZpZ3VyYXRpb24oKTtcblx0XHR2YXIgdmlzdWFsX3pvb21fcGVyY2VudCA9IHZpc3VhbF96b29tX2NvbmZpZ3VyYXRpb24uZGVmYXVsdF9wZXJjZW50O1xuXHRcdHZhciB2aXN1YWxfem9vbV9hbmNob3IgPSBudWxsO1xuXHRcdHZhciB2aXN1YWxfem9vbV9mcmFtZSA9IDA7XG5cdFx0dmFyIGlzX2luaXRpYWxpemVkID0gZmFsc2U7XG5cblx0XHQvKipcblx0XHQgKiBJbnZva2Ugb25lIG9wdGlvbmFsIHBhZ2UtY29udHJvbGxlciBjYWxsYmFjay5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBjYWxsYmFja19uYW1lIFN0YWJsZSBjYWxsYmFjayBrZXkuXG5cdFx0ICogQHBhcmFtIHsuLi4qfSBjYWxsYmFja19hcmd1bWVudHMgQ2FsbGJhY2sgYXJndW1lbnRzLlxuXHRcdCAqIEByZXR1cm4geyp9IENhbGxiYWNrIHJlc3VsdCBvciBudWxsIHdoZW4gdW5hdmFpbGFibGUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaW52b2tlX2NhbGxiYWNrKCBjYWxsYmFja19uYW1lICkge1xuXHRcdFx0dmFyIGNhbGxiYWNrID0gY2FsbGJhY2tzWyBjYWxsYmFja19uYW1lIF07XG5cdFx0XHR2YXIgY2FsbGJhY2tfYXJndW1lbnRzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIGFyZ3VtZW50cywgMSApO1xuXG5cdFx0XHRyZXR1cm4gJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNhbGxiYWNrID8gY2FsbGJhY2suYXBwbHkoIG51bGwsIGNhbGxiYWNrX2FyZ3VtZW50cyApIDogbnVsbDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBOb3JtYWxpemUgdGhlIGV4ZWN1dGFibGUtZnJlZSB2aXN1YWwgY2VsbC13aWR0aCBjb25maWd1cmF0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBNaW5pbXVtLCBtYXhpbXVtLCBzdGVwLCBhbmQgc2VsZWN0ZWQgZGVmYXVsdCBwZXJjZW50YWdlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF92aXN1YWxfem9vbV9jb25maWd1cmF0aW9uKCkge1xuXHRcdFx0dmFyIGNvbmZpZ3VyZWQgPSBzZXR0aW5ncy5tZXRhZGF0YSAmJiBzZXR0aW5ncy5tZXRhZGF0YS52aXN1YWxfem9vbSA/IHNldHRpbmdzLm1ldGFkYXRhLnZpc3VhbF96b29tIDoge307XG5cdFx0XHR2YXIgc3RvcmVkX3BlcmNlbnQgPSBzZXR0aW5ncy5wcmVmZXJlbmNlcyA/IE51bWJlciggc2V0dGluZ3MucHJlZmVyZW5jZXMudmlzdWFsX3pvb21fcGVyY2VudCApIDogMDtcblx0XHRcdHZhciBtaW5fcGVyY2VudCA9IE1hdGgubWF4KCAzMCwgTWF0aC5taW4oIDMwMCwgTWF0aC5yb3VuZCggTnVtYmVyKCBjb25maWd1cmVkLm1pbl9wZXJjZW50ICkgfHwgMzAgKSApICk7XG5cdFx0XHR2YXIgbWF4X3BlcmNlbnQgPSBNYXRoLm1heCggbWluX3BlcmNlbnQsIE1hdGgubWluKCAzMDAsIE1hdGgucm91bmQoIE51bWJlciggY29uZmlndXJlZC5tYXhfcGVyY2VudCApIHx8IDMwMCApICkgKTtcblx0XHRcdHZhciBzdGVwX3BlcmNlbnQgPSBNYXRoLm1heCggMSwgTWF0aC5taW4oIG1heF9wZXJjZW50IC0gbWluX3BlcmNlbnQgfHwgMSwgTWF0aC5yb3VuZCggTnVtYmVyKCBjb25maWd1cmVkLnN0ZXBfcGVyY2VudCApIHx8IDEwICkgKSApO1xuXHRcdFx0dmFyIGNvbmZpZ3VyZWRfZGVmYXVsdF9wZXJjZW50ID0gTnVtYmVyKCBjb25maWd1cmVkLmRlZmF1bHRfcGVyY2VudCApIHx8IDEwMDtcblx0XHRcdHZhciBkZWZhdWx0X3BlcmNlbnQgPSBzdG9yZWRfcGVyY2VudCB8fCBjb25maWd1cmVkX2RlZmF1bHRfcGVyY2VudDtcblxuXHRcdFx0Y29uZmlndXJlZF9kZWZhdWx0X3BlcmNlbnQgPSBNYXRoLm1heCggbWluX3BlcmNlbnQsIE1hdGgubWluKCBtYXhfcGVyY2VudCwgTWF0aC5yb3VuZCggY29uZmlndXJlZF9kZWZhdWx0X3BlcmNlbnQgKSApICk7XG5cdFx0XHRjb25maWd1cmVkX2RlZmF1bHRfcGVyY2VudCA9IG1pbl9wZXJjZW50ICsgTWF0aC5yb3VuZCggKCBjb25maWd1cmVkX2RlZmF1bHRfcGVyY2VudCAtIG1pbl9wZXJjZW50ICkgLyBzdGVwX3BlcmNlbnQgKSAqIHN0ZXBfcGVyY2VudDtcblx0XHRcdGNvbmZpZ3VyZWRfZGVmYXVsdF9wZXJjZW50ID0gTWF0aC5taW4oIG1heF9wZXJjZW50LCBjb25maWd1cmVkX2RlZmF1bHRfcGVyY2VudCApO1xuXHRcdFx0ZGVmYXVsdF9wZXJjZW50ID0gTWF0aC5tYXgoIG1pbl9wZXJjZW50LCBNYXRoLm1pbiggbWF4X3BlcmNlbnQsIE1hdGgucm91bmQoIGRlZmF1bHRfcGVyY2VudCApICkgKTtcblx0XHRcdGRlZmF1bHRfcGVyY2VudCA9IG1pbl9wZXJjZW50ICsgTWF0aC5yb3VuZCggKCBkZWZhdWx0X3BlcmNlbnQgLSBtaW5fcGVyY2VudCApIC8gc3RlcF9wZXJjZW50ICkgKiBzdGVwX3BlcmNlbnQ7XG5cdFx0XHRkZWZhdWx0X3BlcmNlbnQgPSBNYXRoLm1pbiggbWF4X3BlcmNlbnQsIGRlZmF1bHRfcGVyY2VudCApO1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRtaW5fcGVyY2VudDogbWluX3BlcmNlbnQsXG5cdFx0XHRcdG1heF9wZXJjZW50OiBtYXhfcGVyY2VudCxcblx0XHRcdFx0c3RlcF9wZXJjZW50OiBzdGVwX3BlcmNlbnQsXG5cdFx0XHRcdGNvbmZpZ3VyZWRfZGVmYXVsdF9wZXJjZW50OiBjb25maWd1cmVkX2RlZmF1bHRfcGVyY2VudCxcblx0XHRcdFx0ZGVmYXVsdF9wZXJjZW50OiBkZWZhdWx0X3BlcmNlbnRcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIG9uZSBzZXJ2ZXItZGVjbGFyZWQgc2hhcmVkIFVJIFdvcmRQcmVzcyB0ZW1wbGF0ZSByZW5kZXJlci5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZV9rZXkgU3RhYmxlIHNoYXJlZCBjb21wb25lbnQga2V5LlxuXHRcdCAqIEByZXR1cm4ge0Z1bmN0aW9ufG51bGx9IFdvcmRQcmVzcyB0ZW1wbGF0ZSByZW5kZXJlciBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9zaGFyZWRfdWlfdGVtcGxhdGUoIHRlbXBsYXRlX2tleSApIHtcblx0XHRcdHZhciB0ZW1wbGF0ZV9pZCA9IHNldHRpbmdzLnNoYXJlZF91aSAmJiBzZXR0aW5ncy5zaGFyZWRfdWkudGVtcGxhdGVzXG5cdFx0XHRcdD8gc2V0dGluZ3Muc2hhcmVkX3VpLnRlbXBsYXRlc1sgdGVtcGxhdGVfa2V5IF1cblx0XHRcdFx0OiAnJztcblxuXHRcdFx0aWYgKCAhIHRlbXBsYXRlX2lkIHx8ICEgd3AgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdwLnRlbXBsYXRlICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHdwLnRlbXBsYXRlKCB0ZW1wbGF0ZV9pZCApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbmRlciBvbmUgc2hhcmVkIGNvbXBvbmVudCBpbnRvIGl0cyBUaW1lbGluZS1vd25lZCBob3N0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFbGVtZW50fG51bGx9IHRhcmdldCBEb21haW4tb3duZWQgaG9zdC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGVfa2V5IFNoYXJlZCBjb21wb25lbnQga2V5LlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSB2aWV3X21vZGVsIEV4ZWN1dGFibGUtZnJlZSBjb21wb25lbnQgZGF0YS5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGNvbXBvbmVudCByZW5kZXJlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZW5kZXJfc2hhcmVkX3VpX3RlbXBsYXRlKCB0YXJnZXQsIHRlbXBsYXRlX2tleSwgdmlld19tb2RlbCApIHtcblx0XHRcdHZhciB0ZW1wbGF0ZSA9IGdldF9zaGFyZWRfdWlfdGVtcGxhdGUoIHRlbXBsYXRlX2tleSApO1xuXG5cdFx0XHRpZiAoICEgdGFyZ2V0IHx8ICEgdGVtcGxhdGUgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHRhcmdldC5pbm5lckhUTUwgPSB0ZW1wbGF0ZSggdmlld19tb2RlbCApO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIG9uZSBleGFjdCBzZXJ2ZXItZGVjbGFyZWQgcmFuZ2UtYW5kLXNjYWxlIG9wdGlvbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBvcHRpb25fdmFsdWUgU3RhYmxlIG9wYXF1ZSBvcHRpb24gdmFsdWUuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IE1hdGNoaW5nIG9wdGlvbiBtZXRhZGF0YSBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9yYW5nZV9zY2FsZV9vcHRpb24oIG9wdGlvbl92YWx1ZSApIHtcblx0XHRcdHZhciBtYXRjaGluZ19vcHRpb24gPSBudWxsO1xuXG5cdFx0XHQoIHNldHRpbmdzLm1ldGFkYXRhLnJhbmdlX3NjYWxlX29wdGlvbnMgfHwgW10gKS5zb21lKCBmdW5jdGlvbiAoIHJhbmdlX3NjYWxlX29wdGlvbiApIHtcblx0XHRcdFx0aWYgKCBTdHJpbmcoIHJhbmdlX3NjYWxlX29wdGlvbi52YWx1ZSApID09PSBTdHJpbmcoIG9wdGlvbl92YWx1ZSApICkge1xuXHRcdFx0XHRcdG1hdGNoaW5nX29wdGlvbiA9IHJhbmdlX3NjYWxlX29wdGlvbjtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiBtYXRjaGluZ19vcHRpb247XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRm9ybWF0IHRoZSBmYWxsYmFjayBsYWJlbCBmb3IgYSBjdXN0b20gcmFuZ2UgYW5kIGN1cnJlbnQgc2NhbGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcmFuZ2VfbGFiZWwgRGF0ZS1yYW5nZSBsYWJlbC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gc2NhbGVfbGFiZWwgQ2VsbC1zY2FsZSBsYWJlbC5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IENvbWJpbmVkIHZpc2libGUgbGFiZWwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZm9ybWF0X2N1c3RvbV9yYW5nZV9sYWJlbCggcmFuZ2VfbGFiZWwsIHNjYWxlX2xhYmVsICkge1xuXHRcdFx0cmV0dXJuIFN0cmluZyggc2V0dGluZ3MuaTE4bi5hZHZhbmNlZF9jb21iaW5hdGlvbl9mb3JtYXQgfHwgJyUxJHMg4oCUICUyJHMnIClcblx0XHRcdFx0LnJlcGxhY2UoICclMSRzJywgU3RyaW5nKCByYW5nZV9sYWJlbCB8fCAnJyApIClcblx0XHRcdFx0LnJlcGxhY2UoICclMiRzJywgU3RyaW5nKCBzY2FsZV9sYWJlbCB8fCAnJyApICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBvcHRpb24gbWF0Y2hpbmcgdGhlIGN1cnJlbnQgbG9naWNhbCBzZXJ2ZXIgd2luZG93LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBFeGFjdCBvcHRpb24gdmFsdWUgb3IgYGN1c3RvbWAuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X21hdGNoaW5nX3JhbmdlX3NjYWxlX29wdGlvbl92YWx1ZSgpIHtcblx0XHRcdHZhciBtYXRjaGluZ19vcHRpb25fdmFsdWUgPSAnY3VzdG9tJztcblx0XHRcdHZhciBjdXJyZW50X3ZpZXcgPSBzZXR0aW5ncy5jdXJyZW50X2F4aXMgJiYgc2V0dGluZ3MuY3VycmVudF9heGlzLnZpZXcgPyBzZXR0aW5ncy5jdXJyZW50X2F4aXMudmlldyA6IHNldHRpbmdzLmF4aXMudmlldztcblxuXHRcdFx0KCBzZXR0aW5ncy5tZXRhZGF0YS5yYW5nZV9zY2FsZV9vcHRpb25zIHx8IFtdICkuc29tZSggZnVuY3Rpb24gKCByYW5nZV9zY2FsZV9vcHRpb24gKSB7XG5cdFx0XHRcdHZhciBvcHRpb25fbW9udGhzID0gTnVtYmVyKCByYW5nZV9zY2FsZV9vcHRpb24ud2luZG93X21vbnRocyApO1xuXHRcdFx0XHR2YXIgbWF0Y2hlc19tb250aHMgPSAwIDwgb3B0aW9uX21vbnRocyAmJiBvcHRpb25fbW9udGhzID09PSBOdW1iZXIoIHNldHRpbmdzLndpbmRvdy53aW5kb3dfbW9udGhzICk7XG5cdFx0XHRcdHZhciBtYXRjaGVzX2RheXMgPSAwID09PSBvcHRpb25fbW9udGhzICYmIDAgPT09IE51bWJlciggc2V0dGluZ3Mud2luZG93LndpbmRvd19tb250aHMgKSAmJiBOdW1iZXIoIHJhbmdlX3NjYWxlX29wdGlvbi53aW5kb3dfZGF5cyApID09PSBOdW1iZXIoIHNldHRpbmdzLndpbmRvdy53aW5kb3dfZGF5cyApO1xuXG5cdFx0XHRcdGlmICggU3RyaW5nKCByYW5nZV9zY2FsZV9vcHRpb24udmlld19pZCApID09PSBTdHJpbmcoIGN1cnJlbnRfdmlldyApICYmICggbWF0Y2hlc19tb250aHMgfHwgbWF0Y2hlc19kYXlzICkgKSB7XG5cdFx0XHRcdFx0bWF0Y2hpbmdfb3B0aW9uX3ZhbHVlID0gU3RyaW5nKCByYW5nZV9zY2FsZV9vcHRpb24udmFsdWUgKTtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiBtYXRjaGluZ19vcHRpb25fdmFsdWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIG9uZSBvcHRpb24gbGFiZWwgZnJvbSBvcmRlcmVkIG1ldGFkYXRhLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtBcnJheTxPYmplY3Q+fSBvcHRpb25zIE1ldGFkYXRhIHJlY29yZHMuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHNlbGVjdGVkX3ZhbHVlIFNlbGVjdGVkIGlkZW50aWZpZXIuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGZhbGxiYWNrX2xhYmVsIEZhbGxiYWNrIHdoZW4gbm8gcmVjb3JkIG1hdGNoZXMuXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBTZWxlY3RlZCBkaXNwbGF5IGxhYmVsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9vcHRpb25fbGFiZWwoIG9wdGlvbnMsIHNlbGVjdGVkX3ZhbHVlLCBmYWxsYmFja19sYWJlbCApIHtcblx0XHRcdHZhciBzZWxlY3RlZF9sYWJlbCA9IGZhbGxiYWNrX2xhYmVsIHx8IHNlbGVjdGVkX3ZhbHVlO1xuXG5cdFx0XHQoIG9wdGlvbnMgfHwgW10gKS5zb21lKCBmdW5jdGlvbiAoIG9wdGlvbiApIHtcblx0XHRcdFx0aWYgKCBTdHJpbmcoIG9wdGlvbi5pZCApID09PSBTdHJpbmcoIHNlbGVjdGVkX3ZhbHVlICkgKSB7XG5cdFx0XHRcdFx0c2VsZWN0ZWRfbGFiZWwgPSBvcHRpb24ubGFiZWw7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gc2VsZWN0ZWRfbGFiZWw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBkZWNvcmF0aXZlIGljb24gZm9yIG9uZSBUaW1lbGluZSBjZWxsIHNjYWxlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHZpZXdfaWQgVGltZWxpbmUgdmlldyBpZGVudGlmaWVyLlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gQm9va2luZyBDYWxlbmRhciBpY29uIGNsYXNzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF90aW1lbGluZV9zY2FsZV9pY29uX2NsYXNzKCB2aWV3X2lkICkge1xuXHRcdFx0aWYgKCAnZGF5JyA9PT0gU3RyaW5nKCB2aWV3X2lkICkgKSB7XG5cdFx0XHRcdHJldHVybiAnd3BiYy1iaS1jYWxlbmRhcjMnO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAtMSAhPT0gU3RyaW5nKCB2aWV3X2lkICkuaW5kZXhPZiggJ21pbnV0ZXMnICkgKSB7XG5cdFx0XHRcdHJldHVybiAnd3BiYy1iaS1zdG9wd2F0Y2gnO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuICd3cGJjLWJpLWNsb2NrJztcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgZXhhY3QgVGltZWxpbmUtb3duZWQgcmFuZ2UtYW5kLXNjYWxlIG9wdGlvbnMgdGhyb3VnaCBzaGFyZWQgVUkuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl90b29sYmFyX2Ryb3Bkb3duKCkge1xuXHRcdFx0dmFyIGhvc3QgPSBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1hZHZhbmNlZC1jb21iaW5hdGlvbi1kcm9wZG93bl0nICk7XG5cdFx0XHR2YXIgc2VsZWN0ZWRfdmFsdWUgPSBnZXRfbWF0Y2hpbmdfcmFuZ2Vfc2NhbGVfb3B0aW9uX3ZhbHVlKCk7XG5cdFx0XHR2YXIgc2VsZWN0ZWRfb3B0aW9uID0gZ2V0X3JhbmdlX3NjYWxlX29wdGlvbiggc2VsZWN0ZWRfdmFsdWUgKTtcblx0XHRcdHZhciBjdXJyZW50X3ZpZXcgPSBzZXR0aW5ncy5jdXJyZW50X2F4aXMgJiYgc2V0dGluZ3MuY3VycmVudF9heGlzLnZpZXcgPyBzZXR0aW5ncy5jdXJyZW50X2F4aXMudmlldyA6IHNldHRpbmdzLmF4aXMudmlldztcblx0XHRcdHZhciBjdXJyZW50X2dyb3VwID0gJyc7XG5cdFx0XHR2YXIgY3VzdG9tX2xhYmVsID0gZm9ybWF0X2N1c3RvbV9yYW5nZV9sYWJlbChcblx0XHRcdFx0c2V0dGluZ3MuaTE4bi5jdXN0b21fcmFuZ2UsXG5cdFx0XHRcdGdldF9vcHRpb25fbGFiZWwoIHNldHRpbmdzLm1ldGFkYXRhLnZpZXdzLCBjdXJyZW50X3ZpZXcsIGN1cnJlbnRfdmlldyApXG5cdFx0XHQpO1xuXHRcdFx0dmFyIG9wdGlvbnMgPSBbIHtcblx0XHRcdFx0dHlwZTogJ29wdGlvbicsXG5cdFx0XHRcdHZhbHVlOiAnY3VzdG9tJyxcblx0XHRcdFx0bGFiZWw6IGN1c3RvbV9sYWJlbCxcblx0XHRcdFx0aWNvbl9jbGFzczogZ2V0X3RpbWVsaW5lX3NjYWxlX2ljb25fY2xhc3MoIGN1cnJlbnRfdmlldyApLFxuXHRcdFx0XHRkaXNhYmxlZDogdHJ1ZVxuXHRcdFx0fSBdO1xuXG5cdFx0XHQoIHNldHRpbmdzLm1ldGFkYXRhLnJhbmdlX3NjYWxlX29wdGlvbnMgfHwgW10gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHJhbmdlX3NjYWxlX29wdGlvbiApIHtcblx0XHRcdFx0aWYgKCBjdXJyZW50X2dyb3VwICE9PSBTdHJpbmcoIHJhbmdlX3NjYWxlX29wdGlvbi5wcmVzZXRfaWQgKSApIHtcblx0XHRcdFx0XHRjdXJyZW50X2dyb3VwID0gU3RyaW5nKCByYW5nZV9zY2FsZV9vcHRpb24ucHJlc2V0X2lkICk7XG5cdFx0XHRcdFx0b3B0aW9ucy5wdXNoKCB7IHR5cGU6ICdzZXBhcmF0b3InIH0gKTtcblx0XHRcdFx0XHRvcHRpb25zLnB1c2goIHsgdHlwZTogJ2hlYWRpbmcnLCBsYWJlbDogcmFuZ2Vfc2NhbGVfb3B0aW9uLnByZXNldF90aXRsZSB9ICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0b3B0aW9ucy5wdXNoKCB7XG5cdFx0XHRcdFx0dHlwZTogJ29wdGlvbicsXG5cdFx0XHRcdFx0dmFsdWU6IHJhbmdlX3NjYWxlX29wdGlvbi52YWx1ZSxcblx0XHRcdFx0XHRsYWJlbDogcmFuZ2Vfc2NhbGVfb3B0aW9uLnRpdGxlLFxuXHRcdFx0XHRcdGljb25fY2xhc3M6IGdldF90aW1lbGluZV9zY2FsZV9pY29uX2NsYXNzKCByYW5nZV9zY2FsZV9vcHRpb24udmlld19pZCApLFxuXHRcdFx0XHRcdGRpc2FibGVkOiBmYWxzZVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRyZW5kZXJfc2hhcmVkX3VpX3RlbXBsYXRlKCBob3N0LCAnZHJvcGRvd24nLCB7XG5cdFx0XHRcdGlkOiAnd3BiY190aW1lbGluZV9hZHZhbmNlZF9jb21iaW5hdGlvbicsXG5cdFx0XHRcdGxhYmVsOiBzZXR0aW5ncy5pMThuLmFkdmFuY2VkX2NvbWJpbmF0aW9uX2xhYmVsLFxuXHRcdFx0XHRkZXNjcmliZWRfYnk6ICd3cGJjX3RpbWVsaW5lX2FkdmFuY2VkX2NvbWJpbmF0aW9uX2Rlc2NyaXB0aW9uJyxcblx0XHRcdFx0c2VsZWN0ZWRfdmFsdWU6IHNlbGVjdGVkX3ZhbHVlLFxuXHRcdFx0XHRzZWxlY3RlZF9sYWJlbDogc2VsZWN0ZWRfb3B0aW9uID8gc2VsZWN0ZWRfb3B0aW9uLnRpdGxlIDogY3VzdG9tX2xhYmVsLFxuXHRcdFx0XHRpY29uX2NsYXNzOiBnZXRfdGltZWxpbmVfc2NhbGVfaWNvbl9jbGFzcyggY3VycmVudF92aWV3ICksXG5cdFx0XHRcdG9wdGlvbnM6IG9wdGlvbnNcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTaGlmdCBvbmUgc3RyaWN0IElTTyBkYXRlIGJ5IHdob2xlIFVUQyBjYWxlbmRhciBkYXlzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGlzb19kYXRlIFlZWVktTU0tREQgZGF0ZS5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gZGF5X2NvdW50IFNpZ25lZCBkYXkgY291bnQuXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBTaGlmdGVkIFlZWVktTU0tREQgZGF0ZSwgb3IgYW4gZW1wdHkgc3RyaW5nLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNoaWZ0X2lzb19kYXRlKCBpc29fZGF0ZSwgZGF5X2NvdW50ICkge1xuXHRcdFx0dmFyIG1hdGNoID0gU3RyaW5nKCBpc29fZGF0ZSB8fCAnJyApLm1hdGNoKCAvXihcXGR7NH0pLShcXGR7Mn0pLShcXGR7Mn0pJC8gKTtcblx0XHRcdHZhciBzaGlmdGVkX2RhdGU7XG5cblx0XHRcdGlmICggISBtYXRjaCApIHtcblx0XHRcdFx0cmV0dXJuICcnO1xuXHRcdFx0fVxuXHRcdFx0c2hpZnRlZF9kYXRlID0gbmV3IERhdGUoIERhdGUuVVRDKCBOdW1iZXIoIG1hdGNoWyAxIF0gKSwgTnVtYmVyKCBtYXRjaFsgMiBdICkgLSAxLCBOdW1iZXIoIG1hdGNoWyAzIF0gKSArIGRheV9jb3VudCApICk7XG5cdFx0XHRyZXR1cm4gc2hpZnRlZF9kYXRlLmdldFVUQ0Z1bGxZZWFyKCkgKyAnLScgKyAoICcwJyArIFN0cmluZyggc2hpZnRlZF9kYXRlLmdldFVUQ01vbnRoKCkgKyAxICkgKS5zbGljZSggLTIgKSArICctJyArICggJzAnICsgU3RyaW5nKCBzaGlmdGVkX2RhdGUuZ2V0VVRDRGF0ZSgpICkgKS5zbGljZSggLTIgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gaW5jbHVzaXZlIGRhdGUgdmFsdWVzIGZvciB0aGUgY3VycmVudCBoYWxmLW9wZW4gc2VydmVyIGF4aXMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IEluY2x1c2l2ZSBzdGFydCBhbmQgZW5kIFlZWVktTU0tREQgdmFsdWVzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9jdXJyZW50X2F4aXNfZGF0ZV9yYW5nZSgpIHtcblx0XHRcdHZhciBheGlzID0gc2V0dGluZ3MuY3VycmVudF9heGlzIHx8IHNldHRpbmdzLmF4aXMgfHwge307XG5cdFx0XHR2YXIgc3RhcnRfZGF0ZSA9IFN0cmluZyggYXhpcy5zdGFydF9hdCB8fCAnJyApLnNsaWNlKCAwLCAxMCApO1xuXHRcdFx0dmFyIGV4Y2x1c2l2ZV9lbmRfZGF0ZSA9IFN0cmluZyggYXhpcy5lbmRfYXQgfHwgJycgKS5zbGljZSggMCwgMTAgKTtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0c3RhcnRfZGF0ZTogc3RhcnRfZGF0ZSxcblx0XHRcdFx0ZW5kX2RhdGU6IHNoaWZ0X2lzb19kYXRlKCBleGNsdXNpdmVfZW5kX2RhdGUsIC0xIClcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVuZGVyIFRpbWVsaW5lIGRhdGVzIHRocm91Z2ggdGhlIHNoYXJlZCByYW5nZS1uYXZpZ2F0aW9uIGNvbXBvbmVudC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX2RhdGVfcmFuZ2VfbmF2aWdhdGlvbigpIHtcblx0XHRcdHZhciBob3N0ID0gbW91bnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtZGF0ZS1yYW5nZS1uYXZpZ2F0aW9uXScgKTtcblx0XHRcdHZhciBkYXRlX3JhbmdlID0gZ2V0X2N1cnJlbnRfYXhpc19kYXRlX3JhbmdlKCk7XG5cblx0XHRcdHJlbmRlcl9zaGFyZWRfdWlfdGVtcGxhdGUoIGhvc3QsICdkYXRlX3JhbmdlX25hdmlnYXRpb24nLCB7XG5cdFx0XHRcdGlkOiAnd3BiY190aW1lbGluZV9kYXRlX3JhbmdlJyxcblx0XHRcdFx0cmFuZ2VfbGFiZWw6IHNldHRpbmdzLmN1cnJlbnRfYXhpcyAmJiBzZXR0aW5ncy5jdXJyZW50X2F4aXMucmFuZ2VfbGFiZWwgPyBzZXR0aW5ncy5jdXJyZW50X2F4aXMucmFuZ2VfbGFiZWwgOiBzZXR0aW5ncy5heGlzLnJhbmdlX2xhYmVsLFxuXHRcdFx0XHRzdGFydF9kYXRlOiBkYXRlX3JhbmdlLnN0YXJ0X2RhdGUsXG5cdFx0XHRcdGVuZF9kYXRlOiBkYXRlX3JhbmdlLmVuZF9kYXRlLFxuXHRcdFx0XHRmaXJzdF9kYXk6IHNldHRpbmdzLnNoYXJlZF91aSA/IE51bWJlciggc2V0dGluZ3Muc2hhcmVkX3VpLmZpcnN0X2RheSApIHx8IDAgOiAwLFxuXHRcdFx0XHRtYXhpbXVtX3NwYW5fZGF5czogc2V0dGluZ3MubWV0YWRhdGEgJiYgc2V0dGluZ3MubWV0YWRhdGEubGltaXRzID8gTnVtYmVyKCBzZXR0aW5ncy5tZXRhZGF0YS5saW1pdHMubWF4aW11bV93aW5kb3dfZGF5cyApIHx8IDYyIDogNjIsXG5cdFx0XHRcdHByZXZpb3VzX2xhYmVsOiBzZXR0aW5ncy5pMThuLnByZXZpb3VzX3dpbmRvdyxcblx0XHRcdFx0bmV4dF9sYWJlbDogc2V0dGluZ3MuaTE4bi5uZXh0X3dpbmRvdyxcblx0XHRcdFx0ZGlhbG9nX2xhYmVsOiBzZXR0aW5ncy5pMThuLmNob29zZV9kYXRlX3JhbmdlLFxuXHRcdFx0XHRzdGFydF9sYWJlbDogc2V0dGluZ3MuaTE4bi5zdGFydF9kYXRlLFxuXHRcdFx0XHRlbmRfbGFiZWw6IHNldHRpbmdzLmkxOG4uZW5kX2RhdGUsXG5cdFx0XHRcdGFwcGx5X2xhYmVsOiBzZXR0aW5ncy5pMThuLmFwcGx5X2RhdGVfcmFuZ2UsXG5cdFx0XHRcdHJlc2V0X2xhYmVsOiBzZXR0aW5ncy5pMThuLnJlc2V0X2RhdGVfcmFuZ2UsXG5cdFx0XHRcdGNhbmNlbF9sYWJlbDogc2V0dGluZ3MuaTE4bi5jYW5jZWwsXG5cdFx0XHRcdGludmFsaWRfbWVzc2FnZTogc2V0dGluZ3MuaTE4bi5pbnZhbGlkX2RhdGVfcmFuZ2UsXG5cdFx0XHRcdG1heGltdW1fbWVzc2FnZTogc2V0dGluZ3MuaTE4bi5tYXhpbXVtX2RhdGVfcmFuZ2Vcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgdGhlIHNoYXJlZCBUb2RheS9zaW5nbGUtZGF0ZSBzcGxpdCBjb250cm9sLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZW5kZXJfZGF0ZV9qdW1wKCkge1xuXHRcdFx0dmFyIGhvc3QgPSBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1kYXRlLWp1bXBdJyApO1xuXG5cdFx0XHRyZW5kZXJfc2hhcmVkX3VpX3RlbXBsYXRlKCBob3N0LCAnZGF0ZV9qdW1wJywge1xuXHRcdFx0XHRpZDogJ3dwYmNfdGltZWxpbmVfZGF0ZV9qdW1wJyxcblx0XHRcdFx0YWN0aW9uX2xhYmVsOiBzZXR0aW5ncy5pMThuLnRvZGF5LFxuXHRcdFx0XHRjaG9vc2VfZGF0ZV9sYWJlbDogc2V0dGluZ3MuaTE4bi5jaG9vc2VfanVtcF9kYXRlLFxuXHRcdFx0XHRkYXRlX2xhYmVsOiBzZXR0aW5ncy5pMThuLmp1bXBfZGF0ZSxcblx0XHRcdFx0c2VsZWN0ZWRfZGF0ZTogc2V0dGluZ3Muc2hhcmVkX3VpID8gU3RyaW5nKCBzZXR0aW5ncy5zaGFyZWRfdWkudG9kYXlfZGF0ZSB8fCAnJyApIDogJycsXG5cdFx0XHRcdGZpcnN0X2RheTogc2V0dGluZ3Muc2hhcmVkX3VpID8gTnVtYmVyKCBzZXR0aW5ncy5zaGFyZWRfdWkuZmlyc3RfZGF5ICkgfHwgMCA6IDBcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgdGhlIFRpbWVsaW5lIFJlc2V0IGFjdGlvbiB0aHJvdWdoIHRoZSBzaGFyZWQgY29udHJvbCBidXR0b24uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9yZXNldF9wcmVmZXJlbmNlc19idXR0b24oKSB7XG5cdFx0XHR2YXIgaG9zdCA9IG1vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLXJlc2V0LXByZWZlcmVuY2VzLWhvc3RdJyApO1xuXG5cdFx0XHRyZW5kZXJfc2hhcmVkX3VpX3RlbXBsYXRlKCBob3N0LCAnY29udGV4dF9wb3BvdmVyX2J1dHRvbicsIHtcblx0XHRcdFx0aWQ6ICd3cGJjX3RpbWVsaW5lX3Jlc2V0X3ByZWZlcmVuY2VzJyxcblx0XHRcdFx0bGFiZWw6IHNldHRpbmdzLmkxOG4ucmVzZXRfdGltZWxpbmUsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBzZXR0aW5ncy5pMThuLnJlc2V0X3RpbWVsaW5lX2Rlc2NyaXB0aW9uLFxuXHRcdFx0XHRpY29uX2NsYXNzOiAnd3BiY19pY25fcmVmcmVzaCcsXG5cdFx0XHRcdGRpc2FibGVkOiBmYWxzZVxuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN5bmNocm9uaXplIHJlbmRlcmVkIHJhbmdlIHZhbHVlcyB3aXRob3V0IHJlcGxhY2luZyBmb2N1c2VkIG1hcmt1cC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3luY2hyb25pemVfZGF0ZV9yYW5nZV9uYXZpZ2F0aW9uKCkge1xuXHRcdFx0dmFyIHJvb3QgPSBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zaGFyZWQtdWktZGF0ZS1yYW5nZS1uYXZpZ2F0aW9uPVwid3BiY190aW1lbGluZV9kYXRlX3JhbmdlXCJdJyApO1xuXHRcdFx0dmFyIHJhbmdlX2xhYmVsID0gcm9vdCA/IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2hhcmVkLXVpLWRhdGUtcmFuZ2UtbGFiZWxdJyApIDogbnVsbDtcblx0XHRcdHZhciBzdGFydF9pbnB1dCA9IHJvb3QgPyByb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNoYXJlZC11aS1kYXRlLXJhbmdlLXN0YXJ0XScgKSA6IG51bGw7XG5cdFx0XHR2YXIgZW5kX2lucHV0ID0gcm9vdCA/IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2hhcmVkLXVpLWRhdGUtcmFuZ2UtZW5kXScgKSA6IG51bGw7XG5cdFx0XHR2YXIgZGF0ZV9yYW5nZSA9IGdldF9jdXJyZW50X2F4aXNfZGF0ZV9yYW5nZSgpO1xuXG5cdFx0XHRpZiAoICEgcm9vdCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCByYW5nZV9sYWJlbCApIHtcblx0XHRcdFx0cmFuZ2VfbGFiZWwudGV4dENvbnRlbnQgPSBzZXR0aW5ncy5jdXJyZW50X2F4aXMgJiYgc2V0dGluZ3MuY3VycmVudF9heGlzLnJhbmdlX2xhYmVsID8gc2V0dGluZ3MuY3VycmVudF9heGlzLnJhbmdlX2xhYmVsIDogc2V0dGluZ3MuYXhpcy5yYW5nZV9sYWJlbDtcblx0XHRcdH1cblx0XHRcdHJvb3Quc2V0QXR0cmlidXRlKCAnZGF0YS1zdGFydC1kYXRlJywgZGF0ZV9yYW5nZS5zdGFydF9kYXRlICk7XG5cdFx0XHRyb290LnNldEF0dHJpYnV0ZSggJ2RhdGEtZW5kLWRhdGUnLCBkYXRlX3JhbmdlLmVuZF9kYXRlICk7XG5cdFx0XHRpZiAoIHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2hhcmVkLXVpLXBvcG92ZXJdLmlzLW9wZW4nICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggc3RhcnRfaW5wdXQgKSB7XG5cdFx0XHRcdHN0YXJ0X2lucHV0LnZhbHVlID0gZGF0ZV9yYW5nZS5zdGFydF9kYXRlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBlbmRfaW5wdXQgKSB7XG5cdFx0XHRcdGVuZF9pbnB1dC52YWx1ZSA9IGRhdGVfcmFuZ2UuZW5kX2RhdGU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3luY2hyb25pemUgYSBzaGFyZWQgZHJvcGRvd24gd2l0aG91dCByZXBsYWNpbmcgaXRzIGZvY3VzZWQgRE9NLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSBkcm9wZG93bl9yb290IFNoYXJlZCBkcm9wZG93biByb290LlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBzZWxlY3RlZF92YWx1ZSBTZWxlY3RlZCBvcHRpb24gdmFsdWUuXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBpc19kaXNhYmxlZCBXaGV0aGVyIHRoZSB0cmlnZ2VyIGlzIGRpc2FibGVkLlxuXHRcdCAqIEBwYXJhbSB7QXJyYXk8c3RyaW5nPn0gZGlzYWJsZWRfdmFsdWVzIE9wdGlvbiB2YWx1ZXMgdG8gZGlzYWJsZS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHN5bmNocm9uaXplX3NoYXJlZF9kcm9wZG93biggZHJvcGRvd25fcm9vdCwgc2VsZWN0ZWRfdmFsdWUsIGlzX2Rpc2FibGVkLCBkaXNhYmxlZF92YWx1ZXMgKSB7XG5cdFx0XHR2YXIgdHJpZ2dlcjtcblx0XHRcdHZhciBwYW5lbDtcblx0XHRcdHZhciB2YWx1ZV9sYWJlbDtcblx0XHRcdHZhciBoaWRkZW5faW5wdXQ7XG5cdFx0XHR2YXIgc2VsZWN0ZWRfb3B0aW9uID0gbnVsbDtcblxuXHRcdFx0aWYgKCAhIGRyb3Bkb3duX3Jvb3QgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRyaWdnZXIgPSBkcm9wZG93bl9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNoYXJlZC11aS1kcm9wZG93bi10cmlnZ2VyXScgKTtcblx0XHRcdHBhbmVsID0gZHJvcGRvd25fcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zaGFyZWQtdWktZHJvcGRvd24tcGFuZWxdJyApO1xuXHRcdFx0dmFsdWVfbGFiZWwgPSBkcm9wZG93bl9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNoYXJlZC11aS1kcm9wZG93bi1sYWJlbF0nICk7XG5cdFx0XHRoaWRkZW5faW5wdXQgPSBkcm9wZG93bl9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNoYXJlZC11aS1kcm9wZG93bi1pbnB1dF0nICk7XG5cdFx0XHRkcm9wZG93bl9yb290LnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1zaGFyZWQtdWktZHJvcGRvd24tdmFsdWUnLCBzZWxlY3RlZF92YWx1ZSApO1xuXHRcdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCggZHJvcGRvd25fcm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1zaGFyZWQtdWktZHJvcGRvd24tb3B0aW9uXScgKSwgZnVuY3Rpb24gKCBvcHRpb24gKSB7XG5cdFx0XHRcdHZhciBvcHRpb25fdmFsdWUgPSBvcHRpb24uZ2V0QXR0cmlidXRlKCAnZGF0YS12YWx1ZScgKSB8fCAnJztcblx0XHRcdFx0dmFyIGlzX3NlbGVjdGVkID0gb3B0aW9uX3ZhbHVlID09PSBzZWxlY3RlZF92YWx1ZTtcblx0XHRcdFx0dmFyIG9wdGlvbl9kaXNhYmxlZCA9IC0xICE9PSBkaXNhYmxlZF92YWx1ZXMuaW5kZXhPZiggb3B0aW9uX3ZhbHVlICk7XG5cblx0XHRcdFx0b3B0aW9uLmNsYXNzTGlzdC50b2dnbGUoICdpcy1zZWxlY3RlZCcsIGlzX3NlbGVjdGVkICk7XG5cdFx0XHRcdG9wdGlvbi5zZXRBdHRyaWJ1dGUoICdhcmlhLXNlbGVjdGVkJywgaXNfc2VsZWN0ZWQgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0XHRcdG9wdGlvbi5kaXNhYmxlZCA9IG9wdGlvbl9kaXNhYmxlZDtcblx0XHRcdFx0b3B0aW9uLnNldEF0dHJpYnV0ZSggJ2FyaWEtZGlzYWJsZWQnLCBvcHRpb25fZGlzYWJsZWQgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0XHRcdGlmICggaXNfc2VsZWN0ZWQgKSB7XG5cdFx0XHRcdFx0c2VsZWN0ZWRfb3B0aW9uID0gb3B0aW9uO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIHRyaWdnZXIgKSB7XG5cdFx0XHRcdHRyaWdnZXIuZGlzYWJsZWQgPSBpc19kaXNhYmxlZDtcblx0XHRcdFx0aWYgKCBpc19kaXNhYmxlZCApIHtcblx0XHRcdFx0XHR0cmlnZ2VyLnNldEF0dHJpYnV0ZSggJ2FyaWEtZXhwYW5kZWQnLCAnZmFsc2UnICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggcGFuZWwgJiYgaXNfZGlzYWJsZWQgKSB7XG5cdFx0XHRcdHBhbmVsLmhpZGRlbiA9IHRydWU7XG5cdFx0XHRcdGRyb3Bkb3duX3Jvb3QuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLW9wZW4nICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHZhbHVlX2xhYmVsICYmIHNlbGVjdGVkX29wdGlvbiApIHtcblx0XHRcdFx0dmFsdWVfbGFiZWwudGV4dENvbnRlbnQgPSBzZWxlY3RlZF9vcHRpb24udGV4dENvbnRlbnQudHJpbSgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBoaWRkZW5faW5wdXQgKSB7XG5cdFx0XHRcdGhpZGRlbl9pbnB1dC52YWx1ZSA9IHNlbGVjdGVkX3ZhbHVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFwcGx5IHRoZSBzZXJ2ZXIgYXhpcyBkaW1lbnNpb25zIGFuZCBwcmVzZW50YXRpb24tb25seSBkZW5zaXR5LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBhcHBseV9heGlzX2RpbWVuc2lvbnMoKSB7XG5cdFx0XHR2YXIgdGltZWxpbmUgPSBtb3VudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfdGltZWxpbmUnICk7XG5cdFx0XHR2YXIgd2luZG93X2xvYWRpbmcgPSBzZXR0aW5ncy5tZXRhZGF0YSAmJiBzZXR0aW5ncy5tZXRhZGF0YS53aW5kb3dfbG9hZGluZyA/IHNldHRpbmdzLm1ldGFkYXRhLndpbmRvd19sb2FkaW5nIDoge307XG5cdFx0XHR2YXIgYmFzZV9jZWxsX3dpZHRoO1xuXHRcdFx0dmFyIHZpc3VhbF9jZWxsX3dpZHRoO1xuXG5cdFx0XHRpZiAoICEgdGltZWxpbmUgfHwgISBzZXR0aW5ncy5heGlzICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRiYXNlX2NlbGxfd2lkdGggPSBOdW1iZXIoIHNldHRpbmdzLmF4aXMuY2VsbF93aWR0aF9weCApIHx8IDk2O1xuXHRcdFx0dmlzdWFsX2NlbGxfd2lkdGggPSBNYXRoLm1heCggMSwgTWF0aC5yb3VuZCggYmFzZV9jZWxsX3dpZHRoICogdmlzdWFsX3pvb21fcGVyY2VudCAvIDEwMCApICk7XG5cdFx0XHR0aW1lbGluZS5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiYy10aW1lbGluZS1jZWxscycsIE51bWJlciggc2V0dGluZ3MuYXhpcy5jZWxsX2NvdW50ICkgfHwgMSApO1xuXHRcdFx0dGltZWxpbmUuc3R5bGUuc2V0UHJvcGVydHkoICctLXdwYmMtdGltZWxpbmUtY2VsbC13aWR0aCcsIHZpc3VhbF9jZWxsX3dpZHRoICsgJ3B4JyApO1xuXHRcdFx0dGltZWxpbmUuc3R5bGUuc2V0UHJvcGVydHkoICctLXdwYmMtdGltZWxpbmUtdmlzdWFsLXpvb20nLCB2aXN1YWxfem9vbV9wZXJjZW50ICk7XG5cdFx0XHR0aW1lbGluZS5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiY190aW1lbGluZV9nZW5lcmFsX19yZXNvdXJjZS1oZWFkZXItaGVpZ2h0JywgKCBOdW1iZXIoIHNldHRpbmdzLmF4aXMuaGVhZGVyX2hlaWdodF9weCApIHx8IDk2ICkgKyAncHgnICk7XG5cdFx0XHR0aW1lbGluZS5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiY190aW1lbGluZV9nZW5lcmFsX19lZGdlLXBsYWNlaG9sZGVyLWNlbGxzJywgTWF0aC5tYXgoIDEsIE51bWJlciggd2luZG93X2xvYWRpbmcuZWRnZV9wbGFjZWhvbGRlcl9jZWxscyApIHx8IDMgKSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNlbGVjdCBjb21wYWN0IHZlcnRpY2FsIHRpbWVkIGxhYmVscyBvbmx5IHdoZW4gbG9jYWxpemVkIHRleHQgaXMgY2xpcHBlZC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3luY2hyb25pemVfdGltZV9sYWJlbF9wcmVzZW50YXRpb24oKSB7XG5cdFx0XHR2YXIgdGltZWxpbmUgPSBtb3VudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfdGltZWxpbmUnICk7XG5cdFx0XHR2YXIgdGltZV9sYWJlbHM7XG5cdFx0XHR2YXIgaGFzX292ZXJmbG93ID0gZmFsc2U7XG5cblx0XHRcdGlmICggISB0aW1lbGluZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGltZWxpbmUuY2xhc3NMaXN0LnJlbW92ZSggJ2hhcy12ZXJ0aWNhbC10aW1lLWxhYmVscycgKTtcblx0XHRcdGlmICggISBzZXR0aW5ncy5heGlzIHx8ICEgc2V0dGluZ3MuYXhpcy5pc190aW1lZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGltZV9sYWJlbHMgPSB0aW1lbGluZS5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfdGltZWxpbmVfX3RpbWVfbGFiZWwsIC53cGJjX3RpbWVsaW5lX19vZmZzZXRfbGFiZWwnICk7XG5cdFx0XHRBcnJheS5wcm90b3R5cGUuc29tZS5jYWxsKCB0aW1lX2xhYmVscywgZnVuY3Rpb24gKCB0aW1lX2xhYmVsICkge1xuXHRcdFx0XHRoYXNfb3ZlcmZsb3cgPSB0aW1lX2xhYmVsLnNjcm9sbFdpZHRoID4gdGltZV9sYWJlbC5jbGllbnRXaWR0aDtcblx0XHRcdFx0cmV0dXJuIGhhc19vdmVyZmxvdztcblx0XHRcdH0gKTtcblx0XHRcdHRpbWVsaW5lLmNsYXNzTGlzdC50b2dnbGUoICdoYXMtdmVydGljYWwtdGltZS1sYWJlbHMnLCBoYXNfb3ZlcmZsb3cgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBOb3JtYWxpemUgYSByZXF1ZXN0ZWQgdmlzdWFsIGNlbGwtd2lkdGggcGVyY2VudGFnZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gcmVxdWVzdGVkX3BlcmNlbnQgVW50cnVzdGVkIHJhbmdlLWNvbnRyb2wgdmFsdWUuXG5cdFx0ICogQHJldHVybiB7bnVtYmVyfSBCb3VuZGVkIHBlcmNlbnRhZ2UgYWxpZ25lZCB0byB0aGUgY29uZmlndXJlZCBzdGVwLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG5vcm1hbGl6ZV92aXN1YWxfem9vbV9wZXJjZW50KCByZXF1ZXN0ZWRfcGVyY2VudCApIHtcblx0XHRcdHZhciBub3JtYWxpemVkX3BlcmNlbnQgPSBOdW1iZXIoIHJlcXVlc3RlZF9wZXJjZW50ICk7XG5cblx0XHRcdGlmICggISBOdW1iZXIuaXNGaW5pdGUoIG5vcm1hbGl6ZWRfcGVyY2VudCApICkge1xuXHRcdFx0XHRyZXR1cm4gdmlzdWFsX3pvb21fcGVyY2VudDtcblx0XHRcdH1cblx0XHRcdG5vcm1hbGl6ZWRfcGVyY2VudCA9IE1hdGgubWF4KCB2aXN1YWxfem9vbV9jb25maWd1cmF0aW9uLm1pbl9wZXJjZW50LCBNYXRoLm1pbiggdmlzdWFsX3pvb21fY29uZmlndXJhdGlvbi5tYXhfcGVyY2VudCwgbm9ybWFsaXplZF9wZXJjZW50ICkgKTtcblx0XHRcdG5vcm1hbGl6ZWRfcGVyY2VudCA9IHZpc3VhbF96b29tX2NvbmZpZ3VyYXRpb24ubWluX3BlcmNlbnQgKyBNYXRoLnJvdW5kKCAoIG5vcm1hbGl6ZWRfcGVyY2VudCAtIHZpc3VhbF96b29tX2NvbmZpZ3VyYXRpb24ubWluX3BlcmNlbnQgKSAvIHZpc3VhbF96b29tX2NvbmZpZ3VyYXRpb24uc3RlcF9wZXJjZW50ICkgKiB2aXN1YWxfem9vbV9jb25maWd1cmF0aW9uLnN0ZXBfcGVyY2VudDtcblxuXHRcdFx0cmV0dXJuIE1hdGgubWluKCB2aXN1YWxfem9vbV9jb25maWd1cmF0aW9uLm1heF9wZXJjZW50LCBub3JtYWxpemVkX3BlcmNlbnQgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTeW5jaHJvbml6ZSB0aGUgZGVuc2l0eSByYW5nZSBhbmQgaXRzIHZpc2libGUgdmFsdWUuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHVwZGF0ZV92aXN1YWxfem9vbV9jb250cm9scygpIHtcblx0XHRcdHZhciBzdGF0dXMgPSBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS12aXN1YWwtem9vbS1zdGF0dXNdJyApO1xuXHRcdFx0dmFyIHJhbmdlID0gbW91bnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtdmlzdWFsLXpvb20tcmFuZ2VdJyApO1xuXG5cdFx0XHRpZiAoIHN0YXR1cyApIHtcblx0XHRcdFx0c3RhdHVzLnRleHRDb250ZW50ID0gdmlzdWFsX3pvb21fcGVyY2VudCArICclJztcblx0XHRcdH1cblx0XHRcdGlmICggcmFuZ2UgKSB7XG5cdFx0XHRcdHJhbmdlLm1pbiA9IHZpc3VhbF96b29tX2NvbmZpZ3VyYXRpb24ubWluX3BlcmNlbnQ7XG5cdFx0XHRcdHJhbmdlLm1heCA9IHZpc3VhbF96b29tX2NvbmZpZ3VyYXRpb24ubWF4X3BlcmNlbnQ7XG5cdFx0XHRcdHJhbmdlLnN0ZXAgPSB2aXN1YWxfem9vbV9jb25maWd1cmF0aW9uLnN0ZXBfcGVyY2VudDtcblx0XHRcdFx0cmFuZ2UudmFsdWUgPSB2aXN1YWxfem9vbV9wZXJjZW50O1xuXHRcdFx0XHRyYW5nZS5zZXRBdHRyaWJ1dGUoICdhcmlhLXZhbHVldGV4dCcsIHZpc3VhbF96b29tX3BlcmNlbnQgKyAnJScgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDaGFuZ2Ugb25seSB0aGUgcmVuZGVyZWQgY2VsbCB3aWR0aCBhbmQgcmV0YWluIHRoZSB2aXNpYmxlIGluc3RhbnQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IHJlcXVlc3RlZF9wZXJjZW50IFJlcXVlc3RlZCB2aXN1YWwgd2lkdGggcGVyY2VudGFnZS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNoYW5nZV92aXN1YWxfem9vbSggcmVxdWVzdGVkX3BlcmNlbnQgKSB7XG5cdFx0XHR2YXIgbmV4dF9wZXJjZW50ID0gbm9ybWFsaXplX3Zpc3VhbF96b29tX3BlcmNlbnQoIHJlcXVlc3RlZF9wZXJjZW50ICk7XG5cblx0XHRcdGlmICggbmV4dF9wZXJjZW50ID09PSB2aXN1YWxfem9vbV9wZXJjZW50ICkge1xuXHRcdFx0XHR1cGRhdGVfdmlzdWFsX3pvb21fY29udHJvbHMoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHZpc3VhbF96b29tX2FuY2hvciApIHtcblx0XHRcdFx0aW52b2tlX2NhbGxiYWNrKCAnY2FuY2VsX2FuY2hvcl9yZXN0b3JhdGlvbicgKTtcblx0XHRcdFx0dmlzdWFsX3pvb21fYW5jaG9yID0gd2luZG93X2NhY2hlID8gd2luZG93X2NhY2hlLmNhcHR1cmVfYXhpc19hbmNob3IoKSA6IG51bGw7XG5cdFx0XHRcdGludm9rZV9jYWxsYmFjayggJ3N1c3BlbmRfYWRqYWNlbnRfbG9hZGluZycgKTtcblx0XHRcdH1cblx0XHRcdHZpc3VhbF96b29tX3BlcmNlbnQgPSBuZXh0X3BlcmNlbnQ7XG5cdFx0XHR1cGRhdGVfdmlzdWFsX3pvb21fY29udHJvbHMoKTtcblx0XHRcdGlmICggdmlzdWFsX3pvb21fZnJhbWUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHZpc3VhbF96b29tX2ZyYW1lID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRpZiAoICEgaXNfaW5pdGlhbGl6ZWQgKSB7XG5cdFx0XHRcdFx0dmlzdWFsX3pvb21fZnJhbWUgPSAwO1xuXHRcdFx0XHRcdHZpc3VhbF96b29tX2FuY2hvciA9IG51bGw7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGFwcGx5X2F4aXNfZGltZW5zaW9ucygpO1xuXHRcdFx0XHRzeW5jaHJvbml6ZV90aW1lX2xhYmVsX3ByZXNlbnRhdGlvbigpO1xuXHRcdFx0XHRpZiAoIHdpbmRvd19jYWNoZSAmJiB2aXN1YWxfem9vbV9hbmNob3IgKSB7XG5cdFx0XHRcdFx0d2luZG93X2NhY2hlLnJlc3RvcmVfYXhpc19hbmNob3IoIHZpc3VhbF96b29tX2FuY2hvciApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHZpc3VhbF96b29tX2FuY2hvciA9IG51bGw7XG5cdFx0XHRcdHZpc3VhbF96b29tX2ZyYW1lID0gMDtcblx0XHRcdFx0aW52b2tlX2NhbGxiYWNrKCAnc2NoZWR1bGVfb3ZlcmZsb3dfdG9vbHRpcHMnICk7XG5cdFx0XHRcdGludm9rZV9jYWxsYmFjayggJ3NjaGVkdWxlX2VkZ2Vfc3RhdHVzJyApO1xuXHRcdFx0XHRpbnZva2VfY2FsbGJhY2soICdzY2hlZHVsZV9ib29raW5nX2xheW91dCcgKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBQcmV2aWV3IGEgZGVuc2l0eSByYW5nZSB2YWx1ZSB3aXRob3V0IHJlcGVhdGVkIGFubm91bmNlbWVudHMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCBSYW5nZSBpbnB1dCBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV92aXN1YWxfem9vbV9pbnB1dCggZXZlbnQgKSB7XG5cdFx0XHR2YXIgcmFuZ2UgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtdmlzdWFsLXpvb20tcmFuZ2VdJyApO1xuXG5cdFx0XHRpZiAoIHJhbmdlICkge1xuXHRcdFx0XHRjaGFuZ2VfdmlzdWFsX3pvb20oIHJhbmdlLnZhbHVlICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQW5ub3VuY2UgdGhlIGNvbW1pdHRlZCBkZW5zaXR5IHZhbHVlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgUmFuZ2UgY2hhbmdlIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX3Zpc3VhbF96b29tX2NoYW5nZSggZXZlbnQgKSB7XG5cdFx0XHR2YXIgcmFuZ2UgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtdmlzdWFsLXpvb20tcmFuZ2VdJyApO1xuXG5cdFx0XHRpZiAoICEgcmFuZ2UgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNoYW5nZV92aXN1YWxfem9vbSggcmFuZ2UudmFsdWUgKTtcblx0XHRcdGludm9rZV9jYWxsYmFjayggJ2Fubm91bmNlJywgU3RyaW5nKCBzZXR0aW5ncy5pMThuLnZpc3VhbF96b29tX3VwZGF0ZWQgfHwgJycgKS5yZXBsYWNlKCAne3BlcmNlbnR9JywgdmlzdWFsX3pvb21fcGVyY2VudCApICk7XG5cdFx0XHRpbnZva2VfY2FsbGJhY2soICdzYXZlX3ByZWZlcmVuY2VzJyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENhbmNlbCBhbiBhY3RpdmUgZW1wdHktcmFuZ2UgcHJvcG9zYWwgYmVmb3JlIHJlcGxhY2luZyBuYXZpZ2F0aW9uIHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjYW5jZWxfYWN0aXZlX3NlbGVjdGlvbigpIHtcblx0XHRcdGludm9rZV9jYWxsYmFjayggJ2NhbmNlbF9hY3RpdmVfc2VsZWN0aW9uJyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE5hdmlnYXRlIHRvIHRoZSBjdXJyZW50IGluc3RhbnQgd2l0aG91dCBjaGFuZ2luZyByYW5nZSBvciBzY2FsZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbmF2aWdhdGVfdG9fdG9kYXkoKSB7XG5cdFx0XHR2YXIgbmF2aWdhdGlvbiA9IHdpbmRvd19jYWNoZSA/IHdpbmRvd19jYWNoZS5yZXNvbHZlX3RvZGF5X25hdmlnYXRpb24oKSA6IG51bGw7XG5cdFx0XHR2YXIgYW5jaG9yO1xuXG5cdFx0XHRpZiAoICEgbmF2aWdhdGlvbiApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0YW5jaG9yID0gbmF2aWdhdGlvbi5hbmNob3I7XG5cdFx0XHRjYW5jZWxfYWN0aXZlX3NlbGVjdGlvbigpO1xuXHRcdFx0aWYgKCBuYXZpZ2F0aW9uLmlzX2xvYWRlZCAmJiBpbnZva2VfY2FsbGJhY2soICdyZXN0b3JlX2xvYWRlZF9hbmNob3InLCBhbmNob3IsIHsgcmVmcmVzaF90b2RheTogdHJ1ZSB9ICkgKSB7XG5cdFx0XHRcdGludm9rZV9jYWxsYmFjayggJ3NhdmVfcHJlZmVyZW5jZXMnLCB7XG5cdFx0XHRcdFx0YW5jaG9yX2RhdGU6IHNldHRpbmdzLnNoYXJlZF91aS50b2RheV9kYXRlLFxuXHRcdFx0XHRcdGFuY2hvcl9yYXRpbzogbmF2aWdhdGlvbi5hbmNob3JfcmF0aW9cblx0XHRcdFx0fSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpbnZva2VfY2FsbGJhY2soICdyZXF1ZXN0X3dpbmRvdycsIGludm9rZV9jYWxsYmFjayggJ2FkZF9jdXJyZW50X3dpbmRvd19zcGFuJywge1xuXHRcdFx0XHRhbmNob3JfYXQ6IGFuY2hvci5hdCxcblx0XHRcdFx0YW5jaG9yX3JhdGlvOiBuYXZpZ2F0aW9uLmFuY2hvcl9yYXRpbyxcblx0XHRcdFx0d2luZG93X3Bvc2l0aW9uOiAwLFxuXHRcdFx0XHR2aWV3OiBzZXR0aW5ncy5jdXJyZW50X2F4aXMgPyBzZXR0aW5ncy5jdXJyZW50X2F4aXMudmlldyA6IHNldHRpbmdzLmF4aXMudmlld1xuXHRcdFx0fSwgZmFsc2UgKSwgYW5jaG9yLCB0cnVlLCB7XG5cdFx0XHRcdGxvYWRpbmc6IHNldHRpbmdzLmkxOG4ubG9hZGluZ190b2RheSxcblx0XHRcdFx0Y29tcGxldGU6IHNldHRpbmdzLmkxOG4uc3RhdHVzX3JlYWR5LFxuXHRcdFx0XHRwZXJzaXN0X3ByZWZlcmVuY2VzOiB0cnVlXG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTmF2aWdhdGUgdG8gb25lIHN0cmljdCBzaXRlLWxvY2FsIGRhdGUgd2l0aG91dCBjaGFuZ2luZyByYW5nZSBvciBzY2FsZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBpc29fZGF0ZSBTdHJpY3QgWVlZWS1NTS1ERCBkYXRlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbmF2aWdhdGVfdG9fZGF0ZSggaXNvX2RhdGUgKSB7XG5cdFx0XHR2YXIgYW5jaG9yO1xuXHRcdFx0dmFyIGFuY2hvcl9yYXRpbztcblxuXHRcdFx0aWYgKCBzaGlmdF9pc29fZGF0ZSggaXNvX2RhdGUsIDAgKSAhPT0gaXNvX2RhdGUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNhbmNlbF9hY3RpdmVfc2VsZWN0aW9uKCk7XG5cdFx0XHRhbmNob3JfcmF0aW8gPSB3aW5kb3dfY2FjaGUgPyB3aW5kb3dfY2FjaGUuZ2V0X3RvZGF5X3JlcXVlc3RfYW5jaG9yX3JhdGlvKCkgOiAwO1xuXHRcdFx0YW5jaG9yID0gd2luZG93X2NhY2hlID8gd2luZG93X2NhY2hlLmNyZWF0ZV9sb2FkZWRfZGF0ZV9hbmNob3IoIGlzb19kYXRlICkgOiBudWxsO1xuXHRcdFx0aWYgKCBhbmNob3IgJiYgaW52b2tlX2NhbGxiYWNrKCAncmVzdG9yZV9sb2FkZWRfYW5jaG9yJywgYW5jaG9yLCB7IGFubm91bmNlbWVudDogc2V0dGluZ3MuaTE4bi5zZWxlY3RlZF9kYXRlX2xvYWRlZCB9ICkgKSB7XG5cdFx0XHRcdGludm9rZV9jYWxsYmFjayggJ3NhdmVfcHJlZmVyZW5jZXMnLCB7XG5cdFx0XHRcdFx0YW5jaG9yX2RhdGU6IGlzb19kYXRlLFxuXHRcdFx0XHRcdGFuY2hvcl9yYXRpbzogYW5jaG9yX3JhdGlvXG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0YW5jaG9yID0ge1xuXHRcdFx0XHRhdDogaXNvX2RhdGUgKyAnVDAwOjAwOjAwKzAwOjAwJyxcblx0XHRcdFx0cmF0aW86IGFuY2hvcl9yYXRpbyxcblx0XHRcdFx0bGVhZGluZ19jZWxsc19iZWZvcmU6IDEsXG5cdFx0XHRcdHJlc3RvcmVfZm9jdXM6IGZhbHNlLFxuXHRcdFx0XHR0YXJnZXRfZGF0ZTogaXNvX2RhdGVcblx0XHRcdH07XG5cdFx0XHRpbnZva2VfY2FsbGJhY2soICdyZXF1ZXN0X3dpbmRvdycsIGludm9rZV9jYWxsYmFjayggJ2FkZF9jdXJyZW50X3dpbmRvd19zcGFuJywge1xuXHRcdFx0XHRhbmNob3JfZGF0ZTogaXNvX2RhdGUsXG5cdFx0XHRcdGFuY2hvcl9yYXRpbzogYW5jaG9yX3JhdGlvLFxuXHRcdFx0XHR3aW5kb3dfcG9zaXRpb246IDAsXG5cdFx0XHRcdHZpZXc6IHNldHRpbmdzLmN1cnJlbnRfYXhpcyA/IHNldHRpbmdzLmN1cnJlbnRfYXhpcy52aWV3IDogc2V0dGluZ3MuYXhpcy52aWV3XG5cdFx0XHR9LCBmYWxzZSApLCBhbmNob3IsIHRydWUsIHtcblx0XHRcdFx0bG9hZGluZzogc2V0dGluZ3MuaTE4bi5sb2FkaW5nX3NlbGVjdGVkX2RhdGUsXG5cdFx0XHRcdGNvbXBsZXRlOiBzZXR0aW5ncy5pMThuLnNlbGVjdGVkX2RhdGVfbG9hZGVkLFxuXHRcdFx0XHRwZXJzaXN0X3ByZWZlcmVuY2VzOiB0cnVlXG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTG9hZCB0aGUgcHJldmlvdXMgb3IgbmV4dCBzZXJ2ZXItYXV0aG9yaXplZCBUaW1lbGluZSB3aW5kb3cuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZGlyZWN0aW9uIFByZXZpb3VzIG9yIG5leHQuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGEgdmFsaWQgbmF2aWdhdGlvbiByZXF1ZXN0IHdhcyBkaXNwYXRjaGVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG5hdmlnYXRlX3RpbWVsaW5lX3dpbmRvdyggZGlyZWN0aW9uICkge1xuXHRcdFx0dmFyIGFuY2hvcjtcblx0XHRcdHZhciBjdXJyZW50X2F4aXMgPSBzZXR0aW5ncy5jdXJyZW50X2F4aXMgPyBzZXR0aW5ncy5jdXJyZW50X2F4aXMgOiBzZXR0aW5ncy5heGlzO1xuXG5cdFx0XHRpZiAoICdwcmV2aW91cycgIT09IGRpcmVjdGlvbiAmJiAnbmV4dCcgIT09IGRpcmVjdGlvbiApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0YW5jaG9yID0ge1xuXHRcdFx0XHRhdDogY3VycmVudF9heGlzLnN0YXJ0X2F0LFxuXHRcdFx0XHRyYXRpbzogMCxcblx0XHRcdFx0bGVhZGluZ19jZWxsc19iZWZvcmU6IDAsXG5cdFx0XHRcdHJlc3RvcmVfZm9jdXM6IGZhbHNlLFxuXHRcdFx0XHR1c2VfcmVzcG9uc2Vfc3RhcnQ6IHRydWVcblx0XHRcdH07XG5cdFx0XHRpbnZva2VfY2FsbGJhY2soICdyZXF1ZXN0X3dpbmRvdycsIGludm9rZV9jYWxsYmFjayggJ2FkZF9jdXJyZW50X3dpbmRvd19zcGFuJywge1xuXHRcdFx0XHRhbmNob3JfYXQ6IGN1cnJlbnRfYXhpcy5zdGFydF9hdCxcblx0XHRcdFx0d2luZG93X3Bvc2l0aW9uOiAncHJldmlvdXMnID09PSBkaXJlY3Rpb24gPyAtMSA6IDEsXG5cdFx0XHRcdHZpZXc6IHNldHRpbmdzLmN1cnJlbnRfYXhpcyA/IHNldHRpbmdzLmN1cnJlbnRfYXhpcy52aWV3IDogc2V0dGluZ3MuYXhpcy52aWV3XG5cdFx0XHR9LCBmYWxzZSApLCBhbmNob3IsIHRydWUsIHtcblx0XHRcdFx0bG9hZGluZzogJ3ByZXZpb3VzJyA9PT0gZGlyZWN0aW9uID8gc2V0dGluZ3MuaTE4bi5sb2FkaW5nX3ByZXZpb3VzX3dpbmRvdyA6IHNldHRpbmdzLmkxOG4ubG9hZGluZ19uZXh0X3dpbmRvdyxcblx0XHRcdFx0Y29tcGxldGU6IHNldHRpbmdzLmkxOG4uc3RhdHVzX3JlYWR5LFxuXHRcdFx0XHRwZXJzaXN0X3ByZWZlcmVuY2VzOiB0cnVlXG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFwcGx5IG9uZSBzZXJ2ZXItZGVjbGFyZWQgcmFuZ2UtYW5kLXNjYWxlIHNlbGVjdGlvbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBzZWxlY3RlZF92YWx1ZSBTdGFibGUgb3BhcXVlIG9wdGlvbiB2YWx1ZS5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIG9wdGlvbiB3YXMgcmVjb2duaXplZCBhbmQgZGlzcGF0Y2hlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBhcHBseV9yYW5nZV9zY2FsZV9vcHRpb24oIHNlbGVjdGVkX3ZhbHVlICkge1xuXHRcdFx0dmFyIHNlbGVjdGVkX29wdGlvbiA9IGdldF9yYW5nZV9zY2FsZV9vcHRpb24oIHNlbGVjdGVkX3ZhbHVlICk7XG5cdFx0XHR2YXIgYW5jaG9yO1xuXHRcdFx0dmFyIHJlcXVlc3RfdmFsdWVzO1xuXG5cdFx0XHRpZiAoICEgc2VsZWN0ZWRfb3B0aW9uICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRhbmNob3IgPSB3aW5kb3dfY2FjaGUgPyB3aW5kb3dfY2FjaGUuY2FwdHVyZV9heGlzX2FuY2hvcigpIDogeyBhdDogc2V0dGluZ3MuYXhpcy5hbmNob3IuYXQsIHJhdGlvOiAwLjUgfTtcblx0XHRcdHJlcXVlc3RfdmFsdWVzID0ge1xuXHRcdFx0XHRhbmNob3JfYXQ6IGFuY2hvci5hdCxcblx0XHRcdFx0YW5jaG9yX3JhdGlvOiBhbmNob3IucmF0aW8sXG5cdFx0XHRcdHdpbmRvd19wb3NpdGlvbjogMCxcblx0XHRcdFx0dmlldzogc2VsZWN0ZWRfb3B0aW9uLnZpZXdfaWRcblx0XHRcdH07XG5cdFx0XHRpZiAoIDAgPCBOdW1iZXIoIHNlbGVjdGVkX29wdGlvbi53aW5kb3dfbW9udGhzICkgKSB7XG5cdFx0XHRcdHJlcXVlc3RfdmFsdWVzLndpbmRvd19tb250aHMgPSBOdW1iZXIoIHNlbGVjdGVkX29wdGlvbi53aW5kb3dfbW9udGhzICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXF1ZXN0X3ZhbHVlcy53aW5kb3dfZGF5cyA9IE51bWJlciggc2VsZWN0ZWRfb3B0aW9uLndpbmRvd19kYXlzICk7XG5cdFx0XHR9XG5cdFx0XHRpbnZva2VfY2FsbGJhY2soICdyZXF1ZXN0X3dpbmRvdycsIHJlcXVlc3RfdmFsdWVzLCBhbmNob3IsIHRydWUsIHtcblx0XHRcdFx0bG9hZGluZzogc2V0dGluZ3MuaTE4bi5sb2FkaW5nX3RpbWVsaW5lX2NvbWJpbmF0aW9uLFxuXHRcdFx0XHRjb21wbGV0ZTogc2V0dGluZ3MuaTE4bi5jb21iaW5hdGlvbl9sb2FkZWQsXG5cdFx0XHRcdHBlcnNpc3RfcHJlZmVyZW5jZXM6IHRydWVcblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQXBwbHkgb25lIHN0cmljdCBpbmNsdXNpdmUgY3VzdG9tIGRhdGUgcmFuZ2UuXG5cdFx0ICpcblx0XHQgKiBVVEMgY2FsZW5kYXIgYXJpdGhtZXRpYyB2YWxpZGF0ZXMgY2l2aWwgZGF0ZXMgd2l0aG91dCBhcHBseWluZyB0aGUgYnJvd3NlclxuXHRcdCAqIHRpbWV6b25lIG9yIGEgZGF5bGlnaHQtc2F2aW5nIG9mZnNldC4gUEhQIHN0aWxsIGluZGVwZW5kZW50bHkgdmFsaWRhdGVzXG5cdFx0ICogdGhlIGF1dGhvcml6ZWQgYXhpcywgUmVzb3VyY2Ugc2NvcGUsIGFuZCBwYXlsb2FkIGJ1ZGdldHMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gc3RhcnRfZGF0ZSBJbmNsdXNpdmUgWVlZWS1NTS1ERCBzdGFydC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZW5kX2RhdGUgSW5jbHVzaXZlIFlZWVktTU0tREQgZW5kLlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBhIHZhbGlkIHJlcXVlc3Qgd2FzIGRpc3BhdGNoZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYXBwbHlfY3VzdG9tX2RhdGVfcmFuZ2UoIHN0YXJ0X2RhdGUsIGVuZF9kYXRlICkge1xuXHRcdFx0dmFyIG1heGltdW1fc3Bhbl9kYXlzID0gc2V0dGluZ3MubWV0YWRhdGEgJiYgc2V0dGluZ3MubWV0YWRhdGEubGltaXRzID8gTnVtYmVyKCBzZXR0aW5ncy5tZXRhZGF0YS5saW1pdHMubWF4aW11bV93aW5kb3dfZGF5cyApIHx8IDYyIDogNjI7XG5cdFx0XHR2YXIgc3RhcnRfbWF0Y2ggPSBTdHJpbmcoIHN0YXJ0X2RhdGUgfHwgJycgKS5tYXRjaCggL14oXFxkezR9KS0oXFxkezJ9KS0oXFxkezJ9KSQvICk7XG5cdFx0XHR2YXIgZW5kX21hdGNoID0gU3RyaW5nKCBlbmRfZGF0ZSB8fCAnJyApLm1hdGNoKCAvXihcXGR7NH0pLShcXGR7Mn0pLShcXGR7Mn0pJC8gKTtcblx0XHRcdHZhciBzdGFydF9lcG9jaDtcblx0XHRcdHZhciBlbmRfZXBvY2g7XG5cdFx0XHR2YXIgc3Bhbl9kYXlzO1xuXHRcdFx0dmFyIGFuY2hvcjtcblxuXHRcdFx0aWYgKCAhIHN0YXJ0X21hdGNoIHx8ICEgZW5kX21hdGNoIHx8IHNoaWZ0X2lzb19kYXRlKCBzdGFydF9kYXRlLCAwICkgIT09IHN0YXJ0X2RhdGUgfHwgc2hpZnRfaXNvX2RhdGUoIGVuZF9kYXRlLCAwICkgIT09IGVuZF9kYXRlICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRzdGFydF9lcG9jaCA9IERhdGUuVVRDKCBOdW1iZXIoIHN0YXJ0X21hdGNoWyAxIF0gKSwgTnVtYmVyKCBzdGFydF9tYXRjaFsgMiBdICkgLSAxLCBOdW1iZXIoIHN0YXJ0X21hdGNoWyAzIF0gKSApO1xuXHRcdFx0ZW5kX2Vwb2NoID0gRGF0ZS5VVEMoIE51bWJlciggZW5kX21hdGNoWyAxIF0gKSwgTnVtYmVyKCBlbmRfbWF0Y2hbIDIgXSApIC0gMSwgTnVtYmVyKCBlbmRfbWF0Y2hbIDMgXSApICk7XG5cdFx0XHRzcGFuX2RheXMgPSBNYXRoLnJvdW5kKCAoIGVuZF9lcG9jaCAtIHN0YXJ0X2Vwb2NoICkgLyA4NjQwMDAwMCApICsgMTtcblx0XHRcdGlmICggc3Bhbl9kYXlzIDwgMSB8fCBzcGFuX2RheXMgPiBtYXhpbXVtX3NwYW5fZGF5cyB8fCBzaGlmdF9pc29fZGF0ZSggc3RhcnRfZGF0ZSwgc3Bhbl9kYXlzIC0gMSApICE9PSBlbmRfZGF0ZSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0YW5jaG9yID0ge1xuXHRcdFx0XHRhdDogc3RhcnRfZGF0ZSArICdUMDA6MDA6MDArMDA6MDAnLFxuXHRcdFx0XHRyYXRpbzogMCxcblx0XHRcdFx0bGVhZGluZ19jZWxsc19iZWZvcmU6IDAsXG5cdFx0XHRcdHJlc3RvcmVfZm9jdXM6IGZhbHNlLFxuXHRcdFx0XHR1c2VfcmVzcG9uc2Vfc3RhcnQ6IHRydWVcblx0XHRcdH07XG5cdFx0XHRpbnZva2VfY2FsbGJhY2soICdyZXF1ZXN0X3dpbmRvdycsIHtcblx0XHRcdFx0YW5jaG9yX2RhdGU6IHN0YXJ0X2RhdGUsXG5cdFx0XHRcdGFuY2hvcl9yYXRpbzogMCxcblx0XHRcdFx0d2luZG93X3Bvc2l0aW9uOiAwLFxuXHRcdFx0XHR3aW5kb3dfZGF5czogc3Bhbl9kYXlzLFxuXHRcdFx0XHR2aWV3OiBzZXR0aW5ncy5jdXJyZW50X2F4aXMgPyBzZXR0aW5ncy5jdXJyZW50X2F4aXMudmlldyA6IHNldHRpbmdzLmF4aXMudmlld1xuXHRcdFx0fSwgYW5jaG9yLCB0cnVlLCB7XG5cdFx0XHRcdGxvYWRpbmc6IHNldHRpbmdzLmkxOG4ubG9hZGluZ19kYXRlX3JhbmdlLFxuXHRcdFx0XHRjb21wbGV0ZTogc2V0dGluZ3MuaTE4bi5zdGF0dXNfcmVhZHksXG5cdFx0XHRcdHBlcnNpc3RfcHJlZmVyZW5jZXM6IHRydWVcblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVzdG9yZSBjb25maWd1cmVkIHRvb2xiYXIgZGVmYXVsdHMgYW5kIHJlZnJlc2ggYXQgdGhlIHNpdGUtbG9jYWwgdG9kYXkuXG5cdFx0ICpcblx0XHQgKiBQZXJzaXN0ZW5jZSBpcyByZXNldCBmaXJzdCBieSB0aGUgcGFnZS1jb250cm9sbGVyIGNhbGxiYWNrLiBUaGlzIG1ldGhvZFxuXHRcdCAqIGFwcGxpZXMgb25seSB0aGUgc2VydmVyLWRlY2xhcmVkIGRlZmF1bHQgcmVxdWVzdCBhbmQgcHJlc2VudGF0aW9uIGRlbnNpdHk7XG5cdFx0ICogUmVzb3VyY2Ugc2VsZWN0aW9uIGFuZCBoaWVyYXJjaHkgc3RhdGUgcmVtYWluIG91dHNpZGUgaXRzIG93bmVyc2hpcC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgZGVmYXVsdCB3aW5kb3cgcmVxdWVzdCB3YXMgZGlzcGF0Y2hlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXNldF90b19kZWZhdWx0cygpIHtcblx0XHRcdHZhciBkZWZhdWx0X3JlcXVlc3QgPSBzZXR0aW5ncy5tZXRhZGF0YSAmJiBzZXR0aW5ncy5tZXRhZGF0YS5kZWZhdWx0X3dpbmRvd19yZXF1ZXN0XG5cdFx0XHRcdD8gc2V0dGluZ3MubWV0YWRhdGEuZGVmYXVsdF93aW5kb3dfcmVxdWVzdFxuXHRcdFx0XHQ6IHt9O1xuXHRcdFx0dmFyIHRvZGF5X2RhdGUgPSBzZXR0aW5ncy5zaGFyZWRfdWkgPyBTdHJpbmcoIHNldHRpbmdzLnNoYXJlZF91aS50b2RheV9kYXRlIHx8ICcnICkgOiAnJztcblx0XHRcdHZhciBhbmNob3JfcmF0aW8gPSB3aW5kb3dfY2FjaGUgPyB3aW5kb3dfY2FjaGUuZ2V0X3RvZGF5X3JlcXVlc3RfYW5jaG9yX3JhdGlvKCkgOiAwO1xuXHRcdFx0dmFyIHJlcXVlc3RfdmFsdWVzO1xuXHRcdFx0dmFyIHJlcXVlc3RfcmVzdWx0O1xuXHRcdFx0dmFyIGFuY2hvcjtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHRzaGlmdF9pc29fZGF0ZSggdG9kYXlfZGF0ZSwgMCApICE9PSB0b2RheV9kYXRlXG5cdFx0XHRcdHx8ICEgZGVmYXVsdF9yZXF1ZXN0LnZpZXdcblx0XHRcdFx0fHwgKCAhIE51bWJlciggZGVmYXVsdF9yZXF1ZXN0LndpbmRvd19kYXlzICkgJiYgISBOdW1iZXIoIGRlZmF1bHRfcmVxdWVzdC53aW5kb3dfbW9udGhzICkgKVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0Y2FuY2VsX2FjdGl2ZV9zZWxlY3Rpb24oKTtcblx0XHRcdGNoYW5nZV92aXN1YWxfem9vbSggdmlzdWFsX3pvb21fY29uZmlndXJhdGlvbi5jb25maWd1cmVkX2RlZmF1bHRfcGVyY2VudCApO1xuXHRcdFx0aW52b2tlX2NhbGxiYWNrKCAnc2V0X3ByZWZlcmVuY2VfYW5jaG9yJywgdG9kYXlfZGF0ZSwgYW5jaG9yX3JhdGlvICk7XG5cdFx0XHRhbmNob3IgPSB7XG5cdFx0XHRcdGF0OiB0b2RheV9kYXRlICsgJ1QwMDowMDowMCswMDowMCcsXG5cdFx0XHRcdHJhdGlvOiBhbmNob3JfcmF0aW8sXG5cdFx0XHRcdGxlYWRpbmdfY2VsbHNfYmVmb3JlOiAxLFxuXHRcdFx0XHRyZXN0b3JlX2ZvY3VzOiBmYWxzZSxcblx0XHRcdFx0dGFyZ2V0X2RhdGU6IHRvZGF5X2RhdGVcblx0XHRcdH07XG5cdFx0XHRyZXF1ZXN0X3ZhbHVlcyA9IHtcblx0XHRcdFx0YW5jaG9yX2RhdGU6IHRvZGF5X2RhdGUsXG5cdFx0XHRcdGFuY2hvcl9yYXRpbzogYW5jaG9yX3JhdGlvLFxuXHRcdFx0XHR3aW5kb3dfcG9zaXRpb246IDAsXG5cdFx0XHRcdHZpZXc6IFN0cmluZyggZGVmYXVsdF9yZXF1ZXN0LnZpZXcgKVxuXHRcdFx0fTtcblx0XHRcdGlmICggMCA8IE51bWJlciggZGVmYXVsdF9yZXF1ZXN0LndpbmRvd19tb250aHMgKSApIHtcblx0XHRcdFx0cmVxdWVzdF92YWx1ZXMud2luZG93X21vbnRocyA9IE51bWJlciggZGVmYXVsdF9yZXF1ZXN0LndpbmRvd19tb250aHMgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlcXVlc3RfdmFsdWVzLndpbmRvd19kYXlzID0gTnVtYmVyKCBkZWZhdWx0X3JlcXVlc3Qud2luZG93X2RheXMgKTtcblx0XHRcdH1cblxuXHRcdFx0cmVxdWVzdF9yZXN1bHQgPSBpbnZva2VfY2FsbGJhY2soICdyZXF1ZXN0X3dpbmRvdycsIHJlcXVlc3RfdmFsdWVzLCBhbmNob3IsIHRydWUsIHtcblx0XHRcdFx0bG9hZGluZzogc2V0dGluZ3MuaTE4bi5yZXNldHRpbmdfdGltZWxpbmUsXG5cdFx0XHRcdGNvbXBsZXRlOiBzZXR0aW5ncy5pMThuLnRpbWVsaW5lX3Jlc2V0LFxuXHRcdFx0XHRwZXJzaXN0X3ByZWZlcmVuY2VzOiBmYWxzZVxuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gQm9vbGVhbiggcmVxdWVzdF9yZXN1bHQgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBIYW5kbGUgc2hhcmVkIFRpbWVsaW5lIHRvb2xiYXIgZXZlbnRzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtDdXN0b21FdmVudH0gZXZlbnQgU2hhcmVkIGNvbXBvbmVudCBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9zaGFyZWRfZXZlbnQoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGRldGFpbCA9IGV2ZW50LmRldGFpbCAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIGV2ZW50LmRldGFpbCA/IGV2ZW50LmRldGFpbCA6IHt9O1xuXHRcdFx0dmFyIGNvbXBvbmVudF9pZCA9IFN0cmluZyggZGV0YWlsLmlkIHx8ICcnICk7XG5cblx0XHRcdGlmICggJ3dwYmM6c2hhcmVkLXVpLWRyb3Bkb3duLWNoYW5nZScgPT09IGV2ZW50LnR5cGUgJiYgJ3dwYmNfdGltZWxpbmVfYWR2YW5jZWRfY29tYmluYXRpb24nID09PSBjb21wb25lbnRfaWQgKSB7XG5cdFx0XHRcdGFwcGx5X3JhbmdlX3NjYWxlX29wdGlvbiggU3RyaW5nKCBkZXRhaWwudmFsdWUgfHwgJycgKSApO1xuXHRcdFx0fSBlbHNlIGlmICggJ3dwYmM6c2hhcmVkLXVpLWRhdGUtcmFuZ2Utc2hpZnQnID09PSBldmVudC50eXBlICYmICd3cGJjX3RpbWVsaW5lX2RhdGVfcmFuZ2UnID09PSBjb21wb25lbnRfaWQgKSB7XG5cdFx0XHRcdG5hdmlnYXRlX3RpbWVsaW5lX3dpbmRvdyggU3RyaW5nKCBkZXRhaWwuZGlyZWN0aW9uIHx8ICcnICkgKTtcblx0XHRcdH0gZWxzZSBpZiAoICd3cGJjOnNoYXJlZC11aS1kYXRlLXJhbmdlLWFwcGx5JyA9PT0gZXZlbnQudHlwZSAmJiAnd3BiY190aW1lbGluZV9kYXRlX3JhbmdlJyA9PT0gY29tcG9uZW50X2lkICkge1xuXHRcdFx0XHRhcHBseV9jdXN0b21fZGF0ZV9yYW5nZSggU3RyaW5nKCBkZXRhaWwuc3RhcnRfZGF0ZSB8fCAnJyApLCBTdHJpbmcoIGRldGFpbC5lbmRfZGF0ZSB8fCAnJyApICk7XG5cdFx0XHR9IGVsc2UgaWYgKCAnd3BiYzpzaGFyZWQtdWktZGF0ZS1qdW1wLWFjdGlvbicgPT09IGV2ZW50LnR5cGUgJiYgJ3dwYmNfdGltZWxpbmVfZGF0ZV9qdW1wJyA9PT0gY29tcG9uZW50X2lkICkge1xuXHRcdFx0XHRuYXZpZ2F0ZV90b190b2RheSgpO1xuXHRcdFx0fSBlbHNlIGlmICggJ3dwYmM6c2hhcmVkLXVpLWRhdGUtanVtcC1zZWxlY3QnID09PSBldmVudC50eXBlICYmICd3cGJjX3RpbWVsaW5lX2RhdGVfanVtcCcgPT09IGNvbXBvbmVudF9pZCApIHtcblx0XHRcdFx0bmF2aWdhdGVfdG9fZGF0ZSggU3RyaW5nKCBkZXRhaWwuZGF0ZSB8fCAnJyApICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSGFuZGxlIHByZXZpb3VzL25leHQgY29udHJvbHMgZGVsZWdhdGVkIGJ5IHRoZSBwYWdlIGNvbnRyb2xsZXIuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGV2ZW50IEJyb3dzZXIgY2xpY2sgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoaXMgbW9kdWxlIGNvbnN1bWVkIHRoZSBjbGljay5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfY2xpY2soIGV2ZW50ICkge1xuXHRcdFx0dmFyIHdpbmRvd19idXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtd2luZG93XScgKTtcblx0XHRcdHZhciByZXNldF9idXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtc2hhcmVkLXVpLWNvbnRleHQtcG9wb3Zlci1idXR0b249XCJ3cGJjX3RpbWVsaW5lX3Jlc2V0X3ByZWZlcmVuY2VzXCJdJyApO1xuXG5cdFx0XHRpZiAoIHJlc2V0X2J1dHRvbiApIHtcblx0XHRcdFx0aWYgKCAndHJ1ZScgPT09IHJlc2V0X2J1dHRvbi5nZXRBdHRyaWJ1dGUoICdhcmlhLWRpc2FibGVkJyApICkge1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGludm9rZV9jYWxsYmFjayggJ3Jlc2V0X3ByZWZlcmVuY2VzJywgcmVzZXRfYnV0dG9uICk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gQm9vbGVhbiggd2luZG93X2J1dHRvbiAmJiBuYXZpZ2F0ZV90aW1lbGluZV93aW5kb3coIHdpbmRvd19idXR0b24uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXdpbmRvdycgKSApICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTW92ZSBmb2N1cyBiZXR3ZWVuIHNlcnZlci1kZWZpbmVkIGF4aXMgY2VsbHMgd2l0aCBSVEwtYXdhcmUgYXJyb3dzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBldmVudCBLZXkgZXZlbnQgZnJvbSB0aGUgYXhpcy5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhpcyBtb2R1bGUgY29uc3VtZWQgdGhlIGtleS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfa2V5ZG93biggZXZlbnQgKSB7XG5cdFx0XHR2YXIgY2VsbCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1heGlzLWNlbGxdJyApO1xuXHRcdFx0dmFyIGNlbGxzO1xuXHRcdFx0dmFyIGN1cnJlbnRfaW5kZXg7XG5cdFx0XHR2YXIgcmVxdWVzdGVkX2luZGV4O1xuXHRcdFx0dmFyIG5leHRfaW5kZXg7XG5cdFx0XHR2YXIgZGlyZWN0aW9uO1xuXG5cdFx0XHRpZiAoICEgY2VsbCB8fCAtMSA9PT0gWyAnQXJyb3dMZWZ0JywgJ0Fycm93UmlnaHQnLCAnSG9tZScsICdFbmQnIF0uaW5kZXhPZiggZXZlbnQua2V5ICkgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGNlbGxzID0gbW91bnQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtYXhpcy1jZWxsXScgKTtcblx0XHRcdGN1cnJlbnRfaW5kZXggPSBBcnJheS5wcm90b3R5cGUuaW5kZXhPZi5jYWxsKCBjZWxscywgY2VsbCApO1xuXHRcdFx0aWYgKCAwID4gY3VycmVudF9pbmRleCApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnSG9tZScgPT09IGV2ZW50LmtleSApIHtcblx0XHRcdFx0cmVxdWVzdGVkX2luZGV4ID0gMDtcblx0XHRcdH0gZWxzZSBpZiAoICdFbmQnID09PSBldmVudC5rZXkgKSB7XG5cdFx0XHRcdHJlcXVlc3RlZF9pbmRleCA9IGNlbGxzLmxlbmd0aCAtIDE7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXF1ZXN0ZWRfaW5kZXggPSBjdXJyZW50X2luZGV4ICsgKCAnQXJyb3dSaWdodCcgPT09IGV2ZW50LmtleSA/IDEgOiAtMSApICogKCBzZXR0aW5ncy5pc19ydGwgPyAtMSA6IDEgKTtcblx0XHRcdH1cblx0XHRcdG5leHRfaW5kZXggPSBNYXRoLm1heCggMCwgTWF0aC5taW4oIGNlbGxzLmxlbmd0aCAtIDEsIHJlcXVlc3RlZF9pbmRleCApICk7XG5cdFx0XHRpZiAoIG5leHRfaW5kZXggPT09IGN1cnJlbnRfaW5kZXggKSB7XG5cdFx0XHRcdGlmICggLTEgIT09IFsgJ0Fycm93TGVmdCcsICdBcnJvd1JpZ2h0JyBdLmluZGV4T2YoIGV2ZW50LmtleSApICYmIHJlcXVlc3RlZF9pbmRleCAhPT0gY3VycmVudF9pbmRleCApIHtcblx0XHRcdFx0XHRkaXJlY3Rpb24gPSAwID4gcmVxdWVzdGVkX2luZGV4ID8gJ3ByZXZpb3VzJyA6ICduZXh0Jztcblx0XHRcdFx0XHRpZiAoIGludm9rZV9jYWxsYmFjayggJ2FjdGl2YXRlX2FkamFjZW50X2ludGVudCcsIGRpcmVjdGlvbiwgZmFsc2UgKSApIHtcblx0XHRcdFx0XHRcdGludm9rZV9jYWxsYmFjayggJ3JlcXVlc3RfYWRqYWNlbnRfd2luZG93JywgZGlyZWN0aW9uICk7XG5cdFx0XHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGRpcmVjdGlvbiA9IG5leHRfaW5kZXggPCBjdXJyZW50X2luZGV4ID8gJ3ByZXZpb3VzJyA6ICduZXh0Jztcblx0XHRcdGludm9rZV9jYWxsYmFjayggJ2FjdGl2YXRlX2FkamFjZW50X2ludGVudCcsIGRpcmVjdGlvbiwgZmFsc2UgKTtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRjZWxsLnNldEF0dHJpYnV0ZSggJ3RhYmluZGV4JywgJy0xJyApO1xuXHRcdFx0Y2VsbHNbIG5leHRfaW5kZXggXS5zZXRBdHRyaWJ1dGUoICd0YWJpbmRleCcsICcwJyApO1xuXHRcdFx0Y2VsbHNbIG5leHRfaW5kZXggXS5mb2N1cygpO1xuXHRcdFx0Y2VsbHNbIG5leHRfaW5kZXggXS5zY3JvbGxJbnRvVmlldyggeyBibG9jazogJ25lYXJlc3QnLCBpbmxpbmU6ICduZWFyZXN0JyB9ICk7XG5cdFx0XHRpbnZva2VfY2FsbGJhY2soICdzeW5jaHJvbml6ZV9heGlzX3Njcm9sbCcgKTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVuZGVyIGFsbCBzaGFyZWQgdG9vbGJhciBjb250cm9scyBvbmNlIGFmdGVyIHRoZSBzaGVsbCBtb3VudHMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9jb250cm9scygpIHtcblx0XHRcdHJlbmRlcl90b29sYmFyX2Ryb3Bkb3duKCk7XG5cdFx0XHRyZW5kZXJfZGF0ZV9yYW5nZV9uYXZpZ2F0aW9uKCk7XG5cdFx0XHRyZW5kZXJfZGF0ZV9qdW1wKCk7XG5cdFx0XHRyZW5kZXJfcmVzZXRfcHJlZmVyZW5jZXNfYnV0dG9uKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3luY2hyb25pemUgY29udHJvbHMgYW5kIGRpbWVuc2lvbnMgYWZ0ZXIgYW4gYXV0aG9yaXplZCB3aW5kb3cgcmVuZGVyLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZWZyZXNoX2FmdGVyX3dpbmRvd19yZW5kZXIoKSB7XG5cdFx0XHR2YXIgZHJvcGRvd24gPSBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zaGFyZWQtdWktZHJvcGRvd249XCJ3cGJjX3RpbWVsaW5lX2FkdmFuY2VkX2NvbWJpbmF0aW9uXCJdJyApO1xuXG5cdFx0XHRzeW5jaHJvbml6ZV9kYXRlX3JhbmdlX25hdmlnYXRpb24oKTtcblx0XHRcdHN5bmNocm9uaXplX3NoYXJlZF9kcm9wZG93biggZHJvcGRvd24sIGdldF9tYXRjaGluZ19yYW5nZV9zY2FsZV9vcHRpb25fdmFsdWUoKSwgZmFsc2UsIFsgJ2N1c3RvbScgXSApO1xuXHRcdFx0YXBwbHlfYXhpc19kaW1lbnNpb25zKCk7XG5cdFx0XHRzeW5jaHJvbml6ZV90aW1lX2xhYmVsX3ByZXNlbnRhdGlvbigpO1xuXHRcdFx0dXBkYXRlX3Zpc3VhbF96b29tX2NvbnRyb2xzKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSW5pdGlhbGl6ZSBvd25lZCBzaGFyZWQtY29udHJvbCBldmVudCBsaXN0ZW5lcnMgb25jZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaW5pdGlhbGl6ZSgpIHtcblx0XHRcdGlmICggaXNfaW5pdGlhbGl6ZWQgfHwgISBtb3VudCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aXNfaW5pdGlhbGl6ZWQgPSB0cnVlO1xuXHRcdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgaGFuZGxlX3Zpc3VhbF96b29tX2lucHV0ICk7XG5cdFx0XHRtb3VudC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgaGFuZGxlX3Zpc3VhbF96b29tX2NoYW5nZSApO1xuXHRcdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6c2hhcmVkLXVpLWRyb3Bkb3duLWNoYW5nZScsIGhhbmRsZV9zaGFyZWRfZXZlbnQgKTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOnNoYXJlZC11aS1kYXRlLXJhbmdlLXNoaWZ0JywgaGFuZGxlX3NoYXJlZF9ldmVudCApO1xuXHRcdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6c2hhcmVkLXVpLWRhdGUtcmFuZ2UtYXBwbHknLCBoYW5kbGVfc2hhcmVkX2V2ZW50ICk7XG5cdFx0XHRtb3VudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzpzaGFyZWQtdWktZGF0ZS1qdW1wLWFjdGlvbicsIGhhbmRsZV9zaGFyZWRfZXZlbnQgKTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOnNoYXJlZC11aS1kYXRlLWp1bXAtc2VsZWN0JywgaGFuZGxlX3NoYXJlZF9ldmVudCApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbW92ZSBvd25lZCBsaXN0ZW5lcnMgYW5kIGNhbmNlbCBwZW5kaW5nIGRlbnNpdHkgd29yay5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZGVzdHJveSgpIHtcblx0XHRcdGlmICggISBpc19pbml0aWFsaXplZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgaGFuZGxlX3Zpc3VhbF96b29tX2lucHV0ICk7XG5cdFx0XHRtb3VudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgaGFuZGxlX3Zpc3VhbF96b29tX2NoYW5nZSApO1xuXHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3dwYmM6c2hhcmVkLXVpLWRyb3Bkb3duLWNoYW5nZScsIGhhbmRsZV9zaGFyZWRfZXZlbnQgKTtcblx0XHRcdG1vdW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICd3cGJjOnNoYXJlZC11aS1kYXRlLXJhbmdlLXNoaWZ0JywgaGFuZGxlX3NoYXJlZF9ldmVudCApO1xuXHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3dwYmM6c2hhcmVkLXVpLWRhdGUtcmFuZ2UtYXBwbHknLCBoYW5kbGVfc2hhcmVkX2V2ZW50ICk7XG5cdFx0XHRtb3VudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnd3BiYzpzaGFyZWQtdWktZGF0ZS1qdW1wLWFjdGlvbicsIGhhbmRsZV9zaGFyZWRfZXZlbnQgKTtcblx0XHRcdG1vdW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICd3cGJjOnNoYXJlZC11aS1kYXRlLWp1bXAtc2VsZWN0JywgaGFuZGxlX3NoYXJlZF9ldmVudCApO1xuXHRcdFx0aWYgKCB2aXN1YWxfem9vbV9mcmFtZSApIHtcblx0XHRcdFx0d2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lKCB2aXN1YWxfem9vbV9mcmFtZSApO1xuXHRcdFx0fVxuXHRcdFx0dmlzdWFsX3pvb21fZnJhbWUgPSAwO1xuXHRcdFx0dmlzdWFsX3pvb21fYW5jaG9yID0gbnVsbDtcblx0XHRcdGlzX2luaXRpYWxpemVkID0gZmFsc2U7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBjdXJyZW50IHByZXNlbnRhdGlvbi1vbmx5IGNlbGwtd2lkdGggcGVyY2VudGFnZS5cblx0XHQgKlxuXHRcdCAqIFRoaXMgcHVibGljIGRpYWdub3N0aWMgaXMgaW50ZW50aW9uYWxseSByZWFkLW9ubHkgYW5kIGRvZXMgbm90IGV4cG9zZSBvclxuXHRcdCAqIG1vZGlmeSBhdXRob3JpdGF0aXZlIFRpbWVsaW5lIHJlcXVlc3Qgc3RhdGUuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtudW1iZXJ9IEN1cnJlbnQgYm91bmRlZCB2aXN1YWwgZGVuc2l0eSBwZXJjZW50YWdlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF92aXN1YWxfem9vbV9wZXJjZW50KCkge1xuXHRcdFx0cmV0dXJuIHZpc3VhbF96b29tX3BlcmNlbnQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGluaXRpYWxpemU6IGluaXRpYWxpemUsXG5cdFx0XHRkZXN0cm95OiBkZXN0cm95LFxuXHRcdFx0cmVuZGVyX2NvbnRyb2xzOiByZW5kZXJfY29udHJvbHMsXG5cdFx0XHRyZWZyZXNoX2FmdGVyX3dpbmRvd19yZW5kZXI6IHJlZnJlc2hfYWZ0ZXJfd2luZG93X3JlbmRlcixcblx0XHRcdGhhbmRsZV9jbGljazogaGFuZGxlX2NsaWNrLFxuXHRcdFx0aGFuZGxlX2tleWRvd246IGhhbmRsZV9rZXlkb3duLFxuXHRcdFx0YXBwbHlfcmFuZ2Vfc2NhbGVfb3B0aW9uOiBhcHBseV9yYW5nZV9zY2FsZV9vcHRpb24sXG5cdFx0XHRhcHBseV9jdXN0b21fZGF0ZV9yYW5nZTogYXBwbHlfY3VzdG9tX2RhdGVfcmFuZ2UsXG5cdFx0XHRyZXNldF90b19kZWZhdWx0czogcmVzZXRfdG9fZGVmYXVsdHMsXG5cdFx0XHRuYXZpZ2F0ZV90b190b2RheTogbmF2aWdhdGVfdG9fdG9kYXksXG5cdFx0XHRuYXZpZ2F0ZV90b19kYXRlOiBuYXZpZ2F0ZV90b19kYXRlLFxuXHRcdFx0Y2hhbmdlX3Zpc3VhbF96b29tOiBjaGFuZ2VfdmlzdWFsX3pvb20sXG5cdFx0XHRnZXRfdmlzdWFsX3pvb21fcGVyY2VudDogZ2V0X3Zpc3VhbF96b29tX3BlcmNlbnRcblx0XHR9O1xuXHR9XG5cblx0aWYgKCB3aW5kb3cud3BiY190aW1lbGluZV9tb2R1bGVzICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY190aW1lbGluZV9tb2R1bGVzLnJlZ2lzdGVyX2ZhY3RvcnkgKSB7XG5cdFx0d2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcy5yZWdpc3Rlcl9mYWN0b3J5KCBtb2R1bGVfaWQsIGNyZWF0ZV90b29sYmFyX25hdmlnYXRpb25fY29udHJvbGxlciApO1xuXHR9XG59KCB3aW5kb3csIGRvY3VtZW50LCB3aW5kb3cud3AgKSApO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDRSxXQUFXQSxNQUFNLEVBQUVDLFFBQVEsRUFBRUMsRUFBRSxFQUFHO0VBQ25DLFlBQVk7O0VBRVosSUFBSUMsU0FBUyxHQUFHLG9CQUFvQjs7RUFFcEM7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0Msb0NBQW9DQSxDQUFFQyxPQUFPLEVBQUc7SUFDeEQsSUFBSUMsS0FBSyxHQUFHRCxPQUFPLENBQUNDLEtBQUssSUFBSSxJQUFJO0lBQ2pDLElBQUlDLFFBQVEsR0FBR0YsT0FBTyxDQUFDRSxRQUFRLElBQUksQ0FBQyxDQUFDO0lBQ3JDLElBQUlDLFlBQVksR0FBR0gsT0FBTyxDQUFDRyxZQUFZLElBQUksSUFBSTtJQUMvQyxJQUFJQyxTQUFTLEdBQUdKLE9BQU8sQ0FBQ0ksU0FBUyxJQUFJLENBQUMsQ0FBQztJQUN2QyxJQUFJQyx5QkFBeUIsR0FBR0MsNkJBQTZCLENBQUMsQ0FBQztJQUMvRCxJQUFJQyxtQkFBbUIsR0FBR0YseUJBQXlCLENBQUNHLGVBQWU7SUFDbkUsSUFBSUMsa0JBQWtCLEdBQUcsSUFBSTtJQUM3QixJQUFJQyxpQkFBaUIsR0FBRyxDQUFDO0lBQ3pCLElBQUlDLGNBQWMsR0FBRyxLQUFLOztJQUUxQjtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNDLGVBQWVBLENBQUVDLGFBQWEsRUFBRztNQUN6QyxJQUFJQyxRQUFRLEdBQUdWLFNBQVMsQ0FBRVMsYUFBYSxDQUFFO01BQ3pDLElBQUlFLGtCQUFrQixHQUFHQyxLQUFLLENBQUNDLFNBQVMsQ0FBQ0MsS0FBSyxDQUFDQyxJQUFJLENBQUVDLFNBQVMsRUFBRSxDQUFFLENBQUM7TUFFbkUsT0FBTyxVQUFVLEtBQUssT0FBT04sUUFBUSxHQUFHQSxRQUFRLENBQUNPLEtBQUssQ0FBRSxJQUFJLEVBQUVOLGtCQUFtQixDQUFDLEdBQUcsSUFBSTtJQUMxRjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU1QsNkJBQTZCQSxDQUFBLEVBQUc7TUFDeEMsSUFBSWdCLFVBQVUsR0FBR3BCLFFBQVEsQ0FBQ3FCLFFBQVEsSUFBSXJCLFFBQVEsQ0FBQ3FCLFFBQVEsQ0FBQ0MsV0FBVyxHQUFHdEIsUUFBUSxDQUFDcUIsUUFBUSxDQUFDQyxXQUFXLEdBQUcsQ0FBQyxDQUFDO01BQ3hHLElBQUlDLGNBQWMsR0FBR3ZCLFFBQVEsQ0FBQ3dCLFdBQVcsR0FBR0MsTUFBTSxDQUFFekIsUUFBUSxDQUFDd0IsV0FBVyxDQUFDbkIsbUJBQW9CLENBQUMsR0FBRyxDQUFDO01BQ2xHLElBQUlxQixXQUFXLEdBQUdDLElBQUksQ0FBQ0MsR0FBRyxDQUFFLEVBQUUsRUFBRUQsSUFBSSxDQUFDRSxHQUFHLENBQUUsR0FBRyxFQUFFRixJQUFJLENBQUNHLEtBQUssQ0FBRUwsTUFBTSxDQUFFTCxVQUFVLENBQUNNLFdBQVksQ0FBQyxJQUFJLEVBQUcsQ0FBRSxDQUFFLENBQUM7TUFDdkcsSUFBSUssV0FBVyxHQUFHSixJQUFJLENBQUNDLEdBQUcsQ0FBRUYsV0FBVyxFQUFFQyxJQUFJLENBQUNFLEdBQUcsQ0FBRSxHQUFHLEVBQUVGLElBQUksQ0FBQ0csS0FBSyxDQUFFTCxNQUFNLENBQUVMLFVBQVUsQ0FBQ1csV0FBWSxDQUFDLElBQUksR0FBSSxDQUFFLENBQUUsQ0FBQztNQUNqSCxJQUFJQyxZQUFZLEdBQUdMLElBQUksQ0FBQ0MsR0FBRyxDQUFFLENBQUMsRUFBRUQsSUFBSSxDQUFDRSxHQUFHLENBQUVFLFdBQVcsR0FBR0wsV0FBVyxJQUFJLENBQUMsRUFBRUMsSUFBSSxDQUFDRyxLQUFLLENBQUVMLE1BQU0sQ0FBRUwsVUFBVSxDQUFDWSxZQUFhLENBQUMsSUFBSSxFQUFHLENBQUUsQ0FBRSxDQUFDO01BQ25JLElBQUlDLDBCQUEwQixHQUFHUixNQUFNLENBQUVMLFVBQVUsQ0FBQ2QsZUFBZ0IsQ0FBQyxJQUFJLEdBQUc7TUFDNUUsSUFBSUEsZUFBZSxHQUFHaUIsY0FBYyxJQUFJVSwwQkFBMEI7TUFFbEVBLDBCQUEwQixHQUFHTixJQUFJLENBQUNDLEdBQUcsQ0FBRUYsV0FBVyxFQUFFQyxJQUFJLENBQUNFLEdBQUcsQ0FBRUUsV0FBVyxFQUFFSixJQUFJLENBQUNHLEtBQUssQ0FBRUcsMEJBQTJCLENBQUUsQ0FBRSxDQUFDO01BQ3ZIQSwwQkFBMEIsR0FBR1AsV0FBVyxHQUFHQyxJQUFJLENBQUNHLEtBQUssQ0FBRSxDQUFFRywwQkFBMEIsR0FBR1AsV0FBVyxJQUFLTSxZQUFhLENBQUMsR0FBR0EsWUFBWTtNQUNuSUMsMEJBQTBCLEdBQUdOLElBQUksQ0FBQ0UsR0FBRyxDQUFFRSxXQUFXLEVBQUVFLDBCQUEyQixDQUFDO01BQ2hGM0IsZUFBZSxHQUFHcUIsSUFBSSxDQUFDQyxHQUFHLENBQUVGLFdBQVcsRUFBRUMsSUFBSSxDQUFDRSxHQUFHLENBQUVFLFdBQVcsRUFBRUosSUFBSSxDQUFDRyxLQUFLLENBQUV4QixlQUFnQixDQUFFLENBQUUsQ0FBQztNQUNqR0EsZUFBZSxHQUFHb0IsV0FBVyxHQUFHQyxJQUFJLENBQUNHLEtBQUssQ0FBRSxDQUFFeEIsZUFBZSxHQUFHb0IsV0FBVyxJQUFLTSxZQUFhLENBQUMsR0FBR0EsWUFBWTtNQUM3RzFCLGVBQWUsR0FBR3FCLElBQUksQ0FBQ0UsR0FBRyxDQUFFRSxXQUFXLEVBQUV6QixlQUFnQixDQUFDO01BRTFELE9BQU87UUFDTm9CLFdBQVcsRUFBRUEsV0FBVztRQUN4QkssV0FBVyxFQUFFQSxXQUFXO1FBQ3hCQyxZQUFZLEVBQUVBLFlBQVk7UUFDMUJDLDBCQUEwQixFQUFFQSwwQkFBMEI7UUFDdEQzQixlQUFlLEVBQUVBO01BQ2xCLENBQUM7SUFDRjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTNEIsc0JBQXNCQSxDQUFFQyxZQUFZLEVBQUc7TUFDL0MsSUFBSUMsV0FBVyxHQUFHcEMsUUFBUSxDQUFDcUMsU0FBUyxJQUFJckMsUUFBUSxDQUFDcUMsU0FBUyxDQUFDQyxTQUFTLEdBQ2pFdEMsUUFBUSxDQUFDcUMsU0FBUyxDQUFDQyxTQUFTLENBQUVILFlBQVksQ0FBRSxHQUM1QyxFQUFFO01BRUwsSUFBSyxDQUFFQyxXQUFXLElBQUksQ0FBRXpDLEVBQUUsSUFBSSxVQUFVLEtBQUssT0FBT0EsRUFBRSxDQUFDNEMsUUFBUSxFQUFHO1FBQ2pFLE9BQU8sSUFBSTtNQUNaO01BRUEsT0FBTzVDLEVBQUUsQ0FBQzRDLFFBQVEsQ0FBRUgsV0FBWSxDQUFDO0lBQ2xDOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTSSx5QkFBeUJBLENBQUVDLE1BQU0sRUFBRU4sWUFBWSxFQUFFTyxVQUFVLEVBQUc7TUFDdEUsSUFBSUgsUUFBUSxHQUFHTCxzQkFBc0IsQ0FBRUMsWUFBYSxDQUFDO01BRXJELElBQUssQ0FBRU0sTUFBTSxJQUFJLENBQUVGLFFBQVEsRUFBRztRQUM3QixPQUFPLEtBQUs7TUFDYjtNQUNBRSxNQUFNLENBQUNFLFNBQVMsR0FBR0osUUFBUSxDQUFFRyxVQUFXLENBQUM7TUFDekMsT0FBTyxJQUFJO0lBQ1o7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0Usc0JBQXNCQSxDQUFFQyxZQUFZLEVBQUc7TUFDL0MsSUFBSUMsZUFBZSxHQUFHLElBQUk7TUFFMUIsQ0FBRTlDLFFBQVEsQ0FBQ3FCLFFBQVEsQ0FBQzBCLG1CQUFtQixJQUFJLEVBQUUsRUFBR0MsSUFBSSxDQUFFLFVBQVdDLGtCQUFrQixFQUFHO1FBQ3JGLElBQUtDLE1BQU0sQ0FBRUQsa0JBQWtCLENBQUNFLEtBQU0sQ0FBQyxLQUFLRCxNQUFNLENBQUVMLFlBQWEsQ0FBQyxFQUFHO1VBQ3BFQyxlQUFlLEdBQUdHLGtCQUFrQjtVQUNwQyxPQUFPLElBQUk7UUFDWjtRQUNBLE9BQU8sS0FBSztNQUNiLENBQUUsQ0FBQztNQUVILE9BQU9ILGVBQWU7SUFDdkI7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTTSx5QkFBeUJBLENBQUVDLFdBQVcsRUFBRUMsV0FBVyxFQUFHO01BQzlELE9BQU9KLE1BQU0sQ0FBRWxELFFBQVEsQ0FBQ3VELElBQUksQ0FBQ0MsMkJBQTJCLElBQUksYUFBYyxDQUFDLENBQ3pFQyxPQUFPLENBQUUsTUFBTSxFQUFFUCxNQUFNLENBQUVHLFdBQVcsSUFBSSxFQUFHLENBQUUsQ0FBQyxDQUM5Q0ksT0FBTyxDQUFFLE1BQU0sRUFBRVAsTUFBTSxDQUFFSSxXQUFXLElBQUksRUFBRyxDQUFFLENBQUM7SUFDakQ7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNJLHFDQUFxQ0EsQ0FBQSxFQUFHO01BQ2hELElBQUlDLHFCQUFxQixHQUFHLFFBQVE7TUFDcEMsSUFBSUMsWUFBWSxHQUFHNUQsUUFBUSxDQUFDNkQsWUFBWSxJQUFJN0QsUUFBUSxDQUFDNkQsWUFBWSxDQUFDQyxJQUFJLEdBQUc5RCxRQUFRLENBQUM2RCxZQUFZLENBQUNDLElBQUksR0FBRzlELFFBQVEsQ0FBQytELElBQUksQ0FBQ0QsSUFBSTtNQUV4SCxDQUFFOUQsUUFBUSxDQUFDcUIsUUFBUSxDQUFDMEIsbUJBQW1CLElBQUksRUFBRSxFQUFHQyxJQUFJLENBQUUsVUFBV0Msa0JBQWtCLEVBQUc7UUFDckYsSUFBSWUsYUFBYSxHQUFHdkMsTUFBTSxDQUFFd0Isa0JBQWtCLENBQUNnQixhQUFjLENBQUM7UUFDOUQsSUFBSUMsY0FBYyxHQUFHLENBQUMsR0FBR0YsYUFBYSxJQUFJQSxhQUFhLEtBQUt2QyxNQUFNLENBQUV6QixRQUFRLENBQUNQLE1BQU0sQ0FBQ3dFLGFBQWMsQ0FBQztRQUNuRyxJQUFJRSxZQUFZLEdBQUcsQ0FBQyxLQUFLSCxhQUFhLElBQUksQ0FBQyxLQUFLdkMsTUFBTSxDQUFFekIsUUFBUSxDQUFDUCxNQUFNLENBQUN3RSxhQUFjLENBQUMsSUFBSXhDLE1BQU0sQ0FBRXdCLGtCQUFrQixDQUFDbUIsV0FBWSxDQUFDLEtBQUszQyxNQUFNLENBQUV6QixRQUFRLENBQUNQLE1BQU0sQ0FBQzJFLFdBQVksQ0FBQztRQUU3SyxJQUFLbEIsTUFBTSxDQUFFRCxrQkFBa0IsQ0FBQ29CLE9BQVEsQ0FBQyxLQUFLbkIsTUFBTSxDQUFFVSxZQUFhLENBQUMsS0FBTU0sY0FBYyxJQUFJQyxZQUFZLENBQUUsRUFBRztVQUM1R1IscUJBQXFCLEdBQUdULE1BQU0sQ0FBRUQsa0JBQWtCLENBQUNFLEtBQU0sQ0FBQztVQUMxRCxPQUFPLElBQUk7UUFDWjtRQUNBLE9BQU8sS0FBSztNQUNiLENBQUUsQ0FBQztNQUVILE9BQU9RLHFCQUFxQjtJQUM3Qjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU1csZ0JBQWdCQSxDQUFFQyxPQUFPLEVBQUVDLGNBQWMsRUFBRUMsY0FBYyxFQUFHO01BQ3BFLElBQUlDLGNBQWMsR0FBR0QsY0FBYyxJQUFJRCxjQUFjO01BRXJELENBQUVELE9BQU8sSUFBSSxFQUFFLEVBQUd2QixJQUFJLENBQUUsVUFBVzJCLE1BQU0sRUFBRztRQUMzQyxJQUFLekIsTUFBTSxDQUFFeUIsTUFBTSxDQUFDQyxFQUFHLENBQUMsS0FBSzFCLE1BQU0sQ0FBRXNCLGNBQWUsQ0FBQyxFQUFHO1VBQ3ZERSxjQUFjLEdBQUdDLE1BQU0sQ0FBQ0UsS0FBSztVQUM3QixPQUFPLElBQUk7UUFDWjtRQUNBLE9BQU8sS0FBSztNQUNiLENBQUUsQ0FBQztNQUVILE9BQU9ILGNBQWM7SUFDdEI7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0ksNkJBQTZCQSxDQUFFVCxPQUFPLEVBQUc7TUFDakQsSUFBSyxLQUFLLEtBQUtuQixNQUFNLENBQUVtQixPQUFRLENBQUMsRUFBRztRQUNsQyxPQUFPLG1CQUFtQjtNQUMzQjtNQUNBLElBQUssQ0FBQyxDQUFDLEtBQUtuQixNQUFNLENBQUVtQixPQUFRLENBQUMsQ0FBQ1UsT0FBTyxDQUFFLFNBQVUsQ0FBQyxFQUFHO1FBQ3BELE9BQU8sbUJBQW1CO01BQzNCO01BQ0EsT0FBTyxlQUFlO0lBQ3ZCOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTQyx1QkFBdUJBLENBQUEsRUFBRztNQUNsQyxJQUFJQyxJQUFJLEdBQUdsRixLQUFLLENBQUNtRixhQUFhLENBQUUsb0RBQXFELENBQUM7TUFDdEYsSUFBSVYsY0FBYyxHQUFHZCxxQ0FBcUMsQ0FBQyxDQUFDO01BQzVELElBQUl5QixlQUFlLEdBQUd2QyxzQkFBc0IsQ0FBRTRCLGNBQWUsQ0FBQztNQUM5RCxJQUFJWixZQUFZLEdBQUc1RCxRQUFRLENBQUM2RCxZQUFZLElBQUk3RCxRQUFRLENBQUM2RCxZQUFZLENBQUNDLElBQUksR0FBRzlELFFBQVEsQ0FBQzZELFlBQVksQ0FBQ0MsSUFBSSxHQUFHOUQsUUFBUSxDQUFDK0QsSUFBSSxDQUFDRCxJQUFJO01BQ3hILElBQUlzQixhQUFhLEdBQUcsRUFBRTtNQUN0QixJQUFJQyxZQUFZLEdBQUdqQyx5QkFBeUIsQ0FDM0NwRCxRQUFRLENBQUN1RCxJQUFJLENBQUMrQixZQUFZLEVBQzFCaEIsZ0JBQWdCLENBQUV0RSxRQUFRLENBQUNxQixRQUFRLENBQUNrRSxLQUFLLEVBQUUzQixZQUFZLEVBQUVBLFlBQWEsQ0FDdkUsQ0FBQztNQUNELElBQUlXLE9BQU8sR0FBRyxDQUFFO1FBQ2ZpQixJQUFJLEVBQUUsUUFBUTtRQUNkckMsS0FBSyxFQUFFLFFBQVE7UUFDZjBCLEtBQUssRUFBRVEsWUFBWTtRQUNuQkksVUFBVSxFQUFFWCw2QkFBNkIsQ0FBRWxCLFlBQWEsQ0FBQztRQUN6RDhCLFFBQVEsRUFBRTtNQUNYLENBQUMsQ0FBRTtNQUVILENBQUUxRixRQUFRLENBQUNxQixRQUFRLENBQUMwQixtQkFBbUIsSUFBSSxFQUFFLEVBQUc0QyxPQUFPLENBQUUsVUFBVzFDLGtCQUFrQixFQUFHO1FBQ3hGLElBQUttQyxhQUFhLEtBQUtsQyxNQUFNLENBQUVELGtCQUFrQixDQUFDMkMsU0FBVSxDQUFDLEVBQUc7VUFDL0RSLGFBQWEsR0FBR2xDLE1BQU0sQ0FBRUQsa0JBQWtCLENBQUMyQyxTQUFVLENBQUM7VUFDdERyQixPQUFPLENBQUNzQixJQUFJLENBQUU7WUFBRUwsSUFBSSxFQUFFO1VBQVksQ0FBRSxDQUFDO1VBQ3JDakIsT0FBTyxDQUFDc0IsSUFBSSxDQUFFO1lBQUVMLElBQUksRUFBRSxTQUFTO1lBQUVYLEtBQUssRUFBRTVCLGtCQUFrQixDQUFDNkM7VUFBYSxDQUFFLENBQUM7UUFDNUU7UUFDQXZCLE9BQU8sQ0FBQ3NCLElBQUksQ0FBRTtVQUNiTCxJQUFJLEVBQUUsUUFBUTtVQUNkckMsS0FBSyxFQUFFRixrQkFBa0IsQ0FBQ0UsS0FBSztVQUMvQjBCLEtBQUssRUFBRTVCLGtCQUFrQixDQUFDOEMsS0FBSztVQUMvQk4sVUFBVSxFQUFFWCw2QkFBNkIsQ0FBRTdCLGtCQUFrQixDQUFDb0IsT0FBUSxDQUFDO1VBQ3ZFcUIsUUFBUSxFQUFFO1FBQ1gsQ0FBRSxDQUFDO01BQ0osQ0FBRSxDQUFDO01BQ0hsRCx5QkFBeUIsQ0FBRXlDLElBQUksRUFBRSxVQUFVLEVBQUU7UUFDNUNMLEVBQUUsRUFBRSxvQ0FBb0M7UUFDeENDLEtBQUssRUFBRTdFLFFBQVEsQ0FBQ3VELElBQUksQ0FBQ3lDLDBCQUEwQjtRQUMvQ0MsWUFBWSxFQUFFLGdEQUFnRDtRQUM5RHpCLGNBQWMsRUFBRUEsY0FBYztRQUM5QkUsY0FBYyxFQUFFUyxlQUFlLEdBQUdBLGVBQWUsQ0FBQ1ksS0FBSyxHQUFHVixZQUFZO1FBQ3RFSSxVQUFVLEVBQUVYLDZCQUE2QixDQUFFbEIsWUFBYSxDQUFDO1FBQ3pEVyxPQUFPLEVBQUVBO01BQ1YsQ0FBRSxDQUFDO0lBQ0o7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTMkIsY0FBY0EsQ0FBRUMsUUFBUSxFQUFFQyxTQUFTLEVBQUc7TUFDOUMsSUFBSUMsS0FBSyxHQUFHbkQsTUFBTSxDQUFFaUQsUUFBUSxJQUFJLEVBQUcsQ0FBQyxDQUFDRSxLQUFLLENBQUUsMkJBQTRCLENBQUM7TUFDekUsSUFBSUMsWUFBWTtNQUVoQixJQUFLLENBQUVELEtBQUssRUFBRztRQUNkLE9BQU8sRUFBRTtNQUNWO01BQ0FDLFlBQVksR0FBRyxJQUFJQyxJQUFJLENBQUVBLElBQUksQ0FBQ0MsR0FBRyxDQUFFL0UsTUFBTSxDQUFFNEUsS0FBSyxDQUFFLENBQUMsQ0FBRyxDQUFDLEVBQUU1RSxNQUFNLENBQUU0RSxLQUFLLENBQUUsQ0FBQyxDQUFHLENBQUMsR0FBRyxDQUFDLEVBQUU1RSxNQUFNLENBQUU0RSxLQUFLLENBQUUsQ0FBQyxDQUFHLENBQUMsR0FBR0QsU0FBVSxDQUFFLENBQUM7TUFDdkgsT0FBT0UsWUFBWSxDQUFDRyxjQUFjLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFFLEdBQUcsR0FBR3ZELE1BQU0sQ0FBRW9ELFlBQVksQ0FBQ0ksV0FBVyxDQUFDLENBQUMsR0FBRyxDQUFFLENBQUMsRUFBRzFGLEtBQUssQ0FBRSxDQUFDLENBQUUsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFFLEdBQUcsR0FBR2tDLE1BQU0sQ0FBRW9ELFlBQVksQ0FBQ0ssVUFBVSxDQUFDLENBQUUsQ0FBQyxFQUFHM0YsS0FBSyxDQUFFLENBQUMsQ0FBRSxDQUFDO0lBQzlLOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTNEYsMkJBQTJCQSxDQUFBLEVBQUc7TUFDdEMsSUFBSTdDLElBQUksR0FBRy9ELFFBQVEsQ0FBQzZELFlBQVksSUFBSTdELFFBQVEsQ0FBQytELElBQUksSUFBSSxDQUFDLENBQUM7TUFDdkQsSUFBSThDLFVBQVUsR0FBRzNELE1BQU0sQ0FBRWEsSUFBSSxDQUFDK0MsUUFBUSxJQUFJLEVBQUcsQ0FBQyxDQUFDOUYsS0FBSyxDQUFFLENBQUMsRUFBRSxFQUFHLENBQUM7TUFDN0QsSUFBSStGLGtCQUFrQixHQUFHN0QsTUFBTSxDQUFFYSxJQUFJLENBQUNpRCxNQUFNLElBQUksRUFBRyxDQUFDLENBQUNoRyxLQUFLLENBQUUsQ0FBQyxFQUFFLEVBQUcsQ0FBQztNQUVuRSxPQUFPO1FBQ042RixVQUFVLEVBQUVBLFVBQVU7UUFDdEJJLFFBQVEsRUFBRWYsY0FBYyxDQUFFYSxrQkFBa0IsRUFBRSxDQUFDLENBQUU7TUFDbEQsQ0FBQztJQUNGOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTRyw0QkFBNEJBLENBQUEsRUFBRztNQUN2QyxJQUFJakMsSUFBSSxHQUFHbEYsS0FBSyxDQUFDbUYsYUFBYSxDQUFFLDRDQUE2QyxDQUFDO01BQzlFLElBQUlpQyxVQUFVLEdBQUdQLDJCQUEyQixDQUFDLENBQUM7TUFFOUNwRSx5QkFBeUIsQ0FBRXlDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtRQUN6REwsRUFBRSxFQUFFLDBCQUEwQjtRQUM5QnZCLFdBQVcsRUFBRXJELFFBQVEsQ0FBQzZELFlBQVksSUFBSTdELFFBQVEsQ0FBQzZELFlBQVksQ0FBQ1IsV0FBVyxHQUFHckQsUUFBUSxDQUFDNkQsWUFBWSxDQUFDUixXQUFXLEdBQUdyRCxRQUFRLENBQUMrRCxJQUFJLENBQUNWLFdBQVc7UUFDdkl3RCxVQUFVLEVBQUVNLFVBQVUsQ0FBQ04sVUFBVTtRQUNqQ0ksUUFBUSxFQUFFRSxVQUFVLENBQUNGLFFBQVE7UUFDN0JHLFNBQVMsRUFBRXBILFFBQVEsQ0FBQ3FDLFNBQVMsR0FBR1osTUFBTSxDQUFFekIsUUFBUSxDQUFDcUMsU0FBUyxDQUFDK0UsU0FBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUM7UUFDL0VDLGlCQUFpQixFQUFFckgsUUFBUSxDQUFDcUIsUUFBUSxJQUFJckIsUUFBUSxDQUFDcUIsUUFBUSxDQUFDaUcsTUFBTSxHQUFHN0YsTUFBTSxDQUFFekIsUUFBUSxDQUFDcUIsUUFBUSxDQUFDaUcsTUFBTSxDQUFDQyxtQkFBb0IsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFO1FBQ3BJQyxjQUFjLEVBQUV4SCxRQUFRLENBQUN1RCxJQUFJLENBQUNrRSxlQUFlO1FBQzdDQyxVQUFVLEVBQUUxSCxRQUFRLENBQUN1RCxJQUFJLENBQUNvRSxXQUFXO1FBQ3JDQyxZQUFZLEVBQUU1SCxRQUFRLENBQUN1RCxJQUFJLENBQUNzRSxpQkFBaUI7UUFDN0NDLFdBQVcsRUFBRTlILFFBQVEsQ0FBQ3VELElBQUksQ0FBQ3NELFVBQVU7UUFDckNrQixTQUFTLEVBQUUvSCxRQUFRLENBQUN1RCxJQUFJLENBQUMwRCxRQUFRO1FBQ2pDZSxXQUFXLEVBQUVoSSxRQUFRLENBQUN1RCxJQUFJLENBQUMwRSxnQkFBZ0I7UUFDM0NDLFdBQVcsRUFBRWxJLFFBQVEsQ0FBQ3VELElBQUksQ0FBQzRFLGdCQUFnQjtRQUMzQ0MsWUFBWSxFQUFFcEksUUFBUSxDQUFDdUQsSUFBSSxDQUFDOEUsTUFBTTtRQUNsQ0MsZUFBZSxFQUFFdEksUUFBUSxDQUFDdUQsSUFBSSxDQUFDZ0Ysa0JBQWtCO1FBQ2pEQyxlQUFlLEVBQUV4SSxRQUFRLENBQUN1RCxJQUFJLENBQUNrRjtNQUNoQyxDQUFFLENBQUM7SUFDSjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0MsZ0JBQWdCQSxDQUFBLEVBQUc7TUFDM0IsSUFBSXpELElBQUksR0FBR2xGLEtBQUssQ0FBQ21GLGFBQWEsQ0FBRSxnQ0FBaUMsQ0FBQztNQUVsRTFDLHlCQUF5QixDQUFFeUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtRQUM3Q0wsRUFBRSxFQUFFLHlCQUF5QjtRQUM3QitELFlBQVksRUFBRTNJLFFBQVEsQ0FBQ3VELElBQUksQ0FBQ3FGLEtBQUs7UUFDakNDLGlCQUFpQixFQUFFN0ksUUFBUSxDQUFDdUQsSUFBSSxDQUFDdUYsZ0JBQWdCO1FBQ2pEQyxVQUFVLEVBQUUvSSxRQUFRLENBQUN1RCxJQUFJLENBQUN5RixTQUFTO1FBQ25DQyxhQUFhLEVBQUVqSixRQUFRLENBQUNxQyxTQUFTLEdBQUdhLE1BQU0sQ0FBRWxELFFBQVEsQ0FBQ3FDLFNBQVMsQ0FBQzZHLFVBQVUsSUFBSSxFQUFHLENBQUMsR0FBRyxFQUFFO1FBQ3RGOUIsU0FBUyxFQUFFcEgsUUFBUSxDQUFDcUMsU0FBUyxHQUFHWixNQUFNLENBQUV6QixRQUFRLENBQUNxQyxTQUFTLENBQUMrRSxTQUFVLENBQUMsSUFBSSxDQUFDLEdBQUc7TUFDL0UsQ0FBRSxDQUFDO0lBQ0o7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVMrQiwrQkFBK0JBLENBQUEsRUFBRztNQUMxQyxJQUFJbEUsSUFBSSxHQUFHbEYsS0FBSyxDQUFDbUYsYUFBYSxDQUFFLDZDQUE4QyxDQUFDO01BRS9FMUMseUJBQXlCLENBQUV5QyxJQUFJLEVBQUUsd0JBQXdCLEVBQUU7UUFDMURMLEVBQUUsRUFBRSxpQ0FBaUM7UUFDckNDLEtBQUssRUFBRTdFLFFBQVEsQ0FBQ3VELElBQUksQ0FBQzZGLGNBQWM7UUFDbkNDLFdBQVcsRUFBRXJKLFFBQVEsQ0FBQ3VELElBQUksQ0FBQytGLDBCQUEwQjtRQUNyRDdELFVBQVUsRUFBRSxrQkFBa0I7UUFDOUJDLFFBQVEsRUFBRTtNQUNYLENBQUUsQ0FBQztJQUNKOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTNkQsaUNBQWlDQSxDQUFBLEVBQUc7TUFDNUMsSUFBSUMsSUFBSSxHQUFHekosS0FBSyxDQUFDbUYsYUFBYSxDQUFFLHdFQUF5RSxDQUFDO01BQzFHLElBQUk3QixXQUFXLEdBQUdtRyxJQUFJLEdBQUdBLElBQUksQ0FBQ3RFLGFBQWEsQ0FBRSx3Q0FBeUMsQ0FBQyxHQUFHLElBQUk7TUFDOUYsSUFBSXVFLFdBQVcsR0FBR0QsSUFBSSxHQUFHQSxJQUFJLENBQUN0RSxhQUFhLENBQUUsd0NBQXlDLENBQUMsR0FBRyxJQUFJO01BQzlGLElBQUl3RSxTQUFTLEdBQUdGLElBQUksR0FBR0EsSUFBSSxDQUFDdEUsYUFBYSxDQUFFLHNDQUF1QyxDQUFDLEdBQUcsSUFBSTtNQUMxRixJQUFJaUMsVUFBVSxHQUFHUCwyQkFBMkIsQ0FBQyxDQUFDO01BRTlDLElBQUssQ0FBRTRDLElBQUksRUFBRztRQUNiO01BQ0Q7TUFDQSxJQUFLbkcsV0FBVyxFQUFHO1FBQ2xCQSxXQUFXLENBQUNzRyxXQUFXLEdBQUczSixRQUFRLENBQUM2RCxZQUFZLElBQUk3RCxRQUFRLENBQUM2RCxZQUFZLENBQUNSLFdBQVcsR0FBR3JELFFBQVEsQ0FBQzZELFlBQVksQ0FBQ1IsV0FBVyxHQUFHckQsUUFBUSxDQUFDK0QsSUFBSSxDQUFDVixXQUFXO01BQ3JKO01BQ0FtRyxJQUFJLENBQUNJLFlBQVksQ0FBRSxpQkFBaUIsRUFBRXpDLFVBQVUsQ0FBQ04sVUFBVyxDQUFDO01BQzdEMkMsSUFBSSxDQUFDSSxZQUFZLENBQUUsZUFBZSxFQUFFekMsVUFBVSxDQUFDRixRQUFTLENBQUM7TUFDekQsSUFBS3VDLElBQUksQ0FBQ3RFLGFBQWEsQ0FBRSx1Q0FBd0MsQ0FBQyxFQUFHO1FBQ3BFO01BQ0Q7TUFDQSxJQUFLdUUsV0FBVyxFQUFHO1FBQ2xCQSxXQUFXLENBQUN0RyxLQUFLLEdBQUdnRSxVQUFVLENBQUNOLFVBQVU7TUFDMUM7TUFDQSxJQUFLNkMsU0FBUyxFQUFHO1FBQ2hCQSxTQUFTLENBQUN2RyxLQUFLLEdBQUdnRSxVQUFVLENBQUNGLFFBQVE7TUFDdEM7SUFDRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTNEMsMkJBQTJCQSxDQUFFQyxhQUFhLEVBQUV0RixjQUFjLEVBQUV1RixXQUFXLEVBQUVDLGVBQWUsRUFBRztNQUNuRyxJQUFJQyxPQUFPO01BQ1gsSUFBSUMsS0FBSztNQUNULElBQUlDLFdBQVc7TUFDZixJQUFJQyxZQUFZO01BQ2hCLElBQUlqRixlQUFlLEdBQUcsSUFBSTtNQUUxQixJQUFLLENBQUUyRSxhQUFhLEVBQUc7UUFDdEI7TUFDRDtNQUNBRyxPQUFPLEdBQUdILGFBQWEsQ0FBQzVFLGFBQWEsQ0FBRSx3Q0FBeUMsQ0FBQztNQUNqRmdGLEtBQUssR0FBR0osYUFBYSxDQUFDNUUsYUFBYSxDQUFFLHNDQUF1QyxDQUFDO01BQzdFaUYsV0FBVyxHQUFHTCxhQUFhLENBQUM1RSxhQUFhLENBQUUsc0NBQXVDLENBQUM7TUFDbkZrRixZQUFZLEdBQUdOLGFBQWEsQ0FBQzVFLGFBQWEsQ0FBRSxzQ0FBdUMsQ0FBQztNQUNwRjRFLGFBQWEsQ0FBQ0YsWUFBWSxDQUFFLG9DQUFvQyxFQUFFcEYsY0FBZSxDQUFDO01BQ2xGMUQsS0FBSyxDQUFDQyxTQUFTLENBQUM0RSxPQUFPLENBQUMxRSxJQUFJLENBQUU2SSxhQUFhLENBQUNPLGdCQUFnQixDQUFFLHVDQUF3QyxDQUFDLEVBQUUsVUFBVzFGLE1BQU0sRUFBRztRQUM1SCxJQUFJOUIsWUFBWSxHQUFHOEIsTUFBTSxDQUFDMkYsWUFBWSxDQUFFLFlBQWEsQ0FBQyxJQUFJLEVBQUU7UUFDNUQsSUFBSUMsV0FBVyxHQUFHMUgsWUFBWSxLQUFLMkIsY0FBYztRQUNqRCxJQUFJZ0csZUFBZSxHQUFHLENBQUMsQ0FBQyxLQUFLUixlQUFlLENBQUNqRixPQUFPLENBQUVsQyxZQUFhLENBQUM7UUFFcEU4QixNQUFNLENBQUM4RixTQUFTLENBQUNDLE1BQU0sQ0FBRSxhQUFhLEVBQUVILFdBQVksQ0FBQztRQUNyRDVGLE1BQU0sQ0FBQ2lGLFlBQVksQ0FBRSxlQUFlLEVBQUVXLFdBQVcsR0FBRyxNQUFNLEdBQUcsT0FBUSxDQUFDO1FBQ3RFNUYsTUFBTSxDQUFDZSxRQUFRLEdBQUc4RSxlQUFlO1FBQ2pDN0YsTUFBTSxDQUFDaUYsWUFBWSxDQUFFLGVBQWUsRUFBRVksZUFBZSxHQUFHLE1BQU0sR0FBRyxPQUFRLENBQUM7UUFDMUUsSUFBS0QsV0FBVyxFQUFHO1VBQ2xCcEYsZUFBZSxHQUFHUixNQUFNO1FBQ3pCO01BQ0QsQ0FBRSxDQUFDO01BQ0gsSUFBS3NGLE9BQU8sRUFBRztRQUNkQSxPQUFPLENBQUN2RSxRQUFRLEdBQUdxRSxXQUFXO1FBQzlCLElBQUtBLFdBQVcsRUFBRztVQUNsQkUsT0FBTyxDQUFDTCxZQUFZLENBQUUsZUFBZSxFQUFFLE9BQVEsQ0FBQztRQUNqRDtNQUNEO01BQ0EsSUFBS00sS0FBSyxJQUFJSCxXQUFXLEVBQUc7UUFDM0JHLEtBQUssQ0FBQ1MsTUFBTSxHQUFHLElBQUk7UUFDbkJiLGFBQWEsQ0FBQ1csU0FBUyxDQUFDRyxNQUFNLENBQUUsU0FBVSxDQUFDO01BQzVDO01BQ0EsSUFBS1QsV0FBVyxJQUFJaEYsZUFBZSxFQUFHO1FBQ3JDZ0YsV0FBVyxDQUFDUixXQUFXLEdBQUd4RSxlQUFlLENBQUN3RSxXQUFXLENBQUNrQixJQUFJLENBQUMsQ0FBQztNQUM3RDtNQUNBLElBQUtULFlBQVksRUFBRztRQUNuQkEsWUFBWSxDQUFDakgsS0FBSyxHQUFHcUIsY0FBYztNQUNwQztJQUNEOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTc0cscUJBQXFCQSxDQUFBLEVBQUc7TUFDaEMsSUFBSUMsUUFBUSxHQUFHaEwsS0FBSyxDQUFDbUYsYUFBYSxDQUFFLGdCQUFpQixDQUFDO01BQ3RELElBQUk4RixjQUFjLEdBQUdoTCxRQUFRLENBQUNxQixRQUFRLElBQUlyQixRQUFRLENBQUNxQixRQUFRLENBQUMySixjQUFjLEdBQUdoTCxRQUFRLENBQUNxQixRQUFRLENBQUMySixjQUFjLEdBQUcsQ0FBQyxDQUFDO01BQ2xILElBQUlDLGVBQWU7TUFDbkIsSUFBSUMsaUJBQWlCO01BRXJCLElBQUssQ0FBRUgsUUFBUSxJQUFJLENBQUUvSyxRQUFRLENBQUMrRCxJQUFJLEVBQUc7UUFDcEM7TUFDRDtNQUNBa0gsZUFBZSxHQUFHeEosTUFBTSxDQUFFekIsUUFBUSxDQUFDK0QsSUFBSSxDQUFDb0gsYUFBYyxDQUFDLElBQUksRUFBRTtNQUM3REQsaUJBQWlCLEdBQUd2SixJQUFJLENBQUNDLEdBQUcsQ0FBRSxDQUFDLEVBQUVELElBQUksQ0FBQ0csS0FBSyxDQUFFbUosZUFBZSxHQUFHNUssbUJBQW1CLEdBQUcsR0FBSSxDQUFFLENBQUM7TUFDNUYwSyxRQUFRLENBQUNLLEtBQUssQ0FBQ0MsV0FBVyxDQUFFLHVCQUF1QixFQUFFNUosTUFBTSxDQUFFekIsUUFBUSxDQUFDK0QsSUFBSSxDQUFDdUgsVUFBVyxDQUFDLElBQUksQ0FBRSxDQUFDO01BQzlGUCxRQUFRLENBQUNLLEtBQUssQ0FBQ0MsV0FBVyxDQUFFLDRCQUE0QixFQUFFSCxpQkFBaUIsR0FBRyxJQUFLLENBQUM7TUFDcEZILFFBQVEsQ0FBQ0ssS0FBSyxDQUFDQyxXQUFXLENBQUUsNkJBQTZCLEVBQUVoTCxtQkFBb0IsQ0FBQztNQUNoRjBLLFFBQVEsQ0FBQ0ssS0FBSyxDQUFDQyxXQUFXLENBQUUsaURBQWlELEVBQUUsQ0FBRTVKLE1BQU0sQ0FBRXpCLFFBQVEsQ0FBQytELElBQUksQ0FBQ3dILGdCQUFpQixDQUFDLElBQUksRUFBRSxJQUFLLElBQUssQ0FBQztNQUMxSVIsUUFBUSxDQUFDSyxLQUFLLENBQUNDLFdBQVcsQ0FBRSxpREFBaUQsRUFBRTFKLElBQUksQ0FBQ0MsR0FBRyxDQUFFLENBQUMsRUFBRUgsTUFBTSxDQUFFdUosY0FBYyxDQUFDUSxzQkFBdUIsQ0FBQyxJQUFJLENBQUUsQ0FBRSxDQUFDO0lBQ3JKOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTQyxtQ0FBbUNBLENBQUEsRUFBRztNQUM5QyxJQUFJVixRQUFRLEdBQUdoTCxLQUFLLENBQUNtRixhQUFhLENBQUUsZ0JBQWlCLENBQUM7TUFDdEQsSUFBSXdHLFdBQVc7TUFDZixJQUFJQyxZQUFZLEdBQUcsS0FBSztNQUV4QixJQUFLLENBQUVaLFFBQVEsRUFBRztRQUNqQjtNQUNEO01BQ0FBLFFBQVEsQ0FBQ04sU0FBUyxDQUFDRyxNQUFNLENBQUUsMEJBQTJCLENBQUM7TUFDdkQsSUFBSyxDQUFFNUssUUFBUSxDQUFDK0QsSUFBSSxJQUFJLENBQUUvRCxRQUFRLENBQUMrRCxJQUFJLENBQUM2SCxRQUFRLEVBQUc7UUFDbEQ7TUFDRDtNQUNBRixXQUFXLEdBQUdYLFFBQVEsQ0FBQ1YsZ0JBQWdCLENBQUUsMERBQTJELENBQUM7TUFDckd2SixLQUFLLENBQUNDLFNBQVMsQ0FBQ2lDLElBQUksQ0FBQy9CLElBQUksQ0FBRXlLLFdBQVcsRUFBRSxVQUFXRyxVQUFVLEVBQUc7UUFDL0RGLFlBQVksR0FBR0UsVUFBVSxDQUFDQyxXQUFXLEdBQUdELFVBQVUsQ0FBQ0UsV0FBVztRQUM5RCxPQUFPSixZQUFZO01BQ3BCLENBQUUsQ0FBQztNQUNIWixRQUFRLENBQUNOLFNBQVMsQ0FBQ0MsTUFBTSxDQUFFLDBCQUEwQixFQUFFaUIsWUFBYSxDQUFDO0lBQ3RFOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNLLDZCQUE2QkEsQ0FBRUMsaUJBQWlCLEVBQUc7TUFDM0QsSUFBSUMsa0JBQWtCLEdBQUd6SyxNQUFNLENBQUV3SyxpQkFBa0IsQ0FBQztNQUVwRCxJQUFLLENBQUV4SyxNQUFNLENBQUMwSyxRQUFRLENBQUVELGtCQUFtQixDQUFDLEVBQUc7UUFDOUMsT0FBTzdMLG1CQUFtQjtNQUMzQjtNQUNBNkwsa0JBQWtCLEdBQUd2SyxJQUFJLENBQUNDLEdBQUcsQ0FBRXpCLHlCQUF5QixDQUFDdUIsV0FBVyxFQUFFQyxJQUFJLENBQUNFLEdBQUcsQ0FBRTFCLHlCQUF5QixDQUFDNEIsV0FBVyxFQUFFbUssa0JBQW1CLENBQUUsQ0FBQztNQUM3SUEsa0JBQWtCLEdBQUcvTCx5QkFBeUIsQ0FBQ3VCLFdBQVcsR0FBR0MsSUFBSSxDQUFDRyxLQUFLLENBQUUsQ0FBRW9LLGtCQUFrQixHQUFHL0wseUJBQXlCLENBQUN1QixXQUFXLElBQUt2Qix5QkFBeUIsQ0FBQzZCLFlBQWEsQ0FBQyxHQUFHN0IseUJBQXlCLENBQUM2QixZQUFZO01BRTNOLE9BQU9MLElBQUksQ0FBQ0UsR0FBRyxDQUFFMUIseUJBQXlCLENBQUM0QixXQUFXLEVBQUVtSyxrQkFBbUIsQ0FBQztJQUM3RTs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0UsMkJBQTJCQSxDQUFBLEVBQUc7TUFDdEMsSUFBSUMsTUFBTSxHQUFHdE0sS0FBSyxDQUFDbUYsYUFBYSxDQUFFLHlDQUEwQyxDQUFDO01BQzdFLElBQUlvSCxLQUFLLEdBQUd2TSxLQUFLLENBQUNtRixhQUFhLENBQUUsd0NBQXlDLENBQUM7TUFFM0UsSUFBS21ILE1BQU0sRUFBRztRQUNiQSxNQUFNLENBQUMxQyxXQUFXLEdBQUd0SixtQkFBbUIsR0FBRyxHQUFHO01BQy9DO01BQ0EsSUFBS2lNLEtBQUssRUFBRztRQUNaQSxLQUFLLENBQUN6SyxHQUFHLEdBQUcxQix5QkFBeUIsQ0FBQ3VCLFdBQVc7UUFDakQ0SyxLQUFLLENBQUMxSyxHQUFHLEdBQUd6Qix5QkFBeUIsQ0FBQzRCLFdBQVc7UUFDakR1SyxLQUFLLENBQUNDLElBQUksR0FBR3BNLHlCQUF5QixDQUFDNkIsWUFBWTtRQUNuRHNLLEtBQUssQ0FBQ25KLEtBQUssR0FBRzlDLG1CQUFtQjtRQUNqQ2lNLEtBQUssQ0FBQzFDLFlBQVksQ0FBRSxnQkFBZ0IsRUFBRXZKLG1CQUFtQixHQUFHLEdBQUksQ0FBQztNQUNsRTtJQUNEOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNtTSxrQkFBa0JBLENBQUVQLGlCQUFpQixFQUFHO01BQ2hELElBQUlRLFlBQVksR0FBR1QsNkJBQTZCLENBQUVDLGlCQUFrQixDQUFDO01BRXJFLElBQUtRLFlBQVksS0FBS3BNLG1CQUFtQixFQUFHO1FBQzNDK0wsMkJBQTJCLENBQUMsQ0FBQztRQUM3QjtNQUNEO01BQ0EsSUFBSyxDQUFFN0wsa0JBQWtCLEVBQUc7UUFDM0JHLGVBQWUsQ0FBRSwyQkFBNEIsQ0FBQztRQUM5Q0gsa0JBQWtCLEdBQUdOLFlBQVksR0FBR0EsWUFBWSxDQUFDeU0sbUJBQW1CLENBQUMsQ0FBQyxHQUFHLElBQUk7UUFDN0VoTSxlQUFlLENBQUUsMEJBQTJCLENBQUM7TUFDOUM7TUFDQUwsbUJBQW1CLEdBQUdvTSxZQUFZO01BQ2xDTCwyQkFBMkIsQ0FBQyxDQUFDO01BQzdCLElBQUs1TCxpQkFBaUIsRUFBRztRQUN4QjtNQUNEO01BQ0FBLGlCQUFpQixHQUFHZixNQUFNLENBQUNrTixxQkFBcUIsQ0FBRSxZQUFZO1FBQzdELElBQUssQ0FBRWxNLGNBQWMsRUFBRztVQUN2QkQsaUJBQWlCLEdBQUcsQ0FBQztVQUNyQkQsa0JBQWtCLEdBQUcsSUFBSTtVQUN6QjtRQUNEO1FBQ0F1SyxxQkFBcUIsQ0FBQyxDQUFDO1FBQ3ZCVyxtQ0FBbUMsQ0FBQyxDQUFDO1FBQ3JDLElBQUt4TCxZQUFZLElBQUlNLGtCQUFrQixFQUFHO1VBQ3pDTixZQUFZLENBQUMyTSxtQkFBbUIsQ0FBRXJNLGtCQUFtQixDQUFDO1FBQ3ZEO1FBQ0FBLGtCQUFrQixHQUFHLElBQUk7UUFDekJDLGlCQUFpQixHQUFHLENBQUM7UUFDckJFLGVBQWUsQ0FBRSw0QkFBNkIsQ0FBQztRQUMvQ0EsZUFBZSxDQUFFLHNCQUF1QixDQUFDO1FBQ3pDQSxlQUFlLENBQUUseUJBQTBCLENBQUM7TUFDN0MsQ0FBRSxDQUFDO0lBQ0o7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU21NLHdCQUF3QkEsQ0FBRUMsS0FBSyxFQUFHO01BQzFDLElBQUlSLEtBQUssR0FBR1EsS0FBSyxDQUFDckssTUFBTSxDQUFDc0ssT0FBTyxDQUFFLHdDQUF5QyxDQUFDO01BRTVFLElBQUtULEtBQUssRUFBRztRQUNaRSxrQkFBa0IsQ0FBRUYsS0FBSyxDQUFDbkosS0FBTSxDQUFDO01BQ2xDO0lBQ0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBUzZKLHlCQUF5QkEsQ0FBRUYsS0FBSyxFQUFHO01BQzNDLElBQUlSLEtBQUssR0FBR1EsS0FBSyxDQUFDckssTUFBTSxDQUFDc0ssT0FBTyxDQUFFLHdDQUF5QyxDQUFDO01BRTVFLElBQUssQ0FBRVQsS0FBSyxFQUFHO1FBQ2Q7TUFDRDtNQUNBRSxrQkFBa0IsQ0FBRUYsS0FBSyxDQUFDbkosS0FBTSxDQUFDO01BQ2pDekMsZUFBZSxDQUFFLFVBQVUsRUFBRXdDLE1BQU0sQ0FBRWxELFFBQVEsQ0FBQ3VELElBQUksQ0FBQzBKLG1CQUFtQixJQUFJLEVBQUcsQ0FBQyxDQUFDeEosT0FBTyxDQUFFLFdBQVcsRUFBRXBELG1CQUFvQixDQUFFLENBQUM7TUFDNUhLLGVBQWUsQ0FBRSxrQkFBbUIsQ0FBQztJQUN0Qzs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU3dNLHVCQUF1QkEsQ0FBQSxFQUFHO01BQ2xDeE0sZUFBZSxDQUFFLHlCQUEwQixDQUFDO0lBQzdDOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTeU0saUJBQWlCQSxDQUFBLEVBQUc7TUFDNUIsSUFBSUMsVUFBVSxHQUFHbk4sWUFBWSxHQUFHQSxZQUFZLENBQUNvTix3QkFBd0IsQ0FBQyxDQUFDLEdBQUcsSUFBSTtNQUM5RSxJQUFJQyxNQUFNO01BRVYsSUFBSyxDQUFFRixVQUFVLEVBQUc7UUFDbkI7TUFDRDtNQUNBRSxNQUFNLEdBQUdGLFVBQVUsQ0FBQ0UsTUFBTTtNQUMxQkosdUJBQXVCLENBQUMsQ0FBQztNQUN6QixJQUFLRSxVQUFVLENBQUNHLFNBQVMsSUFBSTdNLGVBQWUsQ0FBRSx1QkFBdUIsRUFBRTRNLE1BQU0sRUFBRTtRQUFFRSxhQUFhLEVBQUU7TUFBSyxDQUFFLENBQUMsRUFBRztRQUMxRzlNLGVBQWUsQ0FBRSxrQkFBa0IsRUFBRTtVQUNwQytNLFdBQVcsRUFBRXpOLFFBQVEsQ0FBQ3FDLFNBQVMsQ0FBQzZHLFVBQVU7VUFDMUN3RSxZQUFZLEVBQUVOLFVBQVUsQ0FBQ007UUFDMUIsQ0FBRSxDQUFDO1FBQ0g7TUFDRDtNQUNBaE4sZUFBZSxDQUFFLGdCQUFnQixFQUFFQSxlQUFlLENBQUUseUJBQXlCLEVBQUU7UUFDOUVpTixTQUFTLEVBQUVMLE1BQU0sQ0FBQ00sRUFBRTtRQUNwQkYsWUFBWSxFQUFFTixVQUFVLENBQUNNLFlBQVk7UUFDckNHLGVBQWUsRUFBRSxDQUFDO1FBQ2xCL0osSUFBSSxFQUFFOUQsUUFBUSxDQUFDNkQsWUFBWSxHQUFHN0QsUUFBUSxDQUFDNkQsWUFBWSxDQUFDQyxJQUFJLEdBQUc5RCxRQUFRLENBQUMrRCxJQUFJLENBQUNEO01BQzFFLENBQUMsRUFBRSxLQUFNLENBQUMsRUFBRXdKLE1BQU0sRUFBRSxJQUFJLEVBQUU7UUFDekJRLE9BQU8sRUFBRTlOLFFBQVEsQ0FBQ3VELElBQUksQ0FBQ3dLLGFBQWE7UUFDcENDLFFBQVEsRUFBRWhPLFFBQVEsQ0FBQ3VELElBQUksQ0FBQzBLLFlBQVk7UUFDcENDLG1CQUFtQixFQUFFO01BQ3RCLENBQUUsQ0FBQztJQUNKOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNDLGdCQUFnQkEsQ0FBRWhJLFFBQVEsRUFBRztNQUNyQyxJQUFJbUgsTUFBTTtNQUNWLElBQUlJLFlBQVk7TUFFaEIsSUFBS3hILGNBQWMsQ0FBRUMsUUFBUSxFQUFFLENBQUUsQ0FBQyxLQUFLQSxRQUFRLEVBQUc7UUFDakQ7TUFDRDtNQUNBK0csdUJBQXVCLENBQUMsQ0FBQztNQUN6QlEsWUFBWSxHQUFHek4sWUFBWSxHQUFHQSxZQUFZLENBQUNtTyw4QkFBOEIsQ0FBQyxDQUFDLEdBQUcsQ0FBQztNQUMvRWQsTUFBTSxHQUFHck4sWUFBWSxHQUFHQSxZQUFZLENBQUNvTyx5QkFBeUIsQ0FBRWxJLFFBQVMsQ0FBQyxHQUFHLElBQUk7TUFDakYsSUFBS21ILE1BQU0sSUFBSTVNLGVBQWUsQ0FBRSx1QkFBdUIsRUFBRTRNLE1BQU0sRUFBRTtRQUFFZ0IsWUFBWSxFQUFFdE8sUUFBUSxDQUFDdUQsSUFBSSxDQUFDZ0w7TUFBcUIsQ0FBRSxDQUFDLEVBQUc7UUFDekg3TixlQUFlLENBQUUsa0JBQWtCLEVBQUU7VUFDcEMrTSxXQUFXLEVBQUV0SCxRQUFRO1VBQ3JCdUgsWUFBWSxFQUFFQTtRQUNmLENBQUUsQ0FBQztRQUNIO01BQ0Q7TUFDQUosTUFBTSxHQUFHO1FBQ1JNLEVBQUUsRUFBRXpILFFBQVEsR0FBRyxpQkFBaUI7UUFDaENxSSxLQUFLLEVBQUVkLFlBQVk7UUFDbkJlLG9CQUFvQixFQUFFLENBQUM7UUFDdkJDLGFBQWEsRUFBRSxLQUFLO1FBQ3BCQyxXQUFXLEVBQUV4STtNQUNkLENBQUM7TUFDRHpGLGVBQWUsQ0FBRSxnQkFBZ0IsRUFBRUEsZUFBZSxDQUFFLHlCQUF5QixFQUFFO1FBQzlFK00sV0FBVyxFQUFFdEgsUUFBUTtRQUNyQnVILFlBQVksRUFBRUEsWUFBWTtRQUMxQkcsZUFBZSxFQUFFLENBQUM7UUFDbEIvSixJQUFJLEVBQUU5RCxRQUFRLENBQUM2RCxZQUFZLEdBQUc3RCxRQUFRLENBQUM2RCxZQUFZLENBQUNDLElBQUksR0FBRzlELFFBQVEsQ0FBQytELElBQUksQ0FBQ0Q7TUFDMUUsQ0FBQyxFQUFFLEtBQU0sQ0FBQyxFQUFFd0osTUFBTSxFQUFFLElBQUksRUFBRTtRQUN6QlEsT0FBTyxFQUFFOU4sUUFBUSxDQUFDdUQsSUFBSSxDQUFDcUwscUJBQXFCO1FBQzVDWixRQUFRLEVBQUVoTyxRQUFRLENBQUN1RCxJQUFJLENBQUNnTCxvQkFBb0I7UUFDNUNMLG1CQUFtQixFQUFFO01BQ3RCLENBQUUsQ0FBQztJQUNKOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNXLHdCQUF3QkEsQ0FBRUMsU0FBUyxFQUFHO01BQzlDLElBQUl4QixNQUFNO01BQ1YsSUFBSXpKLFlBQVksR0FBRzdELFFBQVEsQ0FBQzZELFlBQVksR0FBRzdELFFBQVEsQ0FBQzZELFlBQVksR0FBRzdELFFBQVEsQ0FBQytELElBQUk7TUFFaEYsSUFBSyxVQUFVLEtBQUsrSyxTQUFTLElBQUksTUFBTSxLQUFLQSxTQUFTLEVBQUc7UUFDdkQsT0FBTyxLQUFLO01BQ2I7TUFDQXhCLE1BQU0sR0FBRztRQUNSTSxFQUFFLEVBQUUvSixZQUFZLENBQUNpRCxRQUFRO1FBQ3pCMEgsS0FBSyxFQUFFLENBQUM7UUFDUkMsb0JBQW9CLEVBQUUsQ0FBQztRQUN2QkMsYUFBYSxFQUFFLEtBQUs7UUFDcEJLLGtCQUFrQixFQUFFO01BQ3JCLENBQUM7TUFDRHJPLGVBQWUsQ0FBRSxnQkFBZ0IsRUFBRUEsZUFBZSxDQUFFLHlCQUF5QixFQUFFO1FBQzlFaU4sU0FBUyxFQUFFOUosWUFBWSxDQUFDaUQsUUFBUTtRQUNoQytHLGVBQWUsRUFBRSxVQUFVLEtBQUtpQixTQUFTLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQztRQUNsRGhMLElBQUksRUFBRTlELFFBQVEsQ0FBQzZELFlBQVksR0FBRzdELFFBQVEsQ0FBQzZELFlBQVksQ0FBQ0MsSUFBSSxHQUFHOUQsUUFBUSxDQUFDK0QsSUFBSSxDQUFDRDtNQUMxRSxDQUFDLEVBQUUsS0FBTSxDQUFDLEVBQUV3SixNQUFNLEVBQUUsSUFBSSxFQUFFO1FBQ3pCUSxPQUFPLEVBQUUsVUFBVSxLQUFLZ0IsU0FBUyxHQUFHOU8sUUFBUSxDQUFDdUQsSUFBSSxDQUFDeUwsdUJBQXVCLEdBQUdoUCxRQUFRLENBQUN1RCxJQUFJLENBQUMwTCxtQkFBbUI7UUFDN0dqQixRQUFRLEVBQUVoTyxRQUFRLENBQUN1RCxJQUFJLENBQUMwSyxZQUFZO1FBQ3BDQyxtQkFBbUIsRUFBRTtNQUN0QixDQUFFLENBQUM7TUFFSCxPQUFPLElBQUk7SUFDWjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTZ0Isd0JBQXdCQSxDQUFFMUssY0FBYyxFQUFHO01BQ25ELElBQUlXLGVBQWUsR0FBR3ZDLHNCQUFzQixDQUFFNEIsY0FBZSxDQUFDO01BQzlELElBQUk4SSxNQUFNO01BQ1YsSUFBSTZCLGNBQWM7TUFFbEIsSUFBSyxDQUFFaEssZUFBZSxFQUFHO1FBQ3hCLE9BQU8sS0FBSztNQUNiO01BQ0FtSSxNQUFNLEdBQUdyTixZQUFZLEdBQUdBLFlBQVksQ0FBQ3lNLG1CQUFtQixDQUFDLENBQUMsR0FBRztRQUFFa0IsRUFBRSxFQUFFNU4sUUFBUSxDQUFDK0QsSUFBSSxDQUFDdUosTUFBTSxDQUFDTSxFQUFFO1FBQUVZLEtBQUssRUFBRTtNQUFJLENBQUM7TUFDeEdXLGNBQWMsR0FBRztRQUNoQnhCLFNBQVMsRUFBRUwsTUFBTSxDQUFDTSxFQUFFO1FBQ3BCRixZQUFZLEVBQUVKLE1BQU0sQ0FBQ2tCLEtBQUs7UUFDMUJYLGVBQWUsRUFBRSxDQUFDO1FBQ2xCL0osSUFBSSxFQUFFcUIsZUFBZSxDQUFDZDtNQUN2QixDQUFDO01BQ0QsSUFBSyxDQUFDLEdBQUc1QyxNQUFNLENBQUUwRCxlQUFlLENBQUNsQixhQUFjLENBQUMsRUFBRztRQUNsRGtMLGNBQWMsQ0FBQ2xMLGFBQWEsR0FBR3hDLE1BQU0sQ0FBRTBELGVBQWUsQ0FBQ2xCLGFBQWMsQ0FBQztNQUN2RSxDQUFDLE1BQU07UUFDTmtMLGNBQWMsQ0FBQy9LLFdBQVcsR0FBRzNDLE1BQU0sQ0FBRTBELGVBQWUsQ0FBQ2YsV0FBWSxDQUFDO01BQ25FO01BQ0ExRCxlQUFlLENBQUUsZ0JBQWdCLEVBQUV5TyxjQUFjLEVBQUU3QixNQUFNLEVBQUUsSUFBSSxFQUFFO1FBQ2hFUSxPQUFPLEVBQUU5TixRQUFRLENBQUN1RCxJQUFJLENBQUM2TCw0QkFBNEI7UUFDbkRwQixRQUFRLEVBQUVoTyxRQUFRLENBQUN1RCxJQUFJLENBQUM4TCxrQkFBa0I7UUFDMUNuQixtQkFBbUIsRUFBRTtNQUN0QixDQUFFLENBQUM7TUFFSCxPQUFPLElBQUk7SUFDWjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU29CLHVCQUF1QkEsQ0FBRXpJLFVBQVUsRUFBRUksUUFBUSxFQUFHO01BQ3hELElBQUlJLGlCQUFpQixHQUFHckgsUUFBUSxDQUFDcUIsUUFBUSxJQUFJckIsUUFBUSxDQUFDcUIsUUFBUSxDQUFDaUcsTUFBTSxHQUFHN0YsTUFBTSxDQUFFekIsUUFBUSxDQUFDcUIsUUFBUSxDQUFDaUcsTUFBTSxDQUFDQyxtQkFBb0IsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFO01BQ3pJLElBQUlnSSxXQUFXLEdBQUdyTSxNQUFNLENBQUUyRCxVQUFVLElBQUksRUFBRyxDQUFDLENBQUNSLEtBQUssQ0FBRSwyQkFBNEIsQ0FBQztNQUNqRixJQUFJbUosU0FBUyxHQUFHdE0sTUFBTSxDQUFFK0QsUUFBUSxJQUFJLEVBQUcsQ0FBQyxDQUFDWixLQUFLLENBQUUsMkJBQTRCLENBQUM7TUFDN0UsSUFBSW9KLFdBQVc7TUFDZixJQUFJQyxTQUFTO01BQ2IsSUFBSUMsU0FBUztNQUNiLElBQUlyQyxNQUFNO01BRVYsSUFBSyxDQUFFaUMsV0FBVyxJQUFJLENBQUVDLFNBQVMsSUFBSXRKLGNBQWMsQ0FBRVcsVUFBVSxFQUFFLENBQUUsQ0FBQyxLQUFLQSxVQUFVLElBQUlYLGNBQWMsQ0FBRWUsUUFBUSxFQUFFLENBQUUsQ0FBQyxLQUFLQSxRQUFRLEVBQUc7UUFDbkksT0FBTyxLQUFLO01BQ2I7TUFDQXdJLFdBQVcsR0FBR2xKLElBQUksQ0FBQ0MsR0FBRyxDQUFFL0UsTUFBTSxDQUFFOE4sV0FBVyxDQUFFLENBQUMsQ0FBRyxDQUFDLEVBQUU5TixNQUFNLENBQUU4TixXQUFXLENBQUUsQ0FBQyxDQUFHLENBQUMsR0FBRyxDQUFDLEVBQUU5TixNQUFNLENBQUU4TixXQUFXLENBQUUsQ0FBQyxDQUFHLENBQUUsQ0FBQztNQUNoSEcsU0FBUyxHQUFHbkosSUFBSSxDQUFDQyxHQUFHLENBQUUvRSxNQUFNLENBQUUrTixTQUFTLENBQUUsQ0FBQyxDQUFHLENBQUMsRUFBRS9OLE1BQU0sQ0FBRStOLFNBQVMsQ0FBRSxDQUFDLENBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRS9OLE1BQU0sQ0FBRStOLFNBQVMsQ0FBRSxDQUFDLENBQUcsQ0FBRSxDQUFDO01BQ3hHRyxTQUFTLEdBQUdoTyxJQUFJLENBQUNHLEtBQUssQ0FBRSxDQUFFNE4sU0FBUyxHQUFHRCxXQUFXLElBQUssUUFBUyxDQUFDLEdBQUcsQ0FBQztNQUNwRSxJQUFLRSxTQUFTLEdBQUcsQ0FBQyxJQUFJQSxTQUFTLEdBQUd0SSxpQkFBaUIsSUFBSW5CLGNBQWMsQ0FBRVcsVUFBVSxFQUFFOEksU0FBUyxHQUFHLENBQUUsQ0FBQyxLQUFLMUksUUFBUSxFQUFHO1FBQ2pILE9BQU8sS0FBSztNQUNiO01BQ0FxRyxNQUFNLEdBQUc7UUFDUk0sRUFBRSxFQUFFL0csVUFBVSxHQUFHLGlCQUFpQjtRQUNsQzJILEtBQUssRUFBRSxDQUFDO1FBQ1JDLG9CQUFvQixFQUFFLENBQUM7UUFDdkJDLGFBQWEsRUFBRSxLQUFLO1FBQ3BCSyxrQkFBa0IsRUFBRTtNQUNyQixDQUFDO01BQ0RyTyxlQUFlLENBQUUsZ0JBQWdCLEVBQUU7UUFDbEMrTSxXQUFXLEVBQUU1RyxVQUFVO1FBQ3ZCNkcsWUFBWSxFQUFFLENBQUM7UUFDZkcsZUFBZSxFQUFFLENBQUM7UUFDbEJ6SixXQUFXLEVBQUV1TCxTQUFTO1FBQ3RCN0wsSUFBSSxFQUFFOUQsUUFBUSxDQUFDNkQsWUFBWSxHQUFHN0QsUUFBUSxDQUFDNkQsWUFBWSxDQUFDQyxJQUFJLEdBQUc5RCxRQUFRLENBQUMrRCxJQUFJLENBQUNEO01BQzFFLENBQUMsRUFBRXdKLE1BQU0sRUFBRSxJQUFJLEVBQUU7UUFDaEJRLE9BQU8sRUFBRTlOLFFBQVEsQ0FBQ3VELElBQUksQ0FBQ3FNLGtCQUFrQjtRQUN6QzVCLFFBQVEsRUFBRWhPLFFBQVEsQ0FBQ3VELElBQUksQ0FBQzBLLFlBQVk7UUFDcENDLG1CQUFtQixFQUFFO01BQ3RCLENBQUUsQ0FBQztNQUVILE9BQU8sSUFBSTtJQUNaOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVMyQixpQkFBaUJBLENBQUEsRUFBRztNQUM1QixJQUFJQyxlQUFlLEdBQUc5UCxRQUFRLENBQUNxQixRQUFRLElBQUlyQixRQUFRLENBQUNxQixRQUFRLENBQUMwTyxzQkFBc0IsR0FDaEYvUCxRQUFRLENBQUNxQixRQUFRLENBQUMwTyxzQkFBc0IsR0FDeEMsQ0FBQyxDQUFDO01BQ0wsSUFBSTdHLFVBQVUsR0FBR2xKLFFBQVEsQ0FBQ3FDLFNBQVMsR0FBR2EsTUFBTSxDQUFFbEQsUUFBUSxDQUFDcUMsU0FBUyxDQUFDNkcsVUFBVSxJQUFJLEVBQUcsQ0FBQyxHQUFHLEVBQUU7TUFDeEYsSUFBSXdFLFlBQVksR0FBR3pOLFlBQVksR0FBR0EsWUFBWSxDQUFDbU8sOEJBQThCLENBQUMsQ0FBQyxHQUFHLENBQUM7TUFDbkYsSUFBSWUsY0FBYztNQUNsQixJQUFJYSxjQUFjO01BQ2xCLElBQUkxQyxNQUFNO01BRVYsSUFDQ3BILGNBQWMsQ0FBRWdELFVBQVUsRUFBRSxDQUFFLENBQUMsS0FBS0EsVUFBVSxJQUMzQyxDQUFFNEcsZUFBZSxDQUFDaE0sSUFBSSxJQUNwQixDQUFFckMsTUFBTSxDQUFFcU8sZUFBZSxDQUFDMUwsV0FBWSxDQUFDLElBQUksQ0FBRTNDLE1BQU0sQ0FBRXFPLGVBQWUsQ0FBQzdMLGFBQWMsQ0FBRyxFQUMxRjtRQUNELE9BQU8sS0FBSztNQUNiO01BRUFpSix1QkFBdUIsQ0FBQyxDQUFDO01BQ3pCVixrQkFBa0IsQ0FBRXJNLHlCQUF5QixDQUFDOEIsMEJBQTJCLENBQUM7TUFDMUV2QixlQUFlLENBQUUsdUJBQXVCLEVBQUV3SSxVQUFVLEVBQUV3RSxZQUFhLENBQUM7TUFDcEVKLE1BQU0sR0FBRztRQUNSTSxFQUFFLEVBQUUxRSxVQUFVLEdBQUcsaUJBQWlCO1FBQ2xDc0YsS0FBSyxFQUFFZCxZQUFZO1FBQ25CZSxvQkFBb0IsRUFBRSxDQUFDO1FBQ3ZCQyxhQUFhLEVBQUUsS0FBSztRQUNwQkMsV0FBVyxFQUFFekY7TUFDZCxDQUFDO01BQ0RpRyxjQUFjLEdBQUc7UUFDaEIxQixXQUFXLEVBQUV2RSxVQUFVO1FBQ3ZCd0UsWUFBWSxFQUFFQSxZQUFZO1FBQzFCRyxlQUFlLEVBQUUsQ0FBQztRQUNsQi9KLElBQUksRUFBRVosTUFBTSxDQUFFNE0sZUFBZSxDQUFDaE0sSUFBSztNQUNwQyxDQUFDO01BQ0QsSUFBSyxDQUFDLEdBQUdyQyxNQUFNLENBQUVxTyxlQUFlLENBQUM3TCxhQUFjLENBQUMsRUFBRztRQUNsRGtMLGNBQWMsQ0FBQ2xMLGFBQWEsR0FBR3hDLE1BQU0sQ0FBRXFPLGVBQWUsQ0FBQzdMLGFBQWMsQ0FBQztNQUN2RSxDQUFDLE1BQU07UUFDTmtMLGNBQWMsQ0FBQy9LLFdBQVcsR0FBRzNDLE1BQU0sQ0FBRXFPLGVBQWUsQ0FBQzFMLFdBQVksQ0FBQztNQUNuRTtNQUVBNEwsY0FBYyxHQUFHdFAsZUFBZSxDQUFFLGdCQUFnQixFQUFFeU8sY0FBYyxFQUFFN0IsTUFBTSxFQUFFLElBQUksRUFBRTtRQUNqRlEsT0FBTyxFQUFFOU4sUUFBUSxDQUFDdUQsSUFBSSxDQUFDME0sa0JBQWtCO1FBQ3pDakMsUUFBUSxFQUFFaE8sUUFBUSxDQUFDdUQsSUFBSSxDQUFDMk0sY0FBYztRQUN0Q2hDLG1CQUFtQixFQUFFO01BQ3RCLENBQUUsQ0FBQztNQUVILE9BQU9pQyxPQUFPLENBQUVILGNBQWUsQ0FBQztJQUNqQzs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTSSxtQkFBbUJBLENBQUV0RCxLQUFLLEVBQUc7TUFDckMsSUFBSXVELE1BQU0sR0FBR3ZELEtBQUssQ0FBQ3VELE1BQU0sSUFBSSxRQUFRLEtBQUssT0FBT3ZELEtBQUssQ0FBQ3VELE1BQU0sR0FBR3ZELEtBQUssQ0FBQ3VELE1BQU0sR0FBRyxDQUFDLENBQUM7TUFDakYsSUFBSUMsWUFBWSxHQUFHcE4sTUFBTSxDQUFFbU4sTUFBTSxDQUFDekwsRUFBRSxJQUFJLEVBQUcsQ0FBQztNQUU1QyxJQUFLLGdDQUFnQyxLQUFLa0ksS0FBSyxDQUFDdEgsSUFBSSxJQUFJLG9DQUFvQyxLQUFLOEssWUFBWSxFQUFHO1FBQy9HcEIsd0JBQXdCLENBQUVoTSxNQUFNLENBQUVtTixNQUFNLENBQUNsTixLQUFLLElBQUksRUFBRyxDQUFFLENBQUM7TUFDekQsQ0FBQyxNQUFNLElBQUssaUNBQWlDLEtBQUsySixLQUFLLENBQUN0SCxJQUFJLElBQUksMEJBQTBCLEtBQUs4SyxZQUFZLEVBQUc7UUFDN0d6Qix3QkFBd0IsQ0FBRTNMLE1BQU0sQ0FBRW1OLE1BQU0sQ0FBQ3ZCLFNBQVMsSUFBSSxFQUFHLENBQUUsQ0FBQztNQUM3RCxDQUFDLE1BQU0sSUFBSyxpQ0FBaUMsS0FBS2hDLEtBQUssQ0FBQ3RILElBQUksSUFBSSwwQkFBMEIsS0FBSzhLLFlBQVksRUFBRztRQUM3R2hCLHVCQUF1QixDQUFFcE0sTUFBTSxDQUFFbU4sTUFBTSxDQUFDeEosVUFBVSxJQUFJLEVBQUcsQ0FBQyxFQUFFM0QsTUFBTSxDQUFFbU4sTUFBTSxDQUFDcEosUUFBUSxJQUFJLEVBQUcsQ0FBRSxDQUFDO01BQzlGLENBQUMsTUFBTSxJQUFLLGlDQUFpQyxLQUFLNkYsS0FBSyxDQUFDdEgsSUFBSSxJQUFJLHlCQUF5QixLQUFLOEssWUFBWSxFQUFHO1FBQzVHbkQsaUJBQWlCLENBQUMsQ0FBQztNQUNwQixDQUFDLE1BQU0sSUFBSyxpQ0FBaUMsS0FBS0wsS0FBSyxDQUFDdEgsSUFBSSxJQUFJLHlCQUF5QixLQUFLOEssWUFBWSxFQUFHO1FBQzVHbkMsZ0JBQWdCLENBQUVqTCxNQUFNLENBQUVtTixNQUFNLENBQUNFLElBQUksSUFBSSxFQUFHLENBQUUsQ0FBQztNQUNoRDtJQUNEOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNDLFlBQVlBLENBQUUxRCxLQUFLLEVBQUc7TUFDOUIsSUFBSTJELGFBQWEsR0FBRzNELEtBQUssQ0FBQ3JLLE1BQU0sQ0FBQ3NLLE9BQU8sQ0FBRSw2QkFBOEIsQ0FBQztNQUN6RSxJQUFJMkQsWUFBWSxHQUFHNUQsS0FBSyxDQUFDckssTUFBTSxDQUFDc0ssT0FBTyxDQUFFLGdGQUFpRixDQUFDO01BRTNILElBQUsyRCxZQUFZLEVBQUc7UUFDbkIsSUFBSyxNQUFNLEtBQUtBLFlBQVksQ0FBQ3BHLFlBQVksQ0FBRSxlQUFnQixDQUFDLEVBQUc7VUFDOUQsT0FBTyxJQUFJO1FBQ1o7UUFDQTVKLGVBQWUsQ0FBRSxtQkFBbUIsRUFBRWdRLFlBQWEsQ0FBQztRQUNwRCxPQUFPLElBQUk7TUFDWjtNQUVBLE9BQU9QLE9BQU8sQ0FBRU0sYUFBYSxJQUFJNUIsd0JBQXdCLENBQUU0QixhQUFhLENBQUNuRyxZQUFZLENBQUUsMkJBQTRCLENBQUUsQ0FBRSxDQUFDO0lBQ3pIOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNxRyxjQUFjQSxDQUFFN0QsS0FBSyxFQUFHO01BQ2hDLElBQUk4RCxJQUFJLEdBQUc5RCxLQUFLLENBQUNySyxNQUFNLENBQUNzSyxPQUFPLENBQUUsZ0NBQWlDLENBQUM7TUFDbkUsSUFBSThELEtBQUs7TUFDVCxJQUFJQyxhQUFhO01BQ2pCLElBQUlDLGVBQWU7TUFDbkIsSUFBSUMsVUFBVTtNQUNkLElBQUlsQyxTQUFTO01BRWIsSUFBSyxDQUFFOEIsSUFBSSxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFFLENBQUM3TCxPQUFPLENBQUUrSCxLQUFLLENBQUNtRSxHQUFJLENBQUMsRUFBRztRQUN6RixPQUFPLEtBQUs7TUFDYjtNQUNBSixLQUFLLEdBQUc5USxLQUFLLENBQUNzSyxnQkFBZ0IsQ0FBRSxnQ0FBaUMsQ0FBQztNQUNsRXlHLGFBQWEsR0FBR2hRLEtBQUssQ0FBQ0MsU0FBUyxDQUFDZ0UsT0FBTyxDQUFDOUQsSUFBSSxDQUFFNFAsS0FBSyxFQUFFRCxJQUFLLENBQUM7TUFDM0QsSUFBSyxDQUFDLEdBQUdFLGFBQWEsRUFBRztRQUN4QixPQUFPLEtBQUs7TUFDYjtNQUNBLElBQUssTUFBTSxLQUFLaEUsS0FBSyxDQUFDbUUsR0FBRyxFQUFHO1FBQzNCRixlQUFlLEdBQUcsQ0FBQztNQUNwQixDQUFDLE1BQU0sSUFBSyxLQUFLLEtBQUtqRSxLQUFLLENBQUNtRSxHQUFHLEVBQUc7UUFDakNGLGVBQWUsR0FBR0YsS0FBSyxDQUFDSyxNQUFNLEdBQUcsQ0FBQztNQUNuQyxDQUFDLE1BQU07UUFDTkgsZUFBZSxHQUFHRCxhQUFhLEdBQUcsQ0FBRSxZQUFZLEtBQUtoRSxLQUFLLENBQUNtRSxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFPalIsUUFBUSxDQUFDbVIsTUFBTSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBRTtNQUN6RztNQUNBSCxVQUFVLEdBQUdyUCxJQUFJLENBQUNDLEdBQUcsQ0FBRSxDQUFDLEVBQUVELElBQUksQ0FBQ0UsR0FBRyxDQUFFZ1AsS0FBSyxDQUFDSyxNQUFNLEdBQUcsQ0FBQyxFQUFFSCxlQUFnQixDQUFFLENBQUM7TUFDekUsSUFBS0MsVUFBVSxLQUFLRixhQUFhLEVBQUc7UUFDbkMsSUFBSyxDQUFDLENBQUMsS0FBSyxDQUFFLFdBQVcsRUFBRSxZQUFZLENBQUUsQ0FBQy9MLE9BQU8sQ0FBRStILEtBQUssQ0FBQ21FLEdBQUksQ0FBQyxJQUFJRixlQUFlLEtBQUtELGFBQWEsRUFBRztVQUNyR2hDLFNBQVMsR0FBRyxDQUFDLEdBQUdpQyxlQUFlLEdBQUcsVUFBVSxHQUFHLE1BQU07VUFDckQsSUFBS3JRLGVBQWUsQ0FBRSwwQkFBMEIsRUFBRW9PLFNBQVMsRUFBRSxLQUFNLENBQUMsRUFBRztZQUN0RXBPLGVBQWUsQ0FBRSx5QkFBeUIsRUFBRW9PLFNBQVUsQ0FBQztZQUN2RGhDLEtBQUssQ0FBQ3NFLGNBQWMsQ0FBQyxDQUFDO1lBQ3RCLE9BQU8sSUFBSTtVQUNaO1FBQ0Q7UUFDQSxPQUFPLEtBQUs7TUFDYjtNQUNBdEMsU0FBUyxHQUFHa0MsVUFBVSxHQUFHRixhQUFhLEdBQUcsVUFBVSxHQUFHLE1BQU07TUFDNURwUSxlQUFlLENBQUUsMEJBQTBCLEVBQUVvTyxTQUFTLEVBQUUsS0FBTSxDQUFDO01BQy9EaEMsS0FBSyxDQUFDc0UsY0FBYyxDQUFDLENBQUM7TUFDdEJSLElBQUksQ0FBQ2hILFlBQVksQ0FBRSxVQUFVLEVBQUUsSUFBSyxDQUFDO01BQ3JDaUgsS0FBSyxDQUFFRyxVQUFVLENBQUUsQ0FBQ3BILFlBQVksQ0FBRSxVQUFVLEVBQUUsR0FBSSxDQUFDO01BQ25EaUgsS0FBSyxDQUFFRyxVQUFVLENBQUUsQ0FBQ0ssS0FBSyxDQUFDLENBQUM7TUFDM0JSLEtBQUssQ0FBRUcsVUFBVSxDQUFFLENBQUNNLGNBQWMsQ0FBRTtRQUFFQyxLQUFLLEVBQUUsU0FBUztRQUFFQyxNQUFNLEVBQUU7TUFBVSxDQUFFLENBQUM7TUFDN0U5USxlQUFlLENBQUUseUJBQTBCLENBQUM7TUFFNUMsT0FBTyxJQUFJO0lBQ1o7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVMrUSxlQUFlQSxDQUFBLEVBQUc7TUFDMUJ6TSx1QkFBdUIsQ0FBQyxDQUFDO01BQ3pCa0MsNEJBQTRCLENBQUMsQ0FBQztNQUM5QndCLGdCQUFnQixDQUFDLENBQUM7TUFDbEJTLCtCQUErQixDQUFDLENBQUM7SUFDbEM7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVN1SSwyQkFBMkJBLENBQUEsRUFBRztNQUN0QyxJQUFJQyxRQUFRLEdBQUc1UixLQUFLLENBQUNtRixhQUFhLENBQUUscUVBQXNFLENBQUM7TUFFM0dxRSxpQ0FBaUMsQ0FBQyxDQUFDO01BQ25DTSwyQkFBMkIsQ0FBRThILFFBQVEsRUFBRWpPLHFDQUFxQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBRSxRQUFRLENBQUcsQ0FBQztNQUNyR29ILHFCQUFxQixDQUFDLENBQUM7TUFDdkJXLG1DQUFtQyxDQUFDLENBQUM7TUFDckNXLDJCQUEyQixDQUFDLENBQUM7SUFDOUI7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVN3RixVQUFVQSxDQUFBLEVBQUc7TUFDckIsSUFBS25SLGNBQWMsSUFBSSxDQUFFVixLQUFLLEVBQUc7UUFDaEM7TUFDRDtNQUNBVSxjQUFjLEdBQUcsSUFBSTtNQUNyQlYsS0FBSyxDQUFDOFIsZ0JBQWdCLENBQUUsT0FBTyxFQUFFaEYsd0JBQXlCLENBQUM7TUFDM0Q5TSxLQUFLLENBQUM4UixnQkFBZ0IsQ0FBRSxRQUFRLEVBQUU3RSx5QkFBMEIsQ0FBQztNQUM3RGpOLEtBQUssQ0FBQzhSLGdCQUFnQixDQUFFLGdDQUFnQyxFQUFFekIsbUJBQW9CLENBQUM7TUFDL0VyUSxLQUFLLENBQUM4UixnQkFBZ0IsQ0FBRSxpQ0FBaUMsRUFBRXpCLG1CQUFvQixDQUFDO01BQ2hGclEsS0FBSyxDQUFDOFIsZ0JBQWdCLENBQUUsaUNBQWlDLEVBQUV6QixtQkFBb0IsQ0FBQztNQUNoRnJRLEtBQUssQ0FBQzhSLGdCQUFnQixDQUFFLGlDQUFpQyxFQUFFekIsbUJBQW9CLENBQUM7TUFDaEZyUSxLQUFLLENBQUM4UixnQkFBZ0IsQ0FBRSxpQ0FBaUMsRUFBRXpCLG1CQUFvQixDQUFDO0lBQ2pGOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTMEIsT0FBT0EsQ0FBQSxFQUFHO01BQ2xCLElBQUssQ0FBRXJSLGNBQWMsRUFBRztRQUN2QjtNQUNEO01BQ0FWLEtBQUssQ0FBQ2dTLG1CQUFtQixDQUFFLE9BQU8sRUFBRWxGLHdCQUF5QixDQUFDO01BQzlEOU0sS0FBSyxDQUFDZ1MsbUJBQW1CLENBQUUsUUFBUSxFQUFFL0UseUJBQTBCLENBQUM7TUFDaEVqTixLQUFLLENBQUNnUyxtQkFBbUIsQ0FBRSxnQ0FBZ0MsRUFBRTNCLG1CQUFvQixDQUFDO01BQ2xGclEsS0FBSyxDQUFDZ1MsbUJBQW1CLENBQUUsaUNBQWlDLEVBQUUzQixtQkFBb0IsQ0FBQztNQUNuRnJRLEtBQUssQ0FBQ2dTLG1CQUFtQixDQUFFLGlDQUFpQyxFQUFFM0IsbUJBQW9CLENBQUM7TUFDbkZyUSxLQUFLLENBQUNnUyxtQkFBbUIsQ0FBRSxpQ0FBaUMsRUFBRTNCLG1CQUFvQixDQUFDO01BQ25GclEsS0FBSyxDQUFDZ1MsbUJBQW1CLENBQUUsaUNBQWlDLEVBQUUzQixtQkFBb0IsQ0FBQztNQUNuRixJQUFLNVAsaUJBQWlCLEVBQUc7UUFDeEJmLE1BQU0sQ0FBQ3VTLG9CQUFvQixDQUFFeFIsaUJBQWtCLENBQUM7TUFDakQ7TUFDQUEsaUJBQWlCLEdBQUcsQ0FBQztNQUNyQkQsa0JBQWtCLEdBQUcsSUFBSTtNQUN6QkUsY0FBYyxHQUFHLEtBQUs7SUFDdkI7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVN3Uix1QkFBdUJBLENBQUEsRUFBRztNQUNsQyxPQUFPNVIsbUJBQW1CO0lBQzNCO0lBRUEsT0FBTztNQUNOdVIsVUFBVSxFQUFFQSxVQUFVO01BQ3RCRSxPQUFPLEVBQUVBLE9BQU87TUFDaEJMLGVBQWUsRUFBRUEsZUFBZTtNQUNoQ0MsMkJBQTJCLEVBQUVBLDJCQUEyQjtNQUN4RGxCLFlBQVksRUFBRUEsWUFBWTtNQUMxQkcsY0FBYyxFQUFFQSxjQUFjO01BQzlCekIsd0JBQXdCLEVBQUVBLHdCQUF3QjtNQUNsREksdUJBQXVCLEVBQUVBLHVCQUF1QjtNQUNoRE8saUJBQWlCLEVBQUVBLGlCQUFpQjtNQUNwQzFDLGlCQUFpQixFQUFFQSxpQkFBaUI7TUFDcENnQixnQkFBZ0IsRUFBRUEsZ0JBQWdCO01BQ2xDM0Isa0JBQWtCLEVBQUVBLGtCQUFrQjtNQUN0Q3lGLHVCQUF1QixFQUFFQTtJQUMxQixDQUFDO0VBQ0Y7RUFFQSxJQUFLeFMsTUFBTSxDQUFDeVMscUJBQXFCLElBQUksVUFBVSxLQUFLLE9BQU96UyxNQUFNLENBQUN5UyxxQkFBcUIsQ0FBQ0MsZ0JBQWdCLEVBQUc7SUFDMUcxUyxNQUFNLENBQUN5UyxxQkFBcUIsQ0FBQ0MsZ0JBQWdCLENBQUV2UyxTQUFTLEVBQUVDLG9DQUFxQyxDQUFDO0VBQ2pHO0FBQ0QsQ0FBQyxFQUFFSixNQUFNLEVBQUVDLFFBQVEsRUFBRUQsTUFBTSxDQUFDRSxFQUFHLENBQUMiLCJpZ25vcmVMaXN0IjpbXX0=
