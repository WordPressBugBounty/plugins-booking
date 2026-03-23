"use strict";

/**
 * == How to add a new CSS style ? ==
 *
 * TL;DR: add a key in COL_PROPS (JS) -> reference its CSS var (CSS) → add a control in the inspector template (HTML).
 * Keep the JS default (def) and the CSS var() fallback identical.
 *
 * -- 1) Register the style in this JS (COL_PROPS)
 *
 *    // Length-like example:
 *    pad: { var: '--wpbc-bfb-col-pad', def: '0px', normalize: 'len' }
 *
 *    // Enum example:
 *    ac:  { var: '--wpbc-bfb-col-ac',  def: 'normal', normalize: { type: 'enum', values: ['normal','stretch','center','start','end','space-between','space-around','space-evenly'] } }
 *
 *    Notes:
 *    - Allowed normalizers: 'id' (passthrough), 'len' (px/rem/em/%), or {type:'enum',values:[...] }.
 *    - If you need a new normalizer, add it to NORMALIZE and reference its name here.
 *
 * -- 2) Wire the CSS variable (defaults + activation)
 *
 *    File with defaults: ../includes/__css/client/form_fields/bfb_section__columns.css
 *    The fallback in var(--name, <fallback>) MUST MATCH COL_PROPS[key].def.
 *
 *    /* Mini preview (template “ghost” columns; always on) *\/
 *    .wpbc_bfb__section__cols > .wpbc_bfb__section__col {
 *      padding: var(--wpbc-bfb-col-pad, 0px);
 *      /* add other properties here using their vars *\/
 *    }
 *
 *    /* Real columns (only when styles are activated) *\/
 *    .wpbc_bfb_form .wpbc_bfb__section[data-colstyles-active="1"] > .wpbc_bfb__row > .wpbc_bfb__column {
 *      padding: var(--wpbc-bfb-col-pad, 0px);
 *    }
 *
 *    Where “default CSS settings” live:
 *    - The JS default: COL_PROPS[key].def (in this file) — used for parsing, preview, and activation checks.
 *    - The CSS fallback: var(--wpbc-bfb-col-<key>, <fallback>) — in bfb_section__columns.css, must equal the JS default.
 *
 * -- 3) Add an inspector control in the template (tmpl-wpbc-bfb-column-styles)
 *    File: ../includes/page-form-builder/field-packs/section/section-wptpl.php
 *
 *    <!-- Simple input (works for 'len', 'id', and many enums with text inputs) -->
 *    <div class="inspector__row">
 *      <label class="inspector__label inspector__w_40">Padding</label>
 *      <div class="inspector__control inspector__w_50">
 *        <input type="text" class="inspector__input" data-style-key="pad" data-col-idx="{{ i }}" placeholder="e.g., 8px or 0.5rem">
 *      </div>
 *    </div>
 *
 *    The generic change handler will:
 *    - read data-style-key,
 *    - normalize via COL_PROPS,
 *    - persist to data-col_styles (sparse JSON; defaults stripped),
 *    - toggle data-colstyles-active automatically,
 *    - and update preview + real columns.
 *
 * -- 4) (Optional) Split value styles (like GAP number+unit)
 *
 *    If your new style is a pair (value + unit), mirror the 'gap' pattern:
 *      - two inputs with data-style-part="value" and data-style-part="unit"
 *      - add a small branch in on_change (like the existing one for key === 'gap') that combines value+unit
 *        before normalizing and saving.
 *
 * -- 5) Activation & persistence (what happens under the hood)
 *
 *    - The service compares saved values vs COL_PROPS defaults. If any non-default exists, it sets
 *      data-colstyles-active="1" on the section and writes CSS vars to real columns.
 *    - When inactive, the service removes inline vars so CSS falls back to your default in var(..., fallback).
 *    - data-col_styles attribute stores a compact (sparse) JSON: only keys that differ from defaults are saved.
 *
 * Checklist before you ship:
 * [ ] COL_PROPS entry added with correct var name and def value
 * [ ] CSS var() fallback matches the JS default exactly
 * [ ] Inspector control present and uses data-style-key="<your key>"
 * [ ] (If split-value) on_change branch added, like for 'gap'
 */

/**
 * UI: Column Styles (service + inspector component)
 * ---------------------------------------------------------------------------------
 * Splits column-style logic out of Section renderer:
 * - Service: UI.WPBC_BFB_Column_Styles (parse/stringify/apply/is_active/baseline)
 * - Inspector slot: UI.wpbc_bfb_column_styles (render_for_section / refresh_for_section)
 *
 * == File: /includes/page-form-builder/field-packs/section/_out/ui-column-styles.js
 *
 * @since     11.0.0
 * @modified  2025-09-16 11:25
 * @version   1.0.0
 */
