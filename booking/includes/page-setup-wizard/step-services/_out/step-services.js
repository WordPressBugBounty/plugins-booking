"use strict";

/**
 * Provide the reusable progressively saved Service editor used by Setup Wizard.
 *
 * The module owns Service presentation, local draft synchronization, media
 * preview behavior, and early validation. Persistence and authorization remain
 * server-owned. The number input remains authoritative when paired with a
 * range input so keyboard users can enter exact minute values.
 *
 * @package Booking Calendar
 */
(function ($, window, document) {
  'use strict';

  var module_config = window.wpbc_setup_wizard_services || {
    i18n: {}
  };

  /**
   * Create one isolated Service editor adapter.
   *
   * @param {Object} config Module translations and presentation settings.
   * @return {Object} Step adapter accepted by the shared wizard shell.
   */
  function create_services_adapter(config) {
    var shell_api = null;
    var root = null;
    var editor = null;

    /**
     * Return one translated string with a safe fallback.
     *
     * @param {string} key      Translation key.
     * @param {string} fallback Fallback copy.
     * @return {string} Translation or fallback.
     */
    function get_message(key, fallback) {
      return config.i18n && config.i18n[key] ? config.i18n[key] : fallback;
    }

    /**
     * Replace one string placeholder without interpreting replacement tokens.
     *
     * @param {string} message     Translated message containing `%s`.
     * @param {string} replacement Plain-text replacement.
     * @return {string} Formatted message.
     */
    function format_message(message, replacement) {
      return String(message).replace('%s', function () {
        return String(replacement);
      });
    }

    /**
     * Create one unsaved Service proposal using safe presentation defaults.
     *
     * @return {Object} JSON-safe Service proposal.
     */
    function create_service_draft() {
      return {
        draft_id: 'draft-' + Date.now() + '-' + Math.floor(Math.random() * 100000),
        source_service_id: 0,
        title: get_message('new_service', 'New Service'),
        description: '',
        picture_url: '',
        duration_minutes: 30,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        base_cost: '0.00',
        status: 'active'
      };
    }

    /**
     * Return one editable Service field control.
     *
     * @param {string} field_name Stable Service DTO field.
     * @return {HTMLElement|null} Matching field control.
     */
    function get_service_field(field_name) {
      return editor ? editor.node.querySelector('[data-wpbc-service-field="' + field_name + '"]') : null;
    }

    /**
     * Synchronize both explicit Service transport fields.
     *
     * Canonical lifecycle intent is kept separate from the visible proposal
     * collection so omission alone can never move a Service to Draft.
     *
     * @return {void}
     */
    function sync_transports() {
      if (!editor) {
        return;
      }
      editor.transport.value = JSON.stringify(editor.services);
      editor.inactive_transport.value = JSON.stringify(editor.inactive_service_ids);
    }

    /**
     * Synchronize a range input from its authoritative number control.
     *
     * Invalid number input is intentionally left visible for validation and is
     * not allowed to coerce the stored draft silently.
     *
     * @param {string} field_name Stable numeric Service field.
     * @return {void}
     */
    function sync_range_from_number(field_name) {
      var number_control = get_service_field(field_name);
      var range_control = editor && editor.node.querySelector('[data-wpbc-service-range="' + field_name + '"]');
      var number_value;
      if (!number_control || !range_control) {
        return;
      }
      number_value = Number(number_control.value);
      if (isFinite(number_value) && number_value >= Number(range_control.min) && number_value <= Number(range_control.max)) {
        range_control.value = String(number_value);
      }
    }

    /**
     * Persist the current detail controls into the in-memory draft collection.
     *
     * @return {void}
     */
    function sync_selected_service() {
      var service;
      if (!editor || !editor.services[editor.selected_index]) {
        return;
      }
      service = editor.services[editor.selected_index];
      ['title', 'description', 'picture_url', 'duration_minutes', 'buffer_before_minutes', 'buffer_after_minutes', 'base_cost'].forEach(function (field_name) {
        var field = get_service_field(field_name);
        if (field && !field.disabled) {
          service[field_name] = field.value;
        }
      });
      service.status = 'active';
      sync_transports();
    }

    /**
     * Update the Service picture preview from the URL control.
     *
     * @return {void}
     */
    function update_service_picture() {
      var url_field = get_service_field('picture_url');
      var image = editor && editor.node.querySelector('[data-wpbc-service-picture-image]');
      var placeholder = editor && editor.node.querySelector('[data-wpbc-service-picture-placeholder]');
      var remove_button = editor && editor.node.querySelector('[data-wpbc-remove-service-picture]');
      var picture_url = url_field ? String(url_field.value || '').trim() : '';
      if (image) {
        image.hidden = !picture_url;
        if (picture_url) {
          image.src = picture_url;
        } else {
          image.removeAttribute('src');
        }
      }
      if (placeholder) {
        placeholder.hidden = Boolean(picture_url);
      }
      if (remove_button) {
        remove_button.disabled = !picture_url;
      }
    }

    /**
     * Format a Service duration as localized hours and minutes.
     *
     * The formatter is presentation-only. Canonical Service draft values remain
     * integer minutes for validation and persistence.
     *
     * @param {number|string} duration_minutes Canonical duration in minutes.
     * @return {string} Human-readable duration such as "2 hours and 3 minutes".
     */
    function format_service_duration(duration_minutes) {
      var parsed_minutes = Number(duration_minutes);
      var total_minutes = isFinite(parsed_minutes) && parsed_minutes >= 0 ? Math.floor(parsed_minutes) : 0;
      var hours = Math.floor(total_minutes / 60);
      var minutes = total_minutes % 60;
      var duration_parts = [];
      var locale = document.documentElement.getAttribute('lang') || undefined;
      if (window.Intl && 'function' === typeof window.Intl.NumberFormat) {
        try {
          if (hours) {
            duration_parts.push(new window.Intl.NumberFormat(locale, {
              style: 'unit',
              unit: 'hour',
              unitDisplay: 'long'
            }).format(hours));
          }
          if (minutes || !hours) {
            duration_parts.push(new window.Intl.NumberFormat(locale, {
              style: 'unit',
              unit: 'minute',
              unitDisplay: 'long'
            }).format(minutes));
          }
        } catch (formatter_error) {
          duration_parts = [];
        }
      }
      if (!duration_parts.length) {
        if (hours) {
          duration_parts.push(String(hours) + ' ' + get_message(1 === hours ? 'hour_singular' : 'hour_plural', 1 === hours ? 'hour' : 'hours'));
        }
        if (minutes || !hours) {
          duration_parts.push(String(minutes) + ' ' + get_message(1 === minutes ? 'minute_singular' : 'minute_plural', 1 === minutes ? 'minute' : 'minutes'));
        }
      }
      if (1 === duration_parts.length) {
        return duration_parts[0];
      }
      if (window.Intl && 'function' === typeof window.Intl.ListFormat) {
        try {
          return new window.Intl.ListFormat(locale, {
            style: 'long',
            type: 'conjunction'
          }).format(duration_parts);
        } catch (list_formatter_error) {
          // Fall through to the translated conjunction for older browsers.
        }
      }
      return duration_parts.join(' ' + get_message('duration_joiner', 'and') + ' ');
    }

    /**
     * Update the customer-facing title and duration preview.
     *
     * @return {void}
     */
    function update_service_summary() {
      var summary = editor && editor.node.querySelector('[data-wpbc-service-summary]');
      var title = get_service_field('title');
      var duration = get_service_field('duration_minutes');
      if (summary) {
        summary.textContent = (title && title.value.trim() ? title.value.trim() : get_message('new_service', 'New Service')) + ' · ' + format_service_duration(duration ? duration.value : 30);
      }
    }

    /**
     * Load the selected proposal into the detail controls and preview.
     *
     * @return {void}
     */
    function load_selected_service() {
      var service;
      if (!editor) {
        return;
      }
      service = editor.services[editor.selected_index];
      if (!service) {
        return;
      }
      ['title', 'description', 'picture_url', 'duration_minutes', 'buffer_before_minutes', 'buffer_after_minutes', 'base_cost'].forEach(function (field_name) {
        var field = get_service_field(field_name);
        if (field) {
          field.value = null === service[field_name] || undefined === service[field_name] ? '' : service[field_name];
        }
      });
      ['duration_minutes', 'buffer_before_minutes', 'buffer_after_minutes'].forEach(sync_range_from_number);
      update_service_picture();
      update_service_summary();
    }

    /**
     * Render the proposal chooser from the data-only draft collection.
     *
     * @return {void}
     */
    function render_service_cards() {
      if (!editor || !editor.list || !editor.template) {
        return;
      }
      editor.list.textContent = '';
      editor.services.forEach(function (service, service_index) {
        var card = editor.template.content.firstElementChild.cloneNode(true);
        var radio = card.querySelector('input[type="radio"]');
        var image = card.querySelector('img');
        var placeholder = card.querySelector('i');
        var title = card.querySelector('strong');
        var duration = card.querySelector('[data-wpbc-service-card-duration]');
        var remove_button = card.querySelector('[data-wpbc-remove-service]');
        var picture_url = String(service.picture_url || '').trim();
        var service_title = service.title || get_message('new_service', 'New Service');
        radio.value = String(service_index);
        radio.checked = service_index === editor.selected_index;
        radio.dataset.wpbcServiceSelection = String(service_index);
        card.classList.toggle('is-selected', radio.checked);
        title.textContent = service_title;
        duration.textContent = format_service_duration(null === service.duration_minutes || undefined === service.duration_minutes || '' === service.duration_minutes ? 30 : service.duration_minutes);
        if (remove_button) {
          remove_button.dataset.wpbcRemoveService = String(service_index);
          remove_button.disabled = 1 === editor.services.length;
          if (Number(service.source_service_id) > 0) {
            remove_button.setAttribute('aria-label', format_message(get_message('move_service_to_draft', 'Move %s to Draft'), service_title));
            remove_button.title = format_message(get_message('move_service_to_draft', 'Move %s to Draft'), service_title);
          } else {
            remove_button.setAttribute('aria-label', format_message(get_message('remove_service', 'Remove %s'), service_title));
            remove_button.title = format_message(get_message('remove_service', 'Remove %s'), service_title);
          }
        }
        if (picture_url) {
          image.src = picture_url;
          image.hidden = false;
          placeholder.hidden = true;
        } else {
          image.hidden = true;
          image.removeAttribute('src');
          placeholder.hidden = false;
        }
        editor.list.appendChild(card);
      });
    }

    /**
     * Remove one proposal and explicitly stage a canonical Service for Draft.
     *
     * The required final Service cannot be removed. Canonical storage is not
     * changed until Save; unsaved proposals have no canonical lifecycle action.
     *
     * @param {number} service_index Zero-based Service draft index.
     * @return {void}
     */
    function remove_service(service_index) {
      var focus_target;
      var removed_service;
      var source_service_id;
      var status_message;
      if (!editor || !isFinite(service_index) || service_index !== Math.floor(service_index) || editor.services.length <= 1 || service_index < 0 || service_index >= editor.services.length) {
        return;
      }
      sync_selected_service();
      removed_service = editor.services[service_index];
      source_service_id = Number(removed_service.source_service_id || 0);
      if (source_service_id > 0 && -1 === editor.inactive_service_ids.indexOf(source_service_id)) {
        editor.inactive_service_ids.push(source_service_id);
      }
      editor.services.splice(service_index, 1);
      if (service_index < editor.selected_index) {
        editor.selected_index -= 1;
      } else if (service_index === editor.selected_index) {
        editor.selected_index = Math.min(service_index, editor.services.length - 1);
      }
      render_service_editor();
      shell_api.clear_field_error('services');
      status_message = source_service_id > 0 ? format_message(get_message('service_draft_pending', '%s will move to Draft when you save.'), removed_service.title || get_message('new_service', 'New Service')) : get_message('service_removed', 'Unsaved Service removed from this setup.');
      shell_api.set_status(status_message);
      focus_target = editor.list.querySelector('[data-wpbc-remove-service="' + editor.selected_index + '"]');
      if (focus_target && focus_target.disabled) {
        focus_target = editor.node.querySelector('[data-wpbc-add-service]');
      }
      if (focus_target) {
        focus_target.focus();
      }
    }

    /**
     * Refresh all Service editor presentation and its JSON transport field.
     *
     * @return {void}
     */
    function render_service_editor() {
      var add_button;
      if (!editor) {
        return;
      }
      editor.selected_index = Math.min(editor.selected_index, editor.services.length - 1);
      sync_transports();
      render_service_cards();
      load_selected_service();
      add_button = editor.node.querySelector('[data-wpbc-add-service]');
      if (add_button) {
        add_button.disabled = editor.services.length >= editor.max_services;
      }
    }

    /**
     * Handle Service editor button actions.
     *
     * @param {MouseEvent} event Delegated click event.
     * @return {void}
     */
    function handle_click(event) {
      var add_button = event.target.closest('[data-wpbc-add-service]');
      var remove_service_button = event.target.closest('[data-wpbc-remove-service]');
      var remove_picture_button = event.target.closest('[data-wpbc-remove-service-picture]');
      if (remove_service_button) {
        event.preventDefault();
        event.stopPropagation();
        remove_service(parseInt(remove_service_button.dataset.wpbcRemoveService, 10));
        return;
      }
      if (add_button) {
        event.preventDefault();
        if (editor.services.length >= editor.max_services) {
          shell_api.set_status(get_message('service_limit', 'The maximum number of Service drafts has been reached.'));
          return;
        }
        sync_selected_service();
        editor.services.push(create_service_draft());
        editor.selected_index = editor.services.length - 1;
        render_service_editor();
        get_service_field('title').select();
        return;
      }
      if (remove_picture_button) {
        event.preventDefault();
        get_service_field('picture_url').value = '';
        sync_selected_service();
        update_service_picture();
        render_service_cards();
      }
    }

    /**
     * Handle selection and committed field changes.
     *
     * @param {Event} event Delegated change event.
     * @return {void}
     */
    function handle_change(event) {
      if (event.target.matches('[data-wpbc-service-selection]')) {
        sync_selected_service();
        editor.selected_index = parseInt(event.target.dataset.wpbcServiceSelection, 10);
        render_service_editor();
        return;
      }
      if (event.target.matches('[data-wpbc-service-field]')) {
        sync_range_from_number(event.target.dataset.wpbcServiceField);
        sync_selected_service();
        update_service_picture();
        update_service_summary();
        render_service_cards();
        shell_api.clear_field_error('services');
      }
    }

    /**
     * Handle live number, range, and text edits.
     *
     * @param {InputEvent} event Delegated input event.
     * @return {void}
     */
    function handle_input(event) {
      var field_name;
      var number_control;
      if (event.target.matches('[data-wpbc-service-range]')) {
        field_name = event.target.dataset.wpbcServiceRange;
        number_control = get_service_field(field_name);
        if (number_control) {
          number_control.value = event.target.value;
        }
      } else if (event.target.matches('[data-wpbc-service-field]')) {
        field_name = event.target.dataset.wpbcServiceField;
        sync_range_from_number(field_name);
      } else {
        return;
      }
      sync_selected_service();
      update_service_picture();
      update_service_summary();
      render_service_cards();
      shell_api.clear_field_error('services');
    }

    /**
     * Refresh the media preview after the shared WordPress picker writes a URL.
     *
     * @return {void}
     */
    function handle_media_url_set() {
      if (!editor) {
        return;
      }
      sync_selected_service();
      update_service_picture();
      render_service_cards();
    }

    /**
     * Initialize this module against shell-provided services.
     *
     * @param {Object} registered_shell_api Shared wizard adapter services.
     * @return {void}
     */
    function initialize(registered_shell_api) {
      var parsed_services;
      var parsed_inactive_service_ids;
      var editor_node;
      var transport;
      var inactive_transport;
      shell_api = registered_shell_api;
      root = shell_api.root;
      editor_node = root.querySelector('[data-wpbc-services-editor]');
      transport = root.querySelector('[data-wpbc-service-draft]');
      inactive_transport = root.querySelector('[data-wpbc-inactive-service-ids]');
      if (!editor_node || !transport || !inactive_transport) {
        return;
      }
      try {
        parsed_services = JSON.parse(transport.value || '[]');
      } catch (parse_error) {
        parsed_services = [];
      }
      if (!Array.isArray(parsed_services)) {
        parsed_services = [];
      }
      try {
        parsed_inactive_service_ids = JSON.parse(inactive_transport.value || '[]');
      } catch (inactive_parse_error) {
        parsed_inactive_service_ids = [];
      }
      if (!Array.isArray(parsed_inactive_service_ids)) {
        parsed_inactive_service_ids = [];
      }
      parsed_inactive_service_ids = parsed_inactive_service_ids.map(Number).filter(function (service_id, service_index, service_ids) {
        return isFinite(service_id) && service_id === Math.floor(service_id) && service_id > 0 && service_ids.indexOf(service_id) === service_index;
      });
      editor = {
        node: editor_node,
        transport: transport,
        inactive_transport: inactive_transport,
        list: editor_node.querySelector('[data-wpbc-services-list]'),
        template: root.querySelector('[data-wpbc-service-card-template]'),
        services: parsed_services,
        inactive_service_ids: parsed_inactive_service_ids,
        selected_index: 0,
        max_services: parseInt(transport.dataset.maxServices || '20', 10),
        pricing_available: 'true' === editor_node.dataset.pricingAvailable
      };
      if (!editor.services.length) {
        editor.services.push(create_service_draft());
      }
      editor.node.addEventListener('click', handle_click);
      editor.node.addEventListener('change', handle_change);
      editor.node.addEventListener('input', handle_input);
      $(document).on('wpbc_media_upload_url_set.wpbcSetupWizardServices', '#wpbc-setup-wizard-service-picture-url', handle_media_url_set);
      render_service_editor();
    }

    /**
     * Validate all proposed Services before forward navigation.
     *
     * @return {HTMLElement|null} First invalid detail control, or null.
     */
    function validate() {
      var first_invalid = null;
      if (!editor || !editor.services.length) {
        return shell_api.set_field_error('services', get_message('service_title_required', 'Enter a title for every Service.'));
      }
      sync_selected_service();
      editor.services.some(function (service, service_index) {
        var invalid_field_name = '';
        var numeric_fields = [{
          key: 'duration_minutes',
          min: 1,
          max: 1440
        }, {
          key: 'buffer_before_minutes',
          min: 0,
          max: 1440
        }, {
          key: 'buffer_after_minutes',
          min: 0,
          max: 1440
        }];
        var invalid_number = numeric_fields.some(function (rule) {
          var number_value = Number(service[rule.key]);
          var is_invalid = !/^\d+$/.test(String(service[rule.key])) || number_value < rule.min || number_value > rule.max;
          if (is_invalid) {
            invalid_field_name = rule.key;
          }
          return is_invalid;
        });
        var base_cost = Number(service.base_cost);
        if (!invalid_number && editor.pricing_available && (!isFinite(base_cost) || base_cost < 0 || base_cost > 1000)) {
          invalid_number = true;
          invalid_field_name = 'base_cost';
        }
        if (!String(service.title || '').trim() || invalid_number) {
          editor.selected_index = service_index;
          render_service_editor();
          first_invalid = get_service_field(!String(service.title || '').trim() ? 'title' : invalid_field_name);
          shell_api.set_field_error('services', !String(service.title || '').trim() ? get_message('service_title_required', 'Enter a title for every Service.') : get_message('service_number_invalid', 'Enter a valid number within the available range.'));
          return true;
        }
        return false;
      });
      return first_invalid;
    }
    return {
      initialize: initialize,
      sync: sync_selected_service,
      validate: validate
    };
  }
  window.wpbc_setup_editor_modules = window.wpbc_setup_editor_modules || {};
  window.wpbc_setup_editor_modules.services = {
    create: create_services_adapter
  };
  if (window.wpbc_setup_wizard_api && 'function' === typeof window.wpbc_setup_wizard_api.register_step_adapter) {
    window.wpbc_setup_wizard_api.register_step_adapter(create_services_adapter(module_config));
  }
})(jQuery, window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR1cC13aXphcmQvc3RlcC1zZXJ2aWNlcy9fb3V0L3N0ZXAtc2VydmljZXMuanMiLCJuYW1lcyI6WyIkIiwid2luZG93IiwiZG9jdW1lbnQiLCJtb2R1bGVfY29uZmlnIiwid3BiY19zZXR1cF93aXphcmRfc2VydmljZXMiLCJpMThuIiwiY3JlYXRlX3NlcnZpY2VzX2FkYXB0ZXIiLCJjb25maWciLCJzaGVsbF9hcGkiLCJyb290IiwiZWRpdG9yIiwiZ2V0X21lc3NhZ2UiLCJrZXkiLCJmYWxsYmFjayIsImZvcm1hdF9tZXNzYWdlIiwibWVzc2FnZSIsInJlcGxhY2VtZW50IiwiU3RyaW5nIiwicmVwbGFjZSIsImNyZWF0ZV9zZXJ2aWNlX2RyYWZ0IiwiZHJhZnRfaWQiLCJEYXRlIiwibm93IiwiTWF0aCIsImZsb29yIiwicmFuZG9tIiwic291cmNlX3NlcnZpY2VfaWQiLCJ0aXRsZSIsImRlc2NyaXB0aW9uIiwicGljdHVyZV91cmwiLCJkdXJhdGlvbl9taW51dGVzIiwiYnVmZmVyX2JlZm9yZV9taW51dGVzIiwiYnVmZmVyX2FmdGVyX21pbnV0ZXMiLCJiYXNlX2Nvc3QiLCJzdGF0dXMiLCJnZXRfc2VydmljZV9maWVsZCIsImZpZWxkX25hbWUiLCJub2RlIiwicXVlcnlTZWxlY3RvciIsInN5bmNfdHJhbnNwb3J0cyIsInRyYW5zcG9ydCIsInZhbHVlIiwiSlNPTiIsInN0cmluZ2lmeSIsInNlcnZpY2VzIiwiaW5hY3RpdmVfdHJhbnNwb3J0IiwiaW5hY3RpdmVfc2VydmljZV9pZHMiLCJzeW5jX3JhbmdlX2Zyb21fbnVtYmVyIiwibnVtYmVyX2NvbnRyb2wiLCJyYW5nZV9jb250cm9sIiwibnVtYmVyX3ZhbHVlIiwiTnVtYmVyIiwiaXNGaW5pdGUiLCJtaW4iLCJtYXgiLCJzeW5jX3NlbGVjdGVkX3NlcnZpY2UiLCJzZXJ2aWNlIiwic2VsZWN0ZWRfaW5kZXgiLCJmb3JFYWNoIiwiZmllbGQiLCJkaXNhYmxlZCIsInVwZGF0ZV9zZXJ2aWNlX3BpY3R1cmUiLCJ1cmxfZmllbGQiLCJpbWFnZSIsInBsYWNlaG9sZGVyIiwicmVtb3ZlX2J1dHRvbiIsInRyaW0iLCJoaWRkZW4iLCJzcmMiLCJyZW1vdmVBdHRyaWJ1dGUiLCJCb29sZWFuIiwiZm9ybWF0X3NlcnZpY2VfZHVyYXRpb24iLCJwYXJzZWRfbWludXRlcyIsInRvdGFsX21pbnV0ZXMiLCJob3VycyIsIm1pbnV0ZXMiLCJkdXJhdGlvbl9wYXJ0cyIsImxvY2FsZSIsImRvY3VtZW50RWxlbWVudCIsImdldEF0dHJpYnV0ZSIsInVuZGVmaW5lZCIsIkludGwiLCJOdW1iZXJGb3JtYXQiLCJwdXNoIiwic3R5bGUiLCJ1bml0IiwidW5pdERpc3BsYXkiLCJmb3JtYXQiLCJmb3JtYXR0ZXJfZXJyb3IiLCJsZW5ndGgiLCJMaXN0Rm9ybWF0IiwidHlwZSIsImxpc3RfZm9ybWF0dGVyX2Vycm9yIiwiam9pbiIsInVwZGF0ZV9zZXJ2aWNlX3N1bW1hcnkiLCJzdW1tYXJ5IiwiZHVyYXRpb24iLCJ0ZXh0Q29udGVudCIsImxvYWRfc2VsZWN0ZWRfc2VydmljZSIsInJlbmRlcl9zZXJ2aWNlX2NhcmRzIiwibGlzdCIsInRlbXBsYXRlIiwic2VydmljZV9pbmRleCIsImNhcmQiLCJjb250ZW50IiwiZmlyc3RFbGVtZW50Q2hpbGQiLCJjbG9uZU5vZGUiLCJyYWRpbyIsInNlcnZpY2VfdGl0bGUiLCJjaGVja2VkIiwiZGF0YXNldCIsIndwYmNTZXJ2aWNlU2VsZWN0aW9uIiwiY2xhc3NMaXN0IiwidG9nZ2xlIiwid3BiY1JlbW92ZVNlcnZpY2UiLCJzZXRBdHRyaWJ1dGUiLCJhcHBlbmRDaGlsZCIsInJlbW92ZV9zZXJ2aWNlIiwiZm9jdXNfdGFyZ2V0IiwicmVtb3ZlZF9zZXJ2aWNlIiwic3RhdHVzX21lc3NhZ2UiLCJpbmRleE9mIiwic3BsaWNlIiwicmVuZGVyX3NlcnZpY2VfZWRpdG9yIiwiY2xlYXJfZmllbGRfZXJyb3IiLCJzZXRfc3RhdHVzIiwiZm9jdXMiLCJhZGRfYnV0dG9uIiwibWF4X3NlcnZpY2VzIiwiaGFuZGxlX2NsaWNrIiwiZXZlbnQiLCJ0YXJnZXQiLCJjbG9zZXN0IiwicmVtb3ZlX3NlcnZpY2VfYnV0dG9uIiwicmVtb3ZlX3BpY3R1cmVfYnV0dG9uIiwicHJldmVudERlZmF1bHQiLCJzdG9wUHJvcGFnYXRpb24iLCJwYXJzZUludCIsInNlbGVjdCIsImhhbmRsZV9jaGFuZ2UiLCJtYXRjaGVzIiwid3BiY1NlcnZpY2VGaWVsZCIsImhhbmRsZV9pbnB1dCIsIndwYmNTZXJ2aWNlUmFuZ2UiLCJoYW5kbGVfbWVkaWFfdXJsX3NldCIsImluaXRpYWxpemUiLCJyZWdpc3RlcmVkX3NoZWxsX2FwaSIsInBhcnNlZF9zZXJ2aWNlcyIsInBhcnNlZF9pbmFjdGl2ZV9zZXJ2aWNlX2lkcyIsImVkaXRvcl9ub2RlIiwicGFyc2UiLCJwYXJzZV9lcnJvciIsIkFycmF5IiwiaXNBcnJheSIsImluYWN0aXZlX3BhcnNlX2Vycm9yIiwibWFwIiwiZmlsdGVyIiwic2VydmljZV9pZCIsInNlcnZpY2VfaWRzIiwibWF4U2VydmljZXMiLCJwcmljaW5nX2F2YWlsYWJsZSIsInByaWNpbmdBdmFpbGFibGUiLCJhZGRFdmVudExpc3RlbmVyIiwib24iLCJ2YWxpZGF0ZSIsImZpcnN0X2ludmFsaWQiLCJzZXRfZmllbGRfZXJyb3IiLCJzb21lIiwiaW52YWxpZF9maWVsZF9uYW1lIiwibnVtZXJpY19maWVsZHMiLCJpbnZhbGlkX251bWJlciIsInJ1bGUiLCJpc19pbnZhbGlkIiwidGVzdCIsInN5bmMiLCJ3cGJjX3NldHVwX2VkaXRvcl9tb2R1bGVzIiwiY3JlYXRlIiwid3BiY19zZXR1cF93aXphcmRfYXBpIiwicmVnaXN0ZXJfc3RlcF9hZGFwdGVyIiwialF1ZXJ5Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1zZXR1cC13aXphcmQvc3RlcC1zZXJ2aWNlcy9fc3JjL3N0ZXAtc2VydmljZXMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBQcm92aWRlIHRoZSByZXVzYWJsZSBwcm9ncmVzc2l2ZWx5IHNhdmVkIFNlcnZpY2UgZWRpdG9yIHVzZWQgYnkgU2V0dXAgV2l6YXJkLlxuICpcbiAqIFRoZSBtb2R1bGUgb3ducyBTZXJ2aWNlIHByZXNlbnRhdGlvbiwgbG9jYWwgZHJhZnQgc3luY2hyb25pemF0aW9uLCBtZWRpYVxuICogcHJldmlldyBiZWhhdmlvciwgYW5kIGVhcmx5IHZhbGlkYXRpb24uIFBlcnNpc3RlbmNlIGFuZCBhdXRob3JpemF0aW9uIHJlbWFpblxuICogc2VydmVyLW93bmVkLiBUaGUgbnVtYmVyIGlucHV0IHJlbWFpbnMgYXV0aG9yaXRhdGl2ZSB3aGVuIHBhaXJlZCB3aXRoIGFcbiAqIHJhbmdlIGlucHV0IHNvIGtleWJvYXJkIHVzZXJzIGNhbiBlbnRlciBleGFjdCBtaW51dGUgdmFsdWVzLlxuICpcbiAqIEBwYWNrYWdlIEJvb2tpbmcgQ2FsZW5kYXJcbiAqL1xuKCBmdW5jdGlvbiAoICQsIHdpbmRvdywgZG9jdW1lbnQgKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHR2YXIgbW9kdWxlX2NvbmZpZyA9IHdpbmRvdy53cGJjX3NldHVwX3dpemFyZF9zZXJ2aWNlcyB8fCB7IGkxOG46IHt9IH07XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBvbmUgaXNvbGF0ZWQgU2VydmljZSBlZGl0b3IgYWRhcHRlci5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBNb2R1bGUgdHJhbnNsYXRpb25zIGFuZCBwcmVzZW50YXRpb24gc2V0dGluZ3MuXG5cdCAqIEByZXR1cm4ge09iamVjdH0gU3RlcCBhZGFwdGVyIGFjY2VwdGVkIGJ5IHRoZSBzaGFyZWQgd2l6YXJkIHNoZWxsLlxuXHQgKi9cblx0ZnVuY3Rpb24gY3JlYXRlX3NlcnZpY2VzX2FkYXB0ZXIoIGNvbmZpZyApIHtcblx0XHR2YXIgc2hlbGxfYXBpID0gbnVsbDtcblx0XHR2YXIgcm9vdCA9IG51bGw7XG5cdFx0dmFyIGVkaXRvciA9IG51bGw7XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gb25lIHRyYW5zbGF0ZWQgc3RyaW5nIHdpdGggYSBzYWZlIGZhbGxiYWNrLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGtleSAgICAgIFRyYW5zbGF0aW9uIGtleS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZmFsbGJhY2sgRmFsbGJhY2sgY29weS5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IFRyYW5zbGF0aW9uIG9yIGZhbGxiYWNrLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9tZXNzYWdlKCBrZXksIGZhbGxiYWNrICkge1xuXHRcdFx0cmV0dXJuIGNvbmZpZy5pMThuICYmIGNvbmZpZy5pMThuWyBrZXkgXSA/IGNvbmZpZy5pMThuWyBrZXkgXSA6IGZhbGxiYWNrO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlcGxhY2Ugb25lIHN0cmluZyBwbGFjZWhvbGRlciB3aXRob3V0IGludGVycHJldGluZyByZXBsYWNlbWVudCB0b2tlbnMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSAgICAgVHJhbnNsYXRlZCBtZXNzYWdlIGNvbnRhaW5pbmcgYCVzYC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcmVwbGFjZW1lbnQgUGxhaW4tdGV4dCByZXBsYWNlbWVudC5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IEZvcm1hdHRlZCBtZXNzYWdlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGZvcm1hdF9tZXNzYWdlKCBtZXNzYWdlLCByZXBsYWNlbWVudCApIHtcblx0XHRcdHJldHVybiBTdHJpbmcoIG1lc3NhZ2UgKS5yZXBsYWNlKCAnJXMnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBTdHJpbmcoIHJlcGxhY2VtZW50ICk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ3JlYXRlIG9uZSB1bnNhdmVkIFNlcnZpY2UgcHJvcG9zYWwgdXNpbmcgc2FmZSBwcmVzZW50YXRpb24gZGVmYXVsdHMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IEpTT04tc2FmZSBTZXJ2aWNlIHByb3Bvc2FsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNyZWF0ZV9zZXJ2aWNlX2RyYWZ0KCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZHJhZnRfaWQ6ICdkcmFmdC0nICsgRGF0ZS5ub3coKSArICctJyArIE1hdGguZmxvb3IoIE1hdGgucmFuZG9tKCkgKiAxMDAwMDAgKSxcblx0XHRcdFx0c291cmNlX3NlcnZpY2VfaWQ6IDAsXG5cdFx0XHRcdHRpdGxlOiBnZXRfbWVzc2FnZSggJ25ld19zZXJ2aWNlJywgJ05ldyBTZXJ2aWNlJyApLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogJycsXG5cdFx0XHRcdHBpY3R1cmVfdXJsOiAnJyxcblx0XHRcdFx0ZHVyYXRpb25fbWludXRlczogMzAsXG5cdFx0XHRcdGJ1ZmZlcl9iZWZvcmVfbWludXRlczogMCxcblx0XHRcdFx0YnVmZmVyX2FmdGVyX21pbnV0ZXM6IDAsXG5cdFx0XHRcdGJhc2VfY29zdDogJzAuMDAnLFxuXHRcdFx0XHRzdGF0dXM6ICdhY3RpdmUnXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBvbmUgZWRpdGFibGUgU2VydmljZSBmaWVsZCBjb250cm9sLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGZpZWxkX25hbWUgU3RhYmxlIFNlcnZpY2UgRFRPIGZpZWxkLlxuXHRcdCAqIEByZXR1cm4ge0hUTUxFbGVtZW50fG51bGx9IE1hdGNoaW5nIGZpZWxkIGNvbnRyb2wuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3NlcnZpY2VfZmllbGQoIGZpZWxkX25hbWUgKSB7XG5cdFx0XHRyZXR1cm4gZWRpdG9yID8gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2VydmljZS1maWVsZD1cIicgKyBmaWVsZF9uYW1lICsgJ1wiXScgKSA6IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3luY2hyb25pemUgYm90aCBleHBsaWNpdCBTZXJ2aWNlIHRyYW5zcG9ydCBmaWVsZHMuXG5cdFx0ICpcblx0XHQgKiBDYW5vbmljYWwgbGlmZWN5Y2xlIGludGVudCBpcyBrZXB0IHNlcGFyYXRlIGZyb20gdGhlIHZpc2libGUgcHJvcG9zYWxcblx0XHQgKiBjb2xsZWN0aW9uIHNvIG9taXNzaW9uIGFsb25lIGNhbiBuZXZlciBtb3ZlIGEgU2VydmljZSB0byBEcmFmdC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3luY190cmFuc3BvcnRzKCkge1xuXHRcdFx0aWYgKCAhIGVkaXRvciApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRlZGl0b3IudHJhbnNwb3J0LnZhbHVlID0gSlNPTi5zdHJpbmdpZnkoIGVkaXRvci5zZXJ2aWNlcyApO1xuXHRcdFx0ZWRpdG9yLmluYWN0aXZlX3RyYW5zcG9ydC52YWx1ZSA9IEpTT04uc3RyaW5naWZ5KCBlZGl0b3IuaW5hY3RpdmVfc2VydmljZV9pZHMgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTeW5jaHJvbml6ZSBhIHJhbmdlIGlucHV0IGZyb20gaXRzIGF1dGhvcml0YXRpdmUgbnVtYmVyIGNvbnRyb2wuXG5cdFx0ICpcblx0XHQgKiBJbnZhbGlkIG51bWJlciBpbnB1dCBpcyBpbnRlbnRpb25hbGx5IGxlZnQgdmlzaWJsZSBmb3IgdmFsaWRhdGlvbiBhbmQgaXNcblx0XHQgKiBub3QgYWxsb3dlZCB0byBjb2VyY2UgdGhlIHN0b3JlZCBkcmFmdCBzaWxlbnRseS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBmaWVsZF9uYW1lIFN0YWJsZSBudW1lcmljIFNlcnZpY2UgZmllbGQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzeW5jX3JhbmdlX2Zyb21fbnVtYmVyKCBmaWVsZF9uYW1lICkge1xuXHRcdFx0dmFyIG51bWJlcl9jb250cm9sID0gZ2V0X3NlcnZpY2VfZmllbGQoIGZpZWxkX25hbWUgKTtcblx0XHRcdHZhciByYW5nZV9jb250cm9sID0gZWRpdG9yICYmIGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNlcnZpY2UtcmFuZ2U9XCInICsgZmllbGRfbmFtZSArICdcIl0nICk7XG5cdFx0XHR2YXIgbnVtYmVyX3ZhbHVlO1xuXG5cdFx0XHRpZiAoICEgbnVtYmVyX2NvbnRyb2wgfHwgISByYW5nZV9jb250cm9sICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdG51bWJlcl92YWx1ZSA9IE51bWJlciggbnVtYmVyX2NvbnRyb2wudmFsdWUgKTtcblx0XHRcdGlmICggaXNGaW5pdGUoIG51bWJlcl92YWx1ZSApICYmIG51bWJlcl92YWx1ZSA+PSBOdW1iZXIoIHJhbmdlX2NvbnRyb2wubWluICkgJiYgbnVtYmVyX3ZhbHVlIDw9IE51bWJlciggcmFuZ2VfY29udHJvbC5tYXggKSApIHtcblx0XHRcdFx0cmFuZ2VfY29udHJvbC52YWx1ZSA9IFN0cmluZyggbnVtYmVyX3ZhbHVlICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUGVyc2lzdCB0aGUgY3VycmVudCBkZXRhaWwgY29udHJvbHMgaW50byB0aGUgaW4tbWVtb3J5IGRyYWZ0IGNvbGxlY3Rpb24uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHN5bmNfc2VsZWN0ZWRfc2VydmljZSgpIHtcblx0XHRcdHZhciBzZXJ2aWNlO1xuXG5cdFx0XHRpZiAoICEgZWRpdG9yIHx8ICEgZWRpdG9yLnNlcnZpY2VzWyBlZGl0b3Iuc2VsZWN0ZWRfaW5kZXggXSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRzZXJ2aWNlID0gZWRpdG9yLnNlcnZpY2VzWyBlZGl0b3Iuc2VsZWN0ZWRfaW5kZXggXTtcblx0XHRcdFsgJ3RpdGxlJywgJ2Rlc2NyaXB0aW9uJywgJ3BpY3R1cmVfdXJsJywgJ2R1cmF0aW9uX21pbnV0ZXMnLCAnYnVmZmVyX2JlZm9yZV9taW51dGVzJywgJ2J1ZmZlcl9hZnRlcl9taW51dGVzJywgJ2Jhc2VfY29zdCcgXS5mb3JFYWNoKCBmdW5jdGlvbiAoIGZpZWxkX25hbWUgKSB7XG5cdFx0XHRcdHZhciBmaWVsZCA9IGdldF9zZXJ2aWNlX2ZpZWxkKCBmaWVsZF9uYW1lICk7XG5cdFx0XHRcdGlmICggZmllbGQgJiYgISBmaWVsZC5kaXNhYmxlZCApIHtcblx0XHRcdFx0XHRzZXJ2aWNlWyBmaWVsZF9uYW1lIF0gPSBmaWVsZC52YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0c2VydmljZS5zdGF0dXMgPSAnYWN0aXZlJztcblx0XHRcdHN5bmNfdHJhbnNwb3J0cygpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFVwZGF0ZSB0aGUgU2VydmljZSBwaWN0dXJlIHByZXZpZXcgZnJvbSB0aGUgVVJMIGNvbnRyb2wuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHVwZGF0ZV9zZXJ2aWNlX3BpY3R1cmUoKSB7XG5cdFx0XHR2YXIgdXJsX2ZpZWxkID0gZ2V0X3NlcnZpY2VfZmllbGQoICdwaWN0dXJlX3VybCcgKTtcblx0XHRcdHZhciBpbWFnZSA9IGVkaXRvciAmJiBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zZXJ2aWNlLXBpY3R1cmUtaW1hZ2VdJyApO1xuXHRcdFx0dmFyIHBsYWNlaG9sZGVyID0gZWRpdG9yICYmIGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNlcnZpY2UtcGljdHVyZS1wbGFjZWhvbGRlcl0nICk7XG5cdFx0XHR2YXIgcmVtb3ZlX2J1dHRvbiA9IGVkaXRvciAmJiBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1yZW1vdmUtc2VydmljZS1waWN0dXJlXScgKTtcblx0XHRcdHZhciBwaWN0dXJlX3VybCA9IHVybF9maWVsZCA/IFN0cmluZyggdXJsX2ZpZWxkLnZhbHVlIHx8ICcnICkudHJpbSgpIDogJyc7XG5cblx0XHRcdGlmICggaW1hZ2UgKSB7XG5cdFx0XHRcdGltYWdlLmhpZGRlbiA9ICEgcGljdHVyZV91cmw7XG5cdFx0XHRcdGlmICggcGljdHVyZV91cmwgKSB7XG5cdFx0XHRcdFx0aW1hZ2Uuc3JjID0gcGljdHVyZV91cmw7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aW1hZ2UucmVtb3ZlQXR0cmlidXRlKCAnc3JjJyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHBsYWNlaG9sZGVyICkge1xuXHRcdFx0XHRwbGFjZWhvbGRlci5oaWRkZW4gPSBCb29sZWFuKCBwaWN0dXJlX3VybCApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCByZW1vdmVfYnV0dG9uICkge1xuXHRcdFx0XHRyZW1vdmVfYnV0dG9uLmRpc2FibGVkID0gISBwaWN0dXJlX3VybDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBGb3JtYXQgYSBTZXJ2aWNlIGR1cmF0aW9uIGFzIGxvY2FsaXplZCBob3VycyBhbmQgbWludXRlcy5cblx0XHQgKlxuXHRcdCAqIFRoZSBmb3JtYXR0ZXIgaXMgcHJlc2VudGF0aW9uLW9ubHkuIENhbm9uaWNhbCBTZXJ2aWNlIGRyYWZ0IHZhbHVlcyByZW1haW5cblx0XHQgKiBpbnRlZ2VyIG1pbnV0ZXMgZm9yIHZhbGlkYXRpb24gYW5kIHBlcnNpc3RlbmNlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSBkdXJhdGlvbl9taW51dGVzIENhbm9uaWNhbCBkdXJhdGlvbiBpbiBtaW51dGVzLlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gSHVtYW4tcmVhZGFibGUgZHVyYXRpb24gc3VjaCBhcyBcIjIgaG91cnMgYW5kIDMgbWludXRlc1wiLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGZvcm1hdF9zZXJ2aWNlX2R1cmF0aW9uKCBkdXJhdGlvbl9taW51dGVzICkge1xuXHRcdFx0dmFyIHBhcnNlZF9taW51dGVzID0gTnVtYmVyKCBkdXJhdGlvbl9taW51dGVzICk7XG5cdFx0XHR2YXIgdG90YWxfbWludXRlcyA9IGlzRmluaXRlKCBwYXJzZWRfbWludXRlcyApICYmIHBhcnNlZF9taW51dGVzID49IDAgPyBNYXRoLmZsb29yKCBwYXJzZWRfbWludXRlcyApIDogMDtcblx0XHRcdHZhciBob3VycyA9IE1hdGguZmxvb3IoIHRvdGFsX21pbnV0ZXMgLyA2MCApO1xuXHRcdFx0dmFyIG1pbnV0ZXMgPSB0b3RhbF9taW51dGVzICUgNjA7XG5cdFx0XHR2YXIgZHVyYXRpb25fcGFydHMgPSBbXTtcblx0XHRcdHZhciBsb2NhbGUgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuZ2V0QXR0cmlidXRlKCAnbGFuZycgKSB8fCB1bmRlZmluZWQ7XG5cblx0XHRcdGlmICggd2luZG93LkludGwgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5JbnRsLk51bWJlckZvcm1hdCApIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRpZiAoIGhvdXJzICkge1xuXHRcdFx0XHRcdFx0ZHVyYXRpb25fcGFydHMucHVzaCggbmV3IHdpbmRvdy5JbnRsLk51bWJlckZvcm1hdCggbG9jYWxlLCB7IHN0eWxlOiAndW5pdCcsIHVuaXQ6ICdob3VyJywgdW5pdERpc3BsYXk6ICdsb25nJyB9ICkuZm9ybWF0KCBob3VycyApICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggbWludXRlcyB8fCAhIGhvdXJzICkge1xuXHRcdFx0XHRcdFx0ZHVyYXRpb25fcGFydHMucHVzaCggbmV3IHdpbmRvdy5JbnRsLk51bWJlckZvcm1hdCggbG9jYWxlLCB7IHN0eWxlOiAndW5pdCcsIHVuaXQ6ICdtaW51dGUnLCB1bml0RGlzcGxheTogJ2xvbmcnIH0gKS5mb3JtYXQoIG1pbnV0ZXMgKSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBjYXRjaCAoIGZvcm1hdHRlcl9lcnJvciApIHtcblx0XHRcdFx0XHRkdXJhdGlvbl9wYXJ0cyA9IFtdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICggISBkdXJhdGlvbl9wYXJ0cy5sZW5ndGggKSB7XG5cdFx0XHRcdGlmICggaG91cnMgKSB7XG5cdFx0XHRcdFx0ZHVyYXRpb25fcGFydHMucHVzaCggU3RyaW5nKCBob3VycyApICsgJyAnICsgZ2V0X21lc3NhZ2UoIDEgPT09IGhvdXJzID8gJ2hvdXJfc2luZ3VsYXInIDogJ2hvdXJfcGx1cmFsJywgMSA9PT0gaG91cnMgPyAnaG91cicgOiAnaG91cnMnICkgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIG1pbnV0ZXMgfHwgISBob3VycyApIHtcblx0XHRcdFx0XHRkdXJhdGlvbl9wYXJ0cy5wdXNoKCBTdHJpbmcoIG1pbnV0ZXMgKSArICcgJyArIGdldF9tZXNzYWdlKCAxID09PSBtaW51dGVzID8gJ21pbnV0ZV9zaW5ndWxhcicgOiAnbWludXRlX3BsdXJhbCcsIDEgPT09IG1pbnV0ZXMgPyAnbWludXRlJyA6ICdtaW51dGVzJyApICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKCAxID09PSBkdXJhdGlvbl9wYXJ0cy5sZW5ndGggKSB7XG5cdFx0XHRcdHJldHVybiBkdXJhdGlvbl9wYXJ0c1swXTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCB3aW5kb3cuSW50bCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LkludGwuTGlzdEZvcm1hdCApIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IHdpbmRvdy5JbnRsLkxpc3RGb3JtYXQoIGxvY2FsZSwgeyBzdHlsZTogJ2xvbmcnLCB0eXBlOiAnY29uanVuY3Rpb24nIH0gKS5mb3JtYXQoIGR1cmF0aW9uX3BhcnRzICk7XG5cdFx0XHRcdH0gY2F0Y2ggKCBsaXN0X2Zvcm1hdHRlcl9lcnJvciApIHtcblx0XHRcdFx0XHQvLyBGYWxsIHRocm91Z2ggdG8gdGhlIHRyYW5zbGF0ZWQgY29uanVuY3Rpb24gZm9yIG9sZGVyIGJyb3dzZXJzLlxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBkdXJhdGlvbl9wYXJ0cy5qb2luKCAnICcgKyBnZXRfbWVzc2FnZSggJ2R1cmF0aW9uX2pvaW5lcicsICdhbmQnICkgKyAnICcgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBVcGRhdGUgdGhlIGN1c3RvbWVyLWZhY2luZyB0aXRsZSBhbmQgZHVyYXRpb24gcHJldmlldy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gdXBkYXRlX3NlcnZpY2Vfc3VtbWFyeSgpIHtcblx0XHRcdHZhciBzdW1tYXJ5ID0gZWRpdG9yICYmIGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNlcnZpY2Utc3VtbWFyeV0nICk7XG5cdFx0XHR2YXIgdGl0bGUgPSBnZXRfc2VydmljZV9maWVsZCggJ3RpdGxlJyApO1xuXHRcdFx0dmFyIGR1cmF0aW9uID0gZ2V0X3NlcnZpY2VfZmllbGQoICdkdXJhdGlvbl9taW51dGVzJyApO1xuXG5cdFx0XHRpZiAoIHN1bW1hcnkgKSB7XG5cdFx0XHRcdHN1bW1hcnkudGV4dENvbnRlbnQgPSAoIHRpdGxlICYmIHRpdGxlLnZhbHVlLnRyaW0oKSA/IHRpdGxlLnZhbHVlLnRyaW0oKSA6IGdldF9tZXNzYWdlKCAnbmV3X3NlcnZpY2UnLCAnTmV3IFNlcnZpY2UnICkgKSArICcgwrcgJyArIGZvcm1hdF9zZXJ2aWNlX2R1cmF0aW9uKCBkdXJhdGlvbiA/IGR1cmF0aW9uLnZhbHVlIDogMzAgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBMb2FkIHRoZSBzZWxlY3RlZCBwcm9wb3NhbCBpbnRvIHRoZSBkZXRhaWwgY29udHJvbHMgYW5kIHByZXZpZXcuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGxvYWRfc2VsZWN0ZWRfc2VydmljZSgpIHtcblx0XHRcdHZhciBzZXJ2aWNlO1xuXG5cdFx0XHRpZiAoICEgZWRpdG9yICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHNlcnZpY2UgPSBlZGl0b3Iuc2VydmljZXNbIGVkaXRvci5zZWxlY3RlZF9pbmRleCBdO1xuXHRcdFx0aWYgKCAhIHNlcnZpY2UgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0WyAndGl0bGUnLCAnZGVzY3JpcHRpb24nLCAncGljdHVyZV91cmwnLCAnZHVyYXRpb25fbWludXRlcycsICdidWZmZXJfYmVmb3JlX21pbnV0ZXMnLCAnYnVmZmVyX2FmdGVyX21pbnV0ZXMnLCAnYmFzZV9jb3N0JyBdLmZvckVhY2goIGZ1bmN0aW9uICggZmllbGRfbmFtZSApIHtcblx0XHRcdFx0dmFyIGZpZWxkID0gZ2V0X3NlcnZpY2VfZmllbGQoIGZpZWxkX25hbWUgKTtcblx0XHRcdFx0aWYgKCBmaWVsZCApIHtcblx0XHRcdFx0XHRmaWVsZC52YWx1ZSA9IG51bGwgPT09IHNlcnZpY2VbIGZpZWxkX25hbWUgXSB8fCB1bmRlZmluZWQgPT09IHNlcnZpY2VbIGZpZWxkX25hbWUgXSA/ICcnIDogc2VydmljZVsgZmllbGRfbmFtZSBdO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHRcdFsgJ2R1cmF0aW9uX21pbnV0ZXMnLCAnYnVmZmVyX2JlZm9yZV9taW51dGVzJywgJ2J1ZmZlcl9hZnRlcl9taW51dGVzJyBdLmZvckVhY2goIHN5bmNfcmFuZ2VfZnJvbV9udW1iZXIgKTtcblx0XHRcdHVwZGF0ZV9zZXJ2aWNlX3BpY3R1cmUoKTtcblx0XHRcdHVwZGF0ZV9zZXJ2aWNlX3N1bW1hcnkoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgdGhlIHByb3Bvc2FsIGNob29zZXIgZnJvbSB0aGUgZGF0YS1vbmx5IGRyYWZ0IGNvbGxlY3Rpb24uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9zZXJ2aWNlX2NhcmRzKCkge1xuXHRcdFx0aWYgKCAhIGVkaXRvciB8fCAhIGVkaXRvci5saXN0IHx8ICEgZWRpdG9yLnRlbXBsYXRlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGVkaXRvci5saXN0LnRleHRDb250ZW50ID0gJyc7XG5cdFx0XHRlZGl0b3Iuc2VydmljZXMuZm9yRWFjaCggZnVuY3Rpb24gKCBzZXJ2aWNlLCBzZXJ2aWNlX2luZGV4ICkge1xuXHRcdFx0XHR2YXIgY2FyZCA9IGVkaXRvci50ZW1wbGF0ZS5jb250ZW50LmZpcnN0RWxlbWVudENoaWxkLmNsb25lTm9kZSggdHJ1ZSApO1xuXHRcdFx0XHR2YXIgcmFkaW8gPSBjYXJkLnF1ZXJ5U2VsZWN0b3IoICdpbnB1dFt0eXBlPVwicmFkaW9cIl0nICk7XG5cdFx0XHRcdHZhciBpbWFnZSA9IGNhcmQucXVlcnlTZWxlY3RvciggJ2ltZycgKTtcblx0XHRcdFx0dmFyIHBsYWNlaG9sZGVyID0gY2FyZC5xdWVyeVNlbGVjdG9yKCAnaScgKTtcblx0XHRcdFx0dmFyIHRpdGxlID0gY2FyZC5xdWVyeVNlbGVjdG9yKCAnc3Ryb25nJyApO1xuXHRcdFx0XHR2YXIgZHVyYXRpb24gPSBjYXJkLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNlcnZpY2UtY2FyZC1kdXJhdGlvbl0nICk7XG5cdFx0XHRcdHZhciByZW1vdmVfYnV0dG9uID0gY2FyZC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1yZW1vdmUtc2VydmljZV0nICk7XG5cdFx0XHRcdHZhciBwaWN0dXJlX3VybCA9IFN0cmluZyggc2VydmljZS5waWN0dXJlX3VybCB8fCAnJyApLnRyaW0oKTtcblx0XHRcdFx0dmFyIHNlcnZpY2VfdGl0bGUgPSBzZXJ2aWNlLnRpdGxlIHx8IGdldF9tZXNzYWdlKCAnbmV3X3NlcnZpY2UnLCAnTmV3IFNlcnZpY2UnICk7XG5cblx0XHRcdFx0cmFkaW8udmFsdWUgPSBTdHJpbmcoIHNlcnZpY2VfaW5kZXggKTtcblx0XHRcdFx0cmFkaW8uY2hlY2tlZCA9IHNlcnZpY2VfaW5kZXggPT09IGVkaXRvci5zZWxlY3RlZF9pbmRleDtcblx0XHRcdFx0cmFkaW8uZGF0YXNldC53cGJjU2VydmljZVNlbGVjdGlvbiA9IFN0cmluZyggc2VydmljZV9pbmRleCApO1xuXHRcdFx0XHRjYXJkLmNsYXNzTGlzdC50b2dnbGUoICdpcy1zZWxlY3RlZCcsIHJhZGlvLmNoZWNrZWQgKTtcblx0XHRcdFx0dGl0bGUudGV4dENvbnRlbnQgPSBzZXJ2aWNlX3RpdGxlO1xuXHRcdFx0XHRkdXJhdGlvbi50ZXh0Q29udGVudCA9IGZvcm1hdF9zZXJ2aWNlX2R1cmF0aW9uKCBudWxsID09PSBzZXJ2aWNlLmR1cmF0aW9uX21pbnV0ZXMgfHwgdW5kZWZpbmVkID09PSBzZXJ2aWNlLmR1cmF0aW9uX21pbnV0ZXMgfHwgJycgPT09IHNlcnZpY2UuZHVyYXRpb25fbWludXRlcyA/IDMwIDogc2VydmljZS5kdXJhdGlvbl9taW51dGVzICk7XG5cdFx0XHRcdGlmICggcmVtb3ZlX2J1dHRvbiApIHtcblx0XHRcdFx0XHRyZW1vdmVfYnV0dG9uLmRhdGFzZXQud3BiY1JlbW92ZVNlcnZpY2UgPSBTdHJpbmcoIHNlcnZpY2VfaW5kZXggKTtcblx0XHRcdFx0XHRyZW1vdmVfYnV0dG9uLmRpc2FibGVkID0gMSA9PT0gZWRpdG9yLnNlcnZpY2VzLmxlbmd0aDtcblx0XHRcdFx0XHRpZiAoIE51bWJlciggc2VydmljZS5zb3VyY2Vfc2VydmljZV9pZCApID4gMCApIHtcblx0XHRcdFx0XHRcdHJlbW92ZV9idXR0b24uc2V0QXR0cmlidXRlKCAnYXJpYS1sYWJlbCcsIGZvcm1hdF9tZXNzYWdlKCBnZXRfbWVzc2FnZSggJ21vdmVfc2VydmljZV90b19kcmFmdCcsICdNb3ZlICVzIHRvIERyYWZ0JyApLCBzZXJ2aWNlX3RpdGxlICkgKTtcblx0XHRcdFx0XHRcdHJlbW92ZV9idXR0b24udGl0bGUgPSBmb3JtYXRfbWVzc2FnZSggZ2V0X21lc3NhZ2UoICdtb3ZlX3NlcnZpY2VfdG9fZHJhZnQnLCAnTW92ZSAlcyB0byBEcmFmdCcgKSwgc2VydmljZV90aXRsZSApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZW1vdmVfYnV0dG9uLnNldEF0dHJpYnV0ZSggJ2FyaWEtbGFiZWwnLCBmb3JtYXRfbWVzc2FnZSggZ2V0X21lc3NhZ2UoICdyZW1vdmVfc2VydmljZScsICdSZW1vdmUgJXMnICksIHNlcnZpY2VfdGl0bGUgKSApO1xuXHRcdFx0XHRcdFx0cmVtb3ZlX2J1dHRvbi50aXRsZSA9IGZvcm1hdF9tZXNzYWdlKCBnZXRfbWVzc2FnZSggJ3JlbW92ZV9zZXJ2aWNlJywgJ1JlbW92ZSAlcycgKSwgc2VydmljZV90aXRsZSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHBpY3R1cmVfdXJsICkge1xuXHRcdFx0XHRcdGltYWdlLnNyYyA9IHBpY3R1cmVfdXJsO1xuXHRcdFx0XHRcdGltYWdlLmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0XHRcdHBsYWNlaG9sZGVyLmhpZGRlbiA9IHRydWU7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aW1hZ2UuaGlkZGVuID0gdHJ1ZTtcblx0XHRcdFx0XHRpbWFnZS5yZW1vdmVBdHRyaWJ1dGUoICdzcmMnICk7XG5cdFx0XHRcdFx0cGxhY2Vob2xkZXIuaGlkZGVuID0gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWRpdG9yLmxpc3QuYXBwZW5kQ2hpbGQoIGNhcmQgKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW1vdmUgb25lIHByb3Bvc2FsIGFuZCBleHBsaWNpdGx5IHN0YWdlIGEgY2Fub25pY2FsIFNlcnZpY2UgZm9yIERyYWZ0LlxuXHRcdCAqXG5cdFx0ICogVGhlIHJlcXVpcmVkIGZpbmFsIFNlcnZpY2UgY2Fubm90IGJlIHJlbW92ZWQuIENhbm9uaWNhbCBzdG9yYWdlIGlzIG5vdFxuXHRcdCAqIGNoYW5nZWQgdW50aWwgU2F2ZTsgdW5zYXZlZCBwcm9wb3NhbHMgaGF2ZSBubyBjYW5vbmljYWwgbGlmZWN5Y2xlIGFjdGlvbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBzZXJ2aWNlX2luZGV4IFplcm8tYmFzZWQgU2VydmljZSBkcmFmdCBpbmRleC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbW92ZV9zZXJ2aWNlKCBzZXJ2aWNlX2luZGV4ICkge1xuXHRcdFx0dmFyIGZvY3VzX3RhcmdldDtcblx0XHRcdHZhciByZW1vdmVkX3NlcnZpY2U7XG5cdFx0XHR2YXIgc291cmNlX3NlcnZpY2VfaWQ7XG5cdFx0XHR2YXIgc3RhdHVzX21lc3NhZ2U7XG5cblx0XHRcdGlmICggISBlZGl0b3IgfHwgISBpc0Zpbml0ZSggc2VydmljZV9pbmRleCApIHx8IHNlcnZpY2VfaW5kZXggIT09IE1hdGguZmxvb3IoIHNlcnZpY2VfaW5kZXggKSB8fCBlZGl0b3Iuc2VydmljZXMubGVuZ3RoIDw9IDEgfHwgc2VydmljZV9pbmRleCA8IDAgfHwgc2VydmljZV9pbmRleCA+PSBlZGl0b3Iuc2VydmljZXMubGVuZ3RoICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHN5bmNfc2VsZWN0ZWRfc2VydmljZSgpO1xuXHRcdFx0cmVtb3ZlZF9zZXJ2aWNlID0gZWRpdG9yLnNlcnZpY2VzWyBzZXJ2aWNlX2luZGV4IF07XG5cdFx0XHRzb3VyY2Vfc2VydmljZV9pZCA9IE51bWJlciggcmVtb3ZlZF9zZXJ2aWNlLnNvdXJjZV9zZXJ2aWNlX2lkIHx8IDAgKTtcblx0XHRcdGlmICggc291cmNlX3NlcnZpY2VfaWQgPiAwICYmIC0xID09PSBlZGl0b3IuaW5hY3RpdmVfc2VydmljZV9pZHMuaW5kZXhPZiggc291cmNlX3NlcnZpY2VfaWQgKSApIHtcblx0XHRcdFx0ZWRpdG9yLmluYWN0aXZlX3NlcnZpY2VfaWRzLnB1c2goIHNvdXJjZV9zZXJ2aWNlX2lkICk7XG5cdFx0XHR9XG5cdFx0XHRlZGl0b3Iuc2VydmljZXMuc3BsaWNlKCBzZXJ2aWNlX2luZGV4LCAxICk7XG5cblx0XHRcdGlmICggc2VydmljZV9pbmRleCA8IGVkaXRvci5zZWxlY3RlZF9pbmRleCApIHtcblx0XHRcdFx0ZWRpdG9yLnNlbGVjdGVkX2luZGV4IC09IDE7XG5cdFx0XHR9IGVsc2UgaWYgKCBzZXJ2aWNlX2luZGV4ID09PSBlZGl0b3Iuc2VsZWN0ZWRfaW5kZXggKSB7XG5cdFx0XHRcdGVkaXRvci5zZWxlY3RlZF9pbmRleCA9IE1hdGgubWluKCBzZXJ2aWNlX2luZGV4LCBlZGl0b3Iuc2VydmljZXMubGVuZ3RoIC0gMSApO1xuXHRcdFx0fVxuXG5cdFx0XHRyZW5kZXJfc2VydmljZV9lZGl0b3IoKTtcblx0XHRcdHNoZWxsX2FwaS5jbGVhcl9maWVsZF9lcnJvciggJ3NlcnZpY2VzJyApO1xuXHRcdFx0c3RhdHVzX21lc3NhZ2UgPSBzb3VyY2Vfc2VydmljZV9pZCA+IDBcblx0XHRcdFx0PyBmb3JtYXRfbWVzc2FnZSggZ2V0X21lc3NhZ2UoICdzZXJ2aWNlX2RyYWZ0X3BlbmRpbmcnLCAnJXMgd2lsbCBtb3ZlIHRvIERyYWZ0IHdoZW4geW91IHNhdmUuJyApLCByZW1vdmVkX3NlcnZpY2UudGl0bGUgfHwgZ2V0X21lc3NhZ2UoICduZXdfc2VydmljZScsICdOZXcgU2VydmljZScgKSApXG5cdFx0XHRcdDogZ2V0X21lc3NhZ2UoICdzZXJ2aWNlX3JlbW92ZWQnLCAnVW5zYXZlZCBTZXJ2aWNlIHJlbW92ZWQgZnJvbSB0aGlzIHNldHVwLicgKTtcblx0XHRcdHNoZWxsX2FwaS5zZXRfc3RhdHVzKCBzdGF0dXNfbWVzc2FnZSApO1xuXG5cdFx0XHRmb2N1c190YXJnZXQgPSBlZGl0b3IubGlzdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1yZW1vdmUtc2VydmljZT1cIicgKyBlZGl0b3Iuc2VsZWN0ZWRfaW5kZXggKyAnXCJdJyApO1xuXHRcdFx0aWYgKCBmb2N1c190YXJnZXQgJiYgZm9jdXNfdGFyZ2V0LmRpc2FibGVkICkge1xuXHRcdFx0XHRmb2N1c190YXJnZXQgPSBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1hZGQtc2VydmljZV0nICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGZvY3VzX3RhcmdldCApIHtcblx0XHRcdFx0Zm9jdXNfdGFyZ2V0LmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVmcmVzaCBhbGwgU2VydmljZSBlZGl0b3IgcHJlc2VudGF0aW9uIGFuZCBpdHMgSlNPTiB0cmFuc3BvcnQgZmllbGQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9zZXJ2aWNlX2VkaXRvcigpIHtcblx0XHRcdHZhciBhZGRfYnV0dG9uO1xuXG5cdFx0XHRpZiAoICEgZWRpdG9yICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGVkaXRvci5zZWxlY3RlZF9pbmRleCA9IE1hdGgubWluKCBlZGl0b3Iuc2VsZWN0ZWRfaW5kZXgsIGVkaXRvci5zZXJ2aWNlcy5sZW5ndGggLSAxICk7XG5cdFx0XHRzeW5jX3RyYW5zcG9ydHMoKTtcblx0XHRcdHJlbmRlcl9zZXJ2aWNlX2NhcmRzKCk7XG5cdFx0XHRsb2FkX3NlbGVjdGVkX3NlcnZpY2UoKTtcblx0XHRcdGFkZF9idXR0b24gPSBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1hZGQtc2VydmljZV0nICk7XG5cdFx0XHRpZiAoIGFkZF9idXR0b24gKSB7XG5cdFx0XHRcdGFkZF9idXR0b24uZGlzYWJsZWQgPSBlZGl0b3Iuc2VydmljZXMubGVuZ3RoID49IGVkaXRvci5tYXhfc2VydmljZXM7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSGFuZGxlIFNlcnZpY2UgZWRpdG9yIGJ1dHRvbiBhY3Rpb25zLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtNb3VzZUV2ZW50fSBldmVudCBEZWxlZ2F0ZWQgY2xpY2sgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfY2xpY2soIGV2ZW50ICkge1xuXHRcdFx0dmFyIGFkZF9idXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYWRkLXNlcnZpY2VdJyApO1xuXHRcdFx0dmFyIHJlbW92ZV9zZXJ2aWNlX2J1dHRvbiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1yZW1vdmUtc2VydmljZV0nICk7XG5cdFx0XHR2YXIgcmVtb3ZlX3BpY3R1cmVfYnV0dG9uID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXJlbW92ZS1zZXJ2aWNlLXBpY3R1cmVdJyApO1xuXG5cdFx0XHRpZiAoIHJlbW92ZV9zZXJ2aWNlX2J1dHRvbiApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdHJlbW92ZV9zZXJ2aWNlKCBwYXJzZUludCggcmVtb3ZlX3NlcnZpY2VfYnV0dG9uLmRhdGFzZXQud3BiY1JlbW92ZVNlcnZpY2UsIDEwICkgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIGFkZF9idXR0b24gKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGlmICggZWRpdG9yLnNlcnZpY2VzLmxlbmd0aCA+PSBlZGl0b3IubWF4X3NlcnZpY2VzICkge1xuXHRcdFx0XHRcdHNoZWxsX2FwaS5zZXRfc3RhdHVzKCBnZXRfbWVzc2FnZSggJ3NlcnZpY2VfbGltaXQnLCAnVGhlIG1heGltdW0gbnVtYmVyIG9mIFNlcnZpY2UgZHJhZnRzIGhhcyBiZWVuIHJlYWNoZWQuJyApICk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0c3luY19zZWxlY3RlZF9zZXJ2aWNlKCk7XG5cdFx0XHRcdGVkaXRvci5zZXJ2aWNlcy5wdXNoKCBjcmVhdGVfc2VydmljZV9kcmFmdCgpICk7XG5cdFx0XHRcdGVkaXRvci5zZWxlY3RlZF9pbmRleCA9IGVkaXRvci5zZXJ2aWNlcy5sZW5ndGggLSAxO1xuXHRcdFx0XHRyZW5kZXJfc2VydmljZV9lZGl0b3IoKTtcblx0XHRcdFx0Z2V0X3NlcnZpY2VfZmllbGQoICd0aXRsZScgKS5zZWxlY3QoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIHJlbW92ZV9waWN0dXJlX2J1dHRvbiApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0Z2V0X3NlcnZpY2VfZmllbGQoICdwaWN0dXJlX3VybCcgKS52YWx1ZSA9ICcnO1xuXHRcdFx0XHRzeW5jX3NlbGVjdGVkX3NlcnZpY2UoKTtcblx0XHRcdFx0dXBkYXRlX3NlcnZpY2VfcGljdHVyZSgpO1xuXHRcdFx0XHRyZW5kZXJfc2VydmljZV9jYXJkcygpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEhhbmRsZSBzZWxlY3Rpb24gYW5kIGNvbW1pdHRlZCBmaWVsZCBjaGFuZ2VzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgRGVsZWdhdGVkIGNoYW5nZSBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9jaGFuZ2UoIGV2ZW50ICkge1xuXHRcdFx0aWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtc2VydmljZS1zZWxlY3Rpb25dJyApICkge1xuXHRcdFx0XHRzeW5jX3NlbGVjdGVkX3NlcnZpY2UoKTtcblx0XHRcdFx0ZWRpdG9yLnNlbGVjdGVkX2luZGV4ID0gcGFyc2VJbnQoIGV2ZW50LnRhcmdldC5kYXRhc2V0LndwYmNTZXJ2aWNlU2VsZWN0aW9uLCAxMCApO1xuXHRcdFx0XHRyZW5kZXJfc2VydmljZV9lZGl0b3IoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy1zZXJ2aWNlLWZpZWxkXScgKSApIHtcblx0XHRcdFx0c3luY19yYW5nZV9mcm9tX251bWJlciggZXZlbnQudGFyZ2V0LmRhdGFzZXQud3BiY1NlcnZpY2VGaWVsZCApO1xuXHRcdFx0XHRzeW5jX3NlbGVjdGVkX3NlcnZpY2UoKTtcblx0XHRcdFx0dXBkYXRlX3NlcnZpY2VfcGljdHVyZSgpO1xuXHRcdFx0XHR1cGRhdGVfc2VydmljZV9zdW1tYXJ5KCk7XG5cdFx0XHRcdHJlbmRlcl9zZXJ2aWNlX2NhcmRzKCk7XG5cdFx0XHRcdHNoZWxsX2FwaS5jbGVhcl9maWVsZF9lcnJvciggJ3NlcnZpY2VzJyApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEhhbmRsZSBsaXZlIG51bWJlciwgcmFuZ2UsIGFuZCB0ZXh0IGVkaXRzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtJbnB1dEV2ZW50fSBldmVudCBEZWxlZ2F0ZWQgaW5wdXQgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfaW5wdXQoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGZpZWxkX25hbWU7XG5cdFx0XHR2YXIgbnVtYmVyX2NvbnRyb2w7XG5cblx0XHRcdGlmICggZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLXNlcnZpY2UtcmFuZ2VdJyApICkge1xuXHRcdFx0XHRmaWVsZF9uYW1lID0gZXZlbnQudGFyZ2V0LmRhdGFzZXQud3BiY1NlcnZpY2VSYW5nZTtcblx0XHRcdFx0bnVtYmVyX2NvbnRyb2wgPSBnZXRfc2VydmljZV9maWVsZCggZmllbGRfbmFtZSApO1xuXHRcdFx0XHRpZiAoIG51bWJlcl9jb250cm9sICkge1xuXHRcdFx0XHRcdG51bWJlcl9jb250cm9sLnZhbHVlID0gZXZlbnQudGFyZ2V0LnZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtc2VydmljZS1maWVsZF0nICkgKSB7XG5cdFx0XHRcdGZpZWxkX25hbWUgPSBldmVudC50YXJnZXQuZGF0YXNldC53cGJjU2VydmljZUZpZWxkO1xuXHRcdFx0XHRzeW5jX3JhbmdlX2Zyb21fbnVtYmVyKCBmaWVsZF9uYW1lICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHN5bmNfc2VsZWN0ZWRfc2VydmljZSgpO1xuXHRcdFx0dXBkYXRlX3NlcnZpY2VfcGljdHVyZSgpO1xuXHRcdFx0dXBkYXRlX3NlcnZpY2Vfc3VtbWFyeSgpO1xuXHRcdFx0cmVuZGVyX3NlcnZpY2VfY2FyZHMoKTtcblx0XHRcdHNoZWxsX2FwaS5jbGVhcl9maWVsZF9lcnJvciggJ3NlcnZpY2VzJyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlZnJlc2ggdGhlIG1lZGlhIHByZXZpZXcgYWZ0ZXIgdGhlIHNoYXJlZCBXb3JkUHJlc3MgcGlja2VyIHdyaXRlcyBhIFVSTC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX21lZGlhX3VybF9zZXQoKSB7XG5cdFx0XHRpZiAoICEgZWRpdG9yICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHN5bmNfc2VsZWN0ZWRfc2VydmljZSgpO1xuXHRcdFx0dXBkYXRlX3NlcnZpY2VfcGljdHVyZSgpO1xuXHRcdFx0cmVuZGVyX3NlcnZpY2VfY2FyZHMoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBJbml0aWFsaXplIHRoaXMgbW9kdWxlIGFnYWluc3Qgc2hlbGwtcHJvdmlkZWQgc2VydmljZXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmVnaXN0ZXJlZF9zaGVsbF9hcGkgU2hhcmVkIHdpemFyZCBhZGFwdGVyIHNlcnZpY2VzLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaW5pdGlhbGl6ZSggcmVnaXN0ZXJlZF9zaGVsbF9hcGkgKSB7XG5cdFx0XHR2YXIgcGFyc2VkX3NlcnZpY2VzO1xuXHRcdFx0dmFyIHBhcnNlZF9pbmFjdGl2ZV9zZXJ2aWNlX2lkcztcblx0XHRcdHZhciBlZGl0b3Jfbm9kZTtcblx0XHRcdHZhciB0cmFuc3BvcnQ7XG5cdFx0XHR2YXIgaW5hY3RpdmVfdHJhbnNwb3J0O1xuXG5cdFx0XHRzaGVsbF9hcGkgPSByZWdpc3RlcmVkX3NoZWxsX2FwaTtcblx0XHRcdHJvb3QgPSBzaGVsbF9hcGkucm9vdDtcblx0XHRcdGVkaXRvcl9ub2RlID0gcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zZXJ2aWNlcy1lZGl0b3JdJyApO1xuXHRcdFx0dHJhbnNwb3J0ID0gcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zZXJ2aWNlLWRyYWZ0XScgKTtcblx0XHRcdGluYWN0aXZlX3RyYW5zcG9ydCA9IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtaW5hY3RpdmUtc2VydmljZS1pZHNdJyApO1xuXHRcdFx0aWYgKCAhIGVkaXRvcl9ub2RlIHx8ICEgdHJhbnNwb3J0IHx8ICEgaW5hY3RpdmVfdHJhbnNwb3J0ICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdHBhcnNlZF9zZXJ2aWNlcyA9IEpTT04ucGFyc2UoIHRyYW5zcG9ydC52YWx1ZSB8fCAnW10nICk7XG5cdFx0XHR9IGNhdGNoICggcGFyc2VfZXJyb3IgKSB7XG5cdFx0XHRcdHBhcnNlZF9zZXJ2aWNlcyA9IFtdO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIEFycmF5LmlzQXJyYXkoIHBhcnNlZF9zZXJ2aWNlcyApICkge1xuXHRcdFx0XHRwYXJzZWRfc2VydmljZXMgPSBbXTtcblx0XHRcdH1cblx0XHRcdHRyeSB7XG5cdFx0XHRcdHBhcnNlZF9pbmFjdGl2ZV9zZXJ2aWNlX2lkcyA9IEpTT04ucGFyc2UoIGluYWN0aXZlX3RyYW5zcG9ydC52YWx1ZSB8fCAnW10nICk7XG5cdFx0XHR9IGNhdGNoICggaW5hY3RpdmVfcGFyc2VfZXJyb3IgKSB7XG5cdFx0XHRcdHBhcnNlZF9pbmFjdGl2ZV9zZXJ2aWNlX2lkcyA9IFtdO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIEFycmF5LmlzQXJyYXkoIHBhcnNlZF9pbmFjdGl2ZV9zZXJ2aWNlX2lkcyApICkge1xuXHRcdFx0XHRwYXJzZWRfaW5hY3RpdmVfc2VydmljZV9pZHMgPSBbXTtcblx0XHRcdH1cblx0XHRcdHBhcnNlZF9pbmFjdGl2ZV9zZXJ2aWNlX2lkcyA9IHBhcnNlZF9pbmFjdGl2ZV9zZXJ2aWNlX2lkcy5tYXAoIE51bWJlciApLmZpbHRlciggZnVuY3Rpb24gKCBzZXJ2aWNlX2lkLCBzZXJ2aWNlX2luZGV4LCBzZXJ2aWNlX2lkcyApIHtcblx0XHRcdFx0cmV0dXJuIGlzRmluaXRlKCBzZXJ2aWNlX2lkICkgJiYgc2VydmljZV9pZCA9PT0gTWF0aC5mbG9vciggc2VydmljZV9pZCApICYmIHNlcnZpY2VfaWQgPiAwICYmIHNlcnZpY2VfaWRzLmluZGV4T2YoIHNlcnZpY2VfaWQgKSA9PT0gc2VydmljZV9pbmRleDtcblx0XHRcdH0gKTtcblxuXHRcdFx0ZWRpdG9yID0ge1xuXHRcdFx0XHRub2RlOiBlZGl0b3Jfbm9kZSxcblx0XHRcdFx0dHJhbnNwb3J0OiB0cmFuc3BvcnQsXG5cdFx0XHRcdGluYWN0aXZlX3RyYW5zcG9ydDogaW5hY3RpdmVfdHJhbnNwb3J0LFxuXHRcdFx0XHRsaXN0OiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zZXJ2aWNlcy1saXN0XScgKSxcblx0XHRcdFx0dGVtcGxhdGU6IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2VydmljZS1jYXJkLXRlbXBsYXRlXScgKSxcblx0XHRcdFx0c2VydmljZXM6IHBhcnNlZF9zZXJ2aWNlcyxcblx0XHRcdFx0aW5hY3RpdmVfc2VydmljZV9pZHM6IHBhcnNlZF9pbmFjdGl2ZV9zZXJ2aWNlX2lkcyxcblx0XHRcdFx0c2VsZWN0ZWRfaW5kZXg6IDAsXG5cdFx0XHRcdG1heF9zZXJ2aWNlczogcGFyc2VJbnQoIHRyYW5zcG9ydC5kYXRhc2V0Lm1heFNlcnZpY2VzIHx8ICcyMCcsIDEwICksXG5cdFx0XHRcdHByaWNpbmdfYXZhaWxhYmxlOiAndHJ1ZScgPT09IGVkaXRvcl9ub2RlLmRhdGFzZXQucHJpY2luZ0F2YWlsYWJsZVxuXHRcdFx0fTtcblxuXHRcdFx0aWYgKCAhIGVkaXRvci5zZXJ2aWNlcy5sZW5ndGggKSB7XG5cdFx0XHRcdGVkaXRvci5zZXJ2aWNlcy5wdXNoKCBjcmVhdGVfc2VydmljZV9kcmFmdCgpICk7XG5cdFx0XHR9XG5cblx0XHRcdGVkaXRvci5ub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGhhbmRsZV9jbGljayApO1xuXHRcdFx0ZWRpdG9yLm5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIGhhbmRsZV9jaGFuZ2UgKTtcblx0XHRcdGVkaXRvci5ub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIGhhbmRsZV9pbnB1dCApO1xuXHRcdFx0JCggZG9jdW1lbnQgKS5vbiggJ3dwYmNfbWVkaWFfdXBsb2FkX3VybF9zZXQud3BiY1NldHVwV2l6YXJkU2VydmljZXMnLCAnI3dwYmMtc2V0dXAtd2l6YXJkLXNlcnZpY2UtcGljdHVyZS11cmwnLCBoYW5kbGVfbWVkaWFfdXJsX3NldCApO1xuXHRcdFx0cmVuZGVyX3NlcnZpY2VfZWRpdG9yKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogVmFsaWRhdGUgYWxsIHByb3Bvc2VkIFNlcnZpY2VzIGJlZm9yZSBmb3J3YXJkIG5hdmlnYXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfSBGaXJzdCBpbnZhbGlkIGRldGFpbCBjb250cm9sLCBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHZhbGlkYXRlKCkge1xuXHRcdFx0dmFyIGZpcnN0X2ludmFsaWQgPSBudWxsO1xuXG5cdFx0XHRpZiAoICEgZWRpdG9yIHx8ICEgZWRpdG9yLnNlcnZpY2VzLmxlbmd0aCApIHtcblx0XHRcdFx0cmV0dXJuIHNoZWxsX2FwaS5zZXRfZmllbGRfZXJyb3IoICdzZXJ2aWNlcycsIGdldF9tZXNzYWdlKCAnc2VydmljZV90aXRsZV9yZXF1aXJlZCcsICdFbnRlciBhIHRpdGxlIGZvciBldmVyeSBTZXJ2aWNlLicgKSApO1xuXHRcdFx0fVxuXG5cdFx0XHRzeW5jX3NlbGVjdGVkX3NlcnZpY2UoKTtcblx0XHRcdGVkaXRvci5zZXJ2aWNlcy5zb21lKCBmdW5jdGlvbiAoIHNlcnZpY2UsIHNlcnZpY2VfaW5kZXggKSB7XG5cdFx0XHRcdHZhciBpbnZhbGlkX2ZpZWxkX25hbWUgPSAnJztcblx0XHRcdFx0dmFyIG51bWVyaWNfZmllbGRzID0gW1xuXHRcdFx0XHRcdHsga2V5OiAnZHVyYXRpb25fbWludXRlcycsIG1pbjogMSwgbWF4OiAxNDQwIH0sXG5cdFx0XHRcdFx0eyBrZXk6ICdidWZmZXJfYmVmb3JlX21pbnV0ZXMnLCBtaW46IDAsIG1heDogMTQ0MCB9LFxuXHRcdFx0XHRcdHsga2V5OiAnYnVmZmVyX2FmdGVyX21pbnV0ZXMnLCBtaW46IDAsIG1heDogMTQ0MCB9XG5cdFx0XHRcdF07XG5cdFx0XHRcdHZhciBpbnZhbGlkX251bWJlciA9IG51bWVyaWNfZmllbGRzLnNvbWUoIGZ1bmN0aW9uICggcnVsZSApIHtcblx0XHRcdFx0XHR2YXIgbnVtYmVyX3ZhbHVlID0gTnVtYmVyKCBzZXJ2aWNlWyBydWxlLmtleSBdICk7XG5cdFx0XHRcdFx0dmFyIGlzX2ludmFsaWQgPSAhIC9eXFxkKyQvLnRlc3QoIFN0cmluZyggc2VydmljZVsgcnVsZS5rZXkgXSApICkgfHwgbnVtYmVyX3ZhbHVlIDwgcnVsZS5taW4gfHwgbnVtYmVyX3ZhbHVlID4gcnVsZS5tYXg7XG5cblx0XHRcdFx0XHRpZiAoIGlzX2ludmFsaWQgKSB7XG5cdFx0XHRcdFx0XHRpbnZhbGlkX2ZpZWxkX25hbWUgPSBydWxlLmtleTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGlzX2ludmFsaWQ7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0dmFyIGJhc2VfY29zdCA9IE51bWJlciggc2VydmljZS5iYXNlX2Nvc3QgKTtcblxuXHRcdFx0XHRpZiAoICEgaW52YWxpZF9udW1iZXIgJiYgZWRpdG9yLnByaWNpbmdfYXZhaWxhYmxlICYmICggISBpc0Zpbml0ZSggYmFzZV9jb3N0ICkgfHwgYmFzZV9jb3N0IDwgMCB8fCBiYXNlX2Nvc3QgPiAxMDAwICkgKSB7XG5cdFx0XHRcdFx0aW52YWxpZF9udW1iZXIgPSB0cnVlO1xuXHRcdFx0XHRcdGludmFsaWRfZmllbGRfbmFtZSA9ICdiYXNlX2Nvc3QnO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCAhIFN0cmluZyggc2VydmljZS50aXRsZSB8fCAnJyApLnRyaW0oKSB8fCBpbnZhbGlkX251bWJlciApIHtcblx0XHRcdFx0XHRlZGl0b3Iuc2VsZWN0ZWRfaW5kZXggPSBzZXJ2aWNlX2luZGV4O1xuXHRcdFx0XHRcdHJlbmRlcl9zZXJ2aWNlX2VkaXRvcigpO1xuXHRcdFx0XHRcdGZpcnN0X2ludmFsaWQgPSBnZXRfc2VydmljZV9maWVsZCggISBTdHJpbmcoIHNlcnZpY2UudGl0bGUgfHwgJycgKS50cmltKCkgPyAndGl0bGUnIDogaW52YWxpZF9maWVsZF9uYW1lICk7XG5cdFx0XHRcdFx0c2hlbGxfYXBpLnNldF9maWVsZF9lcnJvciggJ3NlcnZpY2VzJywgISBTdHJpbmcoIHNlcnZpY2UudGl0bGUgfHwgJycgKS50cmltKCkgPyBnZXRfbWVzc2FnZSggJ3NlcnZpY2VfdGl0bGVfcmVxdWlyZWQnLCAnRW50ZXIgYSB0aXRsZSBmb3IgZXZlcnkgU2VydmljZS4nICkgOiBnZXRfbWVzc2FnZSggJ3NlcnZpY2VfbnVtYmVyX2ludmFsaWQnLCAnRW50ZXIgYSB2YWxpZCBudW1iZXIgd2l0aGluIHRoZSBhdmFpbGFibGUgcmFuZ2UuJyApICk7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gZmlyc3RfaW52YWxpZDtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0aW5pdGlhbGl6ZTogaW5pdGlhbGl6ZSxcblx0XHRcdHN5bmM6IHN5bmNfc2VsZWN0ZWRfc2VydmljZSxcblx0XHRcdHZhbGlkYXRlOiB2YWxpZGF0ZVxuXHRcdH07XG5cdH1cblxuXHR3aW5kb3cud3BiY19zZXR1cF9lZGl0b3JfbW9kdWxlcyA9IHdpbmRvdy53cGJjX3NldHVwX2VkaXRvcl9tb2R1bGVzIHx8IHt9O1xuXHR3aW5kb3cud3BiY19zZXR1cF9lZGl0b3JfbW9kdWxlcy5zZXJ2aWNlcyA9IHtcblx0XHRjcmVhdGU6IGNyZWF0ZV9zZXJ2aWNlc19hZGFwdGVyXG5cdH07XG5cblx0aWYgKCB3aW5kb3cud3BiY19zZXR1cF93aXphcmRfYXBpICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19zZXR1cF93aXphcmRfYXBpLnJlZ2lzdGVyX3N0ZXBfYWRhcHRlciApIHtcblx0XHR3aW5kb3cud3BiY19zZXR1cF93aXphcmRfYXBpLnJlZ2lzdGVyX3N0ZXBfYWRhcHRlciggY3JlYXRlX3NlcnZpY2VzX2FkYXB0ZXIoIG1vZHVsZV9jb25maWcgKSApO1xuXHR9XG59KCBqUXVlcnksIHdpbmRvdywgZG9jdW1lbnQgKSApO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0UsV0FBV0EsQ0FBQyxFQUFFQyxNQUFN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
