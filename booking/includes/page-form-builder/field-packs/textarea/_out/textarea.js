"use strict";

/**
 * WPBC BFB: Textarea Renderer (Schema-driven)
 * =====================================================================================================================
 * File: /includes/page-form-builder/field-packs/textarea/_out/textarea.js
 * =====================================================================================================================
 */
(function (w) {
  'use strict';

  var Core = w.WPBC_BFB_Core || {};
  var registry = Core.WPBC_BFB_Field_Renderer_Registry;
  var Base = Core.WPBC_BFB_Field_Base;
  if (!registry || typeof registry.register !== 'function' || !Base) {
    _wpbc?.dev?.error?.('WPBC_BFB_Field_Textarea', 'Core registry/base missing');
    return;
  }

  /**
   * WPBC BFB: Field Renderer for "textarea" (Schema-driven, template-literal render)
   *
   * Contracts:
   * - Registry:  WPBC_BFB_Field_Renderer_Registry.register( 'textarea', Class )
   * - Class API: static get_defaults(), static render(el, data, ctx), static on_field_drop(data, el, ctx?) [optional]
   *
   * Notes:
   * - Keep defaults aligned with PHP schema->props->default.
   * - Uses WPBC_BFB_Sanitize helpers from Core.
   * - Uses Overlay.ensure(...) so field controls (handle, settings, etc.) appear.
   */
  class WPBC_BFB_Field_Textarea extends Base {
    /**
     * Return default props for "textarea" field.
     * Must stay in sync with PHP schema defaults.
     *
     * @returns {Object}
     */
    static get_defaults() {
      return {
        type: 'textarea',
        label: 'Textarea',
        name: '',
        html_id: '',
        placeholder: '',
        required: false,
        minlength: null,
        maxlength: null,
        rows: 4,
        cssclass: '',
        help: '',
        default_value: '',
        min_width: '260px'
      };
    }

    /**
     * Render the preview markup into the field element.
     *
     * @param {HTMLElement} el   Field root element inside the canvas.
     * @param {Object}      data Field props (already normalized by schema).
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
      const css_next = sclass(String(d.cssclass || ''));

      // Keep dataset in sync (do not mutate wrapper classes).
      if ('cssclass' in d && el.dataset.cssclass !== css_next) {
        el.dataset.cssclass = css_next;
      }
      if ('html_id' in d && el.dataset.html_id !== html_id) {
        el.dataset.html_id = html_id;
      }
      // NEW: persist min_width for the Min-Width guard / layout controller.
      if (d.min_width) {
        el.dataset.min_width = String(d.min_width);
        el.style.setProperty('--wpbc-col-min', String(d.min_width));
      }

      // Flags / numeric constraints.
      const is_required = truthy(d.required);
      const has_minlength = d.minlength != null && d.minlength !== '' && Number.isFinite(+d.minlength);
      const has_maxlength = d.maxlength != null && d.maxlength !== '' && Number.isFinite(+d.maxlength);
      const rows_num = d.rows != null && Number.isFinite(+d.rows) && +d.rows > 0 ? Math.max(1, Math.min(50, +d.rows)) : 4;
      const minlength_num = has_minlength ? Number(d.minlength) : null;
      const maxlength_num = has_maxlength ? Number(d.maxlength) : null;

      // Attribute fragments.
      const id_attr = html_id ? ` id="${eh(html_id)}"` : '';
      const name_attr = ` name="${eh(name_val)}"`;
      // Include the base preview class so the canvas styles apply.
      const cls_attr = ` class="wpbc_bfb__preview-input wpbc_bfb__preview-textarea${css_next ? ' ' + eh(css_next) : ''}"`;
      const ph_attr = d.placeholder ? ` placeholder="${eh(d.placeholder)}"` : '';
      const req_attr = is_required ? ' required aria-required="true"' : '';
      const minlength_attr = has_minlength ? ` minlength="${minlength_num}"` : '';
      const maxlength_attr = has_maxlength ? ` maxlength="${maxlength_num}"` : '';
      const rows_attr = ` rows="${rows_num}"`;
      const label_html = d.label != null && d.label !== '' ? `<label class="wpbc_bfb__field-label"${html_id ? ` for="${eh(html_id)}"` : ''}>${eh(d.label)}${is_required ? '<span aria-hidden="true">*</span>' : ''}</label>` : '';
      const help_html = d.help ? `<div class="wpbc_bfb__help">${eh(d.help)}</div>` : '';
      const default_text = d.default_value != null && d.default_value !== '' ? eh(String(d.default_value)) : '';
      el.innerHTML = `
				<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="">
					${label_html}
					<span class="wpbc_wrap_text wpdev-form-control-wrap">
						<textarea${cls_attr}${ph_attr}${name_attr} tabindex="-1" aria-disabled="true"${id_attr}${rows_attr}${req_attr}${minlength_attr}${maxlength_attr}>${default_text}</textarea>
					</span>
					${help_html}
				</span>
			`;

      // Overlay (handles/toolbars).
      Core.UI?.WPBC_BFB_Overlay?.ensure?.(ctx?.builder, el);
    }

    /**
     * Optional hook executed after field is dropped from the palette.
     *
     * @param {Object}      data  Palette/field data.
     * @param {HTMLElement} el    Newly created field element.
     * @param {Object}      ctx   Context { builder, sanit, context: 'drop' | 'load' | 'preview' }
     * @returns {void}
     */
    static on_field_drop(data, el, ctx) {
      super.on_field_drop?.(data, el, ctx);
    }
  }
  try {
    registry.register('textarea', WPBC_BFB_Field_Textarea);
  } catch (e) {
    _wpbc?.dev?.error?.('WPBC_BFB_Field_Textarea.register', e);
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Form" (Advanced Form shortcode)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Booking Form exporter callback for "textarea".
   *
   * Produces shortcodes equivalent to the legacy exporter:
   *   [textarea* your-name 40x4 id:your-name class:your-class "Default text"]
   *
   * Labels and help text are handled in the same centralized way as other packs.
   */
  function register_textarea_booking_form_exporter() {
    var Exp = w.WPBC_BFB_Exporter;
    if (!Exp || typeof Exp.register !== 'function') {
      return;
    }
    if (typeof Exp.has_exporter === 'function' && Exp.has_exporter('textarea')) {
      return;
    }
    var S = Core.WPBC_BFB_Sanitize || {};

    /**
     * @type {WPBC_BFB_ExporterCallback}
     */
    Exp.register('textarea', function (field, emit, extras) {
      extras = extras || {};
      var cfg = extras.cfg || {};
      var ctx = extras.ctx;
      var addLabels = cfg.addLabels !== false;

      // Required marker (same semantics as text field).
      var is_req = Exp.is_required(field);
      var req_mark = is_req ? '*' : '';

      // Shared helpers keep naming / id / classes consistent across packs.
      var name = Exp.compute_name('textarea', field);
      var id_opt = Exp.id_option(field, ctx);
      var cls_opts = Exp.class_options(field);
      var ph_attr = Exp.ph_attr(field && field.placeholder);
      var def_text = Exp.default_text_suffix(field);

      // Rows token: [textarea name x5] — rows come from schema/Inspector (`field.rows`).
      // Clamp into [1,50] to mirror Inspector constraints.
      var rows_token = '';
      if (field && field.rows != null && field.rows !== '') {
        var r = Number(field.rows);
        if (!Number.isFinite(r)) {
          r = 4;
        }
        if (r < 1) {
          r = 1;
        }
        if (r > 50) {
          r = 50;
        }
        rows_token = ' x' + String(r);
      }

      // Final shortcode body (rows-only sizing; no columns), e.g.:
      //   [textarea* your-message x5 id:your-message class:... "Default text"]
      var body = '[textarea' + req_mark + ' ' + name + rows_token + id_opt + cls_opts + ph_attr + def_text + ']';

      // Label behavior mirrors legacy emit_label_then().
      var raw_label = field && typeof field.label === 'string' ? field.label : '';
      var label = raw_label.trim();
      if (label && addLabels) {
        emit('<l>' + (S.escape_html ? S.escape_html(label) : label) + req_mark + '</l>');
        emit('<br>' + body);
      } else {
        emit(body);
      }
      // Help text is appended centrally by WPBC_BFB_Exporter.render_field_node().
    });
  }
  if (w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function') {
    register_textarea_booking_form_exporter();
  } else if (typeof document !== 'undefined') {
    document.addEventListener('wpbc:bfb:exporter-ready', register_textarea_booking_form_exporter, {
      once: true
    });
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Data" (Content of booking fields data)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Booking Data exporter ("Content of booking fields data") for "textarea".
   *
   * Default line format:
   *   <b>Label</b>: <f>[field_name]</f><br>
   */
  function register_textarea_booking_data_exporter() {
    var C = w.WPBC_BFB_ContentExporter;
    if (!C || typeof C.register !== 'function') {
      return;
    }
    if (typeof C.has_exporter === 'function' && C.has_exporter('textarea')) {
      return;
    }
    C.register('textarea', function (field, emit, extras) {
      extras = extras || {};
      var cfg = extras.cfg || {};
      var Exp = w.WPBC_BFB_Exporter;
      if (!Exp || typeof Exp.compute_name !== 'function') {
        return;
      }
      var name = Exp.compute_name('textarea', field);
      if (!name) {
        return;
      }
      var label = field && typeof field.label === 'string' && field.label.trim() ? field.label.trim() : name;

      // Shared helper keeps formatting consistent across all packs.
      C.emit_line_bold_field(emit, label, name, cfg);
    });
  }
  if (w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function') {
    register_textarea_booking_data_exporter();
  } else if (typeof document !== 'undefined') {
    document.addEventListener('wpbc:bfb:content-exporter-ready', register_textarea_booking_data_exporter, {
      once: true
    });
  }
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvdGV4dGFyZWEvX291dC90ZXh0YXJlYS5qcyIsIm5hbWVzIjpbInciLCJDb3JlIiwiV1BCQ19CRkJfQ29yZSIsInJlZ2lzdHJ5IiwiV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnkiLCJCYXNlIiwiV1BCQ19CRkJfRmllbGRfQmFzZSIsInJlZ2lzdGVyIiwiX3dwYmMiLCJkZXYiLCJlcnJvciIsIldQQkNfQkZCX0ZpZWxkX1RleHRhcmVhIiwiZ2V0X2RlZmF1bHRzIiwidHlwZSIsImxhYmVsIiwibmFtZSIsImh0bWxfaWQiLCJwbGFjZWhvbGRlciIsInJlcXVpcmVkIiwibWlubGVuZ3RoIiwibWF4bGVuZ3RoIiwicm93cyIsImNzc2NsYXNzIiwiaGVscCIsImRlZmF1bHRfdmFsdWUiLCJtaW5fd2lkdGgiLCJyZW5kZXIiLCJlbCIsImRhdGEiLCJjdHgiLCJkIiwibm9ybWFsaXplX2RhdGEiLCJlaCIsInYiLCJXUEJDX0JGQl9TYW5pdGl6ZSIsImVzY2FwZV9odG1sIiwic2lkIiwic2FuaXRpemVfaHRtbF9pZCIsInNuYW1lIiwic2FuaXRpemVfaHRtbF9uYW1lIiwic2NsYXNzIiwic2FuaXRpemVfY3NzX2NsYXNzbGlzdCIsInRydXRoeSIsImlzX3RydXRoeSIsIlN0cmluZyIsIm5hbWVfdmFsIiwiaWQiLCJjc3NfbmV4dCIsImRhdGFzZXQiLCJzdHlsZSIsInNldFByb3BlcnR5IiwiaXNfcmVxdWlyZWQiLCJoYXNfbWlubGVuZ3RoIiwiTnVtYmVyIiwiaXNGaW5pdGUiLCJoYXNfbWF4bGVuZ3RoIiwicm93c19udW0iLCJNYXRoIiwibWF4IiwibWluIiwibWlubGVuZ3RoX251bSIsIm1heGxlbmd0aF9udW0iLCJpZF9hdHRyIiwibmFtZV9hdHRyIiwiY2xzX2F0dHIiLCJwaF9hdHRyIiwicmVxX2F0dHIiLCJtaW5sZW5ndGhfYXR0ciIsIm1heGxlbmd0aF9hdHRyIiwicm93c19hdHRyIiwibGFiZWxfaHRtbCIsImhlbHBfaHRtbCIsImRlZmF1bHRfdGV4dCIsImlubmVySFRNTCIsIlVJIiwiV1BCQ19CRkJfT3ZlcmxheSIsImVuc3VyZSIsImJ1aWxkZXIiLCJvbl9maWVsZF9kcm9wIiwiZSIsInJlZ2lzdGVyX3RleHRhcmVhX2Jvb2tpbmdfZm9ybV9leHBvcnRlciIsIkV4cCIsIldQQkNfQkZCX0V4cG9ydGVyIiwiaGFzX2V4cG9ydGVyIiwiUyIsImZpZWxkIiwiZW1pdCIsImV4dHJhcyIsImNmZyIsImFkZExhYmVscyIsImlzX3JlcSIsInJlcV9tYXJrIiwiY29tcHV0ZV9uYW1lIiwiaWRfb3B0IiwiaWRfb3B0aW9uIiwiY2xzX29wdHMiLCJjbGFzc19vcHRpb25zIiwiZGVmX3RleHQiLCJkZWZhdWx0X3RleHRfc3VmZml4Iiwicm93c190b2tlbiIsInIiLCJib2R5IiwicmF3X2xhYmVsIiwidHJpbSIsImRvY3VtZW50IiwiYWRkRXZlbnRMaXN0ZW5lciIsIm9uY2UiLCJyZWdpc3Rlcl90ZXh0YXJlYV9ib29raW5nX2RhdGFfZXhwb3J0ZXIiLCJDIiwiV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyIiwiZW1pdF9saW5lX2JvbGRfZmllbGQiLCJ3aW5kb3ciXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9maWVsZC1wYWNrcy90ZXh0YXJlYS9fc3JjL3RleHRhcmVhLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBXUEJDIEJGQjogVGV4dGFyZWEgUmVuZGVyZXIgKFNjaGVtYS1kcml2ZW4pXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKiBGaWxlOiAvaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvdGV4dGFyZWEvX291dC90ZXh0YXJlYS5qc1xyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICovXHJcbihmdW5jdGlvbiAodykge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0dmFyIENvcmUgICAgID0gdy5XUEJDX0JGQl9Db3JlIHx8IHt9O1xyXG5cdHZhciByZWdpc3RyeSA9IENvcmUuV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnk7XHJcblx0dmFyIEJhc2UgICAgID0gQ29yZS5XUEJDX0JGQl9GaWVsZF9CYXNlO1xyXG5cclxuXHRpZiAoICEgcmVnaXN0cnkgfHwgdHlwZW9mIHJlZ2lzdHJ5LnJlZ2lzdGVyICE9PSAnZnVuY3Rpb24nIHx8ICEgQmFzZSApIHtcclxuXHRcdF93cGJjPy5kZXY/LmVycm9yPy4oICdXUEJDX0JGQl9GaWVsZF9UZXh0YXJlYScsICdDb3JlIHJlZ2lzdHJ5L2Jhc2UgbWlzc2luZycgKTtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFdQQkMgQkZCOiBGaWVsZCBSZW5kZXJlciBmb3IgXCJ0ZXh0YXJlYVwiIChTY2hlbWEtZHJpdmVuLCB0ZW1wbGF0ZS1saXRlcmFsIHJlbmRlcilcclxuXHQgKlxyXG5cdCAqIENvbnRyYWN0czpcclxuXHQgKiAtIFJlZ2lzdHJ5OiAgV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnkucmVnaXN0ZXIoICd0ZXh0YXJlYScsIENsYXNzIClcclxuXHQgKiAtIENsYXNzIEFQSTogc3RhdGljIGdldF9kZWZhdWx0cygpLCBzdGF0aWMgcmVuZGVyKGVsLCBkYXRhLCBjdHgpLCBzdGF0aWMgb25fZmllbGRfZHJvcChkYXRhLCBlbCwgY3R4PykgW29wdGlvbmFsXVxyXG5cdCAqXHJcblx0ICogTm90ZXM6XHJcblx0ICogLSBLZWVwIGRlZmF1bHRzIGFsaWduZWQgd2l0aCBQSFAgc2NoZW1hLT5wcm9wcy0+ZGVmYXVsdC5cclxuXHQgKiAtIFVzZXMgV1BCQ19CRkJfU2FuaXRpemUgaGVscGVycyBmcm9tIENvcmUuXHJcblx0ICogLSBVc2VzIE92ZXJsYXkuZW5zdXJlKC4uLikgc28gZmllbGQgY29udHJvbHMgKGhhbmRsZSwgc2V0dGluZ3MsIGV0Yy4pIGFwcGVhci5cclxuXHQgKi9cclxuXHRjbGFzcyBXUEJDX0JGQl9GaWVsZF9UZXh0YXJlYSBleHRlbmRzIEJhc2Uge1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmV0dXJuIGRlZmF1bHQgcHJvcHMgZm9yIFwidGV4dGFyZWFcIiBmaWVsZC5cclxuXHRcdCAqIE11c3Qgc3RheSBpbiBzeW5jIHdpdGggUEhQIHNjaGVtYSBkZWZhdWx0cy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7T2JqZWN0fVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZ2V0X2RlZmF1bHRzKCkge1xyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdHR5cGUgICAgICAgICA6ICd0ZXh0YXJlYScsXHJcblx0XHRcdFx0bGFiZWwgICAgICAgIDogJ1RleHRhcmVhJyxcclxuXHRcdFx0XHRuYW1lICAgICAgICAgOiAnJyxcclxuXHRcdFx0XHRodG1sX2lkICAgICAgOiAnJyxcclxuXHRcdFx0XHRwbGFjZWhvbGRlciAgOiAnJyxcclxuXHRcdFx0XHRyZXF1aXJlZCAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRtaW5sZW5ndGggICAgOiBudWxsLFxyXG5cdFx0XHRcdG1heGxlbmd0aCAgICA6IG51bGwsXHJcblx0XHRcdFx0cm93cyAgICAgICAgIDogNCxcclxuXHRcdFx0XHRjc3NjbGFzcyAgICAgOiAnJyxcclxuXHRcdFx0XHRoZWxwICAgICAgICAgOiAnJyxcclxuXHRcdFx0XHRkZWZhdWx0X3ZhbHVlOiAnJyxcclxuXHRcdFx0XHRtaW5fd2lkdGggICAgOiAnMjYwcHgnXHJcblx0XHRcdH07XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZW5kZXIgdGhlIHByZXZpZXcgbWFya3VwIGludG8gdGhlIGZpZWxkIGVsZW1lbnQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWwgICBGaWVsZCByb290IGVsZW1lbnQgaW5zaWRlIHRoZSBjYW52YXMuXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBkYXRhIEZpZWxkIHByb3BzIChhbHJlYWR5IG5vcm1hbGl6ZWQgYnkgc2NoZW1hKS5cclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGN0eCAgQ29udGV4dDogeyBidWlsZGVyLCBzYW5pdCwgLi4uIH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHJlbmRlcihlbCwgZGF0YSwgY3R4KSB7XHJcblx0XHRcdGlmICggISBlbCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIE5vcm1hbGl6ZSBhZ2FpbnN0IGRlZmF1bHRzIGZpcnN0LlxyXG5cdFx0XHRjb25zdCBkID0gdGhpcy5ub3JtYWxpemVfZGF0YSggZGF0YSApO1xyXG5cclxuXHRcdFx0Ly8gLS0tLS0gQ29yZSBzYW5pdGl6ZSBoZWxwZXJzIChzdGF0aWMpIC0tLS0tXHJcblx0XHRcdGNvbnN0IGVoICAgICA9ICh2KSA9PiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY2FwZV9odG1sKCB2ICk7XHJcblx0XHRcdGNvbnN0IHNpZCAgICA9ICh2KSA9PiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2h0bWxfaWQoIHYgKTtcclxuXHRcdFx0Y29uc3Qgc25hbWUgID0gKHYpID0+IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuc2FuaXRpemVfaHRtbF9uYW1lKCB2ICk7XHJcblx0XHRcdGNvbnN0IHNjbGFzcyA9ICh2KSA9PiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2Nzc19jbGFzc2xpc3QoIHYgKTtcclxuXHRcdFx0Y29uc3QgdHJ1dGh5ID0gKHYpID0+IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuaXNfdHJ1dGh5KCB2ICk7XHJcblxyXG5cdFx0XHQvLyBTYW5pdGl6ZSBwdWJsaWMgaWQvbmFtZSBmb3IgdGhlIGNvbnRyb2wgaXRzZWxmLlxyXG5cdFx0XHRjb25zdCBodG1sX2lkICA9IGQuaHRtbF9pZCA/IHNpZCggU3RyaW5nKCBkLmh0bWxfaWQgKSApIDogJyc7XHJcblx0XHRcdGNvbnN0IG5hbWVfdmFsID0gc25hbWUoIFN0cmluZyggZC5uYW1lIHx8IGQuaWQgfHwgJ2ZpZWxkJyApICk7XHJcblx0XHRcdGNvbnN0IGNzc19uZXh0ID0gc2NsYXNzKCBTdHJpbmcoIGQuY3NzY2xhc3MgfHwgJycgKSApO1xyXG5cclxuXHRcdFx0Ly8gS2VlcCBkYXRhc2V0IGluIHN5bmMgKGRvIG5vdCBtdXRhdGUgd3JhcHBlciBjbGFzc2VzKS5cclxuXHRcdFx0aWYgKCAnY3NzY2xhc3MnIGluIGQgJiYgZWwuZGF0YXNldC5jc3NjbGFzcyAhPT0gY3NzX25leHQgKSB7XHJcblx0XHRcdFx0ZWwuZGF0YXNldC5jc3NjbGFzcyA9IGNzc19uZXh0O1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggJ2h0bWxfaWQnIGluIGQgJiYgZWwuZGF0YXNldC5odG1sX2lkICE9PSBodG1sX2lkICkge1xyXG5cdFx0XHRcdGVsLmRhdGFzZXQuaHRtbF9pZCA9IGh0bWxfaWQ7XHJcblx0XHRcdH1cclxuXHRcdFx0Ly8gTkVXOiBwZXJzaXN0IG1pbl93aWR0aCBmb3IgdGhlIE1pbi1XaWR0aCBndWFyZCAvIGxheW91dCBjb250cm9sbGVyLlxyXG5cdFx0XHRpZiAoIGQubWluX3dpZHRoICkge1xyXG5cdFx0XHRcdGVsLmRhdGFzZXQubWluX3dpZHRoID0gU3RyaW5nKCBkLm1pbl93aWR0aCApO1xyXG5cdFx0XHRcdGVsLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjLWNvbC1taW4nLCBTdHJpbmcoIGQubWluX3dpZHRoICkgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gRmxhZ3MgLyBudW1lcmljIGNvbnN0cmFpbnRzLlxyXG5cdFx0XHRjb25zdCBpc19yZXF1aXJlZCAgID0gdHJ1dGh5KCBkLnJlcXVpcmVkICk7XHJcblx0XHRcdGNvbnN0IGhhc19taW5sZW5ndGggPSAoZC5taW5sZW5ndGggIT0gbnVsbCAmJiBkLm1pbmxlbmd0aCAhPT0gJycgJiYgTnVtYmVyLmlzRmluaXRlKCArZC5taW5sZW5ndGggKSk7XHJcblx0XHRcdGNvbnN0IGhhc19tYXhsZW5ndGggPSAoZC5tYXhsZW5ndGggIT0gbnVsbCAmJiBkLm1heGxlbmd0aCAhPT0gJycgJiYgTnVtYmVyLmlzRmluaXRlKCArZC5tYXhsZW5ndGggKSk7XHJcblx0XHRcdGNvbnN0IHJvd3NfbnVtICAgICAgPSAoZC5yb3dzICE9IG51bGwgJiYgTnVtYmVyLmlzRmluaXRlKCArZC5yb3dzICkgJiYgK2Qucm93cyA+IDApXHJcblx0XHRcdFx0PyBNYXRoLm1heCggMSwgTWF0aC5taW4oIDUwLCArZC5yb3dzICkgKVxyXG5cdFx0XHRcdDogNDtcclxuXHJcblx0XHRcdGNvbnN0IG1pbmxlbmd0aF9udW0gPSBoYXNfbWlubGVuZ3RoID8gTnVtYmVyKCBkLm1pbmxlbmd0aCApIDogbnVsbDtcclxuXHRcdFx0Y29uc3QgbWF4bGVuZ3RoX251bSA9IGhhc19tYXhsZW5ndGggPyBOdW1iZXIoIGQubWF4bGVuZ3RoICkgOiBudWxsO1xyXG5cclxuXHRcdFx0Ly8gQXR0cmlidXRlIGZyYWdtZW50cy5cclxuXHRcdFx0Y29uc3QgaWRfYXR0ciAgICAgICAgPSBodG1sX2lkID8gYCBpZD1cIiR7ZWgoIGh0bWxfaWQgKX1cImAgOiAnJztcclxuXHRcdFx0Y29uc3QgbmFtZV9hdHRyICAgICAgPSBgIG5hbWU9XCIke2VoKCBuYW1lX3ZhbCApfVwiYDtcclxuXHRcdFx0Ly8gSW5jbHVkZSB0aGUgYmFzZSBwcmV2aWV3IGNsYXNzIHNvIHRoZSBjYW52YXMgc3R5bGVzIGFwcGx5LlxyXG5cdFx0XHRjb25zdCBjbHNfYXR0ciAgICAgICA9IGAgY2xhc3M9XCJ3cGJjX2JmYl9fcHJldmlldy1pbnB1dCB3cGJjX2JmYl9fcHJldmlldy10ZXh0YXJlYSR7Y3NzX25leHQgPyAnICcgKyBlaCggY3NzX25leHQgKSA6ICcnfVwiYDtcclxuXHRcdFx0Y29uc3QgcGhfYXR0ciAgICAgICAgPSBkLnBsYWNlaG9sZGVyID8gYCBwbGFjZWhvbGRlcj1cIiR7ZWgoIGQucGxhY2Vob2xkZXIgKX1cImAgOiAnJztcclxuXHRcdFx0Y29uc3QgcmVxX2F0dHIgICAgICAgPSBpc19yZXF1aXJlZCA/ICcgcmVxdWlyZWQgYXJpYS1yZXF1aXJlZD1cInRydWVcIicgOiAnJztcclxuXHRcdFx0Y29uc3QgbWlubGVuZ3RoX2F0dHIgPSBoYXNfbWlubGVuZ3RoID8gYCBtaW5sZW5ndGg9XCIke21pbmxlbmd0aF9udW19XCJgIDogJyc7XHJcblx0XHRcdGNvbnN0IG1heGxlbmd0aF9hdHRyID0gaGFzX21heGxlbmd0aCA/IGAgbWF4bGVuZ3RoPVwiJHttYXhsZW5ndGhfbnVtfVwiYCA6ICcnO1xyXG5cdFx0XHRjb25zdCByb3dzX2F0dHIgICAgICA9IGAgcm93cz1cIiR7cm93c19udW19XCJgO1xyXG5cclxuXHRcdFx0Y29uc3QgbGFiZWxfaHRtbCA9IChkLmxhYmVsICE9IG51bGwgJiYgZC5sYWJlbCAhPT0gJycpXHJcblx0XHRcdFx0PyBgPGxhYmVsIGNsYXNzPVwid3BiY19iZmJfX2ZpZWxkLWxhYmVsXCIke2h0bWxfaWQgPyBgIGZvcj1cIiR7ZWgoIGh0bWxfaWQgKX1cImAgOiAnJ30+JHtlaCggZC5sYWJlbCApfSR7aXNfcmVxdWlyZWQgPyAnPHNwYW4gYXJpYS1oaWRkZW49XCJ0cnVlXCI+Kjwvc3Bhbj4nIDogJyd9PC9sYWJlbD5gXHJcblx0XHRcdFx0OiAnJztcclxuXHJcblx0XHRcdGNvbnN0IGhlbHBfaHRtbCAgICA9IGQuaGVscCA/IGA8ZGl2IGNsYXNzPVwid3BiY19iZmJfX2hlbHBcIj4ke2VoKCBkLmhlbHAgKX08L2Rpdj5gIDogJyc7XHJcblx0XHRcdGNvbnN0IGRlZmF1bHRfdGV4dCA9IChkLmRlZmF1bHRfdmFsdWUgIT0gbnVsbCAmJiBkLmRlZmF1bHRfdmFsdWUgIT09ICcnKSA/IGVoKCBTdHJpbmcoIGQuZGVmYXVsdF92YWx1ZSApICkgOiAnJztcclxuXHJcblx0XHRcdGVsLmlubmVySFRNTCA9IGBcclxuXHRcdFx0XHQ8c3BhbiBjbGFzcz1cIndwYmNfYmZiX19ub2FjdGlvbiB3cGJjX2JmYl9fbm8tZHJhZy16b25lXCIgaW5lcnQ9XCJcIj5cclxuXHRcdFx0XHRcdCR7bGFiZWxfaHRtbH1cclxuXHRcdFx0XHRcdDxzcGFuIGNsYXNzPVwid3BiY193cmFwX3RleHQgd3BkZXYtZm9ybS1jb250cm9sLXdyYXBcIj5cclxuXHRcdFx0XHRcdFx0PHRleHRhcmVhJHtjbHNfYXR0cn0ke3BoX2F0dHJ9JHtuYW1lX2F0dHJ9IHRhYmluZGV4PVwiLTFcIiBhcmlhLWRpc2FibGVkPVwidHJ1ZVwiJHtpZF9hdHRyfSR7cm93c19hdHRyfSR7cmVxX2F0dHJ9JHttaW5sZW5ndGhfYXR0cn0ke21heGxlbmd0aF9hdHRyfT4ke2RlZmF1bHRfdGV4dH08L3RleHRhcmVhPlxyXG5cdFx0XHRcdFx0PC9zcGFuPlxyXG5cdFx0XHRcdFx0JHtoZWxwX2h0bWx9XHJcblx0XHRcdFx0PC9zcGFuPlxyXG5cdFx0XHRgO1xyXG5cclxuXHRcdFx0Ly8gT3ZlcmxheSAoaGFuZGxlcy90b29sYmFycykuXHJcblx0XHRcdENvcmUuVUk/LldQQkNfQkZCX092ZXJsYXk/LmVuc3VyZT8uKCBjdHg/LmJ1aWxkZXIsIGVsICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBPcHRpb25hbCBob29rIGV4ZWN1dGVkIGFmdGVyIGZpZWxkIGlzIGRyb3BwZWQgZnJvbSB0aGUgcGFsZXR0ZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBkYXRhICBQYWxldHRlL2ZpZWxkIGRhdGEuXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbCAgICBOZXdseSBjcmVhdGVkIGZpZWxkIGVsZW1lbnQuXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjdHggICBDb250ZXh0IHsgYnVpbGRlciwgc2FuaXQsIGNvbnRleHQ6ICdkcm9wJyB8ICdsb2FkJyB8ICdwcmV2aWV3JyB9XHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIG9uX2ZpZWxkX2Ryb3AoZGF0YSwgZWwsIGN0eCkge1xyXG5cdFx0XHRzdXBlci5vbl9maWVsZF9kcm9wPy4oIGRhdGEsIGVsLCBjdHggKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHRyeSB7XHJcblx0XHRyZWdpc3RyeS5yZWdpc3RlciggJ3RleHRhcmVhJywgV1BCQ19CRkJfRmllbGRfVGV4dGFyZWEgKTtcclxuXHR9IGNhdGNoICggZSApIHtcclxuXHRcdF93cGJjPy5kZXY/LmVycm9yPy4oICdXUEJDX0JGQl9GaWVsZF9UZXh0YXJlYS5yZWdpc3RlcicsIGUgKTtcclxuXHR9XHJcblxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEV4cG9ydCBmb3IgXCJCb29raW5nIEZvcm1cIiAoQWR2YW5jZWQgRm9ybSBzaG9ydGNvZGUpXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvKipcclxuXHQgKiBCb29raW5nIEZvcm0gZXhwb3J0ZXIgY2FsbGJhY2sgZm9yIFwidGV4dGFyZWFcIi5cclxuXHQgKlxyXG5cdCAqIFByb2R1Y2VzIHNob3J0Y29kZXMgZXF1aXZhbGVudCB0byB0aGUgbGVnYWN5IGV4cG9ydGVyOlxyXG5cdCAqICAgW3RleHRhcmVhKiB5b3VyLW5hbWUgNDB4NCBpZDp5b3VyLW5hbWUgY2xhc3M6eW91ci1jbGFzcyBcIkRlZmF1bHQgdGV4dFwiXVxyXG5cdCAqXHJcblx0ICogTGFiZWxzIGFuZCBoZWxwIHRleHQgYXJlIGhhbmRsZWQgaW4gdGhlIHNhbWUgY2VudHJhbGl6ZWQgd2F5IGFzIG90aGVyIHBhY2tzLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHJlZ2lzdGVyX3RleHRhcmVhX2Jvb2tpbmdfZm9ybV9leHBvcnRlcigpIHtcclxuXHJcblx0XHR2YXIgRXhwID0gdy5XUEJDX0JGQl9FeHBvcnRlcjtcclxuXHRcdGlmICggISBFeHAgfHwgdHlwZW9mIEV4cC5yZWdpc3RlciAhPT0gJ2Z1bmN0aW9uJyApIHsgcmV0dXJuOyB9XHJcblx0XHRpZiAoIHR5cGVvZiBFeHAuaGFzX2V4cG9ydGVyID09PSAnZnVuY3Rpb24nICYmIEV4cC5oYXNfZXhwb3J0ZXIoICd0ZXh0YXJlYScgKSApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0dmFyIFMgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplIHx8IHt9O1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQHR5cGUge1dQQkNfQkZCX0V4cG9ydGVyQ2FsbGJhY2t9XHJcblx0XHQgKi9cclxuXHRcdEV4cC5yZWdpc3RlciggJ3RleHRhcmVhJywgZnVuY3Rpb24oIGZpZWxkLCBlbWl0LCBleHRyYXMgKSB7XHJcblx0XHRcdGV4dHJhcyA9IGV4dHJhcyB8fCB7fTtcclxuXHJcblx0XHRcdHZhciBjZmcgICAgICAgPSBleHRyYXMuY2ZnIHx8IHt9O1xyXG5cdFx0XHR2YXIgY3R4ICAgICAgID0gZXh0cmFzLmN0eDtcclxuXHRcdFx0dmFyIGFkZExhYmVscyA9IGNmZy5hZGRMYWJlbHMgIT09IGZhbHNlO1xyXG5cclxuXHRcdFx0Ly8gUmVxdWlyZWQgbWFya2VyIChzYW1lIHNlbWFudGljcyBhcyB0ZXh0IGZpZWxkKS5cclxuXHRcdFx0dmFyIGlzX3JlcSAgID0gRXhwLmlzX3JlcXVpcmVkKCBmaWVsZCApO1xyXG5cdFx0XHR2YXIgcmVxX21hcmsgPSBpc19yZXEgPyAnKicgOiAnJztcclxuXHJcblx0XHRcdC8vIFNoYXJlZCBoZWxwZXJzIGtlZXAgbmFtaW5nIC8gaWQgLyBjbGFzc2VzIGNvbnNpc3RlbnQgYWNyb3NzIHBhY2tzLlxyXG5cdFx0XHR2YXIgbmFtZSAgICAgPSBFeHAuY29tcHV0ZV9uYW1lKCAndGV4dGFyZWEnLCBmaWVsZCApO1xyXG5cdFx0XHR2YXIgaWRfb3B0ICAgPSBFeHAuaWRfb3B0aW9uKCBmaWVsZCwgY3R4ICk7XHJcblx0XHRcdHZhciBjbHNfb3B0cyA9IEV4cC5jbGFzc19vcHRpb25zKCBmaWVsZCApO1xyXG5cdFx0XHR2YXIgcGhfYXR0ciAgPSBFeHAucGhfYXR0ciggZmllbGQgJiYgZmllbGQucGxhY2Vob2xkZXIgKTtcclxuXHRcdFx0dmFyIGRlZl90ZXh0ID0gRXhwLmRlZmF1bHRfdGV4dF9zdWZmaXgoIGZpZWxkICk7XHJcblxyXG5cdFx0XHQvLyBSb3dzIHRva2VuOiBbdGV4dGFyZWEgbmFtZSB4NV0g4oCUIHJvd3MgY29tZSBmcm9tIHNjaGVtYS9JbnNwZWN0b3IgKGBmaWVsZC5yb3dzYCkuXHJcblx0XHRcdC8vIENsYW1wIGludG8gWzEsNTBdIHRvIG1pcnJvciBJbnNwZWN0b3IgY29uc3RyYWludHMuXHJcblx0XHRcdHZhciByb3dzX3Rva2VuID0gJyc7XHJcblx0XHRcdGlmICggZmllbGQgJiYgZmllbGQucm93cyAhPSBudWxsICYmIGZpZWxkLnJvd3MgIT09ICcnICkge1xyXG5cdFx0XHRcdHZhciByID0gTnVtYmVyKCBmaWVsZC5yb3dzICk7XHJcblx0XHRcdFx0aWYgKCAhIE51bWJlci5pc0Zpbml0ZSggciApICkge1xyXG5cdFx0XHRcdFx0ciA9IDQ7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICggciA8IDEgKSAgeyByID0gMTsgfVxyXG5cdFx0XHRcdGlmICggciA+IDUwICkgeyByID0gNTA7IH1cclxuXHRcdFx0XHRyb3dzX3Rva2VuID0gJyB4JyArIFN0cmluZyggciApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBGaW5hbCBzaG9ydGNvZGUgYm9keSAocm93cy1vbmx5IHNpemluZzsgbm8gY29sdW1ucyksIGUuZy46XHJcblx0XHRcdC8vICAgW3RleHRhcmVhKiB5b3VyLW1lc3NhZ2UgeDUgaWQ6eW91ci1tZXNzYWdlIGNsYXNzOi4uLiBcIkRlZmF1bHQgdGV4dFwiXVxyXG5cdFx0XHR2YXIgYm9keSA9ICdbdGV4dGFyZWEnICsgcmVxX21hcmsgKyAnICcgKyBuYW1lICsgcm93c190b2tlbiArIGlkX29wdCArIGNsc19vcHRzICsgcGhfYXR0ciArIGRlZl90ZXh0ICsgJ10nO1xyXG5cclxuXHRcdFx0Ly8gTGFiZWwgYmVoYXZpb3IgbWlycm9ycyBsZWdhY3kgZW1pdF9sYWJlbF90aGVuKCkuXHJcblx0XHRcdHZhciByYXdfbGFiZWwgPSAoIGZpZWxkICYmIHR5cGVvZiBmaWVsZC5sYWJlbCA9PT0gJ3N0cmluZycgKSA/IGZpZWxkLmxhYmVsIDogJyc7XHJcblx0XHRcdHZhciBsYWJlbCAgICAgPSByYXdfbGFiZWwudHJpbSgpO1xyXG5cclxuXHRcdFx0aWYgKCBsYWJlbCAmJiBhZGRMYWJlbHMgKSB7XHJcblx0XHRcdFx0ZW1pdCggJzxsPicgKyAoUy5lc2NhcGVfaHRtbCA/IFMuZXNjYXBlX2h0bWwoIGxhYmVsICkgOiBsYWJlbCkgKyByZXFfbWFyayArICAnPC9sPicgKTtcclxuXHRcdFx0XHRlbWl0KCAnPGJyPicgKyBib2R5ICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0ZW1pdCggYm9keSApO1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vIEhlbHAgdGV4dCBpcyBhcHBlbmRlZCBjZW50cmFsbHkgYnkgV1BCQ19CRkJfRXhwb3J0ZXIucmVuZGVyX2ZpZWxkX25vZGUoKS5cclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGlmICggdy5XUEJDX0JGQl9FeHBvcnRlciAmJiB0eXBlb2Ygdy5XUEJDX0JGQl9FeHBvcnRlci5yZWdpc3RlciA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdHJlZ2lzdGVyX3RleHRhcmVhX2Jvb2tpbmdfZm9ybV9leHBvcnRlcigpO1xyXG5cdH0gZWxzZSBpZiAoIHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcgKSB7XHJcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzpiZmI6ZXhwb3J0ZXItcmVhZHknLCByZWdpc3Rlcl90ZXh0YXJlYV9ib29raW5nX2Zvcm1fZXhwb3J0ZXIsIHsgb25jZTogdHJ1ZSB9ICk7XHJcblx0fVxyXG5cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBFeHBvcnQgZm9yIFwiQm9va2luZyBEYXRhXCIgKENvbnRlbnQgb2YgYm9va2luZyBmaWVsZHMgZGF0YSlcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8qKlxyXG5cdCAqIEJvb2tpbmcgRGF0YSBleHBvcnRlciAoXCJDb250ZW50IG9mIGJvb2tpbmcgZmllbGRzIGRhdGFcIikgZm9yIFwidGV4dGFyZWFcIi5cclxuXHQgKlxyXG5cdCAqIERlZmF1bHQgbGluZSBmb3JtYXQ6XHJcblx0ICogICA8Yj5MYWJlbDwvYj46IDxmPltmaWVsZF9uYW1lXTwvZj48YnI+XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gcmVnaXN0ZXJfdGV4dGFyZWFfYm9va2luZ19kYXRhX2V4cG9ydGVyKCkge1xyXG5cclxuXHRcdHZhciBDID0gdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXI7XHJcblx0XHRpZiAoICEgQyB8fCB0eXBlb2YgQy5yZWdpc3RlciAhPT0gJ2Z1bmN0aW9uJyApIHsgcmV0dXJuOyB9XHJcblx0XHRpZiAoIHR5cGVvZiBDLmhhc19leHBvcnRlciA9PT0gJ2Z1bmN0aW9uJyAmJiBDLmhhc19leHBvcnRlciggJ3RleHRhcmVhJyApICkgeyByZXR1cm47IH1cclxuXHJcblx0XHRDLnJlZ2lzdGVyKCAndGV4dGFyZWEnLCBmdW5jdGlvbiggZmllbGQsIGVtaXQsIGV4dHJhcyApIHtcclxuXHRcdFx0ZXh0cmFzID0gZXh0cmFzIHx8IHt9O1xyXG5cdFx0XHR2YXIgY2ZnID0gZXh0cmFzLmNmZyB8fCB7fTtcclxuXHJcblx0XHRcdHZhciBFeHAgPSB3LldQQkNfQkZCX0V4cG9ydGVyO1xyXG5cdFx0XHRpZiAoICEgRXhwIHx8IHR5cGVvZiBFeHAuY29tcHV0ZV9uYW1lICE9PSAnZnVuY3Rpb24nICkgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdHZhciBuYW1lID0gRXhwLmNvbXB1dGVfbmFtZSggJ3RleHRhcmVhJywgZmllbGQgKTtcclxuXHRcdFx0aWYgKCAhIG5hbWUgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0dmFyIGxhYmVsID0gKCBmaWVsZCAmJiB0eXBlb2YgZmllbGQubGFiZWwgPT09ICdzdHJpbmcnICYmIGZpZWxkLmxhYmVsLnRyaW0oKSApID8gZmllbGQubGFiZWwudHJpbSgpIDogbmFtZTtcclxuXHJcblx0XHRcdC8vIFNoYXJlZCBoZWxwZXIga2VlcHMgZm9ybWF0dGluZyBjb25zaXN0ZW50IGFjcm9zcyBhbGwgcGFja3MuXHJcblx0XHRcdEMuZW1pdF9saW5lX2JvbGRfZmllbGQoIGVtaXQsIGxhYmVsLCBuYW1lLCBjZmcgKTtcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGlmICggdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIgJiYgdHlwZW9mIHcuV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyLnJlZ2lzdGVyID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0cmVnaXN0ZXJfdGV4dGFyZWFfYm9va2luZ19kYXRhX2V4cG9ydGVyKCk7XHJcblx0fSBlbHNlIGlmICggdHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJyApIHtcclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOmJmYjpjb250ZW50LWV4cG9ydGVyLXJlYWR5JywgcmVnaXN0ZXJfdGV4dGFyZWFfYm9va2luZ19kYXRhX2V4cG9ydGVyLCB7IG9uY2U6IHRydWUgfSApO1xyXG5cdH1cclxuXHJcbn0pKCB3aW5kb3cgKTtcclxuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMsVUFBVUEsQ0FBQyxFQUFFO0VBQ2IsWUFBWTs7RUFFWixJQUFJQyxJQUFJLEdBQU9ELENBQUMsQ0FBQ0UsYUFBYSxJQUFJLENBQUMsQ0FBQztFQUNwQyxJQUFJQyxRQUFRLEdBQUdGLElBQUksQ0FBQ0csZ0NBQWdDO0VBQ3BELElBQUlDLElBQUksR0FBT0osSUFBSSxDQUFDSyxtQkFBbUI7RUFFdkMsSUFBSyxDQUFFSCxRQUFRLElBQUksT0FBT0EsUUFBUSxDQUFDSSxRQUFRLEtBQUssVUFBVSxJQUFJLENBQUVGLElBQUksRUFBRztJQUN0RUcsS0FBSyxFQUFFQyxHQUFHLEVBQUVDLEtBQUssR0FBSSx5QkFBeUIsRUFBRSw0QkFBNkIsQ0FBQztJQUM5RTtFQUNEOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLE1BQU1DLHVCQUF1QixTQUFTTixJQUFJLENBQUM7SUFFMUM7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsT0FBT08sWUFBWUEsQ0FBQSxFQUFHO01BQ3JCLE9BQU87UUFDTkMsSUFBSSxFQUFXLFVBQVU7UUFDekJDLEtBQUssRUFBVSxVQUFVO1FBQ3pCQyxJQUFJLEVBQVcsRUFBRTtRQUNqQkMsT0FBTyxFQUFRLEVBQUU7UUFDakJDLFdBQVcsRUFBSSxFQUFFO1FB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
