"use strict";

// =================================================================================================
// == File  /_out/builder-exporter.js ==  Time point: 2025-08-21 17:39
// =================================================================================================

async function wpbc_copy_to_clipboard(text) {
  // Try the modern API first (requires HTTPS/localhost and a user gesture).
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {
    /* fall through to legacy */
  }

  // Legacy fallback: temporary textarea + execCommand('copy').
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy'); // returns true/false.
    document.body.removeChild(ta);
    return !!ok;
  } catch (_) {
    return false;
  }
}
(function () {
  "use strict";

  const core = window.WPBC_BFB_Core || {};

  // =================================================================================================
  // adapter: builder (array-of-pages) > exporter shape { pages: [ { items:[ {kind,data} ] } ] }
  // =================================================================================================
  function adapt_builder_structure_to_exporter(structure) {
    if (!Array.isArray(structure)) return {
      pages: []
    };
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
    const walk_section = sec => ({
      id: sec?.id,
      columns: (sec?.columns || []).map(col => {
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
          fields,
          sections
        };
      })
    });
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

  // =================================================================================================
  // helper: compute effective flex-basis values that respect inter-column gap
  // =================================================================================================
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

  // =================================================================================================
  // exporter – booking form builder > advanced form (shortcode) exporter with wizard wrapper
  // =================================================================================================
  class WPBC_BFB_Exporter {
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
      const cfg = {
        newline: '\n',
        addLabels: true,
        gapPercent: 3,
        ...options
      };
      const IND = '  ';
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
      const ctx = {
        usedIds: new Set()
      };
      open(`<div class="wpbc_wizard__border_container">`);

      // one-per-form guards (calendar is not gated here)
      const once = {
        captcha: 0,
        country: 0,
        coupon: 0,
        cost_corrections: 0,
        submit: 0
      };
      adapted.pages.forEach((page, page_index) => {
        const is_first = page_index === 0;
        const is_last = page_index === adapted.pages.length - 1;
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
            }, cfg);
            blank();
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
            blank();
          }
        });
        push(`<hr>`);
        open(`<r>`);
        open(`<c style="justify-content: flex-end;">`);
        if (!is_first) push(`<a class="wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_${step_num - 1}">Back</a>&nbsp;&nbsp;&nbsp;`);
        if (!is_last) push(`<a class="wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_${step_num + 1}">Next</a>`);else if (once.submit === 0) {
          push(`[submit "Send"]`);
          once.submit++;
        }
        close(`</c>`);
        close(`</r>`);
        close(`</div>`);
      });
      close(`</div>`);
      return lines.join(cfg.newline);
    }

    // -------------------------------- layout --------------------------------
    static render_section(section, io, cfg) {
      const {
        open,
        close
      } = io;
      open(`<r>`);
      const cols = Array.isArray(section.columns) && section.columns.length ? section.columns : [{
        width: '100%',
        fields: [],
        sections: []
      }];
      const bases = compute_effective_bases(cols, cfg.gapPercent);
      const esc_attr = core.WPBC_BFB_Sanitize.escape_html;
      cols.forEach((col, idx) => {
        let style_attr = '';
        if (col.style && typeof col.style === 'string' && col.style.trim()) {
          style_attr = ` style="${esc_attr(col.style.trim())}"`;
        } else {
          const eff = bases[idx];
          style_attr = ` style="flex-basis: ${Number.isFinite(eff) ? eff.toFixed(4) : 100}%;"`;
        }
        open(`<c${style_attr}>`);
        (col.fields || []).forEach(node => WPBC_BFB_Exporter.render_field_node(node, io, cfg, {
          captcha: 1,
          country: 1,
          coupon: 1,
          cost_corrections: 1,
          submit: 1
        }, {
          usedIds: new Set()
        }));
        (col.sections || []).forEach(nested => WPBC_BFB_Exporter.render_section(nested, io, cfg));
        close(`</c>`);
      });
      close(`</r>`);
    }

    // -------------------------------- fields --------------------------------
    static render_field_node(field, io, cfg, once, ctx) {
      const {
        push
      } = io;
      if (!field || !field.type) return;
      const type = String(field.type).toLowerCase();
      const name = WPBC_BFB_Exporter.compute_name(type, field);
      const is_req = field.required === true || field.required === 'true' || field.required === 1 || field.required === '1' || field.required === 'required';
      const req_mark = is_req ? '*' : '';
      const id_opt = WPBC_BFB_Exporter.id_option(field, ctx);
      const cls_opts = WPBC_BFB_Exporter.class_options(field);
      const ph_attr = WPBC_BFB_Exporter.ph_attr(field.placeholder);
      const emit_label_then = body => {
        const lbl = (field.label ?? '').toString().trim();
        if (!lbl || !cfg.addLabels) {
          push(body);
        } else {
          push(`<l>${core.WPBC_BFB_Sanitize.escape_html(lbl)}</l>`);
          push(`<br>${body}`);
        }
        if (field.help) {
          push(`<div class="wpbc_field_description">${core.WPBC_BFB_Sanitize.escape_html(String(field.help))}</div>`);
        }
      };

      // special blocks
      if (type === 'calendar') {
        push(`[calendar]`);
        return;
      }
      if (type === 'captcha') {
        if (once.captcha++) {
          push(`<!-- Skipped extra [captcha] (allowed once) -->`);
        } else {
          push(`[captcha]`);
        }
        return;
      }
      if (type === 'country') {
        if (once.country++) {
          push(`<!-- Skipped extra [country] (allowed once) -->`);
          return;
        }
        const cc = (field.defaultValue || '').toString().trim();
        push(cc ? `[country "${core.WPBC_BFB_Sanitize.escape_for_shortcode(cc)}"]` : `[country]`);
        return;
      }
      if (type === 'coupon') {
        if (once.coupon++) {
          push(`<!-- Skipped extra [coupon discount] (allowed once) -->`);
        } else {
          // name is required for coupon by the PHP engine; "discount" is a sensible default
          push(`[coupon discount]`);
        }
        return;
      }
      if (type === 'cost_corrections') {
        if (once.cost_corrections++) {
          push(`<!-- Skipped extra [cost_corrections] (allowed once) -->`);
        } else {
          push(`[cost_corrections]`);
        }
        return;
      }
      if (type === 'submit') {
        const label = field.label ? `"${core.WPBC_BFB_Sanitize.escape_for_shortcode(field.label)}"` : `"Send"`;
        push(`[submit ${label}]`);
        once.submit++;
        return;
      }

      // reserved names
      const reserved_name = (field.name || field.id || '').toLowerCase();
      if (reserved_name === 'rangetime') {
        const tokens = WPBC_BFB_Exporter.option_tokens(field);
        const def = WPBC_BFB_Exporter.default_option_suffix(field, tokens);
        emit_label_then(`[selectbox rangetime${id_opt}${cls_opts}${tokens}${def}]`);
        return;
      }
      if (reserved_name === 'durationtime') {
        // explicit support
        const tokens = WPBC_BFB_Exporter.option_tokens(field);
        const def = WPBC_BFB_Exporter.default_option_suffix(field, tokens);
        emit_label_then(`[selectbox durationtime${id_opt}${cls_opts}${tokens}${def}]`);
        return;
      }
      if (reserved_name === 'starttime' || reserved_name === 'endtime') {
        emit_label_then(`[selectbox${req_mark} ${reserved_name}${WPBC_BFB_Exporter.size_max_token(field)}${id_opt}${cls_opts}${ph_attr}]`);
        return;
      }

      // standard inputs
      switch (type) {
        case 'text':
          emit_label_then(`[text${req_mark} ${name}${WPBC_BFB_Exporter.size_max_token(field)}${id_opt}${cls_opts}${ph_attr}]`);
          return;
        case 'email':
          emit_label_then(`[email${req_mark} ${name}${WPBC_BFB_Exporter.size_max_token(field)}${id_opt}${cls_opts}${ph_attr}]`);
          return;
        case 'time':
          emit_label_then(`[time${req_mark} ${name}${WPBC_BFB_Exporter.size_max_token(field)}${id_opt}${cls_opts}${ph_attr}]`);
          return;
        case 'tel':
        case 'phone':
          {
            const extra = ` class:wpdev-validates-as-phone`;
            emit_label_then(`[text${req_mark} ${name}${WPBC_BFB_Exporter.size_max_token(field)}${id_opt}${cls_opts}${extra}${ph_attr}]`);
            return;
          }
        case 'number':
          {
            const extra = ` class:wpdev-validates-as-number`;
            emit_label_then(`[text${req_mark} ${name}${WPBC_BFB_Exporter.size_max_token(field)}${id_opt}${cls_opts}${extra}${ph_attr}]`);
            return;
          }
        case 'textarea':
          emit_label_then(`[textarea${req_mark} ${name}${WPBC_BFB_Exporter.cols_rows_token(field)}${id_opt}${cls_opts}${ph_attr}]`);
          return;
        case 'radio':
          emit_label_then(WPBC_BFB_Exporter.choice_tag('radio', req_mark, name, field, id_opt, cls_opts));
          return;
        case 'checkbox':
        case 'checkboxes':
          WPBC_BFB_Exporter.emit_checkbox_singles(field, name, req_mark, id_opt, cls_opts, io, cfg);
          return;
        case 'select':
        case 'selectbox':
          emit_label_then(WPBC_BFB_Exporter.choice_tag('selectbox', req_mark, name, field, id_opt, cls_opts));
          return;
        default:
          push(`<!-- TODO map field type "${type}" name="${name}" -->`);
      }
    }

    // -------------------------------- checkbox helper --------------------------------
    static emit_checkbox_singles(field, base_name, req_mark, id_opt, cls_opts, io, cfg) {
      const {
        push
      } = io;
      const lbl = (field.label ?? '').toString().trim();
      if (lbl && cfg.addLabels) {
        push(`<l>${core.WPBC_BFB_Sanitize.escape_html(lbl)}</l>`);
      }
      const tokens = WPBC_BFB_Exporter.option_tokens(field);
      if (!tokens.trim()) {
        const single_label = field.option_label || field.placeholder || lbl || 'I agree';
        push(`[checkbox${req_mark} ${base_name}${id_opt}${cls_opts} "${core.WPBC_BFB_Sanitize.escape_for_shortcode(single_label)}"]`);
      } else {
        const def = WPBC_BFB_Exporter.default_option_suffix(field, tokens);
        push(`[checkbox${req_mark} ${base_name}${id_opt}${cls_opts}${tokens}${def}]`);
      }
      if (field.help) {
        push(`<div class="wpbc_field_description">${core.WPBC_BFB_Sanitize.escape_html(String(field.help))}</div>`);
      }
    }

    // -------------------------------- helpers --------------------------------

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
      const def_val = selected ? selected.value ?? selected.label : field.defaultValue ?? '';
      if (!def_val) return '';
      return ` default:${core.WPBC_BFB_Sanitize.to_token(def_val)}`;
    }
    static choice_tag(kind, req_mark, name, field, id_opt, cls_opts) {
      const tokens = WPBC_BFB_Exporter.option_tokens(field);
      const def = WPBC_BFB_Exporter.default_option_suffix(field, tokens);
      const ule = field.use_label_element ? ` use_label_element:"1"` : '';
      const lf = field.label_first ? ` label_first:"1"` : '';
      return `[${kind}${req_mark} ${name}${id_opt}${cls_opts}${tokens}${def}${ule}${lf}]`;
    }
    static compute_name(type, field) {
      const raw = field.name || field.id || '';
      let name = core.WPBC_BFB_Sanitize.sanitize_html_name(raw);
      const kind = type === 'select' || type === 'selectbox' ? 'selectbox' : type === 'phone' || type === 'tel' ? 'tel' : type;
      if (name.toLowerCase() === kind.toLowerCase()) {
        name = `f_${name}`;
      }
      return name;
    }
  }

  // =================================================================================================
  // live export integration helpers (no page reload on copy)
  // =================================================================================================
  function wpbc_bfb__get_current_structure() {
    if (window.wpbc_bfb && typeof window.wpbc_bfb.get_structure === 'function') {
      return window.wpbc_bfb.get_structure(); // LIVE UI > JSON
    }
    console.error('WPBC_BFB: builder instance not found.');
    return [];
  }
  function acquire_parser() {
    if (window.wpbc_shortcode_parser) {
      return window.wpbc_shortcode_parser;
    }
    if (!window.WPBC_Form_Shortcode_Parser) {
      return null;
    }
    window.WPBC_COUNTRIES = window.WPBC_COUNTRIES || {
      US: 'United States',
      GB: 'United Kingdom',
      FR: 'France',
      ES: 'Spain'
    };
    const booking_type = window._wpbc_builder?.current_booking_type ?? window.wpbc_bfb?.current_booking_type ?? 1;
    try {
      window.wpbc_shortcode_parser = new WPBC_Form_Shortcode_Parser({
        current_booking_type: String(booking_type),
        countries_list: window.WPBC_COUNTRIES,
        current_edit_booking: window._wpbc_builder?.current_edit_booking || null,
        posted_data: {}
      });
      return window.wpbc_shortcode_parser;
    } catch (_e) {
      return null;
    }
  }
  function wpbc_bfb__export_to_advanced_form(structure) {
    if (!structure) {
      structure = wpbc_bfb__get_current_structure();
    }
    const adapted = adapt_builder_structure_to_exporter(structure);
    const output = WPBC_BFB_Exporter.export_form(adapted, {
      addLabels: true,
      gapPercent: 3
    });
    let box = document.getElementById('wpbc_bfb__advanced_form_output');
    let pv = document.getElementById('wpbc_bfb__advanced_form_preview');
    if (!box) {
      const save_btn = document.getElementById('wpbc_bfb__save_btn');
      const wrap = document.createElement('div');
      wrap.style.marginTop = '14px';
      const h = document.createElement('h4');
      h.textContent = 'Advanced Form (export)';
      h.style.margin = '0 0 6px';
      box = document.createElement('textarea');
      box.id = 'wpbc_bfb__advanced_form_output';
      box.style.width = '100%';
      box.style.minHeight = '240px';
      box.style.fontFamily = 'monospace';
      box.style.fontSize = '12px';
      box.readOnly = false;
      const copy_btn = document.createElement('button');
      copy_btn.type = 'button';
      copy_btn.className = 'button';
      copy_btn.textContent = 'Copy to Clipboard';
      copy_btn.style.marginTop = '8px';
      copy_btn.addEventListener('click', async e => {
        e.preventDefault();
        const ok = await wpbc_copy_to_clipboard(box.value);
        if (ok) {
          copy_btn.textContent = 'Copied!';
        } else {
          try {
            box.focus();
            box.select();
          } catch (_) {}
          copy_btn.textContent = 'Press Ctrl/Cmd+C to copy';
        }
        setTimeout(() => copy_btn.textContent = 'Copy to Clipboard', 1500);
      });
      const pv_label = document.createElement('div');
      pv_label.textContent = 'Live preview:';
      pv_label.style.margin = '12px 0 4px';
      pv = document.createElement('div');
      pv.id = 'wpbc_bfb__advanced_form_preview';
      pv.className = 'wpbc_bfb__advanced_form_preview';
      pv.style.minHeight = '60px';
      pv.style.border = '1px solid #e5e7eb';
      pv.style.padding = '8px';
      pv.style.background = '#fff';
      wrap.appendChild(h);
      wrap.appendChild(box);
      wrap.appendChild(copy_btn);
      wrap.appendChild(pv_label);
      wrap.appendChild(pv);
      if (save_btn && save_btn.parentNode) {
        save_btn.parentNode.appendChild(wrap);
      } else {
        document.body.appendChild(wrap);
      }
    } else if (!pv) {
      pv = document.createElement('div');
      pv.id = 'wpbc_bfb__advanced_form_preview';
      pv.className = 'wpbc_bfb__advanced_form_preview';
      pv.style.minHeight = '60px';
      pv.style.border = '1px solid #e5e7eb';
      pv.style.padding = '8px';
      pv.style.background = '#fff';
      box.insertAdjacentElement('afterend', pv);
    }
    box.value = output;
    try {
      box.dispatchEvent(new Event('input', {
        bubbles: true
      }));
    } catch (_) {}
    try {
      const parser = acquire_parser();
      if (pv && parser?.form_elements) {
        pv.innerHTML = parser.form_elements(box.value, true) || '<em>Nothing to preview.</em>';
      }
    } catch (_e) {}
  }
  (function add_export_button() {
    const save_btn = document.getElementById('wpbc_bfb__save_btn');
    if (!save_btn || document.getElementById('wpbc_bfb__export_btn')) {
      return;
    }
    const btn = document.createElement('button');
    btn.type = 'button'; // never submit.
    btn.id = 'wpbc_bfb__export_btn';
    btn.className = 'button';
    btn.style.marginLeft = '8px';
    btn.textContent = 'Export to Advanced Form';
    btn.addEventListener('click', e => {
      e.preventDefault();
      const b = window.wpbc_bfb;
      let structure;
      if (b && typeof b.get_structure === 'function') {
        structure = b.get_structure();
        try {
          console.log(JSON.stringify(structure, null, 2));
        } catch (_) {}
        try {
          if (window.WPBC_BFB_Events) {
            b.bus?.emit?.(window.WPBC_BFB_Events.STRUCTURE_CHANGE, {
              structure
            });
          }
          document.dispatchEvent(new CustomEvent('wpbc:bfb:structure:change', {
            detail: {
              structure
            },
            bubbles: true
          }));
        } catch (_) {}
        try {
          b.load_saved_structure(structure, {
            deferIfTyping: false
          });
        } catch (_) {}
      }
      wpbc_bfb__export_to_advanced_form(structure);
    });
    save_btn.parentNode?.insertBefore(btn, save_btn.nextSibling);
  })();
  document.addEventListener('wpbc:bfb:structure:change', () => {
    const box = document.getElementById('wpbc_bfb__advanced_form_output');
    if (box) {
      wpbc_bfb__export_to_advanced_form(wpbc_bfb__get_current_structure());
    }
  });
})();
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9idWlsZGVyLWV4cG9ydGVyLmpzIiwibmFtZXMiOlsid3BiY19jb3B5X3RvX2NsaXBib2FyZCIsInRleHQiLCJ3aW5kb3ciLCJpc1NlY3VyZUNvbnRleHQiLCJuYXZpZ2F0b3IiLCJjbGlwYm9hcmQiLCJ3cml0ZVRleHQiLCJfIiwidGEiLCJkb2N1bWVudCIsImNyZWF0ZUVsZW1lbnQiLCJ2YWx1ZSIsInNldEF0dHJpYnV0ZSIsInN0eWxlIiwicG9zaXRpb24iLCJ0b3AiLCJvcGFjaXR5IiwiYm9keSIsImFwcGVuZENoaWxkIiwiZm9jdXMiLCJzZWxlY3QiLCJvayIsImV4ZWNDb21tYW5kIiwicmVtb3ZlQ2hpbGQiLCJjb3JlIiwiV1BCQ19CRkJfQ29yZSIsImFkYXB0X2J1aWxkZXJfc3RydWN0dXJlX3RvX2V4cG9ydGVyIiwic3RydWN0dXJlIiwiQXJyYXkiLCJpc0FycmF5IiwicGFnZXMiLCJub3JtYWxpemVfb3B0aW9ucyIsIm9wdHMiLCJtYXAiLCJvIiwibGFiZWwiLCJzZWxlY3RlZCIsIlN0cmluZyIsIndhbGtfc2VjdGlvbiIsInNlYyIsImlkIiwiY29sdW1ucyIsImNvbCIsIml0ZW1zIiwiZmllbGRzIiwiZiIsInR5cGUiLCJkYXRhIiwic2VjdGlvbnMiLCJzIiwiZmlsdGVyIiwiaXQiLCJvcHRpb25zIiwid2lkdGgiLCJwYWdlIiwiY29udGVudCIsImZvckVhY2giLCJpdGVtIiwicHVzaCIsImtpbmQiLCJjb21wdXRlX2VmZmVjdGl2ZV9iYXNlcyIsImdhcF9wZXJjZW50IiwibiIsImxlbmd0aCIsInJhdyIsInciLCJ0cmltIiwicCIsImVuZHNXaXRoIiwicGFyc2VGbG9hdCIsIk5hTiIsIk51bWJlciIsImlzRmluaXRlIiwic3VtX3JhdyIsInJlZHVjZSIsImEiLCJiIiwiZ3AiLCJ0b3RhbF9nYXBzIiwiTWF0aCIsIm1heCIsImF2YWlsYWJsZSIsInNjYWxlX3JhdGlvIiwiV1BCQ19CRkJfRXhwb3J0ZXIiLCJleHBvcnRfZm9ybSIsImFkYXB0ZWQiLCJjZmciLCJuZXdsaW5lIiwiYWRkTGFiZWxzIiwiZ2FwUGVyY2VudCIsIklORCIsImRlcHRoIiwibGluZXMiLCJyZXBlYXQiLCJvcGVuIiwiY2xvc2UiLCJibGFuayIsImN0eCIsInVzZWRJZHMiLCJTZXQiLCJvbmNlIiwiY2FwdGNoYSIsImNvdW50cnkiLCJjb3Vwb24iLCJjb3N0X2NvcnJlY3Rpb25zIiwic3VibWl0IiwicGFnZV9pbmRleCIsImlzX2ZpcnN0IiwiaXNfbGFzdCIsInN0ZXBfbnVtIiwiaGlkZGVuX2NsYXNzIiwiaGlkZGVuX3N0eWxlIiwicmVuZGVyX3NlY3Rpb24iLCJyZW5kZXJfZmllbGRfbm9kZSIsImpvaW4iLCJzZWN0aW9uIiwiaW8iLCJjb2xzIiwiYmFzZXMiLCJlc2NfYXR0ciIsIldQQkNfQkZCX1Nhbml0aXplIiwiZXNjYXBlX2h0bWwiLCJpZHgiLCJzdHlsZV9hdHRyIiwiZWZmIiwidG9GaXhlZCIsIm5vZGUiLCJuZXN0ZWQiLCJmaWVsZCIsInRvTG93ZXJDYXNlIiwibmFtZSIsImNvbXB1dGVfbmFtZSIsImlzX3JlcSIsInJlcXVpcmVkIiwicmVxX21hcmsiLCJpZF9vcHQiLCJpZF9vcHRpb24iLCJjbHNfb3B0cyIsImNsYXNzX29wdGlvbnMiLCJwaF9hdHRyIiwicGxhY2Vob2xkZXIiLCJlbWl0X2xhYmVsX3RoZW4iLCJsYmwiLCJ0b1N0cmluZyIsImhlbHAiLCJjYyIsImRlZmF1bHRWYWx1ZSIsImVzY2FwZV9mb3Jfc2hvcnRjb2RlIiwicmVzZXJ2ZWRfbmFtZSIsInRva2VucyIsIm9wdGlvbl90b2tlbnMiLCJkZWYiLCJkZWZhdWx0X29wdGlvbl9zdWZmaXgiLCJzaXplX21heF90b2tlbiIsImV4dHJhIiwiY29sc19yb3dzX3Rva2VuIiwiY2hvaWNlX3RhZyIsImVtaXRfY2hlY2tib3hfc2luZ2xlcyIsImJhc2VfbmFtZSIsInNpbmdsZV9sYWJlbCIsIm9wdGlvbl9sYWJlbCIsImNsYXNzIiwiY2xhc3NOYW1lIiwiY3NzY2xhc3MiLCJjbHMiLCJzYW5pdGl6ZV9jc3NfY2xhc3NsaXN0Iiwic3BsaXQiLCJCb29sZWFuIiwiYyIsInRvX3Rva2VuIiwicmF3X2lkIiwiaHRtbF9pZCIsImlkX2F0dHIiLCJiYXNlIiwidW5pcXVlIiwiaSIsImhhcyIsImFkZCIsInYiLCJlc2NhcGVfZm9yX2F0dHJfcXVvdGVkIiwic2l6ZSIsInBhcnNlSW50IiwibWF4bGVuZ3RoIiwicm93cyIsInBhcnRzIiwidGl0bGUiLCJmaW5kIiwiZGVmX3ZhbCIsInVsZSIsInVzZV9sYWJlbF9lbGVtZW50IiwibGYiLCJsYWJlbF9maXJzdCIsInNhbml0aXplX2h0bWxfbmFtZSIsIndwYmNfYmZiX19nZXRfY3VycmVudF9zdHJ1Y3R1cmUiLCJ3cGJjX2JmYiIsImdldF9zdHJ1Y3R1cmUiLCJjb25zb2xlIiwiZXJyb3IiLCJhY3F1aXJlX3BhcnNlciIsIndwYmNfc2hvcnRjb2RlX3BhcnNlciIsIldQQkNfRm9ybV9TaG9ydGNvZGVfUGFyc2VyIiwiV1BCQ19DT1VOVFJJRVMiLCJVUyIsIkdCIiwiRlIiLCJFUyIsImJvb2tpbmdfdHlwZSIsIl93cGJjX2J1aWxkZXIiLCJjdXJyZW50X2Jvb2tpbmdfdHlwZSIsImNvdW50cmllc19saXN0IiwiY3VycmVudF9lZGl0X2Jvb2tpbmciLCJwb3N0ZWRfZGF0YSIsIl9lIiwid3BiY19iZmJfX2V4cG9ydF90b19hZHZhbmNlZF9mb3JtIiwib3V0cHV0IiwiYm94IiwiZ2V0RWxlbWVudEJ5SWQiLCJwdiIsInNhdmVfYnRuIiwid3JhcCIsIm1hcmdpblRvcCIsImgiLCJ0ZXh0Q29udGVudCIsIm1hcmdpbiIsIm1pbkhlaWdodCIsImZvbnRGYW1pbHkiLCJmb250U2l6ZSIsInJlYWRPbmx5IiwiY29weV9idG4iLCJhZGRFdmVudExpc3RlbmVyIiwiZSIsInByZXZlbnREZWZhdWx0Iiwic2V0VGltZW91dCIsInB2X2xhYmVsIiwiYm9yZGVyIiwicGFkZGluZyIsImJhY2tncm91bmQiLCJwYXJlbnROb2RlIiwiaW5zZXJ0QWRqYWNlbnRFbGVtZW50IiwiZGlzcGF0Y2hFdmVudCIsIkV2ZW50IiwiYnViYmxlcyIsInBhcnNlciIsImZvcm1fZWxlbWVudHMiLCJpbm5lckhUTUwiLCJhZGRfZXhwb3J0X2J1dHRvbiIsImJ0biIsIm1hcmdpbkxlZnQiLCJsb2ciLCJKU09OIiwic3RyaW5naWZ5IiwiV1BCQ19CRkJfRXZlbnRzIiwiYnVzIiwiZW1pdCIsIlNUUlVDVFVSRV9DSEFOR0UiLCJDdXN0b21FdmVudCIsImRldGFpbCIsImxvYWRfc2F2ZWRfc3RydWN0dXJlIiwiZGVmZXJJZlR5cGluZyIsImluc2VydEJlZm9yZSIsIm5leHRTaWJsaW5nIl0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX3NyYy9idWlsZGVyLWV4cG9ydGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gPT0gRmlsZSAgL19vdXQvYnVpbGRlci1leHBvcnRlci5qcyA9PSAgVGltZSBwb2ludDogMjAyNS0wOC0yMSAxNzozOVxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG5hc3luYyBmdW5jdGlvbiB3cGJjX2NvcHlfdG9fY2xpcGJvYXJkKHRleHQpIHtcclxuXHQvLyBUcnkgdGhlIG1vZGVybiBBUEkgZmlyc3QgKHJlcXVpcmVzIEhUVFBTL2xvY2FsaG9zdCBhbmQgYSB1c2VyIGdlc3R1cmUpLlxyXG5cdHRyeSB7XHJcblx0XHRpZiAoIHdpbmRvdy5pc1NlY3VyZUNvbnRleHQgJiYgbmF2aWdhdG9yLmNsaXBib2FyZD8ud3JpdGVUZXh0ICkge1xyXG5cdFx0XHRhd2FpdCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dCggdGV4dCApO1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHR9IGNhdGNoICggXyApIHtcclxuXHRcdC8qIGZhbGwgdGhyb3VnaCB0byBsZWdhY3kgKi9cclxuXHR9XHJcblxyXG5cdC8vIExlZ2FjeSBmYWxsYmFjazogdGVtcG9yYXJ5IHRleHRhcmVhICsgZXhlY0NvbW1hbmQoJ2NvcHknKS5cclxuXHR0cnkge1xyXG5cdFx0Y29uc3QgdGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAndGV4dGFyZWEnICk7XHJcblx0XHR0YS52YWx1ZSA9IHRleHQ7XHJcblx0XHR0YS5zZXRBdHRyaWJ1dGUoICdyZWFkb25seScsICcnICk7XHJcblx0XHR0YS5zdHlsZS5wb3NpdGlvbiA9ICdmaXhlZCc7XHJcblx0XHR0YS5zdHlsZS50b3AgICAgICA9ICctOTk5OXB4JztcclxuXHRcdHRhLnN0eWxlLm9wYWNpdHkgID0gJzAnO1xyXG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggdGEgKTtcclxuXHRcdHRhLmZvY3VzKCk7XHJcblx0XHR0YS5zZWxlY3QoKTtcclxuXHRcdGNvbnN0IG9rID0gZG9jdW1lbnQuZXhlY0NvbW1hbmQoICdjb3B5JyApOyAvLyByZXR1cm5zIHRydWUvZmFsc2UuXHJcblx0XHRkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKCB0YSApO1xyXG5cdFx0cmV0dXJuICEhb2s7XHJcblx0fSBjYXRjaCAoIF8gKSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG59XHJcblxyXG4oZnVuY3Rpb24gKCkge1xyXG5cdFwidXNlIHN0cmljdFwiO1xyXG5cclxuXHRjb25zdCBjb3JlID0gd2luZG93LldQQkNfQkZCX0NvcmUgfHwge307XHJcblxyXG5cdC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHQvLyBhZGFwdGVyOiBidWlsZGVyIChhcnJheS1vZi1wYWdlcykgPiBleHBvcnRlciBzaGFwZSB7IHBhZ2VzOiBbIHsgaXRlbXM6WyB7a2luZCxkYXRhfSBdIH0gXSB9XHJcblx0Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cdGZ1bmN0aW9uIGFkYXB0X2J1aWxkZXJfc3RydWN0dXJlX3RvX2V4cG9ydGVyKHN0cnVjdHVyZSkge1xyXG5cclxuXHRcdGlmICggIUFycmF5LmlzQXJyYXkoIHN0cnVjdHVyZSApICkgcmV0dXJuIHsgcGFnZXM6IFtdIH07XHJcblxyXG5cdFx0Y29uc3Qgbm9ybWFsaXplX29wdGlvbnMgPSAob3B0cykgPT4ge1xyXG5cdFx0XHRpZiAoICFBcnJheS5pc0FycmF5KCBvcHRzICkgKSByZXR1cm4gW107XHJcblx0XHRcdHJldHVybiBvcHRzLm1hcCggKG8pID0+IHtcclxuXHRcdFx0XHRpZiAoIHR5cGVvZiBvID09PSAnc3RyaW5nJyApIHJldHVybiB7IGxhYmVsOiBvLCB2YWx1ZTogbywgc2VsZWN0ZWQ6IGZhbHNlIH07XHJcblx0XHRcdFx0aWYgKCBvICYmIHR5cGVvZiBvID09PSAnb2JqZWN0JyApIHtcclxuXHRcdFx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0XHRcdGxhYmVsICAgOiBTdHJpbmcoIG8ubGFiZWwgPz8gby52YWx1ZSA/PyAnJyApLFxyXG5cdFx0XHRcdFx0XHR2YWx1ZSAgIDogU3RyaW5nKCBvLnZhbHVlID8/IG8ubGFiZWwgPz8gJycgKSxcclxuXHRcdFx0XHRcdFx0c2VsZWN0ZWQ6ICEhby5zZWxlY3RlZFxyXG5cdFx0XHRcdFx0fTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuIHsgbGFiZWw6IFN0cmluZyggbyApLCB2YWx1ZTogU3RyaW5nKCBvICksIHNlbGVjdGVkOiBmYWxzZSB9O1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9O1xyXG5cclxuXHRcdGNvbnN0IHdhbGtfc2VjdGlvbiA9IChzZWMpID0+ICh7XHJcblx0XHRcdGlkICAgICA6IHNlYz8uaWQsXHJcblx0XHRcdGNvbHVtbnM6IChzZWM/LmNvbHVtbnMgfHwgW10pLm1hcCggKGNvbCkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IGl0ZW1zID0gQXJyYXkuaXNBcnJheSggY29sPy5pdGVtcyApXHJcblx0XHRcdFx0XHQ/IGNvbC5pdGVtc1xyXG5cdFx0XHRcdFx0OiBbXHJcblx0XHRcdFx0XHRcdC4uLihjb2w/LmZpZWxkcyB8fCBbXSkubWFwKCAoZikgPT4gKHsgdHlwZTogJ2ZpZWxkJywgZGF0YTogZiB9KSApLFxyXG5cdFx0XHRcdFx0XHQuLi4oY29sPy5zZWN0aW9ucyB8fCBbXSkubWFwKCAocykgPT4gKHsgdHlwZTogJ3NlY3Rpb24nLCBkYXRhOiBzIH0pIClcclxuXHRcdFx0XHRcdF07XHJcblxyXG5cdFx0XHRcdGNvbnN0IGZpZWxkcyA9IGl0ZW1zXHJcblx0XHRcdFx0XHQuZmlsdGVyKCAoaXQpID0+IGl0ICYmIGl0LnR5cGUgPT09ICdmaWVsZCcgKVxyXG5cdFx0XHRcdFx0Lm1hcCggKGl0KSA9PiAoeyAuLi5pdC5kYXRhLCBvcHRpb25zOiBub3JtYWxpemVfb3B0aW9ucyggaXQuZGF0YT8ub3B0aW9ucyApIH0pICk7XHJcblxyXG5cdFx0XHRcdGNvbnN0IHNlY3Rpb25zID0gaXRlbXNcclxuXHRcdFx0XHRcdC5maWx0ZXIoIChpdCkgPT4gaXQgJiYgaXQudHlwZSA9PT0gJ3NlY3Rpb24nIClcclxuXHRcdFx0XHRcdC5tYXAoIChpdCkgPT4gd2Fsa19zZWN0aW9uKCBpdC5kYXRhICkgKTtcclxuXHJcblx0XHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHRcdHdpZHRoOiBjb2w/LndpZHRoIHx8ICcxMDAlJyxcclxuXHRcdFx0XHRcdHN0eWxlOiBjb2w/LnN0eWxlIHx8IG51bGwsXHJcblx0XHRcdFx0XHRmaWVsZHMsXHJcblx0XHRcdFx0XHRzZWN0aW9uc1xyXG5cdFx0XHRcdH07XHJcblx0XHRcdH0gKVxyXG5cdFx0fSk7XHJcblxyXG5cdFx0Y29uc3QgcGFnZXMgPSBzdHJ1Y3R1cmUubWFwKCAocGFnZSkgPT4ge1xyXG5cdFx0XHRjb25zdCBpdGVtcyA9IFtdO1xyXG5cdFx0XHQocGFnZT8uY29udGVudCB8fCBbXSkuZm9yRWFjaCggKGl0ZW0pID0+IHtcclxuXHRcdFx0XHRpZiAoICFpdGVtICkgcmV0dXJuO1xyXG5cdFx0XHRcdGlmICggaXRlbS50eXBlID09PSAnc2VjdGlvbicgJiYgaXRlbS5kYXRhICkge1xyXG5cdFx0XHRcdFx0aXRlbXMucHVzaCggeyBraW5kOiAnc2VjdGlvbicsIGRhdGE6IHdhbGtfc2VjdGlvbiggaXRlbS5kYXRhICkgfSApO1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAoIGl0ZW0udHlwZSA9PT0gJ2ZpZWxkJyAmJiBpdGVtLmRhdGEgKSB7XHJcblx0XHRcdFx0XHRpdGVtcy5wdXNoKCB7XHJcblx0XHRcdFx0XHRcdGtpbmQ6ICdmaWVsZCcsXHJcblx0XHRcdFx0XHRcdGRhdGE6IHsgLi4uaXRlbS5kYXRhLCBvcHRpb25zOiBub3JtYWxpemVfb3B0aW9ucyggaXRlbS5kYXRhLm9wdGlvbnMgKSB9XHJcblx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblx0XHRcdHJldHVybiB7IGl0ZW1zIH07XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0cmV0dXJuIHsgcGFnZXMgfTtcclxuXHR9XHJcblxyXG5cdC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHQvLyBoZWxwZXI6IGNvbXB1dGUgZWZmZWN0aXZlIGZsZXgtYmFzaXMgdmFsdWVzIHRoYXQgcmVzcGVjdCBpbnRlci1jb2x1bW4gZ2FwXHJcblx0Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cdGZ1bmN0aW9uIGNvbXB1dGVfZWZmZWN0aXZlX2Jhc2VzKGNvbHVtbnMsIGdhcF9wZXJjZW50ID0gMykge1xyXG5cclxuXHRcdGNvbnN0IG4gPSBjb2x1bW5zICYmIGNvbHVtbnMubGVuZ3RoID8gY29sdW1ucy5sZW5ndGggOiAxO1xyXG5cclxuXHRcdGNvbnN0IHJhdyA9IGNvbHVtbnMubWFwKCAoY29sKSA9PiB7XHJcblx0XHRcdGNvbnN0IHcgPSBjb2wgJiYgY29sLndpZHRoICE9IG51bGwgPyBTdHJpbmcoIGNvbC53aWR0aCApLnRyaW0oKSA6ICcnO1xyXG5cdFx0XHRjb25zdCBwID0gdy5lbmRzV2l0aCggJyUnICkgPyBwYXJzZUZsb2F0KCB3ICkgOiB3ID8gcGFyc2VGbG9hdCggdyApIDogTmFOO1xyXG5cdFx0XHRyZXR1cm4gTnVtYmVyLmlzRmluaXRlKCBwICkgPyBwIDogMTAwIC8gbjtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRjb25zdCBzdW1fcmF3ICAgICA9IHJhdy5yZWR1Y2UoIChhLCBiKSA9PiBhICsgYiwgMCApIHx8IDEwMDtcclxuXHRcdGNvbnN0IGdwICAgICAgICAgID0gTnVtYmVyLmlzRmluaXRlKCArZ2FwX3BlcmNlbnQgKSA/ICtnYXBfcGVyY2VudCA6IDM7XHJcblx0XHRjb25zdCB0b3RhbF9nYXBzICA9IE1hdGgubWF4KCAwLCBuIC0gMSApICogZ3A7XHJcblx0XHRjb25zdCBhdmFpbGFibGUgICA9IE1hdGgubWF4KCAwLCAxMDAgLSB0b3RhbF9nYXBzICk7XHJcblx0XHRjb25zdCBzY2FsZV9yYXRpbyA9IGF2YWlsYWJsZSAvIHN1bV9yYXc7XHJcblxyXG5cdFx0cmV0dXJuIHJhdy5tYXAoIChwKSA9PiBNYXRoLm1heCggMCwgcCAqIHNjYWxlX3JhdGlvICkgKTtcclxuXHR9XHJcblxyXG5cdC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHQvLyBleHBvcnRlciDigJMgYm9va2luZyBmb3JtIGJ1aWxkZXIgPiBhZHZhbmNlZCBmb3JtIChzaG9ydGNvZGUpIGV4cG9ydGVyIHdpdGggd2l6YXJkIHdyYXBwZXJcclxuXHQvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0Y2xhc3MgV1BCQ19CRkJfRXhwb3J0ZXIge1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRXhwb3J0IGFkYXB0ZWQgc3RydWN0dXJlIHRvIGFkdmFuY2VkIGZvcm0gdGV4dCAod2l0aCA8cj4vPGM+IGxheW91dCBhbmQgd2l6YXJkIHdyYXBwZXIpLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBhZGFwdGVkXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gIFtvcHRpb25zLm5ld2xpbmU9XCJcXG5cIl1cclxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuYWRkTGFiZWxzPXRydWVdXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gIFtvcHRpb25zLmdhcFBlcmNlbnQ9M11cclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBleHBvcnRfZm9ybShhZGFwdGVkLCBvcHRpb25zID0ge30pIHtcclxuXHRcdFx0Y29uc3QgY2ZnID0geyBuZXdsaW5lOiAnXFxuJywgYWRkTGFiZWxzOiB0cnVlLCBnYXBQZXJjZW50OiAzLCAuLi5vcHRpb25zIH07XHJcblxyXG5cdFx0XHRjb25zdCBJTkQgICA9ICcgICc7XHJcblx0XHRcdGxldCBkZXB0aCAgID0gMDtcclxuXHRcdFx0Y29uc3QgbGluZXMgPSBbXTtcclxuXHRcdFx0Y29uc3QgcHVzaCAgPSAocyA9ICcnKSA9PiBsaW5lcy5wdXNoKCBJTkQucmVwZWF0KCBkZXB0aCApICsgU3RyaW5nKCBzICkgKTtcclxuXHRcdFx0Y29uc3Qgb3BlbiAgPSAocyA9ICcnKSA9PiB7XHJcblx0XHRcdFx0cHVzaCggcyApO1xyXG5cdFx0XHRcdGRlcHRoKys7XHJcblx0XHRcdH07XHJcblx0XHRcdGNvbnN0IGNsb3NlID0gKHMgPSAnJykgPT4ge1xyXG5cdFx0XHRcdGRlcHRoID0gTWF0aC5tYXgoIDAsIGRlcHRoIC0gMSApO1xyXG5cdFx0XHRcdHB1c2goIHMgKTtcclxuXHRcdFx0fTtcclxuXHRcdFx0Y29uc3QgYmxhbmsgPSAoKSA9PiB7XHJcblx0XHRcdFx0bGluZXMucHVzaCggJycgKTtcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdGlmICggIWFkYXB0ZWQgfHwgIUFycmF5LmlzQXJyYXkoIGFkYXB0ZWQucGFnZXMgKSApIHJldHVybiAnJztcclxuXHJcblx0XHRcdGNvbnN0IGN0eCA9IHsgdXNlZElkczogbmV3IFNldCgpIH07XHJcblxyXG5cdFx0XHRvcGVuKCBgPGRpdiBjbGFzcz1cIndwYmNfd2l6YXJkX19ib3JkZXJfY29udGFpbmVyXCI+YCApO1xyXG5cclxuXHRcdFx0Ly8gb25lLXBlci1mb3JtIGd1YXJkcyAoY2FsZW5kYXIgaXMgbm90IGdhdGVkIGhlcmUpXHJcblx0XHRcdGNvbnN0IG9uY2UgPSB7IGNhcHRjaGE6IDAsIGNvdW50cnk6IDAsIGNvdXBvbjogMCwgY29zdF9jb3JyZWN0aW9uczogMCwgc3VibWl0OiAwIH07XHJcblxyXG5cdFx0XHRhZGFwdGVkLnBhZ2VzLmZvckVhY2goIChwYWdlLCBwYWdlX2luZGV4KSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgaXNfZmlyc3QgPSBwYWdlX2luZGV4ID09PSAwO1xyXG5cdFx0XHRcdGNvbnN0IGlzX2xhc3QgID0gcGFnZV9pbmRleCA9PT0gYWRhcHRlZC5wYWdlcy5sZW5ndGggLSAxO1xyXG5cdFx0XHRcdGNvbnN0IHN0ZXBfbnVtID0gcGFnZV9pbmRleCArIDE7XHJcblxyXG5cdFx0XHRcdGNvbnN0IGhpZGRlbl9jbGFzcyA9IGlzX2ZpcnN0ID8gJycgOiAnIHdwYmNfd2l6YXJkX3N0ZXBfaGlkZGVuJztcclxuXHRcdFx0XHRjb25zdCBoaWRkZW5fc3R5bGUgPSBpc19maXJzdCA/ICcnIDogJyBzdHlsZT1cImRpc3BsYXk6bm9uZTtjbGVhcjpib3RoO1wiJztcclxuXHRcdFx0XHRvcGVuKCBgPGRpdiBjbGFzcz1cIndwYmNfd2l6YXJkX3N0ZXAgd3BiY19fZm9ybV9fZGl2IHdwYmNfd2l6YXJkX3N0ZXAke3N0ZXBfbnVtfSR7aGlkZGVuX2NsYXNzfVwiJHtoaWRkZW5fc3R5bGV9PmAgKTtcclxuXHJcblx0XHRcdFx0KHBhZ2UuaXRlbXMgfHwgW10pLmZvckVhY2goIChpdGVtKSA9PiB7XHJcblx0XHRcdFx0XHRpZiAoIGl0ZW0ua2luZCA9PT0gJ3NlY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRXUEJDX0JGQl9FeHBvcnRlci5yZW5kZXJfc2VjdGlvbiggaXRlbS5kYXRhLCB7IG9wZW4sIGNsb3NlLCBwdXNoLCBibGFuayB9LCBjZmcgKTtcclxuXHRcdFx0XHRcdFx0YmxhbmsoKTtcclxuXHRcdFx0XHRcdH0gZWxzZSBpZiAoIGl0ZW0ua2luZCA9PT0gJ2ZpZWxkJyApIHtcclxuXHRcdFx0XHRcdFx0b3BlbiggYDxyPmAgKTtcclxuXHRcdFx0XHRcdFx0b3BlbiggYDxjPmAgKTtcclxuXHRcdFx0XHRcdFx0V1BCQ19CRkJfRXhwb3J0ZXIucmVuZGVyX2ZpZWxkX25vZGUoIGl0ZW0uZGF0YSwgeyBvcGVuLCBjbG9zZSwgcHVzaCwgYmxhbmsgfSwgY2ZnLCBvbmNlLCBjdHggKTtcclxuXHRcdFx0XHRcdFx0Y2xvc2UoIGA8L2M+YCApO1xyXG5cdFx0XHRcdFx0XHRjbG9zZSggYDwvcj5gICk7XHJcblx0XHRcdFx0XHRcdGJsYW5rKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSApO1xyXG5cclxuXHRcdFx0XHRwdXNoKCBgPGhyPmAgKTtcclxuXHRcdFx0XHRvcGVuKCBgPHI+YCApO1xyXG5cdFx0XHRcdG9wZW4oIGA8YyBzdHlsZT1cImp1c3RpZnktY29udGVudDogZmxleC1lbmQ7XCI+YCApO1xyXG5cdFx0XHRcdGlmICggIWlzX2ZpcnN0ICkgcHVzaCggYDxhIGNsYXNzPVwid3BiY19idXR0b25fbGlnaHQgd3BiY193aXphcmRfc3RlcF9idXR0b24gd3BiY193aXphcmRfc3RlcF8ke3N0ZXBfbnVtIC0gMX1cIj5CYWNrPC9hPiZuYnNwOyZuYnNwOyZuYnNwO2AgKTtcclxuXHRcdFx0XHRpZiAoICFpc19sYXN0ICkgcHVzaCggYDxhIGNsYXNzPVwid3BiY19idXR0b25fbGlnaHQgd3BiY193aXphcmRfc3RlcF9idXR0b24gd3BiY193aXphcmRfc3RlcF8ke3N0ZXBfbnVtICsgMX1cIj5OZXh0PC9hPmAgKTtcclxuXHRcdFx0XHRlbHNlIGlmICggb25jZS5zdWJtaXQgPT09IDAgKSB7XHJcblx0XHRcdFx0XHRwdXNoKCBgW3N1Ym1pdCBcIlNlbmRcIl1gICk7XHJcblx0XHRcdFx0XHRvbmNlLnN1Ym1pdCsrO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjbG9zZSggYDwvYz5gICk7XHJcblx0XHRcdFx0Y2xvc2UoIGA8L3I+YCApO1xyXG5cdFx0XHRcdGNsb3NlKCBgPC9kaXY+YCApO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRjbG9zZSggYDwvZGl2PmAgKTtcclxuXHRcdFx0cmV0dXJuIGxpbmVzLmpvaW4oIGNmZy5uZXdsaW5lICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gbGF5b3V0IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRzdGF0aWMgcmVuZGVyX3NlY3Rpb24oc2VjdGlvbiwgaW8sIGNmZykge1xyXG5cdFx0XHRjb25zdCB7IG9wZW4sIGNsb3NlIH0gPSBpbztcclxuXHJcblx0XHRcdG9wZW4oIGA8cj5gICk7XHJcblx0XHRcdGNvbnN0IGNvbHMgPSBBcnJheS5pc0FycmF5KCBzZWN0aW9uLmNvbHVtbnMgKSAmJiBzZWN0aW9uLmNvbHVtbnMubGVuZ3RoID8gc2VjdGlvbi5jb2x1bW5zIDogWyB7XHJcblx0XHRcdFx0d2lkdGggICA6ICcxMDAlJyxcclxuXHRcdFx0XHRmaWVsZHMgIDogW10sXHJcblx0XHRcdFx0c2VjdGlvbnM6IFtdXHJcblx0XHRcdH0gXTtcclxuXHJcblx0XHRcdGNvbnN0IGJhc2VzICAgID0gY29tcHV0ZV9lZmZlY3RpdmVfYmFzZXMoIGNvbHMsIGNmZy5nYXBQZXJjZW50ICk7XHJcblx0XHRcdGNvbnN0IGVzY19hdHRyID0gY29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5lc2NhcGVfaHRtbDtcclxuXHJcblx0XHRcdGNvbHMuZm9yRWFjaCggKGNvbCwgaWR4KSA9PiB7XHJcblx0XHRcdFx0bGV0IHN0eWxlX2F0dHIgPSAnJztcclxuXHRcdFx0XHRpZiAoIGNvbC5zdHlsZSAmJiB0eXBlb2YgY29sLnN0eWxlID09PSAnc3RyaW5nJyAmJiBjb2wuc3R5bGUudHJpbSgpICkge1xyXG5cdFx0XHRcdFx0c3R5bGVfYXR0ciA9IGAgc3R5bGU9XCIke2VzY19hdHRyKCBjb2wuc3R5bGUudHJpbSgpICl9XCJgO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb25zdCBlZmYgID0gYmFzZXNbaWR4XTtcclxuXHRcdFx0XHRcdHN0eWxlX2F0dHIgPSBgIHN0eWxlPVwiZmxleC1iYXNpczogJHtOdW1iZXIuaXNGaW5pdGUoIGVmZiApID8gZWZmLnRvRml4ZWQoIDQgKSA6IDEwMH0lO1wiYDtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdG9wZW4oIGA8YyR7c3R5bGVfYXR0cn0+YCApO1xyXG5cclxuXHRcdFx0XHQoY29sLmZpZWxkcyB8fCBbXSkuZm9yRWFjaCggKG5vZGUpID0+IFdQQkNfQkZCX0V4cG9ydGVyLnJlbmRlcl9maWVsZF9ub2RlKCBub2RlLCBpbywgY2ZnLCB7XHJcblx0XHRcdFx0XHRjYXB0Y2hhICAgICAgICAgOiAxLFxyXG5cdFx0XHRcdFx0Y291bnRyeSAgICAgICAgIDogMSxcclxuXHRcdFx0XHRcdGNvdXBvbiAgICAgICAgICA6IDEsXHJcblx0XHRcdFx0XHRjb3N0X2NvcnJlY3Rpb25zOiAxLFxyXG5cdFx0XHRcdFx0c3VibWl0ICAgICAgICAgIDogMVxyXG5cdFx0XHRcdH0sIHsgdXNlZElkczogbmV3IFNldCgpIH0gKSApO1xyXG5cdFx0XHRcdChjb2wuc2VjdGlvbnMgfHwgW10pLmZvckVhY2goIChuZXN0ZWQpID0+IFdQQkNfQkZCX0V4cG9ydGVyLnJlbmRlcl9zZWN0aW9uKCBuZXN0ZWQsIGlvLCBjZmcgKSApO1xyXG5cclxuXHRcdFx0XHRjbG9zZSggYDwvYz5gICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdGNsb3NlKCBgPC9yPmAgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBmaWVsZHMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdHN0YXRpYyByZW5kZXJfZmllbGRfbm9kZShmaWVsZCwgaW8sIGNmZywgb25jZSwgY3R4KSB7XHJcblx0XHRcdGNvbnN0IHsgcHVzaCB9ID0gaW87XHJcblx0XHRcdGlmICggIWZpZWxkIHx8ICFmaWVsZC50eXBlICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Y29uc3QgdHlwZSA9IFN0cmluZyggZmllbGQudHlwZSApLnRvTG93ZXJDYXNlKCk7XHJcblx0XHRcdGNvbnN0IG5hbWUgPSBXUEJDX0JGQl9FeHBvcnRlci5jb21wdXRlX25hbWUoIHR5cGUsIGZpZWxkICk7XHJcblxyXG5cdFx0XHRjb25zdCBpc19yZXEgICA9IChcclxuXHRcdFx0XHRmaWVsZC5yZXF1aXJlZCA9PT0gdHJ1ZSB8fFxyXG5cdFx0XHRcdGZpZWxkLnJlcXVpcmVkID09PSAndHJ1ZScgfHxcclxuXHRcdFx0XHRmaWVsZC5yZXF1aXJlZCA9PT0gMSB8fFxyXG5cdFx0XHRcdGZpZWxkLnJlcXVpcmVkID09PSAnMScgfHxcclxuXHRcdFx0XHRmaWVsZC5yZXF1aXJlZCA9PT0gJ3JlcXVpcmVkJ1xyXG5cdFx0XHQpO1xyXG5cdFx0XHRjb25zdCByZXFfbWFyayA9IGlzX3JlcSA/ICcqJyA6ICcnO1xyXG5cclxuXHRcdFx0Y29uc3QgaWRfb3B0ICAgPSBXUEJDX0JGQl9FeHBvcnRlci5pZF9vcHRpb24oIGZpZWxkLCBjdHggKTtcclxuXHRcdFx0Y29uc3QgY2xzX29wdHMgPSBXUEJDX0JGQl9FeHBvcnRlci5jbGFzc19vcHRpb25zKCBmaWVsZCApO1xyXG5cdFx0XHRjb25zdCBwaF9hdHRyICA9IFdQQkNfQkZCX0V4cG9ydGVyLnBoX2F0dHIoIGZpZWxkLnBsYWNlaG9sZGVyICk7XHJcblxyXG5cdFx0XHRjb25zdCBlbWl0X2xhYmVsX3RoZW4gPSAoYm9keSkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IGxibCA9IChmaWVsZC5sYWJlbCA/PyAnJykudG9TdHJpbmcoKS50cmltKCk7XHJcblx0XHRcdFx0aWYgKCAhbGJsIHx8ICFjZmcuYWRkTGFiZWxzICkge1xyXG5cdFx0XHRcdFx0cHVzaCggYm9keSApO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRwdXNoKCBgPGw+JHtjb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY2FwZV9odG1sKCBsYmwgKX08L2w+YCApO1xyXG5cdFx0XHRcdFx0cHVzaCggYDxicj4ke2JvZHl9YCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoIGZpZWxkLmhlbHAgKSB7XHJcblx0XHRcdFx0XHRwdXNoKCBgPGRpdiBjbGFzcz1cIndwYmNfZmllbGRfZGVzY3JpcHRpb25cIj4ke2NvcmUuV1BCQ19CRkJfU2FuaXRpemUuZXNjYXBlX2h0bWwoIFN0cmluZyggZmllbGQuaGVscCApICl9PC9kaXY+YCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdC8vIHNwZWNpYWwgYmxvY2tzXHJcblx0XHRcdGlmICggdHlwZSA9PT0gJ2NhbGVuZGFyJyApIHtcclxuXHRcdFx0XHRwdXNoKCBgW2NhbGVuZGFyXWAgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggdHlwZSA9PT0gJ2NhcHRjaGEnICkge1xyXG5cdFx0XHRcdGlmICggb25jZS5jYXB0Y2hhKysgKSB7XHJcblx0XHRcdFx0XHRwdXNoKCBgPCEtLSBTa2lwcGVkIGV4dHJhIFtjYXB0Y2hhXSAoYWxsb3dlZCBvbmNlKSAtLT5gICk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHB1c2goIGBbY2FwdGNoYV1gICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCB0eXBlID09PSAnY291bnRyeScgKSB7XHJcblx0XHRcdFx0aWYgKCBvbmNlLmNvdW50cnkrKyApIHtcclxuXHRcdFx0XHRcdHB1c2goIGA8IS0tIFNraXBwZWQgZXh0cmEgW2NvdW50cnldIChhbGxvd2VkIG9uY2UpIC0tPmAgKTtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Y29uc3QgY2MgPSAoZmllbGQuZGVmYXVsdFZhbHVlIHx8ICcnKS50b1N0cmluZygpLnRyaW0oKTtcclxuXHRcdFx0XHRwdXNoKCBjYyA/IGBbY291bnRyeSBcIiR7Y29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5lc2NhcGVfZm9yX3Nob3J0Y29kZSggY2MgKX1cIl1gIDogYFtjb3VudHJ5XWAgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggdHlwZSA9PT0gJ2NvdXBvbicgKSB7XHJcblx0XHRcdFx0aWYgKCBvbmNlLmNvdXBvbisrICkge1xyXG5cdFx0XHRcdFx0cHVzaCggYDwhLS0gU2tpcHBlZCBleHRyYSBbY291cG9uIGRpc2NvdW50XSAoYWxsb3dlZCBvbmNlKSAtLT5gICk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdC8vIG5hbWUgaXMgcmVxdWlyZWQgZm9yIGNvdXBvbiBieSB0aGUgUEhQIGVuZ2luZTsgXCJkaXNjb3VudFwiIGlzIGEgc2Vuc2libGUgZGVmYXVsdFxyXG5cdFx0XHRcdFx0cHVzaCggYFtjb3Vwb24gZGlzY291bnRdYCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggdHlwZSA9PT0gJ2Nvc3RfY29ycmVjdGlvbnMnICkge1xyXG5cdFx0XHRcdGlmICggb25jZS5jb3N0X2NvcnJlY3Rpb25zKysgKSB7XHJcblx0XHRcdFx0XHRwdXNoKCBgPCEtLSBTa2lwcGVkIGV4dHJhIFtjb3N0X2NvcnJlY3Rpb25zXSAoYWxsb3dlZCBvbmNlKSAtLT5gICk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHB1c2goIGBbY29zdF9jb3JyZWN0aW9uc11gICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCB0eXBlID09PSAnc3VibWl0JyApIHtcclxuXHRcdFx0XHRjb25zdCBsYWJlbCA9IGZpZWxkLmxhYmVsID8gYFwiJHtjb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY2FwZV9mb3Jfc2hvcnRjb2RlKCBmaWVsZC5sYWJlbCApfVwiYCA6IGBcIlNlbmRcImA7XHJcblx0XHRcdFx0cHVzaCggYFtzdWJtaXQgJHtsYWJlbH1dYCApO1xyXG5cdFx0XHRcdG9uY2Uuc3VibWl0Kys7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyByZXNlcnZlZCBuYW1lc1xyXG5cdFx0XHRjb25zdCByZXNlcnZlZF9uYW1lID0gKGZpZWxkLm5hbWUgfHwgZmllbGQuaWQgfHwgJycpLnRvTG93ZXJDYXNlKCk7XHJcblxyXG5cdFx0XHRpZiAoIHJlc2VydmVkX25hbWUgPT09ICdyYW5nZXRpbWUnICkge1xyXG5cdFx0XHRcdGNvbnN0IHRva2VucyA9IFdQQkNfQkZCX0V4cG9ydGVyLm9wdGlvbl90b2tlbnMoIGZpZWxkICk7XHJcblx0XHRcdFx0Y29uc3QgZGVmICAgID0gV1BCQ19CRkJfRXhwb3J0ZXIuZGVmYXVsdF9vcHRpb25fc3VmZml4KCBmaWVsZCwgdG9rZW5zICk7XHJcblx0XHRcdFx0ZW1pdF9sYWJlbF90aGVuKCBgW3NlbGVjdGJveCByYW5nZXRpbWUke2lkX29wdH0ke2Nsc19vcHRzfSR7dG9rZW5zfSR7ZGVmfV1gICk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIHJlc2VydmVkX25hbWUgPT09ICdkdXJhdGlvbnRpbWUnICkge1xyXG5cdFx0XHRcdC8vIGV4cGxpY2l0IHN1cHBvcnRcclxuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSBXUEJDX0JGQl9FeHBvcnRlci5vcHRpb25fdG9rZW5zKCBmaWVsZCApO1xyXG5cdFx0XHRcdGNvbnN0IGRlZiAgICA9IFdQQkNfQkZCX0V4cG9ydGVyLmRlZmF1bHRfb3B0aW9uX3N1ZmZpeCggZmllbGQsIHRva2VucyApO1xyXG5cdFx0XHRcdGVtaXRfbGFiZWxfdGhlbiggYFtzZWxlY3Rib3ggZHVyYXRpb250aW1lJHtpZF9vcHR9JHtjbHNfb3B0c30ke3Rva2Vuc30ke2RlZn1dYCApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCByZXNlcnZlZF9uYW1lID09PSAnc3RhcnR0aW1lJyB8fCByZXNlcnZlZF9uYW1lID09PSAnZW5kdGltZScgKSB7XHJcblx0XHRcdFx0ZW1pdF9sYWJlbF90aGVuKCBgW3NlbGVjdGJveCR7cmVxX21hcmt9ICR7cmVzZXJ2ZWRfbmFtZX0ke1dQQkNfQkZCX0V4cG9ydGVyLnNpemVfbWF4X3Rva2VuKCBmaWVsZCApfSR7aWRfb3B0fSR7Y2xzX29wdHN9JHtwaF9hdHRyfV1gICk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBzdGFuZGFyZCBpbnB1dHNcclxuXHRcdFx0c3dpdGNoICggdHlwZSApIHtcclxuXHRcdFx0XHRjYXNlICd0ZXh0JzpcclxuXHRcdFx0XHRcdGVtaXRfbGFiZWxfdGhlbiggYFt0ZXh0JHtyZXFfbWFya30gJHtuYW1lfSR7V1BCQ19CRkJfRXhwb3J0ZXIuc2l6ZV9tYXhfdG9rZW4oIGZpZWxkICl9JHtpZF9vcHR9JHtjbHNfb3B0c30ke3BoX2F0dHJ9XWAgKTtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHJcblx0XHRcdFx0Y2FzZSAnZW1haWwnOlxyXG5cdFx0XHRcdFx0ZW1pdF9sYWJlbF90aGVuKCBgW2VtYWlsJHtyZXFfbWFya30gJHtuYW1lfSR7V1BCQ19CRkJfRXhwb3J0ZXIuc2l6ZV9tYXhfdG9rZW4oIGZpZWxkICl9JHtpZF9vcHR9JHtjbHNfb3B0c30ke3BoX2F0dHJ9XWAgKTtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHJcblx0XHRcdFx0Y2FzZSAndGltZSc6XHJcblx0XHRcdFx0XHRlbWl0X2xhYmVsX3RoZW4oIGBbdGltZSR7cmVxX21hcmt9ICR7bmFtZX0ke1dQQkNfQkZCX0V4cG9ydGVyLnNpemVfbWF4X3Rva2VuKCBmaWVsZCApfSR7aWRfb3B0fSR7Y2xzX29wdHN9JHtwaF9hdHRyfV1gICk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblxyXG5cdFx0XHRcdGNhc2UgJ3RlbCc6XHJcblx0XHRcdFx0Y2FzZSAncGhvbmUnOiB7XHJcblx0XHRcdFx0XHRjb25zdCBleHRyYSA9IGAgY2xhc3M6d3BkZXYtdmFsaWRhdGVzLWFzLXBob25lYDtcclxuXHRcdFx0XHRcdGVtaXRfbGFiZWxfdGhlbiggYFt0ZXh0JHtyZXFfbWFya30gJHtuYW1lfSR7V1BCQ19CRkJfRXhwb3J0ZXIuc2l6ZV9tYXhfdG9rZW4oIGZpZWxkICl9JHtpZF9vcHR9JHtjbHNfb3B0c30ke2V4dHJhfSR7cGhfYXR0cn1dYCApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Y2FzZSAnbnVtYmVyJzoge1xyXG5cdFx0XHRcdFx0Y29uc3QgZXh0cmEgPSBgIGNsYXNzOndwZGV2LXZhbGlkYXRlcy1hcy1udW1iZXJgO1xyXG5cdFx0XHRcdFx0ZW1pdF9sYWJlbF90aGVuKCBgW3RleHQke3JlcV9tYXJrfSAke25hbWV9JHtXUEJDX0JGQl9FeHBvcnRlci5zaXplX21heF90b2tlbiggZmllbGQgKX0ke2lkX29wdH0ke2Nsc19vcHRzfSR7ZXh0cmF9JHtwaF9hdHRyfV1gICk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRjYXNlICd0ZXh0YXJlYSc6XHJcblx0XHRcdFx0XHRlbWl0X2xhYmVsX3RoZW4oIGBbdGV4dGFyZWEke3JlcV9tYXJrfSAke25hbWV9JHtXUEJDX0JGQl9FeHBvcnRlci5jb2xzX3Jvd3NfdG9rZW4oIGZpZWxkICl9JHtpZF9vcHR9JHtjbHNfb3B0c30ke3BoX2F0dHJ9XWAgKTtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHJcblx0XHRcdFx0Y2FzZSAncmFkaW8nOlxyXG5cdFx0XHRcdFx0ZW1pdF9sYWJlbF90aGVuKCBXUEJDX0JGQl9FeHBvcnRlci5jaG9pY2VfdGFnKCAncmFkaW8nLCByZXFfbWFyaywgbmFtZSwgZmllbGQsIGlkX29wdCwgY2xzX29wdHMgKSApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cclxuXHRcdFx0XHRjYXNlICdjaGVja2JveCc6XHJcblx0XHRcdFx0Y2FzZSAnY2hlY2tib3hlcyc6XHJcblx0XHRcdFx0XHRXUEJDX0JGQl9FeHBvcnRlci5lbWl0X2NoZWNrYm94X3NpbmdsZXMoIGZpZWxkLCBuYW1lLCByZXFfbWFyaywgaWRfb3B0LCBjbHNfb3B0cywgaW8sIGNmZyApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cclxuXHRcdFx0XHRjYXNlICdzZWxlY3QnOlxyXG5cdFx0XHRcdGNhc2UgJ3NlbGVjdGJveCc6XHJcblx0XHRcdFx0XHRlbWl0X2xhYmVsX3RoZW4oIFdQQkNfQkZCX0V4cG9ydGVyLmNob2ljZV90YWcoICdzZWxlY3Rib3gnLCByZXFfbWFyaywgbmFtZSwgZmllbGQsIGlkX29wdCwgY2xzX29wdHMgKSApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cclxuXHRcdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHRcdFx0cHVzaCggYDwhLS0gVE9ETyBtYXAgZmllbGQgdHlwZSBcIiR7dHlwZX1cIiBuYW1lPVwiJHtuYW1lfVwiIC0tPmAgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIGNoZWNrYm94IGhlbHBlciAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0c3RhdGljIGVtaXRfY2hlY2tib3hfc2luZ2xlcyhmaWVsZCwgYmFzZV9uYW1lLCByZXFfbWFyaywgaWRfb3B0LCBjbHNfb3B0cywgaW8sIGNmZykge1xyXG5cdFx0XHRjb25zdCB7IHB1c2ggfSA9IGlvO1xyXG5cdFx0XHRjb25zdCBsYmwgICAgICA9IChmaWVsZC5sYWJlbCA/PyAnJykudG9TdHJpbmcoKS50cmltKCk7XHJcblxyXG5cdFx0XHRpZiAoIGxibCAmJiBjZmcuYWRkTGFiZWxzICkge1xyXG5cdFx0XHRcdHB1c2goIGA8bD4ke2NvcmUuV1BCQ19CRkJfU2FuaXRpemUuZXNjYXBlX2h0bWwoIGxibCApfTwvbD5gICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IHRva2VucyA9IFdQQkNfQkZCX0V4cG9ydGVyLm9wdGlvbl90b2tlbnMoIGZpZWxkICk7XHJcblx0XHRcdGlmICggIXRva2Vucy50cmltKCkgKSB7XHJcblx0XHRcdFx0Y29uc3Qgc2luZ2xlX2xhYmVsID0gZmllbGQub3B0aW9uX2xhYmVsIHx8IGZpZWxkLnBsYWNlaG9sZGVyIHx8IGxibCB8fCAnSSBhZ3JlZSc7XHJcblx0XHRcdFx0cHVzaCggYFtjaGVja2JveCR7cmVxX21hcmt9ICR7YmFzZV9uYW1lfSR7aWRfb3B0fSR7Y2xzX29wdHN9IFwiJHtjb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY2FwZV9mb3Jfc2hvcnRjb2RlKCBzaW5nbGVfbGFiZWwgKX1cIl1gICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0Y29uc3QgZGVmID0gV1BCQ19CRkJfRXhwb3J0ZXIuZGVmYXVsdF9vcHRpb25fc3VmZml4KCBmaWVsZCwgdG9rZW5zICk7XHJcblx0XHRcdFx0cHVzaCggYFtjaGVja2JveCR7cmVxX21hcmt9ICR7YmFzZV9uYW1lfSR7aWRfb3B0fSR7Y2xzX29wdHN9JHt0b2tlbnN9JHtkZWZ9XWAgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBmaWVsZC5oZWxwICkge1xyXG5cdFx0XHRcdHB1c2goIGA8ZGl2IGNsYXNzPVwid3BiY19maWVsZF9kZXNjcmlwdGlvblwiPiR7Y29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5lc2NhcGVfaHRtbCggU3RyaW5nKCBmaWVsZC5oZWxwICkgKX08L2Rpdj5gICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBoZWxwZXJzIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdFx0c3RhdGljIGNsYXNzX29wdGlvbnMoZmllbGQpIHtcclxuXHRcdFx0Y29uc3QgcmF3ID0gZmllbGQuY2xhc3MgfHwgZmllbGQuY2xhc3NOYW1lIHx8IGZpZWxkLmNzc2NsYXNzIHx8ICcnO1xyXG5cdFx0XHRjb25zdCBjbHMgPSBjb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2Nzc19jbGFzc2xpc3QoIFN0cmluZyggcmF3ICkgKTtcclxuXHRcdFx0aWYgKCAhY2xzICkgcmV0dXJuICcnO1xyXG5cdFx0XHRyZXR1cm4gY2xzXHJcblx0XHRcdFx0LnNwbGl0KCAvXFxzKy8gKVxyXG5cdFx0XHRcdC5maWx0ZXIoIEJvb2xlYW4gKVxyXG5cdFx0XHRcdC5tYXAoIChjKSA9PiBgIGNsYXNzOiR7Y29yZS5XUEJDX0JGQl9TYW5pdGl6ZS50b190b2tlbiggYyApfWAgKVxyXG5cdFx0XHRcdC5qb2luKCAnJyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBpZF9vcHRpb24oZmllbGQsIGN0eCkge1xyXG5cdFx0XHRjb25zdCByYXdfaWQgPSBmaWVsZC5odG1sX2lkIHx8IGZpZWxkLmlkX2F0dHI7XHJcblx0XHRcdGlmICggIXJhd19pZCApIHJldHVybiAnJztcclxuXHRcdFx0Y29uc3QgYmFzZSA9IGNvcmUuV1BCQ19CRkJfU2FuaXRpemUudG9fdG9rZW4oIHJhd19pZCApO1xyXG5cdFx0XHRpZiAoICFiYXNlICkgcmV0dXJuICcnO1xyXG5cdFx0XHRsZXQgdW5pcXVlID0gYmFzZSwgaSA9IDI7XHJcblx0XHRcdHdoaWxlICggY3R4LnVzZWRJZHMuaGFzKCB1bmlxdWUgKSApIHVuaXF1ZSA9IGAke2Jhc2V9XyR7aSsrfWA7XHJcblx0XHRcdGN0eC51c2VkSWRzLmFkZCggdW5pcXVlICk7XHJcblx0XHRcdHJldHVybiBgIGlkOiR7dW5pcXVlfWA7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIHBoX2F0dHIodikge1xyXG5cdFx0XHRpZiAoIHYgPT0gbnVsbCB8fCB2ID09PSAnJyApIHJldHVybiAnJztcclxuXHRcdFx0cmV0dXJuIGAgcGxhY2Vob2xkZXI6XCIke2NvcmUuV1BCQ19CRkJfU2FuaXRpemUuZXNjYXBlX2Zvcl9hdHRyX3F1b3RlZCggdiApfVwiYDtcclxuXHRcdH1cclxuXHJcblx0XHQvLyB0ZXh0LWxpa2Ugc2l6ZS9tYXhsZW5ndGggdG9rZW46IFwiNDAvMjU1XCIgKG9yIFwiNDAvXCIgb3IgXCIvMjU1XCIpXHJcblx0XHRzdGF0aWMgc2l6ZV9tYXhfdG9rZW4oZikge1xyXG5cdFx0XHRjb25zdCBzaXplID0gcGFyc2VJbnQoIGYuc2l6ZSwgMTAgKTtcclxuXHRcdFx0Y29uc3QgbWF4ICA9IHBhcnNlSW50KCBmLm1heGxlbmd0aCwgMTAgKTtcclxuXHRcdFx0aWYgKCBOdW1iZXIuaXNGaW5pdGUoIHNpemUgKSAmJiBOdW1iZXIuaXNGaW5pdGUoIG1heCApICkgcmV0dXJuIGAgJHtzaXplfS8ke21heH1gO1xyXG5cdFx0XHRpZiAoIE51bWJlci5pc0Zpbml0ZSggc2l6ZSApICkgcmV0dXJuIGAgJHtzaXplfS9gO1xyXG5cdFx0XHRpZiAoIE51bWJlci5pc0Zpbml0ZSggbWF4ICkgKSByZXR1cm4gYCAvJHttYXh9YDtcclxuXHRcdFx0cmV0dXJuICcnO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIHRleHRhcmVhIGNvbHMvcm93cyB0b2tlbjogXCI2MHg0XCIgKG9yIFwiNjB4XCIgb3IgXCJ4NFwiKVxyXG5cdFx0c3RhdGljIGNvbHNfcm93c190b2tlbihmKSB7XHJcblx0XHRcdGNvbnN0IGNvbHMgPSBwYXJzZUludCggZi5jb2xzLCAxMCApO1xyXG5cdFx0XHRjb25zdCByb3dzID0gcGFyc2VJbnQoIGYucm93cywgMTAgKTtcclxuXHRcdFx0aWYgKCBOdW1iZXIuaXNGaW5pdGUoIGNvbHMgKSAmJiBOdW1iZXIuaXNGaW5pdGUoIHJvd3MgKSApIHJldHVybiBgICR7Y29sc314JHtyb3dzfWA7XHJcblx0XHRcdGlmICggTnVtYmVyLmlzRmluaXRlKCBjb2xzICkgKSByZXR1cm4gYCAke2NvbHN9eGA7XHJcblx0XHRcdGlmICggTnVtYmVyLmlzRmluaXRlKCByb3dzICkgKSByZXR1cm4gYCB4JHtyb3dzfWA7XHJcblx0XHRcdHJldHVybiAnJztcclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgb3B0aW9uX3Rva2VucyhmaWVsZCkge1xyXG5cdFx0XHRjb25zdCBvcHRpb25zID0gQXJyYXkuaXNBcnJheSggZmllbGQub3B0aW9ucyApID8gZmllbGQub3B0aW9ucyA6IFtdO1xyXG5cdFx0XHRpZiAoIG9wdGlvbnMubGVuZ3RoID09PSAwICkgcmV0dXJuICcnO1xyXG5cdFx0XHRjb25zdCBwYXJ0cyA9IG9wdGlvbnMubWFwKCAobykgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IHRpdGxlID0gU3RyaW5nKCBvLmxhYmVsID8/IG8udmFsdWUgPz8gJycgKS50cmltKCk7XHJcblx0XHRcdFx0Y29uc3QgdmFsdWUgPSBTdHJpbmcoIG8udmFsdWUgPz8gby5sYWJlbCA/PyAnJyApLnRyaW0oKTtcclxuXHRcdFx0XHRyZXR1cm4gdGl0bGUgJiYgdmFsdWUgJiYgdGl0bGUgIT09IHZhbHVlXHJcblx0XHRcdFx0XHQ/IGBcIiR7Y29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5lc2NhcGVfZm9yX3Nob3J0Y29kZSggYCR7dGl0bGV9QEAke3ZhbHVlfWAgKX1cImBcclxuXHRcdFx0XHRcdDogYFwiJHtjb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY2FwZV9mb3Jfc2hvcnRjb2RlKCB0aXRsZSB8fCB2YWx1ZSApfVwiYDtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHRyZXR1cm4gJyAnICsgcGFydHMuam9pbiggJyAnICk7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIGRlZmF1bHRfb3B0aW9uX3N1ZmZpeChmaWVsZCwgdG9rZW5zKSB7XHJcblx0XHRcdGNvbnN0IG9wdGlvbnMgID0gQXJyYXkuaXNBcnJheSggZmllbGQub3B0aW9ucyApID8gZmllbGQub3B0aW9ucyA6IFtdO1xyXG5cdFx0XHRjb25zdCBzZWxlY3RlZCA9IG9wdGlvbnMuZmluZCggKG8pID0+IG8uc2VsZWN0ZWQgKTtcclxuXHRcdFx0Y29uc3QgZGVmX3ZhbCAgPSBzZWxlY3RlZCA/IHNlbGVjdGVkLnZhbHVlID8/IHNlbGVjdGVkLmxhYmVsIDogZmllbGQuZGVmYXVsdFZhbHVlID8/ICcnO1xyXG5cdFx0XHRpZiAoICFkZWZfdmFsICkgcmV0dXJuICcnO1xyXG5cdFx0XHRyZXR1cm4gYCBkZWZhdWx0OiR7Y29yZS5XUEJDX0JGQl9TYW5pdGl6ZS50b190b2tlbiggZGVmX3ZhbCApfWA7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIGNob2ljZV90YWcoa2luZCwgcmVxX21hcmssIG5hbWUsIGZpZWxkLCBpZF9vcHQsIGNsc19vcHRzKSB7XHJcblx0XHRcdGNvbnN0IHRva2VucyA9IFdQQkNfQkZCX0V4cG9ydGVyLm9wdGlvbl90b2tlbnMoIGZpZWxkICk7XHJcblx0XHRcdGNvbnN0IGRlZiAgICA9IFdQQkNfQkZCX0V4cG9ydGVyLmRlZmF1bHRfb3B0aW9uX3N1ZmZpeCggZmllbGQsIHRva2VucyApO1xyXG5cdFx0XHRjb25zdCB1bGUgICAgPSBmaWVsZC51c2VfbGFiZWxfZWxlbWVudCA/IGAgdXNlX2xhYmVsX2VsZW1lbnQ6XCIxXCJgIDogJyc7XHJcblx0XHRcdGNvbnN0IGxmICAgICA9IGZpZWxkLmxhYmVsX2ZpcnN0ID8gYCBsYWJlbF9maXJzdDpcIjFcImAgOiAnJztcclxuXHRcdFx0cmV0dXJuIGBbJHtraW5kfSR7cmVxX21hcmt9ICR7bmFtZX0ke2lkX29wdH0ke2Nsc19vcHRzfSR7dG9rZW5zfSR7ZGVmfSR7dWxlfSR7bGZ9XWA7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIGNvbXB1dGVfbmFtZSh0eXBlLCBmaWVsZCkge1xyXG5cdFx0XHRjb25zdCByYXcgID0gZmllbGQubmFtZSB8fCBmaWVsZC5pZCB8fCAnJztcclxuXHRcdFx0bGV0IG5hbWUgICA9IGNvcmUuV1BCQ19CRkJfU2FuaXRpemUuc2FuaXRpemVfaHRtbF9uYW1lKCByYXcgKTtcclxuXHRcdFx0Y29uc3Qga2luZCA9ICh0eXBlID09PSAnc2VsZWN0JyB8fCB0eXBlID09PSAnc2VsZWN0Ym94JykgPyAnc2VsZWN0Ym94J1xyXG5cdFx0XHRcdDogKHR5cGUgPT09ICdwaG9uZScgfHwgdHlwZSA9PT0gJ3RlbCcpID8gJ3RlbCcgOiB0eXBlO1xyXG5cdFx0XHRpZiAoIG5hbWUudG9Mb3dlckNhc2UoKSA9PT0ga2luZC50b0xvd2VyQ2FzZSgpICkge1xyXG5cdFx0XHRcdG5hbWUgPSBgZl8ke25hbWV9YDtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gbmFtZTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHQvLyBsaXZlIGV4cG9ydCBpbnRlZ3JhdGlvbiBoZWxwZXJzIChubyBwYWdlIHJlbG9hZCBvbiBjb3B5KVxyXG5cdC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHRmdW5jdGlvbiB3cGJjX2JmYl9fZ2V0X2N1cnJlbnRfc3RydWN0dXJlKCkge1xyXG5cdFx0aWYgKCB3aW5kb3cud3BiY19iZmIgJiYgdHlwZW9mIHdpbmRvdy53cGJjX2JmYi5nZXRfc3RydWN0dXJlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRyZXR1cm4gd2luZG93LndwYmNfYmZiLmdldF9zdHJ1Y3R1cmUoKTsgLy8gTElWRSBVSSA+IEpTT05cclxuXHRcdH1cclxuXHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDX0JGQjogYnVpbGRlciBpbnN0YW5jZSBub3QgZm91bmQuJyApO1xyXG5cdFx0cmV0dXJuIFtdO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYWNxdWlyZV9wYXJzZXIoKSB7XHJcblx0XHRpZiAoIHdpbmRvdy53cGJjX3Nob3J0Y29kZV9wYXJzZXIgKSB7XHJcblx0XHRcdHJldHVybiB3aW5kb3cud3BiY19zaG9ydGNvZGVfcGFyc2VyO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCAhIHdpbmRvdy5XUEJDX0Zvcm1fU2hvcnRjb2RlX1BhcnNlciApIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0d2luZG93LldQQkNfQ09VTlRSSUVTID0gd2luZG93LldQQkNfQ09VTlRSSUVTIHx8IHtcclxuXHRcdFx0VVM6ICdVbml0ZWQgU3RhdGVzJyxcclxuXHRcdFx0R0I6ICdVbml0ZWQgS2luZ2RvbScsXHJcblx0XHRcdEZSOiAnRnJhbmNlJyxcclxuXHRcdFx0RVM6ICdTcGFpbidcclxuXHRcdH07XHJcblxyXG5cdFx0Y29uc3QgYm9va2luZ190eXBlID1cclxuXHRcdFx0XHQgIHdpbmRvdy5fd3BiY19idWlsZGVyPy5jdXJyZW50X2Jvb2tpbmdfdHlwZSA/P1xyXG5cdFx0XHRcdCAgd2luZG93LndwYmNfYmZiPy5jdXJyZW50X2Jvb2tpbmdfdHlwZSA/P1xyXG5cdFx0XHRcdCAgMTtcclxuXHJcblx0XHR0cnkge1xyXG5cdFx0XHR3aW5kb3cud3BiY19zaG9ydGNvZGVfcGFyc2VyID0gbmV3IFdQQkNfRm9ybV9TaG9ydGNvZGVfUGFyc2VyKCB7XHJcblx0XHRcdFx0Y3VycmVudF9ib29raW5nX3R5cGU6IFN0cmluZyggYm9va2luZ190eXBlICksXHJcblx0XHRcdFx0Y291bnRyaWVzX2xpc3QgICAgICA6IHdpbmRvdy5XUEJDX0NPVU5UUklFUyxcclxuXHRcdFx0XHRjdXJyZW50X2VkaXRfYm9va2luZzogd2luZG93Ll93cGJjX2J1aWxkZXI/LmN1cnJlbnRfZWRpdF9ib29raW5nIHx8IG51bGwsXHJcblx0XHRcdFx0cG9zdGVkX2RhdGEgICAgICAgICA6IHt9XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0cmV0dXJuIHdpbmRvdy53cGJjX3Nob3J0Y29kZV9wYXJzZXI7XHJcblx0XHR9IGNhdGNoICggX2UgKSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX2V4cG9ydF90b19hZHZhbmNlZF9mb3JtKHN0cnVjdHVyZSkge1xyXG5cclxuXHRcdGlmICggISBzdHJ1Y3R1cmUgKSB7XHJcblx0XHRcdHN0cnVjdHVyZSA9IHdwYmNfYmZiX19nZXRfY3VycmVudF9zdHJ1Y3R1cmUoKTtcclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCBhZGFwdGVkID0gYWRhcHRfYnVpbGRlcl9zdHJ1Y3R1cmVfdG9fZXhwb3J0ZXIoIHN0cnVjdHVyZSApO1xyXG5cdFx0Y29uc3Qgb3V0cHV0ICA9IFdQQkNfQkZCX0V4cG9ydGVyLmV4cG9ydF9mb3JtKCBhZGFwdGVkLCB7IGFkZExhYmVsczogdHJ1ZSwgZ2FwUGVyY2VudDogMyB9ICk7XHJcblxyXG5cdFx0bGV0IGJveCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2FkdmFuY2VkX2Zvcm1fb3V0cHV0JyApO1xyXG5cdFx0bGV0IHB2ICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2FkdmFuY2VkX2Zvcm1fcHJldmlldycgKTtcclxuXHJcblx0XHRpZiAoICEgYm94ICkge1xyXG5cdFx0XHRjb25zdCBzYXZlX2J0biAgICAgICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX3NhdmVfYnRuJyApO1xyXG5cdFx0XHRjb25zdCB3cmFwICAgICAgICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0XHRcdHdyYXAuc3R5bGUubWFyZ2luVG9wID0gJzE0cHgnO1xyXG5cclxuXHRcdFx0Y29uc3QgaCAgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnaDQnICk7XHJcblx0XHRcdGgudGV4dENvbnRlbnQgID0gJ0FkdmFuY2VkIEZvcm0gKGV4cG9ydCknO1xyXG5cdFx0XHRoLnN0eWxlLm1hcmdpbiA9ICcwIDAgNnB4JztcclxuXHJcblx0XHRcdGJveCAgICAgICAgICAgICAgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3RleHRhcmVhJyApO1xyXG5cdFx0XHRib3guaWQgICAgICAgICAgICAgICA9ICd3cGJjX2JmYl9fYWR2YW5jZWRfZm9ybV9vdXRwdXQnO1xyXG5cdFx0XHRib3guc3R5bGUud2lkdGggICAgICA9ICcxMDAlJztcclxuXHRcdFx0Ym94LnN0eWxlLm1pbkhlaWdodCAgPSAnMjQwcHgnO1xyXG5cdFx0XHRib3guc3R5bGUuZm9udEZhbWlseSA9ICdtb25vc3BhY2UnO1xyXG5cdFx0XHRib3guc3R5bGUuZm9udFNpemUgICA9ICcxMnB4JztcclxuXHRcdFx0Ym94LnJlYWRPbmx5ICAgICAgICAgPSBmYWxzZTtcclxuXHJcblx0XHRcdGNvbnN0IGNvcHlfYnRuICAgICAgICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdidXR0b24nICk7XHJcblx0XHRcdGNvcHlfYnRuLnR5cGUgICAgICAgICAgICA9ICdidXR0b24nO1xyXG5cdFx0XHRjb3B5X2J0bi5jbGFzc05hbWUgICAgICAgPSAnYnV0dG9uJztcclxuXHRcdFx0Y29weV9idG4udGV4dENvbnRlbnQgICAgID0gJ0NvcHkgdG8gQ2xpcGJvYXJkJztcclxuXHRcdFx0Y29weV9idG4uc3R5bGUubWFyZ2luVG9wID0gJzhweCc7XHJcblx0XHRcdGNvcHlfYnRuLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGFzeW5jIChlKSA9PiB7XHJcblxyXG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRjb25zdCBvayA9IGF3YWl0IHdwYmNfY29weV90b19jbGlwYm9hcmQoIGJveC52YWx1ZSApO1xyXG5cclxuXHRcdFx0XHRpZiAoIG9rICkge1xyXG5cdFx0XHRcdFx0Y29weV9idG4udGV4dENvbnRlbnQgPSAnQ29waWVkISc7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdGJveC5mb2N1cygpO1xyXG5cdFx0XHRcdFx0XHRib3guc2VsZWN0KCk7XHJcblx0XHRcdFx0XHR9IGNhdGNoICggXyApIHtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGNvcHlfYnRuLnRleHRDb250ZW50ID0gJ1ByZXNzIEN0cmwvQ21kK0MgdG8gY29weSc7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRzZXRUaW1lb3V0KCAoKSA9PiAoY29weV9idG4udGV4dENvbnRlbnQgPSAnQ29weSB0byBDbGlwYm9hcmQnKSwgMTUwMCApO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRjb25zdCBwdl9sYWJlbCAgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xyXG5cdFx0XHRwdl9sYWJlbC50ZXh0Q29udGVudCAgPSAnTGl2ZSBwcmV2aWV3Oic7XHJcblx0XHRcdHB2X2xhYmVsLnN0eWxlLm1hcmdpbiA9ICcxMnB4IDAgNHB4JztcclxuXHJcblx0XHRcdHB2ICAgICAgICAgICAgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xyXG5cdFx0XHRwdi5pZCAgICAgICAgICAgICAgID0gJ3dwYmNfYmZiX19hZHZhbmNlZF9mb3JtX3ByZXZpZXcnO1xyXG5cdFx0XHRwdi5jbGFzc05hbWUgICAgICAgID0gJ3dwYmNfYmZiX19hZHZhbmNlZF9mb3JtX3ByZXZpZXcnO1xyXG5cdFx0XHRwdi5zdHlsZS5taW5IZWlnaHQgID0gJzYwcHgnO1xyXG5cdFx0XHRwdi5zdHlsZS5ib3JkZXIgICAgID0gJzFweCBzb2xpZCAjZTVlN2ViJztcclxuXHRcdFx0cHYuc3R5bGUucGFkZGluZyAgICA9ICc4cHgnO1xyXG5cdFx0XHRwdi5zdHlsZS5iYWNrZ3JvdW5kID0gJyNmZmYnO1xyXG5cclxuXHRcdFx0d3JhcC5hcHBlbmRDaGlsZCggaCApO1xyXG5cdFx0XHR3cmFwLmFwcGVuZENoaWxkKCBib3ggKTtcclxuXHRcdFx0d3JhcC5hcHBlbmRDaGlsZCggY29weV9idG4gKTtcclxuXHRcdFx0d3JhcC5hcHBlbmRDaGlsZCggcHZfbGFiZWwgKTtcclxuXHRcdFx0d3JhcC5hcHBlbmRDaGlsZCggcHYgKTtcclxuXHJcblx0XHRcdGlmICggc2F2ZV9idG4gJiYgc2F2ZV9idG4ucGFyZW50Tm9kZSApIHtcclxuXHRcdFx0XHRzYXZlX2J0bi5wYXJlbnROb2RlLmFwcGVuZENoaWxkKCB3cmFwICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggd3JhcCApO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2UgaWYgKCAhIHB2ICkge1xyXG5cdFx0XHRwdiAgICAgICAgICAgICAgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcclxuXHRcdFx0cHYuaWQgICAgICAgICAgICAgICA9ICd3cGJjX2JmYl9fYWR2YW5jZWRfZm9ybV9wcmV2aWV3JztcclxuXHRcdFx0cHYuY2xhc3NOYW1lICAgICAgICA9ICd3cGJjX2JmYl9fYWR2YW5jZWRfZm9ybV9wcmV2aWV3JztcclxuXHRcdFx0cHYuc3R5bGUubWluSGVpZ2h0ICA9ICc2MHB4JztcclxuXHRcdFx0cHYuc3R5bGUuYm9yZGVyICAgICA9ICcxcHggc29saWQgI2U1ZTdlYic7XHJcblx0XHRcdHB2LnN0eWxlLnBhZGRpbmcgICAgPSAnOHB4JztcclxuXHRcdFx0cHYuc3R5bGUuYmFja2dyb3VuZCA9ICcjZmZmJztcclxuXHRcdFx0Ym94Lmluc2VydEFkamFjZW50RWxlbWVudCggJ2FmdGVyZW5kJywgcHYgKTtcclxuXHRcdH1cclxuXHJcblx0XHRib3gudmFsdWUgPSBvdXRwdXQ7XHJcblxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0Ym94LmRpc3BhdGNoRXZlbnQoIG5ldyBFdmVudCggJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0gKSApO1xyXG5cdFx0fSBjYXRjaCAoIF8gKSB7XHJcblx0XHR9XHJcblxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0Y29uc3QgcGFyc2VyID0gYWNxdWlyZV9wYXJzZXIoKTtcclxuXHRcdFx0aWYgKCBwdiAmJiBwYXJzZXI/LmZvcm1fZWxlbWVudHMgKSB7XHJcblx0XHRcdFx0cHYuaW5uZXJIVE1MID0gcGFyc2VyLmZvcm1fZWxlbWVudHMoIGJveC52YWx1ZSwgdHJ1ZSApIHx8ICc8ZW0+Tm90aGluZyB0byBwcmV2aWV3LjwvZW0+JztcclxuXHRcdFx0fVxyXG5cdFx0fSBjYXRjaCAoIF9lICkge1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0KCBmdW5jdGlvbiBhZGRfZXhwb3J0X2J1dHRvbigpIHtcclxuXHRcdGNvbnN0IHNhdmVfYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9fc2F2ZV9idG4nICk7XHJcblx0XHRpZiAoICEgc2F2ZV9idG4gfHwgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9fZXhwb3J0X2J0bicgKSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNvbnN0IGJ0biAgICAgICAgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2J1dHRvbicgKTtcclxuXHRcdGJ0bi50eXBlICAgICAgICAgICAgID0gJ2J1dHRvbic7IC8vIG5ldmVyIHN1Ym1pdC5cclxuXHRcdGJ0bi5pZCAgICAgICAgICAgICAgID0gJ3dwYmNfYmZiX19leHBvcnRfYnRuJztcclxuXHRcdGJ0bi5jbGFzc05hbWUgICAgICAgID0gJ2J1dHRvbic7XHJcblx0XHRidG4uc3R5bGUubWFyZ2luTGVmdCA9ICc4cHgnO1xyXG5cdFx0YnRuLnRleHRDb250ZW50ICAgICAgPSAnRXhwb3J0IHRvIEFkdmFuY2VkIEZvcm0nO1xyXG5cclxuXHRcdGJ0bi5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCAoZSkgPT4ge1xyXG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHRjb25zdCBiID0gd2luZG93LndwYmNfYmZiO1xyXG5cdFx0XHRsZXQgc3RydWN0dXJlO1xyXG5cclxuXHRcdFx0aWYgKCBiICYmIHR5cGVvZiBiLmdldF9zdHJ1Y3R1cmUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0c3RydWN0dXJlID0gYi5nZXRfc3RydWN0dXJlKCk7XHJcblxyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRjb25zb2xlLmxvZyggSlNPTi5zdHJpbmdpZnkoIHN0cnVjdHVyZSwgbnVsbCwgMiApICk7XHJcblx0XHRcdFx0fSBjYXRjaCAoIF8gKSB7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0aWYgKCB3aW5kb3cuV1BCQ19CRkJfRXZlbnRzICkge1xyXG5cdFx0XHRcdFx0XHRiLmJ1cz8uZW1pdD8uKCB3aW5kb3cuV1BCQ19CRkJfRXZlbnRzLlNUUlVDVFVSRV9DSEFOR0UsIHsgc3RydWN0dXJlIH0gKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGRvY3VtZW50LmRpc3BhdGNoRXZlbnQoIG5ldyBDdXN0b21FdmVudCggJ3dwYmM6YmZiOnN0cnVjdHVyZTpjaGFuZ2UnLCB7IGRldGFpbDogeyBzdHJ1Y3R1cmUgfSwgYnViYmxlczogdHJ1ZSB9ICkgKTtcclxuXHRcdFx0XHR9IGNhdGNoICggXyApIHtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRiLmxvYWRfc2F2ZWRfc3RydWN0dXJlKCBzdHJ1Y3R1cmUsIHsgZGVmZXJJZlR5cGluZzogZmFsc2UgfSApO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBfICkge1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0d3BiY19iZmJfX2V4cG9ydF90b19hZHZhbmNlZF9mb3JtKCBzdHJ1Y3R1cmUgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRzYXZlX2J0bi5wYXJlbnROb2RlPy5pbnNlcnRCZWZvcmUoIGJ0biwgc2F2ZV9idG4ubmV4dFNpYmxpbmcgKTtcclxuXHR9KSgpO1xyXG5cclxuXHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzpiZmI6c3RydWN0dXJlOmNoYW5nZScsICgpID0+IHtcclxuXHRcdGNvbnN0IGJveCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2FkdmFuY2VkX2Zvcm1fb3V0cHV0JyApO1xyXG5cdFx0aWYgKCBib3ggKSB7XHJcblx0XHRcdHdwYmNfYmZiX19leHBvcnRfdG9fYWR2YW5jZWRfZm9ybSggd3BiY19iZmJfX2dldF9jdXJyZW50X3N0cnVjdHVyZSgpICk7XHJcblx0XHR9XHJc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
