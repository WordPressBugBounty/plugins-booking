"use strict";

/**
 * WPBC BFB: Field Renderer for "text" (Schema-driven Reference, template-literal render)
 * ==============================================================================================
 * Purpose:
 * - Uses template literals (no wp.template)
 * - Inspector is rendered by Factory (PHP schema)
 * - Uses WPBC_BFB_Sanitize (from core) with method names as in bfb-core.js
 *
 * Contracts:
 * - Registry:  WPBC_BFB_Field_Renderer_Registry.register( 'text', Class )
 * - Class API: static get_defaults(), static render(el, data, ctx), static on_field_drop(data, el, ctx?) [optional]
 *
 * Notes:
 * - Keep defaults aligned with PHP schema->props->default.
 * - Use Overlay.ensure(...) so field controls (handle, settings, etc.) appear.
 *
 * File:  ../includes/page-form-builder/field-packs/text/_out/field-text.js
 *
 * @since    11.0.0
 * @modified  2025-09-06 14:08
 * @version  1.0.1
 *
 */
(function (w) {
  'use strict';

  var Core = w.WPBC_BFB_Core || {};
  var registry = Core.WPBC_BFB_Field_Renderer_Registry;
  var Base = Core.WPBC_BFB_Field_Base;
  if (!registry || typeof registry.register !== 'function' || !Base) {
    _wpbc?.dev?.error?.('WPBC_BFB_Field_Text', 'Core registry/base missing');
    return;
  }
  class WPBC_BFB_Field_Text extends Base {
    /**
     * Return default props for "text" field.
     * Must stay in sync with PHP schema defaults.
     *
     * @returns {Object}
     */
    static get_defaults() {
      return {
        type: 'text',
        label: 'Text',
        name: '',
        html_id: '',
        placeholder: '',
        required: false,
        minlength: null,
        maxlength: null,
        pattern: '',
        cssclass: '',
        help: '',
        default_value: ''
      };
    }

    /**
     * Render the preview markup into the field element.
     *
     * @param {HTMLElement} el   Field root element inside the canvas.
     * @param {Object}      d    Field props (already normalized by schema).
     * @param {Object}      ctx  Context: { builder, sanit, ... }
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

      // Sanitize public id/name for the control itself.
      const html_id = d.html_id ? sid(String(d.html_id)) : '';
      const name_val = sname(String(d.name || d.id || 'field'));
      const cssNext = sclass(String(d.cssclass || ''));

      // Keep wrapper classes in sync with dataset.cssclass ONLY (don’t touch core classes).
      // if ( 'cssclass' in d ) {
      // 	const prev = el.dataset.cssclass || '';
      // 	if ( prev !== cssNext ) {
      // 		prev.split( /\s+/ ).filter( Boolean ).forEach( (c) => el.classList.remove( c ) );
      // 		cssNext.split( /\s+/ ).filter( Boolean ).forEach( (c) => el.classList.add( c ) );
      // 		el.dataset.cssclass = cssNext;
      // 	}
      // }
      // NEW: store only; do NOT modify wrapper classes.
      if ('cssclass' in d) {
        if (el.dataset.cssclass !== cssNext) {
          el.dataset.cssclass = cssNext;
        }
      }
      // Keep wrapper's stored html_id (dataset) updated.
      if ('html_id' in d) {
        if (el.dataset.html_id !== html_id) {
          el.dataset.html_id = html_id;
        }
      }

      // Flags / numeric constraints.
      const is_required = truthy(d.required);
      const has_minlength = d.minlength != null && d.minlength !== '' && Number.isFinite(+d.minlength);
      const has_maxlength = d.maxlength != null && d.maxlength !== '' && Number.isFinite(+d.maxlength);
      const has_pattern = !!d.pattern;
      const minlength_num = has_minlength ? Number(d.minlength) : null;
      const maxlength_num = has_maxlength ? Number(d.maxlength) : null;

      // Attribute fragments (using escape_html for safe innerHTML attribute context).
      const id_attr = html_id ? ` id="${eh(html_id)}"` : '';
      const name_attr = ` name="${eh(name_val)}"`;
      // const cls_attr       = ` class="wpbc_bfb__preview-input ${eh( cssNext )}"`;
      const cls_attr = ` class="wpbc_bfb__preview-input ${cssNext ? ' ' + eh(cssNext) : ''}"`;
      const ph_attr = d.placeholder ? ` placeholder="${eh(d.placeholder)}"` : '';
      const req_attr = is_required ? ' required aria-required="true"' : '';
      const minlength_attr = has_minlength ? ` minlength="${minlength_num}"` : '';
      const maxlength_attr = has_maxlength ? ` maxlength="${maxlength_num}"` : '';
      const pattern_attr = has_pattern ? ` pattern="${eh(d.pattern)}"` : '';
      const value_attr = d.default_value != null && d.default_value !== '' ? ` value="${eh(String(d.default_value))}"` : '';
      // Optional fragments.
      const label_html = d.label != null && d.label !== '' ? `<label class="wpbc_bfb__field-label"${html_id ? ` for="${eh(html_id)}"` : ''}>${eh(d.label)}${is_required ? '<span aria-hidden="true">*</span>' : ''}</label>` : '';
      const help_html = d.help ? `<div class="wpbc_bfb__help">${eh(d.help)}</div>` : '';

      // Render preview HTML.
      el.innerHTML = `
				<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="">
					${label_html}
					<span class="wpbc_wrap_text wpdev-form-control-wrap">
						<input type="text"${cls_attr}${ph_attr}${name_attr} autocomplete="off" tabindex="-1" aria-disabled="true"${id_attr}${value_attr}${req_attr}${minlength_attr}${maxlength_attr}${pattern_attr} />

					</span>
					${help_html}
				</span>
			`;

      // Overlay (handles/toolbars).
      Core.UI?.WPBC_BFB_Overlay?.ensure?.(ctx?.builder, el);
    }

    /**
     * Optional hook executed after field is dropped from the palette.
     * Example recipe placeholder for future:   try { if ( !data.name ) { data.name = core.WPBC_BFB_IdService?.next_name?.( 'text' ) || 'text'; }  } catch ( e ) { }
     *
     * @param {Object}      data  Palette/field data.
     * @param {HTMLElement} el    Newly created field element.
     * @param {Object}      ctx   Context { builder, sanit, context: 'drop' | 'load' | 'preview' }
     * @returns {void}
     */
    static on_field_drop(data, el, ctx) {
      super.on_field_drop?.(data, el, ctx); // Required for correctly auto-names from  Labels !
      // (your extra pack-specific logic if ever needed)
    }
  }
  try {
    registry.register('text', WPBC_BFB_Field_Text);
  } catch (e) {
    _wpbc?.dev?.error?.('WPBC_BFB_Field_Text.register', e);
  }

  // Optional global alias (debugging / dev tools).
  w.WPBC_BFB_Field_Text = w.WPBC_BFB_Field_Text || WPBC_BFB_Field_Text;

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Form" (Advanced Form shortcode)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Booking Form exporter callback (Advanced Form shortcode).
   *
   * This callback is registered per field type via:
   *   WPBC_BFB_Exporter.register( 'text', callback )
   *
   * Core call site (builder-exporter.js):
   *   WPBC_BFB_Exporter.run_registered_exporter( field, io, cfg, once, ctx )
   *     -> callback( field, emit, { io, cfg, once, ctx, core } );
   *
   * @callback WPBC_BFB_ExporterCallback
   * @param {Object}  field
   *   Normalized field data coming from the Builder structure.
   *   - field.type          {string}   Field type, e.g. "text".
   *   - field.name          {string}   Name as stored on the canvas (already validated).
   *   - field.id / html_id  {string}   Optional HTML id / user-visible id.
   *   - field.label         {string}   Visible label in the form (may be empty).
   *   - field.placeholder   {string}   Placeholder text (may be empty).
   *   - field.required      {boolean|number|string} "truthy" if required.
   *   - field.cssclass      {string}   Extra CSS classes entered in Inspector.
   *   - field.default_value {string}   Default text value.
   *   - field.options       {Array}    Only for option-based fields (select, checkbox, etc.).
   *   - ...                 (Any other pack-specific props are also present.)
   *
   * @param {function(string):void} emit
   *   Emits one line/fragment into the export buffer.
   *   - Each call corresponds to one `push()` in the core exporter.
   *   - For multi-line output (e.g. label + shortcode), call `emit()` multiple times:
   *       emit('<l>Label</l>');
   *       emit('<br>[text* name ...]');
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
   *   Counters are incremented by some field types (captcha, coupon, etc.).
   *   Typical shape:
   *   - extras.once.captcha          {number}
   *   - extras.once.country          {number}
   *   - extras.once.coupon           {number}
   *   - extras.once.cost_corrections {number}
   *   - extras.once.submit           {number}
   *
   *   Text field usually does not touch this object, but other packs can use it
   *   to skip duplicates (e.g. only the first [coupon] per form is exported).
   *
   * @param {Object} [extras.ctx]
   *   Shared export context for the entire form.
   *   Currently:
   *   - extras.ctx.usedIds {Set<string>}
   *       Set of HTML/shortcode IDs already used in this export.
   *       Helpers like Exp.id_option(field, ctx) use it to ensure uniqueness.
   *
   *   Packs normally just pass `ctx` into helpers (id_option, etc.) without
   *   mutating it directly.
   *
   * @param {Object} [extras.core]
   *   Reference to WPBC_BFB_Core passed from builder-exporter.js.
   *   Primarily used to access sanitizers:
   *   - extras.core.WPBC_BFB_Sanitize.escape_html(...)
   *   - extras.core.WPBC_BFB_Sanitize.escape_for_shortcode(...)
   *   - extras.core.WPBC_BFB_Sanitize.sanitize_html_name(...)
   *   - etc.
   */
  function register_text_booking_form_exporter() {
    const Exp = w.WPBC_BFB_Exporter;
    if (!Exp || typeof Exp.register !== 'function') {
      return;
    }
    if (typeof Exp.has_exporter === 'function' && Exp.has_exporter('text')) {
      return;
    }
    const S = Core.WPBC_BFB_Sanitize;
    Exp.register('text', (field, emit, extras = {}) => {
      const cfg = extras.cfg || {};
      const ctx = extras.ctx; // no local fallback needed.
      const addLabels = cfg.addLabels !== false;

      // Required marker logic (same as before).
      const is_req = Exp.is_required(field);
      const req_mark = is_req ? '*' : '';

      // Reuse helpers from WPBC_BFB_Exporter.
      const name = Exp.compute_name('text', field);
      const id_opt = Exp.id_option(field, ctx);
      const cls_opts = Exp.class_options(field);
      const ph_attr = Exp.ph_attr(field.placeholder);
      const size_max = Exp.size_max_token(field);
      const def_value = Exp.default_text_suffix(field);

      // Build body shortcode.
      const body = `[text${req_mark} ${name}${size_max}${id_opt}${cls_opts}${ph_attr}${def_value}]`;

      // Label behavior identical to legacy emit_label_then().
      const label = (field.label ?? '').toString().trim();
      if (label && addLabels) {
        emit(`<l>${S.escape_html(label)}${req_mark}</l>`);
        emit(`<br>${body}`);
      } else {
        emit(body);
      }
      // Help text is appended centrally by WPBC_BFB_Exporter.render_field_node().
    });
  }

  // Try immediate registration; if core isn’t ready, wait for the event.
  if (w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function') {
    register_text_booking_form_exporter();
  } else {
    document.addEventListener('wpbc:bfb:exporter-ready', register_text_booking_form_exporter, {
      once: true
    });
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Data" (Content of booking fields data)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Booking Data exporter callback ("Content of booking fields data").  Default output: <b>Label</b>: <f>[field_name]</f><br>
   *
   * Registered per field type via:
   *   WPBC_BFB_ContentExporter.register( 'text', callback )
   *
   * Core call site (builder-exporter.js):
   *   WPBC_BFB_ContentExporter.run_registered_exporter( field, emit, { cfg, core } );
   *
   * @callback WPBC_BFB_ContentExporterCallback
   * @param {Object}  field
   *   Normalized field data (same shape as in the main exporter).
   *   Important properties for content templates:
   *   - field.type      {string}  Field type, e.g. "text".
   *   - field.name      {string}  Field name used as placeholder token.
   *   - field.label     {string}  Human-readable label (may be empty).
   *   - field.options   {Array}   For option-based fields (select, checkbox, radio, etc.).
   *   - Other pack-specific props if needed.
   *
   * @param {function(string):void} emit
   *   Emits a raw HTML fragment into the "Content of booking fields data" template.
   *   Core will wrap everything once into:
   *     <div class="standard-content-form">
   *       ... emitted fragments ...
   *     </div>
   *
   *   Typical usage pattern:
   *     emit('<b>Label</b>: <f>[field_name]</f><br>');
   *
   *   In most cases, packs call the shared helper:
   *     WPBC_BFB_ContentExporter.emit_line_bold_field(emit, label, token, cfg);
   *
   * @param {Object} [extras]
   *   Additional context passed from run_registered_exporter().
   *
   * @param {Object} [extras.cfg]
   *   Content exporter configuration:
   *   - extras.cfg.addLabels {boolean} Default: true.
   *       If false, helper may omit the bold label part.
   *   - extras.cfg.sep       {string}  Label separator, default ": ".
   *       Example: "<b>Label</b>: " vs "<b>Label</b> – ".
   *   - extras.cfg.newline   {string}  Newline separator when joining lines (usually "\n").
   *
   * @param {Object} [extras.core]
   *   Reference to WPBC_BFB_Core (same as in main exporter).
   *   Usually not needed here, because:
   *   - Sanitization and consistent rendering are already done via
   *     WPBC_BFB_ContentExporter.emit_line_bold_field( ... ).
   */
  function register_text_booking_data_exporter() {
    const C = w.WPBC_BFB_ContentExporter;
    if (!C || typeof C.register !== 'function') {
      return;
    }
    if (typeof C.has_exporter === 'function' && C.has_exporter('text')) {
      return;
    }
    C.register('text', function (field, emit, extras) {
      extras = extras || {};
      const cfg = extras.cfg || {};
      const Exp = w.WPBC_BFB_Exporter;
      if (!Exp || typeof Exp.compute_name !== 'function') {
        return;
      }
      const name = Exp.compute_name('text', field);
      if (!name) {
        return;
      }
      const label = typeof field.label === 'string' && field.label.trim() ? field.label.trim() : name;

      // Shared formatter keeps all packs consistent:.
      C.emit_line_bold_field(emit, label, name, cfg);
    });
  }
  if (w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function') {
    register_text_booking_data_exporter();
  } else {
    document.addEventListener('wpbc:bfb:content-exporter-ready', register_text_booking_data_exporter, {
      once: true
    });
  }
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvdGV4dC9fb3V0L2ZpZWxkLXRleHQuanMiLCJuYW1lcyI6WyJ3IiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJyZWdpc3RyeSIsIldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5IiwiQmFzZSIsIldQQkNfQkZCX0ZpZWxkX0Jhc2UiLCJyZWdpc3RlciIsIl93cGJjIiwiZGV2IiwiZXJyb3IiLCJXUEJDX0JGQl9GaWVsZF9UZXh0IiwiZ2V0X2RlZmF1bHRzIiwidHlwZSIsImxhYmVsIiwibmFtZSIsImh0bWxfaWQiLCJwbGFjZWhvbGRlciIsInJlcXVpcmVkIiwibWlubGVuZ3RoIiwibWF4bGVuZ3RoIiwicGF0dGVybiIsImNzc2NsYXNzIiwiaGVscCIsImRlZmF1bHRfdmFsdWUiLCJyZW5kZXIiLCJlbCIsImRhdGEiLCJjdHgiLCJkIiwibm9ybWFsaXplX2RhdGEiLCJlaCIsInYiLCJXUEJDX0JGQl9TYW5pdGl6ZSIsImVzY2FwZV9odG1sIiwic2lkIiwic2FuaXRpemVfaHRtbF9pZCIsInNuYW1lIiwic2FuaXRpemVfaHRtbF9uYW1lIiwic2NsYXNzIiwic2FuaXRpemVfY3NzX2NsYXNzbGlzdCIsInRydXRoeSIsImlzX3RydXRoeSIsIlN0cmluZyIsIm5hbWVfdmFsIiwiaWQiLCJjc3NOZXh0IiwiZGF0YXNldCIsImlzX3JlcXVpcmVkIiwiaGFzX21pbmxlbmd0aCIsIk51bWJlciIsImlzRmluaXRlIiwiaGFzX21heGxlbmd0aCIsImhhc19wYXR0ZXJuIiwibWlubGVuZ3RoX251bSIsIm1heGxlbmd0aF9udW0iLCJpZF9hdHRyIiwibmFtZV9hdHRyIiwiY2xzX2F0dHIiLCJwaF9hdHRyIiwicmVxX2F0dHIiLCJtaW5sZW5ndGhfYXR0ciIsIm1heGxlbmd0aF9hdHRyIiwicGF0dGVybl9hdHRyIiwidmFsdWVfYXR0ciIsImxhYmVsX2h0bWwiLCJoZWxwX2h0bWwiLCJpbm5lckhUTUwiLCJVSSIsIldQQkNfQkZCX092ZXJsYXkiLCJlbnN1cmUiLCJidWlsZGVyIiwib25fZmllbGRfZHJvcCIsImUiLCJyZWdpc3Rlcl90ZXh0X2Jvb2tpbmdfZm9ybV9leHBvcnRlciIsIkV4cCIsIldQQkNfQkZCX0V4cG9ydGVyIiwiaGFzX2V4cG9ydGVyIiwiUyIsImZpZWxkIiwiZW1pdCIsImV4dHJhcyIsImNmZyIsImFkZExhYmVscyIsImlzX3JlcSIsInJlcV9tYXJrIiwiY29tcHV0ZV9uYW1lIiwiaWRfb3B0IiwiaWRfb3B0aW9uIiwiY2xzX29wdHMiLCJjbGFzc19vcHRpb25zIiwic2l6ZV9tYXgiLCJzaXplX21heF90b2tlbiIsImRlZl92YWx1ZSIsImRlZmF1bHRfdGV4dF9zdWZmaXgiLCJib2R5IiwidG9TdHJpbmciLCJ0cmltIiwiZG9jdW1lbnQiLCJhZGRFdmVudExpc3RlbmVyIiwib25jZSIsInJlZ2lzdGVyX3RleHRfYm9va2luZ19kYXRhX2V4cG9ydGVyIiwiQyIsIldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciIsImVtaXRfbGluZV9ib2xkX2ZpZWxkIiwid2luZG93Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvdGV4dC9fc3JjL2ZpZWxkLXRleHQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIFdQQkMgQkZCOiBGaWVsZCBSZW5kZXJlciBmb3IgXCJ0ZXh0XCIgKFNjaGVtYS1kcml2ZW4gUmVmZXJlbmNlLCB0ZW1wbGF0ZS1saXRlcmFsIHJlbmRlcilcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKiBQdXJwb3NlOlxyXG4gKiAtIFVzZXMgdGVtcGxhdGUgbGl0ZXJhbHMgKG5vIHdwLnRlbXBsYXRlKVxyXG4gKiAtIEluc3BlY3RvciBpcyByZW5kZXJlZCBieSBGYWN0b3J5IChQSFAgc2NoZW1hKVxyXG4gKiAtIFVzZXMgV1BCQ19CRkJfU2FuaXRpemUgKGZyb20gY29yZSkgd2l0aCBtZXRob2QgbmFtZXMgYXMgaW4gYmZiLWNvcmUuanNcclxuICpcclxuICogQ29udHJhY3RzOlxyXG4gKiAtIFJlZ2lzdHJ5OiAgV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnkucmVnaXN0ZXIoICd0ZXh0JywgQ2xhc3MgKVxyXG4gKiAtIENsYXNzIEFQSTogc3RhdGljIGdldF9kZWZhdWx0cygpLCBzdGF0aWMgcmVuZGVyKGVsLCBkYXRhLCBjdHgpLCBzdGF0aWMgb25fZmllbGRfZHJvcChkYXRhLCBlbCwgY3R4PykgW29wdGlvbmFsXVxyXG4gKlxyXG4gKiBOb3RlczpcclxuICogLSBLZWVwIGRlZmF1bHRzIGFsaWduZWQgd2l0aCBQSFAgc2NoZW1hLT5wcm9wcy0+ZGVmYXVsdC5cclxuICogLSBVc2UgT3ZlcmxheS5lbnN1cmUoLi4uKSBzbyBmaWVsZCBjb250cm9scyAoaGFuZGxlLCBzZXR0aW5ncywgZXRjLikgYXBwZWFyLlxyXG4gKlxyXG4gKiBGaWxlOiAgLi4vaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvdGV4dC9fb3V0L2ZpZWxkLXRleHQuanNcclxuICpcclxuICogQHNpbmNlICAgIDExLjAuMFxyXG4gKiBAbW9kaWZpZWQgIDIwMjUtMDktMDYgMTQ6MDhcclxuICogQHZlcnNpb24gIDEuMC4xXHJcbiAqXHJcbiAqL1xyXG4oZnVuY3Rpb24gKHcpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdHZhciBDb3JlICAgICA9IHcuV1BCQ19CRkJfQ29yZSB8fCB7fTtcclxuXHR2YXIgcmVnaXN0cnkgPSBDb3JlLldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5O1xyXG5cdHZhciBCYXNlICAgICA9IENvcmUuV1BCQ19CRkJfRmllbGRfQmFzZTtcclxuXHJcblx0aWYgKCAhIHJlZ2lzdHJ5IHx8IHR5cGVvZiByZWdpc3RyeS5yZWdpc3RlciAhPT0gJ2Z1bmN0aW9uJyB8fCAhIEJhc2UgKSB7XHJcblx0XHRfd3BiYz8uZGV2Py5lcnJvcj8uKCAnV1BCQ19CRkJfRmllbGRfVGV4dCcsICdDb3JlIHJlZ2lzdHJ5L2Jhc2UgbWlzc2luZycgKTtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdGNsYXNzIFdQQkNfQkZCX0ZpZWxkX1RleHQgZXh0ZW5kcyBCYXNlIHtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJldHVybiBkZWZhdWx0IHByb3BzIGZvciBcInRleHRcIiBmaWVsZC5cclxuXHRcdCAqIE11c3Qgc3RheSBpbiBzeW5jIHdpdGggUEhQIHNjaGVtYSBkZWZhdWx0cy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7T2JqZWN0fVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZ2V0X2RlZmF1bHRzKCkge1xyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdHR5cGUgICAgICAgICA6ICd0ZXh0JyxcclxuXHRcdFx0XHRsYWJlbCAgICAgICAgOiAnVGV4dCcsXHJcblx0XHRcdFx0bmFtZSAgICAgICAgIDogJycsXHJcblx0XHRcdFx0aHRtbF9pZCAgICAgIDogJycsXHJcblx0XHRcdFx0cGxhY2Vob2xkZXIgIDogJycsXHJcblx0XHRcdFx0cmVxdWlyZWQgICAgIDogZmFsc2UsXHJcblx0XHRcdFx0bWlubGVuZ3RoICAgIDogbnVsbCxcclxuXHRcdFx0XHRtYXhsZW5ndGggICAgOiBudWxsLFxyXG5cdFx0XHRcdHBhdHRlcm4gICAgICA6ICcnLFxyXG5cdFx0XHRcdGNzc2NsYXNzICAgICA6ICcnLFxyXG5cdFx0XHRcdGhlbHAgICAgICAgICA6ICcnLFxyXG5cdFx0XHRcdGRlZmF1bHRfdmFsdWU6ICcnXHJcblx0XHRcdH07XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZW5kZXIgdGhlIHByZXZpZXcgbWFya3VwIGludG8gdGhlIGZpZWxkIGVsZW1lbnQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWwgICBGaWVsZCByb290IGVsZW1lbnQgaW5zaWRlIHRoZSBjYW52YXMuXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBkICAgIEZpZWxkIHByb3BzIChhbHJlYWR5IG5vcm1hbGl6ZWQgYnkgc2NoZW1hKS5cclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGN0eCAgQ29udGV4dDogeyBidWlsZGVyLCBzYW5pdCwgLi4uIH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHJlbmRlcihlbCwgZGF0YSwgY3R4KSB7XHJcblxyXG5cdFx0XHRpZiAoICEgZWwgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBOb3JtYWxpemUgYWdhaW5zdCBkZWZhdWx0cyBmaXJzdC5cclxuXHRcdFx0Y29uc3QgZCA9IHRoaXMubm9ybWFsaXplX2RhdGEoIGRhdGEgKTtcclxuXHJcblx0XHRcdC8vIC0tLS0tIENvcmUgc2FuaXRpemUgaGVscGVycyAoc3RhdGljKSAtLS0tLVxyXG5cdFx0XHRjb25zdCBlaCAgICAgPSAodikgPT4gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5lc2NhcGVfaHRtbCggdiApO1xyXG5cdFx0XHRjb25zdCBzaWQgICAgPSAodikgPT4gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5zYW5pdGl6ZV9odG1sX2lkKCB2ICk7XHJcblx0XHRcdGNvbnN0IHNuYW1lICA9ICh2KSA9PiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2h0bWxfbmFtZSggdiApO1xyXG5cdFx0XHRjb25zdCBzY2xhc3MgPSAodikgPT4gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5zYW5pdGl6ZV9jc3NfY2xhc3NsaXN0KCB2ICk7XHJcblx0XHRcdGNvbnN0IHRydXRoeSA9ICh2KSA9PiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLmlzX3RydXRoeSggdiApO1xyXG5cclxuXHRcdFx0Ly8gU2FuaXRpemUgcHVibGljIGlkL25hbWUgZm9yIHRoZSBjb250cm9sIGl0c2VsZi5cclxuXHRcdFx0Y29uc3QgaHRtbF9pZCAgPSBkLmh0bWxfaWQgPyBzaWQoIFN0cmluZyggZC5odG1sX2lkICkgKSA6ICcnO1xyXG5cdFx0XHRjb25zdCBuYW1lX3ZhbCA9IHNuYW1lKCBTdHJpbmcoIGQubmFtZSB8fCBkLmlkIHx8ICdmaWVsZCcgKSApO1xyXG5cdFx0XHRjb25zdCBjc3NOZXh0ICA9IHNjbGFzcyggU3RyaW5nKCBkLmNzc2NsYXNzIHx8ICcnICkgKTtcclxuXHJcblx0XHRcdC8vIEtlZXAgd3JhcHBlciBjbGFzc2VzIGluIHN5bmMgd2l0aCBkYXRhc2V0LmNzc2NsYXNzIE9OTFkgKGRvbuKAmXQgdG91Y2ggY29yZSBjbGFzc2VzKS5cclxuXHRcdFx0Ly8gaWYgKCAnY3NzY2xhc3MnIGluIGQgKSB7XHJcblx0XHRcdC8vIFx0Y29uc3QgcHJldiA9IGVsLmRhdGFzZXQuY3NzY2xhc3MgfHwgJyc7XHJcblx0XHRcdC8vIFx0aWYgKCBwcmV2ICE9PSBjc3NOZXh0ICkge1xyXG5cdFx0XHQvLyBcdFx0cHJldi5zcGxpdCggL1xccysvICkuZmlsdGVyKCBCb29sZWFuICkuZm9yRWFjaCggKGMpID0+IGVsLmNsYXNzTGlzdC5yZW1vdmUoIGMgKSApO1xyXG5cdFx0XHQvLyBcdFx0Y3NzTmV4dC5zcGxpdCggL1xccysvICkuZmlsdGVyKCBCb29sZWFuICkuZm9yRWFjaCggKGMpID0+IGVsLmNsYXNzTGlzdC5hZGQoIGMgKSApO1xyXG5cdFx0XHQvLyBcdFx0ZWwuZGF0YXNldC5jc3NjbGFzcyA9IGNzc05leHQ7XHJcblx0XHRcdC8vIFx0fVxyXG5cdFx0XHQvLyB9XHJcblx0XHRcdC8vIE5FVzogc3RvcmUgb25seTsgZG8gTk9UIG1vZGlmeSB3cmFwcGVyIGNsYXNzZXMuXHJcblx0XHRcdGlmICggJ2Nzc2NsYXNzJyBpbiBkICkge1xyXG5cdFx0XHRcdGlmICggZWwuZGF0YXNldC5jc3NjbGFzcyAhPT0gY3NzTmV4dCApIHtcclxuXHRcdFx0XHRcdGVsLmRhdGFzZXQuY3NzY2xhc3MgPSBjc3NOZXh0O1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHQvLyBLZWVwIHdyYXBwZXIncyBzdG9yZWQgaHRtbF9pZCAoZGF0YXNldCkgdXBkYXRlZC5cclxuXHRcdFx0aWYgKCAnaHRtbF9pZCcgaW4gZCApIHtcclxuXHRcdFx0XHRpZiAoIGVsLmRhdGFzZXQuaHRtbF9pZCAhPT0gaHRtbF9pZCApIHtcclxuXHRcdFx0XHRcdGVsLmRhdGFzZXQuaHRtbF9pZCA9IGh0bWxfaWQ7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBGbGFncyAvIG51bWVyaWMgY29uc3RyYWludHMuXHJcblx0XHRcdGNvbnN0IGlzX3JlcXVpcmVkICAgPSB0cnV0aHkoIGQucmVxdWlyZWQgKTtcclxuXHRcdFx0Y29uc3QgaGFzX21pbmxlbmd0aCA9IChkLm1pbmxlbmd0aCAhPSBudWxsICYmIGQubWlubGVuZ3RoICE9PSAnJyAmJiBOdW1iZXIuaXNGaW5pdGUoICtkLm1pbmxlbmd0aCApKTtcclxuXHRcdFx0Y29uc3QgaGFzX21heGxlbmd0aCA9IChkLm1heGxlbmd0aCAhPSBudWxsICYmIGQubWF4bGVuZ3RoICE9PSAnJyAmJiBOdW1iZXIuaXNGaW5pdGUoICtkLm1heGxlbmd0aCApKTtcclxuXHRcdFx0Y29uc3QgaGFzX3BhdHRlcm4gICA9ICEhZC5wYXR0ZXJuO1xyXG5cclxuXHRcdFx0Y29uc3QgbWlubGVuZ3RoX251bSA9IGhhc19taW5sZW5ndGggPyBOdW1iZXIoIGQubWlubGVuZ3RoICkgOiBudWxsO1xyXG5cdFx0XHRjb25zdCBtYXhsZW5ndGhfbnVtID0gaGFzX21heGxlbmd0aCA/IE51bWJlciggZC5tYXhsZW5ndGggKSA6IG51bGw7XHJcblxyXG5cdFx0XHQvLyBBdHRyaWJ1dGUgZnJhZ21lbnRzICh1c2luZyBlc2NhcGVfaHRtbCBmb3Igc2FmZSBpbm5lckhUTUwgYXR0cmlidXRlIGNvbnRleHQpLlxyXG5cdFx0XHRjb25zdCBpZF9hdHRyICAgICAgICA9IGh0bWxfaWQgPyBgIGlkPVwiJHtlaCggaHRtbF9pZCApfVwiYCA6ICcnO1xyXG5cdFx0XHRjb25zdCBuYW1lX2F0dHIgICAgICA9IGAgbmFtZT1cIiR7ZWgoIG5hbWVfdmFsICl9XCJgO1xyXG5cdFx0XHQvLyBjb25zdCBjbHNfYXR0ciAgICAgICA9IGAgY2xhc3M9XCJ3cGJjX2JmYl9fcHJldmlldy1pbnB1dCAke2VoKCBjc3NOZXh0ICl9XCJgO1xyXG5cdFx0XHRjb25zdCBjbHNfYXR0ciA9IGAgY2xhc3M9XCJ3cGJjX2JmYl9fcHJldmlldy1pbnB1dCAke2Nzc05leHQgPyAnICcgKyBlaChjc3NOZXh0KSA6ICcnfVwiYDtcclxuXHRcdFx0Y29uc3QgcGhfYXR0ciAgICAgICAgPSBkLnBsYWNlaG9sZGVyID8gYCBwbGFjZWhvbGRlcj1cIiR7ZWgoIGQucGxhY2Vob2xkZXIgKX1cImAgOiAnJztcclxuXHRcdFx0Y29uc3QgcmVxX2F0dHIgICAgICAgPSBpc19yZXF1aXJlZCA/ICcgcmVxdWlyZWQgYXJpYS1yZXF1aXJlZD1cInRydWVcIicgOiAnJztcclxuXHRcdFx0Y29uc3QgbWlubGVuZ3RoX2F0dHIgPSBoYXNfbWlubGVuZ3RoID8gYCBtaW5sZW5ndGg9XCIke21pbmxlbmd0aF9udW19XCJgIDogJyc7XHJcblx0XHRcdGNvbnN0IG1heGxlbmd0aF9hdHRyID0gaGFzX21heGxlbmd0aCA/IGAgbWF4bGVuZ3RoPVwiJHttYXhsZW5ndGhfbnVtfVwiYCA6ICcnO1xyXG5cdFx0XHRjb25zdCBwYXR0ZXJuX2F0dHIgICA9IGhhc19wYXR0ZXJuID8gYCBwYXR0ZXJuPVwiJHtlaCggZC5wYXR0ZXJuICl9XCJgIDogJyc7XHJcblx0XHRcdGNvbnN0IHZhbHVlX2F0dHIgPSAoZC5kZWZhdWx0X3ZhbHVlICE9IG51bGwgJiYgZC5kZWZhdWx0X3ZhbHVlICE9PSAnJylcclxuXHRcdFx0XHQ/IGAgdmFsdWU9XCIke2VoKCBTdHJpbmcoIGQuZGVmYXVsdF92YWx1ZSApICl9XCJgXHJcblx0XHRcdFx0OiAnJztcclxuXHRcdFx0Ly8gT3B0aW9uYWwgZnJhZ21lbnRzLlxyXG5cdFx0XHRjb25zdCBsYWJlbF9odG1sID0gKGQubGFiZWwgIT0gbnVsbCAmJiBkLmxhYmVsICE9PSAnJylcclxuXHRcdFx0XHQ/IGA8bGFiZWwgY2xhc3M9XCJ3cGJjX2JmYl9fZmllbGQtbGFiZWxcIiR7aHRtbF9pZCA/IGAgZm9yPVwiJHtlaCggaHRtbF9pZCApfVwiYCA6ICcnfT4ke2VoKCBkLmxhYmVsICl9JHtpc19yZXF1aXJlZCA/ICc8c3BhbiBhcmlhLWhpZGRlbj1cInRydWVcIj4qPC9zcGFuPicgOiAnJ308L2xhYmVsPmBcclxuXHRcdFx0XHQ6ICcnO1xyXG5cclxuXHRcdFx0Y29uc3QgaGVscF9odG1sID0gZC5oZWxwID8gYDxkaXYgY2xhc3M9XCJ3cGJjX2JmYl9faGVscFwiPiR7ZWgoIGQuaGVscCApfTwvZGl2PmAgOiAnJztcclxuXHJcblx0XHRcdC8vIFJlbmRlciBwcmV2aWV3IEhUTUwuXHJcblx0XHRcdGVsLmlubmVySFRNTCA9IGBcclxuXHRcdFx0XHQ8c3BhbiBjbGFzcz1cIndwYmNfYmZiX19ub2FjdGlvbiB3cGJjX2JmYl9fbm8tZHJhZy16b25lXCIgaW5lcnQ9XCJcIj5cclxuXHRcdFx0XHRcdCR7bGFiZWxfaHRtbH1cclxuXHRcdFx0XHRcdDxzcGFuIGNsYXNzPVwid3BiY193cmFwX3RleHQgd3BkZXYtZm9ybS1jb250cm9sLXdyYXBcIj5cclxuXHRcdFx0XHRcdFx0PGlucHV0IHR5cGU9XCJ0ZXh0XCIke2Nsc19hdHRyfSR7cGhfYXR0cn0ke25hbWVfYXR0cn0gYXV0b2NvbXBsZXRlPVwib2ZmXCIgdGFiaW5kZXg9XCItMVwiIGFyaWEtZGlzYWJsZWQ9XCJ0cnVlXCIke2lkX2F0dHJ9JHt2YWx1ZV9hdHRyfSR7cmVxX2F0dHJ9JHttaW5sZW5ndGhfYXR0cn0ke21heGxlbmd0aF9hdHRyfSR7cGF0dGVybl9hdHRyfSAvPlxyXG5cclxuXHRcdFx0XHRcdDwvc3Bhbj5cclxuXHRcdFx0XHRcdCR7aGVscF9odG1sfVxyXG5cdFx0XHRcdDwvc3Bhbj5cclxuXHRcdFx0YDtcclxuXHJcblx0XHRcdC8vIE92ZXJsYXkgKGhhbmRsZXMvdG9vbGJhcnMpLlxyXG5cdFx0XHRDb3JlLlVJPy5XUEJDX0JGQl9PdmVybGF5Py5lbnN1cmU/LiggY3R4Py5idWlsZGVyLCBlbCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogT3B0aW9uYWwgaG9vayBleGVjdXRlZCBhZnRlciBmaWVsZCBpcyBkcm9wcGVkIGZyb20gdGhlIHBhbGV0dGUuXHJcblx0XHQgKiBFeGFtcGxlIHJlY2lwZSBwbGFjZWhvbGRlciBmb3IgZnV0dXJlOiAgIHRyeSB7IGlmICggIWRhdGEubmFtZSApIHsgZGF0YS5uYW1lID0gY29yZS5XUEJDX0JGQl9JZFNlcnZpY2U/Lm5leHRfbmFtZT8uKCAndGV4dCcgKSB8fCAndGV4dCc7IH0gIH0gY2F0Y2ggKCBlICkgeyB9XHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgZGF0YSAgUGFsZXR0ZS9maWVsZCBkYXRhLlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWwgICAgTmV3bHkgY3JlYXRlZCBmaWVsZCBlbGVtZW50LlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgY3R4ICAgQ29udGV4dCB7IGJ1aWxkZXIsIHNhbml0LCBjb250ZXh0OiAnZHJvcCcgfCAnbG9hZCcgfCAncHJldmlldycgfVxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBvbl9maWVsZF9kcm9wKGRhdGEsIGVsLCBjdHgpIHtcclxuXHRcdFx0c3VwZXIub25fZmllbGRfZHJvcD8uKCBkYXRhLCBlbCwgY3R4ICk7ICAvLyBSZXF1aXJlZCBmb3IgY29ycmVjdGx5IGF1dG8tbmFtZXMgZnJvbSAgTGFiZWxzICFcclxuXHRcdFx0Ly8gKHlvdXIgZXh0cmEgcGFjay1zcGVjaWZpYyBsb2dpYyBpZiBldmVyIG5lZWRlZClcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHRyeSB7XHJcblx0XHRyZWdpc3RyeS5yZWdpc3RlciggJ3RleHQnLCBXUEJDX0JGQl9GaWVsZF9UZXh0ICk7XHJcblx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRfd3BiYz8uZGV2Py5lcnJvcj8uKCAnV1BCQ19CRkJfRmllbGRfVGV4dC5yZWdpc3RlcicsIGUgKTtcclxuXHR9XHJcblxyXG5cdC8vIE9wdGlvbmFsIGdsb2JhbCBhbGlhcyAoZGVidWdnaW5nIC8gZGV2IHRvb2xzKS5cclxuXHR3LldQQkNfQkZCX0ZpZWxkX1RleHQgPSB3LldQQkNfQkZCX0ZpZWxkX1RleHQgfHwgV1BCQ19CRkJfRmllbGRfVGV4dDtcclxuXHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRXhwb3J0IGZvciBcIkJvb2tpbmcgRm9ybVwiIChBZHZhbmNlZCBGb3JtIHNob3J0Y29kZSlcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8qKlxyXG5cdCAqIEJvb2tpbmcgRm9ybSBleHBvcnRlciBjYWxsYmFjayAoQWR2YW5jZWQgRm9ybSBzaG9ydGNvZGUpLlxyXG5cdCAqXHJcblx0ICogVGhpcyBjYWxsYmFjayBpcyByZWdpc3RlcmVkIHBlciBmaWVsZCB0eXBlIHZpYTpcclxuXHQgKiAgIFdQQkNfQkZCX0V4cG9ydGVyLnJlZ2lzdGVyKCAndGV4dCcsIGNhbGxiYWNrIClcclxuXHQgKlxyXG5cdCAqIENvcmUgY2FsbCBzaXRlIChidWlsZGVyLWV4cG9ydGVyLmpzKTpcclxuXHQgKiAgIFdQQkNfQkZCX0V4cG9ydGVyLnJ1bl9yZWdpc3RlcmVkX2V4cG9ydGVyKCBmaWVsZCwgaW8sIGNmZywgb25jZSwgY3R4IClcclxuXHQgKiAgICAgLT4gY2FsbGJhY2soIGZpZWxkLCBlbWl0LCB7IGlvLCBjZmcsIG9uY2UsIGN0eCwgY29yZSB9ICk7XHJcblx0ICpcclxuXHQgKiBAY2FsbGJhY2sgV1BCQ19CRkJfRXhwb3J0ZXJDYWxsYmFja1xyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgZmllbGRcclxuXHQgKiAgIE5vcm1hbGl6ZWQgZmllbGQgZGF0YSBjb21pbmcgZnJvbSB0aGUgQnVpbGRlciBzdHJ1Y3R1cmUuXHJcblx0ICogICAtIGZpZWxkLnR5cGUgICAgICAgICAge3N0cmluZ30gICBGaWVsZCB0eXBlLCBlLmcuIFwidGV4dFwiLlxyXG5cdCAqICAgLSBmaWVsZC5uYW1lICAgICAgICAgIHtzdHJpbmd9ICAgTmFtZSBhcyBzdG9yZWQgb24gdGhlIGNhbnZhcyAoYWxyZWFkeSB2YWxpZGF0ZWQpLlxyXG5cdCAqICAgLSBmaWVsZC5pZCAvIGh0bWxfaWQgIHtzdHJpbmd9ICAgT3B0aW9uYWwgSFRNTCBpZCAvIHVzZXItdmlzaWJsZSBpZC5cclxuXHQgKiAgIC0gZmllbGQubGFiZWwgICAgICAgICB7c3RyaW5nfSAgIFZpc2libGUgbGFiZWwgaW4gdGhlIGZvcm0gKG1heSBiZSBlbXB0eSkuXHJcblx0ICogICAtIGZpZWxkLnBsYWNlaG9sZGVyICAge3N0cmluZ30gICBQbGFjZWhvbGRlciB0ZXh0IChtYXkgYmUgZW1wdHkpLlxyXG5cdCAqICAgLSBmaWVsZC5yZXF1aXJlZCAgICAgIHtib29sZWFufG51bWJlcnxzdHJpbmd9IFwidHJ1dGh5XCIgaWYgcmVxdWlyZWQuXHJcblx0ICogICAtIGZpZWxkLmNzc2NsYXNzICAgICAge3N0cmluZ30gICBFeHRyYSBDU1MgY2xhc3NlcyBlbnRlcmVkIGluIEluc3BlY3Rvci5cclxuXHQgKiAgIC0gZmllbGQuZGVmYXVsdF92YWx1ZSB7c3RyaW5nfSAgIERlZmF1bHQgdGV4dCB2YWx1ZS5cclxuXHQgKiAgIC0gZmllbGQub3B0aW9ucyAgICAgICB7QXJyYXl9ICAgIE9ubHkgZm9yIG9wdGlvbi1iYXNlZCBmaWVsZHMgKHNlbGVjdCwgY2hlY2tib3gsIGV0Yy4pLlxyXG5cdCAqICAgLSAuLi4gICAgICAgICAgICAgICAgIChBbnkgb3RoZXIgcGFjay1zcGVjaWZpYyBwcm9wcyBhcmUgYWxzbyBwcmVzZW50LilcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7ZnVuY3Rpb24oc3RyaW5nKTp2b2lkfSBlbWl0XHJcblx0ICogICBFbWl0cyBvbmUgbGluZS9mcmFnbWVudCBpbnRvIHRoZSBleHBvcnQgYnVmZmVyLlxyXG5cdCAqICAgLSBFYWNoIGNhbGwgY29ycmVzcG9uZHMgdG8gb25lIGBwdXNoKClgIGluIHRoZSBjb3JlIGV4cG9ydGVyLlxyXG5cdCAqICAgLSBGb3IgbXVsdGktbGluZSBvdXRwdXQgKGUuZy4gbGFiZWwgKyBzaG9ydGNvZGUpLCBjYWxsIGBlbWl0KClgIG11bHRpcGxlIHRpbWVzOlxyXG5cdCAqICAgICAgIGVtaXQoJzxsPkxhYmVsPC9sPicpO1xyXG5cdCAqICAgICAgIGVtaXQoJzxicj5bdGV4dCogbmFtZSAuLi5dJyk7XHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gW2V4dHJhc11cclxuXHQgKiAgIEV4dHJhIGNvbnRleHQgcGFzc2VkIGJ5IHRoZSBjb3JlIGV4cG9ydGVyLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IFtleHRyYXMuaW9dXHJcblx0ICogICBMb3ctbGV2ZWwgd3JpdGVyIHVzZWQgaW50ZXJuYWxseSBieSB0aGUgY29yZS5cclxuXHQgKiAgIE5vcm1hbGx5IHlvdSBkbyBOT1QgbmVlZCBpdCBpbiBwYWNrcyDigJQgcHJlZmVyIGBlbWl0KClgLlxyXG5cdCAqICAgLSBleHRyYXMuaW8ub3BlbihzdHIpICAgLT4gb3BlbiBhIG5lc3RlZCBibG9jayAoaW5jcmVtZW50cyBpbmRlbnRhdGlvbikuXHJcblx0ICogICAtIGV4dHJhcy5pby5jbG9zZShzdHIpICAtPiBjbG9zZSBhIGJsb2NrIChkZWNyZW1lbnRzIGluZGVudGF0aW9uKS5cclxuXHQgKiAgIC0gZXh0cmFzLmlvLnB1c2goc3RyKSAgIC0+IHB1c2ggcmF3IGxpbmUgKHVzZWQgYnkgYGVtaXQoKWApLlxyXG5cdCAqICAgLSBleHRyYXMuaW8uYmxhbmsoKSAgICAgLT4gcHVzaCBhbiBlbXB0eSBsaW5lLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IFtleHRyYXMuY2ZnXVxyXG5cdCAqICAgRXhwb3J0IGNvbmZpZ3VyYXRpb24gKHNhbWUgb2JqZWN0IHBhc3NlZCB0byBXUEJDX0JGQl9FeHBvcnRlci5leHBvcnRfZm9ybSgpKS5cclxuXHQgKiAgIFVzZWZ1bCBmbGFncyBmb3IgZmllbGQgcGFja3M6XHJcblx0ICogICAtIGV4dHJhcy5jZmcuYWRkTGFiZWxzIHtib29sZWFufSAgRGVmYXVsdDogdHJ1ZS5cclxuXHQgKiAgICAgICBJZiBmYWxzZSwgcGFja3Mgc2hvdWxkIE5PVCBlbWl0IDxsPkxhYmVsPC9sPiBsaW5lcy5cclxuXHQgKiAgIC0gZXh0cmFzLmNmZy5uZXdsaW5lICAge3N0cmluZ30gICBOZXdsaW5lIHNlcGFyYXRvciAodXN1YWxseSBcIlxcblwiKS5cclxuXHQgKiAgIC0gZXh0cmFzLmNmZy5nYXBQZXJjZW50e251bWJlcn0gICBMYXlvdXQgZ2FwICh1c2VkIG9ubHkgYnkgc2VjdGlvbi9jb2x1bW4gbG9naWMpLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IFtleHRyYXMub25jZV1cclxuXHQgKiAgIFNoYXJlZCBcIm9uY2UtcGVyLWZvcm1cIiBndWFyZHMgYWNyb3NzIGFsbCBmaWVsZHMuXHJcblx0ICogICBDb3VudGVycyBhcmUgaW5jcmVtZW50ZWQgYnkgc29tZSBmaWVsZCB0eXBlcyAoY2FwdGNoYSwgY291cG9uLCBldGMuKS5cclxuXHQgKiAgIFR5cGljYWwgc2hhcGU6XHJcblx0ICogICAtIGV4dHJhcy5vbmNlLmNhcHRjaGEgICAgICAgICAge251bWJlcn1cclxuXHQgKiAgIC0gZXh0cmFzLm9uY2UuY291bnRyeSAgICAgICAgICB7bnVtYmVyfVxyXG5cdCAqICAgLSBleHRyYXMub25jZS5jb3Vwb24gICAgICAgICAgIHtudW1iZXJ9XHJcblx0ICogICAtIGV4dHJhcy5vbmNlLmNvc3RfY29ycmVjdGlvbnMge251bWJlcn1cclxuXHQgKiAgIC0gZXh0cmFzLm9uY2Uuc3VibWl0ICAgICAgICAgICB7bnVtYmVyfVxyXG5cdCAqXHJcblx0ICogICBUZXh0IGZpZWxkIHVzdWFsbHkgZG9lcyBub3QgdG91Y2ggdGhpcyBvYmplY3QsIGJ1dCBvdGhlciBwYWNrcyBjYW4gdXNlIGl0XHJcblx0ICogICB0byBza2lwIGR1cGxpY2F0ZXMgKGUuZy4gb25seSB0aGUgZmlyc3QgW2NvdXBvbl0gcGVyIGZvcm0gaXMgZXhwb3J0ZWQpLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IFtleHRyYXMuY3R4XVxyXG5cdCAqICAgU2hhcmVkIGV4cG9ydCBjb250ZXh0IGZvciB0aGUgZW50aXJlIGZvcm0uXHJcblx0ICogICBDdXJyZW50bHk6XHJcblx0ICogICAtIGV4dHJhcy5jdHgudXNlZElkcyB7U2V0PHN0cmluZz59XHJcblx0ICogICAgICAgU2V0IG9mIEhUTUwvc2hvcnRjb2RlIElEcyBhbHJlYWR5IHVzZWQgaW4gdGhpcyBleHBvcnQuXHJcblx0ICogICAgICAgSGVscGVycyBsaWtlIEV4cC5pZF9vcHRpb24oZmllbGQsIGN0eCkgdXNlIGl0IHRvIGVuc3VyZSB1bmlxdWVuZXNzLlxyXG5cdCAqXHJcblx0ICogICBQYWNrcyBub3JtYWxseSBqdXN0IHBhc3MgYGN0eGAgaW50byBoZWxwZXJzIChpZF9vcHRpb24sIGV0Yy4pIHdpdGhvdXRcclxuXHQgKiAgIG11dGF0aW5nIGl0IGRpcmVjdGx5LlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IFtleHRyYXMuY29yZV1cclxuXHQgKiAgIFJlZmVyZW5jZSB0byBXUEJDX0JGQl9Db3JlIHBhc3NlZCBmcm9tIGJ1aWxkZXItZXhwb3J0ZXIuanMuXHJcblx0ICogICBQcmltYXJpbHkgdXNlZCB0byBhY2Nlc3Mgc2FuaXRpemVyczpcclxuXHQgKiAgIC0gZXh0cmFzLmNvcmUuV1BCQ19CRkJfU2FuaXRpemUuZXNjYXBlX2h0bWwoLi4uKVxyXG5cdCAqICAgLSBleHRyYXMuY29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5lc2NhcGVfZm9yX3Nob3J0Y29kZSguLi4pXHJcblx0ICogICAtIGV4dHJhcy5jb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2h0bWxfbmFtZSguLi4pXHJcblx0ICogICAtIGV0Yy5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiByZWdpc3Rlcl90ZXh0X2Jvb2tpbmdfZm9ybV9leHBvcnRlcigpIHtcclxuXHJcblx0XHRjb25zdCBFeHAgPSB3LldQQkNfQkZCX0V4cG9ydGVyO1xyXG5cdFx0aWYgKCAhIEV4cCB8fCB0eXBlb2YgRXhwLnJlZ2lzdGVyICE9PSAnZnVuY3Rpb24nICkgeyByZXR1cm47IH1cclxuXHRcdGlmICggdHlwZW9mIEV4cC5oYXNfZXhwb3J0ZXIgPT09ICdmdW5jdGlvbicgJiYgRXhwLmhhc19leHBvcnRlciggJ3RleHQnICkgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdGNvbnN0IFMgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplO1xyXG5cclxuXHRcdEV4cC5yZWdpc3RlciggJ3RleHQnLCAoZmllbGQsIGVtaXQsIGV4dHJhcyA9IHt9KSA9PiB7XHJcblxyXG5cdFx0XHRjb25zdCBjZmcgICAgICAgPSBleHRyYXMuY2ZnIHx8IHt9O1xyXG5cdFx0XHRjb25zdCBjdHggICAgICAgPSBleHRyYXMuY3R4OyAgICAgICAgICAvLyBubyBsb2NhbCBmYWxsYmFjayBuZWVkZWQuXHJcblx0XHRcdGNvbnN0IGFkZExhYmVscyA9IGNmZy5hZGRMYWJlbHMgIT09IGZhbHNlO1xyXG5cclxuXHRcdFx0Ly8gUmVxdWlyZWQgbWFya2VyIGxvZ2ljIChzYW1lIGFzIGJlZm9yZSkuXHJcblx0XHRcdGNvbnN0IGlzX3JlcSAgID0gRXhwLmlzX3JlcXVpcmVkKCBmaWVsZCApO1xyXG5cdFx0XHRjb25zdCByZXFfbWFyayA9IGlzX3JlcSA/ICcqJyA6ICcnO1xyXG5cclxuXHRcdFx0Ly8gUmV1c2UgaGVscGVycyBmcm9tIFdQQkNfQkZCX0V4cG9ydGVyLlxyXG5cdFx0XHRjb25zdCBuYW1lICAgICAgPSBFeHAuY29tcHV0ZV9uYW1lKCAndGV4dCcsIGZpZWxkICk7XHJcblx0XHRcdGNvbnN0IGlkX29wdCAgICA9IEV4cC5pZF9vcHRpb24oIGZpZWxkLCBjdHggKTtcclxuXHRcdFx0Y29uc3QgY2xzX29wdHMgID0gRXhwLmNsYXNzX29wdGlvbnMoIGZpZWxkICk7XHJcblx0XHRcdGNvbnN0IHBoX2F0dHIgICA9IEV4cC5waF9hdHRyKCBmaWVsZC5wbGFjZWhvbGRlciApO1xyXG5cdFx0XHRjb25zdCBzaXplX21heCAgPSBFeHAuc2l6ZV9tYXhfdG9rZW4oIGZpZWxkICk7XHJcblx0XHRcdGNvbnN0IGRlZl92YWx1ZSA9IEV4cC5kZWZhdWx0X3RleHRfc3VmZml4KCBmaWVsZCApO1xyXG5cclxuXHRcdFx0Ly8gQnVpbGQgYm9keSBzaG9ydGNvZGUuXHJcblx0XHRcdGNvbnN0IGJvZHkgPSBgW3RleHQke3JlcV9tYXJrfSAke25hbWV9JHtzaXplX21heH0ke2lkX29wdH0ke2Nsc19vcHRzfSR7cGhfYXR0cn0ke2RlZl92YWx1ZX1dYDtcclxuXHJcblx0XHRcdC8vIExhYmVsIGJlaGF2aW9yIGlkZW50aWNhbCB0byBsZWdhY3kgZW1pdF9sYWJlbF90aGVuKCkuXHJcblx0XHRcdGNvbnN0IGxhYmVsID0gKGZpZWxkLmxhYmVsID8/ICcnKS50b1N0cmluZygpLnRyaW0oKTtcclxuXHRcdFx0aWYgKCBsYWJlbCAmJiBhZGRMYWJlbHMgKSB7XHJcblx0XHRcdFx0ZW1pdCggYDxsPiR7Uy5lc2NhcGVfaHRtbCggbGFiZWwgKX0ke3JlcV9tYXJrfTwvbD5gICk7XHJcblx0XHRcdFx0ZW1pdCggYDxicj4ke2JvZHl9YCApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGVtaXQoIGJvZHkgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvLyBIZWxwIHRleHQgaXMgYXBwZW5kZWQgY2VudHJhbGx5IGJ5IFdQQkNfQkZCX0V4cG9ydGVyLnJlbmRlcl9maWVsZF9ub2RlKCkuXHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHQvLyBUcnkgaW1tZWRpYXRlIHJlZ2lzdHJhdGlvbjsgaWYgY29yZSBpc27igJl0IHJlYWR5LCB3YWl0IGZvciB0aGUgZXZlbnQuXHJcblx0aWYgKCB3LldQQkNfQkZCX0V4cG9ydGVyICYmIHR5cGVvZiB3LldQQkNfQkZCX0V4cG9ydGVyLnJlZ2lzdGVyID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0cmVnaXN0ZXJfdGV4dF9ib29raW5nX2Zvcm1fZXhwb3J0ZXIoKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6YmZiOmV4cG9ydGVyLXJlYWR5JywgcmVnaXN0ZXJfdGV4dF9ib29raW5nX2Zvcm1fZXhwb3J0ZXIsIHsgb25jZTogdHJ1ZSB9ICk7XHJcblx0fVxyXG5cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBFeHBvcnQgZm9yIFwiQm9va2luZyBEYXRhXCIgKENvbnRlbnQgb2YgYm9va2luZyBmaWVsZHMgZGF0YSlcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8qKlxyXG5cdCAqIEJvb2tpbmcgRGF0YSBleHBvcnRlciBjYWxsYmFjayAoXCJDb250ZW50IG9mIGJvb2tpbmcgZmllbGRzIGRhdGFcIikuICBEZWZhdWx0IG91dHB1dDogPGI+TGFiZWw8L2I+OiA8Zj5bZmllbGRfbmFtZV08L2Y+PGJyPlxyXG5cdCAqXHJcblx0ICogUmVnaXN0ZXJlZCBwZXIgZmllbGQgdHlwZSB2aWE6XHJcblx0ICogICBXUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIucmVnaXN0ZXIoICd0ZXh0JywgY2FsbGJhY2sgKVxyXG5cdCAqXHJcblx0ICogQ29yZSBjYWxsIHNpdGUgKGJ1aWxkZXItZXhwb3J0ZXIuanMpOlxyXG5cdCAqICAgV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyLnJ1bl9yZWdpc3RlcmVkX2V4cG9ydGVyKCBmaWVsZCwgZW1pdCwgeyBjZmcsIGNvcmUgfSApO1xyXG5cdCAqXHJcblx0ICogQGNhbGxiYWNrIFdQQkNfQkZCX0NvbnRlbnRFeHBvcnRlckNhbGxiYWNrXHJcblx0ICogQHBhcmFtIHtPYmplY3R9ICBmaWVsZFxyXG5cdCAqICAgTm9ybWFsaXplZCBmaWVsZCBkYXRhIChzYW1lIHNoYXBlIGFzIGluIHRoZSBtYWluIGV4cG9ydGVyKS5cclxuXHQgKiAgIEltcG9ydGFudCBwcm9wZXJ0aWVzIGZvciBjb250ZW50IHRlbXBsYXRlczpcclxuXHQgKiAgIC0gZmllbGQudHlwZSAgICAgIHtzdHJpbmd9ICBGaWVsZCB0eXBlLCBlLmcuIFwidGV4dFwiLlxyXG5cdCAqICAgLSBmaWVsZC5uYW1lICAgICAge3N0cmluZ30gIEZpZWxkIG5hbWUgdXNlZCBhcyBwbGFjZWhvbGRlciB0b2tlbi5cclxuXHQgKiAgIC0gZmllbGQubGFiZWwgICAgIHtzdHJpbmd9ICBIdW1hbi1yZWFkYWJsZSBsYWJlbCAobWF5IGJlIGVtcHR5KS5cclxuXHQgKiAgIC0gZmllbGQub3B0aW9ucyAgIHtBcnJheX0gICBGb3Igb3B0aW9uLWJhc2VkIGZpZWxkcyAoc2VsZWN0LCBjaGVja2JveCwgcmFkaW8sIGV0Yy4pLlxyXG5cdCAqICAgLSBPdGhlciBwYWNrLXNwZWNpZmljIHByb3BzIGlmIG5lZWRlZC5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7ZnVuY3Rpb24oc3RyaW5nKTp2b2lkfSBlbWl0XHJcblx0ICogICBFbWl0cyBhIHJhdyBIVE1MIGZyYWdtZW50IGludG8gdGhlIFwiQ29udGVudCBvZiBib29raW5nIGZpZWxkcyBkYXRhXCIgdGVtcGxhdGUuXHJcblx0ICogICBDb3JlIHdpbGwgd3JhcCBldmVyeXRoaW5nIG9uY2UgaW50bzpcclxuXHQgKiAgICAgPGRpdiBjbGFzcz1cInN0YW5kYXJkLWNvbnRlbnQtZm9ybVwiPlxyXG5cdCAqICAgICAgIC4uLiBlbWl0dGVkIGZyYWdtZW50cyAuLi5cclxuXHQgKiAgICAgPC9kaXY+XHJcblx0ICpcclxuXHQgKiAgIFR5cGljYWwgdXNhZ2UgcGF0dGVybjpcclxuXHQgKiAgICAgZW1pdCgnPGI+TGFiZWw8L2I+OiA8Zj5bZmllbGRfbmFtZV08L2Y+PGJyPicpO1xyXG5cdCAqXHJcblx0ICogICBJbiBtb3N0IGNhc2VzLCBwYWNrcyBjYWxsIHRoZSBzaGFyZWQgaGVscGVyOlxyXG5cdCAqICAgICBXUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIuZW1pdF9saW5lX2JvbGRfZmllbGQoZW1pdCwgbGFiZWwsIHRva2VuLCBjZmcpO1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IFtleHRyYXNdXHJcblx0ICogICBBZGRpdGlvbmFsIGNvbnRleHQgcGFzc2VkIGZyb20gcnVuX3JlZ2lzdGVyZWRfZXhwb3J0ZXIoKS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBbZXh0cmFzLmNmZ11cclxuXHQgKiAgIENvbnRlbnQgZXhwb3J0ZXIgY29uZmlndXJhdGlvbjpcclxuXHQgKiAgIC0gZXh0cmFzLmNmZy5hZGRMYWJlbHMge2Jvb2xlYW59IERlZmF1bHQ6IHRydWUuXHJcblx0ICogICAgICAgSWYgZmFsc2UsIGhlbHBlciBtYXkgb21pdCB0aGUgYm9sZCBsYWJlbCBwYXJ0LlxyXG5cdCAqICAgLSBleHRyYXMuY2ZnLnNlcCAgICAgICB7c3RyaW5nfSAgTGFiZWwgc2VwYXJhdG9yLCBkZWZhdWx0IFwiOiBcIi5cclxuXHQgKiAgICAgICBFeGFtcGxlOiBcIjxiPkxhYmVsPC9iPjogXCIgdnMgXCI8Yj5MYWJlbDwvYj4g4oCTIFwiLlxyXG5cdCAqICAgLSBleHRyYXMuY2ZnLm5ld2xpbmUgICB7c3RyaW5nfSAgTmV3bGluZSBzZXBhcmF0b3Igd2hlbiBqb2luaW5nIGxpbmVzICh1c3VhbGx5IFwiXFxuXCIpLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IFtleHRyYXMuY29yZV1cclxuXHQgKiAgIFJlZmVyZW5jZSB0byBXUEJDX0JGQl9Db3JlIChzYW1lIGFzIGluIG1haW4gZXhwb3J0ZXIpLlxyXG5cdCAqICAgVXN1YWxseSBub3QgbmVlZGVkIGhlcmUsIGJlY2F1c2U6XHJcblx0ICogICAtIFNhbml0aXphdGlvbiBhbmQgY29uc2lzdGVudCByZW5kZXJpbmcgYXJlIGFscmVhZHkgZG9uZSB2aWFcclxuXHQgKiAgICAgV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyLmVtaXRfbGluZV9ib2xkX2ZpZWxkKCAuLi4gKS5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiByZWdpc3Rlcl90ZXh0X2Jvb2tpbmdfZGF0YV9leHBvcnRlcigpIHtcclxuXHJcblx0XHRjb25zdCBDID0gdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXI7XHJcblx0XHRpZiAoICEgQyB8fCB0eXBlb2YgQy5yZWdpc3RlciAhPT0gJ2Z1bmN0aW9uJyApIHsgcmV0dXJuOyB9XHJcblx0XHRpZiAoIHR5cGVvZiBDLmhhc19leHBvcnRlciA9PT0gJ2Z1bmN0aW9uJyAmJiBDLmhhc19leHBvcnRlciggJ3RleHQnICkgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdEMucmVnaXN0ZXIoICd0ZXh0JywgZnVuY3Rpb24gKGZpZWxkLCBlbWl0LCBleHRyYXMpIHtcclxuXHJcblx0XHRcdGV4dHJhcyA9IGV4dHJhcyB8fCB7fTtcclxuXHRcdFx0Y29uc3QgY2ZnID0gZXh0cmFzLmNmZyB8fCB7fTtcclxuXHJcblx0XHRcdGNvbnN0IEV4cCA9IHcuV1BCQ19CRkJfRXhwb3J0ZXI7XHJcblx0XHRcdGlmICggISBFeHAgfHwgdHlwZW9mIEV4cC5jb21wdXRlX25hbWUgIT09ICdmdW5jdGlvbicgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0Y29uc3QgbmFtZSA9IEV4cC5jb21wdXRlX25hbWUoICd0ZXh0JywgZmllbGQgKTtcclxuXHRcdFx0aWYgKCAhIG5hbWUgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0Y29uc3QgbGFiZWwgPSAodHlwZW9mIGZpZWxkLmxhYmVsID09PSAnc3RyaW5nJyAmJiBmaWVsZC5sYWJlbC50cmltKCkpID8gZmllbGQubGFiZWwudHJpbSgpIDogbmFtZTtcclxuXHJcblx0XHRcdC8vIFNoYXJlZCBmb3JtYXR0ZXIga2VlcHMgYWxsIHBhY2tzIGNvbnNpc3RlbnQ6LlxyXG5cdFx0XHRDLmVtaXRfbGluZV9ib2xkX2ZpZWxkKCBlbWl0LCBsYWJlbCwgbmFtZSwgY2ZnICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRpZiAoIHcuV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyICYmIHR5cGVvZiB3LldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlci5yZWdpc3RlciA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdHJlZ2lzdGVyX3RleHRfYm9va2luZ19kYXRhX2V4cG9ydGVyKCk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOmJmYjpjb250ZW50LWV4cG9ydGVyLXJlYWR5JywgcmVnaXN0ZXJfdGV4dF9ib29raW5nX2RhdGFfZXhwb3J0ZXIsIHsgb25jZTogdHJ1ZSB9ICk7XHJcblx0fVxyXG5cclxufSkoIHdpbmRvdyApO1xyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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
