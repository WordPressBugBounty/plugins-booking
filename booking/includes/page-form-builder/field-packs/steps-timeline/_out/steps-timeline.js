"use strict";

// File: /includes/page-form-builder/field-packs/steps-timeline/_out/steps-timeline.js
(function (w, d) {
  'use strict';

  var Core = w.WPBC_BFB_Core || {};
  var registry = Core.WPBC_BFB_Field_Renderer_Registry;
  var Base = Core.WPBC_BFB_Field_Base;
  if (!registry || typeof registry.register !== 'function' || !Base) {
    _wpbc?.dev?.error?.('wpbc_bfb_field_steps_timeline', 'Core registry/base missing');
    return;
  }

  /**
   * Field Renderer: steps_timeline
   * - Renders states: "completed", "active", "future"
   * - Adds active connector segments via ".wpbc_steps_for_timeline_line_active"
   * - Scopes color with legacy class suffix + inline CSS var injection
   *
   * @class wpbc_bfb_field_steps_timeline
   * @extends Core.WPBC_BFB_Field_Base
   */
  class wpbc_bfb_field_steps_timeline extends Base {
    /**
     * Return default props for "steps_timeline".
     * Must stay in sync with PHP schema defaults.
     *
     * @jDoc
     * @returns {{type:string,steps_count:number,active_step:number,color:string,cssclass_extra:string,name:string,html_id:string,help:string,usage_key:string}}
     */
    static get_defaults() {
      return {
        type: 'steps_timeline',
        steps_count: 3,
        active_step: 1,
        color: '#619d40',
        cssclass_extra: '',
        name: '',
        html_id: '',
        help: '',
        usage_key: 'steps_timeline'
      };
    }

    /**
     * Clamp integer into [min,max], falling back to def if NaN.
     *
     * @jDoc
     * @param {any} v    Raw value to clamp.
     * @param {number} min Minimum allowed value.
     * @param {number} max Maximum allowed value.
     * @param {number} def Default to use if v is NaN.
     * @returns {number} Clamped integer.
     */
    static clamp_int(v, min, max, def) {
      var n = parseInt(v, 10);
      if (isNaN(n)) {
        n = def;
      }
      if (n < min) {
        n = min;
      }
      if (n > max) {
        n = max;
      }
      return n;
    }

    /**
     * Create a stable per-element numeric suffix used in the scoped class name.
     * Persists in element dataset to remain stable across re-renders.
     *
     * @jDoc
     * @param {HTMLElement} el Field wrapper element.
     * @returns {string} Numeric suffix (e.g., "6614").
     */
    static ensure_scope_suffix(el) {
      var suffix = el && el.dataset ? el.dataset.steps_scope_suffix : '';
      if (suffix) {
        return suffix;
      }
      try {
        var stab = el.getAttribute('data-id') || el.getAttribute('data-name') || '';
        if (stab) {
          var m = String(stab).match(/(\d{3,})$/);
          suffix = m ? m[1] : String(Math.floor(Math.random() * 9000) + 1000);
        } else {
          suffix = String(Math.floor(Math.random() * 9000) + 1000);
        }
      } catch (e) {
        suffix = String(Math.floor(Math.random() * 9000) + 1000);
      }
      if (el && el.dataset) {
        el.dataset.steps_scope_suffix = suffix;
      }
      return suffix;
    }

    /**
     * Build a step node by visual state.
     *
     * @jDoc
     * @param {'completed'|'active'|'future'} state Step visual state.
     * @returns {string} HTML string of a single step node.
     */
    static build_step_node_html(state) {
      var cls = 'wpbc_steps_for_timeline_step';
      if (state === 'completed') {
        cls += ' wpbc_steps_for_timeline_step_completed';
      }
      if (state === 'active') {
        cls += ' wpbc_steps_for_timeline_step_active';
      }
      return '' + '<div class="' + cls + '">' + '<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" role="img" class="icon icon-success" aria-hidden="true" width="10" height="10">' + '<path fill="currentColor" d="M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z"></path>' + '</svg>' + '<svg viewBox="0 0 352 512" xmlns="http://www.w3.org/2000/svg" role="img" class="icon icon-failed" aria-hidden="true" width="8" height="11">' + '<path fill="currentColor" d="M242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28 75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256 9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.2 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.2 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48L242.72 256z"></path>' + '</svg>' + '</div>';
    }

    /**
     * Build connector line, optionally marked as active (completed segment).
     *
     * @jDoc
     * @param {boolean} is_active True to add "wpbc_steps_for_timeline_line_active".
     * @returns {string} HTML string for a connector line.
     */
    static build_step_line_html(is_active) {
      var cls = 'wpbc_steps_for_timeline_step_line';
      if (is_active) {
        cls += ' wpbc_steps_for_timeline_line_active';
      }
      return '<div class="' + cls + '"></div>';
    }

    /**
     * Render the preview markup into the field element.
     * - Generates `.wpbc_steps_for_timeline__steps_timeline{suffix}` scope class (legacy "timline" spelling).
     * - Injects scoped CSS variable rule for front-end: `.booking_form_div .{scope} .wpbc_steps_for_timeline_container{ --wpbc_steps_for_timeline_active_color:#hex; }`
     * - Adds minimal base CSS once if external CSS not enqueued.
     *
     * @jDoc
     * @param {HTMLElement} el Field root element inside the canvas.
     * @param {Object} data Field props (already normalized by schema).
     * @param {{builder?:any, sanit?:any}} [ctx]  Context object.
     * @returns {void}
     */
    static render(el, data, ctx) {
      if (!el) {
        return;
      }
      var d = this.normalize_data(data);
      var esc_html = v => Core.WPBC_BFB_Sanitize.escape_html(v);
      var sanitize_id = v => Core.WPBC_BFB_Sanitize.sanitize_html_id(v);
      var sanitize_name = v => Core.WPBC_BFB_Sanitize.sanitize_html_name(v);
      var sanitize_cls = v => Core.WPBC_BFB_Sanitize.sanitize_css_classlist(v);
      var sanitize_hex = v => Core.WPBC_BFB_Sanitize.sanitize_hex_color(v, '#619d40');
      var steps_count = wpbc_bfb_field_steps_timeline.clamp_int(d.steps_count, 2, 12, 3);
      var active_step = wpbc_bfb_field_steps_timeline.clamp_int(d.active_step, 1, steps_count, 1);
      var color_val = sanitize_hex(d.color);
      var html_id = d.html_id ? sanitize_id(String(d.html_id)) : '';
      var name_val = d.name ? sanitize_name(String(d.name)) : '';
      var cls_extra = sanitize_cls(String(d.cssclass_extra || ''));
      if (String(el.dataset.steps_count) !== String(steps_count)) {
        el.dataset.steps_count = String(steps_count);
      }
      if (String(el.dataset.active_step) !== String(active_step)) {
        el.dataset.active_step = String(active_step);
      }
      if (el.dataset.color !== color_val) {
        el.dataset.color = color_val;
      }
      if (el.dataset.cssclass_extra !== cls_extra) {
        el.dataset.cssclass_extra = cls_extra;
      }
      if (el.dataset.html_id !== html_id) {
        el.dataset.html_id = html_id;
      }
      if (el.dataset.name !== name_val) {
        el.dataset.name = name_val;
      }

      // Scope class with legacy "timline" spelling + numeric suffix
      var scope_suffix = wpbc_bfb_field_steps_timeline.ensure_scope_suffix(el);
      var scope_cls = 'wpbc_steps_for_timeline__steps_timeline' + scope_suffix;
      var id_attr = html_id ? ' id="' + esc_html(html_id) + '"' : '';
      var name_attr = name_val ? ' name="' + esc_html(name_val) + '"' : '';
      var cls_attr = cls_extra ? ' class="' + esc_html(cls_extra) + '"' : '';

      // Build markup with states + active lines BEFORE the active step
      var parts = [];
      for (var i = 1; i <= steps_count; i++) {
        var state = i < active_step ? 'completed' : i === active_step ? 'active' : 'future';
        parts.push(wpbc_bfb_field_steps_timeline.build_step_node_html(state));
        if (i < steps_count) {
          var is_active_line = i < active_step;
          parts.push(wpbc_bfb_field_steps_timeline.build_step_line_html(is_active_line));
        }
      }
      var help_html = d.help ? '<div class="wpbc_bfb__help">' + esc_html(String(d.help)) + '</div>' : '';

      // Scoped inline CSS rule for frontend (within .booking_form_div)
      var style_id = 'wpbc_bfb_steps_timeline_style__' + scope_suffix;
      var css_rule = '.booking_form_div .' + scope_cls + ' .wpbc_steps_for_timeline_container{' + '--wpbc_steps_for_timeline_active_color:' + esc_html(color_val) + ';' + '}';
      el.innerHTML = '<style id="' + style_id + '">' + css_rule + '</style>' + '<span class="' + scope_cls + ' wpbc_bfb__no-drag-zone" inert="">' + '<div class="wpbc_steps_for_timeline_container"' + id_attr + name_attr + cls_attr + ' style="--wpbc_steps_for_timeline_active_color:' + esc_html(color_val) + ';">' + '<div class="wpbc_steps_for_timeline" role="list" aria-label="Steps timeline">' + parts.join('') + '</div>' + '</div>' + help_html + '</span>';
      Core.UI?.WPBC_BFB_Overlay?.ensure?.(ctx?.builder, el);
    }

    /**
     * Optional hook executed after field is dropped from the palette.
     * Keeps base behavior (auto-name, auto-id).
     *
     * @jDoc
     * @param {Object} data Field data snapshot.
     * @param {HTMLElement} el Field element.
     * @param {{palette_item?: HTMLElement}} [ctx] Context with palette_item.
     * @returns {void}
     */
    static on_field_drop(data, el, ctx) {
      try {
        super.on_field_drop?.(data, el, ctx);
      } catch (e) {}
    }
  }

  // Register renderer.
  try {
    registry.register('steps_timeline', wpbc_bfb_field_steps_timeline);
  } catch (e) {
    _wpbc?.dev?.error?.('wpbc_bfb_field_steps_timeline.register', e);
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Form" (Advanced Form shortcode)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Register Booking Form exporter callback (Advanced Form) for "steps_timeline".
   *
   * This exporter:
   *  - Emits the legacy shortcode:
   *        [steps_timeline steps_count="N" active_step="K" color="#hex"]
   *    wrapped optionally in:
   *        <span id="…" class="…" style="flex:1;">…</span>
   *  - Keeps behavior compatible with the previous centralized exporter:
   *      • clamps steps_count to [2,12] (default 3),
   *      • clamps active_step to [1,steps_count] (default 1),
   *      • sanitizes color via sanitize_hex_color() with default "#619d40",
   *      • ensures unique html_id via extras.ctx.usedIds (if provided),
   *      • renders help inline inside the wrapper and clears field.help
   *        to prevent outer duplication.
   */
  function register_steps_timeline_booking_form_exporter() {
    var Exp = w.WPBC_BFB_Exporter;
    if (!Exp || typeof Exp.register !== 'function') {
      return;
    }
    if (typeof Exp.has_exporter === 'function' && Exp.has_exporter('steps_timeline')) {
      return;
    }
    var S = Core.WPBC_BFB_Sanitize || {};
    var esc_html = S.escape_html || function (v) {
      return String(v).replace(/[<>&"]/g, '');
    };
    var sanitizeId = S.sanitize_html_id || function (v) {
      return String(v).trim();
    };
    var sanitizeCls = S.sanitize_css_classlist || function (v) {
      return String(v).trim();
    };
    var sanitizeHex = S.sanitize_hex_color || function (v, def) {
      if (typeof v === 'string' && /^#?[0-9a-f]{3,8}$/i.test(v)) {
        return v.charAt(0) === '#' ? v : '#' + v;
      }
      return def || '#619d40';
    };

    /**
     * @type {WPBC_BFB_ExporterCallback}
     * @param {Object} field
     * @param {function(string):void} emit
     * @param {{ctx?:{usedIds?:Set<any>}}} [extras]
     */
    var exporter_callback = function (field, emit, extras) {
      extras = extras || {};

      // Clamp steps_count into [2,12], default 3 (legacy behavior).
      var sc = parseInt(field && field.steps_count, 10);
      if (isNaN(sc)) {
        sc = 3;
      }
      if (sc < 2) {
        sc = 2;
      }
      if (sc > 12) {
        sc = 12;
      }

      // Clamp active_step into [1,steps_count], default 1 (legacy behavior).
      var as = parseInt(field && field.active_step, 10);
      if (isNaN(as)) {
        as = 1;
      }
      if (as < 1) {
        as = 1;
      }
      if (as > sc) {
        as = sc;
      }

      // Sanitize color with default.
      var col = sanitizeHex(field && field.color, '#619d40');

      // Sanitize id/class for outer <span>.
      var html_id = field && field.html_id ? sanitizeId(String(field.html_id)) : '';
      var cls_raw = String(field && (field.cssclass_extra || field.cssclass || field['class']) || '');
      var cls_val = sanitizeCls(cls_raw);

      // Ensure html_id is unique across export (shared ctx.usedIds set).
      var used_ids = extras && extras.ctx && extras.ctx.usedIds;
      if (html_id && used_ids instanceof Set) {
        var unique = html_id;
        var i = 2;
        while (used_ids.has(unique)) {
          unique = html_id + '_' + i++;
        }
        used_ids.add(unique);
        html_id = unique;
      }
      var id_attr = html_id ? ' id="' + esc_html(html_id) + '"' : '';
      var cls_attr = cls_val ? ' class="' + esc_html(cls_val) + '"' : '';

      // Help inside the wrapper (legacy behavior).
      var help_html = field && field.help ? '<div class="wpbc_field_description">' + esc_html(String(field.help)) + '</div>' : '';

      // Only wrap in <span ... style="flex:1;"> if id or class exists.
      var has_wrapper = !!(id_attr || cls_attr);
      var open = has_wrapper ? '<span' + id_attr + cls_attr + ' style="flex:1;">' : '';
      var close = has_wrapper ? '</span>' : '';

      // Legacy shortcode name spelling is intentional: "steps_timeline".
      emit(open + '[steps_timeline steps_count="' + sc + '" active_step="' + as + '" color="' + col + '"]' + help_html + close);

      // Prevent outer wrapper from printing help again.
      if (field) {
        field.help = '';
      }
    };
    Exp.register('steps_timeline', exporter_callback);
  }
  if (w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function') {
    register_steps_timeline_booking_form_exporter();
  } else {
    d.addEventListener('wpbc:bfb:exporter-ready', register_steps_timeline_booking_form_exporter, {
      once: true
    });
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Data" (Content of booking fields data)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Register Booking Data exporter callback ("Content of booking fields data") for "steps_timeline".
   *
   * Steps Timeline is purely presentational and does not carry user-entered values,
   * so it is intentionally omitted from the "Content of booking fields data" output.
   */
  function register_steps_timeline_booking_data_exporter() {
    var C = w.WPBC_BFB_ContentExporter;
    if (!C || typeof C.register !== 'function') {
      return;
    }
    if (typeof C.has_exporter === 'function' && C.has_exporter('steps_timeline')) {
      return;
    }

    /**
     * @param {Object} field
     * @param {function(string):void} emit
     * @param {Object} [extras]
     * @returns {void}
     */
    var exporter_callback = function (field, emit, extras) {
      // Intentionally empty: steps_timeline has no dynamic token/value
      // to show in booking data.
      return;
    };
    C.register('steps_timeline', exporter_callback);
  }
  if (w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function') {
    register_steps_timeline_booking_data_exporter();
  } else {
    d.addEventListener('wpbc:bfb:content-exporter-ready', register_steps_timeline_booking_data_exporter, {
      once: true
    });
  }
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3Mvc3RlcHMtdGltZWxpbmUvX291dC9zdGVwcy10aW1lbGluZS5qcyIsIm5hbWVzIjpbInciLCJkIiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJyZWdpc3RyeSIsIldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5IiwiQmFzZSIsIldQQkNfQkZCX0ZpZWxkX0Jhc2UiLCJyZWdpc3RlciIsIl93cGJjIiwiZGV2IiwiZXJyb3IiLCJ3cGJjX2JmYl9maWVsZF9zdGVwc190aW1lbGluZSIsImdldF9kZWZhdWx0cyIsInR5cGUiLCJzdGVwc19jb3VudCIsImFjdGl2ZV9zdGVwIiwiY29sb3IiLCJjc3NjbGFzc19leHRyYSIsIm5hbWUiLCJodG1sX2lkIiwiaGVscCIsInVzYWdlX2tleSIsImNsYW1wX2ludCIsInYiLCJtaW4iLCJtYXgiLCJkZWYiLCJuIiwicGFyc2VJbnQiLCJpc05hTiIsImVuc3VyZV9zY29wZV9zdWZmaXgiLCJlbCIsInN1ZmZpeCIsImRhdGFzZXQiLCJzdGVwc19zY29wZV9zdWZmaXgiLCJzdGFiIiwiZ2V0QXR0cmlidXRlIiwibSIsIlN0cmluZyIsIm1hdGNoIiwiTWF0aCIsImZsb29yIiwicmFuZG9tIiwiZSIsImJ1aWxkX3N0ZXBfbm9kZV9odG1sIiwic3RhdGUiLCJjbHMiLCJidWlsZF9zdGVwX2xpbmVfaHRtbCIsImlzX2FjdGl2ZSIsInJlbmRlciIsImRhdGEiLCJjdHgiLCJub3JtYWxpemVfZGF0YSIsImVzY19odG1sIiwiV1BCQ19CRkJfU2FuaXRpemUiLCJlc2NhcGVfaHRtbCIsInNhbml0aXplX2lkIiwic2FuaXRpemVfaHRtbF9pZCIsInNhbml0aXplX25hbWUiLCJzYW5pdGl6ZV9odG1sX25hbWUiLCJzYW5pdGl6ZV9jbHMiLCJzYW5pdGl6ZV9jc3NfY2xhc3NsaXN0Iiwic2FuaXRpemVfaGV4Iiwic2FuaXRpemVfaGV4X2NvbG9yIiwiY29sb3JfdmFsIiwibmFtZV92YWwiLCJjbHNfZXh0cmEiLCJzY29wZV9zdWZmaXgiLCJzY29wZV9jbHMiLCJpZF9hdHRyIiwibmFtZV9hdHRyIiwiY2xzX2F0dHIiLCJwYXJ0cyIsImkiLCJwdXNoIiwiaXNfYWN0aXZlX2xpbmUiLCJoZWxwX2h0bWwiLCJzdHlsZV9pZCIsImNzc19ydWxlIiwiaW5uZXJIVE1MIiwiam9pbiIsIlVJIiwiV1BCQ19CRkJfT3ZlcmxheSIsImVuc3VyZSIsImJ1aWxkZXIiLCJvbl9maWVsZF9kcm9wIiwicmVnaXN0ZXJfc3RlcHNfdGltZWxpbmVfYm9va2luZ19mb3JtX2V4cG9ydGVyIiwiRXhwIiwiV1BCQ19CRkJfRXhwb3J0ZXIiLCJoYXNfZXhwb3J0ZXIiLCJTIiwicmVwbGFjZSIsInNhbml0aXplSWQiLCJ0cmltIiwic2FuaXRpemVDbHMiLCJzYW5pdGl6ZUhleCIsInRlc3QiLCJjaGFyQXQiLCJleHBvcnRlcl9jYWxsYmFjayIsImZpZWxkIiwiZW1pdCIsImV4dHJhcyIsInNjIiwiYXMiLCJjb2wiLCJjbHNfcmF3IiwiY3NzY2xhc3MiLCJjbHNfdmFsIiwidXNlZF9pZHMiLCJ1c2VkSWRzIiwiU2V0IiwidW5pcXVlIiwiaGFzIiwiYWRkIiwiaGFzX3dyYXBwZXIiLCJvcGVuIiwiY2xvc2UiLCJhZGRFdmVudExpc3RlbmVyIiwib25jZSIsInJlZ2lzdGVyX3N0ZXBzX3RpbWVsaW5lX2Jvb2tpbmdfZGF0YV9leHBvcnRlciIsIkMiLCJXUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIiLCJ3aW5kb3ciLCJkb2N1bWVudCJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2ZpZWxkLXBhY2tzL3N0ZXBzLXRpbWVsaW5lL19zcmMvc3RlcHMtdGltZWxpbmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gRmlsZTogL2luY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2ZpZWxkLXBhY2tzL3N0ZXBzLXRpbWVsaW5lL19vdXQvc3RlcHMtdGltZWxpbmUuanNcclxuKGZ1bmN0aW9uICh3LCBkKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHR2YXIgQ29yZSAgICAgPSB3LldQQkNfQkZCX0NvcmUgfHwge307XHJcblx0dmFyIHJlZ2lzdHJ5ID0gQ29yZS5XUEJDX0JGQl9GaWVsZF9SZW5kZXJlcl9SZWdpc3RyeTtcclxuXHR2YXIgQmFzZSAgICAgPSBDb3JlLldQQkNfQkZCX0ZpZWxkX0Jhc2U7XHJcblxyXG5cdGlmICggISByZWdpc3RyeSB8fCB0eXBlb2YgcmVnaXN0cnkucmVnaXN0ZXIgIT09ICdmdW5jdGlvbicgfHwgISBCYXNlICkge1xyXG5cdFx0X3dwYmM/LmRldj8uZXJyb3I/LiggJ3dwYmNfYmZiX2ZpZWxkX3N0ZXBzX3RpbWVsaW5lJywgJ0NvcmUgcmVnaXN0cnkvYmFzZSBtaXNzaW5nJyApO1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogRmllbGQgUmVuZGVyZXI6IHN0ZXBzX3RpbWVsaW5lXHJcblx0ICogLSBSZW5kZXJzIHN0YXRlczogXCJjb21wbGV0ZWRcIiwgXCJhY3RpdmVcIiwgXCJmdXR1cmVcIlxyXG5cdCAqIC0gQWRkcyBhY3RpdmUgY29ubmVjdG9yIHNlZ21lbnRzIHZpYSBcIi53cGJjX3N0ZXBzX2Zvcl90aW1lbGluZV9saW5lX2FjdGl2ZVwiXHJcblx0ICogLSBTY29wZXMgY29sb3Igd2l0aCBsZWdhY3kgY2xhc3Mgc3VmZml4ICsgaW5saW5lIENTUyB2YXIgaW5qZWN0aW9uXHJcblx0ICpcclxuXHQgKiBAY2xhc3Mgd3BiY19iZmJfZmllbGRfc3RlcHNfdGltZWxpbmVcclxuXHQgKiBAZXh0ZW5kcyBDb3JlLldQQkNfQkZCX0ZpZWxkX0Jhc2VcclxuXHQgKi9cclxuXHRjbGFzcyB3cGJjX2JmYl9maWVsZF9zdGVwc190aW1lbGluZSBleHRlbmRzIEJhc2Uge1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmV0dXJuIGRlZmF1bHQgcHJvcHMgZm9yIFwic3RlcHNfdGltZWxpbmVcIi5cclxuXHRcdCAqIE11c3Qgc3RheSBpbiBzeW5jIHdpdGggUEhQIHNjaGVtYSBkZWZhdWx0cy5cclxuXHRcdCAqXHJcblx0XHQgKiBAakRvY1xyXG5cdFx0ICogQHJldHVybnMge3t0eXBlOnN0cmluZyxzdGVwc19jb3VudDpudW1iZXIsYWN0aXZlX3N0ZXA6bnVtYmVyLGNvbG9yOnN0cmluZyxjc3NjbGFzc19leHRyYTpzdHJpbmcsbmFtZTpzdHJpbmcsaHRtbF9pZDpzdHJpbmcsaGVscDpzdHJpbmcsdXNhZ2Vfa2V5OnN0cmluZ319XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBnZXRfZGVmYXVsdHMoKSB7XHJcblx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0dHlwZSAgICAgICAgICAgIDogJ3N0ZXBzX3RpbWVsaW5lJyxcclxuXHRcdFx0XHRzdGVwc19jb3VudCAgICAgOiAzLFxyXG5cdFx0XHRcdGFjdGl2ZV9zdGVwICAgICA6IDEsXHJcblx0XHRcdFx0Y29sb3IgICAgICAgICAgIDogJyM2MTlkNDAnLFxyXG5cdFx0XHRcdGNzc2NsYXNzX2V4dHJhICA6ICcnLFxyXG5cdFx0XHRcdG5hbWUgICAgICAgICAgICA6ICcnLFxyXG5cdFx0XHRcdGh0bWxfaWQgICAgICAgICA6ICcnLFxyXG5cdFx0XHRcdGhlbHAgICAgICAgICAgICA6ICcnLFxyXG5cdFx0XHRcdHVzYWdlX2tleSAgICAgICA6ICdzdGVwc190aW1lbGluZSdcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENsYW1wIGludGVnZXIgaW50byBbbWluLG1heF0sIGZhbGxpbmcgYmFjayB0byBkZWYgaWYgTmFOLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBqRG9jXHJcblx0XHQgKiBAcGFyYW0ge2FueX0gdiAgICBSYXcgdmFsdWUgdG8gY2xhbXAuXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gbWluIE1pbmltdW0gYWxsb3dlZCB2YWx1ZS5cclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBtYXggTWF4aW11bSBhbGxvd2VkIHZhbHVlLlxyXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGRlZiBEZWZhdWx0IHRvIHVzZSBpZiB2IGlzIE5hTi5cclxuXHRcdCAqIEByZXR1cm5zIHtudW1iZXJ9IENsYW1wZWQgaW50ZWdlci5cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGNsYW1wX2ludCggdiwgbWluLCBtYXgsIGRlZiApIHtcclxuXHRcdFx0dmFyIG4gPSBwYXJzZUludCggdiwgMTAgKTtcclxuXHRcdFx0aWYgKCBpc05hTiggbiApICkgeyBuID0gZGVmOyB9XHJcblx0XHRcdGlmICggbiA8IG1pbiApIHsgbiA9IG1pbjsgfVxyXG5cdFx0XHRpZiAoIG4gPiBtYXggKSB7IG4gPSBtYXg7IH1cclxuXHRcdFx0cmV0dXJuIG47XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDcmVhdGUgYSBzdGFibGUgcGVyLWVsZW1lbnQgbnVtZXJpYyBzdWZmaXggdXNlZCBpbiB0aGUgc2NvcGVkIGNsYXNzIG5hbWUuXHJcblx0XHQgKiBQZXJzaXN0cyBpbiBlbGVtZW50IGRhdGFzZXQgdG8gcmVtYWluIHN0YWJsZSBhY3Jvc3MgcmUtcmVuZGVycy5cclxuXHRcdCAqXHJcblx0XHQgKiBAakRvY1xyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWwgRmllbGQgd3JhcHBlciBlbGVtZW50LlxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ30gTnVtZXJpYyBzdWZmaXggKGUuZy4sIFwiNjYxNFwiKS5cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGVuc3VyZV9zY29wZV9zdWZmaXgoIGVsICkge1xyXG5cdFx0XHR2YXIgc3VmZml4ID0gZWwgJiYgZWwuZGF0YXNldCA/IGVsLmRhdGFzZXQuc3RlcHNfc2NvcGVfc3VmZml4IDogJyc7XHJcblx0XHRcdGlmICggc3VmZml4ICkge1xyXG5cdFx0XHRcdHJldHVybiBzdWZmaXg7XHJcblx0XHRcdH1cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHR2YXIgc3RhYiA9IGVsLmdldEF0dHJpYnV0ZSggJ2RhdGEtaWQnICkgfHwgZWwuZ2V0QXR0cmlidXRlKCAnZGF0YS1uYW1lJyApIHx8ICcnO1xyXG5cdFx0XHRcdGlmICggc3RhYiApIHtcclxuXHRcdFx0XHRcdHZhciBtID0gU3RyaW5nKCBzdGFiICkubWF0Y2goIC8oXFxkezMsfSkkLyApO1xyXG5cdFx0XHRcdFx0c3VmZml4ID0gbSA/IG1bMV0gOiBTdHJpbmcoIE1hdGguZmxvb3IoIE1hdGgucmFuZG9tKCkgKiA5MDAwICkgKyAxMDAwICk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHN1ZmZpeCA9IFN0cmluZyggTWF0aC5mbG9vciggTWF0aC5yYW5kb20oKSAqIDkwMDAgKSArIDEwMDAgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gY2F0Y2ggKGUpIHtcclxuXHRcdFx0XHRzdWZmaXggPSBTdHJpbmcoIE1hdGguZmxvb3IoIE1hdGgucmFuZG9tKCkgKiA5MDAwICkgKyAxMDAwICk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBlbCAmJiBlbC5kYXRhc2V0ICkge1xyXG5cdFx0XHRcdGVsLmRhdGFzZXQuc3RlcHNfc2NvcGVfc3VmZml4ID0gc3VmZml4O1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBzdWZmaXg7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBCdWlsZCBhIHN0ZXAgbm9kZSBieSB2aXN1YWwgc3RhdGUuXHJcblx0XHQgKlxyXG5cdFx0ICogQGpEb2NcclxuXHRcdCAqIEBwYXJhbSB7J2NvbXBsZXRlZCd8J2FjdGl2ZSd8J2Z1dHVyZSd9IHN0YXRlIFN0ZXAgdmlzdWFsIHN0YXRlLlxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ30gSFRNTCBzdHJpbmcgb2YgYSBzaW5nbGUgc3RlcCBub2RlLlxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgYnVpbGRfc3RlcF9ub2RlX2h0bWwoIHN0YXRlICkge1xyXG5cdFx0XHR2YXIgY2xzID0gJ3dwYmNfc3RlcHNfZm9yX3RpbWVsaW5lX3N0ZXAnO1xyXG5cdFx0XHRpZiAoIHN0YXRlID09PSAnY29tcGxldGVkJyApIHsgY2xzICs9ICcgd3BiY19zdGVwc19mb3JfdGltZWxpbmVfc3RlcF9jb21wbGV0ZWQnOyB9XHJcblx0XHRcdGlmICggc3RhdGUgPT09ICdhY3RpdmUnICkgICAgeyBjbHMgKz0gJyB3cGJjX3N0ZXBzX2Zvcl90aW1lbGluZV9zdGVwX2FjdGl2ZSc7IH1cclxuXHJcblx0XHRcdHJldHVybiAnJyArXHJcblx0XHRcdFx0JzxkaXYgY2xhc3M9XCInICsgY2xzICsgJ1wiPicgK1xyXG5cdFx0XHRcdFx0Jzxzdmcgdmlld0JveD1cIjAgMCA1MTIgNTEyXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHJvbGU9XCJpbWdcIiBjbGFzcz1cImljb24gaWNvbi1zdWNjZXNzXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCIgd2lkdGg9XCIxMFwiIGhlaWdodD1cIjEwXCI+JyArXHJcblx0XHRcdFx0XHRcdCc8cGF0aCBmaWxsPVwiY3VycmVudENvbG9yXCIgZD1cIk0xNzMuODk4IDQzOS40MDRsLTE2Ni40LTE2Ni40Yy05Ljk5Ny05Ljk5Ny05Ljk5Ny0yNi4yMDYgMC0zNi4yMDRsMzYuMjAzLTM2LjIwNGM5Ljk5Ny05Ljk5OCAyNi4yMDctOS45OTggMzYuMjA0IDBMMTkyIDMxMi42OSA0MzIuMDk1IDcyLjU5NmM5Ljk5Ny05Ljk5NyAyNi4yMDctOS45OTcgMzYuMjA0IDBsMzYuMjAzIDM2LjIwNGM5Ljk5NyA5Ljk5NyA5Ljk5NyAyNi4yMDYgMCAzNi4yMDRsLTI5NC40IDI5NC40MDFjLTkuOTk4IDkuOTk3LTI2LjIwNyA5Ljk5Ny0zNi4yMDQtLjAwMXpcIj48L3BhdGg+JyArXHJcblx0XHRcdFx0XHQnPC9zdmc+JyArXHJcblx0XHRcdFx0XHQnPHN2ZyB2aWV3Qm94PVwiMCAwIDM1MiA1MTJcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgcm9sZT1cImltZ1wiIGNsYXNzPVwiaWNvbiBpY29uLWZhaWxlZFwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiIHdpZHRoPVwiOFwiIGhlaWdodD1cIjExXCI+JyArXHJcblx0XHRcdFx0XHRcdCc8cGF0aCBmaWxsPVwiY3VycmVudENvbG9yXCIgZD1cIk0yNDIuNzIgMjU2bDEwMC4wNy0xMDAuMDdjMTIuMjgtMTIuMjggMTIuMjgtMzIuMTkgMC00NC40OGwtMjIuMjQtMjIuMjRjLTEyLjI4LTEyLjI4LTMyLjE5LTEyLjI4LTQ0LjQ4IDBMMTc2IDE4OS4yOCA3NS45MyA4OS4yMWMtMTIuMjgtMTIuMjgtMzIuMTktMTIuMjgtNDQuNDggMEw5LjIxIDExMS40NWMtMTIuMjggMTIuMjgtMTIuMjggMzIuMTkgMCA0NC40OEwxMDkuMjggMjU2IDkuMjEgMzU2LjA3Yy0xMi4yOCAxMi4yOC0xMi4yOCAzMi4xOSAwIDQ0LjQ4bDIyLjI0IDIyLjI0YzEyLjI4IDEyLjI4IDMyLjIgMTIuMjggNDQuNDggMEwxNzYgMzIyLjcybDEwMC4wNyAxMDAuMDdjMTIuMjggMTIuMjggMzIuMiAxMi4yOCA0NC40OCAwbDIyLjI0LTIyLjI0YzEyLjI4LTEyLjI4IDEyLjI4LTMyLjE5IDAtNDQuNDhMMjQyLjcyIDI1NnpcIj48L3BhdGg+JyArXHJcblx0XHRcdFx0XHQnPC9zdmc+JyArXHJcblx0XHRcdFx0JzwvZGl2Pic7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBCdWlsZCBjb25uZWN0b3IgbGluZSwgb3B0aW9uYWxseSBtYXJrZWQgYXMgYWN0aXZlIChjb21wbGV0ZWQgc2VnbWVudCkuXHJcblx0XHQgKlxyXG5cdFx0ICogQGpEb2NcclxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfYWN0aXZlIFRydWUgdG8gYWRkIFwid3BiY19zdGVwc19mb3JfdGltZWxpbmVfbGluZV9hY3RpdmVcIi5cclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9IEhUTUwgc3RyaW5nIGZvciBhIGNvbm5lY3RvciBsaW5lLlxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgYnVpbGRfc3RlcF9saW5lX2h0bWwoIGlzX2FjdGl2ZSApIHtcclxuXHRcdFx0dmFyIGNscyA9ICd3cGJjX3N0ZXBzX2Zvcl90aW1lbGluZV9zdGVwX2xpbmUnO1xyXG5cdFx0XHRpZiAoIGlzX2FjdGl2ZSApIHsgY2xzICs9ICcgd3BiY19zdGVwc19mb3JfdGltZWxpbmVfbGluZV9hY3RpdmUnOyB9XHJcblx0XHRcdHJldHVybiAnPGRpdiBjbGFzcz1cIicgKyBjbHMgKyAnXCI+PC9kaXY+JztcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlbmRlciB0aGUgcHJldmlldyBtYXJrdXAgaW50byB0aGUgZmllbGQgZWxlbWVudC5cclxuXHRcdCAqIC0gR2VuZXJhdGVzIGAud3BiY19zdGVwc19mb3JfdGltZWxpbmVfX3N0ZXBzX3RpbWVsaW5le3N1ZmZpeH1gIHNjb3BlIGNsYXNzIChsZWdhY3kgXCJ0aW1saW5lXCIgc3BlbGxpbmcpLlxyXG5cdFx0ICogLSBJbmplY3RzIHNjb3BlZCBDU1MgdmFyaWFibGUgcnVsZSBmb3IgZnJvbnQtZW5kOiBgLmJvb2tpbmdfZm9ybV9kaXYgLntzY29wZX0gLndwYmNfc3RlcHNfZm9yX3RpbWVsaW5lX2NvbnRhaW5lcnsgLS13cGJjX3N0ZXBzX2Zvcl90aW1lbGluZV9hY3RpdmVfY29sb3I6I2hleDsgfWBcclxuXHRcdCAqIC0gQWRkcyBtaW5pbWFsIGJhc2UgQ1NTIG9uY2UgaWYgZXh0ZXJuYWwgQ1NTIG5vdCBlbnF1ZXVlZC5cclxuXHRcdCAqXHJcblx0XHQgKiBAakRvY1xyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWwgRmllbGQgcm9vdCBlbGVtZW50IGluc2lkZSB0aGUgY2FudmFzLlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGRhdGEgRmllbGQgcHJvcHMgKGFscmVhZHkgbm9ybWFsaXplZCBieSBzY2hlbWEpLlxyXG5cdFx0ICogQHBhcmFtIHt7YnVpbGRlcj86YW55LCBzYW5pdD86YW55fX0gW2N0eF0gIENvbnRleHQgb2JqZWN0LlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyByZW5kZXIoIGVsLCBkYXRhLCBjdHggKSB7XHJcblx0XHRcdGlmICggISBlbCApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHR2YXIgZCAgICAgICAgICAgID0gdGhpcy5ub3JtYWxpemVfZGF0YSggZGF0YSApO1xyXG5cdFx0XHR2YXIgZXNjX2h0bWwgICAgID0gKHYpID0+IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuZXNjYXBlX2h0bWwoIHYgKTtcclxuXHRcdFx0dmFyIHNhbml0aXplX2lkICA9ICh2KSA9PiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2h0bWxfaWQoIHYgKTtcclxuXHRcdFx0dmFyIHNhbml0aXplX25hbWU9ICh2KSA9PiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2h0bWxfbmFtZSggdiApO1xyXG5cdFx0XHR2YXIgc2FuaXRpemVfY2xzID0gKHYpID0+IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuc2FuaXRpemVfY3NzX2NsYXNzbGlzdCggdiApO1xyXG5cdFx0XHR2YXIgc2FuaXRpemVfaGV4ID0gKHYpID0+IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuc2FuaXRpemVfaGV4X2NvbG9yKCB2LCAnIzYxOWQ0MCcgKTtcclxuXHJcblx0XHRcdHZhciBzdGVwc19jb3VudCAgPSB3cGJjX2JmYl9maWVsZF9zdGVwc190aW1lbGluZS5jbGFtcF9pbnQoIGQuc3RlcHNfY291bnQsIDIsIDEyLCAzICk7XHJcblx0XHRcdHZhciBhY3RpdmVfc3RlcCAgPSB3cGJjX2JmYl9maWVsZF9zdGVwc190aW1lbGluZS5jbGFtcF9pbnQoIGQuYWN0aXZlX3N0ZXAsIDEsIHN0ZXBzX2NvdW50LCAxICk7XHJcblx0XHRcdHZhciBjb2xvcl92YWwgICAgPSBzYW5pdGl6ZV9oZXgoIGQuY29sb3IgKTtcclxuXHJcblx0XHRcdHZhciBodG1sX2lkICAgICAgPSBkLmh0bWxfaWQgPyBzYW5pdGl6ZV9pZCggU3RyaW5nKCBkLmh0bWxfaWQgKSApIDogJyc7XHJcblx0XHRcdHZhciBuYW1lX3ZhbCAgICAgPSBkLm5hbWUgICAgPyBzYW5pdGl6ZV9uYW1lKCBTdHJpbmcoIGQubmFtZSApICkgIDogJyc7XHJcblx0XHRcdHZhciBjbHNfZXh0cmEgICAgPSBzYW5pdGl6ZV9jbHMoIFN0cmluZyggZC5jc3NjbGFzc19leHRyYSB8fCAnJyApICk7XHJcblxyXG5cdFx0XHRpZiAoIFN0cmluZyggZWwuZGF0YXNldC5zdGVwc19jb3VudCApICE9PSBTdHJpbmcoIHN0ZXBzX2NvdW50ICkgKSB7IGVsLmRhdGFzZXQuc3RlcHNfY291bnQgPSBTdHJpbmcoIHN0ZXBzX2NvdW50ICk7IH1cclxuXHRcdFx0aWYgKCBTdHJpbmcoIGVsLmRhdGFzZXQuYWN0aXZlX3N0ZXAgKSAhPT0gU3RyaW5nKCBhY3RpdmVfc3RlcCApICkgeyBlbC5kYXRhc2V0LmFjdGl2ZV9zdGVwID0gU3RyaW5nKCBhY3RpdmVfc3RlcCApOyB9XHJcblx0XHRcdGlmICggZWwuZGF0YXNldC5jb2xvciAhPT0gY29sb3JfdmFsICkgeyBlbC5kYXRhc2V0LmNvbG9yID0gY29sb3JfdmFsOyB9XHJcblx0XHRcdGlmICggZWwuZGF0YXNldC5jc3NjbGFzc19leHRyYSAhPT0gY2xzX2V4dHJhICkgeyBlbC5kYXRhc2V0LmNzc2NsYXNzX2V4dHJhID0gY2xzX2V4dHJhOyB9XHJcblx0XHRcdGlmICggZWwuZGF0YXNldC5odG1sX2lkICE9PSBodG1sX2lkICkgeyBlbC5kYXRhc2V0Lmh0bWxfaWQgPSBodG1sX2lkOyB9XHJcblx0XHRcdGlmICggZWwuZGF0YXNldC5uYW1lICE9PSBuYW1lX3ZhbCApIHsgZWwuZGF0YXNldC5uYW1lID0gbmFtZV92YWw7IH1cclxuXHJcblx0XHRcdC8vIFNjb3BlIGNsYXNzIHdpdGggbGVnYWN5IFwidGltbGluZVwiIHNwZWxsaW5nICsgbnVtZXJpYyBzdWZmaXhcclxuXHRcdFx0dmFyIHNjb3BlX3N1ZmZpeCA9IHdwYmNfYmZiX2ZpZWxkX3N0ZXBzX3RpbWVsaW5lLmVuc3VyZV9zY29wZV9zdWZmaXgoIGVsICk7XHJcblx0XHRcdHZhciBzY29wZV9jbHMgICAgPSAnd3BiY19zdGVwc19mb3JfdGltZWxpbmVfX3N0ZXBzX3RpbWVsaW5lJyArIHNjb3BlX3N1ZmZpeDtcclxuXHJcblx0XHRcdHZhciBpZF9hdHRyICAgICAgPSBodG1sX2lkID8gJyBpZD1cIicgKyBlc2NfaHRtbCggaHRtbF9pZCApICsgJ1wiJyA6ICcnO1xyXG5cdFx0XHR2YXIgbmFtZV9hdHRyICAgID0gbmFtZV92YWwgPyAnIG5hbWU9XCInICsgZXNjX2h0bWwoIG5hbWVfdmFsICkgKyAnXCInIDogJyc7XHJcblx0XHRcdHZhciBjbHNfYXR0ciAgICAgPSBjbHNfZXh0cmEgPyAnIGNsYXNzPVwiJyArIGVzY19odG1sKCBjbHNfZXh0cmEgKSArICdcIicgOiAnJztcclxuXHJcblx0XHRcdC8vIEJ1aWxkIG1hcmt1cCB3aXRoIHN0YXRlcyArIGFjdGl2ZSBsaW5lcyBCRUZPUkUgdGhlIGFjdGl2ZSBzdGVwXHJcblx0XHRcdHZhciBwYXJ0cyA9IFtdO1xyXG5cdFx0XHRmb3IgKCB2YXIgaSA9IDE7IGkgPD0gc3RlcHNfY291bnQ7IGkrKyApIHtcclxuXHRcdFx0XHR2YXIgc3RhdGUgPSAoaSA8IGFjdGl2ZV9zdGVwKSA/ICdjb21wbGV0ZWQnIDogKGkgPT09IGFjdGl2ZV9zdGVwID8gJ2FjdGl2ZScgOiAnZnV0dXJlJyk7XHJcblx0XHRcdFx0cGFydHMucHVzaCggd3BiY19iZmJfZmllbGRfc3RlcHNfdGltZWxpbmUuYnVpbGRfc3RlcF9ub2RlX2h0bWwoIHN0YXRlICkgKTtcclxuXHRcdFx0XHRpZiAoIGkgPCBzdGVwc19jb3VudCApIHtcclxuXHRcdFx0XHRcdHZhciBpc19hY3RpdmVfbGluZSA9IChpIDwgYWN0aXZlX3N0ZXApO1xyXG5cdFx0XHRcdFx0cGFydHMucHVzaCggd3BiY19iZmJfZmllbGRfc3RlcHNfdGltZWxpbmUuYnVpbGRfc3RlcF9saW5lX2h0bWwoIGlzX2FjdGl2ZV9saW5lICkgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBoZWxwX2h0bWwgPSBkLmhlbHAgPyAnPGRpdiBjbGFzcz1cIndwYmNfYmZiX19oZWxwXCI+JyArIGVzY19odG1sKCBTdHJpbmcoIGQuaGVscCApICkgKyAnPC9kaXY+JyA6ICcnO1xyXG5cclxuXHRcdFx0Ly8gU2NvcGVkIGlubGluZSBDU1MgcnVsZSBmb3IgZnJvbnRlbmQgKHdpdGhpbiAuYm9va2luZ19mb3JtX2RpdilcclxuXHRcdFx0dmFyIHN0eWxlX2lkID0gJ3dwYmNfYmZiX3N0ZXBzX3RpbWVsaW5lX3N0eWxlX18nICsgc2NvcGVfc3VmZml4O1xyXG5cdFx0XHR2YXIgY3NzX3J1bGUgPSAnLmJvb2tpbmdfZm9ybV9kaXYgLicgKyBzY29wZV9jbHMgKyAnIC53cGJjX3N0ZXBzX2Zvcl90aW1lbGluZV9jb250YWluZXJ7JyArXHJcblx0XHRcdFx0Jy0td3BiY19zdGVwc19mb3JfdGltZWxpbmVfYWN0aXZlX2NvbG9yOicgKyBlc2NfaHRtbCggY29sb3JfdmFsICkgKyAnOycgK1xyXG5cdFx0XHQnfSc7XHJcblxyXG5cdFx0XHRlbC5pbm5lckhUTUwgPVxyXG5cdFx0XHRcdCc8c3R5bGUgaWQ9XCInICsgc3R5bGVfaWQgKyAnXCI+JyArIGNzc19ydWxlICsgJzwvc3R5bGU+JyArXHJcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwiJyArIHNjb3BlX2NscyArICcgd3BiY19iZmJfX25vLWRyYWctem9uZVwiIGluZXJ0PVwiXCI+JyArXHJcblx0XHRcdFx0XHQnPGRpdiBjbGFzcz1cIndwYmNfc3RlcHNfZm9yX3RpbWVsaW5lX2NvbnRhaW5lclwiJyArIGlkX2F0dHIgKyBuYW1lX2F0dHIgKyBjbHNfYXR0ciArXHJcblx0XHRcdFx0XHRcdCcgc3R5bGU9XCItLXdwYmNfc3RlcHNfZm9yX3RpbWVsaW5lX2FjdGl2ZV9jb2xvcjonICsgZXNjX2h0bWwoIGNvbG9yX3ZhbCApICsgJztcIj4nICtcclxuXHRcdFx0XHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjX3N0ZXBzX2Zvcl90aW1lbGluZVwiIHJvbGU9XCJsaXN0XCIgYXJpYS1sYWJlbD1cIlN0ZXBzIHRpbWVsaW5lXCI+JyArXHJcblx0XHRcdFx0XHRcdFx0cGFydHMuam9pbiggJycgKSArXHJcblx0XHRcdFx0XHRcdCc8L2Rpdj4nICtcclxuXHRcdFx0XHRcdCc8L2Rpdj4nICtcclxuXHRcdFx0XHRcdGhlbHBfaHRtbCArXHJcblx0XHRcdFx0Jzwvc3Bhbj4nO1xyXG5cclxuXHRcdFx0Q29yZS5VST8uV1BCQ19CRkJfT3ZlcmxheT8uZW5zdXJlPy4oIGN0eD8uYnVpbGRlciwgZWwgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE9wdGlvbmFsIGhvb2sgZXhlY3V0ZWQgYWZ0ZXIgZmllbGQgaXMgZHJvcHBlZCBmcm9tIHRoZSBwYWxldHRlLlxyXG5cdFx0ICogS2VlcHMgYmFzZSBiZWhhdmlvciAoYXV0by1uYW1lLCBhdXRvLWlkKS5cclxuXHRcdCAqXHJcblx0XHQgKiBAakRvY1xyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGRhdGEgRmllbGQgZGF0YSBzbmFwc2hvdC5cclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsIEZpZWxkIGVsZW1lbnQuXHJcblx0XHQgKiBAcGFyYW0ge3twYWxldHRlX2l0ZW0/OiBIVE1MRWxlbWVudH19IFtjdHhdIENvbnRleHQgd2l0aCBwYWxldHRlX2l0ZW0uXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIG9uX2ZpZWxkX2Ryb3AoIGRhdGEsIGVsLCBjdHggKSB7XHJcblx0XHRcdHRyeSB7IHN1cGVyLm9uX2ZpZWxkX2Ryb3A/LiggZGF0YSwgZWwsIGN0eCApOyB9IGNhdGNoIChlKSB7fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly8gUmVnaXN0ZXIgcmVuZGVyZXIuXHJcblx0dHJ5IHtcclxuXHRcdHJlZ2lzdHJ5LnJlZ2lzdGVyKCAnc3RlcHNfdGltZWxpbmUnLCB3cGJjX2JmYl9maWVsZF9zdGVwc190aW1lbGluZSApO1xyXG5cdH0gY2F0Y2ggKGUpIHsgX3dwYmM/LmRldj8uZXJyb3I/LiggJ3dwYmNfYmZiX2ZpZWxkX3N0ZXBzX3RpbWVsaW5lLnJlZ2lzdGVyJywgZSApOyB9XHJcblxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEV4cG9ydCBmb3IgXCJCb29raW5nIEZvcm1cIiAoQWR2YW5jZWQgRm9ybSBzaG9ydGNvZGUpXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvKipcclxuXHQgKiBSZWdpc3RlciBCb29raW5nIEZvcm0gZXhwb3J0ZXIgY2FsbGJhY2sgKEFkdmFuY2VkIEZvcm0pIGZvciBcInN0ZXBzX3RpbWVsaW5lXCIuXHJcblx0ICpcclxuXHQgKiBUaGlzIGV4cG9ydGVyOlxyXG5cdCAqICAtIEVtaXRzIHRoZSBsZWdhY3kgc2hvcnRjb2RlOlxyXG5cdCAqICAgICAgICBbc3RlcHNfdGltZWxpbmUgc3RlcHNfY291bnQ9XCJOXCIgYWN0aXZlX3N0ZXA9XCJLXCIgY29sb3I9XCIjaGV4XCJdXHJcblx0ICogICAgd3JhcHBlZCBvcHRpb25hbGx5IGluOlxyXG5cdCAqICAgICAgICA8c3BhbiBpZD1cIuKAplwiIGNsYXNzPVwi4oCmXCIgc3R5bGU9XCJmbGV4OjE7XCI+4oCmPC9zcGFuPlxyXG5cdCAqICAtIEtlZXBzIGJlaGF2aW9yIGNvbXBhdGlibGUgd2l0aCB0aGUgcHJldmlvdXMgY2VudHJhbGl6ZWQgZXhwb3J0ZXI6XHJcblx0ICogICAgICDigKIgY2xhbXBzIHN0ZXBzX2NvdW50IHRvIFsyLDEyXSAoZGVmYXVsdCAzKSxcclxuXHQgKiAgICAgIOKAoiBjbGFtcHMgYWN0aXZlX3N0ZXAgdG8gWzEsc3RlcHNfY291bnRdIChkZWZhdWx0IDEpLFxyXG5cdCAqICAgICAg4oCiIHNhbml0aXplcyBjb2xvciB2aWEgc2FuaXRpemVfaGV4X2NvbG9yKCkgd2l0aCBkZWZhdWx0IFwiIzYxOWQ0MFwiLFxyXG5cdCAqICAgICAg4oCiIGVuc3VyZXMgdW5pcXVlIGh0bWxfaWQgdmlhIGV4dHJhcy5jdHgudXNlZElkcyAoaWYgcHJvdmlkZWQpLFxyXG5cdCAqICAgICAg4oCiIHJlbmRlcnMgaGVscCBpbmxpbmUgaW5zaWRlIHRoZSB3cmFwcGVyIGFuZCBjbGVhcnMgZmllbGQuaGVscFxyXG5cdCAqICAgICAgICB0byBwcmV2ZW50IG91dGVyIGR1cGxpY2F0aW9uLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHJlZ2lzdGVyX3N0ZXBzX3RpbWVsaW5lX2Jvb2tpbmdfZm9ybV9leHBvcnRlcigpIHtcclxuXHJcblx0XHR2YXIgRXhwID0gdy5XUEJDX0JGQl9FeHBvcnRlcjtcclxuXHRcdGlmICggISBFeHAgfHwgdHlwZW9mIEV4cC5yZWdpc3RlciAhPT0gJ2Z1bmN0aW9uJyApIHsgcmV0dXJuOyB9XHJcblx0XHRpZiAoIHR5cGVvZiBFeHAuaGFzX2V4cG9ydGVyID09PSAnZnVuY3Rpb24nICYmIEV4cC5oYXNfZXhwb3J0ZXIoICdzdGVwc190aW1lbGluZScgKSApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0dmFyIFMgICAgICAgICAgID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZSB8fCB7fTtcclxuXHRcdHZhciBlc2NfaHRtbCAgICA9IFMuZXNjYXBlX2h0bWwgICAgICAgICAgICB8fCBmdW5jdGlvbiggdiApeyByZXR1cm4gU3RyaW5nKCB2ICkucmVwbGFjZSggL1s8PiZcIl0vZywgJycgKTsgfTtcclxuXHRcdHZhciBzYW5pdGl6ZUlkICA9IFMuc2FuaXRpemVfaHRtbF9pZCAgICAgICB8fCBmdW5jdGlvbiggdiApeyByZXR1cm4gU3RyaW5nKCB2ICkudHJpbSgpOyB9O1xyXG5cdFx0dmFyIHNhbml0aXplQ2xzID0gUy5zYW5pdGl6ZV9jc3NfY2xhc3NsaXN0IHx8IGZ1bmN0aW9uKCB2ICl7IHJldHVybiBTdHJpbmcoIHYgKS50cmltKCk7IH07XHJcblx0XHR2YXIgc2FuaXRpemVIZXggPSBTLnNhbml0aXplX2hleF9jb2xvciAgICAgfHwgZnVuY3Rpb24oIHYsIGRlZiApe1xyXG5cdFx0XHRpZiAoIHR5cGVvZiB2ID09PSAnc3RyaW5nJyAmJiAvXiM/WzAtOWEtZl17Myw4fSQvaS50ZXN0KCB2ICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuICggdi5jaGFyQXQoIDAgKSA9PT0gJyMnICkgPyB2IDogKCAnIycgKyB2ICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGRlZiB8fCAnIzYxOWQ0MCc7XHJcblx0XHR9O1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQHR5cGUge1dQQkNfQkZCX0V4cG9ydGVyQ2FsbGJhY2t9XHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZmllbGRcclxuXHRcdCAqIEBwYXJhbSB7ZnVuY3Rpb24oc3RyaW5nKTp2b2lkfSBlbWl0XHJcblx0XHQgKiBAcGFyYW0ge3tjdHg/Ont1c2VkSWRzPzpTZXQ8YW55Pn19fSBbZXh0cmFzXVxyXG5cdFx0ICovXHJcblx0XHR2YXIgZXhwb3J0ZXJfY2FsbGJhY2sgPSBmdW5jdGlvbiggZmllbGQsIGVtaXQsIGV4dHJhcyApIHtcclxuXHJcblx0XHRcdGV4dHJhcyA9IGV4dHJhcyB8fCB7fTtcclxuXHJcblx0XHRcdC8vIENsYW1wIHN0ZXBzX2NvdW50IGludG8gWzIsMTJdLCBkZWZhdWx0IDMgKGxlZ2FjeSBiZWhhdmlvcikuXHJcblx0XHRcdHZhciBzYyA9IHBhcnNlSW50KCBmaWVsZCAmJiBmaWVsZC5zdGVwc19jb3VudCwgMTAgKTtcclxuXHRcdFx0aWYgKCBpc05hTiggc2MgKSApIHsgc2MgPSAzOyB9XHJcblx0XHRcdGlmICggc2MgPCAyICkgeyBzYyA9IDI7IH1cclxuXHRcdFx0aWYgKCBzYyA+IDEyICkgeyBzYyA9IDEyOyB9XHJcblxyXG5cdFx0XHQvLyBDbGFtcCBhY3RpdmVfc3RlcCBpbnRvIFsxLHN0ZXBzX2NvdW50XSwgZGVmYXVsdCAxIChsZWdhY3kgYmVoYXZpb3IpLlxyXG5cdFx0XHR2YXIgYXMgPSBwYXJzZUludCggZmllbGQgJiYgZmllbGQuYWN0aXZlX3N0ZXAsIDEwICk7XHJcblx0XHRcdGlmICggaXNOYU4oIGFzICkgKSB7IGFzID0gMTsgfVxyXG5cdFx0XHRpZiAoIGFzIDwgMSApIHsgYXMgPSAxOyB9XHJcblx0XHRcdGlmICggYXMgPiBzYyApIHsgYXMgPSBzYzsgfVxyXG5cclxuXHRcdFx0Ly8gU2FuaXRpemUgY29sb3Igd2l0aCBkZWZhdWx0LlxyXG5cdFx0XHR2YXIgY29sID0gc2FuaXRpemVIZXgoIGZpZWxkICYmIGZpZWxkLmNvbG9yLCAnIzYxOWQ0MCcgKTtcclxuXHJcblx0XHRcdC8vIFNhbml0aXplIGlkL2NsYXNzIGZvciBvdXRlciA8c3Bhbj4uXHJcblx0XHRcdHZhciBodG1sX2lkID0gKCBmaWVsZCAmJiBmaWVsZC5odG1sX2lkICkgPyBzYW5pdGl6ZUlkKCBTdHJpbmcoIGZpZWxkLmh0bWxfaWQgKSApIDogJyc7XHJcblx0XHRcdHZhciBjbHNfcmF3ID0gU3RyaW5nKFxyXG5cdFx0XHRcdCggZmllbGQgJiYgKCBmaWVsZC5jc3NjbGFzc19leHRyYSB8fCBmaWVsZC5jc3NjbGFzcyB8fCBmaWVsZFsnY2xhc3MnXSApICkgfHwgJydcclxuXHRcdFx0KTtcclxuXHRcdFx0dmFyIGNsc192YWwgPSBzYW5pdGl6ZUNscyggY2xzX3JhdyApO1xyXG5cclxuXHRcdFx0Ly8gRW5zdXJlIGh0bWxfaWQgaXMgdW5pcXVlIGFjcm9zcyBleHBvcnQgKHNoYXJlZCBjdHgudXNlZElkcyBzZXQpLlxyXG5cdFx0XHR2YXIgdXNlZF9pZHMgPSBleHRyYXMgJiYgZXh0cmFzLmN0eCAmJiBleHRyYXMuY3R4LnVzZWRJZHM7XHJcblx0XHRcdGlmICggaHRtbF9pZCAmJiB1c2VkX2lkcyBpbnN0YW5jZW9mIFNldCApIHtcclxuXHRcdFx0XHR2YXIgdW5pcXVlID0gaHRtbF9pZDtcclxuXHRcdFx0XHR2YXIgaSAgICAgID0gMjtcclxuXHRcdFx0XHR3aGlsZSAoIHVzZWRfaWRzLmhhcyggdW5pcXVlICkgKSB7XHJcblx0XHRcdFx0XHR1bmlxdWUgPSBodG1sX2lkICsgJ18nICsgKCBpKysgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dXNlZF9pZHMuYWRkKCB1bmlxdWUgKTtcclxuXHRcdFx0XHRodG1sX2lkID0gdW5pcXVlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgaWRfYXR0ciAgPSBodG1sX2lkID8gKCAnIGlkPVwiJyArIGVzY19odG1sKCBodG1sX2lkICkgKyAnXCInICkgOiAnJztcclxuXHRcdFx0dmFyIGNsc19hdHRyID0gY2xzX3ZhbCA/ICggJyBjbGFzcz1cIicgKyBlc2NfaHRtbCggY2xzX3ZhbCApICsgJ1wiJyApIDogJyc7XHJcblxyXG5cdFx0XHQvLyBIZWxwIGluc2lkZSB0aGUgd3JhcHBlciAobGVnYWN5IGJlaGF2aW9yKS5cclxuXHRcdFx0dmFyIGhlbHBfaHRtbCA9ICggZmllbGQgJiYgZmllbGQuaGVscCApID8gJzxkaXYgY2xhc3M9XCJ3cGJjX2ZpZWxkX2Rlc2NyaXB0aW9uXCI+JyArIGVzY19odG1sKCBTdHJpbmcoIGZpZWxkLmhlbHAgKSApICsgJzwvZGl2PicgOiAnJztcclxuXHJcblx0XHRcdC8vIE9ubHkgd3JhcCBpbiA8c3BhbiAuLi4gc3R5bGU9XCJmbGV4OjE7XCI+IGlmIGlkIG9yIGNsYXNzIGV4aXN0cy5cclxuXHRcdFx0dmFyIGhhc193cmFwcGVyID0gISEgKCBpZF9hdHRyIHx8IGNsc19hdHRyICk7XHJcblx0XHRcdHZhciBvcGVuICAgICAgICA9IGhhc193cmFwcGVyID8gKCAnPHNwYW4nICsgaWRfYXR0ciArIGNsc19hdHRyICsgJyBzdHlsZT1cImZsZXg6MTtcIj4nICkgOiAnJztcclxuXHRcdFx0dmFyIGNsb3NlICAgICAgID0gaGFzX3dyYXBwZXIgPyAnPC9zcGFuPicgOiAnJztcclxuXHJcblx0XHRcdC8vIExlZ2FjeSBzaG9ydGNvZGUgbmFtZSBzcGVsbGluZyBpcyBpbnRlbnRpb25hbDogXCJzdGVwc190aW1lbGluZVwiLlxyXG5cdFx0XHRlbWl0KFxyXG5cdFx0XHRcdG9wZW4gK1xyXG5cdFx0XHRcdFx0J1tzdGVwc190aW1lbGluZSBzdGVwc19jb3VudD1cIicgKyBzYyArICdcIiBhY3RpdmVfc3RlcD1cIicgKyBhcyArICdcIiBjb2xvcj1cIicgKyBjb2wgKyAnXCJdJyArXHJcblx0XHRcdFx0XHRoZWxwX2h0bWwgK1xyXG5cdFx0XHRcdGNsb3NlXHJcblx0XHRcdCk7XHJcblxyXG5cdFx0XHQvLyBQcmV2ZW50IG91dGVyIHdyYXBwZXIgZnJvbSBwcmludGluZyBoZWxwIGFnYWluLlxyXG5cdFx0XHRpZiAoIGZpZWxkICkge1xyXG5cdFx0XHRcdGZpZWxkLmhlbHAgPSAnJztcclxuXHRcdFx0fVxyXG5cdFx0fTtcclxuXHJcblx0XHRFeHAucmVnaXN0ZXIoICdzdGVwc190aW1lbGluZScsIGV4cG9ydGVyX2NhbGxiYWNrICk7XHJcblx0fVxyXG5cclxuXHRpZiAoIHcuV1BCQ19CRkJfRXhwb3J0ZXIgJiYgdHlwZW9mIHcuV1BCQ19CRkJfRXhwb3J0ZXIucmVnaXN0ZXIgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRyZWdpc3Rlcl9zdGVwc190aW1lbGluZV9ib29raW5nX2Zvcm1fZXhwb3J0ZXIoKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0ZC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzpiZmI6ZXhwb3J0ZXItcmVhZHknLCByZWdpc3Rlcl9zdGVwc190aW1lbGluZV9ib29raW5nX2Zvcm1fZXhwb3J0ZXIsIHsgb25jZTogdHJ1ZSB9ICk7XHJcblx0fVxyXG5cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBFeHBvcnQgZm9yIFwiQm9va2luZyBEYXRhXCIgKENvbnRlbnQgb2YgYm9va2luZyBmaWVsZHMgZGF0YSlcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8qKlxyXG5cdCAqIFJlZ2lzdGVyIEJvb2tpbmcgRGF0YSBleHBvcnRlciBjYWxsYmFjayAoXCJDb250ZW50IG9mIGJvb2tpbmcgZmllbGRzIGRhdGFcIikgZm9yIFwic3RlcHNfdGltZWxpbmVcIi5cclxuXHQgKlxyXG5cdCAqIFN0ZXBzIFRpbWVsaW5lIGlzIHB1cmVseSBwcmVzZW50YXRpb25hbCBhbmQgZG9lcyBub3QgY2FycnkgdXNlci1lbnRlcmVkIHZhbHVlcyxcclxuXHQgKiBzbyBpdCBpcyBpbnRlbnRpb25hbGx5IG9taXR0ZWQgZnJvbSB0aGUgXCJDb250ZW50IG9mIGJvb2tpbmcgZmllbGRzIGRhdGFcIiBvdXRwdXQuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gcmVnaXN0ZXJfc3RlcHNfdGltZWxpbmVfYm9va2luZ19kYXRhX2V4cG9ydGVyKCkge1xyXG5cclxuXHRcdHZhciBDID0gdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXI7XHJcblx0XHRpZiAoICEgQyB8fCB0eXBlb2YgQy5yZWdpc3RlciAhPT0gJ2Z1bmN0aW9uJyApIHsgcmV0dXJuOyB9XHJcblx0XHRpZiAoIHR5cGVvZiBDLmhhc19leHBvcnRlciA9PT0gJ2Z1bmN0aW9uJyAmJiBDLmhhc19leHBvcnRlciggJ3N0ZXBzX3RpbWVsaW5lJyApICkgeyByZXR1cm47IH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBmaWVsZFxyXG5cdFx0ICogQHBhcmFtIHtmdW5jdGlvbihzdHJpbmcpOnZvaWR9IGVtaXRcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBbZXh0cmFzXVxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHZhciBleHBvcnRlcl9jYWxsYmFjayA9IGZ1bmN0aW9uKCBmaWVsZCwgZW1pdCwgZXh0cmFzICkge1xyXG5cdFx0XHQvLyBJbnRlbnRpb25hbGx5IGVtcHR5OiBzdGVwc190aW1lbGluZSBoYXMgbm8gZHluYW1pYyB0b2tlbi92YWx1ZVxyXG5cdFx0XHQvLyB0byBzaG93IGluIGJvb2tpbmcgZGF0YS5cclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fTtcclxuXHJcblx0XHRDLnJlZ2lzdGVyKCAnc3RlcHNfdGltZWxpbmUnLCBleHBvcnRlcl9jYWxsYmFjayApO1xyXG5cdH1cclxuXHJcblx0aWYgKCB3LldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciAmJiB0eXBlb2Ygdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIucmVnaXN0ZXIgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRyZWdpc3Rlcl9zdGVwc190aW1lbGluZV9ib29raW5nX2RhdGFfZXhwb3J0ZXIoKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0ZC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzpiZmI6Y29udGVudC1leHBvcnRlci1yZWFkeScsIHJlZ2lzdGVyX3N0ZXBzX3RpbWVsaW5lX2Jvb2tpbmdfZGF0YV9leHBvcnRlciwgeyBvbmNlOiB0cnVlIH0gKTtcclxuXHR9XHJcblxyXG5cclxufSkoIHdpbmRvdywgZG9jdW1lbnQgKTtcclxuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0EsQ0FBQyxVQUFVQSxDQUFDLEVBQUVDLENBQUMsRUFBRTtFQUNoQixZQUFZOztFQUVaLElBQUlDLElBQUksR0FBT0YsQ0FBQyxDQUFDRyxhQUFhLElBQUksQ0FBQyxDQUFDO0VBQ3BD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
