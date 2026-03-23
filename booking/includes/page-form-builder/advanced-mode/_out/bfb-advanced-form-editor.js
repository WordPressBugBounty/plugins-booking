"use strict";

/*
 * Advanced Booking form mode.
 *
 * Refactored: module-style (DOM / State / Editor / Sync / Clipboard / Events / UI)
 *
 * @file ../includes/page-form-builder/advanced-mode/_out/bfb-advanced-form-editor.js
 */
(function (w, d) {
  'use strict';

  // True after wpbc:bfb:structure:loaded fired at least once.
  var structure_loaded_once = false;
  function adapted_has_any_field(adapted) {
    if (!adapted || !Array.isArray(adapted.pages)) {
      return false;
    }
    var has = false;
    function walk_section(sec) {
      if (has || !sec) {
        return;
      }
      var cols = Array.isArray(sec.columns) ? sec.columns : [];
      for (var i = 0; i < cols.length; i++) {
        var col = cols[i] || {};
        if (Array.isArray(col.fields) && col.fields.length) {
          has = true;
          return;
        }
        var nested = Array.isArray(col.sections) ? col.sections : [];
        for (var j = 0; j < nested.length; j++) {
          walk_section(nested[j]);
          if (has) {
            return;
          }
        }
      }
    }
    for (var p = 0; p < adapted.pages.length; p++) {
      var page = adapted.pages[p] || {};
      var items = Array.isArray(page.items) ? page.items : [];
      for (var k = 0; k < items.length; k++) {
        var it = items[k] || {};
        if (it.kind === 'field') {
          return true;
        }
        if (it.kind === 'section') {
          walk_section(it.data);
          if (has) {
            return true;
          }
        }
      }
    }
    return has;
  }

  // ==  Constants  ==================================================================================================
  var IDS = {
    panels: 'wpbc_bfb__advanced_mode_panels',
    ta_form: 'wpbc_bfb__advanced_form_editor',
    ta_content: 'wpbc_bfb__content_form_editor',
    btn_regen: 'wpbc_bfb__advanced_regenerate_btn',
    btn_copy_form: 'wpbc_bfb__advanced_copy_form_btn',
    btn_copy_cnt: 'wpbc_bfb__advanced_copy_content_btn',
    cb_autosync: 'wpbc_bfb__advanced_autosync',
    dirty_hint: 'wpbc_bfb__advanced_dirty_hint'
  };
  var KEY = {
    FORM: 'advanced_form',
    CONTENT: 'content_form'
  };
  var TA_ID_BY_KEY = {};
  TA_ID_BY_KEY[KEY.FORM] = IDS.ta_form;
  TA_ID_BY_KEY[KEY.CONTENT] = IDS.ta_content;

  // ==  DOM helpers  ================================================================================================
  var DOM = function () {
    function get_by_id(id) {
      return d.getElementById(id);
    }
    function on(el, type, fn) {
      if (el) {
        el.addEventListener(type, fn);
      }
    }
    function is_advanced_ui_present() {
      return !!d.querySelector('#' + IDS.panels);
    }
    return {
      get: get_by_id,
      on: on,
      has_ui: is_advanced_ui_present
    };
  }();

  // ==  State  ======================================================================================================
  var State = function () {
    var state = {
      editors: {},
      // key -> wp.codeEditor instance (or null)
      autosync_user_value: null,
      // null = not decided by user, boolean = user explicitly set
      sync_state_bootstrapped: false,
      is_dirty: false,
      is_programmatic_update: false,
      is_inited: false,
      textarea_fallback_bound: false
    };
    state.editors[KEY.FORM] = null;
    state.editors[KEY.CONTENT] = null;
    function set_live_badges() {
      var cb = DOM.get(IDS.cb_autosync);
      var sync_on = !!(cb && cb.checked);
      var live = sync_on && !state.is_dirty ? 'builder' : 'advanced';
      var root = d.documentElement;
      if (!root) {
        return;
      }
      root.setAttribute('data-wpbc-bfb-live-source', live === 'builder' ? 'builder' : 'advanced');
      root.setAttribute('data-wpbc-bfb-sync-mode', sync_on ? 'on' : 'off');
    }
    function set_dirty(on) {
      state.is_dirty = !!on;
      var hint = DOM.get(IDS.dirty_hint);
      if (hint) {
        hint.style.display = state.is_dirty ? 'inline' : 'none';
      }
      var autosync = DOM.get(IDS.cb_autosync);
      if (state.is_dirty) {
        // User edited Advanced => explicit opt-out of autosync for this session.
        state.autosync_user_value = false;
        state.sync_state_bootstrapped = true;
        if (autosync) {
          autosync.checked = false;
        }
      } else {
        // IMPORTANT:
        // When clearing dirty state, do NOT force autosync checkbox ON.
        // Checkbox state is controlled by:
        // - user action (cb change)
        // - Sync.apply_autosync_state() when autosync_user_value === null
      }
      set_live_badges();
    }
    function is_autosync_on() {
      var cb = DOM.get(IDS.cb_autosync);
      return !!(cb && cb.checked && !state.is_dirty);
    }
    return {
      raw: state,
      set_dirty: set_dirty,
      is_autosync_on: is_autosync_on,
      update_badges: set_live_badges
    };
  }();

  // ==  Editor (CodeMirror + textarea fallback + shortcode highlighting mode)  ======================================
  var Editor = function () {
    var is_oshortcode_defined = false;
    function can_init_codemirror() {
      var wpns = w.wp || null;
      return !!(wpns && wpns.codeEditor && typeof wpns.codeEditor.initialize === 'function' && w.wpbc_bfb_code_editor_settings);
    }
    function ensure_oshortcode_mode() {
      if (is_oshortcode_defined) {
        return;
      }
      var CM = w.wp && w.wp.CodeMirror ? w.wp.CodeMirror : null;
      if (!CM || typeof CM.defineMode !== 'function') {
        return;
      }
      CM.defineMode('oshortcode', function (config, parserConfig) {
        var overlay = {
          token: function (stream) {
            var ch;

            // [name ...] or [name* ...]
            if (stream.match(/^\[([a-zA-Z0-9_]+)\*?\s?/)) {
              while ((ch = stream.next()) != null) {
                if (ch === ']') {
                  return 'oshortcode';
                }
              }
            }
            while (stream.next() != null && !stream.match(/^\[([a-zA-Z0-9_]+)\*?\s?/, false)) {}
            return null;
          }
        };
        var base = CM.getMode(config, parserConfig && parserConfig.backdrop || 'htmlmixed');

        // Fallback if overlay addon is missing.
        if (typeof CM.overlayMode !== 'function') {
          return base;
        }
        return CM.overlayMode(base, overlay);
      });
      is_oshortcode_defined = true;
    }
    function bind_textarea_dirty_fallback() {
      if (State.raw.textarea_fallback_bound) {
        return;
      }
      var ta_form = DOM.get(IDS.ta_form);
      var ta_cnt = DOM.get(IDS.ta_content);
      if (!ta_form || !ta_cnt) {
        return;
      }
      function on_change() {
        if (State.raw.is_programmatic_update) {
          return;
        }
        State.set_dirty(true);
      }
      ta_form.addEventListener('input', on_change);
      ta_form.addEventListener('change', on_change);
      ta_cnt.addEventListener('input', on_change);
      ta_cnt.addEventListener('change', on_change);
      State.raw.textarea_fallback_bound = true;
    }
    function init_editor(textarea_el, key) {
      var wpns = w.wp || null;
      if (!textarea_el || !wpns || !wpns.codeEditor || typeof wpns.codeEditor.initialize !== 'function') {
        return null;
      }
      var base = w.wpbc_bfb_code_editor_settings || null;
      if (!base) {
        return null;
      }
      ensure_oshortcode_mode();

      // Clone so we don't mutate localized shared settings object.
      var settings = Object.assign({}, base);
      settings.codemirror = Object.assign({}, base.codemirror || {});
      settings.codemirror.mode = 'oshortcode';
      var inst = wpns.codeEditor.initialize(textarea_el, settings);
      if (inst && inst.codemirror) {
        inst.codemirror.on('change', function () {
          if (State.raw.is_programmatic_update) {
            return;
          }
          State.set_dirty(true);
        });
      }
      State.raw.editors[key] = inst;
      return inst;
    }
    function ensure_inited() {
      if (State.raw.is_inited) {
        return true;
      }
      var ta_form = DOM.get(IDS.ta_form);
      var ta_cnt = DOM.get(IDS.ta_content);
      if (!ta_form || !ta_cnt) {
        return false;
      }
      bind_textarea_dirty_fallback();
      if (can_init_codemirror()) {
        var i1 = init_editor(ta_form, KEY.FORM);
        var i2 = init_editor(ta_cnt, KEY.CONTENT);
        if (!i1) {
          State.raw.editors[KEY.FORM] = null;
        }
        if (!i2) {
          State.raw.editors[KEY.CONTENT] = null;
        }
      }
      State.raw.is_inited = true;
      return true;
    }
    function refresh_all() {
      var keys = Object.keys(State.raw.editors);
      for (var i = 0; i < keys.length; i++) {
        var inst = State.raw.editors[keys[i]];
        try {
          if (inst && inst.codemirror && typeof inst.codemirror.refresh === 'function') {
            inst.codemirror.refresh();
          }
        } catch (e) {}
      }
    }
    function textarea_id_for(key) {
      return TA_ID_BY_KEY[key] || '';
    }
    function get_value(key) {
      var inst = State.raw.editors[key];
      if (inst && inst.codemirror && typeof inst.codemirror.getValue === 'function') {
        return String(inst.codemirror.getValue() || '');
      }
      var ta = DOM.get(textarea_id_for(key));
      return ta ? String(ta.value || '') : '';
    }
    function set_value(key, value) {
      value = value == null ? '' : String(value);
      var ta = DOM.get(textarea_id_for(key));
      State.raw.is_programmatic_update = true;
      try {
        if (ta) {
          ta.value = value;
        }
        var inst = State.raw.editors[key];
        if (inst && inst.codemirror && typeof inst.codemirror.setValue === 'function') {
          inst.codemirror.setValue(value);
          if (typeof inst.codemirror.save === 'function') {
            inst.codemirror.save();
          }
        }
      } finally {
        State.raw.is_programmatic_update = false;
      }
    }
    function focus_and_select(key) {
      var ta = DOM.get(textarea_id_for(key));
      if (!ta) {
        return;
      }
      try {
        ta.focus();
        ta.select();
      } catch (e) {}
    }
    function save_all_to_textareas() {
      var keys = Object.keys(State.raw.editors);
      for (var i = 0; i < keys.length; i++) {
        var inst = State.raw.editors[keys[i]];
        try {
          if (inst && inst.codemirror && typeof inst.codemirror.save === 'function') {
            inst.codemirror.save();
          }
        } catch (e) {}
      }
    }
    return {
      ensure_inited: ensure_inited,
      refresh_all: refresh_all,
      get_value: get_value,
      set_value: set_value,
      focus_select: focus_and_select,
      save_all: save_all_to_textareas
    };
  }();

  // ==  Builder export + Sync  ======================================================================================
  var Sync = function () {
    var poll_timer_id = null;
    var debounce_timer_id = null;
    function can_export_from_builder() {
      return !!(w.wpbc_bfb && typeof w.wpbc_bfb.get_structure === 'function' && w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.export_all === 'function');
    }
    function get_current_structure() {
      return w.wpbc_bfb && typeof w.wpbc_bfb.get_structure === 'function' ? w.wpbc_bfb.get_structure() : [];
    }
    function export_all_from_builder() {
      if (!w.WPBC_BFB_Exporter || typeof w.WPBC_BFB_Exporter.export_all !== 'function') {
        return null;
      }
      try {
        return w.WPBC_BFB_Exporter.export_all(get_current_structure(), {
          gapPercent: 3
        });
      } catch (e) {
        return null;
      }
    }
    function export_output_looks_ready(out) {
      if (!out) {
        return false;
      }
      var af = out.advanced_form == null ? '' : String(out.advanced_form);
      var cf = out.fields_data == null ? '' : String(out.fields_data);
      af = af.trim();
      cf = cf.trim();
      if (!af && !cf) {
        return false;
      }

      // If structure is loaded and there are NO fields, accept empty export.
      if (structure_loaded_once && !adapted_has_any_field(out.adapted)) {
        return true;
      }

      // Real BFB export includes layout tags (<r>, <c>, <item>).
      var has_layout_tags = /<\s*(r|c|item)\b/i.test(af) || /<\s*(r|c|item)\b/i.test(cf);
      var has_any_item = /<\s*item\b/i.test(af) || /<\s*item\b/i.test(cf);
      return has_layout_tags && has_any_item;
    }
    function get_builder_export_if_ready() {
      if (!can_export_from_builder()) {
        return null;
      }
      var out = export_all_from_builder();
      if (!out) {
        return null;
      }
      if (!export_output_looks_ready(out)) {
        return null;
      }
      return out;
    }

    // --- Normalization for compare -------------------------------------------------------
    function normalize_style_value(css) {
      css = css == null ? '' : String(css);
      css = css.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      css = css.replace(/\t/g, ' ');
      css = css.replace(/\s+/g, ' ');
      css = css.replace(/\s*;\s*/g, ';');
      css = css.replace(/\s*:\s*/g, ':');
      css = css.trim().replace(/;+\s*$/g, '');
      if (css !== '') {
        css += ';';
      }
      return css;
    }
    function normalize_inline_styles_in_markup(html) {
      html = html == null ? '' : String(html);
      return html.replace(/\bstyle=(["'])(.*?)\1/gi, function (_m, quote, css) {
        return 'style=' + quote + normalize_style_value(css) + quote;
      });
    }
    function normalize_text(s) {
      s = s == null ? '' : String(s);
      s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      s = normalize_inline_styles_in_markup(s);
      s = s.replace(/[ \t]+$/gm, '');
      s = s.replace(/[ ]{2,}/g, ' ');
      s = s.replace(/^\s+/gm, '');
      s = s.replace(/\n{3,}/g, '\n\n');
      return s.trim();
    }
    function get_current_advanced_texts() {
      return {
        advanced_form: Editor.get_value(KEY.FORM),
        content_form: Editor.get_value(KEY.CONTENT)
      };
    }
    function detect_sync_state_with_export() {
      var out = get_builder_export_if_ready();
      if (!out) {
        return null;
      }
      var cur = get_current_advanced_texts();
      var a1 = normalize_text(cur.advanced_form);
      var a2 = normalize_text(cur.content_form);
      var b1 = normalize_text(out.advanced_form || '');
      var b2 = normalize_text(out.fields_data || '');
      return {
        is_synced: a1 === b1 && a2 === b2,
        out: out
      };
    }
    function apply_autosync_from_sync_state(is_synced) {
      var cb = DOM.get(IDS.cb_autosync);
      if (!cb) {
        return;
      }
      if (State.raw.is_dirty) {
        State.raw.autosync_user_value = false;
        State.raw.sync_state_bootstrapped = true;
        cb.checked = false;
        State.update_badges();
        return;
      }

      // Only auto-set checkbox if user never explicitly touched it.
      if (State.raw.autosync_user_value === null) {
        cb.checked = !!is_synced;
      }
      State.raw.sync_state_bootstrapped = true;
      State.update_badges();
    }
    function regenerate_from_builder(out_opt) {
      var out = out_opt || get_builder_export_if_ready();
      if (!out) {
        return false;
      }
      Editor.set_value(KEY.FORM, out.advanced_form || '');
      Editor.set_value(KEY.CONTENT, out.fields_data || '');
      State.set_dirty(false);
      State.update_badges();
      return true;
    }
    function sync_detect_and_apply() {
      var res = detect_sync_state_with_export();
      if (res === null) {
        return false;
      }
      var cb = DOM.get(IDS.cb_autosync);
      var sync_on = !!(cb && cb.checked);
      State.raw.sync_state_bootstrapped = true;
      if (State.raw.is_dirty) {
        apply_autosync_from_sync_state(false);
        return true;
      }
      if (sync_on) {
        if (!res.is_synced) {
          regenerate_from_builder(res.out);
        } else {
          State.update_badges();
        }
        return true;
      }
      apply_autosync_from_sync_state(res.is_synced);
      return true;
    }

    // --- Poll / debounce -------------------------------------------------------
    function schedule_sync_detect(reason) {
      if (poll_timer_id) {
        clearTimeout(poll_timer_id);
        poll_timer_id = null;
      }
      var started_ms = Date.now();
      var max_total_ms = 12000;
      var delay_ms = 150;
      (function tick() {
        if (!DOM.has_ui()) {
          poll_timer_id = null;
          return;
        }
        Editor.ensure_inited();
        if (State.raw.is_dirty) {
          apply_autosync_from_sync_state(false);
          poll_timer_id = null;
          return;
        }
        if (sync_detect_and_apply()) {
          poll_timer_id = null;
          return;
        }
        if (Date.now() - started_ms < max_total_ms) {
          delay_ms = Math.min(600, Math.floor(delay_ms * 1.25));
          poll_timer_id = setTimeout(tick, delay_ms);
          return;
        }
        poll_timer_id = null;
      })();
    }
    function schedule_sync_detect_debounced(reason) {
      if (debounce_timer_id) {
        clearTimeout(debounce_timer_id);
      }
      debounce_timer_id = setTimeout(function () {
        debounce_timer_id = null;
        schedule_sync_detect(reason);
      }, 250);
    }
    return {
      schedule_detect: schedule_sync_detect,
      schedule_detect_debounced: schedule_sync_detect_debounced,
      regenerate: regenerate_from_builder,
      apply_autosync_state: apply_autosync_from_sync_state
    };
  }();

  // ==  Clipboard  ==================================================================================================
  var Clipboard = function () {
    async function copy_text(text) {
      text = text == null ? '' : String(text);
      if (typeof w.wpbc_copy_to_clipboard === 'function') {
        try {
          return await w.wpbc_copy_to_clipboard(text);
        } catch (e) {}
      }
      try {
        if (w.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (e) {}
      try {
        var ta = d.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        ta.style.opacity = '0';
        d.body.appendChild(ta);
        ta.focus();
        ta.select();
        var ok = d.execCommand('copy');
        d.body.removeChild(ta);
        return !!ok;
      } catch (e) {
        return false;
      }
    }
    function feedback_button(btn, ok) {
      if (!btn) {
        return;
      }
      var original = btn.getAttribute('data-wpbc-original-text') || btn.textContent;
      btn.setAttribute('data-wpbc-original-text', original);
      btn.textContent = ok ? 'Copied!' : 'Press Ctrl/Cmd+C to copy';
      setTimeout(function () {
        btn.textContent = original;
      }, 1500);
    }
    async function copy_editor_value(key, btn) {
      Editor.ensure_inited();
      var ok = await copy_text(Editor.get_value(key));
      if (!ok) {
        Editor.focus_select(key);
      }
      feedback_button(btn, ok);
    }
    return {
      copy_editor_value: copy_editor_value
    };
  }();

  // ==  UI bindings
  var UI = function () {
    function bind_ui() {
      DOM.on(DOM.get(IDS.btn_regen), 'click', function (e) {
        e.preventDefault();
        Editor.ensure_inited();
        Sync.regenerate();
        Editor.refresh_all();

        // Safe default until we can confirm sync state.
        var cb = DOM.get(IDS.cb_autosync);
        if (cb) {
          cb.checked = true;
          State.update_badges();
        }
      });
      DOM.on(DOM.get(IDS.cb_autosync), 'change', function () {
        var cb = DOM.get(IDS.cb_autosync);
        if (!cb) {
          return;
        }
        State.raw.autosync_user_value = !!cb.checked; // explicit user choice
        State.raw.sync_state_bootstrapped = true;
        if (cb.checked) {
          State.set_dirty(false);
          Editor.ensure_inited();
          if (!Sync.regenerate()) {
            Sync.schedule_detect('autosync_user_on_wait_ready');
          }
          Editor.refresh_all();
        }
        State.update_badges();
      });
      DOM.on(DOM.get(IDS.btn_copy_form), 'click', function (e) {
        e.preventDefault();
        Clipboard.copy_editor_value(KEY.FORM, DOM.get(IDS.btn_copy_form));
      });
      DOM.on(DOM.get(IDS.btn_copy_cnt), 'click', function (e) {
        e.preventDefault();
        Clipboard.copy_editor_value(KEY.CONTENT, DOM.get(IDS.btn_copy_cnt));
      });
    }
    return {
      bind: bind_ui
    };
  }();

  // ==  WP / Builder events  ========================================================================================
  var Events = function () {
    function hook_events() {
      /**
       * Infer apply source without relying on any "advanced_source" key.
       *
       * Returns:
       * - 'builder'  : if texts match current Builder export (when export is ready)
       * - 'advanced' : if texts do not match Builder export (but have any content)
       * - 'auto'     : if Builder export is not available/ready (safe default)
       *
       * @param {string} af
       * @param {string} cf
       * @return {'builder'|'advanced'|'auto'}
       */
      function infer_apply_source(af, cf) {
        af = af == null ? '' : String(af);
        cf = cf == null ? '' : String(cf);
        function has_text(v) {
          return !!(v && String(v).trim());
        }
        function normalize_style_value(css) {
          css = css == null ? '' : String(css);
          css = css.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          css = css.replace(/\t/g, ' ');
          css = css.replace(/\s+/g, ' ');

          // Normalize spacing around separators.
          css = css.replace(/\s*;\s*/g, ';');
          css = css.replace(/\s*:\s*/g, ':');

          // Ensure stable trailing semicolon (important for compare).
          css = css.trim().replace(/;+\s*$/g, '');
          if (css !== '') {
            css += ';';
          }
          return css;
        }
        function normalize_inline_styles_in_markup(html) {
          html = html == null ? '' : String(html);

          // Handles: style="..." and style='...' (with optional spaces around '=')
          return html.replace(/\bstyle\s*=\s*(["'])(.*?)\1/gi, function (_m, quote, css) {
            return 'style=' + quote + normalize_style_value(css) + quote;
          });
        }
        function normalize_text(s) {
          s = s == null ? '' : String(s);
          s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

          // IMPORTANT: normalize inline styles so "flex:1" == "flex:1;"
          s = normalize_inline_styles_in_markup(s);
          s = s.replace(/[ \t]+$/gm, '');
          s = s.replace(/[ ]{2,}/g, ' ');
          s = s.replace(/^\s+/gm, '');
          s = s.replace(/\n{3,}/g, '\n\n');
          return s.trim();
        }
        function export_output_looks_ready(out) {
          if (!out) return false;
          var a = normalize_text(out.advanced_form || '');
          var b = normalize_text(out.fields_data || '');
          if (!a && !b) return false;
          // If structure is loaded and there are NO fields, accept empty export.
          if (structure_loaded_once && !adapted_has_any_field(out.adapted)) {
            return true;
          }
          // Expect layout tags to exist in real export.
          var has_layout_tags = /<\s*(r|c|item)\b/i.test(a) || /<\s*(r|c|item)\b/i.test(b);
          var has_any_item = /<\s*item\b/i.test(a) || /<\s*item\b/i.test(b);
          return has_layout_tags && has_any_item;
        }
        function try_get_builder_export() {
          try {
            if (!w.wpbc_bfb || typeof w.wpbc_bfb.get_structure !== 'function' || !w.WPBC_BFB_Exporter || typeof w.WPBC_BFB_Exporter.export_all !== 'function') {
              return null;
            }
            var out = w.WPBC_BFB_Exporter.export_all(w.wpbc_bfb.get_structure(), {
              gapPercent: 3
            });
            if (!export_output_looks_ready(out)) {
              return null;
            }
            return out;
          } catch (_e) {
            return null;
          }
        }
        var out = try_get_builder_export();
        if (!out) {
          return 'auto';
        }
        var in_af = normalize_text(af);
        var in_cf = normalize_text(cf);
        var ex_af = normalize_text(out.advanced_form || '');
        var ex_cf = normalize_text(out.fields_data || '');
        if (in_af === ex_af && in_cf === ex_cf) {
          return 'builder';
        }
        if (has_text(af) || has_text(cf)) {
          return 'advanced';
        }
        return 'auto';
      }
      d.addEventListener('wpbc:bfb:structure:change', function () {
        if (!Editor.ensure_inited()) {
          return;
        }
        if (State.raw.is_dirty) {
          return;
        }
        if (State.raw.autosync_user_value === false) {
          return;
        }
        var cb = DOM.get(IDS.cb_autosync);
        if (!cb) {
          return;
        }
        if (!State.raw.sync_state_bootstrapped) {
          Sync.schedule_detect_debounced('structure_change_pre_bootstrap');
          return;
        }
        Sync.schedule_detect_debounced('structure_change');
      });
      d.addEventListener('wpbc:bfb:structure:loaded', function () {
        structure_loaded_once = true;
        Sync.schedule_detect('structure_loaded');
      });
      d.addEventListener('wpbc:bfb:top-tab', function (ev) {
        var tab_id = ev && ev.detail && ev.detail.tab ? String(ev.detail.tab) : '';
        var is_inner = tab_id === 'advanced_mode__booking_form' || tab_id === 'advanced_mode__booking_data';

        // Entering Advanced Mode (root tab) or switching inner tabs.
        if (tab_id !== 'advanced_tab' && !is_inner) {
          return;
        }
        if (!Editor.ensure_inited()) {
          return;
        }
        if (State.is_autosync_on()) {
          if (!Sync.regenerate()) {
            Sync.schedule_detect('top_tab_wait_ready');
          }
        }
        setTimeout(Editor.refresh_all, 60);
        if (tab_id === 'advanced_mode__booking_data') {
          setTimeout(Editor.refresh_all, 120);
        }
      });
      d.addEventListener('wpbc:bfb:advanced_text:apply', function (ev) {
        var det = ev && ev.detail ? ev.detail : {};
        var af = det.advanced_form == null ? '' : String(det.advanced_form);
        var cf = det.content_form == null ? '' : String(det.content_form);
        var src = String(det.advanced_mode_source || 'auto').toLowerCase(); // builder|advanced|auto.
        if (src !== 'builder' && src !== 'advanced' && src !== 'auto') {
          src = 'auto';
        }
        if (src === 'auto') {
          src = infer_apply_source(af, cf); // builder|advanced|auto.
        }
        var cb = DOM.get(IDS.cb_autosync);

        // Always use Editor API (keeps textarea + CodeMirror in sync).
        Editor.ensure_inited();
        Editor.set_value(KEY.FORM, af);
        Editor.set_value(KEY.CONTENT, cf);
        setTimeout(Editor.refresh_all, 60);
        if (src === 'advanced') {
          // Advanced is authoritative => dirty + autosync OFF.
          if (cb) {
            cb.checked = false;
          }
          State.set_dirty(true); // also sets autosync_user_value=false and bootstrapped=true .
        } else if (src === 'builder') {
          // Builder is authoritative => autosync ON.
          if (cb) {
            cb.checked = true;
          }
          State.raw.autosync_user_value = true;
          State.raw.sync_state_bootstrapped = true;
          State.set_dirty(false);
        } else {
          // auto/unknown:  Safe default = autosync OFF until we confirm real sync state.  This prevents Preview using Builder before export is ready / comparison is done.
          if (cb) {
            cb.checked = false;
          }
          State.raw.autosync_user_value = null;
          State.raw.sync_state_bootstrapped = false;
          State.set_dirty(false);
        }
        State.update_badges();
        Sync.schedule_detect('advanced_text_apply');
      });
    }
    return {
      hook: hook_events
    };
  }();

  // == Public API (unchanged)  ======================================================================================
  w.wpbc_bfb_advanced_editor_api = w.wpbc_bfb_advanced_editor_api || {};
  w.wpbc_bfb_advanced_editor_api.get_values = function () {
    // Ensure CodeMirror is ready (if enabled).
    Editor.ensure_inited();

    // Push CodeMirror -> textarea (no-op if not inited).
    Editor.save_all();

    // In your system, "manual mode" (autosync OFF) must be treated as "use Advanced".
    var use_advanced = !!State.raw.is_dirty || !State.is_autosync_on();
    return {
      advanced_form: Editor.get_value(KEY.FORM),
      content_form: Editor.get_value(KEY.CONTENT),
      is_dirty: use_advanced
    };
  };
  w.wpbc_bfb_advanced_editor_api.set_dirty = function (state) {
    State.set_dirty(!!state);
  };

  // ==  Boot  =======================================================================================================
  d.addEventListener('DOMContentLoaded', function () {
    UI.bind();
    Events.hook();
    if (DOM.has_ui()) {
      Editor.ensure_inited();
      setTimeout(Editor.refresh_all, 60);

      // Safe default until we can confirm sync state.
      var cb = DOM.get(IDS.cb_autosync);
      if (cb && State.raw.autosync_user_value === null && !State.raw.sync_state_bootstrapped) {
        cb.checked = false;
        State.update_badges();
      }
    }

    // Initial autosync checkbox state (based on real sync status).
    Sync.schedule_detect('boot');
  });
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvYWR2YW5jZWQtbW9kZS9fb3V0L2JmYi1hZHZhbmNlZC1mb3JtLWVkaXRvci5qcyIsIm5hbWVzIjpbInciLCJkIiwic3RydWN0dXJlX2xvYWRlZF9vbmNlIiwiYWRhcHRlZF9oYXNfYW55X2ZpZWxkIiwiYWRhcHRlZCIsIkFycmF5IiwiaXNBcnJheSIsInBhZ2VzIiwiaGFzIiwid2Fsa19zZWN0aW9uIiwic2VjIiwiY29scyIsImNvbHVtbnMiLCJpIiwibGVuZ3RoIiwiY29sIiwiZmllbGRzIiwibmVzdGVkIiwic2VjdGlvbnMiLCJqIiwicCIsInBhZ2UiLCJpdGVtcyIsImsiLCJpdCIsImtpbmQiLCJkYXRhIiwiSURTIiwicGFuZWxzIiwidGFfZm9ybSIsInRhX2NvbnRlbnQiLCJidG5fcmVnZW4iLCJidG5fY29weV9mb3JtIiwiYnRuX2NvcHlfY250IiwiY2JfYXV0b3N5bmMiLCJkaXJ0eV9oaW50IiwiS0VZIiwiRk9STSIsIkNPTlRFTlQiLCJUQV9JRF9CWV9LRVkiLCJET00iLCJnZXRfYnlfaWQiLCJpZCIsImdldEVsZW1lbnRCeUlkIiwib24iLCJlbCIsInR5cGUiLCJmbiIsImFkZEV2ZW50TGlzdGVuZXIiLCJpc19hZHZhbmNlZF91aV9wcmVzZW50IiwicXVlcnlTZWxlY3RvciIsImdldCIsImhhc191aSIsIlN0YXRlIiwic3RhdGUiLCJlZGl0b3JzIiwiYXV0b3N5bmNfdXNlcl92YWx1ZSIsInN5bmNfc3RhdGVfYm9vdHN0cmFwcGVkIiwiaXNfZGlydHkiLCJpc19wcm9ncmFtbWF0aWNfdXBkYXRlIiwiaXNfaW5pdGVkIiwidGV4dGFyZWFfZmFsbGJhY2tfYm91bmQiLCJzZXRfbGl2ZV9iYWRnZXMiLCJjYiIsInN5bmNfb24iLCJjaGVja2VkIiwibGl2ZSIsInJvb3QiLCJkb2N1bWVudEVsZW1lbnQiLCJzZXRBdHRyaWJ1dGUiLCJzZXRfZGlydHkiLCJoaW50Iiwic3R5bGUiLCJkaXNwbGF5IiwiYXV0b3N5bmMiLCJpc19hdXRvc3luY19vbiIsInJhdyIsInVwZGF0ZV9iYWRnZXMiLCJFZGl0b3IiLCJpc19vc2hvcnRjb2RlX2RlZmluZWQiLCJjYW5faW5pdF9jb2RlbWlycm9yIiwid3BucyIsIndwIiwiY29kZUVkaXRvciIsImluaXRpYWxpemUiLCJ3cGJjX2JmYl9jb2RlX2VkaXRvcl9zZXR0aW5ncyIsImVuc3VyZV9vc2hvcnRjb2RlX21vZGUiLCJDTSIsIkNvZGVNaXJyb3IiLCJkZWZpbmVNb2RlIiwiY29uZmlnIiwicGFyc2VyQ29uZmlnIiwib3ZlcmxheSIsInRva2VuIiwic3RyZWFtIiwiY2giLCJtYXRjaCIsIm5leHQiLCJiYXNlIiwiZ2V0TW9kZSIsImJhY2tkcm9wIiwib3ZlcmxheU1vZGUiLCJiaW5kX3RleHRhcmVhX2RpcnR5X2ZhbGxiYWNrIiwidGFfY250Iiwib25fY2hhbmdlIiwiaW5pdF9lZGl0b3IiLCJ0ZXh0YXJlYV9lbCIsImtleSIsInNldHRpbmdzIiwiT2JqZWN0IiwiYXNzaWduIiwiY29kZW1pcnJvciIsIm1vZGUiLCJpbnN0IiwiZW5zdXJlX2luaXRlZCIsImkxIiwiaTIiLCJyZWZyZXNoX2FsbCIsImtleXMiLCJyZWZyZXNoIiwiZSIsInRleHRhcmVhX2lkX2ZvciIsImdldF92YWx1ZSIsImdldFZhbHVlIiwiU3RyaW5nIiwidGEiLCJ2YWx1ZSIsInNldF92YWx1ZSIsInNldFZhbHVlIiwic2F2ZSIsImZvY3VzX2FuZF9zZWxlY3QiLCJmb2N1cyIsInNlbGVjdCIsInNhdmVfYWxsX3RvX3RleHRhcmVhcyIsImZvY3VzX3NlbGVjdCIsInNhdmVfYWxsIiwiU3luYyIsInBvbGxfdGltZXJfaWQiLCJkZWJvdW5jZV90aW1lcl9pZCIsImNhbl9leHBvcnRfZnJvbV9idWlsZGVyIiwid3BiY19iZmIiLCJnZXRfc3RydWN0dXJlIiwiV1BCQ19CRkJfRXhwb3J0ZXIiLCJleHBvcnRfYWxsIiwiZ2V0X2N1cnJlbnRfc3RydWN0dXJlIiwiZXhwb3J0X2FsbF9mcm9tX2J1aWxkZXIiLCJnYXBQZXJjZW50IiwiZXhwb3J0X291dHB1dF9sb29rc19yZWFkeSIsIm91dCIsImFmIiwiYWR2YW5jZWRfZm9ybSIsImNmIiwiZmllbGRzX2RhdGEiLCJ0cmltIiwiaGFzX2xheW91dF90YWdzIiwidGVzdCIsImhhc19hbnlfaXRlbSIsImdldF9idWlsZGVyX2V4cG9ydF9pZl9yZWFkeSIsIm5vcm1hbGl6ZV9zdHlsZV92YWx1ZSIsImNzcyIsInJlcGxhY2UiLCJub3JtYWxpemVfaW5saW5lX3N0eWxlc19pbl9tYXJrdXAiLCJodG1sIiwiX20iLCJxdW90ZSIsIm5vcm1hbGl6ZV90ZXh0IiwicyIsImdldF9jdXJyZW50X2FkdmFuY2VkX3RleHRzIiwiY29udGVudF9mb3JtIiwiZGV0ZWN0X3N5bmNfc3RhdGVfd2l0aF9leHBvcnQiLCJjdXIiLCJhMSIsImEyIiwiYjEiLCJiMiIsImlzX3N5bmNlZCIsImFwcGx5X2F1dG9zeW5jX2Zyb21fc3luY19zdGF0ZSIsInJlZ2VuZXJhdGVfZnJvbV9idWlsZGVyIiwib3V0X29wdCIsInN5bmNfZGV0ZWN0X2FuZF9hcHBseSIsInJlcyIsInNjaGVkdWxlX3N5bmNfZGV0ZWN0IiwicmVhc29uIiwiY2xlYXJUaW1lb3V0Iiwic3RhcnRlZF9tcyIsIkRhdGUiLCJub3ciLCJtYXhfdG90YWxfbXMiLCJkZWxheV9tcyIsInRpY2siLCJNYXRoIiwibWluIiwiZmxvb3IiLCJzZXRUaW1lb3V0Iiwic2NoZWR1bGVfc3luY19kZXRlY3RfZGVib3VuY2VkIiwic2NoZWR1bGVfZGV0ZWN0Iiwic2NoZWR1bGVfZGV0ZWN0X2RlYm91bmNlZCIsInJlZ2VuZXJhdGUiLCJhcHBseV9hdXRvc3luY19zdGF0ZSIsIkNsaXBib2FyZCIsImNvcHlfdGV4dCIsInRleHQiLCJ3cGJjX2NvcHlfdG9fY2xpcGJvYXJkIiwiaXNTZWN1cmVDb250ZXh0IiwibmF2aWdhdG9yIiwiY2xpcGJvYXJkIiwid3JpdGVUZXh0IiwiY3JlYXRlRWxlbWVudCIsInBvc2l0aW9uIiwidG9wIiwib3BhY2l0eSIsImJvZHkiLCJhcHBlbmRDaGlsZCIsIm9rIiwiZXhlY0NvbW1hbmQiLCJyZW1vdmVDaGlsZCIsImZlZWRiYWNrX2J1dHRvbiIsImJ0biIsIm9yaWdpbmFsIiwiZ2V0QXR0cmlidXRlIiwidGV4dENvbnRlbnQiLCJjb3B5X2VkaXRvcl92YWx1ZSIsIlVJIiwiYmluZF91aSIsInByZXZlbnREZWZhdWx0IiwiYmluZCIsIkV2ZW50cyIsImhvb2tfZXZlbnRzIiwiaW5mZXJfYXBwbHlfc291cmNlIiwiaGFzX3RleHQiLCJ2IiwiYSIsImIiLCJ0cnlfZ2V0X2J1aWxkZXJfZXhwb3J0IiwiX2UiLCJpbl9hZiIsImluX2NmIiwiZXhfYWYiLCJleF9jZiIsImV2IiwidGFiX2lkIiwiZGV0YWlsIiwidGFiIiwiaXNfaW5uZXIiLCJkZXQiLCJzcmMiLCJhZHZhbmNlZF9tb2RlX3NvdXJjZSIsInRvTG93ZXJDYXNlIiwiaG9vayIsIndwYmNfYmZiX2FkdmFuY2VkX2VkaXRvcl9hcGkiLCJnZXRfdmFsdWVzIiwidXNlX2FkdmFuY2VkIiwid2luZG93IiwiZG9jdW1lbnQiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9hZHZhbmNlZC1tb2RlL19zcmMvYmZiLWFkdmFuY2VkLWZvcm0tZWRpdG9yLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXHJcbiAqIEFkdmFuY2VkIEJvb2tpbmcgZm9ybSBtb2RlLlxyXG4gKlxyXG4gKiBSZWZhY3RvcmVkOiBtb2R1bGUtc3R5bGUgKERPTSAvIFN0YXRlIC8gRWRpdG9yIC8gU3luYyAvIENsaXBib2FyZCAvIEV2ZW50cyAvIFVJKVxyXG4gKlxyXG4gKiBAZmlsZSAuLi9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9hZHZhbmNlZC1tb2RlL19vdXQvYmZiLWFkdmFuY2VkLWZvcm0tZWRpdG9yLmpzXHJcbiAqL1xyXG4oZnVuY3Rpb24gKHcsIGQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdC8vIFRydWUgYWZ0ZXIgd3BiYzpiZmI6c3RydWN0dXJlOmxvYWRlZCBmaXJlZCBhdCBsZWFzdCBvbmNlLlxyXG5cdHZhciBzdHJ1Y3R1cmVfbG9hZGVkX29uY2UgPSBmYWxzZTtcclxuXHJcblx0ZnVuY3Rpb24gYWRhcHRlZF9oYXNfYW55X2ZpZWxkKGFkYXB0ZWQpIHtcclxuXHRcdGlmICggISBhZGFwdGVkIHx8ICEgQXJyYXkuaXNBcnJheSggYWRhcHRlZC5wYWdlcyApICkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGhhcyA9IGZhbHNlO1xyXG5cclxuXHRcdGZ1bmN0aW9uIHdhbGtfc2VjdGlvbihzZWMpIHtcclxuXHRcdFx0aWYgKCBoYXMgfHwgISBzZWMgKSB7IHJldHVybjsgfVxyXG5cdFx0XHR2YXIgY29scyA9IEFycmF5LmlzQXJyYXkoIHNlYy5jb2x1bW5zICkgPyBzZWMuY29sdW1ucyA6IFtdO1xyXG5cdFx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBjb2xzLmxlbmd0aDsgaSsrICkge1xyXG5cdFx0XHRcdHZhciBjb2wgPSBjb2xzW2ldIHx8IHt9O1xyXG5cdFx0XHRcdGlmICggQXJyYXkuaXNBcnJheSggY29sLmZpZWxkcyApICYmIGNvbC5maWVsZHMubGVuZ3RoICkgeyBoYXMgPSB0cnVlOyByZXR1cm47IH1cclxuXHRcdFx0XHR2YXIgbmVzdGVkID0gQXJyYXkuaXNBcnJheSggY29sLnNlY3Rpb25zICkgPyBjb2wuc2VjdGlvbnMgOiBbXTtcclxuXHRcdFx0XHRmb3IgKCB2YXIgaiA9IDA7IGogPCBuZXN0ZWQubGVuZ3RoOyBqKysgKSB7XHJcblx0XHRcdFx0XHR3YWxrX3NlY3Rpb24oIG5lc3RlZFtqXSApO1xyXG5cdFx0XHRcdFx0aWYgKCBoYXMgKSB7IHJldHVybjsgfVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdGZvciAoIHZhciBwID0gMDsgcCA8IGFkYXB0ZWQucGFnZXMubGVuZ3RoOyBwKysgKSB7XHJcblx0XHRcdHZhciBwYWdlICA9IGFkYXB0ZWQucGFnZXNbcF0gfHwge307XHJcblx0XHRcdHZhciBpdGVtcyA9IEFycmF5LmlzQXJyYXkoIHBhZ2UuaXRlbXMgKSA/IHBhZ2UuaXRlbXMgOiBbXTtcclxuXHRcdFx0Zm9yICggdmFyIGsgPSAwOyBrIDwgaXRlbXMubGVuZ3RoOyBrKysgKSB7XHJcblx0XHRcdFx0dmFyIGl0ID0gaXRlbXNba10gfHwge307XHJcblx0XHRcdFx0aWYgKCBpdC5raW5kID09PSAnZmllbGQnICkgeyByZXR1cm4gdHJ1ZTsgfVxyXG5cdFx0XHRcdGlmICggaXQua2luZCA9PT0gJ3NlY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0d2Fsa19zZWN0aW9uKCBpdC5kYXRhICk7XHJcblx0XHRcdFx0XHRpZiAoIGhhcyApIHsgcmV0dXJuIHRydWU7IH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdHJldHVybiBoYXM7XHJcblx0fVxyXG5cclxuXHQvLyA9PSAgQ29uc3RhbnRzICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cdHZhciBJRFMgPSB7XHJcblx0XHRwYW5lbHMgICAgICAgOiAnd3BiY19iZmJfX2FkdmFuY2VkX21vZGVfcGFuZWxzJyxcclxuXHRcdHRhX2Zvcm0gICAgICA6ICd3cGJjX2JmYl9fYWR2YW5jZWRfZm9ybV9lZGl0b3InLFxyXG5cdFx0dGFfY29udGVudCAgIDogJ3dwYmNfYmZiX19jb250ZW50X2Zvcm1fZWRpdG9yJyxcclxuXHRcdGJ0bl9yZWdlbiAgICA6ICd3cGJjX2JmYl9fYWR2YW5jZWRfcmVnZW5lcmF0ZV9idG4nLFxyXG5cdFx0YnRuX2NvcHlfZm9ybTogJ3dwYmNfYmZiX19hZHZhbmNlZF9jb3B5X2Zvcm1fYnRuJyxcclxuXHRcdGJ0bl9jb3B5X2NudCA6ICd3cGJjX2JmYl9fYWR2YW5jZWRfY29weV9jb250ZW50X2J0bicsXHJcblx0XHRjYl9hdXRvc3luYyAgOiAnd3BiY19iZmJfX2FkdmFuY2VkX2F1dG9zeW5jJyxcclxuXHRcdGRpcnR5X2hpbnQgICA6ICd3cGJjX2JmYl9fYWR2YW5jZWRfZGlydHlfaGludCdcclxuXHR9O1xyXG5cclxuXHR2YXIgS0VZID0ge1xyXG5cdFx0Rk9STSAgIDogJ2FkdmFuY2VkX2Zvcm0nLFxyXG5cdFx0Q09OVEVOVDogJ2NvbnRlbnRfZm9ybSdcclxuXHR9O1xyXG5cclxuXHR2YXIgVEFfSURfQllfS0VZICAgICAgICAgID0ge307XHJcblx0VEFfSURfQllfS0VZW0tFWS5GT1JNXSAgICA9IElEUy50YV9mb3JtO1xyXG5cdFRBX0lEX0JZX0tFWVtLRVkuQ09OVEVOVF0gPSBJRFMudGFfY29udGVudDtcclxuXHJcblx0Ly8gPT0gIERPTSBoZWxwZXJzICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHR2YXIgRE9NID0gKGZ1bmN0aW9uICgpIHtcclxuXHJcblx0XHRmdW5jdGlvbiBnZXRfYnlfaWQoaWQpIHtcclxuXHRcdFx0cmV0dXJuIGQuZ2V0RWxlbWVudEJ5SWQoIGlkICk7XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gb24oZWwsIHR5cGUsIGZuKSB7XHJcblx0XHRcdGlmICggZWwgKSB7XHJcblx0XHRcdFx0ZWwuYWRkRXZlbnRMaXN0ZW5lciggdHlwZSwgZm4gKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdGZ1bmN0aW9uIGlzX2FkdmFuY2VkX3VpX3ByZXNlbnQoKSB7XHJcblx0XHRcdHJldHVybiAhISBkLnF1ZXJ5U2VsZWN0b3IoICcjJyArIElEUy5wYW5lbHMgKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRnZXQgICA6IGdldF9ieV9pZCxcclxuXHRcdFx0b24gICAgOiBvbixcclxuXHRcdFx0aGFzX3VpOiBpc19hZHZhbmNlZF91aV9wcmVzZW50XHJcblx0XHR9O1xyXG5cdH0pKCk7XHJcblxyXG5cdC8vID09ICBTdGF0ZSAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0dmFyIFN0YXRlID0gKGZ1bmN0aW9uICgpIHtcclxuXHJcblx0XHR2YXIgc3RhdGUgPSB7XHJcblx0XHRcdGVkaXRvcnMgICAgICAgICAgICAgICAgOiB7fSwgIC8vIGtleSAtPiB3cC5jb2RlRWRpdG9yIGluc3RhbmNlIChvciBudWxsKVxyXG5cdFx0XHRhdXRvc3luY191c2VyX3ZhbHVlICAgIDogbnVsbCwgLy8gbnVsbCA9IG5vdCBkZWNpZGVkIGJ5IHVzZXIsIGJvb2xlYW4gPSB1c2VyIGV4cGxpY2l0bHkgc2V0XHJcblx0XHRcdHN5bmNfc3RhdGVfYm9vdHN0cmFwcGVkOiBmYWxzZSxcclxuXHRcdFx0aXNfZGlydHkgICAgICAgICAgICAgICA6IGZhbHNlLFxyXG5cdFx0XHRpc19wcm9ncmFtbWF0aWNfdXBkYXRlIDogZmFsc2UsXHJcblx0XHRcdGlzX2luaXRlZCAgICAgICAgICAgICAgOiBmYWxzZSxcclxuXHRcdFx0dGV4dGFyZWFfZmFsbGJhY2tfYm91bmQ6IGZhbHNlXHJcblx0XHR9O1xyXG5cclxuXHRcdHN0YXRlLmVkaXRvcnNbS0VZLkZPUk1dICAgID0gbnVsbDtcclxuXHRcdHN0YXRlLmVkaXRvcnNbS0VZLkNPTlRFTlRdID0gbnVsbDtcclxuXHJcblx0XHRmdW5jdGlvbiBzZXRfbGl2ZV9iYWRnZXMoKSB7XHJcblx0XHRcdHZhciBjYiAgICAgID0gRE9NLmdldCggSURTLmNiX2F1dG9zeW5jICk7XHJcblx0XHRcdHZhciBzeW5jX29uID0gISEgKGNiICYmIGNiLmNoZWNrZWQpO1xyXG5cclxuXHRcdFx0dmFyIGxpdmUgPSAoc3luY19vbiAmJiAhIHN0YXRlLmlzX2RpcnR5KSA/ICdidWlsZGVyJyA6ICdhZHZhbmNlZCc7XHJcblxyXG5cdFx0XHR2YXIgcm9vdCA9IGQuZG9jdW1lbnRFbGVtZW50O1xyXG5cdFx0XHRpZiAoICEgcm9vdCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJvb3Quc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJmYi1saXZlLXNvdXJjZScsIGxpdmUgPT09ICdidWlsZGVyJyA/ICdidWlsZGVyJyA6ICdhZHZhbmNlZCcgKTtcclxuXHRcdFx0cm9vdC5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYmZiLXN5bmMtbW9kZScsIHN5bmNfb24gPyAnb24nIDogJ29mZicgKTtcclxuXHRcdH1cclxuXHJcblx0XHRmdW5jdGlvbiBzZXRfZGlydHkob24pIHtcclxuXHRcdFx0c3RhdGUuaXNfZGlydHkgPSAhISBvbjtcclxuXHJcblx0XHRcdHZhciBoaW50ID0gRE9NLmdldCggSURTLmRpcnR5X2hpbnQgKTtcclxuXHRcdFx0aWYgKCBoaW50ICkge1xyXG5cdFx0XHRcdGhpbnQuc3R5bGUuZGlzcGxheSA9IHN0YXRlLmlzX2RpcnR5ID8gJ2lubGluZScgOiAnbm9uZSc7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBhdXRvc3luYyA9IERPTS5nZXQoIElEUy5jYl9hdXRvc3luYyApO1xyXG5cclxuXHRcdFx0aWYgKCBzdGF0ZS5pc19kaXJ0eSApIHtcclxuXHRcdFx0XHQvLyBVc2VyIGVkaXRlZCBBZHZhbmNlZCA9PiBleHBsaWNpdCBvcHQtb3V0IG9mIGF1dG9zeW5jIGZvciB0aGlzIHNlc3Npb24uXHJcblx0XHRcdFx0c3RhdGUuYXV0b3N5bmNfdXNlcl92YWx1ZSAgICAgPSBmYWxzZTtcclxuXHRcdFx0XHRzdGF0ZS5zeW5jX3N0YXRlX2Jvb3RzdHJhcHBlZCA9IHRydWU7XHJcblxyXG5cdFx0XHRcdGlmICggYXV0b3N5bmMgKSB7XHJcblx0XHRcdFx0XHRhdXRvc3luYy5jaGVja2VkID0gZmFsc2U7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdC8vIElNUE9SVEFOVDpcclxuXHRcdFx0XHQvLyBXaGVuIGNsZWFyaW5nIGRpcnR5IHN0YXRlLCBkbyBOT1QgZm9yY2UgYXV0b3N5bmMgY2hlY2tib3ggT04uXHJcblx0XHRcdFx0Ly8gQ2hlY2tib3ggc3RhdGUgaXMgY29udHJvbGxlZCBieTpcclxuXHRcdFx0XHQvLyAtIHVzZXIgYWN0aW9uIChjYiBjaGFuZ2UpXHJcblx0XHRcdFx0Ly8gLSBTeW5jLmFwcGx5X2F1dG9zeW5jX3N0YXRlKCkgd2hlbiBhdXRvc3luY191c2VyX3ZhbHVlID09PSBudWxsXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHNldF9saXZlX2JhZGdlcygpO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHRmdW5jdGlvbiBpc19hdXRvc3luY19vbigpIHtcclxuXHRcdFx0dmFyIGNiID0gRE9NLmdldCggSURTLmNiX2F1dG9zeW5jICk7XHJcblx0XHRcdHJldHVybiAhISAoY2IgJiYgY2IuY2hlY2tlZCAmJiAhIHN0YXRlLmlzX2RpcnR5KTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRyYXcgICAgICAgICAgIDogc3RhdGUsXHJcblx0XHRcdHNldF9kaXJ0eSAgICAgOiBzZXRfZGlydHksXHJcblx0XHRcdGlzX2F1dG9zeW5jX29uOiBpc19hdXRvc3luY19vbixcclxuXHRcdFx0dXBkYXRlX2JhZGdlcyA6IHNldF9saXZlX2JhZGdlc1xyXG5cdFx0fTtcclxuXHR9KSgpO1xyXG5cclxuXHQvLyA9PSAgRWRpdG9yIChDb2RlTWlycm9yICsgdGV4dGFyZWEgZmFsbGJhY2sgKyBzaG9ydGNvZGUgaGlnaGxpZ2h0aW5nIG1vZGUpICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cdHZhciBFZGl0b3IgPSAoZnVuY3Rpb24gKCkge1xyXG5cclxuXHRcdHZhciBpc19vc2hvcnRjb2RlX2RlZmluZWQgPSBmYWxzZTtcclxuXHJcblx0XHRmdW5jdGlvbiBjYW5faW5pdF9jb2RlbWlycm9yKCkge1xyXG5cdFx0XHR2YXIgd3BucyA9IHcud3AgfHwgbnVsbDtcclxuXHRcdFx0cmV0dXJuICEhIChcclxuXHRcdFx0XHR3cG5zICYmXHJcblx0XHRcdFx0d3Bucy5jb2RlRWRpdG9yICYmXHJcblx0XHRcdFx0dHlwZW9mIHdwbnMuY29kZUVkaXRvci5pbml0aWFsaXplID09PSAnZnVuY3Rpb24nICYmXHJcblx0XHRcdFx0dy53cGJjX2JmYl9jb2RlX2VkaXRvcl9zZXR0aW5nc1xyXG5cdFx0XHQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZ1bmN0aW9uIGVuc3VyZV9vc2hvcnRjb2RlX21vZGUoKSB7XHJcblx0XHRcdGlmICggaXNfb3Nob3J0Y29kZV9kZWZpbmVkICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dmFyIENNID0gdy53cCAmJiB3LndwLkNvZGVNaXJyb3IgPyB3LndwLkNvZGVNaXJyb3IgOiBudWxsO1xyXG5cdFx0XHRpZiAoICEgQ00gfHwgdHlwZW9mIENNLmRlZmluZU1vZGUgIT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRDTS5kZWZpbmVNb2RlKCAnb3Nob3J0Y29kZScsIGZ1bmN0aW9uIChjb25maWcsIHBhcnNlckNvbmZpZykge1xyXG5cclxuXHRcdFx0XHR2YXIgb3ZlcmxheSA9IHtcclxuXHRcdFx0XHRcdHRva2VuOiBmdW5jdGlvbiAoc3RyZWFtKSB7XHJcblx0XHRcdFx0XHRcdHZhciBjaDtcclxuXHJcblx0XHRcdFx0XHRcdC8vIFtuYW1lIC4uLl0gb3IgW25hbWUqIC4uLl1cclxuXHRcdFx0XHRcdFx0aWYgKCBzdHJlYW0ubWF0Y2goIC9eXFxbKFthLXpBLVowLTlfXSspXFwqP1xccz8vICkgKSB7XHJcblx0XHRcdFx0XHRcdFx0d2hpbGUgKCAoY2ggPSBzdHJlYW0ubmV4dCgpKSAhPSBudWxsICkge1xyXG5cdFx0XHRcdFx0XHRcdFx0aWYgKCBjaCA9PT0gJ10nICkge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gJ29zaG9ydGNvZGUnO1xyXG5cdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0d2hpbGUgKCBzdHJlYW0ubmV4dCgpICE9IG51bGwgJiYgISBzdHJlYW0ubWF0Y2goIC9eXFxbKFthLXpBLVowLTlfXSspXFwqP1xccz8vLCBmYWxzZSApICkge31cclxuXHRcdFx0XHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0dmFyIGJhc2UgPSBDTS5nZXRNb2RlKCBjb25maWcsIChwYXJzZXJDb25maWcgJiYgcGFyc2VyQ29uZmlnLmJhY2tkcm9wKSB8fCAnaHRtbG1peGVkJyApO1xyXG5cclxuXHRcdFx0XHQvLyBGYWxsYmFjayBpZiBvdmVybGF5IGFkZG9uIGlzIG1pc3NpbmcuXHJcblx0XHRcdFx0aWYgKCB0eXBlb2YgQ00ub3ZlcmxheU1vZGUgIT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gYmFzZTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiBDTS5vdmVybGF5TW9kZSggYmFzZSwgb3ZlcmxheSApO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRpc19vc2hvcnRjb2RlX2RlZmluZWQgPSB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZ1bmN0aW9uIGJpbmRfdGV4dGFyZWFfZGlydHlfZmFsbGJhY2soKSB7XHJcblx0XHRcdGlmICggU3RhdGUucmF3LnRleHRhcmVhX2ZhbGxiYWNrX2JvdW5kICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dmFyIHRhX2Zvcm0gPSBET00uZ2V0KCBJRFMudGFfZm9ybSApO1xyXG5cdFx0XHR2YXIgdGFfY250ICA9IERPTS5nZXQoIElEUy50YV9jb250ZW50ICk7XHJcblx0XHRcdGlmICggISB0YV9mb3JtIHx8ICEgdGFfY250ICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZnVuY3Rpb24gb25fY2hhbmdlKCkge1xyXG5cdFx0XHRcdGlmICggU3RhdGUucmF3LmlzX3Byb2dyYW1tYXRpY191cGRhdGUgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdFN0YXRlLnNldF9kaXJ0eSggdHJ1ZSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0YV9mb3JtLmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIG9uX2NoYW5nZSApO1xyXG5cdFx0XHR0YV9mb3JtLmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBvbl9jaGFuZ2UgKTtcclxuXHRcdFx0dGFfY250LmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIG9uX2NoYW5nZSApO1xyXG5cdFx0XHR0YV9jbnQuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIG9uX2NoYW5nZSApO1xyXG5cclxuXHRcdFx0U3RhdGUucmF3LnRleHRhcmVhX2ZhbGxiYWNrX2JvdW5kID0gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRmdW5jdGlvbiBpbml0X2VkaXRvcih0ZXh0YXJlYV9lbCwga2V5KSB7XHJcblx0XHRcdHZhciB3cG5zID0gdy53cCB8fCBudWxsO1xyXG5cclxuXHRcdFx0aWYgKCAhIHRleHRhcmVhX2VsIHx8ICEgd3BucyB8fCAhIHdwbnMuY29kZUVkaXRvciB8fCB0eXBlb2Ygd3Bucy5jb2RlRWRpdG9yLmluaXRpYWxpemUgIT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBiYXNlID0gdy53cGJjX2JmYl9jb2RlX2VkaXRvcl9zZXR0aW5ncyB8fCBudWxsO1xyXG5cdFx0XHRpZiAoICEgYmFzZSApIHtcclxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZW5zdXJlX29zaG9ydGNvZGVfbW9kZSgpO1xyXG5cclxuXHRcdFx0Ly8gQ2xvbmUgc28gd2UgZG9uJ3QgbXV0YXRlIGxvY2FsaXplZCBzaGFyZWQgc2V0dGluZ3Mgb2JqZWN0LlxyXG5cdFx0XHR2YXIgc2V0dGluZ3MgICAgICAgICAgICAgPSBPYmplY3QuYXNzaWduKCB7fSwgYmFzZSApO1xyXG5cdFx0XHRzZXR0aW5ncy5jb2RlbWlycm9yICAgICAgPSBPYmplY3QuYXNzaWduKCB7fSwgYmFzZS5jb2RlbWlycm9yIHx8IHt9ICk7XHJcblx0XHRcdHNldHRpbmdzLmNvZGVtaXJyb3IubW9kZSA9ICdvc2hvcnRjb2RlJztcclxuXHJcblx0XHRcdHZhciBpbnN0ID0gd3Bucy5jb2RlRWRpdG9yLmluaXRpYWxpemUoIHRleHRhcmVhX2VsLCBzZXR0aW5ncyApO1xyXG5cclxuXHRcdFx0aWYgKCBpbnN0ICYmIGluc3QuY29kZW1pcnJvciApIHtcclxuXHRcdFx0XHRpbnN0LmNvZGVtaXJyb3Iub24oICdjaGFuZ2UnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRpZiAoIFN0YXRlLnJhdy5pc19wcm9ncmFtbWF0aWNfdXBkYXRlICkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRTdGF0ZS5zZXRfZGlydHkoIHRydWUgKTtcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdFN0YXRlLnJhdy5lZGl0b3JzW2tleV0gPSBpbnN0O1xyXG5cdFx0XHRyZXR1cm4gaW5zdDtcclxuXHRcdH1cclxuXHJcblx0XHRmdW5jdGlvbiBlbnN1cmVfaW5pdGVkKCkge1xyXG5cdFx0XHRpZiAoIFN0YXRlLnJhdy5pc19pbml0ZWQgKSB7XHJcblx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciB0YV9mb3JtID0gRE9NLmdldCggSURTLnRhX2Zvcm0gKTtcclxuXHRcdFx0dmFyIHRhX2NudCAgPSBET00uZ2V0KCBJRFMudGFfY29udGVudCApO1xyXG5cdFx0XHRpZiAoICEgdGFfZm9ybSB8fCAhIHRhX2NudCApIHtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGJpbmRfdGV4dGFyZWFfZGlydHlfZmFsbGJhY2soKTtcclxuXHJcblx0XHRcdGlmICggY2FuX2luaXRfY29kZW1pcnJvcigpICkge1xyXG5cdFx0XHRcdHZhciBpMSA9IGluaXRfZWRpdG9yKCB0YV9mb3JtLCBLRVkuRk9STSApO1xyXG5cdFx0XHRcdHZhciBpMiA9IGluaXRfZWRpdG9yKCB0YV9jbnQsIEtFWS5DT05URU5UICk7XHJcblxyXG5cdFx0XHRcdGlmICggISBpMSApIHtcclxuXHRcdFx0XHRcdFN0YXRlLnJhdy5lZGl0b3JzW0tFWS5GT1JNXSA9IG51bGw7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICggISBpMiApIHtcclxuXHRcdFx0XHRcdFN0YXRlLnJhdy5lZGl0b3JzW0tFWS5DT05URU5UXSA9IG51bGw7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRTdGF0ZS5yYXcuaXNfaW5pdGVkID0gdHJ1ZTtcclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gcmVmcmVzaF9hbGwoKSB7XHJcblx0XHRcdHZhciBrZXlzID0gT2JqZWN0LmtleXMoIFN0YXRlLnJhdy5lZGl0b3JzICk7XHJcblx0XHRcdGZvciAoIHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0dmFyIGluc3QgPSBTdGF0ZS5yYXcuZWRpdG9yc1trZXlzW2ldXTtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0aWYgKCBpbnN0ICYmIGluc3QuY29kZW1pcnJvciAmJiB0eXBlb2YgaW5zdC5jb2RlbWlycm9yLnJlZnJlc2ggPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdGluc3QuY29kZW1pcnJvci5yZWZyZXNoKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gdGV4dGFyZWFfaWRfZm9yKGtleSkge1xyXG5cdFx0XHRyZXR1cm4gVEFfSURfQllfS0VZW2tleV0gfHwgJyc7XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gZ2V0X3ZhbHVlKGtleSkge1xyXG5cdFx0XHR2YXIgaW5zdCA9IFN0YXRlLnJhdy5lZGl0b3JzW2tleV07XHJcblx0XHRcdGlmICggaW5zdCAmJiBpbnN0LmNvZGVtaXJyb3IgJiYgdHlwZW9mIGluc3QuY29kZW1pcnJvci5nZXRWYWx1ZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRyZXR1cm4gU3RyaW5nKCBpbnN0LmNvZGVtaXJyb3IuZ2V0VmFsdWUoKSB8fCAnJyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHZhciB0YSA9IERPTS5nZXQoIHRleHRhcmVhX2lkX2Zvcigga2V5ICkgKTtcclxuXHRcdFx0cmV0dXJuIHRhID8gU3RyaW5nKCB0YS52YWx1ZSB8fCAnJyApIDogJyc7XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gc2V0X3ZhbHVlKGtleSwgdmFsdWUpIHtcclxuXHRcdFx0dmFsdWUgPSAodmFsdWUgPT0gbnVsbCkgPyAnJyA6IFN0cmluZyggdmFsdWUgKTtcclxuXHJcblx0XHRcdHZhciB0YSA9IERPTS5nZXQoIHRleHRhcmVhX2lkX2Zvcigga2V5ICkgKTtcclxuXHJcblx0XHRcdFN0YXRlLnJhdy5pc19wcm9ncmFtbWF0aWNfdXBkYXRlID0gdHJ1ZTtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRpZiAoIHRhICkge1xyXG5cdFx0XHRcdFx0dGEudmFsdWUgPSB2YWx1ZTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHZhciBpbnN0ID0gU3RhdGUucmF3LmVkaXRvcnNba2V5XTtcclxuXHRcdFx0XHRpZiAoIGluc3QgJiYgaW5zdC5jb2RlbWlycm9yICYmIHR5cGVvZiBpbnN0LmNvZGVtaXJyb3Iuc2V0VmFsdWUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRpbnN0LmNvZGVtaXJyb3Iuc2V0VmFsdWUoIHZhbHVlICk7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBpbnN0LmNvZGVtaXJyb3Iuc2F2ZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0aW5zdC5jb2RlbWlycm9yLnNhdmUoKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gZmluYWxseSB7XHJcblx0XHRcdFx0U3RhdGUucmF3LmlzX3Byb2dyYW1tYXRpY191cGRhdGUgPSBmYWxzZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdGZ1bmN0aW9uIGZvY3VzX2FuZF9zZWxlY3Qoa2V5KSB7XHJcblx0XHRcdHZhciB0YSA9IERPTS5nZXQoIHRleHRhcmVhX2lkX2Zvcigga2V5ICkgKTtcclxuXHRcdFx0aWYgKCAhIHRhICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHRhLmZvY3VzKCk7XHJcblx0XHRcdFx0dGEuc2VsZWN0KCk7XHJcblx0XHRcdH0gY2F0Y2ggKCBlICkge31cclxuXHRcdH1cclxuXHJcblx0XHRmdW5jdGlvbiBzYXZlX2FsbF90b190ZXh0YXJlYXMoKSB7XHJcblx0XHRcdHZhciBrZXlzID0gT2JqZWN0LmtleXMoIFN0YXRlLnJhdy5lZGl0b3JzICk7XHJcblx0XHRcdGZvciAoIHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0dmFyIGluc3QgPSBTdGF0ZS5yYXcuZWRpdG9yc1trZXlzW2ldXTtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0aWYgKCBpbnN0ICYmIGluc3QuY29kZW1pcnJvciAmJiB0eXBlb2YgaW5zdC5jb2RlbWlycm9yLnNhdmUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdGluc3QuY29kZW1pcnJvci5zYXZlKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0ZW5zdXJlX2luaXRlZDogZW5zdXJlX2luaXRlZCxcclxuXHRcdFx0cmVmcmVzaF9hbGwgIDogcmVmcmVzaF9hbGwsXHJcblx0XHRcdGdldF92YWx1ZSAgICA6IGdldF92YWx1ZSxcclxuXHRcdFx0c2V0X3ZhbHVlICAgIDogc2V0X3ZhbHVlLFxyXG5cdFx0XHRmb2N1c19zZWxlY3QgOiBmb2N1c19hbmRfc2VsZWN0LFxyXG5cdFx0XHRzYXZlX2FsbCAgICAgOiBzYXZlX2FsbF90b190ZXh0YXJlYXNcclxuXHRcdH07XHJcblx0fSkoKTtcclxuXHJcblx0Ly8gPT0gIEJ1aWxkZXIgZXhwb3J0ICsgU3luYyAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHR2YXIgU3luYyA9IChmdW5jdGlvbiAoKSB7XHJcblxyXG5cdFx0dmFyIHBvbGxfdGltZXJfaWQgICAgID0gbnVsbDtcclxuXHRcdHZhciBkZWJvdW5jZV90aW1lcl9pZCA9IG51bGw7XHJcblxyXG5cdFx0ZnVuY3Rpb24gY2FuX2V4cG9ydF9mcm9tX2J1aWxkZXIoKSB7XHJcblx0XHRcdHJldHVybiAhISAoXHJcblx0XHRcdFx0dy53cGJjX2JmYiAmJlxyXG5cdFx0XHRcdHR5cGVvZiB3LndwYmNfYmZiLmdldF9zdHJ1Y3R1cmUgPT09ICdmdW5jdGlvbicgJiZcclxuXHRcdFx0XHR3LldQQkNfQkZCX0V4cG9ydGVyICYmXHJcblx0XHRcdFx0dHlwZW9mIHcuV1BCQ19CRkJfRXhwb3J0ZXIuZXhwb3J0X2FsbCA9PT0gJ2Z1bmN0aW9uJ1xyXG5cdFx0XHQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZ1bmN0aW9uIGdldF9jdXJyZW50X3N0cnVjdHVyZSgpIHtcclxuXHRcdFx0cmV0dXJuICh3LndwYmNfYmZiICYmIHR5cGVvZiB3LndwYmNfYmZiLmdldF9zdHJ1Y3R1cmUgPT09ICdmdW5jdGlvbicpID8gdy53cGJjX2JmYi5nZXRfc3RydWN0dXJlKCkgOiBbXTtcclxuXHRcdH1cclxuXHJcblx0XHRmdW5jdGlvbiBleHBvcnRfYWxsX2Zyb21fYnVpbGRlcigpIHtcclxuXHRcdFx0aWYgKCAhIHcuV1BCQ19CRkJfRXhwb3J0ZXIgfHwgdHlwZW9mIHcuV1BCQ19CRkJfRXhwb3J0ZXIuZXhwb3J0X2FsbCAhPT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdFx0fVxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHJldHVybiB3LldQQkNfQkZCX0V4cG9ydGVyLmV4cG9ydF9hbGwoIGdldF9jdXJyZW50X3N0cnVjdHVyZSgpLCB7IGdhcFBlcmNlbnQ6IDMgfSApO1xyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdGZ1bmN0aW9uIGV4cG9ydF9vdXRwdXRfbG9va3NfcmVhZHkob3V0KSB7XHJcblx0XHRcdGlmICggISBvdXQgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgYWYgPSAob3V0LmFkdmFuY2VkX2Zvcm0gPT0gbnVsbCkgPyAnJyA6IFN0cmluZyggb3V0LmFkdmFuY2VkX2Zvcm0gKTtcclxuXHRcdFx0dmFyIGNmID0gKG91dC5maWVsZHNfZGF0YSA9PSBudWxsKSA/ICcnIDogU3RyaW5nKCBvdXQuZmllbGRzX2RhdGEgKTtcclxuXHJcblx0XHRcdGFmID0gYWYudHJpbSgpO1xyXG5cdFx0XHRjZiA9IGNmLnRyaW0oKTtcclxuXHJcblx0XHRcdGlmICggISBhZiAmJiAhIGNmICkge1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gSWYgc3RydWN0dXJlIGlzIGxvYWRlZCBhbmQgdGhlcmUgYXJlIE5PIGZpZWxkcywgYWNjZXB0IGVtcHR5IGV4cG9ydC5cclxuXHRcdFx0aWYgKCBzdHJ1Y3R1cmVfbG9hZGVkX29uY2UgJiYgISBhZGFwdGVkX2hhc19hbnlfZmllbGQoIG91dC5hZGFwdGVkICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFJlYWwgQkZCIGV4cG9ydCBpbmNsdWRlcyBsYXlvdXQgdGFncyAoPHI+LCA8Yz4sIDxpdGVtPikuXHJcblx0XHRcdHZhciBoYXNfbGF5b3V0X3RhZ3MgPSAvPFxccyoocnxjfGl0ZW0pXFxiL2kudGVzdCggYWYgKSB8fCAvPFxccyoocnxjfGl0ZW0pXFxiL2kudGVzdCggY2YgKTtcclxuXHRcdFx0dmFyIGhhc19hbnlfaXRlbSAgICA9IC88XFxzKml0ZW1cXGIvaS50ZXN0KCBhZiApIHx8IC88XFxzKml0ZW1cXGIvaS50ZXN0KCBjZiApO1xyXG5cclxuXHRcdFx0cmV0dXJuIGhhc19sYXlvdXRfdGFncyAmJiBoYXNfYW55X2l0ZW07XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gZ2V0X2J1aWxkZXJfZXhwb3J0X2lmX3JlYWR5KCkge1xyXG5cdFx0XHRpZiAoICEgY2FuX2V4cG9ydF9mcm9tX2J1aWxkZXIoKSApIHtcclxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dmFyIG91dCA9IGV4cG9ydF9hbGxfZnJvbV9idWlsZGVyKCk7XHJcblx0XHRcdGlmICggISBvdXQgKSB7XHJcblx0XHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggISBleHBvcnRfb3V0cHV0X2xvb2tzX3JlYWR5KCBvdXQgKSApIHtcclxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIG91dDtcclxuXHRcdH1cclxuXHJcblx0XHQvLyAtLS0gTm9ybWFsaXphdGlvbiBmb3IgY29tcGFyZSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRmdW5jdGlvbiBub3JtYWxpemVfc3R5bGVfdmFsdWUoY3NzKSB7XHJcblx0XHRcdGNzcyA9IChjc3MgPT0gbnVsbCkgPyAnJyA6IFN0cmluZyggY3NzICk7XHJcblxyXG5cdFx0XHRjc3MgPSBjc3MucmVwbGFjZSggL1xcclxcbi9nLCAnXFxuJyApLnJlcGxhY2UoIC9cXHIvZywgJ1xcbicgKTtcclxuXHRcdFx0Y3NzID0gY3NzLnJlcGxhY2UoIC9cXHQvZywgJyAnICk7XHJcblx0XHRcdGNzcyA9IGNzcy5yZXBsYWNlKCAvXFxzKy9nLCAnICcgKTtcclxuXHJcblx0XHRcdGNzcyA9IGNzcy5yZXBsYWNlKCAvXFxzKjtcXHMqL2csICc7JyApO1xyXG5cdFx0XHRjc3MgPSBjc3MucmVwbGFjZSggL1xccyo6XFxzKi9nLCAnOicgKTtcclxuXHJcblx0XHRcdGNzcyA9IGNzcy50cmltKCkucmVwbGFjZSggLzsrXFxzKiQvZywgJycgKTtcclxuXHRcdFx0aWYgKCBjc3MgIT09ICcnICkge1xyXG5cdFx0XHRcdGNzcyArPSAnOyc7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBjc3M7XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gbm9ybWFsaXplX2lubGluZV9zdHlsZXNfaW5fbWFya3VwKGh0bWwpIHtcclxuXHRcdFx0aHRtbCA9IChodG1sID09IG51bGwpID8gJycgOiBTdHJpbmcoIGh0bWwgKTtcclxuXHJcblx0XHRcdHJldHVybiBodG1sLnJlcGxhY2UoIC9cXGJzdHlsZT0oW1wiJ10pKC4qPylcXDEvZ2ksIGZ1bmN0aW9uIChfbSwgcXVvdGUsIGNzcykge1xyXG5cdFx0XHRcdHJldHVybiAnc3R5bGU9JyArIHF1b3RlICsgbm9ybWFsaXplX3N0eWxlX3ZhbHVlKCBjc3MgKSArIHF1b3RlO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gbm9ybWFsaXplX3RleHQocykge1xyXG5cdFx0XHRzID0gKHMgPT0gbnVsbCkgPyAnJyA6IFN0cmluZyggcyApO1xyXG5cclxuXHRcdFx0cyA9IHMucmVwbGFjZSggL1xcclxcbi9nLCAnXFxuJyApLnJlcGxhY2UoIC9cXHIvZywgJ1xcbicgKTtcclxuXHRcdFx0cyA9IG5vcm1hbGl6ZV9pbmxpbmVfc3R5bGVzX2luX21hcmt1cCggcyApO1xyXG5cclxuXHRcdFx0cyA9IHMucmVwbGFjZSggL1sgXFx0XSskL2dtLCAnJyApO1xyXG5cdFx0XHRzID0gcy5yZXBsYWNlKCAvWyBdezIsfS9nLCAnICcgKTtcclxuXHRcdFx0cyA9IHMucmVwbGFjZSggL15cXHMrL2dtLCAnJyApO1xyXG5cdFx0XHRzID0gcy5yZXBsYWNlKCAvXFxuezMsfS9nLCAnXFxuXFxuJyApO1xyXG5cclxuXHRcdFx0cmV0dXJuIHMudHJpbSgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZ1bmN0aW9uIGdldF9jdXJyZW50X2FkdmFuY2VkX3RleHRzKCkge1xyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdGFkdmFuY2VkX2Zvcm06IEVkaXRvci5nZXRfdmFsdWUoIEtFWS5GT1JNICksXHJcblx0XHRcdFx0Y29udGVudF9mb3JtIDogRWRpdG9yLmdldF92YWx1ZSggS0VZLkNPTlRFTlQgKVxyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdGZ1bmN0aW9uIGRldGVjdF9zeW5jX3N0YXRlX3dpdGhfZXhwb3J0KCkge1xyXG5cdFx0XHR2YXIgb3V0ID0gZ2V0X2J1aWxkZXJfZXhwb3J0X2lmX3JlYWR5KCk7XHJcblx0XHRcdGlmICggISBvdXQgKSB7XHJcblx0XHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBjdXIgPSBnZXRfY3VycmVudF9hZHZhbmNlZF90ZXh0cygpO1xyXG5cclxuXHRcdFx0dmFyIGExID0gbm9ybWFsaXplX3RleHQoIGN1ci5hZHZhbmNlZF9mb3JtICk7XHJcblx0XHRcdHZhciBhMiA9IG5vcm1hbGl6ZV90ZXh0KCBjdXIuY29udGVudF9mb3JtICk7XHJcblxyXG5cdFx0XHR2YXIgYjEgPSBub3JtYWxpemVfdGV4dCggb3V0LmFkdmFuY2VkX2Zvcm0gfHwgJycgKTtcclxuXHRcdFx0dmFyIGIyID0gbm9ybWFsaXplX3RleHQoIG91dC5maWVsZHNfZGF0YSB8fCAnJyApO1xyXG5cclxuXHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHRpc19zeW5jZWQ6IChhMSA9PT0gYjEpICYmIChhMiA9PT0gYjIpLFxyXG5cdFx0XHRcdG91dCAgICAgIDogb3V0XHJcblx0XHRcdH07XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gYXBwbHlfYXV0b3N5bmNfZnJvbV9zeW5jX3N0YXRlKGlzX3N5bmNlZCkge1xyXG5cdFx0XHR2YXIgY2IgPSBET00uZ2V0KCBJRFMuY2JfYXV0b3N5bmMgKTtcclxuXHRcdFx0aWYgKCAhIGNiICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBTdGF0ZS5yYXcuaXNfZGlydHkgKSB7XHJcblx0XHRcdFx0U3RhdGUucmF3LmF1dG9zeW5jX3VzZXJfdmFsdWUgICAgID0gZmFsc2U7XHJcblx0XHRcdFx0U3RhdGUucmF3LnN5bmNfc3RhdGVfYm9vdHN0cmFwcGVkID0gdHJ1ZTtcclxuXHRcdFx0XHRjYi5jaGVja2VkICAgICAgICAgICAgICAgICAgICAgICAgPSBmYWxzZTtcclxuXHRcdFx0XHRTdGF0ZS51cGRhdGVfYmFkZ2VzKCk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBPbmx5IGF1dG8tc2V0IGNoZWNrYm94IGlmIHVzZXIgbmV2ZXIgZXhwbGljaXRseSB0b3VjaGVkIGl0LlxyXG5cdFx0XHRpZiAoIFN0YXRlLnJhdy5hdXRvc3luY191c2VyX3ZhbHVlID09PSBudWxsICkge1xyXG5cdFx0XHRcdGNiLmNoZWNrZWQgPSAhISBpc19zeW5jZWQ7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdFN0YXRlLnJhdy5zeW5jX3N0YXRlX2Jvb3RzdHJhcHBlZCA9IHRydWU7XHJcblx0XHRcdFN0YXRlLnVwZGF0ZV9iYWRnZXMoKTtcclxuXHRcdH1cclxuXHJcblx0XHRmdW5jdGlvbiByZWdlbmVyYXRlX2Zyb21fYnVpbGRlcihvdXRfb3B0KSB7XHJcblx0XHRcdHZhciBvdXQgPSBvdXRfb3B0IHx8IGdldF9idWlsZGVyX2V4cG9ydF9pZl9yZWFkeSgpO1xyXG5cdFx0XHRpZiAoICEgb3V0ICkge1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0RWRpdG9yLnNldF92YWx1ZSggS0VZLkZPUk0sIG91dC5hZHZhbmNlZF9mb3JtIHx8ICcnICk7XHJcblx0XHRcdEVkaXRvci5zZXRfdmFsdWUoIEtFWS5DT05URU5ULCBvdXQuZmllbGRzX2RhdGEgfHwgJycgKTtcclxuXHJcblx0XHRcdFN0YXRlLnNldF9kaXJ0eSggZmFsc2UgKTtcclxuXHRcdFx0U3RhdGUudXBkYXRlX2JhZGdlcygpO1xyXG5cclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gc3luY19kZXRlY3RfYW5kX2FwcGx5KCkge1xyXG5cdFx0XHR2YXIgcmVzID0gZGV0ZWN0X3N5bmNfc3RhdGVfd2l0aF9leHBvcnQoKTtcclxuXHRcdFx0aWYgKCByZXMgPT09IG51bGwgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgY2IgICAgICA9IERPTS5nZXQoIElEUy5jYl9hdXRvc3luYyApO1xyXG5cdFx0XHR2YXIgc3luY19vbiA9ICEhIChjYiAmJiBjYi5jaGVja2VkKTtcclxuXHJcblx0XHRcdFN0YXRlLnJhdy5zeW5jX3N0YXRlX2Jvb3RzdHJhcHBlZCA9IHRydWU7XHJcblxyXG5cdFx0XHRpZiAoIFN0YXRlLnJhdy5pc19kaXJ0eSApIHtcclxuXHRcdFx0XHRhcHBseV9hdXRvc3luY19mcm9tX3N5bmNfc3RhdGUoIGZhbHNlICk7XHJcblx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggc3luY19vbiApIHtcclxuXHRcdFx0XHRpZiAoICEgcmVzLmlzX3N5bmNlZCApIHtcclxuXHRcdFx0XHRcdHJlZ2VuZXJhdGVfZnJvbV9idWlsZGVyKCByZXMub3V0ICk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFN0YXRlLnVwZGF0ZV9iYWRnZXMoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGFwcGx5X2F1dG9zeW5jX2Zyb21fc3luY19zdGF0ZSggcmVzLmlzX3N5bmNlZCApO1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyAtLS0gUG9sbCAvIGRlYm91bmNlIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdGZ1bmN0aW9uIHNjaGVkdWxlX3N5bmNfZGV0ZWN0KHJlYXNvbikge1xyXG5cclxuXHRcdFx0aWYgKCBwb2xsX3RpbWVyX2lkICkge1xyXG5cdFx0XHRcdGNsZWFyVGltZW91dCggcG9sbF90aW1lcl9pZCApO1xyXG5cdFx0XHRcdHBvbGxfdGltZXJfaWQgPSBudWxsO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgc3RhcnRlZF9tcyAgID0gRGF0ZS5ub3coKTtcclxuXHRcdFx0dmFyIG1heF90b3RhbF9tcyA9IDEyMDAwO1xyXG5cdFx0XHR2YXIgZGVsYXlfbXMgICAgID0gMTUwO1xyXG5cclxuXHRcdFx0KGZ1bmN0aW9uIHRpY2soKSB7XHJcblxyXG5cdFx0XHRcdGlmICggISBET00uaGFzX3VpKCkgKSB7XHJcblx0XHRcdFx0XHRwb2xsX3RpbWVyX2lkID0gbnVsbDtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdEVkaXRvci5lbnN1cmVfaW5pdGVkKCk7XHJcblxyXG5cdFx0XHRcdGlmICggU3RhdGUucmF3LmlzX2RpcnR5ICkge1xyXG5cdFx0XHRcdFx0YXBwbHlfYXV0b3N5bmNfZnJvbV9zeW5jX3N0YXRlKCBmYWxzZSApO1xyXG5cdFx0XHRcdFx0cG9sbF90aW1lcl9pZCA9IG51bGw7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoIHN5bmNfZGV0ZWN0X2FuZF9hcHBseSgpICkge1xyXG5cdFx0XHRcdFx0cG9sbF90aW1lcl9pZCA9IG51bGw7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoIChEYXRlLm5vdygpIC0gc3RhcnRlZF9tcykgPCBtYXhfdG90YWxfbXMgKSB7XHJcblx0XHRcdFx0XHRkZWxheV9tcyAgICAgID0gTWF0aC5taW4oIDYwMCwgTWF0aC5mbG9vciggZGVsYXlfbXMgKiAxLjI1ICkgKTtcclxuXHRcdFx0XHRcdHBvbGxfdGltZXJfaWQgPSBzZXRUaW1lb3V0KCB0aWNrLCBkZWxheV9tcyApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cG9sbF90aW1lcl9pZCA9IG51bGw7XHJcblx0XHRcdH0pKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gc2NoZWR1bGVfc3luY19kZXRlY3RfZGVib3VuY2VkKHJlYXNvbikge1xyXG5cdFx0XHRpZiAoIGRlYm91bmNlX3RpbWVyX2lkICkge1xyXG5cdFx0XHRcdGNsZWFyVGltZW91dCggZGVib3VuY2VfdGltZXJfaWQgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRkZWJvdW5jZV90aW1lcl9pZCA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRkZWJvdW5jZV90aW1lcl9pZCA9IG51bGw7XHJcblx0XHRcdFx0c2NoZWR1bGVfc3luY19kZXRlY3QoIHJlYXNvbiApO1xyXG5cdFx0XHR9LCAyNTAgKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRzY2hlZHVsZV9kZXRlY3QgICAgICAgICAgOiBzY2hlZHVsZV9zeW5jX2RldGVjdCxcclxuXHRcdFx0c2NoZWR1bGVfZGV0ZWN0X2RlYm91bmNlZDogc2NoZWR1bGVfc3luY19kZXRlY3RfZGVib3VuY2VkLFxyXG5cdFx0XHRyZWdlbmVyYXRlICAgICAgICAgICAgICAgOiByZWdlbmVyYXRlX2Zyb21fYnVpbGRlcixcclxuXHRcdFx0YXBwbHlfYXV0b3N5bmNfc3RhdGUgICAgIDogYXBwbHlfYXV0b3N5bmNfZnJvbV9zeW5jX3N0YXRlXHJcblx0XHR9O1xyXG5cdH0pKCk7XHJcblxyXG5cdC8vID09ICBDbGlwYm9hcmQgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0dmFyIENsaXBib2FyZCA9IChmdW5jdGlvbiAoKSB7XHJcblxyXG5cdFx0YXN5bmMgZnVuY3Rpb24gY29weV90ZXh0KHRleHQpIHtcclxuXHRcdFx0dGV4dCA9ICh0ZXh0ID09IG51bGwpID8gJycgOiBTdHJpbmcoIHRleHQgKTtcclxuXHJcblx0XHRcdGlmICggdHlwZW9mIHcud3BiY19jb3B5X3RvX2NsaXBib2FyZCA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHR0cnkgeyByZXR1cm4gYXdhaXQgdy53cGJjX2NvcHlfdG9fY2xpcGJvYXJkKCB0ZXh0ICk7IH0gY2F0Y2ggKCBlICkge31cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRpZiAoIHcuaXNTZWN1cmVDb250ZXh0ICYmIG5hdmlnYXRvci5jbGlwYm9hcmQgJiYgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQgKSB7XHJcblx0XHRcdFx0XHRhd2FpdCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dCggdGV4dCApO1xyXG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGNhdGNoICggZSApIHt9XHJcblxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHZhciB0YSAgID0gZC5jcmVhdGVFbGVtZW50KCAndGV4dGFyZWEnICk7XHJcblx0XHRcdFx0dGEudmFsdWUgPSB0ZXh0O1xyXG5cdFx0XHRcdHRhLnNldEF0dHJpYnV0ZSggJ3JlYWRvbmx5JywgJycgKTtcclxuXHRcdFx0XHR0YS5zdHlsZS5wb3NpdGlvbiA9ICdmaXhlZCc7XHJcblx0XHRcdFx0dGEuc3R5bGUudG9wICAgICAgPSAnLTk5OTlweCc7XHJcblx0XHRcdFx0dGEuc3R5bGUub3BhY2l0eSAgPSAnMCc7XHJcblx0XHRcdFx0ZC5ib2R5LmFwcGVuZENoaWxkKCB0YSApO1xyXG5cdFx0XHRcdHRhLmZvY3VzKCk7XHJcblx0XHRcdFx0dGEuc2VsZWN0KCk7XHJcblx0XHRcdFx0dmFyIG9rID0gZC5leGVjQ29tbWFuZCggJ2NvcHknICk7XHJcblx0XHRcdFx0ZC5ib2R5LnJlbW92ZUNoaWxkKCB0YSApO1xyXG5cdFx0XHRcdHJldHVybiAhISBvaztcclxuXHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gZmVlZGJhY2tfYnV0dG9uKGJ0biwgb2spIHtcclxuXHRcdFx0aWYgKCAhIGJ0biApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBvcmlnaW5hbCA9IGJ0bi5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtb3JpZ2luYWwtdGV4dCcgKSB8fCBidG4udGV4dENvbnRlbnQ7XHJcblx0XHRcdGJ0bi5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtb3JpZ2luYWwtdGV4dCcsIG9yaWdpbmFsICk7XHJcblxyXG5cdFx0XHRidG4udGV4dENvbnRlbnQgPSBvayA/ICdDb3BpZWQhJyA6ICdQcmVzcyBDdHJsL0NtZCtDIHRvIGNvcHknO1xyXG5cdFx0XHRzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0YnRuLnRleHRDb250ZW50ID0gb3JpZ2luYWw7XHJcblx0XHRcdH0sIDE1MDAgKTtcclxuXHRcdH1cclxuXHJcblx0XHRhc3luYyBmdW5jdGlvbiBjb3B5X2VkaXRvcl92YWx1ZShrZXksIGJ0bikge1xyXG5cdFx0XHRFZGl0b3IuZW5zdXJlX2luaXRlZCgpO1xyXG5cclxuXHRcdFx0dmFyIG9rID0gYXdhaXQgY29weV90ZXh0KCBFZGl0b3IuZ2V0X3ZhbHVlKCBrZXkgKSApO1xyXG5cdFx0XHRpZiAoICEgb2sgKSB7XHJcblx0XHRcdFx0RWRpdG9yLmZvY3VzX3NlbGVjdCgga2V5ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGZlZWRiYWNrX2J1dHRvbiggYnRuLCBvayApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdGNvcHlfZWRpdG9yX3ZhbHVlOiBjb3B5X2VkaXRvcl92YWx1ZVxyXG5cdFx0fTtcclxuXHR9KSgpO1xyXG5cclxuXHQvLyA9PSAgVUkgYmluZGluZ3NcclxuXHR2YXIgVUkgPSAoZnVuY3Rpb24gKCkge1xyXG5cclxuXHRcdGZ1bmN0aW9uIGJpbmRfdWkoKSB7XHJcblxyXG5cdFx0XHRET00ub24oIERPTS5nZXQoIElEUy5idG5fcmVnZW4gKSwgJ2NsaWNrJywgZnVuY3Rpb24gKGUpIHtcclxuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0RWRpdG9yLmVuc3VyZV9pbml0ZWQoKTtcclxuXHRcdFx0XHRTeW5jLnJlZ2VuZXJhdGUoKTtcclxuXHRcdFx0XHRFZGl0b3IucmVmcmVzaF9hbGwoKTtcclxuXHJcblx0XHRcdFx0Ly8gU2FmZSBkZWZhdWx0IHVudGlsIHdlIGNhbiBjb25maXJtIHN5bmMgc3RhdGUuXHJcblx0XHRcdFx0dmFyIGNiID0gRE9NLmdldCggSURTLmNiX2F1dG9zeW5jICk7XHJcblx0XHRcdFx0aWYgKCBjYiApIHtcclxuXHRcdFx0XHRcdGNiLmNoZWNrZWQgPSB0cnVlO1xyXG5cdFx0XHRcdFx0U3RhdGUudXBkYXRlX2JhZGdlcygpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0RE9NLm9uKCBET00uZ2V0KCBJRFMuY2JfYXV0b3N5bmMgKSwgJ2NoYW5nZScsIGZ1bmN0aW9uICgpIHtcclxuXHJcblx0XHRcdFx0dmFyIGNiID0gRE9NLmdldCggSURTLmNiX2F1dG9zeW5jICk7XHJcblx0XHRcdFx0aWYgKCAhIGNiICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0U3RhdGUucmF3LmF1dG9zeW5jX3VzZXJfdmFsdWUgICAgID0gISEgY2IuY2hlY2tlZDsgLy8gZXhwbGljaXQgdXNlciBjaG9pY2VcclxuXHRcdFx0XHRTdGF0ZS5yYXcuc3luY19zdGF0ZV9ib290c3RyYXBwZWQgPSB0cnVlO1xyXG5cclxuXHRcdFx0XHRpZiAoIGNiLmNoZWNrZWQgKSB7XHJcblx0XHRcdFx0XHRTdGF0ZS5zZXRfZGlydHkoIGZhbHNlICk7XHJcblx0XHRcdFx0XHRFZGl0b3IuZW5zdXJlX2luaXRlZCgpO1xyXG5cclxuXHRcdFx0XHRcdGlmICggISBTeW5jLnJlZ2VuZXJhdGUoKSApIHtcclxuXHRcdFx0XHRcdFx0U3luYy5zY2hlZHVsZV9kZXRlY3QoICdhdXRvc3luY191c2VyX29uX3dhaXRfcmVhZHknICk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0RWRpdG9yLnJlZnJlc2hfYWxsKCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRTdGF0ZS51cGRhdGVfYmFkZ2VzKCk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdERPTS5vbiggRE9NLmdldCggSURTLmJ0bl9jb3B5X2Zvcm0gKSwgJ2NsaWNrJywgZnVuY3Rpb24gKGUpIHtcclxuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0Q2xpcGJvYXJkLmNvcHlfZWRpdG9yX3ZhbHVlKCBLRVkuRk9STSwgRE9NLmdldCggSURTLmJ0bl9jb3B5X2Zvcm0gKSApO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRET00ub24oIERPTS5nZXQoIElEUy5idG5fY29weV9jbnQgKSwgJ2NsaWNrJywgZnVuY3Rpb24gKGUpIHtcclxuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0Q2xpcGJvYXJkLmNvcHlfZWRpdG9yX3ZhbHVlKCBLRVkuQ09OVEVOVCwgRE9NLmdldCggSURTLmJ0bl9jb3B5X2NudCApICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRiaW5kOiBiaW5kX3VpXHJcblx0XHR9O1xyXG5cdH0pKCk7XHJcblxyXG5cdC8vID09ICBXUCAvIEJ1aWxkZXIgZXZlbnRzICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0dmFyIEV2ZW50cyA9IChmdW5jdGlvbiAoKSB7XHJcblxyXG5cdFx0ZnVuY3Rpb24gaG9va19ldmVudHMoKSB7XHJcblxyXG5cdFx0XHQvKipcclxuXHRcdFx0ICogSW5mZXIgYXBwbHkgc291cmNlIHdpdGhvdXQgcmVseWluZyBvbiBhbnkgXCJhZHZhbmNlZF9zb3VyY2VcIiBrZXkuXHJcblx0XHRcdCAqXHJcblx0XHRcdCAqIFJldHVybnM6XHJcblx0XHRcdCAqIC0gJ2J1aWxkZXInICA6IGlmIHRleHRzIG1hdGNoIGN1cnJlbnQgQnVpbGRlciBleHBvcnQgKHdoZW4gZXhwb3J0IGlzIHJlYWR5KVxyXG5cdFx0XHQgKiAtICdhZHZhbmNlZCcgOiBpZiB0ZXh0cyBkbyBub3QgbWF0Y2ggQnVpbGRlciBleHBvcnQgKGJ1dCBoYXZlIGFueSBjb250ZW50KVxyXG5cdFx0XHQgKiAtICdhdXRvJyAgICAgOiBpZiBCdWlsZGVyIGV4cG9ydCBpcyBub3QgYXZhaWxhYmxlL3JlYWR5IChzYWZlIGRlZmF1bHQpXHJcblx0XHRcdCAqXHJcblx0XHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBhZlxyXG5cdFx0XHQgKiBAcGFyYW0ge3N0cmluZ30gY2ZcclxuXHRcdFx0ICogQHJldHVybiB7J2J1aWxkZXInfCdhZHZhbmNlZCd8J2F1dG8nfVxyXG5cdFx0XHQgKi9cclxuXHRcdFx0ZnVuY3Rpb24gaW5mZXJfYXBwbHlfc291cmNlKGFmLCBjZikge1xyXG5cclxuXHRcdFx0XHRhZiA9IChhZiA9PSBudWxsKSA/ICcnIDogU3RyaW5nKGFmKTtcclxuXHRcdFx0XHRjZiA9IChjZiA9PSBudWxsKSA/ICcnIDogU3RyaW5nKGNmKTtcclxuXHJcblx0XHRcdFx0ZnVuY3Rpb24gaGFzX3RleHQodikge1xyXG5cdFx0XHRcdFx0cmV0dXJuICEhICh2ICYmIFN0cmluZyh2KS50cmltKCkpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0ZnVuY3Rpb24gbm9ybWFsaXplX3N0eWxlX3ZhbHVlKGNzcykge1xyXG5cdFx0XHRcdFx0Y3NzID0gKGNzcyA9PSBudWxsKSA/ICcnIDogU3RyaW5nKCBjc3MgKTtcclxuXHJcblx0XHRcdFx0XHRjc3MgPSBjc3MucmVwbGFjZSggL1xcclxcbi9nLCAnXFxuJyApLnJlcGxhY2UoIC9cXHIvZywgJ1xcbicgKTtcclxuXHRcdFx0XHRcdGNzcyA9IGNzcy5yZXBsYWNlKCAvXFx0L2csICcgJyApO1xyXG5cdFx0XHRcdFx0Y3NzID0gY3NzLnJlcGxhY2UoIC9cXHMrL2csICcgJyApO1xyXG5cclxuXHRcdFx0XHRcdC8vIE5vcm1hbGl6ZSBzcGFjaW5nIGFyb3VuZCBzZXBhcmF0b3JzLlxyXG5cdFx0XHRcdFx0Y3NzID0gY3NzLnJlcGxhY2UoIC9cXHMqO1xccyovZywgJzsnICk7XHJcblx0XHRcdFx0XHRjc3MgPSBjc3MucmVwbGFjZSggL1xccyo6XFxzKi9nLCAnOicgKTtcclxuXHJcblx0XHRcdFx0XHQvLyBFbnN1cmUgc3RhYmxlIHRyYWlsaW5nIHNlbWljb2xvbiAoaW1wb3J0YW50IGZvciBjb21wYXJlKS5cclxuXHRcdFx0XHRcdGNzcyA9IGNzcy50cmltKCkucmVwbGFjZSggLzsrXFxzKiQvZywgJycgKTtcclxuXHRcdFx0XHRcdGlmICggY3NzICE9PSAnJyApIHtcclxuXHRcdFx0XHRcdFx0Y3NzICs9ICc7JztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHJldHVybiBjc3M7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRmdW5jdGlvbiBub3JtYWxpemVfaW5saW5lX3N0eWxlc19pbl9tYXJrdXAoaHRtbCkge1xyXG5cdFx0XHRcdFx0aHRtbCA9IChodG1sID09IG51bGwpID8gJycgOiBTdHJpbmcoIGh0bWwgKTtcclxuXHJcblx0XHRcdFx0XHQvLyBIYW5kbGVzOiBzdHlsZT1cIi4uLlwiIGFuZCBzdHlsZT0nLi4uJyAod2l0aCBvcHRpb25hbCBzcGFjZXMgYXJvdW5kICc9JylcclxuXHRcdFx0XHRcdHJldHVybiBodG1sLnJlcGxhY2UoIC9cXGJzdHlsZVxccyo9XFxzKihbXCInXSkoLio/KVxcMS9naSwgZnVuY3Rpb24gKF9tLCBxdW90ZSwgY3NzKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybiAnc3R5bGU9JyArIHF1b3RlICsgbm9ybWFsaXplX3N0eWxlX3ZhbHVlKCBjc3MgKSArIHF1b3RlO1xyXG5cdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0ZnVuY3Rpb24gbm9ybWFsaXplX3RleHQocykge1xyXG5cdFx0XHRcdFx0cyA9IChzID09IG51bGwpID8gJycgOiBTdHJpbmcocyk7XHJcblx0XHRcdFx0XHRzID0gcy5yZXBsYWNlKC9cXHJcXG4vZywgJ1xcbicpLnJlcGxhY2UoL1xcci9nLCAnXFxuJyk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gSU1QT1JUQU5UOiBub3JtYWxpemUgaW5saW5lIHN0eWxlcyBzbyBcImZsZXg6MVwiID09IFwiZmxleDoxO1wiXHJcblx0XHRcdFx0XHRzID0gbm9ybWFsaXplX2lubGluZV9zdHlsZXNfaW5fbWFya3VwKHMpO1xyXG5cclxuXHRcdFx0XHRcdHMgPSBzLnJlcGxhY2UoL1sgXFx0XSskL2dtLCAnJyk7XHJcblx0XHRcdFx0XHRzID0gcy5yZXBsYWNlKC9bIF17Mix9L2csICcgJyk7XHJcblx0XHRcdFx0XHRzID0gcy5yZXBsYWNlKC9eXFxzKy9nbSwgJycpO1xyXG5cdFx0XHRcdFx0cyA9IHMucmVwbGFjZSgvXFxuezMsfS9nLCAnXFxuXFxuJyk7XHJcblx0XHRcdFx0XHRyZXR1cm4gcy50cmltKCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRmdW5jdGlvbiBleHBvcnRfb3V0cHV0X2xvb2tzX3JlYWR5KG91dCkge1xyXG5cdFx0XHRcdFx0aWYgKCFvdXQpIHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHRcdHZhciBhID0gbm9ybWFsaXplX3RleHQob3V0LmFkdmFuY2VkX2Zvcm0gfHwgJycpO1xyXG5cdFx0XHRcdFx0dmFyIGIgPSBub3JtYWxpemVfdGV4dChvdXQuZmllbGRzX2RhdGEgfHwgJycpO1xyXG5cdFx0XHRcdFx0aWYgKCFhICYmICFiKSByZXR1cm4gZmFsc2U7XHJcblx0XHRcdFx0XHQvLyBJZiBzdHJ1Y3R1cmUgaXMgbG9hZGVkIGFuZCB0aGVyZSBhcmUgTk8gZmllbGRzLCBhY2NlcHQgZW1wdHkgZXhwb3J0LlxyXG5cdFx0XHRcdFx0aWYgKCBzdHJ1Y3R1cmVfbG9hZGVkX29uY2UgJiYgISBhZGFwdGVkX2hhc19hbnlfZmllbGQoIG91dC5hZGFwdGVkICkgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0Ly8gRXhwZWN0IGxheW91dCB0YWdzIHRvIGV4aXN0IGluIHJlYWwgZXhwb3J0LlxyXG5cdFx0XHRcdFx0dmFyIGhhc19sYXlvdXRfdGFncyA9IC88XFxzKihyfGN8aXRlbSlcXGIvaS50ZXN0KGEpIHx8IC88XFxzKihyfGN8aXRlbSlcXGIvaS50ZXN0KGIpO1xyXG5cdFx0XHRcdFx0dmFyIGhhc19hbnlfaXRlbSAgICA9IC88XFxzKml0ZW1cXGIvaS50ZXN0KGEpIHx8IC88XFxzKml0ZW1cXGIvaS50ZXN0KGIpO1xyXG5cdFx0XHRcdFx0cmV0dXJuIGhhc19sYXlvdXRfdGFncyAmJiBoYXNfYW55X2l0ZW07XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRmdW5jdGlvbiB0cnlfZ2V0X2J1aWxkZXJfZXhwb3J0KCkge1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0XHRcdCF3LndwYmNfYmZiIHx8XHJcblx0XHRcdFx0XHRcdFx0dHlwZW9mIHcud3BiY19iZmIuZ2V0X3N0cnVjdHVyZSAhPT0gJ2Z1bmN0aW9uJyB8fFxyXG5cdFx0XHRcdFx0XHRcdCF3LldQQkNfQkZCX0V4cG9ydGVyIHx8XHJcblx0XHRcdFx0XHRcdFx0dHlwZW9mIHcuV1BCQ19CRkJfRXhwb3J0ZXIuZXhwb3J0X2FsbCAhPT0gJ2Z1bmN0aW9uJ1xyXG5cdFx0XHRcdFx0XHQpIHtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR2YXIgb3V0ID0gdy5XUEJDX0JGQl9FeHBvcnRlci5leHBvcnRfYWxsKHcud3BiY19iZmIuZ2V0X3N0cnVjdHVyZSgpLCB7IGdhcFBlcmNlbnQ6IDMgfSk7XHJcblx0XHRcdFx0XHRcdGlmICghZXhwb3J0X291dHB1dF9sb29rc19yZWFkeShvdXQpKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0cmV0dXJuIG91dDtcclxuXHRcdFx0XHRcdH0gY2F0Y2ggKF9lKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dmFyIG91dCA9IHRyeV9nZXRfYnVpbGRlcl9leHBvcnQoKTtcclxuXHRcdFx0XHRpZiAoIW91dCkge1xyXG5cdFx0XHRcdFx0cmV0dXJuICdhdXRvJztcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHZhciBpbl9hZiA9IG5vcm1hbGl6ZV90ZXh0KGFmKTtcclxuXHRcdFx0XHR2YXIgaW5fY2YgPSBub3JtYWxpemVfdGV4dChjZik7XHJcblx0XHRcdFx0dmFyIGV4X2FmID0gbm9ybWFsaXplX3RleHQob3V0LmFkdmFuY2VkX2Zvcm0gfHwgJycpO1xyXG5cdFx0XHRcdHZhciBleF9jZiA9IG5vcm1hbGl6ZV90ZXh0KG91dC5maWVsZHNfZGF0YSB8fCAnJyk7XHJcblxyXG5cdFx0XHRcdGlmIChpbl9hZiA9PT0gZXhfYWYgJiYgaW5fY2YgPT09IGV4X2NmKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gJ2J1aWxkZXInO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKGhhc190ZXh0KGFmKSB8fCBoYXNfdGV4dChjZikpIHtcclxuXHRcdFx0XHRcdHJldHVybiAnYWR2YW5jZWQnO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmV0dXJuICdhdXRvJztcclxuXHRcdFx0fVxyXG5cclxuXHJcblx0XHRcdGQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6YmZiOnN0cnVjdHVyZTpjaGFuZ2UnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0aWYgKCAhIEVkaXRvci5lbnN1cmVfaW5pdGVkKCkgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoIFN0YXRlLnJhdy5pc19kaXJ0eSApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmICggU3RhdGUucmF3LmF1dG9zeW5jX3VzZXJfdmFsdWUgPT09IGZhbHNlICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dmFyIGNiID0gRE9NLmdldCggSURTLmNiX2F1dG9zeW5jICk7XHJcblx0XHRcdFx0aWYgKCAhIGNiICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCAhIFN0YXRlLnJhdy5zeW5jX3N0YXRlX2Jvb3RzdHJhcHBlZCApIHtcclxuXHRcdFx0XHRcdFN5bmMuc2NoZWR1bGVfZGV0ZWN0X2RlYm91bmNlZCggJ3N0cnVjdHVyZV9jaGFuZ2VfcHJlX2Jvb3RzdHJhcCcgKTtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFN5bmMuc2NoZWR1bGVfZGV0ZWN0X2RlYm91bmNlZCggJ3N0cnVjdHVyZV9jaGFuZ2UnICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdGQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6YmZiOnN0cnVjdHVyZTpsb2FkZWQnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0c3RydWN0dXJlX2xvYWRlZF9vbmNlID0gdHJ1ZTtcclxuXHRcdFx0XHRTeW5jLnNjaGVkdWxlX2RldGVjdCggJ3N0cnVjdHVyZV9sb2FkZWQnICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdGQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6YmZiOnRvcC10YWInLCBmdW5jdGlvbiAoZXYpIHtcclxuXHJcblx0XHRcdFx0dmFyIHRhYl9pZCAgID0gKGV2ICYmIGV2LmRldGFpbCAmJiBldi5kZXRhaWwudGFiKSA/IFN0cmluZyggZXYuZGV0YWlsLnRhYiApIDogJyc7XHJcblx0XHRcdFx0dmFyIGlzX2lubmVyID0gKHRhYl9pZCA9PT0gJ2FkdmFuY2VkX21vZGVfX2Jvb2tpbmdfZm9ybScgfHwgdGFiX2lkID09PSAnYWR2YW5jZWRfbW9kZV9fYm9va2luZ19kYXRhJyk7XHJcblxyXG5cdFx0XHRcdC8vIEVudGVyaW5nIEFkdmFuY2VkIE1vZGUgKHJvb3QgdGFiKSBvciBzd2l0Y2hpbmcgaW5uZXIgdGFicy5cclxuXHRcdFx0XHRpZiAoIHRhYl9pZCAhPT0gJ2FkdmFuY2VkX3RhYicgJiYgISBpc19pbm5lciApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmICggISBFZGl0b3IuZW5zdXJlX2luaXRlZCgpICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCBTdGF0ZS5pc19hdXRvc3luY19vbigpICkge1xyXG5cdFx0XHRcdFx0aWYgKCAhIFN5bmMucmVnZW5lcmF0ZSgpICkge1xyXG5cdFx0XHRcdFx0XHRTeW5jLnNjaGVkdWxlX2RldGVjdCggJ3RvcF90YWJfd2FpdF9yZWFkeScgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cclxuXHRcdFx0XHRzZXRUaW1lb3V0KCBFZGl0b3IucmVmcmVzaF9hbGwsIDYwICk7XHJcblx0XHRcdFx0aWYgKCB0YWJfaWQgPT09ICdhZHZhbmNlZF9tb2RlX19ib29raW5nX2RhdGEnICkge1xyXG5cdFx0XHRcdFx0c2V0VGltZW91dCggRWRpdG9yLnJlZnJlc2hfYWxsLCAxMjAgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdGQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6YmZiOmFkdmFuY2VkX3RleHQ6YXBwbHknLCBmdW5jdGlvbiAoZXYpIHtcclxuXHJcblx0XHRcdFx0dmFyIGRldCA9IChldiAmJiBldi5kZXRhaWwpID8gZXYuZGV0YWlsIDoge307XHJcblx0XHRcdFx0dmFyIGFmICA9IChkZXQuYWR2YW5jZWRfZm9ybSA9PSBudWxsKSA/ICcnIDogU3RyaW5nKCBkZXQuYWR2YW5jZWRfZm9ybSApO1xyXG5cdFx0XHRcdHZhciBjZiAgPSAoZGV0LmNvbnRlbnRfZm9ybSA9PSBudWxsKSA/ICcnIDogU3RyaW5nKCBkZXQuY29udGVudF9mb3JtICk7XHJcblxyXG5cdFx0XHRcdHZhciBzcmMgPSBTdHJpbmcoIGRldC5hZHZhbmNlZF9tb2RlX3NvdXJjZSB8fCAnYXV0bycgKS50b0xvd2VyQ2FzZSgpOyAvLyBidWlsZGVyfGFkdmFuY2VkfGF1dG8uXHJcblx0XHRcdFx0aWYgKCBzcmMgIT09ICdidWlsZGVyJyAmJiBzcmMgIT09ICdhZHZhbmNlZCcgJiYgc3JjICE9PSAnYXV0bycgKSB7XHJcblx0XHRcdFx0XHRzcmMgPSAnYXV0byc7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICggc3JjID09PSAnYXV0bycgKSB7XHJcblx0XHRcdFx0XHRzcmMgPSBpbmZlcl9hcHBseV9zb3VyY2UoIGFmLCBjZiApOyAvLyBidWlsZGVyfGFkdmFuY2VkfGF1dG8uXHJcblx0XHRcdFx0fVxyXG5cclxuXHJcblx0XHRcdFx0dmFyIGNiID0gRE9NLmdldCggSURTLmNiX2F1dG9zeW5jICk7XHJcblxyXG5cdFx0XHRcdC8vIEFsd2F5cyB1c2UgRWRpdG9yIEFQSSAoa2VlcHMgdGV4dGFyZWEgKyBDb2RlTWlycm9yIGluIHN5bmMpLlxyXG5cdFx0XHRcdEVkaXRvci5lbnN1cmVfaW5pdGVkKCk7XHJcblx0XHRcdFx0RWRpdG9yLnNldF92YWx1ZSggS0VZLkZPUk0sIGFmICk7XHJcblx0XHRcdFx0RWRpdG9yLnNldF92YWx1ZSggS0VZLkNPTlRFTlQsIGNmICk7XHJcblx0XHRcdFx0c2V0VGltZW91dCggRWRpdG9yLnJlZnJlc2hfYWxsLCA2MCApO1xyXG5cclxuXHRcdFx0XHRpZiAoIHNyYyA9PT0gJ2FkdmFuY2VkJyApIHtcclxuXHRcdFx0XHRcdC8vIEFkdmFuY2VkIGlzIGF1dGhvcml0YXRpdmUgPT4gZGlydHkgKyBhdXRvc3luYyBPRkYuXHJcblx0XHRcdFx0XHRpZiAoIGNiICkgeyBjYi5jaGVja2VkID0gZmFsc2U7IH1cclxuXHRcdFx0XHRcdFN0YXRlLnNldF9kaXJ0eSggdHJ1ZSApOyAgICAgICAgICAgICAgICAgLy8gYWxzbyBzZXRzIGF1dG9zeW5jX3VzZXJfdmFsdWU9ZmFsc2UgYW5kIGJvb3RzdHJhcHBlZD10cnVlIC5cclxuXHJcblx0XHRcdFx0fSBlbHNlIGlmICggc3JjID09PSAnYnVpbGRlcicgKSB7XHJcblx0XHRcdFx0XHQvLyBCdWlsZGVyIGlzIGF1dGhvcml0YXRpdmUgPT4gYXV0b3N5bmMgT04uXHJcblx0XHRcdFx0XHRpZiAoIGNiICkgeyBjYi5jaGVja2VkID0gdHJ1ZTsgfVxyXG5cdFx0XHRcdFx0U3RhdGUucmF3LmF1dG9zeW5jX3VzZXJfdmFsdWUgICAgID0gdHJ1ZTtcclxuXHRcdFx0XHRcdFN0YXRlLnJhdy5zeW5jX3N0YXRlX2Jvb3RzdHJhcHBlZCA9IHRydWU7XHJcblx0XHRcdFx0XHRTdGF0ZS5zZXRfZGlydHkoIGZhbHNlICk7XHJcblxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHQvLyBhdXRvL3Vua25vd246ICBTYWZlIGRlZmF1bHQgPSBhdXRvc3luYyBPRkYgdW50aWwgd2UgY29uZmlybSByZWFsIHN5bmMgc3RhdGUuICBUaGlzIHByZXZlbnRzIFByZXZpZXcgdXNpbmcgQnVpbGRlciBiZWZvcmUgZXhwb3J0IGlzIHJlYWR5IC8gY29tcGFyaXNvbiBpcyBkb25lLlxyXG5cdFx0XHRcdFx0aWYgKCBjYiApIHsgY2IuY2hlY2tlZCA9IGZhbHNlOyB9XHJcblx0XHRcdFx0XHRTdGF0ZS5yYXcuYXV0b3N5bmNfdXNlcl92YWx1ZSAgICAgPSBudWxsO1xyXG5cdFx0XHRcdFx0U3RhdGUucmF3LnN5bmNfc3RhdGVfYm9vdHN0cmFwcGVkID0gZmFsc2U7XHJcblx0XHRcdFx0XHRTdGF0ZS5zZXRfZGlydHkoIGZhbHNlICk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRTdGF0ZS51cGRhdGVfYmFkZ2VzKCk7XHJcblx0XHRcdFx0U3luYy5zY2hlZHVsZV9kZXRlY3QoICdhZHZhbmNlZF90ZXh0X2FwcGx5JyApO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRob29rOiBob29rX2V2ZW50c1xyXG5cdFx0fTtcclxuXHR9KSgpO1xyXG5cclxuXHQvLyA9PSBQdWJsaWMgQVBJICh1bmNoYW5nZWQpICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cdHcud3BiY19iZmJfYWR2YW5jZWRfZWRpdG9yX2FwaSA9IHcud3BiY19iZmJfYWR2YW5jZWRfZWRpdG9yX2FwaSB8fCB7fTtcclxuXHJcblx0dy53cGJjX2JmYl9hZHZhbmNlZF9lZGl0b3JfYXBpLmdldF92YWx1ZXMgPSBmdW5jdGlvbiAoKSB7XHJcblxyXG5cdFx0Ly8gRW5zdXJlIENvZGVNaXJyb3IgaXMgcmVhZHkgKGlmIGVuYWJsZWQpLlxyXG5cdFx0RWRpdG9yLmVuc3VyZV9pbml0ZWQoKTtcclxuXHJcblx0XHQvLyBQdXNoIENvZGVNaXJyb3IgLT4gdGV4dGFyZWEgKG5vLW9wIGlmIG5vdCBpbml0ZWQpLlxyXG5cdFx0RWRpdG9yLnNhdmVfYWxsKCk7XHJcblxyXG5cdFx0Ly8gSW4geW91ciBzeXN0ZW0sIFwibWFudWFsIG1vZGVcIiAoYXV0b3N5bmMgT0ZGKSBtdXN0IGJlIHRyZWF0ZWQgYXMgXCJ1c2UgQWR2YW5jZWRcIi5cclxuXHRcdHZhciB1c2VfYWR2YW5jZWQgPSAhISBTdGF0ZS5yYXcuaXNfZGlydHkgfHwgISBTdGF0ZS5pc19hdXRvc3luY19vbigpO1xyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdGFkdmFuY2VkX2Zvcm06IEVkaXRvci5nZXRfdmFsdWUoIEtFWS5GT1JNICksXHJcblx0XHRcdGNvbnRlbnRfZm9ybSA6IEVkaXRvci5nZXRfdmFsdWUoIEtFWS5DT05URU5UICksXHJcblx0XHRcdGlzX2RpcnR5ICAgICA6IHVzZV9hZHZhbmNlZFxyXG5cdFx0fTtcclxuXHR9O1xyXG5cclxuXHJcblx0dy53cGJjX2JmYl9hZHZhbmNlZF9lZGl0b3JfYXBpLnNldF9kaXJ0eSA9IGZ1bmN0aW9uIChzdGF0ZSkge1xyXG5cdFx0U3RhdGUuc2V0X2RpcnR5KCAhISBzdGF0ZSApO1xyXG5cdH07XHJcblxyXG5cdC8vID09ICBCb290ICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0ZC5hZGRFdmVudExpc3RlbmVyKCAnRE9NQ29udGVudExvYWRlZCcsIGZ1bmN0aW9uICgpIHtcclxuXHJcblx0XHRVSS5iaW5kKCk7XHJcblx0XHRFdmVudHMuaG9vaygpO1xyXG5cclxuXHRcdGlmICggRE9NLmhhc191aSgpICkge1xyXG5cdFx0XHRFZGl0b3IuZW5zdXJlX2luaXRlZCgpO1xyXG5cdFx0XHRzZXRUaW1lb3V0KCBFZGl0b3IucmVmcmVzaF9hbGwsIDYwICk7XHJcblxyXG5cdFx0XHQvLyBTYWZlIGRlZmF1bHQgdW50aWwgd2UgY2FuIGNvbmZpcm0gc3luYyBzdGF0ZS5cclxuXHRcdFx0dmFyIGNiID0gRE9NLmdldCggSURTLmNiX2F1dG9zeW5jICk7XHJcblx0XHRcdGlmICggY2IgJiYgU3RhdGUucmF3LmF1dG9zeW5jX3VzZXJfdmFsdWUgPT09IG51bGwgJiYgISBTdGF0ZS5yYXcuc3luY19zdGF0ZV9ib290c3RyYXBwZWQgKSB7XHJcblx0XHRcdFx0Y2IuY2hlY2tlZCA9IGZhbHNlO1xyXG5cdFx0XHRcdFN0YXRlLnVwZGF0ZV9iYWRnZXMoKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIEluaXRpYWwgYXV0b3N5bmMgY2hlY2tib3ggc3RhdGUgKGJhc2VkIG9uIHJlYWwgc3luYyBzdGF0dXMpLlxyXG5cdFx0U3luYy5zY2hlZHVsZV9kZXRlY3QoICdib290JyApO1xyXG5cdH0gKTtcclxuXHJcbn0pKCB3aW5kb3csIGRvY3VtZW50ICk7XHJcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7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
