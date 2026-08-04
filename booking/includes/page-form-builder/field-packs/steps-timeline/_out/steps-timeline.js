"use strict";

// File: /includes/page-form-builder/field-packs/steps-timeline/_out/steps-timeline.js
(function (w, d) {
  'use strict';

  var Core = w.WPBC_BFB_Core || {};
  var registry = Core.WPBC_BFB_Field_Renderer_Registry;
  var Base = Core.WPBC_BFB_Field_Base;
  var localized_form_accent_defaults = w.wpbc_bfb_settings_vars && w.wpbc_bfb_settings_vars.form_accent_defaults ? w.wpbc_bfb_settings_vars.form_accent_defaults : {};
  var localized_default_form_accent_color = String(localized_form_accent_defaults.booking_form_accent_color || '').trim();

  /** @type {string} Default accent supplied by the PHP configuration constant. */
  var default_form_accent_color = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(localized_default_form_accent_color) ? localized_default_form_accent_color : '';
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
      // Remove the short-lived synchronization flag from development builds.
      // Timeline color is now always an explicit, editable field property.
      if (el.hasAttribute('data-use_form_accent')) {
        el.removeAttribute('data-use_form_accent');
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

  /**
   * Copy the current Form Style accent into every Steps Timeline color field.
   * This is a one-time value update: the resulting color remains independently
   * editable and does not stay synchronized with the global accent option.
   *
   * @param {CustomEvent} event Accent application request.
   * @returns {void}
   */
  function apply_form_accent_to_steps_timeline(event) {
    var detail = event && event.detail && typeof event.detail === 'object' ? event.detail : null;
    var builder = detail && detail.builder ? detail.builder : w.wpbc_bfb;
    var root = builder && builder.pages_container ? builder.pages_container : null;
    var accent_color = detail ? Core.WPBC_BFB_Sanitize.sanitize_hex_color(detail.accent_color, default_form_accent_color) : default_form_accent_color;
    var selected = null;
    if (!detail || !root) {
      return;
    }
    root.querySelectorAll('.wpbc_bfb__field[data-type="steps_timeline"]').forEach(function (field_el) {
      var current_color = Core.WPBC_BFB_Sanitize.sanitize_hex_color(field_el.dataset.color, '#619d40');
      detail.matched = (parseInt(detail.matched, 10) || 0) + 1;
      if (current_color.toLowerCase() === accent_color.toLowerCase() && !field_el.hasAttribute('data-use_form_accent')) {
        return;
      }
      field_el.dataset.color = accent_color;
      field_el.removeAttribute('data-use_form_accent');
      detail.updated = (parseInt(detail.updated, 10) || 0) + 1;
      if (field_el.classList.contains('is-selected')) {
        selected = field_el;
      }
      if (builder.preview_mode && typeof builder.render_preview === 'function') {
        builder.render_preview(field_el);
      }
    });
    if (selected && typeof builder.select_field === 'function') {
      builder.select_field(selected);
    }
  }
  d.addEventListener('wpbc:bfb:apply-accent-to-components', apply_form_accent_to_steps_timeline, false);

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

      // Sanitize the editable field color with its legacy default.
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3Mvc3RlcHMtdGltZWxpbmUvX291dC9zdGVwcy10aW1lbGluZS5qcyIsIm5hbWVzIjpbInciLCJkIiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJyZWdpc3RyeSIsIldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5IiwiQmFzZSIsIldQQkNfQkZCX0ZpZWxkX0Jhc2UiLCJsb2NhbGl6ZWRfZm9ybV9hY2NlbnRfZGVmYXVsdHMiLCJ3cGJjX2JmYl9zZXR0aW5nc192YXJzIiwiZm9ybV9hY2NlbnRfZGVmYXVsdHMiLCJsb2NhbGl6ZWRfZGVmYXVsdF9mb3JtX2FjY2VudF9jb2xvciIsIlN0cmluZyIsImJvb2tpbmdfZm9ybV9hY2NlbnRfY29sb3IiLCJ0cmltIiwiZGVmYXVsdF9mb3JtX2FjY2VudF9jb2xvciIsInRlc3QiLCJyZWdpc3RlciIsIl93cGJjIiwiZGV2IiwiZXJyb3IiLCJ3cGJjX2JmYl9maWVsZF9zdGVwc190aW1lbGluZSIsImdldF9kZWZhdWx0cyIsInR5cGUiLCJzdGVwc19jb3VudCIsImFjdGl2ZV9zdGVwIiwiY29sb3IiLCJjc3NjbGFzc19leHRyYSIsIm5hbWUiLCJodG1sX2lkIiwiaGVscCIsInVzYWdlX2tleSIsImNsYW1wX2ludCIsInYiLCJtaW4iLCJtYXgiLCJkZWYiLCJuIiwicGFyc2VJbnQiLCJpc05hTiIsImVuc3VyZV9zY29wZV9zdWZmaXgiLCJlbCIsInN1ZmZpeCIsImRhdGFzZXQiLCJzdGVwc19zY29wZV9zdWZmaXgiLCJzdGFiIiwiZ2V0QXR0cmlidXRlIiwibSIsIm1hdGNoIiwiTWF0aCIsImZsb29yIiwicmFuZG9tIiwiZSIsImJ1aWxkX3N0ZXBfbm9kZV9odG1sIiwic3RhdGUiLCJjbHMiLCJidWlsZF9zdGVwX2xpbmVfaHRtbCIsImlzX2FjdGl2ZSIsInJlbmRlciIsImRhdGEiLCJjdHgiLCJub3JtYWxpemVfZGF0YSIsImVzY19odG1sIiwiV1BCQ19CRkJfU2FuaXRpemUiLCJlc2NhcGVfaHRtbCIsInNhbml0aXplX2lkIiwic2FuaXRpemVfaHRtbF9pZCIsInNhbml0aXplX25hbWUiLCJzYW5pdGl6ZV9odG1sX25hbWUiLCJzYW5pdGl6ZV9jbHMiLCJzYW5pdGl6ZV9jc3NfY2xhc3NsaXN0Iiwic2FuaXRpemVfaGV4Iiwic2FuaXRpemVfaGV4X2NvbG9yIiwiY29sb3JfdmFsIiwibmFtZV92YWwiLCJjbHNfZXh0cmEiLCJoYXNBdHRyaWJ1dGUiLCJyZW1vdmVBdHRyaWJ1dGUiLCJzY29wZV9zdWZmaXgiLCJzY29wZV9jbHMiLCJpZF9hdHRyIiwibmFtZV9hdHRyIiwiY2xzX2F0dHIiLCJwYXJ0cyIsImkiLCJwdXNoIiwiaXNfYWN0aXZlX2xpbmUiLCJoZWxwX2h0bWwiLCJzdHlsZV9pZCIsImNzc19ydWxlIiwiaW5uZXJIVE1MIiwiam9pbiIsIlVJIiwiV1BCQ19CRkJfT3ZlcmxheSIsImVuc3VyZSIsImJ1aWxkZXIiLCJvbl9maWVsZF9kcm9wIiwiYXBwbHlfZm9ybV9hY2NlbnRfdG9fc3RlcHNfdGltZWxpbmUiLCJldmVudCIsImRldGFpbCIsIndwYmNfYmZiIiwicm9vdCIsInBhZ2VzX2NvbnRhaW5lciIsImFjY2VudF9jb2xvciIsInNlbGVjdGVkIiwicXVlcnlTZWxlY3RvckFsbCIsImZvckVhY2giLCJmaWVsZF9lbCIsImN1cnJlbnRfY29sb3IiLCJtYXRjaGVkIiwidG9Mb3dlckNhc2UiLCJ1cGRhdGVkIiwiY2xhc3NMaXN0IiwiY29udGFpbnMiLCJwcmV2aWV3X21vZGUiLCJyZW5kZXJfcHJldmlldyIsInNlbGVjdF9maWVsZCIsImFkZEV2ZW50TGlzdGVuZXIiLCJyZWdpc3Rlcl9zdGVwc190aW1lbGluZV9ib29raW5nX2Zvcm1fZXhwb3J0ZXIiLCJFeHAiLCJXUEJDX0JGQl9FeHBvcnRlciIsImhhc19leHBvcnRlciIsIlMiLCJyZXBsYWNlIiwic2FuaXRpemVJZCIsInNhbml0aXplQ2xzIiwic2FuaXRpemVIZXgiLCJjaGFyQXQiLCJleHBvcnRlcl9jYWxsYmFjayIsImZpZWxkIiwiZW1pdCIsImV4dHJhcyIsInNjIiwiYXMiLCJjb2wiLCJjbHNfcmF3IiwiY3NzY2xhc3MiLCJjbHNfdmFsIiwidXNlZF9pZHMiLCJ1c2VkSWRzIiwiU2V0IiwidW5pcXVlIiwiaGFzIiwiYWRkIiwiaGFzX3dyYXBwZXIiLCJvcGVuIiwiY2xvc2UiLCJvbmNlIiwicmVnaXN0ZXJfc3RlcHNfdGltZWxpbmVfYm9va2luZ19kYXRhX2V4cG9ydGVyIiwiQyIsIldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciIsIndpbmRvdyIsImRvY3VtZW50Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3Mvc3RlcHMtdGltZWxpbmUvX3NyYy9zdGVwcy10aW1lbGluZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBGaWxlOiAvaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3Mvc3RlcHMtdGltZWxpbmUvX291dC9zdGVwcy10aW1lbGluZS5qc1xyXG4oZnVuY3Rpb24gKHcsIGQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdHZhciBDb3JlICAgICA9IHcuV1BCQ19CRkJfQ29yZSB8fCB7fTtcblx0dmFyIHJlZ2lzdHJ5ID0gQ29yZS5XUEJDX0JGQl9GaWVsZF9SZW5kZXJlcl9SZWdpc3RyeTtcblx0dmFyIEJhc2UgICAgID0gQ29yZS5XUEJDX0JGQl9GaWVsZF9CYXNlO1xuXHR2YXIgbG9jYWxpemVkX2Zvcm1fYWNjZW50X2RlZmF1bHRzID0gdy53cGJjX2JmYl9zZXR0aW5nc192YXJzICYmIHcud3BiY19iZmJfc2V0dGluZ3NfdmFycy5mb3JtX2FjY2VudF9kZWZhdWx0c1xuXHRcdD8gdy53cGJjX2JmYl9zZXR0aW5nc192YXJzLmZvcm1fYWNjZW50X2RlZmF1bHRzXG5cdFx0OiB7fTtcblx0dmFyIGxvY2FsaXplZF9kZWZhdWx0X2Zvcm1fYWNjZW50X2NvbG9yID0gU3RyaW5nKCBsb2NhbGl6ZWRfZm9ybV9hY2NlbnRfZGVmYXVsdHMuYm9va2luZ19mb3JtX2FjY2VudF9jb2xvciB8fCAnJyApLnRyaW0oKTtcblxuXHQvKiogQHR5cGUge3N0cmluZ30gRGVmYXVsdCBhY2NlbnQgc3VwcGxpZWQgYnkgdGhlIFBIUCBjb25maWd1cmF0aW9uIGNvbnN0YW50LiAqL1xuXHR2YXIgZGVmYXVsdF9mb3JtX2FjY2VudF9jb2xvciA9IC9eIyg/OlswLTlhLWZdezN9fFswLTlhLWZdezZ9KSQvaS50ZXN0KCBsb2NhbGl6ZWRfZGVmYXVsdF9mb3JtX2FjY2VudF9jb2xvciApXG5cdFx0PyBsb2NhbGl6ZWRfZGVmYXVsdF9mb3JtX2FjY2VudF9jb2xvclxuXHRcdDogJyc7XG5cclxuXHRpZiAoICEgcmVnaXN0cnkgfHwgdHlwZW9mIHJlZ2lzdHJ5LnJlZ2lzdGVyICE9PSAnZnVuY3Rpb24nIHx8ICEgQmFzZSApIHtcclxuXHRcdF93cGJjPy5kZXY/LmVycm9yPy4oICd3cGJjX2JmYl9maWVsZF9zdGVwc190aW1lbGluZScsICdDb3JlIHJlZ2lzdHJ5L2Jhc2UgbWlzc2luZycgKTtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEZpZWxkIFJlbmRlcmVyOiBzdGVwc190aW1lbGluZVxyXG5cdCAqIC0gUmVuZGVycyBzdGF0ZXM6IFwiY29tcGxldGVkXCIsIFwiYWN0aXZlXCIsIFwiZnV0dXJlXCJcclxuXHQgKiAtIEFkZHMgYWN0aXZlIGNvbm5lY3RvciBzZWdtZW50cyB2aWEgXCIud3BiY19zdGVwc19mb3JfdGltZWxpbmVfbGluZV9hY3RpdmVcIlxyXG5cdCAqIC0gU2NvcGVzIGNvbG9yIHdpdGggbGVnYWN5IGNsYXNzIHN1ZmZpeCArIGlubGluZSBDU1MgdmFyIGluamVjdGlvblxyXG5cdCAqXHJcblx0ICogQGNsYXNzIHdwYmNfYmZiX2ZpZWxkX3N0ZXBzX3RpbWVsaW5lXHJcblx0ICogQGV4dGVuZHMgQ29yZS5XUEJDX0JGQl9GaWVsZF9CYXNlXHJcblx0ICovXHJcblx0Y2xhc3Mgd3BiY19iZmJfZmllbGRfc3RlcHNfdGltZWxpbmUgZXh0ZW5kcyBCYXNlIHtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJldHVybiBkZWZhdWx0IHByb3BzIGZvciBcInN0ZXBzX3RpbWVsaW5lXCIuXHJcblx0XHQgKiBNdXN0IHN0YXkgaW4gc3luYyB3aXRoIFBIUCBzY2hlbWEgZGVmYXVsdHMuXHJcblx0XHQgKlxyXG5cdFx0ICogQGpEb2NcclxuXHRcdCAqIEByZXR1cm5zIHt7dHlwZTpzdHJpbmcsc3RlcHNfY291bnQ6bnVtYmVyLGFjdGl2ZV9zdGVwOm51bWJlcixjb2xvcjpzdHJpbmcsY3NzY2xhc3NfZXh0cmE6c3RyaW5nLG5hbWU6c3RyaW5nLGh0bWxfaWQ6c3RyaW5nLGhlbHA6c3RyaW5nLHVzYWdlX2tleTpzdHJpbmd9fVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZ2V0X2RlZmF1bHRzKCkge1xyXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0eXBlICAgICAgICAgICAgOiAnc3RlcHNfdGltZWxpbmUnLFxuXHRcdFx0XHRzdGVwc19jb3VudCAgICAgOiAzLFxuXHRcdFx0XHRhY3RpdmVfc3RlcCAgICAgOiAxLFxuXHRcdFx0XHRjb2xvciAgICAgICAgICAgOiAnIzYxOWQ0MCcsXG5cdFx0XHRcdGNzc2NsYXNzX2V4dHJhICA6ICcnLFxyXG5cdFx0XHRcdG5hbWUgICAgICAgICAgICA6ICcnLFxyXG5cdFx0XHRcdGh0bWxfaWQgICAgICAgICA6ICcnLFxyXG5cdFx0XHRcdGhlbHAgICAgICAgICAgICA6ICcnLFxyXG5cdFx0XHRcdHVzYWdlX2tleSAgICAgICA6ICdzdGVwc190aW1lbGluZSdcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENsYW1wIGludGVnZXIgaW50byBbbWluLG1heF0sIGZhbGxpbmcgYmFjayB0byBkZWYgaWYgTmFOLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBqRG9jXHJcblx0XHQgKiBAcGFyYW0ge2FueX0gdiAgICBSYXcgdmFsdWUgdG8gY2xhbXAuXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gbWluIE1pbmltdW0gYWxsb3dlZCB2YWx1ZS5cclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBtYXggTWF4aW11bSBhbGxvd2VkIHZhbHVlLlxyXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGRlZiBEZWZhdWx0IHRvIHVzZSBpZiB2IGlzIE5hTi5cclxuXHRcdCAqIEByZXR1cm5zIHtudW1iZXJ9IENsYW1wZWQgaW50ZWdlci5cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGNsYW1wX2ludCggdiwgbWluLCBtYXgsIGRlZiApIHtcclxuXHRcdFx0dmFyIG4gPSBwYXJzZUludCggdiwgMTAgKTtcclxuXHRcdFx0aWYgKCBpc05hTiggbiApICkgeyBuID0gZGVmOyB9XHJcblx0XHRcdGlmICggbiA8IG1pbiApIHsgbiA9IG1pbjsgfVxyXG5cdFx0XHRpZiAoIG4gPiBtYXggKSB7IG4gPSBtYXg7IH1cclxuXHRcdFx0cmV0dXJuIG47XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDcmVhdGUgYSBzdGFibGUgcGVyLWVsZW1lbnQgbnVtZXJpYyBzdWZmaXggdXNlZCBpbiB0aGUgc2NvcGVkIGNsYXNzIG5hbWUuXHJcblx0XHQgKiBQZXJzaXN0cyBpbiBlbGVtZW50IGRhdGFzZXQgdG8gcmVtYWluIHN0YWJsZSBhY3Jvc3MgcmUtcmVuZGVycy5cclxuXHRcdCAqXHJcblx0XHQgKiBAakRvY1xyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWwgRmllbGQgd3JhcHBlciBlbGVtZW50LlxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ30gTnVtZXJpYyBzdWZmaXggKGUuZy4sIFwiNjYxNFwiKS5cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGVuc3VyZV9zY29wZV9zdWZmaXgoIGVsICkge1xyXG5cdFx0XHR2YXIgc3VmZml4ID0gZWwgJiYgZWwuZGF0YXNldCA/IGVsLmRhdGFzZXQuc3RlcHNfc2NvcGVfc3VmZml4IDogJyc7XHJcblx0XHRcdGlmICggc3VmZml4ICkge1xyXG5cdFx0XHRcdHJldHVybiBzdWZmaXg7XHJcblx0XHRcdH1cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHR2YXIgc3RhYiA9IGVsLmdldEF0dHJpYnV0ZSggJ2RhdGEtaWQnICkgfHwgZWwuZ2V0QXR0cmlidXRlKCAnZGF0YS1uYW1lJyApIHx8ICcnO1xyXG5cdFx0XHRcdGlmICggc3RhYiApIHtcclxuXHRcdFx0XHRcdHZhciBtID0gU3RyaW5nKCBzdGFiICkubWF0Y2goIC8oXFxkezMsfSkkLyApO1xyXG5cdFx0XHRcdFx0c3VmZml4ID0gbSA/IG1bMV0gOiBTdHJpbmcoIE1hdGguZmxvb3IoIE1hdGgucmFuZG9tKCkgKiA5MDAwICkgKyAxMDAwICk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHN1ZmZpeCA9IFN0cmluZyggTWF0aC5mbG9vciggTWF0aC5yYW5kb20oKSAqIDkwMDAgKSArIDEwMDAgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gY2F0Y2ggKGUpIHtcclxuXHRcdFx0XHRzdWZmaXggPSBTdHJpbmcoIE1hdGguZmxvb3IoIE1hdGgucmFuZG9tKCkgKiA5MDAwICkgKyAxMDAwICk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBlbCAmJiBlbC5kYXRhc2V0ICkge1xyXG5cdFx0XHRcdGVsLmRhdGFzZXQuc3RlcHNfc2NvcGVfc3VmZml4ID0gc3VmZml4O1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBzdWZmaXg7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBCdWlsZCBhIHN0ZXAgbm9kZSBieSB2aXN1YWwgc3RhdGUuXHJcblx0XHQgKlxyXG5cdFx0ICogQGpEb2NcclxuXHRcdCAqIEBwYXJhbSB7J2NvbXBsZXRlZCd8J2FjdGl2ZSd8J2Z1dHVyZSd9IHN0YXRlIFN0ZXAgdmlzdWFsIHN0YXRlLlxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ30gSFRNTCBzdHJpbmcgb2YgYSBzaW5nbGUgc3RlcCBub2RlLlxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgYnVpbGRfc3RlcF9ub2RlX2h0bWwoIHN0YXRlICkge1xyXG5cdFx0XHR2YXIgY2xzID0gJ3dwYmNfc3RlcHNfZm9yX3RpbWVsaW5lX3N0ZXAnO1xyXG5cdFx0XHRpZiAoIHN0YXRlID09PSAnY29tcGxldGVkJyApIHsgY2xzICs9ICcgd3BiY19zdGVwc19mb3JfdGltZWxpbmVfc3RlcF9jb21wbGV0ZWQnOyB9XHJcblx0XHRcdGlmICggc3RhdGUgPT09ICdhY3RpdmUnICkgICAgeyBjbHMgKz0gJyB3cGJjX3N0ZXBzX2Zvcl90aW1lbGluZV9zdGVwX2FjdGl2ZSc7IH1cclxuXHJcblx0XHRcdHJldHVybiAnJyArXHJcblx0XHRcdFx0JzxkaXYgY2xhc3M9XCInICsgY2xzICsgJ1wiPicgK1xyXG5cdFx0XHRcdFx0Jzxzdmcgdmlld0JveD1cIjAgMCA1MTIgNTEyXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHJvbGU9XCJpbWdcIiBjbGFzcz1cImljb24gaWNvbi1zdWNjZXNzXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCIgd2lkdGg9XCIxMFwiIGhlaWdodD1cIjEwXCI+JyArXHJcblx0XHRcdFx0XHRcdCc8cGF0aCBmaWxsPVwiY3VycmVudENvbG9yXCIgZD1cIk0xNzMuODk4IDQzOS40MDRsLTE2Ni40LTE2Ni40Yy05Ljk5Ny05Ljk5Ny05Ljk5Ny0yNi4yMDYgMC0zNi4yMDRsMzYuMjAzLTM2LjIwNGM5Ljk5Ny05Ljk5OCAyNi4yMDctOS45OTggMzYuMjA0IDBMMTkyIDMxMi42OSA0MzIuMDk1IDcyLjU5NmM5Ljk5Ny05Ljk5NyAyNi4yMDctOS45OTcgMzYuMjA0IDBsMzYuMjAzIDM2LjIwNGM5Ljk5NyA5Ljk5NyA5Ljk5NyAyNi4yMDYgMCAzNi4yMDRsLTI5NC40IDI5NC40MDFjLTkuOTk4IDkuOTk3LTI2LjIwNyA5Ljk5Ny0zNi4yMDQtLjAwMXpcIj48L3BhdGg+JyArXHJcblx0XHRcdFx0XHQnPC9zdmc+JyArXHJcblx0XHRcdFx0XHQnPHN2ZyB2aWV3Qm94PVwiMCAwIDM1MiA1MTJcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgcm9sZT1cImltZ1wiIGNsYXNzPVwiaWNvbiBpY29uLWZhaWxlZFwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiIHdpZHRoPVwiOFwiIGhlaWdodD1cIjExXCI+JyArXHJcblx0XHRcdFx0XHRcdCc8cGF0aCBmaWxsPVwiY3VycmVudENvbG9yXCIgZD1cIk0yNDIuNzIgMjU2bDEwMC4wNy0xMDAuMDdjMTIuMjgtMTIuMjggMTIuMjgtMzIuMTkgMC00NC40OGwtMjIuMjQtMjIuMjRjLTEyLjI4LTEyLjI4LTMyLjE5LTEyLjI4LTQ0LjQ4IDBMMTc2IDE4OS4yOCA3NS45MyA4OS4yMWMtMTIuMjgtMTIuMjgtMzIuMTktMTIuMjgtNDQuNDggMEw5LjIxIDExMS40NWMtMTIuMjggMTIuMjgtMTIuMjggMzIuMTkgMCA0NC40OEwxMDkuMjggMjU2IDkuMjEgMzU2LjA3Yy0xMi4yOCAxMi4yOC0xMi4yOCAzMi4xOSAwIDQ0LjQ4bDIyLjI0IDIyLjI0YzEyLjI4IDEyLjI4IDMyLjIgMTIuMjggNDQuNDggMEwxNzYgMzIyLjcybDEwMC4wNyAxMDAuMDdjMTIuMjggMTIuMjggMzIuMiAxMi4yOCA0NC40OCAwbDIyLjI0LTIyLjI0YzEyLjI4LTEyLjI4IDEyLjI4LTMyLjE5IDAtNDQuNDhMMjQyLjcyIDI1NnpcIj48L3BhdGg+JyArXHJcblx0XHRcdFx0XHQnPC9zdmc+JyArXHJcblx0XHRcdFx0JzwvZGl2Pic7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBCdWlsZCBjb25uZWN0b3IgbGluZSwgb3B0aW9uYWxseSBtYXJrZWQgYXMgYWN0aXZlIChjb21wbGV0ZWQgc2VnbWVudCkuXHJcblx0XHQgKlxyXG5cdFx0ICogQGpEb2NcclxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfYWN0aXZlIFRydWUgdG8gYWRkIFwid3BiY19zdGVwc19mb3JfdGltZWxpbmVfbGluZV9hY3RpdmVcIi5cclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9IEhUTUwgc3RyaW5nIGZvciBhIGNvbm5lY3RvciBsaW5lLlxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgYnVpbGRfc3RlcF9saW5lX2h0bWwoIGlzX2FjdGl2ZSApIHtcclxuXHRcdFx0dmFyIGNscyA9ICd3cGJjX3N0ZXBzX2Zvcl90aW1lbGluZV9zdGVwX2xpbmUnO1xyXG5cdFx0XHRpZiAoIGlzX2FjdGl2ZSApIHsgY2xzICs9ICcgd3BiY19zdGVwc19mb3JfdGltZWxpbmVfbGluZV9hY3RpdmUnOyB9XHJcblx0XHRcdHJldHVybiAnPGRpdiBjbGFzcz1cIicgKyBjbHMgKyAnXCI+PC9kaXY+JztcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlbmRlciB0aGUgcHJldmlldyBtYXJrdXAgaW50byB0aGUgZmllbGQgZWxlbWVudC5cclxuXHRcdCAqIC0gR2VuZXJhdGVzIGAud3BiY19zdGVwc19mb3JfdGltZWxpbmVfX3N0ZXBzX3RpbWVsaW5le3N1ZmZpeH1gIHNjb3BlIGNsYXNzIChsZWdhY3kgXCJ0aW1saW5lXCIgc3BlbGxpbmcpLlxyXG5cdFx0ICogLSBJbmplY3RzIHNjb3BlZCBDU1MgdmFyaWFibGUgcnVsZSBmb3IgZnJvbnQtZW5kOiBgLmJvb2tpbmdfZm9ybV9kaXYgLntzY29wZX0gLndwYmNfc3RlcHNfZm9yX3RpbWVsaW5lX2NvbnRhaW5lcnsgLS13cGJjX3N0ZXBzX2Zvcl90aW1lbGluZV9hY3RpdmVfY29sb3I6I2hleDsgfWBcclxuXHRcdCAqIC0gQWRkcyBtaW5pbWFsIGJhc2UgQ1NTIG9uY2UgaWYgZXh0ZXJuYWwgQ1NTIG5vdCBlbnF1ZXVlZC5cclxuXHRcdCAqXHJcblx0XHQgKiBAakRvY1xyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWwgRmllbGQgcm9vdCBlbGVtZW50IGluc2lkZSB0aGUgY2FudmFzLlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGRhdGEgRmllbGQgcHJvcHMgKGFscmVhZHkgbm9ybWFsaXplZCBieSBzY2hlbWEpLlxyXG5cdFx0ICogQHBhcmFtIHt7YnVpbGRlcj86YW55LCBzYW5pdD86YW55fX0gW2N0eF0gIENvbnRleHQgb2JqZWN0LlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyByZW5kZXIoIGVsLCBkYXRhLCBjdHggKSB7XHJcblx0XHRcdGlmICggISBlbCApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHR2YXIgZCAgICAgICAgICAgID0gdGhpcy5ub3JtYWxpemVfZGF0YSggZGF0YSApO1xuXHRcdFx0dmFyIGVzY19odG1sICAgICA9ICh2KSA9PiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY2FwZV9odG1sKCB2ICk7XHJcblx0XHRcdHZhciBzYW5pdGl6ZV9pZCAgPSAodikgPT4gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5zYW5pdGl6ZV9odG1sX2lkKCB2ICk7XHJcblx0XHRcdHZhciBzYW5pdGl6ZV9uYW1lPSAodikgPT4gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5zYW5pdGl6ZV9odG1sX25hbWUoIHYgKTtcclxuXHRcdFx0dmFyIHNhbml0aXplX2NscyA9ICh2KSA9PiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2Nzc19jbGFzc2xpc3QoIHYgKTtcclxuXHRcdFx0dmFyIHNhbml0aXplX2hleCA9ICh2KSA9PiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2hleF9jb2xvciggdiwgJyM2MTlkNDAnICk7XHJcblxyXG5cdFx0XHR2YXIgc3RlcHNfY291bnQgID0gd3BiY19iZmJfZmllbGRfc3RlcHNfdGltZWxpbmUuY2xhbXBfaW50KCBkLnN0ZXBzX2NvdW50LCAyLCAxMiwgMyApO1xyXG5cdFx0XHR2YXIgYWN0aXZlX3N0ZXAgID0gd3BiY19iZmJfZmllbGRfc3RlcHNfdGltZWxpbmUuY2xhbXBfaW50KCBkLmFjdGl2ZV9zdGVwLCAxLCBzdGVwc19jb3VudCwgMSApO1xyXG5cdFx0XHR2YXIgY29sb3JfdmFsICAgID0gc2FuaXRpemVfaGV4KCBkLmNvbG9yICk7XG5cclxuXHRcdFx0dmFyIGh0bWxfaWQgICAgICA9IGQuaHRtbF9pZCA/IHNhbml0aXplX2lkKCBTdHJpbmcoIGQuaHRtbF9pZCApICkgOiAnJztcclxuXHRcdFx0dmFyIG5hbWVfdmFsICAgICA9IGQubmFtZSAgICA/IHNhbml0aXplX25hbWUoIFN0cmluZyggZC5uYW1lICkgKSAgOiAnJztcclxuXHRcdFx0dmFyIGNsc19leHRyYSAgICA9IHNhbml0aXplX2NscyggU3RyaW5nKCBkLmNzc2NsYXNzX2V4dHJhIHx8ICcnICkgKTtcclxuXHJcblx0XHRcdGlmICggU3RyaW5nKCBlbC5kYXRhc2V0LnN0ZXBzX2NvdW50ICkgIT09IFN0cmluZyggc3RlcHNfY291bnQgKSApIHsgZWwuZGF0YXNldC5zdGVwc19jb3VudCA9IFN0cmluZyggc3RlcHNfY291bnQgKTsgfVxuXHRcdFx0aWYgKCBTdHJpbmcoIGVsLmRhdGFzZXQuYWN0aXZlX3N0ZXAgKSAhPT0gU3RyaW5nKCBhY3RpdmVfc3RlcCApICkgeyBlbC5kYXRhc2V0LmFjdGl2ZV9zdGVwID0gU3RyaW5nKCBhY3RpdmVfc3RlcCApOyB9XG5cdFx0XHRpZiAoIGVsLmRhdGFzZXQuY29sb3IgIT09IGNvbG9yX3ZhbCApIHsgZWwuZGF0YXNldC5jb2xvciA9IGNvbG9yX3ZhbDsgfVxuXHRcdFx0Ly8gUmVtb3ZlIHRoZSBzaG9ydC1saXZlZCBzeW5jaHJvbml6YXRpb24gZmxhZyBmcm9tIGRldmVsb3BtZW50IGJ1aWxkcy5cblx0XHRcdC8vIFRpbWVsaW5lIGNvbG9yIGlzIG5vdyBhbHdheXMgYW4gZXhwbGljaXQsIGVkaXRhYmxlIGZpZWxkIHByb3BlcnR5LlxuXHRcdFx0aWYgKCBlbC5oYXNBdHRyaWJ1dGUoICdkYXRhLXVzZV9mb3JtX2FjY2VudCcgKSApIHsgZWwucmVtb3ZlQXR0cmlidXRlKCAnZGF0YS11c2VfZm9ybV9hY2NlbnQnICk7IH1cblx0XHRcdGlmICggZWwuZGF0YXNldC5jc3NjbGFzc19leHRyYSAhPT0gY2xzX2V4dHJhICkgeyBlbC5kYXRhc2V0LmNzc2NsYXNzX2V4dHJhID0gY2xzX2V4dHJhOyB9XHJcblx0XHRcdGlmICggZWwuZGF0YXNldC5odG1sX2lkICE9PSBodG1sX2lkICkgeyBlbC5kYXRhc2V0Lmh0bWxfaWQgPSBodG1sX2lkOyB9XHJcblx0XHRcdGlmICggZWwuZGF0YXNldC5uYW1lICE9PSBuYW1lX3ZhbCApIHsgZWwuZGF0YXNldC5uYW1lID0gbmFtZV92YWw7IH1cclxuXHJcblx0XHRcdC8vIFNjb3BlIGNsYXNzIHdpdGggbGVnYWN5IFwidGltbGluZVwiIHNwZWxsaW5nICsgbnVtZXJpYyBzdWZmaXhcclxuXHRcdFx0dmFyIHNjb3BlX3N1ZmZpeCA9IHdwYmNfYmZiX2ZpZWxkX3N0ZXBzX3RpbWVsaW5lLmVuc3VyZV9zY29wZV9zdWZmaXgoIGVsICk7XHJcblx0XHRcdHZhciBzY29wZV9jbHMgICAgPSAnd3BiY19zdGVwc19mb3JfdGltZWxpbmVfX3N0ZXBzX3RpbWVsaW5lJyArIHNjb3BlX3N1ZmZpeDtcclxuXHJcblx0XHRcdHZhciBpZF9hdHRyICAgICAgPSBodG1sX2lkID8gJyBpZD1cIicgKyBlc2NfaHRtbCggaHRtbF9pZCApICsgJ1wiJyA6ICcnO1xyXG5cdFx0XHR2YXIgbmFtZV9hdHRyICAgID0gbmFtZV92YWwgPyAnIG5hbWU9XCInICsgZXNjX2h0bWwoIG5hbWVfdmFsICkgKyAnXCInIDogJyc7XHJcblx0XHRcdHZhciBjbHNfYXR0ciAgICAgPSBjbHNfZXh0cmEgPyAnIGNsYXNzPVwiJyArIGVzY19odG1sKCBjbHNfZXh0cmEgKSArICdcIicgOiAnJztcclxuXHJcblx0XHRcdC8vIEJ1aWxkIG1hcmt1cCB3aXRoIHN0YXRlcyArIGFjdGl2ZSBsaW5lcyBCRUZPUkUgdGhlIGFjdGl2ZSBzdGVwXHJcblx0XHRcdHZhciBwYXJ0cyA9IFtdO1xyXG5cdFx0XHRmb3IgKCB2YXIgaSA9IDE7IGkgPD0gc3RlcHNfY291bnQ7IGkrKyApIHtcclxuXHRcdFx0XHR2YXIgc3RhdGUgPSAoaSA8IGFjdGl2ZV9zdGVwKSA/ICdjb21wbGV0ZWQnIDogKGkgPT09IGFjdGl2ZV9zdGVwID8gJ2FjdGl2ZScgOiAnZnV0dXJlJyk7XHJcblx0XHRcdFx0cGFydHMucHVzaCggd3BiY19iZmJfZmllbGRfc3RlcHNfdGltZWxpbmUuYnVpbGRfc3RlcF9ub2RlX2h0bWwoIHN0YXRlICkgKTtcclxuXHRcdFx0XHRpZiAoIGkgPCBzdGVwc19jb3VudCApIHtcclxuXHRcdFx0XHRcdHZhciBpc19hY3RpdmVfbGluZSA9IChpIDwgYWN0aXZlX3N0ZXApO1xyXG5cdFx0XHRcdFx0cGFydHMucHVzaCggd3BiY19iZmJfZmllbGRfc3RlcHNfdGltZWxpbmUuYnVpbGRfc3RlcF9saW5lX2h0bWwoIGlzX2FjdGl2ZV9saW5lICkgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBoZWxwX2h0bWwgPSBkLmhlbHAgPyAnPGRpdiBjbGFzcz1cIndwYmNfYmZiX19oZWxwXCI+JyArIGVzY19odG1sKCBTdHJpbmcoIGQuaGVscCApICkgKyAnPC9kaXY+JyA6ICcnO1xyXG5cclxuXHRcdFx0Ly8gU2NvcGVkIGlubGluZSBDU1MgcnVsZSBmb3IgZnJvbnRlbmQgKHdpdGhpbiAuYm9va2luZ19mb3JtX2RpdilcclxuXHRcdFx0dmFyIHN0eWxlX2lkID0gJ3dwYmNfYmZiX3N0ZXBzX3RpbWVsaW5lX3N0eWxlX18nICsgc2NvcGVfc3VmZml4O1xyXG5cdFx0XHR2YXIgY3NzX3J1bGUgPSAnLmJvb2tpbmdfZm9ybV9kaXYgLicgKyBzY29wZV9jbHMgKyAnIC53cGJjX3N0ZXBzX2Zvcl90aW1lbGluZV9jb250YWluZXJ7JyArXG5cdFx0XHRcdCctLXdwYmNfc3RlcHNfZm9yX3RpbWVsaW5lX2FjdGl2ZV9jb2xvcjonICsgZXNjX2h0bWwoIGNvbG9yX3ZhbCApICsgJzsnICtcblx0XHRcdCd9JztcblxyXG5cdFx0XHRlbC5pbm5lckhUTUwgPVxyXG5cdFx0XHRcdCc8c3R5bGUgaWQ9XCInICsgc3R5bGVfaWQgKyAnXCI+JyArIGNzc19ydWxlICsgJzwvc3R5bGU+JyArXHJcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwiJyArIHNjb3BlX2NscyArICcgd3BiY19iZmJfX25vLWRyYWctem9uZVwiIGluZXJ0PVwiXCI+JyArXG5cdFx0XHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjX3N0ZXBzX2Zvcl90aW1lbGluZV9jb250YWluZXJcIicgKyBpZF9hdHRyICsgbmFtZV9hdHRyICsgY2xzX2F0dHIgK1xuXHRcdFx0XHRcdFx0JyBzdHlsZT1cIi0td3BiY19zdGVwc19mb3JfdGltZWxpbmVfYWN0aXZlX2NvbG9yOicgKyBlc2NfaHRtbCggY29sb3JfdmFsICkgKyAnO1wiPicgK1xuXHRcdFx0XHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjX3N0ZXBzX2Zvcl90aW1lbGluZVwiIHJvbGU9XCJsaXN0XCIgYXJpYS1sYWJlbD1cIlN0ZXBzIHRpbWVsaW5lXCI+JyArXHJcblx0XHRcdFx0XHRcdFx0cGFydHMuam9pbiggJycgKSArXHJcblx0XHRcdFx0XHRcdCc8L2Rpdj4nICtcclxuXHRcdFx0XHRcdCc8L2Rpdj4nICtcclxuXHRcdFx0XHRcdGhlbHBfaHRtbCArXHJcblx0XHRcdFx0Jzwvc3Bhbj4nO1xyXG5cclxuXHRcdFx0Q29yZS5VST8uV1BCQ19CRkJfT3ZlcmxheT8uZW5zdXJlPy4oIGN0eD8uYnVpbGRlciwgZWwgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE9wdGlvbmFsIGhvb2sgZXhlY3V0ZWQgYWZ0ZXIgZmllbGQgaXMgZHJvcHBlZCBmcm9tIHRoZSBwYWxldHRlLlxyXG5cdFx0ICogS2VlcHMgYmFzZSBiZWhhdmlvciAoYXV0by1uYW1lLCBhdXRvLWlkKS5cclxuXHRcdCAqXHJcblx0XHQgKiBAakRvY1xyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGRhdGEgRmllbGQgZGF0YSBzbmFwc2hvdC5cclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsIEZpZWxkIGVsZW1lbnQuXHJcblx0XHQgKiBAcGFyYW0ge3twYWxldHRlX2l0ZW0/OiBIVE1MRWxlbWVudH19IFtjdHhdIENvbnRleHQgd2l0aCBwYWxldHRlX2l0ZW0uXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIG9uX2ZpZWxkX2Ryb3AoIGRhdGEsIGVsLCBjdHggKSB7XHJcblx0XHRcdHRyeSB7IHN1cGVyLm9uX2ZpZWxkX2Ryb3A/LiggZGF0YSwgZWwsIGN0eCApOyB9IGNhdGNoIChlKSB7fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly8gUmVnaXN0ZXIgcmVuZGVyZXIuXHJcblx0dHJ5IHtcblx0XHRyZWdpc3RyeS5yZWdpc3RlciggJ3N0ZXBzX3RpbWVsaW5lJywgd3BiY19iZmJfZmllbGRfc3RlcHNfdGltZWxpbmUgKTtcblx0fSBjYXRjaCAoZSkgeyBfd3BiYz8uZGV2Py5lcnJvcj8uKCAnd3BiY19iZmJfZmllbGRfc3RlcHNfdGltZWxpbmUucmVnaXN0ZXInLCBlICk7IH1cblxuXHQvKipcblx0ICogQ29weSB0aGUgY3VycmVudCBGb3JtIFN0eWxlIGFjY2VudCBpbnRvIGV2ZXJ5IFN0ZXBzIFRpbWVsaW5lIGNvbG9yIGZpZWxkLlxuXHQgKiBUaGlzIGlzIGEgb25lLXRpbWUgdmFsdWUgdXBkYXRlOiB0aGUgcmVzdWx0aW5nIGNvbG9yIHJlbWFpbnMgaW5kZXBlbmRlbnRseVxuXHQgKiBlZGl0YWJsZSBhbmQgZG9lcyBub3Qgc3RheSBzeW5jaHJvbml6ZWQgd2l0aCB0aGUgZ2xvYmFsIGFjY2VudCBvcHRpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSB7Q3VzdG9tRXZlbnR9IGV2ZW50IEFjY2VudCBhcHBsaWNhdGlvbiByZXF1ZXN0LlxuXHQgKiBAcmV0dXJucyB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGFwcGx5X2Zvcm1fYWNjZW50X3RvX3N0ZXBzX3RpbWVsaW5lKCBldmVudCApIHtcblx0XHR2YXIgZGV0YWlsID0gZXZlbnQgJiYgZXZlbnQuZGV0YWlsICYmIHR5cGVvZiBldmVudC5kZXRhaWwgPT09ICdvYmplY3QnID8gZXZlbnQuZGV0YWlsIDogbnVsbDtcblx0XHR2YXIgYnVpbGRlciA9IGRldGFpbCAmJiBkZXRhaWwuYnVpbGRlciA/IGRldGFpbC5idWlsZGVyIDogdy53cGJjX2JmYjtcblx0XHR2YXIgcm9vdCA9IGJ1aWxkZXIgJiYgYnVpbGRlci5wYWdlc19jb250YWluZXIgPyBidWlsZGVyLnBhZ2VzX2NvbnRhaW5lciA6IG51bGw7XG5cdFx0dmFyIGFjY2VudF9jb2xvciA9IGRldGFpbFxuXHRcdFx0PyBDb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2hleF9jb2xvciggZGV0YWlsLmFjY2VudF9jb2xvciwgZGVmYXVsdF9mb3JtX2FjY2VudF9jb2xvciApXG5cdFx0XHQ6IGRlZmF1bHRfZm9ybV9hY2NlbnRfY29sb3I7XG5cdFx0dmFyIHNlbGVjdGVkID0gbnVsbDtcblxuXHRcdGlmICggISBkZXRhaWwgfHwgISByb290ICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJvb3QucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fZmllbGRbZGF0YS10eXBlPVwic3RlcHNfdGltZWxpbmVcIl0nICkuZm9yRWFjaCggZnVuY3Rpb24gKCBmaWVsZF9lbCApIHtcblx0XHRcdHZhciBjdXJyZW50X2NvbG9yID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5zYW5pdGl6ZV9oZXhfY29sb3IoIGZpZWxkX2VsLmRhdGFzZXQuY29sb3IsICcjNjE5ZDQwJyApO1xuXG5cdFx0XHRkZXRhaWwubWF0Y2hlZCA9ICggcGFyc2VJbnQoIGRldGFpbC5tYXRjaGVkLCAxMCApIHx8IDAgKSArIDE7XG5cdFx0XHRpZiAoIGN1cnJlbnRfY29sb3IudG9Mb3dlckNhc2UoKSA9PT0gYWNjZW50X2NvbG9yLnRvTG93ZXJDYXNlKCkgJiYgISBmaWVsZF9lbC5oYXNBdHRyaWJ1dGUoICdkYXRhLXVzZV9mb3JtX2FjY2VudCcgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRmaWVsZF9lbC5kYXRhc2V0LmNvbG9yID0gYWNjZW50X2NvbG9yO1xuXHRcdFx0ZmllbGRfZWwucmVtb3ZlQXR0cmlidXRlKCAnZGF0YS11c2VfZm9ybV9hY2NlbnQnICk7XG5cdFx0XHRkZXRhaWwudXBkYXRlZCA9ICggcGFyc2VJbnQoIGRldGFpbC51cGRhdGVkLCAxMCApIHx8IDAgKSArIDE7XG5cdFx0XHRpZiAoIGZpZWxkX2VsLmNsYXNzTGlzdC5jb250YWlucyggJ2lzLXNlbGVjdGVkJyApICkge1xuXHRcdFx0XHRzZWxlY3RlZCA9IGZpZWxkX2VsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBidWlsZGVyLnByZXZpZXdfbW9kZSAmJiB0eXBlb2YgYnVpbGRlci5yZW5kZXJfcHJldmlldyA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0YnVpbGRlci5yZW5kZXJfcHJldmlldyggZmllbGRfZWwgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHRpZiAoIHNlbGVjdGVkICYmIHR5cGVvZiBidWlsZGVyLnNlbGVjdF9maWVsZCA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdGJ1aWxkZXIuc2VsZWN0X2ZpZWxkKCBzZWxlY3RlZCApO1xuXHRcdH1cblx0fVxuXG5cdGQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6YmZiOmFwcGx5LWFjY2VudC10by1jb21wb25lbnRzJywgYXBwbHlfZm9ybV9hY2NlbnRfdG9fc3RlcHNfdGltZWxpbmUsIGZhbHNlICk7XG5cblxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXHQvLyBFeHBvcnQgZm9yIFwiQm9va2luZyBGb3JtXCIgKEFkdmFuY2VkIEZvcm0gc2hvcnRjb2RlKVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0LyoqXHJcblx0ICogUmVnaXN0ZXIgQm9va2luZyBGb3JtIGV4cG9ydGVyIGNhbGxiYWNrIChBZHZhbmNlZCBGb3JtKSBmb3IgXCJzdGVwc190aW1lbGluZVwiLlxyXG5cdCAqXHJcblx0ICogVGhpcyBleHBvcnRlcjpcclxuXHQgKiAgLSBFbWl0cyB0aGUgbGVnYWN5IHNob3J0Y29kZTpcclxuXHQgKiAgICAgICAgW3N0ZXBzX3RpbWVsaW5lIHN0ZXBzX2NvdW50PVwiTlwiIGFjdGl2ZV9zdGVwPVwiS1wiIGNvbG9yPVwiI2hleFwiXVxyXG5cdCAqICAgIHdyYXBwZWQgb3B0aW9uYWxseSBpbjpcclxuXHQgKiAgICAgICAgPHNwYW4gaWQ9XCLigKZcIiBjbGFzcz1cIuKAplwiIHN0eWxlPVwiZmxleDoxO1wiPuKApjwvc3Bhbj5cclxuXHQgKiAgLSBLZWVwcyBiZWhhdmlvciBjb21wYXRpYmxlIHdpdGggdGhlIHByZXZpb3VzIGNlbnRyYWxpemVkIGV4cG9ydGVyOlxyXG5cdCAqICAgICAg4oCiIGNsYW1wcyBzdGVwc19jb3VudCB0byBbMiwxMl0gKGRlZmF1bHQgMyksXHJcblx0ICogICAgICDigKIgY2xhbXBzIGFjdGl2ZV9zdGVwIHRvIFsxLHN0ZXBzX2NvdW50XSAoZGVmYXVsdCAxKSxcclxuXHQgKiAgICAgIOKAoiBzYW5pdGl6ZXMgY29sb3IgdmlhIHNhbml0aXplX2hleF9jb2xvcigpIHdpdGggZGVmYXVsdCBcIiM2MTlkNDBcIixcclxuXHQgKiAgICAgIOKAoiBlbnN1cmVzIHVuaXF1ZSBodG1sX2lkIHZpYSBleHRyYXMuY3R4LnVzZWRJZHMgKGlmIHByb3ZpZGVkKSxcclxuXHQgKiAgICAgIOKAoiByZW5kZXJzIGhlbHAgaW5saW5lIGluc2lkZSB0aGUgd3JhcHBlciBhbmQgY2xlYXJzIGZpZWxkLmhlbHBcclxuXHQgKiAgICAgICAgdG8gcHJldmVudCBvdXRlciBkdXBsaWNhdGlvbi5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiByZWdpc3Rlcl9zdGVwc190aW1lbGluZV9ib29raW5nX2Zvcm1fZXhwb3J0ZXIoKSB7XHJcblxyXG5cdFx0dmFyIEV4cCA9IHcuV1BCQ19CRkJfRXhwb3J0ZXI7XHJcblx0XHRpZiAoICEgRXhwIHx8IHR5cGVvZiBFeHAucmVnaXN0ZXIgIT09ICdmdW5jdGlvbicgKSB7IHJldHVybjsgfVxyXG5cdFx0aWYgKCB0eXBlb2YgRXhwLmhhc19leHBvcnRlciA9PT0gJ2Z1bmN0aW9uJyAmJiBFeHAuaGFzX2V4cG9ydGVyKCAnc3RlcHNfdGltZWxpbmUnICkgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdHZhciBTICAgICAgICAgICA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemUgfHwge307XHJcblx0XHR2YXIgZXNjX2h0bWwgICAgPSBTLmVzY2FwZV9odG1sICAgICAgICAgICAgfHwgZnVuY3Rpb24oIHYgKXsgcmV0dXJuIFN0cmluZyggdiApLnJlcGxhY2UoIC9bPD4mXCJdL2csICcnICk7IH07XHJcblx0XHR2YXIgc2FuaXRpemVJZCAgPSBTLnNhbml0aXplX2h0bWxfaWQgICAgICAgfHwgZnVuY3Rpb24oIHYgKXsgcmV0dXJuIFN0cmluZyggdiApLnRyaW0oKTsgfTtcclxuXHRcdHZhciBzYW5pdGl6ZUNscyA9IFMuc2FuaXRpemVfY3NzX2NsYXNzbGlzdCB8fCBmdW5jdGlvbiggdiApeyByZXR1cm4gU3RyaW5nKCB2ICkudHJpbSgpOyB9O1xyXG5cdFx0dmFyIHNhbml0aXplSGV4ID0gUy5zYW5pdGl6ZV9oZXhfY29sb3IgICAgIHx8IGZ1bmN0aW9uKCB2LCBkZWYgKXtcclxuXHRcdFx0aWYgKCB0eXBlb2YgdiA9PT0gJ3N0cmluZycgJiYgL14jP1swLTlhLWZdezMsOH0kL2kudGVzdCggdiApICkge1xyXG5cdFx0XHRcdHJldHVybiAoIHYuY2hhckF0KCAwICkgPT09ICcjJyApID8gdiA6ICggJyMnICsgdiApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBkZWYgfHwgJyM2MTlkNDAnO1xyXG5cdFx0fTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEB0eXBlIHtXUEJDX0JGQl9FeHBvcnRlckNhbGxiYWNrfVxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGZpZWxkXHJcblx0XHQgKiBAcGFyYW0ge2Z1bmN0aW9uKHN0cmluZyk6dm9pZH0gZW1pdFxyXG5cdFx0ICogQHBhcmFtIHt7Y3R4Pzp7dXNlZElkcz86U2V0PGFueT59fX0gW2V4dHJhc11cclxuXHRcdCAqL1xyXG5cdFx0dmFyIGV4cG9ydGVyX2NhbGxiYWNrID0gZnVuY3Rpb24oIGZpZWxkLCBlbWl0LCBleHRyYXMgKSB7XHJcblxyXG5cdFx0XHRleHRyYXMgPSBleHRyYXMgfHwge307XHJcblxyXG5cdFx0XHQvLyBDbGFtcCBzdGVwc19jb3VudCBpbnRvIFsyLDEyXSwgZGVmYXVsdCAzIChsZWdhY3kgYmVoYXZpb3IpLlxyXG5cdFx0XHR2YXIgc2MgPSBwYXJzZUludCggZmllbGQgJiYgZmllbGQuc3RlcHNfY291bnQsIDEwICk7XHJcblx0XHRcdGlmICggaXNOYU4oIHNjICkgKSB7IHNjID0gMzsgfVxyXG5cdFx0XHRpZiAoIHNjIDwgMiApIHsgc2MgPSAyOyB9XHJcblx0XHRcdGlmICggc2MgPiAxMiApIHsgc2MgPSAxMjsgfVxyXG5cclxuXHRcdFx0Ly8gQ2xhbXAgYWN0aXZlX3N0ZXAgaW50byBbMSxzdGVwc19jb3VudF0sIGRlZmF1bHQgMSAobGVnYWN5IGJlaGF2aW9yKS5cclxuXHRcdFx0dmFyIGFzID0gcGFyc2VJbnQoIGZpZWxkICYmIGZpZWxkLmFjdGl2ZV9zdGVwLCAxMCApO1xyXG5cdFx0XHRpZiAoIGlzTmFOKCBhcyApICkgeyBhcyA9IDE7IH1cclxuXHRcdFx0aWYgKCBhcyA8IDEgKSB7IGFzID0gMTsgfVxyXG5cdFx0XHRpZiAoIGFzID4gc2MgKSB7IGFzID0gc2M7IH1cclxuXHJcblx0XHRcdC8vIFNhbml0aXplIHRoZSBlZGl0YWJsZSBmaWVsZCBjb2xvciB3aXRoIGl0cyBsZWdhY3kgZGVmYXVsdC5cblx0XHRcdHZhciBjb2wgPSBzYW5pdGl6ZUhleCggZmllbGQgJiYgZmllbGQuY29sb3IsICcjNjE5ZDQwJyApO1xuXHJcblx0XHRcdC8vIFNhbml0aXplIGlkL2NsYXNzIGZvciBvdXRlciA8c3Bhbj4uXHJcblx0XHRcdHZhciBodG1sX2lkID0gKCBmaWVsZCAmJiBmaWVsZC5odG1sX2lkICkgPyBzYW5pdGl6ZUlkKCBTdHJpbmcoIGZpZWxkLmh0bWxfaWQgKSApIDogJyc7XHJcblx0XHRcdHZhciBjbHNfcmF3ID0gU3RyaW5nKFxyXG5cdFx0XHRcdCggZmllbGQgJiYgKCBmaWVsZC5jc3NjbGFzc19leHRyYSB8fCBmaWVsZC5jc3NjbGFzcyB8fCBmaWVsZFsnY2xhc3MnXSApICkgfHwgJydcclxuXHRcdFx0KTtcclxuXHRcdFx0dmFyIGNsc192YWwgPSBzYW5pdGl6ZUNscyggY2xzX3JhdyApO1xyXG5cclxuXHRcdFx0Ly8gRW5zdXJlIGh0bWxfaWQgaXMgdW5pcXVlIGFjcm9zcyBleHBvcnQgKHNoYXJlZCBjdHgudXNlZElkcyBzZXQpLlxyXG5cdFx0XHR2YXIgdXNlZF9pZHMgPSBleHRyYXMgJiYgZXh0cmFzLmN0eCAmJiBleHRyYXMuY3R4LnVzZWRJZHM7XHJcblx0XHRcdGlmICggaHRtbF9pZCAmJiB1c2VkX2lkcyBpbnN0YW5jZW9mIFNldCApIHtcclxuXHRcdFx0XHR2YXIgdW5pcXVlID0gaHRtbF9pZDtcclxuXHRcdFx0XHR2YXIgaSAgICAgID0gMjtcclxuXHRcdFx0XHR3aGlsZSAoIHVzZWRfaWRzLmhhcyggdW5pcXVlICkgKSB7XHJcblx0XHRcdFx0XHR1bmlxdWUgPSBodG1sX2lkICsgJ18nICsgKCBpKysgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dXNlZF9pZHMuYWRkKCB1bmlxdWUgKTtcclxuXHRcdFx0XHRodG1sX2lkID0gdW5pcXVlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgaWRfYXR0ciAgPSBodG1sX2lkID8gKCAnIGlkPVwiJyArIGVzY19odG1sKCBodG1sX2lkICkgKyAnXCInICkgOiAnJztcclxuXHRcdFx0dmFyIGNsc19hdHRyID0gY2xzX3ZhbCA/ICggJyBjbGFzcz1cIicgKyBlc2NfaHRtbCggY2xzX3ZhbCApICsgJ1wiJyApIDogJyc7XHJcblxyXG5cdFx0XHQvLyBIZWxwIGluc2lkZSB0aGUgd3JhcHBlciAobGVnYWN5IGJlaGF2aW9yKS5cclxuXHRcdFx0dmFyIGhlbHBfaHRtbCA9ICggZmllbGQgJiYgZmllbGQuaGVscCApID8gJzxkaXYgY2xhc3M9XCJ3cGJjX2ZpZWxkX2Rlc2NyaXB0aW9uXCI+JyArIGVzY19odG1sKCBTdHJpbmcoIGZpZWxkLmhlbHAgKSApICsgJzwvZGl2PicgOiAnJztcclxuXHJcblx0XHRcdC8vIE9ubHkgd3JhcCBpbiA8c3BhbiAuLi4gc3R5bGU9XCJmbGV4OjE7XCI+IGlmIGlkIG9yIGNsYXNzIGV4aXN0cy5cclxuXHRcdFx0dmFyIGhhc193cmFwcGVyID0gISEgKCBpZF9hdHRyIHx8IGNsc19hdHRyICk7XHJcblx0XHRcdHZhciBvcGVuICAgICAgICA9IGhhc193cmFwcGVyID8gKCAnPHNwYW4nICsgaWRfYXR0ciArIGNsc19hdHRyICsgJyBzdHlsZT1cImZsZXg6MTtcIj4nICkgOiAnJztcclxuXHRcdFx0dmFyIGNsb3NlICAgICAgID0gaGFzX3dyYXBwZXIgPyAnPC9zcGFuPicgOiAnJztcclxuXHJcblx0XHRcdC8vIExlZ2FjeSBzaG9ydGNvZGUgbmFtZSBzcGVsbGluZyBpcyBpbnRlbnRpb25hbDogXCJzdGVwc190aW1lbGluZVwiLlxyXG5cdFx0XHRlbWl0KFxyXG5cdFx0XHRcdG9wZW4gK1xyXG5cdFx0XHRcdFx0J1tzdGVwc190aW1lbGluZSBzdGVwc19jb3VudD1cIicgKyBzYyArICdcIiBhY3RpdmVfc3RlcD1cIicgKyBhcyArICdcIiBjb2xvcj1cIicgKyBjb2wgKyAnXCJdJyArXG5cdFx0XHRcdFx0aGVscF9odG1sICtcclxuXHRcdFx0XHRjbG9zZVxyXG5cdFx0XHQpO1xyXG5cclxuXHRcdFx0Ly8gUHJldmVudCBvdXRlciB3cmFwcGVyIGZyb20gcHJpbnRpbmcgaGVscCBhZ2Fpbi5cclxuXHRcdFx0aWYgKCBmaWVsZCApIHtcclxuXHRcdFx0XHRmaWVsZC5oZWxwID0gJyc7XHJcblx0XHRcdH1cclxuXHRcdH07XHJcblxyXG5cdFx0RXhwLnJlZ2lzdGVyKCAnc3RlcHNfdGltZWxpbmUnLCBleHBvcnRlcl9jYWxsYmFjayApO1xyXG5cdH1cclxuXHJcblx0aWYgKCB3LldQQkNfQkZCX0V4cG9ydGVyICYmIHR5cGVvZiB3LldQQkNfQkZCX0V4cG9ydGVyLnJlZ2lzdGVyID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0cmVnaXN0ZXJfc3RlcHNfdGltZWxpbmVfYm9va2luZ19mb3JtX2V4cG9ydGVyKCk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6YmZiOmV4cG9ydGVyLXJlYWR5JywgcmVnaXN0ZXJfc3RlcHNfdGltZWxpbmVfYm9va2luZ19mb3JtX2V4cG9ydGVyLCB7IG9uY2U6IHRydWUgfSApO1xyXG5cdH1cclxuXHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRXhwb3J0IGZvciBcIkJvb2tpbmcgRGF0YVwiIChDb250ZW50IG9mIGJvb2tpbmcgZmllbGRzIGRhdGEpXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvKipcclxuXHQgKiBSZWdpc3RlciBCb29raW5nIERhdGEgZXhwb3J0ZXIgY2FsbGJhY2sgKFwiQ29udGVudCBvZiBib29raW5nIGZpZWxkcyBkYXRhXCIpIGZvciBcInN0ZXBzX3RpbWVsaW5lXCIuXHJcblx0ICpcclxuXHQgKiBTdGVwcyBUaW1lbGluZSBpcyBwdXJlbHkgcHJlc2VudGF0aW9uYWwgYW5kIGRvZXMgbm90IGNhcnJ5IHVzZXItZW50ZXJlZCB2YWx1ZXMsXHJcblx0ICogc28gaXQgaXMgaW50ZW50aW9uYWxseSBvbWl0dGVkIGZyb20gdGhlIFwiQ29udGVudCBvZiBib29raW5nIGZpZWxkcyBkYXRhXCIgb3V0cHV0LlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHJlZ2lzdGVyX3N0ZXBzX3RpbWVsaW5lX2Jvb2tpbmdfZGF0YV9leHBvcnRlcigpIHtcclxuXHJcblx0XHR2YXIgQyA9IHcuV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyO1xyXG5cdFx0aWYgKCAhIEMgfHwgdHlwZW9mIEMucmVnaXN0ZXIgIT09ICdmdW5jdGlvbicgKSB7IHJldHVybjsgfVxyXG5cdFx0aWYgKCB0eXBlb2YgQy5oYXNfZXhwb3J0ZXIgPT09ICdmdW5jdGlvbicgJiYgQy5oYXNfZXhwb3J0ZXIoICdzdGVwc190aW1lbGluZScgKSApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZmllbGRcclxuXHRcdCAqIEBwYXJhbSB7ZnVuY3Rpb24oc3RyaW5nKTp2b2lkfSBlbWl0XHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gW2V4dHJhc11cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHR2YXIgZXhwb3J0ZXJfY2FsbGJhY2sgPSBmdW5jdGlvbiggZmllbGQsIGVtaXQsIGV4dHJhcyApIHtcclxuXHRcdFx0Ly8gSW50ZW50aW9uYWxseSBlbXB0eTogc3RlcHNfdGltZWxpbmUgaGFzIG5vIGR5bmFtaWMgdG9rZW4vdmFsdWVcclxuXHRcdFx0Ly8gdG8gc2hvdyBpbiBib29raW5nIGRhdGEuXHJcblx0XHRcdHJldHVybjtcclxuXHRcdH07XHJcblxyXG5cdFx0Qy5yZWdpc3RlciggJ3N0ZXBzX3RpbWVsaW5lJywgZXhwb3J0ZXJfY2FsbGJhY2sgKTtcclxuXHR9XHJcblxyXG5cdGlmICggdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIgJiYgdHlwZW9mIHcuV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyLnJlZ2lzdGVyID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0cmVnaXN0ZXJfc3RlcHNfdGltZWxpbmVfYm9va2luZ19kYXRhX2V4cG9ydGVyKCk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6YmZiOmNvbnRlbnQtZXhwb3J0ZXItcmVhZHknLCByZWdpc3Rlcl9zdGVwc190aW1lbGluZV9ib29raW5nX2RhdGFfZXhwb3J0ZXIsIHsgb25jZTogdHJ1ZSB9ICk7XHJcblx0fVxyXG5cclxuXHJcbn0pKCB3aW5kb3csIGRvY3VtZW50ICk7XHJcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBLENBQUMsVUFBVUEsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7RUFDaEIsWUFBWTs7RUFFWixJQUFJQyxJQUFJLEdBQU9GLENBQUMsQ0FBQ0csYUFBYSxJQUFJLENBQUMsQ0FBQztFQUNwQyxJQUFJQyxRQUFRLEdBQUdGLElBQUksQ0FBQ0csZ0NBQWdDO0VBQ3BELElBQUlDLElBQUksR0FBT0osSUFBSSxDQUFDSyxtQkFBbUI7RUFDdkMsSUFBSUMsOEJBQThCLEdBQUdSLENBQUMsQ0FBQ1Msc0JBQXNCLElBQUlULENBQUMsQ0FBQ1Msc0JBQXNCLENBQUNDLG9CQUFvQixHQUMzR1YsQ0FBQyxDQUFDUyxzQkFBc0IsQ0FBQ0Msb0JBQW9CLEdBQzdDLENBQUMsQ0FBQztFQUNMLElBQUlDLG1DQUFtQyxHQUFHQyxNQUFNLENBQUVKLDhCQUE4QixDQUFDSyx5QkFBeUIsSUFBSSxFQUFHLENBQUMsQ0FBQ0MsSUFBSSxDQUFDLENBQUM7O0VB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
