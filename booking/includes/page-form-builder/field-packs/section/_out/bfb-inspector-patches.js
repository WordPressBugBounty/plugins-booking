"use strict";

/**
 * Inspector Patches / Glue for Section:
 * ---------------------------------------------------------------------------------
 * 1) Prevent full re-render when changing "columns" for .wpbc_bfb__section
 * 2) Bind inspector to:
 *    - Mount "layout_chips" slot
 *    - Keep numeric "columns" input stable & debounced
 *    - Observe live DOM column changes and sync inspector
 *    - Mount/refresh "column_styles" slot exposed by UI.wpbc_bfb_column_styles
 *
 * == File: /includes/page-form-builder/field-packs/section/_out/bfb-inspector-patches.js
 *
 * @since     11.0.0
 * @modified  2025-09-16 11:26
 * @version   1.0.0
 */
(function (w) {
  'use strict';

  var Core = w.WPBC_BFB_Core = w.WPBC_BFB_Core || {};
  var UI = Core.UI = Core.UI || {};
  var H = Core.WPBC_Form_Builder_Helper || {};
  var DOM = Core.WPBC_BFB_DOM && Core.WPBC_BFB_DOM.SELECTORS || {
    row: '.wpbc_bfb__row',
    column: '.wpbc_bfb__column'
  };

  /**
   * Read actual number of columns from DOM.
   *
   * @param {HTMLElement} el
   * @returns {number}
   */
  function dom_cols(el) {
    try {
      var row = el ? el.querySelector(':scope > ' + DOM.row) : null;
      var cnt = row ? row.querySelectorAll(':scope > ' + DOM.column).length : 1;
      var clamp = Core.WPBC_BFB_Sanitize && Core.WPBC_BFB_Sanitize.clamp ? Core.WPBC_BFB_Sanitize.clamp : function (n, a, b) {
        return Math.max(a, Math.min(b, n));
      };
      return clamp(Number(cnt) || 1, 1, 4);
    } catch (_e) {
      return 1;
    }
  }

  /**
   * Observe column DOM changes to keep inspector inputs in sync.
   *
   * @param {object}      builder
   * @param {HTMLElement} section_el
   * @param {HTMLElement} inspector_root
   * @returns {Function}  disconnect
   */
  function observe_cols(builder, section_el, inspector_root) {
    var row = section_el && section_el.querySelector(':scope > ' + DOM.row);
    if (!row) {
      return function () {};
    }
    var input = inspector_root && inspector_root.querySelector('input[data-inspector-key="columns"]');
    var mo = new MutationObserver(function () {
      var cnt = dom_cols(section_el);
      if (input && input.value !== String(cnt)) {
        input.value = String(cnt);
        // Fire an input event so len-control syncs the slider too.
        try {
          input.dispatchEvent(new Event('input', {
            bubbles: true
          }));
        } catch (_e) {}
      }
      inspector_root && inspector_root.setAttribute('data-bfb-section-cols', String(cnt));
      section_el.dataset.columns = String(cnt);

      // Also refresh column styles if present.
      if (UI && UI.wpbc_bfb_column_styles && typeof UI.wpbc_bfb_column_styles.refresh_for_section === 'function') {
        UI.wpbc_bfb_column_styles.refresh_for_section(builder, section_el, inspector_root);
      }
    });
    try {
      mo.observe(row, {
        childList: true
      });
    } catch (_err) {}
    return function unobserve() {
      try {
        mo.disconnect();
      } catch (_e) {}
    };
  }

  /**
   * Ensure host for layout chips stays stable.
   *
   * @param {HTMLElement} inspector_root
   * @returns {HTMLElement|null}
   */
  function ensure_chips_host(inspector_root) {
    if (!inspector_root) {
      return null;
    }
    var host = inspector_root.querySelector('[data-bfb-slot="layout_chips"]') || inspector_root.querySelector('.inspector__row--layout-chips .wpbc_bfb__layout_chips') || inspector_root.querySelector('#wpbc_bfb__layout_chips_host');
    if (host) {
      host.classList.add('wpbc_bfb__layout_chips');
      host.setAttribute('data-bfb-slot', 'layout_chips');
    }
    return host;
  }

  /**
   * Render layout chips into inspector, if available.
   *
   * @param {object}      builder
   * @param {HTMLElement} section_el
   * @param {HTMLElement} inspector_root
   */
  function render_chips_into_inspector(builder, section_el, inspector_root) {
    if (!UI.WPBC_BFB_Layout_Chips || typeof UI.WPBC_BFB_Layout_Chips.render_for_section !== 'function') {
      return;
    }
    var host = ensure_chips_host(inspector_root);
    if (!host) {
      return;
    }
    host.innerHTML = '';
    UI.WPBC_BFB_Layout_Chips.render_for_section(builder, section_el, host);
  }

  // ------------------------------------------------------------------------------------------------
  // 1) Patch: prevent full re-render for columns change (section only)
  // ------------------------------------------------------------------------------------------------
  (function patch_no_rerender_for_columns() {
    var Inspector = w.WPBC_BFB_Inspector;
    if (!Inspector || Inspector.__wpbc_no_rerender_columns) {
      return;
    }
    Inspector.__wpbc_no_rerender_columns = true;
    var orig = Inspector.prototype._needs_rerender;
    Inspector.prototype._needs_rerender = function (el, key, e) {
      if (el && el.classList && el.classList.contains('wpbc_bfb__section') && key === 'columns') {
        return false;
      }
      return typeof orig === 'function' ? orig.call(this, el, key, e) : false;
    };
  })();

  // ------------------------------------------------------------------------------------------------
  // 2) Patch: extend Inspector.bind_to_field to wire chips + columns input + column styles slot
  // ------------------------------------------------------------------------------------------------
  function patch_inspector_bind_once() {
    var Inspector = w.WPBC_BFB_Inspector;
    if (!Inspector || Inspector.__wpbc_section_bind_patched) {
      return;
    }
    if (!Inspector.prototype || !Inspector.prototype.bind_to_field) {
      return;
    }
    Inspector.__wpbc_section_bind_patched = true;
    var orig_bind = Inspector.prototype.bind_to_field;
    Inspector.prototype.bind_to_field = function (el) {
      orig_bind.call(this, el);
      try {
        var ins = this.panel || document.getElementById('wpbc_bfb__inspector') || document.querySelector('.wpbc_bfb__inspector');
        var builder = this.builder || w.wpbc_bfb || null;
        if (!ins || !builder || !(el && el.classList && el.classList.contains('wpbc_bfb__section'))) {
          return;
        }

        // Layout chips.
        render_chips_into_inspector(builder, el, ins);

        // Stable numeric "columns" input behavior.
        var input = ins.querySelector('input[data-inspector-key="columns"]');
        if (input && !input.__wpbc_cols_hooked) {
          input.__wpbc_cols_hooked = true;
          input.value = String(dom_cols(el));
          var apply_change = function () {
            var desired = Core.WPBC_BFB_Sanitize && Core.WPBC_BFB_Sanitize.clamp ? Core.WPBC_BFB_Sanitize.clamp(input.value | 0, 1, 4) : Math.max(1, Math.min(4, Number(input.value) || 1));
            var current = dom_cols(el);
            if (desired === current) {
              return;
            }
            if (typeof builder.set_section_columns === 'function') {
              builder.set_section_columns(el, desired);
            }
            el.dataset.columns = String(desired);
            ins.setAttribute('data-bfb-section-cols', String(desired));

            // Refresh column styles UI on column count change.
            if (UI && UI.wpbc_bfb_column_styles && typeof UI.wpbc_bfb_column_styles.refresh_for_section === 'function') {
              UI.wpbc_bfb_column_styles.refresh_for_section(builder, el, ins);
            }
          };
          var debounced = H && H.debounce ? H.debounce(apply_change, 120) : apply_change;
          input.addEventListener('input', debounced);
          input.addEventListener('change', apply_change);
        }

        // Observe DOM changes in columns (sync inspector).
        if (this.__wpbc_cols_unobserve) {
          try {
            this.__wpbc_cols_unobserve();
          } catch (_e) {}
          this.__wpbc_cols_unobserve = null;
        }
        this.__wpbc_cols_unobserve = observe_cols(builder, el, ins);

        // Mount reusable "column_styles" slot into the inspector, if available.
        if (UI && UI.wpbc_bfb_column_styles && typeof UI.wpbc_bfb_column_styles.render_for_section === 'function') {
          UI.wpbc_bfb_column_styles.render_for_section(builder, el, ins.querySelector('[data-bfb-slot="column_styles"]'));
        }

        // Keep both slots fresh on structure events.
        var EV = Core.WPBC_BFB_Events || {};
        var refresh = () => {
          var cur = builder.get_selected_field && builder.get_selected_field();
          if (!cur || !cur.classList || !cur.classList.contains('wpbc_bfb__section')) {
            return;
          }
          render_chips_into_inspector(builder, cur, ins);
          if (UI && UI.wpbc_bfb_column_styles && typeof UI.wpbc_bfb_column_styles.refresh_for_section === 'function') {
            UI.wpbc_bfb_column_styles.refresh_for_section(builder, cur, ins);
          }
          var c = dom_cols(cur);
          ins.setAttribute('data-bfb-section-cols', String(c));
          var inp = ins.querySelector('input[data-inspector-key="columns"]');
          if (inp) {
            inp.value = String(c);
          }
        };
        if (!this.__wpbc_cols_bus_hooked && builder.bus) {
          this.__wpbc_cols_bus_hooked = true;
          builder.bus.on && builder.bus.on(EV.FIELD_ADD, refresh);
          builder.bus.on && builder.bus.on(EV.FIELD_REMOVE, refresh);
          builder.bus.on && builder.bus.on(EV.STRUCTURE_LOADED, refresh);
          builder.bus.on && builder.bus.on(EV.STRUCTURE_CHANGE, function (ev) {
            // The bus gives a DOM CustomEvent → data is in ev.detail. But be defensive in case some callers pass a plain object.
            var d = ev && (ev.detail || ev);
            var src = d && d.source;
            // Skip re-render when only per-column styles changed.
            if (src === 'column_styles' || src === 'column_styles_reset') {
              // Optional: keep the "columns" input value in sync without re-rendering.
              try {
                var cur = builder.get_selected_field && builder.get_selected_field();
                if (cur && cur.classList && cur.classList.contains('wpbc_bfb__section')) {
                  var c = dom_cols(cur);
                  ins.setAttribute('data-bfb-section-cols', String(c));
                  var inp = ins.querySelector('input[data-inspector-key="columns"]');
                  if (inp) {
                    inp.value = String(c);
                  }
                }
              } catch (_e) {}
              return;
            }
            refresh();
          });
        }
      } catch (e) {
        w._wpbc && w._wpbc.dev && w._wpbc.dev.error && w._wpbc.dev.error('section_inspector.patch_bind', e);
      }
    };
  }
  patch_inspector_bind_once();
  document.addEventListener('wpbc_bfb_inspector_ready', patch_inspector_bind_once);
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3Mvc2VjdGlvbi9fb3V0L2JmYi1pbnNwZWN0b3ItcGF0Y2hlcy5qcyIsIm5hbWVzIjpbInciLCJDb3JlIiwiV1BCQ19CRkJfQ29yZSIsIlVJIiwiSCIsIldQQkNfRm9ybV9CdWlsZGVyX0hlbHBlciIsIkRPTSIsIldQQkNfQkZCX0RPTSIsIlNFTEVDVE9SUyIsInJvdyIsImNvbHVtbiIsImRvbV9jb2xzIiwiZWwiLCJxdWVyeVNlbGVjdG9yIiwiY250IiwicXVlcnlTZWxlY3RvckFsbCIsImxlbmd0aCIsImNsYW1wIiwiV1BCQ19CRkJfU2FuaXRpemUiLCJuIiwiYSIsImIiLCJNYXRoIiwibWF4IiwibWluIiwiTnVtYmVyIiwiX2UiLCJvYnNlcnZlX2NvbHMiLCJidWlsZGVyIiwic2VjdGlvbl9lbCIsImluc3BlY3Rvcl9yb290IiwiaW5wdXQiLCJtbyIsIk11dGF0aW9uT2JzZXJ2ZXIiLCJ2YWx1ZSIsIlN0cmluZyIsImRpc3BhdGNoRXZlbnQiLCJFdmVudCIsImJ1YmJsZXMiLCJzZXRBdHRyaWJ1dGUiLCJkYXRhc2V0IiwiY29sdW1ucyIsIndwYmNfYmZiX2NvbHVtbl9zdHlsZXMiLCJyZWZyZXNoX2Zvcl9zZWN0aW9uIiwib2JzZXJ2ZSIsImNoaWxkTGlzdCIsIl9lcnIiLCJ1bm9ic2VydmUiLCJkaXNjb25uZWN0IiwiZW5zdXJlX2NoaXBzX2hvc3QiLCJob3N0IiwiY2xhc3NMaXN0IiwiYWRkIiwicmVuZGVyX2NoaXBzX2ludG9faW5zcGVjdG9yIiwiV1BCQ19CRkJfTGF5b3V0X0NoaXBzIiwicmVuZGVyX2Zvcl9zZWN0aW9uIiwiaW5uZXJIVE1MIiwicGF0Y2hfbm9fcmVyZW5kZXJfZm9yX2NvbHVtbnMiLCJJbnNwZWN0b3IiLCJXUEJDX0JGQl9JbnNwZWN0b3IiLCJfX3dwYmNfbm9fcmVyZW5kZXJfY29sdW1ucyIsIm9yaWciLCJwcm90b3R5cGUiLCJfbmVlZHNfcmVyZW5kZXIiLCJrZXkiLCJlIiwiY29udGFpbnMiLCJjYWxsIiwicGF0Y2hfaW5zcGVjdG9yX2JpbmRfb25jZSIsIl9fd3BiY19zZWN0aW9uX2JpbmRfcGF0Y2hlZCIsImJpbmRfdG9fZmllbGQiLCJvcmlnX2JpbmQiLCJpbnMiLCJwYW5lbCIsImRvY3VtZW50IiwiZ2V0RWxlbWVudEJ5SWQiLCJ3cGJjX2JmYiIsIl9fd3BiY19jb2xzX2hvb2tlZCIsImFwcGx5X2NoYW5nZSIsImRlc2lyZWQiLCJjdXJyZW50Iiwic2V0X3NlY3Rpb25fY29sdW1ucyIsImRlYm91bmNlZCIsImRlYm91bmNlIiwiYWRkRXZlbnRMaXN0ZW5lciIsIl9fd3BiY19jb2xzX3Vub2JzZXJ2ZSIsIkVWIiwiV1BCQ19CRkJfRXZlbnRzIiwicmVmcmVzaCIsImN1ciIsImdldF9zZWxlY3RlZF9maWVsZCIsImMiLCJpbnAiLCJfX3dwYmNfY29sc19idXNfaG9va2VkIiwiYnVzIiwib24iLCJGSUVMRF9BREQiLCJGSUVMRF9SRU1PVkUiLCJTVFJVQ1RVUkVfTE9BREVEIiwiU1RSVUNUVVJFX0NIQU5HRSIsImV2IiwiZCIsImRldGFpbCIsInNyYyIsInNvdXJjZSIsIl93cGJjIiwiZGV2IiwiZXJyb3IiLCJ3aW5kb3ciXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9maWVsZC1wYWNrcy9zZWN0aW9uL19zcmMvYmZiLWluc3BlY3Rvci1wYXRjaGVzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBJbnNwZWN0b3IgUGF0Y2hlcyAvIEdsdWUgZm9yIFNlY3Rpb246XHJcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gKiAxKSBQcmV2ZW50IGZ1bGwgcmUtcmVuZGVyIHdoZW4gY2hhbmdpbmcgXCJjb2x1bW5zXCIgZm9yIC53cGJjX2JmYl9fc2VjdGlvblxyXG4gKiAyKSBCaW5kIGluc3BlY3RvciB0bzpcclxuICogICAgLSBNb3VudCBcImxheW91dF9jaGlwc1wiIHNsb3RcclxuICogICAgLSBLZWVwIG51bWVyaWMgXCJjb2x1bW5zXCIgaW5wdXQgc3RhYmxlICYgZGVib3VuY2VkXHJcbiAqICAgIC0gT2JzZXJ2ZSBsaXZlIERPTSBjb2x1bW4gY2hhbmdlcyBhbmQgc3luYyBpbnNwZWN0b3JcclxuICogICAgLSBNb3VudC9yZWZyZXNoIFwiY29sdW1uX3N0eWxlc1wiIHNsb3QgZXhwb3NlZCBieSBVSS53cGJjX2JmYl9jb2x1bW5fc3R5bGVzXHJcbiAqXHJcbiAqID09IEZpbGU6IC9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9maWVsZC1wYWNrcy9zZWN0aW9uL19vdXQvYmZiLWluc3BlY3Rvci1wYXRjaGVzLmpzXHJcbiAqXHJcbiAqIEBzaW5jZSAgICAgMTEuMC4wXHJcbiAqIEBtb2RpZmllZCAgMjAyNS0wOS0xNiAxMToyNlxyXG4gKiBAdmVyc2lvbiAgIDEuMC4wXHJcbiAqL1xyXG4oZnVuY3Rpb24gKCB3ICkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0dmFyIENvcmUgPSAoIHcuV1BCQ19CRkJfQ29yZSA9IHcuV1BCQ19CRkJfQ29yZSB8fCB7fSApO1xyXG5cdHZhciBVSSAgID0gKCBDb3JlLlVJID0gQ29yZS5VSSB8fCB7fSApO1xyXG5cclxuXHR2YXIgSCAgID0gQ29yZS5XUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIgfHwge307XHJcblx0dmFyIERPTSA9ICggQ29yZS5XUEJDX0JGQl9ET00gJiYgQ29yZS5XUEJDX0JGQl9ET00uU0VMRUNUT1JTICkgfHwge1xyXG5cdFx0cm93ICAgIDogJy53cGJjX2JmYl9fcm93JyxcclxuXHRcdGNvbHVtbiA6ICcud3BiY19iZmJfX2NvbHVtbidcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBSZWFkIGFjdHVhbCBudW1iZXIgb2YgY29sdW1ucyBmcm9tIERPTS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsXHJcblx0ICogQHJldHVybnMge251bWJlcn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiBkb21fY29scyggZWwgKSB7XHJcblx0XHR0cnkge1xyXG5cdFx0XHR2YXIgcm93ID0gZWwgPyBlbC5xdWVyeVNlbGVjdG9yKCAnOnNjb3BlID4gJyArIERPTS5yb3cgKSA6IG51bGw7XHJcblx0XHRcdHZhciBjbnQgPSByb3cgPyByb3cucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSA+ICcgKyBET00uY29sdW1uICkubGVuZ3RoIDogMTtcclxuXHRcdFx0dmFyIGNsYW1wID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZSAmJiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLmNsYW1wID8gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5jbGFtcCA6IGZ1bmN0aW9uICggbiwgYSwgYiApIHsgcmV0dXJuIE1hdGgubWF4KCBhLCBNYXRoLm1pbiggYiwgbiApICk7IH07XHJcblx0XHRcdHJldHVybiBjbGFtcCggTnVtYmVyKCBjbnQgKSB8fCAxLCAxLCA0ICk7XHJcblx0XHR9IGNhdGNoICggX2UgKSB7XHJcblx0XHRcdHJldHVybiAxO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogT2JzZXJ2ZSBjb2x1bW4gRE9NIGNoYW5nZXMgdG8ga2VlcCBpbnNwZWN0b3IgaW5wdXRzIGluIHN5bmMuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge29iamVjdH0gICAgICBidWlsZGVyXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gc2VjdGlvbl9lbFxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGluc3BlY3Rvcl9yb290XHJcblx0ICogQHJldHVybnMge0Z1bmN0aW9ufSAgZGlzY29ubmVjdFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIG9ic2VydmVfY29scyggYnVpbGRlciwgc2VjdGlvbl9lbCwgaW5zcGVjdG9yX3Jvb3QgKSB7XHJcblx0XHR2YXIgcm93ID0gc2VjdGlvbl9lbCAmJiBzZWN0aW9uX2VsLnF1ZXJ5U2VsZWN0b3IoICc6c2NvcGUgPiAnICsgRE9NLnJvdyApO1xyXG5cdFx0aWYgKCAhIHJvdyApIHsgcmV0dXJuIGZ1bmN0aW9uICgpIHt9OyB9XHJcblxyXG5cdFx0dmFyIGlucHV0ID0gaW5zcGVjdG9yX3Jvb3QgJiYgaW5zcGVjdG9yX3Jvb3QucXVlcnlTZWxlY3RvciggJ2lucHV0W2RhdGEtaW5zcGVjdG9yLWtleT1cImNvbHVtbnNcIl0nICk7XHJcblx0XHR2YXIgbW8gPSBuZXcgTXV0YXRpb25PYnNlcnZlciggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR2YXIgY250ID0gZG9tX2NvbHMoIHNlY3Rpb25fZWwgKTtcclxuXHRcdFx0aWYgKCBpbnB1dCAmJiBpbnB1dC52YWx1ZSAhPT0gU3RyaW5nKCBjbnQgKSApIHtcclxuXHRcdFx0XHRpbnB1dC52YWx1ZSA9IFN0cmluZyggY250ICk7XHJcblx0XHRcdFx0Ly8gRmlyZSBhbiBpbnB1dCBldmVudCBzbyBsZW4tY29udHJvbCBzeW5jcyB0aGUgc2xpZGVyIHRvby5cclxuXHRcdFx0XHR0cnkgeyBpbnB1dC5kaXNwYXRjaEV2ZW50KCBuZXcgRXZlbnQoJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0pICk7IH0gY2F0Y2ggKF9lKSB7fVxyXG5cdFx0XHR9XHJcblx0XHRcdGluc3BlY3Rvcl9yb290ICYmIGluc3BlY3Rvcl9yb290LnNldEF0dHJpYnV0ZSggJ2RhdGEtYmZiLXNlY3Rpb24tY29scycsIFN0cmluZyggY250ICkgKTtcclxuXHRcdFx0c2VjdGlvbl9lbC5kYXRhc2V0LmNvbHVtbnMgPSBTdHJpbmcoIGNudCApO1xyXG5cclxuXHRcdFx0Ly8gQWxzbyByZWZyZXNoIGNvbHVtbiBzdHlsZXMgaWYgcHJlc2VudC5cclxuXHRcdFx0aWYgKCBVSSAmJiBVSS53cGJjX2JmYl9jb2x1bW5fc3R5bGVzICYmIHR5cGVvZiBVSS53cGJjX2JmYl9jb2x1bW5fc3R5bGVzLnJlZnJlc2hfZm9yX3NlY3Rpb24gPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0VUkud3BiY19iZmJfY29sdW1uX3N0eWxlcy5yZWZyZXNoX2Zvcl9zZWN0aW9uKCBidWlsZGVyLCBzZWN0aW9uX2VsLCBpbnNwZWN0b3Jfcm9vdCApO1xyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblx0XHR0cnkgeyBtby5vYnNlcnZlKCByb3csIHsgY2hpbGRMaXN0IDogdHJ1ZSB9ICk7IH0gY2F0Y2ggKCBfZXJyICkge31cclxuXHRcdHJldHVybiBmdW5jdGlvbiB1bm9ic2VydmUoKSB7IHRyeSB7IG1vLmRpc2Nvbm5lY3QoKTsgfSBjYXRjaCAoIF9lICkge30gfTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEVuc3VyZSBob3N0IGZvciBsYXlvdXQgY2hpcHMgc3RheXMgc3RhYmxlLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gaW5zcGVjdG9yX3Jvb3RcclxuXHQgKiBAcmV0dXJucyB7SFRNTEVsZW1lbnR8bnVsbH1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiBlbnN1cmVfY2hpcHNfaG9zdCggaW5zcGVjdG9yX3Jvb3QgKSB7XHJcblx0XHRpZiAoICEgaW5zcGVjdG9yX3Jvb3QgKSB7IHJldHVybiBudWxsOyB9XHJcblx0XHR2YXIgaG9zdCA9IGluc3BlY3Rvcl9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1iZmItc2xvdD1cImxheW91dF9jaGlwc1wiXScgKVxyXG5cdFx0XHR8fCBpbnNwZWN0b3Jfcm9vdC5xdWVyeVNlbGVjdG9yKCAnLmluc3BlY3Rvcl9fcm93LS1sYXlvdXQtY2hpcHMgLndwYmNfYmZiX19sYXlvdXRfY2hpcHMnIClcclxuXHRcdFx0fHwgaW5zcGVjdG9yX3Jvb3QucXVlcnlTZWxlY3RvciggJyN3cGJjX2JmYl9fbGF5b3V0X2NoaXBzX2hvc3QnICk7XHJcblx0XHRpZiAoIGhvc3QgKSB7XHJcblx0XHRcdGhvc3QuY2xhc3NMaXN0LmFkZCggJ3dwYmNfYmZiX19sYXlvdXRfY2hpcHMnICk7XHJcblx0XHRcdGhvc3Quc2V0QXR0cmlidXRlKCAnZGF0YS1iZmItc2xvdCcsICdsYXlvdXRfY2hpcHMnICk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gaG9zdDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlbmRlciBsYXlvdXQgY2hpcHMgaW50byBpbnNwZWN0b3IsIGlmIGF2YWlsYWJsZS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7b2JqZWN0fSAgICAgIGJ1aWxkZXJcclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBzZWN0aW9uX2VsXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gaW5zcGVjdG9yX3Jvb3RcclxuXHQgKi9cclxuXHRmdW5jdGlvbiByZW5kZXJfY2hpcHNfaW50b19pbnNwZWN0b3IoIGJ1aWxkZXIsIHNlY3Rpb25fZWwsIGluc3BlY3Rvcl9yb290ICkge1xyXG5cdFx0aWYgKCAhIFVJLldQQkNfQkZCX0xheW91dF9DaGlwcyB8fCB0eXBlb2YgVUkuV1BCQ19CRkJfTGF5b3V0X0NoaXBzLnJlbmRlcl9mb3Jfc2VjdGlvbiAhPT0gJ2Z1bmN0aW9uJyApIHsgcmV0dXJuOyB9XHJcblx0XHR2YXIgaG9zdCA9IGVuc3VyZV9jaGlwc19ob3N0KCBpbnNwZWN0b3Jfcm9vdCApO1xyXG5cdFx0aWYgKCAhIGhvc3QgKSB7IHJldHVybjsgfVxyXG5cdFx0aG9zdC5pbm5lckhUTUwgPSAnJztcclxuXHRcdFVJLldQQkNfQkZCX0xheW91dF9DaGlwcy5yZW5kZXJfZm9yX3NlY3Rpb24oIGJ1aWxkZXIsIHNlY3Rpb25fZWwsIGhvc3QgKTtcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIDEpIFBhdGNoOiBwcmV2ZW50IGZ1bGwgcmUtcmVuZGVyIGZvciBjb2x1bW5zIGNoYW5nZSAoc2VjdGlvbiBvbmx5KVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdChmdW5jdGlvbiBwYXRjaF9ub19yZXJlbmRlcl9mb3JfY29sdW1ucygpIHtcclxuXHRcdHZhciBJbnNwZWN0b3IgPSB3LldQQkNfQkZCX0luc3BlY3RvcjtcclxuXHRcdGlmICggISBJbnNwZWN0b3IgfHwgSW5zcGVjdG9yLl9fd3BiY19ub19yZXJlbmRlcl9jb2x1bW5zICkgeyByZXR1cm47IH1cclxuXHRcdEluc3BlY3Rvci5fX3dwYmNfbm9fcmVyZW5kZXJfY29sdW1ucyA9IHRydWU7XHJcblxyXG5cdFx0dmFyIG9yaWcgPSBJbnNwZWN0b3IucHJvdG90eXBlLl9uZWVkc19yZXJlbmRlcjtcclxuXHRcdEluc3BlY3Rvci5wcm90b3R5cGUuX25lZWRzX3JlcmVuZGVyID0gZnVuY3Rpb24gKCBlbCwga2V5LCBlICkge1xyXG5cdFx0XHRpZiAoIGVsICYmIGVsLmNsYXNzTGlzdCAmJiBlbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKSAmJiBrZXkgPT09ICdjb2x1bW5zJyApIHtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuICggdHlwZW9mIG9yaWcgPT09ICdmdW5jdGlvbicgKSA/IG9yaWcuY2FsbCggdGhpcywgZWwsIGtleSwgZSApIDogZmFsc2U7XHJcblx0XHR9O1xyXG5cdH0pKCk7XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIDIpIFBhdGNoOiBleHRlbmQgSW5zcGVjdG9yLmJpbmRfdG9fZmllbGQgdG8gd2lyZSBjaGlwcyArIGNvbHVtbnMgaW5wdXQgKyBjb2x1bW4gc3R5bGVzIHNsb3RcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRmdW5jdGlvbiBwYXRjaF9pbnNwZWN0b3JfYmluZF9vbmNlKCkge1xyXG5cdFx0dmFyIEluc3BlY3RvciA9IHcuV1BCQ19CRkJfSW5zcGVjdG9yO1xyXG5cdFx0aWYgKCAhIEluc3BlY3RvciB8fCBJbnNwZWN0b3IuX193cGJjX3NlY3Rpb25fYmluZF9wYXRjaGVkICkgeyByZXR1cm47IH1cclxuXHRcdGlmICggISBJbnNwZWN0b3IucHJvdG90eXBlIHx8ICEgSW5zcGVjdG9yLnByb3RvdHlwZS5iaW5kX3RvX2ZpZWxkICkgeyByZXR1cm47IH1cclxuXHRcdEluc3BlY3Rvci5fX3dwYmNfc2VjdGlvbl9iaW5kX3BhdGNoZWQgPSB0cnVlO1xyXG5cclxuXHRcdHZhciBvcmlnX2JpbmQgPSBJbnNwZWN0b3IucHJvdG90eXBlLmJpbmRfdG9fZmllbGQ7XHJcblxyXG5cdFx0SW5zcGVjdG9yLnByb3RvdHlwZS5iaW5kX3RvX2ZpZWxkID0gZnVuY3Rpb24gKCBlbCApIHtcclxuXHRcdFx0b3JpZ19iaW5kLmNhbGwoIHRoaXMsIGVsICk7XHJcblxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHZhciBpbnMgICAgID0gdGhpcy5wYW5lbCB8fCBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19pbnNwZWN0b3InICkgfHwgZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9faW5zcGVjdG9yJyApO1xyXG5cdFx0XHRcdHZhciBidWlsZGVyID0gdGhpcy5idWlsZGVyIHx8IHcud3BiY19iZmIgfHwgbnVsbDtcclxuXHRcdFx0XHRpZiAoICEgaW5zIHx8ICEgYnVpbGRlciB8fCAhKCBlbCAmJiBlbC5jbGFzc0xpc3QgJiYgZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX3NlY3Rpb24nICkgKSApIHsgcmV0dXJuOyB9XHJcblxyXG5cclxuXHRcdFx0XHQvLyBMYXlvdXQgY2hpcHMuXHJcblx0XHRcdFx0cmVuZGVyX2NoaXBzX2ludG9faW5zcGVjdG9yKCBidWlsZGVyLCBlbCwgaW5zICk7XHJcblxyXG5cdFx0XHRcdC8vIFN0YWJsZSBudW1lcmljIFwiY29sdW1uc1wiIGlucHV0IGJlaGF2aW9yLlxyXG5cdFx0XHRcdHZhciBpbnB1dCA9IGlucy5xdWVyeVNlbGVjdG9yKCAnaW5wdXRbZGF0YS1pbnNwZWN0b3Ita2V5PVwiY29sdW1uc1wiXScgKTtcclxuXHRcdFx0XHRpZiAoIGlucHV0ICYmICEgaW5wdXQuX193cGJjX2NvbHNfaG9va2VkICkge1xyXG5cdFx0XHRcdFx0aW5wdXQuX193cGJjX2NvbHNfaG9va2VkID0gdHJ1ZTtcclxuXHRcdFx0XHRcdGlucHV0LnZhbHVlID0gU3RyaW5nKCBkb21fY29scyggZWwgKSApO1xyXG5cclxuXHRcdFx0XHRcdHZhciBhcHBseV9jaGFuZ2UgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRcdHZhciBkZXNpcmVkID0gKCBDb3JlLldQQkNfQkZCX1Nhbml0aXplICYmIENvcmUuV1BCQ19CRkJfU2FuaXRpemUuY2xhbXAgKVxyXG5cdFx0XHRcdFx0XHRcdD8gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5jbGFtcCggaW5wdXQudmFsdWUgfCAwLCAxLCA0IClcclxuXHRcdFx0XHRcdFx0XHQ6IE1hdGgubWF4KCAxLCBNYXRoLm1pbiggNCwgTnVtYmVyKCBpbnB1dC52YWx1ZSApIHx8IDEgKSApO1xyXG5cdFx0XHRcdFx0XHR2YXIgY3VycmVudCA9IGRvbV9jb2xzKCBlbCApO1xyXG5cdFx0XHRcdFx0XHRpZiAoIGRlc2lyZWQgPT09IGN1cnJlbnQgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0XHRcdFx0aWYgKCB0eXBlb2YgYnVpbGRlci5zZXRfc2VjdGlvbl9jb2x1bW5zID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRcdGJ1aWxkZXIuc2V0X3NlY3Rpb25fY29sdW1ucyggZWwsIGRlc2lyZWQgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRlbC5kYXRhc2V0LmNvbHVtbnMgPSBTdHJpbmcoIGRlc2lyZWQgKTtcclxuXHRcdFx0XHRcdFx0aW5zLnNldEF0dHJpYnV0ZSggJ2RhdGEtYmZiLXNlY3Rpb24tY29scycsIFN0cmluZyggZGVzaXJlZCApICk7XHJcblxyXG5cdFx0XHRcdFx0XHQvLyBSZWZyZXNoIGNvbHVtbiBzdHlsZXMgVUkgb24gY29sdW1uIGNvdW50IGNoYW5nZS5cclxuXHRcdFx0XHRcdFx0aWYgKCBVSSAmJiBVSS53cGJjX2JmYl9jb2x1bW5fc3R5bGVzICYmIHR5cGVvZiBVSS53cGJjX2JmYl9jb2x1bW5fc3R5bGVzLnJlZnJlc2hfZm9yX3NlY3Rpb24gPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdFx0VUkud3BiY19iZmJfY29sdW1uX3N0eWxlcy5yZWZyZXNoX2Zvcl9zZWN0aW9uKCBidWlsZGVyLCBlbCwgaW5zICk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH07XHJcblxyXG5cdFx0XHRcdFx0dmFyIGRlYm91bmNlZCA9ICggSCAmJiBILmRlYm91bmNlICkgPyBILmRlYm91bmNlKCBhcHBseV9jaGFuZ2UsIDEyMCApIDogYXBwbHlfY2hhbmdlO1xyXG5cdFx0XHRcdFx0aW5wdXQuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgZGVib3VuY2VkICk7XHJcblx0XHRcdFx0XHRpbnB1dC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgYXBwbHlfY2hhbmdlICk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBPYnNlcnZlIERPTSBjaGFuZ2VzIGluIGNvbHVtbnMgKHN5bmMgaW5zcGVjdG9yKS5cclxuXHRcdFx0XHRpZiAoIHRoaXMuX193cGJjX2NvbHNfdW5vYnNlcnZlICkge1xyXG5cdFx0XHRcdFx0dHJ5IHsgdGhpcy5fX3dwYmNfY29sc191bm9ic2VydmUoKTsgfSBjYXRjaCAoIF9lICkge31cclxuXHRcdFx0XHRcdHRoaXMuX193cGJjX2NvbHNfdW5vYnNlcnZlID0gbnVsbDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dGhpcy5fX3dwYmNfY29sc191bm9ic2VydmUgPSBvYnNlcnZlX2NvbHMoIGJ1aWxkZXIsIGVsLCBpbnMgKTtcclxuXHJcblx0XHRcdFx0Ly8gTW91bnQgcmV1c2FibGUgXCJjb2x1bW5fc3R5bGVzXCIgc2xvdCBpbnRvIHRoZSBpbnNwZWN0b3IsIGlmIGF2YWlsYWJsZS5cclxuXHRcdFx0XHRpZiAoIFVJICYmIFVJLndwYmNfYmZiX2NvbHVtbl9zdHlsZXMgJiYgdHlwZW9mIFVJLndwYmNfYmZiX2NvbHVtbl9zdHlsZXMucmVuZGVyX2Zvcl9zZWN0aW9uID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0VUkud3BiY19iZmJfY29sdW1uX3N0eWxlcy5yZW5kZXJfZm9yX3NlY3Rpb24oIGJ1aWxkZXIsIGVsLCBpbnMucXVlcnlTZWxlY3RvciggJ1tkYXRhLWJmYi1zbG90PVwiY29sdW1uX3N0eWxlc1wiXScgKSApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gS2VlcCBib3RoIHNsb3RzIGZyZXNoIG9uIHN0cnVjdHVyZSBldmVudHMuXHJcblx0XHRcdFx0dmFyIEVWID0gQ29yZS5XUEJDX0JGQl9FdmVudHMgfHwge307XHJcblx0XHRcdFx0dmFyIHJlZnJlc2ggPSAoKSA9PiB7XHJcblx0XHRcdFx0XHR2YXIgY3VyID0gYnVpbGRlci5nZXRfc2VsZWN0ZWRfZmllbGQgJiYgYnVpbGRlci5nZXRfc2VsZWN0ZWRfZmllbGQoKTtcclxuXHRcdFx0XHRcdGlmICggISBjdXIgfHwgISBjdXIuY2xhc3NMaXN0IHx8ICEgY3VyLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApICkgeyByZXR1cm47IH1cclxuXHRcdFx0XHRcdHJlbmRlcl9jaGlwc19pbnRvX2luc3BlY3RvciggYnVpbGRlciwgY3VyLCBpbnMgKTtcclxuXHRcdFx0XHRcdGlmICggVUkgJiYgVUkud3BiY19iZmJfY29sdW1uX3N0eWxlcyAmJiB0eXBlb2YgVUkud3BiY19iZmJfY29sdW1uX3N0eWxlcy5yZWZyZXNoX2Zvcl9zZWN0aW9uID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRVSS53cGJjX2JmYl9jb2x1bW5fc3R5bGVzLnJlZnJlc2hfZm9yX3NlY3Rpb24oIGJ1aWxkZXIsIGN1ciwgaW5zICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR2YXIgYyA9IGRvbV9jb2xzKCBjdXIgKTtcclxuXHRcdFx0XHRcdGlucy5zZXRBdHRyaWJ1dGUoICdkYXRhLWJmYi1zZWN0aW9uLWNvbHMnLCBTdHJpbmcoIGMgKSApO1xyXG5cdFx0XHRcdFx0dmFyIGlucCA9IGlucy5xdWVyeVNlbGVjdG9yKCAnaW5wdXRbZGF0YS1pbnNwZWN0b3Ita2V5PVwiY29sdW1uc1wiXScgKTtcclxuXHRcdFx0XHRcdGlmICggaW5wICkgeyBpbnAudmFsdWUgPSBTdHJpbmcoIGMgKTsgfVxyXG5cdFx0XHRcdH07XHJcblxyXG5cdFx0XHRcdGlmICggISB0aGlzLl9fd3BiY19jb2xzX2J1c19ob29rZWQgJiYgYnVpbGRlci5idXMgKSB7XHJcblx0XHRcdFx0XHR0aGlzLl9fd3BiY19jb2xzX2J1c19ob29rZWQgPSB0cnVlO1xyXG5cdFx0XHRcdFx0YnVpbGRlci5idXMub24gJiYgYnVpbGRlci5idXMub24oIEVWLkZJRUxEX0FERCwgICAgICAgICByZWZyZXNoICk7XHJcblx0XHRcdFx0XHRidWlsZGVyLmJ1cy5vbiAmJiBidWlsZGVyLmJ1cy5vbiggRVYuRklFTERfUkVNT1ZFLCAgICAgIHJlZnJlc2ggKTtcclxuXHRcdFx0XHRcdGJ1aWxkZXIuYnVzLm9uICYmIGJ1aWxkZXIuYnVzLm9uKCBFVi5TVFJVQ1RVUkVfTE9BREVELCAgcmVmcmVzaCApO1xyXG5cdFx0XHRcdFx0YnVpbGRlci5idXMub24gJiYgYnVpbGRlci5idXMub24oIEVWLlNUUlVDVFVSRV9DSEFOR0UsIGZ1bmN0aW9uIChldikge1xyXG5cdFx0XHRcdFx0XHQvLyBUaGUgYnVzIGdpdmVzIGEgRE9NIEN1c3RvbUV2ZW50IOKGkiBkYXRhIGlzIGluIGV2LmRldGFpbC4gQnV0IGJlIGRlZmVuc2l2ZSBpbiBjYXNlIHNvbWUgY2FsbGVycyBwYXNzIGEgcGxhaW4gb2JqZWN0LlxyXG5cdFx0XHRcdFx0XHR2YXIgZCAgID0gZXYgJiYgKGV2LmRldGFpbCB8fCBldik7XHJcblx0XHRcdFx0XHRcdHZhciBzcmMgPSBkICYmIGQuc291cmNlO1xyXG5cdFx0XHRcdFx0XHQvLyBTa2lwIHJlLXJlbmRlciB3aGVuIG9ubHkgcGVyLWNvbHVtbiBzdHlsZXMgY2hhbmdlZC5cclxuXHRcdFx0XHRcdFx0aWYgKCBzcmMgPT09ICdjb2x1bW5fc3R5bGVzJyB8fCBzcmMgPT09ICdjb2x1bW5fc3R5bGVzX3Jlc2V0JyApIHtcclxuXHRcdFx0XHRcdFx0XHQvLyBPcHRpb25hbDoga2VlcCB0aGUgXCJjb2x1bW5zXCIgaW5wdXQgdmFsdWUgaW4gc3luYyB3aXRob3V0IHJlLXJlbmRlcmluZy5cclxuXHRcdFx0XHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0XHRcdFx0dmFyIGN1ciA9IGJ1aWxkZXIuZ2V0X3NlbGVjdGVkX2ZpZWxkICYmIGJ1aWxkZXIuZ2V0X3NlbGVjdGVkX2ZpZWxkKCk7XHJcblx0XHRcdFx0XHRcdFx0XHRpZiAoIGN1ciAmJiBjdXIuY2xhc3NMaXN0ICYmIGN1ci5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKSApIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0dmFyIGMgPSBkb21fY29scyggY3VyICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdGlucy5zZXRBdHRyaWJ1dGUoICdkYXRhLWJmYi1zZWN0aW9uLWNvbHMnLCBTdHJpbmcoIGMgKSApO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHR2YXIgaW5wID0gaW5zLnF1ZXJ5U2VsZWN0b3IoICdpbnB1dFtkYXRhLWluc3BlY3Rvci1rZXk9XCJjb2x1bW5zXCJdJyApO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoIGlucCApIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRpbnAudmFsdWUgPSBTdHJpbmcoIGMgKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdH0gY2F0Y2ggKCBfZSApIHt9XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdHJlZnJlc2goKTtcclxuXHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHR3Ll93cGJjICYmIHcuX3dwYmMuZGV2ICYmIHcuX3dwYmMuZGV2LmVycm9yICYmIHcuX3dwYmMuZGV2LmVycm9yKCAnc2VjdGlvbl9pbnNwZWN0b3IucGF0Y2hfYmluZCcsIGUgKTtcclxuXHRcdFx0fVxyXG5cdFx0fTtcclxuXHR9XHJcblxyXG5cdHBhdGNoX2luc3BlY3Rvcl9iaW5kX29uY2UoKTtcclxuXHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiY19iZmJfaW5zcGVjdG9yX3JlYWR5JywgcGF0Y2hfaW5zcGVjdG9yX2JpbmRfb25jZSApO1xyXG5cclxufSkoIHdpbmRvdyApO1xyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDLFVBQVdBLENBQUMsRUFBRztFQUNmLFlBQVk7O0VBRVosSUFBSUMsSUFBSSxHQUFLRCxDQUFDLENBQUNFLGFBQWEsR0FBR0YsQ0FBQyxDQUFDRSxhQUFhLElBQUksQ0FBQyxDQUFHO0VBQ3RELElBQUlDLEVBQUUsR0FBT0YsSUFBSSxDQUFDRSxFQUFFLEdBQUdGLElBQUksQ0FBQ0UsRUFBRSxJQUFJLENBQUMsQ0FBRztFQUV0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
