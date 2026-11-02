"use strict";

/**
 * Timeline per-Resource action menus and settings inspector adapter.
 *
 * The Resource domain owns requests, DTO interpretation, and templates. Shared
 * dropdown and inspector components exclusively own menu/dialog lifecycle,
 * keyboard operation, outside-click behavior, and focus restoration.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
(function (window, document, wp) {
  'use strict';

  var module_id = 'resource_settings';
  var inspector_instance_id = 'wpbc_timeline_resource_settings';
  var inherit_mode = 'inherit';
  var custom_mode = 'custom';

  /**
   * Replace named placeholders in one translated plain-text label.
   *
   * @param {string} text   Translated source text.
   * @param {Object} values Plain replacement values keyed without braces.
   * @return {string} Interpolated plain text.
   */
  function interpolate(text, values) {
    Object.keys(values || {}).forEach(function (key) {
      text = String(text || '').replace(new RegExp('\\{' + key + '\\}', 'g'), String(values[key]));
    });
    return String(text || '');
  }

  /**
   * Extract one safe server error message from a jQuery AJAX result.
   *
   * @param {Object} response Optional JSON response.
   * @param {Object} request  Optional failed XMLHttpRequest.
   * @param {string} fallback Safe translated fallback.
   * @return {string} User-facing plain text.
   */
  function get_error_message(response, request, fallback) {
    if (response && response.data && response.data.message) {
      return String(response.data.message);
    }
    if (request && request.responseJSON && request.responseJSON.data && request.responseJSON.data.message) {
      return String(request.responseJSON.data.message);
    }
    return String(fallback || '');
  }

  /**
   * Normalize an exact positive Resource identifier.
   *
   * @param {*} candidate Candidate identifier.
   * @return {number} Positive integer or zero.
   */
  function positive_resource_id(candidate) {
    candidate = Number(candidate);
    return Number.isInteger(candidate) && 0 < candidate ? candidate : 0;
  }

  /**
   * Create the focused Resource-settings browser adapter.
   *
   * @param {Object}  context          Page-controller construction context.
   * @param {Element} context.mount    Timeline mount.
   * @param {Object}  context.settings Server-localized settings.
   * @param {Function} context.announce Accessible announcement callback.
   * @param {Function} context.refresh_after_mutation Canonical Timeline refresh callback.
   * @return {Object|null} Lifecycle and row-refresh API.
   */
  function create_resource_settings(context) {
    var mount = context && context.mount ? context.mount : null;
    var settings = context && context.settings ? context.settings : {};
    var configuration = settings.resource_settings || {};
    var templates = configuration.templates || {};
    var i18n = configuration.i18n || {};
    var transport_root = settings.transport && 'object' === typeof settings.transport ? settings.transport : {};
    var transport = transport_root.resource_settings && 'object' === typeof transport_root.resource_settings ? transport_root.resource_settings : {};
    var transport_url = transport_root.url ? String(transport_root.url) : '';
    var announce = context && 'function' === typeof context.announce ? context.announce : function () {};
    var refresh_after_mutation = context && 'function' === typeof context.refresh_after_mutation ? context.refresh_after_mutation : function () {};
    var shared_templates = settings.shared_ui && settings.shared_ui.templates ? settings.shared_ui.templates : {};
    var inspector_host = null;
    var inspector_root = null;
    var inspector = null;
    var active_resource_id = 0;
    var active_resource_title = '';
    var clean_draft = '';
    var read_request = null;
    var mutation_request = null;
    var request_generation = 0;
    var is_dirty = false;
    var is_busy = false;
    var is_initialized = false;

    /**
     * Return one fixed server-allow-listed WordPress template renderer.
     *
     * @param {string} template_id Allow-listed template identifier.
     * @return {Function|null} Template renderer or null.
     */
    function get_template_by_id(template_id) {
      return template_id && wp && 'function' === typeof wp.template ? wp.template(template_id) : null;
    }

    /**
     * Return one Resource-settings domain template.
     *
     * @param {string} template_key Domain template key.
     * @return {Function|null} Template renderer or null.
     */
    function get_domain_template(template_key) {
      return get_template_by_id(templates[template_key]);
    }

    /**
     * Reset shared-menu selection so its single action remains repeatable.
     *
     * @param {HTMLElement} dropdown Shared dropdown root.
     * @return {void}
     */
    function reset_action_menu(dropdown) {
      if (!dropdown) {
        return;
      }
      dropdown.setAttribute('data-wpbc-shared-ui-dropdown-value', '');
      Array.prototype.forEach.call(dropdown.querySelectorAll('[data-wpbc-shared-ui-dropdown-option]'), function (option) {
        option.setAttribute('aria-selected', 'false');
        option.classList.remove('is-selected');
      });
    }

    /**
     * Render one domain-owned row-actions host and shared dropdown menu.
     *
     * @param {HTMLElement} host     Timeline Resource-row integration host.
     * @param {Object}      resource Authorized Resource summary already in the window DTO.
     * @return {void}
     */
    function render_row_actions(host, resource) {
      var row_actions_template = get_domain_template('row_actions');
      var dropdown_template = get_template_by_id(shared_templates.dropdown);
      var menu_host;
      var resource_id = positive_resource_id(resource && resource.id);
      if (!host || !resource_id || !row_actions_template || !dropdown_template) {
        return;
      }
      host.innerHTML = row_actions_template({
        resource_id: resource_id
      });
      menu_host = host.querySelector('[data-wpbc-timeline-resource-settings-menu-host]');
      if (!menu_host) {
        return;
      }
      menu_host.innerHTML = dropdown_template({
        id: 'wpbc_timeline_resource_actions_' + resource_id,
        class_name: 'wpbc_timeline_resource_settings__menu',
        label: interpolate(i18n.row_actions, {
          title: resource.title || ''
        }),
        selected_value: '',
        selected_label: '',
        icon_class: 'wpbc-bi-three-dots-vertical',
        options: [{
          type: 'option',
          value: 'timeline_settings',
          label: i18n.timeline_settings,
          icon_class: 'wpbc-bi-sliders'
        }]
      });
    }

    /**
     * Return a normalized editable draft from the current form.
     *
     * @return {Object} Mode and template draft.
     */
    function get_form_draft() {
      var form = inspector_root ? inspector_root.querySelector('[data-wpbc-timeline-resource-settings-form]') : null;
      var selected_mode = form ? form.querySelector('input[name="wpbc_timeline_resource_title_mode"]:checked') : null;
      var template_input = form ? form.querySelector('[data-wpbc-timeline-resource-settings-template]') : null;
      return {
        mode: selected_mode && custom_mode === selected_mode.value ? custom_mode : inherit_mode,
        template: template_input ? template_input.value : ''
      };
    }

    /**
     * Update the browser dirty flag from the canonical form draft.
     *
     * @return {void}
     */
    function update_dirty_state() {
      is_dirty = Boolean(clean_draft) && JSON.stringify(get_form_draft()) !== clean_draft;
    }

    /**
     * Enable custom-template controls only for explicit custom mode.
     *
     * @return {void}
     */
    function synchronize_custom_controls() {
      var form = inspector_root ? inspector_root.querySelector('[data-wpbc-timeline-resource-settings-form]') : null;
      var custom_fields = form ? form.querySelector('[data-wpbc-timeline-resource-custom-fields]') : null;
      var custom_controls = custom_fields ? custom_fields.querySelectorAll('input, button') : [];
      var is_custom = custom_mode === get_form_draft().mode;
      if (custom_fields) {
        custom_fields.classList.toggle('is-disabled', !is_custom);
      }
      Array.prototype.forEach.call(custom_controls, function (control) {
        control.disabled = !is_custom || is_busy;
      });
    }

    /**
     * Lock or unlock every settings control during a state-changing request.
     *
     * @param {boolean} should_lock Whether mutation controls must be locked.
     * @return {void}
     */
    function set_busy(should_lock) {
      var controls = inspector_root ? inspector_root.querySelectorAll('[data-wpbc-timeline-resource-settings-form] button, [data-wpbc-timeline-resource-settings-form] input') : [];
      is_busy = Boolean(should_lock);
      Array.prototype.forEach.call(controls, function (control) {
        control.disabled = is_busy;
      });
      synchronize_custom_controls();
    }

    /**
     * Render one authorized Resource-settings DTO inside the shared shell.
     *
     * @param {Object} dto          Exact server Resource-settings DTO.
     * @param {string} announcement Accessible status announcement.
     * @return {boolean} True when rendered successfully.
     */
    function render_settings(dto, announcement) {
      var header_template = get_domain_template('header');
      var inspector_template = get_domain_template('inspector');
      var title;
      var tokens;
      if (!inspector || !header_template || !inspector_template || !dto || !dto.resource || !dto.booking_title) {
        return false;
      }
      title = interpolate(i18n.inspector_title, {
        title: dto.resource.title || active_resource_title
      });
      tokens = (configuration.tokens || []).map(function (token) {
        return {
          value: String(token),
          label: interpolate(i18n.insert_token_label, {
            token: token
          })
        };
      });
      inspector.set_header(header_template({
        title: title
      }), title);
      inspector.set_content(inspector_template({
        booking_title: dto.booking_title,
        maximum_length: Number(configuration.maximum_length) || 200,
        tokens: tokens,
        i18n: i18n
      }), announcement || '');
      clean_draft = JSON.stringify(get_form_draft());
      is_dirty = false;
      set_busy(false);
      return true;
    }

    /**
     * Abort only non-mutating reads and invalidate pending callbacks.
     *
     * @return {void}
     */
    function abort_read() {
      request_generation += 1;
      if (read_request && 'function' === typeof read_request.abort) {
        read_request.abort();
      }
      read_request = null;
    }

    /**
     * Restore focus to the same Resource action after canonical row replacement.
     *
     * Focus is restored only when row replacement left focus on the document body
     * or on the original trigger. Deliberate focus movement is never overridden.
     *
     * @param {number}      resource_id  Authorized Resource identifier.
     * @param {HTMLElement} old_trigger  Trigger focused before canonical refresh.
     * @return {void}
     */
    function restore_resource_action_focus(resource_id, old_trigger) {
      var active_element = document.activeElement;
      var action_root;
      var trigger;
      if (!is_initialized || active_element && document.body !== active_element && old_trigger !== active_element) {
        return;
      }
      action_root = mount.querySelector('[data-wpbc-timeline-resource-settings-actions="' + resource_id + '"]');
      trigger = action_root ? action_root.querySelector('[data-wpbc-shared-ui-dropdown-trigger]') : null;
      if (!trigger || 'function' !== typeof trigger.focus) {
        return;
      }
      try {
        trigger.focus({
          preventScroll: true
        });
      } catch (error) {
        trigger.focus();
      }
    }

    /**
     * Read and open one exact authorized Resource settings record.
     *
     * @param {number}      resource_id    Authorized Resource ID from the current window DTO.
     * @param {string}      resource_title Authorized Resource title from the current window DTO.
     * @param {HTMLElement} trigger        Shared dropdown trigger used for focus restoration.
     * @return {void}
     */
    function open_settings(resource_id, resource_title, trigger) {
      var generation;
      if (!inspector || !window.jQuery || !transport_url || !transport.read_action || !transport.read_nonce) {
        announce(i18n.load_error);
        return;
      }
      abort_read();
      active_resource_id = resource_id;
      active_resource_title = String(resource_title || '');
      clean_draft = '';
      is_dirty = false;
      inspector.reset_header(interpolate(i18n.inspector_title, {
        title: active_resource_title
      }));
      inspector.open(trigger);
      inspector.set_loading(i18n.loading);
      generation = request_generation;
      read_request = window.jQuery.ajax({
        url: transport_url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: transport.read_action,
          nonce: transport.read_nonce,
          resource_id: resource_id
        }
      });
      read_request.done(function (response) {
        if (generation !== request_generation || resource_id !== active_resource_id || !inspector.is_open()) {
          return;
        }
        if (!response || !response.success || !render_settings(response.data, i18n.loaded)) {
          inspector.set_error(get_error_message(response, null, i18n.load_error));
        }
      });
      read_request.fail(function (request, request_status) {
        if ('abort' !== request_status && generation === request_generation && resource_id === active_resource_id && inspector.is_open()) {
          inspector.set_error(get_error_message(null, request, i18n.load_error));
        }
      });
      read_request.always(function () {
        if (generation === request_generation) {
          read_request = null;
        }
      });
    }

    /**
     * Persist or reset the current Resource preference through its fixed endpoint.
     *
     * @param {string} operation `save` or `reset`.
     * @return {void}
     */
    function mutate_settings(operation) {
      var is_reset = 'reset' === operation;
      var draft = get_form_draft();
      var action = is_reset ? transport.reset_action : transport.save_action;
      var generation = request_generation;
      var request_data;
      var resource_id;
      var restored_trigger;
      var refresh_request;
      if (is_busy || !active_resource_id) {
        return;
      }
      if (!window.jQuery || !transport_url || !action || !transport.write_nonce) {
        announce(i18n.save_error);
        return;
      }
      set_busy(true);
      announce(is_reset ? i18n.resetting : i18n.saving);
      request_data = {
        action: action,
        nonce: transport.write_nonce,
        resource_id: active_resource_id
      };
      if (!is_reset) {
        request_data.mode = draft.mode;
        request_data.template = draft.template;
      }
      mutation_request = window.jQuery.ajax({
        url: transport_url,
        method: 'POST',
        dataType: 'json',
        data: request_data
      });
      mutation_request.done(function (response) {
        if (generation !== request_generation || !inspector || !inspector.is_open()) {
          return;
        }
        if (response && response.success && render_settings(response.data, is_reset ? i18n.reset_complete : i18n.saved)) {
          resource_id = active_resource_id;
          announce(is_reset ? i18n.reset_complete : i18n.saved);
          inspector.close(true);
          restored_trigger = document.activeElement;
          refresh_request = refresh_after_mutation();
          if (refresh_request && 'function' === typeof refresh_request.done) {
            refresh_request.done(function () {
              window.requestAnimationFrame(function () {
                restore_resource_action_focus(resource_id, restored_trigger);
              });
            });
          }
          return;
        }
        set_busy(false);
        announce(get_error_message(response, null, i18n.save_error));
      });
      mutation_request.fail(function (request) {
        if (generation === request_generation && inspector && inspector.is_open()) {
          set_busy(false);
          announce(get_error_message(null, request, i18n.save_error));
        }
      });
      mutation_request.always(function () {
        mutation_request = null;
      });
    }

    /**
     * Handle domain actions without taking over shared menu/dialog lifecycle.
     *
     * @param {Event} event Timeline delegated event.
     * @return {void}
     */
    function handle_event(event) {
      var dropdown;
      var row_actions;
      var resource_id;
      var resource_row;
      var trigger;
      var form;
      var token_button;
      var template_input;
      if ('wpbc:shared-ui-dropdown-change' === event.type) {
        dropdown = event.target.closest('[data-wpbc-shared-ui-dropdown]');
        row_actions = dropdown ? dropdown.closest('[data-wpbc-timeline-resource-settings-actions]') : null;
        if (!row_actions || !event.detail || 'timeline_settings' !== event.detail.value) {
          return;
        }
        resource_id = positive_resource_id(row_actions.getAttribute('data-wpbc-timeline-resource-settings-actions'));
        resource_row = row_actions.closest('[data-wpbc-timeline-row-side="resource"]');
        trigger = dropdown.querySelector('[data-wpbc-shared-ui-dropdown-trigger]');
        reset_action_menu(dropdown);
        open_settings(resource_id, resource_row ? resource_row.getAttribute('data-wpbc-timeline-resource-title') : '', trigger);
        return;
      }
      form = event.target.closest('[data-wpbc-timeline-resource-settings-form]');
      if (!form) {
        return;
      }
      if ('submit' === event.type) {
        event.preventDefault();
        mutate_settings('save');
        return;
      }
      if ('click' === event.type && event.target.closest('[data-wpbc-timeline-resource-settings-reset]')) {
        event.preventDefault();
        mutate_settings('reset');
        return;
      }
      token_button = 'click' === event.type ? event.target.closest('[data-wpbc-timeline-resource-settings-token]') : null;
      if (token_button) {
        template_input = form.querySelector('[data-wpbc-timeline-resource-settings-template]');
        if (template_input && !template_input.disabled) {
          template_input.setRangeText(token_button.getAttribute('data-wpbc-timeline-resource-settings-token') || '', template_input.selectionStart, template_input.selectionEnd, 'end');
          template_input.focus();
          update_dirty_state();
        }
        return;
      }
      if ('change' === event.type || 'input' === event.type) {
        synchronize_custom_controls();
        update_dirty_state();
      }
    }

    /**
     * Mount the shared inspector shell and delegated domain event handlers.
     *
     * @return {void}
     */
    function initialize() {
      var shell_template = get_template_by_id(shared_templates.inspector);
      if (is_initialized || !mount || !shell_template || !window.wpbc_shared_ui_inspector || 'function' !== typeof window.wpbc_shared_ui_inspector.create) {
        return;
      }
      inspector_host = mount.querySelector('[data-wpbc-timeline-resource-settings-inspector-host]');
      if (!inspector_host) {
        return;
      }
      inspector_host.innerHTML = shell_template({
        id: inspector_instance_id,
        title: i18n.timeline_settings,
        close_label: i18n.close,
        loading_label: i18n.loading
      });
      inspector_root = inspector_host.querySelector('[data-wpbc-shared-ui-inspector]');
      inspector = window.wpbc_shared_ui_inspector.create(inspector_root, {
        owner_id: inspector_instance_id,
        interaction_group: 'wpbc_timeline_resource_settings',
        on_before_close: function () {
          if (is_busy) {
            return false;
          }
          return !is_dirty || window.confirm(i18n.discard_changes || '');
        },
        on_close: function () {
          abort_read();
          active_resource_id = 0;
          active_resource_title = '';
          clean_draft = '';
          is_dirty = false;
        }
      });
      if (!inspector) {
        return;
      }
      mount.addEventListener('wpbc:shared-ui-dropdown-change', handle_event);
      inspector_root.addEventListener('submit', handle_event);
      inspector_root.addEventListener('click', handle_event);
      inspector_root.addEventListener('change', handle_event);
      inspector_root.addEventListener('input', handle_event);
      is_initialized = true;
    }

    /**
     * Render action menus for every currently visible authorized Resource row.
     *
     * @param {Array<Object>} resources Current Timeline Resource summaries.
     * @return {void}
     */
    function refresh(resources) {
      var resources_by_id = Object.create(null);
      (Array.isArray(resources) ? resources : []).forEach(function (resource) {
        var resource_id = positive_resource_id(resource && resource.id);
        if (resource_id) {
          resources_by_id[resource_id] = resource;
        }
      });
      Array.prototype.forEach.call(mount.querySelectorAll('[data-wpbc-timeline-resource-actions-host]'), function (host) {
        var resource_id = positive_resource_id(host.getAttribute('data-wpbc-timeline-resource-actions-host'));
        if (resources_by_id[resource_id]) {
          render_row_actions(host, resources_by_id[resource_id]);
        }
      });
    }

    /**
     * Release requests, listeners, and shared shell state.
     *
     * @return {void}
     */
    function destroy() {
      if (!is_initialized) {
        return;
      }
      abort_read();
      is_busy = false;
      is_dirty = false;
      if (inspector && inspector.is_open()) {
        inspector.close(false);
      }
      mount.removeEventListener('wpbc:shared-ui-dropdown-change', handle_event);
      inspector_root.removeEventListener('submit', handle_event);
      inspector_root.removeEventListener('click', handle_event);
      inspector_root.removeEventListener('change', handle_event);
      inspector_root.removeEventListener('input', handle_event);
      if (mutation_request && 'function' === typeof mutation_request.abort) {
        mutation_request.abort();
      }
      mutation_request = null;
      inspector_host.textContent = '';
      inspector = null;
      inspector_root = null;
      is_initialized = false;
    }
    return {
      initialize: initialize,
      refresh: refresh,
      destroy: destroy
    };
  }
  if (window.wpbc_timeline_modules && 'function' === typeof window.wpbc_timeline_modules.register_factory) {
    window.wpbc_timeline_modules.register_factory(module_id, create_resource_settings);
  }
})(window, document, window.wp);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS10aW1lbGluZS9yZXNvdXJjZS1wcmVmZXJlbmNlcy9fb3V0L3RpbWVsaW5lLXJlc291cmNlLXNldHRpbmdzLmpzIiwibmFtZXMiOlsid2luZG93IiwiZG9jdW1lbnQiLCJ3cCIsIm1vZHVsZV9pZCIsImluc3BlY3Rvcl9pbnN0YW5jZV9pZCIsImluaGVyaXRfbW9kZSIsImN1c3RvbV9tb2RlIiwiaW50ZXJwb2xhdGUiLCJ0ZXh0IiwidmFsdWVzIiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJrZXkiLCJTdHJpbmciLCJyZXBsYWNlIiwiUmVnRXhwIiwiZ2V0X2Vycm9yX21lc3NhZ2UiLCJyZXNwb25zZSIsInJlcXVlc3QiLCJmYWxsYmFjayIsImRhdGEiLCJtZXNzYWdlIiwicmVzcG9uc2VKU09OIiwicG9zaXRpdmVfcmVzb3VyY2VfaWQiLCJjYW5kaWRhdGUiLCJOdW1iZXIiLCJpc0ludGVnZXIiLCJjcmVhdGVfcmVzb3VyY2Vfc2V0dGluZ3MiLCJjb250ZXh0IiwibW91bnQiLCJzZXR0aW5ncyIsImNvbmZpZ3VyYXRpb24iLCJyZXNvdXJjZV9zZXR0aW5ncyIsInRlbXBsYXRlcyIsImkxOG4iLCJ0cmFuc3BvcnRfcm9vdCIsInRyYW5zcG9ydCIsInRyYW5zcG9ydF91cmwiLCJ1cmwiLCJhbm5vdW5jZSIsInJlZnJlc2hfYWZ0ZXJfbXV0YXRpb24iLCJzaGFyZWRfdGVtcGxhdGVzIiwic2hhcmVkX3VpIiwiaW5zcGVjdG9yX2hvc3QiLCJpbnNwZWN0b3Jfcm9vdCIsImluc3BlY3RvciIsImFjdGl2ZV9yZXNvdXJjZV9pZCIsImFjdGl2ZV9yZXNvdXJjZV90aXRsZSIsImNsZWFuX2RyYWZ0IiwicmVhZF9yZXF1ZXN0IiwibXV0YXRpb25fcmVxdWVzdCIsInJlcXVlc3RfZ2VuZXJhdGlvbiIsImlzX2RpcnR5IiwiaXNfYnVzeSIsImlzX2luaXRpYWxpemVkIiwiZ2V0X3RlbXBsYXRlX2J5X2lkIiwidGVtcGxhdGVfaWQiLCJ0ZW1wbGF0ZSIsImdldF9kb21haW5fdGVtcGxhdGUiLCJ0ZW1wbGF0ZV9rZXkiLCJyZXNldF9hY3Rpb25fbWVudSIsImRyb3Bkb3duIiwic2V0QXR0cmlidXRlIiwiQXJyYXkiLCJwcm90b3R5cGUiLCJjYWxsIiwicXVlcnlTZWxlY3RvckFsbCIsIm9wdGlvbiIsImNsYXNzTGlzdCIsInJlbW92ZSIsInJlbmRlcl9yb3dfYWN0aW9ucyIsImhvc3QiLCJyZXNvdXJjZSIsInJvd19hY3Rpb25zX3RlbXBsYXRlIiwiZHJvcGRvd25fdGVtcGxhdGUiLCJtZW51X2hvc3QiLCJyZXNvdXJjZV9pZCIsImlkIiwiaW5uZXJIVE1MIiwicXVlcnlTZWxlY3RvciIsImNsYXNzX25hbWUiLCJsYWJlbCIsInJvd19hY3Rpb25zIiwidGl0bGUiLCJzZWxlY3RlZF92YWx1ZSIsInNlbGVjdGVkX2xhYmVsIiwiaWNvbl9jbGFzcyIsIm9wdGlvbnMiLCJ0eXBlIiwidmFsdWUiLCJ0aW1lbGluZV9zZXR0aW5ncyIsImdldF9mb3JtX2RyYWZ0IiwiZm9ybSIsInNlbGVjdGVkX21vZGUiLCJ0ZW1wbGF0ZV9pbnB1dCIsIm1vZGUiLCJ1cGRhdGVfZGlydHlfc3RhdGUiLCJCb29sZWFuIiwiSlNPTiIsInN0cmluZ2lmeSIsInN5bmNocm9uaXplX2N1c3RvbV9jb250cm9scyIsImN1c3RvbV9maWVsZHMiLCJjdXN0b21fY29udHJvbHMiLCJpc19jdXN0b20iLCJ0b2dnbGUiLCJjb250cm9sIiwiZGlzYWJsZWQiLCJzZXRfYnVzeSIsInNob3VsZF9sb2NrIiwiY29udHJvbHMiLCJyZW5kZXJfc2V0dGluZ3MiLCJkdG8iLCJhbm5vdW5jZW1lbnQiLCJoZWFkZXJfdGVtcGxhdGUiLCJpbnNwZWN0b3JfdGVtcGxhdGUiLCJ0b2tlbnMiLCJib29raW5nX3RpdGxlIiwiaW5zcGVjdG9yX3RpdGxlIiwibWFwIiwidG9rZW4iLCJpbnNlcnRfdG9rZW5fbGFiZWwiLCJzZXRfaGVhZGVyIiwic2V0X2NvbnRlbnQiLCJtYXhpbXVtX2xlbmd0aCIsImFib3J0X3JlYWQiLCJhYm9ydCIsInJlc3RvcmVfcmVzb3VyY2VfYWN0aW9uX2ZvY3VzIiwib2xkX3RyaWdnZXIiLCJhY3RpdmVfZWxlbWVudCIsImFjdGl2ZUVsZW1lbnQiLCJhY3Rpb25fcm9vdCIsInRyaWdnZXIiLCJib2R5IiwiZm9jdXMiLCJwcmV2ZW50U2Nyb2xsIiwiZXJyb3IiLCJvcGVuX3NldHRpbmdzIiwicmVzb3VyY2VfdGl0bGUiLCJnZW5lcmF0aW9uIiwialF1ZXJ5IiwicmVhZF9hY3Rpb24iLCJyZWFkX25vbmNlIiwibG9hZF9lcnJvciIsInJlc2V0X2hlYWRlciIsIm9wZW4iLCJzZXRfbG9hZGluZyIsImxvYWRpbmciLCJhamF4IiwibWV0aG9kIiwiZGF0YVR5cGUiLCJhY3Rpb24iLCJub25jZSIsImRvbmUiLCJpc19vcGVuIiwic3VjY2VzcyIsImxvYWRlZCIsInNldF9lcnJvciIsImZhaWwiLCJyZXF1ZXN0X3N0YXR1cyIsImFsd2F5cyIsIm11dGF0ZV9zZXR0aW5ncyIsIm9wZXJhdGlvbiIsImlzX3Jlc2V0IiwiZHJhZnQiLCJyZXNldF9hY3Rpb24iLCJzYXZlX2FjdGlvbiIsInJlcXVlc3RfZGF0YSIsInJlc3RvcmVkX3RyaWdnZXIiLCJyZWZyZXNoX3JlcXVlc3QiLCJ3cml0ZV9ub25jZSIsInNhdmVfZXJyb3IiLCJyZXNldHRpbmciLCJzYXZpbmciLCJyZXNldF9jb21wbGV0ZSIsInNhdmVkIiwiY2xvc2UiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJoYW5kbGVfZXZlbnQiLCJldmVudCIsInJlc291cmNlX3JvdyIsInRva2VuX2J1dHRvbiIsInRhcmdldCIsImNsb3Nlc3QiLCJkZXRhaWwiLCJnZXRBdHRyaWJ1dGUiLCJwcmV2ZW50RGVmYXVsdCIsInNldFJhbmdlVGV4dCIsInNlbGVjdGlvblN0YXJ0Iiwic2VsZWN0aW9uRW5kIiwiaW5pdGlhbGl6ZSIsInNoZWxsX3RlbXBsYXRlIiwid3BiY19zaGFyZWRfdWlfaW5zcGVjdG9yIiwiY3JlYXRlIiwiY2xvc2VfbGFiZWwiLCJsb2FkaW5nX2xhYmVsIiwib3duZXJfaWQiLCJpbnRlcmFjdGlvbl9ncm91cCIsIm9uX2JlZm9yZV9jbG9zZSIsImNvbmZpcm0iLCJkaXNjYXJkX2NoYW5nZXMiLCJvbl9jbG9zZSIsImFkZEV2ZW50TGlzdGVuZXIiLCJyZWZyZXNoIiwicmVzb3VyY2VzIiwicmVzb3VyY2VzX2J5X2lkIiwiaXNBcnJheSIsImRlc3Ryb3kiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwidGV4dENvbnRlbnQiLCJ3cGJjX3RpbWVsaW5lX21vZHVsZXMiLCJyZWdpc3Rlcl9mYWN0b3J5Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS10aW1lbGluZS9yZXNvdXJjZS1wcmVmZXJlbmNlcy9fc3JjL3RpbWVsaW5lLXJlc291cmNlLXNldHRpbmdzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVGltZWxpbmUgcGVyLVJlc291cmNlIGFjdGlvbiBtZW51cyBhbmQgc2V0dGluZ3MgaW5zcGVjdG9yIGFkYXB0ZXIuXG4gKlxuICogVGhlIFJlc291cmNlIGRvbWFpbiBvd25zIHJlcXVlc3RzLCBEVE8gaW50ZXJwcmV0YXRpb24sIGFuZCB0ZW1wbGF0ZXMuIFNoYXJlZFxuICogZHJvcGRvd24gYW5kIGluc3BlY3RvciBjb21wb25lbnRzIGV4Y2x1c2l2ZWx5IG93biBtZW51L2RpYWxvZyBsaWZlY3ljbGUsXG4gKiBrZXlib2FyZCBvcGVyYXRpb24sIG91dHNpZGUtY2xpY2sgYmVoYXZpb3IsIGFuZCBmb2N1cyByZXN0b3JhdGlvbi5cbiAqXG4gKiBAcGFja2FnZSBCb29raW5nIENhbGVuZGFyXG4gKiBAc2luY2UgICAxMi4wLjBcbiAqL1xuKCBmdW5jdGlvbiAoIHdpbmRvdywgZG9jdW1lbnQsIHdwICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIG1vZHVsZV9pZCA9ICdyZXNvdXJjZV9zZXR0aW5ncyc7XG5cdHZhciBpbnNwZWN0b3JfaW5zdGFuY2VfaWQgPSAnd3BiY190aW1lbGluZV9yZXNvdXJjZV9zZXR0aW5ncyc7XG5cdHZhciBpbmhlcml0X21vZGUgPSAnaW5oZXJpdCc7XG5cdHZhciBjdXN0b21fbW9kZSA9ICdjdXN0b20nO1xuXG5cdC8qKlxuXHQgKiBSZXBsYWNlIG5hbWVkIHBsYWNlaG9sZGVycyBpbiBvbmUgdHJhbnNsYXRlZCBwbGFpbi10ZXh0IGxhYmVsLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdGV4dCAgIFRyYW5zbGF0ZWQgc291cmNlIHRleHQuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZXMgUGxhaW4gcmVwbGFjZW1lbnQgdmFsdWVzIGtleWVkIHdpdGhvdXQgYnJhY2VzLlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IEludGVycG9sYXRlZCBwbGFpbiB0ZXh0LlxuXHQgKi9cblx0ZnVuY3Rpb24gaW50ZXJwb2xhdGUoIHRleHQsIHZhbHVlcyApIHtcblx0XHRPYmplY3Qua2V5cyggdmFsdWVzIHx8IHt9ICkuZm9yRWFjaCggZnVuY3Rpb24gKCBrZXkgKSB7XG5cdFx0XHR0ZXh0ID0gU3RyaW5nKCB0ZXh0IHx8ICcnICkucmVwbGFjZSggbmV3IFJlZ0V4cCggJ1xcXFx7JyArIGtleSArICdcXFxcfScsICdnJyApLCBTdHJpbmcoIHZhbHVlc1sga2V5IF0gKSApO1xuXHRcdH0gKTtcblxuXHRcdHJldHVybiBTdHJpbmcoIHRleHQgfHwgJycgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBFeHRyYWN0IG9uZSBzYWZlIHNlcnZlciBlcnJvciBtZXNzYWdlIGZyb20gYSBqUXVlcnkgQUpBWCByZXN1bHQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSByZXNwb25zZSBPcHRpb25hbCBKU09OIHJlc3BvbnNlLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gcmVxdWVzdCAgT3B0aW9uYWwgZmFpbGVkIFhNTEh0dHBSZXF1ZXN0LlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZmFsbGJhY2sgU2FmZSB0cmFuc2xhdGVkIGZhbGxiYWNrLlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IFVzZXItZmFjaW5nIHBsYWluIHRleHQuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfZXJyb3JfbWVzc2FnZSggcmVzcG9uc2UsIHJlcXVlc3QsIGZhbGxiYWNrICkge1xuXHRcdGlmICggcmVzcG9uc2UgJiYgcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLm1lc3NhZ2UgKSB7XG5cdFx0XHRyZXR1cm4gU3RyaW5nKCByZXNwb25zZS5kYXRhLm1lc3NhZ2UgKTtcblx0XHR9XG5cdFx0aWYgKCByZXF1ZXN0ICYmIHJlcXVlc3QucmVzcG9uc2VKU09OICYmIHJlcXVlc3QucmVzcG9uc2VKU09OLmRhdGEgJiYgcmVxdWVzdC5yZXNwb25zZUpTT04uZGF0YS5tZXNzYWdlICkge1xuXHRcdFx0cmV0dXJuIFN0cmluZyggcmVxdWVzdC5yZXNwb25zZUpTT04uZGF0YS5tZXNzYWdlICk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFN0cmluZyggZmFsbGJhY2sgfHwgJycgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBOb3JtYWxpemUgYW4gZXhhY3QgcG9zaXRpdmUgUmVzb3VyY2UgaWRlbnRpZmllci5cblx0ICpcblx0ICogQHBhcmFtIHsqfSBjYW5kaWRhdGUgQ2FuZGlkYXRlIGlkZW50aWZpZXIuXG5cdCAqIEByZXR1cm4ge251bWJlcn0gUG9zaXRpdmUgaW50ZWdlciBvciB6ZXJvLlxuXHQgKi9cblx0ZnVuY3Rpb24gcG9zaXRpdmVfcmVzb3VyY2VfaWQoIGNhbmRpZGF0ZSApIHtcblx0XHRjYW5kaWRhdGUgPSBOdW1iZXIoIGNhbmRpZGF0ZSApO1xuXG5cdFx0cmV0dXJuIE51bWJlci5pc0ludGVnZXIoIGNhbmRpZGF0ZSApICYmIDAgPCBjYW5kaWRhdGUgPyBjYW5kaWRhdGUgOiAwO1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZSB0aGUgZm9jdXNlZCBSZXNvdXJjZS1zZXR0aW5ncyBicm93c2VyIGFkYXB0ZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgY29udGV4dCAgICAgICAgICBQYWdlLWNvbnRyb2xsZXIgY29uc3RydWN0aW9uIGNvbnRleHQuXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gY29udGV4dC5tb3VudCAgICBUaW1lbGluZSBtb3VudC5cblx0ICogQHBhcmFtIHtPYmplY3R9ICBjb250ZXh0LnNldHRpbmdzIFNlcnZlci1sb2NhbGl6ZWQgc2V0dGluZ3MuXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGNvbnRleHQuYW5ub3VuY2UgQWNjZXNzaWJsZSBhbm5vdW5jZW1lbnQgY2FsbGJhY2suXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGNvbnRleHQucmVmcmVzaF9hZnRlcl9tdXRhdGlvbiBDYW5vbmljYWwgVGltZWxpbmUgcmVmcmVzaCBjYWxsYmFjay5cblx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IExpZmVjeWNsZSBhbmQgcm93LXJlZnJlc2ggQVBJLlxuXHQgKi9cblx0ZnVuY3Rpb24gY3JlYXRlX3Jlc291cmNlX3NldHRpbmdzKCBjb250ZXh0ICkge1xuXHRcdHZhciBtb3VudCA9IGNvbnRleHQgJiYgY29udGV4dC5tb3VudCA/IGNvbnRleHQubW91bnQgOiBudWxsO1xuXHRcdHZhciBzZXR0aW5ncyA9IGNvbnRleHQgJiYgY29udGV4dC5zZXR0aW5ncyA/IGNvbnRleHQuc2V0dGluZ3MgOiB7fTtcblx0XHR2YXIgY29uZmlndXJhdGlvbiA9IHNldHRpbmdzLnJlc291cmNlX3NldHRpbmdzIHx8IHt9O1xuXHRcdHZhciB0ZW1wbGF0ZXMgPSBjb25maWd1cmF0aW9uLnRlbXBsYXRlcyB8fCB7fTtcblx0XHR2YXIgaTE4biA9IGNvbmZpZ3VyYXRpb24uaTE4biB8fCB7fTtcblx0XHR2YXIgdHJhbnNwb3J0X3Jvb3QgPSBzZXR0aW5ncy50cmFuc3BvcnQgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBzZXR0aW5ncy50cmFuc3BvcnQgPyBzZXR0aW5ncy50cmFuc3BvcnQgOiB7fTtcblx0XHR2YXIgdHJhbnNwb3J0ID0gdHJhbnNwb3J0X3Jvb3QucmVzb3VyY2Vfc2V0dGluZ3MgJiYgJ29iamVjdCcgPT09IHR5cGVvZiB0cmFuc3BvcnRfcm9vdC5yZXNvdXJjZV9zZXR0aW5ncyA/IHRyYW5zcG9ydF9yb290LnJlc291cmNlX3NldHRpbmdzIDoge307XG5cdFx0dmFyIHRyYW5zcG9ydF91cmwgPSB0cmFuc3BvcnRfcm9vdC51cmwgPyBTdHJpbmcoIHRyYW5zcG9ydF9yb290LnVybCApIDogJyc7XG5cdFx0dmFyIGFubm91bmNlID0gY29udGV4dCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29udGV4dC5hbm5vdW5jZSA/IGNvbnRleHQuYW5ub3VuY2UgOiBmdW5jdGlvbiAoKSB7fTtcblx0XHR2YXIgcmVmcmVzaF9hZnRlcl9tdXRhdGlvbiA9IGNvbnRleHQgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNvbnRleHQucmVmcmVzaF9hZnRlcl9tdXRhdGlvblxuXHRcdFx0PyBjb250ZXh0LnJlZnJlc2hfYWZ0ZXJfbXV0YXRpb25cblx0XHRcdDogZnVuY3Rpb24gKCkge307XG5cdFx0dmFyIHNoYXJlZF90ZW1wbGF0ZXMgPSBzZXR0aW5ncy5zaGFyZWRfdWkgJiYgc2V0dGluZ3Muc2hhcmVkX3VpLnRlbXBsYXRlcyA/IHNldHRpbmdzLnNoYXJlZF91aS50ZW1wbGF0ZXMgOiB7fTtcblx0XHR2YXIgaW5zcGVjdG9yX2hvc3QgPSBudWxsO1xuXHRcdHZhciBpbnNwZWN0b3Jfcm9vdCA9IG51bGw7XG5cdFx0dmFyIGluc3BlY3RvciA9IG51bGw7XG5cdFx0dmFyIGFjdGl2ZV9yZXNvdXJjZV9pZCA9IDA7XG5cdFx0dmFyIGFjdGl2ZV9yZXNvdXJjZV90aXRsZSA9ICcnO1xuXHRcdHZhciBjbGVhbl9kcmFmdCA9ICcnO1xuXHRcdHZhciByZWFkX3JlcXVlc3QgPSBudWxsO1xuXHRcdHZhciBtdXRhdGlvbl9yZXF1ZXN0ID0gbnVsbDtcblx0XHR2YXIgcmVxdWVzdF9nZW5lcmF0aW9uID0gMDtcblx0XHR2YXIgaXNfZGlydHkgPSBmYWxzZTtcblx0XHR2YXIgaXNfYnVzeSA9IGZhbHNlO1xuXHRcdHZhciBpc19pbml0aWFsaXplZCA9IGZhbHNlO1xuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIG9uZSBmaXhlZCBzZXJ2ZXItYWxsb3ctbGlzdGVkIFdvcmRQcmVzcyB0ZW1wbGF0ZSByZW5kZXJlci5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZV9pZCBBbGxvdy1saXN0ZWQgdGVtcGxhdGUgaWRlbnRpZmllci5cblx0XHQgKiBAcmV0dXJuIHtGdW5jdGlvbnxudWxsfSBUZW1wbGF0ZSByZW5kZXJlciBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF90ZW1wbGF0ZV9ieV9pZCggdGVtcGxhdGVfaWQgKSB7XG5cdFx0XHRyZXR1cm4gdGVtcGxhdGVfaWQgJiYgd3AgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdwLnRlbXBsYXRlID8gd3AudGVtcGxhdGUoIHRlbXBsYXRlX2lkICkgOiBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBvbmUgUmVzb3VyY2Utc2V0dGluZ3MgZG9tYWluIHRlbXBsYXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHRlbXBsYXRlX2tleSBEb21haW4gdGVtcGxhdGUga2V5LlxuXHRcdCAqIEByZXR1cm4ge0Z1bmN0aW9ufG51bGx9IFRlbXBsYXRlIHJlbmRlcmVyIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2RvbWFpbl90ZW1wbGF0ZSggdGVtcGxhdGVfa2V5ICkge1xuXHRcdFx0cmV0dXJuIGdldF90ZW1wbGF0ZV9ieV9pZCggdGVtcGxhdGVzWyB0ZW1wbGF0ZV9rZXkgXSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc2V0IHNoYXJlZC1tZW51IHNlbGVjdGlvbiBzbyBpdHMgc2luZ2xlIGFjdGlvbiByZW1haW5zIHJlcGVhdGFibGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBkcm9wZG93biBTaGFyZWQgZHJvcGRvd24gcm9vdC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlc2V0X2FjdGlvbl9tZW51KCBkcm9wZG93biApIHtcblx0XHRcdGlmICggISBkcm9wZG93biApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZHJvcGRvd24uc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXNoYXJlZC11aS1kcm9wZG93bi12YWx1ZScsICcnICk7XG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBkcm9wZG93bi5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1zaGFyZWQtdWktZHJvcGRvd24tb3B0aW9uXScgKSwgZnVuY3Rpb24gKCBvcHRpb24gKSB7XG5cdFx0XHRcdG9wdGlvbi5zZXRBdHRyaWJ1dGUoICdhcmlhLXNlbGVjdGVkJywgJ2ZhbHNlJyApO1xuXHRcdFx0XHRvcHRpb24uY2xhc3NMaXN0LnJlbW92ZSggJ2lzLXNlbGVjdGVkJyApO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbmRlciBvbmUgZG9tYWluLW93bmVkIHJvdy1hY3Rpb25zIGhvc3QgYW5kIHNoYXJlZCBkcm9wZG93biBtZW51LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gaG9zdCAgICAgVGltZWxpbmUgUmVzb3VyY2Utcm93IGludGVncmF0aW9uIGhvc3QuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgcmVzb3VyY2UgQXV0aG9yaXplZCBSZXNvdXJjZSBzdW1tYXJ5IGFscmVhZHkgaW4gdGhlIHdpbmRvdyBEVE8uXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZW5kZXJfcm93X2FjdGlvbnMoIGhvc3QsIHJlc291cmNlICkge1xuXHRcdFx0dmFyIHJvd19hY3Rpb25zX3RlbXBsYXRlID0gZ2V0X2RvbWFpbl90ZW1wbGF0ZSggJ3Jvd19hY3Rpb25zJyApO1xuXHRcdFx0dmFyIGRyb3Bkb3duX3RlbXBsYXRlID0gZ2V0X3RlbXBsYXRlX2J5X2lkKCBzaGFyZWRfdGVtcGxhdGVzLmRyb3Bkb3duICk7XG5cdFx0XHR2YXIgbWVudV9ob3N0O1xuXHRcdFx0dmFyIHJlc291cmNlX2lkID0gcG9zaXRpdmVfcmVzb3VyY2VfaWQoIHJlc291cmNlICYmIHJlc291cmNlLmlkICk7XG5cblx0XHRcdGlmICggISBob3N0IHx8ICEgcmVzb3VyY2VfaWQgfHwgISByb3dfYWN0aW9uc190ZW1wbGF0ZSB8fCAhIGRyb3Bkb3duX3RlbXBsYXRlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRob3N0LmlubmVySFRNTCA9IHJvd19hY3Rpb25zX3RlbXBsYXRlKCB7IHJlc291cmNlX2lkOiByZXNvdXJjZV9pZCB9ICk7XG5cdFx0XHRtZW51X2hvc3QgPSBob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLXJlc291cmNlLXNldHRpbmdzLW1lbnUtaG9zdF0nICk7XG5cdFx0XHRpZiAoICEgbWVudV9ob3N0ICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRtZW51X2hvc3QuaW5uZXJIVE1MID0gZHJvcGRvd25fdGVtcGxhdGUoIHtcblx0XHRcdFx0aWQ6ICd3cGJjX3RpbWVsaW5lX3Jlc291cmNlX2FjdGlvbnNfJyArIHJlc291cmNlX2lkLFxuXHRcdFx0XHRjbGFzc19uYW1lOiAnd3BiY190aW1lbGluZV9yZXNvdXJjZV9zZXR0aW5nc19fbWVudScsXG5cdFx0XHRcdGxhYmVsOiBpbnRlcnBvbGF0ZSggaTE4bi5yb3dfYWN0aW9ucywgeyB0aXRsZTogcmVzb3VyY2UudGl0bGUgfHwgJycgfSApLFxuXHRcdFx0XHRzZWxlY3RlZF92YWx1ZTogJycsXG5cdFx0XHRcdHNlbGVjdGVkX2xhYmVsOiAnJyxcblx0XHRcdFx0aWNvbl9jbGFzczogJ3dwYmMtYmktdGhyZWUtZG90cy12ZXJ0aWNhbCcsXG5cdFx0XHRcdG9wdGlvbnM6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0eXBlOiAnb3B0aW9uJyxcblx0XHRcdFx0XHRcdHZhbHVlOiAndGltZWxpbmVfc2V0dGluZ3MnLFxuXHRcdFx0XHRcdFx0bGFiZWw6IGkxOG4udGltZWxpbmVfc2V0dGluZ3MsXG5cdFx0XHRcdFx0XHRpY29uX2NsYXNzOiAnd3BiYy1iaS1zbGlkZXJzJ1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBhIG5vcm1hbGl6ZWQgZWRpdGFibGUgZHJhZnQgZnJvbSB0aGUgY3VycmVudCBmb3JtLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBNb2RlIGFuZCB0ZW1wbGF0ZSBkcmFmdC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfZm9ybV9kcmFmdCgpIHtcblx0XHRcdHZhciBmb3JtID0gaW5zcGVjdG9yX3Jvb3QgPyBpbnNwZWN0b3Jfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1zZXR0aW5ncy1mb3JtXScgKSA6IG51bGw7XG5cdFx0XHR2YXIgc2VsZWN0ZWRfbW9kZSA9IGZvcm0gPyBmb3JtLnF1ZXJ5U2VsZWN0b3IoICdpbnB1dFtuYW1lPVwid3BiY190aW1lbGluZV9yZXNvdXJjZV90aXRsZV9tb2RlXCJdOmNoZWNrZWQnICkgOiBudWxsO1xuXHRcdFx0dmFyIHRlbXBsYXRlX2lucHV0ID0gZm9ybSA/IGZvcm0ucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2Utc2V0dGluZ3MtdGVtcGxhdGVdJyApIDogbnVsbDtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0bW9kZTogc2VsZWN0ZWRfbW9kZSAmJiBjdXN0b21fbW9kZSA9PT0gc2VsZWN0ZWRfbW9kZS52YWx1ZSA/IGN1c3RvbV9tb2RlIDogaW5oZXJpdF9tb2RlLFxuXHRcdFx0XHR0ZW1wbGF0ZTogdGVtcGxhdGVfaW5wdXQgPyB0ZW1wbGF0ZV9pbnB1dC52YWx1ZSA6ICcnXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFVwZGF0ZSB0aGUgYnJvd3NlciBkaXJ0eSBmbGFnIGZyb20gdGhlIGNhbm9uaWNhbCBmb3JtIGRyYWZ0LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB1cGRhdGVfZGlydHlfc3RhdGUoKSB7XG5cdFx0XHRpc19kaXJ0eSA9IEJvb2xlYW4oIGNsZWFuX2RyYWZ0ICkgJiYgSlNPTi5zdHJpbmdpZnkoIGdldF9mb3JtX2RyYWZ0KCkgKSAhPT0gY2xlYW5fZHJhZnQ7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRW5hYmxlIGN1c3RvbS10ZW1wbGF0ZSBjb250cm9scyBvbmx5IGZvciBleHBsaWNpdCBjdXN0b20gbW9kZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3luY2hyb25pemVfY3VzdG9tX2NvbnRyb2xzKCkge1xuXHRcdFx0dmFyIGZvcm0gPSBpbnNwZWN0b3Jfcm9vdCA/IGluc3BlY3Rvcl9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLXJlc291cmNlLXNldHRpbmdzLWZvcm1dJyApIDogbnVsbDtcblx0XHRcdHZhciBjdXN0b21fZmllbGRzID0gZm9ybSA/IGZvcm0ucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2UtY3VzdG9tLWZpZWxkc10nICkgOiBudWxsO1xuXHRcdFx0dmFyIGN1c3RvbV9jb250cm9scyA9IGN1c3RvbV9maWVsZHMgPyBjdXN0b21fZmllbGRzLnF1ZXJ5U2VsZWN0b3JBbGwoICdpbnB1dCwgYnV0dG9uJyApIDogW107XG5cdFx0XHR2YXIgaXNfY3VzdG9tID0gY3VzdG9tX21vZGUgPT09IGdldF9mb3JtX2RyYWZ0KCkubW9kZTtcblxuXHRcdFx0aWYgKCBjdXN0b21fZmllbGRzICkge1xuXHRcdFx0XHRjdXN0b21fZmllbGRzLmNsYXNzTGlzdC50b2dnbGUoICdpcy1kaXNhYmxlZCcsICEgaXNfY3VzdG9tICk7XG5cdFx0XHR9XG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBjdXN0b21fY29udHJvbHMsIGZ1bmN0aW9uICggY29udHJvbCApIHtcblx0XHRcdFx0Y29udHJvbC5kaXNhYmxlZCA9ICEgaXNfY3VzdG9tIHx8IGlzX2J1c3k7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTG9jayBvciB1bmxvY2sgZXZlcnkgc2V0dGluZ3MgY29udHJvbCBkdXJpbmcgYSBzdGF0ZS1jaGFuZ2luZyByZXF1ZXN0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBzaG91bGRfbG9jayBXaGV0aGVyIG11dGF0aW9uIGNvbnRyb2xzIG11c3QgYmUgbG9ja2VkLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X2J1c3koIHNob3VsZF9sb2NrICkge1xuXHRcdFx0dmFyIGNvbnRyb2xzID0gaW5zcGVjdG9yX3Jvb3QgPyBpbnNwZWN0b3Jfcm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1zZXR0aW5ncy1mb3JtXSBidXR0b24sIFtkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2Utc2V0dGluZ3MtZm9ybV0gaW5wdXQnICkgOiBbXTtcblxuXHRcdFx0aXNfYnVzeSA9IEJvb2xlYW4oIHNob3VsZF9sb2NrICk7XG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBjb250cm9scywgZnVuY3Rpb24gKCBjb250cm9sICkge1xuXHRcdFx0XHRjb250cm9sLmRpc2FibGVkID0gaXNfYnVzeTtcblx0XHRcdH0gKTtcblx0XHRcdHN5bmNocm9uaXplX2N1c3RvbV9jb250cm9scygpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbmRlciBvbmUgYXV0aG9yaXplZCBSZXNvdXJjZS1zZXR0aW5ncyBEVE8gaW5zaWRlIHRoZSBzaGFyZWQgc2hlbGwuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZHRvICAgICAgICAgIEV4YWN0IHNlcnZlciBSZXNvdXJjZS1zZXR0aW5ncyBEVE8uXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGFubm91bmNlbWVudCBBY2Nlc3NpYmxlIHN0YXR1cyBhbm5vdW5jZW1lbnQuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHJlbmRlcmVkIHN1Y2Nlc3NmdWxseS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZW5kZXJfc2V0dGluZ3MoIGR0bywgYW5ub3VuY2VtZW50ICkge1xuXHRcdFx0dmFyIGhlYWRlcl90ZW1wbGF0ZSA9IGdldF9kb21haW5fdGVtcGxhdGUoICdoZWFkZXInICk7XG5cdFx0XHR2YXIgaW5zcGVjdG9yX3RlbXBsYXRlID0gZ2V0X2RvbWFpbl90ZW1wbGF0ZSggJ2luc3BlY3RvcicgKTtcblx0XHRcdHZhciB0aXRsZTtcblx0XHRcdHZhciB0b2tlbnM7XG5cblx0XHRcdGlmICggISBpbnNwZWN0b3IgfHwgISBoZWFkZXJfdGVtcGxhdGUgfHwgISBpbnNwZWN0b3JfdGVtcGxhdGUgfHwgISBkdG8gfHwgISBkdG8ucmVzb3VyY2UgfHwgISBkdG8uYm9va2luZ190aXRsZSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0dGl0bGUgPSBpbnRlcnBvbGF0ZSggaTE4bi5pbnNwZWN0b3JfdGl0bGUsIHsgdGl0bGU6IGR0by5yZXNvdXJjZS50aXRsZSB8fCBhY3RpdmVfcmVzb3VyY2VfdGl0bGUgfSApO1xuXHRcdFx0dG9rZW5zID0gKCBjb25maWd1cmF0aW9uLnRva2VucyB8fCBbXSApLm1hcCggZnVuY3Rpb24gKCB0b2tlbiApIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHR2YWx1ZTogU3RyaW5nKCB0b2tlbiApLFxuXHRcdFx0XHRcdGxhYmVsOiBpbnRlcnBvbGF0ZSggaTE4bi5pbnNlcnRfdG9rZW5fbGFiZWwsIHsgdG9rZW46IHRva2VuIH0gKVxuXHRcdFx0XHR9O1xuXHRcdFx0fSApO1xuXHRcdFx0aW5zcGVjdG9yLnNldF9oZWFkZXIoIGhlYWRlcl90ZW1wbGF0ZSggeyB0aXRsZTogdGl0bGUgfSApLCB0aXRsZSApO1xuXHRcdFx0aW5zcGVjdG9yLnNldF9jb250ZW50KFxuXHRcdFx0XHRpbnNwZWN0b3JfdGVtcGxhdGUoIHtcblx0XHRcdFx0XHRib29raW5nX3RpdGxlOiBkdG8uYm9va2luZ190aXRsZSxcblx0XHRcdFx0XHRtYXhpbXVtX2xlbmd0aDogTnVtYmVyKCBjb25maWd1cmF0aW9uLm1heGltdW1fbGVuZ3RoICkgfHwgMjAwLFxuXHRcdFx0XHRcdHRva2VuczogdG9rZW5zLFxuXHRcdFx0XHRcdGkxOG46IGkxOG5cblx0XHRcdFx0fSApLFxuXHRcdFx0XHRhbm5vdW5jZW1lbnQgfHwgJydcblx0XHRcdCk7XG5cdFx0XHRjbGVhbl9kcmFmdCA9IEpTT04uc3RyaW5naWZ5KCBnZXRfZm9ybV9kcmFmdCgpICk7XG5cdFx0XHRpc19kaXJ0eSA9IGZhbHNlO1xuXHRcdFx0c2V0X2J1c3koIGZhbHNlICk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFib3J0IG9ubHkgbm9uLW11dGF0aW5nIHJlYWRzIGFuZCBpbnZhbGlkYXRlIHBlbmRpbmcgY2FsbGJhY2tzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBhYm9ydF9yZWFkKCkge1xuXHRcdFx0cmVxdWVzdF9nZW5lcmF0aW9uICs9IDE7XG5cdFx0XHRpZiAoIHJlYWRfcmVxdWVzdCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgcmVhZF9yZXF1ZXN0LmFib3J0ICkge1xuXHRcdFx0XHRyZWFkX3JlcXVlc3QuYWJvcnQoKTtcblx0XHRcdH1cblx0XHRcdHJlYWRfcmVxdWVzdCA9IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVzdG9yZSBmb2N1cyB0byB0aGUgc2FtZSBSZXNvdXJjZSBhY3Rpb24gYWZ0ZXIgY2Fub25pY2FsIHJvdyByZXBsYWNlbWVudC5cblx0XHQgKlxuXHRcdCAqIEZvY3VzIGlzIHJlc3RvcmVkIG9ubHkgd2hlbiByb3cgcmVwbGFjZW1lbnQgbGVmdCBmb2N1cyBvbiB0aGUgZG9jdW1lbnQgYm9keVxuXHRcdCAqIG9yIG9uIHRoZSBvcmlnaW5hbCB0cmlnZ2VyLiBEZWxpYmVyYXRlIGZvY3VzIG1vdmVtZW50IGlzIG5ldmVyIG92ZXJyaWRkZW4uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gICAgICByZXNvdXJjZV9pZCAgQXV0aG9yaXplZCBSZXNvdXJjZSBpZGVudGlmaWVyLlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG9sZF90cmlnZ2VyICBUcmlnZ2VyIGZvY3VzZWQgYmVmb3JlIGNhbm9uaWNhbCByZWZyZXNoLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVzdG9yZV9yZXNvdXJjZV9hY3Rpb25fZm9jdXMoIHJlc291cmNlX2lkLCBvbGRfdHJpZ2dlciApIHtcblx0XHRcdHZhciBhY3RpdmVfZWxlbWVudCA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG5cdFx0XHR2YXIgYWN0aW9uX3Jvb3Q7XG5cdFx0XHR2YXIgdHJpZ2dlcjtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHQhIGlzX2luaXRpYWxpemVkXG5cdFx0XHRcdHx8ICggYWN0aXZlX2VsZW1lbnQgJiYgZG9jdW1lbnQuYm9keSAhPT0gYWN0aXZlX2VsZW1lbnQgJiYgb2xkX3RyaWdnZXIgIT09IGFjdGl2ZV9lbGVtZW50IClcblx0XHRcdCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRhY3Rpb25fcm9vdCA9IG1vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLXJlc291cmNlLXNldHRpbmdzLWFjdGlvbnM9XCInICsgcmVzb3VyY2VfaWQgKyAnXCJdJyApO1xuXHRcdFx0dHJpZ2dlciA9IGFjdGlvbl9yb290ID8gYWN0aW9uX3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2hhcmVkLXVpLWRyb3Bkb3duLXRyaWdnZXJdJyApIDogbnVsbDtcblx0XHRcdGlmICggISB0cmlnZ2VyIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiB0cmlnZ2VyLmZvY3VzICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR0cmlnZ2VyLmZvY3VzKCB7IHByZXZlbnRTY3JvbGw6IHRydWUgfSApO1xuXHRcdFx0fSBjYXRjaCAoIGVycm9yICkge1xuXHRcdFx0XHR0cmlnZ2VyLmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVhZCBhbmQgb3BlbiBvbmUgZXhhY3QgYXV0aG9yaXplZCBSZXNvdXJjZSBzZXR0aW5ncyByZWNvcmQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gICAgICByZXNvdXJjZV9pZCAgICBBdXRob3JpemVkIFJlc291cmNlIElEIGZyb20gdGhlIGN1cnJlbnQgd2luZG93IERUTy5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICByZXNvdXJjZV90aXRsZSBBdXRob3JpemVkIFJlc291cmNlIHRpdGxlIGZyb20gdGhlIGN1cnJlbnQgd2luZG93IERUTy5cblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSB0cmlnZ2VyICAgICAgICBTaGFyZWQgZHJvcGRvd24gdHJpZ2dlciB1c2VkIGZvciBmb2N1cyByZXN0b3JhdGlvbi5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG9wZW5fc2V0dGluZ3MoIHJlc291cmNlX2lkLCByZXNvdXJjZV90aXRsZSwgdHJpZ2dlciApIHtcblx0XHRcdHZhciBnZW5lcmF0aW9uO1xuXG5cdFx0XHRpZiAoICEgaW5zcGVjdG9yIHx8ICEgd2luZG93LmpRdWVyeSB8fCAhIHRyYW5zcG9ydF91cmwgfHwgISB0cmFuc3BvcnQucmVhZF9hY3Rpb24gfHwgISB0cmFuc3BvcnQucmVhZF9ub25jZSApIHtcblx0XHRcdFx0YW5ub3VuY2UoIGkxOG4ubG9hZF9lcnJvciApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRhYm9ydF9yZWFkKCk7XG5cdFx0XHRhY3RpdmVfcmVzb3VyY2VfaWQgPSByZXNvdXJjZV9pZDtcblx0XHRcdGFjdGl2ZV9yZXNvdXJjZV90aXRsZSA9IFN0cmluZyggcmVzb3VyY2VfdGl0bGUgfHwgJycgKTtcblx0XHRcdGNsZWFuX2RyYWZ0ID0gJyc7XG5cdFx0XHRpc19kaXJ0eSA9IGZhbHNlO1xuXHRcdFx0aW5zcGVjdG9yLnJlc2V0X2hlYWRlciggaW50ZXJwb2xhdGUoIGkxOG4uaW5zcGVjdG9yX3RpdGxlLCB7IHRpdGxlOiBhY3RpdmVfcmVzb3VyY2VfdGl0bGUgfSApICk7XG5cdFx0XHRpbnNwZWN0b3Iub3BlbiggdHJpZ2dlciApO1xuXHRcdFx0aW5zcGVjdG9yLnNldF9sb2FkaW5nKCBpMThuLmxvYWRpbmcgKTtcblx0XHRcdGdlbmVyYXRpb24gPSByZXF1ZXN0X2dlbmVyYXRpb247XG5cdFx0XHRyZWFkX3JlcXVlc3QgPSB3aW5kb3cualF1ZXJ5LmFqYXgoIHtcblx0XHRcdFx0dXJsOiB0cmFuc3BvcnRfdXJsLFxuXHRcdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdFx0ZGF0YVR5cGU6ICdqc29uJyxcblx0XHRcdFx0ZGF0YToge1xuXHRcdFx0XHRcdGFjdGlvbjogdHJhbnNwb3J0LnJlYWRfYWN0aW9uLFxuXHRcdFx0XHRcdG5vbmNlOiB0cmFuc3BvcnQucmVhZF9ub25jZSxcblx0XHRcdFx0XHRyZXNvdXJjZV9pZDogcmVzb3VyY2VfaWRcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0cmVhZF9yZXF1ZXN0LmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRcdGlmICggZ2VuZXJhdGlvbiAhPT0gcmVxdWVzdF9nZW5lcmF0aW9uIHx8IHJlc291cmNlX2lkICE9PSBhY3RpdmVfcmVzb3VyY2VfaWQgfHwgISBpbnNwZWN0b3IuaXNfb3BlbigpICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICEgcmVzcG9uc2UgfHwgISByZXNwb25zZS5zdWNjZXNzIHx8ICEgcmVuZGVyX3NldHRpbmdzKCByZXNwb25zZS5kYXRhLCBpMThuLmxvYWRlZCApICkge1xuXHRcdFx0XHRcdGluc3BlY3Rvci5zZXRfZXJyb3IoIGdldF9lcnJvcl9tZXNzYWdlKCByZXNwb25zZSwgbnVsbCwgaTE4bi5sb2FkX2Vycm9yICkgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0cmVhZF9yZXF1ZXN0LmZhaWwoIGZ1bmN0aW9uICggcmVxdWVzdCwgcmVxdWVzdF9zdGF0dXMgKSB7XG5cdFx0XHRcdGlmICggJ2Fib3J0JyAhPT0gcmVxdWVzdF9zdGF0dXMgJiYgZ2VuZXJhdGlvbiA9PT0gcmVxdWVzdF9nZW5lcmF0aW9uICYmIHJlc291cmNlX2lkID09PSBhY3RpdmVfcmVzb3VyY2VfaWQgJiYgaW5zcGVjdG9yLmlzX29wZW4oKSApIHtcblx0XHRcdFx0XHRpbnNwZWN0b3Iuc2V0X2Vycm9yKCBnZXRfZXJyb3JfbWVzc2FnZSggbnVsbCwgcmVxdWVzdCwgaTE4bi5sb2FkX2Vycm9yICkgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0cmVhZF9yZXF1ZXN0LmFsd2F5cyggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRpZiAoIGdlbmVyYXRpb24gPT09IHJlcXVlc3RfZ2VuZXJhdGlvbiApIHtcblx0XHRcdFx0XHRyZWFkX3JlcXVlc3QgPSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUGVyc2lzdCBvciByZXNldCB0aGUgY3VycmVudCBSZXNvdXJjZSBwcmVmZXJlbmNlIHRocm91Z2ggaXRzIGZpeGVkIGVuZHBvaW50LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG9wZXJhdGlvbiBgc2F2ZWAgb3IgYHJlc2V0YC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG11dGF0ZV9zZXR0aW5ncyggb3BlcmF0aW9uICkge1xuXHRcdFx0dmFyIGlzX3Jlc2V0ID0gJ3Jlc2V0JyA9PT0gb3BlcmF0aW9uO1xuXHRcdFx0dmFyIGRyYWZ0ID0gZ2V0X2Zvcm1fZHJhZnQoKTtcblx0XHRcdHZhciBhY3Rpb24gPSBpc19yZXNldCA/IHRyYW5zcG9ydC5yZXNldF9hY3Rpb24gOiB0cmFuc3BvcnQuc2F2ZV9hY3Rpb247XG5cdFx0XHR2YXIgZ2VuZXJhdGlvbiA9IHJlcXVlc3RfZ2VuZXJhdGlvbjtcblx0XHRcdHZhciByZXF1ZXN0X2RhdGE7XG5cdFx0XHR2YXIgcmVzb3VyY2VfaWQ7XG5cdFx0XHR2YXIgcmVzdG9yZWRfdHJpZ2dlcjtcblx0XHRcdHZhciByZWZyZXNoX3JlcXVlc3Q7XG5cblx0XHRcdGlmICggaXNfYnVzeSB8fCAhIGFjdGl2ZV9yZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHdpbmRvdy5qUXVlcnkgfHwgISB0cmFuc3BvcnRfdXJsIHx8ICEgYWN0aW9uIHx8ICEgdHJhbnNwb3J0LndyaXRlX25vbmNlICkge1xuXHRcdFx0XHRhbm5vdW5jZSggaTE4bi5zYXZlX2Vycm9yICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHNldF9idXN5KCB0cnVlICk7XG5cdFx0XHRhbm5vdW5jZSggaXNfcmVzZXQgPyBpMThuLnJlc2V0dGluZyA6IGkxOG4uc2F2aW5nICk7XG5cdFx0XHRyZXF1ZXN0X2RhdGEgPSB7XG5cdFx0XHRcdGFjdGlvbjogYWN0aW9uLFxuXHRcdFx0XHRub25jZTogdHJhbnNwb3J0LndyaXRlX25vbmNlLFxuXHRcdFx0XHRyZXNvdXJjZV9pZDogYWN0aXZlX3Jlc291cmNlX2lkXG5cdFx0XHR9O1xuXHRcdFx0aWYgKCAhIGlzX3Jlc2V0ICkge1xuXHRcdFx0XHRyZXF1ZXN0X2RhdGEubW9kZSA9IGRyYWZ0Lm1vZGU7XG5cdFx0XHRcdHJlcXVlc3RfZGF0YS50ZW1wbGF0ZSA9IGRyYWZ0LnRlbXBsYXRlO1xuXHRcdFx0fVxuXHRcdFx0bXV0YXRpb25fcmVxdWVzdCA9IHdpbmRvdy5qUXVlcnkuYWpheCgge1xuXHRcdFx0XHR1cmw6IHRyYW5zcG9ydF91cmwsXG5cdFx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0XHRkYXRhVHlwZTogJ2pzb24nLFxuXHRcdFx0XHRkYXRhOiByZXF1ZXN0X2RhdGFcblx0XHRcdH0gKTtcblx0XHRcdG11dGF0aW9uX3JlcXVlc3QuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdFx0aWYgKCBnZW5lcmF0aW9uICE9PSByZXF1ZXN0X2dlbmVyYXRpb24gfHwgISBpbnNwZWN0b3IgfHwgISBpbnNwZWN0b3IuaXNfb3BlbigpICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHJlc3BvbnNlICYmIHJlc3BvbnNlLnN1Y2Nlc3MgJiYgcmVuZGVyX3NldHRpbmdzKCByZXNwb25zZS5kYXRhLCBpc19yZXNldCA/IGkxOG4ucmVzZXRfY29tcGxldGUgOiBpMThuLnNhdmVkICkgKSB7XG5cdFx0XHRcdFx0cmVzb3VyY2VfaWQgPSBhY3RpdmVfcmVzb3VyY2VfaWQ7XG5cdFx0XHRcdFx0YW5ub3VuY2UoIGlzX3Jlc2V0ID8gaTE4bi5yZXNldF9jb21wbGV0ZSA6IGkxOG4uc2F2ZWQgKTtcblx0XHRcdFx0XHRpbnNwZWN0b3IuY2xvc2UoIHRydWUgKTtcblx0XHRcdFx0XHRyZXN0b3JlZF90cmlnZ2VyID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcblx0XHRcdFx0XHRyZWZyZXNoX3JlcXVlc3QgPSByZWZyZXNoX2FmdGVyX211dGF0aW9uKCk7XG5cdFx0XHRcdFx0aWYgKCByZWZyZXNoX3JlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHJlZnJlc2hfcmVxdWVzdC5kb25lICkge1xuXHRcdFx0XHRcdFx0cmVmcmVzaF9yZXF1ZXN0LmRvbmUoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0XHRcdHJlc3RvcmVfcmVzb3VyY2VfYWN0aW9uX2ZvY3VzKCByZXNvdXJjZV9pZCwgcmVzdG9yZWRfdHJpZ2dlciApO1xuXHRcdFx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZXRfYnVzeSggZmFsc2UgKTtcblx0XHRcdFx0YW5ub3VuY2UoIGdldF9lcnJvcl9tZXNzYWdlKCByZXNwb25zZSwgbnVsbCwgaTE4bi5zYXZlX2Vycm9yICkgKTtcblx0XHRcdH0gKTtcblx0XHRcdG11dGF0aW9uX3JlcXVlc3QuZmFpbCggZnVuY3Rpb24gKCByZXF1ZXN0ICkge1xuXHRcdFx0XHRpZiAoIGdlbmVyYXRpb24gPT09IHJlcXVlc3RfZ2VuZXJhdGlvbiAmJiBpbnNwZWN0b3IgJiYgaW5zcGVjdG9yLmlzX29wZW4oKSApIHtcblx0XHRcdFx0XHRzZXRfYnVzeSggZmFsc2UgKTtcblx0XHRcdFx0XHRhbm5vdW5jZSggZ2V0X2Vycm9yX21lc3NhZ2UoIG51bGwsIHJlcXVlc3QsIGkxOG4uc2F2ZV9lcnJvciApICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdG11dGF0aW9uX3JlcXVlc3QuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdG11dGF0aW9uX3JlcXVlc3QgPSBudWxsO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEhhbmRsZSBkb21haW4gYWN0aW9ucyB3aXRob3V0IHRha2luZyBvdmVyIHNoYXJlZCBtZW51L2RpYWxvZyBsaWZlY3ljbGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCBUaW1lbGluZSBkZWxlZ2F0ZWQgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfZXZlbnQoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGRyb3Bkb3duO1xuXHRcdFx0dmFyIHJvd19hY3Rpb25zO1xuXHRcdFx0dmFyIHJlc291cmNlX2lkO1xuXHRcdFx0dmFyIHJlc291cmNlX3Jvdztcblx0XHRcdHZhciB0cmlnZ2VyO1xuXHRcdFx0dmFyIGZvcm07XG5cdFx0XHR2YXIgdG9rZW5fYnV0dG9uO1xuXHRcdFx0dmFyIHRlbXBsYXRlX2lucHV0O1xuXG5cdFx0XHRpZiAoICd3cGJjOnNoYXJlZC11aS1kcm9wZG93bi1jaGFuZ2UnID09PSBldmVudC50eXBlICkge1xuXHRcdFx0XHRkcm9wZG93biA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1zaGFyZWQtdWktZHJvcGRvd25dJyApO1xuXHRcdFx0XHRyb3dfYWN0aW9ucyA9IGRyb3Bkb3duID8gZHJvcGRvd24uY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2Utc2V0dGluZ3MtYWN0aW9uc10nICkgOiBudWxsO1xuXHRcdFx0XHRpZiAoICEgcm93X2FjdGlvbnMgfHwgISBldmVudC5kZXRhaWwgfHwgJ3RpbWVsaW5lX3NldHRpbmdzJyAhPT0gZXZlbnQuZGV0YWlsLnZhbHVlICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXNvdXJjZV9pZCA9IHBvc2l0aXZlX3Jlc291cmNlX2lkKCByb3dfYWN0aW9ucy5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2Utc2V0dGluZ3MtYWN0aW9ucycgKSApO1xuXHRcdFx0XHRyZXNvdXJjZV9yb3cgPSByb3dfYWN0aW9ucy5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1yb3ctc2lkZT1cInJlc291cmNlXCJdJyApO1xuXHRcdFx0XHR0cmlnZ2VyID0gZHJvcGRvd24ucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2hhcmVkLXVpLWRyb3Bkb3duLXRyaWdnZXJdJyApO1xuXHRcdFx0XHRyZXNldF9hY3Rpb25fbWVudSggZHJvcGRvd24gKTtcblx0XHRcdFx0b3Blbl9zZXR0aW5ncyhcblx0XHRcdFx0XHRyZXNvdXJjZV9pZCxcblx0XHRcdFx0XHRyZXNvdXJjZV9yb3cgPyByZXNvdXJjZV9yb3cuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXJlc291cmNlLXRpdGxlJyApIDogJycsXG5cdFx0XHRcdFx0dHJpZ2dlclxuXHRcdFx0XHQpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGZvcm0gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2Utc2V0dGluZ3MtZm9ybV0nICk7XG5cdFx0XHRpZiAoICEgZm9ybSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnc3VibWl0JyA9PT0gZXZlbnQudHlwZSApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0bXV0YXRlX3NldHRpbmdzKCAnc2F2ZScgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnY2xpY2snID09PSBldmVudC50eXBlICYmIGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1zZXR0aW5ncy1yZXNldF0nICkgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdG11dGF0ZV9zZXR0aW5ncyggJ3Jlc2V0JyApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0b2tlbl9idXR0b24gPSAnY2xpY2snID09PSBldmVudC50eXBlID8gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXRpbWVsaW5lLXJlc291cmNlLXNldHRpbmdzLXRva2VuXScgKSA6IG51bGw7XG5cdFx0XHRpZiAoIHRva2VuX2J1dHRvbiApIHtcblx0XHRcdFx0dGVtcGxhdGVfaW5wdXQgPSBmb3JtLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLXJlc291cmNlLXNldHRpbmdzLXRlbXBsYXRlXScgKTtcblx0XHRcdFx0aWYgKCB0ZW1wbGF0ZV9pbnB1dCAmJiAhIHRlbXBsYXRlX2lucHV0LmRpc2FibGVkICkge1xuXHRcdFx0XHRcdHRlbXBsYXRlX2lucHV0LnNldFJhbmdlVGV4dChcblx0XHRcdFx0XHRcdHRva2VuX2J1dHRvbi5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2Utc2V0dGluZ3MtdG9rZW4nICkgfHwgJycsXG5cdFx0XHRcdFx0XHR0ZW1wbGF0ZV9pbnB1dC5zZWxlY3Rpb25TdGFydCxcblx0XHRcdFx0XHRcdHRlbXBsYXRlX2lucHV0LnNlbGVjdGlvbkVuZCxcblx0XHRcdFx0XHRcdCdlbmQnXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR0ZW1wbGF0ZV9pbnB1dC5mb2N1cygpO1xuXHRcdFx0XHRcdHVwZGF0ZV9kaXJ0eV9zdGF0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggJ2NoYW5nZScgPT09IGV2ZW50LnR5cGUgfHwgJ2lucHV0JyA9PT0gZXZlbnQudHlwZSApIHtcblx0XHRcdFx0c3luY2hyb25pemVfY3VzdG9tX2NvbnRyb2xzKCk7XG5cdFx0XHRcdHVwZGF0ZV9kaXJ0eV9zdGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE1vdW50IHRoZSBzaGFyZWQgaW5zcGVjdG9yIHNoZWxsIGFuZCBkZWxlZ2F0ZWQgZG9tYWluIGV2ZW50IGhhbmRsZXJzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbml0aWFsaXplKCkge1xuXHRcdFx0dmFyIHNoZWxsX3RlbXBsYXRlID0gZ2V0X3RlbXBsYXRlX2J5X2lkKCBzaGFyZWRfdGVtcGxhdGVzLmluc3BlY3RvciApO1xuXG5cdFx0XHRpZiAoXG5cdFx0XHRcdGlzX2luaXRpYWxpemVkIHx8ICEgbW91bnQgfHwgISBzaGVsbF90ZW1wbGF0ZSB8fCAhIHdpbmRvdy53cGJjX3NoYXJlZF91aV9pbnNwZWN0b3IgfHxcblx0XHRcdFx0J2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy53cGJjX3NoYXJlZF91aV9pbnNwZWN0b3IuY3JlYXRlXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aW5zcGVjdG9yX2hvc3QgPSBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1zZXR0aW5ncy1pbnNwZWN0b3ItaG9zdF0nICk7XG5cdFx0XHRpZiAoICEgaW5zcGVjdG9yX2hvc3QgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGluc3BlY3Rvcl9ob3N0LmlubmVySFRNTCA9IHNoZWxsX3RlbXBsYXRlKCB7XG5cdFx0XHRcdGlkOiBpbnNwZWN0b3JfaW5zdGFuY2VfaWQsXG5cdFx0XHRcdHRpdGxlOiBpMThuLnRpbWVsaW5lX3NldHRpbmdzLFxuXHRcdFx0XHRjbG9zZV9sYWJlbDogaTE4bi5jbG9zZSxcblx0XHRcdFx0bG9hZGluZ19sYWJlbDogaTE4bi5sb2FkaW5nXG5cdFx0XHR9ICk7XG5cdFx0XHRpbnNwZWN0b3Jfcm9vdCA9IGluc3BlY3Rvcl9ob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNoYXJlZC11aS1pbnNwZWN0b3JdJyApO1xuXHRcdFx0aW5zcGVjdG9yID0gd2luZG93LndwYmNfc2hhcmVkX3VpX2luc3BlY3Rvci5jcmVhdGUoIGluc3BlY3Rvcl9yb290LCB7XG5cdFx0XHRcdG93bmVyX2lkOiBpbnNwZWN0b3JfaW5zdGFuY2VfaWQsXG5cdFx0XHRcdGludGVyYWN0aW9uX2dyb3VwOiAnd3BiY190aW1lbGluZV9yZXNvdXJjZV9zZXR0aW5ncycsXG5cdFx0XHRcdG9uX2JlZm9yZV9jbG9zZTogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdGlmICggaXNfYnVzeSApIHtcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gISBpc19kaXJ0eSB8fCB3aW5kb3cuY29uZmlybSggaTE4bi5kaXNjYXJkX2NoYW5nZXMgfHwgJycgKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0b25fY2xvc2U6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRhYm9ydF9yZWFkKCk7XG5cdFx0XHRcdFx0YWN0aXZlX3Jlc291cmNlX2lkID0gMDtcblx0XHRcdFx0XHRhY3RpdmVfcmVzb3VyY2VfdGl0bGUgPSAnJztcblx0XHRcdFx0XHRjbGVhbl9kcmFmdCA9ICcnO1xuXHRcdFx0XHRcdGlzX2RpcnR5ID0gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdGlmICggISBpbnNwZWN0b3IgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOnNoYXJlZC11aS1kcm9wZG93bi1jaGFuZ2UnLCBoYW5kbGVfZXZlbnQgKTtcblx0XHRcdGluc3BlY3Rvcl9yb290LmFkZEV2ZW50TGlzdGVuZXIoICdzdWJtaXQnLCBoYW5kbGVfZXZlbnQgKTtcblx0XHRcdGluc3BlY3Rvcl9yb290LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGhhbmRsZV9ldmVudCApO1xuXHRcdFx0aW5zcGVjdG9yX3Jvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIGhhbmRsZV9ldmVudCApO1xuXHRcdFx0aW5zcGVjdG9yX3Jvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgaGFuZGxlX2V2ZW50ICk7XG5cdFx0XHRpc19pbml0aWFsaXplZCA9IHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVuZGVyIGFjdGlvbiBtZW51cyBmb3IgZXZlcnkgY3VycmVudGx5IHZpc2libGUgYXV0aG9yaXplZCBSZXNvdXJjZSByb3cuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0FycmF5PE9iamVjdD59IHJlc291cmNlcyBDdXJyZW50IFRpbWVsaW5lIFJlc291cmNlIHN1bW1hcmllcy5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlZnJlc2goIHJlc291cmNlcyApIHtcblx0XHRcdHZhciByZXNvdXJjZXNfYnlfaWQgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cblx0XHRcdCggQXJyYXkuaXNBcnJheSggcmVzb3VyY2VzICkgPyByZXNvdXJjZXMgOiBbXSApLmZvckVhY2goIGZ1bmN0aW9uICggcmVzb3VyY2UgKSB7XG5cdFx0XHRcdHZhciByZXNvdXJjZV9pZCA9IHBvc2l0aXZlX3Jlc291cmNlX2lkKCByZXNvdXJjZSAmJiByZXNvdXJjZS5pZCApO1xuXG5cdFx0XHRcdGlmICggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdFx0cmVzb3VyY2VzX2J5X2lkWyByZXNvdXJjZV9pZCBdID0gcmVzb3VyY2U7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoIG1vdW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXRpbWVsaW5lLXJlc291cmNlLWFjdGlvbnMtaG9zdF0nICksIGZ1bmN0aW9uICggaG9zdCApIHtcblx0XHRcdFx0dmFyIHJlc291cmNlX2lkID0gcG9zaXRpdmVfcmVzb3VyY2VfaWQoIGhvc3QuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXJlc291cmNlLWFjdGlvbnMtaG9zdCcgKSApO1xuXG5cdFx0XHRcdGlmICggcmVzb3VyY2VzX2J5X2lkWyByZXNvdXJjZV9pZCBdICkge1xuXHRcdFx0XHRcdHJlbmRlcl9yb3dfYWN0aW9ucyggaG9zdCwgcmVzb3VyY2VzX2J5X2lkWyByZXNvdXJjZV9pZCBdICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWxlYXNlIHJlcXVlc3RzLCBsaXN0ZW5lcnMsIGFuZCBzaGFyZWQgc2hlbGwgc3RhdGUuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG5cdFx0XHRpZiAoICEgaXNfaW5pdGlhbGl6ZWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGFib3J0X3JlYWQoKTtcblx0XHRcdGlzX2J1c3kgPSBmYWxzZTtcblx0XHRcdGlzX2RpcnR5ID0gZmFsc2U7XG5cdFx0XHRpZiAoIGluc3BlY3RvciAmJiBpbnNwZWN0b3IuaXNfb3BlbigpICkge1xuXHRcdFx0XHRpbnNwZWN0b3IuY2xvc2UoIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0XHRtb3VudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnd3BiYzpzaGFyZWQtdWktZHJvcGRvd24tY2hhbmdlJywgaGFuZGxlX2V2ZW50ICk7XG5cdFx0XHRpbnNwZWN0b3Jfcm9vdC5yZW1vdmVFdmVudExpc3RlbmVyKCAnc3VibWl0JywgaGFuZGxlX2V2ZW50ICk7XG5cdFx0XHRpbnNwZWN0b3Jfcm9vdC5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2xpY2snLCBoYW5kbGVfZXZlbnQgKTtcblx0XHRcdGluc3BlY3Rvcl9yb290LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBoYW5kbGVfZXZlbnQgKTtcblx0XHRcdGluc3BlY3Rvcl9yb290LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIGhhbmRsZV9ldmVudCApO1xuXHRcdFx0aWYgKCBtdXRhdGlvbl9yZXF1ZXN0ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBtdXRhdGlvbl9yZXF1ZXN0LmFib3J0ICkge1xuXHRcdFx0XHRtdXRhdGlvbl9yZXF1ZXN0LmFib3J0KCk7XG5cdFx0XHR9XG5cdFx0XHRtdXRhdGlvbl9yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdGluc3BlY3Rvcl9ob3N0LnRleHRDb250ZW50ID0gJyc7XG5cdFx0XHRpbnNwZWN0b3IgPSBudWxsO1xuXHRcdFx0aW5zcGVjdG9yX3Jvb3QgPSBudWxsO1xuXHRcdFx0aXNfaW5pdGlhbGl6ZWQgPSBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0aW5pdGlhbGl6ZTogaW5pdGlhbGl6ZSxcblx0XHRcdHJlZnJlc2g6IHJlZnJlc2gsXG5cdFx0XHRkZXN0cm95OiBkZXN0cm95XG5cdFx0fTtcblx0fVxuXG5cdGlmICggd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcy5yZWdpc3Rlcl9mYWN0b3J5ICkge1xuXHRcdHdpbmRvdy53cGJjX3RpbWVsaW5lX21vZHVsZXMucmVnaXN0ZXJfZmFjdG9yeSggbW9kdWxlX2lkLCBjcmVhdGVfcmVzb3VyY2Vfc2V0dGluZ3MgKTtcblx0fVxufSggd2luZG93LCBkb2N1bWVudCwgd2luZG93LndwICkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFLFdBQVdBLE1BQU0sRUFBRUMsUUFBUSxFQUFFQyxFQUFFLEVBQUc7RUFDbkMsWUFBWTs7RUFFWixJQUFJQyxTQUFTLEdBQUcsbUJBQW1CO0VBQ25DLElBQUlDLHFCQUFxQixHQUFHLGlDQUFpQztFQUM3RCxJQUFJQyxZQUFZLEdBQUcsU0FBUztFQUM1QixJQUFJQyxXQUFXLEdBQUcsUUFBUTs7RUFFMUI7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTQyxXQUFXQSxDQUFFQyxJQUFJLEVBQUVDLE1BQU0sRUFBRztJQUNwQ0MsTUFBTSxDQUFDQyxJQUFJLENBQUVGLE1BQU0sSUFBSSxDQUFDLENBQUUsQ0FBQyxDQUFDRyxP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