(function (w) {
  'use strict';

  var Core = w.WPBC_BFB_Core = w.WPBC_BFB_Core || {};
  var UI = Core.UI = Core.UI || {};
  var S = Core.WPBC_BFB_Sanitize || {};
  var DOM = Core.WPBC_BFB_DOM && Core.WPBC_BFB_DOM.SELECTORS || {
    row: '.wpbc_bfb__row',
    column: '.wpbc_bfb__column'
  };

  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Central registry of supported per-column CSS properties.
   *
   * Each entry describes how a logical style key maps to a CSS custom property
   * written on the column element, its default value, and how to normalize user
   * input before persisting/applying.
   *
   * key       — Short style key used in UI and persisted JSON.
   * var       — CSS variable name written onto the DOM node style.
   * def       — Default value if the style is unset/empty.
   * normalize — Normalizer id ('id' passthrough, 'len' for length units).
   */
  var COL_PROPS = {
    dir: {
      var: '--wpbc-bfb-col-dir',
      def: 'column',
      normalize: 'id'
    },
    wrap: {
      var: '--wpbc-bfb-col-wrap',
      def: 'nowrap',
      normalize: 'id'
    },
    jc: {
      var: '--wpbc-bfb-col-jc',
      def: 'flex-start',
      normalize: 'id'
    },
    ai: {
      var: '--wpbc-bfb-col-ai',
      def: 'stretch',
      normalize: 'id'
    },
    gap: {
      var: '--wpbc-bfb-col-gap',
      def: '0px',
      normalize: 'len'
    },
    aself: {
      var: '--wpbc-bfb-col-aself',
      def: 'flex-start',
      normalize: {
        type: 'enum',
        values: ['flex-start', 'center', 'flex-end', 'stretch']
      }
    }
    // Example additions:
    // pad : { var: '--wpbc-bfb-col-pad', def: '0px',        normalize: 'len' }
  };

  /**
   * Normalize a "length-like" value (e.g., "8" → "8px").
   * Accepts px/rem/em/%; expand the regex if you allow more units.
   *
   * @param {string|number} v
   * @returns {string} normalized value (always non-empty)
   */
  function norm_len(v) {
    var sv = String(v || '').trim();
    if (!sv) {
      return '0px';
    }
    if (/^\d+(\.\d+)?$/.test(sv)) {
      return sv + 'px';
    } // number -> px.
    if (/^\d+(\.\d+)?(px|rem|em|%)$/.test(sv)) {
      return sv;
    } // allowed units.
    return '0px';
  }

  /**
   * Example:  ac: { var: '--wpbc-bfb-col-ac', def: 'normal', normalize: { type: 'enum', values: ['normal','stretch','center','start','end','space-between','space-around','space-evenly'] } }
   *
   * @param v
   * @param vals
   * @returns {string|*}
   */
  function norm_enum(v, vals) {
    v = String(v || '');
    return vals.indexOf(v) !== -1 ? v : vals[0];
  }

  /**
   * Normalizer registry. Extend to add custom validators/transforms
   * (e.g., enums, numbers with ranges, etc.).
   */
  var NORMALIZE = {
    id: v => String(v || ''),
    len: norm_len,
    enum: (v, values) => norm_enum(v, values)
  };

  /**
   * Check whether a style key is supported by COL_PROPS.
   *
   * @param {string} k
   * @returns {boolean}
   */
  function is_supported_key(k) {
    return Object.prototype.hasOwnProperty.call(COL_PROPS, k);
  }

  /**
   * Normalize a value for a given style key using its configured normalizer.
   *
   * @param {string} key
   * @param {any} val
   * @returns {string}
   */
  function normalize_value(key, val) {
    var cfg = COL_PROPS[key];
    if (!cfg) {
      return String(val || '');
    }
    if (cfg.normalize && typeof cfg.normalize === 'object' && cfg.normalize.type === 'enum') {
      return NORMALIZE.enum(val, cfg.normalize.values || []);
    }
    var fn = NORMALIZE[cfg.normalize] || NORMALIZE.id;
    return fn(val);
  }

  /**
   * Build a plain object containing defaults for all supported style keys.
   *
   * @returns {Record<string, string>}
   */
  function get_defaults_obj() {
    var o = {};
    for (var k in COL_PROPS) {
      if (is_supported_key(k)) {
        o[k] = COL_PROPS[k].def;
      }
    }
    return o;
  }

  /**
   * Apply all CSS variables (from COL_PROPS) onto a node based on a style object.
   * Missing/empty values fall back to defaults.
   *
   * @param {HTMLElement} node
   * @param {Record<string, string>} style_obj
   */
  function set_vars(node, style_obj) {
    if (!node) {
      return;
    }
    for (var k in COL_PROPS) {
      if (is_supported_key(k)) {
        var cssVar = COL_PROPS[k].var;
        var v = style_obj && style_obj[k] != null && String(style_obj[k]).trim() !== '' ? style_obj[k] : COL_PROPS[k].def;
        node.style.setProperty(cssVar, String(v));
      }
    }
  }
  function set_vars_sparse(node, style_obj) {
    if (!node) return;
    for (var k in COL_PROPS) {
      if (is_supported_key(k)) {
        var cssVar = COL_PROPS[k].var;
        if (style_obj && Object.prototype.hasOwnProperty.call(style_obj, k) && String(style_obj[k]).trim() !== '') {
          node.style.setProperty(cssVar, String(style_obj[k]));
        } else {
          // important: remove var instead of writing a default
          node.style.removeProperty(cssVar);
        }
      }
    }
  }

  /**
   * Remove all CSS variables (from COL_PROPS) from a node.
   *
   * @param {HTMLElement} node
   */
  function clear_vars(node) {
    if (!node) {
      return;
    }
    for (var k in COL_PROPS) {
      if (is_supported_key(k)) {
        node.style.removeProperty(COL_PROPS[k].var);
      }
    }
  }

  /**
   * Clamp helper for columns number.
   *
   * @param {number|string} n
   * @returns {number}
   */
  function clamp_cols(n) {
    return S.clamp ? S.clamp(Number(n) || 1, 1, 4) : Math.max(1, Math.min(4, Number(n) || 1));
  }

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
      return clamp_cols(cnt);
    } catch (_e) {
      return 1;
    }
  }

  // ------------------------------------------------------------------------------------------------
  // Service: Column Styles
  // ------------------------------------------------------------------------------------------------
  UI.WPBC_BFB_Column_Styles = {
    /**
     * Highlight a specific column in both the live canvas and the mini preview,
     * and store the active index on the section.
     *
     * @param {HTMLElement} section_el
     * @param {number|string} key_1based  1-based column index (clamped)
     */
    set_selected_col_flag: function (section_el, key_1based) {
      if (!section_el) {
        return;
      }
      var cols_cnt = dom_cols(section_el);
      var idx = Math.min(Math.max(parseInt(key_1based, 10) || 1, 1), cols_cnt || 1);
      var idx0 = idx - 1;
      section_el.setAttribute('data-selected-col', String(idx));

      // Real canvas columns.
      var row = section_el.querySelector(':scope > ' + DOM.row);
      var cols = row ? row.querySelectorAll(':scope > ' + DOM.column) : [];
      for (var i = 0; i < cols.length; i++) {
        if (cols[i].classList) {
          cols[i].classList.toggle('is-selected-column', i === idx0);
        }
      }

      // Mini preview columns.
      var pcols = section_el.querySelectorAll(':scope .wpbc_bfb__section__cols > .wpbc_bfb__section__col');
      for (var j = 0; j < pcols.length; j++) {
        if (pcols[j].classList) {
          pcols[j].classList.toggle('is-selected-column', j === idx0);
        }
      }
    },
    /**
     * Remove column selection highlight from both canvas and mini preview.
     *
     * @param {HTMLElement} section_el
     */
    clear_selected_col_flag: function (section_el) {
      if (!section_el) {
        return;
      }
      section_el.removeAttribute('data-selected-col');
      var row = section_el.querySelector(':scope > ' + DOM.row);
      var cols = row ? row.querySelectorAll(':scope > ' + DOM.column) : [];
      for (var i = 0; i < cols.length; i++) {
        cols[i].classList && cols[i].classList.remove('is-selected-column');
      }
      var pcols = section_el.querySelectorAll(':scope .wpbc_bfb__section__cols > .wpbc_bfb__section__col');
      for (var j = 0; j < pcols.length; j++) {
        pcols[j].classList && pcols[j].classList.remove('is-selected-column');
      }
    },
    /**
     * Parse JSON string to array of per-column style objects.
     *
     * @param {string} s
     * @returns {Array<{dir:string,wrap:string,jc:string,ai:string,gap:string}>}
     */
    parse_col_styles: function (s) {
      if (!s) {
        return [];
      }
      var obj = S.safe_json_parse ? S.safe_json_parse(String(s), null) : function () {
        try {
          return JSON.parse(String(s));
        } catch (_e) {
          return null;
        }
      }();
      if (Array.isArray(obj)) {
        return obj;
      }
      if (obj && typeof obj === 'object' && Array.isArray(obj.columns)) {
        return obj.columns;
      }
      return [];
    },
    /**
     * Stringify styles array to canonical JSON.
     *
     * @param {Array} arr
     * @returns {string}
     */
    stringify_col_styles: function (arr) {
      var data = Array.isArray(arr) ? arr : [];
      return S.stringify_data_value ? S.stringify_data_value(data) : JSON.stringify(data);
    },
    /**
     * Check if per-column styles are active for a section.
     * - Active if element flag data-colstyles-active="1" OR non-empty serialized styles.
     *
     * @param {HTMLElement} section_el
     * @returns {boolean}
     */
    is_active: function (section_el) {
      if (!section_el) {
        return false;
      }
      if (section_el.getAttribute('data-colstyles-active') === '1') {
        return true;
      }
      var raw = section_el.getAttribute('data-col_styles') || (section_el.dataset ? section_el.dataset.col_styles || '' : '');
      var arr = this.parse_col_styles(raw);
      var DEF = get_defaults_obj();
      // Active only if any column has a non-default, non-empty override.
      for (var i = 0; i < arr.length; i++) {
        var s = arr[i] || {};
        for (var k in DEF) {
          if (Object.prototype.hasOwnProperty.call(s, k)) {
            var v = String(s[k]);
            if (v && v !== String(DEF[k])) {
              return true;
            }
          }
        }
      }
      return false;
    },
    /**
     * Apply per-column styles to preview and, when active, to real columns.
     *
     * @param {HTMLElement} section_el
     * @param {Array}       styles
     */
    apply: function (section_el, styles) {
      if (!section_el) {
        return;
      }

      // Mini preview inside the section template (always on).
      var preview = section_el.querySelector(':scope .wpbc_bfb__section__cols');
      if (preview) {
        var pcols = preview.querySelectorAll(':scope > .wpbc_bfb__section__col');
        for (var i = 0; i < pcols.length; i++) {
          set_vars(pcols[i], styles[i] || {}); // OK to use defaults in preview
        }
      }

      // Determine activation from current element state (not from styles arg alone).
      var active = this.is_active(section_el);

      // If not active, clean up inline vars and remove the flag.
      if (!active) {
        section_el.removeAttribute('data-colstyles-active');
        var row_off = section_el.querySelector(':scope > ' + DOM.row);
        if (row_off) {
          var nodes = row_off.querySelectorAll(':scope > ' + DOM.column);
          for (var j = 0; j < nodes.length; j++) {
            clear_vars(nodes[j]);
          }
        }
        return;
      }

      // Active: add flag if missing and write CSS vars to REAL canvas columns.
      section_el.setAttribute('data-colstyles-active', '1');

      // NEW: always use the sparse, saved JSON for REAL columns.
      var use_styles = this.parse_col_styles(section_el.getAttribute('data-col_styles') || (section_el.dataset ? section_el.dataset.col_styles || '' : ''));
      var row = section_el.querySelector(':scope > ' + DOM.row);
      if (row) {
        var rcols = row.querySelectorAll(':scope > ' + DOM.column);
        for (var k = 0; k < rcols.length; k++) {
          set_vars_sparse(rcols[k], use_styles[k] || {}); // only write what exists
        }
      }
    }
  };

  // ------------------------------------------------------------------------------------------------
  // Inspector component (slot: "column_styles")
  // ------------------------------------------------------------------------------------------------
  UI.wpbc_bfb_column_styles = {
    /**
     * Render the per-column style editor (wp.template: 'wpbc-bfb-column-styles').
     *
     * @param {object}      builder
     * @param {HTMLElement} section_el
     * @param {HTMLElement} host
     */
    render_for_section: function (builder, section_el, host) {
      if (!host || !section_el) {
        return;
      }

      // Capture current active tab BEFORE we clear host.
      var __prev_root = host.querySelector('[data-wpbc-tabs]');
      var ds = section_el.dataset || {};
      var __prev_key = __prev_root && __prev_root.getAttribute('data-wpbc-tab-active') || host.__wpbc_active_key || ds.col_styles_active_tab || null;

      // Cleanup previous mount and clear.
      if (host.__wpbc_cleanup) {
        try {
          host.__wpbc_cleanup();
        } catch (_e) {}
        host.__wpbc_cleanup = null;
      }
      host.innerHTML = '';
      var tpl = w.wp && w.wp.template ? w.wp.template('wpbc-bfb-column-styles') : null;
      if (!tpl) {
        return;
      }
      var col_count = dom_cols(section_el);
      var raw_json = section_el.getAttribute('data-col_styles') || (section_el.dataset ? section_el.dataset.col_styles || '' : '');
      var saved_arr = UI.WPBC_BFB_Column_Styles.parse_col_styles(raw_json);
      var styles_arr = [];

      // Normalize length to current columns (UI-only defaults do NOT auto-activate).
      var def = get_defaults_obj();
      for (var i = 0; i < col_count; i++) {
        var src = saved_arr[i] || {};
        // Merge for display, but track which keys were actually present in saved JSON.
        var full = Object.assign({}, def, src);
        full.__has = {
          dir: Object.prototype.hasOwnProperty.call(src, 'dir'),
          wrap: Object.prototype.hasOwnProperty.call(src, 'wrap'),
          jc: Object.prototype.hasOwnProperty.call(src, 'jc'),
          ai: Object.prototype.hasOwnProperty.call(src, 'ai'),
          gap: Object.prototype.hasOwnProperty.call(src, 'gap'),
          aself: Object.prototype.hasOwnProperty.call(src, 'aself')
        };
        styles_arr[i] = full;
      }
      styles_arr.length = col_count; // clamp.

      host.innerHTML = tpl({
        cols: col_count,
        styles: styles_arr,
        active: UI.WPBC_BFB_Column_Styles.is_active(section_el)
      });
      if (window.wpbc_ui_tabs && host) {
        window.wpbc_ui_tabs.init_on(host);

        // Persist the active tab so we can restore it after re-renders.
        var tabsRoot = host.querySelector('[data-wpbc-tabs]');
        if (tabsRoot && !tabsRoot.__wpbc_persist_listener) {
          tabsRoot.__wpbc_persist_listener = true;
          tabsRoot.addEventListener('wpbc:tabs:change', function (e) {
            var k = e && e.detail && e.detail.active_key;
            if (k) {
              host.__wpbc_active_key = String(k);
              if (section_el && section_el.dataset) {
                section_el.dataset.col_styles_active_tab = String(k);
              }
              // NEW: reflect selection on the section + columns.
              UI.WPBC_BFB_Column_Styles.set_selected_col_flag(section_el, k);
            }
          }, true);
        }

        // Restore previous tab if it still exists (clamp to new count).
        var __key;
        if (__prev_key) {
          var __new_root = host.querySelector('[data-wpbc-tabs]');
          __key = String(Math.min(Math.max(parseInt(__prev_key, 10) || 1, 1), col_count));
          if (__new_root && window.wpbc_ui_tabs.set_active) {
            window.wpbc_ui_tabs.set_active(__new_root, __key);
          }
        }

        // After restoring the tab, ensure highlight matches the active tab.
        var __active_key_now = __key || (ds.col_styles_active_tab ? String(Math.min(Math.max(parseInt(ds.col_styles_active_tab, 10) || 1, 1), col_count)) : '1');
        UI.WPBC_BFB_Column_Styles.set_selected_col_flag(section_el, __active_key_now);
      }

      // Re-wire number - range pairing (ValueSlider) for freshly rendered controls.
      try {
        UI.InspectorEnhancers && UI.InspectorEnhancers.scan && UI.InspectorEnhancers.scan(host);
        // Alternatively (direct wiring):
        // UI.WPBC_BFB_ValueSlider && UI.WPBC_BFB_ValueSlider.init_on && UI.WPBC_BFB_ValueSlider.init_on( host );
      } catch (_e) {}

      // Set initial state of ICONS (including defaults) is correct.
      sync_axis_rotation_all();
      function styles_has_any_non_default(styles_arr, get_defaults_obj_fn) {
        var def = get_defaults_obj_fn();
        for (var i = 0; i < styles_arr.length; i++) {
          var s = styles_arr[i] || {};
          for (var k in def) {
            if (Object.prototype.hasOwnProperty.call(def, k)) {
              var v = s[k] == null ? '' : String(s[k]);
              // treat empty as "not selected" (not active).
              if (v && v !== String(def[k])) {
                return true;
              }
            }
          }
        }
        return false;
      }
      function strip_defaults_for_save(styles_arr, get_defaults_obj_fn) {
        var def = get_defaults_obj_fn();
        var out = [];
        for (var i = 0; i < styles_arr.length; i++) {
          var s = styles_arr[i] || {};
          var row = {};
          for (var k in def) {
            if (Object.prototype.hasOwnProperty.call(def, k)) {
              var v = s[k] == null ? '' : String(s[k]);
              if (v && v !== String(def[k])) {
                row[k] = v; // only keep meaningful overrides.
              }
            }
          }
          out.push(row);
        }
        return out;
      }

      /**
       * Toggle rotation class for the chip labels of a specific column and group set.
       *
       * @param {number} idx      Column index (0-based)
       * @param {boolean} enable  Whether to add (true) or remove (false) the rotation class
       */
      function toggle_axis_rotation_for_col(idx, enable) {
        var keys = ['ai', 'jc'];
        for (var g = 0; g < keys.length; g++) {
          var q = 'input.inspector__input.wpbc_sr_only[data-style-key="' + keys[g] + '"][data-col-idx="' + idx + '"]';
          var inputs = host.querySelectorAll(q);
          for (var n = 0; n < inputs.length; n++) {
            var lbl = inputs[n] && inputs[n].nextElementSibling;
            if (lbl && lbl.classList && lbl.classList.contains('wpbc_bfb__chip')) {
              if (enable) {
                lbl.classList.add('wpbc_do_rotate_90');
              } else {
                lbl.classList.remove('wpbc_do_rotate_90');
              }
            }
          }
        }
      }

      /**
       * Apply rotation class to *all* columns, using the effective `dir` value
       * (saved value or default from COL_PROPS).
       */
      function sync_axis_rotation_all() {
        var def = get_defaults_obj(); // includes def.dir (which is 'column' in your code).
        for (var i = 0; i < styles_arr.length; i++) {
          var dir_val = styles_arr[i] && styles_arr[i].dir ? String(styles_arr[i].dir) : String(def.dir);
          var enable = dir_val === 'column';
          toggle_axis_rotation_for_col(i, enable);
        }
      }

      // Delay (ms) for deferred UI updates after changing layout combo.
      var rerender_delay_ms = 420;

      /**
       * Schedule icon rotation + re-render with optional immediate rotation.
       *
       * @param {number} col_idx            0-based column index
       * @param {string} new_dir            "row" | "column"
       * @param {{delay?:number, rotate_now?:boolean}} [opts]
       */
      function schedule_rerender(col_idx, new_dir, opts) {
        opts = opts || {};
        var delay = typeof opts.delay === 'number' ? opts.delay : rerender_delay_ms;

        // Avoid stacked timers if the user clicks quickly.
        if (host.__rerender_timer) {
          clearTimeout(host.__rerender_timer);
        }

        // Optional immediate feedback (used by plain "dir" radios).
        if (opts.rotate_now) {
          toggle_axis_rotation_for_col(col_idx, String(new_dir) === 'column');
        }
        host.__rerender_timer = setTimeout(function () {
          // If we didn't rotate immediately, do it now (used by combo).
          if (!opts.rotate_now) {
            toggle_axis_rotation_for_col(col_idx, String(new_dir) === 'column');
          }
          UI.wpbc_bfb_column_styles.render_for_section(builder, section_el, host);
          host.__rerender_timer = null;
        }, delay);
      }
      function commit(builder, section_el, styles_arr) {
        // Decide activation.
        var should_activate = styles_has_any_non_default(styles_arr, get_defaults_obj);
        if (should_activate) {
          section_el.setAttribute('data-colstyles-active', '1');
        } else {
          section_el.removeAttribute('data-colstyles-active');
        }

        // Normalize length to current number of columns (keeps attribute tidy).
        styles_arr.length = dom_cols(section_el);

        // Persist minimal JSON (omit defaults/empties).
        var save_arr = strip_defaults_for_save(styles_arr, get_defaults_obj);
        var json = UI.WPBC_BFB_Column_Styles.stringify_col_styles(save_arr);
        section_el.setAttribute('data-col_styles', json);
        if (section_el.dataset) {
          section_el.dataset.col_styles = json;
        }

        // Live preview (mini + gated real columns).
        UI.WPBC_BFB_Column_Styles.apply(section_el, styles_arr);

        // Notify listeners.
        if (builder && builder.bus && Core.WPBC_BFB_Events) {
          builder.bus.emit && builder.bus.emit(Core.WPBC_BFB_Events.STRUCTURE_CHANGE, {
            source: 'column_styles',
            field: section_el
          });
        }
      }
      function on_change(e) {
        var t = e.target;
        // Radios fire both 'input' and 'change' in most browsers.
        if (t && t.type === 'radio' && e.type === 'input') return;
        var key = t && t.getAttribute('data-style-key');
        if (!key || !is_supported_key(key) && key !== 'layout_combo') {
          return;
        }
        var idx = parseInt(t.getAttribute('data-col-idx'), 10) || 0;

        // layout_combo: commit now, rotate + re-render later (no immediate icon change).
        if (key === 'layout_combo') {
          var parts = String(t.value || '').split('|');
          var dir = parts[0] || 'row';
          var wrap = parts[1] || 'nowrap';
          styles_arr[idx].dir = normalize_value('dir', dir);
          styles_arr[idx].wrap = normalize_value('wrap', wrap);
          commit(builder, section_el, styles_arr);
          schedule_rerender(idx, styles_arr[idx].dir, {
            rotate_now: true,
            delay: rerender_delay_ms
          });
          return;
        }

        // Existing: GAP pair branch.
        if (key === 'gap') {
          var numEl = host.querySelector('[data-style-key="gap"][data-style-part="value"][data-col-idx="' + idx + '"]');
          var unitEl = host.querySelector('[data-style-key="gap"][data-style-part="unit"][data-col-idx="' + idx + '"]');
          var num = numEl ? String(numEl.value || '').trim() : '';
          var unit = unitEl ? String(unitEl.value || 'px').trim() : 'px';
          var raw = num ? num + unit : '';
          styles_arr[idx].gap = normalize_value('gap', raw);
          commit(builder, section_el, styles_arr);
          return;
        }

        // dir: commit now, rotate immediately for snappy feedback, still re-render after delay.
        if (key === 'dir') {
          styles_arr[idx].dir = normalize_value('dir', t.value);
          commit(builder, section_el, styles_arr);
          schedule_rerender(idx, styles_arr[idx].dir, {
            rotate_now: true,
            delay: rerender_delay_ms
          });
          return;
        }

        // Default branch (unchanged).
        styles_arr[idx][key] = normalize_value(key, t.value);
        commit(builder, section_el, styles_arr);
      }
      function on_click(e) {
        var btn = e.target.closest('[data-action="colstyles-reset"]');
        if (!btn) {
          return;
        }

        // Clear dataset + activation flag and remove inline vars
        section_el.removeAttribute('data-colstyles-active');
        section_el.removeAttribute('data-col_styles');
        if (section_el.dataset) {
          delete section_el.dataset.col_styles;
        }
        UI.WPBC_BFB_Column_Styles.apply(section_el, []);

        // Re-render fresh, not persisted
        UI.wpbc_bfb_column_styles.render_for_section(builder, section_el, host);
        if (builder && builder.bus && Core.WPBC_BFB_Events) {
          builder.bus.emit && builder.bus.emit(Core.WPBC_BFB_Events.STRUCTURE_CHANGE, {
            source: 'column_styles_reset',
            field: section_el
          });
        }
      }
      host.addEventListener('input', on_change, true);
      host.addEventListener('change', on_change, true);
      host.addEventListener('click', on_click, true);

      // Initial apply (does NOT auto-activate).
      UI.WPBC_BFB_Column_Styles.apply(section_el, styles_arr);

      // Provide cleanup to avoid leaks.
      host.__wpbc_cleanup = function () {
        try {
          host.removeEventListener('input', on_change, true);
          host.removeEventListener('change', on_change, true);
          host.removeEventListener('click', on_click, true);
        } catch (_e) {}
      };
    },
    /**
     * Refresh the mounted editor after columns count changes.
     *
     * @param {object}      builder
     * @param {HTMLElement} section_el
     * @param {HTMLElement} inspector_root
     */
    refresh_for_section: function (builder, section_el, inspector_root) {
      var host = inspector_root && inspector_root.querySelector('[data-bfb-slot="column_styles"]');
      if (!host) {
        return;
      }
      this.render_for_section(builder, section_el, host);
    }
  };

  // Optional: register a factory slot for environments that use inspector factory.
  w.wpbc_bfb_inspector_factory_slots = w.wpbc_bfb_inspector_factory_slots || {};
  w.wpbc_bfb_inspector_factory_slots.column_styles = function (host, opts) {
    try {
      var builder = opts && opts.builder || w.wpbc_bfb || null;
      var section_el = opts && opts.el || builder && builder.get_selected_field && builder.get_selected_field() || null;
      UI.wpbc_bfb_column_styles.render_for_section(builder, section_el, host);
    } catch (e) {
      w._wpbc && w._wpbc.dev && w._wpbc.dev.error && w._wpbc.dev.error('wpbc_bfb_inspector_factory_slots.column_styles', e);
    }
  };
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3Mvc2VjdGlvbi9fb3V0L3VpLWNvbHVtbi1zdHlsZXMuanMiLCJuYW1lcyI6WyJ3IiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJVSSIsIlMiLCJXUEJDX0JGQl9TYW5pdGl6ZSIsIkRPTSIsIldQQkNfQkZCX0RPTSIsIlNFTEVDVE9SUyIsInJvdyIsImNvbHVtbiIsIkNPTF9QUk9QUyIsImRpciIsInZhciIsImRlZiIsIm5vcm1hbGl6ZSIsIndyYXAiLCJqYyIsImFpIiwiZ2FwIiwiYXNlbGYiLCJ0eXBlIiwidmFsdWVzIiwibm9ybV9sZW4iLCJ2Iiwic3YiLCJTdHJpbmciLCJ0cmltIiwidGVzdCIsIm5vcm1fZW51bSIsInZhbHMiLCJpbmRleE9mIiwiTk9STUFMSVpFIiwiaWQiLCJsZW4iLCJlbnVtIiwiaXNfc3VwcG9ydGVkX2tleSIsImsiLCJPYmplY3QiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJub3JtYWxpemVfdmFsdWUiLCJrZXkiLCJ2YWwiLCJjZmciLCJmbiIsImdldF9kZWZhdWx0c19vYmoiLCJvIiwic2V0X3ZhcnMiLCJub2RlIiwic3R5bGVfb2JqIiwiY3NzVmFyIiwic3R5bGUiLCJzZXRQcm9wZXJ0eSIsInNldF92YXJzX3NwYXJzZSIsInJlbW92ZVByb3BlcnR5IiwiY2xlYXJfdmFycyIsImNsYW1wX2NvbHMiLCJuIiwiY2xhbXAiLCJOdW1iZXIiLCJNYXRoIiwibWF4IiwibWluIiwiZG9tX2NvbHMiLCJlbCIsInF1ZXJ5U2VsZWN0b3IiLCJjbnQiLCJxdWVyeVNlbGVjdG9yQWxsIiwibGVuZ3RoIiwiX2UiLCJXUEJDX0JGQl9Db2x1bW5fU3R5bGVzIiwic2V0X3NlbGVjdGVkX2NvbF9mbGFnIiwic2VjdGlvbl9lbCIsImtleV8xYmFzZWQiLCJjb2xzX2NudCIsImlkeCIsInBhcnNlSW50IiwiaWR4MCIsInNldEF0dHJpYnV0ZSIsImNvbHMiLCJpIiwiY2xhc3NMaXN0IiwidG9nZ2xlIiwicGNvbHMiLCJqIiwiY2xlYXJfc2VsZWN0ZWRfY29sX2ZsYWciLCJyZW1vdmVBdHRyaWJ1dGUiLCJyZW1vdmUiLCJwYXJzZV9jb2xfc3R5bGVzIiwicyIsIm9iaiIsInNhZmVfanNvbl9wYXJzZSIsIkpTT04iLCJwYXJzZSIsIkFycmF5IiwiaXNBcnJheSIsImNvbHVtbnMiLCJzdHJpbmdpZnlfY29sX3N0eWxlcyIsImFyciIsImRhdGEiLCJzdHJpbmdpZnlfZGF0YV92YWx1ZSIsInN0cmluZ2lmeSIsImlzX2FjdGl2ZSIsImdldEF0dHJpYnV0ZSIsInJhdyIsImRhdGFzZXQiLCJjb2xfc3R5bGVzIiwiREVGIiwiYXBwbHkiLCJzdHlsZXMiLCJwcmV2aWV3IiwiYWN0aXZlIiwicm93X29mZiIsIm5vZGVzIiwidXNlX3N0eWxlcyIsInJjb2xzIiwid3BiY19iZmJfY29sdW1uX3N0eWxlcyIsInJlbmRlcl9mb3Jfc2VjdGlvbiIsImJ1aWxkZXIiLCJob3N0IiwiX19wcmV2X3Jvb3QiLCJkcyIsIl9fcHJldl9rZXkiLCJfX3dwYmNfYWN0aXZlX2tleSIsImNvbF9zdHlsZXNfYWN0aXZlX3RhYiIsIl9fd3BiY19jbGVhbnVwIiwiaW5uZXJIVE1MIiwidHBsIiwid3AiLCJ0ZW1wbGF0ZSIsImNvbF9jb3VudCIsInJhd19qc29uIiwic2F2ZWRfYXJyIiwic3R5bGVzX2FyciIsInNyYyIsImZ1bGwiLCJhc3NpZ24iLCJfX2hhcyIsIndpbmRvdyIsIndwYmNfdWlfdGFicyIsImluaXRfb24iLCJ0YWJzUm9vdCIsIl9fd3BiY19wZXJzaXN0X2xpc3RlbmVyIiwiYWRkRXZlbnRMaXN0ZW5lciIsImUiLCJkZXRhaWwiLCJhY3RpdmVfa2V5IiwiX19rZXkiLCJfX25ld19yb290Iiwic2V0X2FjdGl2ZSIsIl9fYWN0aXZlX2tleV9ub3ciLCJJbnNwZWN0b3JFbmhhbmNlcnMiLCJzY2FuIiwic3luY19heGlzX3JvdGF0aW9uX2FsbCIsInN0eWxlc19oYXNfYW55X25vbl9kZWZhdWx0IiwiZ2V0X2RlZmF1bHRzX29ial9mbiIsInN0cmlwX2RlZmF1bHRzX2Zvcl9zYXZlIiwib3V0IiwicHVzaCIsInRvZ2dsZV9heGlzX3JvdGF0aW9uX2Zvcl9jb2wiLCJlbmFibGUiLCJrZXlzIiwiZyIsInEiLCJpbnB1dHMiLCJsYmwiLCJuZXh0RWxlbWVudFNpYmxpbmciLCJjb250YWlucyIsImFkZCIsImRpcl92YWwiLCJyZXJlbmRlcl9kZWxheV9tcyIsInNjaGVkdWxlX3JlcmVuZGVyIiwiY29sX2lkeCIsIm5ld19kaXIiLCJvcHRzIiwiZGVsYXkiLCJfX3JlcmVuZGVyX3RpbWVyIiwiY2xlYXJUaW1lb3V0Iiwicm90YXRlX25vdyIsInNldFRpbWVvdXQiLCJjb21taXQiLCJzaG91bGRfYWN0aXZhdGUiLCJzYXZlX2FyciIsImpzb24iLCJidXMiLCJXUEJDX0JGQl9FdmVudHMiLCJlbWl0IiwiU1RSVUNUVVJFX0NIQU5HRSIsInNvdXJjZSIsImZpZWxkIiwib25fY2hhbmdlIiwidCIsInRhcmdldCIsInBhcnRzIiwidmFsdWUiLCJzcGxpdCIsIm51bUVsIiwidW5pdEVsIiwibnVtIiwidW5pdCIsIm9uX2NsaWNrIiwiYnRuIiwiY2xvc2VzdCIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJyZWZyZXNoX2Zvcl9zZWN0aW9uIiwiaW5zcGVjdG9yX3Jvb3QiLCJ3cGJjX2JmYl9pbnNwZWN0b3JfZmFjdG9yeV9zbG90cyIsImNvbHVtbl9zdHlsZXMiLCJ3cGJjX2JmYiIsImdldF9zZWxlY3RlZF9maWVsZCIsIl93cGJjIiwiZGV2IiwiZXJyb3IiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9maWVsZC1wYWNrcy9zZWN0aW9uL19zcmMvdWktY29sdW1uLXN0eWxlcy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogPT0gSG93IHRvIGFkZCBhIG5ldyBDU1Mgc3R5bGUgPyA9PVxyXG4gKlxyXG4gKiBUTDtEUjogYWRkIGEga2V5IGluIENPTF9QUk9QUyAoSlMpIC0+IHJlZmVyZW5jZSBpdHMgQ1NTIHZhciAoQ1NTKSDihpIgYWRkIGEgY29udHJvbCBpbiB0aGUgaW5zcGVjdG9yIHRlbXBsYXRlIChIVE1MKS5cclxuICogS2VlcCB0aGUgSlMgZGVmYXVsdCAoZGVmKSBhbmQgdGhlIENTUyB2YXIoKSBmYWxsYmFjayBpZGVudGljYWwuXHJcbiAqXHJcbiAqIC0tIDEpIFJlZ2lzdGVyIHRoZSBzdHlsZSBpbiB0aGlzIEpTIChDT0xfUFJPUFMpXHJcbiAqXHJcbiAqICAgIC8vIExlbmd0aC1saWtlIGV4YW1wbGU6XHJcbiAqICAgIHBhZDogeyB2YXI6ICctLXdwYmMtYmZiLWNvbC1wYWQnLCBkZWY6ICcwcHgnLCBub3JtYWxpemU6ICdsZW4nIH1cclxuICpcclxuICogICAgLy8gRW51bSBleGFtcGxlOlxyXG4gKiAgICBhYzogIHsgdmFyOiAnLS13cGJjLWJmYi1jb2wtYWMnLCAgZGVmOiAnbm9ybWFsJywgbm9ybWFsaXplOiB7IHR5cGU6ICdlbnVtJywgdmFsdWVzOiBbJ25vcm1hbCcsJ3N0cmV0Y2gnLCdjZW50ZXInLCdzdGFydCcsJ2VuZCcsJ3NwYWNlLWJldHdlZW4nLCdzcGFjZS1hcm91bmQnLCdzcGFjZS1ldmVubHknXSB9IH1cclxuICpcclxuICogICAgTm90ZXM6XHJcbiAqICAgIC0gQWxsb3dlZCBub3JtYWxpemVyczogJ2lkJyAocGFzc3Rocm91Z2gpLCAnbGVuJyAocHgvcmVtL2VtLyUpLCBvciB7dHlwZTonZW51bScsdmFsdWVzOlsuLi5dIH0uXHJcbiAqICAgIC0gSWYgeW91IG5lZWQgYSBuZXcgbm9ybWFsaXplciwgYWRkIGl0IHRvIE5PUk1BTElaRSBhbmQgcmVmZXJlbmNlIGl0cyBuYW1lIGhlcmUuXHJcbiAqXHJcbiAqIC0tIDIpIFdpcmUgdGhlIENTUyB2YXJpYWJsZSAoZGVmYXVsdHMgKyBhY3RpdmF0aW9uKVxyXG4gKlxyXG4gKiAgICBGaWxlIHdpdGggZGVmYXVsdHM6IC4uL2luY2x1ZGVzL19fY3NzL2NsaWVudC9mb3JtX2ZpZWxkcy9iZmJfc2VjdGlvbl9fY29sdW1ucy5jc3NcclxuICogICAgVGhlIGZhbGxiYWNrIGluIHZhcigtLW5hbWUsIDxmYWxsYmFjaz4pIE1VU1QgTUFUQ0ggQ09MX1BST1BTW2tleV0uZGVmLlxyXG4gKlxyXG4gKiAgICAvKiBNaW5pIHByZXZpZXcgKHRlbXBsYXRlIOKAnGdob3N04oCdIGNvbHVtbnM7IGFsd2F5cyBvbikgKlxcL1xyXG4gKiAgICAud3BiY19iZmJfX3NlY3Rpb25fX2NvbHMgPiAud3BiY19iZmJfX3NlY3Rpb25fX2NvbCB7XHJcbiAqICAgICAgcGFkZGluZzogdmFyKC0td3BiYy1iZmItY29sLXBhZCwgMHB4KTtcclxuICogICAgICAvKiBhZGQgb3RoZXIgcHJvcGVydGllcyBoZXJlIHVzaW5nIHRoZWlyIHZhcnMgKlxcL1xyXG4gKiAgICB9XHJcbiAqXHJcbiAqICAgIC8qIFJlYWwgY29sdW1ucyAob25seSB3aGVuIHN0eWxlcyBhcmUgYWN0aXZhdGVkKSAqXFwvXHJcbiAqICAgIC53cGJjX2JmYl9mb3JtIC53cGJjX2JmYl9fc2VjdGlvbltkYXRhLWNvbHN0eWxlcy1hY3RpdmU9XCIxXCJdID4gLndwYmNfYmZiX19yb3cgPiAud3BiY19iZmJfX2NvbHVtbiB7XHJcbiAqICAgICAgcGFkZGluZzogdmFyKC0td3BiYy1iZmItY29sLXBhZCwgMHB4KTtcclxuICogICAgfVxyXG4gKlxyXG4gKiAgICBXaGVyZSDigJxkZWZhdWx0IENTUyBzZXR0aW5nc+KAnSBsaXZlOlxyXG4gKiAgICAtIFRoZSBKUyBkZWZhdWx0OiBDT0xfUFJPUFNba2V5XS5kZWYgKGluIHRoaXMgZmlsZSkg4oCUIHVzZWQgZm9yIHBhcnNpbmcsIHByZXZpZXcsIGFuZCBhY3RpdmF0aW9uIGNoZWNrcy5cclxuICogICAgLSBUaGUgQ1NTIGZhbGxiYWNrOiB2YXIoLS13cGJjLWJmYi1jb2wtPGtleT4sIDxmYWxsYmFjaz4pIOKAlCBpbiBiZmJfc2VjdGlvbl9fY29sdW1ucy5jc3MsIG11c3QgZXF1YWwgdGhlIEpTIGRlZmF1bHQuXHJcbiAqXHJcbiAqIC0tIDMpIEFkZCBhbiBpbnNwZWN0b3IgY29udHJvbCBpbiB0aGUgdGVtcGxhdGUgKHRtcGwtd3BiYy1iZmItY29sdW1uLXN0eWxlcylcclxuICogICAgRmlsZTogLi4vaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3Mvc2VjdGlvbi9zZWN0aW9uLXdwdHBsLnBocFxyXG4gKlxyXG4gKiAgICA8IS0tIFNpbXBsZSBpbnB1dCAod29ya3MgZm9yICdsZW4nLCAnaWQnLCBhbmQgbWFueSBlbnVtcyB3aXRoIHRleHQgaW5wdXRzKSAtLT5cclxuICogICAgPGRpdiBjbGFzcz1cImluc3BlY3Rvcl9fcm93XCI+XHJcbiAqICAgICAgPGxhYmVsIGNsYXNzPVwiaW5zcGVjdG9yX19sYWJlbCBpbnNwZWN0b3JfX3dfNDBcIj5QYWRkaW5nPC9sYWJlbD5cclxuICogICAgICA8ZGl2IGNsYXNzPVwiaW5zcGVjdG9yX19jb250cm9sIGluc3BlY3Rvcl9fd181MFwiPlxyXG4gKiAgICAgICAgPGlucHV0IHR5cGU9XCJ0ZXh0XCIgY2xhc3M9XCJpbnNwZWN0b3JfX2lucHV0XCIgZGF0YS1zdHlsZS1rZXk9XCJwYWRcIiBkYXRhLWNvbC1pZHg9XCJ7eyBpIH19XCIgcGxhY2Vob2xkZXI9XCJlLmcuLCA4cHggb3IgMC41cmVtXCI+XHJcbiAqICAgICAgPC9kaXY+XHJcbiAqICAgIDwvZGl2PlxyXG4gKlxyXG4gKiAgICBUaGUgZ2VuZXJpYyBjaGFuZ2UgaGFuZGxlciB3aWxsOlxyXG4gKiAgICAtIHJlYWQgZGF0YS1zdHlsZS1rZXksXHJcbiAqICAgIC0gbm9ybWFsaXplIHZpYSBDT0xfUFJPUFMsXHJcbiAqICAgIC0gcGVyc2lzdCB0byBkYXRhLWNvbF9zdHlsZXMgKHNwYXJzZSBKU09OOyBkZWZhdWx0cyBzdHJpcHBlZCksXHJcbiAqICAgIC0gdG9nZ2xlIGRhdGEtY29sc3R5bGVzLWFjdGl2ZSBhdXRvbWF0aWNhbGx5LFxyXG4gKiAgICAtIGFuZCB1cGRhdGUgcHJldmlldyArIHJlYWwgY29sdW1ucy5cclxuICpcclxuICogLS0gNCkgKE9wdGlvbmFsKSBTcGxpdCB2YWx1ZSBzdHlsZXMgKGxpa2UgR0FQIG51bWJlcit1bml0KVxyXG4gKlxyXG4gKiAgICBJZiB5b3VyIG5ldyBzdHlsZSBpcyBhIHBhaXIgKHZhbHVlICsgdW5pdCksIG1pcnJvciB0aGUgJ2dhcCcgcGF0dGVybjpcclxuICogICAgICAtIHR3byBpbnB1dHMgd2l0aCBkYXRhLXN0eWxlLXBhcnQ9XCJ2YWx1ZVwiIGFuZCBkYXRhLXN0eWxlLXBhcnQ9XCJ1bml0XCJcclxuICogICAgICAtIGFkZCBhIHNtYWxsIGJyYW5jaCBpbiBvbl9jaGFuZ2UgKGxpa2UgdGhlIGV4aXN0aW5nIG9uZSBmb3Iga2V5ID09PSAnZ2FwJykgdGhhdCBjb21iaW5lcyB2YWx1ZSt1bml0XHJcbiAqICAgICAgICBiZWZvcmUgbm9ybWFsaXppbmcgYW5kIHNhdmluZy5cclxuICpcclxuICogLS0gNSkgQWN0aXZhdGlvbiAmIHBlcnNpc3RlbmNlICh3aGF0IGhhcHBlbnMgdW5kZXIgdGhlIGhvb2QpXHJcbiAqXHJcbiAqICAgIC0gVGhlIHNlcnZpY2UgY29tcGFyZXMgc2F2ZWQgdmFsdWVzIHZzIENPTF9QUk9QUyBkZWZhdWx0cy4gSWYgYW55IG5vbi1kZWZhdWx0IGV4aXN0cywgaXQgc2V0c1xyXG4gKiAgICAgIGRhdGEtY29sc3R5bGVzLWFjdGl2ZT1cIjFcIiBvbiB0aGUgc2VjdGlvbiBhbmQgd3JpdGVzIENTUyB2YXJzIHRvIHJlYWwgY29sdW1ucy5cclxuICogICAgLSBXaGVuIGluYWN0aXZlLCB0aGUgc2VydmljZSByZW1vdmVzIGlubGluZSB2YXJzIHNvIENTUyBmYWxscyBiYWNrIHRvIHlvdXIgZGVmYXVsdCBpbiB2YXIoLi4uLCBmYWxsYmFjaykuXHJcbiAqICAgIC0gZGF0YS1jb2xfc3R5bGVzIGF0dHJpYnV0ZSBzdG9yZXMgYSBjb21wYWN0IChzcGFyc2UpIEpTT046IG9ubHkga2V5cyB0aGF0IGRpZmZlciBmcm9tIGRlZmF1bHRzIGFyZSBzYXZlZC5cclxuICpcclxuICogQ2hlY2tsaXN0IGJlZm9yZSB5b3Ugc2hpcDpcclxuICogWyBdIENPTF9QUk9QUyBlbnRyeSBhZGRlZCB3aXRoIGNvcnJlY3QgdmFyIG5hbWUgYW5kIGRlZiB2YWx1ZVxyXG4gKiBbIF0gQ1NTIHZhcigpIGZhbGxiYWNrIG1hdGNoZXMgdGhlIEpTIGRlZmF1bHQgZXhhY3RseVxyXG4gKiBbIF0gSW5zcGVjdG9yIGNvbnRyb2wgcHJlc2VudCBhbmQgdXNlcyBkYXRhLXN0eWxlLWtleT1cIjx5b3VyIGtleT5cIlxyXG4gKiBbIF0gKElmIHNwbGl0LXZhbHVlKSBvbl9jaGFuZ2UgYnJhbmNoIGFkZGVkLCBsaWtlIGZvciAnZ2FwJ1xyXG4gKi9cclxuXHJcblxyXG4vKipcclxuICogVUk6IENvbHVtbiBTdHlsZXMgKHNlcnZpY2UgKyBpbnNwZWN0b3IgY29tcG9uZW50KVxyXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICogU3BsaXRzIGNvbHVtbi1zdHlsZSBsb2dpYyBvdXQgb2YgU2VjdGlvbiByZW5kZXJlcjpcclxuICogLSBTZXJ2aWNlOiBVSS5XUEJDX0JGQl9Db2x1bW5fU3R5bGVzIChwYXJzZS9zdHJpbmdpZnkvYXBwbHkvaXNfYWN0aXZlL2Jhc2VsaW5lKVxyXG4gKiAtIEluc3BlY3RvciBzbG90OiBVSS53cGJjX2JmYl9jb2x1bW5fc3R5bGVzIChyZW5kZXJfZm9yX3NlY3Rpb24gLyByZWZyZXNoX2Zvcl9zZWN0aW9uKVxyXG4gKlxyXG4gKiA9PSBGaWxlOiAvaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3Mvc2VjdGlvbi9fb3V0L3VpLWNvbHVtbi1zdHlsZXMuanNcclxuICpcclxuICogQHNpbmNlICAgICAxMS4wLjBcclxuICogQG1vZGlmaWVkICAyMDI1LTA5LTE2IDExOjI1XHJcbiAqIEB2ZXJzaW9uICAgMS4wLjBcclxuICovXHJcbihmdW5jdGlvbiAoIHcgKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHR2YXIgQ29yZSA9ICggdy5XUEJDX0JGQl9Db3JlID0gdy5XUEJDX0JGQl9Db3JlIHx8IHt9ICk7XHJcblx0dmFyIFVJICAgPSAoIENvcmUuVUkgPSBDb3JlLlVJIHx8IHt9ICk7XHJcblxyXG5cdHZhciBTICAgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplIHx8IHt9O1xyXG5cdHZhciBET00gPSAoIENvcmUuV1BCQ19CRkJfRE9NICYmIENvcmUuV1BCQ19CRkJfRE9NLlNFTEVDVE9SUyApIHx8IHtcclxuXHRcdHJvdyAgICA6ICcud3BiY19iZmJfX3JvdycsXHJcblx0XHRjb2x1bW4gOiAnLndwYmNfYmZiX19jb2x1bW4nXHJcblx0fTtcclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvKipcclxuXHQgKiBDZW50cmFsIHJlZ2lzdHJ5IG9mIHN1cHBvcnRlZCBwZXItY29sdW1uIENTUyBwcm9wZXJ0aWVzLlxyXG5cdCAqXHJcblx0ICogRWFjaCBlbnRyeSBkZXNjcmliZXMgaG93IGEgbG9naWNhbCBzdHlsZSBrZXkgbWFwcyB0byBhIENTUyBjdXN0b20gcHJvcGVydHlcclxuXHQgKiB3cml0dGVuIG9uIHRoZSBjb2x1bW4gZWxlbWVudCwgaXRzIGRlZmF1bHQgdmFsdWUsIGFuZCBob3cgdG8gbm9ybWFsaXplIHVzZXJcclxuXHQgKiBpbnB1dCBiZWZvcmUgcGVyc2lzdGluZy9hcHBseWluZy5cclxuXHQgKlxyXG5cdCAqIGtleSAgICAgICDigJQgU2hvcnQgc3R5bGUga2V5IHVzZWQgaW4gVUkgYW5kIHBlcnNpc3RlZCBKU09OLlxyXG5cdCAqIHZhciAgICAgICDigJQgQ1NTIHZhcmlhYmxlIG5hbWUgd3JpdHRlbiBvbnRvIHRoZSBET00gbm9kZSBzdHlsZS5cclxuXHQgKiBkZWYgICAgICAg4oCUIERlZmF1bHQgdmFsdWUgaWYgdGhlIHN0eWxlIGlzIHVuc2V0L2VtcHR5LlxyXG5cdCAqIG5vcm1hbGl6ZSDigJQgTm9ybWFsaXplciBpZCAoJ2lkJyBwYXNzdGhyb3VnaCwgJ2xlbicgZm9yIGxlbmd0aCB1bml0cykuXHJcblx0ICovXHJcblx0dmFyIENPTF9QUk9QUyA9IHtcclxuXHRcdGRpciAgOiB7IHZhcjogJy0td3BiYy1iZmItY29sLWRpcicsICAgZGVmOiAnY29sdW1uJywgICAgICAgIG5vcm1hbGl6ZTogJ2lkJyAgfSxcclxuXHRcdHdyYXAgOiB7IHZhcjogJy0td3BiYy1iZmItY29sLXdyYXAnLCAgZGVmOiAnbm93cmFwJywgICAgICAgbm9ybWFsaXplOiAnaWQnICB9LFxyXG5cdFx0amMgICA6IHsgdmFyOiAnLS13cGJjLWJmYi1jb2wtamMnLCAgICBkZWY6ICdmbGV4LXN0YXJ0Jywgbm9ybWFsaXplOiAnaWQnICB9LFxyXG5cdFx0YWkgICA6IHsgdmFyOiAnLS13cGJjLWJmYi1jb2wtYWknLCAgICBkZWY6ICdzdHJldGNoJywgICAgbm9ybWFsaXplOiAnaWQnICB9LFxyXG5cdFx0Z2FwICA6IHsgdmFyOiAnLS13cGJjLWJmYi1jb2wtZ2FwJywgICBkZWY6ICcwcHgnLCAgICAgICAgbm9ybWFsaXplOiAnbGVuJyB9LFxyXG5cdFx0YXNlbGY6IHsgdmFyOiAnLS13cGJjLWJmYi1jb2wtYXNlbGYnLCBkZWY6ICdmbGV4LXN0YXJ0JyxcclxuXHRcdFx0bm9ybWFsaXplOiB7IHR5cGU6ICdlbnVtJywgdmFsdWVzOiBbICdmbGV4LXN0YXJ0JywgJ2NlbnRlcicsICdmbGV4LWVuZCcsICdzdHJldGNoJyBdIH1cclxuXHRcdH1cclxuXHRcdC8vIEV4YW1wbGUgYWRkaXRpb25zOlxyXG5cdFx0Ly8gcGFkIDogeyB2YXI6ICctLXdwYmMtYmZiLWNvbC1wYWQnLCBkZWY6ICcwcHgnLCAgICAgICAgbm9ybWFsaXplOiAnbGVuJyB9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogTm9ybWFsaXplIGEgXCJsZW5ndGgtbGlrZVwiIHZhbHVlIChlLmcuLCBcIjhcIiDihpIgXCI4cHhcIikuXHJcblx0ICogQWNjZXB0cyBweC9yZW0vZW0vJTsgZXhwYW5kIHRoZSByZWdleCBpZiB5b3UgYWxsb3cgbW9yZSB1bml0cy5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfG51bWJlcn0gdlxyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9IG5vcm1hbGl6ZWQgdmFsdWUgKGFsd2F5cyBub24tZW1wdHkpXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gbm9ybV9sZW4oIHYgKSB7XHJcblx0XHR2YXIgc3YgPSBTdHJpbmcoIHYgfHwgJycgKS50cmltKCk7XHJcblx0XHRpZiAoICEgc3YgKSB7IHJldHVybiAnMHB4JzsgfVxyXG5cdFx0aWYgKCAvXlxcZCsoXFwuXFxkKyk/JC8udGVzdCggc3YgKSApIHsgcmV0dXJuIHN2ICsgJ3B4JzsgfSAgICAgICAgICAgICAgIC8vIG51bWJlciAtPiBweC5cclxuXHRcdGlmICggL15cXGQrKFxcLlxcZCspPyhweHxyZW18ZW18JSkkLy50ZXN0KCBzdiApICkgeyByZXR1cm4gc3Y7IH0gICAgICAgICAvLyBhbGxvd2VkIHVuaXRzLlxyXG5cdFx0cmV0dXJuICcwcHgnO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogRXhhbXBsZTogIGFjOiB7IHZhcjogJy0td3BiYy1iZmItY29sLWFjJywgZGVmOiAnbm9ybWFsJywgbm9ybWFsaXplOiB7IHR5cGU6ICdlbnVtJywgdmFsdWVzOiBbJ25vcm1hbCcsJ3N0cmV0Y2gnLCdjZW50ZXInLCdzdGFydCcsJ2VuZCcsJ3NwYWNlLWJldHdlZW4nLCdzcGFjZS1hcm91bmQnLCdzcGFjZS1ldmVubHknXSB9IH1cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB2XHJcblx0ICogQHBhcmFtIHZhbHNcclxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfCp9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gbm9ybV9lbnVtKHYsIHZhbHMpIHtcclxuXHRcdHYgPSBTdHJpbmcoIHYgfHwgJycgKTtcclxuXHRcdHJldHVybiB2YWxzLmluZGV4T2YoIHYgKSAhPT0gLTEgPyB2IDogdmFsc1swXTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIE5vcm1hbGl6ZXIgcmVnaXN0cnkuIEV4dGVuZCB0byBhZGQgY3VzdG9tIHZhbGlkYXRvcnMvdHJhbnNmb3Jtc1xyXG5cdCAqIChlLmcuLCBlbnVtcywgbnVtYmVycyB3aXRoIHJhbmdlcywgZXRjLikuXHJcblx0ICovXHJcblx0dmFyIE5PUk1BTElaRSA9IHtcclxuXHRcdGlkICA6IHYgPT4gU3RyaW5nKCB2IHx8ICcnICksXHJcblx0XHRsZW4gOiBub3JtX2xlbixcclxuXHRcdGVudW06ICh2LCB2YWx1ZXMpID0+IG5vcm1fZW51bSggdiwgdmFsdWVzIClcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBDaGVjayB3aGV0aGVyIGEgc3R5bGUga2V5IGlzIHN1cHBvcnRlZCBieSBDT0xfUFJPUFMuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30ga1xyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGlzX3N1cHBvcnRlZF9rZXkoIGsgKSB7XHJcblx0XHRyZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBDT0xfUFJPUFMsIGsgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIE5vcm1hbGl6ZSBhIHZhbHVlIGZvciBhIGdpdmVuIHN0eWxlIGtleSB1c2luZyBpdHMgY29uZmlndXJlZCBub3JtYWxpemVyLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IGtleVxyXG5cdCAqIEBwYXJhbSB7YW55fSB2YWxcclxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV92YWx1ZShrZXksIHZhbCkge1xyXG5cdFx0dmFyIGNmZyA9IENPTF9QUk9QU1trZXldO1xyXG5cdFx0aWYgKCAhIGNmZyApIHtcclxuXHRcdFx0cmV0dXJuIFN0cmluZyggdmFsIHx8ICcnICk7XHJcblx0XHR9XHJcblx0XHRpZiAoIGNmZy5ub3JtYWxpemUgJiYgdHlwZW9mIGNmZy5ub3JtYWxpemUgPT09ICdvYmplY3QnICYmIGNmZy5ub3JtYWxpemUudHlwZSA9PT0gJ2VudW0nICkge1xyXG5cdFx0XHRyZXR1cm4gTk9STUFMSVpFLmVudW0oIHZhbCwgY2ZnLm5vcm1hbGl6ZS52YWx1ZXMgfHwgW10gKTtcclxuXHRcdH1cclxuXHRcdHZhciBmbiA9IE5PUk1BTElaRVtjZmcubm9ybWFsaXplXSB8fCBOT1JNQUxJWkUuaWQ7XHJcblx0XHRyZXR1cm4gZm4oIHZhbCApO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogQnVpbGQgYSBwbGFpbiBvYmplY3QgY29udGFpbmluZyBkZWZhdWx0cyBmb3IgYWxsIHN1cHBvcnRlZCBzdHlsZSBrZXlzLlxyXG5cdCAqXHJcblx0ICogQHJldHVybnMge1JlY29yZDxzdHJpbmcsIHN0cmluZz59XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gZ2V0X2RlZmF1bHRzX29iaigpIHtcclxuXHRcdHZhciBvID0ge307IGZvciAoIHZhciBrIGluIENPTF9QUk9QUyApIHsgaWYgKCBpc19zdXBwb3J0ZWRfa2V5KCBrICkgKSB7IG9ba10gPSBDT0xfUFJPUFNba10uZGVmOyB9IH1cclxuXHRcdHJldHVybiBvO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogQXBwbHkgYWxsIENTUyB2YXJpYWJsZXMgKGZyb20gQ09MX1BST1BTKSBvbnRvIGEgbm9kZSBiYXNlZCBvbiBhIHN0eWxlIG9iamVjdC5cclxuXHQgKiBNaXNzaW5nL2VtcHR5IHZhbHVlcyBmYWxsIGJhY2sgdG8gZGVmYXVsdHMuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXHJcblx0ICogQHBhcmFtIHtSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+fSBzdHlsZV9vYmpcclxuXHQgKi9cclxuXHRmdW5jdGlvbiBzZXRfdmFycyggbm9kZSwgc3R5bGVfb2JqICkge1xyXG5cdFx0aWYgKCAhIG5vZGUgKSB7IHJldHVybjsgfVxyXG5cdFx0Zm9yICggdmFyIGsgaW4gQ09MX1BST1BTICkgeyBpZiAoIGlzX3N1cHBvcnRlZF9rZXkoIGsgKSApIHtcclxuXHRcdFx0dmFyIGNzc1ZhciA9IENPTF9QUk9QU1trXS52YXI7XHJcblx0XHRcdHZhciB2ID0gKCBzdHlsZV9vYmogJiYgc3R5bGVfb2JqW2tdICE9IG51bGwgJiYgU3RyaW5nKCBzdHlsZV9vYmpba10gKS50cmltKCkgIT09ICcnICkgPyBzdHlsZV9vYmpba10gOiBDT0xfUFJPUFNba10uZGVmO1xyXG5cdFx0XHRub2RlLnN0eWxlLnNldFByb3BlcnR5KCBjc3NWYXIsIFN0cmluZyggdiApICk7XHJcblx0XHR9fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2V0X3ZhcnNfc3BhcnNlKG5vZGUsIHN0eWxlX29iaikge1xyXG5cdFx0aWYgKCAhbm9kZSApIHJldHVybjtcclxuXHRcdGZvciAoIHZhciBrIGluIENPTF9QUk9QUyApIHsgaWYgKCBpc19zdXBwb3J0ZWRfa2V5KGspICkge1xyXG5cdFx0XHR2YXIgY3NzVmFyID0gQ09MX1BST1BTW2tdLnZhcjtcclxuXHRcdFx0aWYgKCBzdHlsZV9vYmogJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHN0eWxlX29iaiwgaykgJiYgU3RyaW5nKHN0eWxlX29ialtrXSkudHJpbSgpICE9PSAnJyApIHtcclxuXHRcdFx0XHRub2RlLnN0eWxlLnNldFByb3BlcnR5KGNzc1ZhciwgU3RyaW5nKHN0eWxlX29ialtrXSkpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdC8vIGltcG9ydGFudDogcmVtb3ZlIHZhciBpbnN0ZWFkIG9mIHdyaXRpbmcgYSBkZWZhdWx0XHJcblx0XHRcdFx0bm9kZS5zdHlsZS5yZW1vdmVQcm9wZXJ0eShjc3NWYXIpO1xyXG5cdFx0XHR9XHJcblx0XHR9fVxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUmVtb3ZlIGFsbCBDU1MgdmFyaWFibGVzIChmcm9tIENPTF9QUk9QUykgZnJvbSBhIG5vZGUuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gY2xlYXJfdmFycyggbm9kZSApIHtcclxuXHRcdGlmICggISBub2RlICkgeyByZXR1cm47IH1cclxuXHRcdGZvciAoIHZhciBrIGluIENPTF9QUk9QUyApIHsgaWYgKCBpc19zdXBwb3J0ZWRfa2V5KCBrICkgKSB7XHJcblx0XHRcdG5vZGUuc3R5bGUucmVtb3ZlUHJvcGVydHkoIENPTF9QUk9QU1trXS52YXIgKTtcclxuXHRcdH19XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBDbGFtcCBoZWxwZXIgZm9yIGNvbHVtbnMgbnVtYmVyLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSBuXHJcblx0ICogQHJldHVybnMge251bWJlcn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiBjbGFtcF9jb2xzKCBuICkge1xyXG5cdFx0cmV0dXJuICggUy5jbGFtcCA/IFMuY2xhbXAoIE51bWJlciggbiApIHx8IDEsIDEsIDQgKSA6IE1hdGgubWF4KCAxLCBNYXRoLm1pbiggNCwgTnVtYmVyKCBuICkgfHwgMSApICkgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlYWQgYWN0dWFsIG51bWJlciBvZiBjb2x1bW5zIGZyb20gRE9NLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxcclxuXHQgKiBAcmV0dXJucyB7bnVtYmVyfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGRvbV9jb2xzKCBlbCApIHtcclxuXHRcdHRyeSB7XHJcblx0XHRcdHZhciByb3cgPSBlbCA/IGVsLnF1ZXJ5U2VsZWN0b3IoICc6c2NvcGUgPiAnICsgRE9NLnJvdyApIDogbnVsbDtcclxuXHRcdFx0dmFyIGNudCA9IHJvdyA/IHJvdy5xdWVyeVNlbGVjdG9yQWxsKCAnOnNjb3BlID4gJyArIERPTS5jb2x1bW4gKS5sZW5ndGggOiAxO1xyXG5cdFx0XHRyZXR1cm4gY2xhbXBfY29scyggY250ICk7XHJcblx0XHR9IGNhdGNoICggX2UgKSB7XHJcblx0XHRcdHJldHVybiAxO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gU2VydmljZTogQ29sdW1uIFN0eWxlc1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFVJLldQQkNfQkZCX0NvbHVtbl9TdHlsZXMgPSB7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBIaWdobGlnaHQgYSBzcGVjaWZpYyBjb2x1bW4gaW4gYm90aCB0aGUgbGl2ZSBjYW52YXMgYW5kIHRoZSBtaW5pIHByZXZpZXcsXHJcblx0XHQgKiBhbmQgc3RvcmUgdGhlIGFjdGl2ZSBpbmRleCBvbiB0aGUgc2VjdGlvbi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBzZWN0aW9uX2VsXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IGtleV8xYmFzZWQgIDEtYmFzZWQgY29sdW1uIGluZGV4IChjbGFtcGVkKVxyXG5cdFx0ICovXHJcblx0XHRzZXRfc2VsZWN0ZWRfY29sX2ZsYWcgOiBmdW5jdGlvbiAoIHNlY3Rpb25fZWwsIGtleV8xYmFzZWQgKSB7XHJcblx0XHRcdGlmICggISBzZWN0aW9uX2VsICkgeyByZXR1cm47IH1cclxuXHRcdFx0dmFyIGNvbHNfY250ID0gZG9tX2NvbHMoIHNlY3Rpb25fZWwgKTtcclxuXHRcdFx0dmFyIGlkeCAgICAgID0gTWF0aC5taW4oIE1hdGgubWF4KCBwYXJzZUludCgga2V5XzFiYXNlZCwgMTAgKSB8fCAxLCAxICksIGNvbHNfY250IHx8IDEgKTtcclxuXHRcdFx0dmFyIGlkeDAgICAgID0gaWR4IC0gMTtcclxuXHJcblx0XHRcdHNlY3Rpb25fZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1zZWxlY3RlZC1jb2wnLCBTdHJpbmcoIGlkeCApICk7XHJcblxyXG5cdFx0XHQvLyBSZWFsIGNhbnZhcyBjb2x1bW5zLlxyXG5cdFx0XHR2YXIgcm93ICA9IHNlY3Rpb25fZWwucXVlcnlTZWxlY3RvciggJzpzY29wZSA+ICcgKyBET00ucm93ICk7XHJcblx0XHRcdHZhciBjb2xzID0gcm93ID8gcm93LnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAnICsgRE9NLmNvbHVtbiApIDogW107XHJcblx0XHRcdGZvciAoIHZhciBpID0gMDsgaSA8IGNvbHMubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0aWYgKCBjb2xzW2ldLmNsYXNzTGlzdCApIHtcclxuXHRcdFx0XHRcdGNvbHNbaV0uY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLXNlbGVjdGVkLWNvbHVtbicsIGkgPT09IGlkeDAgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIE1pbmkgcHJldmlldyBjb2x1bW5zLlxyXG5cdFx0XHR2YXIgcGNvbHMgPSBzZWN0aW9uX2VsLnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgLndwYmNfYmZiX19zZWN0aW9uX19jb2xzID4gLndwYmNfYmZiX19zZWN0aW9uX19jb2wnICk7XHJcblx0XHRcdGZvciAoIHZhciBqID0gMDsgaiA8IHBjb2xzLmxlbmd0aDsgaisrICkge1xyXG5cdFx0XHRcdGlmICggcGNvbHNbal0uY2xhc3NMaXN0ICkge1xyXG5cdFx0XHRcdFx0cGNvbHNbal0uY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLXNlbGVjdGVkLWNvbHVtbicsIGogPT09IGlkeDAgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZW1vdmUgY29sdW1uIHNlbGVjdGlvbiBoaWdobGlnaHQgZnJvbSBib3RoIGNhbnZhcyBhbmQgbWluaSBwcmV2aWV3LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHNlY3Rpb25fZWxcclxuXHRcdCAqL1xyXG5cdFx0Y2xlYXJfc2VsZWN0ZWRfY29sX2ZsYWcgOiBmdW5jdGlvbiAoIHNlY3Rpb25fZWwgKSB7XHJcblx0XHRcdGlmICggISBzZWN0aW9uX2VsICkgeyByZXR1cm47IH1cclxuXHRcdFx0c2VjdGlvbl9lbC5yZW1vdmVBdHRyaWJ1dGUoICdkYXRhLXNlbGVjdGVkLWNvbCcgKTtcclxuXHJcblx0XHRcdHZhciByb3cgID0gc2VjdGlvbl9lbC5xdWVyeVNlbGVjdG9yKCAnOnNjb3BlID4gJyArIERPTS5yb3cgKTtcclxuXHRcdFx0dmFyIGNvbHMgPSByb3cgPyByb3cucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSA+ICcgKyBET00uY29sdW1uICkgOiBbXTtcclxuXHRcdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwgY29scy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0XHRjb2xzW2ldLmNsYXNzTGlzdCAmJiBjb2xzW2ldLmNsYXNzTGlzdC5yZW1vdmUoICdpcy1zZWxlY3RlZC1jb2x1bW4nICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBwY29scyA9IHNlY3Rpb25fZWwucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSAud3BiY19iZmJfX3NlY3Rpb25fX2NvbHMgPiAud3BiY19iZmJfX3NlY3Rpb25fX2NvbCcgKTtcclxuXHRcdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgcGNvbHMubGVuZ3RoOyBqKysgKSB7XHJcblx0XHRcdFx0cGNvbHNbal0uY2xhc3NMaXN0ICYmIHBjb2xzW2pdLmNsYXNzTGlzdC5yZW1vdmUoICdpcy1zZWxlY3RlZC1jb2x1bW4nICk7XHJcblx0XHRcdH1cclxuXHRcdH0sXHJcblxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFBhcnNlIEpTT04gc3RyaW5nIHRvIGFycmF5IG9mIHBlci1jb2x1bW4gc3R5bGUgb2JqZWN0cy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gc1xyXG5cdFx0ICogQHJldHVybnMge0FycmF5PHtkaXI6c3RyaW5nLHdyYXA6c3RyaW5nLGpjOnN0cmluZyxhaTpzdHJpbmcsZ2FwOnN0cmluZ30+fVxyXG5cdFx0ICovXHJcblx0XHRwYXJzZV9jb2xfc3R5bGVzIDogZnVuY3Rpb24gKCBzICkge1xyXG5cdFx0XHRpZiAoICEgcyApIHsgcmV0dXJuIFtdOyB9XHJcblx0XHRcdHZhciBvYmogPSAoIFMuc2FmZV9qc29uX3BhcnNlID8gUy5zYWZlX2pzb25fcGFyc2UoIFN0cmluZyggcyApLCBudWxsICkgOiAoIGZ1bmN0aW9uKCl7IHRyeSB7IHJldHVybiBKU09OLnBhcnNlKCBTdHJpbmcoIHMgKSApOyB9IGNhdGNoKCBfZSApeyByZXR1cm4gbnVsbDsgfSB9ICkoKSApO1xyXG5cdFx0XHRpZiAoIEFycmF5LmlzQXJyYXkoIG9iaiApICkgeyByZXR1cm4gb2JqOyB9XHJcblx0XHRcdGlmICggb2JqICYmIHR5cGVvZiBvYmogPT09ICdvYmplY3QnICYmIEFycmF5LmlzQXJyYXkoIG9iai5jb2x1bW5zICkgKSB7IHJldHVybiBvYmouY29sdW1uczsgfVxyXG5cdFx0XHRyZXR1cm4gW107XHJcblx0XHR9LFxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU3RyaW5naWZ5IHN0eWxlcyBhcnJheSB0byBjYW5vbmljYWwgSlNPTi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0FycmF5fSBhcnJcclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0cmluZ2lmeV9jb2xfc3R5bGVzIDogZnVuY3Rpb24gKCBhcnIgKSB7XHJcblx0XHRcdHZhciBkYXRhID0gQXJyYXkuaXNBcnJheSggYXJyICkgPyBhcnIgOiBbXTtcclxuXHRcdFx0cmV0dXJuICggUy5zdHJpbmdpZnlfZGF0YV92YWx1ZSA/IFMuc3RyaW5naWZ5X2RhdGFfdmFsdWUoIGRhdGEgKSA6IEpTT04uc3RyaW5naWZ5KCBkYXRhICkgKTtcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDaGVjayBpZiBwZXItY29sdW1uIHN0eWxlcyBhcmUgYWN0aXZlIGZvciBhIHNlY3Rpb24uXHJcblx0XHQgKiAtIEFjdGl2ZSBpZiBlbGVtZW50IGZsYWcgZGF0YS1jb2xzdHlsZXMtYWN0aXZlPVwiMVwiIE9SIG5vbi1lbXB0eSBzZXJpYWxpemVkIHN0eWxlcy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBzZWN0aW9uX2VsXHJcblx0XHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHRcdCAqL1xyXG5cdFx0aXNfYWN0aXZlIDogZnVuY3Rpb24gKCBzZWN0aW9uX2VsICkge1xyXG5cdFx0XHRpZiAoICEgc2VjdGlvbl9lbCApIHsgcmV0dXJuIGZhbHNlOyB9XHJcblx0XHRcdGlmICggc2VjdGlvbl9lbC5nZXRBdHRyaWJ1dGUoICdkYXRhLWNvbHN0eWxlcy1hY3RpdmUnICkgPT09ICcxJyApIHsgcmV0dXJuIHRydWU7IH1cclxuICAgICAgICAgICAgdmFyIHJhdyA9IHNlY3Rpb25fZWwuZ2V0QXR0cmlidXRlKCAnZGF0YS1jb2xfc3R5bGVzJyApIHx8ICggc2VjdGlvbl9lbC5kYXRhc2V0ID8gKCBzZWN0aW9uX2VsLmRhdGFzZXQuY29sX3N0eWxlcyB8fCAnJyApIDogJycgKTtcclxuICAgICAgICAgICAgdmFyIGFyciA9IHRoaXMucGFyc2VfY29sX3N0eWxlcyggcmF3ICk7XHJcbiAgICAgICAgICAgIHZhciBERUYgPSBnZXRfZGVmYXVsdHNfb2JqKCk7XHJcbiAgICAgICAgICAgIC8vIEFjdGl2ZSBvbmx5IGlmIGFueSBjb2x1bW4gaGFzIGEgbm9uLWRlZmF1bHQsIG5vbi1lbXB0eSBvdmVycmlkZS5cclxuICAgICAgICAgICAgZm9yICggdmFyIGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSsrICkge1xyXG4gICAgICAgICAgICAgICAgdmFyIHMgPSBhcnJbaV0gfHwge307XHJcbiAgICAgICAgICAgICAgICBmb3IgKCB2YXIgayBpbiBERUYgKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIHMsIGsgKSApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHYgPSBTdHJpbmcoIHNba10gKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCB2ICYmIHYgIT09IFN0cmluZyggREVGW2tdICkgKSB7IHJldHVybiB0cnVlOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBBcHBseSBwZXItY29sdW1uIHN0eWxlcyB0byBwcmV2aWV3IGFuZCwgd2hlbiBhY3RpdmUsIHRvIHJlYWwgY29sdW1ucy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBzZWN0aW9uX2VsXHJcblx0XHQgKiBAcGFyYW0ge0FycmF5fSAgICAgICBzdHlsZXNcclxuXHRcdCAqL1xyXG5cdFx0YXBwbHkgOiBmdW5jdGlvbiAoIHNlY3Rpb25fZWwsIHN0eWxlcyApIHtcclxuXHRcdFx0aWYgKCAhIHNlY3Rpb25fZWwgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0Ly8gTWluaSBwcmV2aWV3IGluc2lkZSB0aGUgc2VjdGlvbiB0ZW1wbGF0ZSAoYWx3YXlzIG9uKS5cclxuXHRcdFx0dmFyIHByZXZpZXcgPSBzZWN0aW9uX2VsLnF1ZXJ5U2VsZWN0b3IoICc6c2NvcGUgLndwYmNfYmZiX19zZWN0aW9uX19jb2xzJyApO1xyXG5cdFx0XHRpZiAoIHByZXZpZXcgKSB7XHJcblx0XHRcdFx0dmFyIHBjb2xzID0gcHJldmlldy5xdWVyeVNlbGVjdG9yQWxsKCAnOnNjb3BlID4gLndwYmNfYmZiX19zZWN0aW9uX19jb2wnICk7XHJcblx0XHRcdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwgcGNvbHMubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0XHRzZXRfdmFycyhwY29sc1tpXSwgc3R5bGVzW2ldIHx8IHt9KTsgICAvLyBPSyB0byB1c2UgZGVmYXVsdHMgaW4gcHJldmlld1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gRGV0ZXJtaW5lIGFjdGl2YXRpb24gZnJvbSBjdXJyZW50IGVsZW1lbnQgc3RhdGUgKG5vdCBmcm9tIHN0eWxlcyBhcmcgYWxvbmUpLlxyXG5cdFx0XHR2YXIgYWN0aXZlID0gdGhpcy5pc19hY3RpdmUoIHNlY3Rpb25fZWwgKTtcclxuXHJcblx0XHRcdC8vIElmIG5vdCBhY3RpdmUsIGNsZWFuIHVwIGlubGluZSB2YXJzIGFuZCByZW1vdmUgdGhlIGZsYWcuXHJcblx0XHRcdGlmICggISBhY3RpdmUgKSB7XHJcblx0XHRcdFx0c2VjdGlvbl9lbC5yZW1vdmVBdHRyaWJ1dGUoICdkYXRhLWNvbHN0eWxlcy1hY3RpdmUnICk7XHJcblx0XHRcdFx0dmFyIHJvd19vZmYgPSBzZWN0aW9uX2VsLnF1ZXJ5U2VsZWN0b3IoICc6c2NvcGUgPiAnICsgRE9NLnJvdyApO1xyXG5cdFx0XHRcdGlmICggcm93X29mZiApIHtcclxuXHRcdFx0XHRcdHZhciBub2RlcyA9IHJvd19vZmYucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSA+ICcgKyBET00uY29sdW1uICk7XHJcblx0XHRcdFx0XHRmb3IgKCB2YXIgaiA9IDA7IGogPCBub2Rlcy5sZW5ndGg7IGorKyApIHtcclxuXHRcdFx0XHRcdFx0Y2xlYXJfdmFycyggbm9kZXNbal0gKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBBY3RpdmU6IGFkZCBmbGFnIGlmIG1pc3NpbmcgYW5kIHdyaXRlIENTUyB2YXJzIHRvIFJFQUwgY2FudmFzIGNvbHVtbnMuXHJcblx0XHRcdHNlY3Rpb25fZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1jb2xzdHlsZXMtYWN0aXZlJywgJzEnICk7XHJcblxyXG5cdFx0XHQvLyBORVc6IGFsd2F5cyB1c2UgdGhlIHNwYXJzZSwgc2F2ZWQgSlNPTiBmb3IgUkVBTCBjb2x1bW5zLlxyXG5cdFx0XHR2YXIgdXNlX3N0eWxlcyA9IHRoaXMucGFyc2VfY29sX3N0eWxlcyhcclxuXHRcdFx0XHRzZWN0aW9uX2VsLmdldEF0dHJpYnV0ZSggJ2RhdGEtY29sX3N0eWxlcycgKSB8fFxyXG5cdFx0XHRcdChzZWN0aW9uX2VsLmRhdGFzZXQgPyAoc2VjdGlvbl9lbC5kYXRhc2V0LmNvbF9zdHlsZXMgfHwgJycpIDogJycpXHJcblx0XHRcdCk7XHJcblxyXG5cdFx0XHR2YXIgcm93ID0gc2VjdGlvbl9lbC5xdWVyeVNlbGVjdG9yKCAnOnNjb3BlID4gJyArIERPTS5yb3cgKTtcclxuXHRcdFx0aWYgKCByb3cgKSB7XHJcblx0XHRcdFx0dmFyIHJjb2xzID0gcm93LnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAnICsgRE9NLmNvbHVtbiApO1xyXG5cdFx0XHRcdGZvciAoIHZhciBrID0gMDsgayA8IHJjb2xzLmxlbmd0aDsgaysrICkge1xyXG5cdFx0XHRcdFx0c2V0X3ZhcnNfc3BhcnNlKHJjb2xzW2tdLCB1c2Vfc3R5bGVzW2tdIHx8IHt9KTsgLy8gb25seSB3cml0ZSB3aGF0IGV4aXN0c1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEluc3BlY3RvciBjb21wb25lbnQgKHNsb3Q6IFwiY29sdW1uX3N0eWxlc1wiKVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFVJLndwYmNfYmZiX2NvbHVtbl9zdHlsZXMgPSB7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZW5kZXIgdGhlIHBlci1jb2x1bW4gc3R5bGUgZWRpdG9yICh3cC50ZW1wbGF0ZTogJ3dwYmMtYmZiLWNvbHVtbi1zdHlsZXMnKS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge29iamVjdH0gICAgICBidWlsZGVyXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBzZWN0aW9uX2VsXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBob3N0XHJcblx0XHQgKi9cclxuXHRcdHJlbmRlcl9mb3Jfc2VjdGlvbiA6IGZ1bmN0aW9uICggYnVpbGRlciwgc2VjdGlvbl9lbCwgaG9zdCApIHtcclxuXHRcdFx0aWYgKCAhIGhvc3QgfHwgISBzZWN0aW9uX2VsICkgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdC8vIENhcHR1cmUgY3VycmVudCBhY3RpdmUgdGFiIEJFRk9SRSB3ZSBjbGVhciBob3N0LlxyXG5cdFx0XHR2YXIgX19wcmV2X3Jvb3QgPSBob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRhYnNdJyApO1xyXG5cdFx0XHR2YXIgZHMgICAgICAgICAgPSBzZWN0aW9uX2VsLmRhdGFzZXQgfHwge307XHJcblx0XHRcdHZhciBfX3ByZXZfa2V5ICA9IChfX3ByZXZfcm9vdCAmJiBfX3ByZXZfcm9vdC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGFiLWFjdGl2ZScgKSkgfHwgaG9zdC5fX3dwYmNfYWN0aXZlX2tleSB8fCBkcy5jb2xfc3R5bGVzX2FjdGl2ZV90YWIgfHwgbnVsbDtcclxuXHJcblx0XHRcdC8vIENsZWFudXAgcHJldmlvdXMgbW91bnQgYW5kIGNsZWFyLlxyXG5cdFx0XHRpZiAoIGhvc3QuX193cGJjX2NsZWFudXAgKSB7XHJcblx0XHRcdFx0dHJ5IHsgaG9zdC5fX3dwYmNfY2xlYW51cCgpOyB9IGNhdGNoICggX2UgKSB7fVxyXG5cdFx0XHRcdGhvc3QuX193cGJjX2NsZWFudXAgPSBudWxsO1xyXG5cdFx0XHR9XHJcblx0XHRcdGhvc3QuaW5uZXJIVE1MID0gJyc7XHJcblxyXG5cdFx0XHR2YXIgdHBsID0gKCB3LndwICYmIHcud3AudGVtcGxhdGUgKSA/IHcud3AudGVtcGxhdGUoICd3cGJjLWJmYi1jb2x1bW4tc3R5bGVzJyApIDogbnVsbDtcclxuXHRcdFx0aWYgKCAhIHRwbCApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHR2YXIgY29sX2NvdW50ICA9IGRvbV9jb2xzKCBzZWN0aW9uX2VsICk7XHJcblx0XHRcdHZhciByYXdfanNvbiAgID0gc2VjdGlvbl9lbC5nZXRBdHRyaWJ1dGUoICdkYXRhLWNvbF9zdHlsZXMnICkgfHwgKCBzZWN0aW9uX2VsLmRhdGFzZXQgPyAoIHNlY3Rpb25fZWwuZGF0YXNldC5jb2xfc3R5bGVzIHx8ICcnICkgOiAnJyApO1xyXG5cclxuICAgICAgICAgICAgdmFyIHNhdmVkX2FyciAgPSBVSS5XUEJDX0JGQl9Db2x1bW5fU3R5bGVzLnBhcnNlX2NvbF9zdHlsZXMoIHJhd19qc29uICk7XHJcbiAgICAgICAgICAgIHZhciBzdHlsZXNfYXJyID0gW107XHJcblxyXG5cdFx0XHQvLyBOb3JtYWxpemUgbGVuZ3RoIHRvIGN1cnJlbnQgY29sdW1ucyAoVUktb25seSBkZWZhdWx0cyBkbyBOT1QgYXV0by1hY3RpdmF0ZSkuXHJcblx0XHRcdHZhciBkZWYgPSBnZXRfZGVmYXVsdHNfb2JqKCk7XHJcblx0XHRcdGZvciAoIHZhciBpID0gMDsgaSA8IGNvbF9jb3VudDsgaSsrICkge1xyXG5cdFx0XHRcdHZhciBzcmMgPSBzYXZlZF9hcnJbaV0gfHwge307XHJcbiAgICAgICAgICAgICAgICAvLyBNZXJnZSBmb3IgZGlzcGxheSwgYnV0IHRyYWNrIHdoaWNoIGtleXMgd2VyZSBhY3R1YWxseSBwcmVzZW50IGluIHNhdmVkIEpTT04uXHJcbiAgICAgICAgICAgICAgICB2YXIgZnVsbCA9IE9iamVjdC5hc3NpZ24oIHt9LCBkZWYsIHNyYyApO1xyXG4gICAgICAgICAgICAgICAgZnVsbC5fX2hhcyA9IHtcclxuICAgICAgICAgICAgICAgICAgICBkaXIgICA6IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggc3JjLCAnZGlyJyApLFxyXG4gICAgICAgICAgICAgICAgICAgIHdyYXAgIDogT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBzcmMsICd3cmFwJyApLFxyXG4gICAgICAgICAgICAgICAgICAgIGpjICAgIDogT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBzcmMsICdqYycgKSxcclxuICAgICAgICAgICAgICAgICAgICBhaSAgICA6IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggc3JjLCAnYWknICksXHJcbiAgICAgICAgICAgICAgICAgICAgZ2FwICAgOiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIHNyYywgJ2dhcCcgKSxcclxuICAgICAgICAgICAgICAgICAgICBhc2VsZiA6IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggc3JjLCAnYXNlbGYnIClcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICBzdHlsZXNfYXJyW2ldID0gZnVsbDtcclxuXHRcdFx0fVxyXG5cdFx0XHRzdHlsZXNfYXJyLmxlbmd0aCA9IGNvbF9jb3VudDsgICAvLyBjbGFtcC5cclxuXHJcblx0XHRcdGhvc3QuaW5uZXJIVE1MID0gdHBsKCB7XHJcblx0XHRcdFx0Y29scyAgOiBjb2xfY291bnQsXHJcblx0XHRcdFx0c3R5bGVzOiBzdHlsZXNfYXJyLFxyXG5cdFx0XHRcdGFjdGl2ZTogVUkuV1BCQ19CRkJfQ29sdW1uX1N0eWxlcy5pc19hY3RpdmUoIHNlY3Rpb25fZWwgKVxyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRpZiAoIHdpbmRvdy53cGJjX3VpX3RhYnMgJiYgaG9zdCApIHtcclxuXHRcdFx0XHR3aW5kb3cud3BiY191aV90YWJzLmluaXRfb24oIGhvc3QgKTtcclxuXHJcblxyXG5cdFx0XHRcdC8vIFBlcnNpc3QgdGhlIGFjdGl2ZSB0YWIgc28gd2UgY2FuIHJlc3RvcmUgaXQgYWZ0ZXIgcmUtcmVuZGVycy5cclxuXHRcdFx0XHR2YXIgdGFic1Jvb3QgPSBob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRhYnNdJyApO1xyXG5cdFx0XHRcdGlmICggdGFic1Jvb3QgJiYgIXRhYnNSb290Ll9fd3BiY19wZXJzaXN0X2xpc3RlbmVyICkge1xyXG5cdFx0XHRcdFx0dGFic1Jvb3QuX193cGJjX3BlcnNpc3RfbGlzdGVuZXIgPSB0cnVlO1xyXG5cdFx0XHRcdFx0dGFic1Jvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6dGFiczpjaGFuZ2UnLCBmdW5jdGlvbiAoZSkge1xyXG5cdFx0XHRcdFx0XHR2YXIgayA9IGUgJiYgZS5kZXRhaWwgJiYgZS5kZXRhaWwuYWN0aXZlX2tleTtcclxuXHRcdFx0XHRcdFx0aWYgKCBrICkge1xyXG5cdFx0XHRcdFx0XHRcdGhvc3QuX193cGJjX2FjdGl2ZV9rZXkgPSBTdHJpbmcoIGsgKTtcclxuXHRcdFx0XHRcdFx0XHRpZiAoIHNlY3Rpb25fZWwgJiYgc2VjdGlvbl9lbC5kYXRhc2V0ICkge1xyXG5cdFx0XHRcdFx0XHRcdFx0c2VjdGlvbl9lbC5kYXRhc2V0LmNvbF9zdHlsZXNfYWN0aXZlX3RhYiA9IFN0cmluZyggayApO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHQvLyBORVc6IHJlZmxlY3Qgc2VsZWN0aW9uIG9uIHRoZSBzZWN0aW9uICsgY29sdW1ucy5cclxuXHRcdFx0XHRcdFx0XHRVSS5XUEJDX0JGQl9Db2x1bW5fU3R5bGVzLnNldF9zZWxlY3RlZF9jb2xfZmxhZyggc2VjdGlvbl9lbCwgayApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9LCB0cnVlICk7XHJcblxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gUmVzdG9yZSBwcmV2aW91cyB0YWIgaWYgaXQgc3RpbGwgZXhpc3RzIChjbGFtcCB0byBuZXcgY291bnQpLlxyXG5cdFx0XHRcdHZhciBfX2tleVxyXG5cdFx0XHRcdGlmICggX19wcmV2X2tleSApIHtcclxuXHRcdFx0XHRcdHZhciBfX25ld19yb290ID0gaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10YWJzXScgKTtcclxuXHRcdFx0XHRcdF9fa2V5ICAgICAgICAgID0gU3RyaW5nKCBNYXRoLm1pbiggTWF0aC5tYXgoIHBhcnNlSW50KCBfX3ByZXZfa2V5LCAxMCApIHx8IDEsIDEgKSwgY29sX2NvdW50ICkgKTtcclxuXHRcdFx0XHRcdGlmICggX19uZXdfcm9vdCAmJiB3aW5kb3cud3BiY191aV90YWJzLnNldF9hY3RpdmUgKSB7XHJcblx0XHRcdFx0XHRcdHdpbmRvdy53cGJjX3VpX3RhYnMuc2V0X2FjdGl2ZSggX19uZXdfcm9vdCwgX19rZXkgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIEFmdGVyIHJlc3RvcmluZyB0aGUgdGFiLCBlbnN1cmUgaGlnaGxpZ2h0IG1hdGNoZXMgdGhlIGFjdGl2ZSB0YWIuXHJcblx0XHRcdFx0dmFyIF9fYWN0aXZlX2tleV9ub3cgPSBfX2tleSB8fCAoZHMuY29sX3N0eWxlc19hY3RpdmVfdGFiID8gU3RyaW5nKCBNYXRoLm1pbiggTWF0aC5tYXgoIHBhcnNlSW50KCBkcy5jb2xfc3R5bGVzX2FjdGl2ZV90YWIsIDEwICkgfHwgMSwgMSApLCBjb2xfY291bnQgKSApIDogJzEnKTtcclxuXHRcdFx0XHRVSS5XUEJDX0JGQl9Db2x1bW5fU3R5bGVzLnNldF9zZWxlY3RlZF9jb2xfZmxhZyggc2VjdGlvbl9lbCwgX19hY3RpdmVfa2V5X25vdyApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBSZS13aXJlIG51bWJlciAtIHJhbmdlIHBhaXJpbmcgKFZhbHVlU2xpZGVyKSBmb3IgZnJlc2hseSByZW5kZXJlZCBjb250cm9scy5cclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIFVJLkluc3BlY3RvckVuaGFuY2VycyAmJiBVSS5JbnNwZWN0b3JFbmhhbmNlcnMuc2NhbiAmJiBVSS5JbnNwZWN0b3JFbmhhbmNlcnMuc2NhbiggaG9zdCApO1xyXG4gICAgICAgICAgICAgICAgLy8gQWx0ZXJuYXRpdmVseSAoZGlyZWN0IHdpcmluZyk6XHJcbiAgICAgICAgICAgICAgICAvLyBVSS5XUEJDX0JGQl9WYWx1ZVNsaWRlciAmJiBVSS5XUEJDX0JGQl9WYWx1ZVNsaWRlci5pbml0X29uICYmIFVJLldQQkNfQkZCX1ZhbHVlU2xpZGVyLmluaXRfb24oIGhvc3QgKTtcclxuICAgICAgICAgICAgfSBjYXRjaCAoIF9lICkge31cclxuXHJcblx0XHRcdC8vIFNldCBpbml0aWFsIHN0YXRlIG9mIElDT05TIChpbmNsdWRpbmcgZGVmYXVsdHMpIGlzIGNvcnJlY3QuXHJcblx0XHRcdHN5bmNfYXhpc19yb3RhdGlvbl9hbGwoKTtcclxuXHJcblx0XHRcdGZ1bmN0aW9uIHN0eWxlc19oYXNfYW55X25vbl9kZWZhdWx0KHN0eWxlc19hcnIsIGdldF9kZWZhdWx0c19vYmpfZm4pIHtcclxuXHRcdFx0XHR2YXIgZGVmID0gZ2V0X2RlZmF1bHRzX29ial9mbigpO1xyXG5cdFx0XHRcdGZvciAoIHZhciBpID0gMDsgaSA8IHN0eWxlc19hcnIubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0XHR2YXIgcyA9IHN0eWxlc19hcnJbaV0gfHwge307XHJcblx0XHRcdFx0XHRmb3IgKCB2YXIgayBpbiBkZWYgKSB7XHJcblx0XHRcdFx0XHRcdGlmICggT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBkZWYsIGsgKSApIHtcclxuXHRcdFx0XHRcdFx0XHR2YXIgdiA9IChzW2tdID09IG51bGwpID8gJycgOiBTdHJpbmcoIHNba10gKTtcclxuXHRcdFx0XHRcdFx0XHQvLyB0cmVhdCBlbXB0eSBhcyBcIm5vdCBzZWxlY3RlZFwiIChub3QgYWN0aXZlKS5cclxuXHRcdFx0XHRcdFx0XHRpZiAoIHYgJiYgdiAhPT0gU3RyaW5nKCBkZWZba10gKSApIHtcclxuXHRcdFx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGZ1bmN0aW9uIHN0cmlwX2RlZmF1bHRzX2Zvcl9zYXZlKHN0eWxlc19hcnIsIGdldF9kZWZhdWx0c19vYmpfZm4pIHtcclxuXHRcdFx0XHR2YXIgZGVmID0gZ2V0X2RlZmF1bHRzX29ial9mbigpO1xyXG5cdFx0XHRcdHZhciBvdXQgPSBbXTtcclxuXHRcdFx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBzdHlsZXNfYXJyLmxlbmd0aDsgaSsrICkge1xyXG5cdFx0XHRcdFx0dmFyIHMgICA9IHN0eWxlc19hcnJbaV0gfHwge307XHJcblx0XHRcdFx0XHR2YXIgcm93ID0ge307XHJcblx0XHRcdFx0XHRmb3IgKCB2YXIgayBpbiBkZWYgKSB7XHJcblx0XHRcdFx0XHRcdGlmICggT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBkZWYsIGsgKSApIHtcclxuXHRcdFx0XHRcdFx0XHR2YXIgdiA9IChzW2tdID09IG51bGwpID8gJycgOiBTdHJpbmcoIHNba10gKTtcclxuXHRcdFx0XHRcdFx0XHRpZiAoIHYgJiYgdiAhPT0gU3RyaW5nKCBkZWZba10gKSApIHtcclxuXHRcdFx0XHRcdFx0XHRcdHJvd1trXSA9IHY7IC8vIG9ubHkga2VlcCBtZWFuaW5nZnVsIG92ZXJyaWRlcy5cclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdG91dC5wdXNoKCByb3cgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuIG91dDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0LyoqXHJcblx0XHRcdCAqIFRvZ2dsZSByb3RhdGlvbiBjbGFzcyBmb3IgdGhlIGNoaXAgbGFiZWxzIG9mIGEgc3BlY2lmaWMgY29sdW1uIGFuZCBncm91cCBzZXQuXHJcblx0XHRcdCAqXHJcblx0XHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBpZHggICAgICBDb2x1bW4gaW5kZXggKDAtYmFzZWQpXHJcblx0XHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gZW5hYmxlICBXaGV0aGVyIHRvIGFkZCAodHJ1ZSkgb3IgcmVtb3ZlIChmYWxzZSkgdGhlIHJvdGF0aW9uIGNsYXNzXHJcblx0XHRcdCAqL1xyXG5cdFx0XHRmdW5jdGlvbiB0b2dnbGVfYXhpc19yb3RhdGlvbl9mb3JfY29sKCBpZHgsIGVuYWJsZSApIHtcclxuXHRcdFx0XHR2YXIga2V5cyA9IFsgJ2FpJywgJ2pjJyBdO1xyXG5cdFx0XHRcdGZvciAoIHZhciBnID0gMDsgZyA8IGtleXMubGVuZ3RoOyBnKysgKSB7XHJcblx0XHRcdFx0XHR2YXIgcSA9ICdpbnB1dC5pbnNwZWN0b3JfX2lucHV0LndwYmNfc3Jfb25seVtkYXRhLXN0eWxlLWtleT1cIicgKyBrZXlzW2ddICsgJ1wiXVtkYXRhLWNvbC1pZHg9XCInICsgaWR4ICsgJ1wiXSc7XHJcblx0XHRcdFx0XHR2YXIgaW5wdXRzID0gaG9zdC5xdWVyeVNlbGVjdG9yQWxsKCBxICk7XHJcblx0XHRcdFx0XHRmb3IgKCB2YXIgbiA9IDA7IG4gPCBpbnB1dHMubGVuZ3RoOyBuKysgKSB7XHJcblx0XHRcdFx0XHRcdHZhciBsYmwgPSBpbnB1dHNbbl0gJiYgaW5wdXRzW25dLm5leHRFbGVtZW50U2libGluZztcclxuXHRcdFx0XHRcdFx0aWYgKCBsYmwgJiYgbGJsLmNsYXNzTGlzdCAmJiBsYmwuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX2NoaXAnICkgKSB7XHJcblx0XHRcdFx0XHRcdFx0aWYgKCBlbmFibGUgKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRsYmwuY2xhc3NMaXN0LmFkZCggJ3dwYmNfZG9fcm90YXRlXzkwJyApO1xyXG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0XHRsYmwuY2xhc3NMaXN0LnJlbW92ZSggJ3dwYmNfZG9fcm90YXRlXzkwJyApO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0LyoqXHJcblx0XHRcdCAqIEFwcGx5IHJvdGF0aW9uIGNsYXNzIHRvICphbGwqIGNvbHVtbnMsIHVzaW5nIHRoZSBlZmZlY3RpdmUgYGRpcmAgdmFsdWVcclxuXHRcdFx0ICogKHNhdmVkIHZhbHVlIG9yIGRlZmF1bHQgZnJvbSBDT0xfUFJPUFMpLlxyXG5cdFx0XHQgKi9cclxuXHRcdFx0ZnVuY3Rpb24gc3luY19heGlzX3JvdGF0aW9uX2FsbCgpIHtcclxuXHRcdFx0XHR2YXIgZGVmID0gZ2V0X2RlZmF1bHRzX29iaigpOyAgLy8gaW5jbHVkZXMgZGVmLmRpciAod2hpY2ggaXMgJ2NvbHVtbicgaW4geW91ciBjb2RlKS5cclxuXHRcdFx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBzdHlsZXNfYXJyLmxlbmd0aDsgaSsrICkge1xyXG5cdFx0XHRcdFx0dmFyIGRpcl92YWwgPSAoIHN0eWxlc19hcnJbaV0gJiYgc3R5bGVzX2FycltpXS5kaXIgKSA/IFN0cmluZyggc3R5bGVzX2FycltpXS5kaXIgKSA6IFN0cmluZyggZGVmLmRpciApO1xyXG5cdFx0XHRcdFx0dmFyIGVuYWJsZSAgPSAoIGRpcl92YWwgPT09ICdjb2x1bW4nICk7XHJcblx0XHRcdFx0XHR0b2dnbGVfYXhpc19yb3RhdGlvbl9mb3JfY29sKCBpLCBlbmFibGUgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIERlbGF5IChtcykgZm9yIGRlZmVycmVkIFVJIHVwZGF0ZXMgYWZ0ZXIgY2hhbmdpbmcgbGF5b3V0IGNvbWJvLlxyXG5cdFx0XHR2YXIgcmVyZW5kZXJfZGVsYXlfbXMgPSA0MjA7XHJcblxyXG5cdFx0XHQvKipcclxuXHRcdFx0ICogU2NoZWR1bGUgaWNvbiByb3RhdGlvbiArIHJlLXJlbmRlciB3aXRoIG9wdGlvbmFsIGltbWVkaWF0ZSByb3RhdGlvbi5cclxuXHRcdFx0ICpcclxuXHRcdFx0ICogQHBhcmFtIHtudW1iZXJ9IGNvbF9pZHggICAgICAgICAgICAwLWJhc2VkIGNvbHVtbiBpbmRleFxyXG5cdFx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbmV3X2RpciAgICAgICAgICAgIFwicm93XCIgfCBcImNvbHVtblwiXHJcblx0XHRcdCAqIEBwYXJhbSB7e2RlbGF5PzpudW1iZXIsIHJvdGF0ZV9ub3c/OmJvb2xlYW59fSBbb3B0c11cclxuXHRcdFx0ICovXHJcblx0XHRcdGZ1bmN0aW9uIHNjaGVkdWxlX3JlcmVuZGVyKGNvbF9pZHgsIG5ld19kaXIsIG9wdHMpIHtcclxuXHRcdFx0XHRvcHRzICAgICAgPSBvcHRzIHx8IHt9O1xyXG5cdFx0XHRcdHZhciBkZWxheSA9ICh0eXBlb2Ygb3B0cy5kZWxheSA9PT0gJ251bWJlcicpID8gb3B0cy5kZWxheSA6IHJlcmVuZGVyX2RlbGF5X21zO1xyXG5cclxuXHRcdFx0XHQvLyBBdm9pZCBzdGFja2VkIHRpbWVycyBpZiB0aGUgdXNlciBjbGlja3MgcXVpY2tseS5cclxuXHRcdFx0XHRpZiAoIGhvc3QuX19yZXJlbmRlcl90aW1lciApIHtcclxuXHRcdFx0XHRcdGNsZWFyVGltZW91dCggaG9zdC5fX3JlcmVuZGVyX3RpbWVyICk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBPcHRpb25hbCBpbW1lZGlhdGUgZmVlZGJhY2sgKHVzZWQgYnkgcGxhaW4gXCJkaXJcIiByYWRpb3MpLlxyXG5cdFx0XHRcdGlmICggb3B0cy5yb3RhdGVfbm93ICkge1xyXG5cdFx0XHRcdFx0dG9nZ2xlX2F4aXNfcm90YXRpb25fZm9yX2NvbCggY29sX2lkeCwgU3RyaW5nKCBuZXdfZGlyICkgPT09ICdjb2x1bW4nICk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRob3N0Ll9fcmVyZW5kZXJfdGltZXIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHQvLyBJZiB3ZSBkaWRuJ3Qgcm90YXRlIGltbWVkaWF0ZWx5LCBkbyBpdCBub3cgKHVzZWQgYnkgY29tYm8pLlxyXG5cdFx0XHRcdFx0aWYgKCAhIG9wdHMucm90YXRlX25vdyApIHtcclxuXHRcdFx0XHRcdFx0dG9nZ2xlX2F4aXNfcm90YXRpb25fZm9yX2NvbCggY29sX2lkeCwgU3RyaW5nKCBuZXdfZGlyICkgPT09ICdjb2x1bW4nICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRVSS53cGJjX2JmYl9jb2x1bW5fc3R5bGVzLnJlbmRlcl9mb3Jfc2VjdGlvbiggYnVpbGRlciwgc2VjdGlvbl9lbCwgaG9zdCApO1xyXG5cdFx0XHRcdFx0aG9zdC5fX3JlcmVuZGVyX3RpbWVyID0gbnVsbDtcclxuXHRcdFx0XHR9LCBkZWxheSApO1xyXG5cdFx0XHR9XHJcblxyXG5cclxuXHRcdFx0ZnVuY3Rpb24gY29tbWl0KGJ1aWxkZXIsIHNlY3Rpb25fZWwsIHN0eWxlc19hcnIpIHtcclxuXHRcdFx0XHQvLyBEZWNpZGUgYWN0aXZhdGlvbi5cclxuXHRcdFx0XHR2YXIgc2hvdWxkX2FjdGl2YXRlID0gc3R5bGVzX2hhc19hbnlfbm9uX2RlZmF1bHQoIHN0eWxlc19hcnIsIGdldF9kZWZhdWx0c19vYmogKTtcclxuXHRcdFx0XHRpZiAoIHNob3VsZF9hY3RpdmF0ZSApIHtcclxuXHRcdFx0XHRcdHNlY3Rpb25fZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1jb2xzdHlsZXMtYWN0aXZlJywgJzEnICk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHNlY3Rpb25fZWwucmVtb3ZlQXR0cmlidXRlKCAnZGF0YS1jb2xzdHlsZXMtYWN0aXZlJyApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gTm9ybWFsaXplIGxlbmd0aCB0byBjdXJyZW50IG51bWJlciBvZiBjb2x1bW5zIChrZWVwcyBhdHRyaWJ1dGUgdGlkeSkuXHJcblx0XHRcdFx0c3R5bGVzX2Fyci5sZW5ndGggPSBkb21fY29scyggc2VjdGlvbl9lbCApO1xyXG5cclxuXHRcdFx0XHQvLyBQZXJzaXN0IG1pbmltYWwgSlNPTiAob21pdCBkZWZhdWx0cy9lbXB0aWVzKS5cclxuXHRcdFx0XHR2YXIgc2F2ZV9hcnIgPSBzdHJpcF9kZWZhdWx0c19mb3Jfc2F2ZSggc3R5bGVzX2FyciwgZ2V0X2RlZmF1bHRzX29iaiApO1xyXG5cdFx0XHRcdHZhciBqc29uICAgICA9IFVJLldQQkNfQkZCX0NvbHVtbl9TdHlsZXMuc3RyaW5naWZ5X2NvbF9zdHlsZXMoIHNhdmVfYXJyICk7XHJcblx0XHRcdFx0c2VjdGlvbl9lbC5zZXRBdHRyaWJ1dGUoICdkYXRhLWNvbF9zdHlsZXMnLCBqc29uICk7XHJcblx0XHRcdFx0aWYgKCBzZWN0aW9uX2VsLmRhdGFzZXQgKSB7XHJcblx0XHRcdFx0XHRzZWN0aW9uX2VsLmRhdGFzZXQuY29sX3N0eWxlcyA9IGpzb247XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBMaXZlIHByZXZpZXcgKG1pbmkgKyBnYXRlZCByZWFsIGNvbHVtbnMpLlxyXG5cdFx0XHRcdFVJLldQQkNfQkZCX0NvbHVtbl9TdHlsZXMuYXBwbHkoIHNlY3Rpb25fZWwsIHN0eWxlc19hcnIgKTtcclxuXHJcblx0XHRcdFx0Ly8gTm90aWZ5IGxpc3RlbmVycy5cclxuXHRcdFx0XHRpZiAoIGJ1aWxkZXIgJiYgYnVpbGRlci5idXMgJiYgQ29yZS5XUEJDX0JGQl9FdmVudHMgKSB7XHJcblx0XHRcdFx0XHRidWlsZGVyLmJ1cy5lbWl0ICYmIGJ1aWxkZXIuYnVzLmVtaXQoIENvcmUuV1BCQ19CRkJfRXZlbnRzLlNUUlVDVFVSRV9DSEFOR0UsIHtcclxuXHRcdFx0XHRcdFx0c291cmNlOiAnY29sdW1uX3N0eWxlcycsXHJcblx0XHRcdFx0XHRcdGZpZWxkIDogc2VjdGlvbl9lbFxyXG5cdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHJcblx0XHRcdGZ1bmN0aW9uIG9uX2NoYW5nZSggZSApIHtcclxuXHRcdFx0XHR2YXIgdCAgID0gZS50YXJnZXQ7XHJcblx0XHRcdFx0Ly8gUmFkaW9zIGZpcmUgYm90aCAnaW5wdXQnIGFuZCAnY2hhbmdlJyBpbiBtb3N0IGJyb3dzZXJzLlxyXG4gIFx0XHRcdFx0aWYgKHQgJiYgdC50eXBlID09PSAncmFkaW8nICYmIGUudHlwZSA9PT0gJ2lucHV0JykgcmV0dXJuO1xyXG5cclxuXHRcdFx0XHR2YXIga2V5ID0gdCAmJiB0LmdldEF0dHJpYnV0ZSggJ2RhdGEtc3R5bGUta2V5JyApO1xyXG5cdFx0XHRcdGlmICggISBrZXkgfHwgKCAhIGlzX3N1cHBvcnRlZF9rZXkoIGtleSApICYmIGtleSAhPT0gJ2xheW91dF9jb21ibycgKSApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHRcdHZhciBpZHggPSBwYXJzZUludCggdC5nZXRBdHRyaWJ1dGUoICdkYXRhLWNvbC1pZHgnICksIDEwICkgfHwgMDtcclxuXHJcblx0XHRcdFx0Ly8gbGF5b3V0X2NvbWJvOiBjb21taXQgbm93LCByb3RhdGUgKyByZS1yZW5kZXIgbGF0ZXIgKG5vIGltbWVkaWF0ZSBpY29uIGNoYW5nZSkuXHJcblx0XHRcdFx0aWYgKCBrZXkgPT09ICdsYXlvdXRfY29tYm8nICkge1xyXG5cdFx0XHRcdFx0dmFyIHBhcnRzID0gU3RyaW5nKCB0LnZhbHVlIHx8ICcnICkuc3BsaXQoICd8JyApO1xyXG5cdFx0XHRcdFx0dmFyIGRpciAgID0gcGFydHNbMF0gfHwgJ3Jvdyc7XHJcblx0XHRcdFx0XHR2YXIgd3JhcCAgPSBwYXJ0c1sxXSB8fCAnbm93cmFwJztcclxuXHJcblx0XHRcdFx0XHRzdHlsZXNfYXJyW2lkeF0uZGlyICA9IG5vcm1hbGl6ZV92YWx1ZSggJ2RpcicsIGRpciApO1xyXG5cdFx0XHRcdFx0c3R5bGVzX2FycltpZHhdLndyYXAgPSBub3JtYWxpemVfdmFsdWUoICd3cmFwJywgd3JhcCApO1xyXG5cdFx0XHRcdFx0Y29tbWl0KCBidWlsZGVyLCBzZWN0aW9uX2VsLCBzdHlsZXNfYXJyICk7XHJcblxyXG5cdFx0XHRcdFx0c2NoZWR1bGVfcmVyZW5kZXIoIGlkeCwgc3R5bGVzX2FycltpZHhdLmRpciwgeyByb3RhdGVfbm93OiB0cnVlLCBkZWxheTogcmVyZW5kZXJfZGVsYXlfbXMgfSApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gRXhpc3Rpbmc6IEdBUCBwYWlyIGJyYW5jaC5cclxuXHRcdFx0XHRpZiAoIGtleSA9PT0gJ2dhcCcgKSB7XHJcblx0XHRcdFx0XHR2YXIgbnVtRWwgICAgICAgICAgID0gaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtc3R5bGUta2V5PVwiZ2FwXCJdW2RhdGEtc3R5bGUtcGFydD1cInZhbHVlXCJdW2RhdGEtY29sLWlkeD1cIicgKyBpZHggKyAnXCJdJyApO1xyXG5cdFx0XHRcdFx0dmFyIHVuaXRFbCAgICAgICAgICA9IGhvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXN0eWxlLWtleT1cImdhcFwiXVtkYXRhLXN0eWxlLXBhcnQ9XCJ1bml0XCJdW2RhdGEtY29sLWlkeD1cIicgKyBpZHggKyAnXCJdJyApO1xyXG5cdFx0XHRcdFx0dmFyIG51bSAgICAgICAgICAgICA9IG51bUVsID8gU3RyaW5nKCBudW1FbC52YWx1ZSB8fCAnJyApLnRyaW0oKSA6ICcnO1xyXG5cdFx0XHRcdFx0dmFyIHVuaXQgICAgICAgICAgICA9IHVuaXRFbCA/IFN0cmluZyggdW5pdEVsLnZhbHVlIHx8ICdweCcgKS50cmltKCkgOiAncHgnO1xyXG5cdFx0XHRcdFx0dmFyIHJhdyAgICAgICAgICAgICA9IG51bSA/ICggbnVtICsgdW5pdCApIDogJyc7XHJcblx0XHRcdFx0XHRzdHlsZXNfYXJyW2lkeF0uZ2FwID0gbm9ybWFsaXplX3ZhbHVlKCAnZ2FwJywgcmF3ICk7XHJcblx0XHRcdFx0XHRjb21taXQoIGJ1aWxkZXIsIHNlY3Rpb25fZWwsIHN0eWxlc19hcnIgKTtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIGRpcjogY29tbWl0IG5vdywgcm90YXRlIGltbWVkaWF0ZWx5IGZvciBzbmFwcHkgZmVlZGJhY2ssIHN0aWxsIHJlLXJlbmRlciBhZnRlciBkZWxheS5cclxuXHRcdFx0XHRpZiAoIGtleSA9PT0gJ2RpcicgKSB7XHJcblx0XHRcdFx0XHRzdHlsZXNfYXJyW2lkeF0uZGlyID0gbm9ybWFsaXplX3ZhbHVlKCAnZGlyJywgdC52YWx1ZSApO1xyXG5cdFx0XHRcdFx0Y29tbWl0KCBidWlsZGVyLCBzZWN0aW9uX2VsLCBzdHlsZXNfYXJyICk7XHJcblxyXG5cdFx0XHRcdFx0c2NoZWR1bGVfcmVyZW5kZXIoIGlkeCwgc3R5bGVzX2FycltpZHhdLmRpciwgeyByb3RhdGVfbm93OiB0cnVlLCBkZWxheTogcmVyZW5kZXJfZGVsYXlfbXMgfSApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gRGVmYXVsdCBicmFuY2ggKHVuY2hhbmdlZCkuXHJcblx0XHRcdFx0c3R5bGVzX2FycltpZHhdW2tleV0gPSBub3JtYWxpemVfdmFsdWUoIGtleSwgdC52YWx1ZSApO1xyXG5cdFx0XHRcdGNvbW1pdCggYnVpbGRlciwgc2VjdGlvbl9lbCwgc3R5bGVzX2FyciApO1xyXG5cdFx0XHR9XHJcblxyXG5cclxuXHRcdFx0ZnVuY3Rpb24gb25fY2xpY2soIGUgKSB7XHJcblx0XHRcdFx0dmFyIGJ0biA9IGUudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS1hY3Rpb249XCJjb2xzdHlsZXMtcmVzZXRcIl0nICk7XHJcblx0XHRcdFx0aWYgKCAhIGJ0biApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHRcdC8vIENsZWFyIGRhdGFzZXQgKyBhY3RpdmF0aW9uIGZsYWcgYW5kIHJlbW92ZSBpbmxpbmUgdmFyc1xyXG5cdFx0XHRcdHNlY3Rpb25fZWwucmVtb3ZlQXR0cmlidXRlKCAnZGF0YS1jb2xzdHlsZXMtYWN0aXZlJyApO1xyXG5cdFx0XHRcdHNlY3Rpb25fZWwucmVtb3ZlQXR0cmlidXRlKCAnZGF0YS1jb2xfc3R5bGVzJyApO1xyXG5cdFx0XHRcdGlmICggc2VjdGlvbl9lbC5kYXRhc2V0ICkgeyBkZWxldGUgc2VjdGlvbl9lbC5kYXRhc2V0LmNvbF9zdHlsZXM7IH1cclxuXHJcblx0XHRcdFx0VUkuV1BCQ19CRkJfQ29sdW1uX1N0eWxlcy5hcHBseSggc2VjdGlvbl9lbCwgW10gKTtcclxuXHJcblx0XHRcdFx0Ly8gUmUtcmVuZGVyIGZyZXNoLCBub3QgcGVyc2lzdGVkXHJcblx0XHRcdFx0VUkud3BiY19iZmJfY29sdW1uX3N0eWxlcy5yZW5kZXJfZm9yX3NlY3Rpb24oIGJ1aWxkZXIsIHNlY3Rpb25fZWwsIGhvc3QgKTtcclxuXHJcblx0XHRcdFx0aWYgKCBidWlsZGVyICYmIGJ1aWxkZXIuYnVzICYmIENvcmUuV1BCQ19CRkJfRXZlbnRzICkge1xyXG5cdFx0XHRcdFx0YnVpbGRlci5idXMuZW1pdCAmJiBidWlsZGVyLmJ1cy5lbWl0KCBDb3JlLldQQkNfQkZCX0V2ZW50cy5TVFJVQ1RVUkVfQ0hBTkdFLCB7IHNvdXJjZSA6ICdjb2x1bW5fc3R5bGVzX3Jlc2V0JywgZmllbGQgOiBzZWN0aW9uX2VsIH0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGhvc3QuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0Jywgb25fY2hhbmdlLCB0cnVlICk7XHJcblx0XHRcdGhvc3QuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIG9uX2NoYW5nZSwgdHJ1ZSApO1xyXG5cdFx0XHRob3N0LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIG9uX2NsaWNrLCB0cnVlICk7XHJcblxyXG5cdFx0XHQvLyBJbml0aWFsIGFwcGx5IChkb2VzIE5PVCBhdXRvLWFjdGl2YXRlKS5cclxuXHRcdFx0VUkuV1BCQ19CRkJfQ29sdW1uX1N0eWxlcy5hcHBseSggc2VjdGlvbl9lbCwgc3R5bGVzX2FyciApO1xyXG5cclxuXHRcdFx0Ly8gUHJvdmlkZSBjbGVhbnVwIHRvIGF2b2lkIGxlYWtzLlxyXG5cdFx0XHRob3N0Ll9fd3BiY19jbGVhbnVwID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRob3N0LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIG9uX2NoYW5nZSwgdHJ1ZSApO1xyXG5cdFx0XHRcdFx0aG9zdC5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgb25fY2hhbmdlLCB0cnVlICk7XHJcblx0XHRcdFx0XHRob3N0LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjbGljaycsIG9uX2NsaWNrLCB0cnVlICk7XHJcblx0XHRcdFx0fSBjYXRjaCAoIF9lICkge31cclxuXHRcdFx0fTtcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZWZyZXNoIHRoZSBtb3VudGVkIGVkaXRvciBhZnRlciBjb2x1bW5zIGNvdW50IGNoYW5nZXMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtvYmplY3R9ICAgICAgYnVpbGRlclxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gc2VjdGlvbl9lbFxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gaW5zcGVjdG9yX3Jvb3RcclxuXHRcdCAqL1xyXG5cdFx0cmVmcmVzaF9mb3Jfc2VjdGlvbiA6IGZ1bmN0aW9uICggYnVpbGRlciwgc2VjdGlvbl9lbCwgaW5zcGVjdG9yX3Jvb3QgKSB7XHJcblx0XHRcdHZhciBob3N0ID0gaW5zcGVjdG9yX3Jvb3QgJiYgaW5zcGVjdG9yX3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLWJmYi1zbG90PVwiY29sdW1uX3N0eWxlc1wiXScgKTtcclxuXHRcdFx0aWYgKCAhIGhvc3QgKSB7IHJldHVybjsgfVxyXG5cdFx0XHR0aGlzLnJlbmRlcl9mb3Jfc2VjdGlvbiggYnVpbGRlciwgc2VjdGlvbl9lbCwgaG9zdCApO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8vIE9wdGlvbmFsOiByZWdpc3RlciBhIGZhY3Rvcnkgc2xvdCBmb3IgZW52aXJvbm1lbnRzIHRoYXQgdXNlIGluc3BlY3RvciBmYWN0b3J5LlxyXG5cdHcud3BiY19iZmJfaW5zcGVjdG9yX2ZhY3Rvcnlfc2xvdHMgPSB3LndwYmNfYmZiX2luc3BlY3Rvcl9mYWN0b3J5X3Nsb3RzIHx8IHt9O1xyXG5cdHcud3BiY19iZmJfaW5zcGVjdG9yX2ZhY3Rvcnlfc2xvdHMuY29sdW1uX3N0eWxlcyA9IGZ1bmN0aW9uICggaG9zdCwgb3B0cyApIHtcclxuXHRcdHRyeSB7XHJcblx0XHRcdHZhciBidWlsZGVyICAgID0gKCBvcHRzICYmIG9wdHMuYnVpbGRlciApIHx8IHcud3BiY19iZmIgfHwgbnVsbDtcclxuXHRcdFx0dmFyIHNlY3Rpb25fZWwgPSAoIG9wdHMgJiYgb3B0cy5lbCApIHx8ICggYnVpbGRlciAmJiBidWlsZGVyLmdldF9zZWxlY3RlZF9maWVsZCAmJiBidWlsZGVyLmdldF9zZWxlY3RlZF9maWVsZCgpICkgfHwgbnVsbDtcclxuXHRcdFx0VUkud3BiY19iZmJfY29sdW1uX3N0eWxlcy5yZW5kZXJfZm9yX3NlY3Rpb24oIGJ1aWxkZXIsIHNlY3Rpb25fZWwsIGhvc3QgKTtcclxuXHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHR3Ll93cGJjICYmIHcuX3dwYmMuZGV2ICYmIHcuX3dwYmMuZGV2LmVycm9yICYmIHcuX3dwYmMuZGV2LmVycm9yKCAnd3BiY19iZmJfaW5zcGVjdG9yX2ZhY3Rvcnlfc2xvdHMuY29sdW1uX3N0eWxlcycsIGUgKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxufSkoIHdpbmRvdyApO1xyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDLFVBQVdBLENBQUMsRUFBRztFQUNmLFlBQVk7O0VBRVosSUFBSUMsSUFBSSxHQUFLRCxDQUFDLENBQUNFLGFBQWEsR0FBR0YsQ0FBQyxDQUFDRSxhQUFhLElBQUksQ0FBQyxDQUFHO0VBQ3RELElBQUlDLEVBQUUsR0FBT0YsSUFBSSxDQUFDRSxFQUFFLEdBQUdGLElBQUksQ0FBQ0UsRUFBRSxJQUFJLENBQUMsQ0FBRztFQUV0QyxJQUFJQyxDQUFDLEdBQUtILElBQUksQ0FBQ0ksaUJBQWlCLElBQUksQ0FBQyxDQUFDO0VBQ3RDLElBQUlDLEdB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
