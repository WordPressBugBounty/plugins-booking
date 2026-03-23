"use strict";

/**
 * Debug UI — populate existing textareas, bind existing buttons.
 *
 * IMPORTANT:
 * - This file does NOT create any markup anymore.
 * - All blocks/textareas/buttons must exist in PHP template.
 *
 * @file: ../includes/page-form-builder/_out/export/debug-ui.js
 */
(function (w, d) {
  'use strict';

  // Prevent double init (if file is injected twice).
  if (w.__wpbc_bfb__debug_ui_inited === '1') {
    return;
  }
  w.__wpbc_bfb__debug_ui_inited = '1';
  const DEBUG_PANEL_ID = 'wpbc_bfb__debug_export_panel';
  const DEBUG_TAB_SEL = '.wpbc_bfb__tab_section__debug_tab';
  function has_debug_ui() {
    return !!(d.getElementById(DEBUG_PANEL_ID) || d.querySelector(DEBUG_TAB_SEL));
  }
  if (!has_debug_ui()) {
    return;
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------------------------------------------------
  function show_message(msg, type, timeout) {
    const m = String(msg || '');
    const t = String(type || 'info');
    if (typeof w.wpbc_admin_show_message === 'function') {
      try {
        w.wpbc_admin_show_message(m, t, timeout || 6000);
        return;
      } catch (_e) {}
    }

    // Fallback.
    if (t === 'error') {
      console.error(m);
    } else {
      console.log(m);
    }
  }
  function safe_json_parse(text) {
    const raw = String(text == null ? '' : text).trim();
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  // ---------------------------
  // Safe event dispatch helper (reuse preview contract)
  // ---------------------------
  function dispatch_event_safe(event_name, detail) {
    if (typeof w.wpbc_bfb__dispatch_event_safe === 'function') {
      try {
        w.wpbc_bfb__dispatch_event_safe(event_name, detail);
        return;
      } catch (_e) {}
    }
    try {
      d.dispatchEvent(new CustomEvent(event_name, {
        detail: detail || {}
      }));
    } catch (_e2) {}
  }
  function with_builder(cb) {
    if (w.wpbc_bfb_api && w.wpbc_bfb_api.ready && typeof w.wpbc_bfb_api.ready.then === 'function') {
      w.wpbc_bfb_api.ready.then(function (b) {
        cb(b || w.wpbc_bfb || null);
      });
      return;
    }
    cb(w.wpbc_bfb || null);
  }
  function is_debug_tab_visible() {
    const root = d.querySelector(DEBUG_TAB_SEL);
    if (!root) {
      return true;
    }
    try {
      if (root.hasAttribute('hidden')) {
        return false;
      }
      const aria = String(root.getAttribute('aria-hidden') || '').toLowerCase();
      if (aria === 'true') {
        return false;
      }
    } catch (_e) {}
    return true;
  }
  function get_debug_panel() {
    return d.getElementById(DEBUG_PANEL_ID) || null;
  }
  function set_value(textarea_id, value) {
    const el = d.getElementById(textarea_id);
    if (!el) {
      return;
    }
    el.value = String(value || '');
    try {
      el.dispatchEvent(new Event('input', {
        bubbles: true
      }));
    } catch (_) {}
  }
  function set_value_if_empty(textarea_id, value) {
    const el = d.getElementById(textarea_id);
    if (!el) {
      return;
    }
    if (String(el.value || '').trim() !== '') {
      return;
    }
    set_value(textarea_id, value);
  }
  function copy_text_to_clipboard(text, btn) {
    const raw = String(text || '');
    if (!raw) {
      return;
    }
    if (typeof w.wpbc_copy_to_clipboard === 'function') {
      try {
        const orig = btn ? String(btn.textContent || '') : '';
        w.wpbc_copy_to_clipboard(raw).then(function (ok) {
          if (!btn) {
            return;
          }
          btn.textContent = ok ? 'Copied!' : 'Press Ctrl/Cmd+C to copy';
          w.setTimeout(function () {
            btn.textContent = orig;
          }, 1500);
        }, function () {
          if (btn) {
            btn.textContent = 'Press Ctrl/Cmd+C to copy';
          }
        });
        return;
      } catch (_e) {}
    }
    show_message('Copy helper is not available. Please copy manually.', 'info', 4000);
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Data getters
  // -----------------------------------------------------------------------------------------------------------------
  function get_current_form_name() {
    const cfg = w.WPBC_BFB_Ajax || {};
    const v = cfg && cfg.form_name ? String(cfg.form_name) : '';
    return v ? v : 'standard';
  }

  // ---------------------------
  // Builder structure getter
  // ---------------------------
  function get_current_structure() {
    if (w.wpbc_bfb && typeof w.wpbc_bfb.get_structure === 'function') {
      try {
        return w.wpbc_bfb.get_structure();
      } catch (_e) {
        return [];
      }
    }
    return [];
  }

  // ---------------------------
  // Settings collector (reuses Preview contract)
  // ---------------------------
  function get_current_form_settings(form_name) {
    let form_settings = {
      options: {},
      css_vars: {}
    };
    dispatch_event_safe('wpbc:bfb:form_settings:collect', {
      settings: form_settings,
      form_name: form_name || 'standard'
    });

    // Strict: require correct shape.
    if (!form_settings || typeof form_settings !== 'object') {
      form_settings = {
        options: {},
        css_vars: {}
      };
    }
    if (!form_settings.options || typeof form_settings.options !== 'object') {
      form_settings.options = {};
    }
    if (!form_settings.css_vars || typeof form_settings.css_vars !== 'object') {
      form_settings.css_vars = {};
    }
    return form_settings;
  }

  /**
   * Parse combined length value like "100%", "320px", "12.5rem".
   *
   * @param {string} value
   * @return {{num:string, unit:string}}
   */
  function parse_length_value(value) {
    const raw = String(value == null ? '' : value).trim();
    const m = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*([a-z%]*)\s*$/i);
    if (!m) {
      return {
        num: raw,
        unit: ''
      };
    }
    return {
      num: m[1] || '',
      unit: m[2] || ''
    };
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Import logic (unchanged)
  // -----------------------------------------------------------------------------------------------------------------
  function normalize_imported_settings(parsed) {
    // Accept either:
    // 1) { options:{}, css_vars:{}, bfb_options:{} }
    // 2) { options:{...} } (css_vars optional)
    // 3) { ...optionsMap... } (we wrap into {options:...})
    var out = parsed;
    if (!out || typeof out !== 'object') {
      return {
        options: {},
        css_vars: {}
      };
    }
    var has_shape = Object.prototype.hasOwnProperty.call(out, 'options') || Object.prototype.hasOwnProperty.call(out, 'css_vars') || Object.prototype.hasOwnProperty.call(out, 'bfb_options');
    if (!has_shape) {
      out = {
        options: out,
        css_vars: {}
      };
    }
    if (!out.options || typeof out.options !== 'object') {
      out.options = {};
    }
    if (!out.css_vars || typeof out.css_vars !== 'object') {
      out.css_vars = {};
    }
    if (out.bfb_options && typeof out.bfb_options !== 'object') {
      out.bfb_options = {};
    }
    return out;
  }

  /**
   * Apply canvas effects immediately (without relying on DOM events).
   * This fixes the case when canvas was rebuilt after settings apply.
   *
   * @param {Object} settings_obj Normalized settings pack {options, css_vars, ...}
   * @param {Object} ctx
   */
  function run_settings_effects_now(settings_obj, ctx) {
    try {
      var eff = w.WPBC_BFB_Settings_Effects || null;
      if (!eff || typeof eff.apply_all !== 'function') {
        return;
      }
      if (!settings_obj || !settings_obj.options || typeof settings_obj.options !== 'object') {
        return;
      }
      eff.apply_all(settings_obj.options, ctx || {
        source: 'debug-import'
      });
    } catch (e) {
      console.error('Debug UI: run_settings_effects_now error', e);
    }
  }
  function apply_imported_settings(settings_obj) {
    var form_name = get_current_form_name();

    // 1) Update sidebar UI + let modules react.
    dispatch_event_safe('wpbc:bfb:form_settings:apply', {
      settings: settings_obj,
      form_name: form_name
    });

    // Optional hint for any listeners that want to refresh debug outputs.
    dispatch_event_safe('wpbc:bfb:form_settings:changed', {
      settings: settings_obj,
      form_name: form_name,
      source: 'debug-import'
    });

    // 2) Apply effects right away to current canvas (no rebuild yet).
    // (Even if rebuild happens later, this gives immediate feedback.)
    run_settings_effects_now(settings_obj, {
      source: 'debug-import-apply'
    });
  }
  function apply_imported_structure(structure_arr, on_done) {
    with_builder(function (builder) {
      if (!builder) {
        show_message('Debug UI: Builder is not ready.', 'error', 8000);
        if (typeof on_done === 'function') {
          on_done(false, null);
        }
        return;
      }
      try {
        // Prefer canonical loader if present (keeps compatibility with legacy callers).
        if (typeof w.wpbc_bfb__on_structure_loaded === 'function') {
          w.wpbc_bfb__on_structure_loaded(structure_arr);
        } else if (typeof builder.load_saved_structure === 'function') {
          builder.load_saved_structure(structure_arr, {
            deferIfTyping: false
          });
        } else if (w.wpbc_bfb_api && typeof w.wpbc_bfb_api.load_structure === 'function') {
          w.wpbc_bfb_api.load_structure(structure_arr);
        } else {
          show_message('Debug UI: No structure loader found.', 'error', 8000);
          if (typeof on_done === 'function') {
            on_done(false, builder);
          }
          return;
        }

        // IMPORTANT:
        // Do NOT do rebuild:true here, because load_saved_structure() already rebuilt DOM.
        // Rebuild:true would rebuild twice and can wipe effects.
        if (typeof builder.refresh_canvas === 'function') {
          builder.refresh_canvas({
            hard: true,
            rebuild: false,
            reinit: true,
            source: 'debug-import-structure'
          });
        }
        if (typeof on_done === 'function') {
          on_done(true, builder);
        }
      } catch (e) {
        show_message('Debug UI: Failed to apply structure. Check console.', 'error', 8000);
        console.error('Debug UI apply_imported_structure error', e);
        if (typeof on_done === 'function') {
          on_done(false, builder);
        }
      }
    });
  }
  function import_from_textareas(mode) {
    var s_text = (d.getElementById('wpbc_bfb__structure_import') || {}).value || '';
    var o_text = (d.getElementById('wpbc_bfb__settings_import') || {}).value || '';
    var structure = null;
    var settings = null;
    if (mode === 'structure' || mode === 'both') {
      var parsed_s = safe_json_parse(s_text);
      if (!Array.isArray(parsed_s)) {
        show_message('Debug UI: Structure JSON must be an array.', 'error', 8000);
        return;
      }
      structure = parsed_s;
    }
    if (mode === 'settings' || mode === 'both') {
      var parsed_o = safe_json_parse(o_text);
      if (!parsed_o || typeof parsed_o !== 'object') {
        show_message('Debug UI: Settings JSON must be an object.', 'error', 8000);
        return;
      }
      settings = normalize_imported_settings(parsed_o);
    }

    // Apply settings first (updates sidebar + immediate effects).
    if (settings) {
      apply_imported_settings(settings);
    }

    // Structure path: structure load rebuilds DOM -> re-apply settings AFTER load.
    if (structure) {
      apply_imported_structure(structure, function (ok) {
        if (!ok) {
          return;
        }

        // Re-dispatch settings apply AFTER structure rebuild, so settings_effects.js
        // applies to the FINAL DOM (new wrappers).
        if (settings) {
          var form_name = get_current_form_name();

          // 1) Dispatch apply again (this is what settings_effects.js listens for).
          dispatch_event_safe('wpbc:bfb:form_settings:apply', {
            settings: settings,
            form_name: form_name
          });

          // 2) Direct call fallback (in case the effects listener is not ready at that moment).
          run_settings_effects_now(settings, {
            source: 'debug-import-after-structure'
          });
          setTimeout(function () {
            run_settings_effects_now(settings, {
              source: 'debug-import-after-structure-delayed'
            });
          }, 60);
        }
        show_message('Imported into Builder (structure/settings).', 'success', 3000);
        setTimeout(function () {
          schedule_update();
        }, 160);
      });
      return;
    }

    // Settings-only import: DO NOT rebuild structure.
    with_builder(function (builder) {
      if (builder && typeof builder.refresh_canvas === 'function') {
        builder.refresh_canvas({
          hard: true,
          rebuild: false,
          reinit: true,
          source: 'debug-import-settings-only'
        });
      }

      // Ensure effects apply even if refresh_canvas rebuilt some preview markup.
      if (settings) {
        run_settings_effects_now(settings, {
          source: 'debug-import-settings-only'
        });
        setTimeout(function () {
          run_settings_effects_now(settings, {
            source: 'debug-import-settings-only-delayed'
          });
        }, 60);
      }
      show_message('Imported settings into UI.', 'success', 2500);
      setTimeout(function () {
        schedule_update();
      }, 160);
    });
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Populate outputs (NO UI creation)
  // -----------------------------------------------------------------------------------------------------------------
  function render_outputs(structure) {
    if (!is_debug_tab_visible()) {
      return;
    }
    const form_name = get_current_form_name();
    const form_settings = get_current_form_settings(form_name);

    // Exporter outputs (Advanced + Content).
    if (w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.export_all === 'function') {
      let export_options = {
        gapPercent: 3
      };

      // Best-effort: match Preview export options (width + slug) for accurate output.
      try {
        const width_combined = form_settings && form_settings.options ? form_settings.options.booking_form_layout_width || '' : '';
        const parsed_width = parse_length_value(width_combined);
        const width_unit = parsed_width.unit ? parsed_width.unit : '%';
        export_options = {
          gapPercent: 3,
          form_slug: form_name,
          form_width_value: parsed_width.num,
          form_width_unit: width_unit
        };
      } catch (_e1) {}
      try {
        const pkg = w.WPBC_BFB_Exporter.export_all(structure || [], export_options);
        set_value('wpbc_bfb__advanced_form_output', pkg && pkg.advanced_form ? pkg.advanced_form : '');
        set_value('wpbc_bfb__content_form_output', pkg && pkg.fields_data ? pkg.fields_data : '');
      } catch (e2) {
        set_value('wpbc_bfb__advanced_form_output', '// Exporter error: ' + (e2 && e2.message ? e2.message : String(e2)));
        set_value('wpbc_bfb__content_form_output', '');
      }
    } else {
      set_value('wpbc_bfb__advanced_form_output', '// WPBC_BFB_Exporter not loaded.');
      set_value('wpbc_bfb__content_form_output', '// WPBC_BFB_Exporter not loaded.');
    }

    // Structure JSON export + prefill import.
    try {
      const s = JSON.stringify(structure || [], null, 2);
      set_value('wpbc_bfb__structure_output', s);
      set_value_if_empty('wpbc_bfb__structure_import', s);
    } catch (e3) {
      set_value('wpbc_bfb__structure_output', '// Error serializing structure: ' + (e3 && e3.message ? e3.message : String(e3)));
    }

    // Settings JSON export + prefill import.
    try {
      const o = JSON.stringify(form_settings || {
        options: {},
        css_vars: {}
      }, null, 2);
      set_value('wpbc_bfb__settings_output', o);
      set_value_if_empty('wpbc_bfb__settings_import', o);
    } catch (e4) {
      set_value('wpbc_bfb__settings_output', '// Error serializing settings: ' + (e4 && e4.message ? e4.message : String(e4)));
    }
  }

  // Debounce to avoid heavy exports on rapid drag/drop.
  let update_timer = 0;
  function schedule_update(structure) {
    w.clearTimeout(update_timer);
    update_timer = w.setTimeout(function () {
      render_outputs(structure || get_current_structure());
    }, 80);
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Bind existing buttons (no UI creation)
  // -----------------------------------------------------------------------------------------------------------------
  function bind_debug_buttons_once() {
    const panel = get_debug_panel();
    if (!panel) {
      return;
    }

    // 1) If you later add data attributes, we support them.
    const data_btns = panel.querySelectorAll('[data-wpbc-bfb-debug-action]');
    if (data_btns && data_btns.length) {
      data_btns.forEach(function (btn) {
        if (!btn || !btn.addEventListener) {
          return;
        }
        if (btn.getAttribute('data-wpbc-bfb-debug-bound') === '1') {
          return;
        }
        btn.setAttribute('data-wpbc-bfb-debug-bound', '1');
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          const action = String(btn.getAttribute('data-wpbc-bfb-debug-action') || '').toLowerCase();
          const target = String(btn.getAttribute('data-wpbc-bfb-debug-target') || '');
          if (action === 'copy' && target) {
            const ta = d.getElementById(target);
            if (ta) {
              copy_text_to_clipboard(ta.value, btn);
            }
            return;
          }
          if (action === 'apply_structure') {
            import_from_textareas('structure');
            return;
          }
          if (action === 'apply_settings') {
            import_from_textareas('settings');
            return;
          }
          if (action === 'apply_both') {
            import_from_textareas('both');
            return;
          }
          if (action === 'refresh') {
            schedule_update();
            return;
          }
        });
      });
      return; // data-attrs are the preferred binding method.
    }

    // 2) Fallback binding for your current HTML (by textarea id + button order in block).
    const blocks = panel.querySelectorAll('.wpbc_bfb__debug_block');
    if (!blocks || !blocks.length) {
      return;
    }
    blocks.forEach(function (block) {
      const ta = block.querySelector('textarea');
      if (!ta || !ta.id) {
        return;
      }
      const btns = block.querySelectorAll('button');
      if (!btns || !btns.length) {
        return;
      }

      // Copy = always first button.
      const btn_copy = btns[0];
      if (btn_copy && btn_copy.getAttribute('data-wpbc-bfb-debug-bound') !== '1') {
        btn_copy.setAttribute('data-wpbc-bfb-debug-bound', '1');
        btn_copy.addEventListener('click', function (e) {
          e.preventDefault();
          copy_text_to_clipboard(ta.value, btn_copy);
        });
      }

      // Import blocks have more buttons.
      if (ta.id === 'wpbc_bfb__structure_import') {
        if (btns[1] && btns[1].getAttribute('data-wpbc-bfb-debug-bound') !== '1') {
          btns[1].setAttribute('data-wpbc-bfb-debug-bound', '1');
          btns[1].addEventListener('click', function (e) {
            e.preventDefault();
            import_from_textareas('structure');
          });
        }
        if (btns[2] && btns[2].getAttribute('data-wpbc-bfb-debug-bound') !== '1') {
          btns[2].setAttribute('data-wpbc-bfb-debug-bound', '1');
          btns[2].addEventListener('click', function (e) {
            e.preventDefault();
            import_from_textareas('both');
          });
        }
      }
      if (ta.id === 'wpbc_bfb__settings_import') {
        if (btns[1] && btns[1].getAttribute('data-wpbc-bfb-debug-bound') !== '1') {
          btns[1].setAttribute('data-wpbc-bfb-debug-bound', '1');
          btns[1].addEventListener('click', function (e) {
            e.preventDefault();
            import_from_textareas('settings');
          });
        }
        if (btns[2] && btns[2].getAttribute('data-wpbc-bfb-debug-bound') !== '1') {
          btns[2].setAttribute('data-wpbc-bfb-debug-bound', '1');
          btns[2].addEventListener('click', function (e) {
            e.preventDefault();
            import_from_textareas('both');
          });
        }
      }
    });
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Wiring
  // -----------------------------------------------------------------------------------------------------------------
  d.addEventListener('DOMContentLoaded', function () {
    bind_debug_buttons_once();
    schedule_update();
  });

  // Refresh when switching to Debug tab OR debug internal tabs.
  d.addEventListener('wpbc:bfb:top-tab', function (ev) {
    const tab_id = ev && ev.detail && ev.detail.tab ? String(ev.detail.tab) : '';
    if (tab_id === 'debug_tab' || tab_id.indexOf('debug_mode__') === 0) {
      bind_debug_buttons_once();
      schedule_update();
    }
  });

  // Fallback event (if you still dispatch it somewhere).
  d.addEventListener('wpbc:bfb:structure:change', function () {
    schedule_update();
  });

  // Settings apply/changed should refresh debug output.
  d.addEventListener('wpbc:bfb:form_settings:apply', function () {
    schedule_update();
  }, {
    passive: true
  });
  d.addEventListener('wpbc:bfb:form_settings:changed', function () {
    schedule_update();
  }, {
    passive: true
  });

  // Low-cost fallback: refresh on any change to SO controls (data-wpbc-u-save-*).
  d.addEventListener('change', function (e) {
    const t = e ? e.target : null;
    if (!t || !t.getAttribute) {
      return;
    }
    const attrs = t.attributes || null;
    if (!attrs || !attrs.length) {
      return;
    }
    for (let i = 0; i < attrs.length; i++) {
      const n = attrs[i] ? String(attrs[i].name || '') : '';
      if (n && n.indexOf('data-wpbc-u-save-') === 0) {
        schedule_update();
        return;
      }
    }
  }, {
    passive: true
  });

  // Prefer EventBus when available.
  (function hook_bus() {
    const Core = w.WPBC_BFB_Core || {};
    const EV = Core.WPBC_BFB_Events || null;
    if (!EV || !w.wpbc_bfb_api || !w.wpbc_bfb_api.ready) {
      return;
    }
    w.wpbc_bfb_api.ready.then(function (builder) {
      if (!builder || !builder.bus || typeof builder.bus.on !== 'function') {
        return;
      }
      [EV.STRUCTURE_CHANGE, EV.FIELD_ADD, EV.FIELD_REMOVE, EV.STRUCTURE_LOADED].filter(Boolean).forEach(function (event_name) {
        try {
          builder.bus.on(event_name, function () {
            schedule_update();
          });
        } catch (e) {
          if (w._wpbc && w._wpbc.dev && typeof w._wpbc.dev.error === 'function') {
            w._wpbc.dev.error('debug-ui: bus.on failed', event_name, e);
          }
        }
      });
    });
  })();
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9leHBvcnQvZGVidWctdWkuanMiLCJuYW1lcyI6WyJ3IiwiZCIsIl9fd3BiY19iZmJfX2RlYnVnX3VpX2luaXRlZCIsIkRFQlVHX1BBTkVMX0lEIiwiREVCVUdfVEFCX1NFTCIsImhhc19kZWJ1Z191aSIsImdldEVsZW1lbnRCeUlkIiwicXVlcnlTZWxlY3RvciIsInNob3dfbWVzc2FnZSIsIm1zZyIsInR5cGUiLCJ0aW1lb3V0IiwibSIsIlN0cmluZyIsInQiLCJ3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSIsIl9lIiwiY29uc29sZSIsImVycm9yIiwibG9nIiwic2FmZV9qc29uX3BhcnNlIiwidGV4dCIsInJhdyIsInRyaW0iLCJKU09OIiwicGFyc2UiLCJlIiwiZGlzcGF0Y2hfZXZlbnRfc2FmZSIsImV2ZW50X25hbWUiLCJkZXRhaWwiLCJ3cGJjX2JmYl9fZGlzcGF0Y2hfZXZlbnRfc2FmZSIsImRpc3BhdGNoRXZlbnQiLCJDdXN0b21FdmVudCIsIl9lMiIsIndpdGhfYnVpbGRlciIsImNiIiwid3BiY19iZmJfYXBpIiwicmVhZHkiLCJ0aGVuIiwiYiIsIndwYmNfYmZiIiwiaXNfZGVidWdfdGFiX3Zpc2libGUiLCJyb290IiwiaGFzQXR0cmlidXRlIiwiYXJpYSIsImdldEF0dHJpYnV0ZSIsInRvTG93ZXJDYXNlIiwiZ2V0X2RlYnVnX3BhbmVsIiwic2V0X3ZhbHVlIiwidGV4dGFyZWFfaWQiLCJ2YWx1ZSIsImVsIiwiRXZlbnQiLCJidWJibGVzIiwiXyIsInNldF92YWx1ZV9pZl9lbXB0eSIsImNvcHlfdGV4dF90b19jbGlwYm9hcmQiLCJidG4iLCJ3cGJjX2NvcHlfdG9fY2xpcGJvYXJkIiwib3JpZyIsInRleHRDb250ZW50Iiwib2siLCJzZXRUaW1lb3V0IiwiZ2V0X2N1cnJlbnRfZm9ybV9uYW1lIiwiY2ZnIiwiV1BCQ19CRkJfQWpheCIsInYiLCJmb3JtX25hbWUiLCJnZXRfY3VycmVudF9zdHJ1Y3R1cmUiLCJnZXRfc3RydWN0dXJlIiwiZ2V0X2N1cnJlbnRfZm9ybV9zZXR0aW5ncyIsImZvcm1fc2V0dGluZ3MiLCJvcHRpb25zIiwiY3NzX3ZhcnMiLCJzZXR0aW5ncyIsInBhcnNlX2xlbmd0aF92YWx1ZSIsIm1hdGNoIiwibnVtIiwidW5pdCIsIm5vcm1hbGl6ZV9pbXBvcnRlZF9zZXR0aW5ncyIsInBhcnNlZCIsIm91dCIsImhhc19zaGFwZSIsIk9iamVjdCIsInByb3RvdHlwZSIsImhhc093blByb3BlcnR5IiwiY2FsbCIsImJmYl9vcHRpb25zIiwicnVuX3NldHRpbmdzX2VmZmVjdHNfbm93Iiwic2V0dGluZ3Nfb2JqIiwiY3R4IiwiZWZmIiwiV1BCQ19CRkJfU2V0dGluZ3NfRWZmZWN0cyIsImFwcGx5X2FsbCIsInNvdXJjZSIsImFwcGx5X2ltcG9ydGVkX3NldHRpbmdzIiwiYXBwbHlfaW1wb3J0ZWRfc3RydWN0dXJlIiwic3RydWN0dXJlX2FyciIsIm9uX2RvbmUiLCJidWlsZGVyIiwid3BiY19iZmJfX29uX3N0cnVjdHVyZV9sb2FkZWQiLCJsb2FkX3NhdmVkX3N0cnVjdHVyZSIsImRlZmVySWZUeXBpbmciLCJsb2FkX3N0cnVjdHVyZSIsInJlZnJlc2hfY2FudmFzIiwiaGFyZCIsInJlYnVpbGQiLCJyZWluaXQiLCJpbXBvcnRfZnJvbV90ZXh0YXJlYXMiLCJtb2RlIiwic190ZXh0Iiwib190ZXh0Iiwic3RydWN0dXJlIiwicGFyc2VkX3MiLCJBcnJheSIsImlzQXJyYXkiLCJwYXJzZWRfbyIsInNjaGVkdWxlX3VwZGF0ZSIsInJlbmRlcl9vdXRwdXRzIiwiV1BCQ19CRkJfRXhwb3J0ZXIiLCJleHBvcnRfYWxsIiwiZXhwb3J0X29wdGlvbnMiLCJnYXBQZXJjZW50Iiwid2lkdGhfY29tYmluZWQiLCJib29raW5nX2Zvcm1fbGF5b3V0X3dpZHRoIiwicGFyc2VkX3dpZHRoIiwid2lkdGhfdW5pdCIsImZvcm1fc2x1ZyIsImZvcm1fd2lkdGhfdmFsdWUiLCJmb3JtX3dpZHRoX3VuaXQiLCJfZTEiLCJwa2ciLCJhZHZhbmNlZF9mb3JtIiwiZmllbGRzX2RhdGEiLCJlMiIsIm1lc3NhZ2UiLCJzIiwic3RyaW5naWZ5IiwiZTMiLCJvIiwiZTQiLCJ1cGRhdGVfdGltZXIiLCJjbGVhclRpbWVvdXQiLCJiaW5kX2RlYnVnX2J1dHRvbnNfb25jZSIsInBhbmVsIiwiZGF0YV9idG5zIiwicXVlcnlTZWxlY3RvckFsbCIsImxlbmd0aCIsImZvckVhY2giLCJhZGRFdmVudExpc3RlbmVyIiwic2V0QXR0cmlidXRlIiwicHJldmVudERlZmF1bHQiLCJhY3Rpb24iLCJ0YXJnZXQiLCJ0YSIsImJsb2NrcyIsImJsb2NrIiwiaWQiLCJidG5zIiwiYnRuX2NvcHkiLCJldiIsInRhYl9pZCIsInRhYiIsImluZGV4T2YiLCJwYXNzaXZlIiwiYXR0cnMiLCJhdHRyaWJ1dGVzIiwiaSIsIm4iLCJuYW1lIiwiaG9va19idXMiLCJDb3JlIiwiV1BCQ19CRkJfQ29yZSIsIkVWIiwiV1BCQ19CRkJfRXZlbnRzIiwiYnVzIiwib24iLCJTVFJVQ1RVUkVfQ0hBTkdFIiwiRklFTERfQUREIiwiRklFTERfUkVNT1ZFIiwiU1RSVUNUVVJFX0xPQURFRCIsImZpbHRlciIsIkJvb2xlYW4iLCJfd3BiYyIsImRldiIsIndpbmRvdyIsImRvY3VtZW50Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX3NyYy9leHBvcnQvZGVidWctdWkuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIERlYnVnIFVJIOKAlCBwb3B1bGF0ZSBleGlzdGluZyB0ZXh0YXJlYXMsIGJpbmQgZXhpc3RpbmcgYnV0dG9ucy5cclxuICpcclxuICogSU1QT1JUQU5UOlxyXG4gKiAtIFRoaXMgZmlsZSBkb2VzIE5PVCBjcmVhdGUgYW55IG1hcmt1cCBhbnltb3JlLlxyXG4gKiAtIEFsbCBibG9ja3MvdGV4dGFyZWFzL2J1dHRvbnMgbXVzdCBleGlzdCBpbiBQSFAgdGVtcGxhdGUuXHJcbiAqXHJcbiAqIEBmaWxlOiAuLi9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9fb3V0L2V4cG9ydC9kZWJ1Zy11aS5qc1xyXG4gKi9cclxuKGZ1bmN0aW9uICh3LCBkKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHQvLyBQcmV2ZW50IGRvdWJsZSBpbml0IChpZiBmaWxlIGlzIGluamVjdGVkIHR3aWNlKS5cclxuXHRpZiAoIHcuX193cGJjX2JmYl9fZGVidWdfdWlfaW5pdGVkID09PSAnMScgKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cdHcuX193cGJjX2JmYl9fZGVidWdfdWlfaW5pdGVkID0gJzEnO1xyXG5cclxuXHRjb25zdCBERUJVR19QQU5FTF9JRCA9ICd3cGJjX2JmYl9fZGVidWdfZXhwb3J0X3BhbmVsJztcclxuXHRjb25zdCBERUJVR19UQUJfU0VMICA9ICcud3BiY19iZmJfX3RhYl9zZWN0aW9uX19kZWJ1Z190YWInO1xyXG5cclxuXHRmdW5jdGlvbiBoYXNfZGVidWdfdWkoKSB7XHJcblx0XHRyZXR1cm4gISEgKCBkLmdldEVsZW1lbnRCeUlkKCBERUJVR19QQU5FTF9JRCApIHx8IGQucXVlcnlTZWxlY3RvciggREVCVUdfVEFCX1NFTCApICk7XHJcblx0fVxyXG5cclxuXHRpZiAoICEgaGFzX2RlYnVnX3VpKCkgKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEhlbHBlcnNcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGZ1bmN0aW9uIHNob3dfbWVzc2FnZSggbXNnLCB0eXBlLCB0aW1lb3V0ICkge1xyXG5cdFx0Y29uc3QgbSA9IFN0cmluZyggbXNnIHx8ICcnICk7XHJcblx0XHRjb25zdCB0ID0gU3RyaW5nKCB0eXBlIHx8ICdpbmZvJyApO1xyXG5cclxuXHRcdGlmICggdHlwZW9mIHcud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0dy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggbSwgdCwgdGltZW91dCB8fCA2MDAwICk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9IGNhdGNoICggX2UgKSB7fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIEZhbGxiYWNrLlxyXG5cdFx0aWYgKCB0ID09PSAnZXJyb3InICkge1xyXG5cdFx0XHRjb25zb2xlLmVycm9yKCBtICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRjb25zb2xlLmxvZyggbSApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2FmZV9qc29uX3BhcnNlKCB0ZXh0ICkge1xyXG5cdFx0Y29uc3QgcmF3ID0gU3RyaW5nKCB0ZXh0ID09IG51bGwgPyAnJyA6IHRleHQgKS50cmltKCk7XHJcblx0XHRpZiAoICEgcmF3ICkge1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHRcdHRyeSB7XHJcblx0XHRcdHJldHVybiBKU09OLnBhcnNlKCByYXcgKTtcclxuXHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFNhZmUgZXZlbnQgZGlzcGF0Y2ggaGVscGVyIChyZXVzZSBwcmV2aWV3IGNvbnRyYWN0KVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGZ1bmN0aW9uIGRpc3BhdGNoX2V2ZW50X3NhZmUoIGV2ZW50X25hbWUsIGRldGFpbCApIHtcclxuXHRcdGlmICggdHlwZW9mIHcud3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0dy53cGJjX2JmYl9fZGlzcGF0Y2hfZXZlbnRfc2FmZSggZXZlbnRfbmFtZSwgZGV0YWlsICk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9IGNhdGNoICggX2UgKSB7fVxyXG5cdFx0fVxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0ZC5kaXNwYXRjaEV2ZW50KCBuZXcgQ3VzdG9tRXZlbnQoIGV2ZW50X25hbWUsIHsgZGV0YWlsOiBkZXRhaWwgfHwge30gfSApICk7XHJcblx0XHR9IGNhdGNoICggX2UyICkge31cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHdpdGhfYnVpbGRlciggY2IgKSB7XHJcblx0XHRpZiAoIHcud3BiY19iZmJfYXBpICYmIHcud3BiY19iZmJfYXBpLnJlYWR5ICYmIHR5cGVvZiB3LndwYmNfYmZiX2FwaS5yZWFkeS50aGVuID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHR3LndwYmNfYmZiX2FwaS5yZWFkeS50aGVuKCBmdW5jdGlvbiAoIGIgKSB7XHJcblx0XHRcdFx0Y2IoIGIgfHwgdy53cGJjX2JmYiB8fCBudWxsICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0Y2IoIHcud3BiY19iZmIgfHwgbnVsbCApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaXNfZGVidWdfdGFiX3Zpc2libGUoKSB7XHJcblx0XHRjb25zdCByb290ID0gZC5xdWVyeVNlbGVjdG9yKCBERUJVR19UQUJfU0VMICk7XHJcblx0XHRpZiAoICEgcm9vdCApIHtcclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblx0XHR0cnkge1xyXG5cdFx0XHRpZiAoIHJvb3QuaGFzQXR0cmlidXRlKCAnaGlkZGVuJyApICkge1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCBhcmlhID0gU3RyaW5nKCByb290LmdldEF0dHJpYnV0ZSggJ2FyaWEtaGlkZGVuJyApIHx8ICcnICkudG9Mb3dlckNhc2UoKTtcclxuXHRcdFx0aWYgKCBhcmlhID09PSAndHJ1ZScgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblx0XHR9IGNhdGNoICggX2UgKSB7fVxyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfZGVidWdfcGFuZWwoKSB7XHJcblx0XHRyZXR1cm4gZC5nZXRFbGVtZW50QnlJZCggREVCVUdfUEFORUxfSUQgKSB8fCBudWxsO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2V0X3ZhbHVlKCB0ZXh0YXJlYV9pZCwgdmFsdWUgKSB7XHJcblx0XHRjb25zdCBlbCA9IGQuZ2V0RWxlbWVudEJ5SWQoIHRleHRhcmVhX2lkICk7XHJcblx0XHRpZiAoICEgZWwgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdGVsLnZhbHVlID0gU3RyaW5nKCB2YWx1ZSB8fCAnJyApO1xyXG5cdFx0dHJ5IHtcclxuXHRcdFx0ZWwuZGlzcGF0Y2hFdmVudCggbmV3IEV2ZW50KCAnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSApICk7XHJcblx0XHR9IGNhdGNoICggXyApIHt9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZXRfdmFsdWVfaWZfZW1wdHkoIHRleHRhcmVhX2lkLCB2YWx1ZSApIHtcclxuXHRcdGNvbnN0IGVsID0gZC5nZXRFbGVtZW50QnlJZCggdGV4dGFyZWFfaWQgKTtcclxuXHRcdGlmICggISBlbCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBTdHJpbmcoIGVsLnZhbHVlIHx8ICcnICkudHJpbSgpICE9PSAnJyApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0c2V0X3ZhbHVlKCB0ZXh0YXJlYV9pZCwgdmFsdWUgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGNvcHlfdGV4dF90b19jbGlwYm9hcmQoIHRleHQsIGJ0biApIHtcclxuXHRcdGNvbnN0IHJhdyA9IFN0cmluZyggdGV4dCB8fCAnJyApO1xyXG5cdFx0aWYgKCAhIHJhdyApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggdHlwZW9mIHcud3BiY19jb3B5X3RvX2NsaXBib2FyZCA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRjb25zdCBvcmlnID0gYnRuID8gU3RyaW5nKCBidG4udGV4dENvbnRlbnQgfHwgJycgKSA6ICcnO1xyXG5cdFx0XHRcdHcud3BiY19jb3B5X3RvX2NsaXBib2FyZCggcmF3ICkudGhlbihcclxuXHRcdFx0XHRcdGZ1bmN0aW9uICggb2sgKSB7XHJcblx0XHRcdFx0XHRcdGlmICggISBidG4gKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdGJ0bi50ZXh0Q29udGVudCA9IG9rID8gJ0NvcGllZCEnIDogJ1ByZXNzIEN0cmwvQ21kK0MgdG8gY29weSc7XHJcblx0XHRcdFx0XHRcdHcuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0XHRcdGJ0bi50ZXh0Q29udGVudCA9IG9yaWc7XHJcblx0XHRcdFx0XHRcdH0sIDE1MDAgKTtcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRcdGlmICggYnRuICkge1xyXG5cdFx0XHRcdFx0XHRcdGJ0bi50ZXh0Q29udGVudCA9ICdQcmVzcyBDdHJsL0NtZCtDIHRvIGNvcHknO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0KTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH0gY2F0Y2ggKCBfZSApIHt9XHJcblx0XHR9XHJcblxyXG5cdFx0c2hvd19tZXNzYWdlKCAnQ29weSBoZWxwZXIgaXMgbm90IGF2YWlsYWJsZS4gUGxlYXNlIGNvcHkgbWFudWFsbHkuJywgJ2luZm8nLCA0MDAwICk7XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIERhdGEgZ2V0dGVyc1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0ZnVuY3Rpb24gZ2V0X2N1cnJlbnRfZm9ybV9uYW1lKCkge1xyXG5cdFx0Y29uc3QgY2ZnID0gdy5XUEJDX0JGQl9BamF4IHx8IHt9O1xyXG5cdFx0Y29uc3QgdiAgID0gY2ZnICYmIGNmZy5mb3JtX25hbWUgPyBTdHJpbmcoIGNmZy5mb3JtX25hbWUgKSA6ICcnO1xyXG5cdFx0cmV0dXJuIHYgPyB2IDogJ3N0YW5kYXJkJztcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEJ1aWxkZXIgc3RydWN0dXJlIGdldHRlclxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGZ1bmN0aW9uIGdldF9jdXJyZW50X3N0cnVjdHVyZSgpIHtcclxuXHRcdGlmICggdy53cGJjX2JmYiAmJiB0eXBlb2Ygdy53cGJjX2JmYi5nZXRfc3RydWN0dXJlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHJldHVybiB3LndwYmNfYmZiLmdldF9zdHJ1Y3R1cmUoKTtcclxuXHRcdFx0fSBjYXRjaCAoIF9lICkge1xyXG5cdFx0XHRcdHJldHVybiBbXTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIFtdO1xyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gU2V0dGluZ3MgY29sbGVjdG9yIChyZXVzZXMgUHJldmlldyBjb250cmFjdClcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRmdW5jdGlvbiBnZXRfY3VycmVudF9mb3JtX3NldHRpbmdzKCBmb3JtX25hbWUgKSB7XHJcblx0XHRsZXQgZm9ybV9zZXR0aW5ncyA9IHsgb3B0aW9uczoge30sIGNzc192YXJzOiB7fSB9O1xyXG5cclxuXHRcdGRpc3BhdGNoX2V2ZW50X3NhZmUoICd3cGJjOmJmYjpmb3JtX3NldHRpbmdzOmNvbGxlY3QnLCB7XHJcblx0XHRcdHNldHRpbmdzIDogZm9ybV9zZXR0aW5ncyxcclxuXHRcdFx0Zm9ybV9uYW1lOiBmb3JtX25hbWUgfHwgJ3N0YW5kYXJkJ1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdC8vIFN0cmljdDogcmVxdWlyZSBjb3JyZWN0IHNoYXBlLlxyXG5cdFx0aWYgKCAhIGZvcm1fc2V0dGluZ3MgfHwgdHlwZW9mIGZvcm1fc2V0dGluZ3MgIT09ICdvYmplY3QnICkge1xyXG5cdFx0XHRmb3JtX3NldHRpbmdzID0geyBvcHRpb25zOiB7fSwgY3NzX3ZhcnM6IHt9IH07XHJcblx0XHR9XHJcblx0XHRpZiAoICEgZm9ybV9zZXR0aW5ncy5vcHRpb25zIHx8IHR5cGVvZiBmb3JtX3NldHRpbmdzLm9wdGlvbnMgIT09ICdvYmplY3QnICkge1xyXG5cdFx0XHRmb3JtX3NldHRpbmdzLm9wdGlvbnMgPSB7fTtcclxuXHRcdH1cclxuXHRcdGlmICggISBmb3JtX3NldHRpbmdzLmNzc192YXJzIHx8IHR5cGVvZiBmb3JtX3NldHRpbmdzLmNzc192YXJzICE9PSAnb2JqZWN0JyApIHtcclxuXHRcdFx0Zm9ybV9zZXR0aW5ncy5jc3NfdmFycyA9IHt9O1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmb3JtX3NldHRpbmdzO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUGFyc2UgY29tYmluZWQgbGVuZ3RoIHZhbHVlIGxpa2UgXCIxMDAlXCIsIFwiMzIwcHhcIiwgXCIxMi41cmVtXCIuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdmFsdWVcclxuXHQgKiBAcmV0dXJuIHt7bnVtOnN0cmluZywgdW5pdDpzdHJpbmd9fVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHBhcnNlX2xlbmd0aF92YWx1ZSggdmFsdWUgKSB7XHJcblx0XHRjb25zdCByYXcgPSBTdHJpbmcoIHZhbHVlID09IG51bGwgPyAnJyA6IHZhbHVlICkudHJpbSgpO1xyXG5cdFx0Y29uc3QgbSAgID0gcmF3Lm1hdGNoKCAvXlxccyooLT9cXGQrKD86XFwuXFxkKyk/KVxccyooW2EteiVdKilcXHMqJC9pICk7XHJcblx0XHRpZiAoICEgbSApIHtcclxuXHRcdFx0cmV0dXJuIHsgbnVtOiByYXcsIHVuaXQ6ICcnIH07XHJcblx0XHR9XHJcblx0XHRyZXR1cm4geyBudW06ICggbVsxXSB8fCAnJyApLCB1bml0OiAoIG1bMl0gfHwgJycgKSB9O1xyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBJbXBvcnQgbG9naWMgKHVuY2hhbmdlZClcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9pbXBvcnRlZF9zZXR0aW5ncyggcGFyc2VkICkge1xyXG5cclxuXHRcdC8vIEFjY2VwdCBlaXRoZXI6XHJcblx0XHQvLyAxKSB7IG9wdGlvbnM6e30sIGNzc192YXJzOnt9LCBiZmJfb3B0aW9uczp7fSB9XHJcblx0XHQvLyAyKSB7IG9wdGlvbnM6ey4uLn0gfSAoY3NzX3ZhcnMgb3B0aW9uYWwpXHJcblx0XHQvLyAzKSB7IC4uLm9wdGlvbnNNYXAuLi4gfSAod2Ugd3JhcCBpbnRvIHtvcHRpb25zOi4uLn0pXHJcblx0XHR2YXIgb3V0ID0gcGFyc2VkO1xyXG5cclxuXHRcdGlmICggISBvdXQgfHwgdHlwZW9mIG91dCAhPT0gJ29iamVjdCcgKSB7XHJcblx0XHRcdHJldHVybiB7IG9wdGlvbnM6IHt9LCBjc3NfdmFyczoge30gfTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgaGFzX3NoYXBlID1cclxuXHRcdFx0XHRPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIG91dCwgJ29wdGlvbnMnICkgfHxcclxuXHRcdFx0XHRPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIG91dCwgJ2Nzc192YXJzJyApIHx8XHJcblx0XHRcdFx0T2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBvdXQsICdiZmJfb3B0aW9ucycgKTtcclxuXHJcblx0XHRpZiAoICEgaGFzX3NoYXBlICkge1xyXG5cdFx0XHRvdXQgPSB7IG9wdGlvbnM6IG91dCwgY3NzX3ZhcnM6IHt9IH07XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAhIG91dC5vcHRpb25zIHx8IHR5cGVvZiBvdXQub3B0aW9ucyAhPT0gJ29iamVjdCcgKSB7XHJcblx0XHRcdG91dC5vcHRpb25zID0ge307XHJcblx0XHR9XHJcblx0XHRpZiAoICEgb3V0LmNzc192YXJzIHx8IHR5cGVvZiBvdXQuY3NzX3ZhcnMgIT09ICdvYmplY3QnICkge1xyXG5cdFx0XHRvdXQuY3NzX3ZhcnMgPSB7fTtcclxuXHRcdH1cclxuXHRcdGlmICggb3V0LmJmYl9vcHRpb25zICYmIHR5cGVvZiBvdXQuYmZiX29wdGlvbnMgIT09ICdvYmplY3QnICkge1xyXG5cdFx0XHRvdXQuYmZiX29wdGlvbnMgPSB7fTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gb3V0O1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogQXBwbHkgY2FudmFzIGVmZmVjdHMgaW1tZWRpYXRlbHkgKHdpdGhvdXQgcmVseWluZyBvbiBET00gZXZlbnRzKS5cclxuXHQgKiBUaGlzIGZpeGVzIHRoZSBjYXNlIHdoZW4gY2FudmFzIHdhcyByZWJ1aWx0IGFmdGVyIHNldHRpbmdzIGFwcGx5LlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IHNldHRpbmdzX29iaiBOb3JtYWxpemVkIHNldHRpbmdzIHBhY2sge29wdGlvbnMsIGNzc192YXJzLCAuLi59XHJcblx0ICogQHBhcmFtIHtPYmplY3R9IGN0eFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHJ1bl9zZXR0aW5nc19lZmZlY3RzX25vdyggc2V0dGluZ3Nfb2JqLCBjdHggKSB7XHJcblx0XHR0cnkge1xyXG5cdFx0XHR2YXIgZWZmID0gdy5XUEJDX0JGQl9TZXR0aW5nc19FZmZlY3RzIHx8IG51bGw7XHJcblx0XHRcdGlmICggISBlZmYgfHwgdHlwZW9mIGVmZi5hcHBseV9hbGwgIT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggISBzZXR0aW5nc19vYmogfHwgISBzZXR0aW5nc19vYmoub3B0aW9ucyB8fCB0eXBlb2Ygc2V0dGluZ3Nfb2JqLm9wdGlvbnMgIT09ICdvYmplY3QnICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRlZmYuYXBwbHlfYWxsKCBzZXR0aW5nc19vYmoub3B0aW9ucywgY3R4IHx8IHsgc291cmNlOiAnZGVidWctaW1wb3J0JyB9ICk7XHJcblx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0Y29uc29sZS5lcnJvciggJ0RlYnVnIFVJOiBydW5fc2V0dGluZ3NfZWZmZWN0c19ub3cgZXJyb3InLCBlICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBhcHBseV9pbXBvcnRlZF9zZXR0aW5ncyggc2V0dGluZ3Nfb2JqICkge1xyXG5cdFx0dmFyIGZvcm1fbmFtZSA9IGdldF9jdXJyZW50X2Zvcm1fbmFtZSgpO1xyXG5cclxuXHRcdC8vIDEpIFVwZGF0ZSBzaWRlYmFyIFVJICsgbGV0IG1vZHVsZXMgcmVhY3QuXHJcblx0XHRkaXNwYXRjaF9ldmVudF9zYWZlKCAnd3BiYzpiZmI6Zm9ybV9zZXR0aW5nczphcHBseScsIHtcclxuXHRcdFx0c2V0dGluZ3MgOiBzZXR0aW5nc19vYmosXHJcblx0XHRcdGZvcm1fbmFtZTogZm9ybV9uYW1lXHJcblx0XHR9ICk7XHJcblxyXG5cdFx0Ly8gT3B0aW9uYWwgaGludCBmb3IgYW55IGxpc3RlbmVycyB0aGF0IHdhbnQgdG8gcmVmcmVzaCBkZWJ1ZyBvdXRwdXRzLlxyXG5cdFx0ZGlzcGF0Y2hfZXZlbnRfc2FmZSggJ3dwYmM6YmZiOmZvcm1fc2V0dGluZ3M6Y2hhbmdlZCcsIHtcclxuXHRcdFx0c2V0dGluZ3MgOiBzZXR0aW5nc19vYmosXHJcblx0XHRcdGZvcm1fbmFtZTogZm9ybV9uYW1lLFxyXG5cdFx0XHRzb3VyY2UgICA6ICdkZWJ1Zy1pbXBvcnQnXHJcblx0XHR9ICk7XHJcblxyXG5cdFx0Ly8gMikgQXBwbHkgZWZmZWN0cyByaWdodCBhd2F5IHRvIGN1cnJlbnQgY2FudmFzIChubyByZWJ1aWxkIHlldCkuXHJcblx0XHQvLyAoRXZlbiBpZiByZWJ1aWxkIGhhcHBlbnMgbGF0ZXIsIHRoaXMgZ2l2ZXMgaW1tZWRpYXRlIGZlZWRiYWNrLilcclxuXHRcdHJ1bl9zZXR0aW5nc19lZmZlY3RzX25vdyggc2V0dGluZ3Nfb2JqLCB7IHNvdXJjZTogJ2RlYnVnLWltcG9ydC1hcHBseScgfSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYXBwbHlfaW1wb3J0ZWRfc3RydWN0dXJlKCBzdHJ1Y3R1cmVfYXJyLCBvbl9kb25lICkge1xyXG5cdFx0d2l0aF9idWlsZGVyKCBmdW5jdGlvbiAoIGJ1aWxkZXIgKSB7XHJcblx0XHRcdGlmICggISBidWlsZGVyICkge1xyXG5cdFx0XHRcdHNob3dfbWVzc2FnZSggJ0RlYnVnIFVJOiBCdWlsZGVyIGlzIG5vdCByZWFkeS4nLCAnZXJyb3InLCA4MDAwICk7XHJcblx0XHRcdFx0aWYgKCB0eXBlb2Ygb25fZG9uZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdG9uX2RvbmUoIGZhbHNlLCBudWxsICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHQvLyBQcmVmZXIgY2Fub25pY2FsIGxvYWRlciBpZiBwcmVzZW50IChrZWVwcyBjb21wYXRpYmlsaXR5IHdpdGggbGVnYWN5IGNhbGxlcnMpLlxyXG5cdFx0XHRcdGlmICggdHlwZW9mIHcud3BiY19iZmJfX29uX3N0cnVjdHVyZV9sb2FkZWQgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHR3LndwYmNfYmZiX19vbl9zdHJ1Y3R1cmVfbG9hZGVkKCBzdHJ1Y3R1cmVfYXJyICk7XHJcblx0XHRcdFx0fSBlbHNlIGlmICggdHlwZW9mIGJ1aWxkZXIubG9hZF9zYXZlZF9zdHJ1Y3R1cmUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRidWlsZGVyLmxvYWRfc2F2ZWRfc3RydWN0dXJlKCBzdHJ1Y3R1cmVfYXJyLCB7IGRlZmVySWZUeXBpbmc6IGZhbHNlIH0gKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKCB3LndwYmNfYmZiX2FwaSAmJiB0eXBlb2Ygdy53cGJjX2JmYl9hcGkubG9hZF9zdHJ1Y3R1cmUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHR3LndwYmNfYmZiX2FwaS5sb2FkX3N0cnVjdHVyZSggc3RydWN0dXJlX2FyciApO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRzaG93X21lc3NhZ2UoICdEZWJ1ZyBVSTogTm8gc3RydWN0dXJlIGxvYWRlciBmb3VuZC4nLCAnZXJyb3InLCA4MDAwICk7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBvbl9kb25lID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRvbl9kb25lKCBmYWxzZSwgYnVpbGRlciApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gSU1QT1JUQU5UOlxyXG5cdFx0XHRcdC8vIERvIE5PVCBkbyByZWJ1aWxkOnRydWUgaGVyZSwgYmVjYXVzZSBsb2FkX3NhdmVkX3N0cnVjdHVyZSgpIGFscmVhZHkgcmVidWlsdCBET00uXHJcblx0XHRcdFx0Ly8gUmVidWlsZDp0cnVlIHdvdWxkIHJlYnVpbGQgdHdpY2UgYW5kIGNhbiB3aXBlIGVmZmVjdHMuXHJcblx0XHRcdFx0aWYgKCB0eXBlb2YgYnVpbGRlci5yZWZyZXNoX2NhbnZhcyA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdGJ1aWxkZXIucmVmcmVzaF9jYW52YXMoIHtcclxuXHRcdFx0XHRcdFx0aGFyZCAgIDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0cmVidWlsZDogZmFsc2UsXHJcblx0XHRcdFx0XHRcdHJlaW5pdCA6IHRydWUsXHJcblx0XHRcdFx0XHRcdHNvdXJjZSA6ICdkZWJ1Zy1pbXBvcnQtc3RydWN0dXJlJ1xyXG5cdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCB0eXBlb2Ygb25fZG9uZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdG9uX2RvbmUoIHRydWUsIGJ1aWxkZXIgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdHNob3dfbWVzc2FnZSggJ0RlYnVnIFVJOiBGYWlsZWQgdG8gYXBwbHkgc3RydWN0dXJlLiBDaGVjayBjb25zb2xlLicsICdlcnJvcicsIDgwMDAgKTtcclxuXHRcdFx0XHRjb25zb2xlLmVycm9yKCAnRGVidWcgVUkgYXBwbHlfaW1wb3J0ZWRfc3RydWN0dXJlIGVycm9yJywgZSApO1xyXG5cdFx0XHRcdGlmICggdHlwZW9mIG9uX2RvbmUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRvbl9kb25lKCBmYWxzZSwgYnVpbGRlciApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaW1wb3J0X2Zyb21fdGV4dGFyZWFzKCBtb2RlICkge1xyXG5cdFx0dmFyIHNfdGV4dCA9ICggZC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19zdHJ1Y3R1cmVfaW1wb3J0JyApIHx8IHt9ICkudmFsdWUgfHwgJyc7XHJcblx0XHR2YXIgb190ZXh0ID0gKCBkLmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX3NldHRpbmdzX2ltcG9ydCcgKSB8fCB7fSApLnZhbHVlIHx8ICcnO1xyXG5cclxuXHRcdHZhciBzdHJ1Y3R1cmUgPSBudWxsO1xyXG5cdFx0dmFyIHNldHRpbmdzICA9IG51bGw7XHJcblxyXG5cdFx0aWYgKCBtb2RlID09PSAnc3RydWN0dXJlJyB8fCBtb2RlID09PSAnYm90aCcgKSB7XHJcblx0XHRcdHZhciBwYXJzZWRfcyA9IHNhZmVfanNvbl9wYXJzZSggc190ZXh0ICk7XHJcblx0XHRcdGlmICggISBBcnJheS5pc0FycmF5KCBwYXJzZWRfcyApICkge1xyXG5cdFx0XHRcdHNob3dfbWVzc2FnZSggJ0RlYnVnIFVJOiBTdHJ1Y3R1cmUgSlNPTiBtdXN0IGJlIGFuIGFycmF5LicsICdlcnJvcicsIDgwMDAgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0c3RydWN0dXJlID0gcGFyc2VkX3M7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBtb2RlID09PSAnc2V0dGluZ3MnIHx8IG1vZGUgPT09ICdib3RoJyApIHtcclxuXHRcdFx0dmFyIHBhcnNlZF9vID0gc2FmZV9qc29uX3BhcnNlKCBvX3RleHQgKTtcclxuXHRcdFx0aWYgKCAhIHBhcnNlZF9vIHx8IHR5cGVvZiBwYXJzZWRfbyAhPT0gJ29iamVjdCcgKSB7XHJcblx0XHRcdFx0c2hvd19tZXNzYWdlKCAnRGVidWcgVUk6IFNldHRpbmdzIEpTT04gbXVzdCBiZSBhbiBvYmplY3QuJywgJ2Vycm9yJywgODAwMCApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRzZXR0aW5ncyA9IG5vcm1hbGl6ZV9pbXBvcnRlZF9zZXR0aW5ncyggcGFyc2VkX28gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBBcHBseSBzZXR0aW5ncyBmaXJzdCAodXBkYXRlcyBzaWRlYmFyICsgaW1tZWRpYXRlIGVmZmVjdHMpLlxyXG5cdFx0aWYgKCBzZXR0aW5ncyApIHtcclxuXHRcdFx0YXBwbHlfaW1wb3J0ZWRfc2V0dGluZ3MoIHNldHRpbmdzICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gU3RydWN0dXJlIHBhdGg6IHN0cnVjdHVyZSBsb2FkIHJlYnVpbGRzIERPTSAtPiByZS1hcHBseSBzZXR0aW5ncyBBRlRFUiBsb2FkLlxyXG5cdFx0aWYgKCBzdHJ1Y3R1cmUgKSB7XHJcblx0XHRcdGFwcGx5X2ltcG9ydGVkX3N0cnVjdHVyZSggc3RydWN0dXJlLCBmdW5jdGlvbiAoIG9rICkge1xyXG5cdFx0XHRcdGlmICggISBvayApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIFJlLWRpc3BhdGNoIHNldHRpbmdzIGFwcGx5IEFGVEVSIHN0cnVjdHVyZSByZWJ1aWxkLCBzbyBzZXR0aW5nc19lZmZlY3RzLmpzXHJcblx0XHRcdFx0Ly8gYXBwbGllcyB0byB0aGUgRklOQUwgRE9NIChuZXcgd3JhcHBlcnMpLlxyXG5cdFx0XHRcdGlmICggc2V0dGluZ3MgKSB7XHJcblx0XHRcdFx0XHR2YXIgZm9ybV9uYW1lID0gZ2V0X2N1cnJlbnRfZm9ybV9uYW1lKCk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gMSkgRGlzcGF0Y2ggYXBwbHkgYWdhaW4gKHRoaXMgaXMgd2hhdCBzZXR0aW5nc19lZmZlY3RzLmpzIGxpc3RlbnMgZm9yKS5cclxuXHRcdFx0XHRcdGRpc3BhdGNoX2V2ZW50X3NhZmUoICd3cGJjOmJmYjpmb3JtX3NldHRpbmdzOmFwcGx5Jywge1xyXG5cdFx0XHRcdFx0XHRzZXR0aW5ncyA6IHNldHRpbmdzLFxyXG5cdFx0XHRcdFx0XHRmb3JtX25hbWU6IGZvcm1fbmFtZVxyXG5cdFx0XHRcdFx0fSApO1xyXG5cclxuXHRcdFx0XHRcdC8vIDIpIERpcmVjdCBjYWxsIGZhbGxiYWNrIChpbiBjYXNlIHRoZSBlZmZlY3RzIGxpc3RlbmVyIGlzIG5vdCByZWFkeSBhdCB0aGF0IG1vbWVudCkuXHJcblx0XHRcdFx0XHRydW5fc2V0dGluZ3NfZWZmZWN0c19ub3coIHNldHRpbmdzLCB7IHNvdXJjZTogJ2RlYnVnLWltcG9ydC1hZnRlci1zdHJ1Y3R1cmUnIH0gKTtcclxuXHJcblx0XHRcdFx0XHRzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRcdHJ1bl9zZXR0aW5nc19lZmZlY3RzX25vdyggc2V0dGluZ3MsIHsgc291cmNlOiAnZGVidWctaW1wb3J0LWFmdGVyLXN0cnVjdHVyZS1kZWxheWVkJyB9ICk7XHJcblx0XHRcdFx0XHR9LCA2MCApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0c2hvd19tZXNzYWdlKCAnSW1wb3J0ZWQgaW50byBCdWlsZGVyIChzdHJ1Y3R1cmUvc2V0dGluZ3MpLicsICdzdWNjZXNzJywgMzAwMCApO1xyXG5cclxuXHRcdFx0XHRzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRzY2hlZHVsZV91cGRhdGUoKTtcclxuXHRcdFx0XHR9LCAxNjAgKTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFNldHRpbmdzLW9ubHkgaW1wb3J0OiBETyBOT1QgcmVidWlsZCBzdHJ1Y3R1cmUuXHJcblx0XHR3aXRoX2J1aWxkZXIoIGZ1bmN0aW9uICggYnVpbGRlciApIHtcclxuXHRcdFx0aWYgKCBidWlsZGVyICYmIHR5cGVvZiBidWlsZGVyLnJlZnJlc2hfY2FudmFzID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdGJ1aWxkZXIucmVmcmVzaF9jYW52YXMoIHtcclxuXHRcdFx0XHRcdGhhcmQgICA6IHRydWUsXHJcblx0XHRcdFx0XHRyZWJ1aWxkOiBmYWxzZSxcclxuXHRcdFx0XHRcdHJlaW5pdCA6IHRydWUsXHJcblx0XHRcdFx0XHRzb3VyY2UgOiAnZGVidWctaW1wb3J0LXNldHRpbmdzLW9ubHknXHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBFbnN1cmUgZWZmZWN0cyBhcHBseSBldmVuIGlmIHJlZnJlc2hfY2FudmFzIHJlYnVpbHQgc29tZSBwcmV2aWV3IG1hcmt1cC5cclxuXHRcdFx0aWYgKCBzZXR0aW5ncyApIHtcclxuXHRcdFx0XHRydW5fc2V0dGluZ3NfZWZmZWN0c19ub3coIHNldHRpbmdzLCB7IHNvdXJjZTogJ2RlYnVnLWltcG9ydC1zZXR0aW5ncy1vbmx5JyB9ICk7XHJcblx0XHRcdFx0c2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0cnVuX3NldHRpbmdzX2VmZmVjdHNfbm93KCBzZXR0aW5ncywgeyBzb3VyY2U6ICdkZWJ1Zy1pbXBvcnQtc2V0dGluZ3Mtb25seS1kZWxheWVkJyB9ICk7XHJcblx0XHRcdFx0fSwgNjAgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0c2hvd19tZXNzYWdlKCAnSW1wb3J0ZWQgc2V0dGluZ3MgaW50byBVSS4nLCAnc3VjY2VzcycsIDI1MDAgKTtcclxuXHJcblx0XHRcdHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRzY2hlZHVsZV91cGRhdGUoKTtcclxuXHRcdFx0fSwgMTYwICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFBvcHVsYXRlIG91dHB1dHMgKE5PIFVJIGNyZWF0aW9uKVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0ZnVuY3Rpb24gcmVuZGVyX291dHB1dHMoIHN0cnVjdHVyZSApIHtcclxuXHRcdGlmICggISBpc19kZWJ1Z190YWJfdmlzaWJsZSgpICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3QgZm9ybV9uYW1lICAgICA9IGdldF9jdXJyZW50X2Zvcm1fbmFtZSgpO1xyXG5cdFx0Y29uc3QgZm9ybV9zZXR0aW5ncyA9IGdldF9jdXJyZW50X2Zvcm1fc2V0dGluZ3MoIGZvcm1fbmFtZSApO1xyXG5cclxuXHRcdC8vIEV4cG9ydGVyIG91dHB1dHMgKEFkdmFuY2VkICsgQ29udGVudCkuXHJcblx0XHRpZiAoIHcuV1BCQ19CRkJfRXhwb3J0ZXIgJiYgdHlwZW9mIHcuV1BCQ19CRkJfRXhwb3J0ZXIuZXhwb3J0X2FsbCA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0bGV0IGV4cG9ydF9vcHRpb25zID0geyBnYXBQZXJjZW50OiAzIH07XHJcblxyXG5cdFx0XHQvLyBCZXN0LWVmZm9ydDogbWF0Y2ggUHJldmlldyBleHBvcnQgb3B0aW9ucyAod2lkdGggKyBzbHVnKSBmb3IgYWNjdXJhdGUgb3V0cHV0LlxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGNvbnN0IHdpZHRoX2NvbWJpbmVkID0gKCBmb3JtX3NldHRpbmdzICYmIGZvcm1fc2V0dGluZ3Mub3B0aW9ucyApXHJcblx0XHRcdFx0XHQ/ICggZm9ybV9zZXR0aW5ncy5vcHRpb25zLmJvb2tpbmdfZm9ybV9sYXlvdXRfd2lkdGggfHwgJycgKVxyXG5cdFx0XHRcdFx0OiAnJztcclxuXHJcblx0XHRcdFx0Y29uc3QgcGFyc2VkX3dpZHRoID0gcGFyc2VfbGVuZ3RoX3ZhbHVlKCB3aWR0aF9jb21iaW5lZCApO1xyXG5cdFx0XHRcdGNvbnN0IHdpZHRoX3VuaXQgICA9IHBhcnNlZF93aWR0aC51bml0ID8gcGFyc2VkX3dpZHRoLnVuaXQgOiAnJSc7XHJcblxyXG5cdFx0XHRcdGV4cG9ydF9vcHRpb25zID0ge1xyXG5cdFx0XHRcdFx0Z2FwUGVyY2VudCAgICAgIDogMyxcclxuXHRcdFx0XHRcdGZvcm1fc2x1ZyAgICAgICA6IGZvcm1fbmFtZSxcclxuXHRcdFx0XHRcdGZvcm1fd2lkdGhfdmFsdWU6IHBhcnNlZF93aWR0aC5udW0sXHJcblx0XHRcdFx0XHRmb3JtX3dpZHRoX3VuaXQgOiB3aWR0aF91bml0XHJcblx0XHRcdFx0fTtcclxuXHRcdFx0fSBjYXRjaCAoIF9lMSApIHt9XHJcblxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGNvbnN0IHBrZyA9IHcuV1BCQ19CRkJfRXhwb3J0ZXIuZXhwb3J0X2FsbCggc3RydWN0dXJlIHx8IFtdLCBleHBvcnRfb3B0aW9ucyApO1xyXG5cclxuXHRcdFx0XHRzZXRfdmFsdWUoICd3cGJjX2JmYl9fYWR2YW5jZWRfZm9ybV9vdXRwdXQnLCAoIHBrZyAmJiBwa2cuYWR2YW5jZWRfZm9ybSApID8gcGtnLmFkdmFuY2VkX2Zvcm0gOiAnJyApO1xyXG5cdFx0XHRcdHNldF92YWx1ZSggJ3dwYmNfYmZiX19jb250ZW50X2Zvcm1fb3V0cHV0JywgKCBwa2cgJiYgcGtnLmZpZWxkc19kYXRhICkgPyBwa2cuZmllbGRzX2RhdGEgOiAnJyApO1xyXG5cdFx0XHR9IGNhdGNoICggZTIgKSB7XHJcblx0XHRcdFx0c2V0X3ZhbHVlKCAnd3BiY19iZmJfX2FkdmFuY2VkX2Zvcm1fb3V0cHV0JywgJy8vIEV4cG9ydGVyIGVycm9yOiAnICsgKCAoIGUyICYmIGUyLm1lc3NhZ2UgKSA/IGUyLm1lc3NhZ2UgOiBTdHJpbmcoIGUyICkgKSApO1xyXG5cdFx0XHRcdHNldF92YWx1ZSggJ3dwYmNfYmZiX19jb250ZW50X2Zvcm1fb3V0cHV0JywgJycgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0c2V0X3ZhbHVlKCAnd3BiY19iZmJfX2FkdmFuY2VkX2Zvcm1fb3V0cHV0JywgJy8vIFdQQkNfQkZCX0V4cG9ydGVyIG5vdCBsb2FkZWQuJyApO1xyXG5cdFx0XHRzZXRfdmFsdWUoICd3cGJjX2JmYl9fY29udGVudF9mb3JtX291dHB1dCcsICAnLy8gV1BCQ19CRkJfRXhwb3J0ZXIgbm90IGxvYWRlZC4nICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gU3RydWN0dXJlIEpTT04gZXhwb3J0ICsgcHJlZmlsbCBpbXBvcnQuXHJcblx0XHR0cnkge1xyXG5cdFx0XHRjb25zdCBzID0gSlNPTi5zdHJpbmdpZnkoIHN0cnVjdHVyZSB8fCBbXSwgbnVsbCwgMiApO1xyXG5cdFx0XHRzZXRfdmFsdWUoICd3cGJjX2JmYl9fc3RydWN0dXJlX291dHB1dCcsIHMgKTtcclxuXHRcdFx0c2V0X3ZhbHVlX2lmX2VtcHR5KCAnd3BiY19iZmJfX3N0cnVjdHVyZV9pbXBvcnQnLCBzICk7XHJcblx0XHR9IGNhdGNoICggZTMgKSB7XHJcblx0XHRcdHNldF92YWx1ZSggJ3dwYmNfYmZiX19zdHJ1Y3R1cmVfb3V0cHV0JywgJy8vIEVycm9yIHNlcmlhbGl6aW5nIHN0cnVjdHVyZTogJyArICggKCBlMyAmJiBlMy5tZXNzYWdlICkgPyBlMy5tZXNzYWdlIDogU3RyaW5nKCBlMyApICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBTZXR0aW5ncyBKU09OIGV4cG9ydCArIHByZWZpbGwgaW1wb3J0LlxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0Y29uc3QgbyA9IEpTT04uc3RyaW5naWZ5KCBmb3JtX3NldHRpbmdzIHx8IHsgb3B0aW9uczoge30sIGNzc192YXJzOiB7fSB9LCBudWxsLCAyICk7XHJcblx0XHRcdHNldF92YWx1ZSggJ3dwYmNfYmZiX19zZXR0aW5nc19vdXRwdXQnLCBvICk7XHJcblx0XHRcdHNldF92YWx1ZV9pZl9lbXB0eSggJ3dwYmNfYmZiX19zZXR0aW5nc19pbXBvcnQnLCBvICk7XHJcblx0XHR9IGNhdGNoICggZTQgKSB7XHJcblx0XHRcdHNldF92YWx1ZSggJ3dwYmNfYmZiX19zZXR0aW5nc19vdXRwdXQnLCAnLy8gRXJyb3Igc2VyaWFsaXppbmcgc2V0dGluZ3M6ICcgKyAoICggZTQgJiYgZTQubWVzc2FnZSApID8gZTQubWVzc2FnZSA6IFN0cmluZyggZTQgKSApICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvLyBEZWJvdW5jZSB0byBhdm9pZCBoZWF2eSBleHBvcnRzIG9uIHJhcGlkIGRyYWcvZHJvcC5cclxuXHRsZXQgdXBkYXRlX3RpbWVyID0gMDtcclxuXHJcblx0ZnVuY3Rpb24gc2NoZWR1bGVfdXBkYXRlKCBzdHJ1Y3R1cmUgKSB7XHJcblx0XHR3LmNsZWFyVGltZW91dCggdXBkYXRlX3RpbWVyICk7XHJcblx0XHR1cGRhdGVfdGltZXIgPSB3LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0cmVuZGVyX291dHB1dHMoIHN0cnVjdHVyZSB8fCBnZXRfY3VycmVudF9zdHJ1Y3R1cmUoKSApO1xyXG5cdFx0fSwgODAgKTtcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gQmluZCBleGlzdGluZyBidXR0b25zIChubyBVSSBjcmVhdGlvbilcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGZ1bmN0aW9uIGJpbmRfZGVidWdfYnV0dG9uc19vbmNlKCkge1xyXG5cdFx0Y29uc3QgcGFuZWwgPSBnZXRfZGVidWdfcGFuZWwoKTtcclxuXHRcdGlmICggISBwYW5lbCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIDEpIElmIHlvdSBsYXRlciBhZGQgZGF0YSBhdHRyaWJ1dGVzLCB3ZSBzdXBwb3J0IHRoZW0uXHJcblx0XHRjb25zdCBkYXRhX2J0bnMgPSBwYW5lbC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1iZmItZGVidWctYWN0aW9uXScgKTtcclxuXHRcdGlmICggZGF0YV9idG5zICYmIGRhdGFfYnRucy5sZW5ndGggKSB7XHJcblx0XHRcdGRhdGFfYnRucy5mb3JFYWNoKCBmdW5jdGlvbiAoIGJ0biApIHtcclxuXHRcdFx0XHRpZiAoICEgYnRuIHx8ICEgYnRuLmFkZEV2ZW50TGlzdGVuZXIgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICggYnRuLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1iZmItZGVidWctYm91bmQnICkgPT09ICcxJyApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnRuLnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1iZmItZGVidWctYm91bmQnLCAnMScgKTtcclxuXHJcblx0XHRcdFx0YnRuLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uICggZSApIHtcclxuXHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHJcblx0XHRcdFx0XHRjb25zdCBhY3Rpb24gPSBTdHJpbmcoIGJ0bi5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYmZiLWRlYnVnLWFjdGlvbicgKSB8fCAnJyApLnRvTG93ZXJDYXNlKCk7XHJcblx0XHRcdFx0XHRjb25zdCB0YXJnZXQgPSBTdHJpbmcoIGJ0bi5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYmZiLWRlYnVnLXRhcmdldCcgKSB8fCAnJyApO1xyXG5cclxuXHRcdFx0XHRcdGlmICggYWN0aW9uID09PSAnY29weScgJiYgdGFyZ2V0ICkge1xyXG5cdFx0XHRcdFx0XHRjb25zdCB0YSA9IGQuZ2V0RWxlbWVudEJ5SWQoIHRhcmdldCApO1xyXG5cdFx0XHRcdFx0XHRpZiAoIHRhICkge1xyXG5cdFx0XHRcdFx0XHRcdGNvcHlfdGV4dF90b19jbGlwYm9hcmQoIHRhLnZhbHVlLCBidG4gKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKCBhY3Rpb24gPT09ICdhcHBseV9zdHJ1Y3R1cmUnICkge1xyXG5cdFx0XHRcdFx0XHRpbXBvcnRfZnJvbV90ZXh0YXJlYXMoICdzdHJ1Y3R1cmUnICk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlmICggYWN0aW9uID09PSAnYXBwbHlfc2V0dGluZ3MnICkge1xyXG5cdFx0XHRcdFx0XHRpbXBvcnRfZnJvbV90ZXh0YXJlYXMoICdzZXR0aW5ncycgKTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCBhY3Rpb24gPT09ICdhcHBseV9ib3RoJyApIHtcclxuXHRcdFx0XHRcdFx0aW1wb3J0X2Zyb21fdGV4dGFyZWFzKCAnYm90aCcgKTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCBhY3Rpb24gPT09ICdyZWZyZXNoJyApIHtcclxuXHRcdFx0XHRcdFx0c2NoZWR1bGVfdXBkYXRlKCk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdHJldHVybjsgLy8gZGF0YS1hdHRycyBhcmUgdGhlIHByZWZlcnJlZCBiaW5kaW5nIG1ldGhvZC5cclxuXHRcdH1cclxuXHJcblx0XHQvLyAyKSBGYWxsYmFjayBiaW5kaW5nIGZvciB5b3VyIGN1cnJlbnQgSFRNTCAoYnkgdGV4dGFyZWEgaWQgKyBidXR0b24gb3JkZXIgaW4gYmxvY2spLlxyXG5cdFx0Y29uc3QgYmxvY2tzID0gcGFuZWwucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fZGVidWdfYmxvY2snICk7XHJcblx0XHRpZiAoICEgYmxvY2tzIHx8ICEgYmxvY2tzLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGJsb2Nrcy5mb3JFYWNoKCBmdW5jdGlvbiAoIGJsb2NrICkge1xyXG5cdFx0XHRjb25zdCB0YSA9IGJsb2NrLnF1ZXJ5U2VsZWN0b3IoICd0ZXh0YXJlYScgKTtcclxuXHRcdFx0aWYgKCAhIHRhIHx8ICEgdGEuaWQgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBidG5zID0gYmxvY2sucXVlcnlTZWxlY3RvckFsbCggJ2J1dHRvbicgKTtcclxuXHRcdFx0aWYgKCAhIGJ0bnMgfHwgISBidG5zLmxlbmd0aCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIENvcHkgPSBhbHdheXMgZmlyc3QgYnV0dG9uLlxyXG5cdFx0XHRjb25zdCBidG5fY29weSA9IGJ0bnNbMF07XHJcblx0XHRcdGlmICggYnRuX2NvcHkgJiYgYnRuX2NvcHkuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJmYi1kZWJ1Zy1ib3VuZCcgKSAhPT0gJzEnICkge1xyXG5cdFx0XHRcdGJ0bl9jb3B5LnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1iZmItZGVidWctYm91bmQnLCAnMScgKTtcclxuXHRcdFx0XHRidG5fY29weS5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbiAoIGUgKSB7XHJcblx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0XHRjb3B5X3RleHRfdG9fY2xpcGJvYXJkKCB0YS52YWx1ZSwgYnRuX2NvcHkgKTtcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIEltcG9ydCBibG9ja3MgaGF2ZSBtb3JlIGJ1dHRvbnMuXHJcblx0XHRcdGlmICggdGEuaWQgPT09ICd3cGJjX2JmYl9fc3RydWN0dXJlX2ltcG9ydCcgKSB7XHJcblx0XHRcdFx0aWYgKCBidG5zWzFdICYmIGJ0bnNbMV0uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJmYi1kZWJ1Zy1ib3VuZCcgKSAhPT0gJzEnICkge1xyXG5cdFx0XHRcdFx0YnRuc1sxXS5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYmZiLWRlYnVnLWJvdW5kJywgJzEnICk7XHJcblx0XHRcdFx0XHRidG5zWzFdLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uICggZSApIHtcclxuXHRcdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdFx0XHRpbXBvcnRfZnJvbV90ZXh0YXJlYXMoICdzdHJ1Y3R1cmUnICk7XHJcblx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICggYnRuc1syXSAmJiBidG5zWzJdLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1iZmItZGVidWctYm91bmQnICkgIT09ICcxJyApIHtcclxuXHRcdFx0XHRcdGJ0bnNbMl0uc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJmYi1kZWJ1Zy1ib3VuZCcsICcxJyApO1xyXG5cdFx0XHRcdFx0YnRuc1syXS5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbiAoIGUgKSB7XHJcblx0XHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRcdFx0aW1wb3J0X2Zyb21fdGV4dGFyZWFzKCAnYm90aCcgKTtcclxuXHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggdGEuaWQgPT09ICd3cGJjX2JmYl9fc2V0dGluZ3NfaW1wb3J0JyApIHtcclxuXHRcdFx0XHRpZiAoIGJ0bnNbMV0gJiYgYnRuc1sxXS5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYmZiLWRlYnVnLWJvdW5kJyApICE9PSAnMScgKSB7XHJcblx0XHRcdFx0XHRidG5zWzFdLnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1iZmItZGVidWctYm91bmQnLCAnMScgKTtcclxuXHRcdFx0XHRcdGJ0bnNbMV0uYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgZnVuY3Rpb24gKCBlICkge1xyXG5cdFx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0XHRcdGltcG9ydF9mcm9tX3RleHRhcmVhcyggJ3NldHRpbmdzJyApO1xyXG5cdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoIGJ0bnNbMl0gJiYgYnRuc1syXS5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYmZiLWRlYnVnLWJvdW5kJyApICE9PSAnMScgKSB7XHJcblx0XHRcdFx0XHRidG5zWzJdLnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1iZmItZGVidWctYm91bmQnLCAnMScgKTtcclxuXHRcdFx0XHRcdGJ0bnNbMl0uYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgZnVuY3Rpb24gKCBlICkge1xyXG5cdFx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0XHRcdGltcG9ydF9mcm9tX3RleHRhcmVhcyggJ2JvdGgnICk7XHJcblx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFdpcmluZ1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0ZC5hZGRFdmVudExpc3RlbmVyKCAnRE9NQ29udGVudExvYWRlZCcsIGZ1bmN0aW9uICgpIHtcclxuXHRcdGJpbmRfZGVidWdfYnV0dG9uc19vbmNlKCk7XHJcblx0XHRzY2hlZHVsZV91cGRhdGUoKTtcclxuXHR9ICk7XHJcblxyXG5cdC8vIFJlZnJlc2ggd2hlbiBzd2l0Y2hpbmcgdG8gRGVidWcgdGFiIE9SIGRlYnVnIGludGVybmFsIHRhYnMuXHJcblx0ZC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzpiZmI6dG9wLXRhYicsIGZ1bmN0aW9uICggZXYgKSB7XHJcblx0XHRjb25zdCB0YWJfaWQgPSAoIGV2ICYmIGV2LmRldGFpbCAmJiBldi5kZXRhaWwudGFiICkgPyBTdHJpbmcoIGV2LmRldGFpbC50YWIgKSA6ICcnO1xyXG5cdFx0aWYgKCB0YWJfaWQgPT09ICdkZWJ1Z190YWInIHx8IHRhYl9pZC5pbmRleE9mKCAnZGVidWdfbW9kZV9fJyApID09PSAwICkge1xyXG5cdFx0XHRiaW5kX2RlYnVnX2J1dHRvbnNfb25jZSgpO1xyXG5cdFx0XHRzY2hlZHVsZV91cGRhdGUoKTtcclxuXHRcdH1cclxuXHR9ICk7XHJcblxyXG5cdC8vIEZhbGxiYWNrIGV2ZW50IChpZiB5b3Ugc3RpbGwgZGlzcGF0Y2ggaXQgc29tZXdoZXJlKS5cclxuXHRkLmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOmJmYjpzdHJ1Y3R1cmU6Y2hhbmdlJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0c2NoZWR1bGVfdXBkYXRlKCk7XHJcblx0fSApO1xyXG5cclxuXHQvLyBTZXR0aW5ncyBhcHBseS9jaGFuZ2VkIHNob3VsZCByZWZyZXNoIGRlYnVnIG91dHB1dC5cclxuXHRkLmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOmJmYjpmb3JtX3NldHRpbmdzOmFwcGx5JywgZnVuY3Rpb24gKCkge1xyXG5cdFx0c2NoZWR1bGVfdXBkYXRlKCk7XHJcblx0fSwgeyBwYXNzaXZlOiB0cnVlIH0gKTtcclxuXHJcblx0ZC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzpiZmI6Zm9ybV9zZXR0aW5nczpjaGFuZ2VkJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0c2NoZWR1bGVfdXBkYXRlKCk7XHJcblx0fSwgeyBwYXNzaXZlOiB0cnVlIH0gKTtcclxuXHJcblx0Ly8gTG93LWNvc3QgZmFsbGJhY2s6IHJlZnJlc2ggb24gYW55IGNoYW5nZSB0byBTTyBjb250cm9scyAoZGF0YS13cGJjLXUtc2F2ZS0qKS5cclxuXHRkLmFkZEV2ZW50TGlzdGVuZXIoXHJcblx0XHQnY2hhbmdlJyxcclxuXHRcdGZ1bmN0aW9uICggZSApIHtcclxuXHRcdFx0Y29uc3QgdCA9IGUgPyBlLnRhcmdldCA6IG51bGw7XHJcblx0XHRcdGlmICggISB0IHx8ICEgdC5nZXRBdHRyaWJ1dGUgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBhdHRycyA9IHQuYXR0cmlidXRlcyB8fCBudWxsO1xyXG5cdFx0XHRpZiAoICEgYXR0cnMgfHwgISBhdHRycy5sZW5ndGggKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRmb3IgKCBsZXQgaSA9IDA7IGkgPCBhdHRycy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0XHRjb25zdCBuID0gYXR0cnNbaV0gPyBTdHJpbmcoIGF0dHJzW2ldLm5hbWUgfHwgJycgKSA6ICcnO1xyXG5cdFx0XHRcdGlmICggbiAmJiBuLmluZGV4T2YoICdkYXRhLXdwYmMtdS1zYXZlLScgKSA9PT0gMCApIHtcclxuXHRcdFx0XHRcdHNjaGVkdWxlX3VwZGF0ZSgpO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSxcclxuXHRcdHsgcGFzc2l2ZTogdHJ1ZSB9XHJcblx0KTtcclxuXHJcblx0Ly8gUHJlZmVyIEV2ZW50QnVzIHdoZW4gYXZhaWxhYmxlLlxyXG5cdChmdW5jdGlvbiBob29rX2J1cygpIHtcclxuXHRcdGNvbnN0IENvcmUgPSB3LldQQkNfQkZCX0NvcmUgfHwge307XHJcblx0XHRjb25zdCBFViAgID0gQ29yZS5XUEJDX0JGQl9FdmVudHMgfHwgbnVsbDtcclxuXHJcblx0XHRpZiAoICEgRVYgfHwgISB3LndwYmNfYmZiX2FwaSB8fCAhIHcud3BiY19iZmJfYXBpLnJlYWR5ICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dy53cGJjX2JmYl9hcGkucmVhZHkudGhlbiggZnVuY3Rpb24gKCBidWlsZGVyICkge1xyXG5cdFx0XHRpZiAoICEgYnVpbGRlciB8fCAhIGJ1aWxkZXIuYnVzIHx8IHR5cGVvZiBidWlsZGVyLmJ1cy5vbiAhPT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdFtcclxuXHRcdFx0XHRFVi5TVFJVQ1RVUkVfQ0hBTkdFLFxyXG5cdFx0XHRcdEVWLkZJRUxEX0FERCxcclxuXHRcdFx0XHRFVi5GSUVMRF9SRU1PVkUsXHJcblx0XHRcdFx0RVYuU1RSVUNUVVJFX0xPQURFRFxyXG5cdFx0XHRdLmZpbHRlciggQm9vbGVhbiApLmZvckVhY2goIGZ1bmN0aW9uICggZXZlbnRfbmFtZSApIHtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0YnVpbGRlci5idXMub24oIGV2ZW50X25hbWUsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdFx0c2NoZWR1bGVfdXBkYXRlKCk7XHJcblx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0XHRpZiAoIHcuX3dwYmMgJiYgdy5fd3BiYy5kZXYgJiYgdHlwZW9mIHcuX3dwYmMuZGV2LmVycm9yID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHR3Ll93cGJjLmRldi5lcnJvciggJ2RlYnVnLXVpOiBidXMub24gZmFpbGVkJywgZXZlbnRfbmFtZSwgZSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdFx0fSApO1xyXG5cdH0pKCk7XHJcbn0pKCB3aW5kb3csIGRvY3VtZW50ICk7Il0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMsVUFBVUEsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7RUFDaEIsWUFBWTs7RUFFWjtFQUNBLElBQUtELENBQUMsQ0FBQ0UsMkJBQTJCLEtBQUssR0FBRyxFQUFHO0lBQzVDO0VBQ0Q7RUFDQUYsQ0FBQyxDQUFDRSwyQkFBMkIsR0FBRyxHQUFHO0VBRW5DLE1BQU1DLGNBQWMsR0FBRyw4QkFBOEI7RUFDckQsTUFBTUMsYUFBYSxHQUFJLG1DQUFtQztFQUUxRCxTQUFTQyxZQUFZQSxDQUFBLEVBQUc7SUFDdkIsT0FBTyxDQUFDLEVBQUlKLENBQUMsQ0FBQ0ssY0FBYyxDQUFFSCxjQUFlLENBQUMsSUFBSUYsQ0FBQyxDQUFDTSxhQUFhLENBQUVILGFBQWMsQ0FBQyxDQUFFO0VBQ3JGO0VBRUEsSUFBSyxDQUFFQyxZQUFZLENBQUMsQ0FBQyxFQUFHO0lBQ3ZCO0VBQ0Q7O0VBRUE7RUFDQTtFQUNBO0VBQ0EsU0FBU0csWUFBWUEsQ0FBRUMsR0FBRyxFQUFFQyxJQUFJLEVBQUVDLE9BQU8sRUFBRztJQUMzQyxNQUFNQyxDQUFDLEdBQUdDLE1BQU0sQ0FBRUosR0FBRyxJQUFJLEVBQUcsQ0FBQztJQUM3QixNQUFNSyxDQUFDLEdBQUdELE1BQU0sQ0FBRUgsSUFBSSxJQUFJLE1BQU8sQ0FBQztJQUVsQyxJQUFLLE9BQU9WLENBQUMsQ0FBQ2UsdUJBQXVCLEtBQUssVUFBVSxFQUFHO01B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
