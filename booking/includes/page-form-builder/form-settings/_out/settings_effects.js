"use strict";

/**
 * Applies effects in Canvas, after changing some settings in the right sidebar in BFB.
 *
 * @file ../includes/page-form-builder/form-settings/_src/settings_effects.js
 */
(function (w, d) {
  'use strict';

  const Effects = w.WPBC_BFB_Settings_Effects = w.WPBC_BFB_Settings_Effects || {};
  const map = Effects.map = Effects.map || Object.create(null);
  Effects.register = function (key, fn) {
    if (key && typeof fn === 'function') {
      map[String(key)] = fn;
    }
  };
  function get_canvas_root() {
    return d.querySelector('#wpbc_bfb__pages_container') || d.querySelector('.wpbc_bfb__panel--preview') || d.getElementById('wpbc_bfb__preview') || d.body || d.documentElement;
  }
  Effects.apply_one = function (key, value, ctx) {
    const fn = map[String(key)];
    if (!fn) {
      return;
    }
    try {
      fn(value, Object.assign({
        key,
        value,
        canvas: get_canvas_root()
      }, ctx || {}));
    } catch (e) {
      // keep silent in production if you prefer
      console.error('WPBC Effects error:', key, e);
    }
  };
  Effects.apply_all = function (options, ctx) {
    if (!options || typeof options !== 'object') {
      return;
    }
    Object.keys(options).forEach(function (k) {
      Effects.apply_one(k, options[k], ctx);
    });
  };

  /**
   * Normalize settings pack to the minimum required shape:
   * { options: {}, css_vars: {} }
   *
   * @param {*} pack
   * @return {{options:Object, css_vars:Object, bfb_options?:Object}|null}
   */
  Effects.normalize_pack = function (pack) {
    if (pack === null || typeof pack === 'undefined' || pack === '') {
      return null;
    }

    // Parse JSON string if needed.
    if (typeof pack === 'string') {
      try {
        pack = JSON.parse(pack);
      } catch (_e) {
        return null;
      }
    }
    if (!pack || typeof pack !== 'object') {
      return null;
    }

    // If user passed just {key:value} options map, wrap it.
    const has_shape = Object.prototype.hasOwnProperty.call(pack, 'options') || Object.prototype.hasOwnProperty.call(pack, 'css_vars') || Object.prototype.hasOwnProperty.call(pack, 'bfb_options');
    if (!has_shape) {
      pack = {
        options: pack,
        css_vars: {}
      };
    }
    if (!pack.options || typeof pack.options !== 'object') {
      pack.options = {};
    }
    if (!pack.css_vars || typeof pack.css_vars !== 'object') {
      pack.css_vars = {};
    }

    // bfb_options is optional; keep if valid.
    if (pack.bfb_options && typeof pack.bfb_options !== 'object') {
      delete pack.bfb_options;
    }
    return pack;
  };

  /**
   * Re-apply settings effects after a canvas rebuild / structure load.
   *
   * This is needed because structure loading can replace DOM nodes that effects target.
   *
   * @param {*} settings_pack  string|object settings_json pack (or plain options map)
   * @param {Object} [ctx]
   */
  Effects.reapply_after_canvas = function (settings_pack, ctx) {
    const pack = Effects.normalize_pack(settings_pack);
    if (!pack) {
      return;
    }

    // Apply immediately (best effort).
    Effects.apply_all(pack.options, Object.assign({
      source: 'reapply_after_canvas'
    }, ctx || {}));

    // Some modules/hydration may run shortly after; do one more pass.
    setTimeout(function () {
      Effects.apply_all(pack.options, Object.assign({
        source: 'reapply_after_canvas_delayed'
      }, ctx || {}));
    }, 60);
  };

  // 1) Apply from AJAX load.
  d.addEventListener('wpbc:bfb:form_settings:apply', function (e) {
    const pack = e && e.detail ? e.detail.settings : null;
    if (pack && pack.options) {
      Effects.apply_all(pack.options, {
        source: 'apply'
      });
    }
  });

  // 2) Apply live from UI change (delegated).
  function css_escape(value) {
    const v = String(value == null ? '' : value);
    if (w.CSS && typeof w.CSS.escape === 'function') {
      return w.CSS.escape(v);
    }
    return v.replace(/[^a-zA-Z0-9_\-]/g, '\\$&');
  }
  function find_fs_root(el) {
    if (!el || !el.closest) {
      return null;
    }

    // 1) Direct: element or ancestor carries FS key (input/select/textarea writer, radio wrapper, etc.)
    const direct = el.closest('[data-wpbc-bfb-fs-key]');
    if (direct) {
      return direct;
    }

    // 2) Length: event came from number/unit/range inside .wpbc_slider_len_group
    const len_group = el.closest('.wpbc_slider_len_group');
    if (len_group) {
      return len_group.querySelector('input[data-wpbc_slider_len_writer][data-wpbc-bfb-fs-key]') || len_group.querySelector('input[data-wpbc-bfb-fs-type="length"][data-wpbc-bfb-fs-key]') || null;
    }

    // 3) Range: event came from range input inside .wpbc_slider_range_group
    const range_group = el.closest('.wpbc_slider_range_group');
    if (range_group) {
      return range_group.querySelector('input[data-wpbc_slider_range_writer][data-wpbc-bfb-fs-key]') || range_group.querySelector('input[data-wpbc_slider_range_writer]') || null;
    }
    return null;
  }
  function read_value_from_fs_root(fs_root, original_target) {
    if (!fs_root) {
      return '';
    }
    const fs_type = String(fs_root.getAttribute('data-wpbc-bfb-fs-type') || '');

    // RADIO: read checked within wrapper.
    if (fs_type === 'radio') {
      const control_id = fs_root.getAttribute('data-wpbc-bfb-fs-controlid') || '';
      const selector = control_id ? 'input[type="radio"][name="' + css_escape(control_id) + '"]:checked' : 'input[type="radio"]:checked';
      const checked = fs_root.querySelector(selector);
      return checked ? String(checked.value || '') : '';
    }

    // CHECKBOX / TOGGLE
    if (original_target && original_target.type === 'checkbox' || fs_root.type === 'checkbox') {
      const cb = original_target && original_target.type === 'checkbox' ? original_target : fs_root;
      return cb.checked ? 'On' : 'Off';
    }

    // DEFAULT: writer/input/textarea/select
    if (fs_root.value != null) {
      return String(fs_root.value);
    }
    if (original_target && original_target.value != null) {
      return String(original_target.value);
    }
    return '';
  }
  function on_change(ev) {
    // Ignore events dispatched by code (apply/reapply, slider sync, etc.). Effects should react only to real user input + explicit wpbc:bfb:form_settings:apply.
    if (ev && ev.isTrusted === false) {
      return;
    }
    const target = ev && ev.target;
    if (!target) {
      return;
    }
    const fs_root = find_fs_root(target);
    if (!fs_root) {
      return;
    }

    // Normalize events so each control produces exactly one effect call.
    // - toggle/select/radio/checkbox => "change" only.
    // - everything else              => "input" only.
    const fs_type = String(fs_root.getAttribute('data-wpbc-bfb-fs-type') || '');
    const tag = String(target.tagName || '').toLowerCase();
    const type = String(target.type || '').toLowerCase();
    const use_change = fs_type === 'toggle' || fs_type === 'select' || fs_type === 'radio' || type === 'checkbox' || type === 'radio' || tag === 'select';
    if (use_change && ev.type !== 'change') {
      return;
    }
    if (!use_change && ev.type !== 'input') {
      return;
    }
    // -------------------------------------------------------------------------------------------

    const key = fs_root.getAttribute('data-wpbc-bfb-fs-key');
    if (!key) {
      return;
    }
    const scope = fs_root.getAttribute('data-wpbc-bfb-fs-scope') || '';
    const value = read_value_from_fs_root(fs_root, target);
    Effects.apply_one(key, value, {
      source: 'ui',
      scope: scope,
      control: target,
      fs_root: fs_root
    });
  }
  d.addEventListener('input', on_change, false);
  d.addEventListener('change', on_change, false);
})(window, document);

