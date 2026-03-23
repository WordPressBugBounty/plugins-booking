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

    // 3) Checkbox handler (delegated)
    d.addEventListener('change', function (ev) {
      var t = ev.target;
      if (!t || !t.classList || !t.classList.contains('js-toggle-timeslot-picker')) return;
      var enabled = !!t.checked;
      Time.set_global_timeslot_picker(enabled, {
        source: 'inspector'
      });
    });
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9iZmItdGltZS11dGlscy5qcyIsIm5hbWVzIjpbInciLCJkIiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJUaW1lIiwiSU1hc2siLCJjb2VyY2VfdG9fYm9vbCIsInYiLCJzIiwidHJpbSIsInRvTG93ZXJDYXNlIiwicGFyc2VfaGhtbV8yNGgiLCJoaG1tIiwiTmFOIiwibSIsIlN0cmluZyIsIm1hdGNoIiwiSCIsIk51bWJlciIsIk0iLCJwYXJzZV9hbXBtX3RleHQiLCJ0eHQiLCJoMTIiLCJtbSIsImFwIiwidG9VcHBlckNhc2UiLCJoMjQiLCJwYXJzZV9taW51dGVzIiwibTIiLCJpc05hTiIsImZvcm1hdF9taW51dGVzXzI0aCIsIm1pbnV0ZXMiLCJNYXRoIiwiZmxvb3IiLCJISCIsIk1NIiwiZm9ybWF0X21pbnV0ZXNfYW1wbSIsIkgyNCIsImlzX2FtIiwiZXNjX2F0dHIiLCJyZXBsYWNlIiwiYXBwbHlfaW1hc2tfdG9faW5wdXQiLCJlbCIsIl9pbWFzayIsImRlc3Ryb3kiLCJlIiwibWFzayIsImJsb2NrcyIsIk1hc2tlZFJhbmdlIiwiZnJvbSIsInRvIiwibWF4TGVuZ3RoIiwibGF6eSIsImNsZWFyX2ltYXNrIiwiY29udmVydF9pbnB1dF9ub2RlX3RvX2Zvcm1hdCIsIm5vZGUiLCJ0b19mbXQiLCJ2YWx1ZV9taW51dGVzIiwicGFyZW50IiwicGFyZW50Tm9kZSIsImNscyIsImNsYXNzTmFtZSIsImlzX3N0YXJ0IiwiY2xhc3NMaXN0IiwiY29udGFpbnMiLCJuZXdfZWwiLCJjcmVhdGVFbGVtZW50IiwidHlwZSIsImFkZCIsInNldEF0dHJpYnV0ZSIsInZhbHVlIiwic3RlcCIsInJlcGxhY2VDaGlsZCIsInJlYnVpbGRfcm93X2lucHV0c190b19mb3JtYXQiLCJyb3ciLCJzX2VsIiwicXVlcnlTZWxlY3RvciIsImVfZWwiLCJzX20iLCJlX20iLCJzX25ldyIsImVfbmV3IiwicmVidWlsZF9hbGxfcm93c190b19mb3JtYXQiLCJjb250YWluZXIiLCJxdWVyeVNlbGVjdG9yQWxsIiwiZm9yRWFjaCIsImFwcGx5X2ltYXNrX2luX2NvbnRhaW5lcl8yNGgiLCJidWlsZF90aW1lX3Nsb3RzIiwic3RhcnRfbWludXRlcyIsImVuZF9taW51dGVzIiwic3RlcF9taW51dGVzIiwibGFiZWxfZm10Iiwib3V0IiwidCIsInQyIiwidjEiLCJ2MiIsImwxIiwibDIiLCJwdXNoIiwibGFiZWwiLCJzZWxlY3RlZCIsInJlYWRfcGlja2VyX2VuYWJsZWQiLCJfd3BiYyIsImdldF9vdGhlcl9wYXJhbSIsInNldF9waWNrZXJfZW5hYmxlZCIsImVuYWJsZWQiLCJzZXRfb3RoZXJfcGFyYW0iLCJ1aV9zZXRfcGlja2VyX3RvZ2dsZV9mb3JfcGFuZWwiLCJwYW5lbCIsImNoayIsImNoZWNrZWQiLCJwaFJvdyIsInN0eWxlIiwiZGlzcGxheSIsImhpZGRlbiIsInVpX2FwcGx5X3BpY2tlcl9lbmFibGVkX3RvX2FsbCIsInNjaGVkdWxlX2luaXRfdGltZXNlbGVjdG9yIiwic2NoZWR1bGVkIiwidGlkIiwiREVMQVkiLCJjbGVhclRpbWVvdXQiLCJzZXRUaW1lb3V0IiwicnVuIiwid3BiY19ob29rX19pbml0X3RpbWVzZWxlY3RvciIsIl9fd3BiY19ydF9tb19wYXVzZSIsIl9fd3BiY19zdF9tb19wYXVzZSIsIl9fd3BiY19ydF9tb19yZXN1bWUiLCJfX3dwYmNfc3RfbW9fcmVzdW1lIiwibWlycm9yX3NldHRpbmdzX3RvZ2dsZSIsIndwYmNfYmZiX19kaXNwYXRjaF9ldmVudF9zYWZlIiwia2V5Iiwic291cmNlIiwic3luY19wcmV2aWV3X2FmdGVyX2ZsYWciLCJkb2N1bWVudCIsInJlbW92ZUNoaWxkIiwicmVtb3ZlUHJvcGVydHkiLCJ3aW5kb3ciLCJXUEJDX0JGQl9TZXR0aW5ncyIsIndoZW5fYnVpbGRlcl9yZWFkeSIsImIiLCJwcmV2aWV3X21vZGUiLCJyZWZyZXNoX2NhbnZhcyIsImhhcmQiLCJyZWJ1aWxkIiwicmVpbml0IiwicmVzdG9yZV9zZWxlY3Rpb24iLCJyZXN0b3JlX3Njcm9sbCIsInNpbGVudF9pbnNwZWN0b3IiLCJyZW5kZXJfcHJldmlld19hbGwiLCJzZXRfZ2xvYmFsX3RpbWVzbG90X3BpY2tlciIsIm9wdHMiLCJtaXJyb3Jfc2V0dGluZ3MiLCJyZWZyZXNoX3ByZXZpZXciLCJlbnN1cmVfZ2xvYmFsX3RpbWVwaWNrZXJfdG9nZ2xlX2JpbmRlciIsIl9fdG9nZ2xlQmluZGVyQm91bmQiLCJpbml0X2FsbF9wYW5lbHMiLCJyZWFkeVN0YXRlIiwiYWRkRXZlbnRMaXN0ZW5lciIsIm1vIiwiTXV0YXRpb25PYnNlcnZlciIsIm11dHMiLCJpIiwibGVuZ3RoIiwiaiIsImFkZGVkTm9kZXMiLCJuIiwibm9kZVR5cGUiLCJtYXRjaGVzIiwib2JzZXJ2ZSIsImJvZHkiLCJjaGlsZExpc3QiLCJzdWJ0cmVlIiwiX193cGJjX3RpbWVwaWNrZXJfdG9nZ2xlX21vX3BhdXNlIiwiZGlzY29ubmVjdCIsIl9fd3BiY190aW1lcGlja2VyX3RvZ2dsZV9tb19yZXN1bWUiLCJldiIsInRhcmdldCIsImVuc3VyZV9idWlsZGVyX2NhbnZhc19yZWZyZXNoX2hvb2tzIiwiX19idWlsZGVyX2NhbnZhc19yZWZyZXNoX2hvb2tzX2JvdW5kIiwid3BiY19iZmJfYXBpIiwicmVhZHkiLCJ0aGVuIiwiYnVpbGRlciIsImJ1cyIsIm9uIiwiRVZTIiwiV1BCQ19CRkJfRXZlbnRzIiwiRVZfQkVGT1JFIiwiQ0FOVkFTX1JFRlJFU0giLCJFVl9BRlRFUiIsIkNBTlZBU19SRUZSRVNIRUQiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9fc3JjL2JmYi10aW1lLXV0aWxzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBXUEJDIEJGQiBDb3JlOiBUaW1lIFV0aWxpdGllc1xyXG4gKlxyXG4gKiBPbmUgcGxhY2UgZm9yIGFsbCB0aW1lIHBhcnNpbmcvZm9ybWF0dGluZy9tYXNraW5nIGhlbHBlcnMgKyBzbWFsbCBVSSBoZWxwZXJzIHVzZWQgYnkgdGltZS1iYXNlZCBwYWNrcy5cclxuICpcclxuICogLSBQdXJlIGhlbHBlcnMgKHBhcnNlL2Zvcm1hdCBtaW51dGVzLCBBTS9QTSBjb252ZXJzaW9uKVxyXG4gKiAtIGlNYXNrIGludGVncmF0aW9uIGZvciBcIkhIOk1NXCIgaW5wdXRzXHJcbiAqIC0gSW5wdXQtbm9kZSBjb252ZXJzaW9uICh0eXBlPXRpbWUgPC0+IG1hc2tlZCB0ZXh0KVxyXG4gKiAtIFNtYWxsIFVJIGhlbHBlcnMgZm9yIGdsb2JhbCBcInRpbWUtc2xvdCBwaWNrZXJcIiB0b2dnbGUgKHBsYWNlaG9sZGVyIHJvdywgY2hlY2tib3ggc3luYylcclxuICogLSBEZWJvdW5jZWQgaW5pdCBmb3IgZXh0ZXJuYWwgXCJ0aW1lIHNlbGVjdG9yXCIgKHdwYmNfaG9va19faW5pdF90aW1lc2VsZWN0b3IpXHJcbiAqXHJcbiAqIEBwYWNrYWdlICAgQm9va2luZyBDYWxlbmRhclxyXG4gKiBAYXV0aG9yICAgIHdwZGV2ZWxvcFxyXG4gKiBAc2luY2UgICAgIDExLjAuMFxyXG4gKiBAdmVyc2lvbiAgIDEuMC4wXHJcbiAqIEBtb2RpZmllZDogMjAyNS0xMC0zMSAxMjozMlxyXG4gKlxyXG4gKiAuLi9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9fb3V0L2JmYi10aW1lLXV0aWxzLmpzXHJcbiAqL1xyXG5cclxuLyogZ2xvYmFsIHdpbmRvdywgZG9jdW1lbnQgKi9cclxuKGZ1bmN0aW9uICh3LCBkKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHR2YXIgQ29yZSA9IHcuV1BCQ19CRkJfQ29yZSB8fCAody5XUEJDX0JGQl9Db3JlID0ge30pO1xyXG5cdHZhciBUaW1lID0gQ29yZS5UaW1lIHx8IChDb3JlLlRpbWUgPSB7fSk7XHJcblxyXG5cdHZhciBJTWFzayA9IHcuSU1hc2sgfHwgbnVsbDtcclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBCYXNpYyBoZWxwZXJzXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0LyoqXHJcblx0ICogQ29lcmNlIG1peGVkIHZhbHVlcyB0byBib29sZWFuLlxyXG5cdCAqIEFjY2VwdHMgYm9vbGVhbnMsIG51bWJlcnMsIGFuZCBjb21tb24gc3RyaW5nczogXCJvblwiL1wib2ZmXCIsIFwidHJ1ZVwiL1wiZmFsc2VcIiwgXCIxXCIvXCIwXCIsIFwieWVzXCIvXCJub1wiLlxyXG5cdCAqIEBwYXJhbSB7Kn0gdlxyXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59XHJcblx0ICovXHJcblx0VGltZS5jb2VyY2VfdG9fYm9vbCA9IGZ1bmN0aW9uICh2KSB7XHJcblx0XHRpZiAodHlwZW9mIHYgPT09ICdib29sZWFuJykgcmV0dXJuIHY7XHJcblx0XHRpZiAodHlwZW9mIHYgPT09ICdudW1iZXInKSByZXR1cm4gdiAhPT0gMDtcclxuXHRcdGlmICh0eXBlb2YgdiA9PT0gJ3N0cmluZycpIHtcclxuXHRcdFx0dmFyIHMgPSB2LnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0XHRpZiAocyA9PT0gJ29uJyB8fCBzID09PSAndHJ1ZScgfHwgcyA9PT0gJzEnIHx8IHMgPT09ICd5ZXMnKSByZXR1cm4gdHJ1ZTtcclxuXHRcdFx0aWYgKHMgPT09ICdvZmYnIHx8IHMgPT09ICdmYWxzZScgfHwgcyA9PT0gJzAnIHx8IHMgPT09ICdubycgfHwgcyA9PT0gJycpIHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHRcdHJldHVybiAhIXY7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogUGFyc2UgXCJISDpNTVwiIDI0aCAtPiBtaW51dGVzIHNpbmNlIDAwOjAwLiBSZXR1cm5zIE5hTiBvbiBpbnZhbGlkLlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBoaG1tXHJcblx0ICogQHJldHVybiB7bnVtYmVyfVxyXG5cdCAqL1xyXG5cdFRpbWUucGFyc2VfaGhtbV8yNGggPSBmdW5jdGlvbiAoaGhtbSkge1xyXG5cdFx0aWYgKCFoaG1tKSByZXR1cm4gTmFOO1xyXG5cdFx0dmFyIG0gPSBTdHJpbmcoaGhtbSkudHJpbSgpLm1hdGNoKC9eKFxcZHsxLDJ9KVxccyo6XFxzKihcXGR7Mn0pJC8pO1xyXG5cdFx0aWYgKCFtKSByZXR1cm4gTmFOO1xyXG5cdFx0dmFyIEggPSBOdW1iZXIobVsxXSksIE0gPSBOdW1iZXIobVsyXSk7XHJcblx0XHRpZiAoSCA8IDAgfHwgSCA+IDIzIHx8IE0gPCAwIHx8IE0gPiA1OSkgcmV0dXJuIE5hTjtcclxuXHRcdHJldHVybiBIICogNjAgKyBNO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFBhcnNlIFwiaDpNTSBBTS9QTVwiIC0+IG1pbnV0ZXMgc2luY2UgMDA6MDAuIFJldHVybnMgTmFOIG9uIGludmFsaWQuXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHR4dFxyXG5cdCAqIEByZXR1cm4ge251bWJlcn1cclxuXHQgKi9cclxuXHRUaW1lLnBhcnNlX2FtcG1fdGV4dCA9IGZ1bmN0aW9uICh0eHQpIHtcclxuXHRcdGlmICghdHh0KSByZXR1cm4gTmFOO1xyXG5cdFx0dmFyIG0gPSBTdHJpbmcodHh0KS50cmltKCkubWF0Y2goL14oXFxkezEsMn0pXFxzKjpcXHMqKFxcZHsyfSlcXHMqKFtBYVBwXVtNbV0pJC8pO1xyXG5cdFx0aWYgKCFtKSByZXR1cm4gTmFOO1xyXG5cdFx0dmFyIGgxMiA9IE51bWJlcihtWzFdKSwgbW0gPSBOdW1iZXIobVsyXSksIGFwID0gU3RyaW5nKG1bM10pLnRvVXBwZXJDYXNlKCk7XHJcblx0XHRpZiAoaDEyIDwgMSB8fCBoMTIgPiAxMiB8fCBtbSA8IDAgfHwgbW0gPiA1OSkgcmV0dXJuIE5hTjtcclxuXHRcdHZhciBoMjQgPSAoaDEyICUgMTIpICsgKGFwID09PSAnUE0nID8gMTIgOiAwKTtcclxuXHRcdHJldHVybiBoMjQgKiA2MCArIG1tO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFRyeSAyNGggXCJISDpNTVwiIGZpcnN0LCBmYWxsIGJhY2sgdG8gQU0vUE0gdGV4dC5cclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdlxyXG5cdCAqIEByZXR1cm4ge251bWJlcn1cclxuXHQgKi9cclxuXHRUaW1lLnBhcnNlX21pbnV0ZXMgPSBmdW5jdGlvbiAodikge1xyXG5cdFx0dmFyIHMgPSBTdHJpbmcodiB8fCAnJykudHJpbSgpO1xyXG5cdFx0dmFyIG0yID0gVGltZS5wYXJzZV9oaG1tXzI0aChzKTtcclxuXHRcdHJldHVybiBpc05hTihtMikgPyBUaW1lLnBhcnNlX2FtcG1fdGV4dChzKSA6IG0yO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEZvcm1hdCBtaW51dGVzIC0+IFwiSEg6TU1cIiAyNGguXHJcblx0ICogQHBhcmFtIHtudW1iZXJ9IG1pbnV0ZXNcclxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9XHJcblx0ICovXHJcblx0VGltZS5mb3JtYXRfbWludXRlc18yNGggPSBmdW5jdGlvbiAobWludXRlcykge1xyXG5cdFx0dmFyIEggPSBNYXRoLmZsb29yKG1pbnV0ZXMgLyA2MCkgJSAyNDtcclxuXHRcdHZhciBNID0gbWludXRlcyAlIDYwO1xyXG5cdFx0dmFyIEhIID0gKEggPCAxMCA/ICcwJyArIEggOiAnJyArIEgpO1xyXG5cdFx0dmFyIE1NID0gKE0gPCAxMCA/ICcwJyArIE0gOiAnJyArIE0pO1xyXG5cdFx0cmV0dXJuIEhIICsgJzonICsgTU07XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRm9ybWF0IG1pbnV0ZXMgLT4gXCJoOk1NIEFNL1BNXCIuXHJcblx0ICogQHBhcmFtIHtudW1iZXJ9IG1pbnV0ZXNcclxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9XHJcblx0ICovXHJcblx0VGltZS5mb3JtYXRfbWludXRlc19hbXBtID0gZnVuY3Rpb24gKG1pbnV0ZXMpIHtcclxuXHRcdHZhciBIMjQgPSBNYXRoLmZsb29yKG1pbnV0ZXMgLyA2MCkgJSAyNDtcclxuXHRcdHZhciBNICAgPSBtaW51dGVzICUgNjA7XHJcblx0XHR2YXIgaXNfYW0gPSAoSDI0IDwgMTIpO1xyXG5cdFx0dmFyIGgxMiA9IEgyNCAlIDEyO1xyXG5cdFx0aWYgKGgxMiA9PT0gMCkgaDEyID0gMTI7XHJcblx0XHR2YXIgTU0gPSAoTSA8IDEwID8gJzAnICsgTSA6ICcnICsgTSk7XHJcblx0XHRyZXR1cm4gaDEyICsgJzonICsgTU0gKyAnICcgKyAoaXNfYW0gPyAnQU0nIDogJ1BNJyk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRXNjYXBlIGF0dHJpYnV0ZSB0ZXh0LlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB2XHJcblx0ICogQHJldHVybiB7c3RyaW5nfVxyXG5cdCAqL1xyXG5cdFRpbWUuZXNjX2F0dHIgPSBmdW5jdGlvbiAodikge1xyXG5cdFx0cmV0dXJuIFN0cmluZyh2KS5yZXBsYWNlKC8mL2csICcmYW1wOycpLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKS5yZXBsYWNlKC88L2csICcmbHQ7Jyk7XHJcblx0fTtcclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBpTWFzayBoZWxwZXJzICh1c2VkIGJ5IDI0aCB0ZXh0IGlucHV0cylcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHQvKipcclxuXHQgKiBBcHBseSBpTWFzayBcIkhIOk1NXCIgdG8gaW5wdXQuXHJcblx0ICogQHBhcmFtIHtIVE1MSW5wdXRFbGVtZW50fSBlbFxyXG5cdCAqL1xyXG5cdFRpbWUuYXBwbHlfaW1hc2tfdG9faW5wdXQgPSBmdW5jdGlvbiAoZWwpIHtcclxuXHRcdGlmICghSU1hc2sgfHwgIWVsKSByZXR1cm47XHJcblx0XHRpZiAoZWwuX2ltYXNrKSB7XHJcblx0XHRcdHRyeSB7IGVsLl9pbWFzay5kZXN0cm95KCk7IH0gY2F0Y2ggKGUpIHt9XHJcblx0XHRcdGVsLl9pbWFzayA9IG51bGw7XHJcblx0XHR9XHJcblx0XHRlbC5faW1hc2sgPSBJTWFzayhlbCwge1xyXG5cdFx0XHRtYXNrOiAnSEg6TU0nLFxyXG5cdFx0XHRibG9ja3M6IHtcclxuXHRcdFx0XHRISDogeyBtYXNrOiBJTWFzay5NYXNrZWRSYW5nZSwgZnJvbTogMCwgdG86IDIzLCBtYXhMZW5ndGg6IDIgfSxcclxuXHRcdFx0XHRNTTogeyBtYXNrOiBJTWFzay5NYXNrZWRSYW5nZSwgZnJvbTogMCwgdG86IDU5LCBtYXhMZW5ndGg6IDIgfVxyXG5cdFx0XHR9LFxyXG5cdFx0XHRsYXp5OiBmYWxzZVxyXG5cdFx0fSk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRGVzdHJveSBpTWFzayBpbnN0YW5jZSBpZiBwcmVzZW50LlxyXG5cdCAqIEBwYXJhbSB7SFRNTElucHV0RWxlbWVudH0gZWxcclxuXHQgKi9cclxuXHRUaW1lLmNsZWFyX2ltYXNrID0gZnVuY3Rpb24gKGVsKSB7XHJcblx0XHRpZiAoZWwgJiYgZWwuX2ltYXNrKSB7XHJcblx0XHRcdHRyeSB7IGVsLl9pbWFzay5kZXN0cm95KCk7IH0gY2F0Y2ggKGUpIHt9XHJcblx0XHRcdGVsLl9pbWFzayA9IG51bGw7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBOb2RlIGNvbnZlcnNpb246IHR5cGU9dGltZSA8LT4gbWFza2VkIHRleHRcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHQvKipcclxuXHQgKiBDb252ZXJ0IGEgc2luZ2xlIHN0YXJ0L2VuZCBpbnB1dCBub2RlIHRvICcyNGgnIChtYXNrZWQgdGV4dCkgb3IgJ2FtcG0nICh0eXBlPVwidGltZVwiKS5cclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXHJcblx0ICogQHBhcmFtIHsnMjRoJ3wnYW1wbSd9IHRvX2ZtdFxyXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSB2YWx1ZV9taW51dGVzXHJcblx0ICogQHJldHVybiB7SFRNTElucHV0RWxlbWVudH1cclxuXHQgKi9cclxuXHRUaW1lLmNvbnZlcnRfaW5wdXRfbm9kZV90b19mb3JtYXQgPSBmdW5jdGlvbiAobm9kZSwgdG9fZm10LCB2YWx1ZV9taW51dGVzKSB7XHJcblx0XHR2YXIgcGFyZW50ID0gbm9kZS5wYXJlbnROb2RlO1xyXG5cdFx0dmFyIGNscyAgICA9IG5vZGUuY2xhc3NOYW1lO1xyXG5cdFx0dmFyIGlzX3N0YXJ0ID0gbm9kZS5jbGFzc0xpc3QuY29udGFpbnMoJ3dwYmNfYmZiX19vcHQtc3RhcnQnKTtcclxuXHJcblx0XHR2YXIgbmV3X2VsO1xyXG5cdFx0aWYgKHRvX2ZtdCA9PT0gJzI0aCcpIHtcclxuXHRcdFx0bmV3X2VsICAgICAgICAgICA9IGQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcclxuXHRcdFx0bmV3X2VsLnR5cGUgICAgICA9ICd0ZXh0JztcclxuXHRcdFx0bmV3X2VsLmNsYXNzTmFtZSA9IGNscy5yZXBsYWNlKC9cXGJqcy1ydC1zdGFydC10aW1lXFxifFxcYmpzLXJ0LWVuZC10aW1lXFxiL2csICcnKS50cmltKCk7XHJcblx0XHRcdG5ld19lbC5jbGFzc0xpc3QuYWRkKCdqcy1ydC1tYXNrJyk7XHJcblx0XHRcdG5ld19lbC5zZXRBdHRyaWJ1dGUoJ2RhdGEtbWFzay1raW5kJywgJzI0aCcpO1xyXG5cdFx0XHRuZXdfZWwuc2V0QXR0cmlidXRlKCdwbGFjZWhvbGRlcicsICdISDpNTScpO1xyXG5cdFx0XHRuZXdfZWwudmFsdWUgPSBpc05hTih2YWx1ZV9taW51dGVzKSA/ICcnIDogVGltZS5mb3JtYXRfbWludXRlc18yNGgodmFsdWVfbWludXRlcyk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRuZXdfZWwgICAgICAgICAgID0gZC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xyXG5cdFx0XHRuZXdfZWwudHlwZSAgICAgID0gJ3RpbWUnO1xyXG5cdFx0XHRuZXdfZWwuc3RlcCAgICAgID0gJzMwMCc7XHJcblx0XHRcdG5ld19lbC5jbGFzc05hbWUgPSBjbHMucmVwbGFjZSgvXFxianMtcnQtbWFza1xcYi9nLCAnJykudHJpbSgpO1xyXG5cdFx0XHRuZXdfZWwuY2xhc3NMaXN0LmFkZChpc19zdGFydCA/ICdqcy1ydC1zdGFydC10aW1lJyA6ICdqcy1ydC1lbmQtdGltZScpO1xyXG5cdFx0XHQvLyA8aW5wdXQgdHlwZT1cInRpbWVcIj4gZXhwZWN0cyBcIkhIOk1NXCIgMjRoIHN0cmluZ1xyXG5cdFx0XHRuZXdfZWwudmFsdWUgPSBpc05hTih2YWx1ZV9taW51dGVzKSA/ICcnIDogVGltZS5mb3JtYXRfbWludXRlc18yNGgodmFsdWVfbWludXRlcyk7XHJcblx0XHR9XHJcblxyXG5cdFx0VGltZS5jbGVhcl9pbWFzayhub2RlKTtcclxuXHRcdHBhcmVudC5yZXBsYWNlQ2hpbGQobmV3X2VsLCBub2RlKTtcclxuXHRcdHJldHVybiBuZXdfZWw7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogUmVidWlsZCBib3RoIHN0YXJ0L2VuZCBpbnB1dHMgaW5zaWRlIGEgcm93IHRvIHRhcmdldCBmb3JtYXQuXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm93XHJcblx0ICogQHBhcmFtIHsnMjRoJ3wnYW1wbSd9IHRvX2ZtdFxyXG5cdCAqL1xyXG5cdFRpbWUucmVidWlsZF9yb3dfaW5wdXRzX3RvX2Zvcm1hdCA9IGZ1bmN0aW9uIChyb3csIHRvX2ZtdCkge1xyXG5cdFx0dmFyIHNfZWwgPSByb3cucXVlcnlTZWxlY3RvcignLndwYmNfYmZiX19vcHQtc3RhcnQnKTtcclxuXHRcdHZhciBlX2VsID0gcm93LnF1ZXJ5U2VsZWN0b3IoJy53cGJjX2JmYl9fb3B0LWVuZCcpO1xyXG5cdFx0aWYgKCFzX2VsIHx8ICFlX2VsKSByZXR1cm47XHJcblxyXG5cdFx0dmFyIHNfbSA9IFRpbWUucGFyc2VfbWludXRlcyhzX2VsLnZhbHVlKTtcclxuXHRcdHZhciBlX20gPSBUaW1lLnBhcnNlX21pbnV0ZXMoZV9lbC52YWx1ZSk7XHJcblxyXG5cdFx0dmFyIHNfbmV3ID0gVGltZS5jb252ZXJ0X2lucHV0X25vZGVfdG9fZm9ybWF0KHNfZWwsIHRvX2ZtdCwgc19tKTtcclxuXHRcdHZhciBlX25ldyA9IFRpbWUuY29udmVydF9pbnB1dF9ub2RlX3RvX2Zvcm1hdChlX2VsLCB0b19mbXQsIGVfbSk7XHJcblxyXG5cdFx0aWYgKHRvX2ZtdCA9PT0gJzI0aCcpIHtcclxuXHRcdFx0VGltZS5hcHBseV9pbWFza190b19pbnB1dChzX25ldyk7XHJcblx0XHRcdFRpbWUuYXBwbHlfaW1hc2tfdG9faW5wdXQoZV9uZXcpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0VGltZS5jbGVhcl9pbWFzayhzX25ldyk7XHJcblx0XHRcdFRpbWUuY2xlYXJfaW1hc2soZV9uZXcpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlYnVpbGQgYWxsIHJvd3MgdW5kZXIgY29udGFpbmVyIHRvIHRhcmdldCBmb3JtYXQuXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY29udGFpbmVyXHJcblx0ICogQHBhcmFtIHsnMjRoJ3wnYW1wbSd9IHRvX2ZtdFxyXG5cdCAqL1xyXG5cdFRpbWUucmVidWlsZF9hbGxfcm93c190b19mb3JtYXQgPSBmdW5jdGlvbiAoY29udGFpbmVyLCB0b19mbXQpIHtcclxuXHRcdGlmICghY29udGFpbmVyKSByZXR1cm47XHJcblx0XHRjb250YWluZXIucXVlcnlTZWxlY3RvckFsbCgnLndwYmNfYmZiX19vcHRpb25zX3JvdycpLmZvckVhY2goZnVuY3Rpb24gKHJvdykge1xyXG5cdFx0XHRUaW1lLnJlYnVpbGRfcm93X2lucHV0c190b19mb3JtYXQocm93LCB0b19mbXQpO1xyXG5cdFx0fSk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogQXBwbHkgaU1hc2sgdG8gYWxsIDI0aC1tYXNrZWQgaW5wdXRzIHdpdGhpbiBjb250YWluZXIuXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY29udGFpbmVyXHJcblx0ICovXHJcblx0VGltZS5hcHBseV9pbWFza19pbl9jb250YWluZXJfMjRoID0gZnVuY3Rpb24gKGNvbnRhaW5lcikge1xyXG5cdFx0aWYgKCAhSU1hc2sgfHwgIWNvbnRhaW5lciApIHJldHVybjtcclxuXHRcdGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCAnaW5wdXRbZGF0YS1tYXNrLWtpbmQ9XCIyNGhcIl0nICkuZm9yRWFjaCggZnVuY3Rpb24gKGVsKSB7XHJcblx0XHRcdFRpbWUuYXBwbHlfaW1hc2tfdG9faW5wdXQoIGVsICk7XHJcblx0XHR9ICk7XHJcblx0fTtcclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBTbG90IGdlbmVyYXRpb25cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHQvKipcclxuXHQgKiBCdWlsZCBzbG90czogW3tsYWJlbCwgdmFsdWUsIHNlbGVjdGVkOmZhbHNlfSwgLi4uXVxyXG5cdCAqIE5vdGU6IGdlbmVyYXRpb24gZXhwZWN0cyBlbmQgPiBzdGFydC4gKE92ZXJuaWdodCByYW5nZXMgYXJlIGVudGVyZWQgbWFudWFsbHkgdmlhIGVkaXRvci4pXHJcblx0ICogQHBhcmFtIHtudW1iZXJ9IHN0YXJ0X21pbnV0ZXNcclxuXHQgKiBAcGFyYW0ge251bWJlcn0gZW5kX21pbnV0ZXNcclxuXHQgKiBAcGFyYW0ge251bWJlcn0gc3RlcF9taW51dGVzXHJcblx0ICogQHBhcmFtIHsnMjRoJ3wnYW1wbSd9IGxhYmVsX2ZtdFxyXG5cdCAqIEByZXR1cm4ge0FycmF5PHtsYWJlbDpzdHJpbmcsdmFsdWU6c3RyaW5nLHNlbGVjdGVkOmJvb2xlYW59Pn1cclxuXHQgKi9cclxuXHRUaW1lLmJ1aWxkX3RpbWVfc2xvdHMgPSBmdW5jdGlvbiAoc3RhcnRfbWludXRlcywgZW5kX21pbnV0ZXMsIHN0ZXBfbWludXRlcywgbGFiZWxfZm10KSB7XHJcblx0XHRpZiAoaXNOYU4oc3RhcnRfbWludXRlcykgfHwgaXNOYU4oZW5kX21pbnV0ZXMpIHx8IGlzTmFOKHN0ZXBfbWludXRlcykpIHJldHVybiBbXTtcclxuXHRcdGlmIChlbmRfbWludXRlcyA8PSBzdGFydF9taW51dGVzIHx8IHN0ZXBfbWludXRlcyA8PSAwKSByZXR1cm4gW107XHJcblx0XHR2YXIgb3V0ID0gW107XHJcblx0XHRmb3IgKHZhciB0ID0gc3RhcnRfbWludXRlczsgKHQgKyBzdGVwX21pbnV0ZXMpIDw9IGVuZF9taW51dGVzOyB0ICs9IHN0ZXBfbWludXRlcykge1xyXG5cdFx0XHR2YXIgdDIgID0gdCArIHN0ZXBfbWludXRlcztcclxuXHRcdFx0dmFyIHYxICA9IFRpbWUuZm9ybWF0X21pbnV0ZXNfMjRoKHQpO1xyXG5cdFx0XHR2YXIgdjIgID0gVGltZS5mb3JtYXRfbWludXRlc18yNGgodDIpO1xyXG5cdFx0XHR2YXIgbDEgID0gKGxhYmVsX2ZtdCA9PT0gJzI0aCcpID8gdjEgOiBUaW1lLmZvcm1hdF9taW51dGVzX2FtcG0odCk7XHJcblx0XHRcdHZhciBsMiAgPSAobGFiZWxfZm10ID09PSAnMjRoJykgPyB2MiA6IFRpbWUuZm9ybWF0X21pbnV0ZXNfYW1wbSh0Mik7XHJcblx0XHRcdG91dC5wdXNoKHsgbGFiZWw6IGwxICsgJyAtICcgKyBsMiwgdmFsdWU6IHYxICsgJyAtICcgKyB2Miwgc2VsZWN0ZWQ6IGZhbHNlIH0pO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIG91dDtcclxuXHR9O1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEdsb2JhbCBcInRpbWUtc2xvdCBwaWNrZXJcIiBmbGFnIGhlbHBlcnNcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHQvKipcclxuXHQgKiBSZWFkIGdsb2JhbCB0aW1lLXNsb3QgcGlja2VyIGZsYWcgKHNhdmVkIHZpYSBfd3BiYyBvdGhlciBwYXJhbXMpLlxyXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59XHJcblx0ICovXHJcblx0VGltZS5yZWFkX3BpY2tlcl9lbmFibGVkID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0dHJ5IHtcclxuXHRcdFx0aWYgKCEody5fd3BiYyAmJiB0eXBlb2Ygdy5fd3BiYy5nZXRfb3RoZXJfcGFyYW0gPT09ICdmdW5jdGlvbicpKSByZXR1cm4gZmFsc2U7XHJcblx0XHRcdHJldHVybiBUaW1lLmNvZXJjZV90b19ib29sKHcuX3dwYmMuZ2V0X290aGVyX3BhcmFtKCdpc19lbmFibGVkX2Jvb2tpbmdfdGltZXNsb3RfcGlja2VyJykpO1xyXG5cdFx0fSBjYXRjaCAoZSkgeyByZXR1cm4gZmFsc2U7IH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBQZXJzaXN0IGdsb2JhbCB0aW1lLXNsb3QgcGlja2VyIGZsYWcuXHJcblx0ICogQHBhcmFtIHtib29sZWFufSBlbmFibGVkXHJcblx0ICovXHJcblx0VGltZS5zZXRfcGlja2VyX2VuYWJsZWQgPSBmdW5jdGlvbiAoZW5hYmxlZCkge1xyXG5cdFx0dHJ5IHtcclxuXHRcdFx0aWYgKHcuX3dwYmMgJiYgdHlwZW9mIHcuX3dwYmMuc2V0X290aGVyX3BhcmFtID09PSAnZnVuY3Rpb24nKSB7XHJcblx0XHRcdFx0dy5fd3BiYy5zZXRfb3RoZXJfcGFyYW0oJ2lzX2VuYWJsZWRfYm9va2luZ190aW1lc2xvdF9waWNrZXInLCAhIWVuYWJsZWQpO1xyXG5cdFx0XHR9XHJcblx0XHR9IGNhdGNoIChlKSB7fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldCB0b2dnbGUgKyBoaWRlL3Nob3cgcGxhY2Vob2xkZXIgcm93IHdpdGhpbiBhIHNpbmdsZSBJbnNwZWN0b3IgcGFuZWwuXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcGFuZWxcclxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZWRcclxuXHQgKi9cclxuXHRUaW1lLnVpX3NldF9waWNrZXJfdG9nZ2xlX2Zvcl9wYW5lbCA9IGZ1bmN0aW9uIChwYW5lbCwgZW5hYmxlZCkge1xyXG5cdFx0aWYgKCFwYW5lbCkgcmV0dXJuO1xyXG5cdFx0dmFyIGNoayA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy5qcy10b2dnbGUtdGltZXNsb3QtcGlja2VyJyk7XHJcblx0XHRpZiAoY2hrKSBjaGsuY2hlY2tlZCA9ICEhZW5hYmxlZDtcclxuXHJcblx0XHR2YXIgcGhSb3cgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcuanMtcGxhY2Vob2xkZXItcm93Jyk7XHJcblx0XHRpZiAocGhSb3cpIHtcclxuXHRcdFx0aWYgKGVuYWJsZWQpIHsgcGhSb3cuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgcGhSb3cuaGlkZGVuID0gdHJ1ZTsgfVxyXG5cdFx0XHRlbHNlIHsgcGhSb3cuc3R5bGUuZGlzcGxheSA9ICcnOyBwaFJvdy5oaWRkZW4gPSBmYWxzZTsgfVxyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFwcGx5IHBpY2tlciBmbGFnIHRvIGFsbCBvcGVuIFRpbWUgaW5zcGVjdG9ycy5cclxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZWRcclxuXHQgKi9cclxuXHRUaW1lLnVpX2FwcGx5X3BpY2tlcl9lbmFibGVkX3RvX2FsbCA9IGZ1bmN0aW9uIChlbmFibGVkKSB7XHJcblx0XHRkLnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2luc3BlY3Rvcl90aW1lcGlja2VyJyApLmZvckVhY2goIGZ1bmN0aW9uIChwYW5lbCkge1xyXG5cdFx0XHQvLyBTZXQgdG9nZ2xlICsgaGlkZS9zaG93IHBsYWNlaG9sZGVyIHJvdyB3aXRoaW4gYSBzaW5nbGUgSW5zcGVjdG9yIHBhbmVsLlxyXG5cdFx0XHRUaW1lLnVpX3NldF9waWNrZXJfdG9nZ2xlX2Zvcl9wYW5lbCggcGFuZWwsIGVuYWJsZWQgKTtcclxuXHRcdH0gKTtcclxuXHR9O1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIERlYm91bmNlZCBpbml0IGZvciBleHRlcm5hbCB0aW1lIHNlbGVjdG9yIChjYW52YXMgcHJldmlldylcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHQvKipcclxuXHQgKiBEZWJvdW5jZWQgY2FsbCB0byBnbG9iYWwgaW5pdGlhbGl6ZXIgKGlmIHByZXNlbnQpOiB3cGJjX2hvb2tfX2luaXRfdGltZXNlbGVjdG9yKClcclxuXHQgKi9cclxuXHRUaW1lLnNjaGVkdWxlX2luaXRfdGltZXNlbGVjdG9yID0gKGZ1bmN0aW9uICgpIHtcclxuXHRcdGxldCBzY2hlZHVsZWQgPSBmYWxzZTtcclxuXHRcdGxldCB0aWQgPSBudWxsO1xyXG5cdFx0Y29uc3QgREVMQVkgPSAzMDtcclxuXHRcdHJldHVybiBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGlmIChzY2hlZHVsZWQpIHJldHVybjtcclxuXHRcdFx0c2NoZWR1bGVkID0gdHJ1ZTtcclxuXHRcdFx0Y2xlYXJUaW1lb3V0KHRpZCk7XHJcblx0XHRcdHRpZCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gcnVuKCkge1xyXG5cdFx0XHRcdHNjaGVkdWxlZCA9IGZhbHNlO1xyXG5cdFx0XHRcdGlmICghZC5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX3ByZXZpZXctdGltZXBpY2tlcicpKSByZXR1cm47XHJcblx0XHRcdFx0aWYgKHR5cGVvZiB3LndwYmNfaG9va19faW5pdF90aW1lc2VsZWN0b3IgPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdHcuX193cGJjX3J0X21vX3BhdXNlICYmIHcuX193cGJjX3J0X21vX3BhdXNlKCk7XHJcblx0XHRcdFx0XHRcdHcuX193cGJjX3N0X21vX3BhdXNlICYmIHcuX193cGJjX3N0X21vX3BhdXNlKCk7XHJcblx0XHRcdFx0XHRcdHcud3BiY19ob29rX19pbml0X3RpbWVzZWxlY3RvcigpO1xyXG5cdFx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7Lyogbm8tb3AgKi9cclxuXHRcdFx0XHRcdH0gZmluYWxseSB7XHJcblx0XHRcdFx0XHRcdHcuX193cGJjX3J0X21vX3Jlc3VtZSAmJiB3Ll9fd3BiY19ydF9tb19yZXN1bWUoKTtcclxuXHRcdFx0XHRcdFx0dy5fX3dwYmNfc3RfbW9fcmVzdW1lICYmIHcuX193cGJjX3N0X21vX3Jlc3VtZSgpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgREVMQVkgKTtcclxuXHRcdH07XHJcblx0fSkoKTtcclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIE1pcnJvciB0byBTZXR0aW5ncyBVSSB3aXRob3V0IGZpcmluZyBET00gJ2NoYW5nZScgKGxvb3Atc2FmZSkuXHJcblx0ICovXHJcblx0VGltZS5taXJyb3Jfc2V0dGluZ3NfdG9nZ2xlID0gZnVuY3Rpb24gKGVuYWJsZWQpIHtcclxuXHRcdHdwYmNfYmZiX19kaXNwYXRjaF9ldmVudF9zYWZlKFxyXG5cdFx0XHQnd3BiYzpiZmI6c2V0dGluZ3M6c2V0JyxcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGtleSAgIDogJ2Jvb2tpbmdfdGltZXNsb3RfcGlja2VyJyxcclxuXHRcdFx0XHR2YWx1ZSA6IGVuYWJsZWQgPyAnT24nIDogJ09mZicsXHJcblx0XHRcdFx0c291cmNlOiAndGltZS11dGlscydcclxuXHRcdFx0fVxyXG5cdFx0KTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBQcmV2aWV3IHJlZnJlc2ggZm9yIHRpbWUtc2xvdCBwaWNrZXIgdG9nZ2xlLlxyXG5cdCAqIC0gT046IGp1c3QgaW5pdCBleHRlcm5hbCB0aW1lIHNlbGVjdG9yLlxyXG5cdCAqIC0gT0ZGOiB0ZWFyZG93biB3aWRnZXRzIGFuZCB1bmhpZGUgPHNlbGVjdD4gY29udHJvbHMsIHRoZW4gc29mdCByZS1yZW5kZXIgKG5vIHJlYnVpbGQpLlxyXG5cdCAqL1xyXG5cdFRpbWUuc3luY19wcmV2aWV3X2FmdGVyX2ZsYWcgPSBmdW5jdGlvbiAoZW5hYmxlZCkge1xyXG5cdFx0aWYgKCBlbmFibGVkICkge1xyXG5cdFx0XHRUaW1lLnNjaGVkdWxlX2luaXRfdGltZXNlbGVjdG9yKCk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdHRyeSB7XHJcblx0XHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY190aW1lc19zZWxlY3RvcicgKS5mb3JFYWNoKCBmdW5jdGlvbiAoZWwpIHtcclxuXHRcdFx0XHRpZiAoIGVsLnBhcmVudE5vZGUgKSBlbC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKCBlbCApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXHJcblx0XHRcdFx0Jy53cGJjX2JmYl9fcHJldmlldy1zZWxlY3Qud3BiY19iZmJfX3ByZXZpZXctcmFuZ2V0aW1lLCcgK1xyXG5cdFx0XHRcdCdzZWxlY3RbbmFtZV49XCJyYW5nZXRpbWVcIl0sIHNlbGVjdFtuYW1lXj1cInN0YXJ0dGltZVwiXSwgc2VsZWN0W25hbWVePVwiZW5kdGltZVwiXSwgc2VsZWN0W25hbWVePVwiZHVyYXRpb250aW1lXCJdJ1xyXG5cdFx0XHQpLmZvckVhY2goIGZ1bmN0aW9uIChzKSB7XHJcblx0XHRcdFx0cy5zdHlsZS5yZW1vdmVQcm9wZXJ0eSggJ2Rpc3BsYXknICk7XHJcblx0XHRcdFx0cy5oaWRkZW4gPSBmYWxzZTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHR9XHJcblx0XHRpZiAoIHdpbmRvdy5XUEJDX0JGQl9TZXR0aW5ncyAmJiB0eXBlb2Ygd2luZG93LldQQkNfQkZCX1NldHRpbmdzLndoZW5fYnVpbGRlcl9yZWFkeSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0d2luZG93LldQQkNfQkZCX1NldHRpbmdzLndoZW5fYnVpbGRlcl9yZWFkeSggZnVuY3Rpb24gKGIpIHtcclxuXHRcdFx0XHRpZiAoICFiIHx8ICFiLnByZXZpZXdfbW9kZSApIHJldHVybjtcclxuXHRcdFx0XHRpZiAoIHR5cGVvZiBiLnJlZnJlc2hfY2FudmFzID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0Yi5yZWZyZXNoX2NhbnZhcygge1xyXG5cdFx0XHRcdFx0XHRoYXJkICAgICAgICAgICAgIDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0cmVidWlsZCAgICAgICAgICA6IGZhbHNlLCAgIC8vIGNyaXRpY2FsOiBubyBsb2FkX3NhdmVkX3N0cnVjdHVyZSgpXHJcblx0XHRcdFx0XHRcdHJlaW5pdCAgICAgICAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRcdFx0cmVzdG9yZV9zZWxlY3Rpb246IHRydWUsXHJcblx0XHRcdFx0XHRcdHJlc3RvcmVfc2Nyb2xsICAgOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRzaWxlbnRfaW5zcGVjdG9yIDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0c291cmNlICAgICAgICAgICA6ICdzZXR0aW5nczp0aW1lc2xvdCdcclxuXHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKCB0eXBlb2YgYi5yZW5kZXJfcHJldmlld19hbGwgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRiLnJlbmRlcl9wcmV2aWV3X2FsbCgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIE9uZS1jYWxsIHVuaXZlcnNhbCBzZXR0ZXIgdXNlZCBieSBTZXR0aW5ncyArIGFsbCB0aW1lLWZpZWxkIGluc3BlY3RvcnMuXHJcblx0ICovXHJcblx0VGltZS5zZXRfZ2xvYmFsX3RpbWVzbG90X3BpY2tlciA9IGZ1bmN0aW9uIChlbmFibGVkLCBvcHRzKSB7XHJcblx0XHRvcHRzID0gb3B0cyB8fCB7fTtcclxuXHRcdFRpbWUuc2V0X3BpY2tlcl9lbmFibGVkKCBlbmFibGVkICk7ICAgICAgICAgICAgICAgICAvLyBwZXJzaXN0IGluLW1lbW9yeSBmbGFnXHJcblx0XHRUaW1lLnVpX2FwcGx5X3BpY2tlcl9lbmFibGVkX3RvX2FsbCggZW5hYmxlZCApOyAgICAgLy8gc3luYyBhbGwgb3BlbiBpbnNwZWN0b3JzXHJcblx0XHRpZiAoIG9wdHMubWlycm9yX3NldHRpbmdzICE9PSBmYWxzZSApIHtcclxuXHRcdFx0VGltZS5taXJyb3Jfc2V0dGluZ3NfdG9nZ2xlKCBlbmFibGVkICk7ICAgICAgICAgICAvLyBtaXJyb3IgU2V0dGluZ3MgdG9nZ2xlIChubyAnY2hhbmdlJyBldmVudClcclxuXHRcdH1cclxuXHRcdGlmICggb3B0cy5yZWZyZXNoX3ByZXZpZXcgIT09IGZhbHNlICkge1xyXG5cdFx0XHRUaW1lLnN5bmNfcHJldmlld19hZnRlcl9mbGFnKCBlbmFibGVkICk7ICAgICAgICAgIC8vIHNhZmUgcHJldmlldyByZWZyZXNoXHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBHbG9iYWwgYmluZGVyOiBzZWxlY3QgdnMuIHRpbWUgcGlja2VyIHRvZ2dsZSAoT05FLVRJTUUsIHNoYXJlZCBieSBhbGwgdGltZS1iYXNlZCBwYWNrcylcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHQvKipcclxuXHQgKiBCaW5kIG9uY2UgdG86XHJcblx0ICogIC0gaW5pdGlhbGl6ZSBhbGwgb3BlbiBJbnNwZWN0b3IgcGFuZWxzIHdpdGggdGhlIGN1cnJlbnQgZ2xvYmFsIGZsYWcsXHJcblx0ICogIC0gcmVhY3QgdG8gbmV3bHkgYWRkZWQgSW5zcGVjdG9yIHBhbmVscyB2aWEgTXV0YXRpb25PYnNlcnZlcixcclxuXHQgKiAgLSBwZXJzaXN0IGFuZCBicm9hZGNhc3QgY2hhbmdlcyB3aGVuIHRoZSBcIlNob3cgYXMgdGltZSBwaWNrZXJcIiBjaGVja2JveCB0b2dnbGVzLlxyXG5cdCAqL1xyXG5cdFRpbWUuZW5zdXJlX2dsb2JhbF90aW1lcGlja2VyX3RvZ2dsZV9iaW5kZXIgPSBmdW5jdGlvbiAoKSB7XHJcblxyXG5cdFx0aWYgKFRpbWUuX190b2dnbGVCaW5kZXJCb3VuZCkgcmV0dXJuO1xyXG5cdFx0VGltZS5fX3RvZ2dsZUJpbmRlckJvdW5kID0gdHJ1ZTtcclxuXHJcblx0XHQvLyAxKSBJbml0IGFsbCBjdXJyZW50bHkgb3BlbiBwYW5lbHNcclxuXHRcdGZ1bmN0aW9uIGluaXRfYWxsX3BhbmVscygpIHtcclxuXHRcdFx0VGltZS51aV9hcHBseV9waWNrZXJfZW5hYmxlZF90b19hbGwoVGltZS5yZWFkX3BpY2tlcl9lbmFibGVkKCkpO1xyXG5cdFx0fVxyXG5cdFx0KGQucmVhZHlTdGF0ZSA9PT0gJ2xvYWRpbmcnKVxyXG5cdFx0XHQ/IGQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIGluaXRfYWxsX3BhbmVscylcclxuXHRcdFx0OiBpbml0X2FsbF9wYW5lbHMoKTtcclxuXHJcblx0XHQvLyAyKSBPYnNlcnZlIEluc3BlY3RvciBwYW5lbHMgdGhhdCBhcHBlYXIgbGF0ZXJcclxuXHRcdHRyeSB7XHJcblx0XHRcdHZhciBtbyA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKGZ1bmN0aW9uIChtdXRzKSB7XHJcblx0XHRcdFx0dmFyIGVuYWJsZWQgPSBUaW1lLnJlYWRfcGlja2VyX2VuYWJsZWQoKTtcclxuXHRcdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IG11dHMubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0XHRcdHZhciBtID0gbXV0c1tpXTtcclxuXHRcdFx0XHRcdGZvciAodmFyIGogPSAwOyBqIDwgbS5hZGRlZE5vZGVzLmxlbmd0aDsgaisrKSB7XHJcblx0XHRcdFx0XHRcdHZhciBuID0gbS5hZGRlZE5vZGVzW2pdO1xyXG5cdFx0XHRcdFx0XHRpZiAoIW4gfHwgbi5ub2RlVHlwZSAhPT0gMSkgY29udGludWU7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAobi5tYXRjaGVzICYmIG4ubWF0Y2hlcygnLndwYmNfYmZiX19pbnNwZWN0b3JfdGltZXBpY2tlcicpKSB7XHJcblx0XHRcdFx0XHRcdFx0dHJ5IHsgVGltZS51aV9zZXRfcGlja2VyX3RvZ2dsZV9mb3JfcGFuZWwobiwgZW5hYmxlZCk7IH0gY2F0Y2ggKGUpIHt9XHJcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAobi5xdWVyeVNlbGVjdG9yKSB7XHJcblx0XHRcdFx0XHRcdFx0bi5xdWVyeVNlbGVjdG9yQWxsKCcud3BiY19iZmJfX2luc3BlY3Rvcl90aW1lcGlja2VyJykuZm9yRWFjaChmdW5jdGlvbiAocGFuZWwpIHtcclxuXHRcdFx0XHRcdFx0XHRcdHRyeSB7IFRpbWUudWlfc2V0X3BpY2tlcl90b2dnbGVfZm9yX3BhbmVsKHBhbmVsLCBlbmFibGVkKTsgfSBjYXRjaCAoZSkge31cclxuXHRcdFx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblx0XHRcdG1vLm9ic2VydmUoZC5ib2R5LCB7IGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9KTtcclxuXHRcdFx0Ly8gT3B0aW9uYWwgcGF1c2UvcmVzdW1lIGhvb2tzIGlmIG90aGVyIG1vZHVsZXMgd2FudCB0byBzdXNwZW5kIG9ic2VydmVycyB0ZW1wb3JhcmlseTpcclxuXHRcdFx0dy5fX3dwYmNfdGltZXBpY2tlcl90b2dnbGVfbW9fcGF1c2UgID0gZnVuY3Rpb24oKXsgdHJ5IHsgbW8uZGlzY29ubmVjdCgpOyB9IGNhdGNoKGUpe30gfTtcclxuXHRcdFx0dy5fX3dwYmNfdGltZXBpY2tlcl90b2dnbGVfbW9fcmVzdW1lID0gZnVuY3Rpb24oKXtcclxuXHRcdFx0XHR0cnkgeyBtby5vYnNlcnZlKGQuYm9keSwgeyBjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUgfSk7IH0gY2F0Y2goZSl7fVxyXG5cdFx0XHR9O1xyXG5cdFx0fSBjYXRjaCAoZSkge31cclxuXHJcblx0XHQvLyAzKSBDaGVja2JveCBoYW5kbGVyIChkZWxlZ2F0ZWQpXHJcblx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGZ1bmN0aW9uIChldikge1xyXG5cdFx0XHR2YXIgdCA9IGV2LnRhcmdldDtcclxuXHRcdFx0aWYgKCF0IHx8ICF0LmNsYXNzTGlzdCB8fCAhdC5jbGFzc0xpc3QuY29udGFpbnMoJ2pzLXRvZ2dsZS10aW1lc2xvdC1waWNrZXInKSkgcmV0dXJuO1xyXG5cclxuXHRcdFx0dmFyIGVuYWJsZWQgPSAhIXQuY2hlY2tlZDtcclxuXHRcdFx0VGltZS5zZXRfZ2xvYmFsX3RpbWVzbG90X3BpY2tlciggZW5hYmxlZCwgeyBzb3VyY2U6ICdpbnNwZWN0b3InIH0gKTtcclxuXHRcdH0pO1xyXG5cdH07XHJcblxyXG5cdC8vIEF1dG8tYmluZCBvbiBzY3JpcHQgbG9hZC5cclxuXHR0cnkgeyBUaW1lLmVuc3VyZV9nbG9iYWxfdGltZXBpY2tlcl90b2dnbGVfYmluZGVyKCk7IH0gY2F0Y2ggKGUpIHt9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gQnVpbGRlciBjYW52YXMgcmVmcmVzaCBob29rcyAobW92ZWQgb3V0IG9mIGJmYi1idWlsZGVyLmpzKVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdC8qKlxyXG5cdCAqIEJpbmQgcGF1c2UvcmVzdW1lIGhvb2tzIHRvIEJ1aWxkZXIgY2FudmFzIHJlZnJlc2ggZXZlbnRzLlxyXG5cdCAqXHJcblx0ICogV2h5IGhlcmU6XHJcblx0ICogLSBUaGlzIG1vZHVsZSBvd25zIHRoZSB0aW1lcGlja2VyLXRvZ2dsZSBNdXRhdGlvbk9ic2VydmVyIGFuZCB0aW1lIHNlbGVjdG9yIGluaXQuXHJcblx0ICogLSBCdWlsZGVyIHNob3VsZCBub3Qga25vdyBhYm91dCBwYWNrLXNwZWNpZmljIG9ic2VydmVycy5cclxuXHQgKlxyXG5cdCAqIFNhZmV0eTpcclxuXHQgKiAtIElkZW1wb3RlbnQgKGJpbmRzIG9uY2UpLlxyXG5cdCAqIC0gV2FpdHMgZm9yIHdwYmNfYmZiX2FwaS5yZWFkeS5cclxuXHQgKiAtIE5vIGhhcmQgZGVwZW5kZW5jeTogaWYgYnVpbGRlci9idXMvZXZlbnRzIGFyZSBhYnNlbnQsIGl0IHNpbGVudGx5IG5vLW9wcy5cclxuXHQgKlxyXG5cdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdCAqL1xyXG5cdFRpbWUuZW5zdXJlX2J1aWxkZXJfY2FudmFzX3JlZnJlc2hfaG9va3MgPSBmdW5jdGlvbiAoKSB7XHJcblxyXG5cdFx0aWYgKCBUaW1lLl9fYnVpbGRlcl9jYW52YXNfcmVmcmVzaF9ob29rc19ib3VuZCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0VGltZS5fX2J1aWxkZXJfY2FudmFzX3JlZnJlc2hfaG9va3NfYm91bmQgPSB0cnVlO1xyXG5cclxuXHRcdC8vIEJ1aWxkZXIgQVBJIG11c3QgZXhpc3QuXHJcblx0XHRpZiAoICF3LndwYmNfYmZiX2FwaSB8fCAhdy53cGJjX2JmYl9hcGkucmVhZHkgfHwgKHR5cGVvZiB3LndwYmNfYmZiX2FwaS5yZWFkeS50aGVuICE9PSAnZnVuY3Rpb24nKSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHcud3BiY19iZmJfYXBpLnJlYWR5LnRoZW4oIGZ1bmN0aW9uIChidWlsZGVyKSB7XHJcblxyXG5cdFx0XHQvLyBCdWlsZGVyIG1pZ2h0IHJlc29sdmUgbnVsbCAodGltZW91dCkg4oCTIGp1c3QgaWdub3JlLlxyXG5cdFx0XHRpZiAoICFidWlsZGVyIHx8ICFidWlsZGVyLmJ1cyB8fCAodHlwZW9mIGJ1aWxkZXIuYnVzLm9uICE9PSAnZnVuY3Rpb24nKSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBFVlMgICAgICAgPSAody5XUEJDX0JGQl9Db3JlICYmIHcuV1BCQ19CRkJfQ29yZS5XUEJDX0JGQl9FdmVudHMpID8gdy5XUEJDX0JGQl9Db3JlLldQQkNfQkZCX0V2ZW50cyA6IHt9O1xyXG5cdFx0XHR2YXIgRVZfQkVGT1JFID0gRVZTLkNBTlZBU19SRUZSRVNIIHx8ICd3cGJjOmJmYjpjYW52YXMtcmVmcmVzaCc7XHJcblx0XHRcdHZhciBFVl9BRlRFUiAgPSBFVlMuQ0FOVkFTX1JFRlJFU0hFRCB8fCAnd3BiYzpiZmI6Y2FudmFzLXJlZnJlc2hlZCc7XHJcblxyXG5cdFx0XHQvLyBCRUZPUkUgcmVmcmVzaDogcGF1c2Ugb2JzZXJ2ZXJzIHRvIGF2b2lkIGxvb3BzIC8gZXh0cmEgd29yayB3aGlsZSBET00gaXMgYmVpbmcgcmVidWlsdC5cclxuXHRcdFx0YnVpbGRlci5idXMub24oIEVWX0JFRk9SRSwgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiB3Ll9fd3BiY19ydF9tb19wYXVzZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0dy5fX3dwYmNfcnRfbW9fcGF1c2UoKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdGlmICggdHlwZW9mIHcuX193cGJjX3N0X21vX3BhdXNlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHR3Ll9fd3BiY19zdF9tb19wYXVzZSgpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0aWYgKCB0eXBlb2Ygdy5fX3dwYmNfdGltZXBpY2tlcl90b2dnbGVfbW9fcGF1c2UgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdHcuX193cGJjX3RpbWVwaWNrZXJfdG9nZ2xlX21vX3BhdXNlKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHQvLyBBRlRFUiByZWZyZXNoOiByZXN1bWUgYW5kIChpZiBuZWVkZWQpIHJlLWluaXQgdGltZXNlbGVjdG9yIHdpZGdldHMuXHJcblx0XHRcdGJ1aWxkZXIuYnVzLm9uKCBFVl9BRlRFUiwgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiB3Ll9fd3BiY19ydF9tb19yZXN1bWUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdHcuX193cGJjX3J0X21vX3Jlc3VtZSgpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0aWYgKCB0eXBlb2Ygdy5fX3dwYmNfc3RfbW9fcmVzdW1lID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHR3Ll9fd3BiY19zdF9tb19yZXN1bWUoKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdGlmICggdHlwZW9mIHcuX193cGJjX3RpbWVwaWNrZXJfdG9nZ2xlX21vX3Jlc3VtZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0dy5fX3dwYmNfdGltZXBpY2tlcl90b2dnbGVfbW9fcmVzdW1lKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBJZiB0aW1lLXNsb3QgcGlja2VyIGlzIGVuYWJsZWQgYW5kIGJ1aWxkZXIgaXMgaW4gcHJldmlldyBtb2RlLCByZS1pbml0IHRoZSB0aW1lIHNlbGVjdG9yIFVJLlxyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRpZiAoIGJ1aWxkZXIucHJldmlld19tb2RlICYmIHR5cGVvZiBUaW1lLnJlYWRfcGlja2VyX2VuYWJsZWQgPT09ICdmdW5jdGlvbicgJiYgVGltZS5yZWFkX3BpY2tlcl9lbmFibGVkKCkgKSB7XHJcblx0XHRcdFx0XHRcdGlmICggdHlwZW9mIFRpbWUuc2NoZWR1bGVfaW5pdF90aW1lc2VsZWN0b3IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdFx0VGltZS5zY2hlZHVsZV9pbml0X3RpbWVzZWxlY3RvcigpO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0fSApO1xyXG5cdH07XHJcblxyXG5cdC8vIENhbGwgb25jZSBvbiBsb2FkLlxyXG5cdHRyeSB7XHJcblx0XHRUaW1lLmVuc3VyZV9idWlsZGVyX2NhbnZhc19yZWZyZXNoX2hvb2tzKCk7XHJcblx0fSBjYXRjaCAoIGUgKSB7XHJcblx0fVxyXG5cclxuXHJcbn0pKHdpbmRvdywgZG9jdW1lbnQpO1xyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSxDQUFDLFVBQVVB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
