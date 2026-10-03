"use strict";

/**
 * Browser adapter for Setup Wizard Booking Resource creation and editing.
 *
 * The adapter keeps existing updates separate from new drafts. It sends only
 * changed existing Resources, and the server remains authoritative for stale
 * detection, authorization, edition rules, and persistence.
 *
 * @package Booking Calendar
 */
(function ($, window, document) {
  'use strict';

  var module_config = window.wpbc_setup_wizard_booking_resources || {
    i18n: {}
  };

  /**
   * Create one isolated Resource editor adapter.
   *
   * @param {Object} config Translated presentation strings.
   * @return {Object} Setup Wizard step adapter.
   */
  function create_booking_resources_adapter(config) {
    var shell_api = null;
    var root = null;
    var editor = null;
    var editable_fields = ['title', 'description', 'picture_url', 'base_cost'];

    /**
     * Return a translated string or fallback.
     *
     * @param {string} key      Translation key.
     * @param {string} fallback Fallback text.
     * @return {string} Localized text.
     */
    function get_message(key, fallback) {
      return config.i18n && config.i18n[key] ? config.i18n[key] : fallback;
    }

    /**
     * Replace one `%s` token without interpreting replacement tokens.
     *
     * @param {string} message     Message template.
     * @param {string} replacement Plain-text replacement.
     * @return {string} Formatted message.
     */
    function format_message(message, replacement) {
      return String(message).replace('%s', function () {
        return String(replacement);
      });
    }

    /**
     * Return a detached JSON-safe copy.
     *
     * @param {Object} source Source object.
     * @return {Object} Detached copy.
     */
    function clone_resource(source) {
      return JSON.parse(JSON.stringify(source || {}));
    }

    /**
     * Create one unsaved Resource proposal.
     *
     * @return {Object} JSON-safe draft.
     */
    function create_resource_draft() {
      return {
        draft_id: 'draft-' + Date.now() + '-' + Math.floor(Math.random() * 100000),
        title: get_message('new_resource', 'New Booking Resource'),
        description: '',
        picture_url: '',
        base_cost: '0.00'
      };
    }

    /**
     * Return one details control by stable field name.
     *
     * @param {string} field_name Resource DTO field.
     * @return {HTMLElement|null} Matching control.
     */
    function get_resource_field(field_name) {
      return editor ? editor.node.querySelector('[data-wpbc-resource-field="' + field_name + '"]') : null;
    }

    /**
     * Return the selected new or existing Resource.
     *
     * @return {Object|null} Selected Resource or null.
     */
    function get_selected_resource() {
      if (!editor || null === editor.selected_index) {
        return null;
      }
      if ('existing' === editor.selected_type) {
        return editor.existing_resources[editor.selected_index] || null;
      }
      return editor.new_resources[editor.selected_index] || null;
    }

    /**
     * Test whether editable values differ from authorized source values.
     *
     * @param {Object} resource Current browser Resource.
     * @param {Object} baseline Authorized source Resource.
     * @return {boolean} True when at least one editable field changed.
     */
    function resource_is_dirty(resource, baseline) {
      return editable_fields.some(function (field_name) {
        return String(resource[field_name] || '') !== String(baseline[field_name] || '');
      });
    }

    /**
     * Build data-only update records for changed existing Resources.
     *
     * @return {Array} Existing Resource update payload.
     */
    function get_existing_updates() {
      return editor.existing_resources.reduce(function (updates, resource, resource_index) {
        var baseline = editor.existing_baselines[resource_index];
        var update;
        if (!baseline || !resource_is_dirty(resource, baseline)) {
          return updates;
        }
        update = {
          resource_id: Number(resource.resource_id || resource.id || 0),
          source_fingerprint: String(baseline.source_fingerprint || '')
        };
        editable_fields.forEach(function (field_name) {
          update[field_name] = String(resource[field_name] || '');
        });
        updates.push(update);
        return updates;
      }, []);
    }

    /**
     * Write new drafts and changed existing Resources to separate transports.
     *
     * @return {void}
     */
    function sync_transport() {
      if (!editor) {
        return;
      }
      editor.new_transport.value = JSON.stringify(editor.new_resources);
      editor.update_transport.value = JSON.stringify(get_existing_updates());
    }

    /**
     * Persist visible detail controls into the selected Resource.
     *
     * @return {void}
     */
    function sync_selected_resource() {
      var resource = get_selected_resource();
      if (!resource) {
        sync_transport();
        return;
      }
      editable_fields.forEach(function (field_name) {
        var field = get_resource_field(field_name);
        if (field && !field.disabled) {
          resource[field_name] = field.value;
        }
      });
      sync_transport();
    }

    /**
     * Update the selected Resource summary and picture preview.
     *
     * @return {void}
     */
    function render_details() {
      var resource = get_selected_resource();
      var fields = editor && editor.node.querySelector('[data-wpbc-resource-fields]');
      var empty = editor && editor.node.querySelector('[data-wpbc-resource-empty]');
      var title_control = get_resource_field('title');
      var picture_url;
      var image;
      var placeholder;
      var remove_picture;
      if (fields) {
        fields.hidden = !resource;
      }
      if (empty) {
        empty.hidden = Boolean(resource);
      }
      if (!resource) {
        return;
      }
      if (title_control) {
        title_control.setAttribute('data-wpbc-setup-wizard-error-control-for', 'existing' === editor.selected_type ? 'existing_booking_resources' : 'booking_resources');
      }
      editable_fields.forEach(function (field_name) {
        var field = get_resource_field(field_name);
        if (field) {
          field.value = undefined !== resource[field_name] ? resource[field_name] : '';
        }
      });
      picture_url = String(resource.picture_url || '').trim();
      image = editor.node.querySelector('[data-wpbc-resource-picture-image]');
      placeholder = editor.node.querySelector('[data-wpbc-resource-picture-placeholder]');
      remove_picture = editor.node.querySelector('[data-wpbc-remove-resource-picture]');
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
      if (remove_picture) {
        remove_picture.disabled = !editor.media_upload_available || !picture_url;
      }
    }

    /**
     * Expose the existing Resource dirty state through its server-rendered badge.
     *
     * @param {HTMLElement} card           Existing Resource card.
     * @param {number}      resource_index Resource index in the authorized list.
     * @return {void}
     */
    function render_existing_card_status(card, resource_index) {
      var status_badge = card.querySelector('[data-wpbc-resource-status]');
      var resource = editor.existing_resources[resource_index];
      var baseline = editor.existing_baselines[resource_index];
      var is_changed = Boolean(resource && baseline && resource_is_dirty(resource, baseline));
      if (status_badge) {
        status_badge.textContent = is_changed ? status_badge.dataset.changedLabel : status_badge.dataset.existingLabel;
        status_badge.classList.toggle('is-existing', !is_changed);
        status_badge.classList.toggle('is-changed', is_changed);
      }
    }

    /**
     * Update the server-rendered existing Resource cards.
     *
     * @return {void}
     */
    function render_existing_cards() {
      editor.existing_cards.forEach(function (card, resource_index) {
        var resource = editor.existing_resources[resource_index];
        var selection = card.querySelector('input[type="radio"]');
        var image = card.querySelector('img');
        var placeholder = card.querySelector('.wpbc-bi-image-fill');
        if (!resource) {
          return;
        }
        card.classList.toggle('is-selected', 'existing' === editor.selected_type && resource_index === editor.selected_index);
        selection.checked = 'existing' === editor.selected_type && resource_index === editor.selected_index;
        card.querySelector('strong').textContent = resource.title || get_message('new_resource', 'New Booking Resource');
        render_existing_card_status(card, resource_index);
        if (resource.picture_url) {
          image.src = resource.picture_url;
          image.hidden = false;
          placeholder.hidden = true;
        } else {
          image.removeAttribute('src');
          image.hidden = true;
          placeholder.hidden = false;
        }
      });
    }

    /**
     * Render new proposal cards and refresh existing card state.
     *
     * @return {void}
     */
    function render_cards() {
      var fragment;
      if (!editor || !editor.new_list || !editor.template) {
        return;
      }
      editor.new_list.innerHTML = '';
      fragment = document.createDocumentFragment();
      editor.new_resources.forEach(function (resource, resource_index) {
        var card = editor.template.content.firstElementChild.cloneNode(true);
        var selection = card.querySelector('input[type="radio"]');
        var image = card.querySelector('img');
        var placeholder = card.querySelector('.wpbc-bi-image-fill');
        var remove_button = card.querySelector('[data-wpbc-remove-resource]');
        card.classList.toggle('is-selected', 'new' === editor.selected_type && resource_index === editor.selected_index);
        selection.checked = 'new' === editor.selected_type && resource_index === editor.selected_index;
        selection.dataset.wpbcResourceSelection = 'new:' + String(resource_index);
        card.querySelector('strong').textContent = resource.title || get_message('new_resource', 'New Booking Resource');
        if (resource.picture_url) {
          image.src = resource.picture_url;
          image.hidden = false;
          placeholder.hidden = true;
        }
        remove_button.dataset.wpbcRemoveResource = String(resource_index);
        remove_button.setAttribute('aria-label', format_message(get_message('remove_resource', 'Remove %s'), resource.title || get_message('new_resource', 'New Booking Resource')));
        fragment.appendChild(card);
      });
      editor.new_list.appendChild(fragment);
      render_existing_cards();
      sync_transport();
      render_details();
    }

    /**
     * Select a Resource from a stable `type:index` browser value.
     *
     * @param {string} selection_value Browser selection value.
     * @return {void}
     */
    function select_resource(selection_value) {
      var selection_parts = String(selection_value || '').split(':');
      var selected_type = selection_parts[0];
      var selected_index = parseInt(selection_parts[1], 10);
      var selected_card;
      var selected_control;
      if (['new', 'existing'].indexOf(selected_type) < 0 || isNaN(selected_index)) {
        return;
      }
      selected_card = 'existing' === selected_type ? editor.existing_cards[selected_index] : editor.new_list.querySelector('[data-wpbc-resource-selection="new:' + String(selected_index) + '"]');
      if (!selected_card) {
        return;
      }
      sync_selected_resource();
      editor.selected_type = selected_type;
      editor.selected_index = selected_index;
      render_cards();
      selected_control = 'existing' === selected_type ? selected_card.querySelector('input[type="radio"]') : editor.new_list.querySelector('[data-wpbc-resource-selection="new:' + String(selected_index) + '"]');
      if (selected_control) {
        try {
          selected_control.focus({
            preventScroll: true
          });
        } catch (focus_error) {
          selected_control.focus();
        }
      }
    }

    /**
     * Handle delegated editor button actions.
     *
     * @param {MouseEvent} event Click event.
     * @return {void}
     */
    function handle_click(event) {
      var remove_button = event.target.closest('[data-wpbc-remove-resource]');
      var remove_index;
      var focus_target;
      if (event.target.closest('[data-wpbc-add-resource]')) {
        if (!editor.can_create || editor.new_resources.length >= editor.max_resources) {
          shell_api.set_field_error('booking_resources', get_message('resource_limit', 'The Booking Resource limit for this account has been reached.'));
          return;
        }
        sync_selected_resource();
        editor.new_resources.push(create_resource_draft());
        editor.selected_type = 'new';
        editor.selected_index = editor.new_resources.length - 1;
        render_cards();
        shell_api.clear_field_error('booking_resources');
        get_resource_field('title').focus();
        return;
      }
      if (remove_button) {
        remove_index = parseInt(remove_button.dataset.wpbcRemoveResource, 10);
        if (!isNaN(remove_index) && editor.new_resources[remove_index]) {
          editor.new_resources.splice(remove_index, 1);
          if (editor.new_resources.length) {
            editor.selected_type = 'new';
            editor.selected_index = Math.max(0, Math.min(editor.selected_index, editor.new_resources.length - 1));
          } else if (editor.existing_resources.length) {
            editor.selected_type = 'existing';
            editor.selected_index = 0;
          } else {
            editor.selected_type = null;
            editor.selected_index = null;
          }
          render_cards();
          shell_api.set_status(get_message('resource_removed', 'Unsaved Booking Resource removed from this setup.'));
          focus_target = editor.new_list.querySelector('input[type="radio"]') || (editor.existing_list ? editor.existing_list.querySelector('input[type="radio"]') : null) || editor.node.querySelector('[data-wpbc-add-resource]');
          if (focus_target) {
            focus_target.focus();
          }
        }
        return;
      }
      if (event.target.closest('[data-wpbc-remove-resource-picture]') && editor.media_upload_available) {
        var picture_field = get_resource_field('picture_url');
        if (picture_field) {
          picture_field.value = '';
          sync_selected_resource();
          render_cards();
        }
      }
    }

    /**
     * Handle selection and committed field changes.
     *
     * @param {Event} event Change event.
     * @return {void}
     */
    function handle_change(event) {
      if (event.target.matches('[data-wpbc-resource-selection]')) {
        select_resource(event.target.dataset.wpbcResourceSelection);
        return;
      }
      if (event.target.matches('[data-wpbc-resource-field]')) {
        sync_selected_resource();
        render_cards();
        shell_api.clear_field_error('booking_resources');
        shell_api.clear_field_error('existing_booking_resources');
      }
    }

    /**
     * Handle live text editing without reconstructing the active controls.
     *
     * @param {InputEvent} event Input event.
     * @return {void}
     */
    function handle_input(event) {
      var resource;
      var card;
      if (!event.target.matches('[data-wpbc-resource-field]')) {
        return;
      }
      sync_selected_resource();
      resource = get_selected_resource();
      card = 'existing' === editor.selected_type ? editor.existing_cards[editor.selected_index] : editor.new_list.children[editor.selected_index];
      if (card && resource) {
        card.querySelector('strong').textContent = resource.title || get_message('new_resource', 'New Booking Resource');
        if ('existing' === editor.selected_type) {
          render_existing_card_status(card, editor.selected_index);
        }
      }
      shell_api.clear_field_error('booking_resources');
      shell_api.clear_field_error('existing_booking_resources');
    }

    /**
     * Refresh after the shared WordPress media picker sets the URL field.
     *
     * @return {void}
     */
    function handle_media_url_set() {
      sync_selected_resource();
      render_cards();
    }

    /**
     * Parse one JSON array transport without trusting its shape.
     *
     * @param {string} encoded_value JSON value.
     * @return {Array} Decoded array or an empty array.
     */
    function parse_array(encoded_value) {
      var parsed_value;
      try {
        parsed_value = JSON.parse(encoded_value || '[]');
      } catch (parse_error) {
        parsed_value = [];
      }
      return Array.isArray(parsed_value) ? parsed_value : [];
    }

    /**
     * Initialize this step from the shell and data-only transports.
     *
     * @param {Object} registered_shell_api Shared wizard services.
     * @return {void}
     */
    function initialize(registered_shell_api) {
      var editor_node;
      var new_transport;
      var update_transport;
      var existing_source;
      var existing_resources;
      shell_api = registered_shell_api;
      root = shell_api.root;
      editor_node = root.querySelector('[data-wpbc-booking-resources-editor]');
      new_transport = root.querySelector('[data-wpbc-booking-resource-drafts]');
      update_transport = root.querySelector('[data-wpbc-existing-resource-updates]');
      existing_source = root.querySelector('[data-wpbc-existing-resource-source]');
      if (!editor_node || !new_transport || !update_transport || !existing_source) {
        return;
      }
      existing_resources = parse_array(existing_source.value);
      editor = {
        node: editor_node,
        new_transport: new_transport,
        update_transport: update_transport,
        new_list: editor_node.querySelector('[data-wpbc-new-resource-list]'),
        existing_list: editor_node.querySelector('[data-wpbc-existing-resource-list]'),
        existing_cards: Array.prototype.slice.call(editor_node.querySelectorAll('[data-wpbc-existing-resource-card]')),
        template: root.querySelector('[data-wpbc-resource-card-template]'),
        new_resources: parse_array(new_transport.value),
        existing_resources: existing_resources.map(clone_resource),
        existing_baselines: existing_resources.map(clone_resource),
        selected_type: null,
        selected_index: null,
        can_create: 'true' === editor_node.dataset.canCreate,
        pricing_available: 'true' === editor_node.dataset.pricingAvailable,
        media_upload_available: 'true' === editor_node.dataset.mediaUploadAvailable,
        max_resources: parseInt(new_transport.dataset.maxResourceDrafts || '0', 10)
      };
      if (editor.new_resources.length) {
        editor.selected_type = 'new';
        editor.selected_index = 0;
      } else if (editor.existing_resources.length) {
        editor.selected_type = 'existing';
        editor.selected_index = 0;
      }
      editor.node.addEventListener('click', handle_click);
      editor.node.addEventListener('change', handle_change);
      editor.node.addEventListener('input', handle_input);
      $(document).off('wpbc_media_upload_url_set.wpbcSetupWizardResources', '#wpbc-setup-wizard-resource-picture-url').on('wpbc_media_upload_url_set.wpbcSetupWizardResources', '#wpbc-setup-wizard-resource-picture-url', handle_media_url_set);
      render_cards();
    }

    /**
     * Validate new drafts and changed existing Resources before navigation.
     *
     * @return {HTMLElement|null} First invalid control or null.
     */
    function validate() {
      var first_invalid = null;
      sync_selected_resource();
      [{
        type: 'new',
        resources: editor.new_resources,
        field_id: 'booking_resources'
      }, {
        type: 'existing',
        resources: editor.existing_resources,
        field_id: 'existing_booking_resources'
      }].some(function (collection) {
        return collection.resources.some(function (resource, resource_index) {
          var baseline = 'existing' === collection.type ? editor.existing_baselines[resource_index] : null;
          var price = Number(resource.base_cost);
          var title_missing = !String(resource.title || '').trim();
          if (baseline && !resource_is_dirty(resource, baseline)) {
            return false;
          }
          if (!title_missing && (!editor.pricing_available || isFinite(price) && price >= 0)) {
            return false;
          }
          editor.selected_type = collection.type;
          editor.selected_index = resource_index;
          render_cards();
          first_invalid = get_resource_field(title_missing ? 'title' : 'base_cost');
          shell_api.set_field_error(collection.field_id, title_missing ? get_message('resource_title_required', 'Enter a name for every Booking Resource.') : get_message('resource_price_invalid', 'Enter a valid non-negative base cost.'));
          return true;
        });
      });
      return first_invalid;
    }
    return {
      initialize: initialize,
      sync: sync_selected_resource,
      validate: validate
    };
  }
  window.wpbc_setup_editor_modules = window.wpbc_setup_editor_modules || {};
  window.wpbc_setup_editor_modules.booking_resources = {
    create: create_booking_resources_adapter
  };
  if (window.wpbc_setup_wizard_api && 'function' === typeof window.wpbc_setup_wizard_api.register_step_adapter) {
    window.wpbc_setup_wizard_api.register_step_adapter(create_booking_resources_adapter(module_config));
  }
})(jQuery, window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR1cC13aXphcmQvc3RlcC1ib29raW5nLXJlc291cmNlcy9fb3V0L3N0ZXAtYm9va2luZy1yZXNvdXJjZXMuanMiLCJuYW1lcyI6WyIkIiwid2luZG93IiwiZG9jdW1lbnQiLCJtb2R1bGVfY29uZmlnIiwid3BiY19zZXR1cF93aXphcmRfYm9va2luZ19yZXNvdXJjZXMiLCJpMThuIiwiY3JlYXRlX2Jvb2tpbmdfcmVzb3VyY2VzX2FkYXB0ZXIiLCJjb25maWciLCJzaGVsbF9hcGkiLCJyb290IiwiZWRpdG9yIiwiZWRpdGFibGVfZmllbGRzIiwiZ2V0X21lc3NhZ2UiLCJrZXkiLCJmYWxsYmFjayIsImZvcm1hdF9tZXNzYWdlIiwibWVzc2FnZSIsInJlcGxhY2VtZW50IiwiU3RyaW5nIiwicmVwbGFjZSIsImNsb25lX3Jlc291cmNlIiwic291cmNlIiwiSlNPTiIsInBhcnNlIiwic3RyaW5naWZ5IiwiY3JlYXRlX3Jlc291cmNlX2RyYWZ0IiwiZHJhZnRfaWQiLCJEYXRlIiwibm93IiwiTWF0aCIsImZsb29yIiwicmFuZG9tIiwidGl0bGUiLCJkZXNjcmlwdGlvbiIsInBpY3R1cmVfdXJsIiwiYmFzZV9jb3N0IiwiZ2V0X3Jlc291cmNlX2ZpZWxkIiwiZmllbGRfbmFtZSIsIm5vZGUiLCJxdWVyeVNlbGVjdG9yIiwiZ2V0X3NlbGVjdGVkX3Jlc291cmNlIiwic2VsZWN0ZWRfaW5kZXgiLCJzZWxlY3RlZF90eXBlIiwiZXhpc3RpbmdfcmVzb3VyY2VzIiwibmV3X3Jlc291cmNlcyIsInJlc291cmNlX2lzX2RpcnR5IiwicmVzb3VyY2UiLCJiYXNlbGluZSIsInNvbWUiLCJnZXRfZXhpc3RpbmdfdXBkYXRlcyIsInJlZHVjZSIsInVwZGF0ZXMiLCJyZXNvdXJjZV9pbmRleCIsImV4aXN0aW5nX2Jhc2VsaW5lcyIsInVwZGF0ZSIsInJlc291cmNlX2lkIiwiTnVtYmVyIiwiaWQiLCJzb3VyY2VfZmluZ2VycHJpbnQiLCJmb3JFYWNoIiwicHVzaCIsInN5bmNfdHJhbnNwb3J0IiwibmV3X3RyYW5zcG9ydCIsInZhbHVlIiwidXBkYXRlX3RyYW5zcG9ydCIsInN5bmNfc2VsZWN0ZWRfcmVzb3VyY2UiLCJmaWVsZCIsImRpc2FibGVkIiwicmVuZGVyX2RldGFpbHMiLCJmaWVsZHMiLCJlbXB0eSIsInRpdGxlX2NvbnRyb2wiLCJpbWFnZSIsInBsYWNlaG9sZGVyIiwicmVtb3ZlX3BpY3R1cmUiLCJoaWRkZW4iLCJCb29sZWFuIiwic2V0QXR0cmlidXRlIiwidW5kZWZpbmVkIiwidHJpbSIsInNyYyIsInJlbW92ZUF0dHJpYnV0ZSIsIm1lZGlhX3VwbG9hZF9hdmFpbGFibGUiLCJyZW5kZXJfZXhpc3RpbmdfY2FyZF9zdGF0dXMiLCJjYXJkIiwic3RhdHVzX2JhZGdlIiwiaXNfY2hhbmdlZCIsInRleHRDb250ZW50IiwiZGF0YXNldCIsImNoYW5nZWRMYWJlbCIsImV4aXN0aW5nTGFiZWwiLCJjbGFzc0xpc3QiLCJ0b2dnbGUiLCJyZW5kZXJfZXhpc3RpbmdfY2FyZHMiLCJleGlzdGluZ19jYXJkcyIsInNlbGVjdGlvbiIsImNoZWNrZWQiLCJyZW5kZXJfY2FyZHMiLCJmcmFnbWVudCIsIm5ld19saXN0IiwidGVtcGxhdGUiLCJpbm5lckhUTUwiLCJjcmVhdGVEb2N1bWVudEZyYWdtZW50IiwiY29udGVudCIsImZpcnN0RWxlbWVudENoaWxkIiwiY2xvbmVOb2RlIiwicmVtb3ZlX2J1dHRvbiIsIndwYmNSZXNvdXJjZVNlbGVjdGlvbiIsIndwYmNSZW1vdmVSZXNvdXJjZSIsImFwcGVuZENoaWxkIiwic2VsZWN0X3Jlc291cmNlIiwic2VsZWN0aW9uX3ZhbHVlIiwic2VsZWN0aW9uX3BhcnRzIiwic3BsaXQiLCJwYXJzZUludCIsInNlbGVjdGVkX2NhcmQiLCJzZWxlY3RlZF9jb250cm9sIiwiaW5kZXhPZiIsImlzTmFOIiwiZm9jdXMiLCJwcmV2ZW50U2Nyb2xsIiwiZm9jdXNfZXJyb3IiLCJoYW5kbGVfY2xpY2siLCJldmVudCIsInRhcmdldCIsImNsb3Nlc3QiLCJyZW1vdmVfaW5kZXgiLCJmb2N1c190YXJnZXQiLCJjYW5fY3JlYXRlIiwibGVuZ3RoIiwibWF4X3Jlc291cmNlcyIsInNldF9maWVsZF9lcnJvciIsImNsZWFyX2ZpZWxkX2Vycm9yIiwic3BsaWNlIiwibWF4IiwibWluIiwic2V0X3N0YXR1cyIsImV4aXN0aW5nX2xpc3QiLCJwaWN0dXJlX2ZpZWxkIiwiaGFuZGxlX2NoYW5nZSIsIm1hdGNoZXMiLCJoYW5kbGVfaW5wdXQiLCJjaGlsZHJlbiIsImhhbmRsZV9tZWRpYV91cmxfc2V0IiwicGFyc2VfYXJyYXkiLCJlbmNvZGVkX3ZhbHVlIiwicGFyc2VkX3ZhbHVlIiwicGFyc2VfZXJyb3IiLCJBcnJheSIsImlzQXJyYXkiLCJpbml0aWFsaXplIiwicmVnaXN0ZXJlZF9zaGVsbF9hcGkiLCJlZGl0b3Jfbm9kZSIsImV4aXN0aW5nX3NvdXJjZSIsInByb3RvdHlwZSIsInNsaWNlIiwiY2FsbCIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJtYXAiLCJjYW5DcmVhdGUiLCJwcmljaW5nX2F2YWlsYWJsZSIsInByaWNpbmdBdmFpbGFibGUiLCJtZWRpYVVwbG9hZEF2YWlsYWJsZSIsIm1heFJlc291cmNlRHJhZnRzIiwiYWRkRXZlbnRMaXN0ZW5lciIsIm9mZiIsIm9uIiwidmFsaWRhdGUiLCJmaXJzdF9pbnZhbGlkIiwidHlwZSIsInJlc291cmNlcyIsImZpZWxkX2lkIiwiY29sbGVjdGlvbiIsInByaWNlIiwidGl0bGVfbWlzc2luZyIsImlzRmluaXRlIiwic3luYyIsIndwYmNfc2V0dXBfZWRpdG9yX21vZHVsZXMiLCJib29raW5nX3Jlc291cmNlcyIsImNyZWF0ZSIsIndwYmNfc2V0dXBfd2l6YXJkX2FwaSIsInJlZ2lzdGVyX3N0ZXBfYWRhcHRlciIsImpRdWVyeSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2Utc2V0dXAtd2l6YXJkL3N0ZXAtYm9va2luZy1yZXNvdXJjZXMvX3NyYy9zdGVwLWJvb2tpbmctcmVzb3VyY2VzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQnJvd3NlciBhZGFwdGVyIGZvciBTZXR1cCBXaXphcmQgQm9va2luZyBSZXNvdXJjZSBjcmVhdGlvbiBhbmQgZWRpdGluZy5cbiAqXG4gKiBUaGUgYWRhcHRlciBrZWVwcyBleGlzdGluZyB1cGRhdGVzIHNlcGFyYXRlIGZyb20gbmV3IGRyYWZ0cy4gSXQgc2VuZHMgb25seVxuICogY2hhbmdlZCBleGlzdGluZyBSZXNvdXJjZXMsIGFuZCB0aGUgc2VydmVyIHJlbWFpbnMgYXV0aG9yaXRhdGl2ZSBmb3Igc3RhbGVcbiAqIGRldGVjdGlvbiwgYXV0aG9yaXphdGlvbiwgZWRpdGlvbiBydWxlcywgYW5kIHBlcnNpc3RlbmNlLlxuICpcbiAqIEBwYWNrYWdlIEJvb2tpbmcgQ2FsZW5kYXJcbiAqL1xuKCBmdW5jdGlvbiAoICQsIHdpbmRvdywgZG9jdW1lbnQgKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHR2YXIgbW9kdWxlX2NvbmZpZyA9IHdpbmRvdy53cGJjX3NldHVwX3dpemFyZF9ib29raW5nX3Jlc291cmNlcyB8fCB7IGkxOG46IHt9IH07XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBvbmUgaXNvbGF0ZWQgUmVzb3VyY2UgZWRpdG9yIGFkYXB0ZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgVHJhbnNsYXRlZCBwcmVzZW50YXRpb24gc3RyaW5ncy5cblx0ICogQHJldHVybiB7T2JqZWN0fSBTZXR1cCBXaXphcmQgc3RlcCBhZGFwdGVyLlxuXHQgKi9cblx0ZnVuY3Rpb24gY3JlYXRlX2Jvb2tpbmdfcmVzb3VyY2VzX2FkYXB0ZXIoIGNvbmZpZyApIHtcblx0XHR2YXIgc2hlbGxfYXBpID0gbnVsbDtcblx0XHR2YXIgcm9vdCA9IG51bGw7XG5cdFx0dmFyIGVkaXRvciA9IG51bGw7XG5cdFx0dmFyIGVkaXRhYmxlX2ZpZWxkcyA9IFsgJ3RpdGxlJywgJ2Rlc2NyaXB0aW9uJywgJ3BpY3R1cmVfdXJsJywgJ2Jhc2VfY29zdCcgXTtcblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBhIHRyYW5zbGF0ZWQgc3RyaW5nIG9yIGZhbGxiYWNrLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGtleSAgICAgIFRyYW5zbGF0aW9uIGtleS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZmFsbGJhY2sgRmFsbGJhY2sgdGV4dC5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IExvY2FsaXplZCB0ZXh0LlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9tZXNzYWdlKCBrZXksIGZhbGxiYWNrICkge1xuXHRcdFx0cmV0dXJuIGNvbmZpZy5pMThuICYmIGNvbmZpZy5pMThuWyBrZXkgXSA/IGNvbmZpZy5pMThuWyBrZXkgXSA6IGZhbGxiYWNrO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlcGxhY2Ugb25lIGAlc2AgdG9rZW4gd2l0aG91dCBpbnRlcnByZXRpbmcgcmVwbGFjZW1lbnQgdG9rZW5zLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgICAgIE1lc3NhZ2UgdGVtcGxhdGUuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHJlcGxhY2VtZW50IFBsYWluLXRleHQgcmVwbGFjZW1lbnQuXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBGb3JtYXR0ZWQgbWVzc2FnZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBmb3JtYXRfbWVzc2FnZSggbWVzc2FnZSwgcmVwbGFjZW1lbnQgKSB7XG5cdFx0XHRyZXR1cm4gU3RyaW5nKCBtZXNzYWdlICkucmVwbGFjZSggJyVzJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gU3RyaW5nKCByZXBsYWNlbWVudCApO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBhIGRldGFjaGVkIEpTT04tc2FmZSBjb3B5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNvdXJjZSBTb3VyY2Ugb2JqZWN0LlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gRGV0YWNoZWQgY29weS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjbG9uZV9yZXNvdXJjZSggc291cmNlICkge1xuXHRcdFx0cmV0dXJuIEpTT04ucGFyc2UoIEpTT04uc3RyaW5naWZ5KCBzb3VyY2UgfHwge30gKSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENyZWF0ZSBvbmUgdW5zYXZlZCBSZXNvdXJjZSBwcm9wb3NhbC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gSlNPTi1zYWZlIGRyYWZ0LlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNyZWF0ZV9yZXNvdXJjZV9kcmFmdCgpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGRyYWZ0X2lkOiAnZHJhZnQtJyArIERhdGUubm93KCkgKyAnLScgKyBNYXRoLmZsb29yKCBNYXRoLnJhbmRvbSgpICogMTAwMDAwICksXG5cdFx0XHRcdHRpdGxlOiBnZXRfbWVzc2FnZSggJ25ld19yZXNvdXJjZScsICdOZXcgQm9va2luZyBSZXNvdXJjZScgKSxcblx0XHRcdFx0ZGVzY3JpcHRpb246ICcnLFxuXHRcdFx0XHRwaWN0dXJlX3VybDogJycsXG5cdFx0XHRcdGJhc2VfY29zdDogJzAuMDAnXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBvbmUgZGV0YWlscyBjb250cm9sIGJ5IHN0YWJsZSBmaWVsZCBuYW1lLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGZpZWxkX25hbWUgUmVzb3VyY2UgRFRPIGZpZWxkLlxuXHRcdCAqIEByZXR1cm4ge0hUTUxFbGVtZW50fG51bGx9IE1hdGNoaW5nIGNvbnRyb2wuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3Jlc291cmNlX2ZpZWxkKCBmaWVsZF9uYW1lICkge1xuXHRcdFx0cmV0dXJuIGVkaXRvciA/IGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXJlc291cmNlLWZpZWxkPVwiJyArIGZpZWxkX25hbWUgKyAnXCJdJyApIDogbnVsbDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gdGhlIHNlbGVjdGVkIG5ldyBvciBleGlzdGluZyBSZXNvdXJjZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBTZWxlY3RlZCBSZXNvdXJjZSBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9zZWxlY3RlZF9yZXNvdXJjZSgpIHtcblx0XHRcdGlmICggISBlZGl0b3IgfHwgbnVsbCA9PT0gZWRpdG9yLnNlbGVjdGVkX2luZGV4ICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGlmICggJ2V4aXN0aW5nJyA9PT0gZWRpdG9yLnNlbGVjdGVkX3R5cGUgKSB7XG5cdFx0XHRcdHJldHVybiBlZGl0b3IuZXhpc3RpbmdfcmVzb3VyY2VzWyBlZGl0b3Iuc2VsZWN0ZWRfaW5kZXggXSB8fCBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZWRpdG9yLm5ld19yZXNvdXJjZXNbIGVkaXRvci5zZWxlY3RlZF9pbmRleCBdIHx8IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogVGVzdCB3aGV0aGVyIGVkaXRhYmxlIHZhbHVlcyBkaWZmZXIgZnJvbSBhdXRob3JpemVkIHNvdXJjZSB2YWx1ZXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmVzb3VyY2UgQ3VycmVudCBicm93c2VyIFJlc291cmNlLlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBiYXNlbGluZSBBdXRob3JpemVkIHNvdXJjZSBSZXNvdXJjZS5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gYXQgbGVhc3Qgb25lIGVkaXRhYmxlIGZpZWxkIGNoYW5nZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVzb3VyY2VfaXNfZGlydHkoIHJlc291cmNlLCBiYXNlbGluZSApIHtcblx0XHRcdHJldHVybiBlZGl0YWJsZV9maWVsZHMuc29tZSggZnVuY3Rpb24gKCBmaWVsZF9uYW1lICkge1xuXHRcdFx0XHRyZXR1cm4gU3RyaW5nKCByZXNvdXJjZVsgZmllbGRfbmFtZSBdIHx8ICcnICkgIT09IFN0cmluZyggYmFzZWxpbmVbIGZpZWxkX25hbWUgXSB8fCAnJyApO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEJ1aWxkIGRhdGEtb25seSB1cGRhdGUgcmVjb3JkcyBmb3IgY2hhbmdlZCBleGlzdGluZyBSZXNvdXJjZXMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtBcnJheX0gRXhpc3RpbmcgUmVzb3VyY2UgdXBkYXRlIHBheWxvYWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2V4aXN0aW5nX3VwZGF0ZXMoKSB7XG5cdFx0XHRyZXR1cm4gZWRpdG9yLmV4aXN0aW5nX3Jlc291cmNlcy5yZWR1Y2UoIGZ1bmN0aW9uICggdXBkYXRlcywgcmVzb3VyY2UsIHJlc291cmNlX2luZGV4ICkge1xuXHRcdFx0XHR2YXIgYmFzZWxpbmUgPSBlZGl0b3IuZXhpc3RpbmdfYmFzZWxpbmVzWyByZXNvdXJjZV9pbmRleCBdO1xuXHRcdFx0XHR2YXIgdXBkYXRlO1xuXG5cdFx0XHRcdGlmICggISBiYXNlbGluZSB8fCAhIHJlc291cmNlX2lzX2RpcnR5KCByZXNvdXJjZSwgYmFzZWxpbmUgKSApIHtcblx0XHRcdFx0XHRyZXR1cm4gdXBkYXRlcztcblx0XHRcdFx0fVxuXHRcdFx0XHR1cGRhdGUgPSB7XG5cdFx0XHRcdFx0cmVzb3VyY2VfaWQ6IE51bWJlciggcmVzb3VyY2UucmVzb3VyY2VfaWQgfHwgcmVzb3VyY2UuaWQgfHwgMCApLFxuXHRcdFx0XHRcdHNvdXJjZV9maW5nZXJwcmludDogU3RyaW5nKCBiYXNlbGluZS5zb3VyY2VfZmluZ2VycHJpbnQgfHwgJycgKVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRlZGl0YWJsZV9maWVsZHMuZm9yRWFjaCggZnVuY3Rpb24gKCBmaWVsZF9uYW1lICkge1xuXHRcdFx0XHRcdHVwZGF0ZVsgZmllbGRfbmFtZSBdID0gU3RyaW5nKCByZXNvdXJjZVsgZmllbGRfbmFtZSBdIHx8ICcnICk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0dXBkYXRlcy5wdXNoKCB1cGRhdGUgKTtcblxuXHRcdFx0XHRyZXR1cm4gdXBkYXRlcztcblx0XHRcdH0sIFtdICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogV3JpdGUgbmV3IGRyYWZ0cyBhbmQgY2hhbmdlZCBleGlzdGluZyBSZXNvdXJjZXMgdG8gc2VwYXJhdGUgdHJhbnNwb3J0cy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3luY190cmFuc3BvcnQoKSB7XG5cdFx0XHRpZiAoICEgZWRpdG9yICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRlZGl0b3IubmV3X3RyYW5zcG9ydC52YWx1ZSA9IEpTT04uc3RyaW5naWZ5KCBlZGl0b3IubmV3X3Jlc291cmNlcyApO1xuXHRcdFx0ZWRpdG9yLnVwZGF0ZV90cmFuc3BvcnQudmFsdWUgPSBKU09OLnN0cmluZ2lmeSggZ2V0X2V4aXN0aW5nX3VwZGF0ZXMoKSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFBlcnNpc3QgdmlzaWJsZSBkZXRhaWwgY29udHJvbHMgaW50byB0aGUgc2VsZWN0ZWQgUmVzb3VyY2UuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHN5bmNfc2VsZWN0ZWRfcmVzb3VyY2UoKSB7XG5cdFx0XHR2YXIgcmVzb3VyY2UgPSBnZXRfc2VsZWN0ZWRfcmVzb3VyY2UoKTtcblxuXHRcdFx0aWYgKCAhIHJlc291cmNlICkge1xuXHRcdFx0XHRzeW5jX3RyYW5zcG9ydCgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRlZGl0YWJsZV9maWVsZHMuZm9yRWFjaCggZnVuY3Rpb24gKCBmaWVsZF9uYW1lICkge1xuXHRcdFx0XHR2YXIgZmllbGQgPSBnZXRfcmVzb3VyY2VfZmllbGQoIGZpZWxkX25hbWUgKTtcblx0XHRcdFx0aWYgKCBmaWVsZCAmJiAhIGZpZWxkLmRpc2FibGVkICkge1xuXHRcdFx0XHRcdHJlc291cmNlWyBmaWVsZF9uYW1lIF0gPSBmaWVsZC52YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0c3luY190cmFuc3BvcnQoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBVcGRhdGUgdGhlIHNlbGVjdGVkIFJlc291cmNlIHN1bW1hcnkgYW5kIHBpY3R1cmUgcHJldmlldy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX2RldGFpbHMoKSB7XG5cdFx0XHR2YXIgcmVzb3VyY2UgPSBnZXRfc2VsZWN0ZWRfcmVzb3VyY2UoKTtcblx0XHRcdHZhciBmaWVsZHMgPSBlZGl0b3IgJiYgZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtcmVzb3VyY2UtZmllbGRzXScgKTtcblx0XHRcdHZhciBlbXB0eSA9IGVkaXRvciAmJiBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1yZXNvdXJjZS1lbXB0eV0nICk7XG5cdFx0XHR2YXIgdGl0bGVfY29udHJvbCA9IGdldF9yZXNvdXJjZV9maWVsZCggJ3RpdGxlJyApO1xuXHRcdFx0dmFyIHBpY3R1cmVfdXJsO1xuXHRcdFx0dmFyIGltYWdlO1xuXHRcdFx0dmFyIHBsYWNlaG9sZGVyO1xuXHRcdFx0dmFyIHJlbW92ZV9waWN0dXJlO1xuXG5cdFx0XHRpZiAoIGZpZWxkcyApIHtcblx0XHRcdFx0ZmllbGRzLmhpZGRlbiA9ICEgcmVzb3VyY2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGVtcHR5ICkge1xuXHRcdFx0XHRlbXB0eS5oaWRkZW4gPSBCb29sZWFuKCByZXNvdXJjZSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHJlc291cmNlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRpdGxlX2NvbnRyb2wgKSB7XG5cdFx0XHRcdHRpdGxlX2NvbnRyb2wuc2V0QXR0cmlidXRlKFxuXHRcdFx0XHRcdCdkYXRhLXdwYmMtc2V0dXAtd2l6YXJkLWVycm9yLWNvbnRyb2wtZm9yJyxcblx0XHRcdFx0XHQnZXhpc3RpbmcnID09PSBlZGl0b3Iuc2VsZWN0ZWRfdHlwZSA/ICdleGlzdGluZ19ib29raW5nX3Jlc291cmNlcycgOiAnYm9va2luZ19yZXNvdXJjZXMnXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cblx0XHRcdGVkaXRhYmxlX2ZpZWxkcy5mb3JFYWNoKCBmdW5jdGlvbiAoIGZpZWxkX25hbWUgKSB7XG5cdFx0XHRcdHZhciBmaWVsZCA9IGdldF9yZXNvdXJjZV9maWVsZCggZmllbGRfbmFtZSApO1xuXHRcdFx0XHRpZiAoIGZpZWxkICkge1xuXHRcdFx0XHRcdGZpZWxkLnZhbHVlID0gdW5kZWZpbmVkICE9PSByZXNvdXJjZVsgZmllbGRfbmFtZSBdID8gcmVzb3VyY2VbIGZpZWxkX25hbWUgXSA6ICcnO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHRcdHBpY3R1cmVfdXJsID0gU3RyaW5nKCByZXNvdXJjZS5waWN0dXJlX3VybCB8fCAnJyApLnRyaW0oKTtcblx0XHRcdGltYWdlID0gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtcmVzb3VyY2UtcGljdHVyZS1pbWFnZV0nICk7XG5cdFx0XHRwbGFjZWhvbGRlciA9IGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXJlc291cmNlLXBpY3R1cmUtcGxhY2Vob2xkZXJdJyApO1xuXHRcdFx0cmVtb3ZlX3BpY3R1cmUgPSBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1yZW1vdmUtcmVzb3VyY2UtcGljdHVyZV0nICk7XG5cdFx0XHRpZiAoIGltYWdlICkge1xuXHRcdFx0XHRpbWFnZS5oaWRkZW4gPSAhIHBpY3R1cmVfdXJsO1xuXHRcdFx0XHRpZiAoIHBpY3R1cmVfdXJsICkge1xuXHRcdFx0XHRcdGltYWdlLnNyYyA9IHBpY3R1cmVfdXJsO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGltYWdlLnJlbW92ZUF0dHJpYnV0ZSggJ3NyYycgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCBwbGFjZWhvbGRlciApIHtcblx0XHRcdFx0cGxhY2Vob2xkZXIuaGlkZGVuID0gQm9vbGVhbiggcGljdHVyZV91cmwgKTtcblx0XHRcdH1cblx0XHRcdGlmICggcmVtb3ZlX3BpY3R1cmUgKSB7XG5cdFx0XHRcdHJlbW92ZV9waWN0dXJlLmRpc2FibGVkID0gISBlZGl0b3IubWVkaWFfdXBsb2FkX2F2YWlsYWJsZSB8fCAhIHBpY3R1cmVfdXJsO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEV4cG9zZSB0aGUgZXhpc3RpbmcgUmVzb3VyY2UgZGlydHkgc3RhdGUgdGhyb3VnaCBpdHMgc2VydmVyLXJlbmRlcmVkIGJhZGdlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY2FyZCAgICAgICAgICAgRXhpc3RpbmcgUmVzb3VyY2UgY2FyZC5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gICAgICByZXNvdXJjZV9pbmRleCBSZXNvdXJjZSBpbmRleCBpbiB0aGUgYXV0aG9yaXplZCBsaXN0LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX2V4aXN0aW5nX2NhcmRfc3RhdHVzKCBjYXJkLCByZXNvdXJjZV9pbmRleCApIHtcblx0XHRcdHZhciBzdGF0dXNfYmFkZ2UgPSBjYXJkLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXJlc291cmNlLXN0YXR1c10nICk7XG5cdFx0XHR2YXIgcmVzb3VyY2UgPSBlZGl0b3IuZXhpc3RpbmdfcmVzb3VyY2VzWyByZXNvdXJjZV9pbmRleCBdO1xuXHRcdFx0dmFyIGJhc2VsaW5lID0gZWRpdG9yLmV4aXN0aW5nX2Jhc2VsaW5lc1sgcmVzb3VyY2VfaW5kZXggXTtcblx0XHRcdHZhciBpc19jaGFuZ2VkID0gQm9vbGVhbiggcmVzb3VyY2UgJiYgYmFzZWxpbmUgJiYgcmVzb3VyY2VfaXNfZGlydHkoIHJlc291cmNlLCBiYXNlbGluZSApICk7XG5cblx0XHRcdGlmICggc3RhdHVzX2JhZGdlICkge1xuXHRcdFx0XHRzdGF0dXNfYmFkZ2UudGV4dENvbnRlbnQgPSBpc19jaGFuZ2VkID8gc3RhdHVzX2JhZGdlLmRhdGFzZXQuY2hhbmdlZExhYmVsIDogc3RhdHVzX2JhZGdlLmRhdGFzZXQuZXhpc3RpbmdMYWJlbDtcblx0XHRcdFx0c3RhdHVzX2JhZGdlLmNsYXNzTGlzdC50b2dnbGUoICdpcy1leGlzdGluZycsICEgaXNfY2hhbmdlZCApO1xuXHRcdFx0XHRzdGF0dXNfYmFkZ2UuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWNoYW5nZWQnLCBpc19jaGFuZ2VkICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogVXBkYXRlIHRoZSBzZXJ2ZXItcmVuZGVyZWQgZXhpc3RpbmcgUmVzb3VyY2UgY2FyZHMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9leGlzdGluZ19jYXJkcygpIHtcblx0XHRcdGVkaXRvci5leGlzdGluZ19jYXJkcy5mb3JFYWNoKCBmdW5jdGlvbiAoIGNhcmQsIHJlc291cmNlX2luZGV4ICkge1xuXHRcdFx0XHR2YXIgcmVzb3VyY2UgPSBlZGl0b3IuZXhpc3RpbmdfcmVzb3VyY2VzWyByZXNvdXJjZV9pbmRleCBdO1xuXHRcdFx0XHR2YXIgc2VsZWN0aW9uID0gY2FyZC5xdWVyeVNlbGVjdG9yKCAnaW5wdXRbdHlwZT1cInJhZGlvXCJdJyApO1xuXHRcdFx0XHR2YXIgaW1hZ2UgPSBjYXJkLnF1ZXJ5U2VsZWN0b3IoICdpbWcnICk7XG5cdFx0XHRcdHZhciBwbGFjZWhvbGRlciA9IGNhcmQucXVlcnlTZWxlY3RvciggJy53cGJjLWJpLWltYWdlLWZpbGwnICk7XG5cblx0XHRcdFx0aWYgKCAhIHJlc291cmNlICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXJkLmNsYXNzTGlzdC50b2dnbGUoICdpcy1zZWxlY3RlZCcsICdleGlzdGluZycgPT09IGVkaXRvci5zZWxlY3RlZF90eXBlICYmIHJlc291cmNlX2luZGV4ID09PSBlZGl0b3Iuc2VsZWN0ZWRfaW5kZXggKTtcblx0XHRcdFx0c2VsZWN0aW9uLmNoZWNrZWQgPSAnZXhpc3RpbmcnID09PSBlZGl0b3Iuc2VsZWN0ZWRfdHlwZSAmJiByZXNvdXJjZV9pbmRleCA9PT0gZWRpdG9yLnNlbGVjdGVkX2luZGV4O1xuXHRcdFx0XHRjYXJkLnF1ZXJ5U2VsZWN0b3IoICdzdHJvbmcnICkudGV4dENvbnRlbnQgPSByZXNvdXJjZS50aXRsZSB8fCBnZXRfbWVzc2FnZSggJ25ld19yZXNvdXJjZScsICdOZXcgQm9va2luZyBSZXNvdXJjZScgKTtcblx0XHRcdFx0cmVuZGVyX2V4aXN0aW5nX2NhcmRfc3RhdHVzKCBjYXJkLCByZXNvdXJjZV9pbmRleCApO1xuXHRcdFx0XHRpZiAoIHJlc291cmNlLnBpY3R1cmVfdXJsICkge1xuXHRcdFx0XHRcdGltYWdlLnNyYyA9IHJlc291cmNlLnBpY3R1cmVfdXJsO1xuXHRcdFx0XHRcdGltYWdlLmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0XHRcdHBsYWNlaG9sZGVyLmhpZGRlbiA9IHRydWU7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aW1hZ2UucmVtb3ZlQXR0cmlidXRlKCAnc3JjJyApO1xuXHRcdFx0XHRcdGltYWdlLmhpZGRlbiA9IHRydWU7XG5cdFx0XHRcdFx0cGxhY2Vob2xkZXIuaGlkZGVuID0gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgbmV3IHByb3Bvc2FsIGNhcmRzIGFuZCByZWZyZXNoIGV4aXN0aW5nIGNhcmQgc3RhdGUuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9jYXJkcygpIHtcblx0XHRcdHZhciBmcmFnbWVudDtcblxuXHRcdFx0aWYgKCAhIGVkaXRvciB8fCAhIGVkaXRvci5uZXdfbGlzdCB8fCAhIGVkaXRvci50ZW1wbGF0ZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZWRpdG9yLm5ld19saXN0LmlubmVySFRNTCA9ICcnO1xuXHRcdFx0ZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG5cdFx0XHRlZGl0b3IubmV3X3Jlc291cmNlcy5mb3JFYWNoKCBmdW5jdGlvbiAoIHJlc291cmNlLCByZXNvdXJjZV9pbmRleCApIHtcblx0XHRcdFx0dmFyIGNhcmQgPSBlZGl0b3IudGVtcGxhdGUuY29udGVudC5maXJzdEVsZW1lbnRDaGlsZC5jbG9uZU5vZGUoIHRydWUgKTtcblx0XHRcdFx0dmFyIHNlbGVjdGlvbiA9IGNhcmQucXVlcnlTZWxlY3RvciggJ2lucHV0W3R5cGU9XCJyYWRpb1wiXScgKTtcblx0XHRcdFx0dmFyIGltYWdlID0gY2FyZC5xdWVyeVNlbGVjdG9yKCAnaW1nJyApO1xuXHRcdFx0XHR2YXIgcGxhY2Vob2xkZXIgPSBjYXJkLnF1ZXJ5U2VsZWN0b3IoICcud3BiYy1iaS1pbWFnZS1maWxsJyApO1xuXHRcdFx0XHR2YXIgcmVtb3ZlX2J1dHRvbiA9IGNhcmQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtcmVtb3ZlLXJlc291cmNlXScgKTtcblxuXHRcdFx0XHRjYXJkLmNsYXNzTGlzdC50b2dnbGUoICdpcy1zZWxlY3RlZCcsICduZXcnID09PSBlZGl0b3Iuc2VsZWN0ZWRfdHlwZSAmJiByZXNvdXJjZV9pbmRleCA9PT0gZWRpdG9yLnNlbGVjdGVkX2luZGV4ICk7XG5cdFx0XHRcdHNlbGVjdGlvbi5jaGVja2VkID0gJ25ldycgPT09IGVkaXRvci5zZWxlY3RlZF90eXBlICYmIHJlc291cmNlX2luZGV4ID09PSBlZGl0b3Iuc2VsZWN0ZWRfaW5kZXg7XG5cdFx0XHRcdHNlbGVjdGlvbi5kYXRhc2V0LndwYmNSZXNvdXJjZVNlbGVjdGlvbiA9ICduZXc6JyArIFN0cmluZyggcmVzb3VyY2VfaW5kZXggKTtcblx0XHRcdFx0Y2FyZC5xdWVyeVNlbGVjdG9yKCAnc3Ryb25nJyApLnRleHRDb250ZW50ID0gcmVzb3VyY2UudGl0bGUgfHwgZ2V0X21lc3NhZ2UoICduZXdfcmVzb3VyY2UnLCAnTmV3IEJvb2tpbmcgUmVzb3VyY2UnICk7XG5cdFx0XHRcdGlmICggcmVzb3VyY2UucGljdHVyZV91cmwgKSB7XG5cdFx0XHRcdFx0aW1hZ2Uuc3JjID0gcmVzb3VyY2UucGljdHVyZV91cmw7XG5cdFx0XHRcdFx0aW1hZ2UuaGlkZGVuID0gZmFsc2U7XG5cdFx0XHRcdFx0cGxhY2Vob2xkZXIuaGlkZGVuID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZW1vdmVfYnV0dG9uLmRhdGFzZXQud3BiY1JlbW92ZVJlc291cmNlID0gU3RyaW5nKCByZXNvdXJjZV9pbmRleCApO1xuXHRcdFx0XHRyZW1vdmVfYnV0dG9uLnNldEF0dHJpYnV0ZSggJ2FyaWEtbGFiZWwnLCBmb3JtYXRfbWVzc2FnZSggZ2V0X21lc3NhZ2UoICdyZW1vdmVfcmVzb3VyY2UnLCAnUmVtb3ZlICVzJyApLCByZXNvdXJjZS50aXRsZSB8fCBnZXRfbWVzc2FnZSggJ25ld19yZXNvdXJjZScsICdOZXcgQm9va2luZyBSZXNvdXJjZScgKSApICk7XG5cdFx0XHRcdGZyYWdtZW50LmFwcGVuZENoaWxkKCBjYXJkICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRlZGl0b3IubmV3X2xpc3QuYXBwZW5kQ2hpbGQoIGZyYWdtZW50ICk7XG5cdFx0XHRyZW5kZXJfZXhpc3RpbmdfY2FyZHMoKTtcblx0XHRcdHN5bmNfdHJhbnNwb3J0KCk7XG5cdFx0XHRyZW5kZXJfZGV0YWlscygpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNlbGVjdCBhIFJlc291cmNlIGZyb20gYSBzdGFibGUgYHR5cGU6aW5kZXhgIGJyb3dzZXIgdmFsdWUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gc2VsZWN0aW9uX3ZhbHVlIEJyb3dzZXIgc2VsZWN0aW9uIHZhbHVlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2VsZWN0X3Jlc291cmNlKCBzZWxlY3Rpb25fdmFsdWUgKSB7XG5cdFx0XHR2YXIgc2VsZWN0aW9uX3BhcnRzID0gU3RyaW5nKCBzZWxlY3Rpb25fdmFsdWUgfHwgJycgKS5zcGxpdCggJzonICk7XG5cdFx0XHR2YXIgc2VsZWN0ZWRfdHlwZSA9IHNlbGVjdGlvbl9wYXJ0c1sgMCBdO1xuXHRcdFx0dmFyIHNlbGVjdGVkX2luZGV4ID0gcGFyc2VJbnQoIHNlbGVjdGlvbl9wYXJ0c1sgMSBdLCAxMCApO1xuXHRcdFx0dmFyIHNlbGVjdGVkX2NhcmQ7XG5cdFx0XHR2YXIgc2VsZWN0ZWRfY29udHJvbDtcblxuXHRcdFx0aWYgKCBbICduZXcnLCAnZXhpc3RpbmcnIF0uaW5kZXhPZiggc2VsZWN0ZWRfdHlwZSApIDwgMCB8fCBpc05hTiggc2VsZWN0ZWRfaW5kZXggKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0c2VsZWN0ZWRfY2FyZCA9ICdleGlzdGluZycgPT09IHNlbGVjdGVkX3R5cGVcblx0XHRcdFx0PyBlZGl0b3IuZXhpc3RpbmdfY2FyZHNbIHNlbGVjdGVkX2luZGV4IF1cblx0XHRcdFx0OiBlZGl0b3IubmV3X2xpc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtcmVzb3VyY2Utc2VsZWN0aW9uPVwibmV3OicgKyBTdHJpbmcoIHNlbGVjdGVkX2luZGV4ICkgKyAnXCJdJyApO1xuXHRcdFx0aWYgKCAhIHNlbGVjdGVkX2NhcmQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHN5bmNfc2VsZWN0ZWRfcmVzb3VyY2UoKTtcblx0XHRcdGVkaXRvci5zZWxlY3RlZF90eXBlID0gc2VsZWN0ZWRfdHlwZTtcblx0XHRcdGVkaXRvci5zZWxlY3RlZF9pbmRleCA9IHNlbGVjdGVkX2luZGV4O1xuXHRcdFx0cmVuZGVyX2NhcmRzKCk7XG5cdFx0XHRzZWxlY3RlZF9jb250cm9sID0gJ2V4aXN0aW5nJyA9PT0gc2VsZWN0ZWRfdHlwZVxuXHRcdFx0XHQ/IHNlbGVjdGVkX2NhcmQucXVlcnlTZWxlY3RvciggJ2lucHV0W3R5cGU9XCJyYWRpb1wiXScgKVxuXHRcdFx0XHQ6IGVkaXRvci5uZXdfbGlzdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1yZXNvdXJjZS1zZWxlY3Rpb249XCJuZXc6JyArIFN0cmluZyggc2VsZWN0ZWRfaW5kZXggKSArICdcIl0nICk7XG5cdFx0XHRpZiAoIHNlbGVjdGVkX2NvbnRyb2wgKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0c2VsZWN0ZWRfY29udHJvbC5mb2N1cyggeyBwcmV2ZW50U2Nyb2xsOiB0cnVlIH0gKTtcblx0XHRcdFx0fSBjYXRjaCAoIGZvY3VzX2Vycm9yICkge1xuXHRcdFx0XHRcdHNlbGVjdGVkX2NvbnRyb2wuZm9jdXMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEhhbmRsZSBkZWxlZ2F0ZWQgZWRpdG9yIGJ1dHRvbiBhY3Rpb25zLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtNb3VzZUV2ZW50fSBldmVudCBDbGljayBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9jbGljayggZXZlbnQgKSB7XG5cdFx0XHR2YXIgcmVtb3ZlX2J1dHRvbiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1yZW1vdmUtcmVzb3VyY2VdJyApO1xuXHRcdFx0dmFyIHJlbW92ZV9pbmRleDtcblx0XHRcdHZhciBmb2N1c190YXJnZXQ7XG5cblx0XHRcdGlmICggZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWFkZC1yZXNvdXJjZV0nICkgKSB7XG5cdFx0XHRcdGlmICggISBlZGl0b3IuY2FuX2NyZWF0ZSB8fCBlZGl0b3IubmV3X3Jlc291cmNlcy5sZW5ndGggPj0gZWRpdG9yLm1heF9yZXNvdXJjZXMgKSB7XG5cdFx0XHRcdFx0c2hlbGxfYXBpLnNldF9maWVsZF9lcnJvciggJ2Jvb2tpbmdfcmVzb3VyY2VzJywgZ2V0X21lc3NhZ2UoICdyZXNvdXJjZV9saW1pdCcsICdUaGUgQm9va2luZyBSZXNvdXJjZSBsaW1pdCBmb3IgdGhpcyBhY2NvdW50IGhhcyBiZWVuIHJlYWNoZWQuJyApICk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHN5bmNfc2VsZWN0ZWRfcmVzb3VyY2UoKTtcblx0XHRcdFx0ZWRpdG9yLm5ld19yZXNvdXJjZXMucHVzaCggY3JlYXRlX3Jlc291cmNlX2RyYWZ0KCkgKTtcblx0XHRcdFx0ZWRpdG9yLnNlbGVjdGVkX3R5cGUgPSAnbmV3Jztcblx0XHRcdFx0ZWRpdG9yLnNlbGVjdGVkX2luZGV4ID0gZWRpdG9yLm5ld19yZXNvdXJjZXMubGVuZ3RoIC0gMTtcblx0XHRcdFx0cmVuZGVyX2NhcmRzKCk7XG5cdFx0XHRcdHNoZWxsX2FwaS5jbGVhcl9maWVsZF9lcnJvciggJ2Jvb2tpbmdfcmVzb3VyY2VzJyApO1xuXHRcdFx0XHRnZXRfcmVzb3VyY2VfZmllbGQoICd0aXRsZScgKS5mb2N1cygpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICggcmVtb3ZlX2J1dHRvbiApIHtcblx0XHRcdFx0cmVtb3ZlX2luZGV4ID0gcGFyc2VJbnQoIHJlbW92ZV9idXR0b24uZGF0YXNldC53cGJjUmVtb3ZlUmVzb3VyY2UsIDEwICk7XG5cdFx0XHRcdGlmICggISBpc05hTiggcmVtb3ZlX2luZGV4ICkgJiYgZWRpdG9yLm5ld19yZXNvdXJjZXNbIHJlbW92ZV9pbmRleCBdICkge1xuXHRcdFx0XHRcdGVkaXRvci5uZXdfcmVzb3VyY2VzLnNwbGljZSggcmVtb3ZlX2luZGV4LCAxICk7XG5cdFx0XHRcdFx0aWYgKCBlZGl0b3IubmV3X3Jlc291cmNlcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHRlZGl0b3Iuc2VsZWN0ZWRfdHlwZSA9ICduZXcnO1xuXHRcdFx0XHRcdFx0ZWRpdG9yLnNlbGVjdGVkX2luZGV4ID0gTWF0aC5tYXgoIDAsIE1hdGgubWluKCBlZGl0b3Iuc2VsZWN0ZWRfaW5kZXgsIGVkaXRvci5uZXdfcmVzb3VyY2VzLmxlbmd0aCAtIDEgKSApO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoIGVkaXRvci5leGlzdGluZ19yZXNvdXJjZXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdFx0ZWRpdG9yLnNlbGVjdGVkX3R5cGUgPSAnZXhpc3RpbmcnO1xuXHRcdFx0XHRcdFx0ZWRpdG9yLnNlbGVjdGVkX2luZGV4ID0gMDtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0ZWRpdG9yLnNlbGVjdGVkX3R5cGUgPSBudWxsO1xuXHRcdFx0XHRcdFx0ZWRpdG9yLnNlbGVjdGVkX2luZGV4ID0gbnVsbDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmVuZGVyX2NhcmRzKCk7XG5cdFx0XHRcdFx0c2hlbGxfYXBpLnNldF9zdGF0dXMoIGdldF9tZXNzYWdlKCAncmVzb3VyY2VfcmVtb3ZlZCcsICdVbnNhdmVkIEJvb2tpbmcgUmVzb3VyY2UgcmVtb3ZlZCBmcm9tIHRoaXMgc2V0dXAuJyApICk7XG5cdFx0XHRcdFx0Zm9jdXNfdGFyZ2V0ID0gZWRpdG9yLm5ld19saXN0LnF1ZXJ5U2VsZWN0b3IoICdpbnB1dFt0eXBlPVwicmFkaW9cIl0nICkgfHwgKCBlZGl0b3IuZXhpc3RpbmdfbGlzdCA/IGVkaXRvci5leGlzdGluZ19saXN0LnF1ZXJ5U2VsZWN0b3IoICdpbnB1dFt0eXBlPVwicmFkaW9cIl0nICkgOiBudWxsICkgfHwgZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYWRkLXJlc291cmNlXScgKTtcblx0XHRcdFx0XHRpZiAoIGZvY3VzX3RhcmdldCApIHtcblx0XHRcdFx0XHRcdGZvY3VzX3RhcmdldC5mb2N1cygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICggZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXJlbW92ZS1yZXNvdXJjZS1waWN0dXJlXScgKSAmJiBlZGl0b3IubWVkaWFfdXBsb2FkX2F2YWlsYWJsZSApIHtcblx0XHRcdFx0dmFyIHBpY3R1cmVfZmllbGQgPSBnZXRfcmVzb3VyY2VfZmllbGQoICdwaWN0dXJlX3VybCcgKTtcblx0XHRcdFx0aWYgKCBwaWN0dXJlX2ZpZWxkICkge1xuXHRcdFx0XHRcdHBpY3R1cmVfZmllbGQudmFsdWUgPSAnJztcblx0XHRcdFx0XHRzeW5jX3NlbGVjdGVkX3Jlc291cmNlKCk7XG5cdFx0XHRcdFx0cmVuZGVyX2NhcmRzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBIYW5kbGUgc2VsZWN0aW9uIGFuZCBjb21taXR0ZWQgZmllbGQgY2hhbmdlcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50IENoYW5nZSBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9jaGFuZ2UoIGV2ZW50ICkge1xuXHRcdFx0aWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtcmVzb3VyY2Utc2VsZWN0aW9uXScgKSApIHtcblx0XHRcdFx0c2VsZWN0X3Jlc291cmNlKCBldmVudC50YXJnZXQuZGF0YXNldC53cGJjUmVzb3VyY2VTZWxlY3Rpb24gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtcmVzb3VyY2UtZmllbGRdJyApICkge1xuXHRcdFx0XHRzeW5jX3NlbGVjdGVkX3Jlc291cmNlKCk7XG5cdFx0XHRcdHJlbmRlcl9jYXJkcygpO1xuXHRcdFx0XHRzaGVsbF9hcGkuY2xlYXJfZmllbGRfZXJyb3IoICdib29raW5nX3Jlc291cmNlcycgKTtcblx0XHRcdFx0c2hlbGxfYXBpLmNsZWFyX2ZpZWxkX2Vycm9yKCAnZXhpc3RpbmdfYm9va2luZ19yZXNvdXJjZXMnICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSGFuZGxlIGxpdmUgdGV4dCBlZGl0aW5nIHdpdGhvdXQgcmVjb25zdHJ1Y3RpbmcgdGhlIGFjdGl2ZSBjb250cm9scy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SW5wdXRFdmVudH0gZXZlbnQgSW5wdXQgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfaW5wdXQoIGV2ZW50ICkge1xuXHRcdFx0dmFyIHJlc291cmNlO1xuXHRcdFx0dmFyIGNhcmQ7XG5cblx0XHRcdGlmICggISBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtcmVzb3VyY2UtZmllbGRdJyApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRzeW5jX3NlbGVjdGVkX3Jlc291cmNlKCk7XG5cdFx0XHRyZXNvdXJjZSA9IGdldF9zZWxlY3RlZF9yZXNvdXJjZSgpO1xuXHRcdFx0Y2FyZCA9ICdleGlzdGluZycgPT09IGVkaXRvci5zZWxlY3RlZF90eXBlID8gZWRpdG9yLmV4aXN0aW5nX2NhcmRzWyBlZGl0b3Iuc2VsZWN0ZWRfaW5kZXggXSA6IGVkaXRvci5uZXdfbGlzdC5jaGlsZHJlblsgZWRpdG9yLnNlbGVjdGVkX2luZGV4IF07XG5cdFx0XHRpZiAoIGNhcmQgJiYgcmVzb3VyY2UgKSB7XG5cdFx0XHRcdGNhcmQucXVlcnlTZWxlY3RvciggJ3N0cm9uZycgKS50ZXh0Q29udGVudCA9IHJlc291cmNlLnRpdGxlIHx8IGdldF9tZXNzYWdlKCAnbmV3X3Jlc291cmNlJywgJ05ldyBCb29raW5nIFJlc291cmNlJyApO1xuXHRcdFx0XHRpZiAoICdleGlzdGluZycgPT09IGVkaXRvci5zZWxlY3RlZF90eXBlICkge1xuXHRcdFx0XHRcdHJlbmRlcl9leGlzdGluZ19jYXJkX3N0YXR1cyggY2FyZCwgZWRpdG9yLnNlbGVjdGVkX2luZGV4ICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHNoZWxsX2FwaS5jbGVhcl9maWVsZF9lcnJvciggJ2Jvb2tpbmdfcmVzb3VyY2VzJyApO1xuXHRcdFx0c2hlbGxfYXBpLmNsZWFyX2ZpZWxkX2Vycm9yKCAnZXhpc3RpbmdfYm9va2luZ19yZXNvdXJjZXMnICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVmcmVzaCBhZnRlciB0aGUgc2hhcmVkIFdvcmRQcmVzcyBtZWRpYSBwaWNrZXIgc2V0cyB0aGUgVVJMIGZpZWxkLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfbWVkaWFfdXJsX3NldCgpIHtcblx0XHRcdHN5bmNfc2VsZWN0ZWRfcmVzb3VyY2UoKTtcblx0XHRcdHJlbmRlcl9jYXJkcygpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFBhcnNlIG9uZSBKU09OIGFycmF5IHRyYW5zcG9ydCB3aXRob3V0IHRydXN0aW5nIGl0cyBzaGFwZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBlbmNvZGVkX3ZhbHVlIEpTT04gdmFsdWUuXG5cdFx0ICogQHJldHVybiB7QXJyYXl9IERlY29kZWQgYXJyYXkgb3IgYW4gZW1wdHkgYXJyYXkuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcGFyc2VfYXJyYXkoIGVuY29kZWRfdmFsdWUgKSB7XG5cdFx0XHR2YXIgcGFyc2VkX3ZhbHVlO1xuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRwYXJzZWRfdmFsdWUgPSBKU09OLnBhcnNlKCBlbmNvZGVkX3ZhbHVlIHx8ICdbXScgKTtcblx0XHRcdH0gY2F0Y2ggKCBwYXJzZV9lcnJvciApIHtcblx0XHRcdFx0cGFyc2VkX3ZhbHVlID0gW107XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBBcnJheS5pc0FycmF5KCBwYXJzZWRfdmFsdWUgKSA/IHBhcnNlZF92YWx1ZSA6IFtdO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEluaXRpYWxpemUgdGhpcyBzdGVwIGZyb20gdGhlIHNoZWxsIGFuZCBkYXRhLW9ubHkgdHJhbnNwb3J0cy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZWdpc3RlcmVkX3NoZWxsX2FwaSBTaGFyZWQgd2l6YXJkIHNlcnZpY2VzLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaW5pdGlhbGl6ZSggcmVnaXN0ZXJlZF9zaGVsbF9hcGkgKSB7XG5cdFx0XHR2YXIgZWRpdG9yX25vZGU7XG5cdFx0XHR2YXIgbmV3X3RyYW5zcG9ydDtcblx0XHRcdHZhciB1cGRhdGVfdHJhbnNwb3J0O1xuXHRcdFx0dmFyIGV4aXN0aW5nX3NvdXJjZTtcblx0XHRcdHZhciBleGlzdGluZ19yZXNvdXJjZXM7XG5cblx0XHRcdHNoZWxsX2FwaSA9IHJlZ2lzdGVyZWRfc2hlbGxfYXBpO1xuXHRcdFx0cm9vdCA9IHNoZWxsX2FwaS5yb290O1xuXHRcdFx0ZWRpdG9yX25vZGUgPSByb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2VzLWVkaXRvcl0nICk7XG5cdFx0XHRuZXdfdHJhbnNwb3J0ID0gcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWRyYWZ0c10nICk7XG5cdFx0XHR1cGRhdGVfdHJhbnNwb3J0ID0gcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1leGlzdGluZy1yZXNvdXJjZS11cGRhdGVzXScgKTtcblx0XHRcdGV4aXN0aW5nX3NvdXJjZSA9IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZXhpc3RpbmctcmVzb3VyY2Utc291cmNlXScgKTtcblx0XHRcdGlmICggISBlZGl0b3Jfbm9kZSB8fCAhIG5ld190cmFuc3BvcnQgfHwgISB1cGRhdGVfdHJhbnNwb3J0IHx8ICEgZXhpc3Rpbmdfc291cmNlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGV4aXN0aW5nX3Jlc291cmNlcyA9IHBhcnNlX2FycmF5KCBleGlzdGluZ19zb3VyY2UudmFsdWUgKTtcblx0XHRcdGVkaXRvciA9IHtcblx0XHRcdFx0bm9kZTogZWRpdG9yX25vZGUsXG5cdFx0XHRcdG5ld190cmFuc3BvcnQ6IG5ld190cmFuc3BvcnQsXG5cdFx0XHRcdHVwZGF0ZV90cmFuc3BvcnQ6IHVwZGF0ZV90cmFuc3BvcnQsXG5cdFx0XHRcdG5ld19saXN0OiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1uZXctcmVzb3VyY2UtbGlzdF0nICksXG5cdFx0XHRcdGV4aXN0aW5nX2xpc3Q6IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWV4aXN0aW5nLXJlc291cmNlLWxpc3RdJyApLFxuXHRcdFx0XHRleGlzdGluZ19jYXJkczogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLWV4aXN0aW5nLXJlc291cmNlLWNhcmRdJyApICksXG5cdFx0XHRcdHRlbXBsYXRlOiByb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXJlc291cmNlLWNhcmQtdGVtcGxhdGVdJyApLFxuXHRcdFx0XHRuZXdfcmVzb3VyY2VzOiBwYXJzZV9hcnJheSggbmV3X3RyYW5zcG9ydC52YWx1ZSApLFxuXHRcdFx0XHRleGlzdGluZ19yZXNvdXJjZXM6IGV4aXN0aW5nX3Jlc291cmNlcy5tYXAoIGNsb25lX3Jlc291cmNlICksXG5cdFx0XHRcdGV4aXN0aW5nX2Jhc2VsaW5lczogZXhpc3RpbmdfcmVzb3VyY2VzLm1hcCggY2xvbmVfcmVzb3VyY2UgKSxcblx0XHRcdFx0c2VsZWN0ZWRfdHlwZTogbnVsbCxcblx0XHRcdFx0c2VsZWN0ZWRfaW5kZXg6IG51bGwsXG5cdFx0XHRcdGNhbl9jcmVhdGU6ICd0cnVlJyA9PT0gZWRpdG9yX25vZGUuZGF0YXNldC5jYW5DcmVhdGUsXG5cdFx0XHRcdHByaWNpbmdfYXZhaWxhYmxlOiAndHJ1ZScgPT09IGVkaXRvcl9ub2RlLmRhdGFzZXQucHJpY2luZ0F2YWlsYWJsZSxcblx0XHRcdFx0bWVkaWFfdXBsb2FkX2F2YWlsYWJsZTogJ3RydWUnID09PSBlZGl0b3Jfbm9kZS5kYXRhc2V0Lm1lZGlhVXBsb2FkQXZhaWxhYmxlLFxuXHRcdFx0XHRtYXhfcmVzb3VyY2VzOiBwYXJzZUludCggbmV3X3RyYW5zcG9ydC5kYXRhc2V0Lm1heFJlc291cmNlRHJhZnRzIHx8ICcwJywgMTAgKVxuXHRcdFx0fTtcblx0XHRcdGlmICggZWRpdG9yLm5ld19yZXNvdXJjZXMubGVuZ3RoICkge1xuXHRcdFx0XHRlZGl0b3Iuc2VsZWN0ZWRfdHlwZSA9ICduZXcnO1xuXHRcdFx0XHRlZGl0b3Iuc2VsZWN0ZWRfaW5kZXggPSAwO1xuXHRcdFx0fSBlbHNlIGlmICggZWRpdG9yLmV4aXN0aW5nX3Jlc291cmNlcy5sZW5ndGggKSB7XG5cdFx0XHRcdGVkaXRvci5zZWxlY3RlZF90eXBlID0gJ2V4aXN0aW5nJztcblx0XHRcdFx0ZWRpdG9yLnNlbGVjdGVkX2luZGV4ID0gMDtcblx0XHRcdH1cblx0XHRcdGVkaXRvci5ub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGhhbmRsZV9jbGljayApO1xuXHRcdFx0ZWRpdG9yLm5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIGhhbmRsZV9jaGFuZ2UgKTtcblx0XHRcdGVkaXRvci5ub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIGhhbmRsZV9pbnB1dCApO1xuXHRcdFx0JCggZG9jdW1lbnQgKVxuXHRcdFx0XHQub2ZmKCAnd3BiY19tZWRpYV91cGxvYWRfdXJsX3NldC53cGJjU2V0dXBXaXphcmRSZXNvdXJjZXMnLCAnI3dwYmMtc2V0dXAtd2l6YXJkLXJlc291cmNlLXBpY3R1cmUtdXJsJyApXG5cdFx0XHRcdC5vbiggJ3dwYmNfbWVkaWFfdXBsb2FkX3VybF9zZXQud3BiY1NldHVwV2l6YXJkUmVzb3VyY2VzJywgJyN3cGJjLXNldHVwLXdpemFyZC1yZXNvdXJjZS1waWN0dXJlLXVybCcsIGhhbmRsZV9tZWRpYV91cmxfc2V0ICk7XG5cdFx0XHRyZW5kZXJfY2FyZHMoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBWYWxpZGF0ZSBuZXcgZHJhZnRzIGFuZCBjaGFuZ2VkIGV4aXN0aW5nIFJlc291cmNlcyBiZWZvcmUgbmF2aWdhdGlvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge0hUTUxFbGVtZW50fG51bGx9IEZpcnN0IGludmFsaWQgY29udHJvbCBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHZhbGlkYXRlKCkge1xuXHRcdFx0dmFyIGZpcnN0X2ludmFsaWQgPSBudWxsO1xuXG5cdFx0XHRzeW5jX3NlbGVjdGVkX3Jlc291cmNlKCk7XG5cdFx0XHRbXG5cdFx0XHRcdHsgdHlwZTogJ25ldycsIHJlc291cmNlczogZWRpdG9yLm5ld19yZXNvdXJjZXMsIGZpZWxkX2lkOiAnYm9va2luZ19yZXNvdXJjZXMnIH0sXG5cdFx0XHRcdHsgdHlwZTogJ2V4aXN0aW5nJywgcmVzb3VyY2VzOiBlZGl0b3IuZXhpc3RpbmdfcmVzb3VyY2VzLCBmaWVsZF9pZDogJ2V4aXN0aW5nX2Jvb2tpbmdfcmVzb3VyY2VzJyB9XG5cdFx0XHRdLnNvbWUoIGZ1bmN0aW9uICggY29sbGVjdGlvbiApIHtcblx0XHRcdFx0cmV0dXJuIGNvbGxlY3Rpb24ucmVzb3VyY2VzLnNvbWUoIGZ1bmN0aW9uICggcmVzb3VyY2UsIHJlc291cmNlX2luZGV4ICkge1xuXHRcdFx0XHRcdHZhciBiYXNlbGluZSA9ICdleGlzdGluZycgPT09IGNvbGxlY3Rpb24udHlwZSA/IGVkaXRvci5leGlzdGluZ19iYXNlbGluZXNbIHJlc291cmNlX2luZGV4IF0gOiBudWxsO1xuXHRcdFx0XHRcdHZhciBwcmljZSA9IE51bWJlciggcmVzb3VyY2UuYmFzZV9jb3N0ICk7XG5cdFx0XHRcdFx0dmFyIHRpdGxlX21pc3NpbmcgPSAhIFN0cmluZyggcmVzb3VyY2UudGl0bGUgfHwgJycgKS50cmltKCk7XG5cblx0XHRcdFx0XHRpZiAoIGJhc2VsaW5lICYmICEgcmVzb3VyY2VfaXNfZGlydHkoIHJlc291cmNlLCBiYXNlbGluZSApICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoICEgdGl0bGVfbWlzc2luZyAmJiAoICEgZWRpdG9yLnByaWNpbmdfYXZhaWxhYmxlIHx8ICggaXNGaW5pdGUoIHByaWNlICkgJiYgcHJpY2UgPj0gMCApICkgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVkaXRvci5zZWxlY3RlZF90eXBlID0gY29sbGVjdGlvbi50eXBlO1xuXHRcdFx0XHRcdGVkaXRvci5zZWxlY3RlZF9pbmRleCA9IHJlc291cmNlX2luZGV4O1xuXHRcdFx0XHRcdHJlbmRlcl9jYXJkcygpO1xuXHRcdFx0XHRcdGZpcnN0X2ludmFsaWQgPSBnZXRfcmVzb3VyY2VfZmllbGQoIHRpdGxlX21pc3NpbmcgPyAndGl0bGUnIDogJ2Jhc2VfY29zdCcgKTtcblx0XHRcdFx0XHRzaGVsbF9hcGkuc2V0X2ZpZWxkX2Vycm9yKCBjb2xsZWN0aW9uLmZpZWxkX2lkLCB0aXRsZV9taXNzaW5nID8gZ2V0X21lc3NhZ2UoICdyZXNvdXJjZV90aXRsZV9yZXF1aXJlZCcsICdFbnRlciBhIG5hbWUgZm9yIGV2ZXJ5IEJvb2tpbmcgUmVzb3VyY2UuJyApIDogZ2V0X21lc3NhZ2UoICdyZXNvdXJjZV9wcmljZV9pbnZhbGlkJywgJ0VudGVyIGEgdmFsaWQgbm9uLW5lZ2F0aXZlIGJhc2UgY29zdC4nICkgKTtcblxuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiBmaXJzdF9pbnZhbGlkO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRpbml0aWFsaXplOiBpbml0aWFsaXplLFxuXHRcdFx0c3luYzogc3luY19zZWxlY3RlZF9yZXNvdXJjZSxcblx0XHRcdHZhbGlkYXRlOiB2YWxpZGF0ZVxuXHRcdH07XG5cdH1cblxuXHR3aW5kb3cud3BiY19zZXR1cF9lZGl0b3JfbW9kdWxlcyA9IHdpbmRvdy53cGJjX3NldHVwX2VkaXRvcl9tb2R1bGVzIHx8IHt9O1xuXHR3aW5kb3cud3BiY19zZXR1cF9lZGl0b3JfbW9kdWxlcy5ib29raW5nX3Jlc291cmNlcyA9IHsgY3JlYXRlOiBjcmVhdGVfYm9va2luZ19yZXNvdXJjZXNfYWRhcHRlciB9O1xuXHRpZiAoIHdpbmRvdy53cGJjX3NldHVwX3dpemFyZF9hcGkgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX3NldHVwX3dpemFyZF9hcGkucmVnaXN0ZXJfc3RlcF9hZGFwdGVyICkge1xuXHRcdHdpbmRvdy53cGJjX3NldHVwX3dpemFyZF9hcGkucmVnaXN0ZXJfc3RlcF9hZGFwdGVyKCBjcmVhdGVfYm9va2luZ19yZXNvdXJjZXNfYWRhcHRlciggbW9kdWxlX2NvbmZpZyApICk7XG5cdH1cbn0oIGpRdWVyeSwgd2luZG93LCBkb2N1bWVudCApICk7XG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0UsV0FBV0EsQ0FBQyxFQUFFQyxNQUFNLEVBQUVDLFFBQVEsRUFBRztFQUNsQyxZQUFZOztFQUVaLElBQUlDLGFBQWEsR0FBR0YsTUFBTSxDQUFDRyxtQ0FBbUMsSUFBSTtJQUFFQyxJQUFJLEVBQUUsQ0FB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
