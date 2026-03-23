"use strict";

/**
 * WPBC BFB: Field Renderer for "text" (WP-template–driven Reference, no fallback)
 * =========================================================================
 * - Uses wp.template('wpbc-bfb-field-text') for preview
 * - If template is unavailable or fails, shows an inline error message
 * - Inspector UI is produced by wp.template('wpbc-bfb-inspector-text')
 * - Assumes wpbc-bfb_core provides WPBC_BFB_Sanitize
 *
 * Contracts:
 * - Registry:  WPBC_BFB_Field_Renderer_Registry.register('text', Class)
 * - Class API: static get_defaults(), static render(el, data, ctx), static on_field_drop(data, el, ctx?) [optional]
 *
  * File:  ../includes/page-form-builder/field-packs/text/_out/field-text-wptpl.js
 *
 * @since   11.0.0
 * @modified  2025-09-06 14:08
 * @version 1.0.1
 */
(function (w) {
  'use strict';

  var Core = w.WPBC_BFB_Core || {};
  var Registry = Core.WPBC_BFB_Field_Renderer_Registry;
  var Base = Core.WPBC_BFB_Field_Base;
  if (!Registry || typeof Registry.register !== 'function' || !Base) {
    _wpbc?.dev?.error?.('WPBC_BFB_Field_Text', 'Core registry/base missing');
    return;
  }
  class WPBC_BFB_Field_Text extends Base {
    /** Template id without the "tmpl-" prefix (Base will normalize/caches it). */
    static template_id = 'wpbc-bfb-field-text';
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
     * Render via wp.template; if missing, print a tiny error message.
     *
     * @param {HTMLElement} el
     * @param {Object}      data
     * @param {Object}      ctx
     */
    static render(el, data, ctx) {
      if (!el) {
        return;
      }

      // Normalize first (mirrors Base.render).
      const d = this.normalize_data(data);

      // Sanitize helpers actually available in core.
      const S = Core.WPBC_BFB_Sanitize;
      const html_id = d.html_id ? S.sanitize_html_id(String(d.html_id)) : '';
      const name = S.sanitize_html_name(String(d.name || d.id || 'field'));
      const cssNext = S.sanitize_css_classlist(String(d.cssclass || ''));

      // Keep wrapper dataset/styles in sync (do NOT assign DOM id to the wrapper).
      if (el.dataset.html_id !== html_id) {
        el.dataset.html_id = html_id;
      }

      // const prev = el.dataset.cssclass || '';
      // if ( prev !== cssNext ) {
      // 	prev.split( /\s+/ ).filter( Boolean ).forEach( (c) => el.classList.remove( c ) );
      // 	cssNext.split( /\s+/ ).filter( Boolean ).forEach( (c) => el.classList.add( c ) );
      // 	el.dataset.cssclass = cssNext;
      // }
      // NEW: store only.
      if ('cssclass' in d) {
        if (el.dataset.cssclass !== cssNext) {
          el.dataset.cssclass = cssNext;
        }
      }
      // Compile template via Base (handles "tmpl-" + caching).
      const tpl = this.get_template(this.template_id);
      if (typeof tpl !== 'function') {
        _wpbc?.dev?.error?.('text_wptpl.tpl.missing', 'Template not found: ' + this.template_id);
        el.innerHTML = '<div class="wpbc_bfb__error" role="alert">Template not found: wpbc-bfb-field-text.</div>';
        return;
      }

      // Render. Pass sanitized name/html_id back to template data.
      try {
        const tpl_data = {
          ...d,
          name,
          html_id,
          cssclass: cssNext,
          default_value: d.default_value ?? ''
        };
        el.innerHTML = tpl(tpl_data);
      } catch (e) {
        _wpbc?.dev?.error?.('text_wptpl.tpl.render', e);
        el.innerHTML = '<div class="wpbc_bfb__error" role="alert">Error rendering field preview.</div>';
        return;
      }

      // Keep wrapper metadata consistent with Base.render().
      el.dataset.type = d.type || 'text';
      el.setAttribute('data-label', d.label != null ? String(d.label) : '');

      // Normalize a few attributes via the DOM (quotes/newlines), like Base.render().
      const input = el.querySelector('input, textarea, select');
      if (input) {
        if (d.placeholder != null) input.setAttribute('placeholder', String(d.placeholder));
      }

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
    Registry.register('text', WPBC_BFB_Field_Text);
  } catch (e) {
    _wpbc?.dev?.error?.('WPBC_BFB_Field_Text.register_wptpl', e);
  }
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvdGV4dC9fb3V0L2ZpZWxkLXRleHQtd3B0cGwuanMiLCJuYW1lcyI6WyJ3IiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJSZWdpc3RyeSIsIldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5IiwiQmFzZSIsIldQQkNfQkZCX0ZpZWxkX0Jhc2UiLCJyZWdpc3RlciIsIl93cGJjIiwiZGV2IiwiZXJyb3IiLCJXUEJDX0JGQl9GaWVsZF9UZXh0IiwidGVtcGxhdGVfaWQiLCJnZXRfZGVmYXVsdHMiLCJ0eXBlIiwibGFiZWwiLCJuYW1lIiwiaHRtbF9pZCIsInBsYWNlaG9sZGVyIiwicmVxdWlyZWQiLCJtaW5sZW5ndGgiLCJtYXhsZW5ndGgiLCJwYXR0ZXJuIiwiY3NzY2xhc3MiLCJoZWxwIiwiZGVmYXVsdF92YWx1ZSIsInJlbmRlciIsImVsIiwiZGF0YSIsImN0eCIsImQiLCJub3JtYWxpemVfZGF0YSIsIlMiLCJXUEJDX0JGQl9TYW5pdGl6ZSIsInNhbml0aXplX2h0bWxfaWQiLCJTdHJpbmciLCJzYW5pdGl6ZV9odG1sX25hbWUiLCJpZCIsImNzc05leHQiLCJzYW5pdGl6ZV9jc3NfY2xhc3NsaXN0IiwiZGF0YXNldCIsInRwbCIsImdldF90ZW1wbGF0ZSIsImlubmVySFRNTCIsInRwbF9kYXRhIiwiZSIsInNldEF0dHJpYnV0ZSIsImlucHV0IiwicXVlcnlTZWxlY3RvciIsIlVJIiwiV1BCQ19CRkJfT3ZlcmxheSIsImVuc3VyZSIsImJ1aWxkZXIiLCJvbl9maWVsZF9kcm9wIiwid2luZG93Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvdGV4dC9fc3JjL2ZpZWxkLXRleHQtd3B0cGwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIFdQQkMgQkZCOiBGaWVsZCBSZW5kZXJlciBmb3IgXCJ0ZXh0XCIgKFdQLXRlbXBsYXRl4oCTZHJpdmVuIFJlZmVyZW5jZSwgbm8gZmFsbGJhY2spXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICogLSBVc2VzIHdwLnRlbXBsYXRlKCd3cGJjLWJmYi1maWVsZC10ZXh0JykgZm9yIHByZXZpZXdcclxuICogLSBJZiB0ZW1wbGF0ZSBpcyB1bmF2YWlsYWJsZSBvciBmYWlscywgc2hvd3MgYW4gaW5saW5lIGVycm9yIG1lc3NhZ2VcclxuICogLSBJbnNwZWN0b3IgVUkgaXMgcHJvZHVjZWQgYnkgd3AudGVtcGxhdGUoJ3dwYmMtYmZiLWluc3BlY3Rvci10ZXh0JylcclxuICogLSBBc3N1bWVzIHdwYmMtYmZiX2NvcmUgcHJvdmlkZXMgV1BCQ19CRkJfU2FuaXRpemVcclxuICpcclxuICogQ29udHJhY3RzOlxyXG4gKiAtIFJlZ2lzdHJ5OiAgV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnkucmVnaXN0ZXIoJ3RleHQnLCBDbGFzcylcclxuICogLSBDbGFzcyBBUEk6IHN0YXRpYyBnZXRfZGVmYXVsdHMoKSwgc3RhdGljIHJlbmRlcihlbCwgZGF0YSwgY3R4KSwgc3RhdGljIG9uX2ZpZWxkX2Ryb3AoZGF0YSwgZWwsIGN0eD8pIFtvcHRpb25hbF1cclxuICpcclxuICAqIEZpbGU6ICAuLi9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9maWVsZC1wYWNrcy90ZXh0L19vdXQvZmllbGQtdGV4dC13cHRwbC5qc1xyXG4gKlxyXG4gKiBAc2luY2UgICAxMS4wLjBcclxuICogQG1vZGlmaWVkICAyMDI1LTA5LTA2IDE0OjA4XHJcbiAqIEB2ZXJzaW9uIDEuMC4xXHJcbiAqL1xyXG4oZnVuY3Rpb24gKHcpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdHZhciBDb3JlICAgICA9IHcuV1BCQ19CRkJfQ29yZSB8fCB7fTtcclxuXHR2YXIgUmVnaXN0cnkgPSBDb3JlLldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5O1xyXG5cdHZhciBCYXNlICAgICA9IENvcmUuV1BCQ19CRkJfRmllbGRfQmFzZTtcclxuXHJcblx0aWYgKCAhIFJlZ2lzdHJ5IHx8IHR5cGVvZiBSZWdpc3RyeS5yZWdpc3RlciAhPT0gJ2Z1bmN0aW9uJyB8fCAhIEJhc2UgKSB7XHJcblx0XHRfd3BiYz8uZGV2Py5lcnJvcj8uKCAnV1BCQ19CRkJfRmllbGRfVGV4dCcsICdDb3JlIHJlZ2lzdHJ5L2Jhc2UgbWlzc2luZycgKTtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdGNsYXNzIFdQQkNfQkZCX0ZpZWxkX1RleHQgZXh0ZW5kcyBCYXNlIHtcclxuXHJcblx0XHQvKiogVGVtcGxhdGUgaWQgd2l0aG91dCB0aGUgXCJ0bXBsLVwiIHByZWZpeCAoQmFzZSB3aWxsIG5vcm1hbGl6ZS9jYWNoZXMgaXQpLiAqL1xyXG5cdFx0c3RhdGljIHRlbXBsYXRlX2lkID0gJ3dwYmMtYmZiLWZpZWxkLXRleHQnO1xyXG5cclxuXHRcdHN0YXRpYyBnZXRfZGVmYXVsdHMoKSB7XHJcblx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0dHlwZSAgICAgICAgIDogJ3RleHQnLFxyXG5cdFx0XHRcdGxhYmVsICAgICAgICA6ICdUZXh0JyxcclxuXHRcdFx0XHRuYW1lICAgICAgICAgOiAnJyxcclxuXHRcdFx0XHRodG1sX2lkICAgICAgOiAnJyxcclxuXHRcdFx0XHRwbGFjZWhvbGRlciAgOiAnJyxcclxuXHRcdFx0XHRyZXF1aXJlZCAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRtaW5sZW5ndGggICAgOiBudWxsLFxyXG5cdFx0XHRcdG1heGxlbmd0aCAgICA6IG51bGwsXHJcblx0XHRcdFx0cGF0dGVybiAgICAgIDogJycsXHJcblx0XHRcdFx0Y3NzY2xhc3MgICAgIDogJycsXHJcblx0XHRcdFx0aGVscCAgICAgICAgIDogJycsXHJcblx0XHRcdFx0ZGVmYXVsdF92YWx1ZTogJydcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlbmRlciB2aWEgd3AudGVtcGxhdGU7IGlmIG1pc3NpbmcsIHByaW50IGEgdGlueSBlcnJvciBtZXNzYWdlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBkYXRhXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjdHhcclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHJlbmRlcihlbCwgZGF0YSwgY3R4KSB7XHJcblxyXG5cdFx0XHRpZiAoICEgZWwgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBOb3JtYWxpemUgZmlyc3QgKG1pcnJvcnMgQmFzZS5yZW5kZXIpLlxyXG5cdFx0XHRjb25zdCBkID0gdGhpcy5ub3JtYWxpemVfZGF0YSggZGF0YSApO1xyXG5cclxuXHRcdFx0Ly8gU2FuaXRpemUgaGVscGVycyBhY3R1YWxseSBhdmFpbGFibGUgaW4gY29yZS5cclxuXHRcdFx0Y29uc3QgUyAgICAgICA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemU7XHJcblx0XHRcdGNvbnN0IGh0bWxfaWQgPSBkLmh0bWxfaWQgPyBTLnNhbml0aXplX2h0bWxfaWQoIFN0cmluZyggZC5odG1sX2lkICkgKSA6ICcnO1xyXG5cdFx0XHRjb25zdCBuYW1lICAgID0gUy5zYW5pdGl6ZV9odG1sX25hbWUoIFN0cmluZyggZC5uYW1lIHx8IGQuaWQgfHwgJ2ZpZWxkJyApICk7XHJcblx0XHRcdGNvbnN0IGNzc05leHQgPSBTLnNhbml0aXplX2Nzc19jbGFzc2xpc3QoIFN0cmluZyggZC5jc3NjbGFzcyB8fCAnJyApICk7XHJcblxyXG5cdFx0XHQvLyBLZWVwIHdyYXBwZXIgZGF0YXNldC9zdHlsZXMgaW4gc3luYyAoZG8gTk9UIGFzc2lnbiBET00gaWQgdG8gdGhlIHdyYXBwZXIpLlxyXG5cdFx0XHRpZiAoIGVsLmRhdGFzZXQuaHRtbF9pZCAhPT0gaHRtbF9pZCApIHtcclxuXHRcdFx0XHRlbC5kYXRhc2V0Lmh0bWxfaWQgPSBodG1sX2lkO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBjb25zdCBwcmV2ID0gZWwuZGF0YXNldC5jc3NjbGFzcyB8fCAnJztcclxuXHRcdFx0Ly8gaWYgKCBwcmV2ICE9PSBjc3NOZXh0ICkge1xyXG5cdFx0XHQvLyBcdHByZXYuc3BsaXQoIC9cXHMrLyApLmZpbHRlciggQm9vbGVhbiApLmZvckVhY2goIChjKSA9PiBlbC5jbGFzc0xpc3QucmVtb3ZlKCBjICkgKTtcclxuXHRcdFx0Ly8gXHRjc3NOZXh0LnNwbGl0KCAvXFxzKy8gKS5maWx0ZXIoIEJvb2xlYW4gKS5mb3JFYWNoKCAoYykgPT4gZWwuY2xhc3NMaXN0LmFkZCggYyApICk7XHJcblx0XHRcdC8vIFx0ZWwuZGF0YXNldC5jc3NjbGFzcyA9IGNzc05leHQ7XHJcblx0XHRcdC8vIH1cclxuXHRcdFx0Ly8gTkVXOiBzdG9yZSBvbmx5LlxyXG5cdFx0XHRpZiAoICdjc3NjbGFzcycgaW4gZCApIHtcclxuXHRcdFx0XHRpZiAoIGVsLmRhdGFzZXQuY3NzY2xhc3MgIT09IGNzc05leHQgKSB7XHJcblx0XHRcdFx0XHRlbC5kYXRhc2V0LmNzc2NsYXNzID0gY3NzTmV4dDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0Ly8gQ29tcGlsZSB0ZW1wbGF0ZSB2aWEgQmFzZSAoaGFuZGxlcyBcInRtcGwtXCIgKyBjYWNoaW5nKS5cclxuXHRcdFx0Y29uc3QgdHBsID0gdGhpcy5nZXRfdGVtcGxhdGUoIHRoaXMudGVtcGxhdGVfaWQgKTtcclxuXHRcdFx0aWYgKCB0eXBlb2YgdHBsICE9PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdF93cGJjPy5kZXY/LmVycm9yPy4oICd0ZXh0X3dwdHBsLnRwbC5taXNzaW5nJywgJ1RlbXBsYXRlIG5vdCBmb3VuZDogJyArIHRoaXMudGVtcGxhdGVfaWQgKTtcclxuXHRcdFx0XHRlbC5pbm5lckhUTUwgPSAnPGRpdiBjbGFzcz1cIndwYmNfYmZiX19lcnJvclwiIHJvbGU9XCJhbGVydFwiPlRlbXBsYXRlIG5vdCBmb3VuZDogd3BiYy1iZmItZmllbGQtdGV4dC48L2Rpdj4nO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gUmVuZGVyLiBQYXNzIHNhbml0aXplZCBuYW1lL2h0bWxfaWQgYmFjayB0byB0ZW1wbGF0ZSBkYXRhLlxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGNvbnN0IHRwbF9kYXRhID0geyAuLi5kLCBuYW1lLCBodG1sX2lkLCBjc3NjbGFzczogY3NzTmV4dCwgZGVmYXVsdF92YWx1ZTogKGQuZGVmYXVsdF92YWx1ZSA/PyAnJykgfTtcclxuXHRcdFx0XHRlbC5pbm5lckhUTUwgICA9IHRwbCggdHBsX2RhdGEgKTtcclxuXHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0X3dwYmM/LmRldj8uZXJyb3I/LiggJ3RleHRfd3B0cGwudHBsLnJlbmRlcicsIGUgKTtcclxuXHRcdFx0XHRlbC5pbm5lckhUTUwgPSAnPGRpdiBjbGFzcz1cIndwYmNfYmZiX19lcnJvclwiIHJvbGU9XCJhbGVydFwiPkVycm9yIHJlbmRlcmluZyBmaWVsZCBwcmV2aWV3LjwvZGl2Pic7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBLZWVwIHdyYXBwZXIgbWV0YWRhdGEgY29uc2lzdGVudCB3aXRoIEJhc2UucmVuZGVyKCkuXHJcblx0XHRcdGVsLmRhdGFzZXQudHlwZSA9IGQudHlwZSB8fCAndGV4dCc7XHJcblx0XHRcdGVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtbGFiZWwnLCAoZC5sYWJlbCAhPSBudWxsID8gU3RyaW5nKCBkLmxhYmVsICkgOiAnJykgKTtcclxuXHJcblx0XHRcdC8vIE5vcm1hbGl6ZSBhIGZldyBhdHRyaWJ1dGVzIHZpYSB0aGUgRE9NIChxdW90ZXMvbmV3bGluZXMpLCBsaWtlIEJhc2UucmVuZGVyKCkuXHJcblx0XHRcdGNvbnN0IGlucHV0ID0gZWwucXVlcnlTZWxlY3RvciggJ2lucHV0LCB0ZXh0YXJlYSwgc2VsZWN0JyApO1xyXG5cdFx0XHRpZiAoIGlucHV0ICkge1xyXG5cdFx0XHRcdGlmICggZC5wbGFjZWhvbGRlciAhPSBudWxsICkgaW5wdXQuc2V0QXR0cmlidXRlKCAncGxhY2Vob2xkZXInLCBTdHJpbmcoIGQucGxhY2Vob2xkZXIgKSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBPdmVybGF5IChoYW5kbGVzL3Rvb2xiYXJzKS5cclxuXHRcdFx0Q29yZS5VST8uV1BCQ19CRkJfT3ZlcmxheT8uZW5zdXJlPy4oIGN0eD8uYnVpbGRlciwgZWwgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE9wdGlvbmFsIGhvb2sgZXhlY3V0ZWQgYWZ0ZXIgZmllbGQgaXMgZHJvcHBlZCBmcm9tIHRoZSBwYWxldHRlLlxyXG5cdFx0ICogRXhhbXBsZSByZWNpcGUgcGxhY2Vob2xkZXIgZm9yIGZ1dHVyZTogICB0cnkgeyBpZiAoICFkYXRhLm5hbWUgKSB7IGRhdGEubmFtZSA9IGNvcmUuV1BCQ19CRkJfSWRTZXJ2aWNlPy5uZXh0X25hbWU/LiggJ3RleHQnICkgfHwgJ3RleHQnOyB9ICB9IGNhdGNoICggZSApIHsgfVxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGRhdGEgIFBhbGV0dGUvZmllbGQgZGF0YS5cclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsICAgIE5ld2x5IGNyZWF0ZWQgZmllbGQgZWxlbWVudC5cclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGN0eCAgIENvbnRleHQgeyBidWlsZGVyLCBzYW5pdCwgY29udGV4dDogJ2Ryb3AnIHwgJ2xvYWQnIHwgJ3ByZXZpZXcnIH1cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgb25fZmllbGRfZHJvcChkYXRhLCBlbCwgY3R4KSB7XHJcblx0XHRcdHN1cGVyLm9uX2ZpZWxkX2Ryb3A/LiggZGF0YSwgZWwsIGN0eCApOyAgLy8gUmVxdWlyZWQgZm9yIGNvcnJlY3RseSBhdXRvLW5hbWVzIGZyb20gIExhYmVscyAhXHJcblx0XHRcdC8vICh5b3VyIGV4dHJhIHBhY2stc3BlY2lmaWMgbG9naWMgaWYgZXZlciBuZWVkZWQpXHJcblx0XHR9XHJcblxyXG5cdH1cclxuXHJcblx0dHJ5IHtcclxuXHRcdFJlZ2lzdHJ5LnJlZ2lzdGVyKCAndGV4dCcsIFdQQkNfQkZCX0ZpZWxkX1RleHQgKTtcclxuXHR9IGNhdGNoICggZSApIHtcclxuXHRcdF93cGJjPy5kZXY/LmVycm9yPy4oICdXUEJDX0JGQl9GaWVsZF9UZXh0LnJlZ2lzdGVyX3dwdHBsJywgZSApO1xyXG5cdH1cclxufSkoIHdpbmRvdyApO1xyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQyxVQUFVQSxDQUFDLEVBQUU7RUFDYixZQUFZOztFQUVaLElBQUlDLElBQUksR0FBT0QsQ0FBQyxDQUFDRSxhQUFhLElBQUksQ0FBQyxDQUFDO0VBQ3BDLElBQUlDLFFBQVEsR0FBR0YsSUFBSSxDQUFDRyxnQ0FBZ0M7RUFDcEQsSUFBSUMsSUFBSSxHQUFPSixJQUFJLENBQUNLLG1CQUFtQjtFQUV2QyxJQUFLLENBQUVILFFBQVEsSUFBSSxPQUFPQSxRQUFRLENBQUNJLFFBQVEsS0FBSyxVQUFVLElBQUksQ0FBRUYsSUFBSSxFQUFHO0lBQ3RFRyxLQUFLLEVBQUVDLEdBQUcsRUFBRUMsS0FBSyxHQUFJLHFCQUFxQixFQUFFLDRCQUE2QixDQUFDO0lBQzFFO0VBQ0Q7RUFFQSxNQUFNQyxtQkFBbUIsU0FBU04sSUFBSSxDQUFDO0lBRXRDO0lBQ0EsT0FBT08sV0FBVyxHQUFHLHFCQUFxQjtJQUUxQyxPQUFPQyxZQUFZQSxDQUFBLEVBQUc7TUFD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
