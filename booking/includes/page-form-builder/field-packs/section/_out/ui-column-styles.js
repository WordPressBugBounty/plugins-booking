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
 *    padding: { var: '--wpbc-bfb-col-padding', def: '0px', normalize: 'len' }
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
 *    Authoritative CSS: ../includes/page-form-builder/__css/bfb_fields.css
 *    The fallback in var(--name, <fallback>) MUST MATCH COL_PROPS[key].def.
 *
 *    /* Mini preview (template “ghost” columns; always on) *\/
 *    .wpbc_bfb__section__cols > .wpbc_bfb__section__col {
 *      padding: var(--wpbc-bfb-col-padding, 0px);
 *      /* add other properties here using their vars *\/
 *    }
 *
 *    /* Real columns (only when styles are activated) *\/
 *    .wpbc_bfb_form .wpbc_bfb__section[data-colstyles-active="1"] > .wpbc_bfb__row > .wpbc_bfb__column {
 *      padding: var(--wpbc-bfb-col-padding, 0px);
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
 *        <input type="text" class="inspector__input" data-style-key="padding" data-col-idx="{{ i }}" placeholder="e.g., 8px or 0.5rem">
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
 * -- 4) (Optional) Split length controls (number + unit)
 *
 *    If your new length style is a pair (value + unit), mirror the 'gap' pattern:
 *      - two inputs with data-style-part="value" and data-style-part="unit"
 *      - use normalize: 'len' in COL_PROPS
 *    The shared on_change path combines and normalizes every registered split length control.
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
 * [ ] (If split-value) both controls use data-style-part and the registry uses normalize: 'len'
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
 * @modified  2026-09-19 16:30
 * @version   1.1.1
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
   * normalize — Normalizer id or enum definition (`id`, `len`, `max_len`, or allowlisted values).
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
    padding: {
      var: '--wpbc-bfb-col-padding',
      def: '0px',
      normalize: 'len'
    },
    margin: {
      var: '--wpbc-bfb-col-margin',
      def: '0px',
      normalize: 'len'
    },
    padding_top: {
      var: '--wpbc-bfb-col-padding-top',
      def: '0px',
      normalize: 'len'
    },
    padding_right: {
      var: '--wpbc-bfb-col-padding-right',
      def: '0px',
      normalize: 'len'
    },
    padding_bottom: {
      var: '--wpbc-bfb-col-padding-bottom',
      def: '0px',
      normalize: 'len'
    },
    padding_left: {
      var: '--wpbc-bfb-col-padding-left',
      def: '0px',
      normalize: 'len'
    },
    margin_top: {
      var: '--wpbc-bfb-col-margin-top',
      def: '0.7em',
      normalize: 'len'
    },
    margin_right: {
      var: '--wpbc-bfb-col-margin-right',
      def: '0px',
      normalize: 'len'
    },
    margin_bottom: {
      var: '--wpbc-bfb-col-margin-bottom',
      def: '0.7em',
      normalize: 'len'
    },
    margin_left: {
      var: '--wpbc-bfb-col-margin-left',
      def: '0px',
      normalize: 'len'
    },
    max_width: {
      var: '--wpbc-bfb-col-max-width',
      def: 'none',
      normalize: 'max_len'
    },
    max_height: {
      var: '--wpbc-bfb-col-max-height',
      def: 'none',
      normalize: 'max_len'
    },
    overflow: {
      var: '--wpbc-bfb-col-overflow',
      def: 'visible',
      normalize: {
        type: 'enum',
        values: ['visible', 'auto', 'hidden']
      }
    },
    overflow_x: {
      var: '--wpbc-bfb-col-overflow-x',
      def: 'visible',
      normalize: {
        type: 'enum',
        values: ['visible', 'auto', 'hidden']
      }
    },
    overflow_y: {
      var: '--wpbc-bfb-col-overflow-y',
      def: 'visible',
      normalize: {
        type: 'enum',
        values: ['visible', 'auto', 'hidden']
      }
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
  var BOX_SIDE_GROUPS = {
    padding: ['padding_top', 'padding_right', 'padding_bottom', 'padding_left'],
    margin: ['margin_top', 'margin_right', 'margin_bottom', 'margin_left']
  };
  var BOX_SIDE_KEYS = BOX_SIDE_GROUPS.padding.concat(BOX_SIDE_GROUPS.margin);
  var OVERFLOW_AXIS_KEYS = ['overflow_x', 'overflow_y'];

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
   * Normalize an optional maximum dimension.
   *
   * Empty values and `none` remove the limit. Numeric values accept the units
   * exposed by the Inspector and reject arbitrary CSS declarations.
   *
   * @param {string|number} candidate_value Candidate maximum dimension.
   * @returns {string} Valid CSS maximum dimension or `none`.
   */
  function norm_max_len(candidate_value) {
    var normalized_value = String(candidate_value == null ? '' : candidate_value).trim();
    if (!normalized_value || 'none' === normalized_value) {
      return 'none';
    }
    if (/^\d+(\.\d+)?$/.test(normalized_value)) {
      return normalized_value + 'px';
    }
    if (/^\d+(\.\d+)?(px|rem|em|%|vh|vw)$/.test(normalized_value)) {
      return normalized_value;
    }
    return 'none';
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
    max_len: norm_max_len,
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
   * Resolve one padding or margin side from explicit or legacy shorthand data.
   *
   * @param {Record<string, string>} source_style Saved sparse column styles.
   * @param {string}                 side_key     Explicit side key.
   * @param {string}                 legacy_key   Legacy shorthand key.
   * @param {Record<string, string>} defaults     Defaults for supported styles.
   * @returns {string} Effective normalized side length.
   */
  function get_effective_box_side(source_style, side_key, legacy_key, defaults) {
    if (Object.prototype.hasOwnProperty.call(source_style, side_key)) {
      return normalize_value(side_key, source_style[side_key]);
    }
    if (Object.prototype.hasOwnProperty.call(source_style, legacy_key)) {
      return normalize_value(legacy_key, source_style[legacy_key]);
    }
    return defaults[side_key];
  }

  /**
   * Return the padding or margin group that owns an explicit side key.
   *
   * @param {string} side_key Candidate side key.
   * @returns {{legacy_key:string, side_keys:Array<string>}|null} Owning group.
   */
  function get_box_side_group(side_key) {
    for (var legacy_key in BOX_SIDE_GROUPS) {
      if (Object.prototype.hasOwnProperty.call(BOX_SIDE_GROUPS, legacy_key) && BOX_SIDE_GROUPS[legacy_key].indexOf(side_key) !== -1) {
        return {
          legacy_key: legacy_key,
          side_keys: BOX_SIDE_GROUPS[legacy_key]
        };
      }
    }
    return null;
  }

  /**
   * Convert one legacy shorthand group to explicit side values before saving.
   *
   * @param {Record<string, string>} style_object Effective column styles.
   * @param {string}                 edited_key   Side key changed by the user.
   * @returns {void}
   */
  function promote_box_sides_to_explicit(style_object, edited_key) {
    var box_group = get_box_side_group(edited_key);
    if (!box_group) {
      return;
    }
    style_object.__has = style_object.__has || {};
    for (var side_index = 0; side_index < box_group.side_keys.length; side_index++) {
      var side_key = box_group.side_keys[side_index];
      style_object[side_key] = normalize_value(side_key, style_object[side_key]);
      style_object.__has[side_key] = true;
    }
    delete style_object[box_group.legacy_key];
    style_object.__has[box_group.legacy_key] = false;
  }

  /**
   * Resolve one axis from axis-specific data or the legacy shared overflow.
   *
   * @param {Record<string, string>} source_style Saved sparse column styles.
   * @param {string}                 axis_key     `overflow_x` or `overflow_y`.
   * @param {Record<string, string>} defaults     Registered style defaults.
   * @returns {string} Effective allowlisted overflow value.
   */
  function get_effective_overflow_axis(source_style, axis_key, defaults) {
    if (Object.prototype.hasOwnProperty.call(source_style, axis_key)) {
      return normalize_value(axis_key, source_style[axis_key]);
    }
    if (Object.prototype.hasOwnProperty.call(source_style, 'overflow')) {
      return normalize_value(axis_key, source_style.overflow);
    }
    return defaults[axis_key];
  }

  /**
   * Promote a legacy shared overflow to explicit X and Y values on first edit.
   *
   * @param {Record<string, *>} style_object Mutable full style object.
   * @returns {void}
   */
  function promote_overflow_axes_to_explicit(style_object) {
    if (!style_object || !style_object.__has || true !== style_object.__has.overflow) {
      return;
    }
    for (var axis_index = 0; axis_index < OVERFLOW_AXIS_KEYS.length; axis_index++) {
      var axis_key = OVERFLOW_AXIS_KEYS[axis_index];
      style_object[axis_key] = normalize_value(axis_key, style_object[axis_key]);
      style_object.__has[axis_key] = true;
    }
    delete style_object.overflow;
    style_object.__has.overflow = false;
  }

  /**
   * Check whether an explicit default must remain in sparse saved JSON.
   *
   * @param {string}                 style_key   Registered style key.
   * @param {Record<string, boolean>} presence_map Saved-key presence map.
   * @returns {boolean} Whether to preserve the explicit default value.
   */
  function should_keep_explicit_default(style_key, presence_map) {
    if (!presence_map || true !== presence_map[style_key]) {
      return false;
    }
    return BOX_SIDE_KEYS.indexOf(style_key) !== -1;
  }

  /**
   * Reset allowlisted keys on one effective Inspector style object.
   *
   * The object is mutated intentionally. Legacy shorthand data is promoted
   * first so resetting one side or axis preserves every unrelated effective
   * value. Reset keys are marked absent for sparse persistence.
   *
   * @param {Record<string, *>} style_object Effective mutable column styles.
   * @param {Array<string>}     requested_keys Candidate registered style keys.
   * @returns {Array<string>} Supported keys reset to their registered defaults.
   */
  function reset_style_keys_to_defaults(style_object, requested_keys) {
    var style_keys = [];
    if (!style_object || !Array.isArray(requested_keys)) {
      return style_keys;
    }
    for (var requested_index = 0; requested_index < requested_keys.length; requested_index++) {
      if (is_supported_key(requested_keys[requested_index])) {
        style_keys.push(requested_keys[requested_index]);
      }
    }
    if (!style_keys.length) {
      return style_keys;
    }
    style_object.__has = style_object.__has || {};
    for (var promotion_index = 0; promotion_index < style_keys.length; promotion_index++) {
      var promotion_key = style_keys[promotion_index];
      if (BOX_SIDE_KEYS.indexOf(promotion_key) !== -1) {
        promote_box_sides_to_explicit(style_object, promotion_key);
      }
      if (OVERFLOW_AXIS_KEYS.indexOf(promotion_key) !== -1) {
        promote_overflow_axes_to_explicit(style_object);
      }
    }
    for (var reset_index = 0; reset_index < style_keys.length; reset_index++) {
      var style_key = style_keys[reset_index];
      style_object[style_key] = COL_PROPS[style_key].def;
      style_object.__has[style_key] = false;
    }
    return style_keys;
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
        node.style.setProperty(cssVar, normalize_value(k, v));
      }
    }
  }
  function set_vars_sparse(node, style_obj) {
    if (!node) return;
    for (var k in COL_PROPS) {
      if (is_supported_key(k)) {
        var cssVar = COL_PROPS[k].var;
        if (style_obj && Object.prototype.hasOwnProperty.call(style_obj, k) && String(style_obj[k]).trim() !== '') {
          node.style.setProperty(cssVar, normalize_value(k, style_obj[k]));
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
     * Reset a supported subset of one effective Inspector style object.
     *
     * @param {Record<string, *>} style_object Effective mutable column styles.
     * @param {Array<string>}     style_keys Registered keys to reset.
     * @returns {Array<string>} Supported keys that were reset.
     */
    reset_style_keys: function (style_object, style_keys) {
      return reset_style_keys_to_defaults(style_object, style_keys);
    },
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
     * @returns {Array<{dir:string,wrap:string,jc:string,ai:string,gap:string,padding:string,margin:string,padding_top:string,padding_right:string,padding_bottom:string,padding_left:string,margin_top:string,margin_right:string,margin_bottom:string,margin_left:string,max_width:string,max_height:string,overflow:string,overflow_x:string,overflow_y:string,aself:string}>}
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
      var column_control_tab_state = host.__wpbc_column_control_tab_state || {};
      var previous_control_tabs = host.querySelectorAll('[data-column-control-tabs]');
      for (var previous_control_index = 0; previous_control_index < previous_control_tabs.length; previous_control_index++) {
        var previous_control_root = previous_control_tabs[previous_control_index];
        var previous_control_column = (parseInt(previous_control_root.getAttribute('data-col-idx'), 10) || 0) + 1;
        var previous_control_group = previous_control_root.getAttribute('data-column-control-tabs') || '';
        var previous_control_tab = previous_control_root.getAttribute('data-column-control-tab-active') || '';
        if (previous_control_group && previous_control_tab) {
          column_control_tab_state[previous_control_column + '_' + previous_control_group] = previous_control_tab;
        }
      }
      host.__wpbc_column_control_tab_state = column_control_tab_state;

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
        full.max_width = normalize_value('max_width', full.max_width);
        full.max_height = normalize_value('max_height', full.max_height);
        full.overflow = normalize_value('overflow', full.overflow);
        full.overflow_x = get_effective_overflow_axis(src, 'overflow_x', def);
        full.overflow_y = get_effective_overflow_axis(src, 'overflow_y', def);
        for (var legacy_box_key in BOX_SIDE_GROUPS) {
          if (!Object.prototype.hasOwnProperty.call(BOX_SIDE_GROUPS, legacy_box_key)) {
            continue;
          }
          for (var side_index = 0; side_index < BOX_SIDE_GROUPS[legacy_box_key].length; side_index++) {
            var side_key = BOX_SIDE_GROUPS[legacy_box_key][side_index];
            full[side_key] = get_effective_box_side(src, side_key, legacy_box_key, def);
          }
        }
        full.__has = {};
        for (var style_key in def) {
          if (Object.prototype.hasOwnProperty.call(def, style_key)) {
            full.__has[style_key] = Object.prototype.hasOwnProperty.call(src, style_key);
          }
        }
        styles_arr[i] = full;
      }
      styles_arr.length = col_count; // clamp.

      host.innerHTML = tpl({
        cols: col_count,
        styles: styles_arr,
        active: UI.WPBC_BFB_Column_Styles.is_active(section_el),
        control_tabs: column_control_tab_state
      });
      var column_control_tab_roots = host.querySelectorAll('[data-column-control-tabs]');
      for (var control_root_index = 0; control_root_index < column_control_tab_roots.length; control_root_index++) {
        var control_root = column_control_tab_roots[control_root_index];
        activate_column_control_tab(control_root, control_root.getAttribute('data-column-control-tab-active') || '', false);
      }
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

      // Inspector markup is replaced on every render, so initialize tooltips for the fresh help controls.
      if ('function' === typeof w.wpbc_define_tippy_tooltips) {
        w.wpbc_define_tippy_tooltips('[data-bfb-slot="column_styles"] ');
      }

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
              var keep_explicit_default = should_keep_explicit_default(k, s.__has);
              if (v && (v !== String(def[k]) || keep_explicit_default)) {
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

      /**
       * Activate one nested column-control tab without affecting Column tabs.
       *
       * @param {HTMLElement} control_root Column-control tab group root.
       * @param {string}      tab_key      Tab key to activate.
       * @param {boolean}     move_focus   Whether focus follows activation.
       * @returns {void}
       */
      function activate_column_control_tab(control_root, tab_key, move_focus) {
        if (!control_root) {
          return;
        }
        var control_tabs = control_root.querySelectorAll('[data-column-control-tab-key]');
        var control_panels = control_root.querySelectorAll('[data-column-control-tab-panel]');
        var active_tab = null;
        for (var tab_index = 0; tab_index < control_tabs.length; tab_index++) {
          var control_tab = control_tabs[tab_index];
          var tab_is_active = control_tab.getAttribute('data-column-control-tab-key') === tab_key;
          control_tab.setAttribute('aria-selected', tab_is_active ? 'true' : 'false');
          control_tab.setAttribute('tabindex', tab_is_active ? '0' : '-1');
          if (tab_is_active) {
            active_tab = control_tab;
          }
        }
        for (var panel_index = 0; panel_index < control_panels.length; panel_index++) {
          var control_panel = control_panels[panel_index];
          if (control_panel.getAttribute('data-column-control-tab-panel') === tab_key) {
            control_panel.removeAttribute('hidden');
          } else {
            control_panel.setAttribute('hidden', '');
          }
        }
        control_root.setAttribute('data-column-control-tab-active', tab_key);
        if (move_focus && active_tab && active_tab.focus) {
          active_tab.focus();
        }
      }

      /**
       * Remember one nested tab selection for the current Inspector mount.
       *
       * @param {HTMLElement} control_root Column-control tab group root.
       * @param {string}      tab_key      Selected tab key.
       * @returns {void}
       */
      function remember_column_control_tab(control_root, tab_key) {
        var control_column = (parseInt(control_root.getAttribute('data-col-idx'), 10) || 0) + 1;
        var control_group = control_root.getAttribute('data-column-control-tabs') || '';
        if (control_group) {
          column_control_tab_state[control_column + '_' + control_group] = tab_key;
          host.__wpbc_column_control_tab_state = column_control_tab_state;
        }
      }

      /**
       * Reflect whether a nested tab owns any non-default style value.
       *
       * @param {number}                 column_index Zero-based column index.
       * @param {string}                 style_key   Changed style key.
       * @param {Record<string, string>} style_object Current full column styles.
       * @returns {void}
       */
      function sync_column_control_tab_marker(column_index, style_key, style_object) {
        if (!is_supported_key(style_key)) {
          return;
        }
        var control_tabs = host.querySelectorAll('[data-column-control-tab-style-keys~="' + style_key + '"][data-col-idx="' + column_index + '"]');
        for (var control_tab_index = 0; control_tab_index < control_tabs.length; control_tab_index++) {
          var control_tab = control_tabs[control_tab_index];
          var owned_style_keys = String(control_tab.getAttribute('data-column-control-tab-style-keys') || '').split(/\s+/);
          var control_is_changed = false;
          for (var owned_key_index = 0; owned_key_index < owned_style_keys.length; owned_key_index++) {
            var owned_style_key = owned_style_keys[owned_key_index];
            if (is_supported_key(owned_style_key) && normalize_value(owned_style_key, style_object[owned_style_key]) !== COL_PROPS[owned_style_key].def) {
              control_is_changed = true;
              break;
            }
          }
          var control_marker = control_tab.querySelector('[data-column-control-tab-marker]');
          var control_changed_text = control_tab.querySelector('[data-column-control-tab-changed-text]');
          control_tab.classList.toggle('is-changed', control_is_changed);
          if (control_marker) {
            control_marker.hidden = !control_is_changed;
          }
          if (control_changed_text) {
            control_changed_text.hidden = !control_is_changed;
          }
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

        // Combine every registered split length control before normalizing it.
        var split_normalizer = COL_PROPS[key] && COL_PROPS[key].normalize;
        if (t.hasAttribute('data-style-part') && ('len' === split_normalizer || 'max_len' === split_normalizer)) {
          var numEl = host.querySelector('[data-style-key="' + key + '"][data-style-part="value"][data-col-idx="' + idx + '"]');
          var unitEl = host.querySelector('[data-style-key="' + key + '"][data-style-part="unit"][data-col-idx="' + idx + '"]');
          var num = numEl ? String(numEl.value || '').trim() : '';
          var unit = unitEl ? String(unitEl.value || 'px').trim() : 'px';
          var raw = num ? num + unit : '';
          styles_arr[idx][key] = normalize_value(key, raw);
          if (styles_arr[idx].__has) {
            styles_arr[idx].__has[key] = true;
          }
          promote_box_sides_to_explicit(styles_arr[idx], key);
          commit(builder, section_el, styles_arr);
          sync_column_control_tab_marker(idx, key, styles_arr[idx]);
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
        if (styles_arr[idx].__has) {
          styles_arr[idx].__has[key] = true;
        }
        if (OVERFLOW_AXIS_KEYS.indexOf(key) !== -1) {
          promote_overflow_axes_to_explicit(styles_arr[idx]);
        }
        commit(builder, section_el, styles_arr);
        sync_column_control_tab_marker(idx, key, styles_arr[idx]);
      }

      /**
       * Reset an allowlisted subset of one column style object to registered defaults.
       *
       * Legacy shorthand values are promoted before the reset so clearing one side
       * or overflow axis cannot silently change its siblings. The reset keys are
       * marked absent so sparse persistence falls back to the canonical defaults.
       *
       * @param {HTMLElement} reset_control Reset link carrying column and key metadata.
       * @returns {boolean} Whether a supported style subset was reset.
       */
      function reset_column_style_keys(reset_control) {
        var column_index = parseInt(reset_control.getAttribute('data-col-idx'), 10);
        var requested_keys = String(reset_control.getAttribute('data-style-keys') || '').split(/\s+/);
        if (isNaN(column_index) || column_index < 0 || column_index >= styles_arr.length) {
          return false;
        }
        var style_object = styles_arr[column_index];
        var style_keys = UI.WPBC_BFB_Column_Styles.reset_style_keys(style_object, requested_keys);
        if (!style_keys.length) {
          return false;
        }
        var focus_selector = '[data-action="colstyles-reset-keys"][data-col-idx="' + column_index + '"][data-style-keys="' + style_keys.join(' ') + '"]';
        commit(builder, section_el, styles_arr);
        UI.wpbc_bfb_column_styles.render_for_section(builder, section_el, host);
        var restored_control = host.querySelector(focus_selector);
        if (restored_control && restored_control.focus) {
          restored_control.focus();
        }
        return true;
      }
      function on_click(e) {
        var control_tab = e.target.closest('[data-column-control-tab-key]');
        if (control_tab && host.contains(control_tab)) {
          var control_root = control_tab.closest('[data-column-control-tabs]');
          var control_tab_key = control_tab.getAttribute('data-column-control-tab-key') || '';
          e.preventDefault();
          activate_column_control_tab(control_root, control_tab_key, false);
          remember_column_control_tab(control_root, control_tab_key);
          return;
        }
        var property_reset = e.target.closest('[data-action="colstyles-reset-keys"]');
        if (property_reset && host.contains(property_reset)) {
          e.preventDefault();
          reset_column_style_keys(property_reset);
          return;
        }
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

      /**
       * Navigate one nested column-control tab list with the keyboard.
       *
       * @param {KeyboardEvent} e Inspector keydown event.
       * @returns {void}
       */
      function on_keydown(e) {
        var control_tab = e.target.closest('[data-column-control-tab-key]');
        if (!control_tab || !host.contains(control_tab)) {
          return;
        }
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) === -1) {
          return;
        }
        var control_root = control_tab.closest('[data-column-control-tabs]');
        var control_tabs = Array.prototype.slice.call(control_root.querySelectorAll('[data-column-control-tab-key]'));
        var active_index = control_tabs.indexOf(control_tab);
        if (active_index < 0) {
          return;
        }
        var next_index = active_index;
        if ('Home' === e.key) {
          next_index = 0;
        } else if ('End' === e.key) {
          next_index = control_tabs.length - 1;
        } else if ('ArrowRight' === e.key) {
          next_index = (active_index + 1) % control_tabs.length;
        } else {
          next_index = (active_index - 1 + control_tabs.length) % control_tabs.length;
        }
        e.preventDefault();
        var next_tab_key = control_tabs[next_index].getAttribute('data-column-control-tab-key') || '';
        activate_column_control_tab(control_root, next_tab_key, true);
        remember_column_control_tab(control_root, next_tab_key);
      }
      host.addEventListener('input', on_change, true);
      host.addEventListener('change', on_change, true);
      host.addEventListener('click', on_click, true);
      host.addEventListener('keydown', on_keydown, true);

      // Initial apply (does NOT auto-activate).
      UI.WPBC_BFB_Column_Styles.apply(section_el, styles_arr);

      // Provide cleanup to avoid leaks.
      host.__wpbc_cleanup = function () {
        try {
          host.removeEventListener('input', on_change, true);
          host.removeEventListener('change', on_change, true);
          host.removeEventListener('click', on_click, true);
          host.removeEventListener('keydown', on_keydown, true);
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3Mvc2VjdGlvbi9fb3V0L3VpLWNvbHVtbi1zdHlsZXMuanMiLCJuYW1lcyI6WyJ3IiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJVSSIsIlMiLCJXUEJDX0JGQl9TYW5pdGl6ZSIsIkRPTSIsIldQQkNfQkZCX0RPTSIsIlNFTEVDVE9SUyIsInJvdyIsImNvbHVtbiIsIkNPTF9QUk9QUyIsImRpciIsInZhciIsImRlZiIsIm5vcm1hbGl6ZSIsIndyYXAiLCJqYyIsImFpIiwiZ2FwIiwicGFkZGluZyIsIm1hcmdpbiIsInBhZGRpbmdfdG9wIiwicGFkZGluZ19yaWdodCIsInBhZGRpbmdfYm90dG9tIiwicGFkZGluZ19sZWZ0IiwibWFyZ2luX3RvcCIsIm1hcmdpbl9yaWdodCIsIm1hcmdpbl9ib3R0b20iLCJtYXJnaW5fbGVmdCIsIm1heF93aWR0aCIsIm1heF9oZWlnaHQiLCJvdmVyZmxvdyIsInR5cGUiLCJ2YWx1ZXMiLCJvdmVyZmxvd194Iiwib3ZlcmZsb3dfeSIsImFzZWxmIiwiQk9YX1NJREVfR1JPVVBTIiwiQk9YX1NJREVfS0VZUyIsImNvbmNhdCIsIk9WRVJGTE9XX0FYSVNfS0VZUyIsIm5vcm1fbGVuIiwidiIsInN2IiwiU3RyaW5nIiwidHJpbSIsInRlc3QiLCJub3JtX21heF9sZW4iLCJjYW5kaWRhdGVfdmFsdWUiLCJub3JtYWxpemVkX3ZhbHVlIiwibm9ybV9lbnVtIiwidmFscyIsImluZGV4T2YiLCJOT1JNQUxJWkUiLCJpZCIsImxlbiIsIm1heF9sZW4iLCJlbnVtIiwiaXNfc3VwcG9ydGVkX2tleSIsImsiLCJPYmplY3QiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJub3JtYWxpemVfdmFsdWUiLCJrZXkiLCJ2YWwiLCJjZmciLCJmbiIsImdldF9kZWZhdWx0c19vYmoiLCJvIiwiZ2V0X2VmZmVjdGl2ZV9ib3hfc2lkZSIsInNvdXJjZV9zdHlsZSIsInNpZGVfa2V5IiwibGVnYWN5X2tleSIsImRlZmF1bHRzIiwiZ2V0X2JveF9zaWRlX2dyb3VwIiwic2lkZV9rZXlzIiwicHJvbW90ZV9ib3hfc2lkZXNfdG9fZXhwbGljaXQiLCJzdHlsZV9vYmplY3QiLCJlZGl0ZWRfa2V5IiwiYm94X2dyb3VwIiwiX19oYXMiLCJzaWRlX2luZGV4IiwibGVuZ3RoIiwiZ2V0X2VmZmVjdGl2ZV9vdmVyZmxvd19heGlzIiwiYXhpc19rZXkiLCJwcm9tb3RlX292ZXJmbG93X2F4ZXNfdG9fZXhwbGljaXQiLCJheGlzX2luZGV4Iiwic2hvdWxkX2tlZXBfZXhwbGljaXRfZGVmYXVsdCIsInN0eWxlX2tleSIsInByZXNlbmNlX21hcCIsInJlc2V0X3N0eWxlX2tleXNfdG9fZGVmYXVsdHMiLCJyZXF1ZXN0ZWRfa2V5cyIsInN0eWxlX2tleXMiLCJBcnJheSIsImlzQXJyYXkiLCJyZXF1ZXN0ZWRfaW5kZXgiLCJwdXNoIiwicHJvbW90aW9uX2luZGV4IiwicHJvbW90aW9uX2tleSIsInJlc2V0X2luZGV4Iiwic2V0X3ZhcnMiLCJub2RlIiwic3R5bGVfb2JqIiwiY3NzVmFyIiwic3R5bGUiLCJzZXRQcm9wZXJ0eSIsInNldF92YXJzX3NwYXJzZSIsInJlbW92ZVByb3BlcnR5IiwiY2xlYXJfdmFycyIsImNsYW1wX2NvbHMiLCJuIiwiY2xhbXAiLCJOdW1iZXIiLCJNYXRoIiwibWF4IiwibWluIiwiZG9tX2NvbHMiLCJlbCIsInF1ZXJ5U2VsZWN0b3IiLCJjbnQiLCJxdWVyeVNlbGVjdG9yQWxsIiwiX2UiLCJXUEJDX0JGQl9Db2x1bW5fU3R5bGVzIiwicmVzZXRfc3R5bGVfa2V5cyIsInNldF9zZWxlY3RlZF9jb2xfZmxhZyIsInNlY3Rpb25fZWwiLCJrZXlfMWJhc2VkIiwiY29sc19jbnQiLCJpZHgiLCJwYXJzZUludCIsImlkeDAiLCJzZXRBdHRyaWJ1dGUiLCJjb2xzIiwiaSIsImNsYXNzTGlzdCIsInRvZ2dsZSIsInBjb2xzIiwiaiIsImNsZWFyX3NlbGVjdGVkX2NvbF9mbGFnIiwicmVtb3ZlQXR0cmlidXRlIiwicmVtb3ZlIiwicGFyc2VfY29sX3N0eWxlcyIsInMiLCJvYmoiLCJzYWZlX2pzb25fcGFyc2UiLCJKU09OIiwicGFyc2UiLCJjb2x1bW5zIiwic3RyaW5naWZ5X2NvbF9zdHlsZXMiLCJhcnIiLCJkYXRhIiwic3RyaW5naWZ5X2RhdGFfdmFsdWUiLCJzdHJpbmdpZnkiLCJpc19hY3RpdmUiLCJnZXRBdHRyaWJ1dGUiLCJyYXciLCJkYXRhc2V0IiwiY29sX3N0eWxlcyIsIkRFRiIsImFwcGx5Iiwic3R5bGVzIiwicHJldmlldyIsImFjdGl2ZSIsInJvd19vZmYiLCJub2RlcyIsInVzZV9zdHlsZXMiLCJyY29scyIsIndwYmNfYmZiX2NvbHVtbl9zdHlsZXMiLCJyZW5kZXJfZm9yX3NlY3Rpb24iLCJidWlsZGVyIiwiaG9zdCIsIl9fcHJldl9yb290IiwiZHMiLCJfX3ByZXZfa2V5IiwiX193cGJjX2FjdGl2ZV9rZXkiLCJjb2xfc3R5bGVzX2FjdGl2ZV90YWIiLCJjb2x1bW5fY29udHJvbF90YWJfc3RhdGUiLCJfX3dwYmNfY29sdW1uX2NvbnRyb2xfdGFiX3N0YXRlIiwicHJldmlvdXNfY29udHJvbF90YWJzIiwicHJldmlvdXNfY29udHJvbF9pbmRleCIsInByZXZpb3VzX2NvbnRyb2xfcm9vdCIsInByZXZpb3VzX2NvbnRyb2xfY29sdW1uIiwicHJldmlvdXNfY29udHJvbF9ncm91cCIsInByZXZpb3VzX2NvbnRyb2xfdGFiIiwiX193cGJjX2NsZWFudXAiLCJpbm5lckhUTUwiLCJ0cGwiLCJ3cCIsInRlbXBsYXRlIiwiY29sX2NvdW50IiwicmF3X2pzb24iLCJzYXZlZF9hcnIiLCJzdHlsZXNfYXJyIiwic3JjIiwiZnVsbCIsImFzc2lnbiIsImxlZ2FjeV9ib3hfa2V5IiwiY29udHJvbF90YWJzIiwiY29sdW1uX2NvbnRyb2xfdGFiX3Jvb3RzIiwiY29udHJvbF9yb290X2luZGV4IiwiY29udHJvbF9yb290IiwiYWN0aXZhdGVfY29sdW1uX2NvbnRyb2xfdGFiIiwid2luZG93Iiwid3BiY191aV90YWJzIiwiaW5pdF9vbiIsInRhYnNSb290IiwiX193cGJjX3BlcnNpc3RfbGlzdGVuZXIiLCJhZGRFdmVudExpc3RlbmVyIiwiZSIsImRldGFpbCIsImFjdGl2ZV9rZXkiLCJfX2tleSIsIl9fbmV3X3Jvb3QiLCJzZXRfYWN0aXZlIiwiX19hY3RpdmVfa2V5X25vdyIsIkluc3BlY3RvckVuaGFuY2VycyIsInNjYW4iLCJ3cGJjX2RlZmluZV90aXBweV90b29sdGlwcyIsInN5bmNfYXhpc19yb3RhdGlvbl9hbGwiLCJzdHlsZXNfaGFzX2FueV9ub25fZGVmYXVsdCIsImdldF9kZWZhdWx0c19vYmpfZm4iLCJzdHJpcF9kZWZhdWx0c19mb3Jfc2F2ZSIsIm91dCIsImtlZXBfZXhwbGljaXRfZGVmYXVsdCIsInRvZ2dsZV9heGlzX3JvdGF0aW9uX2Zvcl9jb2wiLCJlbmFibGUiLCJrZXlzIiwiZyIsInEiLCJpbnB1dHMiLCJsYmwiLCJuZXh0RWxlbWVudFNpYmxpbmciLCJjb250YWlucyIsImFkZCIsImRpcl92YWwiLCJ0YWJfa2V5IiwibW92ZV9mb2N1cyIsImNvbnRyb2xfcGFuZWxzIiwiYWN0aXZlX3RhYiIsInRhYl9pbmRleCIsImNvbnRyb2xfdGFiIiwidGFiX2lzX2FjdGl2ZSIsInBhbmVsX2luZGV4IiwiY29udHJvbF9wYW5lbCIsImZvY3VzIiwicmVtZW1iZXJfY29sdW1uX2NvbnRyb2xfdGFiIiwiY29udHJvbF9jb2x1bW4iLCJjb250cm9sX2dyb3VwIiwic3luY19jb2x1bW5fY29udHJvbF90YWJfbWFya2VyIiwiY29sdW1uX2luZGV4IiwiY29udHJvbF90YWJfaW5kZXgiLCJvd25lZF9zdHlsZV9rZXlzIiwic3BsaXQiLCJjb250cm9sX2lzX2NoYW5nZWQiLCJvd25lZF9rZXlfaW5kZXgiLCJvd25lZF9zdHlsZV9rZXkiLCJjb250cm9sX21hcmtlciIsImNvbnRyb2xfY2hhbmdlZF90ZXh0IiwiaGlkZGVuIiwicmVyZW5kZXJfZGVsYXlfbXMiLCJzY2hlZHVsZV9yZXJlbmRlciIsImNvbF9pZHgiLCJuZXdfZGlyIiwib3B0cyIsImRlbGF5IiwiX19yZXJlbmRlcl90aW1lciIsImNsZWFyVGltZW91dCIsInJvdGF0ZV9ub3ciLCJzZXRUaW1lb3V0IiwiY29tbWl0Iiwic2hvdWxkX2FjdGl2YXRlIiwic2F2ZV9hcnIiLCJqc29uIiwiYnVzIiwiV1BCQ19CRkJfRXZlbnRzIiwiZW1pdCIsIlNUUlVDVFVSRV9DSEFOR0UiLCJzb3VyY2UiLCJmaWVsZCIsIm9uX2NoYW5nZSIsInQiLCJ0YXJnZXQiLCJwYXJ0cyIsInZhbHVlIiwic3BsaXRfbm9ybWFsaXplciIsImhhc0F0dHJpYnV0ZSIsIm51bUVsIiwidW5pdEVsIiwibnVtIiwidW5pdCIsInJlc2V0X2NvbHVtbl9zdHlsZV9rZXlzIiwicmVzZXRfY29udHJvbCIsImlzTmFOIiwiZm9jdXNfc2VsZWN0b3IiLCJqb2luIiwicmVzdG9yZWRfY29udHJvbCIsIm9uX2NsaWNrIiwiY2xvc2VzdCIsImNvbnRyb2xfdGFiX2tleSIsInByZXZlbnREZWZhdWx0IiwicHJvcGVydHlfcmVzZXQiLCJidG4iLCJvbl9rZXlkb3duIiwic2xpY2UiLCJhY3RpdmVfaW5kZXgiLCJuZXh0X2luZGV4IiwibmV4dF90YWJfa2V5IiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsInJlZnJlc2hfZm9yX3NlY3Rpb24iLCJpbnNwZWN0b3Jfcm9vdCIsIndwYmNfYmZiX2luc3BlY3Rvcl9mYWN0b3J5X3Nsb3RzIiwiY29sdW1uX3N0eWxlcyIsIndwYmNfYmZiIiwiZ2V0X3NlbGVjdGVkX2ZpZWxkIiwiX3dwYmMiLCJkZXYiLCJlcnJvciJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2ZpZWxkLXBhY2tzL3NlY3Rpb24vX3NyYy91aS1jb2x1bW4tc3R5bGVzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiA9PSBIb3cgdG8gYWRkIGEgbmV3IENTUyBzdHlsZSA/ID09XHJcbiAqXHJcbiAqIFRMO0RSOiBhZGQgYSBrZXkgaW4gQ09MX1BST1BTIChKUykgLT4gcmVmZXJlbmNlIGl0cyBDU1MgdmFyIChDU1MpIOKGkiBhZGQgYSBjb250cm9sIGluIHRoZSBpbnNwZWN0b3IgdGVtcGxhdGUgKEhUTUwpLlxyXG4gKiBLZWVwIHRoZSBKUyBkZWZhdWx0IChkZWYpIGFuZCB0aGUgQ1NTIHZhcigpIGZhbGxiYWNrIGlkZW50aWNhbC5cclxuICpcclxuICogLS0gMSkgUmVnaXN0ZXIgdGhlIHN0eWxlIGluIHRoaXMgSlMgKENPTF9QUk9QUylcclxuICpcclxuICogICAgLy8gTGVuZ3RoLWxpa2UgZXhhbXBsZTpcclxuICogICAgcGFkZGluZzogeyB2YXI6ICctLXdwYmMtYmZiLWNvbC1wYWRkaW5nJywgZGVmOiAnMHB4Jywgbm9ybWFsaXplOiAnbGVuJyB9XG4gKlxyXG4gKiAgICAvLyBFbnVtIGV4YW1wbGU6XHJcbiAqICAgIGFjOiAgeyB2YXI6ICctLXdwYmMtYmZiLWNvbC1hYycsICBkZWY6ICdub3JtYWwnLCBub3JtYWxpemU6IHsgdHlwZTogJ2VudW0nLCB2YWx1ZXM6IFsnbm9ybWFsJywnc3RyZXRjaCcsJ2NlbnRlcicsJ3N0YXJ0JywnZW5kJywnc3BhY2UtYmV0d2VlbicsJ3NwYWNlLWFyb3VuZCcsJ3NwYWNlLWV2ZW5seSddIH0gfVxyXG4gKlxyXG4gKiAgICBOb3RlczpcclxuICogICAgLSBBbGxvd2VkIG5vcm1hbGl6ZXJzOiAnaWQnIChwYXNzdGhyb3VnaCksICdsZW4nIChweC9yZW0vZW0vJSksIG9yIHt0eXBlOidlbnVtJyx2YWx1ZXM6Wy4uLl0gfS5cclxuICogICAgLSBJZiB5b3UgbmVlZCBhIG5ldyBub3JtYWxpemVyLCBhZGQgaXQgdG8gTk9STUFMSVpFIGFuZCByZWZlcmVuY2UgaXRzIG5hbWUgaGVyZS5cclxuICpcclxuICogLS0gMikgV2lyZSB0aGUgQ1NTIHZhcmlhYmxlIChkZWZhdWx0cyArIGFjdGl2YXRpb24pXHJcbiAqXHJcbiAqICAgIEF1dGhvcml0YXRpdmUgQ1NTOiAuLi9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9fX2Nzcy9iZmJfZmllbGRzLmNzc1xuICogICAgVGhlIGZhbGxiYWNrIGluIHZhcigtLW5hbWUsIDxmYWxsYmFjaz4pIE1VU1QgTUFUQ0ggQ09MX1BST1BTW2tleV0uZGVmLlxyXG4gKlxyXG4gKiAgICAvKiBNaW5pIHByZXZpZXcgKHRlbXBsYXRlIOKAnGdob3N04oCdIGNvbHVtbnM7IGFsd2F5cyBvbikgKlxcL1xyXG4gKiAgICAud3BiY19iZmJfX3NlY3Rpb25fX2NvbHMgPiAud3BiY19iZmJfX3NlY3Rpb25fX2NvbCB7XG4gKiAgICAgIHBhZGRpbmc6IHZhcigtLXdwYmMtYmZiLWNvbC1wYWRkaW5nLCAwcHgpO1xuICogICAgICAvKiBhZGQgb3RoZXIgcHJvcGVydGllcyBoZXJlIHVzaW5nIHRoZWlyIHZhcnMgKlxcL1xyXG4gKiAgICB9XHJcbiAqXHJcbiAqICAgIC8qIFJlYWwgY29sdW1ucyAob25seSB3aGVuIHN0eWxlcyBhcmUgYWN0aXZhdGVkKSAqXFwvXHJcbiAqICAgIC53cGJjX2JmYl9mb3JtIC53cGJjX2JmYl9fc2VjdGlvbltkYXRhLWNvbHN0eWxlcy1hY3RpdmU9XCIxXCJdID4gLndwYmNfYmZiX19yb3cgPiAud3BiY19iZmJfX2NvbHVtbiB7XHJcbiAqICAgICAgcGFkZGluZzogdmFyKC0td3BiYy1iZmItY29sLXBhZGRpbmcsIDBweCk7XG4gKiAgICB9XHJcbiAqXHJcbiAqICAgIFdoZXJlIOKAnGRlZmF1bHQgQ1NTIHNldHRpbmdz4oCdIGxpdmU6XHJcbiAqICAgIC0gVGhlIEpTIGRlZmF1bHQ6IENPTF9QUk9QU1trZXldLmRlZiAoaW4gdGhpcyBmaWxlKSDigJQgdXNlZCBmb3IgcGFyc2luZywgcHJldmlldywgYW5kIGFjdGl2YXRpb24gY2hlY2tzLlxyXG4gKiAgICAtIFRoZSBDU1MgZmFsbGJhY2s6IHZhcigtLXdwYmMtYmZiLWNvbC08a2V5PiwgPGZhbGxiYWNrPikg4oCUIGluIGJmYl9zZWN0aW9uX19jb2x1bW5zLmNzcywgbXVzdCBlcXVhbCB0aGUgSlMgZGVmYXVsdC5cclxuICpcclxuICogLS0gMykgQWRkIGFuIGluc3BlY3RvciBjb250cm9sIGluIHRoZSB0ZW1wbGF0ZSAodG1wbC13cGJjLWJmYi1jb2x1bW4tc3R5bGVzKVxyXG4gKiAgICBGaWxlOiAuLi9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9maWVsZC1wYWNrcy9zZWN0aW9uL3NlY3Rpb24td3B0cGwucGhwXHJcbiAqXHJcbiAqICAgIDwhLS0gU2ltcGxlIGlucHV0ICh3b3JrcyBmb3IgJ2xlbicsICdpZCcsIGFuZCBtYW55IGVudW1zIHdpdGggdGV4dCBpbnB1dHMpIC0tPlxyXG4gKiAgICA8ZGl2IGNsYXNzPVwiaW5zcGVjdG9yX19yb3dcIj5cclxuICogICAgICA8bGFiZWwgY2xhc3M9XCJpbnNwZWN0b3JfX2xhYmVsIGluc3BlY3Rvcl9fd180MFwiPlBhZGRpbmc8L2xhYmVsPlxyXG4gKiAgICAgIDxkaXYgY2xhc3M9XCJpbnNwZWN0b3JfX2NvbnRyb2wgaW5zcGVjdG9yX193XzUwXCI+XHJcbiAqICAgICAgICA8aW5wdXQgdHlwZT1cInRleHRcIiBjbGFzcz1cImluc3BlY3Rvcl9faW5wdXRcIiBkYXRhLXN0eWxlLWtleT1cInBhZGRpbmdcIiBkYXRhLWNvbC1pZHg9XCJ7eyBpIH19XCIgcGxhY2Vob2xkZXI9XCJlLmcuLCA4cHggb3IgMC41cmVtXCI+XG4gKiAgICAgIDwvZGl2PlxyXG4gKiAgICA8L2Rpdj5cclxuICpcclxuICogICAgVGhlIGdlbmVyaWMgY2hhbmdlIGhhbmRsZXIgd2lsbDpcclxuICogICAgLSByZWFkIGRhdGEtc3R5bGUta2V5LFxyXG4gKiAgICAtIG5vcm1hbGl6ZSB2aWEgQ09MX1BST1BTLFxyXG4gKiAgICAtIHBlcnNpc3QgdG8gZGF0YS1jb2xfc3R5bGVzIChzcGFyc2UgSlNPTjsgZGVmYXVsdHMgc3RyaXBwZWQpLFxyXG4gKiAgICAtIHRvZ2dsZSBkYXRhLWNvbHN0eWxlcy1hY3RpdmUgYXV0b21hdGljYWxseSxcclxuICogICAgLSBhbmQgdXBkYXRlIHByZXZpZXcgKyByZWFsIGNvbHVtbnMuXHJcbiAqXHJcbiAqIC0tIDQpIChPcHRpb25hbCkgU3BsaXQgbGVuZ3RoIGNvbnRyb2xzIChudW1iZXIgKyB1bml0KVxuICpcclxuICogICAgSWYgeW91ciBuZXcgbGVuZ3RoIHN0eWxlIGlzIGEgcGFpciAodmFsdWUgKyB1bml0KSwgbWlycm9yIHRoZSAnZ2FwJyBwYXR0ZXJuOlxuICogICAgICAtIHR3byBpbnB1dHMgd2l0aCBkYXRhLXN0eWxlLXBhcnQ9XCJ2YWx1ZVwiIGFuZCBkYXRhLXN0eWxlLXBhcnQ9XCJ1bml0XCJcbiAqICAgICAgLSB1c2Ugbm9ybWFsaXplOiAnbGVuJyBpbiBDT0xfUFJPUFNcbiAqICAgIFRoZSBzaGFyZWQgb25fY2hhbmdlIHBhdGggY29tYmluZXMgYW5kIG5vcm1hbGl6ZXMgZXZlcnkgcmVnaXN0ZXJlZCBzcGxpdCBsZW5ndGggY29udHJvbC5cbiAqXHJcbiAqIC0tIDUpIEFjdGl2YXRpb24gJiBwZXJzaXN0ZW5jZSAod2hhdCBoYXBwZW5zIHVuZGVyIHRoZSBob29kKVxyXG4gKlxyXG4gKiAgICAtIFRoZSBzZXJ2aWNlIGNvbXBhcmVzIHNhdmVkIHZhbHVlcyB2cyBDT0xfUFJPUFMgZGVmYXVsdHMuIElmIGFueSBub24tZGVmYXVsdCBleGlzdHMsIGl0IHNldHNcclxuICogICAgICBkYXRhLWNvbHN0eWxlcy1hY3RpdmU9XCIxXCIgb24gdGhlIHNlY3Rpb24gYW5kIHdyaXRlcyBDU1MgdmFycyB0byByZWFsIGNvbHVtbnMuXHJcbiAqICAgIC0gV2hlbiBpbmFjdGl2ZSwgdGhlIHNlcnZpY2UgcmVtb3ZlcyBpbmxpbmUgdmFycyBzbyBDU1MgZmFsbHMgYmFjayB0byB5b3VyIGRlZmF1bHQgaW4gdmFyKC4uLiwgZmFsbGJhY2spLlxyXG4gKiAgICAtIGRhdGEtY29sX3N0eWxlcyBhdHRyaWJ1dGUgc3RvcmVzIGEgY29tcGFjdCAoc3BhcnNlKSBKU09OOiBvbmx5IGtleXMgdGhhdCBkaWZmZXIgZnJvbSBkZWZhdWx0cyBhcmUgc2F2ZWQuXHJcbiAqXHJcbiAqIENoZWNrbGlzdCBiZWZvcmUgeW91IHNoaXA6XHJcbiAqIFsgXSBDT0xfUFJPUFMgZW50cnkgYWRkZWQgd2l0aCBjb3JyZWN0IHZhciBuYW1lIGFuZCBkZWYgdmFsdWVcclxuICogWyBdIENTUyB2YXIoKSBmYWxsYmFjayBtYXRjaGVzIHRoZSBKUyBkZWZhdWx0IGV4YWN0bHlcclxuICogWyBdIEluc3BlY3RvciBjb250cm9sIHByZXNlbnQgYW5kIHVzZXMgZGF0YS1zdHlsZS1rZXk9XCI8eW91ciBrZXk+XCJcclxuICogWyBdIChJZiBzcGxpdC12YWx1ZSkgYm90aCBjb250cm9scyB1c2UgZGF0YS1zdHlsZS1wYXJ0IGFuZCB0aGUgcmVnaXN0cnkgdXNlcyBub3JtYWxpemU6ICdsZW4nXG4gKi9cclxuXHJcblxyXG4vKipcclxuICogVUk6IENvbHVtbiBTdHlsZXMgKHNlcnZpY2UgKyBpbnNwZWN0b3IgY29tcG9uZW50KVxyXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICogU3BsaXRzIGNvbHVtbi1zdHlsZSBsb2dpYyBvdXQgb2YgU2VjdGlvbiByZW5kZXJlcjpcclxuICogLSBTZXJ2aWNlOiBVSS5XUEJDX0JGQl9Db2x1bW5fU3R5bGVzIChwYXJzZS9zdHJpbmdpZnkvYXBwbHkvaXNfYWN0aXZlL2Jhc2VsaW5lKVxyXG4gKiAtIEluc3BlY3RvciBzbG90OiBVSS53cGJjX2JmYl9jb2x1bW5fc3R5bGVzIChyZW5kZXJfZm9yX3NlY3Rpb24gLyByZWZyZXNoX2Zvcl9zZWN0aW9uKVxyXG4gKlxyXG4gKiA9PSBGaWxlOiAvaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3Mvc2VjdGlvbi9fb3V0L3VpLWNvbHVtbi1zdHlsZXMuanNcclxuICpcclxuICogQHNpbmNlICAgICAxMS4wLjBcclxuICogQG1vZGlmaWVkICAyMDI2LTA5LTE5IDE2OjMwXG4gKiBAdmVyc2lvbiAgIDEuMS4xXG4gKi9cclxuKGZ1bmN0aW9uICggdyApIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdHZhciBDb3JlID0gKCB3LldQQkNfQkZCX0NvcmUgPSB3LldQQkNfQkZCX0NvcmUgfHwge30gKTtcclxuXHR2YXIgVUkgICA9ICggQ29yZS5VSSA9IENvcmUuVUkgfHwge30gKTtcclxuXHJcblx0dmFyIFMgICA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemUgfHwge307XHJcblx0dmFyIERPTSA9ICggQ29yZS5XUEJDX0JGQl9ET00gJiYgQ29yZS5XUEJDX0JGQl9ET00uU0VMRUNUT1JTICkgfHwge1xyXG5cdFx0cm93ICAgIDogJy53cGJjX2JmYl9fcm93JyxcclxuXHRcdGNvbHVtbiA6ICcud3BiY19iZmJfX2NvbHVtbidcclxuXHR9O1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8qKlxyXG5cdCAqIENlbnRyYWwgcmVnaXN0cnkgb2Ygc3VwcG9ydGVkIHBlci1jb2x1bW4gQ1NTIHByb3BlcnRpZXMuXHJcblx0ICpcclxuXHQgKiBFYWNoIGVudHJ5IGRlc2NyaWJlcyBob3cgYSBsb2dpY2FsIHN0eWxlIGtleSBtYXBzIHRvIGEgQ1NTIGN1c3RvbSBwcm9wZXJ0eVxyXG5cdCAqIHdyaXR0ZW4gb24gdGhlIGNvbHVtbiBlbGVtZW50LCBpdHMgZGVmYXVsdCB2YWx1ZSwgYW5kIGhvdyB0byBub3JtYWxpemUgdXNlclxyXG5cdCAqIGlucHV0IGJlZm9yZSBwZXJzaXN0aW5nL2FwcGx5aW5nLlxyXG5cdCAqXHJcblx0ICoga2V5ICAgICAgIOKAlCBTaG9ydCBzdHlsZSBrZXkgdXNlZCBpbiBVSSBhbmQgcGVyc2lzdGVkIEpTT04uXHJcblx0ICogdmFyICAgICAgIOKAlCBDU1MgdmFyaWFibGUgbmFtZSB3cml0dGVuIG9udG8gdGhlIERPTSBub2RlIHN0eWxlLlxyXG5cdCAqIGRlZiAgICAgICDigJQgRGVmYXVsdCB2YWx1ZSBpZiB0aGUgc3R5bGUgaXMgdW5zZXQvZW1wdHkuXHJcblx0ICogbm9ybWFsaXplIOKAlCBOb3JtYWxpemVyIGlkIG9yIGVudW0gZGVmaW5pdGlvbiAoYGlkYCwgYGxlbmAsIGBtYXhfbGVuYCwgb3IgYWxsb3dsaXN0ZWQgdmFsdWVzKS5cblx0ICovXHJcblx0dmFyIENPTF9QUk9QUyA9IHtcblx0XHRkaXIgIDogeyB2YXI6ICctLXdwYmMtYmZiLWNvbC1kaXInLCAgIGRlZjogJ2NvbHVtbicsICAgICAgICBub3JtYWxpemU6ICdpZCcgIH0sXG5cdFx0d3JhcCA6IHsgdmFyOiAnLS13cGJjLWJmYi1jb2wtd3JhcCcsICBkZWY6ICdub3dyYXAnLCAgICAgICBub3JtYWxpemU6ICdpZCcgIH0sXG5cdFx0amMgICA6IHsgdmFyOiAnLS13cGJjLWJmYi1jb2wtamMnLCAgICBkZWY6ICdmbGV4LXN0YXJ0Jywgbm9ybWFsaXplOiAnaWQnICB9LFxuXHRcdGFpICAgOiB7IHZhcjogJy0td3BiYy1iZmItY29sLWFpJywgICAgZGVmOiAnc3RyZXRjaCcsICAgIG5vcm1hbGl6ZTogJ2lkJyAgfSxcblx0XHRnYXAgIDogeyB2YXI6ICctLXdwYmMtYmZiLWNvbC1nYXAnLCAgIGRlZjogJzBweCcsICAgICAgICBub3JtYWxpemU6ICdsZW4nIH0sXG5cdFx0cGFkZGluZzogeyB2YXI6ICctLXdwYmMtYmZiLWNvbC1wYWRkaW5nJywgZGVmOiAnMHB4Jywgbm9ybWFsaXplOiAnbGVuJyB9LFxuXHRcdG1hcmdpbiA6IHsgdmFyOiAnLS13cGJjLWJmYi1jb2wtbWFyZ2luJywgIGRlZjogJzBweCcsIG5vcm1hbGl6ZTogJ2xlbicgfSxcblx0XHRwYWRkaW5nX3RvcCAgIDogeyB2YXI6ICctLXdwYmMtYmZiLWNvbC1wYWRkaW5nLXRvcCcsICAgIGRlZjogJzBweCcsIG5vcm1hbGl6ZTogJ2xlbicgfSxcblx0XHRwYWRkaW5nX3JpZ2h0IDogeyB2YXI6ICctLXdwYmMtYmZiLWNvbC1wYWRkaW5nLXJpZ2h0JywgIGRlZjogJzBweCcsIG5vcm1hbGl6ZTogJ2xlbicgfSxcblx0XHRwYWRkaW5nX2JvdHRvbTogeyB2YXI6ICctLXdwYmMtYmZiLWNvbC1wYWRkaW5nLWJvdHRvbScsIGRlZjogJzBweCcsIG5vcm1hbGl6ZTogJ2xlbicgfSxcblx0XHRwYWRkaW5nX2xlZnQgIDogeyB2YXI6ICctLXdwYmMtYmZiLWNvbC1wYWRkaW5nLWxlZnQnLCAgIGRlZjogJzBweCcsIG5vcm1hbGl6ZTogJ2xlbicgfSxcblx0XHRtYXJnaW5fdG9wICAgIDogeyB2YXI6ICctLXdwYmMtYmZiLWNvbC1tYXJnaW4tdG9wJywgICAgIGRlZjogJzAuN2VtJywgbm9ybWFsaXplOiAnbGVuJyB9LFxuXHRcdG1hcmdpbl9yaWdodCAgOiB7IHZhcjogJy0td3BiYy1iZmItY29sLW1hcmdpbi1yaWdodCcsICAgZGVmOiAnMHB4Jywgbm9ybWFsaXplOiAnbGVuJyB9LFxuXHRcdG1hcmdpbl9ib3R0b20gOiB7IHZhcjogJy0td3BiYy1iZmItY29sLW1hcmdpbi1ib3R0b20nLCAgZGVmOiAnMC43ZW0nLCBub3JtYWxpemU6ICdsZW4nIH0sXG5cdFx0bWFyZ2luX2xlZnQgICA6IHsgdmFyOiAnLS13cGJjLWJmYi1jb2wtbWFyZ2luLWxlZnQnLCAgICBkZWY6ICcwcHgnLCBub3JtYWxpemU6ICdsZW4nIH0sXG5cdFx0bWF4X3dpZHRoICAgICA6IHsgdmFyOiAnLS13cGJjLWJmYi1jb2wtbWF4LXdpZHRoJywgICAgICBkZWY6ICdub25lJywgbm9ybWFsaXplOiAnbWF4X2xlbicgfSxcblx0XHRtYXhfaGVpZ2h0ICAgIDogeyB2YXI6ICctLXdwYmMtYmZiLWNvbC1tYXgtaGVpZ2h0JywgICAgIGRlZjogJ25vbmUnLCBub3JtYWxpemU6ICdtYXhfbGVuJyB9LFxuXHRcdG92ZXJmbG93ICAgICAgOiB7XG5cdFx0XHR2YXI6ICctLXdwYmMtYmZiLWNvbC1vdmVyZmxvdycsXG5cdFx0XHRkZWY6ICd2aXNpYmxlJyxcblx0XHRcdG5vcm1hbGl6ZTogeyB0eXBlOiAnZW51bScsIHZhbHVlczogWyAndmlzaWJsZScsICdhdXRvJywgJ2hpZGRlbicgXSB9XG5cdFx0fSxcblx0XHRvdmVyZmxvd194ICAgIDoge1xuXHRcdFx0dmFyOiAnLS13cGJjLWJmYi1jb2wtb3ZlcmZsb3cteCcsXG5cdFx0XHRkZWY6ICd2aXNpYmxlJyxcblx0XHRcdG5vcm1hbGl6ZTogeyB0eXBlOiAnZW51bScsIHZhbHVlczogWyAndmlzaWJsZScsICdhdXRvJywgJ2hpZGRlbicgXSB9XG5cdFx0fSxcblx0XHRvdmVyZmxvd195ICAgIDoge1xuXHRcdFx0dmFyOiAnLS13cGJjLWJmYi1jb2wtb3ZlcmZsb3cteScsXG5cdFx0XHRkZWY6ICd2aXNpYmxlJyxcblx0XHRcdG5vcm1hbGl6ZTogeyB0eXBlOiAnZW51bScsIHZhbHVlczogWyAndmlzaWJsZScsICdhdXRvJywgJ2hpZGRlbicgXSB9XG5cdFx0fSxcblx0XHRhc2VsZjogeyB2YXI6ICctLXdwYmMtYmZiLWNvbC1hc2VsZicsIGRlZjogJ2ZsZXgtc3RhcnQnLFxuXHRcdFx0bm9ybWFsaXplOiB7IHR5cGU6ICdlbnVtJywgdmFsdWVzOiBbICdmbGV4LXN0YXJ0JywgJ2NlbnRlcicsICdmbGV4LWVuZCcsICdzdHJldGNoJyBdIH1cblx0XHR9XG5cdFx0Ly8gRXhhbXBsZSBhZGRpdGlvbnM6XHJcblx0XHQvLyBwYWQgOiB7IHZhcjogJy0td3BiYy1iZmItY29sLXBhZCcsIGRlZjogJzBweCcsICAgICAgICBub3JtYWxpemU6ICdsZW4nIH1cblx0fTtcblxuXHR2YXIgQk9YX1NJREVfR1JPVVBTID0ge1xuXHRcdHBhZGRpbmc6IFsgJ3BhZGRpbmdfdG9wJywgJ3BhZGRpbmdfcmlnaHQnLCAncGFkZGluZ19ib3R0b20nLCAncGFkZGluZ19sZWZ0JyBdLFxuXHRcdG1hcmdpbiA6IFsgJ21hcmdpbl90b3AnLCAnbWFyZ2luX3JpZ2h0JywgJ21hcmdpbl9ib3R0b20nLCAnbWFyZ2luX2xlZnQnIF1cblx0fTtcblxuXHR2YXIgQk9YX1NJREVfS0VZUyA9IEJPWF9TSURFX0dST1VQUy5wYWRkaW5nLmNvbmNhdCggQk9YX1NJREVfR1JPVVBTLm1hcmdpbiApO1xuXHR2YXIgT1ZFUkZMT1dfQVhJU19LRVlTID0gWyAnb3ZlcmZsb3dfeCcsICdvdmVyZmxvd195JyBdO1xuXHJcblx0LyoqXHJcblx0ICogTm9ybWFsaXplIGEgXCJsZW5ndGgtbGlrZVwiIHZhbHVlIChlLmcuLCBcIjhcIiDihpIgXCI4cHhcIikuXHJcblx0ICogQWNjZXB0cyBweC9yZW0vZW0vJTsgZXhwYW5kIHRoZSByZWdleCBpZiB5b3UgYWxsb3cgbW9yZSB1bml0cy5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfG51bWJlcn0gdlxyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9IG5vcm1hbGl6ZWQgdmFsdWUgKGFsd2F5cyBub24tZW1wdHkpXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gbm9ybV9sZW4oIHYgKSB7XG5cdFx0dmFyIHN2ID0gU3RyaW5nKCB2IHx8ICcnICkudHJpbSgpO1xyXG5cdFx0aWYgKCAhIHN2ICkgeyByZXR1cm4gJzBweCc7IH1cclxuXHRcdGlmICggL15cXGQrKFxcLlxcZCspPyQvLnRlc3QoIHN2ICkgKSB7IHJldHVybiBzdiArICdweCc7IH0gICAgICAgICAgICAgICAvLyBudW1iZXIgLT4gcHguXHJcblx0XHRpZiAoIC9eXFxkKyhcXC5cXGQrKT8ocHh8cmVtfGVtfCUpJC8udGVzdCggc3YgKSApIHsgcmV0dXJuIHN2OyB9ICAgICAgICAgLy8gYWxsb3dlZCB1bml0cy5cclxuXHRcdHJldHVybiAnMHB4Jztcblx0fVxuXG5cdC8qKlxuXHQgKiBOb3JtYWxpemUgYW4gb3B0aW9uYWwgbWF4aW11bSBkaW1lbnNpb24uXG5cdCAqXG5cdCAqIEVtcHR5IHZhbHVlcyBhbmQgYG5vbmVgIHJlbW92ZSB0aGUgbGltaXQuIE51bWVyaWMgdmFsdWVzIGFjY2VwdCB0aGUgdW5pdHNcblx0ICogZXhwb3NlZCBieSB0aGUgSW5zcGVjdG9yIGFuZCByZWplY3QgYXJiaXRyYXJ5IENTUyBkZWNsYXJhdGlvbnMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfG51bWJlcn0gY2FuZGlkYXRlX3ZhbHVlIENhbmRpZGF0ZSBtYXhpbXVtIGRpbWVuc2lvbi5cblx0ICogQHJldHVybnMge3N0cmluZ30gVmFsaWQgQ1NTIG1heGltdW0gZGltZW5zaW9uIG9yIGBub25lYC5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1fbWF4X2xlbiggY2FuZGlkYXRlX3ZhbHVlICkge1xuXHRcdHZhciBub3JtYWxpemVkX3ZhbHVlID0gU3RyaW5nKCBjYW5kaWRhdGVfdmFsdWUgPT0gbnVsbCA/ICcnIDogY2FuZGlkYXRlX3ZhbHVlICkudHJpbSgpO1xuXHRcdGlmICggISBub3JtYWxpemVkX3ZhbHVlIHx8ICdub25lJyA9PT0gbm9ybWFsaXplZF92YWx1ZSApIHtcblx0XHRcdHJldHVybiAnbm9uZSc7XG5cdFx0fVxuXHRcdGlmICggL15cXGQrKFxcLlxcZCspPyQvLnRlc3QoIG5vcm1hbGl6ZWRfdmFsdWUgKSApIHtcblx0XHRcdHJldHVybiBub3JtYWxpemVkX3ZhbHVlICsgJ3B4Jztcblx0XHR9XG5cdFx0aWYgKCAvXlxcZCsoXFwuXFxkKyk/KHB4fHJlbXxlbXwlfHZofHZ3KSQvLnRlc3QoIG5vcm1hbGl6ZWRfdmFsdWUgKSApIHtcblx0XHRcdHJldHVybiBub3JtYWxpemVkX3ZhbHVlO1xuXHRcdH1cblx0XHRyZXR1cm4gJ25vbmUnO1xuXHR9XG5cclxuXHQvKipcclxuXHQgKiBFeGFtcGxlOiAgYWM6IHsgdmFyOiAnLS13cGJjLWJmYi1jb2wtYWMnLCBkZWY6ICdub3JtYWwnLCBub3JtYWxpemU6IHsgdHlwZTogJ2VudW0nLCB2YWx1ZXM6IFsnbm9ybWFsJywnc3RyZXRjaCcsJ2NlbnRlcicsJ3N0YXJ0JywnZW5kJywnc3BhY2UtYmV0d2VlbicsJ3NwYWNlLWFyb3VuZCcsJ3NwYWNlLWV2ZW5seSddIH0gfVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHZcclxuXHQgKiBAcGFyYW0gdmFsc1xyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd8Kn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiBub3JtX2VudW0odiwgdmFscykge1xyXG5cdFx0diA9IFN0cmluZyggdiB8fCAnJyApO1xyXG5cdFx0cmV0dXJuIHZhbHMuaW5kZXhPZiggdiApICE9PSAtMSA/IHYgOiB2YWxzWzBdO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogTm9ybWFsaXplciByZWdpc3RyeS4gRXh0ZW5kIHRvIGFkZCBjdXN0b20gdmFsaWRhdG9ycy90cmFuc2Zvcm1zXHJcblx0ICogKGUuZy4sIGVudW1zLCBudW1iZXJzIHdpdGggcmFuZ2VzLCBldGMuKS5cclxuXHQgKi9cclxuXHR2YXIgTk9STUFMSVpFID0ge1xuXHRcdGlkICAgICA6IHYgPT4gU3RyaW5nKCB2IHx8ICcnICksXG5cdFx0bGVuICAgIDogbm9ybV9sZW4sXG5cdFx0bWF4X2xlbjogbm9ybV9tYXhfbGVuLFxuXHRcdGVudW0gICA6ICh2LCB2YWx1ZXMpID0+IG5vcm1fZW51bSggdiwgdmFsdWVzIClcblx0fTtcblxyXG5cdC8qKlxyXG5cdCAqIENoZWNrIHdoZXRoZXIgYSBzdHlsZSBrZXkgaXMgc3VwcG9ydGVkIGJ5IENPTF9QUk9QUy5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBrXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gaXNfc3VwcG9ydGVkX2tleSggayApIHtcclxuXHRcdHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIENPTF9QUk9QUywgayApO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogTm9ybWFsaXplIGEgdmFsdWUgZm9yIGEgZ2l2ZW4gc3R5bGUga2V5IHVzaW5nIGl0cyBjb25maWd1cmVkIG5vcm1hbGl6ZXIuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30ga2V5XHJcblx0ICogQHBhcmFtIHthbnl9IHZhbFxyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gbm9ybWFsaXplX3ZhbHVlKGtleSwgdmFsKSB7XHJcblx0XHR2YXIgY2ZnID0gQ09MX1BST1BTW2tleV07XHJcblx0XHRpZiAoICEgY2ZnICkge1xyXG5cdFx0XHRyZXR1cm4gU3RyaW5nKCB2YWwgfHwgJycgKTtcclxuXHRcdH1cclxuXHRcdGlmICggY2ZnLm5vcm1hbGl6ZSAmJiB0eXBlb2YgY2ZnLm5vcm1hbGl6ZSA9PT0gJ29iamVjdCcgJiYgY2ZnLm5vcm1hbGl6ZS50eXBlID09PSAnZW51bScgKSB7XHJcblx0XHRcdHJldHVybiBOT1JNQUxJWkUuZW51bSggdmFsLCBjZmcubm9ybWFsaXplLnZhbHVlcyB8fCBbXSApO1xyXG5cdFx0fVxyXG5cdFx0dmFyIGZuID0gTk9STUFMSVpFW2NmZy5ub3JtYWxpemVdIHx8IE5PUk1BTElaRS5pZDtcclxuXHRcdHJldHVybiBmbiggdmFsICk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBCdWlsZCBhIHBsYWluIG9iamVjdCBjb250YWluaW5nIGRlZmF1bHRzIGZvciBhbGwgc3VwcG9ydGVkIHN0eWxlIGtleXMuXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7UmVjb3JkPHN0cmluZywgc3RyaW5nPn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiBnZXRfZGVmYXVsdHNfb2JqKCkge1xuXHRcdHZhciBvID0ge307IGZvciAoIHZhciBrIGluIENPTF9QUk9QUyApIHsgaWYgKCBpc19zdXBwb3J0ZWRfa2V5KCBrICkgKSB7IG9ba10gPSBDT0xfUFJPUFNba10uZGVmOyB9IH1cblx0XHRyZXR1cm4gbztcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXNvbHZlIG9uZSBwYWRkaW5nIG9yIG1hcmdpbiBzaWRlIGZyb20gZXhwbGljaXQgb3IgbGVnYWN5IHNob3J0aGFuZCBkYXRhLlxuXHQgKlxuXHQgKiBAcGFyYW0ge1JlY29yZDxzdHJpbmcsIHN0cmluZz59IHNvdXJjZV9zdHlsZSBTYXZlZCBzcGFyc2UgY29sdW1uIHN0eWxlcy5cblx0ICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICBzaWRlX2tleSAgICAgRXhwbGljaXQgc2lkZSBrZXkuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgbGVnYWN5X2tleSAgIExlZ2FjeSBzaG9ydGhhbmQga2V5LlxuXHQgKiBAcGFyYW0ge1JlY29yZDxzdHJpbmcsIHN0cmluZz59IGRlZmF1bHRzICAgICBEZWZhdWx0cyBmb3Igc3VwcG9ydGVkIHN0eWxlcy5cblx0ICogQHJldHVybnMge3N0cmluZ30gRWZmZWN0aXZlIG5vcm1hbGl6ZWQgc2lkZSBsZW5ndGguXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfZWZmZWN0aXZlX2JveF9zaWRlKCBzb3VyY2Vfc3R5bGUsIHNpZGVfa2V5LCBsZWdhY3lfa2V5LCBkZWZhdWx0cyApIHtcblx0XHRpZiAoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggc291cmNlX3N0eWxlLCBzaWRlX2tleSApICkge1xuXHRcdFx0cmV0dXJuIG5vcm1hbGl6ZV92YWx1ZSggc2lkZV9rZXksIHNvdXJjZV9zdHlsZVsgc2lkZV9rZXkgXSApO1xuXHRcdH1cblx0XHRpZiAoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggc291cmNlX3N0eWxlLCBsZWdhY3lfa2V5ICkgKSB7XG5cdFx0XHRyZXR1cm4gbm9ybWFsaXplX3ZhbHVlKCBsZWdhY3lfa2V5LCBzb3VyY2Vfc3R5bGVbIGxlZ2FjeV9rZXkgXSApO1xuXHRcdH1cblx0XHRyZXR1cm4gZGVmYXVsdHNbIHNpZGVfa2V5IF07XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIHRoZSBwYWRkaW5nIG9yIG1hcmdpbiBncm91cCB0aGF0IG93bnMgYW4gZXhwbGljaXQgc2lkZSBrZXkuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBzaWRlX2tleSBDYW5kaWRhdGUgc2lkZSBrZXkuXG5cdCAqIEByZXR1cm5zIHt7bGVnYWN5X2tleTpzdHJpbmcsIHNpZGVfa2V5czpBcnJheTxzdHJpbmc+fXxudWxsfSBPd25pbmcgZ3JvdXAuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfYm94X3NpZGVfZ3JvdXAoIHNpZGVfa2V5ICkge1xuXHRcdGZvciAoIHZhciBsZWdhY3lfa2V5IGluIEJPWF9TSURFX0dST1VQUyApIHtcblx0XHRcdGlmICggT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBCT1hfU0lERV9HUk9VUFMsIGxlZ2FjeV9rZXkgKSAmJiBCT1hfU0lERV9HUk9VUFNbIGxlZ2FjeV9rZXkgXS5pbmRleE9mKCBzaWRlX2tleSApICE9PSAtMSApIHtcblx0XHRcdFx0cmV0dXJuIHsgbGVnYWN5X2tleTogbGVnYWN5X2tleSwgc2lkZV9rZXlzOiBCT1hfU0lERV9HUk9VUFNbIGxlZ2FjeV9rZXkgXSB9O1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0IG9uZSBsZWdhY3kgc2hvcnRoYW5kIGdyb3VwIHRvIGV4cGxpY2l0IHNpZGUgdmFsdWVzIGJlZm9yZSBzYXZpbmcuXG5cdCAqXG5cdCAqIEBwYXJhbSB7UmVjb3JkPHN0cmluZywgc3RyaW5nPn0gc3R5bGVfb2JqZWN0IEVmZmVjdGl2ZSBjb2x1bW4gc3R5bGVzLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgIGVkaXRlZF9rZXkgICBTaWRlIGtleSBjaGFuZ2VkIGJ5IHRoZSB1c2VyLlxuXHQgKiBAcmV0dXJucyB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHByb21vdGVfYm94X3NpZGVzX3RvX2V4cGxpY2l0KCBzdHlsZV9vYmplY3QsIGVkaXRlZF9rZXkgKSB7XG5cdFx0dmFyIGJveF9ncm91cCA9IGdldF9ib3hfc2lkZV9ncm91cCggZWRpdGVkX2tleSApO1xuXHRcdGlmICggISBib3hfZ3JvdXAgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0c3R5bGVfb2JqZWN0Ll9faGFzID0gc3R5bGVfb2JqZWN0Ll9faGFzIHx8IHt9O1xuXHRcdGZvciAoIHZhciBzaWRlX2luZGV4ID0gMDsgc2lkZV9pbmRleCA8IGJveF9ncm91cC5zaWRlX2tleXMubGVuZ3RoOyBzaWRlX2luZGV4KysgKSB7XG5cdFx0XHR2YXIgc2lkZV9rZXkgPSBib3hfZ3JvdXAuc2lkZV9rZXlzWyBzaWRlX2luZGV4IF07XG5cdFx0XHRzdHlsZV9vYmplY3RbIHNpZGVfa2V5IF0gPSBub3JtYWxpemVfdmFsdWUoIHNpZGVfa2V5LCBzdHlsZV9vYmplY3RbIHNpZGVfa2V5IF0gKTtcblx0XHRcdHN0eWxlX29iamVjdC5fX2hhc1sgc2lkZV9rZXkgXSA9IHRydWU7XG5cdFx0fVxuXG5cdFx0ZGVsZXRlIHN0eWxlX29iamVjdFsgYm94X2dyb3VwLmxlZ2FjeV9rZXkgXTtcblx0XHRzdHlsZV9vYmplY3QuX19oYXNbIGJveF9ncm91cC5sZWdhY3lfa2V5IF0gPSBmYWxzZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXNvbHZlIG9uZSBheGlzIGZyb20gYXhpcy1zcGVjaWZpYyBkYXRhIG9yIHRoZSBsZWdhY3kgc2hhcmVkIG92ZXJmbG93LlxuXHQgKlxuXHQgKiBAcGFyYW0ge1JlY29yZDxzdHJpbmcsIHN0cmluZz59IHNvdXJjZV9zdHlsZSBTYXZlZCBzcGFyc2UgY29sdW1uIHN0eWxlcy5cblx0ICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICBheGlzX2tleSAgICAgYG92ZXJmbG93X3hgIG9yIGBvdmVyZmxvd195YC5cblx0ICogQHBhcmFtIHtSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+fSBkZWZhdWx0cyAgICAgUmVnaXN0ZXJlZCBzdHlsZSBkZWZhdWx0cy5cblx0ICogQHJldHVybnMge3N0cmluZ30gRWZmZWN0aXZlIGFsbG93bGlzdGVkIG92ZXJmbG93IHZhbHVlLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2VmZmVjdGl2ZV9vdmVyZmxvd19heGlzKCBzb3VyY2Vfc3R5bGUsIGF4aXNfa2V5LCBkZWZhdWx0cyApIHtcblx0XHRpZiAoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggc291cmNlX3N0eWxlLCBheGlzX2tleSApICkge1xuXHRcdFx0cmV0dXJuIG5vcm1hbGl6ZV92YWx1ZSggYXhpc19rZXksIHNvdXJjZV9zdHlsZVsgYXhpc19rZXkgXSApO1xuXHRcdH1cblx0XHRpZiAoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggc291cmNlX3N0eWxlLCAnb3ZlcmZsb3cnICkgKSB7XG5cdFx0XHRyZXR1cm4gbm9ybWFsaXplX3ZhbHVlKCBheGlzX2tleSwgc291cmNlX3N0eWxlLm92ZXJmbG93ICk7XG5cdFx0fVxuXHRcdHJldHVybiBkZWZhdWx0c1sgYXhpc19rZXkgXTtcblx0fVxuXG5cdC8qKlxuXHQgKiBQcm9tb3RlIGEgbGVnYWN5IHNoYXJlZCBvdmVyZmxvdyB0byBleHBsaWNpdCBYIGFuZCBZIHZhbHVlcyBvbiBmaXJzdCBlZGl0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge1JlY29yZDxzdHJpbmcsICo+fSBzdHlsZV9vYmplY3QgTXV0YWJsZSBmdWxsIHN0eWxlIG9iamVjdC5cblx0ICogQHJldHVybnMge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBwcm9tb3RlX292ZXJmbG93X2F4ZXNfdG9fZXhwbGljaXQoIHN0eWxlX29iamVjdCApIHtcblx0XHRpZiAoICEgc3R5bGVfb2JqZWN0IHx8ICEgc3R5bGVfb2JqZWN0Ll9faGFzIHx8IHRydWUgIT09IHN0eWxlX29iamVjdC5fX2hhcy5vdmVyZmxvdyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRmb3IgKCB2YXIgYXhpc19pbmRleCA9IDA7IGF4aXNfaW5kZXggPCBPVkVSRkxPV19BWElTX0tFWVMubGVuZ3RoOyBheGlzX2luZGV4KysgKSB7XG5cdFx0XHR2YXIgYXhpc19rZXkgPSBPVkVSRkxPV19BWElTX0tFWVNbIGF4aXNfaW5kZXggXTtcblx0XHRcdHN0eWxlX29iamVjdFsgYXhpc19rZXkgXSA9IG5vcm1hbGl6ZV92YWx1ZSggYXhpc19rZXksIHN0eWxlX29iamVjdFsgYXhpc19rZXkgXSApO1xuXHRcdFx0c3R5bGVfb2JqZWN0Ll9faGFzWyBheGlzX2tleSBdID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRkZWxldGUgc3R5bGVfb2JqZWN0Lm92ZXJmbG93O1xuXHRcdHN0eWxlX29iamVjdC5fX2hhcy5vdmVyZmxvdyA9IGZhbHNlO1xuXHR9XG5cblx0LyoqXG5cdCAqIENoZWNrIHdoZXRoZXIgYW4gZXhwbGljaXQgZGVmYXVsdCBtdXN0IHJlbWFpbiBpbiBzcGFyc2Ugc2F2ZWQgSlNPTi5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICBzdHlsZV9rZXkgICBSZWdpc3RlcmVkIHN0eWxlIGtleS5cblx0ICogQHBhcmFtIHtSZWNvcmQ8c3RyaW5nLCBib29sZWFuPn0gcHJlc2VuY2VfbWFwIFNhdmVkLWtleSBwcmVzZW5jZSBtYXAuXG5cdCAqIEByZXR1cm5zIHtib29sZWFufSBXaGV0aGVyIHRvIHByZXNlcnZlIHRoZSBleHBsaWNpdCBkZWZhdWx0IHZhbHVlLlxuXHQgKi9cblx0ZnVuY3Rpb24gc2hvdWxkX2tlZXBfZXhwbGljaXRfZGVmYXVsdCggc3R5bGVfa2V5LCBwcmVzZW5jZV9tYXAgKSB7XG5cdFx0aWYgKCAhIHByZXNlbmNlX21hcCB8fCB0cnVlICE9PSBwcmVzZW5jZV9tYXBbIHN0eWxlX2tleSBdICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gQk9YX1NJREVfS0VZUy5pbmRleE9mKCBzdHlsZV9rZXkgKSAhPT0gLTE7XG5cdH1cblxuXHQvKipcblx0ICogUmVzZXQgYWxsb3dsaXN0ZWQga2V5cyBvbiBvbmUgZWZmZWN0aXZlIEluc3BlY3RvciBzdHlsZSBvYmplY3QuXG5cdCAqXG5cdCAqIFRoZSBvYmplY3QgaXMgbXV0YXRlZCBpbnRlbnRpb25hbGx5LiBMZWdhY3kgc2hvcnRoYW5kIGRhdGEgaXMgcHJvbW90ZWRcblx0ICogZmlyc3Qgc28gcmVzZXR0aW5nIG9uZSBzaWRlIG9yIGF4aXMgcHJlc2VydmVzIGV2ZXJ5IHVucmVsYXRlZCBlZmZlY3RpdmVcblx0ICogdmFsdWUuIFJlc2V0IGtleXMgYXJlIG1hcmtlZCBhYnNlbnQgZm9yIHNwYXJzZSBwZXJzaXN0ZW5jZS5cblx0ICpcblx0ICogQHBhcmFtIHtSZWNvcmQ8c3RyaW5nLCAqPn0gc3R5bGVfb2JqZWN0IEVmZmVjdGl2ZSBtdXRhYmxlIGNvbHVtbiBzdHlsZXMuXG5cdCAqIEBwYXJhbSB7QXJyYXk8c3RyaW5nPn0gICAgIHJlcXVlc3RlZF9rZXlzIENhbmRpZGF0ZSByZWdpc3RlcmVkIHN0eWxlIGtleXMuXG5cdCAqIEByZXR1cm5zIHtBcnJheTxzdHJpbmc+fSBTdXBwb3J0ZWQga2V5cyByZXNldCB0byB0aGVpciByZWdpc3RlcmVkIGRlZmF1bHRzLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVzZXRfc3R5bGVfa2V5c190b19kZWZhdWx0cyggc3R5bGVfb2JqZWN0LCByZXF1ZXN0ZWRfa2V5cyApIHtcblx0XHR2YXIgc3R5bGVfa2V5cyA9IFtdO1xuXHRcdGlmICggISBzdHlsZV9vYmplY3QgfHwgISBBcnJheS5pc0FycmF5KCByZXF1ZXN0ZWRfa2V5cyApICkge1xuXHRcdFx0cmV0dXJuIHN0eWxlX2tleXM7XG5cdFx0fVxuXG5cdFx0Zm9yICggdmFyIHJlcXVlc3RlZF9pbmRleCA9IDA7IHJlcXVlc3RlZF9pbmRleCA8IHJlcXVlc3RlZF9rZXlzLmxlbmd0aDsgcmVxdWVzdGVkX2luZGV4KysgKSB7XG5cdFx0XHRpZiAoIGlzX3N1cHBvcnRlZF9rZXkoIHJlcXVlc3RlZF9rZXlzWyByZXF1ZXN0ZWRfaW5kZXggXSApICkge1xuXHRcdFx0XHRzdHlsZV9rZXlzLnB1c2goIHJlcXVlc3RlZF9rZXlzWyByZXF1ZXN0ZWRfaW5kZXggXSApO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoICEgc3R5bGVfa2V5cy5sZW5ndGggKSB7XG5cdFx0XHRyZXR1cm4gc3R5bGVfa2V5cztcblx0XHR9XG5cblx0XHRzdHlsZV9vYmplY3QuX19oYXMgPSBzdHlsZV9vYmplY3QuX19oYXMgfHwge307XG5cdFx0Zm9yICggdmFyIHByb21vdGlvbl9pbmRleCA9IDA7IHByb21vdGlvbl9pbmRleCA8IHN0eWxlX2tleXMubGVuZ3RoOyBwcm9tb3Rpb25faW5kZXgrKyApIHtcblx0XHRcdHZhciBwcm9tb3Rpb25fa2V5ID0gc3R5bGVfa2V5c1sgcHJvbW90aW9uX2luZGV4IF07XG5cdFx0XHRpZiAoIEJPWF9TSURFX0tFWVMuaW5kZXhPZiggcHJvbW90aW9uX2tleSApICE9PSAtMSApIHtcblx0XHRcdFx0cHJvbW90ZV9ib3hfc2lkZXNfdG9fZXhwbGljaXQoIHN0eWxlX29iamVjdCwgcHJvbW90aW9uX2tleSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBPVkVSRkxPV19BWElTX0tFWVMuaW5kZXhPZiggcHJvbW90aW9uX2tleSApICE9PSAtMSApIHtcblx0XHRcdFx0cHJvbW90ZV9vdmVyZmxvd19heGVzX3RvX2V4cGxpY2l0KCBzdHlsZV9vYmplY3QgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRmb3IgKCB2YXIgcmVzZXRfaW5kZXggPSAwOyByZXNldF9pbmRleCA8IHN0eWxlX2tleXMubGVuZ3RoOyByZXNldF9pbmRleCsrICkge1xuXHRcdFx0dmFyIHN0eWxlX2tleSA9IHN0eWxlX2tleXNbIHJlc2V0X2luZGV4IF07XG5cdFx0XHRzdHlsZV9vYmplY3RbIHN0eWxlX2tleSBdID0gQ09MX1BST1BTWyBzdHlsZV9rZXkgXS5kZWY7XG5cdFx0XHRzdHlsZV9vYmplY3QuX19oYXNbIHN0eWxlX2tleSBdID0gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN0eWxlX2tleXM7XG5cdH1cblxyXG5cdC8qKlxyXG5cdCAqIEFwcGx5IGFsbCBDU1MgdmFyaWFibGVzIChmcm9tIENPTF9QUk9QUykgb250byBhIG5vZGUgYmFzZWQgb24gYSBzdHlsZSBvYmplY3QuXHJcblx0ICogTWlzc2luZy9lbXB0eSB2YWx1ZXMgZmFsbCBiYWNrIHRvIGRlZmF1bHRzLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbm9kZVxyXG5cdCAqIEBwYXJhbSB7UmVjb3JkPHN0cmluZywgc3RyaW5nPn0gc3R5bGVfb2JqXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gc2V0X3ZhcnMoIG5vZGUsIHN0eWxlX29iaiApIHtcclxuXHRcdGlmICggISBub2RlICkgeyByZXR1cm47IH1cclxuXHRcdGZvciAoIHZhciBrIGluIENPTF9QUk9QUyApIHsgaWYgKCBpc19zdXBwb3J0ZWRfa2V5KCBrICkgKSB7XG5cdFx0XHR2YXIgY3NzVmFyID0gQ09MX1BST1BTW2tdLnZhcjtcblx0XHRcdHZhciB2ID0gKCBzdHlsZV9vYmogJiYgc3R5bGVfb2JqW2tdICE9IG51bGwgJiYgU3RyaW5nKCBzdHlsZV9vYmpba10gKS50cmltKCkgIT09ICcnICkgPyBzdHlsZV9vYmpba10gOiBDT0xfUFJPUFNba10uZGVmO1xuXHRcdFx0bm9kZS5zdHlsZS5zZXRQcm9wZXJ0eSggY3NzVmFyLCBub3JtYWxpemVfdmFsdWUoIGssIHYgKSApO1xuXHRcdH19XG5cdH1cblxyXG5cdGZ1bmN0aW9uIHNldF92YXJzX3NwYXJzZShub2RlLCBzdHlsZV9vYmopIHtcclxuXHRcdGlmICggIW5vZGUgKSByZXR1cm47XHJcblx0XHRmb3IgKCB2YXIgayBpbiBDT0xfUFJPUFMgKSB7IGlmICggaXNfc3VwcG9ydGVkX2tleShrKSApIHtcblx0XHRcdHZhciBjc3NWYXIgPSBDT0xfUFJPUFNba10udmFyO1xuXHRcdFx0aWYgKCBzdHlsZV9vYmogJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHN0eWxlX29iaiwgaykgJiYgU3RyaW5nKHN0eWxlX29ialtrXSkudHJpbSgpICE9PSAnJyApIHtcblx0XHRcdFx0bm9kZS5zdHlsZS5zZXRQcm9wZXJ0eShjc3NWYXIsIG5vcm1hbGl6ZV92YWx1ZSggaywgc3R5bGVfb2JqW2tdICkpO1xuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHQvLyBpbXBvcnRhbnQ6IHJlbW92ZSB2YXIgaW5zdGVhZCBvZiB3cml0aW5nIGEgZGVmYXVsdFxyXG5cdFx0XHRcdG5vZGUuc3R5bGUucmVtb3ZlUHJvcGVydHkoY3NzVmFyKTtcclxuXHRcdFx0fVxyXG5cdFx0fX1cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlbW92ZSBhbGwgQ1NTIHZhcmlhYmxlcyAoZnJvbSBDT0xfUFJPUFMpIGZyb20gYSBub2RlLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbm9kZVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGNsZWFyX3ZhcnMoIG5vZGUgKSB7XHJcblx0XHRpZiAoICEgbm9kZSApIHsgcmV0dXJuOyB9XHJcblx0XHRmb3IgKCB2YXIgayBpbiBDT0xfUFJPUFMgKSB7IGlmICggaXNfc3VwcG9ydGVkX2tleSggayApICkge1xyXG5cdFx0XHRub2RlLnN0eWxlLnJlbW92ZVByb3BlcnR5KCBDT0xfUFJPUFNba10udmFyICk7XHJcblx0XHR9fVxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogQ2xhbXAgaGVscGVyIGZvciBjb2x1bW5zIG51bWJlci5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gblxyXG5cdCAqIEByZXR1cm5zIHtudW1iZXJ9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gY2xhbXBfY29scyggbiApIHtcclxuXHRcdHJldHVybiAoIFMuY2xhbXAgPyBTLmNsYW1wKCBOdW1iZXIoIG4gKSB8fCAxLCAxLCA0ICkgOiBNYXRoLm1heCggMSwgTWF0aC5taW4oIDQsIE51bWJlciggbiApIHx8IDEgKSApICk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBSZWFkIGFjdHVhbCBudW1iZXIgb2YgY29sdW1ucyBmcm9tIERPTS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsXHJcblx0ICogQHJldHVybnMge251bWJlcn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiBkb21fY29scyggZWwgKSB7XHJcblx0XHR0cnkge1xyXG5cdFx0XHR2YXIgcm93ID0gZWwgPyBlbC5xdWVyeVNlbGVjdG9yKCAnOnNjb3BlID4gJyArIERPTS5yb3cgKSA6IG51bGw7XHJcblx0XHRcdHZhciBjbnQgPSByb3cgPyByb3cucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSA+ICcgKyBET00uY29sdW1uICkubGVuZ3RoIDogMTtcclxuXHRcdFx0cmV0dXJuIGNsYW1wX2NvbHMoIGNudCApO1xyXG5cdFx0fSBjYXRjaCAoIF9lICkge1xyXG5cdFx0XHRyZXR1cm4gMTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFNlcnZpY2U6IENvbHVtbiBTdHlsZXNcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRVSS5XUEJDX0JGQl9Db2x1bW5fU3R5bGVzID0ge1xuXG5cdFx0LyoqXG5cdFx0ICogUmVzZXQgYSBzdXBwb3J0ZWQgc3Vic2V0IG9mIG9uZSBlZmZlY3RpdmUgSW5zcGVjdG9yIHN0eWxlIG9iamVjdC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7UmVjb3JkPHN0cmluZywgKj59IHN0eWxlX29iamVjdCBFZmZlY3RpdmUgbXV0YWJsZSBjb2x1bW4gc3R5bGVzLlxuXHRcdCAqIEBwYXJhbSB7QXJyYXk8c3RyaW5nPn0gICAgIHN0eWxlX2tleXMgUmVnaXN0ZXJlZCBrZXlzIHRvIHJlc2V0LlxuXHRcdCAqIEByZXR1cm5zIHtBcnJheTxzdHJpbmc+fSBTdXBwb3J0ZWQga2V5cyB0aGF0IHdlcmUgcmVzZXQuXG5cdFx0ICovXG5cdFx0cmVzZXRfc3R5bGVfa2V5cyA6IGZ1bmN0aW9uICggc3R5bGVfb2JqZWN0LCBzdHlsZV9rZXlzICkge1xuXHRcdFx0cmV0dXJuIHJlc2V0X3N0eWxlX2tleXNfdG9fZGVmYXVsdHMoIHN0eWxlX29iamVjdCwgc3R5bGVfa2V5cyApO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQgKiBIaWdobGlnaHQgYSBzcGVjaWZpYyBjb2x1bW4gaW4gYm90aCB0aGUgbGl2ZSBjYW52YXMgYW5kIHRoZSBtaW5pIHByZXZpZXcsXHJcblx0XHQgKiBhbmQgc3RvcmUgdGhlIGFjdGl2ZSBpbmRleCBvbiB0aGUgc2VjdGlvbi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBzZWN0aW9uX2VsXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IGtleV8xYmFzZWQgIDEtYmFzZWQgY29sdW1uIGluZGV4IChjbGFtcGVkKVxyXG5cdFx0ICovXHJcblx0XHRzZXRfc2VsZWN0ZWRfY29sX2ZsYWcgOiBmdW5jdGlvbiAoIHNlY3Rpb25fZWwsIGtleV8xYmFzZWQgKSB7XHJcblx0XHRcdGlmICggISBzZWN0aW9uX2VsICkgeyByZXR1cm47IH1cclxuXHRcdFx0dmFyIGNvbHNfY250ID0gZG9tX2NvbHMoIHNlY3Rpb25fZWwgKTtcclxuXHRcdFx0dmFyIGlkeCAgICAgID0gTWF0aC5taW4oIE1hdGgubWF4KCBwYXJzZUludCgga2V5XzFiYXNlZCwgMTAgKSB8fCAxLCAxICksIGNvbHNfY250IHx8IDEgKTtcclxuXHRcdFx0dmFyIGlkeDAgICAgID0gaWR4IC0gMTtcclxuXHJcblx0XHRcdHNlY3Rpb25fZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1zZWxlY3RlZC1jb2wnLCBTdHJpbmcoIGlkeCApICk7XHJcblxyXG5cdFx0XHQvLyBSZWFsIGNhbnZhcyBjb2x1bW5zLlxyXG5cdFx0XHR2YXIgcm93ICA9IHNlY3Rpb25fZWwucXVlcnlTZWxlY3RvciggJzpzY29wZSA+ICcgKyBET00ucm93ICk7XHJcblx0XHRcdHZhciBjb2xzID0gcm93ID8gcm93LnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAnICsgRE9NLmNvbHVtbiApIDogW107XHJcblx0XHRcdGZvciAoIHZhciBpID0gMDsgaSA8IGNvbHMubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0aWYgKCBjb2xzW2ldLmNsYXNzTGlzdCApIHtcclxuXHRcdFx0XHRcdGNvbHNbaV0uY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLXNlbGVjdGVkLWNvbHVtbicsIGkgPT09IGlkeDAgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIE1pbmkgcHJldmlldyBjb2x1bW5zLlxyXG5cdFx0XHR2YXIgcGNvbHMgPSBzZWN0aW9uX2VsLnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgLndwYmNfYmZiX19zZWN0aW9uX19jb2xzID4gLndwYmNfYmZiX19zZWN0aW9uX19jb2wnICk7XHJcblx0XHRcdGZvciAoIHZhciBqID0gMDsgaiA8IHBjb2xzLmxlbmd0aDsgaisrICkge1xyXG5cdFx0XHRcdGlmICggcGNvbHNbal0uY2xhc3NMaXN0ICkge1xyXG5cdFx0XHRcdFx0cGNvbHNbal0uY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLXNlbGVjdGVkLWNvbHVtbicsIGogPT09IGlkeDAgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZW1vdmUgY29sdW1uIHNlbGVjdGlvbiBoaWdobGlnaHQgZnJvbSBib3RoIGNhbnZhcyBhbmQgbWluaSBwcmV2aWV3LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHNlY3Rpb25fZWxcclxuXHRcdCAqL1xyXG5cdFx0Y2xlYXJfc2VsZWN0ZWRfY29sX2ZsYWcgOiBmdW5jdGlvbiAoIHNlY3Rpb25fZWwgKSB7XHJcblx0XHRcdGlmICggISBzZWN0aW9uX2VsICkgeyByZXR1cm47IH1cclxuXHRcdFx0c2VjdGlvbl9lbC5yZW1vdmVBdHRyaWJ1dGUoICdkYXRhLXNlbGVjdGVkLWNvbCcgKTtcclxuXHJcblx0XHRcdHZhciByb3cgID0gc2VjdGlvbl9lbC5xdWVyeVNlbGVjdG9yKCAnOnNjb3BlID4gJyArIERPTS5yb3cgKTtcclxuXHRcdFx0dmFyIGNvbHMgPSByb3cgPyByb3cucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSA+ICcgKyBET00uY29sdW1uICkgOiBbXTtcclxuXHRcdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwgY29scy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0XHRjb2xzW2ldLmNsYXNzTGlzdCAmJiBjb2xzW2ldLmNsYXNzTGlzdC5yZW1vdmUoICdpcy1zZWxlY3RlZC1jb2x1bW4nICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBwY29scyA9IHNlY3Rpb25fZWwucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSAud3BiY19iZmJfX3NlY3Rpb25fX2NvbHMgPiAud3BiY19iZmJfX3NlY3Rpb25fX2NvbCcgKTtcclxuXHRcdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgcGNvbHMubGVuZ3RoOyBqKysgKSB7XHJcblx0XHRcdFx0cGNvbHNbal0uY2xhc3NMaXN0ICYmIHBjb2xzW2pdLmNsYXNzTGlzdC5yZW1vdmUoICdpcy1zZWxlY3RlZC1jb2x1bW4nICk7XHJcblx0XHRcdH1cclxuXHRcdH0sXHJcblxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFBhcnNlIEpTT04gc3RyaW5nIHRvIGFycmF5IG9mIHBlci1jb2x1bW4gc3R5bGUgb2JqZWN0cy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gc1xyXG5cdFx0ICogQHJldHVybnMge0FycmF5PHtkaXI6c3RyaW5nLHdyYXA6c3RyaW5nLGpjOnN0cmluZyxhaTpzdHJpbmcsZ2FwOnN0cmluZyxwYWRkaW5nOnN0cmluZyxtYXJnaW46c3RyaW5nLHBhZGRpbmdfdG9wOnN0cmluZyxwYWRkaW5nX3JpZ2h0OnN0cmluZyxwYWRkaW5nX2JvdHRvbTpzdHJpbmcscGFkZGluZ19sZWZ0OnN0cmluZyxtYXJnaW5fdG9wOnN0cmluZyxtYXJnaW5fcmlnaHQ6c3RyaW5nLG1hcmdpbl9ib3R0b206c3RyaW5nLG1hcmdpbl9sZWZ0OnN0cmluZyxtYXhfd2lkdGg6c3RyaW5nLG1heF9oZWlnaHQ6c3RyaW5nLG92ZXJmbG93OnN0cmluZyxvdmVyZmxvd194OnN0cmluZyxvdmVyZmxvd195OnN0cmluZyxhc2VsZjpzdHJpbmd9Pn1cblx0XHQgKi9cclxuXHRcdHBhcnNlX2NvbF9zdHlsZXMgOiBmdW5jdGlvbiAoIHMgKSB7XHJcblx0XHRcdGlmICggISBzICkgeyByZXR1cm4gW107IH1cclxuXHRcdFx0dmFyIG9iaiA9ICggUy5zYWZlX2pzb25fcGFyc2UgPyBTLnNhZmVfanNvbl9wYXJzZSggU3RyaW5nKCBzICksIG51bGwgKSA6ICggZnVuY3Rpb24oKXsgdHJ5IHsgcmV0dXJuIEpTT04ucGFyc2UoIFN0cmluZyggcyApICk7IH0gY2F0Y2goIF9lICl7IHJldHVybiBudWxsOyB9IH0gKSgpICk7XHJcblx0XHRcdGlmICggQXJyYXkuaXNBcnJheSggb2JqICkgKSB7IHJldHVybiBvYmo7IH1cclxuXHRcdFx0aWYgKCBvYmogJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCcgJiYgQXJyYXkuaXNBcnJheSggb2JqLmNvbHVtbnMgKSApIHsgcmV0dXJuIG9iai5jb2x1bW5zOyB9XHJcblx0XHRcdHJldHVybiBbXTtcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTdHJpbmdpZnkgc3R5bGVzIGFycmF5IHRvIGNhbm9uaWNhbCBKU09OLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7QXJyYXl9IGFyclxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0c3RyaW5naWZ5X2NvbF9zdHlsZXMgOiBmdW5jdGlvbiAoIGFyciApIHtcclxuXHRcdFx0dmFyIGRhdGEgPSBBcnJheS5pc0FycmF5KCBhcnIgKSA/IGFyciA6IFtdO1xyXG5cdFx0XHRyZXR1cm4gKCBTLnN0cmluZ2lmeV9kYXRhX3ZhbHVlID8gUy5zdHJpbmdpZnlfZGF0YV92YWx1ZSggZGF0YSApIDogSlNPTi5zdHJpbmdpZnkoIGRhdGEgKSApO1xyXG5cdFx0fSxcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENoZWNrIGlmIHBlci1jb2x1bW4gc3R5bGVzIGFyZSBhY3RpdmUgZm9yIGEgc2VjdGlvbi5cclxuXHRcdCAqIC0gQWN0aXZlIGlmIGVsZW1lbnQgZmxhZyBkYXRhLWNvbHN0eWxlcy1hY3RpdmU9XCIxXCIgT1Igbm9uLWVtcHR5IHNlcmlhbGl6ZWQgc3R5bGVzLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHNlY3Rpb25fZWxcclxuXHRcdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdFx0ICovXHJcblx0XHRpc19hY3RpdmUgOiBmdW5jdGlvbiAoIHNlY3Rpb25fZWwgKSB7XHJcblx0XHRcdGlmICggISBzZWN0aW9uX2VsICkgeyByZXR1cm4gZmFsc2U7IH1cclxuXHRcdFx0aWYgKCBzZWN0aW9uX2VsLmdldEF0dHJpYnV0ZSggJ2RhdGEtY29sc3R5bGVzLWFjdGl2ZScgKSA9PT0gJzEnICkgeyByZXR1cm4gdHJ1ZTsgfVxyXG4gICAgICAgICAgICB2YXIgcmF3ID0gc2VjdGlvbl9lbC5nZXRBdHRyaWJ1dGUoICdkYXRhLWNvbF9zdHlsZXMnICkgfHwgKCBzZWN0aW9uX2VsLmRhdGFzZXQgPyAoIHNlY3Rpb25fZWwuZGF0YXNldC5jb2xfc3R5bGVzIHx8ICcnICkgOiAnJyApO1xyXG4gICAgICAgICAgICB2YXIgYXJyID0gdGhpcy5wYXJzZV9jb2xfc3R5bGVzKCByYXcgKTtcclxuICAgICAgICAgICAgdmFyIERFRiA9IGdldF9kZWZhdWx0c19vYmooKTtcclxuICAgICAgICAgICAgLy8gQWN0aXZlIG9ubHkgaWYgYW55IGNvbHVtbiBoYXMgYSBub24tZGVmYXVsdCwgbm9uLWVtcHR5IG92ZXJyaWRlLlxyXG4gICAgICAgICAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpKysgKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgcyA9IGFycltpXSB8fCB7fTtcclxuICAgICAgICAgICAgICAgIGZvciAoIHZhciBrIGluIERFRiApIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggcywgayApICkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdiA9IFN0cmluZyggc1trXSApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIHYgJiYgdiAhPT0gU3RyaW5nKCBERUZba10gKSApIHsgcmV0dXJuIHRydWU7IH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG5cdFx0fSxcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFwcGx5IHBlci1jb2x1bW4gc3R5bGVzIHRvIHByZXZpZXcgYW5kLCB3aGVuIGFjdGl2ZSwgdG8gcmVhbCBjb2x1bW5zLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHNlY3Rpb25fZWxcclxuXHRcdCAqIEBwYXJhbSB7QXJyYXl9ICAgICAgIHN0eWxlc1xyXG5cdFx0ICovXHJcblx0XHRhcHBseSA6IGZ1bmN0aW9uICggc2VjdGlvbl9lbCwgc3R5bGVzICkge1xyXG5cdFx0XHRpZiAoICEgc2VjdGlvbl9lbCApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHQvLyBNaW5pIHByZXZpZXcgaW5zaWRlIHRoZSBzZWN0aW9uIHRlbXBsYXRlIChhbHdheXMgb24pLlxyXG5cdFx0XHR2YXIgcHJldmlldyA9IHNlY3Rpb25fZWwucXVlcnlTZWxlY3RvciggJzpzY29wZSAud3BiY19iZmJfX3NlY3Rpb25fX2NvbHMnICk7XHJcblx0XHRcdGlmICggcHJldmlldyApIHtcclxuXHRcdFx0XHR2YXIgcGNvbHMgPSBwcmV2aWV3LnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX3NlY3Rpb25fX2NvbCcgKTtcclxuXHRcdFx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBwY29scy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0XHRcdHNldF92YXJzKHBjb2xzW2ldLCBzdHlsZXNbaV0gfHwge30pOyAgIC8vIE9LIHRvIHVzZSBkZWZhdWx0cyBpbiBwcmV2aWV3XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBEZXRlcm1pbmUgYWN0aXZhdGlvbiBmcm9tIGN1cnJlbnQgZWxlbWVudCBzdGF0ZSAobm90IGZyb20gc3R5bGVzIGFyZyBhbG9uZSkuXHJcblx0XHRcdHZhciBhY3RpdmUgPSB0aGlzLmlzX2FjdGl2ZSggc2VjdGlvbl9lbCApO1xyXG5cclxuXHRcdFx0Ly8gSWYgbm90IGFjdGl2ZSwgY2xlYW4gdXAgaW5saW5lIHZhcnMgYW5kIHJlbW92ZSB0aGUgZmxhZy5cclxuXHRcdFx0aWYgKCAhIGFjdGl2ZSApIHtcclxuXHRcdFx0XHRzZWN0aW9uX2VsLnJlbW92ZUF0dHJpYnV0ZSggJ2RhdGEtY29sc3R5bGVzLWFjdGl2ZScgKTtcclxuXHRcdFx0XHR2YXIgcm93X29mZiA9IHNlY3Rpb25fZWwucXVlcnlTZWxlY3RvciggJzpzY29wZSA+ICcgKyBET00ucm93ICk7XHJcblx0XHRcdFx0aWYgKCByb3dfb2ZmICkge1xyXG5cdFx0XHRcdFx0dmFyIG5vZGVzID0gcm93X29mZi5xdWVyeVNlbGVjdG9yQWxsKCAnOnNjb3BlID4gJyArIERPTS5jb2x1bW4gKTtcclxuXHRcdFx0XHRcdGZvciAoIHZhciBqID0gMDsgaiA8IG5vZGVzLmxlbmd0aDsgaisrICkge1xyXG5cdFx0XHRcdFx0XHRjbGVhcl92YXJzKCBub2Rlc1tqXSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIEFjdGl2ZTogYWRkIGZsYWcgaWYgbWlzc2luZyBhbmQgd3JpdGUgQ1NTIHZhcnMgdG8gUkVBTCBjYW52YXMgY29sdW1ucy5cclxuXHRcdFx0c2VjdGlvbl9lbC5zZXRBdHRyaWJ1dGUoICdkYXRhLWNvbHN0eWxlcy1hY3RpdmUnLCAnMScgKTtcclxuXHJcblx0XHRcdC8vIE5FVzogYWx3YXlzIHVzZSB0aGUgc3BhcnNlLCBzYXZlZCBKU09OIGZvciBSRUFMIGNvbHVtbnMuXHJcblx0XHRcdHZhciB1c2Vfc3R5bGVzID0gdGhpcy5wYXJzZV9jb2xfc3R5bGVzKFxyXG5cdFx0XHRcdHNlY3Rpb25fZWwuZ2V0QXR0cmlidXRlKCAnZGF0YS1jb2xfc3R5bGVzJyApIHx8XHJcblx0XHRcdFx0KHNlY3Rpb25fZWwuZGF0YXNldCA/IChzZWN0aW9uX2VsLmRhdGFzZXQuY29sX3N0eWxlcyB8fCAnJykgOiAnJylcclxuXHRcdFx0KTtcclxuXHJcblx0XHRcdHZhciByb3cgPSBzZWN0aW9uX2VsLnF1ZXJ5U2VsZWN0b3IoICc6c2NvcGUgPiAnICsgRE9NLnJvdyApO1xyXG5cdFx0XHRpZiAoIHJvdyApIHtcclxuXHRcdFx0XHR2YXIgcmNvbHMgPSByb3cucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSA+ICcgKyBET00uY29sdW1uICk7XHJcblx0XHRcdFx0Zm9yICggdmFyIGsgPSAwOyBrIDwgcmNvbHMubGVuZ3RoOyBrKysgKSB7XHJcblx0XHRcdFx0XHRzZXRfdmFyc19zcGFyc2UocmNvbHNba10sIHVzZV9zdHlsZXNba10gfHwge30pOyAvLyBvbmx5IHdyaXRlIHdoYXQgZXhpc3RzXHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gSW5zcGVjdG9yIGNvbXBvbmVudCAoc2xvdDogXCJjb2x1bW5fc3R5bGVzXCIpXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0VUkud3BiY19iZmJfY29sdW1uX3N0eWxlcyA9IHtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlbmRlciB0aGUgcGVyLWNvbHVtbiBzdHlsZSBlZGl0b3IgKHdwLnRlbXBsYXRlOiAnd3BiYy1iZmItY29sdW1uLXN0eWxlcycpLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7b2JqZWN0fSAgICAgIGJ1aWxkZXJcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHNlY3Rpb25fZWxcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGhvc3RcclxuXHRcdCAqL1xyXG5cdFx0cmVuZGVyX2Zvcl9zZWN0aW9uIDogZnVuY3Rpb24gKCBidWlsZGVyLCBzZWN0aW9uX2VsLCBob3N0ICkge1xuXHRcdFx0aWYgKCAhIGhvc3QgfHwgISBzZWN0aW9uX2VsICkgeyByZXR1cm47IH1cblxuXHRcdFx0Ly8gQ2FwdHVyZSBjdXJyZW50IGFjdGl2ZSB0YWIgQkVGT1JFIHdlIGNsZWFyIGhvc3QuXG5cdFx0XHR2YXIgX19wcmV2X3Jvb3QgPSBob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRhYnNdJyApO1xuXHRcdFx0dmFyIGRzICAgICAgICAgID0gc2VjdGlvbl9lbC5kYXRhc2V0IHx8IHt9O1xuXHRcdFx0dmFyIF9fcHJldl9rZXkgID0gKF9fcHJldl9yb290ICYmIF9fcHJldl9yb290LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10YWItYWN0aXZlJyApKSB8fCBob3N0Ll9fd3BiY19hY3RpdmVfa2V5IHx8IGRzLmNvbF9zdHlsZXNfYWN0aXZlX3RhYiB8fCBudWxsO1xuXHRcdFx0dmFyIGNvbHVtbl9jb250cm9sX3RhYl9zdGF0ZSA9IGhvc3QuX193cGJjX2NvbHVtbl9jb250cm9sX3RhYl9zdGF0ZSB8fCB7fTtcblx0XHRcdHZhciBwcmV2aW91c19jb250cm9sX3RhYnMgPSBob3N0LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS1jb2x1bW4tY29udHJvbC10YWJzXScgKTtcblx0XHRcdGZvciAoIHZhciBwcmV2aW91c19jb250cm9sX2luZGV4ID0gMDsgcHJldmlvdXNfY29udHJvbF9pbmRleCA8IHByZXZpb3VzX2NvbnRyb2xfdGFicy5sZW5ndGg7IHByZXZpb3VzX2NvbnRyb2xfaW5kZXgrKyApIHtcblx0XHRcdFx0dmFyIHByZXZpb3VzX2NvbnRyb2xfcm9vdCA9IHByZXZpb3VzX2NvbnRyb2xfdGFic1sgcHJldmlvdXNfY29udHJvbF9pbmRleCBdO1xuXHRcdFx0XHR2YXIgcHJldmlvdXNfY29udHJvbF9jb2x1bW4gPSAoIHBhcnNlSW50KCBwcmV2aW91c19jb250cm9sX3Jvb3QuZ2V0QXR0cmlidXRlKCAnZGF0YS1jb2wtaWR4JyApLCAxMCApIHx8IDAgKSArIDE7XG5cdFx0XHRcdHZhciBwcmV2aW91c19jb250cm9sX2dyb3VwID0gcHJldmlvdXNfY29udHJvbF9yb290LmdldEF0dHJpYnV0ZSggJ2RhdGEtY29sdW1uLWNvbnRyb2wtdGFicycgKSB8fCAnJztcblx0XHRcdFx0dmFyIHByZXZpb3VzX2NvbnRyb2xfdGFiID0gcHJldmlvdXNfY29udHJvbF9yb290LmdldEF0dHJpYnV0ZSggJ2RhdGEtY29sdW1uLWNvbnRyb2wtdGFiLWFjdGl2ZScgKSB8fCAnJztcblx0XHRcdFx0aWYgKCBwcmV2aW91c19jb250cm9sX2dyb3VwICYmIHByZXZpb3VzX2NvbnRyb2xfdGFiICkge1xuXHRcdFx0XHRcdGNvbHVtbl9jb250cm9sX3RhYl9zdGF0ZVsgcHJldmlvdXNfY29udHJvbF9jb2x1bW4gKyAnXycgKyBwcmV2aW91c19jb250cm9sX2dyb3VwIF0gPSBwcmV2aW91c19jb250cm9sX3RhYjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aG9zdC5fX3dwYmNfY29sdW1uX2NvbnRyb2xfdGFiX3N0YXRlID0gY29sdW1uX2NvbnRyb2xfdGFiX3N0YXRlO1xuXHJcblx0XHRcdC8vIENsZWFudXAgcHJldmlvdXMgbW91bnQgYW5kIGNsZWFyLlxyXG5cdFx0XHRpZiAoIGhvc3QuX193cGJjX2NsZWFudXAgKSB7XHJcblx0XHRcdFx0dHJ5IHsgaG9zdC5fX3dwYmNfY2xlYW51cCgpOyB9IGNhdGNoICggX2UgKSB7fVxyXG5cdFx0XHRcdGhvc3QuX193cGJjX2NsZWFudXAgPSBudWxsO1xyXG5cdFx0XHR9XHJcblx0XHRcdGhvc3QuaW5uZXJIVE1MID0gJyc7XHJcblxyXG5cdFx0XHR2YXIgdHBsID0gKCB3LndwICYmIHcud3AudGVtcGxhdGUgKSA/IHcud3AudGVtcGxhdGUoICd3cGJjLWJmYi1jb2x1bW4tc3R5bGVzJyApIDogbnVsbDtcclxuXHRcdFx0aWYgKCAhIHRwbCApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHR2YXIgY29sX2NvdW50ICA9IGRvbV9jb2xzKCBzZWN0aW9uX2VsICk7XHJcblx0XHRcdHZhciByYXdfanNvbiAgID0gc2VjdGlvbl9lbC5nZXRBdHRyaWJ1dGUoICdkYXRhLWNvbF9zdHlsZXMnICkgfHwgKCBzZWN0aW9uX2VsLmRhdGFzZXQgPyAoIHNlY3Rpb25fZWwuZGF0YXNldC5jb2xfc3R5bGVzIHx8ICcnICkgOiAnJyApO1xyXG5cclxuXHRcdFx0dmFyIHNhdmVkX2FyciAgPSBVSS5XUEJDX0JGQl9Db2x1bW5fU3R5bGVzLnBhcnNlX2NvbF9zdHlsZXMoIHJhd19qc29uICk7XG5cdFx0XHR2YXIgc3R5bGVzX2FyciA9IFtdO1xuXHJcblx0XHRcdC8vIE5vcm1hbGl6ZSBsZW5ndGggdG8gY3VycmVudCBjb2x1bW5zIChVSS1vbmx5IGRlZmF1bHRzIGRvIE5PVCBhdXRvLWFjdGl2YXRlKS5cclxuXHRcdFx0dmFyIGRlZiA9IGdldF9kZWZhdWx0c19vYmooKTtcclxuXHRcdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwgY29sX2NvdW50OyBpKysgKSB7XG5cdFx0XHRcdHZhciBzcmMgPSBzYXZlZF9hcnJbaV0gfHwge307XG4gICAgICAgICAgICAgICAgLy8gTWVyZ2UgZm9yIGRpc3BsYXksIGJ1dCB0cmFjayB3aGljaCBrZXlzIHdlcmUgYWN0dWFsbHkgcHJlc2VudCBpbiBzYXZlZCBKU09OLlxuXHRcdFx0XHR2YXIgZnVsbCA9IE9iamVjdC5hc3NpZ24oIHt9LCBkZWYsIHNyYyApO1xuXHRcdFx0XHRmdWxsLm1heF93aWR0aCA9IG5vcm1hbGl6ZV92YWx1ZSggJ21heF93aWR0aCcsIGZ1bGwubWF4X3dpZHRoICk7XG5cdFx0XHRcdGZ1bGwubWF4X2hlaWdodCA9IG5vcm1hbGl6ZV92YWx1ZSggJ21heF9oZWlnaHQnLCBmdWxsLm1heF9oZWlnaHQgKTtcblx0XHRcdFx0ZnVsbC5vdmVyZmxvdyA9IG5vcm1hbGl6ZV92YWx1ZSggJ292ZXJmbG93JywgZnVsbC5vdmVyZmxvdyApO1xuXHRcdFx0XHRmdWxsLm92ZXJmbG93X3ggPSBnZXRfZWZmZWN0aXZlX292ZXJmbG93X2F4aXMoIHNyYywgJ292ZXJmbG93X3gnLCBkZWYgKTtcblx0XHRcdFx0ZnVsbC5vdmVyZmxvd195ID0gZ2V0X2VmZmVjdGl2ZV9vdmVyZmxvd19heGlzKCBzcmMsICdvdmVyZmxvd195JywgZGVmICk7XG5cdFx0XHRcdGZvciAoIHZhciBsZWdhY3lfYm94X2tleSBpbiBCT1hfU0lERV9HUk9VUFMgKSB7XG5cdFx0XHRcdFx0aWYgKCAhIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggQk9YX1NJREVfR1JPVVBTLCBsZWdhY3lfYm94X2tleSApICkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGZvciAoIHZhciBzaWRlX2luZGV4ID0gMDsgc2lkZV9pbmRleCA8IEJPWF9TSURFX0dST1VQU1sgbGVnYWN5X2JveF9rZXkgXS5sZW5ndGg7IHNpZGVfaW5kZXgrKyApIHtcblx0XHRcdFx0XHRcdHZhciBzaWRlX2tleSA9IEJPWF9TSURFX0dST1VQU1sgbGVnYWN5X2JveF9rZXkgXVsgc2lkZV9pbmRleCBdO1xuXHRcdFx0XHRcdFx0ZnVsbFsgc2lkZV9rZXkgXSA9IGdldF9lZmZlY3RpdmVfYm94X3NpZGUoIHNyYywgc2lkZV9rZXksIGxlZ2FjeV9ib3hfa2V5LCBkZWYgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0ZnVsbC5fX2hhcyA9IHt9O1xuXHRcdFx0XHRmb3IgKCB2YXIgc3R5bGVfa2V5IGluIGRlZiApIHtcblx0XHRcdFx0XHRpZiAoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggZGVmLCBzdHlsZV9rZXkgKSApIHtcblx0XHRcdFx0XHRcdGZ1bGwuX19oYXNbIHN0eWxlX2tleSBdID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBzcmMsIHN0eWxlX2tleSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuICAgICAgICAgICAgICAgIHN0eWxlc19hcnJbaV0gPSBmdWxsO1xyXG5cdFx0XHR9XHJcblx0XHRcdHN0eWxlc19hcnIubGVuZ3RoID0gY29sX2NvdW50OyAgIC8vIGNsYW1wLlxyXG5cclxuXHRcdFx0aG9zdC5pbm5lckhUTUwgPSB0cGwoIHtcblx0XHRcdFx0Y29scyAgICAgICAgOiBjb2xfY291bnQsXG5cdFx0XHRcdHN0eWxlcyAgICAgIDogc3R5bGVzX2Fycixcblx0XHRcdFx0YWN0aXZlICAgICAgOiBVSS5XUEJDX0JGQl9Db2x1bW5fU3R5bGVzLmlzX2FjdGl2ZSggc2VjdGlvbl9lbCApLFxuXHRcdFx0XHRjb250cm9sX3RhYnM6IGNvbHVtbl9jb250cm9sX3RhYl9zdGF0ZVxuXHRcdFx0fSApO1xuXG5cdFx0XHR2YXIgY29sdW1uX2NvbnRyb2xfdGFiX3Jvb3RzID0gaG9zdC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtY29sdW1uLWNvbnRyb2wtdGFic10nICk7XG5cdFx0XHRmb3IgKCB2YXIgY29udHJvbF9yb290X2luZGV4ID0gMDsgY29udHJvbF9yb290X2luZGV4IDwgY29sdW1uX2NvbnRyb2xfdGFiX3Jvb3RzLmxlbmd0aDsgY29udHJvbF9yb290X2luZGV4KysgKSB7XG5cdFx0XHRcdHZhciBjb250cm9sX3Jvb3QgPSBjb2x1bW5fY29udHJvbF90YWJfcm9vdHNbIGNvbnRyb2xfcm9vdF9pbmRleCBdO1xuXHRcdFx0XHRhY3RpdmF0ZV9jb2x1bW5fY29udHJvbF90YWIoIGNvbnRyb2xfcm9vdCwgY29udHJvbF9yb290LmdldEF0dHJpYnV0ZSggJ2RhdGEtY29sdW1uLWNvbnRyb2wtdGFiLWFjdGl2ZScgKSB8fCAnJywgZmFsc2UgKTtcblx0XHRcdH1cblxyXG5cdFx0XHRpZiAoIHdpbmRvdy53cGJjX3VpX3RhYnMgJiYgaG9zdCApIHtcclxuXHRcdFx0XHR3aW5kb3cud3BiY191aV90YWJzLmluaXRfb24oIGhvc3QgKTtcclxuXHJcblxyXG5cdFx0XHRcdC8vIFBlcnNpc3QgdGhlIGFjdGl2ZSB0YWIgc28gd2UgY2FuIHJlc3RvcmUgaXQgYWZ0ZXIgcmUtcmVuZGVycy5cclxuXHRcdFx0XHR2YXIgdGFic1Jvb3QgPSBob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRhYnNdJyApO1xyXG5cdFx0XHRcdGlmICggdGFic1Jvb3QgJiYgIXRhYnNSb290Ll9fd3BiY19wZXJzaXN0X2xpc3RlbmVyICkge1xyXG5cdFx0XHRcdFx0dGFic1Jvb3QuX193cGJjX3BlcnNpc3RfbGlzdGVuZXIgPSB0cnVlO1xyXG5cdFx0XHRcdFx0dGFic1Jvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6dGFiczpjaGFuZ2UnLCBmdW5jdGlvbiAoZSkge1xyXG5cdFx0XHRcdFx0XHR2YXIgayA9IGUgJiYgZS5kZXRhaWwgJiYgZS5kZXRhaWwuYWN0aXZlX2tleTtcclxuXHRcdFx0XHRcdFx0aWYgKCBrICkge1xyXG5cdFx0XHRcdFx0XHRcdGhvc3QuX193cGJjX2FjdGl2ZV9rZXkgPSBTdHJpbmcoIGsgKTtcclxuXHRcdFx0XHRcdFx0XHRpZiAoIHNlY3Rpb25fZWwgJiYgc2VjdGlvbl9lbC5kYXRhc2V0ICkge1xyXG5cdFx0XHRcdFx0XHRcdFx0c2VjdGlvbl9lbC5kYXRhc2V0LmNvbF9zdHlsZXNfYWN0aXZlX3RhYiA9IFN0cmluZyggayApO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHQvLyBORVc6IHJlZmxlY3Qgc2VsZWN0aW9uIG9uIHRoZSBzZWN0aW9uICsgY29sdW1ucy5cclxuXHRcdFx0XHRcdFx0XHRVSS5XUEJDX0JGQl9Db2x1bW5fU3R5bGVzLnNldF9zZWxlY3RlZF9jb2xfZmxhZyggc2VjdGlvbl9lbCwgayApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9LCB0cnVlICk7XHJcblxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gUmVzdG9yZSBwcmV2aW91cyB0YWIgaWYgaXQgc3RpbGwgZXhpc3RzIChjbGFtcCB0byBuZXcgY291bnQpLlxyXG5cdFx0XHRcdHZhciBfX2tleVxyXG5cdFx0XHRcdGlmICggX19wcmV2X2tleSApIHtcclxuXHRcdFx0XHRcdHZhciBfX25ld19yb290ID0gaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10YWJzXScgKTtcclxuXHRcdFx0XHRcdF9fa2V5ICAgICAgICAgID0gU3RyaW5nKCBNYXRoLm1pbiggTWF0aC5tYXgoIHBhcnNlSW50KCBfX3ByZXZfa2V5LCAxMCApIHx8IDEsIDEgKSwgY29sX2NvdW50ICkgKTtcclxuXHRcdFx0XHRcdGlmICggX19uZXdfcm9vdCAmJiB3aW5kb3cud3BiY191aV90YWJzLnNldF9hY3RpdmUgKSB7XHJcblx0XHRcdFx0XHRcdHdpbmRvdy53cGJjX3VpX3RhYnMuc2V0X2FjdGl2ZSggX19uZXdfcm9vdCwgX19rZXkgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIEFmdGVyIHJlc3RvcmluZyB0aGUgdGFiLCBlbnN1cmUgaGlnaGxpZ2h0IG1hdGNoZXMgdGhlIGFjdGl2ZSB0YWIuXHJcblx0XHRcdFx0dmFyIF9fYWN0aXZlX2tleV9ub3cgPSBfX2tleSB8fCAoZHMuY29sX3N0eWxlc19hY3RpdmVfdGFiID8gU3RyaW5nKCBNYXRoLm1pbiggTWF0aC5tYXgoIHBhcnNlSW50KCBkcy5jb2xfc3R5bGVzX2FjdGl2ZV90YWIsIDEwICkgfHwgMSwgMSApLCBjb2xfY291bnQgKSApIDogJzEnKTtcclxuXHRcdFx0XHRVSS5XUEJDX0JGQl9Db2x1bW5fU3R5bGVzLnNldF9zZWxlY3RlZF9jb2xfZmxhZyggc2VjdGlvbl9lbCwgX19hY3RpdmVfa2V5X25vdyApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBSZS13aXJlIG51bWJlciAtIHJhbmdlIHBhaXJpbmcgKFZhbHVlU2xpZGVyKSBmb3IgZnJlc2hseSByZW5kZXJlZCBjb250cm9scy5cclxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0VUkuSW5zcGVjdG9yRW5oYW5jZXJzICYmIFVJLkluc3BlY3RvckVuaGFuY2Vycy5zY2FuICYmIFVJLkluc3BlY3RvckVuaGFuY2Vycy5zY2FuKCBob3N0ICk7XG5cdFx0XHRcdC8vIEFsdGVybmF0aXZlbHkgKGRpcmVjdCB3aXJpbmcpOlxuXHRcdFx0XHQvLyBVSS5XUEJDX0JGQl9WYWx1ZVNsaWRlciAmJiBVSS5XUEJDX0JGQl9WYWx1ZVNsaWRlci5pbml0X29uICYmIFVJLldQQkNfQkZCX1ZhbHVlU2xpZGVyLmluaXRfb24oIGhvc3QgKTtcblx0XHRcdH0gY2F0Y2ggKCBfZSApIHt9XG5cblx0XHRcdC8vIEluc3BlY3RvciBtYXJrdXAgaXMgcmVwbGFjZWQgb24gZXZlcnkgcmVuZGVyLCBzbyBpbml0aWFsaXplIHRvb2x0aXBzIGZvciB0aGUgZnJlc2ggaGVscCBjb250cm9scy5cblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHcud3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMgKSB7XG5cdFx0XHRcdHcud3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMoICdbZGF0YS1iZmItc2xvdD1cImNvbHVtbl9zdHlsZXNcIl0gJyApO1xuXHRcdFx0fVxuXHJcblx0XHRcdC8vIFNldCBpbml0aWFsIHN0YXRlIG9mIElDT05TIChpbmNsdWRpbmcgZGVmYXVsdHMpIGlzIGNvcnJlY3QuXHJcblx0XHRcdHN5bmNfYXhpc19yb3RhdGlvbl9hbGwoKTtcclxuXHJcblx0XHRcdGZ1bmN0aW9uIHN0eWxlc19oYXNfYW55X25vbl9kZWZhdWx0KHN0eWxlc19hcnIsIGdldF9kZWZhdWx0c19vYmpfZm4pIHtcclxuXHRcdFx0XHR2YXIgZGVmID0gZ2V0X2RlZmF1bHRzX29ial9mbigpO1xyXG5cdFx0XHRcdGZvciAoIHZhciBpID0gMDsgaSA8IHN0eWxlc19hcnIubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0XHR2YXIgcyA9IHN0eWxlc19hcnJbaV0gfHwge307XHJcblx0XHRcdFx0XHRmb3IgKCB2YXIgayBpbiBkZWYgKSB7XHJcblx0XHRcdFx0XHRcdGlmICggT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBkZWYsIGsgKSApIHtcclxuXHRcdFx0XHRcdFx0XHR2YXIgdiA9IChzW2tdID09IG51bGwpID8gJycgOiBTdHJpbmcoIHNba10gKTtcclxuXHRcdFx0XHRcdFx0XHQvLyB0cmVhdCBlbXB0eSBhcyBcIm5vdCBzZWxlY3RlZFwiIChub3QgYWN0aXZlKS5cclxuXHRcdFx0XHRcdFx0XHRpZiAoIHYgJiYgdiAhPT0gU3RyaW5nKCBkZWZba10gKSApIHtcclxuXHRcdFx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGZ1bmN0aW9uIHN0cmlwX2RlZmF1bHRzX2Zvcl9zYXZlKHN0eWxlc19hcnIsIGdldF9kZWZhdWx0c19vYmpfZm4pIHtcclxuXHRcdFx0XHR2YXIgZGVmID0gZ2V0X2RlZmF1bHRzX29ial9mbigpO1xyXG5cdFx0XHRcdHZhciBvdXQgPSBbXTtcclxuXHRcdFx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBzdHlsZXNfYXJyLmxlbmd0aDsgaSsrICkge1xyXG5cdFx0XHRcdFx0dmFyIHMgICA9IHN0eWxlc19hcnJbaV0gfHwge307XHJcblx0XHRcdFx0XHR2YXIgcm93ID0ge307XHJcblx0XHRcdFx0XHRmb3IgKCB2YXIgayBpbiBkZWYgKSB7XHJcblx0XHRcdFx0XHRcdGlmICggT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBkZWYsIGsgKSApIHtcclxuXHRcdFx0XHRcdFx0XHR2YXIgdiA9IChzW2tdID09IG51bGwpID8gJycgOiBTdHJpbmcoIHNba10gKTtcclxuXHRcdFx0XHRcdFx0XHR2YXIga2VlcF9leHBsaWNpdF9kZWZhdWx0ID0gc2hvdWxkX2tlZXBfZXhwbGljaXRfZGVmYXVsdCggaywgcy5fX2hhcyApO1xuXHRcdFx0XHRcdFx0XHRpZiAoIHYgJiYgKCB2ICE9PSBTdHJpbmcoIGRlZltrXSApIHx8IGtlZXBfZXhwbGljaXRfZGVmYXVsdCApICkge1xuXHRcdFx0XHRcdFx0XHRcdHJvd1trXSA9IHY7IC8vIG9ubHkga2VlcCBtZWFuaW5nZnVsIG92ZXJyaWRlcy5cblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRvdXQucHVzaCggcm93ICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHJldHVybiBvdXQ7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8qKlxyXG5cdFx0XHQgKiBUb2dnbGUgcm90YXRpb24gY2xhc3MgZm9yIHRoZSBjaGlwIGxhYmVscyBvZiBhIHNwZWNpZmljIGNvbHVtbiBhbmQgZ3JvdXAgc2V0LlxyXG5cdFx0XHQgKlxyXG5cdFx0XHQgKiBAcGFyYW0ge251bWJlcn0gaWR4ICAgICAgQ29sdW1uIGluZGV4ICgwLWJhc2VkKVxyXG5cdFx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZSAgV2hldGhlciB0byBhZGQgKHRydWUpIG9yIHJlbW92ZSAoZmFsc2UpIHRoZSByb3RhdGlvbiBjbGFzc1xyXG5cdFx0XHQgKi9cclxuXHRcdFx0ZnVuY3Rpb24gdG9nZ2xlX2F4aXNfcm90YXRpb25fZm9yX2NvbCggaWR4LCBlbmFibGUgKSB7XHJcblx0XHRcdFx0dmFyIGtleXMgPSBbICdhaScsICdqYycgXTtcclxuXHRcdFx0XHRmb3IgKCB2YXIgZyA9IDA7IGcgPCBrZXlzLmxlbmd0aDsgZysrICkge1xyXG5cdFx0XHRcdFx0dmFyIHEgPSAnaW5wdXQuaW5zcGVjdG9yX19pbnB1dC53cGJjX3NyX29ubHlbZGF0YS1zdHlsZS1rZXk9XCInICsga2V5c1tnXSArICdcIl1bZGF0YS1jb2wtaWR4PVwiJyArIGlkeCArICdcIl0nO1xyXG5cdFx0XHRcdFx0dmFyIGlucHV0cyA9IGhvc3QucXVlcnlTZWxlY3RvckFsbCggcSApO1xyXG5cdFx0XHRcdFx0Zm9yICggdmFyIG4gPSAwOyBuIDwgaW5wdXRzLmxlbmd0aDsgbisrICkge1xyXG5cdFx0XHRcdFx0XHR2YXIgbGJsID0gaW5wdXRzW25dICYmIGlucHV0c1tuXS5uZXh0RWxlbWVudFNpYmxpbmc7XHJcblx0XHRcdFx0XHRcdGlmICggbGJsICYmIGxibC5jbGFzc0xpc3QgJiYgbGJsLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19jaGlwJyApICkge1xyXG5cdFx0XHRcdFx0XHRcdGlmICggZW5hYmxlICkge1xyXG5cdFx0XHRcdFx0XHRcdFx0bGJsLmNsYXNzTGlzdC5hZGQoICd3cGJjX2RvX3JvdGF0ZV85MCcgKTtcclxuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdFx0bGJsLmNsYXNzTGlzdC5yZW1vdmUoICd3cGJjX2RvX3JvdGF0ZV85MCcgKTtcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8qKlxyXG5cdFx0XHQgKiBBcHBseSByb3RhdGlvbiBjbGFzcyB0byAqYWxsKiBjb2x1bW5zLCB1c2luZyB0aGUgZWZmZWN0aXZlIGBkaXJgIHZhbHVlXHJcblx0XHRcdCAqIChzYXZlZCB2YWx1ZSBvciBkZWZhdWx0IGZyb20gQ09MX1BST1BTKS5cclxuXHRcdFx0ICovXHJcblx0XHRcdGZ1bmN0aW9uIHN5bmNfYXhpc19yb3RhdGlvbl9hbGwoKSB7XG5cdFx0XHRcdHZhciBkZWYgPSBnZXRfZGVmYXVsdHNfb2JqKCk7ICAvLyBpbmNsdWRlcyBkZWYuZGlyICh3aGljaCBpcyAnY29sdW1uJyBpbiB5b3VyIGNvZGUpLlxyXG5cdFx0XHRcdGZvciAoIHZhciBpID0gMDsgaSA8IHN0eWxlc19hcnIubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0XHR2YXIgZGlyX3ZhbCA9ICggc3R5bGVzX2FycltpXSAmJiBzdHlsZXNfYXJyW2ldLmRpciApID8gU3RyaW5nKCBzdHlsZXNfYXJyW2ldLmRpciApIDogU3RyaW5nKCBkZWYuZGlyICk7XHJcblx0XHRcdFx0XHR2YXIgZW5hYmxlICA9ICggZGlyX3ZhbCA9PT0gJ2NvbHVtbicgKTtcclxuXHRcdFx0XHRcdHRvZ2dsZV9heGlzX3JvdGF0aW9uX2Zvcl9jb2woIGksIGVuYWJsZSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxuXG5cdFx0XHQvKipcblx0XHRcdCAqIEFjdGl2YXRlIG9uZSBuZXN0ZWQgY29sdW1uLWNvbnRyb2wgdGFiIHdpdGhvdXQgYWZmZWN0aW5nIENvbHVtbiB0YWJzLlxuXHRcdFx0ICpcblx0XHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGNvbnRyb2xfcm9vdCBDb2x1bW4tY29udHJvbCB0YWIgZ3JvdXAgcm9vdC5cblx0XHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgICAgIHRhYl9rZXkgICAgICBUYWIga2V5IHRvIGFjdGl2YXRlLlxuXHRcdFx0ICogQHBhcmFtIHtib29sZWFufSAgICAgbW92ZV9mb2N1cyAgIFdoZXRoZXIgZm9jdXMgZm9sbG93cyBhY3RpdmF0aW9uLlxuXHRcdFx0ICogQHJldHVybnMge3ZvaWR9XG5cdFx0XHQgKi9cblx0XHRcdGZ1bmN0aW9uIGFjdGl2YXRlX2NvbHVtbl9jb250cm9sX3RhYiggY29udHJvbF9yb290LCB0YWJfa2V5LCBtb3ZlX2ZvY3VzICkge1xuXHRcdFx0XHRpZiAoICEgY29udHJvbF9yb290ICkgeyByZXR1cm47IH1cblxuXHRcdFx0XHR2YXIgY29udHJvbF90YWJzID0gY29udHJvbF9yb290LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS1jb2x1bW4tY29udHJvbC10YWIta2V5XScgKTtcblx0XHRcdFx0dmFyIGNvbnRyb2xfcGFuZWxzID0gY29udHJvbF9yb290LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS1jb2x1bW4tY29udHJvbC10YWItcGFuZWxdJyApO1xuXHRcdFx0XHR2YXIgYWN0aXZlX3RhYiA9IG51bGw7XG5cblx0XHRcdFx0Zm9yICggdmFyIHRhYl9pbmRleCA9IDA7IHRhYl9pbmRleCA8IGNvbnRyb2xfdGFicy5sZW5ndGg7IHRhYl9pbmRleCsrICkge1xuXHRcdFx0XHRcdHZhciBjb250cm9sX3RhYiA9IGNvbnRyb2xfdGFic1sgdGFiX2luZGV4IF07XG5cdFx0XHRcdFx0dmFyIHRhYl9pc19hY3RpdmUgPSBjb250cm9sX3RhYi5nZXRBdHRyaWJ1dGUoICdkYXRhLWNvbHVtbi1jb250cm9sLXRhYi1rZXknICkgPT09IHRhYl9rZXk7XG5cdFx0XHRcdFx0Y29udHJvbF90YWIuc2V0QXR0cmlidXRlKCAnYXJpYS1zZWxlY3RlZCcsIHRhYl9pc19hY3RpdmUgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0XHRcdFx0Y29udHJvbF90YWIuc2V0QXR0cmlidXRlKCAndGFiaW5kZXgnLCB0YWJfaXNfYWN0aXZlID8gJzAnIDogJy0xJyApO1xuXHRcdFx0XHRcdGlmICggdGFiX2lzX2FjdGl2ZSApIHtcblx0XHRcdFx0XHRcdGFjdGl2ZV90YWIgPSBjb250cm9sX3RhYjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmb3IgKCB2YXIgcGFuZWxfaW5kZXggPSAwOyBwYW5lbF9pbmRleCA8IGNvbnRyb2xfcGFuZWxzLmxlbmd0aDsgcGFuZWxfaW5kZXgrKyApIHtcblx0XHRcdFx0XHR2YXIgY29udHJvbF9wYW5lbCA9IGNvbnRyb2xfcGFuZWxzWyBwYW5lbF9pbmRleCBdO1xuXHRcdFx0XHRcdGlmICggY29udHJvbF9wYW5lbC5nZXRBdHRyaWJ1dGUoICdkYXRhLWNvbHVtbi1jb250cm9sLXRhYi1wYW5lbCcgKSA9PT0gdGFiX2tleSApIHtcblx0XHRcdFx0XHRcdGNvbnRyb2xfcGFuZWwucmVtb3ZlQXR0cmlidXRlKCAnaGlkZGVuJyApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjb250cm9sX3BhbmVsLnNldEF0dHJpYnV0ZSggJ2hpZGRlbicsICcnICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29udHJvbF9yb290LnNldEF0dHJpYnV0ZSggJ2RhdGEtY29sdW1uLWNvbnRyb2wtdGFiLWFjdGl2ZScsIHRhYl9rZXkgKTtcblx0XHRcdFx0aWYgKCBtb3ZlX2ZvY3VzICYmIGFjdGl2ZV90YWIgJiYgYWN0aXZlX3RhYi5mb2N1cyApIHtcblx0XHRcdFx0XHRhY3RpdmVfdGFiLmZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0LyoqXG5cdFx0XHQgKiBSZW1lbWJlciBvbmUgbmVzdGVkIHRhYiBzZWxlY3Rpb24gZm9yIHRoZSBjdXJyZW50IEluc3BlY3RvciBtb3VudC5cblx0XHRcdCAqXG5cdFx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjb250cm9sX3Jvb3QgQ29sdW1uLWNvbnRyb2wgdGFiIGdyb3VwIHJvb3QuXG5cdFx0XHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICB0YWJfa2V5ICAgICAgU2VsZWN0ZWQgdGFiIGtleS5cblx0XHRcdCAqIEByZXR1cm5zIHt2b2lkfVxuXHRcdFx0ICovXG5cdFx0XHRmdW5jdGlvbiByZW1lbWJlcl9jb2x1bW5fY29udHJvbF90YWIoIGNvbnRyb2xfcm9vdCwgdGFiX2tleSApIHtcblx0XHRcdFx0dmFyIGNvbnRyb2xfY29sdW1uID0gKCBwYXJzZUludCggY29udHJvbF9yb290LmdldEF0dHJpYnV0ZSggJ2RhdGEtY29sLWlkeCcgKSwgMTAgKSB8fCAwICkgKyAxO1xuXHRcdFx0XHR2YXIgY29udHJvbF9ncm91cCA9IGNvbnRyb2xfcm9vdC5nZXRBdHRyaWJ1dGUoICdkYXRhLWNvbHVtbi1jb250cm9sLXRhYnMnICkgfHwgJyc7XG5cdFx0XHRcdGlmICggY29udHJvbF9ncm91cCApIHtcblx0XHRcdFx0XHRjb2x1bW5fY29udHJvbF90YWJfc3RhdGVbIGNvbnRyb2xfY29sdW1uICsgJ18nICsgY29udHJvbF9ncm91cCBdID0gdGFiX2tleTtcblx0XHRcdFx0XHRob3N0Ll9fd3BiY19jb2x1bW5fY29udHJvbF90YWJfc3RhdGUgPSBjb2x1bW5fY29udHJvbF90YWJfc3RhdGU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0LyoqXG5cdFx0XHQgKiBSZWZsZWN0IHdoZXRoZXIgYSBuZXN0ZWQgdGFiIG93bnMgYW55IG5vbi1kZWZhdWx0IHN0eWxlIHZhbHVlLlxuXHRcdFx0ICpcblx0XHRcdCAqIEBwYXJhbSB7bnVtYmVyfSAgICAgICAgICAgICAgICAgY29sdW1uX2luZGV4IFplcm8tYmFzZWQgY29sdW1uIGluZGV4LlxuXHRcdFx0ICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICBzdHlsZV9rZXkgICBDaGFuZ2VkIHN0eWxlIGtleS5cblx0XHRcdCAqIEBwYXJhbSB7UmVjb3JkPHN0cmluZywgc3RyaW5nPn0gc3R5bGVfb2JqZWN0IEN1cnJlbnQgZnVsbCBjb2x1bW4gc3R5bGVzLlxuXHRcdFx0ICogQHJldHVybnMge3ZvaWR9XG5cdFx0XHQgKi9cblx0XHRcdGZ1bmN0aW9uIHN5bmNfY29sdW1uX2NvbnRyb2xfdGFiX21hcmtlciggY29sdW1uX2luZGV4LCBzdHlsZV9rZXksIHN0eWxlX29iamVjdCApIHtcblx0XHRcdFx0aWYgKCAhIGlzX3N1cHBvcnRlZF9rZXkoIHN0eWxlX2tleSApICkgeyByZXR1cm47IH1cblxuXHRcdFx0XHR2YXIgY29udHJvbF90YWJzID0gaG9zdC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtY29sdW1uLWNvbnRyb2wtdGFiLXN0eWxlLWtleXN+PVwiJyArIHN0eWxlX2tleSArICdcIl1bZGF0YS1jb2wtaWR4PVwiJyArIGNvbHVtbl9pbmRleCArICdcIl0nICk7XG5cdFx0XHRcdGZvciAoIHZhciBjb250cm9sX3RhYl9pbmRleCA9IDA7IGNvbnRyb2xfdGFiX2luZGV4IDwgY29udHJvbF90YWJzLmxlbmd0aDsgY29udHJvbF90YWJfaW5kZXgrKyApIHtcblx0XHRcdFx0XHR2YXIgY29udHJvbF90YWIgPSBjb250cm9sX3RhYnNbIGNvbnRyb2xfdGFiX2luZGV4IF07XG5cdFx0XHRcdFx0dmFyIG93bmVkX3N0eWxlX2tleXMgPSBTdHJpbmcoIGNvbnRyb2xfdGFiLmdldEF0dHJpYnV0ZSggJ2RhdGEtY29sdW1uLWNvbnRyb2wtdGFiLXN0eWxlLWtleXMnICkgfHwgJycgKS5zcGxpdCggL1xccysvICk7XG5cdFx0XHRcdFx0dmFyIGNvbnRyb2xfaXNfY2hhbmdlZCA9IGZhbHNlO1xuXG5cdFx0XHRcdFx0Zm9yICggdmFyIG93bmVkX2tleV9pbmRleCA9IDA7IG93bmVkX2tleV9pbmRleCA8IG93bmVkX3N0eWxlX2tleXMubGVuZ3RoOyBvd25lZF9rZXlfaW5kZXgrKyApIHtcblx0XHRcdFx0XHRcdHZhciBvd25lZF9zdHlsZV9rZXkgPSBvd25lZF9zdHlsZV9rZXlzWyBvd25lZF9rZXlfaW5kZXggXTtcblx0XHRcdFx0XHRcdGlmICggaXNfc3VwcG9ydGVkX2tleSggb3duZWRfc3R5bGVfa2V5ICkgJiYgbm9ybWFsaXplX3ZhbHVlKCBvd25lZF9zdHlsZV9rZXksIHN0eWxlX29iamVjdFsgb3duZWRfc3R5bGVfa2V5IF0gKSAhPT0gQ09MX1BST1BTWyBvd25lZF9zdHlsZV9rZXkgXS5kZWYgKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnRyb2xfaXNfY2hhbmdlZCA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHZhciBjb250cm9sX21hcmtlciA9IGNvbnRyb2xfdGFiLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1jb2x1bW4tY29udHJvbC10YWItbWFya2VyXScgKTtcblx0XHRcdFx0XHR2YXIgY29udHJvbF9jaGFuZ2VkX3RleHQgPSBjb250cm9sX3RhYi5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtY29sdW1uLWNvbnRyb2wtdGFiLWNoYW5nZWQtdGV4dF0nICk7XG5cdFx0XHRcdFx0Y29udHJvbF90YWIuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWNoYW5nZWQnLCBjb250cm9sX2lzX2NoYW5nZWQgKTtcblx0XHRcdFx0XHRpZiAoIGNvbnRyb2xfbWFya2VyICkgeyBjb250cm9sX21hcmtlci5oaWRkZW4gPSAhIGNvbnRyb2xfaXNfY2hhbmdlZDsgfVxuXHRcdFx0XHRcdGlmICggY29udHJvbF9jaGFuZ2VkX3RleHQgKSB7IGNvbnRyb2xfY2hhbmdlZF90ZXh0LmhpZGRlbiA9ICEgY29udHJvbF9pc19jaGFuZ2VkOyB9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxyXG5cdFx0XHQvLyBEZWxheSAobXMpIGZvciBkZWZlcnJlZCBVSSB1cGRhdGVzIGFmdGVyIGNoYW5naW5nIGxheW91dCBjb21iby5cclxuXHRcdFx0dmFyIHJlcmVuZGVyX2RlbGF5X21zID0gNDIwO1xyXG5cclxuXHRcdFx0LyoqXHJcblx0XHRcdCAqIFNjaGVkdWxlIGljb24gcm90YXRpb24gKyByZS1yZW5kZXIgd2l0aCBvcHRpb25hbCBpbW1lZGlhdGUgcm90YXRpb24uXHJcblx0XHRcdCAqXHJcblx0XHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBjb2xfaWR4ICAgICAgICAgICAgMC1iYXNlZCBjb2x1bW4gaW5kZXhcclxuXHRcdFx0ICogQHBhcmFtIHtzdHJpbmd9IG5ld19kaXIgICAgICAgICAgICBcInJvd1wiIHwgXCJjb2x1bW5cIlxyXG5cdFx0XHQgKiBAcGFyYW0ge3tkZWxheT86bnVtYmVyLCByb3RhdGVfbm93Pzpib29sZWFufX0gW29wdHNdXHJcblx0XHRcdCAqL1xyXG5cdFx0XHRmdW5jdGlvbiBzY2hlZHVsZV9yZXJlbmRlcihjb2xfaWR4LCBuZXdfZGlyLCBvcHRzKSB7XHJcblx0XHRcdFx0b3B0cyAgICAgID0gb3B0cyB8fCB7fTtcclxuXHRcdFx0XHR2YXIgZGVsYXkgPSAodHlwZW9mIG9wdHMuZGVsYXkgPT09ICdudW1iZXInKSA/IG9wdHMuZGVsYXkgOiByZXJlbmRlcl9kZWxheV9tcztcclxuXHJcblx0XHRcdFx0Ly8gQXZvaWQgc3RhY2tlZCB0aW1lcnMgaWYgdGhlIHVzZXIgY2xpY2tzIHF1aWNrbHkuXHJcblx0XHRcdFx0aWYgKCBob3N0Ll9fcmVyZW5kZXJfdGltZXIgKSB7XHJcblx0XHRcdFx0XHRjbGVhclRpbWVvdXQoIGhvc3QuX19yZXJlbmRlcl90aW1lciApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gT3B0aW9uYWwgaW1tZWRpYXRlIGZlZWRiYWNrICh1c2VkIGJ5IHBsYWluIFwiZGlyXCIgcmFkaW9zKS5cclxuXHRcdFx0XHRpZiAoIG9wdHMucm90YXRlX25vdyApIHtcclxuXHRcdFx0XHRcdHRvZ2dsZV9heGlzX3JvdGF0aW9uX2Zvcl9jb2woIGNvbF9pZHgsIFN0cmluZyggbmV3X2RpciApID09PSAnY29sdW1uJyApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aG9zdC5fX3JlcmVuZGVyX3RpbWVyID0gc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0Ly8gSWYgd2UgZGlkbid0IHJvdGF0ZSBpbW1lZGlhdGVseSwgZG8gaXQgbm93ICh1c2VkIGJ5IGNvbWJvKS5cclxuXHRcdFx0XHRcdGlmICggISBvcHRzLnJvdGF0ZV9ub3cgKSB7XHJcblx0XHRcdFx0XHRcdHRvZ2dsZV9heGlzX3JvdGF0aW9uX2Zvcl9jb2woIGNvbF9pZHgsIFN0cmluZyggbmV3X2RpciApID09PSAnY29sdW1uJyApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0VUkud3BiY19iZmJfY29sdW1uX3N0eWxlcy5yZW5kZXJfZm9yX3NlY3Rpb24oIGJ1aWxkZXIsIHNlY3Rpb25fZWwsIGhvc3QgKTtcclxuXHRcdFx0XHRcdGhvc3QuX19yZXJlbmRlcl90aW1lciA9IG51bGw7XHJcblx0XHRcdFx0fSwgZGVsYXkgKTtcclxuXHRcdFx0fVxyXG5cclxuXHJcblx0XHRcdGZ1bmN0aW9uIGNvbW1pdChidWlsZGVyLCBzZWN0aW9uX2VsLCBzdHlsZXNfYXJyKSB7XG5cdFx0XHRcdC8vIERlY2lkZSBhY3RpdmF0aW9uLlxuXHRcdFx0XHR2YXIgc2hvdWxkX2FjdGl2YXRlID0gc3R5bGVzX2hhc19hbnlfbm9uX2RlZmF1bHQoIHN0eWxlc19hcnIsIGdldF9kZWZhdWx0c19vYmogKTtcblx0XHRcdFx0aWYgKCBzaG91bGRfYWN0aXZhdGUgKSB7XG5cdFx0XHRcdFx0c2VjdGlvbl9lbC5zZXRBdHRyaWJ1dGUoICdkYXRhLWNvbHN0eWxlcy1hY3RpdmUnLCAnMScgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRzZWN0aW9uX2VsLnJlbW92ZUF0dHJpYnV0ZSggJ2RhdGEtY29sc3R5bGVzLWFjdGl2ZScgKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIE5vcm1hbGl6ZSBsZW5ndGggdG8gY3VycmVudCBudW1iZXIgb2YgY29sdW1ucyAoa2VlcHMgYXR0cmlidXRlIHRpZHkpLlxyXG5cdFx0XHRcdHN0eWxlc19hcnIubGVuZ3RoID0gZG9tX2NvbHMoIHNlY3Rpb25fZWwgKTtcclxuXHJcblx0XHRcdFx0Ly8gUGVyc2lzdCBtaW5pbWFsIEpTT04gKG9taXQgZGVmYXVsdHMvZW1wdGllcykuXHJcblx0XHRcdFx0dmFyIHNhdmVfYXJyID0gc3RyaXBfZGVmYXVsdHNfZm9yX3NhdmUoIHN0eWxlc19hcnIsIGdldF9kZWZhdWx0c19vYmogKTtcclxuXHRcdFx0XHR2YXIganNvbiAgICAgPSBVSS5XUEJDX0JGQl9Db2x1bW5fU3R5bGVzLnN0cmluZ2lmeV9jb2xfc3R5bGVzKCBzYXZlX2FyciApO1xyXG5cdFx0XHRcdHNlY3Rpb25fZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1jb2xfc3R5bGVzJywganNvbiApO1xyXG5cdFx0XHRcdGlmICggc2VjdGlvbl9lbC5kYXRhc2V0ICkge1xyXG5cdFx0XHRcdFx0c2VjdGlvbl9lbC5kYXRhc2V0LmNvbF9zdHlsZXMgPSBqc29uO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gTGl2ZSBwcmV2aWV3IChtaW5pICsgZ2F0ZWQgcmVhbCBjb2x1bW5zKS5cclxuXHRcdFx0XHRVSS5XUEJDX0JGQl9Db2x1bW5fU3R5bGVzLmFwcGx5KCBzZWN0aW9uX2VsLCBzdHlsZXNfYXJyICk7XHJcblxyXG5cdFx0XHRcdC8vIE5vdGlmeSBsaXN0ZW5lcnMuXHJcblx0XHRcdFx0aWYgKCBidWlsZGVyICYmIGJ1aWxkZXIuYnVzICYmIENvcmUuV1BCQ19CRkJfRXZlbnRzICkge1xyXG5cdFx0XHRcdFx0YnVpbGRlci5idXMuZW1pdCAmJiBidWlsZGVyLmJ1cy5lbWl0KCBDb3JlLldQQkNfQkZCX0V2ZW50cy5TVFJVQ1RVUkVfQ0hBTkdFLCB7XHJcblx0XHRcdFx0XHRcdHNvdXJjZTogJ2NvbHVtbl9zdHlsZXMnLFxyXG5cdFx0XHRcdFx0XHRmaWVsZCA6IHNlY3Rpb25fZWxcclxuXHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblxyXG5cdFx0XHRmdW5jdGlvbiBvbl9jaGFuZ2UoIGUgKSB7XG5cdFx0XHRcdHZhciB0ICAgPSBlLnRhcmdldDtcclxuXHRcdFx0XHQvLyBSYWRpb3MgZmlyZSBib3RoICdpbnB1dCcgYW5kICdjaGFuZ2UnIGluIG1vc3QgYnJvd3NlcnMuXHJcbiAgXHRcdFx0XHRpZiAodCAmJiB0LnR5cGUgPT09ICdyYWRpbycgJiYgZS50eXBlID09PSAnaW5wdXQnKSByZXR1cm47XHJcblxyXG5cdFx0XHRcdHZhciBrZXkgPSB0ICYmIHQuZ2V0QXR0cmlidXRlKCAnZGF0YS1zdHlsZS1rZXknICk7XHJcblx0XHRcdFx0aWYgKCAhIGtleSB8fCAoICEgaXNfc3VwcG9ydGVkX2tleSgga2V5ICkgJiYga2V5ICE9PSAnbGF5b3V0X2NvbWJvJyApICkgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdFx0dmFyIGlkeCA9IHBhcnNlSW50KCB0LmdldEF0dHJpYnV0ZSggJ2RhdGEtY29sLWlkeCcgKSwgMTAgKSB8fCAwO1xyXG5cclxuXHRcdFx0XHQvLyBsYXlvdXRfY29tYm86IGNvbW1pdCBub3csIHJvdGF0ZSArIHJlLXJlbmRlciBsYXRlciAobm8gaW1tZWRpYXRlIGljb24gY2hhbmdlKS5cclxuXHRcdFx0XHRpZiAoIGtleSA9PT0gJ2xheW91dF9jb21ibycgKSB7XHJcblx0XHRcdFx0XHR2YXIgcGFydHMgPSBTdHJpbmcoIHQudmFsdWUgfHwgJycgKS5zcGxpdCggJ3wnICk7XHJcblx0XHRcdFx0XHR2YXIgZGlyICAgPSBwYXJ0c1swXSB8fCAncm93JztcclxuXHRcdFx0XHRcdHZhciB3cmFwICA9IHBhcnRzWzFdIHx8ICdub3dyYXAnO1xyXG5cclxuXHRcdFx0XHRcdHN0eWxlc19hcnJbaWR4XS5kaXIgID0gbm9ybWFsaXplX3ZhbHVlKCAnZGlyJywgZGlyICk7XHJcblx0XHRcdFx0XHRzdHlsZXNfYXJyW2lkeF0ud3JhcCA9IG5vcm1hbGl6ZV92YWx1ZSggJ3dyYXAnLCB3cmFwICk7XHJcblx0XHRcdFx0XHRjb21taXQoIGJ1aWxkZXIsIHNlY3Rpb25fZWwsIHN0eWxlc19hcnIgKTtcclxuXHJcblx0XHRcdFx0XHRzY2hlZHVsZV9yZXJlbmRlciggaWR4LCBzdHlsZXNfYXJyW2lkeF0uZGlyLCB7IHJvdGF0ZV9ub3c6IHRydWUsIGRlbGF5OiByZXJlbmRlcl9kZWxheV9tcyB9ICk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBDb21iaW5lIGV2ZXJ5IHJlZ2lzdGVyZWQgc3BsaXQgbGVuZ3RoIGNvbnRyb2wgYmVmb3JlIG5vcm1hbGl6aW5nIGl0LlxuXHRcdFx0XHR2YXIgc3BsaXRfbm9ybWFsaXplciA9IENPTF9QUk9QU1sga2V5IF0gJiYgQ09MX1BST1BTWyBrZXkgXS5ub3JtYWxpemU7XG5cdFx0XHRcdGlmICggdC5oYXNBdHRyaWJ1dGUoICdkYXRhLXN0eWxlLXBhcnQnICkgJiYgKCAnbGVuJyA9PT0gc3BsaXRfbm9ybWFsaXplciB8fCAnbWF4X2xlbicgPT09IHNwbGl0X25vcm1hbGl6ZXIgKSApIHtcblx0XHRcdFx0XHR2YXIgbnVtRWwgICAgICAgICAgID0gaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtc3R5bGUta2V5PVwiJyArIGtleSArICdcIl1bZGF0YS1zdHlsZS1wYXJ0PVwidmFsdWVcIl1bZGF0YS1jb2wtaWR4PVwiJyArIGlkeCArICdcIl0nICk7XG5cdFx0XHRcdFx0dmFyIHVuaXRFbCAgICAgICAgICA9IGhvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXN0eWxlLWtleT1cIicgKyBrZXkgKyAnXCJdW2RhdGEtc3R5bGUtcGFydD1cInVuaXRcIl1bZGF0YS1jb2wtaWR4PVwiJyArIGlkeCArICdcIl0nICk7XG5cdFx0XHRcdFx0dmFyIG51bSAgICAgICAgICAgICA9IG51bUVsID8gU3RyaW5nKCBudW1FbC52YWx1ZSB8fCAnJyApLnRyaW0oKSA6ICcnO1xuXHRcdFx0XHRcdHZhciB1bml0ICAgICAgICAgICAgPSB1bml0RWwgPyBTdHJpbmcoIHVuaXRFbC52YWx1ZSB8fCAncHgnICkudHJpbSgpIDogJ3B4Jztcblx0XHRcdFx0XHR2YXIgcmF3ICAgICAgICAgICAgID0gbnVtID8gKCBudW0gKyB1bml0ICkgOiAnJztcblx0XHRcdFx0XHRzdHlsZXNfYXJyW2lkeF1ba2V5XSA9IG5vcm1hbGl6ZV92YWx1ZSgga2V5LCByYXcgKTtcblx0XHRcdFx0XHRpZiAoIHN0eWxlc19hcnJbaWR4XS5fX2hhcyApIHtcblx0XHRcdFx0XHRcdHN0eWxlc19hcnJbaWR4XS5fX2hhc1trZXldID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cHJvbW90ZV9ib3hfc2lkZXNfdG9fZXhwbGljaXQoIHN0eWxlc19hcnJbaWR4XSwga2V5ICk7XG5cdFx0XHRcdFx0Y29tbWl0KCBidWlsZGVyLCBzZWN0aW9uX2VsLCBzdHlsZXNfYXJyICk7XG5cdFx0XHRcdFx0c3luY19jb2x1bW5fY29udHJvbF90YWJfbWFya2VyKCBpZHgsIGtleSwgc3R5bGVzX2FycltpZHhdICk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIGRpcjogY29tbWl0IG5vdywgcm90YXRlIGltbWVkaWF0ZWx5IGZvciBzbmFwcHkgZmVlZGJhY2ssIHN0aWxsIHJlLXJlbmRlciBhZnRlciBkZWxheS5cclxuXHRcdFx0XHRpZiAoIGtleSA9PT0gJ2RpcicgKSB7XHJcblx0XHRcdFx0XHRzdHlsZXNfYXJyW2lkeF0uZGlyID0gbm9ybWFsaXplX3ZhbHVlKCAnZGlyJywgdC52YWx1ZSApO1xyXG5cdFx0XHRcdFx0Y29tbWl0KCBidWlsZGVyLCBzZWN0aW9uX2VsLCBzdHlsZXNfYXJyICk7XHJcblxyXG5cdFx0XHRcdFx0c2NoZWR1bGVfcmVyZW5kZXIoIGlkeCwgc3R5bGVzX2FycltpZHhdLmRpciwgeyByb3RhdGVfbm93OiB0cnVlLCBkZWxheTogcmVyZW5kZXJfZGVsYXlfbXMgfSApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gRGVmYXVsdCBicmFuY2ggKHVuY2hhbmdlZCkuXG5cdFx0XHRcdHN0eWxlc19hcnJbaWR4XVtrZXldID0gbm9ybWFsaXplX3ZhbHVlKCBrZXksIHQudmFsdWUgKTtcblx0XHRcdFx0aWYgKCBzdHlsZXNfYXJyW2lkeF0uX19oYXMgKSB7XG5cdFx0XHRcdFx0c3R5bGVzX2FycltpZHhdLl9faGFzW2tleV0gPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggT1ZFUkZMT1dfQVhJU19LRVlTLmluZGV4T2YoIGtleSApICE9PSAtMSApIHtcblx0XHRcdFx0XHRwcm9tb3RlX292ZXJmbG93X2F4ZXNfdG9fZXhwbGljaXQoIHN0eWxlc19hcnJbaWR4XSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbW1pdCggYnVpbGRlciwgc2VjdGlvbl9lbCwgc3R5bGVzX2FyciApO1xuXHRcdFx0XHRzeW5jX2NvbHVtbl9jb250cm9sX3RhYl9tYXJrZXIoIGlkeCwga2V5LCBzdHlsZXNfYXJyW2lkeF0gKTtcblx0XHRcdH1cblxuXHRcdFx0LyoqXG5cdFx0XHQgKiBSZXNldCBhbiBhbGxvd2xpc3RlZCBzdWJzZXQgb2Ygb25lIGNvbHVtbiBzdHlsZSBvYmplY3QgdG8gcmVnaXN0ZXJlZCBkZWZhdWx0cy5cblx0XHRcdCAqXG5cdFx0XHQgKiBMZWdhY3kgc2hvcnRoYW5kIHZhbHVlcyBhcmUgcHJvbW90ZWQgYmVmb3JlIHRoZSByZXNldCBzbyBjbGVhcmluZyBvbmUgc2lkZVxuXHRcdFx0ICogb3Igb3ZlcmZsb3cgYXhpcyBjYW5ub3Qgc2lsZW50bHkgY2hhbmdlIGl0cyBzaWJsaW5ncy4gVGhlIHJlc2V0IGtleXMgYXJlXG5cdFx0XHQgKiBtYXJrZWQgYWJzZW50IHNvIHNwYXJzZSBwZXJzaXN0ZW5jZSBmYWxscyBiYWNrIHRvIHRoZSBjYW5vbmljYWwgZGVmYXVsdHMuXG5cdFx0XHQgKlxuXHRcdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcmVzZXRfY29udHJvbCBSZXNldCBsaW5rIGNhcnJ5aW5nIGNvbHVtbiBhbmQga2V5IG1ldGFkYXRhLlxuXHRcdFx0ICogQHJldHVybnMge2Jvb2xlYW59IFdoZXRoZXIgYSBzdXBwb3J0ZWQgc3R5bGUgc3Vic2V0IHdhcyByZXNldC5cblx0XHRcdCAqL1xuXHRcdFx0ZnVuY3Rpb24gcmVzZXRfY29sdW1uX3N0eWxlX2tleXMoIHJlc2V0X2NvbnRyb2wgKSB7XG5cdFx0XHRcdHZhciBjb2x1bW5faW5kZXggPSBwYXJzZUludCggcmVzZXRfY29udHJvbC5nZXRBdHRyaWJ1dGUoICdkYXRhLWNvbC1pZHgnICksIDEwICk7XG5cdFx0XHRcdHZhciByZXF1ZXN0ZWRfa2V5cyA9IFN0cmluZyggcmVzZXRfY29udHJvbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXN0eWxlLWtleXMnICkgfHwgJycgKS5zcGxpdCggL1xccysvICk7XG5cblx0XHRcdFx0aWYgKCBpc05hTiggY29sdW1uX2luZGV4ICkgfHwgY29sdW1uX2luZGV4IDwgMCB8fCBjb2x1bW5faW5kZXggPj0gc3R5bGVzX2Fyci5sZW5ndGggKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dmFyIHN0eWxlX29iamVjdCA9IHN0eWxlc19hcnJbIGNvbHVtbl9pbmRleCBdO1xuXHRcdFx0XHR2YXIgc3R5bGVfa2V5cyA9IFVJLldQQkNfQkZCX0NvbHVtbl9TdHlsZXMucmVzZXRfc3R5bGVfa2V5cyggc3R5bGVfb2JqZWN0LCByZXF1ZXN0ZWRfa2V5cyApO1xuXHRcdFx0XHRpZiAoICEgc3R5bGVfa2V5cy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dmFyIGZvY3VzX3NlbGVjdG9yID0gJ1tkYXRhLWFjdGlvbj1cImNvbHN0eWxlcy1yZXNldC1rZXlzXCJdW2RhdGEtY29sLWlkeD1cIicgKyBjb2x1bW5faW5kZXggKyAnXCJdW2RhdGEtc3R5bGUta2V5cz1cIicgKyBzdHlsZV9rZXlzLmpvaW4oICcgJyApICsgJ1wiXSc7XG5cdFx0XHRcdGNvbW1pdCggYnVpbGRlciwgc2VjdGlvbl9lbCwgc3R5bGVzX2FyciApO1xuXHRcdFx0XHRVSS53cGJjX2JmYl9jb2x1bW5fc3R5bGVzLnJlbmRlcl9mb3Jfc2VjdGlvbiggYnVpbGRlciwgc2VjdGlvbl9lbCwgaG9zdCApO1xuXG5cdFx0XHRcdHZhciByZXN0b3JlZF9jb250cm9sID0gaG9zdC5xdWVyeVNlbGVjdG9yKCBmb2N1c19zZWxlY3RvciApO1xuXHRcdFx0XHRpZiAoIHJlc3RvcmVkX2NvbnRyb2wgJiYgcmVzdG9yZWRfY29udHJvbC5mb2N1cyApIHtcblx0XHRcdFx0XHRyZXN0b3JlZF9jb250cm9sLmZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblxuXHRcdFx0ZnVuY3Rpb24gb25fY2xpY2soIGUgKSB7XG5cdFx0XHRcdHZhciBjb250cm9sX3RhYiA9IGUudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS1jb2x1bW4tY29udHJvbC10YWIta2V5XScgKTtcblx0XHRcdFx0aWYgKCBjb250cm9sX3RhYiAmJiBob3N0LmNvbnRhaW5zKCBjb250cm9sX3RhYiApICkge1xuXHRcdFx0XHRcdHZhciBjb250cm9sX3Jvb3QgPSBjb250cm9sX3RhYi5jbG9zZXN0KCAnW2RhdGEtY29sdW1uLWNvbnRyb2wtdGFic10nICk7XG5cdFx0XHRcdFx0dmFyIGNvbnRyb2xfdGFiX2tleSA9IGNvbnRyb2xfdGFiLmdldEF0dHJpYnV0ZSggJ2RhdGEtY29sdW1uLWNvbnRyb2wtdGFiLWtleScgKSB8fCAnJztcblx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0YWN0aXZhdGVfY29sdW1uX2NvbnRyb2xfdGFiKCBjb250cm9sX3Jvb3QsIGNvbnRyb2xfdGFiX2tleSwgZmFsc2UgKTtcblx0XHRcdFx0XHRyZW1lbWJlcl9jb2x1bW5fY29udHJvbF90YWIoIGNvbnRyb2xfcm9vdCwgY29udHJvbF90YWJfa2V5ICk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dmFyIHByb3BlcnR5X3Jlc2V0ID0gZS50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLWFjdGlvbj1cImNvbHN0eWxlcy1yZXNldC1rZXlzXCJdJyApO1xuXHRcdFx0XHRpZiAoIHByb3BlcnR5X3Jlc2V0ICYmIGhvc3QuY29udGFpbnMoIHByb3BlcnR5X3Jlc2V0ICkgKSB7XG5cdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdHJlc2V0X2NvbHVtbl9zdHlsZV9rZXlzKCBwcm9wZXJ0eV9yZXNldCApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHZhciBidG4gPSBlLnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtYWN0aW9uPVwiY29sc3R5bGVzLXJlc2V0XCJdJyApO1xuXHRcdFx0XHRpZiAoICEgYnRuICkgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdFx0Ly8gQ2xlYXIgZGF0YXNldCArIGFjdGl2YXRpb24gZmxhZyBhbmQgcmVtb3ZlIGlubGluZSB2YXJzXHJcblx0XHRcdFx0c2VjdGlvbl9lbC5yZW1vdmVBdHRyaWJ1dGUoICdkYXRhLWNvbHN0eWxlcy1hY3RpdmUnICk7XHJcblx0XHRcdFx0c2VjdGlvbl9lbC5yZW1vdmVBdHRyaWJ1dGUoICdkYXRhLWNvbF9zdHlsZXMnICk7XHJcblx0XHRcdFx0aWYgKCBzZWN0aW9uX2VsLmRhdGFzZXQgKSB7IGRlbGV0ZSBzZWN0aW9uX2VsLmRhdGFzZXQuY29sX3N0eWxlczsgfVxyXG5cclxuXHRcdFx0XHRVSS5XUEJDX0JGQl9Db2x1bW5fU3R5bGVzLmFwcGx5KCBzZWN0aW9uX2VsLCBbXSApO1xyXG5cclxuXHRcdFx0XHQvLyBSZS1yZW5kZXIgZnJlc2gsIG5vdCBwZXJzaXN0ZWRcclxuXHRcdFx0XHRVSS53cGJjX2JmYl9jb2x1bW5fc3R5bGVzLnJlbmRlcl9mb3Jfc2VjdGlvbiggYnVpbGRlciwgc2VjdGlvbl9lbCwgaG9zdCApO1xyXG5cclxuXHRcdFx0XHRpZiAoIGJ1aWxkZXIgJiYgYnVpbGRlci5idXMgJiYgQ29yZS5XUEJDX0JGQl9FdmVudHMgKSB7XHJcblx0XHRcdFx0XHRidWlsZGVyLmJ1cy5lbWl0ICYmIGJ1aWxkZXIuYnVzLmVtaXQoIENvcmUuV1BCQ19CRkJfRXZlbnRzLlNUUlVDVFVSRV9DSEFOR0UsIHsgc291cmNlIDogJ2NvbHVtbl9zdHlsZXNfcmVzZXQnLCBmaWVsZCA6IHNlY3Rpb25fZWwgfSApO1xyXG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0LyoqXG5cdFx0XHQgKiBOYXZpZ2F0ZSBvbmUgbmVzdGVkIGNvbHVtbi1jb250cm9sIHRhYiBsaXN0IHdpdGggdGhlIGtleWJvYXJkLlxuXHRcdFx0ICpcblx0XHRcdCAqIEBwYXJhbSB7S2V5Ym9hcmRFdmVudH0gZSBJbnNwZWN0b3Iga2V5ZG93biBldmVudC5cblx0XHRcdCAqIEByZXR1cm5zIHt2b2lkfVxuXHRcdFx0ICovXG5cdFx0XHRmdW5jdGlvbiBvbl9rZXlkb3duKCBlICkge1xuXHRcdFx0XHR2YXIgY29udHJvbF90YWIgPSBlLnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtY29sdW1uLWNvbnRyb2wtdGFiLWtleV0nICk7XG5cdFx0XHRcdGlmICggISBjb250cm9sX3RhYiB8fCAhIGhvc3QuY29udGFpbnMoIGNvbnRyb2xfdGFiICkgKSB7IHJldHVybjsgfVxuXHRcdFx0XHRpZiAoIFsgJ0Fycm93TGVmdCcsICdBcnJvd1JpZ2h0JywgJ0hvbWUnLCAnRW5kJyBdLmluZGV4T2YoIGUua2V5ICkgPT09IC0xICkgeyByZXR1cm47IH1cblxuXHRcdFx0XHR2YXIgY29udHJvbF9yb290ID0gY29udHJvbF90YWIuY2xvc2VzdCggJ1tkYXRhLWNvbHVtbi1jb250cm9sLXRhYnNdJyApO1xuXHRcdFx0XHR2YXIgY29udHJvbF90YWJzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIGNvbnRyb2xfcm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtY29sdW1uLWNvbnRyb2wtdGFiLWtleV0nICkgKTtcblx0XHRcdFx0dmFyIGFjdGl2ZV9pbmRleCA9IGNvbnRyb2xfdGFicy5pbmRleE9mKCBjb250cm9sX3RhYiApO1xuXHRcdFx0XHRpZiAoIGFjdGl2ZV9pbmRleCA8IDAgKSB7IHJldHVybjsgfVxuXG5cdFx0XHRcdHZhciBuZXh0X2luZGV4ID0gYWN0aXZlX2luZGV4O1xuXHRcdFx0XHRpZiAoICdIb21lJyA9PT0gZS5rZXkgKSB7XG5cdFx0XHRcdFx0bmV4dF9pbmRleCA9IDA7XG5cdFx0XHRcdH0gZWxzZSBpZiAoICdFbmQnID09PSBlLmtleSApIHtcblx0XHRcdFx0XHRuZXh0X2luZGV4ID0gY29udHJvbF90YWJzLmxlbmd0aCAtIDE7XG5cdFx0XHRcdH0gZWxzZSBpZiAoICdBcnJvd1JpZ2h0JyA9PT0gZS5rZXkgKSB7XG5cdFx0XHRcdFx0bmV4dF9pbmRleCA9ICggYWN0aXZlX2luZGV4ICsgMSApICUgY29udHJvbF90YWJzLmxlbmd0aDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRuZXh0X2luZGV4ID0gKCBhY3RpdmVfaW5kZXggLSAxICsgY29udHJvbF90YWJzLmxlbmd0aCApICUgY29udHJvbF90YWJzLmxlbmd0aDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0dmFyIG5leHRfdGFiX2tleSA9IGNvbnRyb2xfdGFic1sgbmV4dF9pbmRleCBdLmdldEF0dHJpYnV0ZSggJ2RhdGEtY29sdW1uLWNvbnRyb2wtdGFiLWtleScgKSB8fCAnJztcblx0XHRcdFx0YWN0aXZhdGVfY29sdW1uX2NvbnRyb2xfdGFiKCBjb250cm9sX3Jvb3QsIG5leHRfdGFiX2tleSwgdHJ1ZSApO1xuXHRcdFx0XHRyZW1lbWJlcl9jb2x1bW5fY29udHJvbF90YWIoIGNvbnRyb2xfcm9vdCwgbmV4dF90YWJfa2V5ICk7XG5cdFx0XHR9XG5cclxuXHRcdFx0aG9zdC5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCBvbl9jaGFuZ2UsIHRydWUgKTtcclxuXHRcdFx0aG9zdC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgb25fY2hhbmdlLCB0cnVlICk7XG5cdFx0XHRob3N0LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIG9uX2NsaWNrLCB0cnVlICk7XG5cdFx0XHRob3N0LmFkZEV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgb25fa2V5ZG93biwgdHJ1ZSApO1xuXHJcblx0XHRcdC8vIEluaXRpYWwgYXBwbHkgKGRvZXMgTk9UIGF1dG8tYWN0aXZhdGUpLlxyXG5cdFx0XHRVSS5XUEJDX0JGQl9Db2x1bW5fU3R5bGVzLmFwcGx5KCBzZWN0aW9uX2VsLCBzdHlsZXNfYXJyICk7XHJcblxyXG5cdFx0XHQvLyBQcm92aWRlIGNsZWFudXAgdG8gYXZvaWQgbGVha3MuXHJcblx0XHRcdGhvc3QuX193cGJjX2NsZWFudXAgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdGhvc3QucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2lucHV0Jywgb25fY2hhbmdlLCB0cnVlICk7XHJcblx0XHRcdFx0XHRob3N0LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBvbl9jaGFuZ2UsIHRydWUgKTtcblx0XHRcdFx0XHRob3N0LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjbGljaycsIG9uX2NsaWNrLCB0cnVlICk7XG5cdFx0XHRcdFx0aG9zdC5yZW1vdmVFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIG9uX2tleWRvd24sIHRydWUgKTtcblx0XHRcdFx0fSBjYXRjaCAoIF9lICkge31cclxuXHRcdFx0fTtcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZWZyZXNoIHRoZSBtb3VudGVkIGVkaXRvciBhZnRlciBjb2x1bW5zIGNvdW50IGNoYW5nZXMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtvYmplY3R9ICAgICAgYnVpbGRlclxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gc2VjdGlvbl9lbFxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gaW5zcGVjdG9yX3Jvb3RcclxuXHRcdCAqL1xyXG5cdFx0cmVmcmVzaF9mb3Jfc2VjdGlvbiA6IGZ1bmN0aW9uICggYnVpbGRlciwgc2VjdGlvbl9lbCwgaW5zcGVjdG9yX3Jvb3QgKSB7XHJcblx0XHRcdHZhciBob3N0ID0gaW5zcGVjdG9yX3Jvb3QgJiYgaW5zcGVjdG9yX3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLWJmYi1zbG90PVwiY29sdW1uX3N0eWxlc1wiXScgKTtcclxuXHRcdFx0aWYgKCAhIGhvc3QgKSB7IHJldHVybjsgfVxyXG5cdFx0XHR0aGlzLnJlbmRlcl9mb3Jfc2VjdGlvbiggYnVpbGRlciwgc2VjdGlvbl9lbCwgaG9zdCApO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8vIE9wdGlvbmFsOiByZWdpc3RlciBhIGZhY3Rvcnkgc2xvdCBmb3IgZW52aXJvbm1lbnRzIHRoYXQgdXNlIGluc3BlY3RvciBmYWN0b3J5LlxyXG5cdHcud3BiY19iZmJfaW5zcGVjdG9yX2ZhY3Rvcnlfc2xvdHMgPSB3LndwYmNfYmZiX2luc3BlY3Rvcl9mYWN0b3J5X3Nsb3RzIHx8IHt9O1xyXG5cdHcud3BiY19iZmJfaW5zcGVjdG9yX2ZhY3Rvcnlfc2xvdHMuY29sdW1uX3N0eWxlcyA9IGZ1bmN0aW9uICggaG9zdCwgb3B0cyApIHtcclxuXHRcdHRyeSB7XHJcblx0XHRcdHZhciBidWlsZGVyICAgID0gKCBvcHRzICYmIG9wdHMuYnVpbGRlciApIHx8IHcud3BiY19iZmIgfHwgbnVsbDtcclxuXHRcdFx0dmFyIHNlY3Rpb25fZWwgPSAoIG9wdHMgJiYgb3B0cy5lbCApIHx8ICggYnVpbGRlciAmJiBidWlsZGVyLmdldF9zZWxlY3RlZF9maWVsZCAmJiBidWlsZGVyLmdldF9zZWxlY3RlZF9maWVsZCgpICkgfHwgbnVsbDtcclxuXHRcdFx0VUkud3BiY19iZmJfY29sdW1uX3N0eWxlcy5yZW5kZXJfZm9yX3NlY3Rpb24oIGJ1aWxkZXIsIHNlY3Rpb25fZWwsIGhvc3QgKTtcclxuXHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHR3Ll93cGJjICYmIHcuX3dwYmMuZGV2ICYmIHcuX3dwYmMuZGV2LmVycm9yICYmIHcuX3dwYmMuZGV2LmVycm9yKCAnd3BiY19iZmJfaW5zcGVjdG9yX2ZhY3Rvcnlfc2xvdHMuY29sdW1uX3N0eWxlcycsIGUgKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxufSkoIHdpbmRvdyApO1xyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDLFVBQVdBLENBQUMsRUFBRztFQUNmLFlBQVk7O0VBRVosSUFBSUMsSUFBSSxHQUFLRCxDQUFDLENBQUNFLGFBQWEsR0FBR0YsQ0FBQyxDQUFDRSxhQUFhLElBQUksQ0FBQyxDQUFHO0VBQ3RELElBQUlDLEVBQUUsR0FBT0YsSUFBSSxDQUFDRSxFQUFFLEdBQUdGLElBQUksQ0FBQ0UsRUFBRSxJQUFJLENBQUMsQ0FBRztFQUV0QyxJQUFJQyxDQUFDLEdBQUtILElBQUksQ0FBQ0ksaUJBQWlCLElBQUksQ0FBQyxDQUFDO0VBQ3RDLElBQUlDLEdBQUcsR0FBS0wsSUFBSSxDQUFDTSxZQUFZLElBQUlOLElBQUksQ0FBQ00sWUFBWSxDQUFDQyxTQUFTLElBQU07SUFDakVDLEdBQUcsRUFBTSxnQkFBZ0I7SUFDekJDLE1BQU0sRUFBRztFQUNWLENBQUM7O0VBRUQ7RUFDQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxJQUFJQyxTQUFTLEdBQUc7SUFDZkMsR0FBRyxFQUFJO01BQUVDLEdBQUcsRUFBRSxvQkFBb0I7TUFBSUMsR0FBRyxFQUFFLFFBQVE7TUFBU0MsU0FBUyxFQUFFO0lBQU0sQ0FBQztJQUM5RUMsSUFBSSxFQUFHO01BQUVILEdBQUcsRUFBRSxxQkFBcUI7TUFBR0MsR0FBRyxFQUFFLFFBQVE7TUFBUUMsU0FBUyxFQUFFO0lBQU0sQ0FBQztJQUM3RUUsRUFBRSxFQUFLO01BQUVKLEdBQUcsRUFBRSxtQkFBbUI7TUFBS0MsR0FBRyxFQUFFLFlBQVk7TUFBRUMsU0FBUyxFQUFFO0lBQU0sQ0FBQztJQUMzRUcsRUFBRSxFQUFLO01BQUVMLEdBQUcsRUFBRSxtQkFBbUI7TUFBS0MsR0FBRyxFQUFFLFNBQVM7TUFBS0MsU0FBUyxFQUFFO0lBQU0sQ0FBQztJQUMzRUksR0FBRyxFQUFJO01BQUVOLEdBQUcsRUFBRSxvQkFBb0I7TUFBSUMsR0FBRyxFQUFFLEtBQUs7TUFBU0MsU0FBUyxFQUFFO0lBQU0sQ0FBQztJQUMzRUssT0FBTyxFQUFFO01BQUVQLEdBQUcsRUFBRSx3QkFBd0I7TUFBRUMsR0FBRyxFQUFFLEtBQUs7TUFBRUMsU0FBUyxFQUFFO0lBQU0sQ0FBQztJQUN4RU0sTUFBTSxFQUFHO01BQUVSLEdBQUcsRUFBRSx1QkFBdUI7TUFBR0MsR0FBRyxFQUFFLEtBQUs7TUFBRUMsU0FBUyxFQUFFO0lBQU0sQ0FBQztJQUN4RU8sV0FBVyxFQUFLO01BQUVULEdBQUcsRUFBRSw0QkFBNEI7TUFBS0MsR0FBRyxFQUFFLEtBQUs7TUFBRUMsU0FBUyxFQUFFO0lBQU0sQ0FBQztJQUN0RlEsYUFBYSxFQUFHO01BQUVWLEdBQUcsRUFBRSw4QkFBOEI7TUFBR0MsR0FBRyxFQUFFLEtBQUs7TUFBRUMsU0FBUyxFQUFFO0lBQU0sQ0FBQztJQUN0RlMsY0FBYyxFQUFFO01BQUVYLEdBQUcsRUFBRSwrQkFBK0I7TUFBRUMsR0FBRyxFQUFFLEtBQUs7TUFBRUMsU0FBUyxFQUFFO0lBQU0sQ0FBQztJQUN0RlUsWUFBWSxFQUFJO01BQUVaLEdBQUcsRUFBRSw2QkFBNkI7TUFBSUMsR0FBRyxFQUFFLEtBQUs7TUFBRUMsU0FBUyxFQUFFO0lBQU0sQ0FBQztJQUN0RlcsVUFBVSxFQUFNO01BQUViLEdBQUcsRUFBRSwyQkFBMkI7TUFBTUMsR0FBRyxFQUFFLE9BQU87TUFBRUMsU0FBUyxFQUFFO0lBQU0sQ0FBQztJQUN4RlksWUFBWSxFQUFJO01BQUVkLEdBQUcsRUFBRSw2QkFBNkI7TUFBSUMsR0FBRyxFQUFFLEtBQUs7TUFBRUMsU0FBUyxFQUFFO0lBQU0sQ0FBQztJQUN0RmEsYUFBYSxFQUFHO01BQUVmLEdBQUcsRUFBRSw4QkFBOEI7TUFBR0MsR0FBRyxFQUFFLE9BQU87TUFBRUMsU0FBUyxFQUFFO0lBQU0sQ0FBQztJQUN4RmMsV0FBVyxFQUFLO01BQUVoQixHQUFHLEVBQUUsNEJBQTRCO01BQUtDLEdBQUcsRUFBRSxLQUFLO01BQUVDLFNBQVMsRUFBRTtJQUFNLENBQUM7SUFDdEZlLFNBQVMsRUFBTztNQUFFakIsR0FBRyxFQUFFLDBCQUEwQjtNQUFPQyxHQUFHLEVBQUUsTUFBTTtNQUFFQyxTQUFTLEVBQUU7SUFBVSxDQUFDO0lBQzNGZ0IsVUFBVSxFQUFNO01BQUVsQixHQUFHLEVBQUUsMkJBQTJCO01BQU1DLEdBQUcsRUFBRSxNQUFNO01BQUVDLFNBQVMsRUFBRTtJQUFVLENBQUM7SUFDM0ZpQixRQUFRLEVBQVE7TUFDZm5CLEdBQUcsRUFBRSx5QkFBeUI7TUFDOUJDLEdBQUcsRUFBRSxTQUFTO01BQ2RDLFNBQVMsRUFBRTtRQUFFa0IsSUFBSSxFQUFFLE1BQU07UUFBRUMsTUFBTSxFQUFFLENBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxRQUFRO01BQUc7SUFDcEUsQ0FBQztJQUNEQyxVQUFVLEVBQU07TUFDZnRCLEdBQUcsRUFBRSwyQkFBMkI7TUFDaENDLEdBQUcsRUFBRSxTQUFTO01BQ2RDLFNBQVMsRUFBRTtRQUFFa0IsSUFBSSxFQUFFLE1BQU07UUFBRUMsTUFBTSxFQUFFLENBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxRQUFRO01BQUc7SUFDcEUsQ0FBQztJQUNERSxVQUFVLEVBQU07TUFDZnZCLEdBQUcsRUFBRSwyQkFBMkI7TUFDaENDLEdBQUcsRUFBRSxTQUFTO01BQ2RDLFNBQVMsRUFBRTtRQUFFa0IsSUFBSSxFQUFFLE1BQU07UUFBRUMsTUFBTSxFQUFFLENBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxRQUFRO01BQUc7SUFDcEUsQ0FBQztJQUNERyxLQUFLLEVBQUU7TUFBRXhCLEdBQUcsRUFBRSxzQkFBc0I7TUFBRUMsR0FBRyxFQUFFLFlBQVk7TUFDdERDLFNBQVMsRUFBRTtRQUFFa0IsSUFBSSxFQUFFLE1BQU07UUFBRUMsTUFBTSxFQUFFLENBQUUsWUFBWSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsU0FBUztNQUFHO0lBQ3RGO0lBQ0E7SUFDQTtFQUNELENBQUM7RUFFRCxJQUFJSSxlQUFlLEdBQUc7SUFDckJsQixPQUFPLEVBQUUsQ0FBRSxhQUFhLEVBQUUsZUFBZSxFQUFFLGdCQUFnQixFQUFFLGNBQWMsQ0FBRTtJQUM3RUMsTUFBTSxFQUFHLENBQUUsWUFBWSxFQUFFLGNBQWMsRUFBRSxlQUFlLEVBQUUsYUFBYTtFQUN4RSxDQUFDO0VBRUQsSUFBSWtCLGFBQWEsR0FBR0QsZUFBZSxDQUFDbEIsT0FBTyxDQUFDb0IsTUFBTSxDQUFFRixlQUFlLENBQUNqQixNQUFPLENBQUM7RUFDNUUsSUFBSW9CLGtCQUFrQixHQUFHLENBQUUsWUFBWSxFQUFFLFlBQVksQ0FBRTs7RUFFdkQ7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTQyxRQUFRQSxDQUFFQyxDQUFDLEVBQUc7SUFDdEIsSUFBSUMsRUFBRSxHQUFHQyxNQUFNLENBQUVGLENBQUMsSUFBSSxFQUFHLENBQUMsQ0FBQ0csSUFBSSxDQUFDLENBQUM7SUFDakMsSUFBSyxDQUFFRixFQUFFLEVBQUc7TUFBRSxPQUFPLEtBQUs7SUFBRTtJQUM1QixJQUFLLGVBQWUsQ0FBQ0csSUFBSSxDQUFFSCxFQUFHLENBQUMsRUFBRztNQUFFLE9BQU9BLEVBQUUsR0FBRyxJQUFJO0lBQUUsQ0FBQyxDQUFlO0lBQ3RFLElBQUssNEJBQTRCLENBQUNHLElBQUksQ0FBRUgsRUFBRyxDQUFDLEVBQUc7TUFBRSxPQUFPQSxFQUFFO0lBQUUsQ0FBQyxDQUFTO0lBQ3RFLE9BQU8sS0FBSztFQUNiOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNJLFlBQVlBLENBQUVDLGVBQWUsRUFBRztJQUN4QyxJQUFJQyxnQkFBZ0IsR0FBR0wsTUFBTSxDQUFFSSxlQUFlLElBQUksSUFBSSxHQUFHLEVBQUUsR0FBR0EsZUFBZ0IsQ0FBQyxDQUFDSCxJQUFJLENBQUMsQ0FBQztJQUN0RixJQUFLLENBQUVJLGdCQUFnQixJQUFJLE1BQU0sS0FBS0EsZ0JBQWdCLEVBQUc7TUFDeEQsT0FBTyxNQUFNO0lBQ2Q7SUFDQSxJQUFLLGVBQWUsQ0FBQ0gsSUFBSSxDQUFFRyxnQkFBaUIsQ0FBQyxFQUFHO01BQy9DLE9BQU9BLGdCQUFnQixHQUFHLElBQUk7SUFDL0I7SUFDQSxJQUFLLGtDQUFrQyxDQUFDSCxJQUFJLENBQUVHLGdCQUFpQixDQUFDLEVBQUc7TUFDbEUsT0FBT0EsZ0JBQWdCO0lBQ3hCO0lBQ0EsT0FBTyxNQUFNO0VBQ2Q7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTQyxTQUFTQSxDQUFDUixDQUFDLEVBQUVTLElBQUksRUFBRTtJQUMzQlQsQ0FBQyxHQUFHRSxNQUFNLENBQUVGLENBQUMsSUFBSSxFQUFHLENBQUM7SUFDckIsT0FBT1MsSUFBSSxDQUFDQyxPQUFPLENBQUVWLENBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHQSxDQUFDLEdBQUdTLElBQUksQ0FBQyxDQUFDLENBQUM7RUFDOUM7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7RUFDQyxJQUFJRSxTQUFTLEdBQUc7SUFDZkMsRUFBRSxFQUFPWixDQUFDLElBQUlFLE1BQU0sQ0FBRUYsQ0FBQyxJQUFJLEVBQUcsQ0FBQztJQUMvQmEsR0FBRyxFQUFNZCxRQUFRO0lBQ2pCZSxPQUFPLEVBQUVULFlBQVk7SUFDckJVLElBQUksRUFBS0EsQ0FBQ2YsQ0FBQyxFQUFFVCxNQUFNLEtBQUtpQixTQUFTLENBQUVSLENBQUMsRUFBRVQsTUFBTztFQUM5QyxDQUFDOztFQUVEO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVN5QixnQkFBZ0JBLENBQUVDLENBQUMsRUFBRztJQUM5QixPQUFPQyxNQUFNLENBQUNDLFNBQVMsQ0FBQ0MsY0FBYyxDQUFDQyxJQUFJLENBQUVyRCxTQUFTLEVBQUVpRCxDQUFFLENBQUM7RUFDNUQ7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTSyxlQUFlQSxDQUFDQyxHQUFHLEVBQUVDLEdBQUcsRUFBRTtJQUNsQyxJQUFJQyxHQUFHLEdBQUd6RCxTQUFTLENBQUN1RCxHQUFHLENBQUM7SUFDeEIsSUFBSyxDQUFFRSxHQUFHLEVBQUc7TUFDWixPQUFPdkIsTUFBTSxDQUFFc0IsR0FBRyxJQUFJLEVBQUcsQ0FBQztJQUMzQjtJQUNBLElBQUtDLEdBQUcsQ0FBQ3JELFNBQVMsSUFBSSxPQUFPcUQsR0FBRyxDQUFDckQsU0FBUyxLQUFLLFFBQVEsSUFBSXFELEdBQUcsQ0FBQ3JELFNBQVMsQ0FBQ2tCLElBQUksS0FBSyxNQUFNLEVBQUc7TUFDMUYsT0FBT3FCLFNBQVMsQ0FBQ0ksSUFBSSxDQUFFUyxHQUFHLEVBQUVDLEdBQUcsQ0FBQ3JELFNBQVMsQ0FBQ21CLE1BQU0sSUFBSSxFQUFHLENBQUM7SUFDekQ7SUFDQSxJQUFJbUMsRUFBRSxHQUFHZixTQUFTLENBQUNjLEdBQUcsQ0FBQ3JELFNBQVMsQ0FBQyxJQUFJdUMsU0FBUyxDQUFDQyxFQUFFO0lBQ2pELE9BQU9jLEVBQUUsQ0FBRUYsR0FBSSxDQUFDO0VBQ2pCOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTRyxnQkFBZ0JBLENBQUEsRUFBRztJQUMzQixJQUFJQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQUUsS0FBTSxJQUFJWCxDQUFDLElBQUlqRCxTQUFTLEVBQUc7TUFBRSxJQUFLZ0QsZ0JBQWdCLENBQUVDLENBQUUsQ0FBQyxFQUFHO1FBQUVXLENBQUMsQ0FBQ1gsQ0FBQyxDQUFDLEdBQUdqRCxTQUFTLENBQUNpRCxDQUFDLENBQUMsQ0FBQzlDLEdBQUc7TUFBRTtJQUFFO0lBQ25HLE9BQU95RCxDQUFDO0VBQ1Q7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0Msc0JBQXNCQSxDQUFFQyxZQUFZLEVBQUVDLFFBQVEsRUFBRUMsVUFBVSxFQUFFQyxRQUFRLEVBQUc7SUFDL0UsSUFBS2YsTUFBTSxDQUFDQyxTQUFTLENBQUNDLGNBQWMsQ0FBQ0MsSUFBSSxDQUFFUyxZQUFZLEVBQUVDLFFBQVMsQ0FBQyxFQUFHO01BQ3JFLE9BQU9ULGVBQWUsQ0FBRVMsUUFBUSxFQUFFRCxZQUFZLENBQUVDLFFBQVEsQ0FBRyxDQUFDO0lBQzdEO0lBQ0EsSUFBS2IsTUFBTSxDQUFDQyxTQUFTLENBQUNDLGNBQWMsQ0FBQ0MsSUFBSSxDQUFFUyxZQUFZLEVBQUVFLFVBQVcsQ0FBQyxFQUFHO01BQ3ZFLE9BQU9WLGVBQWUsQ0FBRVUsVUFBVSxFQUFFRixZQUFZLENBQUVFLFVBQVUsQ0FBRyxDQUFDO0lBQ2pFO0lBQ0EsT0FBT0MsUUFBUSxDQUFFRixRQUFRLENBQUU7RUFDNUI7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0csa0JBQWtCQSxDQUFFSCxRQUFRLEVBQUc7SUFDdkMsS0FBTSxJQUFJQyxVQUFVLElBQUlyQyxlQUFlLEVBQUc7TUFDekMsSUFBS3VCLE1BQU0sQ0FBQ0MsU0FBUyxDQUFDQyxjQUFjLENBQUNDLElBQUksQ0FBRTFCLGVBQWUsRUFBRXFDLFVBQVcsQ0FBQyxJQUFJckMsZUFBZSxDQUFFcUMsVUFBVSxDQUFFLENBQUN0QixPQUFPLENBQUVxQixRQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRztRQUN0SSxPQUFPO1VBQUVDLFVBQVUsRUFBRUEsVUFBVTtVQUFFRyxTQUFTLEVBQUV4QyxlQUFlLENBQUVxQyxVQUFVO1FBQUcsQ0FBQztNQUM1RTtJQUNEO0lBQ0EsT0FBTyxJQUFJO0VBQ1o7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTSSw2QkFBNkJBLENBQUVDLFlBQVksRUFBRUMsVUFBVSxFQUFHO0lBQ2xFLElBQUlDLFNBQVMsR0FBR0wsa0JBQWtCLENBQUVJLFVBQVcsQ0FBQztJQUNoRCxJQUFLLENBQUVDLFNBQVMsRUFBRztNQUNsQjtJQUNEO0lBRUFGLFlBQVksQ0FBQ0csS0FBSyxHQUFHSCxZQUFZLENBQUNHLEtBQUssSUFBSSxDQUFDLENBQUM7SUFDN0MsS0FBTSxJQUFJQyxVQUFVLEdBQUcsQ0FBQyxFQUFFQSxVQUFVLEdBQUdGLFNBQVMsQ0FBQ0osU0FBUyxDQUFDTyxNQUFNLEVBQUVELFVBQVUsRUFBRSxFQUFHO01BQ2pGLElBQUlWLFFBQVEsR0FBR1EsU0FBUyxDQUFDSixTQUFTLENBQUVNLFVBQVUsQ0FBRTtNQUNoREosWUFBWSxDQUFFTixRQUFRLENBQUUsR0FBR1QsZUFBZSxDQUFFUyxRQUFRLEVBQUVNLFlBQVksQ0FBRU4sUUFBUSxDQUFHLENBQUM7TUFDaEZNLFlBQVksQ0FBQ0csS0FBSyxDQUFFVCxRQUFRLENBQUUsR0FBRyxJQUFJO0lBQ3RDO0lBRUEsT0FBT00sWUFBWSxDQUFFRSxTQUFTLENBQUNQLFVBQVUsQ0FBRTtJQUMzQ0ssWUFBWSxDQUFDRyxLQUFLLENBQUVELFNBQVMsQ0FBQ1AsVUFBVSxDQUFFLEdBQUcsS0FBSztFQUNuRDs7RUFFQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU1csMkJBQTJCQSxDQUFFYixZQUFZLEVBQUVjLFFBQVEsRUFBRVgsUUFBUSxFQUFHO0lBQ3hFLElBQUtmLE1BQU0sQ0FBQ0MsU0FBUyxDQUFDQyxjQUFjLENBQUNDLElBQUksQ0FBRVMsWUFBWSxFQUFFYyxRQUFTLENBQUMsRUFBRztNQUNyRSxPQUFPdEIsZUFBZSxDQUFFc0IsUUFBUSxFQUFFZCxZQUFZLENBQUVjLFFBQVEsQ0FBRyxDQUFDO0lBQzdEO0lBQ0EsSUFBSzFCLE1BQU0sQ0FBQ0MsU0FBUyxDQUFDQyxjQUFjLENBQUNDLElBQUksQ0FBRVMsWUFBWSxFQUFFLFVBQVcsQ0FBQyxFQUFHO01BQ3ZFLE9BQU9SLGVBQWUsQ0FBRXNCLFFBQVEsRUFBRWQsWUFBWSxDQUFDekMsUUFBUyxDQUFDO0lBQzFEO0lBQ0EsT0FBTzRDLFFBQVEsQ0FBRVcsUUFBUSxDQUFFO0VBQzVCOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLGlDQUFpQ0EsQ0FBRVIsWUFBWSxFQUFHO0lBQzFELElBQUssQ0FBRUEsWUFBWSxJQUFJLENBQUVBLFlBQVksQ0FBQ0csS0FBSyxJQUFJLElBQUksS0FBS0gsWUFBWSxDQUFDRyxLQUFLLENBQUNuRCxRQUFRLEVBQUc7TUFDckY7SUFDRDtJQUVBLEtBQU0sSUFBSXlELFVBQVUsR0FBRyxDQUFDLEVBQUVBLFVBQVUsR0FBR2hELGtCQUFrQixDQUFDNEMsTUFBTSxFQUFFSSxVQUFVLEVBQUUsRUFBRztNQUNoRixJQUFJRixRQUFRLEdBQUc5QyxrQkFBa0IsQ0FBRWdELFVBQVUsQ0FBRTtNQUMvQ1QsWUFBWSxDQUFFTyxRQUFRLENBQUUsR0FBR3RCLGVBQWUsQ0FBRXNCLFFBQVEsRUFBRVAsWUFBWSxDQUFFTyxRQUFRLENBQUcsQ0FBQztNQUNoRlAsWUFBWSxDQUFDRyxLQUFLLENBQUVJLFFBQVEsQ0FBRSxHQUFHLElBQUk7SUFDdEM7SUFFQSxPQUFPUCxZQUFZLENBQUNoRCxRQUFRO0lBQzVCZ0QsWUFBWSxDQUFDRyxLQUFLLENBQUNuRCxRQUFRLEdBQUcsS0FBSztFQUNwQzs7RUFFQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVMwRCw0QkFBNEJBLENBQUVDLFNBQVMsRUFBRUMsWUFBWSxFQUFHO0lBQ2hFLElBQUssQ0FBRUEsWUFBWSxJQUFJLElBQUksS0FBS0EsWUFBWSxDQUFFRCxTQUFTLENBQUUsRUFBRztNQUMzRCxPQUFPLEtBQUs7SUFDYjtJQUNBLE9BQU9wRCxhQUFhLENBQUNjLE9BQU8sQ0FBRXNDLFNBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUNqRDs7RUFFQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0UsNEJBQTRCQSxDQUFFYixZQUFZLEVBQUVjLGNBQWMsRUFBRztJQUNyRSxJQUFJQyxVQUFVLEdBQUcsRUFBRTtJQUNuQixJQUFLLENBQUVmLFlBQVksSUFBSSxDQUFFZ0IsS0FBSyxDQUFDQyxPQUFPLENBQUVILGNBQWUsQ0FBQyxFQUFHO01BQzFELE9BQU9DLFVBQVU7SUFDbEI7SUFFQSxLQUFNLElBQUlHLGVBQWUsR0FBRyxDQUFDLEVBQUVBLGVBQWUsR0FBR0osY0FBYyxDQUFDVCxNQUFNLEVBQUVhLGVBQWUsRUFBRSxFQUFHO01BQzNGLElBQUt2QyxnQkFBZ0IsQ0FBRW1DLGNBQWMsQ0FBRUksZUFBZSxDQUFHLENBQUMsRUFBRztRQUM1REgsVUFBVSxDQUFDSSxJQUFJLENBQUVMLGNBQWMsQ0FBRUksZUFBZSxDQUFHLENBQUM7TUFDckQ7SUFDRDtJQUNBLElBQUssQ0FBRUgsVUFBVSxDQUFDVixNQUFNLEVBQUc7TUFDMUIsT0FBT1UsVUFBVTtJQUNsQjtJQUVBZixZQUFZLENBQUNHLEtBQUssR0FBR0gsWUFBWSxDQUFDRyxLQUFLLElBQUksQ0FBQyxDQUFDO0lBQzdDLEtBQU0sSUFBSWlCLGVBQWUsR0FBRyxDQUFDLEVBQUVBLGVBQWUsR0FBR0wsVUFBVSxDQUFDVixNQUFNLEVBQUVlLGVBQWUsRUFBRSxFQUFHO01BQ3ZGLElBQUlDLGFBQWEsR0FBR04sVUFBVSxDQUFFSyxlQUFlLENBQUU7TUFDakQsSUFBSzdELGFBQWEsQ0FBQ2MsT0FBTyxDQUFFZ0QsYUFBYyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUc7UUFDcER0Qiw2QkFBNkIsQ0FBRUMsWUFBWSxFQUFFcUIsYUFBYyxDQUFDO01BQzdEO01BQ0EsSUFBSzVELGtCQUFrQixDQUFDWSxPQUFPLENBQUVnRCxhQUFjLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRztRQUN6RGIsaUNBQWlDLENBQUVSLFlBQWEsQ0FBQztNQUNsRDtJQUNEO0lBRUEsS0FBTSxJQUFJc0IsV0FBVyxHQUFHLENBQUMsRUFBRUEsV0FBVyxHQUFHUCxVQUFVLENBQUNWLE1BQU0sRUFBRWlCLFdBQVcsRUFBRSxFQUFHO01BQzNFLElBQUlYLFNBQVMsR0FBR0ksVUFBVSxDQUFFTyxXQUFXLENBQUU7TUFDekN0QixZQUFZLENBQUVXLFNBQVMsQ0FBRSxHQUFHaEYsU0FBUyxDQUFFZ0YsU0FBUyxDQUFFLENBQUM3RSxHQUFHO01BQ3REa0UsWUFBWSxDQUFDRyxLQUFLLENBQUVRLFNBQVMsQ0FBRSxHQUFHLEtBQUs7SUFDeEM7SUFFQSxPQUFPSSxVQUFVO0VBQ2xCOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU1EsUUFBUUEsQ0FBRUMsSUFBSSxFQUFFQyxTQUFTLEVBQUc7SUFDcEMsSUFBSyxDQUFFRCxJQUFJLEVBQUc7TUFBRTtJQUFRO0lBQ3hCLEtBQU0sSUFBSTVDLENBQUMsSUFBSWpELFNBQVMsRUFBRztNQUFFLElBQUtnRCxnQkFBZ0IsQ0FBRUMsQ0FBRSxDQUFDLEVBQUc7UUFDekQsSUFBSThDLE1BQU0sR0FBRy9GLFNBQVMsQ0FBQ2lELENBQUMsQ0FBQyxDQUFDL0MsR0FBRztRQUM3QixJQUFJOEIsQ0FBQyxHQUFLOEQsU0FBUyxJQUFJQSxTQUFTLENBQUM3QyxDQUFDLENBQUMsSUFBSSxJQUFJLElBQUlmLE1BQU0sQ0FBRTRELFNBQVMsQ0FBQzdDLENBQUMsQ0FBRSxDQUFDLENBQUNkLElBQUksQ0FBQyxDQUFDLEtBQUssRUFBRSxHQUFLMkQsU0FBUyxDQUFDN0MsQ0FBQyxDQUFDLEdBQUdqRCxTQUFTLENBQUNpRCxDQUFDLENBQUMsQ0FBQzlDLEdBQUc7UUFDdkgwRixJQUFJLENBQUNHLEtBQUssQ0FBQ0MsV0FBVyxDQUFFRixNQUFNLEVBQUV6QyxlQUFlLENBQUVMLENBQUMsRUFBRWpCLENBQUUsQ0FBRSxDQUFDO01BQzFEO0lBQUM7RUFDRjtFQUVBLFNBQVNrRSxlQUFlQSxDQUFDTCxJQUFJLEVBQUVDLFNBQVMsRUFBRTtJQUN6QyxJQUFLLENBQUNELElBQUksRUFBRztJQUNiLEtBQU0sSUFBSTVDLENBQUMsSUFBSWpELFNBQVMsRUFBRztNQUFFLElBQUtnRCxnQkFBZ0IsQ0FBQ0MsQ0FBQyxDQUFDLEVBQUc7UUFDdkQsSUFBSThDLE1BQU0sR0FBRy9GLFNBQVMsQ0FBQ2lELENBQUMsQ0FBQyxDQUFDL0MsR0FBRztRQUM3QixJQUFLNEYsU0FBUyxJQUFJNUMsTUFBTSxDQUFDQyxTQUFTLENBQUNDLGNBQWMsQ0FBQ0MsSUFBSSxDQUFDeUMsU0FBUyxFQUFFN0MsQ0FBQyxDQUFDLElBQUlmLE1BQU0sQ0FBQzRELFNBQVMsQ0FBQzdDLENBQUMsQ0FBQyxDQUFDLENBQUNkLElBQUksQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFHO1VBQzVHMEQsSUFBSSxDQUFDRyxLQUFLLENBQUNDLFdBQVcsQ0FBQ0YsTUFBTSxFQUFFekMsZUFBZSxDQUFFTCxDQUFDLEVBQUU2QyxTQUFTLENBQUM3QyxDQUFDLENBQUUsQ0FBQyxDQUFDO1FBQ25FLENBQUMsTUFBTTtVQUNOO1VBQ0E0QyxJQUFJLENBQUNHLEtBQUssQ0FBQ0csY0FBYyxDQUFDSixNQUFNLENBQUM7UUFDbEM7TUFDRDtJQUFDO0VBQ0Y7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNLLFVBQVVBLENBQUVQLElBQUksRUFBRztJQUMzQixJQUFLLENBQUVBLElBQUksRUFBRztNQUFFO0lBQVE7SUFDeEIsS0FBTSxJQUFJNUMsQ0FBQyxJQUFJakQsU0FBUyxFQUFHO01BQUUsSUFBS2dELGdCQUFnQixDQUFFQyxDQUFFLENBQUMsRUFBRztRQUN6RDRDLElBQUksQ0FBQ0csS0FBSyxDQUFDRyxjQUFjLENBQUVuRyxTQUFTLENBQUNpRCxDQUFDLENBQUMsQ0FBQy9DLEdBQUksQ0FBQztNQUM5QztJQUFDO0VBQ0Y7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU21HLFVBQVVBLENBQUVDLENBQUMsRUFBRztJQUN4QixPQUFTN0csQ0FBQyxDQUFDOEcsS0FBSyxHQUFHOUcsQ0FBQyxDQUFDOEcsS0FBSyxDQUFFQyxNQUFNLENBQUVGLENBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBRSxDQUFDLEdBQUdHLElBQUksQ0FBQ0MsR0FBRyxDQUFFLENBQUMsRUFBRUQsSUFBSSxDQUFDRSxHQUFHLENBQUUsQ0FBQyxFQUFFSCxNQUFNLENBQUVGLENBQUUsQ0FBQyxJQUFJLENBQUUsQ0FBRSxDQUFDO0VBQ3RHOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNNLFFBQVFBLENBQUVDLEVBQUUsRUFBRztJQUN2QixJQUFJO01BQ0gsSUFBSS9HLEdBQUcsR0FBRytHLEVBQUUsR0FBR0EsRUFBRSxDQUFDQyxhQUFhLENBQUUsV0FBVyxHQUFHbkgsR0FBRyxDQUFDRyxHQUFJLENBQUMsR0FBRyxJQUFJO01BQy9ELElBQUlpSCxHQUFHLEdBQUdqSCxHQUFHLEdBQUdBLEdBQUcsQ0FBQ2tILGdCQUFnQixDQUFFLFdBQVcsR0FBR3JILEdBQUcsQ0FBQ0ksTUFBTyxDQUFDLENBQUMyRSxNQUFNLEdBQUcsQ0FBQztNQUMzRSxPQUFPMkIsVUFBVSxDQUFFVSxHQUFJLENBQUM7SUFDekIsQ0FBQyxDQUFDLE9BQVFFLEVBQUUsRUFBRztNQUNkLE9BQU8sQ0FBQztJQUNUO0VBQ0Q7O0VBRUE7RUFDQTtFQUNBO0VBQ0F6SCxFQUFFLENBQUMwSCxzQkFBc0IsR0FBRztJQUUzQjtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFQyxnQkFBZ0IsRUFBRyxTQUFBQSxDQUFXOUMsWUFBWSxFQUFFZSxVQUFVLEVBQUc7TUFDeEQsT0FBT0YsNEJBQTRCLENBQUViLFlBQVksRUFBRWUsVUFBVyxDQUFDO0lBQ2hFLENBQUM7SUFFRDtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFZ0MscUJBQXFCLEVBQUcsU0FBQUEsQ0FBV0MsVUFBVSxFQUFFQyxVQUFVLEVBQUc7TUFDM0QsSUFBSyxDQUFFRCxVQUFVLEVBQUc7UUFBRTtNQUFRO01BQzlCLElBQUlFLFFBQVEsR0FBR1gsUUFBUSxDQUFFUyxVQUFXLENBQUM7TUFDckMsSUFBSUcsR0FBRyxHQUFRZixJQUFJLENBQUNFLEdBQUcsQ0FBRUYsSUFBSSxDQUFDQyxHQUFHLENBQUVlLFFBQVEsQ0FBRUgsVUFBVSxFQUFFLEVBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFFLENBQUMsRUFBRUMsUUFBUSxJQUFJLENBQUUsQ0FBQztNQUN4RixJQUFJRyxJQUFJLEdBQU9GLEdBQUcsR0FBRyxDQUFDO01BRXRCSCxVQUFVLENBQUNNLFlBQVksQ0FBRSxtQkFBbUIsRUFBRXpGLE1BQU0sQ0FBRXNGLEdBQUksQ0FBRSxDQUFDOztNQUU3RDtNQUNBLElBQUkxSCxHQUFHLEdBQUl1SCxVQUFVLENBQUNQLGFBQWEsQ0FBRSxXQUFXLEdBQUduSCxHQUFHLENBQUNHLEdBQUksQ0FBQztNQUM1RCxJQUFJOEgsSUFBSSxHQUFHOUgsR0FBRyxHQUFHQSxHQUFHLENBQUNrSCxnQkFBZ0IsQ0FBRSxXQUFXLEdBQUdySCxHQUFHLENBQUNJLE1BQU8sQ0FBQyxHQUFHLEVBQUU7TUFDdEUsS0FBTSxJQUFJOEgsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHRCxJQUFJLENBQUNsRCxNQUFNLEVBQUVtRCxDQUFDLEVBQUUsRUFBRztRQUN2QyxJQUFLRCxJQUFJLENBQUNDLENBQUMsQ0FBQyxDQUFDQyxTQUFTLEVBQUc7VUFDeEJGLElBQUksQ0FBQ0MsQ0FBQyxDQUFDLENBQUNDLFNBQVMsQ0FBQ0MsTUFBTSxDQUFFLG9CQUFvQixFQUFFRixDQUFDLEtBQUtILElBQUssQ0FBQztRQUM3RDtNQUNEOztNQUVBO01BQ0EsSUFBSU0sS0FBSyxHQUFHWCxVQUFVLENBQUNMLGdCQUFnQixDQUFFLDJEQUE0RCxDQUFDO01BQ3RHLEtBQU0sSUFBSWlCLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR0QsS0FBSyxDQUFDdEQsTUFBTSxFQUFFdUQsQ0FBQyxFQUFFLEVBQUc7UUFDeEMsSUFBS0QsS0FBSyxDQUFDQyxDQUFDLENBQUMsQ0FBQ0gsU0FBUyxFQUFHO1VBQ3pCRSxLQUFLLENBQUNDLENBQUMsQ0FBQyxDQUFDSCxTQUFTLENBQUNDLE1BQU0sQ0FBRSxvQkFBb0IsRUFBRUUsQ0FBQyxLQUFLUCxJQUFLLENBQUM7UUFDOUQ7TUFDRDtJQUNELENBQUM7SUFFRDtBQUNGO0FBQ0E7QUFDQTtBQUNBO0lBQ0VRLHVCQUF1QixFQUFHLFNBQUFBLENBQVdiLFVBQVUsRUFBRztNQUNqRCxJQUFLLENBQUVBLFVBQVUsRUFBRztRQUFFO01BQVE7TUFDOUJBLFVBQVUsQ0FBQ2MsZUFBZSxDQUFFLG1CQUFvQixDQUFDO01BRWpELElBQUlySSxHQUFHLEdBQUl1SCxVQUFVLENBQUNQLGFBQWEsQ0FBRSxXQUFXLEdBQUduSCxHQUFHLENBQUNHLEdBQUksQ0FBQztNQUM1RCxJQUFJOEgsSUFBSSxHQUFHOUgsR0FBRyxHQUFHQSxHQUFHLENBQUNrSCxnQkFBZ0IsQ0FBRSxXQUFXLEdBQUdySCxHQUFHLENBQUNJLE1BQU8sQ0FBQyxHQUFHLEVBQUU7TUFDdEUsS0FBTSxJQUFJOEgsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHRCxJQUFJLENBQUNsRCxNQUFNLEVBQUVtRCxDQUFDLEVBQUUsRUFBRztRQUN2Q0QsSUFBSSxDQUFDQyxDQUFDLENBQUMsQ0FBQ0MsU0FBUyxJQUFJRixJQUFJLENBQUNDLENBQUMsQ0FBQyxDQUFDQyxTQUFTLENBQUNNLE1BQU0sQ0FBRSxvQkFBcUIsQ0FBQztNQUN0RTtNQUVBLElBQUlKLEtBQUssR0FBR1gsVUFBVSxDQUFDTCxnQkFBZ0IsQ0FBRSwyREFBNEQsQ0FBQztNQUN0RyxLQUFNLElBQUlpQixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdELEtBQUssQ0FBQ3RELE1BQU0sRUFBRXVELENBQUMsRUFBRSxFQUFHO1FBQ3hDRCxLQUFLLENBQUNDLENBQUMsQ0FBQyxDQUFDSCxTQUFTLElBQUlFLEtBQUssQ0FBQ0MsQ0FBQyxDQUFDLENBQUNILFNBQVMsQ0FBQ00sTUFBTSxDQUFFLG9CQUFxQixDQUFDO01BQ3hFO0lBQ0QsQ0FBQztJQUlEO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFQyxnQkFBZ0IsRUFBRyxTQUFBQSxDQUFXQyxDQUFDLEVBQUc7TUFDakMsSUFBSyxDQUFFQSxDQUFDLEVBQUc7UUFBRSxPQUFPLEVBQUU7TUFBRTtNQUN4QixJQUFJQyxHQUFHLEdBQUs5SSxDQUFDLENBQUMrSSxlQUFlLEdBQUcvSSxDQUFDLENBQUMrSSxlQUFlLENBQUV0RyxNQUFNLENBQUVvRyxDQUFFLENBQUMsRUFBRSxJQUFLLENBQUMsR0FBSyxZQUFVO1FBQUUsSUFBSTtVQUFFLE9BQU9HLElBQUksQ0FBQ0MsS0FBSyxDQUFFeEcsTUFBTSxDQUFFb0csQ0FBRSxDQUFFLENBQUM7UUFBRSxDQUFDLENBQUMsT0FBT3JCLEVBQUUsRUFBRTtVQUFFLE9BQU8sSUFBSTtRQUFFO01BQUUsQ0FBQyxDQUFHLENBQUc7TUFDcEssSUFBSzVCLEtBQUssQ0FBQ0MsT0FBTyxDQUFFaUQsR0FBSSxDQUFDLEVBQUc7UUFBRSxPQUFPQSxHQUFHO01BQUU7TUFDMUMsSUFBS0EsR0FBRyxJQUFJLE9BQU9BLEdBQUcsS0FBSyxRQUFRLElBQUlsRCxLQUFLLENBQUNDLE9BQU8sQ0FBRWlELEdBQUcsQ0FBQ0ksT0FBUSxDQUFDLEVBQUc7UUFBRSxPQUFPSixHQUFHLENBQUNJLE9BQU87TUFBRTtNQUM1RixPQUFPLEVBQUU7SUFDVixDQUFDO0lBRUQ7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0VDLG9CQUFvQixFQUFHLFNBQUFBLENBQVdDLEdBQUcsRUFBRztNQUN2QyxJQUFJQyxJQUFJLEdBQUd6RCxLQUFLLENBQUNDLE9BQU8sQ0FBRXVELEdBQUksQ0FBQyxHQUFHQSxHQUFHLEdBQUcsRUFBRTtNQUMxQyxPQUFTcEosQ0FBQyxDQUFDc0osb0JBQW9CLEdBQUd0SixDQUFDLENBQUNzSixvQkFBb0IsQ0FBRUQsSUFBSyxDQUFDLEdBQUdMLElBQUksQ0FBQ08sU0FBUyxDQUFFRixJQUFLLENBQUM7SUFDMUYsQ0FBQztJQUVEO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0VHLFNBQVMsRUFBRyxTQUFBQSxDQUFXNUIsVUFBVSxFQUFHO01BQ25DLElBQUssQ0FBRUEsVUFBVSxFQUFHO1FBQUUsT0FBTyxLQUFLO01BQUU7TUFDcEMsSUFBS0EsVUFBVSxDQUFDNkIsWUFBWSxDQUFFLHVCQUF3QixDQUFDLEtBQUssR0FBRyxFQUFHO1FBQUUsT0FBTyxJQUFJO01BQUU7TUFDeEUsSUFBSUMsR0FBRyxHQUFHOUIsVUFBVSxDQUFDNkIsWUFBWSxDQUFFLGlCQUFrQixDQUFDLEtBQU03QixVQUFVLENBQUMrQixPQUFPLEdBQUsvQixVQUFVLENBQUMrQixPQUFPLENBQUNDLFVBQVUsSUFBSSxFQUFFLEdBQUssRUFBRSxDQUFFO01BQy9ILElBQUlSLEdBQUcsR0FBRyxJQUFJLENBQUNSLGdCQUFnQixDQUFFYyxHQUFJLENBQUM7TUFDdEMsSUFBSUcsR0FBRyxHQUFHM0YsZ0JBQWdCLENBQUMsQ0FBQztNQUM1QjtNQUNBLEtBQU0sSUFBSWtFLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR2dCLEdBQUcsQ0FBQ25FLE1BQU0sRUFBRW1ELENBQUMsRUFBRSxFQUFHO1FBQ25DLElBQUlTLENBQUMsR0FBR08sR0FBRyxDQUFDaEIsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3BCLEtBQU0sSUFBSTVFLENBQUMsSUFBSXFHLEdBQUcsRUFBRztVQUNqQixJQUFLcEcsTUFBTSxDQUFDQyxTQUFTLENBQUNDLGNBQWMsQ0FBQ0MsSUFBSSxDQUFFaUYsQ0FBQyxFQUFFckYsQ0FBRSxDQUFDLEVBQUc7WUFDaEQsSUFBSWpCLENBQUMsR0FBR0UsTUFBTSxDQUFFb0csQ0FBQyxDQUFDckYsQ0FBQyxDQUFFLENBQUM7WUFDdEIsSUFBS2pCLENBQUMsSUFBSUEsQ0FBQyxLQUFLRSxNQUFNLENBQUVvSCxHQUFHLENBQUNyRyxDQUFDLENBQUUsQ0FBQyxFQUFHO2NBQUUsT0FBTyxJQUFJO1lBQUU7VUFDdEQ7UUFDSjtNQUNKO01BQ0EsT0FBTyxLQUFLO0lBQ3RCLENBQUM7SUFFRDtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRXNHLEtBQUssRUFBRyxTQUFBQSxDQUFXbEMsVUFBVSxFQUFFbUMsTUFBTSxFQUFHO01BQ3ZDLElBQUssQ0FBRW5DLFVBQVUsRUFBRztRQUFFO01BQVE7O01BRTlCO01BQ0EsSUFBSW9DLE9BQU8sR0FBR3BDLFVBQVUsQ0FBQ1AsYUFBYSxDQUFFLGlDQUFrQyxDQUFDO01BQzNFLElBQUsyQyxPQUFPLEVBQUc7UUFDZCxJQUFJekIsS0FBSyxHQUFHeUIsT0FBTyxDQUFDekMsZ0JBQWdCLENBQUUsa0NBQW1DLENBQUM7UUFDMUUsS0FBTSxJQUFJYSxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdHLEtBQUssQ0FBQ3RELE1BQU0sRUFBRW1ELENBQUMsRUFBRSxFQUFHO1VBQ3hDakMsUUFBUSxDQUFDb0MsS0FBSyxDQUFDSCxDQUFDLENBQUMsRUFBRTJCLE1BQU0sQ0FBQzNCLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBRztRQUN4QztNQUNEOztNQUVBO01BQ0EsSUFBSTZCLE1BQU0sR0FBRyxJQUFJLENBQUNULFNBQVMsQ0FBRTVCLFVBQVcsQ0FBQzs7TUFFekM7TUFDQSxJQUFLLENBQUVxQyxNQUFNLEVBQUc7UUFDZnJDLFVBQVUsQ0FBQ2MsZUFBZSxDQUFFLHVCQUF3QixDQUFDO1FBQ3JELElBQUl3QixPQUFPLEdBQUd0QyxVQUFVLENBQUNQLGFBQWEsQ0FBRSxXQUFXLEdBQUduSCxHQUFHLENBQUNHLEdBQUksQ0FBQztRQUMvRCxJQUFLNkosT0FBTyxFQUFHO1VBQ2QsSUFBSUMsS0FBSyxHQUFHRCxPQUFPLENBQUMzQyxnQkFBZ0IsQ0FBRSxXQUFXLEdBQUdySCxHQUFHLENBQUNJLE1BQU8sQ0FBQztVQUNoRSxLQUFNLElBQUlrSSxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcyQixLQUFLLENBQUNsRixNQUFNLEVBQUV1RCxDQUFDLEVBQUUsRUFBRztZQUN4QzdCLFVBQVUsQ0FBRXdELEtBQUssQ0FBQzNCLENBQUMsQ0FBRSxDQUFDO1VBQ3ZCO1FBQ0Q7UUFDQTtNQUNEOztNQUVBO01BQ0FaLFVBQVUsQ0FBQ00sWUFBWSxDQUFFLHVCQUF1QixFQUFFLEdBQUksQ0FBQzs7TUFFdkQ7TUFDQSxJQUFJa0MsVUFBVSxHQUFHLElBQUksQ0FBQ3hCLGdCQUFnQixDQUNyQ2hCLFVBQVUsQ0FBQzZCLFlBQVksQ0FBRSxpQkFBa0IsQ0FBQyxLQUMzQzdCLFVBQVUsQ0FBQytCLE9BQU8sR0FBSS9CLFVBQVUsQ0FBQytCLE9BQU8sQ0FBQ0MsVUFBVSxJQUFJLEVBQUUsR0FBSSxFQUFFLENBQ2pFLENBQUM7TUFFRCxJQUFJdkosR0FBRyxHQUFHdUgsVUFBVSxDQUFDUCxhQUFhLENBQUUsV0FBVyxHQUFHbkgsR0FBRyxDQUFDRyxHQUFJLENBQUM7TUFDM0QsSUFBS0EsR0FBRyxFQUFHO1FBQ1YsSUFBSWdLLEtBQUssR0FBR2hLLEdBQUcsQ0FBQ2tILGdCQUFnQixDQUFFLFdBQVcsR0FBR3JILEdBQUcsQ0FBQ0ksTUFBTyxDQUFDO1FBQzVELEtBQU0sSUFBSWtELENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRzZHLEtBQUssQ0FBQ3BGLE1BQU0sRUFBRXpCLENBQUMsRUFBRSxFQUFHO1VBQ3hDaUQsZUFBZSxDQUFDNEQsS0FBSyxDQUFDN0csQ0FBQyxDQUFDLEVBQUU0RyxVQUFVLENBQUM1RyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakQ7TUFDRDtJQUNEO0VBQ0QsQ0FBQzs7RUFFRDtFQUNBO0VBQ0E7RUFDQXpELEVBQUUsQ0FBQ3VLLHNCQUFzQixHQUFHO0lBRTNCO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0VDLGtCQUFrQixFQUFHLFNBQUFBLENBQVdDLE9BQU8sRUFBRTVDLFVBQVUsRUFBRTZDLElBQUksRUFBRztNQUMzRCxJQUFLLENBQUVBLElBQUksSUFBSSxDQUFFN0MsVUFBVSxFQUFHO1FBQUU7TUFBUTs7TUFFeEM7TUFDQSxJQUFJOEMsV0FBVyxHQUFHRCxJQUFJLENBQUNwRCxhQUFhLENBQUUsa0JBQW1CLENBQUM7TUFDMUQsSUFBSXNELEVBQUUsR0FBWS9DLFVBQVUsQ0FBQytCLE9BQU8sSUFBSSxDQUFDLENBQUM7TUFDMUMsSUFBSWlCLFVBQVUsR0FBS0YsV0FBVyxJQUFJQSxXQUFXLENBQUNqQixZQUFZLENBQUUsc0JBQXVCLENBQUMsSUFBS2dCLElBQUksQ0FBQ0ksaUJBQWlCLElBQUlGLEVBQUUsQ0FBQ0cscUJBQXFCLElBQUksSUFBSTtNQUNuSixJQUFJQyx3QkFBd0IsR0FBR04sSUFBSSxDQUFDTywrQkFBK0IsSUFBSSxDQUFDLENBQUM7TUFDekUsSUFBSUMscUJBQXFCLEdBQUdSLElBQUksQ0FBQ2xELGdCQUFnQixDQUFFLDRCQUE2QixDQUFDO01BQ2pGLEtBQU0sSUFBSTJELHNCQUFzQixHQUFHLENBQUMsRUFBRUEsc0JBQXNCLEdBQUdELHFCQUFxQixDQUFDaEcsTUFBTSxFQUFFaUcsc0JBQXNCLEVBQUUsRUFBRztRQUN2SCxJQUFJQyxxQkFBcUIsR0FBR0YscUJBQXFCLENBQUVDLHNCQUFzQixDQUFFO1FBQzNFLElBQUlFLHVCQUF1QixHQUFHLENBQUVwRCxRQUFRLENBQUVtRCxxQkFBcUIsQ0FBQzFCLFlBQVksQ0FBRSxjQUFlLENBQUMsRUFBRSxFQUFHLENBQUMsSUFBSSxDQUFDLElBQUssQ0FBQztRQUMvRyxJQUFJNEIsc0JBQXNCLEdBQUdGLHFCQUFxQixDQUFDMUIsWUFBWSxDQUFFLDBCQUEyQixDQUFDLElBQUksRUFBRTtRQUNuRyxJQUFJNkIsb0JBQW9CLEdBQUdILHFCQUFxQixDQUFDMUIsWUFBWSxDQUFFLGdDQUFpQyxDQUFDLElBQUksRUFBRTtRQUN2RyxJQUFLNEIsc0JBQXNCLElBQUlDLG9CQUFvQixFQUFHO1VBQ3JEUCx3QkFBd0IsQ0FBRUssdUJBQXVCLEdBQUcsR0FBRyxHQUFHQyxzQkFBc0IsQ0FBRSxHQUFHQyxvQkFBb0I7UUFDMUc7TUFDRDtNQUNBYixJQUFJLENBQUNPLCtCQUErQixHQUFHRCx3QkFBd0I7O01BRS9EO01BQ0EsSUFBS04sSUFBSSxDQUFDYyxjQUFjLEVBQUc7UUFDMUIsSUFBSTtVQUFFZCxJQUFJLENBQUNjLGNBQWMsQ0FBQyxDQUFDO1FBQUUsQ0FBQyxDQUFDLE9BQVEvRCxFQUFFLEVBQUcsQ0FBQztRQUM3Q2lELElBQUksQ0FBQ2MsY0FBYyxHQUFHLElBQUk7TUFDM0I7TUFDQWQsSUFBSSxDQUFDZSxTQUFTLEdBQUcsRUFBRTtNQUVuQixJQUFJQyxHQUFHLEdBQUs3TCxDQUFDLENBQUM4TCxFQUFFLElBQUk5TCxDQUFDLENBQUM4TCxFQUFFLENBQUNDLFFBQVEsR0FBSy9MLENBQUMsQ0FBQzhMLEVBQUUsQ0FBQ0MsUUFBUSxDQUFFLHdCQUF5QixDQUFDLEdBQUcsSUFBSTtNQUN0RixJQUFLLENBQUVGLEdBQUcsRUFBRztRQUFFO01BQVE7TUFFdkIsSUFBSUcsU0FBUyxHQUFJekUsUUFBUSxDQUFFUyxVQUFXLENBQUM7TUFDdkMsSUFBSWlFLFFBQVEsR0FBS2pFLFVBQVUsQ0FBQzZCLFlBQVksQ0FBRSxpQkFBa0IsQ0FBQyxLQUFNN0IsVUFBVSxDQUFDK0IsT0FBTyxHQUFLL0IsVUFBVSxDQUFDK0IsT0FBTyxDQUFDQyxVQUFVLElBQUksRUFBRSxHQUFLLEVBQUUsQ0FBRTtNQUV0SSxJQUFJa0MsU0FBUyxHQUFJL0wsRUFBRSxDQUFDMEgsc0JBQXNCLENBQUNtQixnQkFBZ0IsQ0FBRWlELFFBQVMsQ0FBQztNQUN2RSxJQUFJRSxVQUFVLEdBQUcsRUFBRTs7TUFFbkI7TUFDQSxJQUFJckwsR0FBRyxHQUFHd0QsZ0JBQWdCLENBQUMsQ0FBQztNQUM1QixLQUFNLElBQUlrRSxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUd3RCxTQUFTLEVBQUV4RCxDQUFDLEVBQUUsRUFBRztRQUNyQyxJQUFJNEQsR0FBRyxHQUFHRixTQUFTLENBQUMxRCxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDaEI7UUFDWixJQUFJNkQsSUFBSSxHQUFHeEksTUFBTSxDQUFDeUksTUFBTSxDQUFFLENBQUMsQ0FBQyxFQUFFeEwsR0FBRyxFQUFFc0wsR0FBSSxDQUFDO1FBQ3hDQyxJQUFJLENBQUN2SyxTQUFTLEdBQUdtQyxlQUFlLENBQUUsV0FBVyxFQUFFb0ksSUFBSSxDQUFDdkssU0FBVSxDQUFDO1FBQy9EdUssSUFBSSxDQUFDdEssVUFBVSxHQUFHa0MsZUFBZSxDQUFFLFlBQVksRUFBRW9JLElBQUksQ0FBQ3RLLFVBQVcsQ0FBQztRQUNsRXNLLElBQUksQ0FBQ3JLLFFBQVEsR0FBR2lDLGVBQWUsQ0FBRSxVQUFVLEVBQUVvSSxJQUFJLENBQUNySyxRQUFTLENBQUM7UUFDNURxSyxJQUFJLENBQUNsSyxVQUFVLEdBQUdtRCwyQkFBMkIsQ0FBRThHLEdBQUcsRUFBRSxZQUFZLEVBQUV0TCxHQUFJLENBQUM7UUFDdkV1TCxJQUFJLENBQUNqSyxVQUFVLEdBQUdrRCwyQkFBMkIsQ0FBRThHLEdBQUcsRUFBRSxZQUFZLEVBQUV0TCxHQUFJLENBQUM7UUFDdkUsS0FBTSxJQUFJeUwsY0FBYyxJQUFJakssZUFBZSxFQUFHO1VBQzdDLElBQUssQ0FBRXVCLE1BQU0sQ0FBQ0MsU0FBUyxDQUFDQyxjQUFjLENBQUNDLElBQUksQ0FBRTFCLGVBQWUsRUFBRWlLLGNBQWUsQ0FBQyxFQUFHO1lBQ2hGO1VBQ0Q7VUFDQSxLQUFNLElBQUluSCxVQUFVLEdBQUcsQ0FBQyxFQUFFQSxVQUFVLEdBQUc5QyxlQUFlLENBQUVpSyxjQUFjLENBQUUsQ0FBQ2xILE1BQU0sRUFBRUQsVUFBVSxFQUFFLEVBQUc7WUFDL0YsSUFBSVYsUUFBUSxHQUFHcEMsZUFBZSxDQUFFaUssY0FBYyxDQUFFLENBQUVuSCxVQUFVLENBQUU7WUFDOURpSCxJQUFJLENBQUUzSCxRQUFRLENBQUUsR0FBR0Ysc0JBQXNCLENBQUU0SCxHQUFHLEVBQUUxSCxRQUFRLEVBQUU2SCxjQUFjLEVBQUV6TCxHQUFJLENBQUM7VUFDaEY7UUFDRDtRQUNBdUwsSUFBSSxDQUFDbEgsS0FBSyxHQUFHLENBQUMsQ0FBQztRQUNmLEtBQU0sSUFBSVEsU0FBUyxJQUFJN0UsR0FBRyxFQUFHO1VBQzVCLElBQUsrQyxNQUFNLENBQUNDLFNBQVMsQ0FBQ0MsY0FBYyxDQUFDQyxJQUFJLENBQUVsRCxHQUFHLEVBQUU2RSxTQUFVLENBQUMsRUFBRztZQUM3RDBHLElBQUksQ0FBQ2xILEtBQUssQ0FBRVEsU0FBUyxDQUFFLEdBQUc5QixNQUFNLENBQUNDLFNBQVMsQ0FBQ0MsY0FBYyxDQUFDQyxJQUFJLENBQUVvSSxHQUFHLEVBQUV6RyxTQUFVLENBQUM7VUFDakY7UUFDRDtRQUNZd0csVUFBVSxDQUFDM0QsQ0FBQyxDQUFDLEdBQUc2RCxJQUFJO01BQ2pDO01BQ0FGLFVBQVUsQ0FBQzlHLE1BQU0sR0FBRzJHLFNBQVMsQ0FBQyxDQUFHOztNQUVqQ25CLElBQUksQ0FBQ2UsU0FBUyxHQUFHQyxHQUFHLENBQUU7UUFDckJ0RCxJQUFJLEVBQVV5RCxTQUFTO1FBQ3ZCN0IsTUFBTSxFQUFRZ0MsVUFBVTtRQUN4QjlCLE1BQU0sRUFBUWxLLEVBQUUsQ0FBQzBILHNCQUFzQixDQUFDK0IsU0FBUyxDQUFFNUIsVUFBVyxDQUFDO1FBQy9Ed0UsWUFBWSxFQUFFckI7TUFDZixDQUFFLENBQUM7TUFFSCxJQUFJc0Isd0JBQXdCLEdBQUc1QixJQUFJLENBQUNsRCxnQkFBZ0IsQ0FBRSw0QkFBNkIsQ0FBQztNQUNwRixLQUFNLElBQUkrRSxrQkFBa0IsR0FBRyxDQUFDLEVBQUVBLGtCQUFrQixHQUFHRCx3QkFBd0IsQ0FBQ3BILE1BQU0sRUFBRXFILGtCQUFrQixFQUFFLEVBQUc7UUFDOUcsSUFBSUMsWUFBWSxHQUFHRix3QkFBd0IsQ0FBRUMsa0JBQWtCLENBQUU7UUFDakVFLDJCQUEyQixDQUFFRCxZQUFZLEVBQUVBLFlBQVksQ0FBQzlDLFlBQVksQ0FBRSxnQ0FBaUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxLQUFNLENBQUM7TUFDeEg7TUFFQSxJQUFLZ0QsTUFBTSxDQUFDQyxZQUFZLElBQUlqQyxJQUFJLEVBQUc7UUFDbENnQyxNQUFNLENBQUNDLFlBQVksQ0FBQ0MsT0FBTyxDQUFFbEMsSUFBSyxDQUFDOztRQUduQztRQUNBLElBQUltQyxRQUFRLEdBQUduQyxJQUFJLENBQUNwRCxhQUFhLENBQUUsa0JBQW1CLENBQUM7UUFDdkQsSUFBS3VGLFFBQVEsSUFBSSxDQUFDQSxRQUFRLENBQUNDLHVCQUF1QixFQUFHO1VBQ3BERCxRQUFRLENBQUNDLHVCQUF1QixHQUFHLElBQUk7VUFDdkNELFFBQVEsQ0FBQ0UsZ0JBQWdCLENBQUUsa0JBQWtCLEVBQUUsVUFBVUMsQ0FBQyxFQUFFO1lBQzNELElBQUl2SixDQUFDLEdBQUd1SixDQUFDLElBQUlBLENBQUMsQ0FBQ0MsTUFBTSxJQUFJRCxDQUFDLENBQUNDLE1BQU0sQ0FBQ0MsVUFBVTtZQUM1QyxJQUFLekosQ0FBQyxFQUFHO2NBQ1JpSCxJQUFJLENBQUNJLGlCQUFpQixHQUFHcEksTUFBTSxDQUFFZSxDQUFFLENBQUM7Y0FDcEMsSUFBS29FLFVBQVUsSUFBSUEsVUFBVSxDQUFDK0IsT0FBTyxFQUFHO2dCQUN2Qy9CLFVBQVUsQ0FBQytCLE9BQU8sQ0FBQ21CLHFCQUFxQixHQUFHckksTUFBTSxDQUFFZSxDQUFFLENBQUM7Y0FDdkQ7Y0FDQTtjQUNBekQsRUFBRSxDQUFDMEgsc0JBQXNCLENBQUNFLHFCQUFxQixDQUFFQyxVQUFVLEVBQUVwRSxDQUFFLENBQUM7WUFDakU7VUFDRCxDQUFDLEVBQUUsSUFBSyxDQUFDO1FBRVY7O1FBRUE7UUFDQSxJQUFJMEosS0FBSztRQUNULElBQUt0QyxVQUFVLEVBQUc7VUFDakIsSUFBSXVDLFVBQVUsR0FBRzFDLElBQUksQ0FBQ3BELGFBQWEsQ0FBRSxrQkFBbUIsQ0FBQztVQUN6RDZGLEtBQUssR0FBWXpLLE1BQU0sQ0FBRXVFLElBQUksQ0FBQ0UsR0FBRyxDQUFFRixJQUFJLENBQUNDLEdBQUcsQ0FBRWUsUUFBUSxDQUFFNEMsVUFBVSxFQUFFLEVBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFFLENBQUMsRUFBRWdCLFNBQVUsQ0FBRSxDQUFDO1VBQ2hHLElBQUt1QixVQUFVLElBQUlWLE1BQU0sQ0FBQ0MsWUFBWSxDQUFDVSxVQUFVLEVBQUc7WUFDbkRYLE1BQU0sQ0FBQ0MsWUFBWSxDQUFDVSxVQUFVLENBQUVELFVBQVUsRUFBRUQsS0FBTSxDQUFDO1VBQ3BEO1FBQ0Q7O1FBRUE7UUFDQSxJQUFJRyxnQkFBZ0IsR0FBR0gsS0FBSyxLQUFLdkMsRUFBRSxDQUFDRyxxQkFBcUIsR0FBR3JJLE1BQU0sQ0FBRXVFLElBQUksQ0FBQ0UsR0FBRyxDQUFFRixJQUFJLENBQUNDLEdBQUcsQ0FBRWUsUUFBUSxDQUFFMkMsRUFBRSxDQUFDRyxxQkFBcUIsRUFBRSxFQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBRSxDQUFDLEVBQUVjLFNBQVUsQ0FBRSxDQUFDLEdBQUcsR0FBRyxDQUFDO1FBQ2hLN0wsRUFBRSxDQUFDMEgsc0JBQXNCLENBQUNFLHFCQUFxQixDQUFFQyxVQUFVLEVBQUV5RixnQkFBaUIsQ0FBQztNQUNoRjs7TUFFQTtNQUNBLElBQUk7UUFDSHROLEVBQUUsQ0FBQ3VOLGtCQUFrQixJQUFJdk4sRUFBRSxDQUFDdU4sa0JBQWtCLENBQUNDLElBQUksSUFBSXhOLEVBQUUsQ0FBQ3VOLGtCQUFrQixDQUFDQyxJQUFJLENBQUU5QyxJQUFLLENBQUM7UUFDekY7UUFDQTtNQUNELENBQUMsQ0FBQyxPQUFRakQsRUFBRSxFQUFHLENBQUM7O01BRWhCO01BQ0EsSUFBSyxVQUFVLEtBQUssT0FBTzVILENBQUMsQ0FBQzROLDBCQUEwQixFQUFHO1FBQ3pENU4sQ0FBQyxDQUFDNE4sMEJBQTBCLENBQUUsa0NBQW1DLENBQUM7TUFDbkU7O01BRUE7TUFDQUMsc0JBQXNCLENBQUMsQ0FBQztNQUV4QixTQUFTQywwQkFBMEJBLENBQUMzQixVQUFVLEVBQUU0QixtQkFBbUIsRUFBRTtRQUNwRSxJQUFJak4sR0FBRyxHQUFHaU4sbUJBQW1CLENBQUMsQ0FBQztRQUMvQixLQUFNLElBQUl2RixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcyRCxVQUFVLENBQUM5RyxNQUFNLEVBQUVtRCxDQUFDLEVBQUUsRUFBRztVQUM3QyxJQUFJUyxDQUFDLEdBQUdrRCxVQUFVLENBQUMzRCxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7VUFDM0IsS0FBTSxJQUFJNUUsQ0FBQyxJQUFJOUMsR0FBRyxFQUFHO1lBQ3BCLElBQUsrQyxNQUFNLENBQUNDLFNBQVMsQ0FBQ0MsY0FBYyxDQUFDQyxJQUFJLENBQUVsRCxHQUFHLEVBQUU4QyxDQUFFLENBQUMsRUFBRztjQUNyRCxJQUFJakIsQ0FBQyxHQUFJc0csQ0FBQyxDQUFDckYsQ0FBQyxDQUFDLElBQUksSUFBSSxHQUFJLEVBQUUsR0FBR2YsTUFBTSxDQUFFb0csQ0FBQyxDQUFDckYsQ0FBQyxDQUFFLENBQUM7Y0FDNUM7Y0FDQSxJQUFLakIsQ0FBQyxJQUFJQSxDQUFDLEtBQUtFLE1BQU0sQ0FBRS9CLEdBQUcsQ0FBQzhDLENBQUMsQ0FBRSxDQUFDLEVBQUc7Z0JBQ2xDLE9BQU8sSUFBSTtjQUNaO1lBQ0Q7VUFDRDtRQUNEO1FBQ0EsT0FBTyxLQUFLO01BQ2I7TUFFQSxTQUFTb0ssdUJBQXVCQSxDQUFDN0IsVUFBVSxFQUFFNEIsbUJBQW1CLEVBQUU7UUFDakUsSUFBSWpOLEdBQUcsR0FBR2lOLG1CQUFtQixDQUFDLENBQUM7UUFDL0IsSUFBSUUsR0FBRyxHQUFHLEVBQUU7UUFDWixLQUFNLElBQUl6RixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcyRCxVQUFVLENBQUM5RyxNQUFNLEVBQUVtRCxDQUFDLEVBQUUsRUFBRztVQUM3QyxJQUFJUyxDQUFDLEdBQUtrRCxVQUFVLENBQUMzRCxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7VUFDN0IsSUFBSS9ILEdBQUcsR0FBRyxDQUFDLENBQUM7VUFDWixLQUFNLElBQUltRCxDQUFDLElBQUk5QyxHQUFHLEVBQUc7WUFDcEIsSUFBSytDLE1BQU0sQ0FBQ0MsU0FBUyxDQUFDQyxjQUFjLENBQUNDLElBQUksQ0FBRWxELEdBQUcsRUFBRThDLENBQUUsQ0FBQyxFQUFHO2NBQ3JELElBQUlqQixDQUFDLEdBQUlzRyxDQUFDLENBQUNyRixDQUFDLENBQUMsSUFBSSxJQUFJLEdBQUksRUFBRSxHQUFHZixNQUFNLENBQUVvRyxDQUFDLENBQUNyRixDQUFDLENBQUUsQ0FBQztjQUM1QyxJQUFJc0sscUJBQXFCLEdBQUd4SSw0QkFBNEIsQ0FBRTlCLENBQUMsRUFBRXFGLENBQUMsQ0FBQzlELEtBQU0sQ0FBQztjQUN0RSxJQUFLeEMsQ0FBQyxLQUFNQSxDQUFDLEtBQUtFLE1BQU0sQ0FBRS9CLEdBQUcsQ0FBQzhDLENBQUMsQ0FBRSxDQUFDLElBQUlzSyxxQkFBcUIsQ0FBRSxFQUFHO2dCQUMvRHpOLEdBQUcsQ0FBQ21ELENBQUMsQ0FBQyxHQUFHakIsQ0FBQyxDQUFDLENBQUM7Y0FDYjtZQUNEO1VBQ0Q7VUFDQXNMLEdBQUcsQ0FBQzlILElBQUksQ0FBRTFGLEdBQUksQ0FBQztRQUNoQjtRQUNBLE9BQU93TixHQUFHO01BQ1g7O01BRUE7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO01BQ0csU0FBU0UsNEJBQTRCQSxDQUFFaEcsR0FBRyxFQUFFaUcsTUFBTSxFQUFHO1FBQ3BELElBQUlDLElBQUksR0FBRyxDQUFFLElBQUksRUFBRSxJQUFJLENBQUU7UUFDekIsS0FBTSxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdELElBQUksQ0FBQ2hKLE1BQU0sRUFBRWlKLENBQUMsRUFBRSxFQUFHO1VBQ3ZDLElBQUlDLENBQUMsR0FBRyxzREFBc0QsR0FBR0YsSUFBSSxDQUFDQyxDQUFDLENBQUMsR0FBRyxtQkFBbUIsR0FBR25HLEdBQUcsR0FBRyxJQUFJO1VBQzNHLElBQUlxRyxNQUFNLEdBQUczRCxJQUFJLENBQUNsRCxnQkFBZ0IsQ0FBRTRHLENBQUUsQ0FBQztVQUN2QyxLQUFNLElBQUl0SCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUd1SCxNQUFNLENBQUNuSixNQUFNLEVBQUU0QixDQUFDLEVBQUUsRUFBRztZQUN6QyxJQUFJd0gsR0FBRyxHQUFHRCxNQUFNLENBQUN2SCxDQUFDLENBQUMsSUFBSXVILE1BQU0sQ0FBQ3ZILENBQUMsQ0FBQyxDQUFDeUgsa0JBQWtCO1lBQ25ELElBQUtELEdBQUcsSUFBSUEsR0FBRyxDQUFDaEcsU0FBUyxJQUFJZ0csR0FBRyxDQUFDaEcsU0FBUyxDQUFDa0csUUFBUSxDQUFFLGdCQUFpQixDQUFDLEVBQUc7Y0FDekUsSUFBS1AsTUFBTSxFQUFHO2dCQUNiSyxHQUFHLENBQUNoRyxTQUFTLENBQUNtRyxHQUFHLENBQUUsbUJBQW9CLENBQUM7Y0FDekMsQ0FBQyxNQUFNO2dCQUNOSCxHQUFHLENBQUNoRyxTQUFTLENBQUNNLE1BQU0sQ0FBRSxtQkFBb0IsQ0FBQztjQUM1QztZQUNEO1VBQ0Q7UUFDRDtNQUNEOztNQUVBO0FBQ0g7QUFDQTtBQUNBO01BQ0csU0FBUzhFLHNCQUFzQkEsQ0FBQSxFQUFHO1FBQ2pDLElBQUkvTSxHQUFHLEdBQUd3RCxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBRTtRQUMvQixLQUFNLElBQUlrRSxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcyRCxVQUFVLENBQUM5RyxNQUFNLEVBQUVtRCxDQUFDLEVBQUUsRUFBRztVQUM3QyxJQUFJcUcsT0FBTyxHQUFLMUMsVUFBVSxDQUFDM0QsQ0FBQyxDQUFDLElBQUkyRCxVQUFVLENBQUMzRCxDQUFDLENBQUMsQ0FBQzVILEdBQUcsR0FBS2lDLE1BQU0sQ0FBRXNKLFVBQVUsQ0FBQzNELENBQUMsQ0FBQyxDQUFDNUgsR0FBSSxDQUFDLEdBQUdpQyxNQUFNLENBQUUvQixHQUFHLENBQUNGLEdBQUksQ0FBQztVQUN0RyxJQUFJd04sTUFBTSxHQUFNUyxPQUFPLEtBQUssUUFBVTtVQUN0Q1YsNEJBQTRCLENBQUUzRixDQUFDLEVBQUU0RixNQUFPLENBQUM7UUFDMUM7TUFDRDs7TUFFQTtBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO01BQ0csU0FBU3hCLDJCQUEyQkEsQ0FBRUQsWUFBWSxFQUFFbUMsT0FBTyxFQUFFQyxVQUFVLEVBQUc7UUFDekUsSUFBSyxDQUFFcEMsWUFBWSxFQUFHO1VBQUU7UUFBUTtRQUVoQyxJQUFJSCxZQUFZLEdBQUdHLFlBQVksQ0FBQ2hGLGdCQUFnQixDQUFFLCtCQUFnQyxDQUFDO1FBQ25GLElBQUlxSCxjQUFjLEdBQUdyQyxZQUFZLENBQUNoRixnQkFBZ0IsQ0FBRSxpQ0FBa0MsQ0FBQztRQUN2RixJQUFJc0gsVUFBVSxHQUFHLElBQUk7UUFFckIsS0FBTSxJQUFJQyxTQUFTLEdBQUcsQ0FBQyxFQUFFQSxTQUFTLEdBQUcxQyxZQUFZLENBQUNuSCxNQUFNLEVBQUU2SixTQUFTLEVBQUUsRUFBRztVQUN2RSxJQUFJQyxXQUFXLEdBQUczQyxZQUFZLENBQUUwQyxTQUFTLENBQUU7VUFDM0MsSUFBSUUsYUFBYSxHQUFHRCxXQUFXLENBQUN0RixZQUFZLENBQUUsNkJBQThCLENBQUMsS0FBS2lGLE9BQU87VUFDekZLLFdBQVcsQ0FBQzdHLFlBQVksQ0FBRSxlQUFlLEVBQUU4RyxhQUFhLEdBQUcsTUFBTSxHQUFHLE9BQVEsQ0FBQztVQUM3RUQsV0FBVyxDQUFDN0csWUFBWSxDQUFFLFVBQVUsRUFBRThHLGFBQWEsR0FBRyxHQUFHLEdBQUcsSUFBSyxDQUFDO1VBQ2xFLElBQUtBLGFBQWEsRUFBRztZQUNwQkgsVUFBVSxHQUFHRSxXQUFXO1VBQ3pCO1FBQ0Q7UUFFQSxLQUFNLElBQUlFLFdBQVcsR0FBRyxDQUFDLEVBQUVBLFdBQVcsR0FBR0wsY0FBYyxDQUFDM0osTUFBTSxFQUFFZ0ssV0FBVyxFQUFFLEVBQUc7VUFDL0UsSUFBSUMsYUFBYSxHQUFHTixjQUFjLENBQUVLLFdBQVcsQ0FBRTtVQUNqRCxJQUFLQyxhQUFhLENBQUN6RixZQUFZLENBQUUsK0JBQWdDLENBQUMsS0FBS2lGLE9BQU8sRUFBRztZQUNoRlEsYUFBYSxDQUFDeEcsZUFBZSxDQUFFLFFBQVMsQ0FBQztVQUMxQyxDQUFDLE1BQU07WUFDTndHLGFBQWEsQ0FBQ2hILFlBQVksQ0FBRSxRQUFRLEVBQUUsRUFBRyxDQUFDO1VBQzNDO1FBQ0Q7UUFFQXFFLFlBQVksQ0FBQ3JFLFlBQVksQ0FBRSxnQ0FBZ0MsRUFBRXdHLE9BQVEsQ0FBQztRQUN0RSxJQUFLQyxVQUFVLElBQUlFLFVBQVUsSUFBSUEsVUFBVSxDQUFDTSxLQUFLLEVBQUc7VUFDbkROLFVBQVUsQ0FBQ00sS0FBSyxDQUFDLENBQUM7UUFDbkI7TUFDRDs7TUFFQTtBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtNQUNHLFNBQVNDLDJCQUEyQkEsQ0FBRTdDLFlBQVksRUFBRW1DLE9BQU8sRUFBRztRQUM3RCxJQUFJVyxjQUFjLEdBQUcsQ0FBRXJILFFBQVEsQ0FBRXVFLFlBQVksQ0FBQzlDLFlBQVksQ0FBRSxjQUFlLENBQUMsRUFBRSxFQUFHLENBQUMsSUFBSSxDQUFDLElBQUssQ0FBQztRQUM3RixJQUFJNkYsYUFBYSxHQUFHL0MsWUFBWSxDQUFDOUMsWUFBWSxDQUFFLDBCQUEyQixDQUFDLElBQUksRUFBRTtRQUNqRixJQUFLNkYsYUFBYSxFQUFHO1VBQ3BCdkUsd0JBQXdCLENBQUVzRSxjQUFjLEdBQUcsR0FBRyxHQUFHQyxhQUFhLENBQUUsR0FBR1osT0FBTztVQUMxRWpFLElBQUksQ0FBQ08sK0JBQStCLEdBQUdELHdCQUF3QjtRQUNoRTtNQUNEOztNQUVBO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7TUFDRyxTQUFTd0UsOEJBQThCQSxDQUFFQyxZQUFZLEVBQUVqSyxTQUFTLEVBQUVYLFlBQVksRUFBRztRQUNoRixJQUFLLENBQUVyQixnQkFBZ0IsQ0FBRWdDLFNBQVUsQ0FBQyxFQUFHO1VBQUU7UUFBUTtRQUVqRCxJQUFJNkcsWUFBWSxHQUFHM0IsSUFBSSxDQUFDbEQsZ0JBQWdCLENBQUUsd0NBQXdDLEdBQUdoQyxTQUFTLEdBQUcsbUJBQW1CLEdBQUdpSyxZQUFZLEdBQUcsSUFBSyxDQUFDO1FBQzVJLEtBQU0sSUFBSUMsaUJBQWlCLEdBQUcsQ0FBQyxFQUFFQSxpQkFBaUIsR0FBR3JELFlBQVksQ0FBQ25ILE1BQU0sRUFBRXdLLGlCQUFpQixFQUFFLEVBQUc7VUFDL0YsSUFBSVYsV0FBVyxHQUFHM0MsWUFBWSxDQUFFcUQsaUJBQWlCLENBQUU7VUFDbkQsSUFBSUMsZ0JBQWdCLEdBQUdqTixNQUFNLENBQUVzTSxXQUFXLENBQUN0RixZQUFZLENBQUUsb0NBQXFDLENBQUMsSUFBSSxFQUFHLENBQUMsQ0FBQ2tHLEtBQUssQ0FBRSxLQUFNLENBQUM7VUFDdEgsSUFBSUMsa0JBQWtCLEdBQUcsS0FBSztVQUU5QixLQUFNLElBQUlDLGVBQWUsR0FBRyxDQUFDLEVBQUVBLGVBQWUsR0FBR0gsZ0JBQWdCLENBQUN6SyxNQUFNLEVBQUU0SyxlQUFlLEVBQUUsRUFBRztZQUM3RixJQUFJQyxlQUFlLEdBQUdKLGdCQUFnQixDQUFFRyxlQUFlLENBQUU7WUFDekQsSUFBS3RNLGdCQUFnQixDQUFFdU0sZUFBZ0IsQ0FBQyxJQUFJak0sZUFBZSxDQUFFaU0sZUFBZSxFQUFFbEwsWUFBWSxDQUFFa0wsZUFBZSxDQUFHLENBQUMsS0FBS3ZQLFNBQVMsQ0FBRXVQLGVBQWUsQ0FBRSxDQUFDcFAsR0FBRyxFQUFHO2NBQ3RKa1Asa0JBQWtCLEdBQUcsSUFBSTtjQUN6QjtZQUNEO1VBQ0Q7VUFFQSxJQUFJRyxjQUFjLEdBQUdoQixXQUFXLENBQUMxSCxhQUFhLENBQUUsa0NBQW1DLENBQUM7VUFDcEYsSUFBSTJJLG9CQUFvQixHQUFHakIsV0FBVyxDQUFDMUgsYUFBYSxDQUFFLHdDQUF5QyxDQUFDO1VBQ2hHMEgsV0FBVyxDQUFDMUcsU0FBUyxDQUFDQyxNQUFNLENBQUUsWUFBWSxFQUFFc0gsa0JBQW1CLENBQUM7VUFDaEUsSUFBS0csY0FBYyxFQUFHO1lBQUVBLGNBQWMsQ0FBQ0UsTUFBTSxHQUFHLENBQUVMLGtCQUFrQjtVQUFFO1VBQ3RFLElBQUtJLG9CQUFvQixFQUFHO1lBQUVBLG9CQUFvQixDQUFDQyxNQUFNLEdBQUcsQ0FBRUwsa0JBQWtCO1VBQUU7UUFDbkY7TUFDRDs7TUFFQTtNQUNBLElBQUlNLGlCQUFpQixHQUFHLEdBQUc7O01BRTNCO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO01BQ0csU0FBU0MsaUJBQWlCQSxDQUFDQyxPQUFPLEVBQUVDLE9BQU8sRUFBRUMsSUFBSSxFQUFFO1FBQ2xEQSxJQUFJLEdBQVFBLElBQUksSUFBSSxDQUFDLENBQUM7UUFDdEIsSUFBSUMsS0FBSyxHQUFJLE9BQU9ELElBQUksQ0FBQ0MsS0FBSyxLQUFLLFFBQVEsR0FBSUQsSUFBSSxDQUFDQyxLQUFLLEdBQUdMLGlCQUFpQjs7UUFFN0U7UUFDQSxJQUFLekYsSUFBSSxDQUFDK0YsZ0JBQWdCLEVBQUc7VUFDNUJDLFlBQVksQ0FBRWhHLElBQUksQ0FBQytGLGdCQUFpQixDQUFDO1FBQ3RDOztRQUVBO1FBQ0EsSUFBS0YsSUFBSSxDQUFDSSxVQUFVLEVBQUc7VUFDdEIzQyw0QkFBNEIsQ0FBRXFDLE9BQU8sRUFBRTNOLE1BQU0sQ0FBRTROLE9BQVEsQ0FBQyxLQUFLLFFBQVMsQ0FBQztRQUN4RTtRQUVBNUYsSUFBSSxDQUFDK0YsZ0JBQWdCLEdBQUdHLFVBQVUsQ0FBRSxZQUFZO1VBQy9DO1VBQ0EsSUFBSyxDQUFFTCxJQUFJLENBQUNJLFVBQVUsRUFBRztZQUN4QjNDLDRCQUE0QixDQUFFcUMsT0FBTyxFQUFFM04sTUFBTSxDQUFFNE4sT0FBUSxDQUFDLEtBQUssUUFBUyxDQUFDO1VBQ3hFO1VBQ0F0USxFQUFFLENBQUN1SyxzQkFBc0IsQ0FBQ0Msa0JBQWtCLENBQUVDLE9BQU8sRUFBRTVDLFVBQVUsRUFBRTZDLElBQUssQ0FBQztVQUN6RUEsSUFBSSxDQUFDK0YsZ0JBQWdCLEdBQUcsSUFBSTtRQUM3QixDQUFDLEVBQUVELEtBQU0sQ0FBQztNQUNYO01BR0EsU0FBU0ssTUFBTUEsQ0FBQ3BHLE9BQU8sRUFBRTVDLFVBQVUsRUFBRW1FLFVBQVUsRUFBRTtRQUNoRDtRQUNBLElBQUk4RSxlQUFlLEdBQUduRCwwQkFBMEIsQ0FBRTNCLFVBQVUsRUFBRTdILGdCQUFpQixDQUFDO1FBQ2hGLElBQUsyTSxlQUFlLEVBQUc7VUFDdEJqSixVQUFVLENBQUNNLFlBQVksQ0FBRSx1QkFBdUIsRUFBRSxHQUFJLENBQUM7UUFDeEQsQ0FBQyxNQUFNO1VBQ05OLFVBQVUsQ0FBQ2MsZUFBZSxDQUFFLHVCQUF3QixDQUFDO1FBQ3REOztRQUVBO1FBQ0FxRCxVQUFVLENBQUM5RyxNQUFNLEdBQUdrQyxRQUFRLENBQUVTLFVBQVcsQ0FBQzs7UUFFMUM7UUFDQSxJQUFJa0osUUFBUSxHQUFHbEQsdUJBQXVCLENBQUU3QixVQUFVLEVBQUU3SCxnQkFBaUIsQ0FBQztRQUN0RSxJQUFJNk0sSUFBSSxHQUFPaFIsRUFBRSxDQUFDMEgsc0JBQXNCLENBQUMwQixvQkFBb0IsQ0FBRTJILFFBQVMsQ0FBQztRQUN6RWxKLFVBQVUsQ0FBQ00sWUFBWSxDQUFFLGlCQUFpQixFQUFFNkksSUFBSyxDQUFDO1FBQ2xELElBQUtuSixVQUFVLENBQUMrQixPQUFPLEVBQUc7VUFDekIvQixVQUFVLENBQUMrQixPQUFPLENBQUNDLFVBQVUsR0FBR21ILElBQUk7UUFDckM7O1FBRUE7UUFDQWhSLEVBQUUsQ0FBQzBILHNCQUFzQixDQUFDcUMsS0FBSyxDQUFFbEMsVUFBVSxFQUFFbUUsVUFBVyxDQUFDOztRQUV6RDtRQUNBLElBQUt2QixPQUFPLElBQUlBLE9BQU8sQ0FBQ3dHLEdBQUcsSUFBSW5SLElBQUksQ0FBQ29SLGVBQWUsRUFBRztVQUNyRHpHLE9BQU8sQ0FBQ3dHLEdBQUcsQ0FBQ0UsSUFBSSxJQUFJMUcsT0FBTyxDQUFDd0csR0FBRyxDQUFDRSxJQUFJLENBQUVyUixJQUFJLENBQUNvUixlQUFlLENBQUNFLGdCQUFnQixFQUFFO1lBQzVFQyxNQUFNLEVBQUUsZUFBZTtZQUN2QkMsS0FBSyxFQUFHeko7VUFDVCxDQUFFLENBQUM7UUFDSjtNQUNEO01BR0EsU0FBUzBKLFNBQVNBLENBQUV2RSxDQUFDLEVBQUc7UUFDdkIsSUFBSXdFLENBQUMsR0FBS3hFLENBQUMsQ0FBQ3lFLE1BQU07UUFDbEI7UUFDRSxJQUFJRCxDQUFDLElBQUlBLENBQUMsQ0FBQzFQLElBQUksS0FBSyxPQUFPLElBQUlrTCxDQUFDLENBQUNsTCxJQUFJLEtBQUssT0FBTyxFQUFFO1FBRXJELElBQUlpQyxHQUFHLEdBQUd5TixDQUFDLElBQUlBLENBQUMsQ0FBQzlILFlBQVksQ0FBRSxnQkFBaUIsQ0FBQztRQUNqRCxJQUFLLENBQUUzRixHQUFHLElBQU0sQ0FBRVAsZ0JBQWdCLENBQUVPLEdBQUksQ0FBQyxJQUFJQSxHQUFHLEtBQUssY0FBZ0IsRUFBRztVQUFFO1FBQVE7UUFFbEYsSUFBSWlFLEdBQUcsR0FBR0MsUUFBUSxDQUFFdUosQ0FBQyxDQUFDOUgsWUFBWSxDQUFFLGNBQWUsQ0FBQyxFQUFFLEVBQUcsQ0FBQyxJQUFJLENBQUM7O1FBRS9EO1FBQ0EsSUFBSzNGLEdBQUcsS0FBSyxjQUFjLEVBQUc7VUFDN0IsSUFBSTJOLEtBQUssR0FBR2hQLE1BQU0sQ0FBRThPLENBQUMsQ0FBQ0csS0FBSyxJQUFJLEVBQUcsQ0FBQyxDQUFDL0IsS0FBSyxDQUFFLEdBQUksQ0FBQztVQUNoRCxJQUFJblAsR0FBRyxHQUFLaVIsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUs7VUFDN0IsSUFBSTdRLElBQUksR0FBSTZRLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxRQUFRO1VBRWhDMUYsVUFBVSxDQUFDaEUsR0FBRyxDQUFDLENBQUN2SCxHQUFHLEdBQUlxRCxlQUFlLENBQUUsS0FBSyxFQUFFckQsR0FBSSxDQUFDO1VBQ3BEdUwsVUFBVSxDQUFDaEUsR0FBRyxDQUFDLENBQUNuSCxJQUFJLEdBQUdpRCxlQUFlLENBQUUsTUFBTSxFQUFFakQsSUFBSyxDQUFDO1VBQ3REZ1EsTUFBTSxDQUFFcEcsT0FBTyxFQUFFNUMsVUFBVSxFQUFFbUUsVUFBVyxDQUFDO1VBRXpDb0UsaUJBQWlCLENBQUVwSSxHQUFHLEVBQUVnRSxVQUFVLENBQUNoRSxHQUFHLENBQUMsQ0FBQ3ZILEdBQUcsRUFBRTtZQUFFa1EsVUFBVSxFQUFFLElBQUk7WUFBRUgsS0FBSyxFQUFFTDtVQUFrQixDQUFFLENBQUM7VUFDN0Y7UUFDRDs7UUFFQTtRQUNBLElBQUl5QixnQkFBZ0IsR0FBR3BSLFNBQVMsQ0FBRXVELEdBQUcsQ0FBRSxJQUFJdkQsU0FBUyxDQUFFdUQsR0FBRyxDQUFFLENBQUNuRCxTQUFTO1FBQ3JFLElBQUs0USxDQUFDLENBQUNLLFlBQVksQ0FBRSxpQkFBa0IsQ0FBQyxLQUFNLEtBQUssS0FBS0QsZ0JBQWdCLElBQUksU0FBUyxLQUFLQSxnQkFBZ0IsQ0FBRSxFQUFHO1VBQzlHLElBQUlFLEtBQUssR0FBYXBILElBQUksQ0FBQ3BELGFBQWEsQ0FBRSxtQkFBbUIsR0FBR3ZELEdBQUcsR0FBRyw0Q0FBNEMsR0FBR2lFLEdBQUcsR0FBRyxJQUFLLENBQUM7VUFDakksSUFBSStKLE1BQU0sR0FBWXJILElBQUksQ0FBQ3BELGFBQWEsQ0FBRSxtQkFBbUIsR0FBR3ZELEdBQUcsR0FBRywyQ0FBMkMsR0FBR2lFLEdBQUcsR0FBRyxJQUFLLENBQUM7VUFDaEksSUFBSWdLLEdBQUcsR0FBZUYsS0FBSyxHQUFHcFAsTUFBTSxDQUFFb1AsS0FBSyxDQUFDSCxLQUFLLElBQUksRUFBRyxDQUFDLENBQUNoUCxJQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUU7VUFDckUsSUFBSXNQLElBQUksR0FBY0YsTUFBTSxHQUFHclAsTUFBTSxDQUFFcVAsTUFBTSxDQUFDSixLQUFLLElBQUksSUFBSyxDQUFDLENBQUNoUCxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUk7VUFDM0UsSUFBSWdILEdBQUcsR0FBZXFJLEdBQUcsR0FBS0EsR0FBRyxHQUFHQyxJQUFJLEdBQUssRUFBRTtVQUMvQ2pHLFVBQVUsQ0FBQ2hFLEdBQUcsQ0FBQyxDQUFDakUsR0FBRyxDQUFDLEdBQUdELGVBQWUsQ0FBRUMsR0FBRyxFQUFFNEYsR0FBSSxDQUFDO1VBQ2xELElBQUtxQyxVQUFVLENBQUNoRSxHQUFHLENBQUMsQ0FBQ2hELEtBQUssRUFBRztZQUM1QmdILFVBQVUsQ0FBQ2hFLEdBQUcsQ0FBQyxDQUFDaEQsS0FBSyxDQUFDakIsR0FBRyxDQUFDLEdBQUcsSUFBSTtVQUNsQztVQUNBYSw2QkFBNkIsQ0FBRW9ILFVBQVUsQ0FBQ2hFLEdBQUcsQ0FBQyxFQUFFakUsR0FBSSxDQUFDO1VBQ3JEOE0sTUFBTSxDQUFFcEcsT0FBTyxFQUFFNUMsVUFBVSxFQUFFbUUsVUFBVyxDQUFDO1VBQ3pDd0QsOEJBQThCLENBQUV4SCxHQUFHLEVBQUVqRSxHQUFHLEVBQUVpSSxVQUFVLENBQUNoRSxHQUFHLENBQUUsQ0FBQztVQUMzRDtRQUNEOztRQUVBO1FBQ0EsSUFBS2pFLEdBQUcsS0FBSyxLQUFLLEVBQUc7VUFDcEJpSSxVQUFVLENBQUNoRSxHQUFHLENBQUMsQ0FBQ3ZILEdBQUcsR0FBR3FELGVBQWUsQ0FBRSxLQUFLLEVBQUUwTixDQUFDLENBQUNHLEtBQU0sQ0FBQztVQUN2RGQsTUFBTSxDQUFFcEcsT0FBTyxFQUFFNUMsVUFBVSxFQUFFbUUsVUFBVyxDQUFDO1VBRXpDb0UsaUJBQWlCLENBQUVwSSxHQUFHLEVBQUVnRSxVQUFVLENBQUNoRSxHQUFHLENBQUMsQ0FBQ3ZILEdBQUcsRUFBRTtZQUFFa1EsVUFBVSxFQUFFLElBQUk7WUFBRUgsS0FBSyxFQUFFTDtVQUFrQixDQUFFLENBQUM7VUFDN0Y7UUFDRDs7UUFFQTtRQUNBbkUsVUFBVSxDQUFDaEUsR0FBRyxDQUFDLENBQUNqRSxHQUFHLENBQUMsR0FBR0QsZUFBZSxDQUFFQyxHQUFHLEVBQUV5TixDQUFDLENBQUNHLEtBQU0sQ0FBQztRQUN0RCxJQUFLM0YsVUFBVSxDQUFDaEUsR0FBRyxDQUFDLENBQUNoRCxLQUFLLEVBQUc7VUFDNUJnSCxVQUFVLENBQUNoRSxHQUFHLENBQUMsQ0FBQ2hELEtBQUssQ0FBQ2pCLEdBQUcsQ0FBQyxHQUFHLElBQUk7UUFDbEM7UUFDQSxJQUFLekIsa0JBQWtCLENBQUNZLE9BQU8sQ0FBRWEsR0FBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUc7VUFDL0NzQixpQ0FBaUMsQ0FBRTJHLFVBQVUsQ0FBQ2hFLEdBQUcsQ0FBRSxDQUFDO1FBQ3JEO1FBQ0E2SSxNQUFNLENBQUVwRyxPQUFPLEVBQUU1QyxVQUFVLEVBQUVtRSxVQUFXLENBQUM7UUFDekN3RCw4QkFBOEIsQ0FBRXhILEdBQUcsRUFBRWpFLEdBQUcsRUFBRWlJLFVBQVUsQ0FBQ2hFLEdBQUcsQ0FBRSxDQUFDO01BQzVEOztNQUVBO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO01BQ0csU0FBU2tLLHVCQUF1QkEsQ0FBRUMsYUFBYSxFQUFHO1FBQ2pELElBQUkxQyxZQUFZLEdBQUd4SCxRQUFRLENBQUVrSyxhQUFhLENBQUN6SSxZQUFZLENBQUUsY0FBZSxDQUFDLEVBQUUsRUFBRyxDQUFDO1FBQy9FLElBQUkvRCxjQUFjLEdBQUdqRCxNQUFNLENBQUV5UCxhQUFhLENBQUN6SSxZQUFZLENBQUUsaUJBQWtCLENBQUMsSUFBSSxFQUFHLENBQUMsQ0FBQ2tHLEtBQUssQ0FBRSxLQUFNLENBQUM7UUFFbkcsSUFBS3dDLEtBQUssQ0FBRTNDLFlBQWEsQ0FBQyxJQUFJQSxZQUFZLEdBQUcsQ0FBQyxJQUFJQSxZQUFZLElBQUl6RCxVQUFVLENBQUM5RyxNQUFNLEVBQUc7VUFDckYsT0FBTyxLQUFLO1FBQ2I7UUFFQSxJQUFJTCxZQUFZLEdBQUdtSCxVQUFVLENBQUV5RCxZQUFZLENBQUU7UUFDN0MsSUFBSTdKLFVBQVUsR0FBRzVGLEVBQUUsQ0FBQzBILHNCQUFzQixDQUFDQyxnQkFBZ0IsQ0FBRTlDLFlBQVksRUFBRWMsY0FBZSxDQUFDO1FBQzNGLElBQUssQ0FBRUMsVUFBVSxDQUFDVixNQUFNLEVBQUc7VUFDMUIsT0FBTyxLQUFLO1FBQ2I7UUFFQSxJQUFJbU4sY0FBYyxHQUFHLHFEQUFxRCxHQUFHNUMsWUFBWSxHQUFHLHNCQUFzQixHQUFHN0osVUFBVSxDQUFDME0sSUFBSSxDQUFFLEdBQUksQ0FBQyxHQUFHLElBQUk7UUFDbEp6QixNQUFNLENBQUVwRyxPQUFPLEVBQUU1QyxVQUFVLEVBQUVtRSxVQUFXLENBQUM7UUFDekNoTSxFQUFFLENBQUN1SyxzQkFBc0IsQ0FBQ0Msa0JBQWtCLENBQUVDLE9BQU8sRUFBRTVDLFVBQVUsRUFBRTZDLElBQUssQ0FBQztRQUV6RSxJQUFJNkgsZ0JBQWdCLEdBQUc3SCxJQUFJLENBQUNwRCxhQUFhLENBQUUrSyxjQUFlLENBQUM7UUFDM0QsSUFBS0UsZ0JBQWdCLElBQUlBLGdCQUFnQixDQUFDbkQsS0FBSyxFQUFHO1VBQ2pEbUQsZ0JBQWdCLENBQUNuRCxLQUFLLENBQUMsQ0FBQztRQUN6QjtRQUNBLE9BQU8sSUFBSTtNQUNaO01BR0EsU0FBU29ELFFBQVFBLENBQUV4RixDQUFDLEVBQUc7UUFDdEIsSUFBSWdDLFdBQVcsR0FBR2hDLENBQUMsQ0FBQ3lFLE1BQU0sQ0FBQ2dCLE9BQU8sQ0FBRSwrQkFBZ0MsQ0FBQztRQUNyRSxJQUFLekQsV0FBVyxJQUFJdEUsSUFBSSxDQUFDOEQsUUFBUSxDQUFFUSxXQUFZLENBQUMsRUFBRztVQUNsRCxJQUFJeEMsWUFBWSxHQUFHd0MsV0FBVyxDQUFDeUQsT0FBTyxDQUFFLDRCQUE2QixDQUFDO1VBQ3RFLElBQUlDLGVBQWUsR0FBRzFELFdBQVcsQ0FBQ3RGLFlBQVksQ0FBRSw2QkFBOEIsQ0FBQyxJQUFJLEVBQUU7VUFDckZzRCxDQUFDLENBQUMyRixjQUFjLENBQUMsQ0FBQztVQUNsQmxHLDJCQUEyQixDQUFFRCxZQUFZLEVBQUVrRyxlQUFlLEVBQUUsS0FBTSxDQUFDO1VBQ25FckQsMkJBQTJCLENBQUU3QyxZQUFZLEVBQUVrRyxlQUFnQixDQUFDO1VBQzVEO1FBQ0Q7UUFFQSxJQUFJRSxjQUFjLEdBQUc1RixDQUFDLENBQUN5RSxNQUFNLENBQUNnQixPQUFPLENBQUUsc0NBQXVDLENBQUM7UUFDL0UsSUFBS0csY0FBYyxJQUFJbEksSUFBSSxDQUFDOEQsUUFBUSxDQUFFb0UsY0FBZSxDQUFDLEVBQUc7VUFDeEQ1RixDQUFDLENBQUMyRixjQUFjLENBQUMsQ0FBQztVQUNsQlQsdUJBQXVCLENBQUVVLGNBQWUsQ0FBQztVQUN6QztRQUNEO1FBRUEsSUFBSUMsR0FBRyxHQUFHN0YsQ0FBQyxDQUFDeUUsTUFBTSxDQUFDZ0IsT0FBTyxDQUFFLGlDQUFrQyxDQUFDO1FBQy9ELElBQUssQ0FBRUksR0FBRyxFQUFHO1VBQUU7UUFBUTs7UUFFdkI7UUFDQWhMLFVBQVUsQ0FBQ2MsZUFBZSxDQUFFLHVCQUF3QixDQUFDO1FBQ3JEZCxVQUFVLENBQUNjLGVBQWUsQ0FBRSxpQkFBa0IsQ0FBQztRQUMvQyxJQUFLZCxVQUFVLENBQUMrQixPQUFPLEVBQUc7VUFBRSxPQUFPL0IsVUFBVSxDQUFDK0IsT0FBTyxDQUFDQyxVQUFVO1FBQUU7UUFFbEU3SixFQUFFLENBQUMwSCxzQkFBc0IsQ0FBQ3FDLEtBQUssQ0FBRWxDLFVBQVUsRUFBRSxFQUFHLENBQUM7O1FBRWpEO1FBQ0E3SCxFQUFFLENBQUN1SyxzQkFBc0IsQ0FBQ0Msa0JBQWtCLENBQUVDLE9BQU8sRUFBRTVDLFVBQVUsRUFBRTZDLElBQUssQ0FBQztRQUV6RSxJQUFLRCxPQUFPLElBQUlBLE9BQU8sQ0FBQ3dHLEdBQUcsSUFBSW5SLElBQUksQ0FBQ29SLGVBQWUsRUFBRztVQUNyRHpHLE9BQU8sQ0FBQ3dHLEdBQUcsQ0FBQ0UsSUFBSSxJQUFJMUcsT0FBTyxDQUFDd0csR0FBRyxDQUFDRSxJQUFJLENBQUVyUixJQUFJLENBQUNvUixlQUFlLENBQUNFLGdCQUFnQixFQUFFO1lBQUVDLE1BQU0sRUFBRyxxQkFBcUI7WUFBRUMsS0FBSyxFQUFHeko7VUFBVyxDQUFFLENBQUM7UUFDdEk7TUFDRDs7TUFFQTtBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7TUFDRyxTQUFTaUwsVUFBVUEsQ0FBRTlGLENBQUMsRUFBRztRQUN4QixJQUFJZ0MsV0FBVyxHQUFHaEMsQ0FBQyxDQUFDeUUsTUFBTSxDQUFDZ0IsT0FBTyxDQUFFLCtCQUFnQyxDQUFDO1FBQ3JFLElBQUssQ0FBRXpELFdBQVcsSUFBSSxDQUFFdEUsSUFBSSxDQUFDOEQsUUFBUSxDQUFFUSxXQUFZLENBQUMsRUFBRztVQUFFO1FBQVE7UUFDakUsSUFBSyxDQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBRSxDQUFDOUwsT0FBTyxDQUFFOEosQ0FBQyxDQUFDakosR0FBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUc7VUFBRTtRQUFRO1FBRXRGLElBQUl5SSxZQUFZLEdBQUd3QyxXQUFXLENBQUN5RCxPQUFPLENBQUUsNEJBQTZCLENBQUM7UUFDdEUsSUFBSXBHLFlBQVksR0FBR3hHLEtBQUssQ0FBQ2xDLFNBQVMsQ0FBQ29QLEtBQUssQ0FBQ2xQLElBQUksQ0FBRTJJLFlBQVksQ0FBQ2hGLGdCQUFnQixDQUFFLCtCQUFnQyxDQUFFLENBQUM7UUFDakgsSUFBSXdMLFlBQVksR0FBRzNHLFlBQVksQ0FBQ25KLE9BQU8sQ0FBRThMLFdBQVksQ0FBQztRQUN0RCxJQUFLZ0UsWUFBWSxHQUFHLENBQUMsRUFBRztVQUFFO1FBQVE7UUFFbEMsSUFBSUMsVUFBVSxHQUFHRCxZQUFZO1FBQzdCLElBQUssTUFBTSxLQUFLaEcsQ0FBQyxDQUFDakosR0FBRyxFQUFHO1VBQ3ZCa1AsVUFBVSxHQUFHLENBQUM7UUFDZixDQUFDLE1BQU0sSUFBSyxLQUFLLEtBQUtqRyxDQUFDLENBQUNqSixHQUFHLEVBQUc7VUFDN0JrUCxVQUFVLEdBQUc1RyxZQUFZLENBQUNuSCxNQUFNLEdBQUcsQ0FBQztRQUNyQyxDQUFDLE1BQU0sSUFBSyxZQUFZLEtBQUs4SCxDQUFDLENBQUNqSixHQUFHLEVBQUc7VUFDcENrUCxVQUFVLEdBQUcsQ0FBRUQsWUFBWSxHQUFHLENBQUMsSUFBSzNHLFlBQVksQ0FBQ25ILE1BQU07UUFDeEQsQ0FBQyxNQUFNO1VBQ04rTixVQUFVLEdBQUcsQ0FBRUQsWUFBWSxHQUFHLENBQUMsR0FBRzNHLFlBQVksQ0FBQ25ILE1BQU0sSUFBS21ILFlBQVksQ0FBQ25ILE1BQU07UUFDOUU7UUFFQThILENBQUMsQ0FBQzJGLGNBQWMsQ0FBQyxDQUFDO1FBQ2xCLElBQUlPLFlBQVksR0FBRzdHLFlBQVksQ0FBRTRHLFVBQVUsQ0FBRSxDQUFDdkosWUFBWSxDQUFFLDZCQUE4QixDQUFDLElBQUksRUFBRTtRQUNqRytDLDJCQUEyQixDQUFFRCxZQUFZLEVBQUUwRyxZQUFZLEVBQUUsSUFBSyxDQUFDO1FBQy9EN0QsMkJBQTJCLENBQUU3QyxZQUFZLEVBQUUwRyxZQUFhLENBQUM7TUFDMUQ7TUFFQXhJLElBQUksQ0FBQ3FDLGdCQUFnQixDQUFFLE9BQU8sRUFBRXdFLFNBQVMsRUFBRSxJQUFLLENBQUM7TUFDakQ3RyxJQUFJLENBQUNxQyxnQkFBZ0IsQ0FBRSxRQUFRLEVBQUV3RSxTQUFTLEVBQUUsSUFBSyxDQUFDO01BQ2xEN0csSUFBSSxDQUFDcUMsZ0JBQWdCLENBQUUsT0FBTyxFQUFFeUYsUUFBUSxFQUFFLElBQUssQ0FBQztNQUNoRDlILElBQUksQ0FBQ3FDLGdCQUFnQixDQUFFLFNBQVMsRUFBRStGLFVBQVUsRUFBRSxJQUFLLENBQUM7O01BRXBEO01BQ0E5UyxFQUFFLENBQUMwSCxzQkFBc0IsQ0FBQ3FDLEtBQUssQ0FBRWxDLFVBQVUsRUFBRW1FLFVBQVcsQ0FBQzs7TUFFekQ7TUFDQXRCLElBQUksQ0FBQ2MsY0FBYyxHQUFHLFlBQVk7UUFDakMsSUFBSTtVQUNIZCxJQUFJLENBQUN5SSxtQkFBbUIsQ0FBRSxPQUFPLEVBQUU1QixTQUFTLEVBQUUsSUFBSyxDQUFDO1VBQ3BEN0csSUFBSSxDQUFDeUksbUJBQW1CLENBQUUsUUFBUSxFQUFFNUIsU0FBUyxFQUFFLElBQUssQ0FBQztVQUNyRDdHLElBQUksQ0FBQ3lJLG1CQUFtQixDQUFFLE9BQU8sRUFBRVgsUUFBUSxFQUFFLElBQUssQ0FBQztVQUNuRDlILElBQUksQ0FBQ3lJLG1CQUFtQixDQUFFLFNBQVMsRUFBRUwsVUFBVSxFQUFFLElBQUssQ0FBQztRQUN4RCxDQUFDLENBQUMsT0FBUXJMLEVBQUUsRUFBRyxDQUFDO01BQ2pCLENBQUM7SUFDRixDQUFDO0lBRUQ7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRTJMLG1CQUFtQixFQUFHLFNBQUFBLENBQVczSSxPQUFPLEVBQUU1QyxVQUFVLEVBQUV3TCxjQUFjLEVBQUc7TUFDdEUsSUFBSTNJLElBQUksR0FBRzJJLGNBQWMsSUFBSUEsY0FBYyxDQUFDL0wsYUFBYSxDQUFFLGlDQUFrQyxDQUFDO01BQzlGLElBQUssQ0FBRW9ELElBQUksRUFBRztRQUFFO01BQVE7TUFDeEIsSUFBSSxDQUFDRixrQkFBa0IsQ0FBRUMsT0FBTyxFQUFFNUMsVUFBVSxFQUFFNkMsSUFBSyxDQUFDO0lBQ3JEO0VBQ0QsQ0FBQzs7RUFFRDtFQUNBN0ssQ0FBQyxDQUFDeVQsZ0NBQWdDLEdBQUd6VCxDQUFDLENBQUN5VCxnQ0FBZ0MsSUFBSSxDQUFDLENBQUM7RUFDN0V6VCxDQUFDLENBQUN5VCxnQ0FBZ0MsQ0FBQ0MsYUFBYSxHQUFHLFVBQVc3SSxJQUFJLEVBQUU2RixJQUFJLEVBQUc7SUFDMUUsSUFBSTtNQUNILElBQUk5RixPQUFPLEdBQVE4RixJQUFJLElBQUlBLElBQUksQ0FBQzlGLE9BQU8sSUFBTTVLLENBQUMsQ0FBQzJULFFBQVEsSUFBSSxJQUFJO01BQy9ELElBQUkzTCxVQUFVLEdBQUswSSxJQUFJLElBQUlBLElBQUksQ0FBQ2xKLEVBQUUsSUFBUW9ELE9BQU8sSUFBSUEsT0FBTyxDQUFDZ0osa0JBQWtCLElBQUloSixPQUFPLENBQUNnSixrQkFBa0IsQ0FBQyxDQUFHLElBQUksSUFBSTtNQUN6SHpULEVBQUUsQ0FBQ3VLLHNCQUFzQixDQUFDQyxrQkFBa0IsQ0FBRUMsT0FBTyxFQUFFNUMsVUFBVSxFQUFFNkMsSUFBSyxDQUFDO0lBQzFFLENBQUMsQ0FBQyxPQUFRc0MsQ0FBQyxFQUFHO01BQ2JuTixDQUFDLENBQUM2VCxLQUFLLElBQUk3VCxDQUFDLENBQUM2VCxLQUFLLENBQUNDLEdBQUcsSUFBSTlULENBQUMsQ0FBQzZULEtBQUssQ0FBQ0MsR0FBRyxDQUFDQyxLQUFLLElBQUkvVCxDQUFDLENBQUM2VCxLQUFLLENBQUNDLEdBQUcsQ0FBQ0MsS0FBSyxDQUFFLGdEQUFnRCxFQUFFNUcsQ0FBRSxDQUFDO0lBQ3hIO0VBQ0QsQ0FBQztBQUVGLENBQUMsRUFBR04sTUFBTyxDQUFDIiwiaWdub3JlTGlzdCI6W119