// BOOKING_FORM_THEME.
WPBC_BFB_Settings_Effects.register('booking_form_theme', function (value, ctx) {
  // const root = ctx.canvas;
  const root = document.getElementById('wpbc_bfb__theme_scope');
  if (!root || !root.querySelectorAll) {
    return;
  }

  // const wraps = root.querySelectorAll( '.wpbc_container.wpbc_form' );
  const wraps = root.querySelectorAll('.wpbc_bfb__pages_panel');
  if (!wraps.length) {
    return;
  }
  wraps.forEach(function (wrap) {
    // remove any previous theme classes (simple + future-proof).
    Array.from(wrap.classList).forEach(function (cls) {
      if (/^wpbc_theme_/.test(cls)) {
        wrap.classList.remove(cls);
      }
    });
    if (value) {
      wrap.classList.add(String(value));
    }
  });
});

// BOOKING_FORM_LAYOUT_WIDTH — Form width: applies combined "100%" / "600px" / "40rem" to the booking form containers.
WPBC_BFB_Settings_Effects.register('booking_form_layout_width', function (value, ctx) {
  const root = ctx && ctx.canvas;
  if (!root || !root.querySelectorAll) {
    return;
  }
  const wraps = root.querySelectorAll('.wpbc_bfb__form_preview_section_container');
  if (!wraps.length) {
    return;
  }
  const v = String(value == null ? '' : value).trim();

  // allow only "number + unit".
  if (v && !/^-?\d+(?:\.\d+)?(?:%|px|rem|em|vw|vh)$/.test(v)) {
    return;
  }
  wraps.forEach(function (wrap) {
    if (!wrap || !wrap.style) {
      return;
    }
    if (!v) {
      wrap.style.removeProperty('--wpbc-bfb-booking_form_layout_width');
    } else {
      wrap.style.setProperty('--wpbc-bfb-booking_form_layout_width', v);
    }
  });
});

