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

  // Known keys we treat as real per-column style overrides.
  function has_non_default_col_styles(obj) {
    if (!obj || typeof obj !== 'object') {
      return false;
    }
    var keys = ['dir', 'wrap', 'jc', 'ai', 'gap', 'aself', 'ac'];
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
      ac: '--wpbc-bfb-col-ac',
      aself: '--wpbc-bfb-col-aself'
    };
    var parts = [];
    for (var k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      var v = obj[k];
      if (v == null || v === '') continue;
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
      open(`<r${row_attr_active}>`);
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
     * Build attribute string for the <item> wrapper.
     * Currently only used for CAPTCHA: pushes css classes and html_id to the wrapper.
     * Also ensures uniqueness of the html_id across the export (uses ctx.usedIds).
     *
     * @param {Object} field
     * @param {{usedIds:Set<string>}} ctx
     * @returns {string} e.g. ' class="x y" id="myId"'
     */
    static item_wrapper_attrs(field, ctx) {
      if (!field) {
        return '';
      }
      const esc_html = core.WPBC_BFB_Sanitize.escape_html;
      const cls_sanit = core.WPBC_BFB_Sanitize.sanitize_css_classlist;
      const sid = core.WPBC_BFB_Sanitize.sanitize_html_id;
      let out = '';
      const cls_raw = String(field.cssclass_extra || field.cssclass || field.class || '');
      const cls = cls_sanit(cls_raw);
      let html_id = field.html_id ? sid(String(field.html_id)) : '';
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9leHBvcnQvYnVpbGRlci1leHBvcnRlci5qcyIsIm5hbWVzIjpbImNvcmUiLCJ3aW5kb3ciLCJXUEJDX0JGQl9Db3JlIiwid3BiY19leHBvcnRfc2tpcF9hdHRyc19kZWZhdWx0Iiwic3RyaXBfYXR0cmlidXRlc19mcm9tX21hcmt1cCIsImh0bWwiLCJhdHRyc19sb3dlcmNhc2UiLCJsZW5ndGgiLCJvdXQiLCJTdHJpbmciLCJyYXdOYW1lIiwibmFtZSIsInRvTG93ZXJDYXNlIiwidHJpbSIsImVzYyIsInJlcGxhY2UiLCJyZSIsIlJlZ0V4cCIsImhhc19ub25fZGVmYXVsdF9jb2xfc3R5bGVzIiwib2JqIiwia2V5cyIsImkiLCJrIiwicGFyc2VfY29sX3N0eWxlc19qc29uIiwicmF3IiwiQXJyYXkiLCJpc0FycmF5IiwiZmlsdGVyIiwieCIsImFyciIsIkpTT04iLCJwYXJzZSIsIl9lIiwiYnVpbGRfY29sX2Nzc192YXJzIiwibWFwIiwiZGlyIiwid3JhcCIsImpjIiwiYWkiLCJnYXAiLCJhYyIsImFzZWxmIiwicGFydHMiLCJPYmplY3QiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJ2IiwidmFyX25hbWUiLCJwdXNoIiwiam9pbiIsInJlc29sdmVfZmxleF9iYXNpc19wZXJjZW50Iiwid2lkdGhfdG9rZW4iLCJmYWxsYmFja19wZXJjZW50IiwicyIsImVuZHNXaXRoIiwicCIsInBhcnNlRmxvYXQiLCJpc0Zpbml0ZSIsImNvbXB1dGVfZWZmZWN0aXZlX2Jhc2VzIiwiY29sdW1ucyIsImdhcF9wZXJjZW50IiwibiIsImNvbCIsInciLCJ3aWR0aCIsIk5hTiIsIk51bWJlciIsInN1bV9yYXciLCJyZWR1Y2UiLCJhIiwiYiIsImdwIiwidG90YWxfZ2FwcyIsIk1hdGgiLCJtYXgiLCJhdmFpbGFibGUiLCJzY2FsZV9yYXRpbyIsImFkYXB0X2J1aWxkZXJfc3RydWN0dXJlX3RvX2V4cG9ydGVyIiwic3RydWN0dXJlIiwicGFnZXMiLCJpdGVtcyIsIm5vcm1hbGl6ZV9vcHRpb25zIiwib3B0cyIsIm8iLCJsYWJlbCIsInZhbHVlIiwic2VsZWN0ZWQiLCJ3YWxrX3NlY3Rpb24iLCJzZWMiLCJzZWN0aW9uX2NvbF9zdHlsZXMiLCJjb2xfc3R5bGVzIiwiaWQiLCJjb2xfaW5kZXgiLCJmaWVsZHMiLCJmIiwidHlwZSIsImRhdGEiLCJzZWN0aW9ucyIsIml0Iiwib3B0aW9ucyIsInN0eWxlIiwicGFnZSIsImNvbnRlbnQiLCJmb3JFYWNoIiwiaXRlbSIsImtpbmQiLCJXUEJDX0JGQl9FeHBvcnRlciIsInNraXBfYXR0cnMiLCJTZXQiLCJzZXRfc2tpcF9hdHRycyIsIkJvb2xlYW4iLCJhZGRfc2tpcF9hdHRycyIsIm5hbWVzIiwiYWRkIiwicmVtb3ZlX3NraXBfYXR0ciIsImRlbGV0ZSIsInNhbml0aXplX2V4cG9ydCIsImZyb20iLCJleHBvcnRfZm9ybSIsImFkYXB0ZWQiLCJjZmciLCJuZXdsaW5lIiwiYWRkTGFiZWxzIiwiZ2FwUGVyY2VudCIsImluZGVudCIsIklORCIsImRlcHRoIiwibGluZXMiLCJyZXBlYXQiLCJvcGVuIiwiY2xvc2UiLCJibGFuayIsImN0eCIsInVzZWRJZHMiLCJvbmNlIiwiY2FwdGNoYSIsImNvdW50cnkiLCJjb3Vwb24iLCJjb3N0X2NvcnJlY3Rpb25zIiwic3VibWl0IiwicGFnZV9pbmRleCIsImlzX2ZpcnN0Iiwic3RlcF9udW0iLCJoaWRkZW5fY2xhc3MiLCJoaWRkZW5fc3R5bGUiLCJyZW5kZXJfc2VjdGlvbiIsInJlbmRlcl9maWVsZF9ub2RlIiwiZXhwb3J0X2FsbCIsImFkdmFuY2VkX2Zvcm0iLCJmaWVsZHNfZGF0YSIsIldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciIsImV4cG9ydF9jb250ZW50Iiwic2VwIiwic2VjdGlvbiIsImlvIiwiY29scyIsInJvd19pc19hY3RpdmUiLCJzb21lIiwicm93X2F0dHJfYWN0aXZlIiwiYmFzZXMiLCJlc2NfYXR0ciIsIldQQkNfQkZCX1Nhbml0aXplIiwiZXNjYXBlX2h0bWwiLCJpZHgiLCJlZmZfYmFzaXMiLCJzdHlsZV9wYXJ0cyIsInRvU3RyaW5nIiwiY3NzX3ZhcnNfc3RyIiwic3R5bGVfYXR0ciIsImNvbF9pc19hY3RpdmUiLCJjb2xfYXR0cl9hY3RpdmUiLCJub2RlIiwibmVzdGVkIiwiaXRlbV93cmFwcGVyX2F0dHJzIiwiZmllbGQiLCJlc2NfaHRtbCIsImNsc19zYW5pdCIsInNhbml0aXplX2Nzc19jbGFzc2xpc3QiLCJzaWQiLCJzYW5pdGl6ZV9odG1sX2lkIiwiY2xzX3JhdyIsImNzc2NsYXNzX2V4dHJhIiwiY3NzY2xhc3MiLCJjbGFzcyIsImNscyIsImh0bWxfaWQiLCJ1bmlxdWUiLCJoYXMiLCJpdGVtX2F0dHJzIiwiaGFuZGxlZCIsImhhc19leHBvcnRlciIsInJ1bl9yZWdpc3RlcmVkX2V4cG9ydGVyIiwiY29tcHV0ZV9uYW1lIiwiaGVscCIsImlzX3JlcXVpcmVkIiwicmVxdWlyZWQiLCJlbWl0X2xhYmVsX3RoZW4iLCJlbWl0IiwiYm9keSIsImlzX3JlcSIsInJlcV9tYXJrIiwiaXNfdGltZXNsb3RfcGlja2VyX2VuYWJsZWQiLCJfd3BiYyIsImdldF9vdGhlcl9wYXJhbSIsIl8iLCJ0aW1lX3BsYWNlaG9sZGVyX2ZvciIsInBsYWNlaG9sZGVyIiwiYnVpbGRfdGltZV9zZWxlY3RfdG9rZW5zIiwidG9rZW5zX3N0ciIsIm9wdGlvbl90b2tlbnMiLCJkZWZfc3RyIiwiZGVmYXVsdF9vcHRpb25fc3VmZml4IiwiaGFzX3NlbGVjdGVkX2RlZmF1bHQiLCJoYXNfZW1wdHlfdmFsdWVfb3B0aW9uIiwicGhUZXh0IiwicGhUb2tlblN0ciIsImVzY2FwZV9mb3Jfc2hvcnRjb2RlIiwib3RoZXIiLCJlbWl0X3RpbWVfc2VsZWN0IiwiaWRfb3B0IiwiY2xzX29wdHMiLCJnZXRfZGVmYXVsdF92YWx1ZSIsImRlZmF1bHRfdmFsdWUiLCJkZWZhdWx0VmFsdWUiLCJkZWZhdWx0X3RleHRfc3VmZml4IiwiY2xhc3Nfb3B0aW9ucyIsImNsYXNzTmFtZSIsInNwbGl0IiwiYyIsInRvX3Rva2VuIiwiaWRfb3B0aW9uIiwicmF3X2lkIiwiaWRfYXR0ciIsImJhc2UiLCJwaF9hdHRyIiwiZXNjYXBlX2Zvcl9hdHRyX3F1b3RlZCIsInNpemVfbWF4X3Rva2VuIiwic2l6ZSIsInBhcnNlSW50IiwibWF4bGVuZ3RoIiwiY29sc19yb3dzX3Rva2VuIiwicm93cyIsInRpdGxlIiwidG9rZW5zIiwiZmluZCIsImRlZl92YWwiLCJlc2NhcGVfdmFsdWVfZm9yX2F0dHIiLCJjaG9pY2VfdGFnIiwiZGVmIiwidWxlIiwidXNlX2xhYmVsX2VsZW1lbnQiLCJtdWx0aXBsZV9mbGFnIiwibXVsdGlwbGUiLCJyYXdQaCIsInBoIiwiUyIsImVzY19zYyIsInBoVG9rZW4iLCJsZiIsImxhYmVsX2ZpcnN0IiwiU2FuaXQiLCJzYW5pdGl6ZV9odG1sX25hbWUiLCJyZWdpc3RlciIsImZuIiwiX19yZWdpc3RyeSIsIk1hcCIsInNldCIsInVucmVnaXN0ZXIiLCJrZXkiLCJnZXQiLCJjb2RlIiwiZSIsImRldiIsImVycm9yIiwid3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUiLCJXUEJDX0JGQl9FWFBPUlRfU0tJUF9BVFRSUyIsImVtaXRfbGluZV9ib2xkX2ZpZWxkIiwidG9rZW4iLCJsaW5lIiwic2tpcFR5cGVzIiwiZmFsbGJhY2tMaW5lIiwiZGVmYXVsdENvbnRlbnRGb3IiLCJyZXNlcnZlZCIsImluY2x1ZGVzIiwid2Fsa1NlY3Rpb24iLCJwcm9jZXNzRmllbGQiLCJwcm9jZXNzSXRlbSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL19zcmMvZXhwb3J0L2J1aWxkZXItZXhwb3J0ZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIEBmaWxlOiAuLi9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9fb3V0L2V4cG9ydC9idWlsZGVyLWV4cG9ydGVyLmpzXHJcbiAqL1xyXG4oZnVuY3Rpb24gKCkge1xyXG5cdFwidXNlIHN0cmljdFwiO1xyXG5cclxuXHRjb25zdCBjb3JlID0gd2luZG93LldQQkNfQkZCX0NvcmUgfHwge307XHJcblxyXG5cdC8vID09IEhlbHBlcnMg4oCUIFNoYXJlZCBoZWxwZXIgQVBJIGZvciBmaWVsZCBwYWNrcyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHQvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0Ly8gPT0gVGhlc2UgYXJlIGdlbmVyaWMgdXRpbGl0aWVzIHRoYXQgcGFja3MgY2FuIGNhbGwgZnJvbSB0aGVpciBvd24gZXhwb3J0ZXJzOlxyXG5cdC8vID09ICAtIGNvbXB1dGVfbmFtZSgpLCBpZF9vcHRpb24oKSwgY2xhc3Nfb3B0aW9ucygpLCBzaXplX21heF90b2tlbigpLCBlbWl0X3RpbWVfc2VsZWN0KCksIGV0Yy5cclxuXHQvLyA9PSBObyBmaWVsZC10eXBlIGJyYW5jaGluZyBzaG91bGQgbGl2ZSBpbiB0aGUgY29yZSBleHBvcnRlci5cclxuXHQvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG5cdC8qKlxyXG5cdCAqIERlZmF1bHQgc2tpcCBsaXN0IChjYW4gYmUgZXh0ZW5kZWQvb3ZlcnJpZGRlbiBhdCBydW50aW1lKS5cclxuXHQgKiAtIE9ubHkgYXR0cmlidXRlIE5BTUVTIGhlcmUgKGNhc2UtaW5zZW5zaXRpdmUpLiBWYWx1ZXMgYXJlIHJlbW92ZWQgd2l0aCB0aGVtLlxyXG5cdCAqL1xyXG5cdGNvbnN0IHdwYmNfZXhwb3J0X3NraXBfYXR0cnNfZGVmYXVsdCA9IFsgJ2RhdGEtY29sc3R5bGVzLWFjdGl2ZScgXTtcclxuXHJcblx0LyoqXHJcblx0ICogUmVtb3ZlIGF0dHJpYnV0ZXMgYnkgbmFtZSBmcm9tIGFuIEhUTUwtbGlrZSBzdHJpbmcuXHJcblx0ICogTWF0Y2hlczpcclxuXHQgKiAgIC0gbmFtZVxyXG5cdCAqICAgLSBuYW1lPVwiLi4uXCIvbmFtZT0nLi4uJy9uYW1lPXZhbHVlXHJcblx0ICogd2l0aCBhbnkgc3Vycm91bmRpbmcgd2hpdGVzcGFjZS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBodG1sXHJcblx0ICogQHBhcmFtIHtzdHJpbmdbXX0gYXR0cnNfbG93ZXJjYXNlICAgYXR0cmlidXRlIG5hbWVzIChsb3dlcmNhc2UpXHJcblx0ICogQHJldHVybiB7c3RyaW5nfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHN0cmlwX2F0dHJpYnV0ZXNfZnJvbV9tYXJrdXAoaHRtbCwgYXR0cnNfbG93ZXJjYXNlKSB7XHJcblx0XHRpZiAoIWh0bWwgfHwgIWF0dHJzX2xvd2VyY2FzZT8ubGVuZ3RoKSByZXR1cm4gaHRtbDtcclxuXHRcdGxldCBvdXQgPSBTdHJpbmcoaHRtbCk7XHJcblx0XHRmb3IgKGNvbnN0IHJhd05hbWUgb2YgYXR0cnNfbG93ZXJjYXNlKSB7XHJcblx0XHRcdGlmICghcmF3TmFtZSkgY29udGludWU7XHJcblx0XHRcdGNvbnN0IG5hbWUgPSBTdHJpbmcocmF3TmFtZSkudG9Mb3dlckNhc2UoKS50cmltKCk7XHJcblx0XHRcdC8vIEVzY2FwZSBmb3IgcmVnZXhcclxuXHRcdFx0Y29uc3QgZXNjID0gbmFtZS5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgJ1xcXFwkJicpO1xyXG5cdFx0XHQvLyBNYXRjaCBmdWxsIGF0dHJpYnV0ZSBuYW1lIG9ubHkgKG5leHQgY2hhciBpcyBOT1QgYSB2YWxpZCBuYW1lIGNoYXIpXHJcblx0XHRcdGNvbnN0IHJlID0gbmV3IFJlZ0V4cChcclxuXHRcdFx0XHRgXFxcXHMke2VzY30oPyFbQS1aYS16MC05XzpcXFxcLV0pKD86PSg/OlwiW15cIl0qXCJ8J1teJ10qJ3xbXlxcXFxzPl0qKSk/YCxcclxuXHRcdFx0XHQnZ2knXHJcblx0XHRcdCk7XHJcblx0XHRcdG91dCA9IG91dC5yZXBsYWNlKHJlLCAnJyk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gb3V0O1xyXG5cdH1cclxuXHJcblx0Ly8gPT0gSGVscGVycyDigJMgY29sdW1uIHN0eWxlcyBwYXJzaW5nICYgQ1NTIHZhcnMgYnVpbGRlciA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuXHQvLyBLbm93biBrZXlzIHdlIHRyZWF0IGFzIHJlYWwgcGVyLWNvbHVtbiBzdHlsZSBvdmVycmlkZXMuXHJcblx0ZnVuY3Rpb24gaGFzX25vbl9kZWZhdWx0X2NvbF9zdHlsZXMob2JqKSB7XHJcblx0XHRpZiAoICFvYmogfHwgdHlwZW9mIG9iaiAhPT0gJ29iamVjdCcgKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHRcdHZhciBrZXlzID0gWyAnZGlyJywgJ3dyYXAnLCAnamMnLCAnYWknLCAnZ2FwJywgJ2FzZWxmJywgJ2FjJyBdO1xyXG5cdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0dmFyIGsgPSBrZXlzW2ldO1xyXG5cdFx0XHRpZiAoIG9ialtrXSAhPSBudWxsICYmIFN0cmluZyggb2JqW2tdICkudHJpbSgpICE9PSAnJyApIHtcclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUGFyc2UgYGNvbF9zdHlsZXNgIGNvbWluZyBmcm9tIGEgU2VjdGlvbi5cclxuXHQgKiBBY2NlcHRzOiBKU09OIHN0cmluZyBvciBhcnJheSBvZiBvYmplY3RzLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8QXJyYXl8dW5kZWZpbmVkfG51bGx9IHJhd1xyXG5cdCAqIEByZXR1cm5zIHtBcnJheTxPYmplY3Q+fSBhcnJheSBhbGlnbmVkIHRvIGNvbHVtbnMgKG1heSBiZSBlbXB0eSlcclxuXHQgKi9cclxuXHRmdW5jdGlvbiBwYXJzZV9jb2xfc3R5bGVzX2pzb24ocmF3KSB7XHJcblx0XHRpZiAoICFyYXcgKSByZXR1cm4gW107XHJcblx0XHRpZiAoIEFycmF5LmlzQXJyYXkoIHJhdyApICkgcmV0dXJuIHJhdy5maWx0ZXIoIGZ1bmN0aW9uICh4KSB7XHJcblx0XHRcdHJldHVybiB4ICYmIHR5cGVvZiB4ID09PSAnb2JqZWN0JztcclxuXHRcdH0gKTtcclxuXHJcblx0XHRpZiAoIHR5cGVvZiByYXcgPT09ICdzdHJpbmcnICkge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHZhciBhcnIgPSBKU09OLnBhcnNlKCByYXcgKTtcclxuXHRcdFx0XHRyZXR1cm4gQXJyYXkuaXNBcnJheSggYXJyICkgPyBhcnIuZmlsdGVyKCBmdW5jdGlvbiAoeCkge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHggJiYgdHlwZW9mIHggPT09ICdvYmplY3QnO1xyXG5cdFx0XHRcdH0gKSA6IFtdO1xyXG5cdFx0XHR9IGNhdGNoICggX2UgKSB7XHJcblx0XHRcdFx0cmV0dXJuIFtdO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gW107XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBCdWlsZCBDU1MgdmFyaWFibGUgZGVjbGFyYXRpb25zIHN0cmluZyBmb3IgYSBjb2x1bW4gc3R5bGUgb2JqZWN0LlxyXG5cdCAqIEtub3duIGtleXMgLT4gQ1NTIHZhcnM6XHJcblx0ICogIC0gZGlyICAtPiAtLXdwYmMtYmZiLWNvbC1kaXJcclxuXHQgKiAgLSB3cmFwIC0+IC0td3BiYy1iZmItY29sLXdyYXBcclxuXHQgKiAgLSBqYyAgIC0+IC0td3BiYy1iZmItY29sLWpjXHJcblx0ICogIC0gYWkgICAtPiAtLXdwYmMtYmZiLWNvbC1haVxyXG5cdCAqICAtIGdhcCAgLT4gLS13cGJjLWJmYi1jb2wtZ2FwXHJcblx0ICogIC0gYWMgICAtPiAtLXdwYmMtYmZiLWNvbC1hY1xyXG5cdCAqICAtIGFzZWxmLT4gLS13cGJjLWJmYi1jb2wtYXNlbGZcclxuXHQgKlxyXG5cdCAqIFVua25vd24ga2V5cyBhcmUgZXhwb3J0ZWQgYXMgYC0td3BiYy1iZmItY29sLSR7a2V5fWAuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge09iamVjdHxudWxsfHVuZGVmaW5lZH0gb2JqXHJcblx0ICogQHJldHVybnMge3N0cmluZ30gZS5nLiBcIi0td3BiYy1iZmItY29sLWRpcjogcm93OyAtLXdwYmMtYmZiLWNvbC13cmFwOiB3cmFwO1wiXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gYnVpbGRfY29sX2Nzc192YXJzKG9iaikge1xyXG5cdFx0aWYgKCAhb2JqIHx8IHR5cGVvZiBvYmogIT09ICdvYmplY3QnICkgcmV0dXJuICcnO1xyXG5cclxuXHRcdHZhciBtYXAgPSB7XHJcblx0XHRcdGRpciAgOiAnLS13cGJjLWJmYi1jb2wtZGlyJyxcclxuXHRcdFx0d3JhcCA6ICctLXdwYmMtYmZiLWNvbC13cmFwJyxcclxuXHRcdFx0amMgICA6ICctLXdwYmMtYmZiLWNvbC1qYycsXHJcblx0XHRcdGFpICAgOiAnLS13cGJjLWJmYi1jb2wtYWknLFxyXG5cdFx0XHRnYXAgIDogJy0td3BiYy1iZmItY29sLWdhcCcsXHJcblx0XHRcdGFjICAgOiAnLS13cGJjLWJmYi1jb2wtYWMnLFxyXG5cdFx0XHRhc2VsZjogJy0td3BiYy1iZmItY29sLWFzZWxmJ1xyXG5cdFx0fTtcclxuXHJcblx0XHR2YXIgcGFydHMgPSBbXTtcclxuXHJcblx0XHRmb3IgKCB2YXIgayBpbiBvYmogKSB7XHJcblx0XHRcdGlmICggIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggb2JqLCBrICkgKSBjb250aW51ZTtcclxuXHRcdFx0dmFyIHYgPSBvYmpba107XHJcblx0XHRcdGlmICggdiA9PSBudWxsIHx8IHYgPT09ICcnICkgY29udGludWU7XHJcblxyXG5cdFx0XHR2YXIgdmFyX25hbWUgPSBtYXBba10gfHwgKCctLXdwYmMtYmZiLWNvbC0nICsgU3RyaW5nKCBrICkucmVwbGFjZSggL1teYS16MC05Xy1dL2dpLCAnJyApLnRvTG93ZXJDYXNlKCkpO1xyXG5cdFx0XHRwYXJ0cy5wdXNoKCB2YXJfbmFtZSArICc6ICcgKyBTdHJpbmcoIHYgKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIEFsd2F5cyBpbmNsdWRlIGV4cGxpY2l0IG1pbiBndWFyZCAocmVxdWVzdGVkKTogLS13cGJjLWNvbC1taW46IDBweDtcclxuXHRcdHBhcnRzLnB1c2goICctLXdwYmMtY29sLW1pbjogMHB4JyApO1xyXG5cclxuXHRcdHJldHVybiBwYXJ0cy5qb2luKCAnOycgKSArIChwYXJ0cy5sZW5ndGggPyAnOycgOiAnJyk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBSZXNvbHZlIG51bWVyaWMgcGVyY2VudCBmcm9tIGEgd2lkdGggdG9rZW4gbGlrZSBcIjQ4LjUlXCIuXHJcblx0ICogRmFsbHMgYmFjayB0byBgZmFsbGJhY2tfcGVyY2VudGAgaWYgbm90IGluIHBlcmNlbnQgZm9ybWF0LlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8bnVtYmVyfHVuZGVmaW5lZHxudWxsfSB3aWR0aF90b2tlblxyXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBmYWxsYmFja19wZXJjZW50XHJcblx0ICogQHJldHVybnMge251bWJlcn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiByZXNvbHZlX2ZsZXhfYmFzaXNfcGVyY2VudCh3aWR0aF90b2tlbiwgZmFsbGJhY2tfcGVyY2VudCkge1xyXG5cdFx0aWYgKCB0eXBlb2Ygd2lkdGhfdG9rZW4gPT09ICdzdHJpbmcnICkge1xyXG5cdFx0XHR2YXIgcyA9IHdpZHRoX3Rva2VuLnRyaW0oKTtcclxuXHRcdFx0aWYgKCBzLmVuZHNXaXRoKCAnJScgKSApIHtcclxuXHRcdFx0XHR2YXIgcCA9IHBhcnNlRmxvYXQoIHMgKTtcclxuXHRcdFx0XHRpZiAoIGlzRmluaXRlKCBwICkgKSByZXR1cm4gcDtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0aWYgKCB0eXBlb2Ygd2lkdGhfdG9rZW4gPT09ICdudW1iZXInICYmIGlzRmluaXRlKCB3aWR0aF90b2tlbiApICkge1xyXG5cdFx0XHRyZXR1cm4gd2lkdGhfdG9rZW47XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gZmFsbGJhY2tfcGVyY2VudDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIENvbXB1dGUgZWZmZWN0aXZlIGZsZXgtYmFzaXMgdmFsdWVzIHRoYXQgcmVzcGVjdCBpbnRlci1jb2x1bW4gZ2FwXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gY29sdW1uc1xyXG5cdCAqIEBwYXJhbSBnYXBfcGVyY2VudFxyXG5cdCAqIEByZXR1cm5zIHsqfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGNvbXB1dGVfZWZmZWN0aXZlX2Jhc2VzKGNvbHVtbnMsIGdhcF9wZXJjZW50ID0gMykge1xyXG5cclxuXHRcdGNvbnN0IG4gPSBjb2x1bW5zICYmIGNvbHVtbnMubGVuZ3RoID8gY29sdW1ucy5sZW5ndGggOiAxO1xyXG5cclxuXHRcdGNvbnN0IHJhdyA9IGNvbHVtbnMubWFwKCAoY29sKSA9PiB7XHJcblx0XHRcdGNvbnN0IHcgPSBjb2wgJiYgY29sLndpZHRoICE9IG51bGwgPyBTdHJpbmcoIGNvbC53aWR0aCApLnRyaW0oKSA6ICcnO1xyXG5cdFx0XHRjb25zdCBwID0gdy5lbmRzV2l0aCggJyUnICkgPyBwYXJzZUZsb2F0KCB3ICkgOiB3ID8gcGFyc2VGbG9hdCggdyApIDogTmFOO1xyXG5cdFx0XHRyZXR1cm4gTnVtYmVyLmlzRmluaXRlKCBwICkgPyBwIDogMTAwIC8gbjtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRjb25zdCBzdW1fcmF3ICAgICA9IHJhdy5yZWR1Y2UoIChhLCBiKSA9PiBhICsgYiwgMCApIHx8IDEwMDtcclxuXHRcdGNvbnN0IGdwICAgICAgICAgID0gTnVtYmVyLmlzRmluaXRlKCArZ2FwX3BlcmNlbnQgKSA/ICtnYXBfcGVyY2VudCA6IDM7XHJcblx0XHRjb25zdCB0b3RhbF9nYXBzICA9IE1hdGgubWF4KCAwLCBuIC0gMSApICogZ3A7XHJcblx0XHRjb25zdCBhdmFpbGFibGUgICA9IE1hdGgubWF4KCAwLCAxMDAgLSB0b3RhbF9nYXBzICk7XHJcblx0XHRjb25zdCBzY2FsZV9yYXRpbyA9IGF2YWlsYWJsZSAvIHN1bV9yYXc7XHJcblxyXG5cdFx0cmV0dXJuIHJhdy5tYXAoIChwKSA9PiBNYXRoLm1heCggMCwgcCAqIHNjYWxlX3JhdGlvICkgKTtcclxuXHR9XHJcblxyXG5cdC8vID09IGFkYXB0ZXI6IGJ1aWxkZXIgKGFycmF5LW9mLXBhZ2VzKSA+IGV4cG9ydGVyIHNoYXBlIHsgcGFnZXM6IFsgeyBpdGVtczpbIHtraW5kLGRhdGF9IF0gfSBdIH0gPT09PT09PT09PT09PT09PT09XHJcblx0ZnVuY3Rpb24gYWRhcHRfYnVpbGRlcl9zdHJ1Y3R1cmVfdG9fZXhwb3J0ZXIoc3RydWN0dXJlKSB7XHJcblxyXG4vL1x0XHRpZiAoICFBcnJheS5pc0FycmF5KCBzdHJ1Y3R1cmUgKSApIHJldHVybiB7IHBhZ2VzOiBbXSB9O1xyXG5cclxuXHRcdC8vIEVuc3VyZSBhdCBsZWFzdCBvbmUgcGFnZSBleGlzdHMsIGV2ZW4gd2hlbiBCdWlsZGVyIHN0cnVjdHVyZSBpcyBlbXB0eSBgW11gLlxyXG5cdFx0Ly8gVGhpcyBrZWVwcyBleHBvcnRlZCBBZHZhbmNlZCBGb3JtIHZhbGlkICh3aXphcmQgc3RlcCAjMSBleGlzdHMpLlxyXG5cdFx0aWYgKCAhIEFycmF5LmlzQXJyYXkoIHN0cnVjdHVyZSApIHx8IHN0cnVjdHVyZS5sZW5ndGggPT09IDAgKSB7XHJcblx0XHRcdHJldHVybiB7IHBhZ2VzOiBbIHsgaXRlbXM6IFtdIH0gXSB9O1xyXG5cdFx0fVxyXG5cclxuXHRcdGNvbnN0IG5vcm1hbGl6ZV9vcHRpb25zID0gKG9wdHMpID0+IHtcclxuXHRcdFx0aWYgKCAhQXJyYXkuaXNBcnJheSggb3B0cyApICkgcmV0dXJuIFtdO1xyXG5cdFx0XHRyZXR1cm4gb3B0cy5tYXAoIChvKSA9PiB7XHJcblx0XHRcdFx0aWYgKCB0eXBlb2YgbyA9PT0gJ3N0cmluZycgKSByZXR1cm4geyBsYWJlbDogbywgdmFsdWU6IG8sIHNlbGVjdGVkOiBmYWxzZSB9O1xyXG5cdFx0XHRcdGlmICggbyAmJiB0eXBlb2YgbyA9PT0gJ29iamVjdCcgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdFx0XHRsYWJlbCAgIDogU3RyaW5nKCBvLmxhYmVsID8/IG8udmFsdWUgPz8gJycgKSxcclxuXHRcdFx0XHRcdFx0dmFsdWUgICA6IFN0cmluZyggby52YWx1ZSA/PyBvLmxhYmVsID8/ICcnICksXHJcblx0XHRcdFx0XHRcdHNlbGVjdGVkOiAhIW8uc2VsZWN0ZWRcclxuXHRcdFx0XHRcdH07XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHJldHVybiB7IGxhYmVsOiBTdHJpbmcoIG8gKSwgdmFsdWU6IFN0cmluZyggbyApLCBzZWxlY3RlZDogZmFsc2UgfTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fTtcclxuXHJcblx0XHQvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0XHQvLyA9PSBBZGFwdGVyIOKAkyBhdHRhY2ggcGFyc2VkIHBlci1jb2x1bW4gYGNvbF9zdHlsZXNgIGZyb20gU2VjdGlvbiBpbnRvIGVhY2ggY29sdW1uXHJcblx0XHQvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0XHRjb25zdCB3YWxrX3NlY3Rpb24gPSAoc2VjKSA9PiB7XHJcblx0XHRcdGNvbnN0IHNlY3Rpb25fY29sX3N0eWxlcyA9IHBhcnNlX2NvbF9zdHlsZXNfanNvbiggc2VjICYmIHNlYy5jb2xfc3R5bGVzICk7XHJcblxyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdGlkICAgICA6IHNlYz8uaWQsXHJcblx0XHRcdFx0Y29sdW1uczogKHNlYz8uY29sdW1ucyB8fCBbXSkubWFwKCAoY29sLCBjb2xfaW5kZXgpID0+IHtcclxuXHRcdFx0XHRcdGNvbnN0IGl0ZW1zID0gQXJyYXkuaXNBcnJheSggY29sPy5pdGVtcyApXHJcblx0XHRcdFx0XHRcdD8gY29sLml0ZW1zXHJcblx0XHRcdFx0XHRcdDogW1xyXG5cdFx0XHRcdFx0XHRcdC4uLihjb2w/LmZpZWxkcyB8fCBbXSkubWFwKCAoZikgPT4gKHsgdHlwZTogJ2ZpZWxkJywgZGF0YTogZiB9KSApLFxyXG5cdFx0XHRcdFx0XHRcdC4uLihjb2w/LnNlY3Rpb25zIHx8IFtdKS5tYXAoIChzKSA9PiAoeyB0eXBlOiAnc2VjdGlvbicsIGRhdGE6IHMgfSkgKVxyXG5cdFx0XHRcdFx0XHRdO1xyXG5cclxuXHRcdFx0XHRcdGNvbnN0IGZpZWxkcyA9IGl0ZW1zXHJcblx0XHRcdFx0XHRcdC5maWx0ZXIoIChpdCkgPT4gaXQgJiYgaXQudHlwZSA9PT0gJ2ZpZWxkJyApXHJcblx0XHRcdFx0XHRcdC5tYXAoIChpdCkgPT4gKHsgLi4uaXQuZGF0YSwgb3B0aW9uczogbm9ybWFsaXplX29wdGlvbnMoIGl0LmRhdGE/Lm9wdGlvbnMgKSB9KSApO1xyXG5cclxuXHRcdFx0XHRcdGNvbnN0IHNlY3Rpb25zID0gaXRlbXNcclxuXHRcdFx0XHRcdFx0LmZpbHRlciggKGl0KSA9PiBpdCAmJiBpdC50eXBlID09PSAnc2VjdGlvbicgKVxyXG5cdFx0XHRcdFx0XHQubWFwKCAoaXQpID0+IHdhbGtfc2VjdGlvbiggaXQuZGF0YSApICk7XHJcblxyXG5cdFx0XHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHRcdFx0d2lkdGggICAgICA6IGNvbD8ud2lkdGggfHwgJzEwMCUnLFxyXG5cdFx0XHRcdFx0XHRzdHlsZSAgICAgIDogY29sPy5zdHlsZSB8fCBudWxsLFxyXG5cdFx0XHRcdFx0XHRjb2xfc3R5bGVzIDogc2VjdGlvbl9jb2xfc3R5bGVzWyBjb2xfaW5kZXggXSB8fCBudWxsLCAgIC8vIDwtIGF0dGFjaCBzdHlsZSBvYmplY3QgcGVyIGNvbHVtblxyXG5cdFx0XHRcdFx0XHRmaWVsZHMsXHJcblx0XHRcdFx0XHRcdHNlY3Rpb25zXHJcblx0XHRcdFx0XHR9O1xyXG5cdFx0XHRcdH0gKVxyXG5cdFx0XHR9O1xyXG5cdFx0fTtcclxuXHJcblxyXG5cdFx0Y29uc3QgcGFnZXMgPSBzdHJ1Y3R1cmUubWFwKCAocGFnZSkgPT4ge1xyXG5cdFx0XHRjb25zdCBpdGVtcyA9IFtdO1xyXG5cdFx0XHQocGFnZT8uY29udGVudCB8fCBbXSkuZm9yRWFjaCggKGl0ZW0pID0+IHtcclxuXHRcdFx0XHRpZiAoICFpdGVtICkgcmV0dXJuO1xyXG5cdFx0XHRcdGlmICggaXRlbS50eXBlID09PSAnc2VjdGlvbicgJiYgaXRlbS5kYXRhICkge1xyXG5cdFx0XHRcdFx0aXRlbXMucHVzaCggeyBraW5kOiAnc2VjdGlvbicsIGRhdGE6IHdhbGtfc2VjdGlvbiggaXRlbS5kYXRhICkgfSApO1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAoIGl0ZW0udHlwZSA9PT0gJ2ZpZWxkJyAmJiBpdGVtLmRhdGEgKSB7XHJcblx0XHRcdFx0XHRpdGVtcy5wdXNoKCB7XHJcblx0XHRcdFx0XHRcdGtpbmQ6ICdmaWVsZCcsXHJcblx0XHRcdFx0XHRcdGRhdGE6IHsgLi4uaXRlbS5kYXRhLCBvcHRpb25zOiBub3JtYWxpemVfb3B0aW9ucyggaXRlbS5kYXRhLm9wdGlvbnMgKSB9XHJcblx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblx0XHRcdHJldHVybiB7IGl0ZW1zIH07XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0cmV0dXJuIHsgcGFnZXMgfTtcclxuXHR9XHJcblxyXG5cclxuXHQvLyA9PSBCb29raW5nIEZyb20gRXhwb3J0ZXIgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cdGNsYXNzIFdQQkNfQkZCX0V4cG9ydGVyIHtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE11dGFibGUgc2tpcC1saXN0IGZvciBhdHRyaWJ1dGUgbmFtZXMgKGxvd2VyY2FzZSkuXHJcblx0XHQgKiBZb3UgY2FuIG92ZXJyaWRlIGl0IHZpYSBzZXRfc2tpcF9hdHRycygpIG9yIGFkZCB3aXRoIGFkZF9za2lwX2F0dHJzKCkuXHJcblx0XHQgKiBAdHlwZSB7U2V0PHN0cmluZz59XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBza2lwX2F0dHJzID0gbmV3IFNldCgpO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVwbGFjZSB0aGUgZW50aXJlIHNraXAgbGlzdC5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nW119IGFyclxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgc2V0X3NraXBfYXR0cnMoIGFyciApIHtcclxuXHRcdFx0dGhpcy5za2lwX2F0dHJzID0gbmV3IFNldChcclxuXHRcdFx0XHQoQXJyYXkuaXNBcnJheSggYXJyICkgPyBhcnIgOiBbXSkubWFwKCAobikgPT4gU3RyaW5nKCBuICkudG9Mb3dlckNhc2UoKS50cmltKCkgKS5maWx0ZXIoIEJvb2xlYW4gKVxyXG5cdFx0XHQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQWRkIG9uZSBvciBtYW55IGF0dHJpYnV0ZXMgdG8gdGhlIHNraXAgbGlzdC5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfHN0cmluZ1tdfSBuYW1lc1xyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgYWRkX3NraXBfYXR0cnMoIG5hbWVzICkge1xyXG5cdFx0XHQoIEFycmF5LmlzQXJyYXkoIG5hbWVzICkgPyBuYW1lcyA6IFsgbmFtZXMgXSApXHJcblx0XHRcdFx0Lm1hcCggKG4pID0+IFN0cmluZyggbiApLnRvTG93ZXJDYXNlKCkudHJpbSgpIClcclxuXHRcdFx0XHQuZmlsdGVyKCBCb29sZWFuIClcclxuXHRcdFx0XHQuZm9yRWFjaCggKG4pID0+IHRoaXMuc2tpcF9hdHRycy5hZGQoIG4gKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVtb3ZlIG9uZSBhdHRyaWJ1dGUgZnJvbSB0aGUgc2tpcCBsaXN0LlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG5hbWVcclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHJlbW92ZV9za2lwX2F0dHIoIG5hbWUgKSB7XHJcblx0XHRcdGlmICggISBuYW1lICkgeyByZXR1cm47IH1cclxuXHRcdFx0dGhpcy5za2lwX2F0dHJzLmRlbGV0ZSggU3RyaW5nKCBuYW1lICkudG9Mb3dlckNhc2UoKS50cmltKCkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFwcGx5IGF0dHJpYnV0ZSBza2lwcGluZyB0byBhIGZpbmFsIEhUTUwgc3RyaW5nLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGh0bWxcclxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHNhbml0aXplX2V4cG9ydCggaHRtbCApIHtcclxuXHRcdFx0cmV0dXJuIHN0cmlwX2F0dHJpYnV0ZXNfZnJvbV9tYXJrdXAoIGh0bWwsIEFycmF5LmZyb20oIHRoaXMuc2tpcF9hdHRycyApICk7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRXhwb3J0IGFkYXB0ZWQgc3RydWN0dXJlIHRvIGFkdmFuY2VkIGZvcm0gdGV4dCAod2l0aCA8cj4vPGM+IGxheW91dCBhbmQgd2l6YXJkIHdyYXBwZXIpLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBhZGFwdGVkXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gIFtvcHRpb25zLm5ld2xpbmU9XCJcXG5cIl1cclxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuYWRkTGFiZWxzPXRydWVdXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gIFtvcHRpb25zLmdhcFBlcmNlbnQ9M11cclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBleHBvcnRfZm9ybShhZGFwdGVkLCBvcHRpb25zID0ge30pIHtcclxuXHRcdFx0Ly8gaW5kZW50OiB1c2UgcmVhbCBUQUIgYnkgZGVmYXVsdCAoY2FuIGJlIG92ZXJyaWRkZW4gdmlhIG9wdGlvbnMuaW5kZW50KVxyXG5cdFx0XHRjb25zdCBjZmcgPSB7IG5ld2xpbmU6ICdcXG4nLCBhZGRMYWJlbHM6IHRydWUsIGdhcFBlcmNlbnQ6IDMsIGluZGVudDogJ1xcdCcsIC4uLm9wdGlvbnMgfTtcclxuXHRcdFx0Y29uc3QgSU5EID0gKHR5cGVvZiBjZmcuaW5kZW50ID09PSAnc3RyaW5nJykgPyBjZmcuaW5kZW50IDogJ1xcdCc7XHJcblxyXG5cdFx0XHRsZXQgZGVwdGggICA9IDA7XHJcblx0XHRcdGNvbnN0IGxpbmVzID0gW107XHJcblx0XHRcdGNvbnN0IHB1c2ggID0gKHMgPSAnJykgPT4gbGluZXMucHVzaCggSU5ELnJlcGVhdCggZGVwdGggKSArIFN0cmluZyggcyApICk7XHJcblx0XHRcdGNvbnN0IG9wZW4gID0gKHMgPSAnJykgPT4ge1xyXG5cdFx0XHRcdHB1c2goIHMgKTtcclxuXHRcdFx0XHRkZXB0aCsrO1xyXG5cdFx0XHR9O1xyXG5cdFx0XHRjb25zdCBjbG9zZSA9IChzID0gJycpID0+IHtcclxuXHRcdFx0XHRkZXB0aCA9IE1hdGgubWF4KCAwLCBkZXB0aCAtIDEgKTtcclxuXHRcdFx0XHRwdXNoKCBzICk7XHJcblx0XHRcdH07XHJcblx0XHRcdGNvbnN0IGJsYW5rID0gKCkgPT4ge1xyXG5cdFx0XHRcdGxpbmVzLnB1c2goICcnICk7XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHRpZiAoICFhZGFwdGVkIHx8ICFBcnJheS5pc0FycmF5KCBhZGFwdGVkLnBhZ2VzICkgKSByZXR1cm4gJyc7XHJcblxyXG5cdFx0XHQvLyBBbHdheXMgZXhwb3J0IGF0IGxlYXN0IG9uZSB3aXphcmQgc3RlcCB0byBrZWVwIEFkdmFuY2VkIEZvcm0gc3RydWN0dXJlIHZhbGlkLlxyXG5cdFx0XHRjb25zdCBwYWdlcyA9IGFkYXB0ZWQucGFnZXMubGVuZ3RoID8gYWRhcHRlZC5wYWdlcyA6IFsgeyBpdGVtczogW10gfSBdO1xyXG5cclxuXHRcdFx0Y29uc3QgY3R4ID0geyB1c2VkSWRzOiBuZXcgU2V0KCkgfTtcclxuXHJcblx0XHRcdG9wZW4oIGA8ZGl2IGNsYXNzPVwid3BiY19iZmJfZm9ybSB3cGJjX3dpemFyZF9fYm9yZGVyX2NvbnRhaW5lclwiPmAgKTtcclxuXHJcblx0XHRcdC8vIG9uZS1wZXItZm9ybSBndWFyZHMgKGNhbGVuZGFyIGlzIG5vdCBnYXRlZCBoZXJlKVxyXG5cdFx0XHRjb25zdCBvbmNlID0geyBjYXB0Y2hhOiAwLCBjb3VudHJ5OiAwLCBjb3Vwb246IDAsIGNvc3RfY29ycmVjdGlvbnM6IDAsIHN1Ym1pdDogMCB9O1xyXG5cclxuXHRcdFx0cGFnZXMuZm9yRWFjaCggKHBhZ2UsIHBhZ2VfaW5kZXgpID0+IHtcclxuXHRcdFx0XHRjb25zdCBpc19maXJzdCA9IHBhZ2VfaW5kZXggPT09IDA7XHJcblx0XHRcdFx0Y29uc3Qgc3RlcF9udW0gPSBwYWdlX2luZGV4ICsgMTtcclxuXHJcblx0XHRcdFx0Y29uc3QgaGlkZGVuX2NsYXNzID0gaXNfZmlyc3QgPyAnJyA6ICcgd3BiY193aXphcmRfc3RlcF9oaWRkZW4nO1xyXG5cdFx0XHRcdGNvbnN0IGhpZGRlbl9zdHlsZSA9IGlzX2ZpcnN0ID8gJycgOiAnIHN0eWxlPVwiZGlzcGxheTpub25lO2NsZWFyOmJvdGg7XCInO1xyXG5cdFx0XHRcdG9wZW4oIGA8ZGl2IGNsYXNzPVwid3BiY193aXphcmRfc3RlcCB3cGJjX19mb3JtX19kaXYgd3BiY193aXphcmRfc3RlcCR7c3RlcF9udW19JHtoaWRkZW5fY2xhc3N9XCIke2hpZGRlbl9zdHlsZX0+YCApO1xyXG5cclxuXHRcdFx0XHQocGFnZS5pdGVtcyB8fCBbXSkuZm9yRWFjaCggKGl0ZW0pID0+IHtcclxuXHRcdFx0XHRcdGlmICggaXRlbS5raW5kID09PSAnc2VjdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdFdQQkNfQkZCX0V4cG9ydGVyLnJlbmRlcl9zZWN0aW9uKCBpdGVtLmRhdGEsIHsgb3BlbiwgY2xvc2UsIHB1c2gsIGJsYW5rIH0sIGNmZywgb25jZSwgY3R4ICk7XHJcblx0XHRcdFx0XHRcdC8vIGJsYW5rKCk7XHJcblx0XHRcdFx0XHR9IGVsc2UgaWYgKCBpdGVtLmtpbmQgPT09ICdmaWVsZCcgKSB7XHJcblx0XHRcdFx0XHRcdG9wZW4oIGA8cj5gICk7XHJcblx0XHRcdFx0XHRcdG9wZW4oIGA8Yz5gICk7XHJcblx0XHRcdFx0XHRcdFdQQkNfQkZCX0V4cG9ydGVyLnJlbmRlcl9maWVsZF9ub2RlKCBpdGVtLmRhdGEsIHsgb3BlbiwgY2xvc2UsIHB1c2gsIGJsYW5rIH0sIGNmZywgb25jZSwgY3R4ICk7XHJcblx0XHRcdFx0XHRcdGNsb3NlKCBgPC9jPmAgKTtcclxuXHRcdFx0XHRcdFx0Y2xvc2UoIGA8L3I+YCApO1xyXG5cdFx0XHRcdFx0XHQvLyBibGFuaygpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gKTtcclxuXHJcblx0XHRcdFx0Y2xvc2UoIGA8L2Rpdj5gICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdGNsb3NlKCBgPC9kaXY+YCApO1xyXG5cdFx0XHRyZXR1cm4gV1BCQ19CRkJfRXhwb3J0ZXIuc2FuaXRpemVfZXhwb3J0KCBsaW5lcy5qb2luKCBjZmcubmV3bGluZSApICk7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSGlnaC1sZXZlbCBoZWxwZXI6IGV4cG9ydCBmdWxsIHBhY2thZ2UgZnJvbSByYXcgQnVpbGRlciBzdHJ1Y3R1cmUuXHJcblx0XHQgKlxyXG5cdFx0ICogLSBBZGFwdHMgcmF3IEJ1aWxkZXIgc3RydWN0dXJlIChwYWdlcy9zZWN0aW9ucy9jb2x1bW5zL2l0ZW1zKSBmb3IgZXhwb3J0ZXJzLlxyXG5cdFx0ICogLSBCdWlsZHM6XHJcblx0XHQgKiAgICAgIOKAoiBhZHZhbmNlZF9mb3JtICAtPiDigJxBZHZhbmNlZCBGb3JtIChleHBvcnQp4oCdIHRleHQuXHJcblx0XHQgKiAgICAgIOKAoiBmaWVsZHNfZGF0YSAgICAtPiDigJxDb250ZW50IG9mIGJvb2tpbmcgZmllbGRzIGRhdGEgKGV4cG9ydCnigJ0gdGV4dC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0FycmF5fSAgc3RydWN0dXJlICBSYXcgQnVpbGRlciBzdHJ1Y3R1cmUgZnJvbSB3cGJjX2JmYi5nZXRfc3RydWN0dXJlKCkuXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuZ2FwUGVyY2VudD0zXSAgQ29sdW1uIGdhcCBwZXJjZW50IGZvciBsYXlvdXQgbWF0aC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7e1xyXG5cdFx0ICogICBhZHZhbmNlZF9mb3JtOiBzdHJpbmcsXHJcblx0XHQgKiAgIGZpZWxkc19kYXRhOiBzdHJpbmcsXHJcblx0XHQgKiAgIHN0cnVjdHVyZTogQXJyYXksXHJcblx0XHQgKiAgIGFkYXB0ZWQ6IE9iamVjdFxyXG5cdFx0ICogfX1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGV4cG9ydF9hbGwoIHN0cnVjdHVyZSwgb3B0aW9ucyA9IHt9ICkge1xyXG5cclxuXHRcdFx0Ly8gMSkgQWRhcHQgQnVpbGRlciBKU09OIHRvIGV4cG9ydGVyIHNoYXBlIChwYWdlc1tdIC0+IGl0ZW1zW10pLlxyXG5cdFx0XHRjb25zdCBhZGFwdGVkID0gYWRhcHRfYnVpbGRlcl9zdHJ1Y3R1cmVfdG9fZXhwb3J0ZXIoIHN0cnVjdHVyZSB8fCBbXSApO1xyXG5cclxuXHRcdFx0Ly8gMikgQWR2YW5jZWQgRm9ybSB0ZXh0IChzYW1lIGxvZ2ljIGFzIGRlYnVnIHBhbmVsKS5cclxuXHRcdFx0Y29uc3QgZ2FwX3BlcmNlbnQgICA9ICggb3B0aW9ucyAmJiB0eXBlb2Ygb3B0aW9ucy5nYXBQZXJjZW50ID09PSAnbnVtYmVyJyApID8gb3B0aW9ucy5nYXBQZXJjZW50IDogMztcclxuXHRcdFx0Y29uc3QgYWR2YW5jZWRfZm9ybSA9IFdQQkNfQkZCX0V4cG9ydGVyLmV4cG9ydF9mb3JtKFxyXG5cdFx0XHRcdGFkYXB0ZWQsXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0YWRkTGFiZWxzIDogdHJ1ZSxcclxuXHRcdFx0XHRcdGdhcFBlcmNlbnQ6IGdhcF9wZXJjZW50XHJcblx0XHRcdFx0fVxyXG5cdFx0XHQpO1xyXG5cclxuXHRcdFx0Ly8gMykgQ29udGVudCBvZiBib29raW5nIGZpZWxkcyBkYXRhIChpZiBjb250ZW50IGV4cG9ydGVyIGlzIGF2YWlsYWJsZSkuXHJcblx0XHRcdGxldCBmaWVsZHNfZGF0YSA9ICcnO1xyXG5cdFx0XHRpZiAoXHJcblx0XHRcdFx0d2luZG93LldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciAmJlxyXG5cdFx0XHRcdHR5cGVvZiB3aW5kb3cuV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyLmV4cG9ydF9jb250ZW50ID09PSAnZnVuY3Rpb24nXHJcblx0XHRcdCkge1xyXG5cdFx0XHRcdGZpZWxkc19kYXRhID0gd2luZG93LldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlci5leHBvcnRfY29udGVudChcclxuXHRcdFx0XHRcdGFkYXB0ZWQsXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdGFkZExhYmVsczogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0c2VwICAgICAgOiAnOiAnXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHRhZHZhbmNlZF9mb3JtOiBhZHZhbmNlZF9mb3JtIHx8ICcnLFxyXG5cdFx0XHRcdGZpZWxkc19kYXRhICA6IGZpZWxkc19kYXRhIHx8ICcnLFxyXG5cdFx0XHRcdHN0cnVjdHVyZSAgICA6IHN0cnVjdHVyZSB8fCBbXSxcclxuXHRcdFx0XHRhZGFwdGVkICAgICAgOiBhZGFwdGVkXHJcblx0XHRcdH07XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cdFx0Ly8gPT0gRXhwb3J0ZXIg4oCTIHJlbmRlcl9zZWN0aW9uKCkgbm93IGluamVjdHMgcGVyLWNvbHVtbiBDU1MgdmFycyBmcm9tIGBjb2xfc3R5bGVzYFxyXG5cdFx0Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cdFx0c3RhdGljIHJlbmRlcl9zZWN0aW9uKHNlY3Rpb24sIGlvLCBjZmcsIG9uY2UsIGN0eCkge1xyXG5cclxuXHRcdFx0b25jZSA9IG9uY2UgfHwgeyBjYXB0Y2hhOiAwLCBjb3VudHJ5OiAwLCBjb3Vwb246IDAsIGNvc3RfY29ycmVjdGlvbnM6IDAsIHN1Ym1pdDogMCB9O1xyXG5cdFx0XHRjdHggID0gY3R4IHx8IHsgdXNlZElkczogbmV3IFNldCgpIH07XHJcblxyXG5cdFx0XHRjb25zdCB7IG9wZW4sIGNsb3NlIH0gPSBpbztcclxuXHJcblx0XHRcdGNvbnN0IGNvbHMgPSBBcnJheS5pc0FycmF5KCBzZWN0aW9uLmNvbHVtbnMgKSAmJiBzZWN0aW9uLmNvbHVtbnMubGVuZ3RoXHJcblx0XHRcdFx0PyBzZWN0aW9uLmNvbHVtbnNcclxuXHRcdFx0XHQ6IFsgeyB3aWR0aDogJzEwMCUnLCBmaWVsZHM6IFtdLCBzZWN0aW9uczogW10gfSBdO1xyXG5cclxuXHRcdFx0Ly8gUm93IGlzIGFjdGl2ZSBpZiBBTlkgY29sdW1uIGNhcnJpZXMgc3R5bGVzLlxyXG5cdFx0XHR2YXIgcm93X2lzX2FjdGl2ZSA9IGNvbHMuc29tZSggZnVuY3Rpb24gKGNvbCkgeyByZXR1cm4gaGFzX25vbl9kZWZhdWx0X2NvbF9zdHlsZXMoIGNvbCAmJiBjb2wuY29sX3N0eWxlcyApOyB9ICk7XHJcblx0XHRcdHZhciByb3dfYXR0cl9hY3RpdmUgPSByb3dfaXNfYWN0aXZlID8gJyBkYXRhLWNvbHN0eWxlcy1hY3RpdmU9XCIxXCInIDogJyc7XHJcblxyXG5cdFx0XHRvcGVuKCBgPHIke3Jvd19hdHRyX2FjdGl2ZX0+YCApO1xyXG5cclxuXHRcdFx0Y29uc3QgYmFzZXMgICAgPSBjb21wdXRlX2VmZmVjdGl2ZV9iYXNlcyggY29scywgY2ZnLmdhcFBlcmNlbnQgKTtcclxuXHRcdFx0Y29uc3QgZXNjX2F0dHIgPSBjb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY2FwZV9odG1sO1xyXG5cclxuXHRcdFx0Y29scy5mb3JFYWNoKCAoY29sLCBpZHgpID0+IHtcclxuXHRcdFx0XHQvLyAoMSkgUmVzb2x2ZSBmbGV4LWJhc2lzLlxyXG5cdFx0XHRcdHZhciBlZmZfYmFzaXMgPSByZXNvbHZlX2ZsZXhfYmFzaXNfcGVyY2VudCggY29sICYmIGNvbC53aWR0aCwgTnVtYmVyLmlzRmluaXRlKCBiYXNlc1tpZHhdICkgPyArYmFzZXNbaWR4XSA6IDEwMCApO1xyXG5cclxuXHRcdFx0XHQvLyAoMikgQnVpbGQgaW5saW5lIHN0eWxlLlxyXG5cdFx0XHRcdHZhciBzdHlsZV9wYXJ0cyA9IFtdO1xyXG5cclxuXHRcdFx0XHRpZiAoIGNvbCAmJiB0eXBlb2YgY29sLnN0eWxlID09PSAnc3RyaW5nJyAmJiBjb2wuc3R5bGUudHJpbSgpICkge1xyXG5cdFx0XHRcdFx0c3R5bGVfcGFydHMucHVzaCggY29sLnN0eWxlLnRyaW0oKS5yZXBsYWNlKCAvOytcXHMqJC8sICcnICkgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0c3R5bGVfcGFydHMucHVzaCggJ2ZsZXgtYmFzaXM6ICcgKyAoIE51bWJlci5pc0Zpbml0ZSggZWZmX2Jhc2lzICkgPyBlZmZfYmFzaXMudG9TdHJpbmcoKSA6ICcxMDAnICkgKyAnJScgKTtcclxuXHJcblx0XHRcdFx0dmFyIGNzc192YXJzX3N0ciA9IGJ1aWxkX2NvbF9jc3NfdmFycyggY29sICYmIGNvbC5jb2xfc3R5bGVzICk7XHJcblx0XHRcdFx0aWYgKCBjc3NfdmFyc19zdHIgKSB7XHJcblx0XHRcdFx0XHRzdHlsZV9wYXJ0cy5wdXNoKCBjc3NfdmFyc19zdHIucmVwbGFjZSggL147fDskL2csICcnICkgKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHZhciBzdHlsZV9hdHRyID0gYCBzdHlsZT1cIiR7ZXNjX2F0dHIoIHN0eWxlX3BhcnRzLmpvaW4oICc7ICcgKSApfVwiYDtcclxuXHJcblx0XHRcdFx0Ly8gKDMpIENvbHVtbi1sZXZlbCBhY3RpdmF0aW9uIChtb3JlIHByZWNpc2Ugc2NvcGluZylcclxuXHRcdFx0XHR2YXIgY29sX2lzX2FjdGl2ZSAgID0gaGFzX25vbl9kZWZhdWx0X2NvbF9zdHlsZXMoIGNvbCAmJiBjb2wuY29sX3N0eWxlcyApO1xyXG5cdFx0XHRcdHZhciBjb2xfYXR0cl9hY3RpdmUgPSBjb2xfaXNfYWN0aXZlID8gJyBkYXRhLWNvbHN0eWxlcy1hY3RpdmU9XCIxXCInIDogJyc7XHJcblxyXG5cdFx0XHRcdG9wZW4oIGA8YyR7Y29sX2F0dHJfYWN0aXZlfSR7c3R5bGVfYXR0cn0+YCApO1xyXG5cclxuXHRcdFx0XHQvLyBVc2UgdGhlIHNoYXJlZCBvbmNlL2N0eCBvYmplY3RzIHNvIHNpbmdsZS1wZXItZm9ybSBndWFyZHMgd29yayBhY3Jvc3MgdGhlIHdob2xlIGZvcm0uXHJcblx0XHRcdFx0KGNvbC5maWVsZHMgfHwgW10pLmZvckVhY2goIChub2RlKSA9PlxyXG5cdFx0XHRcdFx0V1BCQ19CRkJfRXhwb3J0ZXIucmVuZGVyX2ZpZWxkX25vZGUoIG5vZGUsIGlvLCBjZmcsIG9uY2UsIGN0eCApXHJcblx0XHRcdFx0KTtcclxuXHJcblx0XHRcdFx0Ly8gUmVjdXJzZSB3aXRoIHRoZSBzYW1lIG9uY2UvY3R4IGFzIHdlbGwuXHJcblx0XHRcdFx0KGNvbC5zZWN0aW9ucyB8fCBbXSkuZm9yRWFjaCggKG5lc3RlZCkgPT5cclxuXHRcdFx0XHRcdFdQQkNfQkZCX0V4cG9ydGVyLnJlbmRlcl9zZWN0aW9uKCBuZXN0ZWQsIGlvLCBjZmcsIG9uY2UsIGN0eCApXHJcblx0XHRcdFx0KTtcclxuXHJcblx0XHRcdFx0Y2xvc2UoIGA8L2M+YCApO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRjbG9zZSggYDwvcj5gICk7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQnVpbGQgYXR0cmlidXRlIHN0cmluZyBmb3IgdGhlIDxpdGVtPiB3cmFwcGVyLlxyXG5cdFx0ICogQ3VycmVudGx5IG9ubHkgdXNlZCBmb3IgQ0FQVENIQTogcHVzaGVzIGNzcyBjbGFzc2VzIGFuZCBodG1sX2lkIHRvIHRoZSB3cmFwcGVyLlxyXG5cdFx0ICogQWxzbyBlbnN1cmVzIHVuaXF1ZW5lc3Mgb2YgdGhlIGh0bWxfaWQgYWNyb3NzIHRoZSBleHBvcnQgKHVzZXMgY3R4LnVzZWRJZHMpLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBmaWVsZFxyXG5cdFx0ICogQHBhcmFtIHt7dXNlZElkczpTZXQ8c3RyaW5nPn19IGN0eFxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ30gZS5nLiAnIGNsYXNzPVwieCB5XCIgaWQ9XCJteUlkXCInXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBpdGVtX3dyYXBwZXJfYXR0cnMoZmllbGQsIGN0eCkge1xyXG5cdFx0XHRpZiAoICEgZmllbGQgKSB7XHJcblx0XHRcdFx0cmV0dXJuICcnO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IGVzY19odG1sICA9IGNvcmUuV1BCQ19CRkJfU2FuaXRpemUuZXNjYXBlX2h0bWw7XHJcblx0XHRcdGNvbnN0IGNsc19zYW5pdCA9IGNvcmUuV1BCQ19CRkJfU2FuaXRpemUuc2FuaXRpemVfY3NzX2NsYXNzbGlzdDtcclxuXHRcdFx0Y29uc3Qgc2lkICAgICAgID0gY29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5zYW5pdGl6ZV9odG1sX2lkO1xyXG5cclxuXHRcdFx0bGV0IG91dCA9ICcnO1xyXG5cclxuXHRcdFx0Y29uc3QgY2xzX3JhdyA9IFN0cmluZyggZmllbGQuY3NzY2xhc3NfZXh0cmEgfHwgZmllbGQuY3NzY2xhc3MgfHwgZmllbGQuY2xhc3MgfHwgJycgKTtcclxuXHRcdFx0Y29uc3QgY2xzICAgICA9IGNsc19zYW5pdCggY2xzX3JhdyApO1xyXG5cdFx0XHRsZXQgaHRtbF9pZCAgID0gZmllbGQuaHRtbF9pZCA/IHNpZCggU3RyaW5nKCBmaWVsZC5odG1sX2lkICkgKSA6ICcnO1xyXG5cdFx0XHRpZiAoIGh0bWxfaWQgJiYgY3R4Py51c2VkSWRzICkge1xyXG5cdFx0XHRcdGxldCB1bmlxdWUgPSBodG1sX2lkLCBpID0gMjtcclxuXHRcdFx0XHR3aGlsZSAoIGN0eC51c2VkSWRzLmhhcyggdW5pcXVlICkgKSB7XHJcblx0XHRcdFx0XHR1bmlxdWUgPSBgJHtodG1sX2lkfV8ke2krK31gO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjdHgudXNlZElkcy5hZGQoIHVuaXF1ZSApO1xyXG5cdFx0XHRcdGh0bWxfaWQgPSB1bmlxdWU7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBjbHMgKSB7XHJcblx0XHRcdFx0b3V0ICs9IGAgY2xhc3M9XCIke2VzY19odG1sKCBjbHMgKX1cImA7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBodG1sX2lkICkge1xyXG5cdFx0XHRcdG91dCArPSBgIGlkPVwiJHtlc2NfaHRtbCggaHRtbF9pZCApfVwiYDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIG91dDtcclxuXHRcdH1cclxuXHJcblx0XHQvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0XHQvLyA9PSBGaWVsZHMg4oCTIHBsdWdnYWJsZSwgcGFjay1kcml2ZW4gZXhwb3J0XHJcblx0XHQvLyA9PSBXcmFwIGV2ZXJ5IGV4cG9ydGVkIGZpZWxkIGluc2lkZSA8aXRlbT7igKY8L2l0ZW0+IGFuZCBkZWxlZ2F0ZSBhY3R1YWwgc2hvcnRjb2RlIGV4cG9ydFxyXG5cdFx0Ly8gPT0gdG8gcGVyLXBhY2sgY2FsbGJhY2tzIHJlZ2lzdGVyZWQgdmlhIFdQQkNfQkZCX0V4cG9ydGVyLnJlZ2lzdGVyKHR5cGUsIGZuKS5cclxuXHRcdC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHRcdHN0YXRpYyByZW5kZXJfZmllbGRfbm9kZShmaWVsZCwgaW8sIGNmZywgb25jZSwgY3R4KSB7XHJcblxyXG5cdFx0XHRjb25zdCB7IG9wZW4sIGNsb3NlLCBwdXNoIH0gPSBpbztcclxuXHRcdFx0aWYgKCAhIGZpZWxkIHx8ICEgZmllbGQudHlwZSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFNoYXJlZCBjb250ZXh0ICh1c2VkSWRzLCDigJxvbmNlLXBlci1mb3Jt4oCdIGd1YXJkcywgZXRjLikuXHJcblx0XHRcdG9uY2UgPSBvbmNlIHx8IHt9O1xyXG5cdFx0XHRjdHggID0gY3R4ICB8fCB7IHVzZWRJZHM6IG5ldyBTZXQoKSB9O1xyXG5cclxuXHRcdFx0Y29uc3QgdHlwZSA9IFN0cmluZyggZmllbGQudHlwZSApLnRvTG93ZXJDYXNlKCk7XHJcblxyXG5cdFx0XHQvLyBPcHRpb25hbCB3cmFwcGVyIGF0dHJzIGZvciBzcGVjaWFsIHR5cGVzIChjdXJyZW50bHkgb25seSB1c2VkIGJ5IGNhcHRjaGEpLlxyXG5cdFx0XHRsZXQgaXRlbV9hdHRycyA9ICcnO1xyXG5cdFx0XHRpZiAoIHR5cGUgPT09ICdjYXB0Y2hhJyApIHtcclxuXHRcdFx0XHRpdGVtX2F0dHJzID0gV1BCQ19CRkJfRXhwb3J0ZXIuaXRlbV93cmFwcGVyX2F0dHJzKCBmaWVsZCwgY3R4ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdG9wZW4oIGA8aXRlbSR7aXRlbV9hdHRyc30+YCApO1xyXG5cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHQvLyAxKSBMZXQgdGhlIGNvcnJlc3BvbmRpbmcgZmllbGQgcGFjayBoYW5kbGUgZXhwb3J0LlxyXG5cdFx0XHRcdGxldCBoYW5kbGVkID0gZmFsc2U7XHJcblx0XHRcdFx0aWYgKCBXUEJDX0JGQl9FeHBvcnRlci5oYXNfZXhwb3J0ZXIoIHR5cGUgKSApIHtcclxuXHRcdFx0XHRcdGhhbmRsZWQgPSBXUEJDX0JGQl9FeHBvcnRlci5ydW5fcmVnaXN0ZXJlZF9leHBvcnRlciggZmllbGQsIGlvLCBjZmcsIG9uY2UsIGN0eCApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gMikgRmFsbGJhY2s6IHNob3cgYSBjbGVhciBUT0RPIGNvbW1lbnQgaWYgbm8gZXhwb3J0ZXIgaXMgcmVnaXN0ZXJlZC5cclxuXHRcdFx0XHRpZiAoICEgaGFuZGxlZCApIHtcclxuXHRcdFx0XHRcdGNvbnN0IG5hbWUgPSBXUEJDX0JGQl9FeHBvcnRlci5jb21wdXRlX25hbWUoIHR5cGUsIGZpZWxkICk7XHJcblx0XHRcdFx0XHRwdXNoKCBgPCEtLSBUT0RPOiBtYXAgZmllbGQgdHlwZSBcIiR7dHlwZX1cIiBuYW1lPVwiJHtuYW1lfVwiIGluIGEgcGFjayBleHBvcnRlciAtLT5gICk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyAzKSBBcHBlbmQgaGVscCB0ZXh0IGNvbnNpc3RlbnRseSAocGFja3Mgc2hvdWxkbuKAmXQgZHVwbGljYXRlIHRoaXMpLlxyXG5cdFx0XHRcdGlmICggZmllbGQuaGVscCApIHtcclxuXHRcdFx0XHRcdHB1c2goXHJcblx0XHRcdFx0XHRcdGA8ZGl2IGNsYXNzPVwid3BiY19maWVsZF9kZXNjcmlwdGlvblwiPiR7Y29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5lc2NhcGVfaHRtbChcclxuXHRcdFx0XHRcdFx0XHRTdHJpbmcoIGZpZWxkLmhlbHAgKVxyXG5cdFx0XHRcdFx0XHQpfTwvZGl2PmBcclxuXHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGZpbmFsbHkge1xyXG5cdFx0XHRcdC8vIEFsd2F5cyBjbG9zZSB3cmFwcGVyLlxyXG5cdFx0XHRcdGNsb3NlKCBgPC9pdGVtPmAgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHRcdC8vID09IEhlbHBlcnMgPT1cclxuXHRcdC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHRcdHN0YXRpYyBpc19yZXF1aXJlZChmaWVsZCkge1xyXG5cdFx0XHRjb25zdCB2ID0gZmllbGQgJiYgZmllbGQucmVxdWlyZWQ7XHJcblx0XHRcdHJldHVybiAoXHJcblx0XHRcdFx0diA9PT0gdHJ1ZSB8fFxyXG5cdFx0XHRcdHYgPT09ICd0cnVlJyB8fFxyXG5cdFx0XHRcdHYgPT09IDEgfHxcclxuXHRcdFx0XHR2ID09PSAnMScgfHxcclxuXHRcdFx0XHR2ID09PSAncmVxdWlyZWQnXHJcblx0XHRcdCk7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2hhcmVkIGxhYmVsIGVtaXR0ZXIgdXNlZCBieSBwZXItcGFjayBleHBvcnRlcnMuXHJcblx0XHQgKlxyXG5cdFx0ICogRW1pdHMgb3B0aW9uYWwgPGw+TGFiZWw8L2w+ICsgPGJyPiBiZWZvcmUgdGhlIHByb3ZpZGVkIGJvZHksXHJcblx0XHQgKiByZXNwZWN0aW5nIGNmZy5hZGRMYWJlbHMuIEhlbHAgdGV4dCBpcyBlbWl0dGVkIGNlbnRyYWxseSBpblxyXG5cdFx0ICogcmVuZGVyX2ZpZWxkX25vZGUoKSwgc28gaXQgaXMgaW50ZW50aW9uYWxseSBOT1QgaGFuZGxlZCBoZXJlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgICAgICAgICAgICAgIGZpZWxkXHJcblx0XHQgKiBAcGFyYW0ge2Z1bmN0aW9uKHN0cmluZyk6IHZvaWR9ICBlbWl0XHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgICBib2R5XHJcblx0XHQgKiBAcGFyYW0ge3thZGRMYWJlbHM/OiBib29sZWFufX0gIFtjZmddXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBlbWl0X2xhYmVsX3RoZW4oZmllbGQsIGVtaXQsIGJvZHksIGNmZykge1xyXG5cdFx0XHRpZiAoIHR5cGVvZiBlbWl0ICE9PSAnZnVuY3Rpb24nICkgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdGNmZyA9IGNmZyB8fCB7fTtcclxuXHRcdFx0Y29uc3QgYWRkTGFiZWxzID0gY2ZnLmFkZExhYmVscyAhPT0gZmFsc2U7XHJcblxyXG5cdFx0XHRjb25zdCByYXcgICA9IChmaWVsZCAmJiB0eXBlb2YgZmllbGQubGFiZWwgPT09ICdzdHJpbmcnKSA/IGZpZWxkLmxhYmVsIDogJyc7XHJcblx0XHRcdGNvbnN0IGxhYmVsID0gcmF3LnRyaW0oKTtcclxuXHJcblx0XHRcdHZhciBpc19yZXEgICA9IHRoaXMuaXNfcmVxdWlyZWQoIGZpZWxkICk7XHJcblx0XHRcdHZhciByZXFfbWFyayA9IGlzX3JlcSA/ICcqJyA6ICcnO1xyXG5cclxuXHRcdFx0aWYgKCBsYWJlbCAmJiBhZGRMYWJlbHMgKSB7XHJcblx0XHRcdFx0Y29uc3QgZXNjX2h0bWwgPSBjb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY2FwZV9odG1sO1xyXG5cdFx0XHRcdGVtaXQoICc8bD4nICsgZXNjX2h0bWwoIGxhYmVsICkgKyByZXFfbWFyayArICc8L2w+JyApO1xyXG5cdFx0XHRcdGVtaXQoICc8YnI+JyArIGJvZHkgKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRlbWl0KCBib2R5ICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblxyXG5cdFx0Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cdFx0Ly8gPT0gSGVscGVycyA9PVxyXG5cdFx0Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuXHRcdC8vIC0tIFRpbWUgU2VsZWN0IEhlbHBlcnMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdHN0YXRpYyBpc190aW1lc2xvdF9waWNrZXJfZW5hYmxlZCgpIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRyZXR1cm4gISEod2luZG93Ll93cGJjICYmIHR5cGVvZiB3aW5kb3cuX3dwYmMuZ2V0X290aGVyX3BhcmFtID09PSAnZnVuY3Rpb24nXHJcblx0XHRcdFx0XHQmJiB3aW5kb3cuX3dwYmMuZ2V0X290aGVyX3BhcmFtKCdpc19lbmFibGVkX2Jvb2tpbmdfdGltZXNsb3RfcGlja2VyJykpO1xyXG5cdFx0XHR9IGNhdGNoIChfKSB7IHJldHVybiBmYWxzZTsgfVxyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyB0aW1lX3BsYWNlaG9sZGVyX2ZvcihuYW1lLCBmaWVsZCkge1xyXG5cdFx0XHQvLyBQcmVmZXIgZmllbGQtc3BlY2lmaWMgcGxhY2Vob2xkZXI7IGVsc2Ugc2Vuc2libGUgZGVmYXVsdCBwZXIgZmllbGQuXHJcblx0XHRcdGlmICh0eXBlb2YgZmllbGQucGxhY2Vob2xkZXIgPT09ICdzdHJpbmcnICYmIGZpZWxkLnBsYWNlaG9sZGVyLnRyaW0oKSkge1xyXG5cdFx0XHRcdHJldHVybiBmaWVsZC5wbGFjZWhvbGRlci50cmltKCk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKG5hbWUgPT09ICdkdXJhdGlvbnRpbWUnKSByZXR1cm4gJy0tLSBTZWxlY3QgZHVyYXRpb24gLS0tJztcclxuXHRcdFx0cmV0dXJuICctLS0gU2VsZWN0IHRpbWUgLS0tJztcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEJ1aWxkIHRva2Vucy9kZWZhdWx0IGZvciBhIHRpbWUtbGlrZSBzZWxlY3QgKHN0YXJ0L2VuZC9yYW5nZS9kdXJhdGlvbikuXHJcblx0XHQgKiAtIEFkZHMgYW4gZW1wdHktdmFsdWUgcGxhY2Vob2xkZXIgYXMgdGhlIGZpcnN0IG9wdGlvbiBvbmx5IHdoZW46XHJcblx0XHQgKiAgIOKAoiB0aW1lIHBpY2tlciBpcyBPRkYsIGFuZFxyXG5cdFx0ICogICDigKIgbm8gb3B0aW9uIGlzIHNlbGVjdGVkIGJ5IGRlZmF1bHQsIGFuZFxyXG5cdFx0ICogICDigKIgdGhlcmUgaXNuJ3QgYWxyZWFkeSBhbiBlbXB0eS12YWx1ZSBvcHRpb24uXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBidWlsZF90aW1lX3NlbGVjdF90b2tlbnMoZmllbGQsIG5hbWUpIHtcclxuXHRcdFx0bGV0IHRva2Vuc19zdHIgPSB0aGlzLm9wdGlvbl90b2tlbnMoZmllbGQpO1xyXG5cdFx0XHRsZXQgZGVmX3N0ciAgICA9IHRoaXMuZGVmYXVsdF9vcHRpb25fc3VmZml4KGZpZWxkLCB0b2tlbnNfc3RyKTtcclxuXHJcblx0XHRcdGlmICghdGhpcy5pc190aW1lc2xvdF9waWNrZXJfZW5hYmxlZCgpKSB7XHJcblx0XHRcdFx0Y29uc3Qgb3B0cyA9IEFycmF5LmlzQXJyYXkoZmllbGQub3B0aW9ucykgPyBmaWVsZC5vcHRpb25zIDogW107XHJcblxyXG5cdFx0XHRcdGNvbnN0IGhhc19zZWxlY3RlZF9kZWZhdWx0ID0gb3B0cy5zb21lKG8gPT5cclxuXHRcdFx0XHRcdG8gJiYgKG8uc2VsZWN0ZWQgPT09IHRydWUgfHwgby5zZWxlY3RlZCA9PT0gJ3RydWUnIHx8IG8uc2VsZWN0ZWQgPT09IDEgfHwgby5zZWxlY3RlZCA9PT0gJzEnKVxyXG5cdFx0XHRcdCk7XHJcblxyXG5cdFx0XHRcdGlmICghaGFzX3NlbGVjdGVkX2RlZmF1bHQpIHtcclxuXHRcdFx0XHRcdGNvbnN0IGhhc19lbXB0eV92YWx1ZV9vcHRpb24gPSBvcHRzLnNvbWUobyA9PlxyXG5cdFx0XHRcdFx0XHRvICYmIHR5cGVvZiBvLnZhbHVlICE9PSAndW5kZWZpbmVkJyAmJiBTdHJpbmcoby52YWx1ZSkudHJpbSgpID09PSAnJ1xyXG5cdFx0XHRcdFx0KTtcclxuXHJcblx0XHRcdFx0XHRpZiAoIWhhc19lbXB0eV92YWx1ZV9vcHRpb24pIHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgcGhUZXh0ICAgICA9IHRoaXMudGltZV9wbGFjZWhvbGRlcl9mb3IobmFtZSwgZmllbGQpO1xyXG5cdFx0XHRcdFx0XHRjb25zdCBwaFRva2VuU3RyID0gJ1wiJyArIGNvcmUuV1BCQ19CRkJfU2FuaXRpemUuZXNjYXBlX2Zvcl9zaG9ydGNvZGUocGhUZXh0ICsgJ0BAJykgKyAnXCInO1xyXG5cclxuXHRcdFx0XHRcdFx0Y29uc3Qgb3RoZXIgPSB0aGlzLm9wdGlvbl90b2tlbnMoZmllbGQpLnRyaW0oKTsgLy8gcmVjb21wdXRlLCB0cmltIGxlYWRpbmcgc3BhY2VcclxuXHRcdFx0XHRcdFx0dG9rZW5zX3N0ciAgPSAnICcgKyBwaFRva2VuU3RyICsgKG90aGVyID8gKCcgJyArIG90aGVyKSA6ICcnKTtcclxuXHJcblx0XHRcdFx0XHRcdC8vIEVuc3VyZSBmaXJzdCBvcHRpb24gKG91ciBwbGFjZWhvbGRlcikgYmVjb21lcyB0aGUgZGVmYXVsdCBpbXBsaWNpdGx5XHJcblx0XHRcdFx0XHRcdGRlZl9zdHIgPSAnJztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIHsgdG9rZW5zX3N0ciwgZGVmX3N0ciB9O1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBlbWl0X3RpbWVfc2VsZWN0KG5hbWUsIGZpZWxkLCByZXFfbWFyaywgaWRfb3B0LCBjbHNfb3B0cywgZW1pdF9sYWJlbF90aGVuKSB7XHJcblx0XHRcdGNvbnN0IHsgdG9rZW5zX3N0ciwgZGVmX3N0ciB9ID0gdGhpcy5idWlsZF90aW1lX3NlbGVjdF90b2tlbnMoZmllbGQsIG5hbWUpO1xyXG5cdFx0XHQvLyBOT1RFOiBObyBzaXplL3BoIHRva2VucyBoZXJlIHRvIG1pcnJvciByYW5nZXRpbWUgYmVoYXZpb3IgZXhhY3RseS5cclxuXHRcdFx0ZW1pdF9sYWJlbF90aGVuKGBbc2VsZWN0Ym94JHtyZXFfbWFya30gJHtuYW1lfSR7aWRfb3B0fSR7Y2xzX29wdHN9JHtkZWZfc3RyfSR7dG9rZW5zX3N0cn1dYCk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0gT3RoZXIgSGVscGVycyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gUmV0dXJuIGEgZmllbGQncyBkZWZhdWx0IHZhbHVlIChzdXBwb3J0cyBib3RoIGNhbWVsQ2FzZSBhbmQgc25ha2VfY2FzZSkuXHJcblx0XHRzdGF0aWMgZ2V0X2RlZmF1bHRfdmFsdWUoZmllbGQpIHtcclxuXHRcdFx0Y29uc3QgdiA9IGZpZWxkPy5kZWZhdWx0X3ZhbHVlID8/IGZpZWxkPy5kZWZhdWx0VmFsdWUgPz8gJyc7XHJcblx0XHRcdHJldHVybiAodiA9PSBudWxsKSA/ICcnIDogU3RyaW5nKCB2ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gRm9yIHRleHQtbGlrZSBmaWVsZHMsIHRoZSBkZWZhdWx0IGlzIGEgZmluYWwgcXVvdGVkIHRva2VuIGluIHRoZSBzaG9ydGNvZGUuXHJcblx0XHRzdGF0aWMgZGVmYXVsdF90ZXh0X3N1ZmZpeChmaWVsZCkge1xyXG5cdFx0XHRjb25zdCB2ID0gdGhpcy5nZXRfZGVmYXVsdF92YWx1ZSggZmllbGQgKTtcclxuXHRcdFx0aWYgKCAhdiApIHJldHVybiAnJztcclxuXHRcdFx0cmV0dXJuIGAgXCIke2NvcmUuV1BCQ19CRkJfU2FuaXRpemUuZXNjYXBlX2Zvcl9zaG9ydGNvZGUoIHYgKX1cImA7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIGNsYXNzX29wdGlvbnMoZmllbGQpIHtcclxuXHRcdFx0Y29uc3QgcmF3ID0gZmllbGQuY2xhc3MgfHwgZmllbGQuY2xhc3NOYW1lIHx8IGZpZWxkLmNzc2NsYXNzIHx8ICcnO1xyXG5cdFx0XHRjb25zdCBjbHMgPSBjb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2Nzc19jbGFzc2xpc3QoIFN0cmluZyggcmF3ICkgKTtcclxuXHRcdFx0aWYgKCAhY2xzICkgcmV0dXJuICcnO1xyXG5cdFx0XHRyZXR1cm4gY2xzXHJcblx0XHRcdFx0LnNwbGl0KCAvXFxzKy8gKVxyXG5cdFx0XHRcdC5maWx0ZXIoIEJvb2xlYW4gKVxyXG5cdFx0XHRcdC5tYXAoIChjKSA9PiBgIGNsYXNzOiR7Y29yZS5XUEJDX0JGQl9TYW5pdGl6ZS50b190b2tlbiggYyApfWAgKVxyXG5cdFx0XHRcdC5qb2luKCAnJyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBpZF9vcHRpb24oZmllbGQsIGN0eCkge1xyXG5cdFx0XHRjb25zdCByYXdfaWQgPSBmaWVsZC5odG1sX2lkIHx8IGZpZWxkLmlkX2F0dHI7XHJcblx0XHRcdGlmICggIXJhd19pZCApIHJldHVybiAnJztcclxuXHRcdFx0Y29uc3QgYmFzZSA9IGNvcmUuV1BCQ19CRkJfU2FuaXRpemUudG9fdG9rZW4oIHJhd19pZCApO1xyXG5cdFx0XHRpZiAoICFiYXNlICkgcmV0dXJuICcnO1xyXG5cdFx0XHRsZXQgdW5pcXVlID0gYmFzZSwgaSA9IDI7XHJcblx0XHRcdHdoaWxlICggY3R4LnVzZWRJZHMuaGFzKCB1bmlxdWUgKSApIHVuaXF1ZSA9IGAke2Jhc2V9XyR7aSsrfWA7XHJcblx0XHRcdGN0eC51c2VkSWRzLmFkZCggdW5pcXVlICk7XHJcblx0XHRcdHJldHVybiBgIGlkOiR7dW5pcXVlfWA7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIHBoX2F0dHIodikge1xyXG5cdFx0XHRpZiAoIHYgPT0gbnVsbCB8fCB2ID09PSAnJyApIHJldHVybiAnJztcclxuXHRcdFx0cmV0dXJuIGAgcGxhY2Vob2xkZXI6XCIke2NvcmUuV1BCQ19CRkJfU2FuaXRpemUuZXNjYXBlX2Zvcl9hdHRyX3F1b3RlZCggdiApfVwiYDtcclxuXHRcdH1cclxuXHJcblx0XHQvLyB0ZXh0LWxpa2Ugc2l6ZS9tYXhsZW5ndGggdG9rZW46IFwiNDAvMjU1XCIgKG9yIFwiNDAvXCIgb3IgXCIvMjU1XCIpXHJcblx0XHRzdGF0aWMgc2l6ZV9tYXhfdG9rZW4oZikge1xyXG5cdFx0XHRjb25zdCBzaXplID0gcGFyc2VJbnQoIGYuc2l6ZSwgMTAgKTtcclxuXHRcdFx0Y29uc3QgbWF4ICA9IHBhcnNlSW50KCBmLm1heGxlbmd0aCwgMTAgKTtcclxuXHRcdFx0aWYgKCBOdW1iZXIuaXNGaW5pdGUoIHNpemUgKSAmJiBOdW1iZXIuaXNGaW5pdGUoIG1heCApICkgcmV0dXJuIGAgJHtzaXplfS8ke21heH1gO1xyXG5cdFx0XHRpZiAoIE51bWJlci5pc0Zpbml0ZSggc2l6ZSApICkgcmV0dXJuIGAgJHtzaXplfS9gO1xyXG5cdFx0XHRpZiAoIE51bWJlci5pc0Zpbml0ZSggbWF4ICkgKSByZXR1cm4gYCAvJHttYXh9YDtcclxuXHRcdFx0cmV0dXJuICcnO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIHRleHRhcmVhIGNvbHMvcm93cyB0b2tlbjogXCI2MHg0XCIgKG9yIFwiNjB4XCIgb3IgXCJ4NFwiKVxyXG5cdFx0c3RhdGljIGNvbHNfcm93c190b2tlbihmKSB7XHJcblx0XHRcdGNvbnN0IGNvbHMgPSBwYXJzZUludCggZi5jb2xzLCAxMCApO1xyXG5cdFx0XHRjb25zdCByb3dzID0gcGFyc2VJbnQoIGYucm93cywgMTAgKTtcclxuXHRcdFx0aWYgKCBOdW1iZXIuaXNGaW5pdGUoIGNvbHMgKSAmJiBOdW1iZXIuaXNGaW5pdGUoIHJvd3MgKSApIHJldHVybiBgICR7Y29sc314JHtyb3dzfWA7XHJcblx0XHRcdGlmICggTnVtYmVyLmlzRmluaXRlKCBjb2xzICkgKSByZXR1cm4gYCAke2NvbHN9eGA7XHJcblx0XHRcdGlmICggTnVtYmVyLmlzRmluaXRlKCByb3dzICkgKSByZXR1cm4gYCB4JHtyb3dzfWA7XHJcblx0XHRcdHJldHVybiAnJztcclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgb3B0aW9uX3Rva2VucyhmaWVsZCkge1xyXG5cdFx0XHRjb25zdCBvcHRpb25zID0gQXJyYXkuaXNBcnJheSggZmllbGQub3B0aW9ucyApID8gZmllbGQub3B0aW9ucyA6IFtdO1xyXG5cdFx0XHRpZiAoIG9wdGlvbnMubGVuZ3RoID09PSAwICkgcmV0dXJuICcnO1xyXG5cdFx0XHRjb25zdCBwYXJ0cyA9IG9wdGlvbnMubWFwKCAobykgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IHRpdGxlID0gU3RyaW5nKCBvLmxhYmVsID8/IG8udmFsdWUgPz8gJycgKS50cmltKCk7XHJcblx0XHRcdFx0Y29uc3QgdmFsdWUgPSBTdHJpbmcoIG8udmFsdWUgPz8gby5sYWJlbCA/PyAnJyApLnRyaW0oKTtcclxuXHRcdFx0XHRyZXR1cm4gdGl0bGUgJiYgdmFsdWUgJiYgdGl0bGUgIT09IHZhbHVlXHJcblx0XHRcdFx0XHQ/IGBcIiR7Y29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5lc2NhcGVfZm9yX3Nob3J0Y29kZSggYCR7dGl0bGV9QEAke3ZhbHVlfWAgKX1cImBcclxuXHRcdFx0XHRcdDogYFwiJHtjb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY2FwZV9mb3Jfc2hvcnRjb2RlKCB0aXRsZSB8fCB2YWx1ZSApfVwiYDtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHRyZXR1cm4gJyAnICsgcGFydHMuam9pbiggJyAnICk7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIGRlZmF1bHRfb3B0aW9uX3N1ZmZpeChmaWVsZCwgdG9rZW5zKSB7XHJcblx0XHRcdGNvbnN0IG9wdGlvbnMgID0gQXJyYXkuaXNBcnJheSggZmllbGQub3B0aW9ucyApID8gZmllbGQub3B0aW9ucyA6IFtdO1xyXG5cdFx0XHRjb25zdCBzZWxlY3RlZCA9IG9wdGlvbnMuZmluZCggKG8pID0+IG8uc2VsZWN0ZWQgKTtcclxuXHRcdFx0Y29uc3QgZGVmX3ZhbCA9IHNlbGVjdGVkID8gKHNlbGVjdGVkLnZhbHVlID8/IHNlbGVjdGVkLmxhYmVsKSA6IChmaWVsZC5kZWZhdWx0X3ZhbHVlID8/IGZpZWxkLmRlZmF1bHRWYWx1ZSA/PyAnJyk7XHJcblx0XHRcdGlmICggIWRlZl92YWwgKSByZXR1cm4gJyc7XHJcblx0XHRcdHJldHVybiBgIGRlZmF1bHQ9XCIke2NvcmUuV1BCQ19CRkJfU2FuaXRpemUuZXNjYXBlX3ZhbHVlX2Zvcl9hdHRyKCBkZWZfdmFsICl9XCJgO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU0VMRUNUQk9YIC8gUkFESU8gLSBCdWlsZCB0aGUgZmluYWwgc2hvcnRjb2RlIGZvciBjaG9pY2UtYmFzZWQgZmllbGRzLlxyXG5cdFx0ICpcclxuXHRcdCAqIFJlc3BvbnNpYmlsaXRpZXM6XHJcblx0XHQgKiAgLSBEZWxlZ2F0ZXMgb3B0aW9uL2RlZmF1bHQgZW5jb2RpbmcgdG86XHJcblx0XHQgKiAgICAgIC0gV1BCQ19CRkJfRXhwb3J0ZXIub3B0aW9uX3Rva2VucyggZmllbGQgKVxyXG5cdFx0ICogICAgICAtIFdQQkNfQkZCX0V4cG9ydGVyLmRlZmF1bHRfb3B0aW9uX3N1ZmZpeCggZmllbGQsIHRva2VucyApXHJcblx0XHQgKiAgLSBGb3IgYHJhZGlvYDpcclxuXHRcdCAqICAgICAgLSBBTFdBWVMgYXBwZW5kcyBhIGJhcmUgYHVzZV9sYWJlbF9lbGVtZW50YCB0b2tlbi5cclxuXHRcdCAqICAtIEZvciBgc2VsZWN0Ym94YDpcclxuXHRcdCAqICAgICAgLSBBZGRzIGEgYmFyZSBgbXVsdGlwbGVgIHRva2VuIHdoZW4gYGZpZWxkLm11bHRpcGxlYCBpcyB0cnV0aHlcclxuXHRcdCAqICAgICAgICAodHJ1ZSwgXCJ0cnVlXCIsIDEsIFwiMVwiLCBcIm11bHRpcGxlXCIpIC0+IGBbc2VsZWN0Ym94IHNlcnZpY2VzIG11bHRpcGxlIFwiMVwiIFwiMlwiXWAuXHJcblx0XHQgKiAgICAgIC0gV2hlbiBzaW5nbGUtc2VsZWN0IEFORCB0aGVyZSBpcyBubyBgZGVmYXVsdD1cIi4uLlwiYCBhdHRyaWJ1dGUgQU5EXHJcblx0XHQgKiAgICAgICAgYSBub24tZW1wdHkgYGZpZWxkLnBsYWNlaG9sZGVyYCBpcyBwcmVzZW50LCBlbmNvZGVzIHRoZSBwbGFjZWhvbGRlclxyXG5cdFx0ICogICAgICAgIGFzIHRoZSBGSVJTVCBvcHRpb24gd2l0aCBlbXB0eSB2YWx1ZSB2aWEgdGhlIGBAQGAgc3ludGF4OlxyXG5cdFx0ICogICAgICAgICAgIHBsYWNlaG9sZGVyIFwiLS0tLSBTZWxlY3QgLS0tLVwiICAtPiAgYFwiLS0tLSBTZWxlY3QgLS0tLUBAXCJgXHJcblx0XHQgKiAgICAgICAgYW5kIGNsZWFycyBhbnkgZGVmYXVsdCBhdHRyaWJ1dGU6XHJcblx0XHQgKiAgICAgICAgICAgW3NlbGVjdGJveCogc2VydmljZXMgXCItLS0gU2VsZWN0IC0tLUBAXCIgXCJPcHRpb24gMVwiIFwiT3B0aW9uIDJcIl1cclxuXHRcdCAqICAgICAgLSBSZXNwZWN0cyBgZmllbGQudXNlX2xhYmVsX2VsZW1lbnRgIChhZGRzIGJhcmUgYHVzZV9sYWJlbF9lbGVtZW50YCB3aGVuIHRydWUpLlxyXG5cdFx0ICogIC0gRm9yIGJvdGgga2luZHM6XHJcblx0XHQgKiAgICAgIC0gSG9ub3JzIGBmaWVsZC5sYWJlbF9maXJzdGAgYnkgYXBwZW5kaW5nIGBsYWJlbF9maXJzdDpcIjFcImAgd2hlbiB0cnV0aHkuXHJcblx0XHQgKiAgICAgIC0gS2VlcHMgdGhlIHJlcXVpcmVkIHN0YXIsIGlkIGFuZCBjc3NjbGFzcyB0b2tlbnMgaW4gdGhlIGNhbm9uaWNhbCBvcmRlci5cclxuXHRcdCAqXHJcblx0XHQgKiBGaW5hbCBzaG9ydGNvZGUgbGF5b3V0IChvcmRlciBpcyBpbXBvcnRhbnQpOlxyXG5cdFx0ICogICBba2luZCByZXEgbmFtZSBpZCBjbHMgdXNlX2xhYmVsX2VsZW1lbnQgbXVsdGlwbGUgZGVmYXVsdCB0b2tlbnMgbGFiZWxfZmlyc3RdXHJcblx0XHQgKlxyXG5cdFx0ICogQGpEb2NcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBraW5kXHJcblx0XHQgKiAgIFNob3J0Y29kZSBraW5kOyB0eXBpY2FsbHkgXCJyYWRpb1wiIG9yIFwic2VsZWN0Ym94XCIuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHJlcV9tYXJrXHJcblx0XHQgKiAgIFJlcXVpcmVkIG1hcmtlciB1c2VkIGJ5IENvbnRhY3QgRm9ybSA3IHN0eWxlIHNob3J0Y29kZXM6XHJcblx0XHQgKiAgIGVpdGhlciBcIlwiIChub3QgcmVxdWlyZWQpIG9yIFwiKlwiIChyZXF1aXJlZCkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG5hbWVcclxuXHRcdCAqICAgU2FuaXRpemVkIGZpZWxkIG5hbWUgYXMgZXhwb3J0ZWQgaW50byB0aGUgc2hvcnRjb2RlLCBlLmcuIFwic2VydmljZXNcIi5cclxuXHRcdCAqICAgTXVzdCBhbHJlYWR5IGJlIGNvbXB1dGVkIHZpYSBXUEJDX0JGQl9FeHBvcnRlci5jb21wdXRlX25hbWUoKS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZmllbGRcclxuXHRcdCAqICAgTm9ybWFsaXplZCBmaWVsZCBkYXRhIG9iamVjdCBhcyBzdG9yZWQgaW4gdGhlIEJ1aWxkZXIgc3RydWN0dXJlLiBDb21tb24ga2V5czpcclxuXHRcdCAqICAgICAtIHR5cGUgICAgICAgICAgIHtzdHJpbmd9ICAgRmllbGQgdHlwZSwgZS5nLiBcInJhZGlvXCIgfCBcInNlbGVjdFwiLlxyXG5cdFx0ICogICAgIC0gb3B0aW9ucyAgICAgICAge0FycmF5fSAgICBPcHRpb24gb2JqZWN0czogeyBsYWJlbCwgdmFsdWUsIHNlbGVjdGVkIH0uXHJcblx0XHQgKiAgICAgLSBwbGFjZWhvbGRlciAgICB7c3RyaW5nfSAgIFBsYWNlaG9sZGVyIHRleHQgKHNpbmdsZS1zZWxlY3Qgb25seSkuXHJcblx0XHQgKiAgICAgLSBtdWx0aXBsZSAgICAgICB7Ym9vbGVhbnxzdHJpbmd8bnVtYmVyfSAgRW5hYmxlcyBtdWx0aS1zZWxlY3Qgd2hlbiB0cnV0aHkuXHJcblx0XHQgKiAgICAgLSB1c2VfbGFiZWxfZWxlbWVudCB7Ym9vbGVhbn0gIFJlcXVlc3QgYmFyZSBgdXNlX2xhYmVsX2VsZW1lbnRgIHRva2VuIChub24tcmFkaW8pLlxyXG5cdFx0ICogICAgIC0gbGFiZWxfZmlyc3QgICAge2Jvb2xlYW59ICBJZiB0cnVlLCBhcHBlbmRzIGBsYWJlbF9maXJzdDpcIjFcImAgdG9rZW4uXHJcblx0XHQgKiAgICAgLSBkZWZhdWx0X3ZhbHVlICB7c3RyaW5nfSAgIE9wdGlvbmFsIGRlZmF1bHQgdmFsdWUgKHVzZWQgYnkgZGVmYXVsdF9vcHRpb25fc3VmZml4KCkpLlxyXG5cdFx0ICogICAgIC0gaHRtbF9pZCAvIGNzc2NsYXNzIC8gY2xhc3MgLyBjbGFzc05hbWUgIHtzdHJpbmd9ICBVc2VkIHVwc3RyZWFtIGluIGlkX29wdC9jbHNfb3B0cy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gaWRfb3B0XHJcblx0XHQgKiAgIE9wdGlvbmFsIGlkIHRva2VuIGJ1aWx0IGJ5IFdQQkNfQkZCX0V4cG9ydGVyLmlkX29wdGlvbihmaWVsZCwgY3R4KSxcclxuXHRcdCAqICAgZS5nLiBcIiBpZDpteV9pZFwiIG9yIGVtcHR5IHN0cmluZy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gY2xzX29wdHNcclxuXHRcdCAqICAgQ2xhc3MgdG9rZW5zIGJ1aWx0IGJ5IFdQQkNfQkZCX0V4cG9ydGVyLmNsYXNzX29wdGlvbnMoZmllbGQpLFxyXG5cdFx0ICogICBlLmcuIFwiIGNsYXNzOm15X2NsYXNzIGNsYXNzOm90aGVyXCIuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdCAqICAgQ29tcGxldGUgc2hvcnRjb2RlIGJvZHkgZm9yIHRoZSBjaG9pY2UgZmllbGQsIGZvciBleGFtcGxlOlxyXG5cdFx0ICogICAgIFwiW3JhZGlvKiBzZXJ2aWNlcyB1c2VfbGFiZWxfZWxlbWVudCBcXFwiQVxcXCIgXFxcIkJcXFwiXVwiXHJcblx0XHQgKiAgICAgXCJbc2VsZWN0Ym94IHNlcnZpY2VzIG11bHRpcGxlIFxcXCIxXFxcIiBcXFwiMlxcXCIgXFxcIjNcXFwiXVwiXHJcblx0XHQgKiAgICAgXCJbc2VsZWN0Ym94KiBzZXJ2aWNlcyBcXFwiLS0tIFNlbGVjdCAtLS1AQFxcXCIgXFxcIk9wdGlvbiAxXFxcIiBcXFwiT3B0aW9uIDJcXFwiXVwiXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBjaG9pY2VfdGFnKGtpbmQsIHJlcV9tYXJrLCBuYW1lLCBmaWVsZCwgaWRfb3B0LCBjbHNfb3B0cykge1xyXG5cdFx0XHQvLyBTdGFydCBmcm9tIHRoZSByYXcgb3B0aW9ucy9kZWZhdWx0IGFzIGJlZm9yZS5cclxuXHRcdFx0bGV0IHRva2VucyA9IFdQQkNfQkZCX0V4cG9ydGVyLm9wdGlvbl90b2tlbnMoIGZpZWxkICk7XHJcblx0XHRcdGxldCBkZWYgICAgPSBXUEJDX0JGQl9FeHBvcnRlci5kZWZhdWx0X29wdGlvbl9zdWZmaXgoIGZpZWxkLCB0b2tlbnMgKTtcclxuXHJcblx0XHRcdC8vIEZvciBSQURJTyB3ZSBtdXN0IEFMV0FZUyBpbmNsdWRlIGEgYmFyZSBgdXNlX2xhYmVsX2VsZW1lbnRgIHRva2VuIChubyB2YWx1ZS9xdW90ZXMpLlxyXG5cdFx0XHQvLyBGb3Igb3RoZXIga2luZHMsIGtlZXAgYmFja3dhcmQgY29tcGF0aWJpbGl0eTogaW5jbHVkZSBvbmx5IGlmIGV4cGxpY2l0bHkgc2V0LlxyXG5cdFx0XHRsZXQgdWxlID0gJyc7XHJcblx0XHRcdGlmICgga2luZCA9PT0gJ3JhZGlvJyApIHtcclxuXHRcdFx0XHR1bGUgPSAnIHVzZV9sYWJlbF9lbGVtZW50JztcclxuXHRcdFx0fSBlbHNlIGlmICggZmllbGQgJiYgZmllbGQudXNlX2xhYmVsX2VsZW1lbnQgKSB7XHJcblx0XHRcdFx0dWxlID0gJyB1c2VfbGFiZWxfZWxlbWVudCc7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFNFTEVDVEJPWC1zcGVjaWZpYyBleHRyYXM6XHJcblx0XHRcdC8vICAtIFwibXVsdGlwbGVcIiBmbGFnXHJcblx0XHRcdC8vICAtIHBsYWNlaG9sZGVyIGV4cG9ydGVkIGFzIEZJUlNUIE9QVElPTiB3aGVuIHNpbmdsZS1zZWxlY3QgYW5kIG5vIGRlZmF1bHQuXHJcblx0XHRcdGxldCBtdWx0aXBsZV9mbGFnID0gJyc7XHJcblxyXG5cdFx0XHRpZiAoIGtpbmQgPT09ICdzZWxlY3Rib3gnICYmIGZpZWxkICkge1xyXG5cdFx0XHRcdGNvbnN0IG11bHRpcGxlID1cclxuXHRcdFx0XHRcdGZpZWxkLm11bHRpcGxlID09PSB0cnVlICAgfHxcclxuXHRcdFx0XHRcdGZpZWxkLm11bHRpcGxlID09PSAndHJ1ZScgfHxcclxuXHRcdFx0XHRcdGZpZWxkLm11bHRpcGxlID09PSAxICAgICAgfHxcclxuXHRcdFx0XHRcdGZpZWxkLm11bHRpcGxlID09PSAnMScgICAgfHxcclxuXHRcdFx0XHRcdGZpZWxkLm11bHRpcGxlID09PSAnbXVsdGlwbGUnO1xyXG5cclxuXHRcdFx0XHRpZiAoIG11bHRpcGxlICkge1xyXG5cdFx0XHRcdFx0Ly8gRXhwb3J0IGJhcmUgXCJtdWx0aXBsZVwiIHRva2VuIGFzIGluOiBbc2VsZWN0Ym94IHNlcnZpY2VzIG11bHRpcGxlIFwiMVwiIFwiMlwiIFwiM1wiXS5cclxuXHRcdFx0XHRcdG11bHRpcGxlX2ZsYWcgPSAnIG11bHRpcGxlJztcclxuXHRcdFx0XHR9IGVsc2UgaWYgKCAhZGVmICkge1xyXG5cdFx0XHRcdFx0Ly8gU2luZ2xlLXNlbGVjdCArIE5PIGRlZmF1bHQgc2VsZWN0ZWQ6XHJcblx0XHRcdFx0XHQvLyBleHBvcnQgcGxhY2Vob2xkZXIgYXMgdGhlIEZJUlNUIE9QVElPTiB3aXRoIGVtcHR5IHZhbHVlOlxyXG5cdFx0XHRcdFx0Ly8gICBbc2VsZWN0Ym94KiBzZXJ2aWNlcyBcIi0tLSBTZWxlY3QgLS0tQEBcIiBcIk9wdGlvbiAxXCIgXCJPcHRpb24gMlwiXVxyXG5cdFx0XHRcdFx0Y29uc3QgcmF3UGggPSBmaWVsZC5wbGFjZWhvbGRlcjtcclxuXHRcdFx0XHRcdGNvbnN0IHBoICAgID0gKHR5cGVvZiByYXdQaCA9PT0gJ3N0cmluZycpID8gcmF3UGgudHJpbSgpIDogJyc7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCBwaCApIHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgUyAgICAgID0gY29yZS5XUEJDX0JGQl9TYW5pdGl6ZTtcclxuXHRcdFx0XHRcdFx0Y29uc3QgZXNjX3NjID0gKFMgJiYgUy5lc2NhcGVfZm9yX3Nob3J0Y29kZSkgPyBTLmVzY2FwZV9mb3Jfc2hvcnRjb2RlIDogKHYpID0+IFN0cmluZyggdiApO1xyXG5cclxuXHRcdFx0XHRcdFx0Y29uc3QgcGhUb2tlbiA9IGBcIiR7ZXNjX3NjKCBwaCArICdAQCcgKX1cImA7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoIHRva2VucyAmJiB0b2tlbnMubGVuZ3RoICkge1xyXG5cdFx0XHRcdFx0XHRcdC8vIHRva2VucyBhbHJlYWR5IHN0YXJ0cyB3aXRoIGEgbGVhZGluZyBzcGFjZS5cclxuXHRcdFx0XHRcdFx0XHR0b2tlbnMgPSAnICcgKyBwaFRva2VuICsgdG9rZW5zO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdHRva2VucyA9ICcgJyArIHBoVG9rZW47XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdC8vIEVuc3VyZSB0aGVyZSBpcyBzdGlsbCBOTyBkZWZhdWx0IGF0dHJpYnV0ZSB3aGVuIHVzaW5nIHBsYWNlaG9sZGVyLWFzLW9wdGlvbi5cclxuXHRcdFx0XHRcdFx0ZGVmID0gJyc7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBPcHRpb25hbDogbGFiZWxfZmlyc3Qgc3RheXMgYXMgcXVvdGVkIGZsYWcgd2hlbiBleHBsaWNpdGx5IHJlcXVlc3RlZC5cclxuXHRcdFx0Y29uc3QgbGYgPSAoZmllbGQgJiYgZmllbGQubGFiZWxfZmlyc3QpID8gJyBsYWJlbF9maXJzdDpcIjFcIicgOiAnJztcclxuXHJcblx0XHRcdC8vIElNUE9SVEFOVCBPUkRFUiAocGVyIHJlcXVlc3QpOlxyXG5cdFx0XHQvLyBba2luZCByZXEgbmFtZSBpZCBjbHMgdXNlX2xhYmVsX2VsZW1lbnQgbXVsdGlwbGUgZGVmYXVsdCB0b2tlbnMgbGFiZWxfZmlyc3RdXHJcblx0XHRcdC8vIGkuZS4gYHVzZV9sYWJlbF9lbGVtZW50YCAoYW5kIHNlbGVjdCBleHRyYXMpIGNvbWUgQkVGT1JFIGRlZmF1bHQvdG9rZW5zLlxyXG5cdFx0XHRyZXR1cm4gYFske2tpbmR9JHtyZXFfbWFya30gJHtuYW1lfSR7aWRfb3B0fSR7Y2xzX29wdHN9JHt1bGV9JHttdWx0aXBsZV9mbGFnfSR7ZGVmfSR7dG9rZW5zfSR7bGZ9XWA7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIGNvbXB1dGVfbmFtZSh0eXBlLCBmaWVsZCkge1xyXG5cdFx0XHQvLyBOYW1lcyBhcmUgZnVsbHkgdmFsaWRhdGVkIHdoZW4gdGhlIGZpZWxkIGlzIGFkZGVkIHRvIHRoZSBjYW52YXMuXHJcblx0XHRcdC8vIFRoZSBleHBvcnRlciBtdXN0IHRoZXJlZm9yZSBwcmVzZXJ2ZSB0aGVtIChhcGFydCBmcm9tIGlkZW1wb3RlbnQgc2FuaXRpemF0aW9uKSwgb3RoZXJ3aXNlIGV4aXN0aW5nIGZvcm1zIGNhbiBicmVhay5cclxuXHRcdFx0Y29uc3QgU2FuaXQgPSBjb3JlLldQQkNfQkZCX1Nhbml0aXplO1xyXG5cclxuXHRcdFx0Y29uc3QgcmF3ID0gKGZpZWxkICYmIChmaWVsZC5uYW1lIHx8IGZpZWxkLmlkKSkgPyBTdHJpbmcoZmllbGQubmFtZSB8fCBmaWVsZC5pZCkgOiBTdHJpbmcodHlwZSB8fCAnZmllbGQnKTtcclxuXHJcblx0XHRcdC8vIElkZW1wb3RlbnQgc2FuaXRpemF0aW9uIG9ubHkg4oCTIG5vIGF1dG8tcHJlZml4aW5nIG9yIHJlbmFtaW5nLlxyXG5cdFx0XHRjb25zdCBuYW1lID0gU2FuaXQuc2FuaXRpemVfaHRtbF9uYW1lKCByYXcgKTtcclxuXHJcblx0XHRcdC8vIEluIHRoZSB1bmxpa2VseSBjYXNlIHNhbml0aXphdGlvbiByZXR1cm5zIGFuIGVtcHR5IHN0cmluZywgZmFsbCBiYWNrIHRvIGEgc2FuaXRpemVkIHR5cGUtYmFzZWQgdG9rZW4uXHJcblx0XHRcdHJldHVybiBuYW1lIHx8IFNhbml0LnNhbml0aXplX2h0bWxfbmFtZSggU3RyaW5nKHR5cGUgfHwgJ2ZpZWxkJykgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlZ2lzdGVyIGEgcGVyLWZpZWxkIGV4cG9ydGVyLlxyXG5cdFx0ICpcclxuXHRcdCAqIFRoaXMgaXMgdGhlIE9OTFkgcGxhY2Ugd2hlcmUgZmllbGQtc3BlY2lmaWMgc2hvcnRjb2RlIG1hcmt1cCBzaG91bGQgbGl2ZS5cclxuXHRcdCAqIENvcmUgc3RheXMgZ2VuZXJpYzsgcGFja3MgcHJvdmlkZSB0aW55IHBsdWdpbnMsIGZvciBleGFtcGxlOlxyXG5cdFx0ICpcclxuXHRcdCAqICAgV1BCQ19CRkJfRXhwb3J0ZXIucmVnaXN0ZXIoICd0ZXh0JywgKGZpZWxkLCBlbWl0LCBleHRyYXMpID0+IHsgLi4uIH0gKTtcclxuXHRcdCAqXHJcblx0XHQgKiBAakRvY1xyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgIEZpZWxkIHR5cGUga2V5LCBlLmcuICdzdGVwc190aW1lbGluZSdcclxuXHRcdCAqIEBwYXJhbSB7KGZpZWxkOmFueSwgZW1pdDooY29kZTpzdHJpbmcpPT52b2lkLCBleHRyYXM/Ontpbz86YW55LGNmZz86YW55LG9uY2U/OmFueSxjdHg/OmFueSxjb3JlPzphbnl9KT0+dm9pZH1cclxuXHRcdCAqICAgICBmblxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyByZWdpc3Rlcih0eXBlLCBmbikge1xyXG5cdFx0XHRpZiAoICEgdHlwZSB8fCB0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicgKSB7IHJldHVybjsgfVxyXG5cdFx0XHRpZiAoICEgdGhpcy5fX3JlZ2lzdHJ5ICkgeyB0aGlzLl9fcmVnaXN0cnkgPSBuZXcgTWFwKCk7IH1cclxuXHRcdFx0dGhpcy5fX3JlZ2lzdHJ5LnNldCggU3RyaW5nKCB0eXBlICkudG9Mb3dlckNhc2UoKSwgZm4gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFVucmVnaXN0ZXIgYSBwcmV2aW91c2x5IHJlZ2lzdGVyZWQgZXhwb3J0ZXIuXHJcblx0XHQgKlxyXG5cdFx0ICogQGpEb2NcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHVucmVnaXN0ZXIodHlwZSkge1xyXG5cdFx0XHRpZiAoICEgdGhpcy5fX3JlZ2lzdHJ5IHx8ICEgdHlwZSApIHsgcmV0dXJuOyB9XHJcblx0XHRcdHRoaXMuX19yZWdpc3RyeS5kZWxldGUoIFN0cmluZyggdHlwZSApLnRvTG93ZXJDYXNlKCkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENoZWNrIGlmIGFuIGV4cG9ydGVyIGV4aXN0cyBmb3IgYSBnaXZlbiBmaWVsZCB0eXBlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBqRG9jXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdHlwZVxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBoYXNfZXhwb3J0ZXIodHlwZSkge1xyXG5cdFx0XHRyZXR1cm4gISEoIHRoaXMuX19yZWdpc3RyeSAmJiB0aGlzLl9fcmVnaXN0cnkuaGFzKCBTdHJpbmcoIHR5cGUgKS50b0xvd2VyQ2FzZSgpICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJ1biBhIHJlZ2lzdGVyZWQgZXhwb3J0ZXIgZm9yIGEgZmllbGQsIGlmIHByZXNlbnQuXHJcblx0XHQgKiBSZXR1cm5zIHRydWUgaWYgYSByZWdpc3RlcmVkIGV4cG9ydGVyIGhhbmRsZWQgaXQuXHJcblx0XHQgKlxyXG5cdFx0ICogQGpEb2NcclxuXHRcdCAqIEBwYXJhbSB7YW55fSBmaWVsZFxyXG5cdFx0ICogQHBhcmFtIHt7b3BlbjpGdW5jdGlvbixjbG9zZTpGdW5jdGlvbixwdXNoOkZ1bmN0aW9uLGJsYW5rOkZ1bmN0aW9ufX0gaW9cclxuXHRcdCAqIEBwYXJhbSB7YW55fSBjZmdcclxuXHRcdCAqIEBwYXJhbSB7YW55fSBvbmNlXHJcblx0XHQgKiBAcGFyYW0ge2FueX0gY3R4XHJcblx0XHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHJ1bl9yZWdpc3RlcmVkX2V4cG9ydGVyKGZpZWxkLCBpbywgY2ZnLCBvbmNlLCBjdHgpIHtcclxuXHRcdFx0aWYgKCAhIGZpZWxkIHx8ICEgZmllbGQudHlwZSB8fCAhIHRoaXMuX19yZWdpc3RyeSApIHsgcmV0dXJuIGZhbHNlOyB9XHJcblx0XHRcdGNvbnN0IGtleSA9IFN0cmluZyggZmllbGQudHlwZSApLnRvTG93ZXJDYXNlKCk7XHJcblx0XHRcdGNvbnN0IGZuICA9IHRoaXMuX19yZWdpc3RyeS5nZXQoIGtleSApO1xyXG5cdFx0XHRpZiAoIHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJyApIHsgcmV0dXJuIGZhbHNlOyB9XHJcblxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdC8vIE1pbmltYWwsIGNvbnNpc3RlbnQgZW1pdCgpIGJyaWRnZSBpbnRvIG91ciBsaW5lIGJ1ZmZlcjpcclxuXHRcdFx0XHRjb25zdCBlbWl0ID0gKGNvZGUpID0+IHsgaWYgKCB0eXBlb2YgY29kZSA9PT0gJ3N0cmluZycgKSB7IGlvLnB1c2goIGNvZGUgKTsgfSB9O1xyXG5cdFx0XHRcdGZuKCBmaWVsZCwgZW1pdCwgeyBpbywgY2ZnLCBvbmNlLCBjdHgsIGNvcmUgfSApO1xyXG5cdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHR9IGNhdGNoIChlKSB7XHJcblx0XHRcdFx0X3dwYmM/LmRldj8uZXJyb3I/LiggJ1dQQkNfQkZCX0V4cG9ydGVyLnJ1bl9yZWdpc3RlcmVkX2V4cG9ydGVyJywgZSApO1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG5cdC8vIGV4cG9zZSBnbG9iYWxseSBmb3IgcGFja3MgKGlmIG5vdCBhbHJlYWR5KS5cclxuXHR3aW5kb3cuV1BCQ19CRkJfRXhwb3J0ZXIgPSB3aW5kb3cuV1BCQ19CRkJfRXhwb3J0ZXIgfHwgV1BCQ19CRkJfRXhwb3J0ZXI7XHJcblx0d3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUoICd3cGJjOmJmYjpleHBvcnRlci1yZWFkeScsIHt9ICk7XHJcblxyXG5cdC8vIEluaXRpYWxpemUgZGVmYXVsdCBza2lwIGxpc3Q7IGFsbG93IGEgZ2xvYmFsIG92ZXJyaWRlIGFycmF5IGJlZm9yZSBleHBvcnQgcnVucy5cclxuXHRXUEJDX0JGQl9FeHBvcnRlci5zZXRfc2tpcF9hdHRycyggd2luZG93LldQQkNfQkZCX0VYUE9SVF9TS0lQX0FUVFJTIHx8IHdwYmNfZXhwb3J0X3NraXBfYXR0cnNfZGVmYXVsdCApO1xyXG5cclxuXHQvLyA9PSBcIkNvbnRlbnQgb2YgYm9va2luZyBmaWVsZHMgZGF0YVwiIEV4cG9ydGVyID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG5cdC8vIOKAkyBwYWNrLWV4dGVuc2libGUgZ2VuZXJhdG9yIGZvciBcIkNvbnRlbnQgb2YgYm9va2luZyBmaWVsZHMgZGF0YVwiID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0Ly8gPT0gUHJvZHVjZXMgbWFya3VwIGxpa2U6ICBcIjxkaXYgY2xhc3M9XFxcInN0YW5kYXJkLWNvbnRlbnQtZm9ybVxcXCI+PGI+VGl0bGU8L2I+OiA8Zj5bc2hvcnRjb2RlXTwvZj48YnI+IC4uLiA8L2Rpdj5cIlxyXG5cdC8vID09IFBhY2tzIGNhbiBvdmVycmlkZSBwZXIgdHlwZSB2aWE6IFdQQkNfQkZCX0NvbnRlbnRFeHBvcnRlci5yZWdpc3RlcignY2FsZW5kYXInLCAoZmllbGQsIGVtaXQsIGN0eCk9PnsuLi59KVxyXG5cdC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHRjbGFzcyBXUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIge1xyXG5cclxuXHRcdHN0YXRpYyByZWdpc3Rlcih0eXBlLCBmbikge1xyXG5cdFx0XHRpZiAoICF0eXBlIHx8IHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJyApIHJldHVybjtcclxuXHRcdFx0aWYgKCAhdGhpcy5fX3JlZ2lzdHJ5ICkgdGhpcy5fX3JlZ2lzdHJ5ID0gbmV3IE1hcCgpO1xyXG5cdFx0XHR0aGlzLl9fcmVnaXN0cnkuc2V0KCBTdHJpbmcoIHR5cGUgKS50b0xvd2VyQ2FzZSgpLCBmbiApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyB1bnJlZ2lzdGVyKHR5cGUpIHtcclxuXHRcdFx0aWYgKCAhdGhpcy5fX3JlZ2lzdHJ5IHx8ICF0eXBlICkgcmV0dXJuO1xyXG5cdFx0XHR0aGlzLl9fcmVnaXN0cnkuZGVsZXRlKCBTdHJpbmcoIHR5cGUgKS50b0xvd2VyQ2FzZSgpICk7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIGhhc19leHBvcnRlcih0eXBlKSB7XHJcblx0XHRcdHJldHVybiAhISh0aGlzLl9fcmVnaXN0cnkgJiYgdGhpcy5fX3JlZ2lzdHJ5LmhhcyggU3RyaW5nKCB0eXBlICkudG9Mb3dlckNhc2UoKSApKTtcclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgcnVuX3JlZ2lzdGVyZWRfZXhwb3J0ZXIoZmllbGQsIGVtaXQsIGN0eCkge1xyXG5cdFx0XHRpZiAoICFmaWVsZCB8fCAhZmllbGQudHlwZSB8fCAhdGhpcy5fX3JlZ2lzdHJ5ICkgcmV0dXJuIGZhbHNlO1xyXG5cdFx0XHRjb25zdCBrZXkgPSBTdHJpbmcoIGZpZWxkLnR5cGUgKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0XHRjb25zdCBmbiAgPSB0aGlzLl9fcmVnaXN0cnkuZ2V0KCBrZXkgKTtcclxuXHRcdFx0aWYgKCB0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicgKSByZXR1cm4gZmFsc2U7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0Zm4oIGZpZWxkLCBlbWl0LCBjdHggfHwge30gKTtcclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0X3dwYmM/LmRldj8uZXJyb3I/LiggJ1dQQkNfQkZCX0NvbnRlbnRFeHBvcnRlci5ydW5fcmVnaXN0ZXJlZF9leHBvcnRlcicsIGUgKTtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyA9PT0gTkVXOiBzaGFyZWQgbGluZSBmb3JtYXR0ZXIgZm9yIFwiQ29udGVudCBvZiBib29raW5nIGZpZWxkcyBkYXRhXCIgPT09XHJcblx0XHRzdGF0aWMgZW1pdF9saW5lX2JvbGRfZmllbGQoZW1pdCwgbGFiZWwsIHRva2VuLCBjZmcpIHtcclxuXHRcdFx0Y29uc3QgUyAgICAgICAgID0gY29yZS5XUEJDX0JGQl9TYW5pdGl6ZTtcclxuXHRcdFx0Y29uc3Qgc2VwICAgICAgID0gKGNmZyAmJiB0eXBlb2YgY2ZnLnNlcCA9PT0gJ3N0cmluZycpID8gY2ZnLnNlcCA6ICc6ICc7XHJcblx0XHRcdGNvbnN0IGFkZExhYmVscyA9IChjZmcgJiYgJ2FkZExhYmVscycgaW4gY2ZnKSA/ICEhY2ZnLmFkZExhYmVscyA6IHRydWU7XHJcblxyXG5cdFx0XHRjb25zdCB0aXRsZSA9IChhZGRMYWJlbHMgJiYgbGFiZWwpID8gYDxiPiR7Uy5lc2NhcGVfaHRtbChsYWJlbCl9PC9iPiR7c2VwfWAgOiAnJztcclxuXHJcblx0XHRcdGVtaXQoYCR7dGl0bGV9PGY+WyR7dG9rZW59XTwvZj48YnI+YCk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBFeHBvcnQgYWRhcHRlZCBzdHJ1Y3R1cmUgdG8g4oCcY29udGVudCBvZiBib29raW5nIGZpZWxkcyBkYXRh4oCdLlxyXG5cdFx0ICogQHBhcmFtIHt7cGFnZXM6QXJyYXl9fSBhZGFwdGVkICByZXN1bHQgb2YgYWRhcHRfYnVpbGRlcl9zdHJ1Y3R1cmVfdG9fZXhwb3J0ZXIoKVxyXG5cdFx0ICogQHBhcmFtIHt7bmV3bGluZT86c3RyaW5nLCBhZGRMYWJlbHM/OmJvb2xlYW4sIHNlcD86c3RyaW5nfX0gb3B0aW9uc1xyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGV4cG9ydF9jb250ZW50KGFkYXB0ZWQsIG9wdGlvbnMgPSB7fSkge1xyXG5cclxuXHRcdFx0Y29uc3QgY2ZnICAgPSB7IG5ld2xpbmU6ICdcXG4nLCBhZGRMYWJlbHM6IHRydWUsIHNlcDogJzogJywgaW5kZW50OiAnXFx0JywgLi4ub3B0aW9ucyB9O1xyXG5cdFx0XHRjb25zdCBJTkQgICA9ICh0eXBlb2YgY2ZnLmluZGVudCA9PT0gJ3N0cmluZycpID8gY2ZnLmluZGVudCA6ICdcXHQnO1xyXG5cdFx0XHRsZXQgZGVwdGggICA9IDA7XHJcblx0XHRcdGNvbnN0IGxpbmVzID0gW107XHJcblxyXG5cdFx0XHRjb25zdCBwdXNoICA9IChzID0gJycpID0+IGxpbmVzLnB1c2goIElORC5yZXBlYXQoIGRlcHRoICkgKyBTdHJpbmcoIHMgKSApO1xyXG5cdFx0XHRjb25zdCBvcGVuICA9IChzID0gJycpID0+IHsgcHVzaCggcyApOyBkZXB0aCsrOyB9O1xyXG5cdFx0XHRjb25zdCBjbG9zZSA9IChzID0gJycpID0+IHsgZGVwdGggPSBNYXRoLm1heCggMCwgZGVwdGggLSAxICk7IHB1c2goIHMgKTsgfTtcclxuXHJcblx0XHRcdGNvbnN0IGVtaXQgPSAocykgPT4ge1xyXG5cdFx0XHRcdGlmICggdHlwZW9mIHMgIT09ICdzdHJpbmcnICkgeyByZXR1cm47IH1cclxuXHRcdFx0XHRTdHJpbmcoIHMgKS5zcGxpdCggL1xccj9cXG4vICkuZm9yRWFjaCggKGxpbmUpID0+IHB1c2goIGxpbmUgKSApO1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0aWYgKCAhYWRhcHRlZCB8fCAhQXJyYXkuaXNBcnJheSggYWRhcHRlZC5wYWdlcyApICkgcmV0dXJuICcnO1xyXG5cclxuXHRcdFx0Y29uc3Qgc2tpcFR5cGVzID0gbmV3IFNldCggWyAnY2FwdGNoYScsICdzdWJtaXQnLCAnZGl2aWRlcicsICd3aXphcmRfbmF2JywgJ2Nvc3RfY29ycmVjdGlvbnMnIF0gKTtcclxuXHJcblx0XHRcdGNvbnN0IGZhbGxiYWNrTGluZSA9IChmaWVsZCkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IHR5cGUgID0gU3RyaW5nKCBmaWVsZC50eXBlIHx8ICcnICkudG9Mb3dlckNhc2UoKTtcclxuXHRcdFx0XHRjb25zdCBuYW1lICA9IFdQQkNfQkZCX0V4cG9ydGVyLmNvbXB1dGVfbmFtZSggdHlwZSwgZmllbGQgKTtcclxuXHRcdFx0XHRjb25zdCBsYWJlbCA9ICh0eXBlb2YgZmllbGQubGFiZWwgPT09ICdzdHJpbmcnICYmIGZpZWxkLmxhYmVsLnRyaW0oKSkgPyBmaWVsZC5sYWJlbC50cmltKCkgOiBuYW1lO1xyXG5cdFx0XHRcdGlmICggIW5hbWUgKSByZXR1cm47XHJcblx0XHRcdFx0V1BCQ19CRkJfQ29udGVudEV4cG9ydGVyLmVtaXRfbGluZV9ib2xkX2ZpZWxkKCBlbWl0LCBsYWJlbCwgbmFtZSwgY2ZnICk7XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHQvLyBQZXItdHlwZSBzZW5zaWJsZSBkZWZhdWx0cyAoY2FuIGJlIG92ZXJyaWRkZW4gYnkgcGFja3MgdmlhIHJlZ2lzdGVyKCkpXHJcblx0XHRcdGNvbnN0IGRlZmF1bHRDb250ZW50Rm9yID0gKGZpZWxkKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgdHlwZSA9IFN0cmluZyggZmllbGQudHlwZSB8fCAnJyApLnRvTG93ZXJDYXNlKCk7XHJcblx0XHRcdFx0aWYgKCBza2lwVHlwZXMuaGFzKCB0eXBlICkgKSByZXR1cm47XHJcblx0XHRcdFx0Ly8gU3BlY2lhbCBjYXNlcyBvdXQgb2YgdGhlIGJveDpcclxuXHRcdFx0XHRpZiAoIHR5cGUgPT09ICdjYWxlbmRhcicgKSB7XHJcblx0XHRcdFx0XHRjb25zdCBsYWJlbCA9ICh0eXBlb2YgZmllbGQubGFiZWwgPT09ICdzdHJpbmcnICYmIGZpZWxkLmxhYmVsLnRyaW0oKSkgPyBmaWVsZC5sYWJlbC50cmltKCkgOiAnRGF0ZXMnO1xyXG5cdFx0XHRcdFx0V1BCQ19CRkJfQ29udGVudEV4cG9ydGVyLmVtaXRfbGluZV9ib2xkX2ZpZWxkKCBlbWl0LCBsYWJlbCwgJ2RhdGVzJywgY2ZnICk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdC8vIHRpbWUtbGlrZSByZXNlcnZlZCBuYW1lcyAtPiBrZWVwIHBsYWNlaG9sZGVyIHRva2VuIGVxdWFsIHRvIG5hbWVcclxuXHRcdFx0XHRjb25zdCByZXNlcnZlZCA9IFN0cmluZyggZmllbGQubmFtZSB8fCBmaWVsZC5pZCB8fCAnJyApLnRvTG93ZXJDYXNlKCk7XHJcblx0XHRcdFx0aWYgKCBbICdyYW5nZXRpbWUnLCAnc3RhcnR0aW1lJywgJ2VuZHRpbWUnLCAnZHVyYXRpb250aW1lJyBdLmluY2x1ZGVzKCByZXNlcnZlZCApICkge1xyXG5cdFx0XHRcdFx0Y29uc3QgbGFiZWwgPSAodHlwZW9mIGZpZWxkLmxhYmVsID09PSAnc3RyaW5nJyAmJiBmaWVsZC5sYWJlbC50cmltKCkpID8gZmllbGQubGFiZWwudHJpbSgpIDogcmVzZXJ2ZWQ7XHJcblx0XHRcdFx0XHQvLyBLZWVwIHlvdXIgc3BlY2lhbCB0b2tlbiBmb3IgZHVyYXRpb24gdGltZSBpbiBjb250ZW50OiBbZHVyYXRpb250aW1lX3ZhbF1cclxuXHRcdFx0XHRcdGNvbnN0IHRva2VuID0gKHJlc2VydmVkID09PSAnZHVyYXRpb250aW1lJykgPyAnZHVyYXRpb250aW1lX3ZhbCcgOiByZXNlcnZlZDtcclxuXHRcdFx0XHRcdFdQQkNfQkZCX0NvbnRlbnRFeHBvcnRlci5lbWl0X2xpbmVfYm9sZF9maWVsZCggZW1pdCwgbGFiZWwsIHRva2VuLCBjZmcgKTtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Ly8gRmFsbGJhY2sgKHRleHQvZW1haWwvdGVsL251bWJlci90ZXh0YXJlYS9zZWxlY3QvY2hlY2tib3gvcmFkaW8gZXRjLilcclxuXHRcdFx0XHRmYWxsYmFja0xpbmUoIGZpZWxkICk7XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHQvLyBXYWxrIHBhZ2VzL3NlY3Rpb25zL2NvbHVtbnMvZmllbGRzIChzYW1lIG9yZGVyIGFzIGZvcm0pXHJcblx0XHRcdGNvbnN0IHdhbGtTZWN0aW9uICA9IChzZWMpID0+IHtcclxuXHRcdFx0XHQoc2VjLmNvbHVtbnMgfHwgW10pLmZvckVhY2goIChjb2wpID0+IHtcclxuXHRcdFx0XHRcdChjb2wuZmllbGRzIHx8IFtdKS5mb3JFYWNoKCAoZikgPT4gcHJvY2Vzc0ZpZWxkKCBmICkgKTtcclxuXHRcdFx0XHRcdChjb2wuc2VjdGlvbnMgfHwgW10pLmZvckVhY2goIChzKSA9PiB3YWxrU2VjdGlvbiggcyApICk7XHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9O1xyXG5cdFx0XHRjb25zdCBwcm9jZXNzSXRlbSAgPSAoaXRlbSkgPT4ge1xyXG5cdFx0XHRcdGlmICggIWl0ZW0gKSByZXR1cm47XHJcblx0XHRcdFx0aWYgKCBpdGVtLmtpbmQgPT09ICdmaWVsZCcgKSBwcm9jZXNzRmllbGQoIGl0ZW0uZGF0YSApO1xyXG5cdFx0XHRcdGlmICggaXRlbS5raW5kID09PSAnc2VjdGlvbicgKSB3YWxrU2VjdGlvbiggaXRlbS5kYXRhICk7XHJcblx0XHRcdH07XHJcblx0XHRcdGNvbnN0IHByb2Nlc3NGaWVsZCA9IChmaWVsZCkgPT4ge1xyXG5cdFx0XHRcdGlmICggIWZpZWxkICkgcmV0dXJuO1xyXG5cdFx0XHRcdC8vIGFsbG93IHBhY2tzIHRvIG92ZXJyaWRlOlxyXG5cdFx0XHRcdGlmICggV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyLnJ1bl9yZWdpc3RlcmVkX2V4cG9ydGVyKCBmaWVsZCwgZW1pdCwgeyBjZmcsIGNvcmUgfSApICkgcmV0dXJuO1xyXG5cdFx0XHRcdGRlZmF1bHRDb250ZW50Rm9yKCBmaWVsZCApO1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0Ly8gV3JhcHBlciBmaXJzdCAtPiBpbm5lciBsaW5lcyB3aWxsIGJlIFRBQi1pbmRlbnRlZFxyXG5cdFx0XHRvcGVuKCBgPGRpdiBjbGFzcz1cInN0YW5kYXJkLWNvbnRlbnQtZm9ybVwiPmAgKTtcclxuXHRcdFx0YWRhcHRlZC5wYWdlcy5mb3JFYWNoKCAocGFnZSkgPT4gKHBhZ2UuaXRlbXMgfHwgW10pLmZvckVhY2goIHByb2Nlc3NJdGVtICkgKTtcclxuXHRcdFx0Y2xvc2UoIGA8L2Rpdj5gICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gbGluZXMuam9pbiggY2ZnLm5ld2xpbmUgKTtcclxuXHRcdH1cclxuXHJcblx0fVxyXG5cclxuXHQvLyBleHBvc2UgKyByZWFkeSBldmVudCBmb3IgcGFja3MgdG8gcmVnaXN0ZXIgdGhlaXIgY29udGVudCBleHBvcnRlcnMuXHJcblx0d2luZG93LldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciA9IHdpbmRvdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIgfHwgV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyO1xyXG5cdHdwYmNfYmZiX19kaXNwYXRjaF9ldmVudF9zYWZlKCAnd3BiYzpiZmI6Y29udGVudC1leHBvcnRlci1yZWFkeScsIHt9ICk7XHJcbn0pKCk7XHJcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQSxDQUFDLFlBQVk7RUFDWixZQUFZOztFQUVaLE1BQU1BLElBQUksR0FBR0MsTUFBTSxDQUFDQyxhQUFhLElBQUksQ0FBQyxDQUFDOztFQUV2QztFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7RUFDQyxNQUFNQyw4QkFBOEIsR0FBRyxDQUFFLHVCQUF1QixDQUFFOztFQUVsRTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0MsNEJBQTRCQSxDQUFDQyxJQUFJLEVBQUVDLGVBQWUsRUFBRTtJQUM1RCxJQUFJLENBQUNELElBQUksSUFBSSxDQUFDQyxlQUFlLEVBQUVDLE1BQU0sRUFBRSxPQUFPRixJQUFJO0lBQ2xELElBQUlHLEdB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O1VBQ3JDLENBQUNBLEdBQUcsQ0FBQytCLE1BQU0sSUFBSSxFQUFFLEVBQUVVLE9BQU8sQ0FBR1QsQ0FBQyxJQUFLK0wsWUFBWSxDQUFFL0wsQ0FBRSxDQUFFLENBQUM7VUFDdEQsQ0FBQ2hDLEdBQUcsQ0FBQ21DLFFBQVEsSUFBSSxFQUFFLEVBQUVNLE9BQU8sQ0FBR2xELENBQUMsSUFBS3VPLFdBQVcsQ0FBRXZPLENBQUUsQ0FBRSxDQUFDO1FBQ3hELENBQUUsQ0FBQztNQUNKLENBQUM7TUFDRCxNQUFNeU8sV0FBVyxHQUFLdEwsSUFBSSxJQUFLO1FBQzlCLElBQUssQ0FBQ0EsSUFBSSxFQUFHO1FBQ2IsSUFBS0EsSUFBSSxDQUFDQyxJQUFJLEtBQUssT0FBTyxFQUFHb0wsWUFBWSxDQUFFckwsSUFBSSxDQUFDUixJQUFLLENBQUM7UUFDdEQsSUFBS1EsSUFBSSxDQUFDQyxJQUFJLEtBQUssU0FBUyxFQUFHbUwsV0FBVyxDQUFFcEwsSUFBSSxDQUFDUixJQUFLLENBQUM7TUFDeEQsQ0FBQztNQUNELE1BQU02TCxZQUFZLEdBQUkvRyxLQUFLLElBQUs7UUFDL0IsSUFBSyxDQUFDQSxLQUFLLEVBQUc7UUFDZDtRQUNBLElBQUt4Qix3QkFBd0IsQ0FBQ3lDLHVCQUF1QixDQUFFakIsS0FBSyxFQUFFdUIsSUFBSSxFQUFFO1VBQUU3RSxHQUFHO1VBQUV6SDtRQUFLLENBQUUsQ0FBQyxFQUFHO1FBQ3RGMFIsaUJBQWlCLENBQUUzRyxLQUFNLENBQUM7TUFDM0IsQ0FBQzs7TUFFRDtNQUNBN0MsSUFBSSxDQUFFLHFDQUFzQyxDQUFDO01BQzdDVixPQUFPLENBQUN4QyxLQUFLLENBQUN3QixPQUFPLENBQUdGLElBQUksSUFBSyxDQUFDQSxJQUFJLENBQUNyQixLQUFLLElBQUksRUFBRSxFQUFFdUIsT0FBTyxDQUFFdUwsV0FBWSxDQUFFLENBQUM7TUFDNUU1SixLQUFLLENBQUUsUUFBUyxDQUFDO01BRWpCLE9BQU9ILEtBQUssQ0FBQzlFLElBQUksQ0FBRXVFLEdBQUcsQ0FBQ0MsT0FBUSxDQUFDO0lBQ2pDO0VBRUQ7O0VBRUE7RUFDQXpILE1BQU0sQ0FBQ3NKLHdCQUF3QixHQUFHdEosTUFBTSxDQUFDc0osd0JBQXdCLElBQUlBLHdCQUF3QjtFQUM3RjRILDZCQUE2QixDQUFFLGlDQUFpQyxFQUFFLENBQUMsQ0FBRSxDQUFDO0FBQ3ZFLENBQUMsRUFBRSxDQUFDIiwiaWdub3JlTGlzdCI6W119
