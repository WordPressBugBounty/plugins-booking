"use strict";

/*
 * Advanced Mode Bridge (FREE) + CodeMirror Highlighting:
 * - Builder is the only editor.
 * - Always sync ON (Advanced text = Builder export).
 * - CodeMirror read-only highlighting for textareas (oshortcode overlay).
 * - Provides wpbc_bfb_advanced_editor_api.get_values() for Save/Preview.
 *
 * @file ../includes/page-form-builder/advanced-mode/_out/bfb-advanced-free.js
 */
(function (w, d) {
  'use strict';

  // True after wpbc:bfb:structure:loaded fired at least once.
  var structure_loaded_once = false;

  // == Constants =========================================================================================
  var IDS = {
    ta_form: 'wpbc_bfb__advanced_form_editor',
    ta_content: 'wpbc_bfb__content_form_editor'
  };
  var KEY = {
    FORM: 'advanced_form',
    CONTENT: 'content_form'
  };
  var TA_ID_BY_KEY = {};
  TA_ID_BY_KEY[KEY.FORM] = IDS.ta_form;
  TA_ID_BY_KEY[KEY.CONTENT] = IDS.ta_content;

  // == DOM ===============================================================================================
  var DOM = function () {
    function get_by_id(id) {
      return d.getElementById(id);
    }
    function has_textareas() {
      return !!(get_by_id(IDS.ta_form) && get_by_id(IDS.ta_content));
    }
    function on(type, fn) {
      d.addEventListener(type, fn);
    }
    return {
      get: get_by_id,
      has_textareas: has_textareas,
      on: on
    };
  }();

  // == Editor (CodeMirror readonly + oshortcode highlighting) ============================================
  var Editor = function () {
    var is_inited = false;
    var editors = {}; // key -> wp.codeEditor instance (or null)
    editors[KEY.FORM] = null;
    editors[KEY.CONTENT] = null;
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
    function init_one(textarea_el, key) {
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

      // Highlight shortcodes in HTML-like markup.
      settings.codemirror.mode = 'oshortcode';

      // FREE: read-only editor (still selectable/copyable).
      settings.codemirror.readOnly = true;

      // Nice UX for read-only:
      // - no active line highlight in some themes
      // - no cursor blinking distraction
      settings.codemirror.styleActiveLine = false;
      settings.codemirror.cursorBlinkRate = -1;
      var inst = wpns.codeEditor.initialize(textarea_el, settings);
      editors[key] = inst || null;
      return inst || null;
    }
    function ensure_inited() {
      if (is_inited) {
        return true;
      }
      var ta_form = DOM.get(IDS.ta_form);
      var ta_cnt = DOM.get(IDS.ta_content);
      if (!ta_form || !ta_cnt) {
        return false;
      }

      // Initialize CodeMirror if possible; otherwise, plain textarea fallback.
      if (can_init_codemirror()) {
        init_one(ta_form, KEY.FORM);
        init_one(ta_cnt, KEY.CONTENT);
      }
      is_inited = true;
      return true;
    }
    function textarea_id_for(key) {
      return TA_ID_BY_KEY[key] || '';
    }
    function set_value(key, value) {
      value = value == null ? '' : String(value);
      var ta = DOM.get(textarea_id_for(key));
      if (ta) {
        ta.value = value;
      }
      var inst = editors[key];
      try {
        if (inst && inst.codemirror && typeof inst.codemirror.setValue === 'function') {
          inst.codemirror.setValue(value);
          if (typeof inst.codemirror.save === 'function') {
            inst.codemirror.save();
          }
        }
      } catch (e) {}
    }
    function refresh_all() {
      var keys = Object.keys(editors);
      for (var i = 0; i < keys.length; i++) {
        var inst = editors[keys[i]];
        try {
          if (inst && inst.codemirror && typeof inst.codemirror.refresh === 'function') {
            inst.codemirror.refresh();
          }
        } catch (e) {}
      }
      var root = d.documentElement;
      if (!root) {
        return;
      }
      root.setAttribute('data-wpbc-bfb-live-source', 'builder');
    }
    return {
      ensure_inited: ensure_inited,
      set_value: set_value,
      refresh_all: refresh_all
    };
  }();

  // == Bridge (Builder export -> snapshot -> editor/textarea) ============================================
  var Bridge = function () {
    var last_good = {
      advanced_form: '',
      content_form: ''
    };
    var debounce_id = null;

    /**
     * Check if adapted structure contains ANY field (including inside sections).
     *
     * @param {Object|null} adapted
     * @return {boolean}
     */
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
    function can_export_from_builder() {
      return !!(w.wpbc_bfb && typeof w.wpbc_bfb.get_structure === 'function' && w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.export_all === 'function');
    }
    function export_all_from_builder() {
      if (!can_export_from_builder()) {
        return null;
      }
      try {
        return w.WPBC_BFB_Exporter.export_all(w.wpbc_bfb.get_structure(), {
          gapPercent: 3
        });
      } catch (e) {
        return null;
      }
    }

    // Prevent “wrapper-only / empty” early exports.
    function export_output_looks_ready(out) {
      if (!out) {
        return false;
      }
      var af = out.advanced_form == null ? '' : String(out.advanced_form).trim();
      var cf = out.fields_data == null ? '' : String(out.fields_data).trim();
      if (!af && !cf) {
        return false;
      }

      // If structure is loaded and there are NO fields anywhere, accept empty export.
      // (Empty form should still regenerate to a valid wrapper+step markup.)
      if (structure_loaded_once && !adapted_has_any_field(out.adapted)) {
        return true;
      }

      // Real export usually includes <item> at least.
      var has_any_item = /<\s*item\b/i.test(af) || /<\s*item\b/i.test(cf);
      return has_any_item;
    }
    function apply_snapshot(values) {
      // Update both textarea and CodeMirror (if inited).
      Editor.ensure_inited();
      Editor.set_value(KEY.FORM, values.advanced_form || '');
      Editor.set_value(KEY.CONTENT, values.content_form || '');
    }
    function refresh_snapshot() {
      var out = export_all_from_builder();
      if (!out || !export_output_looks_ready(out)) {
        return false;
      }
      last_good.advanced_form = String(out.advanced_form || '');
      last_good.content_form = String(out.fields_data || '');
      apply_snapshot(last_good);
      return true;
    }
    function schedule_refresh(ms) {
      if (debounce_id) {
        clearTimeout(debounce_id);
      }
      debounce_id = setTimeout(function () {
        debounce_id = null;
        refresh_snapshot();
      }, ms);
    }
    function get_values() {
      // Try to refresh now; fallback to last_good if exporter not ready.
      refresh_snapshot();
      return {
        advanced_form: String(last_good.advanced_form || ''),
        content_form: String(last_good.content_form || ''),
        is_dirty: false
      };
    }
    return {
      refresh_now: refresh_snapshot,
      schedule_refresh: schedule_refresh,
      get_values: get_values
    };
  }();

  // == Events ============================================================================================
  var Events = function () {
    function hook() {
      // Structure loaded: immediate + delayed refresh (exporter can be late).
      DOM.on('wpbc:bfb:structure:loaded', function () {
        structure_loaded_once = true;
        Bridge.refresh_now();
        Bridge.schedule_refresh(200);
        setTimeout(Editor.refresh_all, 60);
      });

      // Structure changed: debounce refresh.
      DOM.on('wpbc:bfb:structure:change', function () {
        Bridge.schedule_refresh(250);
      });

      // If you still have an “advanced” tab/panel visible in Free, CodeMirror may need refresh.
      DOM.on('wpbc:bfb:top-tab', function () {
        setTimeout(Editor.refresh_all, 60);
      });
    }
    return {
      hook: hook
    };
  }();

  // == Public API (same as Pro) ===========================================================================
  w.wpbc_bfb_advanced_editor_api = w.wpbc_bfb_advanced_editor_api || {};
  w.wpbc_bfb_advanced_editor_api.get_values = function () {
    return Bridge.get_values();
  };

  // Compatibility no-op.
  w.wpbc_bfb_advanced_editor_api.set_dirty = function () {};

  // == Boot ==============================================================================================
  DOM.on('DOMContentLoaded', function () {
    // Init editor if textareas exist.
    if (DOM.has_textareas()) {
      Editor.ensure_inited();
      Bridge.refresh_now();
      setTimeout(Editor.refresh_all, 60);
    }
    Events.hook();
  });
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvYWR2YW5jZWQtbW9kZS9fb3V0L2JmYi1hZHZhbmNlZC1mcmVlLmpzIiwibmFtZXMiOlsidyIsImQiLCJzdHJ1Y3R1cmVfbG9hZGVkX29uY2UiLCJJRFMiLCJ0YV9mb3JtIiwidGFfY29udGVudCIsIktFWSIsIkZPUk0iLCJDT05URU5UIiwiVEFfSURfQllfS0VZIiwiRE9NIiwiZ2V0X2J5X2lkIiwiaWQiLCJnZXRFbGVtZW50QnlJZCIsImhhc190ZXh0YXJlYXMiLCJvbiIsInR5cGUiLCJmbiIsImFkZEV2ZW50TGlzdGVuZXIiLCJnZXQiLCJFZGl0b3IiLCJpc19pbml0ZWQiLCJlZGl0b3JzIiwiaXNfb3Nob3J0Y29kZV9kZWZpbmVkIiwiY2FuX2luaXRfY29kZW1pcnJvciIsIndwbnMiLCJ3cCIsImNvZGVFZGl0b3IiLCJpbml0aWFsaXplIiwid3BiY19iZmJfY29kZV9lZGl0b3Jfc2V0dGluZ3MiLCJlbnN1cmVfb3Nob3J0Y29kZV9tb2RlIiwiQ00iLCJDb2RlTWlycm9yIiwiZGVmaW5lTW9kZSIsImNvbmZpZyIsInBhcnNlckNvbmZpZyIsIm92ZXJsYXkiLCJ0b2tlbiIsInN0cmVhbSIsImNoIiwibWF0Y2giLCJuZXh0IiwiYmFzZSIsImdldE1vZGUiLCJiYWNrZHJvcCIsIm92ZXJsYXlNb2RlIiwiaW5pdF9vbmUiLCJ0ZXh0YXJlYV9lbCIsImtleSIsInNldHRpbmdzIiwiT2JqZWN0IiwiYXNzaWduIiwiY29kZW1pcnJvciIsIm1vZGUiLCJyZWFkT25seSIsInN0eWxlQWN0aXZlTGluZSIsImN1cnNvckJsaW5rUmF0ZSIsImluc3QiLCJlbnN1cmVfaW5pdGVkIiwidGFfY250IiwidGV4dGFyZWFfaWRfZm9yIiwic2V0X3ZhbHVlIiwidmFsdWUiLCJTdHJpbmciLCJ0YSIsInNldFZhbHVlIiwic2F2ZSIsImUiLCJyZWZyZXNoX2FsbCIsImtleXMiLCJpIiwibGVuZ3RoIiwicmVmcmVzaCIsInJvb3QiLCJkb2N1bWVudEVsZW1lbnQiLCJzZXRBdHRyaWJ1dGUiLCJCcmlkZ2UiLCJsYXN0X2dvb2QiLCJhZHZhbmNlZF9mb3JtIiwiY29udGVudF9mb3JtIiwiZGVib3VuY2VfaWQiLCJhZGFwdGVkX2hhc19hbnlfZmllbGQiLCJhZGFwdGVkIiwiQXJyYXkiLCJpc0FycmF5IiwicGFnZXMiLCJoYXMiLCJ3YWxrX3NlY3Rpb24iLCJzZWMiLCJjb2xzIiwiY29sdW1ucyIsImNvbCIsImZpZWxkcyIsIm5lc3RlZCIsInNlY3Rpb25zIiwiaiIsInAiLCJwYWdlIiwiaXRlbXMiLCJrIiwiaXQiLCJraW5kIiwiZGF0YSIsImNhbl9leHBvcnRfZnJvbV9idWlsZGVyIiwid3BiY19iZmIiLCJnZXRfc3RydWN0dXJlIiwiV1BCQ19CRkJfRXhwb3J0ZXIiLCJleHBvcnRfYWxsIiwiZXhwb3J0X2FsbF9mcm9tX2J1aWxkZXIiLCJnYXBQZXJjZW50IiwiZXhwb3J0X291dHB1dF9sb29rc19yZWFkeSIsIm91dCIsImFmIiwidHJpbSIsImNmIiwiZmllbGRzX2RhdGEiLCJoYXNfYW55X2l0ZW0iLCJ0ZXN0IiwiYXBwbHlfc25hcHNob3QiLCJ2YWx1ZXMiLCJyZWZyZXNoX3NuYXBzaG90Iiwic2NoZWR1bGVfcmVmcmVzaCIsIm1zIiwiY2xlYXJUaW1lb3V0Iiwic2V0VGltZW91dCIsImdldF92YWx1ZXMiLCJpc19kaXJ0eSIsInJlZnJlc2hfbm93IiwiRXZlbnRzIiwiaG9vayIsIndwYmNfYmZiX2FkdmFuY2VkX2VkaXRvcl9hcGkiLCJzZXRfZGlydHkiLCJ3aW5kb3ciLCJkb2N1bWVudCJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2FkdmFuY2VkLW1vZGUvX3NyYy9iZmItYWR2YW5jZWQtZnJlZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxyXG4gKiBBZHZhbmNlZCBNb2RlIEJyaWRnZSAoRlJFRSkgKyBDb2RlTWlycm9yIEhpZ2hsaWdodGluZzpcclxuICogLSBCdWlsZGVyIGlzIHRoZSBvbmx5IGVkaXRvci5cclxuICogLSBBbHdheXMgc3luYyBPTiAoQWR2YW5jZWQgdGV4dCA9IEJ1aWxkZXIgZXhwb3J0KS5cclxuICogLSBDb2RlTWlycm9yIHJlYWQtb25seSBoaWdobGlnaHRpbmcgZm9yIHRleHRhcmVhcyAob3Nob3J0Y29kZSBvdmVybGF5KS5cclxuICogLSBQcm92aWRlcyB3cGJjX2JmYl9hZHZhbmNlZF9lZGl0b3JfYXBpLmdldF92YWx1ZXMoKSBmb3IgU2F2ZS9QcmV2aWV3LlxyXG4gKlxyXG4gKiBAZmlsZSAuLi9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9hZHZhbmNlZC1tb2RlL19vdXQvYmZiLWFkdmFuY2VkLWZyZWUuanNcclxuICovXHJcbihmdW5jdGlvbiAodywgZCkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0Ly8gVHJ1ZSBhZnRlciB3cGJjOmJmYjpzdHJ1Y3R1cmU6bG9hZGVkIGZpcmVkIGF0IGxlYXN0IG9uY2UuXHJcblx0dmFyIHN0cnVjdHVyZV9sb2FkZWRfb25jZSA9IGZhbHNlO1xyXG5cclxuXHQvLyA9PSBDb25zdGFudHMgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHR2YXIgSURTID0ge1xyXG5cdFx0dGFfZm9ybSAgIDogJ3dwYmNfYmZiX19hZHZhbmNlZF9mb3JtX2VkaXRvcicsXHJcblx0XHR0YV9jb250ZW50OiAnd3BiY19iZmJfX2NvbnRlbnRfZm9ybV9lZGl0b3InXHJcblx0fTtcclxuXHJcblx0dmFyIEtFWSA9IHtcclxuXHRcdEZPUk0gICA6ICdhZHZhbmNlZF9mb3JtJyxcclxuXHRcdENPTlRFTlQ6ICdjb250ZW50X2Zvcm0nXHJcblx0fTtcclxuXHJcblx0dmFyIFRBX0lEX0JZX0tFWSAgICAgICAgICA9IHt9O1xyXG5cdFRBX0lEX0JZX0tFWVtLRVkuRk9STV0gICAgPSBJRFMudGFfZm9ybTtcclxuXHRUQV9JRF9CWV9LRVlbS0VZLkNPTlRFTlRdID0gSURTLnRhX2NvbnRlbnQ7XHJcblxyXG5cdC8vID09IERPTSA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cdHZhciBET00gPSAoZnVuY3Rpb24gKCkge1xyXG5cclxuXHRcdGZ1bmN0aW9uIGdldF9ieV9pZChpZCkge1xyXG5cdFx0XHRyZXR1cm4gZC5nZXRFbGVtZW50QnlJZCggaWQgKTtcclxuXHRcdH1cclxuXHJcblx0XHRmdW5jdGlvbiBoYXNfdGV4dGFyZWFzKCkge1xyXG5cdFx0XHRyZXR1cm4gISEgKGdldF9ieV9pZCggSURTLnRhX2Zvcm0gKSAmJiBnZXRfYnlfaWQoIElEUy50YV9jb250ZW50ICkpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZ1bmN0aW9uIG9uKHR5cGUsIGZuKSB7XHJcblx0XHRcdGQuYWRkRXZlbnRMaXN0ZW5lciggdHlwZSwgZm4gKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRnZXQgICAgICAgICAgOiBnZXRfYnlfaWQsXHJcblx0XHRcdGhhc190ZXh0YXJlYXM6IGhhc190ZXh0YXJlYXMsXHJcblx0XHRcdG9uICAgICAgICAgICA6IG9uXHJcblx0XHR9O1xyXG5cdH0pKCk7XHJcblxyXG5cdC8vID09IEVkaXRvciAoQ29kZU1pcnJvciByZWFkb25seSArIG9zaG9ydGNvZGUgaGlnaGxpZ2h0aW5nKSA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cdHZhciBFZGl0b3IgPSAoZnVuY3Rpb24gKCkge1xyXG5cclxuXHRcdHZhciBpc19pbml0ZWQgICAgICAgID0gZmFsc2U7XHJcblx0XHR2YXIgZWRpdG9ycyAgICAgICAgICA9IHt9OyAvLyBrZXkgLT4gd3AuY29kZUVkaXRvciBpbnN0YW5jZSAob3IgbnVsbClcclxuXHRcdGVkaXRvcnNbS0VZLkZPUk1dICAgID0gbnVsbDtcclxuXHRcdGVkaXRvcnNbS0VZLkNPTlRFTlRdID0gbnVsbDtcclxuXHJcblx0XHR2YXIgaXNfb3Nob3J0Y29kZV9kZWZpbmVkID0gZmFsc2U7XHJcblxyXG5cdFx0ZnVuY3Rpb24gY2FuX2luaXRfY29kZW1pcnJvcigpIHtcclxuXHRcdFx0dmFyIHdwbnMgPSB3LndwIHx8IG51bGw7XHJcblx0XHRcdHJldHVybiAhISAoXHJcblx0XHRcdFx0d3BucyAmJlxyXG5cdFx0XHRcdHdwbnMuY29kZUVkaXRvciAmJlxyXG5cdFx0XHRcdHR5cGVvZiB3cG5zLmNvZGVFZGl0b3IuaW5pdGlhbGl6ZSA9PT0gJ2Z1bmN0aW9uJyAmJlxyXG5cdFx0XHRcdHcud3BiY19iZmJfY29kZV9lZGl0b3Jfc2V0dGluZ3NcclxuXHRcdFx0KTtcclxuXHRcdH1cclxuXHJcblx0XHRmdW5jdGlvbiBlbnN1cmVfb3Nob3J0Y29kZV9tb2RlKCkge1xyXG5cdFx0XHRpZiAoIGlzX29zaG9ydGNvZGVfZGVmaW5lZCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBDTSA9ICh3LndwICYmIHcud3AuQ29kZU1pcnJvcikgPyB3LndwLkNvZGVNaXJyb3IgOiBudWxsO1xyXG5cdFx0XHRpZiAoICEgQ00gfHwgdHlwZW9mIENNLmRlZmluZU1vZGUgIT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRDTS5kZWZpbmVNb2RlKCAnb3Nob3J0Y29kZScsIGZ1bmN0aW9uIChjb25maWcsIHBhcnNlckNvbmZpZykge1xyXG5cclxuXHRcdFx0XHR2YXIgb3ZlcmxheSA9IHtcclxuXHRcdFx0XHRcdHRva2VuOiBmdW5jdGlvbiAoc3RyZWFtKSB7XHJcblx0XHRcdFx0XHRcdHZhciBjaDtcclxuXHJcblx0XHRcdFx0XHRcdC8vIFtuYW1lIC4uLl0gb3IgW25hbWUqIC4uLl1cclxuXHRcdFx0XHRcdFx0aWYgKCBzdHJlYW0ubWF0Y2goIC9eXFxbKFthLXpBLVowLTlfXSspXFwqP1xccz8vICkgKSB7XHJcblx0XHRcdFx0XHRcdFx0d2hpbGUgKCAoY2ggPSBzdHJlYW0ubmV4dCgpKSAhPSBudWxsICkge1xyXG5cdFx0XHRcdFx0XHRcdFx0aWYgKCBjaCA9PT0gJ10nICkge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gJ29zaG9ydGNvZGUnO1xyXG5cdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0d2hpbGUgKCBzdHJlYW0ubmV4dCgpICE9IG51bGwgJiYgISBzdHJlYW0ubWF0Y2goIC9eXFxbKFthLXpBLVowLTlfXSspXFwqP1xccz8vLCBmYWxzZSApICkge31cclxuXHRcdFx0XHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0dmFyIGJhc2UgPSBDTS5nZXRNb2RlKCBjb25maWcsIChwYXJzZXJDb25maWcgJiYgcGFyc2VyQ29uZmlnLmJhY2tkcm9wKSB8fCAnaHRtbG1peGVkJyApO1xyXG5cclxuXHRcdFx0XHQvLyBGYWxsYmFjayBpZiBvdmVybGF5IGFkZG9uIGlzIG1pc3NpbmcuXHJcblx0XHRcdFx0aWYgKCB0eXBlb2YgQ00ub3ZlcmxheU1vZGUgIT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gYmFzZTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiBDTS5vdmVybGF5TW9kZSggYmFzZSwgb3ZlcmxheSApO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRpc19vc2hvcnRjb2RlX2RlZmluZWQgPSB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZ1bmN0aW9uIGluaXRfb25lKHRleHRhcmVhX2VsLCBrZXkpIHtcclxuXHRcdFx0dmFyIHdwbnMgPSB3LndwIHx8IG51bGw7XHJcblx0XHRcdGlmICggISB0ZXh0YXJlYV9lbCB8fCAhIHdwbnMgfHwgISB3cG5zLmNvZGVFZGl0b3IgfHwgdHlwZW9mIHdwbnMuY29kZUVkaXRvci5pbml0aWFsaXplICE9PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgYmFzZSA9IHcud3BiY19iZmJfY29kZV9lZGl0b3Jfc2V0dGluZ3MgfHwgbnVsbDtcclxuXHRcdFx0aWYgKCAhIGJhc2UgKSB7XHJcblx0XHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGVuc3VyZV9vc2hvcnRjb2RlX21vZGUoKTtcclxuXHJcblx0XHRcdC8vIENsb25lIHNvIHdlIGRvbid0IG11dGF0ZSBsb2NhbGl6ZWQgc2hhcmVkIHNldHRpbmdzIG9iamVjdC5cclxuXHRcdFx0dmFyIHNldHRpbmdzICAgICAgICA9IE9iamVjdC5hc3NpZ24oIHt9LCBiYXNlICk7XHJcblx0XHRcdHNldHRpbmdzLmNvZGVtaXJyb3IgPSBPYmplY3QuYXNzaWduKCB7fSwgYmFzZS5jb2RlbWlycm9yIHx8IHt9ICk7XHJcblxyXG5cdFx0XHQvLyBIaWdobGlnaHQgc2hvcnRjb2RlcyBpbiBIVE1MLWxpa2UgbWFya3VwLlxyXG5cdFx0XHRzZXR0aW5ncy5jb2RlbWlycm9yLm1vZGUgPSAnb3Nob3J0Y29kZSc7XHJcblxyXG5cdFx0XHQvLyBGUkVFOiByZWFkLW9ubHkgZWRpdG9yIChzdGlsbCBzZWxlY3RhYmxlL2NvcHlhYmxlKS5cclxuXHRcdFx0c2V0dGluZ3MuY29kZW1pcnJvci5yZWFkT25seSA9IHRydWU7XHJcblxyXG5cdFx0XHQvLyBOaWNlIFVYIGZvciByZWFkLW9ubHk6XHJcblx0XHRcdC8vIC0gbm8gYWN0aXZlIGxpbmUgaGlnaGxpZ2h0IGluIHNvbWUgdGhlbWVzXHJcblx0XHRcdC8vIC0gbm8gY3Vyc29yIGJsaW5raW5nIGRpc3RyYWN0aW9uXHJcblx0XHRcdHNldHRpbmdzLmNvZGVtaXJyb3Iuc3R5bGVBY3RpdmVMaW5lID0gZmFsc2U7XHJcblx0XHRcdHNldHRpbmdzLmNvZGVtaXJyb3IuY3Vyc29yQmxpbmtSYXRlID0gLTE7XHJcblxyXG5cdFx0XHR2YXIgaW5zdCAgICAgPSB3cG5zLmNvZGVFZGl0b3IuaW5pdGlhbGl6ZSggdGV4dGFyZWFfZWwsIHNldHRpbmdzICk7XHJcblx0XHRcdGVkaXRvcnNba2V5XSA9IGluc3QgfHwgbnVsbDtcclxuXHJcblx0XHRcdHJldHVybiBpbnN0IHx8IG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gZW5zdXJlX2luaXRlZCgpIHtcclxuXHRcdFx0aWYgKCBpc19pbml0ZWQgKSB7XHJcblx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciB0YV9mb3JtID0gRE9NLmdldCggSURTLnRhX2Zvcm0gKTtcclxuXHRcdFx0dmFyIHRhX2NudCAgPSBET00uZ2V0KCBJRFMudGFfY29udGVudCApO1xyXG5cclxuXHRcdFx0aWYgKCAhIHRhX2Zvcm0gfHwgISB0YV9jbnQgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBJbml0aWFsaXplIENvZGVNaXJyb3IgaWYgcG9zc2libGU7IG90aGVyd2lzZSwgcGxhaW4gdGV4dGFyZWEgZmFsbGJhY2suXHJcblx0XHRcdGlmICggY2FuX2luaXRfY29kZW1pcnJvcigpICkge1xyXG5cdFx0XHRcdGluaXRfb25lKCB0YV9mb3JtLCBLRVkuRk9STSApO1xyXG5cdFx0XHRcdGluaXRfb25lKCB0YV9jbnQsIEtFWS5DT05URU5UICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlzX2luaXRlZCA9IHRydWU7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZ1bmN0aW9uIHRleHRhcmVhX2lkX2ZvcihrZXkpIHtcclxuXHRcdFx0cmV0dXJuIFRBX0lEX0JZX0tFWVtrZXldIHx8ICcnO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZ1bmN0aW9uIHNldF92YWx1ZShrZXksIHZhbHVlKSB7XHJcblx0XHRcdHZhbHVlID0gKHZhbHVlID09IG51bGwpID8gJycgOiBTdHJpbmcoIHZhbHVlICk7XHJcblxyXG5cdFx0XHR2YXIgdGEgPSBET00uZ2V0KCB0ZXh0YXJlYV9pZF9mb3IoIGtleSApICk7XHJcblx0XHRcdGlmICggdGEgKSB7XHJcblx0XHRcdFx0dGEudmFsdWUgPSB2YWx1ZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dmFyIGluc3QgPSBlZGl0b3JzW2tleV07XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0aWYgKCBpbnN0ICYmIGluc3QuY29kZW1pcnJvciAmJiB0eXBlb2YgaW5zdC5jb2RlbWlycm9yLnNldFZhbHVlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0aW5zdC5jb2RlbWlycm9yLnNldFZhbHVlKCB2YWx1ZSApO1xyXG5cdFx0XHRcdFx0aWYgKCB0eXBlb2YgaW5zdC5jb2RlbWlycm9yLnNhdmUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdGluc3QuY29kZW1pcnJvci5zYXZlKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGNhdGNoICggZSApIHt9XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gcmVmcmVzaF9hbGwoKSB7XHJcblx0XHRcdHZhciBrZXlzID0gT2JqZWN0LmtleXMoIGVkaXRvcnMgKTtcclxuXHRcdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0XHR2YXIgaW5zdCA9IGVkaXRvcnNba2V5c1tpXV07XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdGlmICggaW5zdCAmJiBpbnN0LmNvZGVtaXJyb3IgJiYgdHlwZW9mIGluc3QuY29kZW1pcnJvci5yZWZyZXNoID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRpbnN0LmNvZGVtaXJyb3IucmVmcmVzaCgpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gY2F0Y2ggKCBlICkge31cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dmFyIHJvb3QgPSBkLmRvY3VtZW50RWxlbWVudDtcclxuXHRcdFx0aWYgKCAhIHJvb3QgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJvb3Quc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJmYi1saXZlLXNvdXJjZScsICdidWlsZGVyJyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdGVuc3VyZV9pbml0ZWQ6IGVuc3VyZV9pbml0ZWQsXHJcblx0XHRcdHNldF92YWx1ZSAgICA6IHNldF92YWx1ZSxcclxuXHRcdFx0cmVmcmVzaF9hbGwgIDogcmVmcmVzaF9hbGxcclxuXHRcdH07XHJcblx0fSkoKTtcclxuXHJcblx0Ly8gPT0gQnJpZGdlIChCdWlsZGVyIGV4cG9ydCAtPiBzbmFwc2hvdCAtPiBlZGl0b3IvdGV4dGFyZWEpID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0dmFyIEJyaWRnZSA9IChmdW5jdGlvbiAoKSB7XHJcblxyXG5cdFx0dmFyIGxhc3RfZ29vZCAgID0geyBhZHZhbmNlZF9mb3JtOiAnJywgY29udGVudF9mb3JtOiAnJyB9O1xyXG5cdFx0dmFyIGRlYm91bmNlX2lkID0gbnVsbDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENoZWNrIGlmIGFkYXB0ZWQgc3RydWN0dXJlIGNvbnRhaW5zIEFOWSBmaWVsZCAoaW5jbHVkaW5nIGluc2lkZSBzZWN0aW9ucykuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R8bnVsbH0gYWRhcHRlZFxyXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gYWRhcHRlZF9oYXNfYW55X2ZpZWxkKGFkYXB0ZWQpIHtcclxuXHRcdFx0aWYgKCAhIGFkYXB0ZWQgfHwgISBBcnJheS5pc0FycmF5KCBhZGFwdGVkLnBhZ2VzICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgaGFzID0gZmFsc2U7XHJcblxyXG5cdFx0XHRmdW5jdGlvbiB3YWxrX3NlY3Rpb24oc2VjKSB7XHJcblx0XHRcdFx0aWYgKCBoYXMgfHwgISBzZWMgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHZhciBjb2xzID0gQXJyYXkuaXNBcnJheSggc2VjLmNvbHVtbnMgKSA/IHNlYy5jb2x1bW5zIDogW107XHJcblx0XHRcdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwgY29scy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0XHRcdHZhciBjb2wgPSBjb2xzW2ldIHx8IHt9O1xyXG5cdFx0XHRcdFx0aWYgKCBBcnJheS5pc0FycmF5KCBjb2wuZmllbGRzICkgJiYgY29sLmZpZWxkcy5sZW5ndGggKSB7XHJcblx0XHRcdFx0XHRcdGhhcyA9IHRydWU7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHZhciBuZXN0ZWQgPSBBcnJheS5pc0FycmF5KCBjb2wuc2VjdGlvbnMgKSA/IGNvbC5zZWN0aW9ucyA6IFtdO1xyXG5cdFx0XHRcdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgbmVzdGVkLmxlbmd0aDsgaisrICkge1xyXG5cdFx0XHRcdFx0XHR3YWxrX3NlY3Rpb24oIG5lc3RlZFtqXSApO1xyXG5cdFx0XHRcdFx0XHRpZiAoIGhhcyApIHtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGZvciAoIHZhciBwID0gMDsgcCA8IGFkYXB0ZWQucGFnZXMubGVuZ3RoOyBwKysgKSB7XHJcblx0XHRcdFx0dmFyIHBhZ2UgPSBhZGFwdGVkLnBhZ2VzW3BdIHx8IHt9O1xyXG5cdFx0XHRcdHZhciBpdGVtcyA9IEFycmF5LmlzQXJyYXkoIHBhZ2UuaXRlbXMgKSA/IHBhZ2UuaXRlbXMgOiBbXTtcclxuXHRcdFx0XHRmb3IgKCB2YXIgayA9IDA7IGsgPCBpdGVtcy5sZW5ndGg7IGsrKyApIHtcclxuXHRcdFx0XHRcdHZhciBpdCA9IGl0ZW1zW2tdIHx8IHt9O1xyXG5cdFx0XHRcdFx0aWYgKCBpdC5raW5kID09PSAnZmllbGQnICkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlmICggaXQua2luZCA9PT0gJ3NlY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHR3YWxrX3NlY3Rpb24oIGl0LmRhdGEgKTtcclxuXHRcdFx0XHRcdFx0aWYgKCBoYXMgKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBoYXM7XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gY2FuX2V4cG9ydF9mcm9tX2J1aWxkZXIoKSB7XHJcblx0XHRcdHJldHVybiAhISAoXHJcblx0XHRcdFx0dy53cGJjX2JmYiAmJlxyXG5cdFx0XHRcdHR5cGVvZiB3LndwYmNfYmZiLmdldF9zdHJ1Y3R1cmUgPT09ICdmdW5jdGlvbicgJiZcclxuXHRcdFx0XHR3LldQQkNfQkZCX0V4cG9ydGVyICYmXHJcblx0XHRcdFx0dHlwZW9mIHcuV1BCQ19CRkJfRXhwb3J0ZXIuZXhwb3J0X2FsbCA9PT0gJ2Z1bmN0aW9uJ1xyXG5cdFx0XHQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZ1bmN0aW9uIGV4cG9ydF9hbGxfZnJvbV9idWlsZGVyKCkge1xyXG5cdFx0XHRpZiAoICEgY2FuX2V4cG9ydF9mcm9tX2J1aWxkZXIoKSApIHtcclxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdFx0fVxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHJldHVybiB3LldQQkNfQkZCX0V4cG9ydGVyLmV4cG9ydF9hbGwoIHcud3BiY19iZmIuZ2V0X3N0cnVjdHVyZSgpLCB7IGdhcFBlcmNlbnQ6IDMgfSApO1xyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFByZXZlbnQg4oCcd3JhcHBlci1vbmx5IC8gZW1wdHnigJ0gZWFybHkgZXhwb3J0cy5cclxuXHRcdGZ1bmN0aW9uIGV4cG9ydF9vdXRwdXRfbG9va3NfcmVhZHkob3V0KSB7XHJcblx0XHRcdGlmICggISBvdXQgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgYWYgPSAob3V0LmFkdmFuY2VkX2Zvcm0gPT0gbnVsbCkgPyAnJyA6IFN0cmluZyggb3V0LmFkdmFuY2VkX2Zvcm0gKS50cmltKCk7XHJcblx0XHRcdHZhciBjZiA9IChvdXQuZmllbGRzX2RhdGEgPT0gbnVsbCkgPyAnJyA6IFN0cmluZyggb3V0LmZpZWxkc19kYXRhICkudHJpbSgpO1xyXG5cdFx0XHRpZiAoICEgYWYgJiYgISBjZiApIHtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIElmIHN0cnVjdHVyZSBpcyBsb2FkZWQgYW5kIHRoZXJlIGFyZSBOTyBmaWVsZHMgYW55d2hlcmUsIGFjY2VwdCBlbXB0eSBleHBvcnQuXHJcblx0XHRcdC8vIChFbXB0eSBmb3JtIHNob3VsZCBzdGlsbCByZWdlbmVyYXRlIHRvIGEgdmFsaWQgd3JhcHBlcitzdGVwIG1hcmt1cC4pXHJcblx0XHRcdGlmICggc3RydWN0dXJlX2xvYWRlZF9vbmNlICYmICEgYWRhcHRlZF9oYXNfYW55X2ZpZWxkKCBvdXQuYWRhcHRlZCApICkge1xyXG5cdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBSZWFsIGV4cG9ydCB1c3VhbGx5IGluY2x1ZGVzIDxpdGVtPiBhdCBsZWFzdC5cclxuXHRcdFx0dmFyIGhhc19hbnlfaXRlbSA9IC88XFxzKml0ZW1cXGIvaS50ZXN0KCBhZiApIHx8IC88XFxzKml0ZW1cXGIvaS50ZXN0KCBjZiApO1xyXG5cdFx0XHRyZXR1cm4gaGFzX2FueV9pdGVtO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZ1bmN0aW9uIGFwcGx5X3NuYXBzaG90KHZhbHVlcykge1xyXG5cdFx0XHQvLyBVcGRhdGUgYm90aCB0ZXh0YXJlYSBhbmQgQ29kZU1pcnJvciAoaWYgaW5pdGVkKS5cclxuXHRcdFx0RWRpdG9yLmVuc3VyZV9pbml0ZWQoKTtcclxuXHRcdFx0RWRpdG9yLnNldF92YWx1ZSggS0VZLkZPUk0sIHZhbHVlcy5hZHZhbmNlZF9mb3JtIHx8ICcnICk7XHJcblx0XHRcdEVkaXRvci5zZXRfdmFsdWUoIEtFWS5DT05URU5ULCB2YWx1ZXMuY29udGVudF9mb3JtIHx8ICcnICk7XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gcmVmcmVzaF9zbmFwc2hvdCgpIHtcclxuXHRcdFx0dmFyIG91dCA9IGV4cG9ydF9hbGxfZnJvbV9idWlsZGVyKCk7XHJcblx0XHRcdGlmICggISBvdXQgfHwgISBleHBvcnRfb3V0cHV0X2xvb2tzX3JlYWR5KCBvdXQgKSApIHtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGxhc3RfZ29vZC5hZHZhbmNlZF9mb3JtID0gU3RyaW5nKCBvdXQuYWR2YW5jZWRfZm9ybSB8fCAnJyApO1xyXG5cdFx0XHRsYXN0X2dvb2QuY29udGVudF9mb3JtICA9IFN0cmluZyggb3V0LmZpZWxkc19kYXRhIHx8ICcnICk7XHJcblxyXG5cdFx0XHRhcHBseV9zbmFwc2hvdCggbGFzdF9nb29kICk7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZ1bmN0aW9uIHNjaGVkdWxlX3JlZnJlc2gobXMpIHtcclxuXHRcdFx0aWYgKCBkZWJvdW5jZV9pZCApIHtcclxuXHRcdFx0XHRjbGVhclRpbWVvdXQoIGRlYm91bmNlX2lkICk7XHJcblx0XHRcdH1cclxuXHRcdFx0ZGVib3VuY2VfaWQgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0ZGVib3VuY2VfaWQgPSBudWxsO1xyXG5cdFx0XHRcdHJlZnJlc2hfc25hcHNob3QoKTtcclxuXHRcdFx0fSwgbXMgKTtcclxuXHRcdH1cclxuXHJcblx0XHRmdW5jdGlvbiBnZXRfdmFsdWVzKCkge1xyXG5cdFx0XHQvLyBUcnkgdG8gcmVmcmVzaCBub3c7IGZhbGxiYWNrIHRvIGxhc3RfZ29vZCBpZiBleHBvcnRlciBub3QgcmVhZHkuXHJcblx0XHRcdHJlZnJlc2hfc25hcHNob3QoKTtcclxuXHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHRhZHZhbmNlZF9mb3JtOiBTdHJpbmcoIGxhc3RfZ29vZC5hZHZhbmNlZF9mb3JtIHx8ICcnICksXHJcblx0XHRcdFx0Y29udGVudF9mb3JtIDogU3RyaW5nKCBsYXN0X2dvb2QuY29udGVudF9mb3JtIHx8ICcnICksXHJcblx0XHRcdFx0aXNfZGlydHkgICAgIDogZmFsc2VcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRyZWZyZXNoX25vdyAgICAgOiByZWZyZXNoX3NuYXBzaG90LFxyXG5cdFx0XHRzY2hlZHVsZV9yZWZyZXNoOiBzY2hlZHVsZV9yZWZyZXNoLFxyXG5cdFx0XHRnZXRfdmFsdWVzICAgICAgOiBnZXRfdmFsdWVzXHJcblx0XHR9O1xyXG5cdH0pKCk7XHJcblxyXG5cdC8vID09IEV2ZW50cyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cdHZhciBFdmVudHMgPSAoZnVuY3Rpb24gKCkge1xyXG5cclxuXHRcdGZ1bmN0aW9uIGhvb2soKSB7XHJcblxyXG5cdFx0XHQvLyBTdHJ1Y3R1cmUgbG9hZGVkOiBpbW1lZGlhdGUgKyBkZWxheWVkIHJlZnJlc2ggKGV4cG9ydGVyIGNhbiBiZSBsYXRlKS5cclxuXHRcdFx0RE9NLm9uKCAnd3BiYzpiZmI6c3RydWN0dXJlOmxvYWRlZCcsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRzdHJ1Y3R1cmVfbG9hZGVkX29uY2UgPSB0cnVlO1xyXG5cdFx0XHRcdEJyaWRnZS5yZWZyZXNoX25vdygpO1xyXG5cdFx0XHRcdEJyaWRnZS5zY2hlZHVsZV9yZWZyZXNoKCAyMDAgKTtcclxuXHRcdFx0XHRzZXRUaW1lb3V0KCBFZGl0b3IucmVmcmVzaF9hbGwsIDYwICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdC8vIFN0cnVjdHVyZSBjaGFuZ2VkOiBkZWJvdW5jZSByZWZyZXNoLlxyXG5cdFx0XHRET00ub24oICd3cGJjOmJmYjpzdHJ1Y3R1cmU6Y2hhbmdlJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdEJyaWRnZS5zY2hlZHVsZV9yZWZyZXNoKCAyNTAgKTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Ly8gSWYgeW91IHN0aWxsIGhhdmUgYW4g4oCcYWR2YW5jZWTigJ0gdGFiL3BhbmVsIHZpc2libGUgaW4gRnJlZSwgQ29kZU1pcnJvciBtYXkgbmVlZCByZWZyZXNoLlxyXG5cdFx0XHRET00ub24oICd3cGJjOmJmYjp0b3AtdGFiJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHNldFRpbWVvdXQoIEVkaXRvci5yZWZyZXNoX2FsbCwgNjAgKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7IGhvb2s6IGhvb2sgfTtcclxuXHR9KSgpO1xyXG5cclxuXHQvLyA9PSBQdWJsaWMgQVBJIChzYW1lIGFzIFBybykgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0dy53cGJjX2JmYl9hZHZhbmNlZF9lZGl0b3JfYXBpID0gdy53cGJjX2JmYl9hZHZhbmNlZF9lZGl0b3JfYXBpIHx8IHt9O1xyXG5cclxuXHR3LndwYmNfYmZiX2FkdmFuY2VkX2VkaXRvcl9hcGkuZ2V0X3ZhbHVlcyA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiBCcmlkZ2UuZ2V0X3ZhbHVlcygpO1xyXG5cdH07XHJcblxyXG5cdC8vIENvbXBhdGliaWxpdHkgbm8tb3AuXHJcblx0dy53cGJjX2JmYl9hZHZhbmNlZF9lZGl0b3JfYXBpLnNldF9kaXJ0eSA9IGZ1bmN0aW9uICgpIHtcclxuXHR9O1xyXG5cclxuXHQvLyA9PSBCb290ID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHRET00ub24oICdET01Db250ZW50TG9hZGVkJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0Ly8gSW5pdCBlZGl0b3IgaWYgdGV4dGFyZWFzIGV4aXN0LlxyXG5cdFx0aWYgKCBET00uaGFzX3RleHRhcmVhcygpICkge1xyXG5cdFx0XHRFZGl0b3IuZW5zdXJlX2luaXRlZCgpO1xyXG5cdFx0XHRCcmlkZ2UucmVmcmVzaF9ub3coKTtcclxuXHRcdFx0c2V0VGltZW91dCggRWRpdG9yLnJlZnJlc2hfYWxsLCA2MCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdEV2ZW50cy5ob29rKCk7XHJcblx0fSApO1xyXG59KSggd2luZG93LCBkb2N1bWVudCApO1xyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQyxVQUFVQSxDQUFDLEVBQUVDLENBQUMsRUFBRTtFQUNoQixZQUFZOztFQUVaO0VBQ0EsSUFBSUMscUJBQXFCLEdBQUcsS0FBSzs7RUFFakM7RUFDQSxJQUFJQyxHQUFHLEdBQUc7SUFDVEMsT0FBTyxFQUFLLGdDQUFnQztJQUM1Q0MsVUFBVSxF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
