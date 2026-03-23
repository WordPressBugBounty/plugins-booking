"use strict";

// =================================================================================================
// == Pack: Static Text (WP-template-less; schema-driven)
// == File: /includes/page-form-builder/field-packs/static-text/_out/static-text.js
// == Depends: WPBC_BFB_Field_Base, Field_Renderer_Registry, Core.Sanitize, Exporter API
// == Version: 1.0.1  (09.11.2025)  — add base CSS class "wpbc_static_text" to preview & export
// =================================================================================================
(function (w, d) {
  'use strict';

  var Core = w.WPBC_BFB_Core || {};
  var registry = Core.WPBC_BFB_Field_Renderer_Registry;
  var Base = Core.WPBC_BFB_Field_Base;
  if (!registry || typeof registry.register !== 'function' || !Base) {
    _wpbc?.dev?.error?.('wpbc_bfb_field_static_text', 'Core registry/base missing');
    return;
  }

  /**
   * Field Renderer: static_text
   * - Renders a single text element with configurable tag, align, bold, italic.
   * - Supports pass-through HTML (preview only) if html_allowed=1; otherwise escapes + optional nl2br.
   *
   * @class wpbc_bfb_field_static_text
   * @extends Core.WPBC_BFB_Field_Base
   */
  class wpbc_bfb_field_static_text extends Base {
    /**
     * Defaults (must mirror PHP schema).
     * @returns {{type:string,text:string,tag:string,align:string,bold:number,italic:number,html_allowed:number,nl2br:number,cssclass_extra:string,name:string,html_id:string,help:string,usage_key:string}}
     */
    static get_defaults() {
      return {
        type: 'static_text',
        text: 'Add your message here…',
        tag: 'p',
        align: 'left',
        bold: 0,
        italic: 0,
        html_allowed: 0,
        nl2br: 1,
        cssclass_extra: '',
        name: '',
        html_id: '',
        help: '',
        usage_key: 'static_text'
      };
    }

    /**
     * Whitelist tag.
     * @param {string} v
     * @returns {string}
     */
    static allow_tag(v) {
      var t = String(v || 'p').toLowerCase();
      var ok = {
        p: 1,
        label: 1,
        span: 1,
        small: 1,
        div: 1,
        h1: 1,
        h2: 1,
        h3: 1,
        h4: 1,
        h5: 1,
        h6: 1
      };
      return ok[t] ? t : 'p';
    }

    /**
     * Whitelist align.
     * @param {string} v
     * @returns {string}
     */
    static allow_align(v) {
      var a = String(v || 'left').toLowerCase();
      var ok = {
        left: 1,
        center: 1,
        right: 1
      };
      return ok[a] ? a : 'left';
    }

    /**
     * Escape + optional nl2br for preview/export when HTML is not allowed.
     * @param {string} raw
     * @param {boolean} do_nl2br
     * @returns {string}
     */
    static escape_text(raw, do_nl2br) {
      var esc = Core.WPBC_BFB_Sanitize.escape_html(String(raw || ''));
      if (do_nl2br && !/<br\s*\/?>/i.test(esc)) {
        esc = esc.replace(/\n/g, '<br>');
      }
      return esc;
    }

    /**
     * Main render entry (called by Builder).
     * Adds the base class "wpbc_static_text" to the text element for styling parity with export.
     *
     * @param {HTMLElement} el
     * @param {Object} data
     * @param {{builder?:any}} ctx
     * @returns {void}
     */
    static render(el, data, ctx) {
      if (!el) {
        return;
      }
      var sanit = Core.WPBC_BFB_Sanitize || {};
      var esc_html = sanit.escape_html || (v => String(v).replace(/[<>&"]/g, ''));
      var sanitize_id = sanit.sanitize_html_id || (v => String(v).trim());
      var sanitize_name = sanit.sanitize_html_name || (v => String(v).trim());
      var sanitize_cls = sanit.sanitize_css_classlist || (v => String(v).trim());
      var d_norm = Object.assign({}, this.get_defaults(), data || {});
      var tag = this.allow_tag(d_norm.tag);
      var align = this.allow_align(d_norm.align);
      var html_id = d_norm.html_id ? sanitize_id(String(d_norm.html_id)) : '';
      var name_val = d_norm.name ? sanitize_name(String(d_norm.name)) : '';
      var cls_extra_raw = String(d_norm.cssclass_extra || '');
      var cls_extra = sanitize_cls(cls_extra_raw);

      // Persist sanitized dataset (helps Inspector & snapshots)
      if (el.dataset.html_id !== html_id) {
        el.dataset.html_id = html_id;
      }
      if (el.dataset.name !== name_val) {
        el.dataset.name = name_val;
      }
      if (el.dataset.cssclass_extra !== cls_extra) {
        el.dataset.cssclass_extra = cls_extra;
      }
      if (el.dataset.tag !== tag) {
        el.dataset.tag = tag;
      }
      if (el.dataset.align !== align) {
        el.dataset.align = align;
      }
      var id_attr = html_id ? ' id="' + esc_html(html_id) + '"' : '';
      var name_attr = name_val ? ' name="' + esc_html(name_val) + '"' : '';

      // --- NEW: base class on the TEXT element ---
      var base_cls = 'wpbc_static_text';
      var tag_cls_full = base_cls + (cls_extra ? ' ' + cls_extra : '');
      var cls_attr = ' class="' + esc_html(tag_cls_full) + '"';
      var style_bits = [];
      if (align) {
        style_bits.push('text-align:' + align);
      }
      if (d_norm.bold) {
        style_bits.push('font-weight:bold');
      }
      if (d_norm.italic) {
        style_bits.push('font-style:italic');
      }
      var style_attr = style_bits.length ? ' style="' + style_bits.join(';') + '"' : '';

      // Content
      var content = '';
      if (d_norm.html_allowed) {
        content = String(d_norm.text || '');
      } else {
        content = this.escape_text(d_norm.text, !!d_norm.nl2br);
      }
      var help_html = d_norm.help ? '<div class="wpbc_bfb__help">' + esc_html(String(d_norm.help)) + '</div>' : '';
      el.innerHTML = '<span class="wpbc_bfb__no-drag-zone" inert="">' + '<' + tag + id_attr + name_attr + cls_attr + style_attr + '>' + content + '</' + tag + '>' + help_html + '</span>';
      Core.UI?.WPBC_BFB_Overlay?.ensure?.(ctx?.builder, el);
    }

    /**
     * Optional hook after drop (keep base behavior).
     * @param {Object} data
     * @param {HTMLElement} el
     * @param {{palette_item?:HTMLElement}} ctx
     * @returns {void}
     */
    static on_field_drop(data, el, ctx) {
      try {
        super.on_field_drop?.(data, el, ctx);
      } catch (e) {}
    }
  }

  // Register renderer
  try {
    registry.register('static_text', wpbc_bfb_field_static_text);
  } catch (e) {
    _wpbc?.dev?.error?.('wpbc_bfb_field_static_text.register', e);
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Form" (Advanced Form shortcode)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Register Booking Form exporter callback (Advanced Form) for "static_text".
   *
   * This exporter:
   *  - Emits plain HTML using the same tag/align/bold/italic rules as the Builder preview.
   *  - Adds the base class "wpbc_static_text" plus any extra CSS classes.
   *  - Respects:
   *      • html_allowed = 1 → pass-through HTML (no escaping).
   *      • html_allowed = 0 → escape + optional nl2br (via wpbc_bfb_field_static_text.escape_text()).
   *      • html_id / name   → rendered as id="…" / name="…".
   *  - Help text is appended centrally by WPBC_BFB_Exporter.render_field_node(), same as other packs.
   */
  function register_static_text_booking_form_exporter() {
    var Exp = w.WPBC_BFB_Exporter;
    if (!Exp || typeof Exp.register !== 'function') {
      return;
    }
    if (typeof Exp.has_exporter === 'function' && Exp.has_exporter('static_text')) {
      return;
    }
    var S = Core.WPBC_BFB_Sanitize || {};
    var esc_html = S.escape_html || function (v) {
      return String(v);
    };
    var sanitizeId = S.sanitize_html_id || function (v) {
      return String(v).trim();
    };
    var sanitizeNm = S.sanitize_html_name || function (v) {
      return String(v).trim();
    };
    var sanitizeCl = S.sanitize_css_classlist || function (v) {
      return String(v).trim();
    };

    /**
     * @type {WPBC_BFB_ExporterCallback}
     * @param {Object}  field
     * @param {function(string):void} emit
     * @param {Object}  [extras]
     */
    var exporter_callback = function (field, emit, extras) {
      extras = extras || {};

      // Merge with defaults so all props are present (mirrors preview).
      var defs = wpbc_bfb_field_static_text.get_defaults();
      var d = Object.assign({}, defs, field || {});
      var tag = wpbc_bfb_field_static_text.allow_tag(d.tag);
      var align = wpbc_bfb_field_static_text.allow_align(d.align);
      var html_id = d.html_id ? sanitizeId(String(d.html_id)) : '';
      var name_val = d.name ? sanitizeNm(String(d.name)) : '';

      // Extra CSS classes from Inspector / schema.
      var cls_extra_raw = String(d.cssclass_extra || d.cssclass || d.class || '');
      var cls_extra = sanitizeCl(cls_extra_raw);

      // Base class for styling parity between Builder preview and exported form.
      var base_cls = 'wpbc_static_text';
      var cls_full = base_cls + (cls_extra ? ' ' + cls_extra : '');
      var id_attr = html_id ? ' id="' + esc_html(html_id) + '"' : '';
      var name_attr = name_val ? ' name="' + esc_html(name_val) + '"' : '';
      var cls_attr = ' class="' + esc_html(cls_full) + '"';

      // Inline styles: text-align + bold/italic flags.
      var style_bits = [];
      if (align) {
        style_bits.push('text-align:' + align);
      }
      if (d.bold) {
        style_bits.push('font-weight:bold');
      }
      if (d.italic) {
        style_bits.push('font-style:italic');
      }
      var style_attr = style_bits.length ? ' style="' + esc_html(style_bits.join(';')) + '"' : '';

      // Content: escape + nl2br when HTML is NOT allowed; raw when allowed.
      var content;
      if (d.html_allowed) {
        content = String(d.text || '');
      } else {
        content = wpbc_bfb_field_static_text.escape_text(d.text, !!d.nl2br);
      }
      emit('<' + tag + id_attr + name_attr + cls_attr + style_attr + '>' + content + '</' + tag + '>');
      // NOTE:
      //  - Help text (field.help) is output by WPBC_BFB_Exporter.render_field_node()
      //    beneath this block, keeping behavior consistent with other field packs.
    };
    Exp.register('static_text', exporter_callback);
  }

  // Try immediate registration; if core isn’t ready yet, wait for the event.
  if (w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function') {
    register_static_text_booking_form_exporter();
  } else {
    d.addEventListener('wpbc:bfb:exporter-ready', register_static_text_booking_form_exporter, {
      once: true
    });
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Data" (Content of booking fields data)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Register Booking Data exporter callback ("Content of booking fields data") for "static_text".
   *
   * Static Text is purely presentational and does not carry user-entered values,
   * so it is intentionally omitted from the "Content of booking fields data" output.
   * This exporter therefore does nothing (emits no line).
   */
  function register_static_text_booking_data_exporter() {
    var C = w.WPBC_BFB_ContentExporter;
    if (!C || typeof C.register !== 'function') {
      return;
    }
    if (typeof C.has_exporter === 'function' && C.has_exporter('static_text')) {
      return;
    }
    var exporter_callback = function (field, emit, extras) {
      // Intentionally empty: static_text has no dynamic token/value to show in booking data.
      return;
    };
    C.register('static_text', exporter_callback);
  }
  if (w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function') {
    register_static_text_booking_data_exporter();
  } else {
    d.addEventListener('wpbc:bfb:content-exporter-ready', register_static_text_booking_data_exporter, {
      once: true
    });
  }
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3Mvc3RhdGljLXRleHQvX291dC9zdGF0aWMtdGV4dC5qcyIsIm5hbWVzIjpbInciLCJkIiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJyZWdpc3RyeSIsIldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5IiwiQmFzZSIsIldQQkNfQkZCX0ZpZWxkX0Jhc2UiLCJyZWdpc3RlciIsIl93cGJjIiwiZGV2IiwiZXJyb3IiLCJ3cGJjX2JmYl9maWVsZF9zdGF0aWNfdGV4dCIsImdldF9kZWZhdWx0cyIsInR5cGUiLCJ0ZXh0IiwidGFnIiwiYWxpZ24iLCJib2xkIiwiaXRhbGljIiwiaHRtbF9hbGxvd2VkIiwibmwyYnIiLCJjc3NjbGFzc19leHRyYSIsIm5hbWUiLCJodG1sX2lkIiwiaGVscCIsInVzYWdlX2tleSIsImFsbG93X3RhZyIsInYiLCJ0IiwiU3RyaW5nIiwidG9Mb3dlckNhc2UiLCJvayIsInAiLCJsYWJlbCIsInNwYW4iLCJzbWFsbCIsImRpdiIsImgxIiwiaDIiLCJoMyIsImg0IiwiaDUiLCJoNiIsImFsbG93X2FsaWduIiwiYSIsImxlZnQiLCJjZW50ZXIiLCJyaWdodCIsImVzY2FwZV90ZXh0IiwicmF3IiwiZG9fbmwyYnIiLCJlc2MiLCJXUEJDX0JGQl9TYW5pdGl6ZSIsImVzY2FwZV9odG1sIiwidGVzdCIsInJlcGxhY2UiLCJyZW5kZXIiLCJlbCIsImRhdGEiLCJjdHgiLCJzYW5pdCIsImVzY19odG1sIiwic2FuaXRpemVfaWQiLCJzYW5pdGl6ZV9odG1sX2lkIiwidHJpbSIsInNhbml0aXplX25hbWUiLCJzYW5pdGl6ZV9odG1sX25hbWUiLCJzYW5pdGl6ZV9jbHMiLCJzYW5pdGl6ZV9jc3NfY2xhc3NsaXN0IiwiZF9ub3JtIiwiT2JqZWN0IiwiYXNzaWduIiwibmFtZV92YWwiLCJjbHNfZXh0cmFfcmF3IiwiY2xzX2V4dHJhIiwiZGF0YXNldCIsImlkX2F0dHIiLCJuYW1lX2F0dHIiLCJiYXNlX2NscyIsInRhZ19jbHNfZnVsbCIsImNsc19hdHRyIiwic3R5bGVfYml0cyIsInB1c2giLCJzdHlsZV9hdHRyIiwibGVuZ3RoIiwiam9pbiIsImNvbnRlbnQiLCJoZWxwX2h0bWwiLCJpbm5lckhUTUwiLCJVSSIsIldQQkNfQkZCX092ZXJsYXkiLCJlbnN1cmUiLCJidWlsZGVyIiwib25fZmllbGRfZHJvcCIsImUiLCJyZWdpc3Rlcl9zdGF0aWNfdGV4dF9ib29raW5nX2Zvcm1fZXhwb3J0ZXIiLCJFeHAiLCJXUEJDX0JGQl9FeHBvcnRlciIsImhhc19leHBvcnRlciIsIlMiLCJzYW5pdGl6ZUlkIiwic2FuaXRpemVObSIsInNhbml0aXplQ2wiLCJleHBvcnRlcl9jYWxsYmFjayIsImZpZWxkIiwiZW1pdCIsImV4dHJhcyIsImRlZnMiLCJjc3NjbGFzcyIsImNsYXNzIiwiY2xzX2Z1bGwiLCJhZGRFdmVudExpc3RlbmVyIiwib25jZSIsInJlZ2lzdGVyX3N0YXRpY190ZXh0X2Jvb2tpbmdfZGF0YV9leHBvcnRlciIsIkMiLCJXUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIiLCJ3aW5kb3ciLCJkb2N1bWVudCJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2ZpZWxkLXBhY2tzL3N0YXRpYy10ZXh0L19zcmMvc3RhdGljLXRleHQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyA9PSBQYWNrOiBTdGF0aWMgVGV4dCAoV1AtdGVtcGxhdGUtbGVzczsgc2NoZW1hLWRyaXZlbilcclxuLy8gPT0gRmlsZTogL2luY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2ZpZWxkLXBhY2tzL3N0YXRpYy10ZXh0L19vdXQvc3RhdGljLXRleHQuanNcclxuLy8gPT0gRGVwZW5kczogV1BCQ19CRkJfRmllbGRfQmFzZSwgRmllbGRfUmVuZGVyZXJfUmVnaXN0cnksIENvcmUuU2FuaXRpemUsIEV4cG9ydGVyIEFQSVxyXG4vLyA9PSBWZXJzaW9uOiAxLjAuMSAgKDA5LjExLjIwMjUpICDigJQgYWRkIGJhc2UgQ1NTIGNsYXNzIFwid3BiY19zdGF0aWNfdGV4dFwiIHRvIHByZXZpZXcgJiBleHBvcnRcclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4oZnVuY3Rpb24gKHcsIGQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdHZhciBDb3JlICAgICAgPSB3LldQQkNfQkZCX0NvcmUgfHwge307XHJcblx0dmFyIHJlZ2lzdHJ5ICA9IENvcmUuV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnk7XHJcblx0dmFyIEJhc2UgICAgICA9IENvcmUuV1BCQ19CRkJfRmllbGRfQmFzZTtcclxuXHJcblx0aWYgKCAhIHJlZ2lzdHJ5IHx8IHR5cGVvZiByZWdpc3RyeS5yZWdpc3RlciAhPT0gJ2Z1bmN0aW9uJyB8fCAhIEJhc2UgKSB7XHJcblx0XHRfd3BiYz8uZGV2Py5lcnJvcj8uKCAnd3BiY19iZmJfZmllbGRfc3RhdGljX3RleHQnLCAnQ29yZSByZWdpc3RyeS9iYXNlIG1pc3NpbmcnICk7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBGaWVsZCBSZW5kZXJlcjogc3RhdGljX3RleHRcclxuXHQgKiAtIFJlbmRlcnMgYSBzaW5nbGUgdGV4dCBlbGVtZW50IHdpdGggY29uZmlndXJhYmxlIHRhZywgYWxpZ24sIGJvbGQsIGl0YWxpYy5cclxuXHQgKiAtIFN1cHBvcnRzIHBhc3MtdGhyb3VnaCBIVE1MIChwcmV2aWV3IG9ubHkpIGlmIGh0bWxfYWxsb3dlZD0xOyBvdGhlcndpc2UgZXNjYXBlcyArIG9wdGlvbmFsIG5sMmJyLlxyXG5cdCAqXHJcblx0ICogQGNsYXNzIHdwYmNfYmZiX2ZpZWxkX3N0YXRpY190ZXh0XHJcblx0ICogQGV4dGVuZHMgQ29yZS5XUEJDX0JGQl9GaWVsZF9CYXNlXHJcblx0ICovXHJcblx0Y2xhc3Mgd3BiY19iZmJfZmllbGRfc3RhdGljX3RleHQgZXh0ZW5kcyBCYXNlIHtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIERlZmF1bHRzIChtdXN0IG1pcnJvciBQSFAgc2NoZW1hKS5cclxuXHRcdCAqIEByZXR1cm5zIHt7dHlwZTpzdHJpbmcsdGV4dDpzdHJpbmcsdGFnOnN0cmluZyxhbGlnbjpzdHJpbmcsYm9sZDpudW1iZXIsaXRhbGljOm51bWJlcixodG1sX2FsbG93ZWQ6bnVtYmVyLG5sMmJyOm51bWJlcixjc3NjbGFzc19leHRyYTpzdHJpbmcsbmFtZTpzdHJpbmcsaHRtbF9pZDpzdHJpbmcsaGVscDpzdHJpbmcsdXNhZ2Vfa2V5OnN0cmluZ319XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBnZXRfZGVmYXVsdHMoKSB7XHJcblx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0dHlwZSAgICAgICAgICAgIDogJ3N0YXRpY190ZXh0JyxcclxuXHRcdFx0XHR0ZXh0ICAgICAgICAgICAgOiAnQWRkIHlvdXIgbWVzc2FnZSBoZXJl4oCmJyxcclxuXHRcdFx0XHR0YWcgICAgICAgICAgICAgOiAncCcsXHJcblx0XHRcdFx0YWxpZ24gICAgICAgICAgIDogJ2xlZnQnLFxyXG5cdFx0XHRcdGJvbGQgICAgICAgICAgICA6IDAsXHJcblx0XHRcdFx0aXRhbGljICAgICAgICAgIDogMCxcclxuXHRcdFx0XHRodG1sX2FsbG93ZWQgICAgOiAwLFxyXG5cdFx0XHRcdG5sMmJyICAgICAgICAgICA6IDEsXHJcblx0XHRcdFx0Y3NzY2xhc3NfZXh0cmEgIDogJycsXHJcblx0XHRcdFx0bmFtZSAgICAgICAgICAgIDogJycsXHJcblx0XHRcdFx0aHRtbF9pZCAgICAgICAgIDogJycsXHJcblx0XHRcdFx0aGVscCAgICAgICAgICAgIDogJycsXHJcblx0XHRcdFx0dXNhZ2Vfa2V5ICAgICAgIDogJ3N0YXRpY190ZXh0J1xyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogV2hpdGVsaXN0IHRhZy5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB2XHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgYWxsb3dfdGFnKCB2ICkge1xyXG5cdFx0XHR2YXIgdCA9IFN0cmluZyggdiB8fCAncCcgKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0XHR2YXIgb2sgPSB7IHA6MSxsYWJlbDoxLHNwYW46MSxzbWFsbDoxLGRpdjoxLGgxOjEsaDI6MSxoMzoxLGg0OjEsaDU6MSxoNjoxIH07XHJcblx0XHRcdHJldHVybiBva1t0XSA/IHQgOiAncCc7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBXaGl0ZWxpc3QgYWxpZ24uXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdlxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGFsbG93X2FsaWduKCB2ICkge1xyXG5cdFx0XHR2YXIgYSA9IFN0cmluZyggdiB8fCAnbGVmdCcgKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0XHR2YXIgb2sgPSB7IGxlZnQ6MSwgY2VudGVyOjEsIHJpZ2h0OjEgfTtcclxuXHRcdFx0cmV0dXJuIG9rW2FdID8gYSA6ICdsZWZ0JztcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEVzY2FwZSArIG9wdGlvbmFsIG5sMmJyIGZvciBwcmV2aWV3L2V4cG9ydCB3aGVuIEhUTUwgaXMgbm90IGFsbG93ZWQuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcmF3XHJcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGRvX25sMmJyXHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZXNjYXBlX3RleHQoIHJhdywgZG9fbmwyYnIgKSB7XHJcblx0XHRcdHZhciBlc2MgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY2FwZV9odG1sKCBTdHJpbmcoIHJhdyB8fCAnJyApICk7XHJcblx0XHRcdGlmICggZG9fbmwyYnIgJiYgISAvPGJyXFxzKlxcLz8+L2kudGVzdCggZXNjICkgKSB7XHJcblx0XHRcdFx0ZXNjID0gZXNjLnJlcGxhY2UoL1xcbi9nLCAnPGJyPicpO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBlc2M7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBNYWluIHJlbmRlciBlbnRyeSAoY2FsbGVkIGJ5IEJ1aWxkZXIpLlxyXG5cdFx0ICogQWRkcyB0aGUgYmFzZSBjbGFzcyBcIndwYmNfc3RhdGljX3RleHRcIiB0byB0aGUgdGV4dCBlbGVtZW50IGZvciBzdHlsaW5nIHBhcml0eSB3aXRoIGV4cG9ydC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbFxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGRhdGFcclxuXHRcdCAqIEBwYXJhbSB7e2J1aWxkZXI/OmFueX19IGN0eFxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyByZW5kZXIoIGVsLCBkYXRhLCBjdHggKSB7XHJcblx0XHRcdGlmICggISBlbCApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHR2YXIgc2FuaXQgICAgICAgICAgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplIHx8IHt9O1xyXG5cdFx0XHR2YXIgZXNjX2h0bWwgICAgICAgPSBzYW5pdC5lc2NhcGVfaHRtbCB8fCAodiA9PiBTdHJpbmcodikucmVwbGFjZSgvWzw+JlwiXS9nLCAnJykpO1xyXG5cdFx0XHR2YXIgc2FuaXRpemVfaWQgICAgPSBzYW5pdC5zYW5pdGl6ZV9odG1sX2lkIHx8ICh2ID0+IFN0cmluZyh2KS50cmltKCkpO1xyXG5cdFx0XHR2YXIgc2FuaXRpemVfbmFtZSAgPSBzYW5pdC5zYW5pdGl6ZV9odG1sX25hbWUgfHwgKHYgPT4gU3RyaW5nKHYpLnRyaW0oKSk7XHJcblx0XHRcdHZhciBzYW5pdGl6ZV9jbHMgICA9IHNhbml0LnNhbml0aXplX2Nzc19jbGFzc2xpc3QgfHwgKHYgPT4gU3RyaW5nKHYpLnRyaW0oKSk7XHJcblxyXG5cdFx0XHR2YXIgZF9ub3JtICAgICAgICAgPSBPYmplY3QuYXNzaWduKCB7fSwgdGhpcy5nZXRfZGVmYXVsdHMoKSwgZGF0YSB8fCB7fSApO1xyXG5cdFx0XHR2YXIgdGFnICAgICAgICAgICAgPSB0aGlzLmFsbG93X3RhZyggZF9ub3JtLnRhZyApO1xyXG5cdFx0XHR2YXIgYWxpZ24gICAgICAgICAgPSB0aGlzLmFsbG93X2FsaWduKCBkX25vcm0uYWxpZ24gKTtcclxuXHJcblx0XHRcdHZhciBodG1sX2lkICAgICAgICA9IGRfbm9ybS5odG1sX2lkID8gc2FuaXRpemVfaWQoIFN0cmluZyggZF9ub3JtLmh0bWxfaWQgKSApIDogJyc7XHJcblx0XHRcdHZhciBuYW1lX3ZhbCAgICAgICA9IGRfbm9ybS5uYW1lICAgID8gc2FuaXRpemVfbmFtZSggU3RyaW5nKCBkX25vcm0ubmFtZSApICkgIDogJyc7XHJcblx0XHRcdHZhciBjbHNfZXh0cmFfcmF3ICA9IFN0cmluZyggZF9ub3JtLmNzc2NsYXNzX2V4dHJhIHx8ICcnICk7XHJcblx0XHRcdHZhciBjbHNfZXh0cmEgICAgICA9IHNhbml0aXplX2NscyggY2xzX2V4dHJhX3JhdyApO1xyXG5cclxuXHRcdFx0Ly8gUGVyc2lzdCBzYW5pdGl6ZWQgZGF0YXNldCAoaGVscHMgSW5zcGVjdG9yICYgc25hcHNob3RzKVxyXG5cdFx0XHRpZiAoIGVsLmRhdGFzZXQuaHRtbF9pZCAhPT0gaHRtbF9pZCApIHsgZWwuZGF0YXNldC5odG1sX2lkID0gaHRtbF9pZDsgfVxyXG5cdFx0XHRpZiAoIGVsLmRhdGFzZXQubmFtZSAgICAhPT0gbmFtZV92YWwgKSB7IGVsLmRhdGFzZXQubmFtZSA9IG5hbWVfdmFsOyB9XHJcblx0XHRcdGlmICggZWwuZGF0YXNldC5jc3NjbGFzc19leHRyYSAhPT0gY2xzX2V4dHJhICkgeyBlbC5kYXRhc2V0LmNzc2NsYXNzX2V4dHJhID0gY2xzX2V4dHJhOyB9XHJcblx0XHRcdGlmICggZWwuZGF0YXNldC50YWcgICAgICE9PSB0YWcgKSAgIHsgZWwuZGF0YXNldC50YWcgPSB0YWc7IH1cclxuXHRcdFx0aWYgKCBlbC5kYXRhc2V0LmFsaWduICAgIT09IGFsaWduICkgeyBlbC5kYXRhc2V0LmFsaWduID0gYWxpZ247IH1cclxuXHJcblx0XHRcdHZhciBpZF9hdHRyICAgICAgPSBodG1sX2lkID8gJyBpZD1cIicgKyBlc2NfaHRtbCggaHRtbF9pZCApICsgJ1wiJyA6ICcnO1xyXG5cdFx0XHR2YXIgbmFtZV9hdHRyICAgID0gbmFtZV92YWwgPyAnIG5hbWU9XCInICsgZXNjX2h0bWwoIG5hbWVfdmFsICkgKyAnXCInIDogJyc7XHJcblxyXG5cdFx0XHQvLyAtLS0gTkVXOiBiYXNlIGNsYXNzIG9uIHRoZSBURVhUIGVsZW1lbnQgLS0tXHJcblx0XHRcdHZhciBiYXNlX2NscyAgICAgPSAnd3BiY19zdGF0aWNfdGV4dCc7XHJcblx0XHRcdHZhciB0YWdfY2xzX2Z1bGwgPSBiYXNlX2NscyArICggY2xzX2V4dHJhID8gKCAnICcgKyBjbHNfZXh0cmEgKSA6ICcnICk7XHJcblx0XHRcdHZhciBjbHNfYXR0ciAgICAgPSAnIGNsYXNzPVwiJyArIGVzY19odG1sKCB0YWdfY2xzX2Z1bGwgKSArICdcIic7XHJcblxyXG5cdFx0XHR2YXIgc3R5bGVfYml0cyA9IFtdO1xyXG5cdFx0XHRpZiAoIGFsaWduICkgICAgICAgICAgICAgICB7IHN0eWxlX2JpdHMucHVzaCggJ3RleHQtYWxpZ246JyArIGFsaWduICk7IH1cclxuXHRcdFx0aWYgKCBkX25vcm0uYm9sZCApICAgICAgICAgeyBzdHlsZV9iaXRzLnB1c2goICdmb250LXdlaWdodDpib2xkJyApOyB9XHJcblx0XHRcdGlmICggZF9ub3JtLml0YWxpYyApICAgICAgIHsgc3R5bGVfYml0cy5wdXNoKCAnZm9udC1zdHlsZTppdGFsaWMnICk7IH1cclxuXHRcdFx0dmFyIHN0eWxlX2F0dHIgPSBzdHlsZV9iaXRzLmxlbmd0aCA/ICggJyBzdHlsZT1cIicgKyBzdHlsZV9iaXRzLmpvaW4oJzsnKSArICdcIicgKSA6ICcnO1xyXG5cclxuXHRcdFx0Ly8gQ29udGVudFxyXG5cdFx0XHR2YXIgY29udGVudCA9ICcnO1xyXG5cdFx0XHRpZiAoIGRfbm9ybS5odG1sX2FsbG93ZWQgKSB7XHJcblx0XHRcdFx0Y29udGVudCA9IFN0cmluZyggZF9ub3JtLnRleHQgfHwgJycgKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRjb250ZW50ID0gdGhpcy5lc2NhcGVfdGV4dCggZF9ub3JtLnRleHQsICEhIGRfbm9ybS5ubDJiciApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgaGVscF9odG1sID0gZF9ub3JtLmhlbHAgPyAnPGRpdiBjbGFzcz1cIndwYmNfYmZiX19oZWxwXCI+JyArIGVzY19odG1sKCBTdHJpbmcoIGRfbm9ybS5oZWxwICkgKSArICc8L2Rpdj4nIDogJyc7XHJcblxyXG5cdFx0XHRlbC5pbm5lckhUTUwgPVxyXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIndwYmNfYmZiX19uby1kcmFnLXpvbmVcIiBpbmVydD1cIlwiPicgK1xyXG5cdFx0XHRcdFx0JzwnICsgdGFnICsgaWRfYXR0ciArIG5hbWVfYXR0ciArIGNsc19hdHRyICsgc3R5bGVfYXR0ciArICc+JyArIGNvbnRlbnQgKyAnPC8nICsgdGFnICsgJz4nICtcclxuXHRcdFx0XHRcdGhlbHBfaHRtbCArXHJcblx0XHRcdFx0Jzwvc3Bhbj4nO1xyXG5cclxuXHRcdFx0Q29yZS5VST8uV1BCQ19CRkJfT3ZlcmxheT8uZW5zdXJlPy4oIGN0eD8uYnVpbGRlciwgZWwgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE9wdGlvbmFsIGhvb2sgYWZ0ZXIgZHJvcCAoa2VlcCBiYXNlIGJlaGF2aW9yKS5cclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbFxyXG5cdFx0ICogQHBhcmFtIHt7cGFsZXR0ZV9pdGVtPzpIVE1MRWxlbWVudH19IGN0eFxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBvbl9maWVsZF9kcm9wKCBkYXRhLCBlbCwgY3R4ICkge1xyXG5cdFx0XHR0cnkgeyBzdXBlci5vbl9maWVsZF9kcm9wPy4oIGRhdGEsIGVsLCBjdHggKTsgfSBjYXRjaCAoZSkge31cclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8vIFJlZ2lzdGVyIHJlbmRlcmVyXHJcblx0dHJ5IHtcclxuXHRcdHJlZ2lzdHJ5LnJlZ2lzdGVyKCAnc3RhdGljX3RleHQnLCB3cGJjX2JmYl9maWVsZF9zdGF0aWNfdGV4dCApO1xyXG5cdH0gY2F0Y2ggKGUpIHtcclxuXHRcdF93cGJjPy5kZXY/LmVycm9yPy4oICd3cGJjX2JmYl9maWVsZF9zdGF0aWNfdGV4dC5yZWdpc3RlcicsIGUgKTtcclxuXHR9XHJcblxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEV4cG9ydCBmb3IgXCJCb29raW5nIEZvcm1cIiAoQWR2YW5jZWQgRm9ybSBzaG9ydGNvZGUpXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvKipcclxuXHQgKiBSZWdpc3RlciBCb29raW5nIEZvcm0gZXhwb3J0ZXIgY2FsbGJhY2sgKEFkdmFuY2VkIEZvcm0pIGZvciBcInN0YXRpY190ZXh0XCIuXHJcblx0ICpcclxuXHQgKiBUaGlzIGV4cG9ydGVyOlxyXG5cdCAqICAtIEVtaXRzIHBsYWluIEhUTUwgdXNpbmcgdGhlIHNhbWUgdGFnL2FsaWduL2JvbGQvaXRhbGljIHJ1bGVzIGFzIHRoZSBCdWlsZGVyIHByZXZpZXcuXHJcblx0ICogIC0gQWRkcyB0aGUgYmFzZSBjbGFzcyBcIndwYmNfc3RhdGljX3RleHRcIiBwbHVzIGFueSBleHRyYSBDU1MgY2xhc3Nlcy5cclxuXHQgKiAgLSBSZXNwZWN0czpcclxuXHQgKiAgICAgIOKAoiBodG1sX2FsbG93ZWQgPSAxIOKGkiBwYXNzLXRocm91Z2ggSFRNTCAobm8gZXNjYXBpbmcpLlxyXG5cdCAqICAgICAg4oCiIGh0bWxfYWxsb3dlZCA9IDAg4oaSIGVzY2FwZSArIG9wdGlvbmFsIG5sMmJyICh2aWEgd3BiY19iZmJfZmllbGRfc3RhdGljX3RleHQuZXNjYXBlX3RleHQoKSkuXHJcblx0ICogICAgICDigKIgaHRtbF9pZCAvIG5hbWUgICDihpIgcmVuZGVyZWQgYXMgaWQ9XCLigKZcIiAvIG5hbWU9XCLigKZcIi5cclxuXHQgKiAgLSBIZWxwIHRleHQgaXMgYXBwZW5kZWQgY2VudHJhbGx5IGJ5IFdQQkNfQkZCX0V4cG9ydGVyLnJlbmRlcl9maWVsZF9ub2RlKCksIHNhbWUgYXMgb3RoZXIgcGFja3MuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gcmVnaXN0ZXJfc3RhdGljX3RleHRfYm9va2luZ19mb3JtX2V4cG9ydGVyKCkge1xyXG5cclxuXHRcdHZhciBFeHAgPSB3LldQQkNfQkZCX0V4cG9ydGVyO1xyXG5cdFx0aWYgKCAhIEV4cCB8fCB0eXBlb2YgRXhwLnJlZ2lzdGVyICE9PSAnZnVuY3Rpb24nICkgeyByZXR1cm47IH1cclxuXHRcdGlmICggdHlwZW9mIEV4cC5oYXNfZXhwb3J0ZXIgPT09ICdmdW5jdGlvbicgJiYgRXhwLmhhc19leHBvcnRlciggJ3N0YXRpY190ZXh0JyApICkgeyByZXR1cm47IH1cclxuXHJcblx0XHR2YXIgUyAgICAgICAgICA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemUgfHwge307XHJcblx0XHR2YXIgZXNjX2h0bWwgICA9IFMuZXNjYXBlX2h0bWwgICAgICAgICAgIHx8IGZ1bmN0aW9uKCB2ICl7IHJldHVybiBTdHJpbmcoIHYgKTsgfTtcclxuXHRcdHZhciBzYW5pdGl6ZUlkID0gUy5zYW5pdGl6ZV9odG1sX2lkICAgICAgfHwgZnVuY3Rpb24oIHYgKXsgcmV0dXJuIFN0cmluZyggdiApLnRyaW0oKTsgfTtcclxuXHRcdHZhciBzYW5pdGl6ZU5tID0gUy5zYW5pdGl6ZV9odG1sX25hbWUgICAgfHwgZnVuY3Rpb24oIHYgKXsgcmV0dXJuIFN0cmluZyggdiApLnRyaW0oKTsgfTtcclxuXHRcdHZhciBzYW5pdGl6ZUNsID0gUy5zYW5pdGl6ZV9jc3NfY2xhc3NsaXN0fHwgZnVuY3Rpb24oIHYgKXsgcmV0dXJuIFN0cmluZyggdiApLnRyaW0oKTsgfTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEB0eXBlIHtXUEJDX0JGQl9FeHBvcnRlckNhbGxiYWNrfVxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9ICBmaWVsZFxyXG5cdFx0ICogQHBhcmFtIHtmdW5jdGlvbihzdHJpbmcpOnZvaWR9IGVtaXRcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgW2V4dHJhc11cclxuXHRcdCAqL1xyXG5cdFx0dmFyIGV4cG9ydGVyX2NhbGxiYWNrID0gZnVuY3Rpb24oIGZpZWxkLCBlbWl0LCBleHRyYXMgKSB7XHJcblx0XHRcdGV4dHJhcyA9IGV4dHJhcyB8fCB7fTtcclxuXHJcblx0XHRcdC8vIE1lcmdlIHdpdGggZGVmYXVsdHMgc28gYWxsIHByb3BzIGFyZSBwcmVzZW50IChtaXJyb3JzIHByZXZpZXcpLlxyXG5cdFx0XHR2YXIgZGVmcyA9IHdwYmNfYmZiX2ZpZWxkX3N0YXRpY190ZXh0LmdldF9kZWZhdWx0cygpO1xyXG5cdFx0XHR2YXIgZCAgICA9IE9iamVjdC5hc3NpZ24oIHt9LCBkZWZzLCBmaWVsZCB8fCB7fSApO1xyXG5cclxuXHRcdFx0dmFyIHRhZyAgID0gd3BiY19iZmJfZmllbGRfc3RhdGljX3RleHQuYWxsb3dfdGFnKCBkLnRhZyApO1xyXG5cdFx0XHR2YXIgYWxpZ24gPSB3cGJjX2JmYl9maWVsZF9zdGF0aWNfdGV4dC5hbGxvd19hbGlnbiggZC5hbGlnbiApO1xyXG5cclxuXHRcdFx0dmFyIGh0bWxfaWQgICA9IGQuaHRtbF9pZCA/IHNhbml0aXplSWQoIFN0cmluZyggZC5odG1sX2lkICkgKSA6ICcnO1xyXG5cdFx0XHR2YXIgbmFtZV92YWwgID0gZC5uYW1lICAgID8gc2FuaXRpemVObSggU3RyaW5nKCBkLm5hbWUgKSApICAgIDogJyc7XHJcblxyXG5cdFx0XHQvLyBFeHRyYSBDU1MgY2xhc3NlcyBmcm9tIEluc3BlY3RvciAvIHNjaGVtYS5cclxuXHRcdFx0dmFyIGNsc19leHRyYV9yYXcgPSBTdHJpbmcoIGQuY3NzY2xhc3NfZXh0cmEgfHwgZC5jc3NjbGFzcyB8fCBkLmNsYXNzIHx8ICcnICk7XHJcblx0XHRcdHZhciBjbHNfZXh0cmEgICAgID0gc2FuaXRpemVDbCggY2xzX2V4dHJhX3JhdyApO1xyXG5cclxuXHRcdFx0Ly8gQmFzZSBjbGFzcyBmb3Igc3R5bGluZyBwYXJpdHkgYmV0d2VlbiBCdWlsZGVyIHByZXZpZXcgYW5kIGV4cG9ydGVkIGZvcm0uXHJcblx0XHRcdHZhciBiYXNlX2NscyAgPSAnd3BiY19zdGF0aWNfdGV4dCc7XHJcblx0XHRcdHZhciBjbHNfZnVsbCAgPSBiYXNlX2NscyArICggY2xzX2V4dHJhID8gKCAnICcgKyBjbHNfZXh0cmEgKSA6ICcnICk7XHJcblxyXG5cdFx0XHR2YXIgaWRfYXR0ciAgID0gaHRtbF9pZCAgPyAnIGlkPVwiJyAgICsgZXNjX2h0bWwoIGh0bWxfaWQgKSAgKyAnXCInIDogJyc7XHJcblx0XHRcdHZhciBuYW1lX2F0dHIgPSBuYW1lX3ZhbCA/ICcgbmFtZT1cIicgKyBlc2NfaHRtbCggbmFtZV92YWwgKSArICdcIicgOiAnJztcclxuXHRcdFx0dmFyIGNsc19hdHRyICA9ICcgY2xhc3M9XCInICsgZXNjX2h0bWwoIGNsc19mdWxsICkgKyAnXCInO1xyXG5cclxuXHRcdFx0Ly8gSW5saW5lIHN0eWxlczogdGV4dC1hbGlnbiArIGJvbGQvaXRhbGljIGZsYWdzLlxyXG5cdFx0XHR2YXIgc3R5bGVfYml0cyA9IFtdO1xyXG5cdFx0XHRpZiAoIGFsaWduICkgICAgICAgeyBzdHlsZV9iaXRzLnB1c2goICd0ZXh0LWFsaWduOicgKyBhbGlnbiApOyB9XHJcblx0XHRcdGlmICggZC5ib2xkICkgICAgICB7IHN0eWxlX2JpdHMucHVzaCggJ2ZvbnQtd2VpZ2h0OmJvbGQnICk7IH1cclxuXHRcdFx0aWYgKCBkLml0YWxpYyApICAgIHsgc3R5bGVfYml0cy5wdXNoKCAnZm9udC1zdHlsZTppdGFsaWMnICk7IH1cclxuXHRcdFx0dmFyIHN0eWxlX2F0dHIgPSBzdHlsZV9iaXRzLmxlbmd0aFxyXG5cdFx0XHRcdD8gJyBzdHlsZT1cIicgKyBlc2NfaHRtbCggc3R5bGVfYml0cy5qb2luKCAnOycgKSApICsgJ1wiJ1xyXG5cdFx0XHRcdDogJyc7XHJcblxyXG5cdFx0XHQvLyBDb250ZW50OiBlc2NhcGUgKyBubDJiciB3aGVuIEhUTUwgaXMgTk9UIGFsbG93ZWQ7IHJhdyB3aGVuIGFsbG93ZWQuXHJcblx0XHRcdHZhciBjb250ZW50O1xyXG5cdFx0XHRpZiAoIGQuaHRtbF9hbGxvd2VkICkge1xyXG5cdFx0XHRcdGNvbnRlbnQgPSBTdHJpbmcoIGQudGV4dCB8fCAnJyApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGNvbnRlbnQgPSB3cGJjX2JmYl9maWVsZF9zdGF0aWNfdGV4dC5lc2NhcGVfdGV4dCggZC50ZXh0LCAhISBkLm5sMmJyICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGVtaXQoXHJcblx0XHRcdFx0JzwnICsgdGFnICsgaWRfYXR0ciArIG5hbWVfYXR0ciArIGNsc19hdHRyICsgc3R5bGVfYXR0ciArICc+JyArXHJcblx0XHRcdFx0XHRjb250ZW50ICtcclxuXHRcdFx0XHQnPC8nICsgdGFnICsgJz4nXHJcblx0XHRcdCk7XHJcblx0XHRcdC8vIE5PVEU6XHJcblx0XHRcdC8vICAtIEhlbHAgdGV4dCAoZmllbGQuaGVscCkgaXMgb3V0cHV0IGJ5IFdQQkNfQkZCX0V4cG9ydGVyLnJlbmRlcl9maWVsZF9ub2RlKClcclxuXHRcdFx0Ly8gICAgYmVuZWF0aCB0aGlzIGJsb2NrLCBrZWVwaW5nIGJlaGF2aW9yIGNvbnNpc3RlbnQgd2l0aCBvdGhlciBmaWVsZCBwYWNrcy5cclxuXHRcdH07XHJcblxyXG5cdFx0RXhwLnJlZ2lzdGVyKCAnc3RhdGljX3RleHQnLCBleHBvcnRlcl9jYWxsYmFjayApO1xyXG5cdH1cclxuXHJcblx0Ly8gVHJ5IGltbWVkaWF0ZSByZWdpc3RyYXRpb247IGlmIGNvcmUgaXNu4oCZdCByZWFkeSB5ZXQsIHdhaXQgZm9yIHRoZSBldmVudC5cclxuXHRpZiAoIHcuV1BCQ19CRkJfRXhwb3J0ZXIgJiYgdHlwZW9mIHcuV1BCQ19CRkJfRXhwb3J0ZXIucmVnaXN0ZXIgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRyZWdpc3Rlcl9zdGF0aWNfdGV4dF9ib29raW5nX2Zvcm1fZXhwb3J0ZXIoKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0ZC5hZGRFdmVudExpc3RlbmVyKFxyXG5cdFx0XHQnd3BiYzpiZmI6ZXhwb3J0ZXItcmVhZHknLFxyXG5cdFx0XHRyZWdpc3Rlcl9zdGF0aWNfdGV4dF9ib29raW5nX2Zvcm1fZXhwb3J0ZXIsXHJcblx0XHRcdHsgb25jZTogdHJ1ZSB9XHJcblx0XHQpO1xyXG5cdH1cclxuXHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRXhwb3J0IGZvciBcIkJvb2tpbmcgRGF0YVwiIChDb250ZW50IG9mIGJvb2tpbmcgZmllbGRzIGRhdGEpXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvKipcclxuXHQgKiBSZWdpc3RlciBCb29raW5nIERhdGEgZXhwb3J0ZXIgY2FsbGJhY2sgKFwiQ29udGVudCBvZiBib29raW5nIGZpZWxkcyBkYXRhXCIpIGZvciBcInN0YXRpY190ZXh0XCIuXHJcblx0ICpcclxuXHQgKiBTdGF0aWMgVGV4dCBpcyBwdXJlbHkgcHJlc2VudGF0aW9uYWwgYW5kIGRvZXMgbm90IGNhcnJ5IHVzZXItZW50ZXJlZCB2YWx1ZXMsXHJcblx0ICogc28gaXQgaXMgaW50ZW50aW9uYWxseSBvbWl0dGVkIGZyb20gdGhlIFwiQ29udGVudCBvZiBib29raW5nIGZpZWxkcyBkYXRhXCIgb3V0cHV0LlxyXG5cdCAqIFRoaXMgZXhwb3J0ZXIgdGhlcmVmb3JlIGRvZXMgbm90aGluZyAoZW1pdHMgbm8gbGluZSkuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gcmVnaXN0ZXJfc3RhdGljX3RleHRfYm9va2luZ19kYXRhX2V4cG9ydGVyKCkge1xyXG5cclxuXHRcdHZhciBDID0gdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXI7XHJcblx0XHRpZiAoICEgQyB8fCB0eXBlb2YgQy5yZWdpc3RlciAhPT0gJ2Z1bmN0aW9uJyApIHsgcmV0dXJuOyB9XHJcblx0XHRpZiAoIHR5cGVvZiBDLmhhc19leHBvcnRlciA9PT0gJ2Z1bmN0aW9uJyAmJiBDLmhhc19leHBvcnRlciggJ3N0YXRpY190ZXh0JyApICkgeyByZXR1cm47IH1cclxuXHJcblx0XHR2YXIgZXhwb3J0ZXJfY2FsbGJhY2sgPSBmdW5jdGlvbiggZmllbGQsIGVtaXQsIGV4dHJhcyApIHtcclxuXHRcdFx0Ly8gSW50ZW50aW9uYWxseSBlbXB0eTogc3RhdGljX3RleHQgaGFzIG5vIGR5bmFtaWMgdG9rZW4vdmFsdWUgdG8gc2hvdyBpbiBib29raW5nIGRhdGEuXHJcblx0XHRcdHJldHVybjtcclxuXHRcdH07XHJcblxyXG5cdFx0Qy5yZWdpc3RlciggJ3N0YXRpY190ZXh0JywgZXhwb3J0ZXJfY2FsbGJhY2sgKTtcclxuXHR9XHJcblxyXG5cdGlmICggdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIgJiYgdHlwZW9mIHcuV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyLnJlZ2lzdGVyID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0cmVnaXN0ZXJfc3RhdGljX3RleHRfYm9va2luZ19kYXRhX2V4cG9ydGVyKCk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGQuYWRkRXZlbnRMaXN0ZW5lcihcclxuXHRcdFx0J3dwYmM6YmZiOmNvbnRlbnQtZXhwb3J0ZXItcmVhZHknLFxyXG5cdFx0XHRyZWdpc3Rlcl9zdGF0aWNfdGV4dF9ib29raW5nX2RhdGFfZXhwb3J0ZXIsXHJcblx0XHRcdHsgb25jZTogdHJ1ZSB9XHJcblx0XHQpO1xyXG5cdH1cclxuXHJcbn0pKCB3aW5kb3csIGRvY3VtZW50ICk7XHJcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDLFVBQVVBLENBQUMsRUFBRUMsQ0FBQyxFQUFFO0VBQ2hCLFlBQVk7O0VBRVosSUFBSUMsSUFBSSxHQUFRRixDQUFDLENBQUNHLGFBQWEsSUFBSSxDQUFDLENBQUM7RUFDckMsSUFBSUMsUUFBUSxHQUFJRixJQUFJLENBQUNHLGdDQUFnQztFQUNyRCxJQUFJQyxJQUFJLEdBQVFKLElBQUksQ0FBQ0ssbUJBQW1CO0VBRXhDLElBQUssQ0FBRUgsUUFBUSxJQUFJLE9BQU9BLFFBQVEsQ0FBQ0ksUUFBUSxLQUFLLFVBQVUsSUFBSSxDQUFFRixJQUFJLEVBQUc7SUFDdEVHLEtBQUssRUFBRUMsR0FBRyxFQUFFQyxLQUFL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
