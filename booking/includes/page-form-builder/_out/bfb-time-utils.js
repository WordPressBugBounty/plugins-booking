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
      document.querySelectorAll('.wpbc_times_selector').forEach(function (el) {
        if (el.parentNode) el.parentNode.removeChild(el);
      });
      document.querySelectorAll('.wpbc_bfb__preview-select.wpbc_bfb__preview-rangetime,' + 'select[name^="rangetime"], select[name^="starttime"], select[name^="endtime"], select[name^="durationtime"]').forEach(function (s) {
        s.style.removeProperty('display');
        s.hidden = false;
      });
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9iZmItdGltZS11dGlscy5qcyIsIm5hbWVzIjpbInciLCJkIiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJUaW1lIiwiSU1hc2siLCJjb2VyY2VfdG9fYm9vbCIsInYiLCJzIiwidHJpbSIsInRvTG93ZXJDYXNlIiwicGFyc2VfaGhtbV8yNGgiLCJoaG1tIiwiTmFOIiwibSIsIlN0cmluZyIsIm1hdGNoIiwiSCIsIk51bWJlciIsIk0iLCJwYXJzZV9hbXBtX3RleHQiLCJ0eHQiLCJoMTIiLCJtbSIsImFwIiwidG9VcHBlckNhc2UiLCJoMjQiLCJwYXJzZV9taW51dGVzIiwibTIiLCJpc05hTiIsImZvcm1hdF9taW51dGVzXzI0aCIsIm1pbnV0ZXMiLCJNYXRoIiwiZmxvb3IiLCJISCIsIk1NIiwiZm9ybWF0X21pbnV0ZXNfYW1wbSIsIkgyNCIsImlzX2FtIiwiZXNjX2F0dHIiLCJyZXBsYWNlIiwiYXBwbHlfaW1hc2tfdG9faW5wdXQiLCJlbCIsIl9pbWFzayIsImRlc3Ryb3kiLCJlIiwibWFzayIsImJsb2NrcyIsIk1hc2tlZFJhbmdlIiwiZnJvbSIsInRvIiwibWF4TGVuZ3RoIiwibGF6eSIsImNsZWFyX2ltYXNrIiwiY29udmVydF9pbnB1dF9ub2RlX3RvX2Zvcm1hdCIsIm5vZGUiLCJ0b19mbXQiLCJ2YWx1ZV9taW51dGVzIiwicGFyZW50IiwicGFyZW50Tm9kZSIsImNscyIsImNsYXNzTmFtZSIsImlzX3N0YXJ0IiwiY2xhc3NMaXN0IiwiY29udGFpbnMiLCJuZXdfZWwiLCJjcmVhdGVFbGVtZW50IiwidHlwZSIsImFkZCIsInNldEF0dHJpYnV0ZSIsInZhbHVlIiwic3RlcCIsInJlcGxhY2VDaGlsZCIsInJlYnVpbGRfcm93X2lucHV0c190b19mb3JtYXQiLCJyb3ciLCJzX2VsIiwicXVlcnlTZWxlY3RvciIsImVfZWwiLCJzX20iLCJlX20iLCJzX25ldyIsImVfbmV3IiwicmVidWlsZF9hbGxfcm93c190b19mb3JtYXQiLCJjb250YWluZXIiLCJxdWVyeVNlbGVjdG9yQWxsIiwiZm9yRWFjaCIsImFwcGx5X2ltYXNrX2luX2NvbnRhaW5lcl8yNGgiLCJidWlsZF90aW1lX3Nsb3RzIiwic3RhcnRfbWludXRlcyIsImVuZF9taW51dGVzIiwic3RlcF9taW51dGVzIiwibGFiZWxfZm10Iiwib3V0IiwidCIsInQyIiwidjEiLCJ2MiIsImwxIiwibDIiLCJwdXNoIiwibGFiZWwiLCJzZWxlY3RlZCIsInJlYWRfcGlja2VyX2VuYWJsZWQiLCJfd3BiYyIsImdldF9vdGhlcl9wYXJhbSIsInNldF9waWNrZXJfZW5hYmxlZCIsImVuYWJsZWQiLCJzZXRfb3RoZXJfcGFyYW0iLCJ1aV9zZXRfcGlja2VyX3RvZ2dsZV9mb3JfcGFuZWwiLCJwYW5lbCIsImNoayIsImNoZWNrZWQiLCJza2luX3JvdyIsImhpZGRlbiIsInN0eWxlIiwiZGlzcGxheSIsInBoUm93IiwidWlfYXBwbHlfcGlja2VyX2VuYWJsZWRfdG9fYWxsIiwiYXBwbHlfcGlja2VyX3NraW5fdXJsIiwic2tpbl91cmwiLCJzdHlsZXNoZWV0IiwiZ2V0RWxlbWVudEJ5SWQiLCJpZCIsInJlbCIsIm1lZGlhIiwiaGVhZCIsImdldEVsZW1lbnRzQnlUYWdOYW1lIiwiYXBwZW5kQ2hpbGQiLCJzY2hlZHVsZV9pbml0X3RpbWVzZWxlY3RvciIsImFwcGx5X3BpY2tlcl9za2luX2Zyb21fc2VsZWN0Iiwic2VsZWN0X2NvbnRyb2wiLCJzZWxlY3RlZF9vcHRpb24iLCJvcHRpb25zIiwic2VsZWN0ZWRJbmRleCIsImdldEF0dHJpYnV0ZSIsImNsb3Nlc3QiLCJwaWNrZXJfdG9nZ2xlIiwidWlfc2V0X3BpY2tlcl9za2luX3ZhbHVlIiwic2tpbl92YWx1ZSIsIm9uX3BpY2tlcl9za2luX3NhdmVkIiwiYWNjZW50X2J1dHRvbiIsIndwYmNfYmZiX3RpbWVfcGlja2VyX3NraW5fY29udHJvbF9zYXZlZCIsInNjaGVkdWxlZCIsInRpZCIsIkRFTEFZIiwiY2xlYXJUaW1lb3V0Iiwic2V0VGltZW91dCIsInJ1biIsIndwYmNfaG9va19faW5pdF90aW1lc2VsZWN0b3IiLCJfX3dwYmNfcnRfbW9fcGF1c2UiLCJfX3dwYmNfc3RfbW9fcGF1c2UiLCJfX3dwYmNfcnRfbW9fcmVzdW1lIiwiX193cGJjX3N0X21vX3Jlc3VtZSIsIm1pcnJvcl9zZXR0aW5nc190b2dnbGUiLCJ3cGJjX2JmYl9fZGlzcGF0Y2hfZXZlbnRfc2FmZSIsImtleSIsInNvdXJjZSIsInN5bmNfcHJldmlld19hZnRlcl9mbGFnIiwiZG9jdW1lbnQiLCJyZW1vdmVDaGlsZCIsInJlbW92ZVByb3BlcnR5Iiwid2luZG93IiwiV1BCQ19CRkJfU2V0dGluZ3MiLCJ3aGVuX2J1aWxkZXJfcmVhZHkiLCJiIiwicHJldmlld19tb2RlIiwicmVmcmVzaF9jYW52YXMiLCJoYXJkIiwicmVidWlsZCIsInJlaW5pdCIsInJlc3RvcmVfc2VsZWN0aW9uIiwicmVzdG9yZV9zY3JvbGwiLCJzaWxlbnRfaW5zcGVjdG9yIiwicmVuZGVyX3ByZXZpZXdfYWxsIiwic2V0X2dsb2JhbF90aW1lc2xvdF9waWNrZXIiLCJvcHRzIiwibWlycm9yX3NldHRpbmdzIiwicmVmcmVzaF9wcmV2aWV3IiwiZW5zdXJlX2dsb2JhbF90aW1lcGlja2VyX3RvZ2dsZV9iaW5kZXIiLCJfX3RvZ2dsZUJpbmRlckJvdW5kIiwiaW5pdF9hbGxfcGFuZWxzIiwicmVhZHlTdGF0ZSIsImFkZEV2ZW50TGlzdGVuZXIiLCJtbyIsIk11dGF0aW9uT2JzZXJ2ZXIiLCJtdXRzIiwiaSIsImxlbmd0aCIsImoiLCJhZGRlZE5vZGVzIiwibiIsIm5vZGVUeXBlIiwibWF0Y2hlcyIsIm9ic2VydmUiLCJib2R5IiwiY2hpbGRMaXN0Iiwic3VidHJlZSIsIl9fd3BiY190aW1lcGlja2VyX3RvZ2dsZV9tb19wYXVzZSIsImRpc2Nvbm5lY3QiLCJfX3dwYmNfdGltZXBpY2tlcl90b2dnbGVfbW9fcmVzdW1lIiwiZXYiLCJ0YXJnZXQiLCJqUXVlcnkiLCJvZmYiLCJvbiIsImVuc3VyZV9idWlsZGVyX2NhbnZhc19yZWZyZXNoX2hvb2tzIiwiX19idWlsZGVyX2NhbnZhc19yZWZyZXNoX2hvb2tzX2JvdW5kIiwid3BiY19iZmJfYXBpIiwicmVhZHkiLCJ0aGVuIiwiYnVpbGRlciIsImJ1cyIsIkVWUyIsIldQQkNfQkZCX0V2ZW50cyIsIkVWX0JFRk9SRSIsIkNBTlZBU19SRUZSRVNIIiwiRVZfQUZURVIiLCJDQU5WQVNfUkVGUkVTSEVEIl0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX3NyYy9iZmItdGltZS11dGlscy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogV1BCQyBCRkIgQ29yZTogVGltZSBVdGlsaXRpZXNcclxuICpcclxuICogT25lIHBsYWNlIGZvciBhbGwgdGltZSBwYXJzaW5nL2Zvcm1hdHRpbmcvbWFza2luZyBoZWxwZXJzICsgc21hbGwgVUkgaGVscGVycyB1c2VkIGJ5IHRpbWUtYmFzZWQgcGFja3MuXHJcbiAqXHJcbiAqIC0gUHVyZSBoZWxwZXJzIChwYXJzZS9mb3JtYXQgbWludXRlcywgQU0vUE0gY29udmVyc2lvbilcclxuICogLSBpTWFzayBpbnRlZ3JhdGlvbiBmb3IgXCJISDpNTVwiIGlucHV0c1xyXG4gKiAtIElucHV0LW5vZGUgY29udmVyc2lvbiAodHlwZT10aW1lIDwtPiBtYXNrZWQgdGV4dClcclxuICogLSBTbWFsbCBVSSBoZWxwZXJzIGZvciBnbG9iYWwgXCJ0aW1lLXNsb3QgcGlja2VyXCIgdG9nZ2xlIChwbGFjZWhvbGRlciByb3csIGNoZWNrYm94IHN5bmMpXHJcbiAqIC0gRGVib3VuY2VkIGluaXQgZm9yIGV4dGVybmFsIFwidGltZSBzZWxlY3RvclwiICh3cGJjX2hvb2tfX2luaXRfdGltZXNlbGVjdG9yKVxyXG4gKlxyXG4gKiBAcGFja2FnZSAgIEJvb2tpbmcgQ2FsZW5kYXJcclxuICogQGF1dGhvciAgICB3cGRldmVsb3BcclxuICogQHNpbmNlICAgICAxMS4wLjBcclxuICogQHZlcnNpb24gICAxLjAuMFxyXG4gKiBAbW9kaWZpZWQ6IDIwMjUtMTAtMzEgMTI6MzJcclxuICpcclxuICogLi4vaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9iZmItdGltZS11dGlscy5qc1xyXG4gKi9cclxuXHJcbi8qIGdsb2JhbCB3aW5kb3csIGRvY3VtZW50ICovXHJcbihmdW5jdGlvbiAodywgZCkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0dmFyIENvcmUgPSB3LldQQkNfQkZCX0NvcmUgfHwgKHcuV1BCQ19CRkJfQ29yZSA9IHt9KTtcclxuXHR2YXIgVGltZSA9IENvcmUuVGltZSB8fCAoQ29yZS5UaW1lID0ge30pO1xyXG5cclxuXHR2YXIgSU1hc2sgPSB3LklNYXNrIHx8IG51bGw7XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gQmFzaWMgaGVscGVyc1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdC8qKlxyXG5cdCAqIENvZXJjZSBtaXhlZCB2YWx1ZXMgdG8gYm9vbGVhbi5cclxuXHQgKiBBY2NlcHRzIGJvb2xlYW5zLCBudW1iZXJzLCBhbmQgY29tbW9uIHN0cmluZ3M6IFwib25cIi9cIm9mZlwiLCBcInRydWVcIi9cImZhbHNlXCIsIFwiMVwiL1wiMFwiLCBcInllc1wiL1wibm9cIi5cclxuXHQgKiBAcGFyYW0geyp9IHZcclxuXHQgKiBAcmV0dXJuIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdFRpbWUuY29lcmNlX3RvX2Jvb2wgPSBmdW5jdGlvbiAodikge1xyXG5cdFx0aWYgKHR5cGVvZiB2ID09PSAnYm9vbGVhbicpIHJldHVybiB2O1xyXG5cdFx0aWYgKHR5cGVvZiB2ID09PSAnbnVtYmVyJykgcmV0dXJuIHYgIT09IDA7XHJcblx0XHRpZiAodHlwZW9mIHYgPT09ICdzdHJpbmcnKSB7XHJcblx0XHRcdHZhciBzID0gdi50cmltKCkudG9Mb3dlckNhc2UoKTtcclxuXHRcdFx0aWYgKHMgPT09ICdvbicgfHwgcyA9PT0gJ3RydWUnIHx8IHMgPT09ICcxJyB8fCBzID09PSAneWVzJykgcmV0dXJuIHRydWU7XHJcblx0XHRcdGlmIChzID09PSAnb2ZmJyB8fCBzID09PSAnZmFsc2UnIHx8IHMgPT09ICcwJyB8fCBzID09PSAnbm8nIHx8IHMgPT09ICcnKSByZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gISF2O1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFBhcnNlIFwiSEg6TU1cIiAyNGggLT4gbWludXRlcyBzaW5jZSAwMDowMC4gUmV0dXJucyBOYU4gb24gaW52YWxpZC5cclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gaGhtbVxyXG5cdCAqIEByZXR1cm4ge251bWJlcn1cclxuXHQgKi9cclxuXHRUaW1lLnBhcnNlX2hobW1fMjRoID0gZnVuY3Rpb24gKGhobW0pIHtcclxuXHRcdGlmICghaGhtbSkgcmV0dXJuIE5hTjtcclxuXHRcdHZhciBtID0gU3RyaW5nKGhobW0pLnRyaW0oKS5tYXRjaCgvXihcXGR7MSwyfSlcXHMqOlxccyooXFxkezJ9KSQvKTtcclxuXHRcdGlmICghbSkgcmV0dXJuIE5hTjtcclxuXHRcdHZhciBIID0gTnVtYmVyKG1bMV0pLCBNID0gTnVtYmVyKG1bMl0pO1xyXG5cdFx0aWYgKEggPCAwIHx8IEggPiAyMyB8fCBNIDwgMCB8fCBNID4gNTkpIHJldHVybiBOYU47XHJcblx0XHRyZXR1cm4gSCAqIDYwICsgTTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBQYXJzZSBcImg6TU0gQU0vUE1cIiAtPiBtaW51dGVzIHNpbmNlIDAwOjAwLiBSZXR1cm5zIE5hTiBvbiBpbnZhbGlkLlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0eHRcclxuXHQgKiBAcmV0dXJuIHtudW1iZXJ9XHJcblx0ICovXHJcblx0VGltZS5wYXJzZV9hbXBtX3RleHQgPSBmdW5jdGlvbiAodHh0KSB7XHJcblx0XHRpZiAoIXR4dCkgcmV0dXJuIE5hTjtcclxuXHRcdHZhciBtID0gU3RyaW5nKHR4dCkudHJpbSgpLm1hdGNoKC9eKFxcZHsxLDJ9KVxccyo6XFxzKihcXGR7Mn0pXFxzKihbQWFQcF1bTW1dKSQvKTtcclxuXHRcdGlmICghbSkgcmV0dXJuIE5hTjtcclxuXHRcdHZhciBoMTIgPSBOdW1iZXIobVsxXSksIG1tID0gTnVtYmVyKG1bMl0pLCBhcCA9IFN0cmluZyhtWzNdKS50b1VwcGVyQ2FzZSgpO1xyXG5cdFx0aWYgKGgxMiA8IDEgfHwgaDEyID4gMTIgfHwgbW0gPCAwIHx8IG1tID4gNTkpIHJldHVybiBOYU47XHJcblx0XHR2YXIgaDI0ID0gKGgxMiAlIDEyKSArIChhcCA9PT0gJ1BNJyA/IDEyIDogMCk7XHJcblx0XHRyZXR1cm4gaDI0ICogNjAgKyBtbTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBUcnkgMjRoIFwiSEg6TU1cIiBmaXJzdCwgZmFsbCBiYWNrIHRvIEFNL1BNIHRleHQuXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHZcclxuXHQgKiBAcmV0dXJuIHtudW1iZXJ9XHJcblx0ICovXHJcblx0VGltZS5wYXJzZV9taW51dGVzID0gZnVuY3Rpb24gKHYpIHtcclxuXHRcdHZhciBzID0gU3RyaW5nKHYgfHwgJycpLnRyaW0oKTtcclxuXHRcdHZhciBtMiA9IFRpbWUucGFyc2VfaGhtbV8yNGgocyk7XHJcblx0XHRyZXR1cm4gaXNOYU4obTIpID8gVGltZS5wYXJzZV9hbXBtX3RleHQocykgOiBtMjtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBGb3JtYXQgbWludXRlcyAtPiBcIkhIOk1NXCIgMjRoLlxyXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBtaW51dGVzXHJcblx0ICogQHJldHVybiB7c3RyaW5nfVxyXG5cdCAqL1xyXG5cdFRpbWUuZm9ybWF0X21pbnV0ZXNfMjRoID0gZnVuY3Rpb24gKG1pbnV0ZXMpIHtcclxuXHRcdHZhciBIID0gTWF0aC5mbG9vcihtaW51dGVzIC8gNjApICUgMjQ7XHJcblx0XHR2YXIgTSA9IG1pbnV0ZXMgJSA2MDtcclxuXHRcdHZhciBISCA9IChIIDwgMTAgPyAnMCcgKyBIIDogJycgKyBIKTtcclxuXHRcdHZhciBNTSA9IChNIDwgMTAgPyAnMCcgKyBNIDogJycgKyBNKTtcclxuXHRcdHJldHVybiBISCArICc6JyArIE1NO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEZvcm1hdCBtaW51dGVzIC0+IFwiaDpNTSBBTS9QTVwiLlxyXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBtaW51dGVzXHJcblx0ICogQHJldHVybiB7c3RyaW5nfVxyXG5cdCAqL1xyXG5cdFRpbWUuZm9ybWF0X21pbnV0ZXNfYW1wbSA9IGZ1bmN0aW9uIChtaW51dGVzKSB7XHJcblx0XHR2YXIgSDI0ID0gTWF0aC5mbG9vcihtaW51dGVzIC8gNjApICUgMjQ7XHJcblx0XHR2YXIgTSAgID0gbWludXRlcyAlIDYwO1xyXG5cdFx0dmFyIGlzX2FtID0gKEgyNCA8IDEyKTtcclxuXHRcdHZhciBoMTIgPSBIMjQgJSAxMjtcclxuXHRcdGlmIChoMTIgPT09IDApIGgxMiA9IDEyO1xyXG5cdFx0dmFyIE1NID0gKE0gPCAxMCA/ICcwJyArIE0gOiAnJyArIE0pO1xyXG5cdFx0cmV0dXJuIGgxMiArICc6JyArIE1NICsgJyAnICsgKGlzX2FtID8gJ0FNJyA6ICdQTScpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEVzY2FwZSBhdHRyaWJ1dGUgdGV4dC5cclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdlxyXG5cdCAqIEByZXR1cm4ge3N0cmluZ31cclxuXHQgKi9cclxuXHRUaW1lLmVzY19hdHRyID0gZnVuY3Rpb24gKHYpIHtcclxuXHRcdHJldHVybiBTdHJpbmcodikucmVwbGFjZSgvJi9nLCAnJmFtcDsnKS5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7JykucmVwbGFjZSgvPC9nLCAnJmx0OycpO1xyXG5cdH07XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gaU1hc2sgaGVscGVycyAodXNlZCBieSAyNGggdGV4dCBpbnB1dHMpXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0LyoqXHJcblx0ICogQXBwbHkgaU1hc2sgXCJISDpNTVwiIHRvIGlucHV0LlxyXG5cdCAqIEBwYXJhbSB7SFRNTElucHV0RWxlbWVudH0gZWxcclxuXHQgKi9cclxuXHRUaW1lLmFwcGx5X2ltYXNrX3RvX2lucHV0ID0gZnVuY3Rpb24gKGVsKSB7XHJcblx0XHRpZiAoIUlNYXNrIHx8ICFlbCkgcmV0dXJuO1xyXG5cdFx0aWYgKGVsLl9pbWFzaykge1xyXG5cdFx0XHR0cnkgeyBlbC5faW1hc2suZGVzdHJveSgpOyB9IGNhdGNoIChlKSB7fVxyXG5cdFx0XHRlbC5faW1hc2sgPSBudWxsO1xyXG5cdFx0fVxyXG5cdFx0ZWwuX2ltYXNrID0gSU1hc2soZWwsIHtcclxuXHRcdFx0bWFzazogJ0hIOk1NJyxcclxuXHRcdFx0YmxvY2tzOiB7XHJcblx0XHRcdFx0SEg6IHsgbWFzazogSU1hc2suTWFza2VkUmFuZ2UsIGZyb206IDAsIHRvOiAyMywgbWF4TGVuZ3RoOiAyIH0sXHJcblx0XHRcdFx0TU06IHsgbWFzazogSU1hc2suTWFza2VkUmFuZ2UsIGZyb206IDAsIHRvOiA1OSwgbWF4TGVuZ3RoOiAyIH1cclxuXHRcdFx0fSxcclxuXHRcdFx0bGF6eTogZmFsc2VcclxuXHRcdH0pO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIERlc3Ryb3kgaU1hc2sgaW5zdGFuY2UgaWYgcHJlc2VudC5cclxuXHQgKiBAcGFyYW0ge0hUTUxJbnB1dEVsZW1lbnR9IGVsXHJcblx0ICovXHJcblx0VGltZS5jbGVhcl9pbWFzayA9IGZ1bmN0aW9uIChlbCkge1xyXG5cdFx0aWYgKGVsICYmIGVsLl9pbWFzaykge1xyXG5cdFx0XHR0cnkgeyBlbC5faW1hc2suZGVzdHJveSgpOyB9IGNhdGNoIChlKSB7fVxyXG5cdFx0XHRlbC5faW1hc2sgPSBudWxsO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gTm9kZSBjb252ZXJzaW9uOiB0eXBlPXRpbWUgPC0+IG1hc2tlZCB0ZXh0XHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0LyoqXHJcblx0ICogQ29udmVydCBhIHNpbmdsZSBzdGFydC9lbmQgaW5wdXQgbm9kZSB0byAnMjRoJyAobWFza2VkIHRleHQpIG9yICdhbXBtJyAodHlwZT1cInRpbWVcIikuXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbm9kZVxyXG5cdCAqIEBwYXJhbSB7JzI0aCd8J2FtcG0nfSB0b19mbXRcclxuXHQgKiBAcGFyYW0ge251bWJlcn0gdmFsdWVfbWludXRlc1xyXG5cdCAqIEByZXR1cm4ge0hUTUxJbnB1dEVsZW1lbnR9XHJcblx0ICovXHJcblx0VGltZS5jb252ZXJ0X2lucHV0X25vZGVfdG9fZm9ybWF0ID0gZnVuY3Rpb24gKG5vZGUsIHRvX2ZtdCwgdmFsdWVfbWludXRlcykge1xyXG5cdFx0dmFyIHBhcmVudCA9IG5vZGUucGFyZW50Tm9kZTtcclxuXHRcdHZhciBjbHMgICAgPSBub2RlLmNsYXNzTmFtZTtcclxuXHRcdHZhciBpc19zdGFydCA9IG5vZGUuY2xhc3NMaXN0LmNvbnRhaW5zKCd3cGJjX2JmYl9fb3B0LXN0YXJ0Jyk7XHJcblxyXG5cdFx0dmFyIG5ld19lbDtcclxuXHRcdGlmICh0b19mbXQgPT09ICcyNGgnKSB7XHJcblx0XHRcdG5ld19lbCAgICAgICAgICAgPSBkLmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XHJcblx0XHRcdG5ld19lbC50eXBlICAgICAgPSAndGV4dCc7XHJcblx0XHRcdG5ld19lbC5jbGFzc05hbWUgPSBjbHMucmVwbGFjZSgvXFxianMtcnQtc3RhcnQtdGltZVxcYnxcXGJqcy1ydC1lbmQtdGltZVxcYi9nLCAnJykudHJpbSgpO1xyXG5cdFx0XHRuZXdfZWwuY2xhc3NMaXN0LmFkZCgnanMtcnQtbWFzaycpO1xyXG5cdFx0XHRuZXdfZWwuc2V0QXR0cmlidXRlKCdkYXRhLW1hc2sta2luZCcsICcyNGgnKTtcclxuXHRcdFx0bmV3X2VsLnNldEF0dHJpYnV0ZSgncGxhY2Vob2xkZXInLCAnSEg6TU0nKTtcclxuXHRcdFx0bmV3X2VsLnZhbHVlID0gaXNOYU4odmFsdWVfbWludXRlcykgPyAnJyA6IFRpbWUuZm9ybWF0X21pbnV0ZXNfMjRoKHZhbHVlX21pbnV0ZXMpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0bmV3X2VsICAgICAgICAgICA9IGQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcclxuXHRcdFx0bmV3X2VsLnR5cGUgICAgICA9ICd0aW1lJztcclxuXHRcdFx0bmV3X2VsLnN0ZXAgICAgICA9ICczMDAnO1xyXG5cdFx0XHRuZXdfZWwuY2xhc3NOYW1lID0gY2xzLnJlcGxhY2UoL1xcYmpzLXJ0LW1hc2tcXGIvZywgJycpLnRyaW0oKTtcclxuXHRcdFx0bmV3X2VsLmNsYXNzTGlzdC5hZGQoaXNfc3RhcnQgPyAnanMtcnQtc3RhcnQtdGltZScgOiAnanMtcnQtZW5kLXRpbWUnKTtcclxuXHRcdFx0Ly8gPGlucHV0IHR5cGU9XCJ0aW1lXCI+IGV4cGVjdHMgXCJISDpNTVwiIDI0aCBzdHJpbmdcclxuXHRcdFx0bmV3X2VsLnZhbHVlID0gaXNOYU4odmFsdWVfbWludXRlcykgPyAnJyA6IFRpbWUuZm9ybWF0X21pbnV0ZXNfMjRoKHZhbHVlX21pbnV0ZXMpO1xyXG5cdFx0fVxyXG5cclxuXHRcdFRpbWUuY2xlYXJfaW1hc2sobm9kZSk7XHJcblx0XHRwYXJlbnQucmVwbGFjZUNoaWxkKG5ld19lbCwgbm9kZSk7XHJcblx0XHRyZXR1cm4gbmV3X2VsO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlYnVpbGQgYm90aCBzdGFydC9lbmQgaW5wdXRzIGluc2lkZSBhIHJvdyB0byB0YXJnZXQgZm9ybWF0LlxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvd1xyXG5cdCAqIEBwYXJhbSB7JzI0aCd8J2FtcG0nfSB0b19mbXRcclxuXHQgKi9cclxuXHRUaW1lLnJlYnVpbGRfcm93X2lucHV0c190b19mb3JtYXQgPSBmdW5jdGlvbiAocm93LCB0b19mbXQpIHtcclxuXHRcdHZhciBzX2VsID0gcm93LnF1ZXJ5U2VsZWN0b3IoJy53cGJjX2JmYl9fb3B0LXN0YXJ0Jyk7XHJcblx0XHR2YXIgZV9lbCA9IHJvdy5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX29wdC1lbmQnKTtcclxuXHRcdGlmICghc19lbCB8fCAhZV9lbCkgcmV0dXJuO1xyXG5cclxuXHRcdHZhciBzX20gPSBUaW1lLnBhcnNlX21pbnV0ZXMoc19lbC52YWx1ZSk7XHJcblx0XHR2YXIgZV9tID0gVGltZS5wYXJzZV9taW51dGVzKGVfZWwudmFsdWUpO1xyXG5cclxuXHRcdHZhciBzX25ldyA9IFRpbWUuY29udmVydF9pbnB1dF9ub2RlX3RvX2Zvcm1hdChzX2VsLCB0b19mbXQsIHNfbSk7XHJcblx0XHR2YXIgZV9uZXcgPSBUaW1lLmNvbnZlcnRfaW5wdXRfbm9kZV90b19mb3JtYXQoZV9lbCwgdG9fZm10LCBlX20pO1xyXG5cclxuXHRcdGlmICh0b19mbXQgPT09ICcyNGgnKSB7XHJcblx0XHRcdFRpbWUuYXBwbHlfaW1hc2tfdG9faW5wdXQoc19uZXcpO1xyXG5cdFx0XHRUaW1lLmFwcGx5X2ltYXNrX3RvX2lucHV0KGVfbmV3KTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdFRpbWUuY2xlYXJfaW1hc2soc19uZXcpO1xyXG5cdFx0XHRUaW1lLmNsZWFyX2ltYXNrKGVfbmV3KTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBSZWJ1aWxkIGFsbCByb3dzIHVuZGVyIGNvbnRhaW5lciB0byB0YXJnZXQgZm9ybWF0LlxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGNvbnRhaW5lclxyXG5cdCAqIEBwYXJhbSB7JzI0aCd8J2FtcG0nfSB0b19mbXRcclxuXHQgKi9cclxuXHRUaW1lLnJlYnVpbGRfYWxsX3Jvd3NfdG9fZm9ybWF0ID0gZnVuY3Rpb24gKGNvbnRhaW5lciwgdG9fZm10KSB7XHJcblx0XHRpZiAoIWNvbnRhaW5lcikgcmV0dXJuO1xyXG5cdFx0Y29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoJy53cGJjX2JmYl9fb3B0aW9uc19yb3cnKS5mb3JFYWNoKGZ1bmN0aW9uIChyb3cpIHtcclxuXHRcdFx0VGltZS5yZWJ1aWxkX3Jvd19pbnB1dHNfdG9fZm9ybWF0KHJvdywgdG9fZm10KTtcclxuXHRcdH0pO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFwcGx5IGlNYXNrIHRvIGFsbCAyNGgtbWFza2VkIGlucHV0cyB3aXRoaW4gY29udGFpbmVyLlxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGNvbnRhaW5lclxyXG5cdCAqL1xyXG5cdFRpbWUuYXBwbHlfaW1hc2tfaW5fY29udGFpbmVyXzI0aCA9IGZ1bmN0aW9uIChjb250YWluZXIpIHtcclxuXHRcdGlmICggIUlNYXNrIHx8ICFjb250YWluZXIgKSByZXR1cm47XHJcblx0XHRjb250YWluZXIucXVlcnlTZWxlY3RvckFsbCggJ2lucHV0W2RhdGEtbWFzay1raW5kPVwiMjRoXCJdJyApLmZvckVhY2goIGZ1bmN0aW9uIChlbCkge1xyXG5cdFx0XHRUaW1lLmFwcGx5X2ltYXNrX3RvX2lucHV0KCBlbCApO1xyXG5cdFx0fSApO1xyXG5cdH07XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gU2xvdCBnZW5lcmF0aW9uXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0LyoqXHJcblx0ICogQnVpbGQgc2xvdHM6IFt7bGFiZWwsIHZhbHVlLCBzZWxlY3RlZDpmYWxzZX0sIC4uLl1cclxuXHQgKiBOb3RlOiBnZW5lcmF0aW9uIGV4cGVjdHMgZW5kID4gc3RhcnQuIChPdmVybmlnaHQgcmFuZ2VzIGFyZSBlbnRlcmVkIG1hbnVhbGx5IHZpYSBlZGl0b3IuKVxyXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBzdGFydF9taW51dGVzXHJcblx0ICogQHBhcmFtIHtudW1iZXJ9IGVuZF9taW51dGVzXHJcblx0ICogQHBhcmFtIHtudW1iZXJ9IHN0ZXBfbWludXRlc1xyXG5cdCAqIEBwYXJhbSB7JzI0aCd8J2FtcG0nfSBsYWJlbF9mbXRcclxuXHQgKiBAcmV0dXJuIHtBcnJheTx7bGFiZWw6c3RyaW5nLHZhbHVlOnN0cmluZyxzZWxlY3RlZDpib29sZWFufT59XHJcblx0ICovXHJcblx0VGltZS5idWlsZF90aW1lX3Nsb3RzID0gZnVuY3Rpb24gKHN0YXJ0X21pbnV0ZXMsIGVuZF9taW51dGVzLCBzdGVwX21pbnV0ZXMsIGxhYmVsX2ZtdCkge1xyXG5cdFx0aWYgKGlzTmFOKHN0YXJ0X21pbnV0ZXMpIHx8IGlzTmFOKGVuZF9taW51dGVzKSB8fCBpc05hTihzdGVwX21pbnV0ZXMpKSByZXR1cm4gW107XHJcblx0XHRpZiAoZW5kX21pbnV0ZXMgPD0gc3RhcnRfbWludXRlcyB8fCBzdGVwX21pbnV0ZXMgPD0gMCkgcmV0dXJuIFtdO1xyXG5cdFx0dmFyIG91dCA9IFtdO1xyXG5cdFx0Zm9yICh2YXIgdCA9IHN0YXJ0X21pbnV0ZXM7ICh0ICsgc3RlcF9taW51dGVzKSA8PSBlbmRfbWludXRlczsgdCArPSBzdGVwX21pbnV0ZXMpIHtcclxuXHRcdFx0dmFyIHQyICA9IHQgKyBzdGVwX21pbnV0ZXM7XHJcblx0XHRcdHZhciB2MSAgPSBUaW1lLmZvcm1hdF9taW51dGVzXzI0aCh0KTtcclxuXHRcdFx0dmFyIHYyICA9IFRpbWUuZm9ybWF0X21pbnV0ZXNfMjRoKHQyKTtcclxuXHRcdFx0dmFyIGwxICA9IChsYWJlbF9mbXQgPT09ICcyNGgnKSA/IHYxIDogVGltZS5mb3JtYXRfbWludXRlc19hbXBtKHQpO1xyXG5cdFx0XHR2YXIgbDIgID0gKGxhYmVsX2ZtdCA9PT0gJzI0aCcpID8gdjIgOiBUaW1lLmZvcm1hdF9taW51dGVzX2FtcG0odDIpO1xyXG5cdFx0XHRvdXQucHVzaCh7IGxhYmVsOiBsMSArICcgLSAnICsgbDIsIHZhbHVlOiB2MSArICcgLSAnICsgdjIsIHNlbGVjdGVkOiBmYWxzZSB9KTtcclxuXHRcdH1cclxuXHRcdHJldHVybiBvdXQ7XHJcblx0fTtcclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBHbG9iYWwgXCJ0aW1lLXNsb3QgcGlja2VyXCIgZmxhZyBoZWxwZXJzXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0LyoqXHJcblx0ICogUmVhZCBnbG9iYWwgdGltZS1zbG90IHBpY2tlciBmbGFnIChzYXZlZCB2aWEgX3dwYmMgb3RoZXIgcGFyYW1zKS5cclxuXHQgKiBAcmV0dXJuIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdFRpbWUucmVhZF9waWNrZXJfZW5hYmxlZCA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdHRyeSB7XHJcblx0XHRcdGlmICghKHcuX3dwYmMgJiYgdHlwZW9mIHcuX3dwYmMuZ2V0X290aGVyX3BhcmFtID09PSAnZnVuY3Rpb24nKSkgcmV0dXJuIGZhbHNlO1xyXG5cdFx0XHRyZXR1cm4gVGltZS5jb2VyY2VfdG9fYm9vbCh3Ll93cGJjLmdldF9vdGhlcl9wYXJhbSgnaXNfZW5hYmxlZF9ib29raW5nX3RpbWVzbG90X3BpY2tlcicpKTtcclxuXHRcdH0gY2F0Y2ggKGUpIHsgcmV0dXJuIGZhbHNlOyB9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogUGVyc2lzdCBnbG9iYWwgdGltZS1zbG90IHBpY2tlciBmbGFnLlxyXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gZW5hYmxlZFxyXG5cdCAqL1xyXG5cdFRpbWUuc2V0X3BpY2tlcl9lbmFibGVkID0gZnVuY3Rpb24gKGVuYWJsZWQpIHtcclxuXHRcdHRyeSB7XHJcblx0XHRcdGlmICh3Ll93cGJjICYmIHR5cGVvZiB3Ll93cGJjLnNldF9vdGhlcl9wYXJhbSA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0XHRcdHcuX3dwYmMuc2V0X290aGVyX3BhcmFtKCdpc19lbmFibGVkX2Jvb2tpbmdfdGltZXNsb3RfcGlja2VyJywgISFlbmFibGVkKTtcclxuXHRcdFx0fVxyXG5cdFx0fSBjYXRjaCAoZSkge31cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTZXQgdG9nZ2xlICsgaGlkZS9zaG93IHBsYWNlaG9sZGVyIHJvdyB3aXRoaW4gYSBzaW5nbGUgSW5zcGVjdG9yIHBhbmVsLlxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHBhbmVsXHJcblx0ICogQHBhcmFtIHtib29sZWFufSBlbmFibGVkXHJcblx0ICovXHJcblx0VGltZS51aV9zZXRfcGlja2VyX3RvZ2dsZV9mb3JfcGFuZWwgPSBmdW5jdGlvbiAocGFuZWwsIGVuYWJsZWQpIHtcblx0XHRpZiAoIXBhbmVsKSByZXR1cm47XG5cdFx0dmFyIGNoayA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy5qcy10b2dnbGUtdGltZXNsb3QtcGlja2VyJyk7XG5cdFx0aWYgKGNoaykgY2hrLmNoZWNrZWQgPSAhIWVuYWJsZWQ7XG5cblx0XHR2YXIgc2tpbl9yb3cgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcuanMtdGltZS1waWNrZXItc2tpbi1yb3cnKTtcblx0XHRpZiAoc2tpbl9yb3cpIHtcblx0XHRcdHNraW5fcm93LmhpZGRlbiA9ICFlbmFibGVkO1xuXHRcdFx0c2tpbl9yb3cuc3R5bGUuZGlzcGxheSA9IGVuYWJsZWQgPyAnJyA6ICdub25lJztcblx0XHRcdHNraW5fcm93LnNldEF0dHJpYnV0ZSggJ2FyaWEtaGlkZGVuJywgZW5hYmxlZCA/ICdmYWxzZScgOiAndHJ1ZScgKTtcblx0XHR9XG5cblx0XHR2YXIgcGhSb3cgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcuanMtcGxhY2Vob2xkZXItcm93Jyk7XG5cdFx0aWYgKHBoUm93KSB7XHJcblx0XHRcdGlmIChlbmFibGVkKSB7IHBoUm93LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IHBoUm93LmhpZGRlbiA9IHRydWU7IH1cclxuXHRcdFx0ZWxzZSB7IHBoUm93LnN0eWxlLmRpc3BsYXkgPSAnJzsgcGhSb3cuaGlkZGVuID0gZmFsc2U7IH1cclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBBcHBseSBwaWNrZXIgZmxhZyB0byBhbGwgb3BlbiBUaW1lIGluc3BlY3RvcnMuXHJcblx0ICogQHBhcmFtIHtib29sZWFufSBlbmFibGVkXHJcblx0ICovXHJcblx0VGltZS51aV9hcHBseV9waWNrZXJfZW5hYmxlZF90b19hbGwgPSBmdW5jdGlvbiAoZW5hYmxlZCkge1xuXHRcdGQucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9faW5zcGVjdG9yX3RpbWVwaWNrZXInICkuZm9yRWFjaCggZnVuY3Rpb24gKHBhbmVsKSB7XHJcblx0XHRcdC8vIFNldCB0b2dnbGUgKyBoaWRlL3Nob3cgcGxhY2Vob2xkZXIgcm93IHdpdGhpbiBhIHNpbmdsZSBJbnNwZWN0b3IgcGFuZWwuXHJcblx0XHRcdFRpbWUudWlfc2V0X3BpY2tlcl90b2dnbGVfZm9yX3BhbmVsKCBwYW5lbCwgZW5hYmxlZCApO1xyXG5cdFx0fSApO1xyXG5cdH07XG5cblx0LyoqXG5cdCAqIEFwcGx5IGEgdGltZS1waWNrZXIgc2tpbiBVUkwgZGlyZWN0bHkgdG8gdGhlIEJ1aWxkZXIgZG9jdW1lbnQuXG5cdCAqXG5cdCAqIFVwZGF0aW5nIHRoZSBleGlzdGluZyBsaW5rIGF2b2lkcyBhIG5vLXN0eWxlcyBpbnRlcnZhbC4gSWYgYW5vdGhlclxuXHQgKiBpbnRlZ3JhdGlvbiBvbWl0dGVkIHRoZSBsaW5rLCBjcmVhdGUgaXQgc28gSW5zcGVjdG9yIGNoYW5nZXMgc3RpbGxcblx0ICogcHJvZHVjZSBhbiBpbW1lZGlhdGUgQ2FudmFzIHByZXZpZXcuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBza2luX3VybCBQdWJsaWMgdGltZS1waWNrZXIgc2tpbiBVUkwuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFdoZXRoZXIgYSBzdHlsZXNoZWV0IFVSTCB3YXMgYXBwbGllZC5cblx0ICovXG5cdFRpbWUuYXBwbHlfcGlja2VyX3NraW5fdXJsID0gZnVuY3Rpb24gKHNraW5fdXJsKSB7XG5cdFx0aWYgKCAhIHNraW5fdXJsICkgcmV0dXJuIGZhbHNlO1xuXG5cdFx0dmFyIHN0eWxlc2hlZXQgPSBkLmdldEVsZW1lbnRCeUlkKCAnd3BiYy10aW1lX3BpY2tlci1za2luLWNzcycgKTtcblx0XHRpZiAoICEgc3R5bGVzaGVldCApIHtcblx0XHRcdHN0eWxlc2hlZXQgPSBkLmNyZWF0ZUVsZW1lbnQoICdsaW5rJyApO1xuXHRcdFx0c3R5bGVzaGVldC5pZCA9ICd3cGJjLXRpbWVfcGlja2VyLXNraW4tY3NzJztcblx0XHRcdHN0eWxlc2hlZXQucmVsID0gJ3N0eWxlc2hlZXQnO1xuXHRcdFx0c3R5bGVzaGVldC50eXBlID0gJ3RleHQvY3NzJztcblx0XHRcdHN0eWxlc2hlZXQubWVkaWEgPSAnc2NyZWVuJztcblx0XHRcdCggZC5oZWFkIHx8IGQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoICdoZWFkJyApWzBdICkuYXBwZW5kQ2hpbGQoIHN0eWxlc2hlZXQgKTtcblx0XHR9XG5cblx0XHRzdHlsZXNoZWV0LnNldEF0dHJpYnV0ZSggJ2hyZWYnLCBTdHJpbmcoIHNraW5fdXJsICkgKTtcblx0XHRpZiAoIFRpbWUucmVhZF9waWNrZXJfZW5hYmxlZCgpICkge1xuXHRcdFx0VGltZS5zZXRfcGlja2VyX2VuYWJsZWQoIHRydWUgKTtcblx0XHRcdFRpbWUuc2NoZWR1bGVfaW5pdF90aW1lc2VsZWN0b3IoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fTtcblxuXHQvKipcblx0ICogQXBwbHkgYSBzZWxlY3RlZCB0aW1lLXBpY2tlciBza2luIHRvIHRoZSBCdWlsZGVyIHByZXZpZXcgc3R5bGVzaGVldC5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MU2VsZWN0RWxlbWVudH0gc2VsZWN0X2NvbnRyb2wgU2tpbiBzZWxlY3Rib3guXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRUaW1lLmFwcGx5X3BpY2tlcl9za2luX2Zyb21fc2VsZWN0ID0gZnVuY3Rpb24gKHNlbGVjdF9jb250cm9sKSB7XG5cdFx0aWYgKCAhIHNlbGVjdF9jb250cm9sICkgcmV0dXJuO1xuXHRcdHZhciBzZWxlY3RlZF9vcHRpb24gPSBzZWxlY3RfY29udHJvbC5vcHRpb25zICYmIHNlbGVjdF9jb250cm9sLnNlbGVjdGVkSW5kZXggPj0gMFxuXHRcdFx0PyBzZWxlY3RfY29udHJvbC5vcHRpb25zWyBzZWxlY3RfY29udHJvbC5zZWxlY3RlZEluZGV4IF1cblx0XHRcdDogbnVsbDtcblx0XHR2YXIgc2tpbl91cmwgPSBzZWxlY3RlZF9vcHRpb24gPyBTdHJpbmcoIHNlbGVjdGVkX29wdGlvbi5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZS1waWNrZXItc2tpbi11cmwnICkgfHwgJycgKSA6ICcnO1xuXG5cdFx0VGltZS5hcHBseV9waWNrZXJfc2tpbl91cmwoIHNraW5fdXJsICk7XG5cblx0XHQvLyBUaGUgc3R5bGUgcm93IGlzIGF2YWlsYWJsZSBvbmx5IHdoaWxlIHRoZSBnbG9iYWwgcGlja2VyIGlzIGVuYWJsZWQuXG5cdFx0Ly8gUmVjb25jaWxlIHRoZSBydW50aW1lIGZsYWcgYXMgd2VsbCwgc28gYW4gb2xkZXIgQnVpbGRlciBzZXNzaW9uIGNhblxuXHRcdC8vIGltbWVkaWF0ZWx5IGNvbnN0cnVjdCBpdHMgQ2FudmFzIGNob2ljZXMgd2l0aG91dCBhIHBhZ2UgcmVsb2FkLlxuXHRcdHZhciBwYW5lbCA9IHNlbGVjdF9jb250cm9sLmNsb3Nlc3QgPyBzZWxlY3RfY29udHJvbC5jbG9zZXN0KCAnLndwYmNfYmZiX19pbnNwZWN0b3JfdGltZXBpY2tlcicgKSA6IG51bGw7XG5cdFx0dmFyIHBpY2tlcl90b2dnbGUgPSBwYW5lbCA/IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoICcuanMtdG9nZ2xlLXRpbWVzbG90LXBpY2tlcicgKSA6IG51bGw7XG5cdFx0aWYgKCBwaWNrZXJfdG9nZ2xlICYmIHBpY2tlcl90b2dnbGUuY2hlY2tlZCApIHtcblx0XHRcdFRpbWUuc2V0X3BpY2tlcl9lbmFibGVkKCB0cnVlICk7XG5cdFx0XHRUaW1lLnNjaGVkdWxlX2luaXRfdGltZXNlbGVjdG9yKCk7XG5cdFx0fVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBTeW5jaHJvbml6ZSBhbGwgb3BlbiB0aW1lLWZpZWxkIHNraW4gY29udHJvbHMgdG8gYSBzYXZlZCBnbG9iYWwgdmFsdWUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBza2luX3ZhbHVlIFJlbGF0aXZlIHRpbWUtcGlja2VyIHNraW4gcGF0aC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdFRpbWUudWlfc2V0X3BpY2tlcl9za2luX3ZhbHVlID0gZnVuY3Rpb24gKHNraW5fdmFsdWUpIHtcblx0XHRkLnF1ZXJ5U2VsZWN0b3JBbGwoICcuanMtd3BiYy1iZmItdGltZS1waWNrZXItc2tpbicgKS5mb3JFYWNoKCBmdW5jdGlvbiAoc2VsZWN0X2NvbnRyb2wpIHtcblx0XHRcdHNlbGVjdF9jb250cm9sLnZhbHVlID0gU3RyaW5nKCBza2luX3ZhbHVlIHx8ICcnICk7XG5cdFx0fSApO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTeW5jaHJvbml6ZSBvdGhlciBjb250cm9scyBhZnRlciBhIGdsb2JhbCB0aW1lLXBpY2tlciBza2luIGlzIHNhdmVkLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0VGltZS5vbl9waWNrZXJfc2tpbl9zYXZlZCA9IGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgc2VsZWN0X2NvbnRyb2wgPSBkLnF1ZXJ5U2VsZWN0b3IoICcuanMtd3BiYy1iZmItdGltZS1waWNrZXItc2tpbicgKTtcblx0XHR2YXIgc2tpbl92YWx1ZSA9IHNlbGVjdF9jb250cm9sID8gU3RyaW5nKCBzZWxlY3RfY29udHJvbC52YWx1ZSB8fCAnJyApIDogJyc7XG5cdFx0dmFyIGFjY2VudF9idXR0b24gPSBkLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJmYi1hcHBseS1hY2NlbnQtY29tcG9uZW50cz1cIjFcIl0nICk7XG5cblx0XHRUaW1lLnVpX3NldF9waWNrZXJfc2tpbl92YWx1ZSggc2tpbl92YWx1ZSApO1xuXHRcdGlmICggYWNjZW50X2J1dHRvbiApIHtcblx0XHRcdGFjY2VudF9idXR0b24uc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWUtcGlja2VyLXNraW4tY3VycmVudCcsIHNraW5fdmFsdWUgKTtcblx0XHR9XG5cdH07XG5cblx0Ly8gVGhlIGdlbmVyaWMgcHJvdGVjdGVkIG9wdGlvbiBzYXZlciByZXNvbHZlcyBzdWNjZXNzZnVsIGNhbGxiYWNrcyBieSBnbG9iYWwgZnVuY3Rpb24gbmFtZS5cblx0dy53cGJjX2JmYl90aW1lX3BpY2tlcl9za2luX2NvbnRyb2xfc2F2ZWQgPSBUaW1lLm9uX3BpY2tlcl9za2luX3NhdmVkO1xuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBEZWJvdW5jZWQgaW5pdCBmb3IgZXh0ZXJuYWwgdGltZSBzZWxlY3RvciAoY2FudmFzIHByZXZpZXcpXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0LyoqXHJcblx0ICogRGVib3VuY2VkIGNhbGwgdG8gZ2xvYmFsIGluaXRpYWxpemVyIChpZiBwcmVzZW50KTogd3BiY19ob29rX19pbml0X3RpbWVzZWxlY3RvcigpXHJcblx0ICovXHJcblx0VGltZS5zY2hlZHVsZV9pbml0X3RpbWVzZWxlY3RvciA9IChmdW5jdGlvbiAoKSB7XHJcblx0XHRsZXQgc2NoZWR1bGVkID0gZmFsc2U7XHJcblx0XHRsZXQgdGlkID0gbnVsbDtcclxuXHRcdGNvbnN0IERFTEFZID0gMzA7XHJcblx0XHRyZXR1cm4gZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRpZiAoc2NoZWR1bGVkKSByZXR1cm47XHJcblx0XHRcdHNjaGVkdWxlZCA9IHRydWU7XHJcblx0XHRcdGNsZWFyVGltZW91dCh0aWQpO1xyXG5cdFx0XHR0aWQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uIHJ1bigpIHtcclxuXHRcdFx0XHRzY2hlZHVsZWQgPSBmYWxzZTtcclxuXHRcdFx0XHRpZiAoIWQucXVlcnlTZWxlY3RvcignLndwYmNfYmZiX19wcmV2aWV3LXRpbWVwaWNrZXInKSkgcmV0dXJuO1xyXG5cdFx0XHRcdGlmICh0eXBlb2Ygdy53cGJjX2hvb2tfX2luaXRfdGltZXNlbGVjdG9yID09PSAnZnVuY3Rpb24nKSB7XHJcblx0XHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0XHR3Ll9fd3BiY19ydF9tb19wYXVzZSAmJiB3Ll9fd3BiY19ydF9tb19wYXVzZSgpO1xyXG5cdFx0XHRcdFx0XHR3Ll9fd3BiY19zdF9tb19wYXVzZSAmJiB3Ll9fd3BiY19zdF9tb19wYXVzZSgpO1xyXG5cdFx0XHRcdFx0XHR3LndwYmNfaG9va19faW5pdF90aW1lc2VsZWN0b3IoKTtcclxuXHRcdFx0XHRcdH0gY2F0Y2ggKCBlICkgey8qIG5vLW9wICovXHJcblx0XHRcdFx0XHR9IGZpbmFsbHkge1xyXG5cdFx0XHRcdFx0XHR3Ll9fd3BiY19ydF9tb19yZXN1bWUgJiYgdy5fX3dwYmNfcnRfbW9fcmVzdW1lKCk7XHJcblx0XHRcdFx0XHRcdHcuX193cGJjX3N0X21vX3Jlc3VtZSAmJiB3Ll9fd3BiY19zdF9tb19yZXN1bWUoKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIERFTEFZICk7XHJcblx0XHR9O1xyXG5cdH0pKCk7XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBNaXJyb3IgdG8gU2V0dGluZ3MgVUkgd2l0aG91dCBmaXJpbmcgRE9NICdjaGFuZ2UnIChsb29wLXNhZmUpLlxyXG5cdCAqL1xyXG5cdFRpbWUubWlycm9yX3NldHRpbmdzX3RvZ2dsZSA9IGZ1bmN0aW9uIChlbmFibGVkKSB7XHJcblx0XHR3cGJjX2JmYl9fZGlzcGF0Y2hfZXZlbnRfc2FmZShcclxuXHRcdFx0J3dwYmM6YmZiOnNldHRpbmdzOnNldCcsXHJcblx0XHRcdHtcclxuXHRcdFx0XHRrZXkgICA6ICdib29raW5nX3RpbWVzbG90X3BpY2tlcicsXHJcblx0XHRcdFx0dmFsdWUgOiBlbmFibGVkID8gJ09uJyA6ICdPZmYnLFxyXG5cdFx0XHRcdHNvdXJjZTogJ3RpbWUtdXRpbHMnXHJcblx0XHRcdH1cclxuXHRcdCk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogUHJldmlldyByZWZyZXNoIGZvciB0aW1lLXNsb3QgcGlja2VyIHRvZ2dsZS5cclxuXHQgKiAtIE9OOiBqdXN0IGluaXQgZXh0ZXJuYWwgdGltZSBzZWxlY3Rvci5cclxuXHQgKiAtIE9GRjogdGVhcmRvd24gd2lkZ2V0cyBhbmQgdW5oaWRlIDxzZWxlY3Q+IGNvbnRyb2xzLCB0aGVuIHNvZnQgcmUtcmVuZGVyIChubyByZWJ1aWxkKS5cclxuXHQgKi9cclxuXHRUaW1lLnN5bmNfcHJldmlld19hZnRlcl9mbGFnID0gZnVuY3Rpb24gKGVuYWJsZWQpIHtcclxuXHRcdGlmICggZW5hYmxlZCApIHtcclxuXHRcdFx0VGltZS5zY2hlZHVsZV9pbml0X3RpbWVzZWxlY3RvcigpO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHR0cnkge1xyXG5cdFx0XHRkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfdGltZXNfc2VsZWN0b3InICkuZm9yRWFjaCggZnVuY3Rpb24gKGVsKSB7XHJcblx0XHRcdFx0aWYgKCBlbC5wYXJlbnROb2RlICkgZWwucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggZWwgKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHRkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFxyXG5cdFx0XHRcdCcud3BiY19iZmJfX3ByZXZpZXctc2VsZWN0LndwYmNfYmZiX19wcmV2aWV3LXJhbmdldGltZSwnICtcclxuXHRcdFx0XHQnc2VsZWN0W25hbWVePVwicmFuZ2V0aW1lXCJdLCBzZWxlY3RbbmFtZV49XCJzdGFydHRpbWVcIl0sIHNlbGVjdFtuYW1lXj1cImVuZHRpbWVcIl0sIHNlbGVjdFtuYW1lXj1cImR1cmF0aW9udGltZVwiXSdcclxuXHRcdFx0KS5mb3JFYWNoKCBmdW5jdGlvbiAocykge1xyXG5cdFx0XHRcdHMuc3R5bGUucmVtb3ZlUHJvcGVydHkoICdkaXNwbGF5JyApO1xyXG5cdFx0XHRcdHMuaGlkZGVuID0gZmFsc2U7XHJcblx0XHRcdH0gKTtcclxuXHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0fVxyXG5cdFx0aWYgKCB3aW5kb3cuV1BCQ19CRkJfU2V0dGluZ3MgJiYgdHlwZW9mIHdpbmRvdy5XUEJDX0JGQl9TZXR0aW5ncy53aGVuX2J1aWxkZXJfcmVhZHkgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdHdpbmRvdy5XUEJDX0JGQl9TZXR0aW5ncy53aGVuX2J1aWxkZXJfcmVhZHkoIGZ1bmN0aW9uIChiKSB7XHJcblx0XHRcdFx0aWYgKCAhYiB8fCAhYi5wcmV2aWV3X21vZGUgKSByZXR1cm47XHJcblx0XHRcdFx0aWYgKCB0eXBlb2YgYi5yZWZyZXNoX2NhbnZhcyA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdGIucmVmcmVzaF9jYW52YXMoIHtcclxuXHRcdFx0XHRcdFx0aGFyZCAgICAgICAgICAgICA6IHRydWUsXHJcblx0XHRcdFx0XHRcdHJlYnVpbGQgICAgICAgICAgOiBmYWxzZSwgICAvLyBjcml0aWNhbDogbm8gbG9hZF9zYXZlZF9zdHJ1Y3R1cmUoKVxyXG5cdFx0XHRcdFx0XHRyZWluaXQgICAgICAgICAgIDogZmFsc2UsXHJcblx0XHRcdFx0XHRcdHJlc3RvcmVfc2VsZWN0aW9uOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRyZXN0b3JlX3Njcm9sbCAgIDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0c2lsZW50X2luc3BlY3RvciA6IHRydWUsXHJcblx0XHRcdFx0XHRcdHNvdXJjZSAgICAgICAgICAgOiAnc2V0dGluZ3M6dGltZXNsb3QnXHJcblx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0fSBlbHNlIGlmICggdHlwZW9mIGIucmVuZGVyX3ByZXZpZXdfYWxsID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0Yi5yZW5kZXJfcHJldmlld19hbGwoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBPbmUtY2FsbCB1bml2ZXJzYWwgc2V0dGVyIHVzZWQgYnkgU2V0dGluZ3MgKyBhbGwgdGltZS1maWVsZCBpbnNwZWN0b3JzLlxyXG5cdCAqL1xyXG5cdFRpbWUuc2V0X2dsb2JhbF90aW1lc2xvdF9waWNrZXIgPSBmdW5jdGlvbiAoZW5hYmxlZCwgb3B0cykge1xyXG5cdFx0b3B0cyA9IG9wdHMgfHwge307XHJcblx0XHRUaW1lLnNldF9waWNrZXJfZW5hYmxlZCggZW5hYmxlZCApOyAgICAgICAgICAgICAgICAgLy8gcGVyc2lzdCBpbi1tZW1vcnkgZmxhZ1xyXG5cdFx0VGltZS51aV9hcHBseV9waWNrZXJfZW5hYmxlZF90b19hbGwoIGVuYWJsZWQgKTsgICAgIC8vIHN5bmMgYWxsIG9wZW4gaW5zcGVjdG9yc1xyXG5cdFx0aWYgKCBvcHRzLm1pcnJvcl9zZXR0aW5ncyAhPT0gZmFsc2UgKSB7XHJcblx0XHRcdFRpbWUubWlycm9yX3NldHRpbmdzX3RvZ2dsZSggZW5hYmxlZCApOyAgICAgICAgICAgLy8gbWlycm9yIFNldHRpbmdzIHRvZ2dsZSAobm8gJ2NoYW5nZScgZXZlbnQpXHJcblx0XHR9XHJcblx0XHRpZiAoIG9wdHMucmVmcmVzaF9wcmV2aWV3ICE9PSBmYWxzZSApIHtcclxuXHRcdFx0VGltZS5zeW5jX3ByZXZpZXdfYWZ0ZXJfZmxhZyggZW5hYmxlZCApOyAgICAgICAgICAvLyBzYWZlIHByZXZpZXcgcmVmcmVzaFxyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gR2xvYmFsIGJpbmRlcjogc2VsZWN0IHZzLiB0aW1lIHBpY2tlciB0b2dnbGUgKE9ORS1USU1FLCBzaGFyZWQgYnkgYWxsIHRpbWUtYmFzZWQgcGFja3MpXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0LyoqXHJcblx0ICogQmluZCBvbmNlIHRvOlxyXG5cdCAqICAtIGluaXRpYWxpemUgYWxsIG9wZW4gSW5zcGVjdG9yIHBhbmVscyB3aXRoIHRoZSBjdXJyZW50IGdsb2JhbCBmbGFnLFxyXG5cdCAqICAtIHJlYWN0IHRvIG5ld2x5IGFkZGVkIEluc3BlY3RvciBwYW5lbHMgdmlhIE11dGF0aW9uT2JzZXJ2ZXIsXHJcblx0ICogIC0gcGVyc2lzdCBhbmQgYnJvYWRjYXN0IGNoYW5nZXMgd2hlbiB0aGUgXCJTaG93IGFzIHRpbWUgcGlja2VyXCIgY2hlY2tib3ggdG9nZ2xlcy5cclxuXHQgKi9cclxuXHRUaW1lLmVuc3VyZV9nbG9iYWxfdGltZXBpY2tlcl90b2dnbGVfYmluZGVyID0gZnVuY3Rpb24gKCkge1xyXG5cclxuXHRcdGlmIChUaW1lLl9fdG9nZ2xlQmluZGVyQm91bmQpIHJldHVybjtcclxuXHRcdFRpbWUuX190b2dnbGVCaW5kZXJCb3VuZCA9IHRydWU7XHJcblxyXG5cdFx0Ly8gMSkgSW5pdCBhbGwgY3VycmVudGx5IG9wZW4gcGFuZWxzXHJcblx0XHRmdW5jdGlvbiBpbml0X2FsbF9wYW5lbHMoKSB7XHJcblx0XHRcdFRpbWUudWlfYXBwbHlfcGlja2VyX2VuYWJsZWRfdG9fYWxsKFRpbWUucmVhZF9waWNrZXJfZW5hYmxlZCgpKTtcclxuXHRcdH1cclxuXHRcdChkLnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJylcclxuXHRcdFx0PyBkLmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBpbml0X2FsbF9wYW5lbHMpXHJcblx0XHRcdDogaW5pdF9hbGxfcGFuZWxzKCk7XHJcblxyXG5cdFx0Ly8gMikgT2JzZXJ2ZSBJbnNwZWN0b3IgcGFuZWxzIHRoYXQgYXBwZWFyIGxhdGVyXHJcblx0XHR0cnkge1xyXG5cdFx0XHR2YXIgbW8gPSBuZXcgTXV0YXRpb25PYnNlcnZlcihmdW5jdGlvbiAobXV0cykge1xyXG5cdFx0XHRcdHZhciBlbmFibGVkID0gVGltZS5yZWFkX3BpY2tlcl9lbmFibGVkKCk7XHJcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBtdXRzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0XHR2YXIgbSA9IG11dHNbaV07XHJcblx0XHRcdFx0XHRmb3IgKHZhciBqID0gMDsgaiA8IG0uYWRkZWROb2Rlcy5sZW5ndGg7IGorKykge1xyXG5cdFx0XHRcdFx0XHR2YXIgbiA9IG0uYWRkZWROb2Rlc1tqXTtcclxuXHRcdFx0XHRcdFx0aWYgKCFuIHx8IG4ubm9kZVR5cGUgIT09IDEpIGNvbnRpbnVlO1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKG4ubWF0Y2hlcyAmJiBuLm1hdGNoZXMoJy53cGJjX2JmYl9faW5zcGVjdG9yX3RpbWVwaWNrZXInKSkge1xyXG5cdFx0XHRcdFx0XHRcdHRyeSB7IFRpbWUudWlfc2V0X3BpY2tlcl90b2dnbGVfZm9yX3BhbmVsKG4sIGVuYWJsZWQpOyB9IGNhdGNoIChlKSB7fVxyXG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKG4ucXVlcnlTZWxlY3Rvcikge1xyXG5cdFx0XHRcdFx0XHRcdG4ucXVlcnlTZWxlY3RvckFsbCgnLndwYmNfYmZiX19pbnNwZWN0b3JfdGltZXBpY2tlcicpLmZvckVhY2goZnVuY3Rpb24gKHBhbmVsKSB7XHJcblx0XHRcdFx0XHRcdFx0XHR0cnkgeyBUaW1lLnVpX3NldF9waWNrZXJfdG9nZ2xlX2Zvcl9wYW5lbChwYW5lbCwgZW5hYmxlZCk7IH0gY2F0Y2ggKGUpIHt9XHJcblx0XHRcdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cdFx0XHRtby5vYnNlcnZlKGQuYm9keSwgeyBjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUgfSk7XHJcblx0XHRcdC8vIE9wdGlvbmFsIHBhdXNlL3Jlc3VtZSBob29rcyBpZiBvdGhlciBtb2R1bGVzIHdhbnQgdG8gc3VzcGVuZCBvYnNlcnZlcnMgdGVtcG9yYXJpbHk6XHJcblx0XHRcdHcuX193cGJjX3RpbWVwaWNrZXJfdG9nZ2xlX21vX3BhdXNlICA9IGZ1bmN0aW9uKCl7IHRyeSB7IG1vLmRpc2Nvbm5lY3QoKTsgfSBjYXRjaChlKXt9IH07XHJcblx0XHRcdHcuX193cGJjX3RpbWVwaWNrZXJfdG9nZ2xlX21vX3Jlc3VtZSA9IGZ1bmN0aW9uKCl7XHJcblx0XHRcdFx0dHJ5IHsgbW8ub2JzZXJ2ZShkLmJvZHksIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0pOyB9IGNhdGNoKGUpe31cclxuXHRcdFx0fTtcclxuXHRcdH0gY2F0Y2ggKGUpIHt9XHJcblxyXG5cdFx0Ly8gMykgQ2hlY2tib3ggaGFuZGxlciAoZGVsZWdhdGVkKS5cblx0XHQvLyBTa2luIGNoYW5nZXMgdXNlIGpRdWVyeSBiZWxvdyBiZWNhdXNlIHRoZSBwcmV2aW91cy9uZXh0IHNlbGVjdGJveFxuXHRcdC8vIGNvbnRyb2xzIGRpc3BhdGNoIGpRdWVyeSdzIHN5bnRoZXRpYyBgY2hhbmdlYCBldmVudC5cblx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGZ1bmN0aW9uIChldikge1xuXHRcdFx0dmFyIHQgPSBldi50YXJnZXQ7XG5cdFx0XHRpZiAoIXQgfHwgIXQuY2xhc3NMaXN0KSByZXR1cm47XG5cblx0XHRcdGlmICh0LmNsYXNzTGlzdC5jb250YWlucygnanMtd3BiYy1iZmItdGltZS1waWNrZXItc2tpbicpKSB7XG5cdFx0XHRcdGlmICggISB3LmpRdWVyeSApIFRpbWUuYXBwbHlfcGlja2VyX3NraW5fZnJvbV9zZWxlY3QodCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICghdC5jbGFzc0xpc3QuY29udGFpbnMoJ2pzLXRvZ2dsZS10aW1lc2xvdC1waWNrZXInKSkgcmV0dXJuO1xuXHJcblx0XHRcdHZhciBlbmFibGVkID0gISF0LmNoZWNrZWQ7XG5cdFx0XHRUaW1lLnNldF9nbG9iYWxfdGltZXNsb3RfcGlja2VyKCBlbmFibGVkLCB7IHNvdXJjZTogJ2luc3BlY3RvcicgfSApO1xuXHRcdH0pO1xuXG5cdFx0aWYgKCB3LmpRdWVyeSApIHtcblx0XHRcdHcualF1ZXJ5KCBkIClcblx0XHRcdFx0Lm9mZiggJ2NoYW5nZS53cGJjQmZiVGltZVBpY2tlclNraW4nLCAnLmpzLXdwYmMtYmZiLXRpbWUtcGlja2VyLXNraW4nIClcblx0XHRcdFx0Lm9uKCAnY2hhbmdlLndwYmNCZmJUaW1lUGlja2VyU2tpbicsICcuanMtd3BiYy1iZmItdGltZS1waWNrZXItc2tpbicsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRUaW1lLmFwcGx5X3BpY2tlcl9za2luX2Zyb21fc2VsZWN0KCB0aGlzICk7XG5cdFx0XHRcdH0gKTtcblx0XHR9XG5cdH07XG5cclxuXHQvLyBBdXRvLWJpbmQgb24gc2NyaXB0IGxvYWQuXHJcblx0dHJ5IHsgVGltZS5lbnN1cmVfZ2xvYmFsX3RpbWVwaWNrZXJfdG9nZ2xlX2JpbmRlcigpOyB9IGNhdGNoIChlKSB7fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEJ1aWxkZXIgY2FudmFzIHJlZnJlc2ggaG9va3MgKG1vdmVkIG91dCBvZiBiZmItYnVpbGRlci5qcylcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHQvKipcclxuXHQgKiBCaW5kIHBhdXNlL3Jlc3VtZSBob29rcyB0byBCdWlsZGVyIGNhbnZhcyByZWZyZXNoIGV2ZW50cy5cclxuXHQgKlxyXG5cdCAqIFdoeSBoZXJlOlxyXG5cdCAqIC0gVGhpcyBtb2R1bGUgb3ducyB0aGUgdGltZXBpY2tlci10b2dnbGUgTXV0YXRpb25PYnNlcnZlciBhbmQgdGltZSBzZWxlY3RvciBpbml0LlxyXG5cdCAqIC0gQnVpbGRlciBzaG91bGQgbm90IGtub3cgYWJvdXQgcGFjay1zcGVjaWZpYyBvYnNlcnZlcnMuXHJcblx0ICpcclxuXHQgKiBTYWZldHk6XHJcblx0ICogLSBJZGVtcG90ZW50IChiaW5kcyBvbmNlKS5cclxuXHQgKiAtIFdhaXRzIGZvciB3cGJjX2JmYl9hcGkucmVhZHkuXHJcblx0ICogLSBObyBoYXJkIGRlcGVuZGVuY3k6IGlmIGJ1aWxkZXIvYnVzL2V2ZW50cyBhcmUgYWJzZW50LCBpdCBzaWxlbnRseSBuby1vcHMuXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHQgKi9cclxuXHRUaW1lLmVuc3VyZV9idWlsZGVyX2NhbnZhc19yZWZyZXNoX2hvb2tzID0gZnVuY3Rpb24gKCkge1xyXG5cclxuXHRcdGlmICggVGltZS5fX2J1aWxkZXJfY2FudmFzX3JlZnJlc2hfaG9va3NfYm91bmQgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdFRpbWUuX19idWlsZGVyX2NhbnZhc19yZWZyZXNoX2hvb2tzX2JvdW5kID0gdHJ1ZTtcclxuXHJcblx0XHQvLyBCdWlsZGVyIEFQSSBtdXN0IGV4aXN0LlxyXG5cdFx0aWYgKCAhdy53cGJjX2JmYl9hcGkgfHwgIXcud3BiY19iZmJfYXBpLnJlYWR5IHx8ICh0eXBlb2Ygdy53cGJjX2JmYl9hcGkucmVhZHkudGhlbiAhPT0gJ2Z1bmN0aW9uJykgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR3LndwYmNfYmZiX2FwaS5yZWFkeS50aGVuKCBmdW5jdGlvbiAoYnVpbGRlcikge1xyXG5cclxuXHRcdFx0Ly8gQnVpbGRlciBtaWdodCByZXNvbHZlIG51bGwgKHRpbWVvdXQpIOKAkyBqdXN0IGlnbm9yZS5cclxuXHRcdFx0aWYgKCAhYnVpbGRlciB8fCAhYnVpbGRlci5idXMgfHwgKHR5cGVvZiBidWlsZGVyLmJ1cy5vbiAhPT0gJ2Z1bmN0aW9uJykgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgRVZTICAgICAgID0gKHcuV1BCQ19CRkJfQ29yZSAmJiB3LldQQkNfQkZCX0NvcmUuV1BCQ19CRkJfRXZlbnRzKSA/IHcuV1BCQ19CRkJfQ29yZS5XUEJDX0JGQl9FdmVudHMgOiB7fTtcclxuXHRcdFx0dmFyIEVWX0JFRk9SRSA9IEVWUy5DQU5WQVNfUkVGUkVTSCB8fCAnd3BiYzpiZmI6Y2FudmFzLXJlZnJlc2gnO1xyXG5cdFx0XHR2YXIgRVZfQUZURVIgID0gRVZTLkNBTlZBU19SRUZSRVNIRUQgfHwgJ3dwYmM6YmZiOmNhbnZhcy1yZWZyZXNoZWQnO1xyXG5cclxuXHRcdFx0Ly8gQkVGT1JFIHJlZnJlc2g6IHBhdXNlIG9ic2VydmVycyB0byBhdm9pZCBsb29wcyAvIGV4dHJhIHdvcmsgd2hpbGUgRE9NIGlzIGJlaW5nIHJlYnVpbHQuXHJcblx0XHRcdGJ1aWxkZXIuYnVzLm9uKCBFVl9CRUZPUkUsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0aWYgKCB0eXBlb2Ygdy5fX3dwYmNfcnRfbW9fcGF1c2UgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdHcuX193cGJjX3J0X21vX3BhdXNlKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiB3Ll9fd3BiY19zdF9tb19wYXVzZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0dy5fX3dwYmNfc3RfbW9fcGF1c2UoKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdGlmICggdHlwZW9mIHcuX193cGJjX3RpbWVwaWNrZXJfdG9nZ2xlX21vX3BhdXNlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHR3Ll9fd3BiY190aW1lcGlja2VyX3RvZ2dsZV9tb19wYXVzZSgpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Ly8gQUZURVIgcmVmcmVzaDogcmVzdW1lIGFuZCAoaWYgbmVlZGVkKSByZS1pbml0IHRpbWVzZWxlY3RvciB3aWRnZXRzLlxyXG5cdFx0XHRidWlsZGVyLmJ1cy5vbiggRVZfQUZURVIsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0aWYgKCB0eXBlb2Ygdy5fX3dwYmNfcnRfbW9fcmVzdW1lID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHR3Ll9fd3BiY19ydF9tb19yZXN1bWUoKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdGlmICggdHlwZW9mIHcuX193cGJjX3N0X21vX3Jlc3VtZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0dy5fX3dwYmNfc3RfbW9fcmVzdW1lKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiB3Ll9fd3BiY190aW1lcGlja2VyX3RvZ2dsZV9tb19yZXN1bWUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdHcuX193cGJjX3RpbWVwaWNrZXJfdG9nZ2xlX21vX3Jlc3VtZSgpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gSWYgdGltZS1zbG90IHBpY2tlciBpcyBlbmFibGVkIGFuZCBidWlsZGVyIGlzIGluIHByZXZpZXcgbW9kZSwgcmUtaW5pdCB0aGUgdGltZSBzZWxlY3RvciBVSS5cclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0aWYgKCBidWlsZGVyLnByZXZpZXdfbW9kZSAmJiB0eXBlb2YgVGltZS5yZWFkX3BpY2tlcl9lbmFibGVkID09PSAnZnVuY3Rpb24nICYmIFRpbWUucmVhZF9waWNrZXJfZW5hYmxlZCgpICkge1xyXG5cdFx0XHRcdFx0XHRpZiAoIHR5cGVvZiBUaW1lLnNjaGVkdWxlX2luaXRfdGltZXNlbGVjdG9yID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRcdFRpbWUuc2NoZWR1bGVfaW5pdF90aW1lc2VsZWN0b3IoKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdH0gKTtcclxuXHR9O1xyXG5cclxuXHQvLyBDYWxsIG9uY2Ugb24gbG9hZC5cclxuXHR0cnkge1xyXG5cdFx0VGltZS5lbnN1cmVfYnVpbGRlcl9jYW52YXNfcmVmcmVzaF9ob29rcygpO1xyXG5cdH0gY2F0Y2ggKCBlICkge1xyXG5cdH1cclxuXHJcblxyXG59KSh3aW5kb3csIGRvY3VtZW50KTtcclxuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsQ0FBQyxVQUFVQSxDQUFDLEVBQUVDLENBQUMsRUFBRTtFQUNoQixZQUFZOztFQUVaLElBQUlDLElBQUksR0FBR0YsQ0FBQyxDQUFDRyxhQUFhLEtBQUtILENBQUMsQ0FBQ0csYUFBYSxHQUFHLENBQUMsQ0FBQyxDQUFDO0VBQ3BELElBQUlDLElBQUksR0FBR0YsSUFBSSxDQUFDRSxJQUFJLEtBQUtGLElBQUksQ0FBQ0UsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDO0VBRXhDLElBQUlDLEtBQUssR0FBR0wsQ0FBQyxDQUFDSyxLQUFLLElBQUksSUFBSTs7RUFFM0I7RUFDQTtFQUNBOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDRCxJQUFJLENBQUNFLGNBQWMsR0FBRyxVQUFVQyxDQUFDLEVBQUU7SUFDbEMsSUFBSSxPQUFPQSxDQUFDLEtBQUssU0FBUyxFQUFFLE9BQU9BLENBQUM7SUFDcEMsSUFBSSxPQUFPQSxDQUFDLEtBQUssUUFBUSxFQUFFLE9BQU9BLENBQUMsS0FBSyxDQUFDO0lBQ3pDLElBQUksT0FBT0EsQ0FBQyxLQUFLLFFBQVEsRUFBRTtNQUMxQixJQUFJQyxDQUFDLEdBQUdELENBQUMsQ0FBQ0UsSUFBSSxDQUFDLENBQUMsQ0FBQ0MsV0FBVyxDQUFDLENBQUM7TUFDOUIsSUFBSUYsQ0FBQyxLQUFLLElBQUksSUFBSUEsQ0FBQyxLQUFLLE1BQU0sSUFBSUEsQ0FBQyxLQUFLLEdBQUcsSUFBSUEsQ0FBQyxLQUFLLEtBQUssRUFBRSxPQUFP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
