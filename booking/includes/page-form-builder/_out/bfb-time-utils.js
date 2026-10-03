"use strict";

/**
 * WPBC BFB Core: Time Utilities
 *
 * One place for all time parsing/formatting/masking helpers + small UI helpers used by time-based packs.
 *
 * - Pure helpers (parse/format minutes, AM/PM conversion)
 * - iMask integration for "HH:MM" inputs
 * - Input-node conversion (type=time <-> masked text)
 * - Small UI helpers for global "time-slot picker" toggle (placeholder row, checkbox sync)
 * - Debounced init for external "time selector" (wpbc_hook__init_timeselector)
 *
 * @package   Booking Calendar
 * @author    wpdevelop
 * @since     11.0.0
 * @version   1.0.0
 * @modified: 2025-10-31 12:32
 *
 * ../includes/page-form-builder/_out/bfb-time-utils.js
 */

/* global window, document */
(function (w, d) {
  'use strict';

  var Core = w.WPBC_BFB_Core || (w.WPBC_BFB_Core = {});
  var Time = Core.Time || (Core.Time = {});
  var IMask = w.IMask || null;

  // -----------------------------------------------------------------------------------------------------------------
  // Basic helpers
  // -----------------------------------------------------------------------------------------------------------------

  /**
   * Coerce mixed values to boolean.
   * Accepts booleans, numbers, and common strings: "on"/"off", "true"/"false", "1"/"0", "yes"/"no".
   * @param {*} v
   * @return {boolean}
   */
  Time.coerce_to_bool = function (v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
      var s = v.trim().toLowerCase();
      if (s === 'on' || s === 'true' || s === '1' || s === 'yes') return true;
      if (s === 'off' || s === 'false' || s === '0' || s === 'no' || s === '') return false;
    }
    return !!v;
  };

  /**
   * Parse "HH:MM" 24h -> minutes since 00:00. Returns NaN on invalid.
   * @param {string} hhmm
   * @return {number}
   */
  Time.parse_hhmm_24h = function (hhmm) {
    if (!hhmm) return NaN;
    var m = String(hhmm).trim().match(/^(\d{1,2})\s*:\s*(\d{2})$/);
    if (!m) return NaN;
    var H = Number(m[1]),
      M = Number(m[2]);
    if (H < 0 || H > 23 || M < 0 || M > 59) return NaN;
    return H * 60 + M;
  };

  /**
   * Parse "h:MM AM/PM" -> minutes since 00:00. Returns NaN on invalid.
   * @param {string} txt
   * @return {number}
   */
  Time.parse_ampm_text = function (txt) {
    if (!txt) return NaN;
    var m = String(txt).trim().match(/^(\d{1,2})\s*:\s*(\d{2})\s*([AaPp][Mm])$/);
    if (!m) return NaN;
    var h12 = Number(m[1]),
      mm = Number(m[2]),
      ap = String(m[3]).toUpperCase();
    if (h12 < 1 || h12 > 12 || mm < 0 || mm > 59) return NaN;
    var h24 = h12 % 12 + (ap === 'PM' ? 12 : 0);
    return h24 * 60 + mm;
  };

  /**
   * Try 24h "HH:MM" first, fall back to AM/PM text.
   * @param {string} v
   * @return {number}
   */
  Time.parse_minutes = function (v) {
    var s = String(v || '').trim();
    var m2 = Time.parse_hhmm_24h(s);
    return isNaN(m2) ? Time.parse_ampm_text(s) : m2;
  };

  /**
   * Format minutes -> "HH:MM" 24h.
   * @param {number} minutes
   * @return {string}
   */
  Time.format_minutes_24h = function (minutes) {
    var H = Math.floor(minutes / 60) % 24;
    var M = minutes % 60;
    var HH = H < 10 ? '0' + H : '' + H;
    var MM = M < 10 ? '0' + M : '' + M;
    return HH + ':' + MM;
  };

  /**
   * Format minutes -> "h:MM AM/PM".
   * @param {number} minutes
   * @return {string}
   */
  Time.format_minutes_ampm = function (minutes) {
    var H24 = Math.floor(minutes / 60) % 24;
    var M = minutes % 60;
    var is_am = H24 < 12;
    var h12 = H24 % 12;
    if (h12 === 0) h12 = 12;
    var MM = M < 10 ? '0' + M : '' + M;
    return h12 + ':' + MM + ' ' + (is_am ? 'AM' : 'PM');
  };

  /**
   * Escape attribute text.
   * @param {string} v
   * @return {string}
   */
  Time.esc_attr = function (v) {
    return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  };

  // -----------------------------------------------------------------------------------------------------------------
  // iMask helpers (used by 24h text inputs)
  // -----------------------------------------------------------------------------------------------------------------

  /**
   * Apply iMask "HH:MM" to input.
   * @param {HTMLInputElement} el
   */
  Time.apply_imask_to_input = function (el) {
    if (!IMask || !el) return;
    if (el._imask) {
      try {
        el._imask.destroy();
      } catch (e) {}
      el._imask = null;
    }
    el._imask = IMask(el, {
      mask: 'HH:MM',
      blocks: {
        HH: {
          mask: IMask.MaskedRange,
          from: 0,
          to: 23,
          maxLength: 2
        },
        MM: {
          mask: IMask.MaskedRange,
          from: 0,
          to: 59,
          maxLength: 2
        }
      },
      lazy: false
    });
  };

  /**
   * Destroy iMask instance if present.
   * @param {HTMLInputElement} el
   */
  Time.clear_imask = function (el) {
    if (el && el._imask) {
      try {
        el._imask.destroy();
      } catch (e) {}
      el._imask = null;
    }
  };

  // -----------------------------------------------------------------------------------------------------------------
  // Node conversion: type=time <-> masked text
  // -----------------------------------------------------------------------------------------------------------------

  /**
   * Convert a single start/end input node to '24h' (masked text) or 'ampm' (type="time").
   * @param {HTMLElement} node
   * @param {'24h'|'ampm'} to_fmt
   * @param {number} value_minutes
   * @return {HTMLInputElement}
   */
  Time.convert_input_node_to_format = function (node, to_fmt, value_minutes) {
    var parent = node.parentNode;
    var cls = node.className;
    var is_start = node.classList.contains('wpbc_bfb__opt-start');
    var new_el;
    if (to_fmt === '24h') {
      new_el = d.createElement('input');
      new_el.type = 'text';
      new_el.className = cls.replace(/\bjs-rt-start-time\b|\bjs-rt-end-time\b/g, '').trim();
      new_el.classList.add('js-rt-mask');
      new_el.setAttribute('data-mask-kind', '24h');
      new_el.setAttribute('placeholder', 'HH:MM');
      new_el.value = isNaN(value_minutes) ? '' : Time.format_minutes_24h(value_minutes);
    } else {
      new_el = d.createElement('input');
      new_el.type = 'time';
      new_el.step = '300';
      new_el.className = cls.replace(/\bjs-rt-mask\b/g, '').trim();
      new_el.classList.add(is_start ? 'js-rt-start-time' : 'js-rt-end-time');
      // <input type="time"> expects "HH:MM" 24h string
      new_el.value = isNaN(value_minutes) ? '' : Time.format_minutes_24h(value_minutes);
    }
    Time.clear_imask(node);
    parent.replaceChild(new_el, node);
    return new_el;
  };

  /**
   * Rebuild both start/end inputs inside a row to target format.
   * @param {HTMLElement} row
   * @param {'24h'|'ampm'} to_fmt
   */
  Time.rebuild_row_inputs_to_format = function (row, to_fmt) {
    var s_el = row.querySelector('.wpbc_bfb__opt-start');
    var e_el = row.querySelector('.wpbc_bfb__opt-end');
    if (!s_el || !e_el) return;
    var s_m = Time.parse_minutes(s_el.value);
    var e_m = Time.parse_minutes(e_el.value);
    var s_new = Time.convert_input_node_to_format(s_el, to_fmt, s_m);
    var e_new = Time.convert_input_node_to_format(e_el, to_fmt, e_m);
    if (to_fmt === '24h') {
      Time.apply_imask_to_input(s_new);
      Time.apply_imask_to_input(e_new);
    } else {
      Time.clear_imask(s_new);
      Time.clear_imask(e_new);
    }
  };

  /**
   * Rebuild all rows under container to target format.
   * @param {HTMLElement} container
   * @param {'24h'|'ampm'} to_fmt
   */
  Time.rebuild_all_rows_to_format = function (container, to_fmt) {
    if (!container) return;
    container.querySelectorAll('.wpbc_bfb__options_row').forEach(function (row) {
      Time.rebuild_row_inputs_to_format(row, to_fmt);
    });
  };

  /**
   * Apply iMask to all 24h-masked inputs within container.
   * @param {HTMLElement} container
   */
  Time.apply_imask_in_container_24h = function (container) {
    if (!IMask || !container) return;
    container.querySelectorAll('input[data-mask-kind="24h"]').forEach(function (el) {
      Time.apply_imask_to_input(el);
    });
  };

  // -----------------------------------------------------------------------------------------------------------------
  // Slot generation
  // -----------------------------------------------------------------------------------------------------------------

  /**
   * Build slots: [{label, value, selected:false}, ...]
   * Note: generation expects end > start. (Overnight ranges are entered manually via editor.)
   * @param {number} start_minutes
   * @param {number} end_minutes
   * @param {number} step_minutes
   * @param {'24h'|'ampm'} label_fmt
   * @return {Array<{label:string,value:string,selected:boolean}>}
   */
  Time.build_time_slots = function (start_minutes, end_minutes, step_minutes, label_fmt) {
    if (isNaN(start_minutes) || isNaN(end_minutes) || isNaN(step_minutes)) return [];
    if (end_minutes <= start_minutes || step_minutes <= 0) return [];
    var out = [];
    for (var t = start_minutes; t + step_minutes <= end_minutes; t += step_minutes) {
      var t2 = t + step_minutes;
      var v1 = Time.format_minutes_24h(t);
      var v2 = Time.format_minutes_24h(t2);
      var l1 = label_fmt === '24h' ? v1 : Time.format_minutes_ampm(t);
      var l2 = label_fmt === '24h' ? v2 : Time.format_minutes_ampm(t2);
      out.push({
        label: l1 + ' - ' + l2,
        value: v1 + ' - ' + v2,
        selected: false
      });
    }
    return out;
  };

  // -----------------------------------------------------------------------------------------------------------------
  // Global "time-slot picker" flag helpers
  // -----------------------------------------------------------------------------------------------------------------

  /**
   * Read global time-slot picker flag (saved via _wpbc other params).
   * @return {boolean}
   */
  Time.read_picker_enabled = function () {
    try {
      if (!(w._wpbc && typeof w._wpbc.get_other_param === 'function')) return false;
      return Time.coerce_to_bool(w._wpbc.get_other_param('is_enabled_booking_timeslot_picker'));
    } catch (e) {
      return false;
    }
  };

  /**
   * Persist global time-slot picker flag.
   * @param {boolean} enabled
   */
  Time.set_picker_enabled = function (enabled) {
    try {
      if (w._wpbc && typeof w._wpbc.set_other_param === 'function') {
        w._wpbc.set_other_param('is_enabled_booking_timeslot_picker', !!enabled);
      }
    } catch (e) {}
  };

  /**
   * Set toggle + hide/show placeholder row within a single Inspector panel.
   * @param {HTMLElement} panel
   * @param {boolean} enabled
   */
  Time.ui_set_picker_toggle_for_panel = function (panel, enabled) {
    if (!panel) return;
    var chk = panel.querySelector('.js-toggle-timeslot-picker');
    if (chk) chk.checked = !!enabled;
    var skin_row = panel.querySelector('.js-time-picker-skin-row');
    if (skin_row) {
      skin_row.hidden = !enabled;
      skin_row.style.display = enabled ? '' : 'none';
      skin_row.setAttribute('aria-hidden', enabled ? 'false' : 'true');
    }
    var phRow = panel.querySelector('.js-placeholder-row');
    if (phRow) {
      if (enabled) {
        phRow.style.display = 'none';
        phRow.hidden = true;
      } else {
        phRow.style.display = '';
        phRow.hidden = false;
      }
    }
  };

  /**
   * Apply picker flag to all open Time inspectors.
   * @param {boolean} enabled
   */
  Time.ui_apply_picker_enabled_to_all = function (enabled) {
    d.querySelectorAll('.wpbc_bfb__inspector_timepicker').forEach(function (panel) {
      // Set toggle + hide/show placeholder row within a single Inspector panel.
      Time.ui_set_picker_toggle_for_panel(panel, enabled);
    });
  };

  /**
   * Apply a time-picker skin URL directly to the Builder document.
   *
   * Updating the existing link avoids a no-styles interval. If another
   * integration omitted the link, create it so Inspector changes still
   * produce an immediate Canvas preview.
   *
   * @param {string} skin_url Public time-picker skin URL.
   * @return {boolean} Whether a stylesheet URL was applied.
   */
  Time.apply_picker_skin_url = function (skin_url) {
    if (!skin_url) return false;
    var stylesheet = d.getElementById('wpbc-time_picker-skin-css');
    if (!stylesheet) {
      stylesheet = d.createElement('link');
      stylesheet.id = 'wpbc-time_picker-skin-css';
      stylesheet.rel = 'stylesheet';
      stylesheet.type = 'text/css';
      stylesheet.media = 'screen';
      (d.head || d.getElementsByTagName('head')[0]).appendChild(stylesheet);
    }
    stylesheet.setAttribute('href', String(skin_url));
    if (Time.read_picker_enabled()) {
      Time.set_picker_enabled(true);
      Time.schedule_init_timeselector();
    }
    return true;
  };

  /**
   * Apply a selected time-picker skin to the Builder preview stylesheet.
   *
   * @param {HTMLSelectElement} select_control Skin selectbox.
   * @return {void}
   */
  Time.apply_picker_skin_from_select = function (select_control) {
    if (!select_control) return;
    var selected_option = select_control.options && select_control.selectedIndex >= 0 ? select_control.options[select_control.selectedIndex] : null;
    var skin_url = selected_option ? String(selected_option.getAttribute('data-wpbc-time-picker-skin-url') || '') : '';
    Time.apply_picker_skin_url(skin_url);

    // The style row is available only while the global picker is enabled.
    // Reconcile the runtime flag as well, so an older Builder session can
    // immediately construct its Canvas choices without a page reload.
    var panel = select_control.closest ? select_control.closest('.wpbc_bfb__inspector_timepicker') : null;
    var picker_toggle = panel ? panel.querySelector('.js-toggle-timeslot-picker') : null;
    if (picker_toggle && picker_toggle.checked) {
      Time.set_picker_enabled(true);
      Time.schedule_init_timeselector();
    }
  };

  /**
   * Synchronize all open time-field skin controls to a saved global value.
   *
   * @param {string} skin_value Relative time-picker skin path.
   * @return {void}
   */
  Time.ui_set_picker_skin_value = function (skin_value) {
    d.querySelectorAll('.js-wpbc-bfb-time-picker-skin').forEach(function (select_control) {
      select_control.value = String(skin_value || '');
    });
  };

  /**
   * Synchronize other controls after a global time-picker skin is saved.
   *
   * @return {void}
   */
  Time.on_picker_skin_saved = function () {
    var select_control = d.querySelector('.js-wpbc-bfb-time-picker-skin');
    var skin_value = select_control ? String(select_control.value || '') : '';
    var accent_button = d.querySelector('[data-wpbc-bfb-apply-accent-components="1"]');
    Time.ui_set_picker_skin_value(skin_value);
    if (accent_button) {
      accent_button.setAttribute('data-wpbc-time-picker-skin-current', skin_value);
    }
  };

  // The generic protected option saver resolves successful callbacks by global function name.
  w.wpbc_bfb_time_picker_skin_control_saved = Time.on_picker_skin_saved;

  // -----------------------------------------------------------------------------------------------------------------
  // Debounced init for external time selector (canvas preview)
  // -----------------------------------------------------------------------------------------------------------------

  /**
   * Debounced call to global initializer (if present): wpbc_hook__init_timeselector()
   */
  Time.schedule_init_timeselector = function () {
    let scheduled = false;
    let tid = null;
    const DELAY = 30;
    return function () {
      if (scheduled) return;
      scheduled = true;
      clearTimeout(tid);
      tid = setTimeout(function run() {
        scheduled = false;
        if (!d.querySelector('.wpbc_bfb__preview-timepicker')) return;
        if (typeof w.wpbc_hook__init_timeselector === 'function') {
          try {
            w.__wpbc_rt_mo_pause && w.__wpbc_rt_mo_pause();
            w.__wpbc_st_mo_pause && w.__wpbc_st_mo_pause();
            w.wpbc_hook__init_timeselector();
          } catch (e) {/* no-op */
          } finally {
            w.__wpbc_rt_mo_resume && w.__wpbc_rt_mo_resume();
            w.__wpbc_st_mo_resume && w.__wpbc_st_mo_resume();
          }
        }
      }, DELAY);
    };
  }();

  /**
   * Mirror to Settings UI without firing DOM 'change' (loop-safe).
   */
  Time.mirror_settings_toggle = function (enabled) {
    wpbc_bfb__dispatch_event_safe('wpbc:bfb:settings:set', {
      key: 'booking_timeslot_picker',
      value: enabled ? 'On' : 'Off',
      source: 'time-utils'
    });
  };

  /**
   * Preview refresh for time-slot picker toggle.
   * - ON: just init external time selector.
   * - OFF: teardown widgets and unhide <select> controls, then soft re-render (no rebuild).
   */
  Time.sync_preview_after_flag = function (enabled) {
    if (enabled) {
      Time.schedule_init_timeselector();
      return;
    }
    try {
      if (typeof w.wpbc_hook__destroy_timeselector === 'function') {
        w.wpbc_hook__destroy_timeselector(d);
      } else {
        document.querySelectorAll('.wpbc_times_selector').forEach(function (el) {
          if (el.parentNode) el.parentNode.removeChild(el);
        });
        document.querySelectorAll('.wpbc_bfb__preview-select.wpbc_bfb__preview-rangetime,' + 'select[name^="rangetime"], select[name^="starttime"], select[name^="endtime"], select[name^="durationtime"]').forEach(function (s) {
          s.style.removeProperty('display');
          s.hidden = false;
        });
      }
    } catch (e) {}
    if (window.WPBC_BFB_Settings && typeof window.WPBC_BFB_Settings.when_builder_ready === 'function') {
      window.WPBC_BFB_Settings.when_builder_ready(function (b) {
        if (!b || !b.preview_mode) return;
        if (typeof b.refresh_canvas === 'function') {
          b.refresh_canvas({
            hard: true,
            rebuild: false,
            // critical: no load_saved_structure()
            reinit: false,
            restore_selection: true,
            restore_scroll: true,
            silent_inspector: true,
            source: 'settings:timeslot'
          });
        } else if (typeof b.render_preview_all === 'function') {
          b.render_preview_all();
        }
      });
    }
  };

  /**
   * One-call universal setter used by Settings + all time-field inspectors.
   */
  Time.set_global_timeslot_picker = function (enabled, opts) {
    opts = opts || {};
    Time.set_picker_enabled(enabled); // persist in-memory flag
    Time.ui_apply_picker_enabled_to_all(enabled); // sync all open inspectors
    if (opts.mirror_settings !== false) {
      Time.mirror_settings_toggle(enabled); // mirror Settings toggle (no 'change' event)
    }
    if (opts.refresh_preview !== false) {
      Time.sync_preview_after_flag(enabled); // safe preview refresh
    }
  };

  // -----------------------------------------------------------------------------------------------------------------
  // Global binder: select vs. time picker toggle (ONE-TIME, shared by all time-based packs)
  // -----------------------------------------------------------------------------------------------------------------

  /**
   * Bind once to:
   *  - initialize all open Inspector panels with the current global flag,
   *  - react to newly added Inspector panels via MutationObserver,
   *  - persist and broadcast changes when the "Show as time picker" checkbox toggles.
   */
  Time.ensure_global_timepicker_toggle_binder = function () {
    if (Time.__toggleBinderBound) return;
    Time.__toggleBinderBound = true;

    // 1) Init all currently open panels
    function init_all_panels() {
      Time.ui_apply_picker_enabled_to_all(Time.read_picker_enabled());
    }
    d.readyState === 'loading' ? d.addEventListener('DOMContentLoaded', init_all_panels) : init_all_panels();

    // 2) Observe Inspector panels that appear later
    try {
      var mo = new MutationObserver(function (muts) {
        var enabled = Time.read_picker_enabled();
        for (var i = 0; i < muts.length; i++) {
          var m = muts[i];
          for (var j = 0; j < m.addedNodes.length; j++) {
            var n = m.addedNodes[j];
            if (!n || n.nodeType !== 1) continue;
            if (n.matches && n.matches('.wpbc_bfb__inspector_timepicker')) {
              try {
                Time.ui_set_picker_toggle_for_panel(n, enabled);
              } catch (e) {}
            } else if (n.querySelector) {
              n.querySelectorAll('.wpbc_bfb__inspector_timepicker').forEach(function (panel) {
                try {
                  Time.ui_set_picker_toggle_for_panel(panel, enabled);
                } catch (e) {}
              });
            }
          }
        }
      });
      mo.observe(d.body, {
        childList: true,
        subtree: true
      });
      // Optional pause/resume hooks if other modules want to suspend observers temporarily:
      w.__wpbc_timepicker_toggle_mo_pause = function () {
        try {
          mo.disconnect();
        } catch (e) {}
      };
      w.__wpbc_timepicker_toggle_mo_resume = function () {
        try {
          mo.observe(d.body, {
            childList: true,
            subtree: true
          });
        } catch (e) {}
      };
    } catch (e) {}

    // 3) Checkbox handler (delegated).
    // Skin changes use jQuery below because the previous/next selectbox
    // controls dispatch jQuery's synthetic `change` event.
    d.addEventListener('change', function (ev) {
      var t = ev.target;
      if (!t || !t.classList) return;
      if (t.classList.contains('js-wpbc-bfb-time-picker-skin')) {
        if (!w.jQuery) Time.apply_picker_skin_from_select(t);
        return;
      }
      if (!t.classList.contains('js-toggle-timeslot-picker')) return;
      var enabled = !!t.checked;
      Time.set_global_timeslot_picker(enabled, {
        source: 'inspector'
      });
    });
    if (w.jQuery) {
      w.jQuery(d).off('change.wpbcBfbTimePickerSkin', '.js-wpbc-bfb-time-picker-skin').on('change.wpbcBfbTimePickerSkin', '.js-wpbc-bfb-time-picker-skin', function () {
        Time.apply_picker_skin_from_select(this);
      });
    }
  };

  // Auto-bind on script load.
  try {
    Time.ensure_global_timepicker_toggle_binder();
  } catch (e) {}

  // -----------------------------------------------------------------------------------------------------------------
  // Builder canvas refresh hooks (moved out of bfb-builder.js)
  // -----------------------------------------------------------------------------------------------------------------

  /**
   * Bind pause/resume hooks to Builder canvas refresh events.
   *
   * Why here:
   * - This module owns the timepicker-toggle MutationObserver and time selector init.
   * - Builder should not know about pack-specific observers.
   *
   * Safety:
   * - Idempotent (binds once).
   * - Waits for wpbc_bfb_api.ready.
   * - No hard dependency: if builder/bus/events are absent, it silently no-ops.
   *
   * @returns {void}
   */
  Time.ensure_builder_canvas_refresh_hooks = function () {
    if (Time.__builder_canvas_refresh_hooks_bound) {
      return;
    }
    Time.__builder_canvas_refresh_hooks_bound = true;

    // Builder API must exist.
    if (!w.wpbc_bfb_api || !w.wpbc_bfb_api.ready || typeof w.wpbc_bfb_api.ready.then !== 'function') {
      return;
    }
    w.wpbc_bfb_api.ready.then(function (builder) {
      // Builder might resolve null (timeout) – just ignore.
      if (!builder || !builder.bus || typeof builder.bus.on !== 'function') {
        return;
      }
      var EVS = w.WPBC_BFB_Core && w.WPBC_BFB_Core.WPBC_BFB_Events ? w.WPBC_BFB_Core.WPBC_BFB_Events : {};
      var EV_BEFORE = EVS.CANVAS_REFRESH || 'wpbc:bfb:canvas-refresh';
      var EV_AFTER = EVS.CANVAS_REFRESHED || 'wpbc:bfb:canvas-refreshed';

      // BEFORE refresh: pause observers to avoid loops / extra work while DOM is being rebuilt.
      builder.bus.on(EV_BEFORE, function () {
        try {
          if (typeof w.__wpbc_rt_mo_pause === 'function') {
            w.__wpbc_rt_mo_pause();
          }
        } catch (e) {}
        try {
          if (typeof w.__wpbc_st_mo_pause === 'function') {
            w.__wpbc_st_mo_pause();
          }
        } catch (e) {}
        try {
          if (typeof w.__wpbc_timepicker_toggle_mo_pause === 'function') {
            w.__wpbc_timepicker_toggle_mo_pause();
          }
        } catch (e) {}
      });

      // AFTER refresh: resume and (if needed) re-init timeselector widgets.
      builder.bus.on(EV_AFTER, function () {
        try {
          if (typeof w.__wpbc_rt_mo_resume === 'function') {
            w.__wpbc_rt_mo_resume();
          }
        } catch (e) {}
        try {
          if (typeof w.__wpbc_st_mo_resume === 'function') {
            w.__wpbc_st_mo_resume();
          }
        } catch (e) {}
        try {
          if (typeof w.__wpbc_timepicker_toggle_mo_resume === 'function') {
            w.__wpbc_timepicker_toggle_mo_resume();
          }
        } catch (e) {}

        // If time-slot picker is enabled and builder is in preview mode, re-init the time selector UI.
        try {
          if (builder.preview_mode && typeof Time.read_picker_enabled === 'function' && Time.read_picker_enabled()) {
            if (typeof Time.schedule_init_timeselector === 'function') {
              Time.schedule_init_timeselector();
            }
          }
        } catch (e) {}
      });
    });
  };

  // Call once on load.
  try {
    Time.ensure_builder_canvas_refresh_hooks();
  } catch (e) {}
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9iZmItdGltZS11dGlscy5qcyIsIm5hbWVzIjpbInciLCJkIiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJUaW1lIiwiSU1hc2siLCJjb2VyY2VfdG9fYm9vbCIsInYiLCJzIiwidHJpbSIsInRvTG93ZXJDYXNlIiwicGFyc2VfaGhtbV8yNGgiLCJoaG1tIiwiTmFOIiwibSIsIlN0cmluZyIsIm1hdGNoIiwiSCIsIk51bWJlciIsIk0iLCJwYXJzZV9hbXBtX3RleHQiLCJ0eHQiLCJoMTIiLCJtbSIsImFwIiwidG9VcHBlckNhc2UiLCJoMjQiLCJwYXJzZV9taW51dGVzIiwibTIiLCJpc05hTiIsImZvcm1hdF9taW51dGVzXzI0aCIsIm1pbnV0ZXMiLCJNYXRoIiwiZmxvb3IiLCJISCIsIk1NIiwiZm9ybWF0X21pbnV0ZXNfYW1wbSIsIkgyNCIsImlzX2FtIiwiZXNjX2F0dHIiLCJyZXBsYWNlIiwiYXBwbHlfaW1hc2tfdG9faW5wdXQiLCJlbCIsIl9pbWFzayIsImRlc3Ryb3kiLCJlIiwibWFzayIsImJsb2NrcyIsIk1hc2tlZFJhbmdlIiwiZnJvbSIsInRvIiwibWF4TGVuZ3RoIiwibGF6eSIsImNsZWFyX2ltYXNrIiwiY29udmVydF9pbnB1dF9ub2RlX3RvX2Zvcm1hdCIsIm5vZGUiLCJ0b19mbXQiLCJ2YWx1ZV9taW51dGVzIiwicGFyZW50IiwicGFyZW50Tm9kZSIsImNscyIsImNsYXNzTmFtZSIsImlzX3N0YXJ0IiwiY2xhc3NMaXN0IiwiY29udGFpbnMiLCJuZXdfZWwiLCJjcmVhdGVFbGVtZW50IiwidHlwZSIsImFkZCIsInNldEF0dHJpYnV0ZSIsInZhbHVlIiwic3RlcCIsInJlcGxhY2VDaGlsZCIsInJlYnVpbGRfcm93X2lucHV0c190b19mb3JtYXQiLCJyb3ciLCJzX2VsIiwicXVlcnlTZWxlY3RvciIsImVfZWwiLCJzX20iLCJlX20iLCJzX25ldyIsImVfbmV3IiwicmVidWlsZF9hbGxfcm93c190b19mb3JtYXQiLCJjb250YWluZXIiLCJxdWVyeVNlbGVjdG9yQWxsIiwiZm9yRWFjaCIsImFwcGx5X2ltYXNrX2luX2NvbnRhaW5lcl8yNGgiLCJidWlsZF90aW1lX3Nsb3RzIiwic3RhcnRfbWludXRlcyIsImVuZF9taW51dGVzIiwic3RlcF9taW51dGVzIiwibGFiZWxfZm10Iiwib3V0IiwidCIsInQyIiwidjEiLCJ2MiIsImwxIiwibDIiLCJwdXNoIiwibGFiZWwiLCJzZWxlY3RlZCIsInJlYWRfcGlja2VyX2VuYWJsZWQiLCJfd3BiYyIsImdldF9vdGhlcl9wYXJhbSIsInNldF9waWNrZXJfZW5hYmxlZCIsImVuYWJsZWQiLCJzZXRfb3RoZXJfcGFyYW0iLCJ1aV9zZXRfcGlja2VyX3RvZ2dsZV9mb3JfcGFuZWwiLCJwYW5lbCIsImNoayIsImNoZWNrZWQiLCJza2luX3JvdyIsImhpZGRlbiIsInN0eWxlIiwiZGlzcGxheSIsInBoUm93IiwidWlfYXBwbHlfcGlja2VyX2VuYWJsZWRfdG9fYWxsIiwiYXBwbHlfcGlja2VyX3NraW5fdXJsIiwic2tpbl91cmwiLCJzdHlsZXNoZWV0IiwiZ2V0RWxlbWVudEJ5SWQiLCJpZCIsInJlbCIsIm1lZGlhIiwiaGVhZCIsImdldEVsZW1lbnRzQnlUYWdOYW1lIiwiYXBwZW5kQ2hpbGQiLCJzY2hlZHVsZV9pbml0X3RpbWVzZWxlY3RvciIsImFwcGx5X3BpY2tlcl9za2luX2Zyb21fc2VsZWN0Iiwic2VsZWN0X2NvbnRyb2wiLCJzZWxlY3RlZF9vcHRpb24iLCJvcHRpb25zIiwic2VsZWN0ZWRJbmRleCIsImdldEF0dHJpYnV0ZSIsImNsb3Nlc3QiLCJwaWNrZXJfdG9nZ2xlIiwidWlfc2V0X3BpY2tlcl9za2luX3ZhbHVlIiwic2tpbl92YWx1ZSIsIm9uX3BpY2tlcl9za2luX3NhdmVkIiwiYWNjZW50X2J1dHRvbiIsIndwYmNfYmZiX3RpbWVfcGlja2VyX3NraW5fY29udHJvbF9zYXZlZCIsInNjaGVkdWxlZCIsInRpZCIsIkRFTEFZIiwiY2xlYXJUaW1lb3V0Iiwic2V0VGltZW91dCIsInJ1biIsIndwYmNfaG9va19faW5pdF90aW1lc2VsZWN0b3IiLCJfX3dwYmNfcnRfbW9fcGF1c2UiLCJfX3dwYmNfc3RfbW9fcGF1c2UiLCJfX3dwYmNfcnRfbW9fcmVzdW1lIiwiX193cGJjX3N0X21vX3Jlc3VtZSIsIm1pcnJvcl9zZXR0aW5nc190b2dnbGUiLCJ3cGJjX2JmYl9fZGlzcGF0Y2hfZXZlbnRfc2FmZSIsImtleSIsInNvdXJjZSIsInN5bmNfcHJldmlld19hZnRlcl9mbGFnIiwid3BiY19ob29rX19kZXN0cm95X3RpbWVzZWxlY3RvciIsImRvY3VtZW50IiwicmVtb3ZlQ2hpbGQiLCJyZW1vdmVQcm9wZXJ0eSIsIndpbmRvdyIsIldQQkNfQkZCX1NldHRpbmdzIiwid2hlbl9idWlsZGVyX3JlYWR5IiwiYiIsInByZXZpZXdfbW9kZSIsInJlZnJlc2hfY2FudmFzIiwiaGFyZCIsInJlYnVpbGQiLCJyZWluaXQiLCJyZXN0b3JlX3NlbGVjdGlvbiIsInJlc3RvcmVfc2Nyb2xsIiwic2lsZW50X2luc3BlY3RvciIsInJlbmRlcl9wcmV2aWV3X2FsbCIsInNldF9nbG9iYWxfdGltZXNsb3RfcGlja2VyIiwib3B0cyIsIm1pcnJvcl9zZXR0aW5ncyIsInJlZnJlc2hfcHJldmlldyIsImVuc3VyZV9nbG9iYWxfdGltZXBpY2tlcl90b2dnbGVfYmluZGVyIiwiX190b2dnbGVCaW5kZXJCb3VuZCIsImluaXRfYWxsX3BhbmVscyIsInJlYWR5U3RhdGUiLCJhZGRFdmVudExpc3RlbmVyIiwibW8iLCJNdXRhdGlvbk9ic2VydmVyIiwibXV0cyIsImkiLCJsZW5ndGgiLCJqIiwiYWRkZWROb2RlcyIsIm4iLCJub2RlVHlwZSIsIm1hdGNoZXMiLCJvYnNlcnZlIiwiYm9keSIsImNoaWxkTGlzdCIsInN1YnRyZWUiLCJfX3dwYmNfdGltZXBpY2tlcl90b2dnbGVfbW9fcGF1c2UiLCJkaXNjb25uZWN0IiwiX193cGJjX3RpbWVwaWNrZXJfdG9nZ2xlX21vX3Jlc3VtZSIsImV2IiwidGFyZ2V0IiwialF1ZXJ5Iiwib2ZmIiwib24iLCJlbnN1cmVfYnVpbGRlcl9jYW52YXNfcmVmcmVzaF9ob29rcyIsIl9fYnVpbGRlcl9jYW52YXNfcmVmcmVzaF9ob29rc19ib3VuZCIsIndwYmNfYmZiX2FwaSIsInJlYWR5IiwidGhlbiIsImJ1aWxkZXIiLCJidXMiLCJFVlMiLCJXUEJDX0JGQl9FdmVudHMiLCJFVl9CRUZPUkUiLCJDQU5WQVNfUkVGUkVTSCIsIkVWX0FGVEVSIiwiQ0FOVkFTX1JFRlJFU0hFRCJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL19zcmMvYmZiLXRpbWUtdXRpbHMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIFdQQkMgQkZCIENvcmU6IFRpbWUgVXRpbGl0aWVzXHJcbiAqXHJcbiAqIE9uZSBwbGFjZSBmb3IgYWxsIHRpbWUgcGFyc2luZy9mb3JtYXR0aW5nL21hc2tpbmcgaGVscGVycyArIHNtYWxsIFVJIGhlbHBlcnMgdXNlZCBieSB0aW1lLWJhc2VkIHBhY2tzLlxyXG4gKlxyXG4gKiAtIFB1cmUgaGVscGVycyAocGFyc2UvZm9ybWF0IG1pbnV0ZXMsIEFNL1BNIGNvbnZlcnNpb24pXHJcbiAqIC0gaU1hc2sgaW50ZWdyYXRpb24gZm9yIFwiSEg6TU1cIiBpbnB1dHNcclxuICogLSBJbnB1dC1ub2RlIGNvbnZlcnNpb24gKHR5cGU9dGltZSA8LT4gbWFza2VkIHRleHQpXHJcbiAqIC0gU21hbGwgVUkgaGVscGVycyBmb3IgZ2xvYmFsIFwidGltZS1zbG90IHBpY2tlclwiIHRvZ2dsZSAocGxhY2Vob2xkZXIgcm93LCBjaGVja2JveCBzeW5jKVxyXG4gKiAtIERlYm91bmNlZCBpbml0IGZvciBleHRlcm5hbCBcInRpbWUgc2VsZWN0b3JcIiAod3BiY19ob29rX19pbml0X3RpbWVzZWxlY3RvcilcclxuICpcclxuICogQHBhY2thZ2UgICBCb29raW5nIENhbGVuZGFyXHJcbiAqIEBhdXRob3IgICAgd3BkZXZlbG9wXHJcbiAqIEBzaW5jZSAgICAgMTEuMC4wXHJcbiAqIEB2ZXJzaW9uICAgMS4wLjBcclxuICogQG1vZGlmaWVkOiAyMDI1LTEwLTMxIDEyOjMyXHJcbiAqXHJcbiAqIC4uL2luY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL19vdXQvYmZiLXRpbWUtdXRpbHMuanNcclxuICovXHJcblxyXG4vKiBnbG9iYWwgd2luZG93LCBkb2N1bWVudCAqL1xyXG4oZnVuY3Rpb24gKHcsIGQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdHZhciBDb3JlID0gdy5XUEJDX0JGQl9Db3JlIHx8ICh3LldQQkNfQkZCX0NvcmUgPSB7fSk7XHJcblx0dmFyIFRpbWUgPSBDb3JlLlRpbWUgfHwgKENvcmUuVGltZSA9IHt9KTtcclxuXHJcblx0dmFyIElNYXNrID0gdy5JTWFzayB8fCBudWxsO1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEJhc2ljIGhlbHBlcnNcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHQvKipcclxuXHQgKiBDb2VyY2UgbWl4ZWQgdmFsdWVzIHRvIGJvb2xlYW4uXHJcblx0ICogQWNjZXB0cyBib29sZWFucywgbnVtYmVycywgYW5kIGNvbW1vbiBzdHJpbmdzOiBcIm9uXCIvXCJvZmZcIiwgXCJ0cnVlXCIvXCJmYWxzZVwiLCBcIjFcIi9cIjBcIiwgXCJ5ZXNcIi9cIm5vXCIuXHJcblx0ICogQHBhcmFtIHsqfSB2XHJcblx0ICogQHJldHVybiB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRUaW1lLmNvZXJjZV90b19ib29sID0gZnVuY3Rpb24gKHYpIHtcclxuXHRcdGlmICh0eXBlb2YgdiA9PT0gJ2Jvb2xlYW4nKSByZXR1cm4gdjtcclxuXHRcdGlmICh0eXBlb2YgdiA9PT0gJ251bWJlcicpIHJldHVybiB2ICE9PSAwO1xyXG5cdFx0aWYgKHR5cGVvZiB2ID09PSAnc3RyaW5nJykge1xyXG5cdFx0XHR2YXIgcyA9IHYudHJpbSgpLnRvTG93ZXJDYXNlKCk7XHJcblx0XHRcdGlmIChzID09PSAnb24nIHx8IHMgPT09ICd0cnVlJyB8fCBzID09PSAnMScgfHwgcyA9PT0gJ3llcycpIHJldHVybiB0cnVlO1xyXG5cdFx0XHRpZiAocyA9PT0gJ29mZicgfHwgcyA9PT0gJ2ZhbHNlJyB8fCBzID09PSAnMCcgfHwgcyA9PT0gJ25vJyB8fCBzID09PSAnJykgcmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuICEhdjtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBQYXJzZSBcIkhIOk1NXCIgMjRoIC0+IG1pbnV0ZXMgc2luY2UgMDA6MDAuIFJldHVybnMgTmFOIG9uIGludmFsaWQuXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IGhobW1cclxuXHQgKiBAcmV0dXJuIHtudW1iZXJ9XHJcblx0ICovXHJcblx0VGltZS5wYXJzZV9oaG1tXzI0aCA9IGZ1bmN0aW9uIChoaG1tKSB7XHJcblx0XHRpZiAoIWhobW0pIHJldHVybiBOYU47XHJcblx0XHR2YXIgbSA9IFN0cmluZyhoaG1tKS50cmltKCkubWF0Y2goL14oXFxkezEsMn0pXFxzKjpcXHMqKFxcZHsyfSkkLyk7XHJcblx0XHRpZiAoIW0pIHJldHVybiBOYU47XHJcblx0XHR2YXIgSCA9IE51bWJlcihtWzFdKSwgTSA9IE51bWJlcihtWzJdKTtcclxuXHRcdGlmIChIIDwgMCB8fCBIID4gMjMgfHwgTSA8IDAgfHwgTSA+IDU5KSByZXR1cm4gTmFOO1xyXG5cdFx0cmV0dXJuIEggKiA2MCArIE07XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogUGFyc2UgXCJoOk1NIEFNL1BNXCIgLT4gbWludXRlcyBzaW5jZSAwMDowMC4gUmV0dXJucyBOYU4gb24gaW52YWxpZC5cclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdHh0XHJcblx0ICogQHJldHVybiB7bnVtYmVyfVxyXG5cdCAqL1xyXG5cdFRpbWUucGFyc2VfYW1wbV90ZXh0ID0gZnVuY3Rpb24gKHR4dCkge1xyXG5cdFx0aWYgKCF0eHQpIHJldHVybiBOYU47XHJcblx0XHR2YXIgbSA9IFN0cmluZyh0eHQpLnRyaW0oKS5tYXRjaCgvXihcXGR7MSwyfSlcXHMqOlxccyooXFxkezJ9KVxccyooW0FhUHBdW01tXSkkLyk7XHJcblx0XHRpZiAoIW0pIHJldHVybiBOYU47XHJcblx0XHR2YXIgaDEyID0gTnVtYmVyKG1bMV0pLCBtbSA9IE51bWJlcihtWzJdKSwgYXAgPSBTdHJpbmcobVszXSkudG9VcHBlckNhc2UoKTtcclxuXHRcdGlmIChoMTIgPCAxIHx8IGgxMiA+IDEyIHx8IG1tIDwgMCB8fCBtbSA+IDU5KSByZXR1cm4gTmFOO1xyXG5cdFx0dmFyIGgyNCA9IChoMTIgJSAxMikgKyAoYXAgPT09ICdQTScgPyAxMiA6IDApO1xyXG5cdFx0cmV0dXJuIGgyNCAqIDYwICsgbW07XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogVHJ5IDI0aCBcIkhIOk1NXCIgZmlyc3QsIGZhbGwgYmFjayB0byBBTS9QTSB0ZXh0LlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB2XHJcblx0ICogQHJldHVybiB7bnVtYmVyfVxyXG5cdCAqL1xyXG5cdFRpbWUucGFyc2VfbWludXRlcyA9IGZ1bmN0aW9uICh2KSB7XHJcblx0XHR2YXIgcyA9IFN0cmluZyh2IHx8ICcnKS50cmltKCk7XHJcblx0XHR2YXIgbTIgPSBUaW1lLnBhcnNlX2hobW1fMjRoKHMpO1xyXG5cdFx0cmV0dXJuIGlzTmFOKG0yKSA/IFRpbWUucGFyc2VfYW1wbV90ZXh0KHMpIDogbTI7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRm9ybWF0IG1pbnV0ZXMgLT4gXCJISDpNTVwiIDI0aC5cclxuXHQgKiBAcGFyYW0ge251bWJlcn0gbWludXRlc1xyXG5cdCAqIEByZXR1cm4ge3N0cmluZ31cclxuXHQgKi9cclxuXHRUaW1lLmZvcm1hdF9taW51dGVzXzI0aCA9IGZ1bmN0aW9uIChtaW51dGVzKSB7XHJcblx0XHR2YXIgSCA9IE1hdGguZmxvb3IobWludXRlcyAvIDYwKSAlIDI0O1xyXG5cdFx0dmFyIE0gPSBtaW51dGVzICUgNjA7XHJcblx0XHR2YXIgSEggPSAoSCA8IDEwID8gJzAnICsgSCA6ICcnICsgSCk7XHJcblx0XHR2YXIgTU0gPSAoTSA8IDEwID8gJzAnICsgTSA6ICcnICsgTSk7XHJcblx0XHRyZXR1cm4gSEggKyAnOicgKyBNTTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBGb3JtYXQgbWludXRlcyAtPiBcImg6TU0gQU0vUE1cIi5cclxuXHQgKiBAcGFyYW0ge251bWJlcn0gbWludXRlc1xyXG5cdCAqIEByZXR1cm4ge3N0cmluZ31cclxuXHQgKi9cclxuXHRUaW1lLmZvcm1hdF9taW51dGVzX2FtcG0gPSBmdW5jdGlvbiAobWludXRlcykge1xyXG5cdFx0dmFyIEgyNCA9IE1hdGguZmxvb3IobWludXRlcyAvIDYwKSAlIDI0O1xyXG5cdFx0dmFyIE0gICA9IG1pbnV0ZXMgJSA2MDtcclxuXHRcdHZhciBpc19hbSA9IChIMjQgPCAxMik7XHJcblx0XHR2YXIgaDEyID0gSDI0ICUgMTI7XHJcblx0XHRpZiAoaDEyID09PSAwKSBoMTIgPSAxMjtcclxuXHRcdHZhciBNTSA9IChNIDwgMTAgPyAnMCcgKyBNIDogJycgKyBNKTtcclxuXHRcdHJldHVybiBoMTIgKyAnOicgKyBNTSArICcgJyArIChpc19hbSA/ICdBTScgOiAnUE0nKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBFc2NhcGUgYXR0cmlidXRlIHRleHQuXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHZcclxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9XHJcblx0ICovXHJcblx0VGltZS5lc2NfYXR0ciA9IGZ1bmN0aW9uICh2KSB7XHJcblx0XHRyZXR1cm4gU3RyaW5nKHYpLnJlcGxhY2UoLyYvZywgJyZhbXA7JykucmVwbGFjZSgvXCIvZywgJyZxdW90OycpLnJlcGxhY2UoLzwvZywgJyZsdDsnKTtcclxuXHR9O1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIGlNYXNrIGhlbHBlcnMgKHVzZWQgYnkgMjRoIHRleHQgaW5wdXRzKVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdC8qKlxyXG5cdCAqIEFwcGx5IGlNYXNrIFwiSEg6TU1cIiB0byBpbnB1dC5cclxuXHQgKiBAcGFyYW0ge0hUTUxJbnB1dEVsZW1lbnR9IGVsXHJcblx0ICovXHJcblx0VGltZS5hcHBseV9pbWFza190b19pbnB1dCA9IGZ1bmN0aW9uIChlbCkge1xyXG5cdFx0aWYgKCFJTWFzayB8fCAhZWwpIHJldHVybjtcclxuXHRcdGlmIChlbC5faW1hc2spIHtcclxuXHRcdFx0dHJ5IHsgZWwuX2ltYXNrLmRlc3Ryb3koKTsgfSBjYXRjaCAoZSkge31cclxuXHRcdFx0ZWwuX2ltYXNrID0gbnVsbDtcclxuXHRcdH1cclxuXHRcdGVsLl9pbWFzayA9IElNYXNrKGVsLCB7XHJcblx0XHRcdG1hc2s6ICdISDpNTScsXHJcblx0XHRcdGJsb2Nrczoge1xyXG5cdFx0XHRcdEhIOiB7IG1hc2s6IElNYXNrLk1hc2tlZFJhbmdlLCBmcm9tOiAwLCB0bzogMjMsIG1heExlbmd0aDogMiB9LFxyXG5cdFx0XHRcdE1NOiB7IG1hc2s6IElNYXNrLk1hc2tlZFJhbmdlLCBmcm9tOiAwLCB0bzogNTksIG1heExlbmd0aDogMiB9XHJcblx0XHRcdH0sXHJcblx0XHRcdGxhenk6IGZhbHNlXHJcblx0XHR9KTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZXN0cm95IGlNYXNrIGluc3RhbmNlIGlmIHByZXNlbnQuXHJcblx0ICogQHBhcmFtIHtIVE1MSW5wdXRFbGVtZW50fSBlbFxyXG5cdCAqL1xyXG5cdFRpbWUuY2xlYXJfaW1hc2sgPSBmdW5jdGlvbiAoZWwpIHtcclxuXHRcdGlmIChlbCAmJiBlbC5faW1hc2spIHtcclxuXHRcdFx0dHJ5IHsgZWwuX2ltYXNrLmRlc3Ryb3koKTsgfSBjYXRjaCAoZSkge31cclxuXHRcdFx0ZWwuX2ltYXNrID0gbnVsbDtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIE5vZGUgY29udmVyc2lvbjogdHlwZT10aW1lIDwtPiBtYXNrZWQgdGV4dFxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdC8qKlxyXG5cdCAqIENvbnZlcnQgYSBzaW5nbGUgc3RhcnQvZW5kIGlucHV0IG5vZGUgdG8gJzI0aCcgKG1hc2tlZCB0ZXh0KSBvciAnYW1wbScgKHR5cGU9XCJ0aW1lXCIpLlxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG5vZGVcclxuXHQgKiBAcGFyYW0geycyNGgnfCdhbXBtJ30gdG9fZm10XHJcblx0ICogQHBhcmFtIHtudW1iZXJ9IHZhbHVlX21pbnV0ZXNcclxuXHQgKiBAcmV0dXJuIHtIVE1MSW5wdXRFbGVtZW50fVxyXG5cdCAqL1xyXG5cdFRpbWUuY29udmVydF9pbnB1dF9ub2RlX3RvX2Zvcm1hdCA9IGZ1bmN0aW9uIChub2RlLCB0b19mbXQsIHZhbHVlX21pbnV0ZXMpIHtcclxuXHRcdHZhciBwYXJlbnQgPSBub2RlLnBhcmVudE5vZGU7XHJcblx0XHR2YXIgY2xzICAgID0gbm9kZS5jbGFzc05hbWU7XHJcblx0XHR2YXIgaXNfc3RhcnQgPSBub2RlLmNsYXNzTGlzdC5jb250YWlucygnd3BiY19iZmJfX29wdC1zdGFydCcpO1xyXG5cclxuXHRcdHZhciBuZXdfZWw7XHJcblx0XHRpZiAodG9fZm10ID09PSAnMjRoJykge1xyXG5cdFx0XHRuZXdfZWwgICAgICAgICAgID0gZC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xyXG5cdFx0XHRuZXdfZWwudHlwZSAgICAgID0gJ3RleHQnO1xyXG5cdFx0XHRuZXdfZWwuY2xhc3NOYW1lID0gY2xzLnJlcGxhY2UoL1xcYmpzLXJ0LXN0YXJ0LXRpbWVcXGJ8XFxianMtcnQtZW5kLXRpbWVcXGIvZywgJycpLnRyaW0oKTtcclxuXHRcdFx0bmV3X2VsLmNsYXNzTGlzdC5hZGQoJ2pzLXJ0LW1hc2snKTtcclxuXHRcdFx0bmV3X2VsLnNldEF0dHJpYnV0ZSgnZGF0YS1tYXNrLWtpbmQnLCAnMjRoJyk7XHJcblx0XHRcdG5ld19lbC5zZXRBdHRyaWJ1dGUoJ3BsYWNlaG9sZGVyJywgJ0hIOk1NJyk7XHJcblx0XHRcdG5ld19lbC52YWx1ZSA9IGlzTmFOKHZhbHVlX21pbnV0ZXMpID8gJycgOiBUaW1lLmZvcm1hdF9taW51dGVzXzI0aCh2YWx1ZV9taW51dGVzKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdG5ld19lbCAgICAgICAgICAgPSBkLmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XHJcblx0XHRcdG5ld19lbC50eXBlICAgICAgPSAndGltZSc7XHJcblx0XHRcdG5ld19lbC5zdGVwICAgICAgPSAnMzAwJztcclxuXHRcdFx0bmV3X2VsLmNsYXNzTmFtZSA9IGNscy5yZXBsYWNlKC9cXGJqcy1ydC1tYXNrXFxiL2csICcnKS50cmltKCk7XHJcblx0XHRcdG5ld19lbC5jbGFzc0xpc3QuYWRkKGlzX3N0YXJ0ID8gJ2pzLXJ0LXN0YXJ0LXRpbWUnIDogJ2pzLXJ0LWVuZC10aW1lJyk7XHJcblx0XHRcdC8vIDxpbnB1dCB0eXBlPVwidGltZVwiPiBleHBlY3RzIFwiSEg6TU1cIiAyNGggc3RyaW5nXHJcblx0XHRcdG5ld19lbC52YWx1ZSA9IGlzTmFOKHZhbHVlX21pbnV0ZXMpID8gJycgOiBUaW1lLmZvcm1hdF9taW51dGVzXzI0aCh2YWx1ZV9taW51dGVzKTtcclxuXHRcdH1cclxuXHJcblx0XHRUaW1lLmNsZWFyX2ltYXNrKG5vZGUpO1xyXG5cdFx0cGFyZW50LnJlcGxhY2VDaGlsZChuZXdfZWwsIG5vZGUpO1xyXG5cdFx0cmV0dXJuIG5ld19lbDtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBSZWJ1aWxkIGJvdGggc3RhcnQvZW5kIGlucHV0cyBpbnNpZGUgYSByb3cgdG8gdGFyZ2V0IGZvcm1hdC5cclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByb3dcclxuXHQgKiBAcGFyYW0geycyNGgnfCdhbXBtJ30gdG9fZm10XHJcblx0ICovXHJcblx0VGltZS5yZWJ1aWxkX3Jvd19pbnB1dHNfdG9fZm9ybWF0ID0gZnVuY3Rpb24gKHJvdywgdG9fZm10KSB7XHJcblx0XHR2YXIgc19lbCA9IHJvdy5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX29wdC1zdGFydCcpO1xyXG5cdFx0dmFyIGVfZWwgPSByb3cucXVlcnlTZWxlY3RvcignLndwYmNfYmZiX19vcHQtZW5kJyk7XHJcblx0XHRpZiAoIXNfZWwgfHwgIWVfZWwpIHJldHVybjtcclxuXHJcblx0XHR2YXIgc19tID0gVGltZS5wYXJzZV9taW51dGVzKHNfZWwudmFsdWUpO1xyXG5cdFx0dmFyIGVfbSA9IFRpbWUucGFyc2VfbWludXRlcyhlX2VsLnZhbHVlKTtcclxuXHJcblx0XHR2YXIgc19uZXcgPSBUaW1lLmNvbnZlcnRfaW5wdXRfbm9kZV90b19mb3JtYXQoc19lbCwgdG9fZm10LCBzX20pO1xyXG5cdFx0dmFyIGVfbmV3ID0gVGltZS5jb252ZXJ0X2lucHV0X25vZGVfdG9fZm9ybWF0KGVfZWwsIHRvX2ZtdCwgZV9tKTtcclxuXHJcblx0XHRpZiAodG9fZm10ID09PSAnMjRoJykge1xyXG5cdFx0XHRUaW1lLmFwcGx5X2ltYXNrX3RvX2lucHV0KHNfbmV3KTtcclxuXHRcdFx0VGltZS5hcHBseV9pbWFza190b19pbnB1dChlX25ldyk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRUaW1lLmNsZWFyX2ltYXNrKHNfbmV3KTtcclxuXHRcdFx0VGltZS5jbGVhcl9pbWFzayhlX25ldyk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogUmVidWlsZCBhbGwgcm93cyB1bmRlciBjb250YWluZXIgdG8gdGFyZ2V0IGZvcm1hdC5cclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjb250YWluZXJcclxuXHQgKiBAcGFyYW0geycyNGgnfCdhbXBtJ30gdG9fZm10XHJcblx0ICovXHJcblx0VGltZS5yZWJ1aWxkX2FsbF9yb3dzX3RvX2Zvcm1hdCA9IGZ1bmN0aW9uIChjb250YWluZXIsIHRvX2ZtdCkge1xyXG5cdFx0aWYgKCFjb250YWluZXIpIHJldHVybjtcclxuXHRcdGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCcud3BiY19iZmJfX29wdGlvbnNfcm93JykuZm9yRWFjaChmdW5jdGlvbiAocm93KSB7XHJcblx0XHRcdFRpbWUucmVidWlsZF9yb3dfaW5wdXRzX3RvX2Zvcm1hdChyb3csIHRvX2ZtdCk7XHJcblx0XHR9KTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBBcHBseSBpTWFzayB0byBhbGwgMjRoLW1hc2tlZCBpbnB1dHMgd2l0aGluIGNvbnRhaW5lci5cclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjb250YWluZXJcclxuXHQgKi9cclxuXHRUaW1lLmFwcGx5X2ltYXNrX2luX2NvbnRhaW5lcl8yNGggPSBmdW5jdGlvbiAoY29udGFpbmVyKSB7XHJcblx0XHRpZiAoICFJTWFzayB8fCAhY29udGFpbmVyICkgcmV0dXJuO1xyXG5cdFx0Y29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoICdpbnB1dFtkYXRhLW1hc2sta2luZD1cIjI0aFwiXScgKS5mb3JFYWNoKCBmdW5jdGlvbiAoZWwpIHtcclxuXHRcdFx0VGltZS5hcHBseV9pbWFza190b19pbnB1dCggZWwgKTtcclxuXHRcdH0gKTtcclxuXHR9O1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFNsb3QgZ2VuZXJhdGlvblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdC8qKlxyXG5cdCAqIEJ1aWxkIHNsb3RzOiBbe2xhYmVsLCB2YWx1ZSwgc2VsZWN0ZWQ6ZmFsc2V9LCAuLi5dXHJcblx0ICogTm90ZTogZ2VuZXJhdGlvbiBleHBlY3RzIGVuZCA+IHN0YXJ0LiAoT3Zlcm5pZ2h0IHJhbmdlcyBhcmUgZW50ZXJlZCBtYW51YWxseSB2aWEgZWRpdG9yLilcclxuXHQgKiBAcGFyYW0ge251bWJlcn0gc3RhcnRfbWludXRlc1xyXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBlbmRfbWludXRlc1xyXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBzdGVwX21pbnV0ZXNcclxuXHQgKiBAcGFyYW0geycyNGgnfCdhbXBtJ30gbGFiZWxfZm10XHJcblx0ICogQHJldHVybiB7QXJyYXk8e2xhYmVsOnN0cmluZyx2YWx1ZTpzdHJpbmcsc2VsZWN0ZWQ6Ym9vbGVhbn0+fVxyXG5cdCAqL1xyXG5cdFRpbWUuYnVpbGRfdGltZV9zbG90cyA9IGZ1bmN0aW9uIChzdGFydF9taW51dGVzLCBlbmRfbWludXRlcywgc3RlcF9taW51dGVzLCBsYWJlbF9mbXQpIHtcclxuXHRcdGlmIChpc05hTihzdGFydF9taW51dGVzKSB8fCBpc05hTihlbmRfbWludXRlcykgfHwgaXNOYU4oc3RlcF9taW51dGVzKSkgcmV0dXJuIFtdO1xyXG5cdFx0aWYgKGVuZF9taW51dGVzIDw9IHN0YXJ0X21pbnV0ZXMgfHwgc3RlcF9taW51dGVzIDw9IDApIHJldHVybiBbXTtcclxuXHRcdHZhciBvdXQgPSBbXTtcclxuXHRcdGZvciAodmFyIHQgPSBzdGFydF9taW51dGVzOyAodCArIHN0ZXBfbWludXRlcykgPD0gZW5kX21pbnV0ZXM7IHQgKz0gc3RlcF9taW51dGVzKSB7XHJcblx0XHRcdHZhciB0MiAgPSB0ICsgc3RlcF9taW51dGVzO1xyXG5cdFx0XHR2YXIgdjEgID0gVGltZS5mb3JtYXRfbWludXRlc18yNGgodCk7XHJcblx0XHRcdHZhciB2MiAgPSBUaW1lLmZvcm1hdF9taW51dGVzXzI0aCh0Mik7XHJcblx0XHRcdHZhciBsMSAgPSAobGFiZWxfZm10ID09PSAnMjRoJykgPyB2MSA6IFRpbWUuZm9ybWF0X21pbnV0ZXNfYW1wbSh0KTtcclxuXHRcdFx0dmFyIGwyICA9IChsYWJlbF9mbXQgPT09ICcyNGgnKSA/IHYyIDogVGltZS5mb3JtYXRfbWludXRlc19hbXBtKHQyKTtcclxuXHRcdFx0b3V0LnB1c2goeyBsYWJlbDogbDEgKyAnIC0gJyArIGwyLCB2YWx1ZTogdjEgKyAnIC0gJyArIHYyLCBzZWxlY3RlZDogZmFsc2UgfSk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gb3V0O1xyXG5cdH07XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gR2xvYmFsIFwidGltZS1zbG90IHBpY2tlclwiIGZsYWcgaGVscGVyc1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlYWQgZ2xvYmFsIHRpbWUtc2xvdCBwaWNrZXIgZmxhZyAoc2F2ZWQgdmlhIF93cGJjIG90aGVyIHBhcmFtcykuXHJcblx0ICogQHJldHVybiB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRUaW1lLnJlYWRfcGlja2VyX2VuYWJsZWQgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHR0cnkge1xyXG5cdFx0XHRpZiAoISh3Ll93cGJjICYmIHR5cGVvZiB3Ll93cGJjLmdldF9vdGhlcl9wYXJhbSA9PT0gJ2Z1bmN0aW9uJykpIHJldHVybiBmYWxzZTtcclxuXHRcdFx0cmV0dXJuIFRpbWUuY29lcmNlX3RvX2Jvb2wody5fd3BiYy5nZXRfb3RoZXJfcGFyYW0oJ2lzX2VuYWJsZWRfYm9va2luZ190aW1lc2xvdF9waWNrZXInKSk7XHJcblx0XHR9IGNhdGNoIChlKSB7IHJldHVybiBmYWxzZTsgfVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFBlcnNpc3QgZ2xvYmFsIHRpbWUtc2xvdCBwaWNrZXIgZmxhZy5cclxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZWRcclxuXHQgKi9cclxuXHRUaW1lLnNldF9waWNrZXJfZW5hYmxlZCA9IGZ1bmN0aW9uIChlbmFibGVkKSB7XHJcblx0XHR0cnkge1xyXG5cdFx0XHRpZiAody5fd3BiYyAmJiB0eXBlb2Ygdy5fd3BiYy5zZXRfb3RoZXJfcGFyYW0gPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdFx0XHR3Ll93cGJjLnNldF9vdGhlcl9wYXJhbSgnaXNfZW5hYmxlZF9ib29raW5nX3RpbWVzbG90X3BpY2tlcicsICEhZW5hYmxlZCk7XHJcblx0XHRcdH1cclxuXHRcdH0gY2F0Y2ggKGUpIHt9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2V0IHRvZ2dsZSArIGhpZGUvc2hvdyBwbGFjZWhvbGRlciByb3cgd2l0aGluIGEgc2luZ2xlIEluc3BlY3RvciBwYW5lbC5cclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwYW5lbFxyXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gZW5hYmxlZFxyXG5cdCAqL1xyXG5cdFRpbWUudWlfc2V0X3BpY2tlcl90b2dnbGVfZm9yX3BhbmVsID0gZnVuY3Rpb24gKHBhbmVsLCBlbmFibGVkKSB7XG5cdFx0aWYgKCFwYW5lbCkgcmV0dXJuO1xuXHRcdHZhciBjaGsgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcuanMtdG9nZ2xlLXRpbWVzbG90LXBpY2tlcicpO1xuXHRcdGlmIChjaGspIGNoay5jaGVja2VkID0gISFlbmFibGVkO1xuXG5cdFx0dmFyIHNraW5fcm93ID0gcGFuZWwucXVlcnlTZWxlY3RvcignLmpzLXRpbWUtcGlja2VyLXNraW4tcm93Jyk7XG5cdFx0aWYgKHNraW5fcm93KSB7XG5cdFx0XHRza2luX3Jvdy5oaWRkZW4gPSAhZW5hYmxlZDtcblx0XHRcdHNraW5fcm93LnN0eWxlLmRpc3BsYXkgPSBlbmFibGVkID8gJycgOiAnbm9uZSc7XG5cdFx0XHRza2luX3Jvdy5zZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicsIGVuYWJsZWQgPyAnZmFsc2UnIDogJ3RydWUnICk7XG5cdFx0fVxuXG5cdFx0dmFyIHBoUm93ID0gcGFuZWwucXVlcnlTZWxlY3RvcignLmpzLXBsYWNlaG9sZGVyLXJvdycpO1xuXHRcdGlmIChwaFJvdykge1xyXG5cdFx0XHRpZiAoZW5hYmxlZCkgeyBwaFJvdy5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyBwaFJvdy5oaWRkZW4gPSB0cnVlOyB9XHJcblx0XHRcdGVsc2UgeyBwaFJvdy5zdHlsZS5kaXNwbGF5ID0gJyc7IHBoUm93LmhpZGRlbiA9IGZhbHNlOyB9XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogQXBwbHkgcGlja2VyIGZsYWcgdG8gYWxsIG9wZW4gVGltZSBpbnNwZWN0b3JzLlxyXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gZW5hYmxlZFxyXG5cdCAqL1xyXG5cdFRpbWUudWlfYXBwbHlfcGlja2VyX2VuYWJsZWRfdG9fYWxsID0gZnVuY3Rpb24gKGVuYWJsZWQpIHtcblx0XHRkLnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2luc3BlY3Rvcl90aW1lcGlja2VyJyApLmZvckVhY2goIGZ1bmN0aW9uIChwYW5lbCkge1xyXG5cdFx0XHQvLyBTZXQgdG9nZ2xlICsgaGlkZS9zaG93IHBsYWNlaG9sZGVyIHJvdyB3aXRoaW4gYSBzaW5nbGUgSW5zcGVjdG9yIHBhbmVsLlxyXG5cdFx0XHRUaW1lLnVpX3NldF9waWNrZXJfdG9nZ2xlX2Zvcl9wYW5lbCggcGFuZWwsIGVuYWJsZWQgKTtcclxuXHRcdH0gKTtcclxuXHR9O1xuXG5cdC8qKlxuXHQgKiBBcHBseSBhIHRpbWUtcGlja2VyIHNraW4gVVJMIGRpcmVjdGx5IHRvIHRoZSBCdWlsZGVyIGRvY3VtZW50LlxuXHQgKlxuXHQgKiBVcGRhdGluZyB0aGUgZXhpc3RpbmcgbGluayBhdm9pZHMgYSBuby1zdHlsZXMgaW50ZXJ2YWwuIElmIGFub3RoZXJcblx0ICogaW50ZWdyYXRpb24gb21pdHRlZCB0aGUgbGluaywgY3JlYXRlIGl0IHNvIEluc3BlY3RvciBjaGFuZ2VzIHN0aWxsXG5cdCAqIHByb2R1Y2UgYW4gaW1tZWRpYXRlIENhbnZhcyBwcmV2aWV3LlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gc2tpbl91cmwgUHVibGljIHRpbWUtcGlja2VyIHNraW4gVVJMLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBXaGV0aGVyIGEgc3R5bGVzaGVldCBVUkwgd2FzIGFwcGxpZWQuXG5cdCAqL1xuXHRUaW1lLmFwcGx5X3BpY2tlcl9za2luX3VybCA9IGZ1bmN0aW9uIChza2luX3VybCkge1xuXHRcdGlmICggISBza2luX3VybCApIHJldHVybiBmYWxzZTtcblxuXHRcdHZhciBzdHlsZXNoZWV0ID0gZC5nZXRFbGVtZW50QnlJZCggJ3dwYmMtdGltZV9waWNrZXItc2tpbi1jc3MnICk7XG5cdFx0aWYgKCAhIHN0eWxlc2hlZXQgKSB7XG5cdFx0XHRzdHlsZXNoZWV0ID0gZC5jcmVhdGVFbGVtZW50KCAnbGluaycgKTtcblx0XHRcdHN0eWxlc2hlZXQuaWQgPSAnd3BiYy10aW1lX3BpY2tlci1za2luLWNzcyc7XG5cdFx0XHRzdHlsZXNoZWV0LnJlbCA9ICdzdHlsZXNoZWV0Jztcblx0XHRcdHN0eWxlc2hlZXQudHlwZSA9ICd0ZXh0L2Nzcyc7XG5cdFx0XHRzdHlsZXNoZWV0Lm1lZGlhID0gJ3NjcmVlbic7XG5cdFx0XHQoIGQuaGVhZCB8fCBkLmdldEVsZW1lbnRzQnlUYWdOYW1lKCAnaGVhZCcgKVswXSApLmFwcGVuZENoaWxkKCBzdHlsZXNoZWV0ICk7XG5cdFx0fVxuXG5cdFx0c3R5bGVzaGVldC5zZXRBdHRyaWJ1dGUoICdocmVmJywgU3RyaW5nKCBza2luX3VybCApICk7XG5cdFx0aWYgKCBUaW1lLnJlYWRfcGlja2VyX2VuYWJsZWQoKSApIHtcblx0XHRcdFRpbWUuc2V0X3BpY2tlcl9lbmFibGVkKCB0cnVlICk7XG5cdFx0XHRUaW1lLnNjaGVkdWxlX2luaXRfdGltZXNlbGVjdG9yKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH07XG5cblx0LyoqXG5cdCAqIEFwcGx5IGEgc2VsZWN0ZWQgdGltZS1waWNrZXIgc2tpbiB0byB0aGUgQnVpbGRlciBwcmV2aWV3IHN0eWxlc2hlZXQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTFNlbGVjdEVsZW1lbnR9IHNlbGVjdF9jb250cm9sIFNraW4gc2VsZWN0Ym94LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0VGltZS5hcHBseV9waWNrZXJfc2tpbl9mcm9tX3NlbGVjdCA9IGZ1bmN0aW9uIChzZWxlY3RfY29udHJvbCkge1xuXHRcdGlmICggISBzZWxlY3RfY29udHJvbCApIHJldHVybjtcblx0XHR2YXIgc2VsZWN0ZWRfb3B0aW9uID0gc2VsZWN0X2NvbnRyb2wub3B0aW9ucyAmJiBzZWxlY3RfY29udHJvbC5zZWxlY3RlZEluZGV4ID49IDBcblx0XHRcdD8gc2VsZWN0X2NvbnRyb2wub3B0aW9uc1sgc2VsZWN0X2NvbnRyb2wuc2VsZWN0ZWRJbmRleCBdXG5cdFx0XHQ6IG51bGw7XG5cdFx0dmFyIHNraW5fdXJsID0gc2VsZWN0ZWRfb3B0aW9uID8gU3RyaW5nKCBzZWxlY3RlZF9vcHRpb24uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWUtcGlja2VyLXNraW4tdXJsJyApIHx8ICcnICkgOiAnJztcblxuXHRcdFRpbWUuYXBwbHlfcGlja2VyX3NraW5fdXJsKCBza2luX3VybCApO1xuXG5cdFx0Ly8gVGhlIHN0eWxlIHJvdyBpcyBhdmFpbGFibGUgb25seSB3aGlsZSB0aGUgZ2xvYmFsIHBpY2tlciBpcyBlbmFibGVkLlxuXHRcdC8vIFJlY29uY2lsZSB0aGUgcnVudGltZSBmbGFnIGFzIHdlbGwsIHNvIGFuIG9sZGVyIEJ1aWxkZXIgc2Vzc2lvbiBjYW5cblx0XHQvLyBpbW1lZGlhdGVseSBjb25zdHJ1Y3QgaXRzIENhbnZhcyBjaG9pY2VzIHdpdGhvdXQgYSBwYWdlIHJlbG9hZC5cblx0XHR2YXIgcGFuZWwgPSBzZWxlY3RfY29udHJvbC5jbG9zZXN0ID8gc2VsZWN0X2NvbnRyb2wuY2xvc2VzdCggJy53cGJjX2JmYl9faW5zcGVjdG9yX3RpbWVwaWNrZXInICkgOiBudWxsO1xuXHRcdHZhciBwaWNrZXJfdG9nZ2xlID0gcGFuZWwgPyBwYW5lbC5xdWVyeVNlbGVjdG9yKCAnLmpzLXRvZ2dsZS10aW1lc2xvdC1waWNrZXInICkgOiBudWxsO1xuXHRcdGlmICggcGlja2VyX3RvZ2dsZSAmJiBwaWNrZXJfdG9nZ2xlLmNoZWNrZWQgKSB7XG5cdFx0XHRUaW1lLnNldF9waWNrZXJfZW5hYmxlZCggdHJ1ZSApO1xuXHRcdFx0VGltZS5zY2hlZHVsZV9pbml0X3RpbWVzZWxlY3RvcigpO1xuXHRcdH1cblx0fTtcblxuXHQvKipcblx0ICogU3luY2hyb25pemUgYWxsIG9wZW4gdGltZS1maWVsZCBza2luIGNvbnRyb2xzIHRvIGEgc2F2ZWQgZ2xvYmFsIHZhbHVlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gc2tpbl92YWx1ZSBSZWxhdGl2ZSB0aW1lLXBpY2tlciBza2luIHBhdGguXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRUaW1lLnVpX3NldF9waWNrZXJfc2tpbl92YWx1ZSA9IGZ1bmN0aW9uIChza2luX3ZhbHVlKSB7XG5cdFx0ZC5xdWVyeVNlbGVjdG9yQWxsKCAnLmpzLXdwYmMtYmZiLXRpbWUtcGlja2VyLXNraW4nICkuZm9yRWFjaCggZnVuY3Rpb24gKHNlbGVjdF9jb250cm9sKSB7XG5cdFx0XHRzZWxlY3RfY29udHJvbC52YWx1ZSA9IFN0cmluZyggc2tpbl92YWx1ZSB8fCAnJyApO1xuXHRcdH0gKTtcblx0fTtcblxuXHQvKipcblx0ICogU3luY2hyb25pemUgb3RoZXIgY29udHJvbHMgYWZ0ZXIgYSBnbG9iYWwgdGltZS1waWNrZXIgc2tpbiBpcyBzYXZlZC5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdFRpbWUub25fcGlja2VyX3NraW5fc2F2ZWQgPSBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIHNlbGVjdF9jb250cm9sID0gZC5xdWVyeVNlbGVjdG9yKCAnLmpzLXdwYmMtYmZiLXRpbWUtcGlja2VyLXNraW4nICk7XG5cdFx0dmFyIHNraW5fdmFsdWUgPSBzZWxlY3RfY29udHJvbCA/IFN0cmluZyggc2VsZWN0X2NvbnRyb2wudmFsdWUgfHwgJycgKSA6ICcnO1xuXHRcdHZhciBhY2NlbnRfYnV0dG9uID0gZC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1iZmItYXBwbHktYWNjZW50LWNvbXBvbmVudHM9XCIxXCJdJyApO1xuXG5cdFx0VGltZS51aV9zZXRfcGlja2VyX3NraW5fdmFsdWUoIHNraW5fdmFsdWUgKTtcblx0XHRpZiAoIGFjY2VudF9idXR0b24gKSB7XG5cdFx0XHRhY2NlbnRfYnV0dG9uLnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lLXBpY2tlci1za2luLWN1cnJlbnQnLCBza2luX3ZhbHVlICk7XG5cdFx0fVxuXHR9O1xuXG5cdC8vIFRoZSBnZW5lcmljIHByb3RlY3RlZCBvcHRpb24gc2F2ZXIgcmVzb2x2ZXMgc3VjY2Vzc2Z1bCBjYWxsYmFja3MgYnkgZ2xvYmFsIGZ1bmN0aW9uIG5hbWUuXG5cdHcud3BiY19iZmJfdGltZV9waWNrZXJfc2tpbl9jb250cm9sX3NhdmVkID0gVGltZS5vbl9waWNrZXJfc2tpbl9zYXZlZDtcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRGVib3VuY2VkIGluaXQgZm9yIGV4dGVybmFsIHRpbWUgc2VsZWN0b3IgKGNhbnZhcyBwcmV2aWV3KVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdC8qKlxyXG5cdCAqIERlYm91bmNlZCBjYWxsIHRvIGdsb2JhbCBpbml0aWFsaXplciAoaWYgcHJlc2VudCk6IHdwYmNfaG9va19faW5pdF90aW1lc2VsZWN0b3IoKVxyXG5cdCAqL1xyXG5cdFRpbWUuc2NoZWR1bGVfaW5pdF90aW1lc2VsZWN0b3IgPSAoZnVuY3Rpb24gKCkge1xyXG5cdFx0bGV0IHNjaGVkdWxlZCA9IGZhbHNlO1xyXG5cdFx0bGV0IHRpZCA9IG51bGw7XHJcblx0XHRjb25zdCBERUxBWSA9IDMwO1xyXG5cdFx0cmV0dXJuIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0aWYgKHNjaGVkdWxlZCkgcmV0dXJuO1xyXG5cdFx0XHRzY2hlZHVsZWQgPSB0cnVlO1xyXG5cdFx0XHRjbGVhclRpbWVvdXQodGlkKTtcclxuXHRcdFx0dGlkID0gc2V0VGltZW91dChmdW5jdGlvbiBydW4oKSB7XHJcblx0XHRcdFx0c2NoZWR1bGVkID0gZmFsc2U7XHJcblx0XHRcdFx0aWYgKCFkLnF1ZXJ5U2VsZWN0b3IoJy53cGJjX2JmYl9fcHJldmlldy10aW1lcGlja2VyJykpIHJldHVybjtcclxuXHRcdFx0XHRpZiAodHlwZW9mIHcud3BiY19ob29rX19pbml0X3RpbWVzZWxlY3RvciA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0dy5fX3dwYmNfcnRfbW9fcGF1c2UgJiYgdy5fX3dwYmNfcnRfbW9fcGF1c2UoKTtcclxuXHRcdFx0XHRcdFx0dy5fX3dwYmNfc3RfbW9fcGF1c2UgJiYgdy5fX3dwYmNfc3RfbW9fcGF1c2UoKTtcclxuXHRcdFx0XHRcdFx0dy53cGJjX2hvb2tfX2luaXRfdGltZXNlbGVjdG9yKCk7XHJcblx0XHRcdFx0XHR9IGNhdGNoICggZSApIHsvKiBuby1vcCAqL1xyXG5cdFx0XHRcdFx0fSBmaW5hbGx5IHtcclxuXHRcdFx0XHRcdFx0dy5fX3dwYmNfcnRfbW9fcmVzdW1lICYmIHcuX193cGJjX3J0X21vX3Jlc3VtZSgpO1xyXG5cdFx0XHRcdFx0XHR3Ll9fd3BiY19zdF9tb19yZXN1bWUgJiYgdy5fX3dwYmNfc3RfbW9fcmVzdW1lKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCBERUxBWSApO1xyXG5cdFx0fTtcclxuXHR9KSgpO1xyXG5cclxuXHJcblx0LyoqXHJcblx0ICogTWlycm9yIHRvIFNldHRpbmdzIFVJIHdpdGhvdXQgZmlyaW5nIERPTSAnY2hhbmdlJyAobG9vcC1zYWZlKS5cclxuXHQgKi9cclxuXHRUaW1lLm1pcnJvcl9zZXR0aW5nc190b2dnbGUgPSBmdW5jdGlvbiAoZW5hYmxlZCkge1xyXG5cdFx0d3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUoXHJcblx0XHRcdCd3cGJjOmJmYjpzZXR0aW5nczpzZXQnLFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0a2V5ICAgOiAnYm9va2luZ190aW1lc2xvdF9waWNrZXInLFxyXG5cdFx0XHRcdHZhbHVlIDogZW5hYmxlZCA/ICdPbicgOiAnT2ZmJyxcclxuXHRcdFx0XHRzb3VyY2U6ICd0aW1lLXV0aWxzJ1xyXG5cdFx0XHR9XHJcblx0XHQpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFByZXZpZXcgcmVmcmVzaCBmb3IgdGltZS1zbG90IHBpY2tlciB0b2dnbGUuXHJcblx0ICogLSBPTjoganVzdCBpbml0IGV4dGVybmFsIHRpbWUgc2VsZWN0b3IuXHJcblx0ICogLSBPRkY6IHRlYXJkb3duIHdpZGdldHMgYW5kIHVuaGlkZSA8c2VsZWN0PiBjb250cm9scywgdGhlbiBzb2Z0IHJlLXJlbmRlciAobm8gcmVidWlsZCkuXHJcblx0ICovXHJcblx0VGltZS5zeW5jX3ByZXZpZXdfYWZ0ZXJfZmxhZyA9IGZ1bmN0aW9uIChlbmFibGVkKSB7XHJcblx0XHRpZiAoIGVuYWJsZWQgKSB7XG5cdFx0XHRUaW1lLnNjaGVkdWxlX2luaXRfdGltZXNlbGVjdG9yKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRyeSB7XG5cdFx0XHRpZiAoIHR5cGVvZiB3LndwYmNfaG9va19fZGVzdHJveV90aW1lc2VsZWN0b3IgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdHcud3BiY19ob29rX19kZXN0cm95X3RpbWVzZWxlY3RvciggZCApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX3RpbWVzX3NlbGVjdG9yJyApLmZvckVhY2goIGZ1bmN0aW9uIChlbCkge1xuXHRcdFx0XHRcdGlmICggZWwucGFyZW50Tm9kZSApIGVsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoIGVsICk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcblx0XHRcdFx0XHQnLndwYmNfYmZiX19wcmV2aWV3LXNlbGVjdC53cGJjX2JmYl9fcHJldmlldy1yYW5nZXRpbWUsJyArXG5cdFx0XHRcdFx0J3NlbGVjdFtuYW1lXj1cInJhbmdldGltZVwiXSwgc2VsZWN0W25hbWVePVwic3RhcnR0aW1lXCJdLCBzZWxlY3RbbmFtZV49XCJlbmR0aW1lXCJdLCBzZWxlY3RbbmFtZV49XCJkdXJhdGlvbnRpbWVcIl0nXG5cdFx0XHRcdCkuZm9yRWFjaCggZnVuY3Rpb24gKHMpIHtcblx0XHRcdFx0XHRzLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnZGlzcGxheScgKTtcblx0XHRcdFx0XHRzLmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoIGUgKSB7XG5cdFx0fVxyXG5cdFx0aWYgKCB3aW5kb3cuV1BCQ19CRkJfU2V0dGluZ3MgJiYgdHlwZW9mIHdpbmRvdy5XUEJDX0JGQl9TZXR0aW5ncy53aGVuX2J1aWxkZXJfcmVhZHkgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdHdpbmRvdy5XUEJDX0JGQl9TZXR0aW5ncy53aGVuX2J1aWxkZXJfcmVhZHkoIGZ1bmN0aW9uIChiKSB7XHJcblx0XHRcdFx0aWYgKCAhYiB8fCAhYi5wcmV2aWV3X21vZGUgKSByZXR1cm47XHJcblx0XHRcdFx0aWYgKCB0eXBlb2YgYi5yZWZyZXNoX2NhbnZhcyA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdGIucmVmcmVzaF9jYW52YXMoIHtcclxuXHRcdFx0XHRcdFx0aGFyZCAgICAgICAgICAgICA6IHRydWUsXHJcblx0XHRcdFx0XHRcdHJlYnVpbGQgICAgICAgICAgOiBmYWxzZSwgICAvLyBjcml0aWNhbDogbm8gbG9hZF9zYXZlZF9zdHJ1Y3R1cmUoKVxyXG5cdFx0XHRcdFx0XHRyZWluaXQgICAgICAgICAgIDogZmFsc2UsXHJcblx0XHRcdFx0XHRcdHJlc3RvcmVfc2VsZWN0aW9uOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRyZXN0b3JlX3Njcm9sbCAgIDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0c2lsZW50X2luc3BlY3RvciA6IHRydWUsXHJcblx0XHRcdFx0XHRcdHNvdXJjZSAgICAgICAgICAgOiAnc2V0dGluZ3M6dGltZXNsb3QnXHJcblx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0fSBlbHNlIGlmICggdHlwZW9mIGIucmVuZGVyX3ByZXZpZXdfYWxsID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0Yi5yZW5kZXJfcHJldmlld19hbGwoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBPbmUtY2FsbCB1bml2ZXJzYWwgc2V0dGVyIHVzZWQgYnkgU2V0dGluZ3MgKyBhbGwgdGltZS1maWVsZCBpbnNwZWN0b3JzLlxyXG5cdCAqL1xyXG5cdFRpbWUuc2V0X2dsb2JhbF90aW1lc2xvdF9waWNrZXIgPSBmdW5jdGlvbiAoZW5hYmxlZCwgb3B0cykge1xyXG5cdFx0b3B0cyA9IG9wdHMgfHwge307XHJcblx0XHRUaW1lLnNldF9waWNrZXJfZW5hYmxlZCggZW5hYmxlZCApOyAgICAgICAgICAgICAgICAgLy8gcGVyc2lzdCBpbi1tZW1vcnkgZmxhZ1xyXG5cdFx0VGltZS51aV9hcHBseV9waWNrZXJfZW5hYmxlZF90b19hbGwoIGVuYWJsZWQgKTsgICAgIC8vIHN5bmMgYWxsIG9wZW4gaW5zcGVjdG9yc1xyXG5cdFx0aWYgKCBvcHRzLm1pcnJvcl9zZXR0aW5ncyAhPT0gZmFsc2UgKSB7XHJcblx0XHRcdFRpbWUubWlycm9yX3NldHRpbmdzX3RvZ2dsZSggZW5hYmxlZCApOyAgICAgICAgICAgLy8gbWlycm9yIFNldHRpbmdzIHRvZ2dsZSAobm8gJ2NoYW5nZScgZXZlbnQpXHJcblx0XHR9XHJcblx0XHRpZiAoIG9wdHMucmVmcmVzaF9wcmV2aWV3ICE9PSBmYWxzZSApIHtcclxuXHRcdFx0VGltZS5zeW5jX3ByZXZpZXdfYWZ0ZXJfZmxhZyggZW5hYmxlZCApOyAgICAgICAgICAvLyBzYWZlIHByZXZpZXcgcmVmcmVzaFxyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gR2xvYmFsIGJpbmRlcjogc2VsZWN0IHZzLiB0aW1lIHBpY2tlciB0b2dnbGUgKE9ORS1USU1FLCBzaGFyZWQgYnkgYWxsIHRpbWUtYmFzZWQgcGFja3MpXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0LyoqXHJcblx0ICogQmluZCBvbmNlIHRvOlxyXG5cdCAqICAtIGluaXRpYWxpemUgYWxsIG9wZW4gSW5zcGVjdG9yIHBhbmVscyB3aXRoIHRoZSBjdXJyZW50IGdsb2JhbCBmbGFnLFxyXG5cdCAqICAtIHJlYWN0IHRvIG5ld2x5IGFkZGVkIEluc3BlY3RvciBwYW5lbHMgdmlhIE11dGF0aW9uT2JzZXJ2ZXIsXHJcblx0ICogIC0gcGVyc2lzdCBhbmQgYnJvYWRjYXN0IGNoYW5nZXMgd2hlbiB0aGUgXCJTaG93IGFzIHRpbWUgcGlja2VyXCIgY2hlY2tib3ggdG9nZ2xlcy5cclxuXHQgKi9cclxuXHRUaW1lLmVuc3VyZV9nbG9iYWxfdGltZXBpY2tlcl90b2dnbGVfYmluZGVyID0gZnVuY3Rpb24gKCkge1xyXG5cclxuXHRcdGlmIChUaW1lLl9fdG9nZ2xlQmluZGVyQm91bmQpIHJldHVybjtcclxuXHRcdFRpbWUuX190b2dnbGVCaW5kZXJCb3VuZCA9IHRydWU7XHJcblxyXG5cdFx0Ly8gMSkgSW5pdCBhbGwgY3VycmVudGx5IG9wZW4gcGFuZWxzXHJcblx0XHRmdW5jdGlvbiBpbml0X2FsbF9wYW5lbHMoKSB7XHJcblx0XHRcdFRpbWUudWlfYXBwbHlfcGlja2VyX2VuYWJsZWRfdG9fYWxsKFRpbWUucmVhZF9waWNrZXJfZW5hYmxlZCgpKTtcclxuXHRcdH1cclxuXHRcdChkLnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJylcclxuXHRcdFx0PyBkLmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBpbml0X2FsbF9wYW5lbHMpXHJcblx0XHRcdDogaW5pdF9hbGxfcGFuZWxzKCk7XHJcblxyXG5cdFx0Ly8gMikgT2JzZXJ2ZSBJbnNwZWN0b3IgcGFuZWxzIHRoYXQgYXBwZWFyIGxhdGVyXHJcblx0XHR0cnkge1xyXG5cdFx0XHR2YXIgbW8gPSBuZXcgTXV0YXRpb25PYnNlcnZlcihmdW5jdGlvbiAobXV0cykge1xyXG5cdFx0XHRcdHZhciBlbmFibGVkID0gVGltZS5yZWFkX3BpY2tlcl9lbmFibGVkKCk7XHJcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBtdXRzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0XHR2YXIgbSA9IG11dHNbaV07XHJcblx0XHRcdFx0XHRmb3IgKHZhciBqID0gMDsgaiA8IG0uYWRkZWROb2Rlcy5sZW5ndGg7IGorKykge1xyXG5cdFx0XHRcdFx0XHR2YXIgbiA9IG0uYWRkZWROb2Rlc1tqXTtcclxuXHRcdFx0XHRcdFx0aWYgKCFuIHx8IG4ubm9kZVR5cGUgIT09IDEpIGNvbnRpbnVlO1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKG4ubWF0Y2hlcyAmJiBuLm1hdGNoZXMoJy53cGJjX2JmYl9faW5zcGVjdG9yX3RpbWVwaWNrZXInKSkge1xyXG5cdFx0XHRcdFx0XHRcdHRyeSB7IFRpbWUudWlfc2V0X3BpY2tlcl90b2dnbGVfZm9yX3BhbmVsKG4sIGVuYWJsZWQpOyB9IGNhdGNoIChlKSB7fVxyXG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKG4ucXVlcnlTZWxlY3Rvcikge1xyXG5cdFx0XHRcdFx0XHRcdG4ucXVlcnlTZWxlY3RvckFsbCgnLndwYmNfYmZiX19pbnNwZWN0b3JfdGltZXBpY2tlcicpLmZvckVhY2goZnVuY3Rpb24gKHBhbmVsKSB7XHJcblx0XHRcdFx0XHRcdFx0XHR0cnkgeyBUaW1lLnVpX3NldF9waWNrZXJfdG9nZ2xlX2Zvcl9wYW5lbChwYW5lbCwgZW5hYmxlZCk7IH0gY2F0Y2ggKGUpIHt9XHJcblx0XHRcdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cdFx0XHRtby5vYnNlcnZlKGQuYm9keSwgeyBjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUgfSk7XHJcblx0XHRcdC8vIE9wdGlvbmFsIHBhdXNlL3Jlc3VtZSBob29rcyBpZiBvdGhlciBtb2R1bGVzIHdhbnQgdG8gc3VzcGVuZCBvYnNlcnZlcnMgdGVtcG9yYXJpbHk6XHJcblx0XHRcdHcuX193cGJjX3RpbWVwaWNrZXJfdG9nZ2xlX21vX3BhdXNlICA9IGZ1bmN0aW9uKCl7IHRyeSB7IG1vLmRpc2Nvbm5lY3QoKTsgfSBjYXRjaChlKXt9IH07XHJcblx0XHRcdHcuX193cGJjX3RpbWVwaWNrZXJfdG9nZ2xlX21vX3Jlc3VtZSA9IGZ1bmN0aW9uKCl7XHJcblx0XHRcdFx0dHJ5IHsgbW8ub2JzZXJ2ZShkLmJvZHksIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0pOyB9IGNhdGNoKGUpe31cclxuXHRcdFx0fTtcclxuXHRcdH0gY2F0Y2ggKGUpIHt9XHJcblxyXG5cdFx0Ly8gMykgQ2hlY2tib3ggaGFuZGxlciAoZGVsZWdhdGVkKS5cblx0XHQvLyBTa2luIGNoYW5nZXMgdXNlIGpRdWVyeSBiZWxvdyBiZWNhdXNlIHRoZSBwcmV2aW91cy9uZXh0IHNlbGVjdGJveFxuXHRcdC8vIGNvbnRyb2xzIGRpc3BhdGNoIGpRdWVyeSdzIHN5bnRoZXRpYyBgY2hhbmdlYCBldmVudC5cblx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGZ1bmN0aW9uIChldikge1xuXHRcdFx0dmFyIHQgPSBldi50YXJnZXQ7XG5cdFx0XHRpZiAoIXQgfHwgIXQuY2xhc3NMaXN0KSByZXR1cm47XG5cblx0XHRcdGlmICh0LmNsYXNzTGlzdC5jb250YWlucygnanMtd3BiYy1iZmItdGltZS1waWNrZXItc2tpbicpKSB7XG5cdFx0XHRcdGlmICggISB3LmpRdWVyeSApIFRpbWUuYXBwbHlfcGlja2VyX3NraW5fZnJvbV9zZWxlY3QodCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICghdC5jbGFzc0xpc3QuY29udGFpbnMoJ2pzLXRvZ2dsZS10aW1lc2xvdC1waWNrZXInKSkgcmV0dXJuO1xuXHJcblx0XHRcdHZhciBlbmFibGVkID0gISF0LmNoZWNrZWQ7XG5cdFx0XHRUaW1lLnNldF9nbG9iYWxfdGltZXNsb3RfcGlja2VyKCBlbmFibGVkLCB7IHNvdXJjZTogJ2luc3BlY3RvcicgfSApO1xuXHRcdH0pO1xuXG5cdFx0aWYgKCB3LmpRdWVyeSApIHtcblx0XHRcdHcualF1ZXJ5KCBkIClcblx0XHRcdFx0Lm9mZiggJ2NoYW5nZS53cGJjQmZiVGltZVBpY2tlclNraW4nLCAnLmpzLXdwYmMtYmZiLXRpbWUtcGlja2VyLXNraW4nIClcblx0XHRcdFx0Lm9uKCAnY2hhbmdlLndwYmNCZmJUaW1lUGlja2VyU2tpbicsICcuanMtd3BiYy1iZmItdGltZS1waWNrZXItc2tpbicsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRUaW1lLmFwcGx5X3BpY2tlcl9za2luX2Zyb21fc2VsZWN0KCB0aGlzICk7XG5cdFx0XHRcdH0gKTtcblx0XHR9XG5cdH07XG5cclxuXHQvLyBBdXRvLWJpbmQgb24gc2NyaXB0IGxvYWQuXHJcblx0dHJ5IHsgVGltZS5lbnN1cmVfZ2xvYmFsX3RpbWVwaWNrZXJfdG9nZ2xlX2JpbmRlcigpOyB9IGNhdGNoIChlKSB7fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEJ1aWxkZXIgY2FudmFzIHJlZnJlc2ggaG9va3MgKG1vdmVkIG91dCBvZiBiZmItYnVpbGRlci5qcylcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHQvKipcclxuXHQgKiBCaW5kIHBhdXNlL3Jlc3VtZSBob29rcyB0byBCdWlsZGVyIGNhbnZhcyByZWZyZXNoIGV2ZW50cy5cclxuXHQgKlxyXG5cdCAqIFdoeSBoZXJlOlxyXG5cdCAqIC0gVGhpcyBtb2R1bGUgb3ducyB0aGUgdGltZXBpY2tlci10b2dnbGUgTXV0YXRpb25PYnNlcnZlciBhbmQgdGltZSBzZWxlY3RvciBpbml0LlxyXG5cdCAqIC0gQnVpbGRlciBzaG91bGQgbm90IGtub3cgYWJvdXQgcGFjay1zcGVjaWZpYyBvYnNlcnZlcnMuXHJcblx0ICpcclxuXHQgKiBTYWZldHk6XHJcblx0ICogLSBJZGVtcG90ZW50IChiaW5kcyBvbmNlKS5cclxuXHQgKiAtIFdhaXRzIGZvciB3cGJjX2JmYl9hcGkucmVhZHkuXHJcblx0ICogLSBObyBoYXJkIGRlcGVuZGVuY3k6IGlmIGJ1aWxkZXIvYnVzL2V2ZW50cyBhcmUgYWJzZW50LCBpdCBzaWxlbnRseSBuby1vcHMuXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHQgKi9cclxuXHRUaW1lLmVuc3VyZV9idWlsZGVyX2NhbnZhc19yZWZyZXNoX2hvb2tzID0gZnVuY3Rpb24gKCkge1xyXG5cclxuXHRcdGlmICggVGltZS5fX2J1aWxkZXJfY2FudmFzX3JlZnJlc2hfaG9va3NfYm91bmQgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdFRpbWUuX19idWlsZGVyX2NhbnZhc19yZWZyZXNoX2hvb2tzX2JvdW5kID0gdHJ1ZTtcclxuXHJcblx0XHQvLyBCdWlsZGVyIEFQSSBtdXN0IGV4aXN0LlxyXG5cdFx0aWYgKCAhdy53cGJjX2JmYl9hcGkgfHwgIXcud3BiY19iZmJfYXBpLnJlYWR5IHx8ICh0eXBlb2Ygdy53cGJjX2JmYl9hcGkucmVhZHkudGhlbiAhPT0gJ2Z1bmN0aW9uJykgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR3LndwYmNfYmZiX2FwaS5yZWFkeS50aGVuKCBmdW5jdGlvbiAoYnVpbGRlcikge1xyXG5cclxuXHRcdFx0Ly8gQnVpbGRlciBtaWdodCByZXNvbHZlIG51bGwgKHRpbWVvdXQpIOKAkyBqdXN0IGlnbm9yZS5cclxuXHRcdFx0aWYgKCAhYnVpbGRlciB8fCAhYnVpbGRlci5idXMgfHwgKHR5cGVvZiBidWlsZGVyLmJ1cy5vbiAhPT0gJ2Z1bmN0aW9uJykgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgRVZTICAgICAgID0gKHcuV1BCQ19CRkJfQ29yZSAmJiB3LldQQkNfQkZCX0NvcmUuV1BCQ19CRkJfRXZlbnRzKSA/IHcuV1BCQ19CRkJfQ29yZS5XUEJDX0JGQl9FdmVudHMgOiB7fTtcclxuXHRcdFx0dmFyIEVWX0JFRk9SRSA9IEVWUy5DQU5WQVNfUkVGUkVTSCB8fCAnd3BiYzpiZmI6Y2FudmFzLXJlZnJlc2gnO1xyXG5cdFx0XHR2YXIgRVZfQUZURVIgID0gRVZTLkNBTlZBU19SRUZSRVNIRUQgfHwgJ3dwYmM6YmZiOmNhbnZhcy1yZWZyZXNoZWQnO1xyXG5cclxuXHRcdFx0Ly8gQkVGT1JFIHJlZnJlc2g6IHBhdXNlIG9ic2VydmVycyB0byBhdm9pZCBsb29wcyAvIGV4dHJhIHdvcmsgd2hpbGUgRE9NIGlzIGJlaW5nIHJlYnVpbHQuXHJcblx0XHRcdGJ1aWxkZXIuYnVzLm9uKCBFVl9CRUZPUkUsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0aWYgKCB0eXBlb2Ygdy5fX3dwYmNfcnRfbW9fcGF1c2UgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdHcuX193cGJjX3J0X21vX3BhdXNlKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiB3Ll9fd3BiY19zdF9tb19wYXVzZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0dy5fX3dwYmNfc3RfbW9fcGF1c2UoKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdGlmICggdHlwZW9mIHcuX193cGJjX3RpbWVwaWNrZXJfdG9nZ2xlX21vX3BhdXNlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHR3Ll9fd3BiY190aW1lcGlja2VyX3RvZ2dsZV9tb19wYXVzZSgpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Ly8gQUZURVIgcmVmcmVzaDogcmVzdW1lIGFuZCAoaWYgbmVlZGVkKSByZS1pbml0IHRpbWVzZWxlY3RvciB3aWRnZXRzLlxyXG5cdFx0XHRidWlsZGVyLmJ1cy5vbiggRVZfQUZURVIsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0aWYgKCB0eXBlb2Ygdy5fX3dwYmNfcnRfbW9fcmVzdW1lID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHR3Ll9fd3BiY19ydF9tb19yZXN1bWUoKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdGlmICggdHlwZW9mIHcuX193cGJjX3N0X21vX3Jlc3VtZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0dy5fX3dwYmNfc3RfbW9fcmVzdW1lKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiB3Ll9fd3BiY190aW1lcGlja2VyX3RvZ2dsZV9tb19yZXN1bWUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdHcuX193cGJjX3RpbWVwaWNrZXJfdG9nZ2xlX21vX3Jlc3VtZSgpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gSWYgdGltZS1zbG90IHBpY2tlciBpcyBlbmFibGVkIGFuZCBidWlsZGVyIGlzIGluIHByZXZpZXcgbW9kZSwgcmUtaW5pdCB0aGUgdGltZSBzZWxlY3RvciBVSS5cclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0aWYgKCBidWlsZGVyLnByZXZpZXdfbW9kZSAmJiB0eXBlb2YgVGltZS5yZWFkX3BpY2tlcl9lbmFibGVkID09PSAnZnVuY3Rpb24nICYmIFRpbWUucmVhZF9waWNrZXJfZW5hYmxlZCgpICkge1xyXG5cdFx0XHRcdFx0XHRpZiAoIHR5cGVvZiBUaW1lLnNjaGVkdWxlX2luaXRfdGltZXNlbGVjdG9yID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRcdFRpbWUuc2NoZWR1bGVfaW5pdF90aW1lc2VsZWN0b3IoKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdH0gKTtcclxuXHR9O1xyXG5cclxuXHQvLyBDYWxsIG9uY2Ugb24gbG9hZC5cclxuXHR0cnkge1xyXG5cdFx0VGltZS5lbnN1cmVfYnVpbGRlcl9jYW52YXNfcmVmcmVzaF9ob29rcygpO1xyXG5cdH0gY2F0Y2ggKCBlICkge1xyXG5cdH1cclxuXHJcblxyXG59KSh3aW5kb3csIGRvY3VtZW50KTtcclxuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsQ0FBQyxVQUFVQSxDQUFDLEVBQUVDLENBQUMsRUFBRTtFQUNoQixZQUFZOztFQUVaLElBQUlDLElBQUksR0FBR0YsQ0FBQyxDQUFDRyxhQUFhLEtBQUtILENBQUMsQ0FBQ0csYUFBYSxHQUFHLENBQUMsQ0FBQyxDQUFDO0VBQ3BELElBQUlDLElBQUksR0FBR0YsSUFBSSxDQUFDRSxJQUFJLEtBQUtGLElBQUksQ0FBQ0UsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDO0VBRXhDLElBQUlDLEtBQUssR0FBR0wsQ0FBQyxDQUFDSyxLQUFLLElBQUksSUFBSTs7RUFFM0I7RUFDQTtFQUNBOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDRCxJQUFJLENBQUNFLGNBQWMsR0FBRyxVQUFVQyxDQUFDLEVBQUU7SUFDbEMsSUFBSSxPQUFPQSxDQUFDLEtBQUssU0FBUyxFQUFFLE9BQU9BLENBQUM7SUFDcEMsSUFBSSxPQUFPQSxDQUFDLEtBQUssUUFBUSxFQUFFLE9BQU9BLENBQUMsS0FBSyxDQUFDO0lBQ3pDLElBQUksT0FBT0EsQ0FBQyxLQUFLLFFBQVEsRUFBRTtN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
