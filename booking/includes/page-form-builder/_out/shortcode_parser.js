"use strict";

/**
 * WPBC_Form_Shortcode_Parser
 * ES6 class that mirrors WP Booking Calendar's PHP parsing & rendering logic.
 *
 * Usage:
 *   const parser = new WPBC_Form_Shortcode_Parser({
 *     current_booking_type: '4',
 *     countries_list: { US: 'United States', FR: 'France', ... },
 *     current_edit_booking: { parsed_form: { email4: { value:'a@b.com' }, checkbox4: { value:'Yes,No' } } },
 *     posted_data: { email4: 'x@y.com' }   // optional: emulate $_POST re-render
 *   });
 *
 *   // Replace shortcodes with HTML:
 *   const html = parser.form_elements(formString, true);
 *
 *   // Or only parse elements (no replacement):
 *   const elements = parser.form_elements(formString, false);
 *
 *   // Parse "~" + "^" stored form string like get_booking_data():
 *   const parsed_form = parser.parse_booking_form_string(savedFormStr, bookingTypeIdString);
 */
class WPBC_Form_Shortcode_Parser {
  constructor(opts = {}) {
    this.current_booking_type = String(opts.current_booking_type ?? '');
    this.countries_list = opts.countries_list || {};
    this.current_edit_booking = opts.current_edit_booking || null;
    this.processing_unit_tag = opts.processing_unit_tag || null;
    this.posted_data = opts.posted_data || {}; // emulate $_POST for re-render / validation
  }

  // ----------------------------- utils

