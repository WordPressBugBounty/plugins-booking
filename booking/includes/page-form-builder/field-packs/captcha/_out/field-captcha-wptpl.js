"use strict";

// ---------------------------------------------------------------------------------------------------------------------
// == File  /includes/page-form-builder/field-packs/captcha/_out/field-captcha-wptpl.js
// == Pack  Text Captcha (WP-template–driven) — Builder-focused renderer
// == Exports to shortcode: [captcha]
// ---------------------------------------------------------------------------------------------------------------------
(function (w) {
  'use strict';

  var Core = w.WPBC_BFB_Core || {};
  var Registry = Core.WPBC_BFB_Field_Renderer_Registry;
  var Base = Core.WPBC_BFB_Field_Base;
  if (!Registry || typeof Registry.register !== 'function' || !Base) {
    w._wpbc?.dev?.error?.('wpbc_bfb_field_captcha', 'Core registry/base missing');
    return;
  }

  /**
   * Renderer for "captcha" field (template-driven).
   * Methods/names are in snake_case to follow project conventions.
   */
  class wpbc_bfb_field_captcha extends Base {
    /** Template id without "tmpl-" prefix. */
    static template_id = 'wpbc-bfb-field-captcha';

    /**
     * Defaults must stay in sync with the PHP schema.
     * @returns {Object}
     */
    static get_defaults() {
      return {
        type: 'captcha',
        label: 'CAPTCHA',
        html_id: '',
        cssclass: '',
        help: ''
      };
    }

    /**
     * Render via wp.template into the Builder canvas.
     *
     * @param {HTMLElement} el
     * @param {Object}      data
     * @param {Object}      ctx
     * @return {void}
     */
    static render(el, data, ctx) {
      if (!el) {
        return;
      }

      // Normalize first (mirrors Base.render).
      var d = this.normalize_data(data);

      // Sanitize helpers available in core.
      var S = Core.WPBC_BFB_Sanitize || {};
      var html_id = d.html_id ? S.sanitize_html_id ? S.sanitize_html_id(String(d.html_id)) : String(d.html_id) : '';
      var css_next = S.sanitize_css_classlist ? S.sanitize_css_classlist(String(d.cssclass || '')) : String(d.cssclass || '');

      // Keep wrapper dataset in sync.
      if (el.dataset.html_id !== html_id) {
        el.dataset.html_id = html_id;
      }

      // Compile template via Base (handles "tmpl-" + caching).
      var tpl = this.get_template(this.template_id);
      if (typeof tpl !== 'function') {
        w._wpbc?.dev?.error?.('captcha_wptpl.tpl.missing', 'Template not found: ' + this.template_id);
        el.innerHTML = '<div class="wpbc_bfb__error" role="alert">Template not found: wpbc-bfb-field-captcha.</div>';
        return;
      }

      // Stable id suffix (prefer normalized id if present).
      var id_suffix = d.id != null ? String(d.id) : Math.random().toString(36).slice(2);

      // Lightweight inline placeholder (SVG) to avoid generating real captcha in Builder.
      var placeholder_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40"><rect width="100%" height="100%" fill="#f2f2f2"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-size="16">CAPTCHA CODE</text></svg>';
      var placeholder_src = 'data:image/svg+xml;utf8,' + encodeURIComponent(placeholder_svg);
      var alt_text = 'TEXT CAPTCHA';

      // Render via template.
      try {
        var tpl_data = Object.assign({}, d, {
          html_id: html_id,
          cssclass: css_next,
          id: id_suffix,
          placeholder_src: placeholder_src,
          alt_text: alt_text
        });
        el.innerHTML = tpl(tpl_data);
      } catch (e) {
        w._wpbc?.dev?.error?.('captcha_wptpl.tpl.render', e);
        el.innerHTML = '<div class="wpbc_bfb__error" role="alert">Error rendering CAPTCHA preview.</div>';
        return;
      }

      // Keep wrapper meta consistent.
      el.dataset.type = d.type || 'captcha';
      el.setAttribute('data-label', d.label != null ? String(d.label) : '');

      // Overlay (handles/toolbars).
      Core.UI?.WPBC_BFB_Overlay?.ensure?.(ctx?.builder, el);
    }

    /**
     * Optional hook after field drop. Keep Base logic for auto-names/ids.
     *
     * @param {Object}      data
     * @param {HTMLElement} el
     * @param {Object}      ctx
     * @return {void}
     */
    static on_field_drop(data, el, ctx) {
      super.on_field_drop?.(data, el, ctx);
    }
  }
  try {
    Registry.register('captcha', wpbc_bfb_field_captcha);
  } catch (e) {
    w._wpbc?.dev?.error?.('wpbc_bfb_field_captcha.register', e);
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Form" (Advanced Form shortcode)
  // -----------------------------------------------------------------------------------------------------------------
  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Form" (Advanced Form shortcode)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Booking Form exporter callback (Advanced Form shortcode) for "captcha".
   *
   * This callback is registered per field type via:
   *   WPBC_BFB_Exporter.register( 'captcha', callback )
   *
   * Core call site (builder-exporter.js):
   *   WPBC_BFB_Exporter.run_registered_exporter( field, io, cfg, once, ctx )
   *     -> callback( field, emit, { io, cfg, once, ctx, core } );
   *
   * @callback WPBC_BFB_ExporterCallback
   * @param {Object}  field
   *   Normalized field data coming from the Builder structure.
   *   - field.type          {string}   Field type, here always "captcha".
   *   - field.label         {string}   Visible label in the form (may be empty).
   *   - field.html_id       {string}   Optional HTML id / user-visible id (ignored here).
   *   - field.cssclass      {string}   Extra CSS classes entered in Inspector (ignored here).
   *   - ...                 (Any other pack-specific props are also present.)
   *
   * @param {function(string):void} emit
   *   Emits one line/fragment into the export buffer.
   *   - Each call corresponds to one `push()` in the core exporter.
   *   - For multi-line output (e.g. label + shortcode), call `emit()` multiple times:
   *       emit('<l>Label</l>');
   *       emit('<br>[captcha]');
   *
   * @param {Object} [extras]
   *   Extra context passed by the core exporter.
   *
   * @param {Object} [extras.io]
   *   Low-level writer used internally by the core.
   *   Normally you do NOT need it in packs — prefer `emit()`.
   *   - extras.io.open(str)   -> open a nested block (increments indentation).
   *   - extras.io.close(str)  -> close a block (decrements indentation).
   *   - extras.io.push(str)   -> push raw line (used by `emit()`).
   *   - extras.io.blank()     -> push an empty line.
   *
   * @param {Object} [extras.cfg]
   *   Export configuration (same object passed to WPBC_BFB_Exporter.export_form()).
   *   Useful flags for field packs:
   *   - extras.cfg.addLabels {boolean}  Default: true.
   *       If false, packs should NOT emit <l>Label</l> lines.
   *   - extras.cfg.newline   {string}   Newline separator (usually "\n").
   *   - extras.cfg.gapPercent{number}   Layout gap (used only by section/column logic).
   *
   * @param {Object} [extras.once]
   *   Shared "once-per-form" guards across all fields.
   *   Captcha is a typical once-per-form field:
   *   - extras.once.captcha {number}   Counter of exported captchas.
   *
   * @param {Object} [extras.ctx]
   *   Shared export context for the entire form (not used here).
   *
   * @param {Object} [extras.core]
   *   Reference to WPBC_BFB_Core passed from builder-exporter.js.
   *   Primarily used to access sanitizers:
   *   - extras.core.WPBC_BFB_Sanitize.escape_html(...)
   *   - etc.
   */
  function register_captcha_booking_form_exporter() {
    const Exp = w.WPBC_BFB_Exporter;
    if (!Exp || typeof Exp.register !== 'function') {
      return;
    }
    if (typeof Exp.has_exporter === 'function' && Exp.has_exporter('captcha')) {
      return;
    }
    const S = Core.WPBC_BFB_Sanitize || w.WPBC_BFB_Core && w.WPBC_BFB_Core.WPBC_BFB_Sanitize || {};
    const esc = S.escape_html || (v => String(v));

    /**
     * @type {WPBC_BFB_ExporterCallback}
     */
    Exp.register('captcha', (field, emit, extras = {}) => {
      const cfg = extras.cfg || {};
      const addLabels = cfg.addLabels !== false;
      const once = extras.once && typeof extras.once === 'object' ? extras.once : null;

      // Once-per-form guard: only the first [captcha] is exported.
      if (once) {
        once.captcha = (once.captcha || 0) + 1;
        if (once.captcha > 1) {
          return;
        }
      }

      // Body is fixed for this pack.
      const body = '[captcha]';

      // Label behavior identical to legacy emit_label_then('[captcha]').
      const raw_label = field && typeof field.label === 'string' ? field.label : '';
      const label = raw_label.trim();
      if (label && addLabels) {
        emit(`<l>${esc(label)}</l>`);
        emit(`<br>${body}`);
      } else {
        emit(body);
      }
      // Help text is appended centrally by WPBC_BFB_Exporter.render_field_node().
    });
  }

  // Try immediate registration; if core isn’t ready, wait for the event.
  if (w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function') {
    register_captcha_booking_form_exporter();
  } else {
    document.addEventListener('wpbc:bfb:exporter-ready', register_captcha_booking_form_exporter, {
      once: true
    });
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Data" (Content of booking fields data)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Booking Data exporter callback ("Content of booking fields data") for "captcha".
   *
   * This field does NOT contribute any content to the "Content of booking fields data"
   * template, but we still register an explicit exporter that emits an empty string
   * for consistency and introspection.
   *
   * Registered per field type via:
   *   WPBC_BFB_ContentExporter.register( 'captcha', callback )
   *
   * Core call site (builder-exporter.js):
   *   WPBC_BFB_ContentExporter.run_registered_exporter( field, emit, { cfg, core } );
   *
   * @callback WPBC_BFB_ContentExporterCallback
   * @param {Object}  field   Normalized field data (not used here).
   * @param {function(string):void} emit
   *   Emits a raw HTML fragment into the "Content of booking fields data" template.
   *   Here we explicitly emit an empty string.
   * @param {Object}  [extras]  Additional context (unused).
   */
  function register_captcha_booking_data_exporter() {
    const C = w.WPBC_BFB_ContentExporter;
    if (!C || typeof C.register !== 'function') {
      return;
    }
    if (typeof C.has_exporter === 'function' && C.has_exporter('captcha')) {
      return;
    }
    C.register('captcha', function (field, emit, extras) {// eslint-disable-line no-unused-vars
      // Explicitly export an empty string for captcha in "Content of booking fields data".
      //emit( '' );
    });
  }
  if (w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function') {
    register_captcha_booking_data_exporter();
  } else {
    document.addEventListener('wpbc:bfb:content-exporter-ready', register_captcha_booking_data_exporter, {
      once: true
    });
  }
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvY2FwdGNoYS9fb3V0L2ZpZWxkLWNhcHRjaGEtd3B0cGwuanMiLCJuYW1lcyI6WyJ3IiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJSZWdpc3RyeSIsIldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5IiwiQmFzZSIsIldQQkNfQkZCX0ZpZWxkX0Jhc2UiLCJyZWdpc3RlciIsIl93cGJjIiwiZGV2IiwiZXJyb3IiLCJ3cGJjX2JmYl9maWVsZF9jYXB0Y2hhIiwidGVtcGxhdGVfaWQiLCJnZXRfZGVmYXVsdHMiLCJ0eXBlIiwibGFiZWwiLCJodG1sX2lkIiwiY3NzY2xhc3MiLCJoZWxwIiwicmVuZGVyIiwiZWwiLCJkYXRhIiwiY3R4IiwiZCIsIm5vcm1hbGl6ZV9kYXRhIiwiUyIsIldQQkNfQkZCX1Nhbml0aXplIiwic2FuaXRpemVfaHRtbF9pZCIsIlN0cmluZyIsImNzc19uZXh0Iiwic2FuaXRpemVfY3NzX2NsYXNzbGlzdCIsImRhdGFzZXQiLCJ0cGwiLCJnZXRfdGVtcGxhdGUiLCJpbm5lckhUTUwiLCJpZF9zdWZmaXgiLCJpZCIsIk1hdGgiLCJyYW5kb20iLCJ0b1N0cmluZyIsInNsaWNlIiwicGxhY2Vob2xkZXJfc3ZnIiwicGxhY2Vob2xkZXJfc3JjIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwiYWx0X3RleHQiLCJ0cGxfZGF0YSIsIk9iamVjdCIsImFzc2lnbiIsImUiLCJzZXRBdHRyaWJ1dGUiLCJVSSIsIldQQkNfQkZCX092ZXJsYXkiLCJlbnN1cmUiLCJidWlsZGVyIiwib25fZmllbGRfZHJvcCIsInJlZ2lzdGVyX2NhcHRjaGFfYm9va2luZ19mb3JtX2V4cG9ydGVyIiwiRXhwIiwiV1BCQ19CRkJfRXhwb3J0ZXIiLCJoYXNfZXhwb3J0ZXIiLCJlc2MiLCJlc2NhcGVfaHRtbCIsInYiLCJmaWVsZCIsImVtaXQiLCJleHRyYXMiLCJjZmciLCJhZGRMYWJlbHMiLCJvbmNlIiwiY2FwdGNoYSIsImJvZHkiLCJyYXdfbGFiZWwiLCJ0cmltIiwiZG9jdW1lbnQiLCJhZGRFdmVudExpc3RlbmVyIiwicmVnaXN0ZXJfY2FwdGNoYV9ib29raW5nX2RhdGFfZXhwb3J0ZXIiLCJDIiwiV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyIiwid2luZG93Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvY2FwdGNoYS9fc3JjL2ZpZWxkLWNhcHRjaGEtd3B0cGwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vID09IEZpbGUgIC9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9maWVsZC1wYWNrcy9jYXB0Y2hhL19vdXQvZmllbGQtY2FwdGNoYS13cHRwbC5qc1xyXG4vLyA9PSBQYWNrICBUZXh0IENhcHRjaGEgKFdQLXRlbXBsYXRl4oCTZHJpdmVuKSDigJQgQnVpbGRlci1mb2N1c2VkIHJlbmRlcmVyXHJcbi8vID09IEV4cG9ydHMgdG8gc2hvcnRjb2RlOiBbY2FwdGNoYV1cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbihmdW5jdGlvbiAodykge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0dmFyIENvcmUgICAgID0gdy5XUEJDX0JGQl9Db3JlIHx8IHt9O1xyXG5cdHZhciBSZWdpc3RyeSA9IENvcmUuV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnk7XHJcblx0dmFyIEJhc2UgICAgID0gQ29yZS5XUEJDX0JGQl9GaWVsZF9CYXNlO1xyXG5cclxuXHRpZiAoICEgUmVnaXN0cnkgfHwgdHlwZW9mIFJlZ2lzdHJ5LnJlZ2lzdGVyICE9PSAnZnVuY3Rpb24nIHx8ICEgQmFzZSApIHtcclxuXHRcdHcuX3dwYmM/LmRldj8uZXJyb3I/LiggJ3dwYmNfYmZiX2ZpZWxkX2NhcHRjaGEnLCAnQ29yZSByZWdpc3RyeS9iYXNlIG1pc3NpbmcnICk7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBSZW5kZXJlciBmb3IgXCJjYXB0Y2hhXCIgZmllbGQgKHRlbXBsYXRlLWRyaXZlbikuXHJcblx0ICogTWV0aG9kcy9uYW1lcyBhcmUgaW4gc25ha2VfY2FzZSB0byBmb2xsb3cgcHJvamVjdCBjb252ZW50aW9ucy5cclxuXHQgKi9cclxuXHRjbGFzcyB3cGJjX2JmYl9maWVsZF9jYXB0Y2hhIGV4dGVuZHMgQmFzZSB7XHJcblxyXG5cdFx0LyoqIFRlbXBsYXRlIGlkIHdpdGhvdXQgXCJ0bXBsLVwiIHByZWZpeC4gKi9cclxuXHRcdHN0YXRpYyB0ZW1wbGF0ZV9pZCA9ICd3cGJjLWJmYi1maWVsZC1jYXB0Y2hhJztcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIERlZmF1bHRzIG11c3Qgc3RheSBpbiBzeW5jIHdpdGggdGhlIFBIUCBzY2hlbWEuXHJcblx0XHQgKiBAcmV0dXJucyB7T2JqZWN0fVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZ2V0X2RlZmF1bHRzKCkge1xyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdHR5cGUgICAgIDogJ2NhcHRjaGEnLFxyXG5cdFx0XHRcdGxhYmVsICAgIDogJ0NBUFRDSEEnLFxyXG5cdFx0XHRcdGh0bWxfaWQgIDogJycsXHJcblx0XHRcdFx0Y3NzY2xhc3MgOiAnJyxcclxuXHRcdFx0XHRoZWxwICAgICA6ICcnXHJcblx0XHRcdH07XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZW5kZXIgdmlhIHdwLnRlbXBsYXRlIGludG8gdGhlIEJ1aWxkZXIgY2FudmFzLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBkYXRhXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjdHhcclxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyByZW5kZXIoIGVsLCBkYXRhLCBjdHggKSB7XHJcblx0XHRcdGlmICggISBlbCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIE5vcm1hbGl6ZSBmaXJzdCAobWlycm9ycyBCYXNlLnJlbmRlcikuXHJcblx0XHRcdHZhciBkID0gdGhpcy5ub3JtYWxpemVfZGF0YSggZGF0YSApO1xyXG5cclxuXHRcdFx0Ly8gU2FuaXRpemUgaGVscGVycyBhdmFpbGFibGUgaW4gY29yZS5cclxuXHRcdFx0dmFyIFMgICAgICAgICA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemUgfHwge307XHJcblx0XHRcdHZhciBodG1sX2lkICAgPSBkLmh0bWxfaWQgPyAoIFMuc2FuaXRpemVfaHRtbF9pZCA/IFMuc2FuaXRpemVfaHRtbF9pZCggU3RyaW5nKCBkLmh0bWxfaWQgKSApIDogU3RyaW5nKCBkLmh0bWxfaWQgKSApIDogJyc7XHJcblx0XHRcdHZhciBjc3NfbmV4dCAgPSBTLnNhbml0aXplX2Nzc19jbGFzc2xpc3QgPyBTLnNhbml0aXplX2Nzc19jbGFzc2xpc3QoIFN0cmluZyggZC5jc3NjbGFzcyB8fCAnJyApICkgOiBTdHJpbmcoIGQuY3NzY2xhc3MgfHwgJycgKTtcclxuXHJcblx0XHRcdC8vIEtlZXAgd3JhcHBlciBkYXRhc2V0IGluIHN5bmMuXHJcblx0XHRcdGlmICggZWwuZGF0YXNldC5odG1sX2lkICE9PSBodG1sX2lkICkgeyBlbC5kYXRhc2V0Lmh0bWxfaWQgPSBodG1sX2lkOyB9XHJcblxyXG5cdFx0XHQvLyBDb21waWxlIHRlbXBsYXRlIHZpYSBCYXNlIChoYW5kbGVzIFwidG1wbC1cIiArIGNhY2hpbmcpLlxyXG5cdFx0XHR2YXIgdHBsID0gdGhpcy5nZXRfdGVtcGxhdGUoIHRoaXMudGVtcGxhdGVfaWQgKTtcclxuXHRcdFx0aWYgKCB0eXBlb2YgdHBsICE9PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdHcuX3dwYmM/LmRldj8uZXJyb3I/LiggJ2NhcHRjaGFfd3B0cGwudHBsLm1pc3NpbmcnLCAnVGVtcGxhdGUgbm90IGZvdW5kOiAnICsgdGhpcy50ZW1wbGF0ZV9pZCApO1xyXG5cdFx0XHRcdGVsLmlubmVySFRNTCA9ICc8ZGl2IGNsYXNzPVwid3BiY19iZmJfX2Vycm9yXCIgcm9sZT1cImFsZXJ0XCI+VGVtcGxhdGUgbm90IGZvdW5kOiB3cGJjLWJmYi1maWVsZC1jYXB0Y2hhLjwvZGl2Pic7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBTdGFibGUgaWQgc3VmZml4IChwcmVmZXIgbm9ybWFsaXplZCBpZCBpZiBwcmVzZW50KS5cclxuXHRcdFx0dmFyIGlkX3N1ZmZpeCA9ICggZC5pZCAhPSBudWxsICkgPyBTdHJpbmcoIGQuaWQgKSA6ICggTWF0aC5yYW5kb20oKS50b1N0cmluZyggMzYgKS5zbGljZSggMiApICk7XHJcblxyXG5cdFx0XHQvLyBMaWdodHdlaWdodCBpbmxpbmUgcGxhY2Vob2xkZXIgKFNWRykgdG8gYXZvaWQgZ2VuZXJhdGluZyByZWFsIGNhcHRjaGEgaW4gQnVpbGRlci5cclxuXHRcdFx0dmFyIHBsYWNlaG9sZGVyX3N2ZyA9ICc8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB3aWR0aD1cIjE2MFwiIGhlaWdodD1cIjQwXCI+PHJlY3Qgd2lkdGg9XCIxMDAlXCIgaGVpZ2h0PVwiMTAwJVwiIGZpbGw9XCIjZjJmMmYyXCIvPjx0ZXh0IHg9XCI1MCVcIiB5PVwiNTAlXCIgZG9taW5hbnQtYmFzZWxpbmU9XCJtaWRkbGVcIiB0ZXh0LWFuY2hvcj1cIm1pZGRsZVwiIGZvbnQtZmFtaWx5PVwibW9ub3NwYWNlXCIgZm9udC1zaXplPVwiMTZcIj5DQVBUQ0hBIENPREU8L3RleHQ+PC9zdmc+JztcclxuXHRcdFx0dmFyIHBsYWNlaG9sZGVyX3NyYyA9ICdkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwnICsgZW5jb2RlVVJJQ29tcG9uZW50KCBwbGFjZWhvbGRlcl9zdmcgKTtcclxuXHRcdFx0dmFyIGFsdF90ZXh0ID0gJ1RFWFQgQ0FQVENIQSc7XHJcblxyXG5cdFx0XHQvLyBSZW5kZXIgdmlhIHRlbXBsYXRlLlxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHZhciB0cGxfZGF0YSA9IE9iamVjdC5hc3NpZ24oIHt9LCBkLCB7XHJcblx0XHRcdFx0XHRodG1sX2lkICAgICAgICA6IGh0bWxfaWQsXHJcblx0XHRcdFx0XHRjc3NjbGFzcyAgICAgICA6IGNzc19uZXh0LFxyXG5cdFx0XHRcdFx0aWQgICAgICAgICAgICAgOiBpZF9zdWZmaXgsXHJcblx0XHRcdFx0XHRwbGFjZWhvbGRlcl9zcmM6IHBsYWNlaG9sZGVyX3NyYyxcclxuXHRcdFx0XHRcdGFsdF90ZXh0ICAgICAgIDogYWx0X3RleHRcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0ZWwuaW5uZXJIVE1MID0gdHBsKCB0cGxfZGF0YSApO1xyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHR3Ll93cGJjPy5kZXY/LmVycm9yPy4oICdjYXB0Y2hhX3dwdHBsLnRwbC5yZW5kZXInLCBlICk7XHJcblx0XHRcdFx0ZWwuaW5uZXJIVE1MID0gJzxkaXYgY2xhc3M9XCJ3cGJjX2JmYl9fZXJyb3JcIiByb2xlPVwiYWxlcnRcIj5FcnJvciByZW5kZXJpbmcgQ0FQVENIQSBwcmV2aWV3LjwvZGl2Pic7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBLZWVwIHdyYXBwZXIgbWV0YSBjb25zaXN0ZW50LlxyXG5cdFx0XHRlbC5kYXRhc2V0LnR5cGUgPSBkLnR5cGUgfHwgJ2NhcHRjaGEnO1xyXG5cdFx0XHRlbC5zZXRBdHRyaWJ1dGUoICdkYXRhLWxhYmVsJywgKCBkLmxhYmVsICE9IG51bGwgPyBTdHJpbmcoIGQubGFiZWwgKSA6ICcnICkgKTtcclxuXHJcblx0XHRcdC8vIE92ZXJsYXkgKGhhbmRsZXMvdG9vbGJhcnMpLlxyXG5cdFx0XHRDb3JlLlVJPy5XUEJDX0JGQl9PdmVybGF5Py5lbnN1cmU/LiggY3R4Py5idWlsZGVyLCBlbCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogT3B0aW9uYWwgaG9vayBhZnRlciBmaWVsZCBkcm9wLiBLZWVwIEJhc2UgbG9naWMgZm9yIGF1dG8tbmFtZXMvaWRzLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGRhdGFcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjdHhcclxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBvbl9maWVsZF9kcm9wKCBkYXRhLCBlbCwgY3R4ICkge1xyXG5cdFx0XHRzdXBlci5vbl9maWVsZF9kcm9wPy4oIGRhdGEsIGVsLCBjdHggKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHRyeSB7XHJcblx0XHRSZWdpc3RyeS5yZWdpc3RlciggJ2NhcHRjaGEnLCB3cGJjX2JmYl9maWVsZF9jYXB0Y2hhICk7XHJcblx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHR3Ll93cGJjPy5kZXY/LmVycm9yPy4oICd3cGJjX2JmYl9maWVsZF9jYXB0Y2hhLnJlZ2lzdGVyJywgZSApO1xyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBFeHBvcnQgZm9yIFwiQm9va2luZyBGb3JtXCIgKEFkdmFuY2VkIEZvcm0gc2hvcnRjb2RlKVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBFeHBvcnQgZm9yIFwiQm9va2luZyBGb3JtXCIgKEFkdmFuY2VkIEZvcm0gc2hvcnRjb2RlKVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0LyoqXHJcblx0ICogQm9va2luZyBGb3JtIGV4cG9ydGVyIGNhbGxiYWNrIChBZHZhbmNlZCBGb3JtIHNob3J0Y29kZSkgZm9yIFwiY2FwdGNoYVwiLlxyXG5cdCAqXHJcblx0ICogVGhpcyBjYWxsYmFjayBpcyByZWdpc3RlcmVkIHBlciBmaWVsZCB0eXBlIHZpYTpcclxuXHQgKiAgIFdQQkNfQkZCX0V4cG9ydGVyLnJlZ2lzdGVyKCAnY2FwdGNoYScsIGNhbGxiYWNrIClcclxuXHQgKlxyXG5cdCAqIENvcmUgY2FsbCBzaXRlIChidWlsZGVyLWV4cG9ydGVyLmpzKTpcclxuXHQgKiAgIFdQQkNfQkZCX0V4cG9ydGVyLnJ1bl9yZWdpc3RlcmVkX2V4cG9ydGVyKCBmaWVsZCwgaW8sIGNmZywgb25jZSwgY3R4IClcclxuXHQgKiAgICAgLT4gY2FsbGJhY2soIGZpZWxkLCBlbWl0LCB7IGlvLCBjZmcsIG9uY2UsIGN0eCwgY29yZSB9ICk7XHJcblx0ICpcclxuXHQgKiBAY2FsbGJhY2sgV1BCQ19CRkJfRXhwb3J0ZXJDYWxsYmFja1xyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgZmllbGRcclxuXHQgKiAgIE5vcm1hbGl6ZWQgZmllbGQgZGF0YSBjb21pbmcgZnJvbSB0aGUgQnVpbGRlciBzdHJ1Y3R1cmUuXHJcblx0ICogICAtIGZpZWxkLnR5cGUgICAgICAgICAge3N0cmluZ30gICBGaWVsZCB0eXBlLCBoZXJlIGFsd2F5cyBcImNhcHRjaGFcIi5cclxuXHQgKiAgIC0gZmllbGQubGFiZWwgICAgICAgICB7c3RyaW5nfSAgIFZpc2libGUgbGFiZWwgaW4gdGhlIGZvcm0gKG1heSBiZSBlbXB0eSkuXHJcblx0ICogICAtIGZpZWxkLmh0bWxfaWQgICAgICAge3N0cmluZ30gICBPcHRpb25hbCBIVE1MIGlkIC8gdXNlci12aXNpYmxlIGlkIChpZ25vcmVkIGhlcmUpLlxyXG5cdCAqICAgLSBmaWVsZC5jc3NjbGFzcyAgICAgIHtzdHJpbmd9ICAgRXh0cmEgQ1NTIGNsYXNzZXMgZW50ZXJlZCBpbiBJbnNwZWN0b3IgKGlnbm9yZWQgaGVyZSkuXHJcblx0ICogICAtIC4uLiAgICAgICAgICAgICAgICAgKEFueSBvdGhlciBwYWNrLXNwZWNpZmljIHByb3BzIGFyZSBhbHNvIHByZXNlbnQuKVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtmdW5jdGlvbihzdHJpbmcpOnZvaWR9IGVtaXRcclxuXHQgKiAgIEVtaXRzIG9uZSBsaW5lL2ZyYWdtZW50IGludG8gdGhlIGV4cG9ydCBidWZmZXIuXHJcblx0ICogICAtIEVhY2ggY2FsbCBjb3JyZXNwb25kcyB0byBvbmUgYHB1c2goKWAgaW4gdGhlIGNvcmUgZXhwb3J0ZXIuXHJcblx0ICogICAtIEZvciBtdWx0aS1saW5lIG91dHB1dCAoZS5nLiBsYWJlbCArIHNob3J0Y29kZSksIGNhbGwgYGVtaXQoKWAgbXVsdGlwbGUgdGltZXM6XHJcblx0ICogICAgICAgZW1pdCgnPGw+TGFiZWw8L2w+Jyk7XHJcblx0ICogICAgICAgZW1pdCgnPGJyPltjYXB0Y2hhXScpO1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IFtleHRyYXNdXHJcblx0ICogICBFeHRyYSBjb250ZXh0IHBhc3NlZCBieSB0aGUgY29yZSBleHBvcnRlci5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBbZXh0cmFzLmlvXVxyXG5cdCAqICAgTG93LWxldmVsIHdyaXRlciB1c2VkIGludGVybmFsbHkgYnkgdGhlIGNvcmUuXHJcblx0ICogICBOb3JtYWxseSB5b3UgZG8gTk9UIG5lZWQgaXQgaW4gcGFja3Mg4oCUIHByZWZlciBgZW1pdCgpYC5cclxuXHQgKiAgIC0gZXh0cmFzLmlvLm9wZW4oc3RyKSAgIC0+IG9wZW4gYSBuZXN0ZWQgYmxvY2sgKGluY3JlbWVudHMgaW5kZW50YXRpb24pLlxyXG5cdCAqICAgLSBleHRyYXMuaW8uY2xvc2Uoc3RyKSAgLT4gY2xvc2UgYSBibG9jayAoZGVjcmVtZW50cyBpbmRlbnRhdGlvbikuXHJcblx0ICogICAtIGV4dHJhcy5pby5wdXNoKHN0cikgICAtPiBwdXNoIHJhdyBsaW5lICh1c2VkIGJ5IGBlbWl0KClgKS5cclxuXHQgKiAgIC0gZXh0cmFzLmlvLmJsYW5rKCkgICAgIC0+IHB1c2ggYW4gZW1wdHkgbGluZS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBbZXh0cmFzLmNmZ11cclxuXHQgKiAgIEV4cG9ydCBjb25maWd1cmF0aW9uIChzYW1lIG9iamVjdCBwYXNzZWQgdG8gV1BCQ19CRkJfRXhwb3J0ZXIuZXhwb3J0X2Zvcm0oKSkuXHJcblx0ICogICBVc2VmdWwgZmxhZ3MgZm9yIGZpZWxkIHBhY2tzOlxyXG5cdCAqICAgLSBleHRyYXMuY2ZnLmFkZExhYmVscyB7Ym9vbGVhbn0gIERlZmF1bHQ6IHRydWUuXHJcblx0ICogICAgICAgSWYgZmFsc2UsIHBhY2tzIHNob3VsZCBOT1QgZW1pdCA8bD5MYWJlbDwvbD4gbGluZXMuXHJcblx0ICogICAtIGV4dHJhcy5jZmcubmV3bGluZSAgIHtzdHJpbmd9ICAgTmV3bGluZSBzZXBhcmF0b3IgKHVzdWFsbHkgXCJcXG5cIikuXHJcblx0ICogICAtIGV4dHJhcy5jZmcuZ2FwUGVyY2VudHtudW1iZXJ9ICAgTGF5b3V0IGdhcCAodXNlZCBvbmx5IGJ5IHNlY3Rpb24vY29sdW1uIGxvZ2ljKS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBbZXh0cmFzLm9uY2VdXHJcblx0ICogICBTaGFyZWQgXCJvbmNlLXBlci1mb3JtXCIgZ3VhcmRzIGFjcm9zcyBhbGwgZmllbGRzLlxyXG5cdCAqICAgQ2FwdGNoYSBpcyBhIHR5cGljYWwgb25jZS1wZXItZm9ybSBmaWVsZDpcclxuXHQgKiAgIC0gZXh0cmFzLm9uY2UuY2FwdGNoYSB7bnVtYmVyfSAgIENvdW50ZXIgb2YgZXhwb3J0ZWQgY2FwdGNoYXMuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gW2V4dHJhcy5jdHhdXHJcblx0ICogICBTaGFyZWQgZXhwb3J0IGNvbnRleHQgZm9yIHRoZSBlbnRpcmUgZm9ybSAobm90IHVzZWQgaGVyZSkuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gW2V4dHJhcy5jb3JlXVxyXG5cdCAqICAgUmVmZXJlbmNlIHRvIFdQQkNfQkZCX0NvcmUgcGFzc2VkIGZyb20gYnVpbGRlci1leHBvcnRlci5qcy5cclxuXHQgKiAgIFByaW1hcmlseSB1c2VkIHRvIGFjY2VzcyBzYW5pdGl6ZXJzOlxyXG5cdCAqICAgLSBleHRyYXMuY29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5lc2NhcGVfaHRtbCguLi4pXHJcblx0ICogICAtIGV0Yy5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiByZWdpc3Rlcl9jYXB0Y2hhX2Jvb2tpbmdfZm9ybV9leHBvcnRlcigpIHtcclxuXHJcblx0XHRjb25zdCBFeHAgPSB3LldQQkNfQkZCX0V4cG9ydGVyO1xyXG5cdFx0aWYgKCAhIEV4cCB8fCB0eXBlb2YgRXhwLnJlZ2lzdGVyICE9PSAnZnVuY3Rpb24nICkgeyByZXR1cm47IH1cclxuXHRcdGlmICggdHlwZW9mIEV4cC5oYXNfZXhwb3J0ZXIgPT09ICdmdW5jdGlvbicgJiYgRXhwLmhhc19leHBvcnRlciggJ2NhcHRjaGEnICkgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdGNvbnN0IFMgICA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemUgfHwgKHcuV1BCQ19CRkJfQ29yZSAmJiB3LldQQkNfQkZCX0NvcmUuV1BCQ19CRkJfU2FuaXRpemUpIHx8IHt9O1xyXG5cdFx0Y29uc3QgZXNjID0gUy5lc2NhcGVfaHRtbCB8fCAodiA9PiBTdHJpbmcoIHYgKSk7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBAdHlwZSB7V1BCQ19CRkJfRXhwb3J0ZXJDYWxsYmFja31cclxuXHRcdCAqL1xyXG5cdFx0RXhwLnJlZ2lzdGVyKCAnY2FwdGNoYScsIChmaWVsZCwgZW1pdCwgZXh0cmFzID0ge30pID0+IHtcclxuXHJcblx0XHRcdGNvbnN0IGNmZyAgICAgICA9IGV4dHJhcy5jZmcgfHwge307XHJcblx0XHRcdGNvbnN0IGFkZExhYmVscyA9IGNmZy5hZGRMYWJlbHMgIT09IGZhbHNlO1xyXG5cdFx0XHRjb25zdCBvbmNlICAgICAgPSAoZXh0cmFzLm9uY2UgJiYgdHlwZW9mIGV4dHJhcy5vbmNlID09PSAnb2JqZWN0JykgPyBleHRyYXMub25jZSA6IG51bGw7XHJcblxyXG5cdFx0XHQvLyBPbmNlLXBlci1mb3JtIGd1YXJkOiBvbmx5IHRoZSBmaXJzdCBbY2FwdGNoYV0gaXMgZXhwb3J0ZWQuXHJcblx0XHRcdGlmICggb25jZSApIHtcclxuXHRcdFx0XHRvbmNlLmNhcHRjaGEgPSAob25jZS5jYXB0Y2hhIHx8IDApICsgMTtcclxuXHRcdFx0XHRpZiAoIG9uY2UuY2FwdGNoYSA+IDEgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBCb2R5IGlzIGZpeGVkIGZvciB0aGlzIHBhY2suXHJcblx0XHRcdGNvbnN0IGJvZHkgPSAnW2NhcHRjaGFdJztcclxuXHJcblx0XHRcdC8vIExhYmVsIGJlaGF2aW9yIGlkZW50aWNhbCB0byBsZWdhY3kgZW1pdF9sYWJlbF90aGVuKCdbY2FwdGNoYV0nKS5cclxuXHRcdFx0Y29uc3QgcmF3X2xhYmVsID0gKGZpZWxkICYmIHR5cGVvZiBmaWVsZC5sYWJlbCA9PT0gJ3N0cmluZycpID8gZmllbGQubGFiZWwgOiAnJztcclxuXHRcdFx0Y29uc3QgbGFiZWwgICAgID0gcmF3X2xhYmVsLnRyaW0oKTtcclxuXHJcblx0XHRcdGlmICggbGFiZWwgJiYgYWRkTGFiZWxzICkge1xyXG5cdFx0XHRcdGVtaXQoIGA8bD4ke2VzYyggbGFiZWwgKX08L2w+YCApO1xyXG5cdFx0XHRcdGVtaXQoIGA8YnI+JHtib2R5fWAgKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRlbWl0KCBib2R5ICk7XHJcblx0XHRcdH1cclxuXHRcdFx0Ly8gSGVscCB0ZXh0IGlzIGFwcGVuZGVkIGNlbnRyYWxseSBieSBXUEJDX0JGQl9FeHBvcnRlci5yZW5kZXJfZmllbGRfbm9kZSgpLlxyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0Ly8gVHJ5IGltbWVkaWF0ZSByZWdpc3RyYXRpb247IGlmIGNvcmUgaXNu4oCZdCByZWFkeSwgd2FpdCBmb3IgdGhlIGV2ZW50LlxyXG5cdGlmICggdy5XUEJDX0JGQl9FeHBvcnRlciAmJiB0eXBlb2Ygdy5XUEJDX0JGQl9FeHBvcnRlci5yZWdpc3RlciA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdHJlZ2lzdGVyX2NhcHRjaGFfYm9va2luZ19mb3JtX2V4cG9ydGVyKCk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOmJmYjpleHBvcnRlci1yZWFkeScsIHJlZ2lzdGVyX2NhcHRjaGFfYm9va2luZ19mb3JtX2V4cG9ydGVyLCB7IG9uY2U6IHRydWUgfSApO1xyXG5cdH1cclxuXHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRXhwb3J0IGZvciBcIkJvb2tpbmcgRGF0YVwiIChDb250ZW50IG9mIGJvb2tpbmcgZmllbGRzIGRhdGEpXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvKipcclxuXHQgKiBCb29raW5nIERhdGEgZXhwb3J0ZXIgY2FsbGJhY2sgKFwiQ29udGVudCBvZiBib29raW5nIGZpZWxkcyBkYXRhXCIpIGZvciBcImNhcHRjaGFcIi5cclxuXHQgKlxyXG5cdCAqIFRoaXMgZmllbGQgZG9lcyBOT1QgY29udHJpYnV0ZSBhbnkgY29udGVudCB0byB0aGUgXCJDb250ZW50IG9mIGJvb2tpbmcgZmllbGRzIGRhdGFcIlxyXG5cdCAqIHRlbXBsYXRlLCBidXQgd2Ugc3RpbGwgcmVnaXN0ZXIgYW4gZXhwbGljaXQgZXhwb3J0ZXIgdGhhdCBlbWl0cyBhbiBlbXB0eSBzdHJpbmdcclxuXHQgKiBmb3IgY29uc2lzdGVuY3kgYW5kIGludHJvc3BlY3Rpb24uXHJcblx0ICpcclxuXHQgKiBSZWdpc3RlcmVkIHBlciBmaWVsZCB0eXBlIHZpYTpcclxuXHQgKiAgIFdQQkNfQkZCX0NvbnRlbnRFeHBvcnRlci5yZWdpc3RlciggJ2NhcHRjaGEnLCBjYWxsYmFjayApXHJcblx0ICpcclxuXHQgKiBDb3JlIGNhbGwgc2l0ZSAoYnVpbGRlci1leHBvcnRlci5qcyk6XHJcblx0ICogICBXUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIucnVuX3JlZ2lzdGVyZWRfZXhwb3J0ZXIoIGZpZWxkLCBlbWl0LCB7IGNmZywgY29yZSB9ICk7XHJcblx0ICpcclxuXHQgKiBAY2FsbGJhY2sgV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyQ2FsbGJhY2tcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gIGZpZWxkICAgTm9ybWFsaXplZCBmaWVsZCBkYXRhIChub3QgdXNlZCBoZXJlKS5cclxuXHQgKiBAcGFyYW0ge2Z1bmN0aW9uKHN0cmluZyk6dm9pZH0gZW1pdFxyXG5cdCAqICAgRW1pdHMgYSByYXcgSFRNTCBmcmFnbWVudCBpbnRvIHRoZSBcIkNvbnRlbnQgb2YgYm9va2luZyBmaWVsZHMgZGF0YVwiIHRlbXBsYXRlLlxyXG5cdCAqICAgSGVyZSB3ZSBleHBsaWNpdGx5IGVtaXQgYW4gZW1wdHkgc3RyaW5nLlxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgW2V4dHJhc10gIEFkZGl0aW9uYWwgY29udGV4dCAodW51c2VkKS5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiByZWdpc3Rlcl9jYXB0Y2hhX2Jvb2tpbmdfZGF0YV9leHBvcnRlcigpIHtcclxuXHJcblx0XHRjb25zdCBDID0gdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXI7XHJcblx0XHRpZiAoICEgQyB8fCB0eXBlb2YgQy5yZWdpc3RlciAhPT0gJ2Z1bmN0aW9uJyApIHsgcmV0dXJuOyB9XHJcblx0XHRpZiAoIHR5cGVvZiBDLmhhc19leHBvcnRlciA9PT0gJ2Z1bmN0aW9uJyAmJiBDLmhhc19leHBvcnRlciggJ2NhcHRjaGEnICkgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdEMucmVnaXN0ZXIoICdjYXB0Y2hhJywgZnVuY3Rpb24gKGZpZWxkLCBlbWl0LCBleHRyYXMpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bnVzZWQtdmFyc1xyXG5cdFx0XHQvLyBFeHBsaWNpdGx5IGV4cG9ydCBhbiBlbXB0eSBzdHJpbmcgZm9yIGNhcHRjaGEgaW4gXCJDb250ZW50IG9mIGJvb2tpbmcgZmllbGRzIGRhdGFcIi5cclxuXHRcdFx0Ly9lbWl0KCAnJyApO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0aWYgKCB3LldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciAmJiB0eXBlb2Ygdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIucmVnaXN0ZXIgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRyZWdpc3Rlcl9jYXB0Y2hhX2Jvb2tpbmdfZGF0YV9leHBvcnRlcigpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzpiZmI6Y29udGVudC1leHBvcnRlci1yZWFkeScsIHJlZ2lzdGVyX2NhcHRjaGFfYm9va2luZ19kYXRhX2V4cG9ydGVyLCB7IG9uY2U6IHRydWUgfSApO1xyXG5cdH1cclxuXHJcbn0pKCB3aW5kb3cgKTtcclxuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDLFVBQVVBLENBQUMsRUFBRTtFQUNiLFlBQVk7O0VBRVosSUFBSUMsSUFBSSxHQUFPRCxDQUFDLENBQUNFLGFBQWEsSUFBSSxDQUFDLENBQUM7RUFDcEMsSUFBSUMsUUFBUSxHQUFHRixJQUFJLENBQUNHLGdDQUFnQztFQUNwRCxJQUFJQyxJQUFJLEdBQU9KLElBQUksQ0FBQ0ssbUJBQW1CO0VBRXZDLElBQUssQ0FBRUgsUUFBUSxJQUFJLE9BQU9BLFFBQVEsQ0FBQ0ksUUFBUSxLQUFLLFVBQVUsSUFBSSxDQUFFRixJQUFJLEVBQUc7SUFDdEVMLENBQUMsQ0FBQ1EsS0FBSyxFQUFFQyxHQUFHLEVBQUVDLEtBQUssR0FBSSx3QkFBd0IsRUFBRSw0QkFBNkIsQ0FBQztJQUMvRTtFQUNEOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0VBQ0MsTUFBTUMsc0JBQXNCLFNBQVNOLElBQUksQ0FBQztJQUV6QztJQUNBLE9BQU9PLFdBQVcsR0FBRyx3QkFBd0I7O0lBRTdDO0FBQ0Y7QUFDQTtBQUNBO0lBQ0UsT0FBT0MsWUFBWUEsQ0FBQSxFQUFHO01BQ3JCLE9BQU87UUFDTkMsSUFBSSxFQUFPLFNBQVM7UUFDcEJDLEtBQUssRUFBTSxTQUFTO1FBQ3BCQyxPQUFPLEVBQUksRUFBRTtRQUNiQyxR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