// Debug Preview Mode.
WPBC_BFB_Settings_Effects.register('booking_bfb_preview_mode', function (value, ctx) {
  const root = ctx.canvas;
  if (!root || !root.querySelectorAll) {
    return;
  }
  const wraps = root.querySelectorAll('.wpbc_container.wpbc_form');
  if (!wraps.length) {
    return;
  }

  // Get builder async.
  wpbc_bfb_api.with_builder(function (Builder) {
    /**
     * Capture active right sidebar tab and return restore handle.
     *
     * @return {{restore:function():void}|null}
     */
    function capture_right_sidebar_active_tab_restore_handle() {
      var tablist_el = document.querySelector('.wpbc_bfb__rightbar_tabs[role="tablist"]');
      if (!tablist_el) {
        return null;
      }
      var active_tab_el = tablist_el.querySelector('[role="tab"][aria-selected="true"]');
      if (!active_tab_el) {
        active_tab_el = tablist_el.querySelector('[role="tab"][aria-controls="wpbc_bfb__palette_add_new"]');
      }
      if (!active_tab_el || typeof active_tab_el.click !== 'function') {
        return null;
      }
      return {
        restore: function () {
          try {
            active_tab_el.click();
          } catch (_e) {}
        }
      };
    }
    var tab_restore_handle = capture_right_sidebar_active_tab_restore_handle();
    let restored = false;
    var EVS = window.WPBC_BFB_Core && window.WPBC_BFB_Core.WPBC_BFB_Events ? window.WPBC_BFB_Core.WPBC_BFB_Events : {};
    var EV_DONE = EVS.STRUCTURE_LOADED || EVS.CANVAS_REFRESHED || 'wpbc:bfb:structure-loaded';
    function do_restore() {
      if (restored) {
        return;
      }
      restored = true;
      try {
        Builder?.bus?.off?.(EV_DONE, do_restore);
      } catch (_) {}
      requestAnimationFrame(function () {
        if (!tab_restore_handle) {
          return;
        }
        tab_restore_handle.restore();
      });
    }

    // Listen once (best), plus a fallback in case event isn't fired.
    try {
      Builder?.bus?.on?.(EV_DONE, do_restore);
    } catch (_) {}
    var enabled = 'On' === value;
    Builder.set_preview_mode(enabled, {
      rebuild: true,
      reinit: true,
      source: 'settings-effects'
    });
  });
});
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZm9ybS1zZXR0aW5ncy9fb3V0L3NldHRpbmdzX2VmZmVjdHMuanMiLCJuYW1lcyI6WyJ3IiwiZCIsIkVmZmVjdHMiLCJXUEJDX0JGQl9TZXR0aW5nc19FZmZlY3RzIiwibWFwIiwiT2JqZWN0IiwiY3JlYXRlIiwicmVnaXN0ZXIiLCJrZXkiLCJmbiIsIlN0cmluZyIsImdldF9jYW52YXNfcm9vdCIsInF1ZXJ5U2VsZWN0b3IiLCJnZXRFbGVtZW50QnlJZCIsImJvZHkiLCJkb2N1bWVudEVsZW1lbnQiLCJhcHBseV9vbmUiLCJ2YWx1ZSIsImN0eCIsImFzc2lnbiIsImNhbnZhcyIsImUiLCJjb25zb2xlIiwiZXJyb3IiLCJhcHBseV9hbGwiLCJvcHRpb25zIiwia2V5cyIsImZvckVhY2giLCJrIiwibm9ybWFsaXplX3BhY2siLCJwYWNrIiwiSlNPTiIsInBhcnNlIiwiX2UiLCJoYXNfc2hhcGUiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJjc3NfdmFycyIsImJmYl9vcHRpb25zIiwicmVhcHBseV9hZnRlcl9jYW52YXMiLCJzZXR0aW5nc19wYWNrIiwic291cmNlIiwic2V0VGltZW91dCIsImFkZEV2ZW50TGlzdGVuZXIiLCJkZXRhaWwiLCJzZXR0aW5ncyIsImNzc19lc2NhcGUiLCJ2IiwiQ1NTIiwiZXNjYXBlIiwicmVwbGFjZSIsImZpbmRfZnNfcm9vdCIsImVsIiwiY2xvc2VzdCIsImRpcmVjdCIsImxlbl9ncm91cCIsInJhbmdlX2dyb3VwIiwicmVhZF92YWx1ZV9mcm9tX2ZzX3Jvb3QiLCJmc19yb290Iiwib3JpZ2luYWxfdGFyZ2V0IiwiZnNfdHlwZSIsImdldEF0dHJpYnV0ZSIsImNvbnRyb2xfaWQiLCJzZWxlY3RvciIsImNoZWNrZWQiLCJ0eXBlIiwiY2IiLCJvbl9jaGFuZ2UiLCJldiIsImlzVHJ1c3RlZCIsInRhcmdldCIsInRhZyIsInRhZ05hbWUiLCJ0b0xvd2VyQ2FzZSIsInVzZV9jaGFuZ2UiLCJzY29wZSIsImNvbnRyb2wiLCJ3aW5kb3ciLCJkb2N1bWVudCIsInJvb3QiLCJxdWVyeVNlbGVjdG9yQWxsIiwid3JhcHMiLCJsZW5ndGgiLCJ3cmFwIiwiQXJyYXkiLCJmcm9tIiwiY2xhc3NMaXN0IiwiY2xzIiwidGVzdCIsInJlbW92ZSIsImFkZCIsInRyaW0iLCJzdHlsZSIsInJlbW92ZVByb3BlcnR5Iiwic2V0UHJvcGVydHkiLCJ3cGJjX2JmYl9hcGkiLCJ3aXRoX2J1aWxkZXIiLCJCdWlsZGVyIiwiY2FwdHVyZV9yaWdodF9zaWRlYmFyX2FjdGl2ZV90YWJfcmVzdG9yZV9oYW5kbGUiLCJ0YWJsaXN0X2VsIiwiYWN0aXZlX3RhYl9lbCIsImNsaWNrIiwicmVzdG9yZSIsInRhYl9yZXN0b3JlX2hhbmRsZSIsInJlc3RvcmVkIiwiRVZTIiwiV1BCQ19CRkJfQ29yZSIsIldQQkNfQkZCX0V2ZW50cyIsIkVWX0RPTkUiLCJTVFJVQ1RVUkVfTE9BREVEIiwiQ0FOVkFTX1JFRlJFU0hFRCIsImRvX3Jlc3RvcmUiLCJidXMiLCJvZmYiLCJfIiwicmVxdWVzdEFuaW1hdGlvbkZyYW1lIiwib24iLCJlbmFibGVkIiwic2V0X3ByZXZpZXdfbW9kZSIsInJlYnVpbGQiLCJyZWluaXQiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9mb3JtLXNldHRpbmdzL19zcmMvc2V0dGluZ3NfZWZmZWN0cy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogQXBwbGllcyBlZmZlY3RzIGluIENhbnZhcywgYWZ0ZXIgY2hhbmdpbmcgc29tZSBzZXR0aW5ncyBpbiB0aGUgcmlnaHQgc2lkZWJhciBpbiBCRkIuXHJcbiAqXHJcbiAqIEBmaWxlIC4uL2luY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2Zvcm0tc2V0dGluZ3MvX3NyYy9zZXR0aW5nc19lZmZlY3RzLmpzXHJcbiAqL1xyXG4oZnVuY3Rpb24gKHcsIGQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdGNvbnN0IEVmZmVjdHMgPSAody5XUEJDX0JGQl9TZXR0aW5nc19FZmZlY3RzID0gdy5XUEJDX0JGQl9TZXR0aW5nc19FZmZlY3RzIHx8IHt9KTtcclxuXHRjb25zdCBtYXAgICAgID0gKEVmZmVjdHMubWFwID0gRWZmZWN0cy5tYXAgfHwgT2JqZWN0LmNyZWF0ZSggbnVsbCApKTtcclxuXHJcblx0RWZmZWN0cy5yZWdpc3RlciA9IGZ1bmN0aW9uIChrZXksIGZuKSB7XHJcblx0XHRpZiAoIGtleSAmJiB0eXBlb2YgZm4gPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdG1hcFtTdHJpbmcoIGtleSApXSA9IGZuO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9jYW52YXNfcm9vdCgpIHtcclxuXHRcdHJldHVybiAoXHJcblx0XHRcdGQucXVlcnlTZWxlY3RvciggJyN3cGJjX2JmYl9fcGFnZXNfY29udGFpbmVyJyApIHx8XHJcblx0XHRcdGQucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXcnICkgfHxcclxuXHRcdFx0ZC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19wcmV2aWV3JyApIHx8XHJcblx0XHRcdGQuYm9keSB8fCBkLmRvY3VtZW50RWxlbWVudFxyXG5cdFx0KTtcclxuXHR9XHJcblxyXG5cdEVmZmVjdHMuYXBwbHlfb25lID0gZnVuY3Rpb24gKGtleSwgdmFsdWUsIGN0eCkge1xyXG5cdFx0Y29uc3QgZm4gPSBtYXBbU3RyaW5nKCBrZXkgKV07XHJcblx0XHRpZiAoICEgZm4gKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdHRyeSB7XHJcblx0XHRcdGZuKCB2YWx1ZSwgT2JqZWN0LmFzc2lnbiggeyBrZXksIHZhbHVlLCBjYW52YXM6IGdldF9jYW52YXNfcm9vdCgpIH0sIGN0eCB8fCB7fSApICk7XHJcblx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0Ly8ga2VlcCBzaWxlbnQgaW4gcHJvZHVjdGlvbiBpZiB5b3UgcHJlZmVyXHJcblx0XHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDIEVmZmVjdHMgZXJyb3I6Jywga2V5LCBlICk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0RWZmZWN0cy5hcHBseV9hbGwgPSBmdW5jdGlvbiAob3B0aW9ucywgY3R4KSB7XHJcblx0XHRpZiAoICEgb3B0aW9ucyB8fCB0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdE9iamVjdC5rZXlzKCBvcHRpb25zICkuZm9yRWFjaCggZnVuY3Rpb24gKGspIHtcclxuXHRcdFx0RWZmZWN0cy5hcHBseV9vbmUoIGssIG9wdGlvbnNba10sIGN0eCApO1xyXG5cdFx0fSApO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIE5vcm1hbGl6ZSBzZXR0aW5ncyBwYWNrIHRvIHRoZSBtaW5pbXVtIHJlcXVpcmVkIHNoYXBlOlxyXG5cdCAqIHsgb3B0aW9uczoge30sIGNzc192YXJzOiB7fSB9XHJcblx0ICpcclxuXHQgKiBAcGFyYW0geyp9IHBhY2tcclxuXHQgKiBAcmV0dXJuIHt7b3B0aW9uczpPYmplY3QsIGNzc192YXJzOk9iamVjdCwgYmZiX29wdGlvbnM/Ok9iamVjdH18bnVsbH1cclxuXHQgKi9cclxuXHRFZmZlY3RzLm5vcm1hbGl6ZV9wYWNrID0gZnVuY3Rpb24gKHBhY2spIHtcclxuXHJcblx0XHRpZiAoIHBhY2sgPT09IG51bGwgfHwgdHlwZW9mIHBhY2sgPT09ICd1bmRlZmluZWQnIHx8IHBhY2sgPT09ICcnICkge1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBQYXJzZSBKU09OIHN0cmluZyBpZiBuZWVkZWQuXHJcblx0XHRpZiAoIHR5cGVvZiBwYWNrID09PSAnc3RyaW5nJyApIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRwYWNrID0gSlNPTi5wYXJzZSggcGFjayApO1xyXG5cdFx0XHR9IGNhdGNoICggX2UgKSB7XHJcblx0XHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICEgcGFjayB8fCB0eXBlb2YgcGFjayAhPT0gJ29iamVjdCcgKSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIElmIHVzZXIgcGFzc2VkIGp1c3Qge2tleTp2YWx1ZX0gb3B0aW9ucyBtYXAsIHdyYXAgaXQuXHJcblx0XHRjb25zdCBoYXNfc2hhcGUgPVxyXG5cdFx0XHRcdCAgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBwYWNrLCAnb3B0aW9ucycgKSB8fFxyXG5cdFx0XHRcdCAgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBwYWNrLCAnY3NzX3ZhcnMnICkgfHxcclxuXHRcdFx0XHQgIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggcGFjaywgJ2JmYl9vcHRpb25zJyApO1xyXG5cclxuXHRcdGlmICggISBoYXNfc2hhcGUgKSB7XHJcblx0XHRcdHBhY2sgPSB7IG9wdGlvbnM6IHBhY2ssIGNzc192YXJzOiB7fSB9O1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISBwYWNrLm9wdGlvbnMgfHwgdHlwZW9mIHBhY2sub3B0aW9ucyAhPT0gJ29iamVjdCcgKSB7XHJcblx0XHRcdHBhY2sub3B0aW9ucyA9IHt9O1xyXG5cdFx0fVxyXG5cdFx0aWYgKCAhIHBhY2suY3NzX3ZhcnMgfHwgdHlwZW9mIHBhY2suY3NzX3ZhcnMgIT09ICdvYmplY3QnICkge1xyXG5cdFx0XHRwYWNrLmNzc192YXJzID0ge307XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gYmZiX29wdGlvbnMgaXMgb3B0aW9uYWw7IGtlZXAgaWYgdmFsaWQuXHJcblx0XHRpZiAoIHBhY2suYmZiX29wdGlvbnMgJiYgdHlwZW9mIHBhY2suYmZiX29wdGlvbnMgIT09ICdvYmplY3QnICkge1xyXG5cdFx0XHRkZWxldGUgcGFjay5iZmJfb3B0aW9ucztcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcGFjaztcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBSZS1hcHBseSBzZXR0aW5ncyBlZmZlY3RzIGFmdGVyIGEgY2FudmFzIHJlYnVpbGQgLyBzdHJ1Y3R1cmUgbG9hZC5cclxuXHQgKlxyXG5cdCAqIFRoaXMgaXMgbmVlZGVkIGJlY2F1c2Ugc3RydWN0dXJlIGxvYWRpbmcgY2FuIHJlcGxhY2UgRE9NIG5vZGVzIHRoYXQgZWZmZWN0cyB0YXJnZXQuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0geyp9IHNldHRpbmdzX3BhY2sgIHN0cmluZ3xvYmplY3Qgc2V0dGluZ3NfanNvbiBwYWNrIChvciBwbGFpbiBvcHRpb25zIG1hcClcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gW2N0eF1cclxuXHQgKi9cclxuXHRFZmZlY3RzLnJlYXBwbHlfYWZ0ZXJfY2FudmFzID0gZnVuY3Rpb24gKHNldHRpbmdzX3BhY2ssIGN0eCkge1xyXG5cclxuXHRcdGNvbnN0IHBhY2sgPSBFZmZlY3RzLm5vcm1hbGl6ZV9wYWNrKCBzZXR0aW5nc19wYWNrICk7XHJcblx0XHRpZiAoICEgcGFjayApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIEFwcGx5IGltbWVkaWF0ZWx5IChiZXN0IGVmZm9ydCkuXHJcblx0XHRFZmZlY3RzLmFwcGx5X2FsbCggcGFjay5vcHRpb25zLCBPYmplY3QuYXNzaWduKCB7IHNvdXJjZTogJ3JlYXBwbHlfYWZ0ZXJfY2FudmFzJyB9LCBjdHggfHwge30gKSApO1xyXG5cclxuXHRcdC8vIFNvbWUgbW9kdWxlcy9oeWRyYXRpb24gbWF5IHJ1biBzaG9ydGx5IGFmdGVyOyBkbyBvbmUgbW9yZSBwYXNzLlxyXG5cdFx0c2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRFZmZlY3RzLmFwcGx5X2FsbCggcGFjay5vcHRpb25zLCBPYmplY3QuYXNzaWduKCB7IHNvdXJjZTogJ3JlYXBwbHlfYWZ0ZXJfY2FudmFzX2RlbGF5ZWQnIH0sIGN0eCB8fCB7fSApICk7XHJcblx0XHR9LCA2MCApO1xyXG5cdH07XHJcblxyXG5cdC8vIDEpIEFwcGx5IGZyb20gQUpBWCBsb2FkLlxyXG5cdGQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6YmZiOmZvcm1fc2V0dGluZ3M6YXBwbHknLCBmdW5jdGlvbiAoZSkge1xyXG5cdFx0Y29uc3QgcGFjayA9IGUgJiYgZS5kZXRhaWwgPyBlLmRldGFpbC5zZXR0aW5ncyA6IG51bGw7XHJcblx0XHRpZiAoIHBhY2sgJiYgcGFjay5vcHRpb25zICkge1xyXG5cdFx0XHRFZmZlY3RzLmFwcGx5X2FsbCggcGFjay5vcHRpb25zLCB7IHNvdXJjZTogJ2FwcGx5JyB9ICk7XHJcblx0XHR9XHJcblx0fSApO1xyXG5cclxuXHQvLyAyKSBBcHBseSBsaXZlIGZyb20gVUkgY2hhbmdlIChkZWxlZ2F0ZWQpLlxyXG5cdGZ1bmN0aW9uIGNzc19lc2NhcGUodmFsdWUpIHtcclxuXHRcdGNvbnN0IHYgPSBTdHJpbmcoIHZhbHVlID09IG51bGwgPyAnJyA6IHZhbHVlICk7XHJcblx0XHRpZiAoIHcuQ1NTICYmIHR5cGVvZiB3LkNTUy5lc2NhcGUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdHJldHVybiB3LkNTUy5lc2NhcGUoIHYgKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiB2LnJlcGxhY2UoIC9bXmEtekEtWjAtOV9cXC1dL2csICdcXFxcJCYnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBmaW5kX2ZzX3Jvb3QoZWwpIHtcclxuXHRcdGlmICggISBlbCB8fCAhIGVsLmNsb3Nlc3QgKSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIDEpIERpcmVjdDogZWxlbWVudCBvciBhbmNlc3RvciBjYXJyaWVzIEZTIGtleSAoaW5wdXQvc2VsZWN0L3RleHRhcmVhIHdyaXRlciwgcmFkaW8gd3JhcHBlciwgZXRjLilcclxuXHRcdGNvbnN0IGRpcmVjdCA9IGVsLmNsb3Nlc3QoICdbZGF0YS13cGJjLWJmYi1mcy1rZXldJyApO1xyXG5cdFx0aWYgKCBkaXJlY3QgKSB7XHJcblx0XHRcdHJldHVybiBkaXJlY3Q7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gMikgTGVuZ3RoOiBldmVudCBjYW1lIGZyb20gbnVtYmVyL3VuaXQvcmFuZ2UgaW5zaWRlIC53cGJjX3NsaWRlcl9sZW5fZ3JvdXBcclxuXHRcdGNvbnN0IGxlbl9ncm91cCA9IGVsLmNsb3Nlc3QoICcud3BiY19zbGlkZXJfbGVuX2dyb3VwJyApO1xyXG5cdFx0aWYgKCBsZW5fZ3JvdXAgKSB7XHJcblx0XHRcdHJldHVybiAoXHJcblx0XHRcdFx0bGVuX2dyb3VwLnF1ZXJ5U2VsZWN0b3IoICdpbnB1dFtkYXRhLXdwYmNfc2xpZGVyX2xlbl93cml0ZXJdW2RhdGEtd3BiYy1iZmItZnMta2V5XScgKSB8fFxyXG5cdFx0XHRcdGxlbl9ncm91cC5xdWVyeVNlbGVjdG9yKCAnaW5wdXRbZGF0YS13cGJjLWJmYi1mcy10eXBlPVwibGVuZ3RoXCJdW2RhdGEtd3BiYy1iZmItZnMta2V5XScgKSB8fFxyXG5cdFx0XHRcdG51bGxcclxuXHRcdFx0KTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyAzKSBSYW5nZTogZXZlbnQgY2FtZSBmcm9tIHJhbmdlIGlucHV0IGluc2lkZSAud3BiY19zbGlkZXJfcmFuZ2VfZ3JvdXBcclxuXHRcdGNvbnN0IHJhbmdlX2dyb3VwID0gZWwuY2xvc2VzdCggJy53cGJjX3NsaWRlcl9yYW5nZV9ncm91cCcgKTtcclxuXHRcdGlmICggcmFuZ2VfZ3JvdXAgKSB7XHJcblx0XHRcdHJldHVybiAoXHJcblx0XHRcdFx0cmFuZ2VfZ3JvdXAucXVlcnlTZWxlY3RvciggJ2lucHV0W2RhdGEtd3BiY19zbGlkZXJfcmFuZ2Vfd3JpdGVyXVtkYXRhLXdwYmMtYmZiLWZzLWtleV0nICkgfHxcclxuXHRcdFx0XHRyYW5nZV9ncm91cC5xdWVyeVNlbGVjdG9yKCAnaW5wdXRbZGF0YS13cGJjX3NsaWRlcl9yYW5nZV93cml0ZXJdJyApIHx8XHJcblx0XHRcdFx0bnVsbFxyXG5cdFx0XHQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBudWxsO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcmVhZF92YWx1ZV9mcm9tX2ZzX3Jvb3QoZnNfcm9vdCwgb3JpZ2luYWxfdGFyZ2V0KSB7XHJcblx0XHRpZiAoICEgZnNfcm9vdCApIHtcclxuXHRcdFx0cmV0dXJuICcnO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNvbnN0IGZzX3R5cGUgPSBTdHJpbmcoIGZzX3Jvb3QuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJmYi1mcy10eXBlJyApIHx8ICcnICk7XHJcblxyXG5cdFx0Ly8gUkFESU86IHJlYWQgY2hlY2tlZCB3aXRoaW4gd3JhcHBlci5cclxuXHRcdGlmICggZnNfdHlwZSA9PT0gJ3JhZGlvJyApIHtcclxuXHRcdFx0Y29uc3QgY29udHJvbF9pZCA9IGZzX3Jvb3QuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJmYi1mcy1jb250cm9saWQnICkgfHwgJyc7XHJcblx0XHRcdGNvbnN0IHNlbGVjdG9yICAgPSBjb250cm9sX2lkXHJcblx0XHRcdFx0PyAnaW5wdXRbdHlwZT1cInJhZGlvXCJdW25hbWU9XCInICsgY3NzX2VzY2FwZSggY29udHJvbF9pZCApICsgJ1wiXTpjaGVja2VkJ1xyXG5cdFx0XHRcdDogJ2lucHV0W3R5cGU9XCJyYWRpb1wiXTpjaGVja2VkJztcclxuXHJcblx0XHRcdGNvbnN0IGNoZWNrZWQgPSBmc19yb290LnF1ZXJ5U2VsZWN0b3IoIHNlbGVjdG9yICk7XHJcblx0XHRcdHJldHVybiBjaGVja2VkID8gU3RyaW5nKCBjaGVja2VkLnZhbHVlIHx8ICcnICkgOiAnJztcclxuXHRcdH1cclxuXHJcblx0XHQvLyBDSEVDS0JPWCAvIFRPR0dMRVxyXG5cdFx0aWYgKCAob3JpZ2luYWxfdGFyZ2V0ICYmIG9yaWdpbmFsX3RhcmdldC50eXBlID09PSAnY2hlY2tib3gnKSB8fCBmc19yb290LnR5cGUgPT09ICdjaGVja2JveCcgKSB7XHJcblx0XHRcdGNvbnN0IGNiID0gKG9yaWdpbmFsX3RhcmdldCAmJiBvcmlnaW5hbF90YXJnZXQudHlwZSA9PT0gJ2NoZWNrYm94JykgPyBvcmlnaW5hbF90YXJnZXQgOiBmc19yb290O1xyXG5cdFx0XHRyZXR1cm4gY2IuY2hlY2tlZCA/ICdPbicgOiAnT2ZmJztcclxuXHRcdH1cclxuXHJcblx0XHQvLyBERUZBVUxUOiB3cml0ZXIvaW5wdXQvdGV4dGFyZWEvc2VsZWN0XHJcblx0XHRpZiAoIGZzX3Jvb3QudmFsdWUgIT0gbnVsbCApIHtcclxuXHRcdFx0cmV0dXJuIFN0cmluZyggZnNfcm9vdC52YWx1ZSApO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBvcmlnaW5hbF90YXJnZXQgJiYgb3JpZ2luYWxfdGFyZ2V0LnZhbHVlICE9IG51bGwgKSB7XHJcblx0XHRcdHJldHVybiBTdHJpbmcoIG9yaWdpbmFsX3RhcmdldC52YWx1ZSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiAnJztcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIG9uX2NoYW5nZShldikge1xyXG5cdFx0Ly8gSWdub3JlIGV2ZW50cyBkaXNwYXRjaGVkIGJ5IGNvZGUgKGFwcGx5L3JlYXBwbHksIHNsaWRlciBzeW5jLCBldGMuKS4gRWZmZWN0cyBzaG91bGQgcmVhY3Qgb25seSB0byByZWFsIHVzZXIgaW5wdXQgKyBleHBsaWNpdCB3cGJjOmJmYjpmb3JtX3NldHRpbmdzOmFwcGx5LlxyXG5cdFx0aWYgKCBldiAmJiBldi5pc1RydXN0ZWQgPT09IGZhbHNlICkgeyByZXR1cm47IH1cclxuXHRcdGNvbnN0IHRhcmdldCA9IGV2ICYmIGV2LnRhcmdldDtcclxuXHRcdGlmICggISB0YXJnZXQgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdGNvbnN0IGZzX3Jvb3QgPSBmaW5kX2ZzX3Jvb3QoIHRhcmdldCApO1xyXG5cdFx0aWYgKCAhIGZzX3Jvb3QgKSB7IHJldHVybjsgfVxyXG5cclxuXHJcblx0XHQvLyBOb3JtYWxpemUgZXZlbnRzIHNvIGVhY2ggY29udHJvbCBwcm9kdWNlcyBleGFjdGx5IG9uZSBlZmZlY3QgY2FsbC5cclxuXHRcdC8vIC0gdG9nZ2xlL3NlbGVjdC9yYWRpby9jaGVja2JveCA9PiBcImNoYW5nZVwiIG9ubHkuXHJcblx0XHQvLyAtIGV2ZXJ5dGhpbmcgZWxzZSAgICAgICAgICAgICAgPT4gXCJpbnB1dFwiIG9ubHkuXHJcblx0XHRjb25zdCBmc190eXBlID0gU3RyaW5nKCBmc19yb290LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1iZmItZnMtdHlwZScgKSB8fCAnJyApO1xyXG5cdFx0Y29uc3QgdGFnICAgICA9IFN0cmluZyggdGFyZ2V0LnRhZ05hbWUgfHwgJycgKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0Y29uc3QgdHlwZSAgICA9IFN0cmluZyggdGFyZ2V0LnR5cGUgfHwgJycgKS50b0xvd2VyQ2FzZSgpO1xyXG5cclxuXHRcdGNvbnN0IHVzZV9jaGFuZ2UgPSAoZnNfdHlwZSA9PT0gJ3RvZ2dsZScpIHx8IChmc190eXBlID09PSAnc2VsZWN0JykgfHwgKGZzX3R5cGUgPT09ICdyYWRpbycpIHx8ICh0eXBlID09PSAnY2hlY2tib3gnKSB8fCAodHlwZSA9PT0gJ3JhZGlvJykgfHwgKHRhZyA9PT0gJ3NlbGVjdCcpO1xyXG5cclxuXHRcdGlmICggdXNlX2NoYW5nZSAmJiBldi50eXBlICE9PSAnY2hhbmdlJyApIHsgcmV0dXJuOyB9XHJcblx0XHRpZiAoICEgdXNlX2NoYW5nZSAmJiBldi50eXBlICE9PSAnaW5wdXQnICkgeyByZXR1cm47IH1cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0XHRjb25zdCBrZXkgPSBmc19yb290LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1iZmItZnMta2V5JyApO1xyXG5cdFx0aWYgKCAhIGtleSApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0Y29uc3Qgc2NvcGUgPSBmc19yb290LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1iZmItZnMtc2NvcGUnICkgfHwgJyc7XHJcblx0XHRjb25zdCB2YWx1ZSA9IHJlYWRfdmFsdWVfZnJvbV9mc19yb290KCBmc19yb290LCB0YXJnZXQgKTtcclxuXHJcblx0XHRFZmZlY3RzLmFwcGx5X29uZSgga2V5LCB2YWx1ZSwgeyBzb3VyY2U6ICd1aScsIHNjb3BlOiBzY29wZSwgY29udHJvbDogdGFyZ2V0LCBmc19yb290OiBmc19yb290IH0gKTtcclxuXHR9XHJcblxyXG5cdGQuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0Jywgb25fY2hhbmdlLCBmYWxzZSApO1xyXG5cdGQuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIG9uX2NoYW5nZSwgZmFsc2UgKTtcclxuXHJcbn0pKCB3aW5kb3csIGRvY3VtZW50ICk7XHJcblxyXG5cclxuLy8gQk9PS0lOR19GT1JNX1RIRU1FLlxyXG5XUEJDX0JGQl9TZXR0aW5nc19FZmZlY3RzLnJlZ2lzdGVyKCAnYm9va2luZ19mb3JtX3RoZW1lJywgZnVuY3Rpb24gKHZhbHVlLCBjdHgpIHtcclxuXHQvLyBjb25zdCByb290ID0gY3R4LmNhbnZhcztcclxuXHRjb25zdCByb290ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9fdGhlbWVfc2NvcGUnICk7XHJcblx0aWYgKCAhIHJvb3QgfHwgISByb290LnF1ZXJ5U2VsZWN0b3JBbGwgKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHQvLyBjb25zdCB3cmFwcyA9IHJvb3QucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2NvbnRhaW5lci53cGJjX2Zvcm0nICk7XHJcblx0Y29uc3Qgd3JhcHMgPSByb290LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX3BhZ2VzX3BhbmVsJyApO1xyXG5cdGlmICggISB3cmFwcy5sZW5ndGggKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHR3cmFwcy5mb3JFYWNoKCBmdW5jdGlvbiAod3JhcCkge1xyXG5cdFx0Ly8gcmVtb3ZlIGFueSBwcmV2aW91cyB0aGVtZSBjbGFzc2VzIChzaW1wbGUgKyBmdXR1cmUtcHJvb2YpLlxyXG5cdFx0QXJyYXkuZnJvbSggd3JhcC5jbGFzc0xpc3QgKS5mb3JFYWNoKCBmdW5jdGlvbiAoY2xzKSB7XHJcblx0XHRcdGlmICggL153cGJjX3RoZW1lXy8udGVzdCggY2xzICkgKSB7XHJcblx0XHRcdFx0d3JhcC5jbGFzc0xpc3QucmVtb3ZlKCBjbHMgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cclxuXHRcdGlmICggdmFsdWUgKSB7XHJcblx0XHRcdHdyYXAuY2xhc3NMaXN0LmFkZCggU3RyaW5nKCB2YWx1ZSApICk7XHJcblx0XHR9XHJcblx0fSApO1xyXG59ICk7XHJcblxyXG5cclxuLy8gQk9PS0lOR19GT1JNX0xBWU9VVF9XSURUSCDigJQgRm9ybSB3aWR0aDogYXBwbGllcyBjb21iaW5lZCBcIjEwMCVcIiAvIFwiNjAwcHhcIiAvIFwiNDByZW1cIiB0byB0aGUgYm9va2luZyBmb3JtIGNvbnRhaW5lcnMuXHJcbldQQkNfQkZCX1NldHRpbmdzX0VmZmVjdHMucmVnaXN0ZXIoICdib29raW5nX2Zvcm1fbGF5b3V0X3dpZHRoJywgZnVuY3Rpb24gKHZhbHVlLCBjdHgpIHtcclxuXHRjb25zdCByb290ID0gY3R4ICYmIGN0eC5jYW52YXM7XHJcblx0aWYgKCAhIHJvb3QgfHwgISByb290LnF1ZXJ5U2VsZWN0b3JBbGwgKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHRjb25zdCB3cmFwcyA9IHJvb3QucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fZm9ybV9wcmV2aWV3X3NlY3Rpb25fY29udGFpbmVyJyApO1xyXG5cdGlmICggISB3cmFwcy5sZW5ndGggKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHRjb25zdCB2ID0gU3RyaW5nKCB2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSApLnRyaW0oKTtcclxuXHJcblx0Ly8gYWxsb3cgb25seSBcIm51bWJlciArIHVuaXRcIi5cclxuXHRpZiAoIHYgJiYgISAvXi0/XFxkKyg/OlxcLlxcZCspPyg/OiV8cHh8cmVtfGVtfHZ3fHZoKSQvLnRlc3QoIHYgKSApIHtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdHdyYXBzLmZvckVhY2goXHJcblx0XHRmdW5jdGlvbiAod3JhcCkge1xyXG5cdFx0XHRpZiAoICEgd3JhcCB8fCAhIHdyYXAuc3R5bGUgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoICEgdiApIHtcclxuXHRcdFx0XHR3cmFwLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnLS13cGJjLWJmYi1ib29raW5nX2Zvcm1fbGF5b3V0X3dpZHRoJyApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHdyYXAuc3R5bGUuc2V0UHJvcGVydHkoICctLXdwYmMtYmZiLWJvb2tpbmdfZm9ybV9sYXlvdXRfd2lkdGgnLCB2ICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHQpO1xyXG59ICk7XHJcblxyXG5cclxuLy8gRGVidWcgUHJldmlldyBNb2RlLlxyXG5XUEJDX0JGQl9TZXR0aW5nc19FZmZlY3RzLnJlZ2lzdGVyKCAnYm9va2luZ19iZmJfcHJldmlld19tb2RlJywgZnVuY3Rpb24gKHZhbHVlLCBjdHgpIHtcclxuXHRjb25zdCByb290ID0gY3R4LmNhbnZhcztcclxuXHRpZiAoICEgcm9vdCB8fCAhIHJvb3QucXVlcnlTZWxlY3RvckFsbCApIHtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdGNvbnN0IHdyYXBzID0gcm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfY29udGFpbmVyLndwYmNfZm9ybScgKTtcclxuXHRpZiAoICEgd3JhcHMubGVuZ3RoICkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0Ly8gR2V0IGJ1aWxkZXIgYXN5bmMuXHJcblx0d3BiY19iZmJfYXBpLndpdGhfYnVpbGRlcihcclxuXHRcdGZ1bmN0aW9uIChCdWlsZGVyKSB7XHJcblxyXG5cdFx0XHQvKipcclxuXHRcdFx0ICogQ2FwdHVyZSBhY3RpdmUgcmlnaHQgc2lkZWJhciB0YWIgYW5kIHJldHVybiByZXN0b3JlIGhhbmRsZS5cclxuXHRcdFx0ICpcclxuXHRcdFx0ICogQHJldHVybiB7e3Jlc3RvcmU6ZnVuY3Rpb24oKTp2b2lkfXxudWxsfVxyXG5cdFx0XHQgKi9cclxuXHRcdFx0ZnVuY3Rpb24gY2FwdHVyZV9yaWdodF9zaWRlYmFyX2FjdGl2ZV90YWJfcmVzdG9yZV9oYW5kbGUoKSB7XHJcblxyXG5cdFx0XHRcdHZhciB0YWJsaXN0X2VsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fcmlnaHRiYXJfdGFic1tyb2xlPVwidGFibGlzdFwiXScgKTtcclxuXHRcdFx0XHRpZiAoICEgdGFibGlzdF9lbCApIHtcclxuXHRcdFx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dmFyIGFjdGl2ZV90YWJfZWwgPSB0YWJsaXN0X2VsLnF1ZXJ5U2VsZWN0b3IoICdbcm9sZT1cInRhYlwiXVthcmlhLXNlbGVjdGVkPVwidHJ1ZVwiXScgKTtcclxuXHJcblx0XHRcdFx0aWYgKCAhIGFjdGl2ZV90YWJfZWwgKSB7XHJcblx0XHRcdFx0XHRhY3RpdmVfdGFiX2VsID0gdGFibGlzdF9lbC5xdWVyeVNlbGVjdG9yKCAnW3JvbGU9XCJ0YWJcIl1bYXJpYS1jb250cm9scz1cIndwYmNfYmZiX19wYWxldHRlX2FkZF9uZXdcIl0nICk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoICEgYWN0aXZlX3RhYl9lbCB8fCB0eXBlb2YgYWN0aXZlX3RhYl9lbC5jbGljayAhPT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHRcdHJlc3RvcmU6IGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdFx0dHJ5IHsgYWN0aXZlX3RhYl9lbC5jbGljaygpOyB9IGNhdGNoICggX2UgKSB7fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH07XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciB0YWJfcmVzdG9yZV9oYW5kbGUgPSBjYXB0dXJlX3JpZ2h0X3NpZGViYXJfYWN0aXZlX3RhYl9yZXN0b3JlX2hhbmRsZSgpO1xyXG5cclxuXHRcdFx0bGV0IHJlc3RvcmVkICA9IGZhbHNlO1xyXG5cdFx0XHR2YXIgRVZTICAgICAgPSB3aW5kb3cuV1BCQ19CRkJfQ29yZSAmJiB3aW5kb3cuV1BCQ19CRkJfQ29yZS5XUEJDX0JGQl9FdmVudHMgPyB3aW5kb3cuV1BCQ19CRkJfQ29yZS5XUEJDX0JGQl9FdmVudHMgOiB7fTtcclxuXHRcdFx0dmFyIEVWX0RPTkUgID0gRVZTLlNUUlVDVFVSRV9MT0FERUQgfHwgRVZTLkNBTlZBU19SRUZSRVNIRUQgfHwgJ3dwYmM6YmZiOnN0cnVjdHVyZS1sb2FkZWQnO1xyXG5cclxuXHJcblx0XHRcdGZ1bmN0aW9uIGRvX3Jlc3RvcmUoKSB7XHJcblx0XHRcdFx0aWYgKCByZXN0b3JlZCApIHsgcmV0dXJuOyB9XHJcblx0XHRcdFx0cmVzdG9yZWQgPSB0cnVlO1xyXG5cdFx0XHRcdHRyeSB7IEJ1aWxkZXI/LmJ1cz8ub2ZmPy4oIEVWX0RPTkUsIGRvX3Jlc3RvcmUgKTsgfSBjYXRjaCAoIF8gKSB7fVxyXG5cdFx0XHRcdHJlcXVlc3RBbmltYXRpb25GcmFtZSggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0aWYgKCAhIHRhYl9yZXN0b3JlX2hhbmRsZSApIHsgcmV0dXJuOyB9XHJcblx0XHRcdFx0XHR0YWJfcmVzdG9yZV9oYW5kbGUucmVzdG9yZSgpO1xyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gTGlzdGVuIG9uY2UgKGJlc3QpLCBwbHVzIGEgZmFsbGJhY2sgaW4gY2FzZSBldmVudCBpc24ndCBmaXJlZC5cclxuXHRcdFx0dHJ5IHsgQnVpbGRlcj8uYnVzPy5vbj8uKCBFVl9ET05FLCBkb19yZXN0b3JlICk7IH0gY2F0Y2ggKCBfICkge31cclxuXHJcblxyXG5cdFx0XHR2YXIgZW5hYmxlZCA9ICgnT24nID09PSB2YWx1ZSk7XHJcblx0XHRcdEJ1aWxkZXIuc2V0X3ByZXZpZXdfbW9kZSggZW5hYmxlZCwgeyByZWJ1aWxkOiB0cnVlLCByZWluaXQ6IHRydWUsIHNvdXJjZTogJ3NldHRpbmdzLWVmZmVjdHMnIH0gKTtcclxuXHRcdH1cclxuXHQpO1xyXG5cclxufSApO1xyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMsVUFBVUEsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7RUFDaEIsWUFBWTs7RUFFWixNQUFNQyxPQUFPLEdBQUlGLENBQUMsQ0FBQ0cseUJBQXlCLEdBQUdILENBQUMsQ0FBQ0cseUJBQXlCLElBQUksQ0FBQyxDQUFFO0VBQ2pGLE1BQU1DLEdBQUcsR0FBUUYsT0FBTyxDQUFDRSxHQUFHLEdBQUdGLE9BQU8sQ0FBQ0UsR0FBRyxJQUFJQyxNQUFNLENBQUNDLE1BQU0sQ0FBRSxJQUFLLENBQUU7RUFFcEVKLE9BQU8sQ0FBQ0ssUUFBUSxHQUFHLFVBQVVDLEdBQUcsRUFBRUMsRUFBRSxFQUFFO0lBQ3JDLElBQUtELEdBQUcsSUFBSSxPQUFPQyxFQUFFLEtBQUssVUFBVSxFQUFHO01BQ3RDTCxHQUFHLENBQUNNLE1BQU0sQ0FBRUYsR0FBSSxDQUFDLENBQUMsR0FBR0MsRUFBRTtJQUN4QjtFQUNELENBQUM7RUFFRCxTQUFTRSxlQUFlQSxDQUFBLEVBQUc7SUFDMUIsT0FDQ1YsQ0FBQyxDQUFDVyxhQUFhLENBQUUsNEJBQTZCLENBQUMsSUFDL0NYLENBQUMsQ0FBQ1csYUFBYSxDQUFFLDJCQUE0QixDQUFDLElBQzlDWCxDQUFD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