  esc_attr(v) {
    if (v == null) return '';
    return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  strip_quote(text) {
    const t = String(text).trim();
    const m1 = t.match(/^"(.*)"$/);
    if (m1) return m1[1];
    const m2 = t.match(/^'(.*)'$/);
    if (m2) return m2[1];
    return t;
  }
  strip_quote_deep(arr) {
    if (typeof arr === 'string') return this.strip_quote(arr);
    if (Array.isArray(arr)) return arr.map(x => this.strip_quote(x));
    return arr;
  }
  get_pipes(values) {
    const pipes = [];
    for (const value of values) {
      const pipe_pos = value.indexOf('|');
      if (pipe_pos === -1) {
        pipes.push([value, value]);
      } else {
        const before = value.substring(0, pipe_pos);
        const after = value.substring(pipe_pos + 1);
        pipes.push([before, after]);
      }
    }
    return pipes;
  }
  get_pipe_ins(pipes) {
    const ins = [];
    for (const [before] of pipes) {
      if (!ins.includes(before)) ins.push(before);
    }
    return ins;
  }
  pipe(pipes, value) {
    if (Array.isArray(value)) return value.map(v => this.pipe(pipes, v));
    for (const p of pipes) {
      if (p[0] === value) return p[1];
    }
    return value;
  }

  // ----------------------------- parser core

  /**
   * Parse a single shortcode match into {type,name,options,values,raw_values}
   * Mirrors PHP form_element_parse()
   */
  form_element_parse(match) {
    // JS regex groups mirror the ones constructed in form_elements()
    // match[1] => type, match[2] => name, match[3] => options chunk, match[4] => quoted values chunk
    const type = String(match[1]).trim();
    const name = String(match[2] || '').trim();
    const options = String(match[3] || '').trim() ? String(match[3]).trim().split(/\s+/) : [];
    const q = String(match[4] || '');
    const raw_values = this.strip_quote_deep(q.match(/"[^"]*"|'[^']*'/g) || []);
    let values;
    if (/^(select\*?|selectbox\*?|checkbox\*?|radio\*?|quiz)$/.test(type)) {
      const pipes = this.get_pipes(raw_values);
      values = this.get_pipe_ins(pipes);
    } else {
      values = raw_values;
    }
    return {
      type,
      name,
      options,
      values,
      raw_values
    };
  }

  /**
   * Replace callback -> routes to renderer
   */
  form_element_replace_callback(match) {
    // Defaults compatible with PHP (avoid undefined notices)
    let type = '';
    let options = [];
    let raw_values = [];
    let values = []; // <-- declare values
    let this_name = ''; // <-- declare this_name (fixes ReferenceError)

    ({
      type,
      name: this_name,
      options,
      values,
      raw_values
    } = this.form_element_parse(match));

    // Country name defaulting like PHP (if empty name, use type).
    if (type === 'country' || type === 'country*') {
      if (!this_name) this_name = type;
    }

    // Name includes current booking type suffix
    let name = this_name + this.current_booking_type;

    // Emulate edit-mode defaults from current_edit_booking.parsed_form
    // For list fields, convert stored "a,b,c" to default: selections.
    if (this.current_edit_booking && this.current_edit_booking.parsed_form) {
      const parsed = this.current_edit_booking.parsed_form;
      const plugDefaults = () => {
        const entry = parsed[name];
        if (!entry) return;
        if (/^(?:select|selectbox|country|checkbox|radio)\*?$/.test(type)) {
          options = Array.isArray(options) ? options.slice() : [];
          // remove explicit default:... from options
          options = options.filter(op => !/^default:/.test(op));
          const selectedList = String(entry.value || '').split(',');
          for (const s of selectedList) {
            if (s !== '') options.push('default:' + s);
          }
        } else if (/(^starttime\*?$)|(^endtime\*?$)/.test(type)) {
          // Special names in PHP: starttime{type}, endtime{type}
          const tname = (type.startsWith('starttime') ? 'starttime' : 'endtime') + this.current_booking_type;
          const e = parsed[tname];
          values = [e && e.value ? e.value : ''];
        } else if (/^country\*?$/.test(type)) {
          const tname = 'country' + this.current_booking_type;
          const e = parsed[tname];
          if (e && e.value) options = ['default:' + e.value];
        } else {
          const e = parsed[name];
          values = [e && e.value ? e.value : ''];
        }
      };
      plugDefaults();
    }

    // Validation error (JS side: optional hook; empty by default)
    const validation_error = ''; // You can integrate your validator and inject here.

    // Attributes from options
    let atts = '';
    const only_field_name = name.substring(0, name.length - this.current_booking_type.length);
    atts += ` autocomplete="${this.esc_attr(only_field_name)}"`;

    // id:
    const idOpt = options.find(o => /^id:[-0-9a-zA-Z_]+$/.test(o));
    if (idOpt) {
      const id = idOpt.split(':')[1];
      atts += ` id="${this.esc_attr(id + this.current_booking_type)}"`;
    }

    // placeholder:
    const phOpt = options.find(o => /^placeholder:[-0-9a-zA-Z_//]+$/.test(o));
    if (phOpt) {
      const ph = phOpt.split(':')[1].replace(/_/g, ' ');
      atts += ` placeholder="${this.esc_attr(ph)}"`;
    }

    // classes
    let class_att = '';
    const cls = options.filter(o => /^class:[-0-9a-zA-Z_]+$/.test(o)).map(o => o.split(':')[1]);
    if (cls.length) class_att += ' ' + cls.join(' ');
    if (/^email\*?$/.test(type)) class_att += ' wpdev-validates-as-email';
    if (/^coupon\*?$/.test(type)) class_att += ' wpdev-validates-as-coupon';
    if (/^time\*?$/.test(type)) class_att += ' wpdev-validates-as-time';
    if (/^starttime\*?$/.test(type)) class_att += ' wpdev-validates-as-time';
    if (/^endtime\*?$/.test(type)) class_att += ' wpdev-validates-as-time';
    if (/\*$/.test(type)) class_att += ' wpdev-validates-as-required';
    if (/^checkbox\*?$/.test(type)) class_att += ' wpdev-checkbox';
    if (/^radio\*?$/.test(type)) class_att += ' wpdev-radio';
    if (/^captchac$/.test(type)) class_att += ' wpdev-captcha-' + name;
    if (type === 'acceptance') {
      class_att += ' wpdev-acceptance';
      if (options.includes('invert')) class_att += ' wpdev-invert';
    }
    if (class_att) atts += ` class="${class_att.trim()}"`;

    // Posted value re-population (mirrors PHP $_POST usage)
    let value = '';
    if (Object.prototype.hasOwnProperty.call(this.posted_data, name)) {
      value = this.posted_data[name];
    } else if (Array.isArray(values) && values[0] != null) {
      value = values[0];
    }

    // Special name normalization for starttime/endtime
    if (type.startsWith('starttime')) name = 'starttime' + this.current_booking_type;
    if (type.startsWith('endtime')) name = 'endtime' + this.current_booking_type;

    // Switch renderers
    return this.render_element({
      type,
      name,
      atts,
      options,
      values,
      validation_error,
      value
    });
  }

  /**
   * Render element to HTML (string), emulating PHP switch-case.
   */
  render_element({
    type,
    name,
    atts,
    options,
    values,
    validation_error,
    value
  }) {
    // Text-like
    if (/^(starttime\*?|endtime\*?|time\*?|text\*?|email\*?|coupon\*?|captchar)$/.test(type)) {
      // size/maxlength: "40/255" or "40x255"
      const sizeOpt = (options || []).find(o => /^[0-9]*[\/x][0-9]*$/.test(o)) || '';
      let sizeAttr = ' size="40"';
      let maxlenAttr = '';
      if (sizeOpt) {
        const m = sizeOpt.match(/^([0-9]*)[\/x]([0-9]*)$/);
        if (m) {
          if (m[1]) sizeAttr = ` size="${parseInt(m[1], 10) || 40}"`;
          if (m[2]) maxlenAttr = ` maxlength="${parseInt(m[2], 10) || ''}"`;
        }
      }
      const additional_js = /^coupon\*?$/.test(type) ? ' onchange="if(window.wpbc_show_cost_hints_after_few_seconds){wpbc_show_cost_hints_after_few_seconds(' + this.current_booking_type + ');}" ' : '';
      const field_type = /^email\*?$/.test(type) ? 'type="email"' : 'type="text"';
      const html = `<input ${field_type} name="${this.esc_attr(name)}" value="${this.esc_attr(value)}"${atts}${sizeAttr}${maxlenAttr}${additional_js}/>`;
      return `<span class="wpbc_wrap_text wpdev-form-control-wrap ${this.esc_attr(name)}">${html}${validation_error}</span>`;
    }

    // Textarea
    if (/^textarea\*?$/.test(type)) {
      // cols/rows "40x10" or "40/10"
      const crOpt = (options || []).find(o => /^[0-9]*[x/][0-9]*$/.test(o));
      let crAttr = '';
      if (crOpt) {
        const m = crOpt.match(/^([0-9]*)[x\/]([0-9]*)$/);
        if (m) {
          if (m[1]) crAttr += ` cols="${parseInt(m[1], 10) || ''}"`;
          if (m[2]) crAttr += ` rows="${parseInt(m[2], 10) || ''}"`;
        }
      }
      const html = `<textarea name="${this.esc_attr(name)}"${atts}${crAttr}>${this.esc_attr(value)}</textarea>`;
      return `<span class="wpbc_wrap_textarea wpdev-form-control-wrap ${this.esc_attr(name)}">${html}${validation_error}</span>`;
    }

    // Country
    if (/^country\*?$/.test(type)) {
      // derive defaults from options default:XX
      let scr_default = [];
      const defaults = (options || []).filter(o => /^default:/.test(o));
      if (defaults.length) {
        const m = defaults[0].match(/^default:([0-9a-zA-Z_:\s-]+)$/);
        if (m && m[1]) scr_default = m[1].split('_');
      }
      let html = '';
      for (const [code, label] of Object.entries(this.countries_list)) {
        let selected = '';
        if (scr_default.includes(code)) selected = ' selected="selected"';
        if (value === code) selected = ' selected="selected"';
        html += `<option value="${this.esc_attr(code)}"${selected}>${this.esc_attr(label)}</option>`;
      }
      html = `<select name="${this.esc_attr(name)}"${atts}>${html}</select>`;
      return `<span class="wpbc_wrap_select wpdev-form-control-wrap ${this.esc_attr(name)}">${html}${validation_error}</span>`;
    }

    // Select / selectbox
    if (/^(select\*?|selectbox\*?)$/.test(type)) {
      const multiple = (options || []).includes('multiple');
      const include_blank = (options || []).includes('include_blank');
      let vals = Array.isArray(values) ? values.slice() : [];
      if (!vals.length || include_blank) vals.unshift('---');

      // defaults from options default:...
      const scr_defaults = (options || []).filter(o => /^default:/.test(o));
      const selectedPipeValues = [];
      for (const d of scr_defaults) {
        const m = d.match(/^default:([^~]+)$/);
        if (m && m[1]) {
          const part = m[1].split('_')[0].replace('&#37;', '%');
          selectedPipeValues.push(part);
        }
      }
      let html = '';
      for (let v of vals) {
        let label = null;
        if (v.includes('@@')) {
          const [ttl, vv] = v.split('@@');
          label = ttl;
          v = vv;
        }
        let selected = '';
        if (selectedPipeValues.includes(v)) selected = ' selected="selected"';
        if (this.posted_data && this.posted_data[name]) {
          const pd = this.posted_data[name];
          if (Array.isArray(pd) ? pd.includes(v) : String(pd) === v) selected = ' selected="selected"';
        }
        html += `<option value="${this.esc_attr(v)}"${selected}>${this.esc_attr(label ?? v)}</option>`;
      }
      const multAttr = multiple ? ' multiple="multiple"' : '';
      const onchange = ` onchange="if(window.wpbc_show_cost_hints_after_few_seconds){wpbc_show_cost_hints_after_few_seconds(${this.current_booking_type});}" `;
      const select = `<select${onchange} name="${this.esc_attr(name)}${multiple ? '[]' : ''}"${atts}${multAttr}>${html}</select>`;
      return `<span class="wpbc_wrap_select wpdev-form-control-wrap ${this.esc_attr(name)}">${select}${validation_error}</span>`;
    }

    // Checkbox / Radio
    if (/^(checkbox\*?|radio\*?)$/.test(type)) {
      const isCheckbox = /^checkbox/.test(type);
      const multiple = isCheckbox && !(options || []).includes('exclusive');
      const defaultOn = (options || []).some(o => o === 'default:on') ? ' checked="checked"' : '';

      // render group
      let groupIdAttr = '';
      let attsNoId = atts;
      // If label element requested, we remove ID from input and put on labels later
      let idMatch = atts.match(/\sid="([-0-9a-zA-Z_]+)"/);
      if (idMatch) {
        attsNoId = atts.replace(idMatch[0], '');
        groupIdAttr = ` id="${this.esc_attr(idMatch[1])}" `;
      }
      const use_label_element = (options || []).some(o => /^use[_-]?label[_-]?element$/.test(o));
      const label_first = (options || []).some(o => /^label[_-]?first$/.test(o));
      const label_wrap = (options || []).some(o => /^label[_-]?wrap$/.test(o));
      const input_type = isCheckbox ? 'checkbox' : 'radio';
      let htmlItems = '';

      // defaults from options default:a, default:b etc.
      const defaults = (options || []).filter(op => /^default:/.test(op)).map(s => s.replace(/^default:/, ''));
      const defaultsSet = new Set(defaults.join(',').split(',').map(s => s.trim()).filter(Boolean));
      (values || []).forEach((rawVal, idx) => {
        let labelText = rawVal;
        let v = rawVal;
        if (rawVal.includes('@@')) {
          const [ttl, vv] = rawVal.split('@@');
          labelText = ttl;
          v = vv;
        }

        // selected logic
        let checked = '';
        if (defaultsSet.has(v)) checked = ' checked="checked"';
        const pd = this.posted_data?.[name];
        if (pd) {
          if (multiple && Array.isArray(pd) && pd.includes(v)) checked = ' checked="checked"';
          if (!multiple && String(pd) === v) checked = ' checked="checked"';
        }

        // unique ID if using label element
        let idForInput = '';
        let labelForParam = '';
        if (use_label_element) {
          const uniq = (idMatch ? idMatch[1] : 'checkboxid') + String(Date.now()) + idx + Math.floor(1000 + Math.random() * 9000);
          idForInput = ` id="${this.esc_attr(uniq)}"`;
          labelForParam = ` for="${this.esc_attr(uniq)}"`;
        }
        const onchange = ` onchange="if(window.wpbc_show_cost_hints_after_few_seconds){wpbc_show_cost_hints_after_few_seconds(${this.current_booking_type});}" `;
        const nameAttr = `${this.esc_attr(name)}${multiple ? '[]' : ''}`;
        const input = `<input ${attsNoId}${idForInput}${onchange} type="${input_type}" name="${nameAttr}" value="${this.esc_attr(v)}"${checked}${defaultOn} />`;
        let item;
        if (label_wrap) {
          // <label>label or input first per label_first</label>
          if (label_first) {
            item = `<label${labelForParam} class="wpdev-list-item-label">${this.esc_attr(labelText)}${input}</label>`;
          } else {
            item = `<label${labelForParam} class="wpdev-list-item-label">${input}${this.esc_attr(labelText)}</label>`;
          }
        } else {
          const labelEl = use_label_element ? 'label' : 'span';
          const label = `<${labelEl}${labelForParam} class="wpdev-list-item-label">${this.esc_attr(labelText)}</${labelEl}>`;
          item = label_first ? label + input : input + label;
        }
        htmlItems += `<span class="wpdev-list-item">${item}</span>`;
      });
      const group = `<span${idMatch ? attsNoId : atts}${groupIdAttr}>${htmlItems}</span>`;
      return `<span class="wpbc_wrap_checkbox wpdev-form-control-wrap ${this.esc_attr(name)}">${group}${validation_error}</span>`;
    }

    // Quiz
    if (type === 'quiz') {
      // If no provided, default quiz like PHP
      let raw = Array.isArray(values) && values.length ? values.slice() : [];
      let raw_values = raw.length ? raw : ['1+1=?'];
      const pipes = this.get_pipes(raw.length ? raw.map(v => `${v}|${v}`) : ['1+1=?|2']); // emulate
      // pick one question
      const q = raw_values.length === 1 ? raw_values[0] : raw_values[Math.floor(Math.random() * raw_values.length)];
      const answer = this.pipe(pipes, q); // here equal, but kept for parity
      const hiddenHash = this.esc_attr(answer); // server hash not available; store clear or attach your own hash function
      let html = `<span class="wpdev-quiz-label">${this.esc_attr(q)}</span>&nbsp;`;
      html += `<input type="text" name="${this.esc_attr(name)}"${atts} />`;
      html += `<input type="hidden" name="wpdev_quiz_answer_${this.esc_attr(name)}" value="${hiddenHash}" />`;
      return `<span class="wpdev-form-control-wrap ${this.esc_attr(name)}">${html}${validation_error}</span>`;
    }

    // Acceptance
    if (type === 'acceptance') {
      const invert = (options || []).includes('invert'); // not used client-side here
      const defaultOn = (options || []).includes('default:on');
      const checked = defaultOn ? ' checked="checked"' : '';
      const onclick = ' onclick="if(window.wpdevToggleSubmit)wpdevToggleSubmit(this.form);"';
      const html = `<input type="checkbox" name="${this.esc_attr(name)}" value="1"${atts}${onclick}${checked} />`;
      return html;
    }

    // captchac (image) / captchar (input) — stubs
    if (type === 'captchac') {
      const html = `<img alt="CAPTCHA unavailable on front-end JS" src=""${atts} />`;
      const hidden = `<input type="hidden" name="wpdev_captcha_challenge_${this.esc_attr(name)}" value="" />`;
      return hidden + html;
    }
    if (type === 'captchar') {
      const html = `<input type="text" name="${this.esc_attr(name)}"${atts} />`;
      return `<span class="wpbc_wrap_text wpdev-form-control-wrap ${this.esc_attr(name)}">${html}${validation_error}</span>`;
    }

    // File
    if (/^file\*?$/.test(type)) {
      const html = `<input type="file" name="${this.esc_attr(name)}"${atts} />`;
      return `<span class="wpdev-form-control-wrap ${this.esc_attr(name)}">${html}${validation_error}</span>`;
    }

    // Submit button
    if (/^\[?submit/.test(type) || type === 'submit') {
      // Handle via submit_replace_callback (called separately when we parse submit)
      // Here: fallback simple button
      const valueText = 'Send';
      const btn = `<input type="button" value="${this.esc_attr(valueText)}"${atts} />`;
      return btn;
    }

    // Fallback: plain input text
    const html = `<input type="text" name="${this.esc_attr(name)}" value="${this.esc_attr(value)}"${atts} />`;
    return `<span class="wpbc_wrap_text wpdev-form-control-wrap ${this.esc_attr(name)}">${html}${validation_error}</span>`;
  }

  /**
   * Submit button replacement (separate pass, like PHP submit_replace_callback)
   */
  submit_replace_callback(match) {
    // match[1] => options area (classes/id), match[2] => quoted value (label)
    let atts = '';
    const optChunk = (match[1] || '').trim();
    const options = optChunk ? optChunk.split(/\s+/) : [];

    // id:
    const idOpt = options.find(o => /^id:[-0-9a-zA-Z_]+$/.test(o));
    if (idOpt) {
      const id = idOpt.split(':')[1];
      atts += ` id="${this.esc_attr(id)}"`;
    }

    // classes:
    const cls = options.filter(o => /^class:[-0-9a-zA-Z_]+$/.test(o)).map(o => o.split(':')[1]);
    const class_att = cls.length ? ` class="wpbc_button_light ${this.esc_attr(cls.join(' '))}"` : ` class="wpbc_button_light"`;
    atts += class_att;
    let value = (match[2] ? this.strip_quote(match[2]) : '') || 'Send';

    // No admin/edit hash flow on client; simple submit button hooking to JS:
    const btn = `<input type="button" value="${this.esc_attr(value)}"${atts} onclick="if(window.mybooking_submit){mybooking_submit(this.form, ${this.current_booking_type}, (window.wpbc_get_maybe_reloaded_booking_locale?wpbc_get_maybe_reloaded_booking_locale():''));}" />`;
    return btn;
  }

  /**
   * Parse & (optionally) replace all shortcodes in a form string.
   * When replace = false, returns an array of parsed elements.
   */
  form_elements(form, replace = true) {
    const types = String.raw`text[*]?|email[*]?|coupon[*]?|time[*]?|textarea[*]?|select[*]?|selectbox[*]?|checkbox[*]?|radio[*]?|acceptance|captchac|captchar|file[*]?|quiz`;
    const reMain = new RegExp(String.raw`\[\s*(` + types + String.raw`)(\s+[a-zA-Z][0-9a-zA-Z:._-]*)([-0-9a-zA-Z:#_/|\s]*)?((?:\s*(?:"[^"]*"|'[^']*'))*)?\s*\]`, 'g');
    // starttime|endtime|country variants
    const reStartEnd = new RegExp(String.raw`\[\s*(country[*]?|starttime[*]?|endtime[*]?)(\s*[a-zA-Z]*[0-9a-zA-Z:._-]*)([-0-9a-zA-Z:#_/|\s]*)?((?:\s*(?:"[^"]*"|'[^']*'))*)?\s*\]`, 'g');
    const reSubmit = new RegExp(String.raw`\[\s*submit(\s[-0-9a-zA-Z:#_/\s]*)?(\s+(?:"[^"]*"|'[^']*'))?\s*\]`, 'g');
    if (replace) {
      let out = String(form);
      out = out.replace(reMain, (...m) => this.form_element_replace_callback(m));
      out = out.replace(reStartEnd, (...m) => this.form_element_replace_callback(m));
      out = out.replace(reSubmit, (...m) => this.submit_replace_callback(m));
      return out;
    } else {
      const results = [];
      const addMatches = (regex, src) => {
        let match;
        while (match = regex.exec(src)) {
          results.push(this.form_element_parse(match));
        }
      };
      addMatches(new RegExp(reMain.source, 'g'), form);
      addMatches(new RegExp(reStartEnd.source, 'g'), form);
      // submit not included in parse-only in PHP, keeping parity
      return results;
    }
  }

  /**
   * Equivalent of get_booking_data() "parsed_form" splitter for stored form string.
   * Input example: "checkbox^fee4^true~text^name4^John"
   */
  parse_booking_form_string(formStr, booking_type_suffix = '') {
    const ret = {};
    if (!formStr) return ret;
    const parts = String(formStr).split('~');
    for (const field of parts) {
      const elems = field.split('^');
      if (elems.length < 3) continue;
      let type = elems[0];
      let element_name = elems[1];
      let value = elems[2];

      // booking type suffix handling (remove [] and trailing type)
      let type_name = element_name.replace('[]', '');
      if (booking_type_suffix && type_name.endsWith(booking_type_suffix)) {
        type_name = type_name.slice(0, -booking_type_suffix.length);
      }
      if (type === 'checkbox') {
        if (value === 'true') value = 'on';else if (value === 'false' || value === 'Off' || value == null) value = '';
      }
      element_name = element_name.replace('[]', '');
      if (ret[element_name]) {
        if (value !== '') ret[element_name].value += ',' + value;
      } else {
        ret[element_name] = {
          value,
          type,
          element_name: type_name
        };
      }
    }
    return ret;
  }
}

/* ================================================================================================
 *  Real-time Preview Wiring
 *  Requirements: window.WPBC_Form_Shortcode_Parser must be available (from the previous answer).
 * ================================================================================================ */

/* ================================================================================================
 *  Real-time Preview Wiring (complete)
 * ================================================================================================ */

(function setupLivePreview() {
  // 0) Booking type used to suffix names
  function _getCurrentBookingType() {
    const t = window._wpbc_builder?.current_booking_type ?? window.wpbc_bfb?.current_booking_type ?? 1;
    return String(t);
  }

  // 1) Single shared parser instance
  function _getParser() {
    if (!window.WPBC_Form_Shortcode_Parser) return null;
    if (!window.wpbc_shortcode_parser) {
      window.WPBC_COUNTRIES = window.WPBC_COUNTRIES || {
        US: 'United States',
        GB: 'United Kingdom',
        FR: 'France',
        ES: 'Spain'
      };
      window.wpbc_shortcode_parser = new WPBC_Form_Shortcode_Parser({
        current_booking_type: _getCurrentBookingType(),
        countries_list: window.WPBC_COUNTRIES,
        current_edit_booking: window._wpbc_builder?.current_edit_booking || null,
        posted_data: {}
      });
    }
    window.wpbc_shortcode_parser.current_booking_type = _getCurrentBookingType();
    return window.wpbc_shortcode_parser;
  }

  // 2) Build (or reuse) the UI
  function _ensureExportUI() {
    let wrap = document.getElementById('wpbc_bfb__export_wrap');
    if (!wrap) {
      const after = document.getElementById('wpbc_bfb__inspector') || document.body;
      wrap = document.createElement('section');
      wrap.id = 'wpbc_bfb__export_wrap';
      wrap.className = 'wpbc_bfb__export_wrap';
      wrap.style.margin = '16px 0';
      const title = document.createElement('h4');
      title.textContent = 'Advanced Form (export) + Live Preview';
      title.style.margin = '0 0 6px';
      const ta = document.createElement('textarea');
      ta.id = 'wpbc_bfb__advanced_form_output';
      ta.rows = 10;
      ta.style.width = '100%';
      ta.style.fontFamily = 'monospace';
      ta.placeholder = 'Paste or type your WPBC shortcode form here…';
      const actions = document.createElement('div');
      actions.style.margin = '8px 0';
      const copy = document.createElement('button');
      copy.id = 'wpbc_bfb__copy_btn';
      copy.type = 'button';
      copy.className = 'button';
      copy.textContent = 'Copy';
      actions.appendChild(copy);
      const pvLabel = document.createElement('div');
      pvLabel.textContent = 'Live preview:';
      pvLabel.style.margin = '12px 0 4px';
      const pv = document.createElement('div');
      pv.id = 'wpbc_bfb__advanced_form_preview';
      pv.className = 'wpbc_bfb__advanced_form_preview';
      pv.style.minHeight = '60px';
      pv.style.border = '1px solid #e5e7eb';
      pv.style.padding = '8px';
      pv.style.background = '#fff';
      wrap.append(title, ta, actions, pvLabel, pv);

      // Insert after inspector so it stays nearby
      if (after.parentNode) after.parentNode.insertBefore(wrap, after.nextSibling);else document.body.appendChild(wrap);
    }
    return {
      wrap,
      ta: document.getElementById('wpbc_bfb__advanced_form_output'),
      pv: document.getElementById('wpbc_bfb__advanced_form_preview'),
      copy: document.getElementById('wpbc_bfb__copy_btn')
    };
  }

  // 3) Render preview
  function _renderPreview(ta, pv) {
    const parser = _getParser();
    if (!parser) {
      pv.innerHTML = '<em>Parser not available yet.</em>';
      return;
    }
    try {
      const html = parser.form_elements(ta.value || '', true);
      pv.innerHTML = html || '<em>Nothing to preview.</em>';
    } catch (err) {
      pv.innerHTML = '<pre style="white-space:pre-wrap;color:#b91c1c;"></pre>';
      pv.firstChild.textContent = String(err && err.message || err);
    }
  }

  // 4) Copy button
  function _wireCopy(copy, ta) {
    if (!copy) return;
    copy.addEventListener('click', () => {
      ta.select();
      const ok = document.execCommand && document.execCommand('copy');
      if (!ok && navigator.clipboard) navigator.clipboard.writeText(ta.value || '');
      copy.textContent = 'Copied!';
      setTimeout(() => copy.textContent = 'Copy', 1200);
    });
  }

  // 5) Init
  function _init() {
    const {
      ta,
      pv,
      copy
    } = _ensureExportUI();
    const debounce = (fn, wait = 150) => {
      let t;
      return (...a) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...a), wait);
      };
    };
    const update = () => _renderPreview(ta, pv);
    ta.addEventListener('input', debounce(update, 120));
    ta.addEventListener('change', update);
    _wireCopy(copy, ta);

    // First render
    update();

    // Keep fresh when the builder reloads structure
    const EV = window.WPBC_BFB_Events || {};
    document.addEventListener(EV.STRUCTURE_LOADED || 'wpbc:bfb:structure:loaded', update);
    document.addEventListener(EV.STRUCTURE_CHANGE || 'wpbc:bfb:structure:change', update);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9zaG9ydGNvZGVfcGFyc2VyLmpzIiwibmFtZXMiOlsiV1BCQ19Gb3JtX1Nob3J0Y29kZV9QYXJzZXIiLCJjb25zdHJ1Y3RvciIsIm9wdHMiLCJjdXJyZW50X2Jvb2tpbmdfdHlwZSIsIlN0cmluZyIsImNvdW50cmllc19saXN0IiwiY3VycmVudF9lZGl0X2Jvb2tpbmciLCJwcm9jZXNzaW5nX3VuaXRfdGFnIiwicG9zdGVkX2RhdGEiLCJlc2NfYXR0ciIsInYiLCJyZXBsYWNlIiwic3RyaXBfcXVvdGUiLCJ0ZXh0IiwidCIsInRyaW0iLCJtMSIsIm1hdGNoIiwibTIiLCJzdHJpcF9xdW90ZV9kZWVwIiwiYXJyIiwiQXJyYXkiLCJpc0FycmF5IiwibWFwIiwieCIsImdldF9waXBlcyIsInZhbHVlcyIsInBpcGVzIiwidmFsdWUiLCJwaXBlX3BvcyIsImluZGV4T2YiLCJwdXNoIiwiYmVmb3JlIiwic3Vic3RyaW5nIiwiYWZ0ZXIiLCJnZXRfcGlwZV9pbnMiLCJpbnMiLCJpbmNsdWRlcyIsInBpcGUiLCJwIiwiZm9ybV9lbGVtZW50X3BhcnNlIiwidHlwZSIsIm5hbWUiLCJvcHRpb25zIiwic3BsaXQiLCJxIiwicmF3X3ZhbHVlcyIsInRlc3QiLCJmb3JtX2VsZW1lbnRfcmVwbGFjZV9jYWxsYmFjayIsInRoaXNfbmFtZSIsInBhcnNlZF9mb3JtIiwicGFyc2VkIiwicGx1Z0RlZmF1bHRzIiwiZW50cnkiLCJzbGljZSIsImZpbHRlciIsIm9wIiwic2VsZWN0ZWRMaXN0IiwicyIsInRuYW1lIiwic3RhcnRzV2l0aCIsImUiLCJ2YWxpZGF0aW9uX2Vycm9yIiwiYXR0cyIsIm9ubHlfZmllbGRfbmFtZSIsImxlbmd0aCIsImlkT3B0IiwiZmluZCIsIm8iLCJpZCIsInBoT3B0IiwicGgiLCJjbGFzc19hdHQiLCJjbHMiLCJqb2luIiwiT2JqZWN0IiwicHJvdG90eXBlIiwiaGFzT3duUHJvcGVydHkiLCJjYWxsIiwicmVuZGVyX2VsZW1lbnQiLCJzaXplT3B0Iiwic2l6ZUF0dHIiLCJtYXhsZW5BdHRyIiwibSIsInBhcnNlSW50IiwiYWRkaXRpb25hbF9qcyIsImZpZWxkX3R5cGUiLCJodG1sIiwiY3JPcHQiLCJjckF0dHIiLCJzY3JfZGVmYXVsdCIsImRlZmF1bHRzIiwiY29kZSIsImxhYmVsIiwiZW50cmllcyIsInNlbGVjdGVkIiwibXVsdGlwbGUiLCJpbmNsdWRlX2JsYW5rIiwidmFscyIsInVuc2hpZnQiLCJzY3JfZGVmYXVsdHMiLCJzZWxlY3RlZFBpcGVWYWx1ZXMiLCJkIiwicGFydCIsInR0bCIsInZ2IiwicGQiLCJtdWx0QXR0ciIsIm9uY2hhbmdlIiwic2VsZWN0IiwiaXNDaGVja2JveCIsImRlZmF1bHRPbiIsInNvbWUiLCJncm91cElkQXR0ciIsImF0dHNOb0lkIiwiaWRNYXRjaCIsInVzZV9sYWJlbF9lbGVtZW50IiwibGFiZWxfZmlyc3QiLCJsYWJlbF93cmFwIiwiaW5wdXRfdHlwZSIsImh0bWxJdGVtcyIsImRlZmF1bHRzU2V0IiwiU2V0IiwiQm9vbGVhbiIsImZvckVhY2giLCJyYXdWYWwiLCJpZHgiLCJsYWJlbFRleHQiLCJjaGVja2VkIiwiaGFzIiwiaWRGb3JJbnB1dCIsImxhYmVsRm9yUGFyYW0iLCJ1bmlxIiwiRGF0ZSIsIm5vdyIsIk1hdGgiLCJmbG9vciIsInJhbmRvbSIsIm5hbWVBdHRyIiwiaW5wdXQiLCJpdGVtIiwibGFiZWxFbCIsImdyb3VwIiwicmF3IiwiYW5zd2VyIiwiaGlkZGVuSGFzaCIsImludmVydCIsIm9uY2xpY2siLCJoaWRkZW4iLCJ2YWx1ZVRleHQiLCJidG4iLCJzdWJtaXRfcmVwbGFjZV9jYWxsYmFjayIsIm9wdENodW5rIiwiZm9ybV9lbGVtZW50cyIsImZvcm0iLCJ0eXBlcyIsInJlTWFpbiIsIlJlZ0V4cCIsInJlU3RhcnRFbmQiLCJyZVN1Ym1pdCIsIm91dCIsInJlc3VsdHMiLCJhZGRNYXRjaGVzIiwicmVnZXgiLCJzcmMiLCJleGVjIiwic291cmNlIiwicGFyc2VfYm9va2luZ19mb3JtX3N0cmluZyIsImZvcm1TdHIiLCJib29raW5nX3R5cGVfc3VmZml4IiwicmV0IiwicGFydHMiLCJmaWVsZCIsImVsZW1zIiwiZWxlbWVudF9uYW1lIiwidHlwZV9uYW1lIiwiZW5kc1dpdGgiLCJzZXR1cExpdmVQcmV2aWV3IiwiX2dldEN1cnJlbnRCb29raW5nVHlwZSIsIndpbmRvdyIsIl93cGJjX2J1aWxkZXIiLCJ3cGJjX2JmYiIsIl9nZXRQYXJzZXIiLCJ3cGJjX3Nob3J0Y29kZV9wYXJzZXIiLCJXUEJDX0NPVU5UUklFUyIsIlVTIiwiR0IiLCJGUiIsIkVTIiwiX2Vuc3VyZUV4cG9ydFVJIiwid3JhcCIsImRvY3VtZW50IiwiZ2V0RWxlbWVudEJ5SWQiLCJib2R5IiwiY3JlYXRlRWxlbWVudCIsImNsYXNzTmFtZSIsInN0eWxlIiwibWFyZ2luIiwidGl0bGUiLCJ0ZXh0Q29udGVudCIsInRhIiwicm93cyIsIndpZHRoIiwiZm9udEZhbWlseSIsInBsYWNlaG9sZGVyIiwiYWN0aW9ucyIsImNvcHkiLCJhcHBlbmRDaGlsZCIsInB2TGFiZWwiLCJwdiIsIm1pbkhlaWdodCIsImJvcmRlciIsInBhZGRpbmciLCJiYWNrZ3JvdW5kIiwiYXBwZW5kIiwicGFyZW50Tm9kZSIsImluc2VydEJlZm9yZSIsIm5leHRTaWJsaW5nIiwiX3JlbmRlclByZXZpZXciLCJwYXJzZXIiLCJpbm5lckhUTUwiLCJlcnIiLCJmaXJzdENoaWxkIiwibWVzc2FnZSIsIl93aXJlQ29weSIsImFkZEV2ZW50TGlzdGVuZXIiLCJvayIsImV4ZWNDb21tYW5kIiwibmF2aWdhdG9yIiwiY2xpcGJvYXJkIiwid3JpdGVUZXh0Iiwic2V0VGltZW91dCIsIl9pbml0IiwiZGVib3VuY2UiLCJmbiIsIndhaXQiLCJhIiwiY2xlYXJUaW1lb3V0IiwidXBkYXRlIiwiRVYiLCJXUEJDX0JGQl9FdmVudHMiLCJTVFJVQ1RVUkVfTE9BREVEIiwiU1RSVUNUVVJFX0NIQU5HRSIsInJlYWR5U3RhdGUiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9fc3JjL3Nob3J0Y29kZV9wYXJzZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIFdQQkNfRm9ybV9TaG9ydGNvZGVfUGFyc2VyXHJcbiAqIEVTNiBjbGFzcyB0aGF0IG1pcnJvcnMgV1AgQm9va2luZyBDYWxlbmRhcidzIFBIUCBwYXJzaW5nICYgcmVuZGVyaW5nIGxvZ2ljLlxyXG4gKlxyXG4gKiBVc2FnZTpcclxuICogICBjb25zdCBwYXJzZXIgPSBuZXcgV1BCQ19Gb3JtX1Nob3J0Y29kZV9QYXJzZXIoe1xyXG4gKiAgICAgY3VycmVudF9ib29raW5nX3R5cGU6ICc0JyxcclxuICogICAgIGNvdW50cmllc19saXN0OiB7IFVTOiAnVW5pdGVkIFN0YXRlcycsIEZSOiAnRnJhbmNlJywgLi4uIH0sXHJcbiAqICAgICBjdXJyZW50X2VkaXRfYm9va2luZzogeyBwYXJzZWRfZm9ybTogeyBlbWFpbDQ6IHsgdmFsdWU6J2FAYi5jb20nIH0sIGNoZWNrYm94NDogeyB2YWx1ZTonWWVzLE5vJyB9IH0gfSxcclxuICogICAgIHBvc3RlZF9kYXRhOiB7IGVtYWlsNDogJ3hAeS5jb20nIH0gICAvLyBvcHRpb25hbDogZW11bGF0ZSAkX1BPU1QgcmUtcmVuZGVyXHJcbiAqICAgfSk7XHJcbiAqXHJcbiAqICAgLy8gUmVwbGFjZSBzaG9ydGNvZGVzIHdpdGggSFRNTDpcclxuICogICBjb25zdCBodG1sID0gcGFyc2VyLmZvcm1fZWxlbWVudHMoZm9ybVN0cmluZywgdHJ1ZSk7XHJcbiAqXHJcbiAqICAgLy8gT3Igb25seSBwYXJzZSBlbGVtZW50cyAobm8gcmVwbGFjZW1lbnQpOlxyXG4gKiAgIGNvbnN0IGVsZW1lbnRzID0gcGFyc2VyLmZvcm1fZWxlbWVudHMoZm9ybVN0cmluZywgZmFsc2UpO1xyXG4gKlxyXG4gKiAgIC8vIFBhcnNlIFwiflwiICsgXCJeXCIgc3RvcmVkIGZvcm0gc3RyaW5nIGxpa2UgZ2V0X2Jvb2tpbmdfZGF0YSgpOlxyXG4gKiAgIGNvbnN0IHBhcnNlZF9mb3JtID0gcGFyc2VyLnBhcnNlX2Jvb2tpbmdfZm9ybV9zdHJpbmcoc2F2ZWRGb3JtU3RyLCBib29raW5nVHlwZUlkU3RyaW5nKTtcclxuICovXHJcbmNsYXNzIFdQQkNfRm9ybV9TaG9ydGNvZGVfUGFyc2VyIHtcclxuXHRjb25zdHJ1Y3RvcihvcHRzID0ge30pIHtcclxuXHRcdHRoaXMuY3VycmVudF9ib29raW5nX3R5cGUgPSBTdHJpbmcoIG9wdHMuY3VycmVudF9ib29raW5nX3R5cGUgPz8gJycgKTtcclxuXHRcdHRoaXMuY291bnRyaWVzX2xpc3QgICAgICAgPSBvcHRzLmNvdW50cmllc19saXN0IHx8IHt9O1xyXG5cdFx0dGhpcy5jdXJyZW50X2VkaXRfYm9va2luZyA9IG9wdHMuY3VycmVudF9lZGl0X2Jvb2tpbmcgfHwgbnVsbDtcclxuXHRcdHRoaXMucHJvY2Vzc2luZ191bml0X3RhZyAgPSBvcHRzLnByb2Nlc3NpbmdfdW5pdF90YWcgfHwgbnVsbDtcclxuXHRcdHRoaXMucG9zdGVkX2RhdGEgICAgICAgICAgPSBvcHRzLnBvc3RlZF9kYXRhIHx8IHt9OyAvLyBlbXVsYXRlICRfUE9TVCBmb3IgcmUtcmVuZGVyIC8gdmFsaWRhdGlvblxyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gdXRpbHNcclxuXHJcblx0ZXNjX2F0dHIodikge1xyXG5cdFx0aWYgKCB2ID09IG51bGwgKSByZXR1cm4gJyc7XHJcblx0XHRyZXR1cm4gU3RyaW5nKCB2IClcclxuXHRcdFx0LnJlcGxhY2UoIC8mL2csICcmYW1wOycgKVxyXG5cdFx0XHQucmVwbGFjZSggL1wiL2csICcmcXVvdDsnIClcclxuXHRcdFx0LnJlcGxhY2UoIC8nL2csICcmIzAzOTsnIClcclxuXHRcdFx0LnJlcGxhY2UoIC88L2csICcmbHQ7JyApXHJcblx0XHRcdC5yZXBsYWNlKCAvPi9nLCAnJmd0OycgKTtcclxuXHR9XHJcblxyXG5cdHN0cmlwX3F1b3RlKHRleHQpIHtcclxuXHRcdGNvbnN0IHQgID0gU3RyaW5nKCB0ZXh0ICkudHJpbSgpO1xyXG5cdFx0Y29uc3QgbTEgPSB0Lm1hdGNoKCAvXlwiKC4qKVwiJC8gKTtcclxuXHRcdGlmICggbTEgKSByZXR1cm4gbTFbMV07XHJcblx0XHRjb25zdCBtMiA9IHQubWF0Y2goIC9eJyguKiknJC8gKTtcclxuXHRcdGlmICggbTIgKSByZXR1cm4gbTJbMV07XHJcblx0XHRyZXR1cm4gdDtcclxuXHR9XHJcblxyXG5cdHN0cmlwX3F1b3RlX2RlZXAoYXJyKSB7XHJcblx0XHRpZiAoIHR5cGVvZiBhcnIgPT09ICdzdHJpbmcnICkgcmV0dXJuIHRoaXMuc3RyaXBfcXVvdGUoIGFyciApO1xyXG5cdFx0aWYgKCBBcnJheS5pc0FycmF5KCBhcnIgKSApIHJldHVybiBhcnIubWFwKCAoeCkgPT4gdGhpcy5zdHJpcF9xdW90ZSggeCApICk7XHJcblx0XHRyZXR1cm4gYXJyO1xyXG5cdH1cclxuXHJcblx0Z2V0X3BpcGVzKHZhbHVlcykge1xyXG5cdFx0Y29uc3QgcGlwZXMgPSBbXTtcclxuXHRcdGZvciAoIGNvbnN0IHZhbHVlIG9mIHZhbHVlcyApIHtcclxuXHRcdFx0Y29uc3QgcGlwZV9wb3MgPSB2YWx1ZS5pbmRleE9mKCAnfCcgKTtcclxuXHRcdFx0aWYgKCBwaXBlX3BvcyA9PT0gLTEgKSB7XHJcblx0XHRcdFx0cGlwZXMucHVzaCggWyB2YWx1ZSwgdmFsdWUgXSApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGNvbnN0IGJlZm9yZSA9IHZhbHVlLnN1YnN0cmluZyggMCwgcGlwZV9wb3MgKTtcclxuXHRcdFx0XHRjb25zdCBhZnRlciAgPSB2YWx1ZS5zdWJzdHJpbmcoIHBpcGVfcG9zICsgMSApO1xyXG5cdFx0XHRcdHBpcGVzLnB1c2goIFsgYmVmb3JlLCBhZnRlciBdICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdHJldHVybiBwaXBlcztcclxuXHR9XHJcblxyXG5cdGdldF9waXBlX2lucyhwaXBlcykge1xyXG5cdFx0Y29uc3QgaW5zID0gW107XHJcblx0XHRmb3IgKCBjb25zdCBbIGJlZm9yZSBdIG9mIHBpcGVzICkge1xyXG5cdFx0XHRpZiAoICFpbnMuaW5jbHVkZXMoIGJlZm9yZSApICkgaW5zLnB1c2goIGJlZm9yZSApO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIGlucztcclxuXHR9XHJcblxyXG5cdHBpcGUocGlwZXMsIHZhbHVlKSB7XHJcblx0XHRpZiAoIEFycmF5LmlzQXJyYXkoIHZhbHVlICkgKSByZXR1cm4gdmFsdWUubWFwKCAodikgPT4gdGhpcy5waXBlKCBwaXBlcywgdiApICk7XHJcblx0XHRmb3IgKCBjb25zdCBwIG9mIHBpcGVzICkge1xyXG5cdFx0XHRpZiAoIHBbMF0gPT09IHZhbHVlICkgcmV0dXJuIHBbMV07XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdmFsdWU7XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBwYXJzZXIgY29yZVxyXG5cclxuXHQvKipcclxuXHQgKiBQYXJzZSBhIHNpbmdsZSBzaG9ydGNvZGUgbWF0Y2ggaW50byB7dHlwZSxuYW1lLG9wdGlvbnMsdmFsdWVzLHJhd192YWx1ZXN9XHJcblx0ICogTWlycm9ycyBQSFAgZm9ybV9lbGVtZW50X3BhcnNlKClcclxuXHQgKi9cclxuXHRmb3JtX2VsZW1lbnRfcGFyc2UobWF0Y2gpIHtcclxuXHRcdC8vIEpTIHJlZ2V4IGdyb3VwcyBtaXJyb3IgdGhlIG9uZXMgY29uc3RydWN0ZWQgaW4gZm9ybV9lbGVtZW50cygpXHJcblx0XHQvLyBtYXRjaFsxXSA9PiB0eXBlLCBtYXRjaFsyXSA9PiBuYW1lLCBtYXRjaFszXSA9PiBvcHRpb25zIGNodW5rLCBtYXRjaFs0XSA9PiBxdW90ZWQgdmFsdWVzIGNodW5rXHJcblx0XHRjb25zdCB0eXBlICAgID0gU3RyaW5nKCBtYXRjaFsxXSApLnRyaW0oKTtcclxuXHRcdGNvbnN0IG5hbWUgICAgPSBTdHJpbmcoIG1hdGNoWzJdIHx8ICcnICkudHJpbSgpO1xyXG5cdFx0Y29uc3Qgb3B0aW9ucyA9IFN0cmluZyggbWF0Y2hbM10gfHwgJycgKS50cmltKClcclxuXHRcdFx0PyBTdHJpbmcoIG1hdGNoWzNdICkudHJpbSgpLnNwbGl0KCAvXFxzKy8gKVxyXG5cdFx0XHQ6IFtdO1xyXG5cclxuXHRcdGNvbnN0IHEgICAgICAgICAgPSBTdHJpbmcoIG1hdGNoWzRdIHx8ICcnICk7XHJcblx0XHRjb25zdCByYXdfdmFsdWVzID0gdGhpcy5zdHJpcF9xdW90ZV9kZWVwKCBxLm1hdGNoKCAvXCJbXlwiXSpcInwnW14nXSonL2cgKSB8fCBbXSApO1xyXG5cclxuXHRcdGxldCB2YWx1ZXM7XHJcblx0XHRpZiAoIC9eKHNlbGVjdFxcKj98c2VsZWN0Ym94XFwqP3xjaGVja2JveFxcKj98cmFkaW9cXCo/fHF1aXopJC8udGVzdCggdHlwZSApICkge1xyXG5cdFx0XHRjb25zdCBwaXBlcyA9IHRoaXMuZ2V0X3BpcGVzKCByYXdfdmFsdWVzICk7XHJcblx0XHRcdHZhbHVlcyAgICAgID0gdGhpcy5nZXRfcGlwZV9pbnMoIHBpcGVzICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR2YWx1ZXMgPSByYXdfdmFsdWVzO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHsgdHlwZSwgbmFtZSwgb3B0aW9ucywgdmFsdWVzLCByYXdfdmFsdWVzIH07XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBSZXBsYWNlIGNhbGxiYWNrIC0+IHJvdXRlcyB0byByZW5kZXJlclxyXG5cdCAqL1xyXG5cdGZvcm1fZWxlbWVudF9yZXBsYWNlX2NhbGxiYWNrKG1hdGNoKSB7XHJcblx0XHQvLyBEZWZhdWx0cyBjb21wYXRpYmxlIHdpdGggUEhQIChhdm9pZCB1bmRlZmluZWQgbm90aWNlcylcclxuXHRcdGxldCB0eXBlICAgICAgID0gJyc7XHJcblx0XHRsZXQgb3B0aW9ucyAgICA9IFtdO1xyXG5cdFx0bGV0IHJhd192YWx1ZXMgPSBbXTtcclxuXHRcdGxldCB2YWx1ZXMgICAgID0gW107ICAgICAgICAgLy8gPC0tIGRlY2xhcmUgdmFsdWVzXHJcblx0XHRsZXQgdGhpc19uYW1lICA9ICcnOyAgICAgIC8vIDwtLSBkZWNsYXJlIHRoaXNfbmFtZSAoZml4ZXMgUmVmZXJlbmNlRXJyb3IpXHJcblxyXG5cdFx0KHsgdHlwZSwgbmFtZTogdGhpc19uYW1lLCBvcHRpb25zLCB2YWx1ZXMsIHJhd192YWx1ZXMgfSA9IHRoaXMuZm9ybV9lbGVtZW50X3BhcnNlKCBtYXRjaCApKTtcclxuXHJcblx0XHQvLyBDb3VudHJ5IG5hbWUgZGVmYXVsdGluZyBsaWtlIFBIUCAoaWYgZW1wdHkgbmFtZSwgdXNlIHR5cGUpLlxyXG5cdFx0aWYgKCB0eXBlID09PSAnY291bnRyeScgfHwgdHlwZSA9PT0gJ2NvdW50cnkqJyApIHtcclxuXHRcdFx0aWYgKCAhdGhpc19uYW1lICkgdGhpc19uYW1lID0gdHlwZTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBOYW1lIGluY2x1ZGVzIGN1cnJlbnQgYm9va2luZyB0eXBlIHN1ZmZpeFxyXG5cdFx0bGV0IG5hbWUgPSB0aGlzX25hbWUgKyB0aGlzLmN1cnJlbnRfYm9va2luZ190eXBlO1xyXG5cclxuXHJcblx0XHQvLyBFbXVsYXRlIGVkaXQtbW9kZSBkZWZhdWx0cyBmcm9tIGN1cnJlbnRfZWRpdF9ib29raW5nLnBhcnNlZF9mb3JtXHJcblx0XHQvLyBGb3IgbGlzdCBmaWVsZHMsIGNvbnZlcnQgc3RvcmVkIFwiYSxiLGNcIiB0byBkZWZhdWx0OiBzZWxlY3Rpb25zLlxyXG5cdFx0aWYgKCB0aGlzLmN1cnJlbnRfZWRpdF9ib29raW5nICYmIHRoaXMuY3VycmVudF9lZGl0X2Jvb2tpbmcucGFyc2VkX2Zvcm0gKSB7XHJcblx0XHRcdGNvbnN0IHBhcnNlZCA9IHRoaXMuY3VycmVudF9lZGl0X2Jvb2tpbmcucGFyc2VkX2Zvcm07XHJcblxyXG5cdFx0XHRjb25zdCBwbHVnRGVmYXVsdHMgPSAoKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgZW50cnkgPSBwYXJzZWRbbmFtZV07XHJcblx0XHRcdFx0aWYgKCAhZW50cnkgKSByZXR1cm47XHJcblx0XHRcdFx0aWYgKCAvXig/OnNlbGVjdHxzZWxlY3Rib3h8Y291bnRyeXxjaGVja2JveHxyYWRpbylcXCo/JC8udGVzdCggdHlwZSApICkge1xyXG5cdFx0XHRcdFx0b3B0aW9ucyAgICAgICAgICAgID0gQXJyYXkuaXNBcnJheSggb3B0aW9ucyApID8gb3B0aW9ucy5zbGljZSgpIDogW107XHJcblx0XHRcdFx0XHQvLyByZW1vdmUgZXhwbGljaXQgZGVmYXVsdDouLi4gZnJvbSBvcHRpb25zXHJcblx0XHRcdFx0XHRvcHRpb25zICAgICAgICAgICAgPSBvcHRpb25zLmZpbHRlciggKG9wKSA9PiAhL15kZWZhdWx0Oi8udGVzdCggb3AgKSApO1xyXG5cdFx0XHRcdFx0Y29uc3Qgc2VsZWN0ZWRMaXN0ID0gU3RyaW5nKCBlbnRyeS52YWx1ZSB8fCAnJyApLnNwbGl0KCAnLCcgKTtcclxuXHRcdFx0XHRcdGZvciAoIGNvbnN0IHMgb2Ygc2VsZWN0ZWRMaXN0ICkge1xyXG5cdFx0XHRcdFx0XHRpZiAoIHMgIT09ICcnICkgb3B0aW9ucy5wdXNoKCAnZGVmYXVsdDonICsgcyApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gZWxzZSBpZiAoIC8oXnN0YXJ0dGltZVxcKj8kKXwoXmVuZHRpbWVcXCo/JCkvLnRlc3QoIHR5cGUgKSApIHtcclxuXHRcdFx0XHRcdC8vIFNwZWNpYWwgbmFtZXMgaW4gUEhQOiBzdGFydHRpbWV7dHlwZX0sIGVuZHRpbWV7dHlwZX1cclxuXHRcdFx0XHRcdGNvbnN0IHRuYW1lID0gKHR5cGUuc3RhcnRzV2l0aCggJ3N0YXJ0dGltZScgKSA/ICdzdGFydHRpbWUnIDogJ2VuZHRpbWUnKSArIHRoaXMuY3VycmVudF9ib29raW5nX3R5cGU7XHJcblx0XHRcdFx0XHRjb25zdCBlICAgICA9IHBhcnNlZFt0bmFtZV07XHJcblx0XHRcdFx0XHR2YWx1ZXMgICAgICA9IFsgZSAmJiBlLnZhbHVlID8gZS52YWx1ZSA6ICcnIF07XHJcblx0XHRcdFx0fSBlbHNlIGlmICggL15jb3VudHJ5XFwqPyQvLnRlc3QoIHR5cGUgKSApIHtcclxuXHRcdFx0XHRcdGNvbnN0IHRuYW1lID0gJ2NvdW50cnknICsgdGhpcy5jdXJyZW50X2Jvb2tpbmdfdHlwZTtcclxuXHRcdFx0XHRcdGNvbnN0IGUgICAgID0gcGFyc2VkW3RuYW1lXTtcclxuXHRcdFx0XHRcdGlmICggZSAmJiBlLnZhbHVlICkgb3B0aW9ucyA9IFsgJ2RlZmF1bHQ6JyArIGUudmFsdWUgXTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y29uc3QgZSA9IHBhcnNlZFtuYW1lXTtcclxuXHRcdFx0XHRcdHZhbHVlcyAgPSBbIGUgJiYgZS52YWx1ZSA/IGUudmFsdWUgOiAnJyBdO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdHBsdWdEZWZhdWx0cygpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFZhbGlkYXRpb24gZXJyb3IgKEpTIHNpZGU6IG9wdGlvbmFsIGhvb2s7IGVtcHR5IGJ5IGRlZmF1bHQpXHJcblx0XHRjb25zdCB2YWxpZGF0aW9uX2Vycm9yID0gJyc7IC8vIFlvdSBjYW4gaW50ZWdyYXRlIHlvdXIgdmFsaWRhdG9yIGFuZCBpbmplY3QgaGVyZS5cclxuXHJcblx0XHQvLyBBdHRyaWJ1dGVzIGZyb20gb3B0aW9uc1xyXG5cdFx0bGV0IGF0dHMgICAgICAgICAgICAgID0gJyc7XHJcblx0XHRjb25zdCBvbmx5X2ZpZWxkX25hbWUgPSBuYW1lLnN1YnN0cmluZyggMCwgbmFtZS5sZW5ndGggLSB0aGlzLmN1cnJlbnRfYm9va2luZ190eXBlLmxlbmd0aCApO1xyXG5cdFx0YXR0cyArPSBgIGF1dG9jb21wbGV0ZT1cIiR7dGhpcy5lc2NfYXR0ciggb25seV9maWVsZF9uYW1lICl9XCJgO1xyXG5cclxuXHRcdC8vIGlkOlxyXG5cdFx0Y29uc3QgaWRPcHQgPSBvcHRpb25zLmZpbmQoIChvKSA9PiAvXmlkOlstMC05YS16QS1aX10rJC8udGVzdCggbyApICk7XHJcblx0XHRpZiAoIGlkT3B0ICkge1xyXG5cdFx0XHRjb25zdCBpZCA9IGlkT3B0LnNwbGl0KCAnOicgKVsxXTtcclxuXHRcdFx0YXR0cyArPSBgIGlkPVwiJHt0aGlzLmVzY19hdHRyKCBpZCArIHRoaXMuY3VycmVudF9ib29raW5nX3R5cGUgKX1cImA7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gcGxhY2Vob2xkZXI6XHJcblx0XHRjb25zdCBwaE9wdCA9IG9wdGlvbnMuZmluZCggKG8pID0+IC9ecGxhY2Vob2xkZXI6Wy0wLTlhLXpBLVpfLy9dKyQvLnRlc3QoIG8gKSApO1xyXG5cdFx0aWYgKCBwaE9wdCApIHtcclxuXHRcdFx0Y29uc3QgcGggPSBwaE9wdC5zcGxpdCggJzonIClbMV0ucmVwbGFjZSggL18vZywgJyAnICk7XHJcblx0XHRcdGF0dHMgKz0gYCBwbGFjZWhvbGRlcj1cIiR7dGhpcy5lc2NfYXR0ciggcGggKX1cImA7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gY2xhc3Nlc1xyXG5cdFx0bGV0IGNsYXNzX2F0dCA9ICcnO1xyXG5cdFx0Y29uc3QgY2xzICAgICA9IG9wdGlvbnMuZmlsdGVyKCAobykgPT4gL15jbGFzczpbLTAtOWEtekEtWl9dKyQvLnRlc3QoIG8gKSApLm1hcCggKG8pID0+IG8uc3BsaXQoICc6JyApWzFdICk7XHJcblx0XHRpZiAoIGNscy5sZW5ndGggKSBjbGFzc19hdHQgKz0gJyAnICsgY2xzLmpvaW4oICcgJyApO1xyXG5cclxuXHRcdGlmICggL15lbWFpbFxcKj8kLy50ZXN0KCB0eXBlICkgKSBjbGFzc19hdHQgKz0gJyB3cGRldi12YWxpZGF0ZXMtYXMtZW1haWwnO1xyXG5cdFx0aWYgKCAvXmNvdXBvblxcKj8kLy50ZXN0KCB0eXBlICkgKSBjbGFzc19hdHQgKz0gJyB3cGRldi12YWxpZGF0ZXMtYXMtY291cG9uJztcclxuXHRcdGlmICggL150aW1lXFwqPyQvLnRlc3QoIHR5cGUgKSApIGNsYXNzX2F0dCArPSAnIHdwZGV2LXZhbGlkYXRlcy1hcy10aW1lJztcclxuXHRcdGlmICggL15zdGFydHRpbWVcXCo/JC8udGVzdCggdHlwZSApICkgY2xhc3NfYXR0ICs9ICcgd3BkZXYtdmFsaWRhdGVzLWFzLXRpbWUnO1xyXG5cdFx0aWYgKCAvXmVuZHRpbWVcXCo/JC8udGVzdCggdHlwZSApICkgY2xhc3NfYXR0ICs9ICcgd3BkZXYtdmFsaWRhdGVzLWFzLXRpbWUnO1xyXG5cdFx0aWYgKCAvXFwqJC8udGVzdCggdHlwZSApICkgY2xhc3NfYXR0ICs9ICcgd3BkZXYtdmFsaWRhdGVzLWFzLXJlcXVpcmVkJztcclxuXHRcdGlmICggL15jaGVja2JveFxcKj8kLy50ZXN0KCB0eXBlICkgKSBjbGFzc19hdHQgKz0gJyB3cGRldi1jaGVja2JveCc7XHJcblx0XHRpZiAoIC9ecmFkaW9cXCo/JC8udGVzdCggdHlwZSApICkgY2xhc3NfYXR0ICs9ICcgd3BkZXYtcmFkaW8nO1xyXG5cdFx0aWYgKCAvXmNhcHRjaGFjJC8udGVzdCggdHlwZSApICkgY2xhc3NfYXR0ICs9ICcgd3BkZXYtY2FwdGNoYS0nICsgbmFtZTtcclxuXHRcdGlmICggdHlwZSA9PT0gJ2FjY2VwdGFuY2UnICkge1xyXG5cdFx0XHRjbGFzc19hdHQgKz0gJyB3cGRldi1hY2NlcHRhbmNlJztcclxuXHRcdFx0aWYgKCBvcHRpb25zLmluY2x1ZGVzKCAnaW52ZXJ0JyApICkgY2xhc3NfYXR0ICs9ICcgd3BkZXYtaW52ZXJ0JztcclxuXHRcdH1cclxuXHRcdGlmICggY2xhc3NfYXR0ICkgYXR0cyArPSBgIGNsYXNzPVwiJHtjbGFzc19hdHQudHJpbSgpfVwiYDtcclxuXHJcblx0XHQvLyBQb3N0ZWQgdmFsdWUgcmUtcG9wdWxhdGlvbiAobWlycm9ycyBQSFAgJF9QT1NUIHVzYWdlKVxyXG5cdFx0bGV0IHZhbHVlID0gJyc7XHJcblx0XHRpZiAoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggdGhpcy5wb3N0ZWRfZGF0YSwgbmFtZSApICkge1xyXG5cdFx0XHR2YWx1ZSA9IHRoaXMucG9zdGVkX2RhdGFbbmFtZV07XHJcblx0XHR9IGVsc2UgaWYgKCBBcnJheS5pc0FycmF5KCB2YWx1ZXMgKSAmJiB2YWx1ZXNbMF0gIT0gbnVsbCApIHtcclxuXHRcdFx0dmFsdWUgPSB2YWx1ZXNbMF07XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gU3BlY2lhbCBuYW1lIG5vcm1hbGl6YXRpb24gZm9yIHN0YXJ0dGltZS9lbmR0aW1lXHJcblx0XHRpZiAoIHR5cGUuc3RhcnRzV2l0aCggJ3N0YXJ0dGltZScgKSApIG5hbWUgPSAnc3RhcnR0aW1lJyArIHRoaXMuY3VycmVudF9ib29raW5nX3R5cGU7XHJcblx0XHRpZiAoIHR5cGUuc3RhcnRzV2l0aCggJ2VuZHRpbWUnICkgKSBuYW1lID0gJ2VuZHRpbWUnICsgdGhpcy5jdXJyZW50X2Jvb2tpbmdfdHlwZTtcclxuXHJcblx0XHQvLyBTd2l0Y2ggcmVuZGVyZXJzXHJcblx0XHRyZXR1cm4gdGhpcy5yZW5kZXJfZWxlbWVudCggeyB0eXBlLCBuYW1lLCBhdHRzLCBvcHRpb25zLCB2YWx1ZXMsIHZhbGlkYXRpb25fZXJyb3IsIHZhbHVlIH0gKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlbmRlciBlbGVtZW50IHRvIEhUTUwgKHN0cmluZyksIGVtdWxhdGluZyBQSFAgc3dpdGNoLWNhc2UuXHJcblx0ICovXHJcblx0cmVuZGVyX2VsZW1lbnQoeyB0eXBlLCBuYW1lLCBhdHRzLCBvcHRpb25zLCB2YWx1ZXMsIHZhbGlkYXRpb25fZXJyb3IsIHZhbHVlIH0pIHtcclxuXHRcdC8vIFRleHQtbGlrZVxyXG5cdFx0aWYgKCAvXihzdGFydHRpbWVcXCo/fGVuZHRpbWVcXCo/fHRpbWVcXCo/fHRleHRcXCo/fGVtYWlsXFwqP3xjb3Vwb25cXCo/fGNhcHRjaGFyKSQvLnRlc3QoIHR5cGUgKSApIHtcclxuXHRcdFx0Ly8gc2l6ZS9tYXhsZW5ndGg6IFwiNDAvMjU1XCIgb3IgXCI0MHgyNTVcIlxyXG5cdFx0XHRjb25zdCBzaXplT3B0ICA9IChvcHRpb25zIHx8IFtdKS5maW5kKCAobykgPT4gL15bMC05XSpbXFwveF1bMC05XSokLy50ZXN0KCBvICkgKSB8fCAnJztcclxuXHRcdFx0bGV0IHNpemVBdHRyICAgPSAnIHNpemU9XCI0MFwiJztcclxuXHRcdFx0bGV0IG1heGxlbkF0dHIgPSAnJztcclxuXHRcdFx0aWYgKCBzaXplT3B0ICkge1xyXG5cdFx0XHRcdGNvbnN0IG0gPSBzaXplT3B0Lm1hdGNoKCAvXihbMC05XSopW1xcL3hdKFswLTldKikkLyApO1xyXG5cdFx0XHRcdGlmICggbSApIHtcclxuXHRcdFx0XHRcdGlmICggbVsxXSApIHNpemVBdHRyID0gYCBzaXplPVwiJHtwYXJzZUludCggbVsxXSwgMTAgKSB8fCA0MH1cImA7XHJcblx0XHRcdFx0XHRpZiAoIG1bMl0gKSBtYXhsZW5BdHRyID0gYCBtYXhsZW5ndGg9XCIke3BhcnNlSW50KCBtWzJdLCAxMCApIHx8ICcnfVwiYDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGFkZGl0aW9uYWxfanMgPSAvXmNvdXBvblxcKj8kLy50ZXN0KCB0eXBlIClcclxuXHRcdFx0XHQ/ICcgb25jaGFuZ2U9XCJpZih3aW5kb3cud3BiY19zaG93X2Nvc3RfaGludHNfYWZ0ZXJfZmV3X3NlY29uZHMpe3dwYmNfc2hvd19jb3N0X2hpbnRzX2FmdGVyX2Zld19zZWNvbmRzKCcgKyB0aGlzLmN1cnJlbnRfYm9va2luZ190eXBlICsgJyk7fVwiICdcclxuXHRcdFx0XHQ6ICcnO1xyXG5cclxuXHRcdFx0Y29uc3QgZmllbGRfdHlwZSA9IC9eZW1haWxcXCo/JC8udGVzdCggdHlwZSApID8gJ3R5cGU9XCJlbWFpbFwiJyA6ICd0eXBlPVwidGV4dFwiJztcclxuXHRcdFx0Y29uc3QgaHRtbCAgICAgICA9IGA8aW5wdXQgJHtmaWVsZF90eXBlfSBuYW1lPVwiJHt0aGlzLmVzY19hdHRyKCBuYW1lICl9XCIgdmFsdWU9XCIke3RoaXMuZXNjX2F0dHIoIHZhbHVlICl9XCIke2F0dHN9JHtzaXplQXR0cn0ke21heGxlbkF0dHJ9JHthZGRpdGlvbmFsX2pzfS8+YDtcclxuXHRcdFx0cmV0dXJuIGA8c3BhbiBjbGFzcz1cIndwYmNfd3JhcF90ZXh0IHdwZGV2LWZvcm0tY29udHJvbC13cmFwICR7dGhpcy5lc2NfYXR0ciggbmFtZSApfVwiPiR7aHRtbH0ke3ZhbGlkYXRpb25fZXJyb3J9PC9zcGFuPmA7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gVGV4dGFyZWFcclxuXHRcdGlmICggL150ZXh0YXJlYVxcKj8kLy50ZXN0KCB0eXBlICkgKSB7XHJcblx0XHRcdC8vIGNvbHMvcm93cyBcIjQweDEwXCIgb3IgXCI0MC8xMFwiXHJcblx0XHRcdGNvbnN0IGNyT3B0ID0gKG9wdGlvbnMgfHwgW10pLmZpbmQoIChvKSA9PiAvXlswLTldKlt4L11bMC05XSokLy50ZXN0KCBvICkgKTtcclxuXHRcdFx0bGV0IGNyQXR0ciAgPSAnJztcclxuXHRcdFx0aWYgKCBjck9wdCApIHtcclxuXHRcdFx0XHRjb25zdCBtID0gY3JPcHQubWF0Y2goIC9eKFswLTldKilbeFxcL10oWzAtOV0qKSQvICk7XHJcblx0XHRcdFx0aWYgKCBtICkge1xyXG5cdFx0XHRcdFx0aWYgKCBtWzFdICkgY3JBdHRyICs9IGAgY29scz1cIiR7cGFyc2VJbnQoIG1bMV0sIDEwICkgfHwgJyd9XCJgO1xyXG5cdFx0XHRcdFx0aWYgKCBtWzJdICkgY3JBdHRyICs9IGAgcm93cz1cIiR7cGFyc2VJbnQoIG1bMl0sIDEwICkgfHwgJyd9XCJgO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCBodG1sID0gYDx0ZXh0YXJlYSBuYW1lPVwiJHt0aGlzLmVzY19hdHRyKCBuYW1lICl9XCIke2F0dHN9JHtjckF0dHJ9PiR7dGhpcy5lc2NfYXR0ciggdmFsdWUgKX08L3RleHRhcmVhPmA7XHJcblx0XHRcdHJldHVybiBgPHNwYW4gY2xhc3M9XCJ3cGJjX3dyYXBfdGV4dGFyZWEgd3BkZXYtZm9ybS1jb250cm9sLXdyYXAgJHt0aGlzLmVzY19hdHRyKCBuYW1lICl9XCI+JHtodG1sfSR7dmFsaWRhdGlvbl9lcnJvcn08L3NwYW4+YDtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBDb3VudHJ5XHJcblx0XHRpZiAoIC9eY291bnRyeVxcKj8kLy50ZXN0KCB0eXBlICkgKSB7XHJcblx0XHRcdC8vIGRlcml2ZSBkZWZhdWx0cyBmcm9tIG9wdGlvbnMgZGVmYXVsdDpYWFxyXG5cdFx0XHRsZXQgc2NyX2RlZmF1bHQgPSBbXTtcclxuXHRcdFx0Y29uc3QgZGVmYXVsdHMgID0gKG9wdGlvbnMgfHwgW10pLmZpbHRlciggKG8pID0+IC9eZGVmYXVsdDovLnRlc3QoIG8gKSApO1xyXG5cdFx0XHRpZiAoIGRlZmF1bHRzLmxlbmd0aCApIHtcclxuXHRcdFx0XHRjb25zdCBtID0gZGVmYXVsdHNbMF0ubWF0Y2goIC9eZGVmYXVsdDooWzAtOWEtekEtWl86XFxzLV0rKSQvICk7XHJcblx0XHRcdFx0aWYgKCBtICYmIG1bMV0gKSBzY3JfZGVmYXVsdCA9IG1bMV0uc3BsaXQoICdfJyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGxldCBodG1sID0gJyc7XHJcblx0XHRcdGZvciAoIGNvbnN0IFsgY29kZSwgbGFiZWwgXSBvZiBPYmplY3QuZW50cmllcyggdGhpcy5jb3VudHJpZXNfbGlzdCApICkge1xyXG5cdFx0XHRcdGxldCBzZWxlY3RlZCA9ICcnO1xyXG5cdFx0XHRcdGlmICggc2NyX2RlZmF1bHQuaW5jbHVkZXMoIGNvZGUgKSApIHNlbGVjdGVkID0gJyBzZWxlY3RlZD1cInNlbGVjdGVkXCInO1xyXG5cdFx0XHRcdGlmICggdmFsdWUgPT09IGNvZGUgKSBzZWxlY3RlZCA9ICcgc2VsZWN0ZWQ9XCJzZWxlY3RlZFwiJztcclxuXHRcdFx0XHRodG1sICs9IGA8b3B0aW9uIHZhbHVlPVwiJHt0aGlzLmVzY19hdHRyKCBjb2RlICl9XCIke3NlbGVjdGVkfT4ke3RoaXMuZXNjX2F0dHIoIGxhYmVsICl9PC9vcHRpb24+YDtcclxuXHRcdFx0fVxyXG5cdFx0XHRodG1sID0gYDxzZWxlY3QgbmFtZT1cIiR7dGhpcy5lc2NfYXR0ciggbmFtZSApfVwiJHthdHRzfT4ke2h0bWx9PC9zZWxlY3Q+YDtcclxuXHRcdFx0cmV0dXJuIGA8c3BhbiBjbGFzcz1cIndwYmNfd3JhcF9zZWxlY3Qgd3BkZXYtZm9ybS1jb250cm9sLXdyYXAgJHt0aGlzLmVzY19hdHRyKCBuYW1lICl9XCI+JHtodG1sfSR7dmFsaWRhdGlvbl9lcnJvcn08L3NwYW4+YDtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBTZWxlY3QgLyBzZWxlY3Rib3hcclxuXHRcdGlmICggL14oc2VsZWN0XFwqP3xzZWxlY3Rib3hcXCo/KSQvLnRlc3QoIHR5cGUgKSApIHtcclxuXHRcdFx0Y29uc3QgbXVsdGlwbGUgICAgICA9IChvcHRpb25zIHx8IFtdKS5pbmNsdWRlcyggJ211bHRpcGxlJyApO1xyXG5cdFx0XHRjb25zdCBpbmNsdWRlX2JsYW5rID0gKG9wdGlvbnMgfHwgW10pLmluY2x1ZGVzKCAnaW5jbHVkZV9ibGFuaycgKTtcclxuXHJcblx0XHRcdGxldCB2YWxzID0gQXJyYXkuaXNBcnJheSggdmFsdWVzICkgPyB2YWx1ZXMuc2xpY2UoKSA6IFtdO1xyXG5cdFx0XHRpZiAoICF2YWxzLmxlbmd0aCB8fCBpbmNsdWRlX2JsYW5rICkgdmFscy51bnNoaWZ0KCAnLS0tJyApO1xyXG5cclxuXHRcdFx0Ly8gZGVmYXVsdHMgZnJvbSBvcHRpb25zIGRlZmF1bHQ6Li4uXHJcblx0XHRcdGNvbnN0IHNjcl9kZWZhdWx0cyAgICAgICA9IChvcHRpb25zIHx8IFtdKS5maWx0ZXIoIChvKSA9PiAvXmRlZmF1bHQ6Ly50ZXN0KCBvICkgKTtcclxuXHRcdFx0Y29uc3Qgc2VsZWN0ZWRQaXBlVmFsdWVzID0gW107XHJcblx0XHRcdGZvciAoIGNvbnN0IGQgb2Ygc2NyX2RlZmF1bHRzICkge1xyXG5cdFx0XHRcdGNvbnN0IG0gPSBkLm1hdGNoKCAvXmRlZmF1bHQ6KFtefl0rKSQvICk7XHJcblx0XHRcdFx0aWYgKCBtICYmIG1bMV0gKSB7XHJcblx0XHRcdFx0XHRjb25zdCBwYXJ0ID0gbVsxXS5zcGxpdCggJ18nIClbMF0ucmVwbGFjZSggJyYjMzc7JywgJyUnICk7XHJcblx0XHRcdFx0XHRzZWxlY3RlZFBpcGVWYWx1ZXMucHVzaCggcGFydCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bGV0IGh0bWwgPSAnJztcclxuXHRcdFx0Zm9yICggbGV0IHYgb2YgdmFscyApIHtcclxuXHRcdFx0XHRsZXQgbGFiZWwgPSBudWxsO1xyXG5cdFx0XHRcdGlmICggdi5pbmNsdWRlcyggJ0BAJyApICkge1xyXG5cdFx0XHRcdFx0Y29uc3QgWyB0dGwsIHZ2IF0gPSB2LnNwbGl0KCAnQEAnICk7XHJcblx0XHRcdFx0XHRsYWJlbCAgICAgICAgICAgICA9IHR0bDtcclxuXHRcdFx0XHRcdHYgICAgICAgICAgICAgICAgID0gdnY7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGxldCBzZWxlY3RlZCA9ICcnO1xyXG5cdFx0XHRcdGlmICggc2VsZWN0ZWRQaXBlVmFsdWVzLmluY2x1ZGVzKCB2ICkgKSBzZWxlY3RlZCA9ICcgc2VsZWN0ZWQ9XCJzZWxlY3RlZFwiJztcclxuXHRcdFx0XHRpZiAoIHRoaXMucG9zdGVkX2RhdGEgJiYgdGhpcy5wb3N0ZWRfZGF0YVtuYW1lXSApIHtcclxuXHRcdFx0XHRcdGNvbnN0IHBkID0gdGhpcy5wb3N0ZWRfZGF0YVtuYW1lXTtcclxuXHRcdFx0XHRcdGlmICggQXJyYXkuaXNBcnJheSggcGQgKSA/IHBkLmluY2x1ZGVzKCB2ICkgOiBTdHJpbmcoIHBkICkgPT09IHYgKSBzZWxlY3RlZCA9ICcgc2VsZWN0ZWQ9XCJzZWxlY3RlZFwiJztcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aHRtbCArPSBgPG9wdGlvbiB2YWx1ZT1cIiR7dGhpcy5lc2NfYXR0ciggdiApfVwiJHtzZWxlY3RlZH0+JHt0aGlzLmVzY19hdHRyKCBsYWJlbCA/PyB2ICl9PC9vcHRpb24+YDtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCBtdWx0QXR0ciA9IG11bHRpcGxlID8gJyBtdWx0aXBsZT1cIm11bHRpcGxlXCInIDogJyc7XHJcblx0XHRcdGNvbnN0IG9uY2hhbmdlID0gYCBvbmNoYW5nZT1cImlmKHdpbmRvdy53cGJjX3Nob3dfY29zdF9oaW50c19hZnRlcl9mZXdfc2Vjb25kcyl7d3BiY19zaG93X2Nvc3RfaGludHNfYWZ0ZXJfZmV3X3NlY29uZHMoJHt0aGlzLmN1cnJlbnRfYm9va2luZ190eXBlfSk7fVwiIGA7XHJcblx0XHRcdGNvbnN0IHNlbGVjdCAgID0gYDxzZWxlY3Qke29uY2hhbmdlfSBuYW1lPVwiJHt0aGlzLmVzY19hdHRyKCBuYW1lICl9JHttdWx0aXBsZSA/ICdbXScgOiAnJ31cIiR7YXR0c30ke211bHRBdHRyfT4ke2h0bWx9PC9zZWxlY3Q+YDtcclxuXHRcdFx0cmV0dXJuIGA8c3BhbiBjbGFzcz1cIndwYmNfd3JhcF9zZWxlY3Qgd3BkZXYtZm9ybS1jb250cm9sLXdyYXAgJHt0aGlzLmVzY19hdHRyKCBuYW1lICl9XCI+JHtzZWxlY3R9JHt2YWxpZGF0aW9uX2Vycm9yfTwvc3Bhbj5gO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIENoZWNrYm94IC8gUmFkaW9cclxuXHRcdGlmICggL14oY2hlY2tib3hcXCo/fHJhZGlvXFwqPykkLy50ZXN0KCB0eXBlICkgKSB7XHJcblx0XHRcdGNvbnN0IGlzQ2hlY2tib3ggPSAvXmNoZWNrYm94Ly50ZXN0KCB0eXBlICk7XHJcblx0XHRcdGNvbnN0IG11bHRpcGxlICAgPSBpc0NoZWNrYm94ICYmICEob3B0aW9ucyB8fCBbXSkuaW5jbHVkZXMoICdleGNsdXNpdmUnICk7XHJcblxyXG5cdFx0XHRjb25zdCBkZWZhdWx0T24gPSAob3B0aW9ucyB8fCBbXSkuc29tZSggKG8pID0+IG8gPT09ICdkZWZhdWx0Om9uJyApID8gJyBjaGVja2VkPVwiY2hlY2tlZFwiJyA6ICcnO1xyXG5cclxuXHRcdFx0Ly8gcmVuZGVyIGdyb3VwXHJcblx0XHRcdGxldCBncm91cElkQXR0ciA9ICcnO1xyXG5cdFx0XHRsZXQgYXR0c05vSWQgICAgPSBhdHRzO1xyXG5cdFx0XHQvLyBJZiBsYWJlbCBlbGVtZW50IHJlcXVlc3RlZCwgd2UgcmVtb3ZlIElEIGZyb20gaW5wdXQgYW5kIHB1dCBvbiBsYWJlbHMgbGF0ZXJcclxuXHRcdFx0bGV0IGlkTWF0Y2ggICAgID0gYXR0cy5tYXRjaCggL1xcc2lkPVwiKFstMC05YS16QS1aX10rKVwiLyApO1xyXG5cdFx0XHRpZiAoIGlkTWF0Y2ggKSB7XHJcblx0XHRcdFx0YXR0c05vSWQgICAgPSBhdHRzLnJlcGxhY2UoIGlkTWF0Y2hbMF0sICcnICk7XHJcblx0XHRcdFx0Z3JvdXBJZEF0dHIgPSBgIGlkPVwiJHt0aGlzLmVzY19hdHRyKCBpZE1hdGNoWzFdICl9XCIgYDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgdXNlX2xhYmVsX2VsZW1lbnQgPSAob3B0aW9ucyB8fCBbXSkuc29tZSggKG8pID0+IC9edXNlW18tXT9sYWJlbFtfLV0/ZWxlbWVudCQvLnRlc3QoIG8gKSApO1xyXG5cdFx0XHRjb25zdCBsYWJlbF9maXJzdCAgICAgICA9IChvcHRpb25zIHx8IFtdKS5zb21lKCAobykgPT4gL15sYWJlbFtfLV0/Zmlyc3QkLy50ZXN0KCBvICkgKTtcclxuXHRcdFx0Y29uc3QgbGFiZWxfd3JhcCAgICAgICAgPSAob3B0aW9ucyB8fCBbXSkuc29tZSggKG8pID0+IC9ebGFiZWxbXy1dP3dyYXAkLy50ZXN0KCBvICkgKTtcclxuXHJcblx0XHRcdGNvbnN0IGlucHV0X3R5cGUgPSBpc0NoZWNrYm94ID8gJ2NoZWNrYm94JyA6ICdyYWRpbyc7XHJcblx0XHRcdGxldCBodG1sSXRlbXMgICAgPSAnJztcclxuXHJcblx0XHRcdC8vIGRlZmF1bHRzIGZyb20gb3B0aW9ucyBkZWZhdWx0OmEsIGRlZmF1bHQ6YiBldGMuXHJcblx0XHRcdGNvbnN0IGRlZmF1bHRzICAgID0gKG9wdGlvbnMgfHwgW10pLmZpbHRlciggKG9wKSA9PiAvXmRlZmF1bHQ6Ly50ZXN0KCBvcCApICkubWFwKCAocykgPT4gcy5yZXBsYWNlKCAvXmRlZmF1bHQ6LywgJycgKSApO1xyXG5cdFx0XHRjb25zdCBkZWZhdWx0c1NldCA9IG5ldyBTZXQoIGRlZmF1bHRzLmpvaW4oICcsJyApLnNwbGl0KCAnLCcgKS5tYXAoIChzKSA9PiBzLnRyaW0oKSApLmZpbHRlciggQm9vbGVhbiApICk7XHJcblxyXG5cdFx0XHQodmFsdWVzIHx8IFtdKS5mb3JFYWNoKCAocmF3VmFsLCBpZHgpID0+IHtcclxuXHRcdFx0XHRsZXQgbGFiZWxUZXh0ID0gcmF3VmFsO1xyXG5cdFx0XHRcdGxldCB2ICAgICAgICAgPSByYXdWYWw7XHJcblx0XHRcdFx0aWYgKCByYXdWYWwuaW5jbHVkZXMoICdAQCcgKSApIHtcclxuXHRcdFx0XHRcdGNvbnN0IFsgdHRsLCB2diBdID0gcmF3VmFsLnNwbGl0KCAnQEAnICk7XHJcblx0XHRcdFx0XHRsYWJlbFRleHQgICAgICAgICA9IHR0bDtcclxuXHRcdFx0XHRcdHYgICAgICAgICAgICAgICAgID0gdnY7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBzZWxlY3RlZCBsb2dpY1xyXG5cdFx0XHRcdGxldCBjaGVja2VkID0gJyc7XHJcblx0XHRcdFx0aWYgKCBkZWZhdWx0c1NldC5oYXMoIHYgKSApIGNoZWNrZWQgPSAnIGNoZWNrZWQ9XCJjaGVja2VkXCInO1xyXG5cdFx0XHRcdGNvbnN0IHBkID0gdGhpcy5wb3N0ZWRfZGF0YT8uW25hbWVdO1xyXG5cdFx0XHRcdGlmICggcGQgKSB7XHJcblx0XHRcdFx0XHRpZiAoIG11bHRpcGxlICYmIEFycmF5LmlzQXJyYXkoIHBkICkgJiYgcGQuaW5jbHVkZXMoIHYgKSApIGNoZWNrZWQgPSAnIGNoZWNrZWQ9XCJjaGVja2VkXCInO1xyXG5cdFx0XHRcdFx0aWYgKCAhbXVsdGlwbGUgJiYgU3RyaW5nKCBwZCApID09PSB2ICkgY2hlY2tlZCA9ICcgY2hlY2tlZD1cImNoZWNrZWRcIic7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyB1bmlxdWUgSUQgaWYgdXNpbmcgbGFiZWwgZWxlbWVudFxyXG5cdFx0XHRcdGxldCBpZEZvcklucHV0ICAgID0gJyc7XHJcblx0XHRcdFx0bGV0IGxhYmVsRm9yUGFyYW0gPSAnJztcclxuXHRcdFx0XHRpZiAoIHVzZV9sYWJlbF9lbGVtZW50ICkge1xyXG5cdFx0XHRcdFx0Y29uc3QgdW5pcSAgICA9IChpZE1hdGNoID8gaWRNYXRjaFsxXSA6ICdjaGVja2JveGlkJykgKyBTdHJpbmcoIERhdGUubm93KCkgKSArIGlkeCArIE1hdGguZmxvb3IoIDEwMDAgKyBNYXRoLnJhbmRvbSgpICogOTAwMCApO1xyXG5cdFx0XHRcdFx0aWRGb3JJbnB1dCAgICA9IGAgaWQ9XCIke3RoaXMuZXNjX2F0dHIoIHVuaXEgKX1cImA7XHJcblx0XHRcdFx0XHRsYWJlbEZvclBhcmFtID0gYCBmb3I9XCIke3RoaXMuZXNjX2F0dHIoIHVuaXEgKX1cImA7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRjb25zdCBvbmNoYW5nZSA9IGAgb25jaGFuZ2U9XCJpZih3aW5kb3cud3BiY19zaG93X2Nvc3RfaGludHNfYWZ0ZXJfZmV3X3NlY29uZHMpe3dwYmNfc2hvd19jb3N0X2hpbnRzX2FmdGVyX2Zld19zZWNvbmRzKCR7dGhpcy5jdXJyZW50X2Jvb2tpbmdfdHlwZX0pO31cIiBgO1xyXG5cdFx0XHRcdGNvbnN0IG5hbWVBdHRyID0gYCR7dGhpcy5lc2NfYXR0ciggbmFtZSApfSR7bXVsdGlwbGUgPyAnW10nIDogJyd9YDtcclxuXHRcdFx0XHRjb25zdCBpbnB1dCAgICA9IGA8aW5wdXQgJHthdHRzTm9JZH0ke2lkRm9ySW5wdXR9JHtvbmNoYW5nZX0gdHlwZT1cIiR7aW5wdXRfdHlwZX1cIiBuYW1lPVwiJHtuYW1lQXR0cn1cIiB2YWx1ZT1cIiR7dGhpcy5lc2NfYXR0ciggdiApfVwiJHtjaGVja2VkfSR7ZGVmYXVsdE9ufSAvPmA7XHJcblxyXG5cdFx0XHRcdGxldCBpdGVtO1xyXG5cdFx0XHRcdGlmICggbGFiZWxfd3JhcCApIHtcclxuXHRcdFx0XHRcdC8vIDxsYWJlbD5sYWJlbCBvciBpbnB1dCBmaXJzdCBwZXIgbGFiZWxfZmlyc3Q8L2xhYmVsPlxyXG5cdFx0XHRcdFx0aWYgKCBsYWJlbF9maXJzdCApIHtcclxuXHRcdFx0XHRcdFx0aXRlbSA9IGA8bGFiZWwke2xhYmVsRm9yUGFyYW19IGNsYXNzPVwid3BkZXYtbGlzdC1pdGVtLWxhYmVsXCI+JHt0aGlzLmVzY19hdHRyKCBsYWJlbFRleHQgKX0ke2lucHV0fTwvbGFiZWw+YDtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGl0ZW0gPSBgPGxhYmVsJHtsYWJlbEZvclBhcmFtfSBjbGFzcz1cIndwZGV2LWxpc3QtaXRlbS1sYWJlbFwiPiR7aW5wdXR9JHt0aGlzLmVzY19hdHRyKCBsYWJlbFRleHQgKX08L2xhYmVsPmA7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNvbnN0IGxhYmVsRWwgPSB1c2VfbGFiZWxfZWxlbWVudCA/ICdsYWJlbCcgOiAnc3Bhbic7XHJcblx0XHRcdFx0XHRjb25zdCBsYWJlbCAgID0gYDwke2xhYmVsRWx9JHtsYWJlbEZvclBhcmFtfSBjbGFzcz1cIndwZGV2LWxpc3QtaXRlbS1sYWJlbFwiPiR7dGhpcy5lc2NfYXR0ciggbGFiZWxUZXh0ICl9PC8ke2xhYmVsRWx9PmA7XHJcblx0XHRcdFx0XHRpdGVtICAgICAgICAgID0gbGFiZWxfZmlyc3QgPyAobGFiZWwgKyBpbnB1dCkgOiAoaW5wdXQgKyBsYWJlbCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRodG1sSXRlbXMgKz0gYDxzcGFuIGNsYXNzPVwid3BkZXYtbGlzdC1pdGVtXCI+JHtpdGVtfTwvc3Bhbj5gO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRjb25zdCBncm91cCA9IGA8c3BhbiR7aWRNYXRjaCA/IGF0dHNOb0lkIDogYXR0c30ke2dyb3VwSWRBdHRyfT4ke2h0bWxJdGVtc308L3NwYW4+YDtcclxuXHRcdFx0cmV0dXJuIGA8c3BhbiBjbGFzcz1cIndwYmNfd3JhcF9jaGVja2JveCB3cGRldi1mb3JtLWNvbnRyb2wtd3JhcCAke3RoaXMuZXNjX2F0dHIoIG5hbWUgKX1cIj4ke2dyb3VwfSR7dmFsaWRhdGlvbl9lcnJvcn08L3NwYW4+YDtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBRdWl6XHJcblx0XHRpZiAoIHR5cGUgPT09ICdxdWl6JyApIHtcclxuXHRcdFx0Ly8gSWYgbm8gcHJvdmlkZWQsIGRlZmF1bHQgcXVpeiBsaWtlIFBIUFxyXG5cdFx0XHRsZXQgcmF3ICAgICAgICA9IEFycmF5LmlzQXJyYXkoIHZhbHVlcyApICYmIHZhbHVlcy5sZW5ndGggPyB2YWx1ZXMuc2xpY2UoKSA6IFtdO1xyXG5cdFx0XHRsZXQgcmF3X3ZhbHVlcyA9IHJhdy5sZW5ndGggPyByYXcgOiBbICcxKzE9PycgXTtcclxuXHRcdFx0Y29uc3QgcGlwZXMgICAgPSB0aGlzLmdldF9waXBlcyggKHJhdy5sZW5ndGggPyAocmF3Lm1hcCggKHYpID0+IGAke3Z9fCR7dn1gICkpIDogWyAnMSsxPT98MicgXSkgKTsgLy8gZW11bGF0ZVxyXG5cdFx0XHQvLyBwaWNrIG9uZSBxdWVzdGlvblxyXG5cdFx0XHRjb25zdCBxICAgICAgICAgID0gcmF3X3ZhbHVlcy5sZW5ndGggPT09IDEgPyByYXdfdmFsdWVzWzBdIDogcmF3X3ZhbHVlc1tNYXRoLmZsb29yKCBNYXRoLnJhbmRvbSgpICogcmF3X3ZhbHVlcy5sZW5ndGggKV07XHJcblx0XHRcdGNvbnN0IGFuc3dlciAgICAgPSB0aGlzLnBpcGUoIHBpcGVzLCBxICk7IC8vIGhlcmUgZXF1YWwsIGJ1dCBrZXB0IGZvciBwYXJpdHlcclxuXHRcdFx0Y29uc3QgaGlkZGVuSGFzaCA9IHRoaXMuZXNjX2F0dHIoIGFuc3dlciApOyAvLyBzZXJ2ZXIgaGFzaCBub3QgYXZhaWxhYmxlOyBzdG9yZSBjbGVhciBvciBhdHRhY2ggeW91ciBvd24gaGFzaCBmdW5jdGlvblxyXG5cdFx0XHRsZXQgaHRtbCAgICAgICAgID0gYDxzcGFuIGNsYXNzPVwid3BkZXYtcXVpei1sYWJlbFwiPiR7dGhpcy5lc2NfYXR0ciggcSApfTwvc3Bhbj4mbmJzcDtgO1xyXG5cdFx0XHRodG1sICs9IGA8aW5wdXQgdHlwZT1cInRleHRcIiBuYW1lPVwiJHt0aGlzLmVzY19hdHRyKCBuYW1lICl9XCIke2F0dHN9IC8+YDtcclxuXHRcdFx0aHRtbCArPSBgPGlucHV0IHR5cGU9XCJoaWRkZW5cIiBuYW1lPVwid3BkZXZfcXVpel9hbnN3ZXJfJHt0aGlzLmVzY19hdHRyKCBuYW1lICl9XCIgdmFsdWU9XCIke2hpZGRlbkhhc2h9XCIgLz5gO1xyXG5cdFx0XHRyZXR1cm4gYDxzcGFuIGNsYXNzPVwid3BkZXYtZm9ybS1jb250cm9sLXdyYXAgJHt0aGlzLmVzY19hdHRyKCBuYW1lICl9XCI+JHtodG1sfSR7dmFsaWRhdGlvbl9lcnJvcn08L3NwYW4+YDtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBBY2NlcHRhbmNlXHJcblx0XHRpZiAoIHR5cGUgPT09ICdhY2NlcHRhbmNlJyApIHtcclxuXHRcdFx0Y29uc3QgaW52ZXJ0ICAgID0gKG9wdGlvbnMgfHwgW10pLmluY2x1ZGVzKCAnaW52ZXJ0JyApOyAvLyBub3QgdXNlZCBjbGllbnQtc2lkZSBoZXJlXHJcblx0XHRcdGNvbnN0IGRlZmF1bHRPbiA9IChvcHRpb25zIHx8IFtdKS5pbmNsdWRlcyggJ2RlZmF1bHQ6b24nICk7XHJcblx0XHRcdGNvbnN0IGNoZWNrZWQgICA9IGRlZmF1bHRPbiA/ICcgY2hlY2tlZD1cImNoZWNrZWRcIicgOiAnJztcclxuXHRcdFx0Y29uc3Qgb25jbGljayAgID0gJyBvbmNsaWNrPVwiaWYod2luZG93LndwZGV2VG9nZ2xlU3VibWl0KXdwZGV2VG9nZ2xlU3VibWl0KHRoaXMuZm9ybSk7XCInO1xyXG5cdFx0XHRjb25zdCBodG1sICAgICAgPSBgPGlucHV0IHR5cGU9XCJjaGVja2JveFwiIG5hbWU9XCIke3RoaXMuZXNjX2F0dHIoIG5hbWUgKX1cIiB2YWx1ZT1cIjFcIiR7YXR0c30ke29uY2xpY2t9JHtjaGVja2VkfSAvPmA7XHJcblx0XHRcdHJldHVybiBodG1sO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIGNhcHRjaGFjIChpbWFnZSkgLyBjYXB0Y2hhciAoaW5wdXQpIOKAlCBzdHVic1xyXG5cdFx0aWYgKCB0eXBlID09PSAnY2FwdGNoYWMnICkge1xyXG5cdFx0XHRjb25zdCBodG1sICAgPSBgPGltZyBhbHQ9XCJDQVBUQ0hBIHVuYXZhaWxhYmxlIG9uIGZyb250LWVuZCBKU1wiIHNyYz1cIlwiJHthdHRzfSAvPmA7XHJcblx0XHRcdGNvbnN0IGhpZGRlbiA9IGA8aW5wdXQgdHlwZT1cImhpZGRlblwiIG5hbWU9XCJ3cGRldl9jYXB0Y2hhX2NoYWxsZW5nZV8ke3RoaXMuZXNjX2F0dHIoIG5hbWUgKX1cIiB2YWx1ZT1cIlwiIC8+YDtcclxuXHRcdFx0cmV0dXJuIGhpZGRlbiArIGh0bWw7XHJcblx0XHR9XHJcblx0XHRpZiAoIHR5cGUgPT09ICdjYXB0Y2hhcicgKSB7XHJcblx0XHRcdGNvbnN0IGh0bWwgPSBgPGlucHV0IHR5cGU9XCJ0ZXh0XCIgbmFtZT1cIiR7dGhpcy5lc2NfYXR0ciggbmFtZSApfVwiJHthdHRzfSAvPmA7XHJcblx0XHRcdHJldHVybiBgPHNwYW4gY2xhc3M9XCJ3cGJjX3dyYXBfdGV4dCB3cGRldi1mb3JtLWNvbnRyb2wtd3JhcCAke3RoaXMuZXNjX2F0dHIoIG5hbWUgKX1cIj4ke2h0bWx9JHt2YWxpZGF0aW9uX2Vycm9yfTwvc3Bhbj5gO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIEZpbGVcclxuXHRcdGlmICggL15maWxlXFwqPyQvLnRlc3QoIHR5cGUgKSApIHtcclxuXHRcdFx0Y29uc3QgaHRtbCA9IGA8aW5wdXQgdHlwZT1cImZpbGVcIiBuYW1lPVwiJHt0aGlzLmVzY19hdHRyKCBuYW1lICl9XCIke2F0dHN9IC8+YDtcclxuXHRcdFx0cmV0dXJuIGA8c3BhbiBjbGFzcz1cIndwZGV2LWZvcm0tY29udHJvbC13cmFwICR7dGhpcy5lc2NfYXR0ciggbmFtZSApfVwiPiR7aHRtbH0ke3ZhbGlkYXRpb25fZXJyb3J9PC9zcGFuPmA7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gU3VibWl0IGJ1dHRvblxyXG5cdFx0aWYgKCAvXlxcWz9zdWJtaXQvLnRlc3QoIHR5cGUgKSB8fCB0eXBlID09PSAnc3VibWl0JyApIHtcclxuXHRcdFx0Ly8gSGFuZGxlIHZpYSBzdWJtaXRfcmVwbGFjZV9jYWxsYmFjayAoY2FsbGVkIHNlcGFyYXRlbHkgd2hlbiB3ZSBwYXJzZSBzdWJtaXQpXHJcblx0XHRcdC8vIEhlcmU6IGZhbGxiYWNrIHNpbXBsZSBidXR0b25cclxuXHRcdFx0Y29uc3QgdmFsdWVUZXh0ID0gJ1NlbmQnO1xyXG5cdFx0XHRjb25zdCBidG4gICAgICAgPSBgPGlucHV0IHR5cGU9XCJidXR0b25cIiB2YWx1ZT1cIiR7dGhpcy5lc2NfYXR0ciggdmFsdWVUZXh0ICl9XCIke2F0dHN9IC8+YDtcclxuXHRcdFx0cmV0dXJuIGJ0bjtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBGYWxsYmFjazogcGxhaW4gaW5wdXQgdGV4dFxyXG5cdFx0Y29uc3QgaHRtbCA9IGA8aW5wdXQgdHlwZT1cInRleHRcIiBuYW1lPVwiJHt0aGlzLmVzY19hdHRyKCBuYW1lICl9XCIgdmFsdWU9XCIke3RoaXMuZXNjX2F0dHIoIHZhbHVlICl9XCIke2F0dHN9IC8+YDtcclxuXHRcdHJldHVybiBgPHNwYW4gY2xhc3M9XCJ3cGJjX3dyYXBfdGV4dCB3cGRldi1mb3JtLWNvbnRyb2wtd3JhcCAke3RoaXMuZXNjX2F0dHIoIG5hbWUgKX1cIj4ke2h0bWx9JHt2YWxpZGF0aW9uX2Vycm9yfTwvc3Bhbj5gO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogU3VibWl0IGJ1dHRvbiByZXBsYWNlbWVudCAoc2VwYXJhdGUgcGFzcywgbGlrZSBQSFAgc3VibWl0X3JlcGxhY2VfY2FsbGJhY2spXHJcblx0ICovXHJcblx0c3VibWl0X3JlcGxhY2VfY2FsbGJhY2sobWF0Y2gpIHtcclxuXHRcdC8vIG1hdGNoWzFdID0+IG9wdGlvbnMgYXJlYSAoY2xhc3Nlcy9pZCksIG1hdGNoWzJdID0+IHF1b3RlZCB2YWx1ZSAobGFiZWwpXHJcblx0XHRsZXQgYXR0cyAgICAgICA9ICcnO1xyXG5cdFx0Y29uc3Qgb3B0Q2h1bmsgPSAobWF0Y2hbMV0gfHwgJycpLnRyaW0oKTtcclxuXHRcdGNvbnN0IG9wdGlvbnMgID0gb3B0Q2h1bmsgPyBvcHRDaHVuay5zcGxpdCggL1xccysvICkgOiBbXTtcclxuXHJcblx0XHQvLyBpZDpcclxuXHRcdGNvbnN0IGlkT3B0ID0gb3B0aW9ucy5maW5kKCAobykgPT4gL15pZDpbLTAtOWEtekEtWl9dKyQvLnRlc3QoIG8gKSApO1xyXG5cdFx0aWYgKCBpZE9wdCApIHtcclxuXHRcdFx0Y29uc3QgaWQgPSBpZE9wdC5zcGxpdCggJzonIClbMV07XHJcblx0XHRcdGF0dHMgKz0gYCBpZD1cIiR7dGhpcy5lc2NfYXR0ciggaWQgKX1cImA7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gY2xhc3NlczpcclxuXHRcdGNvbnN0IGNscyAgICAgICA9IG9wdGlvbnMuZmlsdGVyKCAobykgPT4gL15jbGFzczpbLTAtOWEtekEtWl9dKyQvLnRlc3QoIG8gKSApLm1hcCggKG8pID0+IG8uc3BsaXQoICc6JyApWzFdICk7XHJcblx0XHRjb25zdCBjbGFzc19hdHQgPSBjbHMubGVuZ3RoID8gYCBjbGFzcz1cIndwYmNfYnV0dG9uX2xpZ2h0ICR7dGhpcy5lc2NfYXR0ciggY2xzLmpvaW4oICcgJyApICl9XCJgIDogYCBjbGFzcz1cIndwYmNfYnV0dG9uX2xpZ2h0XCJgO1xyXG5cdFx0YXR0cyArPSBjbGFzc19hdHQ7XHJcblxyXG5cdFx0bGV0IHZhbHVlID0gKG1hdGNoWzJdID8gdGhpcy5zdHJpcF9xdW90ZSggbWF0Y2hbMl0gKSA6ICcnKSB8fCAnU2VuZCc7XHJcblxyXG5cdFx0Ly8gTm8gYWRtaW4vZWRpdCBoYXNoIGZsb3cgb24gY2xpZW50OyBzaW1wbGUgc3VibWl0IGJ1dHRvbiBob29raW5nIHRvIEpTOlxyXG5cdFx0Y29uc3QgYnRuID0gYDxpbnB1dCB0eXBlPVwiYnV0dG9uXCIgdmFsdWU9XCIke3RoaXMuZXNjX2F0dHIoIHZhbHVlICl9XCIke2F0dHN9IG9uY2xpY2s9XCJpZih3aW5kb3cubXlib29raW5nX3N1Ym1pdCl7bXlib29raW5nX3N1Ym1pdCh0aGlzLmZvcm0sICR7dGhpcy5jdXJyZW50X2Jvb2tpbmdfdHlwZX0sICh3aW5kb3cud3BiY19nZXRfbWF5YmVfcmVsb2FkZWRfYm9va2luZ19sb2NhbGU/d3BiY19nZXRfbWF5YmVfcmVsb2FkZWRfYm9va2luZ19sb2NhbGUoKTonJykpO31cIiAvPmA7XHJcblx0XHRyZXR1cm4gYnRuO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUGFyc2UgJiAob3B0aW9uYWxseSkgcmVwbGFjZSBhbGwgc2hvcnRjb2RlcyBpbiBhIGZvcm0gc3RyaW5nLlxyXG5cdCAqIFdoZW4gcmVwbGFjZSA9IGZhbHNlLCByZXR1cm5zIGFuIGFycmF5IG9mIHBhcnNlZCBlbGVtZW50cy5cclxuXHQgKi9cclxuXHRmb3JtX2VsZW1lbnRzKGZvcm0sIHJlcGxhY2UgPSB0cnVlKSB7XHJcblx0XHRjb25zdCB0eXBlcyAgICAgID0gU3RyaW5nLnJhd2B0ZXh0WypdP3xlbWFpbFsqXT98Y291cG9uWypdP3x0aW1lWypdP3x0ZXh0YXJlYVsqXT98c2VsZWN0WypdP3xzZWxlY3Rib3hbKl0/fGNoZWNrYm94WypdP3xyYWRpb1sqXT98YWNjZXB0YW5jZXxjYXB0Y2hhY3xjYXB0Y2hhcnxmaWxlWypdP3xxdWl6YDtcclxuXHRcdGNvbnN0IHJlTWFpbiAgICAgPSBuZXcgUmVnRXhwKFxyXG5cdFx0XHRTdHJpbmcucmF3YFxcW1xccyooYCArIHR5cGVzICsgU3RyaW5nLnJhd2ApKFxccytbYS16QS1aXVswLTlhLXpBLVo6Ll8tXSopKFstMC05YS16QS1aOiNfL3xcXHNdKik/KCg/OlxccyooPzpcIlteXCJdKlwifCdbXiddKicpKSopP1xccypcXF1gLFxyXG5cdFx0XHQnZydcclxuXHRcdCk7XHJcblx0XHQvLyBzdGFydHRpbWV8ZW5kdGltZXxjb3VudHJ5IHZhcmlhbnRzXHJcblx0XHRjb25zdCByZVN0YXJ0RW5kID0gbmV3IFJlZ0V4cChcclxuXHRcdFx0U3RyaW5nLnJhd2BcXFtcXHMqKGNvdW50cnlbKl0/fHN0YXJ0dGltZVsqXT98ZW5kdGltZVsqXT8pKFxccypbYS16QS1aXSpbMC05YS16QS1aOi5fLV0qKShbLTAtOWEtekEtWjojXy98XFxzXSopPygoPzpcXHMqKD86XCJbXlwiXSpcInwnW14nXSonKSkqKT9cXHMqXFxdYCxcclxuXHRcdFx0J2cnXHJcblx0XHQpO1xyXG5cdFx0Y29uc3QgcmVTdWJtaXQgICA9IG5ldyBSZWdFeHAoXHJcblx0XHRcdFN0cmluZy5yYXdgXFxbXFxzKnN1Ym1pdChcXHNbLTAtOWEtekEtWjojXy9cXHNdKik/KFxccysoPzpcIlteXCJdKlwifCdbXiddKicpKT9cXHMqXFxdYCxcclxuXHRcdFx0J2cnXHJcblx0XHQpO1xyXG5cclxuXHRcdGlmICggcmVwbGFjZSApIHtcclxuXHRcdFx0bGV0IG91dCA9IFN0cmluZyggZm9ybSApO1xyXG5cclxuXHRcdFx0b3V0ID0gb3V0LnJlcGxhY2UoIHJlTWFpbiwgKC4uLm0pID0+IHRoaXMuZm9ybV9lbGVtZW50X3JlcGxhY2VfY2FsbGJhY2soIG0gKSApO1xyXG5cdFx0XHRvdXQgPSBvdXQucmVwbGFjZSggcmVTdGFydEVuZCwgKC4uLm0pID0+IHRoaXMuZm9ybV9lbGVtZW50X3JlcGxhY2VfY2FsbGJhY2soIG0gKSApO1xyXG5cdFx0XHRvdXQgPSBvdXQucmVwbGFjZSggcmVTdWJtaXQsICguLi5tKSA9PiB0aGlzLnN1Ym1pdF9yZXBsYWNlX2NhbGxiYWNrKCBtICkgKTtcclxuXHJcblx0XHRcdHJldHVybiBvdXQ7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRjb25zdCByZXN1bHRzICAgID0gW107XHJcblx0XHRcdGNvbnN0IGFkZE1hdGNoZXMgPSAocmVnZXgsIHNyYykgPT4ge1xyXG5cdFx0XHRcdGxldCBtYXRjaDtcclxuXHRcdFx0XHR3aGlsZSAoIChtYXRjaCA9IHJlZ2V4LmV4ZWMoIHNyYyApKSApIHtcclxuXHRcdFx0XHRcdHJlc3VsdHMucHVzaCggdGhpcy5mb3JtX2VsZW1lbnRfcGFyc2UoIG1hdGNoICkgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH07XHJcblx0XHRcdGFkZE1hdGNoZXMoIG5ldyBSZWdFeHAoIHJlTWFpbi5zb3VyY2UsICdnJyApLCBmb3JtICk7XHJcblx0XHRcdGFkZE1hdGNoZXMoIG5ldyBSZWdFeHAoIHJlU3RhcnRFbmQuc291cmNlLCAnZycgKSwgZm9ybSApO1xyXG5cdFx0XHQvLyBzdWJtaXQgbm90IGluY2x1ZGVkIGluIHBhcnNlLW9ubHkgaW4gUEhQLCBrZWVwaW5nIHBhcml0eVxyXG5cdFx0XHRyZXR1cm4gcmVzdWx0cztcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEVxdWl2YWxlbnQgb2YgZ2V0X2Jvb2tpbmdfZGF0YSgpIFwicGFyc2VkX2Zvcm1cIiBzcGxpdHRlciBmb3Igc3RvcmVkIGZvcm0gc3RyaW5nLlxyXG5cdCAqIElucHV0IGV4YW1wbGU6IFwiY2hlY2tib3heZmVlNF50cnVlfnRleHRebmFtZTReSm9oblwiXHJcblx0ICovXHJcblx0cGFyc2VfYm9va2luZ19mb3JtX3N0cmluZyhmb3JtU3RyLCBib29raW5nX3R5cGVfc3VmZml4ID0gJycpIHtcclxuXHRcdGNvbnN0IHJldCA9IHt9O1xyXG5cdFx0aWYgKCAhZm9ybVN0ciApIHJldHVybiByZXQ7XHJcblxyXG5cdFx0Y29uc3QgcGFydHMgPSBTdHJpbmcoIGZvcm1TdHIgKS5zcGxpdCggJ34nICk7XHJcblx0XHRmb3IgKCBjb25zdCBmaWVsZCBvZiBwYXJ0cyApIHtcclxuXHRcdFx0Y29uc3QgZWxlbXMgPSBmaWVsZC5zcGxpdCggJ14nICk7XHJcblx0XHRcdGlmICggZWxlbXMubGVuZ3RoIDwgMyApIGNvbnRpbnVlO1xyXG5cclxuXHRcdFx0bGV0IHR5cGUgICAgICAgICA9IGVsZW1zWzBdO1xyXG5cdFx0XHRsZXQgZWxlbWVudF9uYW1lID0gZWxlbXNbMV07XHJcblx0XHRcdGxldCB2YWx1ZSAgICAgICAgPSBlbGVtc1syXTtcclxuXHJcblx0XHRcdC8vIGJvb2tpbmcgdHlwZSBzdWZmaXggaGFuZGxpbmcgKHJlbW92ZSBbXSBhbmQgdHJhaWxpbmcgdHlwZSlcclxuXHRcdFx0bGV0IHR5cGVfbmFtZSA9IGVsZW1lbnRfbmFtZS5yZXBsYWNlKCAnW10nLCAnJyApO1xyXG5cdFx0XHRpZiAoIGJvb2tpbmdfdHlwZV9zdWZmaXggJiYgdHlwZV9uYW1lLmVuZHNXaXRoKCBib29raW5nX3R5cGVfc3VmZml4ICkgKSB7XHJcblx0XHRcdFx0dHlwZV9uYW1lID0gdHlwZV9uYW1lLnNsaWNlKCAwLCAtYm9va2luZ190eXBlX3N1ZmZpeC5sZW5ndGggKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCB0eXBlID09PSAnY2hlY2tib3gnICkge1xyXG5cdFx0XHRcdGlmICggdmFsdWUgPT09ICd0cnVlJyApIHZhbHVlID0gJ29uJztcclxuXHRcdFx0XHRlbHNlIGlmICggdmFsdWUgPT09ICdmYWxzZScgfHwgdmFsdWUgPT09ICdPZmYnIHx8IHZhbHVlID09IG51bGwgKSB2YWx1ZSA9ICcnO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRlbGVtZW50X25hbWUgPSBlbGVtZW50X25hbWUucmVwbGFjZSggJ1tdJywgJycgKTtcclxuXHRcdFx0aWYgKCByZXRbZWxlbWVudF9uYW1lXSApIHtcclxuXHRcdFx0XHRpZiAoIHZhbHVlICE9PSAnJyApIHJldFtlbGVtZW50X25hbWVdLnZhbHVlICs9ICcsJyArIHZhbHVlO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHJldFtlbGVtZW50X25hbWVdID0geyB2YWx1ZSwgdHlwZSwgZWxlbWVudF9uYW1lOiB0eXBlX25hbWUgfTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHJldDtcclxuXHR9XHJcbn1cclxuXHJcblxyXG5cclxuXHJcblxyXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICogIFJlYWwtdGltZSBQcmV2aWV3IFdpcmluZ1xyXG4gKiAgUmVxdWlyZW1lbnRzOiB3aW5kb3cuV1BCQ19Gb3JtX1Nob3J0Y29kZV9QYXJzZXIgbXVzdCBiZSBhdmFpbGFibGUgKGZyb20gdGhlIHByZXZpb3VzIGFuc3dlcikuXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqICBSZWFsLXRpbWUgUHJldmlldyBXaXJpbmcgKGNvbXBsZXRlKVxyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cclxuXHJcbihmdW5jdGlvbiBzZXR1cExpdmVQcmV2aWV3KCkge1xyXG5cclxuXHQvLyAwKSBCb29raW5nIHR5cGUgdXNlZCB0byBzdWZmaXggbmFtZXNcclxuXHRmdW5jdGlvbiBfZ2V0Q3VycmVudEJvb2tpbmdUeXBlKCkge1xyXG5cdFx0Y29uc3QgdCA9IHdpbmRvdy5fd3BiY19idWlsZGVyPy5jdXJyZW50X2Jvb2tpbmdfdHlwZSA/PyB3aW5kb3cud3BiY19iZmI/LmN1cnJlbnRfYm9va2luZ190eXBlID8/IDE7XHJcblx0XHRyZXR1cm4gU3RyaW5nKCB0ICk7XHJcblx0fVxyXG5cclxuXHQvLyAxKSBTaW5nbGUgc2hhcmVkIHBhcnNlciBpbnN0YW5jZVxyXG5cdGZ1bmN0aW9uIF9nZXRQYXJzZXIoKSB7XHJcblx0XHRpZiAoICF3aW5kb3cuV1BCQ19Gb3JtX1Nob3J0Y29kZV9QYXJzZXIgKSByZXR1cm4gbnVsbDtcclxuXHRcdGlmICggIXdpbmRvdy53cGJjX3Nob3J0Y29kZV9wYXJzZXIgKSB7XHJcblx0XHRcdHdpbmRvdy5XUEJDX0NPVU5UUklFUyAgICAgICAgPSB3aW5kb3cuV1BCQ19DT1VOVFJJRVMgfHwge1xyXG5cdFx0XHRcdFVTOiAnVW5pdGVkIFN0YXRlcycsXHJcblx0XHRcdFx0R0I6ICdVbml0ZWQgS2luZ2RvbScsXHJcblx0XHRcdFx0RlI6ICdGcmFuY2UnLFxyXG5cdFx0XHRcdEVTOiAnU3BhaW4nXHJcblx0XHRcdH07XHJcblx0XHRcdHdpbmRvdy53cGJjX3Nob3J0Y29kZV9wYXJzZXIgPSBuZXcgV1BCQ19Gb3JtX1Nob3J0Y29kZV9QYXJzZXIoIHtcclxuXHRcdFx0XHRjdXJyZW50X2Jvb2tpbmdfdHlwZTogX2dldEN1cnJlbnRCb29raW5nVHlwZSgpLFxyXG5cdFx0XHRcdGNvdW50cmllc19saXN0ICAgICAgOiB3aW5kb3cuV1BCQ19DT1VOVFJJRVMsXHJcblx0XHRcdFx0Y3VycmVudF9lZGl0X2Jvb2tpbmc6IHdpbmRvdy5fd3BiY19idWlsZGVyPy5jdXJyZW50X2VkaXRfYm9va2luZyB8fCBudWxsLFxyXG5cdFx0XHRcdHBvc3RlZF9kYXRhICAgICAgICAgOiB7fVxyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblx0XHR3aW5kb3cud3BiY19zaG9ydGNvZGVfcGFyc2VyLmN1cnJlbnRfYm9va2luZ190eXBlID0gX2dldEN1cnJlbnRCb29raW5nVHlwZSgpO1xyXG5cdFx0cmV0dXJuIHdpbmRvdy53cGJjX3Nob3J0Y29kZV9wYXJzZXI7XHJcblx0fVxyXG5cclxuXHQvLyAyKSBCdWlsZCAob3IgcmV1c2UpIHRoZSBVSVxyXG5cdGZ1bmN0aW9uIF9lbnN1cmVFeHBvcnRVSSgpIHtcclxuXHRcdGxldCB3cmFwID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9fZXhwb3J0X3dyYXAnICk7XHJcblx0XHRpZiAoICF3cmFwICkge1xyXG5cdFx0XHRjb25zdCBhZnRlciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2luc3BlY3RvcicgKSB8fCBkb2N1bWVudC5ib2R5O1xyXG5cclxuXHRcdFx0d3JhcCAgICAgICAgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc2VjdGlvbicgKTtcclxuXHRcdFx0d3JhcC5pZCAgICAgICAgICAgPSAnd3BiY19iZmJfX2V4cG9ydF93cmFwJztcclxuXHRcdFx0d3JhcC5jbGFzc05hbWUgICAgPSAnd3BiY19iZmJfX2V4cG9ydF93cmFwJztcclxuXHRcdFx0d3JhcC5zdHlsZS5tYXJnaW4gPSAnMTZweCAwJztcclxuXHJcblx0XHRcdGNvbnN0IHRpdGxlICAgICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdoNCcgKTtcclxuXHRcdFx0dGl0bGUudGV4dENvbnRlbnQgID0gJ0FkdmFuY2VkIEZvcm0gKGV4cG9ydCkgKyBMaXZlIFByZXZpZXcnO1xyXG5cdFx0XHR0aXRsZS5zdHlsZS5tYXJnaW4gPSAnMCAwIDZweCc7XHJcblxyXG5cdFx0XHRjb25zdCB0YSAgICAgICAgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3RleHRhcmVhJyApO1xyXG5cdFx0XHR0YS5pZCAgICAgICAgICAgICAgID0gJ3dwYmNfYmZiX19hZHZhbmNlZF9mb3JtX291dHB1dCc7XHJcblx0XHRcdHRhLnJvd3MgICAgICAgICAgICAgPSAxMDtcclxuXHRcdFx0dGEuc3R5bGUud2lkdGggICAgICA9ICcxMDAlJztcclxuXHRcdFx0dGEuc3R5bGUuZm9udEZhbWlseSA9ICdtb25vc3BhY2UnO1xyXG5cdFx0XHR0YS5wbGFjZWhvbGRlciAgICAgID0gJ1Bhc3RlIG9yIHR5cGUgeW91ciBXUEJDIHNob3J0Y29kZSBmb3JtIGhlcmXigKYnO1xyXG5cclxuXHRcdFx0Y29uc3QgYWN0aW9ucyAgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xyXG5cdFx0XHRhY3Rpb25zLnN0eWxlLm1hcmdpbiA9ICc4cHggMCc7XHJcblx0XHRcdGNvbnN0IGNvcHkgICAgICAgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2J1dHRvbicgKTtcclxuXHRcdFx0Y29weS5pZCAgICAgICAgICAgICAgPSAnd3BiY19iZmJfX2NvcHlfYnRuJztcclxuXHRcdFx0Y29weS50eXBlICAgICAgICAgICAgPSAnYnV0dG9uJztcclxuXHRcdFx0Y29weS5jbGFzc05hbWUgICAgICAgPSAnYnV0dG9uJztcclxuXHRcdFx0Y29weS50ZXh0Q29udGVudCAgICAgPSAnQ29weSc7XHJcblx0XHRcdGFjdGlvbnMuYXBwZW5kQ2hpbGQoIGNvcHkgKTtcclxuXHJcblx0XHRcdGNvbnN0IHB2TGFiZWwgICAgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcclxuXHRcdFx0cHZMYWJlbC50ZXh0Q29udGVudCAgPSAnTGl2ZSBwcmV2aWV3Oic7XHJcblx0XHRcdHB2TGFiZWwuc3R5bGUubWFyZ2luID0gJzEycHggMCA0cHgnO1xyXG5cclxuXHRcdFx0Y29uc3QgcHYgICAgICAgICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0XHRcdHB2LmlkICAgICAgICAgICAgICAgPSAnd3BiY19iZmJfX2FkdmFuY2VkX2Zvcm1fcHJldmlldyc7XHJcblx0XHRcdHB2LmNsYXNzTmFtZSAgICAgICAgPSAnd3BiY19iZmJfX2FkdmFuY2VkX2Zvcm1fcHJldmlldyc7XHJcblx0XHRcdHB2LnN0eWxlLm1pbkhlaWdodCAgPSAnNjBweCc7XHJcblx0XHRcdHB2LnN0eWxlLmJvcmRlciAgICAgPSAnMXB4IHNvbGlkICNlNWU3ZWInO1xyXG5cdFx0XHRwdi5zdHlsZS5wYWRkaW5nICAgID0gJzhweCc7XHJcblx0XHRcdHB2LnN0eWxlLmJhY2tncm91bmQgPSAnI2ZmZic7XHJcblxyXG5cdFx0XHR3cmFwLmFwcGVuZCggdGl0bGUsIHRhLCBhY3Rpb25zLCBwdkxhYmVsLCBwdiApO1xyXG5cclxuXHRcdFx0Ly8gSW5zZXJ0IGFmdGVyIGluc3BlY3RvciBzbyBpdCBzdGF5cyBuZWFyYnlcclxuXHRcdFx0aWYgKCBhZnRlci5wYXJlbnROb2RlICkgYWZ0ZXIucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoIHdyYXAsIGFmdGVyLm5leHRTaWJsaW5nICk7XHJcblx0XHRcdGVsc2UgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggd3JhcCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHdyYXAsXHJcblx0XHRcdHRhICA6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2FkdmFuY2VkX2Zvcm1fb3V0cHV0JyApLFxyXG5cdFx0XHRwdiAgOiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19hZHZhbmNlZF9mb3JtX3ByZXZpZXcnICksXHJcblx0XHRcdGNvcHk6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2NvcHlfYnRuJyApXHJcblx0XHR9O1xyXG5cdH1cclxuXHJcblx0Ly8gMykgUmVuZGVyIHByZXZpZXdcclxuXHRmdW5jdGlvbiBfcmVuZGVyUHJldmlldyh0YSwgcHYpIHtcclxuXHRcdGNvbnN0IHBhcnNlciA9IF9nZXRQYXJzZXIoKTtcclxuXHRcdGlmICggIXBhcnNlciApIHtcclxuXHRcdFx0cHYuaW5uZXJIVE1MID0gJzxlbT5QYXJzZXIgbm90IGF2YWlsYWJsZSB5ZXQuPC9lbT4nO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHR0cnkge1xyXG5cdFx0XHRjb25zdCBodG1sICAgPSBwYXJzZXIuZm9ybV9lbGVtZW50cyggdGEudmFsdWUgfHwgJycsIHRydWUgKTtcclxuXHRcdFx0cHYuaW5uZXJIVE1MID0gaHRtbCB8fCAnPGVtPk5vdGhpbmcgdG8gcHJldmlldy48L2VtPic7XHJcblx0XHR9IGNhdGNoICggZXJyICkge1xyXG5cdFx0XHRwdi5pbm5lckhUTUwgICAgICAgICAgICAgID0gJzxwcmUgc3R5bGU9XCJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDtjb2xvcjojYjkxYzFjO1wiPjwvcHJlPic7XHJcblx0XHRcdHB2LmZpcnN0Q2hpbGQudGV4dENvbnRlbnQgPSBTdHJpbmcoIGVyciAmJiBlcnIubWVzc2FnZSB8fCBlcnIgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8vIDQpIENvcHkgYnV0dG9uXHJcblx0ZnVuY3Rpb24gX3dpcmVDb3B5KGNvcHksIHRhKSB7XHJcblx0XHRpZiAoICFjb3B5ICkgcmV0dXJuO1xyXG5cdFx0Y29weS5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCAoKSA9PiB7XHJcblx0XHRcdHRhLnNlbGVjdCgpO1xyXG5cdFx0XHRjb25zdCBvayA9IGRvY3VtZW50LmV4ZWNDb21tYW5kICYmIGRvY3VtZW50LmV4ZWNDb21tYW5kKCAnY29weScgKTtcclxuXHRcdFx0aWYgKCAhb2sgJiYgbmF2aWdhdG9yLmNsaXBib2FyZCApIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KCB0YS52YWx1ZSB8fCAnJyApO1xyXG5cdFx0XHRjb3B5LnRleHRDb250ZW50ID0gJ0NvcGllZCEnO1xyXG5cdFx0XHRzZXRUaW1lb3V0KCAoKSA9PiAoY29weS50ZXh0Q29udGVudCA9ICdDb3B5JyksIDEyMDAgKTtcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdC8vIDUpIEluaXRcclxuXHRmdW5jdGlvbiBfaW5pdCgpIHtcclxuXHRcdGNvbnN0IHsgdGEsIHB2LCBjb3B5IH0gPSBfZW5zdXJlRXhwb3J0VUkoKTtcclxuXHJcblx0XHRjb25zdCBkZWJvdW5jZSA9IChmbiwgd2FpdCA9IDE1MCkgPT4ge1xyXG5cdFx0XHRsZXQgdDtcclxuXHRcdFx0cmV0dXJuICguLi5hKSA9PiB7XHJcblx0XHRcdFx0Y2xlYXJUaW1lb3V0KCB0ICk7XHJcblx0XHRcdFx0dCA9IHNldFRpbWVvdXQoICgpID0+IGZuKCAuLi5hICksIHdhaXQgKTtcclxuXHRcdFx0fTtcclxuXHRcdH07XHJcblx0XHRjb25zdCB1cGRhdGUgICA9ICgpID0+IF9yZW5kZXJQcmV2aWV3KCB0YSwgcHYgKTtcclxuXHJcblx0XHR0YS5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCBkZWJvdW5jZSggdXBkYXRlLCAxMjAgKSApO1xyXG5cdFx0dGEuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIHVwZGF0ZSApO1xyXG5cdFx0X3dpcmVDb3B5KCBjb3B5LCB0YSApO1xyXG5cclxuXHRcdC8vIEZpcnN0IHJlbmRlclxyXG5cdFx0dXBkYXRlKCk7XHJcblxyXG5cdFx0Ly8gS2VlcCBmcmVzaCB3aGVuIHRoZSBidWlsZGVyIHJlbG9hZHMgc3RydWN0dXJlXHJcblx0XHRjb25zdCBFViA9IHdpbmRvdy5XUEJDX0JGQl9FdmVudHMgfHwge307XHJcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCBFVi5TVFJVQ1RVUkVfTE9BREVEIHx8ICd3cGJjOmJmYjpzdHJ1Y3R1cmU6bG9hZGVkJywgdXBkYXRlICk7XHJcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCBFVi5TVFJVQ1RVUkVfQ0hBTkdFIHx8ICd3cGJjOmJmYjpzdHJ1Y3R1cmU6Y2hhbmdlJywgdXBkYXRlICk7XHJcblx0fVxyXG5cclxuXHRpZiAoIGRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJyApIHtcclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdET01Db250ZW50TG9hZGVkJywgX2luaXQgKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0X2luaXQoKTtcclxuXHR9XHJcbn0p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NUJnQyxVQUFVLENBQUUsTUFBT3pCLElBQUksQ0FBQ1AsV0FBVyxHQUFHLE1BQU8sRUFBRSxJQUFLLENBQUM7SUFDdEQsQ0FBRSxDQUFDO0VBQ0o7O0VBRUE7RUFDQSxTQUFTaUMsS0FBS0EsQ0FBQSxFQUFHO0lBQ2hCLE1BQU07TUFBRWhDLEVBQUU7TUFBRVMsRUFBRTtNQUFFSDtJQUFLLENBQUMsR0FBR2pCLGVBQWUsQ0FBQyxDQUFDO0lBRTFDLE1BQU00QyxRQUFRLEdBQUdBLENBQUNDLEVBQUUsRUFBRUMsSUFBSSxHQUFHLEdBQUcsS0FBSztNQUNwQyxJQUFJN04sQ0FBQztNQUNMLE9BQU8sQ0FBQyxHQUFHOE4sQ0FBQyxLQUFLO1FBQ2hCQyxZQUFZLENBQUUvTixDQUFFLENBQUM7UUFDakJBLENBQUMsR0FBR3lOLFVBQVUsQ0FBRSxNQUFNRyxFQUFFLENBQUUsR0FBR0UsQ0FBRSxDQUFDLEVBQUVELElBQUssQ0FBQztNQUN6QyxDQUFDO0lBQ0YsQ0FBQztJQUNELE1BQU1HLE1BQU0sR0FBS0EsQ0FBQSxLQUFNcEIsY0FBYyxDQUFFbEIsRUFBRSxFQUFFUyxFQUFHLENBQUM7SUFFL0NULEVBQUUsQ0FBQ3lCLGdCQUFnQixDQUFFLE9BQU8sRUFBRVEsUUFBUSxDQUFFSyxNQUFNLEVBQUUsR0FBSSxDQUFFLENBQUM7SUFDdkR0QyxFQUFFLENBQUN5QixnQkFBZ0IsQ0FBRSxRQUFRLEVBQUVhLE1BQU8sQ0FBQztJQUN2Q2QsU0FBUyxDQUFFbEIsSUFBSSxFQUFFTixFQUFHLENBQUM7O0lBRXJCO0lBQ0FzQyxNQUFNLENBQUMsQ0FBQzs7SUFFUjtJQUNBLE1BQU1DLEVBQUUsR0FBRzVELE1BQU0sQ0FBQzZELGVBQWUsSUFBSSxDQUFDLENBQUM7SUFDdkNqRCxRQUFRLENBQUNrQyxnQkFBZ0IsQ0FBRWMsRUFBRSxDQUFDRSxnQkFBZ0IsSUFBSSwyQkFBMkIsRUFBRUgsTUFBTyxDQUFDO0lBQ3ZGL0MsUUFBUSxDQUFDa0MsZ0JBQWdCLENBQUVjLEVBQUUsQ0FBQ0csZ0JBQWdCLElBQUksMkJBQTJCLEVBQUVKLE1BQU8sQ0FBQztFQUN4RjtFQUVBLElBQUsvQyxRQUFRLENBQUNvRCxVQUFVLEtBQUssU0FBUyxFQUFHO0lBQ3hDcEQsUUFBUSxDQUFDa0MsZ0JBQWdCLENBQUUsa0JBQWtCLEVBQUVPLEtBQU0sQ0FBQztFQUN2RCxDQUFDLE1BQU07SUFDTkEsS0FBSyxDQUFDLENBQUM7RUFDUjtBQUNELENBQUMsRUFBRSxDQUFDIiwiaWdub3JlTGlzdCI6W119
