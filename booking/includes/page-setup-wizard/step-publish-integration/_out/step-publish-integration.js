"use strict";

/**
 * Drive the progressive Publish & integrate Setup Wizard page.
 *
 * The adapter updates presentation fields and validates the current draft. It
 * never creates, publishes, or changes a WordPress page.
 *
 * @package Booking Calendar
 */
(function (window, document) {
  'use strict';

  var module_config = window.wpbc_setup_wizard_publish_integration || {
    i18n: {}
  };

  /**
   * Create one isolated publishing-plan step adapter.
   *
   * @param {Object} config Localized messages.
   * @return {Object} Adapter accepted by the shared wizard shell.
   */
  function create_publish_integration_adapter(config) {
    var shell_api = null;
    var editor = null;

    /**
     * Return a localized message with a safe fallback.
     *
     * @param {string} key      Localized message key.
     * @param {string} fallback English fallback.
     * @return {string} Available message.
     */
    function get_message(key, fallback) {
      return config.i18n && config.i18n[key] ? String(config.i18n[key]) : fallback;
    }

    /**
     * Return the selected destination identifier.
     *
     * @return {string} Destination ID or an empty string.
     */
    function get_destination() {
      var selected = editor ? editor.node.querySelector('[data-wpbc-publish-destination]:checked') : null;
      return selected ? String(selected.value || '') : '';
    }

    /**
     * Toggle an element's semantic hidden state.
     *
     * @param {HTMLElement|null} element   Element to update.
     * @param {boolean}          is_hidden Whether the element is hidden.
     * @return {void}
     */
    function set_hidden(element, is_hidden) {
      if (!element) {
        return;
      }
      element.hidden = Boolean(is_hidden);
    }

    /**
     * Build a safe root-relative URL preview from a page title.
     *
     * @param {string} page_title Proposed page title.
     * @return {string} Root-relative preview URL.
     */
    function build_page_url(page_title) {
      var slug = '';
      var home_path = String(editor.node.dataset.homePath || '/');
      if (window.wp && window.wp.url && 'function' === typeof window.wp.url.cleanForSlug) {
        slug = window.wp.url.cleanForSlug(page_title);
      } else {
        slug = String(page_title || '').toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-').replace(/^-+|-+$/g, '');
      }
      home_path = '/' + home_path.replace(/^\/+|\/+$/g, '');
      if ('/' !== home_path) {
        home_path += '/';
      }
      return home_path + (slug || 'booking') + '/';
    }

    /**
     * Read the selected existing page's authorized display URL.
     *
     * @return {string} Root-relative page URL or an empty string.
     */
    function get_existing_page_url() {
      var option = editor.existing_page && editor.existing_page.selectedIndex >= 0 ? editor.existing_page.options[editor.existing_page.selectedIndex] : null;
      return option ? String(option.dataset.pageUrl || '') : '';
    }

    /**
     * Update the URL preview for the active page destination.
     *
     * @param {string} destination Active destination ID.
     * @return {void}
     */
    function update_page_url(destination) {
      if (!editor.page_url) {
        return;
      }
      if ('create_page' === destination) {
        editor.page_url.value = build_page_url(editor.page_title ? editor.page_title.value : '');
      } else if ('existing_page' === destination) {
        editor.page_url.value = get_existing_page_url();
      } else {
        editor.page_url.value = '';
      }
    }

    /**
     * Update journey-aware content details and shortcode presentation.
     *
     * @return {void}
     */
    function update_content_details() {
      var option = editor.content && editor.content.selectedIndex >= 0 ? editor.content.options[editor.content.selectedIndex] : null;
      if (!option) {
        return;
      }
      if (editor.content_title) {
        editor.content_title.textContent = option.textContent.trim();
      }
      if (editor.content_description) {
        editor.content_description.textContent = String(option.dataset.contentDescription || '');
      }
      if (editor.shortcode) {
        editor.shortcode.value = String(option.dataset.contentShortcode || '');
      }
      if (editor.shortcode_help) {
        editor.shortcode_help.href = String(option.dataset.contentHelpUrl || '');
        editor.shortcode_help.hidden = !option.dataset.contentHelpUrl;
      }
      if (editor.shortcode_help_label) {
        editor.shortcode_help_label.textContent = String(option.dataset.contentHelpLabel || '');
      }
    }

    /**
     * Return destination-specific approval notice copy.
     *
     * @param {string} destination Active destination ID.
     * @return {string} Notice message.
     */
    function get_notice(destination) {
      if ('existing_page' === destination) {
        return get_message('notice_existing', 'Save adds or updates one managed Booking Calendar block without replacing the page\'s other content.');
      }
      if ('manual' === destination) {
        return get_message('notice_manual', 'Save records this shortcode for the setup summary. No WordPress page is created or changed.');
      }
      if ('later' === destination) {
        return get_message('notice_later', 'No page will be created or changed. You can integrate the booking experience later.');
      }
      return get_message('notice_create', 'Save this step to create the booking page now, or update the same page on a later save.');
    }

    /**
     * Return the server-localized primary action label for a destination.
     *
     * @param {string} destination Active destination ID.
     * @return {string} Primary action label.
     */
    function get_action_label(destination) {
      if ('create_page' === destination) {
        return '1' === editor.node.dataset.hasCreatedPage ? get_message('action_update', 'Update page & continue') : get_message('action_create', 'Create page & continue');
      }
      if ('existing_page' === destination) {
        return get_message('action_update', 'Update page & continue');
      }
      return get_message('action_save', 'Save & continue');
    }

    /**
     * Synchronize all conditional fields with the selected destination.
     *
     * @return {void}
     */
    function render_destination() {
      var destination = get_destination();
      var is_create = 'create_page' === destination;
      var is_existing = 'existing_page' === destination;
      var is_later = 'later' === destination;
      editor.cards.forEach(function (card) {
        var control = card.querySelector('[data-wpbc-publish-destination]');
        card.classList.toggle('is-selected', Boolean(control && control.checked));
      });
      set_hidden(editor.create_field, !is_create);
      set_hidden(editor.existing_field, !is_existing);
      set_hidden(editor.url_field, !is_create && !is_existing);
      set_hidden(editor.settings_body, is_later);
      set_hidden(editor.later_panel, !is_later);
      if (editor.page_title) {
        editor.page_title.required = is_create;
      }
      if (editor.existing_page) {
        editor.existing_page.required = is_existing;
      }
      if (editor.content) {
        editor.content.required = !is_later;
      }
      if (editor.notice_text) {
        editor.notice_text.textContent = get_notice(destination);
      }
      if (editor.continue_label) {
        editor.continue_label.textContent = get_action_label(destination);
      }
      update_page_url(destination);
    }

    /**
     * Copy text while preserving keyboard focus on the invoking button.
     *
     * @param {string}      text   Text to copy.
     * @param {HTMLElement} button Invoking button.
     * @return {Promise<void>} Completion promise.
     */
    function copy_text(text, button) {
      var clipboard_promise;
      if (navigator.clipboard && 'function' === typeof navigator.clipboard.writeText) {
        clipboard_promise = navigator.clipboard.writeText(text);
      } else {
        clipboard_promise = new Promise(function (resolve, reject) {
          var temporary = document.createElement('textarea');
          temporary.value = text;
          temporary.setAttribute('readonly', 'readonly');
          temporary.style.position = 'fixed';
          temporary.style.opacity = '0';
          document.body.appendChild(temporary);
          temporary.select();
          if (document.execCommand('copy')) {
            resolve();
          } else {
            reject(new Error('copy_failed'));
          }
          temporary.remove();
        });
      }
      return clipboard_promise.then(function () {
        shell_api.set_status(get_message('copied', 'Copied to the clipboard.'));
        button.focus();
      }).catch(function () {
        shell_api.set_status(get_message('copy_failed', 'Copy failed. Select the text and copy it manually.'));
        button.focus();
      });
    }

    /**
     * Handle destination and copy-button clicks.
     *
     * @param {MouseEvent} event Click event.
     * @return {void}
     */
    function handle_click(event) {
      var copy_button = event.target.closest('[data-wpbc-publish-copy]');
      var copy_type;
      var copy_source;
      if (!copy_button || !editor.node.contains(copy_button)) {
        return;
      }
      copy_type = String(copy_button.dataset.wpbcPublishCopy || '');
      copy_source = 'page-url' === copy_type ? editor.page_url : editor.shortcode;
      if (copy_source && copy_source.value) {
        copy_text(String(copy_source.value), copy_button);
      }
    }

    /**
     * Handle select and radio changes.
     *
     * @param {Event} event Change event.
     * @return {void}
     */
    function handle_change(event) {
      if (event.target.matches('[data-wpbc-publish-destination]')) {
        render_destination();
      } else if (event.target === editor.content) {
        update_content_details();
      } else if (event.target === editor.existing_page) {
        update_page_url(get_destination());
      }
    }

    /**
     * Initialize the adapter against shell-owned services.
     *
     * @param {Object} registered_shell_api Shared wizard adapter services.
     * @return {void}
     */
    function initialize(registered_shell_api) {
      var editor_node;
      shell_api = registered_shell_api;
      editor_node = shell_api.root.querySelector('[data-wpbc-publish-integration-editor]');
      if (!editor_node) {
        return;
      }
      editor = {
        node: editor_node,
        cards: Array.prototype.slice.call(editor_node.querySelectorAll('.wpbc_setup_wizard__publish-destination-card')),
        create_field: editor_node.querySelector('[data-wpbc-publish-create-field]'),
        existing_field: editor_node.querySelector('[data-wpbc-publish-existing-field]'),
        url_field: editor_node.querySelector('[data-wpbc-publish-page-url-field]'),
        settings_body: editor_node.querySelector('[data-wpbc-publish-settings-body]'),
        later_panel: editor_node.querySelector('[data-wpbc-publish-later-panel]'),
        page_title: editor_node.querySelector('[data-wpbc-publish-page-title]'),
        existing_page: editor_node.querySelector('[data-wpbc-publish-existing-page]'),
        page_url: editor_node.querySelector('[data-wpbc-publish-page-url]'),
        content: editor_node.querySelector('[data-wpbc-publish-page-content]'),
        content_title: editor_node.querySelector('[data-wpbc-publish-content-title]'),
        content_description: editor_node.querySelector('[data-wpbc-publish-content-description]'),
        shortcode_help: editor_node.querySelector('[data-wpbc-publish-shortcode-help]'),
        shortcode_help_label: editor_node.querySelector('[data-wpbc-publish-shortcode-help-label]'),
        shortcode: editor_node.querySelector('[data-wpbc-publish-shortcode]'),
        notice_text: editor_node.querySelector('[data-wpbc-publish-notice-text]'),
        continue_label: shell_api.root.querySelector('[data-wpbc-setup-wizard-direction="next"] > span')
      };
      editor.node.addEventListener('click', handle_click);
      editor.node.addEventListener('change', handle_change);
      if (editor.page_title) {
        editor.page_title.addEventListener('input', function () {
          update_page_url(get_destination());
        });
      }
      render_destination();
      update_content_details();
    }

    /**
     * Validate destination-specific fields before forward navigation.
     *
     * @return {HTMLElement|null} First invalid control or null.
     */
    function validate() {
      var destination = get_destination();
      if ('create_page' === destination && (!editor.page_title || !editor.page_title.value.trim())) {
        return shell_api.set_field_error('publish_page_title', get_message('title_required', 'Enter a page title.'));
      }
      if ('existing_page' === destination && (!editor.existing_page || '0' === editor.existing_page.value)) {
        return shell_api.set_field_error('publish_existing_page_id', get_message('page_required', 'Choose a WordPress page.'));
      }
      if ('later' !== destination && (!editor.content || !editor.content.value)) {
        return shell_api.set_field_error('publish_page_content', get_message('content_required', 'Choose the booking experience to display.'));
      }
      return null;
    }
    return {
      initialize: initialize,
      sync: render_destination,
      validate: validate
    };
  }
  window.wpbc_setup_editor_modules = window.wpbc_setup_editor_modules || {};
  window.wpbc_setup_editor_modules.publish_integration = {
    create: create_publish_integration_adapter
  };
  if (window.wpbc_setup_wizard_api && 'function' === typeof window.wpbc_setup_wizard_api.register_step_adapter) {
    window.wpbc_setup_wizard_api.register_step_adapter(create_publish_integration_adapter(module_config));
  }
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR1cC13aXphcmQvc3RlcC1wdWJsaXNoLWludGVncmF0aW9uL19vdXQvc3RlcC1wdWJsaXNoLWludGVncmF0aW9uLmpzIiwibmFtZXMiOlsid2luZG93IiwiZG9jdW1lbnQiLCJtb2R1bGVfY29uZmlnIiwid3BiY19zZXR1cF93aXphcmRfcHVibGlzaF9pbnRlZ3JhdGlvbiIsImkxOG4iLCJjcmVhdGVfcHVibGlzaF9pbnRlZ3JhdGlvbl9hZGFwdGVyIiwiY29uZmlnIiwic2hlbGxfYXBpIiwiZWRpdG9yIiwiZ2V0X21lc3NhZ2UiLCJrZXkiLCJmYWxsYmFjayIsIlN0cmluZyIsImdldF9kZXN0aW5hdGlvbiIsInNlbGVjdGVkIiwibm9kZSIsInF1ZXJ5U2VsZWN0b3IiLCJ2YWx1ZSIsInNldF9oaWRkZW4iLCJlbGVtZW50IiwiaXNfaGlkZGVuIiwiaGlkZGVuIiwiQm9vbGVhbiIsImJ1aWxkX3BhZ2VfdXJsIiwicGFnZV90aXRsZSIsInNsdWciLCJob21lX3BhdGgiLCJkYXRhc2V0IiwiaG9tZVBhdGgiLCJ3cCIsInVybCIsImNsZWFuRm9yU2x1ZyIsInRvTG93ZXJDYXNlIiwidHJpbSIsInJlcGxhY2UiLCJnZXRfZXhpc3RpbmdfcGFnZV91cmwiLCJvcHRpb24iLCJleGlzdGluZ19wYWdlIiwic2VsZWN0ZWRJbmRleCIsIm9wdGlvbnMiLCJwYWdlVXJsIiwidXBkYXRlX3BhZ2VfdXJsIiwiZGVzdGluYXRpb24iLCJwYWdlX3VybCIsInVwZGF0ZV9jb250ZW50X2RldGFpbHMiLCJjb250ZW50IiwiY29udGVudF90aXRsZSIsInRleHRDb250ZW50IiwiY29udGVudF9kZXNjcmlwdGlvbiIsImNvbnRlbnREZXNjcmlwdGlvbiIsInNob3J0Y29kZSIsImNvbnRlbnRTaG9ydGNvZGUiLCJzaG9ydGNvZGVfaGVscCIsImhyZWYiLCJjb250ZW50SGVscFVybCIsInNob3J0Y29kZV9oZWxwX2xhYmVsIiwiY29udGVudEhlbHBMYWJlbCIsImdldF9ub3RpY2UiLCJnZXRfYWN0aW9uX2xhYmVsIiwiaGFzQ3JlYXRlZFBhZ2UiLCJyZW5kZXJfZGVzdGluYXRpb24iLCJpc19jcmVhdGUiLCJpc19leGlzdGluZyIsImlzX2xhdGVyIiwiY2FyZHMiLCJmb3JFYWNoIiwiY2FyZCIsImNvbnRyb2wiLCJjbGFzc0xpc3QiLCJ0b2dnbGUiLCJjaGVja2VkIiwiY3JlYXRlX2ZpZWxkIiwiZXhpc3RpbmdfZmllbGQiLCJ1cmxfZmllbGQiLCJzZXR0aW5nc19ib2R5IiwibGF0ZXJfcGFuZWwiLCJyZXF1aXJlZCIsIm5vdGljZV90ZXh0IiwiY29udGludWVfbGFiZWwiLCJjb3B5X3RleHQiLCJ0ZXh0IiwiYnV0dG9uIiwiY2xpcGJvYXJkX3Byb21pc2UiLCJuYXZpZ2F0b3IiLCJjbGlwYm9hcmQiLCJ3cml0ZVRleHQiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsInRlbXBvcmFyeSIsImNyZWF0ZUVsZW1lbnQiLCJzZXRBdHRyaWJ1dGUiLCJzdHlsZSIsInBvc2l0aW9uIiwib3BhY2l0eSIsImJvZHkiLCJhcHBlbmRDaGlsZCIsInNlbGVjdCIsImV4ZWNDb21tYW5kIiwiRXJyb3IiLCJyZW1vdmUiLCJ0aGVuIiwic2V0X3N0YXR1cyIsImZvY3VzIiwiY2F0Y2giLCJoYW5kbGVfY2xpY2siLCJldmVudCIsImNvcHlfYnV0dG9uIiwidGFyZ2V0IiwiY2xvc2VzdCIsImNvcHlfdHlwZSIsImNvcHlfc291cmNlIiwiY29udGFpbnMiLCJ3cGJjUHVibGlzaENvcHkiLCJoYW5kbGVfY2hhbmdlIiwibWF0Y2hlcyIsImluaXRpYWxpemUiLCJyZWdpc3RlcmVkX3NoZWxsX2FwaSIsImVkaXRvcl9ub2RlIiwicm9vdCIsIkFycmF5IiwicHJvdG90eXBlIiwic2xpY2UiLCJjYWxsIiwicXVlcnlTZWxlY3RvckFsbCIsImFkZEV2ZW50TGlzdGVuZXIiLCJ2YWxpZGF0ZSIsInNldF9maWVsZF9lcnJvciIsInN5bmMiLCJ3cGJjX3NldHVwX2VkaXRvcl9tb2R1bGVzIiwicHVibGlzaF9pbnRlZ3JhdGlvbiIsImNyZWF0ZSIsIndwYmNfc2V0dXBfd2l6YXJkX2FwaSIsInJlZ2lzdGVyX3N0ZXBfYWRhcHRlciJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2Utc2V0dXAtd2l6YXJkL3N0ZXAtcHVibGlzaC1pbnRlZ3JhdGlvbi9fc3JjL3N0ZXAtcHVibGlzaC1pbnRlZ3JhdGlvbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIERyaXZlIHRoZSBwcm9ncmVzc2l2ZSBQdWJsaXNoICYgaW50ZWdyYXRlIFNldHVwIFdpemFyZCBwYWdlLlxuICpcbiAqIFRoZSBhZGFwdGVyIHVwZGF0ZXMgcHJlc2VudGF0aW9uIGZpZWxkcyBhbmQgdmFsaWRhdGVzIHRoZSBjdXJyZW50IGRyYWZ0LiBJdFxuICogbmV2ZXIgY3JlYXRlcywgcHVibGlzaGVzLCBvciBjaGFuZ2VzIGEgV29yZFByZXNzIHBhZ2UuXG4gKlxuICogQHBhY2thZ2UgQm9va2luZyBDYWxlbmRhclxuICovXG4oIGZ1bmN0aW9uICggd2luZG93LCBkb2N1bWVudCApIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdHZhciBtb2R1bGVfY29uZmlnID0gd2luZG93LndwYmNfc2V0dXBfd2l6YXJkX3B1Ymxpc2hfaW50ZWdyYXRpb24gfHwgeyBpMThuOiB7fSB9O1xuXG5cdC8qKlxuXHQgKiBDcmVhdGUgb25lIGlzb2xhdGVkIHB1Ymxpc2hpbmctcGxhbiBzdGVwIGFkYXB0ZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgTG9jYWxpemVkIG1lc3NhZ2VzLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IEFkYXB0ZXIgYWNjZXB0ZWQgYnkgdGhlIHNoYXJlZCB3aXphcmQgc2hlbGwuXG5cdCAqL1xuXHRmdW5jdGlvbiBjcmVhdGVfcHVibGlzaF9pbnRlZ3JhdGlvbl9hZGFwdGVyKCBjb25maWcgKSB7XG5cdFx0dmFyIHNoZWxsX2FwaSA9IG51bGw7XG5cdFx0dmFyIGVkaXRvciA9IG51bGw7XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gYSBsb2NhbGl6ZWQgbWVzc2FnZSB3aXRoIGEgc2FmZSBmYWxsYmFjay5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgICAgICBMb2NhbGl6ZWQgbWVzc2FnZSBrZXkuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGZhbGxiYWNrIEVuZ2xpc2ggZmFsbGJhY2suXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBBdmFpbGFibGUgbWVzc2FnZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfbWVzc2FnZSgga2V5LCBmYWxsYmFjayApIHtcblx0XHRcdHJldHVybiBjb25maWcuaTE4biAmJiBjb25maWcuaTE4blsga2V5IF0gPyBTdHJpbmcoIGNvbmZpZy5pMThuWyBrZXkgXSApIDogZmFsbGJhY2s7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBzZWxlY3RlZCBkZXN0aW5hdGlvbiBpZGVudGlmaWVyLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBEZXN0aW5hdGlvbiBJRCBvciBhbiBlbXB0eSBzdHJpbmcuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2Rlc3RpbmF0aW9uKCkge1xuXHRcdFx0dmFyIHNlbGVjdGVkID0gZWRpdG9yID8gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtcHVibGlzaC1kZXN0aW5hdGlvbl06Y2hlY2tlZCcgKSA6IG51bGw7XG5cblx0XHRcdHJldHVybiBzZWxlY3RlZCA/IFN0cmluZyggc2VsZWN0ZWQudmFsdWUgfHwgJycgKSA6ICcnO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFRvZ2dsZSBhbiBlbGVtZW50J3Mgc2VtYW50aWMgaGlkZGVuIHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSBlbGVtZW50ICAgRWxlbWVudCB0byB1cGRhdGUuXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSAgICAgICAgICBpc19oaWRkZW4gV2hldGhlciB0aGUgZWxlbWVudCBpcyBoaWRkZW4uXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfaGlkZGVuKCBlbGVtZW50LCBpc19oaWRkZW4gKSB7XG5cdFx0XHRpZiAoICEgZWxlbWVudCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRlbGVtZW50LmhpZGRlbiA9IEJvb2xlYW4oIGlzX2hpZGRlbiApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEJ1aWxkIGEgc2FmZSByb290LXJlbGF0aXZlIFVSTCBwcmV2aWV3IGZyb20gYSBwYWdlIHRpdGxlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHBhZ2VfdGl0bGUgUHJvcG9zZWQgcGFnZSB0aXRsZS5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IFJvb3QtcmVsYXRpdmUgcHJldmlldyBVUkwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYnVpbGRfcGFnZV91cmwoIHBhZ2VfdGl0bGUgKSB7XG5cdFx0XHR2YXIgc2x1ZyA9ICcnO1xuXHRcdFx0dmFyIGhvbWVfcGF0aCA9IFN0cmluZyggZWRpdG9yLm5vZGUuZGF0YXNldC5ob21lUGF0aCB8fCAnLycgKTtcblxuXHRcdFx0aWYgKCB3aW5kb3cud3AgJiYgd2luZG93LndwLnVybCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwLnVybC5jbGVhbkZvclNsdWcgKSB7XG5cdFx0XHRcdHNsdWcgPSB3aW5kb3cud3AudXJsLmNsZWFuRm9yU2x1ZyggcGFnZV90aXRsZSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c2x1ZyA9IFN0cmluZyggcGFnZV90aXRsZSB8fCAnJyApXG5cdFx0XHRcdFx0LnRvTG93ZXJDYXNlKClcblx0XHRcdFx0XHQudHJpbSgpXG5cdFx0XHRcdFx0LnJlcGxhY2UoIC9bXmEtejAtOVxccy1dL2csICcnIClcblx0XHRcdFx0XHQucmVwbGFjZSggL1tcXHMtXSsvZywgJy0nIClcblx0XHRcdFx0XHQucmVwbGFjZSggL14tK3wtKyQvZywgJycgKTtcblx0XHRcdH1cblxuXHRcdFx0aG9tZV9wYXRoID0gJy8nICsgaG9tZV9wYXRoLnJlcGxhY2UoIC9eXFwvK3xcXC8rJC9nLCAnJyApO1xuXHRcdFx0aWYgKCAnLycgIT09IGhvbWVfcGF0aCApIHtcblx0XHRcdFx0aG9tZV9wYXRoICs9ICcvJztcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGhvbWVfcGF0aCArICggc2x1ZyB8fCAnYm9va2luZycgKSArICcvJztcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWFkIHRoZSBzZWxlY3RlZCBleGlzdGluZyBwYWdlJ3MgYXV0aG9yaXplZCBkaXNwbGF5IFVSTC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gUm9vdC1yZWxhdGl2ZSBwYWdlIFVSTCBvciBhbiBlbXB0eSBzdHJpbmcuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2V4aXN0aW5nX3BhZ2VfdXJsKCkge1xuXHRcdFx0dmFyIG9wdGlvbiA9IGVkaXRvci5leGlzdGluZ19wYWdlICYmIGVkaXRvci5leGlzdGluZ19wYWdlLnNlbGVjdGVkSW5kZXggPj0gMFxuXHRcdFx0XHQ/IGVkaXRvci5leGlzdGluZ19wYWdlLm9wdGlvbnNbIGVkaXRvci5leGlzdGluZ19wYWdlLnNlbGVjdGVkSW5kZXggXVxuXHRcdFx0XHQ6IG51bGw7XG5cblx0XHRcdHJldHVybiBvcHRpb24gPyBTdHJpbmcoIG9wdGlvbi5kYXRhc2V0LnBhZ2VVcmwgfHwgJycgKSA6ICcnO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFVwZGF0ZSB0aGUgVVJMIHByZXZpZXcgZm9yIHRoZSBhY3RpdmUgcGFnZSBkZXN0aW5hdGlvbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBkZXN0aW5hdGlvbiBBY3RpdmUgZGVzdGluYXRpb24gSUQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB1cGRhdGVfcGFnZV91cmwoIGRlc3RpbmF0aW9uICkge1xuXHRcdFx0aWYgKCAhIGVkaXRvci5wYWdlX3VybCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoICdjcmVhdGVfcGFnZScgPT09IGRlc3RpbmF0aW9uICkge1xuXHRcdFx0XHRlZGl0b3IucGFnZV91cmwudmFsdWUgPSBidWlsZF9wYWdlX3VybCggZWRpdG9yLnBhZ2VfdGl0bGUgPyBlZGl0b3IucGFnZV90aXRsZS52YWx1ZSA6ICcnICk7XG5cdFx0XHR9IGVsc2UgaWYgKCAnZXhpc3RpbmdfcGFnZScgPT09IGRlc3RpbmF0aW9uICkge1xuXHRcdFx0XHRlZGl0b3IucGFnZV91cmwudmFsdWUgPSBnZXRfZXhpc3RpbmdfcGFnZV91cmwoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGVkaXRvci5wYWdlX3VybC52YWx1ZSA9ICcnO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFVwZGF0ZSBqb3VybmV5LWF3YXJlIGNvbnRlbnQgZGV0YWlscyBhbmQgc2hvcnRjb2RlIHByZXNlbnRhdGlvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gdXBkYXRlX2NvbnRlbnRfZGV0YWlscygpIHtcblx0XHRcdHZhciBvcHRpb24gPSBlZGl0b3IuY29udGVudCAmJiBlZGl0b3IuY29udGVudC5zZWxlY3RlZEluZGV4ID49IDBcblx0XHRcdFx0PyBlZGl0b3IuY29udGVudC5vcHRpb25zWyBlZGl0b3IuY29udGVudC5zZWxlY3RlZEluZGV4IF1cblx0XHRcdFx0OiBudWxsO1xuXG5cdFx0XHRpZiAoICEgb3B0aW9uICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICggZWRpdG9yLmNvbnRlbnRfdGl0bGUgKSB7XG5cdFx0XHRcdGVkaXRvci5jb250ZW50X3RpdGxlLnRleHRDb250ZW50ID0gb3B0aW9uLnRleHRDb250ZW50LnRyaW0oKTtcblx0XHRcdH1cblx0XHRcdGlmICggZWRpdG9yLmNvbnRlbnRfZGVzY3JpcHRpb24gKSB7XG5cdFx0XHRcdGVkaXRvci5jb250ZW50X2Rlc2NyaXB0aW9uLnRleHRDb250ZW50ID0gU3RyaW5nKCBvcHRpb24uZGF0YXNldC5jb250ZW50RGVzY3JpcHRpb24gfHwgJycgKTtcblx0XHRcdH1cblx0XHRcdGlmICggZWRpdG9yLnNob3J0Y29kZSApIHtcblx0XHRcdFx0ZWRpdG9yLnNob3J0Y29kZS52YWx1ZSA9IFN0cmluZyggb3B0aW9uLmRhdGFzZXQuY29udGVudFNob3J0Y29kZSB8fCAnJyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBlZGl0b3Iuc2hvcnRjb2RlX2hlbHAgKSB7XG5cdFx0XHRcdGVkaXRvci5zaG9ydGNvZGVfaGVscC5ocmVmID0gU3RyaW5nKCBvcHRpb24uZGF0YXNldC5jb250ZW50SGVscFVybCB8fCAnJyApO1xuXHRcdFx0XHRlZGl0b3Iuc2hvcnRjb2RlX2hlbHAuaGlkZGVuID0gISBvcHRpb24uZGF0YXNldC5jb250ZW50SGVscFVybDtcblx0XHRcdH1cblx0XHRcdGlmICggZWRpdG9yLnNob3J0Y29kZV9oZWxwX2xhYmVsICkge1xuXHRcdFx0XHRlZGl0b3Iuc2hvcnRjb2RlX2hlbHBfbGFiZWwudGV4dENvbnRlbnQgPSBTdHJpbmcoIG9wdGlvbi5kYXRhc2V0LmNvbnRlbnRIZWxwTGFiZWwgfHwgJycgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gZGVzdGluYXRpb24tc3BlY2lmaWMgYXBwcm92YWwgbm90aWNlIGNvcHkuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZGVzdGluYXRpb24gQWN0aXZlIGRlc3RpbmF0aW9uIElELlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gTm90aWNlIG1lc3NhZ2UuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X25vdGljZSggZGVzdGluYXRpb24gKSB7XG5cdFx0XHRpZiAoICdleGlzdGluZ19wYWdlJyA9PT0gZGVzdGluYXRpb24gKSB7XG5cdFx0XHRcdHJldHVybiBnZXRfbWVzc2FnZSggJ25vdGljZV9leGlzdGluZycsICdTYXZlIGFkZHMgb3IgdXBkYXRlcyBvbmUgbWFuYWdlZCBCb29raW5nIENhbGVuZGFyIGJsb2NrIHdpdGhvdXQgcmVwbGFjaW5nIHRoZSBwYWdlXFwncyBvdGhlciBjb250ZW50LicgKTtcblx0XHRcdH1cblx0XHRcdGlmICggJ21hbnVhbCcgPT09IGRlc3RpbmF0aW9uICkge1xuXHRcdFx0XHRyZXR1cm4gZ2V0X21lc3NhZ2UoICdub3RpY2VfbWFudWFsJywgJ1NhdmUgcmVjb3JkcyB0aGlzIHNob3J0Y29kZSBmb3IgdGhlIHNldHVwIHN1bW1hcnkuIE5vIFdvcmRQcmVzcyBwYWdlIGlzIGNyZWF0ZWQgb3IgY2hhbmdlZC4nICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdsYXRlcicgPT09IGRlc3RpbmF0aW9uICkge1xuXHRcdFx0XHRyZXR1cm4gZ2V0X21lc3NhZ2UoICdub3RpY2VfbGF0ZXInLCAnTm8gcGFnZSB3aWxsIGJlIGNyZWF0ZWQgb3IgY2hhbmdlZC4gWW91IGNhbiBpbnRlZ3JhdGUgdGhlIGJvb2tpbmcgZXhwZXJpZW5jZSBsYXRlci4nICk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBnZXRfbWVzc2FnZSggJ25vdGljZV9jcmVhdGUnLCAnU2F2ZSB0aGlzIHN0ZXAgdG8gY3JlYXRlIHRoZSBib29raW5nIHBhZ2Ugbm93LCBvciB1cGRhdGUgdGhlIHNhbWUgcGFnZSBvbiBhIGxhdGVyIHNhdmUuJyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgc2VydmVyLWxvY2FsaXplZCBwcmltYXJ5IGFjdGlvbiBsYWJlbCBmb3IgYSBkZXN0aW5hdGlvbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBkZXN0aW5hdGlvbiBBY3RpdmUgZGVzdGluYXRpb24gSUQuXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBQcmltYXJ5IGFjdGlvbiBsYWJlbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfYWN0aW9uX2xhYmVsKCBkZXN0aW5hdGlvbiApIHtcblx0XHRcdGlmICggJ2NyZWF0ZV9wYWdlJyA9PT0gZGVzdGluYXRpb24gKSB7XG5cdFx0XHRcdHJldHVybiAnMScgPT09IGVkaXRvci5ub2RlLmRhdGFzZXQuaGFzQ3JlYXRlZFBhZ2Vcblx0XHRcdFx0XHQ/IGdldF9tZXNzYWdlKCAnYWN0aW9uX3VwZGF0ZScsICdVcGRhdGUgcGFnZSAmIGNvbnRpbnVlJyApXG5cdFx0XHRcdFx0OiBnZXRfbWVzc2FnZSggJ2FjdGlvbl9jcmVhdGUnLCAnQ3JlYXRlIHBhZ2UgJiBjb250aW51ZScgKTtcblx0XHRcdH1cblx0XHRcdGlmICggJ2V4aXN0aW5nX3BhZ2UnID09PSBkZXN0aW5hdGlvbiApIHtcblx0XHRcdFx0cmV0dXJuIGdldF9tZXNzYWdlKCAnYWN0aW9uX3VwZGF0ZScsICdVcGRhdGUgcGFnZSAmIGNvbnRpbnVlJyApO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZ2V0X21lc3NhZ2UoICdhY3Rpb25fc2F2ZScsICdTYXZlICYgY29udGludWUnICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3luY2hyb25pemUgYWxsIGNvbmRpdGlvbmFsIGZpZWxkcyB3aXRoIHRoZSBzZWxlY3RlZCBkZXN0aW5hdGlvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX2Rlc3RpbmF0aW9uKCkge1xuXHRcdFx0dmFyIGRlc3RpbmF0aW9uID0gZ2V0X2Rlc3RpbmF0aW9uKCk7XG5cdFx0XHR2YXIgaXNfY3JlYXRlID0gJ2NyZWF0ZV9wYWdlJyA9PT0gZGVzdGluYXRpb247XG5cdFx0XHR2YXIgaXNfZXhpc3RpbmcgPSAnZXhpc3RpbmdfcGFnZScgPT09IGRlc3RpbmF0aW9uO1xuXHRcdFx0dmFyIGlzX2xhdGVyID0gJ2xhdGVyJyA9PT0gZGVzdGluYXRpb247XG5cblx0XHRcdGVkaXRvci5jYXJkcy5mb3JFYWNoKCBmdW5jdGlvbiAoIGNhcmQgKSB7XG5cdFx0XHRcdHZhciBjb250cm9sID0gY2FyZC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1wdWJsaXNoLWRlc3RpbmF0aW9uXScgKTtcblxuXHRcdFx0XHRjYXJkLmNsYXNzTGlzdC50b2dnbGUoICdpcy1zZWxlY3RlZCcsIEJvb2xlYW4oIGNvbnRyb2wgJiYgY29udHJvbC5jaGVja2VkICkgKTtcblx0XHRcdH0gKTtcblxuXHRcdFx0c2V0X2hpZGRlbiggZWRpdG9yLmNyZWF0ZV9maWVsZCwgISBpc19jcmVhdGUgKTtcblx0XHRcdHNldF9oaWRkZW4oIGVkaXRvci5leGlzdGluZ19maWVsZCwgISBpc19leGlzdGluZyApO1xuXHRcdFx0c2V0X2hpZGRlbiggZWRpdG9yLnVybF9maWVsZCwgISBpc19jcmVhdGUgJiYgISBpc19leGlzdGluZyApO1xuXHRcdFx0c2V0X2hpZGRlbiggZWRpdG9yLnNldHRpbmdzX2JvZHksIGlzX2xhdGVyICk7XG5cdFx0XHRzZXRfaGlkZGVuKCBlZGl0b3IubGF0ZXJfcGFuZWwsICEgaXNfbGF0ZXIgKTtcblxuXHRcdFx0aWYgKCBlZGl0b3IucGFnZV90aXRsZSApIHtcblx0XHRcdFx0ZWRpdG9yLnBhZ2VfdGl0bGUucmVxdWlyZWQgPSBpc19jcmVhdGU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGVkaXRvci5leGlzdGluZ19wYWdlICkge1xuXHRcdFx0XHRlZGl0b3IuZXhpc3RpbmdfcGFnZS5yZXF1aXJlZCA9IGlzX2V4aXN0aW5nO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBlZGl0b3IuY29udGVudCApIHtcblx0XHRcdFx0ZWRpdG9yLmNvbnRlbnQucmVxdWlyZWQgPSAhIGlzX2xhdGVyO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBlZGl0b3Iubm90aWNlX3RleHQgKSB7XG5cdFx0XHRcdGVkaXRvci5ub3RpY2VfdGV4dC50ZXh0Q29udGVudCA9IGdldF9ub3RpY2UoIGRlc3RpbmF0aW9uICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGVkaXRvci5jb250aW51ZV9sYWJlbCApIHtcblx0XHRcdFx0ZWRpdG9yLmNvbnRpbnVlX2xhYmVsLnRleHRDb250ZW50ID0gZ2V0X2FjdGlvbl9sYWJlbCggZGVzdGluYXRpb24gKTtcblx0XHRcdH1cblxuXHRcdFx0dXBkYXRlX3BhZ2VfdXJsKCBkZXN0aW5hdGlvbiApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENvcHkgdGV4dCB3aGlsZSBwcmVzZXJ2aW5nIGtleWJvYXJkIGZvY3VzIG9uIHRoZSBpbnZva2luZyBidXR0b24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICB0ZXh0ICAgVGV4dCB0byBjb3B5LlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGJ1dHRvbiBJbnZva2luZyBidXR0b24uXG5cdFx0ICogQHJldHVybiB7UHJvbWlzZTx2b2lkPn0gQ29tcGxldGlvbiBwcm9taXNlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNvcHlfdGV4dCggdGV4dCwgYnV0dG9uICkge1xuXHRcdFx0dmFyIGNsaXBib2FyZF9wcm9taXNlO1xuXG5cdFx0XHRpZiAoIG5hdmlnYXRvci5jbGlwYm9hcmQgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0ICkge1xuXHRcdFx0XHRjbGlwYm9hcmRfcHJvbWlzZSA9IG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KCB0ZXh0ICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjbGlwYm9hcmRfcHJvbWlzZSA9IG5ldyBQcm9taXNlKCBmdW5jdGlvbiAoIHJlc29sdmUsIHJlamVjdCApIHtcblx0XHRcdFx0XHR2YXIgdGVtcG9yYXJ5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3RleHRhcmVhJyApO1xuXG5cdFx0XHRcdFx0dGVtcG9yYXJ5LnZhbHVlID0gdGV4dDtcblx0XHRcdFx0XHR0ZW1wb3Jhcnkuc2V0QXR0cmlidXRlKCAncmVhZG9ubHknLCAncmVhZG9ubHknICk7XG5cdFx0XHRcdFx0dGVtcG9yYXJ5LnN0eWxlLnBvc2l0aW9uID0gJ2ZpeGVkJztcblx0XHRcdFx0XHR0ZW1wb3Jhcnkuc3R5bGUub3BhY2l0eSA9ICcwJztcblx0XHRcdFx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCB0ZW1wb3JhcnkgKTtcblx0XHRcdFx0XHR0ZW1wb3Jhcnkuc2VsZWN0KCk7XG5cdFx0XHRcdFx0aWYgKCBkb2N1bWVudC5leGVjQ29tbWFuZCggJ2NvcHknICkgKSB7XG5cdFx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJlamVjdCggbmV3IEVycm9yKCAnY29weV9mYWlsZWQnICkgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGVtcG9yYXJ5LnJlbW92ZSgpO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBjbGlwYm9hcmRfcHJvbWlzZS50aGVuKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHNoZWxsX2FwaS5zZXRfc3RhdHVzKCBnZXRfbWVzc2FnZSggJ2NvcGllZCcsICdDb3BpZWQgdG8gdGhlIGNsaXBib2FyZC4nICkgKTtcblx0XHRcdFx0YnV0dG9uLmZvY3VzKCk7XG5cdFx0XHR9ICkuY2F0Y2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0c2hlbGxfYXBpLnNldF9zdGF0dXMoIGdldF9tZXNzYWdlKCAnY29weV9mYWlsZWQnLCAnQ29weSBmYWlsZWQuIFNlbGVjdCB0aGUgdGV4dCBhbmQgY29weSBpdCBtYW51YWxseS4nICkgKTtcblx0XHRcdFx0YnV0dG9uLmZvY3VzKCk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSGFuZGxlIGRlc3RpbmF0aW9uIGFuZCBjb3B5LWJ1dHRvbiBjbGlja3MuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGV2ZW50IENsaWNrIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2NsaWNrKCBldmVudCApIHtcblx0XHRcdHZhciBjb3B5X2J1dHRvbiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1wdWJsaXNoLWNvcHldJyApO1xuXHRcdFx0dmFyIGNvcHlfdHlwZTtcblx0XHRcdHZhciBjb3B5X3NvdXJjZTtcblxuXHRcdFx0aWYgKCAhIGNvcHlfYnV0dG9uIHx8ICEgZWRpdG9yLm5vZGUuY29udGFpbnMoIGNvcHlfYnV0dG9uICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29weV90eXBlID0gU3RyaW5nKCBjb3B5X2J1dHRvbi5kYXRhc2V0LndwYmNQdWJsaXNoQ29weSB8fCAnJyApO1xuXHRcdFx0Y29weV9zb3VyY2UgPSAncGFnZS11cmwnID09PSBjb3B5X3R5cGUgPyBlZGl0b3IucGFnZV91cmwgOiBlZGl0b3Iuc2hvcnRjb2RlO1xuXHRcdFx0aWYgKCBjb3B5X3NvdXJjZSAmJiBjb3B5X3NvdXJjZS52YWx1ZSApIHtcblx0XHRcdFx0Y29weV90ZXh0KCBTdHJpbmcoIGNvcHlfc291cmNlLnZhbHVlICksIGNvcHlfYnV0dG9uICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSGFuZGxlIHNlbGVjdCBhbmQgcmFkaW8gY2hhbmdlcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50IENoYW5nZSBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9jaGFuZ2UoIGV2ZW50ICkge1xuXHRcdFx0aWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtcHVibGlzaC1kZXN0aW5hdGlvbl0nICkgKSB7XG5cdFx0XHRcdHJlbmRlcl9kZXN0aW5hdGlvbigpO1xuXHRcdFx0fSBlbHNlIGlmICggZXZlbnQudGFyZ2V0ID09PSBlZGl0b3IuY29udGVudCApIHtcblx0XHRcdFx0dXBkYXRlX2NvbnRlbnRfZGV0YWlscygpO1xuXHRcdFx0fSBlbHNlIGlmICggZXZlbnQudGFyZ2V0ID09PSBlZGl0b3IuZXhpc3RpbmdfcGFnZSApIHtcblx0XHRcdFx0dXBkYXRlX3BhZ2VfdXJsKCBnZXRfZGVzdGluYXRpb24oKSApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEluaXRpYWxpemUgdGhlIGFkYXB0ZXIgYWdhaW5zdCBzaGVsbC1vd25lZCBzZXJ2aWNlcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZWdpc3RlcmVkX3NoZWxsX2FwaSBTaGFyZWQgd2l6YXJkIGFkYXB0ZXIgc2VydmljZXMuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbml0aWFsaXplKCByZWdpc3RlcmVkX3NoZWxsX2FwaSApIHtcblx0XHRcdHZhciBlZGl0b3Jfbm9kZTtcblxuXHRcdFx0c2hlbGxfYXBpID0gcmVnaXN0ZXJlZF9zaGVsbF9hcGk7XG5cdFx0XHRlZGl0b3Jfbm9kZSA9IHNoZWxsX2FwaS5yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXB1Ymxpc2gtaW50ZWdyYXRpb24tZWRpdG9yXScgKTtcblx0XHRcdGlmICggISBlZGl0b3Jfbm9kZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRlZGl0b3IgPSB7XG5cdFx0XHRcdG5vZGU6IGVkaXRvcl9ub2RlLFxuXHRcdFx0XHRjYXJkczogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19zZXR1cF93aXphcmRfX3B1Ymxpc2gtZGVzdGluYXRpb24tY2FyZCcgKSApLFxuXHRcdFx0XHRjcmVhdGVfZmllbGQ6IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXB1Ymxpc2gtY3JlYXRlLWZpZWxkXScgKSxcblx0XHRcdFx0ZXhpc3RpbmdfZmllbGQ6IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXB1Ymxpc2gtZXhpc3RpbmctZmllbGRdJyApLFxuXHRcdFx0XHR1cmxfZmllbGQ6IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXB1Ymxpc2gtcGFnZS11cmwtZmllbGRdJyApLFxuXHRcdFx0XHRzZXR0aW5nc19ib2R5OiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1wdWJsaXNoLXNldHRpbmdzLWJvZHldJyApLFxuXHRcdFx0XHRsYXRlcl9wYW5lbDogZWRpdG9yX25vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtcHVibGlzaC1sYXRlci1wYW5lbF0nICksXG5cdFx0XHRcdHBhZ2VfdGl0bGU6IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXB1Ymxpc2gtcGFnZS10aXRsZV0nICksXG5cdFx0XHRcdGV4aXN0aW5nX3BhZ2U6IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXB1Ymxpc2gtZXhpc3RpbmctcGFnZV0nICksXG5cdFx0XHRcdHBhZ2VfdXJsOiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1wdWJsaXNoLXBhZ2UtdXJsXScgKSxcblx0XHRcdFx0Y29udGVudDogZWRpdG9yX25vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtcHVibGlzaC1wYWdlLWNvbnRlbnRdJyApLFxuXHRcdFx0XHRjb250ZW50X3RpdGxlOiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1wdWJsaXNoLWNvbnRlbnQtdGl0bGVdJyApLFxuXHRcdFx0XHRjb250ZW50X2Rlc2NyaXB0aW9uOiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1wdWJsaXNoLWNvbnRlbnQtZGVzY3JpcHRpb25dJyApLFxuXHRcdFx0XHRzaG9ydGNvZGVfaGVscDogZWRpdG9yX25vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtcHVibGlzaC1zaG9ydGNvZGUtaGVscF0nICksXG5cdFx0XHRcdHNob3J0Y29kZV9oZWxwX2xhYmVsOiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1wdWJsaXNoLXNob3J0Y29kZS1oZWxwLWxhYmVsXScgKSxcblx0XHRcdFx0c2hvcnRjb2RlOiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1wdWJsaXNoLXNob3J0Y29kZV0nICksXG5cdFx0XHRcdG5vdGljZV90ZXh0OiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1wdWJsaXNoLW5vdGljZS10ZXh0XScgKSxcblx0XHRcdFx0Y29udGludWVfbGFiZWw6IHNoZWxsX2FwaS5yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNldHVwLXdpemFyZC1kaXJlY3Rpb249XCJuZXh0XCJdID4gc3BhbicgKVxuXHRcdFx0fTtcblxuXHRcdFx0ZWRpdG9yLm5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgaGFuZGxlX2NsaWNrICk7XG5cdFx0XHRlZGl0b3Iubm9kZS5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgaGFuZGxlX2NoYW5nZSApO1xuXHRcdFx0aWYgKCBlZGl0b3IucGFnZV90aXRsZSApIHtcblx0XHRcdFx0ZWRpdG9yLnBhZ2VfdGl0bGUuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdHVwZGF0ZV9wYWdlX3VybCggZ2V0X2Rlc3RpbmF0aW9uKCkgKTtcblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXG5cdFx0XHRyZW5kZXJfZGVzdGluYXRpb24oKTtcblx0XHRcdHVwZGF0ZV9jb250ZW50X2RldGFpbHMoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBWYWxpZGF0ZSBkZXN0aW5hdGlvbi1zcGVjaWZpYyBmaWVsZHMgYmVmb3JlIGZvcndhcmQgbmF2aWdhdGlvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge0hUTUxFbGVtZW50fG51bGx9IEZpcnN0IGludmFsaWQgY29udHJvbCBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHZhbGlkYXRlKCkge1xuXHRcdFx0dmFyIGRlc3RpbmF0aW9uID0gZ2V0X2Rlc3RpbmF0aW9uKCk7XG5cblx0XHRcdGlmICggJ2NyZWF0ZV9wYWdlJyA9PT0gZGVzdGluYXRpb24gJiYgKCAhIGVkaXRvci5wYWdlX3RpdGxlIHx8ICEgZWRpdG9yLnBhZ2VfdGl0bGUudmFsdWUudHJpbSgpICkgKSB7XG5cdFx0XHRcdHJldHVybiBzaGVsbF9hcGkuc2V0X2ZpZWxkX2Vycm9yKCAncHVibGlzaF9wYWdlX3RpdGxlJywgZ2V0X21lc3NhZ2UoICd0aXRsZV9yZXF1aXJlZCcsICdFbnRlciBhIHBhZ2UgdGl0bGUuJyApICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdleGlzdGluZ19wYWdlJyA9PT0gZGVzdGluYXRpb24gJiYgKCAhIGVkaXRvci5leGlzdGluZ19wYWdlIHx8ICcwJyA9PT0gZWRpdG9yLmV4aXN0aW5nX3BhZ2UudmFsdWUgKSApIHtcblx0XHRcdFx0cmV0dXJuIHNoZWxsX2FwaS5zZXRfZmllbGRfZXJyb3IoICdwdWJsaXNoX2V4aXN0aW5nX3BhZ2VfaWQnLCBnZXRfbWVzc2FnZSggJ3BhZ2VfcmVxdWlyZWQnLCAnQ2hvb3NlIGEgV29yZFByZXNzIHBhZ2UuJyApICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdsYXRlcicgIT09IGRlc3RpbmF0aW9uICYmICggISBlZGl0b3IuY29udGVudCB8fCAhIGVkaXRvci5jb250ZW50LnZhbHVlICkgKSB7XG5cdFx0XHRcdHJldHVybiBzaGVsbF9hcGkuc2V0X2ZpZWxkX2Vycm9yKCAncHVibGlzaF9wYWdlX2NvbnRlbnQnLCBnZXRfbWVzc2FnZSggJ2NvbnRlbnRfcmVxdWlyZWQnLCAnQ2hvb3NlIHRoZSBib29raW5nIGV4cGVyaWVuY2UgdG8gZGlzcGxheS4nICkgKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGluaXRpYWxpemU6IGluaXRpYWxpemUsXG5cdFx0XHRzeW5jOiByZW5kZXJfZGVzdGluYXRpb24sXG5cdFx0XHR2YWxpZGF0ZTogdmFsaWRhdGVcblx0XHR9O1xuXHR9XG5cblx0d2luZG93LndwYmNfc2V0dXBfZWRpdG9yX21vZHVsZXMgPSB3aW5kb3cud3BiY19zZXR1cF9lZGl0b3JfbW9kdWxlcyB8fCB7fTtcblx0d2luZG93LndwYmNfc2V0dXBfZWRpdG9yX21vZHVsZXMucHVibGlzaF9pbnRlZ3JhdGlvbiA9IHsgY3JlYXRlOiBjcmVhdGVfcHVibGlzaF9pbnRlZ3JhdGlvbl9hZGFwdGVyIH07XG5cblx0aWYgKCB3aW5kb3cud3BiY19zZXR1cF93aXphcmRfYXBpICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19zZXR1cF93aXphcmRfYXBpLnJlZ2lzdGVyX3N0ZXBfYWRhcHRlciApIHtcblx0XHR3aW5kb3cud3BiY19zZXR1cF93aXphcmRfYXBpLnJlZ2lzdGVyX3N0ZXBfYWRhcHRlciggY3JlYXRlX3B1Ymxpc2hfaW50ZWdyYXRpb25fYWRhcHRlciggbW9kdWxlX2NvbmZpZyApICk7XG5cdH1cbn0oIHdpbmRvdywgZG9jdW1lbnQgKSApO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDRSxXQUFXQSxNQUFNLEVBQUVDLFFBQVEsRUFBRztFQUMvQixZQUFZOztFQUVaLElBQUlDLGFBQWEsR0FBR0YsTUFBTSxDQUFDRyxxQ0FBcUMsSUFBSTtJQUFFQyxJQUFJLEVBQUUsQ0FBQztFQUFFLENBQUM7O0VBRWhGO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLGtDQUFrQ0EsQ0FBRUMsTUFBTSxFQUFHO0lBQ3JELElBQUlDLFNBQVMsR0FBRyxJQUFJO0lBQ3BCLElBQUlDLE1BQU0sR0FB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
