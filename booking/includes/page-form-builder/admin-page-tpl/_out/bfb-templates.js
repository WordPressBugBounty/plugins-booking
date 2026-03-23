"use strict";

/**
 * Booking Calendar — WP template helpers (BFB Admin)
 *
 * Provides a tiny wrapper around wp.template() and a safe "ensure in DOM" helper
 * for templates that produce modal markup or other admin UI.
 *
 * Exposes under:
 *   WPBC_BFB_Core.UI.Templates:
 *     - render_wp_template( template_id, data )
 *     - ensure_dom_from_wp_template( template_id, dom_id?, data? )
 *     - ensure_dom_ref_from_wp_template( template_id, dom_id?, data? )
 *
 * Back-compat aliases (optional):
 *     - render()
 *     - ensure_dom()
 *     - ensure_dom_ref()
 * @file ../includes/page-form-builder/admin-page-tpl/_out/bfb-templates.js
 */
(function (w, d) {
  'use strict';

  const Core = w.WPBC_BFB_Core = w.WPBC_BFB_Core || {};
  const UI = Core.UI = Core.UI || {};

  /**
   * Namespace for template helpers.
   */
  const Templates = UI.Templates = UI.Templates || {};

  /**
   * Escape an id for querySelector usage.
   *
   * @param {string} s
   * @returns {string}
   */
  function css_escape(s) {
    s = String(s || '');
    if (w.CSS && typeof w.CSS.escape === 'function') {
      return w.CSS.escape(s);
    }
    return s.replace(/([^\w-])/g, '\\$1');
  }

  /**
   * Try to obtain wp.template render function.
   *
   * @param {string} template_id
   * @returns {Function|null}
   */
  function get_wp_template_fn(template_id) {
    try {
      if (!w.wp || typeof w.wp.template !== 'function') {
        return null;
      }
      const fn = w.wp.template(String(template_id || ''));
      return typeof fn === 'function' ? fn : null;
    } catch (_e) {
      return null;
    }
  }

  /**
   * Render wp.template() safely.
   *
   * Note: template_id is the id WITHOUT the "tmpl-" prefix.
   *
   * @param {string} template_id
   * @param {Object} [data]
   * @returns {string} HTML string or empty string on failure
   */
  function render_wp_template(template_id, data) {
    const fn = get_wp_template_fn(template_id);
    if (!fn) {
      return '';
    }
    try {
      return String(fn(data || {}));
    } catch (_e) {
      return '';
    }
  }

  /**
   * Parse arguments for ensure_dom_from_wp_template() supporting both signatures:
   *   - (template_id, dom_id, data)
   *   - (template_id, data)          // dom_id omitted
   *
   * @param {string|Object} dom_id_or_data
   * @param {Object} data
   * @returns {{dom_id:string, tpl_data:Object}}
   */
  function normalize_dom_args(dom_id_or_data, data) {
    // If 2nd arg is plain object => treat as data, no explicit dom_id.
    if (dom_id_or_data && typeof dom_id_or_data === 'object' && !Array.isArray(dom_id_or_data)) {
      return {
        dom_id: '',
        tpl_data: dom_id_or_data || {}
      };
    }
    return {
      dom_id: String(dom_id_or_data || ''),
      tpl_data: data || {}
    };
  }

  /**
   * Find an id on the root element or inside its subtree.
   * Used to avoid inserting duplicates when template HTML already has an id.
   *
   * @param {HTMLElement} root
   * @returns {string}
   */
  function detect_first_id(root) {
    try {
      const direct = String(root.id || root.getAttribute('id') || '');
      if (direct) {
        return direct;
      }
      const first_with_id = root.querySelector ? root.querySelector('[id]') : null;
      return first_with_id ? String(first_with_id.id || '') : '';
    } catch (_e) {
      return '';
    }
  }

  /**
   * Ensure the returned node has a stable id (only if it doesn't have one).
   *
   * @param {HTMLElement} el
   * @param {string} preferred_id
   * @param {string} fallback_id
   * @returns {void}
   */
  function ensure_element_id(el, preferred_id, fallback_id) {
    if (!el || el.id) {
      return;
    }
    const base = String(preferred_id || fallback_id || '');
    if (!base) {
      return;
    }
    let candidate = base;
    let i = 2;
    while (d.getElementById(candidate) && d.getElementById(candidate) !== el) {
      candidate = base + '-' + i++;
    }
    try {
      el.id = candidate;
    } catch (_e) {}
  }

  /**
   * Ensure a rendered template element exists in DOM (lazy insert).
   *
   * Behavior:
   * - If dom_id is provided and exists => returns that existing node.
   * - Otherwise renders the template and inserts its first root node into DOM.
   * - If the rendered root (or its subtree) already has an id that exists in DOM,
   *   return the existing element instead of inserting a duplicate.
   * - Returns the requested dom_id element if possible, else the inserted root.
   *
   * @param {string} template_id
   * @param {string|Object} [dom_id_or_data]
   * @param {Object} [data]
   * @returns {HTMLElement|null}
   */
  function ensure_dom_from_wp_template(template_id, dom_id_or_data, data) {
    const args = normalize_dom_args(dom_id_or_data, data);
    const dom_id = args.dom_id;
    const tpl_data = args.tpl_data;

    // 1) If caller asked for a specific dom_id and it's already in DOM, return it.
    if (dom_id) {
      const existing = d.getElementById(dom_id);
      if (existing) {
        return existing;
      }
    }

    // 2) Render template HTML.
    const html = render_wp_template(template_id, tpl_data);
    if (!html) {
      return null;
    }

    // 3) Convert HTML -> element (first root node).
    const wrap = d.createElement('div');
    wrap.innerHTML = String(html).trim();
    const root = wrap.firstElementChild;
    if (!root) {
      return null;
    }

    // 4) Avoid duplicate IDs:
    //    If template contains an id (root or subtree) and that id already exists in DOM,
    //    return the existing element instead of inserting a duplicate.
    const detected_id = detect_first_id(root);
    if (!dom_id && detected_id) {
      const existing_by_detected = d.getElementById(detected_id);
      if (existing_by_detected) return existing_by_detected;
    }

    // 5) Insert into DOM.
    (d.body || d.documentElement).appendChild(root);

    // 6) Return requested target:
    //    - If dom_id provided: try getElementById(dom_id), else try querySelector inside root, else root.
    let ret = root;
    if (dom_id) {
      ret = d.getElementById(dom_id) || root;
      if (ret === root) {
        try {
          const inside = root.querySelector('#' + css_escape(dom_id));
          if (inside) ret = inside;
        } catch (_e) {}
      }
    }

    // 7) Make sure returned node has an id (useful for modal show/hide).
    ensure_element_id(ret, dom_id, detected_id || 'wpbc_tpl_' + String(template_id || 'tpl'));

    // 8) Post-render normalizers (safe no-op if not defined yet).
    try {
      if (UI.apply_post_render) {
        UI.apply_post_render(ret);
      }
    } catch (_e) {}
    return ret;
  }

  /**
   * Same as ensure_dom_from_wp_template(), but returns both element and resolved id.
   *
   * @param {string} template_id
   * @param {string|Object} [dom_id_or_data]
   * @param {Object} [data]
   * @returns {{id:string, el:HTMLElement}|null}
   */
  function ensure_dom_ref_from_wp_template(template_id, dom_id_or_data, data) {
    const el = ensure_dom_from_wp_template(template_id, dom_id_or_data, data);
    if (!el) return null;
    return {
      id: String(el.id || ''),
      el
    };
  }

  // -------------------------------------------------------------------------
  // Public API (clear names)
  // -------------------------------------------------------------------------

  Templates.render_wp_template = render_wp_template;
  Templates.ensure_dom_from_wp_template = ensure_dom_from_wp_template;
  Templates.ensure_dom_ref_from_wp_template = ensure_dom_ref_from_wp_template;

  // Keep escape available (useful for callers that need selector-safe ids).
  Templates.css_escape = css_escape;

  // Also keep your existing UI.* aliases if other files already call these:.
  UI.render_wp_template = Templates.render_wp_template;
  UI.ensure_dom_from_wp_template = Templates.ensure_dom_from_wp_template;
  UI.ensure_dom_ref_from_wp_template = Templates.ensure_dom_ref_from_wp_template;

  // -------------------------------------------------------------------------
  // UI.Modals (admin helper)
  // - Optional dependency: jQuery.fn.wpbc_my_modal
  // - Safe fallback: toggles display style
  // -------------------------------------------------------------------------

  const Modals = UI.Modals = UI.Modals || {};

  // Reuse the same escape helper everywhere.
  Modals.css_escape = Modals.css_escape || Templates.css_escape || css_escape;
  Modals.show = Modals.show || function (modal_el_or_id) {
    const modal_id = typeof modal_el_or_id === 'string' ? String(modal_el_or_id || '') : String(modal_el_or_id && modal_el_or_id.id ? modal_el_or_id.id : '');
    const modal_el = typeof modal_el_or_id === 'string' ? d.getElementById(modal_id) : modal_el_or_id;
    if (!modal_el) return;
    try {
      if (w.jQuery && w.jQuery.fn && w.jQuery.fn.wpbc_my_modal) {
        const $m = modal_id ? w.jQuery('#' + Modals.css_escape(modal_id)) : w.jQuery(modal_el);
        if ($m && $m.wpbc_my_modal) {
          $m.wpbc_my_modal('show');
          return;
        }
      }
    } catch (_e) {}
    modal_el.style.display = 'block';
  };
  Modals.hide = Modals.hide || function (modal_el_or_id) {
    const modal_id = typeof modal_el_or_id === 'string' ? String(modal_el_or_id || '') : String(modal_el_or_id && modal_el_or_id.id ? modal_el_or_id.id : '');
    const modal_el = typeof modal_el_or_id === 'string' ? d.getElementById(modal_id) : modal_el_or_id;
    if (!modal_el) return;
    try {
      if (w.jQuery && w.jQuery.fn && w.jQuery.fn.wpbc_my_modal) {
        const $m = modal_id ? w.jQuery('#' + Modals.css_escape(modal_id)) : w.jQuery(modal_el);
        if ($m && $m.wpbc_my_modal) {
          $m.wpbc_my_modal('hide');
          return;
        }
      }
    } catch (_e) {}
    modal_el.style.display = 'none';
  };
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvYWRtaW4tcGFnZS10cGwvX291dC9iZmItdGVtcGxhdGVzLmpzIiwibmFtZXMiOlsidyIsImQiLCJDb3JlIiwiV1BCQ19CRkJfQ29yZSIsIlVJIiwiVGVtcGxhdGVzIiwiY3NzX2VzY2FwZSIsInMiLCJTdHJpbmciLCJDU1MiLCJlc2NhcGUiLCJyZXBsYWNlIiwiZ2V0X3dwX3RlbXBsYXRlX2ZuIiwidGVtcGxhdGVfaWQiLCJ3cCIsInRlbXBsYXRlIiwiZm4iLCJfZSIsInJlbmRlcl93cF90ZW1wbGF0ZSIsImRhdGEiLCJub3JtYWxpemVfZG9tX2FyZ3MiLCJkb21faWRfb3JfZGF0YSIsIkFycmF5IiwiaXNBcnJheSIsImRvbV9pZCIsInRwbF9kYXRhIiwiZGV0ZWN0X2ZpcnN0X2lkIiwicm9vdCIsImRpcmVjdCIsImlkIiwiZ2V0QXR0cmlidXRlIiwiZmlyc3Rfd2l0aF9pZCIsInF1ZXJ5U2VsZWN0b3IiLCJlbnN1cmVfZWxlbWVudF9pZCIsImVsIiwicHJlZmVycmVkX2lkIiwiZmFsbGJhY2tfaWQiLCJiYXNlIiwiY2FuZGlkYXRlIiwiaSIsImdldEVsZW1lbnRCeUlkIiwiZW5zdXJlX2RvbV9mcm9tX3dwX3RlbXBsYXRlIiwiYXJncyIsImV4aXN0aW5nIiwiaHRtbCIsIndyYXAiLCJjcmVhdGVFbGVtZW50IiwiaW5uZXJIVE1MIiwidHJpbSIsImZpcnN0RWxlbWVudENoaWxkIiwiZGV0ZWN0ZWRfaWQiLCJleGlzdGluZ19ieV9kZXRlY3RlZCIsImJvZHkiLCJkb2N1bWVudEVsZW1lbnQiLCJhcHBlbmRDaGlsZCIsInJldCIsImluc2lkZSIsImFwcGx5X3Bvc3RfcmVuZGVyIiwiZW5zdXJlX2RvbV9yZWZfZnJvbV93cF90ZW1wbGF0ZSIsIk1vZGFscyIsInNob3ciLCJtb2RhbF9lbF9vcl9pZCIsIm1vZGFsX2lkIiwibW9kYWxfZWwiLCJqUXVlcnkiLCJ3cGJjX215X21vZGFsIiwiJG0iLCJzdHlsZSIsImRpc3BsYXkiLCJoaWRlIiwid2luZG93IiwiZG9jdW1lbnQiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9hZG1pbi1wYWdlLXRwbC9fc3JjL2JmYi10ZW1wbGF0ZXMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIEJvb2tpbmcgQ2FsZW5kYXIg4oCUIFdQIHRlbXBsYXRlIGhlbHBlcnMgKEJGQiBBZG1pbilcclxuICpcclxuICogUHJvdmlkZXMgYSB0aW55IHdyYXBwZXIgYXJvdW5kIHdwLnRlbXBsYXRlKCkgYW5kIGEgc2FmZSBcImVuc3VyZSBpbiBET01cIiBoZWxwZXJcclxuICogZm9yIHRlbXBsYXRlcyB0aGF0IHByb2R1Y2UgbW9kYWwgbWFya3VwIG9yIG90aGVyIGFkbWluIFVJLlxyXG4gKlxyXG4gKiBFeHBvc2VzIHVuZGVyOlxyXG4gKiAgIFdQQkNfQkZCX0NvcmUuVUkuVGVtcGxhdGVzOlxyXG4gKiAgICAgLSByZW5kZXJfd3BfdGVtcGxhdGUoIHRlbXBsYXRlX2lkLCBkYXRhIClcclxuICogICAgIC0gZW5zdXJlX2RvbV9mcm9tX3dwX3RlbXBsYXRlKCB0ZW1wbGF0ZV9pZCwgZG9tX2lkPywgZGF0YT8gKVxyXG4gKiAgICAgLSBlbnN1cmVfZG9tX3JlZl9mcm9tX3dwX3RlbXBsYXRlKCB0ZW1wbGF0ZV9pZCwgZG9tX2lkPywgZGF0YT8gKVxyXG4gKlxyXG4gKiBCYWNrLWNvbXBhdCBhbGlhc2VzIChvcHRpb25hbCk6XHJcbiAqICAgICAtIHJlbmRlcigpXHJcbiAqICAgICAtIGVuc3VyZV9kb20oKVxyXG4gKiAgICAgLSBlbnN1cmVfZG9tX3JlZigpXHJcbiAqIEBmaWxlIC4uL2luY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2FkbWluLXBhZ2UtdHBsL19vdXQvYmZiLXRlbXBsYXRlcy5qc1xyXG4gKi9cclxuKGZ1bmN0aW9uICh3LCBkKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHRjb25zdCBDb3JlID0gKHcuV1BCQ19CRkJfQ29yZSA9IHcuV1BCQ19CRkJfQ29yZSB8fCB7fSk7XHJcblx0Y29uc3QgVUkgICA9IChDb3JlLlVJID0gQ29yZS5VSSB8fCB7fSk7XHJcblxyXG5cdC8qKlxyXG5cdCAqIE5hbWVzcGFjZSBmb3IgdGVtcGxhdGUgaGVscGVycy5cclxuXHQgKi9cclxuXHRjb25zdCBUZW1wbGF0ZXMgPSAoVUkuVGVtcGxhdGVzID0gVUkuVGVtcGxhdGVzIHx8IHt9KTtcclxuXHJcblx0LyoqXHJcblx0ICogRXNjYXBlIGFuIGlkIGZvciBxdWVyeVNlbGVjdG9yIHVzYWdlLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHNcclxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGNzc19lc2NhcGUocykge1xyXG5cdFx0cyA9IFN0cmluZyggcyB8fCAnJyApO1xyXG5cdFx0aWYgKCB3LkNTUyAmJiB0eXBlb2Ygdy5DU1MuZXNjYXBlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRyZXR1cm4gdy5DU1MuZXNjYXBlKCBzICk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gcy5yZXBsYWNlKCAvKFteXFx3LV0pL2csICdcXFxcJDEnICk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBUcnkgdG8gb2J0YWluIHdwLnRlbXBsYXRlIHJlbmRlciBmdW5jdGlvbi5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZV9pZFxyXG5cdCAqIEByZXR1cm5zIHtGdW5jdGlvbnxudWxsfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGdldF93cF90ZW1wbGF0ZV9mbih0ZW1wbGF0ZV9pZCkge1xyXG5cdFx0dHJ5IHtcclxuXHRcdFx0aWYgKCAhIHcud3AgfHwgdHlwZW9mIHcud3AudGVtcGxhdGUgIT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc3QgZm4gPSB3LndwLnRlbXBsYXRlKCBTdHJpbmcoIHRlbXBsYXRlX2lkIHx8ICcnICkgKTtcclxuXHRcdFx0cmV0dXJuICh0eXBlb2YgZm4gPT09ICdmdW5jdGlvbicpID8gZm4gOiBudWxsO1xyXG5cdFx0fSBjYXRjaCAoIF9lICkge1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlbmRlciB3cC50ZW1wbGF0ZSgpIHNhZmVseS5cclxuXHQgKlxyXG5cdCAqIE5vdGU6IHRlbXBsYXRlX2lkIGlzIHRoZSBpZCBXSVRIT1VUIHRoZSBcInRtcGwtXCIgcHJlZml4LlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHRlbXBsYXRlX2lkXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IFtkYXRhXVxyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9IEhUTUwgc3RyaW5nIG9yIGVtcHR5IHN0cmluZyBvbiBmYWlsdXJlXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gcmVuZGVyX3dwX3RlbXBsYXRlKHRlbXBsYXRlX2lkLCBkYXRhKSB7XHJcblx0XHRjb25zdCBmbiA9IGdldF93cF90ZW1wbGF0ZV9mbiggdGVtcGxhdGVfaWQgKTtcclxuXHRcdGlmICggISBmbiApIHtcclxuXHRcdFx0cmV0dXJuICcnO1xyXG5cdFx0fVxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0cmV0dXJuIFN0cmluZyggZm4oIGRhdGEgfHwge30gKSApO1xyXG5cdFx0fSBjYXRjaCAoIF9lICkge1xyXG5cdFx0XHRyZXR1cm4gJyc7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBQYXJzZSBhcmd1bWVudHMgZm9yIGVuc3VyZV9kb21fZnJvbV93cF90ZW1wbGF0ZSgpIHN1cHBvcnRpbmcgYm90aCBzaWduYXR1cmVzOlxyXG5cdCAqICAgLSAodGVtcGxhdGVfaWQsIGRvbV9pZCwgZGF0YSlcclxuXHQgKiAgIC0gKHRlbXBsYXRlX2lkLCBkYXRhKSAgICAgICAgICAvLyBkb21faWQgb21pdHRlZFxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8T2JqZWN0fSBkb21faWRfb3JfZGF0YVxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhXHJcblx0ICogQHJldHVybnMge3tkb21faWQ6c3RyaW5nLCB0cGxfZGF0YTpPYmplY3R9fVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9kb21fYXJncyhkb21faWRfb3JfZGF0YSwgZGF0YSkge1xyXG5cdFx0Ly8gSWYgMm5kIGFyZyBpcyBwbGFpbiBvYmplY3QgPT4gdHJlYXQgYXMgZGF0YSwgbm8gZXhwbGljaXQgZG9tX2lkLlxyXG5cdFx0aWYgKCBkb21faWRfb3JfZGF0YSAmJiB0eXBlb2YgZG9tX2lkX29yX2RhdGEgPT09ICdvYmplY3QnICYmICEgQXJyYXkuaXNBcnJheSggZG9tX2lkX29yX2RhdGEgKSApIHtcclxuXHRcdFx0cmV0dXJuIHsgZG9tX2lkOiAnJywgdHBsX2RhdGE6IGRvbV9pZF9vcl9kYXRhIHx8IHt9IH07XHJcblx0XHR9XHJcblx0XHRyZXR1cm4geyBkb21faWQ6IFN0cmluZyggZG9tX2lkX29yX2RhdGEgfHwgJycgKSwgdHBsX2RhdGE6IGRhdGEgfHwge30gfTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEZpbmQgYW4gaWQgb24gdGhlIHJvb3QgZWxlbWVudCBvciBpbnNpZGUgaXRzIHN1YnRyZWUuXHJcblx0ICogVXNlZCB0byBhdm9pZCBpbnNlcnRpbmcgZHVwbGljYXRlcyB3aGVuIHRlbXBsYXRlIEhUTUwgYWxyZWFkeSBoYXMgYW4gaWQuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByb290XHJcblx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHQgKi9cclxuXHRmdW5jdGlvbiBkZXRlY3RfZmlyc3RfaWQocm9vdCkge1xyXG5cdFx0dHJ5IHtcclxuXHRcdFx0Y29uc3QgZGlyZWN0ID0gU3RyaW5nKCByb290LmlkIHx8IHJvb3QuZ2V0QXR0cmlidXRlKCAnaWQnICkgfHwgJycgKTtcclxuXHRcdFx0aWYgKCBkaXJlY3QgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGRpcmVjdDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgZmlyc3Rfd2l0aF9pZCA9IHJvb3QucXVlcnlTZWxlY3RvciA/IHJvb3QucXVlcnlTZWxlY3RvciggJ1tpZF0nICkgOiBudWxsO1xyXG5cdFx0XHRyZXR1cm4gZmlyc3Rfd2l0aF9pZCA/IFN0cmluZyggZmlyc3Rfd2l0aF9pZC5pZCB8fCAnJyApIDogJyc7XHJcblx0XHR9IGNhdGNoICggX2UgKSB7XHJcblx0XHRcdHJldHVybiAnJztcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEVuc3VyZSB0aGUgcmV0dXJuZWQgbm9kZSBoYXMgYSBzdGFibGUgaWQgKG9ubHkgaWYgaXQgZG9lc24ndCBoYXZlIG9uZSkuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbFxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBwcmVmZXJyZWRfaWRcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZmFsbGJhY2tfaWRcclxuXHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiBlbnN1cmVfZWxlbWVudF9pZChlbCwgcHJlZmVycmVkX2lkLCBmYWxsYmFja19pZCkge1xyXG5cdFx0aWYgKCAhIGVsIHx8IGVsLmlkICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3QgYmFzZSA9IFN0cmluZyggcHJlZmVycmVkX2lkIHx8IGZhbGxiYWNrX2lkIHx8ICcnICk7XHJcblx0XHRpZiAoICEgYmFzZSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGxldCBjYW5kaWRhdGUgPSBiYXNlO1xyXG5cdFx0bGV0IGkgICAgICAgICA9IDI7XHJcblxyXG5cdFx0d2hpbGUgKCBkLmdldEVsZW1lbnRCeUlkKCBjYW5kaWRhdGUgKSAmJiBkLmdldEVsZW1lbnRCeUlkKCBjYW5kaWRhdGUgKSAhPT0gZWwgKSB7XHJcblx0XHRcdGNhbmRpZGF0ZSA9IGJhc2UgKyAnLScgKyAoaSsrKTtcclxuXHRcdH1cclxuXHJcblx0XHR0cnkge1xyXG5cdFx0XHRlbC5pZCA9IGNhbmRpZGF0ZTtcclxuXHRcdH0gY2F0Y2ggKCBfZSApIHtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEVuc3VyZSBhIHJlbmRlcmVkIHRlbXBsYXRlIGVsZW1lbnQgZXhpc3RzIGluIERPTSAobGF6eSBpbnNlcnQpLlxyXG5cdCAqXHJcblx0ICogQmVoYXZpb3I6XHJcblx0ICogLSBJZiBkb21faWQgaXMgcHJvdmlkZWQgYW5kIGV4aXN0cyA9PiByZXR1cm5zIHRoYXQgZXhpc3Rpbmcgbm9kZS5cclxuXHQgKiAtIE90aGVyd2lzZSByZW5kZXJzIHRoZSB0ZW1wbGF0ZSBhbmQgaW5zZXJ0cyBpdHMgZmlyc3Qgcm9vdCBub2RlIGludG8gRE9NLlxyXG5cdCAqIC0gSWYgdGhlIHJlbmRlcmVkIHJvb3QgKG9yIGl0cyBzdWJ0cmVlKSBhbHJlYWR5IGhhcyBhbiBpZCB0aGF0IGV4aXN0cyBpbiBET00sXHJcblx0ICogICByZXR1cm4gdGhlIGV4aXN0aW5nIGVsZW1lbnQgaW5zdGVhZCBvZiBpbnNlcnRpbmcgYSBkdXBsaWNhdGUuXHJcblx0ICogLSBSZXR1cm5zIHRoZSByZXF1ZXN0ZWQgZG9tX2lkIGVsZW1lbnQgaWYgcG9zc2libGUsIGVsc2UgdGhlIGluc2VydGVkIHJvb3QuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGVfaWRcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xPYmplY3R9IFtkb21faWRfb3JfZGF0YV1cclxuXHQgKiBAcGFyYW0ge09iamVjdH0gW2RhdGFdXHJcblx0ICogQHJldHVybnMge0hUTUxFbGVtZW50fG51bGx9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gZW5zdXJlX2RvbV9mcm9tX3dwX3RlbXBsYXRlKHRlbXBsYXRlX2lkLCBkb21faWRfb3JfZGF0YSwgZGF0YSkge1xyXG5cdFx0Y29uc3QgYXJncyAgICAgPSBub3JtYWxpemVfZG9tX2FyZ3MoIGRvbV9pZF9vcl9kYXRhLCBkYXRhICk7XHJcblx0XHRjb25zdCBkb21faWQgICA9IGFyZ3MuZG9tX2lkO1xyXG5cdFx0Y29uc3QgdHBsX2RhdGEgPSBhcmdzLnRwbF9kYXRhO1xyXG5cclxuXHRcdC8vIDEpIElmIGNhbGxlciBhc2tlZCBmb3IgYSBzcGVjaWZpYyBkb21faWQgYW5kIGl0J3MgYWxyZWFkeSBpbiBET00sIHJldHVybiBpdC5cclxuXHRcdGlmICggZG9tX2lkICkge1xyXG5cdFx0XHRjb25zdCBleGlzdGluZyA9IGQuZ2V0RWxlbWVudEJ5SWQoIGRvbV9pZCApO1xyXG5cdFx0XHRpZiAoIGV4aXN0aW5nICkge1xyXG5cdFx0XHRcdHJldHVybiBleGlzdGluZztcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIDIpIFJlbmRlciB0ZW1wbGF0ZSBIVE1MLlxyXG5cdFx0Y29uc3QgaHRtbCA9IHJlbmRlcl93cF90ZW1wbGF0ZSggdGVtcGxhdGVfaWQsIHRwbF9kYXRhICk7XHJcblx0XHRpZiAoICEgaHRtbCApIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gMykgQ29udmVydCBIVE1MIC0+IGVsZW1lbnQgKGZpcnN0IHJvb3Qgbm9kZSkuXHJcblx0XHRjb25zdCB3cmFwICAgICA9IGQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcclxuXHRcdHdyYXAuaW5uZXJIVE1MID0gU3RyaW5nKCBodG1sICkudHJpbSgpO1xyXG5cclxuXHRcdGNvbnN0IHJvb3QgPSB3cmFwLmZpcnN0RWxlbWVudENoaWxkO1xyXG5cdFx0aWYgKCAhIHJvb3QgKSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIDQpIEF2b2lkIGR1cGxpY2F0ZSBJRHM6XHJcblx0XHQvLyAgICBJZiB0ZW1wbGF0ZSBjb250YWlucyBhbiBpZCAocm9vdCBvciBzdWJ0cmVlKSBhbmQgdGhhdCBpZCBhbHJlYWR5IGV4aXN0cyBpbiBET00sXHJcblx0XHQvLyAgICByZXR1cm4gdGhlIGV4aXN0aW5nIGVsZW1lbnQgaW5zdGVhZCBvZiBpbnNlcnRpbmcgYSBkdXBsaWNhdGUuXHJcblx0XHRjb25zdCBkZXRlY3RlZF9pZCA9IGRldGVjdF9maXJzdF9pZCggcm9vdCApO1xyXG5cdFx0aWYgKCAhZG9tX2lkICYmIGRldGVjdGVkX2lkICkge1xyXG5cdFx0XHRjb25zdCBleGlzdGluZ19ieV9kZXRlY3RlZCA9IGQuZ2V0RWxlbWVudEJ5SWQoIGRldGVjdGVkX2lkICk7XHJcblx0XHRcdGlmICggZXhpc3RpbmdfYnlfZGV0ZWN0ZWQgKSByZXR1cm4gZXhpc3RpbmdfYnlfZGV0ZWN0ZWQ7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gNSkgSW5zZXJ0IGludG8gRE9NLlxyXG5cdFx0KGQuYm9keSB8fCBkLmRvY3VtZW50RWxlbWVudCkuYXBwZW5kQ2hpbGQoIHJvb3QgKTtcclxuXHJcblx0XHQvLyA2KSBSZXR1cm4gcmVxdWVzdGVkIHRhcmdldDpcclxuXHRcdC8vICAgIC0gSWYgZG9tX2lkIHByb3ZpZGVkOiB0cnkgZ2V0RWxlbWVudEJ5SWQoZG9tX2lkKSwgZWxzZSB0cnkgcXVlcnlTZWxlY3RvciBpbnNpZGUgcm9vdCwgZWxzZSByb290LlxyXG5cdFx0bGV0IHJldCA9IHJvb3Q7XHJcblxyXG5cdFx0aWYgKCBkb21faWQgKSB7XHJcblx0XHRcdHJldCA9IGQuZ2V0RWxlbWVudEJ5SWQoIGRvbV9pZCApIHx8IHJvb3Q7XHJcblx0XHRcdGlmICggcmV0ID09PSByb290ICkge1xyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRjb25zdCBpbnNpZGUgPSByb290LnF1ZXJ5U2VsZWN0b3IoICcjJyArIGNzc19lc2NhcGUoIGRvbV9pZCApICk7XHJcblx0XHRcdFx0XHRpZiAoIGluc2lkZSApIHJldCA9IGluc2lkZTtcclxuXHRcdFx0XHR9IGNhdGNoICggX2UgKSB7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gNykgTWFrZSBzdXJlIHJldHVybmVkIG5vZGUgaGFzIGFuIGlkICh1c2VmdWwgZm9yIG1vZGFsIHNob3cvaGlkZSkuXHJcblx0XHRlbnN1cmVfZWxlbWVudF9pZCggcmV0LCBkb21faWQsIGRldGVjdGVkX2lkIHx8ICgnd3BiY190cGxfJyArIFN0cmluZyggdGVtcGxhdGVfaWQgfHwgJ3RwbCcgKSkgKTtcclxuXHJcblx0XHQvLyA4KSBQb3N0LXJlbmRlciBub3JtYWxpemVycyAoc2FmZSBuby1vcCBpZiBub3QgZGVmaW5lZCB5ZXQpLlxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0aWYgKCBVSS5hcHBseV9wb3N0X3JlbmRlciApIHtcclxuXHRcdFx0XHRVSS5hcHBseV9wb3N0X3JlbmRlciggcmV0ICk7XHJcblx0XHRcdH1cclxuXHRcdH0gY2F0Y2ggKCBfZSApIHtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcmV0O1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogU2FtZSBhcyBlbnN1cmVfZG9tX2Zyb21fd3BfdGVtcGxhdGUoKSwgYnV0IHJldHVybnMgYm90aCBlbGVtZW50IGFuZCByZXNvbHZlZCBpZC5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZV9pZFxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfE9iamVjdH0gW2RvbV9pZF9vcl9kYXRhXVxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBbZGF0YV1cclxuXHQgKiBAcmV0dXJucyB7e2lkOnN0cmluZywgZWw6SFRNTEVsZW1lbnR9fG51bGx9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gZW5zdXJlX2RvbV9yZWZfZnJvbV93cF90ZW1wbGF0ZSh0ZW1wbGF0ZV9pZCwgZG9tX2lkX29yX2RhdGEsIGRhdGEpIHtcclxuXHRcdGNvbnN0IGVsID0gZW5zdXJlX2RvbV9mcm9tX3dwX3RlbXBsYXRlKCB0ZW1wbGF0ZV9pZCwgZG9tX2lkX29yX2RhdGEsIGRhdGEgKTtcclxuXHRcdGlmICggIWVsICkgcmV0dXJuIG51bGw7XHJcblx0XHRyZXR1cm4geyBpZDogU3RyaW5nKCBlbC5pZCB8fCAnJyApLCBlbCB9O1xyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFB1YmxpYyBBUEkgKGNsZWFyIG5hbWVzKVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0VGVtcGxhdGVzLnJlbmRlcl93cF90ZW1wbGF0ZSAgICAgICAgICAgICAgPSByZW5kZXJfd3BfdGVtcGxhdGU7XHJcblx0VGVtcGxhdGVzLmVuc3VyZV9kb21fZnJvbV93cF90ZW1wbGF0ZSAgICAgPSBlbnN1cmVfZG9tX2Zyb21fd3BfdGVtcGxhdGU7XHJcblx0VGVtcGxhdGVzLmVuc3VyZV9kb21fcmVmX2Zyb21fd3BfdGVtcGxhdGUgPSBlbnN1cmVfZG9tX3JlZl9mcm9tX3dwX3RlbXBsYXRlO1xyXG5cclxuXHQvLyBLZWVwIGVzY2FwZSBhdmFpbGFibGUgKHVzZWZ1bCBmb3IgY2FsbGVycyB0aGF0IG5lZWQgc2VsZWN0b3Itc2FmZSBpZHMpLlxyXG5cdFRlbXBsYXRlcy5jc3NfZXNjYXBlID0gY3NzX2VzY2FwZTtcclxuXHJcblx0Ly8gQWxzbyBrZWVwIHlvdXIgZXhpc3RpbmcgVUkuKiBhbGlhc2VzIGlmIG90aGVyIGZpbGVzIGFscmVhZHkgY2FsbCB0aGVzZTouXHJcblx0VUkucmVuZGVyX3dwX3RlbXBsYXRlICAgICAgICAgICAgICA9IFRlbXBsYXRlcy5yZW5kZXJfd3BfdGVtcGxhdGU7XHJcblx0VUkuZW5zdXJlX2RvbV9mcm9tX3dwX3RlbXBsYXRlICAgICA9IFRlbXBsYXRlcy5lbnN1cmVfZG9tX2Zyb21fd3BfdGVtcGxhdGU7XHJcblx0VUkuZW5zdXJlX2RvbV9yZWZfZnJvbV93cF90ZW1wbGF0ZSA9IFRlbXBsYXRlcy5lbnN1cmVfZG9tX3JlZl9mcm9tX3dwX3RlbXBsYXRlO1xyXG5cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFVJLk1vZGFscyAoYWRtaW4gaGVscGVyKVxyXG5cdC8vIC0gT3B0aW9uYWwgZGVwZW5kZW5jeTogalF1ZXJ5LmZuLndwYmNfbXlfbW9kYWxcclxuXHQvLyAtIFNhZmUgZmFsbGJhY2s6IHRvZ2dsZXMgZGlzcGxheSBzdHlsZVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0Y29uc3QgTW9kYWxzID0gKFVJLk1vZGFscyA9IFVJLk1vZGFscyB8fCB7fSk7XHJcblxyXG5cdC8vIFJldXNlIHRoZSBzYW1lIGVzY2FwZSBoZWxwZXIgZXZlcnl3aGVyZS5cclxuXHRNb2RhbHMuY3NzX2VzY2FwZSA9IE1vZGFscy5jc3NfZXNjYXBlIHx8IFRlbXBsYXRlcy5jc3NfZXNjYXBlIHx8IGNzc19lc2NhcGU7XHJcblxyXG5cdE1vZGFscy5zaG93ID0gTW9kYWxzLnNob3cgfHwgZnVuY3Rpb24gKG1vZGFsX2VsX29yX2lkKSB7XHJcblxyXG5cdFx0Y29uc3QgbW9kYWxfaWQgPSAodHlwZW9mIG1vZGFsX2VsX29yX2lkID09PSAnc3RyaW5nJylcclxuXHRcdFx0PyBTdHJpbmcoIG1vZGFsX2VsX29yX2lkIHx8ICcnIClcclxuXHRcdFx0OiBTdHJpbmcoIChtb2RhbF9lbF9vcl9pZCAmJiBtb2RhbF9lbF9vcl9pZC5pZCkgPyBtb2RhbF9lbF9vcl9pZC5pZCA6ICcnICk7XHJcblxyXG5cdFx0Y29uc3QgbW9kYWxfZWwgPSAodHlwZW9mIG1vZGFsX2VsX29yX2lkID09PSAnc3RyaW5nJylcclxuXHRcdFx0PyBkLmdldEVsZW1lbnRCeUlkKCBtb2RhbF9pZCApXHJcblx0XHRcdDogbW9kYWxfZWxfb3JfaWQ7XHJcblxyXG5cdFx0aWYgKCAhbW9kYWxfZWwgKSByZXR1cm47XHJcblxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0aWYgKCB3LmpRdWVyeSAmJiB3LmpRdWVyeS5mbiAmJiB3LmpRdWVyeS5mbi53cGJjX215X21vZGFsICkge1xyXG5cclxuXHRcdFx0XHRjb25zdCAkbSA9IG1vZGFsX2lkXHJcblx0XHRcdFx0XHQ/IHcualF1ZXJ5KCAnIycgKyBNb2RhbHMuY3NzX2VzY2FwZSggbW9kYWxfaWQgKSApXHJcblx0XHRcdFx0XHQ6IHcualF1ZXJ5KCBtb2RhbF9lbCApO1xyXG5cclxuXHRcdFx0XHRpZiAoICRtICYmICRtLndwYmNfbXlfbW9kYWwgKSB7XHJcblx0XHRcdFx0XHQkbS53cGJjX215X21vZGFsKCAnc2hvdycgKTtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0gY2F0Y2ggKCBfZSApIHtcclxuXHRcdH1cclxuXHJcblx0XHRtb2RhbF9lbC5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcclxuXHR9O1xyXG5cclxuXHRNb2RhbHMuaGlkZSA9IE1vZGFscy5oaWRlIHx8IGZ1bmN0aW9uIChtb2RhbF9lbF9vcl9pZCkge1xyXG5cclxuXHRcdGNvbnN0IG1vZGFsX2lkID0gKHR5cGVvZiBtb2RhbF9lbF9vcl9pZCA9PT0gJ3N0cmluZycpXHJcblx0XHRcdD8gU3RyaW5nKCBtb2RhbF9lbF9vcl9pZCB8fCAnJyApXHJcblx0XHRcdDogU3RyaW5nKCAobW9kYWxfZWxfb3JfaWQgJiYgbW9kYWxfZWxfb3JfaWQuaWQpID8gbW9kYWxfZWxfb3JfaWQuaWQgOiAnJyApO1xyXG5cclxuXHRcdGNvbnN0IG1vZGFsX2VsID0gKHR5cGVvZiBtb2RhbF9lbF9vcl9pZCA9PT0gJ3N0cmluZycpXHJcblx0XHRcdD8gZC5nZXRFbGVtZW50QnlJZCggbW9kYWxfaWQgKVxyXG5cdFx0XHQ6IG1vZGFsX2VsX29yX2lkO1xyXG5cclxuXHRcdGlmICggIW1vZGFsX2VsICkgcmV0dXJuO1xyXG5cclxuXHRcdHRyeSB7XHJcblx0XHRcdGlmICggdy5qUXVlcnkgJiYgdy5qUXVlcnkuZm4gJiYgdy5qUXVlcnkuZm4ud3BiY19teV9tb2RhbCApIHtcclxuXHJcblx0XHRcdFx0Y29uc3QgJG0gPSBtb2RhbF9pZFxyXG5cdFx0XHRcdFx0PyB3LmpRdWVyeSggJyMnICsgTW9kYWxzLmNzc19lc2NhcGUoIG1vZGFsX2lkICkgKVxyXG5cdFx0XHRcdFx0OiB3LmpRdWVyeSggbW9kYWxfZWwgKTtcclxuXHJcblx0XHRcdFx0aWYgKCAkbSAmJiAkbS53cGJjX215X21vZGFsICkge1xyXG5cdFx0XHRcdFx0JG0ud3BiY19teV9tb2RhbCggJ2hpZGUnICk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9IGNhdGNoICggX2UgKSB7XHJcblx0XHR9XHJcblxyXG5cdFx0bW9kYWxfZWwuc3R5bGUuZGlzcGxheSA9ICdub25lJztcclxuXHR9O1xyXG5cclxufSggd2luZG93LCBkb2N1bWVudCApKTtcclxuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNDLFdBQVVBLENBQUMsRUFBRUMsQ0FBQyxFQUFFO0VBQ2hCLFlBQVk7O0VBRVosTUFBTUMsSUFBSSxHQUFJRixDQUFDLENBQUNHLGFBQWEsR0FBR0gsQ0FBQyxDQUFDRyxhQUFhLElBQUksQ0FBQyxDQUFFO0VBQ3RELE1BQU1DLEVBQUUsR0FBTUYsSUFBSSxDQUFDRSxFQUFFLEdBQUdGLElBQUksQ0FBQ0UsRUFBRSxJQUFJLENBQUMsQ0FBRTs7RUFFdEM7QUFDRDtBQUNBO0VBQ0MsTUFBTUMsU0FBUyxHQUFJRCxFQUFFLENBQUNDLFNBQVMsR0FBR0QsRUFBRSxDQUFDQyxTQUFT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
