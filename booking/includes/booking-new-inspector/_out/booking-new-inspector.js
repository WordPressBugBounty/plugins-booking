"use strict";

/**
 * Timeline host adapter for the Add New Booking Inspector editing shell.
 *
 * The canonical top-navigation link works without this adapter. When compiled and
 * enqueued, this source intercepts only the authorized stable marker, opens the
 * shared Inspector, and performs authenticated data-only bootstrap, schedule,
 * cost reads, signed Review, idempotent Apply, and host-owned Timeline readback.
 * Persistence remains server-authoritative and cannot be initiated by rendering.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
(function (window, document, wp, $) {
  'use strict';

  var launch_selector = '[data-wpbc-booking-new-inspector-open]';
  var created_event_name = 'wpbc:booking-new-inspector:created';
  var timeline_readback_event_name = 'wpbc:booking-new-inspector:timeline-readback';
  var focus_created_event_name = 'wpbc:booking-new-inspector:focus-created';
  var controller = null;

  /**
   * Resolve the bounded bootstrap envelope for one server-marked launch link.
   *
   * Selection links contribute only the opaque signed token already present in
   * their canonical Add Booking URL. This adapter never decodes the token or
   * derives dates and times from Timeline geometry.
   *
   * @param {Element} trigger       Authorized server-rendered launch anchor.
   * @param {Object} configuration Executable-free domain configuration.
   * @return {Object|null} Bootstrap launch values, or null to preserve navigation.
   */
  function get_launch_request(trigger, configuration) {
    var launch_context = trigger && 'function' === typeof trigger.getAttribute ? String(trigger.getAttribute('data-wpbc-booking-new-inspector-open') || '') : '';
    var launch_contexts = configuration.launch_contexts && 'object' === typeof configuration.launch_contexts ? configuration.launch_contexts : {};
    var handoff_query_arg = String(configuration.handoff_query_arg || '');
    var max_token_bytes = Number(configuration.max_context_token_bytes || 0);
    var canonical_url;
    var source_context_token;
    if (String(launch_contexts.toolbar || '') === launch_context) {
      return {
        selection_source: 'empty'
      };
    }
    if (String(launch_contexts.timeline_selection || '') !== launch_context && String(launch_contexts.timeline_time_rows || '') !== launch_context) {
      return null;
    }
    if (!handoff_query_arg || !max_token_bytes || !window.URL || !trigger.href) {
      return null;
    }
    try {
      canonical_url = new window.URL(trigger.href, window.location.href);
      source_context_token = String(canonical_url.searchParams.get(handoff_query_arg) || '');
    } catch (error) {
      return null;
    }
    if (!source_context_token || max_token_bytes < source_context_token.length || !/^[A-Za-z0-9._-]+$/.test(source_context_token)) {
      return null;
    }
    return {
      selection_source: 'timeline',
      source_context_token: source_context_token
    };
  }

  /**
   * Resolve one server-allow-listed WordPress template.
   *
   * @param {string} template_id Stable server-supplied template identifier.
   * @return {Function|null} Template renderer or null.
   */
  function get_template(template_id) {
    return template_id && wp && 'function' === typeof wp.template ? wp.template(template_id) : null;
  }

  /**
   * Read bounded customer-field values rendered from authorized DTOs.
   *
   * The snapshot supports local dirty-state comparison only. It does not
   * serialize markup, authorize values, or produce a server request payload.
   *
   * @param {Element|null} content_root Active domain content root.
   * @return {Array<Object>} Ordered field keys with ordered scalar values.
   */
  function get_customer_field_snapshot(content_root) {
    var fields = [];
    var field_positions = {};
    var controls = content_root ? content_root.querySelectorAll('[data-wpbc-booking-new-inspector-field-input]') : [];
    Array.prototype.forEach.call(controls, function (control) {
      var field_key = String(control.getAttribute('data-wpbc-booking-new-inspector-field-input') || '');
      var field_record;
      if (!field_key) {
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(field_positions, field_key)) {
        field_positions[field_key] = fields.length;
        fields.push({
          key: field_key,
          values: []
        });
      }
      field_record = fields[field_positions[field_key]];
      if ('checkbox' === control.type || 'radio' === control.type) {
        if (control.checked) {
          field_record.values.push(String(control.value || ''));
        }
        return;
      }
      if (control.multiple && control.options) {
        Array.prototype.forEach.call(control.options, function (option) {
          if (option.selected) {
            field_record.values.push(String(option.value || ''));
          }
        });
        return;
      }
      field_record.values.push(String(control.value || ''));
    });
    return fields;
  }

  /**
   * Read the exact authorized note controls rendered by the domain template.
   *
   * @param {Element|null} content_root Active domain content root.
   * @return {Object} Note values keyed by their stable authorized type.
   */
  function get_note_snapshot(content_root) {
    var notes = {};
    var controls = content_root ? content_root.querySelectorAll('[data-wpbc-booking-new-inspector-note]') : [];
    Array.prototype.forEach.call(controls, function (control) {
      var note_type = String(control.getAttribute('data-wpbc-booking-new-inspector-note') || '');
      if ('public' === note_type || 'private' === note_type) {
        notes[note_type] = String(control.value || '');
      }
    });
    return notes;
  }

  /**
   * Return today's strict site-local calendar date without UTC date rollover.
   *
   * Empty top-navigation launches have no signed schedule seed. This value is
   * presentation-only and tells the native calendar which month to display; it
   * never selects a date or grants booking authority.
   *
   * The native calendar already receives WordPress's site-local date through
   * `_wpbc.today_arr`. Reusing that value prevents an administrator's browser
   * timezone from opening the adjacent month. The browser-local date remains a
   * compatibility fallback when the established WordPress registry is absent.
   *
   * @return {string} Site-local YYYY-MM-DD date, or browser-local fallback.
   */
  function get_today_calendar_anchor_date() {
    var today_parts = window._wpbc && 'function' === typeof window._wpbc.get_other_param ? window._wpbc.get_other_param('today_arr') : [];
    var site_year = Array.isArray(today_parts) ? parseInt(today_parts[0], 10) : 0;
    var site_month = Array.isArray(today_parts) ? parseInt(today_parts[1], 10) : 0;
    var site_day = Array.isArray(today_parts) ? parseInt(today_parts[2], 10) : 0;
    var site_today = new Date(site_year, site_month - 1, site_day);
    var has_valid_site_today = site_year >= 1000 && site_month >= 1 && site_month <= 12 && site_day >= 1 && site_day <= 31 && site_today.getFullYear() === site_year && site_today.getMonth() === site_month - 1 && site_today.getDate() === site_day;
    var today = has_valid_site_today ? site_today : new Date();
    var year = String(today.getFullYear());
    var month = ('0' + String(today.getMonth() + 1)).slice(-2);
    var day = ('0' + String(today.getDate())).slice(-2);
    return year + '-' + month + '-' + day;
  }

  /**
   * Read the current schedule's first date as a presentation-only month anchor.
   *
   * Resource and form changes discard the old signed Timeline authority. A
   * bounded selected date keeps the replacement Resource calendar on the
   * reviewed month while its schedule proposal is revalidated independently by
   * the server. An empty draft returns to the current site-local month instead
   * of letting the native calendar fall back to its oldest allowed past month.
   *
   * @param {Object|null} schedule_workflow Active creation schedule workflow.
   * @return {string} Strict selected-date or site-today YYYY-MM-DD anchor.
   */
  function get_schedule_calendar_anchor_date(schedule_workflow) {
    var schedule = schedule_workflow && 'function' === typeof schedule_workflow.get_draft ? schedule_workflow.get_draft() : null;
    var first_date = schedule && Array.isArray(schedule.selected_dates) && schedule.selected_dates.length ? String(schedule.selected_dates[0] || '') : '';
    return /^\d{4}-\d{2}-\d{2}$/.test(first_date) ? first_date : get_today_calendar_anchor_date();
  }

  /**
   * Project the active schedule into the bounded direct-reload request shape.
   *
   * A Resource/form replacement cannot reuse a signed Timeline token because
   * that token binds its original Resource. The current normalized dates and
   * times may instead be proposed to the schedule endpoint, which repeats
   * Resource/form authorization and policy validation before native availability
   * hydrates the replacement calendar.
   *
   * @param {Object|null} schedule_workflow Active creation schedule workflow.
   * @return {Object|null} Exact schedule fields, or null when unavailable/empty.
   */
  function get_schedule_reload_draft(schedule_workflow) {
    var schedule = schedule_workflow && 'function' === typeof schedule_workflow.get_draft ? schedule_workflow.get_draft() : null;
    var selected_dates;
    if (!schedule || !Array.isArray(schedule.selected_dates)) {
      return null;
    }
    selected_dates = schedule.selected_dates.filter(function (selected_date) {
      return 'string' === typeof selected_date && /^\d{4}-\d{2}-\d{2}$/.test(selected_date);
    }).slice(0);
    if (!selected_dates.length) {
      return null;
    }
    return {
      selection_method: 'individual' === schedule.selection_method ? 'individual' : 'policy',
      time_application: -1 !== ['full_day', 'boundary', 'per_date'].indexOf(schedule.time_application) ? schedule.time_application : 'full_day',
      selected_dates: selected_dates,
      start_time: 'string' === typeof schedule.start_time ? schedule.start_time : '',
      end_time: 'string' === typeof schedule.end_time ? schedule.end_time : ''
    };
  }

  /**
   * Create the isolated Timeline Inspector adapter lazily.
   *
   * Delaying initialization until an authorized click ensures the Timeline
   * shell and its domain host have already been rendered by the main runtime.
   *
   * @param {Object} configuration Authorized domain browser configuration.
   * @return {Object|null} Adapter controller or null when contracts are absent.
   */
  function create_controller(configuration) {
    var timeline_root = document.querySelector('[data-wpbc-timeline-component]');
    // The Timeline controller owns the outer mount and these events do not bubble.
    var timeline_event_root = timeline_root ? timeline_root.closest('[data-wpbc-timeline-mount]') || timeline_root : null;
    var shell_host = timeline_root ? timeline_root.querySelector('[data-wpbc-booking-new-inspector-host]') : null;
    var templates = configuration.templates && 'object' === typeof configuration.templates ? configuration.templates : {};
    var transport = configuration.transport && 'object' === typeof configuration.transport ? configuration.transport : {};
    var i18n = configuration.i18n && 'object' === typeof configuration.i18n ? configuration.i18n : {};
    var shared_template = get_template(configuration.shared_template);
    var shell_template = get_template(templates.shell);
    var header_template = get_template(templates.header);
    var resource_template = get_template(templates.resource);
    var fields_template = get_template(templates.fields);
    var field_template = get_template(templates.field);
    var notes_template = get_template(templates.notes);
    var dates_template = get_template(templates.dates);
    var costs_template = get_template(templates.costs);
    var footer_template = get_template(templates.footer);
    var review_template = get_template(templates.review);
    var created_template = get_template(templates.created);
    var state_template = get_template(templates.state);
    var unsupported_template = get_template(templates.unsupported_form);
    var shared_inspector;
    var shell_root;
    var shared_content_root;
    var pending_request = null;
    var pending_cost_request = null;
    var pending_review_request = null;
    var pending_apply_request = null;
    var pending_created_readback = null;
    var cost_preview_timer = null;
    var cost_preview_deferred = false;
    var cost_section_dismissed = false;
    var schedule_workflow = null;
    var active_content_root = null;
    var active_review_root = null;
    var active_review = null;
    var active_bootstrap = null;
    var active_fallback_url = configuration.canonical_url || '';
    var last_choices = {};
    var last_launch_request = {
      selection_source: 'empty'
    };
    var last_calendar_anchor_date = '';
    var last_schedule_draft = null;
    var request_generation = 0;
    var cost_request_generation = 0;
    var review_request_generation = 0;
    var apply_request_generation = 0;
    var request_sequence = 0;
    var readback_sequence = 0;
    var created_booking_id = 0;
    var draft_revision = 0;
    var schedule_ready = false;
    var customer_field_baseline = null;
    var note_baseline = null;
    var schedule_input_dirty = false;
    var cost_correction = '';
    var state = 'closed';
    var allowed_transitions = {
      closed: ['loading'],
      loading: ['editing', 'error', 'closed'],
      editing: ['loading', 'cost_preview', 'review', 'error', 'closed'],
      cost_preview: ['editing', 'loading', 'review', 'error', 'closed'],
      review: ['editing', 'applying', 'error', 'closed'],
      applying: ['created', 'error'],
      created: ['closed'],
      error: ['loading', 'editing', 'review', 'applying', 'closed']
    };
    if (!timeline_root || !shell_host || !shared_template || !shell_template || !header_template || !resource_template || !fields_template || !field_template || !notes_template || !dates_template || !costs_template || !footer_template || !review_template || !created_template || !state_template || !unsupported_template || !window.wpbc_shared_ui_inspector || 'function' !== typeof window.wpbc_shared_ui_inspector.create || !window.wpbc_booking_new_inspector || 'function' !== typeof window.wpbc_booking_new_inspector.create_schedule_workflow || !transport.url || !transport.bootstrap_action || !transport.bootstrap_nonce || !transport.schedule_action || !transport.schedule_nonce || !transport.cost_action || !transport.cost_nonce || !transport.review_action || !transport.review_nonce || !transport.apply_action || !transport.apply_nonce) {
      return null;
    }
    shell_host.innerHTML = shared_template({
      id: configuration.component_id,
      title: i18n.title || '',
      close_label: i18n.close || '',
      loading_label: i18n.loading || ''
    });
    shell_root = shell_host.querySelector('[data-wpbc-shared-ui-inspector]');
    if (!shell_root) {
      return null;
    }
    shared_content_root = shell_root.querySelector('[data-wpbc-shared-ui-inspector-content]');
    if (!shared_content_root) {
      return null;
    }
    shared_content_root.setAttribute('data-wpbc-booking-new-inspector-content', '');

    /**
     * Abort the active read and invalidate every older callback.
     *
     * @return {void}
     */
    function abort_request() {
      request_generation += 1;
      if (pending_request && 'function' === typeof pending_request.abort) {
        pending_request.abort();
      }
      pending_request = null;
      if (cost_preview_timer) {
        window.clearTimeout(cost_preview_timer);
        cost_preview_timer = null;
      }
      cost_preview_deferred = false;
      cost_request_generation += 1;
      if (pending_cost_request && 'function' === typeof pending_cost_request.abort) {
        pending_cost_request.abort();
      }
      pending_cost_request = null;
      review_request_generation += 1;
      if (pending_review_request && 'function' === typeof pending_review_request.abort) {
        pending_review_request.abort();
      }
      pending_review_request = null;
      apply_request_generation += 1;
      if (pending_apply_request && 'function' === typeof pending_apply_request.abort) {
        pending_apply_request.abort();
      }
      pending_apply_request = null;
      pending_created_readback = null;
      created_booking_id = 0;
      if (schedule_workflow) {
        schedule_workflow.destroy();
      }
      schedule_workflow = null;
      active_content_root = null;
      active_review_root = null;
      active_review = null;
      active_bootstrap = null;
      draft_revision = 0;
      schedule_ready = false;
      customer_field_baseline = null;
      note_baseline = null;
      schedule_input_dirty = false;
      cost_correction = '';
      shell_root.setAttribute('data-wpbc-booking-new-inspector-dirty', 'false');
    }

    /**
     * Apply one allowed Inspector state transition.
     *
     * @param {string} next_state Stable next state.
     * @return {boolean} True when the transition was accepted.
     */
    function transition(next_state) {
      if (state === next_state) {
        return true;
      }
      if (!allowed_transitions[state] || -1 === allowed_transitions[state].indexOf(next_state)) {
        return false;
      }
      state = next_state;
      if (shell_root) {
        shell_root.setAttribute('data-wpbc-booking-new-inspector-state', state);
      }
      return true;
    }

    /**
     * Report whether customer fields or the creation schedule differ from seed.
     *
     * @return {boolean} True when closing or replacing the draft needs consent.
     */
    function is_dirty() {
      var customer_fields_changed = null !== customer_field_baseline && customer_field_baseline !== JSON.stringify(get_customer_field_snapshot(active_content_root));
      var notes_changed = null !== note_baseline && note_baseline !== JSON.stringify(get_note_snapshot(active_content_root));
      var schedule_changed = schedule_workflow && 'function' === typeof schedule_workflow.is_dirty && schedule_workflow.is_dirty();
      return Boolean(customer_fields_changed || notes_changed || schedule_changed || schedule_input_dirty || '' !== cost_correction);
    }

    /**
     * Expose the draft state to presentation and accessibility diagnostics.
     *
     * @return {void}
     */
    function update_dirty_state() {
      shell_root.setAttribute('data-wpbc-booking-new-inspector-dirty', is_dirty() ? 'true' : 'false');
    }

    /**
     * Report whether the current authorized edition exposes Inspector pricing.
     *
     * @return {boolean} True only for Business Small or higher capability DTOs.
     */
    function can_preview_cost() {
      return Boolean(active_bootstrap && active_bootstrap.edition_capabilities && active_bootstrap.edition_capabilities.cost_preview);
    }

    /**
     * Invalidate any displayed or in-flight cost after a draft change.
     *
     * @return {void}
     */
    function invalidate_cost_preview() {
      var cost_status;
      var cost_button;
      if (cost_preview_timer) {
        window.clearTimeout(cost_preview_timer);
        cost_preview_timer = null;
      }
      draft_revision += 1;
      cost_request_generation += 1;
      invalidate_review();
      if ('cost_preview' === state) {
        transition('editing');
      }
      if (can_preview_cost()) {
        cost_status = active_content_root ? active_content_root.querySelector('[data-wpbc-booking-new-inspector-cost-status]') : null;
        if (cost_status) {
          cost_status.textContent = i18n.cost_stale || '';
        }
        cost_button = active_content_root ? active_content_root.querySelector('[data-wpbc-booking-new-inspector-cost-preview]') : null;
        if (cost_button) {
          cost_button.disabled = false;
        }
      }
      if (active_content_root && can_preview_cost()) {
        active_content_root.setAttribute('data-wpbc-booking-new-inspector-cost-state', 'stale');
      }
    }

    /**
     * Queue one automatic non-mutating preview after the current draft settles.
     *
     * Dates, completed times, and Booking Form controls can emit several native
     * events for one user action. A short debounce avoids redundant pricing reads.
     * If an older read is already in flight, one trailing preview waits for it to
     * settle; generation/revision guards ignore that older response without
     * producing a browser-level aborted request.
     *
     * @param {number} delay_ms Debounce delay in milliseconds.
     * @return {void}
     */
    function queue_cost_preview(delay_ms) {
      var schedule = schedule_workflow && 'function' === typeof schedule_workflow.get_draft ? schedule_workflow.get_draft() : null;
      if (cost_preview_timer) {
        window.clearTimeout(cost_preview_timer);
        cost_preview_timer = null;
      }
      if (!active_content_root || !can_preview_cost() || !schedule_ready || schedule_input_dirty || !schedule || !Array.isArray(schedule.selected_dates) || !schedule.selected_dates.length) {
        return;
      }
      cost_preview_timer = window.setTimeout(function () {
        cost_preview_timer = null;
        request_cost_preview();
      }, Math.max(0, Number(delay_ms) || 0));
    }

    /**
     * Invalidate any signed review after the local draft changes.
     *
     * @return {void}
     */
    function invalidate_review() {
      review_request_generation += 1;
      if (pending_review_request && 'function' === typeof pending_review_request.abort) {
        pending_review_request.abort();
      }
      pending_review_request = null;
      active_review = null;
    }

    /**
     * Confirm replacement or closure of one locally changed creation draft.
     *
     * @return {boolean} True when no draft is dirty or discard was confirmed.
     */
    function confirm_discard_changes() {
      if ('applying' === state) {
        return false;
      }
      if ('created' === state) {
        return true;
      }
      if (!is_dirty()) {
        return true;
      }
      return 'function' === typeof window.confirm && window.confirm(i18n.discard_changes || '');
    }

    /**
     * Dispatch one executable-free creation readback request to the Timeline.
     *
     * Apply has already persisted and authoritatively read back the booking.
     * This notification grants no mutation authority; it asks the host to reload
     * its current window and reconcile the exact created booking ID.
     *
     * @param {Object} response_data Accepted Apply response DTO.
     * @return {boolean} True when a browser event was dispatched.
     */
    function request_timeline_readback(response_data) {
      var booking = response_data && response_data.booking && 'object' === typeof response_data.booking ? response_data.booking : {};
      var booking_id = Math.max(0, Math.round(Number(booking.booking_id) || 0));
      var resource_id = Math.max(0, Math.round(Number(booking.resource_id) || 0));
      var source_context_token = String(last_launch_request.source_context_token || '');
      var event_detail;
      var created_event;
      if (!booking_id || !resource_id) {
        return false;
      }
      readback_sequence += 1;
      event_detail = {
        schema_version: Number(configuration.schema_version) || 1,
        request_id: String(response_data.request_id || 'created') + '-timeline-' + String(readback_sequence),
        apply_request_id: String(response_data.request_id || ''),
        booking_id: booking_id,
        resource_id: resource_id,
        source_context_token: source_context_token,
        handoff_query_arg: String(configuration.handoff_query_arg || ''),
        open_booking_inspector: true === configuration.open_created_booking_inspector
      };
      pending_created_readback = {
        request_id: event_detail.request_id,
        response: response_data
      };
      if ('function' === typeof window.CustomEvent) {
        created_event = new window.CustomEvent(created_event_name, {
          detail: event_detail
        });
      } else if (document.createEvent) {
        created_event = document.createEvent('CustomEvent');
        created_event.initCustomEvent(created_event_name, false, false, event_detail);
      }
      if (!created_event) {
        return false;
      }
      timeline_event_root.dispatchEvent(created_event);
      return true;
    }

    /**
     * Ask Timeline to focus the authoritative created card after shell closure.
     *
     * @param {number} booking_id Positive authoritative booking ID.
     * @return {void}
     */
    function request_created_booking_focus(booking_id) {
      var focus_event;
      booking_id = Math.max(0, Math.round(Number(booking_id) || 0));
      if (!booking_id) {
        return;
      }
      if ('function' === typeof window.CustomEvent) {
        focus_event = new window.CustomEvent(focus_created_event_name, {
          detail: {
            schema_version: 1,
            booking_id: booking_id
          }
        });
      } else if (document.createEvent) {
        focus_event = document.createEvent('CustomEvent');
        focus_event.initCustomEvent(focus_created_event_name, false, false, {
          schema_version: 1,
          booking_id: booking_id
        });
      }
      if (focus_event) {
        timeline_event_root.dispatchEvent(focus_event);
      }
    }

    /**
     * Reconcile the creation Inspector after Timeline's host-owned readback.
     *
     * A failed host refresh is a persisted-success warning, never an Apply
     * failure. Retry requests only reload Timeline and cannot create a duplicate.
     *
     * @param {CustomEvent} event Timeline readback completion event.
     * @return {void}
     */
    function handle_timeline_readback(event) {
      var detail = event && event.detail && 'object' === typeof event.detail ? event.detail : {};
      var status = shared_content_root ? shared_content_root.querySelector('[data-wpbc-booking-new-inspector-readback-status]') : null;
      var retry = shared_content_root ? shared_content_root.querySelector('[data-wpbc-booking-new-inspector-readback-retry]') : null;
      if ('created' !== state || !pending_created_readback || 1 !== Number(detail.schema_version) || created_booking_id !== Math.max(0, Math.round(Number(detail.booking_id) || 0)) || String(detail.request_id || '') !== pending_created_readback.request_id) {
        return;
      }
      if ('accepted' === detail.state) {
        pending_created_readback = null;
        if (status) {
          status.removeAttribute('role');
          status.textContent = true === detail.booking_visible ? i18n.timeline_refreshed || '' : i18n.timeline_record_not_visible || '';
        }
        if (retry) {
          retry.hidden = true;
        }
        shared_inspector.close(false);
        return;
      }
      if ('failed' !== detail.state) {
        return;
      }
      if (status) {
        status.setAttribute('role', 'alert');
        status.textContent = i18n.timeline_refresh_failed || '';
      }
      if (retry) {
        retry.hidden = false;
        retry.focus();
      }
    }

    /**
     * Build a bounded browser correlation identifier.
     *
     * @return {string} Request ID accepted by the server contract.
     */
    function create_request_id() {
      request_sequence += 1;
      return 'timeline-launch-' + Date.now().toString(36) + '-' + request_sequence.toString(36);
    }

    /**
     * Render one domain-owned loading, empty, or error state.
     *
     * @param {string}  state_id Stable state identifier.
     * @param {string}  title    Localized state title.
     * @param {string}  message  Localized safe state message.
     * @param {boolean} retry    Whether a read-only retry is available.
     * @return {void}
     */
    function render_state(state_id, title, message, retry) {
      shared_inspector.set_state(state_template({
        state: state_id,
        title: title,
        message: message,
        retry: Boolean(retry),
        url: 'loading' === state_id ? '' : active_fallback_url,
        i18n: i18n
      }), message, 'loading' === state_id);
    }

    /**
     * Resolve the rendered nodes for one exact server-authorized field key.
     *
     * Attribute values are compared as strings instead of interpolated into a
     * selector, so a malformed response cannot become executable selector text.
     *
     * @param {string} field_key Exact field key returned by server validation.
     * @return {Object} Matching field row, controls, fieldset, and error node.
     */
    function get_field_feedback_nodes(field_key) {
      var feedback = {
        field: null,
        controls: [],
        fieldset: null,
        error: null
      };
      field_key = String(field_key || '');
      if (!active_content_root || !field_key) {
        return feedback;
      }
      Array.prototype.some.call(active_content_root.querySelectorAll('[data-wpbc-booking-new-inspector-field]'), function (field) {
        if (field_key !== String(field.getAttribute('data-wpbc-booking-new-inspector-field') || '')) {
          return false;
        }
        feedback.field = field;
        feedback.controls = Array.prototype.slice.call(field.querySelectorAll('[data-wpbc-booking-new-inspector-field-input]'));
        feedback.fieldset = field.querySelector('fieldset');
        feedback.error = field.querySelector('[data-wpbc-booking-new-inspector-field-error]');
        return true;
      });
      return feedback;
    }

    /**
     * Clear one rendered validation error after the exact field changes.
     *
     * @param {string} field_key Exact rendered field key.
     * @return {boolean} True when visible feedback was cleared.
     */
    function clear_field_error(field_key) {
      var feedback = get_field_feedback_nodes(field_key);
      var had_error = Boolean(feedback.error && !feedback.error.hidden);
      feedback.controls.forEach(function (control) {
        control.removeAttribute('aria-invalid');
      });
      if (feedback.fieldset) {
        feedback.fieldset.removeAttribute('aria-invalid');
      }
      if (feedback.field) {
        feedback.field.classList.remove('has-error');
      }
      if (feedback.error) {
        feedback.error.textContent = '';
        feedback.error.hidden = true;
      }
      return had_error;
    }

    /**
     * Clear all Review validation feedback before a new authoritative request.
     *
     * @return {void}
     */
    function clear_review_errors() {
      var review_error = active_content_root ? active_content_root.querySelector('[data-wpbc-booking-new-inspector-review-error]') : null;
      Array.prototype.forEach.call(active_content_root ? active_content_root.querySelectorAll('[data-wpbc-booking-new-inspector-field-error]') : [], function (error_node) {
        clear_field_error(error_node.getAttribute('data-wpbc-booking-new-inspector-field-error'));
      });
      if (review_error) {
        review_error.hidden = true;
        if (review_error.querySelector('p')) {
          review_error.querySelector('p').textContent = '';
        }
      }
    }

    /**
     * Clear feedback for the customer control currently being corrected.
     *
     * The summary remains visible while any other rejected field is unresolved.
     *
     * @param {Element|null} control Changed customer control.
     * @return {void}
     */
    function clear_control_error(control) {
      var field_key;
      var review_error;
      if (!control || !active_content_root) {
        return;
      }
      field_key = String(control.getAttribute('data-wpbc-booking-new-inspector-field-input') || '');
      if (!clear_field_error(field_key)) {
        return;
      }
      if (active_content_root.querySelector('[data-wpbc-booking-new-inspector-field-error]:not([hidden])') || active_content_root.querySelector('[data-wpbc-booking-new-inspector-schedule-error]:not([hidden])')) {
        return;
      }
      review_error = active_content_root.querySelector('[data-wpbc-booking-new-inspector-review-error]');
      if (review_error) {
        review_error.hidden = true;
      }
    }

    /**
     * Render bounded server field errors and focus the first rejected control.
     *
     * Unknown keys remain covered by the safe summary and are never rendered as
     * selectors or markup. Exact messages are assigned with textContent only.
     *
     * @param {Object|null}  error_data      Normalized server or local readiness error response.
     * @param {Element|null} fallback_target Optional safe rendered target when no field matches.
     * @return {boolean} True when at least one exact rendered field was rejected.
     */
    function render_review_errors(error_data, fallback_target) {
      var field_errors = error_data && Array.isArray(error_data.field_errors) ? error_data.field_errors : [];
      var review_error = active_content_root ? active_content_root.querySelector('[data-wpbc-booking-new-inspector-review-error]') : null;
      var first_control = null;
      var first_field = null;
      var seen_fields = {};
      var matched_error = false;
      clear_review_errors();
      if (review_error) {
        review_error.hidden = false;
        if (review_error.querySelector('p')) {
          review_error.querySelector('p').textContent = String(error_data && error_data.message ? error_data.message : i18n.review_failed || '');
        }
      }
      field_errors.forEach(function (field_error) {
        var field_key = field_error && field_error.key ? String(field_error.key) : '';
        var message = field_error && field_error.message ? String(field_error.message) : '';
        var feedback;
        if (!field_key || !message || Object.prototype.hasOwnProperty.call(seen_fields, field_key)) {
          return;
        }
        seen_fields[field_key] = true;
        feedback = get_field_feedback_nodes(field_key);
        if (!feedback.field || !feedback.error) {
          return;
        }
        matched_error = true;
        feedback.field.classList.add('has-error');
        feedback.error.textContent = message;
        feedback.error.hidden = false;
        feedback.controls.forEach(function (control) {
          control.setAttribute('aria-invalid', 'true');
          if (!first_control && !control.disabled && 'function' === typeof control.focus) {
            first_control = control;
          }
        });
        if (feedback.fieldset) {
          feedback.fieldset.setAttribute('aria-invalid', 'true');
        }
        first_field = first_field || feedback.field;
      });
      (window.requestAnimationFrame || function (callback) {
        window.setTimeout(callback, 0);
      })(function () {
        var scroll_target = first_field || fallback_target || review_error;
        var focus_target = first_control || fallback_target || review_error;
        var reduced_motion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (scroll_target && 'function' === typeof scroll_target.scrollIntoView) {
          try {
            scroll_target.scrollIntoView({
              behavior: reduced_motion ? 'auto' : 'smooth',
              block: 'center'
            });
          } catch (scroll_error) {
            scroll_target.scrollIntoView();
          }
        }
        if (focus_target && 'function' === typeof focus_target.focus) {
          try {
            focus_target.focus({
              preventScroll: true
            });
          } catch (focus_error) {
            focus_target.focus();
          }
        }
      });
      return matched_error;
    }

    /**
     * Build presentation-only errors for empty required controls.
     *
     * This preflight is used only when an incomplete schedule prevents the
     * authoritative Review request from being constructed. Every request that
     * reaches the server still reruns the complete exact-form validator.
     *
     * @return {Array<Object>} Ordered exact field-error DTOs for empty required controls.
     */
    function get_missing_required_field_errors() {
      var field_snapshots = get_customer_field_snapshot(active_content_root);
      var values_by_key = {};
      var authorized_fields = active_bootstrap && Array.isArray(active_bootstrap.fields) ? active_bootstrap.fields : [];
      var field_errors = [];
      field_snapshots.forEach(function (field_snapshot) {
        values_by_key[String(field_snapshot.key || '')] = Array.isArray(field_snapshot.values) ? field_snapshot.values : [];
      });
      authorized_fields.forEach(function (field_contract) {
        var field_key = field_contract && field_contract.key ? String(field_contract.key) : '';
        var field_values = Object.prototype.hasOwnProperty.call(values_by_key, field_key) ? values_by_key[field_key] : [];
        var has_value = field_values.some(function (field_value) {
          return '' !== String(field_value || '').trim();
        });
        if (!field_key || true !== field_contract.required || has_value) {
          return;
        }
        field_errors.push({
          key: field_key,
          code: 'required',
          message: i18n.field_required || ''
        });
      });
      return field_errors;
    }

    /**
     * Explain why Review cannot yet construct its authoritative request.
     *
     * @return {void}
     */
    function render_review_readiness_errors() {
      var schedule = schedule_workflow && 'function' === typeof schedule_workflow.get_draft ? schedule_workflow.get_draft() : null;
      var has_selected_dates = Boolean(schedule && Array.isArray(schedule.selected_dates) && schedule.selected_dates.length);
      var field_errors = get_missing_required_field_errors();
      var schedule_message = has_selected_dates ? i18n.schedule_not_ready || '' : i18n.schedule_required || '';
      var review_message = !has_selected_dates && field_errors.length ? i18n.review_incomplete || '' : schedule_message;
      var schedule_error;
      set_schedule_error(true, schedule_message);
      schedule_error = active_content_root ? active_content_root.querySelector('[data-wpbc-booking-new-inspector-schedule-error]') : null;
      render_review_errors({
        message: review_message,
        field_errors: field_errors
      }, schedule_error);
    }

    /**
     * Synchronize schedule controls and selected-date overview from one draft.
     *
     * @param {Object} schedule Current normalized non-mutating schedule draft.
     * @return {void}
     */
    function synchronize_schedule(schedule, change_context) {
      var selected_dates = schedule && Array.isArray(schedule.selected_dates) ? schedule.selected_dates : [];
      var dates_list = active_content_root ? active_content_root.querySelector('[data-wpbc-booking-new-inspector-selected-dates]') : null;
      var selected_count = active_content_root ? active_content_root.querySelector('[data-wpbc-booking-new-inspector-selected-count]') : null;
      var time_row = active_content_root ? active_content_root.querySelector('[data-wpbc-booking-new-inspector-time-row]') : null;
      var start_time = active_content_root ? active_content_root.querySelector('[data-wpbc-booking-new-inspector-start-time]') : null;
      var end_time = active_content_root ? active_content_root.querySelector('[data-wpbc-booking-new-inspector-end-time]') : null;
      var reset_button = active_content_root ? active_content_root.querySelector('[data-wpbc-booking-new-inspector-schedule-reset]') : null;
      var review_error;
      if (selected_count) {
        selected_count.textContent = String(selected_dates.length);
      }
      if (dates_list) {
        dates_list.textContent = '';
        (selected_dates.length ? selected_dates : [i18n.no_dates || '']).forEach(function (selected_date) {
          var date_entry = document.createElement('li');
          date_entry.textContent = String(selected_date);
          dates_list.appendChild(date_entry);
        });
      }
      if (time_row) {
        time_row.hidden = 'full_day' === schedule.time_application;
      }
      if (start_time) {
        start_time.value = schedule.start_time || '';
      }
      if (end_time) {
        end_time.value = schedule.end_time || '';
      }
      if (reset_button) {
        reset_button.disabled = !selected_dates.length;
      }
      if (selected_dates.length) {
        set_schedule_error(false);
        if (active_content_root && !active_content_root.querySelector('[data-wpbc-booking-new-inspector-field-error]:not([hidden])')) {
          review_error = active_content_root.querySelector('[data-wpbc-booking-new-inspector-review-error]');
          if (review_error) {
            review_error.hidden = true;
          }
        }
      }
      Array.prototype.forEach.call(active_content_root ? active_content_root.querySelectorAll('[data-wpbc-booking-new-inspector-selection-method]') : [], function (control) {
        control.checked = control.value === schedule.selection_method;
      });
      Array.prototype.forEach.call(active_content_root ? active_content_root.querySelectorAll('[data-wpbc-booking-new-inspector-time-application]') : [], function (control) {
        control.checked = control.value === schedule.time_application;
      });
      if (!schedule_ready) {
        schedule_ready = true;
      } else if (!change_context || change_context.is_dirty) {
        invalidate_cost_preview();
      }
      update_dirty_state();
      queue_cost_preview(250);
    }

    /**
     * Apply visible time inputs to the bounded schedule draft when complete.
     *
     * A partial or invalid local time remains presentation-only, but still marks
     * the Inspector dirty so Escape or Cancel cannot discard it silently.
     *
     * @return {void}
     */
    function update_schedule_times() {
      var start_time = active_content_root ? active_content_root.querySelector('[data-wpbc-booking-new-inspector-start-time]') : null;
      var end_time = active_content_root ? active_content_root.querySelector('[data-wpbc-booking-new-inspector-end-time]') : null;
      var accepted = schedule_workflow && start_time && end_time ? schedule_workflow.set_times(start_time.value, end_time.value) : false;
      schedule_input_dirty = !accepted;
      update_dirty_state();
    }

    /**
     * Update the native-calendar loading presentation without replacing content.
     *
     * @param {boolean} is_loading Whether the schedule workflow is loading.
     * @return {void}
     */
    function set_schedule_loading(is_loading) {
      var calendar_host = active_content_root ? active_content_root.querySelector('[data-wpbc-booking-new-inspector-calendar-host]') : null;
      var status_host = active_content_root ? active_content_root.querySelector('[data-wpbc-booking-new-inspector-schedule-status]') : null;
      var reset_button = active_content_root ? active_content_root.querySelector('[data-wpbc-booking-new-inspector-schedule-reset]') : null;
      var selected_count = active_content_root ? active_content_root.querySelector('[data-wpbc-booking-new-inspector-selected-count]') : null;
      var schedule_controls = active_content_root ? active_content_root.querySelectorAll('[data-wpbc-booking-new-inspector-selection-method], ' + '[data-wpbc-booking-new-inspector-time-application], ' + '[data-wpbc-booking-new-inspector-start-time], ' + '[data-wpbc-booking-new-inspector-end-time]') : [];
      if (calendar_host) {
        calendar_host.setAttribute('aria-busy', is_loading ? 'true' : 'false');
      }
      if (status_host) {
        status_host.textContent = is_loading ? i18n.loading_schedule || '' : '';
      }
      if (reset_button) {
        reset_button.disabled = is_loading || !selected_count || '0' === selected_count.textContent;
      }
      Array.prototype.forEach.call(schedule_controls, function (control) {
        control.disabled = Boolean(is_loading);
      });
    }

    /**
     * Show or clear the local schedule-read error state.
     *
     * @param {boolean} has_error Whether a schedule read or Review readiness check failed.
     * @param {string}  message   Optional plain-text error message.
     * @return {void}
     */
    function set_schedule_error(has_error, message) {
      var error_host = active_content_root ? active_content_root.querySelector('[data-wpbc-booking-new-inspector-schedule-error]') : null;
      var reset_button = active_content_root ? active_content_root.querySelector('[data-wpbc-booking-new-inspector-schedule-reset]') : null;
      var error_message = error_host ? error_host.querySelector('p') : null;
      if (error_host) {
        error_host.hidden = !has_error;
      }
      if (error_message) {
        error_message.textContent = has_error ? String(message || i18n.schedule_failed || '') : '';
      }
      if (has_error && reset_button) {
        reset_button.disabled = true;
      }
    }

    /**
     * Map bounded server field errors to authorized plain-text cost messages.
     *
     * Cost preview must never build selectors from rejected keys or expose raw
     * field metadata. Exact Bootstrap labels are used when available; all other
     * errors retain only their safe server message.
     *
     * @param {Object|null} error_data Normalized cost error response.
     * @return {Array<string>} Ordered visible validation messages.
     */
    function get_cost_validation_messages(error_data) {
      var field_errors = error_data && Array.isArray(error_data.field_errors) ? error_data.field_errors : [];
      var authorized_fields = active_bootstrap && Array.isArray(active_bootstrap.fields) ? active_bootstrap.fields : [];
      var labels_by_key = {};
      authorized_fields.forEach(function (field_contract) {
        var field_key = field_contract && field_contract.key ? String(field_contract.key) : '';
        if (field_key) {
          labels_by_key[field_key] = String(field_contract.label || i18n.booking_details || '');
        }
      });
      return field_errors.slice(0, 20).map(function (field_error) {
        var field_key = field_error && field_error.key ? String(field_error.key) : '';
        var message = field_error && field_error.message ? String(field_error.message) : '';
        var field_label = Object.prototype.hasOwnProperty.call(labels_by_key, field_key) ? labels_by_key[field_key] : '';
        return field_label && message ? field_label + ': ' + message : message;
      }).filter(function (message) {
        return Boolean(message);
      });
    }

    /**
     * Render one server-authoritative cost DTO without trusting markup.
     *
     * @param {Object}        cost_dto           Current cost DTO.
     * @param {Object|null}   fallback           Optional canonical fallback DTO.
     * @param {Array<string>} validation_messages Optional bounded validation messages.
     * @return {void}
     */
    function render_cost(cost_dto, fallback, validation_messages) {
      var costs_host = active_content_root ? active_content_root.querySelector('[data-wpbc-booking-new-inspector-costs-host]') : null;
      var restore_cost_focus;
      var next_cost_button;
      if (!costs_host) {
        return;
      }
      if (cost_section_dismissed) {
        costs_host.hidden = true;
        costs_host.innerHTML = '';
        return;
      }
      costs_host.hidden = false;
      restore_cost_focus = Boolean(document.activeElement && 'function' === typeof document.activeElement.closest && document.activeElement.closest('[data-wpbc-booking-new-inspector-cost-preview]'));
      costs_host.innerHTML = costs_template({
        cost: cost_dto || {},
        fallback: fallback || null,
        upgrade_required: !can_preview_cost(),
        correction_allowed: Boolean(active_bootstrap && active_bootstrap.edition_capabilities && active_bootstrap.edition_capabilities.cost_correction),
        correction_value: cost_correction,
        validation_messages: Array.isArray(validation_messages) ? validation_messages : [],
        i18n: i18n
      });
      active_content_root.setAttribute('data-wpbc-booking-new-inspector-cost-state', String(cost_dto && cost_dto.status ? cost_dto.status : 'unavailable'));
      if (restore_cost_focus) {
        next_cost_button = costs_host.querySelector('[data-wpbc-booking-new-inspector-cost-preview]');
        if (next_cost_button && 'function' === typeof next_cost_button.focus) {
          next_cost_button.focus();
        }
      }
    }

    /**
     * Build the exact structured draft sent to the authenticated cost service.
     *
     * @return {Object|null} Draft request or null before schedule hydration.
     */
    function get_draft_request() {
      var schedule = schedule_workflow && 'function' === typeof schedule_workflow.get_draft ? schedule_workflow.get_draft() : null;
      if (!active_bootstrap || !schedule || !schedule_ready || schedule_input_dirty || !Array.isArray(schedule.selected_dates) || !schedule.selected_dates.length) {
        return null;
      }
      return {
        schema_version: configuration.schema_version,
        request_id: create_request_id(),
        resource_id: active_bootstrap.selected_resource_id,
        form_id: active_bootstrap.selected_form_id,
        form_source: active_bootstrap.form_source,
        selection_source: last_launch_request.selection_source || 'empty',
        source_context_token: last_launch_request.source_context_token || '',
        schedule: {
          selection_method: schedule.selection_method,
          time_application: schedule.time_application,
          selected_dates: Array.isArray(schedule.selected_dates) ? schedule.selected_dates.slice(0) : [],
          start_time: schedule.start_time || '',
          end_time: schedule.end_time || ''
        },
        fields: get_customer_field_snapshot(active_content_root),
        notes: get_note_snapshot(active_content_root),
        email_intent: 'canonical_default',
        cost_intent: '' === cost_correction ? 'canonical' : 'corrected',
        corrected_cost: cost_correction,
        draft_revision: draft_revision
      };
    }

    /**
     * Request a current non-mutating cost preview for the exact local revision.
     *
     * @return {void}
     */
    function request_cost_preview() {
      var request_values = get_draft_request();
      var current_generation;
      var requested_revision;
      var cost_status;
      var cost_button;
      var cost_request;
      if (!can_preview_cost()) {
        return;
      }
      if (cost_preview_timer) {
        window.clearTimeout(cost_preview_timer);
        cost_preview_timer = null;
      }
      if (!request_values) {
        cost_status = active_content_root ? active_content_root.querySelector('[data-wpbc-booking-new-inspector-cost-status]') : null;
        if (cost_status) {
          cost_status.textContent = i18n.cost_failed || '';
        }
        return;
      }
      if (pending_cost_request) {
        cost_preview_deferred = true;
        return;
      }
      cost_request_generation += 1;
      current_generation = cost_request_generation;
      requested_revision = request_values.draft_revision;
      cost_preview_deferred = false;
      cost_status = active_content_root.querySelector('[data-wpbc-booking-new-inspector-cost-status]');
      cost_button = active_content_root.querySelector('[data-wpbc-booking-new-inspector-cost-preview]');
      if (cost_status) {
        cost_status.textContent = i18n.calculating_cost || '';
      }
      if (cost_button) {
        cost_button.disabled = true;
      }
      active_content_root.setAttribute('data-wpbc-booking-new-inspector-cost-state', 'loading');
      cost_request = $.ajax({
        url: transport.url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: transport.cost_action,
          nonce: transport.cost_nonce,
          request: JSON.stringify(request_values)
        }
      });
      pending_cost_request = cost_request;
      cost_request.done(function (response) {
        var response_data = response && true === response.success ? response.data : null;
        if (current_generation !== cost_request_generation || requested_revision !== draft_revision || !active_content_root) {
          return;
        }
        if (!response_data || response_data.request_id !== request_values.request_id || response_data.draft_revision !== requested_revision) {
          transition('editing');
          render_cost({
            status: 'stale',
            message: i18n.cost_stale || '',
            line_items: []
          }, null);
          return;
        }
        if ('cost_preview' === response_data.state) {
          transition('cost_preview');
          render_cost(response_data.cost || {}, null, response_data.warnings || []);
        } else {
          transition('editing');
          render_cost(response_data.cost || {}, response_data.fallback || null, response_data.warnings || []);
        }
      }).fail(function (failed_request, request_status) {
        var error_data;
        var review_button;
        if ('abort' === request_status || current_generation !== cost_request_generation || requested_revision !== draft_revision || !active_content_root) {
          return;
        }
        error_data = failed_request && failed_request.responseJSON ? failed_request.responseJSON.data : null;
        transition('editing');
        render_cost({
          status: 'unavailable',
          message: error_data && error_data.message ? error_data.message : i18n.cost_failed || '',
          line_items: []
        }, null, get_cost_validation_messages(error_data));
      }).always(function () {
        var request_latest_preview = cost_preview_deferred;
        if (pending_cost_request === cost_request) {
          pending_cost_request = null;
        }
        cost_preview_deferred = false;
        if (request_latest_preview) {
          queue_cost_preview(0);
        }
      });
    }

    /**
     * Request a current signed non-mutating Review for the exact local revision.
     *
     * @return {void}
     */
    function request_review() {
      var request_values;
      var current_generation;
      var requested_revision;
      var review_button;
      if (!active_content_root) {
        return;
      }
      request_values = get_draft_request();
      if (!request_values) {
        clear_review_errors();
        render_review_readiness_errors();
        return;
      }
      review_request_generation += 1;
      current_generation = review_request_generation;
      requested_revision = request_values.draft_revision;
      if (pending_review_request && 'function' === typeof pending_review_request.abort) {
        pending_review_request.abort();
      }
      clear_review_errors();
      review_button = active_content_root.querySelector('[data-wpbc-booking-new-inspector-review]');
      if (review_button) {
        review_button.disabled = true;
        review_button.setAttribute('aria-busy', 'true');
      }
      pending_review_request = $.ajax({
        url: transport.url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: transport.review_action,
          nonce: transport.review_nonce,
          request: JSON.stringify(request_values)
        }
      }).done(function (response) {
        var response_data = response && true === response.success ? response.data : null;
        var review_cancel;
        if (current_generation !== review_request_generation || requested_revision !== draft_revision || !active_content_root) {
          return;
        }
        pending_review_request = null;
        if (!response_data || response_data.request_id !== request_values.request_id || 'review' !== response_data.state) {
          if (review_button) {
            review_button.disabled = false;
            review_button.removeAttribute('aria-busy');
          }
          return;
        }
        if (!transition('review')) {
          return;
        }
        active_review = response_data;
        active_content_root.hidden = true;
        shared_content_root.insertAdjacentHTML('beforeend', review_template({
          review: response_data.review || {},
          i18n: i18n
        }));
        active_review_root = shared_content_root.querySelector('[data-wpbc-booking-new-inspector-review-view]');
        review_cancel = active_review_root ? active_review_root.querySelector('[data-wpbc-booking-new-inspector-review-cancel]') : null;
        if (review_cancel && 'function' === typeof review_cancel.focus) {
          review_cancel.focus();
        }
      }).fail(function (failed_request, request_status) {
        var error_data;
        var has_field_errors;
        if ('abort' === request_status || current_generation !== review_request_generation || requested_revision !== draft_revision || !active_content_root) {
          return;
        }
        pending_review_request = null;
        error_data = failed_request && failed_request.responseJSON ? failed_request.responseJSON.data : null;
        if (review_button) {
          review_button.disabled = false;
          review_button.removeAttribute('aria-busy');
        }
        if (error_data && error_data.fallback && error_data.fallback.url) {
          active_fallback_url = error_data.fallback.url;
        }
        has_field_errors = render_review_errors(error_data);
        if (!has_field_errors) {
          render_cost({
            status: 'unavailable',
            message: error_data && error_data.message ? error_data.message : i18n.review_failed || '',
            line_items: []
          }, error_data ? error_data.fallback : null);
        }
      });
    }

    /**
     * Return from signed Review to the exact retained editing draft.
     *
     * @return {void}
     */
    function cancel_review() {
      var review_button;
      if ('review' !== state || !active_content_root) {
        return;
      }
      if (active_review_root && active_review_root.parentNode) {
        active_review_root.parentNode.removeChild(active_review_root);
      }
      active_review_root = null;
      active_review = null;
      active_content_root.hidden = false;
      transition('editing');
      review_button = active_content_root.querySelector('[data-wpbc-booking-new-inspector-review]');
      if (review_button) {
        review_button.disabled = false;
        review_button.removeAttribute('aria-busy');
        if ('function' === typeof review_button.focus) {
          review_button.focus();
        }
      }
    }

    /**
     * Apply the exact signed Review through the idempotent server boundary.
     *
     * @return {void}
     */
    function apply_review() {
      var apply_button;
      var apply_message;
      var previous_apply_message;
      var request_values;
      var current_generation;
      if ('review' !== state || !active_review || !active_review_root) {
        return;
      }
      request_values = {
        schema_version: configuration.schema_version,
        request_id: create_request_id(),
        plan: active_review.plan,
        token: active_review.token,
        idempotency_key: active_review.idempotency_key
      };
      apply_request_generation += 1;
      current_generation = apply_request_generation;
      apply_button = active_review_root.querySelector('[data-wpbc-booking-new-inspector-create]');
      if (apply_button) {
        apply_button.disabled = true;
        apply_button.setAttribute('aria-busy', 'true');
      }
      previous_apply_message = active_review_root.querySelector('.wpbc_booking_new_inspector__apply_status');
      if (previous_apply_message) {
        previous_apply_message.remove();
      }
      apply_message = document.createElement('p');
      apply_message.className = 'wpbc_booking_new_inspector__apply_status';
      apply_message.setAttribute('role', 'status');
      apply_message.textContent = i18n.creating_booking || '';
      active_review_root.querySelector('.wpbc_booking_new_inspector__footer_actions').insertBefore(apply_message, active_review_root.querySelector('.wpbc_booking_new_inspector__footer_actions').firstChild);
      if (!transition('applying')) {
        return;
      }
      pending_apply_request = $.ajax({
        url: transport.url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: transport.apply_action,
          nonce: transport.apply_nonce,
          request: JSON.stringify(request_values)
        }
      }).done(function (response) {
        var response_data = response && true === response.success ? response.data : null;
        var created_status;
        var readback_status;
        var readback_retry;
        if (current_generation !== apply_request_generation || !response_data || request_values.request_id !== response_data.request_id || 'created' !== response_data.state) {
          return;
        }
        pending_apply_request = null;
        if (!transition('created')) {
          return;
        }
        created_booking_id = Math.max(0, Math.round(Number(response_data.booking && response_data.booking.booking_id) || 0));
        active_review_root.remove();
        active_review_root = null;
        active_review = null;
        if (schedule_workflow) {
          schedule_workflow.destroy();
        }
        schedule_workflow = null;
        if (active_content_root && active_content_root.parentNode) {
          active_content_root.remove();
        }
        active_content_root = null;
        customer_field_baseline = null;
        note_baseline = null;
        schedule_input_dirty = false;
        shell_root.setAttribute('data-wpbc-booking-new-inspector-dirty', 'false');
        shared_content_root.insertAdjacentHTML('beforeend', created_template({
          booking: response_data.booking || {},
          warnings: response_data.warnings || [],
          i18n: i18n
        }));
        created_status = shared_content_root.querySelector('[data-wpbc-booking-new-inspector-created-status]');
        if (created_status && 'function' === typeof created_status.focus) {
          created_status.focus();
        }
        if (!request_timeline_readback(response_data)) {
          readback_status = shared_content_root.querySelector('[data-wpbc-booking-new-inspector-readback-status]');
          readback_retry = shared_content_root.querySelector('[data-wpbc-booking-new-inspector-readback-retry]');
          if (readback_status) {
            readback_status.setAttribute('role', 'alert');
            readback_status.textContent = i18n.timeline_refresh_failed || '';
          }
          if (readback_retry) {
            readback_retry.hidden = true;
          }
        }
      }).fail(function (failed_request, request_status) {
        var error_data;
        if ('abort' === request_status || current_generation !== apply_request_generation || !active_review_root) {
          return;
        }
        pending_apply_request = null;
        error_data = failed_request && failed_request.responseJSON ? failed_request.responseJSON.data : null;
        transition('error');
        if (error_data && 'editing' === error_data.retry_state) {
          active_review_root.remove();
          active_review_root = null;
          active_review = null;
          active_content_root.hidden = false;
          transition('editing');
          review_button = active_content_root.querySelector('[data-wpbc-booking-new-inspector-review]');
          if (review_button) {
            review_button.disabled = false;
            review_button.removeAttribute('aria-busy');
          }
          render_review_errors(error_data, review_button);
          return;
        }
        transition('review');
        if (apply_message) {
          apply_message.setAttribute('role', 'alert');
          apply_message.textContent = error_data && error_data.message ? error_data.message : i18n.create_failed || '';
        }
        if (apply_button) {
          apply_button.disabled = false;
          apply_button.removeAttribute('aria-busy');
          apply_button.focus();
        }
      });
    }

    /**
     * Start the existing Phase 4 read-only schedule and native-calendar workflow.
     *
     * @param {Object} bootstrap            Authorized bootstrap DTO.
     * @param {Object} launch_request       Validated bootstrap launch envelope.
     * @param {string}      calendar_anchor_date Presentation-only month anchor retained across a Resource/form reload.
     * @param {Object|null} schedule_draft       Server-revalidated schedule proposal retained across the reload.
     * @return {void}
     */
    function start_schedule_workflow(bootstrap, launch_request, calendar_anchor_date, schedule_draft) {
      var dates_host = active_content_root.querySelector('[data-wpbc-booking-new-inspector-dates-host]');
      var schedule_request = {
        schema_version: configuration.schema_version,
        request_id: create_request_id(),
        selection_source: launch_request.selection_source,
        resource_id: bootstrap.selected_resource_id,
        form_id: bootstrap.selected_form_id
      };
      if (launch_request.source_context_token) {
        schedule_request.source_context_token = launch_request.source_context_token;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(calendar_anchor_date || ''))) {
        schedule_request.calendar_anchor_date = String(calendar_anchor_date);
      }
      if ('empty' === launch_request.selection_source && schedule_draft) {
        schedule_request.schedule = schedule_draft;
      }
      schedule_workflow = window.wpbc_booking_new_inspector.create_schedule_workflow({
        root: active_content_root,
        ajax_url: transport.url,
        action: transport.schedule_action,
        nonce: transport.schedule_nonce,
        get_calendar_host: function () {
          return active_content_root ? active_content_root.querySelector('[data-wpbc-booking-new-inspector-calendar-host]') : null;
        },
        on_ready: function (schedule_context) {
          if (!dates_host || !active_content_root) {
            return;
          }
          dates_host.innerHTML = dates_template({
            schedule: schedule_context.schedule || {},
            choices: schedule_context.choices || {},
            i18n: i18n
          });
          set_schedule_error(false);
          schedule_input_dirty = false;
          set_schedule_loading(true);
        },
        on_change: synchronize_schedule,
        on_loading: set_schedule_loading,
        on_error: function () {
          set_schedule_loading(false);
          set_schedule_error(true);
        }
      });
      if (!schedule_workflow || !schedule_workflow.load(schedule_request)) {
        set_schedule_loading(false);
        set_schedule_error(true);
      }
    }

    /**
     * Render authorized editing DTOs through domain-owned templates.
     *
     * @param {Object} bootstrap            Authorized bootstrap response.
     * @param {Object} launch_request       Validated bootstrap launch envelope.
     * @param {string}      calendar_anchor_date Presentation-only month anchor retained across a Resource/form reload.
     * @param {Object|null} schedule_draft       Server-revalidated schedule proposal retained across the reload.
     * @return {void}
     */
    function render_editing(bootstrap, launch_request, calendar_anchor_date, schedule_draft) {
      var content_root;
      var resource_host;
      var fields_host;
      var fields_container;
      var notes_host;
      var dates_host;
      var costs_host;
      var footer_host;
      if (bootstrap.support && 'unsupported' === bootstrap.support.status) {
        active_fallback_url = bootstrap.fallback && bootstrap.fallback.url ? bootstrap.fallback.url : active_fallback_url;
        shared_inspector.set_content(unsupported_template({
          i18n: i18n,
          support: bootstrap.support,
          fallback: bootstrap.fallback,
          canonical_url: configuration.canonical_url || ''
        }), i18n.loaded || '');
        return;
      }
      if (!bootstrap.resources || !bootstrap.resources.length || !bootstrap.forms || !bootstrap.forms.length) {
        render_state('empty', i18n.empty_title || '', i18n.empty_message || '', false);
        return;
      }
      shared_inspector.set_content(shell_template({}), i18n.loaded || '');
      active_content_root = shell_root.querySelector('.wpbc_booking_new_inspector');
      active_bootstrap = bootstrap;
      draft_revision = 0;
      schedule_ready = false;
      cost_correction = '';
      content_root = active_content_root;
      if (!active_content_root) {
        return;
      }
      resource_host = content_root.querySelector('[data-wpbc-booking-new-inspector-resource-host]');
      fields_host = content_root.querySelector('[data-wpbc-booking-new-inspector-fields-host]');
      notes_host = content_root.querySelector('[data-wpbc-booking-new-inspector-notes-host]');
      dates_host = content_root.querySelector('[data-wpbc-booking-new-inspector-dates-host]');
      costs_host = content_root.querySelector('[data-wpbc-booking-new-inspector-costs-host]');
      footer_host = content_root.querySelector('[data-wpbc-booking-new-inspector-footer-host]');
      resource_host.innerHTML = resource_template({
        resources: bootstrap.resources || [],
        forms: bootstrap.forms || [],
        i18n: i18n
      });
      fields_host.innerHTML = fields_template({
        fields: bootstrap.fields || [],
        i18n: i18n
      });
      fields_container = fields_host.querySelector('[data-wpbc-booking-new-inspector-fields]');
      if (fields_container) {
        (bootstrap.fields || []).forEach(function (field, field_index) {
          var field_view = Object.assign({}, field);
          field_view.field_id = 'wpbc_booking_new_inspector_field_' + field_index;
          field_view.error_id = field_view.field_id + '_error';
          fields_container.insertAdjacentHTML('beforeend', field_template(field_view));
        });
      }
      customer_field_baseline = JSON.stringify(get_customer_field_snapshot(active_content_root));
      notes_host.innerHTML = notes_template({
        notes: bootstrap.notes || [],
        i18n: i18n
      });
      note_baseline = JSON.stringify(get_note_snapshot(active_content_root));
      update_dirty_state();
      dates_host.innerHTML = dates_template({
        schedule: bootstrap.schedule || {},
        choices: {},
        i18n: i18n
      });
      render_cost(bootstrap.cost || {}, null);
      footer_host.innerHTML = footer_template({
        url: active_fallback_url,
        i18n: i18n
      });
      start_schedule_workflow(bootstrap, launch_request, calendar_anchor_date, schedule_draft);
      content_root.addEventListener('change', function (event) {
        var resource_select = event.target.closest('[data-wpbc-booking-new-inspector-resource]');
        var form_select = event.target.closest('[data-wpbc-booking-new-inspector-form]');
        var selected_resource = content_root.querySelector('[data-wpbc-booking-new-inspector-resource]');
        var selection_method = event.target.closest('[data-wpbc-booking-new-inspector-selection-method]');
        var time_application = event.target.closest('[data-wpbc-booking-new-inspector-time-application]');
        var start_time = content_root.querySelector('[data-wpbc-booking-new-inspector-start-time]');
        var end_time = content_root.querySelector('[data-wpbc-booking-new-inspector-end-time]');
        var customer_field = event.target.closest('[data-wpbc-booking-new-inspector-field-input]');
        var note_field = event.target.closest('[data-wpbc-booking-new-inspector-note]');
        var cost_correction_input = event.target.closest('[data-wpbc-booking-new-inspector-cost-correction]');
        if (resource_select) {
          var resource_calendar_anchor_date = get_schedule_calendar_anchor_date(schedule_workflow);
          var resource_schedule_draft = get_schedule_reload_draft(schedule_workflow);
          if (!confirm_discard_changes()) {
            resource_select.value = String(bootstrap.selected_resource_id || '');
            return;
          }
          active_fallback_url = configuration.canonical_url || '';
          load({
            resource_id: resource_select.value
          }, {
            selection_source: 'empty'
          }, resource_calendar_anchor_date, resource_schedule_draft);
        } else if (form_select) {
          var form_calendar_anchor_date = get_schedule_calendar_anchor_date(schedule_workflow);
          var form_schedule_draft = get_schedule_reload_draft(schedule_workflow);
          if (!confirm_discard_changes()) {
            form_select.value = String(bootstrap.selected_form_id || '');
            return;
          }
          active_fallback_url = configuration.canonical_url || '';
          load({
            resource_id: selected_resource ? selected_resource.value : '',
            form_id: form_select.value
          }, {
            selection_source: 'empty'
          }, form_calendar_anchor_date, form_schedule_draft);
        } else if (selection_method && schedule_workflow) {
          schedule_workflow.set_selection_method(selection_method.value);
        } else if (time_application && schedule_workflow) {
          schedule_workflow.set_time_application(time_application.value);
        } else if (schedule_workflow && (event.target === start_time || event.target === end_time)) {
          update_schedule_times();
        } else if (cost_correction_input) {
          cost_correction = String(cost_correction_input.value || '').trim();
          invalidate_cost_preview();
          update_dirty_state();
          queue_cost_preview(250);
        } else if (customer_field || note_field) {
          if (customer_field) {
            clear_control_error(customer_field);
          }
          invalidate_cost_preview();
          update_dirty_state();
          queue_cost_preview(250);
        }
      });
      content_root.addEventListener('input', function (event) {
        var cost_correction_input = event.target.closest('[data-wpbc-booking-new-inspector-cost-correction]');
        if (cost_correction_input) {
          cost_correction = String(cost_correction_input.value || '').trim();
          invalidate_cost_preview();
          update_dirty_state();
        } else if (event.target.closest('[data-wpbc-booking-new-inspector-start-time]') || event.target.closest('[data-wpbc-booking-new-inspector-end-time]')) {
          update_schedule_times();
        } else if (event.target.closest('[data-wpbc-booking-new-inspector-field-input]') || event.target.closest('[data-wpbc-booking-new-inspector-note]')) {
          clear_control_error(event.target.closest('[data-wpbc-booking-new-inspector-field-input]'));
          invalidate_cost_preview();
          update_dirty_state();
        }
      });
      content_root.addEventListener('click', function (event) {
        if (event.target.closest('[data-wpbc-booking-new-inspector-schedule-reset]') && schedule_workflow) {
          event.preventDefault();
          schedule_workflow.reset();
          schedule_input_dirty = false;
          update_dirty_state();
        } else if (event.target.closest('[data-wpbc-booking-new-inspector-cost-preview]')) {
          event.preventDefault();
          request_cost_preview();
        } else if (event.target.closest('[data-wpbc-booking-new-inspector-dismiss-cost]')) {
          var review_button = content_root.querySelector('[data-wpbc-booking-new-inspector-review]');
          event.preventDefault();
          cost_section_dismissed = true;
          render_cost({}, null);
          if (review_button && 'function' === typeof review_button.focus) {
            review_button.focus();
          }
        } else if (event.target.closest('[data-wpbc-booking-new-inspector-review]')) {
          event.preventDefault();
          request_review();
        }
      });
    }

    /**
     * Load one authorized bootstrap using an empty or signed Timeline launch.
     *
     * The empty top-navigation launch passes no Resource, form, date, or time. The server
     * selects the authorized defaults. Later select changes may send only the
     * chosen Resource/form identities plus an optional bounded schedule proposal
     * for exact server revalidation.
     *
     * @param {Object} choices               Optional explicit Resource/form choices.
     * @param {Object} launch_request        Validated browser launch envelope.
     * @param {string}      calendar_anchor_date Optional presentation-only month anchor.
     * @param {Object|null} schedule_draft      Optional bounded schedule proposal for a Resource/form reload.
     * @return {void}
     */
    function load(choices, launch_request, calendar_anchor_date, schedule_draft) {
      var request_values;
      var current_generation;
      launch_request = launch_request && 'object' === typeof launch_request ? launch_request : {
        selection_source: 'empty'
      };
      request_values = {
        schema_version: configuration.schema_version,
        request_id: create_request_id(),
        selection_source: launch_request.selection_source
      };
      choices = choices && 'object' === typeof choices ? choices : {};
      calendar_anchor_date = /^\d{4}-\d{2}-\d{2}$/.test(String(calendar_anchor_date || '')) ? String(calendar_anchor_date) : '';
      last_choices = Object.assign({}, choices);
      last_launch_request = Object.assign({}, launch_request);
      last_calendar_anchor_date = calendar_anchor_date;
      last_schedule_draft = schedule_draft ? Object.assign({}, schedule_draft, {
        selected_dates: Array.isArray(schedule_draft.selected_dates) ? schedule_draft.selected_dates.slice(0) : []
      }) : null;
      if (launch_request.source_context_token) {
        request_values.source_context_token = launch_request.source_context_token;
      }
      if (choices.resource_id && /^[1-9][0-9]*$/.test(String(choices.resource_id))) {
        request_values.resource_id = String(choices.resource_id);
      }
      if (choices.form_id) {
        request_values.form_id = String(choices.form_id);
      }
      abort_request();
      if (!transition('loading')) {
        return;
      }
      shared_inspector.reset_header(i18n.title || '');
      render_state('loading', i18n.loading_title || i18n.title || '', i18n.loading || '', false);
      request_generation += 1;
      current_generation = request_generation;
      pending_request = $.ajax({
        url: transport.url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: transport.bootstrap_action,
          nonce: transport.bootstrap_nonce,
          request: JSON.stringify(request_values)
        }
      }).done(function (response) {
        var bootstrap = response && true === response.success ? response.data : null;
        if (current_generation !== request_generation || !shared_inspector.is_open()) {
          return;
        }
        pending_request = null;
        if (!bootstrap || bootstrap.request_id !== request_values.request_id || 'editing' !== bootstrap.state) {
          transition('error');
          render_state('error', i18n.error_title || '', response && response.data && response.data.message ? response.data.message : i18n.load_failed || '', true);
          return;
        }
        transition('editing');
        shared_inspector.set_header(header_template({
          title: i18n.title || '',
          subtitle: i18n.subtitle || ''
        }), i18n.title || '');
        render_editing(bootstrap, launch_request, calendar_anchor_date, last_schedule_draft);
      }).fail(function (failed_request, request_status) {
        var error_data;
        if ('abort' === request_status || current_generation !== request_generation || !shared_inspector.is_open()) {
          return;
        }
        pending_request = null;
        transition('error');
        error_data = failed_request && failed_request.responseJSON ? failed_request.responseJSON.data : null;
        render_state('error', i18n.error_title || '', error_data && error_data.message ? error_data.message : i18n.load_failed || '', true);
      });
    }
    shared_inspector = window.wpbc_shared_ui_inspector.create(shell_root, {
      owner_id: configuration.component_id,
      interaction_group: configuration.component_id,
      on_before_close: confirm_discard_changes,
      on_close: function () {
        var focus_booking_id = 'created' === state ? created_booking_id : 0;
        abort_request();
        state = 'closed';
        shell_root.setAttribute('data-wpbc-booking-new-inspector-state', state);
        request_created_booking_focus(focus_booking_id);
      }
    });
    if (!shared_inspector) {
      return null;
    }
    shell_root.addEventListener('click', function (event) {
      if (event.target.closest('[data-wpbc-booking-new-inspector-retry]')) {
        event.preventDefault();
        load(last_choices, last_launch_request, last_calendar_anchor_date, last_schedule_draft);
      } else if (event.target.closest('[data-wpbc-booking-new-inspector-review-cancel]')) {
        event.preventDefault();
        cancel_review();
      } else if (event.target.closest('[data-wpbc-booking-new-inspector-create]')) {
        event.preventDefault();
        apply_review();
      } else if (event.target.closest('[data-wpbc-booking-new-inspector-readback-retry]')) {
        event.preventDefault();
        if (pending_created_readback && pending_created_readback.response) {
          request_timeline_readback(pending_created_readback.response);
        }
      }
    });
    timeline_event_root.addEventListener(timeline_readback_event_name, handle_timeline_readback);
    return {
      open: function (trigger, launch_request) {
        if ('closed' !== state) {
          shared_inspector.close(false);
          if (shared_inspector.is_open()) {
            return false;
          }
        }
        active_fallback_url = trigger && trigger.href ? trigger.href : configuration.canonical_url || '';
        cost_section_dismissed = false;
        shared_inspector.open(trigger);
        load({}, launch_request, 'empty' === launch_request.selection_source ? get_today_calendar_anchor_date() : '', null);
        return true;
      }
    };
  }

  /**
   * Intercept the stable authorized Timeline launch link when the adapter is ready.
   *
   * If any runtime contract is absent, navigation is intentionally left alone so
   * the canonical Add Booking destination remains available.
   *
   * @param {MouseEvent} event Delegated document click.
   * @return {void}
   */
  function handle_click(event) {
    var trigger = event.target.closest(launch_selector);
    var timeline_settings = window.wpbc_timeline_config && 'object' === typeof window.wpbc_timeline_config ? window.wpbc_timeline_config : {};
    var action = timeline_settings.new_booking && 'object' === typeof timeline_settings.new_booking ? timeline_settings.new_booking : {};
    var configuration = action.inspector && 'object' === typeof action.inspector ? action.inspector : null;
    var launch_request;
    if (!trigger || !configuration) {
      return;
    }
    launch_request = get_launch_request(trigger, configuration);
    if (!launch_request) {
      return;
    }
    if (!controller) {
      controller = create_controller(configuration);
    }
    if (!controller) {
      return;
    }
    event.preventDefault();
    controller.open(trigger, launch_request);
  }
  document.addEventListener('click', handle_click);
})(window, document, window.wp, window.jQuery);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvYm9va2luZy1uZXctaW5zcGVjdG9yL19vdXQvYm9va2luZy1uZXctaW5zcGVjdG9yLmpzIiwibmFtZXMiOlsid2luZG93IiwiZG9jdW1lbnQiLCJ3cCIsIiQiLCJsYXVuY2hfc2VsZWN0b3IiLCJjcmVhdGVkX2V2ZW50X25hbWUiLCJ0aW1lbGluZV9yZWFkYmFja19ldmVudF9uYW1lIiwiZm9jdXNfY3JlYXRlZF9ldmVudF9uYW1lIiwiY29udHJvbGxlciIsImdldF9sYXVuY2hfcmVxdWVzdCIsInRyaWdnZXIiLCJjb25maWd1cmF0aW9uIiwibGF1bmNoX2NvbnRleHQiLCJnZXRBdHRyaWJ1dGUiLCJTdHJpbmciLCJsYXVuY2hfY29udGV4dHMiLCJoYW5kb2ZmX3F1ZXJ5X2FyZyIsIm1heF90b2tlbl9ieXRlcyIsIk51bWJlciIsIm1heF9jb250ZXh0X3Rva2VuX2J5dGVzIiwiY2Fub25pY2FsX3VybCIsInNvdXJjZV9jb250ZXh0X3Rva2VuIiwidG9vbGJhciIsInNlbGVjdGlvbl9zb3VyY2UiLCJ0aW1lbGluZV9zZWxlY3Rpb24iLCJ0aW1lbGluZV90aW1lX3Jvd3MiLCJVUkwiLCJocmVmIiwibG9jYXRpb24iLCJzZWFyY2hQYXJhbXMiLCJnZXQiLCJlcnJvciIsImxlbmd0aCIsInRlc3QiLCJnZXRfdGVtcGxhdGUiLCJ0ZW1wbGF0ZV9pZCIsInRlbXBsYXRlIiwiZ2V0X2N1c3RvbWVyX2ZpZWxkX3NuYXBzaG90IiwiY29udGVudF9yb290IiwiZmllbGRzIiwiZmllbGRfcG9zaXRpb25zIiwiY29udHJvbHMiLCJxdWVyeVNlbGVjdG9yQWxsIiwiQXJyYXkiLCJwcm90b3R5cGUiLCJmb3JFYWNoIiwiY2FsbCIsImNvbnRyb2wiLCJmaWVsZF9rZXkiLCJmaWVsZF9yZWNvcmQiLCJPYmplY3QiLCJoYXNPd25Qcm9wZXJ0eSIsInB1c2giLCJrZXkiLCJ2YWx1ZXMiLCJ0eXBlIiwiY2hlY2tlZCIsInZhbHVlIiwibXVsdGlwbGUiLCJvcHRpb25zIiwib3B0aW9uIiwic2VsZWN0ZWQiLCJnZXRfbm90ZV9zbmFwc2hvdCIsIm5vdGVzIiwibm90ZV90eXBlIiwiZ2V0X3RvZGF5X2NhbGVuZGFyX2FuY2hvcl9kYXRlIiwidG9kYXlfcGFydHMiLCJfd3BiYyIsImdldF9vdGhlcl9wYXJhbSIsInNpdGVfeWVhciIsImlzQXJyYXkiLCJwYXJzZUludCIsInNpdGVfbW9udGgiLCJzaXRlX2RheSIsInNpdGVfdG9kYXkiLCJEYXRlIiwiaGFzX3ZhbGlkX3NpdGVfdG9kYXkiLCJnZXRGdWxsWWVhciIsImdldE1vbnRoIiwiZ2V0RGF0ZSIsInRvZGF5IiwieWVhciIsIm1vbnRoIiwic2xpY2UiLCJkYXkiLCJnZXRfc2NoZWR1bGVfY2FsZW5kYXJfYW5jaG9yX2RhdGUiLCJzY2hlZHVsZV93b3JrZmxvdyIsInNjaGVkdWxlIiwiZ2V0X2RyYWZ0IiwiZmlyc3RfZGF0ZSIsInNlbGVjdGVkX2RhdGVzIiwiZ2V0X3NjaGVkdWxlX3JlbG9hZF9kcmFmdCIsImZpbHRlciIsInNlbGVjdGVkX2RhdGUiLCJzZWxlY3Rpb25fbWV0aG9kIiwidGltZV9hcHBsaWNhdGlvbiIsImluZGV4T2YiLCJzdGFydF90aW1lIiwiZW5kX3RpbWUiLCJjcmVhdGVfY29udHJvbGxlciIsInRpbWVsaW5lX3Jvb3QiLCJxdWVyeVNlbGVjdG9yIiwidGltZWxpbmVfZXZlbnRfcm9vdCIsImNsb3Nlc3QiLCJzaGVsbF9ob3N0IiwidGVtcGxhdGVzIiwidHJhbnNwb3J0IiwiaTE4biIsInNoYXJlZF90ZW1wbGF0ZSIsInNoZWxsX3RlbXBsYXRlIiwic2hlbGwiLCJoZWFkZXJfdGVtcGxhdGUiLCJoZWFkZXIiLCJyZXNvdXJjZV90ZW1wbGF0ZSIsInJlc291cmNlIiwiZmllbGRzX3RlbXBsYXRlIiwiZmllbGRfdGVtcGxhdGUiLCJmaWVsZCIsIm5vdGVzX3RlbXBsYXRlIiwiZGF0ZXNfdGVtcGxhdGUiLCJkYXRlcyIsImNvc3RzX3RlbXBsYXRlIiwiY29zdHMiLCJmb290ZXJfdGVtcGxhdGUiLCJmb290ZXIiLCJyZXZpZXdfdGVtcGxhdGUiLCJyZXZpZXciLCJjcmVhdGVkX3RlbXBsYXRlIiwiY3JlYXRlZCIsInN0YXRlX3RlbXBsYXRlIiwic3RhdGUiLCJ1bnN1cHBvcnRlZF90ZW1wbGF0ZSIsInVuc3VwcG9ydGVkX2Zvcm0iLCJzaGFyZWRfaW5zcGVjdG9yIiwic2hlbGxfcm9vdCIsInNoYXJlZF9jb250ZW50X3Jvb3QiLCJwZW5kaW5nX3JlcXVlc3QiLCJwZW5kaW5nX2Nvc3RfcmVxdWVzdCIsInBlbmRpbmdfcmV2aWV3X3JlcXVlc3QiLCJwZW5kaW5nX2FwcGx5X3JlcXVlc3QiLCJwZW5kaW5nX2NyZWF0ZWRfcmVhZGJhY2siLCJjb3N0X3ByZXZpZXdfdGltZXIiLCJjb3N0X3ByZXZpZXdfZGVmZXJyZWQiLCJjb3N0X3NlY3Rpb25fZGlzbWlzc2VkIiwiYWN0aXZlX2NvbnRlbnRfcm9vdCIsImFjdGl2ZV9yZXZpZXdfcm9vdCIsImFjdGl2ZV9yZXZpZXciLCJhY3RpdmVfYm9vdHN0cmFwIiwiYWN0aXZlX2ZhbGxiYWNrX3VybCIsImxhc3RfY2hvaWNlcyIsImxhc3RfbGF1bmNoX3JlcXVlc3QiLCJsYXN0X2NhbGVuZGFyX2FuY2hvcl9kYXRlIiwibGFzdF9zY2hlZHVsZV9kcmFmdCIsInJlcXVlc3RfZ2VuZXJhdGlvbiIsImNvc3RfcmVxdWVzdF9nZW5lcmF0aW9uIiwicmV2aWV3X3JlcXVlc3RfZ2VuZXJhdGlvbiIsImFwcGx5X3JlcXVlc3RfZ2VuZXJhdGlvbiIsInJlcXVlc3Rfc2VxdWVuY2UiLCJyZWFkYmFja19zZXF1ZW5jZSIsImNyZWF0ZWRfYm9va2luZ19pZCIsImRyYWZ0X3JldmlzaW9uIiwic2NoZWR1bGVfcmVhZHkiLCJjdXN0b21lcl9maWVsZF9iYXNlbGluZSIsIm5vdGVfYmFzZWxpbmUiLCJzY2hlZHVsZV9pbnB1dF9kaXJ0eSIsImNvc3RfY29ycmVjdGlvbiIsImFsbG93ZWRfdHJhbnNpdGlvbnMiLCJjbG9zZWQiLCJsb2FkaW5nIiwiZWRpdGluZyIsImNvc3RfcHJldmlldyIsImFwcGx5aW5nIiwid3BiY19zaGFyZWRfdWlfaW5zcGVjdG9yIiwiY3JlYXRlIiwid3BiY19ib29raW5nX25ld19pbnNwZWN0b3IiLCJjcmVhdGVfc2NoZWR1bGVfd29ya2Zsb3ciLCJ1cmwiLCJib290c3RyYXBfYWN0aW9uIiwiYm9vdHN0cmFwX25vbmNlIiwic2NoZWR1bGVfYWN0aW9uIiwic2NoZWR1bGVfbm9uY2UiLCJjb3N0X2FjdGlvbiIsImNvc3Rfbm9uY2UiLCJyZXZpZXdfYWN0aW9uIiwicmV2aWV3X25vbmNlIiwiYXBwbHlfYWN0aW9uIiwiYXBwbHlfbm9uY2UiLCJpbm5lckhUTUwiLCJpZCIsImNvbXBvbmVudF9pZCIsInRpdGxlIiwiY2xvc2VfbGFiZWwiLCJjbG9zZSIsImxvYWRpbmdfbGFiZWwiLCJzZXRBdHRyaWJ1dGUiLCJhYm9ydF9yZXF1ZXN0IiwiYWJvcnQiLCJjbGVhclRpbWVvdXQiLCJkZXN0cm95IiwidHJhbnNpdGlvbiIsIm5leHRfc3RhdGUiLCJpc19kaXJ0eSIsImN1c3RvbWVyX2ZpZWxkc19jaGFuZ2VkIiwiSlNPTiIsInN0cmluZ2lmeSIsIm5vdGVzX2NoYW5nZWQiLCJzY2hlZHVsZV9jaGFuZ2VkIiwiQm9vbGVhbiIsInVwZGF0ZV9kaXJ0eV9zdGF0ZSIsImNhbl9wcmV2aWV3X2Nvc3QiLCJlZGl0aW9uX2NhcGFiaWxpdGllcyIsImludmFsaWRhdGVfY29zdF9wcmV2aWV3IiwiY29zdF9zdGF0dXMiLCJjb3N0X2J1dHRvbiIsImludmFsaWRhdGVfcmV2aWV3IiwidGV4dENvbnRlbnQiLCJjb3N0X3N0YWxlIiwiZGlzYWJsZWQiLCJxdWV1ZV9jb3N0X3ByZXZpZXciLCJkZWxheV9tcyIsInNldFRpbWVvdXQiLCJyZXF1ZXN0X2Nvc3RfcHJldmlldyIsIk1hdGgiLCJtYXgiLCJjb25maXJtX2Rpc2NhcmRfY2hhbmdlcyIsImNvbmZpcm0iLCJkaXNjYXJkX2NoYW5nZXMiLCJyZXF1ZXN0X3RpbWVsaW5lX3JlYWRiYWNrIiwicmVzcG9uc2VfZGF0YSIsImJvb2tpbmciLCJib29raW5nX2lkIiwicm91bmQiLCJyZXNvdXJjZV9pZCIsImV2ZW50X2RldGFpbCIsImNyZWF0ZWRfZXZlbnQiLCJzY2hlbWFfdmVyc2lvbiIsInJlcXVlc3RfaWQiLCJhcHBseV9yZXF1ZXN0X2lkIiwib3Blbl9ib29raW5nX2luc3BlY3RvciIsIm9wZW5fY3JlYXRlZF9ib29raW5nX2luc3BlY3RvciIsInJlc3BvbnNlIiwiQ3VzdG9tRXZlbnQiLCJkZXRhaWwiLCJjcmVhdGVFdmVudCIsImluaXRDdXN0b21FdmVudCIsImRpc3BhdGNoRXZlbnQiLCJyZXF1ZXN0X2NyZWF0ZWRfYm9va2luZ19mb2N1cyIsImZvY3VzX2V2ZW50IiwiaGFuZGxlX3RpbWVsaW5lX3JlYWRiYWNrIiwiZXZlbnQiLCJzdGF0dXMiLCJyZXRyeSIsInJlbW92ZUF0dHJpYnV0ZSIsImJvb2tpbmdfdmlzaWJsZSIsInRpbWVsaW5lX3JlZnJlc2hlZCIsInRpbWVsaW5lX3JlY29yZF9ub3RfdmlzaWJsZSIsImhpZGRlbiIsInRpbWVsaW5lX3JlZnJlc2hfZmFpbGVkIiwiZm9jdXMiLCJjcmVhdGVfcmVxdWVzdF9pZCIsIm5vdyIsInRvU3RyaW5nIiwicmVuZGVyX3N0YXRlIiwic3RhdGVfaWQiLCJtZXNzYWdlIiwic2V0X3N0YXRlIiwiZ2V0X2ZpZWxkX2ZlZWRiYWNrX25vZGVzIiwiZmVlZGJhY2siLCJmaWVsZHNldCIsInNvbWUiLCJjbGVhcl9maWVsZF9lcnJvciIsImhhZF9lcnJvciIsImNsYXNzTGlzdCIsInJlbW92ZSIsImNsZWFyX3Jldmlld19lcnJvcnMiLCJyZXZpZXdfZXJyb3IiLCJlcnJvcl9ub2RlIiwiY2xlYXJfY29udHJvbF9lcnJvciIsInJlbmRlcl9yZXZpZXdfZXJyb3JzIiwiZXJyb3JfZGF0YSIsImZhbGxiYWNrX3RhcmdldCIsImZpZWxkX2Vycm9ycyIsImZpcnN0X2NvbnRyb2wiLCJmaXJzdF9maWVsZCIsInNlZW5fZmllbGRzIiwibWF0Y2hlZF9lcnJvciIsInJldmlld19mYWlsZWQiLCJmaWVsZF9lcnJvciIsImFkZCIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsImNhbGxiYWNrIiwic2Nyb2xsX3RhcmdldCIsImZvY3VzX3RhcmdldCIsInJlZHVjZWRfbW90aW9uIiwibWF0Y2hNZWRpYSIsIm1hdGNoZXMiLCJzY3JvbGxJbnRvVmlldyIsImJlaGF2aW9yIiwiYmxvY2siLCJzY3JvbGxfZXJyb3IiLCJwcmV2ZW50U2Nyb2xsIiwiZm9jdXNfZXJyb3IiLCJnZXRfbWlzc2luZ19yZXF1aXJlZF9maWVsZF9lcnJvcnMiLCJmaWVsZF9zbmFwc2hvdHMiLCJ2YWx1ZXNfYnlfa2V5IiwiYXV0aG9yaXplZF9maWVsZHMiLCJmaWVsZF9zbmFwc2hvdCIsImZpZWxkX2NvbnRyYWN0IiwiZmllbGRfdmFsdWVzIiwiaGFzX3ZhbHVlIiwiZmllbGRfdmFsdWUiLCJ0cmltIiwicmVxdWlyZWQiLCJjb2RlIiwiZmllbGRfcmVxdWlyZWQiLCJyZW5kZXJfcmV2aWV3X3JlYWRpbmVzc19lcnJvcnMiLCJoYXNfc2VsZWN0ZWRfZGF0ZXMiLCJzY2hlZHVsZV9tZXNzYWdlIiwic2NoZWR1bGVfbm90X3JlYWR5Iiwic2NoZWR1bGVfcmVxdWlyZWQiLCJyZXZpZXdfbWVzc2FnZSIsInJldmlld19pbmNvbXBsZXRlIiwic2NoZWR1bGVfZXJyb3IiLCJzZXRfc2NoZWR1bGVfZXJyb3IiLCJzeW5jaHJvbml6ZV9zY2hlZHVsZSIsImNoYW5nZV9jb250ZXh0IiwiZGF0ZXNfbGlzdCIsInNlbGVjdGVkX2NvdW50IiwidGltZV9yb3ciLCJyZXNldF9idXR0b24iLCJub19kYXRlcyIsImRhdGVfZW50cnkiLCJjcmVhdGVFbGVtZW50IiwiYXBwZW5kQ2hpbGQiLCJ1cGRhdGVfc2NoZWR1bGVfdGltZXMiLCJhY2NlcHRlZCIsInNldF90aW1lcyIsInNldF9zY2hlZHVsZV9sb2FkaW5nIiwiaXNfbG9hZGluZyIsImNhbGVuZGFyX2hvc3QiLCJzdGF0dXNfaG9zdCIsInNjaGVkdWxlX2NvbnRyb2xzIiwibG9hZGluZ19zY2hlZHVsZSIsImhhc19lcnJvciIsImVycm9yX2hvc3QiLCJlcnJvcl9tZXNzYWdlIiwic2NoZWR1bGVfZmFpbGVkIiwiZ2V0X2Nvc3RfdmFsaWRhdGlvbl9tZXNzYWdlcyIsImxhYmVsc19ieV9rZXkiLCJsYWJlbCIsImJvb2tpbmdfZGV0YWlscyIsIm1hcCIsImZpZWxkX2xhYmVsIiwicmVuZGVyX2Nvc3QiLCJjb3N0X2R0byIsImZhbGxiYWNrIiwidmFsaWRhdGlvbl9tZXNzYWdlcyIsImNvc3RzX2hvc3QiLCJyZXN0b3JlX2Nvc3RfZm9jdXMiLCJuZXh0X2Nvc3RfYnV0dG9uIiwiYWN0aXZlRWxlbWVudCIsImNvc3QiLCJ1cGdyYWRlX3JlcXVpcmVkIiwiY29ycmVjdGlvbl9hbGxvd2VkIiwiY29ycmVjdGlvbl92YWx1ZSIsImdldF9kcmFmdF9yZXF1ZXN0Iiwic2VsZWN0ZWRfcmVzb3VyY2VfaWQiLCJmb3JtX2lkIiwic2VsZWN0ZWRfZm9ybV9pZCIsImZvcm1fc291cmNlIiwiZW1haWxfaW50ZW50IiwiY29zdF9pbnRlbnQiLCJjb3JyZWN0ZWRfY29zdCIsInJlcXVlc3RfdmFsdWVzIiwiY3VycmVudF9nZW5lcmF0aW9uIiwicmVxdWVzdGVkX3JldmlzaW9uIiwiY29zdF9yZXF1ZXN0IiwiY29zdF9mYWlsZWQiLCJjYWxjdWxhdGluZ19jb3N0IiwiYWpheCIsIm1ldGhvZCIsImRhdGFUeXBlIiwiZGF0YSIsImFjdGlvbiIsIm5vbmNlIiwicmVxdWVzdCIsImRvbmUiLCJzdWNjZXNzIiwibGluZV9pdGVtcyIsIndhcm5pbmdzIiwiZmFpbCIsImZhaWxlZF9yZXF1ZXN0IiwicmVxdWVzdF9zdGF0dXMiLCJyZXZpZXdfYnV0dG9uIiwicmVzcG9uc2VKU09OIiwiYWx3YXlzIiwicmVxdWVzdF9sYXRlc3RfcHJldmlldyIsInJlcXVlc3RfcmV2aWV3IiwicmV2aWV3X2NhbmNlbCIsImluc2VydEFkamFjZW50SFRNTCIsImhhc19maWVsZF9lcnJvcnMiLCJjYW5jZWxfcmV2aWV3IiwicGFyZW50Tm9kZSIsInJlbW92ZUNoaWxkIiwiYXBwbHlfcmV2aWV3IiwiYXBwbHlfYnV0dG9uIiwiYXBwbHlfbWVzc2FnZSIsInByZXZpb3VzX2FwcGx5X21lc3NhZ2UiLCJwbGFuIiwidG9rZW4iLCJpZGVtcG90ZW5jeV9rZXkiLCJjbGFzc05hbWUiLCJjcmVhdGluZ19ib29raW5nIiwiaW5zZXJ0QmVmb3JlIiwiZmlyc3RDaGlsZCIsImNyZWF0ZWRfc3RhdHVzIiwicmVhZGJhY2tfc3RhdHVzIiwicmVhZGJhY2tfcmV0cnkiLCJyZXRyeV9zdGF0ZSIsImNyZWF0ZV9mYWlsZWQiLCJzdGFydF9zY2hlZHVsZV93b3JrZmxvdyIsImJvb3RzdHJhcCIsImxhdW5jaF9yZXF1ZXN0IiwiY2FsZW5kYXJfYW5jaG9yX2RhdGUiLCJzY2hlZHVsZV9kcmFmdCIsImRhdGVzX2hvc3QiLCJzY2hlZHVsZV9yZXF1ZXN0Iiwicm9vdCIsImFqYXhfdXJsIiwiZ2V0X2NhbGVuZGFyX2hvc3QiLCJvbl9yZWFkeSIsInNjaGVkdWxlX2NvbnRleHQiLCJjaG9pY2VzIiwib25fY2hhbmdlIiwib25fbG9hZGluZyIsIm9uX2Vycm9yIiwibG9hZCIsInJlbmRlcl9lZGl0aW5nIiwicmVzb3VyY2VfaG9zdCIsImZpZWxkc19ob3N0IiwiZmllbGRzX2NvbnRhaW5lciIsIm5vdGVzX2hvc3QiLCJmb290ZXJfaG9zdCIsInN1cHBvcnQiLCJzZXRfY29udGVudCIsImxvYWRlZCIsInJlc291cmNlcyIsImZvcm1zIiwiZW1wdHlfdGl0bGUiLCJlbXB0eV9tZXNzYWdlIiwiZmllbGRfaW5kZXgiLCJmaWVsZF92aWV3IiwiYXNzaWduIiwiZmllbGRfaWQiLCJlcnJvcl9pZCIsImFkZEV2ZW50TGlzdGVuZXIiLCJyZXNvdXJjZV9zZWxlY3QiLCJ0YXJnZXQiLCJmb3JtX3NlbGVjdCIsInNlbGVjdGVkX3Jlc291cmNlIiwiY3VzdG9tZXJfZmllbGQiLCJub3RlX2ZpZWxkIiwiY29zdF9jb3JyZWN0aW9uX2lucHV0IiwicmVzb3VyY2VfY2FsZW5kYXJfYW5jaG9yX2RhdGUiLCJyZXNvdXJjZV9zY2hlZHVsZV9kcmFmdCIsImZvcm1fY2FsZW5kYXJfYW5jaG9yX2RhdGUiLCJmb3JtX3NjaGVkdWxlX2RyYWZ0Iiwic2V0X3NlbGVjdGlvbl9tZXRob2QiLCJzZXRfdGltZV9hcHBsaWNhdGlvbiIsInByZXZlbnREZWZhdWx0IiwicmVzZXQiLCJyZXNldF9oZWFkZXIiLCJsb2FkaW5nX3RpdGxlIiwiaXNfb3BlbiIsImVycm9yX3RpdGxlIiwibG9hZF9mYWlsZWQiLCJzZXRfaGVhZGVyIiwic3VidGl0bGUiLCJvd25lcl9pZCIsImludGVyYWN0aW9uX2dyb3VwIiwib25fYmVmb3JlX2Nsb3NlIiwib25fY2xvc2UiLCJmb2N1c19ib29raW5nX2lkIiwib3BlbiIsImhhbmRsZV9jbGljayIsInRpbWVsaW5lX3NldHRpbmdzIiwid3BiY190aW1lbGluZV9jb25maWciLCJuZXdfYm9va2luZyIsImluc3BlY3RvciIsImpRdWVyeSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL2Jvb2tpbmctbmV3LWluc3BlY3Rvci9fc3JjL2Jvb2tpbmctbmV3LWluc3BlY3Rvci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRpbWVsaW5lIGhvc3QgYWRhcHRlciBmb3IgdGhlIEFkZCBOZXcgQm9va2luZyBJbnNwZWN0b3IgZWRpdGluZyBzaGVsbC5cbiAqXG4gKiBUaGUgY2Fub25pY2FsIHRvcC1uYXZpZ2F0aW9uIGxpbmsgd29ya3Mgd2l0aG91dCB0aGlzIGFkYXB0ZXIuIFdoZW4gY29tcGlsZWQgYW5kXG4gKiBlbnF1ZXVlZCwgdGhpcyBzb3VyY2UgaW50ZXJjZXB0cyBvbmx5IHRoZSBhdXRob3JpemVkIHN0YWJsZSBtYXJrZXIsIG9wZW5zIHRoZVxuICogc2hhcmVkIEluc3BlY3RvciwgYW5kIHBlcmZvcm1zIGF1dGhlbnRpY2F0ZWQgZGF0YS1vbmx5IGJvb3RzdHJhcCwgc2NoZWR1bGUsXG4gKiBjb3N0IHJlYWRzLCBzaWduZWQgUmV2aWV3LCBpZGVtcG90ZW50IEFwcGx5LCBhbmQgaG9zdC1vd25lZCBUaW1lbGluZSByZWFkYmFjay5cbiAqIFBlcnNpc3RlbmNlIHJlbWFpbnMgc2VydmVyLWF1dGhvcml0YXRpdmUgYW5kIGNhbm5vdCBiZSBpbml0aWF0ZWQgYnkgcmVuZGVyaW5nLlxuICpcbiAqIEBwYWNrYWdlIEJvb2tpbmcgQ2FsZW5kYXJcbiAqIEBzaW5jZSAgIDEyLjAuMFxuICovXG4oIGZ1bmN0aW9uICggd2luZG93LCBkb2N1bWVudCwgd3AsICQgKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHR2YXIgbGF1bmNoX3NlbGVjdG9yID0gJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLW9wZW5dJztcblx0dmFyIGNyZWF0ZWRfZXZlbnRfbmFtZSA9ICd3cGJjOmJvb2tpbmctbmV3LWluc3BlY3RvcjpjcmVhdGVkJztcblx0dmFyIHRpbWVsaW5lX3JlYWRiYWNrX2V2ZW50X25hbWUgPSAnd3BiYzpib29raW5nLW5ldy1pbnNwZWN0b3I6dGltZWxpbmUtcmVhZGJhY2snO1xuXHR2YXIgZm9jdXNfY3JlYXRlZF9ldmVudF9uYW1lID0gJ3dwYmM6Ym9va2luZy1uZXctaW5zcGVjdG9yOmZvY3VzLWNyZWF0ZWQnO1xuXHR2YXIgY29udHJvbGxlciA9IG51bGw7XG5cblx0LyoqXG5cdCAqIFJlc29sdmUgdGhlIGJvdW5kZWQgYm9vdHN0cmFwIGVudmVsb3BlIGZvciBvbmUgc2VydmVyLW1hcmtlZCBsYXVuY2ggbGluay5cblx0ICpcblx0ICogU2VsZWN0aW9uIGxpbmtzIGNvbnRyaWJ1dGUgb25seSB0aGUgb3BhcXVlIHNpZ25lZCB0b2tlbiBhbHJlYWR5IHByZXNlbnQgaW5cblx0ICogdGhlaXIgY2Fub25pY2FsIEFkZCBCb29raW5nIFVSTC4gVGhpcyBhZGFwdGVyIG5ldmVyIGRlY29kZXMgdGhlIHRva2VuIG9yXG5cdCAqIGRlcml2ZXMgZGF0ZXMgYW5kIHRpbWVzIGZyb20gVGltZWxpbmUgZ2VvbWV0cnkuXG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gdHJpZ2dlciAgICAgICBBdXRob3JpemVkIHNlcnZlci1yZW5kZXJlZCBsYXVuY2ggYW5jaG9yLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlndXJhdGlvbiBFeGVjdXRhYmxlLWZyZWUgZG9tYWluIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBCb290c3RyYXAgbGF1bmNoIHZhbHVlcywgb3IgbnVsbCB0byBwcmVzZXJ2ZSBuYXZpZ2F0aW9uLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2xhdW5jaF9yZXF1ZXN0KCB0cmlnZ2VyLCBjb25maWd1cmF0aW9uICkge1xuXHRcdHZhciBsYXVuY2hfY29udGV4dCA9IHRyaWdnZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHRyaWdnZXIuZ2V0QXR0cmlidXRlXG5cdFx0XHQ/IFN0cmluZyggdHJpZ2dlci5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLW9wZW4nICkgfHwgJycgKVxuXHRcdFx0OiAnJztcblx0XHR2YXIgbGF1bmNoX2NvbnRleHRzID0gY29uZmlndXJhdGlvbi5sYXVuY2hfY29udGV4dHMgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBjb25maWd1cmF0aW9uLmxhdW5jaF9jb250ZXh0c1xuXHRcdFx0PyBjb25maWd1cmF0aW9uLmxhdW5jaF9jb250ZXh0c1xuXHRcdFx0OiB7fTtcblx0XHR2YXIgaGFuZG9mZl9xdWVyeV9hcmcgPSBTdHJpbmcoIGNvbmZpZ3VyYXRpb24uaGFuZG9mZl9xdWVyeV9hcmcgfHwgJycgKTtcblx0XHR2YXIgbWF4X3Rva2VuX2J5dGVzID0gTnVtYmVyKCBjb25maWd1cmF0aW9uLm1heF9jb250ZXh0X3Rva2VuX2J5dGVzIHx8IDAgKTtcblx0XHR2YXIgY2Fub25pY2FsX3VybDtcblx0XHR2YXIgc291cmNlX2NvbnRleHRfdG9rZW47XG5cblx0XHRpZiAoIFN0cmluZyggbGF1bmNoX2NvbnRleHRzLnRvb2xiYXIgfHwgJycgKSA9PT0gbGF1bmNoX2NvbnRleHQgKSB7XG5cdFx0XHRyZXR1cm4geyBzZWxlY3Rpb25fc291cmNlOiAnZW1wdHknIH07XG5cdFx0fVxuXHRcdGlmIChcblx0XHRcdFN0cmluZyggbGF1bmNoX2NvbnRleHRzLnRpbWVsaW5lX3NlbGVjdGlvbiB8fCAnJyApICE9PSBsYXVuY2hfY29udGV4dFxuXHRcdFx0JiYgU3RyaW5nKCBsYXVuY2hfY29udGV4dHMudGltZWxpbmVfdGltZV9yb3dzIHx8ICcnICkgIT09IGxhdW5jaF9jb250ZXh0XG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0aWYgKCAhIGhhbmRvZmZfcXVlcnlfYXJnIHx8ICEgbWF4X3Rva2VuX2J5dGVzIHx8ICEgd2luZG93LlVSTCB8fCAhIHRyaWdnZXIuaHJlZiApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRjYW5vbmljYWxfdXJsID0gbmV3IHdpbmRvdy5VUkwoIHRyaWdnZXIuaHJlZiwgd2luZG93LmxvY2F0aW9uLmhyZWYgKTtcblx0XHRcdHNvdXJjZV9jb250ZXh0X3Rva2VuID0gU3RyaW5nKCBjYW5vbmljYWxfdXJsLnNlYXJjaFBhcmFtcy5nZXQoIGhhbmRvZmZfcXVlcnlfYXJnICkgfHwgJycgKTtcblx0XHR9IGNhdGNoICggZXJyb3IgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRpZiAoXG5cdFx0XHQhIHNvdXJjZV9jb250ZXh0X3Rva2VuXG5cdFx0XHR8fCBtYXhfdG9rZW5fYnl0ZXMgPCBzb3VyY2VfY29udGV4dF90b2tlbi5sZW5ndGhcblx0XHRcdHx8ICEgL15bQS1aYS16MC05Ll8tXSskLy50ZXN0KCBzb3VyY2VfY29udGV4dF90b2tlbiApXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0c2VsZWN0aW9uX3NvdXJjZTogJ3RpbWVsaW5lJyxcblx0XHRcdHNvdXJjZV9jb250ZXh0X3Rva2VuOiBzb3VyY2VfY29udGV4dF90b2tlblxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogUmVzb2x2ZSBvbmUgc2VydmVyLWFsbG93LWxpc3RlZCBXb3JkUHJlc3MgdGVtcGxhdGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZV9pZCBTdGFibGUgc2VydmVyLXN1cHBsaWVkIHRlbXBsYXRlIGlkZW50aWZpZXIuXG5cdCAqIEByZXR1cm4ge0Z1bmN0aW9ufG51bGx9IFRlbXBsYXRlIHJlbmRlcmVyIG9yIG51bGwuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfdGVtcGxhdGUoIHRlbXBsYXRlX2lkICkge1xuXHRcdHJldHVybiB0ZW1wbGF0ZV9pZCAmJiB3cCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd3AudGVtcGxhdGUgPyB3cC50ZW1wbGF0ZSggdGVtcGxhdGVfaWQgKSA6IG51bGw7XG5cdH1cblxuXHQvKipcblx0ICogUmVhZCBib3VuZGVkIGN1c3RvbWVyLWZpZWxkIHZhbHVlcyByZW5kZXJlZCBmcm9tIGF1dGhvcml6ZWQgRFRPcy5cblx0ICpcblx0ICogVGhlIHNuYXBzaG90IHN1cHBvcnRzIGxvY2FsIGRpcnR5LXN0YXRlIGNvbXBhcmlzb24gb25seS4gSXQgZG9lcyBub3Rcblx0ICogc2VyaWFsaXplIG1hcmt1cCwgYXV0aG9yaXplIHZhbHVlcywgb3IgcHJvZHVjZSBhIHNlcnZlciByZXF1ZXN0IHBheWxvYWQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudHxudWxsfSBjb250ZW50X3Jvb3QgQWN0aXZlIGRvbWFpbiBjb250ZW50IHJvb3QuXG5cdCAqIEByZXR1cm4ge0FycmF5PE9iamVjdD59IE9yZGVyZWQgZmllbGQga2V5cyB3aXRoIG9yZGVyZWQgc2NhbGFyIHZhbHVlcy5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9jdXN0b21lcl9maWVsZF9zbmFwc2hvdCggY29udGVudF9yb290ICkge1xuXHRcdHZhciBmaWVsZHMgPSBbXTtcblx0XHR2YXIgZmllbGRfcG9zaXRpb25zID0ge307XG5cdFx0dmFyIGNvbnRyb2xzID0gY29udGVudF9yb290XG5cdFx0XHQ/IGNvbnRlbnRfcm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItZmllbGQtaW5wdXRdJyApXG5cdFx0XHQ6IFtdO1xuXG5cdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCggY29udHJvbHMsIGZ1bmN0aW9uICggY29udHJvbCApIHtcblx0XHRcdHZhciBmaWVsZF9rZXkgPSBTdHJpbmcoIGNvbnRyb2wuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1maWVsZC1pbnB1dCcgKSB8fCAnJyApO1xuXHRcdFx0dmFyIGZpZWxkX3JlY29yZDtcblxuXHRcdFx0aWYgKCAhIGZpZWxkX2tleSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggZmllbGRfcG9zaXRpb25zLCBmaWVsZF9rZXkgKSApIHtcblx0XHRcdFx0ZmllbGRfcG9zaXRpb25zWyBmaWVsZF9rZXkgXSA9IGZpZWxkcy5sZW5ndGg7XG5cdFx0XHRcdGZpZWxkcy5wdXNoKCB7IGtleTogZmllbGRfa2V5LCB2YWx1ZXM6IFtdIH0gKTtcblx0XHRcdH1cblx0XHRcdGZpZWxkX3JlY29yZCA9IGZpZWxkc1sgZmllbGRfcG9zaXRpb25zWyBmaWVsZF9rZXkgXSBdO1xuXHRcdFx0aWYgKCAnY2hlY2tib3gnID09PSBjb250cm9sLnR5cGUgfHwgJ3JhZGlvJyA9PT0gY29udHJvbC50eXBlICkge1xuXHRcdFx0XHRpZiAoIGNvbnRyb2wuY2hlY2tlZCApIHtcblx0XHRcdFx0XHRmaWVsZF9yZWNvcmQudmFsdWVzLnB1c2goIFN0cmluZyggY29udHJvbC52YWx1ZSB8fCAnJyApICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjb250cm9sLm11bHRpcGxlICYmIGNvbnRyb2wub3B0aW9ucyApIHtcblx0XHRcdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCggY29udHJvbC5vcHRpb25zLCBmdW5jdGlvbiAoIG9wdGlvbiApIHtcblx0XHRcdFx0XHRpZiAoIG9wdGlvbi5zZWxlY3RlZCApIHtcblx0XHRcdFx0XHRcdGZpZWxkX3JlY29yZC52YWx1ZXMucHVzaCggU3RyaW5nKCBvcHRpb24udmFsdWUgfHwgJycgKSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRmaWVsZF9yZWNvcmQudmFsdWVzLnB1c2goIFN0cmluZyggY29udHJvbC52YWx1ZSB8fCAnJyApICk7XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIGZpZWxkcztcblx0fVxuXG5cdC8qKlxuXHQgKiBSZWFkIHRoZSBleGFjdCBhdXRob3JpemVkIG5vdGUgY29udHJvbHMgcmVuZGVyZWQgYnkgdGhlIGRvbWFpbiB0ZW1wbGF0ZS5cblx0ICpcblx0ICogQHBhcmFtIHtFbGVtZW50fG51bGx9IGNvbnRlbnRfcm9vdCBBY3RpdmUgZG9tYWluIGNvbnRlbnQgcm9vdC5cblx0ICogQHJldHVybiB7T2JqZWN0fSBOb3RlIHZhbHVlcyBrZXllZCBieSB0aGVpciBzdGFibGUgYXV0aG9yaXplZCB0eXBlLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X25vdGVfc25hcHNob3QoIGNvbnRlbnRfcm9vdCApIHtcblx0XHR2YXIgbm90ZXMgPSB7fTtcblx0XHR2YXIgY29udHJvbHMgPSBjb250ZW50X3Jvb3Rcblx0XHRcdD8gY29udGVudF9yb290LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1ub3RlXScgKVxuXHRcdFx0OiBbXTtcblxuXHRcdEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoIGNvbnRyb2xzLCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHR2YXIgbm90ZV90eXBlID0gU3RyaW5nKCBjb250cm9sLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3Itbm90ZScgKSB8fCAnJyApO1xuXG5cdFx0XHRpZiAoICdwdWJsaWMnID09PSBub3RlX3R5cGUgfHwgJ3ByaXZhdGUnID09PSBub3RlX3R5cGUgKSB7XG5cdFx0XHRcdG5vdGVzWyBub3RlX3R5cGUgXSA9IFN0cmluZyggY29udHJvbC52YWx1ZSB8fCAnJyApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblxuXHRcdHJldHVybiBub3Rlcztcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gdG9kYXkncyBzdHJpY3Qgc2l0ZS1sb2NhbCBjYWxlbmRhciBkYXRlIHdpdGhvdXQgVVRDIGRhdGUgcm9sbG92ZXIuXG5cdCAqXG5cdCAqIEVtcHR5IHRvcC1uYXZpZ2F0aW9uIGxhdW5jaGVzIGhhdmUgbm8gc2lnbmVkIHNjaGVkdWxlIHNlZWQuIFRoaXMgdmFsdWUgaXNcblx0ICogcHJlc2VudGF0aW9uLW9ubHkgYW5kIHRlbGxzIHRoZSBuYXRpdmUgY2FsZW5kYXIgd2hpY2ggbW9udGggdG8gZGlzcGxheTsgaXRcblx0ICogbmV2ZXIgc2VsZWN0cyBhIGRhdGUgb3IgZ3JhbnRzIGJvb2tpbmcgYXV0aG9yaXR5LlxuXHQgKlxuXHQgKiBUaGUgbmF0aXZlIGNhbGVuZGFyIGFscmVhZHkgcmVjZWl2ZXMgV29yZFByZXNzJ3Mgc2l0ZS1sb2NhbCBkYXRlIHRocm91Z2hcblx0ICogYF93cGJjLnRvZGF5X2FycmAuIFJldXNpbmcgdGhhdCB2YWx1ZSBwcmV2ZW50cyBhbiBhZG1pbmlzdHJhdG9yJ3MgYnJvd3NlclxuXHQgKiB0aW1lem9uZSBmcm9tIG9wZW5pbmcgdGhlIGFkamFjZW50IG1vbnRoLiBUaGUgYnJvd3Nlci1sb2NhbCBkYXRlIHJlbWFpbnMgYVxuXHQgKiBjb21wYXRpYmlsaXR5IGZhbGxiYWNrIHdoZW4gdGhlIGVzdGFibGlzaGVkIFdvcmRQcmVzcyByZWdpc3RyeSBpcyBhYnNlbnQuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gU2l0ZS1sb2NhbCBZWVlZLU1NLUREIGRhdGUsIG9yIGJyb3dzZXItbG9jYWwgZmFsbGJhY2suXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfdG9kYXlfY2FsZW5kYXJfYW5jaG9yX2RhdGUoKSB7XG5cdFx0dmFyIHRvZGF5X3BhcnRzID0gd2luZG93Ll93cGJjICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuX3dwYmMuZ2V0X290aGVyX3BhcmFtXG5cdFx0XHQ/IHdpbmRvdy5fd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInIClcblx0XHRcdDogW107XG5cdFx0dmFyIHNpdGVfeWVhciA9IEFycmF5LmlzQXJyYXkoIHRvZGF5X3BhcnRzICkgPyBwYXJzZUludCggdG9kYXlfcGFydHNbIDAgXSwgMTAgKSA6IDA7XG5cdFx0dmFyIHNpdGVfbW9udGggPSBBcnJheS5pc0FycmF5KCB0b2RheV9wYXJ0cyApID8gcGFyc2VJbnQoIHRvZGF5X3BhcnRzWyAxIF0sIDEwICkgOiAwO1xuXHRcdHZhciBzaXRlX2RheSA9IEFycmF5LmlzQXJyYXkoIHRvZGF5X3BhcnRzICkgPyBwYXJzZUludCggdG9kYXlfcGFydHNbIDIgXSwgMTAgKSA6IDA7XG5cdFx0dmFyIHNpdGVfdG9kYXkgPSBuZXcgRGF0ZSggc2l0ZV95ZWFyLCBzaXRlX21vbnRoIC0gMSwgc2l0ZV9kYXkgKTtcblx0XHR2YXIgaGFzX3ZhbGlkX3NpdGVfdG9kYXkgPSBzaXRlX3llYXIgPj0gMTAwMFxuXHRcdFx0JiYgc2l0ZV9tb250aCA+PSAxXG5cdFx0XHQmJiBzaXRlX21vbnRoIDw9IDEyXG5cdFx0XHQmJiBzaXRlX2RheSA+PSAxXG5cdFx0XHQmJiBzaXRlX2RheSA8PSAzMVxuXHRcdFx0JiYgc2l0ZV90b2RheS5nZXRGdWxsWWVhcigpID09PSBzaXRlX3llYXJcblx0XHRcdCYmIHNpdGVfdG9kYXkuZ2V0TW9udGgoKSA9PT0gc2l0ZV9tb250aCAtIDFcblx0XHRcdCYmIHNpdGVfdG9kYXkuZ2V0RGF0ZSgpID09PSBzaXRlX2RheTtcblx0XHR2YXIgdG9kYXkgPSBoYXNfdmFsaWRfc2l0ZV90b2RheSA/IHNpdGVfdG9kYXkgOiBuZXcgRGF0ZSgpO1xuXHRcdHZhciB5ZWFyID0gU3RyaW5nKCB0b2RheS5nZXRGdWxsWWVhcigpICk7XG5cdFx0dmFyIG1vbnRoID0gKCAnMCcgKyBTdHJpbmcoIHRvZGF5LmdldE1vbnRoKCkgKyAxICkgKS5zbGljZSggLTIgKTtcblx0XHR2YXIgZGF5ID0gKCAnMCcgKyBTdHJpbmcoIHRvZGF5LmdldERhdGUoKSApICkuc2xpY2UoIC0yICk7XG5cblx0XHRyZXR1cm4geWVhciArICctJyArIG1vbnRoICsgJy0nICsgZGF5O1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlYWQgdGhlIGN1cnJlbnQgc2NoZWR1bGUncyBmaXJzdCBkYXRlIGFzIGEgcHJlc2VudGF0aW9uLW9ubHkgbW9udGggYW5jaG9yLlxuXHQgKlxuXHQgKiBSZXNvdXJjZSBhbmQgZm9ybSBjaGFuZ2VzIGRpc2NhcmQgdGhlIG9sZCBzaWduZWQgVGltZWxpbmUgYXV0aG9yaXR5LiBBXG5cdCAqIGJvdW5kZWQgc2VsZWN0ZWQgZGF0ZSBrZWVwcyB0aGUgcmVwbGFjZW1lbnQgUmVzb3VyY2UgY2FsZW5kYXIgb24gdGhlXG5cdCAqIHJldmlld2VkIG1vbnRoIHdoaWxlIGl0cyBzY2hlZHVsZSBwcm9wb3NhbCBpcyByZXZhbGlkYXRlZCBpbmRlcGVuZGVudGx5IGJ5XG5cdCAqIHRoZSBzZXJ2ZXIuIEFuIGVtcHR5IGRyYWZ0IHJldHVybnMgdG8gdGhlIGN1cnJlbnQgc2l0ZS1sb2NhbCBtb250aCBpbnN0ZWFkXG5cdCAqIG9mIGxldHRpbmcgdGhlIG5hdGl2ZSBjYWxlbmRhciBmYWxsIGJhY2sgdG8gaXRzIG9sZGVzdCBhbGxvd2VkIHBhc3QgbW9udGguXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fG51bGx9IHNjaGVkdWxlX3dvcmtmbG93IEFjdGl2ZSBjcmVhdGlvbiBzY2hlZHVsZSB3b3JrZmxvdy5cblx0ICogQHJldHVybiB7c3RyaW5nfSBTdHJpY3Qgc2VsZWN0ZWQtZGF0ZSBvciBzaXRlLXRvZGF5IFlZWVktTU0tREQgYW5jaG9yLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X3NjaGVkdWxlX2NhbGVuZGFyX2FuY2hvcl9kYXRlKCBzY2hlZHVsZV93b3JrZmxvdyApIHtcblx0XHR2YXIgc2NoZWR1bGUgPSBzY2hlZHVsZV93b3JrZmxvdyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc2NoZWR1bGVfd29ya2Zsb3cuZ2V0X2RyYWZ0XG5cdFx0XHQ/IHNjaGVkdWxlX3dvcmtmbG93LmdldF9kcmFmdCgpXG5cdFx0XHQ6IG51bGw7XG5cdFx0dmFyIGZpcnN0X2RhdGUgPSBzY2hlZHVsZSAmJiBBcnJheS5pc0FycmF5KCBzY2hlZHVsZS5zZWxlY3RlZF9kYXRlcyApICYmIHNjaGVkdWxlLnNlbGVjdGVkX2RhdGVzLmxlbmd0aFxuXHRcdFx0PyBTdHJpbmcoIHNjaGVkdWxlLnNlbGVjdGVkX2RhdGVzWyAwIF0gfHwgJycgKVxuXHRcdFx0OiAnJztcblxuXHRcdHJldHVybiAvXlxcZHs0fS1cXGR7Mn0tXFxkezJ9JC8udGVzdCggZmlyc3RfZGF0ZSApID8gZmlyc3RfZGF0ZSA6IGdldF90b2RheV9jYWxlbmRhcl9hbmNob3JfZGF0ZSgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFByb2plY3QgdGhlIGFjdGl2ZSBzY2hlZHVsZSBpbnRvIHRoZSBib3VuZGVkIGRpcmVjdC1yZWxvYWQgcmVxdWVzdCBzaGFwZS5cblx0ICpcblx0ICogQSBSZXNvdXJjZS9mb3JtIHJlcGxhY2VtZW50IGNhbm5vdCByZXVzZSBhIHNpZ25lZCBUaW1lbGluZSB0b2tlbiBiZWNhdXNlXG5cdCAqIHRoYXQgdG9rZW4gYmluZHMgaXRzIG9yaWdpbmFsIFJlc291cmNlLiBUaGUgY3VycmVudCBub3JtYWxpemVkIGRhdGVzIGFuZFxuXHQgKiB0aW1lcyBtYXkgaW5zdGVhZCBiZSBwcm9wb3NlZCB0byB0aGUgc2NoZWR1bGUgZW5kcG9pbnQsIHdoaWNoIHJlcGVhdHNcblx0ICogUmVzb3VyY2UvZm9ybSBhdXRob3JpemF0aW9uIGFuZCBwb2xpY3kgdmFsaWRhdGlvbiBiZWZvcmUgbmF0aXZlIGF2YWlsYWJpbGl0eVxuXHQgKiBoeWRyYXRlcyB0aGUgcmVwbGFjZW1lbnQgY2FsZW5kYXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fG51bGx9IHNjaGVkdWxlX3dvcmtmbG93IEFjdGl2ZSBjcmVhdGlvbiBzY2hlZHVsZSB3b3JrZmxvdy5cblx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IEV4YWN0IHNjaGVkdWxlIGZpZWxkcywgb3IgbnVsbCB3aGVuIHVuYXZhaWxhYmxlL2VtcHR5LlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X3NjaGVkdWxlX3JlbG9hZF9kcmFmdCggc2NoZWR1bGVfd29ya2Zsb3cgKSB7XG5cdFx0dmFyIHNjaGVkdWxlID0gc2NoZWR1bGVfd29ya2Zsb3cgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHNjaGVkdWxlX3dvcmtmbG93LmdldF9kcmFmdFxuXHRcdFx0PyBzY2hlZHVsZV93b3JrZmxvdy5nZXRfZHJhZnQoKVxuXHRcdFx0OiBudWxsO1xuXHRcdHZhciBzZWxlY3RlZF9kYXRlcztcblxuXHRcdGlmICggISBzY2hlZHVsZSB8fCAhIEFycmF5LmlzQXJyYXkoIHNjaGVkdWxlLnNlbGVjdGVkX2RhdGVzICkgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0c2VsZWN0ZWRfZGF0ZXMgPSBzY2hlZHVsZS5zZWxlY3RlZF9kYXRlcy5maWx0ZXIoIGZ1bmN0aW9uICggc2VsZWN0ZWRfZGF0ZSApIHtcblx0XHRcdHJldHVybiAnc3RyaW5nJyA9PT0gdHlwZW9mIHNlbGVjdGVkX2RhdGUgJiYgL15cXGR7NH0tXFxkezJ9LVxcZHsyfSQvLnRlc3QoIHNlbGVjdGVkX2RhdGUgKTtcblx0XHR9ICkuc2xpY2UoIDAgKTtcblx0XHRpZiAoICEgc2VsZWN0ZWRfZGF0ZXMubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHNlbGVjdGlvbl9tZXRob2Q6ICdpbmRpdmlkdWFsJyA9PT0gc2NoZWR1bGUuc2VsZWN0aW9uX21ldGhvZCA/ICdpbmRpdmlkdWFsJyA6ICdwb2xpY3knLFxuXHRcdFx0dGltZV9hcHBsaWNhdGlvbjogLTEgIT09IFsgJ2Z1bGxfZGF5JywgJ2JvdW5kYXJ5JywgJ3Blcl9kYXRlJyBdLmluZGV4T2YoIHNjaGVkdWxlLnRpbWVfYXBwbGljYXRpb24gKSA/IHNjaGVkdWxlLnRpbWVfYXBwbGljYXRpb24gOiAnZnVsbF9kYXknLFxuXHRcdFx0c2VsZWN0ZWRfZGF0ZXM6IHNlbGVjdGVkX2RhdGVzLFxuXHRcdFx0c3RhcnRfdGltZTogJ3N0cmluZycgPT09IHR5cGVvZiBzY2hlZHVsZS5zdGFydF90aW1lID8gc2NoZWR1bGUuc3RhcnRfdGltZSA6ICcnLFxuXHRcdFx0ZW5kX3RpbWU6ICdzdHJpbmcnID09PSB0eXBlb2Ygc2NoZWR1bGUuZW5kX3RpbWUgPyBzY2hlZHVsZS5lbmRfdGltZSA6ICcnXG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGUgdGhlIGlzb2xhdGVkIFRpbWVsaW5lIEluc3BlY3RvciBhZGFwdGVyIGxhemlseS5cblx0ICpcblx0ICogRGVsYXlpbmcgaW5pdGlhbGl6YXRpb24gdW50aWwgYW4gYXV0aG9yaXplZCBjbGljayBlbnN1cmVzIHRoZSBUaW1lbGluZVxuXHQgKiBzaGVsbCBhbmQgaXRzIGRvbWFpbiBob3N0IGhhdmUgYWxyZWFkeSBiZWVuIHJlbmRlcmVkIGJ5IHRoZSBtYWluIHJ1bnRpbWUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWd1cmF0aW9uIEF1dGhvcml6ZWQgZG9tYWluIGJyb3dzZXIgY29uZmlndXJhdGlvbi5cblx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IEFkYXB0ZXIgY29udHJvbGxlciBvciBudWxsIHdoZW4gY29udHJhY3RzIGFyZSBhYnNlbnQuXG5cdCAqL1xuXHRmdW5jdGlvbiBjcmVhdGVfY29udHJvbGxlciggY29uZmlndXJhdGlvbiApIHtcblx0XHR2YXIgdGltZWxpbmVfcm9vdCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLWNvbXBvbmVudF0nICk7XG5cdFx0Ly8gVGhlIFRpbWVsaW5lIGNvbnRyb2xsZXIgb3ducyB0aGUgb3V0ZXIgbW91bnQgYW5kIHRoZXNlIGV2ZW50cyBkbyBub3QgYnViYmxlLlxuXHRcdHZhciB0aW1lbGluZV9ldmVudF9yb290ID0gdGltZWxpbmVfcm9vdFxuXHRcdFx0PyB0aW1lbGluZV9yb290LmNsb3Nlc3QoICdbZGF0YS13cGJjLXRpbWVsaW5lLW1vdW50XScgKSB8fCB0aW1lbGluZV9yb290XG5cdFx0XHQ6IG51bGw7XG5cdFx0dmFyIHNoZWxsX2hvc3QgPSB0aW1lbGluZV9yb290ID8gdGltZWxpbmVfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItaG9zdF0nICkgOiBudWxsO1xuXHRcdHZhciB0ZW1wbGF0ZXMgPSBjb25maWd1cmF0aW9uLnRlbXBsYXRlcyAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIGNvbmZpZ3VyYXRpb24udGVtcGxhdGVzID8gY29uZmlndXJhdGlvbi50ZW1wbGF0ZXMgOiB7fTtcblx0XHR2YXIgdHJhbnNwb3J0ID0gY29uZmlndXJhdGlvbi50cmFuc3BvcnQgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBjb25maWd1cmF0aW9uLnRyYW5zcG9ydCA/IGNvbmZpZ3VyYXRpb24udHJhbnNwb3J0IDoge307XG5cdFx0dmFyIGkxOG4gPSBjb25maWd1cmF0aW9uLmkxOG4gJiYgJ29iamVjdCcgPT09IHR5cGVvZiBjb25maWd1cmF0aW9uLmkxOG4gPyBjb25maWd1cmF0aW9uLmkxOG4gOiB7fTtcblx0XHR2YXIgc2hhcmVkX3RlbXBsYXRlID0gZ2V0X3RlbXBsYXRlKCBjb25maWd1cmF0aW9uLnNoYXJlZF90ZW1wbGF0ZSApO1xuXHRcdHZhciBzaGVsbF90ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggdGVtcGxhdGVzLnNoZWxsICk7XG5cdFx0dmFyIGhlYWRlcl90ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggdGVtcGxhdGVzLmhlYWRlciApO1xuXHRcdHZhciByZXNvdXJjZV90ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggdGVtcGxhdGVzLnJlc291cmNlICk7XG5cdFx0dmFyIGZpZWxkc190ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggdGVtcGxhdGVzLmZpZWxkcyApO1xuXHRcdHZhciBmaWVsZF90ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggdGVtcGxhdGVzLmZpZWxkICk7XG5cdFx0dmFyIG5vdGVzX3RlbXBsYXRlID0gZ2V0X3RlbXBsYXRlKCB0ZW1wbGF0ZXMubm90ZXMgKTtcblx0XHR2YXIgZGF0ZXNfdGVtcGxhdGUgPSBnZXRfdGVtcGxhdGUoIHRlbXBsYXRlcy5kYXRlcyApO1xuXHRcdHZhciBjb3N0c190ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggdGVtcGxhdGVzLmNvc3RzICk7XG5cdFx0dmFyIGZvb3Rlcl90ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggdGVtcGxhdGVzLmZvb3RlciApO1xuXHRcdHZhciByZXZpZXdfdGVtcGxhdGUgPSBnZXRfdGVtcGxhdGUoIHRlbXBsYXRlcy5yZXZpZXcgKTtcblx0XHR2YXIgY3JlYXRlZF90ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggdGVtcGxhdGVzLmNyZWF0ZWQgKTtcblx0XHR2YXIgc3RhdGVfdGVtcGxhdGUgPSBnZXRfdGVtcGxhdGUoIHRlbXBsYXRlcy5zdGF0ZSApO1xuXHRcdHZhciB1bnN1cHBvcnRlZF90ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggdGVtcGxhdGVzLnVuc3VwcG9ydGVkX2Zvcm0gKTtcblx0XHR2YXIgc2hhcmVkX2luc3BlY3Rvcjtcblx0XHR2YXIgc2hlbGxfcm9vdDtcblx0XHR2YXIgc2hhcmVkX2NvbnRlbnRfcm9vdDtcblx0XHR2YXIgcGVuZGluZ19yZXF1ZXN0ID0gbnVsbDtcblx0XHR2YXIgcGVuZGluZ19jb3N0X3JlcXVlc3QgPSBudWxsO1xuXHRcdHZhciBwZW5kaW5nX3Jldmlld19yZXF1ZXN0ID0gbnVsbDtcblx0XHR2YXIgcGVuZGluZ19hcHBseV9yZXF1ZXN0ID0gbnVsbDtcblx0XHR2YXIgcGVuZGluZ19jcmVhdGVkX3JlYWRiYWNrID0gbnVsbDtcblx0XHR2YXIgY29zdF9wcmV2aWV3X3RpbWVyID0gbnVsbDtcblx0XHR2YXIgY29zdF9wcmV2aWV3X2RlZmVycmVkID0gZmFsc2U7XG5cdFx0dmFyIGNvc3Rfc2VjdGlvbl9kaXNtaXNzZWQgPSBmYWxzZTtcblx0XHR2YXIgc2NoZWR1bGVfd29ya2Zsb3cgPSBudWxsO1xuXHRcdHZhciBhY3RpdmVfY29udGVudF9yb290ID0gbnVsbDtcblx0XHR2YXIgYWN0aXZlX3Jldmlld19yb290ID0gbnVsbDtcblx0XHR2YXIgYWN0aXZlX3JldmlldyA9IG51bGw7XG5cdFx0dmFyIGFjdGl2ZV9ib290c3RyYXAgPSBudWxsO1xuXHRcdHZhciBhY3RpdmVfZmFsbGJhY2tfdXJsID0gY29uZmlndXJhdGlvbi5jYW5vbmljYWxfdXJsIHx8ICcnO1xuXHRcdHZhciBsYXN0X2Nob2ljZXMgPSB7fTtcblx0XHR2YXIgbGFzdF9sYXVuY2hfcmVxdWVzdCA9IHsgc2VsZWN0aW9uX3NvdXJjZTogJ2VtcHR5JyB9O1xuXHRcdHZhciBsYXN0X2NhbGVuZGFyX2FuY2hvcl9kYXRlID0gJyc7XG5cdFx0dmFyIGxhc3Rfc2NoZWR1bGVfZHJhZnQgPSBudWxsO1xuXHRcdHZhciByZXF1ZXN0X2dlbmVyYXRpb24gPSAwO1xuXHRcdHZhciBjb3N0X3JlcXVlc3RfZ2VuZXJhdGlvbiA9IDA7XG5cdFx0dmFyIHJldmlld19yZXF1ZXN0X2dlbmVyYXRpb24gPSAwO1xuXHRcdHZhciBhcHBseV9yZXF1ZXN0X2dlbmVyYXRpb24gPSAwO1xuXHRcdHZhciByZXF1ZXN0X3NlcXVlbmNlID0gMDtcblx0XHR2YXIgcmVhZGJhY2tfc2VxdWVuY2UgPSAwO1xuXHRcdHZhciBjcmVhdGVkX2Jvb2tpbmdfaWQgPSAwO1xuXHRcdHZhciBkcmFmdF9yZXZpc2lvbiA9IDA7XG5cdFx0dmFyIHNjaGVkdWxlX3JlYWR5ID0gZmFsc2U7XG5cdFx0dmFyIGN1c3RvbWVyX2ZpZWxkX2Jhc2VsaW5lID0gbnVsbDtcblx0XHR2YXIgbm90ZV9iYXNlbGluZSA9IG51bGw7XG5cdFx0dmFyIHNjaGVkdWxlX2lucHV0X2RpcnR5ID0gZmFsc2U7XG5cdFx0dmFyIGNvc3RfY29ycmVjdGlvbiA9ICcnO1xuXHRcdHZhciBzdGF0ZSA9ICdjbG9zZWQnO1xuXHRcdHZhciBhbGxvd2VkX3RyYW5zaXRpb25zID0ge1xuXHRcdFx0Y2xvc2VkOiBbICdsb2FkaW5nJyBdLFxuXHRcdFx0bG9hZGluZzogWyAnZWRpdGluZycsICdlcnJvcicsICdjbG9zZWQnIF0sXG5cdFx0XHRlZGl0aW5nOiBbICdsb2FkaW5nJywgJ2Nvc3RfcHJldmlldycsICdyZXZpZXcnLCAnZXJyb3InLCAnY2xvc2VkJyBdLFxuXHRcdFx0Y29zdF9wcmV2aWV3OiBbICdlZGl0aW5nJywgJ2xvYWRpbmcnLCAncmV2aWV3JywgJ2Vycm9yJywgJ2Nsb3NlZCcgXSxcblx0XHRcdHJldmlldzogWyAnZWRpdGluZycsICdhcHBseWluZycsICdlcnJvcicsICdjbG9zZWQnIF0sXG5cdFx0XHRhcHBseWluZzogWyAnY3JlYXRlZCcsICdlcnJvcicgXSxcblx0XHRcdGNyZWF0ZWQ6IFsgJ2Nsb3NlZCcgXSxcblx0XHRcdGVycm9yOiBbICdsb2FkaW5nJywgJ2VkaXRpbmcnLCAncmV2aWV3JywgJ2FwcGx5aW5nJywgJ2Nsb3NlZCcgXVxuXHRcdH07XG5cblx0XHRpZiAoXG5cdFx0XHQhIHRpbWVsaW5lX3Jvb3QgfHwgISBzaGVsbF9ob3N0IHx8ICEgc2hhcmVkX3RlbXBsYXRlIHx8ICEgc2hlbGxfdGVtcGxhdGUgfHwgISBoZWFkZXJfdGVtcGxhdGVcblx0XHRcdHx8ICEgcmVzb3VyY2VfdGVtcGxhdGUgfHwgISBmaWVsZHNfdGVtcGxhdGUgfHwgISBmaWVsZF90ZW1wbGF0ZSB8fCAhIG5vdGVzX3RlbXBsYXRlIHx8ICEgZGF0ZXNfdGVtcGxhdGVcblx0XHRcdHx8ICEgY29zdHNfdGVtcGxhdGUgfHwgISBmb290ZXJfdGVtcGxhdGUgfHwgISByZXZpZXdfdGVtcGxhdGUgfHwgISBjcmVhdGVkX3RlbXBsYXRlIHx8ICEgc3RhdGVfdGVtcGxhdGUgfHwgISB1bnN1cHBvcnRlZF90ZW1wbGF0ZVxuXHRcdFx0fHwgISB3aW5kb3cud3BiY19zaGFyZWRfdWlfaW5zcGVjdG9yIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiB3aW5kb3cud3BiY19zaGFyZWRfdWlfaW5zcGVjdG9yLmNyZWF0ZVxuXHRcdFx0fHwgISB3aW5kb3cud3BiY19ib29raW5nX25ld19pbnNwZWN0b3IgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy53cGJjX2Jvb2tpbmdfbmV3X2luc3BlY3Rvci5jcmVhdGVfc2NoZWR1bGVfd29ya2Zsb3dcblx0XHRcdHx8ICEgdHJhbnNwb3J0LnVybCB8fCAhIHRyYW5zcG9ydC5ib290c3RyYXBfYWN0aW9uIHx8ICEgdHJhbnNwb3J0LmJvb3RzdHJhcF9ub25jZVxuXHRcdFx0fHwgISB0cmFuc3BvcnQuc2NoZWR1bGVfYWN0aW9uIHx8ICEgdHJhbnNwb3J0LnNjaGVkdWxlX25vbmNlXG5cdFx0XHR8fCAhIHRyYW5zcG9ydC5jb3N0X2FjdGlvbiB8fCAhIHRyYW5zcG9ydC5jb3N0X25vbmNlXG5cdFx0XHR8fCAhIHRyYW5zcG9ydC5yZXZpZXdfYWN0aW9uIHx8ICEgdHJhbnNwb3J0LnJldmlld19ub25jZVxuXHRcdFx0fHwgISB0cmFuc3BvcnQuYXBwbHlfYWN0aW9uIHx8ICEgdHJhbnNwb3J0LmFwcGx5X25vbmNlXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRzaGVsbF9ob3N0LmlubmVySFRNTCA9IHNoYXJlZF90ZW1wbGF0ZSgge1xuXHRcdFx0aWQ6IGNvbmZpZ3VyYXRpb24uY29tcG9uZW50X2lkLFxuXHRcdFx0dGl0bGU6IGkxOG4udGl0bGUgfHwgJycsXG5cdFx0XHRjbG9zZV9sYWJlbDogaTE4bi5jbG9zZSB8fCAnJyxcblx0XHRcdGxvYWRpbmdfbGFiZWw6IGkxOG4ubG9hZGluZyB8fCAnJ1xuXHRcdH0gKTtcblx0XHRzaGVsbF9yb290ID0gc2hlbGxfaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zaGFyZWQtdWktaW5zcGVjdG9yXScgKTtcblx0XHRpZiAoICEgc2hlbGxfcm9vdCApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRzaGFyZWRfY29udGVudF9yb290ID0gc2hlbGxfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zaGFyZWQtdWktaW5zcGVjdG9yLWNvbnRlbnRdJyApO1xuXHRcdGlmICggISBzaGFyZWRfY29udGVudF9yb290ICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHNoYXJlZF9jb250ZW50X3Jvb3Quc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1jb250ZW50JywgJycgKTtcblxuXHRcdC8qKlxuXHRcdCAqIEFib3J0IHRoZSBhY3RpdmUgcmVhZCBhbmQgaW52YWxpZGF0ZSBldmVyeSBvbGRlciBjYWxsYmFjay5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYWJvcnRfcmVxdWVzdCgpIHtcblx0XHRcdHJlcXVlc3RfZ2VuZXJhdGlvbiArPSAxO1xuXHRcdFx0aWYgKCBwZW5kaW5nX3JlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHBlbmRpbmdfcmVxdWVzdC5hYm9ydCApIHtcblx0XHRcdFx0cGVuZGluZ19yZXF1ZXN0LmFib3J0KCk7XG5cdFx0XHR9XG5cdFx0XHRwZW5kaW5nX3JlcXVlc3QgPSBudWxsO1xuXHRcdFx0aWYgKCBjb3N0X3ByZXZpZXdfdGltZXIgKSB7XG5cdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIGNvc3RfcHJldmlld190aW1lciApO1xuXHRcdFx0XHRjb3N0X3ByZXZpZXdfdGltZXIgPSBudWxsO1xuXHRcdFx0fVxuXHRcdFx0Y29zdF9wcmV2aWV3X2RlZmVycmVkID0gZmFsc2U7XG5cdFx0XHRjb3N0X3JlcXVlc3RfZ2VuZXJhdGlvbiArPSAxO1xuXHRcdFx0aWYgKCBwZW5kaW5nX2Nvc3RfcmVxdWVzdCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgcGVuZGluZ19jb3N0X3JlcXVlc3QuYWJvcnQgKSB7XG5cdFx0XHRcdHBlbmRpbmdfY29zdF9yZXF1ZXN0LmFib3J0KCk7XG5cdFx0XHR9XG5cdFx0XHRwZW5kaW5nX2Nvc3RfcmVxdWVzdCA9IG51bGw7XG5cdFx0XHRyZXZpZXdfcmVxdWVzdF9nZW5lcmF0aW9uICs9IDE7XG5cdFx0XHRpZiAoIHBlbmRpbmdfcmV2aWV3X3JlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHBlbmRpbmdfcmV2aWV3X3JlcXVlc3QuYWJvcnQgKSB7XG5cdFx0XHRcdHBlbmRpbmdfcmV2aWV3X3JlcXVlc3QuYWJvcnQoKTtcblx0XHRcdH1cblx0XHRcdHBlbmRpbmdfcmV2aWV3X3JlcXVlc3QgPSBudWxsO1xuXHRcdFx0YXBwbHlfcmVxdWVzdF9nZW5lcmF0aW9uICs9IDE7XG5cdFx0XHRpZiAoIHBlbmRpbmdfYXBwbHlfcmVxdWVzdCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgcGVuZGluZ19hcHBseV9yZXF1ZXN0LmFib3J0ICkge1xuXHRcdFx0XHRwZW5kaW5nX2FwcGx5X3JlcXVlc3QuYWJvcnQoKTtcblx0XHRcdH1cblx0XHRcdHBlbmRpbmdfYXBwbHlfcmVxdWVzdCA9IG51bGw7XG5cdFx0XHRwZW5kaW5nX2NyZWF0ZWRfcmVhZGJhY2sgPSBudWxsO1xuXHRcdFx0Y3JlYXRlZF9ib29raW5nX2lkID0gMDtcblx0XHRcdGlmICggc2NoZWR1bGVfd29ya2Zsb3cgKSB7XG5cdFx0XHRcdHNjaGVkdWxlX3dvcmtmbG93LmRlc3Ryb3koKTtcblx0XHRcdH1cblx0XHRcdHNjaGVkdWxlX3dvcmtmbG93ID0gbnVsbDtcblx0XHRcdGFjdGl2ZV9jb250ZW50X3Jvb3QgPSBudWxsO1xuXHRcdFx0YWN0aXZlX3Jldmlld19yb290ID0gbnVsbDtcblx0XHRcdGFjdGl2ZV9yZXZpZXcgPSBudWxsO1xuXHRcdFx0YWN0aXZlX2Jvb3RzdHJhcCA9IG51bGw7XG5cdFx0XHRkcmFmdF9yZXZpc2lvbiA9IDA7XG5cdFx0XHRzY2hlZHVsZV9yZWFkeSA9IGZhbHNlO1xuXHRcdFx0Y3VzdG9tZXJfZmllbGRfYmFzZWxpbmUgPSBudWxsO1xuXHRcdFx0bm90ZV9iYXNlbGluZSA9IG51bGw7XG5cdFx0XHRzY2hlZHVsZV9pbnB1dF9kaXJ0eSA9IGZhbHNlO1xuXHRcdFx0Y29zdF9jb3JyZWN0aW9uID0gJyc7XG5cdFx0XHRzaGVsbF9yb290LnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItZGlydHknLCAnZmFsc2UnICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQXBwbHkgb25lIGFsbG93ZWQgSW5zcGVjdG9yIHN0YXRlIHRyYW5zaXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbmV4dF9zdGF0ZSBTdGFibGUgbmV4dCBzdGF0ZS5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIHRyYW5zaXRpb24gd2FzIGFjY2VwdGVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHRyYW5zaXRpb24oIG5leHRfc3RhdGUgKSB7XG5cdFx0XHRpZiAoIHN0YXRlID09PSBuZXh0X3N0YXRlICkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggISBhbGxvd2VkX3RyYW5zaXRpb25zWyBzdGF0ZSBdIHx8IC0xID09PSBhbGxvd2VkX3RyYW5zaXRpb25zWyBzdGF0ZSBdLmluZGV4T2YoIG5leHRfc3RhdGUgKSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0c3RhdGUgPSBuZXh0X3N0YXRlO1xuXHRcdFx0aWYgKCBzaGVsbF9yb290ICkge1xuXHRcdFx0XHRzaGVsbF9yb290LnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3Itc3RhdGUnLCBzdGF0ZSApO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXBvcnQgd2hldGhlciBjdXN0b21lciBmaWVsZHMgb3IgdGhlIGNyZWF0aW9uIHNjaGVkdWxlIGRpZmZlciBmcm9tIHNlZWQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gY2xvc2luZyBvciByZXBsYWNpbmcgdGhlIGRyYWZ0IG5lZWRzIGNvbnNlbnQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaXNfZGlydHkoKSB7XG5cdFx0XHR2YXIgY3VzdG9tZXJfZmllbGRzX2NoYW5nZWQgPSBudWxsICE9PSBjdXN0b21lcl9maWVsZF9iYXNlbGluZVxuXHRcdFx0XHQmJiBjdXN0b21lcl9maWVsZF9iYXNlbGluZSAhPT0gSlNPTi5zdHJpbmdpZnkoIGdldF9jdXN0b21lcl9maWVsZF9zbmFwc2hvdCggYWN0aXZlX2NvbnRlbnRfcm9vdCApICk7XG5cdFx0XHR2YXIgbm90ZXNfY2hhbmdlZCA9IG51bGwgIT09IG5vdGVfYmFzZWxpbmVcblx0XHRcdFx0JiYgbm90ZV9iYXNlbGluZSAhPT0gSlNPTi5zdHJpbmdpZnkoIGdldF9ub3RlX3NuYXBzaG90KCBhY3RpdmVfY29udGVudF9yb290ICkgKTtcblx0XHRcdHZhciBzY2hlZHVsZV9jaGFuZ2VkID0gc2NoZWR1bGVfd29ya2Zsb3dcblx0XHRcdFx0JiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHNjaGVkdWxlX3dvcmtmbG93LmlzX2RpcnR5XG5cdFx0XHRcdCYmIHNjaGVkdWxlX3dvcmtmbG93LmlzX2RpcnR5KCk7XG5cblx0XHRcdHJldHVybiBCb29sZWFuKCBjdXN0b21lcl9maWVsZHNfY2hhbmdlZCB8fCBub3Rlc19jaGFuZ2VkIHx8IHNjaGVkdWxlX2NoYW5nZWQgfHwgc2NoZWR1bGVfaW5wdXRfZGlydHkgfHwgJycgIT09IGNvc3RfY29ycmVjdGlvbiApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEV4cG9zZSB0aGUgZHJhZnQgc3RhdGUgdG8gcHJlc2VudGF0aW9uIGFuZCBhY2Nlc3NpYmlsaXR5IGRpYWdub3N0aWNzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB1cGRhdGVfZGlydHlfc3RhdGUoKSB7XG5cdFx0XHRzaGVsbF9yb290LnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItZGlydHknLCBpc19kaXJ0eSgpID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlcG9ydCB3aGV0aGVyIHRoZSBjdXJyZW50IGF1dGhvcml6ZWQgZWRpdGlvbiBleHBvc2VzIEluc3BlY3RvciBwcmljaW5nLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSBvbmx5IGZvciBCdXNpbmVzcyBTbWFsbCBvciBoaWdoZXIgY2FwYWJpbGl0eSBEVE9zLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNhbl9wcmV2aWV3X2Nvc3QoKSB7XG5cdFx0XHRyZXR1cm4gQm9vbGVhbiggYWN0aXZlX2Jvb3RzdHJhcCAmJiBhY3RpdmVfYm9vdHN0cmFwLmVkaXRpb25fY2FwYWJpbGl0aWVzICYmIGFjdGl2ZV9ib290c3RyYXAuZWRpdGlvbl9jYXBhYmlsaXRpZXMuY29zdF9wcmV2aWV3ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSW52YWxpZGF0ZSBhbnkgZGlzcGxheWVkIG9yIGluLWZsaWdodCBjb3N0IGFmdGVyIGEgZHJhZnQgY2hhbmdlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbnZhbGlkYXRlX2Nvc3RfcHJldmlldygpIHtcblx0XHRcdHZhciBjb3N0X3N0YXR1cztcblx0XHRcdHZhciBjb3N0X2J1dHRvbjtcblxuXHRcdFx0aWYgKCBjb3N0X3ByZXZpZXdfdGltZXIgKSB7XG5cdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIGNvc3RfcHJldmlld190aW1lciApO1xuXHRcdFx0XHRjb3N0X3ByZXZpZXdfdGltZXIgPSBudWxsO1xuXHRcdFx0fVxuXHRcdFx0ZHJhZnRfcmV2aXNpb24gKz0gMTtcblx0XHRcdGNvc3RfcmVxdWVzdF9nZW5lcmF0aW9uICs9IDE7XG5cdFx0XHRpbnZhbGlkYXRlX3JldmlldygpO1xuXHRcdFx0aWYgKCAnY29zdF9wcmV2aWV3JyA9PT0gc3RhdGUgKSB7XG5cdFx0XHRcdHRyYW5zaXRpb24oICdlZGl0aW5nJyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjYW5fcHJldmlld19jb3N0KCkgKSB7XG5cdFx0XHRcdGNvc3Rfc3RhdHVzID0gYWN0aXZlX2NvbnRlbnRfcm9vdCA/IGFjdGl2ZV9jb250ZW50X3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLWNvc3Qtc3RhdHVzXScgKSA6IG51bGw7XG5cdFx0XHRcdGlmICggY29zdF9zdGF0dXMgKSB7XG5cdFx0XHRcdFx0Y29zdF9zdGF0dXMudGV4dENvbnRlbnQgPSBpMThuLmNvc3Rfc3RhbGUgfHwgJyc7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29zdF9idXR0b24gPSBhY3RpdmVfY29udGVudF9yb290ID8gYWN0aXZlX2NvbnRlbnRfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItY29zdC1wcmV2aWV3XScgKSA6IG51bGw7XG5cdFx0XHRcdGlmICggY29zdF9idXR0b24gKSB7XG5cdFx0XHRcdFx0Y29zdF9idXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCBhY3RpdmVfY29udGVudF9yb290ICYmIGNhbl9wcmV2aWV3X2Nvc3QoKSApIHtcblx0XHRcdFx0YWN0aXZlX2NvbnRlbnRfcm9vdC5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLWNvc3Qtc3RhdGUnLCAnc3RhbGUnICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUXVldWUgb25lIGF1dG9tYXRpYyBub24tbXV0YXRpbmcgcHJldmlldyBhZnRlciB0aGUgY3VycmVudCBkcmFmdCBzZXR0bGVzLlxuXHRcdCAqXG5cdFx0ICogRGF0ZXMsIGNvbXBsZXRlZCB0aW1lcywgYW5kIEJvb2tpbmcgRm9ybSBjb250cm9scyBjYW4gZW1pdCBzZXZlcmFsIG5hdGl2ZVxuXHRcdCAqIGV2ZW50cyBmb3Igb25lIHVzZXIgYWN0aW9uLiBBIHNob3J0IGRlYm91bmNlIGF2b2lkcyByZWR1bmRhbnQgcHJpY2luZyByZWFkcy5cblx0XHQgKiBJZiBhbiBvbGRlciByZWFkIGlzIGFscmVhZHkgaW4gZmxpZ2h0LCBvbmUgdHJhaWxpbmcgcHJldmlldyB3YWl0cyBmb3IgaXQgdG9cblx0XHQgKiBzZXR0bGU7IGdlbmVyYXRpb24vcmV2aXNpb24gZ3VhcmRzIGlnbm9yZSB0aGF0IG9sZGVyIHJlc3BvbnNlIHdpdGhvdXRcblx0XHQgKiBwcm9kdWNpbmcgYSBicm93c2VyLWxldmVsIGFib3J0ZWQgcmVxdWVzdC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBkZWxheV9tcyBEZWJvdW5jZSBkZWxheSBpbiBtaWxsaXNlY29uZHMuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBxdWV1ZV9jb3N0X3ByZXZpZXcoIGRlbGF5X21zICkge1xuXHRcdFx0dmFyIHNjaGVkdWxlID0gc2NoZWR1bGVfd29ya2Zsb3cgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHNjaGVkdWxlX3dvcmtmbG93LmdldF9kcmFmdFxuXHRcdFx0XHQ/IHNjaGVkdWxlX3dvcmtmbG93LmdldF9kcmFmdCgpXG5cdFx0XHRcdDogbnVsbDtcblxuXHRcdFx0aWYgKCBjb3N0X3ByZXZpZXdfdGltZXIgKSB7XG5cdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIGNvc3RfcHJldmlld190aW1lciApO1xuXHRcdFx0XHRjb3N0X3ByZXZpZXdfdGltZXIgPSBudWxsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKFxuXHRcdFx0XHQhIGFjdGl2ZV9jb250ZW50X3Jvb3Rcblx0XHRcdFx0fHwgISBjYW5fcHJldmlld19jb3N0KClcblx0XHRcdFx0fHwgISBzY2hlZHVsZV9yZWFkeVxuXHRcdFx0XHR8fCBzY2hlZHVsZV9pbnB1dF9kaXJ0eVxuXHRcdFx0XHR8fCAhIHNjaGVkdWxlXG5cdFx0XHRcdHx8ICEgQXJyYXkuaXNBcnJheSggc2NoZWR1bGUuc2VsZWN0ZWRfZGF0ZXMgKVxuXHRcdFx0XHR8fCAhIHNjaGVkdWxlLnNlbGVjdGVkX2RhdGVzLmxlbmd0aFxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29zdF9wcmV2aWV3X3RpbWVyID0gd2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0Y29zdF9wcmV2aWV3X3RpbWVyID0gbnVsbDtcblx0XHRcdFx0cmVxdWVzdF9jb3N0X3ByZXZpZXcoKTtcblx0XHRcdH0sIE1hdGgubWF4KCAwLCBOdW1iZXIoIGRlbGF5X21zICkgfHwgMCApICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSW52YWxpZGF0ZSBhbnkgc2lnbmVkIHJldmlldyBhZnRlciB0aGUgbG9jYWwgZHJhZnQgY2hhbmdlcy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaW52YWxpZGF0ZV9yZXZpZXcoKSB7XG5cdFx0XHRyZXZpZXdfcmVxdWVzdF9nZW5lcmF0aW9uICs9IDE7XG5cdFx0XHRpZiAoIHBlbmRpbmdfcmV2aWV3X3JlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHBlbmRpbmdfcmV2aWV3X3JlcXVlc3QuYWJvcnQgKSB7XG5cdFx0XHRcdHBlbmRpbmdfcmV2aWV3X3JlcXVlc3QuYWJvcnQoKTtcblx0XHRcdH1cblx0XHRcdHBlbmRpbmdfcmV2aWV3X3JlcXVlc3QgPSBudWxsO1xuXHRcdFx0YWN0aXZlX3JldmlldyA9IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29uZmlybSByZXBsYWNlbWVudCBvciBjbG9zdXJlIG9mIG9uZSBsb2NhbGx5IGNoYW5nZWQgY3JlYXRpb24gZHJhZnQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gbm8gZHJhZnQgaXMgZGlydHkgb3IgZGlzY2FyZCB3YXMgY29uZmlybWVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNvbmZpcm1fZGlzY2FyZF9jaGFuZ2VzKCkge1xuXHRcdFx0aWYgKCAnYXBwbHlpbmcnID09PSBzdGF0ZSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnY3JlYXRlZCcgPT09IHN0YXRlICkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggISBpc19kaXJ0eSgpICkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuY29uZmlybVxuXHRcdFx0XHQmJiB3aW5kb3cuY29uZmlybSggaTE4bi5kaXNjYXJkX2NoYW5nZXMgfHwgJycgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBEaXNwYXRjaCBvbmUgZXhlY3V0YWJsZS1mcmVlIGNyZWF0aW9uIHJlYWRiYWNrIHJlcXVlc3QgdG8gdGhlIFRpbWVsaW5lLlxuXHRcdCAqXG5cdFx0ICogQXBwbHkgaGFzIGFscmVhZHkgcGVyc2lzdGVkIGFuZCBhdXRob3JpdGF0aXZlbHkgcmVhZCBiYWNrIHRoZSBib29raW5nLlxuXHRcdCAqIFRoaXMgbm90aWZpY2F0aW9uIGdyYW50cyBubyBtdXRhdGlvbiBhdXRob3JpdHk7IGl0IGFza3MgdGhlIGhvc3QgdG8gcmVsb2FkXG5cdFx0ICogaXRzIGN1cnJlbnQgd2luZG93IGFuZCByZWNvbmNpbGUgdGhlIGV4YWN0IGNyZWF0ZWQgYm9va2luZyBJRC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZXNwb25zZV9kYXRhIEFjY2VwdGVkIEFwcGx5IHJlc3BvbnNlIERUTy5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gYSBicm93c2VyIGV2ZW50IHdhcyBkaXNwYXRjaGVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlcXVlc3RfdGltZWxpbmVfcmVhZGJhY2soIHJlc3BvbnNlX2RhdGEgKSB7XG5cdFx0XHR2YXIgYm9va2luZyA9IHJlc3BvbnNlX2RhdGEgJiYgcmVzcG9uc2VfZGF0YS5ib29raW5nICYmICdvYmplY3QnID09PSB0eXBlb2YgcmVzcG9uc2VfZGF0YS5ib29raW5nXG5cdFx0XHRcdD8gcmVzcG9uc2VfZGF0YS5ib29raW5nXG5cdFx0XHRcdDoge307XG5cdFx0XHR2YXIgYm9va2luZ19pZCA9IE1hdGgubWF4KCAwLCBNYXRoLnJvdW5kKCBOdW1iZXIoIGJvb2tpbmcuYm9va2luZ19pZCApIHx8IDAgKSApO1xuXHRcdFx0dmFyIHJlc291cmNlX2lkID0gTWF0aC5tYXgoIDAsIE1hdGgucm91bmQoIE51bWJlciggYm9va2luZy5yZXNvdXJjZV9pZCApIHx8IDAgKSApO1xuXHRcdFx0dmFyIHNvdXJjZV9jb250ZXh0X3Rva2VuID0gU3RyaW5nKCBsYXN0X2xhdW5jaF9yZXF1ZXN0LnNvdXJjZV9jb250ZXh0X3Rva2VuIHx8ICcnICk7XG5cdFx0XHR2YXIgZXZlbnRfZGV0YWlsO1xuXHRcdFx0dmFyIGNyZWF0ZWRfZXZlbnQ7XG5cblx0XHRcdGlmICggISBib29raW5nX2lkIHx8ICEgcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHJlYWRiYWNrX3NlcXVlbmNlICs9IDE7XG5cdFx0XHRldmVudF9kZXRhaWwgPSB7XG5cdFx0XHRcdHNjaGVtYV92ZXJzaW9uOiBOdW1iZXIoIGNvbmZpZ3VyYXRpb24uc2NoZW1hX3ZlcnNpb24gKSB8fCAxLFxuXHRcdFx0XHRyZXF1ZXN0X2lkOiBTdHJpbmcoIHJlc3BvbnNlX2RhdGEucmVxdWVzdF9pZCB8fCAnY3JlYXRlZCcgKSArICctdGltZWxpbmUtJyArIFN0cmluZyggcmVhZGJhY2tfc2VxdWVuY2UgKSxcblx0XHRcdFx0YXBwbHlfcmVxdWVzdF9pZDogU3RyaW5nKCByZXNwb25zZV9kYXRhLnJlcXVlc3RfaWQgfHwgJycgKSxcblx0XHRcdFx0Ym9va2luZ19pZDogYm9va2luZ19pZCxcblx0XHRcdFx0cmVzb3VyY2VfaWQ6IHJlc291cmNlX2lkLFxuXHRcdFx0XHRzb3VyY2VfY29udGV4dF90b2tlbjogc291cmNlX2NvbnRleHRfdG9rZW4sXG5cdFx0XHRcdGhhbmRvZmZfcXVlcnlfYXJnOiBTdHJpbmcoIGNvbmZpZ3VyYXRpb24uaGFuZG9mZl9xdWVyeV9hcmcgfHwgJycgKSxcblx0XHRcdFx0b3Blbl9ib29raW5nX2luc3BlY3RvcjogdHJ1ZSA9PT0gY29uZmlndXJhdGlvbi5vcGVuX2NyZWF0ZWRfYm9va2luZ19pbnNwZWN0b3Jcblx0XHRcdH07XG5cdFx0XHRwZW5kaW5nX2NyZWF0ZWRfcmVhZGJhY2sgPSB7XG5cdFx0XHRcdHJlcXVlc3RfaWQ6IGV2ZW50X2RldGFpbC5yZXF1ZXN0X2lkLFxuXHRcdFx0XHRyZXNwb25zZTogcmVzcG9uc2VfZGF0YVxuXHRcdFx0fTtcblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5DdXN0b21FdmVudCApIHtcblx0XHRcdFx0Y3JlYXRlZF9ldmVudCA9IG5ldyB3aW5kb3cuQ3VzdG9tRXZlbnQoIGNyZWF0ZWRfZXZlbnRfbmFtZSwgeyBkZXRhaWw6IGV2ZW50X2RldGFpbCB9ICk7XG5cdFx0XHR9IGVsc2UgaWYgKCBkb2N1bWVudC5jcmVhdGVFdmVudCApIHtcblx0XHRcdFx0Y3JlYXRlZF9ldmVudCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCAnQ3VzdG9tRXZlbnQnICk7XG5cdFx0XHRcdGNyZWF0ZWRfZXZlbnQuaW5pdEN1c3RvbUV2ZW50KCBjcmVhdGVkX2V2ZW50X25hbWUsIGZhbHNlLCBmYWxzZSwgZXZlbnRfZGV0YWlsICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgY3JlYXRlZF9ldmVudCApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0dGltZWxpbmVfZXZlbnRfcm9vdC5kaXNwYXRjaEV2ZW50KCBjcmVhdGVkX2V2ZW50ICk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFzayBUaW1lbGluZSB0byBmb2N1cyB0aGUgYXV0aG9yaXRhdGl2ZSBjcmVhdGVkIGNhcmQgYWZ0ZXIgc2hlbGwgY2xvc3VyZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBib29raW5nX2lkIFBvc2l0aXZlIGF1dGhvcml0YXRpdmUgYm9va2luZyBJRC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlcXVlc3RfY3JlYXRlZF9ib29raW5nX2ZvY3VzKCBib29raW5nX2lkICkge1xuXHRcdFx0dmFyIGZvY3VzX2V2ZW50O1xuXG5cdFx0XHRib29raW5nX2lkID0gTWF0aC5tYXgoIDAsIE1hdGgucm91bmQoIE51bWJlciggYm9va2luZ19pZCApIHx8IDAgKSApO1xuXHRcdFx0aWYgKCAhIGJvb2tpbmdfaWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5DdXN0b21FdmVudCApIHtcblx0XHRcdFx0Zm9jdXNfZXZlbnQgPSBuZXcgd2luZG93LkN1c3RvbUV2ZW50KCBmb2N1c19jcmVhdGVkX2V2ZW50X25hbWUsIHtcblx0XHRcdFx0XHRkZXRhaWw6IHsgc2NoZW1hX3ZlcnNpb246IDEsIGJvb2tpbmdfaWQ6IGJvb2tpbmdfaWQgfVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9IGVsc2UgaWYgKCBkb2N1bWVudC5jcmVhdGVFdmVudCApIHtcblx0XHRcdFx0Zm9jdXNfZXZlbnQgPSBkb2N1bWVudC5jcmVhdGVFdmVudCggJ0N1c3RvbUV2ZW50JyApO1xuXHRcdFx0XHRmb2N1c19ldmVudC5pbml0Q3VzdG9tRXZlbnQoIGZvY3VzX2NyZWF0ZWRfZXZlbnRfbmFtZSwgZmFsc2UsIGZhbHNlLCB7IHNjaGVtYV92ZXJzaW9uOiAxLCBib29raW5nX2lkOiBib29raW5nX2lkIH0gKTtcblx0XHRcdH1cblx0XHRcdGlmICggZm9jdXNfZXZlbnQgKSB7XG5cdFx0XHRcdHRpbWVsaW5lX2V2ZW50X3Jvb3QuZGlzcGF0Y2hFdmVudCggZm9jdXNfZXZlbnQgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWNvbmNpbGUgdGhlIGNyZWF0aW9uIEluc3BlY3RvciBhZnRlciBUaW1lbGluZSdzIGhvc3Qtb3duZWQgcmVhZGJhY2suXG5cdFx0ICpcblx0XHQgKiBBIGZhaWxlZCBob3N0IHJlZnJlc2ggaXMgYSBwZXJzaXN0ZWQtc3VjY2VzcyB3YXJuaW5nLCBuZXZlciBhbiBBcHBseVxuXHRcdCAqIGZhaWx1cmUuIFJldHJ5IHJlcXVlc3RzIG9ubHkgcmVsb2FkIFRpbWVsaW5lIGFuZCBjYW5ub3QgY3JlYXRlIGEgZHVwbGljYXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtDdXN0b21FdmVudH0gZXZlbnQgVGltZWxpbmUgcmVhZGJhY2sgY29tcGxldGlvbiBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV90aW1lbGluZV9yZWFkYmFjayggZXZlbnQgKSB7XG5cdFx0XHR2YXIgZGV0YWlsID0gZXZlbnQgJiYgZXZlbnQuZGV0YWlsICYmICdvYmplY3QnID09PSB0eXBlb2YgZXZlbnQuZGV0YWlsID8gZXZlbnQuZGV0YWlsIDoge307XG5cdFx0XHR2YXIgc3RhdHVzID0gc2hhcmVkX2NvbnRlbnRfcm9vdFxuXHRcdFx0XHQ/IHNoYXJlZF9jb250ZW50X3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLXJlYWRiYWNrLXN0YXR1c10nIClcblx0XHRcdFx0OiBudWxsO1xuXHRcdFx0dmFyIHJldHJ5ID0gc2hhcmVkX2NvbnRlbnRfcm9vdFxuXHRcdFx0XHQ/IHNoYXJlZF9jb250ZW50X3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLXJlYWRiYWNrLXJldHJ5XScgKVxuXHRcdFx0XHQ6IG51bGw7XG5cblx0XHRcdGlmIChcblx0XHRcdFx0J2NyZWF0ZWQnICE9PSBzdGF0ZVxuXHRcdFx0XHR8fCAhIHBlbmRpbmdfY3JlYXRlZF9yZWFkYmFja1xuXHRcdFx0XHR8fCAxICE9PSBOdW1iZXIoIGRldGFpbC5zY2hlbWFfdmVyc2lvbiApXG5cdFx0XHRcdHx8IGNyZWF0ZWRfYm9va2luZ19pZCAhPT0gTWF0aC5tYXgoIDAsIE1hdGgucm91bmQoIE51bWJlciggZGV0YWlsLmJvb2tpbmdfaWQgKSB8fCAwICkgKVxuXHRcdFx0XHR8fCBTdHJpbmcoIGRldGFpbC5yZXF1ZXN0X2lkIHx8ICcnICkgIT09IHBlbmRpbmdfY3JlYXRlZF9yZWFkYmFjay5yZXF1ZXN0X2lkXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnYWNjZXB0ZWQnID09PSBkZXRhaWwuc3RhdGUgKSB7XG5cdFx0XHRcdHBlbmRpbmdfY3JlYXRlZF9yZWFkYmFjayA9IG51bGw7XG5cdFx0XHRcdGlmICggc3RhdHVzICkge1xuXHRcdFx0XHRcdHN0YXR1cy5yZW1vdmVBdHRyaWJ1dGUoICdyb2xlJyApO1xuXHRcdFx0XHRcdHN0YXR1cy50ZXh0Q29udGVudCA9IHRydWUgPT09IGRldGFpbC5ib29raW5nX3Zpc2libGVcblx0XHRcdFx0XHRcdD8gaTE4bi50aW1lbGluZV9yZWZyZXNoZWQgfHwgJydcblx0XHRcdFx0XHRcdDogaTE4bi50aW1lbGluZV9yZWNvcmRfbm90X3Zpc2libGUgfHwgJyc7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCByZXRyeSApIHtcblx0XHRcdFx0XHRyZXRyeS5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNoYXJlZF9pbnNwZWN0b3IuY2xvc2UoIGZhbHNlICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggJ2ZhaWxlZCcgIT09IGRldGFpbC5zdGF0ZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzdGF0dXMgKSB7XG5cdFx0XHRcdHN0YXR1cy5zZXRBdHRyaWJ1dGUoICdyb2xlJywgJ2FsZXJ0JyApO1xuXHRcdFx0XHRzdGF0dXMudGV4dENvbnRlbnQgPSBpMThuLnRpbWVsaW5lX3JlZnJlc2hfZmFpbGVkIHx8ICcnO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCByZXRyeSApIHtcblx0XHRcdFx0cmV0cnkuaGlkZGVuID0gZmFsc2U7XG5cdFx0XHRcdHJldHJ5LmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQnVpbGQgYSBib3VuZGVkIGJyb3dzZXIgY29ycmVsYXRpb24gaWRlbnRpZmllci5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gUmVxdWVzdCBJRCBhY2NlcHRlZCBieSB0aGUgc2VydmVyIGNvbnRyYWN0LlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNyZWF0ZV9yZXF1ZXN0X2lkKCkge1xuXHRcdFx0cmVxdWVzdF9zZXF1ZW5jZSArPSAxO1xuXG5cdFx0XHRyZXR1cm4gJ3RpbWVsaW5lLWxhdW5jaC0nICsgRGF0ZS5ub3coKS50b1N0cmluZyggMzYgKSArICctJyArIHJlcXVlc3Rfc2VxdWVuY2UudG9TdHJpbmcoIDM2ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVuZGVyIG9uZSBkb21haW4tb3duZWQgbG9hZGluZywgZW1wdHksIG9yIGVycm9yIHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9ICBzdGF0ZV9pZCBTdGFibGUgc3RhdGUgaWRlbnRpZmllci5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gIHRpdGxlICAgIExvY2FsaXplZCBzdGF0ZSB0aXRsZS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gIG1lc3NhZ2UgIExvY2FsaXplZCBzYWZlIHN0YXRlIG1lc3NhZ2UuXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSByZXRyeSAgICBXaGV0aGVyIGEgcmVhZC1vbmx5IHJldHJ5IGlzIGF2YWlsYWJsZS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9zdGF0ZSggc3RhdGVfaWQsIHRpdGxlLCBtZXNzYWdlLCByZXRyeSApIHtcblx0XHRcdHNoYXJlZF9pbnNwZWN0b3Iuc2V0X3N0YXRlKCBzdGF0ZV90ZW1wbGF0ZSgge1xuXHRcdFx0XHRzdGF0ZTogc3RhdGVfaWQsXG5cdFx0XHRcdHRpdGxlOiB0aXRsZSxcblx0XHRcdFx0bWVzc2FnZTogbWVzc2FnZSxcblx0XHRcdFx0cmV0cnk6IEJvb2xlYW4oIHJldHJ5ICksXG5cdFx0XHRcdHVybDogJ2xvYWRpbmcnID09PSBzdGF0ZV9pZCA/ICcnIDogYWN0aXZlX2ZhbGxiYWNrX3VybCxcblx0XHRcdFx0aTE4bjogaTE4blxuXHRcdFx0fSApLCBtZXNzYWdlLCAnbG9hZGluZycgPT09IHN0YXRlX2lkICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVzb2x2ZSB0aGUgcmVuZGVyZWQgbm9kZXMgZm9yIG9uZSBleGFjdCBzZXJ2ZXItYXV0aG9yaXplZCBmaWVsZCBrZXkuXG5cdFx0ICpcblx0XHQgKiBBdHRyaWJ1dGUgdmFsdWVzIGFyZSBjb21wYXJlZCBhcyBzdHJpbmdzIGluc3RlYWQgb2YgaW50ZXJwb2xhdGVkIGludG8gYVxuXHRcdCAqIHNlbGVjdG9yLCBzbyBhIG1hbGZvcm1lZCByZXNwb25zZSBjYW5ub3QgYmVjb21lIGV4ZWN1dGFibGUgc2VsZWN0b3IgdGV4dC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBmaWVsZF9rZXkgRXhhY3QgZmllbGQga2V5IHJldHVybmVkIGJ5IHNlcnZlciB2YWxpZGF0aW9uLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gTWF0Y2hpbmcgZmllbGQgcm93LCBjb250cm9scywgZmllbGRzZXQsIGFuZCBlcnJvciBub2RlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9maWVsZF9mZWVkYmFja19ub2RlcyggZmllbGRfa2V5ICkge1xuXHRcdFx0dmFyIGZlZWRiYWNrID0geyBmaWVsZDogbnVsbCwgY29udHJvbHM6IFtdLCBmaWVsZHNldDogbnVsbCwgZXJyb3I6IG51bGwgfTtcblxuXHRcdFx0ZmllbGRfa2V5ID0gU3RyaW5nKCBmaWVsZF9rZXkgfHwgJycgKTtcblx0XHRcdGlmICggISBhY3RpdmVfY29udGVudF9yb290IHx8ICEgZmllbGRfa2V5ICkge1xuXHRcdFx0XHRyZXR1cm4gZmVlZGJhY2s7XG5cdFx0XHR9XG5cdFx0XHRBcnJheS5wcm90b3R5cGUuc29tZS5jYWxsKCBhY3RpdmVfY29udGVudF9yb290LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1maWVsZF0nICksIGZ1bmN0aW9uICggZmllbGQgKSB7XG5cdFx0XHRcdGlmICggZmllbGRfa2V5ICE9PSBTdHJpbmcoIGZpZWxkLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItZmllbGQnICkgfHwgJycgKSApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZmVlZGJhY2suZmllbGQgPSBmaWVsZDtcblx0XHRcdFx0ZmVlZGJhY2suY29udHJvbHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggZmllbGQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLWZpZWxkLWlucHV0XScgKSApO1xuXHRcdFx0XHRmZWVkYmFjay5maWVsZHNldCA9IGZpZWxkLnF1ZXJ5U2VsZWN0b3IoICdmaWVsZHNldCcgKTtcblx0XHRcdFx0ZmVlZGJhY2suZXJyb3IgPSBmaWVsZC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItZmllbGQtZXJyb3JdJyApO1xuXG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gZmVlZGJhY2s7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2xlYXIgb25lIHJlbmRlcmVkIHZhbGlkYXRpb24gZXJyb3IgYWZ0ZXIgdGhlIGV4YWN0IGZpZWxkIGNoYW5nZXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZmllbGRfa2V5IEV4YWN0IHJlbmRlcmVkIGZpZWxkIGtleS5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdmlzaWJsZSBmZWVkYmFjayB3YXMgY2xlYXJlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjbGVhcl9maWVsZF9lcnJvciggZmllbGRfa2V5ICkge1xuXHRcdFx0dmFyIGZlZWRiYWNrID0gZ2V0X2ZpZWxkX2ZlZWRiYWNrX25vZGVzKCBmaWVsZF9rZXkgKTtcblx0XHRcdHZhciBoYWRfZXJyb3IgPSBCb29sZWFuKCBmZWVkYmFjay5lcnJvciAmJiAhIGZlZWRiYWNrLmVycm9yLmhpZGRlbiApO1xuXG5cdFx0XHRmZWVkYmFjay5jb250cm9scy5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHRcdGNvbnRyb2wucmVtb3ZlQXR0cmlidXRlKCAnYXJpYS1pbnZhbGlkJyApO1xuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCBmZWVkYmFjay5maWVsZHNldCApIHtcblx0XHRcdFx0ZmVlZGJhY2suZmllbGRzZXQucmVtb3ZlQXR0cmlidXRlKCAnYXJpYS1pbnZhbGlkJyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBmZWVkYmFjay5maWVsZCApIHtcblx0XHRcdFx0ZmVlZGJhY2suZmllbGQuY2xhc3NMaXN0LnJlbW92ZSggJ2hhcy1lcnJvcicgKTtcblx0XHRcdH1cblx0XHRcdGlmICggZmVlZGJhY2suZXJyb3IgKSB7XG5cdFx0XHRcdGZlZWRiYWNrLmVycm9yLnRleHRDb250ZW50ID0gJyc7XG5cdFx0XHRcdGZlZWRiYWNrLmVycm9yLmhpZGRlbiA9IHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBoYWRfZXJyb3I7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2xlYXIgYWxsIFJldmlldyB2YWxpZGF0aW9uIGZlZWRiYWNrIGJlZm9yZSBhIG5ldyBhdXRob3JpdGF0aXZlIHJlcXVlc3QuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNsZWFyX3Jldmlld19lcnJvcnMoKSB7XG5cdFx0XHR2YXIgcmV2aWV3X2Vycm9yID0gYWN0aXZlX2NvbnRlbnRfcm9vdFxuXHRcdFx0XHQ/IGFjdGl2ZV9jb250ZW50X3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLXJldmlldy1lcnJvcl0nIClcblx0XHRcdFx0OiBudWxsO1xuXG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBhY3RpdmVfY29udGVudF9yb290ID8gYWN0aXZlX2NvbnRlbnRfcm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItZmllbGQtZXJyb3JdJyApIDogW10sIGZ1bmN0aW9uICggZXJyb3Jfbm9kZSApIHtcblx0XHRcdFx0Y2xlYXJfZmllbGRfZXJyb3IoIGVycm9yX25vZGUuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1maWVsZC1lcnJvcicgKSApO1xuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCByZXZpZXdfZXJyb3IgKSB7XG5cdFx0XHRcdHJldmlld19lcnJvci5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0XHRpZiAoIHJldmlld19lcnJvci5xdWVyeVNlbGVjdG9yKCAncCcgKSApIHtcblx0XHRcdFx0XHRyZXZpZXdfZXJyb3IucXVlcnlTZWxlY3RvciggJ3AnICkudGV4dENvbnRlbnQgPSAnJztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENsZWFyIGZlZWRiYWNrIGZvciB0aGUgY3VzdG9tZXIgY29udHJvbCBjdXJyZW50bHkgYmVpbmcgY29ycmVjdGVkLlxuXHRcdCAqXG5cdFx0ICogVGhlIHN1bW1hcnkgcmVtYWlucyB2aXNpYmxlIHdoaWxlIGFueSBvdGhlciByZWplY3RlZCBmaWVsZCBpcyB1bnJlc29sdmVkLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFbGVtZW50fG51bGx9IGNvbnRyb2wgQ2hhbmdlZCBjdXN0b21lciBjb250cm9sLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2xlYXJfY29udHJvbF9lcnJvciggY29udHJvbCApIHtcblx0XHRcdHZhciBmaWVsZF9rZXk7XG5cdFx0XHR2YXIgcmV2aWV3X2Vycm9yO1xuXG5cdFx0XHRpZiAoICEgY29udHJvbCB8fCAhIGFjdGl2ZV9jb250ZW50X3Jvb3QgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGZpZWxkX2tleSA9IFN0cmluZyggY29udHJvbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLWZpZWxkLWlucHV0JyApIHx8ICcnICk7XG5cdFx0XHRpZiAoICEgY2xlYXJfZmllbGRfZXJyb3IoIGZpZWxkX2tleSApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoXG5cdFx0XHRcdGFjdGl2ZV9jb250ZW50X3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLWZpZWxkLWVycm9yXTpub3QoW2hpZGRlbl0pJyApXG5cdFx0XHRcdHx8IGFjdGl2ZV9jb250ZW50X3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLXNjaGVkdWxlLWVycm9yXTpub3QoW2hpZGRlbl0pJyApXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cmV2aWV3X2Vycm9yID0gYWN0aXZlX2NvbnRlbnRfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItcmV2aWV3LWVycm9yXScgKTtcblx0XHRcdGlmICggcmV2aWV3X2Vycm9yICkge1xuXHRcdFx0XHRyZXZpZXdfZXJyb3IuaGlkZGVuID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgYm91bmRlZCBzZXJ2ZXIgZmllbGQgZXJyb3JzIGFuZCBmb2N1cyB0aGUgZmlyc3QgcmVqZWN0ZWQgY29udHJvbC5cblx0XHQgKlxuXHRcdCAqIFVua25vd24ga2V5cyByZW1haW4gY292ZXJlZCBieSB0aGUgc2FmZSBzdW1tYXJ5IGFuZCBhcmUgbmV2ZXIgcmVuZGVyZWQgYXNcblx0XHQgKiBzZWxlY3RvcnMgb3IgbWFya3VwLiBFeGFjdCBtZXNzYWdlcyBhcmUgYXNzaWduZWQgd2l0aCB0ZXh0Q29udGVudCBvbmx5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R8bnVsbH0gIGVycm9yX2RhdGEgICAgICBOb3JtYWxpemVkIHNlcnZlciBvciBsb2NhbCByZWFkaW5lc3MgZXJyb3IgcmVzcG9uc2UuXG5cdFx0ICogQHBhcmFtIHtFbGVtZW50fG51bGx9IGZhbGxiYWNrX3RhcmdldCBPcHRpb25hbCBzYWZlIHJlbmRlcmVkIHRhcmdldCB3aGVuIG5vIGZpZWxkIG1hdGNoZXMuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGF0IGxlYXN0IG9uZSBleGFjdCByZW5kZXJlZCBmaWVsZCB3YXMgcmVqZWN0ZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX3Jldmlld19lcnJvcnMoIGVycm9yX2RhdGEsIGZhbGxiYWNrX3RhcmdldCApIHtcblx0XHRcdHZhciBmaWVsZF9lcnJvcnMgPSBlcnJvcl9kYXRhICYmIEFycmF5LmlzQXJyYXkoIGVycm9yX2RhdGEuZmllbGRfZXJyb3JzICkgPyBlcnJvcl9kYXRhLmZpZWxkX2Vycm9ycyA6IFtdO1xuXHRcdFx0dmFyIHJldmlld19lcnJvciA9IGFjdGl2ZV9jb250ZW50X3Jvb3Rcblx0XHRcdFx0PyBhY3RpdmVfY29udGVudF9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1yZXZpZXctZXJyb3JdJyApXG5cdFx0XHRcdDogbnVsbDtcblx0XHRcdHZhciBmaXJzdF9jb250cm9sID0gbnVsbDtcblx0XHRcdHZhciBmaXJzdF9maWVsZCA9IG51bGw7XG5cdFx0XHR2YXIgc2Vlbl9maWVsZHMgPSB7fTtcblx0XHRcdHZhciBtYXRjaGVkX2Vycm9yID0gZmFsc2U7XG5cblx0XHRcdGNsZWFyX3Jldmlld19lcnJvcnMoKTtcblx0XHRcdGlmICggcmV2aWV3X2Vycm9yICkge1xuXHRcdFx0XHRyZXZpZXdfZXJyb3IuaGlkZGVuID0gZmFsc2U7XG5cdFx0XHRcdGlmICggcmV2aWV3X2Vycm9yLnF1ZXJ5U2VsZWN0b3IoICdwJyApICkge1xuXHRcdFx0XHRcdHJldmlld19lcnJvci5xdWVyeVNlbGVjdG9yKCAncCcgKS50ZXh0Q29udGVudCA9IFN0cmluZyggZXJyb3JfZGF0YSAmJiBlcnJvcl9kYXRhLm1lc3NhZ2UgPyBlcnJvcl9kYXRhLm1lc3NhZ2UgOiBpMThuLnJldmlld19mYWlsZWQgfHwgJycgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZmllbGRfZXJyb3JzLmZvckVhY2goIGZ1bmN0aW9uICggZmllbGRfZXJyb3IgKSB7XG5cdFx0XHRcdHZhciBmaWVsZF9rZXkgPSBmaWVsZF9lcnJvciAmJiBmaWVsZF9lcnJvci5rZXkgPyBTdHJpbmcoIGZpZWxkX2Vycm9yLmtleSApIDogJyc7XG5cdFx0XHRcdHZhciBtZXNzYWdlID0gZmllbGRfZXJyb3IgJiYgZmllbGRfZXJyb3IubWVzc2FnZSA/IFN0cmluZyggZmllbGRfZXJyb3IubWVzc2FnZSApIDogJyc7XG5cdFx0XHRcdHZhciBmZWVkYmFjaztcblxuXHRcdFx0XHRpZiAoICEgZmllbGRfa2V5IHx8ICEgbWVzc2FnZSB8fCBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIHNlZW5fZmllbGRzLCBmaWVsZF9rZXkgKSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0c2Vlbl9maWVsZHNbIGZpZWxkX2tleSBdID0gdHJ1ZTtcblx0XHRcdFx0ZmVlZGJhY2sgPSBnZXRfZmllbGRfZmVlZGJhY2tfbm9kZXMoIGZpZWxkX2tleSApO1xuXHRcdFx0XHRpZiAoICEgZmVlZGJhY2suZmllbGQgfHwgISBmZWVkYmFjay5lcnJvciApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0bWF0Y2hlZF9lcnJvciA9IHRydWU7XG5cdFx0XHRcdGZlZWRiYWNrLmZpZWxkLmNsYXNzTGlzdC5hZGQoICdoYXMtZXJyb3InICk7XG5cdFx0XHRcdGZlZWRiYWNrLmVycm9yLnRleHRDb250ZW50ID0gbWVzc2FnZTtcblx0XHRcdFx0ZmVlZGJhY2suZXJyb3IuaGlkZGVuID0gZmFsc2U7XG5cdFx0XHRcdGZlZWRiYWNrLmNvbnRyb2xzLmZvckVhY2goIGZ1bmN0aW9uICggY29udHJvbCApIHtcblx0XHRcdFx0XHRjb250cm9sLnNldEF0dHJpYnV0ZSggJ2FyaWEtaW52YWxpZCcsICd0cnVlJyApO1xuXHRcdFx0XHRcdGlmICggISBmaXJzdF9jb250cm9sICYmICEgY29udHJvbC5kaXNhYmxlZCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29udHJvbC5mb2N1cyApIHtcblx0XHRcdFx0XHRcdGZpcnN0X2NvbnRyb2wgPSBjb250cm9sO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXHRcdFx0XHRpZiAoIGZlZWRiYWNrLmZpZWxkc2V0ICkge1xuXHRcdFx0XHRcdGZlZWRiYWNrLmZpZWxkc2V0LnNldEF0dHJpYnV0ZSggJ2FyaWEtaW52YWxpZCcsICd0cnVlJyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZpcnN0X2ZpZWxkID0gZmlyc3RfZmllbGQgfHwgZmVlZGJhY2suZmllbGQ7XG5cdFx0XHR9ICk7XG5cblx0XHRcdCggd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSB8fCBmdW5jdGlvbiAoIGNhbGxiYWNrICkge1xuXHRcdFx0XHR3aW5kb3cuc2V0VGltZW91dCggY2FsbGJhY2ssIDAgKTtcblx0XHRcdH0gKSggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHR2YXIgc2Nyb2xsX3RhcmdldCA9IGZpcnN0X2ZpZWxkIHx8IGZhbGxiYWNrX3RhcmdldCB8fCByZXZpZXdfZXJyb3I7XG5cdFx0XHRcdHZhciBmb2N1c190YXJnZXQgPSBmaXJzdF9jb250cm9sIHx8IGZhbGxiYWNrX3RhcmdldCB8fCByZXZpZXdfZXJyb3I7XG5cdFx0XHRcdHZhciByZWR1Y2VkX21vdGlvbiA9IHdpbmRvdy5tYXRjaE1lZGlhICYmIHdpbmRvdy5tYXRjaE1lZGlhKCAnKHByZWZlcnMtcmVkdWNlZC1tb3Rpb246IHJlZHVjZSknICkubWF0Y2hlcztcblxuXHRcdFx0XHRpZiAoIHNjcm9sbF90YXJnZXQgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHNjcm9sbF90YXJnZXQuc2Nyb2xsSW50b1ZpZXcgKSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdHNjcm9sbF90YXJnZXQuc2Nyb2xsSW50b1ZpZXcoIHsgYmVoYXZpb3I6IHJlZHVjZWRfbW90aW9uID8gJ2F1dG8nIDogJ3Ntb290aCcsIGJsb2NrOiAnY2VudGVyJyB9ICk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoIHNjcm9sbF9lcnJvciApIHtcblx0XHRcdFx0XHRcdHNjcm9sbF90YXJnZXQuc2Nyb2xsSW50b1ZpZXcoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBmb2N1c190YXJnZXQgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGZvY3VzX3RhcmdldC5mb2N1cyApIHtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0Zm9jdXNfdGFyZ2V0LmZvY3VzKCB7IHByZXZlbnRTY3JvbGw6IHRydWUgfSApO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKCBmb2N1c19lcnJvciApIHtcblx0XHRcdFx0XHRcdGZvY3VzX3RhcmdldC5mb2N1cygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gbWF0Y2hlZF9lcnJvcjtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBCdWlsZCBwcmVzZW50YXRpb24tb25seSBlcnJvcnMgZm9yIGVtcHR5IHJlcXVpcmVkIGNvbnRyb2xzLlxuXHRcdCAqXG5cdFx0ICogVGhpcyBwcmVmbGlnaHQgaXMgdXNlZCBvbmx5IHdoZW4gYW4gaW5jb21wbGV0ZSBzY2hlZHVsZSBwcmV2ZW50cyB0aGVcblx0XHQgKiBhdXRob3JpdGF0aXZlIFJldmlldyByZXF1ZXN0IGZyb20gYmVpbmcgY29uc3RydWN0ZWQuIEV2ZXJ5IHJlcXVlc3QgdGhhdFxuXHRcdCAqIHJlYWNoZXMgdGhlIHNlcnZlciBzdGlsbCByZXJ1bnMgdGhlIGNvbXBsZXRlIGV4YWN0LWZvcm0gdmFsaWRhdG9yLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7QXJyYXk8T2JqZWN0Pn0gT3JkZXJlZCBleGFjdCBmaWVsZC1lcnJvciBEVE9zIGZvciBlbXB0eSByZXF1aXJlZCBjb250cm9scy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfbWlzc2luZ19yZXF1aXJlZF9maWVsZF9lcnJvcnMoKSB7XG5cdFx0XHR2YXIgZmllbGRfc25hcHNob3RzID0gZ2V0X2N1c3RvbWVyX2ZpZWxkX3NuYXBzaG90KCBhY3RpdmVfY29udGVudF9yb290ICk7XG5cdFx0XHR2YXIgdmFsdWVzX2J5X2tleSA9IHt9O1xuXHRcdFx0dmFyIGF1dGhvcml6ZWRfZmllbGRzID0gYWN0aXZlX2Jvb3RzdHJhcCAmJiBBcnJheS5pc0FycmF5KCBhY3RpdmVfYm9vdHN0cmFwLmZpZWxkcyApID8gYWN0aXZlX2Jvb3RzdHJhcC5maWVsZHMgOiBbXTtcblx0XHRcdHZhciBmaWVsZF9lcnJvcnMgPSBbXTtcblxuXHRcdFx0ZmllbGRfc25hcHNob3RzLmZvckVhY2goIGZ1bmN0aW9uICggZmllbGRfc25hcHNob3QgKSB7XG5cdFx0XHRcdHZhbHVlc19ieV9rZXlbIFN0cmluZyggZmllbGRfc25hcHNob3Qua2V5IHx8ICcnICkgXSA9IEFycmF5LmlzQXJyYXkoIGZpZWxkX3NuYXBzaG90LnZhbHVlcyApID8gZmllbGRfc25hcHNob3QudmFsdWVzIDogW107XG5cdFx0XHR9ICk7XG5cdFx0XHRhdXRob3JpemVkX2ZpZWxkcy5mb3JFYWNoKCBmdW5jdGlvbiAoIGZpZWxkX2NvbnRyYWN0ICkge1xuXHRcdFx0XHR2YXIgZmllbGRfa2V5ID0gZmllbGRfY29udHJhY3QgJiYgZmllbGRfY29udHJhY3Qua2V5ID8gU3RyaW5nKCBmaWVsZF9jb250cmFjdC5rZXkgKSA6ICcnO1xuXHRcdFx0XHR2YXIgZmllbGRfdmFsdWVzID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCB2YWx1ZXNfYnlfa2V5LCBmaWVsZF9rZXkgKSA/IHZhbHVlc19ieV9rZXlbIGZpZWxkX2tleSBdIDogW107XG5cdFx0XHRcdHZhciBoYXNfdmFsdWUgPSBmaWVsZF92YWx1ZXMuc29tZSggZnVuY3Rpb24gKCBmaWVsZF92YWx1ZSApIHtcblx0XHRcdFx0XHRyZXR1cm4gJycgIT09IFN0cmluZyggZmllbGRfdmFsdWUgfHwgJycgKS50cmltKCk7XG5cdFx0XHRcdH0gKTtcblxuXHRcdFx0XHRpZiAoICEgZmllbGRfa2V5IHx8IHRydWUgIT09IGZpZWxkX2NvbnRyYWN0LnJlcXVpcmVkIHx8IGhhc192YWx1ZSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0ZmllbGRfZXJyb3JzLnB1c2goIHtcblx0XHRcdFx0XHRrZXk6IGZpZWxkX2tleSxcblx0XHRcdFx0XHRjb2RlOiAncmVxdWlyZWQnLFxuXHRcdFx0XHRcdG1lc3NhZ2U6IGkxOG4uZmllbGRfcmVxdWlyZWQgfHwgJydcblx0XHRcdFx0fSApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gZmllbGRfZXJyb3JzO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEV4cGxhaW4gd2h5IFJldmlldyBjYW5ub3QgeWV0IGNvbnN0cnVjdCBpdHMgYXV0aG9yaXRhdGl2ZSByZXF1ZXN0LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZW5kZXJfcmV2aWV3X3JlYWRpbmVzc19lcnJvcnMoKSB7XG5cdFx0XHR2YXIgc2NoZWR1bGUgPSBzY2hlZHVsZV93b3JrZmxvdyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc2NoZWR1bGVfd29ya2Zsb3cuZ2V0X2RyYWZ0ID8gc2NoZWR1bGVfd29ya2Zsb3cuZ2V0X2RyYWZ0KCkgOiBudWxsO1xuXHRcdFx0dmFyIGhhc19zZWxlY3RlZF9kYXRlcyA9IEJvb2xlYW4oIHNjaGVkdWxlICYmIEFycmF5LmlzQXJyYXkoIHNjaGVkdWxlLnNlbGVjdGVkX2RhdGVzICkgJiYgc2NoZWR1bGUuc2VsZWN0ZWRfZGF0ZXMubGVuZ3RoICk7XG5cdFx0XHR2YXIgZmllbGRfZXJyb3JzID0gZ2V0X21pc3NpbmdfcmVxdWlyZWRfZmllbGRfZXJyb3JzKCk7XG5cdFx0XHR2YXIgc2NoZWR1bGVfbWVzc2FnZSA9IGhhc19zZWxlY3RlZF9kYXRlcyA/IGkxOG4uc2NoZWR1bGVfbm90X3JlYWR5IHx8ICcnIDogaTE4bi5zY2hlZHVsZV9yZXF1aXJlZCB8fCAnJztcblx0XHRcdHZhciByZXZpZXdfbWVzc2FnZSA9ICEgaGFzX3NlbGVjdGVkX2RhdGVzICYmIGZpZWxkX2Vycm9ycy5sZW5ndGggPyBpMThuLnJldmlld19pbmNvbXBsZXRlIHx8ICcnIDogc2NoZWR1bGVfbWVzc2FnZTtcblx0XHRcdHZhciBzY2hlZHVsZV9lcnJvcjtcblxuXHRcdFx0c2V0X3NjaGVkdWxlX2Vycm9yKCB0cnVlLCBzY2hlZHVsZV9tZXNzYWdlICk7XG5cdFx0XHRzY2hlZHVsZV9lcnJvciA9IGFjdGl2ZV9jb250ZW50X3Jvb3Rcblx0XHRcdFx0PyBhY3RpdmVfY29udGVudF9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1zY2hlZHVsZS1lcnJvcl0nIClcblx0XHRcdFx0OiBudWxsO1xuXHRcdFx0cmVuZGVyX3Jldmlld19lcnJvcnMoIHtcblx0XHRcdFx0bWVzc2FnZTogcmV2aWV3X21lc3NhZ2UsXG5cdFx0XHRcdGZpZWxkX2Vycm9yczogZmllbGRfZXJyb3JzXG5cdFx0XHR9LCBzY2hlZHVsZV9lcnJvciApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN5bmNocm9uaXplIHNjaGVkdWxlIGNvbnRyb2xzIGFuZCBzZWxlY3RlZC1kYXRlIG92ZXJ2aWV3IGZyb20gb25lIGRyYWZ0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNjaGVkdWxlIEN1cnJlbnQgbm9ybWFsaXplZCBub24tbXV0YXRpbmcgc2NoZWR1bGUgZHJhZnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzeW5jaHJvbml6ZV9zY2hlZHVsZSggc2NoZWR1bGUsIGNoYW5nZV9jb250ZXh0ICkge1xuXHRcdFx0dmFyIHNlbGVjdGVkX2RhdGVzID0gc2NoZWR1bGUgJiYgQXJyYXkuaXNBcnJheSggc2NoZWR1bGUuc2VsZWN0ZWRfZGF0ZXMgKSA/IHNjaGVkdWxlLnNlbGVjdGVkX2RhdGVzIDogW107XG5cdFx0XHR2YXIgZGF0ZXNfbGlzdCA9IGFjdGl2ZV9jb250ZW50X3Jvb3QgPyBhY3RpdmVfY29udGVudF9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1zZWxlY3RlZC1kYXRlc10nICkgOiBudWxsO1xuXHRcdFx0dmFyIHNlbGVjdGVkX2NvdW50ID0gYWN0aXZlX2NvbnRlbnRfcm9vdCA/IGFjdGl2ZV9jb250ZW50X3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLXNlbGVjdGVkLWNvdW50XScgKSA6IG51bGw7XG5cdFx0XHR2YXIgdGltZV9yb3cgPSBhY3RpdmVfY29udGVudF9yb290ID8gYWN0aXZlX2NvbnRlbnRfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItdGltZS1yb3ddJyApIDogbnVsbDtcblx0XHRcdHZhciBzdGFydF90aW1lID0gYWN0aXZlX2NvbnRlbnRfcm9vdCA/IGFjdGl2ZV9jb250ZW50X3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLXN0YXJ0LXRpbWVdJyApIDogbnVsbDtcblx0XHRcdHZhciBlbmRfdGltZSA9IGFjdGl2ZV9jb250ZW50X3Jvb3QgPyBhY3RpdmVfY29udGVudF9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1lbmQtdGltZV0nICkgOiBudWxsO1xuXHRcdFx0dmFyIHJlc2V0X2J1dHRvbiA9IGFjdGl2ZV9jb250ZW50X3Jvb3QgPyBhY3RpdmVfY29udGVudF9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1zY2hlZHVsZS1yZXNldF0nICkgOiBudWxsO1xuXHRcdFx0dmFyIHJldmlld19lcnJvcjtcblxuXHRcdFx0aWYgKCBzZWxlY3RlZF9jb3VudCApIHtcblx0XHRcdFx0c2VsZWN0ZWRfY291bnQudGV4dENvbnRlbnQgPSBTdHJpbmcoIHNlbGVjdGVkX2RhdGVzLmxlbmd0aCApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBkYXRlc19saXN0ICkge1xuXHRcdFx0XHRkYXRlc19saXN0LnRleHRDb250ZW50ID0gJyc7XG5cdFx0XHRcdCggc2VsZWN0ZWRfZGF0ZXMubGVuZ3RoID8gc2VsZWN0ZWRfZGF0ZXMgOiBbIGkxOG4ubm9fZGF0ZXMgfHwgJycgXSApLmZvckVhY2goIGZ1bmN0aW9uICggc2VsZWN0ZWRfZGF0ZSApIHtcblx0XHRcdFx0XHR2YXIgZGF0ZV9lbnRyeSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdsaScgKTtcblx0XHRcdFx0XHRkYXRlX2VudHJ5LnRleHRDb250ZW50ID0gU3RyaW5nKCBzZWxlY3RlZF9kYXRlICk7XG5cdFx0XHRcdFx0ZGF0ZXNfbGlzdC5hcHBlbmRDaGlsZCggZGF0ZV9lbnRyeSApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRpbWVfcm93ICkge1xuXHRcdFx0XHR0aW1lX3Jvdy5oaWRkZW4gPSAnZnVsbF9kYXknID09PSBzY2hlZHVsZS50aW1lX2FwcGxpY2F0aW9uO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzdGFydF90aW1lICkge1xuXHRcdFx0XHRzdGFydF90aW1lLnZhbHVlID0gc2NoZWR1bGUuc3RhcnRfdGltZSB8fCAnJztcblx0XHRcdH1cblx0XHRcdGlmICggZW5kX3RpbWUgKSB7XG5cdFx0XHRcdGVuZF90aW1lLnZhbHVlID0gc2NoZWR1bGUuZW5kX3RpbWUgfHwgJyc7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHJlc2V0X2J1dHRvbiApIHtcblx0XHRcdFx0cmVzZXRfYnV0dG9uLmRpc2FibGVkID0gISBzZWxlY3RlZF9kYXRlcy5sZW5ndGg7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHNlbGVjdGVkX2RhdGVzLmxlbmd0aCApIHtcblx0XHRcdFx0c2V0X3NjaGVkdWxlX2Vycm9yKCBmYWxzZSApO1xuXHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0YWN0aXZlX2NvbnRlbnRfcm9vdFxuXHRcdFx0XHRcdCYmICEgYWN0aXZlX2NvbnRlbnRfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItZmllbGQtZXJyb3JdOm5vdChbaGlkZGVuXSknIClcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0cmV2aWV3X2Vycm9yID0gYWN0aXZlX2NvbnRlbnRfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItcmV2aWV3LWVycm9yXScgKTtcblxuXHRcdFx0XHRcdGlmICggcmV2aWV3X2Vycm9yICkge1xuXHRcdFx0XHRcdFx0cmV2aWV3X2Vycm9yLmhpZGRlbiA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBhY3RpdmVfY29udGVudF9yb290ID8gYWN0aXZlX2NvbnRlbnRfcm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3Itc2VsZWN0aW9uLW1ldGhvZF0nICkgOiBbXSwgZnVuY3Rpb24gKCBjb250cm9sICkge1xuXHRcdFx0XHRjb250cm9sLmNoZWNrZWQgPSBjb250cm9sLnZhbHVlID09PSBzY2hlZHVsZS5zZWxlY3Rpb25fbWV0aG9kO1xuXHRcdFx0fSApO1xuXHRcdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCggYWN0aXZlX2NvbnRlbnRfcm9vdCA/IGFjdGl2ZV9jb250ZW50X3Jvb3QucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLXRpbWUtYXBwbGljYXRpb25dJyApIDogW10sIGZ1bmN0aW9uICggY29udHJvbCApIHtcblx0XHRcdFx0Y29udHJvbC5jaGVja2VkID0gY29udHJvbC52YWx1ZSA9PT0gc2NoZWR1bGUudGltZV9hcHBsaWNhdGlvbjtcblx0XHRcdH0gKTtcblx0XHRcdGlmICggISBzY2hlZHVsZV9yZWFkeSApIHtcblx0XHRcdFx0c2NoZWR1bGVfcmVhZHkgPSB0cnVlO1xuXHRcdFx0fSBlbHNlIGlmICggISBjaGFuZ2VfY29udGV4dCB8fCBjaGFuZ2VfY29udGV4dC5pc19kaXJ0eSApIHtcblx0XHRcdFx0aW52YWxpZGF0ZV9jb3N0X3ByZXZpZXcoKTtcblx0XHRcdH1cblx0XHRcdHVwZGF0ZV9kaXJ0eV9zdGF0ZSgpO1xuXHRcdFx0cXVldWVfY29zdF9wcmV2aWV3KCAyNTAgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBcHBseSB2aXNpYmxlIHRpbWUgaW5wdXRzIHRvIHRoZSBib3VuZGVkIHNjaGVkdWxlIGRyYWZ0IHdoZW4gY29tcGxldGUuXG5cdFx0ICpcblx0XHQgKiBBIHBhcnRpYWwgb3IgaW52YWxpZCBsb2NhbCB0aW1lIHJlbWFpbnMgcHJlc2VudGF0aW9uLW9ubHksIGJ1dCBzdGlsbCBtYXJrc1xuXHRcdCAqIHRoZSBJbnNwZWN0b3IgZGlydHkgc28gRXNjYXBlIG9yIENhbmNlbCBjYW5ub3QgZGlzY2FyZCBpdCBzaWxlbnRseS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gdXBkYXRlX3NjaGVkdWxlX3RpbWVzKCkge1xuXHRcdFx0dmFyIHN0YXJ0X3RpbWUgPSBhY3RpdmVfY29udGVudF9yb290ID8gYWN0aXZlX2NvbnRlbnRfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3Itc3RhcnQtdGltZV0nICkgOiBudWxsO1xuXHRcdFx0dmFyIGVuZF90aW1lID0gYWN0aXZlX2NvbnRlbnRfcm9vdCA/IGFjdGl2ZV9jb250ZW50X3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLWVuZC10aW1lXScgKSA6IG51bGw7XG5cdFx0XHR2YXIgYWNjZXB0ZWQgPSBzY2hlZHVsZV93b3JrZmxvdyAmJiBzdGFydF90aW1lICYmIGVuZF90aW1lXG5cdFx0XHRcdD8gc2NoZWR1bGVfd29ya2Zsb3cuc2V0X3RpbWVzKCBzdGFydF90aW1lLnZhbHVlLCBlbmRfdGltZS52YWx1ZSApXG5cdFx0XHRcdDogZmFsc2U7XG5cblx0XHRcdHNjaGVkdWxlX2lucHV0X2RpcnR5ID0gISBhY2NlcHRlZDtcblx0XHRcdHVwZGF0ZV9kaXJ0eV9zdGF0ZSgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFVwZGF0ZSB0aGUgbmF0aXZlLWNhbGVuZGFyIGxvYWRpbmcgcHJlc2VudGF0aW9uIHdpdGhvdXQgcmVwbGFjaW5nIGNvbnRlbnQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX2xvYWRpbmcgV2hldGhlciB0aGUgc2NoZWR1bGUgd29ya2Zsb3cgaXMgbG9hZGluZy5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNldF9zY2hlZHVsZV9sb2FkaW5nKCBpc19sb2FkaW5nICkge1xuXHRcdFx0dmFyIGNhbGVuZGFyX2hvc3QgPSBhY3RpdmVfY29udGVudF9yb290ID8gYWN0aXZlX2NvbnRlbnRfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItY2FsZW5kYXItaG9zdF0nICkgOiBudWxsO1xuXHRcdFx0dmFyIHN0YXR1c19ob3N0ID0gYWN0aXZlX2NvbnRlbnRfcm9vdCA/IGFjdGl2ZV9jb250ZW50X3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLXNjaGVkdWxlLXN0YXR1c10nICkgOiBudWxsO1xuXHRcdFx0dmFyIHJlc2V0X2J1dHRvbiA9IGFjdGl2ZV9jb250ZW50X3Jvb3QgPyBhY3RpdmVfY29udGVudF9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1zY2hlZHVsZS1yZXNldF0nICkgOiBudWxsO1xuXHRcdFx0dmFyIHNlbGVjdGVkX2NvdW50ID0gYWN0aXZlX2NvbnRlbnRfcm9vdCA/IGFjdGl2ZV9jb250ZW50X3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLXNlbGVjdGVkLWNvdW50XScgKSA6IG51bGw7XG5cdFx0XHR2YXIgc2NoZWR1bGVfY29udHJvbHMgPSBhY3RpdmVfY29udGVudF9yb290ID8gYWN0aXZlX2NvbnRlbnRfcm9vdC5xdWVyeVNlbGVjdG9yQWxsKFxuXHRcdFx0XHQnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3Itc2VsZWN0aW9uLW1ldGhvZF0sICdcblx0XHRcdFx0KyAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItdGltZS1hcHBsaWNhdGlvbl0sICdcblx0XHRcdFx0KyAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3Itc3RhcnQtdGltZV0sICdcblx0XHRcdFx0KyAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItZW5kLXRpbWVdJ1xuXHRcdFx0KSA6IFtdO1xuXG5cdFx0XHRpZiAoIGNhbGVuZGFyX2hvc3QgKSB7XG5cdFx0XHRcdGNhbGVuZGFyX2hvc3Quc2V0QXR0cmlidXRlKCAnYXJpYS1idXN5JywgaXNfbG9hZGluZyA/ICd0cnVlJyA6ICdmYWxzZScgKTtcblx0XHRcdH1cblx0XHRcdGlmICggc3RhdHVzX2hvc3QgKSB7XG5cdFx0XHRcdHN0YXR1c19ob3N0LnRleHRDb250ZW50ID0gaXNfbG9hZGluZyA/IGkxOG4ubG9hZGluZ19zY2hlZHVsZSB8fCAnJyA6ICcnO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCByZXNldF9idXR0b24gKSB7XG5cdFx0XHRcdHJlc2V0X2J1dHRvbi5kaXNhYmxlZCA9IGlzX2xvYWRpbmcgfHwgISBzZWxlY3RlZF9jb3VudCB8fCAnMCcgPT09IHNlbGVjdGVkX2NvdW50LnRleHRDb250ZW50O1xuXHRcdFx0fVxuXHRcdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCggc2NoZWR1bGVfY29udHJvbHMsIGZ1bmN0aW9uICggY29udHJvbCApIHtcblx0XHRcdFx0Y29udHJvbC5kaXNhYmxlZCA9IEJvb2xlYW4oIGlzX2xvYWRpbmcgKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTaG93IG9yIGNsZWFyIHRoZSBsb2NhbCBzY2hlZHVsZS1yZWFkIGVycm9yIHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBoYXNfZXJyb3IgV2hldGhlciBhIHNjaGVkdWxlIHJlYWQgb3IgUmV2aWV3IHJlYWRpbmVzcyBjaGVjayBmYWlsZWQuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9ICBtZXNzYWdlICAgT3B0aW9uYWwgcGxhaW4tdGV4dCBlcnJvciBtZXNzYWdlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X3NjaGVkdWxlX2Vycm9yKCBoYXNfZXJyb3IsIG1lc3NhZ2UgKSB7XG5cdFx0XHR2YXIgZXJyb3JfaG9zdCA9IGFjdGl2ZV9jb250ZW50X3Jvb3QgPyBhY3RpdmVfY29udGVudF9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1zY2hlZHVsZS1lcnJvcl0nICkgOiBudWxsO1xuXHRcdFx0dmFyIHJlc2V0X2J1dHRvbiA9IGFjdGl2ZV9jb250ZW50X3Jvb3QgPyBhY3RpdmVfY29udGVudF9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1zY2hlZHVsZS1yZXNldF0nICkgOiBudWxsO1xuXHRcdFx0dmFyIGVycm9yX21lc3NhZ2UgPSBlcnJvcl9ob3N0ID8gZXJyb3JfaG9zdC5xdWVyeVNlbGVjdG9yKCAncCcgKSA6IG51bGw7XG5cblx0XHRcdGlmICggZXJyb3JfaG9zdCApIHtcblx0XHRcdFx0ZXJyb3JfaG9zdC5oaWRkZW4gPSAhIGhhc19lcnJvcjtcblx0XHRcdH1cblx0XHRcdGlmICggZXJyb3JfbWVzc2FnZSApIHtcblx0XHRcdFx0ZXJyb3JfbWVzc2FnZS50ZXh0Q29udGVudCA9IGhhc19lcnJvciA/IFN0cmluZyggbWVzc2FnZSB8fCBpMThuLnNjaGVkdWxlX2ZhaWxlZCB8fCAnJyApIDogJyc7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGhhc19lcnJvciAmJiByZXNldF9idXR0b24gKSB7XG5cdFx0XHRcdHJlc2V0X2J1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTWFwIGJvdW5kZWQgc2VydmVyIGZpZWxkIGVycm9ycyB0byBhdXRob3JpemVkIHBsYWluLXRleHQgY29zdCBtZXNzYWdlcy5cblx0XHQgKlxuXHRcdCAqIENvc3QgcHJldmlldyBtdXN0IG5ldmVyIGJ1aWxkIHNlbGVjdG9ycyBmcm9tIHJlamVjdGVkIGtleXMgb3IgZXhwb3NlIHJhd1xuXHRcdCAqIGZpZWxkIG1ldGFkYXRhLiBFeGFjdCBCb290c3RyYXAgbGFiZWxzIGFyZSB1c2VkIHdoZW4gYXZhaWxhYmxlOyBhbGwgb3RoZXJcblx0XHQgKiBlcnJvcnMgcmV0YWluIG9ubHkgdGhlaXIgc2FmZSBzZXJ2ZXIgbWVzc2FnZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fG51bGx9IGVycm9yX2RhdGEgTm9ybWFsaXplZCBjb3N0IGVycm9yIHJlc3BvbnNlLlxuXHRcdCAqIEByZXR1cm4ge0FycmF5PHN0cmluZz59IE9yZGVyZWQgdmlzaWJsZSB2YWxpZGF0aW9uIG1lc3NhZ2VzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9jb3N0X3ZhbGlkYXRpb25fbWVzc2FnZXMoIGVycm9yX2RhdGEgKSB7XG5cdFx0XHR2YXIgZmllbGRfZXJyb3JzID0gZXJyb3JfZGF0YSAmJiBBcnJheS5pc0FycmF5KCBlcnJvcl9kYXRhLmZpZWxkX2Vycm9ycyApID8gZXJyb3JfZGF0YS5maWVsZF9lcnJvcnMgOiBbXTtcblx0XHRcdHZhciBhdXRob3JpemVkX2ZpZWxkcyA9IGFjdGl2ZV9ib290c3RyYXAgJiYgQXJyYXkuaXNBcnJheSggYWN0aXZlX2Jvb3RzdHJhcC5maWVsZHMgKSA/IGFjdGl2ZV9ib290c3RyYXAuZmllbGRzIDogW107XG5cdFx0XHR2YXIgbGFiZWxzX2J5X2tleSA9IHt9O1xuXG5cdFx0XHRhdXRob3JpemVkX2ZpZWxkcy5mb3JFYWNoKCBmdW5jdGlvbiAoIGZpZWxkX2NvbnRyYWN0ICkge1xuXHRcdFx0XHR2YXIgZmllbGRfa2V5ID0gZmllbGRfY29udHJhY3QgJiYgZmllbGRfY29udHJhY3Qua2V5ID8gU3RyaW5nKCBmaWVsZF9jb250cmFjdC5rZXkgKSA6ICcnO1xuXG5cdFx0XHRcdGlmICggZmllbGRfa2V5ICkge1xuXHRcdFx0XHRcdGxhYmVsc19ieV9rZXlbIGZpZWxkX2tleSBdID0gU3RyaW5nKCBmaWVsZF9jb250cmFjdC5sYWJlbCB8fCBpMThuLmJvb2tpbmdfZGV0YWlscyB8fCAnJyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiBmaWVsZF9lcnJvcnMuc2xpY2UoIDAsIDIwICkubWFwKCBmdW5jdGlvbiAoIGZpZWxkX2Vycm9yICkge1xuXHRcdFx0XHR2YXIgZmllbGRfa2V5ID0gZmllbGRfZXJyb3IgJiYgZmllbGRfZXJyb3Iua2V5ID8gU3RyaW5nKCBmaWVsZF9lcnJvci5rZXkgKSA6ICcnO1xuXHRcdFx0XHR2YXIgbWVzc2FnZSA9IGZpZWxkX2Vycm9yICYmIGZpZWxkX2Vycm9yLm1lc3NhZ2UgPyBTdHJpbmcoIGZpZWxkX2Vycm9yLm1lc3NhZ2UgKSA6ICcnO1xuXHRcdFx0XHR2YXIgZmllbGRfbGFiZWwgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIGxhYmVsc19ieV9rZXksIGZpZWxkX2tleSApID8gbGFiZWxzX2J5X2tleVsgZmllbGRfa2V5IF0gOiAnJztcblxuXHRcdFx0XHRyZXR1cm4gZmllbGRfbGFiZWwgJiYgbWVzc2FnZSA/IGZpZWxkX2xhYmVsICsgJzogJyArIG1lc3NhZ2UgOiBtZXNzYWdlO1xuXHRcdFx0fSApLmZpbHRlciggZnVuY3Rpb24gKCBtZXNzYWdlICkge1xuXHRcdFx0XHRyZXR1cm4gQm9vbGVhbiggbWVzc2FnZSApO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbmRlciBvbmUgc2VydmVyLWF1dGhvcml0YXRpdmUgY29zdCBEVE8gd2l0aG91dCB0cnVzdGluZyBtYXJrdXAuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICAgIGNvc3RfZHRvICAgICAgICAgICBDdXJyZW50IGNvc3QgRFRPLlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fG51bGx9ICAgZmFsbGJhY2sgICAgICAgICAgIE9wdGlvbmFsIGNhbm9uaWNhbCBmYWxsYmFjayBEVE8uXG5cdFx0ICogQHBhcmFtIHtBcnJheTxzdHJpbmc+fSB2YWxpZGF0aW9uX21lc3NhZ2VzIE9wdGlvbmFsIGJvdW5kZWQgdmFsaWRhdGlvbiBtZXNzYWdlcy5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9jb3N0KCBjb3N0X2R0bywgZmFsbGJhY2ssIHZhbGlkYXRpb25fbWVzc2FnZXMgKSB7XG5cdFx0XHR2YXIgY29zdHNfaG9zdCA9IGFjdGl2ZV9jb250ZW50X3Jvb3QgPyBhY3RpdmVfY29udGVudF9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1jb3N0cy1ob3N0XScgKSA6IG51bGw7XG5cdFx0XHR2YXIgcmVzdG9yZV9jb3N0X2ZvY3VzO1xuXHRcdFx0dmFyIG5leHRfY29zdF9idXR0b247XG5cblx0XHRcdGlmICggISBjb3N0c19ob3N0ICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNvc3Rfc2VjdGlvbl9kaXNtaXNzZWQgKSB7XG5cdFx0XHRcdGNvc3RzX2hvc3QuaGlkZGVuID0gdHJ1ZTtcblx0XHRcdFx0Y29zdHNfaG9zdC5pbm5lckhUTUwgPSAnJztcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29zdHNfaG9zdC5oaWRkZW4gPSBmYWxzZTtcblx0XHRcdHJlc3RvcmVfY29zdF9mb2N1cyA9IEJvb2xlYW4oXG5cdFx0XHRcdGRvY3VtZW50LmFjdGl2ZUVsZW1lbnRcblx0XHRcdFx0JiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQuY2xvc2VzdFxuXHRcdFx0XHQmJiBkb2N1bWVudC5hY3RpdmVFbGVtZW50LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1jb3N0LXByZXZpZXddJyApXG5cdFx0XHQpO1xuXHRcdFx0Y29zdHNfaG9zdC5pbm5lckhUTUwgPSBjb3N0c190ZW1wbGF0ZSgge1xuXHRcdFx0XHRjb3N0OiBjb3N0X2R0byB8fCB7fSxcblx0XHRcdFx0ZmFsbGJhY2s6IGZhbGxiYWNrIHx8IG51bGwsXG5cdFx0XHRcdHVwZ3JhZGVfcmVxdWlyZWQ6ICEgY2FuX3ByZXZpZXdfY29zdCgpLFxuXHRcdFx0XHRjb3JyZWN0aW9uX2FsbG93ZWQ6IEJvb2xlYW4oIGFjdGl2ZV9ib290c3RyYXAgJiYgYWN0aXZlX2Jvb3RzdHJhcC5lZGl0aW9uX2NhcGFiaWxpdGllcyAmJiBhY3RpdmVfYm9vdHN0cmFwLmVkaXRpb25fY2FwYWJpbGl0aWVzLmNvc3RfY29ycmVjdGlvbiApLFxuXHRcdFx0XHRjb3JyZWN0aW9uX3ZhbHVlOiBjb3N0X2NvcnJlY3Rpb24sXG5cdFx0XHRcdHZhbGlkYXRpb25fbWVzc2FnZXM6IEFycmF5LmlzQXJyYXkoIHZhbGlkYXRpb25fbWVzc2FnZXMgKSA/IHZhbGlkYXRpb25fbWVzc2FnZXMgOiBbXSxcblx0XHRcdFx0aTE4bjogaTE4blxuXHRcdFx0fSApO1xuXHRcdFx0YWN0aXZlX2NvbnRlbnRfcm9vdC5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLWNvc3Qtc3RhdGUnLCBTdHJpbmcoIGNvc3RfZHRvICYmIGNvc3RfZHRvLnN0YXR1cyA/IGNvc3RfZHRvLnN0YXR1cyA6ICd1bmF2YWlsYWJsZScgKSApO1xuXHRcdFx0aWYgKCByZXN0b3JlX2Nvc3RfZm9jdXMgKSB7XG5cdFx0XHRcdG5leHRfY29zdF9idXR0b24gPSBjb3N0c19ob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1jb3N0LXByZXZpZXddJyApO1xuXHRcdFx0XHRpZiAoIG5leHRfY29zdF9idXR0b24gJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIG5leHRfY29zdF9idXR0b24uZm9jdXMgKSB7XG5cdFx0XHRcdFx0bmV4dF9jb3N0X2J1dHRvbi5mb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQnVpbGQgdGhlIGV4YWN0IHN0cnVjdHVyZWQgZHJhZnQgc2VudCB0byB0aGUgYXV0aGVudGljYXRlZCBjb3N0IHNlcnZpY2UuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gRHJhZnQgcmVxdWVzdCBvciBudWxsIGJlZm9yZSBzY2hlZHVsZSBoeWRyYXRpb24uXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2RyYWZ0X3JlcXVlc3QoKSB7XG5cdFx0XHR2YXIgc2NoZWR1bGUgPSBzY2hlZHVsZV93b3JrZmxvdyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc2NoZWR1bGVfd29ya2Zsb3cuZ2V0X2RyYWZ0ID8gc2NoZWR1bGVfd29ya2Zsb3cuZ2V0X2RyYWZ0KCkgOiBudWxsO1xuXG5cdFx0XHRpZiAoXG5cdFx0XHRcdCEgYWN0aXZlX2Jvb3RzdHJhcFxuXHRcdFx0XHR8fCAhIHNjaGVkdWxlXG5cdFx0XHRcdHx8ICEgc2NoZWR1bGVfcmVhZHlcblx0XHRcdFx0fHwgc2NoZWR1bGVfaW5wdXRfZGlydHlcblx0XHRcdFx0fHwgISBBcnJheS5pc0FycmF5KCBzY2hlZHVsZS5zZWxlY3RlZF9kYXRlcyApXG5cdFx0XHRcdHx8ICEgc2NoZWR1bGUuc2VsZWN0ZWRfZGF0ZXMubGVuZ3RoXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHNjaGVtYV92ZXJzaW9uOiBjb25maWd1cmF0aW9uLnNjaGVtYV92ZXJzaW9uLFxuXHRcdFx0XHRyZXF1ZXN0X2lkOiBjcmVhdGVfcmVxdWVzdF9pZCgpLFxuXHRcdFx0XHRyZXNvdXJjZV9pZDogYWN0aXZlX2Jvb3RzdHJhcC5zZWxlY3RlZF9yZXNvdXJjZV9pZCxcblx0XHRcdFx0Zm9ybV9pZDogYWN0aXZlX2Jvb3RzdHJhcC5zZWxlY3RlZF9mb3JtX2lkLFxuXHRcdFx0XHRmb3JtX3NvdXJjZTogYWN0aXZlX2Jvb3RzdHJhcC5mb3JtX3NvdXJjZSxcblx0XHRcdFx0c2VsZWN0aW9uX3NvdXJjZTogbGFzdF9sYXVuY2hfcmVxdWVzdC5zZWxlY3Rpb25fc291cmNlIHx8ICdlbXB0eScsXG5cdFx0XHRcdHNvdXJjZV9jb250ZXh0X3Rva2VuOiBsYXN0X2xhdW5jaF9yZXF1ZXN0LnNvdXJjZV9jb250ZXh0X3Rva2VuIHx8ICcnLFxuXHRcdFx0XHRzY2hlZHVsZToge1xuXHRcdFx0XHRcdHNlbGVjdGlvbl9tZXRob2Q6IHNjaGVkdWxlLnNlbGVjdGlvbl9tZXRob2QsXG5cdFx0XHRcdFx0dGltZV9hcHBsaWNhdGlvbjogc2NoZWR1bGUudGltZV9hcHBsaWNhdGlvbixcblx0XHRcdFx0XHRzZWxlY3RlZF9kYXRlczogQXJyYXkuaXNBcnJheSggc2NoZWR1bGUuc2VsZWN0ZWRfZGF0ZXMgKSA/IHNjaGVkdWxlLnNlbGVjdGVkX2RhdGVzLnNsaWNlKCAwICkgOiBbXSxcblx0XHRcdFx0XHRzdGFydF90aW1lOiBzY2hlZHVsZS5zdGFydF90aW1lIHx8ICcnLFxuXHRcdFx0XHRcdGVuZF90aW1lOiBzY2hlZHVsZS5lbmRfdGltZSB8fCAnJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRmaWVsZHM6IGdldF9jdXN0b21lcl9maWVsZF9zbmFwc2hvdCggYWN0aXZlX2NvbnRlbnRfcm9vdCApLFxuXHRcdFx0XHRub3RlczogZ2V0X25vdGVfc25hcHNob3QoIGFjdGl2ZV9jb250ZW50X3Jvb3QgKSxcblx0XHRcdFx0ZW1haWxfaW50ZW50OiAnY2Fub25pY2FsX2RlZmF1bHQnLFxuXHRcdFx0XHRjb3N0X2ludGVudDogJycgPT09IGNvc3RfY29ycmVjdGlvbiA/ICdjYW5vbmljYWwnIDogJ2NvcnJlY3RlZCcsXG5cdFx0XHRcdGNvcnJlY3RlZF9jb3N0OiBjb3N0X2NvcnJlY3Rpb24sXG5cdFx0XHRcdGRyYWZ0X3JldmlzaW9uOiBkcmFmdF9yZXZpc2lvblxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXF1ZXN0IGEgY3VycmVudCBub24tbXV0YXRpbmcgY29zdCBwcmV2aWV3IGZvciB0aGUgZXhhY3QgbG9jYWwgcmV2aXNpb24uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlcXVlc3RfY29zdF9wcmV2aWV3KCkge1xuXHRcdFx0dmFyIHJlcXVlc3RfdmFsdWVzID0gZ2V0X2RyYWZ0X3JlcXVlc3QoKTtcblx0XHRcdHZhciBjdXJyZW50X2dlbmVyYXRpb247XG5cdFx0XHR2YXIgcmVxdWVzdGVkX3JldmlzaW9uO1xuXHRcdFx0dmFyIGNvc3Rfc3RhdHVzO1xuXHRcdFx0dmFyIGNvc3RfYnV0dG9uO1xuXHRcdFx0dmFyIGNvc3RfcmVxdWVzdDtcblxuXHRcdFx0aWYgKCAhIGNhbl9wcmV2aWV3X2Nvc3QoKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjb3N0X3ByZXZpZXdfdGltZXIgKSB7XG5cdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIGNvc3RfcHJldmlld190aW1lciApO1xuXHRcdFx0XHRjb3N0X3ByZXZpZXdfdGltZXIgPSBudWxsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHJlcXVlc3RfdmFsdWVzICkge1xuXHRcdFx0XHRjb3N0X3N0YXR1cyA9IGFjdGl2ZV9jb250ZW50X3Jvb3QgPyBhY3RpdmVfY29udGVudF9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1jb3N0LXN0YXR1c10nICkgOiBudWxsO1xuXHRcdFx0XHRpZiAoIGNvc3Rfc3RhdHVzICkge1xuXHRcdFx0XHRcdGNvc3Rfc3RhdHVzLnRleHRDb250ZW50ID0gaTE4bi5jb3N0X2ZhaWxlZCB8fCAnJztcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHBlbmRpbmdfY29zdF9yZXF1ZXN0ICkge1xuXHRcdFx0XHRjb3N0X3ByZXZpZXdfZGVmZXJyZWQgPSB0cnVlO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvc3RfcmVxdWVzdF9nZW5lcmF0aW9uICs9IDE7XG5cdFx0XHRjdXJyZW50X2dlbmVyYXRpb24gPSBjb3N0X3JlcXVlc3RfZ2VuZXJhdGlvbjtcblx0XHRcdHJlcXVlc3RlZF9yZXZpc2lvbiA9IHJlcXVlc3RfdmFsdWVzLmRyYWZ0X3JldmlzaW9uO1xuXHRcdFx0Y29zdF9wcmV2aWV3X2RlZmVycmVkID0gZmFsc2U7XG5cdFx0XHRjb3N0X3N0YXR1cyA9IGFjdGl2ZV9jb250ZW50X3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLWNvc3Qtc3RhdHVzXScgKTtcblx0XHRcdGNvc3RfYnV0dG9uID0gYWN0aXZlX2NvbnRlbnRfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItY29zdC1wcmV2aWV3XScgKTtcblx0XHRcdGlmICggY29zdF9zdGF0dXMgKSB7XG5cdFx0XHRcdGNvc3Rfc3RhdHVzLnRleHRDb250ZW50ID0gaTE4bi5jYWxjdWxhdGluZ19jb3N0IHx8ICcnO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjb3N0X2J1dHRvbiApIHtcblx0XHRcdFx0Y29zdF9idXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0YWN0aXZlX2NvbnRlbnRfcm9vdC5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLWNvc3Qtc3RhdGUnLCAnbG9hZGluZycgKTtcblxuXHRcdFx0Y29zdF9yZXF1ZXN0ID0gJC5hamF4KCB7XG5cdFx0XHRcdHVybDogdHJhbnNwb3J0LnVybCxcblx0XHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRcdGRhdGFUeXBlOiAnanNvbicsXG5cdFx0XHRcdGRhdGE6IHtcblx0XHRcdFx0XHRhY3Rpb246IHRyYW5zcG9ydC5jb3N0X2FjdGlvbixcblx0XHRcdFx0XHRub25jZTogdHJhbnNwb3J0LmNvc3Rfbm9uY2UsXG5cdFx0XHRcdFx0cmVxdWVzdDogSlNPTi5zdHJpbmdpZnkoIHJlcXVlc3RfdmFsdWVzIClcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0cGVuZGluZ19jb3N0X3JlcXVlc3QgPSBjb3N0X3JlcXVlc3Q7XG5cdFx0XHRjb3N0X3JlcXVlc3QuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdFx0dmFyIHJlc3BvbnNlX2RhdGEgPSByZXNwb25zZSAmJiB0cnVlID09PSByZXNwb25zZS5zdWNjZXNzID8gcmVzcG9uc2UuZGF0YSA6IG51bGw7XG5cblx0XHRcdFx0aWYgKCBjdXJyZW50X2dlbmVyYXRpb24gIT09IGNvc3RfcmVxdWVzdF9nZW5lcmF0aW9uIHx8IHJlcXVlc3RlZF9yZXZpc2lvbiAhPT0gZHJhZnRfcmV2aXNpb24gfHwgISBhY3RpdmVfY29udGVudF9yb290ICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICEgcmVzcG9uc2VfZGF0YSB8fCByZXNwb25zZV9kYXRhLnJlcXVlc3RfaWQgIT09IHJlcXVlc3RfdmFsdWVzLnJlcXVlc3RfaWQgfHwgcmVzcG9uc2VfZGF0YS5kcmFmdF9yZXZpc2lvbiAhPT0gcmVxdWVzdGVkX3JldmlzaW9uICkge1xuXHRcdFx0XHRcdHRyYW5zaXRpb24oICdlZGl0aW5nJyApO1xuXHRcdFx0XHRcdHJlbmRlcl9jb3N0KCB7IHN0YXR1czogJ3N0YWxlJywgbWVzc2FnZTogaTE4bi5jb3N0X3N0YWxlIHx8ICcnLCBsaW5lX2l0ZW1zOiBbXSB9LCBudWxsICk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggJ2Nvc3RfcHJldmlldycgPT09IHJlc3BvbnNlX2RhdGEuc3RhdGUgKSB7XG5cdFx0XHRcdFx0dHJhbnNpdGlvbiggJ2Nvc3RfcHJldmlldycgKTtcblx0XHRcdFx0XHRyZW5kZXJfY29zdCggcmVzcG9uc2VfZGF0YS5jb3N0IHx8IHt9LCBudWxsLCByZXNwb25zZV9kYXRhLndhcm5pbmdzIHx8IFtdICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dHJhbnNpdGlvbiggJ2VkaXRpbmcnICk7XG5cdFx0XHRcdFx0cmVuZGVyX2Nvc3QoIHJlc3BvbnNlX2RhdGEuY29zdCB8fCB7fSwgcmVzcG9uc2VfZGF0YS5mYWxsYmFjayB8fCBudWxsLCByZXNwb25zZV9kYXRhLndhcm5pbmdzIHx8IFtdICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIGZhaWxlZF9yZXF1ZXN0LCByZXF1ZXN0X3N0YXR1cyApIHtcblx0XHRcdFx0dmFyIGVycm9yX2RhdGE7XG5cdFx0XHRcdHZhciByZXZpZXdfYnV0dG9uO1xuXG5cdFx0XHRcdGlmICggJ2Fib3J0JyA9PT0gcmVxdWVzdF9zdGF0dXMgfHwgY3VycmVudF9nZW5lcmF0aW9uICE9PSBjb3N0X3JlcXVlc3RfZ2VuZXJhdGlvbiB8fCByZXF1ZXN0ZWRfcmV2aXNpb24gIT09IGRyYWZ0X3JldmlzaW9uIHx8ICEgYWN0aXZlX2NvbnRlbnRfcm9vdCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0ZXJyb3JfZGF0YSA9IGZhaWxlZF9yZXF1ZXN0ICYmIGZhaWxlZF9yZXF1ZXN0LnJlc3BvbnNlSlNPTiA/IGZhaWxlZF9yZXF1ZXN0LnJlc3BvbnNlSlNPTi5kYXRhIDogbnVsbDtcblx0XHRcdFx0dHJhbnNpdGlvbiggJ2VkaXRpbmcnICk7XG5cdFx0XHRcdHJlbmRlcl9jb3N0KFxuXHRcdFx0XHRcdHsgc3RhdHVzOiAndW5hdmFpbGFibGUnLCBtZXNzYWdlOiBlcnJvcl9kYXRhICYmIGVycm9yX2RhdGEubWVzc2FnZSA/IGVycm9yX2RhdGEubWVzc2FnZSA6IGkxOG4uY29zdF9mYWlsZWQgfHwgJycsIGxpbmVfaXRlbXM6IFtdIH0sXG5cdFx0XHRcdFx0bnVsbCxcblx0XHRcdFx0XHRnZXRfY29zdF92YWxpZGF0aW9uX21lc3NhZ2VzKCBlcnJvcl9kYXRhIClcblx0XHRcdFx0KTtcblx0XHRcdH0gKS5hbHdheXMoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0dmFyIHJlcXVlc3RfbGF0ZXN0X3ByZXZpZXcgPSBjb3N0X3ByZXZpZXdfZGVmZXJyZWQ7XG5cblx0XHRcdFx0aWYgKCBwZW5kaW5nX2Nvc3RfcmVxdWVzdCA9PT0gY29zdF9yZXF1ZXN0ICkge1xuXHRcdFx0XHRcdHBlbmRpbmdfY29zdF9yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb3N0X3ByZXZpZXdfZGVmZXJyZWQgPSBmYWxzZTtcblx0XHRcdFx0aWYgKCByZXF1ZXN0X2xhdGVzdF9wcmV2aWV3ICkge1xuXHRcdFx0XHRcdHF1ZXVlX2Nvc3RfcHJldmlldyggMCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVxdWVzdCBhIGN1cnJlbnQgc2lnbmVkIG5vbi1tdXRhdGluZyBSZXZpZXcgZm9yIHRoZSBleGFjdCBsb2NhbCByZXZpc2lvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVxdWVzdF9yZXZpZXcoKSB7XG5cdFx0XHR2YXIgcmVxdWVzdF92YWx1ZXM7XG5cdFx0XHR2YXIgY3VycmVudF9nZW5lcmF0aW9uO1xuXHRcdFx0dmFyIHJlcXVlc3RlZF9yZXZpc2lvbjtcblx0XHRcdHZhciByZXZpZXdfYnV0dG9uO1xuXG5cdFx0XHRpZiAoICEgYWN0aXZlX2NvbnRlbnRfcm9vdCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cmVxdWVzdF92YWx1ZXMgPSBnZXRfZHJhZnRfcmVxdWVzdCgpO1xuXHRcdFx0aWYgKCAhIHJlcXVlc3RfdmFsdWVzICkge1xuXHRcdFx0XHRjbGVhcl9yZXZpZXdfZXJyb3JzKCk7XG5cdFx0XHRcdHJlbmRlcl9yZXZpZXdfcmVhZGluZXNzX2Vycm9ycygpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyZXZpZXdfcmVxdWVzdF9nZW5lcmF0aW9uICs9IDE7XG5cdFx0XHRjdXJyZW50X2dlbmVyYXRpb24gPSByZXZpZXdfcmVxdWVzdF9nZW5lcmF0aW9uO1xuXHRcdFx0cmVxdWVzdGVkX3JldmlzaW9uID0gcmVxdWVzdF92YWx1ZXMuZHJhZnRfcmV2aXNpb247XG5cdFx0XHRpZiAoIHBlbmRpbmdfcmV2aWV3X3JlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHBlbmRpbmdfcmV2aWV3X3JlcXVlc3QuYWJvcnQgKSB7XG5cdFx0XHRcdHBlbmRpbmdfcmV2aWV3X3JlcXVlc3QuYWJvcnQoKTtcblx0XHRcdH1cblx0XHRcdGNsZWFyX3Jldmlld19lcnJvcnMoKTtcblx0XHRcdHJldmlld19idXR0b24gPSBhY3RpdmVfY29udGVudF9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1yZXZpZXddJyApO1xuXHRcdFx0aWYgKCByZXZpZXdfYnV0dG9uICkge1xuXHRcdFx0XHRyZXZpZXdfYnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcblx0XHRcdFx0cmV2aWV3X2J1dHRvbi5zZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knLCAndHJ1ZScgKTtcblx0XHRcdH1cblxuXHRcdFx0cGVuZGluZ19yZXZpZXdfcmVxdWVzdCA9ICQuYWpheCgge1xuXHRcdFx0XHR1cmw6IHRyYW5zcG9ydC51cmwsXG5cdFx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0XHRkYXRhVHlwZTogJ2pzb24nLFxuXHRcdFx0XHRkYXRhOiB7XG5cdFx0XHRcdFx0YWN0aW9uOiB0cmFuc3BvcnQucmV2aWV3X2FjdGlvbixcblx0XHRcdFx0XHRub25jZTogdHJhbnNwb3J0LnJldmlld19ub25jZSxcblx0XHRcdFx0XHRyZXF1ZXN0OiBKU09OLnN0cmluZ2lmeSggcmVxdWVzdF92YWx1ZXMgKVxuXHRcdFx0XHR9XG5cdFx0XHR9ICkuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdFx0dmFyIHJlc3BvbnNlX2RhdGEgPSByZXNwb25zZSAmJiB0cnVlID09PSByZXNwb25zZS5zdWNjZXNzID8gcmVzcG9uc2UuZGF0YSA6IG51bGw7XG5cdFx0XHRcdHZhciByZXZpZXdfY2FuY2VsO1xuXG5cdFx0XHRcdGlmICggY3VycmVudF9nZW5lcmF0aW9uICE9PSByZXZpZXdfcmVxdWVzdF9nZW5lcmF0aW9uIHx8IHJlcXVlc3RlZF9yZXZpc2lvbiAhPT0gZHJhZnRfcmV2aXNpb24gfHwgISBhY3RpdmVfY29udGVudF9yb290ICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRwZW5kaW5nX3Jldmlld19yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdFx0aWYgKCAhIHJlc3BvbnNlX2RhdGEgfHwgcmVzcG9uc2VfZGF0YS5yZXF1ZXN0X2lkICE9PSByZXF1ZXN0X3ZhbHVlcy5yZXF1ZXN0X2lkIHx8ICdyZXZpZXcnICE9PSByZXNwb25zZV9kYXRhLnN0YXRlICkge1xuXHRcdFx0XHRcdGlmICggcmV2aWV3X2J1dHRvbiApIHtcblx0XHRcdFx0XHRcdHJldmlld19idXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRcdHJldmlld19idXR0b24ucmVtb3ZlQXR0cmlidXRlKCAnYXJpYS1idXN5JyApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhIHRyYW5zaXRpb24oICdyZXZpZXcnICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGFjdGl2ZV9yZXZpZXcgPSByZXNwb25zZV9kYXRhO1xuXHRcdFx0XHRhY3RpdmVfY29udGVudF9yb290LmhpZGRlbiA9IHRydWU7XG5cdFx0XHRcdHNoYXJlZF9jb250ZW50X3Jvb3QuaW5zZXJ0QWRqYWNlbnRIVE1MKCAnYmVmb3JlZW5kJywgcmV2aWV3X3RlbXBsYXRlKCB7IHJldmlldzogcmVzcG9uc2VfZGF0YS5yZXZpZXcgfHwge30sIGkxOG46IGkxOG4gfSApICk7XG5cdFx0XHRcdGFjdGl2ZV9yZXZpZXdfcm9vdCA9IHNoYXJlZF9jb250ZW50X3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLXJldmlldy12aWV3XScgKTtcblx0XHRcdFx0cmV2aWV3X2NhbmNlbCA9IGFjdGl2ZV9yZXZpZXdfcm9vdCA/IGFjdGl2ZV9yZXZpZXdfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItcmV2aWV3LWNhbmNlbF0nICkgOiBudWxsO1xuXHRcdFx0XHRpZiAoIHJldmlld19jYW5jZWwgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHJldmlld19jYW5jZWwuZm9jdXMgKSB7XG5cdFx0XHRcdFx0cmV2aWV3X2NhbmNlbC5mb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCBmYWlsZWRfcmVxdWVzdCwgcmVxdWVzdF9zdGF0dXMgKSB7XG5cdFx0XHRcdHZhciBlcnJvcl9kYXRhO1xuXHRcdFx0XHR2YXIgaGFzX2ZpZWxkX2Vycm9ycztcblxuXHRcdFx0XHRpZiAoICdhYm9ydCcgPT09IHJlcXVlc3Rfc3RhdHVzIHx8IGN1cnJlbnRfZ2VuZXJhdGlvbiAhPT0gcmV2aWV3X3JlcXVlc3RfZ2VuZXJhdGlvbiB8fCByZXF1ZXN0ZWRfcmV2aXNpb24gIT09IGRyYWZ0X3JldmlzaW9uIHx8ICEgYWN0aXZlX2NvbnRlbnRfcm9vdCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cGVuZGluZ19yZXZpZXdfcmVxdWVzdCA9IG51bGw7XG5cdFx0XHRcdGVycm9yX2RhdGEgPSBmYWlsZWRfcmVxdWVzdCAmJiBmYWlsZWRfcmVxdWVzdC5yZXNwb25zZUpTT04gPyBmYWlsZWRfcmVxdWVzdC5yZXNwb25zZUpTT04uZGF0YSA6IG51bGw7XG5cdFx0XHRcdGlmICggcmV2aWV3X2J1dHRvbiApIHtcblx0XHRcdFx0XHRyZXZpZXdfYnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG5cdFx0XHRcdFx0cmV2aWV3X2J1dHRvbi5yZW1vdmVBdHRyaWJ1dGUoICdhcmlhLWJ1c3knICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBlcnJvcl9kYXRhICYmIGVycm9yX2RhdGEuZmFsbGJhY2sgJiYgZXJyb3JfZGF0YS5mYWxsYmFjay51cmwgKSB7XG5cdFx0XHRcdFx0YWN0aXZlX2ZhbGxiYWNrX3VybCA9IGVycm9yX2RhdGEuZmFsbGJhY2sudXJsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGhhc19maWVsZF9lcnJvcnMgPSByZW5kZXJfcmV2aWV3X2Vycm9ycyggZXJyb3JfZGF0YSApO1xuXHRcdFx0XHRpZiAoICEgaGFzX2ZpZWxkX2Vycm9ycyApIHtcblx0XHRcdFx0XHRyZW5kZXJfY29zdCggeyBzdGF0dXM6ICd1bmF2YWlsYWJsZScsIG1lc3NhZ2U6IGVycm9yX2RhdGEgJiYgZXJyb3JfZGF0YS5tZXNzYWdlID8gZXJyb3JfZGF0YS5tZXNzYWdlIDogaTE4bi5yZXZpZXdfZmFpbGVkIHx8ICcnLCBsaW5lX2l0ZW1zOiBbXSB9LCBlcnJvcl9kYXRhID8gZXJyb3JfZGF0YS5mYWxsYmFjayA6IG51bGwgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBmcm9tIHNpZ25lZCBSZXZpZXcgdG8gdGhlIGV4YWN0IHJldGFpbmVkIGVkaXRpbmcgZHJhZnQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNhbmNlbF9yZXZpZXcoKSB7XG5cdFx0XHR2YXIgcmV2aWV3X2J1dHRvbjtcblxuXHRcdFx0aWYgKCAncmV2aWV3JyAhPT0gc3RhdGUgfHwgISBhY3RpdmVfY29udGVudF9yb290ICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGFjdGl2ZV9yZXZpZXdfcm9vdCAmJiBhY3RpdmVfcmV2aWV3X3Jvb3QucGFyZW50Tm9kZSApIHtcblx0XHRcdFx0YWN0aXZlX3Jldmlld19yb290LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoIGFjdGl2ZV9yZXZpZXdfcm9vdCApO1xuXHRcdFx0fVxuXHRcdFx0YWN0aXZlX3Jldmlld19yb290ID0gbnVsbDtcblx0XHRcdGFjdGl2ZV9yZXZpZXcgPSBudWxsO1xuXHRcdFx0YWN0aXZlX2NvbnRlbnRfcm9vdC5oaWRkZW4gPSBmYWxzZTtcblx0XHRcdHRyYW5zaXRpb24oICdlZGl0aW5nJyApO1xuXHRcdFx0cmV2aWV3X2J1dHRvbiA9IGFjdGl2ZV9jb250ZW50X3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLXJldmlld10nICk7XG5cdFx0XHRpZiAoIHJldmlld19idXR0b24gKSB7XG5cdFx0XHRcdHJldmlld19idXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcblx0XHRcdFx0cmV2aWV3X2J1dHRvbi5yZW1vdmVBdHRyaWJ1dGUoICdhcmlhLWJ1c3knICk7XG5cdFx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHJldmlld19idXR0b24uZm9jdXMgKSB7XG5cdFx0XHRcdFx0cmV2aWV3X2J1dHRvbi5mb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQXBwbHkgdGhlIGV4YWN0IHNpZ25lZCBSZXZpZXcgdGhyb3VnaCB0aGUgaWRlbXBvdGVudCBzZXJ2ZXIgYm91bmRhcnkuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGFwcGx5X3JldmlldygpIHtcblx0XHRcdHZhciBhcHBseV9idXR0b247XG5cdFx0XHR2YXIgYXBwbHlfbWVzc2FnZTtcblx0XHRcdHZhciBwcmV2aW91c19hcHBseV9tZXNzYWdlO1xuXHRcdFx0dmFyIHJlcXVlc3RfdmFsdWVzO1xuXHRcdFx0dmFyIGN1cnJlbnRfZ2VuZXJhdGlvbjtcblxuXHRcdFx0aWYgKCAncmV2aWV3JyAhPT0gc3RhdGUgfHwgISBhY3RpdmVfcmV2aWV3IHx8ICEgYWN0aXZlX3Jldmlld19yb290ICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyZXF1ZXN0X3ZhbHVlcyA9IHtcblx0XHRcdFx0c2NoZW1hX3ZlcnNpb246IGNvbmZpZ3VyYXRpb24uc2NoZW1hX3ZlcnNpb24sXG5cdFx0XHRcdHJlcXVlc3RfaWQ6IGNyZWF0ZV9yZXF1ZXN0X2lkKCksXG5cdFx0XHRcdHBsYW46IGFjdGl2ZV9yZXZpZXcucGxhbixcblx0XHRcdFx0dG9rZW46IGFjdGl2ZV9yZXZpZXcudG9rZW4sXG5cdFx0XHRcdGlkZW1wb3RlbmN5X2tleTogYWN0aXZlX3Jldmlldy5pZGVtcG90ZW5jeV9rZXlcblx0XHRcdH07XG5cdFx0XHRhcHBseV9yZXF1ZXN0X2dlbmVyYXRpb24gKz0gMTtcblx0XHRcdGN1cnJlbnRfZ2VuZXJhdGlvbiA9IGFwcGx5X3JlcXVlc3RfZ2VuZXJhdGlvbjtcblx0XHRcdGFwcGx5X2J1dHRvbiA9IGFjdGl2ZV9yZXZpZXdfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItY3JlYXRlXScgKTtcblx0XHRcdGlmICggYXBwbHlfYnV0dG9uICkge1xuXHRcdFx0XHRhcHBseV9idXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuXHRcdFx0XHRhcHBseV9idXR0b24uc2V0QXR0cmlidXRlKCAnYXJpYS1idXN5JywgJ3RydWUnICk7XG5cdFx0XHR9XG5cdFx0XHRwcmV2aW91c19hcHBseV9tZXNzYWdlID0gYWN0aXZlX3Jldmlld19yb290LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19ib29raW5nX25ld19pbnNwZWN0b3JfX2FwcGx5X3N0YXR1cycgKTtcblx0XHRcdGlmICggcHJldmlvdXNfYXBwbHlfbWVzc2FnZSApIHtcblx0XHRcdFx0cHJldmlvdXNfYXBwbHlfbWVzc2FnZS5yZW1vdmUoKTtcblx0XHRcdH1cblx0XHRcdGFwcGx5X21lc3NhZ2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAncCcgKTtcblx0XHRcdGFwcGx5X21lc3NhZ2UuY2xhc3NOYW1lID0gJ3dwYmNfYm9va2luZ19uZXdfaW5zcGVjdG9yX19hcHBseV9zdGF0dXMnO1xuXHRcdFx0YXBwbHlfbWVzc2FnZS5zZXRBdHRyaWJ1dGUoICdyb2xlJywgJ3N0YXR1cycgKTtcblx0XHRcdGFwcGx5X21lc3NhZ2UudGV4dENvbnRlbnQgPSBpMThuLmNyZWF0aW5nX2Jvb2tpbmcgfHwgJyc7XG5cdFx0XHRhY3RpdmVfcmV2aWV3X3Jvb3QucXVlcnlTZWxlY3RvciggJy53cGJjX2Jvb2tpbmdfbmV3X2luc3BlY3Rvcl9fZm9vdGVyX2FjdGlvbnMnICkuaW5zZXJ0QmVmb3JlKCBhcHBseV9tZXNzYWdlLCBhY3RpdmVfcmV2aWV3X3Jvb3QucXVlcnlTZWxlY3RvciggJy53cGJjX2Jvb2tpbmdfbmV3X2luc3BlY3Rvcl9fZm9vdGVyX2FjdGlvbnMnICkuZmlyc3RDaGlsZCApO1xuXHRcdFx0aWYgKCAhIHRyYW5zaXRpb24oICdhcHBseWluZycgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRwZW5kaW5nX2FwcGx5X3JlcXVlc3QgPSAkLmFqYXgoIHtcblx0XHRcdFx0dXJsOiB0cmFuc3BvcnQudXJsLFxuXHRcdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdFx0ZGF0YVR5cGU6ICdqc29uJyxcblx0XHRcdFx0ZGF0YToge1xuXHRcdFx0XHRcdGFjdGlvbjogdHJhbnNwb3J0LmFwcGx5X2FjdGlvbixcblx0XHRcdFx0XHRub25jZTogdHJhbnNwb3J0LmFwcGx5X25vbmNlLFxuXHRcdFx0XHRcdHJlcXVlc3Q6IEpTT04uc3RyaW5naWZ5KCByZXF1ZXN0X3ZhbHVlcyApXG5cdFx0XHRcdH1cblx0XHRcdH0gKS5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0XHR2YXIgcmVzcG9uc2VfZGF0YSA9IHJlc3BvbnNlICYmIHRydWUgPT09IHJlc3BvbnNlLnN1Y2Nlc3MgPyByZXNwb25zZS5kYXRhIDogbnVsbDtcblx0XHRcdFx0dmFyIGNyZWF0ZWRfc3RhdHVzO1xuXHRcdFx0XHR2YXIgcmVhZGJhY2tfc3RhdHVzO1xuXHRcdFx0XHR2YXIgcmVhZGJhY2tfcmV0cnk7XG5cblx0XHRcdFx0aWYgKCBjdXJyZW50X2dlbmVyYXRpb24gIT09IGFwcGx5X3JlcXVlc3RfZ2VuZXJhdGlvbiB8fCAhIHJlc3BvbnNlX2RhdGEgfHwgcmVxdWVzdF92YWx1ZXMucmVxdWVzdF9pZCAhPT0gcmVzcG9uc2VfZGF0YS5yZXF1ZXN0X2lkIHx8ICdjcmVhdGVkJyAhPT0gcmVzcG9uc2VfZGF0YS5zdGF0ZSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cGVuZGluZ19hcHBseV9yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdFx0aWYgKCAhIHRyYW5zaXRpb24oICdjcmVhdGVkJyApICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjcmVhdGVkX2Jvb2tpbmdfaWQgPSBNYXRoLm1heCggMCwgTWF0aC5yb3VuZCggTnVtYmVyKCByZXNwb25zZV9kYXRhLmJvb2tpbmcgJiYgcmVzcG9uc2VfZGF0YS5ib29raW5nLmJvb2tpbmdfaWQgKSB8fCAwICkgKTtcblx0XHRcdFx0YWN0aXZlX3Jldmlld19yb290LnJlbW92ZSgpO1xuXHRcdFx0XHRhY3RpdmVfcmV2aWV3X3Jvb3QgPSBudWxsO1xuXHRcdFx0XHRhY3RpdmVfcmV2aWV3ID0gbnVsbDtcblx0XHRcdFx0aWYgKCBzY2hlZHVsZV93b3JrZmxvdyApIHtcblx0XHRcdFx0XHRzY2hlZHVsZV93b3JrZmxvdy5kZXN0cm95KCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2NoZWR1bGVfd29ya2Zsb3cgPSBudWxsO1xuXHRcdFx0XHRpZiAoIGFjdGl2ZV9jb250ZW50X3Jvb3QgJiYgYWN0aXZlX2NvbnRlbnRfcm9vdC5wYXJlbnROb2RlICkge1xuXHRcdFx0XHRcdGFjdGl2ZV9jb250ZW50X3Jvb3QucmVtb3ZlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YWN0aXZlX2NvbnRlbnRfcm9vdCA9IG51bGw7XG5cdFx0XHRcdGN1c3RvbWVyX2ZpZWxkX2Jhc2VsaW5lID0gbnVsbDtcblx0XHRcdFx0bm90ZV9iYXNlbGluZSA9IG51bGw7XG5cdFx0XHRcdHNjaGVkdWxlX2lucHV0X2RpcnR5ID0gZmFsc2U7XG5cdFx0XHRcdHNoZWxsX3Jvb3Quc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1kaXJ0eScsICdmYWxzZScgKTtcblx0XHRcdFx0c2hhcmVkX2NvbnRlbnRfcm9vdC5pbnNlcnRBZGphY2VudEhUTUwoICdiZWZvcmVlbmQnLCBjcmVhdGVkX3RlbXBsYXRlKCB7XG5cdFx0XHRcdFx0Ym9va2luZzogcmVzcG9uc2VfZGF0YS5ib29raW5nIHx8IHt9LFxuXHRcdFx0XHRcdHdhcm5pbmdzOiByZXNwb25zZV9kYXRhLndhcm5pbmdzIHx8IFtdLFxuXHRcdFx0XHRcdGkxOG46IGkxOG5cblx0XHRcdFx0fSApICk7XG5cdFx0XHRcdGNyZWF0ZWRfc3RhdHVzID0gc2hhcmVkX2NvbnRlbnRfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItY3JlYXRlZC1zdGF0dXNdJyApO1xuXHRcdFx0XHRpZiAoIGNyZWF0ZWRfc3RhdHVzICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBjcmVhdGVkX3N0YXR1cy5mb2N1cyApIHtcblx0XHRcdFx0XHRjcmVhdGVkX3N0YXR1cy5mb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggISByZXF1ZXN0X3RpbWVsaW5lX3JlYWRiYWNrKCByZXNwb25zZV9kYXRhICkgKSB7XG5cdFx0XHRcdFx0cmVhZGJhY2tfc3RhdHVzID0gc2hhcmVkX2NvbnRlbnRfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItcmVhZGJhY2stc3RhdHVzXScgKTtcblx0XHRcdFx0XHRyZWFkYmFja19yZXRyeSA9IHNoYXJlZF9jb250ZW50X3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLXJlYWRiYWNrLXJldHJ5XScgKTtcblx0XHRcdFx0XHRpZiAoIHJlYWRiYWNrX3N0YXR1cyApIHtcblx0XHRcdFx0XHRcdHJlYWRiYWNrX3N0YXR1cy5zZXRBdHRyaWJ1dGUoICdyb2xlJywgJ2FsZXJ0JyApO1xuXHRcdFx0XHRcdFx0cmVhZGJhY2tfc3RhdHVzLnRleHRDb250ZW50ID0gaTE4bi50aW1lbGluZV9yZWZyZXNoX2ZhaWxlZCB8fCAnJztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCByZWFkYmFja19yZXRyeSApIHtcblx0XHRcdFx0XHRcdHJlYWRiYWNrX3JldHJ5LmhpZGRlbiA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCBmYWlsZWRfcmVxdWVzdCwgcmVxdWVzdF9zdGF0dXMgKSB7XG5cdFx0XHRcdHZhciBlcnJvcl9kYXRhO1xuXG5cdFx0XHRcdGlmICggJ2Fib3J0JyA9PT0gcmVxdWVzdF9zdGF0dXMgfHwgY3VycmVudF9nZW5lcmF0aW9uICE9PSBhcHBseV9yZXF1ZXN0X2dlbmVyYXRpb24gfHwgISBhY3RpdmVfcmV2aWV3X3Jvb3QgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHBlbmRpbmdfYXBwbHlfcmVxdWVzdCA9IG51bGw7XG5cdFx0XHRcdGVycm9yX2RhdGEgPSBmYWlsZWRfcmVxdWVzdCAmJiBmYWlsZWRfcmVxdWVzdC5yZXNwb25zZUpTT04gPyBmYWlsZWRfcmVxdWVzdC5yZXNwb25zZUpTT04uZGF0YSA6IG51bGw7XG5cdFx0XHRcdHRyYW5zaXRpb24oICdlcnJvcicgKTtcblx0XHRcdFx0aWYgKCBlcnJvcl9kYXRhICYmICdlZGl0aW5nJyA9PT0gZXJyb3JfZGF0YS5yZXRyeV9zdGF0ZSApIHtcblx0XHRcdFx0XHRhY3RpdmVfcmV2aWV3X3Jvb3QucmVtb3ZlKCk7XG5cdFx0XHRcdFx0YWN0aXZlX3Jldmlld19yb290ID0gbnVsbDtcblx0XHRcdFx0XHRhY3RpdmVfcmV2aWV3ID0gbnVsbDtcblx0XHRcdFx0XHRhY3RpdmVfY29udGVudF9yb290LmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0XHRcdHRyYW5zaXRpb24oICdlZGl0aW5nJyApO1xuXHRcdFx0XHRcdHJldmlld19idXR0b24gPSBhY3RpdmVfY29udGVudF9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1yZXZpZXddJyApO1xuXHRcdFx0XHRcdGlmICggcmV2aWV3X2J1dHRvbiApIHtcblx0XHRcdFx0XHRcdHJldmlld19idXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRcdHJldmlld19idXR0b24ucmVtb3ZlQXR0cmlidXRlKCAnYXJpYS1idXN5JyApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZW5kZXJfcmV2aWV3X2Vycm9ycyggZXJyb3JfZGF0YSwgcmV2aWV3X2J1dHRvbiApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0cmFuc2l0aW9uKCAncmV2aWV3JyApO1xuXHRcdFx0XHRpZiAoIGFwcGx5X21lc3NhZ2UgKSB7XG5cdFx0XHRcdFx0YXBwbHlfbWVzc2FnZS5zZXRBdHRyaWJ1dGUoICdyb2xlJywgJ2FsZXJ0JyApO1xuXHRcdFx0XHRcdGFwcGx5X21lc3NhZ2UudGV4dENvbnRlbnQgPSBlcnJvcl9kYXRhICYmIGVycm9yX2RhdGEubWVzc2FnZSA/IGVycm9yX2RhdGEubWVzc2FnZSA6IGkxOG4uY3JlYXRlX2ZhaWxlZCB8fCAnJztcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGFwcGx5X2J1dHRvbiApIHtcblx0XHRcdFx0XHRhcHBseV9idXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRhcHBseV9idXR0b24ucmVtb3ZlQXR0cmlidXRlKCAnYXJpYS1idXN5JyApO1xuXHRcdFx0XHRcdGFwcGx5X2J1dHRvbi5mb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3RhcnQgdGhlIGV4aXN0aW5nIFBoYXNlIDQgcmVhZC1vbmx5IHNjaGVkdWxlIGFuZCBuYXRpdmUtY2FsZW5kYXIgd29ya2Zsb3cuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gYm9vdHN0cmFwICAgICAgICAgICAgQXV0aG9yaXplZCBib290c3RyYXAgRFRPLlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBsYXVuY2hfcmVxdWVzdCAgICAgICBWYWxpZGF0ZWQgYm9vdHN0cmFwIGxhdW5jaCBlbnZlbG9wZS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICBjYWxlbmRhcl9hbmNob3JfZGF0ZSBQcmVzZW50YXRpb24tb25seSBtb250aCBhbmNob3IgcmV0YWluZWQgYWNyb3NzIGEgUmVzb3VyY2UvZm9ybSByZWxvYWQuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R8bnVsbH0gc2NoZWR1bGVfZHJhZnQgICAgICAgU2VydmVyLXJldmFsaWRhdGVkIHNjaGVkdWxlIHByb3Bvc2FsIHJldGFpbmVkIGFjcm9zcyB0aGUgcmVsb2FkLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3RhcnRfc2NoZWR1bGVfd29ya2Zsb3coIGJvb3RzdHJhcCwgbGF1bmNoX3JlcXVlc3QsIGNhbGVuZGFyX2FuY2hvcl9kYXRlLCBzY2hlZHVsZV9kcmFmdCApIHtcblx0XHRcdHZhciBkYXRlc19ob3N0ID0gYWN0aXZlX2NvbnRlbnRfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItZGF0ZXMtaG9zdF0nICk7XG5cdFx0XHR2YXIgc2NoZWR1bGVfcmVxdWVzdCA9IHtcblx0XHRcdFx0c2NoZW1hX3ZlcnNpb246IGNvbmZpZ3VyYXRpb24uc2NoZW1hX3ZlcnNpb24sXG5cdFx0XHRcdHJlcXVlc3RfaWQ6IGNyZWF0ZV9yZXF1ZXN0X2lkKCksXG5cdFx0XHRcdHNlbGVjdGlvbl9zb3VyY2U6IGxhdW5jaF9yZXF1ZXN0LnNlbGVjdGlvbl9zb3VyY2UsXG5cdFx0XHRcdHJlc291cmNlX2lkOiBib290c3RyYXAuc2VsZWN0ZWRfcmVzb3VyY2VfaWQsXG5cdFx0XHRcdGZvcm1faWQ6IGJvb3RzdHJhcC5zZWxlY3RlZF9mb3JtX2lkXG5cdFx0XHR9O1xuXG5cdFx0XHRpZiAoIGxhdW5jaF9yZXF1ZXN0LnNvdXJjZV9jb250ZXh0X3Rva2VuICkge1xuXHRcdFx0XHRzY2hlZHVsZV9yZXF1ZXN0LnNvdXJjZV9jb250ZXh0X3Rva2VuID0gbGF1bmNoX3JlcXVlc3Quc291cmNlX2NvbnRleHRfdG9rZW47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIC9eXFxkezR9LVxcZHsyfS1cXGR7Mn0kLy50ZXN0KCBTdHJpbmcoIGNhbGVuZGFyX2FuY2hvcl9kYXRlIHx8ICcnICkgKSApIHtcblx0XHRcdFx0c2NoZWR1bGVfcmVxdWVzdC5jYWxlbmRhcl9hbmNob3JfZGF0ZSA9IFN0cmluZyggY2FsZW5kYXJfYW5jaG9yX2RhdGUgKTtcblx0XHRcdH1cblx0XHRcdGlmICggJ2VtcHR5JyA9PT0gbGF1bmNoX3JlcXVlc3Quc2VsZWN0aW9uX3NvdXJjZSAmJiBzY2hlZHVsZV9kcmFmdCApIHtcblx0XHRcdFx0c2NoZWR1bGVfcmVxdWVzdC5zY2hlZHVsZSA9IHNjaGVkdWxlX2RyYWZ0O1xuXHRcdFx0fVxuXHRcdFx0c2NoZWR1bGVfd29ya2Zsb3cgPSB3aW5kb3cud3BiY19ib29raW5nX25ld19pbnNwZWN0b3IuY3JlYXRlX3NjaGVkdWxlX3dvcmtmbG93KCB7XG5cdFx0XHRcdHJvb3Q6IGFjdGl2ZV9jb250ZW50X3Jvb3QsXG5cdFx0XHRcdGFqYXhfdXJsOiB0cmFuc3BvcnQudXJsLFxuXHRcdFx0XHRhY3Rpb246IHRyYW5zcG9ydC5zY2hlZHVsZV9hY3Rpb24sXG5cdFx0XHRcdG5vbmNlOiB0cmFuc3BvcnQuc2NoZWR1bGVfbm9uY2UsXG5cdFx0XHRcdGdldF9jYWxlbmRhcl9ob3N0OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGFjdGl2ZV9jb250ZW50X3Jvb3QgPyBhY3RpdmVfY29udGVudF9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1jYWxlbmRhci1ob3N0XScgKSA6IG51bGw7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdG9uX3JlYWR5OiBmdW5jdGlvbiAoIHNjaGVkdWxlX2NvbnRleHQgKSB7XG5cdFx0XHRcdFx0aWYgKCAhIGRhdGVzX2hvc3QgfHwgISBhY3RpdmVfY29udGVudF9yb290ICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRkYXRlc19ob3N0LmlubmVySFRNTCA9IGRhdGVzX3RlbXBsYXRlKCB7XG5cdFx0XHRcdFx0XHRzY2hlZHVsZTogc2NoZWR1bGVfY29udGV4dC5zY2hlZHVsZSB8fCB7fSxcblx0XHRcdFx0XHRcdGNob2ljZXM6IHNjaGVkdWxlX2NvbnRleHQuY2hvaWNlcyB8fCB7fSxcblx0XHRcdFx0XHRcdGkxOG46IGkxOG5cblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0c2V0X3NjaGVkdWxlX2Vycm9yKCBmYWxzZSApO1xuXHRcdFx0XHRcdHNjaGVkdWxlX2lucHV0X2RpcnR5ID0gZmFsc2U7XG5cdFx0XHRcdFx0c2V0X3NjaGVkdWxlX2xvYWRpbmcoIHRydWUgKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0b25fY2hhbmdlOiBzeW5jaHJvbml6ZV9zY2hlZHVsZSxcblx0XHRcdFx0b25fbG9hZGluZzogc2V0X3NjaGVkdWxlX2xvYWRpbmcsXG5cdFx0XHRcdG9uX2Vycm9yOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0c2V0X3NjaGVkdWxlX2xvYWRpbmcoIGZhbHNlICk7XG5cdFx0XHRcdFx0c2V0X3NjaGVkdWxlX2Vycm9yKCB0cnVlICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdGlmICggISBzY2hlZHVsZV93b3JrZmxvdyB8fCAhIHNjaGVkdWxlX3dvcmtmbG93LmxvYWQoIHNjaGVkdWxlX3JlcXVlc3QgKSApIHtcblx0XHRcdFx0c2V0X3NjaGVkdWxlX2xvYWRpbmcoIGZhbHNlICk7XG5cdFx0XHRcdHNldF9zY2hlZHVsZV9lcnJvciggdHJ1ZSApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbmRlciBhdXRob3JpemVkIGVkaXRpbmcgRFRPcyB0aHJvdWdoIGRvbWFpbi1vd25lZCB0ZW1wbGF0ZXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gYm9vdHN0cmFwICAgICAgICAgICAgQXV0aG9yaXplZCBib290c3RyYXAgcmVzcG9uc2UuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGxhdW5jaF9yZXF1ZXN0ICAgICAgIFZhbGlkYXRlZCBib290c3RyYXAgbGF1bmNoIGVudmVsb3BlLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgICAgIGNhbGVuZGFyX2FuY2hvcl9kYXRlIFByZXNlbnRhdGlvbi1vbmx5IG1vbnRoIGFuY2hvciByZXRhaW5lZCBhY3Jvc3MgYSBSZXNvdXJjZS9mb3JtIHJlbG9hZC5cblx0XHQgKiBAcGFyYW0ge09iamVjdHxudWxsfSBzY2hlZHVsZV9kcmFmdCAgICAgICBTZXJ2ZXItcmV2YWxpZGF0ZWQgc2NoZWR1bGUgcHJvcG9zYWwgcmV0YWluZWQgYWNyb3NzIHRoZSByZWxvYWQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZW5kZXJfZWRpdGluZyggYm9vdHN0cmFwLCBsYXVuY2hfcmVxdWVzdCwgY2FsZW5kYXJfYW5jaG9yX2RhdGUsIHNjaGVkdWxlX2RyYWZ0ICkge1xuXHRcdFx0dmFyIGNvbnRlbnRfcm9vdDtcblx0XHRcdHZhciByZXNvdXJjZV9ob3N0O1xuXHRcdFx0dmFyIGZpZWxkc19ob3N0O1xuXHRcdFx0dmFyIGZpZWxkc19jb250YWluZXI7XG5cdFx0XHR2YXIgbm90ZXNfaG9zdDtcblx0XHRcdHZhciBkYXRlc19ob3N0O1xuXHRcdFx0dmFyIGNvc3RzX2hvc3Q7XG5cdFx0XHR2YXIgZm9vdGVyX2hvc3Q7XG5cblx0XHRcdGlmICggYm9vdHN0cmFwLnN1cHBvcnQgJiYgJ3Vuc3VwcG9ydGVkJyA9PT0gYm9vdHN0cmFwLnN1cHBvcnQuc3RhdHVzICkge1xuXHRcdFx0XHRhY3RpdmVfZmFsbGJhY2tfdXJsID0gYm9vdHN0cmFwLmZhbGxiYWNrICYmIGJvb3RzdHJhcC5mYWxsYmFjay51cmwgPyBib290c3RyYXAuZmFsbGJhY2sudXJsIDogYWN0aXZlX2ZhbGxiYWNrX3VybDtcblx0XHRcdFx0c2hhcmVkX2luc3BlY3Rvci5zZXRfY29udGVudCggdW5zdXBwb3J0ZWRfdGVtcGxhdGUoIHtcblx0XHRcdFx0XHRpMThuOiBpMThuLFxuXHRcdFx0XHRcdHN1cHBvcnQ6IGJvb3RzdHJhcC5zdXBwb3J0LFxuXHRcdFx0XHRcdGZhbGxiYWNrOiBib290c3RyYXAuZmFsbGJhY2ssXG5cdFx0XHRcdFx0Y2Fub25pY2FsX3VybDogY29uZmlndXJhdGlvbi5jYW5vbmljYWxfdXJsIHx8ICcnXG5cdFx0XHRcdH0gKSwgaTE4bi5sb2FkZWQgfHwgJycgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIGJvb3RzdHJhcC5yZXNvdXJjZXMgfHwgISBib290c3RyYXAucmVzb3VyY2VzLmxlbmd0aCB8fCAhIGJvb3RzdHJhcC5mb3JtcyB8fCAhIGJvb3RzdHJhcC5mb3Jtcy5sZW5ndGggKSB7XG5cdFx0XHRcdHJlbmRlcl9zdGF0ZSggJ2VtcHR5JywgaTE4bi5lbXB0eV90aXRsZSB8fCAnJywgaTE4bi5lbXB0eV9tZXNzYWdlIHx8ICcnLCBmYWxzZSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHNoYXJlZF9pbnNwZWN0b3Iuc2V0X2NvbnRlbnQoIHNoZWxsX3RlbXBsYXRlKCB7fSApLCBpMThuLmxvYWRlZCB8fCAnJyApO1xuXHRcdFx0YWN0aXZlX2NvbnRlbnRfcm9vdCA9IHNoZWxsX3Jvb3QucXVlcnlTZWxlY3RvciggJy53cGJjX2Jvb2tpbmdfbmV3X2luc3BlY3RvcicgKTtcblx0XHRcdGFjdGl2ZV9ib290c3RyYXAgPSBib290c3RyYXA7XG5cdFx0XHRkcmFmdF9yZXZpc2lvbiA9IDA7XG5cdFx0XHRzY2hlZHVsZV9yZWFkeSA9IGZhbHNlO1xuXHRcdFx0Y29zdF9jb3JyZWN0aW9uID0gJyc7XG5cdFx0XHRjb250ZW50X3Jvb3QgPSBhY3RpdmVfY29udGVudF9yb290O1xuXHRcdFx0aWYgKCAhIGFjdGl2ZV9jb250ZW50X3Jvb3QgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0cmVzb3VyY2VfaG9zdCA9IGNvbnRlbnRfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItcmVzb3VyY2UtaG9zdF0nICk7XG5cdFx0XHRmaWVsZHNfaG9zdCA9IGNvbnRlbnRfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItZmllbGRzLWhvc3RdJyApO1xuXHRcdFx0bm90ZXNfaG9zdCA9IGNvbnRlbnRfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3Itbm90ZXMtaG9zdF0nICk7XG5cdFx0XHRkYXRlc19ob3N0ID0gY29udGVudF9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1kYXRlcy1ob3N0XScgKTtcblx0XHRcdGNvc3RzX2hvc3QgPSBjb250ZW50X3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLWNvc3RzLWhvc3RdJyApO1xuXHRcdFx0Zm9vdGVyX2hvc3QgPSBjb250ZW50X3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLWZvb3Rlci1ob3N0XScgKTtcblx0XHRcdHJlc291cmNlX2hvc3QuaW5uZXJIVE1MID0gcmVzb3VyY2VfdGVtcGxhdGUoIHsgcmVzb3VyY2VzOiBib290c3RyYXAucmVzb3VyY2VzIHx8IFtdLCBmb3JtczogYm9vdHN0cmFwLmZvcm1zIHx8IFtdLCBpMThuOiBpMThuIH0gKTtcblx0XHRcdGZpZWxkc19ob3N0LmlubmVySFRNTCA9IGZpZWxkc190ZW1wbGF0ZSggeyBmaWVsZHM6IGJvb3RzdHJhcC5maWVsZHMgfHwgW10sIGkxOG46IGkxOG4gfSApO1xuXHRcdFx0ZmllbGRzX2NvbnRhaW5lciA9IGZpZWxkc19ob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1maWVsZHNdJyApO1xuXHRcdFx0aWYgKCBmaWVsZHNfY29udGFpbmVyICkge1xuXHRcdFx0XHQoIGJvb3RzdHJhcC5maWVsZHMgfHwgW10gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGZpZWxkLCBmaWVsZF9pbmRleCApIHtcblx0XHRcdFx0XHR2YXIgZmllbGRfdmlldyA9IE9iamVjdC5hc3NpZ24oIHt9LCBmaWVsZCApO1xuXHRcdFx0XHRcdGZpZWxkX3ZpZXcuZmllbGRfaWQgPSAnd3BiY19ib29raW5nX25ld19pbnNwZWN0b3JfZmllbGRfJyArIGZpZWxkX2luZGV4O1xuXHRcdFx0XHRcdGZpZWxkX3ZpZXcuZXJyb3JfaWQgPSBmaWVsZF92aWV3LmZpZWxkX2lkICsgJ19lcnJvcic7XG5cdFx0XHRcdFx0ZmllbGRzX2NvbnRhaW5lci5pbnNlcnRBZGphY2VudEhUTUwoICdiZWZvcmVlbmQnLCBmaWVsZF90ZW1wbGF0ZSggZmllbGRfdmlldyApICk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblx0XHRcdGN1c3RvbWVyX2ZpZWxkX2Jhc2VsaW5lID0gSlNPTi5zdHJpbmdpZnkoIGdldF9jdXN0b21lcl9maWVsZF9zbmFwc2hvdCggYWN0aXZlX2NvbnRlbnRfcm9vdCApICk7XG5cdFx0XHRub3Rlc19ob3N0LmlubmVySFRNTCA9IG5vdGVzX3RlbXBsYXRlKCB7IG5vdGVzOiBib290c3RyYXAubm90ZXMgfHwgW10sIGkxOG46IGkxOG4gfSApO1xuXHRcdFx0bm90ZV9iYXNlbGluZSA9IEpTT04uc3RyaW5naWZ5KCBnZXRfbm90ZV9zbmFwc2hvdCggYWN0aXZlX2NvbnRlbnRfcm9vdCApICk7XG5cdFx0XHR1cGRhdGVfZGlydHlfc3RhdGUoKTtcblx0XHRcdGRhdGVzX2hvc3QuaW5uZXJIVE1MID0gZGF0ZXNfdGVtcGxhdGUoIHsgc2NoZWR1bGU6IGJvb3RzdHJhcC5zY2hlZHVsZSB8fCB7fSwgY2hvaWNlczoge30sIGkxOG46IGkxOG4gfSApO1xuXHRcdFx0cmVuZGVyX2Nvc3QoIGJvb3RzdHJhcC5jb3N0IHx8IHt9LCBudWxsICk7XG5cdFx0XHRmb290ZXJfaG9zdC5pbm5lckhUTUwgPSBmb290ZXJfdGVtcGxhdGUoIHsgdXJsOiBhY3RpdmVfZmFsbGJhY2tfdXJsLCBpMThuOiBpMThuIH0gKTtcblx0XHRcdHN0YXJ0X3NjaGVkdWxlX3dvcmtmbG93KCBib290c3RyYXAsIGxhdW5jaF9yZXF1ZXN0LCBjYWxlbmRhcl9hbmNob3JfZGF0ZSwgc2NoZWR1bGVfZHJhZnQgKTtcblxuXHRcdFx0Y29udGVudF9yb290LmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0XHR2YXIgcmVzb3VyY2Vfc2VsZWN0ID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1yZXNvdXJjZV0nICk7XG5cdFx0XHRcdHZhciBmb3JtX3NlbGVjdCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItZm9ybV0nICk7XG5cdFx0XHRcdHZhciBzZWxlY3RlZF9yZXNvdXJjZSA9IGNvbnRlbnRfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItcmVzb3VyY2VdJyApO1xuXHRcdFx0XHR2YXIgc2VsZWN0aW9uX21ldGhvZCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3Itc2VsZWN0aW9uLW1ldGhvZF0nICk7XG5cdFx0XHRcdHZhciB0aW1lX2FwcGxpY2F0aW9uID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci10aW1lLWFwcGxpY2F0aW9uXScgKTtcblx0XHRcdFx0dmFyIHN0YXJ0X3RpbWUgPSBjb250ZW50X3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLXN0YXJ0LXRpbWVdJyApO1xuXHRcdFx0XHR2YXIgZW5kX3RpbWUgPSBjb250ZW50X3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLWVuZC10aW1lXScgKTtcblx0XHRcdFx0dmFyIGN1c3RvbWVyX2ZpZWxkID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1maWVsZC1pbnB1dF0nICk7XG5cdFx0XHRcdHZhciBub3RlX2ZpZWxkID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1ub3RlXScgKTtcblx0XHRcdFx0dmFyIGNvc3RfY29ycmVjdGlvbl9pbnB1dCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItY29zdC1jb3JyZWN0aW9uXScgKTtcblxuXHRcdFx0XHRpZiAoIHJlc291cmNlX3NlbGVjdCApIHtcblx0XHRcdFx0XHR2YXIgcmVzb3VyY2VfY2FsZW5kYXJfYW5jaG9yX2RhdGUgPSBnZXRfc2NoZWR1bGVfY2FsZW5kYXJfYW5jaG9yX2RhdGUoIHNjaGVkdWxlX3dvcmtmbG93ICk7XG5cdFx0XHRcdFx0dmFyIHJlc291cmNlX3NjaGVkdWxlX2RyYWZ0ID0gZ2V0X3NjaGVkdWxlX3JlbG9hZF9kcmFmdCggc2NoZWR1bGVfd29ya2Zsb3cgKTtcblxuXHRcdFx0XHRcdGlmICggISBjb25maXJtX2Rpc2NhcmRfY2hhbmdlcygpICkge1xuXHRcdFx0XHRcdFx0cmVzb3VyY2Vfc2VsZWN0LnZhbHVlID0gU3RyaW5nKCBib290c3RyYXAuc2VsZWN0ZWRfcmVzb3VyY2VfaWQgfHwgJycgKTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YWN0aXZlX2ZhbGxiYWNrX3VybCA9IGNvbmZpZ3VyYXRpb24uY2Fub25pY2FsX3VybCB8fCAnJztcblx0XHRcdFx0XHRsb2FkKCB7IHJlc291cmNlX2lkOiByZXNvdXJjZV9zZWxlY3QudmFsdWUgfSwgeyBzZWxlY3Rpb25fc291cmNlOiAnZW1wdHknIH0sIHJlc291cmNlX2NhbGVuZGFyX2FuY2hvcl9kYXRlLCByZXNvdXJjZV9zY2hlZHVsZV9kcmFmdCApO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCBmb3JtX3NlbGVjdCApIHtcblx0XHRcdFx0XHR2YXIgZm9ybV9jYWxlbmRhcl9hbmNob3JfZGF0ZSA9IGdldF9zY2hlZHVsZV9jYWxlbmRhcl9hbmNob3JfZGF0ZSggc2NoZWR1bGVfd29ya2Zsb3cgKTtcblx0XHRcdFx0XHR2YXIgZm9ybV9zY2hlZHVsZV9kcmFmdCA9IGdldF9zY2hlZHVsZV9yZWxvYWRfZHJhZnQoIHNjaGVkdWxlX3dvcmtmbG93ICk7XG5cblx0XHRcdFx0XHRpZiAoICEgY29uZmlybV9kaXNjYXJkX2NoYW5nZXMoKSApIHtcblx0XHRcdFx0XHRcdGZvcm1fc2VsZWN0LnZhbHVlID0gU3RyaW5nKCBib290c3RyYXAuc2VsZWN0ZWRfZm9ybV9pZCB8fCAnJyApO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRhY3RpdmVfZmFsbGJhY2tfdXJsID0gY29uZmlndXJhdGlvbi5jYW5vbmljYWxfdXJsIHx8ICcnO1xuXHRcdFx0XHRcdGxvYWQoIHsgcmVzb3VyY2VfaWQ6IHNlbGVjdGVkX3Jlc291cmNlID8gc2VsZWN0ZWRfcmVzb3VyY2UudmFsdWUgOiAnJywgZm9ybV9pZDogZm9ybV9zZWxlY3QudmFsdWUgfSwgeyBzZWxlY3Rpb25fc291cmNlOiAnZW1wdHknIH0sIGZvcm1fY2FsZW5kYXJfYW5jaG9yX2RhdGUsIGZvcm1fc2NoZWR1bGVfZHJhZnQgKTtcblx0XHRcdFx0fSBlbHNlIGlmICggc2VsZWN0aW9uX21ldGhvZCAmJiBzY2hlZHVsZV93b3JrZmxvdyApIHtcblx0XHRcdFx0XHRzY2hlZHVsZV93b3JrZmxvdy5zZXRfc2VsZWN0aW9uX21ldGhvZCggc2VsZWN0aW9uX21ldGhvZC52YWx1ZSApO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCB0aW1lX2FwcGxpY2F0aW9uICYmIHNjaGVkdWxlX3dvcmtmbG93ICkge1xuXHRcdFx0XHRcdHNjaGVkdWxlX3dvcmtmbG93LnNldF90aW1lX2FwcGxpY2F0aW9uKCB0aW1lX2FwcGxpY2F0aW9uLnZhbHVlICk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoIHNjaGVkdWxlX3dvcmtmbG93ICYmICggZXZlbnQudGFyZ2V0ID09PSBzdGFydF90aW1lIHx8IGV2ZW50LnRhcmdldCA9PT0gZW5kX3RpbWUgKSApIHtcblx0XHRcdFx0XHR1cGRhdGVfc2NoZWR1bGVfdGltZXMoKTtcblx0XHRcdFx0fSBlbHNlIGlmICggY29zdF9jb3JyZWN0aW9uX2lucHV0ICkge1xuXHRcdFx0XHRcdGNvc3RfY29ycmVjdGlvbiA9IFN0cmluZyggY29zdF9jb3JyZWN0aW9uX2lucHV0LnZhbHVlIHx8ICcnICkudHJpbSgpO1xuXHRcdFx0XHRcdGludmFsaWRhdGVfY29zdF9wcmV2aWV3KCk7XG5cdFx0XHRcdFx0dXBkYXRlX2RpcnR5X3N0YXRlKCk7XG5cdFx0XHRcdFx0cXVldWVfY29zdF9wcmV2aWV3KCAyNTAgKTtcblx0XHRcdFx0fSBlbHNlIGlmICggY3VzdG9tZXJfZmllbGQgfHwgbm90ZV9maWVsZCApIHtcblx0XHRcdFx0XHRpZiAoIGN1c3RvbWVyX2ZpZWxkICkge1xuXHRcdFx0XHRcdFx0Y2xlYXJfY29udHJvbF9lcnJvciggY3VzdG9tZXJfZmllbGQgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aW52YWxpZGF0ZV9jb3N0X3ByZXZpZXcoKTtcblx0XHRcdFx0XHR1cGRhdGVfZGlydHlfc3RhdGUoKTtcblx0XHRcdFx0XHRxdWV1ZV9jb3N0X3ByZXZpZXcoIDI1MCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRjb250ZW50X3Jvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdFx0dmFyIGNvc3RfY29ycmVjdGlvbl9pbnB1dCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3ItY29zdC1jb3JyZWN0aW9uXScgKTtcblxuXHRcdFx0XHRpZiAoIGNvc3RfY29ycmVjdGlvbl9pbnB1dCApIHtcblx0XHRcdFx0XHRjb3N0X2NvcnJlY3Rpb24gPSBTdHJpbmcoIGNvc3RfY29ycmVjdGlvbl9pbnB1dC52YWx1ZSB8fCAnJyApLnRyaW0oKTtcblx0XHRcdFx0XHRpbnZhbGlkYXRlX2Nvc3RfcHJldmlldygpO1xuXHRcdFx0XHRcdHVwZGF0ZV9kaXJ0eV9zdGF0ZSgpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKFxuXHRcdFx0XHRcdGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3Itc3RhcnQtdGltZV0nIClcblx0XHRcdFx0XHR8fCBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLWVuZC10aW1lXScgKVxuXHRcdFx0XHQpIHtcblx0XHRcdFx0XHR1cGRhdGVfc2NoZWR1bGVfdGltZXMoKTtcblx0XHRcdFx0fSBlbHNlIGlmIChcblx0XHRcdFx0XHRldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLWZpZWxkLWlucHV0XScgKVxuXHRcdFx0XHRcdHx8IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1ib29raW5nLW5ldy1pbnNwZWN0b3Itbm90ZV0nIClcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0Y2xlYXJfY29udHJvbF9lcnJvciggZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1maWVsZC1pbnB1dF0nICkgKTtcblx0XHRcdFx0XHRpbnZhbGlkYXRlX2Nvc3RfcHJldmlldygpO1xuXHRcdFx0XHRcdHVwZGF0ZV9kaXJ0eV9zdGF0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRjb250ZW50X3Jvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdFx0aWYgKCBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLXNjaGVkdWxlLXJlc2V0XScgKSAmJiBzY2hlZHVsZV93b3JrZmxvdyApIHtcblx0XHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdHNjaGVkdWxlX3dvcmtmbG93LnJlc2V0KCk7XG5cdFx0XHRcdFx0c2NoZWR1bGVfaW5wdXRfZGlydHkgPSBmYWxzZTtcblx0XHRcdFx0XHR1cGRhdGVfZGlydHlfc3RhdGUoKTtcblx0XHRcdFx0fSBlbHNlIGlmICggZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1jb3N0LXByZXZpZXddJyApICkge1xuXHRcdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0cmVxdWVzdF9jb3N0X3ByZXZpZXcoKTtcblx0XHRcdFx0fSBlbHNlIGlmICggZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1kaXNtaXNzLWNvc3RdJyApICkge1xuXHRcdFx0XHRcdHZhciByZXZpZXdfYnV0dG9uID0gY29udGVudF9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1yZXZpZXddJyApO1xuXG5cdFx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0XHRjb3N0X3NlY3Rpb25fZGlzbWlzc2VkID0gdHJ1ZTtcblx0XHRcdFx0XHRyZW5kZXJfY29zdCgge30sIG51bGwgKTtcblx0XHRcdFx0XHRpZiAoIHJldmlld19idXR0b24gJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHJldmlld19idXR0b24uZm9jdXMgKSB7XG5cdFx0XHRcdFx0XHRyZXZpZXdfYnV0dG9uLmZvY3VzKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKCBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLXJldmlld10nICkgKSB7XG5cdFx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0XHRyZXF1ZXN0X3JldmlldygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTG9hZCBvbmUgYXV0aG9yaXplZCBib290c3RyYXAgdXNpbmcgYW4gZW1wdHkgb3Igc2lnbmVkIFRpbWVsaW5lIGxhdW5jaC5cblx0XHQgKlxuXHRcdCAqIFRoZSBlbXB0eSB0b3AtbmF2aWdhdGlvbiBsYXVuY2ggcGFzc2VzIG5vIFJlc291cmNlLCBmb3JtLCBkYXRlLCBvciB0aW1lLiBUaGUgc2VydmVyXG5cdFx0ICogc2VsZWN0cyB0aGUgYXV0aG9yaXplZCBkZWZhdWx0cy4gTGF0ZXIgc2VsZWN0IGNoYW5nZXMgbWF5IHNlbmQgb25seSB0aGVcblx0XHQgKiBjaG9zZW4gUmVzb3VyY2UvZm9ybSBpZGVudGl0aWVzIHBsdXMgYW4gb3B0aW9uYWwgYm91bmRlZCBzY2hlZHVsZSBwcm9wb3NhbFxuXHRcdCAqIGZvciBleGFjdCBzZXJ2ZXIgcmV2YWxpZGF0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGNob2ljZXMgICAgICAgICAgICAgICBPcHRpb25hbCBleHBsaWNpdCBSZXNvdXJjZS9mb3JtIGNob2ljZXMuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGxhdW5jaF9yZXF1ZXN0ICAgICAgICBWYWxpZGF0ZWQgYnJvd3NlciBsYXVuY2ggZW52ZWxvcGUuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9ICAgICAgY2FsZW5kYXJfYW5jaG9yX2RhdGUgT3B0aW9uYWwgcHJlc2VudGF0aW9uLW9ubHkgbW9udGggYW5jaG9yLlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fG51bGx9IHNjaGVkdWxlX2RyYWZ0ICAgICAgT3B0aW9uYWwgYm91bmRlZCBzY2hlZHVsZSBwcm9wb3NhbCBmb3IgYSBSZXNvdXJjZS9mb3JtIHJlbG9hZC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGxvYWQoIGNob2ljZXMsIGxhdW5jaF9yZXF1ZXN0LCBjYWxlbmRhcl9hbmNob3JfZGF0ZSwgc2NoZWR1bGVfZHJhZnQgKSB7XG5cdFx0XHR2YXIgcmVxdWVzdF92YWx1ZXM7XG5cdFx0XHR2YXIgY3VycmVudF9nZW5lcmF0aW9uO1xuXG5cdFx0XHRsYXVuY2hfcmVxdWVzdCA9IGxhdW5jaF9yZXF1ZXN0ICYmICdvYmplY3QnID09PSB0eXBlb2YgbGF1bmNoX3JlcXVlc3Rcblx0XHRcdFx0PyBsYXVuY2hfcmVxdWVzdFxuXHRcdFx0XHQ6IHsgc2VsZWN0aW9uX3NvdXJjZTogJ2VtcHR5JyB9O1xuXHRcdFx0cmVxdWVzdF92YWx1ZXMgPSB7XG5cdFx0XHRcdHNjaGVtYV92ZXJzaW9uOiBjb25maWd1cmF0aW9uLnNjaGVtYV92ZXJzaW9uLFxuXHRcdFx0XHRyZXF1ZXN0X2lkOiBjcmVhdGVfcmVxdWVzdF9pZCgpLFxuXHRcdFx0XHRzZWxlY3Rpb25fc291cmNlOiBsYXVuY2hfcmVxdWVzdC5zZWxlY3Rpb25fc291cmNlXG5cdFx0XHR9O1xuXG5cdFx0XHRjaG9pY2VzID0gY2hvaWNlcyAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIGNob2ljZXMgPyBjaG9pY2VzIDoge307XG5cdFx0XHRjYWxlbmRhcl9hbmNob3JfZGF0ZSA9IC9eXFxkezR9LVxcZHsyfS1cXGR7Mn0kLy50ZXN0KCBTdHJpbmcoIGNhbGVuZGFyX2FuY2hvcl9kYXRlIHx8ICcnICkgKVxuXHRcdFx0XHQ/IFN0cmluZyggY2FsZW5kYXJfYW5jaG9yX2RhdGUgKVxuXHRcdFx0XHQ6ICcnO1xuXHRcdFx0bGFzdF9jaG9pY2VzID0gT2JqZWN0LmFzc2lnbigge30sIGNob2ljZXMgKTtcblx0XHRcdGxhc3RfbGF1bmNoX3JlcXVlc3QgPSBPYmplY3QuYXNzaWduKCB7fSwgbGF1bmNoX3JlcXVlc3QgKTtcblx0XHRcdGxhc3RfY2FsZW5kYXJfYW5jaG9yX2RhdGUgPSBjYWxlbmRhcl9hbmNob3JfZGF0ZTtcblx0XHRcdGxhc3Rfc2NoZWR1bGVfZHJhZnQgPSBzY2hlZHVsZV9kcmFmdCA/IE9iamVjdC5hc3NpZ24oIHt9LCBzY2hlZHVsZV9kcmFmdCwge1xuXHRcdFx0XHRzZWxlY3RlZF9kYXRlczogQXJyYXkuaXNBcnJheSggc2NoZWR1bGVfZHJhZnQuc2VsZWN0ZWRfZGF0ZXMgKSA/IHNjaGVkdWxlX2RyYWZ0LnNlbGVjdGVkX2RhdGVzLnNsaWNlKCAwICkgOiBbXVxuXHRcdFx0fSApIDogbnVsbDtcblx0XHRcdGlmICggbGF1bmNoX3JlcXVlc3Quc291cmNlX2NvbnRleHRfdG9rZW4gKSB7XG5cdFx0XHRcdHJlcXVlc3RfdmFsdWVzLnNvdXJjZV9jb250ZXh0X3Rva2VuID0gbGF1bmNoX3JlcXVlc3Quc291cmNlX2NvbnRleHRfdG9rZW47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNob2ljZXMucmVzb3VyY2VfaWQgJiYgL15bMS05XVswLTldKiQvLnRlc3QoIFN0cmluZyggY2hvaWNlcy5yZXNvdXJjZV9pZCApICkgKSB7XG5cdFx0XHRcdHJlcXVlc3RfdmFsdWVzLnJlc291cmNlX2lkID0gU3RyaW5nKCBjaG9pY2VzLnJlc291cmNlX2lkICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNob2ljZXMuZm9ybV9pZCApIHtcblx0XHRcdFx0cmVxdWVzdF92YWx1ZXMuZm9ybV9pZCA9IFN0cmluZyggY2hvaWNlcy5mb3JtX2lkICk7XG5cdFx0XHR9XG5cblx0XHRcdGFib3J0X3JlcXVlc3QoKTtcblx0XHRcdGlmICggISB0cmFuc2l0aW9uKCAnbG9hZGluZycgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0c2hhcmVkX2luc3BlY3Rvci5yZXNldF9oZWFkZXIoIGkxOG4udGl0bGUgfHwgJycgKTtcblx0XHRcdHJlbmRlcl9zdGF0ZSggJ2xvYWRpbmcnLCBpMThuLmxvYWRpbmdfdGl0bGUgfHwgaTE4bi50aXRsZSB8fCAnJywgaTE4bi5sb2FkaW5nIHx8ICcnLCBmYWxzZSApO1xuXHRcdFx0cmVxdWVzdF9nZW5lcmF0aW9uICs9IDE7XG5cdFx0XHRjdXJyZW50X2dlbmVyYXRpb24gPSByZXF1ZXN0X2dlbmVyYXRpb247XG5cdFx0XHRwZW5kaW5nX3JlcXVlc3QgPSAkLmFqYXgoIHtcblx0XHRcdFx0dXJsOiB0cmFuc3BvcnQudXJsLFxuXHRcdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdFx0ZGF0YVR5cGU6ICdqc29uJyxcblx0XHRcdFx0ZGF0YToge1xuXHRcdFx0XHRcdGFjdGlvbjogdHJhbnNwb3J0LmJvb3RzdHJhcF9hY3Rpb24sXG5cdFx0XHRcdFx0bm9uY2U6IHRyYW5zcG9ydC5ib290c3RyYXBfbm9uY2UsXG5cdFx0XHRcdFx0cmVxdWVzdDogSlNPTi5zdHJpbmdpZnkoIHJlcXVlc3RfdmFsdWVzIClcblx0XHRcdFx0fVxuXHRcdFx0fSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRcdHZhciBib290c3RyYXAgPSByZXNwb25zZSAmJiB0cnVlID09PSByZXNwb25zZS5zdWNjZXNzID8gcmVzcG9uc2UuZGF0YSA6IG51bGw7XG5cblx0XHRcdFx0aWYgKCBjdXJyZW50X2dlbmVyYXRpb24gIT09IHJlcXVlc3RfZ2VuZXJhdGlvbiB8fCAhIHNoYXJlZF9pbnNwZWN0b3IuaXNfb3BlbigpICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRwZW5kaW5nX3JlcXVlc3QgPSBudWxsO1xuXHRcdFx0XHRpZiAoICEgYm9vdHN0cmFwIHx8IGJvb3RzdHJhcC5yZXF1ZXN0X2lkICE9PSByZXF1ZXN0X3ZhbHVlcy5yZXF1ZXN0X2lkIHx8ICdlZGl0aW5nJyAhPT0gYm9vdHN0cmFwLnN0YXRlICkge1xuXHRcdFx0XHRcdHRyYW5zaXRpb24oICdlcnJvcicgKTtcblx0XHRcdFx0XHRyZW5kZXJfc3RhdGUoICdlcnJvcicsIGkxOG4uZXJyb3JfdGl0bGUgfHwgJycsIHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5tZXNzYWdlID8gcmVzcG9uc2UuZGF0YS5tZXNzYWdlIDogaTE4bi5sb2FkX2ZhaWxlZCB8fCAnJywgdHJ1ZSApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRyYW5zaXRpb24oICdlZGl0aW5nJyApO1xuXHRcdFx0XHRzaGFyZWRfaW5zcGVjdG9yLnNldF9oZWFkZXIoIGhlYWRlcl90ZW1wbGF0ZSggeyB0aXRsZTogaTE4bi50aXRsZSB8fCAnJywgc3VidGl0bGU6IGkxOG4uc3VidGl0bGUgfHwgJycgfSApLCBpMThuLnRpdGxlIHx8ICcnICk7XG5cdFx0XHRcdHJlbmRlcl9lZGl0aW5nKCBib290c3RyYXAsIGxhdW5jaF9yZXF1ZXN0LCBjYWxlbmRhcl9hbmNob3JfZGF0ZSwgbGFzdF9zY2hlZHVsZV9kcmFmdCApO1xuXHRcdFx0fSApLmZhaWwoIGZ1bmN0aW9uICggZmFpbGVkX3JlcXVlc3QsIHJlcXVlc3Rfc3RhdHVzICkge1xuXHRcdFx0XHR2YXIgZXJyb3JfZGF0YTtcblxuXHRcdFx0XHRpZiAoICdhYm9ydCcgPT09IHJlcXVlc3Rfc3RhdHVzIHx8IGN1cnJlbnRfZ2VuZXJhdGlvbiAhPT0gcmVxdWVzdF9nZW5lcmF0aW9uIHx8ICEgc2hhcmVkX2luc3BlY3Rvci5pc19vcGVuKCkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHBlbmRpbmdfcmVxdWVzdCA9IG51bGw7XG5cdFx0XHRcdHRyYW5zaXRpb24oICdlcnJvcicgKTtcblx0XHRcdFx0ZXJyb3JfZGF0YSA9IGZhaWxlZF9yZXF1ZXN0ICYmIGZhaWxlZF9yZXF1ZXN0LnJlc3BvbnNlSlNPTiA/IGZhaWxlZF9yZXF1ZXN0LnJlc3BvbnNlSlNPTi5kYXRhIDogbnVsbDtcblx0XHRcdFx0cmVuZGVyX3N0YXRlKCAnZXJyb3InLCBpMThuLmVycm9yX3RpdGxlIHx8ICcnLCBlcnJvcl9kYXRhICYmIGVycm9yX2RhdGEubWVzc2FnZSA/IGVycm9yX2RhdGEubWVzc2FnZSA6IGkxOG4ubG9hZF9mYWlsZWQgfHwgJycsIHRydWUgKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHRzaGFyZWRfaW5zcGVjdG9yID0gd2luZG93LndwYmNfc2hhcmVkX3VpX2luc3BlY3Rvci5jcmVhdGUoIHNoZWxsX3Jvb3QsIHtcblx0XHRcdG93bmVyX2lkOiBjb25maWd1cmF0aW9uLmNvbXBvbmVudF9pZCxcblx0XHRcdGludGVyYWN0aW9uX2dyb3VwOiBjb25maWd1cmF0aW9uLmNvbXBvbmVudF9pZCxcblx0XHRcdG9uX2JlZm9yZV9jbG9zZTogY29uZmlybV9kaXNjYXJkX2NoYW5nZXMsXG5cdFx0XHRvbl9jbG9zZTogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHR2YXIgZm9jdXNfYm9va2luZ19pZCA9ICdjcmVhdGVkJyA9PT0gc3RhdGUgPyBjcmVhdGVkX2Jvb2tpbmdfaWQgOiAwO1xuXG5cdFx0XHRcdGFib3J0X3JlcXVlc3QoKTtcblx0XHRcdFx0c3RhdGUgPSAnY2xvc2VkJztcblx0XHRcdFx0c2hlbGxfcm9vdC5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLXN0YXRlJywgc3RhdGUgKTtcblx0XHRcdFx0cmVxdWVzdF9jcmVhdGVkX2Jvb2tpbmdfZm9jdXMoIGZvY3VzX2Jvb2tpbmdfaWQgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdFx0aWYgKCAhIHNoYXJlZF9pbnNwZWN0b3IgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0c2hlbGxfcm9vdC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0aWYgKCBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLXJldHJ5XScgKSApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0bG9hZCggbGFzdF9jaG9pY2VzLCBsYXN0X2xhdW5jaF9yZXF1ZXN0LCBsYXN0X2NhbGVuZGFyX2FuY2hvcl9kYXRlLCBsYXN0X3NjaGVkdWxlX2RyYWZ0ICk7XG5cdFx0XHR9IGVsc2UgaWYgKCBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLXJldmlldy1jYW5jZWxdJyApICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRjYW5jZWxfcmV2aWV3KCk7XG5cdFx0XHR9IGVsc2UgaWYgKCBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1uZXctaW5zcGVjdG9yLWNyZWF0ZV0nICkgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGFwcGx5X3JldmlldygpO1xuXHRcdFx0fSBlbHNlIGlmICggZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1yZWFkYmFjay1yZXRyeV0nICkgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGlmICggcGVuZGluZ19jcmVhdGVkX3JlYWRiYWNrICYmIHBlbmRpbmdfY3JlYXRlZF9yZWFkYmFjay5yZXNwb25zZSApIHtcblx0XHRcdFx0XHRyZXF1ZXN0X3RpbWVsaW5lX3JlYWRiYWNrKCBwZW5kaW5nX2NyZWF0ZWRfcmVhZGJhY2sucmVzcG9uc2UgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHR0aW1lbGluZV9ldmVudF9yb290LmFkZEV2ZW50TGlzdGVuZXIoIHRpbWVsaW5lX3JlYWRiYWNrX2V2ZW50X25hbWUsIGhhbmRsZV90aW1lbGluZV9yZWFkYmFjayApO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdG9wZW46IGZ1bmN0aW9uICggdHJpZ2dlciwgbGF1bmNoX3JlcXVlc3QgKSB7XG5cdFx0XHRcdGlmICggJ2Nsb3NlZCcgIT09IHN0YXRlICkge1xuXHRcdFx0XHRcdHNoYXJlZF9pbnNwZWN0b3IuY2xvc2UoIGZhbHNlICk7XG5cdFx0XHRcdFx0aWYgKCBzaGFyZWRfaW5zcGVjdG9yLmlzX29wZW4oKSApIHtcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0YWN0aXZlX2ZhbGxiYWNrX3VybCA9IHRyaWdnZXIgJiYgdHJpZ2dlci5ocmVmID8gdHJpZ2dlci5ocmVmIDogY29uZmlndXJhdGlvbi5jYW5vbmljYWxfdXJsIHx8ICcnO1xuXHRcdFx0XHRjb3N0X3NlY3Rpb25fZGlzbWlzc2VkID0gZmFsc2U7XG5cdFx0XHRcdHNoYXJlZF9pbnNwZWN0b3Iub3BlbiggdHJpZ2dlciApO1xuXHRcdFx0XHRsb2FkKFxuXHRcdFx0XHRcdHt9LFxuXHRcdFx0XHRcdGxhdW5jaF9yZXF1ZXN0LFxuXHRcdFx0XHRcdCdlbXB0eScgPT09IGxhdW5jaF9yZXF1ZXN0LnNlbGVjdGlvbl9zb3VyY2UgPyBnZXRfdG9kYXlfY2FsZW5kYXJfYW5jaG9yX2RhdGUoKSA6ICcnLFxuXHRcdFx0XHRcdG51bGxcblx0XHRcdFx0KTtcblxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIEludGVyY2VwdCB0aGUgc3RhYmxlIGF1dGhvcml6ZWQgVGltZWxpbmUgbGF1bmNoIGxpbmsgd2hlbiB0aGUgYWRhcHRlciBpcyByZWFkeS5cblx0ICpcblx0ICogSWYgYW55IHJ1bnRpbWUgY29udHJhY3QgaXMgYWJzZW50LCBuYXZpZ2F0aW9uIGlzIGludGVudGlvbmFsbHkgbGVmdCBhbG9uZSBzb1xuXHQgKiB0aGUgY2Fub25pY2FsIEFkZCBCb29raW5nIGRlc3RpbmF0aW9uIHJlbWFpbnMgYXZhaWxhYmxlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGV2ZW50IERlbGVnYXRlZCBkb2N1bWVudCBjbGljay5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGhhbmRsZV9jbGljayggZXZlbnQgKSB7XG5cdFx0dmFyIHRyaWdnZXIgPSBldmVudC50YXJnZXQuY2xvc2VzdCggbGF1bmNoX3NlbGVjdG9yICk7XG5cdFx0dmFyIHRpbWVsaW5lX3NldHRpbmdzID0gd2luZG93LndwYmNfdGltZWxpbmVfY29uZmlnICYmICdvYmplY3QnID09PSB0eXBlb2Ygd2luZG93LndwYmNfdGltZWxpbmVfY29uZmlnID8gd2luZG93LndwYmNfdGltZWxpbmVfY29uZmlnIDoge307XG5cdFx0dmFyIGFjdGlvbiA9IHRpbWVsaW5lX3NldHRpbmdzLm5ld19ib29raW5nICYmICdvYmplY3QnID09PSB0eXBlb2YgdGltZWxpbmVfc2V0dGluZ3MubmV3X2Jvb2tpbmcgPyB0aW1lbGluZV9zZXR0aW5ncy5uZXdfYm9va2luZyA6IHt9O1xuXHRcdHZhciBjb25maWd1cmF0aW9uID0gYWN0aW9uLmluc3BlY3RvciAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIGFjdGlvbi5pbnNwZWN0b3IgPyBhY3Rpb24uaW5zcGVjdG9yIDogbnVsbDtcblx0XHR2YXIgbGF1bmNoX3JlcXVlc3Q7XG5cblx0XHRpZiAoICEgdHJpZ2dlciB8fCAhIGNvbmZpZ3VyYXRpb24gKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGxhdW5jaF9yZXF1ZXN0ID0gZ2V0X2xhdW5jaF9yZXF1ZXN0KCB0cmlnZ2VyLCBjb25maWd1cmF0aW9uICk7XG5cdFx0aWYgKCAhIGxhdW5jaF9yZXF1ZXN0ICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoICEgY29udHJvbGxlciApIHtcblx0XHRcdGNvbnRyb2xsZXIgPSBjcmVhdGVfY29udHJvbGxlciggY29uZmlndXJhdGlvbiApO1xuXHRcdH1cblx0XHRpZiAoICEgY29udHJvbGxlciApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGNvbnRyb2xsZXIub3BlbiggdHJpZ2dlciwgbGF1bmNoX3JlcXVlc3QgKTtcblx0fVxuXG5cdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGhhbmRsZV9jbGljayApO1xufSggd2luZG93LCBkb2N1bWVudCwgd2luZG93LndwLCB3aW5kb3cualF1ZXJ5ICkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDRSxXQUFXQSxNQUFNLEVBQUVDLFFBQVEsRUFBRUMsRUFBRSxFQUFFQyxDQUFDLEVBQUc7RUFDdEMsWUFBWTs7RUFFWixJQUFJQyxlQUFlLEdBQUcsd0NBQXdDO0VBQzlELElBQUlDLGtCQUFrQixHQUFHLG9DQUFvQztFQUM3RCxJQUFJQyw0QkFBNEIsR0FBRyw4Q0FBOEM7RUFDakYsSUFBSUMsd0JBQXdCLEdBQUcsMENBQTBDO0VBQ3pFLElBQUlDLFVBQVUsR0FBRyxJQUFJOztFQUVyQjtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0Msa0JBQWtCQSxDQUFFQyxPQUFPLEVBQUVDLGFBQWEsRUFBRztJQUNyRCxJQUFJQyxjQUFjLEdBQUdGLE9BQU8sSUFBSSxVQUFVLEtBQUssT0FBT0EsT0FBTyxDQUFDRyxZQUFZLEdBQ3ZFQyxNQUFNLENBQUVKLE9BQU8sQ0FBQ0csWUFBWSxDQUFFLHNDQUF1QyxDQUFDLElBQUksRUFBRyxDQUFDLEdBQzlFLEVBQUU7SUFDTCxJQUFJRSxlQUFlLEdBQUdKLGFBQWEsQ0FBQ0ksZUFBZSxJQUFJLFFBQVEsS0FBSyxPQUFPSixhQUFhLENBQUNJLGVBQWUsR0FDckdKLGFBQWEsQ0FBQ0ksZUFBZSxHQUM3QixDQUFDLENBQUM7SUFD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
