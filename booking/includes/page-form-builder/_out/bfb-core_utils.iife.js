"use strict";

// ---------------------------------------------------------------------------------------------------------------------
// == File  /_out/core_utils.js == == Time point: 2025-08-21 17:39
// ---------------------------------------------------------------------------------------------------------------------

(function (w) {
  'use strict';

  const Core = w.WPBC_BFB_Core = w.WPBC_BFB_Core || {};

  /**
   * Core sanitize/escape/normalize helpers.
   * All methods use snake_case; camelCase aliases are provided for backwards compatibility.
   */
  class WPBC_BFB_Sanitize {
    /**
     * Escape text for safe use in CSS selectors.
     * @param {string} s - raw selector fragment
     * @returns {string}
     */
    static esc_css(s) {
      return w.CSS && CSS.escape ? CSS.escape(String(s)) : String(s).replace(/([^\w-])/g, '\\$1');
    }

    /**
     * Escape a value for attribute selectors, e.g. [data-id="<value>"].
     * @param {string} v
     * @returns {string}
     */
    static esc_attr_value_for_selector(v) {
      return String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\A ').replace(/\]/g, '\\]');
    }

    /**
     * Sanitize into a broadly compatible HTML id: letters, digits, - _ : . ; must start with a letter.
     * @param {string} v
     * @returns {string}
     */
    static sanitize_html_id(v) {
      let s = (v == null ? '' : String(v)).trim();
      s = s.replace(/\s+/g, '-').replace(/[^A-Za-z0-9\-_\:.]/g, '-').replace(/-+/g, '-').replace(/^[-_.:]+|[-_.:]+$/g, '');
      if (!s) return 'field';
      if (!/^[A-Za-z]/.test(s)) s = 'f-' + s;
      return s;
    }

    /**
     * Sanitize into a safe HTML name token: letters, digits, _ -
     * Must start with a letter; no dots/brackets/spaces.
     * @param {string} v
     * @returns {string}
     */
    static sanitize_html_name(v) {
      let s = (v == null ? '' : String(v)).trim();
      s = s.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_-]/g, '_').replace(/_+/g, '_');
      if (!s) {
        s = 'field';
      }
      if (!/^[A-Za-z]/.test(s)) {
        s = 'f_' + s;
      }
      return s;
    }

    /**
     * Escape for HTML text/attributes (not URLs).
     * @param {any} v
     * @returns {string}
     */
    static escape_html(v) {
      if (v == null) {
        return '';
      }
      return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /**
     * Sanitize a space-separated CSS class list.
     * @param {any} v
     * @returns {string}
     */
    static sanitize_css_classlist(v) {
      if (v == null) return '';
      return String(v).replace(/[^\w\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
    }
    // == NEW ==
    /**
     * Turn an arbitrary value into a conservative "token" (underscores, hyphens allowed).
     * Useful for shortcode tokens, ids in plain text, etc.
     * @param {any} v
     * @returns {string}
     */
    static to_token(v) {
      return String(v ?? '').trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_\-]/g, '');
    }

    /**
     * Convert to kebab-case (letters, digits, hyphens).
     * @param {any} v
     * @returns {string}
     */
    static to_kebab(v) {
      return String(v ?? '').trim().replace(/[_\s]+/g, '-').replace(/[^A-Za-z0-9-]/g, '').replace(/-+/g, '-').toLowerCase();
    }

    /**
     * Truthy normalization for form-like inputs: true, 'true', 1, '1', 'yes', 'on'.
     * @param {any} v
     * @returns {boolean}
     */
    static is_truthy(v) {
      if (typeof v === 'boolean') return v;
      const s = String(v ?? '').trim().toLowerCase();
      return s === 'true' || s === '1' || s === 'yes' || s === 'on';
    }

    /**
     * Coerce to boolean with an optional default for empty values.
     * @param {any} v
     * @param {boolean} [def=false]
     * @returns {boolean}
     */
    static coerce_boolean(v, def = false) {
      if (v == null || v === '') return def;
      return this.is_truthy(v);
    }

    /**
     * Parse a "percent-like" value ('33'|'33%'|33) with fallback.
     * @param {string|number|null|undefined} v
     * @param {number} fallback_value
     * @returns {number}
     */
    static parse_percent(v, fallback_value) {
      if (v == null) {
        return fallback_value;
      }
      const s = String(v).trim();
      const n = parseFloat(s.endsWith('%') ? s : s.replace('%', ''));
      return Number.isFinite(n) ? n : fallback_value;
    }

    /**
     * Clamp a number to the [min, max] range.
     * @param {number} n
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    static clamp(n, min, max) {
      return Math.max(min, Math.min(max, n));
    }

    /**
     * Escape a value for inclusion inside a quoted HTML attribute (double quotes).
     * Replaces newlines with spaces and double quotes with single quotes.
     * @param {any} v
     * @returns {string}
     */
    static escape_for_attr_quoted(v) {
      if (v == null) return '';
      return String(v).replace(/\r?\n/g, ' ').replace(/"/g, '\'');
    }

    /**
     * Escape for shortcode-like tokens where double quotes and newlines should be neutralized.
     * @param {any} v
     * @returns {string}
     */
    static escape_for_shortcode(v) {
      return String(v ?? '').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
    }

    /**
     * JSON.parse with fallback (no throw).
     * @param {string} s
     * @param {any} [fallback=null]
     * @returns {any}
     */
    static safe_json_parse(s, fallback = null) {
      try {
        return JSON.parse(s);
      } catch (_) {
        return fallback;
      }
    }

    /**
     * Stringify data-* attribute value safely (objects -> JSON, others -> String).
     * @param {any} v
     * @returns {string}
     */
    static stringify_data_value(v) {
      return typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
  }
  Core.WPBC_BFB_Sanitize = WPBC_BFB_Sanitize;
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9iZmItY29yZV91dGlscy5paWZlLmpzIiwibmFtZXMiOlsidyIsIkNvcmUiLCJXUEJDX0JGQl9Db3JlIiwiV1BCQ19CRkJfU2FuaXRpemUiLCJlc2NfY3NzIiwicyIsIkNTUyIsImVzY2FwZSIsIlN0cmluZyIsInJlcGxhY2UiLCJlc2NfYXR0cl92YWx1ZV9mb3Jfc2VsZWN0b3IiLCJ2Iiwic2FuaXRpemVfaHRtbF9pZCIsInRyaW0iLCJ0ZXN0Iiwic2FuaXRpemVfaHRtbF9uYW1lIiwiZXNjYXBlX2h0bWwiLCJzYW5pdGl6ZV9jc3NfY2xhc3NsaXN0IiwidG9fdG9rZW4iLCJ0b19rZWJhYiIsInRvTG93ZXJDYXNlIiwiaXNfdHJ1dGh5IiwiY29lcmNlX2Jvb2xlYW4iLCJkZWYiLCJwYXJzZV9wZXJjZW50IiwiZmFsbGJhY2tfdmFsdWUiLCJuIiwicGFyc2VGbG9hdCIsImVuZHNXaXRoIiwiTnVtYmVyIiwiaXNGaW5pdGUiLCJjbGFtcCIsIm1pbiIsIm1heCIsIk1hdGgiLCJlc2NhcGVfZm9yX2F0dHJfcXVvdGVkIiwiZXNjYXBlX2Zvcl9zaG9ydGNvZGUiLCJzYWZlX2pzb25fcGFyc2UiLCJmYWxsYmFjayIsIkpTT04iLCJwYXJzZSIsIl8iLCJzdHJpbmdpZnlfZGF0YV92YWx1ZSIsInN0cmluZ2lmeSIsIndpbmRvdyJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL19zcmMvYmZiLWNvcmVfdXRpbHMuaWlmZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLy8gPT0gRmlsZSAgL19vdXQvY29yZV91dGlscy5qcyA9PSA9PSBUaW1lIHBvaW50OiAyMDI1LTA4LTIxIDE3OjM5XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuKGZ1bmN0aW9uICh3KSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHRjb25zdCBDb3JlID0gKHcuV1BCQ19CRkJfQ29yZSA9IHcuV1BCQ19CRkJfQ29yZSB8fCB7fSk7XHJcblxyXG5cdC8qKlxyXG5cdCAqIENvcmUgc2FuaXRpemUvZXNjYXBlL25vcm1hbGl6ZSBoZWxwZXJzLlxyXG5cdCAqIEFsbCBtZXRob2RzIHVzZSBzbmFrZV9jYXNlOyBjYW1lbENhc2UgYWxpYXNlcyBhcmUgcHJvdmlkZWQgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LlxyXG5cdCAqL1xyXG5cdGNsYXNzIFdQQkNfQkZCX1Nhbml0aXplIHtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEVzY2FwZSB0ZXh0IGZvciBzYWZlIHVzZSBpbiBDU1Mgc2VsZWN0b3JzLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHMgLSByYXcgc2VsZWN0b3IgZnJhZ21lbnRcclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBlc2NfY3NzKHMpIHtcclxuXHRcdFx0cmV0dXJuICh3LkNTUyAmJiBDU1MuZXNjYXBlKSA/IENTUy5lc2NhcGUoIFN0cmluZyggcyApICkgOiBTdHJpbmcoIHMgKS5yZXBsYWNlKCAvKFteXFx3LV0pL2csICdcXFxcJDEnICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBFc2NhcGUgYSB2YWx1ZSBmb3IgYXR0cmlidXRlIHNlbGVjdG9ycywgZS5nLiBbZGF0YS1pZD1cIjx2YWx1ZT5cIl0uXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdlxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGVzY19hdHRyX3ZhbHVlX2Zvcl9zZWxlY3Rvcih2KSB7XHJcblx0XHRcdHJldHVybiBTdHJpbmcoIHYgKVxyXG5cdFx0XHRcdC5yZXBsYWNlKCAvXFxcXC9nLCAnXFxcXFxcXFwnIClcclxuXHRcdFx0XHQucmVwbGFjZSggL1wiL2csICdcXFxcXCInIClcclxuXHRcdFx0XHQucmVwbGFjZSggL1xcbi9nLCAnXFxcXEEgJyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC9cXF0vZywgJ1xcXFxdJyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2FuaXRpemUgaW50byBhIGJyb2FkbHkgY29tcGF0aWJsZSBIVE1MIGlkOiBsZXR0ZXJzLCBkaWdpdHMsIC0gXyA6IC4gOyBtdXN0IHN0YXJ0IHdpdGggYSBsZXR0ZXIuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdlxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHNhbml0aXplX2h0bWxfaWQodikge1xyXG5cdFx0XHRsZXQgcyA9ICh2ID09IG51bGwgPyAnJyA6IFN0cmluZyggdiApKS50cmltKCk7XHJcblx0XHRcdHMgICAgID0gc1xyXG5cdFx0XHRcdC5yZXBsYWNlKCAvXFxzKy9nLCAnLScgKVxyXG5cdFx0XHRcdC5yZXBsYWNlKCAvW15BLVphLXowLTlcXC1fXFw6Ll0vZywgJy0nIClcclxuXHRcdFx0XHQucmVwbGFjZSggLy0rL2csICctJyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC9eWy1fLjpdK3xbLV8uOl0rJC9nLCAnJyApO1xyXG5cdFx0XHRpZiAoICFzICkgcmV0dXJuICdmaWVsZCc7XHJcblx0XHRcdGlmICggIS9eW0EtWmEtel0vLnRlc3QoIHMgKSApIHMgPSAnZi0nICsgcztcclxuXHRcdFx0cmV0dXJuIHM7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTYW5pdGl6ZSBpbnRvIGEgc2FmZSBIVE1MIG5hbWUgdG9rZW46IGxldHRlcnMsIGRpZ2l0cywgXyAtXHJcblx0XHQgKiBNdXN0IHN0YXJ0IHdpdGggYSBsZXR0ZXI7IG5vIGRvdHMvYnJhY2tldHMvc3BhY2VzLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHZcclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBzYW5pdGl6ZV9odG1sX25hbWUodikge1xyXG5cclxuXHRcdFx0bGV0IHMgPSAodiA9PSBudWxsID8gJycgOiBTdHJpbmcoIHYgKSkudHJpbSgpO1xyXG5cclxuXHRcdFx0cyA9IHMucmVwbGFjZSggL1xccysvZywgJ18nICkucmVwbGFjZSggL1teQS1aYS16MC05Xy1dL2csICdfJyApLnJlcGxhY2UoIC9fKy9nLCAnXycgKTtcclxuXHJcblx0XHRcdGlmICggISBzICkge1xyXG5cdFx0XHRcdHMgPSAnZmllbGQnO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggISAvXltBLVphLXpdLy50ZXN0KCBzICkgKSB7XHJcblx0XHRcdFx0cyA9ICdmXycgKyBzO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBzO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRXNjYXBlIGZvciBIVE1MIHRleHQvYXR0cmlidXRlcyAobm90IFVSTHMpLlxyXG5cdFx0ICogQHBhcmFtIHthbnl9IHZcclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBlc2NhcGVfaHRtbCh2KSB7XHJcblx0XHRcdGlmICggdiA9PSBudWxsICkge1xyXG5cdFx0XHRcdHJldHVybiAnJztcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gU3RyaW5nKCB2IClcclxuXHRcdFx0XHQucmVwbGFjZSggLyYvZywgJyZhbXA7JyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC9cIi9nLCAnJnF1b3Q7JyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC8nL2csICcmIzAzOTsnIClcclxuXHRcdFx0XHQucmVwbGFjZSggLzwvZywgJyZsdDsnIClcclxuXHRcdFx0XHQucmVwbGFjZSggLz4vZywgJyZndDsnICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTYW5pdGl6ZSBhIHNwYWNlLXNlcGFyYXRlZCBDU1MgY2xhc3MgbGlzdC5cclxuXHRcdCAqIEBwYXJhbSB7YW55fSB2XHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgc2FuaXRpemVfY3NzX2NsYXNzbGlzdCh2KSB7XHJcblx0XHRcdGlmICggdiA9PSBudWxsICkgcmV0dXJuICcnO1xyXG5cdFx0XHRyZXR1cm4gU3RyaW5nKCB2ICkucmVwbGFjZSggL1teXFx3XFwtIF0rL2csICcgJyApLnJlcGxhY2UoIC9cXHMrL2csICcgJyApLnRyaW0oKTtcclxuXHRcdH1cclxuLy8gPT0gTkVXID09XHJcblx0XHQvKipcclxuXHRcdCAqIFR1cm4gYW4gYXJiaXRyYXJ5IHZhbHVlIGludG8gYSBjb25zZXJ2YXRpdmUgXCJ0b2tlblwiICh1bmRlcnNjb3JlcywgaHlwaGVucyBhbGxvd2VkKS5cclxuXHRcdCAqIFVzZWZ1bCBmb3Igc2hvcnRjb2RlIHRva2VucywgaWRzIGluIHBsYWluIHRleHQsIGV0Yy5cclxuXHRcdCAqIEBwYXJhbSB7YW55fSB2XHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgdG9fdG9rZW4odikge1xyXG5cdFx0XHRyZXR1cm4gU3RyaW5nKCB2ID8/ICcnIClcclxuXHRcdFx0XHQudHJpbSgpXHJcblx0XHRcdFx0LnJlcGxhY2UoIC9cXHMrL2csICdfJyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC9bXkEtWmEtejAtOV9cXC1dL2csICcnICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDb252ZXJ0IHRvIGtlYmFiLWNhc2UgKGxldHRlcnMsIGRpZ2l0cywgaHlwaGVucykuXHJcblx0XHQgKiBAcGFyYW0ge2FueX0gdlxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHRvX2tlYmFiKHYpIHtcclxuXHRcdFx0cmV0dXJuIFN0cmluZyggdiA/PyAnJyApXHJcblx0XHRcdFx0LnRyaW0oKVxyXG5cdFx0XHRcdC5yZXBsYWNlKCAvW19cXHNdKy9nLCAnLScgKVxyXG5cdFx0XHRcdC5yZXBsYWNlKCAvW15BLVphLXowLTktXS9nLCAnJyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC8tKy9nLCAnLScgKVxyXG5cdFx0XHRcdC50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogVHJ1dGh5IG5vcm1hbGl6YXRpb24gZm9yIGZvcm0tbGlrZSBpbnB1dHM6IHRydWUsICd0cnVlJywgMSwgJzEnLCAneWVzJywgJ29uJy5cclxuXHRcdCAqIEBwYXJhbSB7YW55fSB2XHJcblx0XHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGlzX3RydXRoeSh2KSB7XHJcblx0XHRcdGlmICggdHlwZW9mIHYgPT09ICdib29sZWFuJyApIHJldHVybiB2O1xyXG5cdFx0XHRjb25zdCBzID0gU3RyaW5nKCB2ID8/ICcnICkudHJpbSgpLnRvTG93ZXJDYXNlKCk7XHJcblx0XHRcdHJldHVybiBzID09PSAndHJ1ZScgfHwgcyA9PT0gJzEnIHx8IHMgPT09ICd5ZXMnIHx8IHMgPT09ICdvbic7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDb2VyY2UgdG8gYm9vbGVhbiB3aXRoIGFuIG9wdGlvbmFsIGRlZmF1bHQgZm9yIGVtcHR5IHZhbHVlcy5cclxuXHRcdCAqIEBwYXJhbSB7YW55fSB2XHJcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZWY9ZmFsc2VdXHJcblx0XHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGNvZXJjZV9ib29sZWFuKHYsIGRlZiA9IGZhbHNlKSB7XHJcblx0XHRcdGlmICggdiA9PSBudWxsIHx8IHYgPT09ICcnICkgcmV0dXJuIGRlZjtcclxuXHRcdFx0cmV0dXJuIHRoaXMuaXNfdHJ1dGh5KCB2ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBQYXJzZSBhIFwicGVyY2VudC1saWtlXCIgdmFsdWUgKCczMyd8JzMzJSd8MzMpIHdpdGggZmFsbGJhY2suXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ3xudW1iZXJ8bnVsbHx1bmRlZmluZWR9IHZcclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBmYWxsYmFja192YWx1ZVxyXG5cdFx0ICogQHJldHVybnMge251bWJlcn1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHBhcnNlX3BlcmNlbnQodiwgZmFsbGJhY2tfdmFsdWUpIHtcclxuXHRcdFx0aWYgKCB2ID09IG51bGwgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbGxiYWNrX3ZhbHVlO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IHMgPSBTdHJpbmcoIHYgKS50cmltKCk7XHJcblx0XHRcdGNvbnN0IG4gPSBwYXJzZUZsb2F0KCBzLmVuZHNXaXRoKCAnJScgKSA/IHMgOiBzLnJlcGxhY2UoICclJywgJycgKSApO1xyXG5cdFx0XHRyZXR1cm4gTnVtYmVyLmlzRmluaXRlKCBuICkgPyBuIDogZmFsbGJhY2tfdmFsdWU7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDbGFtcCBhIG51bWJlciB0byB0aGUgW21pbiwgbWF4XSByYW5nZS5cclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBuXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gbWluXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gbWF4XHJcblx0XHQgKiBAcmV0dXJucyB7bnVtYmVyfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgY2xhbXAobiwgbWluLCBtYXgpIHtcclxuXHRcdFx0cmV0dXJuIE1hdGgubWF4KCBtaW4sIE1hdGgubWluKCBtYXgsIG4gKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRXNjYXBlIGEgdmFsdWUgZm9yIGluY2x1c2lvbiBpbnNpZGUgYSBxdW90ZWQgSFRNTCBhdHRyaWJ1dGUgKGRvdWJsZSBxdW90ZXMpLlxyXG5cdFx0ICogUmVwbGFjZXMgbmV3bGluZXMgd2l0aCBzcGFjZXMgYW5kIGRvdWJsZSBxdW90ZXMgd2l0aCBzaW5nbGUgcXVvdGVzLlxyXG5cdFx0ICogQHBhcmFtIHthbnl9IHZcclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBlc2NhcGVfZm9yX2F0dHJfcXVvdGVkKHYpIHtcclxuXHRcdFx0aWYgKCB2ID09IG51bGwgKSByZXR1cm4gJyc7XHJcblx0XHRcdHJldHVybiBTdHJpbmcoIHYgKS5yZXBsYWNlKCAvXFxyP1xcbi9nLCAnICcgKS5yZXBsYWNlKCAvXCIvZywgJ1xcJycgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEVzY2FwZSBmb3Igc2hvcnRjb2RlLWxpa2UgdG9rZW5zIHdoZXJlIGRvdWJsZSBxdW90ZXMgYW5kIG5ld2xpbmVzIHNob3VsZCBiZSBuZXV0cmFsaXplZC5cclxuXHRcdCAqIEBwYXJhbSB7YW55fSB2XHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZXNjYXBlX2Zvcl9zaG9ydGNvZGUodikge1xyXG5cdFx0XHRyZXR1cm4gU3RyaW5nKCB2ID8/ICcnICkucmVwbGFjZSggL1wiL2csICdcXFxcXCInICkucmVwbGFjZSggL1xccj9cXG4vZywgJyAnICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBKU09OLnBhcnNlIHdpdGggZmFsbGJhY2sgKG5vIHRocm93KS5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBzXHJcblx0XHQgKiBAcGFyYW0ge2FueX0gW2ZhbGxiYWNrPW51bGxdXHJcblx0XHQgKiBAcmV0dXJucyB7YW55fVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgc2FmZV9qc29uX3BhcnNlKHMsIGZhbGxiYWNrID0gbnVsbCkge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHJldHVybiBKU09OLnBhcnNlKCBzICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBfICkge1xyXG5cdFx0XHRcdHJldHVybiBmYWxsYmFjaztcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU3RyaW5naWZ5IGRhdGEtKiBhdHRyaWJ1dGUgdmFsdWUgc2FmZWx5IChvYmplY3RzIC0+IEpTT04sIG90aGVycyAtPiBTdHJpbmcpLlxyXG5cdFx0ICogQHBhcmFtIHthbnl9IHZcclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBzdHJpbmdpZnlfZGF0YV92YWx1ZSh2KSB7XHJcblx0XHRcdHJldHVybiAodHlwZW9mIHYgPT09ICdvYmplY3QnKSA/IEpTT04uc3RyaW5naWZ5KCB2ICkgOiBTdHJpbmcoIHYgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdENvcmUuV1BCQ19CRkJfU2FuaXRpemUgPSBXUEJDX0JGQl9TYW5pdGl6ZTtcclxufSkoIHdpbmRvdyApO1xyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBOztBQUVBLENBQUMsVUFBVUEsQ0FBQyxFQUFFO0VBQ2IsWUFBWTs7RUFFWixNQUFNQyxJQUFJLEdBQUlELENBQUMsQ0FBQ0UsYUFBYSxHQUFHRixDQUFDLENBQUNFLGFBQWEsSUFBSSxDQUFDLENBQUU7O0VBRXREO0FBQ0Q7QUFDQTtBQUNBO0VBQ0MsTUFBTUMsaUJBQWlCLENBQUM7SUFFdkI7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLE9BQU9DLE9BQU9BLENBQUNDLENBQUMsRUFBRTtNQUNqQixPQUFRTCxDQUFDLENBQUNNLEdBQUcsSUFBSUEsR0FBRyxDQUFDQyxNQUFNLEdBQUlELEdBQUcsQ0FBQ0MsTUFBTSxDQUFFQyxNQUFNLENBQUVILENBQUUsQ0FBRSxDQUFDLEdB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
