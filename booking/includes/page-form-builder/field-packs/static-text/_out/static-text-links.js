"use strict";

/**
 * WPBC BFB Static Text link-token editor and renderer helpers.
 *
 * @since 11.8.5
 */
(function (w, d) {
  'use strict';

  var core = w.WPBC_BFB_Core || {};
  var boot = w.WPBC_BFB_Static_Text_Links_Boot || {};

  /**
   * Return an empty array without relying on an Array constructor alias.
   *
   * @return {Array} Empty array.
   */
  function array() {
    return [];
  }

  /**
   * Return a localized editor string with a deterministic fallback.
   *
   * @param {string} key      Localization key.
   * @param {string} fallback English fallback.
   *
   * @return {string} Localized or fallback string.
   */
  function get_text(key, fallback) {
    return String(boot[key] || fallback || '');
  }

  /**
   * Escape text for HTML content.
   *
   * @param {*} raw_value Candidate value.
   *
   * @return {string} HTML-safe text.
   */
  function escape_html(raw_value) {
    var sanitize = core.WPBC_BFB_Sanitize || {};
    if ('function' === typeof sanitize.escape_html) {
      return sanitize.escape_html(String(raw_value || ''));
    }
    return String(raw_value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  /**
   * Escape text for an HTML attribute.
   *
   * @param {*} raw_value Candidate value.
   *
   * @return {string} Attribute-safe text.
   */
  function escape_attr(raw_value) {
    return escape_html(raw_value);
  }

  /**
   * Clone JSON-safe field data.
   *
   * @param {*} source_value Candidate value.
   *
   * @return {*} Cloned value, or the original value when cloning fails.
   */
  function clone_value(source_value) {
    try {
      return JSON.parse(JSON.stringify(source_value));
    } catch (err) {
      return source_value;
    }
  }

  /**
   * Convert a candidate token key to the supported brace-token grammar.
   *
   * @param {*} raw_value Candidate token key.
   *
   * @return {string} Normalized token key.
   */
  function normalize_token_key(raw_value) {
    var safe_value = String(raw_value || '').toLowerCase().slice(0, 64);
    safe_value = safe_value.replace(/[\s\-]+/g, '_');
    safe_value = safe_value.replace(/[^a-z0-9_]/g, '');
    safe_value = safe_value.replace(/_+/g, '_');
    return safe_value.replace(/^_+|_+$/g, '');
  }

  /**
   * Normalize a link type to an editor-supported value.
   *
   * @param {*} raw_type Candidate link type.
   *
   * @return {string} `url` or `anchor`.
   */
  function normalize_link_type(raw_type) {
    return 'anchor' === String(raw_type || '') ? 'anchor' : 'url';
  }

  /**
   * Normalize a link target to an allow-listed value.
   *
   * @param {*} raw_target Candidate target.
   *
   * @return {string} `_self` or `_blank`.
   */
  function normalize_target(raw_target) {
    return '_self' === String(raw_target || '') ? '_self' : '_blank';
  }

  /**
   * Normalize a space-delimited CSS class list.
   *
   * @param {*} raw_classes Candidate class list.
   *
   * @return {string} Sanitized class list.
   */
  function normalize_css_classes(raw_classes) {
    var sanitize = core.WPBC_BFB_Sanitize || {};
    var classes = String(raw_classes || '').slice(0, 200);
    if ('function' === typeof sanitize.sanitize_css_classlist) {
      return sanitize.sanitize_css_classlist(classes);
    }
    return classes.split(/\s+/).map(function (class_name) {
      return class_name.replace(/[^A-Za-z0-9_-]/g, '');
    }).filter(Boolean).join(' ');
  }

  /**
   * Normalize one URL or anchor destination for safe browser rendering.
   *
   * WordPress performs the authoritative save-time URL filtering. This client
   * check prevents executable schemes from entering Builder preview markup.
   *
   * @param {*}      raw_destination Candidate destination.
   * @param {string} link_type       Normalized link type.
   *
   * @return {string} Safe destination, or an empty string when rejected.
   */
  function normalize_destination(raw_destination, link_type) {
    var destination = String(raw_destination || '').trim().slice(0, 2048);
    var compact_url;
    var scheme_match;
    var allowed_schemes = {
      http: true,
      https: true,
      mailto: true,
      tel: true,
      ftp: true,
      ftps: true
    };
    if ('anchor' === link_type) {
      return destination.replace(/^#+/, '').replace(/[^A-Za-z0-9_:\-.]/g, '');
    }
    compact_url = destination.replace(/[\x00-\x20\x7f]+/g, '');
    scheme_match = compact_url.match(/^([a-z][a-z0-9+.-]*):/i);
    if (scheme_match && !allowed_schemes[String(scheme_match[1] || '').toLowerCase()]) {
      return '';
    }
    return destination;
  }

  /**
   * Normalize one executable-free link definition.
   *
   * @param {*}      raw_link Candidate definition.
   * @param {number} index    Zero-based fallback index.
   *
   * @return {Object} Normalized definition.
   */
  function normalize_link(raw_link, index) {
    var link_obj = raw_link && 'object' === typeof raw_link ? raw_link : {};
    var fallback_key = 'link_' + String(index + 1);
    var token_key = normalize_token_key(link_obj.key || '') || fallback_key;
    var link_type = normalize_link_type(link_obj.link_type);
    var visible_text = String(link_obj.text || '').trim().slice(0, 300);
    return {
      key: token_key,
      text: visible_text || token_key.replace(/_/g, ' '),
      link_type: link_type,
      destination: normalize_destination(link_obj.destination, link_type),
      target: normalize_target(link_obj.target),
      cssclass: normalize_css_classes(link_obj.cssclass)
    };
  }

  /**
   * Normalize an ordered link collection and make token keys unique.
   *
   * @param {*} raw_links Candidate array or JSON string.
   *
   * @return {Array} Normalized ordered definitions.
   */
  function normalize_links(raw_links) {
    var parsed_links = raw_links;
    var links = array();
    var used_keys = {};
    var index;
    if ('string' === typeof parsed_links) {
      try {
        parsed_links = JSON.parse(parsed_links);
      } catch (err) {
        parsed_links = array();
      }
    }
    if (!Array.isArray(parsed_links)) {
      return links;
    }
    for (index = 0; index < parsed_links.length && index < 20; index++) {
      var normalized_link = normalize_link(parsed_links[index], index);
      var base_key = normalized_link.key;
      var key_suffix = 2;
      while (used_keys[normalized_link.key]) {
        normalized_link.key = base_key.slice(0, 60) + '_' + String(key_suffix);
        key_suffix++;
      }
      used_keys[normalized_link.key] = true;
      links.push(normalized_link);
    }
    return links;
  }

  /**
   * Extract unique brace tokens from Static Text content.
   *
   * @param {*} raw_text Candidate content.
   *
   * @return {Array} Unique token keys in source order.
   */
  function extract_tokens(raw_text) {
    var token_regex = /\{([a-zA-Z0-9_]+)\}/g;
    var token_match;
    var tokens = array();
    var used_keys = {};
    while (null !== (token_match = token_regex.exec(String(raw_text || '')))) {
      var token_key = normalize_token_key(token_match[1]);
      if (token_key && !used_keys[token_key]) {
        used_keys[token_key] = true;
        tokens.push(token_key);
      }
    }
    return tokens;
  }

  /**
   * Build a key-indexed link map.
   *
   * @param {Array} links Normalized definitions.
   *
   * @return {Object} Definition map.
   */
  function build_link_map(links) {
    var link_map = {};
    var index;
    for (index = 0; index < links.length; index++) {
      link_map[links[index].key] = links[index];
    }
    return link_map;
  }

  /**
   * Build one escaped link for Builder preview or exported form markup.
   *
   * @param {Object}  link_obj   Normalized link definition.
   * @param {boolean} preview_only Whether clicks must be disabled in Builder.
   *
   * @return {string} Escaped anchor HTML.
   */
  function build_link_html(link_obj, preview_only) {
    var visible_text = escape_html(link_obj.text || link_obj.key || '');
    var classes = 'wpbc_bfb__static_text_link';
    var destination = normalize_destination(link_obj.destination, link_obj.link_type);
    var html;
    if (link_obj.cssclass) {
      classes += ' ' + normalize_css_classes(link_obj.cssclass);
    }
    if ('anchor' === link_obj.link_type) {
      destination = destination ? '#' + destination : '#';
    } else if (!destination) {
      destination = '#';
    }
    if (preview_only) {
      html = '<a class="' + escape_attr(classes) + '" aria-disabled="true" tabindex="-1"';
    } else {
      html = '<a href="' + escape_attr(destination) + '" class="' + escape_attr(classes) + '"';
    }
    if (!preview_only && 'url' === link_obj.link_type) {
      html += ' target="' + escape_attr(normalize_target(link_obj.target)) + '"';
      if ('_blank' === normalize_target(link_obj.target)) {
        html += ' rel="noopener noreferrer"';
      }
    }
    return html + '>' + visible_text + '</a>';
  }

  /**
   * Render Static Text content with link-token replacements.
   *
   * @param {*}       raw_text     Static Text content.
   * @param {*}       raw_links    Link definitions.
   * @param {Object}  options      Rendering options.
   * @param {boolean} options.allow_html Preserve legacy basic-HTML behavior.
   * @param {boolean} options.nl2br Convert new lines when HTML is not allowed.
   * @param {boolean} options.preview_only Disable link clicks in Builder.
   *
   * @return {string} Rendered HTML with escaped links and text.
   */
  function build_content_html(raw_text, raw_links, options) {
    var settings = options || {};
    var source_text = String(raw_text || '');
    var normalized = normalize_links(raw_links);
    var link_map = build_link_map(normalized);
    var token_regex = /\{([a-zA-Z0-9_]+)\}/g;
    var token_match;
    var last_index = 0;
    var rendered_html = '';

    /**
     * Render one non-token source segment with the field's legacy text rules.
     *
     * @param {string} text_segment Source segment.
     *
     * @return {string} Rendered segment.
     */
    function render_text_segment(text_segment) {
      var rendered_segment = settings.allow_html ? text_segment : escape_html(text_segment);
      if (!settings.allow_html && settings.nl2br) {
        rendered_segment = rendered_segment.replace(/\n/g, '<br>');
      }
      return rendered_segment;
    }
    while (null !== (token_match = token_regex.exec(source_text))) {
      var token_key = normalize_token_key(token_match[1]);
      rendered_html += render_text_segment(source_text.substring(last_index, token_match.index));
      if (token_key && link_map[token_key]) {
        rendered_html += build_link_html(link_map[token_key], !!settings.preview_only);
      } else {
        rendered_html += render_text_segment(token_match[0]);
      }
      last_index = token_match.index + token_match[0].length;
    }
    rendered_html += render_text_segment(source_text.substring(last_index));
    return rendered_html;
  }

  /**
   * Create a DOM element using textContent for visible text.
   *
   * @param {string} tag_name Element name.
   * @param {Object} attrs    Attribute map.
   * @param {string} text     Optional text.
   *
   * @return {HTMLElement} Created element.
   */
  function create_element(tag_name, attrs, text) {
    var element = d.createElement(tag_name);
    var attr_name;
    for (attr_name in attrs || {}) {
      if (Object.prototype.hasOwnProperty.call(attrs, attr_name)) {
        element.setAttribute(attr_name, attrs[attr_name]);
      }
    }
    if (undefined !== text) {
      element.textContent = text;
    }
    return element;
  }

  /**
   * Dispatch an Inspector input event after the hidden JSON writer changes.
   *
   * @param {HTMLElement} writer Hidden Inspector writer.
   *
   * @return {void}
   */
  function dispatch_writer_input(writer) {
    var input_event;
    try {
      input_event = new w.Event('input', {
        bubbles: true
      });
    } catch (err) {
      input_event = d.createEvent('Event');
      input_event.initEvent('input', true, false);
    }
    writer.dispatchEvent(input_event);
  }

  /**
   * Insert a token at the current cursor position in the Static Text input.
   *
   * @param {HTMLTextAreaElement} text_input Static Text control.
   * @param {string}              token_key  Normalized token key.
   *
   * @return {void}
   */
  function insert_token_at_cursor(text_input, token_key) {
    var token_text = '{' + token_key + '}';
    var start = Number.isInteger(text_input.selectionStart) ? text_input.selectionStart : text_input.value.length;
    var end = Number.isInteger(text_input.selectionEnd) ? text_input.selectionEnd : start;
    text_input.value = text_input.value.substring(0, start) + token_text + text_input.value.substring(end);
    text_input.focus();
    text_input.setSelectionRange(start + token_text.length, start + token_text.length);
    dispatch_writer_input(text_input);
  }

  /**
   * Render the Static Text link-definition Factory slot.
   *
   * @param {HTMLElement} slot_host Inspector slot host.
   * @param {Object}      context   Inspector context with selected field data.
   *
   * @return {void}
   */
  function render_editor_slot(slot_host, context) {
    var field_data = context && context.data ? context.data : {};
    var links = normalize_links(field_data.links);
    var editor = create_element('div', {
      'class': 'wpbc_bfb__static_text_links_editor'
    });
    var token_list = create_element('div', {
      'class': 'wpbc_bfb__static_text_link_tokens'
    });
    var help = create_element('p', {
      'class': 'wpbc_bfb__help'
    }, get_text('links_help', 'Use tokens inside braces, for example: {terms} or {privacy_policy}.'));
    var status = create_element('p', {
      'class': 'wpbc_bfb__help wpbc_bfb__static_text_link_status',
      'aria-live': 'polite'
    });
    var rows_list = create_element('div', {
      'class': 'wpbc_bfb__static_text_links_list'
    });
    var add_button = create_element('button', {
      'type': 'button',
      'class': 'button button-secondary'
    }, get_text('add_link', 'Add link'));
    var toolbar = create_element('div', {
      'class': 'wpbc_bfb__static_text_links_toolbar'
    });
    var writer = create_element('textarea', {
      'class': 'inspector__input',
      'data-inspector-key': 'links',
      'hidden': 'hidden'
    });
    var panel = slot_host.closest('#wpbc_bfb__inspector') || slot_host.closest('.wpbc_bfb__inspector');
    var text_input = panel ? panel.querySelector('textarea[data-inspector-key="text"]') : null;
    writer.value = JSON.stringify(links);
    toolbar.appendChild(add_button);
    editor.appendChild(token_list);
    editor.appendChild(help);
    editor.appendChild(status);
    editor.appendChild(rows_list);
    editor.appendChild(toolbar);
    editor.appendChild(writer);
    slot_host.appendChild(editor);

    /**
     * Persist normalized editor state through the standard Inspector writer.
     *
     * @return {void}
     */
    function commit_links() {
      links = normalize_links(links);
      writer.value = JSON.stringify(links);
      dispatch_writer_input(writer);
      render_tokens_and_status();
    }

    /**
     * Return missing token definitions for the current Static Text content.
     *
     * @return {Array} Missing token keys.
     */
    function get_missing_tokens() {
      var source_tokens = extract_tokens(text_input ? text_input.value : '');
      var link_map = build_link_map(normalize_links(links));
      return source_tokens.filter(function (token_key) {
        return !link_map[token_key];
      });
    }

    /**
     * Render token insertion buttons and current validation guidance.
     *
     * @return {void}
     */
    function render_tokens_and_status() {
      var normalized_links = normalize_links(links);
      var missing_tokens = get_missing_tokens();
      token_list.textContent = '';
      normalized_links.forEach(function (link_obj) {
        var token_button = create_element('button', {
          'type': 'button',
          'class': 'button button-secondary button-small'
        }, '{' + link_obj.key + '}');
        token_button.addEventListener('click', function () {
          if (text_input) {
            insert_token_at_cursor(text_input, link_obj.key);
          }
        });
        token_list.appendChild(token_button);
      });
      if (missing_tokens.length) {
        status.textContent = get_text('missing_definitions', 'Add a link definition for: %s').replace('%s', missing_tokens.map(function (key) {
          return '{' + key + '}';
        }).join(', '));
      } else if (!normalized_links.length) {
        status.textContent = get_text('no_links', 'Add a link definition, then insert its token into the text.');
      } else {
        status.textContent = '';
      }
    }

    /**
     * Build one labeled link-definition control.
     *
     * @param {string}      label_text Control label.
     * @param {HTMLElement} control    Form control.
     *
     * @return {HTMLElement} Control wrapper.
     */
    function build_labeled_control(label_text, control) {
      var wrapper = create_element('label', {
        'class': 'wpbc_bfb__static_text_link_control'
      });
      wrapper.appendChild(create_element('span', {
        'class': 'wpbc_bfb__static_text_link_label'
      }, label_text));
      wrapper.appendChild(control);
      return wrapper;
    }

    /**
     * Render every editable definition row from current state.
     *
     * @return {void}
     */
    function render_rows() {
      links = normalize_links(links);
      rows_list.textContent = '';
      links.forEach(function (link_obj, row_index) {
        var row = create_element('div', {
          'class': 'wpbc_bfb__static_text_link_row'
        });
        var key_input = create_element('input', {
          'type': 'text',
          'maxlength': '64',
          'value': link_obj.key
        });
        var text_control = create_element('input', {
          'type': 'text',
          'maxlength': '300',
          'value': link_obj.text
        });
        var type_select = create_element('select');
        var destination_input = create_element('input', {
          'type': 'text',
          'maxlength': '2048',
          'value': link_obj.destination
        });
        var target_select = create_element('select');
        var css_input = create_element('input', {
          'type': 'text',
          'maxlength': '200',
          'value': link_obj.cssclass
        });
        var actions = create_element('div', {
          'class': 'wpbc_bfb__static_text_link_actions'
        });
        var duplicate_button = create_element('button', {
          'type': 'button',
          'class': 'button button-secondary button-small'
        }, get_text('duplicate', 'Duplicate'));
        var remove_button = create_element('button', {
          'type': 'button',
          'class': 'button button-link-delete button-small'
        }, get_text('remove', 'Remove'));
        type_select.appendChild(create_element('option', {
          'value': 'url'
        }, get_text('url', 'URL')));
        type_select.appendChild(create_element('option', {
          'value': 'anchor'
        }, get_text('anchor', 'Anchor')));
        type_select.value = link_obj.link_type;
        target_select.appendChild(create_element('option', {
          'value': '_self'
        }, '_self'));
        target_select.appendChild(create_element('option', {
          'value': '_blank'
        }, '_blank'));
        target_select.value = link_obj.target;
        target_select.disabled = 'anchor' === link_obj.link_type;
        key_input.addEventListener('input', function () {
          key_input.value = normalize_token_key(key_input.value);
          links[row_index].key = key_input.value || 'link_' + String(row_index + 1);
          commit_links();
        });
        text_control.addEventListener('input', function () {
          links[row_index].text = text_control.value;
          commit_links();
        });
        type_select.addEventListener('change', function () {
          links[row_index].link_type = normalize_link_type(type_select.value);
          target_select.disabled = 'anchor' === links[row_index].link_type;
          commit_links();
        });
        destination_input.addEventListener('input', function () {
          links[row_index].destination = destination_input.value;
          commit_links();
        });
        target_select.addEventListener('change', function () {
          links[row_index].target = normalize_target(target_select.value);
          commit_links();
        });
        css_input.addEventListener('input', function () {
          links[row_index].cssclass = css_input.value;
          commit_links();
        });
        duplicate_button.addEventListener('click', function () {
          links.splice(row_index + 1, 0, clone_value(links[row_index]));
          links = normalize_links(links);
          render_rows();
          commit_links();
        });
        remove_button.addEventListener('click', function () {
          links.splice(row_index, 1);
          render_rows();
          commit_links();
        });
        row.appendChild(build_labeled_control(get_text('token_key', 'Token Key'), key_input));
        row.appendChild(build_labeled_control(get_text('visible_text', 'Text'), text_control));
        row.appendChild(build_labeled_control(get_text('link_type', 'Type'), type_select));
        row.appendChild(build_labeled_control(get_text('destination', 'Destination'), destination_input));
        row.appendChild(build_labeled_control(get_text('target', 'Target'), target_select));
        row.appendChild(build_labeled_control(get_text('css_class', 'CSS class'), css_input));
        actions.appendChild(duplicate_button);
        actions.appendChild(remove_button);
        row.appendChild(actions);
        rows_list.appendChild(row);
      });
    }
    add_button.addEventListener('click', function () {
      var missing_tokens = get_missing_tokens();
      var next_key = missing_tokens.length ? missing_tokens[0] : 'link_' + String(links.length + 1);
      links.push({
        key: next_key,
        text: next_key.replace(/_/g, ' '),
        link_type: 'url',
        destination: '',
        target: '_blank',
        cssclass: ''
      });
      render_rows();
      commit_links();
    });
    if (text_input) {
      text_input.addEventListener('input', render_tokens_and_status);
    }
    render_rows();
    render_tokens_and_status();
  }

  /**
   * Register the Static Text link editor with the Inspector Factory.
   *
   * @return {void}
   */
  function register_editor_slot() {
    w.wpbc_bfb_inspector_factory_slots = w.wpbc_bfb_inspector_factory_slots || {};
    w.wpbc_bfb_inspector_factory_slots.static_text_links = render_editor_slot;
  }
  w.WPBC_BFB_Static_Text_Links = {
    build_content_html: build_content_html,
    extract_tokens: extract_tokens,
    normalize_destination: normalize_destination,
    normalize_links: normalize_links,
    normalize_token_key: normalize_token_key,
    register_editor_slot: register_editor_slot
  };
  register_editor_slot();
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3Mvc3RhdGljLXRleHQvX291dC9zdGF0aWMtdGV4dC1saW5rcy5qcyIsIm5hbWVzIjpbInciLCJkIiwiY29yZSIsIldQQkNfQkZCX0NvcmUiLCJib290IiwiV1BCQ19CRkJfU3RhdGljX1RleHRfTGlua3NfQm9vdCIsImFycmF5IiwiZ2V0X3RleHQiLCJrZXkiLCJmYWxsYmFjayIsIlN0cmluZyIsImVzY2FwZV9odG1sIiwicmF3X3ZhbHVlIiwic2FuaXRpemUiLCJXUEJDX0JGQl9TYW5pdGl6ZSIsInJlcGxhY2UiLCJlc2NhcGVfYXR0ciIsImNsb25lX3ZhbHVlIiwic291cmNlX3ZhbHVlIiwiSlNPTiIsInBhcnNlIiwic3RyaW5naWZ5IiwiZXJyIiwibm9ybWFsaXplX3Rva2VuX2tleSIsInNhZmVfdmFsdWUiLCJ0b0xvd2VyQ2FzZSIsInNsaWNlIiwibm9ybWFsaXplX2xpbmtfdHlwZSIsInJhd190eXBlIiwibm9ybWFsaXplX3RhcmdldCIsInJhd190YXJnZXQiLCJub3JtYWxpemVfY3NzX2NsYXNzZXMiLCJyYXdfY2xhc3NlcyIsImNsYXNzZXMiLCJzYW5pdGl6ZV9jc3NfY2xhc3NsaXN0Iiwic3BsaXQiLCJtYXAiLCJjbGFzc19uYW1lIiwiZmlsdGVyIiwiQm9vbGVhbiIsImpvaW4iLCJub3JtYWxpemVfZGVzdGluYXRpb24iLCJyYXdfZGVzdGluYXRpb24iLCJsaW5rX3R5cGUiLCJkZXN0aW5hdGlvbiIsInRyaW0iLCJjb21wYWN0X3VybCIsInNjaGVtZV9tYXRjaCIsImFsbG93ZWRfc2NoZW1lcyIsImh0dHAiLCJodHRwcyIsIm1haWx0byIsInRlbCIsImZ0cCIsImZ0cHMiLCJtYXRjaCIsIm5vcm1hbGl6ZV9saW5rIiwicmF3X2xpbmsiLCJpbmRleCIsImxpbmtfb2JqIiwiZmFsbGJhY2tfa2V5IiwidG9rZW5fa2V5IiwidmlzaWJsZV90ZXh0IiwidGV4dCIsInRhcmdldCIsImNzc2NsYXNzIiwibm9ybWFsaXplX2xpbmtzIiwicmF3X2xpbmtzIiwicGFyc2VkX2xpbmtzIiwibGlua3MiLCJ1c2VkX2tleXMiLCJBcnJheSIsImlzQXJyYXkiLCJsZW5ndGgiLCJub3JtYWxpemVkX2xpbmsiLCJiYXNlX2tleSIsImtleV9zdWZmaXgiLCJwdXNoIiwiZXh0cmFjdF90b2tlbnMiLCJyYXdfdGV4dCIsInRva2VuX3JlZ2V4IiwidG9rZW5fbWF0Y2giLCJ0b2tlbnMiLCJleGVjIiwiYnVpbGRfbGlua19tYXAiLCJsaW5rX21hcCIsImJ1aWxkX2xpbmtfaHRtbCIsInByZXZpZXdfb25seSIsImh0bWwiLCJidWlsZF9jb250ZW50X2h0bWwiLCJvcHRpb25zIiwic2V0dGluZ3MiLCJzb3VyY2VfdGV4dCIsIm5vcm1hbGl6ZWQiLCJsYXN0X2luZGV4IiwicmVuZGVyZWRfaHRtbCIsInJlbmRlcl90ZXh0X3NlZ21lbnQiLCJ0ZXh0X3NlZ21lbnQiLCJyZW5kZXJlZF9zZWdtZW50IiwiYWxsb3dfaHRtbCIsIm5sMmJyIiwic3Vic3RyaW5nIiwiY3JlYXRlX2VsZW1lbnQiLCJ0YWdfbmFtZSIsImF0dHJzIiwiZWxlbWVudCIsImNyZWF0ZUVsZW1lbnQiLCJhdHRyX25hbWUiLCJPYmplY3QiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJzZXRBdHRyaWJ1dGUiLCJ1bmRlZmluZWQiLCJ0ZXh0Q29udGVudCIsImRpc3BhdGNoX3dyaXRlcl9pbnB1dCIsIndyaXRlciIsImlucHV0X2V2ZW50IiwiRXZlbnQiLCJidWJibGVzIiwiY3JlYXRlRXZlbnQiLCJpbml0RXZlbnQiLCJkaXNwYXRjaEV2ZW50IiwiaW5zZXJ0X3Rva2VuX2F0X2N1cnNvciIsInRleHRfaW5wdXQiLCJ0b2tlbl90ZXh0Iiwic3RhcnQiLCJOdW1iZXIiLCJpc0ludGVnZXIiLCJzZWxlY3Rpb25TdGFydCIsInZhbHVlIiwiZW5kIiwic2VsZWN0aW9uRW5kIiwiZm9jdXMiLCJzZXRTZWxlY3Rpb25SYW5nZSIsInJlbmRlcl9lZGl0b3Jfc2xvdCIsInNsb3RfaG9zdCIsImNvbnRleHQiLCJmaWVsZF9kYXRhIiwiZGF0YSIsImVkaXRvciIsInRva2VuX2xpc3QiLCJoZWxwIiwic3RhdHVzIiwicm93c19saXN0IiwiYWRkX2J1dHRvbiIsInRvb2xiYXIiLCJwYW5lbCIsImNsb3Nlc3QiLCJxdWVyeVNlbGVjdG9yIiwiYXBwZW5kQ2hpbGQiLCJjb21taXRfbGlua3MiLCJyZW5kZXJfdG9rZW5zX2FuZF9zdGF0dXMiLCJnZXRfbWlzc2luZ190b2tlbnMiLCJzb3VyY2VfdG9rZW5zIiwibm9ybWFsaXplZF9saW5rcyIsIm1pc3NpbmdfdG9rZW5zIiwiZm9yRWFjaCIsInRva2VuX2J1dHRvbiIsImFkZEV2ZW50TGlzdGVuZXIiLCJidWlsZF9sYWJlbGVkX2NvbnRyb2wiLCJsYWJlbF90ZXh0IiwiY29udHJvbCIsIndyYXBwZXIiLCJyZW5kZXJfcm93cyIsInJvd19pbmRleCIsInJvdyIsImtleV9pbnB1dCIsInRleHRfY29udHJvbCIsInR5cGVfc2VsZWN0IiwiZGVzdGluYXRpb25faW5wdXQiLCJ0YXJnZXRfc2VsZWN0IiwiY3NzX2lucHV0IiwiYWN0aW9ucyIsImR1cGxpY2F0ZV9idXR0b24iLCJyZW1vdmVfYnV0dG9uIiwiZGlzYWJsZWQiLCJzcGxpY2UiLCJuZXh0X2tleSIsInJlZ2lzdGVyX2VkaXRvcl9zbG90Iiwid3BiY19iZmJfaW5zcGVjdG9yX2ZhY3Rvcnlfc2xvdHMiLCJzdGF0aWNfdGV4dF9saW5rcyIsIldQQkNfQkZCX1N0YXRpY19UZXh0X0xpbmtzIiwid2luZG93IiwiZG9jdW1lbnQiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9maWVsZC1wYWNrcy9zdGF0aWMtdGV4dC9fc3JjL3N0YXRpYy10ZXh0LWxpbmtzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogV1BCQyBCRkIgU3RhdGljIFRleHQgbGluay10b2tlbiBlZGl0b3IgYW5kIHJlbmRlcmVyIGhlbHBlcnMuXG4gKlxuICogQHNpbmNlIDExLjguNVxuICovXG4oZnVuY3Rpb24gKCB3LCBkICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIGNvcmUgPSB3LldQQkNfQkZCX0NvcmUgfHwge307XG5cdHZhciBib290ID0gdy5XUEJDX0JGQl9TdGF0aWNfVGV4dF9MaW5rc19Cb290IHx8IHt9O1xuXG5cdC8qKlxuXHQgKiBSZXR1cm4gYW4gZW1wdHkgYXJyYXkgd2l0aG91dCByZWx5aW5nIG9uIGFuIEFycmF5IGNvbnN0cnVjdG9yIGFsaWFzLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtBcnJheX0gRW1wdHkgYXJyYXkuXG5cdCAqL1xuXHRmdW5jdGlvbiBhcnJheSgpIHtcblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIGEgbG9jYWxpemVkIGVkaXRvciBzdHJpbmcgd2l0aCBhIGRldGVybWluaXN0aWMgZmFsbGJhY2suXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgICAgICBMb2NhbGl6YXRpb24ga2V5LlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZmFsbGJhY2sgRW5nbGlzaCBmYWxsYmFjay5cblx0ICpcblx0ICogQHJldHVybiB7c3RyaW5nfSBMb2NhbGl6ZWQgb3IgZmFsbGJhY2sgc3RyaW5nLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X3RleHQoIGtleSwgZmFsbGJhY2sgKSB7XG5cdFx0cmV0dXJuIFN0cmluZyggYm9vdFsga2V5IF0gfHwgZmFsbGJhY2sgfHwgJycgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBFc2NhcGUgdGV4dCBmb3IgSFRNTCBjb250ZW50LlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IHJhd192YWx1ZSBDYW5kaWRhdGUgdmFsdWUuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gSFRNTC1zYWZlIHRleHQuXG5cdCAqL1xuXHRmdW5jdGlvbiBlc2NhcGVfaHRtbCggcmF3X3ZhbHVlICkge1xuXHRcdHZhciBzYW5pdGl6ZSA9IGNvcmUuV1BCQ19CRkJfU2FuaXRpemUgfHwge307XG5cblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiBzYW5pdGl6ZS5lc2NhcGVfaHRtbCApIHtcblx0XHRcdHJldHVybiBzYW5pdGl6ZS5lc2NhcGVfaHRtbCggU3RyaW5nKCByYXdfdmFsdWUgfHwgJycgKSApO1xuXHRcdH1cblxuXHRcdHJldHVybiBTdHJpbmcoIHJhd192YWx1ZSB8fCAnJyApXG5cdFx0XHQucmVwbGFjZSggLyYvZywgJyZhbXA7JyApXG5cdFx0XHQucmVwbGFjZSggLzwvZywgJyZsdDsnIClcblx0XHRcdC5yZXBsYWNlKCAvPi9nLCAnJmd0OycgKVxuXHRcdFx0LnJlcGxhY2UoIC9cIi9nLCAnJnF1b3Q7JyApXG5cdFx0XHQucmVwbGFjZSggLycvZywgJyYjMDM5OycgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBFc2NhcGUgdGV4dCBmb3IgYW4gSFRNTCBhdHRyaWJ1dGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gcmF3X3ZhbHVlIENhbmRpZGF0ZSB2YWx1ZS5cblx0ICpcblx0ICogQHJldHVybiB7c3RyaW5nfSBBdHRyaWJ1dGUtc2FmZSB0ZXh0LlxuXHQgKi9cblx0ZnVuY3Rpb24gZXNjYXBlX2F0dHIoIHJhd192YWx1ZSApIHtcblx0XHRyZXR1cm4gZXNjYXBlX2h0bWwoIHJhd192YWx1ZSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIENsb25lIEpTT04tc2FmZSBmaWVsZCBkYXRhLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IHNvdXJjZV92YWx1ZSBDYW5kaWRhdGUgdmFsdWUuXG5cdCAqXG5cdCAqIEByZXR1cm4geyp9IENsb25lZCB2YWx1ZSwgb3IgdGhlIG9yaWdpbmFsIHZhbHVlIHdoZW4gY2xvbmluZyBmYWlscy5cblx0ICovXG5cdGZ1bmN0aW9uIGNsb25lX3ZhbHVlKCBzb3VyY2VfdmFsdWUgKSB7XG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiBKU09OLnBhcnNlKCBKU09OLnN0cmluZ2lmeSggc291cmNlX3ZhbHVlICkgKTtcblx0XHR9IGNhdGNoICggZXJyICkge1xuXHRcdFx0cmV0dXJuIHNvdXJjZV92YWx1ZTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydCBhIGNhbmRpZGF0ZSB0b2tlbiBrZXkgdG8gdGhlIHN1cHBvcnRlZCBicmFjZS10b2tlbiBncmFtbWFyLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IHJhd192YWx1ZSBDYW5kaWRhdGUgdG9rZW4ga2V5LlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IE5vcm1hbGl6ZWQgdG9rZW4ga2V5LlxuXHQgKi9cblx0ZnVuY3Rpb24gbm9ybWFsaXplX3Rva2VuX2tleSggcmF3X3ZhbHVlICkge1xuXHRcdHZhciBzYWZlX3ZhbHVlID0gU3RyaW5nKCByYXdfdmFsdWUgfHwgJycgKS50b0xvd2VyQ2FzZSgpLnNsaWNlKCAwLCA2NCApO1xuXG5cdFx0c2FmZV92YWx1ZSA9IHNhZmVfdmFsdWUucmVwbGFjZSggL1tcXHNcXC1dKy9nLCAnXycgKTtcblx0XHRzYWZlX3ZhbHVlID0gc2FmZV92YWx1ZS5yZXBsYWNlKCAvW15hLXowLTlfXS9nLCAnJyApO1xuXHRcdHNhZmVfdmFsdWUgPSBzYWZlX3ZhbHVlLnJlcGxhY2UoIC9fKy9nLCAnXycgKTtcblxuXHRcdHJldHVybiBzYWZlX3ZhbHVlLnJlcGxhY2UoIC9eXyt8XyskL2csICcnICk7XG5cdH1cblxuXHQvKipcblx0ICogTm9ybWFsaXplIGEgbGluayB0eXBlIHRvIGFuIGVkaXRvci1zdXBwb3J0ZWQgdmFsdWUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gcmF3X3R5cGUgQ2FuZGlkYXRlIGxpbmsgdHlwZS5cblx0ICpcblx0ICogQHJldHVybiB7c3RyaW5nfSBgdXJsYCBvciBgYW5jaG9yYC5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9saW5rX3R5cGUoIHJhd190eXBlICkge1xuXHRcdHJldHVybiAnYW5jaG9yJyA9PT0gU3RyaW5nKCByYXdfdHlwZSB8fCAnJyApID8gJ2FuY2hvcicgOiAndXJsJztcblx0fVxuXG5cdC8qKlxuXHQgKiBOb3JtYWxpemUgYSBsaW5rIHRhcmdldCB0byBhbiBhbGxvdy1saXN0ZWQgdmFsdWUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gcmF3X3RhcmdldCBDYW5kaWRhdGUgdGFyZ2V0LlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IGBfc2VsZmAgb3IgYF9ibGFua2AuXG5cdCAqL1xuXHRmdW5jdGlvbiBub3JtYWxpemVfdGFyZ2V0KCByYXdfdGFyZ2V0ICkge1xuXHRcdHJldHVybiAnX3NlbGYnID09PSBTdHJpbmcoIHJhd190YXJnZXQgfHwgJycgKSA/ICdfc2VsZicgOiAnX2JsYW5rJztcblx0fVxuXG5cdC8qKlxuXHQgKiBOb3JtYWxpemUgYSBzcGFjZS1kZWxpbWl0ZWQgQ1NTIGNsYXNzIGxpc3QuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gcmF3X2NsYXNzZXMgQ2FuZGlkYXRlIGNsYXNzIGxpc3QuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gU2FuaXRpemVkIGNsYXNzIGxpc3QuXG5cdCAqL1xuXHRmdW5jdGlvbiBub3JtYWxpemVfY3NzX2NsYXNzZXMoIHJhd19jbGFzc2VzICkge1xuXHRcdHZhciBzYW5pdGl6ZSA9IGNvcmUuV1BCQ19CRkJfU2FuaXRpemUgfHwge307XG5cdFx0dmFyIGNsYXNzZXMgID0gU3RyaW5nKCByYXdfY2xhc3NlcyB8fCAnJyApLnNsaWNlKCAwLCAyMDAgKTtcblxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHNhbml0aXplLnNhbml0aXplX2Nzc19jbGFzc2xpc3QgKSB7XG5cdFx0XHRyZXR1cm4gc2FuaXRpemUuc2FuaXRpemVfY3NzX2NsYXNzbGlzdCggY2xhc3NlcyApO1xuXHRcdH1cblxuXHRcdHJldHVybiBjbGFzc2VzXG5cdFx0XHQuc3BsaXQoIC9cXHMrLyApXG5cdFx0XHQubWFwKFxuXHRcdFx0XHRmdW5jdGlvbiAoIGNsYXNzX25hbWUgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGNsYXNzX25hbWUucmVwbGFjZSggL1teQS1aYS16MC05Xy1dL2csICcnICk7XG5cdFx0XHRcdH1cblx0XHRcdClcblx0XHRcdC5maWx0ZXIoIEJvb2xlYW4gKVxuXHRcdFx0LmpvaW4oICcgJyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIE5vcm1hbGl6ZSBvbmUgVVJMIG9yIGFuY2hvciBkZXN0aW5hdGlvbiBmb3Igc2FmZSBicm93c2VyIHJlbmRlcmluZy5cblx0ICpcblx0ICogV29yZFByZXNzIHBlcmZvcm1zIHRoZSBhdXRob3JpdGF0aXZlIHNhdmUtdGltZSBVUkwgZmlsdGVyaW5nLiBUaGlzIGNsaWVudFxuXHQgKiBjaGVjayBwcmV2ZW50cyBleGVjdXRhYmxlIHNjaGVtZXMgZnJvbSBlbnRlcmluZyBCdWlsZGVyIHByZXZpZXcgbWFya3VwLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9ICAgICAgcmF3X2Rlc3RpbmF0aW9uIENhbmRpZGF0ZSBkZXN0aW5hdGlvbi5cblx0ICogQHBhcmFtIHtzdHJpbmd9IGxpbmtfdHlwZSAgICAgICBOb3JtYWxpemVkIGxpbmsgdHlwZS5cblx0ICpcblx0ICogQHJldHVybiB7c3RyaW5nfSBTYWZlIGRlc3RpbmF0aW9uLCBvciBhbiBlbXB0eSBzdHJpbmcgd2hlbiByZWplY3RlZC5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9kZXN0aW5hdGlvbiggcmF3X2Rlc3RpbmF0aW9uLCBsaW5rX3R5cGUgKSB7XG5cdFx0dmFyIGRlc3RpbmF0aW9uID0gU3RyaW5nKCByYXdfZGVzdGluYXRpb24gfHwgJycgKS50cmltKCkuc2xpY2UoIDAsIDIwNDggKTtcblx0XHR2YXIgY29tcGFjdF91cmw7XG5cdFx0dmFyIHNjaGVtZV9tYXRjaDtcblx0XHR2YXIgYWxsb3dlZF9zY2hlbWVzID0ge1xuXHRcdFx0aHR0cCAgIDogdHJ1ZSxcblx0XHRcdGh0dHBzICA6IHRydWUsXG5cdFx0XHRtYWlsdG8gOiB0cnVlLFxuXHRcdFx0dGVsICAgIDogdHJ1ZSxcblx0XHRcdGZ0cCAgICA6IHRydWUsXG5cdFx0XHRmdHBzICAgOiB0cnVlXG5cdFx0fTtcblxuXHRcdGlmICggJ2FuY2hvcicgPT09IGxpbmtfdHlwZSApIHtcblx0XHRcdHJldHVybiBkZXN0aW5hdGlvblxuXHRcdFx0XHQucmVwbGFjZSggL14jKy8sICcnIClcblx0XHRcdFx0LnJlcGxhY2UoIC9bXkEtWmEtejAtOV86XFwtLl0vZywgJycgKTtcblx0XHR9XG5cblx0XHRjb21wYWN0X3VybCA9IGRlc3RpbmF0aW9uLnJlcGxhY2UoIC9bXFx4MDAtXFx4MjBcXHg3Zl0rL2csICcnICk7XG5cdFx0c2NoZW1lX21hdGNoID0gY29tcGFjdF91cmwubWF0Y2goIC9eKFthLXpdW2EtejAtOSsuLV0qKTovaSApO1xuXG5cdFx0aWYgKCBzY2hlbWVfbWF0Y2ggJiYgISBhbGxvd2VkX3NjaGVtZXNbIFN0cmluZyggc2NoZW1lX21hdGNoWyAxIF0gfHwgJycgKS50b0xvd2VyQ2FzZSgpIF0gKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGRlc3RpbmF0aW9uO1xuXHR9XG5cblx0LyoqXG5cdCAqIE5vcm1hbGl6ZSBvbmUgZXhlY3V0YWJsZS1mcmVlIGxpbmsgZGVmaW5pdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHsqfSAgICAgIHJhd19saW5rIENhbmRpZGF0ZSBkZWZpbml0aW9uLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gaW5kZXggICAgWmVyby1iYXNlZCBmYWxsYmFjayBpbmRleC5cblx0ICpcblx0ICogQHJldHVybiB7T2JqZWN0fSBOb3JtYWxpemVkIGRlZmluaXRpb24uXG5cdCAqL1xuXHRmdW5jdGlvbiBub3JtYWxpemVfbGluayggcmF3X2xpbmssIGluZGV4ICkge1xuXHRcdHZhciBsaW5rX29iaiAgICAgPSByYXdfbGluayAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIHJhd19saW5rID8gcmF3X2xpbmsgOiB7fTtcblx0XHR2YXIgZmFsbGJhY2tfa2V5ID0gJ2xpbmtfJyArIFN0cmluZyggaW5kZXggKyAxICk7XG5cdFx0dmFyIHRva2VuX2tleSAgICA9IG5vcm1hbGl6ZV90b2tlbl9rZXkoIGxpbmtfb2JqLmtleSB8fCAnJyApIHx8IGZhbGxiYWNrX2tleTtcblx0XHR2YXIgbGlua190eXBlICAgID0gbm9ybWFsaXplX2xpbmtfdHlwZSggbGlua19vYmoubGlua190eXBlICk7XG5cdFx0dmFyIHZpc2libGVfdGV4dCA9IFN0cmluZyggbGlua19vYmoudGV4dCB8fCAnJyApLnRyaW0oKS5zbGljZSggMCwgMzAwICk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0a2V5ICAgICAgICAgOiB0b2tlbl9rZXksXG5cdFx0XHR0ZXh0ICAgICAgICA6IHZpc2libGVfdGV4dCB8fCB0b2tlbl9rZXkucmVwbGFjZSggL18vZywgJyAnICksXG5cdFx0XHRsaW5rX3R5cGUgICA6IGxpbmtfdHlwZSxcblx0XHRcdGRlc3RpbmF0aW9uIDogbm9ybWFsaXplX2Rlc3RpbmF0aW9uKCBsaW5rX29iai5kZXN0aW5hdGlvbiwgbGlua190eXBlICksXG5cdFx0XHR0YXJnZXQgICAgICA6IG5vcm1hbGl6ZV90YXJnZXQoIGxpbmtfb2JqLnRhcmdldCApLFxuXHRcdFx0Y3NzY2xhc3MgICAgOiBub3JtYWxpemVfY3NzX2NsYXNzZXMoIGxpbmtfb2JqLmNzc2NsYXNzIClcblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIE5vcm1hbGl6ZSBhbiBvcmRlcmVkIGxpbmsgY29sbGVjdGlvbiBhbmQgbWFrZSB0b2tlbiBrZXlzIHVuaXF1ZS5cblx0ICpcblx0ICogQHBhcmFtIHsqfSByYXdfbGlua3MgQ2FuZGlkYXRlIGFycmF5IG9yIEpTT04gc3RyaW5nLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtBcnJheX0gTm9ybWFsaXplZCBvcmRlcmVkIGRlZmluaXRpb25zLlxuXHQgKi9cblx0ZnVuY3Rpb24gbm9ybWFsaXplX2xpbmtzKCByYXdfbGlua3MgKSB7XG5cdFx0dmFyIHBhcnNlZF9saW5rcyA9IHJhd19saW5rcztcblx0XHR2YXIgbGlua3MgICAgICAgID0gYXJyYXkoKTtcblx0XHR2YXIgdXNlZF9rZXlzICAgID0ge307XG5cdFx0dmFyIGluZGV4O1xuXG5cdFx0aWYgKCAnc3RyaW5nJyA9PT0gdHlwZW9mIHBhcnNlZF9saW5rcyApIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHBhcnNlZF9saW5rcyA9IEpTT04ucGFyc2UoIHBhcnNlZF9saW5rcyApO1xuXHRcdFx0fSBjYXRjaCAoIGVyciApIHtcblx0XHRcdFx0cGFyc2VkX2xpbmtzID0gYXJyYXkoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoICEgQXJyYXkuaXNBcnJheSggcGFyc2VkX2xpbmtzICkgKSB7XG5cdFx0XHRyZXR1cm4gbGlua3M7XG5cdFx0fVxuXG5cdFx0Zm9yICggaW5kZXggPSAwOyBpbmRleCA8IHBhcnNlZF9saW5rcy5sZW5ndGggJiYgaW5kZXggPCAyMDsgaW5kZXgrKyApIHtcblx0XHRcdHZhciBub3JtYWxpemVkX2xpbmsgPSBub3JtYWxpemVfbGluayggcGFyc2VkX2xpbmtzWyBpbmRleCBdLCBpbmRleCApO1xuXHRcdFx0dmFyIGJhc2Vfa2V5ICAgICAgICA9IG5vcm1hbGl6ZWRfbGluay5rZXk7XG5cdFx0XHR2YXIga2V5X3N1ZmZpeCAgICAgID0gMjtcblxuXHRcdFx0d2hpbGUgKCB1c2VkX2tleXNbIG5vcm1hbGl6ZWRfbGluay5rZXkgXSApIHtcblx0XHRcdFx0bm9ybWFsaXplZF9saW5rLmtleSA9IGJhc2Vfa2V5LnNsaWNlKCAwLCA2MCApICsgJ18nICsgU3RyaW5nKCBrZXlfc3VmZml4ICk7XG5cdFx0XHRcdGtleV9zdWZmaXgrKztcblx0XHRcdH1cblxuXHRcdFx0dXNlZF9rZXlzWyBub3JtYWxpemVkX2xpbmsua2V5IF0gPSB0cnVlO1xuXHRcdFx0bGlua3MucHVzaCggbm9ybWFsaXplZF9saW5rICk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGxpbmtzO1xuXHR9XG5cblx0LyoqXG5cdCAqIEV4dHJhY3QgdW5pcXVlIGJyYWNlIHRva2VucyBmcm9tIFN0YXRpYyBUZXh0IGNvbnRlbnQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gcmF3X3RleHQgQ2FuZGlkYXRlIGNvbnRlbnQuXG5cdCAqXG5cdCAqIEByZXR1cm4ge0FycmF5fSBVbmlxdWUgdG9rZW4ga2V5cyBpbiBzb3VyY2Ugb3JkZXIuXG5cdCAqL1xuXHRmdW5jdGlvbiBleHRyYWN0X3Rva2VucyggcmF3X3RleHQgKSB7XG5cdFx0dmFyIHRva2VuX3JlZ2V4ID0gL1xceyhbYS16QS1aMC05X10rKVxcfS9nO1xuXHRcdHZhciB0b2tlbl9tYXRjaDtcblx0XHR2YXIgdG9rZW5zICAgID0gYXJyYXkoKTtcblx0XHR2YXIgdXNlZF9rZXlzID0ge307XG5cblx0XHR3aGlsZSAoIG51bGwgIT09ICggdG9rZW5fbWF0Y2ggPSB0b2tlbl9yZWdleC5leGVjKCBTdHJpbmcoIHJhd190ZXh0IHx8ICcnICkgKSApICkge1xuXHRcdFx0dmFyIHRva2VuX2tleSA9IG5vcm1hbGl6ZV90b2tlbl9rZXkoIHRva2VuX21hdGNoWyAxIF0gKTtcblx0XHRcdGlmICggdG9rZW5fa2V5ICYmICEgdXNlZF9rZXlzWyB0b2tlbl9rZXkgXSApIHtcblx0XHRcdFx0dXNlZF9rZXlzWyB0b2tlbl9rZXkgXSA9IHRydWU7XG5cdFx0XHRcdHRva2Vucy5wdXNoKCB0b2tlbl9rZXkgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdG9rZW5zO1xuXHR9XG5cblx0LyoqXG5cdCAqIEJ1aWxkIGEga2V5LWluZGV4ZWQgbGluayBtYXAuXG5cdCAqXG5cdCAqIEBwYXJhbSB7QXJyYXl9IGxpbmtzIE5vcm1hbGl6ZWQgZGVmaW5pdGlvbnMuXG5cdCAqXG5cdCAqIEByZXR1cm4ge09iamVjdH0gRGVmaW5pdGlvbiBtYXAuXG5cdCAqL1xuXHRmdW5jdGlvbiBidWlsZF9saW5rX21hcCggbGlua3MgKSB7XG5cdFx0dmFyIGxpbmtfbWFwID0ge307XG5cdFx0dmFyIGluZGV4O1xuXG5cdFx0Zm9yICggaW5kZXggPSAwOyBpbmRleCA8IGxpbmtzLmxlbmd0aDsgaW5kZXgrKyApIHtcblx0XHRcdGxpbmtfbWFwWyBsaW5rc1sgaW5kZXggXS5rZXkgXSA9IGxpbmtzWyBpbmRleCBdO1xuXHRcdH1cblxuXHRcdHJldHVybiBsaW5rX21hcDtcblx0fVxuXG5cdC8qKlxuXHQgKiBCdWlsZCBvbmUgZXNjYXBlZCBsaW5rIGZvciBCdWlsZGVyIHByZXZpZXcgb3IgZXhwb3J0ZWQgZm9ybSBtYXJrdXAuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgbGlua19vYmogICBOb3JtYWxpemVkIGxpbmsgZGVmaW5pdGlvbi5cblx0ICogQHBhcmFtIHtib29sZWFufSBwcmV2aWV3X29ubHkgV2hldGhlciBjbGlja3MgbXVzdCBiZSBkaXNhYmxlZCBpbiBCdWlsZGVyLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IEVzY2FwZWQgYW5jaG9yIEhUTUwuXG5cdCAqL1xuXHRmdW5jdGlvbiBidWlsZF9saW5rX2h0bWwoIGxpbmtfb2JqLCBwcmV2aWV3X29ubHkgKSB7XG5cdFx0dmFyIHZpc2libGVfdGV4dCA9IGVzY2FwZV9odG1sKCBsaW5rX29iai50ZXh0IHx8IGxpbmtfb2JqLmtleSB8fCAnJyApO1xuXHRcdHZhciBjbGFzc2VzICAgICAgPSAnd3BiY19iZmJfX3N0YXRpY190ZXh0X2xpbmsnO1xuXHRcdHZhciBkZXN0aW5hdGlvbiAgPSBub3JtYWxpemVfZGVzdGluYXRpb24oIGxpbmtfb2JqLmRlc3RpbmF0aW9uLCBsaW5rX29iai5saW5rX3R5cGUgKTtcblx0XHR2YXIgaHRtbDtcblxuXHRcdGlmICggbGlua19vYmouY3NzY2xhc3MgKSB7XG5cdFx0XHRjbGFzc2VzICs9ICcgJyArIG5vcm1hbGl6ZV9jc3NfY2xhc3NlcyggbGlua19vYmouY3NzY2xhc3MgKTtcblx0XHR9XG5cblx0XHRpZiAoICdhbmNob3InID09PSBsaW5rX29iai5saW5rX3R5cGUgKSB7XG5cdFx0XHRkZXN0aW5hdGlvbiA9IGRlc3RpbmF0aW9uID8gJyMnICsgZGVzdGluYXRpb24gOiAnIyc7XG5cdFx0fSBlbHNlIGlmICggISBkZXN0aW5hdGlvbiApIHtcblx0XHRcdGRlc3RpbmF0aW9uID0gJyMnO1xuXHRcdH1cblxuXHRcdGlmICggcHJldmlld19vbmx5ICkge1xuXHRcdFx0aHRtbCA9ICc8YSBjbGFzcz1cIicgKyBlc2NhcGVfYXR0ciggY2xhc3NlcyApICsgJ1wiIGFyaWEtZGlzYWJsZWQ9XCJ0cnVlXCIgdGFiaW5kZXg9XCItMVwiJztcblx0XHR9IGVsc2Uge1xuXHRcdFx0aHRtbCA9ICc8YSBocmVmPVwiJyArIGVzY2FwZV9hdHRyKCBkZXN0aW5hdGlvbiApICsgJ1wiIGNsYXNzPVwiJyArIGVzY2FwZV9hdHRyKCBjbGFzc2VzICkgKyAnXCInO1xuXHRcdH1cblxuXHRcdGlmICggISBwcmV2aWV3X29ubHkgJiYgJ3VybCcgPT09IGxpbmtfb2JqLmxpbmtfdHlwZSApIHtcblx0XHRcdGh0bWwgKz0gJyB0YXJnZXQ9XCInICsgZXNjYXBlX2F0dHIoIG5vcm1hbGl6ZV90YXJnZXQoIGxpbmtfb2JqLnRhcmdldCApICkgKyAnXCInO1xuXHRcdFx0aWYgKCAnX2JsYW5rJyA9PT0gbm9ybWFsaXplX3RhcmdldCggbGlua19vYmoudGFyZ2V0ICkgKSB7XG5cdFx0XHRcdGh0bWwgKz0gJyByZWw9XCJub29wZW5lciBub3JlZmVycmVyXCInO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBodG1sICsgJz4nICsgdmlzaWJsZV90ZXh0ICsgJzwvYT4nO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlbmRlciBTdGF0aWMgVGV4dCBjb250ZW50IHdpdGggbGluay10b2tlbiByZXBsYWNlbWVudHMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gICAgICAgcmF3X3RleHQgICAgIFN0YXRpYyBUZXh0IGNvbnRlbnQuXG5cdCAqIEBwYXJhbSB7Kn0gICAgICAgcmF3X2xpbmtzICAgIExpbmsgZGVmaW5pdGlvbnMuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgb3B0aW9ucyAgICAgIFJlbmRlcmluZyBvcHRpb25zLlxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IG9wdGlvbnMuYWxsb3dfaHRtbCBQcmVzZXJ2ZSBsZWdhY3kgYmFzaWMtSFRNTCBiZWhhdmlvci5cblx0ICogQHBhcmFtIHtib29sZWFufSBvcHRpb25zLm5sMmJyIENvbnZlcnQgbmV3IGxpbmVzIHdoZW4gSFRNTCBpcyBub3QgYWxsb3dlZC5cblx0ICogQHBhcmFtIHtib29sZWFufSBvcHRpb25zLnByZXZpZXdfb25seSBEaXNhYmxlIGxpbmsgY2xpY2tzIGluIEJ1aWxkZXIuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gUmVuZGVyZWQgSFRNTCB3aXRoIGVzY2FwZWQgbGlua3MgYW5kIHRleHQuXG5cdCAqL1xuXHRmdW5jdGlvbiBidWlsZF9jb250ZW50X2h0bWwoIHJhd190ZXh0LCByYXdfbGlua3MsIG9wdGlvbnMgKSB7XG5cdFx0dmFyIHNldHRpbmdzICAgICAgPSBvcHRpb25zIHx8IHt9O1xuXHRcdHZhciBzb3VyY2VfdGV4dCAgID0gU3RyaW5nKCByYXdfdGV4dCB8fCAnJyApO1xuXHRcdHZhciBub3JtYWxpemVkICAgID0gbm9ybWFsaXplX2xpbmtzKCByYXdfbGlua3MgKTtcblx0XHR2YXIgbGlua19tYXAgICAgICA9IGJ1aWxkX2xpbmtfbWFwKCBub3JtYWxpemVkICk7XG5cdFx0dmFyIHRva2VuX3JlZ2V4ICAgPSAvXFx7KFthLXpBLVowLTlfXSspXFx9L2c7XG5cdFx0dmFyIHRva2VuX21hdGNoO1xuXHRcdHZhciBsYXN0X2luZGV4ICAgID0gMDtcblx0XHR2YXIgcmVuZGVyZWRfaHRtbCA9ICcnO1xuXG5cdFx0LyoqXG5cdFx0ICogUmVuZGVyIG9uZSBub24tdG9rZW4gc291cmNlIHNlZ21lbnQgd2l0aCB0aGUgZmllbGQncyBsZWdhY3kgdGV4dCBydWxlcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0X3NlZ21lbnQgU291cmNlIHNlZ21lbnQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IFJlbmRlcmVkIHNlZ21lbnQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX3RleHRfc2VnbWVudCggdGV4dF9zZWdtZW50ICkge1xuXHRcdFx0dmFyIHJlbmRlcmVkX3NlZ21lbnQgPSBzZXR0aW5ncy5hbGxvd19odG1sID8gdGV4dF9zZWdtZW50IDogZXNjYXBlX2h0bWwoIHRleHRfc2VnbWVudCApO1xuXG5cdFx0XHRpZiAoICEgc2V0dGluZ3MuYWxsb3dfaHRtbCAmJiBzZXR0aW5ncy5ubDJiciApIHtcblx0XHRcdFx0cmVuZGVyZWRfc2VnbWVudCA9IHJlbmRlcmVkX3NlZ21lbnQucmVwbGFjZSggL1xcbi9nLCAnPGJyPicgKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHJlbmRlcmVkX3NlZ21lbnQ7XG5cdFx0fVxuXG5cdFx0d2hpbGUgKCBudWxsICE9PSAoIHRva2VuX21hdGNoID0gdG9rZW5fcmVnZXguZXhlYyggc291cmNlX3RleHQgKSApICkge1xuXHRcdFx0dmFyIHRva2VuX2tleSA9IG5vcm1hbGl6ZV90b2tlbl9rZXkoIHRva2VuX21hdGNoWyAxIF0gKTtcblxuXHRcdFx0cmVuZGVyZWRfaHRtbCArPSByZW5kZXJfdGV4dF9zZWdtZW50KCBzb3VyY2VfdGV4dC5zdWJzdHJpbmcoIGxhc3RfaW5kZXgsIHRva2VuX21hdGNoLmluZGV4ICkgKTtcblx0XHRcdGlmICggdG9rZW5fa2V5ICYmIGxpbmtfbWFwWyB0b2tlbl9rZXkgXSApIHtcblx0XHRcdFx0cmVuZGVyZWRfaHRtbCArPSBidWlsZF9saW5rX2h0bWwoIGxpbmtfbWFwWyB0b2tlbl9rZXkgXSwgISEgc2V0dGluZ3MucHJldmlld19vbmx5ICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZW5kZXJlZF9odG1sICs9IHJlbmRlcl90ZXh0X3NlZ21lbnQoIHRva2VuX21hdGNoWyAwIF0gKTtcblx0XHRcdH1cblx0XHRcdGxhc3RfaW5kZXggPSB0b2tlbl9tYXRjaC5pbmRleCArIHRva2VuX21hdGNoWyAwIF0ubGVuZ3RoO1xuXHRcdH1cblxuXHRcdHJlbmRlcmVkX2h0bWwgKz0gcmVuZGVyX3RleHRfc2VnbWVudCggc291cmNlX3RleHQuc3Vic3RyaW5nKCBsYXN0X2luZGV4ICkgKTtcblxuXHRcdHJldHVybiByZW5kZXJlZF9odG1sO1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBhIERPTSBlbGVtZW50IHVzaW5nIHRleHRDb250ZW50IGZvciB2aXNpYmxlIHRleHQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0YWdfbmFtZSBFbGVtZW50IG5hbWUuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBhdHRycyAgICBBdHRyaWJ1dGUgbWFwLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdGV4dCAgICAgT3B0aW9uYWwgdGV4dC5cblx0ICpcblx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR9IENyZWF0ZWQgZWxlbWVudC5cblx0ICovXG5cdGZ1bmN0aW9uIGNyZWF0ZV9lbGVtZW50KCB0YWdfbmFtZSwgYXR0cnMsIHRleHQgKSB7XG5cdFx0dmFyIGVsZW1lbnQgPSBkLmNyZWF0ZUVsZW1lbnQoIHRhZ19uYW1lICk7XG5cdFx0dmFyIGF0dHJfbmFtZTtcblxuXHRcdGZvciAoIGF0dHJfbmFtZSBpbiAoIGF0dHJzIHx8IHt9ICkgKSB7XG5cdFx0XHRpZiAoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggYXR0cnMsIGF0dHJfbmFtZSApICkge1xuXHRcdFx0XHRlbGVtZW50LnNldEF0dHJpYnV0ZSggYXR0cl9uYW1lLCBhdHRyc1sgYXR0cl9uYW1lIF0gKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIHVuZGVmaW5lZCAhPT0gdGV4dCApIHtcblx0XHRcdGVsZW1lbnQudGV4dENvbnRlbnQgPSB0ZXh0O1xuXHRcdH1cblxuXHRcdHJldHVybiBlbGVtZW50O1xuXHR9XG5cblx0LyoqXG5cdCAqIERpc3BhdGNoIGFuIEluc3BlY3RvciBpbnB1dCBldmVudCBhZnRlciB0aGUgaGlkZGVuIEpTT04gd3JpdGVyIGNoYW5nZXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHdyaXRlciBIaWRkZW4gSW5zcGVjdG9yIHdyaXRlci5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGRpc3BhdGNoX3dyaXRlcl9pbnB1dCggd3JpdGVyICkge1xuXHRcdHZhciBpbnB1dF9ldmVudDtcblxuXHRcdHRyeSB7XG5cdFx0XHRpbnB1dF9ldmVudCA9IG5ldyB3LkV2ZW50KCAnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSApO1xuXHRcdH0gY2F0Y2ggKCBlcnIgKSB7XG5cdFx0XHRpbnB1dF9ldmVudCA9IGQuY3JlYXRlRXZlbnQoICdFdmVudCcgKTtcblx0XHRcdGlucHV0X2V2ZW50LmluaXRFdmVudCggJ2lucHV0JywgdHJ1ZSwgZmFsc2UgKTtcblx0XHR9XG5cblx0XHR3cml0ZXIuZGlzcGF0Y2hFdmVudCggaW5wdXRfZXZlbnQgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBJbnNlcnQgYSB0b2tlbiBhdCB0aGUgY3VycmVudCBjdXJzb3IgcG9zaXRpb24gaW4gdGhlIFN0YXRpYyBUZXh0IGlucHV0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxUZXh0QXJlYUVsZW1lbnR9IHRleHRfaW5wdXQgU3RhdGljIFRleHQgY29udHJvbC5cblx0ICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICB0b2tlbl9rZXkgIE5vcm1hbGl6ZWQgdG9rZW4ga2V5LlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gaW5zZXJ0X3Rva2VuX2F0X2N1cnNvciggdGV4dF9pbnB1dCwgdG9rZW5fa2V5ICkge1xuXHRcdHZhciB0b2tlbl90ZXh0ID0gJ3snICsgdG9rZW5fa2V5ICsgJ30nO1xuXHRcdHZhciBzdGFydCAgICAgID0gTnVtYmVyLmlzSW50ZWdlciggdGV4dF9pbnB1dC5zZWxlY3Rpb25TdGFydCApID8gdGV4dF9pbnB1dC5zZWxlY3Rpb25TdGFydCA6IHRleHRfaW5wdXQudmFsdWUubGVuZ3RoO1xuXHRcdHZhciBlbmQgICAgICAgID0gTnVtYmVyLmlzSW50ZWdlciggdGV4dF9pbnB1dC5zZWxlY3Rpb25FbmQgKSA/IHRleHRfaW5wdXQuc2VsZWN0aW9uRW5kIDogc3RhcnQ7XG5cblx0XHR0ZXh0X2lucHV0LnZhbHVlID0gdGV4dF9pbnB1dC52YWx1ZS5zdWJzdHJpbmcoIDAsIHN0YXJ0ICkgKyB0b2tlbl90ZXh0ICsgdGV4dF9pbnB1dC52YWx1ZS5zdWJzdHJpbmcoIGVuZCApO1xuXHRcdHRleHRfaW5wdXQuZm9jdXMoKTtcblx0XHR0ZXh0X2lucHV0LnNldFNlbGVjdGlvblJhbmdlKCBzdGFydCArIHRva2VuX3RleHQubGVuZ3RoLCBzdGFydCArIHRva2VuX3RleHQubGVuZ3RoICk7XG5cdFx0ZGlzcGF0Y2hfd3JpdGVyX2lucHV0KCB0ZXh0X2lucHV0ICk7XG5cdH1cblxuXHQvKipcblx0ICogUmVuZGVyIHRoZSBTdGF0aWMgVGV4dCBsaW5rLWRlZmluaXRpb24gRmFjdG9yeSBzbG90LlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBzbG90X2hvc3QgSW5zcGVjdG9yIHNsb3QgaG9zdC5cblx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgY29udGV4dCAgIEluc3BlY3RvciBjb250ZXh0IHdpdGggc2VsZWN0ZWQgZmllbGQgZGF0YS5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHJlbmRlcl9lZGl0b3Jfc2xvdCggc2xvdF9ob3N0LCBjb250ZXh0ICkge1xuXHRcdHZhciBmaWVsZF9kYXRhICA9IGNvbnRleHQgJiYgY29udGV4dC5kYXRhID8gY29udGV4dC5kYXRhIDoge307XG5cdFx0dmFyIGxpbmtzICAgICAgID0gbm9ybWFsaXplX2xpbmtzKCBmaWVsZF9kYXRhLmxpbmtzICk7XG5cdFx0dmFyIGVkaXRvciAgICAgID0gY3JlYXRlX2VsZW1lbnQoICdkaXYnLCB7ICdjbGFzcyc6ICd3cGJjX2JmYl9fc3RhdGljX3RleHRfbGlua3NfZWRpdG9yJyB9ICk7XG5cdFx0dmFyIHRva2VuX2xpc3QgID0gY3JlYXRlX2VsZW1lbnQoICdkaXYnLCB7ICdjbGFzcyc6ICd3cGJjX2JmYl9fc3RhdGljX3RleHRfbGlua190b2tlbnMnIH0gKTtcblx0XHR2YXIgaGVscCAgICAgICAgPSBjcmVhdGVfZWxlbWVudCggJ3AnLCB7ICdjbGFzcyc6ICd3cGJjX2JmYl9faGVscCcgfSwgZ2V0X3RleHQoICdsaW5rc19oZWxwJywgJ1VzZSB0b2tlbnMgaW5zaWRlIGJyYWNlcywgZm9yIGV4YW1wbGU6IHt0ZXJtc30gb3Ige3ByaXZhY3lfcG9saWN5fS4nICkgKTtcblx0XHR2YXIgc3RhdHVzICAgICAgPSBjcmVhdGVfZWxlbWVudCggJ3AnLCB7ICdjbGFzcyc6ICd3cGJjX2JmYl9faGVscCB3cGJjX2JmYl9fc3RhdGljX3RleHRfbGlua19zdGF0dXMnLCAnYXJpYS1saXZlJzogJ3BvbGl0ZScgfSApO1xuXHRcdHZhciByb3dzX2xpc3QgICA9IGNyZWF0ZV9lbGVtZW50KCAnZGl2JywgeyAnY2xhc3MnOiAnd3BiY19iZmJfX3N0YXRpY190ZXh0X2xpbmtzX2xpc3QnIH0gKTtcblx0XHR2YXIgYWRkX2J1dHRvbiAgPSBjcmVhdGVfZWxlbWVudCggJ2J1dHRvbicsIHsgJ3R5cGUnOiAnYnV0dG9uJywgJ2NsYXNzJzogJ2J1dHRvbiBidXR0b24tc2Vjb25kYXJ5JyB9LCBnZXRfdGV4dCggJ2FkZF9saW5rJywgJ0FkZCBsaW5rJyApICk7XG5cdFx0dmFyIHRvb2xiYXIgICAgID0gY3JlYXRlX2VsZW1lbnQoICdkaXYnLCB7ICdjbGFzcyc6ICd3cGJjX2JmYl9fc3RhdGljX3RleHRfbGlua3NfdG9vbGJhcicgfSApO1xuXHRcdHZhciB3cml0ZXIgICAgICA9IGNyZWF0ZV9lbGVtZW50KCAndGV4dGFyZWEnLCB7ICdjbGFzcyc6ICdpbnNwZWN0b3JfX2lucHV0JywgJ2RhdGEtaW5zcGVjdG9yLWtleSc6ICdsaW5rcycsICdoaWRkZW4nOiAnaGlkZGVuJyB9ICk7XG5cdFx0dmFyIHBhbmVsICAgICAgID0gc2xvdF9ob3N0LmNsb3Nlc3QoICcjd3BiY19iZmJfX2luc3BlY3RvcicgKSB8fCBzbG90X2hvc3QuY2xvc2VzdCggJy53cGJjX2JmYl9faW5zcGVjdG9yJyApO1xuXHRcdHZhciB0ZXh0X2lucHV0ICA9IHBhbmVsID8gcGFuZWwucXVlcnlTZWxlY3RvciggJ3RleHRhcmVhW2RhdGEtaW5zcGVjdG9yLWtleT1cInRleHRcIl0nICkgOiBudWxsO1xuXG5cdFx0d3JpdGVyLnZhbHVlID0gSlNPTi5zdHJpbmdpZnkoIGxpbmtzICk7XG5cdFx0dG9vbGJhci5hcHBlbmRDaGlsZCggYWRkX2J1dHRvbiApO1xuXHRcdGVkaXRvci5hcHBlbmRDaGlsZCggdG9rZW5fbGlzdCApO1xuXHRcdGVkaXRvci5hcHBlbmRDaGlsZCggaGVscCApO1xuXHRcdGVkaXRvci5hcHBlbmRDaGlsZCggc3RhdHVzICk7XG5cdFx0ZWRpdG9yLmFwcGVuZENoaWxkKCByb3dzX2xpc3QgKTtcblx0XHRlZGl0b3IuYXBwZW5kQ2hpbGQoIHRvb2xiYXIgKTtcblx0XHRlZGl0b3IuYXBwZW5kQ2hpbGQoIHdyaXRlciApO1xuXHRcdHNsb3RfaG9zdC5hcHBlbmRDaGlsZCggZWRpdG9yICk7XG5cblx0XHQvKipcblx0XHQgKiBQZXJzaXN0IG5vcm1hbGl6ZWQgZWRpdG9yIHN0YXRlIHRocm91Z2ggdGhlIHN0YW5kYXJkIEluc3BlY3RvciB3cml0ZXIuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNvbW1pdF9saW5rcygpIHtcblx0XHRcdGxpbmtzICAgICAgICA9IG5vcm1hbGl6ZV9saW5rcyggbGlua3MgKTtcblx0XHRcdHdyaXRlci52YWx1ZSA9IEpTT04uc3RyaW5naWZ5KCBsaW5rcyApO1xuXHRcdFx0ZGlzcGF0Y2hfd3JpdGVyX2lucHV0KCB3cml0ZXIgKTtcblx0XHRcdHJlbmRlcl90b2tlbnNfYW5kX3N0YXR1cygpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBtaXNzaW5nIHRva2VuIGRlZmluaXRpb25zIGZvciB0aGUgY3VycmVudCBTdGF0aWMgVGV4dCBjb250ZW50LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7QXJyYXl9IE1pc3NpbmcgdG9rZW4ga2V5cy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfbWlzc2luZ190b2tlbnMoKSB7XG5cdFx0XHR2YXIgc291cmNlX3Rva2VucyA9IGV4dHJhY3RfdG9rZW5zKCB0ZXh0X2lucHV0ID8gdGV4dF9pbnB1dC52YWx1ZSA6ICcnICk7XG5cdFx0XHR2YXIgbGlua19tYXAgICAgICA9IGJ1aWxkX2xpbmtfbWFwKCBub3JtYWxpemVfbGlua3MoIGxpbmtzICkgKTtcblxuXHRcdFx0cmV0dXJuIHNvdXJjZV90b2tlbnMuZmlsdGVyKFxuXHRcdFx0XHRmdW5jdGlvbiAoIHRva2VuX2tleSApIHtcblx0XHRcdFx0XHRyZXR1cm4gISBsaW5rX21hcFsgdG9rZW5fa2V5IF07XG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVuZGVyIHRva2VuIGluc2VydGlvbiBidXR0b25zIGFuZCBjdXJyZW50IHZhbGlkYXRpb24gZ3VpZGFuY2UuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl90b2tlbnNfYW5kX3N0YXR1cygpIHtcblx0XHRcdHZhciBub3JtYWxpemVkX2xpbmtzID0gbm9ybWFsaXplX2xpbmtzKCBsaW5rcyApO1xuXHRcdFx0dmFyIG1pc3NpbmdfdG9rZW5zICAgPSBnZXRfbWlzc2luZ190b2tlbnMoKTtcblxuXHRcdFx0dG9rZW5fbGlzdC50ZXh0Q29udGVudCA9ICcnO1xuXHRcdFx0bm9ybWFsaXplZF9saW5rcy5mb3JFYWNoKFxuXHRcdFx0XHRmdW5jdGlvbiAoIGxpbmtfb2JqICkge1xuXHRcdFx0XHRcdHZhciB0b2tlbl9idXR0b24gPSBjcmVhdGVfZWxlbWVudChcblx0XHRcdFx0XHRcdCdidXR0b24nLFxuXHRcdFx0XHRcdFx0eyAndHlwZSc6ICdidXR0b24nLCAnY2xhc3MnOiAnYnV0dG9uIGJ1dHRvbi1zZWNvbmRhcnkgYnV0dG9uLXNtYWxsJyB9LFxuXHRcdFx0XHRcdFx0J3snICsgbGlua19vYmoua2V5ICsgJ30nXG5cdFx0XHRcdFx0KTtcblxuXHRcdFx0XHRcdHRva2VuX2J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFxuXHRcdFx0XHRcdFx0J2NsaWNrJyxcblx0XHRcdFx0XHRcdGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdFx0aWYgKCB0ZXh0X2lucHV0ICkge1xuXHRcdFx0XHRcdFx0XHRcdGluc2VydF90b2tlbl9hdF9jdXJzb3IoIHRleHRfaW5wdXQsIGxpbmtfb2JqLmtleSApO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR0b2tlbl9saXN0LmFwcGVuZENoaWxkKCB0b2tlbl9idXR0b24gKTtcblx0XHRcdFx0fVxuXHRcdFx0KTtcblxuXHRcdFx0aWYgKCBtaXNzaW5nX3Rva2Vucy5sZW5ndGggKSB7XG5cdFx0XHRcdHN0YXR1cy50ZXh0Q29udGVudCA9IGdldF90ZXh0KCAnbWlzc2luZ19kZWZpbml0aW9ucycsICdBZGQgYSBsaW5rIGRlZmluaXRpb24gZm9yOiAlcycgKS5yZXBsYWNlKCAnJXMnLCBtaXNzaW5nX3Rva2Vucy5tYXAoIGZ1bmN0aW9uICgga2V5ICkgeyByZXR1cm4gJ3snICsga2V5ICsgJ30nOyB9ICkuam9pbiggJywgJyApICk7XG5cdFx0XHR9IGVsc2UgaWYgKCAhIG5vcm1hbGl6ZWRfbGlua3MubGVuZ3RoICkge1xuXHRcdFx0XHRzdGF0dXMudGV4dENvbnRlbnQgPSBnZXRfdGV4dCggJ25vX2xpbmtzJywgJ0FkZCBhIGxpbmsgZGVmaW5pdGlvbiwgdGhlbiBpbnNlcnQgaXRzIHRva2VuIGludG8gdGhlIHRleHQuJyApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c3RhdHVzLnRleHRDb250ZW50ID0gJyc7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQnVpbGQgb25lIGxhYmVsZWQgbGluay1kZWZpbml0aW9uIGNvbnRyb2wuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICBsYWJlbF90ZXh0IENvbnRyb2wgbGFiZWwuXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY29udHJvbCAgICBGb3JtIGNvbnRyb2wuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudH0gQ29udHJvbCB3cmFwcGVyLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGJ1aWxkX2xhYmVsZWRfY29udHJvbCggbGFiZWxfdGV4dCwgY29udHJvbCApIHtcblx0XHRcdHZhciB3cmFwcGVyID0gY3JlYXRlX2VsZW1lbnQoICdsYWJlbCcsIHsgJ2NsYXNzJzogJ3dwYmNfYmZiX19zdGF0aWNfdGV4dF9saW5rX2NvbnRyb2wnIH0gKTtcblx0XHRcdHdyYXBwZXIuYXBwZW5kQ2hpbGQoIGNyZWF0ZV9lbGVtZW50KCAnc3BhbicsIHsgJ2NsYXNzJzogJ3dwYmNfYmZiX19zdGF0aWNfdGV4dF9saW5rX2xhYmVsJyB9LCBsYWJlbF90ZXh0ICkgKTtcblx0XHRcdHdyYXBwZXIuYXBwZW5kQ2hpbGQoIGNvbnRyb2wgKTtcblx0XHRcdHJldHVybiB3cmFwcGVyO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbmRlciBldmVyeSBlZGl0YWJsZSBkZWZpbml0aW9uIHJvdyBmcm9tIGN1cnJlbnQgc3RhdGUuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9yb3dzKCkge1xuXHRcdFx0bGlua3MgPSBub3JtYWxpemVfbGlua3MoIGxpbmtzICk7XG5cdFx0XHRyb3dzX2xpc3QudGV4dENvbnRlbnQgPSAnJztcblxuXHRcdFx0bGlua3MuZm9yRWFjaChcblx0XHRcdFx0ZnVuY3Rpb24gKCBsaW5rX29iaiwgcm93X2luZGV4ICkge1xuXHRcdFx0XHRcdHZhciByb3cgICAgICAgICAgICAgID0gY3JlYXRlX2VsZW1lbnQoICdkaXYnLCB7ICdjbGFzcyc6ICd3cGJjX2JmYl9fc3RhdGljX3RleHRfbGlua19yb3cnIH0gKTtcblx0XHRcdFx0XHR2YXIga2V5X2lucHV0ICAgICAgICA9IGNyZWF0ZV9lbGVtZW50KCAnaW5wdXQnLCB7ICd0eXBlJzogJ3RleHQnLCAnbWF4bGVuZ3RoJzogJzY0JywgJ3ZhbHVlJzogbGlua19vYmoua2V5IH0gKTtcblx0XHRcdFx0XHR2YXIgdGV4dF9jb250cm9sICAgICA9IGNyZWF0ZV9lbGVtZW50KCAnaW5wdXQnLCB7ICd0eXBlJzogJ3RleHQnLCAnbWF4bGVuZ3RoJzogJzMwMCcsICd2YWx1ZSc6IGxpbmtfb2JqLnRleHQgfSApO1xuXHRcdFx0XHRcdHZhciB0eXBlX3NlbGVjdCAgICAgID0gY3JlYXRlX2VsZW1lbnQoICdzZWxlY3QnICk7XG5cdFx0XHRcdFx0dmFyIGRlc3RpbmF0aW9uX2lucHV0ID0gY3JlYXRlX2VsZW1lbnQoICdpbnB1dCcsIHsgJ3R5cGUnOiAndGV4dCcsICdtYXhsZW5ndGgnOiAnMjA0OCcsICd2YWx1ZSc6IGxpbmtfb2JqLmRlc3RpbmF0aW9uIH0gKTtcblx0XHRcdFx0XHR2YXIgdGFyZ2V0X3NlbGVjdCAgICA9IGNyZWF0ZV9lbGVtZW50KCAnc2VsZWN0JyApO1xuXHRcdFx0XHRcdHZhciBjc3NfaW5wdXQgICAgICAgID0gY3JlYXRlX2VsZW1lbnQoICdpbnB1dCcsIHsgJ3R5cGUnOiAndGV4dCcsICdtYXhsZW5ndGgnOiAnMjAwJywgJ3ZhbHVlJzogbGlua19vYmouY3NzY2xhc3MgfSApO1xuXHRcdFx0XHRcdHZhciBhY3Rpb25zICAgICAgICAgID0gY3JlYXRlX2VsZW1lbnQoICdkaXYnLCB7ICdjbGFzcyc6ICd3cGJjX2JmYl9fc3RhdGljX3RleHRfbGlua19hY3Rpb25zJyB9ICk7XG5cdFx0XHRcdFx0dmFyIGR1cGxpY2F0ZV9idXR0b24gPSBjcmVhdGVfZWxlbWVudCggJ2J1dHRvbicsIHsgJ3R5cGUnOiAnYnV0dG9uJywgJ2NsYXNzJzogJ2J1dHRvbiBidXR0b24tc2Vjb25kYXJ5IGJ1dHRvbi1zbWFsbCcgfSwgZ2V0X3RleHQoICdkdXBsaWNhdGUnLCAnRHVwbGljYXRlJyApICk7XG5cdFx0XHRcdFx0dmFyIHJlbW92ZV9idXR0b24gICAgPSBjcmVhdGVfZWxlbWVudCggJ2J1dHRvbicsIHsgJ3R5cGUnOiAnYnV0dG9uJywgJ2NsYXNzJzogJ2J1dHRvbiBidXR0b24tbGluay1kZWxldGUgYnV0dG9uLXNtYWxsJyB9LCBnZXRfdGV4dCggJ3JlbW92ZScsICdSZW1vdmUnICkgKTtcblxuXHRcdFx0XHRcdHR5cGVfc2VsZWN0LmFwcGVuZENoaWxkKCBjcmVhdGVfZWxlbWVudCggJ29wdGlvbicsIHsgJ3ZhbHVlJzogJ3VybCcgfSwgZ2V0X3RleHQoICd1cmwnLCAnVVJMJyApICkgKTtcblx0XHRcdFx0XHR0eXBlX3NlbGVjdC5hcHBlbmRDaGlsZCggY3JlYXRlX2VsZW1lbnQoICdvcHRpb24nLCB7ICd2YWx1ZSc6ICdhbmNob3InIH0sIGdldF90ZXh0KCAnYW5jaG9yJywgJ0FuY2hvcicgKSApICk7XG5cdFx0XHRcdFx0dHlwZV9zZWxlY3QudmFsdWUgPSBsaW5rX29iai5saW5rX3R5cGU7XG5cblx0XHRcdFx0XHR0YXJnZXRfc2VsZWN0LmFwcGVuZENoaWxkKCBjcmVhdGVfZWxlbWVudCggJ29wdGlvbicsIHsgJ3ZhbHVlJzogJ19zZWxmJyB9LCAnX3NlbGYnICkgKTtcblx0XHRcdFx0XHR0YXJnZXRfc2VsZWN0LmFwcGVuZENoaWxkKCBjcmVhdGVfZWxlbWVudCggJ29wdGlvbicsIHsgJ3ZhbHVlJzogJ19ibGFuaycgfSwgJ19ibGFuaycgKSApO1xuXHRcdFx0XHRcdHRhcmdldF9zZWxlY3QudmFsdWUgICAgPSBsaW5rX29iai50YXJnZXQ7XG5cdFx0XHRcdFx0dGFyZ2V0X3NlbGVjdC5kaXNhYmxlZCA9ICdhbmNob3InID09PSBsaW5rX29iai5saW5rX3R5cGU7XG5cblx0XHRcdFx0XHRrZXlfaW5wdXQuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0a2V5X2lucHV0LnZhbHVlICAgICAgPSBub3JtYWxpemVfdG9rZW5fa2V5KCBrZXlfaW5wdXQudmFsdWUgKTtcblx0XHRcdFx0XHRcdGxpbmtzWyByb3dfaW5kZXggXS5rZXkgPSBrZXlfaW5wdXQudmFsdWUgfHwgJ2xpbmtfJyArIFN0cmluZyggcm93X2luZGV4ICsgMSApO1xuXHRcdFx0XHRcdFx0Y29tbWl0X2xpbmtzKCk7XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdHRleHRfY29udHJvbC5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRsaW5rc1sgcm93X2luZGV4IF0udGV4dCA9IHRleHRfY29udHJvbC52YWx1ZTtcblx0XHRcdFx0XHRcdGNvbW1pdF9saW5rcygpO1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR0eXBlX3NlbGVjdC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0bGlua3NbIHJvd19pbmRleCBdLmxpbmtfdHlwZSA9IG5vcm1hbGl6ZV9saW5rX3R5cGUoIHR5cGVfc2VsZWN0LnZhbHVlICk7XG5cdFx0XHRcdFx0XHR0YXJnZXRfc2VsZWN0LmRpc2FibGVkICAgICAgID0gJ2FuY2hvcicgPT09IGxpbmtzWyByb3dfaW5kZXggXS5saW5rX3R5cGU7XG5cdFx0XHRcdFx0XHRjb21taXRfbGlua3MoKTtcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0ZGVzdGluYXRpb25faW5wdXQuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0bGlua3NbIHJvd19pbmRleCBdLmRlc3RpbmF0aW9uID0gZGVzdGluYXRpb25faW5wdXQudmFsdWU7XG5cdFx0XHRcdFx0XHRjb21taXRfbGlua3MoKTtcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0dGFyZ2V0X3NlbGVjdC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0bGlua3NbIHJvd19pbmRleCBdLnRhcmdldCA9IG5vcm1hbGl6ZV90YXJnZXQoIHRhcmdldF9zZWxlY3QudmFsdWUgKTtcblx0XHRcdFx0XHRcdGNvbW1pdF9saW5rcygpO1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRjc3NfaW5wdXQuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0bGlua3NbIHJvd19pbmRleCBdLmNzc2NsYXNzID0gY3NzX2lucHV0LnZhbHVlO1xuXHRcdFx0XHRcdFx0Y29tbWl0X2xpbmtzKCk7XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdGR1cGxpY2F0ZV9idXR0b24uYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0bGlua3Muc3BsaWNlKCByb3dfaW5kZXggKyAxLCAwLCBjbG9uZV92YWx1ZSggbGlua3NbIHJvd19pbmRleCBdICkgKTtcblx0XHRcdFx0XHRcdGxpbmtzID0gbm9ybWFsaXplX2xpbmtzKCBsaW5rcyApO1xuXHRcdFx0XHRcdFx0cmVuZGVyX3Jvd3MoKTtcblx0XHRcdFx0XHRcdGNvbW1pdF9saW5rcygpO1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRyZW1vdmVfYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdGxpbmtzLnNwbGljZSggcm93X2luZGV4LCAxICk7XG5cdFx0XHRcdFx0XHRyZW5kZXJfcm93cygpO1xuXHRcdFx0XHRcdFx0Y29tbWl0X2xpbmtzKCk7XG5cdFx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdFx0cm93LmFwcGVuZENoaWxkKCBidWlsZF9sYWJlbGVkX2NvbnRyb2woIGdldF90ZXh0KCAndG9rZW5fa2V5JywgJ1Rva2VuIEtleScgKSwga2V5X2lucHV0ICkgKTtcblx0XHRcdFx0XHRyb3cuYXBwZW5kQ2hpbGQoIGJ1aWxkX2xhYmVsZWRfY29udHJvbCggZ2V0X3RleHQoICd2aXNpYmxlX3RleHQnLCAnVGV4dCcgKSwgdGV4dF9jb250cm9sICkgKTtcblx0XHRcdFx0XHRyb3cuYXBwZW5kQ2hpbGQoIGJ1aWxkX2xhYmVsZWRfY29udHJvbCggZ2V0X3RleHQoICdsaW5rX3R5cGUnLCAnVHlwZScgKSwgdHlwZV9zZWxlY3QgKSApO1xuXHRcdFx0XHRcdHJvdy5hcHBlbmRDaGlsZCggYnVpbGRfbGFiZWxlZF9jb250cm9sKCBnZXRfdGV4dCggJ2Rlc3RpbmF0aW9uJywgJ0Rlc3RpbmF0aW9uJyApLCBkZXN0aW5hdGlvbl9pbnB1dCApICk7XG5cdFx0XHRcdFx0cm93LmFwcGVuZENoaWxkKCBidWlsZF9sYWJlbGVkX2NvbnRyb2woIGdldF90ZXh0KCAndGFyZ2V0JywgJ1RhcmdldCcgKSwgdGFyZ2V0X3NlbGVjdCApICk7XG5cdFx0XHRcdFx0cm93LmFwcGVuZENoaWxkKCBidWlsZF9sYWJlbGVkX2NvbnRyb2woIGdldF90ZXh0KCAnY3NzX2NsYXNzJywgJ0NTUyBjbGFzcycgKSwgY3NzX2lucHV0ICkgKTtcblx0XHRcdFx0XHRhY3Rpb25zLmFwcGVuZENoaWxkKCBkdXBsaWNhdGVfYnV0dG9uICk7XG5cdFx0XHRcdFx0YWN0aW9ucy5hcHBlbmRDaGlsZCggcmVtb3ZlX2J1dHRvbiApO1xuXHRcdFx0XHRcdHJvdy5hcHBlbmRDaGlsZCggYWN0aW9ucyApO1xuXHRcdFx0XHRcdHJvd3NfbGlzdC5hcHBlbmRDaGlsZCggcm93ICk7XG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0YWRkX2J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFxuXHRcdFx0J2NsaWNrJyxcblx0XHRcdGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0dmFyIG1pc3NpbmdfdG9rZW5zID0gZ2V0X21pc3NpbmdfdG9rZW5zKCk7XG5cdFx0XHRcdHZhciBuZXh0X2tleSAgICAgICA9IG1pc3NpbmdfdG9rZW5zLmxlbmd0aCA/IG1pc3NpbmdfdG9rZW5zWyAwIF0gOiAnbGlua18nICsgU3RyaW5nKCBsaW5rcy5sZW5ndGggKyAxICk7XG5cblx0XHRcdFx0bGlua3MucHVzaChcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRrZXkgICAgICAgICA6IG5leHRfa2V5LFxuXHRcdFx0XHRcdFx0dGV4dCAgICAgICAgOiBuZXh0X2tleS5yZXBsYWNlKCAvXy9nLCAnICcgKSxcblx0XHRcdFx0XHRcdGxpbmtfdHlwZSAgIDogJ3VybCcsXG5cdFx0XHRcdFx0XHRkZXN0aW5hdGlvbiA6ICcnLFxuXHRcdFx0XHRcdFx0dGFyZ2V0ICAgICAgOiAnX2JsYW5rJyxcblx0XHRcdFx0XHRcdGNzc2NsYXNzICAgIDogJydcblx0XHRcdFx0XHR9XG5cdFx0XHRcdCk7XG5cdFx0XHRcdHJlbmRlcl9yb3dzKCk7XG5cdFx0XHRcdGNvbW1pdF9saW5rcygpO1xuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHRpZiAoIHRleHRfaW5wdXQgKSB7XG5cdFx0XHR0ZXh0X2lucHV0LmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIHJlbmRlcl90b2tlbnNfYW5kX3N0YXR1cyApO1xuXHRcdH1cblxuXHRcdHJlbmRlcl9yb3dzKCk7XG5cdFx0cmVuZGVyX3Rva2Vuc19hbmRfc3RhdHVzKCk7XG5cdH1cblxuXHQvKipcblx0ICogUmVnaXN0ZXIgdGhlIFN0YXRpYyBUZXh0IGxpbmsgZWRpdG9yIHdpdGggdGhlIEluc3BlY3RvciBGYWN0b3J5LlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gcmVnaXN0ZXJfZWRpdG9yX3Nsb3QoKSB7XG5cdFx0dy53cGJjX2JmYl9pbnNwZWN0b3JfZmFjdG9yeV9zbG90cyA9IHcud3BiY19iZmJfaW5zcGVjdG9yX2ZhY3Rvcnlfc2xvdHMgfHwge307XG5cdFx0dy53cGJjX2JmYl9pbnNwZWN0b3JfZmFjdG9yeV9zbG90cy5zdGF0aWNfdGV4dF9saW5rcyA9IHJlbmRlcl9lZGl0b3Jfc2xvdDtcblx0fVxuXG5cdHcuV1BCQ19CRkJfU3RhdGljX1RleHRfTGlua3MgPSB7XG5cdFx0YnVpbGRfY29udGVudF9odG1sICAgIDogYnVpbGRfY29udGVudF9odG1sLFxuXHRcdGV4dHJhY3RfdG9rZW5zICAgICAgICA6IGV4dHJhY3RfdG9rZW5zLFxuXHRcdG5vcm1hbGl6ZV9kZXN0aW5hdGlvbiA6IG5vcm1hbGl6ZV9kZXN0aW5hdGlvbixcblx0XHRub3JtYWxpemVfbGlua3MgICAgICAgOiBub3JtYWxpemVfbGlua3MsXG5cdFx0bm9ybWFsaXplX3Rva2VuX2tleSAgIDogbm9ybWFsaXplX3Rva2VuX2tleSxcblx0XHRyZWdpc3Rlcl9lZGl0b3Jfc2xvdCAgOiByZWdpc3Rlcl9lZGl0b3Jfc2xvdFxuXHR9O1xuXG5cdHJlZ2lzdGVyX2VkaXRvcl9zbG90KCk7XG5cbn0pKCB3aW5kb3csIGRvY3VtZW50ICk7XG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMsVUFBV0EsQ0FBQyxFQUFFQyxDQUFDLEVBQUc7RUFDbEIsWUFBWTs7RUFFWixJQUFJQyxJQUFJLEdBQUdGLENBQUMsQ0FBQ0csYUFBYSxJQUFJLENBQUMsQ0FBQztFQUNoQyxJQUFJQyxJQUFJLEdBQUdKLENBQUMsQ0FBQ0ssK0JBQStCLElBQUksQ0FBQyxDQUFDOztFQUVsRDtBQUNEO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0MsS0FBS0EsQ0FBQSxFQUFHO0lBQ2hCLE9BQU8sRUFBRTtFQUNWOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTQyxRQUFRQSxDQUFFQyxHQUFHLEVBQUVDLFFBQVEsRUFBRztJQUNsQyxPQUFPQyxNQUFNLENBQUVOLElBQUksQ0FBRUksR0FBRyxD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
