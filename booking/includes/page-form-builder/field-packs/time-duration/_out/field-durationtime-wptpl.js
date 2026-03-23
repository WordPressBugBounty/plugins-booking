"use strict";

// ---------------------------------------------------------------------------------------------------------------------
// == File  /includes/page-form-builder/field-packs/time-durationtime/_out/field-durationtime-wptpl.js
// == Pack  Duration Time (WP-template–driven) — reuses Start Time inspector logic via shared selectors
// == Depends on Core: WPBC_BFB_Field_Base, Field_Renderer_Registry, Core.Time utils, StartTime pack (events)
// == Version 1.0.3  (04.11.2025 13:22)
// ---------------------------------------------------------------------------------------------------------------------
(function (w, d) {
  'use strict';

  var Core = w.WPBC_BFB_Core || {};
  var Registry = Core.WPBC_BFB_Field_Renderer_Registry;
  var Base = Core.WPBC_BFB_Field_Base || null;
  var Time = Core && Core.Time ? Core.Time : null;
  if (!Registry || typeof Registry.register !== 'function' || !Base || !Time) {
    if (w._wpbc && w._wpbc.dev && w._wpbc.dev.error) {
      w._wpbc.dev.error('wpbc_bfb_field_durationtime', 'Missing Core registry/base/time-utils');
    }
    return;
  }

  // ---------------------------------------------------------------------
  // Helpers (label humanizer + row relabel)
  // ---------------------------------------------------------------------
  function humanize_minutes_label(totalMins) {
    if (isNaN(totalMins) || totalMins < 0) {
      return '';
    }
    var h = Math.floor(totalMins / 60);
    var m = totalMins % 60;

    // i18n fallbacks
    var i18n_minutes = w.wpbc_i18n_minutes || 'minutes';
    var i18n_min = w.wpbc_i18n_min || 'min';
    var i18n_h = w.wpbc_i18n_h || 'h';
    if (h === 0) {
      // "15 minutes"
      return String(m) + ' ' + i18n_minutes;
    }
    // "1h" or "1h 15m"
    return h + i18n_h + (m > 0 ? ' ' + m + (w.wpbc_i18n_m || 'm') : '');
  }
  function relabel_rows_in_duration_panel(panel) {
    if (!panel) {
      return;
    }
    // Only touch our pack
    var dtype = panel.getAttribute('data-type') || '';
    if (dtype !== 'durationtime') {
      return;
    }
    var list = panel.querySelector('.wpbc_bfb__options_list');
    if (!list) {
      return;
    }
    list.querySelectorAll('.wpbc_bfb__options_row').forEach(function (row) {
      var valEl = row.querySelector('.wpbc_bfb__opt-value'); // authoritative 24h value holder
      var timeEl = row.querySelector('.wpbc_bfb__opt-time'); // visible editor
      var raw = valEl && valEl.value || timeEl && timeEl.value || '';
      var mins = Time.parse_hhmm_24h(String(raw));
      if (isNaN(mins)) {
        return;
      }
      var labelEl = row.querySelector('.wpbc_bfb__opt-label');
      if (!labelEl) {
        return;
      }

      // Set default humanized label (user can edit later; we do this only on generation)
      labelEl.value = humanize_minutes_label(mins);
    });

    // Re-sync the hidden JSON state after relabel
    try {
      var ST = w.WPBC_BFB_Field_StartTime;
      if (ST && typeof ST.sync_state_from_rows === 'function') {
        ST.sync_state_from_rows(panel);
      }
    } catch (e) {}
  }

  // ---------------------------------------------------------------------
  // Event wiring (react to StartTime generator completion)
  // ---------------------------------------------------------------------
  (function bind_generation_listeners_once() {
    if (w.__wpbc_dt_bound) {
      return;
    }
    w.__wpbc_dt_bound = true;

    // DOM CustomEvent path
    d.addEventListener('wpbc_bfb_time_options_generated', function (ev) {
      try {
        var panel = ev && ev.target;
        var detail = ev && ev.detail || {};
        // Only for Duration Time panels
        var dtype = detail && detail.type || panel && panel.getAttribute('data-type') || '';
        if (dtype !== 'durationtime') {
          return;
        }
        relabel_rows_in_duration_panel(panel);
      } catch (e) {}
    }, true);

    // Core bus path (if available)
    try {
      var EVNAME = Core && Core.WPBC_BFB_Events && Core.WPBC_BFB_Events.TIME_OPTIONS_GENERATED || 'wpbc_bfb:time_options_generated';
      if (Core && Core.bus && typeof Core.bus.on === 'function') {
        Core.bus.on(EVNAME, function (payload) {
          try {
            if (!payload || payload.type !== 'durationtime') {
              return;
            }
            relabel_rows_in_duration_panel(payload.panel);
          } catch (e) {}
        });
      }
    } catch (e) {}
  })();

  /**
   * WPBC_BFB: Duration Time field renderer (template-driven).
   * Inspector is structurally identical to Start Time, so we intentionally reuse:
   *  - root class: .wpbc_bfb__inspector_starttime  (Start Time JS binds here)
   *  - option rows markup / state syncing (delegated to Start Time JS)
   */
  const wpbc_bfb_field_durationtime = class extends Base {
    static template_id = 'wpbc-bfb-field-durationtime';
    static kind = 'durationtime';
    static get_defaults() {
      return {
        kind: 'field',
        type: 'durationtime',
        label: 'Duration time',
        name: 'durationtime',
        html_id: '',
        required: true,
        multiple: false,
        size: null,
        cssclass: '',
        help: '',
        default_value: '',
        placeholder: '--- Select duration time ---',
        value_differs: true,
        min_width: '180px',
        // 24h labels by default make sense for durations (values are 24h, labels will be humanized on generation).
        options: [{
          label: '00:15',
          value: '00:15',
          selected: false
        }, {
          label: '00:30',
          value: '00:30',
          selected: false
        }, {
          label: '00:45',
          value: '00:45',
          selected: false
        }, {
          label: '01:00',
          value: '01:00',
          selected: false
        }, {
          label: '01:30',
          value: '01:30',
          selected: false
        }, {
          label: '02:00',
          value: '02:00',
          selected: false
        }],
        // Generator defaults (min/max duration).
        // NOTE: We keep '24h' internally but hide the UI in the template (no AM/PM vs 24h for durations).
        gen_label_fmt: '24h',
        gen_start_24h: '00:15',
        gen_end_24h: '06:00',
        gen_start_ampm_t: '00:15',
        gen_end_ampm_t: '06:00',
        gen_step_h: 0,
        gen_step_m: 15
      };
    }

    /**
     * After the field is dropped from the palette.
     * Locks "name" to 'durationtime' and ensures required=true for consistency.
     *
     * @param {Object}      data
     * @param {HTMLElement} el
     * @param {Object}      ctx
     */
    static on_field_drop(data, el, ctx) {
      if (super.on_field_drop) {
        super.on_field_drop(data, el, ctx);
      }
      try {
        if (data && typeof data === 'object') {
          data.name = 'durationtime';
          data.required = true;
          if (!data.placeholder) {
            data.placeholder = '--- ' + (w.wpbc_i18n_select_durationtime || 'Select duration time') + ' ---';
          }
          // Keep 24h format internally; the UI radios are hidden in the template.
          data.gen_label_fmt = data.gen_label_fmt || '24h';
        }
        if (el && el.dataset) {
          el.dataset.name = 'durationtime';
          el.dataset.autoname = '0';
          el.dataset.fresh = '0';
          el.dataset.name_user_touched = '1';
          el.setAttribute('data-required', 'true');
        }
        var sel = el && el.querySelector('select.wpbc_bfb__preview-timepicker');
        if (sel) {
          sel.setAttribute('name', 'durationtime');
        }
      } catch (e) {}
    }
  };
  try {
    Registry.register('durationtime', wpbc_bfb_field_durationtime);
  } catch (e) {
    if (w._wpbc && w._wpbc.dev && w._wpbc.dev.error) {
      w._wpbc.dev.error('wpbc_bfb_field_durationtime.register', e);
    }
  }

  // No extra bindings; Start Time pack listeners handle the inspector via shared classes.
  // This file only post-processes generated options via events.
  w.WPBC_BFB_Field_DurationTime = wpbc_bfb_field_durationtime;

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Form" (Advanced Form shortcode)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Booking Form exporter callback for "durationtime".
   *
   * Mirrors the legacy behavior:
   *   WPBC_BFB_Exporter.emit_time_select( name, field, req_mark, id_opt, cls_opts, emit_label_then );
   *
   * So the final shortcode body and label handling are identical to the old
   * switch/case path in builder-exporter.js, just moved into this pack.
   */
  function register_durationtime_booking_form_exporter() {
    var Exp = w.WPBC_BFB_Exporter;
    if (!Exp || typeof Exp.register !== 'function') {
      return;
    }
    if (typeof Exp.has_exporter === 'function' && Exp.has_exporter('durationtime')) {
      return;
    }
    var S = Core.WPBC_BFB_Sanitize || {};
    var esc_html = S.escape_html || function (v) {
      return String(v);
    }; // kept for parity with Start/End Time

    /**
     * @type {WPBC_BFB_ExporterCallback}
     */
    var exporter_callback = function (field, emit, extras) {
      extras = extras || {};
      var cfg = extras.cfg || {};
      var ctx = extras.ctx;

      // Shared label wrapper: same pattern as Start/End Time.
      var emit_label_then = function (body) {
        // Preferred path: centralized helper in builder-exporter.js
        if (Exp && typeof Exp.emit_label_then === 'function') {
          Exp.emit_label_then(field, emit, body, cfg);
          return;
        }
        // No fallback (aligned with Start/End Time packs).
      };

      // Required marker.
      var is_req = Exp.is_required(field);
      var req_mark = is_req ? '*' : '';

      // Name / id / classes from shared helpers so they stay in sync.
      var name = Exp.compute_name('durationtime', field);
      var id_opt = Exp.id_option(field, ctx);
      var cls_opts = Exp.class_options(field);

      // Dedicated time helper to keep exact legacy shortcode shape.
      if (typeof Exp.emit_time_select === 'function') {
        Exp.emit_time_select(name, field, req_mark, id_opt, cls_opts, emit_label_then);
        return;
      }
    };
    Exp.register('durationtime', exporter_callback);
  }
  if (w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function') {
    register_durationtime_booking_form_exporter();
  } else if (typeof document !== 'undefined') {
    document.addEventListener('wpbc:bfb:exporter-ready', register_durationtime_booking_form_exporter, {
      once: true
    });
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Data" (Content of booking fields data)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Booking Data exporter callback for "durationtime".
   *
   * Default behavior:
   *   <b>Label</b>: <f>[durationtime]</f><br>
   *
   * The exported token name is kept fully in sync with the Booking Form exporter
   * via Exp.compute_name('durationtime', field).
   */
  function register_durationtime_booking_data_exporter() {
    var C = w.WPBC_BFB_ContentExporter;
    if (!C || typeof C.register !== 'function') {
      return;
    }
    if (typeof C.has_exporter === 'function' && C.has_exporter('durationtime')) {
      return;
    }
    C.register('durationtime', function (field, emit, extras) {
      extras = extras || {};
      var cfg = extras.cfg || {};
      var Exp = w.WPBC_BFB_Exporter;
      if (!Exp || typeof Exp.compute_name !== 'function') {
        return;
      }

      // Base name, identical to Booking Form exporter.
      var name = Exp.compute_name('durationtime', field);
      if (!name) {
        return;
      }
      var raw_label = typeof field.label === 'string' ? field.label : '';
      var label = raw_label.trim() || name;

      // Build a combined token: [name] / [name_val]
      // emit_line_bold_field will wrap it as: <f>[{token}]</f>
      var token = name + '_val] / [' + name;

      // Result: <b>Label</b>: <f>[durationtime_val] / [durationtime]</f><br>
      C.emit_line_bold_field(emit, label, token, cfg);
    });
  }
  if (w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function') {
    register_durationtime_booking_data_exporter();
  } else if (typeof document !== 'undefined') {
    document.addEventListener('wpbc:bfb:content-exporter-ready', register_durationtime_booking_data_exporter, {
      once: true
    });
  }
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvdGltZS1kdXJhdGlvbi9fb3V0L2ZpZWxkLWR1cmF0aW9udGltZS13cHRwbC5qcyIsIm5hbWVzIjpbInciLCJkIiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJSZWdpc3RyeSIsIldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5IiwiQmFzZSIsIldQQkNfQkZCX0ZpZWxkX0Jhc2UiLCJUaW1lIiwicmVnaXN0ZXIiLCJfd3BiYyIsImRldiIsImVycm9yIiwiaHVtYW5pemVfbWludXRlc19sYWJlbCIsInRvdGFsTWlucyIsImlzTmFOIiwiaCIsIk1hdGgiLCJmbG9vciIsIm0iLCJpMThuX21pbnV0ZXMiLCJ3cGJjX2kxOG5fbWludXRlcyIsImkxOG5fbWluIiwid3BiY19pMThuX21pbiIsImkxOG5faCIsIndwYmNfaTE4bl9oIiwiU3RyaW5nIiwid3BiY19pMThuX20iLCJyZWxhYmVsX3Jvd3NfaW5fZHVyYXRpb25fcGFuZWwiLCJwYW5lbCIsImR0eXBlIiwiZ2V0QXR0cmlidXRlIiwibGlzdCIsInF1ZXJ5U2VsZWN0b3IiLCJxdWVyeVNlbGVjdG9yQWxsIiwiZm9yRWFjaCIsInJvdyIsInZhbEVsIiwidGltZUVsIiwicmF3IiwidmFsdWUiLCJtaW5zIiwicGFyc2VfaGhtbV8yNGgiLCJsYWJlbEVsIiwiU1QiLCJXUEJDX0JGQl9GaWVsZF9TdGFydFRpbWUiLCJzeW5jX3N0YXRlX2Zyb21fcm93cyIsImUiLCJiaW5kX2dlbmVyYXRpb25fbGlzdGVuZXJzX29uY2UiLCJfX3dwYmNfZHRfYm91bmQiLCJhZGRFdmVudExpc3RlbmVyIiwiZXYiLCJ0YXJnZXQiLCJkZXRhaWwiLCJ0eXBlIiwiRVZOQU1FIiwiV1BCQ19CRkJfRXZlbnRzIiwiVElNRV9PUFRJT05TX0dFTkVSQVRFRCIsImJ1cyIsIm9uIiwicGF5bG9hZCIsIndwYmNfYmZiX2ZpZWxkX2R1cmF0aW9udGltZSIsInRlbXBsYXRlX2lkIiwia2luZCIsImdldF9kZWZhdWx0cyIsImxhYmVsIiwibmFtZSIsImh0bWxfaWQiLCJyZXF1aXJlZCIsIm11bHRpcGxlIiwic2l6ZSIsImNzc2NsYXNzIiwiaGVscCIsImRlZmF1bHRfdmFsdWUiLCJwbGFjZWhvbGRlciIsInZhbHVlX2RpZmZlcnMiLCJtaW5fd2lkdGgiLCJvcHRpb25zIiwic2VsZWN0ZWQiLCJnZW5fbGFiZWxfZm10IiwiZ2VuX3N0YXJ0XzI0aCIsImdlbl9lbmRfMjRoIiwiZ2VuX3N0YXJ0X2FtcG1fdCIsImdlbl9lbmRfYW1wbV90IiwiZ2VuX3N0ZXBfaCIsImdlbl9zdGVwX20iLCJvbl9maWVsZF9kcm9wIiwiZGF0YSIsImVsIiwiY3R4Iiwid3BiY19pMThuX3NlbGVjdF9kdXJhdGlvbnRpbWUiLCJkYXRhc2V0IiwiYXV0b25hbWUiLCJmcmVzaCIsIm5hbWVfdXNlcl90b3VjaGVkIiwic2V0QXR0cmlidXRlIiwic2VsIiwiV1BCQ19CRkJfRmllbGRfRHVyYXRpb25UaW1lIiwicmVnaXN0ZXJfZHVyYXRpb250aW1lX2Jvb2tpbmdfZm9ybV9leHBvcnRlciIsIkV4cCIsIldQQkNfQkZCX0V4cG9ydGVyIiwiaGFzX2V4cG9ydGVyIiwiUyIsIldQQkNfQkZCX1Nhbml0aXplIiwiZXNjX2h0bWwiLCJlc2NhcGVfaHRtbCIsInYiLCJleHBvcnRlcl9jYWxsYmFjayIsImZpZWxkIiwiZW1pdCIsImV4dHJhcyIsImNmZyIsImVtaXRfbGFiZWxfdGhlbiIsImJvZHkiLCJpc19yZXEiLCJpc19yZXF1aXJlZCIsInJlcV9tYXJrIiwiY29tcHV0ZV9uYW1lIiwiaWRfb3B0IiwiaWRfb3B0aW9uIiwiY2xzX29wdHMiLCJjbGFzc19vcHRpb25zIiwiZW1pdF90aW1lX3NlbGVjdCIsImRvY3VtZW50Iiwib25jZSIsInJlZ2lzdGVyX2R1cmF0aW9udGltZV9ib29raW5nX2RhdGFfZXhwb3J0ZXIiLCJDIiwiV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyIiwicmF3X2xhYmVsIiwidHJpbSIsInRva2VuIiwiZW1pdF9saW5lX2JvbGRfZmllbGQiLCJ3aW5kb3ciXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9maWVsZC1wYWNrcy90aW1lLWR1cmF0aW9uL19zcmMvZmllbGQtZHVyYXRpb250aW1lLXdwdHBsLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyA9PSBGaWxlICAvaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvdGltZS1kdXJhdGlvbnRpbWUvX291dC9maWVsZC1kdXJhdGlvbnRpbWUtd3B0cGwuanNcclxuLy8gPT0gUGFjayAgRHVyYXRpb24gVGltZSAoV1AtdGVtcGxhdGXigJNkcml2ZW4pIOKAlCByZXVzZXMgU3RhcnQgVGltZSBpbnNwZWN0b3IgbG9naWMgdmlhIHNoYXJlZCBzZWxlY3RvcnNcclxuLy8gPT0gRGVwZW5kcyBvbiBDb3JlOiBXUEJDX0JGQl9GaWVsZF9CYXNlLCBGaWVsZF9SZW5kZXJlcl9SZWdpc3RyeSwgQ29yZS5UaW1lIHV0aWxzLCBTdGFydFRpbWUgcGFjayAoZXZlbnRzKVxyXG4vLyA9PSBWZXJzaW9uIDEuMC4zICAoMDQuMTEuMjAyNSAxMzoyMilcclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbihmdW5jdGlvbiAodywgZCkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0dmFyIENvcmUgICAgID0gdy5XUEJDX0JGQl9Db3JlIHx8IHt9O1xyXG5cdHZhciBSZWdpc3RyeSA9IENvcmUuV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnk7XHJcblx0dmFyIEJhc2UgICAgID0gQ29yZS5XUEJDX0JGQl9GaWVsZF9CYXNlIHx8IG51bGw7XHJcblx0dmFyIFRpbWUgICAgID0gKENvcmUgJiYgQ29yZS5UaW1lKSA/IENvcmUuVGltZSA6IG51bGw7XHJcblxyXG5cdGlmICggIVJlZ2lzdHJ5IHx8IHR5cGVvZiBSZWdpc3RyeS5yZWdpc3RlciAhPT0gJ2Z1bmN0aW9uJyB8fCAhQmFzZSB8fCAhVGltZSApIHtcclxuXHRcdGlmICggdy5fd3BiYyAmJiB3Ll93cGJjLmRldiAmJiB3Ll93cGJjLmRldi5lcnJvciApIHtcclxuXHRcdFx0dy5fd3BiYy5kZXYuZXJyb3IoICd3cGJjX2JmYl9maWVsZF9kdXJhdGlvbnRpbWUnLCAnTWlzc2luZyBDb3JlIHJlZ2lzdHJ5L2Jhc2UvdGltZS11dGlscycgKTtcclxuXHRcdH1cclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEhlbHBlcnMgKGxhYmVsIGh1bWFuaXplciArIHJvdyByZWxhYmVsKVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGZ1bmN0aW9uIGh1bWFuaXplX21pbnV0ZXNfbGFiZWwoIHRvdGFsTWlucyApe1xyXG5cdFx0aWYgKCBpc05hTih0b3RhbE1pbnMpIHx8IHRvdGFsTWlucyA8IDAgKSB7IHJldHVybiAnJzsgfVxyXG5cdFx0dmFyIGggPSBNYXRoLmZsb29yKCB0b3RhbE1pbnMgLyA2MCApO1xyXG5cdFx0dmFyIG0gPSB0b3RhbE1pbnMgJSA2MDtcclxuXHJcblx0XHQvLyBpMThuIGZhbGxiYWNrc1xyXG5cdFx0dmFyIGkxOG5fbWludXRlcyA9IHcud3BiY19pMThuX21pbnV0ZXMgfHwgJ21pbnV0ZXMnO1xyXG5cdFx0dmFyIGkxOG5fbWluICAgICA9IHcud3BiY19pMThuX21pbiB8fCAnbWluJztcclxuXHRcdHZhciBpMThuX2ggICAgICAgPSB3LndwYmNfaTE4bl9oICAgfHwgJ2gnO1xyXG5cclxuXHRcdGlmICggaCA9PT0gMCApIHtcclxuXHRcdFx0Ly8gXCIxNSBtaW51dGVzXCJcclxuXHRcdFx0cmV0dXJuIFN0cmluZyggbSApICsgJyAnICsgaTE4bl9taW51dGVzO1xyXG5cdFx0fVxyXG5cdFx0Ly8gXCIxaFwiIG9yIFwiMWggMTVtXCJcclxuXHRcdHJldHVybiAoIGggKyBpMThuX2ggKSArICggbSA+IDAgPyAoICcgJyArIG0gKyAody53cGJjX2kxOG5fbSB8fCAnbScpICkgOiAnJyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcmVsYWJlbF9yb3dzX2luX2R1cmF0aW9uX3BhbmVsKCBwYW5lbCApe1xyXG5cdFx0aWYgKCAhIHBhbmVsICkgeyByZXR1cm47IH1cclxuXHRcdC8vIE9ubHkgdG91Y2ggb3VyIHBhY2tcclxuXHRcdHZhciBkdHlwZSA9IHBhbmVsLmdldEF0dHJpYnV0ZSgnZGF0YS10eXBlJykgfHwgJyc7XHJcblx0XHRpZiAoIGR0eXBlICE9PSAnZHVyYXRpb250aW1lJyApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0dmFyIGxpc3QgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX29wdGlvbnNfbGlzdCcpO1xyXG5cdFx0aWYgKCAhIGxpc3QgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdGxpc3QucXVlcnlTZWxlY3RvckFsbCgnLndwYmNfYmZiX19vcHRpb25zX3JvdycpLmZvckVhY2goZnVuY3Rpb24ocm93KXtcclxuXHRcdFx0dmFyIHZhbEVsICA9IHJvdy5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX29wdC12YWx1ZScpOyAvLyBhdXRob3JpdGF0aXZlIDI0aCB2YWx1ZSBob2xkZXJcclxuXHRcdFx0dmFyIHRpbWVFbCA9IHJvdy5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX29wdC10aW1lJyk7ICAvLyB2aXNpYmxlIGVkaXRvclxyXG5cdFx0XHR2YXIgcmF3ICAgID0gKHZhbEVsICYmIHZhbEVsLnZhbHVlKSB8fCAodGltZUVsICYmIHRpbWVFbC52YWx1ZSkgfHwgJyc7XHJcblx0XHRcdHZhciBtaW5zICAgPSBUaW1lLnBhcnNlX2hobW1fMjRoKCBTdHJpbmcocmF3KSApO1xyXG5cdFx0XHRpZiAoIGlzTmFOKG1pbnMpICkgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdHZhciBsYWJlbEVsID0gcm93LnF1ZXJ5U2VsZWN0b3IoJy53cGJjX2JmYl9fb3B0LWxhYmVsJyk7XHJcblx0XHRcdGlmICggISBsYWJlbEVsICkgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdC8vIFNldCBkZWZhdWx0IGh1bWFuaXplZCBsYWJlbCAodXNlciBjYW4gZWRpdCBsYXRlcjsgd2UgZG8gdGhpcyBvbmx5IG9uIGdlbmVyYXRpb24pXHJcblx0XHRcdGxhYmVsRWwudmFsdWUgPSBodW1hbml6ZV9taW51dGVzX2xhYmVsKCBtaW5zICk7XHJcblx0XHR9KTtcclxuXHJcblx0XHQvLyBSZS1zeW5jIHRoZSBoaWRkZW4gSlNPTiBzdGF0ZSBhZnRlciByZWxhYmVsXHJcblx0XHR0cnkge1xyXG5cdFx0XHR2YXIgU1QgPSB3LldQQkNfQkZCX0ZpZWxkX1N0YXJ0VGltZTtcclxuXHRcdFx0aWYgKCBTVCAmJiB0eXBlb2YgU1Quc3luY19zdGF0ZV9mcm9tX3Jvd3MgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0U1Quc3luY19zdGF0ZV9mcm9tX3Jvd3MoIHBhbmVsICk7XHJcblx0XHRcdH1cclxuXHRcdH0gY2F0Y2goZSl7fVxyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRXZlbnQgd2lyaW5nIChyZWFjdCB0byBTdGFydFRpbWUgZ2VuZXJhdG9yIGNvbXBsZXRpb24pXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0KGZ1bmN0aW9uIGJpbmRfZ2VuZXJhdGlvbl9saXN0ZW5lcnNfb25jZSgpe1xyXG5cdFx0aWYgKCB3Ll9fd3BiY19kdF9ib3VuZCApIHsgcmV0dXJuOyB9XHJcblx0XHR3Ll9fd3BiY19kdF9ib3VuZCA9IHRydWU7XHJcblxyXG5cdFx0Ly8gRE9NIEN1c3RvbUV2ZW50IHBhdGhcclxuXHRcdGQuYWRkRXZlbnRMaXN0ZW5lcignd3BiY19iZmJfdGltZV9vcHRpb25zX2dlbmVyYXRlZCcsIGZ1bmN0aW9uKGV2KXtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHR2YXIgcGFuZWwgPSBldiAmJiBldi50YXJnZXQ7XHJcblx0XHRcdFx0dmFyIGRldGFpbD0gZXYgJiYgZXYuZGV0YWlsIHx8IHt9O1xyXG5cdFx0XHRcdC8vIE9ubHkgZm9yIER1cmF0aW9uIFRpbWUgcGFuZWxzXHJcblx0XHRcdFx0dmFyIGR0eXBlID0gKGRldGFpbCAmJiBkZXRhaWwudHlwZSkgfHwgKHBhbmVsICYmIHBhbmVsLmdldEF0dHJpYnV0ZSgnZGF0YS10eXBlJykpIHx8ICcnO1xyXG5cdFx0XHRcdGlmICggZHR5cGUgIT09ICdkdXJhdGlvbnRpbWUnICkgeyByZXR1cm47IH1cclxuXHRcdFx0XHRyZWxhYmVsX3Jvd3NfaW5fZHVyYXRpb25fcGFuZWwoIHBhbmVsICk7XHJcblx0XHRcdH0gY2F0Y2goZSl7fVxyXG5cdFx0fSwgdHJ1ZSk7XHJcblxyXG5cdFx0Ly8gQ29yZSBidXMgcGF0aCAoaWYgYXZhaWxhYmxlKVxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0dmFyIEVWTkFNRSA9IChDb3JlICYmIENvcmUuV1BCQ19CRkJfRXZlbnRzICYmIENvcmUuV1BCQ19CRkJfRXZlbnRzLlRJTUVfT1BUSU9OU19HRU5FUkFURUQpIHx8ICd3cGJjX2JmYjp0aW1lX29wdGlvbnNfZ2VuZXJhdGVkJztcclxuXHRcdFx0aWYgKCBDb3JlICYmIENvcmUuYnVzICYmIHR5cGVvZiBDb3JlLmJ1cy5vbiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRDb3JlLmJ1cy5vbiggRVZOQU1FLCBmdW5jdGlvbihwYXlsb2FkKXtcclxuXHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdGlmICggIXBheWxvYWQgfHwgcGF5bG9hZC50eXBlICE9PSAnZHVyYXRpb250aW1lJyApIHsgcmV0dXJuOyB9XHJcblx0XHRcdFx0XHRcdHJlbGFiZWxfcm93c19pbl9kdXJhdGlvbl9wYW5lbCggcGF5bG9hZC5wYW5lbCApO1xyXG5cdFx0XHRcdFx0fSBjYXRjaChlKXt9XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH1cclxuXHRcdH0gY2F0Y2goZSl7fVxyXG5cdH0pKCk7XHJcblxyXG5cdC8qKlxyXG5cdCAqIFdQQkNfQkZCOiBEdXJhdGlvbiBUaW1lIGZpZWxkIHJlbmRlcmVyICh0ZW1wbGF0ZS1kcml2ZW4pLlxyXG5cdCAqIEluc3BlY3RvciBpcyBzdHJ1Y3R1cmFsbHkgaWRlbnRpY2FsIHRvIFN0YXJ0IFRpbWUsIHNvIHdlIGludGVudGlvbmFsbHkgcmV1c2U6XHJcblx0ICogIC0gcm9vdCBjbGFzczogLndwYmNfYmZiX19pbnNwZWN0b3Jfc3RhcnR0aW1lICAoU3RhcnQgVGltZSBKUyBiaW5kcyBoZXJlKVxyXG5cdCAqICAtIG9wdGlvbiByb3dzIG1hcmt1cCAvIHN0YXRlIHN5bmNpbmcgKGRlbGVnYXRlZCB0byBTdGFydCBUaW1lIEpTKVxyXG5cdCAqL1xyXG5cdGNvbnN0IHdwYmNfYmZiX2ZpZWxkX2R1cmF0aW9udGltZSA9IGNsYXNzIGV4dGVuZHMgQmFzZSB7XHJcblxyXG5cdFx0c3RhdGljIHRlbXBsYXRlX2lkID0gJ3dwYmMtYmZiLWZpZWxkLWR1cmF0aW9udGltZSc7XHJcblx0XHRzdGF0aWMga2luZCAgICAgICAgPSAnZHVyYXRpb250aW1lJztcclxuXHJcblx0XHRzdGF0aWMgZ2V0X2RlZmF1bHRzKCl7XHJcblx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0a2luZCAgICAgICAgICAgOiAnZmllbGQnLFxyXG5cdFx0XHRcdHR5cGUgICAgICAgICAgIDogJ2R1cmF0aW9udGltZScsXHJcblx0XHRcdFx0bGFiZWwgICAgICAgICAgOiAnRHVyYXRpb24gdGltZScsXHJcblx0XHRcdFx0bmFtZSAgICAgICAgICAgOiAnZHVyYXRpb250aW1lJyxcclxuXHRcdFx0XHRodG1sX2lkICAgICAgICA6ICcnLFxyXG5cdFx0XHRcdHJlcXVpcmVkICAgICAgIDogdHJ1ZSxcclxuXHRcdFx0XHRtdWx0aXBsZSAgICAgICA6IGZhbHNlLFxyXG5cdFx0XHRcdHNpemUgICAgICAgICAgIDogbnVsbCxcclxuXHRcdFx0XHRjc3NjbGFzcyAgICAgICA6ICcnLFxyXG5cdFx0XHRcdGhlbHAgICAgICAgICAgIDogJycsXHJcblx0XHRcdFx0ZGVmYXVsdF92YWx1ZSAgOiAnJyxcclxuXHRcdFx0XHRwbGFjZWhvbGRlciAgICA6ICctLS0gU2VsZWN0IGR1cmF0aW9uIHRpbWUgLS0tJyxcclxuXHRcdFx0XHR2YWx1ZV9kaWZmZXJzICA6IHRydWUsXHJcblx0XHRcdFx0bWluX3dpZHRoICAgICAgOiAnMTgwcHgnLFxyXG5cclxuXHRcdFx0XHQvLyAyNGggbGFiZWxzIGJ5IGRlZmF1bHQgbWFrZSBzZW5zZSBmb3IgZHVyYXRpb25zICh2YWx1ZXMgYXJlIDI0aCwgbGFiZWxzIHdpbGwgYmUgaHVtYW5pemVkIG9uIGdlbmVyYXRpb24pLlxyXG5cdFx0XHRcdG9wdGlvbnMgICAgICAgIDogW1xyXG5cdFx0XHRcdFx0eyBsYWJlbDogJzAwOjE1JywgdmFsdWU6ICcwMDoxNScsIHNlbGVjdGVkOiBmYWxzZSB9LFxyXG5cdFx0XHRcdFx0eyBsYWJlbDogJzAwOjMwJywgdmFsdWU6ICcwMDozMCcsIHNlbGVjdGVkOiBmYWxzZSB9LFxyXG5cdFx0XHRcdFx0eyBsYWJlbDogJzAwOjQ1JywgdmFsdWU6ICcwMDo0NScsIHNlbGVjdGVkOiBmYWxzZSB9LFxyXG5cdFx0XHRcdFx0eyBsYWJlbDogJzAxOjAwJywgdmFsdWU6ICcwMTowMCcsIHNlbGVjdGVkOiBmYWxzZSB9LFxyXG5cdFx0XHRcdFx0eyBsYWJlbDogJzAxOjMwJywgdmFsdWU6ICcwMTozMCcsIHNlbGVjdGVkOiBmYWxzZSB9LFxyXG5cdFx0XHRcdFx0eyBsYWJlbDogJzAyOjAwJywgdmFsdWU6ICcwMjowMCcsIHNlbGVjdGVkOiBmYWxzZSB9XHJcblx0XHRcdFx0XSxcclxuXHJcblx0XHRcdFx0Ly8gR2VuZXJhdG9yIGRlZmF1bHRzIChtaW4vbWF4IGR1cmF0aW9uKS5cclxuXHRcdFx0XHQvLyBOT1RFOiBXZSBrZWVwICcyNGgnIGludGVybmFsbHkgYnV0IGhpZGUgdGhlIFVJIGluIHRoZSB0ZW1wbGF0ZSAobm8gQU0vUE0gdnMgMjRoIGZvciBkdXJhdGlvbnMpLlxyXG5cdFx0XHRcdGdlbl9sYWJlbF9mbXQgICA6ICcyNGgnLFxyXG5cdFx0XHRcdGdlbl9zdGFydF8yNGggICA6ICcwMDoxNScsXHJcblx0XHRcdFx0Z2VuX2VuZF8yNGggICAgIDogJzA2OjAwJyxcclxuXHRcdFx0XHRnZW5fc3RhcnRfYW1wbV90OiAnMDA6MTUnLFxyXG5cdFx0XHRcdGdlbl9lbmRfYW1wbV90ICA6ICcwNjowMCcsXHJcblx0XHRcdFx0Z2VuX3N0ZXBfaCAgICAgIDogMCxcclxuXHRcdFx0XHRnZW5fc3RlcF9tICAgICAgOiAxNVxyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQWZ0ZXIgdGhlIGZpZWxkIGlzIGRyb3BwZWQgZnJvbSB0aGUgcGFsZXR0ZS5cclxuXHRcdCAqIExvY2tzIFwibmFtZVwiIHRvICdkdXJhdGlvbnRpbWUnIGFuZCBlbnN1cmVzIHJlcXVpcmVkPXRydWUgZm9yIGNvbnNpc3RlbmN5LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGRhdGFcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjdHhcclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIG9uX2ZpZWxkX2Ryb3AoIGRhdGEsIGVsLCBjdHggKXtcclxuXHRcdFx0aWYgKCBzdXBlci5vbl9maWVsZF9kcm9wICkgeyBzdXBlci5vbl9maWVsZF9kcm9wKCBkYXRhLCBlbCwgY3R4ICk7IH1cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRpZiAoIGRhdGEgJiYgdHlwZW9mIGRhdGEgPT09ICdvYmplY3QnICkge1xyXG5cdFx0XHRcdFx0ZGF0YS5uYW1lICAgICA9ICdkdXJhdGlvbnRpbWUnO1xyXG5cdFx0XHRcdFx0ZGF0YS5yZXF1aXJlZCA9IHRydWU7XHJcblx0XHRcdFx0XHRpZiAoICEgZGF0YS5wbGFjZWhvbGRlciApIHtcclxuXHRcdFx0XHRcdFx0ZGF0YS5wbGFjZWhvbGRlciA9ICctLS0gJyArICggKHcud3BiY19pMThuX3NlbGVjdF9kdXJhdGlvbnRpbWUpIHx8ICdTZWxlY3QgZHVyYXRpb24gdGltZScgKSArICcgLS0tJztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdC8vIEtlZXAgMjRoIGZvcm1hdCBpbnRlcm5hbGx5OyB0aGUgVUkgcmFkaW9zIGFyZSBoaWRkZW4gaW4gdGhlIHRlbXBsYXRlLlxyXG5cdFx0XHRcdFx0ZGF0YS5nZW5fbGFiZWxfZm10ID0gZGF0YS5nZW5fbGFiZWxfZm10IHx8ICcyNGgnO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoIGVsICYmIGVsLmRhdGFzZXQgKSB7XHJcblx0XHRcdFx0XHRlbC5kYXRhc2V0Lm5hbWUgICAgICAgICAgICAgID0gJ2R1cmF0aW9udGltZSc7XHJcblx0XHRcdFx0XHRlbC5kYXRhc2V0LmF1dG9uYW1lICAgICAgICAgID0gJzAnO1xyXG5cdFx0XHRcdFx0ZWwuZGF0YXNldC5mcmVzaCAgICAgICAgICAgICA9ICcwJztcclxuXHRcdFx0XHRcdGVsLmRhdGFzZXQubmFtZV91c2VyX3RvdWNoZWQgPSAnMSc7XHJcblx0XHRcdFx0XHRlbC5zZXRBdHRyaWJ1dGUoICdkYXRhLXJlcXVpcmVkJywgJ3RydWUnICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHZhciBzZWwgPSBlbCAmJiBlbC5xdWVyeVNlbGVjdG9yKCAnc2VsZWN0LndwYmNfYmZiX19wcmV2aWV3LXRpbWVwaWNrZXInICk7XHJcblx0XHRcdFx0aWYgKCBzZWwgKSB7IHNlbC5zZXRBdHRyaWJ1dGUoICduYW1lJywgJ2R1cmF0aW9udGltZScgKTsgfVxyXG5cdFx0XHR9IGNhdGNoKGUpe31cclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHR0cnkgeyBSZWdpc3RyeS5yZWdpc3RlciggJ2R1cmF0aW9udGltZScsIHdwYmNfYmZiX2ZpZWxkX2R1cmF0aW9udGltZSApOyB9XHJcblx0Y2F0Y2ggKCBlICkgeyBpZiAoIHcuX3dwYmMgJiYgdy5fd3BiYy5kZXYgJiYgdy5fd3BiYy5kZXYuZXJyb3IgKSB7IHcuX3dwYmMuZGV2LmVycm9yKCAnd3BiY19iZmJfZmllbGRfZHVyYXRpb250aW1lLnJlZ2lzdGVyJywgZSApOyB9IH1cclxuXHJcblx0Ly8gTm8gZXh0cmEgYmluZGluZ3M7IFN0YXJ0IFRpbWUgcGFjayBsaXN0ZW5lcnMgaGFuZGxlIHRoZSBpbnNwZWN0b3IgdmlhIHNoYXJlZCBjbGFzc2VzLlxyXG5cdC8vIFRoaXMgZmlsZSBvbmx5IHBvc3QtcHJvY2Vzc2VzIGdlbmVyYXRlZCBvcHRpb25zIHZpYSBldmVudHMuXHJcblx0dy5XUEJDX0JGQl9GaWVsZF9EdXJhdGlvblRpbWUgPSB3cGJjX2JmYl9maWVsZF9kdXJhdGlvbnRpbWU7XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRXhwb3J0IGZvciBcIkJvb2tpbmcgRm9ybVwiIChBZHZhbmNlZCBGb3JtIHNob3J0Y29kZSlcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8qKlxyXG5cdCAqIEJvb2tpbmcgRm9ybSBleHBvcnRlciBjYWxsYmFjayBmb3IgXCJkdXJhdGlvbnRpbWVcIi5cclxuXHQgKlxyXG5cdCAqIE1pcnJvcnMgdGhlIGxlZ2FjeSBiZWhhdmlvcjpcclxuXHQgKiAgIFdQQkNfQkZCX0V4cG9ydGVyLmVtaXRfdGltZV9zZWxlY3QoIG5hbWUsIGZpZWxkLCByZXFfbWFyaywgaWRfb3B0LCBjbHNfb3B0cywgZW1pdF9sYWJlbF90aGVuICk7XHJcblx0ICpcclxuXHQgKiBTbyB0aGUgZmluYWwgc2hvcnRjb2RlIGJvZHkgYW5kIGxhYmVsIGhhbmRsaW5nIGFyZSBpZGVudGljYWwgdG8gdGhlIG9sZFxyXG5cdCAqIHN3aXRjaC9jYXNlIHBhdGggaW4gYnVpbGRlci1leHBvcnRlci5qcywganVzdCBtb3ZlZCBpbnRvIHRoaXMgcGFjay5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiByZWdpc3Rlcl9kdXJhdGlvbnRpbWVfYm9va2luZ19mb3JtX2V4cG9ydGVyKCkge1xyXG5cclxuXHRcdHZhciBFeHAgPSB3LldQQkNfQkZCX0V4cG9ydGVyO1xyXG5cdFx0aWYgKCAhIEV4cCB8fCB0eXBlb2YgRXhwLnJlZ2lzdGVyICE9PSAnZnVuY3Rpb24nICkgeyByZXR1cm47IH1cclxuXHRcdGlmICggdHlwZW9mIEV4cC5oYXNfZXhwb3J0ZXIgPT09ICdmdW5jdGlvbicgJiYgRXhwLmhhc19leHBvcnRlciggJ2R1cmF0aW9udGltZScgKSApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0dmFyIFMgICAgICAgID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZSB8fCB7fTtcclxuXHRcdHZhciBlc2NfaHRtbCA9IFMuZXNjYXBlX2h0bWwgfHwgZnVuY3Rpb24oIHYgKXsgcmV0dXJuIFN0cmluZyggdiApOyB9OyAvLyBrZXB0IGZvciBwYXJpdHkgd2l0aCBTdGFydC9FbmQgVGltZVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQHR5cGUge1dQQkNfQkZCX0V4cG9ydGVyQ2FsbGJhY2t9XHJcblx0XHQgKi9cclxuXHRcdHZhciBleHBvcnRlcl9jYWxsYmFjayA9IGZ1bmN0aW9uKCBmaWVsZCwgZW1pdCwgZXh0cmFzICkge1xyXG5cdFx0XHRleHRyYXMgPSBleHRyYXMgfHwge307XHJcblxyXG5cdFx0XHR2YXIgY2ZnID0gZXh0cmFzLmNmZyB8fCB7fTtcclxuXHRcdFx0dmFyIGN0eCA9IGV4dHJhcy5jdHg7XHJcblxyXG5cdFx0XHQvLyBTaGFyZWQgbGFiZWwgd3JhcHBlcjogc2FtZSBwYXR0ZXJuIGFzIFN0YXJ0L0VuZCBUaW1lLlxyXG5cdFx0XHR2YXIgZW1pdF9sYWJlbF90aGVuID0gZnVuY3Rpb24oIGJvZHkgKSB7XHJcblx0XHRcdFx0Ly8gUHJlZmVycmVkIHBhdGg6IGNlbnRyYWxpemVkIGhlbHBlciBpbiBidWlsZGVyLWV4cG9ydGVyLmpzXHJcblx0XHRcdFx0aWYgKCBFeHAgJiYgdHlwZW9mIEV4cC5lbWl0X2xhYmVsX3RoZW4gPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRFeHAuZW1pdF9sYWJlbF90aGVuKCBmaWVsZCwgZW1pdCwgYm9keSwgY2ZnICk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdC8vIE5vIGZhbGxiYWNrIChhbGlnbmVkIHdpdGggU3RhcnQvRW5kIFRpbWUgcGFja3MpLlxyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0Ly8gUmVxdWlyZWQgbWFya2VyLlxyXG5cdFx0XHR2YXIgaXNfcmVxICAgPSBFeHAuaXNfcmVxdWlyZWQoIGZpZWxkICk7XHJcblx0XHRcdHZhciByZXFfbWFyayA9IGlzX3JlcSA/ICcqJyA6ICcnO1xyXG5cclxuXHRcdFx0Ly8gTmFtZSAvIGlkIC8gY2xhc3NlcyBmcm9tIHNoYXJlZCBoZWxwZXJzIHNvIHRoZXkgc3RheSBpbiBzeW5jLlxyXG5cdFx0XHR2YXIgbmFtZSAgICAgPSBFeHAuY29tcHV0ZV9uYW1lKCAnZHVyYXRpb250aW1lJywgZmllbGQgKTtcclxuXHRcdFx0dmFyIGlkX29wdCAgID0gRXhwLmlkX29wdGlvbiggZmllbGQsIGN0eCApO1xyXG5cdFx0XHR2YXIgY2xzX29wdHMgPSBFeHAuY2xhc3Nfb3B0aW9ucyggZmllbGQgKTtcclxuXHJcblx0XHRcdC8vIERlZGljYXRlZCB0aW1lIGhlbHBlciB0byBrZWVwIGV4YWN0IGxlZ2FjeSBzaG9ydGNvZGUgc2hhcGUuXHJcblx0XHRcdGlmICggdHlwZW9mIEV4cC5lbWl0X3RpbWVfc2VsZWN0ID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdEV4cC5lbWl0X3RpbWVfc2VsZWN0KCBuYW1lLCBmaWVsZCwgcmVxX21hcmssIGlkX29wdCwgY2xzX29wdHMsIGVtaXRfbGFiZWxfdGhlbiApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0fTtcclxuXHJcblx0XHRFeHAucmVnaXN0ZXIoICdkdXJhdGlvbnRpbWUnLCBleHBvcnRlcl9jYWxsYmFjayApO1xyXG5cdH1cclxuXHJcblx0aWYgKCB3LldQQkNfQkZCX0V4cG9ydGVyICYmIHR5cGVvZiB3LldQQkNfQkZCX0V4cG9ydGVyLnJlZ2lzdGVyID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0cmVnaXN0ZXJfZHVyYXRpb250aW1lX2Jvb2tpbmdfZm9ybV9leHBvcnRlcigpO1xyXG5cdH0gZWxzZSBpZiAoIHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcgKSB7XHJcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzpiZmI6ZXhwb3J0ZXItcmVhZHknLCByZWdpc3Rlcl9kdXJhdGlvbnRpbWVfYm9va2luZ19mb3JtX2V4cG9ydGVyLCB7IG9uY2U6IHRydWUgfSApO1xyXG5cdH1cclxuXHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRXhwb3J0IGZvciBcIkJvb2tpbmcgRGF0YVwiIChDb250ZW50IG9mIGJvb2tpbmcgZmllbGRzIGRhdGEpXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvKipcclxuXHQgKiBCb29raW5nIERhdGEgZXhwb3J0ZXIgY2FsbGJhY2sgZm9yIFwiZHVyYXRpb250aW1lXCIuXHJcblx0ICpcclxuXHQgKiBEZWZhdWx0IGJlaGF2aW9yOlxyXG5cdCAqICAgPGI+TGFiZWw8L2I+OiA8Zj5bZHVyYXRpb250aW1lXTwvZj48YnI+XHJcblx0ICpcclxuXHQgKiBUaGUgZXhwb3J0ZWQgdG9rZW4gbmFtZSBpcyBrZXB0IGZ1bGx5IGluIHN5bmMgd2l0aCB0aGUgQm9va2luZyBGb3JtIGV4cG9ydGVyXHJcblx0ICogdmlhIEV4cC5jb21wdXRlX25hbWUoJ2R1cmF0aW9udGltZScsIGZpZWxkKS5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiByZWdpc3Rlcl9kdXJhdGlvbnRpbWVfYm9va2luZ19kYXRhX2V4cG9ydGVyKCkge1xyXG5cclxuXHRcdHZhciBDID0gdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXI7XHJcblx0XHRpZiAoICEgQyB8fCB0eXBlb2YgQy5yZWdpc3RlciAhPT0gJ2Z1bmN0aW9uJyApIHsgcmV0dXJuOyB9XHJcblx0XHRpZiAoIHR5cGVvZiBDLmhhc19leHBvcnRlciA9PT0gJ2Z1bmN0aW9uJyAmJiBDLmhhc19leHBvcnRlciggJ2R1cmF0aW9udGltZScgKSApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0Qy5yZWdpc3RlciggJ2R1cmF0aW9udGltZScsIGZ1bmN0aW9uKCBmaWVsZCwgZW1pdCwgZXh0cmFzICkge1xyXG5cdFx0XHRleHRyYXMgPSBleHRyYXMgfHwge307XHJcblx0XHRcdHZhciBjZmcgPSBleHRyYXMuY2ZnIHx8IHt9O1xyXG5cclxuXHRcdFx0dmFyIEV4cCA9IHcuV1BCQ19CRkJfRXhwb3J0ZXI7XHJcblx0XHRcdGlmICggISBFeHAgfHwgdHlwZW9mIEV4cC5jb21wdXRlX25hbWUgIT09ICdmdW5jdGlvbicgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0Ly8gQmFzZSBuYW1lLCBpZGVudGljYWwgdG8gQm9va2luZyBGb3JtIGV4cG9ydGVyLlxyXG5cdFx0XHR2YXIgbmFtZSA9IEV4cC5jb21wdXRlX25hbWUoICdkdXJhdGlvbnRpbWUnLCBmaWVsZCApO1xyXG5cdFx0XHRpZiAoICEgbmFtZSApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHR2YXIgcmF3X2xhYmVsID0gKCB0eXBlb2YgZmllbGQubGFiZWwgPT09ICdzdHJpbmcnICkgPyBmaWVsZC5sYWJlbCA6ICcnO1xyXG5cdFx0XHR2YXIgbGFiZWwgICAgID0gcmF3X2xhYmVsLnRyaW0oKSB8fCBuYW1lO1xyXG5cclxuXHRcdFx0Ly8gQnVpbGQgYSBjb21iaW5lZCB0b2tlbjogW25hbWVdIC8gW25hbWVfdmFsXVxyXG5cdFx0XHQvLyBlbWl0X2xpbmVfYm9sZF9maWVsZCB3aWxsIHdyYXAgaXQgYXM6IDxmPlt7dG9rZW59XTwvZj5cclxuXHRcdFx0dmFyIHRva2VuID0gbmFtZSArICdfdmFsXSAvIFsnICsgbmFtZTtcclxuXHJcblx0XHRcdC8vIFJlc3VsdDogPGI+TGFiZWw8L2I+OiA8Zj5bZHVyYXRpb250aW1lX3ZhbF0gLyBbZHVyYXRpb250aW1lXTwvZj48YnI+XHJcblx0XHRcdEMuZW1pdF9saW5lX2JvbGRfZmllbGQoIGVtaXQsIGxhYmVsLCB0b2tlbiwgY2ZnICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRpZiAoIHcuV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyICYmIHR5cGVvZiB3LldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlci5yZWdpc3RlciA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdHJlZ2lzdGVyX2R1cmF0aW9udGltZV9ib29raW5nX2RhdGFfZXhwb3J0ZXIoKTtcclxuXHR9IGVsc2UgaWYgKCB0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnICkge1xyXG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6YmZiOmNvbnRlbnQtZXhwb3J0ZXItcmVhZHknLCByZWdpc3Rlcl9kdXJhdGlvbnRpbWVfYm9va2luZ19kYXRhX2V4cG9ydGVyLCB7IG9uY2U6IHRydWUgfSApO1xyXG5cdH1cclxuXHJcbn0pKCB3aW5kb3csIGRvY3VtZW50ICk7XHJcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDLFVBQVVBLENBQUMsRUFBRUMsQ0FBQyxFQUFFO0VBQ2hCLFlBQVk7O0VBRVosSUFBSUMsSUFBSSxHQUFPRixDQUFDLENBQUNHLGFBQWEsSUFBSSxDQUFDLENBQUM7RUFDcEMsSUFBSUMsUUFBUSxHQUFHRixJQUFJLENBQUNHLGdDQUFnQztFQUNwRCxJQUFJQyxJQUFJLEdBQU9KLElBQUksQ0FBQ0ssbUJBQW1CLElBQUksSUFBSTtFQUMvQyxJQUFJQyxJQUFJLEdBQVFOLElBQUksSUFBSUEsSUFBSSxDQUFDTSxJQUFJLEdBQUlOLElBQUksQ0FBQ00sSUFBSSxHQUFHLElBQUk7RUFFckQsSUFBSyxDQUFDSixRQUFRLElBQUksT0FBT0EsUUFBUSxDQUFDSyxRQUFRLEtBQUssVUFBVSxJQUFJLENBQUNILElBQUksSUFBSSxDQUFDRSxJQUFJLEVBQUc7SUFDN0UsSUFBS1IsQ0FBQyxDQUFDVSxLQUFLLElBQUlWLENBQUMsQ0FBQ1UsS0FBSyxDQUFDQyxHQUFHLElBQUlYLENBQUMsQ0FBQ1UsS0FBSyxDQUFDQyxHQUFHLENBQUNDLEtBQUssRUFBRztNQUNs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
