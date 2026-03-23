"use strict";

// File: /includes/page-form-builder/field-packs/submit/_out/submit.js
(function (w) {
  'use strict';

  var Core = w.WPBC_BFB_Core || {};
  var registry = Core.WPBC_BFB_Field_Renderer_Registry;
  var Base = Core.WPBC_BFB_Field_Base;
  if (!registry || typeof registry.register !== 'function' || !Base) {
    _wpbc?.dev?.error?.('WPBC_BFB_Field_Submit', 'Core registry/base missing');
    return;
  }

  /**
   * WPBC BFB: Field Renderer for "submit" (Schema-driven, template-literal render)
   * - Inspector is rendered by Factory (from PHP schema).
   * - No wp.template usage for preview.
   */
  class WPBC_BFB_Field_Submit extends Base {
    /**
     * Return default props for "submit" field.
     * Must stay in sync with PHP schema defaults.
     *
     * @returns {Object}
     */
    static get_defaults() {
      return {
        type: 'submit',
        label: 'Send',
        name: '',
        html_id: '',
        cssclass: 'wpbc_bfb__btn wpbc_bfb__btn--primary',
        help: '',
        usage_key: 'submit'
      };
    }

    /**
     * Render the preview markup into the field element.
     *
     * @param {HTMLElement} el   Field root element inside the canvas.
     * @param {Object}      data Field props (already normalized by schema).
     * @param {Object}      ctx  Context: { builder, sanit, ... }
     * @returns {void}
     */
    static render(el, data, ctx) {
      if (!el) {
        return;
      }

      // Normalize against defaults first.
      const d = this.normalize_data(data);

      // ----- Core sanitize helpers (static) -----
      const eh = v => Core.WPBC_BFB_Sanitize.escape_html(v);
      const sid = v => Core.WPBC_BFB_Sanitize.sanitize_html_id(v);
      const sname = v => Core.WPBC_BFB_Sanitize.sanitize_html_name(v);
      const sclass = v => Core.WPBC_BFB_Sanitize.sanitize_css_classlist(v);
      const truthy = v => Core.WPBC_BFB_Sanitize.is_truthy(v);
      const one_of = (v, list, def) => list.indexOf(v) !== -1 ? v : def;

      // Public attributes.
      const html_id = d.html_id ? sid(String(d.html_id)) : '';
      const name_val = d.name ? sname(String(d.name)) : '';
      const css_next = sclass(String(d.cssclass || ''));

      // Persist core-related props on dataset (do not mutate wrapper classes directly).
      if ('cssclass' in d && el.dataset.cssclass !== css_next) {
        el.dataset.cssclass = css_next;
      }
      if ('html_id' in d && el.dataset.html_id !== html_id) {
        el.dataset.html_id = html_id;
      }

      // Attribute fragments.
      const id_attr = html_id ? ` id="${eh(html_id)}"` : '';
      const name_attr = name_val ? ` name="${eh(name_val)}"` : '';
      const cls_attr = ` class="wpbc_button_light ${css_next ? eh(css_next) : ''}"`;

      // Optional help text below the button.
      const help_html = d.help ? `<div class="wpbc_bfb__help">${eh(d.help)}</div>` : '';

      // Render preview HTML (no actions; prevent real submit via type="button").
      el.innerHTML = `
				<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="">
					<div class="wpbc_bfb__field-preview">
						<button type="button"${cls_attr}${id_attr}${name_attr}>
							${eh(d.label || 'Send')}
						</button>
					</div>
					${help_html}
				</span>
			`;

      // Overlay (handles/toolbars).
      Core.UI?.WPBC_BFB_Overlay?.ensure?.(ctx?.builder, el);
    }

    /**
     * Optional hook executed after field is dropped from the palette.
     *
     * @param {Object}      data
     * @param {HTMLElement} el
     * @param {Object}      ctx
     * @returns {void}
     */
    static on_field_drop(data, el, ctx) {
      // Keep base behavior (auto-name from label, etc.).
      super.on_field_drop?.(data, el, ctx);
    }
  }
  try {
    registry.register('submit', WPBC_BFB_Field_Submit);
  } catch (e) {
    _wpbc?.dev?.error?.('WPBC_BFB_Field_Submit.register', e);
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Form" (Advanced Form shortcode)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Register Booking Form exporter callback (Advanced Form) for "submit".
   *
   * This exporter:
   *  - Emits the shortcode:
   *        [submit "Label"]
   *    where "Label" defaults to "Send" when empty.
   *  - Behavior is compatible with the previous centralized exporter:
   *      • uses Core.WPBC_BFB_Sanitize.escape_for_shortcode() when available,
   *      • does not wrap the shortcode in extra HTML,
   *      • leaves help text handling to WPBC_BFB_Exporter.render_field_node().
   */
  function register_submit_booking_form_exporter() {
    var Exp = w.WPBC_BFB_Exporter;
    if (!Exp || typeof Exp.register !== 'function') {
      return;
    }
    if (typeof Exp.has_exporter === 'function' && Exp.has_exporter('submit')) {
      return;
    }
    var S = Core.WPBC_BFB_Sanitize || {};
    var esc_html = S.escape_html || function (v) {
      return String(v);
    };
    var sid = S.sanitize_html_id || function (v) {
      return String(v).trim();
    };
    var scls = S.sanitize_css_classlist || function (v) {
      return String(v).trim();
    };
    var esc_sc = S.escape_for_shortcode || function (v) {
      return String(v);
    };

    /**
     * @type {WPBC_BFB_ExporterCallback}
     * @param {Object}                field
     * @param {function(string):void} emit
     * @param {Object}                [extras]
     */
    var exporter_callback = function (field, emit, extras) {
      extras = extras || {};

      // Merge with defaults to ensure all props (label, html_id, cssclass, …) are present.
      var defs = WPBC_BFB_Field_Submit.get_defaults();
      var d = Object.assign({}, defs, field || {});

      // Label (shortcode argument).
      var raw_label = d && typeof d.label === 'string' && d.label.length ? d.label : 'Send';
      var label = '"' + esc_sc(String(raw_label)) + '"';

      // ID / class wrapper around the shortcode (layout-only, no behavior).
      var html_id = d.html_id ? sid(String(d.html_id)) : '';
      var cls_raw = String(d.cssclass_extra || d.cssclass || d.class || '');
      var cls_val = scls(cls_raw);

      // Ensure unique id across the export tree (shared Set from the export context).
      var used_ids = extras && extras.ctx && extras.ctx.usedIds;
      if (html_id && used_ids instanceof Set) {
        var unique = html_id,
          i = 2;
        while (used_ids.has(unique)) {
          unique = html_id + '_' + i++;
        }
        used_ids.add(unique);
        html_id = unique;
      }
      var id_attr = html_id ? ' id="' + esc_html(html_id) + '"' : '';
      var cls_attr = cls_val ? ' class="' + esc_html(cls_val) + '"' : '';

      // Only wrap in <span ... style="flex:1;"> if id or class exists (matches other packs).
      var has_wrapper = !!(id_attr || cls_attr);
      var open = has_wrapper ? '<span' + id_attr + cls_attr + ' style="flex:1;">' : '';
      var close = has_wrapper ? '</span>' : '';

      // Shortcode itself remains legacy-compatible: -    [submit "Send"] //.
      emit(open + '[submit ' + label + ']' + close);
    };
    Exp.register('submit', exporter_callback);
  }
  if (w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function') {
    register_submit_booking_form_exporter();
  } else if (typeof document !== 'undefined') {
    document.addEventListener('wpbc:bfb:exporter-ready', register_submit_booking_form_exporter, {
      once: true
    });
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Data" (Content of booking fields data)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Register Booking Data exporter callback ("Content of booking fields data") for "submit".
   *
   * Submit is a control element and does not carry user-entered values,
   * so it is intentionally omitted from the "Content of booking fields data" output.
   */
  function register_submit_booking_data_exporter() {
    var C = w.WPBC_BFB_ContentExporter;
    if (!C || typeof C.register !== 'function') {
      return;
    }
    if (typeof C.has_exporter === 'function' && C.has_exporter('submit')) {
      return;
    }

    /**
     * @param {Object}                field
     * @param {function(string):void} emit
     * @param {Object}                [extras]
     * @returns {void}
     */
    var exporter_callback = function (field, emit, extras) {
      // Intentionally empty: submit has no data token/value.
      return;
    };
    C.register('submit', exporter_callback);
  }
  if (w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function') {
    register_submit_booking_data_exporter();
  } else if (typeof document !== 'undefined') {
    document.addEventListener('wpbc:bfb:content-exporter-ready', register_submit_booking_data_exporter, {
      once: true
    });
  }
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3Mvc3VibWl0L19vdXQvc3VibWl0LmpzIiwibmFtZXMiOlsidyIsIkNvcmUiLCJXUEJDX0JGQl9Db3JlIiwicmVnaXN0cnkiLCJXUEJDX0JGQl9GaWVsZF9SZW5kZXJlcl9SZWdpc3RyeSIsIkJhc2UiLCJXUEJDX0JGQl9GaWVsZF9CYXNlIiwicmVnaXN0ZXIiLCJfd3BiYyIsImRldiIsImVycm9yIiwiV1BCQ19CRkJfRmllbGRfU3VibWl0IiwiZ2V0X2RlZmF1bHRzIiwidHlwZSIsImxhYmVsIiwibmFtZSIsImh0bWxfaWQiLCJjc3NjbGFzcyIsImhlbHAiLCJ1c2FnZV9rZXkiLCJyZW5kZXIiLCJlbCIsImRhdGEiLCJjdHgiLCJkIiwibm9ybWFsaXplX2RhdGEiLCJlaCIsInYiLCJXUEJDX0JGQl9TYW5pdGl6ZSIsImVzY2FwZV9odG1sIiwic2lkIiwic2FuaXRpemVfaHRtbF9pZCIsInNuYW1lIiwic2FuaXRpemVfaHRtbF9uYW1lIiwic2NsYXNzIiwic2FuaXRpemVfY3NzX2NsYXNzbGlzdCIsInRydXRoeSIsImlzX3RydXRoeSIsIm9uZV9vZiIsImxpc3QiLCJkZWYiLCJpbmRleE9mIiwiU3RyaW5nIiwibmFtZV92YWwiLCJjc3NfbmV4dCIsImRhdGFzZXQiLCJpZF9hdHRyIiwibmFtZV9hdHRyIiwiY2xzX2F0dHIiLCJoZWxwX2h0bWwiLCJpbm5lckhUTUwiLCJVSSIsIldQQkNfQkZCX092ZXJsYXkiLCJlbnN1cmUiLCJidWlsZGVyIiwib25fZmllbGRfZHJvcCIsImUiLCJyZWdpc3Rlcl9zdWJtaXRfYm9va2luZ19mb3JtX2V4cG9ydGVyIiwiRXhwIiwiV1BCQ19CRkJfRXhwb3J0ZXIiLCJoYXNfZXhwb3J0ZXIiLCJTIiwiZXNjX2h0bWwiLCJ0cmltIiwic2NscyIsImVzY19zYyIsImVzY2FwZV9mb3Jfc2hvcnRjb2RlIiwiZXhwb3J0ZXJfY2FsbGJhY2siLCJmaWVsZCIsImVtaXQiLCJleHRyYXMiLCJkZWZzIiwiT2JqZWN0IiwiYXNzaWduIiwicmF3X2xhYmVsIiwibGVuZ3RoIiwiY2xzX3JhdyIsImNzc2NsYXNzX2V4dHJhIiwiY2xhc3MiLCJjbHNfdmFsIiwidXNlZF9pZHMiLCJ1c2VkSWRzIiwiU2V0IiwidW5pcXVlIiwiaSIsImhhcyIsImFkZCIsImhhc193cmFwcGVyIiwib3BlbiIsImNsb3NlIiwiZG9jdW1lbnQiLCJhZGRFdmVudExpc3RlbmVyIiwib25jZSIsInJlZ2lzdGVyX3N1Ym1pdF9ib29raW5nX2RhdGFfZXhwb3J0ZXIiLCJDIiwiV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyIiwid2luZG93Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3Mvc3VibWl0L19zcmMvc3VibWl0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIEZpbGU6IC9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9maWVsZC1wYWNrcy9zdWJtaXQvX291dC9zdWJtaXQuanNcclxuKGZ1bmN0aW9uICggdyApIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdHZhciBDb3JlICAgICA9IHcuV1BCQ19CRkJfQ29yZSB8fCB7fTtcclxuXHR2YXIgcmVnaXN0cnkgPSBDb3JlLldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5O1xyXG5cdHZhciBCYXNlICAgICA9IENvcmUuV1BCQ19CRkJfRmllbGRfQmFzZTtcclxuXHJcblx0aWYgKCAhIHJlZ2lzdHJ5IHx8IHR5cGVvZiByZWdpc3RyeS5yZWdpc3RlciAhPT0gJ2Z1bmN0aW9uJyB8fCAhIEJhc2UgKSB7XHJcblx0XHRfd3BiYz8uZGV2Py5lcnJvcj8uKCAnV1BCQ19CRkJfRmllbGRfU3VibWl0JywgJ0NvcmUgcmVnaXN0cnkvYmFzZSBtaXNzaW5nJyApO1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogV1BCQyBCRkI6IEZpZWxkIFJlbmRlcmVyIGZvciBcInN1Ym1pdFwiIChTY2hlbWEtZHJpdmVuLCB0ZW1wbGF0ZS1saXRlcmFsIHJlbmRlcilcclxuXHQgKiAtIEluc3BlY3RvciBpcyByZW5kZXJlZCBieSBGYWN0b3J5IChmcm9tIFBIUCBzY2hlbWEpLlxyXG5cdCAqIC0gTm8gd3AudGVtcGxhdGUgdXNhZ2UgZm9yIHByZXZpZXcuXHJcblx0ICovXHJcblx0Y2xhc3MgV1BCQ19CRkJfRmllbGRfU3VibWl0IGV4dGVuZHMgQmFzZSB7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZXR1cm4gZGVmYXVsdCBwcm9wcyBmb3IgXCJzdWJtaXRcIiBmaWVsZC5cclxuXHRcdCAqIE11c3Qgc3RheSBpbiBzeW5jIHdpdGggUEhQIHNjaGVtYSBkZWZhdWx0cy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7T2JqZWN0fVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZ2V0X2RlZmF1bHRzKCkge1xyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdHR5cGUgICAgICA6ICdzdWJtaXQnLFxyXG5cdFx0XHRcdGxhYmVsICAgICA6ICdTZW5kJyxcclxuXHRcdFx0XHRuYW1lICAgICAgOiAnJyxcclxuXHRcdFx0XHRodG1sX2lkICAgOiAnJyxcclxuXHRcdFx0XHRjc3NjbGFzcyAgOiAnd3BiY19iZmJfX2J0biB3cGJjX2JmYl9fYnRuLS1wcmltYXJ5JyxcclxuXHRcdFx0XHRoZWxwICAgICAgOiAnJyxcclxuXHRcdFx0XHR1c2FnZV9rZXkgOiAnc3VibWl0J1xyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVuZGVyIHRoZSBwcmV2aWV3IG1hcmt1cCBpbnRvIHRoZSBmaWVsZCBlbGVtZW50LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsICAgRmllbGQgcm9vdCBlbGVtZW50IGluc2lkZSB0aGUgY2FudmFzLlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgZGF0YSBGaWVsZCBwcm9wcyAoYWxyZWFkeSBub3JtYWxpemVkIGJ5IHNjaGVtYSkuXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjdHggIENvbnRleHQ6IHsgYnVpbGRlciwgc2FuaXQsIC4uLiB9XHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHJlbmRlciggZWwsIGRhdGEsIGN0eCApIHtcclxuXHJcblx0XHRcdGlmICggISBlbCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIE5vcm1hbGl6ZSBhZ2FpbnN0IGRlZmF1bHRzIGZpcnN0LlxyXG5cdFx0XHRjb25zdCBkID0gdGhpcy5ub3JtYWxpemVfZGF0YSggZGF0YSApO1xyXG5cclxuXHRcdFx0Ly8gLS0tLS0gQ29yZSBzYW5pdGl6ZSBoZWxwZXJzIChzdGF0aWMpIC0tLS0tXHJcblx0XHRcdGNvbnN0IGVoICAgICAgPSAoIHYgKSA9PiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY2FwZV9odG1sKCB2ICk7XHJcblx0XHRcdGNvbnN0IHNpZCAgICAgPSAoIHYgKSA9PiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2h0bWxfaWQoIHYgKTtcclxuXHRcdFx0Y29uc3Qgc25hbWUgICA9ICggdiApID0+IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuc2FuaXRpemVfaHRtbF9uYW1lKCB2ICk7XHJcblx0XHRcdGNvbnN0IHNjbGFzcyAgPSAoIHYgKSA9PiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2Nzc19jbGFzc2xpc3QoIHYgKTtcclxuXHRcdFx0Y29uc3QgdHJ1dGh5ICA9ICggdiApID0+IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuaXNfdHJ1dGh5KCB2ICk7XHJcblx0XHRcdGNvbnN0IG9uZV9vZiAgPSAoIHYsIGxpc3QsIGRlZiApID0+ICggbGlzdC5pbmRleE9mKCB2ICkgIT09IC0xID8gdiA6IGRlZiApO1xyXG5cclxuXHRcdFx0Ly8gUHVibGljIGF0dHJpYnV0ZXMuXHJcblx0XHRcdGNvbnN0IGh0bWxfaWQgICAgPSBkLmh0bWxfaWQgPyBzaWQoIFN0cmluZyggZC5odG1sX2lkICkgKSA6ICcnO1xyXG5cdFx0XHRjb25zdCBuYW1lX3ZhbCAgID0gZC5uYW1lID8gc25hbWUoIFN0cmluZyggZC5uYW1lICkgKSA6ICcnO1xyXG5cdFx0XHRjb25zdCBjc3NfbmV4dCAgID0gc2NsYXNzKCBTdHJpbmcoIGQuY3NzY2xhc3MgfHwgJycgKSApO1xyXG5cclxuXHJcblx0XHRcdC8vIFBlcnNpc3QgY29yZS1yZWxhdGVkIHByb3BzIG9uIGRhdGFzZXQgKGRvIG5vdCBtdXRhdGUgd3JhcHBlciBjbGFzc2VzIGRpcmVjdGx5KS5cclxuXHRcdFx0aWYgKCAnY3NzY2xhc3MnIGluIGQgJiYgZWwuZGF0YXNldC5jc3NjbGFzcyAhPT0gY3NzX25leHQgKSB7XHJcblx0XHRcdFx0ZWwuZGF0YXNldC5jc3NjbGFzcyA9IGNzc19uZXh0O1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggJ2h0bWxfaWQnIGluIGQgJiYgZWwuZGF0YXNldC5odG1sX2lkICE9PSBodG1sX2lkICkge1xyXG5cdFx0XHRcdGVsLmRhdGFzZXQuaHRtbF9pZCA9IGh0bWxfaWQ7XHJcblx0XHRcdH1cclxuXHJcblxyXG5cdFx0XHQvLyBBdHRyaWJ1dGUgZnJhZ21lbnRzLlxyXG5cdFx0XHRjb25zdCBpZF9hdHRyICAgPSBodG1sX2lkID8gYCBpZD1cIiR7ZWgoIGh0bWxfaWQgKX1cImAgOiAnJztcclxuXHRcdFx0Y29uc3QgbmFtZV9hdHRyID0gbmFtZV92YWwgPyBgIG5hbWU9XCIke2VoKCBuYW1lX3ZhbCApfVwiYCA6ICcnO1xyXG5cdFx0XHRjb25zdCBjbHNfYXR0ciAgPSBgIGNsYXNzPVwid3BiY19idXR0b25fbGlnaHQgJHtjc3NfbmV4dCA/IGVoKCBjc3NfbmV4dCApIDogJyd9XCJgO1xyXG5cclxuXHRcdFx0Ly8gT3B0aW9uYWwgaGVscCB0ZXh0IGJlbG93IHRoZSBidXR0b24uXHJcblx0XHRcdGNvbnN0IGhlbHBfaHRtbCA9IGQuaGVscCA/IGA8ZGl2IGNsYXNzPVwid3BiY19iZmJfX2hlbHBcIj4ke2VoKCBkLmhlbHAgKX08L2Rpdj5gIDogJyc7XHJcblxyXG5cdFx0XHQvLyBSZW5kZXIgcHJldmlldyBIVE1MIChubyBhY3Rpb25zOyBwcmV2ZW50IHJlYWwgc3VibWl0IHZpYSB0eXBlPVwiYnV0dG9uXCIpLlxyXG5cdFx0XHRlbC5pbm5lckhUTUwgPSBgXHJcblx0XHRcdFx0PHNwYW4gY2xhc3M9XCJ3cGJjX2JmYl9fbm9hY3Rpb24gd3BiY19iZmJfX25vLWRyYWctem9uZVwiIGluZXJ0PVwiXCI+XHJcblx0XHRcdFx0XHQ8ZGl2IGNsYXNzPVwid3BiY19iZmJfX2ZpZWxkLXByZXZpZXdcIj5cclxuXHRcdFx0XHRcdFx0PGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIke2Nsc19hdHRyfSR7aWRfYXR0cn0ke25hbWVfYXR0cn0+XHJcblx0XHRcdFx0XHRcdFx0JHtlaCggZC5sYWJlbCB8fCAnU2VuZCcgKX1cclxuXHRcdFx0XHRcdFx0PC9idXR0b24+XHJcblx0XHRcdFx0XHQ8L2Rpdj5cclxuXHRcdFx0XHRcdCR7aGVscF9odG1sfVxyXG5cdFx0XHRcdDwvc3Bhbj5cclxuXHRcdFx0YDtcclxuXHJcblx0XHRcdC8vIE92ZXJsYXkgKGhhbmRsZXMvdG9vbGJhcnMpLlxyXG5cdFx0XHRDb3JlLlVJPy5XUEJDX0JGQl9PdmVybGF5Py5lbnN1cmU/LiggY3R4Py5idWlsZGVyLCBlbCApO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE9wdGlvbmFsIGhvb2sgZXhlY3V0ZWQgYWZ0ZXIgZmllbGQgaXMgZHJvcHBlZCBmcm9tIHRoZSBwYWxldHRlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGRhdGFcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjdHhcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgb25fZmllbGRfZHJvcCggZGF0YSwgZWwsIGN0eCApIHtcclxuXHRcdFx0Ly8gS2VlcCBiYXNlIGJlaGF2aW9yIChhdXRvLW5hbWUgZnJvbSBsYWJlbCwgZXRjLikuXHJcblx0XHRcdHN1cGVyLm9uX2ZpZWxkX2Ryb3A/LiggZGF0YSwgZWwsIGN0eCApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0dHJ5IHtcclxuXHRcdHJlZ2lzdHJ5LnJlZ2lzdGVyKCAnc3VibWl0JywgV1BCQ19CRkJfRmllbGRfU3VibWl0ICk7XHJcblx0fSBjYXRjaCAoIGUgKSB7IF93cGJjPy5kZXY/LmVycm9yPy4oICdXUEJDX0JGQl9GaWVsZF9TdWJtaXQucmVnaXN0ZXInLCBlICk7IH1cclxuXHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRXhwb3J0IGZvciBcIkJvb2tpbmcgRm9ybVwiIChBZHZhbmNlZCBGb3JtIHNob3J0Y29kZSlcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8qKlxyXG5cdCAqIFJlZ2lzdGVyIEJvb2tpbmcgRm9ybSBleHBvcnRlciBjYWxsYmFjayAoQWR2YW5jZWQgRm9ybSkgZm9yIFwic3VibWl0XCIuXHJcblx0ICpcclxuXHQgKiBUaGlzIGV4cG9ydGVyOlxyXG5cdCAqICAtIEVtaXRzIHRoZSBzaG9ydGNvZGU6XHJcblx0ICogICAgICAgIFtzdWJtaXQgXCJMYWJlbFwiXVxyXG5cdCAqICAgIHdoZXJlIFwiTGFiZWxcIiBkZWZhdWx0cyB0byBcIlNlbmRcIiB3aGVuIGVtcHR5LlxyXG5cdCAqICAtIEJlaGF2aW9yIGlzIGNvbXBhdGlibGUgd2l0aCB0aGUgcHJldmlvdXMgY2VudHJhbGl6ZWQgZXhwb3J0ZXI6XHJcblx0ICogICAgICDigKIgdXNlcyBDb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY2FwZV9mb3Jfc2hvcnRjb2RlKCkgd2hlbiBhdmFpbGFibGUsXHJcblx0ICogICAgICDigKIgZG9lcyBub3Qgd3JhcCB0aGUgc2hvcnRjb2RlIGluIGV4dHJhIEhUTUwsXHJcblx0ICogICAgICDigKIgbGVhdmVzIGhlbHAgdGV4dCBoYW5kbGluZyB0byBXUEJDX0JGQl9FeHBvcnRlci5yZW5kZXJfZmllbGRfbm9kZSgpLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHJlZ2lzdGVyX3N1Ym1pdF9ib29raW5nX2Zvcm1fZXhwb3J0ZXIoKSB7XHJcblxyXG5cdFx0dmFyIEV4cCA9IHcuV1BCQ19CRkJfRXhwb3J0ZXI7XHJcblx0XHRpZiAoICEgRXhwIHx8IHR5cGVvZiBFeHAucmVnaXN0ZXIgIT09ICdmdW5jdGlvbicgKSB7IHJldHVybjsgfVxyXG5cdFx0aWYgKCB0eXBlb2YgRXhwLmhhc19leHBvcnRlciA9PT0gJ2Z1bmN0aW9uJyAmJiBFeHAuaGFzX2V4cG9ydGVyKCAnc3VibWl0JyApICkgeyByZXR1cm47IH1cclxuXHJcblx0XHR2YXIgUyAgICAgICAgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplIHx8IHt9O1xyXG5cdFx0dmFyIGVzY19odG1sID0gUy5lc2NhcGVfaHRtbCAgICAgICAgICAgIHx8IGZ1bmN0aW9uKCB2ICl7IHJldHVybiBTdHJpbmcoIHYgKTsgfTtcclxuXHRcdHZhciBzaWQgICAgICA9IFMuc2FuaXRpemVfaHRtbF9pZCAgICAgICB8fCBmdW5jdGlvbiggdiApeyByZXR1cm4gU3RyaW5nKCB2ICkudHJpbSgpOyB9O1xyXG5cdFx0dmFyIHNjbHMgICAgID0gUy5zYW5pdGl6ZV9jc3NfY2xhc3NsaXN0IHx8IGZ1bmN0aW9uKCB2ICl7IHJldHVybiBTdHJpbmcoIHYgKS50cmltKCk7IH07XHJcblx0XHR2YXIgZXNjX3NjICAgPSBTLmVzY2FwZV9mb3Jfc2hvcnRjb2RlICAgfHwgZnVuY3Rpb24oIHYgKXsgcmV0dXJuIFN0cmluZyggdiApOyB9O1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQHR5cGUge1dQQkNfQkZCX0V4cG9ydGVyQ2FsbGJhY2t9XHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICAgICAgICAgICAgZmllbGRcclxuXHRcdCAqIEBwYXJhbSB7ZnVuY3Rpb24oc3RyaW5nKTp2b2lkfSBlbWl0XHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICAgICAgICAgICAgW2V4dHJhc11cclxuXHRcdCAqL1xyXG5cdFx0dmFyIGV4cG9ydGVyX2NhbGxiYWNrID0gZnVuY3Rpb24oIGZpZWxkLCBlbWl0LCBleHRyYXMgKSB7XHJcblx0XHRcdGV4dHJhcyA9IGV4dHJhcyB8fCB7fTtcclxuXHJcblx0XHRcdC8vIE1lcmdlIHdpdGggZGVmYXVsdHMgdG8gZW5zdXJlIGFsbCBwcm9wcyAobGFiZWwsIGh0bWxfaWQsIGNzc2NsYXNzLCDigKYpIGFyZSBwcmVzZW50LlxyXG5cdFx0XHR2YXIgZGVmcyA9IFdQQkNfQkZCX0ZpZWxkX1N1Ym1pdC5nZXRfZGVmYXVsdHMoKTtcclxuXHRcdFx0dmFyIGQgICAgPSBPYmplY3QuYXNzaWduKCB7fSwgZGVmcywgZmllbGQgfHwge30gKTtcclxuXHJcblx0XHRcdC8vIExhYmVsIChzaG9ydGNvZGUgYXJndW1lbnQpLlxyXG5cdFx0XHR2YXIgcmF3X2xhYmVsID0gKCBkICYmIHR5cGVvZiBkLmxhYmVsID09PSAnc3RyaW5nJyAmJiBkLmxhYmVsLmxlbmd0aCApID8gZC5sYWJlbCA6ICdTZW5kJztcclxuXHRcdFx0dmFyIGxhYmVsID0gJ1wiJyArIGVzY19zYyggU3RyaW5nKCByYXdfbGFiZWwgKSApICsgJ1wiJztcclxuXHJcblx0XHRcdC8vIElEIC8gY2xhc3Mgd3JhcHBlciBhcm91bmQgdGhlIHNob3J0Y29kZSAobGF5b3V0LW9ubHksIG5vIGJlaGF2aW9yKS5cclxuXHRcdFx0dmFyIGh0bWxfaWQgPSBkLmh0bWxfaWQgPyBzaWQoIFN0cmluZyggZC5odG1sX2lkICkgKSA6ICcnO1xyXG5cdFx0XHR2YXIgY2xzX3JhdyA9IFN0cmluZyggZC5jc3NjbGFzc19leHRyYSB8fCBkLmNzc2NsYXNzIHx8IGQuY2xhc3MgfHwgJycgKTtcclxuXHRcdFx0dmFyIGNsc192YWwgPSBzY2xzKCBjbHNfcmF3ICk7XHJcblxyXG5cdFx0XHQvLyBFbnN1cmUgdW5pcXVlIGlkIGFjcm9zcyB0aGUgZXhwb3J0IHRyZWUgKHNoYXJlZCBTZXQgZnJvbSB0aGUgZXhwb3J0IGNvbnRleHQpLlxyXG5cdFx0XHR2YXIgdXNlZF9pZHMgPSBleHRyYXMgJiYgZXh0cmFzLmN0eCAmJiBleHRyYXMuY3R4LnVzZWRJZHM7XHJcblx0XHRcdGlmICggaHRtbF9pZCAmJiB1c2VkX2lkcyBpbnN0YW5jZW9mIFNldCApIHtcclxuXHRcdFx0XHR2YXIgdW5pcXVlID0gaHRtbF9pZCwgaSA9IDI7XHJcblx0XHRcdFx0d2hpbGUgKCB1c2VkX2lkcy5oYXMoIHVuaXF1ZSApICkge1xyXG5cdFx0XHRcdFx0dW5pcXVlID0gaHRtbF9pZCArICdfJyArICggaSsrICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHVzZWRfaWRzLmFkZCggdW5pcXVlICk7XHJcblx0XHRcdFx0aHRtbF9pZCA9IHVuaXF1ZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dmFyIGlkX2F0dHIgID0gaHRtbF9pZCA/ICcgaWQ9XCInICsgZXNjX2h0bWwoIGh0bWxfaWQgKSArICdcIicgOiAnJztcclxuXHRcdFx0dmFyIGNsc19hdHRyID0gY2xzX3ZhbCA/ICcgY2xhc3M9XCInICsgZXNjX2h0bWwoIGNsc192YWwgKSArICdcIicgOiAnJztcclxuXHJcblx0XHRcdC8vIE9ubHkgd3JhcCBpbiA8c3BhbiAuLi4gc3R5bGU9XCJmbGV4OjE7XCI+IGlmIGlkIG9yIGNsYXNzIGV4aXN0cyAobWF0Y2hlcyBvdGhlciBwYWNrcykuXHJcblx0XHRcdHZhciBoYXNfd3JhcHBlciA9ICEhICggaWRfYXR0ciB8fCBjbHNfYXR0ciApO1xyXG5cdFx0XHR2YXIgb3BlbiAgICAgICAgPSBoYXNfd3JhcHBlciA/ICggJzxzcGFuJyArIGlkX2F0dHIgKyBjbHNfYXR0ciArICcgc3R5bGU9XCJmbGV4OjE7XCI+JyApIDogJyc7XHJcblx0XHRcdHZhciBjbG9zZSAgICAgICA9IGhhc193cmFwcGVyID8gJzwvc3Bhbj4nIDogJyc7XHJcblxyXG5cdFx0XHQvLyBTaG9ydGNvZGUgaXRzZWxmIHJlbWFpbnMgbGVnYWN5LWNvbXBhdGlibGU6IC0gICAgW3N1Ym1pdCBcIlNlbmRcIl0gLy8uXHJcblx0XHRcdGVtaXQoIG9wZW4gKyAnW3N1Ym1pdCAnICsgbGFiZWwgKyAnXScgKyBjbG9zZSApO1xyXG5cdFx0fTtcclxuXHJcblx0XHRFeHAucmVnaXN0ZXIoICdzdWJtaXQnLCBleHBvcnRlcl9jYWxsYmFjayApO1xyXG5cdH1cclxuXHJcblx0aWYgKCB3LldQQkNfQkZCX0V4cG9ydGVyICYmIHR5cGVvZiB3LldQQkNfQkZCX0V4cG9ydGVyLnJlZ2lzdGVyID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0cmVnaXN0ZXJfc3VibWl0X2Jvb2tpbmdfZm9ybV9leHBvcnRlcigpO1xyXG5cdH0gZWxzZSBpZiAoIHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcgKSB7XHJcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzpiZmI6ZXhwb3J0ZXItcmVhZHknLCByZWdpc3Rlcl9zdWJtaXRfYm9va2luZ19mb3JtX2V4cG9ydGVyLCB7IG9uY2U6IHRydWUgfSApO1xyXG5cdH1cclxuXHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRXhwb3J0IGZvciBcIkJvb2tpbmcgRGF0YVwiIChDb250ZW50IG9mIGJvb2tpbmcgZmllbGRzIGRhdGEpXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvKipcclxuXHQgKiBSZWdpc3RlciBCb29raW5nIERhdGEgZXhwb3J0ZXIgY2FsbGJhY2sgKFwiQ29udGVudCBvZiBib29raW5nIGZpZWxkcyBkYXRhXCIpIGZvciBcInN1Ym1pdFwiLlxyXG5cdCAqXHJcblx0ICogU3VibWl0IGlzIGEgY29udHJvbCBlbGVtZW50IGFuZCBkb2VzIG5vdCBjYXJyeSB1c2VyLWVudGVyZWQgdmFsdWVzLFxyXG5cdCAqIHNvIGl0IGlzIGludGVudGlvbmFsbHkgb21pdHRlZCBmcm9tIHRoZSBcIkNvbnRlbnQgb2YgYm9va2luZyBmaWVsZHMgZGF0YVwiIG91dHB1dC5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiByZWdpc3Rlcl9zdWJtaXRfYm9va2luZ19kYXRhX2V4cG9ydGVyKCkge1xyXG5cclxuXHRcdHZhciBDID0gdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXI7XHJcblx0XHRpZiAoICEgQyB8fCB0eXBlb2YgQy5yZWdpc3RlciAhPT0gJ2Z1bmN0aW9uJyApIHsgcmV0dXJuOyB9XHJcblx0XHRpZiAoIHR5cGVvZiBDLmhhc19leHBvcnRlciA9PT0gJ2Z1bmN0aW9uJyAmJiBDLmhhc19leHBvcnRlciggJ3N1Ym1pdCcgKSApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICAgICAgICAgICAgZmllbGRcclxuXHRcdCAqIEBwYXJhbSB7ZnVuY3Rpb24oc3RyaW5nKTp2b2lkfSBlbWl0XHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICAgICAgICAgICAgW2V4dHJhc11cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHR2YXIgZXhwb3J0ZXJfY2FsbGJhY2sgPSBmdW5jdGlvbiggZmllbGQsIGVtaXQsIGV4dHJhcyApIHtcclxuXHRcdFx0Ly8gSW50ZW50aW9uYWxseSBlbXB0eTogc3VibWl0IGhhcyBubyBkYXRhIHRva2VuL3ZhbHVlLlxyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9O1xyXG5cclxuXHRcdEMucmVnaXN0ZXIoICdzdWJtaXQnLCBleHBvcnRlcl9jYWxsYmFjayApO1xyXG5cdH1cclxuXHJcblx0aWYgKCB3LldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciAmJiB0eXBlb2Ygdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIucmVnaXN0ZXIgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRyZWdpc3Rlcl9zdWJtaXRfYm9va2luZ19kYXRhX2V4cG9ydGVyKCk7XHJcblx0fSBlbHNlIGlmICggdHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJyApIHtcclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOmJmYjpjb250ZW50LWV4cG9ydGVyLXJlYWR5JywgcmVnaXN0ZXJfc3VibWl0X2Jvb2tpbmdfZGF0YV9leHBvcnRlciwgeyBvbmNlOiB0cnVlIH0gKTtcclxuXHR9XHJcblxyXG59KSggd2luZG93ICk7XHJcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBLENBQUMsVUFBV0EsQ0FBQyxFQUFHO0VBQ2YsWUFBWTs7RUFFWixJQUFJQyxJQUFJLEdBQU9ELENBQUMsQ0FBQ0UsYUFBYSxJQUFJLENBQUMsQ0FBQztFQUNwQyxJQUFJQyxRQUFRLEdBQUdGLElBQUksQ0FBQ0csZ0NBQWdDO0VBQ3BELElBQUlDLElBQUksR0FBT0osSUFBSSxDQUFDSyxtQkFBbUI7RUFFdkMsSUFBSyxDQUFFSCxRQUFRLElBQUksT0FBT0EsUUFBUSxDQUFDSSxRQUFRLEtBQUssVUFBVSxJQUFJLENBQUVGLElBQUksRUFB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
