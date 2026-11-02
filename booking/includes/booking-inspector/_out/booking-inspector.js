"use strict";

/**
 * Reusable Booking Inspector domain adapter.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
(function (window, document, wp) {
  'use strict';

  /**
   * Resolve an allow-listed WordPress template renderer.
   *
   * @param {string} template_id Server-declared template identifier.
   * @return {Function|null} Template renderer or null.
   */
  function get_template(template_id) {
    return template_id && wp && 'function' === typeof wp.template ? wp.template(template_id) : null;
  }

  /**
   * Initialize one rendered tab set.
   *
   * Arrow keys follow the WAI-ARIA tabs pattern while Tab continues into the
   * active panel. Tab selection itself never changes booking data.
   *
   * @param {HTMLElement} inspector_root Rendered booking-domain Inspector.
   * @param {string}      initial_tab    Stable tab identifier to activate initially.
   * @return {void}
   */
  function initialize_tabs(inspector_root, initial_tab) {
    var tablist = inspector_root ? inspector_root.querySelector('[role="tablist"]') : null;
    var tabs = tablist ? Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]')) : [];
    var panels = inspector_root ? Array.prototype.slice.call(inspector_root.querySelectorAll('[role="tabpanel"]')) : [];
    if (!tablist || !tabs.length || !panels.length) {
      return;
    }

    /**
     * Activate one available tab and its controlled panel.
     *
     * @param {HTMLElement} tab        Tab button to activate.
     * @param {boolean}     move_focus Whether keyboard focus follows activation.
     * @return {void}
     */
    function activate_tab(tab, move_focus) {
      var controlled_panel_id = tab.getAttribute('aria-controls');
      tabs.forEach(function (candidate_tab) {
        var is_active = candidate_tab === tab;
        candidate_tab.setAttribute('aria-selected', is_active ? 'true' : 'false');
        candidate_tab.setAttribute('tabindex', is_active ? '0' : '-1');
      });
      panels.forEach(function (panel) {
        panel.hidden = panel.id !== controlled_panel_id;
      });
      if (move_focus) {
        tab.focus();
      }
    }
    if (initial_tab) {
      tabs.some(function (candidate_tab) {
        if (initial_tab !== candidate_tab.getAttribute('data-wpbc-booking-inspector-tab')) {
          return false;
        }
        activate_tab(candidate_tab, false);
        return true;
      });
    }
    tablist.addEventListener('click', function (event) {
      var tab = event.target.closest('[role="tab"]');
      if (tab && tablist.contains(tab)) {
        activate_tab(tab, false);
      }
    });
    inspector_root.addEventListener('click', function (event) {
      var tab_action = event.target.closest('[data-wpbc-booking-inspector-open-tab]');
      var requested_tab;
      var target_tab;
      if (!tab_action || !inspector_root.contains(tab_action)) {
        return;
      }
      requested_tab = tab_action.getAttribute('data-wpbc-booking-inspector-open-tab');
      target_tab = tabs.find(function (candidate_tab) {
        return requested_tab === candidate_tab.getAttribute('data-wpbc-booking-inspector-tab');
      });
      if (target_tab) {
        event.preventDefault();
        activate_tab(target_tab, true);
      }
    });
    tablist.addEventListener('keydown', function (event) {
      var current_index = tabs.indexOf(event.target);
      var next_index = current_index;
      if (-1 === current_index) {
        return;
      }
      if ('ArrowRight' === event.key || 'ArrowDown' === event.key) {
        next_index = (current_index + 1) % tabs.length;
      } else if ('ArrowLeft' === event.key || 'ArrowUp' === event.key) {
        next_index = (current_index - 1 + tabs.length) % tabs.length;
      } else if ('Home' === event.key) {
        next_index = 0;
      } else if ('End' === event.key) {
        next_index = tabs.length - 1;
      } else {
        return;
      }
      event.preventDefault();
      activate_tab(tabs[next_index], true);
    });
  }

  /**
   * Create one Booking Inspector adapter for a host view.
   *
   * The adapter owns booking transport, local template rendering, stale-request
   * protection, and active booking-trigger state. The shared Inspector API owns
   * only the shell lifecycle and focus behavior.
   *
   * @param {HTMLElement} host_root     View root containing booking triggers.
   * @param {HTMLElement} shell_host    Empty host for the shared shell template.
   * @param {Object}      configuration Server-owned booking domain configuration.
   * @param {Object}      options       Host presentation options.
   * @return {Object|null} Adapter API or null when required contracts are absent.
   */
  function create(host_root, shell_host, configuration, options) {
    var settings = configuration && 'object' === typeof configuration ? configuration : {};
    var host_options = options && 'object' === typeof options ? options : {};
    var i18n = settings.i18n && 'object' === typeof settings.i18n ? settings.i18n : {};
    var templates = settings.templates && 'object' === typeof settings.templates ? settings.templates : {};
    var transport = settings.transport && 'object' === typeof settings.transport ? settings.transport : {};
    var shell_template = get_template(templates.shell);
    var details_template = get_template(templates.details);
    var header_template = get_template(templates.header);
    var resource_template = get_template(templates.resource);
    var tabs_template = get_template(templates.tabs);
    var booking_fields_template = get_template(templates.booking_fields);
    var booking_field_row_template = get_template(templates.booking_field_row);
    var dates_template = get_template(templates.dates);
    var costs_template = get_template(templates.costs);
    var notes_template = get_template(templates.notes);
    var system_information_template = get_template(templates.system_information);
    var activity_template = get_template(templates.activity);
    var footer_template = get_template(templates.footer);
    var state_template = get_template(templates.state);
    var trigger_selector = host_options.trigger_selector || '[data-wpbc-booking-inspector-trigger]';
    var active_class = host_options.active_class || 'is-booking-inspector-open';
    var activation_mode = 'manual' === host_options.activation_mode ? 'manual' : 'delegated';
    var owns_trigger_aria = false !== host_options.owns_trigger_aria;
    var focus_selector = 'string' === typeof host_options.focus_selector ? host_options.focus_selector : '';
    var shared_inspector;
    var date_editor_controller = null;
    var rescheduling_controller = null;
    var shell_root;
    var active_trigger_id = '';
    var active_booking_id = 0;
    var host_refresh_generation = 0;
    var request = null;
    var save_request = null;
    var activity_request = null;
    var request_generation = 0;
    var save_request_generation = 0;
    var activity_request_generation = 0;
    var save_feedback_timer = null;
    var save_success_message_duration_ms = 5000;
    var active_booking = null;
    var pending_booking_actions = {};
    var clean_draft_json = '';
    var is_dirty = false;
    var is_saving = false;
    var saved_event_name = 'wpbc:booking-inspector:saved';

    /**
     * Read the live notification choice owned by the current administration view.
     *
     * The value is read immediately before each mutation so changing the Timeline
     * switch after opening an Inspector or Review still controls that operation.
     *
     * @return {number} One when the current operation requests email; otherwise zero.
     */
    function get_send_modified_email_intent() {
      var notification_toggle = document.querySelector('[data-wpbc-send-modified-email]') || document.getElementById('is_send_email_for_pending') || document.getElementById('ui_usr__send_emails');
      return notification_toggle && notification_toggle.checked ? 1 : 0;
    }

    /**
     * Keep established Booking Actions aligned with the Timeline notification switch.
     *
     * @return {void}
     */
    function synchronize_listing_notification_intent() {
      if (window.wpbc_ajx_booking_listing && 'function' === typeof window.wpbc_ajx_booking_listing.search_set_param) {
        window.wpbc_ajx_booking_listing.search_set_param('ui_usr__send_emails', get_send_modified_email_intent() ? 'send' : 'not_send');
      }
    }

    /**
     * Synchronize an in-page notification-toggle change without reloading Timeline.
     *
     * @param {Event} event Native change event.
     * @return {void}
     */
    function handle_notification_intent_change(event) {
      if (event.target && event.target.matches('[data-wpbc-send-modified-email], #is_send_email_for_pending, #ui_usr__send_emails')) {
        synchronize_listing_notification_intent();
      }
    }
    if (!host_root || !shell_host || !shell_template || !details_template || !header_template || !resource_template || !tabs_template || !booking_fields_template || !booking_field_row_template || !dates_template || !costs_template || !notes_template || !system_information_template || !activity_template || !footer_template || !state_template || !window.wpbc_shared_ui_inspector || 'function' !== typeof window.wpbc_shared_ui_inspector.create) {
      return null;
    }
    shell_host.innerHTML = shell_template({
      id: settings.component_id || 'wpbc_booking_inspector',
      title: i18n.title || '',
      close_label: i18n.close_label || '',
      loading_label: i18n.loading || ''
    });
    shell_root = shell_host.querySelector('[data-wpbc-shared-ui-inspector]');
    if (!shell_root) {
      return null;
    }
    shell_root.classList.add('wpbc_booking_inspector_shell');
    if (window.wpbc_ajx_booking_listing && 'function' === typeof window.wpbc_ajx_booking_listing.set_secure_param) {
      window.wpbc_ajx_booking_listing.set_secure_param('nonce', transport.listing_action_nonce || '');
      window.wpbc_ajx_booking_listing.set_secure_param('user_id', transport.listing_action_user_id || 0);
      window.wpbc_ajx_booking_listing.set_secure_param('locale', transport.listing_action_locale || '');
    }
    synchronize_listing_notification_intent();
    document.addEventListener('change', handle_notification_intent_change, true);

    /**
     * Abort the active read and invalidate every pending callback.
     *
     * @return {void}
     */
    function abort_request() {
      request_generation += 1;
      save_request_generation += 1;
      activity_request_generation += 1;
      clear_save_feedback_timer();
      if (request && 'function' === typeof request.abort) {
        request.abort();
      }
      request = null;
      if (save_request && 'function' === typeof save_request.abort) {
        save_request.abort();
      }
      save_request = null;
      if (activity_request && 'function' === typeof activity_request.abort) {
        activity_request.abort();
      }
      activity_request = null;
      is_saving = false;
    }

    /**
     * Cancel a pending success-message timeout.
     *
     * Save progress, errors, a new booking, and Inspector closure must not be
     * affected by a timer created for an earlier successful request.
     *
     * @return {void}
     */
    function clear_save_feedback_timer() {
      if (null !== save_feedback_timer) {
        window.clearTimeout(save_feedback_timer);
        save_feedback_timer = null;
      }
    }

    /**
     * Return one trigger's stable host identity.
     *
     * @param {HTMLElement} trigger Booking trigger.
     * @return {string} Stable identity or an empty string.
     */
    function get_trigger_id(trigger) {
      return trigger && trigger.getAttribute ? String(trigger.getAttribute('data-wpbc-booking-inspector-trigger-id') || '') : '';
    }

    /**
     * Return the canonical booking identifier represented by a host trigger.
     *
     * Host markup may derive its visual segment identity from dates. Booking ID
     * remains stable when a successful date mutation replaces that segment.
     *
     * @param {HTMLElement} trigger Booking trigger.
     * @return {number} Positive booking identifier or zero.
     */
    function get_trigger_booking_id(trigger) {
      return trigger && trigger.getAttribute ? Number(trigger.getAttribute('data-wpbc-booking-id') || 0) : 0;
    }

    /**
     * Remove the open state from every rendered booking trigger.
     *
     * @return {void}
     */
    function clear_active_trigger() {
      Array.prototype.forEach.call(host_root.querySelectorAll(trigger_selector), function (trigger) {
        trigger.classList.remove(active_class);
        if (owns_trigger_aria) {
          trigger.setAttribute('aria-expanded', 'false');
        }
      });
      active_trigger_id = '';
      active_booking_id = 0;
    }

    /**
     * Mark one rendered trigger as the booking displayed in the Inspector.
     *
     * @param {HTMLElement} trigger Booking trigger.
     * @return {void}
     */
    function set_active_trigger(trigger) {
      var trigger_id = get_trigger_id(trigger);
      var booking_id = get_trigger_booking_id(trigger);
      clear_active_trigger();
      if (!trigger_id || !booking_id) {
        return;
      }
      active_trigger_id = trigger_id;
      active_booking_id = booking_id;
      trigger.classList.add(active_class);
      if (owns_trigger_aria) {
        trigger.setAttribute('aria-expanded', 'true');
      }
    }

    /**
     * Restore active presentation after the host replaces booking markup.
     *
     * @return {void}
     */
    function refresh() {
      if (!active_trigger_id || !active_booking_id) {
        return;
      }
      Array.prototype.some.call(host_root.querySelectorAll(trigger_selector), function (trigger) {
        if (active_trigger_id !== get_trigger_id(trigger) && active_booking_id !== get_trigger_booking_id(trigger)) {
          return false;
        }
        active_trigger_id = get_trigger_id(trigger);
        trigger.classList.add(active_class);
        if (owns_trigger_aria) {
          trigger.setAttribute('aria-expanded', 'true');
        }
        return true;
      });
    }

    /**
     * Find the currently active trigger in the latest host markup.
     *
     * The host may replace booking segments while the Inspector is open. The
     * shared shell therefore cannot always restore focus to the original DOM
     * node; the domain adapter resolves the equivalent current trigger.
     *
     * @return {HTMLElement|null} Current active trigger or null.
     */
    function get_active_trigger() {
      var active_trigger = null;
      if (!active_trigger_id || !active_booking_id) {
        return null;
      }
      Array.prototype.some.call(host_root.querySelectorAll(trigger_selector), function (trigger) {
        if (active_trigger_id !== get_trigger_id(trigger) && active_booking_id !== get_trigger_booking_id(trigger)) {
          return false;
        }
        active_trigger_id = get_trigger_id(trigger);
        active_trigger = trigger;
        return true;
      });
      return active_trigger;
    }

    /**
     * Resolve the focusable control associated with one host identity element.
     *
     * Manual hosts may keep Inspector identity on a non-interactive group while
     * exposing a separate native selection control. Delegated hosts continue to
     * restore focus to their trigger itself.
     *
     * @param {HTMLElement|null} trigger Current host identity element.
     * @return {HTMLElement|null} Connected focus target or null.
     */
    function get_trigger_focus_target(trigger) {
      var focus_target = trigger;
      if (trigger && focus_selector) {
        focus_target = trigger.querySelector(focus_selector) || trigger;
      }
      return focus_target && focus_target.isConnected ? focus_target : null;
    }

    /**
     * Find the current Change dates control after a host or Inspector rerender.
     *
     * @return {HTMLElement|null} Current Date Editor opener or booking trigger.
     */
    function get_date_editor_restore_focus() {
      var change_dates_button = shell_root.querySelector('[data-wpbc-booking-date-editor-open]');
      return change_dates_button || get_trigger_focus_target(get_active_trigger());
    }

    /**
     * Find the current Reschedule control after an Inspector rerender.
     *
     * @return {HTMLElement|null} Current opener or booking trigger.
     */
    function get_rescheduling_restore_focus() {
      var reschedule_button = shell_root.querySelector('[data-wpbc-booking-rescheduling-open]');
      return reschedule_button || get_trigger_focus_target(get_active_trigger());
    }

    /**
     * Reconcile booking-domain state after the shared shell closes.
     *
     * @return {void}
     */
    function handle_close() {
      var current_trigger = get_trigger_focus_target(get_active_trigger());
      if (date_editor_controller) {
        date_editor_controller.force_close();
      }
      if (rescheduling_controller) {
        rescheduling_controller.force_close();
      }
      abort_request();
      clear_active_trigger();
      active_booking = null;
      clean_draft_json = '';
      is_dirty = false;
      if (current_trigger) {
        window.setTimeout(function () {
          if (document.contains(current_trigger)) {
            current_trigger.focus();
          }
        }, 0);
      }
    }
    shared_inspector = window.wpbc_shared_ui_inspector.create(shell_root, {
      on_close: handle_close,
      on_before_close: function () {
        if (rescheduling_controller && rescheduling_controller.is_busy && rescheduling_controller.is_busy()) {
          return rescheduling_controller.confirm_discard();
        }
        if (rescheduling_controller && rescheduling_controller.is_dirty()) {
          return is_dirty ? window.confirm(i18n.discard_changes || '') : rescheduling_controller.confirm_discard();
        }
        if (date_editor_controller && date_editor_controller.is_dirty()) {
          return is_dirty ? window.confirm(i18n.discard_changes || '') : date_editor_controller.confirm_discard();
        }
        return !is_dirty || window.confirm(i18n.discard_changes || '');
      }
    });
    if (!shared_inspector) {
      return null;
    }
    if (window.wpbc_booking_date_editor && 'function' === typeof window.wpbc_booking_date_editor.create_controller) {
      date_editor_controller = window.wpbc_booking_date_editor.create_controller(shell_root, settings.date_editor || {}, {
        url: transport.url || '',
        source: transport.source || '',
        get_restore_focus: get_date_editor_restore_focus,
        on_applied: handle_date_editor_applied,
        get_send_modified_email_intent: get_send_modified_email_intent
      });
    }
    if (window.wpbc_booking_rescheduling && 'function' === typeof window.wpbc_booking_rescheduling.create_controller) {
      rescheduling_controller = window.wpbc_booking_rescheduling.create_controller(shell_root, settings.rescheduling || {}, {
        url: transport.url || '',
        source: transport.source || '',
        get_restore_focus: get_rescheduling_restore_focus,
        on_applied: handle_date_editor_applied,
        get_send_modified_email_intent: get_send_modified_email_intent
      });
    }

    /**
     * Return the currently selected tab identifier.
     *
     * @return {string} Active tab identifier.
     */
    function get_active_tab() {
      var selected_tab = shell_root.querySelector('[data-wpbc-booking-inspector-tab][aria-selected="true"]');
      return selected_tab ? String(selected_tab.getAttribute('data-wpbc-booking-inspector-tab') || '') : 'details';
    }

    /**
     * Collect one schema field from the full Booking Details panel.
     *
     * @param {HTMLElement} fields_root Full field-list root.
     * @param {Object}      field       Authorized field DTO.
     * @return {string|Array} Scalar or repeated draft value.
     */
    function collect_field_value(fields_root, field) {
      var controls = fields_root ? Array.prototype.slice.call(fields_root.querySelectorAll('[data-wpbc-booking-field="' + field.key + '"]')) : [];
      var values;
      if ('checkbox' === field.type || 'acceptance' === field.type) {
        values = controls.filter(function (control) {
          return control.checked;
        }).map(function (control) {
          return control.value;
        });
        return values;
      }
      if ('radio' === field.type) {
        values = controls.filter(function (control) {
          return control.checked;
        });
        return values.length ? values[0].value : '';
      }
      if ('text' === field.type && field.multiple) {
        return controls.map(function (control) {
          return control.value;
        });
      }
      if (controls.length && controls[0].multiple) {
        return Array.prototype.filter.call(controls[0].options, function (option) {
          return option.selected;
        }).map(function (option) {
          return option.value;
        });
      }
      return controls.length ? controls[0].value : '';
    }

    /**
     * Collect the complete data-only Inspector draft.
     *
     * @return {Object} Booking field, note, and financial draft.
     */
    function collect_draft() {
      var inspector_root = shell_root.querySelector('.wpbc_booking_inspector');
      var fields_root = inspector_root ? inspector_root.querySelector('[data-wpbc-booking-details-fields]') : null;
      var draft = {
        fields: {},
        notes: {},
        costs: {}
      };
      if (!inspector_root || !active_booking) {
        return draft;
      }
      (active_booking.fields || []).forEach(function (field) {
        if ('file' !== field.type && false !== field.editable) {
          draft.fields[field.key] = collect_field_value(fields_root, field);
        }
      });
      Array.prototype.forEach.call(inspector_root.querySelectorAll('[data-wpbc-booking-note]'), function (control) {
        if (!control.readOnly) {
          draft.notes[control.getAttribute('data-wpbc-booking-note')] = control.value;
        }
      });
      ['saved_cost', 'payment_status'].forEach(function (cost_key) {
        var control = inspector_root.querySelector('[data-wpbc-booking-cost="' + cost_key + '"]:not([disabled])');
        if (control && !control.readOnly) {
          draft.costs[cost_key] = control.value;
        }
      });
      return draft;
    }

    /**
     * Identify fields whose authoritative persisted values changed after save.
     *
     * The returned DTO is authoritative. Comparing it with the previously loaded
     * DTO avoids marking submitted values that the server normalized back to the
     * canonical value.
     *
     * @param {Object} previous_booking Previously loaded authorized booking DTO.
     * @param {Object} saved_booking    Authoritative post-save booking DTO.
     * @return {Array<string>} Ordered changed field keys present after save.
     */
    function get_changed_field_keys(previous_booking, saved_booking) {
      var previous_values = {};
      (previous_booking && previous_booking.fields ? previous_booking.fields : []).forEach(function (field) {
        previous_values[field.key] = JSON.stringify(field.values || []);
      });
      return (saved_booking && saved_booking.fields ? saved_booking.fields : []).filter(function (field) {
        return Object.prototype.hasOwnProperty.call(previous_values, field.key) && previous_values[field.key] !== JSON.stringify(field.values || []);
      }).map(function (field) {
        return field.key;
      });
    }

    /**
     * Notify the active host that an authoritative booking mutation completed.
     *
     * The event exposes only stable identifiers and changed field keys. Timeline,
     * Booking Listing, and future hosts remain responsible for refreshing through
     * their own canonical read workflow. An empty changed-field list represents a
     * canonical Booking Listing action whose extensible action contract does not
     * expose an exact field-level diff.
     *
     * @param {Object}        saved_booking      Authoritative post-save booking DTO.
     * @param {Array<string>} changed_field_keys Persisted fields changed by the save.
     * @return {void}
     */
    function dispatch_booking_saved(saved_booking, changed_field_keys) {
      var event_detail;
      var saved_event;
      host_refresh_generation += 1;
      event_detail = {
        booking_id: Number(saved_booking && saved_booking.booking_id ? saved_booking.booking_id : 0),
        source: transport.source || '',
        changed_field_keys: changed_field_keys.slice(0),
        refresh_generation: host_refresh_generation
      };
      if ('function' === typeof window.CustomEvent) {
        saved_event = new window.CustomEvent(saved_event_name, {
          bubbles: true,
          detail: event_detail
        });
      } else {
        saved_event = document.createEvent('CustomEvent');
        saved_event.initCustomEvent(saved_event_name, true, false, event_detail);
      }
      host_root.dispatchEvent(saved_event);
    }

    /**
     * Reread and render one booking after Date Editor persistence succeeds.
     *
     * The apply response is intentionally never rendered as Inspector state.
     * Dates Overview and Activity are replaced only by the authorized Inspector
     * DTO. The returned promise resolves after that canonical render, allowing
     * the Date Editor to retain dirty protection when readback fails.
     *
     * @param {Object}  apply_result         Minimal canonical Apply result.
     * @param {boolean} dispatch_saved_event Whether the host must receive a save event.
     * @return {Object} jQuery-compatible promise resolving with the booking DTO.
     */
    function handle_date_editor_applied(apply_result, dispatch_saved_event) {
      var deferred = window.jQuery.Deferred();
      var expected_booking_id = Number(apply_result && apply_result.booking_id ? apply_result.booking_id : 0);
      var previous_resource_id = Number(active_booking && active_booking.resource_id ? active_booking.resource_id : 0);
      var preserved_tab = get_active_tab();
      var generation;
      var pending_readback_request;
      if (!expected_booking_id || !active_booking || expected_booking_id !== Number(active_booking.booking_id || 0) || expected_booking_id !== active_booking_id || !shared_inspector.is_open() || !window.jQuery || !transport.url || !transport.action || !transport.nonce || is_dirty || is_saving) {
        deferred.reject({
          message: i18n.error || ''
        });
        return deferred.promise();
      }
      abort_request();
      generation = request_generation;
      pending_readback_request = window.jQuery.ajax({
        url: transport.url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: transport.action,
          nonce: transport.nonce,
          booking_id: expected_booking_id,
          source: transport.source
        }
      }).done(function (response) {
        var canonical_booking;
        if (generation !== request_generation || !shared_inspector.is_open() || !response || !response.success || !response.data || !response.data.booking) {
          deferred.reject({
            message: i18n.error || ''
          });
          return;
        }
        canonical_booking = response.data.booking;
        if (expected_booking_id !== Number(canonical_booking.booking_id || 0) || expected_booking_id !== active_booking_id) {
          deferred.reject({
            message: i18n.error || ''
          });
          return;
        }
        render_booking(canonical_booking, i18n.saved || '', preserved_tab);
        if (apply_result.changed && false !== dispatch_saved_event) {
          var changed_field_keys = ['booking_dates'];
          if (previous_resource_id && previous_resource_id !== Number(canonical_booking.resource_id || 0)) {
            changed_field_keys.push('booking_resource');
          }
          dispatch_booking_saved(canonical_booking, changed_field_keys);
        }
        deferred.resolve(canonical_booking);
      }).fail(function (failed_request, request_status) {
        if ('abort' === request_status || generation !== request_generation) {
          deferred.reject({
            message: i18n.error || ''
          });
          return;
        }
        deferred.reject({
          message: get_save_error_message(failed_request, '')
        });
      }).always(function () {
        if (request === pending_readback_request) {
          request = null;
        }
      });
      request = pending_readback_request;
      return deferred.promise();
    }

    /**
     * Reread an open matching Inspector after an external canonical mutation.
     *
     * Closed or unrelated Inspectors resolve without work. The caller already
     * owns Timeline and Overview refresh, so this readback deliberately does
     * not dispatch the normal Inspector-saved host event.
     *
     * @param {Object} apply_result Canonical Apply result.
     * @return {Object} jQuery-compatible promise for the optional readback.
     */
    function refresh_after_external_apply(apply_result) {
      var deferred = window.jQuery.Deferred();
      var booking_id = Number(apply_result && apply_result.booking_id ? apply_result.booking_id : 0);
      if (!booking_id || booking_id !== active_booking_id || !shared_inspector.is_open()) {
        deferred.resolve();
        return deferred.promise();
      }
      return handle_date_editor_applied(apply_result, false);
    }

    /**
     * Update footer controls from the current draft state.
     *
     * @return {void}
     */
    function update_dirty_state() {
      var inspector_root = shell_root.querySelector('.wpbc_booking_inspector');
      var save_button = inspector_root ? inspector_root.querySelector('[data-wpbc-booking-inspector-save]') : null;
      var cancel_button = inspector_root ? inspector_root.querySelector('[data-wpbc-booking-inspector-cancel]') : null;
      is_dirty = JSON.stringify(collect_draft()) !== clean_draft_json;
      if (save_button) {
        save_button.disabled = !is_dirty || is_saving;
      }
      if (cancel_button) {
        cancel_button.disabled = !is_dirty || is_saving;
      }
    }

    /**
     * Temporarily lock controls that belong to the submitted booking draft.
     *
     * Only controls that were enabled before the request receive the marker, so
     * server-disabled controls remain disabled after failure.
     * This prevents an in-flight edit from being silently replaced by the
     * authoritative DTO returned for an earlier submitted draft.
     *
     * @param {boolean} is_locked Whether the submitted draft is being saved.
     * @return {void}
     */
    function set_draft_controls_locked(is_locked) {
      var inspector_root = shell_root.querySelector('.wpbc_booking_inspector');
      var controls = inspector_root ? inspector_root.querySelectorAll('[data-wpbc-booking-field], [data-wpbc-booking-note], [data-wpbc-booking-cost]') : [];
      Array.prototype.forEach.call(controls, function (control) {
        if (is_locked && !control.disabled) {
          control.setAttribute('data-wpbc-booking-inspector-save-lock', 'true');
          control.disabled = true;
        } else if (!is_locked && control.hasAttribute('data-wpbc-booking-inspector-save-lock')) {
          control.removeAttribute('data-wpbc-booking-inspector-save-lock');
          control.disabled = false;
        }
      });
    }

    /**
     * Present one booking-save state in the domain-owned sticky footer.
     *
     * The button exposes its busy state separately from the live result message,
     * so sighted and assistive-technology users receive the same progress and
     * completion feedback without adding booking behavior to the shared shell.
     *
     * @param {string} state   Stable idle, saving, success, or error state.
     * @param {string} message Localized safe status or error message.
     * @return {void}
     */
    function set_save_feedback(state, message) {
      var inspector_root = shell_root.querySelector('.wpbc_booking_inspector');
      var save_button = inspector_root ? inspector_root.querySelector('[data-wpbc-booking-inspector-save]') : null;
      var save_label = save_button ? save_button.querySelector('[data-wpbc-booking-inspector-save-label]') : null;
      var save_spinner = save_button ? save_button.querySelector('[data-wpbc-booking-inspector-save-spinner]') : null;
      var status_message = inspector_root ? inspector_root.querySelector('[data-wpbc-booking-inspector-message]') : null;
      var is_busy = 'saving' === state;
      var safe_message = String(message || '');
      clear_save_feedback_timer();
      if (inspector_root) {
        inspector_root.setAttribute('aria-busy', is_busy ? 'true' : 'false');
      }
      if (save_button) {
        save_button.setAttribute('aria-busy', is_busy ? 'true' : 'false');
        save_button.classList.toggle('is-saving', is_busy);
      }
      if (save_label) {
        save_label.textContent = is_busy ? i18n.saving_button || i18n.saving || i18n.save_changes || '' : i18n.save_changes || '';
      }
      if (save_spinner) {
        save_spinner.hidden = !is_busy;
      }
      if (status_message) {
        status_message.hidden = !safe_message;
        status_message.textContent = safe_message;
        status_message.classList.toggle('is-success', 'success' === state);
        status_message.classList.toggle('is-error', 'error' === state);
        status_message.setAttribute('role', 'error' === state ? 'alert' : 'status');
        status_message.setAttribute('aria-live', 'error' === state ? 'assertive' : 'polite');
      }
      if ('success' === state && safe_message) {
        save_feedback_timer = window.setTimeout(function () {
          var current_message;
          save_feedback_timer = null;
          if (!shared_inspector.is_open()) {
            return;
          }
          current_message = shell_root.querySelector('[data-wpbc-booking-inspector-message].is-success');
          if (current_message) {
            set_save_feedback('idle', '');
          }
        }, save_success_message_duration_ms);
      }
    }

    /**
     * Read one safe message from the normalized WordPress AJAX error contract.
     *
     * Raw response text is intentionally ignored because a failed PHP request may
     * contain sensitive diagnostics or markup that does not belong in the UI.
     *
     * @param {Object} failed_request   jQuery AJAX request carrying responseJSON.
     * @param {string} fallback_message Optional localized fallback.
     * @return {string} Server-provided safe reason or the localized fallback.
     */
    function get_save_error_message(failed_request, fallback_message) {
      var response = failed_request && failed_request.responseJSON ? failed_request.responseJSON : {};
      var error_data = response && response.data ? response.data : {};
      if (Array.isArray(error_data)) {
        error_data = error_data.length ? error_data[0] : {};
      }
      if (error_data && 'string' === typeof error_data.message && error_data.message) {
        return error_data.message;
      }
      if (response && 'string' === typeof response.message && response.message) {
        return response.message;
      }
      return 'string' === typeof fallback_message ? fallback_message : i18n.save_error || '';
    }

    /**
     * Render one standardized booking-domain state.
     *
     * @param {string}  state   Stable loading, empty, unsupported, or error state.
     * @param {string}  message Localized safe state message.
     * @param {boolean} is_busy Whether the shared shell remains busy.
     * @return {void}
     */
    function render_state(state, message, is_busy) {
      if ('loading' === state) {
        shared_inspector.set_loading(message || '');
        return;
      }
      var icon_classes = {
        empty: 'wpbc-bi-inbox',
        unsupported: 'wpbc-bi-info-circle',
        error: 'wpbc-bi-exclamation-triangle'
      };
      var rendered_state = state_template({
        state: state,
        message: message || '',
        icon_class: icon_classes[state] || ''
      });
      if ('function' === typeof shared_inspector.set_state) {
        shared_inspector.set_state(rendered_state, message || '', Boolean(is_busy));
      } else {
        shared_inspector.set_content(rendered_state, message || '');
      }
    }

    /**
     * Compose all allow-listed booking-domain templates for one DTO.
     *
     * @param {Object} booking_dto Authorized booking DTO.
     * @param {Array<string>} recently_changed_field_keys Fields changed by the completed save.
     * @return {string} Complete Inspector article markup.
     */
    function render_booking_templates(booking_dto, recently_changed_field_keys) {
      var view_data = Object.assign({}, booking_dto, {
        i18n: i18n
      });
      var changed_field_keys = Array.isArray(recently_changed_field_keys) ? recently_changed_field_keys : [];
      var inspector_id = 'wpbc_booking_inspector_' + Number(booking_dto.booking_id || 0);
      var costs_supported = Boolean(booking_dto.costs && booking_dto.costs.supported);
      var activity = booking_dto.activity && booking_dto.activity.events ? booking_dto.activity : {
        events: [],
        pagination: {}
      };
      var empty_state_html = state_template({
        state: 'empty',
        message: i18n.not_available || '',
        icon_class: 'wpbc-bi-inbox'
      });
      var notes_empty_state_html = state_template({
        state: 'empty',
        message: i18n.no_notes || '',
        icon_class: 'wpbc-bi-inbox'
      });
      var activity_empty_state_html = state_template({
        state: 'empty',
        message: i18n.no_activity || '',
        icon_class: 'wpbc-bi-inbox'
      });
      var field_rows_html = (booking_dto.fields || []).map(function (field, field_index) {
        return booking_field_row_template({
          field: field,
          field_id: inspector_id + '_field_' + field_index,
          can_edit_fields: Boolean(booking_dto.actions && booking_dto.actions.can_edit_fields),
          recently_changed: -1 !== changed_field_keys.indexOf(field.key),
          i18n: i18n
        });
      }).join('');
      var notes_html = notes_template(Object.assign({}, view_data, {
        empty_state_html: notes_empty_state_html
      }));
      var system_information_html = system_information_template(view_data);
      var intervals = booking_dto.dates && Array.isArray(booking_dto.dates.intervals) ? booking_dto.dates.intervals : [];
      var header_duration_label = 1 === intervals.length && intervals[0].duration_label ? intervals[0].duration_label : booking_dto.dates && booking_dto.dates.summary ? booking_dto.dates.summary.selected_dates_label : '';
      var header_view_data = Object.assign({}, view_data, {
        costs_supported: costs_supported,
        header_duration_label: header_duration_label
      });
      var footer_view_data = Object.assign({}, booking_dto.action_context || {}, {
        can_update: Boolean(booking_dto.actions && booking_dto.actions.can_update),
        i18n: i18n
      });
      return details_template({
        booking_id: booking_dto.booking_id,
        header_html: header_template(view_data),
        resource_html: resource_template(header_view_data),
        tabs_html: tabs_template({
          inspector_id: inspector_id,
          costs_supported: costs_supported,
          i18n: i18n
        }),
        booking_fields_html: booking_fields_template(Object.assign({}, view_data, {
          inspector_id: inspector_id,
          field_rows_html: field_rows_html,
          empty_state_html: empty_state_html,
          notes_html: notes_html,
          system_information_html: system_information_html
        })),
        dates_html: dates_template(Object.assign({}, view_data, {
          inspector_id: inspector_id,
          empty_state_html: empty_state_html
        })),
        costs_html: costs_supported ? costs_template(Object.assign({}, view_data, {
          inspector_id: inspector_id,
          costs_supported: true
        })) : '',
        activity_html: activity_template(Object.assign({}, view_data, {
          inspector_id: inspector_id,
          activity: activity,
          empty_state_html: activity_empty_state_html
        })),
        footer_html: footer_template(footer_view_data)
      });
    }

    /**
     * Render an authoritative DTO and initialize its local interactions.
     *
     * @param {Object} booking_dto Authorized booking DTO.
     * @param {string} announcement Accessible completion announcement.
     * @param {string} initial_tab Tab to preserve after a refresh.
     * @param {Array<string>} recently_changed_field_keys Fields changed by the completed save.
     * @return {void}
     */
    function render_booking(booking_dto, announcement, initial_tab, recently_changed_field_keys) {
      var inspector_root;
      var domain_header;
      var status_label = booking_dto.status && booking_dto.status.label ? booking_dto.status.label : '';
      var accessible_title = (i18n.booking_number || i18n.title || '') + ': ' + booking_dto.booking_id;
      active_booking = booking_dto;
      shared_inspector.set_content(render_booking_templates(booking_dto, recently_changed_field_keys), announcement || '');
      inspector_root = shell_root.querySelector('.wpbc_booking_inspector');
      domain_header = inspector_root ? inspector_root.querySelector('[data-wpbc-booking-inspector-header]') : null;
      if (status_label) {
        accessible_title += ', ' + status_label;
      }
      if (domain_header && 'function' === typeof shared_inspector.set_header) {
        shared_inspector.set_header(domain_header.innerHTML, accessible_title);
        domain_header.remove();
      }
      initialize_action_resource_dialogs(booking_dto.action_context || {});
      initialize_tabs(inspector_root, initial_tab || 'details');
      clean_draft_json = JSON.stringify(collect_draft());
      is_dirty = false;
      update_dirty_state();
    }

    /**
     * Populate canonical Listing Resource dialogs for every Inspector host.
     *
     * Booking Listing normally renders these controls after its search request.
     * Inspector hosts instead consume the authorized Resource choices included in
     * the booking details DTO, so no host needs to copy Resource resolution.
     *
     * @param {Object} action_context Authorized canonical action context.
     * @return {void}
     */
    function initialize_action_resource_dialogs(action_context) {
      var resources = Array.isArray(action_context.booking_resources) ? action_context.booking_resources : [];
      var dialog_templates = [{
        target: 'section_in_in_modal__change_booking_resource',
        template: 'wpbc_ajx__modal__change_booking_resource'
      }, {
        target: 'section_in_in_modal__duplicate_booking_to_other_resource',
        template: 'wpbc_ajx__modal__duplicate_booking_to_other_resource'
      }];
      if (!window.wp || 'function' !== typeof window.wp.template) {
        return;
      }
      dialog_templates.forEach(function (dialog_template) {
        var target = document.getElementById(dialog_template.target);
        var template_node = document.getElementById('tmpl-' + dialog_template.template);
        if (!target || !template_node) {
          return;
        }
        target.innerHTML = window.wp.template(dialog_template.template)({
          ajx_search_params: {},
          ajx_booking_resources: resources
        });
      });
    }

    /**
     * Synchronize repeated editable controls and mark the booking draft dirty.
     *
     * @param {Event} event Input or change event.
     * @return {void}
     */
    function handle_draft_change(event) {
      var control = event.target.closest('[data-wpbc-booking-field], [data-wpbc-booking-note], [data-wpbc-booking-cost]');
      var attribute_name;
      var attribute_value;
      if (!control || !shell_root.contains(control)) {
        return;
      }
      attribute_name = control.hasAttribute('data-wpbc-booking-field') ? 'data-wpbc-booking-field' : control.hasAttribute('data-wpbc-booking-note') ? 'data-wpbc-booking-note' : 'data-wpbc-booking-cost';
      attribute_value = control.getAttribute(attribute_name);
      Array.prototype.forEach.call(shell_root.querySelectorAll('[' + attribute_name + '="' + attribute_value + '"]'), function (matching_control) {
        if (matching_control === control || 'checkbox' === control.type || 'radio' === control.type) {
          return;
        }
        matching_control.value = control.value;
      });
      if ('data-wpbc-booking-note' === attribute_name && 'private' === attribute_value && active_booking) {
        var listing_note = shell_root.querySelector('#set_booking_note_text_' + Number(active_booking.booking_id || 0));
        if (listing_note) {
          listing_note.value = control.value;
        }
      }
      if (!is_saving) {
        set_save_feedback('idle', '');
      }
      update_dirty_state();
    }

    /**
     * Restore every control from the last authoritative DTO.
     *
     * @return {void}
     */
    function cancel_changes() {
      if (active_booking && !is_saving) {
        render_booking(active_booking, '', get_active_tab());
      }
    }

    /**
     * Persist the current data-only draft through the authorized domain endpoint.
     *
     * @return {void}
     */
    function save_changes() {
      var preserved_tab = get_active_tab();
      var save_generation;
      var pending_save_request;
      var submitted_draft;
      var booking_before_save;
      var changed_field_keys;
      if (!is_dirty || is_saving || !active_booking || !transport.update_action || !transport.update_nonce) {
        return;
      }
      submitted_draft = collect_draft();
      booking_before_save = active_booking;
      is_saving = true;
      save_request_generation += 1;
      save_generation = save_request_generation;
      update_dirty_state();
      set_save_feedback('saving', i18n.saving || '');
      set_draft_controls_locked(true);
      pending_save_request = window.jQuery.ajax({
        url: transport.url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: transport.update_action,
          nonce: transport.update_nonce,
          booking_id: active_booking.booking_id,
          source: transport.source,
          fingerprint: active_booking.fingerprint,
          draft: JSON.stringify(submitted_draft),
          send_modified_email: get_send_modified_email_intent()
        }
      }).done(function (response) {
        if (save_generation !== save_request_generation || !shared_inspector.is_open()) {
          return;
        }
        if (!response || !response.success || !response.data || !response.data.booking) {
          is_saving = false;
          set_draft_controls_locked(false);
          set_save_feedback('error', get_save_error_message({
            responseJSON: response
          }));
          update_dirty_state();
          return;
        }
        changed_field_keys = get_changed_field_keys(booking_before_save, response.data.booking);
        is_saving = false;
        render_booking(response.data.booking, i18n.saved || '', preserved_tab, changed_field_keys);
        set_save_feedback('success', i18n.saved || '');
        if (response.data.changed) {
          dispatch_booking_saved(response.data.booking, changed_field_keys);
        }
        if ('timeline' === transport.source) {
          window.setTimeout(function () {
            if (save_generation === save_request_generation && shared_inspector.is_open()) {
              shared_inspector.close();
            }
          }, 0);
        }
      }).fail(function (failed_request, request_status) {
        if ('abort' === request_status || save_generation !== save_request_generation || !shared_inspector.is_open()) {
          return;
        }
        is_saving = false;
        set_draft_controls_locked(false);
        set_save_feedback('error', get_save_error_message(failed_request));
        update_dirty_state();
      }).always(function () {
        if (save_request === pending_save_request) {
          save_request = null;
        }
      });
      save_request = pending_save_request;
    }

    /**
     * Load one authorized activity page without mutating booking data.
     *
     * @param {number} page One-based activity page.
     * @return {void}
     */
    function load_activity_page(page) {
      var generation = request_generation;
      var activity_generation;
      var pagination = active_booking && active_booking.activity ? active_booking.activity.pagination : {};
      var activity_message;
      var page_request;
      if (is_dirty || is_saving || !active_booking || !transport.activity_action || !transport.activity_nonce || page < 1) {
        return;
      }
      if (activity_request && 'function' === typeof activity_request.abort) {
        activity_request.abort();
      }
      activity_request_generation += 1;
      activity_generation = activity_request_generation;
      activity_message = shell_root.querySelector('[data-wpbc-booking-activity-message]');
      if (activity_message) {
        activity_message.textContent = i18n.loading_activity || '';
      }
      page_request = window.jQuery.ajax({
        url: transport.url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: transport.activity_action,
          nonce: transport.activity_nonce,
          booking_id: active_booking.booking_id,
          source: transport.source,
          page: page,
          per_page: pagination && pagination.per_page ? pagination.per_page : 20
        }
      }).done(function (response) {
        if (generation !== request_generation || activity_generation !== activity_request_generation || !response || !response.success || !response.data || !response.data.activity || !active_booking) {
          return;
        }
        active_booking.activity = response.data.activity;
        render_booking(active_booking, '', 'activity');
      }).fail(function (failed_request, request_status) {
        var error;
        var message;
        if ('abort' === request_status || generation !== request_generation || activity_generation !== activity_request_generation || !shared_inspector.is_open()) {
          return;
        }
        error = failed_request.responseJSON && failed_request.responseJSON.data ? failed_request.responseJSON.data : {};
        message = shell_root.querySelector('[data-wpbc-booking-activity-message]');
        if (message) {
          message.textContent = error.message || i18n.activity_error || i18n.error || '';
        }
      }).always(function () {
        if (activity_request === page_request) {
          activity_request = null;
        }
      });
      activity_request = page_request;
    }

    /**
     * Handle domain controls rendered inside the Inspector shell.
     *
     * @param {MouseEvent} event Inspector click event.
     * @return {void}
     */
    function handle_inspector_click(event) {
      var activity_page_button = event.target.closest('[data-wpbc-booking-activity-page]');
      var date_editor_button = event.target.closest('[data-wpbc-booking-date-editor-open]');
      var rescheduling_button = event.target.closest('[data-wpbc-booking-rescheduling-open]');
      if (date_editor_button && date_editor_controller && active_booking) {
        event.preventDefault();
        if (is_dirty || is_saving) {
          set_save_feedback('error', i18n.finish_edits_before_action || '');
          return;
        }
        if (rescheduling_controller && !rescheduling_controller.prepare_for_parent_switch()) {
          return;
        }
        date_editor_controller.open(date_editor_button, {
          booking_id: active_booking.booking_id
        });
      } else if (rescheduling_button && rescheduling_controller && active_booking) {
        event.preventDefault();
        if (is_dirty || is_saving) {
          set_save_feedback('error', i18n.finish_edits_before_action || '');
          return;
        }
        if (date_editor_controller && !date_editor_controller.prepare_for_parent_switch()) {
          return;
        }
        rescheduling_controller.open(rescheduling_button, {
          booking_id: active_booking.booking_id
        });
      } else if (activity_page_button) {
        event.preventDefault();
        load_activity_page(Number(activity_page_button.getAttribute('data-wpbc-booking-activity-page')) || 0);
      } else if (event.target.closest('[data-wpbc-booking-inspector-cancel]')) {
        event.preventDefault();
        cancel_changes();
      } else if (event.target.closest('[data-wpbc-booking-inspector-save]')) {
        event.preventDefault();
        save_changes();
      }
    }

    /**
     * Protect unsaved drafts from canonical Booking Listing actions.
     *
     * The capture phase prevents inline Listing handlers from running before
     * the booking-domain dirty-state guard has evaluated the action.
     *
     * @param {MouseEvent} event Inspector action-menu click event.
     * @return {void}
     */
    function handle_action_menu_click(event) {
      var action_link = event.target.closest('.wpbc_booking_inspector__action_menu .ul_dropdown_menu_li_action');
      var inspector_content;
      var inspector_header;
      if (!action_link || !shell_root.contains(action_link)) {
        return;
      }
      synchronize_listing_notification_intent();
      if (is_dirty || is_saving) {
        event.preventDefault();
        event.stopImmediatePropagation();
        set_save_feedback('error', i18n.finish_edits_before_action || '');
        return;
      }
      if (action_link.classList.contains('ul_dropdown_menu_li_action_set_print')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        inspector_content = shell_root.querySelector('.wpbc_booking_inspector');
        inspector_header = shell_root.querySelector('.wpbc_shared_ui_inspector__header_content');
        if ('function' !== typeof window.wpbc_print_dialog__show_elements || !window.wpbc_print_dialog__show_elements([inspector_header, inspector_content].filter(Boolean), 'wpbc_booking_inspector__print_content')) {
          if ('function' === typeof window.wpbc_admin_show_message) {
            window.wpbc_admin_show_message(i18n.action_error || '', 'error', 10000);
          }
        }
      }
    }

    /**
     * Build the stable identity for one canonical Booking Action request.
     *
     * @param {Object} action_result Normalized Booking Action event detail.
     * @return {string} Booking and action identity, or an empty string when invalid.
     */
    function get_booking_action_identity(action_result) {
      var booking_id = Number(action_result && action_result.booking_id ? action_result.booking_id : 0);
      var action = String(action_result && action_result.action ? action_result.action : '');
      return booking_id && action ? String(booking_id) + ':' + action : '';
    }

    /**
     * Retain a canonical Booking Action started for the open Inspector booking.
     *
     * The request is owned by the established Booking Actions transport and can
     * outlive this panel. Retaining only its stable identity lets completion
     * invalidate the host even when the user closes or switches the Inspector.
     *
     * @param {CustomEvent} event Normalized booking-action start event.
     * @return {void}
     */
    function handle_booking_action_start(event) {
      var action_result = event && event.detail ? event.detail : {};
      var action_identity = get_booking_action_identity(action_result);
      var booking_id = Number(action_result.booking_id || 0);
      if (!action_identity || !active_booking || booking_id !== Number(active_booking.booking_id || 0)) {
        return;
      }
      pending_booking_actions[action_identity] = Number(pending_booking_actions[action_identity] || 0) + 1;
    }

    /**
     * Consume one previously retained canonical Booking Action identity.
     *
     * @param {Object} action_result Normalized Booking Action completion detail.
     * @return {boolean} Whether this Inspector observed the matching request start.
     */
    function consume_pending_booking_action(action_result) {
      var action_identity = get_booking_action_identity(action_result);
      var pending_count = action_identity ? Number(pending_booking_actions[action_identity] || 0) : 0;
      if (!pending_count) {
        return false;
      }
      if (1 === pending_count) {
        delete pending_booking_actions[action_identity];
      } else {
        pending_booking_actions[action_identity] = pending_count - 1;
      }
      return true;
    }

    /**
     * Reconcile the Inspector and host after a canonical Booking Listing action.
     *
     * @param {CustomEvent} event Normalized booking-action completion event.
     * @return {void}
     */
    function handle_booking_action_complete(event) {
      var action_result = event && event.detail ? event.detail : {};
      var action = String(action_result.action || '');
      var action_message = String(action_result.message || '');
      var completed_booking_id = Number(action_result.booking_id || 0);
      var is_pending_action = consume_pending_booking_action(action_result);
      var is_active_booking = Boolean(active_booking && completed_booking_id === Number(active_booking.booking_id || 0));
      var active_trigger;
      if (!is_pending_action && !is_active_booking) {
        return;
      }
      if (!action_result.success) {
        if (is_active_booking) {
          set_save_feedback('error', action_message || i18n.action_error || '');
        }
        return;
      }
      if (is_pending_action && !is_active_booking) {
        dispatch_booking_saved({
          booking_id: completed_booking_id
        }, []);
        return;
      }
      if (-1 !== ['move_booking_to_trash', 'delete_booking_completely'].indexOf(action)) {
        dispatch_booking_saved({
          booking_id: active_booking.booking_id
        }, []);
        shared_inspector.close();
        return;
      }
      if (is_dirty || is_saving) {
        set_save_feedback('success', action_message);
        return;
      }
      active_trigger = get_active_trigger();
      if (active_trigger) {
        open(active_trigger, function (refreshed_booking) {
          dispatch_booking_saved(refreshed_booking, []);
          set_save_feedback('success', action_message);
        });
      } else {
        set_save_feedback('success', action_message);
      }
    }
    shell_root.addEventListener('input', handle_draft_change);
    shell_root.addEventListener('change', handle_draft_change);
    shell_root.addEventListener('click', handle_action_menu_click, true);
    shell_root.addEventListener('click', handle_inspector_click);

    /**
     * Open one authorized booking and load its lazy details DTO.
     *
     * @param {HTMLElement} trigger           Activated booking trigger.
     * @param {Function}    on_booking_loaded Optional callback receiving the authoritative booking DTO after render.
     * @return {void}
     */
    function open(trigger, on_booking_loaded) {
      var booking_id = Number(trigger.getAttribute('data-wpbc-booking-id')) || 0;
      var generation;
      var date_editor_is_dirty = Boolean(date_editor_controller && date_editor_controller.is_dirty());
      var rescheduling_is_dirty = Boolean(rescheduling_controller && rescheduling_controller.is_dirty());
      if (!booking_id || !transport.source) {
        return;
      }
      if (rescheduling_controller && rescheduling_controller.is_busy && rescheduling_controller.is_busy()) {
        set_save_feedback('error', i18n.finish_edits_before_action || '');
        return;
      }
      if (shared_inspector.is_open() && active_booking_id && (is_dirty || date_editor_is_dirty || rescheduling_is_dirty)) {
        if (!window.confirm(i18n.discard_changes || '')) {
          return;
        }
        if (date_editor_controller) {
          date_editor_controller.force_close();
        }
        if (rescheduling_controller) {
          rescheduling_controller.force_close();
        }
      } else {
        if (date_editor_controller && !date_editor_controller.prepare_for_parent_switch()) {
          return;
        }
        if (rescheduling_controller && !rescheduling_controller.prepare_for_parent_switch()) {
          return;
        }
      }
      abort_request();
      generation = request_generation;
      shared_inspector.open(get_trigger_focus_target(trigger) || trigger);
      set_active_trigger(trigger);
      if ('function' === typeof shared_inspector.reset_header) {
        shared_inspector.reset_header(i18n.title || '');
      }
      render_state('loading', i18n.loading || '', true);
      if (!window.jQuery || !transport.url || !transport.action || !transport.nonce) {
        render_state('error', i18n.error || '', false);
        return;
      }
      request = window.jQuery.ajax({
        url: transport.url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: transport.action,
          nonce: transport.nonce,
          booking_id: booking_id,
          source: transport.source
        }
      }).done(function (response) {
        if (generation !== request_generation || !shared_inspector.is_open() || !response || !response.success || !response.data || !response.data.booking) {
          return;
        }
        render_booking(response.data.booking, i18n.loaded || '', 'details');
        if ('function' === typeof on_booking_loaded) {
          on_booking_loaded(response.data.booking);
        }
      }).fail(function (failed_request, request_status) {
        var error = failed_request.responseJSON && failed_request.responseJSON.data ? failed_request.responseJSON.data : {};
        if (generation !== request_generation || 'abort' === request_status || !shared_inspector.is_open()) {
          return;
        }
        render_state('error', error.message || i18n.error || '', false);
      }).always(function () {
        if (generation === request_generation) {
          request = null;
        }
      });
    }

    /**
     * Open one booking directly into its canonical full Reschedule dialog.
     *
     * The Inspector still performs its normal authorized booking read first. The
     * rescheduling domain then receives only the canonical booking identifier and
     * retains ownership of review, validation, focus, and future apply behavior.
     *
     * @param {HTMLElement} booking_trigger Booking identity trigger.
     * @param {HTMLElement} action_trigger  Resize handle that restores focus.
     * @return {void}
     */
    function open_rescheduling(booking_trigger, action_trigger) {
      open(booking_trigger, function (booking) {
        if (rescheduling_controller && booking && booking.booking_id) {
          rescheduling_controller.open(action_trigger || booking_trigger, {
            booking_id: booking.booking_id
          });
        }
      });
    }

    /**
     * Activate a booking trigger through delegated pointer input.
     *
     * @param {MouseEvent} event Host click event.
     * @return {void}
     */
    function handle_click(event) {
      var trigger = event.target.closest(trigger_selector);
      if (!trigger || !host_root.contains(trigger)) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      open(trigger);
    }

    /**
     * Activate a focused booking trigger with Enter or Space.
     *
     * @param {KeyboardEvent} event Host keyboard event.
     * @return {void}
     */
    function handle_keydown(event) {
      var trigger = event.target.closest(trigger_selector);
      if (!trigger || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || -1 === ['Enter', ' '].indexOf(event.key)) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      open(trigger);
    }
    if ('delegated' === activation_mode) {
      host_root.addEventListener('click', handle_click);
      host_root.addEventListener('keydown', handle_keydown);
    }
    window.addEventListener('wpbc:booking-action:start', handle_booking_action_start);
    window.addEventListener('wpbc:booking-action:complete', handle_booking_action_complete);
    return {
      open: open,
      open_rescheduling: open_rescheduling,
      refresh_after_external_apply: refresh_after_external_apply,
      refresh: refresh,
      close: function () {
        shared_inspector.close(true);
      },
      destroy: function () {
        if (date_editor_controller) {
          date_editor_controller.destroy();
          date_editor_controller = null;
        }
        if (rescheduling_controller) {
          rescheduling_controller.destroy();
          rescheduling_controller = null;
        }
        abort_request();
        clear_active_trigger();
        shell_root.removeEventListener('input', handle_draft_change);
        shell_root.removeEventListener('change', handle_draft_change);
        shell_root.removeEventListener('click', handle_action_menu_click, true);
        shell_root.removeEventListener('click', handle_inspector_click);
        if ('delegated' === activation_mode) {
          host_root.removeEventListener('click', handle_click);
          host_root.removeEventListener('keydown', handle_keydown);
        }
        window.removeEventListener('wpbc:booking-action:start', handle_booking_action_start);
        window.removeEventListener('wpbc:booking-action:complete', handle_booking_action_complete);
        document.removeEventListener('change', handle_notification_intent_change, true);
      }
    };
  }
  window.wpbc_booking_inspector = window.wpbc_booking_inspector || {};
  window.wpbc_booking_inspector.create = create;
})(window, document, window.wp);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvYm9va2luZy1pbnNwZWN0b3IvX291dC9ib29raW5nLWluc3BlY3Rvci5qcyIsIm5hbWVzIjpbIndpbmRvdyIsImRvY3VtZW50Iiwid3AiLCJnZXRfdGVtcGxhdGUiLCJ0ZW1wbGF0ZV9pZCIsInRlbXBsYXRlIiwiaW5pdGlhbGl6ZV90YWJzIiwiaW5zcGVjdG9yX3Jvb3QiLCJpbml0aWFsX3RhYiIsInRhYmxpc3QiLCJxdWVyeVNlbGVjdG9yIiwidGFicyIsIkFycmF5IiwicHJvdG90eXBlIiwic2xpY2UiLCJjYWxsIiwicXVlcnlTZWxlY3RvckFsbCIsInBhbmVscyIsImxlbmd0aCIsImFjdGl2YXRlX3RhYiIsInRhYiIsIm1vdmVfZm9jdXMiLCJjb250cm9sbGVkX3BhbmVsX2lkIiwiZ2V0QXR0cmlidXRlIiwiZm9yRWFjaCIsImNhbmRpZGF0ZV90YWIiLCJpc19hY3RpdmUiLCJzZXRBdHRyaWJ1dGUiLCJwYW5lbCIsImhpZGRlbiIsImlkIiwiZm9jdXMiLCJzb21lIiwiYWRkRXZlbnRMaXN0ZW5lciIsImV2ZW50IiwidGFyZ2V0IiwiY2xvc2VzdCIsImNvbnRhaW5zIiwidGFiX2FjdGlvbiIsInJlcXVlc3RlZF90YWIiLCJ0YXJnZXRfdGFiIiwiZmluZCIsInByZXZlbnREZWZhdWx0IiwiY3VycmVudF9pbmRleCIsImluZGV4T2YiLCJuZXh0X2luZGV4Iiwia2V5IiwiY3JlYXRlIiwiaG9zdF9yb290Iiwic2hlbGxfaG9zdCIsImNvbmZpZ3VyYXRpb24iLCJvcHRpb25zIiwic2V0dGluZ3MiLCJob3N0X29wdGlvbnMiLCJpMThuIiwidGVtcGxhdGVzIiwidHJhbnNwb3J0Iiwic2hlbGxfdGVtcGxhdGUiLCJzaGVsbCIsImRldGFpbHNfdGVtcGxhdGUiLCJkZXRhaWxzIiwiaGVhZGVyX3RlbXBsYXRlIiwiaGVhZGVyIiwicmVzb3VyY2VfdGVtcGxhdGUiLCJyZXNvdXJjZSIsInRhYnNfdGVtcGxhdGUiLCJib29raW5nX2ZpZWxkc190ZW1wbGF0ZSIsImJvb2tpbmdfZmllbGRzIiwiYm9va2luZ19maWVsZF9yb3dfdGVtcGxhdGUiLCJib29raW5nX2ZpZWxkX3JvdyIsImRhdGVzX3RlbXBsYXRlIiwiZGF0ZXMiLCJjb3N0c190ZW1wbGF0ZSIsImNvc3RzIiwibm90ZXNfdGVtcGxhdGUiLCJub3RlcyIsInN5c3RlbV9pbmZvcm1hdGlvbl90ZW1wbGF0ZSIsInN5c3RlbV9pbmZvcm1hdGlvbiIsImFjdGl2aXR5X3RlbXBsYXRlIiwiYWN0aXZpdHkiLCJmb290ZXJfdGVtcGxhdGUiLCJmb290ZXIiLCJzdGF0ZV90ZW1wbGF0ZSIsInN0YXRlIiwidHJpZ2dlcl9zZWxlY3RvciIsImFjdGl2ZV9jbGFzcyIsImFjdGl2YXRpb25fbW9kZSIsIm93bnNfdHJpZ2dlcl9hcmlhIiwiZm9jdXNfc2VsZWN0b3IiLCJzaGFyZWRfaW5zcGVjdG9yIiwiZGF0ZV9lZGl0b3JfY29udHJvbGxlciIsInJlc2NoZWR1bGluZ19jb250cm9sbGVyIiwic2hlbGxfcm9vdCIsImFjdGl2ZV90cmlnZ2VyX2lkIiwiYWN0aXZlX2Jvb2tpbmdfaWQiLCJob3N0X3JlZnJlc2hfZ2VuZXJhdGlvbiIsInJlcXVlc3QiLCJzYXZlX3JlcXVlc3QiLCJhY3Rpdml0eV9yZXF1ZXN0IiwicmVxdWVzdF9nZW5lcmF0aW9uIiwic2F2ZV9yZXF1ZXN0X2dlbmVyYXRpb24iLCJhY3Rpdml0eV9yZXF1ZXN0X2dlbmVyYXRpb24iLCJzYXZlX2ZlZWRiYWNrX3RpbWVyIiwic2F2ZV9zdWNjZXNzX21lc3NhZ2VfZHVyYXRpb25fbXMiLCJhY3RpdmVfYm9va2luZyIsInBlbmRpbmdfYm9va2luZ19hY3Rpb25zIiwiY2xlYW5fZHJhZnRfanNvbiIsImlzX2RpcnR5IiwiaXNfc2F2aW5nIiwic2F2ZWRfZXZlbnRfbmFtZSIsImdldF9zZW5kX21vZGlmaWVkX2VtYWlsX2ludGVudCIsIm5vdGlmaWNhdGlvbl90b2dnbGUiLCJnZXRFbGVtZW50QnlJZCIsImNoZWNrZWQiLCJzeW5jaHJvbml6ZV9saXN0aW5nX25vdGlmaWNhdGlvbl9pbnRlbnQiLCJ3cGJjX2FqeF9ib29raW5nX2xpc3RpbmciLCJzZWFyY2hfc2V0X3BhcmFtIiwiaGFuZGxlX25vdGlmaWNhdGlvbl9pbnRlbnRfY2hhbmdlIiwibWF0Y2hlcyIsIndwYmNfc2hhcmVkX3VpX2luc3BlY3RvciIsImlubmVySFRNTCIsImNvbXBvbmVudF9pZCIsInRpdGxlIiwiY2xvc2VfbGFiZWwiLCJsb2FkaW5nX2xhYmVsIiwibG9hZGluZyIsImNsYXNzTGlzdCIsImFkZCIsInNldF9zZWN1cmVfcGFyYW0iLCJsaXN0aW5nX2FjdGlvbl9ub25jZSIsImxpc3RpbmdfYWN0aW9uX3VzZXJfaWQiLCJsaXN0aW5nX2FjdGlvbl9sb2NhbGUiLCJhYm9ydF9yZXF1ZXN0IiwiY2xlYXJfc2F2ZV9mZWVkYmFja190aW1lciIsImFib3J0IiwiY2xlYXJUaW1lb3V0IiwiZ2V0X3RyaWdnZXJfaWQiLCJ0cmlnZ2VyIiwiU3RyaW5nIiwiZ2V0X3RyaWdnZXJfYm9va2luZ19pZCIsIk51bWJlciIsImNsZWFyX2FjdGl2ZV90cmlnZ2VyIiwicmVtb3ZlIiwic2V0X2FjdGl2ZV90cmlnZ2VyIiwidHJpZ2dlcl9pZCIsImJvb2tpbmdfaWQiLCJyZWZyZXNoIiwiZ2V0X2FjdGl2ZV90cmlnZ2VyIiwiYWN0aXZlX3RyaWdnZXIiLCJnZXRfdHJpZ2dlcl9mb2N1c190YXJnZXQiLCJmb2N1c190YXJnZXQiLCJpc0Nvbm5lY3RlZCIsImdldF9kYXRlX2VkaXRvcl9yZXN0b3JlX2ZvY3VzIiwiY2hhbmdlX2RhdGVzX2J1dHRvbiIsImdldF9yZXNjaGVkdWxpbmdfcmVzdG9yZV9mb2N1cyIsInJlc2NoZWR1bGVfYnV0dG9uIiwiaGFuZGxlX2Nsb3NlIiwiY3VycmVudF90cmlnZ2VyIiwiZm9yY2VfY2xvc2UiLCJzZXRUaW1lb3V0Iiwib25fY2xvc2UiLCJvbl9iZWZvcmVfY2xvc2UiLCJpc19idXN5IiwiY29uZmlybV9kaXNjYXJkIiwiY29uZmlybSIsImRpc2NhcmRfY2hhbmdlcyIsIndwYmNfYm9va2luZ19kYXRlX2VkaXRvciIsImNyZWF0ZV9jb250cm9sbGVyIiwiZGF0ZV9lZGl0b3IiLCJ1cmwiLCJzb3VyY2UiLCJnZXRfcmVzdG9yZV9mb2N1cyIsIm9uX2FwcGxpZWQiLCJoYW5kbGVfZGF0ZV9lZGl0b3JfYXBwbGllZCIsIndwYmNfYm9va2luZ19yZXNjaGVkdWxpbmciLCJyZXNjaGVkdWxpbmciLCJnZXRfYWN0aXZlX3RhYiIsInNlbGVjdGVkX3RhYiIsImNvbGxlY3RfZmllbGRfdmFsdWUiLCJmaWVsZHNfcm9vdCIsImZpZWxkIiwiY29udHJvbHMiLCJ2YWx1ZXMiLCJ0eXBlIiwiZmlsdGVyIiwiY29udHJvbCIsIm1hcCIsInZhbHVlIiwibXVsdGlwbGUiLCJvcHRpb24iLCJzZWxlY3RlZCIsImNvbGxlY3RfZHJhZnQiLCJkcmFmdCIsImZpZWxkcyIsImVkaXRhYmxlIiwicmVhZE9ubHkiLCJjb3N0X2tleSIsImdldF9jaGFuZ2VkX2ZpZWxkX2tleXMiLCJwcmV2aW91c19ib29raW5nIiwic2F2ZWRfYm9va2luZyIsInByZXZpb3VzX3ZhbHVlcyIsIkpTT04iLCJzdHJpbmdpZnkiLCJPYmplY3QiLCJoYXNPd25Qcm9wZXJ0eSIsImRpc3BhdGNoX2Jvb2tpbmdfc2F2ZWQiLCJjaGFuZ2VkX2ZpZWxkX2tleXMiLCJldmVudF9kZXRhaWwiLCJzYXZlZF9ldmVudCIsInJlZnJlc2hfZ2VuZXJhdGlvbiIsIkN1c3RvbUV2ZW50IiwiYnViYmxlcyIsImRldGFpbCIsImNyZWF0ZUV2ZW50IiwiaW5pdEN1c3RvbUV2ZW50IiwiZGlzcGF0Y2hFdmVudCIsImFwcGx5X3Jlc3VsdCIsImRpc3BhdGNoX3NhdmVkX2V2ZW50IiwiZGVmZXJyZWQiLCJqUXVlcnkiLCJEZWZlcnJlZCIsImV4cGVjdGVkX2Jvb2tpbmdfaWQiLCJwcmV2aW91c19yZXNvdXJjZV9pZCIsInJlc291cmNlX2lkIiwicHJlc2VydmVkX3RhYiIsImdlbmVyYXRpb24iLCJwZW5kaW5nX3JlYWRiYWNrX3JlcXVlc3QiLCJpc19vcGVuIiwiYWN0aW9uIiwibm9uY2UiLCJyZWplY3QiLCJtZXNzYWdlIiwiZXJyb3IiLCJwcm9taXNlIiwiYWpheCIsIm1ldGhvZCIsImRhdGFUeXBlIiwiZGF0YSIsImRvbmUiLCJyZXNwb25zZSIsImNhbm9uaWNhbF9ib29raW5nIiwic3VjY2VzcyIsImJvb2tpbmciLCJyZW5kZXJfYm9va2luZyIsInNhdmVkIiwiY2hhbmdlZCIsInB1c2giLCJyZXNvbHZlIiwiZmFpbCIsImZhaWxlZF9yZXF1ZXN0IiwicmVxdWVzdF9zdGF0dXMiLCJnZXRfc2F2ZV9lcnJvcl9tZXNzYWdlIiwiYWx3YXlzIiwicmVmcmVzaF9hZnRlcl9leHRlcm5hbF9hcHBseSIsInVwZGF0ZV9kaXJ0eV9zdGF0ZSIsInNhdmVfYnV0dG9uIiwiY2FuY2VsX2J1dHRvbiIsImRpc2FibGVkIiwic2V0X2RyYWZ0X2NvbnRyb2xzX2xvY2tlZCIsImlzX2xvY2tlZCIsImhhc0F0dHJpYnV0ZSIsInJlbW92ZUF0dHJpYnV0ZSIsInNldF9zYXZlX2ZlZWRiYWNrIiwic2F2ZV9sYWJlbCIsInNhdmVfc3Bpbm5lciIsInN0YXR1c19tZXNzYWdlIiwic2FmZV9tZXNzYWdlIiwidG9nZ2xlIiwidGV4dENvbnRlbnQiLCJzYXZpbmdfYnV0dG9uIiwic2F2aW5nIiwic2F2ZV9jaGFuZ2VzIiwiY3VycmVudF9tZXNzYWdlIiwiZmFsbGJhY2tfbWVzc2FnZSIsInJlc3BvbnNlSlNPTiIsImVycm9yX2RhdGEiLCJpc0FycmF5Iiwic2F2ZV9lcnJvciIsInJlbmRlcl9zdGF0ZSIsInNldF9sb2FkaW5nIiwiaWNvbl9jbGFzc2VzIiwiZW1wdHkiLCJ1bnN1cHBvcnRlZCIsInJlbmRlcmVkX3N0YXRlIiwiaWNvbl9jbGFzcyIsInNldF9zdGF0ZSIsIkJvb2xlYW4iLCJzZXRfY29udGVudCIsInJlbmRlcl9ib29raW5nX3RlbXBsYXRlcyIsImJvb2tpbmdfZHRvIiwicmVjZW50bHlfY2hhbmdlZF9maWVsZF9rZXlzIiwidmlld19kYXRhIiwiYXNzaWduIiwiaW5zcGVjdG9yX2lkIiwiY29zdHNfc3VwcG9ydGVkIiwic3VwcG9ydGVkIiwiZXZlbnRzIiwicGFnaW5hdGlvbiIsImVtcHR5X3N0YXRlX2h0bWwiLCJub3RfYXZhaWxhYmxlIiwibm90ZXNfZW1wdHlfc3RhdGVfaHRtbCIsIm5vX25vdGVzIiwiYWN0aXZpdHlfZW1wdHlfc3RhdGVfaHRtbCIsIm5vX2FjdGl2aXR5IiwiZmllbGRfcm93c19odG1sIiwiZmllbGRfaW5kZXgiLCJmaWVsZF9pZCIsImNhbl9lZGl0X2ZpZWxkcyIsImFjdGlvbnMiLCJyZWNlbnRseV9jaGFuZ2VkIiwiam9pbiIsIm5vdGVzX2h0bWwiLCJzeXN0ZW1faW5mb3JtYXRpb25faHRtbCIsImludGVydmFscyIsImhlYWRlcl9kdXJhdGlvbl9sYWJlbCIsImR1cmF0aW9uX2xhYmVsIiwic3VtbWFyeSIsInNlbGVjdGVkX2RhdGVzX2xhYmVsIiwiaGVhZGVyX3ZpZXdfZGF0YSIsImZvb3Rlcl92aWV3X2RhdGEiLCJhY3Rpb25fY29udGV4dCIsImNhbl91cGRhdGUiLCJoZWFkZXJfaHRtbCIsInJlc291cmNlX2h0bWwiLCJ0YWJzX2h0bWwiLCJib29raW5nX2ZpZWxkc19odG1sIiwiZGF0ZXNfaHRtbCIsImNvc3RzX2h0bWwiLCJhY3Rpdml0eV9odG1sIiwiZm9vdGVyX2h0bWwiLCJhbm5vdW5jZW1lbnQiLCJkb21haW5faGVhZGVyIiwic3RhdHVzX2xhYmVsIiwic3RhdHVzIiwibGFiZWwiLCJhY2Nlc3NpYmxlX3RpdGxlIiwiYm9va2luZ19udW1iZXIiLCJzZXRfaGVhZGVyIiwiaW5pdGlhbGl6ZV9hY3Rpb25fcmVzb3VyY2VfZGlhbG9ncyIsInJlc291cmNlcyIsImJvb2tpbmdfcmVzb3VyY2VzIiwiZGlhbG9nX3RlbXBsYXRlcyIsImRpYWxvZ190ZW1wbGF0ZSIsInRlbXBsYXRlX25vZGUiLCJhanhfc2VhcmNoX3BhcmFtcyIsImFqeF9ib29raW5nX3Jlc291cmNlcyIsImhhbmRsZV9kcmFmdF9jaGFuZ2UiLCJhdHRyaWJ1dGVfbmFtZSIsImF0dHJpYnV0ZV92YWx1ZSIsIm1hdGNoaW5nX2NvbnRyb2wiLCJsaXN0aW5nX25vdGUiLCJjYW5jZWxfY2hhbmdlcyIsInNhdmVfZ2VuZXJhdGlvbiIsInBlbmRpbmdfc2F2ZV9yZXF1ZXN0Iiwic3VibWl0dGVkX2RyYWZ0IiwiYm9va2luZ19iZWZvcmVfc2F2ZSIsInVwZGF0ZV9hY3Rpb24iLCJ1cGRhdGVfbm9uY2UiLCJmaW5nZXJwcmludCIsInNlbmRfbW9kaWZpZWRfZW1haWwiLCJjbG9zZSIsImxvYWRfYWN0aXZpdHlfcGFnZSIsInBhZ2UiLCJhY3Rpdml0eV9nZW5lcmF0aW9uIiwiYWN0aXZpdHlfbWVzc2FnZSIsInBhZ2VfcmVxdWVzdCIsImFjdGl2aXR5X2FjdGlvbiIsImFjdGl2aXR5X25vbmNlIiwibG9hZGluZ19hY3Rpdml0eSIsInBlcl9wYWdlIiwiYWN0aXZpdHlfZXJyb3IiLCJoYW5kbGVfaW5zcGVjdG9yX2NsaWNrIiwiYWN0aXZpdHlfcGFnZV9idXR0b24iLCJkYXRlX2VkaXRvcl9idXR0b24iLCJyZXNjaGVkdWxpbmdfYnV0dG9uIiwiZmluaXNoX2VkaXRzX2JlZm9yZV9hY3Rpb24iLCJwcmVwYXJlX2Zvcl9wYXJlbnRfc3dpdGNoIiwib3BlbiIsImhhbmRsZV9hY3Rpb25fbWVudV9jbGljayIsImFjdGlvbl9saW5rIiwiaW5zcGVjdG9yX2NvbnRlbnQiLCJpbnNwZWN0b3JfaGVhZGVyIiwic3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uIiwid3BiY19wcmludF9kaWFsb2dfX3Nob3dfZWxlbWVudHMiLCJ3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSIsImFjdGlvbl9lcnJvciIsImdldF9ib29raW5nX2FjdGlvbl9pZGVudGl0eSIsImFjdGlvbl9yZXN1bHQiLCJoYW5kbGVfYm9va2luZ19hY3Rpb25fc3RhcnQiLCJhY3Rpb25faWRlbnRpdHkiLCJjb25zdW1lX3BlbmRpbmdfYm9va2luZ19hY3Rpb24iLCJwZW5kaW5nX2NvdW50IiwiaGFuZGxlX2Jvb2tpbmdfYWN0aW9uX2NvbXBsZXRlIiwiYWN0aW9uX21lc3NhZ2UiLCJjb21wbGV0ZWRfYm9va2luZ19pZCIsImlzX3BlbmRpbmdfYWN0aW9uIiwiaXNfYWN0aXZlX2Jvb2tpbmciLCJyZWZyZXNoZWRfYm9va2luZyIsIm9uX2Jvb2tpbmdfbG9hZGVkIiwiZGF0ZV9lZGl0b3JfaXNfZGlydHkiLCJyZXNjaGVkdWxpbmdfaXNfZGlydHkiLCJyZXNldF9oZWFkZXIiLCJsb2FkZWQiLCJvcGVuX3Jlc2NoZWR1bGluZyIsImJvb2tpbmdfdHJpZ2dlciIsImFjdGlvbl90cmlnZ2VyIiwiaGFuZGxlX2NsaWNrIiwiaGFuZGxlX2tleWRvd24iLCJjdHJsS2V5IiwibWV0YUtleSIsImFsdEtleSIsInNoaWZ0S2V5IiwiZGVzdHJveSIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJ3cGJjX2Jvb2tpbmdfaW5zcGVjdG9yIl0sInNvdXJjZXMiOlsiaW5jbHVkZXMvYm9va2luZy1pbnNwZWN0b3IvX3NyYy9ib29raW5nLWluc3BlY3Rvci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogUmV1c2FibGUgQm9va2luZyBJbnNwZWN0b3IgZG9tYWluIGFkYXB0ZXIuXHJcbiAqXHJcbiAqIEBwYWNrYWdlIEJvb2tpbmcgQ2FsZW5kYXJcclxuICogQHNpbmNlICAgMTIuMC4wXHJcbiAqL1xyXG4oIGZ1bmN0aW9uICggd2luZG93LCBkb2N1bWVudCwgd3AgKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHQvKipcclxuXHQgKiBSZXNvbHZlIGFuIGFsbG93LWxpc3RlZCBXb3JkUHJlc3MgdGVtcGxhdGUgcmVuZGVyZXIuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGVfaWQgU2VydmVyLWRlY2xhcmVkIHRlbXBsYXRlIGlkZW50aWZpZXIuXHJcblx0ICogQHJldHVybiB7RnVuY3Rpb258bnVsbH0gVGVtcGxhdGUgcmVuZGVyZXIgb3IgbnVsbC5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiBnZXRfdGVtcGxhdGUoIHRlbXBsYXRlX2lkICkge1xyXG5cdFx0cmV0dXJuIHRlbXBsYXRlX2lkICYmIHdwICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3cC50ZW1wbGF0ZSA/IHdwLnRlbXBsYXRlKCB0ZW1wbGF0ZV9pZCApIDogbnVsbDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEluaXRpYWxpemUgb25lIHJlbmRlcmVkIHRhYiBzZXQuXHJcblx0ICpcclxuXHQgKiBBcnJvdyBrZXlzIGZvbGxvdyB0aGUgV0FJLUFSSUEgdGFicyBwYXR0ZXJuIHdoaWxlIFRhYiBjb250aW51ZXMgaW50byB0aGVcclxuXHQgKiBhY3RpdmUgcGFuZWwuIFRhYiBzZWxlY3Rpb24gaXRzZWxmIG5ldmVyIGNoYW5nZXMgYm9va2luZyBkYXRhLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gaW5zcGVjdG9yX3Jvb3QgUmVuZGVyZWQgYm9va2luZy1kb21haW4gSW5zcGVjdG9yLlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSAgICAgIGluaXRpYWxfdGFiICAgIFN0YWJsZSB0YWIgaWRlbnRpZmllciB0byBhY3RpdmF0ZSBpbml0aWFsbHkuXHJcblx0ICogQHJldHVybiB7dm9pZH1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiBpbml0aWFsaXplX3RhYnMoIGluc3BlY3Rvcl9yb290LCBpbml0aWFsX3RhYiApIHtcclxuXHRcdHZhciB0YWJsaXN0ID0gaW5zcGVjdG9yX3Jvb3QgPyBpbnNwZWN0b3Jfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW3JvbGU9XCJ0YWJsaXN0XCJdJyApIDogbnVsbDtcclxuXHRcdHZhciB0YWJzID0gdGFibGlzdCA/IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCB0YWJsaXN0LnF1ZXJ5U2VsZWN0b3JBbGwoICdbcm9sZT1cInRhYlwiXScgKSApIDogW107XHJcblx0XHR2YXIgcGFuZWxzID0gaW5zcGVjdG9yX3Jvb3QgPyBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggaW5zcGVjdG9yX3Jvb3QucXVlcnlTZWxlY3RvckFsbCggJ1tyb2xlPVwidGFicGFuZWxcIl0nICkgKSA6IFtdO1xyXG5cclxuXHRcdGlmICggISB0YWJsaXN0IHx8ICEgdGFicy5sZW5ndGggfHwgISBwYW5lbHMubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBBY3RpdmF0ZSBvbmUgYXZhaWxhYmxlIHRhYiBhbmQgaXRzIGNvbnRyb2xsZWQgcGFuZWwuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gdGFiICAgICAgICBUYWIgYnV0dG9uIHRvIGFjdGl2YXRlLlxyXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSAgICAgbW92ZV9mb2N1cyBXaGV0aGVyIGtleWJvYXJkIGZvY3VzIGZvbGxvd3MgYWN0aXZhdGlvbi5cclxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIGFjdGl2YXRlX3RhYiggdGFiLCBtb3ZlX2ZvY3VzICkge1xyXG5cdFx0XHR2YXIgY29udHJvbGxlZF9wYW5lbF9pZCA9IHRhYi5nZXRBdHRyaWJ1dGUoICdhcmlhLWNvbnRyb2xzJyApO1xyXG5cclxuXHRcdFx0dGFicy5mb3JFYWNoKCBmdW5jdGlvbiAoIGNhbmRpZGF0ZV90YWIgKSB7XHJcblx0XHRcdFx0dmFyIGlzX2FjdGl2ZSA9IGNhbmRpZGF0ZV90YWIgPT09IHRhYjtcclxuXHRcdFx0XHRjYW5kaWRhdGVfdGFiLnNldEF0dHJpYnV0ZSggJ2FyaWEtc2VsZWN0ZWQnLCBpc19hY3RpdmUgPyAndHJ1ZScgOiAnZmFsc2UnICk7XHJcblx0XHRcdFx0Y2FuZGlkYXRlX3RhYi5zZXRBdHRyaWJ1dGUoICd0YWJpbmRleCcsIGlzX2FjdGl2ZSA/ICcwJyA6ICctMScgKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHRwYW5lbHMuZm9yRWFjaCggZnVuY3Rpb24gKCBwYW5lbCApIHtcclxuXHRcdFx0XHRwYW5lbC5oaWRkZW4gPSBwYW5lbC5pZCAhPT0gY29udHJvbGxlZF9wYW5lbF9pZDtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHRpZiAoIG1vdmVfZm9jdXMgKSB7XHJcblx0XHRcdFx0dGFiLmZvY3VzKCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGluaXRpYWxfdGFiICkge1xyXG5cdFx0XHR0YWJzLnNvbWUoIGZ1bmN0aW9uICggY2FuZGlkYXRlX3RhYiApIHtcclxuXHRcdFx0XHRpZiAoIGluaXRpYWxfdGFiICE9PSBjYW5kaWRhdGVfdGFiLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLWluc3BlY3Rvci10YWInICkgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGFjdGl2YXRlX3RhYiggY2FuZGlkYXRlX3RhYiwgZmFsc2UgKTtcclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRhYmxpc3QuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0dmFyIHRhYiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW3JvbGU9XCJ0YWJcIl0nICk7XHJcblxyXG5cdFx0XHRpZiAoIHRhYiAmJiB0YWJsaXN0LmNvbnRhaW5zKCB0YWIgKSApIHtcclxuXHRcdFx0XHRhY3RpdmF0ZV90YWIoIHRhYiwgZmFsc2UgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cclxuXHRcdGluc3BlY3Rvcl9yb290LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdHZhciB0YWJfYWN0aW9uID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctaW5zcGVjdG9yLW9wZW4tdGFiXScgKTtcclxuXHRcdFx0dmFyIHJlcXVlc3RlZF90YWI7XHJcblx0XHRcdHZhciB0YXJnZXRfdGFiO1xyXG5cclxuXHRcdFx0aWYgKCAhIHRhYl9hY3Rpb24gfHwgISBpbnNwZWN0b3Jfcm9vdC5jb250YWlucyggdGFiX2FjdGlvbiApICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmVxdWVzdGVkX3RhYiA9IHRhYl9hY3Rpb24uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJvb2tpbmctaW5zcGVjdG9yLW9wZW4tdGFiJyApO1xyXG5cdFx0XHR0YXJnZXRfdGFiID0gdGFicy5maW5kKCBmdW5jdGlvbiAoIGNhbmRpZGF0ZV90YWIgKSB7XHJcblx0XHRcdFx0cmV0dXJuIHJlcXVlc3RlZF90YWIgPT09IGNhbmRpZGF0ZV90YWIuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJvb2tpbmctaW5zcGVjdG9yLXRhYicgKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHRpZiAoIHRhcmdldF90YWIgKSB7XHJcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRhY3RpdmF0ZV90YWIoIHRhcmdldF90YWIsIHRydWUgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cclxuXHRcdHRhYmxpc3QuYWRkRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHR2YXIgY3VycmVudF9pbmRleCA9IHRhYnMuaW5kZXhPZiggZXZlbnQudGFyZ2V0ICk7XHJcblx0XHRcdHZhciBuZXh0X2luZGV4ID0gY3VycmVudF9pbmRleDtcclxuXHJcblx0XHRcdGlmICggLTEgPT09IGN1cnJlbnRfaW5kZXggKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggJ0Fycm93UmlnaHQnID09PSBldmVudC5rZXkgfHwgJ0Fycm93RG93bicgPT09IGV2ZW50LmtleSApIHtcclxuXHRcdFx0XHRuZXh0X2luZGV4ID0gKCBjdXJyZW50X2luZGV4ICsgMSApICUgdGFicy5sZW5ndGg7XHJcblx0XHRcdH0gZWxzZSBpZiAoICdBcnJvd0xlZnQnID09PSBldmVudC5rZXkgfHwgJ0Fycm93VXAnID09PSBldmVudC5rZXkgKSB7XHJcblx0XHRcdFx0bmV4dF9pbmRleCA9ICggY3VycmVudF9pbmRleCAtIDEgKyB0YWJzLmxlbmd0aCApICUgdGFicy5sZW5ndGg7XHJcblx0XHRcdH0gZWxzZSBpZiAoICdIb21lJyA9PT0gZXZlbnQua2V5ICkge1xyXG5cdFx0XHRcdG5leHRfaW5kZXggPSAwO1xyXG5cdFx0XHR9IGVsc2UgaWYgKCAnRW5kJyA9PT0gZXZlbnQua2V5ICkge1xyXG5cdFx0XHRcdG5leHRfaW5kZXggPSB0YWJzLmxlbmd0aCAtIDE7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdGFjdGl2YXRlX3RhYiggdGFic1sgbmV4dF9pbmRleCBdLCB0cnVlICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBDcmVhdGUgb25lIEJvb2tpbmcgSW5zcGVjdG9yIGFkYXB0ZXIgZm9yIGEgaG9zdCB2aWV3LlxyXG5cdCAqXHJcblx0ICogVGhlIGFkYXB0ZXIgb3ducyBib29raW5nIHRyYW5zcG9ydCwgbG9jYWwgdGVtcGxhdGUgcmVuZGVyaW5nLCBzdGFsZS1yZXF1ZXN0XHJcblx0ICogcHJvdGVjdGlvbiwgYW5kIGFjdGl2ZSBib29raW5nLXRyaWdnZXIgc3RhdGUuIFRoZSBzaGFyZWQgSW5zcGVjdG9yIEFQSSBvd25zXHJcblx0ICogb25seSB0aGUgc2hlbGwgbGlmZWN5Y2xlIGFuZCBmb2N1cyBiZWhhdmlvci5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGhvc3Rfcm9vdCAgICAgVmlldyByb290IGNvbnRhaW5pbmcgYm9va2luZyB0cmlnZ2Vycy5cclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBzaGVsbF9ob3N0ICAgIEVtcHR5IGhvc3QgZm9yIHRoZSBzaGFyZWQgc2hlbGwgdGVtcGxhdGUuXHJcblx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgY29uZmlndXJhdGlvbiBTZXJ2ZXItb3duZWQgYm9va2luZyBkb21haW4gY29uZmlndXJhdGlvbi5cclxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBvcHRpb25zICAgICAgIEhvc3QgcHJlc2VudGF0aW9uIG9wdGlvbnMuXHJcblx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IEFkYXB0ZXIgQVBJIG9yIG51bGwgd2hlbiByZXF1aXJlZCBjb250cmFjdHMgYXJlIGFic2VudC5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiBjcmVhdGUoIGhvc3Rfcm9vdCwgc2hlbGxfaG9zdCwgY29uZmlndXJhdGlvbiwgb3B0aW9ucyApIHtcclxuXHRcdHZhciBzZXR0aW5ncyA9IGNvbmZpZ3VyYXRpb24gJiYgJ29iamVjdCcgPT09IHR5cGVvZiBjb25maWd1cmF0aW9uID8gY29uZmlndXJhdGlvbiA6IHt9O1xyXG5cdFx0dmFyIGhvc3Rfb3B0aW9ucyA9IG9wdGlvbnMgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBvcHRpb25zID8gb3B0aW9ucyA6IHt9O1xyXG5cdFx0dmFyIGkxOG4gPSBzZXR0aW5ncy5pMThuICYmICdvYmplY3QnID09PSB0eXBlb2Ygc2V0dGluZ3MuaTE4biA/IHNldHRpbmdzLmkxOG4gOiB7fTtcclxuXHRcdHZhciB0ZW1wbGF0ZXMgPSBzZXR0aW5ncy50ZW1wbGF0ZXMgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBzZXR0aW5ncy50ZW1wbGF0ZXMgPyBzZXR0aW5ncy50ZW1wbGF0ZXMgOiB7fTtcclxuXHRcdHZhciB0cmFuc3BvcnQgPSBzZXR0aW5ncy50cmFuc3BvcnQgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBzZXR0aW5ncy50cmFuc3BvcnQgPyBzZXR0aW5ncy50cmFuc3BvcnQgOiB7fTtcclxuXHRcdHZhciBzaGVsbF90ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggdGVtcGxhdGVzLnNoZWxsICk7XHJcblx0XHR2YXIgZGV0YWlsc190ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggdGVtcGxhdGVzLmRldGFpbHMgKTtcclxuXHRcdHZhciBoZWFkZXJfdGVtcGxhdGUgPSBnZXRfdGVtcGxhdGUoIHRlbXBsYXRlcy5oZWFkZXIgKTtcclxuXHRcdHZhciByZXNvdXJjZV90ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggdGVtcGxhdGVzLnJlc291cmNlICk7XHJcblx0XHR2YXIgdGFic190ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggdGVtcGxhdGVzLnRhYnMgKTtcclxuXHRcdHZhciBib29raW5nX2ZpZWxkc190ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggdGVtcGxhdGVzLmJvb2tpbmdfZmllbGRzICk7XHJcblx0XHR2YXIgYm9va2luZ19maWVsZF9yb3dfdGVtcGxhdGUgPSBnZXRfdGVtcGxhdGUoIHRlbXBsYXRlcy5ib29raW5nX2ZpZWxkX3JvdyApO1xyXG5cdFx0dmFyIGRhdGVzX3RlbXBsYXRlID0gZ2V0X3RlbXBsYXRlKCB0ZW1wbGF0ZXMuZGF0ZXMgKTtcclxuXHRcdHZhciBjb3N0c190ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggdGVtcGxhdGVzLmNvc3RzICk7XHJcblx0XHR2YXIgbm90ZXNfdGVtcGxhdGUgPSBnZXRfdGVtcGxhdGUoIHRlbXBsYXRlcy5ub3RlcyApO1xyXG5cdFx0dmFyIHN5c3RlbV9pbmZvcm1hdGlvbl90ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggdGVtcGxhdGVzLnN5c3RlbV9pbmZvcm1hdGlvbiApO1xyXG5cdFx0dmFyIGFjdGl2aXR5X3RlbXBsYXRlID0gZ2V0X3RlbXBsYXRlKCB0ZW1wbGF0ZXMuYWN0aXZpdHkgKTtcclxuXHRcdHZhciBmb290ZXJfdGVtcGxhdGUgPSBnZXRfdGVtcGxhdGUoIHRlbXBsYXRlcy5mb290ZXIgKTtcclxuXHRcdHZhciBzdGF0ZV90ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggdGVtcGxhdGVzLnN0YXRlICk7XHJcblx0XHR2YXIgdHJpZ2dlcl9zZWxlY3RvciA9IGhvc3Rfb3B0aW9ucy50cmlnZ2VyX3NlbGVjdG9yIHx8ICdbZGF0YS13cGJjLWJvb2tpbmctaW5zcGVjdG9yLXRyaWdnZXJdJztcclxuXHRcdHZhciBhY3RpdmVfY2xhc3MgPSBob3N0X29wdGlvbnMuYWN0aXZlX2NsYXNzIHx8ICdpcy1ib29raW5nLWluc3BlY3Rvci1vcGVuJztcclxuXHRcdHZhciBhY3RpdmF0aW9uX21vZGUgPSAnbWFudWFsJyA9PT0gaG9zdF9vcHRpb25zLmFjdGl2YXRpb25fbW9kZSA/ICdtYW51YWwnIDogJ2RlbGVnYXRlZCc7XHJcblx0XHR2YXIgb3duc190cmlnZ2VyX2FyaWEgPSBmYWxzZSAhPT0gaG9zdF9vcHRpb25zLm93bnNfdHJpZ2dlcl9hcmlhO1xyXG5cdFx0dmFyIGZvY3VzX3NlbGVjdG9yID0gJ3N0cmluZycgPT09IHR5cGVvZiBob3N0X29wdGlvbnMuZm9jdXNfc2VsZWN0b3IgPyBob3N0X29wdGlvbnMuZm9jdXNfc2VsZWN0b3IgOiAnJztcclxuXHRcdHZhciBzaGFyZWRfaW5zcGVjdG9yO1xyXG5cdFx0dmFyIGRhdGVfZWRpdG9yX2NvbnRyb2xsZXIgPSBudWxsO1xyXG5cdFx0dmFyIHJlc2NoZWR1bGluZ19jb250cm9sbGVyID0gbnVsbDtcclxuXHRcdHZhciBzaGVsbF9yb290O1xyXG5cdFx0dmFyIGFjdGl2ZV90cmlnZ2VyX2lkID0gJyc7XHJcblx0XHR2YXIgYWN0aXZlX2Jvb2tpbmdfaWQgPSAwO1xyXG5cdFx0dmFyIGhvc3RfcmVmcmVzaF9nZW5lcmF0aW9uID0gMDtcclxuXHRcdHZhciByZXF1ZXN0ID0gbnVsbDtcclxuXHRcdHZhciBzYXZlX3JlcXVlc3QgPSBudWxsO1xyXG5cdFx0dmFyIGFjdGl2aXR5X3JlcXVlc3QgPSBudWxsO1xyXG5cdFx0dmFyIHJlcXVlc3RfZ2VuZXJhdGlvbiA9IDA7XHJcblx0XHR2YXIgc2F2ZV9yZXF1ZXN0X2dlbmVyYXRpb24gPSAwO1xyXG5cdFx0dmFyIGFjdGl2aXR5X3JlcXVlc3RfZ2VuZXJhdGlvbiA9IDA7XHJcblx0XHR2YXIgc2F2ZV9mZWVkYmFja190aW1lciA9IG51bGw7XHJcblx0XHR2YXIgc2F2ZV9zdWNjZXNzX21lc3NhZ2VfZHVyYXRpb25fbXMgPSA1MDAwO1xyXG5cdFx0dmFyIGFjdGl2ZV9ib29raW5nID0gbnVsbDtcclxuXHRcdHZhciBwZW5kaW5nX2Jvb2tpbmdfYWN0aW9ucyA9IHt9O1xyXG5cdFx0dmFyIGNsZWFuX2RyYWZ0X2pzb24gPSAnJztcclxuXHRcdHZhciBpc19kaXJ0eSA9IGZhbHNlO1xyXG5cdFx0dmFyIGlzX3NhdmluZyA9IGZhbHNlO1xyXG5cdFx0dmFyIHNhdmVkX2V2ZW50X25hbWUgPSAnd3BiYzpib29raW5nLWluc3BlY3RvcjpzYXZlZCc7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZWFkIHRoZSBsaXZlIG5vdGlmaWNhdGlvbiBjaG9pY2Ugb3duZWQgYnkgdGhlIGN1cnJlbnQgYWRtaW5pc3RyYXRpb24gdmlldy5cclxuXHRcdCAqXHJcblx0XHQgKiBUaGUgdmFsdWUgaXMgcmVhZCBpbW1lZGlhdGVseSBiZWZvcmUgZWFjaCBtdXRhdGlvbiBzbyBjaGFuZ2luZyB0aGUgVGltZWxpbmVcclxuXHRcdCAqIHN3aXRjaCBhZnRlciBvcGVuaW5nIGFuIEluc3BlY3RvciBvciBSZXZpZXcgc3RpbGwgY29udHJvbHMgdGhhdCBvcGVyYXRpb24uXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7bnVtYmVyfSBPbmUgd2hlbiB0aGUgY3VycmVudCBvcGVyYXRpb24gcmVxdWVzdHMgZW1haWw7IG90aGVyd2lzZSB6ZXJvLlxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiBnZXRfc2VuZF9tb2RpZmllZF9lbWFpbF9pbnRlbnQoKSB7XHJcblx0XHRcdHZhciBub3RpZmljYXRpb25fdG9nZ2xlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2VuZC1tb2RpZmllZC1lbWFpbF0nICkgfHxcclxuXHRcdFx0XHRkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2lzX3NlbmRfZW1haWxfZm9yX3BlbmRpbmcnICkgfHxcclxuXHRcdFx0XHRkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3VpX3Vzcl9fc2VuZF9lbWFpbHMnICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gbm90aWZpY2F0aW9uX3RvZ2dsZSAmJiBub3RpZmljYXRpb25fdG9nZ2xlLmNoZWNrZWQgPyAxIDogMDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEtlZXAgZXN0YWJsaXNoZWQgQm9va2luZyBBY3Rpb25zIGFsaWduZWQgd2l0aCB0aGUgVGltZWxpbmUgbm90aWZpY2F0aW9uIHN3aXRjaC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiBzeW5jaHJvbml6ZV9saXN0aW5nX25vdGlmaWNhdGlvbl9pbnRlbnQoKSB7XHJcblx0XHRcdGlmICggd2luZG93LndwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5zZWFyY2hfc2V0X3BhcmFtICkge1xyXG5cdFx0XHRcdHdpbmRvdy53cGJjX2FqeF9ib29raW5nX2xpc3Rpbmcuc2VhcmNoX3NldF9wYXJhbShcclxuXHRcdFx0XHRcdCd1aV91c3JfX3NlbmRfZW1haWxzJyxcclxuXHRcdFx0XHRcdGdldF9zZW5kX21vZGlmaWVkX2VtYWlsX2ludGVudCgpID8gJ3NlbmQnIDogJ25vdF9zZW5kJ1xyXG5cdFx0XHRcdCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFN5bmNocm9uaXplIGFuIGluLXBhZ2Ugbm90aWZpY2F0aW9uLXRvZ2dsZSBjaGFuZ2Ugd2l0aG91dCByZWxvYWRpbmcgVGltZWxpbmUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgTmF0aXZlIGNoYW5nZSBldmVudC5cclxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIGhhbmRsZV9ub3RpZmljYXRpb25faW50ZW50X2NoYW5nZSggZXZlbnQgKSB7XHJcblx0XHRcdGlmICggZXZlbnQudGFyZ2V0ICYmIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy1zZW5kLW1vZGlmaWVkLWVtYWlsXSwgI2lzX3NlbmRfZW1haWxfZm9yX3BlbmRpbmcsICN1aV91c3JfX3NlbmRfZW1haWxzJyApICkge1xyXG5cdFx0XHRcdHN5bmNocm9uaXplX2xpc3Rpbmdfbm90aWZpY2F0aW9uX2ludGVudCgpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQhIGhvc3Rfcm9vdCB8fCAhIHNoZWxsX2hvc3QgfHwgISBzaGVsbF90ZW1wbGF0ZSB8fCAhIGRldGFpbHNfdGVtcGxhdGUgfHwgISBoZWFkZXJfdGVtcGxhdGUgfHwgISByZXNvdXJjZV90ZW1wbGF0ZSB8fFxyXG5cdFx0XHQhIHRhYnNfdGVtcGxhdGUgfHwgISBib29raW5nX2ZpZWxkc190ZW1wbGF0ZSB8fCAhIGJvb2tpbmdfZmllbGRfcm93X3RlbXBsYXRlIHx8ICEgZGF0ZXNfdGVtcGxhdGUgfHxcclxuXHRcdFx0ISBjb3N0c190ZW1wbGF0ZSB8fCAhIG5vdGVzX3RlbXBsYXRlIHx8ICEgc3lzdGVtX2luZm9ybWF0aW9uX3RlbXBsYXRlIHx8ICEgYWN0aXZpdHlfdGVtcGxhdGUgfHwgISBmb290ZXJfdGVtcGxhdGUgfHwgISBzdGF0ZV90ZW1wbGF0ZSB8fFxyXG5cdFx0XHQhIHdpbmRvdy53cGJjX3NoYXJlZF91aV9pbnNwZWN0b3IgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy53cGJjX3NoYXJlZF91aV9pbnNwZWN0b3IuY3JlYXRlXHJcblx0XHQpIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0c2hlbGxfaG9zdC5pbm5lckhUTUwgPSBzaGVsbF90ZW1wbGF0ZSgge1xyXG5cdFx0XHRpZDogc2V0dGluZ3MuY29tcG9uZW50X2lkIHx8ICd3cGJjX2Jvb2tpbmdfaW5zcGVjdG9yJyxcclxuXHRcdFx0dGl0bGU6IGkxOG4udGl0bGUgfHwgJycsXHJcblx0XHRcdGNsb3NlX2xhYmVsOiBpMThuLmNsb3NlX2xhYmVsIHx8ICcnLFxyXG5cdFx0XHRsb2FkaW5nX2xhYmVsOiBpMThuLmxvYWRpbmcgfHwgJydcclxuXHRcdH0gKTtcclxuXHRcdHNoZWxsX3Jvb3QgPSBzaGVsbF9ob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNoYXJlZC11aS1pbnNwZWN0b3JdJyApO1xyXG5cdFx0aWYgKCAhIHNoZWxsX3Jvb3QgKSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cdFx0c2hlbGxfcm9vdC5jbGFzc0xpc3QuYWRkKCAnd3BiY19ib29raW5nX2luc3BlY3Rvcl9zaGVsbCcgKTtcclxuXHRcdGlmICggd2luZG93LndwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5zZXRfc2VjdXJlX3BhcmFtICkge1xyXG5cdFx0XHR3aW5kb3cud3BiY19hanhfYm9va2luZ19saXN0aW5nLnNldF9zZWN1cmVfcGFyYW0oICdub25jZScsIHRyYW5zcG9ydC5saXN0aW5nX2FjdGlvbl9ub25jZSB8fCAnJyApO1xyXG5cdFx0XHR3aW5kb3cud3BiY19hanhfYm9va2luZ19saXN0aW5nLnNldF9zZWN1cmVfcGFyYW0oICd1c2VyX2lkJywgdHJhbnNwb3J0Lmxpc3RpbmdfYWN0aW9uX3VzZXJfaWQgfHwgMCApO1xyXG5cdFx0XHR3aW5kb3cud3BiY19hanhfYm9va2luZ19saXN0aW5nLnNldF9zZWN1cmVfcGFyYW0oICdsb2NhbGUnLCB0cmFuc3BvcnQubGlzdGluZ19hY3Rpb25fbG9jYWxlIHx8ICcnICk7XHJcblx0XHR9XHJcblx0XHRzeW5jaHJvbml6ZV9saXN0aW5nX25vdGlmaWNhdGlvbl9pbnRlbnQoKTtcclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBoYW5kbGVfbm90aWZpY2F0aW9uX2ludGVudF9jaGFuZ2UsIHRydWUgKTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFib3J0IHRoZSBhY3RpdmUgcmVhZCBhbmQgaW52YWxpZGF0ZSBldmVyeSBwZW5kaW5nIGNhbGxiYWNrLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIGFib3J0X3JlcXVlc3QoKSB7XHJcblx0XHRcdHJlcXVlc3RfZ2VuZXJhdGlvbiArPSAxO1xyXG5cdFx0XHRzYXZlX3JlcXVlc3RfZ2VuZXJhdGlvbiArPSAxO1xyXG5cdFx0XHRhY3Rpdml0eV9yZXF1ZXN0X2dlbmVyYXRpb24gKz0gMTtcclxuXHRcdFx0Y2xlYXJfc2F2ZV9mZWVkYmFja190aW1lcigpO1xyXG5cdFx0XHRpZiAoIHJlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHJlcXVlc3QuYWJvcnQgKSB7XHJcblx0XHRcdFx0cmVxdWVzdC5hYm9ydCgpO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJlcXVlc3QgPSBudWxsO1xyXG5cdFx0XHRpZiAoIHNhdmVfcmVxdWVzdCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc2F2ZV9yZXF1ZXN0LmFib3J0ICkge1xyXG5cdFx0XHRcdHNhdmVfcmVxdWVzdC5hYm9ydCgpO1xyXG5cdFx0XHR9XHJcblx0XHRcdHNhdmVfcmVxdWVzdCA9IG51bGw7XHJcblx0XHRcdGlmICggYWN0aXZpdHlfcmVxdWVzdCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgYWN0aXZpdHlfcmVxdWVzdC5hYm9ydCApIHtcclxuXHRcdFx0XHRhY3Rpdml0eV9yZXF1ZXN0LmFib3J0KCk7XHJcblx0XHRcdH1cclxuXHRcdFx0YWN0aXZpdHlfcmVxdWVzdCA9IG51bGw7XHJcblx0XHRcdGlzX3NhdmluZyA9IGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ2FuY2VsIGEgcGVuZGluZyBzdWNjZXNzLW1lc3NhZ2UgdGltZW91dC5cclxuXHRcdCAqXHJcblx0XHQgKiBTYXZlIHByb2dyZXNzLCBlcnJvcnMsIGEgbmV3IGJvb2tpbmcsIGFuZCBJbnNwZWN0b3IgY2xvc3VyZSBtdXN0IG5vdCBiZVxyXG5cdFx0ICogYWZmZWN0ZWQgYnkgYSB0aW1lciBjcmVhdGVkIGZvciBhbiBlYXJsaWVyIHN1Y2Nlc3NmdWwgcmVxdWVzdC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiBjbGVhcl9zYXZlX2ZlZWRiYWNrX3RpbWVyKCkge1xyXG5cdFx0XHRpZiAoIG51bGwgIT09IHNhdmVfZmVlZGJhY2tfdGltZXIgKSB7XHJcblx0XHRcdFx0d2luZG93LmNsZWFyVGltZW91dCggc2F2ZV9mZWVkYmFja190aW1lciApO1xyXG5cdFx0XHRcdHNhdmVfZmVlZGJhY2tfdGltZXIgPSBudWxsO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZXR1cm4gb25lIHRyaWdnZXIncyBzdGFibGUgaG9zdCBpZGVudGl0eS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSB0cmlnZ2VyIEJvb2tpbmcgdHJpZ2dlci5cclxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gU3RhYmxlIGlkZW50aXR5IG9yIGFuIGVtcHR5IHN0cmluZy5cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gZ2V0X3RyaWdnZXJfaWQoIHRyaWdnZXIgKSB7XHJcblx0XHRcdHJldHVybiB0cmlnZ2VyICYmIHRyaWdnZXIuZ2V0QXR0cmlidXRlXHJcblx0XHRcdFx0PyBTdHJpbmcoIHRyaWdnZXIuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJvb2tpbmctaW5zcGVjdG9yLXRyaWdnZXItaWQnICkgfHwgJycgKVxyXG5cdFx0XHRcdDogJyc7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZXR1cm4gdGhlIGNhbm9uaWNhbCBib29raW5nIGlkZW50aWZpZXIgcmVwcmVzZW50ZWQgYnkgYSBob3N0IHRyaWdnZXIuXHJcblx0XHQgKlxyXG5cdFx0ICogSG9zdCBtYXJrdXAgbWF5IGRlcml2ZSBpdHMgdmlzdWFsIHNlZ21lbnQgaWRlbnRpdHkgZnJvbSBkYXRlcy4gQm9va2luZyBJRFxyXG5cdFx0ICogcmVtYWlucyBzdGFibGUgd2hlbiBhIHN1Y2Nlc3NmdWwgZGF0ZSBtdXRhdGlvbiByZXBsYWNlcyB0aGF0IHNlZ21lbnQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gdHJpZ2dlciBCb29raW5nIHRyaWdnZXIuXHJcblx0XHQgKiBAcmV0dXJuIHtudW1iZXJ9IFBvc2l0aXZlIGJvb2tpbmcgaWRlbnRpZmllciBvciB6ZXJvLlxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiBnZXRfdHJpZ2dlcl9ib29raW5nX2lkKCB0cmlnZ2VyICkge1xyXG5cdFx0XHRyZXR1cm4gdHJpZ2dlciAmJiB0cmlnZ2VyLmdldEF0dHJpYnV0ZVxyXG5cdFx0XHRcdD8gTnVtYmVyKCB0cmlnZ2VyLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLWlkJyApIHx8IDAgKVxyXG5cdFx0XHRcdDogMDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlbW92ZSB0aGUgb3BlbiBzdGF0ZSBmcm9tIGV2ZXJ5IHJlbmRlcmVkIGJvb2tpbmcgdHJpZ2dlci5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiBjbGVhcl9hY3RpdmVfdHJpZ2dlcigpIHtcclxuXHRcdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCggaG9zdF9yb290LnF1ZXJ5U2VsZWN0b3JBbGwoIHRyaWdnZXJfc2VsZWN0b3IgKSwgZnVuY3Rpb24gKCB0cmlnZ2VyICkge1xyXG5cdFx0XHRcdHRyaWdnZXIuY2xhc3NMaXN0LnJlbW92ZSggYWN0aXZlX2NsYXNzICk7XHJcblx0XHRcdFx0aWYgKCBvd25zX3RyaWdnZXJfYXJpYSApIHtcclxuXHRcdFx0XHRcdHRyaWdnZXIuc2V0QXR0cmlidXRlKCAnYXJpYS1leHBhbmRlZCcsICdmYWxzZScgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0YWN0aXZlX3RyaWdnZXJfaWQgPSAnJztcclxuXHRcdFx0YWN0aXZlX2Jvb2tpbmdfaWQgPSAwO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogTWFyayBvbmUgcmVuZGVyZWQgdHJpZ2dlciBhcyB0aGUgYm9va2luZyBkaXNwbGF5ZWQgaW4gdGhlIEluc3BlY3Rvci5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSB0cmlnZ2VyIEJvb2tpbmcgdHJpZ2dlci5cclxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHNldF9hY3RpdmVfdHJpZ2dlciggdHJpZ2dlciApIHtcclxuXHRcdFx0dmFyIHRyaWdnZXJfaWQgPSBnZXRfdHJpZ2dlcl9pZCggdHJpZ2dlciApO1xyXG5cdFx0XHR2YXIgYm9va2luZ19pZCA9IGdldF90cmlnZ2VyX2Jvb2tpbmdfaWQoIHRyaWdnZXIgKTtcclxuXHJcblx0XHRcdGNsZWFyX2FjdGl2ZV90cmlnZ2VyKCk7XHJcblx0XHRcdGlmICggISB0cmlnZ2VyX2lkIHx8ICEgYm9va2luZ19pZCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0YWN0aXZlX3RyaWdnZXJfaWQgPSB0cmlnZ2VyX2lkO1xyXG5cdFx0XHRhY3RpdmVfYm9va2luZ19pZCA9IGJvb2tpbmdfaWQ7XHJcblx0XHRcdHRyaWdnZXIuY2xhc3NMaXN0LmFkZCggYWN0aXZlX2NsYXNzICk7XHJcblx0XHRcdGlmICggb3duc190cmlnZ2VyX2FyaWEgKSB7XHJcblx0XHRcdFx0dHJpZ2dlci5zZXRBdHRyaWJ1dGUoICdhcmlhLWV4cGFuZGVkJywgJ3RydWUnICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlc3RvcmUgYWN0aXZlIHByZXNlbnRhdGlvbiBhZnRlciB0aGUgaG9zdCByZXBsYWNlcyBib29raW5nIG1hcmt1cC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiByZWZyZXNoKCkge1xyXG5cdFx0XHRpZiAoICEgYWN0aXZlX3RyaWdnZXJfaWQgfHwgISBhY3RpdmVfYm9va2luZ19pZCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0QXJyYXkucHJvdG90eXBlLnNvbWUuY2FsbCggaG9zdF9yb290LnF1ZXJ5U2VsZWN0b3JBbGwoIHRyaWdnZXJfc2VsZWN0b3IgKSwgZnVuY3Rpb24gKCB0cmlnZ2VyICkge1xyXG5cdFx0XHRcdGlmICggYWN0aXZlX3RyaWdnZXJfaWQgIT09IGdldF90cmlnZ2VyX2lkKCB0cmlnZ2VyICkgJiYgYWN0aXZlX2Jvb2tpbmdfaWQgIT09IGdldF90cmlnZ2VyX2Jvb2tpbmdfaWQoIHRyaWdnZXIgKSApIHtcclxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YWN0aXZlX3RyaWdnZXJfaWQgPSBnZXRfdHJpZ2dlcl9pZCggdHJpZ2dlciApO1xyXG5cdFx0XHRcdHRyaWdnZXIuY2xhc3NMaXN0LmFkZCggYWN0aXZlX2NsYXNzICk7XHJcblx0XHRcdFx0aWYgKCBvd25zX3RyaWdnZXJfYXJpYSApIHtcclxuXHRcdFx0XHRcdHRyaWdnZXIuc2V0QXR0cmlidXRlKCAnYXJpYS1leHBhbmRlZCcsICd0cnVlJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRmluZCB0aGUgY3VycmVudGx5IGFjdGl2ZSB0cmlnZ2VyIGluIHRoZSBsYXRlc3QgaG9zdCBtYXJrdXAuXHJcblx0XHQgKlxyXG5cdFx0ICogVGhlIGhvc3QgbWF5IHJlcGxhY2UgYm9va2luZyBzZWdtZW50cyB3aGlsZSB0aGUgSW5zcGVjdG9yIGlzIG9wZW4uIFRoZVxyXG5cdFx0ICogc2hhcmVkIHNoZWxsIHRoZXJlZm9yZSBjYW5ub3QgYWx3YXlzIHJlc3RvcmUgZm9jdXMgdG8gdGhlIG9yaWdpbmFsIERPTVxyXG5cdFx0ICogbm9kZTsgdGhlIGRvbWFpbiBhZGFwdGVyIHJlc29sdmVzIHRoZSBlcXVpdmFsZW50IGN1cnJlbnQgdHJpZ2dlci5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfSBDdXJyZW50IGFjdGl2ZSB0cmlnZ2VyIG9yIG51bGwuXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIGdldF9hY3RpdmVfdHJpZ2dlcigpIHtcclxuXHRcdFx0dmFyIGFjdGl2ZV90cmlnZ2VyID0gbnVsbDtcclxuXHJcblx0XHRcdGlmICggISBhY3RpdmVfdHJpZ2dlcl9pZCB8fCAhIGFjdGl2ZV9ib29raW5nX2lkICkge1xyXG5cdFx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0XHR9XHJcblx0XHRcdEFycmF5LnByb3RvdHlwZS5zb21lLmNhbGwoIGhvc3Rfcm9vdC5xdWVyeVNlbGVjdG9yQWxsKCB0cmlnZ2VyX3NlbGVjdG9yICksIGZ1bmN0aW9uICggdHJpZ2dlciApIHtcclxuXHRcdFx0XHRpZiAoIGFjdGl2ZV90cmlnZ2VyX2lkICE9PSBnZXRfdHJpZ2dlcl9pZCggdHJpZ2dlciApICYmIGFjdGl2ZV9ib29raW5nX2lkICE9PSBnZXRfdHJpZ2dlcl9ib29raW5nX2lkKCB0cmlnZ2VyICkgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGFjdGl2ZV90cmlnZ2VyX2lkID0gZ2V0X3RyaWdnZXJfaWQoIHRyaWdnZXIgKTtcclxuXHRcdFx0XHRhY3RpdmVfdHJpZ2dlciA9IHRyaWdnZXI7XHJcblx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0cmV0dXJuIGFjdGl2ZV90cmlnZ2VyO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVzb2x2ZSB0aGUgZm9jdXNhYmxlIGNvbnRyb2wgYXNzb2NpYXRlZCB3aXRoIG9uZSBob3N0IGlkZW50aXR5IGVsZW1lbnQuXHJcblx0XHQgKlxyXG5cdFx0ICogTWFudWFsIGhvc3RzIG1heSBrZWVwIEluc3BlY3RvciBpZGVudGl0eSBvbiBhIG5vbi1pbnRlcmFjdGl2ZSBncm91cCB3aGlsZVxyXG5cdFx0ICogZXhwb3NpbmcgYSBzZXBhcmF0ZSBuYXRpdmUgc2VsZWN0aW9uIGNvbnRyb2wuIERlbGVnYXRlZCBob3N0cyBjb250aW51ZSB0b1xyXG5cdFx0ICogcmVzdG9yZSBmb2N1cyB0byB0aGVpciB0cmlnZ2VyIGl0c2VsZi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fG51bGx9IHRyaWdnZXIgQ3VycmVudCBob3N0IGlkZW50aXR5IGVsZW1lbnQuXHJcblx0XHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfSBDb25uZWN0ZWQgZm9jdXMgdGFyZ2V0IG9yIG51bGwuXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIGdldF90cmlnZ2VyX2ZvY3VzX3RhcmdldCggdHJpZ2dlciApIHtcclxuXHRcdFx0dmFyIGZvY3VzX3RhcmdldCA9IHRyaWdnZXI7XHJcblxyXG5cdFx0XHRpZiAoIHRyaWdnZXIgJiYgZm9jdXNfc2VsZWN0b3IgKSB7XHJcblx0XHRcdFx0Zm9jdXNfdGFyZ2V0ID0gdHJpZ2dlci5xdWVyeVNlbGVjdG9yKCBmb2N1c19zZWxlY3RvciApIHx8IHRyaWdnZXI7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBmb2N1c190YXJnZXQgJiYgZm9jdXNfdGFyZ2V0LmlzQ29ubmVjdGVkID8gZm9jdXNfdGFyZ2V0IDogbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEZpbmQgdGhlIGN1cnJlbnQgQ2hhbmdlIGRhdGVzIGNvbnRyb2wgYWZ0ZXIgYSBob3N0IG9yIEluc3BlY3RvciByZXJlbmRlci5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfSBDdXJyZW50IERhdGUgRWRpdG9yIG9wZW5lciBvciBib29raW5nIHRyaWdnZXIuXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIGdldF9kYXRlX2VkaXRvcl9yZXN0b3JlX2ZvY3VzKCkge1xyXG5cdFx0XHR2YXIgY2hhbmdlX2RhdGVzX2J1dHRvbiA9IHNoZWxsX3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci1vcGVuXScgKTtcclxuXHJcblx0XHRcdHJldHVybiBjaGFuZ2VfZGF0ZXNfYnV0dG9uIHx8IGdldF90cmlnZ2VyX2ZvY3VzX3RhcmdldCggZ2V0X2FjdGl2ZV90cmlnZ2VyKCkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEZpbmQgdGhlIGN1cnJlbnQgUmVzY2hlZHVsZSBjb250cm9sIGFmdGVyIGFuIEluc3BlY3RvciByZXJlbmRlci5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfSBDdXJyZW50IG9wZW5lciBvciBib29raW5nIHRyaWdnZXIuXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIGdldF9yZXNjaGVkdWxpbmdfcmVzdG9yZV9mb2N1cygpIHtcclxuXHRcdFx0dmFyIHJlc2NoZWR1bGVfYnV0dG9uID0gc2hlbGxfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc2NoZWR1bGluZy1vcGVuXScgKTtcclxuXHJcblx0XHRcdHJldHVybiByZXNjaGVkdWxlX2J1dHRvbiB8fCBnZXRfdHJpZ2dlcl9mb2N1c190YXJnZXQoIGdldF9hY3RpdmVfdHJpZ2dlcigpICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZWNvbmNpbGUgYm9va2luZy1kb21haW4gc3RhdGUgYWZ0ZXIgdGhlIHNoYXJlZCBzaGVsbCBjbG9zZXMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2Nsb3NlKCkge1xyXG5cdFx0XHR2YXIgY3VycmVudF90cmlnZ2VyID0gZ2V0X3RyaWdnZXJfZm9jdXNfdGFyZ2V0KCBnZXRfYWN0aXZlX3RyaWdnZXIoKSApO1xyXG5cclxuXHRcdFx0aWYgKCBkYXRlX2VkaXRvcl9jb250cm9sbGVyICkge1xyXG5cdFx0XHRcdGRhdGVfZWRpdG9yX2NvbnRyb2xsZXIuZm9yY2VfY2xvc2UoKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIHJlc2NoZWR1bGluZ19jb250cm9sbGVyICkge1xyXG5cdFx0XHRcdHJlc2NoZWR1bGluZ19jb250cm9sbGVyLmZvcmNlX2Nsb3NlKCk7XHJcblx0XHRcdH1cclxuXHRcdFx0YWJvcnRfcmVxdWVzdCgpO1xyXG5cdFx0XHRjbGVhcl9hY3RpdmVfdHJpZ2dlcigpO1xyXG5cdFx0XHRhY3RpdmVfYm9va2luZyA9IG51bGw7XHJcblx0XHRcdGNsZWFuX2RyYWZ0X2pzb24gPSAnJztcclxuXHRcdFx0aXNfZGlydHkgPSBmYWxzZTtcclxuXHRcdFx0aWYgKCBjdXJyZW50X3RyaWdnZXIgKSB7XHJcblx0XHRcdFx0d2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdGlmICggZG9jdW1lbnQuY29udGFpbnMoIGN1cnJlbnRfdHJpZ2dlciApICkge1xyXG5cdFx0XHRcdFx0XHRjdXJyZW50X3RyaWdnZXIuZm9jdXMoKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9LCAwICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRzaGFyZWRfaW5zcGVjdG9yID0gd2luZG93LndwYmNfc2hhcmVkX3VpX2luc3BlY3Rvci5jcmVhdGUoIHNoZWxsX3Jvb3QsIHtcclxuXHRcdFx0b25fY2xvc2U6IGhhbmRsZV9jbG9zZSxcclxuXHRcdFx0b25fYmVmb3JlX2Nsb3NlOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0aWYgKCByZXNjaGVkdWxpbmdfY29udHJvbGxlciAmJiByZXNjaGVkdWxpbmdfY29udHJvbGxlci5pc19idXN5ICYmIHJlc2NoZWR1bGluZ19jb250cm9sbGVyLmlzX2J1c3koKSApIHtcclxuXHRcdFx0XHRcdHJldHVybiByZXNjaGVkdWxpbmdfY29udHJvbGxlci5jb25maXJtX2Rpc2NhcmQoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCByZXNjaGVkdWxpbmdfY29udHJvbGxlciAmJiByZXNjaGVkdWxpbmdfY29udHJvbGxlci5pc19kaXJ0eSgpICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuIGlzX2RpcnR5XHJcblx0XHRcdFx0XHRcdD8gd2luZG93LmNvbmZpcm0oIGkxOG4uZGlzY2FyZF9jaGFuZ2VzIHx8ICcnIClcclxuXHRcdFx0XHRcdFx0OiByZXNjaGVkdWxpbmdfY29udHJvbGxlci5jb25maXJtX2Rpc2NhcmQoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCBkYXRlX2VkaXRvcl9jb250cm9sbGVyICYmIGRhdGVfZWRpdG9yX2NvbnRyb2xsZXIuaXNfZGlydHkoKSApIHtcclxuXHRcdFx0XHRcdHJldHVybiBpc19kaXJ0eVxyXG5cdFx0XHRcdFx0XHQ/IHdpbmRvdy5jb25maXJtKCBpMThuLmRpc2NhcmRfY2hhbmdlcyB8fCAnJyApXHJcblx0XHRcdFx0XHRcdDogZGF0ZV9lZGl0b3JfY29udHJvbGxlci5jb25maXJtX2Rpc2NhcmQoKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiAhIGlzX2RpcnR5IHx8IHdpbmRvdy5jb25maXJtKCBpMThuLmRpc2NhcmRfY2hhbmdlcyB8fCAnJyApO1xyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblx0XHRpZiAoICEgc2hhcmVkX2luc3BlY3RvciApIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblx0XHRpZiAoIHdpbmRvdy53cGJjX2Jvb2tpbmdfZGF0ZV9lZGl0b3IgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX2Jvb2tpbmdfZGF0ZV9lZGl0b3IuY3JlYXRlX2NvbnRyb2xsZXIgKSB7XHJcblx0XHRcdGRhdGVfZWRpdG9yX2NvbnRyb2xsZXIgPSB3aW5kb3cud3BiY19ib29raW5nX2RhdGVfZWRpdG9yLmNyZWF0ZV9jb250cm9sbGVyKCBzaGVsbF9yb290LCBzZXR0aW5ncy5kYXRlX2VkaXRvciB8fCB7fSwge1xyXG5cdFx0XHRcdHVybDogdHJhbnNwb3J0LnVybCB8fCAnJyxcclxuXHRcdFx0XHRzb3VyY2U6IHRyYW5zcG9ydC5zb3VyY2UgfHwgJycsXHJcblx0XHRcdFx0Z2V0X3Jlc3RvcmVfZm9jdXM6IGdldF9kYXRlX2VkaXRvcl9yZXN0b3JlX2ZvY3VzLFxyXG5cdFx0XHRcdG9uX2FwcGxpZWQ6IGhhbmRsZV9kYXRlX2VkaXRvcl9hcHBsaWVkLFxyXG5cdFx0XHRcdGdldF9zZW5kX21vZGlmaWVkX2VtYWlsX2ludGVudDogZ2V0X3NlbmRfbW9kaWZpZWRfZW1haWxfaW50ZW50XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHRcdGlmICggd2luZG93LndwYmNfYm9va2luZ19yZXNjaGVkdWxpbmcgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX2Jvb2tpbmdfcmVzY2hlZHVsaW5nLmNyZWF0ZV9jb250cm9sbGVyICkge1xyXG5cdFx0XHRyZXNjaGVkdWxpbmdfY29udHJvbGxlciA9IHdpbmRvdy53cGJjX2Jvb2tpbmdfcmVzY2hlZHVsaW5nLmNyZWF0ZV9jb250cm9sbGVyKCBzaGVsbF9yb290LCBzZXR0aW5ncy5yZXNjaGVkdWxpbmcgfHwge30sIHtcclxuXHRcdFx0XHR1cmw6IHRyYW5zcG9ydC51cmwgfHwgJycsXHJcblx0XHRcdFx0c291cmNlOiB0cmFuc3BvcnQuc291cmNlIHx8ICcnLFxyXG5cdFx0XHRcdGdldF9yZXN0b3JlX2ZvY3VzOiBnZXRfcmVzY2hlZHVsaW5nX3Jlc3RvcmVfZm9jdXMsXHJcblx0XHRcdFx0b25fYXBwbGllZDogaGFuZGxlX2RhdGVfZWRpdG9yX2FwcGxpZWQsXHJcblx0XHRcdFx0Z2V0X3NlbmRfbW9kaWZpZWRfZW1haWxfaW50ZW50OiBnZXRfc2VuZF9tb2RpZmllZF9lbWFpbF9pbnRlbnRcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmV0dXJuIHRoZSBjdXJyZW50bHkgc2VsZWN0ZWQgdGFiIGlkZW50aWZpZXIuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBBY3RpdmUgdGFiIGlkZW50aWZpZXIuXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIGdldF9hY3RpdmVfdGFiKCkge1xyXG5cdFx0XHR2YXIgc2VsZWN0ZWRfdGFiID0gc2hlbGxfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLWluc3BlY3Rvci10YWJdW2FyaWEtc2VsZWN0ZWQ9XCJ0cnVlXCJdJyApO1xyXG5cclxuXHRcdFx0cmV0dXJuIHNlbGVjdGVkX3RhYiA/IFN0cmluZyggc2VsZWN0ZWRfdGFiLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLWluc3BlY3Rvci10YWInICkgfHwgJycgKSA6ICdkZXRhaWxzJztcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENvbGxlY3Qgb25lIHNjaGVtYSBmaWVsZCBmcm9tIHRoZSBmdWxsIEJvb2tpbmcgRGV0YWlscyBwYW5lbC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBmaWVsZHNfcm9vdCBGdWxsIGZpZWxkLWxpc3Qgcm9vdC5cclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGZpZWxkICAgICAgIEF1dGhvcml6ZWQgZmllbGQgRFRPLlxyXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfEFycmF5fSBTY2FsYXIgb3IgcmVwZWF0ZWQgZHJhZnQgdmFsdWUuXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIGNvbGxlY3RfZmllbGRfdmFsdWUoIGZpZWxkc19yb290LCBmaWVsZCApIHtcclxuXHRcdFx0dmFyIGNvbnRyb2xzID0gZmllbGRzX3Jvb3QgPyBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggZmllbGRzX3Jvb3QucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtYm9va2luZy1maWVsZD1cIicgKyBmaWVsZC5rZXkgKyAnXCJdJyApICkgOiBbXTtcclxuXHRcdFx0dmFyIHZhbHVlcztcclxuXHJcblx0XHRcdGlmICggJ2NoZWNrYm94JyA9PT0gZmllbGQudHlwZSB8fCAnYWNjZXB0YW5jZScgPT09IGZpZWxkLnR5cGUgKSB7XHJcblx0XHRcdFx0dmFsdWVzID0gY29udHJvbHMuZmlsdGVyKCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7IHJldHVybiBjb250cm9sLmNoZWNrZWQ7IH0gKS5tYXAoIGZ1bmN0aW9uICggY29udHJvbCApIHsgcmV0dXJuIGNvbnRyb2wudmFsdWU7IH0gKTtcclxuXHRcdFx0XHRyZXR1cm4gdmFsdWVzO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggJ3JhZGlvJyA9PT0gZmllbGQudHlwZSApIHtcclxuXHRcdFx0XHR2YWx1ZXMgPSBjb250cm9scy5maWx0ZXIoIGZ1bmN0aW9uICggY29udHJvbCApIHsgcmV0dXJuIGNvbnRyb2wuY2hlY2tlZDsgfSApO1xyXG5cdFx0XHRcdHJldHVybiB2YWx1ZXMubGVuZ3RoID8gdmFsdWVzWyAwIF0udmFsdWUgOiAnJztcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoICd0ZXh0JyA9PT0gZmllbGQudHlwZSAmJiBmaWVsZC5tdWx0aXBsZSApIHtcclxuXHRcdFx0XHRyZXR1cm4gY29udHJvbHMubWFwKCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7IHJldHVybiBjb250cm9sLnZhbHVlOyB9ICk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBjb250cm9scy5sZW5ndGggJiYgY29udHJvbHNbIDAgXS5tdWx0aXBsZSApIHtcclxuXHRcdFx0XHRyZXR1cm4gQXJyYXkucHJvdG90eXBlLmZpbHRlci5jYWxsKCBjb250cm9sc1sgMCBdLm9wdGlvbnMsIGZ1bmN0aW9uICggb3B0aW9uICkgeyByZXR1cm4gb3B0aW9uLnNlbGVjdGVkOyB9ICkubWFwKCBmdW5jdGlvbiAoIG9wdGlvbiApIHsgcmV0dXJuIG9wdGlvbi52YWx1ZTsgfSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gY29udHJvbHMubGVuZ3RoID8gY29udHJvbHNbIDAgXS52YWx1ZSA6ICcnO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ29sbGVjdCB0aGUgY29tcGxldGUgZGF0YS1vbmx5IEluc3BlY3RvciBkcmFmdC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IEJvb2tpbmcgZmllbGQsIG5vdGUsIGFuZCBmaW5hbmNpYWwgZHJhZnQuXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIGNvbGxlY3RfZHJhZnQoKSB7XHJcblx0XHRcdHZhciBpbnNwZWN0b3Jfcm9vdCA9IHNoZWxsX3Jvb3QucXVlcnlTZWxlY3RvciggJy53cGJjX2Jvb2tpbmdfaW5zcGVjdG9yJyApO1xyXG5cdFx0XHR2YXIgZmllbGRzX3Jvb3QgPSBpbnNwZWN0b3Jfcm9vdCA/IGluc3BlY3Rvcl9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctZGV0YWlscy1maWVsZHNdJyApIDogbnVsbDtcclxuXHRcdFx0dmFyIGRyYWZ0ID0geyBmaWVsZHM6IHt9LCBub3Rlczoge30sIGNvc3RzOiB7fSB9O1xyXG5cclxuXHRcdFx0aWYgKCAhIGluc3BlY3Rvcl9yb290IHx8ICEgYWN0aXZlX2Jvb2tpbmcgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGRyYWZ0O1xyXG5cdFx0XHR9XHJcblx0XHRcdCggYWN0aXZlX2Jvb2tpbmcuZmllbGRzIHx8IFtdICkuZm9yRWFjaCggZnVuY3Rpb24gKCBmaWVsZCApIHtcclxuXHRcdFx0XHRpZiAoICdmaWxlJyAhPT0gZmllbGQudHlwZSAmJiBmYWxzZSAhPT0gZmllbGQuZWRpdGFibGUgKSB7XHJcblx0XHRcdFx0XHRkcmFmdC5maWVsZHNbIGZpZWxkLmtleSBdID0gY29sbGVjdF9maWVsZF92YWx1ZSggZmllbGRzX3Jvb3QsIGZpZWxkICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblx0XHRcdEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoIGluc3BlY3Rvcl9yb290LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLWJvb2tpbmctbm90ZV0nICksIGZ1bmN0aW9uICggY29udHJvbCApIHtcclxuXHRcdFx0XHRpZiAoICEgY29udHJvbC5yZWFkT25seSApIHtcclxuXHRcdFx0XHRcdGRyYWZ0Lm5vdGVzWyBjb250cm9sLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLW5vdGUnICkgXSA9IGNvbnRyb2wudmFsdWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblx0XHRcdFsgJ3NhdmVkX2Nvc3QnLCAncGF5bWVudF9zdGF0dXMnIF0uZm9yRWFjaCggZnVuY3Rpb24gKCBjb3N0X2tleSApIHtcclxuXHRcdFx0XHR2YXIgY29udHJvbCA9IGluc3BlY3Rvcl9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctY29zdD1cIicgKyBjb3N0X2tleSArICdcIl06bm90KFtkaXNhYmxlZF0pJyApO1xyXG5cdFx0XHRcdGlmICggY29udHJvbCAmJiAhIGNvbnRyb2wucmVhZE9ubHkgKSB7XHJcblx0XHRcdFx0XHRkcmFmdC5jb3N0c1sgY29zdF9rZXkgXSA9IGNvbnRyb2wudmFsdWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gZHJhZnQ7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBJZGVudGlmeSBmaWVsZHMgd2hvc2UgYXV0aG9yaXRhdGl2ZSBwZXJzaXN0ZWQgdmFsdWVzIGNoYW5nZWQgYWZ0ZXIgc2F2ZS5cclxuXHRcdCAqXHJcblx0XHQgKiBUaGUgcmV0dXJuZWQgRFRPIGlzIGF1dGhvcml0YXRpdmUuIENvbXBhcmluZyBpdCB3aXRoIHRoZSBwcmV2aW91c2x5IGxvYWRlZFxyXG5cdFx0ICogRFRPIGF2b2lkcyBtYXJraW5nIHN1Ym1pdHRlZCB2YWx1ZXMgdGhhdCB0aGUgc2VydmVyIG5vcm1hbGl6ZWQgYmFjayB0byB0aGVcclxuXHRcdCAqIGNhbm9uaWNhbCB2YWx1ZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcHJldmlvdXNfYm9va2luZyBQcmV2aW91c2x5IGxvYWRlZCBhdXRob3JpemVkIGJvb2tpbmcgRFRPLlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNhdmVkX2Jvb2tpbmcgICAgQXV0aG9yaXRhdGl2ZSBwb3N0LXNhdmUgYm9va2luZyBEVE8uXHJcblx0XHQgKiBAcmV0dXJuIHtBcnJheTxzdHJpbmc+fSBPcmRlcmVkIGNoYW5nZWQgZmllbGQga2V5cyBwcmVzZW50IGFmdGVyIHNhdmUuXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIGdldF9jaGFuZ2VkX2ZpZWxkX2tleXMoIHByZXZpb3VzX2Jvb2tpbmcsIHNhdmVkX2Jvb2tpbmcgKSB7XHJcblx0XHRcdHZhciBwcmV2aW91c192YWx1ZXMgPSB7fTtcclxuXHJcblx0XHRcdCggcHJldmlvdXNfYm9va2luZyAmJiBwcmV2aW91c19ib29raW5nLmZpZWxkcyA/IHByZXZpb3VzX2Jvb2tpbmcuZmllbGRzIDogW10gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGZpZWxkICkge1xyXG5cdFx0XHRcdHByZXZpb3VzX3ZhbHVlc1sgZmllbGQua2V5IF0gPSBKU09OLnN0cmluZ2lmeSggZmllbGQudmFsdWVzIHx8IFtdICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdHJldHVybiAoIHNhdmVkX2Jvb2tpbmcgJiYgc2F2ZWRfYm9va2luZy5maWVsZHMgPyBzYXZlZF9ib29raW5nLmZpZWxkcyA6IFtdICkuZmlsdGVyKCBmdW5jdGlvbiAoIGZpZWxkICkge1xyXG5cdFx0XHRcdHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIHByZXZpb3VzX3ZhbHVlcywgZmllbGQua2V5ICkgJiZcclxuXHRcdFx0XHRcdHByZXZpb3VzX3ZhbHVlc1sgZmllbGQua2V5IF0gIT09IEpTT04uc3RyaW5naWZ5KCBmaWVsZC52YWx1ZXMgfHwgW10gKTtcclxuXHRcdFx0fSApLm1hcCggZnVuY3Rpb24gKCBmaWVsZCApIHtcclxuXHRcdFx0XHRyZXR1cm4gZmllbGQua2V5O1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBOb3RpZnkgdGhlIGFjdGl2ZSBob3N0IHRoYXQgYW4gYXV0aG9yaXRhdGl2ZSBib29raW5nIG11dGF0aW9uIGNvbXBsZXRlZC5cclxuXHRcdCAqXHJcblx0XHQgKiBUaGUgZXZlbnQgZXhwb3NlcyBvbmx5IHN0YWJsZSBpZGVudGlmaWVycyBhbmQgY2hhbmdlZCBmaWVsZCBrZXlzLiBUaW1lbGluZSxcclxuXHRcdCAqIEJvb2tpbmcgTGlzdGluZywgYW5kIGZ1dHVyZSBob3N0cyByZW1haW4gcmVzcG9uc2libGUgZm9yIHJlZnJlc2hpbmcgdGhyb3VnaFxyXG5cdFx0ICogdGhlaXIgb3duIGNhbm9uaWNhbCByZWFkIHdvcmtmbG93LiBBbiBlbXB0eSBjaGFuZ2VkLWZpZWxkIGxpc3QgcmVwcmVzZW50cyBhXHJcblx0XHQgKiBjYW5vbmljYWwgQm9va2luZyBMaXN0aW5nIGFjdGlvbiB3aG9zZSBleHRlbnNpYmxlIGFjdGlvbiBjb250cmFjdCBkb2VzIG5vdFxyXG5cdFx0ICogZXhwb3NlIGFuIGV4YWN0IGZpZWxkLWxldmVsIGRpZmYuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgICBzYXZlZF9ib29raW5nICAgICAgQXV0aG9yaXRhdGl2ZSBwb3N0LXNhdmUgYm9va2luZyBEVE8uXHJcblx0XHQgKiBAcGFyYW0ge0FycmF5PHN0cmluZz59IGNoYW5nZWRfZmllbGRfa2V5cyBQZXJzaXN0ZWQgZmllbGRzIGNoYW5nZWQgYnkgdGhlIHNhdmUuXHJcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiBkaXNwYXRjaF9ib29raW5nX3NhdmVkKCBzYXZlZF9ib29raW5nLCBjaGFuZ2VkX2ZpZWxkX2tleXMgKSB7XHJcblx0XHRcdHZhciBldmVudF9kZXRhaWw7XHJcblx0XHRcdHZhciBzYXZlZF9ldmVudDtcclxuXHJcblx0XHRcdGhvc3RfcmVmcmVzaF9nZW5lcmF0aW9uICs9IDE7XHJcblx0XHRcdGV2ZW50X2RldGFpbCA9IHtcclxuXHRcdFx0XHRib29raW5nX2lkOiBOdW1iZXIoIHNhdmVkX2Jvb2tpbmcgJiYgc2F2ZWRfYm9va2luZy5ib29raW5nX2lkID8gc2F2ZWRfYm9va2luZy5ib29raW5nX2lkIDogMCApLFxyXG5cdFx0XHRcdHNvdXJjZTogdHJhbnNwb3J0LnNvdXJjZSB8fCAnJyxcclxuXHRcdFx0XHRjaGFuZ2VkX2ZpZWxkX2tleXM6IGNoYW5nZWRfZmllbGRfa2V5cy5zbGljZSggMCApLFxyXG5cdFx0XHRcdHJlZnJlc2hfZ2VuZXJhdGlvbjogaG9zdF9yZWZyZXNoX2dlbmVyYXRpb25cclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5DdXN0b21FdmVudCApIHtcclxuXHRcdFx0XHRzYXZlZF9ldmVudCA9IG5ldyB3aW5kb3cuQ3VzdG9tRXZlbnQoIHNhdmVkX2V2ZW50X25hbWUsIHsgYnViYmxlczogdHJ1ZSwgZGV0YWlsOiBldmVudF9kZXRhaWwgfSApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHNhdmVkX2V2ZW50ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoICdDdXN0b21FdmVudCcgKTtcclxuXHRcdFx0XHRzYXZlZF9ldmVudC5pbml0Q3VzdG9tRXZlbnQoIHNhdmVkX2V2ZW50X25hbWUsIHRydWUsIGZhbHNlLCBldmVudF9kZXRhaWwgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRob3N0X3Jvb3QuZGlzcGF0Y2hFdmVudCggc2F2ZWRfZXZlbnQgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlcmVhZCBhbmQgcmVuZGVyIG9uZSBib29raW5nIGFmdGVyIERhdGUgRWRpdG9yIHBlcnNpc3RlbmNlIHN1Y2NlZWRzLlxyXG5cdFx0ICpcclxuXHRcdCAqIFRoZSBhcHBseSByZXNwb25zZSBpcyBpbnRlbnRpb25hbGx5IG5ldmVyIHJlbmRlcmVkIGFzIEluc3BlY3RvciBzdGF0ZS5cclxuXHRcdCAqIERhdGVzIE92ZXJ2aWV3IGFuZCBBY3Rpdml0eSBhcmUgcmVwbGFjZWQgb25seSBieSB0aGUgYXV0aG9yaXplZCBJbnNwZWN0b3JcclxuXHRcdCAqIERUTy4gVGhlIHJldHVybmVkIHByb21pc2UgcmVzb2x2ZXMgYWZ0ZXIgdGhhdCBjYW5vbmljYWwgcmVuZGVyLCBhbGxvd2luZ1xyXG5cdFx0ICogdGhlIERhdGUgRWRpdG9yIHRvIHJldGFpbiBkaXJ0eSBwcm90ZWN0aW9uIHdoZW4gcmVhZGJhY2sgZmFpbHMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9ICBhcHBseV9yZXN1bHQgICAgICAgICBNaW5pbWFsIGNhbm9uaWNhbCBBcHBseSByZXN1bHQuXHJcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGRpc3BhdGNoX3NhdmVkX2V2ZW50IFdoZXRoZXIgdGhlIGhvc3QgbXVzdCByZWNlaXZlIGEgc2F2ZSBldmVudC5cclxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0galF1ZXJ5LWNvbXBhdGlibGUgcHJvbWlzZSByZXNvbHZpbmcgd2l0aCB0aGUgYm9va2luZyBEVE8uXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIGhhbmRsZV9kYXRlX2VkaXRvcl9hcHBsaWVkKCBhcHBseV9yZXN1bHQsIGRpc3BhdGNoX3NhdmVkX2V2ZW50ICkge1xyXG5cdFx0XHR2YXIgZGVmZXJyZWQgPSB3aW5kb3cualF1ZXJ5LkRlZmVycmVkKCk7XHJcblx0XHRcdHZhciBleHBlY3RlZF9ib29raW5nX2lkID0gTnVtYmVyKCBhcHBseV9yZXN1bHQgJiYgYXBwbHlfcmVzdWx0LmJvb2tpbmdfaWQgPyBhcHBseV9yZXN1bHQuYm9va2luZ19pZCA6IDAgKTtcclxuXHRcdFx0dmFyIHByZXZpb3VzX3Jlc291cmNlX2lkID0gTnVtYmVyKCBhY3RpdmVfYm9va2luZyAmJiBhY3RpdmVfYm9va2luZy5yZXNvdXJjZV9pZCA/IGFjdGl2ZV9ib29raW5nLnJlc291cmNlX2lkIDogMCApO1xyXG5cdFx0XHR2YXIgcHJlc2VydmVkX3RhYiA9IGdldF9hY3RpdmVfdGFiKCk7XHJcblx0XHRcdHZhciBnZW5lcmF0aW9uO1xyXG5cdFx0XHR2YXIgcGVuZGluZ19yZWFkYmFja19yZXF1ZXN0O1xyXG5cclxuXHRcdFx0aWYgKFxyXG5cdFx0XHRcdCEgZXhwZWN0ZWRfYm9va2luZ19pZCB8fFxyXG5cdFx0XHRcdCEgYWN0aXZlX2Jvb2tpbmcgfHxcclxuXHRcdFx0XHRleHBlY3RlZF9ib29raW5nX2lkICE9PSBOdW1iZXIoIGFjdGl2ZV9ib29raW5nLmJvb2tpbmdfaWQgfHwgMCApIHx8XHJcblx0XHRcdFx0ZXhwZWN0ZWRfYm9va2luZ19pZCAhPT0gYWN0aXZlX2Jvb2tpbmdfaWQgfHxcclxuXHRcdFx0XHQhIHNoYXJlZF9pbnNwZWN0b3IuaXNfb3BlbigpIHx8XHJcblx0XHRcdFx0ISB3aW5kb3cualF1ZXJ5IHx8XHJcblx0XHRcdFx0ISB0cmFuc3BvcnQudXJsIHx8XHJcblx0XHRcdFx0ISB0cmFuc3BvcnQuYWN0aW9uIHx8XHJcblx0XHRcdFx0ISB0cmFuc3BvcnQubm9uY2UgfHxcclxuXHRcdFx0XHRpc19kaXJ0eSB8fFxyXG5cdFx0XHRcdGlzX3NhdmluZ1xyXG5cdFx0XHQpIHtcclxuXHRcdFx0XHRkZWZlcnJlZC5yZWplY3QoIHsgbWVzc2FnZTogaTE4bi5lcnJvciB8fCAnJyB9ICk7XHJcblx0XHRcdFx0cmV0dXJuIGRlZmVycmVkLnByb21pc2UoKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0YWJvcnRfcmVxdWVzdCgpO1xyXG5cdFx0XHRnZW5lcmF0aW9uID0gcmVxdWVzdF9nZW5lcmF0aW9uO1xyXG5cdFx0XHRwZW5kaW5nX3JlYWRiYWNrX3JlcXVlc3QgPSB3aW5kb3cualF1ZXJ5LmFqYXgoIHtcclxuXHRcdFx0XHR1cmw6IHRyYW5zcG9ydC51cmwsXHJcblx0XHRcdFx0bWV0aG9kOiAnUE9TVCcsXHJcblx0XHRcdFx0ZGF0YVR5cGU6ICdqc29uJyxcclxuXHRcdFx0XHRkYXRhOiB7XHJcblx0XHRcdFx0XHRhY3Rpb246IHRyYW5zcG9ydC5hY3Rpb24sXHJcblx0XHRcdFx0XHRub25jZTogdHJhbnNwb3J0Lm5vbmNlLFxyXG5cdFx0XHRcdFx0Ym9va2luZ19pZDogZXhwZWN0ZWRfYm9va2luZ19pZCxcclxuXHRcdFx0XHRcdHNvdXJjZTogdHJhbnNwb3J0LnNvdXJjZVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XHJcblx0XHRcdFx0dmFyIGNhbm9uaWNhbF9ib29raW5nO1xyXG5cclxuXHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHRnZW5lcmF0aW9uICE9PSByZXF1ZXN0X2dlbmVyYXRpb24gfHxcclxuXHRcdFx0XHRcdCEgc2hhcmVkX2luc3BlY3Rvci5pc19vcGVuKCkgfHxcclxuXHRcdFx0XHRcdCEgcmVzcG9uc2UgfHxcclxuXHRcdFx0XHRcdCEgcmVzcG9uc2Uuc3VjY2VzcyB8fFxyXG5cdFx0XHRcdFx0ISByZXNwb25zZS5kYXRhIHx8XHJcblx0XHRcdFx0XHQhIHJlc3BvbnNlLmRhdGEuYm9va2luZ1xyXG5cdFx0XHRcdCkge1xyXG5cdFx0XHRcdFx0ZGVmZXJyZWQucmVqZWN0KCB7IG1lc3NhZ2U6IGkxOG4uZXJyb3IgfHwgJycgfSApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjYW5vbmljYWxfYm9va2luZyA9IHJlc3BvbnNlLmRhdGEuYm9va2luZztcclxuXHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHRleHBlY3RlZF9ib29raW5nX2lkICE9PSBOdW1iZXIoIGNhbm9uaWNhbF9ib29raW5nLmJvb2tpbmdfaWQgfHwgMCApIHx8XHJcblx0XHRcdFx0XHRleHBlY3RlZF9ib29raW5nX2lkICE9PSBhY3RpdmVfYm9va2luZ19pZFxyXG5cdFx0XHRcdCkge1xyXG5cdFx0XHRcdFx0ZGVmZXJyZWQucmVqZWN0KCB7IG1lc3NhZ2U6IGkxOG4uZXJyb3IgfHwgJycgfSApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmVuZGVyX2Jvb2tpbmcoIGNhbm9uaWNhbF9ib29raW5nLCBpMThuLnNhdmVkIHx8ICcnLCBwcmVzZXJ2ZWRfdGFiICk7XHJcblx0XHRcdFx0aWYgKCBhcHBseV9yZXN1bHQuY2hhbmdlZCAmJiBmYWxzZSAhPT0gZGlzcGF0Y2hfc2F2ZWRfZXZlbnQgKSB7XHJcblx0XHRcdFx0XHR2YXIgY2hhbmdlZF9maWVsZF9rZXlzID0gWyAnYm9va2luZ19kYXRlcycgXTtcclxuXHJcblx0XHRcdFx0XHRpZiAoIHByZXZpb3VzX3Jlc291cmNlX2lkICYmIHByZXZpb3VzX3Jlc291cmNlX2lkICE9PSBOdW1iZXIoIGNhbm9uaWNhbF9ib29raW5nLnJlc291cmNlX2lkIHx8IDAgKSApIHtcclxuXHRcdFx0XHRcdFx0Y2hhbmdlZF9maWVsZF9rZXlzLnB1c2goICdib29raW5nX3Jlc291cmNlJyApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0ZGlzcGF0Y2hfYm9va2luZ19zYXZlZCggY2Fub25pY2FsX2Jvb2tpbmcsIGNoYW5nZWRfZmllbGRfa2V5cyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRkZWZlcnJlZC5yZXNvbHZlKCBjYW5vbmljYWxfYm9va2luZyApO1xyXG5cdFx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCBmYWlsZWRfcmVxdWVzdCwgcmVxdWVzdF9zdGF0dXMgKSB7XHJcblx0XHRcdFx0aWYgKCAnYWJvcnQnID09PSByZXF1ZXN0X3N0YXR1cyB8fCBnZW5lcmF0aW9uICE9PSByZXF1ZXN0X2dlbmVyYXRpb24gKSB7XHJcblx0XHRcdFx0XHRkZWZlcnJlZC5yZWplY3QoIHsgbWVzc2FnZTogaTE4bi5lcnJvciB8fCAnJyB9ICk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGRlZmVycmVkLnJlamVjdCggeyBtZXNzYWdlOiBnZXRfc2F2ZV9lcnJvcl9tZXNzYWdlKCBmYWlsZWRfcmVxdWVzdCwgJycgKSB9ICk7XHJcblx0XHRcdH0gKS5hbHdheXMoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRpZiAoIHJlcXVlc3QgPT09IHBlbmRpbmdfcmVhZGJhY2tfcmVxdWVzdCApIHtcclxuXHRcdFx0XHRcdHJlcXVlc3QgPSBudWxsO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdFx0XHRyZXF1ZXN0ID0gcGVuZGluZ19yZWFkYmFja19yZXF1ZXN0O1xyXG5cclxuXHRcdFx0cmV0dXJuIGRlZmVycmVkLnByb21pc2UoKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlcmVhZCBhbiBvcGVuIG1hdGNoaW5nIEluc3BlY3RvciBhZnRlciBhbiBleHRlcm5hbCBjYW5vbmljYWwgbXV0YXRpb24uXHJcblx0XHQgKlxyXG5cdFx0ICogQ2xvc2VkIG9yIHVucmVsYXRlZCBJbnNwZWN0b3JzIHJlc29sdmUgd2l0aG91dCB3b3JrLiBUaGUgY2FsbGVyIGFscmVhZHlcclxuXHRcdCAqIG93bnMgVGltZWxpbmUgYW5kIE92ZXJ2aWV3IHJlZnJlc2gsIHNvIHRoaXMgcmVhZGJhY2sgZGVsaWJlcmF0ZWx5IGRvZXNcclxuXHRcdCAqIG5vdCBkaXNwYXRjaCB0aGUgbm9ybWFsIEluc3BlY3Rvci1zYXZlZCBob3N0IGV2ZW50LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBhcHBseV9yZXN1bHQgQ2Fub25pY2FsIEFwcGx5IHJlc3VsdC5cclxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0galF1ZXJ5LWNvbXBhdGlibGUgcHJvbWlzZSBmb3IgdGhlIG9wdGlvbmFsIHJlYWRiYWNrLlxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiByZWZyZXNoX2FmdGVyX2V4dGVybmFsX2FwcGx5KCBhcHBseV9yZXN1bHQgKSB7XHJcblx0XHRcdHZhciBkZWZlcnJlZCA9IHdpbmRvdy5qUXVlcnkuRGVmZXJyZWQoKTtcclxuXHRcdFx0dmFyIGJvb2tpbmdfaWQgPSBOdW1iZXIoIGFwcGx5X3Jlc3VsdCAmJiBhcHBseV9yZXN1bHQuYm9va2luZ19pZCA/IGFwcGx5X3Jlc3VsdC5ib29raW5nX2lkIDogMCApO1xyXG5cclxuXHRcdFx0aWYgKCAhIGJvb2tpbmdfaWQgfHwgYm9va2luZ19pZCAhPT0gYWN0aXZlX2Jvb2tpbmdfaWQgfHwgISBzaGFyZWRfaW5zcGVjdG9yLmlzX29wZW4oKSApIHtcclxuXHRcdFx0XHRkZWZlcnJlZC5yZXNvbHZlKCk7XHJcblx0XHRcdFx0cmV0dXJuIGRlZmVycmVkLnByb21pc2UoKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIGhhbmRsZV9kYXRlX2VkaXRvcl9hcHBsaWVkKCBhcHBseV9yZXN1bHQsIGZhbHNlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBVcGRhdGUgZm9vdGVyIGNvbnRyb2xzIGZyb20gdGhlIGN1cnJlbnQgZHJhZnQgc3RhdGUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gdXBkYXRlX2RpcnR5X3N0YXRlKCkge1xyXG5cdFx0XHR2YXIgaW5zcGVjdG9yX3Jvb3QgPSBzaGVsbF9yb290LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19ib29raW5nX2luc3BlY3RvcicgKTtcclxuXHRcdFx0dmFyIHNhdmVfYnV0dG9uID0gaW5zcGVjdG9yX3Jvb3QgPyBpbnNwZWN0b3Jfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLWluc3BlY3Rvci1zYXZlXScgKSA6IG51bGw7XHJcblx0XHRcdHZhciBjYW5jZWxfYnV0dG9uID0gaW5zcGVjdG9yX3Jvb3QgPyBpbnNwZWN0b3Jfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLWluc3BlY3Rvci1jYW5jZWxdJyApIDogbnVsbDtcclxuXHJcblx0XHRcdGlzX2RpcnR5ID0gSlNPTi5zdHJpbmdpZnkoIGNvbGxlY3RfZHJhZnQoKSApICE9PSBjbGVhbl9kcmFmdF9qc29uO1xyXG5cdFx0XHRpZiAoIHNhdmVfYnV0dG9uICkge1xyXG5cdFx0XHRcdHNhdmVfYnV0dG9uLmRpc2FibGVkID0gISBpc19kaXJ0eSB8fCBpc19zYXZpbmc7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBjYW5jZWxfYnV0dG9uICkge1xyXG5cdFx0XHRcdGNhbmNlbF9idXR0b24uZGlzYWJsZWQgPSAhIGlzX2RpcnR5IHx8IGlzX3NhdmluZztcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogVGVtcG9yYXJpbHkgbG9jayBjb250cm9scyB0aGF0IGJlbG9uZyB0byB0aGUgc3VibWl0dGVkIGJvb2tpbmcgZHJhZnQuXHJcblx0XHQgKlxyXG5cdFx0ICogT25seSBjb250cm9scyB0aGF0IHdlcmUgZW5hYmxlZCBiZWZvcmUgdGhlIHJlcXVlc3QgcmVjZWl2ZSB0aGUgbWFya2VyLCBzb1xyXG5cdFx0ICogc2VydmVyLWRpc2FibGVkIGNvbnRyb2xzIHJlbWFpbiBkaXNhYmxlZCBhZnRlciBmYWlsdXJlLlxyXG5cdFx0ICogVGhpcyBwcmV2ZW50cyBhbiBpbi1mbGlnaHQgZWRpdCBmcm9tIGJlaW5nIHNpbGVudGx5IHJlcGxhY2VkIGJ5IHRoZVxyXG5cdFx0ICogYXV0aG9yaXRhdGl2ZSBEVE8gcmV0dXJuZWQgZm9yIGFuIGVhcmxpZXIgc3VibWl0dGVkIGRyYWZ0LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfbG9ja2VkIFdoZXRoZXIgdGhlIHN1Ym1pdHRlZCBkcmFmdCBpcyBiZWluZyBzYXZlZC5cclxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHNldF9kcmFmdF9jb250cm9sc19sb2NrZWQoIGlzX2xvY2tlZCApIHtcclxuXHRcdFx0dmFyIGluc3BlY3Rvcl9yb290ID0gc2hlbGxfcm9vdC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYm9va2luZ19pbnNwZWN0b3InICk7XHJcblx0XHRcdHZhciBjb250cm9scyA9IGluc3BlY3Rvcl9yb290ID8gaW5zcGVjdG9yX3Jvb3QucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtYm9va2luZy1maWVsZF0sIFtkYXRhLXdwYmMtYm9va2luZy1ub3RlXSwgW2RhdGEtd3BiYy1ib29raW5nLWNvc3RdJyApIDogW107XHJcblxyXG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBjb250cm9scywgZnVuY3Rpb24gKCBjb250cm9sICkge1xyXG5cdFx0XHRcdGlmICggaXNfbG9ja2VkICYmICEgY29udHJvbC5kaXNhYmxlZCApIHtcclxuXHRcdFx0XHRcdGNvbnRyb2wuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJvb2tpbmctaW5zcGVjdG9yLXNhdmUtbG9jaycsICd0cnVlJyApO1xyXG5cdFx0XHRcdFx0Y29udHJvbC5kaXNhYmxlZCA9IHRydWU7XHJcblx0XHRcdFx0fSBlbHNlIGlmICggISBpc19sb2NrZWQgJiYgY29udHJvbC5oYXNBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYm9va2luZy1pbnNwZWN0b3Itc2F2ZS1sb2NrJyApICkge1xyXG5cdFx0XHRcdFx0Y29udHJvbC5yZW1vdmVBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYm9va2luZy1pbnNwZWN0b3Itc2F2ZS1sb2NrJyApO1xyXG5cdFx0XHRcdFx0Y29udHJvbC5kaXNhYmxlZCA9IGZhbHNlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUHJlc2VudCBvbmUgYm9va2luZy1zYXZlIHN0YXRlIGluIHRoZSBkb21haW4tb3duZWQgc3RpY2t5IGZvb3Rlci5cclxuXHRcdCAqXHJcblx0XHQgKiBUaGUgYnV0dG9uIGV4cG9zZXMgaXRzIGJ1c3kgc3RhdGUgc2VwYXJhdGVseSBmcm9tIHRoZSBsaXZlIHJlc3VsdCBtZXNzYWdlLFxyXG5cdFx0ICogc28gc2lnaHRlZCBhbmQgYXNzaXN0aXZlLXRlY2hub2xvZ3kgdXNlcnMgcmVjZWl2ZSB0aGUgc2FtZSBwcm9ncmVzcyBhbmRcclxuXHRcdCAqIGNvbXBsZXRpb24gZmVlZGJhY2sgd2l0aG91dCBhZGRpbmcgYm9va2luZyBiZWhhdmlvciB0byB0aGUgc2hhcmVkIHNoZWxsLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBzdGF0ZSAgIFN0YWJsZSBpZGxlLCBzYXZpbmcsIHN1Y2Nlc3MsIG9yIGVycm9yIHN0YXRlLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgTG9jYWxpemVkIHNhZmUgc3RhdHVzIG9yIGVycm9yIG1lc3NhZ2UuXHJcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiBzZXRfc2F2ZV9mZWVkYmFjayggc3RhdGUsIG1lc3NhZ2UgKSB7XHJcblx0XHRcdHZhciBpbnNwZWN0b3Jfcm9vdCA9IHNoZWxsX3Jvb3QucXVlcnlTZWxlY3RvciggJy53cGJjX2Jvb2tpbmdfaW5zcGVjdG9yJyApO1xyXG5cdFx0XHR2YXIgc2F2ZV9idXR0b24gPSBpbnNwZWN0b3Jfcm9vdCA/IGluc3BlY3Rvcl9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctaW5zcGVjdG9yLXNhdmVdJyApIDogbnVsbDtcclxuXHRcdFx0dmFyIHNhdmVfbGFiZWwgPSBzYXZlX2J1dHRvbiA/IHNhdmVfYnV0dG9uLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctaW5zcGVjdG9yLXNhdmUtbGFiZWxdJyApIDogbnVsbDtcclxuXHRcdFx0dmFyIHNhdmVfc3Bpbm5lciA9IHNhdmVfYnV0dG9uID8gc2F2ZV9idXR0b24ucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1pbnNwZWN0b3Itc2F2ZS1zcGlubmVyXScgKSA6IG51bGw7XHJcblx0XHRcdHZhciBzdGF0dXNfbWVzc2FnZSA9IGluc3BlY3Rvcl9yb290ID8gaW5zcGVjdG9yX3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1pbnNwZWN0b3ItbWVzc2FnZV0nICkgOiBudWxsO1xyXG5cdFx0XHR2YXIgaXNfYnVzeSA9ICdzYXZpbmcnID09PSBzdGF0ZTtcclxuXHRcdFx0dmFyIHNhZmVfbWVzc2FnZSA9IFN0cmluZyggbWVzc2FnZSB8fCAnJyApO1xyXG5cclxuXHRcdFx0Y2xlYXJfc2F2ZV9mZWVkYmFja190aW1lcigpO1xyXG5cclxuXHRcdFx0aWYgKCBpbnNwZWN0b3Jfcm9vdCApIHtcclxuXHRcdFx0XHRpbnNwZWN0b3Jfcm9vdC5zZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knLCBpc19idXN5ID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggc2F2ZV9idXR0b24gKSB7XHJcblx0XHRcdFx0c2F2ZV9idXR0b24uc2V0QXR0cmlidXRlKCAnYXJpYS1idXN5JywgaXNfYnVzeSA/ICd0cnVlJyA6ICdmYWxzZScgKTtcclxuXHRcdFx0XHRzYXZlX2J1dHRvbi5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtc2F2aW5nJywgaXNfYnVzeSApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggc2F2ZV9sYWJlbCApIHtcclxuXHRcdFx0XHRzYXZlX2xhYmVsLnRleHRDb250ZW50ID0gaXNfYnVzeSA/ICggaTE4bi5zYXZpbmdfYnV0dG9uIHx8IGkxOG4uc2F2aW5nIHx8IGkxOG4uc2F2ZV9jaGFuZ2VzIHx8ICcnICkgOiAoIGkxOG4uc2F2ZV9jaGFuZ2VzIHx8ICcnICk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBzYXZlX3NwaW5uZXIgKSB7XHJcblx0XHRcdFx0c2F2ZV9zcGlubmVyLmhpZGRlbiA9ICEgaXNfYnVzeTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIHN0YXR1c19tZXNzYWdlICkge1xyXG5cdFx0XHRcdHN0YXR1c19tZXNzYWdlLmhpZGRlbiA9ICEgc2FmZV9tZXNzYWdlO1xyXG5cdFx0XHRcdHN0YXR1c19tZXNzYWdlLnRleHRDb250ZW50ID0gc2FmZV9tZXNzYWdlO1xyXG5cdFx0XHRcdHN0YXR1c19tZXNzYWdlLmNsYXNzTGlzdC50b2dnbGUoICdpcy1zdWNjZXNzJywgJ3N1Y2Nlc3MnID09PSBzdGF0ZSApO1xyXG5cdFx0XHRcdHN0YXR1c19tZXNzYWdlLmNsYXNzTGlzdC50b2dnbGUoICdpcy1lcnJvcicsICdlcnJvcicgPT09IHN0YXRlICk7XHJcblx0XHRcdFx0c3RhdHVzX21lc3NhZ2Uuc2V0QXR0cmlidXRlKCAncm9sZScsICdlcnJvcicgPT09IHN0YXRlID8gJ2FsZXJ0JyA6ICdzdGF0dXMnICk7XHJcblx0XHRcdFx0c3RhdHVzX21lc3NhZ2Uuc2V0QXR0cmlidXRlKCAnYXJpYS1saXZlJywgJ2Vycm9yJyA9PT0gc3RhdGUgPyAnYXNzZXJ0aXZlJyA6ICdwb2xpdGUnICk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCAnc3VjY2VzcycgPT09IHN0YXRlICYmIHNhZmVfbWVzc2FnZSApIHtcclxuXHRcdFx0XHRzYXZlX2ZlZWRiYWNrX3RpbWVyID0gd2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdHZhciBjdXJyZW50X21lc3NhZ2U7XHJcblxyXG5cdFx0XHRcdFx0c2F2ZV9mZWVkYmFja190aW1lciA9IG51bGw7XHJcblx0XHRcdFx0XHRpZiAoICEgc2hhcmVkX2luc3BlY3Rvci5pc19vcGVuKCkgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGN1cnJlbnRfbWVzc2FnZSA9IHNoZWxsX3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1pbnNwZWN0b3ItbWVzc2FnZV0uaXMtc3VjY2VzcycgKTtcclxuXHRcdFx0XHRcdGlmICggY3VycmVudF9tZXNzYWdlICkge1xyXG5cdFx0XHRcdFx0XHRzZXRfc2F2ZV9mZWVkYmFjayggJ2lkbGUnLCAnJyApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0sIHNhdmVfc3VjY2Vzc19tZXNzYWdlX2R1cmF0aW9uX21zICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlYWQgb25lIHNhZmUgbWVzc2FnZSBmcm9tIHRoZSBub3JtYWxpemVkIFdvcmRQcmVzcyBBSkFYIGVycm9yIGNvbnRyYWN0LlxyXG5cdFx0ICpcclxuXHRcdCAqIFJhdyByZXNwb25zZSB0ZXh0IGlzIGludGVudGlvbmFsbHkgaWdub3JlZCBiZWNhdXNlIGEgZmFpbGVkIFBIUCByZXF1ZXN0IG1heVxyXG5cdFx0ICogY29udGFpbiBzZW5zaXRpdmUgZGlhZ25vc3RpY3Mgb3IgbWFya3VwIHRoYXQgZG9lcyBub3QgYmVsb25nIGluIHRoZSBVSS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZmFpbGVkX3JlcXVlc3QgICBqUXVlcnkgQUpBWCByZXF1ZXN0IGNhcnJ5aW5nIHJlc3BvbnNlSlNPTi5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBmYWxsYmFja19tZXNzYWdlIE9wdGlvbmFsIGxvY2FsaXplZCBmYWxsYmFjay5cclxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gU2VydmVyLXByb3ZpZGVkIHNhZmUgcmVhc29uIG9yIHRoZSBsb2NhbGl6ZWQgZmFsbGJhY2suXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIGdldF9zYXZlX2Vycm9yX21lc3NhZ2UoIGZhaWxlZF9yZXF1ZXN0LCBmYWxsYmFja19tZXNzYWdlICkge1xyXG5cdFx0XHR2YXIgcmVzcG9uc2UgPSBmYWlsZWRfcmVxdWVzdCAmJiBmYWlsZWRfcmVxdWVzdC5yZXNwb25zZUpTT04gPyBmYWlsZWRfcmVxdWVzdC5yZXNwb25zZUpTT04gOiB7fTtcclxuXHRcdFx0dmFyIGVycm9yX2RhdGEgPSByZXNwb25zZSAmJiByZXNwb25zZS5kYXRhID8gcmVzcG9uc2UuZGF0YSA6IHt9O1xyXG5cclxuXHRcdFx0aWYgKCBBcnJheS5pc0FycmF5KCBlcnJvcl9kYXRhICkgKSB7XHJcblx0XHRcdFx0ZXJyb3JfZGF0YSA9IGVycm9yX2RhdGEubGVuZ3RoID8gZXJyb3JfZGF0YVsgMCBdIDoge307XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBlcnJvcl9kYXRhICYmICdzdHJpbmcnID09PSB0eXBlb2YgZXJyb3JfZGF0YS5tZXNzYWdlICYmIGVycm9yX2RhdGEubWVzc2FnZSApIHtcclxuXHRcdFx0XHRyZXR1cm4gZXJyb3JfZGF0YS5tZXNzYWdlO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggcmVzcG9uc2UgJiYgJ3N0cmluZycgPT09IHR5cGVvZiByZXNwb25zZS5tZXNzYWdlICYmIHJlc3BvbnNlLm1lc3NhZ2UgKSB7XHJcblx0XHRcdFx0cmV0dXJuIHJlc3BvbnNlLm1lc3NhZ2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiAnc3RyaW5nJyA9PT0gdHlwZW9mIGZhbGxiYWNrX21lc3NhZ2UgPyBmYWxsYmFja19tZXNzYWdlIDogKCBpMThuLnNhdmVfZXJyb3IgfHwgJycgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlbmRlciBvbmUgc3RhbmRhcmRpemVkIGJvb2tpbmctZG9tYWluIHN0YXRlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgc3RhdGUgICBTdGFibGUgbG9hZGluZywgZW1wdHksIHVuc3VwcG9ydGVkLCBvciBlcnJvciBzdGF0ZS5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgbWVzc2FnZSBMb2NhbGl6ZWQgc2FmZSBzdGF0ZSBtZXNzYWdlLlxyXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBpc19idXN5IFdoZXRoZXIgdGhlIHNoYXJlZCBzaGVsbCByZW1haW5zIGJ1c3kuXHJcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiByZW5kZXJfc3RhdGUoIHN0YXRlLCBtZXNzYWdlLCBpc19idXN5ICkge1xyXG5cdFx0XHRpZiAoICdsb2FkaW5nJyA9PT0gc3RhdGUgKSB7XHJcblx0XHRcdFx0c2hhcmVkX2luc3BlY3Rvci5zZXRfbG9hZGluZyggbWVzc2FnZSB8fCAnJyApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dmFyIGljb25fY2xhc3NlcyA9IHtcclxuXHRcdFx0XHRlbXB0eTogJ3dwYmMtYmktaW5ib3gnLFxyXG5cdFx0XHRcdHVuc3VwcG9ydGVkOiAnd3BiYy1iaS1pbmZvLWNpcmNsZScsXHJcblx0XHRcdFx0ZXJyb3I6ICd3cGJjLWJpLWV4Y2xhbWF0aW9uLXRyaWFuZ2xlJ1xyXG5cdFx0XHR9O1xyXG5cdFx0XHR2YXIgcmVuZGVyZWRfc3RhdGUgPSBzdGF0ZV90ZW1wbGF0ZSgge1xyXG5cdFx0XHRcdHN0YXRlOiBzdGF0ZSxcclxuXHRcdFx0XHRtZXNzYWdlOiBtZXNzYWdlIHx8ICcnLFxyXG5cdFx0XHRcdGljb25fY2xhc3M6IGljb25fY2xhc3Nlc1sgc3RhdGUgXSB8fCAnJ1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiBzaGFyZWRfaW5zcGVjdG9yLnNldF9zdGF0ZSApIHtcclxuXHRcdFx0XHRzaGFyZWRfaW5zcGVjdG9yLnNldF9zdGF0ZSggcmVuZGVyZWRfc3RhdGUsIG1lc3NhZ2UgfHwgJycsIEJvb2xlYW4oIGlzX2J1c3kgKSApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHNoYXJlZF9pbnNwZWN0b3Iuc2V0X2NvbnRlbnQoIHJlbmRlcmVkX3N0YXRlLCBtZXNzYWdlIHx8ICcnICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENvbXBvc2UgYWxsIGFsbG93LWxpc3RlZCBib29raW5nLWRvbWFpbiB0ZW1wbGF0ZXMgZm9yIG9uZSBEVE8uXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGJvb2tpbmdfZHRvIEF1dGhvcml6ZWQgYm9va2luZyBEVE8uXHJcblx0XHQgKiBAcGFyYW0ge0FycmF5PHN0cmluZz59IHJlY2VudGx5X2NoYW5nZWRfZmllbGRfa2V5cyBGaWVsZHMgY2hhbmdlZCBieSB0aGUgY29tcGxldGVkIHNhdmUuXHJcblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IENvbXBsZXRlIEluc3BlY3RvciBhcnRpY2xlIG1hcmt1cC5cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX2Jvb2tpbmdfdGVtcGxhdGVzKCBib29raW5nX2R0bywgcmVjZW50bHlfY2hhbmdlZF9maWVsZF9rZXlzICkge1xyXG5cdFx0XHR2YXIgdmlld19kYXRhID0gT2JqZWN0LmFzc2lnbigge30sIGJvb2tpbmdfZHRvLCB7IGkxOG46IGkxOG4gfSApO1xyXG5cdFx0XHR2YXIgY2hhbmdlZF9maWVsZF9rZXlzID0gQXJyYXkuaXNBcnJheSggcmVjZW50bHlfY2hhbmdlZF9maWVsZF9rZXlzICkgPyByZWNlbnRseV9jaGFuZ2VkX2ZpZWxkX2tleXMgOiBbXTtcclxuXHRcdFx0dmFyIGluc3BlY3Rvcl9pZCA9ICd3cGJjX2Jvb2tpbmdfaW5zcGVjdG9yXycgKyBOdW1iZXIoIGJvb2tpbmdfZHRvLmJvb2tpbmdfaWQgfHwgMCApO1xyXG5cdFx0XHR2YXIgY29zdHNfc3VwcG9ydGVkID0gQm9vbGVhbiggYm9va2luZ19kdG8uY29zdHMgJiYgYm9va2luZ19kdG8uY29zdHMuc3VwcG9ydGVkICk7XHJcblx0XHRcdHZhciBhY3Rpdml0eSA9IGJvb2tpbmdfZHRvLmFjdGl2aXR5ICYmIGJvb2tpbmdfZHRvLmFjdGl2aXR5LmV2ZW50cyA/IGJvb2tpbmdfZHRvLmFjdGl2aXR5IDogeyBldmVudHM6IFtdLCBwYWdpbmF0aW9uOiB7fSB9O1xyXG5cdFx0XHR2YXIgZW1wdHlfc3RhdGVfaHRtbCA9IHN0YXRlX3RlbXBsYXRlKCB7IHN0YXRlOiAnZW1wdHknLCBtZXNzYWdlOiBpMThuLm5vdF9hdmFpbGFibGUgfHwgJycsIGljb25fY2xhc3M6ICd3cGJjLWJpLWluYm94JyB9ICk7XHJcblx0XHRcdHZhciBub3Rlc19lbXB0eV9zdGF0ZV9odG1sID0gc3RhdGVfdGVtcGxhdGUoIHsgc3RhdGU6ICdlbXB0eScsIG1lc3NhZ2U6IGkxOG4ubm9fbm90ZXMgfHwgJycsIGljb25fY2xhc3M6ICd3cGJjLWJpLWluYm94JyB9ICk7XHJcblx0XHRcdHZhciBhY3Rpdml0eV9lbXB0eV9zdGF0ZV9odG1sID0gc3RhdGVfdGVtcGxhdGUoIHsgc3RhdGU6ICdlbXB0eScsIG1lc3NhZ2U6IGkxOG4ubm9fYWN0aXZpdHkgfHwgJycsIGljb25fY2xhc3M6ICd3cGJjLWJpLWluYm94JyB9ICk7XHJcblx0XHRcdHZhciBmaWVsZF9yb3dzX2h0bWwgPSAoIGJvb2tpbmdfZHRvLmZpZWxkcyB8fCBbXSApLm1hcCggZnVuY3Rpb24gKCBmaWVsZCwgZmllbGRfaW5kZXggKSB7XHJcblx0XHRcdFx0cmV0dXJuIGJvb2tpbmdfZmllbGRfcm93X3RlbXBsYXRlKCB7XHJcblx0XHRcdFx0XHRmaWVsZDogZmllbGQsXHJcblx0XHRcdFx0XHRmaWVsZF9pZDogaW5zcGVjdG9yX2lkICsgJ19maWVsZF8nICsgZmllbGRfaW5kZXgsXHJcblx0XHRcdFx0XHRjYW5fZWRpdF9maWVsZHM6IEJvb2xlYW4oIGJvb2tpbmdfZHRvLmFjdGlvbnMgJiYgYm9va2luZ19kdG8uYWN0aW9ucy5jYW5fZWRpdF9maWVsZHMgKSxcclxuXHRcdFx0XHRcdHJlY2VudGx5X2NoYW5nZWQ6IC0xICE9PSBjaGFuZ2VkX2ZpZWxkX2tleXMuaW5kZXhPZiggZmllbGQua2V5ICksXHJcblx0XHRcdFx0XHRpMThuOiBpMThuXHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9ICkuam9pbiggJycgKTtcclxuXHRcdFx0dmFyIG5vdGVzX2h0bWwgPSBub3Rlc190ZW1wbGF0ZSggT2JqZWN0LmFzc2lnbigge30sIHZpZXdfZGF0YSwgeyBlbXB0eV9zdGF0ZV9odG1sOiBub3Rlc19lbXB0eV9zdGF0ZV9odG1sIH0gKSApO1xyXG5cdFx0XHR2YXIgc3lzdGVtX2luZm9ybWF0aW9uX2h0bWwgPSBzeXN0ZW1faW5mb3JtYXRpb25fdGVtcGxhdGUoIHZpZXdfZGF0YSApO1xyXG5cdFx0XHR2YXIgaW50ZXJ2YWxzID0gYm9va2luZ19kdG8uZGF0ZXMgJiYgQXJyYXkuaXNBcnJheSggYm9va2luZ19kdG8uZGF0ZXMuaW50ZXJ2YWxzICkgPyBib29raW5nX2R0by5kYXRlcy5pbnRlcnZhbHMgOiBbXTtcclxuXHRcdFx0dmFyIGhlYWRlcl9kdXJhdGlvbl9sYWJlbCA9IDEgPT09IGludGVydmFscy5sZW5ndGggJiYgaW50ZXJ2YWxzWyAwIF0uZHVyYXRpb25fbGFiZWxcclxuXHRcdFx0XHQ/IGludGVydmFsc1sgMCBdLmR1cmF0aW9uX2xhYmVsXHJcblx0XHRcdFx0OiAoIGJvb2tpbmdfZHRvLmRhdGVzICYmIGJvb2tpbmdfZHRvLmRhdGVzLnN1bW1hcnkgPyBib29raW5nX2R0by5kYXRlcy5zdW1tYXJ5LnNlbGVjdGVkX2RhdGVzX2xhYmVsIDogJycgKTtcclxuXHRcdFx0dmFyIGhlYWRlcl92aWV3X2RhdGEgPSBPYmplY3QuYXNzaWduKCB7fSwgdmlld19kYXRhLCB7XHJcblx0XHRcdFx0Y29zdHNfc3VwcG9ydGVkOiBjb3N0c19zdXBwb3J0ZWQsXHJcblx0XHRcdFx0aGVhZGVyX2R1cmF0aW9uX2xhYmVsOiBoZWFkZXJfZHVyYXRpb25fbGFiZWxcclxuXHRcdFx0fSApO1xyXG5cdFx0XHR2YXIgZm9vdGVyX3ZpZXdfZGF0YSA9IE9iamVjdC5hc3NpZ24oIHt9LCBib29raW5nX2R0by5hY3Rpb25fY29udGV4dCB8fCB7fSwge1xyXG5cdFx0XHRcdGNhbl91cGRhdGU6IEJvb2xlYW4oIGJvb2tpbmdfZHRvLmFjdGlvbnMgJiYgYm9va2luZ19kdG8uYWN0aW9ucy5jYW5fdXBkYXRlICksXHJcblx0XHRcdFx0aTE4bjogaTE4blxyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gZGV0YWlsc190ZW1wbGF0ZSgge1xyXG5cdFx0XHRcdGJvb2tpbmdfaWQ6IGJvb2tpbmdfZHRvLmJvb2tpbmdfaWQsXHJcblx0XHRcdFx0aGVhZGVyX2h0bWw6IGhlYWRlcl90ZW1wbGF0ZSggdmlld19kYXRhICksXHJcblx0XHRcdFx0cmVzb3VyY2VfaHRtbDogcmVzb3VyY2VfdGVtcGxhdGUoIGhlYWRlcl92aWV3X2RhdGEgKSxcclxuXHRcdFx0XHR0YWJzX2h0bWw6IHRhYnNfdGVtcGxhdGUoIHsgaW5zcGVjdG9yX2lkOiBpbnNwZWN0b3JfaWQsIGNvc3RzX3N1cHBvcnRlZDogY29zdHNfc3VwcG9ydGVkLCBpMThuOiBpMThuIH0gKSxcclxuXHRcdFx0XHRib29raW5nX2ZpZWxkc19odG1sOiBib29raW5nX2ZpZWxkc190ZW1wbGF0ZSggT2JqZWN0LmFzc2lnbigge30sIHZpZXdfZGF0YSwgeyBpbnNwZWN0b3JfaWQ6IGluc3BlY3Rvcl9pZCwgZmllbGRfcm93c19odG1sOiBmaWVsZF9yb3dzX2h0bWwsIGVtcHR5X3N0YXRlX2h0bWw6IGVtcHR5X3N0YXRlX2h0bWwsIG5vdGVzX2h0bWw6IG5vdGVzX2h0bWwsIHN5c3RlbV9pbmZvcm1hdGlvbl9odG1sOiBzeXN0ZW1faW5mb3JtYXRpb25faHRtbCB9ICkgKSxcclxuXHRcdFx0XHRkYXRlc19odG1sOiBkYXRlc190ZW1wbGF0ZSggT2JqZWN0LmFzc2lnbigge30sIHZpZXdfZGF0YSwge1xyXG5cdFx0XHRcdFx0aW5zcGVjdG9yX2lkOiBpbnNwZWN0b3JfaWQsXHJcblx0XHRcdFx0XHRlbXB0eV9zdGF0ZV9odG1sOiBlbXB0eV9zdGF0ZV9odG1sLFxyXG5cdFx0XHRcdH0gKSApLFxyXG5cdFx0XHRcdGNvc3RzX2h0bWw6IGNvc3RzX3N1cHBvcnRlZCA/IGNvc3RzX3RlbXBsYXRlKCBPYmplY3QuYXNzaWduKCB7fSwgdmlld19kYXRhLCB7IGluc3BlY3Rvcl9pZDogaW5zcGVjdG9yX2lkLCBjb3N0c19zdXBwb3J0ZWQ6IHRydWUgfSApICkgOiAnJyxcclxuXHRcdFx0XHRhY3Rpdml0eV9odG1sOiBhY3Rpdml0eV90ZW1wbGF0ZSggT2JqZWN0LmFzc2lnbigge30sIHZpZXdfZGF0YSwgeyBpbnNwZWN0b3JfaWQ6IGluc3BlY3Rvcl9pZCwgYWN0aXZpdHk6IGFjdGl2aXR5LCBlbXB0eV9zdGF0ZV9odG1sOiBhY3Rpdml0eV9lbXB0eV9zdGF0ZV9odG1sIH0gKSApLFxyXG5cdFx0XHRcdGZvb3Rlcl9odG1sOiBmb290ZXJfdGVtcGxhdGUoIGZvb3Rlcl92aWV3X2RhdGEgKVxyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZW5kZXIgYW4gYXV0aG9yaXRhdGl2ZSBEVE8gYW5kIGluaXRpYWxpemUgaXRzIGxvY2FsIGludGVyYWN0aW9ucy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gYm9va2luZ19kdG8gQXV0aG9yaXplZCBib29raW5nIERUTy5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBhbm5vdW5jZW1lbnQgQWNjZXNzaWJsZSBjb21wbGV0aW9uIGFubm91bmNlbWVudC5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBpbml0aWFsX3RhYiBUYWIgdG8gcHJlc2VydmUgYWZ0ZXIgYSByZWZyZXNoLlxyXG5cdFx0ICogQHBhcmFtIHtBcnJheTxzdHJpbmc+fSByZWNlbnRseV9jaGFuZ2VkX2ZpZWxkX2tleXMgRmllbGRzIGNoYW5nZWQgYnkgdGhlIGNvbXBsZXRlZCBzYXZlLlxyXG5cdFx0ICogQHJldHVybiB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX2Jvb2tpbmcoIGJvb2tpbmdfZHRvLCBhbm5vdW5jZW1lbnQsIGluaXRpYWxfdGFiLCByZWNlbnRseV9jaGFuZ2VkX2ZpZWxkX2tleXMgKSB7XHJcblx0XHRcdHZhciBpbnNwZWN0b3Jfcm9vdDtcclxuXHRcdFx0dmFyIGRvbWFpbl9oZWFkZXI7XHJcblx0XHRcdHZhciBzdGF0dXNfbGFiZWwgPSBib29raW5nX2R0by5zdGF0dXMgJiYgYm9va2luZ19kdG8uc3RhdHVzLmxhYmVsID8gYm9va2luZ19kdG8uc3RhdHVzLmxhYmVsIDogJyc7XHJcblx0XHRcdHZhciBhY2Nlc3NpYmxlX3RpdGxlID0gKCBpMThuLmJvb2tpbmdfbnVtYmVyIHx8IGkxOG4udGl0bGUgfHwgJycgKSArICc6ICcgKyBib29raW5nX2R0by5ib29raW5nX2lkO1xyXG5cclxuXHRcdFx0YWN0aXZlX2Jvb2tpbmcgPSBib29raW5nX2R0bztcclxuXHRcdFx0c2hhcmVkX2luc3BlY3Rvci5zZXRfY29udGVudCggcmVuZGVyX2Jvb2tpbmdfdGVtcGxhdGVzKCBib29raW5nX2R0bywgcmVjZW50bHlfY2hhbmdlZF9maWVsZF9rZXlzICksIGFubm91bmNlbWVudCB8fCAnJyApO1xyXG5cdFx0XHRpbnNwZWN0b3Jfcm9vdCA9IHNoZWxsX3Jvb3QucXVlcnlTZWxlY3RvciggJy53cGJjX2Jvb2tpbmdfaW5zcGVjdG9yJyApO1xyXG5cdFx0XHRkb21haW5faGVhZGVyID0gaW5zcGVjdG9yX3Jvb3QgPyBpbnNwZWN0b3Jfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLWluc3BlY3Rvci1oZWFkZXJdJyApIDogbnVsbDtcclxuXHRcdFx0aWYgKCBzdGF0dXNfbGFiZWwgKSB7XHJcblx0XHRcdFx0YWNjZXNzaWJsZV90aXRsZSArPSAnLCAnICsgc3RhdHVzX2xhYmVsO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggZG9tYWluX2hlYWRlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc2hhcmVkX2luc3BlY3Rvci5zZXRfaGVhZGVyICkge1xyXG5cdFx0XHRcdHNoYXJlZF9pbnNwZWN0b3Iuc2V0X2hlYWRlciggZG9tYWluX2hlYWRlci5pbm5lckhUTUwsIGFjY2Vzc2libGVfdGl0bGUgKTtcclxuXHRcdFx0XHRkb21haW5faGVhZGVyLnJlbW92ZSgpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGluaXRpYWxpemVfYWN0aW9uX3Jlc291cmNlX2RpYWxvZ3MoIGJvb2tpbmdfZHRvLmFjdGlvbl9jb250ZXh0IHx8IHt9ICk7XHJcblx0XHRcdGluaXRpYWxpemVfdGFicyggaW5zcGVjdG9yX3Jvb3QsIGluaXRpYWxfdGFiIHx8ICdkZXRhaWxzJyApO1xyXG5cdFx0XHRjbGVhbl9kcmFmdF9qc29uID0gSlNPTi5zdHJpbmdpZnkoIGNvbGxlY3RfZHJhZnQoKSApO1xyXG5cdFx0XHRpc19kaXJ0eSA9IGZhbHNlO1xyXG5cdFx0XHR1cGRhdGVfZGlydHlfc3RhdGUoKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFBvcHVsYXRlIGNhbm9uaWNhbCBMaXN0aW5nIFJlc291cmNlIGRpYWxvZ3MgZm9yIGV2ZXJ5IEluc3BlY3RvciBob3N0LlxyXG5cdFx0ICpcclxuXHRcdCAqIEJvb2tpbmcgTGlzdGluZyBub3JtYWxseSByZW5kZXJzIHRoZXNlIGNvbnRyb2xzIGFmdGVyIGl0cyBzZWFyY2ggcmVxdWVzdC5cclxuXHRcdCAqIEluc3BlY3RvciBob3N0cyBpbnN0ZWFkIGNvbnN1bWUgdGhlIGF1dGhvcml6ZWQgUmVzb3VyY2UgY2hvaWNlcyBpbmNsdWRlZCBpblxyXG5cdFx0ICogdGhlIGJvb2tpbmcgZGV0YWlscyBEVE8sIHNvIG5vIGhvc3QgbmVlZHMgdG8gY29weSBSZXNvdXJjZSByZXNvbHV0aW9uLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBhY3Rpb25fY29udGV4dCBBdXRob3JpemVkIGNhbm9uaWNhbCBhY3Rpb24gY29udGV4dC5cclxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIGluaXRpYWxpemVfYWN0aW9uX3Jlc291cmNlX2RpYWxvZ3MoIGFjdGlvbl9jb250ZXh0ICkge1xyXG5cdFx0XHR2YXIgcmVzb3VyY2VzID0gQXJyYXkuaXNBcnJheSggYWN0aW9uX2NvbnRleHQuYm9va2luZ19yZXNvdXJjZXMgKSA/IGFjdGlvbl9jb250ZXh0LmJvb2tpbmdfcmVzb3VyY2VzIDogW107XHJcblx0XHRcdHZhciBkaWFsb2dfdGVtcGxhdGVzID0gW1xyXG5cdFx0XHRcdHsgdGFyZ2V0OiAnc2VjdGlvbl9pbl9pbl9tb2RhbF9fY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2UnLCB0ZW1wbGF0ZTogJ3dwYmNfYWp4X19tb2RhbF9fY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2UnIH0sXHJcblx0XHRcdFx0eyB0YXJnZXQ6ICdzZWN0aW9uX2luX2luX21vZGFsX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZScsIHRlbXBsYXRlOiAnd3BiY19hanhfX21vZGFsX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZScgfVxyXG5cdFx0XHRdO1xyXG5cclxuXHRcdFx0aWYgKCAhIHdpbmRvdy53cCB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LndwLnRlbXBsYXRlICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRkaWFsb2dfdGVtcGxhdGVzLmZvckVhY2goIGZ1bmN0aW9uICggZGlhbG9nX3RlbXBsYXRlICkge1xyXG5cdFx0XHRcdHZhciB0YXJnZXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggZGlhbG9nX3RlbXBsYXRlLnRhcmdldCApO1xyXG5cdFx0XHRcdHZhciB0ZW1wbGF0ZV9ub2RlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd0bXBsLScgKyBkaWFsb2dfdGVtcGxhdGUudGVtcGxhdGUgKTtcclxuXHRcdFx0XHRpZiAoICEgdGFyZ2V0IHx8ICEgdGVtcGxhdGVfbm9kZSApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dGFyZ2V0LmlubmVySFRNTCA9IHdpbmRvdy53cC50ZW1wbGF0ZSggZGlhbG9nX3RlbXBsYXRlLnRlbXBsYXRlICkoIHtcclxuXHRcdFx0XHRcdGFqeF9zZWFyY2hfcGFyYW1zOiB7fSxcclxuXHRcdFx0XHRcdGFqeF9ib29raW5nX3Jlc291cmNlczogcmVzb3VyY2VzXHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTeW5jaHJvbml6ZSByZXBlYXRlZCBlZGl0YWJsZSBjb250cm9scyBhbmQgbWFyayB0aGUgYm9va2luZyBkcmFmdCBkaXJ0eS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCBJbnB1dCBvciBjaGFuZ2UgZXZlbnQuXHJcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiBoYW5kbGVfZHJhZnRfY2hhbmdlKCBldmVudCApIHtcclxuXHRcdFx0dmFyIGNvbnRyb2wgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1maWVsZF0sIFtkYXRhLXdwYmMtYm9va2luZy1ub3RlXSwgW2RhdGEtd3BiYy1ib29raW5nLWNvc3RdJyApO1xyXG5cdFx0XHR2YXIgYXR0cmlidXRlX25hbWU7XHJcblx0XHRcdHZhciBhdHRyaWJ1dGVfdmFsdWU7XHJcblxyXG5cdFx0XHRpZiAoICEgY29udHJvbCB8fCAhIHNoZWxsX3Jvb3QuY29udGFpbnMoIGNvbnRyb2wgKSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0YXR0cmlidXRlX25hbWUgPSBjb250cm9sLmhhc0F0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLWZpZWxkJyApID8gJ2RhdGEtd3BiYy1ib29raW5nLWZpZWxkJyA6ICggY29udHJvbC5oYXNBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYm9va2luZy1ub3RlJyApID8gJ2RhdGEtd3BiYy1ib29raW5nLW5vdGUnIDogJ2RhdGEtd3BiYy1ib29raW5nLWNvc3QnICk7XHJcblx0XHRcdGF0dHJpYnV0ZV92YWx1ZSA9IGNvbnRyb2wuZ2V0QXR0cmlidXRlKCBhdHRyaWJ1dGVfbmFtZSApO1xyXG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBzaGVsbF9yb290LnF1ZXJ5U2VsZWN0b3JBbGwoICdbJyArIGF0dHJpYnV0ZV9uYW1lICsgJz1cIicgKyBhdHRyaWJ1dGVfdmFsdWUgKyAnXCJdJyApLCBmdW5jdGlvbiAoIG1hdGNoaW5nX2NvbnRyb2wgKSB7XHJcblx0XHRcdFx0aWYgKCBtYXRjaGluZ19jb250cm9sID09PSBjb250cm9sIHx8ICdjaGVja2JveCcgPT09IGNvbnRyb2wudHlwZSB8fCAncmFkaW8nID09PSBjb250cm9sLnR5cGUgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdG1hdGNoaW5nX2NvbnRyb2wudmFsdWUgPSBjb250cm9sLnZhbHVlO1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdGlmICggJ2RhdGEtd3BiYy1ib29raW5nLW5vdGUnID09PSBhdHRyaWJ1dGVfbmFtZSAmJiAncHJpdmF0ZScgPT09IGF0dHJpYnV0ZV92YWx1ZSAmJiBhY3RpdmVfYm9va2luZyApIHtcclxuXHRcdFx0XHR2YXIgbGlzdGluZ19ub3RlID0gc2hlbGxfcm9vdC5xdWVyeVNlbGVjdG9yKCAnI3NldF9ib29raW5nX25vdGVfdGV4dF8nICsgTnVtYmVyKCBhY3RpdmVfYm9va2luZy5ib29raW5nX2lkIHx8IDAgKSApO1xyXG5cdFx0XHRcdGlmICggbGlzdGluZ19ub3RlICkge1xyXG5cdFx0XHRcdFx0bGlzdGluZ19ub3RlLnZhbHVlID0gY29udHJvbC52YWx1ZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCAhIGlzX3NhdmluZyApIHtcclxuXHRcdFx0XHRzZXRfc2F2ZV9mZWVkYmFjayggJ2lkbGUnLCAnJyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHVwZGF0ZV9kaXJ0eV9zdGF0ZSgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVzdG9yZSBldmVyeSBjb250cm9sIGZyb20gdGhlIGxhc3QgYXV0aG9yaXRhdGl2ZSBEVE8uXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gY2FuY2VsX2NoYW5nZXMoKSB7XHJcblx0XHRcdGlmICggYWN0aXZlX2Jvb2tpbmcgJiYgISBpc19zYXZpbmcgKSB7XHJcblx0XHRcdFx0cmVuZGVyX2Jvb2tpbmcoIGFjdGl2ZV9ib29raW5nLCAnJywgZ2V0X2FjdGl2ZV90YWIoKSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBQZXJzaXN0IHRoZSBjdXJyZW50IGRhdGEtb25seSBkcmFmdCB0aHJvdWdoIHRoZSBhdXRob3JpemVkIGRvbWFpbiBlbmRwb2ludC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiBzYXZlX2NoYW5nZXMoKSB7XHJcblx0XHRcdHZhciBwcmVzZXJ2ZWRfdGFiID0gZ2V0X2FjdGl2ZV90YWIoKTtcclxuXHRcdFx0dmFyIHNhdmVfZ2VuZXJhdGlvbjtcclxuXHRcdFx0dmFyIHBlbmRpbmdfc2F2ZV9yZXF1ZXN0O1xyXG5cdFx0XHR2YXIgc3VibWl0dGVkX2RyYWZ0O1xyXG5cdFx0XHR2YXIgYm9va2luZ19iZWZvcmVfc2F2ZTtcclxuXHRcdFx0dmFyIGNoYW5nZWRfZmllbGRfa2V5cztcclxuXHJcblx0XHRcdGlmICggISBpc19kaXJ0eSB8fCBpc19zYXZpbmcgfHwgISBhY3RpdmVfYm9va2luZyB8fCAhIHRyYW5zcG9ydC51cGRhdGVfYWN0aW9uIHx8ICEgdHJhbnNwb3J0LnVwZGF0ZV9ub25jZSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0c3VibWl0dGVkX2RyYWZ0ID0gY29sbGVjdF9kcmFmdCgpO1xyXG5cdFx0XHRib29raW5nX2JlZm9yZV9zYXZlID0gYWN0aXZlX2Jvb2tpbmc7XHJcblx0XHRcdGlzX3NhdmluZyA9IHRydWU7XHJcblx0XHRcdHNhdmVfcmVxdWVzdF9nZW5lcmF0aW9uICs9IDE7XHJcblx0XHRcdHNhdmVfZ2VuZXJhdGlvbiA9IHNhdmVfcmVxdWVzdF9nZW5lcmF0aW9uO1xyXG5cdFx0XHR1cGRhdGVfZGlydHlfc3RhdGUoKTtcclxuXHRcdFx0c2V0X3NhdmVfZmVlZGJhY2soICdzYXZpbmcnLCBpMThuLnNhdmluZyB8fCAnJyApO1xyXG5cdFx0XHRzZXRfZHJhZnRfY29udHJvbHNfbG9ja2VkKCB0cnVlICk7XHJcblx0XHRcdHBlbmRpbmdfc2F2ZV9yZXF1ZXN0ID0gd2luZG93LmpRdWVyeS5hamF4KCB7XHJcblx0XHRcdFx0dXJsOiB0cmFuc3BvcnQudXJsLFxyXG5cdFx0XHRcdG1ldGhvZDogJ1BPU1QnLFxyXG5cdFx0XHRcdGRhdGFUeXBlOiAnanNvbicsXHJcblx0XHRcdFx0ZGF0YToge1xyXG5cdFx0XHRcdFx0YWN0aW9uOiB0cmFuc3BvcnQudXBkYXRlX2FjdGlvbixcclxuXHRcdFx0XHRcdG5vbmNlOiB0cmFuc3BvcnQudXBkYXRlX25vbmNlLFxyXG5cdFx0XHRcdFx0Ym9va2luZ19pZDogYWN0aXZlX2Jvb2tpbmcuYm9va2luZ19pZCxcclxuXHRcdFx0XHRcdHNvdXJjZTogdHJhbnNwb3J0LnNvdXJjZSxcclxuXHRcdFx0XHRcdGZpbmdlcnByaW50OiBhY3RpdmVfYm9va2luZy5maW5nZXJwcmludCxcclxuXHRcdFx0XHRcdGRyYWZ0OiBKU09OLnN0cmluZ2lmeSggc3VibWl0dGVkX2RyYWZ0ICksXHJcblx0XHRcdFx0XHRzZW5kX21vZGlmaWVkX2VtYWlsOiBnZXRfc2VuZF9tb2RpZmllZF9lbWFpbF9pbnRlbnQoKVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XHJcblx0XHRcdFx0aWYgKCBzYXZlX2dlbmVyYXRpb24gIT09IHNhdmVfcmVxdWVzdF9nZW5lcmF0aW9uIHx8ICEgc2hhcmVkX2luc3BlY3Rvci5pc19vcGVuKCkgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICggISByZXNwb25zZSB8fCAhIHJlc3BvbnNlLnN1Y2Nlc3MgfHwgISByZXNwb25zZS5kYXRhIHx8ICEgcmVzcG9uc2UuZGF0YS5ib29raW5nICkge1xyXG5cdFx0XHRcdFx0aXNfc2F2aW5nID0gZmFsc2U7XHJcblx0XHRcdFx0XHRzZXRfZHJhZnRfY29udHJvbHNfbG9ja2VkKCBmYWxzZSApO1xyXG5cdFx0XHRcdFx0c2V0X3NhdmVfZmVlZGJhY2soICdlcnJvcicsIGdldF9zYXZlX2Vycm9yX21lc3NhZ2UoIHsgcmVzcG9uc2VKU09OOiByZXNwb25zZSB9ICkgKTtcclxuXHRcdFx0XHRcdHVwZGF0ZV9kaXJ0eV9zdGF0ZSgpO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjaGFuZ2VkX2ZpZWxkX2tleXMgPSBnZXRfY2hhbmdlZF9maWVsZF9rZXlzKCBib29raW5nX2JlZm9yZV9zYXZlLCByZXNwb25zZS5kYXRhLmJvb2tpbmcgKTtcclxuXHRcdFx0XHRpc19zYXZpbmcgPSBmYWxzZTtcclxuXHRcdFx0XHRyZW5kZXJfYm9va2luZyggcmVzcG9uc2UuZGF0YS5ib29raW5nLCBpMThuLnNhdmVkIHx8ICcnLCBwcmVzZXJ2ZWRfdGFiLCBjaGFuZ2VkX2ZpZWxkX2tleXMgKTtcclxuXHRcdFx0XHRzZXRfc2F2ZV9mZWVkYmFjayggJ3N1Y2Nlc3MnLCBpMThuLnNhdmVkIHx8ICcnICk7XHJcblx0XHRcdFx0aWYgKCByZXNwb25zZS5kYXRhLmNoYW5nZWQgKSB7XHJcblx0XHRcdFx0XHRkaXNwYXRjaF9ib29raW5nX3NhdmVkKCByZXNwb25zZS5kYXRhLmJvb2tpbmcsIGNoYW5nZWRfZmllbGRfa2V5cyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoICd0aW1lbGluZScgPT09IHRyYW5zcG9ydC5zb3VyY2UgKSB7XHJcblx0XHRcdFx0XHR3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0XHRpZiAoIHNhdmVfZ2VuZXJhdGlvbiA9PT0gc2F2ZV9yZXF1ZXN0X2dlbmVyYXRpb24gJiYgc2hhcmVkX2luc3BlY3Rvci5pc19vcGVuKCkgKSB7XHJcblx0XHRcdFx0XHRcdFx0c2hhcmVkX2luc3BlY3Rvci5jbG9zZSgpO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9LCAwICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCBmYWlsZWRfcmVxdWVzdCwgcmVxdWVzdF9zdGF0dXMgKSB7XHJcblx0XHRcdFx0aWYgKCAnYWJvcnQnID09PSByZXF1ZXN0X3N0YXR1cyB8fCBzYXZlX2dlbmVyYXRpb24gIT09IHNhdmVfcmVxdWVzdF9nZW5lcmF0aW9uIHx8ICEgc2hhcmVkX2luc3BlY3Rvci5pc19vcGVuKCkgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlzX3NhdmluZyA9IGZhbHNlO1xyXG5cdFx0XHRcdHNldF9kcmFmdF9jb250cm9sc19sb2NrZWQoIGZhbHNlICk7XHJcblx0XHRcdFx0c2V0X3NhdmVfZmVlZGJhY2soICdlcnJvcicsIGdldF9zYXZlX2Vycm9yX21lc3NhZ2UoIGZhaWxlZF9yZXF1ZXN0ICkgKTtcclxuXHRcdFx0XHR1cGRhdGVfZGlydHlfc3RhdGUoKTtcclxuXHRcdFx0fSApLmFsd2F5cyggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdGlmICggc2F2ZV9yZXF1ZXN0ID09PSBwZW5kaW5nX3NhdmVfcmVxdWVzdCApIHtcclxuXHRcdFx0XHRcdHNhdmVfcmVxdWVzdCA9IG51bGw7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblx0XHRcdHNhdmVfcmVxdWVzdCA9IHBlbmRpbmdfc2F2ZV9yZXF1ZXN0O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogTG9hZCBvbmUgYXV0aG9yaXplZCBhY3Rpdml0eSBwYWdlIHdpdGhvdXQgbXV0YXRpbmcgYm9va2luZyBkYXRhLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBwYWdlIE9uZS1iYXNlZCBhY3Rpdml0eSBwYWdlLlxyXG5cdFx0ICogQHJldHVybiB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gbG9hZF9hY3Rpdml0eV9wYWdlKCBwYWdlICkge1xyXG5cdFx0XHR2YXIgZ2VuZXJhdGlvbiA9IHJlcXVlc3RfZ2VuZXJhdGlvbjtcclxuXHRcdFx0dmFyIGFjdGl2aXR5X2dlbmVyYXRpb247XHJcblx0XHRcdHZhciBwYWdpbmF0aW9uID0gYWN0aXZlX2Jvb2tpbmcgJiYgYWN0aXZlX2Jvb2tpbmcuYWN0aXZpdHkgPyBhY3RpdmVfYm9va2luZy5hY3Rpdml0eS5wYWdpbmF0aW9uIDoge307XHJcblx0XHRcdHZhciBhY3Rpdml0eV9tZXNzYWdlO1xyXG5cdFx0XHR2YXIgcGFnZV9yZXF1ZXN0O1xyXG5cclxuXHRcdFx0aWYgKCBpc19kaXJ0eSB8fCBpc19zYXZpbmcgfHwgISBhY3RpdmVfYm9va2luZyB8fCAhIHRyYW5zcG9ydC5hY3Rpdml0eV9hY3Rpb24gfHwgISB0cmFuc3BvcnQuYWN0aXZpdHlfbm9uY2UgfHwgcGFnZSA8IDEgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggYWN0aXZpdHlfcmVxdWVzdCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgYWN0aXZpdHlfcmVxdWVzdC5hYm9ydCApIHtcclxuXHRcdFx0XHRhY3Rpdml0eV9yZXF1ZXN0LmFib3J0KCk7XHJcblx0XHRcdH1cclxuXHRcdFx0YWN0aXZpdHlfcmVxdWVzdF9nZW5lcmF0aW9uICs9IDE7XHJcblx0XHRcdGFjdGl2aXR5X2dlbmVyYXRpb24gPSBhY3Rpdml0eV9yZXF1ZXN0X2dlbmVyYXRpb247XHJcblx0XHRcdGFjdGl2aXR5X21lc3NhZ2UgPSBzaGVsbF9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctYWN0aXZpdHktbWVzc2FnZV0nICk7XHJcblx0XHRcdGlmICggYWN0aXZpdHlfbWVzc2FnZSApIHtcclxuXHRcdFx0XHRhY3Rpdml0eV9tZXNzYWdlLnRleHRDb250ZW50ID0gaTE4bi5sb2FkaW5nX2FjdGl2aXR5IHx8ICcnO1xyXG5cdFx0XHR9XHJcblx0XHRcdHBhZ2VfcmVxdWVzdCA9IHdpbmRvdy5qUXVlcnkuYWpheCgge1xyXG5cdFx0XHRcdHVybDogdHJhbnNwb3J0LnVybCxcclxuXHRcdFx0XHRtZXRob2Q6ICdQT1NUJyxcclxuXHRcdFx0XHRkYXRhVHlwZTogJ2pzb24nLFxyXG5cdFx0XHRcdGRhdGE6IHtcclxuXHRcdFx0XHRcdGFjdGlvbjogdHJhbnNwb3J0LmFjdGl2aXR5X2FjdGlvbixcclxuXHRcdFx0XHRcdG5vbmNlOiB0cmFuc3BvcnQuYWN0aXZpdHlfbm9uY2UsXHJcblx0XHRcdFx0XHRib29raW5nX2lkOiBhY3RpdmVfYm9va2luZy5ib29raW5nX2lkLFxyXG5cdFx0XHRcdFx0c291cmNlOiB0cmFuc3BvcnQuc291cmNlLFxyXG5cdFx0XHRcdFx0cGFnZTogcGFnZSxcclxuXHRcdFx0XHRcdHBlcl9wYWdlOiBwYWdpbmF0aW9uICYmIHBhZ2luYXRpb24ucGVyX3BhZ2UgPyBwYWdpbmF0aW9uLnBlcl9wYWdlIDogMjBcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKS5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xyXG5cdFx0XHRcdGlmICggZ2VuZXJhdGlvbiAhPT0gcmVxdWVzdF9nZW5lcmF0aW9uIHx8IGFjdGl2aXR5X2dlbmVyYXRpb24gIT09IGFjdGl2aXR5X3JlcXVlc3RfZ2VuZXJhdGlvbiB8fCAhIHJlc3BvbnNlIHx8ICEgcmVzcG9uc2Uuc3VjY2VzcyB8fCAhIHJlc3BvbnNlLmRhdGEgfHwgISByZXNwb25zZS5kYXRhLmFjdGl2aXR5IHx8ICEgYWN0aXZlX2Jvb2tpbmcgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGFjdGl2ZV9ib29raW5nLmFjdGl2aXR5ID0gcmVzcG9uc2UuZGF0YS5hY3Rpdml0eTtcclxuXHRcdFx0XHRyZW5kZXJfYm9va2luZyggYWN0aXZlX2Jvb2tpbmcsICcnLCAnYWN0aXZpdHknICk7XHJcblx0XHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIGZhaWxlZF9yZXF1ZXN0LCByZXF1ZXN0X3N0YXR1cyApIHtcclxuXHRcdFx0XHR2YXIgZXJyb3I7XHJcblx0XHRcdFx0dmFyIG1lc3NhZ2U7XHJcblxyXG5cdFx0XHRcdGlmICggJ2Fib3J0JyA9PT0gcmVxdWVzdF9zdGF0dXMgfHwgZ2VuZXJhdGlvbiAhPT0gcmVxdWVzdF9nZW5lcmF0aW9uIHx8IGFjdGl2aXR5X2dlbmVyYXRpb24gIT09IGFjdGl2aXR5X3JlcXVlc3RfZ2VuZXJhdGlvbiB8fCAhIHNoYXJlZF9pbnNwZWN0b3IuaXNfb3BlbigpICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRlcnJvciA9IGZhaWxlZF9yZXF1ZXN0LnJlc3BvbnNlSlNPTiAmJiBmYWlsZWRfcmVxdWVzdC5yZXNwb25zZUpTT04uZGF0YSA/IGZhaWxlZF9yZXF1ZXN0LnJlc3BvbnNlSlNPTi5kYXRhIDoge307XHJcblx0XHRcdFx0bWVzc2FnZSA9IHNoZWxsX3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1hY3Rpdml0eS1tZXNzYWdlXScgKTtcclxuXHRcdFx0XHRpZiAoIG1lc3NhZ2UgKSB7XHJcblx0XHRcdFx0XHRtZXNzYWdlLnRleHRDb250ZW50ID0gZXJyb3IubWVzc2FnZSB8fCBpMThuLmFjdGl2aXR5X2Vycm9yIHx8IGkxOG4uZXJyb3IgfHwgJyc7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICkuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0aWYgKCBhY3Rpdml0eV9yZXF1ZXN0ID09PSBwYWdlX3JlcXVlc3QgKSB7XHJcblx0XHRcdFx0XHRhY3Rpdml0eV9yZXF1ZXN0ID0gbnVsbDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0YWN0aXZpdHlfcmVxdWVzdCA9IHBhZ2VfcmVxdWVzdDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEhhbmRsZSBkb21haW4gY29udHJvbHMgcmVuZGVyZWQgaW5zaWRlIHRoZSBJbnNwZWN0b3Igc2hlbGwuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtNb3VzZUV2ZW50fSBldmVudCBJbnNwZWN0b3IgY2xpY2sgZXZlbnQuXHJcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiBoYW5kbGVfaW5zcGVjdG9yX2NsaWNrKCBldmVudCApIHtcclxuXHRcdFx0dmFyIGFjdGl2aXR5X3BhZ2VfYnV0dG9uID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctYWN0aXZpdHktcGFnZV0nICk7XHJcblx0XHRcdHZhciBkYXRlX2VkaXRvcl9idXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1kYXRlLWVkaXRvci1vcGVuXScgKTtcclxuXHRcdFx0dmFyIHJlc2NoZWR1bGluZ19idXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNjaGVkdWxpbmctb3Blbl0nICk7XHJcblxyXG5cdFx0XHRpZiAoIGRhdGVfZWRpdG9yX2J1dHRvbiAmJiBkYXRlX2VkaXRvcl9jb250cm9sbGVyICYmIGFjdGl2ZV9ib29raW5nICkge1xyXG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0aWYgKCBpc19kaXJ0eSB8fCBpc19zYXZpbmcgKSB7XHJcblx0XHRcdFx0XHRzZXRfc2F2ZV9mZWVkYmFjayggJ2Vycm9yJywgaTE4bi5maW5pc2hfZWRpdHNfYmVmb3JlX2FjdGlvbiB8fCAnJyApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoIHJlc2NoZWR1bGluZ19jb250cm9sbGVyICYmICEgcmVzY2hlZHVsaW5nX2NvbnRyb2xsZXIucHJlcGFyZV9mb3JfcGFyZW50X3N3aXRjaCgpICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRkYXRlX2VkaXRvcl9jb250cm9sbGVyLm9wZW4oIGRhdGVfZWRpdG9yX2J1dHRvbiwgeyBib29raW5nX2lkOiBhY3RpdmVfYm9va2luZy5ib29raW5nX2lkIH0gKTtcclxuXHRcdFx0fSBlbHNlIGlmICggcmVzY2hlZHVsaW5nX2J1dHRvbiAmJiByZXNjaGVkdWxpbmdfY29udHJvbGxlciAmJiBhY3RpdmVfYm9va2luZyApIHtcclxuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdGlmICggaXNfZGlydHkgfHwgaXNfc2F2aW5nICkge1xyXG5cdFx0XHRcdFx0c2V0X3NhdmVfZmVlZGJhY2soICdlcnJvcicsIGkxOG4uZmluaXNoX2VkaXRzX2JlZm9yZV9hY3Rpb24gfHwgJycgKTtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCBkYXRlX2VkaXRvcl9jb250cm9sbGVyICYmICEgZGF0ZV9lZGl0b3JfY29udHJvbGxlci5wcmVwYXJlX2Zvcl9wYXJlbnRfc3dpdGNoKCkgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHJlc2NoZWR1bGluZ19jb250cm9sbGVyLm9wZW4oIHJlc2NoZWR1bGluZ19idXR0b24sIHsgYm9va2luZ19pZDogYWN0aXZlX2Jvb2tpbmcuYm9va2luZ19pZCB9ICk7XHJcblx0XHRcdH0gZWxzZSBpZiAoIGFjdGl2aXR5X3BhZ2VfYnV0dG9uICkge1xyXG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0bG9hZF9hY3Rpdml0eV9wYWdlKCBOdW1iZXIoIGFjdGl2aXR5X3BhZ2VfYnV0dG9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLWFjdGl2aXR5LXBhZ2UnICkgKSB8fCAwICk7XHJcblx0XHRcdH0gZWxzZSBpZiAoIGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1ib29raW5nLWluc3BlY3Rvci1jYW5jZWxdJyApICkge1xyXG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0Y2FuY2VsX2NoYW5nZXMoKTtcclxuXHRcdFx0fSBlbHNlIGlmICggZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctaW5zcGVjdG9yLXNhdmVdJyApICkge1xyXG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0c2F2ZV9jaGFuZ2VzKCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFByb3RlY3QgdW5zYXZlZCBkcmFmdHMgZnJvbSBjYW5vbmljYWwgQm9va2luZyBMaXN0aW5nIGFjdGlvbnMuXHJcblx0XHQgKlxyXG5cdFx0ICogVGhlIGNhcHR1cmUgcGhhc2UgcHJldmVudHMgaW5saW5lIExpc3RpbmcgaGFuZGxlcnMgZnJvbSBydW5uaW5nIGJlZm9yZVxyXG5cdFx0ICogdGhlIGJvb2tpbmctZG9tYWluIGRpcnR5LXN0YXRlIGd1YXJkIGhhcyBldmFsdWF0ZWQgdGhlIGFjdGlvbi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGV2ZW50IEluc3BlY3RvciBhY3Rpb24tbWVudSBjbGljayBldmVudC5cclxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIGhhbmRsZV9hY3Rpb25fbWVudV9jbGljayggZXZlbnQgKSB7XHJcblx0XHRcdHZhciBhY3Rpb25fbGluayA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnLndwYmNfYm9va2luZ19pbnNwZWN0b3JfX2FjdGlvbl9tZW51IC51bF9kcm9wZG93bl9tZW51X2xpX2FjdGlvbicgKTtcclxuXHRcdFx0dmFyIGluc3BlY3Rvcl9jb250ZW50O1xyXG5cdFx0XHR2YXIgaW5zcGVjdG9yX2hlYWRlcjtcclxuXHJcblx0XHRcdGlmICggISBhY3Rpb25fbGluayB8fCAhIHNoZWxsX3Jvb3QuY29udGFpbnMoIGFjdGlvbl9saW5rICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdHN5bmNocm9uaXplX2xpc3Rpbmdfbm90aWZpY2F0aW9uX2ludGVudCgpO1xyXG5cdFx0XHRpZiAoIGlzX2RpcnR5IHx8IGlzX3NhdmluZyApIHtcclxuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdGV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xyXG5cdFx0XHRcdHNldF9zYXZlX2ZlZWRiYWNrKCAnZXJyb3InLCBpMThuLmZpbmlzaF9lZGl0c19iZWZvcmVfYWN0aW9uIHx8ICcnICk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggYWN0aW9uX2xpbmsuY2xhc3NMaXN0LmNvbnRhaW5zKCAndWxfZHJvcGRvd25fbWVudV9saV9hY3Rpb25fc2V0X3ByaW50JyApICkge1xyXG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0ZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XHJcblx0XHRcdFx0aW5zcGVjdG9yX2NvbnRlbnQgPSBzaGVsbF9yb290LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19ib29raW5nX2luc3BlY3RvcicgKTtcclxuXHRcdFx0XHRpbnNwZWN0b3JfaGVhZGVyID0gc2hlbGxfcm9vdC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfc2hhcmVkX3VpX2luc3BlY3Rvcl9faGVhZGVyX2NvbnRlbnQnICk7XHJcblx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0J2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy53cGJjX3ByaW50X2RpYWxvZ19fc2hvd19lbGVtZW50c1xyXG5cdFx0XHRcdFx0fHwgISB3aW5kb3cud3BiY19wcmludF9kaWFsb2dfX3Nob3dfZWxlbWVudHMoXHJcblx0XHRcdFx0XHRcdFsgaW5zcGVjdG9yX2hlYWRlciwgaW5zcGVjdG9yX2NvbnRlbnQgXS5maWx0ZXIoIEJvb2xlYW4gKSxcclxuXHRcdFx0XHRcdFx0J3dwYmNfYm9va2luZ19pbnNwZWN0b3JfX3ByaW50X2NvbnRlbnQnXHJcblx0XHRcdFx0XHQpXHJcblx0XHRcdFx0KSB7XHJcblx0XHRcdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgKSB7XHJcblx0XHRcdFx0XHRcdHdpbmRvdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggaTE4bi5hY3Rpb25fZXJyb3IgfHwgJycsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBCdWlsZCB0aGUgc3RhYmxlIGlkZW50aXR5IGZvciBvbmUgY2Fub25pY2FsIEJvb2tpbmcgQWN0aW9uIHJlcXVlc3QuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGFjdGlvbl9yZXN1bHQgTm9ybWFsaXplZCBCb29raW5nIEFjdGlvbiBldmVudCBkZXRhaWwuXHJcblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IEJvb2tpbmcgYW5kIGFjdGlvbiBpZGVudGl0eSwgb3IgYW4gZW1wdHkgc3RyaW5nIHdoZW4gaW52YWxpZC5cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gZ2V0X2Jvb2tpbmdfYWN0aW9uX2lkZW50aXR5KCBhY3Rpb25fcmVzdWx0ICkge1xyXG5cdFx0XHR2YXIgYm9va2luZ19pZCA9IE51bWJlciggYWN0aW9uX3Jlc3VsdCAmJiBhY3Rpb25fcmVzdWx0LmJvb2tpbmdfaWQgPyBhY3Rpb25fcmVzdWx0LmJvb2tpbmdfaWQgOiAwICk7XHJcblx0XHRcdHZhciBhY3Rpb24gPSBTdHJpbmcoIGFjdGlvbl9yZXN1bHQgJiYgYWN0aW9uX3Jlc3VsdC5hY3Rpb24gPyBhY3Rpb25fcmVzdWx0LmFjdGlvbiA6ICcnICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gYm9va2luZ19pZCAmJiBhY3Rpb24gPyBTdHJpbmcoIGJvb2tpbmdfaWQgKSArICc6JyArIGFjdGlvbiA6ICcnO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmV0YWluIGEgY2Fub25pY2FsIEJvb2tpbmcgQWN0aW9uIHN0YXJ0ZWQgZm9yIHRoZSBvcGVuIEluc3BlY3RvciBib29raW5nLlxyXG5cdFx0ICpcclxuXHRcdCAqIFRoZSByZXF1ZXN0IGlzIG93bmVkIGJ5IHRoZSBlc3RhYmxpc2hlZCBCb29raW5nIEFjdGlvbnMgdHJhbnNwb3J0IGFuZCBjYW5cclxuXHRcdCAqIG91dGxpdmUgdGhpcyBwYW5lbC4gUmV0YWluaW5nIG9ubHkgaXRzIHN0YWJsZSBpZGVudGl0eSBsZXRzIGNvbXBsZXRpb25cclxuXHRcdCAqIGludmFsaWRhdGUgdGhlIGhvc3QgZXZlbiB3aGVuIHRoZSB1c2VyIGNsb3NlcyBvciBzd2l0Y2hlcyB0aGUgSW5zcGVjdG9yLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7Q3VzdG9tRXZlbnR9IGV2ZW50IE5vcm1hbGl6ZWQgYm9va2luZy1hY3Rpb24gc3RhcnQgZXZlbnQuXHJcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiBoYW5kbGVfYm9va2luZ19hY3Rpb25fc3RhcnQoIGV2ZW50ICkge1xyXG5cdFx0XHR2YXIgYWN0aW9uX3Jlc3VsdCA9IGV2ZW50ICYmIGV2ZW50LmRldGFpbCA/IGV2ZW50LmRldGFpbCA6IHt9O1xyXG5cdFx0XHR2YXIgYWN0aW9uX2lkZW50aXR5ID0gZ2V0X2Jvb2tpbmdfYWN0aW9uX2lkZW50aXR5KCBhY3Rpb25fcmVzdWx0ICk7XHJcblx0XHRcdHZhciBib29raW5nX2lkID0gTnVtYmVyKCBhY3Rpb25fcmVzdWx0LmJvb2tpbmdfaWQgfHwgMCApO1xyXG5cclxuXHRcdFx0aWYgKCAhIGFjdGlvbl9pZGVudGl0eSB8fCAhIGFjdGl2ZV9ib29raW5nIHx8IGJvb2tpbmdfaWQgIT09IE51bWJlciggYWN0aXZlX2Jvb2tpbmcuYm9va2luZ19pZCB8fCAwICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdHBlbmRpbmdfYm9va2luZ19hY3Rpb25zWyBhY3Rpb25faWRlbnRpdHkgXSA9IE51bWJlciggcGVuZGluZ19ib29raW5nX2FjdGlvbnNbIGFjdGlvbl9pZGVudGl0eSBdIHx8IDAgKSArIDE7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDb25zdW1lIG9uZSBwcmV2aW91c2x5IHJldGFpbmVkIGNhbm9uaWNhbCBCb29raW5nIEFjdGlvbiBpZGVudGl0eS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gYWN0aW9uX3Jlc3VsdCBOb3JtYWxpemVkIEJvb2tpbmcgQWN0aW9uIGNvbXBsZXRpb24gZGV0YWlsLlxyXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gV2hldGhlciB0aGlzIEluc3BlY3RvciBvYnNlcnZlZCB0aGUgbWF0Y2hpbmcgcmVxdWVzdCBzdGFydC5cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gY29uc3VtZV9wZW5kaW5nX2Jvb2tpbmdfYWN0aW9uKCBhY3Rpb25fcmVzdWx0ICkge1xyXG5cdFx0XHR2YXIgYWN0aW9uX2lkZW50aXR5ID0gZ2V0X2Jvb2tpbmdfYWN0aW9uX2lkZW50aXR5KCBhY3Rpb25fcmVzdWx0ICk7XHJcblx0XHRcdHZhciBwZW5kaW5nX2NvdW50ID0gYWN0aW9uX2lkZW50aXR5ID8gTnVtYmVyKCBwZW5kaW5nX2Jvb2tpbmdfYWN0aW9uc1sgYWN0aW9uX2lkZW50aXR5IF0gfHwgMCApIDogMDtcclxuXHJcblx0XHRcdGlmICggISBwZW5kaW5nX2NvdW50ICkge1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIDEgPT09IHBlbmRpbmdfY291bnQgKSB7XHJcblx0XHRcdFx0ZGVsZXRlIHBlbmRpbmdfYm9va2luZ19hY3Rpb25zWyBhY3Rpb25faWRlbnRpdHkgXTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRwZW5kaW5nX2Jvb2tpbmdfYWN0aW9uc1sgYWN0aW9uX2lkZW50aXR5IF0gPSBwZW5kaW5nX2NvdW50IC0gMTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlY29uY2lsZSB0aGUgSW5zcGVjdG9yIGFuZCBob3N0IGFmdGVyIGEgY2Fub25pY2FsIEJvb2tpbmcgTGlzdGluZyBhY3Rpb24uXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtDdXN0b21FdmVudH0gZXZlbnQgTm9ybWFsaXplZCBib29raW5nLWFjdGlvbiBjb21wbGV0aW9uIGV2ZW50LlxyXG5cdFx0ICogQHJldHVybiB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2Jvb2tpbmdfYWN0aW9uX2NvbXBsZXRlKCBldmVudCApIHtcclxuXHRcdFx0dmFyIGFjdGlvbl9yZXN1bHQgPSBldmVudCAmJiBldmVudC5kZXRhaWwgPyBldmVudC5kZXRhaWwgOiB7fTtcclxuXHRcdFx0dmFyIGFjdGlvbiA9IFN0cmluZyggYWN0aW9uX3Jlc3VsdC5hY3Rpb24gfHwgJycgKTtcclxuXHRcdFx0dmFyIGFjdGlvbl9tZXNzYWdlID0gU3RyaW5nKCBhY3Rpb25fcmVzdWx0Lm1lc3NhZ2UgfHwgJycgKTtcclxuXHRcdFx0dmFyIGNvbXBsZXRlZF9ib29raW5nX2lkID0gTnVtYmVyKCBhY3Rpb25fcmVzdWx0LmJvb2tpbmdfaWQgfHwgMCApO1xyXG5cdFx0XHR2YXIgaXNfcGVuZGluZ19hY3Rpb24gPSBjb25zdW1lX3BlbmRpbmdfYm9va2luZ19hY3Rpb24oIGFjdGlvbl9yZXN1bHQgKTtcclxuXHRcdFx0dmFyIGlzX2FjdGl2ZV9ib29raW5nID0gQm9vbGVhbiggYWN0aXZlX2Jvb2tpbmcgJiYgY29tcGxldGVkX2Jvb2tpbmdfaWQgPT09IE51bWJlciggYWN0aXZlX2Jvb2tpbmcuYm9va2luZ19pZCB8fCAwICkgKTtcclxuXHRcdFx0dmFyIGFjdGl2ZV90cmlnZ2VyO1xyXG5cclxuXHRcdFx0aWYgKCAhIGlzX3BlbmRpbmdfYWN0aW9uICYmICEgaXNfYWN0aXZlX2Jvb2tpbmcgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggISBhY3Rpb25fcmVzdWx0LnN1Y2Nlc3MgKSB7XHJcblx0XHRcdFx0aWYgKCBpc19hY3RpdmVfYm9va2luZyApIHtcclxuXHRcdFx0XHRcdHNldF9zYXZlX2ZlZWRiYWNrKCAnZXJyb3InLCBhY3Rpb25fbWVzc2FnZSB8fCBpMThuLmFjdGlvbl9lcnJvciB8fCAnJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBpc19wZW5kaW5nX2FjdGlvbiAmJiAhIGlzX2FjdGl2ZV9ib29raW5nICkge1xyXG5cdFx0XHRcdGRpc3BhdGNoX2Jvb2tpbmdfc2F2ZWQoIHsgYm9va2luZ19pZDogY29tcGxldGVkX2Jvb2tpbmdfaWQgfSwgW10gKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCAtMSAhPT0gWyAnbW92ZV9ib29raW5nX3RvX3RyYXNoJywgJ2RlbGV0ZV9ib29raW5nX2NvbXBsZXRlbHknIF0uaW5kZXhPZiggYWN0aW9uICkgKSB7XHJcblx0XHRcdFx0ZGlzcGF0Y2hfYm9va2luZ19zYXZlZCggeyBib29raW5nX2lkOiBhY3RpdmVfYm9va2luZy5ib29raW5nX2lkIH0sIFtdICk7XHJcblx0XHRcdFx0c2hhcmVkX2luc3BlY3Rvci5jbG9zZSgpO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIGlzX2RpcnR5IHx8IGlzX3NhdmluZyApIHtcclxuXHRcdFx0XHRzZXRfc2F2ZV9mZWVkYmFjayggJ3N1Y2Nlc3MnLCBhY3Rpb25fbWVzc2FnZSApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRhY3RpdmVfdHJpZ2dlciA9IGdldF9hY3RpdmVfdHJpZ2dlcigpO1xyXG5cdFx0XHRpZiAoIGFjdGl2ZV90cmlnZ2VyICkge1xyXG5cdFx0XHRcdG9wZW4oIGFjdGl2ZV90cmlnZ2VyLCBmdW5jdGlvbiAoIHJlZnJlc2hlZF9ib29raW5nICkge1xyXG5cdFx0XHRcdFx0ZGlzcGF0Y2hfYm9va2luZ19zYXZlZCggcmVmcmVzaGVkX2Jvb2tpbmcsIFtdICk7XHJcblx0XHRcdFx0XHRzZXRfc2F2ZV9mZWVkYmFjayggJ3N1Y2Nlc3MnLCBhY3Rpb25fbWVzc2FnZSApO1xyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRzZXRfc2F2ZV9mZWVkYmFjayggJ3N1Y2Nlc3MnLCBhY3Rpb25fbWVzc2FnZSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0c2hlbGxfcm9vdC5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCBoYW5kbGVfZHJhZnRfY2hhbmdlICk7XHJcblx0XHRzaGVsbF9yb290LmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBoYW5kbGVfZHJhZnRfY2hhbmdlICk7XHJcblx0XHRzaGVsbF9yb290LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGhhbmRsZV9hY3Rpb25fbWVudV9jbGljaywgdHJ1ZSApO1xyXG5cdFx0c2hlbGxfcm9vdC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBoYW5kbGVfaW5zcGVjdG9yX2NsaWNrICk7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBPcGVuIG9uZSBhdXRob3JpemVkIGJvb2tpbmcgYW5kIGxvYWQgaXRzIGxhenkgZGV0YWlscyBEVE8uXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gdHJpZ2dlciAgICAgICAgICAgQWN0aXZhdGVkIGJvb2tpbmcgdHJpZ2dlci5cclxuXHRcdCAqIEBwYXJhbSB7RnVuY3Rpb259ICAgIG9uX2Jvb2tpbmdfbG9hZGVkIE9wdGlvbmFsIGNhbGxiYWNrIHJlY2VpdmluZyB0aGUgYXV0aG9yaXRhdGl2ZSBib29raW5nIERUTyBhZnRlciByZW5kZXIuXHJcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiBvcGVuKCB0cmlnZ2VyLCBvbl9ib29raW5nX2xvYWRlZCApIHtcclxuXHRcdFx0dmFyIGJvb2tpbmdfaWQgPSBOdW1iZXIoIHRyaWdnZXIuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJvb2tpbmctaWQnICkgKSB8fCAwO1xyXG5cdFx0XHR2YXIgZ2VuZXJhdGlvbjtcclxuXHRcdFx0dmFyIGRhdGVfZWRpdG9yX2lzX2RpcnR5ID0gQm9vbGVhbiggZGF0ZV9lZGl0b3JfY29udHJvbGxlciAmJiBkYXRlX2VkaXRvcl9jb250cm9sbGVyLmlzX2RpcnR5KCkgKTtcclxuXHRcdFx0dmFyIHJlc2NoZWR1bGluZ19pc19kaXJ0eSA9IEJvb2xlYW4oIHJlc2NoZWR1bGluZ19jb250cm9sbGVyICYmIHJlc2NoZWR1bGluZ19jb250cm9sbGVyLmlzX2RpcnR5KCkgKTtcclxuXHJcblx0XHRcdGlmICggISBib29raW5nX2lkIHx8ICEgdHJhbnNwb3J0LnNvdXJjZSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCByZXNjaGVkdWxpbmdfY29udHJvbGxlciAmJiByZXNjaGVkdWxpbmdfY29udHJvbGxlci5pc19idXN5ICYmIHJlc2NoZWR1bGluZ19jb250cm9sbGVyLmlzX2J1c3koKSApIHtcclxuXHRcdFx0XHRzZXRfc2F2ZV9mZWVkYmFjayggJ2Vycm9yJywgaTE4bi5maW5pc2hfZWRpdHNfYmVmb3JlX2FjdGlvbiB8fCAnJyApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIHNoYXJlZF9pbnNwZWN0b3IuaXNfb3BlbigpICYmIGFjdGl2ZV9ib29raW5nX2lkICYmICggaXNfZGlydHkgfHwgZGF0ZV9lZGl0b3JfaXNfZGlydHkgfHwgcmVzY2hlZHVsaW5nX2lzX2RpcnR5ICkgKSB7XHJcblx0XHRcdFx0aWYgKCAhIHdpbmRvdy5jb25maXJtKCBpMThuLmRpc2NhcmRfY2hhbmdlcyB8fCAnJyApICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoIGRhdGVfZWRpdG9yX2NvbnRyb2xsZXIgKSB7XHJcblx0XHRcdFx0XHRkYXRlX2VkaXRvcl9jb250cm9sbGVyLmZvcmNlX2Nsb3NlKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICggcmVzY2hlZHVsaW5nX2NvbnRyb2xsZXIgKSB7XHJcblx0XHRcdFx0XHRyZXNjaGVkdWxpbmdfY29udHJvbGxlci5mb3JjZV9jbG9zZSgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRpZiAoIGRhdGVfZWRpdG9yX2NvbnRyb2xsZXIgJiYgISBkYXRlX2VkaXRvcl9jb250cm9sbGVyLnByZXBhcmVfZm9yX3BhcmVudF9zd2l0Y2goKSApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCByZXNjaGVkdWxpbmdfY29udHJvbGxlciAmJiAhIHJlc2NoZWR1bGluZ19jb250cm9sbGVyLnByZXBhcmVfZm9yX3BhcmVudF9zd2l0Y2goKSApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGFib3J0X3JlcXVlc3QoKTtcclxuXHRcdFx0Z2VuZXJhdGlvbiA9IHJlcXVlc3RfZ2VuZXJhdGlvbjtcclxuXHRcdFx0c2hhcmVkX2luc3BlY3Rvci5vcGVuKCBnZXRfdHJpZ2dlcl9mb2N1c190YXJnZXQoIHRyaWdnZXIgKSB8fCB0cmlnZ2VyICk7XHJcblx0XHRcdHNldF9hY3RpdmVfdHJpZ2dlciggdHJpZ2dlciApO1xyXG5cdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiBzaGFyZWRfaW5zcGVjdG9yLnJlc2V0X2hlYWRlciApIHtcclxuXHRcdFx0XHRzaGFyZWRfaW5zcGVjdG9yLnJlc2V0X2hlYWRlciggaTE4bi50aXRsZSB8fCAnJyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJlbmRlcl9zdGF0ZSggJ2xvYWRpbmcnLCBpMThuLmxvYWRpbmcgfHwgJycsIHRydWUgKTtcclxuXHRcdFx0aWYgKCAhIHdpbmRvdy5qUXVlcnkgfHwgISB0cmFuc3BvcnQudXJsIHx8ICEgdHJhbnNwb3J0LmFjdGlvbiB8fCAhIHRyYW5zcG9ydC5ub25jZSApIHtcclxuXHRcdFx0XHRyZW5kZXJfc3RhdGUoICdlcnJvcicsIGkxOG4uZXJyb3IgfHwgJycsIGZhbHNlICk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXF1ZXN0ID0gd2luZG93LmpRdWVyeS5hamF4KCB7XHJcblx0XHRcdFx0dXJsOiB0cmFuc3BvcnQudXJsLFxyXG5cdFx0XHRcdG1ldGhvZDogJ1BPU1QnLFxyXG5cdFx0XHRcdGRhdGFUeXBlOiAnanNvbicsXHJcblx0XHRcdFx0ZGF0YToge1xyXG5cdFx0XHRcdFx0YWN0aW9uOiB0cmFuc3BvcnQuYWN0aW9uLFxyXG5cdFx0XHRcdFx0bm9uY2U6IHRyYW5zcG9ydC5ub25jZSxcclxuXHRcdFx0XHRcdGJvb2tpbmdfaWQ6IGJvb2tpbmdfaWQsXHJcblx0XHRcdFx0XHRzb3VyY2U6IHRyYW5zcG9ydC5zb3VyY2VcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKS5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xyXG5cdFx0XHRcdGlmICggZ2VuZXJhdGlvbiAhPT0gcmVxdWVzdF9nZW5lcmF0aW9uIHx8ICEgc2hhcmVkX2luc3BlY3Rvci5pc19vcGVuKCkgfHwgISByZXNwb25zZSB8fCAhIHJlc3BvbnNlLnN1Y2Nlc3MgfHwgISByZXNwb25zZS5kYXRhIHx8ICEgcmVzcG9uc2UuZGF0YS5ib29raW5nICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZW5kZXJfYm9va2luZyggcmVzcG9uc2UuZGF0YS5ib29raW5nLCBpMThuLmxvYWRlZCB8fCAnJywgJ2RldGFpbHMnICk7XHJcblx0XHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygb25fYm9va2luZ19sb2FkZWQgKSB7XHJcblx0XHRcdFx0XHRvbl9ib29raW5nX2xvYWRlZCggcmVzcG9uc2UuZGF0YS5ib29raW5nICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCBmYWlsZWRfcmVxdWVzdCwgcmVxdWVzdF9zdGF0dXMgKSB7XHJcblx0XHRcdFx0dmFyIGVycm9yID0gZmFpbGVkX3JlcXVlc3QucmVzcG9uc2VKU09OICYmIGZhaWxlZF9yZXF1ZXN0LnJlc3BvbnNlSlNPTi5kYXRhID8gZmFpbGVkX3JlcXVlc3QucmVzcG9uc2VKU09OLmRhdGEgOiB7fTtcclxuXHJcblx0XHRcdFx0aWYgKCBnZW5lcmF0aW9uICE9PSByZXF1ZXN0X2dlbmVyYXRpb24gfHwgJ2Fib3J0JyA9PT0gcmVxdWVzdF9zdGF0dXMgfHwgISBzaGFyZWRfaW5zcGVjdG9yLmlzX29wZW4oKSApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmVuZGVyX3N0YXRlKCAnZXJyb3InLCBlcnJvci5tZXNzYWdlIHx8IGkxOG4uZXJyb3IgfHwgJycsIGZhbHNlICk7XHJcblx0XHRcdH0gKS5hbHdheXMoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRpZiAoIGdlbmVyYXRpb24gPT09IHJlcXVlc3RfZ2VuZXJhdGlvbiApIHtcclxuXHRcdFx0XHRcdHJlcXVlc3QgPSBudWxsO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogT3BlbiBvbmUgYm9va2luZyBkaXJlY3RseSBpbnRvIGl0cyBjYW5vbmljYWwgZnVsbCBSZXNjaGVkdWxlIGRpYWxvZy5cclxuXHRcdCAqXHJcblx0XHQgKiBUaGUgSW5zcGVjdG9yIHN0aWxsIHBlcmZvcm1zIGl0cyBub3JtYWwgYXV0aG9yaXplZCBib29raW5nIHJlYWQgZmlyc3QuIFRoZVxyXG5cdFx0ICogcmVzY2hlZHVsaW5nIGRvbWFpbiB0aGVuIHJlY2VpdmVzIG9ubHkgdGhlIGNhbm9uaWNhbCBib29raW5nIGlkZW50aWZpZXIgYW5kXHJcblx0XHQgKiByZXRhaW5zIG93bmVyc2hpcCBvZiByZXZpZXcsIHZhbGlkYXRpb24sIGZvY3VzLCBhbmQgZnV0dXJlIGFwcGx5IGJlaGF2aW9yLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGJvb2tpbmdfdHJpZ2dlciBCb29raW5nIGlkZW50aXR5IHRyaWdnZXIuXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBhY3Rpb25fdHJpZ2dlciAgUmVzaXplIGhhbmRsZSB0aGF0IHJlc3RvcmVzIGZvY3VzLlxyXG5cdFx0ICogQHJldHVybiB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gb3Blbl9yZXNjaGVkdWxpbmcoIGJvb2tpbmdfdHJpZ2dlciwgYWN0aW9uX3RyaWdnZXIgKSB7XHJcblx0XHRcdG9wZW4oIGJvb2tpbmdfdHJpZ2dlciwgZnVuY3Rpb24gKCBib29raW5nICkge1xyXG5cdFx0XHRcdGlmICggcmVzY2hlZHVsaW5nX2NvbnRyb2xsZXIgJiYgYm9va2luZyAmJiBib29raW5nLmJvb2tpbmdfaWQgKSB7XHJcblx0XHRcdFx0XHRyZXNjaGVkdWxpbmdfY29udHJvbGxlci5vcGVuKCBhY3Rpb25fdHJpZ2dlciB8fCBib29raW5nX3RyaWdnZXIsIHsgYm9va2luZ19pZDogYm9va2luZy5ib29raW5nX2lkIH0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFjdGl2YXRlIGEgYm9va2luZyB0cmlnZ2VyIHRocm91Z2ggZGVsZWdhdGVkIHBvaW50ZXIgaW5wdXQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtNb3VzZUV2ZW50fSBldmVudCBIb3N0IGNsaWNrIGV2ZW50LlxyXG5cdFx0ICogQHJldHVybiB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2NsaWNrKCBldmVudCApIHtcclxuXHRcdFx0dmFyIHRyaWdnZXIgPSBldmVudC50YXJnZXQuY2xvc2VzdCggdHJpZ2dlcl9zZWxlY3RvciApO1xyXG5cclxuXHRcdFx0aWYgKCAhIHRyaWdnZXIgfHwgISBob3N0X3Jvb3QuY29udGFpbnMoIHRyaWdnZXIgKSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0ZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XHJcblx0XHRcdG9wZW4oIHRyaWdnZXIgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFjdGl2YXRlIGEgZm9jdXNlZCBib29raW5nIHRyaWdnZXIgd2l0aCBFbnRlciBvciBTcGFjZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0tleWJvYXJkRXZlbnR9IGV2ZW50IEhvc3Qga2V5Ym9hcmQgZXZlbnQuXHJcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiBoYW5kbGVfa2V5ZG93biggZXZlbnQgKSB7XHJcblx0XHRcdHZhciB0cmlnZ2VyID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoIHRyaWdnZXJfc2VsZWN0b3IgKTtcclxuXHJcblx0XHRcdGlmICggISB0cmlnZ2VyIHx8IGV2ZW50LmN0cmxLZXkgfHwgZXZlbnQubWV0YUtleSB8fCBldmVudC5hbHRLZXkgfHwgZXZlbnQuc2hpZnRLZXkgfHwgLTEgPT09IFsgJ0VudGVyJywgJyAnIF0uaW5kZXhPZiggZXZlbnQua2V5ICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdGV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xyXG5cdFx0XHRvcGVuKCB0cmlnZ2VyICk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAnZGVsZWdhdGVkJyA9PT0gYWN0aXZhdGlvbl9tb2RlICkge1xyXG5cdFx0XHRob3N0X3Jvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgaGFuZGxlX2NsaWNrICk7XHJcblx0XHRcdGhvc3Rfcm9vdC5hZGRFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIGhhbmRsZV9rZXlkb3duICk7XHJcblx0XHR9XHJcblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6Ym9va2luZy1hY3Rpb246c3RhcnQnLCBoYW5kbGVfYm9va2luZ19hY3Rpb25fc3RhcnQgKTtcclxuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzpib29raW5nLWFjdGlvbjpjb21wbGV0ZScsIGhhbmRsZV9ib29raW5nX2FjdGlvbl9jb21wbGV0ZSApO1xyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdG9wZW46IG9wZW4sXHJcblx0XHRcdG9wZW5fcmVzY2hlZHVsaW5nOiBvcGVuX3Jlc2NoZWR1bGluZyxcclxuXHRcdFx0cmVmcmVzaF9hZnRlcl9leHRlcm5hbF9hcHBseTogcmVmcmVzaF9hZnRlcl9leHRlcm5hbF9hcHBseSxcclxuXHRcdFx0cmVmcmVzaDogcmVmcmVzaCxcclxuXHRcdFx0Y2xvc2U6IGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRzaGFyZWRfaW5zcGVjdG9yLmNsb3NlKCB0cnVlICk7XHJcblx0XHRcdH0sXHJcblx0XHRcdGRlc3Ryb3k6IGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRpZiAoIGRhdGVfZWRpdG9yX2NvbnRyb2xsZXIgKSB7XHJcblx0XHRcdFx0XHRkYXRlX2VkaXRvcl9jb250cm9sbGVyLmRlc3Ryb3koKTtcclxuXHRcdFx0XHRcdGRhdGVfZWRpdG9yX2NvbnRyb2xsZXIgPSBudWxsO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoIHJlc2NoZWR1bGluZ19jb250cm9sbGVyICkge1xyXG5cdFx0XHRcdFx0cmVzY2hlZHVsaW5nX2NvbnRyb2xsZXIuZGVzdHJveSgpO1xyXG5cdFx0XHRcdFx0cmVzY2hlZHVsaW5nX2NvbnRyb2xsZXIgPSBudWxsO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRhYm9ydF9yZXF1ZXN0KCk7XHJcblx0XHRcdFx0Y2xlYXJfYWN0aXZlX3RyaWdnZXIoKTtcclxuXHRcdFx0XHRzaGVsbF9yb290LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIGhhbmRsZV9kcmFmdF9jaGFuZ2UgKTtcclxuXHRcdFx0XHRzaGVsbF9yb290LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBoYW5kbGVfZHJhZnRfY2hhbmdlICk7XHJcblx0XHRcdFx0c2hlbGxfcm9vdC5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2xpY2snLCBoYW5kbGVfYWN0aW9uX21lbnVfY2xpY2ssIHRydWUgKTtcclxuXHRcdFx0XHRzaGVsbF9yb290LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjbGljaycsIGhhbmRsZV9pbnNwZWN0b3JfY2xpY2sgKTtcclxuXHRcdFx0XHRpZiAoICdkZWxlZ2F0ZWQnID09PSBhY3RpdmF0aW9uX21vZGUgKSB7XHJcblx0XHRcdFx0XHRob3N0X3Jvb3QucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgaGFuZGxlX2NsaWNrICk7XHJcblx0XHRcdFx0XHRob3N0X3Jvb3QucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCBoYW5kbGVfa2V5ZG93biApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3dwYmM6Ym9va2luZy1hY3Rpb246c3RhcnQnLCBoYW5kbGVfYm9va2luZ19hY3Rpb25fc3RhcnQgKTtcclxuXHRcdFx0XHR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3dwYmM6Ym9va2luZy1hY3Rpb246Y29tcGxldGUnLCBoYW5kbGVfYm9va2luZ19hY3Rpb25fY29tcGxldGUgKTtcclxuXHRcdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgaGFuZGxlX25vdGlmaWNhdGlvbl9pbnRlbnRfY2hhbmdlLCB0cnVlICk7XHJcblx0XHRcdH1cclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHR3aW5kb3cud3BiY19ib29raW5nX2luc3BlY3RvciA9IHdpbmRvdy53cGJjX2Jvb2tpbmdfaW5zcGVjdG9yIHx8IHt9O1xyXG5cdHdpbmRvdy53cGJjX2Jvb2tpbmdfaW5zcGVjdG9yLmNyZWF0ZSA9IGNyZWF0ZTtcclxufSggd2luZG93LCBkb2N1bWVudCwgd2luZG93LndwICkgKTtcclxuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFLFdBQVdBLE1BQU0sRUFBRUMsUUFBUSxFQUFFQyxFQUFFLEVBQUc7RUFDbkMsWUFBWTs7RUFFWjtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTQyxZQUFZQSxDQUFFQyxXQUFXLEVB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
