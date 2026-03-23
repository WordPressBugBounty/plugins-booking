"use strict";

// ---------------------------------------------------------------------------------------------------------------------
// == File  /includes/page-form-builder/field-packs/email/_out/field-email-wptpl.js
// == Pack  Email (WP-template–driven) — Builder-focused renderer + optional exporter hook
// == Compatible with PHP pack: ../field-email-wptpl.php (version 1.0.0)
// ---------------------------------------------------------------------------------------------------------------------
(function (w) {
  'use strict';

  var Core = w.WPBC_BFB_Core || {};
  var Registry = Core.WPBC_BFB_Field_Renderer_Registry;
  var Base = Core.WPBC_BFB_Field_Base;
  if (!Registry || typeof Registry.register !== 'function' || !Base) {
    w._wpbc && w._wpbc.dev && w._wpbc.dev.error && w._wpbc.dev.error('wpbc_bfb_field_email', 'Core registry/base missing');
    return;
  }

  /**
   * WPBC_BFB: Email field renderer (template-driven).
   * Uses wp.template('wpbc-bfb-field-email') for preview and 'wpbc-bfb-inspector-email' for Inspector.
   */
  const wpbc_bfb_field_email = class extends Base {
    /** Template id without the "tmpl-" prefix (Base normalizes/caches it). */
    static template_id = 'wpbc-bfb-field-email';

    /** Defaults must mirror the PHP schema. */
    static get_defaults() {
      return {
        type: 'email',
        label: 'Email',
        name: 'email',
        help: 'Enter your email address.',
        html_id: '',
        placeholder: '',
        required: true,
        // minlength    : null,
        // maxlength    : null,
        cssclass: '',
        default_value: '',
        readonly: true
      };
    }

    /**
     * Render field preview via wp.template.
     *
     * @param {HTMLElement} el
     * @param {Object}      data
     * @param {Object}      ctx
     */
    static render(el, data, ctx) {
      if (!el) {
        return;
      }
      const d = this.normalize_data(data);
      const S = Core.WPBC_BFB_Sanitize;

      // Sanitize ids/names/classes.
      const html_id = d.html_id ? S.sanitize_html_id(String(d.html_id)) : '';
      const name_raw = String(d.name || d.id || 'email');
      const name = S.sanitize_html_name(name_raw);
      const cls_next = S.sanitize_css_classlist(String(d.cssclass || ''));

      // Keep wrapper dataset consistent.
      if (el.dataset.html_id !== html_id) {
        el.dataset.html_id = html_id;
      }
      if (el.dataset.cssclass !== cls_next) {
        el.dataset.cssclass = cls_next;
      }
      el.dataset.required = 'true'; // persist the forced value for saving/serialization

      // Compile template.
      const tpl = this.get_template(this.template_id);
      if (typeof tpl !== 'function') {
        w._wpbc && w._wpbc.dev && w._wpbc.dev.error && w._wpbc.dev.error('email_wptpl.tpl.missing', 'Template not found: ' + this.template_id);
        el.innerHTML = '<div class="wpbc_bfb__error" role="alert">Template not found: wpbc-bfb-field-email.</div>';
        return;
      }
      try {
        const tpl_data = {
          ...d,
          name,
          html_id,
          cssclass: cls_next,
          default_value: d.default_value ?? ''
        };
        el.innerHTML = tpl(tpl_data);
      } catch (e) {
        w._wpbc && w._wpbc.dev && w._wpbc.dev.error && w._wpbc.dev.error('email_wptpl.tpl.render', e);
        el.innerHTML = '<div class="wpbc_bfb__error" role="alert">Error rendering Email field preview.</div>';
        return;
      }

      // Wrapper meta.
      el.dataset.type = d.type || 'email';
      el.setAttribute('data-label', d.label != null ? String(d.label) : '');

      // Normalize attributes on the input (quotes/newlines).
      const input = el.querySelector('input[type="email"]');
      if (input) {
        if (d.placeholder != null) input.setAttribute('placeholder', String(d.placeholder));
      }

      // Overlay (handles/toolbars, selection).
      Core.UI && Core.UI.WPBC_BFB_Overlay && Core.UI.WPBC_BFB_Overlay.ensure && Core.UI.WPBC_BFB_Overlay.ensure(ctx?.builder, el);
    }

    /**
     * Optional hook executed after field is dropped from the palette.
     * Ensures base behavior (auto-name from label etc.).
     *
     * @param {Object}      data
     * @param {HTMLElement} el
     * @param {Object}      ctx
     */
    static on_field_drop(data, el, ctx) {
      super.on_field_drop && super.on_field_drop(data, el, ctx);

      // Lock the "email" field name and disable future auto-naming from label.
      try {
        if (!el) {
          return;
        }
        el.dataset.type = 'email';
        el.dataset.name = 'email';
        el.dataset.autoname = '0'; // ← stop label->name syncing
        el.dataset.fresh = '0'; // ← kill “fresh” auto-name path
        el.dataset.name_user_touched = '1'; // ← treat as user-set

        // Keep the inner input in sync immediately.
        const input = el.querySelector('input[type="email"]');
        if (input) {
          input.setAttribute('name', 'email');
        }
        // If Inspector is open, reflect & visually lock the Name control.
        const ins = document.getElementById('wpbc_bfb__inspector');
        const nameCtrl = ins && ins.querySelector('[data-inspector-key="name"]');
        if (nameCtrl) {
          nameCtrl.value = 'email';
          nameCtrl.readOnly = true;
          nameCtrl.setAttribute('aria-readonly', 'true');
          nameCtrl.classList.add('inspector__input--readonly');
        }
      } catch (_) {}

      // Ensure the dropped element starts in the required state.
      if (el) {
        el.setAttribute('data-required', 'true');
      }
    }
  };

  // Register in the Field Renderer Registry.
  try {
    Registry.register('email', wpbc_bfb_field_email);
  } catch (e) {
    w._wpbc && w._wpbc.dev && w._wpbc.dev.error && w._wpbc.dev.error('wpbc_bfb_field_email.register', e);
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Form" (Advanced Form shortcode)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Booking Form exporter callback (Advanced Form shortcode) for "email".
   *
   * Registered per field type via:
   *   WPBC_BFB_Exporter.register( 'email', callback )
   *
   * Core call site (builder-exporter.js):
   *   WPBC_BFB_Exporter.run_registered_exporter( field, io, cfg, once, ctx ) -> callback( field, emit, { io, cfg, once, ctx, core } );
   *
   * The callback:
   *   - Computes the final name via Exp.compute_name('email', field)
   *   - Uses shared helpers for id/class/placeholder/size/default
   *   - Emits a shortcode like:
   *       [email* email 40/255 id:someID class:someCSSclass placeholder:"..." "default@domain.com"]
   *
   * Help text is appended centrally by WPBC_BFB_Exporter.render_field_node().
   */
  function register_email_booking_form_exporter() {
    const Exp = w.WPBC_BFB_Exporter;
    if (!Exp || typeof Exp.register !== 'function') {
      return false;
    }
    if (typeof Exp.has_exporter === 'function' && Exp.has_exporter('email')) {
      return true;
    }
    const S = Core.WPBC_BFB_Sanitize || w.WPBC_BFB_Core && w.WPBC_BFB_Core.WPBC_BFB_Sanitize || {};
    const esc = S.escape_html || (v => String(v));

    /**
     * @type {(field:Object, emit:(code:string)=>void, extras?:{io?:any,cfg?:any,once?:any,ctx?:any,core?:any})=>void}
     */
    Exp.register('email', (field, emit, extras = {}) => {
      const cfg = extras.cfg || {};
      const ctx = extras.ctx;
      const addLabels = cfg.addLabels !== false;
      const is_req = Exp.is_required(field);
      const req_mark = is_req ? '*' : '';
      const name = Exp.compute_name('email', field);
      const id_opt = Exp.id_option(field, ctx);
      const cls_opts = Exp.class_options(field);
      const ph_attr = Exp.ph_attr(field.placeholder);
      const size_max = Exp.size_max_token(field);
      const def_value = Exp.default_text_suffix(field);

      // Final shortcode body:
      // [email${req_mark} ${name}${size_max}${id_opt}${cls_opts}${ph_attr}${def_value}]
      const body = `[email${req_mark} ${name}${size_max}${id_opt}${cls_opts}${ph_attr}${def_value}]`;
      const raw_label = field && typeof field.label === 'string' ? field.label : '';
      const label = raw_label.trim();
      if (label && addLabels) {
        emit(`<l>${esc(label)}${req_mark}</l>`);
        emit(`<br>${body}`);
      } else {
        emit(body);
      }
    });
    return true;
  }

  // Try immediate registration; if exporter isn't ready yet, wait for the one-shot event.
  if (!register_email_booking_form_exporter()) {
    document.addEventListener('wpbc:bfb:exporter-ready', register_email_booking_form_exporter, {
      once: true
    });
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Data" (Content of booking fields data)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Booking Data exporter callback for "email" ("Content of booking fields data").
   * Default output: <b>Label</b>: <f>[field_name]</f><br>
   *
   * Registered via:
   *   WPBC_BFB_ContentExporter.register( 'email', callback )
   *
   * Core call site (builder-exporter.js):
   *   WPBC_BFB_ContentExporter.run_registered_exporter( field, emit, { cfg, core } );
   */
  function register_email_booking_data_exporter() {
    const C = w.WPBC_BFB_ContentExporter;
    if (!C || typeof C.register !== 'function') {
      return false;
    }
    if (typeof C.has_exporter === 'function' && C.has_exporter('email')) {
      return true;
    }
    C.register('email', function (field, emit, extras) {
      extras = extras || {};
      const cfg = extras.cfg || {};
      const Exp = w.WPBC_BFB_Exporter;
      if (!Exp || typeof Exp.compute_name !== 'function') {
        return;
      }
      const name = Exp.compute_name('email', field);
      if (!name) {
        return;
      }
      let label;
      if (typeof field.label === 'string' && field.label.trim()) {
        label = field.label.trim();
      } else {
        label = 'Email';
      }

      // Shared formatter keeps all packs consistent.
      C.emit_line_bold_field(emit, label, name, cfg);

      // Fallback - is the reference for other field packs.
      if (0) {
        // Defensive fallback: simple, backward-compatible output.
        const core_local = Core || {};
        const S_local = core_local.WPBC_BFB_Sanitize || {};
        const esc_local = S_local.escape_html || (s => String(s));
        const sep = cfg && typeof cfg.sep === 'string' ? cfg.sep : ': ';
        const title = label ? `<b>${esc_local(label)}</b>${sep}` : '';
        emit(`${title}<f>[${name}]</f><br>`);
      }
    });
    return true;
  }
  if (!register_email_booking_data_exporter()) {
    document.addEventListener('wpbc:bfb:content-exporter-ready', register_email_booking_data_exporter, {
      once: true
    });
  }
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvZW1haWwvX291dC9maWVsZC1lbWFpbC13cHRwbC5qcyIsIm5hbWVzIjpbInciLCJDb3JlIiwiV1BCQ19CRkJfQ29yZSIsIlJlZ2lzdHJ5IiwiV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnkiLCJCYXNlIiwiV1BCQ19CRkJfRmllbGRfQmFzZSIsInJlZ2lzdGVyIiwiX3dwYmMiLCJkZXYiLCJlcnJvciIsIndwYmNfYmZiX2ZpZWxkX2VtYWlsIiwidGVtcGxhdGVfaWQiLCJnZXRfZGVmYXVsdHMiLCJ0eXBlIiwibGFiZWwiLCJuYW1lIiwiaGVscCIsImh0bWxfaWQiLCJwbGFjZWhvbGRlciIsInJlcXVpcmVkIiwiY3NzY2xhc3MiLCJkZWZhdWx0X3ZhbHVlIiwicmVhZG9ubHkiLCJyZW5kZXIiLCJlbCIsImRhdGEiLCJjdHgiLCJkIiwibm9ybWFsaXplX2RhdGEiLCJTIiwiV1BCQ19CRkJfU2FuaXRpemUiLCJzYW5pdGl6ZV9odG1sX2lkIiwiU3RyaW5nIiwibmFtZV9yYXciLCJpZCIsInNhbml0aXplX2h0bWxfbmFtZSIsImNsc19uZXh0Iiwic2FuaXRpemVfY3NzX2NsYXNzbGlzdCIsImRhdGFzZXQiLCJ0cGwiLCJnZXRfdGVtcGxhdGUiLCJpbm5lckhUTUwiLCJ0cGxfZGF0YSIsImUiLCJzZXRBdHRyaWJ1dGUiLCJpbnB1dCIsInF1ZXJ5U2VsZWN0b3IiLCJVSSIsIldQQkNfQkZCX092ZXJsYXkiLCJlbnN1cmUiLCJidWlsZGVyIiwib25fZmllbGRfZHJvcCIsImF1dG9uYW1lIiwiZnJlc2giLCJuYW1lX3VzZXJfdG91Y2hlZCIsImlucyIsImRvY3VtZW50IiwiZ2V0RWxlbWVudEJ5SWQiLCJuYW1lQ3RybCIsInZhbHVlIiwicmVhZE9ubHkiLCJjbGFzc0xpc3QiLCJhZGQiLCJfIiwicmVnaXN0ZXJfZW1haWxfYm9va2luZ19mb3JtX2V4cG9ydGVyIiwiRXhwIiwiV1BCQ19CRkJfRXhwb3J0ZXIiLCJoYXNfZXhwb3J0ZXIiLCJlc2MiLCJlc2NhcGVfaHRtbCIsInYiLCJmaWVsZCIsImVtaXQiLCJleHRyYXMiLCJjZmciLCJhZGRMYWJlbHMiLCJpc19yZXEiLCJpc19yZXF1aXJlZCIsInJlcV9tYXJrIiwiY29tcHV0ZV9uYW1lIiwiaWRfb3B0IiwiaWRfb3B0aW9uIiwiY2xzX29wdHMiLCJjbGFzc19vcHRpb25zIiwicGhfYXR0ciIsInNpemVfbWF4Iiwic2l6ZV9tYXhfdG9rZW4iLCJkZWZfdmFsdWUiLCJkZWZhdWx0X3RleHRfc3VmZml4IiwiYm9keSIsInJhd19sYWJlbCIsInRyaW0iLCJhZGRFdmVudExpc3RlbmVyIiwib25jZSIsInJlZ2lzdGVyX2VtYWlsX2Jvb2tpbmdfZGF0YV9leHBvcnRlciIsIkMiLCJXUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIiLCJlbWl0X2xpbmVfYm9sZF9maWVsZCIsImNvcmVfbG9jYWwiLCJTX2xvY2FsIiwiZXNjX2xvY2FsIiwicyIsInNlcCIsInRpdGxlIiwid2luZG93Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvZW1haWwvX3NyYy9maWVsZC1lbWFpbC13cHRwbC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLy8gPT0gRmlsZSAgL2luY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2ZpZWxkLXBhY2tzL2VtYWlsL19vdXQvZmllbGQtZW1haWwtd3B0cGwuanNcclxuLy8gPT0gUGFjayAgRW1haWwgKFdQLXRlbXBsYXRl4oCTZHJpdmVuKSDigJQgQnVpbGRlci1mb2N1c2VkIHJlbmRlcmVyICsgb3B0aW9uYWwgZXhwb3J0ZXIgaG9va1xyXG4vLyA9PSBDb21wYXRpYmxlIHdpdGggUEhQIHBhY2s6IC4uL2ZpZWxkLWVtYWlsLXdwdHBsLnBocCAodmVyc2lvbiAxLjAuMClcclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbihmdW5jdGlvbiAodykge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0dmFyIENvcmUgICAgID0gdy5XUEJDX0JGQl9Db3JlIHx8IHt9O1xyXG5cdHZhciBSZWdpc3RyeSA9IENvcmUuV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnk7XHJcblx0dmFyIEJhc2UgICAgID0gQ29yZS5XUEJDX0JGQl9GaWVsZF9CYXNlO1xyXG5cclxuXHRpZiAoICFSZWdpc3RyeSB8fCB0eXBlb2YgUmVnaXN0cnkucmVnaXN0ZXIgIT09ICdmdW5jdGlvbicgfHwgIUJhc2UgKSB7XHJcblx0XHQody5fd3BiYyAmJiB3Ll93cGJjLmRldiAmJiB3Ll93cGJjLmRldi5lcnJvcikgJiYgdy5fd3BiYy5kZXYuZXJyb3IoICd3cGJjX2JmYl9maWVsZF9lbWFpbCcsICdDb3JlIHJlZ2lzdHJ5L2Jhc2UgbWlzc2luZycgKTtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFdQQkNfQkZCOiBFbWFpbCBmaWVsZCByZW5kZXJlciAodGVtcGxhdGUtZHJpdmVuKS5cclxuXHQgKiBVc2VzIHdwLnRlbXBsYXRlKCd3cGJjLWJmYi1maWVsZC1lbWFpbCcpIGZvciBwcmV2aWV3IGFuZCAnd3BiYy1iZmItaW5zcGVjdG9yLWVtYWlsJyBmb3IgSW5zcGVjdG9yLlxyXG5cdCAqL1xyXG5cdGNvbnN0IHdwYmNfYmZiX2ZpZWxkX2VtYWlsID0gY2xhc3MgZXh0ZW5kcyBCYXNlIHtcclxuXHJcblx0XHQvKiogVGVtcGxhdGUgaWQgd2l0aG91dCB0aGUgXCJ0bXBsLVwiIHByZWZpeCAoQmFzZSBub3JtYWxpemVzL2NhY2hlcyBpdCkuICovXHJcblx0XHRzdGF0aWMgdGVtcGxhdGVfaWQgPSAnd3BiYy1iZmItZmllbGQtZW1haWwnO1xyXG5cclxuXHRcdC8qKiBEZWZhdWx0cyBtdXN0IG1pcnJvciB0aGUgUEhQIHNjaGVtYS4gKi9cclxuXHRcdHN0YXRpYyBnZXRfZGVmYXVsdHMoKSB7XHJcblx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0dHlwZSAgICAgICA6ICdlbWFpbCcsXHJcblx0XHRcdFx0bGFiZWwgICAgICA6ICdFbWFpbCcsXHJcblx0XHRcdFx0bmFtZSAgICAgICA6ICdlbWFpbCcsXHJcblx0XHRcdFx0aGVscCAgICAgICA6ICdFbnRlciB5b3VyIGVtYWlsIGFkZHJlc3MuJyxcclxuXHRcdFx0XHRodG1sX2lkICAgIDogJycsXHJcblx0XHRcdFx0cGxhY2Vob2xkZXI6ICcnLFxyXG5cdFx0XHRcdHJlcXVpcmVkICAgOiB0cnVlLFxyXG5cdFx0XHRcdC8vIG1pbmxlbmd0aCAgICA6IG51bGwsXHJcblx0XHRcdFx0Ly8gbWF4bGVuZ3RoICAgIDogbnVsbCxcclxuXHRcdFx0XHRjc3NjbGFzcyAgICAgOiAnJyxcclxuXHRcdFx0XHRkZWZhdWx0X3ZhbHVlOiAnJyxcclxuXHRcdFx0XHRyZWFkb25seSAgICAgOiB0cnVlLFxyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVuZGVyIGZpZWxkIHByZXZpZXcgdmlhIHdwLnRlbXBsYXRlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBkYXRhXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjdHhcclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHJlbmRlcihlbCwgZGF0YSwgY3R4KSB7XHJcblx0XHRcdGlmICggIWVsICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgZCA9IHRoaXMubm9ybWFsaXplX2RhdGEoIGRhdGEgKTtcclxuXHRcdFx0Y29uc3QgUyA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemU7XHJcblxyXG5cdFx0XHQvLyBTYW5pdGl6ZSBpZHMvbmFtZXMvY2xhc3Nlcy5cclxuXHRcdFx0Y29uc3QgaHRtbF9pZCAgPSBkLmh0bWxfaWQgPyBTLnNhbml0aXplX2h0bWxfaWQoIFN0cmluZyggZC5odG1sX2lkICkgKSA6ICcnO1xyXG5cdFx0XHRjb25zdCBuYW1lX3JhdyA9IFN0cmluZyggZC5uYW1lIHx8IGQuaWQgfHwgJ2VtYWlsJyApO1xyXG5cdFx0XHRjb25zdCBuYW1lICAgICA9IFMuc2FuaXRpemVfaHRtbF9uYW1lKCBuYW1lX3JhdyApO1xyXG5cdFx0XHRjb25zdCBjbHNfbmV4dCA9IFMuc2FuaXRpemVfY3NzX2NsYXNzbGlzdCggU3RyaW5nKCBkLmNzc2NsYXNzIHx8ICcnICkgKTtcclxuXHJcblx0XHRcdC8vIEtlZXAgd3JhcHBlciBkYXRhc2V0IGNvbnNpc3RlbnQuXHJcblx0XHRcdGlmICggZWwuZGF0YXNldC5odG1sX2lkICE9PSBodG1sX2lkICkge1xyXG5cdFx0XHRcdGVsLmRhdGFzZXQuaHRtbF9pZCA9IGh0bWxfaWQ7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBlbC5kYXRhc2V0LmNzc2NsYXNzICE9PSBjbHNfbmV4dCApIHtcclxuXHRcdFx0XHRlbC5kYXRhc2V0LmNzc2NsYXNzID0gY2xzX25leHQ7XHJcblx0XHRcdH1cclxuXHRcdFx0ZWwuZGF0YXNldC5yZXF1aXJlZCA9ICd0cnVlJzsgICAvLyBwZXJzaXN0IHRoZSBmb3JjZWQgdmFsdWUgZm9yIHNhdmluZy9zZXJpYWxpemF0aW9uXHJcblxyXG5cdFx0XHQvLyBDb21waWxlIHRlbXBsYXRlLlxyXG5cdFx0XHRjb25zdCB0cGwgPSB0aGlzLmdldF90ZW1wbGF0ZSggdGhpcy50ZW1wbGF0ZV9pZCApO1xyXG5cdFx0XHRpZiAoIHR5cGVvZiB0cGwgIT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0KHcuX3dwYmMgJiYgdy5fd3BiYy5kZXYgJiYgdy5fd3BiYy5kZXYuZXJyb3IpICYmIHcuX3dwYmMuZGV2LmVycm9yKCAnZW1haWxfd3B0cGwudHBsLm1pc3NpbmcnLCAnVGVtcGxhdGUgbm90IGZvdW5kOiAnICsgdGhpcy50ZW1wbGF0ZV9pZCApO1xyXG5cdFx0XHRcdGVsLmlubmVySFRNTCA9ICc8ZGl2IGNsYXNzPVwid3BiY19iZmJfX2Vycm9yXCIgcm9sZT1cImFsZXJ0XCI+VGVtcGxhdGUgbm90IGZvdW5kOiB3cGJjLWJmYi1maWVsZC1lbWFpbC48L2Rpdj4nO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRjb25zdCB0cGxfZGF0YSA9IHtcclxuXHRcdFx0XHRcdC4uLmQsXHJcblx0XHRcdFx0XHRuYW1lLFxyXG5cdFx0XHRcdFx0aHRtbF9pZCxcclxuXHRcdFx0XHRcdGNzc2NsYXNzICAgICA6IGNsc19uZXh0LFxyXG5cdFx0XHRcdFx0ZGVmYXVsdF92YWx1ZTogKGQuZGVmYXVsdF92YWx1ZSA/PyAnJyksXHJcblx0XHRcdFx0fTtcclxuXHRcdFx0XHRlbC5pbm5lckhUTUwgICA9IHRwbCggdHBsX2RhdGEgKTtcclxuXHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0KHcuX3dwYmMgJiYgdy5fd3BiYy5kZXYgJiYgdy5fd3BiYy5kZXYuZXJyb3IpICYmIHcuX3dwYmMuZGV2LmVycm9yKCAnZW1haWxfd3B0cGwudHBsLnJlbmRlcicsIGUgKTtcclxuXHRcdFx0XHRlbC5pbm5lckhUTUwgPSAnPGRpdiBjbGFzcz1cIndwYmNfYmZiX19lcnJvclwiIHJvbGU9XCJhbGVydFwiPkVycm9yIHJlbmRlcmluZyBFbWFpbCBmaWVsZCBwcmV2aWV3LjwvZGl2Pic7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBXcmFwcGVyIG1ldGEuXHJcblx0XHRcdGVsLmRhdGFzZXQudHlwZSA9IGQudHlwZSB8fCAnZW1haWwnO1xyXG5cdFx0XHRlbC5zZXRBdHRyaWJ1dGUoICdkYXRhLWxhYmVsJywgKGQubGFiZWwgIT0gbnVsbCA/IFN0cmluZyggZC5sYWJlbCApIDogJycpICk7XHJcblxyXG5cdFx0XHQvLyBOb3JtYWxpemUgYXR0cmlidXRlcyBvbiB0aGUgaW5wdXQgKHF1b3Rlcy9uZXdsaW5lcykuXHJcblx0XHRcdGNvbnN0IGlucHV0ID0gZWwucXVlcnlTZWxlY3RvciggJ2lucHV0W3R5cGU9XCJlbWFpbFwiXScgKTtcclxuXHRcdFx0aWYgKCBpbnB1dCApIHtcclxuXHRcdFx0XHRpZiAoIGQucGxhY2Vob2xkZXIgIT0gbnVsbCApIGlucHV0LnNldEF0dHJpYnV0ZSggJ3BsYWNlaG9sZGVyJywgU3RyaW5nKCBkLnBsYWNlaG9sZGVyICkgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gT3ZlcmxheSAoaGFuZGxlcy90b29sYmFycywgc2VsZWN0aW9uKS5cclxuXHRcdFx0Q29yZS5VSSAmJiBDb3JlLlVJLldQQkNfQkZCX092ZXJsYXkgJiYgQ29yZS5VSS5XUEJDX0JGQl9PdmVybGF5LmVuc3VyZSAmJiBDb3JlLlVJLldQQkNfQkZCX092ZXJsYXkuZW5zdXJlKCBjdHg/LmJ1aWxkZXIsIGVsICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBPcHRpb25hbCBob29rIGV4ZWN1dGVkIGFmdGVyIGZpZWxkIGlzIGRyb3BwZWQgZnJvbSB0aGUgcGFsZXR0ZS5cclxuXHRcdCAqIEVuc3VyZXMgYmFzZSBiZWhhdmlvciAoYXV0by1uYW1lIGZyb20gbGFiZWwgZXRjLikuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgZGF0YVxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGN0eFxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgb25fZmllbGRfZHJvcChkYXRhLCBlbCwgY3R4KSB7XHJcblxyXG5cdFx0XHRzdXBlci5vbl9maWVsZF9kcm9wICYmIHN1cGVyLm9uX2ZpZWxkX2Ryb3AoIGRhdGEsIGVsLCBjdHggKTtcclxuXHJcblx0XHRcdC8vIExvY2sgdGhlIFwiZW1haWxcIiBmaWVsZCBuYW1lIGFuZCBkaXNhYmxlIGZ1dHVyZSBhdXRvLW5hbWluZyBmcm9tIGxhYmVsLlxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGlmICggISBlbCApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0ZWwuZGF0YXNldC50eXBlICAgICAgICAgICAgICA9ICdlbWFpbCc7XHJcblx0XHRcdFx0ZWwuZGF0YXNldC5uYW1lICAgICAgICAgICAgICA9ICdlbWFpbCc7XHJcblx0XHRcdFx0ZWwuZGF0YXNldC5hdXRvbmFtZSAgICAgICAgICA9ICcwJzsgICAgICAgICAgLy8g4oaQIHN0b3AgbGFiZWwtPm5hbWUgc3luY2luZ1xyXG5cdFx0XHRcdGVsLmRhdGFzZXQuZnJlc2ggICAgICAgICAgICAgPSAnMCc7ICAgICAgICAgICAgIC8vIOKGkCBraWxsIOKAnGZyZXNo4oCdIGF1dG8tbmFtZSBwYXRoXHJcblx0XHRcdFx0ZWwuZGF0YXNldC5uYW1lX3VzZXJfdG91Y2hlZCA9ICcxJzsgLy8g4oaQIHRyZWF0IGFzIHVzZXItc2V0XHJcblxyXG5cdFx0XHRcdC8vIEtlZXAgdGhlIGlubmVyIGlucHV0IGluIHN5bmMgaW1tZWRpYXRlbHkuXHJcblx0XHRcdFx0Y29uc3QgaW5wdXQgPSBlbC5xdWVyeVNlbGVjdG9yKCAnaW5wdXRbdHlwZT1cImVtYWlsXCJdJyApO1xyXG5cdFx0XHRcdGlmICggaW5wdXQgKSB7XHJcblx0XHRcdFx0XHRpbnB1dC5zZXRBdHRyaWJ1dGUoICduYW1lJywgJ2VtYWlsJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHQvLyBJZiBJbnNwZWN0b3IgaXMgb3BlbiwgcmVmbGVjdCAmIHZpc3VhbGx5IGxvY2sgdGhlIE5hbWUgY29udHJvbC5cclxuXHRcdFx0XHRjb25zdCBpbnMgICAgICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2luc3BlY3RvcicgKTtcclxuXHRcdFx0XHRjb25zdCBuYW1lQ3RybCA9IGlucyAmJiBpbnMucXVlcnlTZWxlY3RvciggJ1tkYXRhLWluc3BlY3Rvci1rZXk9XCJuYW1lXCJdJyApO1xyXG5cdFx0XHRcdGlmICggbmFtZUN0cmwgKSB7XHJcblx0XHRcdFx0XHRuYW1lQ3RybC52YWx1ZSAgICA9ICdlbWFpbCc7XHJcblx0XHRcdFx0XHRuYW1lQ3RybC5yZWFkT25seSA9IHRydWU7XHJcblx0XHRcdFx0XHRuYW1lQ3RybC5zZXRBdHRyaWJ1dGUoICdhcmlhLXJlYWRvbmx5JywgJ3RydWUnICk7XHJcblx0XHRcdFx0XHRuYW1lQ3RybC5jbGFzc0xpc3QuYWRkKCAnaW5zcGVjdG9yX19pbnB1dC0tcmVhZG9ubHknICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGNhdGNoICggXyApIHt9XHJcblxyXG5cdFx0XHQvLyBFbnN1cmUgdGhlIGRyb3BwZWQgZWxlbWVudCBzdGFydHMgaW4gdGhlIHJlcXVpcmVkIHN0YXRlLlxyXG5cdFx0XHRpZiAoIGVsICkge1xyXG5cdFx0XHRcdGVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtcmVxdWlyZWQnLCAndHJ1ZScgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHR9O1xyXG5cclxuXHQvLyBSZWdpc3RlciBpbiB0aGUgRmllbGQgUmVuZGVyZXIgUmVnaXN0cnkuXHJcblx0dHJ5IHtcclxuXHRcdFJlZ2lzdHJ5LnJlZ2lzdGVyKCAnZW1haWwnLCB3cGJjX2JmYl9maWVsZF9lbWFpbCApO1xyXG5cdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0KHcuX3dwYmMgJiYgdy5fd3BiYy5kZXYgJiYgdy5fd3BiYy5kZXYuZXJyb3IpICYmIHcuX3dwYmMuZGV2LmVycm9yKCAnd3BiY19iZmJfZmllbGRfZW1haWwucmVnaXN0ZXInLCBlICk7XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEV4cG9ydCBmb3IgXCJCb29raW5nIEZvcm1cIiAoQWR2YW5jZWQgRm9ybSBzaG9ydGNvZGUpXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvKipcclxuXHQgKiBCb29raW5nIEZvcm0gZXhwb3J0ZXIgY2FsbGJhY2sgKEFkdmFuY2VkIEZvcm0gc2hvcnRjb2RlKSBmb3IgXCJlbWFpbFwiLlxyXG5cdCAqXHJcblx0ICogUmVnaXN0ZXJlZCBwZXIgZmllbGQgdHlwZSB2aWE6XHJcblx0ICogICBXUEJDX0JGQl9FeHBvcnRlci5yZWdpc3RlciggJ2VtYWlsJywgY2FsbGJhY2sgKVxyXG5cdCAqXHJcblx0ICogQ29yZSBjYWxsIHNpdGUgKGJ1aWxkZXItZXhwb3J0ZXIuanMpOlxyXG5cdCAqICAgV1BCQ19CRkJfRXhwb3J0ZXIucnVuX3JlZ2lzdGVyZWRfZXhwb3J0ZXIoIGZpZWxkLCBpbywgY2ZnLCBvbmNlLCBjdHggKSAtPiBjYWxsYmFjayggZmllbGQsIGVtaXQsIHsgaW8sIGNmZywgb25jZSwgY3R4LCBjb3JlIH0gKTtcclxuXHQgKlxyXG5cdCAqIFRoZSBjYWxsYmFjazpcclxuXHQgKiAgIC0gQ29tcHV0ZXMgdGhlIGZpbmFsIG5hbWUgdmlhIEV4cC5jb21wdXRlX25hbWUoJ2VtYWlsJywgZmllbGQpXHJcblx0ICogICAtIFVzZXMgc2hhcmVkIGhlbHBlcnMgZm9yIGlkL2NsYXNzL3BsYWNlaG9sZGVyL3NpemUvZGVmYXVsdFxyXG5cdCAqICAgLSBFbWl0cyBhIHNob3J0Y29kZSBsaWtlOlxyXG5cdCAqICAgICAgIFtlbWFpbCogZW1haWwgNDAvMjU1IGlkOnNvbWVJRCBjbGFzczpzb21lQ1NTY2xhc3MgcGxhY2Vob2xkZXI6XCIuLi5cIiBcImRlZmF1bHRAZG9tYWluLmNvbVwiXVxyXG5cdCAqXHJcblx0ICogSGVscCB0ZXh0IGlzIGFwcGVuZGVkIGNlbnRyYWxseSBieSBXUEJDX0JGQl9FeHBvcnRlci5yZW5kZXJfZmllbGRfbm9kZSgpLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHJlZ2lzdGVyX2VtYWlsX2Jvb2tpbmdfZm9ybV9leHBvcnRlcigpIHtcclxuXHJcblx0XHRjb25zdCBFeHAgPSB3LldQQkNfQkZCX0V4cG9ydGVyO1xyXG5cdFx0aWYgKCAhIEV4cCB8fCB0eXBlb2YgRXhwLnJlZ2lzdGVyICE9PSAnZnVuY3Rpb24nICkgeyByZXR1cm4gZmFsc2U7IH1cclxuXHRcdGlmICggdHlwZW9mIEV4cC5oYXNfZXhwb3J0ZXIgPT09ICdmdW5jdGlvbicgJiYgRXhwLmhhc19leHBvcnRlciggJ2VtYWlsJyApICkgeyByZXR1cm4gdHJ1ZTsgfVxyXG5cclxuXHRcdGNvbnN0IFMgICA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemUgfHwgKHcuV1BCQ19CRkJfQ29yZSAmJiB3LldQQkNfQkZCX0NvcmUuV1BCQ19CRkJfU2FuaXRpemUpIHx8IHt9O1xyXG5cdFx0Y29uc3QgZXNjID0gUy5lc2NhcGVfaHRtbCB8fCAodiA9PiBTdHJpbmcoIHYgKSk7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBAdHlwZSB7KGZpZWxkOk9iamVjdCwgZW1pdDooY29kZTpzdHJpbmcpPT52b2lkLCBleHRyYXM/Ontpbz86YW55LGNmZz86YW55LG9uY2U/OmFueSxjdHg/OmFueSxjb3JlPzphbnl9KT0+dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0RXhwLnJlZ2lzdGVyKCAnZW1haWwnLCAoZmllbGQsIGVtaXQsIGV4dHJhcyA9IHt9KSA9PiB7XHJcblxyXG5cdFx0XHRjb25zdCBjZmcgICAgICAgPSBleHRyYXMuY2ZnIHx8IHt9O1xyXG5cdFx0XHRjb25zdCBjdHggICAgICAgPSBleHRyYXMuY3R4O1xyXG5cdFx0XHRjb25zdCBhZGRMYWJlbHMgPSBjZmcuYWRkTGFiZWxzICE9PSBmYWxzZTtcclxuXHJcblx0XHRcdGNvbnN0IGlzX3JlcSAgID0gRXhwLmlzX3JlcXVpcmVkKCBmaWVsZCApO1xyXG5cdFx0XHRjb25zdCByZXFfbWFyayA9IGlzX3JlcSA/ICcqJyA6ICcnO1xyXG5cclxuXHRcdFx0Y29uc3QgbmFtZSAgICAgID0gRXhwLmNvbXB1dGVfbmFtZSggJ2VtYWlsJywgZmllbGQgKTtcclxuXHRcdFx0Y29uc3QgaWRfb3B0ICAgID0gRXhwLmlkX29wdGlvbiggZmllbGQsIGN0eCApO1xyXG5cdFx0XHRjb25zdCBjbHNfb3B0cyAgPSBFeHAuY2xhc3Nfb3B0aW9ucyggZmllbGQgKTtcclxuXHRcdFx0Y29uc3QgcGhfYXR0ciAgID0gRXhwLnBoX2F0dHIoIGZpZWxkLnBsYWNlaG9sZGVyICk7XHJcblx0XHRcdGNvbnN0IHNpemVfbWF4ICA9IEV4cC5zaXplX21heF90b2tlbiggZmllbGQgKTtcclxuXHRcdFx0Y29uc3QgZGVmX3ZhbHVlID0gRXhwLmRlZmF1bHRfdGV4dF9zdWZmaXgoIGZpZWxkICk7XHJcblxyXG5cdFx0XHQvLyBGaW5hbCBzaG9ydGNvZGUgYm9keTpcclxuXHRcdFx0Ly8gW2VtYWlsJHtyZXFfbWFya30gJHtuYW1lfSR7c2l6ZV9tYXh9JHtpZF9vcHR9JHtjbHNfb3B0c30ke3BoX2F0dHJ9JHtkZWZfdmFsdWV9XVxyXG5cdFx0XHRjb25zdCBib2R5ID0gYFtlbWFpbCR7cmVxX21hcmt9ICR7bmFtZX0ke3NpemVfbWF4fSR7aWRfb3B0fSR7Y2xzX29wdHN9JHtwaF9hdHRyfSR7ZGVmX3ZhbHVlfV1gO1xyXG5cclxuXHRcdFx0Y29uc3QgcmF3X2xhYmVsID0gKGZpZWxkICYmIHR5cGVvZiBmaWVsZC5sYWJlbCA9PT0gJ3N0cmluZycpID8gZmllbGQubGFiZWwgOiAnJztcclxuXHRcdFx0Y29uc3QgbGFiZWwgICAgID0gcmF3X2xhYmVsLnRyaW0oKTtcclxuXHJcblx0XHRcdGlmICggbGFiZWwgJiYgYWRkTGFiZWxzICkge1xyXG5cdFx0XHRcdGVtaXQoIGA8bD4ke2VzYyggbGFiZWwgKX0ke3JlcV9tYXJrfTwvbD5gICk7XHJcblx0XHRcdFx0ZW1pdCggYDxicj4ke2JvZHl9YCApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGVtaXQoIGJvZHkgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH1cclxuXHJcblx0Ly8gVHJ5IGltbWVkaWF0ZSByZWdpc3RyYXRpb247IGlmIGV4cG9ydGVyIGlzbid0IHJlYWR5IHlldCwgd2FpdCBmb3IgdGhlIG9uZS1zaG90IGV2ZW50LlxyXG5cdGlmICggISByZWdpc3Rlcl9lbWFpbF9ib29raW5nX2Zvcm1fZXhwb3J0ZXIoKSApIHtcclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOmJmYjpleHBvcnRlci1yZWFkeScsIHJlZ2lzdGVyX2VtYWlsX2Jvb2tpbmdfZm9ybV9leHBvcnRlciwgeyBvbmNlOiB0cnVlIH0gKTtcclxuXHR9XHJcblxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEV4cG9ydCBmb3IgXCJCb29raW5nIERhdGFcIiAoQ29udGVudCBvZiBib29raW5nIGZpZWxkcyBkYXRhKVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0LyoqXHJcblx0ICogQm9va2luZyBEYXRhIGV4cG9ydGVyIGNhbGxiYWNrIGZvciBcImVtYWlsXCIgKFwiQ29udGVudCBvZiBib29raW5nIGZpZWxkcyBkYXRhXCIpLlxyXG5cdCAqIERlZmF1bHQgb3V0cHV0OiA8Yj5MYWJlbDwvYj46IDxmPltmaWVsZF9uYW1lXTwvZj48YnI+XHJcblx0ICpcclxuXHQgKiBSZWdpc3RlcmVkIHZpYTpcclxuXHQgKiAgIFdQQkNfQkZCX0NvbnRlbnRFeHBvcnRlci5yZWdpc3RlciggJ2VtYWlsJywgY2FsbGJhY2sgKVxyXG5cdCAqXHJcblx0ICogQ29yZSBjYWxsIHNpdGUgKGJ1aWxkZXItZXhwb3J0ZXIuanMpOlxyXG5cdCAqICAgV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyLnJ1bl9yZWdpc3RlcmVkX2V4cG9ydGVyKCBmaWVsZCwgZW1pdCwgeyBjZmcsIGNvcmUgfSApO1xyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHJlZ2lzdGVyX2VtYWlsX2Jvb2tpbmdfZGF0YV9leHBvcnRlcigpIHtcclxuXHJcblx0XHRjb25zdCBDID0gdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXI7XHJcblx0XHRpZiAoICEgQyB8fCB0eXBlb2YgQy5yZWdpc3RlciAhPT0gJ2Z1bmN0aW9uJyApIHsgcmV0dXJuIGZhbHNlOyB9XHJcblx0XHRpZiAoIHR5cGVvZiBDLmhhc19leHBvcnRlciA9PT0gJ2Z1bmN0aW9uJyAmJiBDLmhhc19leHBvcnRlciggJ2VtYWlsJyApICkgeyByZXR1cm4gdHJ1ZTsgfVxyXG5cclxuXHRcdEMucmVnaXN0ZXIoICdlbWFpbCcsIGZ1bmN0aW9uICggZmllbGQsIGVtaXQsIGV4dHJhcyApIHtcclxuXHJcblx0XHRcdGV4dHJhcyA9IGV4dHJhcyB8fCB7fTtcclxuXHRcdFx0Y29uc3QgY2ZnID0gZXh0cmFzLmNmZyB8fCB7fTtcclxuXHJcblx0XHRcdGNvbnN0IEV4cCA9IHcuV1BCQ19CRkJfRXhwb3J0ZXI7XHJcblx0XHRcdGlmICggISBFeHAgfHwgdHlwZW9mIEV4cC5jb21wdXRlX25hbWUgIT09ICdmdW5jdGlvbicgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0Y29uc3QgbmFtZSA9IEV4cC5jb21wdXRlX25hbWUoICdlbWFpbCcsIGZpZWxkICk7XHJcblx0XHRcdGlmICggISBuYW1lICkgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdGxldCBsYWJlbDtcclxuXHRcdFx0aWYgKCB0eXBlb2YgZmllbGQubGFiZWwgPT09ICdzdHJpbmcnICYmIGZpZWxkLmxhYmVsLnRyaW0oKSApIHtcclxuXHRcdFx0XHRsYWJlbCA9IGZpZWxkLmxhYmVsLnRyaW0oKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRsYWJlbCA9ICdFbWFpbCc7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFNoYXJlZCBmb3JtYXR0ZXIga2VlcHMgYWxsIHBhY2tzIGNvbnNpc3RlbnQuXHJcblx0XHRcdEMuZW1pdF9saW5lX2JvbGRfZmllbGQoIGVtaXQsIGxhYmVsLCBuYW1lLCBjZmcgKTtcclxuXHJcblx0XHRcdC8vIEZhbGxiYWNrIC0gaXMgdGhlIHJlZmVyZW5jZSBmb3Igb3RoZXIgZmllbGQgcGFja3MuXHJcblx0XHRcdGlmICgwKXtcclxuXHRcdFx0XHQvLyBEZWZlbnNpdmUgZmFsbGJhY2s6IHNpbXBsZSwgYmFja3dhcmQtY29tcGF0aWJsZSBvdXRwdXQuXHJcblx0XHRcdFx0Y29uc3QgY29yZV9sb2NhbCA9IENvcmUgfHwge307XHJcblx0XHRcdFx0Y29uc3QgU19sb2NhbCAgICA9IGNvcmVfbG9jYWwuV1BCQ19CRkJfU2FuaXRpemUgfHwge307XHJcblx0XHRcdFx0Y29uc3QgZXNjX2xvY2FsICA9IFNfbG9jYWwuZXNjYXBlX2h0bWwgfHwgKHMgPT4gU3RyaW5nKCBzICkgKTtcclxuXHJcblx0XHRcdFx0Y29uc3Qgc2VwICAgPSAoY2ZnICYmIHR5cGVvZiBjZmcuc2VwID09PSAnc3RyaW5nJykgPyBjZmcuc2VwIDogJzogJztcclxuXHRcdFx0XHRjb25zdCB0aXRsZSA9IGxhYmVsID8gYDxiPiR7ZXNjX2xvY2FsKCBsYWJlbCApfTwvYj4ke3NlcH1gIDogJyc7XHJcblx0XHRcdFx0ZW1pdCggYCR7dGl0bGV9PGY+WyR7bmFtZX1dPC9mPjxicj5gICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cdGlmICggISByZWdpc3Rlcl9lbWFpbF9ib29raW5nX2RhdGFfZXhwb3J0ZXIoKSApIHtcclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOmJmYjpjb250ZW50LWV4cG9ydGVyLXJlYWR5JywgcmVnaXN0ZXJfZW1haWxfYm9va2luZ19kYXRhX2V4cG9ydGVyLCB7IG9uY2U6IHRydWUgfSApO1xyXG5cdH1cclxuXHJcbn0pKCB3aW5kb3cgKTtcclxuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDLFVBQVVBLENBQUMsRUFBRTtFQUNiLFlBQVk7O0VBRVosSUFBSUMsSUFBSSxHQUFPRCxDQUFDLENBQUNFLGFBQWEsSUFBSSxDQUFDLENBQUM7RUFDcEMsSUFBSUMsUUFBUSxHQUFHRixJQUFJLENBQUNHLGdDQUFnQztFQUNwRCxJQUFJQyxJQUFJLEdBQU9KLElBQUksQ0FBQ0ssbUJBQW1CO0VBRXZDLElBQUssQ0FBQ0gsUUFBUSxJQUFJLE9BQU9BLFFBQVEsQ0FBQ0ksUUFBUSxLQUFLLFVBQVUsSUFBSSxDQUFDRixJQUFJLEVBQUc7SUFDbkVMLENBQUMsQ0FBQ1EsS0FBSyxJQUFJUixDQUFDLENBQUNRLEtBQUssQ0FBQ0MsR0FBRyxJQUFJVCxDQUFDLENBQUNRLEtBQUssQ0FBQ0MsR0FBRyxDQUFDQyxLQUFLLElBQUtWLENBQUMsQ0FBQ1EsS0FBSyxDQUFDQyxHQUFHLENBQUNDLEtBQUssQ0FBRSxzQkFBc0IsRUFBRSw0QkFBNkIsQ0FBQztJQUMxSDtFQUNEOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0VBQ0MsTUFBTUMsb0JBQW9CLEdBQUcsY0FBY04sSUFBSSxDQUFDO0lBRS9DO0lBQ0EsT0FBT08sV0FBVyxHQUFHLHNC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
