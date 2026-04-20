"use strict";

/**
 * WPBC BFB: Field Renderer for "accept_terms"
 * =========================================================================
 * Strategy:
 * - Checkbox text: "I accept"
 * - Sentence: "the {terms} and {conditions}"
 * - Link definitions:
 *   - key
 *   - text
 *   - type: url | popup | anchor  ( Popup functionality exists, but not implemented yet in options. It is for future
 * updates.)
 *   - destination
 *
 * File: ../includes/page-form-builder/field-packs/accept-terms/_out/field-accept-terms-wptpl.js
 *
 * @since    11.0.0
 * @modified 2026-04-05
 * @version  1.0.3
 */
(function (w) {
  'use strict';

  var core = w.WPBC_BFB_Core || {};
  var registry = core.WPBC_BFB_Field_Renderer_Registry || null;
  if (!registry || 'function' !== typeof registry.register) {
    if (w._wpbc && w._wpbc.dev && 'function' === typeof w._wpbc.dev.error) {
      w._wpbc.dev.error('WPBC_BFB_Field_Accept_Terms', 'Registry missing');
    }
    return;
  }
  class WPBC_BFB_Field_Accept_Terms {
    static template_id = 'wpbc-bfb-field-accept_terms';

    /**
     * Return field defaults.
     *
     * @return {Object}
     */
    static get_defaults() {
      return {
        type: 'accept_terms',
        title: '',
        name: 'terms',
        html_id: '',
        required: true,
        cssclass: '',
        help: '',
        checkbox_text: 'I accept',
        sentence: 'the {terms} and {conditions}',
        links: clone_value(get_default_links()),
        min_width: '260px'
      };
    }

    /**
     * Normalize a single link definition.
     *
     * @param {*} raw_link Raw link object.
     * @param {number} index Optional index.
     *
     * @return {Object}
     */
    static normalize_link_def(raw_link, index) {
      return normalize_link_def_item(raw_link, index);
    }

    /**
     * Normalize links collection.
     *
     * @param {*} raw_links Raw links value.
     * @param {boolean} use_defaults Whether to fallback to default links.
     *
     * @return {Array}
     */
    static normalize_links(raw_links, use_defaults) {
      return normalize_links_collection(raw_links, use_defaults);
    }

    /**
     * Normalize field data.
     *
     * @param {Object} raw_data Raw field data.
     *
     * @return {Object}
     */
    static normalize_data(raw_data) {
      var defaults = this.get_defaults();
      var normalized_data = Object.assign({}, defaults, raw_data || {});
      var has_links_prop = has_own_prop(raw_data, 'links');
      normalized_data.required = to_bool(normalized_data.required, defaults.required);
      normalized_data.checkbox_text = String(normalized_data.checkbox_text || defaults.checkbox_text);
      normalized_data.sentence = String(normalized_data.sentence || defaults.sentence);
      normalized_data.links = has_links_prop ? this.normalize_links(raw_data.links, false) : clone_value(get_default_links());
      normalized_data.sentence_preview_html = this.build_sentence_preview_html(normalized_data.sentence, normalized_data.links);
      return normalized_data;
    }

    /**
     * Render field preview.
     *
     * @param {HTMLElement} el Field element.
     * @param {Object} raw_data Field data.
     * @param {Object} ctx Render context.
     *
     * @return {void}
     */
    static render(el, raw_data, ctx) {
      var template_fn;
      var normalized_data;
      var html = '';
      if (!el || !w.wp || 'function' !== typeof w.wp.template) {
        return;
      }
      normalized_data = this.normalize_data(raw_data);
      try {
        template_fn = w.wp.template(this.template_id);
      } catch (err) {
        if (w._wpbc && w._wpbc.dev && 'function' === typeof w._wpbc.dev.error) {
          w._wpbc.dev.error('WPBC_BFB_Field_Accept_Terms.template', err);
        }
        return;
      }
      if ('function' !== typeof template_fn) {
        return;
      }
      try {
        html = template_fn(normalized_data);
      } catch (err2) {
        if (w._wpbc && w._wpbc.dev && 'function' === typeof w._wpbc.dev.error) {
          w._wpbc.dev.error('WPBC_BFB_Field_Accept_Terms.render', err2, normalized_data);
        }
        return;
      }
      el.innerHTML = html;
    }

    /**
     * Prepare field data after drop/load.
     *
     * @param {Object} data Field data.
     * @param {HTMLElement} el Field element.
     * @param {Object} meta Context.
     *
     * @return {void}
     */
    static on_field_drop(data, el, meta) {
      var defaults = this.get_defaults();
      var has_links_prop = has_own_prop(data, 'links');
      if (!data) {
        return;
      }
      data.required = to_bool(data.required, defaults.required);
      data.checkbox_text = String(data.checkbox_text || defaults.checkbox_text);
      data.sentence = String(data.sentence || defaults.sentence);
      data.links = has_links_prop ? this.normalize_links(data.links, false) : clone_value(get_default_links());
      if (el) {
        el.dataset.required = data.required ? '1' : '0';
        try {
          el.dataset.links = JSON.stringify(data.links);
          this.update_structure_prop(el, 'required', data.required);
          this.update_structure_prop(el, 'checkbox_text', data.checkbox_text);
          this.update_structure_prop(el, 'sentence', data.sentence);
          this.update_structure_prop(el, 'links', data.links);
          this.dispatch_field_data_changed(el, 'required', data.required);
          this.dispatch_field_data_changed(el, 'checkbox_text', data.checkbox_text);
          this.dispatch_field_data_changed(el, 'sentence', data.sentence);
          this.dispatch_field_data_changed(el, 'links', data.links);
        } catch (err) {}
      }
    }

    /**
     * Build preview HTML from sentence and link tokens.
     *
     * @param {string} sentence Sentence with tokens.
     * @param {Array} links_arr Links array.
     *
     * @return {string}
     */
    static build_sentence_preview_html(sentence, links_arr) {
      var html = '';
      var last_index = 0;
      var token_match;
      var token_regex = /\{([a-zA-Z0-9_]+)\}/g;
      var token_map = build_link_map(this.normalize_links(links_arr, false));
      var sentence_string = String(sentence || '');
      var token_key = '';
      var token_link = null;
      if (!sentence_string) {
        return '';
      }
      while (null !== (token_match = token_regex.exec(sentence_string))) {
        html += escape_html(sentence_string.substring(last_index, token_match.index));
        token_key = String(token_match[1] || '');
        token_link = token_map[token_key] || null;
        if (token_link) {
          html += this.build_link_preview_html(token_link);
        } else {
          html += '<span class="wpbc_bfb__accept_terms_missing_token">{' + escape_html(token_key) + '}</span>';
        }
        last_index = token_match.index + token_match[0].length;
      }
      html += escape_html(sentence_string.substring(last_index));
      return html ? ' ' + html : '';
    }

    /**
     * Build preview HTML for one link definition.
     *
     * @param {Object} link_obj Link definition.
     *
     * @return {string}
     */
    static build_link_preview_html(link_obj) {
      var safe_text = escape_html(link_obj.text || link_obj.key || '');
      var safe_class = String(link_obj.cssclass || '').trim();
      var class_attr = 'wpbc_bfb__accept_terms_link';
      if (safe_class) {
        class_attr += ' ' + escape_attr(safe_class);
      }
      if ('popup' === link_obj.link_type) {
        return '<a href="#" class="' + class_attr + '" data-popup-id="' + escape_attr(link_obj.destination) + '" onclick="return false;">' + safe_text + '</a>';
      }
      if ('anchor' === link_obj.link_type) {
        return '<a href="' + escape_attr(normalize_anchor_href(link_obj.destination)) + '" class="' + class_attr + '" onclick="return false;">' + safe_text + '</a>';
      }
      return '<a href="' + escape_attr(link_obj.destination || '#') + '" class="' + class_attr + '" target="' + escape_attr(link_obj.target || '_blank') + '"' + ('_blank' === String(link_obj.target || '') ? ' rel="noopener noreferrer"' : '') + ' onclick="return false;">' + safe_text + '</a>';
    }

    /**
     * Return currently selected field element.
     *
     * @return {HTMLElement|null}
     */
    static get_selected_field() {
      return document.querySelector('.wpbc_bfb__field.is-selected, .wpbc_bfb__field--selected');
    }

    /**
     * Check if inspector panel belongs to Accept Terms field.
     *
     * @param {HTMLElement} panel Inspector panel.
     *
     * @return {boolean}
     */
    static is_accept_terms_panel(panel) {
      var field_el;
      var field_type = '';
      if (!panel) {
        return false;
      }
      field_el = panel.__accept_terms_field || this.get_selected_field();
      if (field_el) {
        field_type = String(field_el.dataset.type || field_el.getAttribute('data-type') || '').toLowerCase();
      }
      if ('accept_terms' === field_type) {
        return true;
      }
      return !!panel.querySelector('[data-wpbc-bfb-accept-terms-panel="1"]');
    }

    /**
     * Get sentence input.
     *
     * @param {HTMLElement} panel Inspector panel.
     *
     * @return {HTMLElement|null}
     */
    static get_sentence_input(panel) {
      return panel ? panel.querySelector('.inspector__textarea[data-inspector-key="sentence"]') : null;
    }

    /**
     * Get hidden links state input.
     *
     * @param {HTMLElement} panel Inspector panel.
     *
     * @return {HTMLElement|null}
     */
    static get_links_state_input(panel) {
      return panel ? panel.querySelector('.wpbc_bfb__accept_terms_links_state[data-inspector-key="links"]') : null;
    }

    /**
     * Get links list container.
     *
     * @param {HTMLElement} panel Inspector panel.
     *
     * @return {HTMLElement|null}
     */
    static get_links_list(panel) {
      return panel ? panel.querySelector('.wpbc_bfb__accept_terms_links_list') : null;
    }

    /**
     * Get available tokens container.
     *
     * @param {HTMLElement} panel Inspector panel.
     *
     * @return {HTMLElement|null}
     */
    static get_available_tokens_box(panel) {
      return panel ? panel.querySelector('[data-wpbc-bfb-accept-terms-available-tokens="1"]') : null;
    }

    /**
     * Get sentence status container.
     *
     * @param {HTMLElement} panel Inspector panel.
     *
     * @return {HTMLElement|null}
     */
    static get_status_box(panel) {
      return panel ? panel.querySelector('[data-wpbc-bfb-accept-terms-status="1"]') : null;
    }

    /**
     * Read raw links from selected field dataset.
     *
     * @param {HTMLElement} panel Inspector panel.
     *
     * @return {string}
     */
    static get_field_links_raw(panel) {
      var field_el = panel ? panel.__accept_terms_field || this.get_selected_field() : null;
      if (!field_el) {
        return '';
      }
      return field_el.getAttribute('data-links') || field_el.dataset.links || '';
    }

    /**
     * Sync normalized links JSON into selected field dataset.
     *
     * @param {HTMLElement} panel Inspector panel.
     * @param {Array} links_arr Links array.
     *
     * @return {void}
     */
    static sync_field_links_dataset(panel, links_arr) {
      var field_el = panel ? panel.__accept_terms_field || this.get_selected_field() : null;
      var links_json = '';
      if (!field_el) {
        return;
      }
      try {
        links_json = JSON.stringify(links_arr || array());
        field_el.dataset.links = links_json;
        field_el.setAttribute('data-links', links_json);

        /*
         * If some builder internals cache field data directly on DOM node,
         * keep this cache in sync too.
         */
        if (field_el.__wpbc_bfb_data && 'object' === typeof field_el.__wpbc_bfb_data) {
          field_el.__wpbc_bfb_data.links = clone_value(links_arr || array());
        }
      } catch (err) {}
    }

    /**
     * Push links directly into field structure and dataset.
     *
     * @param {HTMLElement} panel Inspector panel.
     * @param {Array} links_arr Links array.
     *
     * @return {void}
     */
    static persist_links_to_field(panel, links_arr) {
      var field_el = panel ? panel.__accept_terms_field || this.get_selected_field() : null;
      var normalized_links = this.normalize_links(links_arr, false);
      if (!field_el) {
        return;
      }
      this.sync_field_links_dataset(panel, normalized_links);
      try {
        this.update_structure_prop(field_el, 'links', normalized_links);
        this.dispatch_field_data_changed(field_el, 'links', normalized_links);

        /*
         * Keep possible cached field data objects in sync too.
         */
        if (field_el.__wpbc_bfb_data && 'object' === typeof field_el.__wpbc_bfb_data) {
          field_el.__wpbc_bfb_data.links = clone_value(normalized_links);
        }
        if (field_el._wpbc_bfb_data && 'object' === typeof field_el._wpbc_bfb_data) {
          field_el._wpbc_bfb_data.links = clone_value(normalized_links);
        }
      } catch (err) {}
    }

    /**
     * Read links from hidden state.
     *
     * @param {HTMLElement} panel Inspector panel.
     *
     * @return {Array}
     */
    static read_links_from_state(panel) {
      var state_input = this.get_links_state_input(panel);
      var list_el = this.get_links_list(panel);
      var raw_links = '';
      var live_links = array();
      var is_bootstrapped = this.panel_is_bootstrapped(panel);
      if (!panel) {
        return clone_value(get_default_links());
      }

      /*
       * 1. Runtime cache.
       */
      if (panel.__accept_terms_links_cache && Array.isArray(panel.__accept_terms_links_cache)) {
        return this.normalize_links(panel.__accept_terms_links_cache, false);
      }

      /*
       * 2. After first bootstrap, LIVE DOM rows are the source of truth.
       * If list exists and there are no rows, then links are empty.
       */
      if (list_el && is_bootstrapped) {
        live_links = this.get_live_links_from_dom(panel);
        if (!live_links.length) {
          return array();
        }
        return this.normalize_links(live_links, false);
      }

      /*
       * 3. Hidden state input.
       */
      if (state_input && '' !== String(state_input.value || '').trim()) {
        raw_links = state_input.value;
        return this.normalize_links(raw_links, false);
      }

      /*
       * 4. Field dataset fallback.
       */
      raw_links = this.get_field_links_raw(panel);
      if ('' !== String(raw_links || '').trim()) {
        return this.normalize_links(raw_links, false);
      }

      /*
       * 5. Defaults only on first load.
       */
      return clone_value(get_default_links());
    }

    /**
     * Write links to hidden state.
     *
     * @param {HTMLElement} panel Inspector panel.
     * @param {Array} links_arr Links array.
     *
     * @return {void}
     */
    static write_links_state(panel, links_arr) {
      var state_input = this.get_links_state_input(panel);
      var normalized_links = this.normalize_links(links_arr, false);
      var links_json = '[]';
      if (!state_input) {
        return;
      }
      try {
        links_json = JSON.stringify(normalized_links);
      } catch (err) {
        links_json = '[]';
      }
      state_input.value = links_json;
      state_input.defaultValue = links_json;
      state_input.textContent = links_json;
      panel.__accept_terms_links_cache = clone_value(normalized_links);
      this.persist_links_to_field(panel, normalized_links);
    }

    /**
     * Render one link row.
     *
     * @param {Object} link_obj Link object.
     * @param {number} index Index.
     *
     * @return {string}
     */
    static render_link_row(link_obj, index) {
      var template_fn;
      if (!w.wp || 'function' !== typeof w.wp.template) {
        return '';
      }
      template_fn = w.wp.template('wpbc-bfb-inspector-accept_terms-link-row');
      if ('function' !== typeof template_fn) {
        return '';
      }
      return template_fn(Object.assign({
        index: index
      }, this.normalize_link_def(link_obj, index)));
    }

    /**
     * Render link editor rows.
     *
     * @param {HTMLElement} panel Inspector panel.
     * @param {Array} links_arr Links array.
     *
     * @return {void}
     */
    static render_links_editor(panel, links_arr) {
      var list_el = this.get_links_list(panel);
      var normalized_links = this.normalize_links(links_arr, false);
      var html = '';
      var i;
      if (!list_el) {
        return;
      }
      for (i = 0; i < normalized_links.length; i++) {
        html += this.render_link_row(normalized_links[i], i);
      }
      list_el.innerHTML = html;
    }

    /**
     * Read one link row from DOM.
     *
     * @param {HTMLElement} row_el Row element.
     * @param {number} index Index.
     *
     * @return {Object}
     */
    static read_link_from_row(row_el, index) {
      return this.normalize_link_def({
        key: get_row_value(row_el, '.wpbc_bfb__accept_terms_link_key'),
        text: get_row_value(row_el, '.wpbc_bfb__accept_terms_link_text'),
        link_type: get_row_value(row_el, '.wpbc_bfb__accept_terms_link_type'),
        destination: get_row_value(row_el, '.wpbc_bfb__accept_terms_link_destination'),
        target: get_row_value(row_el, '.wpbc_bfb__accept_terms_link_target'),
        cssclass: get_row_value(row_el, '.wpbc_bfb__accept_terms_link_cssclass')
      }, index);
    }

    /**
     * Collect links from rows.
     *
     * @param {HTMLElement} panel Inspector panel.
     *
     * @return {Array}
     */
    static collect_links_from_dom(panel) {
      var list_el = this.get_links_list(panel);
      var row_list;
      var links_arr = array();
      var i;
      if (!list_el) {
        return array();
      }
      row_list = list_el.querySelectorAll('.wpbc_bfb__accept_terms_link_row');
      for (i = 0; i < row_list.length; i++) {
        links_arr.push(this.read_link_from_row(row_list[i], i));
      }
      return links_arr;
    }

    /**
     * Refresh state from CURRENT rendered link rows.
     * This is the key fix for removing stale helper tokens.
     *
     * @param {HTMLElement} panel Inspector panel.
     *
     * @return {Array}
     */
    static refresh_from_rendered_rows(panel) {
      var live_links = array();
      if (!panel) {
        return live_links;
      }
      live_links = this.normalize_links(this.get_live_links_from_dom(panel), false);
      panel.__accept_terms_links_cache = clone_value(live_links);
      this.write_links_state(panel, live_links);
      this.render_available_tokens(panel, live_links);
      this.render_sentence_status(panel, live_links);
      return live_links;
    }
    static schedule_rows_sync(panel) {
      var self = this;
      if (!panel) {
        return;
      }
      if (panel.__accept_terms_rows_sync_timer) {
        clearTimeout(panel.__accept_terms_rows_sync_timer);
      }
      panel.__accept_terms_rows_sync_timer = setTimeout(function () {
        self.refresh_from_rendered_rows(panel);
      }, 0);
    }

    /**
     * Sync hidden state from DOM.
     *
     * @param {HTMLElement} panel Inspector panel.
     *
     * @return {Array}
     */
    static sync_state_from_dom(panel) {
      return this.refresh_from_rendered_rows(panel);
    }

    /**
     * Render available tokens helper.
     *
     * @param {HTMLElement} panel Inspector panel.
     * @param {Array} links_arr Links array.
     *
     * @return {void}
     */
    static render_available_tokens(panel, links_arr) {
      var box_el = this.get_available_tokens_box(panel);
      var normalized_links = this.normalize_links(links_arr, false);
      var html = '';
      var i;
      if (!box_el) {
        return;
      }
      if (!normalized_links.length) {
        box_el.innerHTML = '';
        return;
      }
      for (i = 0; i < normalized_links.length; i++) {
        if (i > 0) {
          html += ' ';
        }
        html += '<button type="button" class="button button-secondary button-small js-insert-token-from-hint" data-token="' + escape_attr(normalized_links[i].key) + '">{' + escape_html(normalized_links[i].key) + '}</button>';
      }
      box_el.innerHTML = html;
    }

    /**
     * Render sentence token status.
     *
     * @param {HTMLElement} panel Inspector panel.
     * @param {Array} links_arr Links array.
     *
     * @return {void}
     */
    static render_sentence_status(panel, links_arr) {
      var status_el = this.get_status_box(panel);
      var sentence_input = this.get_sentence_input(panel);
      var sentence_value = sentence_input ? String(sentence_input.value || '') : '';
      var sentence_tokens = extract_sentence_tokens(sentence_value);
      var link_map = build_link_map(this.normalize_links(links_arr, false));
      var missing_tokens = array();
      var i;
      var token_key = '';
      if (!status_el) {
        return;
      }
      for (i = 0; i < sentence_tokens.length; i++) {
        token_key = sentence_tokens[i];
        if (!link_map[token_key]) {
          missing_tokens.push(token_key);
        }
      }
      if (missing_tokens.length) {
        status_el.innerHTML = '<span style="color: #b83d3d;"><strong>Missing link definitions:</strong> ' + missing_tokens.map(function (item_key) {
          return '{' + escape_html(item_key) + '}';
        }).join(', ') + '</span>';
      } else {
        status_el.innerHTML = sentence_tokens.length ? 'All sentence tokens are defined.' : 'No tokens used in the sentence.';
      }
    }

    /**
     * Insert token into sentence.
     *
     * @param {HTMLElement} panel Inspector panel.
     * @param {string} token_key Token key.
     *
     * @return {void}
     */
    static insert_token_into_sentence(panel, token_key) {
      var sentence_input = this.get_sentence_input(panel);
      var safe_token_key = to_token_key(token_key);
      var token_text = '';
      if (!sentence_input || !safe_token_key) {
        return;
      }
      token_text = build_token_insert_text(sentence_input, '{' + safe_token_key + '}');
      if ('number' === typeof sentence_input.selectionStart && 'number' === typeof sentence_input.selectionEnd) {
        insert_text_at_cursor(sentence_input, token_text);
      } else {
        sentence_input.value += token_text;
      }
      trigger_input_and_change(sentence_input);
      this.render_sentence_status(panel, this.read_links_from_state(panel));
    }

    /**
     * Re-render links editor.
     * Important: after rows are re-rendered, refresh helper tokens from LIVE rows.
     *
     * @param {HTMLElement} panel Inspector panel.
     * @param {Array} links_arr Links array.
     *
     * @return {Array}
     */
    static rerender_links_editor(panel, links_arr) {
      var next_links = this.normalize_links(links_arr, false);
      panel.__accept_terms_links_cache = clone_value(next_links);
      this.render_links_editor(panel, next_links);
      this.bind_rows_observer(panel);
      this.refresh_from_rendered_rows(panel);
      return next_links;
    }

    /**
     * Add link after current index.
     *
     * @param {Array} source_arr Links array.
     * @param {number} target_index Target index.
     *
     * @return {Array}
     */
    static add_link_after(source_arr, target_index) {
      var result_arr = source_arr.slice(0);
      var insert_index = parseInt(target_index, 10);
      if (isNaN(insert_index)) {
        insert_index = result_arr.length - 1;
      }
      result_arr.splice(insert_index + 1, 0, build_default_link_def(result_arr.length));
      return result_arr;
    }

    /**
     * Duplicate link.
     *
     * @param {Array} source_arr Links array.
     * @param {number} target_index Target index.
     *
     * @return {Array}
     */
    static duplicate_link(source_arr, target_index) {
      var result_arr = source_arr.slice(0);
      var index_num = parseInt(target_index, 10);
      var cloned_link;
      if (isNaN(index_num) || !result_arr[index_num]) {
        return result_arr;
      }
      cloned_link = clone_value(this.normalize_link_def(result_arr[index_num], index_num));
      cloned_link.key = '';
      result_arr.splice(index_num + 1, 0, cloned_link);
      return result_arr;
    }

    /**
     * Remove link.
     *
     * @param {Array} source_arr Links array.
     * @param {number} target_index Target index.
     *
     * @return {Array}
     */
    static remove_link(source_arr, target_index) {
      var result_arr = source_arr.slice(0);
      var index_num = parseInt(target_index, 10);
      if (isNaN(index_num) || !result_arr[index_num]) {
        return result_arr;
      }
      result_arr.splice(index_num, 1);
      return result_arr;
    }
    static bind_rows_observer(panel) {
      var self = this;
      var list_el = this.get_links_list(panel);
      if (!panel || !list_el || 'undefined' === typeof MutationObserver) {
        return;
      }
      if (panel.__accept_terms_rows_observer) {
        panel.__accept_terms_rows_observer.disconnect();
        panel.__accept_terms_rows_observer = null;
      }
      panel.__accept_terms_rows_observer = new MutationObserver(function () {
        self.schedule_live_dom_sync(panel);
      });
      panel.__accept_terms_rows_observer.observe(list_el, {
        childList: true,
        subtree: true
      });
    }

    /**
     * Bootstrap inspector panel.
     *
     * @param {HTMLElement} panel Inspector panel.
     * @param {HTMLElement|null} field_el Field element.
     *
     * @return {void}
     */
    static bootstrap_panel(panel, field_el) {
      var links_arr = array();
      if (!panel) {
        return;
      }
      panel.__accept_terms_field = field_el || panel.__accept_terms_field || this.get_selected_field();
      if (!this.is_accept_terms_panel(panel)) {
        return;
      }

      /*
       * First bootstrap:
       * read saved/default links, render rows, then mark bootstrapped.
       */
      if (!this.panel_is_bootstrapped(panel)) {
        links_arr = this.read_links_from_state(panel);
        panel.__accept_terms_links_cache = clone_value(links_arr);
        this.render_links_editor(panel, links_arr);
        this.mark_panel_bootstrapped(panel);
        this.bind_rows_observer(panel);
        this.write_links_state(panel, links_arr);
        this.render_available_tokens(panel, links_arr);
        this.render_sentence_status(panel, links_arr);
        return;
      }

      /*
       * After bootstrap:
       * live DOM is the source of truth.
       */
      this.bind_rows_observer(panel);
      this.refresh_from_rendered_rows(panel);
    }

    /**
     * Update field prop in structure.
     *
     * @param {HTMLElement} el Field element.
     * @param {string} key Key.
     * @param {*} value Value.
     *
     * @return {void}
     */
    static update_structure_prop(el, key, value) {
      if (core && core.Structure && 'function' !== typeof core.Structure.update_field_prop) {
        return;
      }
      if (core && core.Structure && 'function' === typeof core.Structure.update_field_prop) {
        core.Structure.update_field_prop(el, key, value);
      }
    }

    /**
     * Dispatch field data changed event.
     *
     * @param {HTMLElement} el Field element.
     * @param {string} key Key.
     * @param {*} value Value.
     *
     * @return {void}
     */
    static dispatch_field_data_changed(el, key, value) {
      var event_obj;
      if (!el || 'function' !== typeof w.CustomEvent) {
        return;
      }
      event_obj = new CustomEvent('wpbc_bfb_field_data_changed', {
        bubbles: true,
        detail: {
          key: key,
          value: value
        }
      });
      el.dispatchEvent(event_obj);
    }

    /**
     * Wire inspector handlers once.
     *
     * @return {void}
     */
    static wire_once_accept_terms() {
      var self = this;
      var inspector_root = null;
      var on_ready_or_render;
      if (this.__accept_terms_wired) {
        return;
      }
      this.__accept_terms_wired = true;
      on_ready_or_render = function (event_obj) {
        var panel = event_obj && event_obj.detail ? event_obj.detail.panel : null;
        var field_el = null;
        if (event_obj && event_obj.detail) {
          field_el = event_obj.detail.field || event_obj.detail.el || event_obj.detail.target || null;
        }
        if (panel) {
          self.bootstrap_panel(panel, field_el);
        }
      };
      document.addEventListener('wpbc_bfb_inspector_ready', on_ready_or_render);
      document.addEventListener('wpbc_bfb_inspector_render', on_ready_or_render);
      document.addEventListener('mousedown', function (event_obj) {
        var token_button = event_obj.target ? event_obj.target.closest('.js-insert-token-from-hint') : null;
        var panel = token_button ? token_button.closest('.wpbc_bfb__inspector__body') : null;
        var token_key = '';
        if (!token_button || !panel) {
          return;
        }
        panel.__accept_terms_field = self.get_selected_field();
        if (!self.is_accept_terms_panel(panel)) {
          return;
        }
        event_obj.preventDefault();
        event_obj.stopPropagation();
        token_key = String(token_button.getAttribute('data-token') || '');
        self.insert_token_into_sentence(panel, token_key);
      }, true);
      inspector_root = document.getElementById('wpbc_bfb__inspector');
      if (!inspector_root) {
        return;
      }
      inspector_root.addEventListener('click', function (event_obj) {
        var panel = event_obj.target ? event_obj.target.closest('.wpbc_bfb__inspector__body') : null;
        var row_el = null;
        var row_index = -1;
        var action_name = '';
        var links_arr = array();
        if (!panel) {
          return;
        }
        panel.__accept_terms_field = self.get_selected_field();
        if (!self.is_accept_terms_panel(panel)) {
          return;
        }
        if (event_obj.target.closest('.js-insert-token-from-hint')) {
          event_obj.preventDefault();
          return;
        }
        if (event_obj.target.closest('.js-add-link-definition')) {
          links_arr = self.collect_links_from_dom(panel);
          links_arr = self.add_link_after(links_arr, links_arr.length - 1);
          self.rerender_links_editor(panel, links_arr);
          return;
        }
        if (event_obj.target.closest('.js-link-row-action')) {
          event_obj.preventDefault();
          row_el = event_obj.target.closest('.wpbc_bfb__accept_terms_link_row');
          if (!row_el) {
            return;
          }
          row_index = parseInt(row_el.getAttribute('data-index') || '-1', 10);
          action_name = String(event_obj.target.closest('.js-link-row-action').getAttribute('data-action') || '');
          links_arr = self.collect_links_from_dom(panel);
          if ('add_after' === action_name) {
            self.rerender_links_editor(panel, self.add_link_after(links_arr, row_index));
            self.schedule_rows_sync(panel);
            return;
          }
          if ('duplicate' === action_name) {
            self.rerender_links_editor(panel, self.duplicate_link(links_arr, row_index));
            self.schedule_rows_sync(panel);
            return;
          }
          if ('remove' === action_name) {
            self.rerender_links_editor(panel, self.remove_link(links_arr, row_index));
            self.schedule_rows_sync(panel);
            return;
          }
        }
      }, true);
      document.addEventListener('click', function (event_obj) {
        var action_el = event_obj.target ? event_obj.target.closest('.js-link-row-action, .js-add-link-definition') : null;
        var panel = action_el ? action_el.closest('.wpbc_bfb__inspector__body') : null;
        if (!action_el || !panel) {
          return;
        }
        panel.__accept_terms_field = self.get_selected_field();
        if (!self.is_accept_terms_panel(panel)) {
          return;
        }

        /*
         * Run after generic options-editor handlers finish.
         */
        self.schedule_live_dom_sync(panel);
      }, true);
      inspector_root.addEventListener('input', function (event_obj) {
        var panel = event_obj.target ? event_obj.target.closest('.wpbc_bfb__inspector__body') : null;
        var links_arr = array();
        var row_el = null;
        var token_key_el = null;
        if (!panel) {
          return;
        }
        panel.__accept_terms_field = self.get_selected_field();
        if (!self.is_accept_terms_panel(panel)) {
          return;
        }
        if (event_obj.target.matches('.inspector__textarea[data-inspector-key="sentence"]')) {
          self.render_sentence_status(panel, self.read_links_from_state(panel));
          return;
        }
        row_el = event_obj.target.closest('.wpbc_bfb__accept_terms_link_row');
        if (row_el) {
          token_key_el = row_el.querySelector('.wpbc_bfb__accept_terms_link_key');
          if (token_key_el && event_obj.target === token_key_el) {
            sanitize_token_key_input(token_key_el);
          }
          links_arr = self.sync_state_from_dom(panel);
          self.render_available_tokens(panel, links_arr);
          self.render_sentence_status(panel, links_arr);
        }
      }, true);
      inspector_root.addEventListener('change', function (event_obj) {
        var panel = event_obj.target ? event_obj.target.closest('.wpbc_bfb__inspector__body') : null;
        var links_arr = array();
        var row_el = null;
        var token_key_el = null;
        if (!panel) {
          return;
        }
        panel.__accept_terms_field = self.get_selected_field();
        if (!self.is_accept_terms_panel(panel)) {
          return;
        }
        if (event_obj.target.matches('.inspector__textarea[data-inspector-key="sentence"]')) {
          self.render_sentence_status(panel, self.read_links_from_state(panel));
          return;
        }
        if (event_obj.target.matches('.inspector__checkbox[data-inspector-key="required"]')) {
          event_obj.target.setAttribute('aria-checked', event_obj.target.checked ? 'true' : 'false');
          return;
        }
        row_el = event_obj.target.closest('.wpbc_bfb__accept_terms_link_row');
        if (row_el) {
          token_key_el = row_el.querySelector('.wpbc_bfb__accept_terms_link_key');
          if (token_key_el) {
            sanitize_token_key_input(token_key_el);
          }
          links_arr = self.collect_links_from_dom(panel);
          self.rerender_links_editor(panel, links_arr);
        }
      }, true);
      document.addEventListener('wpbc_bfb_inspector_render', function (event_obj) {
        var panel = event_obj && event_obj.detail ? event_obj.detail.panel : null;
        var field_el = event_obj && event_obj.detail ? event_obj.detail.field || event_obj.detail.el || null : null;
        if (panel && field_el) {
          self.bootstrap_panel(panel, field_el);
        }
      });
      setTimeout(function () {
        var panel = document.querySelector('#wpbc_bfb__inspector .wpbc_bfb__inspector__body');
        if (panel) {
          self.bootstrap_panel(panel, self.get_selected_field());
        }
      }, 0);
    }
    static panel_is_bootstrapped(panel) {
      return !!(panel && '1' === String(panel.getAttribute('data-wpbc-accept-terms-bootstrapped') || ''));
    }
    static mark_panel_bootstrapped(panel) {
      if (!panel) {
        return;
      }
      panel.setAttribute('data-wpbc-accept-terms-bootstrapped', '1');
    }
    static get_live_links_from_dom(panel) {
      var list_el = this.get_links_list(panel);
      var row_list = null;
      var links_arr = array();
      if (!list_el) {
        return links_arr;
      }
      row_list = list_el.querySelectorAll('.wpbc_bfb__accept_terms_link_row');
      if (!row_list.length) {
        return links_arr;
      }
      return this.collect_links_from_dom(panel);
    }
    static schedule_live_dom_sync(panel) {
      var self = this;
      if (!panel) {
        return;
      }
      if (panel.__accept_terms_live_dom_sync_timer) {
        clearTimeout(panel.__accept_terms_live_dom_sync_timer);
      }
      panel.__accept_terms_live_dom_sync_timer = setTimeout(function () {
        self.refresh_from_rendered_rows(panel);
      }, 0);
    }
  }
  try {
    registry.register('accept_terms', WPBC_BFB_Field_Accept_Terms);
    w.WPBC_BFB_Field_Accept_Terms = WPBC_BFB_Field_Accept_Terms;
    WPBC_BFB_Field_Accept_Terms.wire_once_accept_terms();
  } catch (err) {
    if (w._wpbc && w._wpbc.dev && 'function' === typeof w._wpbc.dev.error) {
      w._wpbc.dev.error('WPBC_BFB_Field_Accept_Terms.register', err);
    }
  }
  function register_accept_terms_booking_form_exporter() {
    var exporter = w.WPBC_BFB_Exporter || null;
    if (!exporter || 'function' !== typeof exporter.register) {
      return;
    }
    if ('function' === typeof exporter.has_exporter && exporter.has_exporter('accept_terms')) {
      return;
    }
    exporter.register('accept_terms', function (field, emit, extras) {
      var cfg = extras && extras.cfg ? extras.cfg : {};
      var ctx = extras && extras.ctx ? extras.ctx : {};
      var normalized_field = WPBC_BFB_Field_Accept_Terms.normalize_data(field);
      var field_name = exporter.compute_name('accept_terms', normalized_field);
      var field_title = String(normalized_field.title || '').trim();
      var checkbox_text = String(normalized_field.checkbox_text || 'I accept').trim();
      var id_option = exporter.id_option(normalized_field, ctx);
      var class_options = exporter.class_options(normalized_field);
      var sentence_html = build_sentence_export_html(normalized_field.sentence, normalized_field.links);
      var req_mark = normalized_field.required ? '*' : '';
      var shortcode_body = '';
      shortcode_body = '[checkbox' + req_mark + ' ' + field_name + id_option + class_options + ' "' + escape_for_shortcode(checkbox_text) + '"]';
      if (field_title && false !== cfg.addLabels) {
        emit('<l>' + escape_html(field_title) + req_mark + '</l>');
        emit('<br>');
      }
      emit('<p class="wpbc_row_inline wpdev-form-control-wrap ">');
      emit('<l class="wpbc_inline_checkbox">' + shortcode_body + (sentence_html ? ' ' + sentence_html : '') + '</l>');
      emit('</p>');
    });
  }
  if (w.WPBC_BFB_Exporter && 'function' === typeof w.WPBC_BFB_Exporter.register) {
    register_accept_terms_booking_form_exporter();
  } else {
    document.addEventListener('wpbc:bfb:exporter-ready', register_accept_terms_booking_form_exporter, {
      once: true
    });
  }
  function register_accept_terms_booking_data_exporter() {
    var content_exporter = w.WPBC_BFB_ContentExporter || null;
    if (!content_exporter || 'function' !== typeof content_exporter.register) {
      return;
    }
    if ('function' === typeof content_exporter.has_exporter && content_exporter.has_exporter('accept_terms')) {
      return;
    }
    content_exporter.register('accept_terms', function (field, emit, extras) {
      var cfg = extras && extras.cfg ? extras.cfg : {};
      var exporter = w.WPBC_BFB_Exporter || null;
      var normalized_field = WPBC_BFB_Field_Accept_Terms.normalize_data(field);
      var field_name = '';
      var label_text = '';
      if (!exporter || 'function' !== typeof exporter.compute_name) {
        return;
      }
      field_name = exporter.compute_name('accept_terms', normalized_field);
      if (!field_name) {
        return;
      }
      label_text = String(normalized_field.title || '').trim();
      if (!label_text) {
        label_text = 'Accept Terms';
      }
      content_exporter.emit_line_bold_field(emit, label_text, field_name, cfg);
    });
  }
  if (w.WPBC_BFB_ContentExporter && 'function' === typeof w.WPBC_BFB_ContentExporter.register) {
    register_accept_terms_booking_data_exporter();
  } else {
    document.addEventListener('wpbc:bfb:content-exporter-ready', register_accept_terms_booking_data_exporter, {
      once: true
    });
  }
  function array() {
    return [];
  }
  function has_own_prop(source_obj, prop_name) {
    return !!(source_obj && Object.prototype.hasOwnProperty.call(source_obj, prop_name));
  }
  function to_bool(value, default_value) {
    if (undefined === value || null === value || '' === String(value)) {
      return !!default_value;
    }
    return true === value || 'true' === value || 1 === value || '1' === value;
  }
  function get_default_links() {
    return [{
      key: 'terms',
      text: 'terms',
      link_type: 'url',
      destination: 'https://server.com/terms/',
      target: '_blank',
      cssclass: ''
    }, {
      key: 'conditions',
      text: 'conditions',
      link_type: 'url',
      destination: 'https://server.com/conditions/',
      target: '_blank',
      cssclass: ''
    }];
  }
  function build_default_links_map() {
    var defaults_arr = get_default_links();
    var map_obj = {};
    var i;
    for (i = 0; i < defaults_arr.length; i++) {
      map_obj[String(defaults_arr[i].key)] = clone_value(defaults_arr[i]);
    }
    return map_obj;
  }
  function humanize_token_text(token_key) {
    return String(token_key || '').replace(/_/g, ' ');
  }
  function build_link_def_from_token(token_key) {
    var defaults_map = build_default_links_map();
    if (defaults_map[token_key]) {
      return clone_value(defaults_map[token_key]);
    }
    return {
      key: token_key,
      text: humanize_token_text(token_key),
      link_type: 'url',
      destination: '',
      target: '_blank',
      cssclass: ''
    };
  }
  function build_default_link_def(index) {
    var safe_index = 'number' === typeof index && index >= 0 ? index + 1 : 1;
    return {
      key: 'link_' + String(safe_index),
      text: 'Link ' + String(safe_index),
      link_type: 'url',
      destination: '',
      target: '_blank',
      cssclass: ''
    };
  }
  function normalize_link_def_item(raw_link, index) {
    var link_obj = raw_link && 'object' === typeof raw_link ? raw_link : {};
    var safe_index = 'number' === typeof index && index >= 0 ? index : 0;
    var safe_key = to_token_key(link_obj.key || '');
    var fallback_text = String(link_obj.text || '').trim();
    if (!safe_key && fallback_text) {
      safe_key = to_token_key(fallback_text);
    }
    if (!safe_key) {
      safe_key = 'link_' + String(safe_index + 1);
    }
    return {
      key: safe_key,
      text: fallback_text || humanize_token_text(safe_key),
      link_type: normalize_link_type(link_obj.link_type || 'url'),
      destination: String(link_obj.destination || ''),
      target: normalize_target(link_obj.target || '_blank'),
      cssclass: String(link_obj.cssclass || '')
    };
  }
  function normalize_links_collection(raw_links, use_defaults) {
    var links_arr = array();
    var parsed_links = raw_links;
    var key;
    var i;
    if ('string' === typeof parsed_links) {
      parsed_links = safe_json_parse(parsed_links, array());
    }
    if (Array.isArray(parsed_links)) {
      for (i = 0; i < parsed_links.length; i++) {
        links_arr.push(normalize_link_def_item(parsed_links[i], i));
      }
    } else if (parsed_links && 'object' === typeof parsed_links) {
      i = 0;
      for (key in parsed_links) {
        if (Object.prototype.hasOwnProperty.call(parsed_links, key)) {
          links_arr.push(normalize_link_def_item(parsed_links[key], i));
          i++;
        }
      }
    }
    if (!links_arr.length && false !== use_defaults) {
      links_arr = clone_value(get_default_links());
    }
    return ensure_unique_link_keys(links_arr);
  }
  function clone_value(source_value) {
    try {
      return JSON.parse(JSON.stringify(source_value));
    } catch (err) {
      return source_value;
    }
  }
  function safe_json_parse(json_string, fallback_value) {
    try {
      return JSON.parse(String(json_string || ''));
    } catch (err) {
      return fallback_value;
    }
  }
  function normalize_target(raw_target) {
    return '_self' === String(raw_target || '') ? '_self' : '_blank';
  }
  function normalize_link_type(raw_type) {
    var safe_type = String(raw_type || 'url');
    if ('popup' === safe_type || 'anchor' === safe_type) {
      return safe_type;
    }
    return 'url';
  }
  function to_token_key(raw_value) {
    var safe_value = String(raw_value || '').toLowerCase();
    safe_value = safe_value.replace(/[\s\-]+/g, '_');
    safe_value = safe_value.replace(/[^a-z0-9_]/g, '');
    safe_value = safe_value.replace(/_+/g, '_');
    safe_value = safe_value.replace(/^_+|_+$/g, '');
    if (safe_value && /^[0-9]/.test(safe_value)) {
      safe_value = 'token_' + safe_value;
    }
    return safe_value;
  }
  function sanitize_token_key_input(input_el) {
    var safe_value = to_token_key(input_el ? input_el.value : '');
    if (!input_el) {
      return '';
    }
    if (input_el.value !== safe_value) {
      input_el.value = safe_value;
    }
    return safe_value;
  }
  function ensure_unique_link_keys(links_arr) {
    var used_map = {};
    var result_arr = [];
    var i;
    var link_obj;
    var base_key = '';
    var unique_key = '';
    var suffix_num = 2;
    for (i = 0; i < links_arr.length; i++) {
      link_obj = clone_value(links_arr[i]);
      base_key = to_token_key(link_obj.key || '') || 'link_' + String(i + 1);
      unique_key = base_key;
      suffix_num = 2;
      while (used_map[unique_key]) {
        unique_key = base_key + '_' + String(suffix_num);
        suffix_num++;
      }
      link_obj.key = unique_key;
      used_map[unique_key] = true;
      result_arr.push(link_obj);
    }
    return result_arr;
  }
  function build_link_map(links_arr) {
    var map_obj = {};
    var i;
    var link_obj;
    for (i = 0; i < links_arr.length; i++) {
      link_obj = links_arr[i];
      if (link_obj && link_obj.key) {
        map_obj[String(link_obj.key)] = link_obj;
      }
    }
    return map_obj;
  }
  function extract_sentence_tokens(sentence) {
    var token_regex = /\{([a-zA-Z0-9_]+)\}/g;
    var token_match;
    var tokens_arr = array();
    var token_key = '';
    var used_map = {};
    while (null !== (token_match = token_regex.exec(String(sentence || '')))) {
      token_key = String(token_match[1] || '');
      if (token_key && !used_map[token_key]) {
        used_map[token_key] = true;
        tokens_arr.push(token_key);
      }
    }
    return tokens_arr;
  }
  function escape_html(value) {
    var sanitize = core.WPBC_BFB_Sanitize || {};
    if ('function' === typeof sanitize.escape_html) {
      return sanitize.escape_html(String(value || ''));
    }
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escape_attr(value) {
    return escape_html(value).replace(/"/g, '&quot;');
  }
  function escape_for_shortcode(value) {
    var sanitize = core.WPBC_BFB_Sanitize || {};
    if ('function' === typeof sanitize.escape_for_shortcode) {
      return sanitize.escape_for_shortcode(String(value || ''));
    }
    return String(value || '').replace(/"/g, '\\"');
  }
  function normalize_anchor_href(destination) {
    var safe_destination = String(destination || '').trim();
    if (!safe_destination) {
      return '#';
    }
    if ('#' === safe_destination.charAt(0)) {
      return safe_destination;
    }
    return '#' + safe_destination;
  }
  function build_sentence_export_html(sentence, links_arr) {
    var html = '';
    var last_index = 0;
    var token_regex = /\{([a-zA-Z0-9_]+)\}/g;
    var token_match;
    var token_map = build_link_map(normalize_links_collection(links_arr, false));
    var sentence_string = String(sentence || '');
    var token_key = '';
    var link_obj = null;
    while (null !== (token_match = token_regex.exec(sentence_string))) {
      html += escape_html(sentence_string.substring(last_index, token_match.index));
      token_key = String(token_match[1] || '');
      link_obj = token_map[token_key] || null;
      if (link_obj) {
        html += build_export_link_html(link_obj);
      } else {
        html += '{' + escape_html(token_key) + '}';
      }
      last_index = token_match.index + token_match[0].length;
    }
    html += escape_html(sentence_string.substring(last_index));
    return html;
  }
  function build_export_link_html(link_obj) {
    var safe_text = escape_html(link_obj.text || link_obj.key || '');
    var safe_class = String(link_obj.cssclass || '').trim();
    var html = '';
    if ('popup' === link_obj.link_type) {
      html = '<a href="#"';
      if (safe_class) {
        html += ' class="' + escape_attr(safe_class) + '"';
      }
      if (String(link_obj.destination || '').trim()) {
        html += ' data-popup-id="' + escape_attr(link_obj.destination) + '"';
      }
      html += '>' + safe_text + '</a>';
      return html;
    }
    if ('anchor' === link_obj.link_type) {
      html = '<a href="' + escape_attr(normalize_anchor_href(link_obj.destination)) + '"';
      if (safe_class) {
        html += ' class="' + escape_attr(safe_class) + '"';
      }
      html += '>' + safe_text + '</a>';
      return html;
    }
    html = '<a href="' + escape_attr(link_obj.destination || '#') + '"';
    if (safe_class) {
      html += ' class="' + escape_attr(safe_class) + '"';
    }
    if (String(link_obj.target || '').trim()) {
      html += ' target="' + escape_attr(link_obj.target) + '"';
    }
    if ('_blank' === String(link_obj.target || '')) {
      html += ' rel="noopener noreferrer"';
    }
    html += '>' + safe_text + '</a>';
    return html;
  }
  function trigger_input_and_change(input_el) {
    try {
      input_el.dispatchEvent(new Event('input', {
        bubbles: true
      }));
      input_el.dispatchEvent(new Event('change', {
        bubbles: true
      }));
    } catch (err) {}
  }
  function get_row_value(row_el, selector) {
    var field_el = row_el ? row_el.querySelector(selector) : null;
    return field_el ? String(field_el.value || '') : '';
  }
  function build_token_insert_text(input_el, token_text) {
    var current_value = String(input_el && input_el.value ? input_el.value : '');
    var start_pos = input_el && 'number' === typeof input_el.selectionStart ? input_el.selectionStart : current_value.length;
    var end_pos = input_el && 'number' === typeof input_el.selectionEnd ? input_el.selectionEnd : current_value.length;
    var before_char = start_pos > 0 ? current_value.charAt(start_pos - 1) : '';
    var after_char = end_pos < current_value.length ? current_value.charAt(end_pos) : '';
    var prefix = '';
    var suffix = ' ';
    if (before_char && !/\s/.test(before_char)) {
      prefix = ' ';
    }
    if (after_char && /\s/.test(after_char)) {
      suffix = '';
    }
    return prefix + token_text + suffix;
  }
  function insert_text_at_cursor(input_el, insert_text) {
    var start_pos = input_el.selectionStart;
    var end_pos = input_el.selectionEnd;
    var before_text = String(input_el.value || '').substring(0, start_pos);
    var after_text = String(input_el.value || '').substring(end_pos);
    input_el.value = before_text + insert_text + after_text;
    input_el.selectionStart = input_el.selectionEnd = start_pos + insert_text.length;
    input_el.focus();
  }
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvYWNjZXB0LXRlcm1zL19vdXQvZmllbGQtYWNjZXB0LXRlcm1zLXdwdHBsLmpzIiwibmFtZXMiOlsidyIsImNvcmUiLCJXUEJDX0JGQl9Db3JlIiwicmVnaXN0cnkiLCJXUEJDX0JGQl9GaWVsZF9SZW5kZXJlcl9SZWdpc3RyeSIsInJlZ2lzdGVyIiwiX3dwYmMiLCJkZXYiLCJlcnJvciIsIldQQkNfQkZCX0ZpZWxkX0FjY2VwdF9UZXJtcyIsInRlbXBsYXRlX2lkIiwiZ2V0X2RlZmF1bHRzIiwidHlwZSIsInRpdGxlIiwibmFtZSIsImh0bWxfaWQiLCJyZXF1aXJlZCIsImNzc2NsYXNzIiwiaGVscCIsImNoZWNrYm94X3RleHQiLCJzZW50ZW5jZSIsImxpbmtzIiwiY2xvbmVfdmFsdWUiLCJnZXRfZGVmYXVsdF9saW5rcyIsIm1pbl93aWR0aCIsIm5vcm1hbGl6ZV9saW5rX2RlZiIsInJhd19saW5rIiwiaW5kZXgiLCJub3JtYWxpemVfbGlua19kZWZfaXRlbSIsIm5vcm1hbGl6ZV9saW5rcyIsInJhd19saW5rcyIsInVzZV9kZWZhdWx0cyIsIm5vcm1hbGl6ZV9saW5rc19jb2xsZWN0aW9uIiwibm9ybWFsaXplX2RhdGEiLCJyYXdfZGF0YSIsImRlZmF1bHRzIiwibm9ybWFsaXplZF9kYXRhIiwiT2JqZWN0IiwiYXNzaWduIiwiaGFzX2xpbmtzX3Byb3AiLCJoYXNfb3duX3Byb3AiLCJ0b19ib29sIiwiU3RyaW5nIiwic2VudGVuY2VfcHJldmlld19odG1sIiwiYnVpbGRfc2VudGVuY2VfcHJldmlld19odG1sIiwicmVuZGVyIiwiZWwiLCJjdHgiLCJ0ZW1wbGF0ZV9mbiIsImh0bWwiLCJ3cCIsInRlbXBsYXRlIiwiZXJyIiwiZXJyMiIsImlubmVySFRNTCIsIm9uX2ZpZWxkX2Ryb3AiLCJkYXRhIiwibWV0YSIsImRhdGFzZXQiLCJKU09OIiwic3RyaW5naWZ5IiwidXBkYXRlX3N0cnVjdHVyZV9wcm9wIiwiZGlzcGF0Y2hfZmllbGRfZGF0YV9jaGFuZ2VkIiwibGlua3NfYXJyIiwibGFzdF9pbmRleCIsInRva2VuX21hdGNoIiwidG9rZW5fcmVnZXgiLCJ0b2tlbl9tYXAiLCJidWlsZF9saW5rX21hcCIsInNlbnRlbmNlX3N0cmluZyIsInRva2VuX2tleSIsInRva2VuX2xpbmsiLCJleGVjIiwiZXNjYXBlX2h0bWwiLCJzdWJzdHJpbmciLCJidWlsZF9saW5rX3ByZXZpZXdfaHRtbCIsImxlbmd0aCIsImxpbmtfb2JqIiwic2FmZV90ZXh0IiwidGV4dCIsImtleSIsInNhZmVfY2xhc3MiLCJ0cmltIiwiY2xhc3NfYXR0ciIsImVzY2FwZV9hdHRyIiwibGlua190eXBlIiwiZGVzdGluYXRpb24iLCJub3JtYWxpemVfYW5jaG9yX2hyZWYiLCJ0YXJnZXQiLCJnZXRfc2VsZWN0ZWRfZmllbGQiLCJkb2N1bWVudCIsInF1ZXJ5U2VsZWN0b3IiLCJpc19hY2NlcHRfdGVybXNfcGFuZWwiLCJwYW5lbCIsImZpZWxkX2VsIiwiZmllbGRfdHlwZSIsIl9fYWNjZXB0X3Rlcm1zX2ZpZWxkIiwiZ2V0QXR0cmlidXRlIiwidG9Mb3dlckNhc2UiLCJnZXRfc2VudGVuY2VfaW5wdXQiLCJnZXRfbGlua3Nfc3RhdGVfaW5wdXQiLCJnZXRfbGlua3NfbGlzdCIsImdldF9hdmFpbGFibGVfdG9rZW5zX2JveCIsImdldF9zdGF0dXNfYm94IiwiZ2V0X2ZpZWxkX2xpbmtzX3JhdyIsInN5bmNfZmllbGRfbGlua3NfZGF0YXNldCIsImxpbmtzX2pzb24iLCJhcnJheSIsInNldEF0dHJpYnV0ZSIsIl9fd3BiY19iZmJfZGF0YSIsInBlcnNpc3RfbGlua3NfdG9fZmllbGQiLCJub3JtYWxpemVkX2xpbmtzIiwiX3dwYmNfYmZiX2RhdGEiLCJyZWFkX2xpbmtzX2Zyb21fc3RhdGUiLCJzdGF0ZV9pbnB1dCIsImxpc3RfZWwiLCJsaXZlX2xpbmtzIiwiaXNfYm9vdHN0cmFwcGVkIiwicGFuZWxfaXNfYm9vdHN0cmFwcGVkIiwiX19hY2NlcHRfdGVybXNfbGlua3NfY2FjaGUiLCJBcnJheSIsImlzQXJyYXkiLCJnZXRfbGl2ZV9saW5rc19mcm9tX2RvbSIsInZhbHVlIiwid3JpdGVfbGlua3Nfc3RhdGUiLCJkZWZhdWx0VmFsdWUiLCJ0ZXh0Q29udGVudCIsInJlbmRlcl9saW5rX3JvdyIsInJlbmRlcl9saW5rc19lZGl0b3IiLCJpIiwicmVhZF9saW5rX2Zyb21fcm93Iiwicm93X2VsIiwiZ2V0X3Jvd192YWx1ZSIsImNvbGxlY3RfbGlua3NfZnJvbV9kb20iLCJyb3dfbGlzdCIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJwdXNoIiwicmVmcmVzaF9mcm9tX3JlbmRlcmVkX3Jvd3MiLCJyZW5kZXJfYXZhaWxhYmxlX3Rva2VucyIsInJlbmRlcl9zZW50ZW5jZV9zdGF0dXMiLCJzY2hlZHVsZV9yb3dzX3N5bmMiLCJzZWxmIiwiX19hY2NlcHRfdGVybXNfcm93c19zeW5jX3RpbWVyIiwiY2xlYXJUaW1lb3V0Iiwic2V0VGltZW91dCIsInN5bmNfc3RhdGVfZnJvbV9kb20iLCJib3hfZWwiLCJzdGF0dXNfZWwiLCJzZW50ZW5jZV9pbnB1dCIsInNlbnRlbmNlX3ZhbHVlIiwic2VudGVuY2VfdG9rZW5zIiwiZXh0cmFjdF9zZW50ZW5jZV90b2tlbnMiLCJsaW5rX21hcCIsIm1pc3NpbmdfdG9rZW5zIiwibWFwIiwiaXRlbV9rZXkiLCJqb2luIiwiaW5zZXJ0X3Rva2VuX2ludG9fc2VudGVuY2UiLCJzYWZlX3Rva2VuX2tleSIsInRvX3Rva2VuX2tleSIsInRva2VuX3RleHQiLCJidWlsZF90b2tlbl9pbnNlcnRfdGV4dCIsInNlbGVjdGlvblN0YXJ0Iiwic2VsZWN0aW9uRW5kIiwiaW5zZXJ0X3RleHRfYXRfY3Vyc29yIiwidHJpZ2dlcl9pbnB1dF9hbmRfY2hhbmdlIiwicmVyZW5kZXJfbGlua3NfZWRpdG9yIiwibmV4dF9saW5rcyIsImJpbmRfcm93c19vYnNlcnZlciIsImFkZF9saW5rX2FmdGVyIiwic291cmNlX2FyciIsInRhcmdldF9pbmRleCIsInJlc3VsdF9hcnIiLCJzbGljZSIsImluc2VydF9pbmRleCIsInBhcnNlSW50IiwiaXNOYU4iLCJzcGxpY2UiLCJidWlsZF9kZWZhdWx0X2xpbmtfZGVmIiwiZHVwbGljYXRlX2xpbmsiLCJpbmRleF9udW0iLCJjbG9uZWRfbGluayIsInJlbW92ZV9saW5rIiwiTXV0YXRpb25PYnNlcnZlciIsIl9fYWNjZXB0X3Rlcm1zX3Jvd3Nfb2JzZXJ2ZXIiLCJkaXNjb25uZWN0Iiwic2NoZWR1bGVfbGl2ZV9kb21fc3luYyIsIm9ic2VydmUiLCJjaGlsZExpc3QiLCJzdWJ0cmVlIiwiYm9vdHN0cmFwX3BhbmVsIiwibWFya19wYW5lbF9ib290c3RyYXBwZWQiLCJTdHJ1Y3R1cmUiLCJ1cGRhdGVfZmllbGRfcHJvcCIsImV2ZW50X29iaiIsIkN1c3RvbUV2ZW50IiwiYnViYmxlcyIsImRldGFpbCIsImRpc3BhdGNoRXZlbnQiLCJ3aXJlX29uY2VfYWNjZXB0X3Rlcm1zIiwiaW5zcGVjdG9yX3Jvb3QiLCJvbl9yZWFkeV9vcl9yZW5kZXIiLCJfX2FjY2VwdF90ZXJtc193aXJlZCIsImZpZWxkIiwiYWRkRXZlbnRMaXN0ZW5lciIsInRva2VuX2J1dHRvbiIsImNsb3Nlc3QiLCJwcmV2ZW50RGVmYXVsdCIsInN0b3BQcm9wYWdhdGlvbiIsImdldEVsZW1lbnRCeUlkIiwicm93X2luZGV4IiwiYWN0aW9uX25hbWUiLCJhY3Rpb25fZWwiLCJ0b2tlbl9rZXlfZWwiLCJtYXRjaGVzIiwic2FuaXRpemVfdG9rZW5fa2V5X2lucHV0IiwiY2hlY2tlZCIsIl9fYWNjZXB0X3Rlcm1zX2xpdmVfZG9tX3N5bmNfdGltZXIiLCJyZWdpc3Rlcl9hY2NlcHRfdGVybXNfYm9va2luZ19mb3JtX2V4cG9ydGVyIiwiZXhwb3J0ZXIiLCJXUEJDX0JGQl9FeHBvcnRlciIsImhhc19leHBvcnRlciIsImVtaXQiLCJleHRyYXMiLCJjZmciLCJub3JtYWxpemVkX2ZpZWxkIiwiZmllbGRfbmFtZSIsImNvbXB1dGVfbmFtZSIsImZpZWxkX3RpdGxlIiwiaWRfb3B0aW9uIiwiY2xhc3Nfb3B0aW9ucyIsInNlbnRlbmNlX2h0bWwiLCJidWlsZF9zZW50ZW5jZV9leHBvcnRfaHRtbCIsInJlcV9tYXJrIiwic2hvcnRjb2RlX2JvZHkiLCJlc2NhcGVfZm9yX3Nob3J0Y29kZSIsImFkZExhYmVscyIsIm9uY2UiLCJyZWdpc3Rlcl9hY2NlcHRfdGVybXNfYm9va2luZ19kYXRhX2V4cG9ydGVyIiwiY29udGVudF9leHBvcnRlciIsIldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciIsImxhYmVsX3RleHQiLCJlbWl0X2xpbmVfYm9sZF9maWVsZCIsInNvdXJjZV9vYmoiLCJwcm9wX25hbWUiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJkZWZhdWx0X3ZhbHVlIiwidW5kZWZpbmVkIiwiYnVpbGRfZGVmYXVsdF9saW5rc19tYXAiLCJkZWZhdWx0c19hcnIiLCJtYXBfb2JqIiwiaHVtYW5pemVfdG9rZW5fdGV4dCIsInJlcGxhY2UiLCJidWlsZF9saW5rX2RlZl9mcm9tX3Rva2VuIiwiZGVmYXVsdHNfbWFwIiwic2FmZV9pbmRleCIsInNhZmVfa2V5IiwiZmFsbGJhY2tfdGV4dCIsIm5vcm1hbGl6ZV9saW5rX3R5cGUiLCJub3JtYWxpemVfdGFyZ2V0IiwicGFyc2VkX2xpbmtzIiwic2FmZV9qc29uX3BhcnNlIiwiZW5zdXJlX3VuaXF1ZV9saW5rX2tleXMiLCJzb3VyY2VfdmFsdWUiLCJwYXJzZSIsImpzb25fc3RyaW5nIiwiZmFsbGJhY2tfdmFsdWUiLCJyYXdfdGFyZ2V0IiwicmF3X3R5cGUiLCJzYWZlX3R5cGUiLCJyYXdfdmFsdWUiLCJzYWZlX3ZhbHVlIiwidGVzdCIsImlucHV0X2VsIiwidXNlZF9tYXAiLCJiYXNlX2tleSIsInVuaXF1ZV9rZXkiLCJzdWZmaXhfbnVtIiwidG9rZW5zX2FyciIsInNhbml0aXplIiwiV1BCQ19CRkJfU2FuaXRpemUiLCJzYWZlX2Rlc3RpbmF0aW9uIiwiY2hhckF0IiwiYnVpbGRfZXhwb3J0X2xpbmtfaHRtbCIsIkV2ZW50Iiwic2VsZWN0b3IiLCJjdXJyZW50X3ZhbHVlIiwic3RhcnRfcG9zIiwiZW5kX3BvcyIsImJlZm9yZV9jaGFyIiwiYWZ0ZXJfY2hhciIsInByZWZpeCIsInN1ZmZpeCIsImluc2VydF90ZXh0IiwiYmVmb3JlX3RleHQiLCJhZnRlcl90ZXh0IiwiZm9jdXMiLCJ3aW5kb3ciXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9maWVsZC1wYWNrcy9hY2NlcHQtdGVybXMvX3NyYy9maWVsZC1hY2NlcHQtdGVybXMtd3B0cGwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIFdQQkMgQkZCOiBGaWVsZCBSZW5kZXJlciBmb3IgXCJhY2NlcHRfdGVybXNcIlxyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqIFN0cmF0ZWd5OlxyXG4gKiAtIENoZWNrYm94IHRleHQ6IFwiSSBhY2NlcHRcIlxyXG4gKiAtIFNlbnRlbmNlOiBcInRoZSB7dGVybXN9IGFuZCB7Y29uZGl0aW9uc31cIlxyXG4gKiAtIExpbmsgZGVmaW5pdGlvbnM6XHJcbiAqICAgLSBrZXlcclxuICogICAtIHRleHRcclxuICogICAtIHR5cGU6IHVybCB8IHBvcHVwIHwgYW5jaG9yICAoIFBvcHVwIGZ1bmN0aW9uYWxpdHkgZXhpc3RzLCBidXQgbm90IGltcGxlbWVudGVkIHlldCBpbiBvcHRpb25zLiBJdCBpcyBmb3IgZnV0dXJlXHJcbiAqIHVwZGF0ZXMuKVxyXG4gKiAgIC0gZGVzdGluYXRpb25cclxuICpcclxuICogRmlsZTogLi4vaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvYWNjZXB0LXRlcm1zL19vdXQvZmllbGQtYWNjZXB0LXRlcm1zLXdwdHBsLmpzXHJcbiAqXHJcbiAqIEBzaW5jZSAgICAxMS4wLjBcclxuICogQG1vZGlmaWVkIDIwMjYtMDQtMDVcclxuICogQHZlcnNpb24gIDEuMC4zXHJcbiAqL1xyXG4oZnVuY3Rpb24gKCB3ICkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0dmFyIGNvcmUgICAgID0gdy5XUEJDX0JGQl9Db3JlIHx8IHt9O1xyXG5cdHZhciByZWdpc3RyeSA9IGNvcmUuV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnkgfHwgbnVsbDtcclxuXHJcblx0aWYgKCAhIHJlZ2lzdHJ5IHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiByZWdpc3RyeS5yZWdpc3RlciApIHtcclxuXHRcdGlmICggdy5fd3BiYyAmJiB3Ll93cGJjLmRldiAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygdy5fd3BiYy5kZXYuZXJyb3IgKSB7XHJcblx0XHRcdHcuX3dwYmMuZGV2LmVycm9yKCAnV1BCQ19CRkJfRmllbGRfQWNjZXB0X1Rlcm1zJywgJ1JlZ2lzdHJ5IG1pc3NpbmcnICk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHRjbGFzcyBXUEJDX0JGQl9GaWVsZF9BY2NlcHRfVGVybXMge1xyXG5cclxuXHRcdHN0YXRpYyB0ZW1wbGF0ZV9pZCA9ICd3cGJjLWJmYi1maWVsZC1hY2NlcHRfdGVybXMnO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmV0dXJuIGZpZWxkIGRlZmF1bHRzLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4ge09iamVjdH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGdldF9kZWZhdWx0cygpIHtcclxuXHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHR0eXBlICAgICAgICAgIDogJ2FjY2VwdF90ZXJtcycsXHJcblx0XHRcdFx0dGl0bGUgICAgICAgICA6ICcnLFxyXG5cdFx0XHRcdG5hbWUgICAgICAgICAgOiAndGVybXMnLFxyXG5cdFx0XHRcdGh0bWxfaWQgICAgICAgOiAnJyxcclxuXHRcdFx0XHRyZXF1aXJlZCAgICAgIDogdHJ1ZSxcclxuXHRcdFx0XHRjc3NjbGFzcyAgICAgIDogJycsXHJcblx0XHRcdFx0aGVscCAgICAgICAgICA6ICcnLFxyXG5cdFx0XHRcdGNoZWNrYm94X3RleHQgOiAnSSBhY2NlcHQnLFxyXG5cdFx0XHRcdHNlbnRlbmNlICAgICAgOiAndGhlIHt0ZXJtc30gYW5kIHtjb25kaXRpb25zfScsXHJcblx0XHRcdFx0bGlua3MgICAgICAgICA6IGNsb25lX3ZhbHVlKCBnZXRfZGVmYXVsdF9saW5rcygpICksXHJcblx0XHRcdFx0bWluX3dpZHRoICAgICA6ICcyNjBweCdcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE5vcm1hbGl6ZSBhIHNpbmdsZSBsaW5rIGRlZmluaXRpb24uXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHsqfSByYXdfbGluayBSYXcgbGluayBvYmplY3QuXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gaW5kZXggT3B0aW9uYWwgaW5kZXguXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgbm9ybWFsaXplX2xpbmtfZGVmKCByYXdfbGluaywgaW5kZXggKSB7XHJcblx0XHRcdHJldHVybiBub3JtYWxpemVfbGlua19kZWZfaXRlbSggcmF3X2xpbmssIGluZGV4ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBOb3JtYWxpemUgbGlua3MgY29sbGVjdGlvbi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0geyp9IHJhd19saW5rcyBSYXcgbGlua3MgdmFsdWUuXHJcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IHVzZV9kZWZhdWx0cyBXaGV0aGVyIHRvIGZhbGxiYWNrIHRvIGRlZmF1bHQgbGlua3MuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7QXJyYXl9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBub3JtYWxpemVfbGlua3MoIHJhd19saW5rcywgdXNlX2RlZmF1bHRzICkge1xyXG5cdFx0XHRyZXR1cm4gbm9ybWFsaXplX2xpbmtzX2NvbGxlY3Rpb24oIHJhd19saW5rcywgdXNlX2RlZmF1bHRzICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBOb3JtYWxpemUgZmllbGQgZGF0YS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmF3X2RhdGEgUmF3IGZpZWxkIGRhdGEuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgbm9ybWFsaXplX2RhdGEoIHJhd19kYXRhICkge1xyXG5cdFx0XHR2YXIgZGVmYXVsdHMgICAgICAgID0gdGhpcy5nZXRfZGVmYXVsdHMoKTtcclxuXHRcdFx0dmFyIG5vcm1hbGl6ZWRfZGF0YSA9IE9iamVjdC5hc3NpZ24oIHt9LCBkZWZhdWx0cywgcmF3X2RhdGEgfHwge30gKTtcclxuXHRcdFx0dmFyIGhhc19saW5rc19wcm9wICA9IGhhc19vd25fcHJvcCggcmF3X2RhdGEsICdsaW5rcycgKTtcclxuXHJcblx0XHRcdG5vcm1hbGl6ZWRfZGF0YS5yZXF1aXJlZCAgICAgID0gdG9fYm9vbCggbm9ybWFsaXplZF9kYXRhLnJlcXVpcmVkLCBkZWZhdWx0cy5yZXF1aXJlZCApO1xyXG5cdFx0XHRub3JtYWxpemVkX2RhdGEuY2hlY2tib3hfdGV4dCA9IFN0cmluZyggbm9ybWFsaXplZF9kYXRhLmNoZWNrYm94X3RleHQgfHwgZGVmYXVsdHMuY2hlY2tib3hfdGV4dCApO1xyXG5cdFx0XHRub3JtYWxpemVkX2RhdGEuc2VudGVuY2UgICAgICA9IFN0cmluZyggbm9ybWFsaXplZF9kYXRhLnNlbnRlbmNlIHx8IGRlZmF1bHRzLnNlbnRlbmNlICk7XHJcblx0XHRcdG5vcm1hbGl6ZWRfZGF0YS5saW5rcyAgICAgICAgID0gaGFzX2xpbmtzX3Byb3AgPyB0aGlzLm5vcm1hbGl6ZV9saW5rcyggcmF3X2RhdGEubGlua3MsIGZhbHNlICkgOiBjbG9uZV92YWx1ZSggZ2V0X2RlZmF1bHRfbGlua3MoKSApO1xyXG5cdFx0XHRub3JtYWxpemVkX2RhdGEuc2VudGVuY2VfcHJldmlld19odG1sID0gdGhpcy5idWlsZF9zZW50ZW5jZV9wcmV2aWV3X2h0bWwoXHJcblx0XHRcdFx0bm9ybWFsaXplZF9kYXRhLnNlbnRlbmNlLFxyXG5cdFx0XHRcdG5vcm1hbGl6ZWRfZGF0YS5saW5rc1xyXG5cdFx0XHQpO1xyXG5cclxuXHRcdFx0cmV0dXJuIG5vcm1hbGl6ZWRfZGF0YTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlbmRlciBmaWVsZCBwcmV2aWV3LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsIEZpZWxkIGVsZW1lbnQuXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmF3X2RhdGEgRmllbGQgZGF0YS5cclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBjdHggUmVuZGVyIGNvbnRleHQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHJlbmRlciggZWwsIHJhd19kYXRhLCBjdHggKSB7XHJcblx0XHRcdHZhciB0ZW1wbGF0ZV9mbjtcclxuXHRcdFx0dmFyIG5vcm1hbGl6ZWRfZGF0YTtcclxuXHRcdFx0dmFyIGh0bWwgPSAnJztcclxuXHJcblx0XHRcdGlmICggISBlbCB8fCAhIHcud3AgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHcud3AudGVtcGxhdGUgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRub3JtYWxpemVkX2RhdGEgPSB0aGlzLm5vcm1hbGl6ZV9kYXRhKCByYXdfZGF0YSApO1xyXG5cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHR0ZW1wbGF0ZV9mbiA9IHcud3AudGVtcGxhdGUoIHRoaXMudGVtcGxhdGVfaWQgKTtcclxuXHRcdFx0fSBjYXRjaCAoIGVyciApIHtcclxuXHRcdFx0XHRpZiAoIHcuX3dwYmMgJiYgdy5fd3BiYy5kZXYgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHcuX3dwYmMuZGV2LmVycm9yICkge1xyXG5cdFx0XHRcdFx0dy5fd3BiYy5kZXYuZXJyb3IoICdXUEJDX0JGQl9GaWVsZF9BY2NlcHRfVGVybXMudGVtcGxhdGUnLCBlcnIgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoICdmdW5jdGlvbicgIT09IHR5cGVvZiB0ZW1wbGF0ZV9mbiApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0aHRtbCA9IHRlbXBsYXRlX2ZuKCBub3JtYWxpemVkX2RhdGEgKTtcclxuXHRcdFx0fSBjYXRjaCAoIGVycjIgKSB7XHJcblx0XHRcdFx0aWYgKCB3Ll93cGJjICYmIHcuX3dwYmMuZGV2ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3Ll93cGJjLmRldi5lcnJvciApIHtcclxuXHRcdFx0XHRcdHcuX3dwYmMuZGV2LmVycm9yKCAnV1BCQ19CRkJfRmllbGRfQWNjZXB0X1Rlcm1zLnJlbmRlcicsIGVycjIsIG5vcm1hbGl6ZWRfZGF0YSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGVsLmlubmVySFRNTCA9IGh0bWw7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBQcmVwYXJlIGZpZWxkIGRhdGEgYWZ0ZXIgZHJvcC9sb2FkLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhIEZpZWxkIGRhdGEuXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbCBGaWVsZCBlbGVtZW50LlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IG1ldGEgQ29udGV4dC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgb25fZmllbGRfZHJvcCggZGF0YSwgZWwsIG1ldGEgKSB7XHJcblx0XHRcdHZhciBkZWZhdWx0cyAgICAgICA9IHRoaXMuZ2V0X2RlZmF1bHRzKCk7XHJcblx0XHRcdHZhciBoYXNfbGlua3NfcHJvcCA9IGhhc19vd25fcHJvcCggZGF0YSwgJ2xpbmtzJyApO1xyXG5cclxuXHRcdFx0aWYgKCAhIGRhdGEgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRkYXRhLnJlcXVpcmVkICAgICAgPSB0b19ib29sKCBkYXRhLnJlcXVpcmVkLCBkZWZhdWx0cy5yZXF1aXJlZCApO1xyXG5cdFx0XHRkYXRhLmNoZWNrYm94X3RleHQgPSBTdHJpbmcoIGRhdGEuY2hlY2tib3hfdGV4dCB8fCBkZWZhdWx0cy5jaGVja2JveF90ZXh0ICk7XHJcblx0XHRcdGRhdGEuc2VudGVuY2UgICAgICA9IFN0cmluZyggZGF0YS5zZW50ZW5jZSB8fCBkZWZhdWx0cy5zZW50ZW5jZSApO1xyXG5cdFx0XHRkYXRhLmxpbmtzICAgICAgICAgPSBoYXNfbGlua3NfcHJvcCA/IHRoaXMubm9ybWFsaXplX2xpbmtzKCBkYXRhLmxpbmtzLCBmYWxzZSApIDogY2xvbmVfdmFsdWUoIGdldF9kZWZhdWx0X2xpbmtzKCkgKTtcclxuXHJcblx0XHRcdGlmICggZWwgKSB7XHJcblx0XHRcdFx0ZWwuZGF0YXNldC5yZXF1aXJlZCA9IGRhdGEucmVxdWlyZWQgPyAnMScgOiAnMCc7XHJcblxyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRlbC5kYXRhc2V0LmxpbmtzID0gSlNPTi5zdHJpbmdpZnkoIGRhdGEubGlua3MgKTtcclxuXHJcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZV9zdHJ1Y3R1cmVfcHJvcCggZWwsICdyZXF1aXJlZCcsIGRhdGEucmVxdWlyZWQgKTtcclxuXHRcdFx0XHRcdHRoaXMudXBkYXRlX3N0cnVjdHVyZV9wcm9wKCBlbCwgJ2NoZWNrYm94X3RleHQnLCBkYXRhLmNoZWNrYm94X3RleHQgKTtcclxuXHRcdFx0XHRcdHRoaXMudXBkYXRlX3N0cnVjdHVyZV9wcm9wKCBlbCwgJ3NlbnRlbmNlJywgZGF0YS5zZW50ZW5jZSApO1xyXG5cdFx0XHRcdFx0dGhpcy51cGRhdGVfc3RydWN0dXJlX3Byb3AoIGVsLCAnbGlua3MnLCBkYXRhLmxpbmtzICk7XHJcblxyXG5cdFx0XHRcdFx0dGhpcy5kaXNwYXRjaF9maWVsZF9kYXRhX2NoYW5nZWQoIGVsLCAncmVxdWlyZWQnLCBkYXRhLnJlcXVpcmVkICk7XHJcblx0XHRcdFx0XHR0aGlzLmRpc3BhdGNoX2ZpZWxkX2RhdGFfY2hhbmdlZCggZWwsICdjaGVja2JveF90ZXh0JywgZGF0YS5jaGVja2JveF90ZXh0ICk7XHJcblx0XHRcdFx0XHR0aGlzLmRpc3BhdGNoX2ZpZWxkX2RhdGFfY2hhbmdlZCggZWwsICdzZW50ZW5jZScsIGRhdGEuc2VudGVuY2UgKTtcclxuXHRcdFx0XHRcdHRoaXMuZGlzcGF0Y2hfZmllbGRfZGF0YV9jaGFuZ2VkKCBlbCwgJ2xpbmtzJywgZGF0YS5saW5rcyApO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBlcnIgKSB7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBCdWlsZCBwcmV2aWV3IEhUTUwgZnJvbSBzZW50ZW5jZSBhbmQgbGluayB0b2tlbnMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHNlbnRlbmNlIFNlbnRlbmNlIHdpdGggdG9rZW5zLlxyXG5cdFx0ICogQHBhcmFtIHtBcnJheX0gbGlua3NfYXJyIExpbmtzIGFycmF5LlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGJ1aWxkX3NlbnRlbmNlX3ByZXZpZXdfaHRtbCggc2VudGVuY2UsIGxpbmtzX2FyciApIHtcclxuXHRcdFx0dmFyIGh0bWwgICAgICAgICAgICA9ICcnO1xyXG5cdFx0XHR2YXIgbGFzdF9pbmRleCAgICAgID0gMDtcclxuXHRcdFx0dmFyIHRva2VuX21hdGNoO1xyXG5cdFx0XHR2YXIgdG9rZW5fcmVnZXggICAgID0gL1xceyhbYS16QS1aMC05X10rKVxcfS9nO1xyXG5cdFx0XHR2YXIgdG9rZW5fbWFwICAgICAgID0gYnVpbGRfbGlua19tYXAoIHRoaXMubm9ybWFsaXplX2xpbmtzKCBsaW5rc19hcnIsIGZhbHNlICkgKTtcclxuXHRcdFx0dmFyIHNlbnRlbmNlX3N0cmluZyA9IFN0cmluZyggc2VudGVuY2UgfHwgJycgKTtcclxuXHRcdFx0dmFyIHRva2VuX2tleSAgICAgICA9ICcnO1xyXG5cdFx0XHR2YXIgdG9rZW5fbGluayAgICAgID0gbnVsbDtcclxuXHJcblx0XHRcdGlmICggISBzZW50ZW5jZV9zdHJpbmcgKSB7XHJcblx0XHRcdFx0cmV0dXJuICcnO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR3aGlsZSAoIG51bGwgIT09ICggdG9rZW5fbWF0Y2ggPSB0b2tlbl9yZWdleC5leGVjKCBzZW50ZW5jZV9zdHJpbmcgKSApICkge1xyXG5cdFx0XHRcdGh0bWwgKz0gZXNjYXBlX2h0bWwoIHNlbnRlbmNlX3N0cmluZy5zdWJzdHJpbmcoIGxhc3RfaW5kZXgsIHRva2VuX21hdGNoLmluZGV4ICkgKTtcclxuXHJcblx0XHRcdFx0dG9rZW5fa2V5ICA9IFN0cmluZyggdG9rZW5fbWF0Y2hbIDEgXSB8fCAnJyApO1xyXG5cdFx0XHRcdHRva2VuX2xpbmsgPSB0b2tlbl9tYXBbIHRva2VuX2tleSBdIHx8IG51bGw7XHJcblxyXG5cdFx0XHRcdGlmICggdG9rZW5fbGluayApIHtcclxuXHRcdFx0XHRcdGh0bWwgKz0gdGhpcy5idWlsZF9saW5rX3ByZXZpZXdfaHRtbCggdG9rZW5fbGluayApO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRodG1sICs9ICc8c3BhbiBjbGFzcz1cIndwYmNfYmZiX19hY2NlcHRfdGVybXNfbWlzc2luZ190b2tlblwiPnsnICsgZXNjYXBlX2h0bWwoIHRva2VuX2tleSApICsgJ308L3NwYW4+JztcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGxhc3RfaW5kZXggPSB0b2tlbl9tYXRjaC5pbmRleCArIHRva2VuX21hdGNoWyAwIF0ubGVuZ3RoO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRodG1sICs9IGVzY2FwZV9odG1sKCBzZW50ZW5jZV9zdHJpbmcuc3Vic3RyaW5nKCBsYXN0X2luZGV4ICkgKTtcclxuXHJcblx0XHRcdHJldHVybiBodG1sID8gJyAnICsgaHRtbCA6ICcnO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQnVpbGQgcHJldmlldyBIVE1MIGZvciBvbmUgbGluayBkZWZpbml0aW9uLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBsaW5rX29iaiBMaW5rIGRlZmluaXRpb24uXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgYnVpbGRfbGlua19wcmV2aWV3X2h0bWwoIGxpbmtfb2JqICkge1xyXG5cdFx0XHR2YXIgc2FmZV90ZXh0ICA9IGVzY2FwZV9odG1sKCBsaW5rX29iai50ZXh0IHx8IGxpbmtfb2JqLmtleSB8fCAnJyApO1xyXG5cdFx0XHR2YXIgc2FmZV9jbGFzcyA9IFN0cmluZyggbGlua19vYmouY3NzY2xhc3MgfHwgJycgKS50cmltKCk7XHJcblx0XHRcdHZhciBjbGFzc19hdHRyID0gJ3dwYmNfYmZiX19hY2NlcHRfdGVybXNfbGluayc7XHJcblxyXG5cdFx0XHRpZiAoIHNhZmVfY2xhc3MgKSB7XHJcblx0XHRcdFx0Y2xhc3NfYXR0ciArPSAnICcgKyBlc2NhcGVfYXR0ciggc2FmZV9jbGFzcyApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoICdwb3B1cCcgPT09IGxpbmtfb2JqLmxpbmtfdHlwZSApIHtcclxuXHRcdFx0XHRyZXR1cm4gJzxhIGhyZWY9XCIjXCIgY2xhc3M9XCInICsgY2xhc3NfYXR0ciArICdcIiBkYXRhLXBvcHVwLWlkPVwiJyArIGVzY2FwZV9hdHRyKCBsaW5rX29iai5kZXN0aW5hdGlvbiApICsgJ1wiIG9uY2xpY2s9XCJyZXR1cm4gZmFsc2U7XCI+JyArIHNhZmVfdGV4dCArICc8L2E+JztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCAnYW5jaG9yJyA9PT0gbGlua19vYmoubGlua190eXBlICkge1xyXG5cdFx0XHRcdHJldHVybiAnPGEgaHJlZj1cIicgKyBlc2NhcGVfYXR0ciggbm9ybWFsaXplX2FuY2hvcl9ocmVmKCBsaW5rX29iai5kZXN0aW5hdGlvbiApICkgKyAnXCIgY2xhc3M9XCInICsgY2xhc3NfYXR0ciArICdcIiBvbmNsaWNrPVwicmV0dXJuIGZhbHNlO1wiPicgKyBzYWZlX3RleHQgKyAnPC9hPic7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiAnPGEgaHJlZj1cIicgKyBlc2NhcGVfYXR0ciggbGlua19vYmouZGVzdGluYXRpb24gfHwgJyMnICkgKyAnXCIgY2xhc3M9XCInICsgY2xhc3NfYXR0ciArICdcIiB0YXJnZXQ9XCInICsgZXNjYXBlX2F0dHIoIGxpbmtfb2JqLnRhcmdldCB8fCAnX2JsYW5rJyApICsgJ1wiJyArICggJ19ibGFuaycgPT09IFN0cmluZyggbGlua19vYmoudGFyZ2V0IHx8ICcnICkgPyAnIHJlbD1cIm5vb3BlbmVyIG5vcmVmZXJyZXJcIicgOiAnJyApICsgJyBvbmNsaWNrPVwicmV0dXJuIGZhbHNlO1wiPicgKyBzYWZlX3RleHQgKyAnPC9hPic7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZXR1cm4gY3VycmVudGx5IHNlbGVjdGVkIGZpZWxkIGVsZW1lbnQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR8bnVsbH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGdldF9zZWxlY3RlZF9maWVsZCgpIHtcclxuXHRcdFx0cmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX2ZpZWxkLmlzLXNlbGVjdGVkLCAud3BiY19iZmJfX2ZpZWxkLS1zZWxlY3RlZCcgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENoZWNrIGlmIGluc3BlY3RvciBwYW5lbCBiZWxvbmdzIHRvIEFjY2VwdCBUZXJtcyBmaWVsZC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwYW5lbCBJbnNwZWN0b3IgcGFuZWwuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGlzX2FjY2VwdF90ZXJtc19wYW5lbCggcGFuZWwgKSB7XHJcblx0XHRcdHZhciBmaWVsZF9lbDtcclxuXHRcdFx0dmFyIGZpZWxkX3R5cGUgPSAnJztcclxuXHJcblx0XHRcdGlmICggISBwYW5lbCApIHtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGZpZWxkX2VsID0gcGFuZWwuX19hY2NlcHRfdGVybXNfZmllbGQgfHwgdGhpcy5nZXRfc2VsZWN0ZWRfZmllbGQoKTtcclxuXHJcblx0XHRcdGlmICggZmllbGRfZWwgKSB7XHJcblx0XHRcdFx0ZmllbGRfdHlwZSA9IFN0cmluZyggZmllbGRfZWwuZGF0YXNldC50eXBlIHx8IGZpZWxkX2VsLmdldEF0dHJpYnV0ZSggJ2RhdGEtdHlwZScgKSB8fCAnJyApLnRvTG93ZXJDYXNlKCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggJ2FjY2VwdF90ZXJtcycgPT09IGZpZWxkX3R5cGUgKSB7XHJcblx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiAhISBwYW5lbC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1iZmItYWNjZXB0LXRlcm1zLXBhbmVsPVwiMVwiXScgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEdldCBzZW50ZW5jZSBpbnB1dC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwYW5lbCBJbnNwZWN0b3IgcGFuZWwuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR8bnVsbH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGdldF9zZW50ZW5jZV9pbnB1dCggcGFuZWwgKSB7XHJcblx0XHRcdHJldHVybiBwYW5lbCA/IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoICcuaW5zcGVjdG9yX190ZXh0YXJlYVtkYXRhLWluc3BlY3Rvci1rZXk9XCJzZW50ZW5jZVwiXScgKSA6IG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBHZXQgaGlkZGVuIGxpbmtzIHN0YXRlIGlucHV0LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHBhbmVsIEluc3BlY3RvciBwYW5lbC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZ2V0X2xpbmtzX3N0YXRlX2lucHV0KCBwYW5lbCApIHtcclxuXHRcdFx0cmV0dXJuIHBhbmVsID8gcGFuZWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fYWNjZXB0X3Rlcm1zX2xpbmtzX3N0YXRlW2RhdGEtaW5zcGVjdG9yLWtleT1cImxpbmtzXCJdJyApIDogbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEdldCBsaW5rcyBsaXN0IGNvbnRhaW5lci5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwYW5lbCBJbnNwZWN0b3IgcGFuZWwuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR8bnVsbH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGdldF9saW5rc19saXN0KCBwYW5lbCApIHtcclxuXHRcdFx0cmV0dXJuIHBhbmVsID8gcGFuZWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fYWNjZXB0X3Rlcm1zX2xpbmtzX2xpc3QnICkgOiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogR2V0IGF2YWlsYWJsZSB0b2tlbnMgY29udGFpbmVyLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHBhbmVsIEluc3BlY3RvciBwYW5lbC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZ2V0X2F2YWlsYWJsZV90b2tlbnNfYm94KCBwYW5lbCApIHtcclxuXHRcdFx0cmV0dXJuIHBhbmVsID8gcGFuZWwucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYmZiLWFjY2VwdC10ZXJtcy1hdmFpbGFibGUtdG9rZW5zPVwiMVwiXScgKSA6IG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBHZXQgc2VudGVuY2Ugc3RhdHVzIGNvbnRhaW5lci5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwYW5lbCBJbnNwZWN0b3IgcGFuZWwuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR8bnVsbH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGdldF9zdGF0dXNfYm94KCBwYW5lbCApIHtcclxuXHRcdFx0cmV0dXJuIHBhbmVsID8gcGFuZWwucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYmZiLWFjY2VwdC10ZXJtcy1zdGF0dXM9XCIxXCJdJyApIDogbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlYWQgcmF3IGxpbmtzIGZyb20gc2VsZWN0ZWQgZmllbGQgZGF0YXNldC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwYW5lbCBJbnNwZWN0b3IgcGFuZWwuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZ2V0X2ZpZWxkX2xpbmtzX3JhdyggcGFuZWwgKSB7XHJcblx0XHRcdHZhciBmaWVsZF9lbCA9IHBhbmVsID8gKCBwYW5lbC5fX2FjY2VwdF90ZXJtc19maWVsZCB8fCB0aGlzLmdldF9zZWxlY3RlZF9maWVsZCgpICkgOiBudWxsO1xyXG5cclxuXHRcdFx0aWYgKCAhIGZpZWxkX2VsICkge1xyXG5cdFx0XHRcdHJldHVybiAnJztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIGZpZWxkX2VsLmdldEF0dHJpYnV0ZSggJ2RhdGEtbGlua3MnICkgfHwgZmllbGRfZWwuZGF0YXNldC5saW5rcyB8fCAnJztcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFN5bmMgbm9ybWFsaXplZCBsaW5rcyBKU09OIGludG8gc2VsZWN0ZWQgZmllbGQgZGF0YXNldC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwYW5lbCBJbnNwZWN0b3IgcGFuZWwuXHJcblx0XHQgKiBAcGFyYW0ge0FycmF5fSBsaW5rc19hcnIgTGlua3MgYXJyYXkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHN5bmNfZmllbGRfbGlua3NfZGF0YXNldChwYW5lbCwgbGlua3NfYXJyKSB7XHJcblx0XHRcdHZhciBmaWVsZF9lbCAgID0gcGFuZWwgPyAocGFuZWwuX19hY2NlcHRfdGVybXNfZmllbGQgfHwgdGhpcy5nZXRfc2VsZWN0ZWRfZmllbGQoKSkgOiBudWxsO1xyXG5cdFx0XHR2YXIgbGlua3NfanNvbiA9ICcnO1xyXG5cclxuXHRcdFx0aWYgKCAhIGZpZWxkX2VsICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRsaW5rc19qc29uID0gSlNPTi5zdHJpbmdpZnkoIGxpbmtzX2FyciB8fCBhcnJheSgpICk7XHJcblxyXG5cdFx0XHRcdGZpZWxkX2VsLmRhdGFzZXQubGlua3MgPSBsaW5rc19qc29uO1xyXG5cdFx0XHRcdGZpZWxkX2VsLnNldEF0dHJpYnV0ZSggJ2RhdGEtbGlua3MnLCBsaW5rc19qc29uICk7XHJcblxyXG5cdFx0XHRcdC8qXHJcblx0XHRcdFx0ICogSWYgc29tZSBidWlsZGVyIGludGVybmFscyBjYWNoZSBmaWVsZCBkYXRhIGRpcmVjdGx5IG9uIERPTSBub2RlLFxyXG5cdFx0XHRcdCAqIGtlZXAgdGhpcyBjYWNoZSBpbiBzeW5jIHRvby5cclxuXHRcdFx0XHQgKi9cclxuXHRcdFx0XHRpZiAoIGZpZWxkX2VsLl9fd3BiY19iZmJfZGF0YSAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIGZpZWxkX2VsLl9fd3BiY19iZmJfZGF0YSApIHtcclxuXHRcdFx0XHRcdGZpZWxkX2VsLl9fd3BiY19iZmJfZGF0YS5saW5rcyA9IGNsb25lX3ZhbHVlKCBsaW5rc19hcnIgfHwgYXJyYXkoKSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBjYXRjaCAoIGVyciApIHtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUHVzaCBsaW5rcyBkaXJlY3RseSBpbnRvIGZpZWxkIHN0cnVjdHVyZSBhbmQgZGF0YXNldC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwYW5lbCBJbnNwZWN0b3IgcGFuZWwuXHJcblx0XHQgKiBAcGFyYW0ge0FycmF5fSBsaW5rc19hcnIgTGlua3MgYXJyYXkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHBlcnNpc3RfbGlua3NfdG9fZmllbGQocGFuZWwsIGxpbmtzX2Fycikge1xyXG5cdFx0XHR2YXIgZmllbGRfZWwgICAgICAgICA9IHBhbmVsID8gKHBhbmVsLl9fYWNjZXB0X3Rlcm1zX2ZpZWxkIHx8IHRoaXMuZ2V0X3NlbGVjdGVkX2ZpZWxkKCkpIDogbnVsbDtcclxuXHRcdFx0dmFyIG5vcm1hbGl6ZWRfbGlua3MgPSB0aGlzLm5vcm1hbGl6ZV9saW5rcyggbGlua3NfYXJyLCBmYWxzZSApO1xyXG5cclxuXHRcdFx0aWYgKCAhIGZpZWxkX2VsICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5zeW5jX2ZpZWxkX2xpbmtzX2RhdGFzZXQoIHBhbmVsLCBub3JtYWxpemVkX2xpbmtzICk7XHJcblxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHRoaXMudXBkYXRlX3N0cnVjdHVyZV9wcm9wKCBmaWVsZF9lbCwgJ2xpbmtzJywgbm9ybWFsaXplZF9saW5rcyApO1xyXG5cdFx0XHRcdHRoaXMuZGlzcGF0Y2hfZmllbGRfZGF0YV9jaGFuZ2VkKCBmaWVsZF9lbCwgJ2xpbmtzJywgbm9ybWFsaXplZF9saW5rcyApO1xyXG5cclxuXHRcdFx0XHQvKlxyXG5cdFx0XHRcdCAqIEtlZXAgcG9zc2libGUgY2FjaGVkIGZpZWxkIGRhdGEgb2JqZWN0cyBpbiBzeW5jIHRvby5cclxuXHRcdFx0XHQgKi9cclxuXHRcdFx0XHRpZiAoIGZpZWxkX2VsLl9fd3BiY19iZmJfZGF0YSAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIGZpZWxkX2VsLl9fd3BiY19iZmJfZGF0YSApIHtcclxuXHRcdFx0XHRcdGZpZWxkX2VsLl9fd3BiY19iZmJfZGF0YS5saW5rcyA9IGNsb25lX3ZhbHVlKCBub3JtYWxpemVkX2xpbmtzICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICggZmllbGRfZWwuX3dwYmNfYmZiX2RhdGEgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBmaWVsZF9lbC5fd3BiY19iZmJfZGF0YSApIHtcclxuXHRcdFx0XHRcdGZpZWxkX2VsLl93cGJjX2JmYl9kYXRhLmxpbmtzID0gY2xvbmVfdmFsdWUoIG5vcm1hbGl6ZWRfbGlua3MgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gY2F0Y2ggKCBlcnIgKSB7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlYWQgbGlua3MgZnJvbSBoaWRkZW4gc3RhdGUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcGFuZWwgSW5zcGVjdG9yIHBhbmVsLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4ge0FycmF5fVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgcmVhZF9saW5rc19mcm9tX3N0YXRlKHBhbmVsKSB7XHJcblx0XHRcdHZhciBzdGF0ZV9pbnB1dCAgICAgPSB0aGlzLmdldF9saW5rc19zdGF0ZV9pbnB1dCggcGFuZWwgKTtcclxuXHRcdFx0dmFyIGxpc3RfZWwgICAgICAgICA9IHRoaXMuZ2V0X2xpbmtzX2xpc3QoIHBhbmVsICk7XHJcblx0XHRcdHZhciByYXdfbGlua3MgICAgICAgPSAnJztcclxuXHRcdFx0dmFyIGxpdmVfbGlua3MgICAgICA9IGFycmF5KCk7XHJcblx0XHRcdHZhciBpc19ib290c3RyYXBwZWQgPSB0aGlzLnBhbmVsX2lzX2Jvb3RzdHJhcHBlZCggcGFuZWwgKTtcclxuXHJcblx0XHRcdGlmICggISBwYW5lbCApIHtcclxuXHRcdFx0XHRyZXR1cm4gY2xvbmVfdmFsdWUoIGdldF9kZWZhdWx0X2xpbmtzKCkgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0LypcclxuXHRcdFx0ICogMS4gUnVudGltZSBjYWNoZS5cclxuXHRcdFx0ICovXHJcblx0XHRcdGlmICggcGFuZWwuX19hY2NlcHRfdGVybXNfbGlua3NfY2FjaGUgJiYgQXJyYXkuaXNBcnJheSggcGFuZWwuX19hY2NlcHRfdGVybXNfbGlua3NfY2FjaGUgKSApIHtcclxuXHRcdFx0XHRyZXR1cm4gdGhpcy5ub3JtYWxpemVfbGlua3MoIHBhbmVsLl9fYWNjZXB0X3Rlcm1zX2xpbmtzX2NhY2hlLCBmYWxzZSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvKlxyXG5cdFx0XHQgKiAyLiBBZnRlciBmaXJzdCBib290c3RyYXAsIExJVkUgRE9NIHJvd3MgYXJlIHRoZSBzb3VyY2Ugb2YgdHJ1dGguXHJcblx0XHRcdCAqIElmIGxpc3QgZXhpc3RzIGFuZCB0aGVyZSBhcmUgbm8gcm93cywgdGhlbiBsaW5rcyBhcmUgZW1wdHkuXHJcblx0XHRcdCAqL1xyXG5cdFx0XHRpZiAoIGxpc3RfZWwgJiYgaXNfYm9vdHN0cmFwcGVkICkge1xyXG5cdFx0XHRcdGxpdmVfbGlua3MgPSB0aGlzLmdldF9saXZlX2xpbmtzX2Zyb21fZG9tKCBwYW5lbCApO1xyXG5cclxuXHRcdFx0XHRpZiAoICEgbGl2ZV9saW5rcy5sZW5ndGggKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gYXJyYXkoKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiB0aGlzLm5vcm1hbGl6ZV9saW5rcyggbGl2ZV9saW5rcywgZmFsc2UgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0LypcclxuXHRcdFx0ICogMy4gSGlkZGVuIHN0YXRlIGlucHV0LlxyXG5cdFx0XHQgKi9cclxuXHRcdFx0aWYgKCBzdGF0ZV9pbnB1dCAmJiAnJyAhPT0gU3RyaW5nKCBzdGF0ZV9pbnB1dC52YWx1ZSB8fCAnJyApLnRyaW0oKSApIHtcclxuXHRcdFx0XHRyYXdfbGlua3MgPSBzdGF0ZV9pbnB1dC52YWx1ZTtcclxuXHRcdFx0XHRyZXR1cm4gdGhpcy5ub3JtYWxpemVfbGlua3MoIHJhd19saW5rcywgZmFsc2UgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0LypcclxuXHRcdFx0ICogNC4gRmllbGQgZGF0YXNldCBmYWxsYmFjay5cclxuXHRcdFx0ICovXHJcblx0XHRcdHJhd19saW5rcyA9IHRoaXMuZ2V0X2ZpZWxkX2xpbmtzX3JhdyggcGFuZWwgKTtcclxuXHRcdFx0aWYgKCAnJyAhPT0gU3RyaW5nKCByYXdfbGlua3MgfHwgJycgKS50cmltKCkgKSB7XHJcblx0XHRcdFx0cmV0dXJuIHRoaXMubm9ybWFsaXplX2xpbmtzKCByYXdfbGlua3MsIGZhbHNlICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8qXHJcblx0XHRcdCAqIDUuIERlZmF1bHRzIG9ubHkgb24gZmlyc3QgbG9hZC5cclxuXHRcdFx0ICovXHJcblx0XHRcdHJldHVybiBjbG9uZV92YWx1ZSggZ2V0X2RlZmF1bHRfbGlua3MoKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogV3JpdGUgbGlua3MgdG8gaGlkZGVuIHN0YXRlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHBhbmVsIEluc3BlY3RvciBwYW5lbC5cclxuXHRcdCAqIEBwYXJhbSB7QXJyYXl9IGxpbmtzX2FyciBMaW5rcyBhcnJheS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgd3JpdGVfbGlua3Nfc3RhdGUocGFuZWwsIGxpbmtzX2Fycikge1xyXG5cdFx0XHR2YXIgc3RhdGVfaW5wdXQgICAgICA9IHRoaXMuZ2V0X2xpbmtzX3N0YXRlX2lucHV0KCBwYW5lbCApO1xyXG5cdFx0XHR2YXIgbm9ybWFsaXplZF9saW5rcyA9IHRoaXMubm9ybWFsaXplX2xpbmtzKCBsaW5rc19hcnIsIGZhbHNlICk7XHJcblx0XHRcdHZhciBsaW5rc19qc29uICAgICAgID0gJ1tdJztcclxuXHJcblx0XHRcdGlmICggISBzdGF0ZV9pbnB1dCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0bGlua3NfanNvbiA9IEpTT04uc3RyaW5naWZ5KCBub3JtYWxpemVkX2xpbmtzICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBlcnIgKSB7XHJcblx0XHRcdFx0bGlua3NfanNvbiA9ICdbXSc7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHN0YXRlX2lucHV0LnZhbHVlICAgICAgICA9IGxpbmtzX2pzb247XHJcblx0XHRcdHN0YXRlX2lucHV0LmRlZmF1bHRWYWx1ZSA9IGxpbmtzX2pzb247XHJcblx0XHRcdHN0YXRlX2lucHV0LnRleHRDb250ZW50ICA9IGxpbmtzX2pzb247XHJcblxyXG5cdFx0XHRwYW5lbC5fX2FjY2VwdF90ZXJtc19saW5rc19jYWNoZSA9IGNsb25lX3ZhbHVlKCBub3JtYWxpemVkX2xpbmtzICk7XHJcblxyXG5cdFx0XHR0aGlzLnBlcnNpc3RfbGlua3NfdG9fZmllbGQoIHBhbmVsLCBub3JtYWxpemVkX2xpbmtzICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZW5kZXIgb25lIGxpbmsgcm93LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBsaW5rX29iaiBMaW5rIG9iamVjdC5cclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCBJbmRleC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyByZW5kZXJfbGlua19yb3coIGxpbmtfb2JqLCBpbmRleCApIHtcclxuXHRcdFx0dmFyIHRlbXBsYXRlX2ZuO1xyXG5cclxuXHRcdFx0aWYgKCAhIHcud3AgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHcud3AudGVtcGxhdGUgKSB7XHJcblx0XHRcdFx0cmV0dXJuICcnO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0ZW1wbGF0ZV9mbiA9IHcud3AudGVtcGxhdGUoICd3cGJjLWJmYi1pbnNwZWN0b3ItYWNjZXB0X3Rlcm1zLWxpbmstcm93JyApO1xyXG5cdFx0XHRpZiAoICdmdW5jdGlvbicgIT09IHR5cGVvZiB0ZW1wbGF0ZV9mbiApIHtcclxuXHRcdFx0XHRyZXR1cm4gJyc7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiB0ZW1wbGF0ZV9mbihcclxuXHRcdFx0XHRPYmplY3QuYXNzaWduKFxyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRpbmRleCA6IGluZGV4XHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0dGhpcy5ub3JtYWxpemVfbGlua19kZWYoIGxpbmtfb2JqLCBpbmRleCApXHJcblx0XHRcdFx0KVxyXG5cdFx0XHQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVuZGVyIGxpbmsgZWRpdG9yIHJvd3MuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcGFuZWwgSW5zcGVjdG9yIHBhbmVsLlxyXG5cdFx0ICogQHBhcmFtIHtBcnJheX0gbGlua3NfYXJyIExpbmtzIGFycmF5LlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyByZW5kZXJfbGlua3NfZWRpdG9yKCBwYW5lbCwgbGlua3NfYXJyICkge1xyXG5cdFx0XHR2YXIgbGlzdF9lbCAgICAgICAgICA9IHRoaXMuZ2V0X2xpbmtzX2xpc3QoIHBhbmVsICk7XHJcblx0XHRcdHZhciBub3JtYWxpemVkX2xpbmtzID0gdGhpcy5ub3JtYWxpemVfbGlua3MoIGxpbmtzX2FyciwgZmFsc2UgKTtcclxuXHRcdFx0dmFyIGh0bWwgPSAnJztcclxuXHRcdFx0dmFyIGk7XHJcblxyXG5cdFx0XHRpZiAoICEgbGlzdF9lbCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbm9ybWFsaXplZF9saW5rcy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0XHRodG1sICs9IHRoaXMucmVuZGVyX2xpbmtfcm93KCBub3JtYWxpemVkX2xpbmtzWyBpIF0sIGkgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bGlzdF9lbC5pbm5lckhUTUwgPSBodG1sO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVhZCBvbmUgbGluayByb3cgZnJvbSBET00uXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm93X2VsIFJvdyBlbGVtZW50LlxyXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IEluZGV4LlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4ge09iamVjdH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHJlYWRfbGlua19mcm9tX3Jvdyggcm93X2VsLCBpbmRleCApIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMubm9ybWFsaXplX2xpbmtfZGVmKFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdGtleSAgICAgICAgIDogZ2V0X3Jvd192YWx1ZSggcm93X2VsLCAnLndwYmNfYmZiX19hY2NlcHRfdGVybXNfbGlua19rZXknICksXHJcblx0XHRcdFx0XHR0ZXh0ICAgICAgICA6IGdldF9yb3dfdmFsdWUoIHJvd19lbCwgJy53cGJjX2JmYl9fYWNjZXB0X3Rlcm1zX2xpbmtfdGV4dCcgKSxcclxuXHRcdFx0XHRcdGxpbmtfdHlwZSAgIDogZ2V0X3Jvd192YWx1ZSggcm93X2VsLCAnLndwYmNfYmZiX19hY2NlcHRfdGVybXNfbGlua190eXBlJyApLFxyXG5cdFx0XHRcdFx0ZGVzdGluYXRpb24gOiBnZXRfcm93X3ZhbHVlKCByb3dfZWwsICcud3BiY19iZmJfX2FjY2VwdF90ZXJtc19saW5rX2Rlc3RpbmF0aW9uJyApLFxyXG5cdFx0XHRcdFx0dGFyZ2V0ICAgICAgOiBnZXRfcm93X3ZhbHVlKCByb3dfZWwsICcud3BiY19iZmJfX2FjY2VwdF90ZXJtc19saW5rX3RhcmdldCcgKSxcclxuXHRcdFx0XHRcdGNzc2NsYXNzICAgIDogZ2V0X3Jvd192YWx1ZSggcm93X2VsLCAnLndwYmNfYmZiX19hY2NlcHRfdGVybXNfbGlua19jc3NjbGFzcycgKVxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0aW5kZXhcclxuXHRcdFx0KTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENvbGxlY3QgbGlua3MgZnJvbSByb3dzLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHBhbmVsIEluc3BlY3RvciBwYW5lbC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHtBcnJheX1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGNvbGxlY3RfbGlua3NfZnJvbV9kb20oIHBhbmVsICkge1xyXG5cdFx0XHR2YXIgbGlzdF9lbCAgID0gdGhpcy5nZXRfbGlua3NfbGlzdCggcGFuZWwgKTtcclxuXHRcdFx0dmFyIHJvd19saXN0O1xyXG5cdFx0XHR2YXIgbGlua3NfYXJyID0gYXJyYXkoKTtcclxuXHRcdFx0dmFyIGk7XHJcblxyXG5cdFx0XHRpZiAoICEgbGlzdF9lbCApIHtcclxuXHRcdFx0XHRyZXR1cm4gYXJyYXkoKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cm93X2xpc3QgPSBsaXN0X2VsLnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2FjY2VwdF90ZXJtc19saW5rX3JvdycgKTtcclxuXHJcblx0XHRcdGZvciAoIGkgPSAwOyBpIDwgcm93X2xpc3QubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0bGlua3NfYXJyLnB1c2goIHRoaXMucmVhZF9saW5rX2Zyb21fcm93KCByb3dfbGlzdFsgaSBdLCBpICkgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIGxpbmtzX2FycjtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlZnJlc2ggc3RhdGUgZnJvbSBDVVJSRU5UIHJlbmRlcmVkIGxpbmsgcm93cy5cclxuXHRcdCAqIFRoaXMgaXMgdGhlIGtleSBmaXggZm9yIHJlbW92aW5nIHN0YWxlIGhlbHBlciB0b2tlbnMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcGFuZWwgSW5zcGVjdG9yIHBhbmVsLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4ge0FycmF5fVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgcmVmcmVzaF9mcm9tX3JlbmRlcmVkX3Jvd3MocGFuZWwpIHtcclxuXHRcdFx0dmFyIGxpdmVfbGlua3MgPSBhcnJheSgpO1xyXG5cclxuXHRcdFx0aWYgKCAhIHBhbmVsICkge1xyXG5cdFx0XHRcdHJldHVybiBsaXZlX2xpbmtzO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRsaXZlX2xpbmtzID0gdGhpcy5ub3JtYWxpemVfbGlua3MoIHRoaXMuZ2V0X2xpdmVfbGlua3NfZnJvbV9kb20oIHBhbmVsICksIGZhbHNlICk7XHJcblxyXG5cdFx0XHRwYW5lbC5fX2FjY2VwdF90ZXJtc19saW5rc19jYWNoZSA9IGNsb25lX3ZhbHVlKCBsaXZlX2xpbmtzICk7XHJcblxyXG5cdFx0XHR0aGlzLndyaXRlX2xpbmtzX3N0YXRlKCBwYW5lbCwgbGl2ZV9saW5rcyApO1xyXG5cdFx0XHR0aGlzLnJlbmRlcl9hdmFpbGFibGVfdG9rZW5zKCBwYW5lbCwgbGl2ZV9saW5rcyApO1xyXG5cdFx0XHR0aGlzLnJlbmRlcl9zZW50ZW5jZV9zdGF0dXMoIHBhbmVsLCBsaXZlX2xpbmtzICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gbGl2ZV9saW5rcztcclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgc2NoZWR1bGVfcm93c19zeW5jKHBhbmVsKSB7XHJcblx0XHRcdHZhciBzZWxmID0gdGhpcztcclxuXHJcblx0XHRcdGlmICggISBwYW5lbCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggcGFuZWwuX19hY2NlcHRfdGVybXNfcm93c19zeW5jX3RpbWVyICkge1xyXG5cdFx0XHRcdGNsZWFyVGltZW91dCggcGFuZWwuX19hY2NlcHRfdGVybXNfcm93c19zeW5jX3RpbWVyICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHBhbmVsLl9fYWNjZXB0X3Rlcm1zX3Jvd3Nfc3luY190aW1lciA9IHNldFRpbWVvdXQoXHJcblx0XHRcdFx0ZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0c2VsZi5yZWZyZXNoX2Zyb21fcmVuZGVyZWRfcm93cyggcGFuZWwgKTtcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdDBcclxuXHRcdFx0KTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFN5bmMgaGlkZGVuIHN0YXRlIGZyb20gRE9NLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHBhbmVsIEluc3BlY3RvciBwYW5lbC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHtBcnJheX1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHN5bmNfc3RhdGVfZnJvbV9kb20oIHBhbmVsICkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5yZWZyZXNoX2Zyb21fcmVuZGVyZWRfcm93cyggcGFuZWwgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlbmRlciBhdmFpbGFibGUgdG9rZW5zIGhlbHBlci5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwYW5lbCBJbnNwZWN0b3IgcGFuZWwuXHJcblx0XHQgKiBAcGFyYW0ge0FycmF5fSBsaW5rc19hcnIgTGlua3MgYXJyYXkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHJlbmRlcl9hdmFpbGFibGVfdG9rZW5zKCBwYW5lbCwgbGlua3NfYXJyICkge1xyXG5cdFx0XHR2YXIgYm94X2VsICAgICAgICAgICA9IHRoaXMuZ2V0X2F2YWlsYWJsZV90b2tlbnNfYm94KCBwYW5lbCApO1xyXG5cdFx0XHR2YXIgbm9ybWFsaXplZF9saW5rcyA9IHRoaXMubm9ybWFsaXplX2xpbmtzKCBsaW5rc19hcnIsIGZhbHNlICk7XHJcblx0XHRcdHZhciBodG1sID0gJyc7XHJcblx0XHRcdHZhciBpO1xyXG5cclxuXHRcdFx0aWYgKCAhIGJveF9lbCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggISBub3JtYWxpemVkX2xpbmtzLmxlbmd0aCApIHtcclxuXHRcdFx0XHRib3hfZWwuaW5uZXJIVE1MID0gJyc7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRmb3IgKCBpID0gMDsgaSA8IG5vcm1hbGl6ZWRfbGlua3MubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0aWYgKCBpID4gMCApIHtcclxuXHRcdFx0XHRcdGh0bWwgKz0gJyAnO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRodG1sICs9ICc8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImJ1dHRvbiBidXR0b24tc2Vjb25kYXJ5IGJ1dHRvbi1zbWFsbCBqcy1pbnNlcnQtdG9rZW4tZnJvbS1oaW50XCIgZGF0YS10b2tlbj1cIicgKyBlc2NhcGVfYXR0ciggbm9ybWFsaXplZF9saW5rc1sgaSBdLmtleSApICsgJ1wiPnsnICsgZXNjYXBlX2h0bWwoIG5vcm1hbGl6ZWRfbGlua3NbIGkgXS5rZXkgKSArICd9PC9idXR0b24+JztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ym94X2VsLmlubmVySFRNTCA9IGh0bWw7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZW5kZXIgc2VudGVuY2UgdG9rZW4gc3RhdHVzLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHBhbmVsIEluc3BlY3RvciBwYW5lbC5cclxuXHRcdCAqIEBwYXJhbSB7QXJyYXl9IGxpbmtzX2FyciBMaW5rcyBhcnJheS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgcmVuZGVyX3NlbnRlbmNlX3N0YXR1cyggcGFuZWwsIGxpbmtzX2FyciApIHtcclxuXHRcdFx0dmFyIHN0YXR1c19lbCAgICAgICA9IHRoaXMuZ2V0X3N0YXR1c19ib3goIHBhbmVsICk7XHJcblx0XHRcdHZhciBzZW50ZW5jZV9pbnB1dCAgPSB0aGlzLmdldF9zZW50ZW5jZV9pbnB1dCggcGFuZWwgKTtcclxuXHRcdFx0dmFyIHNlbnRlbmNlX3ZhbHVlICA9IHNlbnRlbmNlX2lucHV0ID8gU3RyaW5nKCBzZW50ZW5jZV9pbnB1dC52YWx1ZSB8fCAnJyApIDogJyc7XHJcblx0XHRcdHZhciBzZW50ZW5jZV90b2tlbnMgPSBleHRyYWN0X3NlbnRlbmNlX3Rva2Vucyggc2VudGVuY2VfdmFsdWUgKTtcclxuXHRcdFx0dmFyIGxpbmtfbWFwICAgICAgICA9IGJ1aWxkX2xpbmtfbWFwKCB0aGlzLm5vcm1hbGl6ZV9saW5rcyggbGlua3NfYXJyLCBmYWxzZSApICk7XHJcblx0XHRcdHZhciBtaXNzaW5nX3Rva2VucyAgPSBhcnJheSgpO1xyXG5cdFx0XHR2YXIgaTtcclxuXHRcdFx0dmFyIHRva2VuX2tleSA9ICcnO1xyXG5cclxuXHRcdFx0aWYgKCAhIHN0YXR1c19lbCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGZvciAoIGkgPSAwOyBpIDwgc2VudGVuY2VfdG9rZW5zLmxlbmd0aDsgaSsrICkge1xyXG5cdFx0XHRcdHRva2VuX2tleSA9IHNlbnRlbmNlX3Rva2Vuc1sgaSBdO1xyXG5cdFx0XHRcdGlmICggISBsaW5rX21hcFsgdG9rZW5fa2V5IF0gKSB7XHJcblx0XHRcdFx0XHRtaXNzaW5nX3Rva2Vucy5wdXNoKCB0b2tlbl9rZXkgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggbWlzc2luZ190b2tlbnMubGVuZ3RoICkge1xyXG5cdFx0XHRcdHN0YXR1c19lbC5pbm5lckhUTUwgPSAnPHNwYW4gc3R5bGU9XCJjb2xvcjogI2I4M2QzZDtcIj48c3Ryb25nPk1pc3NpbmcgbGluayBkZWZpbml0aW9uczo8L3N0cm9uZz4gJyArIG1pc3NpbmdfdG9rZW5zLm1hcChcclxuXHRcdFx0XHRcdGZ1bmN0aW9uICggaXRlbV9rZXkgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybiAneycgKyBlc2NhcGVfaHRtbCggaXRlbV9rZXkgKSArICd9JztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHQpLmpvaW4oICcsICcgKSArICc8L3NwYW4+JztcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRzdGF0dXNfZWwuaW5uZXJIVE1MID0gc2VudGVuY2VfdG9rZW5zLmxlbmd0aCA/ICdBbGwgc2VudGVuY2UgdG9rZW5zIGFyZSBkZWZpbmVkLicgOiAnTm8gdG9rZW5zIHVzZWQgaW4gdGhlIHNlbnRlbmNlLic7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEluc2VydCB0b2tlbiBpbnRvIHNlbnRlbmNlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHBhbmVsIEluc3BlY3RvciBwYW5lbC5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0b2tlbl9rZXkgVG9rZW4ga2V5LlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBpbnNlcnRfdG9rZW5faW50b19zZW50ZW5jZSggcGFuZWwsIHRva2VuX2tleSApIHtcclxuXHRcdFx0dmFyIHNlbnRlbmNlX2lucHV0ID0gdGhpcy5nZXRfc2VudGVuY2VfaW5wdXQoIHBhbmVsICk7XHJcblx0XHRcdHZhciBzYWZlX3Rva2VuX2tleSA9IHRvX3Rva2VuX2tleSggdG9rZW5fa2V5ICk7XHJcblx0XHRcdHZhciB0b2tlbl90ZXh0ICAgICA9ICcnO1xyXG5cclxuXHRcdFx0aWYgKCAhIHNlbnRlbmNlX2lucHV0IHx8ICEgc2FmZV90b2tlbl9rZXkgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0b2tlbl90ZXh0ID0gYnVpbGRfdG9rZW5faW5zZXJ0X3RleHQoXHJcblx0XHRcdFx0c2VudGVuY2VfaW5wdXQsXHJcblx0XHRcdFx0J3snICsgc2FmZV90b2tlbl9rZXkgKyAnfSdcclxuXHRcdFx0KTtcclxuXHJcblx0XHRcdGlmICggJ251bWJlcicgPT09IHR5cGVvZiBzZW50ZW5jZV9pbnB1dC5zZWxlY3Rpb25TdGFydCAmJiAnbnVtYmVyJyA9PT0gdHlwZW9mIHNlbnRlbmNlX2lucHV0LnNlbGVjdGlvbkVuZCApIHtcclxuXHRcdFx0XHRpbnNlcnRfdGV4dF9hdF9jdXJzb3IoIHNlbnRlbmNlX2lucHV0LCB0b2tlbl90ZXh0ICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0c2VudGVuY2VfaW5wdXQudmFsdWUgKz0gdG9rZW5fdGV4dDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dHJpZ2dlcl9pbnB1dF9hbmRfY2hhbmdlKCBzZW50ZW5jZV9pbnB1dCApO1xyXG5cdFx0XHR0aGlzLnJlbmRlcl9zZW50ZW5jZV9zdGF0dXMoIHBhbmVsLCB0aGlzLnJlYWRfbGlua3NfZnJvbV9zdGF0ZSggcGFuZWwgKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmUtcmVuZGVyIGxpbmtzIGVkaXRvci5cclxuXHRcdCAqIEltcG9ydGFudDogYWZ0ZXIgcm93cyBhcmUgcmUtcmVuZGVyZWQsIHJlZnJlc2ggaGVscGVyIHRva2VucyBmcm9tIExJVkUgcm93cy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwYW5lbCBJbnNwZWN0b3IgcGFuZWwuXHJcblx0XHQgKiBAcGFyYW0ge0FycmF5fSBsaW5rc19hcnIgTGlua3MgYXJyYXkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7QXJyYXl9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyByZXJlbmRlcl9saW5rc19lZGl0b3IocGFuZWwsIGxpbmtzX2Fycikge1xyXG5cdFx0XHR2YXIgbmV4dF9saW5rcyA9IHRoaXMubm9ybWFsaXplX2xpbmtzKCBsaW5rc19hcnIsIGZhbHNlICk7XHJcblxyXG5cdFx0XHRwYW5lbC5fX2FjY2VwdF90ZXJtc19saW5rc19jYWNoZSA9IGNsb25lX3ZhbHVlKCBuZXh0X2xpbmtzICk7XHJcblxyXG5cdFx0XHR0aGlzLnJlbmRlcl9saW5rc19lZGl0b3IoIHBhbmVsLCBuZXh0X2xpbmtzICk7XHJcblx0XHRcdHRoaXMuYmluZF9yb3dzX29ic2VydmVyKCBwYW5lbCApO1xyXG5cdFx0XHR0aGlzLnJlZnJlc2hfZnJvbV9yZW5kZXJlZF9yb3dzKCBwYW5lbCApO1xyXG5cclxuXHRcdFx0cmV0dXJuIG5leHRfbGlua3M7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBBZGQgbGluayBhZnRlciBjdXJyZW50IGluZGV4LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7QXJyYXl9IHNvdXJjZV9hcnIgTGlua3MgYXJyYXkuXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gdGFyZ2V0X2luZGV4IFRhcmdldCBpbmRleC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHtBcnJheX1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGFkZF9saW5rX2FmdGVyKCBzb3VyY2VfYXJyLCB0YXJnZXRfaW5kZXggKSB7XHJcblx0XHRcdHZhciByZXN1bHRfYXJyICAgPSBzb3VyY2VfYXJyLnNsaWNlKCAwICk7XHJcblx0XHRcdHZhciBpbnNlcnRfaW5kZXggPSBwYXJzZUludCggdGFyZ2V0X2luZGV4LCAxMCApO1xyXG5cclxuXHRcdFx0aWYgKCBpc05hTiggaW5zZXJ0X2luZGV4ICkgKSB7XHJcblx0XHRcdFx0aW5zZXJ0X2luZGV4ID0gcmVzdWx0X2Fyci5sZW5ndGggLSAxO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXN1bHRfYXJyLnNwbGljZSggaW5zZXJ0X2luZGV4ICsgMSwgMCwgYnVpbGRfZGVmYXVsdF9saW5rX2RlZiggcmVzdWx0X2Fyci5sZW5ndGggKSApO1xyXG5cclxuXHRcdFx0cmV0dXJuIHJlc3VsdF9hcnI7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEdXBsaWNhdGUgbGluay5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0FycmF5fSBzb3VyY2VfYXJyIExpbmtzIGFycmF5LlxyXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHRhcmdldF9pbmRleCBUYXJnZXQgaW5kZXguXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7QXJyYXl9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBkdXBsaWNhdGVfbGluayggc291cmNlX2FyciwgdGFyZ2V0X2luZGV4ICkge1xyXG5cdFx0XHR2YXIgcmVzdWx0X2FyciA9IHNvdXJjZV9hcnIuc2xpY2UoIDAgKTtcclxuXHRcdFx0dmFyIGluZGV4X251bSAgPSBwYXJzZUludCggdGFyZ2V0X2luZGV4LCAxMCApO1xyXG5cdFx0XHR2YXIgY2xvbmVkX2xpbms7XHJcblxyXG5cdFx0XHRpZiAoIGlzTmFOKCBpbmRleF9udW0gKSB8fCAhIHJlc3VsdF9hcnJbIGluZGV4X251bSBdICkge1xyXG5cdFx0XHRcdHJldHVybiByZXN1bHRfYXJyO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjbG9uZWRfbGluayAgICAgPSBjbG9uZV92YWx1ZSggdGhpcy5ub3JtYWxpemVfbGlua19kZWYoIHJlc3VsdF9hcnJbIGluZGV4X251bSBdLCBpbmRleF9udW0gKSApO1xyXG5cdFx0XHRjbG9uZWRfbGluay5rZXkgPSAnJztcclxuXHJcblx0XHRcdHJlc3VsdF9hcnIuc3BsaWNlKCBpbmRleF9udW0gKyAxLCAwLCBjbG9uZWRfbGluayApO1xyXG5cclxuXHRcdFx0cmV0dXJuIHJlc3VsdF9hcnI7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZW1vdmUgbGluay5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0FycmF5fSBzb3VyY2VfYXJyIExpbmtzIGFycmF5LlxyXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHRhcmdldF9pbmRleCBUYXJnZXQgaW5kZXguXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7QXJyYXl9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyByZW1vdmVfbGluayggc291cmNlX2FyciwgdGFyZ2V0X2luZGV4ICkge1xyXG5cdFx0XHR2YXIgcmVzdWx0X2FyciA9IHNvdXJjZV9hcnIuc2xpY2UoIDAgKTtcclxuXHRcdFx0dmFyIGluZGV4X251bSAgPSBwYXJzZUludCggdGFyZ2V0X2luZGV4LCAxMCApO1xyXG5cclxuXHRcdFx0aWYgKCBpc05hTiggaW5kZXhfbnVtICkgfHwgISByZXN1bHRfYXJyWyBpbmRleF9udW0gXSApIHtcclxuXHRcdFx0XHRyZXR1cm4gcmVzdWx0X2FycjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmVzdWx0X2Fyci5zcGxpY2UoIGluZGV4X251bSwgMSApO1xyXG5cclxuXHRcdFx0cmV0dXJuIHJlc3VsdF9hcnI7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIGJpbmRfcm93c19vYnNlcnZlcihwYW5lbCkge1xyXG5cdFx0XHR2YXIgc2VsZiAgICA9IHRoaXM7XHJcblx0XHRcdHZhciBsaXN0X2VsID0gdGhpcy5nZXRfbGlua3NfbGlzdCggcGFuZWwgKTtcclxuXHJcblx0XHRcdGlmICggISBwYW5lbCB8fCAhIGxpc3RfZWwgfHwgJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiBNdXRhdGlvbk9ic2VydmVyICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBwYW5lbC5fX2FjY2VwdF90ZXJtc19yb3dzX29ic2VydmVyICkge1xyXG5cdFx0XHRcdHBhbmVsLl9fYWNjZXB0X3Rlcm1zX3Jvd3Nfb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xyXG5cdFx0XHRcdHBhbmVsLl9fYWNjZXB0X3Rlcm1zX3Jvd3Nfb2JzZXJ2ZXIgPSBudWxsO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRwYW5lbC5fX2FjY2VwdF90ZXJtc19yb3dzX29ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoXHJcblx0XHRcdFx0ZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0c2VsZi5zY2hlZHVsZV9saXZlX2RvbV9zeW5jKCBwYW5lbCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0KTtcclxuXHJcblx0XHRcdHBhbmVsLl9fYWNjZXB0X3Rlcm1zX3Jvd3Nfb2JzZXJ2ZXIub2JzZXJ2ZShcclxuXHRcdFx0XHRsaXN0X2VsLFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdGNoaWxkTGlzdDogdHJ1ZSxcclxuXHRcdFx0XHRcdHN1YnRyZWUgIDogdHJ1ZVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0KTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEJvb3RzdHJhcCBpbnNwZWN0b3IgcGFuZWwuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcGFuZWwgSW5zcGVjdG9yIHBhbmVsLlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSBmaWVsZF9lbCBGaWVsZCBlbGVtZW50LlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBib290c3RyYXBfcGFuZWwocGFuZWwsIGZpZWxkX2VsKSB7XHJcblx0XHRcdHZhciBsaW5rc19hcnIgPSBhcnJheSgpO1xyXG5cclxuXHRcdFx0aWYgKCAhIHBhbmVsICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cGFuZWwuX19hY2NlcHRfdGVybXNfZmllbGQgPSBmaWVsZF9lbCB8fCBwYW5lbC5fX2FjY2VwdF90ZXJtc19maWVsZCB8fCB0aGlzLmdldF9zZWxlY3RlZF9maWVsZCgpO1xyXG5cclxuXHRcdFx0aWYgKCAhIHRoaXMuaXNfYWNjZXB0X3Rlcm1zX3BhbmVsKCBwYW5lbCApICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0LypcclxuXHRcdFx0ICogRmlyc3QgYm9vdHN0cmFwOlxyXG5cdFx0XHQgKiByZWFkIHNhdmVkL2RlZmF1bHQgbGlua3MsIHJlbmRlciByb3dzLCB0aGVuIG1hcmsgYm9vdHN0cmFwcGVkLlxyXG5cdFx0XHQgKi9cclxuXHRcdFx0aWYgKCAhIHRoaXMucGFuZWxfaXNfYm9vdHN0cmFwcGVkKCBwYW5lbCApICkge1xyXG5cdFx0XHRcdGxpbmtzX2FyciAgICAgICAgICAgICAgICAgICAgICAgID0gdGhpcy5yZWFkX2xpbmtzX2Zyb21fc3RhdGUoIHBhbmVsICk7XHJcblx0XHRcdFx0cGFuZWwuX19hY2NlcHRfdGVybXNfbGlua3NfY2FjaGUgPSBjbG9uZV92YWx1ZSggbGlua3NfYXJyICk7XHJcblxyXG5cdFx0XHRcdHRoaXMucmVuZGVyX2xpbmtzX2VkaXRvciggcGFuZWwsIGxpbmtzX2FyciApO1xyXG5cdFx0XHRcdHRoaXMubWFya19wYW5lbF9ib290c3RyYXBwZWQoIHBhbmVsICk7XHJcblx0XHRcdFx0dGhpcy5iaW5kX3Jvd3Nfb2JzZXJ2ZXIoIHBhbmVsICk7XHJcblx0XHRcdFx0dGhpcy53cml0ZV9saW5rc19zdGF0ZSggcGFuZWwsIGxpbmtzX2FyciApO1xyXG5cdFx0XHRcdHRoaXMucmVuZGVyX2F2YWlsYWJsZV90b2tlbnMoIHBhbmVsLCBsaW5rc19hcnIgKTtcclxuXHRcdFx0XHR0aGlzLnJlbmRlcl9zZW50ZW5jZV9zdGF0dXMoIHBhbmVsLCBsaW5rc19hcnIgKTtcclxuXHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvKlxyXG5cdFx0XHQgKiBBZnRlciBib290c3RyYXA6XHJcblx0XHRcdCAqIGxpdmUgRE9NIGlzIHRoZSBzb3VyY2Ugb2YgdHJ1dGguXHJcblx0XHRcdCAqL1xyXG5cdFx0XHR0aGlzLmJpbmRfcm93c19vYnNlcnZlciggcGFuZWwgKTtcclxuXHRcdFx0dGhpcy5yZWZyZXNoX2Zyb21fcmVuZGVyZWRfcm93cyggcGFuZWwgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFVwZGF0ZSBmaWVsZCBwcm9wIGluIHN0cnVjdHVyZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbCBGaWVsZCBlbGVtZW50LlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGtleSBLZXkuXHJcblx0XHQgKiBAcGFyYW0geyp9IHZhbHVlIFZhbHVlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyB1cGRhdGVfc3RydWN0dXJlX3Byb3AoIGVsLCBrZXksIHZhbHVlICkge1xyXG5cdFx0XHRpZiAoIGNvcmUgJiYgY29yZS5TdHJ1Y3R1cmUgJiYgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIGNvcmUuU3RydWN0dXJlLnVwZGF0ZV9maWVsZF9wcm9wICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBjb3JlICYmIGNvcmUuU3RydWN0dXJlICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBjb3JlLlN0cnVjdHVyZS51cGRhdGVfZmllbGRfcHJvcCApIHtcclxuXHRcdFx0XHRjb3JlLlN0cnVjdHVyZS51cGRhdGVfZmllbGRfcHJvcCggZWwsIGtleSwgdmFsdWUgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRGlzcGF0Y2ggZmllbGQgZGF0YSBjaGFuZ2VkIGV2ZW50LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsIEZpZWxkIGVsZW1lbnQuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30ga2V5IEtleS5cclxuXHRcdCAqIEBwYXJhbSB7Kn0gdmFsdWUgVmFsdWUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGRpc3BhdGNoX2ZpZWxkX2RhdGFfY2hhbmdlZCggZWwsIGtleSwgdmFsdWUgKSB7XHJcblx0XHRcdHZhciBldmVudF9vYmo7XHJcblxyXG5cdFx0XHRpZiAoICEgZWwgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHcuQ3VzdG9tRXZlbnQgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRldmVudF9vYmogPSBuZXcgQ3VzdG9tRXZlbnQoXHJcblx0XHRcdFx0J3dwYmNfYmZiX2ZpZWxkX2RhdGFfY2hhbmdlZCcsXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0YnViYmxlcyA6IHRydWUsXHJcblx0XHRcdFx0XHRkZXRhaWwgIDoge1xyXG5cdFx0XHRcdFx0XHRrZXkgICA6IGtleSxcclxuXHRcdFx0XHRcdFx0dmFsdWUgOiB2YWx1ZVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0KTtcclxuXHJcblx0XHRcdGVsLmRpc3BhdGNoRXZlbnQoIGV2ZW50X29iaiApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogV2lyZSBpbnNwZWN0b3IgaGFuZGxlcnMgb25jZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgd2lyZV9vbmNlX2FjY2VwdF90ZXJtcygpIHtcclxuXHRcdFx0dmFyIHNlbGYgICAgICAgICAgID0gdGhpcztcclxuXHRcdFx0dmFyIGluc3BlY3Rvcl9yb290ID0gbnVsbDtcclxuXHRcdFx0dmFyIG9uX3JlYWR5X29yX3JlbmRlcjtcclxuXHJcblx0XHRcdGlmICggdGhpcy5fX2FjY2VwdF90ZXJtc193aXJlZCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0dGhpcy5fX2FjY2VwdF90ZXJtc193aXJlZCA9IHRydWU7XHJcblxyXG5cdFx0XHRvbl9yZWFkeV9vcl9yZW5kZXIgPSBmdW5jdGlvbiAoIGV2ZW50X29iaiApIHtcclxuXHRcdFx0XHR2YXIgcGFuZWwgICAgPSBldmVudF9vYmogJiYgZXZlbnRfb2JqLmRldGFpbCA/IGV2ZW50X29iai5kZXRhaWwucGFuZWwgOiBudWxsO1xyXG5cdFx0XHRcdHZhciBmaWVsZF9lbCA9IG51bGw7XHJcblxyXG5cdFx0XHRcdGlmICggZXZlbnRfb2JqICYmIGV2ZW50X29iai5kZXRhaWwgKSB7XHJcblx0XHRcdFx0XHRmaWVsZF9lbCA9IGV2ZW50X29iai5kZXRhaWwuZmllbGQgfHwgZXZlbnRfb2JqLmRldGFpbC5lbCB8fCBldmVudF9vYmouZGV0YWlsLnRhcmdldCB8fCBudWxsO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCBwYW5lbCApIHtcclxuXHRcdFx0XHRcdHNlbGYuYm9vdHN0cmFwX3BhbmVsKCBwYW5lbCwgZmllbGRfZWwgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiY19iZmJfaW5zcGVjdG9yX3JlYWR5Jywgb25fcmVhZHlfb3JfcmVuZGVyICk7XHJcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjX2JmYl9pbnNwZWN0b3JfcmVuZGVyJywgb25fcmVhZHlfb3JfcmVuZGVyICk7XHJcblxyXG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnbW91c2Vkb3duJyxcclxuXHRcdFx0XHRmdW5jdGlvbiAoIGV2ZW50X29iaiApIHtcclxuXHRcdFx0XHRcdHZhciB0b2tlbl9idXR0b24gPSBldmVudF9vYmoudGFyZ2V0ID8gZXZlbnRfb2JqLnRhcmdldC5jbG9zZXN0KCAnLmpzLWluc2VydC10b2tlbi1mcm9tLWhpbnQnICkgOiBudWxsO1xyXG5cdFx0XHRcdFx0dmFyIHBhbmVsICAgICAgICA9IHRva2VuX2J1dHRvbiA/IHRva2VuX2J1dHRvbi5jbG9zZXN0KCAnLndwYmNfYmZiX19pbnNwZWN0b3JfX2JvZHknICkgOiBudWxsO1xyXG5cdFx0XHRcdFx0dmFyIHRva2VuX2tleSAgICA9ICcnO1xyXG5cclxuXHRcdFx0XHRcdGlmICggISB0b2tlbl9idXR0b24gfHwgISBwYW5lbCApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHBhbmVsLl9fYWNjZXB0X3Rlcm1zX2ZpZWxkID0gc2VsZi5nZXRfc2VsZWN0ZWRfZmllbGQoKTtcclxuXHJcblx0XHRcdFx0XHRpZiAoICEgc2VsZi5pc19hY2NlcHRfdGVybXNfcGFuZWwoIHBhbmVsICkgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRldmVudF9vYmoucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRcdGV2ZW50X29iai5zdG9wUHJvcGFnYXRpb24oKTtcclxuXHJcblx0XHRcdFx0XHR0b2tlbl9rZXkgPSBTdHJpbmcoIHRva2VuX2J1dHRvbi5nZXRBdHRyaWJ1dGUoICdkYXRhLXRva2VuJyApIHx8ICcnICk7XHJcblx0XHRcdFx0XHRzZWxmLmluc2VydF90b2tlbl9pbnRvX3NlbnRlbmNlKCBwYW5lbCwgdG9rZW5fa2V5ICk7XHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHR0cnVlXHJcblx0XHRcdCk7XHJcblxyXG5cdFx0XHRpbnNwZWN0b3Jfcm9vdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2luc3BlY3RvcicgKTtcclxuXHRcdFx0aWYgKCAhIGluc3BlY3Rvcl9yb290ICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aW5zcGVjdG9yX3Jvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJyxcclxuXHRcdFx0XHRmdW5jdGlvbiAoIGV2ZW50X29iaiApIHtcclxuXHRcdFx0XHRcdHZhciBwYW5lbCAgICAgICA9IGV2ZW50X29iai50YXJnZXQgPyBldmVudF9vYmoudGFyZ2V0LmNsb3Nlc3QoICcud3BiY19iZmJfX2luc3BlY3Rvcl9fYm9keScgKSA6IG51bGw7XHJcblx0XHRcdFx0XHR2YXIgcm93X2VsICAgICAgPSBudWxsO1xyXG5cdFx0XHRcdFx0dmFyIHJvd19pbmRleCAgID0gLTE7XHJcblx0XHRcdFx0XHR2YXIgYWN0aW9uX25hbWUgPSAnJztcclxuXHRcdFx0XHRcdHZhciBsaW5rc19hcnIgICA9IGFycmF5KCk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCAhIHBhbmVsICkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0cGFuZWwuX19hY2NlcHRfdGVybXNfZmllbGQgPSBzZWxmLmdldF9zZWxlY3RlZF9maWVsZCgpO1xyXG5cclxuXHRcdFx0XHRcdGlmICggISBzZWxmLmlzX2FjY2VwdF90ZXJtc19wYW5lbCggcGFuZWwgKSApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmICggZXZlbnRfb2JqLnRhcmdldC5jbG9zZXN0KCAnLmpzLWluc2VydC10b2tlbi1mcm9tLWhpbnQnICkgKSB7XHJcblx0XHRcdFx0XHRcdGV2ZW50X29iai5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKCBldmVudF9vYmoudGFyZ2V0LmNsb3Nlc3QoICcuanMtYWRkLWxpbmstZGVmaW5pdGlvbicgKSApIHtcclxuXHRcdFx0XHRcdFx0bGlua3NfYXJyID0gc2VsZi5jb2xsZWN0X2xpbmtzX2Zyb21fZG9tKCBwYW5lbCApO1xyXG5cdFx0XHRcdFx0XHRsaW5rc19hcnIgPSBzZWxmLmFkZF9saW5rX2FmdGVyKCBsaW5rc19hcnIsIGxpbmtzX2Fyci5sZW5ndGggLSAxICk7XHJcblx0XHRcdFx0XHRcdHNlbGYucmVyZW5kZXJfbGlua3NfZWRpdG9yKCBwYW5lbCwgbGlua3NfYXJyICk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRpZiAoIGV2ZW50X29iai50YXJnZXQuY2xvc2VzdCggJy5qcy1saW5rLXJvdy1hY3Rpb24nICkgKSB7XHJcblx0XHRcdFx0XHRcdGV2ZW50X29iai5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdFx0XHRcdFx0cm93X2VsID0gZXZlbnRfb2JqLnRhcmdldC5jbG9zZXN0KCAnLndwYmNfYmZiX19hY2NlcHRfdGVybXNfbGlua19yb3cnICk7XHJcblx0XHRcdFx0XHRcdGlmICggISByb3dfZWwgKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRyb3dfaW5kZXggICA9IHBhcnNlSW50KCByb3dfZWwuZ2V0QXR0cmlidXRlKCAnZGF0YS1pbmRleCcgKSB8fCAnLTEnLCAxMCApO1xyXG5cdFx0XHRcdFx0XHRhY3Rpb25fbmFtZSA9IFN0cmluZyggZXZlbnRfb2JqLnRhcmdldC5jbG9zZXN0KCAnLmpzLWxpbmstcm93LWFjdGlvbicgKS5nZXRBdHRyaWJ1dGUoICdkYXRhLWFjdGlvbicgKSB8fCAnJyApO1xyXG5cdFx0XHRcdFx0XHRsaW5rc19hcnIgICA9IHNlbGYuY29sbGVjdF9saW5rc19mcm9tX2RvbSggcGFuZWwgKTtcclxuXHJcblx0XHRcdFx0XHRcdGlmICggJ2FkZF9hZnRlcicgPT09IGFjdGlvbl9uYW1lICkge1xyXG5cdFx0XHRcdFx0XHRcdHNlbGYucmVyZW5kZXJfbGlua3NfZWRpdG9yKCBwYW5lbCwgc2VsZi5hZGRfbGlua19hZnRlciggbGlua3NfYXJyLCByb3dfaW5kZXggKSApO1xyXG5cdFx0XHRcdFx0XHRcdHNlbGYuc2NoZWR1bGVfcm93c19zeW5jKCBwYW5lbCApO1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0aWYgKCAnZHVwbGljYXRlJyA9PT0gYWN0aW9uX25hbWUgKSB7XHJcblx0XHRcdFx0XHRcdFx0c2VsZi5yZXJlbmRlcl9saW5rc19lZGl0b3IoIHBhbmVsLCBzZWxmLmR1cGxpY2F0ZV9saW5rKCBsaW5rc19hcnIsIHJvd19pbmRleCApICk7XHJcblx0XHRcdFx0XHRcdFx0c2VsZi5zY2hlZHVsZV9yb3dzX3N5bmMoIHBhbmVsICk7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoICdyZW1vdmUnID09PSBhY3Rpb25fbmFtZSApIHtcclxuXHRcdFx0XHRcdFx0XHRzZWxmLnJlcmVuZGVyX2xpbmtzX2VkaXRvciggcGFuZWwsIHNlbGYucmVtb3ZlX2xpbmsoIGxpbmtzX2Fyciwgcm93X2luZGV4ICkgKTtcclxuXHRcdFx0XHRcdFx0XHRzZWxmLnNjaGVkdWxlX3Jvd3Nfc3luYyggcGFuZWwgKTtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdHRydWVcclxuXHRcdFx0KTtcclxuXHJcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXHJcblx0XHRcdFx0J2NsaWNrJyxcclxuXHRcdFx0XHRmdW5jdGlvbiAoZXZlbnRfb2JqKSB7XHJcblx0XHRcdFx0XHR2YXIgYWN0aW9uX2VsID0gZXZlbnRfb2JqLnRhcmdldCA/IGV2ZW50X29iai50YXJnZXQuY2xvc2VzdCggJy5qcy1saW5rLXJvdy1hY3Rpb24sIC5qcy1hZGQtbGluay1kZWZpbml0aW9uJyApIDogbnVsbDtcclxuXHRcdFx0XHRcdHZhciBwYW5lbCAgICAgPSBhY3Rpb25fZWwgPyBhY3Rpb25fZWwuY2xvc2VzdCggJy53cGJjX2JmYl9faW5zcGVjdG9yX19ib2R5JyApIDogbnVsbDtcclxuXHJcblx0XHRcdFx0XHRpZiAoICEgYWN0aW9uX2VsIHx8ICEgcGFuZWwgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRwYW5lbC5fX2FjY2VwdF90ZXJtc19maWVsZCA9IHNlbGYuZ2V0X3NlbGVjdGVkX2ZpZWxkKCk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCAhIHNlbGYuaXNfYWNjZXB0X3Rlcm1zX3BhbmVsKCBwYW5lbCApICkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0LypcclxuXHRcdFx0XHRcdCAqIFJ1biBhZnRlciBnZW5lcmljIG9wdGlvbnMtZWRpdG9yIGhhbmRsZXJzIGZpbmlzaC5cclxuXHRcdFx0XHRcdCAqL1xyXG5cdFx0XHRcdFx0c2VsZi5zY2hlZHVsZV9saXZlX2RvbV9zeW5jKCBwYW5lbCApO1xyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0dHJ1ZVxyXG5cdFx0XHQpO1xyXG5cclxuXHRcdFx0aW5zcGVjdG9yX3Jvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JyxcclxuXHRcdFx0XHRmdW5jdGlvbiAoIGV2ZW50X29iaiApIHtcclxuXHRcdFx0XHRcdHZhciBwYW5lbCAgICAgICAgPSBldmVudF9vYmoudGFyZ2V0ID8gZXZlbnRfb2JqLnRhcmdldC5jbG9zZXN0KCAnLndwYmNfYmZiX19pbnNwZWN0b3JfX2JvZHknICkgOiBudWxsO1xyXG5cdFx0XHRcdFx0dmFyIGxpbmtzX2FyciAgICA9IGFycmF5KCk7XHJcblx0XHRcdFx0XHR2YXIgcm93X2VsICAgICAgID0gbnVsbDtcclxuXHRcdFx0XHRcdHZhciB0b2tlbl9rZXlfZWwgPSBudWxsO1xyXG5cclxuXHRcdFx0XHRcdGlmICggISBwYW5lbCApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHBhbmVsLl9fYWNjZXB0X3Rlcm1zX2ZpZWxkID0gc2VsZi5nZXRfc2VsZWN0ZWRfZmllbGQoKTtcclxuXHJcblx0XHRcdFx0XHRpZiAoICEgc2VsZi5pc19hY2NlcHRfdGVybXNfcGFuZWwoIHBhbmVsICkgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRpZiAoIGV2ZW50X29iai50YXJnZXQubWF0Y2hlcyggJy5pbnNwZWN0b3JfX3RleHRhcmVhW2RhdGEtaW5zcGVjdG9yLWtleT1cInNlbnRlbmNlXCJdJyApICkge1xyXG5cdFx0XHRcdFx0XHRzZWxmLnJlbmRlcl9zZW50ZW5jZV9zdGF0dXMoIHBhbmVsLCBzZWxmLnJlYWRfbGlua3NfZnJvbV9zdGF0ZSggcGFuZWwgKSApO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0cm93X2VsID0gZXZlbnRfb2JqLnRhcmdldC5jbG9zZXN0KCAnLndwYmNfYmZiX19hY2NlcHRfdGVybXNfbGlua19yb3cnICk7XHJcblx0XHRcdFx0XHRpZiAoIHJvd19lbCApIHtcclxuXHRcdFx0XHRcdFx0dG9rZW5fa2V5X2VsID0gcm93X2VsLnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX2FjY2VwdF90ZXJtc19saW5rX2tleScgKTtcclxuXHJcblx0XHRcdFx0XHRcdGlmICggdG9rZW5fa2V5X2VsICYmIGV2ZW50X29iai50YXJnZXQgPT09IHRva2VuX2tleV9lbCApIHtcclxuXHRcdFx0XHRcdFx0XHRzYW5pdGl6ZV90b2tlbl9rZXlfaW5wdXQoIHRva2VuX2tleV9lbCApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRsaW5rc19hcnIgPSBzZWxmLnN5bmNfc3RhdGVfZnJvbV9kb20oIHBhbmVsICk7XHJcblx0XHRcdFx0XHRcdHNlbGYucmVuZGVyX2F2YWlsYWJsZV90b2tlbnMoIHBhbmVsLCBsaW5rc19hcnIgKTtcclxuXHRcdFx0XHRcdFx0c2VsZi5yZW5kZXJfc2VudGVuY2Vfc3RhdHVzKCBwYW5lbCwgbGlua3NfYXJyICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHR0cnVlXHJcblx0XHRcdCk7XHJcblxyXG5cdFx0XHRpbnNwZWN0b3Jfcm9vdC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJyxcclxuXHRcdFx0XHRmdW5jdGlvbiAoIGV2ZW50X29iaiApIHtcclxuXHRcdFx0XHRcdHZhciBwYW5lbCAgICAgICAgPSBldmVudF9vYmoudGFyZ2V0ID8gZXZlbnRfb2JqLnRhcmdldC5jbG9zZXN0KCAnLndwYmNfYmZiX19pbnNwZWN0b3JfX2JvZHknICkgOiBudWxsO1xyXG5cdFx0XHRcdFx0dmFyIGxpbmtzX2FyciAgICA9IGFycmF5KCk7XHJcblx0XHRcdFx0XHR2YXIgcm93X2VsICAgICAgID0gbnVsbDtcclxuXHRcdFx0XHRcdHZhciB0b2tlbl9rZXlfZWwgPSBudWxsO1xyXG5cclxuXHRcdFx0XHRcdGlmICggISBwYW5lbCApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHBhbmVsLl9fYWNjZXB0X3Rlcm1zX2ZpZWxkID0gc2VsZi5nZXRfc2VsZWN0ZWRfZmllbGQoKTtcclxuXHJcblx0XHRcdFx0XHRpZiAoICEgc2VsZi5pc19hY2NlcHRfdGVybXNfcGFuZWwoIHBhbmVsICkgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRpZiAoIGV2ZW50X29iai50YXJnZXQubWF0Y2hlcyggJy5pbnNwZWN0b3JfX3RleHRhcmVhW2RhdGEtaW5zcGVjdG9yLWtleT1cInNlbnRlbmNlXCJdJyApICkge1xyXG5cdFx0XHRcdFx0XHRzZWxmLnJlbmRlcl9zZW50ZW5jZV9zdGF0dXMoIHBhbmVsLCBzZWxmLnJlYWRfbGlua3NfZnJvbV9zdGF0ZSggcGFuZWwgKSApO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKCBldmVudF9vYmoudGFyZ2V0Lm1hdGNoZXMoICcuaW5zcGVjdG9yX19jaGVja2JveFtkYXRhLWluc3BlY3Rvci1rZXk9XCJyZXF1aXJlZFwiXScgKSApIHtcclxuXHRcdFx0XHRcdFx0ZXZlbnRfb2JqLnRhcmdldC5zZXRBdHRyaWJ1dGUoICdhcmlhLWNoZWNrZWQnLCBldmVudF9vYmoudGFyZ2V0LmNoZWNrZWQgPyAndHJ1ZScgOiAnZmFsc2UnICk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRyb3dfZWwgPSBldmVudF9vYmoudGFyZ2V0LmNsb3Nlc3QoICcud3BiY19iZmJfX2FjY2VwdF90ZXJtc19saW5rX3JvdycgKTtcclxuXHRcdFx0XHRcdGlmICggcm93X2VsICkge1xyXG5cdFx0XHRcdFx0XHR0b2tlbl9rZXlfZWwgPSByb3dfZWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fYWNjZXB0X3Rlcm1zX2xpbmtfa2V5JyApO1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKCB0b2tlbl9rZXlfZWwgKSB7XHJcblx0XHRcdFx0XHRcdFx0c2FuaXRpemVfdG9rZW5fa2V5X2lucHV0KCB0b2tlbl9rZXlfZWwgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0bGlua3NfYXJyID0gc2VsZi5jb2xsZWN0X2xpbmtzX2Zyb21fZG9tKCBwYW5lbCApO1xyXG5cdFx0XHRcdFx0XHRzZWxmLnJlcmVuZGVyX2xpbmtzX2VkaXRvciggcGFuZWwsIGxpbmtzX2FyciApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0dHJ1ZVxyXG5cdFx0XHQpO1xyXG5cclxuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmNfYmZiX2luc3BlY3Rvcl9yZW5kZXInLFxyXG5cdFx0XHRcdGZ1bmN0aW9uICggZXZlbnRfb2JqICkge1xyXG5cdFx0XHRcdFx0dmFyIHBhbmVsICAgID0gZXZlbnRfb2JqICYmIGV2ZW50X29iai5kZXRhaWwgPyBldmVudF9vYmouZGV0YWlsLnBhbmVsIDogbnVsbDtcclxuXHRcdFx0XHRcdHZhciBmaWVsZF9lbCA9IGV2ZW50X29iaiAmJiBldmVudF9vYmouZGV0YWlsID8gKCBldmVudF9vYmouZGV0YWlsLmZpZWxkIHx8IGV2ZW50X29iai5kZXRhaWwuZWwgfHwgbnVsbCApIDogbnVsbDtcclxuXHJcblx0XHRcdFx0XHRpZiAoIHBhbmVsICYmIGZpZWxkX2VsICkge1xyXG5cdFx0XHRcdFx0XHRzZWxmLmJvb3RzdHJhcF9wYW5lbCggcGFuZWwsIGZpZWxkX2VsICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHQpO1xyXG5cclxuXHRcdFx0c2V0VGltZW91dChcclxuXHRcdFx0XHRmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHR2YXIgcGFuZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnI3dwYmNfYmZiX19pbnNwZWN0b3IgLndwYmNfYmZiX19pbnNwZWN0b3JfX2JvZHknICk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCBwYW5lbCApIHtcclxuXHRcdFx0XHRcdFx0c2VsZi5ib290c3RyYXBfcGFuZWwoIHBhbmVsLCBzZWxmLmdldF9zZWxlY3RlZF9maWVsZCgpICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHQwXHJcblx0XHRcdCk7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIHBhbmVsX2lzX2Jvb3RzdHJhcHBlZChwYW5lbCkge1xyXG5cdFx0XHRyZXR1cm4gISEgKHBhbmVsICYmICcxJyA9PT0gU3RyaW5nKCBwYW5lbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYWNjZXB0LXRlcm1zLWJvb3RzdHJhcHBlZCcgKSB8fCAnJyApKTtcclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgbWFya19wYW5lbF9ib290c3RyYXBwZWQocGFuZWwpIHtcclxuXHRcdFx0aWYgKCAhIHBhbmVsICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cGFuZWwuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWFjY2VwdC10ZXJtcy1ib290c3RyYXBwZWQnLCAnMScgKTtcclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgZ2V0X2xpdmVfbGlua3NfZnJvbV9kb20ocGFuZWwpIHtcclxuXHRcdFx0dmFyIGxpc3RfZWwgICA9IHRoaXMuZ2V0X2xpbmtzX2xpc3QoIHBhbmVsICk7XHJcblx0XHRcdHZhciByb3dfbGlzdCAgPSBudWxsO1xyXG5cdFx0XHR2YXIgbGlua3NfYXJyID0gYXJyYXkoKTtcclxuXHJcblx0XHRcdGlmICggISBsaXN0X2VsICkge1xyXG5cdFx0XHRcdHJldHVybiBsaW5rc19hcnI7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJvd19saXN0ID0gbGlzdF9lbC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19hY2NlcHRfdGVybXNfbGlua19yb3cnICk7XHJcblxyXG5cdFx0XHRpZiAoICEgcm93X2xpc3QubGVuZ3RoICkge1xyXG5cdFx0XHRcdHJldHVybiBsaW5rc19hcnI7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiB0aGlzLmNvbGxlY3RfbGlua3NfZnJvbV9kb20oIHBhbmVsICk7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIHNjaGVkdWxlX2xpdmVfZG9tX3N5bmMocGFuZWwpIHtcclxuXHRcdFx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuXHRcdFx0aWYgKCAhIHBhbmVsICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBwYW5lbC5fX2FjY2VwdF90ZXJtc19saXZlX2RvbV9zeW5jX3RpbWVyICkge1xyXG5cdFx0XHRcdGNsZWFyVGltZW91dCggcGFuZWwuX19hY2NlcHRfdGVybXNfbGl2ZV9kb21fc3luY190aW1lciApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRwYW5lbC5fX2FjY2VwdF90ZXJtc19saXZlX2RvbV9zeW5jX3RpbWVyID0gc2V0VGltZW91dChcclxuXHRcdFx0XHRmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRzZWxmLnJlZnJlc2hfZnJvbV9yZW5kZXJlZF9yb3dzKCBwYW5lbCApO1xyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0MFxyXG5cdFx0XHQpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0dHJ5IHtcclxuXHRcdHJlZ2lzdHJ5LnJlZ2lzdGVyKCAnYWNjZXB0X3Rlcm1zJywgV1BCQ19CRkJfRmllbGRfQWNjZXB0X1Rlcm1zICk7XHJcblx0XHR3LldQQkNfQkZCX0ZpZWxkX0FjY2VwdF9UZXJtcyA9IFdQQkNfQkZCX0ZpZWxkX0FjY2VwdF9UZXJtcztcclxuXHRcdFdQQkNfQkZCX0ZpZWxkX0FjY2VwdF9UZXJtcy53aXJlX29uY2VfYWNjZXB0X3Rlcm1zKCk7XHJcblx0fSBjYXRjaCAoIGVyciApIHtcclxuXHRcdGlmICggdy5fd3BiYyAmJiB3Ll93cGJjLmRldiAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygdy5fd3BiYy5kZXYuZXJyb3IgKSB7XHJcblx0XHRcdHcuX3dwYmMuZGV2LmVycm9yKCAnV1BCQ19CRkJfRmllbGRfQWNjZXB0X1Rlcm1zLnJlZ2lzdGVyJywgZXJyICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByZWdpc3Rlcl9hY2NlcHRfdGVybXNfYm9va2luZ19mb3JtX2V4cG9ydGVyKCkge1xyXG5cdFx0dmFyIGV4cG9ydGVyID0gdy5XUEJDX0JGQl9FeHBvcnRlciB8fCBudWxsO1xyXG5cclxuXHRcdGlmICggISBleHBvcnRlciB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgZXhwb3J0ZXIucmVnaXN0ZXIgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiBleHBvcnRlci5oYXNfZXhwb3J0ZXIgJiYgZXhwb3J0ZXIuaGFzX2V4cG9ydGVyKCAnYWNjZXB0X3Rlcm1zJyApICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0ZXhwb3J0ZXIucmVnaXN0ZXIoXHJcblx0XHRcdCdhY2NlcHRfdGVybXMnLFxyXG5cdFx0XHRmdW5jdGlvbiAoIGZpZWxkLCBlbWl0LCBleHRyYXMgKSB7XHJcblx0XHRcdFx0dmFyIGNmZyAgICAgICAgICAgICAgPSBleHRyYXMgJiYgZXh0cmFzLmNmZyA/IGV4dHJhcy5jZmcgOiB7fTtcclxuXHRcdFx0XHR2YXIgY3R4ICAgICAgICAgICAgICA9IGV4dHJhcyAmJiBleHRyYXMuY3R4ID8gZXh0cmFzLmN0eCA6IHt9O1xyXG5cdFx0XHRcdHZhciBub3JtYWxpemVkX2ZpZWxkID0gV1BCQ19CRkJfRmllbGRfQWNjZXB0X1Rlcm1zLm5vcm1hbGl6ZV9kYXRhKCBmaWVsZCApO1xyXG5cdFx0XHRcdHZhciBmaWVsZF9uYW1lICAgICAgID0gZXhwb3J0ZXIuY29tcHV0ZV9uYW1lKCAnYWNjZXB0X3Rlcm1zJywgbm9ybWFsaXplZF9maWVsZCApO1xyXG5cdFx0XHRcdHZhciBmaWVsZF90aXRsZSAgICAgID0gU3RyaW5nKCBub3JtYWxpemVkX2ZpZWxkLnRpdGxlIHx8ICcnICkudHJpbSgpO1xyXG5cdFx0XHRcdHZhciBjaGVja2JveF90ZXh0ICAgID0gU3RyaW5nKCBub3JtYWxpemVkX2ZpZWxkLmNoZWNrYm94X3RleHQgfHwgJ0kgYWNjZXB0JyApLnRyaW0oKTtcclxuXHRcdFx0XHR2YXIgaWRfb3B0aW9uICAgICAgICA9IGV4cG9ydGVyLmlkX29wdGlvbiggbm9ybWFsaXplZF9maWVsZCwgY3R4ICk7XHJcblx0XHRcdFx0dmFyIGNsYXNzX29wdGlvbnMgICAgPSBleHBvcnRlci5jbGFzc19vcHRpb25zKCBub3JtYWxpemVkX2ZpZWxkICk7XHJcblx0XHRcdFx0dmFyIHNlbnRlbmNlX2h0bWwgICAgPSBidWlsZF9zZW50ZW5jZV9leHBvcnRfaHRtbCggbm9ybWFsaXplZF9maWVsZC5zZW50ZW5jZSwgbm9ybWFsaXplZF9maWVsZC5saW5rcyApO1xyXG5cdFx0XHRcdHZhciByZXFfbWFyayAgICAgICAgID0gbm9ybWFsaXplZF9maWVsZC5yZXF1aXJlZCA/ICcqJyA6ICcnO1xyXG5cdFx0XHRcdHZhciBzaG9ydGNvZGVfYm9keSAgID0gJyc7XHJcblxyXG5cdFx0XHRcdHNob3J0Y29kZV9ib2R5ID0gJ1tjaGVja2JveCcgKyByZXFfbWFyayArICcgJyArIGZpZWxkX25hbWUgKyBpZF9vcHRpb24gKyBjbGFzc19vcHRpb25zICsgJyBcIicgKyBlc2NhcGVfZm9yX3Nob3J0Y29kZSggY2hlY2tib3hfdGV4dCApICsgJ1wiXSc7XHJcblxyXG5cdFx0XHRcdGlmICggZmllbGRfdGl0bGUgJiYgZmFsc2UgIT09IGNmZy5hZGRMYWJlbHMgKSB7XHJcblx0XHRcdFx0XHRlbWl0KCAnPGw+JyArIGVzY2FwZV9odG1sKCBmaWVsZF90aXRsZSApICsgcmVxX21hcmsgKyAnPC9sPicgKTtcclxuXHRcdFx0XHRcdGVtaXQoICc8YnI+JyApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0ZW1pdCggJzxwIGNsYXNzPVwid3BiY19yb3dfaW5saW5lIHdwZGV2LWZvcm0tY29udHJvbC13cmFwIFwiPicgKTtcclxuXHRcdFx0XHRlbWl0KCAnPGwgY2xhc3M9XCJ3cGJjX2lubGluZV9jaGVja2JveFwiPicgKyBzaG9ydGNvZGVfYm9keSArICggc2VudGVuY2VfaHRtbCA/ICcgJyArIHNlbnRlbmNlX2h0bWwgOiAnJyApICsgJzwvbD4nICk7XHJcblx0XHRcdFx0ZW1pdCggJzwvcD4nICk7XHJcblx0XHRcdH1cclxuXHRcdCk7XHJcblx0fVxyXG5cclxuXHRpZiAoIHcuV1BCQ19CRkJfRXhwb3J0ZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHcuV1BCQ19CRkJfRXhwb3J0ZXIucmVnaXN0ZXIgKSB7XHJcblx0XHRyZWdpc3Rlcl9hY2NlcHRfdGVybXNfYm9va2luZ19mb3JtX2V4cG9ydGVyKCk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOmJmYjpleHBvcnRlci1yZWFkeScsIHJlZ2lzdGVyX2FjY2VwdF90ZXJtc19ib29raW5nX2Zvcm1fZXhwb3J0ZXIsIHsgb25jZTogdHJ1ZSB9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByZWdpc3Rlcl9hY2NlcHRfdGVybXNfYm9va2luZ19kYXRhX2V4cG9ydGVyKCkge1xyXG5cdFx0dmFyIGNvbnRlbnRfZXhwb3J0ZXIgPSB3LldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciB8fCBudWxsO1xyXG5cclxuXHRcdGlmICggISBjb250ZW50X2V4cG9ydGVyIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBjb250ZW50X2V4cG9ydGVyLnJlZ2lzdGVyICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29udGVudF9leHBvcnRlci5oYXNfZXhwb3J0ZXIgJiYgY29udGVudF9leHBvcnRlci5oYXNfZXhwb3J0ZXIoICdhY2NlcHRfdGVybXMnICkgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRjb250ZW50X2V4cG9ydGVyLnJlZ2lzdGVyKFxyXG5cdFx0XHQnYWNjZXB0X3Rlcm1zJyxcclxuXHRcdFx0ZnVuY3Rpb24gKCBmaWVsZCwgZW1pdCwgZXh0cmFzICkge1xyXG5cdFx0XHRcdHZhciBjZmcgICAgICAgICAgICAgID0gZXh0cmFzICYmIGV4dHJhcy5jZmcgPyBleHRyYXMuY2ZnIDoge307XHJcblx0XHRcdFx0dmFyIGV4cG9ydGVyICAgICAgICAgPSB3LldQQkNfQkZCX0V4cG9ydGVyIHx8IG51bGw7XHJcblx0XHRcdFx0dmFyIG5vcm1hbGl6ZWRfZmllbGQgPSBXUEJDX0JGQl9GaWVsZF9BY2NlcHRfVGVybXMubm9ybWFsaXplX2RhdGEoIGZpZWxkICk7XHJcblx0XHRcdFx0dmFyIGZpZWxkX25hbWUgICAgICAgPSAnJztcclxuXHRcdFx0XHR2YXIgbGFiZWxfdGV4dCAgICAgICA9ICcnO1xyXG5cclxuXHRcdFx0XHRpZiAoICEgZXhwb3J0ZXIgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIGV4cG9ydGVyLmNvbXB1dGVfbmFtZSApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGZpZWxkX25hbWUgPSBleHBvcnRlci5jb21wdXRlX25hbWUoICdhY2NlcHRfdGVybXMnLCBub3JtYWxpemVkX2ZpZWxkICk7XHJcblx0XHRcdFx0aWYgKCAhIGZpZWxkX25hbWUgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRsYWJlbF90ZXh0ID0gU3RyaW5nKCBub3JtYWxpemVkX2ZpZWxkLnRpdGxlIHx8ICcnICkudHJpbSgpO1xyXG5cdFx0XHRcdGlmICggISBsYWJlbF90ZXh0ICkge1xyXG5cdFx0XHRcdFx0bGFiZWxfdGV4dCA9ICdBY2NlcHQgVGVybXMnO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Y29udGVudF9leHBvcnRlci5lbWl0X2xpbmVfYm9sZF9maWVsZCggZW1pdCwgbGFiZWxfdGV4dCwgZmllbGRfbmFtZSwgY2ZnICk7XHJcblx0XHRcdH1cclxuXHRcdCk7XHJcblx0fVxyXG5cclxuXHRpZiAoIHcuV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3LldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlci5yZWdpc3RlciApIHtcclxuXHRcdHJlZ2lzdGVyX2FjY2VwdF90ZXJtc19ib29raW5nX2RhdGFfZXhwb3J0ZXIoKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6YmZiOmNvbnRlbnQtZXhwb3J0ZXItcmVhZHknLCByZWdpc3Rlcl9hY2NlcHRfdGVybXNfYm9va2luZ19kYXRhX2V4cG9ydGVyLCB7IG9uY2U6IHRydWUgfSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYXJyYXkoKSB7XHJcblx0XHRyZXR1cm4gW107XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBoYXNfb3duX3Byb3AoIHNvdXJjZV9vYmosIHByb3BfbmFtZSApIHtcclxuXHRcdHJldHVybiAhISAoIHNvdXJjZV9vYmogJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBzb3VyY2Vfb2JqLCBwcm9wX25hbWUgKSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdG9fYm9vbCggdmFsdWUsIGRlZmF1bHRfdmFsdWUgKSB7XHJcblx0XHRpZiAoIHVuZGVmaW5lZCA9PT0gdmFsdWUgfHwgbnVsbCA9PT0gdmFsdWUgfHwgJycgPT09IFN0cmluZyggdmFsdWUgKSApIHtcclxuXHRcdFx0cmV0dXJuICEhIGRlZmF1bHRfdmFsdWU7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gKCB0cnVlID09PSB2YWx1ZSB8fCAndHJ1ZScgPT09IHZhbHVlIHx8IDEgPT09IHZhbHVlIHx8ICcxJyA9PT0gdmFsdWUgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9kZWZhdWx0X2xpbmtzKCkge1xyXG5cdFx0cmV0dXJuIFtcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGtleSAgICAgICAgIDogJ3Rlcm1zJyxcclxuXHRcdFx0XHR0ZXh0ICAgICAgICA6ICd0ZXJtcycsXHJcblx0XHRcdFx0bGlua190eXBlICAgOiAndXJsJyxcclxuXHRcdFx0XHRkZXN0aW5hdGlvbiA6ICdodHRwczovL3NlcnZlci5jb20vdGVybXMvJyxcclxuXHRcdFx0XHR0YXJnZXQgICAgICA6ICdfYmxhbmsnLFxyXG5cdFx0XHRcdGNzc2NsYXNzICAgIDogJydcclxuXHRcdFx0fSxcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGtleSAgICAgICAgIDogJ2NvbmRpdGlvbnMnLFxyXG5cdFx0XHRcdHRleHQgICAgICAgIDogJ2NvbmRpdGlvbnMnLFxyXG5cdFx0XHRcdGxpbmtfdHlwZSAgIDogJ3VybCcsXHJcblx0XHRcdFx0ZGVzdGluYXRpb24gOiAnaHR0cHM6Ly9zZXJ2ZXIuY29tL2NvbmRpdGlvbnMvJyxcclxuXHRcdFx0XHR0YXJnZXQgICAgICA6ICdfYmxhbmsnLFxyXG5cdFx0XHRcdGNzc2NsYXNzICAgIDogJydcclxuXHRcdFx0fVxyXG5cdFx0XTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGJ1aWxkX2RlZmF1bHRfbGlua3NfbWFwKCkge1xyXG5cdFx0dmFyIGRlZmF1bHRzX2FyciA9IGdldF9kZWZhdWx0X2xpbmtzKCk7XHJcblx0XHR2YXIgbWFwX29iaiAgICAgID0ge307XHJcblx0XHR2YXIgaTtcclxuXHJcblx0XHRmb3IgKCBpID0gMDsgaSA8IGRlZmF1bHRzX2Fyci5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0bWFwX29ialsgU3RyaW5nKCBkZWZhdWx0c19hcnJbIGkgXS5rZXkgKSBdID0gY2xvbmVfdmFsdWUoIGRlZmF1bHRzX2FyclsgaSBdICk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIG1hcF9vYmo7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBodW1hbml6ZV90b2tlbl90ZXh0KCB0b2tlbl9rZXkgKSB7XHJcblx0XHRyZXR1cm4gU3RyaW5nKCB0b2tlbl9rZXkgfHwgJycgKS5yZXBsYWNlKCAvXy9nLCAnICcgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGJ1aWxkX2xpbmtfZGVmX2Zyb21fdG9rZW4oIHRva2VuX2tleSApIHtcclxuXHRcdHZhciBkZWZhdWx0c19tYXAgPSBidWlsZF9kZWZhdWx0X2xpbmtzX21hcCgpO1xyXG5cclxuXHRcdGlmICggZGVmYXVsdHNfbWFwWyB0b2tlbl9rZXkgXSApIHtcclxuXHRcdFx0cmV0dXJuIGNsb25lX3ZhbHVlKCBkZWZhdWx0c19tYXBbIHRva2VuX2tleSBdICk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0a2V5ICAgICAgICAgOiB0b2tlbl9rZXksXHJcblx0XHRcdHRleHQgICAgICAgIDogaHVtYW5pemVfdG9rZW5fdGV4dCggdG9rZW5fa2V5ICksXHJcblx0XHRcdGxpbmtfdHlwZSAgIDogJ3VybCcsXHJcblx0XHRcdGRlc3RpbmF0aW9uIDogJycsXHJcblx0XHRcdHRhcmdldCAgICAgIDogJ19ibGFuaycsXHJcblx0XHRcdGNzc2NsYXNzICAgIDogJydcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBidWlsZF9kZWZhdWx0X2xpbmtfZGVmKCBpbmRleCApIHtcclxuXHRcdHZhciBzYWZlX2luZGV4ID0gKCAnbnVtYmVyJyA9PT0gdHlwZW9mIGluZGV4ICYmIGluZGV4ID49IDAgKSA/IGluZGV4ICsgMSA6IDE7XHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRrZXkgICAgICAgICA6ICdsaW5rXycgKyBTdHJpbmcoIHNhZmVfaW5kZXggKSxcclxuXHRcdFx0dGV4dCAgICAgICAgOiAnTGluayAnICsgU3RyaW5nKCBzYWZlX2luZGV4ICksXHJcblx0XHRcdGxpbmtfdHlwZSAgIDogJ3VybCcsXHJcblx0XHRcdGRlc3RpbmF0aW9uIDogJycsXHJcblx0XHRcdHRhcmdldCAgICAgIDogJ19ibGFuaycsXHJcblx0XHRcdGNzc2NsYXNzICAgIDogJydcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBub3JtYWxpemVfbGlua19kZWZfaXRlbSggcmF3X2xpbmssIGluZGV4ICkge1xyXG5cdFx0dmFyIGxpbmtfb2JqICAgICAgPSByYXdfbGluayAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIHJhd19saW5rID8gcmF3X2xpbmsgOiB7fTtcclxuXHRcdHZhciBzYWZlX2luZGV4ICAgID0gKCAnbnVtYmVyJyA9PT0gdHlwZW9mIGluZGV4ICYmIGluZGV4ID49IDAgKSA/IGluZGV4IDogMDtcclxuXHRcdHZhciBzYWZlX2tleSAgICAgID0gdG9fdG9rZW5fa2V5KCBsaW5rX29iai5rZXkgfHwgJycgKTtcclxuXHRcdHZhciBmYWxsYmFja190ZXh0ID0gU3RyaW5nKCBsaW5rX29iai50ZXh0IHx8ICcnICkudHJpbSgpO1xyXG5cclxuXHRcdGlmICggISBzYWZlX2tleSAmJiBmYWxsYmFja190ZXh0ICkge1xyXG5cdFx0XHRzYWZlX2tleSA9IHRvX3Rva2VuX2tleSggZmFsbGJhY2tfdGV4dCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISBzYWZlX2tleSApIHtcclxuXHRcdFx0c2FmZV9rZXkgPSAnbGlua18nICsgU3RyaW5nKCBzYWZlX2luZGV4ICsgMSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdGtleSAgICAgICAgIDogc2FmZV9rZXksXHJcblx0XHRcdHRleHQgICAgICAgIDogZmFsbGJhY2tfdGV4dCB8fCBodW1hbml6ZV90b2tlbl90ZXh0KCBzYWZlX2tleSApLFxyXG5cdFx0XHRsaW5rX3R5cGUgICA6IG5vcm1hbGl6ZV9saW5rX3R5cGUoIGxpbmtfb2JqLmxpbmtfdHlwZSB8fCAndXJsJyApLFxyXG5cdFx0XHRkZXN0aW5hdGlvbiA6IFN0cmluZyggbGlua19vYmouZGVzdGluYXRpb24gfHwgJycgKSxcclxuXHRcdFx0dGFyZ2V0ICAgICAgOiBub3JtYWxpemVfdGFyZ2V0KCBsaW5rX29iai50YXJnZXQgfHwgJ19ibGFuaycgKSxcclxuXHRcdFx0Y3NzY2xhc3MgICAgOiBTdHJpbmcoIGxpbmtfb2JqLmNzc2NsYXNzIHx8ICcnIClcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBub3JtYWxpemVfbGlua3NfY29sbGVjdGlvbiggcmF3X2xpbmtzLCB1c2VfZGVmYXVsdHMgKSB7XHJcblx0XHR2YXIgbGlua3NfYXJyICAgID0gYXJyYXkoKTtcclxuXHRcdHZhciBwYXJzZWRfbGlua3MgPSByYXdfbGlua3M7XHJcblx0XHR2YXIga2V5O1xyXG5cdFx0dmFyIGk7XHJcblxyXG5cdFx0aWYgKCAnc3RyaW5nJyA9PT0gdHlwZW9mIHBhcnNlZF9saW5rcyApIHtcclxuXHRcdFx0cGFyc2VkX2xpbmtzID0gc2FmZV9qc29uX3BhcnNlKCBwYXJzZWRfbGlua3MsIGFycmF5KCkgKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIEFycmF5LmlzQXJyYXkoIHBhcnNlZF9saW5rcyApICkge1xyXG5cdFx0XHRmb3IgKCBpID0gMDsgaSA8IHBhcnNlZF9saW5rcy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0XHRsaW5rc19hcnIucHVzaCggbm9ybWFsaXplX2xpbmtfZGVmX2l0ZW0oIHBhcnNlZF9saW5rc1sgaSBdLCBpICkgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIGlmICggcGFyc2VkX2xpbmtzICYmICdvYmplY3QnID09PSB0eXBlb2YgcGFyc2VkX2xpbmtzICkge1xyXG5cdFx0XHRpID0gMDtcclxuXHRcdFx0Zm9yICgga2V5IGluIHBhcnNlZF9saW5rcyApIHtcclxuXHRcdFx0XHRpZiAoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggcGFyc2VkX2xpbmtzLCBrZXkgKSApIHtcclxuXHRcdFx0XHRcdGxpbmtzX2Fyci5wdXNoKCBub3JtYWxpemVfbGlua19kZWZfaXRlbSggcGFyc2VkX2xpbmtzWyBrZXkgXSwgaSApICk7XHJcblx0XHRcdFx0XHRpKys7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAhIGxpbmtzX2Fyci5sZW5ndGggJiYgZmFsc2UgIT09IHVzZV9kZWZhdWx0cyApIHtcclxuXHRcdFx0bGlua3NfYXJyID0gY2xvbmVfdmFsdWUoIGdldF9kZWZhdWx0X2xpbmtzKCkgKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZW5zdXJlX3VuaXF1ZV9saW5rX2tleXMoIGxpbmtzX2FyciApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gY2xvbmVfdmFsdWUoIHNvdXJjZV92YWx1ZSApIHtcclxuXHRcdHRyeSB7XHJcblx0XHRcdHJldHVybiBKU09OLnBhcnNlKCBKU09OLnN0cmluZ2lmeSggc291cmNlX3ZhbHVlICkgKTtcclxuXHRcdH0gY2F0Y2ggKCBlcnIgKSB7XHJcblx0XHRcdHJldHVybiBzb3VyY2VfdmFsdWU7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzYWZlX2pzb25fcGFyc2UoIGpzb25fc3RyaW5nLCBmYWxsYmFja192YWx1ZSApIHtcclxuXHRcdHRyeSB7XHJcblx0XHRcdHJldHVybiBKU09OLnBhcnNlKCBTdHJpbmcoIGpzb25fc3RyaW5nIHx8ICcnICkgKTtcclxuXHRcdH0gY2F0Y2ggKCBlcnIgKSB7XHJcblx0XHRcdHJldHVybiBmYWxsYmFja192YWx1ZTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV90YXJnZXQoIHJhd190YXJnZXQgKSB7XHJcblx0XHRyZXR1cm4gJ19zZWxmJyA9PT0gU3RyaW5nKCByYXdfdGFyZ2V0IHx8ICcnICkgPyAnX3NlbGYnIDogJ19ibGFuayc7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBub3JtYWxpemVfbGlua190eXBlKCByYXdfdHlwZSApIHtcclxuXHRcdHZhciBzYWZlX3R5cGUgPSBTdHJpbmcoIHJhd190eXBlIHx8ICd1cmwnICk7XHJcblx0XHRpZiAoICdwb3B1cCcgPT09IHNhZmVfdHlwZSB8fCAnYW5jaG9yJyA9PT0gc2FmZV90eXBlICkge1xyXG5cdFx0XHRyZXR1cm4gc2FmZV90eXBlO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuICd1cmwnO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdG9fdG9rZW5fa2V5KCByYXdfdmFsdWUgKSB7XHJcblx0XHR2YXIgc2FmZV92YWx1ZSA9IFN0cmluZyggcmF3X3ZhbHVlIHx8ICcnICkudG9Mb3dlckNhc2UoKTtcclxuXHJcblx0XHRzYWZlX3ZhbHVlID0gc2FmZV92YWx1ZS5yZXBsYWNlKCAvW1xcc1xcLV0rL2csICdfJyApO1xyXG5cdFx0c2FmZV92YWx1ZSA9IHNhZmVfdmFsdWUucmVwbGFjZSggL1teYS16MC05X10vZywgJycgKTtcclxuXHRcdHNhZmVfdmFsdWUgPSBzYWZlX3ZhbHVlLnJlcGxhY2UoIC9fKy9nLCAnXycgKTtcclxuXHRcdHNhZmVfdmFsdWUgPSBzYWZlX3ZhbHVlLnJlcGxhY2UoIC9eXyt8XyskL2csICcnICk7XHJcblxyXG5cdFx0aWYgKCBzYWZlX3ZhbHVlICYmIC9eWzAtOV0vLnRlc3QoIHNhZmVfdmFsdWUgKSApIHtcclxuXHRcdFx0c2FmZV92YWx1ZSA9ICd0b2tlbl8nICsgc2FmZV92YWx1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gc2FmZV92YWx1ZTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNhbml0aXplX3Rva2VuX2tleV9pbnB1dCggaW5wdXRfZWwgKSB7XHJcblx0XHR2YXIgc2FmZV92YWx1ZSA9IHRvX3Rva2VuX2tleSggaW5wdXRfZWwgPyBpbnB1dF9lbC52YWx1ZSA6ICcnICk7XHJcblxyXG5cdFx0aWYgKCAhIGlucHV0X2VsICkge1xyXG5cdFx0XHRyZXR1cm4gJyc7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBpbnB1dF9lbC52YWx1ZSAhPT0gc2FmZV92YWx1ZSApIHtcclxuXHRcdFx0aW5wdXRfZWwudmFsdWUgPSBzYWZlX3ZhbHVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBzYWZlX3ZhbHVlO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZW5zdXJlX3VuaXF1ZV9saW5rX2tleXMoIGxpbmtzX2FyciApIHtcclxuXHRcdHZhciB1c2VkX21hcCAgID0ge307XHJcblx0XHR2YXIgcmVzdWx0X2FyciA9IFtdO1xyXG5cdFx0dmFyIGk7XHJcblx0XHR2YXIgbGlua19vYmo7XHJcblx0XHR2YXIgYmFzZV9rZXkgICA9ICcnO1xyXG5cdFx0dmFyIHVuaXF1ZV9rZXkgPSAnJztcclxuXHRcdHZhciBzdWZmaXhfbnVtID0gMjtcclxuXHJcblx0XHRmb3IgKCBpID0gMDsgaSA8IGxpbmtzX2Fyci5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0bGlua19vYmogICA9IGNsb25lX3ZhbHVlKCBsaW5rc19hcnJbIGkgXSApO1xyXG5cdFx0XHRiYXNlX2tleSAgID0gdG9fdG9rZW5fa2V5KCBsaW5rX29iai5rZXkgfHwgJycgKSB8fCAnbGlua18nICsgU3RyaW5nKCBpICsgMSApO1xyXG5cdFx0XHR1bmlxdWVfa2V5ID0gYmFzZV9rZXk7XHJcblx0XHRcdHN1ZmZpeF9udW0gPSAyO1xyXG5cclxuXHRcdFx0d2hpbGUgKCB1c2VkX21hcFsgdW5pcXVlX2tleSBdICkge1xyXG5cdFx0XHRcdHVuaXF1ZV9rZXkgPSBiYXNlX2tleSArICdfJyArIFN0cmluZyggc3VmZml4X251bSApO1xyXG5cdFx0XHRcdHN1ZmZpeF9udW0rKztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bGlua19vYmoua2V5ID0gdW5pcXVlX2tleTtcclxuXHRcdFx0dXNlZF9tYXBbIHVuaXF1ZV9rZXkgXSA9IHRydWU7XHJcblx0XHRcdHJlc3VsdF9hcnIucHVzaCggbGlua19vYmogKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcmVzdWx0X2FycjtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGJ1aWxkX2xpbmtfbWFwKCBsaW5rc19hcnIgKSB7XHJcblx0XHR2YXIgbWFwX29iaiA9IHt9O1xyXG5cdFx0dmFyIGk7XHJcblx0XHR2YXIgbGlua19vYmo7XHJcblxyXG5cdFx0Zm9yICggaSA9IDA7IGkgPCBsaW5rc19hcnIubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdGxpbmtfb2JqID0gbGlua3NfYXJyWyBpIF07XHJcblx0XHRcdGlmICggbGlua19vYmogJiYgbGlua19vYmoua2V5ICkge1xyXG5cdFx0XHRcdG1hcF9vYmpbIFN0cmluZyggbGlua19vYmoua2V5ICkgXSA9IGxpbmtfb2JqO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIG1hcF9vYmo7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBleHRyYWN0X3NlbnRlbmNlX3Rva2Vucyggc2VudGVuY2UgKSB7XHJcblx0XHR2YXIgdG9rZW5fcmVnZXggPSAvXFx7KFthLXpBLVowLTlfXSspXFx9L2c7XHJcblx0XHR2YXIgdG9rZW5fbWF0Y2g7XHJcblx0XHR2YXIgdG9rZW5zX2FyciA9IGFycmF5KCk7XHJcblx0XHR2YXIgdG9rZW5fa2V5ICA9ICcnO1xyXG5cdFx0dmFyIHVzZWRfbWFwICAgPSB7fTtcclxuXHJcblx0XHR3aGlsZSAoIG51bGwgIT09ICggdG9rZW5fbWF0Y2ggPSB0b2tlbl9yZWdleC5leGVjKCBTdHJpbmcoIHNlbnRlbmNlIHx8ICcnICkgKSApICkge1xyXG5cdFx0XHR0b2tlbl9rZXkgPSBTdHJpbmcoIHRva2VuX21hdGNoWyAxIF0gfHwgJycgKTtcclxuXHRcdFx0aWYgKCB0b2tlbl9rZXkgJiYgISB1c2VkX21hcFsgdG9rZW5fa2V5IF0gKSB7XHJcblx0XHRcdFx0dXNlZF9tYXBbIHRva2VuX2tleSBdID0gdHJ1ZTtcclxuXHRcdFx0XHR0b2tlbnNfYXJyLnB1c2goIHRva2VuX2tleSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRva2Vuc19hcnI7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBlc2NhcGVfaHRtbCggdmFsdWUgKSB7XHJcblx0XHR2YXIgc2FuaXRpemUgPSBjb3JlLldQQkNfQkZCX1Nhbml0aXplIHx8IHt9O1xyXG5cclxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHNhbml0aXplLmVzY2FwZV9odG1sICkge1xyXG5cdFx0XHRyZXR1cm4gc2FuaXRpemUuZXNjYXBlX2h0bWwoIFN0cmluZyggdmFsdWUgfHwgJycgKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBTdHJpbmcoIHZhbHVlIHx8ICcnIClcclxuXHRcdFx0LnJlcGxhY2UoIC8mL2csICcmYW1wOycgKVxyXG5cdFx0XHQucmVwbGFjZSggLzwvZywgJyZsdDsnIClcclxuXHRcdFx0LnJlcGxhY2UoIC8+L2csICcmZ3Q7JyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZXNjYXBlX2F0dHIoIHZhbHVlICkge1xyXG5cdFx0cmV0dXJuIGVzY2FwZV9odG1sKCB2YWx1ZSApLnJlcGxhY2UoIC9cIi9nLCAnJnF1b3Q7JyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZXNjYXBlX2Zvcl9zaG9ydGNvZGUoIHZhbHVlICkge1xyXG5cdFx0dmFyIHNhbml0aXplID0gY29yZS5XUEJDX0JGQl9TYW5pdGl6ZSB8fCB7fTtcclxuXHJcblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiBzYW5pdGl6ZS5lc2NhcGVfZm9yX3Nob3J0Y29kZSApIHtcclxuXHRcdFx0cmV0dXJuIHNhbml0aXplLmVzY2FwZV9mb3Jfc2hvcnRjb2RlKCBTdHJpbmcoIHZhbHVlIHx8ICcnICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gU3RyaW5nKCB2YWx1ZSB8fCAnJyApLnJlcGxhY2UoIC9cIi9nLCAnXFxcXFwiJyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gbm9ybWFsaXplX2FuY2hvcl9ocmVmKCBkZXN0aW5hdGlvbiApIHtcclxuXHRcdHZhciBzYWZlX2Rlc3RpbmF0aW9uID0gU3RyaW5nKCBkZXN0aW5hdGlvbiB8fCAnJyApLnRyaW0oKTtcclxuXHJcblx0XHRpZiAoICEgc2FmZV9kZXN0aW5hdGlvbiApIHtcclxuXHRcdFx0cmV0dXJuICcjJztcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICcjJyA9PT0gc2FmZV9kZXN0aW5hdGlvbi5jaGFyQXQoIDAgKSApIHtcclxuXHRcdFx0cmV0dXJuIHNhZmVfZGVzdGluYXRpb247XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuICcjJyArIHNhZmVfZGVzdGluYXRpb247XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBidWlsZF9zZW50ZW5jZV9leHBvcnRfaHRtbCggc2VudGVuY2UsIGxpbmtzX2FyciApIHtcclxuXHRcdHZhciBodG1sICAgICAgICAgICAgPSAnJztcclxuXHRcdHZhciBsYXN0X2luZGV4ICAgICAgPSAwO1xyXG5cdFx0dmFyIHRva2VuX3JlZ2V4ICAgICA9IC9cXHsoW2EtekEtWjAtOV9dKylcXH0vZztcclxuXHRcdHZhciB0b2tlbl9tYXRjaDtcclxuXHRcdHZhciB0b2tlbl9tYXAgICAgICAgPSBidWlsZF9saW5rX21hcCggbm9ybWFsaXplX2xpbmtzX2NvbGxlY3Rpb24oIGxpbmtzX2FyciwgZmFsc2UgKSApO1xyXG5cdFx0dmFyIHNlbnRlbmNlX3N0cmluZyA9IFN0cmluZyggc2VudGVuY2UgfHwgJycgKTtcclxuXHRcdHZhciB0b2tlbl9rZXkgPSAnJztcclxuXHRcdHZhciBsaW5rX29iaiAgPSBudWxsO1xyXG5cclxuXHRcdHdoaWxlICggbnVsbCAhPT0gKCB0b2tlbl9tYXRjaCA9IHRva2VuX3JlZ2V4LmV4ZWMoIHNlbnRlbmNlX3N0cmluZyApICkgKSB7XHJcblx0XHRcdGh0bWwgKz0gZXNjYXBlX2h0bWwoIHNlbnRlbmNlX3N0cmluZy5zdWJzdHJpbmcoIGxhc3RfaW5kZXgsIHRva2VuX21hdGNoLmluZGV4ICkgKTtcclxuXHJcblx0XHRcdHRva2VuX2tleSA9IFN0cmluZyggdG9rZW5fbWF0Y2hbIDEgXSB8fCAnJyApO1xyXG5cdFx0XHRsaW5rX29iaiAgPSB0b2tlbl9tYXBbIHRva2VuX2tleSBdIHx8IG51bGw7XHJcblxyXG5cdFx0XHRpZiAoIGxpbmtfb2JqICkge1xyXG5cdFx0XHRcdGh0bWwgKz0gYnVpbGRfZXhwb3J0X2xpbmtfaHRtbCggbGlua19vYmogKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRodG1sICs9ICd7JyArIGVzY2FwZV9odG1sKCB0b2tlbl9rZXkgKSArICd9JztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bGFzdF9pbmRleCA9IHRva2VuX21hdGNoLmluZGV4ICsgdG9rZW5fbWF0Y2hbIDAgXS5sZW5ndGg7XHJcblx0XHR9XHJcblxyXG5cdFx0aHRtbCArPSBlc2NhcGVfaHRtbCggc2VudGVuY2Vfc3RyaW5nLnN1YnN0cmluZyggbGFzdF9pbmRleCApICk7XHJcblxyXG5cdFx0cmV0dXJuIGh0bWw7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBidWlsZF9leHBvcnRfbGlua19odG1sKCBsaW5rX29iaiApIHtcclxuXHRcdHZhciBzYWZlX3RleHQgID0gZXNjYXBlX2h0bWwoIGxpbmtfb2JqLnRleHQgfHwgbGlua19vYmoua2V5IHx8ICcnICk7XHJcblx0XHR2YXIgc2FmZV9jbGFzcyA9IFN0cmluZyggbGlua19vYmouY3NzY2xhc3MgfHwgJycgKS50cmltKCk7XHJcblx0XHR2YXIgaHRtbCAgICAgICA9ICcnO1xyXG5cclxuXHRcdGlmICggJ3BvcHVwJyA9PT0gbGlua19vYmoubGlua190eXBlICkge1xyXG5cdFx0XHRodG1sID0gJzxhIGhyZWY9XCIjXCInO1xyXG5cdFx0XHRpZiAoIHNhZmVfY2xhc3MgKSB7XHJcblx0XHRcdFx0aHRtbCArPSAnIGNsYXNzPVwiJyArIGVzY2FwZV9hdHRyKCBzYWZlX2NsYXNzICkgKyAnXCInO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggU3RyaW5nKCBsaW5rX29iai5kZXN0aW5hdGlvbiB8fCAnJyApLnRyaW0oKSApIHtcclxuXHRcdFx0XHRodG1sICs9ICcgZGF0YS1wb3B1cC1pZD1cIicgKyBlc2NhcGVfYXR0ciggbGlua19vYmouZGVzdGluYXRpb24gKSArICdcIic7XHJcblx0XHRcdH1cclxuXHRcdFx0aHRtbCArPSAnPicgKyBzYWZlX3RleHQgKyAnPC9hPic7XHJcblx0XHRcdHJldHVybiBodG1sO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggJ2FuY2hvcicgPT09IGxpbmtfb2JqLmxpbmtfdHlwZSApIHtcclxuXHRcdFx0aHRtbCA9ICc8YSBocmVmPVwiJyArIGVzY2FwZV9hdHRyKCBub3JtYWxpemVfYW5jaG9yX2hyZWYoIGxpbmtfb2JqLmRlc3RpbmF0aW9uICkgKSArICdcIic7XHJcblx0XHRcdGlmICggc2FmZV9jbGFzcyApIHtcclxuXHRcdFx0XHRodG1sICs9ICcgY2xhc3M9XCInICsgZXNjYXBlX2F0dHIoIHNhZmVfY2xhc3MgKSArICdcIic7XHJcblx0XHRcdH1cclxuXHRcdFx0aHRtbCArPSAnPicgKyBzYWZlX3RleHQgKyAnPC9hPic7XHJcblx0XHRcdHJldHVybiBodG1sO1xyXG5cdFx0fVxyXG5cclxuXHRcdGh0bWwgPSAnPGEgaHJlZj1cIicgKyBlc2NhcGVfYXR0ciggbGlua19vYmouZGVzdGluYXRpb24gfHwgJyMnICkgKyAnXCInO1xyXG5cdFx0aWYgKCBzYWZlX2NsYXNzICkge1xyXG5cdFx0XHRodG1sICs9ICcgY2xhc3M9XCInICsgZXNjYXBlX2F0dHIoIHNhZmVfY2xhc3MgKSArICdcIic7XHJcblx0XHR9XHJcblx0XHRpZiAoIFN0cmluZyggbGlua19vYmoudGFyZ2V0IHx8ICcnICkudHJpbSgpICkge1xyXG5cdFx0XHRodG1sICs9ICcgdGFyZ2V0PVwiJyArIGVzY2FwZV9hdHRyKCBsaW5rX29iai50YXJnZXQgKSArICdcIic7XHJcblx0XHR9XHJcblx0XHRpZiAoICdfYmxhbmsnID09PSBTdHJpbmcoIGxpbmtfb2JqLnRhcmdldCB8fCAnJyApICkge1xyXG5cdFx0XHRodG1sICs9ICcgcmVsPVwibm9vcGVuZXIgbm9yZWZlcnJlclwiJztcclxuXHRcdH1cclxuXHRcdGh0bWwgKz0gJz4nICsgc2FmZV90ZXh0ICsgJzwvYT4nO1xyXG5cclxuXHRcdHJldHVybiBodG1sO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdHJpZ2dlcl9pbnB1dF9hbmRfY2hhbmdlKCBpbnB1dF9lbCApIHtcclxuXHRcdHRyeSB7XHJcblx0XHRcdGlucHV0X2VsLmRpc3BhdGNoRXZlbnQoIG5ldyBFdmVudCggJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0gKSApO1xyXG5cdFx0XHRpbnB1dF9lbC5kaXNwYXRjaEV2ZW50KCBuZXcgRXZlbnQoICdjaGFuZ2UnLCB7IGJ1YmJsZXM6IHRydWUgfSApICk7XHJcblx0XHR9IGNhdGNoICggZXJyICkge1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X3Jvd192YWx1ZSggcm93X2VsLCBzZWxlY3RvciApIHtcclxuXHRcdHZhciBmaWVsZF9lbCA9IHJvd19lbCA/IHJvd19lbC5xdWVyeVNlbGVjdG9yKCBzZWxlY3RvciApIDogbnVsbDtcclxuXHRcdHJldHVybiBmaWVsZF9lbCA/IFN0cmluZyggZmllbGRfZWwudmFsdWUgfHwgJycgKSA6ICcnO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYnVpbGRfdG9rZW5faW5zZXJ0X3RleHQoIGlucHV0X2VsLCB0b2tlbl90ZXh0ICkge1xyXG5cdFx0dmFyIGN1cnJlbnRfdmFsdWUgPSBTdHJpbmcoIGlucHV0X2VsICYmIGlucHV0X2VsLnZhbHVlID8gaW5wdXRfZWwudmFsdWUgOiAnJyApO1xyXG5cdFx0dmFyIHN0YXJ0X3BvcyAgICAgPSAoIGlucHV0X2VsICYmICdudW1iZXInID09PSB0eXBlb2YgaW5wdXRfZWwuc2VsZWN0aW9uU3RhcnQgKSA/IGlucHV0X2VsLnNlbGVjdGlvblN0YXJ0IDogY3VycmVudF92YWx1ZS5sZW5ndGg7XHJcblx0XHR2YXIgZW5kX3BvcyAgICAgICA9ICggaW5wdXRfZWwgJiYgJ251bWJlcicgPT09IHR5cGVvZiBpbnB1dF9lbC5zZWxlY3Rpb25FbmQgKSA/IGlucHV0X2VsLnNlbGVjdGlvbkVuZCA6IGN1cnJlbnRfdmFsdWUubGVuZ3RoO1xyXG5cdFx0dmFyIGJlZm9yZV9jaGFyICAgPSBzdGFydF9wb3MgPiAwID8gY3VycmVudF92YWx1ZS5jaGFyQXQoIHN0YXJ0X3BvcyAtIDEgKSA6ICcnO1xyXG5cdFx0dmFyIGFmdGVyX2NoYXIgICAgPSBlbmRfcG9zIDwgY3VycmVudF92YWx1ZS5sZW5ndGggPyBjdXJyZW50X3ZhbHVlLmNoYXJBdCggZW5kX3BvcyApIDogJyc7XHJcblx0XHR2YXIgcHJlZml4ICAgICAgICA9ICcnO1xyXG5cdFx0dmFyIHN1ZmZpeCAgICAgICAgPSAnICc7XHJcblxyXG5cdFx0aWYgKCBiZWZvcmVfY2hhciAmJiAhIC9cXHMvLnRlc3QoIGJlZm9yZV9jaGFyICkgKSB7XHJcblx0XHRcdHByZWZpeCA9ICcgJztcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGFmdGVyX2NoYXIgJiYgL1xccy8udGVzdCggYWZ0ZXJfY2hhciApICkge1xyXG5cdFx0XHRzdWZmaXggPSAnJztcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcHJlZml4ICsgdG9rZW5fdGV4dCArIHN1ZmZpeDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGluc2VydF90ZXh0X2F0X2N1cnNvciggaW5wdXRfZWwsIGluc2VydF90ZXh0ICkge1xyXG5cdFx0dmFyIHN0YXJ0X3BvcyAgID0gaW5wdXRfZWwuc2VsZWN0aW9uU3RhcnQ7XHJcblx0XHR2YXIgZW5kX3BvcyAgICAgPSBpbnB1dF9lbC5zZWxlY3Rpb25FbmQ7XHJcblx0XHR2YXIgYmVmb3JlX3RleHQgPSBTdHJpbmcoIGlucHV0X2VsLnZhbHVlIHx8ICcnICkuc3Vic3RyaW5nKCAwLCBzdGFydF9wb3MgKTtcclxuXHRcdHZhciBhZnRlcl90ZXh0ICA9IFN0cmluZyggaW5wdXRfZWwudmFsdWUgfHwgJycgKS5zdWJzdHJpbmcoIGVuZF9wb3MgKTtcclxuXHJcblx0XHRpbnB1dF9lbC52YWx1ZSA9IGJlZm9yZV90ZXh0ICsgaW5zZXJ0X3RleHQgKyBhZnRlcl90ZXh0O1xyXG5cdFx0aW5wdXRfZWwuc2VsZWN0aW9uU3RhcnQgPSBpbnB1dF9lbC5zZWxlY3Rpb25FbmQgPSBzdGFydF9wb3MgKyBpbnNlcnRfdGV4dC5sZW5ndGg7XHJcblx0XHRpbnB1dF9lbC5mb2N1cygpO1xyXG5cdH1cclxufSkoIHdpbmRvdyApOyJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMsVUFBV0EsQ0FBQyxFQUFHO0VBQ2YsWUFBWTs7RUFFWixJQUFJQyxJQUFJLEdBQU9ELENBQUMsQ0FBQ0UsYUFBYSxJQUFJLENBQUMsQ0FBQztFQUNwQyxJQUFJQyxRQUFRLEdBQUdGLElBQUksQ0FBQ0csZ0NBQWdDLElBQUksSUFBSTtFQUU1RCxJQUFLLENBQUVELFFBQVEsSUFBSSxVQUFVLEtBQUssT0FBT0EsUUFBUSxDQUFDRSxRQUFRLEVBQUc7SUFDNUQsSUFBS0wsQ0FBQyxDQUFDTSxLQUFLLElBQUlOLENBQUMsQ0FBQ00sS0FBSyxDQUFDQyxHQUFHLElBQUksVUFBVSxLQUFLLE9BQU9QLENBQUMsQ0FBQ00sS0FBSyxDQUFDQyxHQUFHLENBQUNDLEtBQUssRUFBRztNQUN4RVIsQ0FBQyxDQUFDTSxLQUFLLENBQUNDLEdBQUcsQ0FBQ0MsS0FBSyxDQUFFLDZCQUE2QixFQUFFLGtCQUFtQixDQUFDO0lBQ3ZFO0lBQ0E7RUFDRDtFQUVBLE1BQU1DLDJCQUEyQixDQUFDO0lBRWpDLE9BQU9DLFdBQVcsR0FBRyw2QkFBNkI7O0lB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
