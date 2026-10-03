"use strict";

// =================================================================================================
// == Pack: Static Text (WP-template-less; schema-driven)
// == File: /includes/page-form-builder/field-packs/static-text/_out/static-text.js
// == Depends: WPBC_BFB_Field_Base, Field_Renderer_Registry, Core.Sanitize, Exporter API
// == Version: 1.1.0  (25.09.2026)  — add sanitized link tokens to preview & export
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
     * @returns {{type:string,text:string,links:Array,tag:string,align:string,bold:number,italic:number,html_allowed:number,nl2br:number,cssclass_extra:string,name:string,html_id:string,help:string,usage_key:string}}
     */
    static get_defaults() {
      return {
        type: 'static_text',
        text: 'Add your message here…',
        links: [],
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
      if (w.WPBC_BFB_Static_Text_Links && 'function' === typeof w.WPBC_BFB_Static_Text_Links.build_content_html) {
        content = w.WPBC_BFB_Static_Text_Links.build_content_html(d_norm.text, d_norm.links, {
          allow_html: !!d_norm.html_allowed,
          nl2br: !!d_norm.nl2br,
          preview_only: true
        });
      } else if (d_norm.html_allowed) {
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
      if (w.WPBC_BFB_Static_Text_Links && 'function' === typeof w.WPBC_BFB_Static_Text_Links.build_content_html) {
        content = w.WPBC_BFB_Static_Text_Links.build_content_html(d.text, d.links, {
          allow_html: !!d.html_allowed,
          nl2br: !!d.nl2br,
          preview_only: false
        });
      } else if (d.html_allowed) {
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3Mvc3RhdGljLXRleHQvX291dC9zdGF0aWMtdGV4dC5qcyIsIm5hbWVzIjpbInciLCJkIiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJyZWdpc3RyeSIsIldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5IiwiQmFzZSIsIldQQkNfQkZCX0ZpZWxkX0Jhc2UiLCJyZWdpc3RlciIsIl93cGJjIiwiZGV2IiwiZXJyb3IiLCJ3cGJjX2JmYl9maWVsZF9zdGF0aWNfdGV4dCIsImdldF9kZWZhdWx0cyIsInR5cGUiLCJ0ZXh0IiwibGlua3MiLCJ0YWciLCJhbGlnbiIsImJvbGQiLCJpdGFsaWMiLCJodG1sX2FsbG93ZWQiLCJubDJiciIsImNzc2NsYXNzX2V4dHJhIiwibmFtZSIsImh0bWxfaWQiLCJoZWxwIiwidXNhZ2Vfa2V5IiwiYWxsb3dfdGFnIiwidiIsInQiLCJTdHJpbmciLCJ0b0xvd2VyQ2FzZSIsIm9rIiwicCIsImxhYmVsIiwic3BhbiIsInNtYWxsIiwiZGl2IiwiaDEiLCJoMiIsImgzIiwiaDQiLCJoNSIsImg2IiwiYWxsb3dfYWxpZ24iLCJhIiwibGVmdCIsImNlbnRlciIsInJpZ2h0IiwiZXNjYXBlX3RleHQiLCJyYXciLCJkb19ubDJiciIsImVzYyIsIldQQkNfQkZCX1Nhbml0aXplIiwiZXNjYXBlX2h0bWwiLCJ0ZXN0IiwicmVwbGFjZSIsInJlbmRlciIsImVsIiwiZGF0YSIsImN0eCIsInNhbml0IiwiZXNjX2h0bWwiLCJzYW5pdGl6ZV9pZCIsInNhbml0aXplX2h0bWxfaWQiLCJ0cmltIiwic2FuaXRpemVfbmFtZSIsInNhbml0aXplX2h0bWxfbmFtZSIsInNhbml0aXplX2NscyIsInNhbml0aXplX2Nzc19jbGFzc2xpc3QiLCJkX25vcm0iLCJPYmplY3QiLCJhc3NpZ24iLCJuYW1lX3ZhbCIsImNsc19leHRyYV9yYXciLCJjbHNfZXh0cmEiLCJkYXRhc2V0IiwiaWRfYXR0ciIsIm5hbWVfYXR0ciIsImJhc2VfY2xzIiwidGFnX2Nsc19mdWxsIiwiY2xzX2F0dHIiLCJzdHlsZV9iaXRzIiwicHVzaCIsInN0eWxlX2F0dHIiLCJsZW5ndGgiLCJqb2luIiwiY29udGVudCIsIldQQkNfQkZCX1N0YXRpY19UZXh0X0xpbmtzIiwiYnVpbGRfY29udGVudF9odG1sIiwiYWxsb3dfaHRtbCIsInByZXZpZXdfb25seSIsImhlbHBfaHRtbCIsImlubmVySFRNTCIsIlVJIiwiV1BCQ19CRkJfT3ZlcmxheSIsImVuc3VyZSIsImJ1aWxkZXIiLCJvbl9maWVsZF9kcm9wIiwiZSIsInJlZ2lzdGVyX3N0YXRpY190ZXh0X2Jvb2tpbmdfZm9ybV9leHBvcnRlciIsIkV4cCIsIldQQkNfQkZCX0V4cG9ydGVyIiwiaGFzX2V4cG9ydGVyIiwiUyIsInNhbml0aXplSWQiLCJzYW5pdGl6ZU5tIiwic2FuaXRpemVDbCIsImV4cG9ydGVyX2NhbGxiYWNrIiwiZmllbGQiLCJlbWl0IiwiZXh0cmFzIiwiZGVmcyIsImNzc2NsYXNzIiwiY2xhc3MiLCJjbHNfZnVsbCIsImFkZEV2ZW50TGlzdGVuZXIiLCJvbmNlIiwicmVnaXN0ZXJfc3RhdGljX3RleHRfYm9va2luZ19kYXRhX2V4cG9ydGVyIiwiQyIsIldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciIsIndpbmRvdyIsImRvY3VtZW50Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3Mvc3RhdGljLXRleHQvX3NyYy9zdGF0aWMtdGV4dC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vID09IFBhY2s6IFN0YXRpYyBUZXh0IChXUC10ZW1wbGF0ZS1sZXNzOyBzY2hlbWEtZHJpdmVuKVxyXG4vLyA9PSBGaWxlOiAvaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3Mvc3RhdGljLXRleHQvX291dC9zdGF0aWMtdGV4dC5qc1xyXG4vLyA9PSBEZXBlbmRzOiBXUEJDX0JGQl9GaWVsZF9CYXNlLCBGaWVsZF9SZW5kZXJlcl9SZWdpc3RyeSwgQ29yZS5TYW5pdGl6ZSwgRXhwb3J0ZXIgQVBJXHJcbi8vID09IFZlcnNpb246IDEuMS4wICAoMjUuMDkuMjAyNikgIOKAlCBhZGQgc2FuaXRpemVkIGxpbmsgdG9rZW5zIHRvIHByZXZpZXcgJiBleHBvcnRcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuKGZ1bmN0aW9uICh3LCBkKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHR2YXIgQ29yZSAgICAgID0gdy5XUEJDX0JGQl9Db3JlIHx8IHt9O1xyXG5cdHZhciByZWdpc3RyeSAgPSBDb3JlLldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5O1xyXG5cdHZhciBCYXNlICAgICAgPSBDb3JlLldQQkNfQkZCX0ZpZWxkX0Jhc2U7XHJcblxyXG5cdGlmICggISByZWdpc3RyeSB8fCB0eXBlb2YgcmVnaXN0cnkucmVnaXN0ZXIgIT09ICdmdW5jdGlvbicgfHwgISBCYXNlICkge1xyXG5cdFx0X3dwYmM/LmRldj8uZXJyb3I/LiggJ3dwYmNfYmZiX2ZpZWxkX3N0YXRpY190ZXh0JywgJ0NvcmUgcmVnaXN0cnkvYmFzZSBtaXNzaW5nJyApO1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogRmllbGQgUmVuZGVyZXI6IHN0YXRpY190ZXh0XHJcblx0ICogLSBSZW5kZXJzIGEgc2luZ2xlIHRleHQgZWxlbWVudCB3aXRoIGNvbmZpZ3VyYWJsZSB0YWcsIGFsaWduLCBib2xkLCBpdGFsaWMuXHJcblx0ICogLSBTdXBwb3J0cyBwYXNzLXRocm91Z2ggSFRNTCAocHJldmlldyBvbmx5KSBpZiBodG1sX2FsbG93ZWQ9MTsgb3RoZXJ3aXNlIGVzY2FwZXMgKyBvcHRpb25hbCBubDJici5cclxuXHQgKlxyXG5cdCAqIEBjbGFzcyB3cGJjX2JmYl9maWVsZF9zdGF0aWNfdGV4dFxyXG5cdCAqIEBleHRlbmRzIENvcmUuV1BCQ19CRkJfRmllbGRfQmFzZVxyXG5cdCAqL1xyXG5cdGNsYXNzIHdwYmNfYmZiX2ZpZWxkX3N0YXRpY190ZXh0IGV4dGVuZHMgQmFzZSB7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEZWZhdWx0cyAobXVzdCBtaXJyb3IgUEhQIHNjaGVtYSkuXHJcblx0XHQgKiBAcmV0dXJucyB7e3R5cGU6c3RyaW5nLHRleHQ6c3RyaW5nLGxpbmtzOkFycmF5LHRhZzpzdHJpbmcsYWxpZ246c3RyaW5nLGJvbGQ6bnVtYmVyLGl0YWxpYzpudW1iZXIsaHRtbF9hbGxvd2VkOm51bWJlcixubDJicjpudW1iZXIsY3NzY2xhc3NfZXh0cmE6c3RyaW5nLG5hbWU6c3RyaW5nLGh0bWxfaWQ6c3RyaW5nLGhlbHA6c3RyaW5nLHVzYWdlX2tleTpzdHJpbmd9fVxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGdldF9kZWZhdWx0cygpIHtcclxuXHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHR0eXBlICAgICAgICAgICAgOiAnc3RhdGljX3RleHQnLFxyXG5cdFx0XHRcdHRleHQgICAgICAgICAgICA6ICdBZGQgeW91ciBtZXNzYWdlIGhlcmXigKYnLFxuXHRcdFx0XHRsaW5rcyAgICAgICAgICAgOiBbXSxcblx0XHRcdFx0dGFnICAgICAgICAgICAgIDogJ3AnLFxyXG5cdFx0XHRcdGFsaWduICAgICAgICAgICA6ICdsZWZ0JyxcclxuXHRcdFx0XHRib2xkICAgICAgICAgICAgOiAwLFxyXG5cdFx0XHRcdGl0YWxpYyAgICAgICAgICA6IDAsXHJcblx0XHRcdFx0aHRtbF9hbGxvd2VkICAgIDogMCxcclxuXHRcdFx0XHRubDJiciAgICAgICAgICAgOiAxLFxyXG5cdFx0XHRcdGNzc2NsYXNzX2V4dHJhICA6ICcnLFxyXG5cdFx0XHRcdG5hbWUgICAgICAgICAgICA6ICcnLFxyXG5cdFx0XHRcdGh0bWxfaWQgICAgICAgICA6ICcnLFxyXG5cdFx0XHRcdGhlbHAgICAgICAgICAgICA6ICcnLFxyXG5cdFx0XHRcdHVzYWdlX2tleSAgICAgICA6ICdzdGF0aWNfdGV4dCdcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFdoaXRlbGlzdCB0YWcuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdlxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGFsbG93X3RhZyggdiApIHtcclxuXHRcdFx0dmFyIHQgPSBTdHJpbmcoIHYgfHwgJ3AnICkudG9Mb3dlckNhc2UoKTtcclxuXHRcdFx0dmFyIG9rID0geyBwOjEsbGFiZWw6MSxzcGFuOjEsc21hbGw6MSxkaXY6MSxoMToxLGgyOjEsaDM6MSxoNDoxLGg1OjEsaDY6MSB9O1xyXG5cdFx0XHRyZXR1cm4gb2tbdF0gPyB0IDogJ3AnO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogV2hpdGVsaXN0IGFsaWduLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHZcclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBhbGxvd19hbGlnbiggdiApIHtcclxuXHRcdFx0dmFyIGEgPSBTdHJpbmcoIHYgfHwgJ2xlZnQnICkudG9Mb3dlckNhc2UoKTtcclxuXHRcdFx0dmFyIG9rID0geyBsZWZ0OjEsIGNlbnRlcjoxLCByaWdodDoxIH07XHJcblx0XHRcdHJldHVybiBva1thXSA/IGEgOiAnbGVmdCc7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBFc2NhcGUgKyBvcHRpb25hbCBubDJiciBmb3IgcHJldmlldy9leHBvcnQgd2hlbiBIVE1MIGlzIG5vdCBhbGxvd2VkLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHJhd1xyXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBkb19ubDJiclxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGVzY2FwZV90ZXh0KCByYXcsIGRvX25sMmJyICkge1xyXG5cdFx0XHR2YXIgZXNjID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5lc2NhcGVfaHRtbCggU3RyaW5nKCByYXcgfHwgJycgKSApO1xyXG5cdFx0XHRpZiAoIGRvX25sMmJyICYmICEgLzxiclxccypcXC8/Pi9pLnRlc3QoIGVzYyApICkge1xyXG5cdFx0XHRcdGVzYyA9IGVzYy5yZXBsYWNlKC9cXG4vZywgJzxicj4nKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gZXNjO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogTWFpbiByZW5kZXIgZW50cnkgKGNhbGxlZCBieSBCdWlsZGVyKS5cclxuXHRcdCAqIEFkZHMgdGhlIGJhc2UgY2xhc3MgXCJ3cGJjX3N0YXRpY190ZXh0XCIgdG8gdGhlIHRleHQgZWxlbWVudCBmb3Igc3R5bGluZyBwYXJpdHkgd2l0aCBleHBvcnQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhXHJcblx0XHQgKiBAcGFyYW0ge3tidWlsZGVyPzphbnl9fSBjdHhcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgcmVuZGVyKCBlbCwgZGF0YSwgY3R4ICkge1xyXG5cdFx0XHRpZiAoICEgZWwgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0dmFyIHNhbml0ICAgICAgICAgID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZSB8fCB7fTtcclxuXHRcdFx0dmFyIGVzY19odG1sICAgICAgID0gc2FuaXQuZXNjYXBlX2h0bWwgfHwgKHYgPT4gU3RyaW5nKHYpLnJlcGxhY2UoL1s8PiZcIl0vZywgJycpKTtcclxuXHRcdFx0dmFyIHNhbml0aXplX2lkICAgID0gc2FuaXQuc2FuaXRpemVfaHRtbF9pZCB8fCAodiA9PiBTdHJpbmcodikudHJpbSgpKTtcclxuXHRcdFx0dmFyIHNhbml0aXplX25hbWUgID0gc2FuaXQuc2FuaXRpemVfaHRtbF9uYW1lIHx8ICh2ID0+IFN0cmluZyh2KS50cmltKCkpO1xyXG5cdFx0XHR2YXIgc2FuaXRpemVfY2xzICAgPSBzYW5pdC5zYW5pdGl6ZV9jc3NfY2xhc3NsaXN0IHx8ICh2ID0+IFN0cmluZyh2KS50cmltKCkpO1xyXG5cclxuXHRcdFx0dmFyIGRfbm9ybSAgICAgICAgID0gT2JqZWN0LmFzc2lnbigge30sIHRoaXMuZ2V0X2RlZmF1bHRzKCksIGRhdGEgfHwge30gKTtcclxuXHRcdFx0dmFyIHRhZyAgICAgICAgICAgID0gdGhpcy5hbGxvd190YWcoIGRfbm9ybS50YWcgKTtcclxuXHRcdFx0dmFyIGFsaWduICAgICAgICAgID0gdGhpcy5hbGxvd19hbGlnbiggZF9ub3JtLmFsaWduICk7XHJcblxyXG5cdFx0XHR2YXIgaHRtbF9pZCAgICAgICAgPSBkX25vcm0uaHRtbF9pZCA/IHNhbml0aXplX2lkKCBTdHJpbmcoIGRfbm9ybS5odG1sX2lkICkgKSA6ICcnO1xyXG5cdFx0XHR2YXIgbmFtZV92YWwgICAgICAgPSBkX25vcm0ubmFtZSAgICA/IHNhbml0aXplX25hbWUoIFN0cmluZyggZF9ub3JtLm5hbWUgKSApICA6ICcnO1xyXG5cdFx0XHR2YXIgY2xzX2V4dHJhX3JhdyAgPSBTdHJpbmcoIGRfbm9ybS5jc3NjbGFzc19leHRyYSB8fCAnJyApO1xyXG5cdFx0XHR2YXIgY2xzX2V4dHJhICAgICAgPSBzYW5pdGl6ZV9jbHMoIGNsc19leHRyYV9yYXcgKTtcclxuXHJcblx0XHRcdC8vIFBlcnNpc3Qgc2FuaXRpemVkIGRhdGFzZXQgKGhlbHBzIEluc3BlY3RvciAmIHNuYXBzaG90cylcclxuXHRcdFx0aWYgKCBlbC5kYXRhc2V0Lmh0bWxfaWQgIT09IGh0bWxfaWQgKSB7IGVsLmRhdGFzZXQuaHRtbF9pZCA9IGh0bWxfaWQ7IH1cclxuXHRcdFx0aWYgKCBlbC5kYXRhc2V0Lm5hbWUgICAgIT09IG5hbWVfdmFsICkgeyBlbC5kYXRhc2V0Lm5hbWUgPSBuYW1lX3ZhbDsgfVxyXG5cdFx0XHRpZiAoIGVsLmRhdGFzZXQuY3NzY2xhc3NfZXh0cmEgIT09IGNsc19leHRyYSApIHsgZWwuZGF0YXNldC5jc3NjbGFzc19leHRyYSA9IGNsc19leHRyYTsgfVxyXG5cdFx0XHRpZiAoIGVsLmRhdGFzZXQudGFnICAgICAhPT0gdGFnICkgICB7IGVsLmRhdGFzZXQudGFnID0gdGFnOyB9XHJcblx0XHRcdGlmICggZWwuZGF0YXNldC5hbGlnbiAgICE9PSBhbGlnbiApIHsgZWwuZGF0YXNldC5hbGlnbiA9IGFsaWduOyB9XHJcblxyXG5cdFx0XHR2YXIgaWRfYXR0ciAgICAgID0gaHRtbF9pZCA/ICcgaWQ9XCInICsgZXNjX2h0bWwoIGh0bWxfaWQgKSArICdcIicgOiAnJztcclxuXHRcdFx0dmFyIG5hbWVfYXR0ciAgICA9IG5hbWVfdmFsID8gJyBuYW1lPVwiJyArIGVzY19odG1sKCBuYW1lX3ZhbCApICsgJ1wiJyA6ICcnO1xyXG5cclxuXHRcdFx0Ly8gLS0tIE5FVzogYmFzZSBjbGFzcyBvbiB0aGUgVEVYVCBlbGVtZW50IC0tLVxyXG5cdFx0XHR2YXIgYmFzZV9jbHMgICAgID0gJ3dwYmNfc3RhdGljX3RleHQnO1xyXG5cdFx0XHR2YXIgdGFnX2Nsc19mdWxsID0gYmFzZV9jbHMgKyAoIGNsc19leHRyYSA/ICggJyAnICsgY2xzX2V4dHJhICkgOiAnJyApO1xyXG5cdFx0XHR2YXIgY2xzX2F0dHIgICAgID0gJyBjbGFzcz1cIicgKyBlc2NfaHRtbCggdGFnX2Nsc19mdWxsICkgKyAnXCInO1xyXG5cclxuXHRcdFx0dmFyIHN0eWxlX2JpdHMgPSBbXTtcclxuXHRcdFx0aWYgKCBhbGlnbiApICAgICAgICAgICAgICAgeyBzdHlsZV9iaXRzLnB1c2goICd0ZXh0LWFsaWduOicgKyBhbGlnbiApOyB9XHJcblx0XHRcdGlmICggZF9ub3JtLmJvbGQgKSAgICAgICAgIHsgc3R5bGVfYml0cy5wdXNoKCAnZm9udC13ZWlnaHQ6Ym9sZCcgKTsgfVxyXG5cdFx0XHRpZiAoIGRfbm9ybS5pdGFsaWMgKSAgICAgICB7IHN0eWxlX2JpdHMucHVzaCggJ2ZvbnQtc3R5bGU6aXRhbGljJyApOyB9XHJcblx0XHRcdHZhciBzdHlsZV9hdHRyID0gc3R5bGVfYml0cy5sZW5ndGggPyAoICcgc3R5bGU9XCInICsgc3R5bGVfYml0cy5qb2luKCc7JykgKyAnXCInICkgOiAnJztcclxuXHJcblx0XHRcdC8vIENvbnRlbnRcclxuXHRcdFx0dmFyIGNvbnRlbnQgPSAnJztcclxuXHRcdFx0aWYgKCB3LldQQkNfQkZCX1N0YXRpY19UZXh0X0xpbmtzICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3LldQQkNfQkZCX1N0YXRpY19UZXh0X0xpbmtzLmJ1aWxkX2NvbnRlbnRfaHRtbCApIHtcblx0XHRcdFx0Y29udGVudCA9IHcuV1BCQ19CRkJfU3RhdGljX1RleHRfTGlua3MuYnVpbGRfY29udGVudF9odG1sKFxuXHRcdFx0XHRcdGRfbm9ybS50ZXh0LFxuXHRcdFx0XHRcdGRfbm9ybS5saW5rcyxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRhbGxvd19odG1sICA6ICEhIGRfbm9ybS5odG1sX2FsbG93ZWQsXG5cdFx0XHRcdFx0XHRubDJiciAgICAgICA6ICEhIGRfbm9ybS5ubDJicixcblx0XHRcdFx0XHRcdHByZXZpZXdfb25seTogdHJ1ZVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0KTtcblx0XHRcdH0gZWxzZSBpZiAoIGRfbm9ybS5odG1sX2FsbG93ZWQgKSB7XG5cdFx0XHRcdGNvbnRlbnQgPSBTdHJpbmcoIGRfbm9ybS50ZXh0IHx8ICcnICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb250ZW50ID0gdGhpcy5lc2NhcGVfdGV4dCggZF9ub3JtLnRleHQsICEhIGRfbm9ybS5ubDJiciApO1xuXHRcdFx0fVxuXHJcblx0XHRcdHZhciBoZWxwX2h0bWwgPSBkX25vcm0uaGVscCA/ICc8ZGl2IGNsYXNzPVwid3BiY19iZmJfX2hlbHBcIj4nICsgZXNjX2h0bWwoIFN0cmluZyggZF9ub3JtLmhlbHAgKSApICsgJzwvZGl2PicgOiAnJztcclxuXHJcblx0XHRcdGVsLmlubmVySFRNTCA9XHJcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwid3BiY19iZmJfX25vLWRyYWctem9uZVwiIGluZXJ0PVwiXCI+JyArXHJcblx0XHRcdFx0XHQnPCcgKyB0YWcgKyBpZF9hdHRyICsgbmFtZV9hdHRyICsgY2xzX2F0dHIgKyBzdHlsZV9hdHRyICsgJz4nICsgY29udGVudCArICc8LycgKyB0YWcgKyAnPicgK1xyXG5cdFx0XHRcdFx0aGVscF9odG1sICtcclxuXHRcdFx0XHQnPC9zcGFuPic7XHJcblxyXG5cdFx0XHRDb3JlLlVJPy5XUEJDX0JGQl9PdmVybGF5Py5lbnN1cmU/LiggY3R4Py5idWlsZGVyLCBlbCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogT3B0aW9uYWwgaG9vayBhZnRlciBkcm9wIChrZWVwIGJhc2UgYmVoYXZpb3IpLlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGRhdGFcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsXHJcblx0XHQgKiBAcGFyYW0ge3twYWxldHRlX2l0ZW0/OkhUTUxFbGVtZW50fX0gY3R4XHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIG9uX2ZpZWxkX2Ryb3AoIGRhdGEsIGVsLCBjdHggKSB7XHJcblx0XHRcdHRyeSB7IHN1cGVyLm9uX2ZpZWxkX2Ryb3A/LiggZGF0YSwgZWwsIGN0eCApOyB9IGNhdGNoIChlKSB7fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly8gUmVnaXN0ZXIgcmVuZGVyZXJcclxuXHR0cnkge1xyXG5cdFx0cmVnaXN0cnkucmVnaXN0ZXIoICdzdGF0aWNfdGV4dCcsIHdwYmNfYmZiX2ZpZWxkX3N0YXRpY190ZXh0ICk7XHJcblx0fSBjYXRjaCAoZSkge1xyXG5cdFx0X3dwYmM/LmRldj8uZXJyb3I/LiggJ3dwYmNfYmZiX2ZpZWxkX3N0YXRpY190ZXh0LnJlZ2lzdGVyJywgZSApO1xyXG5cdH1cclxuXHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRXhwb3J0IGZvciBcIkJvb2tpbmcgRm9ybVwiIChBZHZhbmNlZCBGb3JtIHNob3J0Y29kZSlcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8qKlxyXG5cdCAqIFJlZ2lzdGVyIEJvb2tpbmcgRm9ybSBleHBvcnRlciBjYWxsYmFjayAoQWR2YW5jZWQgRm9ybSkgZm9yIFwic3RhdGljX3RleHRcIi5cclxuXHQgKlxyXG5cdCAqIFRoaXMgZXhwb3J0ZXI6XHJcblx0ICogIC0gRW1pdHMgcGxhaW4gSFRNTCB1c2luZyB0aGUgc2FtZSB0YWcvYWxpZ24vYm9sZC9pdGFsaWMgcnVsZXMgYXMgdGhlIEJ1aWxkZXIgcHJldmlldy5cclxuXHQgKiAgLSBBZGRzIHRoZSBiYXNlIGNsYXNzIFwid3BiY19zdGF0aWNfdGV4dFwiIHBsdXMgYW55IGV4dHJhIENTUyBjbGFzc2VzLlxyXG5cdCAqICAtIFJlc3BlY3RzOlxyXG5cdCAqICAgICAg4oCiIGh0bWxfYWxsb3dlZCA9IDEg4oaSIHBhc3MtdGhyb3VnaCBIVE1MIChubyBlc2NhcGluZykuXHJcblx0ICogICAgICDigKIgaHRtbF9hbGxvd2VkID0gMCDihpIgZXNjYXBlICsgb3B0aW9uYWwgbmwyYnIgKHZpYSB3cGJjX2JmYl9maWVsZF9zdGF0aWNfdGV4dC5lc2NhcGVfdGV4dCgpKS5cclxuXHQgKiAgICAgIOKAoiBodG1sX2lkIC8gbmFtZSAgIOKGkiByZW5kZXJlZCBhcyBpZD1cIuKAplwiIC8gbmFtZT1cIuKAplwiLlxyXG5cdCAqICAtIEhlbHAgdGV4dCBpcyBhcHBlbmRlZCBjZW50cmFsbHkgYnkgV1BCQ19CRkJfRXhwb3J0ZXIucmVuZGVyX2ZpZWxkX25vZGUoKSwgc2FtZSBhcyBvdGhlciBwYWNrcy5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiByZWdpc3Rlcl9zdGF0aWNfdGV4dF9ib29raW5nX2Zvcm1fZXhwb3J0ZXIoKSB7XHJcblxyXG5cdFx0dmFyIEV4cCA9IHcuV1BCQ19CRkJfRXhwb3J0ZXI7XHJcblx0XHRpZiAoICEgRXhwIHx8IHR5cGVvZiBFeHAucmVnaXN0ZXIgIT09ICdmdW5jdGlvbicgKSB7IHJldHVybjsgfVxyXG5cdFx0aWYgKCB0eXBlb2YgRXhwLmhhc19leHBvcnRlciA9PT0gJ2Z1bmN0aW9uJyAmJiBFeHAuaGFzX2V4cG9ydGVyKCAnc3RhdGljX3RleHQnICkgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdHZhciBTICAgICAgICAgID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZSB8fCB7fTtcclxuXHRcdHZhciBlc2NfaHRtbCAgID0gUy5lc2NhcGVfaHRtbCAgICAgICAgICAgfHwgZnVuY3Rpb24oIHYgKXsgcmV0dXJuIFN0cmluZyggdiApOyB9O1xyXG5cdFx0dmFyIHNhbml0aXplSWQgPSBTLnNhbml0aXplX2h0bWxfaWQgICAgICB8fCBmdW5jdGlvbiggdiApeyByZXR1cm4gU3RyaW5nKCB2ICkudHJpbSgpOyB9O1xyXG5cdFx0dmFyIHNhbml0aXplTm0gPSBTLnNhbml0aXplX2h0bWxfbmFtZSAgICB8fCBmdW5jdGlvbiggdiApeyByZXR1cm4gU3RyaW5nKCB2ICkudHJpbSgpOyB9O1xyXG5cdFx0dmFyIHNhbml0aXplQ2wgPSBTLnNhbml0aXplX2Nzc19jbGFzc2xpc3R8fCBmdW5jdGlvbiggdiApeyByZXR1cm4gU3RyaW5nKCB2ICkudHJpbSgpOyB9O1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQHR5cGUge1dQQkNfQkZCX0V4cG9ydGVyQ2FsbGJhY2t9XHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gIGZpZWxkXHJcblx0XHQgKiBAcGFyYW0ge2Z1bmN0aW9uKHN0cmluZyk6dm9pZH0gZW1pdFxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9ICBbZXh0cmFzXVxyXG5cdFx0ICovXHJcblx0XHR2YXIgZXhwb3J0ZXJfY2FsbGJhY2sgPSBmdW5jdGlvbiggZmllbGQsIGVtaXQsIGV4dHJhcyApIHtcclxuXHRcdFx0ZXh0cmFzID0gZXh0cmFzIHx8IHt9O1xyXG5cclxuXHRcdFx0Ly8gTWVyZ2Ugd2l0aCBkZWZhdWx0cyBzbyBhbGwgcHJvcHMgYXJlIHByZXNlbnQgKG1pcnJvcnMgcHJldmlldykuXHJcblx0XHRcdHZhciBkZWZzID0gd3BiY19iZmJfZmllbGRfc3RhdGljX3RleHQuZ2V0X2RlZmF1bHRzKCk7XHJcblx0XHRcdHZhciBkICAgID0gT2JqZWN0LmFzc2lnbigge30sIGRlZnMsIGZpZWxkIHx8IHt9ICk7XHJcblxyXG5cdFx0XHR2YXIgdGFnICAgPSB3cGJjX2JmYl9maWVsZF9zdGF0aWNfdGV4dC5hbGxvd190YWcoIGQudGFnICk7XHJcblx0XHRcdHZhciBhbGlnbiA9IHdwYmNfYmZiX2ZpZWxkX3N0YXRpY190ZXh0LmFsbG93X2FsaWduKCBkLmFsaWduICk7XHJcblxyXG5cdFx0XHR2YXIgaHRtbF9pZCAgID0gZC5odG1sX2lkID8gc2FuaXRpemVJZCggU3RyaW5nKCBkLmh0bWxfaWQgKSApIDogJyc7XHJcblx0XHRcdHZhciBuYW1lX3ZhbCAgPSBkLm5hbWUgICAgPyBzYW5pdGl6ZU5tKCBTdHJpbmcoIGQubmFtZSApICkgICAgOiAnJztcclxuXHJcblx0XHRcdC8vIEV4dHJhIENTUyBjbGFzc2VzIGZyb20gSW5zcGVjdG9yIC8gc2NoZW1hLlxyXG5cdFx0XHR2YXIgY2xzX2V4dHJhX3JhdyA9IFN0cmluZyggZC5jc3NjbGFzc19leHRyYSB8fCBkLmNzc2NsYXNzIHx8IGQuY2xhc3MgfHwgJycgKTtcclxuXHRcdFx0dmFyIGNsc19leHRyYSAgICAgPSBzYW5pdGl6ZUNsKCBjbHNfZXh0cmFfcmF3ICk7XHJcblxyXG5cdFx0XHQvLyBCYXNlIGNsYXNzIGZvciBzdHlsaW5nIHBhcml0eSBiZXR3ZWVuIEJ1aWxkZXIgcHJldmlldyBhbmQgZXhwb3J0ZWQgZm9ybS5cclxuXHRcdFx0dmFyIGJhc2VfY2xzICA9ICd3cGJjX3N0YXRpY190ZXh0JztcclxuXHRcdFx0dmFyIGNsc19mdWxsICA9IGJhc2VfY2xzICsgKCBjbHNfZXh0cmEgPyAoICcgJyArIGNsc19leHRyYSApIDogJycgKTtcclxuXHJcblx0XHRcdHZhciBpZF9hdHRyICAgPSBodG1sX2lkICA/ICcgaWQ9XCInICAgKyBlc2NfaHRtbCggaHRtbF9pZCApICArICdcIicgOiAnJztcclxuXHRcdFx0dmFyIG5hbWVfYXR0ciA9IG5hbWVfdmFsID8gJyBuYW1lPVwiJyArIGVzY19odG1sKCBuYW1lX3ZhbCApICsgJ1wiJyA6ICcnO1xyXG5cdFx0XHR2YXIgY2xzX2F0dHIgID0gJyBjbGFzcz1cIicgKyBlc2NfaHRtbCggY2xzX2Z1bGwgKSArICdcIic7XHJcblxyXG5cdFx0XHQvLyBJbmxpbmUgc3R5bGVzOiB0ZXh0LWFsaWduICsgYm9sZC9pdGFsaWMgZmxhZ3MuXHJcblx0XHRcdHZhciBzdHlsZV9iaXRzID0gW107XHJcblx0XHRcdGlmICggYWxpZ24gKSAgICAgICB7IHN0eWxlX2JpdHMucHVzaCggJ3RleHQtYWxpZ246JyArIGFsaWduICk7IH1cclxuXHRcdFx0aWYgKCBkLmJvbGQgKSAgICAgIHsgc3R5bGVfYml0cy5wdXNoKCAnZm9udC13ZWlnaHQ6Ym9sZCcgKTsgfVxyXG5cdFx0XHRpZiAoIGQuaXRhbGljICkgICAgeyBzdHlsZV9iaXRzLnB1c2goICdmb250LXN0eWxlOml0YWxpYycgKTsgfVxyXG5cdFx0XHR2YXIgc3R5bGVfYXR0ciA9IHN0eWxlX2JpdHMubGVuZ3RoXHJcblx0XHRcdFx0PyAnIHN0eWxlPVwiJyArIGVzY19odG1sKCBzdHlsZV9iaXRzLmpvaW4oICc7JyApICkgKyAnXCInXHJcblx0XHRcdFx0OiAnJztcclxuXHJcblx0XHRcdC8vIENvbnRlbnQ6IGVzY2FwZSArIG5sMmJyIHdoZW4gSFRNTCBpcyBOT1QgYWxsb3dlZDsgcmF3IHdoZW4gYWxsb3dlZC5cclxuXHRcdFx0dmFyIGNvbnRlbnQ7XHJcblx0XHRcdGlmICggdy5XUEJDX0JGQl9TdGF0aWNfVGV4dF9MaW5rcyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygdy5XUEJDX0JGQl9TdGF0aWNfVGV4dF9MaW5rcy5idWlsZF9jb250ZW50X2h0bWwgKSB7XG5cdFx0XHRcdGNvbnRlbnQgPSB3LldQQkNfQkZCX1N0YXRpY19UZXh0X0xpbmtzLmJ1aWxkX2NvbnRlbnRfaHRtbChcblx0XHRcdFx0XHRkLnRleHQsXG5cdFx0XHRcdFx0ZC5saW5rcyxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRhbGxvd19odG1sICA6ICEhIGQuaHRtbF9hbGxvd2VkLFxuXHRcdFx0XHRcdFx0bmwyYnIgICAgICAgOiAhISBkLm5sMmJyLFxuXHRcdFx0XHRcdFx0cHJldmlld19vbmx5OiBmYWxzZVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0KTtcblx0XHRcdH0gZWxzZSBpZiAoIGQuaHRtbF9hbGxvd2VkICkge1xuXHRcdFx0XHRjb250ZW50ID0gU3RyaW5nKCBkLnRleHQgfHwgJycgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnRlbnQgPSB3cGJjX2JmYl9maWVsZF9zdGF0aWNfdGV4dC5lc2NhcGVfdGV4dCggZC50ZXh0LCAhISBkLm5sMmJyICk7XG5cdFx0XHR9XG5cclxuXHRcdFx0ZW1pdChcclxuXHRcdFx0XHQnPCcgKyB0YWcgKyBpZF9hdHRyICsgbmFtZV9hdHRyICsgY2xzX2F0dHIgKyBzdHlsZV9hdHRyICsgJz4nICtcclxuXHRcdFx0XHRcdGNvbnRlbnQgK1xyXG5cdFx0XHRcdCc8LycgKyB0YWcgKyAnPidcclxuXHRcdFx0KTtcclxuXHRcdFx0Ly8gTk9URTpcclxuXHRcdFx0Ly8gIC0gSGVscCB0ZXh0IChmaWVsZC5oZWxwKSBpcyBvdXRwdXQgYnkgV1BCQ19CRkJfRXhwb3J0ZXIucmVuZGVyX2ZpZWxkX25vZGUoKVxyXG5cdFx0XHQvLyAgICBiZW5lYXRoIHRoaXMgYmxvY2ssIGtlZXBpbmcgYmVoYXZpb3IgY29uc2lzdGVudCB3aXRoIG90aGVyIGZpZWxkIHBhY2tzLlxyXG5cdFx0fTtcclxuXHJcblx0XHRFeHAucmVnaXN0ZXIoICdzdGF0aWNfdGV4dCcsIGV4cG9ydGVyX2NhbGxiYWNrICk7XHJcblx0fVxyXG5cclxuXHQvLyBUcnkgaW1tZWRpYXRlIHJlZ2lzdHJhdGlvbjsgaWYgY29yZSBpc27igJl0IHJlYWR5IHlldCwgd2FpdCBmb3IgdGhlIGV2ZW50LlxyXG5cdGlmICggdy5XUEJDX0JGQl9FeHBvcnRlciAmJiB0eXBlb2Ygdy5XUEJDX0JGQl9FeHBvcnRlci5yZWdpc3RlciA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdHJlZ2lzdGVyX3N0YXRpY190ZXh0X2Jvb2tpbmdfZm9ybV9leHBvcnRlcigpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoXHJcblx0XHRcdCd3cGJjOmJmYjpleHBvcnRlci1yZWFkeScsXHJcblx0XHRcdHJlZ2lzdGVyX3N0YXRpY190ZXh0X2Jvb2tpbmdfZm9ybV9leHBvcnRlcixcclxuXHRcdFx0eyBvbmNlOiB0cnVlIH1cclxuXHRcdCk7XHJcblx0fVxyXG5cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBFeHBvcnQgZm9yIFwiQm9va2luZyBEYXRhXCIgKENvbnRlbnQgb2YgYm9va2luZyBmaWVsZHMgZGF0YSlcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8qKlxyXG5cdCAqIFJlZ2lzdGVyIEJvb2tpbmcgRGF0YSBleHBvcnRlciBjYWxsYmFjayAoXCJDb250ZW50IG9mIGJvb2tpbmcgZmllbGRzIGRhdGFcIikgZm9yIFwic3RhdGljX3RleHRcIi5cclxuXHQgKlxyXG5cdCAqIFN0YXRpYyBUZXh0IGlzIHB1cmVseSBwcmVzZW50YXRpb25hbCBhbmQgZG9lcyBub3QgY2FycnkgdXNlci1lbnRlcmVkIHZhbHVlcyxcclxuXHQgKiBzbyBpdCBpcyBpbnRlbnRpb25hbGx5IG9taXR0ZWQgZnJvbSB0aGUgXCJDb250ZW50IG9mIGJvb2tpbmcgZmllbGRzIGRhdGFcIiBvdXRwdXQuXHJcblx0ICogVGhpcyBleHBvcnRlciB0aGVyZWZvcmUgZG9lcyBub3RoaW5nIChlbWl0cyBubyBsaW5lKS5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiByZWdpc3Rlcl9zdGF0aWNfdGV4dF9ib29raW5nX2RhdGFfZXhwb3J0ZXIoKSB7XHJcblxyXG5cdFx0dmFyIEMgPSB3LldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlcjtcclxuXHRcdGlmICggISBDIHx8IHR5cGVvZiBDLnJlZ2lzdGVyICE9PSAnZnVuY3Rpb24nICkgeyByZXR1cm47IH1cclxuXHRcdGlmICggdHlwZW9mIEMuaGFzX2V4cG9ydGVyID09PSAnZnVuY3Rpb24nICYmIEMuaGFzX2V4cG9ydGVyKCAnc3RhdGljX3RleHQnICkgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdHZhciBleHBvcnRlcl9jYWxsYmFjayA9IGZ1bmN0aW9uKCBmaWVsZCwgZW1pdCwgZXh0cmFzICkge1xyXG5cdFx0XHQvLyBJbnRlbnRpb25hbGx5IGVtcHR5OiBzdGF0aWNfdGV4dCBoYXMgbm8gZHluYW1pYyB0b2tlbi92YWx1ZSB0byBzaG93IGluIGJvb2tpbmcgZGF0YS5cclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fTtcclxuXHJcblx0XHRDLnJlZ2lzdGVyKCAnc3RhdGljX3RleHQnLCBleHBvcnRlcl9jYWxsYmFjayApO1xyXG5cdH1cclxuXHJcblx0aWYgKCB3LldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciAmJiB0eXBlb2Ygdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIucmVnaXN0ZXIgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRyZWdpc3Rlcl9zdGF0aWNfdGV4dF9ib29raW5nX2RhdGFfZXhwb3J0ZXIoKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0ZC5hZGRFdmVudExpc3RlbmVyKFxyXG5cdFx0XHQnd3BiYzpiZmI6Y29udGVudC1leHBvcnRlci1yZWFkeScsXHJcblx0XHRcdHJlZ2lzdGVyX3N0YXRpY190ZXh0X2Jvb2tpbmdfZGF0YV9leHBvcnRlcixcclxuXHRcdFx0eyBvbmNlOiB0cnVlIH1cclxuXHRcdCk7XHJcblx0fVxyXG5cclxufSkoIHdpbmRvdywgZG9jdW1lbnQgKTtcclxuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMsVUFBVUEsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7RUFDaEIsWUFBWTs7RUFFWixJQUFJQyxJQUFJLEdBQVFGLENBQUMsQ0FBQ0csYUFBYSxJQUFJLENBQUMsQ0FBQztFQUNyQyxJQUFJQyxRQUFRLEdBQUlGLElBQUksQ0FBQ0csZ0NBQWdDO0VBQ3JELElBQUlDLElBQUksR0FBUUosSUFBSSxDQUFDSyxtQkFBbUI7RUFFeEMsSUFBSyxDQUFFSCxRQUFRLElBQUksT0FBT0EsUUFBUSxDQUFDSSxRQUFRLEtBQUssVUFBVSxJQUFJLENBQUVGLElBQUksRUFBRztJQUN0RUcsS0FBSyxFQUFFQyxHQUFHLEVBQUVDLEtBQUssR0FBSSw0QkFBNEIsRUFB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
