"use strict";

/**
 * @file: ../includes/page-form-builder/_out/export/builder-exporter.js
 */
(function () {
  "use strict";

  const core = window.WPBC_BFB_Core || {};

  // == Helpers — Shared helper API for field packs ==================================================================
  // =================================================================================================
  // == These are generic utilities that packs can call from their own exporters:
  // ==  - compute_name(), id_option(), class_options(), size_max_token(), emit_time_select(), etc.
  // == No field-type branching should live in the core exporter.
  // =================================================================================================

  /**
   * Default skip list (can be extended/overridden at runtime).
   * - Only attribute NAMES here (case-insensitive). Values are removed with them.
   */
  const wpbc_export_skip_attrs_default = ['data-colstyles-active'];

  /**
   * Remove attributes by name from an HTML-like string.
   * Matches:
   *   - name
   *   - name="..."/name='...'/name=value
   * with any surrounding whitespace.
   *
   * @param {string} html
   * @param {string[]} attrs_lowercase   attribute names (lowercase)
   * @return {string}
   */
  function strip_attributes_from_markup(html, attrs_lowercase) {
    if (!html || !attrs_lowercase?.length) return html;
    let out = String(html);
    for (const rawName of attrs_lowercase) {
      if (!rawName) continue;
      const name = String(rawName).toLowerCase().trim();
      // Escape for regex
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match full attribute name only (next char is NOT a valid name char)
      const re = new RegExp(`\\s${esc}(?![A-Za-z0-9_:\\-])(?:=(?:"[^"]*"|'[^']*'|[^\\s>]*))?`, 'gi');
      out = out.replace(re, '');
    }
    return out;
  }

  // == Helpers – column styles parsing & CSS vars builder ===========================================================
  var wpbc_column_overflow_values = ['visible', 'auto', 'hidden'];

  /**
   * Constrain a column spacing length to units supported by the Inspector.
   *
   * @param {*} candidate_value Saved column-style value.
   * @returns {string} Valid non-negative CSS length or `0px`.
   */
  function normalize_column_length(candidate_value) {
    var normalized_value = String(candidate_value == null ? '' : candidate_value).trim();
    if (/^\d+(\.\d+)?$/.test(normalized_value)) {
      return normalized_value + 'px';
    }
    return /^\d+(\.\d+)?(px|rem|em|%)$/.test(normalized_value) ? normalized_value : '0px';
  }

  /**
   * Constrain an optional column maximum dimension.
   *
   * @param {*} candidate_value Saved column-style value.
   * @returns {string} Valid maximum dimension or `none`.
   */
  function normalize_column_maximum(candidate_value) {
    var normalized_value = String(candidate_value == null ? '' : candidate_value).trim();
    if (!normalized_value || 'none' === normalized_value) {
      return 'none';
    }
    if (/^\d+(\.\d+)?$/.test(normalized_value)) {
      return normalized_value + 'px';
    }
    return /^\d+(\.\d+)?(px|rem|em|%|vh|vw)$/.test(normalized_value) ? normalized_value : 'none';
  }

  /**
   * Constrain column overflow to the Inspector allowlist.
   *
   * @param {*} candidate_value Saved column-style value.
   * @returns {string} Allowlisted overflow value.
   */
  function normalize_column_overflow(candidate_value) {
    var normalized_value = String(candidate_value || '');
    return wpbc_column_overflow_values.indexOf(normalized_value) !== -1 ? normalized_value : wpbc_column_overflow_values[0];
  }

  // Known keys we treat as real per-column style overrides.
  function has_non_default_col_styles(obj) {
    if (!obj || typeof obj !== 'object') {
      return false;
    }
    var keys = ['dir', 'wrap', 'jc', 'ai', 'gap', 'padding', 'margin', 'padding_top', 'padding_right', 'padding_bottom', 'padding_left', 'margin_top', 'margin_right', 'margin_bottom', 'margin_left', 'max_width', 'max_height', 'overflow', 'overflow_x', 'overflow_y', 'aself', 'ac'];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (obj[k] != null && String(obj[k]).trim() !== '') {
        return true;
      }
    }
    return false;
  }

  /**
   * Parse `col_styles` coming from a Section.
   * Accepts: JSON string or array of objects.
   *
   * @param {string|Array|undefined|null} raw
   * @returns {Array<Object>} array aligned to columns (may be empty)
   */
  function parse_col_styles_json(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(function (x) {
      return x && typeof x === 'object';
    });
    if (typeof raw === 'string') {
      try {
        var arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr.filter(function (x) {
          return x && typeof x === 'object';
        }) : [];
      } catch (_e) {
        return [];
      }
    }
    return [];
  }

  /**
   * Build CSS variable declarations string for a column style object.
   * Known keys -> CSS vars:
   *  - dir  -> --wpbc-bfb-col-dir
   *  - wrap -> --wpbc-bfb-col-wrap
   *  - jc   -> --wpbc-bfb-col-jc
   *  - ai   -> --wpbc-bfb-col-ai
   *  - gap  -> --wpbc-bfb-col-gap
   *  - padding -> --wpbc-bfb-col-padding
   *  - margin  -> --wpbc-bfb-col-margin
   *  - padding_top/right/bottom/left -> --wpbc-bfb-col-padding-*
   *  - margin_top/right/bottom/left  -> --wpbc-bfb-col-margin-*
   *  - max_width  -> --wpbc-bfb-col-max-width
   *  - max_height -> --wpbc-bfb-col-max-height
   *  - overflow   -> --wpbc-bfb-col-overflow
   *  - overflow_x -> --wpbc-bfb-col-overflow-x
   *  - overflow_y -> --wpbc-bfb-col-overflow-y
   *  - ac   -> --wpbc-bfb-col-ac
   *  - aself-> --wpbc-bfb-col-aself
   *
   * Unknown keys are exported as `--wpbc-bfb-col-${key}`.
   *
   * @param {Object|null|undefined} obj
   * @returns {string} e.g. "--wpbc-bfb-col-dir: row; --wpbc-bfb-col-wrap: wrap;"
   */
  function build_col_css_vars(obj) {
    if (!obj || typeof obj !== 'object') return '';
    var map = {
      dir: '--wpbc-bfb-col-dir',
      wrap: '--wpbc-bfb-col-wrap',
      jc: '--wpbc-bfb-col-jc',
      ai: '--wpbc-bfb-col-ai',
      gap: '--wpbc-bfb-col-gap',
      padding: '--wpbc-bfb-col-padding',
      margin: '--wpbc-bfb-col-margin',
      padding_top: '--wpbc-bfb-col-padding-top',
      padding_right: '--wpbc-bfb-col-padding-right',
      padding_bottom: '--wpbc-bfb-col-padding-bottom',
      padding_left: '--wpbc-bfb-col-padding-left',
      margin_top: '--wpbc-bfb-col-margin-top',
      margin_right: '--wpbc-bfb-col-margin-right',
      margin_bottom: '--wpbc-bfb-col-margin-bottom',
      margin_left: '--wpbc-bfb-col-margin-left',
      max_width: '--wpbc-bfb-col-max-width',
      max_height: '--wpbc-bfb-col-max-height',
      overflow: '--wpbc-bfb-col-overflow',
      overflow_x: '--wpbc-bfb-col-overflow-x',
      overflow_y: '--wpbc-bfb-col-overflow-y',
      ac: '--wpbc-bfb-col-ac',
      aself: '--wpbc-bfb-col-aself'
    };
    var parts = [];
    for (var k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      // Ignore the removed experimental child-flex setting in previously saved Builder JSON.
      if ('item_flex' === k) continue;
      var v = obj[k];
      if (v == null || v === '') continue;
      if (['padding_top', 'padding_right', 'padding_bottom', 'padding_left', 'margin_top', 'margin_right', 'margin_bottom', 'margin_left'].indexOf(k) !== -1) {
        v = normalize_column_length(v);
      } else if ('max_width' === k || 'max_height' === k) {
        v = normalize_column_maximum(v);
      } else if (['overflow', 'overflow_x', 'overflow_y'].indexOf(k) !== -1) {
        v = normalize_column_overflow(v);
      }
      var var_name = map[k] || '--wpbc-bfb-col-' + String(k).replace(/[^a-z0-9_-]/gi, '').toLowerCase();
      parts.push(var_name + ': ' + String(v));
    }

    // Always include explicit min guard (requested): --wpbc-col-min: 0px;
    parts.push('--wpbc-col-min: 0px');
    return parts.join(';') + (parts.length ? ';' : '');
  }

  /**
   * Resolve numeric percent from a width token like "48.5%".
   * Falls back to `fallback_percent` if not in percent format.
   *
   * @param {string|number|undefined|null} width_token
   * @param {number} fallback_percent
   * @returns {number}
   */
  function resolve_flex_basis_percent(width_token, fallback_percent) {
    if (typeof width_token === 'string') {
      var s = width_token.trim();
      if (s.endsWith('%')) {
        var p = parseFloat(s);
        if (isFinite(p)) return p;
      }
    }
    if (typeof width_token === 'number' && isFinite(width_token)) {
      return width_token;
    }
    return fallback_percent;
  }

  /**
   * Compute effective flex-basis values that respect inter-column gap
   *
   * @param columns
   * @param gap_percent
   * @returns {*}
   */
  function compute_effective_bases(columns, gap_percent = 3) {
    const n = columns && columns.length ? columns.length : 1;
    const raw = columns.map(col => {
      const w = col && col.width != null ? String(col.width).trim() : '';
      const p = w.endsWith('%') ? parseFloat(w) : w ? parseFloat(w) : NaN;
      return Number.isFinite(p) ? p : 100 / n;
    });
    const sum_raw = raw.reduce((a, b) => a + b, 0) || 100;
    const gp = Number.isFinite(+gap_percent) ? +gap_percent : 3;
    const total_gaps = Math.max(0, n - 1) * gp;
    const available = Math.max(0, 100 - total_gaps);
    const scale_ratio = available / sum_raw;
    return raw.map(p => Math.max(0, p * scale_ratio));
  }

  // == adapter: builder (array-of-pages) > exporter shape { pages: [ { items:[ {kind,data} ] } ] } ==================
  function adapt_builder_structure_to_exporter(structure) {
    //		if ( !Array.isArray( structure ) ) return { pages: [] };

    // Ensure at least one page exists, even when Builder structure is empty `[]`.
    // This keeps exported Advanced Form valid (wizard step #1 exists).
    if (!Array.isArray(structure) || structure.length === 0) {
      return {
        pages: [{
          items: []
        }]
      };
    }
    const normalize_options = opts => {
      if (!Array.isArray(opts)) return [];
      return opts.map(o => {
        if (typeof o === 'string') return {
          label: o,
          value: o,
          selected: false
        };
        if (o && typeof o === 'object') {
          return {
            label: String(o.label ?? o.value ?? ''),
            value: String(o.value ?? o.label ?? ''),
            selected: !!o.selected
          };
        }
        return {
          label: String(o),
          value: String(o),
          selected: false
        };
      });
    };

    // =================================================================================================
    // == Adapter – attach parsed per-column `col_styles` from Section into each column
    // =================================================================================================
    const walk_section = sec => {
      const section_col_styles = parse_col_styles_json(sec && sec.col_styles);
      return {
        id: sec?.id,
        html_id: sec?.html_id || '',
        cssclass: sec?.cssclass || '',
        columns: (sec?.columns || []).map((col, col_index) => {
          const items = Array.isArray(col?.items) ? col.items : [...(col?.fields || []).map(f => ({
            type: 'field',
            data: f
          })), ...(col?.sections || []).map(s => ({
            type: 'section',
            data: s
          }))];
          const fields = items.filter(it => it && it.type === 'field').map(it => ({
            ...it.data,
            options: normalize_options(it.data?.options)
          }));
          const sections = items.filter(it => it && it.type === 'section').map(it => walk_section(it.data));
          return {
            width: col?.width || '100%',
            style: col?.style || null,
            col_styles: section_col_styles[col_index] || null,
            // <- attach style object per column
            fields,
            sections
          };
        })
      };
    };
    const pages = structure.map(page => {
      const items = [];
      (page?.content || []).forEach(item => {
        if (!item) return;
        if (item.type === 'section' && item.data) {
          items.push({
            kind: 'section',
            data: walk_section(item.data)
          });
        } else if (item.type === 'field' && item.data) {
          items.push({
            kind: 'field',
            data: {
              ...item.data,
              options: normalize_options(item.data.options)
            }
          });
        }
      });
      return {
        items
      };
    });
    return {
      pages
    };
  }

  // == Booking From Exporter ========================================================================================
  class WPBC_BFB_Exporter {
    /**
     * Mutable skip-list for attribute names (lowercase).
     * You can override it via set_skip_attrs() or add with add_skip_attrs().
     * @type {Set<string>}
     */
    static skip_attrs = new Set();

    /**
     * Replace the entire skip list.
     * @param {string[]} arr
     */
    static set_skip_attrs(arr) {
      this.skip_attrs = new Set((Array.isArray(arr) ? arr : []).map(n => String(n).toLowerCase().trim()).filter(Boolean));
    }

    /**
     * Add one or many attributes to the skip list.
     * @param {string|string[]} names
     */
    static add_skip_attrs(names) {
      (Array.isArray(names) ? names : [names]).map(n => String(n).toLowerCase().trim()).filter(Boolean).forEach(n => this.skip_attrs.add(n));
    }

    /**
     * Remove one attribute from the skip list.
     * @param {string} name
     */
    static remove_skip_attr(name) {
      if (!name) {
        return;
      }
      this.skip_attrs.delete(String(name).toLowerCase().trim());
    }

    /**
     * Apply attribute skipping to a final HTML string.
     * @param {string} html
     * @return {string}
     */
    static sanitize_export(html) {
      return strip_attributes_from_markup(html, Array.from(this.skip_attrs));
    }

    /**
     * Export adapted structure to advanced form text (with <r>/<c> layout and wizard wrapper).
     *
     * @param {Object} adapted
     * @param {Object} [options]
     * @param {string}  [options.newline="\n"]
     * @param {boolean} [options.addLabels=true]
     * @param {number}  [options.gapPercent=3]
     * @returns {string}
     */
    static export_form(adapted, options = {}) {
      // indent: use real TAB by default (can be overridden via options.indent)
      const cfg = {
        newline: '\n',
        addLabels: true,
        gapPercent: 3,
        indent: '\t',
        ...options
      };
      const IND = typeof cfg.indent === 'string' ? cfg.indent : '\t';
      let depth = 0;
      const lines = [];
      const push = (s = '') => lines.push(IND.repeat(depth) + String(s));
      const open = (s = '') => {
        push(s);
        depth++;
      };
      const close = (s = '') => {
        depth = Math.max(0, depth - 1);
        push(s);
      };
      const blank = () => {
        lines.push('');
      };
      if (!adapted || !Array.isArray(adapted.pages)) return '';

      // Always export at least one wizard step to keep Advanced Form structure valid.
      const pages = adapted.pages.length ? adapted.pages : [{
        items: []
      }];
      const ctx = {
        usedIds: new Set()
      };
      open(`<div class="wpbc_bfb_form wpbc_wizard__border_container">`);

      // one-per-form guards (calendar is not gated here)
      const once = {
        captcha: 0,
        country: 0,
        coupon: 0,
        cost_corrections: 0,
        submit: 0
      };
      pages.forEach((page, page_index) => {
        const is_first = page_index === 0;
        const step_num = page_index + 1;
        const hidden_class = is_first ? '' : ' wpbc_wizard_step_hidden';
        const hidden_style = is_first ? '' : ' style="display:none;clear:both;"';
        open(`<div class="wpbc_wizard_step wpbc__form__div wpbc_wizard_step${step_num}${hidden_class}"${hidden_style}>`);
        (page.items || []).forEach(item => {
          if (item.kind === 'section') {
            WPBC_BFB_Exporter.render_section(item.data, {
              open,
              close,
              push,
              blank
            }, cfg, once, ctx);
            // blank();
          } else if (item.kind === 'field') {
            open(`<r>`);
            open(`<c>`);
            WPBC_BFB_Exporter.render_field_node(item.data, {
              open,
              close,
              push,
              blank
            }, cfg, once, ctx);
            close(`</c>`);
            close(`</r>`);
            // blank();
          }
        });
        close(`</div>`);
      });
      close(`</div>`);
      return WPBC_BFB_Exporter.sanitize_export(lines.join(cfg.newline));
    }

    /**
     * High-level helper: export full package from raw Builder structure.
     *
     * - Adapts raw Builder structure (pages/sections/columns/items) for exporters.
     * - Builds:
     *      • advanced_form  -> “Advanced Form (export)” text.
     *      • fields_data    -> “Content of booking fields data (export)” text.
     *
     * @param {Array}  structure  Raw Builder structure from wpbc_bfb.get_structure().
     * @param {Object} [options]
     * @param {number} [options.gapPercent=3]  Column gap percent for layout math.
     *
     * @returns {{
     *   advanced_form: string,
     *   fields_data: string,
     *   structure: Array,
     *   adapted: Object
     * }}
     */
    static export_all(structure, options = {}) {
      // 1) Adapt Builder JSON to exporter shape (pages[] -> items[]).
      const adapted = adapt_builder_structure_to_exporter(structure || []);

      // 2) Advanced Form text (same logic as debug panel).
      const gap_percent = options && typeof options.gapPercent === 'number' ? options.gapPercent : 3;
      const advanced_form = WPBC_BFB_Exporter.export_form(adapted, {
        addLabels: true,
        gapPercent: gap_percent
      });

      // 3) Content of booking fields data (if content exporter is available).
      let fields_data = '';
      if (window.WPBC_BFB_ContentExporter && typeof window.WPBC_BFB_ContentExporter.export_content === 'function') {
        fields_data = window.WPBC_BFB_ContentExporter.export_content(adapted, {
          addLabels: true,
          sep: ': '
        });
      }
      return {
        advanced_form: advanced_form || '',
        fields_data: fields_data || '',
        structure: structure || [],
        adapted: adapted
      };
    }

    // =================================================================================================
    // == Exporter – render_section() now injects per-column CSS vars from `col_styles`
    // =================================================================================================
    static render_section(section, io, cfg, once, ctx) {
      once = once || {
        captcha: 0,
        country: 0,
        coupon: 0,
        cost_corrections: 0,
        submit: 0
      };
      ctx = ctx || {
        usedIds: new Set()
      };
      const {
        open,
        close
      } = io;
      const cols = Array.isArray(section.columns) && section.columns.length ? section.columns : [{
        width: '100%',
        fields: [],
        sections: []
      }];

      // Row is active if ANY column carries styles.
      var row_is_active = cols.some(function (col) {
        return has_non_default_col_styles(col && col.col_styles);
      });
      var row_attr_active = row_is_active ? ' data-colstyles-active="1"' : '';
      var row_custom_attrs = WPBC_BFB_Exporter.item_wrapper_attrs(section, ctx);
      open(`<r${row_custom_attrs}${row_attr_active}>`);
      const bases = compute_effective_bases(cols, cfg.gapPercent);
      const esc_attr = core.WPBC_BFB_Sanitize.escape_html;
      cols.forEach((col, idx) => {
        // (1) Resolve flex-basis.
        var eff_basis = resolve_flex_basis_percent(col && col.width, Number.isFinite(bases[idx]) ? +bases[idx] : 100);

        // (2) Build inline style.
        var style_parts = [];
        if (col && typeof col.style === 'string' && col.style.trim()) {
          style_parts.push(col.style.trim().replace(/;+\s*$/, ''));
        }
        style_parts.push('flex-basis: ' + (Number.isFinite(eff_basis) ? eff_basis.toString() : '100') + '%');
        var css_vars_str = build_col_css_vars(col && col.col_styles);
        if (css_vars_str) {
          style_parts.push(css_vars_str.replace(/^;|;$/g, ''));
        }
        var style_attr = ` style="${esc_attr(style_parts.join('; '))}"`;

        // (3) Column-level activation (more precise scoping)
        var col_is_active = has_non_default_col_styles(col && col.col_styles);
        var col_attr_active = col_is_active ? ' data-colstyles-active="1"' : '';
        open(`<c${col_attr_active}${style_attr}>`);

        // Use the shared once/ctx objects so single-per-form guards work across the whole form.
        (col.fields || []).forEach(node => WPBC_BFB_Exporter.render_field_node(node, io, cfg, once, ctx));

        // Recurse with the same once/ctx as well.
        (col.sections || []).forEach(nested => WPBC_BFB_Exporter.render_section(nested, io, cfg, once, ctx));
        close(`</c>`);
      });
      close(`</r>`);
    }

    /**
     * Build a sanitized custom CSS class and HTML ID attribute string for an exported wrapper.
     * Used by section row wrappers and fields whose attributes belong on the <item> wrapper.
     * Also ensures uniqueness of the html_id across the export (uses ctx.usedIds).
     *
     * @param {Object} wrapper_data Object containing optional cssclass and html_id properties.
     * @param {{usedIds:Set<string>}} ctx
     * @returns {string} e.g. ' class="x y" id="myId"'
     */
    static item_wrapper_attrs(wrapper_data, ctx) {
      if (!wrapper_data) {
        return '';
      }
      const esc_html = core.WPBC_BFB_Sanitize.escape_html;
      const cls_sanit = core.WPBC_BFB_Sanitize.sanitize_css_classlist;
      const sid = core.WPBC_BFB_Sanitize.sanitize_html_id;
      let out = '';
      const cls_raw = String(wrapper_data.cssclass_extra || wrapper_data.cssclass || wrapper_data.class || '');
      const cls = cls_sanit(cls_raw);
      let html_id = wrapper_data.html_id ? sid(String(wrapper_data.html_id)) : '';
      if (html_id && ctx?.usedIds) {
        let unique = html_id,
          i = 2;
        while (ctx.usedIds.has(unique)) {
          unique = `${html_id}_${i++}`;
        }
        ctx.usedIds.add(unique);
        html_id = unique;
      }
      if (cls) {
        out += ` class="${esc_html(cls)}"`;
      }
      if (html_id) {
        out += ` id="${esc_html(html_id)}"`;
      }
      return out;
    }

    // =================================================================================================
    // == Fields – pluggable, pack-driven export
    // == Wrap every exported field inside <item>…</item> and delegate actual shortcode export
    // == to per-pack callbacks registered via WPBC_BFB_Exporter.register(type, fn).
    // =================================================================================================
    static render_field_node(field, io, cfg, once, ctx) {
      const {
        open,
        close,
        push
      } = io;
      if (!field || !field.type) {
        return;
      }

      // Shared context (usedIds, “once-per-form” guards, etc.).
      once = once || {};
      ctx = ctx || {
        usedIds: new Set()
      };
      const type = String(field.type).toLowerCase();

      // Optional wrapper attrs for special types (currently only used by captcha).
      let item_attrs = '';
      if (type === 'captcha') {
        item_attrs = WPBC_BFB_Exporter.item_wrapper_attrs(field, ctx);
      }
      open(`<item${item_attrs}>`);
      try {
        // 1) Let the corresponding field pack handle export.
        let handled = false;
        if (WPBC_BFB_Exporter.has_exporter(type)) {
          handled = WPBC_BFB_Exporter.run_registered_exporter(field, io, cfg, once, ctx);
        }

        // 2) Fallback: show a clear TODO comment if no exporter is registered.
        if (!handled) {
          const name = WPBC_BFB_Exporter.compute_name(type, field);
          push(`<!-- TODO: map field type "${type}" name="${name}" in a pack exporter -->`);
        }

        // 3) Append help text consistently (packs shouldn’t duplicate this).
        if (field.help) {
          push(`<div class="wpbc_field_description">${core.WPBC_BFB_Sanitize.escape_html(String(field.help))}</div>`);
        }
      } finally {
        // Always close wrapper.
        close(`</item>`);
      }
    }

    // =================================================================================================
    // == Helpers ==
    // =================================================================================================
    static is_required(field) {
      const v = field && field.required;
      return v === true || v === 'true' || v === 1 || v === '1' || v === 'required';
    }

    /**
     * Shared label emitter used by per-pack exporters.
     *
     * Emits optional <l>Label</l> + <br> before the provided body,
     * respecting cfg.addLabels. Help text is emitted centrally in
     * render_field_node(), so it is intentionally NOT handled here.
     *
     * @param {Object}                  field
     * @param {function(string): void}  emit
     * @param {string}                  body
     * @param {{addLabels?: boolean}}  [cfg]
     */
    static emit_label_then(field, emit, body, cfg) {
      if (typeof emit !== 'function') {
        return;
      }
      cfg = cfg || {};
      const addLabels = cfg.addLabels !== false;
      const raw = field && typeof field.label === 'string' ? field.label : '';
      const label = raw.trim();
      var is_req = this.is_required(field);
      var req_mark = is_req ? '*' : '';
      if (label && addLabels) {
        const esc_html = core.WPBC_BFB_Sanitize.escape_html;
        emit('<l>' + esc_html(label) + req_mark + '</l>');
        emit('<br>' + body);
      } else {
        emit(body);
      }
    }

    // =================================================================================================
    // == Helpers ==
    // =================================================================================================

    // -- Time Select Helpers --------------------------------------------------------------------------------------
    static is_timeslot_picker_enabled() {
      try {
        return !!(window._wpbc && typeof window._wpbc.get_other_param === 'function' && window._wpbc.get_other_param('is_enabled_booking_timeslot_picker'));
      } catch (_) {
        return false;
      }
    }
    static time_placeholder_for(name, field) {
      // Prefer field-specific placeholder; else sensible default per field.
      if (typeof field.placeholder === 'string' && field.placeholder.trim()) {
        return field.placeholder.trim();
      }
      if (name === 'durationtime') return '--- Select duration ---';
      return '--- Select time ---';
    }

    /**
     * Build tokens/default for a time-like select (start/end/range/duration).
     * - Adds an empty-value placeholder as the first option only when:
     *   • time picker is OFF, and
     *   • no option is selected by default, and
     *   • there isn't already an empty-value option.
     */
    static build_time_select_tokens(field, name) {
      let tokens_str = this.option_tokens(field);
      let def_str = this.default_option_suffix(field, tokens_str);
      if (!this.is_timeslot_picker_enabled()) {
        const opts = Array.isArray(field.options) ? field.options : [];
        const has_selected_default = opts.some(o => o && (o.selected === true || o.selected === 'true' || o.selected === 1 || o.selected === '1'));
        if (!has_selected_default) {
          const has_empty_value_option = opts.some(o => o && typeof o.value !== 'undefined' && String(o.value).trim() === '');
          if (!has_empty_value_option) {
            const phText = this.time_placeholder_for(name, field);
            const phTokenStr = '"' + core.WPBC_BFB_Sanitize.escape_for_shortcode(phText + '@@') + '"';
            const other = this.option_tokens(field).trim(); // recompute, trim leading space
            tokens_str = ' ' + phTokenStr + (other ? ' ' + other : '');

            // Ensure first option (our placeholder) becomes the default implicitly
            def_str = '';
          }
        }
      }
      return {
        tokens_str,
        def_str
      };
    }
    static emit_time_select(name, field, req_mark, id_opt, cls_opts, emit_label_then) {
      const {
        tokens_str,
        def_str
      } = this.build_time_select_tokens(field, name);
      // NOTE: No size/ph tokens here to mirror rangetime behavior exactly.
      emit_label_then(`[selectbox${req_mark} ${name}${id_opt}${cls_opts}${def_str}${tokens_str}]`);
    }

    // -- Other Helpers --------------------------------------------------------------------------------------------
    // Return a field's default value (supports both camelCase and snake_case).
    static get_default_value(field) {
      const v = field?.default_value ?? field?.defaultValue ?? '';
      return v == null ? '' : String(v);
    }

    // For text-like fields, the default is a final quoted token in the shortcode.
    static default_text_suffix(field) {
      const v = this.get_default_value(field);
      if (!v) return '';
      return ` "${core.WPBC_BFB_Sanitize.escape_for_shortcode(v)}"`;
    }
    static class_options(field) {
      const raw = field.class || field.className || field.cssclass || '';
      const cls = core.WPBC_BFB_Sanitize.sanitize_css_classlist(String(raw));
      if (!cls) return '';
      return cls.split(/\s+/).filter(Boolean).map(c => ` class:${core.WPBC_BFB_Sanitize.to_token(c)}`).join('');
    }
    static id_option(field, ctx) {
      const raw_id = field.html_id || field.id_attr;
      if (!raw_id) return '';
      const base = core.WPBC_BFB_Sanitize.to_token(raw_id);
      if (!base) return '';
      let unique = base,
        i = 2;
      while (ctx.usedIds.has(unique)) unique = `${base}_${i++}`;
      ctx.usedIds.add(unique);
      return ` id:${unique}`;
    }
    static ph_attr(v) {
      if (v == null || v === '') return '';
      return ` placeholder:"${core.WPBC_BFB_Sanitize.escape_for_attr_quoted(v)}"`;
    }

    // text-like size/maxlength token: "40/255" (or "40/" or "/255")
    static size_max_token(f) {
      const size = parseInt(f.size, 10);
      const max = parseInt(f.maxlength, 10);
      if (Number.isFinite(size) && Number.isFinite(max)) return ` ${size}/${max}`;
      if (Number.isFinite(size)) return ` ${size}/`;
      if (Number.isFinite(max)) return ` /${max}`;
      return '';
    }

    // textarea cols/rows token: "60x4" (or "60x" or "x4")
    static cols_rows_token(f) {
      const cols = parseInt(f.cols, 10);
      const rows = parseInt(f.rows, 10);
      if (Number.isFinite(cols) && Number.isFinite(rows)) return ` ${cols}x${rows}`;
      if (Number.isFinite(cols)) return ` ${cols}x`;
      if (Number.isFinite(rows)) return ` x${rows}`;
      return '';
    }
    static option_tokens(field) {
      const options = Array.isArray(field.options) ? field.options : [];
      if (options.length === 0) return '';
      const parts = options.map(o => {
        const title = String(o.label ?? o.value ?? '').trim();
        const value = String(o.value ?? o.label ?? '').trim();
        return title && value && title !== value ? `"${core.WPBC_BFB_Sanitize.escape_for_shortcode(`${title}@@${value}`)}"` : `"${core.WPBC_BFB_Sanitize.escape_for_shortcode(title || value)}"`;
      });
      return ' ' + parts.join(' ');
    }
    static default_option_suffix(field, tokens) {
      const options = Array.isArray(field.options) ? field.options : [];
      const selected = options.find(o => o.selected);
      const def_val = selected ? selected.value ?? selected.label : field.default_value ?? field.defaultValue ?? '';
      if (!def_val) return '';
      return ` default="${core.WPBC_BFB_Sanitize.escape_value_for_attr(def_val)}"`;
    }

    /**
     * SELECTBOX / RADIO - Build the final shortcode for choice-based fields.
     *
     * Responsibilities:
     *  - Delegates option/default encoding to:
     *      - WPBC_BFB_Exporter.option_tokens( field )
     *      - WPBC_BFB_Exporter.default_option_suffix( field, tokens )
     *  - For `radio`:
     *      - ALWAYS appends a bare `use_label_element` token.
     *  - For `selectbox`:
     *      - Adds a bare `multiple` token when `field.multiple` is truthy
     *        (true, "true", 1, "1", "multiple") -> `[selectbox services multiple "1" "2"]`.
     *      - When single-select AND there is no `default="..."` attribute AND
     *        a non-empty `field.placeholder` is present, encodes the placeholder
     *        as the FIRST option with empty value via the `@@` syntax:
     *           placeholder "---- Select ----"  ->  `"---- Select ----@@"`
     *        and clears any default attribute:
     *           [selectbox* services "--- Select ---@@" "Option 1" "Option 2"]
     *      - Respects `field.use_label_element` (adds bare `use_label_element` when true).
     *  - For both kinds:
     *      - Honors `field.label_first` by appending `label_first:"1"` when truthy.
     *      - Keeps the required star, id and cssclass tokens in the canonical order.
     *
     * Final shortcode layout (order is important):
     *   [kind req name id cls use_label_element multiple default tokens label_first]
     *
     * @jDoc
     * @param {string} kind
     *   Shortcode kind; typically "radio" or "selectbox".
     *
     * @param {string} req_mark
     *   Required marker used by Contact Form 7 style shortcodes:
     *   either "" (not required) or "*" (required).
     *
     * @param {string} name
     *   Sanitized field name as exported into the shortcode, e.g. "services".
     *   Must already be computed via WPBC_BFB_Exporter.compute_name().
     *
     * @param {Object} field
     *   Normalized field data object as stored in the Builder structure. Common keys:
     *     - type           {string}   Field type, e.g. "radio" | "select".
     *     - options        {Array}    Option objects: { label, value, selected }.
     *     - placeholder    {string}   Placeholder text (single-select only).
     *     - multiple       {boolean|string|number}  Enables multi-select when truthy.
     *     - use_label_element {boolean}  Request bare `use_label_element` token (non-radio).
     *     - label_first    {boolean}  If true, appends `label_first:"1"` token.
     *     - default_value  {string}   Optional default value (used by default_option_suffix()).
     *     - html_id / cssclass / class / className  {string}  Used upstream in id_opt/cls_opts.
     *
     * @param {string} id_opt
     *   Optional id token built by WPBC_BFB_Exporter.id_option(field, ctx),
     *   e.g. " id:my_id" or empty string.
     *
     * @param {string} cls_opts
     *   Class tokens built by WPBC_BFB_Exporter.class_options(field),
     *   e.g. " class:my_class class:other".
     *
     * @returns {string}
     *   Complete shortcode body for the choice field, for example:
     *     "[radio* services use_label_element \"A\" \"B\"]"
     *     "[selectbox services multiple \"1\" \"2\" \"3\"]"
     *     "[selectbox* services \"--- Select ---@@\" \"Option 1\" \"Option 2\"]"
     */
    static choice_tag(kind, req_mark, name, field, id_opt, cls_opts) {
      // Start from the raw options/default as before.
      let tokens = WPBC_BFB_Exporter.option_tokens(field);
      let def = WPBC_BFB_Exporter.default_option_suffix(field, tokens);

      // For RADIO we must ALWAYS include a bare `use_label_element` token (no value/quotes).
      // For other kinds, keep backward compatibility: include only if explicitly set.
      let ule = '';
      if (kind === 'radio') {
        ule = ' use_label_element';
      } else if (field && field.use_label_element) {
        ule = ' use_label_element';
      }

      // SELECTBOX-specific extras:
      //  - "multiple" flag
      //  - placeholder exported as FIRST OPTION when single-select and no default.
      let multiple_flag = '';
      if (kind === 'selectbox' && field) {
        const multiple = field.multiple === true || field.multiple === 'true' || field.multiple === 1 || field.multiple === '1' || field.multiple === 'multiple';
        if (multiple) {
          // Export bare "multiple" token as in: [selectbox services multiple "1" "2" "3"].
          multiple_flag = ' multiple';
        } else if (!def) {
          // Single-select + NO default selected:
          // export placeholder as the FIRST OPTION with empty value:
          //   [selectbox* services "--- Select ---@@" "Option 1" "Option 2"]
          const rawPh = field.placeholder;
          const ph = typeof rawPh === 'string' ? rawPh.trim() : '';
          if (ph) {
            const S = core.WPBC_BFB_Sanitize;
            const esc_sc = S && S.escape_for_shortcode ? S.escape_for_shortcode : v => String(v);
            const phToken = `"${esc_sc(ph + '@@')}"`;
            if (tokens && tokens.length) {
              // tokens already starts with a leading space.
              tokens = ' ' + phToken + tokens;
            } else {
              tokens = ' ' + phToken;
            }

            // Ensure there is still NO default attribute when using placeholder-as-option.
            def = '';
          }
        }
      }

      // Optional: label_first stays as quoted flag when explicitly requested.
      const lf = field && field.label_first ? ' label_first:"1"' : '';

      // IMPORTANT ORDER (per request):
      // [kind req name id cls use_label_element multiple default tokens label_first]
      // i.e. `use_label_element` (and select extras) come BEFORE default/tokens.
      return `[${kind}${req_mark} ${name}${id_opt}${cls_opts}${ule}${multiple_flag}${def}${tokens}${lf}]`;
    }
    static compute_name(type, field) {
      // Names are fully validated when the field is added to the canvas.
      // The exporter must therefore preserve them (apart from idempotent sanitization), otherwise existing forms can break.
      const Sanit = core.WPBC_BFB_Sanitize;
      const raw = field && (field.name || field.id) ? String(field.name || field.id) : String(type || 'field');

      // Idempotent sanitization only – no auto-prefixing or renaming.
      const name = Sanit.sanitize_html_name(raw);

      // In the unlikely case sanitization returns an empty string, fall back to a sanitized type-based token.
      return name || Sanit.sanitize_html_name(String(type || 'field'));
    }

    /**
     * Register a per-field exporter.
     *
     * This is the ONLY place where field-specific shortcode markup should live.
     * Core stays generic; packs provide tiny plugins, for example:
     *
     *   WPBC_BFB_Exporter.register( 'text', (field, emit, extras) => { ... } );
     *
     * @jDoc
     * @param {string} type  Field type key, e.g. 'steps_timeline'
     * @param {(field:any, emit:(code:string)=>void, extras?:{io?:any,cfg?:any,once?:any,ctx?:any,core?:any})=>void}
     *     fn
     * @returns {void}
     */
    static register(type, fn) {
      if (!type || typeof fn !== 'function') {
        return;
      }
      if (!this.__registry) {
        this.__registry = new Map();
      }
      this.__registry.set(String(type).toLowerCase(), fn);
    }

    /**
     * Unregister a previously registered exporter.
     *
     * @jDoc
     * @param {string} type
     * @returns {void}
     */
    static unregister(type) {
      if (!this.__registry || !type) {
        return;
      }
      this.__registry.delete(String(type).toLowerCase());
    }

    /**
     * Check if an exporter exists for a given field type.
     *
     * @jDoc
     * @param {string} type
     * @returns {boolean}
     */
    static has_exporter(type) {
      return !!(this.__registry && this.__registry.has(String(type).toLowerCase()));
    }

    /**
     * Run a registered exporter for a field, if present.
     * Returns true if a registered exporter handled it.
     *
     * @jDoc
     * @param {any} field
     * @param {{open:Function,close:Function,push:Function,blank:Function}} io
     * @param {any} cfg
     * @param {any} once
     * @param {any} ctx
     * @returns {boolean}
     */
    static run_registered_exporter(field, io, cfg, once, ctx) {
      if (!field || !field.type || !this.__registry) {
        return false;
      }
      const key = String(field.type).toLowerCase();
      const fn = this.__registry.get(key);
      if (typeof fn !== 'function') {
        return false;
      }
      try {
        // Minimal, consistent emit() bridge into our line buffer:
        const emit = code => {
          if (typeof code === 'string') {
            io.push(code);
          }
        };
        fn(field, emit, {
          io,
          cfg,
          once,
          ctx,
          core
        });
        return true;
      } catch (e) {
        _wpbc?.dev?.error?.('WPBC_BFB_Exporter.run_registered_exporter', e);
        return false;
      }
    }
  }

  // expose globally for packs (if not already).
  window.WPBC_BFB_Exporter = window.WPBC_BFB_Exporter || WPBC_BFB_Exporter;
  wpbc_bfb__dispatch_event_safe('wpbc:bfb:exporter-ready', {});

  // Initialize default skip list; allow a global override array before export runs.
  WPBC_BFB_Exporter.set_skip_attrs(window.WPBC_BFB_EXPORT_SKIP_ATTRS || wpbc_export_skip_attrs_default);

  // == "Content of booking fields data" Exporter ====================================================================

  // – pack-extensible generator for "Content of booking fields data" ============================================
  // == Produces markup like:  "<div class=\"standard-content-form\"><b>Title</b>: <f>[shortcode]</f><br> ... </div>"
  // == Packs can override per type via: WPBC_BFB_ContentExporter.register('calendar', (field, emit, ctx)=>{...})
  // =================================================================================================
  class WPBC_BFB_ContentExporter {
    static register(type, fn) {
      if (!type || typeof fn !== 'function') return;
      if (!this.__registry) this.__registry = new Map();
      this.__registry.set(String(type).toLowerCase(), fn);
    }
    static unregister(type) {
      if (!this.__registry || !type) return;
      this.__registry.delete(String(type).toLowerCase());
    }
    static has_exporter(type) {
      return !!(this.__registry && this.__registry.has(String(type).toLowerCase()));
    }
    static run_registered_exporter(field, emit, ctx) {
      if (!field || !field.type || !this.__registry) return false;
      const key = String(field.type).toLowerCase();
      const fn = this.__registry.get(key);
      if (typeof fn !== 'function') return false;
      try {
        fn(field, emit, ctx || {});
        return true;
      } catch (e) {
        _wpbc?.dev?.error?.('WPBC_BFB_ContentExporter.run_registered_exporter', e);
        return false;
      }
    }

    // === NEW: shared line formatter for "Content of booking fields data" ===
    static emit_line_bold_field(emit, label, token, cfg) {
      const S = core.WPBC_BFB_Sanitize;
      const sep = cfg && typeof cfg.sep === 'string' ? cfg.sep : ': ';
      const addLabels = cfg && 'addLabels' in cfg ? !!cfg.addLabels : true;
      const title = addLabels && label ? `<b>${S.escape_html(label)}</b>${sep}` : '';
      emit(`${title}<f>[${token}]</f><br>`);
    }

    /**
     * Export adapted structure to “content of booking fields data”.
     * @param {{pages:Array}} adapted  result of adapt_builder_structure_to_exporter()
     * @param {{newline?:string, addLabels?:boolean, sep?:string}} options
     * @returns {string}
     */
    static export_content(adapted, options = {}) {
      const cfg = {
        newline: '\n',
        addLabels: true,
        sep: ': ',
        indent: '\t',
        ...options
      };
      const IND = typeof cfg.indent === 'string' ? cfg.indent : '\t';
      let depth = 0;
      const lines = [];
      const push = (s = '') => lines.push(IND.repeat(depth) + String(s));
      const open = (s = '') => {
        push(s);
        depth++;
      };
      const close = (s = '') => {
        depth = Math.max(0, depth - 1);
        push(s);
      };
      const emit = s => {
        if (typeof s !== 'string') {
          return;
        }
        String(s).split(/\r?\n/).forEach(line => push(line));
      };
      if (!adapted || !Array.isArray(adapted.pages)) return '';
      const skipTypes = new Set(['captcha', 'submit', 'divider', 'wizard_nav', 'cost_corrections']);
      const fallbackLine = field => {
        const type = String(field.type || '').toLowerCase();
        const name = WPBC_BFB_Exporter.compute_name(type, field);
        const label = typeof field.label === 'string' && field.label.trim() ? field.label.trim() : name;
        if (!name) return;
        WPBC_BFB_ContentExporter.emit_line_bold_field(emit, label, name, cfg);
      };

      // Per-type sensible defaults (can be overridden by packs via register())
      const defaultContentFor = field => {
        const type = String(field.type || '').toLowerCase();
        if (skipTypes.has(type)) return;
        // Special cases out of the box:
        if (type === 'calendar') {
          const label = typeof field.label === 'string' && field.label.trim() ? field.label.trim() : 'Dates';
          WPBC_BFB_ContentExporter.emit_line_bold_field(emit, label, 'dates', cfg);
          return;
        }
        // time-like reserved names -> keep placeholder token equal to name
        const reserved = String(field.name || field.id || '').toLowerCase();
        if (['rangetime', 'starttime', 'endtime', 'durationtime'].includes(reserved)) {
          const label = typeof field.label === 'string' && field.label.trim() ? field.label.trim() : reserved;
          // Keep your special token for duration time in content: [durationtime_val]
          const token = reserved === 'durationtime' ? 'durationtime_val' : reserved;
          WPBC_BFB_ContentExporter.emit_line_bold_field(emit, label, token, cfg);
          return;
        }
        // Fallback (text/email/tel/number/textarea/select/checkbox/radio etc.)
        fallbackLine(field);
      };

      // Walk pages/sections/columns/fields (same order as form)
      const walkSection = sec => {
        (sec.columns || []).forEach(col => {
          (col.fields || []).forEach(f => processField(f));
          (col.sections || []).forEach(s => walkSection(s));
        });
      };
      const processItem = item => {
        if (!item) return;
        if (item.kind === 'field') processField(item.data);
        if (item.kind === 'section') walkSection(item.data);
      };
      const processField = field => {
        if (!field) return;
        // allow packs to override:
        if (WPBC_BFB_ContentExporter.run_registered_exporter(field, emit, {
          cfg,
          core
        })) return;
        defaultContentFor(field);
      };

      // Wrapper first -> inner lines will be TAB-indented
      open(`<div class="standard-content-form">`);
      adapted.pages.forEach(page => (page.items || []).forEach(processItem));
      close(`</div>`);
      return lines.join(cfg.newline);
    }
  }

  // expose + ready event for packs to register their content exporters.
  window.WPBC_BFB_ContentExporter = window.WPBC_BFB_ContentExporter || WPBC_BFB_ContentExporter;
  wpbc_bfb__dispatch_event_safe('wpbc:bfb:content-exporter-ready', {});
})();
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9leHBvcnQvYnVpbGRlci1leHBvcnRlci5qcyIsIm5hbWVzIjpbImNvcmUiLCJ3aW5kb3ciLCJXUEJDX0JGQl9Db3JlIiwid3BiY19leHBvcnRfc2tpcF9hdHRyc19kZWZhdWx0Iiwic3RyaXBfYXR0cmlidXRlc19mcm9tX21hcmt1cCIsImh0bWwiLCJhdHRyc19sb3dlcmNhc2UiLCJsZW5ndGgiLCJvdXQiLCJTdHJpbmciLCJyYXdOYW1lIiwibmFtZSIsInRvTG93ZXJDYXNlIiwidHJpbSIsImVzYyIsInJlcGxhY2UiLCJyZSIsIlJlZ0V4cCIsIndwYmNfY29sdW1uX292ZXJmbG93X3ZhbHVlcyIsIm5vcm1hbGl6ZV9jb2x1bW5fbGVuZ3RoIiwiY2FuZGlkYXRlX3ZhbHVlIiwibm9ybWFsaXplZF92YWx1ZSIsInRlc3QiLCJub3JtYWxpemVfY29sdW1uX21heGltdW0iLCJub3JtYWxpemVfY29sdW1uX292ZXJmbG93IiwiaW5kZXhPZiIsImhhc19ub25fZGVmYXVsdF9jb2xfc3R5bGVzIiwib2JqIiwia2V5cyIsImkiLCJrIiwicGFyc2VfY29sX3N0eWxlc19qc29uIiwicmF3IiwiQXJyYXkiLCJpc0FycmF5IiwiZmlsdGVyIiwieCIsImFyciIsIkpTT04iLCJwYXJzZSIsIl9lIiwiYnVpbGRfY29sX2Nzc192YXJzIiwibWFwIiwiZGlyIiwid3JhcCIsImpjIiwiYWkiLCJnYXAiLCJwYWRkaW5nIiwibWFyZ2luIiwicGFkZGluZ190b3AiLCJwYWRkaW5nX3JpZ2h0IiwicGFkZGluZ19ib3R0b20iLCJwYWRkaW5nX2xlZnQiLCJtYXJnaW5fdG9wIiwibWFyZ2luX3JpZ2h0IiwibWFyZ2luX2JvdHRvbSIsIm1hcmdpbl9sZWZ0IiwibWF4X3dpZHRoIiwibWF4X2hlaWdodCIsIm92ZXJmbG93Iiwib3ZlcmZsb3dfeCIsIm92ZXJmbG93X3kiLCJhYyIsImFzZWxmIiwicGFydHMiLCJPYmplY3QiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJ2IiwidmFyX25hbWUiLCJwdXNoIiwiam9pbiIsInJlc29sdmVfZmxleF9iYXNpc19wZXJjZW50Iiwid2lkdGhfdG9rZW4iLCJmYWxsYmFja19wZXJjZW50IiwicyIsImVuZHNXaXRoIiwicCIsInBhcnNlRmxvYXQiLCJpc0Zpbml0ZSIsImNvbXB1dGVfZWZmZWN0aXZlX2Jhc2VzIiwiY29sdW1ucyIsImdhcF9wZXJjZW50IiwibiIsImNvbCIsInciLCJ3aWR0aCIsIk5hTiIsIk51bWJlciIsInN1bV9yYXciLCJyZWR1Y2UiLCJhIiwiYiIsImdwIiwidG90YWxfZ2FwcyIsIk1hdGgiLCJtYXgiLCJhdmFpbGFibGUiLCJzY2FsZV9yYXRpbyIsImFkYXB0X2J1aWxkZXJfc3RydWN0dXJlX3RvX2V4cG9ydGVyIiwic3RydWN0dXJlIiwicGFnZXMiLCJpdGVtcyIsIm5vcm1hbGl6ZV9vcHRpb25zIiwib3B0cyIsIm8iLCJsYWJlbCIsInZhbHVlIiwic2VsZWN0ZWQiLCJ3YWxrX3NlY3Rpb24iLCJzZWMiLCJzZWN0aW9uX2NvbF9zdHlsZXMiLCJjb2xfc3R5bGVzIiwiaWQiLCJodG1sX2lkIiwiY3NzY2xhc3MiLCJjb2xfaW5kZXgiLCJmaWVsZHMiLCJmIiwidHlwZSIsImRhdGEiLCJzZWN0aW9ucyIsIml0Iiwib3B0aW9ucyIsInN0eWxlIiwicGFnZSIsImNvbnRlbnQiLCJmb3JFYWNoIiwiaXRlbSIsImtpbmQiLCJXUEJDX0JGQl9FeHBvcnRlciIsInNraXBfYXR0cnMiLCJTZXQiLCJzZXRfc2tpcF9hdHRycyIsIkJvb2xlYW4iLCJhZGRfc2tpcF9hdHRycyIsIm5hbWVzIiwiYWRkIiwicmVtb3ZlX3NraXBfYXR0ciIsImRlbGV0ZSIsInNhbml0aXplX2V4cG9ydCIsImZyb20iLCJleHBvcnRfZm9ybSIsImFkYXB0ZWQiLCJjZmciLCJuZXdsaW5lIiwiYWRkTGFiZWxzIiwiZ2FwUGVyY2VudCIsImluZGVudCIsIklORCIsImRlcHRoIiwibGluZXMiLCJyZXBlYXQiLCJvcGVuIiwiY2xvc2UiLCJibGFuayIsImN0eCIsInVzZWRJZHMiLCJvbmNlIiwiY2FwdGNoYSIsImNvdW50cnkiLCJjb3Vwb24iLCJjb3N0X2NvcnJlY3Rpb25zIiwic3VibWl0IiwicGFnZV9pbmRleCIsImlzX2ZpcnN0Iiwic3RlcF9udW0iLCJoaWRkZW5fY2xhc3MiLCJoaWRkZW5fc3R5bGUiLCJyZW5kZXJfc2VjdGlvbiIsInJlbmRlcl9maWVsZF9ub2RlIiwiZXhwb3J0X2FsbCIsImFkdmFuY2VkX2Zvcm0iLCJmaWVsZHNfZGF0YSIsIldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciIsImV4cG9ydF9jb250ZW50Iiwic2VwIiwic2VjdGlvbiIsImlvIiwiY29scyIsInJvd19pc19hY3RpdmUiLCJzb21lIiwicm93X2F0dHJfYWN0aXZlIiwicm93X2N1c3RvbV9hdHRycyIsIml0ZW1fd3JhcHBlcl9hdHRycyIsImJhc2VzIiwiZXNjX2F0dHIiLCJXUEJDX0JGQl9TYW5pdGl6ZSIsImVzY2FwZV9odG1sIiwiaWR4IiwiZWZmX2Jhc2lzIiwic3R5bGVfcGFydHMiLCJ0b1N0cmluZyIsImNzc192YXJzX3N0ciIsInN0eWxlX2F0dHIiLCJjb2xfaXNfYWN0aXZlIiwiY29sX2F0dHJfYWN0aXZlIiwibm9kZSIsIm5lc3RlZCIsIndyYXBwZXJfZGF0YSIsImVzY19odG1sIiwiY2xzX3Nhbml0Iiwic2FuaXRpemVfY3NzX2NsYXNzbGlzdCIsInNpZCIsInNhbml0aXplX2h0bWxfaWQiLCJjbHNfcmF3IiwiY3NzY2xhc3NfZXh0cmEiLCJjbGFzcyIsImNscyIsInVuaXF1ZSIsImhhcyIsImZpZWxkIiwiaXRlbV9hdHRycyIsImhhbmRsZWQiLCJoYXNfZXhwb3J0ZXIiLCJydW5fcmVnaXN0ZXJlZF9leHBvcnRlciIsImNvbXB1dGVfbmFtZSIsImhlbHAiLCJpc19yZXF1aXJlZCIsInJlcXVpcmVkIiwiZW1pdF9sYWJlbF90aGVuIiwiZW1pdCIsImJvZHkiLCJpc19yZXEiLCJyZXFfbWFyayIsImlzX3RpbWVzbG90X3BpY2tlcl9lbmFibGVkIiwiX3dwYmMiLCJnZXRfb3RoZXJfcGFyYW0iLCJfIiwidGltZV9wbGFjZWhvbGRlcl9mb3IiLCJwbGFjZWhvbGRlciIsImJ1aWxkX3RpbWVfc2VsZWN0X3Rva2VucyIsInRva2Vuc19zdHIiLCJvcHRpb25fdG9rZW5zIiwiZGVmX3N0ciIsImRlZmF1bHRfb3B0aW9uX3N1ZmZpeCIsImhhc19zZWxlY3RlZF9kZWZhdWx0IiwiaGFzX2VtcHR5X3ZhbHVlX29wdGlvbiIsInBoVGV4dCIsInBoVG9rZW5TdHIiLCJlc2NhcGVfZm9yX3Nob3J0Y29kZSIsIm90aGVyIiwiZW1pdF90aW1lX3NlbGVjdCIsImlkX29wdCIsImNsc19vcHRzIiwiZ2V0X2RlZmF1bHRfdmFsdWUiLCJkZWZhdWx0X3ZhbHVlIiwiZGVmYXVsdFZhbHVlIiwiZGVmYXVsdF90ZXh0X3N1ZmZpeCIsImNsYXNzX29wdGlvbnMiLCJjbGFzc05hbWUiLCJzcGxpdCIsImMiLCJ0b190b2tlbiIsImlkX29wdGlvbiIsInJhd19pZCIsImlkX2F0dHIiLCJiYXNlIiwicGhfYXR0ciIsImVzY2FwZV9mb3JfYXR0cl9xdW90ZWQiLCJzaXplX21heF90b2tlbiIsInNpemUiLCJwYXJzZUludCIsIm1heGxlbmd0aCIsImNvbHNfcm93c190b2tlbiIsInJvd3MiLCJ0aXRsZSIsInRva2VucyIsImZpbmQiLCJkZWZfdmFsIiwiZXNjYXBlX3ZhbHVlX2Zvcl9hdHRyIiwiY2hvaWNlX3RhZyIsImRlZiIsInVsZSIsInVzZV9sYWJlbF9lbGVtZW50IiwibXVsdGlwbGVfZmxhZyIsIm11bHRpcGxlIiwicmF3UGgiLCJwaCIsIlMiLCJlc2Nfc2MiLCJwaFRva2VuIiwibGYiLCJsYWJlbF9maXJzdCIsIlNhbml0Iiwic2FuaXRpemVfaHRtbF9uYW1lIiwicmVnaXN0ZXIiLCJmbiIsIl9fcmVnaXN0cnkiLCJNYXAiLCJzZXQiLCJ1bnJlZ2lzdGVyIiwia2V5IiwiZ2V0IiwiY29kZSIsImUiLCJkZXYiLCJlcnJvciIsIndwYmNfYmZiX19kaXNwYXRjaF9ldmVudF9zYWZlIiwiV1BCQ19CRkJfRVhQT1JUX1NLSVBfQVRUUlMiLCJlbWl0X2xpbmVfYm9sZF9maWVsZCIsInRva2VuIiwibGluZSIsInNraXBUeXBlcyIsImZhbGxiYWNrTGluZSIsImRlZmF1bHRDb250ZW50Rm9yIiwicmVzZXJ2ZWQiLCJpbmNsdWRlcyIsIndhbGtTZWN0aW9uIiwicHJvY2Vzc0ZpZWxkIiwicHJvY2Vzc0l0ZW0iXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9fc3JjL2V4cG9ydC9idWlsZGVyLWV4cG9ydGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBAZmlsZTogLi4vaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9leHBvcnQvYnVpbGRlci1leHBvcnRlci5qc1xyXG4gKi9cclxuKGZ1bmN0aW9uICgpIHtcclxuXHRcInVzZSBzdHJpY3RcIjtcclxuXHJcblx0Y29uc3QgY29yZSA9IHdpbmRvdy5XUEJDX0JGQl9Db3JlIHx8IHt9O1xyXG5cclxuXHQvLyA9PSBIZWxwZXJzIOKAlCBTaGFyZWQgaGVscGVyIEFQSSBmb3IgZmllbGQgcGFja3MgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cdC8vID09IFRoZXNlIGFyZSBnZW5lcmljIHV0aWxpdGllcyB0aGF0IHBhY2tzIGNhbiBjYWxsIGZyb20gdGhlaXIgb3duIGV4cG9ydGVyczpcclxuXHQvLyA9PSAgLSBjb21wdXRlX25hbWUoKSwgaWRfb3B0aW9uKCksIGNsYXNzX29wdGlvbnMoKSwgc2l6ZV9tYXhfdG9rZW4oKSwgZW1pdF90aW1lX3NlbGVjdCgpLCBldGMuXHJcblx0Ly8gPT0gTm8gZmllbGQtdHlwZSBicmFuY2hpbmcgc2hvdWxkIGxpdmUgaW4gdGhlIGNvcmUgZXhwb3J0ZXIuXHJcblx0Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuXHQvKipcclxuXHQgKiBEZWZhdWx0IHNraXAgbGlzdCAoY2FuIGJlIGV4dGVuZGVkL292ZXJyaWRkZW4gYXQgcnVudGltZSkuXHJcblx0ICogLSBPbmx5IGF0dHJpYnV0ZSBOQU1FUyBoZXJlIChjYXNlLWluc2Vuc2l0aXZlKS4gVmFsdWVzIGFyZSByZW1vdmVkIHdpdGggdGhlbS5cclxuXHQgKi9cclxuXHRjb25zdCB3cGJjX2V4cG9ydF9za2lwX2F0dHJzX2RlZmF1bHQgPSBbICdkYXRhLWNvbHN0eWxlcy1hY3RpdmUnIF07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlbW92ZSBhdHRyaWJ1dGVzIGJ5IG5hbWUgZnJvbSBhbiBIVE1MLWxpa2Ugc3RyaW5nLlxyXG5cdCAqIE1hdGNoZXM6XHJcblx0ICogICAtIG5hbWVcclxuXHQgKiAgIC0gbmFtZT1cIi4uLlwiL25hbWU9Jy4uLicvbmFtZT12YWx1ZVxyXG5cdCAqIHdpdGggYW55IHN1cnJvdW5kaW5nIHdoaXRlc3BhY2UuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gaHRtbFxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nW119IGF0dHJzX2xvd2VyY2FzZSAgIGF0dHJpYnV0ZSBuYW1lcyAobG93ZXJjYXNlKVxyXG5cdCAqIEByZXR1cm4ge3N0cmluZ31cclxuXHQgKi9cclxuXHRmdW5jdGlvbiBzdHJpcF9hdHRyaWJ1dGVzX2Zyb21fbWFya3VwKGh0bWwsIGF0dHJzX2xvd2VyY2FzZSkge1xyXG5cdFx0aWYgKCFodG1sIHx8ICFhdHRyc19sb3dlcmNhc2U/Lmxlbmd0aCkgcmV0dXJuIGh0bWw7XHJcblx0XHRsZXQgb3V0ID0gU3RyaW5nKGh0bWwpO1xyXG5cdFx0Zm9yIChjb25zdCByYXdOYW1lIG9mIGF0dHJzX2xvd2VyY2FzZSkge1xyXG5cdFx0XHRpZiAoIXJhd05hbWUpIGNvbnRpbnVlO1xyXG5cdFx0XHRjb25zdCBuYW1lID0gU3RyaW5nKHJhd05hbWUpLnRvTG93ZXJDYXNlKCkudHJpbSgpO1xyXG5cdFx0XHQvLyBFc2NhcGUgZm9yIHJlZ2V4XHJcblx0XHRcdGNvbnN0IGVzYyA9IG5hbWUucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csICdcXFxcJCYnKTtcclxuXHRcdFx0Ly8gTWF0Y2ggZnVsbCBhdHRyaWJ1dGUgbmFtZSBvbmx5IChuZXh0IGNoYXIgaXMgTk9UIGEgdmFsaWQgbmFtZSBjaGFyKVxyXG5cdFx0XHRjb25zdCByZSA9IG5ldyBSZWdFeHAoXHJcblx0XHRcdFx0YFxcXFxzJHtlc2N9KD8hW0EtWmEtejAtOV86XFxcXC1dKSg/Oj0oPzpcIlteXCJdKlwifCdbXiddKid8W15cXFxccz5dKikpP2AsXHJcblx0XHRcdFx0J2dpJ1xyXG5cdFx0XHQpO1xyXG5cdFx0XHRvdXQgPSBvdXQucmVwbGFjZShyZSwgJycpO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIG91dDtcclxuXHR9XHJcblxyXG5cdC8vID09IEhlbHBlcnMg4oCTIGNvbHVtbiBzdHlsZXMgcGFyc2luZyAmIENTUyB2YXJzIGJ1aWxkZXIgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblx0dmFyIHdwYmNfY29sdW1uX292ZXJmbG93X3ZhbHVlcyA9IFsgJ3Zpc2libGUnLCAnYXV0bycsICdoaWRkZW4nIF07XG5cblx0LyoqXG5cdCAqIENvbnN0cmFpbiBhIGNvbHVtbiBzcGFjaW5nIGxlbmd0aCB0byB1bml0cyBzdXBwb3J0ZWQgYnkgdGhlIEluc3BlY3Rvci5cblx0ICpcblx0ICogQHBhcmFtIHsqfSBjYW5kaWRhdGVfdmFsdWUgU2F2ZWQgY29sdW1uLXN0eWxlIHZhbHVlLlxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfSBWYWxpZCBub24tbmVnYXRpdmUgQ1NTIGxlbmd0aCBvciBgMHB4YC5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9jb2x1bW5fbGVuZ3RoKCBjYW5kaWRhdGVfdmFsdWUgKSB7XG5cdFx0dmFyIG5vcm1hbGl6ZWRfdmFsdWUgPSBTdHJpbmcoIGNhbmRpZGF0ZV92YWx1ZSA9PSBudWxsID8gJycgOiBjYW5kaWRhdGVfdmFsdWUgKS50cmltKCk7XG5cdFx0aWYgKCAvXlxcZCsoXFwuXFxkKyk/JC8udGVzdCggbm9ybWFsaXplZF92YWx1ZSApICkge1xuXHRcdFx0cmV0dXJuIG5vcm1hbGl6ZWRfdmFsdWUgKyAncHgnO1xuXHRcdH1cblx0XHRyZXR1cm4gL15cXGQrKFxcLlxcZCspPyhweHxyZW18ZW18JSkkLy50ZXN0KCBub3JtYWxpemVkX3ZhbHVlICkgPyBub3JtYWxpemVkX3ZhbHVlIDogJzBweCc7XG5cdH1cblxuXHQvKipcblx0ICogQ29uc3RyYWluIGFuIG9wdGlvbmFsIGNvbHVtbiBtYXhpbXVtIGRpbWVuc2lvbi5cblx0ICpcblx0ICogQHBhcmFtIHsqfSBjYW5kaWRhdGVfdmFsdWUgU2F2ZWQgY29sdW1uLXN0eWxlIHZhbHVlLlxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfSBWYWxpZCBtYXhpbXVtIGRpbWVuc2lvbiBvciBgbm9uZWAuXG5cdCAqL1xuXHRmdW5jdGlvbiBub3JtYWxpemVfY29sdW1uX21heGltdW0oIGNhbmRpZGF0ZV92YWx1ZSApIHtcblx0XHR2YXIgbm9ybWFsaXplZF92YWx1ZSA9IFN0cmluZyggY2FuZGlkYXRlX3ZhbHVlID09IG51bGwgPyAnJyA6IGNhbmRpZGF0ZV92YWx1ZSApLnRyaW0oKTtcblx0XHRpZiAoICEgbm9ybWFsaXplZF92YWx1ZSB8fCAnbm9uZScgPT09IG5vcm1hbGl6ZWRfdmFsdWUgKSB7XG5cdFx0XHRyZXR1cm4gJ25vbmUnO1xuXHRcdH1cblx0XHRpZiAoIC9eXFxkKyhcXC5cXGQrKT8kLy50ZXN0KCBub3JtYWxpemVkX3ZhbHVlICkgKSB7XG5cdFx0XHRyZXR1cm4gbm9ybWFsaXplZF92YWx1ZSArICdweCc7XG5cdFx0fVxuXHRcdHJldHVybiAvXlxcZCsoXFwuXFxkKyk/KHB4fHJlbXxlbXwlfHZofHZ3KSQvLnRlc3QoIG5vcm1hbGl6ZWRfdmFsdWUgKSA/IG5vcm1hbGl6ZWRfdmFsdWUgOiAnbm9uZSc7XG5cdH1cblxuXHQvKipcblx0ICogQ29uc3RyYWluIGNvbHVtbiBvdmVyZmxvdyB0byB0aGUgSW5zcGVjdG9yIGFsbG93bGlzdC5cblx0ICpcblx0ICogQHBhcmFtIHsqfSBjYW5kaWRhdGVfdmFsdWUgU2F2ZWQgY29sdW1uLXN0eWxlIHZhbHVlLlxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfSBBbGxvd2xpc3RlZCBvdmVyZmxvdyB2YWx1ZS5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9jb2x1bW5fb3ZlcmZsb3coIGNhbmRpZGF0ZV92YWx1ZSApIHtcblx0XHR2YXIgbm9ybWFsaXplZF92YWx1ZSA9IFN0cmluZyggY2FuZGlkYXRlX3ZhbHVlIHx8ICcnICk7XG5cdFx0cmV0dXJuIHdwYmNfY29sdW1uX292ZXJmbG93X3ZhbHVlcy5pbmRleE9mKCBub3JtYWxpemVkX3ZhbHVlICkgIT09IC0xID8gbm9ybWFsaXplZF92YWx1ZSA6IHdwYmNfY29sdW1uX292ZXJmbG93X3ZhbHVlc1swXTtcblx0fVxuXG5cdC8vIEtub3duIGtleXMgd2UgdHJlYXQgYXMgcmVhbCBwZXItY29sdW1uIHN0eWxlIG92ZXJyaWRlcy5cblx0ZnVuY3Rpb24gaGFzX25vbl9kZWZhdWx0X2NvbF9zdHlsZXMob2JqKSB7XHJcblx0XHRpZiAoICFvYmogfHwgdHlwZW9mIG9iaiAhPT0gJ29iamVjdCcgKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHRcdHZhciBrZXlzID0gW1xuXHRcdFx0J2RpcicsICd3cmFwJywgJ2pjJywgJ2FpJywgJ2dhcCcsICdwYWRkaW5nJywgJ21hcmdpbicsXG5cdFx0XHQncGFkZGluZ190b3AnLCAncGFkZGluZ19yaWdodCcsICdwYWRkaW5nX2JvdHRvbScsICdwYWRkaW5nX2xlZnQnLFxuXHRcdFx0J21hcmdpbl90b3AnLCAnbWFyZ2luX3JpZ2h0JywgJ21hcmdpbl9ib3R0b20nLCAnbWFyZ2luX2xlZnQnLFxuXHRcdFx0J21heF93aWR0aCcsICdtYXhfaGVpZ2h0JywgJ292ZXJmbG93JywgJ292ZXJmbG93X3gnLCAnb3ZlcmZsb3dfeScsICdhc2VsZicsICdhYydcblx0XHRdO1xuXHRcdGZvciAoIHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdHZhciBrID0ga2V5c1tpXTtcclxuXHRcdFx0aWYgKCBvYmpba10gIT0gbnVsbCAmJiBTdHJpbmcoIG9ialtrXSApLnRyaW0oKSAhPT0gJycgKSB7XHJcblx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFBhcnNlIGBjb2xfc3R5bGVzYCBjb21pbmcgZnJvbSBhIFNlY3Rpb24uXHJcblx0ICogQWNjZXB0czogSlNPTiBzdHJpbmcgb3IgYXJyYXkgb2Ygb2JqZWN0cy5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfEFycmF5fHVuZGVmaW5lZHxudWxsfSByYXdcclxuXHQgKiBAcmV0dXJucyB7QXJyYXk8T2JqZWN0Pn0gYXJyYXkgYWxpZ25lZCB0byBjb2x1bW5zIChtYXkgYmUgZW1wdHkpXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gcGFyc2VfY29sX3N0eWxlc19qc29uKHJhdykge1xyXG5cdFx0aWYgKCAhcmF3ICkgcmV0dXJuIFtdO1xyXG5cdFx0aWYgKCBBcnJheS5pc0FycmF5KCByYXcgKSApIHJldHVybiByYXcuZmlsdGVyKCBmdW5jdGlvbiAoeCkge1xyXG5cdFx0XHRyZXR1cm4geCAmJiB0eXBlb2YgeCA9PT0gJ29iamVjdCc7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0aWYgKCB0eXBlb2YgcmF3ID09PSAnc3RyaW5nJyApIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHR2YXIgYXJyID0gSlNPTi5wYXJzZSggcmF3ICk7XHJcblx0XHRcdFx0cmV0dXJuIEFycmF5LmlzQXJyYXkoIGFyciApID8gYXJyLmZpbHRlciggZnVuY3Rpb24gKHgpIHtcclxuXHRcdFx0XHRcdHJldHVybiB4ICYmIHR5cGVvZiB4ID09PSAnb2JqZWN0JztcclxuXHRcdFx0XHR9ICkgOiBbXTtcclxuXHRcdFx0fSBjYXRjaCAoIF9lICkge1xyXG5cdFx0XHRcdHJldHVybiBbXTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIFtdO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogQnVpbGQgQ1NTIHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBzdHJpbmcgZm9yIGEgY29sdW1uIHN0eWxlIG9iamVjdC5cclxuXHQgKiBLbm93biBrZXlzIC0+IENTUyB2YXJzOlxyXG5cdCAqICAtIGRpciAgLT4gLS13cGJjLWJmYi1jb2wtZGlyXHJcblx0ICogIC0gd3JhcCAtPiAtLXdwYmMtYmZiLWNvbC13cmFwXHJcblx0ICogIC0gamMgICAtPiAtLXdwYmMtYmZiLWNvbC1qY1xyXG5cdCAqICAtIGFpICAgLT4gLS13cGJjLWJmYi1jb2wtYWlcclxuXHQgKiAgLSBnYXAgIC0+IC0td3BiYy1iZmItY29sLWdhcFxuXHQgKiAgLSBwYWRkaW5nIC0+IC0td3BiYy1iZmItY29sLXBhZGRpbmdcblx0ICogIC0gbWFyZ2luICAtPiAtLXdwYmMtYmZiLWNvbC1tYXJnaW5cblx0ICogIC0gcGFkZGluZ190b3AvcmlnaHQvYm90dG9tL2xlZnQgLT4gLS13cGJjLWJmYi1jb2wtcGFkZGluZy0qXG5cdCAqICAtIG1hcmdpbl90b3AvcmlnaHQvYm90dG9tL2xlZnQgIC0+IC0td3BiYy1iZmItY29sLW1hcmdpbi0qXG5cdCAqICAtIG1heF93aWR0aCAgLT4gLS13cGJjLWJmYi1jb2wtbWF4LXdpZHRoXG5cdCAqICAtIG1heF9oZWlnaHQgLT4gLS13cGJjLWJmYi1jb2wtbWF4LWhlaWdodFxuXHQgKiAgLSBvdmVyZmxvdyAgIC0+IC0td3BiYy1iZmItY29sLW92ZXJmbG93XG5cdCAqICAtIG92ZXJmbG93X3ggLT4gLS13cGJjLWJmYi1jb2wtb3ZlcmZsb3cteFxuXHQgKiAgLSBvdmVyZmxvd195IC0+IC0td3BiYy1iZmItY29sLW92ZXJmbG93LXlcblx0ICogIC0gYWMgICAtPiAtLXdwYmMtYmZiLWNvbC1hY1xuXHQgKiAgLSBhc2VsZi0+IC0td3BiYy1iZmItY29sLWFzZWxmXHJcblx0ICpcclxuXHQgKiBVbmtub3duIGtleXMgYXJlIGV4cG9ydGVkIGFzIGAtLXdwYmMtYmZiLWNvbC0ke2tleX1gLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtPYmplY3R8bnVsbHx1bmRlZmluZWR9IG9ialxyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9IGUuZy4gXCItLXdwYmMtYmZiLWNvbC1kaXI6IHJvdzsgLS13cGJjLWJmYi1jb2wtd3JhcDogd3JhcDtcIlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGJ1aWxkX2NvbF9jc3NfdmFycyhvYmopIHtcclxuXHRcdGlmICggIW9iaiB8fCB0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyApIHJldHVybiAnJztcclxuXHJcblx0XHR2YXIgbWFwID0ge1xyXG5cdFx0XHRkaXIgIDogJy0td3BiYy1iZmItY29sLWRpcicsXHJcblx0XHRcdHdyYXAgOiAnLS13cGJjLWJmYi1jb2wtd3JhcCcsXHJcblx0XHRcdGpjICAgOiAnLS13cGJjLWJmYi1jb2wtamMnLFxyXG5cdFx0XHRhaSAgIDogJy0td3BiYy1iZmItY29sLWFpJyxcclxuXHRcdFx0Z2FwICA6ICctLXdwYmMtYmZiLWNvbC1nYXAnLFxuXHRcdFx0cGFkZGluZzogJy0td3BiYy1iZmItY29sLXBhZGRpbmcnLFxuXHRcdFx0bWFyZ2luIDogJy0td3BiYy1iZmItY29sLW1hcmdpbicsXG5cdFx0XHRwYWRkaW5nX3RvcCAgIDogJy0td3BiYy1iZmItY29sLXBhZGRpbmctdG9wJyxcblx0XHRcdHBhZGRpbmdfcmlnaHQgOiAnLS13cGJjLWJmYi1jb2wtcGFkZGluZy1yaWdodCcsXG5cdFx0XHRwYWRkaW5nX2JvdHRvbTogJy0td3BiYy1iZmItY29sLXBhZGRpbmctYm90dG9tJyxcblx0XHRcdHBhZGRpbmdfbGVmdCAgOiAnLS13cGJjLWJmYi1jb2wtcGFkZGluZy1sZWZ0Jyxcblx0XHRcdG1hcmdpbl90b3AgICAgOiAnLS13cGJjLWJmYi1jb2wtbWFyZ2luLXRvcCcsXG5cdFx0XHRtYXJnaW5fcmlnaHQgIDogJy0td3BiYy1iZmItY29sLW1hcmdpbi1yaWdodCcsXG5cdFx0XHRtYXJnaW5fYm90dG9tIDogJy0td3BiYy1iZmItY29sLW1hcmdpbi1ib3R0b20nLFxuXHRcdFx0bWFyZ2luX2xlZnQgICA6ICctLXdwYmMtYmZiLWNvbC1tYXJnaW4tbGVmdCcsXG5cdFx0XHRtYXhfd2lkdGggICAgIDogJy0td3BiYy1iZmItY29sLW1heC13aWR0aCcsXG5cdFx0XHRtYXhfaGVpZ2h0ICAgIDogJy0td3BiYy1iZmItY29sLW1heC1oZWlnaHQnLFxuXHRcdFx0b3ZlcmZsb3cgICAgICA6ICctLXdwYmMtYmZiLWNvbC1vdmVyZmxvdycsXG5cdFx0XHRvdmVyZmxvd194ICAgIDogJy0td3BiYy1iZmItY29sLW92ZXJmbG93LXgnLFxuXHRcdFx0b3ZlcmZsb3dfeSAgICA6ICctLXdwYmMtYmZiLWNvbC1vdmVyZmxvdy15Jyxcblx0XHRcdGFjICAgOiAnLS13cGJjLWJmYi1jb2wtYWMnLFxuXHRcdFx0YXNlbGY6ICctLXdwYmMtYmZiLWNvbC1hc2VsZidcclxuXHRcdH07XHJcblxyXG5cdFx0dmFyIHBhcnRzID0gW107XHJcblxyXG5cdFx0Zm9yICggdmFyIGsgaW4gb2JqICkge1xuXHRcdFx0aWYgKCAhT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBvYmosIGsgKSApIGNvbnRpbnVlO1xuXHRcdFx0Ly8gSWdub3JlIHRoZSByZW1vdmVkIGV4cGVyaW1lbnRhbCBjaGlsZC1mbGV4IHNldHRpbmcgaW4gcHJldmlvdXNseSBzYXZlZCBCdWlsZGVyIEpTT04uXG5cdFx0XHRpZiAoICdpdGVtX2ZsZXgnID09PSBrICkgY29udGludWU7XG5cdFx0XHR2YXIgdiA9IG9ialtrXTtcblx0XHRcdGlmICggdiA9PSBudWxsIHx8IHYgPT09ICcnICkgY29udGludWU7XG5cdFx0XHRpZiAoIFsgJ3BhZGRpbmdfdG9wJywgJ3BhZGRpbmdfcmlnaHQnLCAncGFkZGluZ19ib3R0b20nLCAncGFkZGluZ19sZWZ0JywgJ21hcmdpbl90b3AnLCAnbWFyZ2luX3JpZ2h0JywgJ21hcmdpbl9ib3R0b20nLCAnbWFyZ2luX2xlZnQnIF0uaW5kZXhPZiggayApICE9PSAtMSApIHtcblx0XHRcdFx0diA9IG5vcm1hbGl6ZV9jb2x1bW5fbGVuZ3RoKCB2ICk7XG5cdFx0XHR9IGVsc2UgaWYgKCAnbWF4X3dpZHRoJyA9PT0gayB8fCAnbWF4X2hlaWdodCcgPT09IGsgKSB7XG5cdFx0XHRcdHYgPSBub3JtYWxpemVfY29sdW1uX21heGltdW0oIHYgKTtcblx0XHRcdH0gZWxzZSBpZiAoIFsgJ292ZXJmbG93JywgJ292ZXJmbG93X3gnLCAnb3ZlcmZsb3dfeScgXS5pbmRleE9mKCBrICkgIT09IC0xICkge1xuXHRcdFx0XHR2ID0gbm9ybWFsaXplX2NvbHVtbl9vdmVyZmxvdyggdiApO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgdmFyX25hbWUgPSBtYXBba10gfHwgKCctLXdwYmMtYmZiLWNvbC0nICsgU3RyaW5nKCBrICkucmVwbGFjZSggL1teYS16MC05Xy1dL2dpLCAnJyApLnRvTG93ZXJDYXNlKCkpO1xuXHRcdFx0cGFydHMucHVzaCggdmFyX25hbWUgKyAnOiAnICsgU3RyaW5nKCB2ICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBBbHdheXMgaW5jbHVkZSBleHBsaWNpdCBtaW4gZ3VhcmQgKHJlcXVlc3RlZCk6IC0td3BiYy1jb2wtbWluOiAwcHg7XHJcblx0XHRwYXJ0cy5wdXNoKCAnLS13cGJjLWNvbC1taW46IDBweCcgKTtcclxuXHJcblx0XHRyZXR1cm4gcGFydHMuam9pbiggJzsnICkgKyAocGFydHMubGVuZ3RoID8gJzsnIDogJycpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUmVzb2x2ZSBudW1lcmljIHBlcmNlbnQgZnJvbSBhIHdpZHRoIHRva2VuIGxpa2UgXCI0OC41JVwiLlxyXG5cdCAqIEZhbGxzIGJhY2sgdG8gYGZhbGxiYWNrX3BlcmNlbnRgIGlmIG5vdCBpbiBwZXJjZW50IGZvcm1hdC5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfG51bWJlcnx1bmRlZmluZWR8bnVsbH0gd2lkdGhfdG9rZW5cclxuXHQgKiBAcGFyYW0ge251bWJlcn0gZmFsbGJhY2tfcGVyY2VudFxyXG5cdCAqIEByZXR1cm5zIHtudW1iZXJ9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gcmVzb2x2ZV9mbGV4X2Jhc2lzX3BlcmNlbnQod2lkdGhfdG9rZW4sIGZhbGxiYWNrX3BlcmNlbnQpIHtcclxuXHRcdGlmICggdHlwZW9mIHdpZHRoX3Rva2VuID09PSAnc3RyaW5nJyApIHtcclxuXHRcdFx0dmFyIHMgPSB3aWR0aF90b2tlbi50cmltKCk7XHJcblx0XHRcdGlmICggcy5lbmRzV2l0aCggJyUnICkgKSB7XHJcblx0XHRcdFx0dmFyIHAgPSBwYXJzZUZsb2F0KCBzICk7XHJcblx0XHRcdFx0aWYgKCBpc0Zpbml0ZSggcCApICkgcmV0dXJuIHA7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdGlmICggdHlwZW9mIHdpZHRoX3Rva2VuID09PSAnbnVtYmVyJyAmJiBpc0Zpbml0ZSggd2lkdGhfdG9rZW4gKSApIHtcclxuXHRcdFx0cmV0dXJuIHdpZHRoX3Rva2VuO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIGZhbGxiYWNrX3BlcmNlbnQ7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBDb21wdXRlIGVmZmVjdGl2ZSBmbGV4LWJhc2lzIHZhbHVlcyB0aGF0IHJlc3BlY3QgaW50ZXItY29sdW1uIGdhcFxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGNvbHVtbnNcclxuXHQgKiBAcGFyYW0gZ2FwX3BlcmNlbnRcclxuXHQgKiBAcmV0dXJucyB7Kn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiBjb21wdXRlX2VmZmVjdGl2ZV9iYXNlcyhjb2x1bW5zLCBnYXBfcGVyY2VudCA9IDMpIHtcclxuXHJcblx0XHRjb25zdCBuID0gY29sdW1ucyAmJiBjb2x1bW5zLmxlbmd0aCA/IGNvbHVtbnMubGVuZ3RoIDogMTtcclxuXHJcblx0XHRjb25zdCByYXcgPSBjb2x1bW5zLm1hcCggKGNvbCkgPT4ge1xyXG5cdFx0XHRjb25zdCB3ID0gY29sICYmIGNvbC53aWR0aCAhPSBudWxsID8gU3RyaW5nKCBjb2wud2lkdGggKS50cmltKCkgOiAnJztcclxuXHRcdFx0Y29uc3QgcCA9IHcuZW5kc1dpdGgoICclJyApID8gcGFyc2VGbG9hdCggdyApIDogdyA/IHBhcnNlRmxvYXQoIHcgKSA6IE5hTjtcclxuXHRcdFx0cmV0dXJuIE51bWJlci5pc0Zpbml0ZSggcCApID8gcCA6IDEwMCAvIG47XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0Y29uc3Qgc3VtX3JhdyAgICAgPSByYXcucmVkdWNlKCAoYSwgYikgPT4gYSArIGIsIDAgKSB8fCAxMDA7XHJcblx0XHRjb25zdCBncCAgICAgICAgICA9IE51bWJlci5pc0Zpbml0ZSggK2dhcF9wZXJjZW50ICkgPyArZ2FwX3BlcmNlbnQgOiAzO1xyXG5cdFx0Y29uc3QgdG90YWxfZ2FwcyAgPSBNYXRoLm1heCggMCwgbiAtIDEgKSAqIGdwO1xyXG5cdFx0Y29uc3QgYXZhaWxhYmxlICAgPSBNYXRoLm1heCggMCwgMTAwIC0gdG90YWxfZ2FwcyApO1xyXG5cdFx0Y29uc3Qgc2NhbGVfcmF0aW8gPSBhdmFpbGFibGUgLyBzdW1fcmF3O1xyXG5cclxuXHRcdHJldHVybiByYXcubWFwKCAocCkgPT4gTWF0aC5tYXgoIDAsIHAgKiBzY2FsZV9yYXRpbyApICk7XHJcblx0fVxyXG5cclxuXHQvLyA9PSBhZGFwdGVyOiBidWlsZGVyIChhcnJheS1vZi1wYWdlcykgPiBleHBvcnRlciBzaGFwZSB7IHBhZ2VzOiBbIHsgaXRlbXM6WyB7a2luZCxkYXRhfSBdIH0gXSB9ID09PT09PT09PT09PT09PT09PVxyXG5cdGZ1bmN0aW9uIGFkYXB0X2J1aWxkZXJfc3RydWN0dXJlX3RvX2V4cG9ydGVyKHN0cnVjdHVyZSkge1xyXG5cclxuLy9cdFx0aWYgKCAhQXJyYXkuaXNBcnJheSggc3RydWN0dXJlICkgKSByZXR1cm4geyBwYWdlczogW10gfTtcclxuXHJcblx0XHQvLyBFbnN1cmUgYXQgbGVhc3Qgb25lIHBhZ2UgZXhpc3RzLCBldmVuIHdoZW4gQnVpbGRlciBzdHJ1Y3R1cmUgaXMgZW1wdHkgYFtdYC5cclxuXHRcdC8vIFRoaXMga2VlcHMgZXhwb3J0ZWQgQWR2YW5jZWQgRm9ybSB2YWxpZCAod2l6YXJkIHN0ZXAgIzEgZXhpc3RzKS5cclxuXHRcdGlmICggISBBcnJheS5pc0FycmF5KCBzdHJ1Y3R1cmUgKSB8fCBzdHJ1Y3R1cmUubGVuZ3RoID09PSAwICkge1xyXG5cdFx0XHRyZXR1cm4geyBwYWdlczogWyB7IGl0ZW1zOiBbXSB9IF0gfTtcclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCBub3JtYWxpemVfb3B0aW9ucyA9IChvcHRzKSA9PiB7XHJcblx0XHRcdGlmICggIUFycmF5LmlzQXJyYXkoIG9wdHMgKSApIHJldHVybiBbXTtcclxuXHRcdFx0cmV0dXJuIG9wdHMubWFwKCAobykgPT4ge1xyXG5cdFx0XHRcdGlmICggdHlwZW9mIG8gPT09ICdzdHJpbmcnICkgcmV0dXJuIHsgbGFiZWw6IG8sIHZhbHVlOiBvLCBzZWxlY3RlZDogZmFsc2UgfTtcclxuXHRcdFx0XHRpZiAoIG8gJiYgdHlwZW9mIG8gPT09ICdvYmplY3QnICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHRcdFx0bGFiZWwgICA6IFN0cmluZyggby5sYWJlbCA/PyBvLnZhbHVlID8/ICcnICksXHJcblx0XHRcdFx0XHRcdHZhbHVlICAgOiBTdHJpbmcoIG8udmFsdWUgPz8gby5sYWJlbCA/PyAnJyApLFxyXG5cdFx0XHRcdFx0XHRzZWxlY3RlZDogISFvLnNlbGVjdGVkXHJcblx0XHRcdFx0XHR9O1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm4geyBsYWJlbDogU3RyaW5nKCBvICksIHZhbHVlOiBTdHJpbmcoIG8gKSwgc2VsZWN0ZWQ6IGZhbHNlIH07XHJcblx0XHRcdH0gKTtcclxuXHRcdH07XHJcblxyXG5cdFx0Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cdFx0Ly8gPT0gQWRhcHRlciDigJMgYXR0YWNoIHBhcnNlZCBwZXItY29sdW1uIGBjb2xfc3R5bGVzYCBmcm9tIFNlY3Rpb24gaW50byBlYWNoIGNvbHVtblxyXG5cdFx0Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cdFx0Y29uc3Qgd2Fsa19zZWN0aW9uID0gKHNlYykgPT4ge1xyXG5cdFx0XHRjb25zdCBzZWN0aW9uX2NvbF9zdHlsZXMgPSBwYXJzZV9jb2xfc3R5bGVzX2pzb24oIHNlYyAmJiBzZWMuY29sX3N0eWxlcyApO1xyXG5cclxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0aWQgICAgICAgOiBzZWM/LmlkLFxuXHRcdFx0XHRodG1sX2lkICA6IHNlYz8uaHRtbF9pZCB8fCAnJyxcblx0XHRcdFx0Y3NzY2xhc3MgOiBzZWM/LmNzc2NsYXNzIHx8ICcnLFxuXHRcdFx0XHRjb2x1bW5zICA6IChzZWM/LmNvbHVtbnMgfHwgW10pLm1hcCggKGNvbCwgY29sX2luZGV4KSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgaXRlbXMgPSBBcnJheS5pc0FycmF5KCBjb2w/Lml0ZW1zIClcclxuXHRcdFx0XHRcdFx0PyBjb2wuaXRlbXNcclxuXHRcdFx0XHRcdFx0OiBbXHJcblx0XHRcdFx0XHRcdFx0Li4uKGNvbD8uZmllbGRzIHx8IFtdKS5tYXAoIChmKSA9PiAoeyB0eXBlOiAnZmllbGQnLCBkYXRhOiBmIH0pICksXHJcblx0XHRcdFx0XHRcdFx0Li4uKGNvbD8uc2VjdGlvbnMgfHwgW10pLm1hcCggKHMpID0+ICh7IHR5cGU6ICdzZWN0aW9uJywgZGF0YTogcyB9KSApXHJcblx0XHRcdFx0XHRcdF07XHJcblxyXG5cdFx0XHRcdFx0Y29uc3QgZmllbGRzID0gaXRlbXNcclxuXHRcdFx0XHRcdFx0LmZpbHRlciggKGl0KSA9PiBpdCAmJiBpdC50eXBlID09PSAnZmllbGQnIClcclxuXHRcdFx0XHRcdFx0Lm1hcCggKGl0KSA9PiAoeyAuLi5pdC5kYXRhLCBvcHRpb25zOiBub3JtYWxpemVfb3B0aW9ucyggaXQuZGF0YT8ub3B0aW9ucyApIH0pICk7XHJcblxyXG5cdFx0XHRcdFx0Y29uc3Qgc2VjdGlvbnMgPSBpdGVtc1xyXG5cdFx0XHRcdFx0XHQuZmlsdGVyKCAoaXQpID0+IGl0ICYmIGl0LnR5cGUgPT09ICdzZWN0aW9uJyApXHJcblx0XHRcdFx0XHRcdC5tYXAoIChpdCkgPT4gd2Fsa19zZWN0aW9uKCBpdC5kYXRhICkgKTtcclxuXHJcblx0XHRcdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdFx0XHR3aWR0aCAgICAgIDogY29sPy53aWR0aCB8fCAnMTAwJScsXHJcblx0XHRcdFx0XHRcdHN0eWxlICAgICAgOiBjb2w/LnN0eWxlIHx8IG51bGwsXHJcblx0XHRcdFx0XHRcdGNvbF9zdHlsZXMgOiBzZWN0aW9uX2NvbF9zdHlsZXNbIGNvbF9pbmRleCBdIHx8IG51bGwsICAgLy8gPC0gYXR0YWNoIHN0eWxlIG9iamVjdCBwZXIgY29sdW1uXHJcblx0XHRcdFx0XHRcdGZpZWxkcyxcclxuXHRcdFx0XHRcdFx0c2VjdGlvbnNcclxuXHRcdFx0XHRcdH07XHJcblx0XHRcdFx0fSApXHJcblx0XHRcdH07XHJcblx0XHR9O1xyXG5cclxuXHJcblx0XHRjb25zdCBwYWdlcyA9IHN0cnVjdHVyZS5tYXAoIChwYWdlKSA9PiB7XHJcblx0XHRcdGNvbnN0IGl0ZW1zID0gW107XHJcblx0XHRcdChwYWdlPy5jb250ZW50IHx8IFtdKS5mb3JFYWNoKCAoaXRlbSkgPT4ge1xyXG5cdFx0XHRcdGlmICggIWl0ZW0gKSByZXR1cm47XHJcblx0XHRcdFx0aWYgKCBpdGVtLnR5cGUgPT09ICdzZWN0aW9uJyAmJiBpdGVtLmRhdGEgKSB7XHJcblx0XHRcdFx0XHRpdGVtcy5wdXNoKCB7IGtpbmQ6ICdzZWN0aW9uJywgZGF0YTogd2Fsa19zZWN0aW9uKCBpdGVtLmRhdGEgKSB9ICk7XHJcblx0XHRcdFx0fSBlbHNlIGlmICggaXRlbS50eXBlID09PSAnZmllbGQnICYmIGl0ZW0uZGF0YSApIHtcclxuXHRcdFx0XHRcdGl0ZW1zLnB1c2goIHtcclxuXHRcdFx0XHRcdFx0a2luZDogJ2ZpZWxkJyxcclxuXHRcdFx0XHRcdFx0ZGF0YTogeyAuLi5pdGVtLmRhdGEsIG9wdGlvbnM6IG5vcm1hbGl6ZV9vcHRpb25zKCBpdGVtLmRhdGEub3B0aW9ucyApIH1cclxuXHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0cmV0dXJuIHsgaXRlbXMgfTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRyZXR1cm4geyBwYWdlcyB9O1xyXG5cdH1cclxuXHJcblxyXG5cdC8vID09IEJvb2tpbmcgRnJvbSBFeHBvcnRlciA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0Y2xhc3MgV1BCQ19CRkJfRXhwb3J0ZXIge1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogTXV0YWJsZSBza2lwLWxpc3QgZm9yIGF0dHJpYnV0ZSBuYW1lcyAobG93ZXJjYXNlKS5cclxuXHRcdCAqIFlvdSBjYW4gb3ZlcnJpZGUgaXQgdmlhIHNldF9za2lwX2F0dHJzKCkgb3IgYWRkIHdpdGggYWRkX3NraXBfYXR0cnMoKS5cclxuXHRcdCAqIEB0eXBlIHtTZXQ8c3RyaW5nPn1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHNraXBfYXR0cnMgPSBuZXcgU2V0KCk7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZXBsYWNlIHRoZSBlbnRpcmUgc2tpcCBsaXN0LlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmdbXX0gYXJyXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBzZXRfc2tpcF9hdHRycyggYXJyICkge1xyXG5cdFx0XHR0aGlzLnNraXBfYXR0cnMgPSBuZXcgU2V0KFxyXG5cdFx0XHRcdChBcnJheS5pc0FycmF5KCBhcnIgKSA/IGFyciA6IFtdKS5tYXAoIChuKSA9PiBTdHJpbmcoIG4gKS50b0xvd2VyQ2FzZSgpLnRyaW0oKSApLmZpbHRlciggQm9vbGVhbiApXHJcblx0XHRcdCk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBBZGQgb25lIG9yIG1hbnkgYXR0cmlidXRlcyB0byB0aGUgc2tpcCBsaXN0LlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd8c3RyaW5nW119IG5hbWVzXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBhZGRfc2tpcF9hdHRycyggbmFtZXMgKSB7XHJcblx0XHRcdCggQXJyYXkuaXNBcnJheSggbmFtZXMgKSA/IG5hbWVzIDogWyBuYW1lcyBdIClcclxuXHRcdFx0XHQubWFwKCAobikgPT4gU3RyaW5nKCBuICkudG9Mb3dlckNhc2UoKS50cmltKCkgKVxyXG5cdFx0XHRcdC5maWx0ZXIoIEJvb2xlYW4gKVxyXG5cdFx0XHRcdC5mb3JFYWNoKCAobikgPT4gdGhpcy5za2lwX2F0dHJzLmFkZCggbiApICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZW1vdmUgb25lIGF0dHJpYnV0ZSBmcm9tIHRoZSBza2lwIGxpc3QuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbmFtZVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgcmVtb3ZlX3NraXBfYXR0ciggbmFtZSApIHtcclxuXHRcdFx0aWYgKCAhIG5hbWUgKSB7IHJldHVybjsgfVxyXG5cdFx0XHR0aGlzLnNraXBfYXR0cnMuZGVsZXRlKCBTdHJpbmcoIG5hbWUgKS50b0xvd2VyQ2FzZSgpLnRyaW0oKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQXBwbHkgYXR0cmlidXRlIHNraXBwaW5nIHRvIGEgZmluYWwgSFRNTCBzdHJpbmcuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gaHRtbFxyXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgc2FuaXRpemVfZXhwb3J0KCBodG1sICkge1xyXG5cdFx0XHRyZXR1cm4gc3RyaXBfYXR0cmlidXRlc19mcm9tX21hcmt1cCggaHRtbCwgQXJyYXkuZnJvbSggdGhpcy5za2lwX2F0dHJzICkgKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBFeHBvcnQgYWRhcHRlZCBzdHJ1Y3R1cmUgdG8gYWR2YW5jZWQgZm9ybSB0ZXh0ICh3aXRoIDxyPi88Yz4gbGF5b3V0IGFuZCB3aXphcmQgd3JhcHBlcikuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGFkYXB0ZWRcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgW29wdGlvbnMubmV3bGluZT1cIlxcblwiXVxyXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5hZGRMYWJlbHM9dHJ1ZV1cclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSAgW29wdGlvbnMuZ2FwUGVyY2VudD0zXVxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGV4cG9ydF9mb3JtKGFkYXB0ZWQsIG9wdGlvbnMgPSB7fSkge1xyXG5cdFx0XHQvLyBpbmRlbnQ6IHVzZSByZWFsIFRBQiBieSBkZWZhdWx0IChjYW4gYmUgb3ZlcnJpZGRlbiB2aWEgb3B0aW9ucy5pbmRlbnQpXHJcblx0XHRcdGNvbnN0IGNmZyA9IHsgbmV3bGluZTogJ1xcbicsIGFkZExhYmVsczogdHJ1ZSwgZ2FwUGVyY2VudDogMywgaW5kZW50OiAnXFx0JywgLi4ub3B0aW9ucyB9O1xyXG5cdFx0XHRjb25zdCBJTkQgPSAodHlwZW9mIGNmZy5pbmRlbnQgPT09ICdzdHJpbmcnKSA/IGNmZy5pbmRlbnQgOiAnXFx0JztcclxuXHJcblx0XHRcdGxldCBkZXB0aCAgID0gMDtcclxuXHRcdFx0Y29uc3QgbGluZXMgPSBbXTtcclxuXHRcdFx0Y29uc3QgcHVzaCAgPSAocyA9ICcnKSA9PiBsaW5lcy5wdXNoKCBJTkQucmVwZWF0KCBkZXB0aCApICsgU3RyaW5nKCBzICkgKTtcclxuXHRcdFx0Y29uc3Qgb3BlbiAgPSAocyA9ICcnKSA9PiB7XHJcblx0XHRcdFx0cHVzaCggcyApO1xyXG5cdFx0XHRcdGRlcHRoKys7XHJcblx0XHRcdH07XHJcblx0XHRcdGNvbnN0IGNsb3NlID0gKHMgPSAnJykgPT4ge1xyXG5cdFx0XHRcdGRlcHRoID0gTWF0aC5tYXgoIDAsIGRlcHRoIC0gMSApO1xyXG5cdFx0XHRcdHB1c2goIHMgKTtcclxuXHRcdFx0fTtcclxuXHRcdFx0Y29uc3QgYmxhbmsgPSAoKSA9PiB7XHJcblx0XHRcdFx0bGluZXMucHVzaCggJycgKTtcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdGlmICggIWFkYXB0ZWQgfHwgIUFycmF5LmlzQXJyYXkoIGFkYXB0ZWQucGFnZXMgKSApIHJldHVybiAnJztcclxuXHJcblx0XHRcdC8vIEFsd2F5cyBleHBvcnQgYXQgbGVhc3Qgb25lIHdpemFyZCBzdGVwIHRvIGtlZXAgQWR2YW5jZWQgRm9ybSBzdHJ1Y3R1cmUgdmFsaWQuXHJcblx0XHRcdGNvbnN0IHBhZ2VzID0gYWRhcHRlZC5wYWdlcy5sZW5ndGggPyBhZGFwdGVkLnBhZ2VzIDogWyB7IGl0ZW1zOiBbXSB9IF07XHJcblxyXG5cdFx0XHRjb25zdCBjdHggPSB7IHVzZWRJZHM6IG5ldyBTZXQoKSB9O1xyXG5cclxuXHRcdFx0b3BlbiggYDxkaXYgY2xhc3M9XCJ3cGJjX2JmYl9mb3JtIHdwYmNfd2l6YXJkX19ib3JkZXJfY29udGFpbmVyXCI+YCApO1xyXG5cclxuXHRcdFx0Ly8gb25lLXBlci1mb3JtIGd1YXJkcyAoY2FsZW5kYXIgaXMgbm90IGdhdGVkIGhlcmUpXHJcblx0XHRcdGNvbnN0IG9uY2UgPSB7IGNhcHRjaGE6IDAsIGNvdW50cnk6IDAsIGNvdXBvbjogMCwgY29zdF9jb3JyZWN0aW9uczogMCwgc3VibWl0OiAwIH07XHJcblxyXG5cdFx0XHRwYWdlcy5mb3JFYWNoKCAocGFnZSwgcGFnZV9pbmRleCkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IGlzX2ZpcnN0ID0gcGFnZV9pbmRleCA9PT0gMDtcclxuXHRcdFx0XHRjb25zdCBzdGVwX251bSA9IHBhZ2VfaW5kZXggKyAxO1xyXG5cclxuXHRcdFx0XHRjb25zdCBoaWRkZW5fY2xhc3MgPSBpc19maXJzdCA/ICcnIDogJyB3cGJjX3dpemFyZF9zdGVwX2hpZGRlbic7XHJcblx0XHRcdFx0Y29uc3QgaGlkZGVuX3N0eWxlID0gaXNfZmlyc3QgPyAnJyA6ICcgc3R5bGU9XCJkaXNwbGF5Om5vbmU7Y2xlYXI6Ym90aDtcIic7XHJcblx0XHRcdFx0b3BlbiggYDxkaXYgY2xhc3M9XCJ3cGJjX3dpemFyZF9zdGVwIHdwYmNfX2Zvcm1fX2RpdiB3cGJjX3dpemFyZF9zdGVwJHtzdGVwX251bX0ke2hpZGRlbl9jbGFzc31cIiR7aGlkZGVuX3N0eWxlfT5gICk7XHJcblxyXG5cdFx0XHRcdChwYWdlLml0ZW1zIHx8IFtdKS5mb3JFYWNoKCAoaXRlbSkgPT4ge1xyXG5cdFx0XHRcdFx0aWYgKCBpdGVtLmtpbmQgPT09ICdzZWN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0V1BCQ19CRkJfRXhwb3J0ZXIucmVuZGVyX3NlY3Rpb24oIGl0ZW0uZGF0YSwgeyBvcGVuLCBjbG9zZSwgcHVzaCwgYmxhbmsgfSwgY2ZnLCBvbmNlLCBjdHggKTtcclxuXHRcdFx0XHRcdFx0Ly8gYmxhbmsoKTtcclxuXHRcdFx0XHRcdH0gZWxzZSBpZiAoIGl0ZW0ua2luZCA9PT0gJ2ZpZWxkJyApIHtcclxuXHRcdFx0XHRcdFx0b3BlbiggYDxyPmAgKTtcclxuXHRcdFx0XHRcdFx0b3BlbiggYDxjPmAgKTtcclxuXHRcdFx0XHRcdFx0V1BCQ19CRkJfRXhwb3J0ZXIucmVuZGVyX2ZpZWxkX25vZGUoIGl0ZW0uZGF0YSwgeyBvcGVuLCBjbG9zZSwgcHVzaCwgYmxhbmsgfSwgY2ZnLCBvbmNlLCBjdHggKTtcclxuXHRcdFx0XHRcdFx0Y2xvc2UoIGA8L2M+YCApO1xyXG5cdFx0XHRcdFx0XHRjbG9zZSggYDwvcj5gICk7XHJcblx0XHRcdFx0XHRcdC8vIGJsYW5rKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSApO1xyXG5cclxuXHRcdFx0XHRjbG9zZSggYDwvZGl2PmAgKTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Y2xvc2UoIGA8L2Rpdj5gICk7XHJcblx0XHRcdHJldHVybiBXUEJDX0JGQl9FeHBvcnRlci5zYW5pdGl6ZV9leHBvcnQoIGxpbmVzLmpvaW4oIGNmZy5uZXdsaW5lICkgKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBIaWdoLWxldmVsIGhlbHBlcjogZXhwb3J0IGZ1bGwgcGFja2FnZSBmcm9tIHJhdyBCdWlsZGVyIHN0cnVjdHVyZS5cclxuXHRcdCAqXHJcblx0XHQgKiAtIEFkYXB0cyByYXcgQnVpbGRlciBzdHJ1Y3R1cmUgKHBhZ2VzL3NlY3Rpb25zL2NvbHVtbnMvaXRlbXMpIGZvciBleHBvcnRlcnMuXHJcblx0XHQgKiAtIEJ1aWxkczpcclxuXHRcdCAqICAgICAg4oCiIGFkdmFuY2VkX2Zvcm0gIC0+IOKAnEFkdmFuY2VkIEZvcm0gKGV4cG9ydCnigJ0gdGV4dC5cclxuXHRcdCAqICAgICAg4oCiIGZpZWxkc19kYXRhICAgIC0+IOKAnENvbnRlbnQgb2YgYm9va2luZyBmaWVsZHMgZGF0YSAoZXhwb3J0KeKAnSB0ZXh0LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7QXJyYXl9ICBzdHJ1Y3R1cmUgIFJhdyBCdWlsZGVyIHN0cnVjdHVyZSBmcm9tIHdwYmNfYmZiLmdldF9zdHJ1Y3R1cmUoKS5cclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5nYXBQZXJjZW50PTNdICBDb2x1bW4gZ2FwIHBlcmNlbnQgZm9yIGxheW91dCBtYXRoLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm5zIHt7XHJcblx0XHQgKiAgIGFkdmFuY2VkX2Zvcm06IHN0cmluZyxcclxuXHRcdCAqICAgZmllbGRzX2RhdGE6IHN0cmluZyxcclxuXHRcdCAqICAgc3RydWN0dXJlOiBBcnJheSxcclxuXHRcdCAqICAgYWRhcHRlZDogT2JqZWN0XHJcblx0XHQgKiB9fVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZXhwb3J0X2FsbCggc3RydWN0dXJlLCBvcHRpb25zID0ge30gKSB7XHJcblxyXG5cdFx0XHQvLyAxKSBBZGFwdCBCdWlsZGVyIEpTT04gdG8gZXhwb3J0ZXIgc2hhcGUgKHBhZ2VzW10gLT4gaXRlbXNbXSkuXHJcblx0XHRcdGNvbnN0IGFkYXB0ZWQgPSBhZGFwdF9idWlsZGVyX3N0cnVjdHVyZV90b19leHBvcnRlciggc3RydWN0dXJlIHx8IFtdICk7XHJcblxyXG5cdFx0XHQvLyAyKSBBZHZhbmNlZCBGb3JtIHRleHQgKHNhbWUgbG9naWMgYXMgZGVidWcgcGFuZWwpLlxyXG5cdFx0XHRjb25zdCBnYXBfcGVyY2VudCAgID0gKCBvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zLmdhcFBlcmNlbnQgPT09ICdudW1iZXInICkgPyBvcHRpb25zLmdhcFBlcmNlbnQgOiAzO1xyXG5cdFx0XHRjb25zdCBhZHZhbmNlZF9mb3JtID0gV1BCQ19CRkJfRXhwb3J0ZXIuZXhwb3J0X2Zvcm0oXHJcblx0XHRcdFx0YWRhcHRlZCxcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRhZGRMYWJlbHMgOiB0cnVlLFxyXG5cdFx0XHRcdFx0Z2FwUGVyY2VudDogZ2FwX3BlcmNlbnRcclxuXHRcdFx0XHR9XHJcblx0XHRcdCk7XHJcblxyXG5cdFx0XHQvLyAzKSBDb250ZW50IG9mIGJvb2tpbmcgZmllbGRzIGRhdGEgKGlmIGNvbnRlbnQgZXhwb3J0ZXIgaXMgYXZhaWxhYmxlKS5cclxuXHRcdFx0bGV0IGZpZWxkc19kYXRhID0gJyc7XHJcblx0XHRcdGlmIChcclxuXHRcdFx0XHR3aW5kb3cuV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyICYmXHJcblx0XHRcdFx0dHlwZW9mIHdpbmRvdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIuZXhwb3J0X2NvbnRlbnQgPT09ICdmdW5jdGlvbidcclxuXHRcdFx0KSB7XHJcblx0XHRcdFx0ZmllbGRzX2RhdGEgPSB3aW5kb3cuV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyLmV4cG9ydF9jb250ZW50KFxyXG5cdFx0XHRcdFx0YWRhcHRlZCxcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0YWRkTGFiZWxzOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRzZXAgICAgICA6ICc6ICdcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHQpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdGFkdmFuY2VkX2Zvcm06IGFkdmFuY2VkX2Zvcm0gfHwgJycsXHJcblx0XHRcdFx0ZmllbGRzX2RhdGEgIDogZmllbGRzX2RhdGEgfHwgJycsXHJcblx0XHRcdFx0c3RydWN0dXJlICAgIDogc3RydWN0dXJlIHx8IFtdLFxyXG5cdFx0XHRcdGFkYXB0ZWQgICAgICA6IGFkYXB0ZWRcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0XHQvLyA9PSBFeHBvcnRlciDigJMgcmVuZGVyX3NlY3Rpb24oKSBub3cgaW5qZWN0cyBwZXItY29sdW1uIENTUyB2YXJzIGZyb20gYGNvbF9zdHlsZXNgXHJcblx0XHQvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0XHRzdGF0aWMgcmVuZGVyX3NlY3Rpb24oc2VjdGlvbiwgaW8sIGNmZywgb25jZSwgY3R4KSB7XHJcblxyXG5cdFx0XHRvbmNlID0gb25jZSB8fCB7IGNhcHRjaGE6IDAsIGNvdW50cnk6IDAsIGNvdXBvbjogMCwgY29zdF9jb3JyZWN0aW9uczogMCwgc3VibWl0OiAwIH07XHJcblx0XHRcdGN0eCAgPSBjdHggfHwgeyB1c2VkSWRzOiBuZXcgU2V0KCkgfTtcclxuXHJcblx0XHRcdGNvbnN0IHsgb3BlbiwgY2xvc2UgfSA9IGlvO1xyXG5cclxuXHRcdFx0Y29uc3QgY29scyA9IEFycmF5LmlzQXJyYXkoIHNlY3Rpb24uY29sdW1ucyApICYmIHNlY3Rpb24uY29sdW1ucy5sZW5ndGhcclxuXHRcdFx0XHQ/IHNlY3Rpb24uY29sdW1uc1xyXG5cdFx0XHRcdDogWyB7IHdpZHRoOiAnMTAwJScsIGZpZWxkczogW10sIHNlY3Rpb25zOiBbXSB9IF07XHJcblxyXG5cdFx0XHQvLyBSb3cgaXMgYWN0aXZlIGlmIEFOWSBjb2x1bW4gY2FycmllcyBzdHlsZXMuXHJcblx0XHRcdHZhciByb3dfaXNfYWN0aXZlID0gY29scy5zb21lKCBmdW5jdGlvbiAoY29sKSB7IHJldHVybiBoYXNfbm9uX2RlZmF1bHRfY29sX3N0eWxlcyggY29sICYmIGNvbC5jb2xfc3R5bGVzICk7IH0gKTtcblx0XHRcdHZhciByb3dfYXR0cl9hY3RpdmUgPSByb3dfaXNfYWN0aXZlID8gJyBkYXRhLWNvbHN0eWxlcy1hY3RpdmU9XCIxXCInIDogJyc7XG5cdFx0XHR2YXIgcm93X2N1c3RvbV9hdHRycyA9IFdQQkNfQkZCX0V4cG9ydGVyLml0ZW1fd3JhcHBlcl9hdHRycyggc2VjdGlvbiwgY3R4ICk7XG5cblx0XHRcdG9wZW4oIGA8ciR7cm93X2N1c3RvbV9hdHRyc30ke3Jvd19hdHRyX2FjdGl2ZX0+YCApO1xuXHJcblx0XHRcdGNvbnN0IGJhc2VzICAgID0gY29tcHV0ZV9lZmZlY3RpdmVfYmFzZXMoIGNvbHMsIGNmZy5nYXBQZXJjZW50ICk7XHJcblx0XHRcdGNvbnN0IGVzY19hdHRyID0gY29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5lc2NhcGVfaHRtbDtcclxuXHJcblx0XHRcdGNvbHMuZm9yRWFjaCggKGNvbCwgaWR4KSA9PiB7XHJcblx0XHRcdFx0Ly8gKDEpIFJlc29sdmUgZmxleC1iYXNpcy5cclxuXHRcdFx0XHR2YXIgZWZmX2Jhc2lzID0gcmVzb2x2ZV9mbGV4X2Jhc2lzX3BlcmNlbnQoIGNvbCAmJiBjb2wud2lkdGgsIE51bWJlci5pc0Zpbml0ZSggYmFzZXNbaWR4XSApID8gK2Jhc2VzW2lkeF0gOiAxMDAgKTtcclxuXHJcblx0XHRcdFx0Ly8gKDIpIEJ1aWxkIGlubGluZSBzdHlsZS5cclxuXHRcdFx0XHR2YXIgc3R5bGVfcGFydHMgPSBbXTtcclxuXHJcblx0XHRcdFx0aWYgKCBjb2wgJiYgdHlwZW9mIGNvbC5zdHlsZSA9PT0gJ3N0cmluZycgJiYgY29sLnN0eWxlLnRyaW0oKSApIHtcclxuXHRcdFx0XHRcdHN0eWxlX3BhcnRzLnB1c2goIGNvbC5zdHlsZS50cmltKCkucmVwbGFjZSggLzsrXFxzKiQvLCAnJyApICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHN0eWxlX3BhcnRzLnB1c2goICdmbGV4LWJhc2lzOiAnICsgKCBOdW1iZXIuaXNGaW5pdGUoIGVmZl9iYXNpcyApID8gZWZmX2Jhc2lzLnRvU3RyaW5nKCkgOiAnMTAwJyApICsgJyUnICk7XHJcblxyXG5cdFx0XHRcdHZhciBjc3NfdmFyc19zdHIgPSBidWlsZF9jb2xfY3NzX3ZhcnMoIGNvbCAmJiBjb2wuY29sX3N0eWxlcyApO1xyXG5cdFx0XHRcdGlmICggY3NzX3ZhcnNfc3RyICkge1xyXG5cdFx0XHRcdFx0c3R5bGVfcGFydHMucHVzaCggY3NzX3ZhcnNfc3RyLnJlcGxhY2UoIC9eO3w7JC9nLCAnJyApICk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR2YXIgc3R5bGVfYXR0ciA9IGAgc3R5bGU9XCIke2VzY19hdHRyKCBzdHlsZV9wYXJ0cy5qb2luKCAnOyAnICkgKX1cImA7XHJcblxyXG5cdFx0XHRcdC8vICgzKSBDb2x1bW4tbGV2ZWwgYWN0aXZhdGlvbiAobW9yZSBwcmVjaXNlIHNjb3BpbmcpXHJcblx0XHRcdFx0dmFyIGNvbF9pc19hY3RpdmUgICA9IGhhc19ub25fZGVmYXVsdF9jb2xfc3R5bGVzKCBjb2wgJiYgY29sLmNvbF9zdHlsZXMgKTtcclxuXHRcdFx0XHR2YXIgY29sX2F0dHJfYWN0aXZlID0gY29sX2lzX2FjdGl2ZSA/ICcgZGF0YS1jb2xzdHlsZXMtYWN0aXZlPVwiMVwiJyA6ICcnO1xyXG5cclxuXHRcdFx0XHRvcGVuKCBgPGMke2NvbF9hdHRyX2FjdGl2ZX0ke3N0eWxlX2F0dHJ9PmAgKTtcclxuXHJcblx0XHRcdFx0Ly8gVXNlIHRoZSBzaGFyZWQgb25jZS9jdHggb2JqZWN0cyBzbyBzaW5nbGUtcGVyLWZvcm0gZ3VhcmRzIHdvcmsgYWNyb3NzIHRoZSB3aG9sZSBmb3JtLlxyXG5cdFx0XHRcdChjb2wuZmllbGRzIHx8IFtdKS5mb3JFYWNoKCAobm9kZSkgPT5cclxuXHRcdFx0XHRcdFdQQkNfQkZCX0V4cG9ydGVyLnJlbmRlcl9maWVsZF9ub2RlKCBub2RlLCBpbywgY2ZnLCBvbmNlLCBjdHggKVxyXG5cdFx0XHRcdCk7XHJcblxyXG5cdFx0XHRcdC8vIFJlY3Vyc2Ugd2l0aCB0aGUgc2FtZSBvbmNlL2N0eCBhcyB3ZWxsLlxyXG5cdFx0XHRcdChjb2wuc2VjdGlvbnMgfHwgW10pLmZvckVhY2goIChuZXN0ZWQpID0+XHJcblx0XHRcdFx0XHRXUEJDX0JGQl9FeHBvcnRlci5yZW5kZXJfc2VjdGlvbiggbmVzdGVkLCBpbywgY2ZnLCBvbmNlLCBjdHggKVxyXG5cdFx0XHRcdCk7XHJcblxyXG5cdFx0XHRcdGNsb3NlKCBgPC9jPmAgKTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Y2xvc2UoIGA8L3I+YCApO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEJ1aWxkIGEgc2FuaXRpemVkIGN1c3RvbSBDU1MgY2xhc3MgYW5kIEhUTUwgSUQgYXR0cmlidXRlIHN0cmluZyBmb3IgYW4gZXhwb3J0ZWQgd3JhcHBlci5cblx0XHQgKiBVc2VkIGJ5IHNlY3Rpb24gcm93IHdyYXBwZXJzIGFuZCBmaWVsZHMgd2hvc2UgYXR0cmlidXRlcyBiZWxvbmcgb24gdGhlIDxpdGVtPiB3cmFwcGVyLlxuXHRcdCAqIEFsc28gZW5zdXJlcyB1bmlxdWVuZXNzIG9mIHRoZSBodG1sX2lkIGFjcm9zcyB0aGUgZXhwb3J0ICh1c2VzIGN0eC51c2VkSWRzKS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSB3cmFwcGVyX2RhdGEgT2JqZWN0IGNvbnRhaW5pbmcgb3B0aW9uYWwgY3NzY2xhc3MgYW5kIGh0bWxfaWQgcHJvcGVydGllcy5cblx0XHQgKiBAcGFyYW0ge3t1c2VkSWRzOlNldDxzdHJpbmc+fX0gY3R4XG5cdFx0ICogQHJldHVybnMge3N0cmluZ30gZS5nLiAnIGNsYXNzPVwieCB5XCIgaWQ9XCJteUlkXCInXG5cdFx0ICovXG5cdFx0c3RhdGljIGl0ZW1fd3JhcHBlcl9hdHRycyh3cmFwcGVyX2RhdGEsIGN0eCkge1xuXHRcdFx0aWYgKCAhIHdyYXBwZXJfZGF0YSApIHtcblx0XHRcdFx0cmV0dXJuICcnO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZXNjX2h0bWwgID0gY29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5lc2NhcGVfaHRtbDtcclxuXHRcdFx0Y29uc3QgY2xzX3Nhbml0ID0gY29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5zYW5pdGl6ZV9jc3NfY2xhc3NsaXN0O1xyXG5cdFx0XHRjb25zdCBzaWQgICAgICAgPSBjb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2h0bWxfaWQ7XHJcblxyXG5cdFx0XHRsZXQgb3V0ID0gJyc7XHJcblxyXG5cdFx0XHRjb25zdCBjbHNfcmF3ID0gU3RyaW5nKCB3cmFwcGVyX2RhdGEuY3NzY2xhc3NfZXh0cmEgfHwgd3JhcHBlcl9kYXRhLmNzc2NsYXNzIHx8IHdyYXBwZXJfZGF0YS5jbGFzcyB8fCAnJyApO1xuXHRcdFx0Y29uc3QgY2xzICAgICA9IGNsc19zYW5pdCggY2xzX3JhdyApO1xuXHRcdFx0bGV0IGh0bWxfaWQgICA9IHdyYXBwZXJfZGF0YS5odG1sX2lkID8gc2lkKCBTdHJpbmcoIHdyYXBwZXJfZGF0YS5odG1sX2lkICkgKSA6ICcnO1xuXHRcdFx0aWYgKCBodG1sX2lkICYmIGN0eD8udXNlZElkcyApIHtcclxuXHRcdFx0XHRsZXQgdW5pcXVlID0gaHRtbF9pZCwgaSA9IDI7XHJcblx0XHRcdFx0d2hpbGUgKCBjdHgudXNlZElkcy5oYXMoIHVuaXF1ZSApICkge1xyXG5cdFx0XHRcdFx0dW5pcXVlID0gYCR7aHRtbF9pZH1fJHtpKyt9YDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Y3R4LnVzZWRJZHMuYWRkKCB1bmlxdWUgKTtcclxuXHRcdFx0XHRodG1sX2lkID0gdW5pcXVlO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggY2xzICkge1xyXG5cdFx0XHRcdG91dCArPSBgIGNsYXNzPVwiJHtlc2NfaHRtbCggY2xzICl9XCJgO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggaHRtbF9pZCApIHtcclxuXHRcdFx0XHRvdXQgKz0gYCBpZD1cIiR7ZXNjX2h0bWwoIGh0bWxfaWQgKX1cImA7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBvdXQ7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cdFx0Ly8gPT0gRmllbGRzIOKAkyBwbHVnZ2FibGUsIHBhY2stZHJpdmVuIGV4cG9ydFxyXG5cdFx0Ly8gPT0gV3JhcCBldmVyeSBleHBvcnRlZCBmaWVsZCBpbnNpZGUgPGl0ZW0+4oCmPC9pdGVtPiBhbmQgZGVsZWdhdGUgYWN0dWFsIHNob3J0Y29kZSBleHBvcnRcclxuXHRcdC8vID09IHRvIHBlci1wYWNrIGNhbGxiYWNrcyByZWdpc3RlcmVkIHZpYSBXUEJDX0JGQl9FeHBvcnRlci5yZWdpc3Rlcih0eXBlLCBmbikuXHJcblx0XHQvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0XHRzdGF0aWMgcmVuZGVyX2ZpZWxkX25vZGUoZmllbGQsIGlvLCBjZmcsIG9uY2UsIGN0eCkge1xyXG5cclxuXHRcdFx0Y29uc3QgeyBvcGVuLCBjbG9zZSwgcHVzaCB9ID0gaW87XHJcblx0XHRcdGlmICggISBmaWVsZCB8fCAhIGZpZWxkLnR5cGUgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBTaGFyZWQgY29udGV4dCAodXNlZElkcywg4oCcb25jZS1wZXItZm9ybeKAnSBndWFyZHMsIGV0Yy4pLlxyXG5cdFx0XHRvbmNlID0gb25jZSB8fCB7fTtcclxuXHRcdFx0Y3R4ICA9IGN0eCAgfHwgeyB1c2VkSWRzOiBuZXcgU2V0KCkgfTtcclxuXHJcblx0XHRcdGNvbnN0IHR5cGUgPSBTdHJpbmcoIGZpZWxkLnR5cGUgKS50b0xvd2VyQ2FzZSgpO1xyXG5cclxuXHRcdFx0Ly8gT3B0aW9uYWwgd3JhcHBlciBhdHRycyBmb3Igc3BlY2lhbCB0eXBlcyAoY3VycmVudGx5IG9ubHkgdXNlZCBieSBjYXB0Y2hhKS5cclxuXHRcdFx0bGV0IGl0ZW1fYXR0cnMgPSAnJztcclxuXHRcdFx0aWYgKCB0eXBlID09PSAnY2FwdGNoYScgKSB7XHJcblx0XHRcdFx0aXRlbV9hdHRycyA9IFdQQkNfQkZCX0V4cG9ydGVyLml0ZW1fd3JhcHBlcl9hdHRycyggZmllbGQsIGN0eCApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRvcGVuKCBgPGl0ZW0ke2l0ZW1fYXR0cnN9PmAgKTtcclxuXHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0Ly8gMSkgTGV0IHRoZSBjb3JyZXNwb25kaW5nIGZpZWxkIHBhY2sgaGFuZGxlIGV4cG9ydC5cclxuXHRcdFx0XHRsZXQgaGFuZGxlZCA9IGZhbHNlO1xyXG5cdFx0XHRcdGlmICggV1BCQ19CRkJfRXhwb3J0ZXIuaGFzX2V4cG9ydGVyKCB0eXBlICkgKSB7XHJcblx0XHRcdFx0XHRoYW5kbGVkID0gV1BCQ19CRkJfRXhwb3J0ZXIucnVuX3JlZ2lzdGVyZWRfZXhwb3J0ZXIoIGZpZWxkLCBpbywgY2ZnLCBvbmNlLCBjdHggKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIDIpIEZhbGxiYWNrOiBzaG93IGEgY2xlYXIgVE9ETyBjb21tZW50IGlmIG5vIGV4cG9ydGVyIGlzIHJlZ2lzdGVyZWQuXHJcblx0XHRcdFx0aWYgKCAhIGhhbmRsZWQgKSB7XHJcblx0XHRcdFx0XHRjb25zdCBuYW1lID0gV1BCQ19CRkJfRXhwb3J0ZXIuY29tcHV0ZV9uYW1lKCB0eXBlLCBmaWVsZCApO1xyXG5cdFx0XHRcdFx0cHVzaCggYDwhLS0gVE9ETzogbWFwIGZpZWxkIHR5cGUgXCIke3R5cGV9XCIgbmFtZT1cIiR7bmFtZX1cIiBpbiBhIHBhY2sgZXhwb3J0ZXIgLS0+YCApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gMykgQXBwZW5kIGhlbHAgdGV4dCBjb25zaXN0ZW50bHkgKHBhY2tzIHNob3VsZG7igJl0IGR1cGxpY2F0ZSB0aGlzKS5cclxuXHRcdFx0XHRpZiAoIGZpZWxkLmhlbHAgKSB7XHJcblx0XHRcdFx0XHRwdXNoKFxyXG5cdFx0XHRcdFx0XHRgPGRpdiBjbGFzcz1cIndwYmNfZmllbGRfZGVzY3JpcHRpb25cIj4ke2NvcmUuV1BCQ19CRkJfU2FuaXRpemUuZXNjYXBlX2h0bWwoXHJcblx0XHRcdFx0XHRcdFx0U3RyaW5nKCBmaWVsZC5oZWxwIClcclxuXHRcdFx0XHRcdFx0KX08L2Rpdj5gXHJcblx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBmaW5hbGx5IHtcclxuXHRcdFx0XHQvLyBBbHdheXMgY2xvc2Ugd3JhcHBlci5cclxuXHRcdFx0XHRjbG9zZSggYDwvaXRlbT5gICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0XHQvLyA9PSBIZWxwZXJzID09XHJcblx0XHQvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0XHRzdGF0aWMgaXNfcmVxdWlyZWQoZmllbGQpIHtcclxuXHRcdFx0Y29uc3QgdiA9IGZpZWxkICYmIGZpZWxkLnJlcXVpcmVkO1xyXG5cdFx0XHRyZXR1cm4gKFxyXG5cdFx0XHRcdHYgPT09IHRydWUgfHxcclxuXHRcdFx0XHR2ID09PSAndHJ1ZScgfHxcclxuXHRcdFx0XHR2ID09PSAxIHx8XHJcblx0XHRcdFx0diA9PT0gJzEnIHx8XHJcblx0XHRcdFx0diA9PT0gJ3JlcXVpcmVkJ1xyXG5cdFx0XHQpO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNoYXJlZCBsYWJlbCBlbWl0dGVyIHVzZWQgYnkgcGVyLXBhY2sgZXhwb3J0ZXJzLlxyXG5cdFx0ICpcclxuXHRcdCAqIEVtaXRzIG9wdGlvbmFsIDxsPkxhYmVsPC9sPiArIDxicj4gYmVmb3JlIHRoZSBwcm92aWRlZCBib2R5LFxyXG5cdFx0ICogcmVzcGVjdGluZyBjZmcuYWRkTGFiZWxzLiBIZWxwIHRleHQgaXMgZW1pdHRlZCBjZW50cmFsbHkgaW5cclxuXHRcdCAqIHJlbmRlcl9maWVsZF9ub2RlKCksIHNvIGl0IGlzIGludGVudGlvbmFsbHkgTk9UIGhhbmRsZWQgaGVyZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICAgICAgICAgICAgICBmaWVsZFxyXG5cdFx0ICogQHBhcmFtIHtmdW5jdGlvbihzdHJpbmcpOiB2b2lkfSAgZW1pdFxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgYm9keVxyXG5cdFx0ICogQHBhcmFtIHt7YWRkTGFiZWxzPzogYm9vbGVhbn19ICBbY2ZnXVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZW1pdF9sYWJlbF90aGVuKGZpZWxkLCBlbWl0LCBib2R5LCBjZmcpIHtcclxuXHRcdFx0aWYgKCB0eXBlb2YgZW1pdCAhPT0gJ2Z1bmN0aW9uJyApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHRjZmcgPSBjZmcgfHwge307XHJcblx0XHRcdGNvbnN0IGFkZExhYmVscyA9IGNmZy5hZGRMYWJlbHMgIT09IGZhbHNlO1xyXG5cclxuXHRcdFx0Y29uc3QgcmF3ICAgPSAoZmllbGQgJiYgdHlwZW9mIGZpZWxkLmxhYmVsID09PSAnc3RyaW5nJykgPyBmaWVsZC5sYWJlbCA6ICcnO1xyXG5cdFx0XHRjb25zdCBsYWJlbCA9IHJhdy50cmltKCk7XHJcblxyXG5cdFx0XHR2YXIgaXNfcmVxICAgPSB0aGlzLmlzX3JlcXVpcmVkKCBmaWVsZCApO1xyXG5cdFx0XHR2YXIgcmVxX21hcmsgPSBpc19yZXEgPyAnKicgOiAnJztcclxuXHJcblx0XHRcdGlmICggbGFiZWwgJiYgYWRkTGFiZWxzICkge1xyXG5cdFx0XHRcdGNvbnN0IGVzY19odG1sID0gY29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5lc2NhcGVfaHRtbDtcclxuXHRcdFx0XHRlbWl0KCAnPGw+JyArIGVzY19odG1sKCBsYWJlbCApICsgcmVxX21hcmsgKyAnPC9sPicgKTtcclxuXHRcdFx0XHRlbWl0KCAnPGJyPicgKyBib2R5ICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0ZW1pdCggYm9keSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHRcdC8vID09IEhlbHBlcnMgPT1cclxuXHRcdC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcblx0XHQvLyAtLSBUaW1lIFNlbGVjdCBIZWxwZXJzIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRzdGF0aWMgaXNfdGltZXNsb3RfcGlja2VyX2VuYWJsZWQoKSB7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0cmV0dXJuICEhKHdpbmRvdy5fd3BiYyAmJiB0eXBlb2Ygd2luZG93Ll93cGJjLmdldF9vdGhlcl9wYXJhbSA9PT0gJ2Z1bmN0aW9uJ1xyXG5cdFx0XHRcdFx0JiYgd2luZG93Ll93cGJjLmdldF9vdGhlcl9wYXJhbSgnaXNfZW5hYmxlZF9ib29raW5nX3RpbWVzbG90X3BpY2tlcicpKTtcclxuXHRcdFx0fSBjYXRjaCAoXykgeyByZXR1cm4gZmFsc2U7IH1cclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgdGltZV9wbGFjZWhvbGRlcl9mb3IobmFtZSwgZmllbGQpIHtcclxuXHRcdFx0Ly8gUHJlZmVyIGZpZWxkLXNwZWNpZmljIHBsYWNlaG9sZGVyOyBlbHNlIHNlbnNpYmxlIGRlZmF1bHQgcGVyIGZpZWxkLlxyXG5cdFx0XHRpZiAodHlwZW9mIGZpZWxkLnBsYWNlaG9sZGVyID09PSAnc3RyaW5nJyAmJiBmaWVsZC5wbGFjZWhvbGRlci50cmltKCkpIHtcclxuXHRcdFx0XHRyZXR1cm4gZmllbGQucGxhY2Vob2xkZXIudHJpbSgpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmIChuYW1lID09PSAnZHVyYXRpb250aW1lJykgcmV0dXJuICctLS0gU2VsZWN0IGR1cmF0aW9uIC0tLSc7XHJcblx0XHRcdHJldHVybiAnLS0tIFNlbGVjdCB0aW1lIC0tLSc7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBCdWlsZCB0b2tlbnMvZGVmYXVsdCBmb3IgYSB0aW1lLWxpa2Ugc2VsZWN0IChzdGFydC9lbmQvcmFuZ2UvZHVyYXRpb24pLlxyXG5cdFx0ICogLSBBZGRzIGFuIGVtcHR5LXZhbHVlIHBsYWNlaG9sZGVyIGFzIHRoZSBmaXJzdCBvcHRpb24gb25seSB3aGVuOlxyXG5cdFx0ICogICDigKIgdGltZSBwaWNrZXIgaXMgT0ZGLCBhbmRcclxuXHRcdCAqICAg4oCiIG5vIG9wdGlvbiBpcyBzZWxlY3RlZCBieSBkZWZhdWx0LCBhbmRcclxuXHRcdCAqICAg4oCiIHRoZXJlIGlzbid0IGFscmVhZHkgYW4gZW1wdHktdmFsdWUgb3B0aW9uLlxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgYnVpbGRfdGltZV9zZWxlY3RfdG9rZW5zKGZpZWxkLCBuYW1lKSB7XHJcblx0XHRcdGxldCB0b2tlbnNfc3RyID0gdGhpcy5vcHRpb25fdG9rZW5zKGZpZWxkKTtcclxuXHRcdFx0bGV0IGRlZl9zdHIgICAgPSB0aGlzLmRlZmF1bHRfb3B0aW9uX3N1ZmZpeChmaWVsZCwgdG9rZW5zX3N0cik7XHJcblxyXG5cdFx0XHRpZiAoIXRoaXMuaXNfdGltZXNsb3RfcGlja2VyX2VuYWJsZWQoKSkge1xyXG5cdFx0XHRcdGNvbnN0IG9wdHMgPSBBcnJheS5pc0FycmF5KGZpZWxkLm9wdGlvbnMpID8gZmllbGQub3B0aW9ucyA6IFtdO1xyXG5cclxuXHRcdFx0XHRjb25zdCBoYXNfc2VsZWN0ZWRfZGVmYXVsdCA9IG9wdHMuc29tZShvID0+XHJcblx0XHRcdFx0XHRvICYmIChvLnNlbGVjdGVkID09PSB0cnVlIHx8IG8uc2VsZWN0ZWQgPT09ICd0cnVlJyB8fCBvLnNlbGVjdGVkID09PSAxIHx8IG8uc2VsZWN0ZWQgPT09ICcxJylcclxuXHRcdFx0XHQpO1xyXG5cclxuXHRcdFx0XHRpZiAoIWhhc19zZWxlY3RlZF9kZWZhdWx0KSB7XHJcblx0XHRcdFx0XHRjb25zdCBoYXNfZW1wdHlfdmFsdWVfb3B0aW9uID0gb3B0cy5zb21lKG8gPT5cclxuXHRcdFx0XHRcdFx0byAmJiB0eXBlb2Ygby52YWx1ZSAhPT0gJ3VuZGVmaW5lZCcgJiYgU3RyaW5nKG8udmFsdWUpLnRyaW0oKSA9PT0gJydcclxuXHRcdFx0XHRcdCk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCFoYXNfZW1wdHlfdmFsdWVfb3B0aW9uKSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IHBoVGV4dCAgICAgPSB0aGlzLnRpbWVfcGxhY2Vob2xkZXJfZm9yKG5hbWUsIGZpZWxkKTtcclxuXHRcdFx0XHRcdFx0Y29uc3QgcGhUb2tlblN0ciA9ICdcIicgKyBjb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY2FwZV9mb3Jfc2hvcnRjb2RlKHBoVGV4dCArICdAQCcpICsgJ1wiJztcclxuXHJcblx0XHRcdFx0XHRcdGNvbnN0IG90aGVyID0gdGhpcy5vcHRpb25fdG9rZW5zKGZpZWxkKS50cmltKCk7IC8vIHJlY29tcHV0ZSwgdHJpbSBsZWFkaW5nIHNwYWNlXHJcblx0XHRcdFx0XHRcdHRva2Vuc19zdHIgID0gJyAnICsgcGhUb2tlblN0ciArIChvdGhlciA/ICgnICcgKyBvdGhlcikgOiAnJyk7XHJcblxyXG5cdFx0XHRcdFx0XHQvLyBFbnN1cmUgZmlyc3Qgb3B0aW9uIChvdXIgcGxhY2Vob2xkZXIpIGJlY29tZXMgdGhlIGRlZmF1bHQgaW1wbGljaXRseVxyXG5cdFx0XHRcdFx0XHRkZWZfc3RyID0gJyc7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiB7IHRva2Vuc19zdHIsIGRlZl9zdHIgfTtcclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgZW1pdF90aW1lX3NlbGVjdChuYW1lLCBmaWVsZCwgcmVxX21hcmssIGlkX29wdCwgY2xzX29wdHMsIGVtaXRfbGFiZWxfdGhlbikge1xyXG5cdFx0XHRjb25zdCB7IHRva2Vuc19zdHIsIGRlZl9zdHIgfSA9IHRoaXMuYnVpbGRfdGltZV9zZWxlY3RfdG9rZW5zKGZpZWxkLCBuYW1lKTtcclxuXHRcdFx0Ly8gTk9URTogTm8gc2l6ZS9waCB0b2tlbnMgaGVyZSB0byBtaXJyb3IgcmFuZ2V0aW1lIGJlaGF2aW9yIGV4YWN0bHkuXHJcblx0XHRcdGVtaXRfbGFiZWxfdGhlbihgW3NlbGVjdGJveCR7cmVxX21hcmt9ICR7bmFtZX0ke2lkX29wdH0ke2Nsc19vcHRzfSR7ZGVmX3N0cn0ke3Rva2Vuc19zdHJ9XWApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tIE90aGVyIEhlbHBlcnMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vIFJldHVybiBhIGZpZWxkJ3MgZGVmYXVsdCB2YWx1ZSAoc3VwcG9ydHMgYm90aCBjYW1lbENhc2UgYW5kIHNuYWtlX2Nhc2UpLlxyXG5cdFx0c3RhdGljIGdldF9kZWZhdWx0X3ZhbHVlKGZpZWxkKSB7XHJcblx0XHRcdGNvbnN0IHYgPSBmaWVsZD8uZGVmYXVsdF92YWx1ZSA/PyBmaWVsZD8uZGVmYXVsdFZhbHVlID8/ICcnO1xyXG5cdFx0XHRyZXR1cm4gKHYgPT0gbnVsbCkgPyAnJyA6IFN0cmluZyggdiApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIEZvciB0ZXh0LWxpa2UgZmllbGRzLCB0aGUgZGVmYXVsdCBpcyBhIGZpbmFsIHF1b3RlZCB0b2tlbiBpbiB0aGUgc2hvcnRjb2RlLlxyXG5cdFx0c3RhdGljIGRlZmF1bHRfdGV4dF9zdWZmaXgoZmllbGQpIHtcclxuXHRcdFx0Y29uc3QgdiA9IHRoaXMuZ2V0X2RlZmF1bHRfdmFsdWUoIGZpZWxkICk7XHJcblx0XHRcdGlmICggIXYgKSByZXR1cm4gJyc7XHJcblx0XHRcdHJldHVybiBgIFwiJHtjb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY2FwZV9mb3Jfc2hvcnRjb2RlKCB2ICl9XCJgO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBjbGFzc19vcHRpb25zKGZpZWxkKSB7XHJcblx0XHRcdGNvbnN0IHJhdyA9IGZpZWxkLmNsYXNzIHx8IGZpZWxkLmNsYXNzTmFtZSB8fCBmaWVsZC5jc3NjbGFzcyB8fCAnJztcclxuXHRcdFx0Y29uc3QgY2xzID0gY29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5zYW5pdGl6ZV9jc3NfY2xhc3NsaXN0KCBTdHJpbmcoIHJhdyApICk7XHJcblx0XHRcdGlmICggIWNscyApIHJldHVybiAnJztcclxuXHRcdFx0cmV0dXJuIGNsc1xyXG5cdFx0XHRcdC5zcGxpdCggL1xccysvIClcclxuXHRcdFx0XHQuZmlsdGVyKCBCb29sZWFuIClcclxuXHRcdFx0XHQubWFwKCAoYykgPT4gYCBjbGFzczoke2NvcmUuV1BCQ19CRkJfU2FuaXRpemUudG9fdG9rZW4oIGMgKX1gIClcclxuXHRcdFx0XHQuam9pbiggJycgKTtcclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgaWRfb3B0aW9uKGZpZWxkLCBjdHgpIHtcclxuXHRcdFx0Y29uc3QgcmF3X2lkID0gZmllbGQuaHRtbF9pZCB8fCBmaWVsZC5pZF9hdHRyO1xyXG5cdFx0XHRpZiAoICFyYXdfaWQgKSByZXR1cm4gJyc7XHJcblx0XHRcdGNvbnN0IGJhc2UgPSBjb3JlLldQQkNfQkZCX1Nhbml0aXplLnRvX3Rva2VuKCByYXdfaWQgKTtcclxuXHRcdFx0aWYgKCAhYmFzZSApIHJldHVybiAnJztcclxuXHRcdFx0bGV0IHVuaXF1ZSA9IGJhc2UsIGkgPSAyO1xyXG5cdFx0XHR3aGlsZSAoIGN0eC51c2VkSWRzLmhhcyggdW5pcXVlICkgKSB1bmlxdWUgPSBgJHtiYXNlfV8ke2krK31gO1xyXG5cdFx0XHRjdHgudXNlZElkcy5hZGQoIHVuaXF1ZSApO1xyXG5cdFx0XHRyZXR1cm4gYCBpZDoke3VuaXF1ZX1gO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBwaF9hdHRyKHYpIHtcclxuXHRcdFx0aWYgKCB2ID09IG51bGwgfHwgdiA9PT0gJycgKSByZXR1cm4gJyc7XHJcblx0XHRcdHJldHVybiBgIHBsYWNlaG9sZGVyOlwiJHtjb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY2FwZV9mb3JfYXR0cl9xdW90ZWQoIHYgKX1cImA7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gdGV4dC1saWtlIHNpemUvbWF4bGVuZ3RoIHRva2VuOiBcIjQwLzI1NVwiIChvciBcIjQwL1wiIG9yIFwiLzI1NVwiKVxyXG5cdFx0c3RhdGljIHNpemVfbWF4X3Rva2VuKGYpIHtcclxuXHRcdFx0Y29uc3Qgc2l6ZSA9IHBhcnNlSW50KCBmLnNpemUsIDEwICk7XHJcblx0XHRcdGNvbnN0IG1heCAgPSBwYXJzZUludCggZi5tYXhsZW5ndGgsIDEwICk7XHJcblx0XHRcdGlmICggTnVtYmVyLmlzRmluaXRlKCBzaXplICkgJiYgTnVtYmVyLmlzRmluaXRlKCBtYXggKSApIHJldHVybiBgICR7c2l6ZX0vJHttYXh9YDtcclxuXHRcdFx0aWYgKCBOdW1iZXIuaXNGaW5pdGUoIHNpemUgKSApIHJldHVybiBgICR7c2l6ZX0vYDtcclxuXHRcdFx0aWYgKCBOdW1iZXIuaXNGaW5pdGUoIG1heCApICkgcmV0dXJuIGAgLyR7bWF4fWA7XHJcblx0XHRcdHJldHVybiAnJztcclxuXHRcdH1cclxuXHJcblx0XHQvLyB0ZXh0YXJlYSBjb2xzL3Jvd3MgdG9rZW46IFwiNjB4NFwiIChvciBcIjYweFwiIG9yIFwieDRcIilcclxuXHRcdHN0YXRpYyBjb2xzX3Jvd3NfdG9rZW4oZikge1xyXG5cdFx0XHRjb25zdCBjb2xzID0gcGFyc2VJbnQoIGYuY29scywgMTAgKTtcclxuXHRcdFx0Y29uc3Qgcm93cyA9IHBhcnNlSW50KCBmLnJvd3MsIDEwICk7XHJcblx0XHRcdGlmICggTnVtYmVyLmlzRmluaXRlKCBjb2xzICkgJiYgTnVtYmVyLmlzRmluaXRlKCByb3dzICkgKSByZXR1cm4gYCAke2NvbHN9eCR7cm93c31gO1xyXG5cdFx0XHRpZiAoIE51bWJlci5pc0Zpbml0ZSggY29scyApICkgcmV0dXJuIGAgJHtjb2xzfXhgO1xyXG5cdFx0XHRpZiAoIE51bWJlci5pc0Zpbml0ZSggcm93cyApICkgcmV0dXJuIGAgeCR7cm93c31gO1xyXG5cdFx0XHRyZXR1cm4gJyc7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIG9wdGlvbl90b2tlbnMoZmllbGQpIHtcclxuXHRcdFx0Y29uc3Qgb3B0aW9ucyA9IEFycmF5LmlzQXJyYXkoIGZpZWxkLm9wdGlvbnMgKSA/IGZpZWxkLm9wdGlvbnMgOiBbXTtcclxuXHRcdFx0aWYgKCBvcHRpb25zLmxlbmd0aCA9PT0gMCApIHJldHVybiAnJztcclxuXHRcdFx0Y29uc3QgcGFydHMgPSBvcHRpb25zLm1hcCggKG8pID0+IHtcclxuXHRcdFx0XHRjb25zdCB0aXRsZSA9IFN0cmluZyggby5sYWJlbCA/PyBvLnZhbHVlID8/ICcnICkudHJpbSgpO1xyXG5cdFx0XHRcdGNvbnN0IHZhbHVlID0gU3RyaW5nKCBvLnZhbHVlID8/IG8ubGFiZWwgPz8gJycgKS50cmltKCk7XHJcblx0XHRcdFx0cmV0dXJuIHRpdGxlICYmIHZhbHVlICYmIHRpdGxlICE9PSB2YWx1ZVxyXG5cdFx0XHRcdFx0PyBgXCIke2NvcmUuV1BCQ19CRkJfU2FuaXRpemUuZXNjYXBlX2Zvcl9zaG9ydGNvZGUoIGAke3RpdGxlfUBAJHt2YWx1ZX1gICl9XCJgXHJcblx0XHRcdFx0XHQ6IGBcIiR7Y29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5lc2NhcGVfZm9yX3Nob3J0Y29kZSggdGl0bGUgfHwgdmFsdWUgKX1cImA7XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0cmV0dXJuICcgJyArIHBhcnRzLmpvaW4oICcgJyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBkZWZhdWx0X29wdGlvbl9zdWZmaXgoZmllbGQsIHRva2Vucykge1xyXG5cdFx0XHRjb25zdCBvcHRpb25zICA9IEFycmF5LmlzQXJyYXkoIGZpZWxkLm9wdGlvbnMgKSA/IGZpZWxkLm9wdGlvbnMgOiBbXTtcclxuXHRcdFx0Y29uc3Qgc2VsZWN0ZWQgPSBvcHRpb25zLmZpbmQoIChvKSA9PiBvLnNlbGVjdGVkICk7XHJcblx0XHRcdGNvbnN0IGRlZl92YWwgPSBzZWxlY3RlZCA/IChzZWxlY3RlZC52YWx1ZSA/PyBzZWxlY3RlZC5sYWJlbCkgOiAoZmllbGQuZGVmYXVsdF92YWx1ZSA/PyBmaWVsZC5kZWZhdWx0VmFsdWUgPz8gJycpO1xyXG5cdFx0XHRpZiAoICFkZWZfdmFsICkgcmV0dXJuICcnO1xyXG5cdFx0XHRyZXR1cm4gYCBkZWZhdWx0PVwiJHtjb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY2FwZV92YWx1ZV9mb3JfYXR0ciggZGVmX3ZhbCApfVwiYDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNFTEVDVEJPWCAvIFJBRElPIC0gQnVpbGQgdGhlIGZpbmFsIHNob3J0Y29kZSBmb3IgY2hvaWNlLWJhc2VkIGZpZWxkcy5cclxuXHRcdCAqXHJcblx0XHQgKiBSZXNwb25zaWJpbGl0aWVzOlxyXG5cdFx0ICogIC0gRGVsZWdhdGVzIG9wdGlvbi9kZWZhdWx0IGVuY29kaW5nIHRvOlxyXG5cdFx0ICogICAgICAtIFdQQkNfQkZCX0V4cG9ydGVyLm9wdGlvbl90b2tlbnMoIGZpZWxkIClcclxuXHRcdCAqICAgICAgLSBXUEJDX0JGQl9FeHBvcnRlci5kZWZhdWx0X29wdGlvbl9zdWZmaXgoIGZpZWxkLCB0b2tlbnMgKVxyXG5cdFx0ICogIC0gRm9yIGByYWRpb2A6XHJcblx0XHQgKiAgICAgIC0gQUxXQVlTIGFwcGVuZHMgYSBiYXJlIGB1c2VfbGFiZWxfZWxlbWVudGAgdG9rZW4uXHJcblx0XHQgKiAgLSBGb3IgYHNlbGVjdGJveGA6XHJcblx0XHQgKiAgICAgIC0gQWRkcyBhIGJhcmUgYG11bHRpcGxlYCB0b2tlbiB3aGVuIGBmaWVsZC5tdWx0aXBsZWAgaXMgdHJ1dGh5XHJcblx0XHQgKiAgICAgICAgKHRydWUsIFwidHJ1ZVwiLCAxLCBcIjFcIiwgXCJtdWx0aXBsZVwiKSAtPiBgW3NlbGVjdGJveCBzZXJ2aWNlcyBtdWx0aXBsZSBcIjFcIiBcIjJcIl1gLlxyXG5cdFx0ICogICAgICAtIFdoZW4gc2luZ2xlLXNlbGVjdCBBTkQgdGhlcmUgaXMgbm8gYGRlZmF1bHQ9XCIuLi5cImAgYXR0cmlidXRlIEFORFxyXG5cdFx0ICogICAgICAgIGEgbm9uLWVtcHR5IGBmaWVsZC5wbGFjZWhvbGRlcmAgaXMgcHJlc2VudCwgZW5jb2RlcyB0aGUgcGxhY2Vob2xkZXJcclxuXHRcdCAqICAgICAgICBhcyB0aGUgRklSU1Qgb3B0aW9uIHdpdGggZW1wdHkgdmFsdWUgdmlhIHRoZSBgQEBgIHN5bnRheDpcclxuXHRcdCAqICAgICAgICAgICBwbGFjZWhvbGRlciBcIi0tLS0gU2VsZWN0IC0tLS1cIiAgLT4gIGBcIi0tLS0gU2VsZWN0IC0tLS1AQFwiYFxyXG5cdFx0ICogICAgICAgIGFuZCBjbGVhcnMgYW55IGRlZmF1bHQgYXR0cmlidXRlOlxyXG5cdFx0ICogICAgICAgICAgIFtzZWxlY3Rib3gqIHNlcnZpY2VzIFwiLS0tIFNlbGVjdCAtLS1AQFwiIFwiT3B0aW9uIDFcIiBcIk9wdGlvbiAyXCJdXHJcblx0XHQgKiAgICAgIC0gUmVzcGVjdHMgYGZpZWxkLnVzZV9sYWJlbF9lbGVtZW50YCAoYWRkcyBiYXJlIGB1c2VfbGFiZWxfZWxlbWVudGAgd2hlbiB0cnVlKS5cclxuXHRcdCAqICAtIEZvciBib3RoIGtpbmRzOlxyXG5cdFx0ICogICAgICAtIEhvbm9ycyBgZmllbGQubGFiZWxfZmlyc3RgIGJ5IGFwcGVuZGluZyBgbGFiZWxfZmlyc3Q6XCIxXCJgIHdoZW4gdHJ1dGh5LlxyXG5cdFx0ICogICAgICAtIEtlZXBzIHRoZSByZXF1aXJlZCBzdGFyLCBpZCBhbmQgY3NzY2xhc3MgdG9rZW5zIGluIHRoZSBjYW5vbmljYWwgb3JkZXIuXHJcblx0XHQgKlxyXG5cdFx0ICogRmluYWwgc2hvcnRjb2RlIGxheW91dCAob3JkZXIgaXMgaW1wb3J0YW50KTpcclxuXHRcdCAqICAgW2tpbmQgcmVxIG5hbWUgaWQgY2xzIHVzZV9sYWJlbF9lbGVtZW50IG11bHRpcGxlIGRlZmF1bHQgdG9rZW5zIGxhYmVsX2ZpcnN0XVxyXG5cdFx0ICpcclxuXHRcdCAqIEBqRG9jXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30ga2luZFxyXG5cdFx0ICogICBTaG9ydGNvZGUga2luZDsgdHlwaWNhbGx5IFwicmFkaW9cIiBvciBcInNlbGVjdGJveFwiLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSByZXFfbWFya1xyXG5cdFx0ICogICBSZXF1aXJlZCBtYXJrZXIgdXNlZCBieSBDb250YWN0IEZvcm0gNyBzdHlsZSBzaG9ydGNvZGVzOlxyXG5cdFx0ICogICBlaXRoZXIgXCJcIiAobm90IHJlcXVpcmVkKSBvciBcIipcIiAocmVxdWlyZWQpLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lXHJcblx0XHQgKiAgIFNhbml0aXplZCBmaWVsZCBuYW1lIGFzIGV4cG9ydGVkIGludG8gdGhlIHNob3J0Y29kZSwgZS5nLiBcInNlcnZpY2VzXCIuXHJcblx0XHQgKiAgIE11c3QgYWxyZWFkeSBiZSBjb21wdXRlZCB2aWEgV1BCQ19CRkJfRXhwb3J0ZXIuY29tcHV0ZV9uYW1lKCkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGZpZWxkXHJcblx0XHQgKiAgIE5vcm1hbGl6ZWQgZmllbGQgZGF0YSBvYmplY3QgYXMgc3RvcmVkIGluIHRoZSBCdWlsZGVyIHN0cnVjdHVyZS4gQ29tbW9uIGtleXM6XHJcblx0XHQgKiAgICAgLSB0eXBlICAgICAgICAgICB7c3RyaW5nfSAgIEZpZWxkIHR5cGUsIGUuZy4gXCJyYWRpb1wiIHwgXCJzZWxlY3RcIi5cclxuXHRcdCAqICAgICAtIG9wdGlvbnMgICAgICAgIHtBcnJheX0gICAgT3B0aW9uIG9iamVjdHM6IHsgbGFiZWwsIHZhbHVlLCBzZWxlY3RlZCB9LlxyXG5cdFx0ICogICAgIC0gcGxhY2Vob2xkZXIgICAge3N0cmluZ30gICBQbGFjZWhvbGRlciB0ZXh0IChzaW5nbGUtc2VsZWN0IG9ubHkpLlxyXG5cdFx0ICogICAgIC0gbXVsdGlwbGUgICAgICAge2Jvb2xlYW58c3RyaW5nfG51bWJlcn0gIEVuYWJsZXMgbXVsdGktc2VsZWN0IHdoZW4gdHJ1dGh5LlxyXG5cdFx0ICogICAgIC0gdXNlX2xhYmVsX2VsZW1lbnQge2Jvb2xlYW59ICBSZXF1ZXN0IGJhcmUgYHVzZV9sYWJlbF9lbGVtZW50YCB0b2tlbiAobm9uLXJhZGlvKS5cclxuXHRcdCAqICAgICAtIGxhYmVsX2ZpcnN0ICAgIHtib29sZWFufSAgSWYgdHJ1ZSwgYXBwZW5kcyBgbGFiZWxfZmlyc3Q6XCIxXCJgIHRva2VuLlxyXG5cdFx0ICogICAgIC0gZGVmYXVsdF92YWx1ZSAge3N0cmluZ30gICBPcHRpb25hbCBkZWZhdWx0IHZhbHVlICh1c2VkIGJ5IGRlZmF1bHRfb3B0aW9uX3N1ZmZpeCgpKS5cclxuXHRcdCAqICAgICAtIGh0bWxfaWQgLyBjc3NjbGFzcyAvIGNsYXNzIC8gY2xhc3NOYW1lICB7c3RyaW5nfSAgVXNlZCB1cHN0cmVhbSBpbiBpZF9vcHQvY2xzX29wdHMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGlkX29wdFxyXG5cdFx0ICogICBPcHRpb25hbCBpZCB0b2tlbiBidWlsdCBieSBXUEJDX0JGQl9FeHBvcnRlci5pZF9vcHRpb24oZmllbGQsIGN0eCksXHJcblx0XHQgKiAgIGUuZy4gXCIgaWQ6bXlfaWRcIiBvciBlbXB0eSBzdHJpbmcuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGNsc19vcHRzXHJcblx0XHQgKiAgIENsYXNzIHRva2VucyBidWlsdCBieSBXUEJDX0JGQl9FeHBvcnRlci5jbGFzc19vcHRpb25zKGZpZWxkKSxcclxuXHRcdCAqICAgZS5nLiBcIiBjbGFzczpteV9jbGFzcyBjbGFzczpvdGhlclwiLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKiAgIENvbXBsZXRlIHNob3J0Y29kZSBib2R5IGZvciB0aGUgY2hvaWNlIGZpZWxkLCBmb3IgZXhhbXBsZTpcclxuXHRcdCAqICAgICBcIltyYWRpbyogc2VydmljZXMgdXNlX2xhYmVsX2VsZW1lbnQgXFxcIkFcXFwiIFxcXCJCXFxcIl1cIlxyXG5cdFx0ICogICAgIFwiW3NlbGVjdGJveCBzZXJ2aWNlcyBtdWx0aXBsZSBcXFwiMVxcXCIgXFxcIjJcXFwiIFxcXCIzXFxcIl1cIlxyXG5cdFx0ICogICAgIFwiW3NlbGVjdGJveCogc2VydmljZXMgXFxcIi0tLSBTZWxlY3QgLS0tQEBcXFwiIFxcXCJPcHRpb24gMVxcXCIgXFxcIk9wdGlvbiAyXFxcIl1cIlxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgY2hvaWNlX3RhZyhraW5kLCByZXFfbWFyaywgbmFtZSwgZmllbGQsIGlkX29wdCwgY2xzX29wdHMpIHtcclxuXHRcdFx0Ly8gU3RhcnQgZnJvbSB0aGUgcmF3IG9wdGlvbnMvZGVmYXVsdCBhcyBiZWZvcmUuXHJcblx0XHRcdGxldCB0b2tlbnMgPSBXUEJDX0JGQl9FeHBvcnRlci5vcHRpb25fdG9rZW5zKCBmaWVsZCApO1xyXG5cdFx0XHRsZXQgZGVmICAgID0gV1BCQ19CRkJfRXhwb3J0ZXIuZGVmYXVsdF9vcHRpb25fc3VmZml4KCBmaWVsZCwgdG9rZW5zICk7XHJcblxyXG5cdFx0XHQvLyBGb3IgUkFESU8gd2UgbXVzdCBBTFdBWVMgaW5jbHVkZSBhIGJhcmUgYHVzZV9sYWJlbF9lbGVtZW50YCB0b2tlbiAobm8gdmFsdWUvcXVvdGVzKS5cclxuXHRcdFx0Ly8gRm9yIG90aGVyIGtpbmRzLCBrZWVwIGJhY2t3YXJkIGNvbXBhdGliaWxpdHk6IGluY2x1ZGUgb25seSBpZiBleHBsaWNpdGx5IHNldC5cclxuXHRcdFx0bGV0IHVsZSA9ICcnO1xyXG5cdFx0XHRpZiAoIGtpbmQgPT09ICdyYWRpbycgKSB7XHJcblx0XHRcdFx0dWxlID0gJyB1c2VfbGFiZWxfZWxlbWVudCc7XHJcblx0XHRcdH0gZWxzZSBpZiAoIGZpZWxkICYmIGZpZWxkLnVzZV9sYWJlbF9lbGVtZW50ICkge1xyXG5cdFx0XHRcdHVsZSA9ICcgdXNlX2xhYmVsX2VsZW1lbnQnO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBTRUxFQ1RCT1gtc3BlY2lmaWMgZXh0cmFzOlxyXG5cdFx0XHQvLyAgLSBcIm11bHRpcGxlXCIgZmxhZ1xyXG5cdFx0XHQvLyAgLSBwbGFjZWhvbGRlciBleHBvcnRlZCBhcyBGSVJTVCBPUFRJT04gd2hlbiBzaW5nbGUtc2VsZWN0IGFuZCBubyBkZWZhdWx0LlxyXG5cdFx0XHRsZXQgbXVsdGlwbGVfZmxhZyA9ICcnO1xyXG5cclxuXHRcdFx0aWYgKCBraW5kID09PSAnc2VsZWN0Ym94JyAmJiBmaWVsZCApIHtcclxuXHRcdFx0XHRjb25zdCBtdWx0aXBsZSA9XHJcblx0XHRcdFx0XHRmaWVsZC5tdWx0aXBsZSA9PT0gdHJ1ZSAgIHx8XHJcblx0XHRcdFx0XHRmaWVsZC5tdWx0aXBsZSA9PT0gJ3RydWUnIHx8XHJcblx0XHRcdFx0XHRmaWVsZC5tdWx0aXBsZSA9PT0gMSAgICAgIHx8XHJcblx0XHRcdFx0XHRmaWVsZC5tdWx0aXBsZSA9PT0gJzEnICAgIHx8XHJcblx0XHRcdFx0XHRmaWVsZC5tdWx0aXBsZSA9PT0gJ211bHRpcGxlJztcclxuXHJcblx0XHRcdFx0aWYgKCBtdWx0aXBsZSApIHtcclxuXHRcdFx0XHRcdC8vIEV4cG9ydCBiYXJlIFwibXVsdGlwbGVcIiB0b2tlbiBhcyBpbjogW3NlbGVjdGJveCBzZXJ2aWNlcyBtdWx0aXBsZSBcIjFcIiBcIjJcIiBcIjNcIl0uXHJcblx0XHRcdFx0XHRtdWx0aXBsZV9mbGFnID0gJyBtdWx0aXBsZSc7XHJcblx0XHRcdFx0fSBlbHNlIGlmICggIWRlZiApIHtcclxuXHRcdFx0XHRcdC8vIFNpbmdsZS1zZWxlY3QgKyBOTyBkZWZhdWx0IHNlbGVjdGVkOlxyXG5cdFx0XHRcdFx0Ly8gZXhwb3J0IHBsYWNlaG9sZGVyIGFzIHRoZSBGSVJTVCBPUFRJT04gd2l0aCBlbXB0eSB2YWx1ZTpcclxuXHRcdFx0XHRcdC8vICAgW3NlbGVjdGJveCogc2VydmljZXMgXCItLS0gU2VsZWN0IC0tLUBAXCIgXCJPcHRpb24gMVwiIFwiT3B0aW9uIDJcIl1cclxuXHRcdFx0XHRcdGNvbnN0IHJhd1BoID0gZmllbGQucGxhY2Vob2xkZXI7XHJcblx0XHRcdFx0XHRjb25zdCBwaCAgICA9ICh0eXBlb2YgcmF3UGggPT09ICdzdHJpbmcnKSA/IHJhd1BoLnRyaW0oKSA6ICcnO1xyXG5cclxuXHRcdFx0XHRcdGlmICggcGggKSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IFMgICAgICA9IGNvcmUuV1BCQ19CRkJfU2FuaXRpemU7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGVzY19zYyA9IChTICYmIFMuZXNjYXBlX2Zvcl9zaG9ydGNvZGUpID8gUy5lc2NhcGVfZm9yX3Nob3J0Y29kZSA6ICh2KSA9PiBTdHJpbmcoIHYgKTtcclxuXHJcblx0XHRcdFx0XHRcdGNvbnN0IHBoVG9rZW4gPSBgXCIke2VzY19zYyggcGggKyAnQEAnICl9XCJgO1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKCB0b2tlbnMgJiYgdG9rZW5zLmxlbmd0aCApIHtcclxuXHRcdFx0XHRcdFx0XHQvLyB0b2tlbnMgYWxyZWFkeSBzdGFydHMgd2l0aCBhIGxlYWRpbmcgc3BhY2UuXHJcblx0XHRcdFx0XHRcdFx0dG9rZW5zID0gJyAnICsgcGhUb2tlbiArIHRva2VucztcclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHR0b2tlbnMgPSAnICcgKyBwaFRva2VuO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHQvLyBFbnN1cmUgdGhlcmUgaXMgc3RpbGwgTk8gZGVmYXVsdCBhdHRyaWJ1dGUgd2hlbiB1c2luZyBwbGFjZWhvbGRlci1hcy1vcHRpb24uXHJcblx0XHRcdFx0XHRcdGRlZiA9ICcnO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gT3B0aW9uYWw6IGxhYmVsX2ZpcnN0IHN0YXlzIGFzIHF1b3RlZCBmbGFnIHdoZW4gZXhwbGljaXRseSByZXF1ZXN0ZWQuXHJcblx0XHRcdGNvbnN0IGxmID0gKGZpZWxkICYmIGZpZWxkLmxhYmVsX2ZpcnN0KSA/ICcgbGFiZWxfZmlyc3Q6XCIxXCInIDogJyc7XHJcblxyXG5cdFx0XHQvLyBJTVBPUlRBTlQgT1JERVIgKHBlciByZXF1ZXN0KTpcclxuXHRcdFx0Ly8gW2tpbmQgcmVxIG5hbWUgaWQgY2xzIHVzZV9sYWJlbF9lbGVtZW50IG11bHRpcGxlIGRlZmF1bHQgdG9rZW5zIGxhYmVsX2ZpcnN0XVxyXG5cdFx0XHQvLyBpLmUuIGB1c2VfbGFiZWxfZWxlbWVudGAgKGFuZCBzZWxlY3QgZXh0cmFzKSBjb21lIEJFRk9SRSBkZWZhdWx0L3Rva2Vucy5cclxuXHRcdFx0cmV0dXJuIGBbJHtraW5kfSR7cmVxX21hcmt9ICR7bmFtZX0ke2lkX29wdH0ke2Nsc19vcHRzfSR7dWxlfSR7bXVsdGlwbGVfZmxhZ30ke2RlZn0ke3Rva2Vuc30ke2xmfV1gO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBjb21wdXRlX25hbWUodHlwZSwgZmllbGQpIHtcclxuXHRcdFx0Ly8gTmFtZXMgYXJlIGZ1bGx5IHZhbGlkYXRlZCB3aGVuIHRoZSBmaWVsZCBpcyBhZGRlZCB0byB0aGUgY2FudmFzLlxyXG5cdFx0XHQvLyBUaGUgZXhwb3J0ZXIgbXVzdCB0aGVyZWZvcmUgcHJlc2VydmUgdGhlbSAoYXBhcnQgZnJvbSBpZGVtcG90ZW50IHNhbml0aXphdGlvbiksIG90aGVyd2lzZSBleGlzdGluZyBmb3JtcyBjYW4gYnJlYWsuXHJcblx0XHRcdGNvbnN0IFNhbml0ID0gY29yZS5XUEJDX0JGQl9TYW5pdGl6ZTtcclxuXHJcblx0XHRcdGNvbnN0IHJhdyA9IChmaWVsZCAmJiAoZmllbGQubmFtZSB8fCBmaWVsZC5pZCkpID8gU3RyaW5nKGZpZWxkLm5hbWUgfHwgZmllbGQuaWQpIDogU3RyaW5nKHR5cGUgfHwgJ2ZpZWxkJyk7XHJcblxyXG5cdFx0XHQvLyBJZGVtcG90ZW50IHNhbml0aXphdGlvbiBvbmx5IOKAkyBubyBhdXRvLXByZWZpeGluZyBvciByZW5hbWluZy5cclxuXHRcdFx0Y29uc3QgbmFtZSA9IFNhbml0LnNhbml0aXplX2h0bWxfbmFtZSggcmF3ICk7XHJcblxyXG5cdFx0XHQvLyBJbiB0aGUgdW5saWtlbHkgY2FzZSBzYW5pdGl6YXRpb24gcmV0dXJucyBhbiBlbXB0eSBzdHJpbmcsIGZhbGwgYmFjayB0byBhIHNhbml0aXplZCB0eXBlLWJhc2VkIHRva2VuLlxyXG5cdFx0XHRyZXR1cm4gbmFtZSB8fCBTYW5pdC5zYW5pdGl6ZV9odG1sX25hbWUoIFN0cmluZyh0eXBlIHx8ICdmaWVsZCcpICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZWdpc3RlciBhIHBlci1maWVsZCBleHBvcnRlci5cclxuXHRcdCAqXHJcblx0XHQgKiBUaGlzIGlzIHRoZSBPTkxZIHBsYWNlIHdoZXJlIGZpZWxkLXNwZWNpZmljIHNob3J0Y29kZSBtYXJrdXAgc2hvdWxkIGxpdmUuXHJcblx0XHQgKiBDb3JlIHN0YXlzIGdlbmVyaWM7IHBhY2tzIHByb3ZpZGUgdGlueSBwbHVnaW5zLCBmb3IgZXhhbXBsZTpcclxuXHRcdCAqXHJcblx0XHQgKiAgIFdQQkNfQkZCX0V4cG9ydGVyLnJlZ2lzdGVyKCAndGV4dCcsIChmaWVsZCwgZW1pdCwgZXh0cmFzKSA9PiB7IC4uLiB9ICk7XHJcblx0XHQgKlxyXG5cdFx0ICogQGpEb2NcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlICBGaWVsZCB0eXBlIGtleSwgZS5nLiAnc3RlcHNfdGltZWxpbmUnXHJcblx0XHQgKiBAcGFyYW0geyhmaWVsZDphbnksIGVtaXQ6KGNvZGU6c3RyaW5nKT0+dm9pZCwgZXh0cmFzPzp7aW8/OmFueSxjZmc/OmFueSxvbmNlPzphbnksY3R4PzphbnksY29yZT86YW55fSk9PnZvaWR9XHJcblx0XHQgKiAgICAgZm5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgcmVnaXN0ZXIodHlwZSwgZm4pIHtcclxuXHRcdFx0aWYgKCAhIHR5cGUgfHwgdHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nICkgeyByZXR1cm47IH1cclxuXHRcdFx0aWYgKCAhIHRoaXMuX19yZWdpc3RyeSApIHsgdGhpcy5fX3JlZ2lzdHJ5ID0gbmV3IE1hcCgpOyB9XHJcblx0XHRcdHRoaXMuX19yZWdpc3RyeS5zZXQoIFN0cmluZyggdHlwZSApLnRvTG93ZXJDYXNlKCksIGZuICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBVbnJlZ2lzdGVyIGEgcHJldmlvdXNseSByZWdpc3RlcmVkIGV4cG9ydGVyLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBqRG9jXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdHlwZVxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyB1bnJlZ2lzdGVyKHR5cGUpIHtcclxuXHRcdFx0aWYgKCAhIHRoaXMuX19yZWdpc3RyeSB8fCAhIHR5cGUgKSB7IHJldHVybjsgfVxyXG5cdFx0XHR0aGlzLl9fcmVnaXN0cnkuZGVsZXRlKCBTdHJpbmcoIHR5cGUgKS50b0xvd2VyQ2FzZSgpICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDaGVjayBpZiBhbiBleHBvcnRlciBleGlzdHMgZm9yIGEgZ2l2ZW4gZmllbGQgdHlwZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAakRvY1xyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHR5cGVcclxuXHRcdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgaGFzX2V4cG9ydGVyKHR5cGUpIHtcclxuXHRcdFx0cmV0dXJuICEhKCB0aGlzLl9fcmVnaXN0cnkgJiYgdGhpcy5fX3JlZ2lzdHJ5LmhhcyggU3RyaW5nKCB0eXBlICkudG9Mb3dlckNhc2UoKSApICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSdW4gYSByZWdpc3RlcmVkIGV4cG9ydGVyIGZvciBhIGZpZWxkLCBpZiBwcmVzZW50LlxyXG5cdFx0ICogUmV0dXJucyB0cnVlIGlmIGEgcmVnaXN0ZXJlZCBleHBvcnRlciBoYW5kbGVkIGl0LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBqRG9jXHJcblx0XHQgKiBAcGFyYW0ge2FueX0gZmllbGRcclxuXHRcdCAqIEBwYXJhbSB7e29wZW46RnVuY3Rpb24sY2xvc2U6RnVuY3Rpb24scHVzaDpGdW5jdGlvbixibGFuazpGdW5jdGlvbn19IGlvXHJcblx0XHQgKiBAcGFyYW0ge2FueX0gY2ZnXHJcblx0XHQgKiBAcGFyYW0ge2FueX0gb25jZVxyXG5cdFx0ICogQHBhcmFtIHthbnl9IGN0eFxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBydW5fcmVnaXN0ZXJlZF9leHBvcnRlcihmaWVsZCwgaW8sIGNmZywgb25jZSwgY3R4KSB7XHJcblx0XHRcdGlmICggISBmaWVsZCB8fCAhIGZpZWxkLnR5cGUgfHwgISB0aGlzLl9fcmVnaXN0cnkgKSB7IHJldHVybiBmYWxzZTsgfVxyXG5cdFx0XHRjb25zdCBrZXkgPSBTdHJpbmcoIGZpZWxkLnR5cGUgKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0XHRjb25zdCBmbiAgPSB0aGlzLl9fcmVnaXN0cnkuZ2V0KCBrZXkgKTtcclxuXHRcdFx0aWYgKCB0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicgKSB7IHJldHVybiBmYWxzZTsgfVxyXG5cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHQvLyBNaW5pbWFsLCBjb25zaXN0ZW50IGVtaXQoKSBicmlkZ2UgaW50byBvdXIgbGluZSBidWZmZXI6XHJcblx0XHRcdFx0Y29uc3QgZW1pdCA9IChjb2RlKSA9PiB7IGlmICggdHlwZW9mIGNvZGUgPT09ICdzdHJpbmcnICkgeyBpby5wdXNoKCBjb2RlICk7IH0gfTtcclxuXHRcdFx0XHRmbiggZmllbGQsIGVtaXQsIHsgaW8sIGNmZywgb25jZSwgY3R4LCBjb3JlIH0gKTtcclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fSBjYXRjaCAoZSkge1xyXG5cdFx0XHRcdF93cGJjPy5kZXY/LmVycm9yPy4oICdXUEJDX0JGQl9FeHBvcnRlci5ydW5fcmVnaXN0ZXJlZF9leHBvcnRlcicsIGUgKTtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0fVxyXG5cclxuXHQvLyBleHBvc2UgZ2xvYmFsbHkgZm9yIHBhY2tzIChpZiBub3QgYWxyZWFkeSkuXHJcblx0d2luZG93LldQQkNfQkZCX0V4cG9ydGVyID0gd2luZG93LldQQkNfQkZCX0V4cG9ydGVyIHx8IFdQQkNfQkZCX0V4cG9ydGVyO1xyXG5cdHdwYmNfYmZiX19kaXNwYXRjaF9ldmVudF9zYWZlKCAnd3BiYzpiZmI6ZXhwb3J0ZXItcmVhZHknLCB7fSApO1xyXG5cclxuXHQvLyBJbml0aWFsaXplIGRlZmF1bHQgc2tpcCBsaXN0OyBhbGxvdyBhIGdsb2JhbCBvdmVycmlkZSBhcnJheSBiZWZvcmUgZXhwb3J0IHJ1bnMuXHJcblx0V1BCQ19CRkJfRXhwb3J0ZXIuc2V0X3NraXBfYXR0cnMoIHdpbmRvdy5XUEJDX0JGQl9FWFBPUlRfU0tJUF9BVFRSUyB8fCB3cGJjX2V4cG9ydF9za2lwX2F0dHJzX2RlZmF1bHQgKTtcclxuXHJcblx0Ly8gPT0gXCJDb250ZW50IG9mIGJvb2tpbmcgZmllbGRzIGRhdGFcIiBFeHBvcnRlciA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuXHQvLyDigJMgcGFjay1leHRlbnNpYmxlIGdlbmVyYXRvciBmb3IgXCJDb250ZW50IG9mIGJvb2tpbmcgZmllbGRzIGRhdGFcIiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cdC8vID09IFByb2R1Y2VzIG1hcmt1cCBsaWtlOiAgXCI8ZGl2IGNsYXNzPVxcXCJzdGFuZGFyZC1jb250ZW50LWZvcm1cXFwiPjxiPlRpdGxlPC9iPjogPGY+W3Nob3J0Y29kZV08L2Y+PGJyPiAuLi4gPC9kaXY+XCJcclxuXHQvLyA9PSBQYWNrcyBjYW4gb3ZlcnJpZGUgcGVyIHR5cGUgdmlhOiBXUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIucmVnaXN0ZXIoJ2NhbGVuZGFyJywgKGZpZWxkLCBlbWl0LCBjdHgpPT57Li4ufSlcclxuXHQvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0Y2xhc3MgV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyIHtcclxuXHJcblx0XHRzdGF0aWMgcmVnaXN0ZXIodHlwZSwgZm4pIHtcclxuXHRcdFx0aWYgKCAhdHlwZSB8fCB0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicgKSByZXR1cm47XHJcblx0XHRcdGlmICggIXRoaXMuX19yZWdpc3RyeSApIHRoaXMuX19yZWdpc3RyeSA9IG5ldyBNYXAoKTtcclxuXHRcdFx0dGhpcy5fX3JlZ2lzdHJ5LnNldCggU3RyaW5nKCB0eXBlICkudG9Mb3dlckNhc2UoKSwgZm4gKTtcclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgdW5yZWdpc3Rlcih0eXBlKSB7XHJcblx0XHRcdGlmICggIXRoaXMuX19yZWdpc3RyeSB8fCAhdHlwZSApIHJldHVybjtcclxuXHRcdFx0dGhpcy5fX3JlZ2lzdHJ5LmRlbGV0ZSggU3RyaW5nKCB0eXBlICkudG9Mb3dlckNhc2UoKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBoYXNfZXhwb3J0ZXIodHlwZSkge1xyXG5cdFx0XHRyZXR1cm4gISEodGhpcy5fX3JlZ2lzdHJ5ICYmIHRoaXMuX19yZWdpc3RyeS5oYXMoIFN0cmluZyggdHlwZSApLnRvTG93ZXJDYXNlKCkgKSk7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIHJ1bl9yZWdpc3RlcmVkX2V4cG9ydGVyKGZpZWxkLCBlbWl0LCBjdHgpIHtcclxuXHRcdFx0aWYgKCAhZmllbGQgfHwgIWZpZWxkLnR5cGUgfHwgIXRoaXMuX19yZWdpc3RyeSApIHJldHVybiBmYWxzZTtcclxuXHRcdFx0Y29uc3Qga2V5ID0gU3RyaW5nKCBmaWVsZC50eXBlICkudG9Mb3dlckNhc2UoKTtcclxuXHRcdFx0Y29uc3QgZm4gID0gdGhpcy5fX3JlZ2lzdHJ5LmdldCgga2V5ICk7XHJcblx0XHRcdGlmICggdHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nICkgcmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGZuKCBmaWVsZCwgZW1pdCwgY3R4IHx8IHt9ICk7XHJcblx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdF93cGJjPy5kZXY/LmVycm9yPy4oICdXUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIucnVuX3JlZ2lzdGVyZWRfZXhwb3J0ZXInLCBlICk7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gPT09IE5FVzogc2hhcmVkIGxpbmUgZm9ybWF0dGVyIGZvciBcIkNvbnRlbnQgb2YgYm9va2luZyBmaWVsZHMgZGF0YVwiID09PVxyXG5cdFx0c3RhdGljIGVtaXRfbGluZV9ib2xkX2ZpZWxkKGVtaXQsIGxhYmVsLCB0b2tlbiwgY2ZnKSB7XHJcblx0XHRcdGNvbnN0IFMgICAgICAgICA9IGNvcmUuV1BCQ19CRkJfU2FuaXRpemU7XHJcblx0XHRcdGNvbnN0IHNlcCAgICAgICA9IChjZmcgJiYgdHlwZW9mIGNmZy5zZXAgPT09ICdzdHJpbmcnKSA/IGNmZy5zZXAgOiAnOiAnO1xyXG5cdFx0XHRjb25zdCBhZGRMYWJlbHMgPSAoY2ZnICYmICdhZGRMYWJlbHMnIGluIGNmZykgPyAhIWNmZy5hZGRMYWJlbHMgOiB0cnVlO1xyXG5cclxuXHRcdFx0Y29uc3QgdGl0bGUgPSAoYWRkTGFiZWxzICYmIGxhYmVsKSA/IGA8Yj4ke1MuZXNjYXBlX2h0bWwobGFiZWwpfTwvYj4ke3NlcH1gIDogJyc7XHJcblxyXG5cdFx0XHRlbWl0KGAke3RpdGxlfTxmPlske3Rva2VufV08L2Y+PGJyPmApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRXhwb3J0IGFkYXB0ZWQgc3RydWN0dXJlIHRvIOKAnGNvbnRlbnQgb2YgYm9va2luZyBmaWVsZHMgZGF0YeKAnS5cclxuXHRcdCAqIEBwYXJhbSB7e3BhZ2VzOkFycmF5fX0gYWRhcHRlZCAgcmVzdWx0IG9mIGFkYXB0X2J1aWxkZXJfc3RydWN0dXJlX3RvX2V4cG9ydGVyKClcclxuXHRcdCAqIEBwYXJhbSB7e25ld2xpbmU/OnN0cmluZywgYWRkTGFiZWxzPzpib29sZWFuLCBzZXA/OnN0cmluZ319IG9wdGlvbnNcclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBleHBvcnRfY29udGVudChhZGFwdGVkLCBvcHRpb25zID0ge30pIHtcclxuXHJcblx0XHRcdGNvbnN0IGNmZyAgID0geyBuZXdsaW5lOiAnXFxuJywgYWRkTGFiZWxzOiB0cnVlLCBzZXA6ICc6ICcsIGluZGVudDogJ1xcdCcsIC4uLm9wdGlvbnMgfTtcclxuXHRcdFx0Y29uc3QgSU5EICAgPSAodHlwZW9mIGNmZy5pbmRlbnQgPT09ICdzdHJpbmcnKSA/IGNmZy5pbmRlbnQgOiAnXFx0JztcclxuXHRcdFx0bGV0IGRlcHRoICAgPSAwO1xyXG5cdFx0XHRjb25zdCBsaW5lcyA9IFtdO1xyXG5cclxuXHRcdFx0Y29uc3QgcHVzaCAgPSAocyA9ICcnKSA9PiBsaW5lcy5wdXNoKCBJTkQucmVwZWF0KCBkZXB0aCApICsgU3RyaW5nKCBzICkgKTtcclxuXHRcdFx0Y29uc3Qgb3BlbiAgPSAocyA9ICcnKSA9PiB7IHB1c2goIHMgKTsgZGVwdGgrKzsgfTtcclxuXHRcdFx0Y29uc3QgY2xvc2UgPSAocyA9ICcnKSA9PiB7IGRlcHRoID0gTWF0aC5tYXgoIDAsIGRlcHRoIC0gMSApOyBwdXNoKCBzICk7IH07XHJcblxyXG5cdFx0XHRjb25zdCBlbWl0ID0gKHMpID0+IHtcclxuXHRcdFx0XHRpZiAoIHR5cGVvZiBzICE9PSAnc3RyaW5nJyApIHsgcmV0dXJuOyB9XHJcblx0XHRcdFx0U3RyaW5nKCBzICkuc3BsaXQoIC9cXHI/XFxuLyApLmZvckVhY2goIChsaW5lKSA9PiBwdXNoKCBsaW5lICkgKTtcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdGlmICggIWFkYXB0ZWQgfHwgIUFycmF5LmlzQXJyYXkoIGFkYXB0ZWQucGFnZXMgKSApIHJldHVybiAnJztcclxuXHJcblx0XHRcdGNvbnN0IHNraXBUeXBlcyA9IG5ldyBTZXQoIFsgJ2NhcHRjaGEnLCAnc3VibWl0JywgJ2RpdmlkZXInLCAnd2l6YXJkX25hdicsICdjb3N0X2NvcnJlY3Rpb25zJyBdICk7XHJcblxyXG5cdFx0XHRjb25zdCBmYWxsYmFja0xpbmUgPSAoZmllbGQpID0+IHtcclxuXHRcdFx0XHRjb25zdCB0eXBlICA9IFN0cmluZyggZmllbGQudHlwZSB8fCAnJyApLnRvTG93ZXJDYXNlKCk7XHJcblx0XHRcdFx0Y29uc3QgbmFtZSAgPSBXUEJDX0JGQl9FeHBvcnRlci5jb21wdXRlX25hbWUoIHR5cGUsIGZpZWxkICk7XHJcblx0XHRcdFx0Y29uc3QgbGFiZWwgPSAodHlwZW9mIGZpZWxkLmxhYmVsID09PSAnc3RyaW5nJyAmJiBmaWVsZC5sYWJlbC50cmltKCkpID8gZmllbGQubGFiZWwudHJpbSgpIDogbmFtZTtcclxuXHRcdFx0XHRpZiAoICFuYW1lICkgcmV0dXJuO1xyXG5cdFx0XHRcdFdQQkNfQkZCX0NvbnRlbnRFeHBvcnRlci5lbWl0X2xpbmVfYm9sZF9maWVsZCggZW1pdCwgbGFiZWwsIG5hbWUsIGNmZyApO1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0Ly8gUGVyLXR5cGUgc2Vuc2libGUgZGVmYXVsdHMgKGNhbiBiZSBvdmVycmlkZGVuIGJ5IHBhY2tzIHZpYSByZWdpc3RlcigpKVxyXG5cdFx0XHRjb25zdCBkZWZhdWx0Q29udGVudEZvciA9IChmaWVsZCkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IHR5cGUgPSBTdHJpbmcoIGZpZWxkLnR5cGUgfHwgJycgKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0XHRcdGlmICggc2tpcFR5cGVzLmhhcyggdHlwZSApICkgcmV0dXJuO1xyXG5cdFx0XHRcdC8vIFNwZWNpYWwgY2FzZXMgb3V0IG9mIHRoZSBib3g6XHJcblx0XHRcdFx0aWYgKCB0eXBlID09PSAnY2FsZW5kYXInICkge1xyXG5cdFx0XHRcdFx0Y29uc3QgbGFiZWwgPSAodHlwZW9mIGZpZWxkLmxhYmVsID09PSAnc3RyaW5nJyAmJiBmaWVsZC5sYWJlbC50cmltKCkpID8gZmllbGQubGFiZWwudHJpbSgpIDogJ0RhdGVzJztcclxuXHRcdFx0XHRcdFdQQkNfQkZCX0NvbnRlbnRFeHBvcnRlci5lbWl0X2xpbmVfYm9sZF9maWVsZCggZW1pdCwgbGFiZWwsICdkYXRlcycsIGNmZyApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHQvLyB0aW1lLWxpa2UgcmVzZXJ2ZWQgbmFtZXMgLT4ga2VlcCBwbGFjZWhvbGRlciB0b2tlbiBlcXVhbCB0byBuYW1lXHJcblx0XHRcdFx0Y29uc3QgcmVzZXJ2ZWQgPSBTdHJpbmcoIGZpZWxkLm5hbWUgfHwgZmllbGQuaWQgfHwgJycgKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0XHRcdGlmICggWyAncmFuZ2V0aW1lJywgJ3N0YXJ0dGltZScsICdlbmR0aW1lJywgJ2R1cmF0aW9udGltZScgXS5pbmNsdWRlcyggcmVzZXJ2ZWQgKSApIHtcclxuXHRcdFx0XHRcdGNvbnN0IGxhYmVsID0gKHR5cGVvZiBmaWVsZC5sYWJlbCA9PT0gJ3N0cmluZycgJiYgZmllbGQubGFiZWwudHJpbSgpKSA/IGZpZWxkLmxhYmVsLnRyaW0oKSA6IHJlc2VydmVkO1xyXG5cdFx0XHRcdFx0Ly8gS2VlcCB5b3VyIHNwZWNpYWwgdG9rZW4gZm9yIGR1cmF0aW9uIHRpbWUgaW4gY29udGVudDogW2R1cmF0aW9udGltZV92YWxdXHJcblx0XHRcdFx0XHRjb25zdCB0b2tlbiA9IChyZXNlcnZlZCA9PT0gJ2R1cmF0aW9udGltZScpID8gJ2R1cmF0aW9udGltZV92YWwnIDogcmVzZXJ2ZWQ7XHJcblx0XHRcdFx0XHRXUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIuZW1pdF9saW5lX2JvbGRfZmllbGQoIGVtaXQsIGxhYmVsLCB0b2tlbiwgY2ZnICk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdC8vIEZhbGxiYWNrICh0ZXh0L2VtYWlsL3RlbC9udW1iZXIvdGV4dGFyZWEvc2VsZWN0L2NoZWNrYm94L3JhZGlvIGV0Yy4pXHJcblx0XHRcdFx0ZmFsbGJhY2tMaW5lKCBmaWVsZCApO1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0Ly8gV2FsayBwYWdlcy9zZWN0aW9ucy9jb2x1bW5zL2ZpZWxkcyAoc2FtZSBvcmRlciBhcyBmb3JtKVxyXG5cdFx0XHRjb25zdCB3YWxrU2VjdGlvbiAgPSAoc2VjKSA9PiB7XHJcblx0XHRcdFx0KHNlYy5jb2x1bW5zIHx8IFtdKS5mb3JFYWNoKCAoY29sKSA9PiB7XHJcblx0XHRcdFx0XHQoY29sLmZpZWxkcyB8fCBbXSkuZm9yRWFjaCggKGYpID0+IHByb2Nlc3NGaWVsZCggZiApICk7XHJcblx0XHRcdFx0XHQoY29sLnNlY3Rpb25zIHx8IFtdKS5mb3JFYWNoKCAocykgPT4gd2Fsa1NlY3Rpb24oIHMgKSApO1xyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fTtcclxuXHRcdFx0Y29uc3QgcHJvY2Vzc0l0ZW0gID0gKGl0ZW0pID0+IHtcclxuXHRcdFx0XHRpZiAoICFpdGVtICkgcmV0dXJuO1xyXG5cdFx0XHRcdGlmICggaXRlbS5raW5kID09PSAnZmllbGQnICkgcHJvY2Vzc0ZpZWxkKCBpdGVtLmRhdGEgKTtcclxuXHRcdFx0XHRpZiAoIGl0ZW0ua2luZCA9PT0gJ3NlY3Rpb24nICkgd2Fsa1NlY3Rpb24oIGl0ZW0uZGF0YSApO1xyXG5cdFx0XHR9O1xyXG5cdFx0XHRjb25zdCBwcm9jZXNzRmllbGQgPSAoZmllbGQpID0+IHtcclxuXHRcdFx0XHRpZiAoICFmaWVsZCApIHJldHVybjtcclxuXHRcdFx0XHQvLyBhbGxvdyBwYWNrcyB0byBvdmVycmlkZTpcclxuXHRcdFx0XHRpZiAoIFdQQkNfQkZCX0NvbnRlbnRFeHBvcnRlci5ydW5fcmVnaXN0ZXJlZF9leHBvcnRlciggZmllbGQsIGVtaXQsIHsgY2ZnLCBjb3JlIH0gKSApIHJldHVybjtcclxuXHRcdFx0XHRkZWZhdWx0Q29udGVudEZvciggZmllbGQgKTtcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdC8vIFdyYXBwZXIgZmlyc3QgLT4gaW5uZXIgbGluZXMgd2lsbCBiZSBUQUItaW5kZW50ZWRcclxuXHRcdFx0b3BlbiggYDxkaXYgY2xhc3M9XCJzdGFuZGFyZC1jb250ZW50LWZvcm1cIj5gICk7XHJcblx0XHRcdGFkYXB0ZWQucGFnZXMuZm9yRWFjaCggKHBhZ2UpID0+IChwYWdlLml0ZW1zIHx8IFtdKS5mb3JFYWNoKCBwcm9jZXNzSXRlbSApICk7XHJcblx0XHRcdGNsb3NlKCBgPC9kaXY+YCApO1xyXG5cclxuXHRcdFx0cmV0dXJuIGxpbmVzLmpvaW4oIGNmZy5uZXdsaW5lICk7XHJcblx0XHR9XHJcblxyXG5cdH1cclxuXHJcblx0Ly8gZXhwb3NlICsgcmVhZHkgZXZlbnQgZm9yIHBhY2tzIHRvIHJlZ2lzdGVyIHRoZWlyIGNvbnRlbnQgZXhwb3J0ZXJzLlxyXG5cdHdpbmRvdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIgPSB3aW5kb3cuV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyIHx8IFdQQkNfQkZCX0NvbnRlbnRFeHBvcnRlcjtcclxuXHR3cGJjX2JmYl9fZGlzcGF0Y2hfZXZlbnRfc2FmZSggJ3dwYmM6YmZiOmNvbnRlbnQtZXhwb3J0ZXItcmVhZHknLCB7fSApO1xyXG59KSgpO1xyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0EsQ0FBQyxZQUFZO0VBQ1osWUFBWTs7RUFFWixNQUFNQSxJQUFJLEdBQUdDLE1BQU0sQ0FBQ0MsYUFBYSxJQUFJLENBQUMsQ0FBQzs7RUFFdkM7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0VBQ0MsTUFBTUMsOEJBQThCLEdBQUcsQ0FBRSx1QkFBdUIsQ0FBRTs7RUFFbEU7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLDRCQUE0QkEsQ0FBQ0MsSUFBSSxFQUFFQyxlQUFlLEVBQUU7SUFDNUQsSUFBSSxDQUFDRCxJQUFJLElBQUksQ0FBQ0MsZUFBZSxFQUFFQyxNQUFNLEVBQUUsT0FBT0YsSUFBSTtJQUNsRCxJQUFJRyxH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
