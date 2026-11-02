"use strict";

/**
 * Timeline booking-resizing pointer-preview controller.
 *
 * The server authorizes an immutable resize context. This controller owns
 * pointer capture, bounded loaded-axis geometry, presentation-only ghosts, one
 * canonical non-mutating Review request after pointer release, and one guarded
 * Apply request for the resulting signed plan. Canonical validation,
 * persistence, and readback remain server-owned.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
(function (window, document) {
  'use strict';

  var template_keys = ['loading', 'handles', 'ghost', 'review', 'live_region'];
  var supported_shapes = ['single_timed_interval', 'continuous_boundary_interval', 'single_full_day', 'continuous_full_day_range', 'independent_full_days', 'recurrent_timed_intervals', 'discontinuous_timed_intervals'];
  var full_day_shapes = ['single_full_day', 'continuous_full_day_range', 'independent_full_days'];
  var operations = ['resize_start', 'resize_end'];
  var drag_threshold = 5;
  var touch_vertical_threshold = 8;
  var auto_scroll_edge = 56;
  var auto_scroll_step = 22;
  var review_gap = 8;

  /**
   * Create one card-scoped resize presentation controller.
   *
   * @param {HTMLElement} mount         Timeline mount.
   * @param {Object}      configuration Server-owned transport and template DTO.
   * @param {Object}      callbacks     Bounded Timeline integration callbacks.
   * @return {Object|null} Controller API or null for an incomplete contract.
   */
  function create_controller(mount, configuration, callbacks) {
    var transport = configuration && configuration.transport ? configuration.transport : {};
    var review_transport = configuration && configuration.review_transport ? configuration.review_transport : {};
    var apply_transport = configuration && configuration.apply_transport ? configuration.apply_transport : {};
    var templates = configuration && configuration.templates ? configuration.templates : {};
    var pointer_configuration = configuration && configuration.pointer ? configuration.pointer : {};
    var i18n = configuration && configuration.i18n ? configuration.i18n : {};
    var snap_to_timeline_step = false !== pointer_configuration.snap_to_timeline_step;
    var segment_records = new WeakMap();
    var visible_segments = [];
    var active_ghost_records = [];
    var active_selection = null;
    var eligibility_request = null;
    var request_generation = 0;
    var presentation_generation = 0;
    var interaction_state = 'idle';
    var pointer_gesture = null;
    var preview_frame = 0;
    var transient_scroll_canvas = null;
    var review_request = null;
    var review_generation = 0;
    var review_host = null;
    var review_scroll_canvas = null;
    var review_position_frame = 0;
    var review_focus_target = null;
    var review_memory = null;
    var review_error_base = null;
    var apply_request = null;
    var apply_generation = 0;
    var pending_apply_result = null;
    var apply_focus_operation = '';
    var suppress_handle_click = false;
    var is_destroyed = false;
    if (!mount || !has_required_contract()) {
      return null;
    }
    mount.addEventListener('pointerdown', handle_pointer_down, true);

    /**
     * Validate the fixed transport and allow-listed templates.
     *
     * @return {boolean} True when the static contract is usable.
     */
    function has_required_contract() {
      return Boolean(window.jQuery && window.wp && 'function' === typeof window.wp.template && transport.url && transport.action && transport.nonce && 'timeline' === transport.source && review_transport.url && review_transport.action && review_transport.nonce && 'timeline' === review_transport.source && 0 < Number(review_transport.schema_version) && apply_transport.url && apply_transport.action && apply_transport.nonce && 'timeline' === apply_transport.source && template_keys.every(function (key) {
        return 'string' === typeof templates[key] && /^[a-z0-9_-]+$/.test(templates[key]);
      }));
    }

    /**
     * Resolve one fixed template through the server allow list.
     *
     * @param {string} key Fixed semantic key.
     * @return {Function|null} WordPress template renderer or null.
     */
    function get_template(key) {
      return -1 !== template_keys.indexOf(key) && templates[key] ? window.wp.template(templates[key]) : null;
    }

    /**
     * Render one template without rewriting an unchanged host.
     *
     * @param {HTMLElement|null} host Target host.
     * @param {string} key Template key.
     * @param {Object} view_model Authorized presentation values.
     * @return {boolean} True when markup changed.
     */
    function render_template(host, key, view_model) {
      var renderer = get_template(key);
      var markup;
      if (!host || !renderer) {
        return false;
      }
      markup = renderer(view_model || {});
      if (markup === host.innerHTML) {
        return false;
      }
      host.innerHTML = markup;
      return true;
    }

    /**
     * Clear a non-empty dedicated host.
     *
     * @param {HTMLElement|null} host Dedicated host.
     * @return {boolean} True when content was removed.
     */
    function clear_host(host) {
      if (!host || !host.childNodes.length && !host.textContent) {
        return false;
      }
      host.replaceChildren();
      return true;
    }

    /**
     * Resolve dedicated resize hosts within an exact card.
     *
     * @param {HTMLElement|null} card Registered card.
     * @return {Object} Root, visual, live-region, and review hosts.
     */
    function get_hosts(card) {
      var root = card && card.querySelector ? card.querySelector('[data-wpbc-timeline-booking-resize-host]') : null;
      return {
        root: root,
        visual: root ? root.querySelector('[data-wpbc-timeline-booking-resize-visual-host]') : null,
        live: root ? root.querySelector('[data-wpbc-timeline-booking-resize-live-host]') : null,
        review: root ? root.querySelector('[data-wpbc-timeline-booking-resize-review-host]') : null
      };
    }

    /**
     * Remove proposal-only handle offsets from one canonical card.
     *
     * Handles are rendered inside the unchanged booking card. Dragging can
     * temporarily project them to dashed boundaries, so every terminal path
     * restores their canonical CSS positions before Review presentation.
     *
     * @param {HTMLElement|null} card Registered card.
     * @return {void}
     */
    function clear_handle_offsets(card) {
      if (!card || !card.style || 'function' !== typeof card.style.removeProperty) {
        return;
      }
      card.style.removeProperty('--wpbc-timeline-booking-resize-start-offset');
      card.style.removeProperty('--wpbc-timeline-booking-resize-end-offset');
    }

    /**
     * Reflect loading, ready, or denied presentation.
     *
     * An authorized resize handle owns the same visual boundary as Timeline's
     * ordinary selection dot. Boundary-specific ready classes let CSS replace
     * only that duplicate dot. When the booking remains eligible but one exact
     * boundary is unavailable, a separate class converts that ordinary dot into
     * a non-interactive unavailable marker instead of implying it can be moved.
     *
     * @param {HTMLElement|null} card Active card.
     * @param {string} state Presentation state.
     * @return {void}
     */
    function set_presentation_state(card, state) {
      var is_ready = 'ready' === state;
      var handles = is_ready && active_selection && active_selection.card === card ? active_selection.handles : null;
      var start_is_eligible = Boolean(handles && handles.start && handles.start.eligible);
      var end_is_eligible = Boolean(handles && handles.end && handles.end.eligible);
      var start_is_unavailable = Boolean(is_ready && handles && handles.start && !start_is_eligible);
      var end_is_unavailable = Boolean(is_ready && handles && handles.end && !end_is_eligible);
      if (card && card.classList) {
        card.classList.toggle('is-booking-resize-loading', 'loading' === state);
        card.classList.toggle('is-booking-resize-ready', is_ready);
        card.classList.toggle('is-booking-resize-start-ready', start_is_eligible);
        card.classList.toggle('is-booking-resize-end-ready', end_is_eligible);
        card.classList.toggle('is-booking-resize-start-unavailable', start_is_unavailable);
        card.classList.toggle('is-booking-resize-end-unavailable', end_is_unavailable);
      }
      mount.classList.toggle('is-booking-resize-denied', 'denied' === state);
    }

    /**
     * Announce one state through the domain live-region template.
     *
     * @param {HTMLElement|null} card Active card.
     * @param {string} message Localized message.
     * @return {void}
     */
    function announce(card, message) {
      var host = get_hosts(card).live;
      if (message) {
        render_template(host, 'live_region', {
          message: String(message)
        });
      } else {
        clear_host(host);
      }
    }

    /**
     * Show one standard global administration notice for an actionable result.
     *
     * Loading and successful non-mutating checks remain card-local. This callback
     * is reserved for an explicit denial or failure so pointer movement and
     * Timeline scrolling can never produce repeated global messages.
     *
     * @param {string} message      Plain-text authorized message.
     * @param {string} message_type Standard administration notice type.
     * @param {number} delay        Visible duration in milliseconds.
     * @return {void}
     */
    function show_admin_notice(message, message_type, delay) {
      if (message && callbacks && 'function' === typeof callbacks.show_admin_message) {
        callbacks.show_admin_message(String(message), message_type, delay);
      }
    }

    /**
     * Resolve an authorized eligibility reason into translated user guidance.
     *
     * @param {Object|null} dto     Raw authorized resize-context DTO.
     * @param {Object|null} context Validated immutable resize context.
     * @param {Object|null} handles Projected handle presentation.
     * @return {string} Translated warning text, or an empty string when fully ready.
     */
    function get_eligibility_warning(dto, context, handles) {
      var denial_reasons = i18n.denial_reasons && 'object' === typeof i18n.denial_reasons ? i18n.denial_reasons : {};
      var reason = '';
      var boundaries = dto && dto.boundaries ? dto.boundaries : {};
      if (!handles) {
        reason = dto && dto.fallback ? String(dto.fallback.reason || '') : '';
        return denial_reasons[reason] || i18n.denied || '';
      }
      if (context && !context.boundaries.start && boundaries.start) {
        reason = String(boundaries.start.fallback_reason || '');
      }
      if (!reason && context && !context.boundaries.end && boundaries.end) {
        reason = String(boundaries.end.fallback_reason || '');
      }
      return reason ? denial_reasons[reason] || i18n.partially_ready || '' : '';
    }

    /**
     * Read a safe endpoint error message with a translated fallback.
     *
     * @param {Object} failed_request Failed jQuery request.
     * @param {string} fallback       Translated fallback message.
     * @return {string} Plain-text error message.
     */
    function get_request_error_message(failed_request, fallback) {
      var error_data = failed_request && failed_request.responseJSON ? failed_request.responseJSON.data : null;
      return error_data && 'string' === typeof error_data.message && error_data.message ? error_data.message : String(fallback || '');
    }

    /**
     * Remove only the ghosts created for the active affected occurrences.
     *
     * @return {void}
     */
    function clear_ghosts() {
      active_ghost_records.forEach(function (record) {
        if (record.ghost_host && record.ghost_host.parentNode) {
          record.ghost_host.parentNode.removeChild(record.ghost_host);
        }
        record.ghost_host = null;
        record.ghost = null;
        record.ghost_interval_index = -1;
        record.ghost_geometry_key = '';
        if (record.card && record.card.classList) {
          record.card.classList.toggle('is-booking-resizing', false);
          record.card.classList.toggle('is-booking-resize-dragging', false);
        }
      });
      active_ghost_records = [];
    }

    /**
     * Toggle active-drag chrome suppression on affected occurrence cards.
     *
     * Live pointer movement suppresses inactive chrome while retaining one small
     * active boundary dot and a scoped horizontal-resize cursor. Canonical Review
     * owns attention immediately after release.
     *
     * @param {boolean} is_dragging Whether pointer movement is active.
     * @return {void}
     */
    function set_dragging_presentation(is_dragging) {
      var active_handle = pointer_gesture && pointer_gesture.handle ? pointer_gesture.handle : null;
      active_ghost_records.forEach(function (record) {
        if (record.card && record.card.classList) {
          record.card.classList.toggle('is-booking-resize-dragging', is_dragging);
        }
      });
      if (active_selection && active_selection.card && active_selection.card.classList) {
        active_selection.card.classList.toggle('is-booking-resize-dragging', is_dragging);
      }
      if (active_handle && active_handle.classList) {
        active_handle.classList.toggle('is-booking-resize-active-boundary', is_dragging);
      }
      if (mount && mount.classList) {
        mount.classList.toggle('is-booking-resize-pointer-active', is_dragging);
      }
    }

    /**
     * Clear resize presentation from one card only.
     *
     * @param {HTMLElement|null} card Previously active card.
     * @return {void}
     */
    function clear_card(card) {
      var hosts = get_hosts(card);
      set_presentation_state(card, '');
      clear_handle_offsets(card);
      if (card && card.classList) {
        card.classList.toggle('is-booking-resizing', false);
        card.classList.toggle('is-booking-resize-dragging', false);
      }
      clear_host(hosts.visual);
      clear_host(hosts.live);
      if (hosts.review && hosts.review.parentNode) {
        hosts.review.parentNode.removeChild(hosts.review);
      }
    }

    /**
     * Determine whether a string is an exact offset-bearing instant.
     *
     * @param {string} instant Candidate instant.
     * @return {boolean} True for a parseable exact instant.
     */
    function is_exact_instant(instant) {
      return 'string' === typeof instant && /T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(instant) && !Number.isNaN(Date.parse(instant));
    }

    /**
     * Normalize one explicitly registered segment.
     *
     * @param {HTMLElement} card Rendered card.
     * @param {Object} segment Authorized compact segment DTO.
     * @return {Object|null} Bounded record or null.
     */
    function normalize_segment(card, segment) {
      var booking_id = Math.max(0, Math.round(Number(segment && segment.booking_id) || 0));
      var segment_id = String(segment && segment.segment_id || '');
      var visible_start = String(segment && segment.visible_start || '');
      var visible_end = String(segment && segment.visible_end || '');
      if (!card || !booking_id || !segment_id || !is_exact_instant(visible_start) || !is_exact_instant(visible_end)) {
        return null;
      }
      return {
        card: card,
        booking_id: booking_id,
        segment_id: segment_id,
        visible_start: visible_start,
        visible_end: visible_end,
        visible_start_epoch: Date.parse(visible_start),
        visible_end_epoch: Date.parse(visible_end),
        show_start: !Boolean(segment.is_clipped_start),
        show_end: !Boolean(segment.is_clipped_end),
        key: [booking_id, segment_id, visible_start, visible_end].join('|'),
        ghost_host: null,
        ghost: null,
        ghost_interval_index: -1,
        ghost_geometry_key: ''
      };
    }

    /**
     * Normalize and freeze one exact interval.
     *
     * @param {Object} interval Server interval DTO.
     * @return {Object|null} Immutable interval or null.
     */
    function normalize_interval(interval) {
      var start = interval ? String(interval.start || '') : '';
      var end = interval ? String(interval.end || '') : '';
      if (!is_exact_instant(start) || !is_exact_instant(end) || Date.parse(end) <= Date.parse(start)) {
        return null;
      }
      return Object.freeze({
        start: start,
        end: end,
        start_epoch: Date.parse(start),
        end_epoch: Date.parse(end)
      });
    }

    /**
     * Validate and freeze the authoritative resize context.
     *
     * @param {Object} response AJAX response.
     * @return {Object|null} Immutable context or null when fail-closed.
     */
    function normalize_context(response) {
      var dto = response && response.success && response.data ? response.data.resize_context : null;
      var boundaries = dto && dto.boundaries ? dto.boundaries : {};
      var immutable_interval;
      var affected_intervals;
      var anchor_interval_index = -1;
      var shape;
      if (!active_selection || !dto || !dto.eligible || Number(dto.schema_version) !== Number(configuration.schema_version) || Number(dto.booking_id) !== active_selection.booking_id || !Number(dto.target_resource_id) || 'resize' !== dto.interaction_source || !String(dto.source_context_token || '')) {
        return null;
      }
      shape = String(dto.saved_shape || '');
      immutable_interval = normalize_interval(dto.immutable_interval);
      affected_intervals = Array.isArray(dto.affected_intervals) ? dto.affected_intervals.map(normalize_interval).filter(Boolean) : [];
      if (-1 === supported_shapes.indexOf(shape) || !immutable_interval || !affected_intervals.length || affected_intervals.length !== Number(dto.affected_interval_count)) {
        return null;
      }
      affected_intervals.some(function (interval, index) {
        if (interval.start_epoch === immutable_interval.start_epoch && interval.end_epoch === immutable_interval.end_epoch) {
          anchor_interval_index = index;
          return true;
        }
        return false;
      });
      if (-1 === anchor_interval_index) {
        return null;
      }
      return Object.freeze({
        booking_id: active_selection.booking_id,
        target_resource_id: Math.round(Number(dto.target_resource_id)),
        saved_shape: shape,
        resize_scope: String(dto.resize_scope || ''),
        source_context_token: String(dto.source_context_token),
        proposal_revision_seed: Math.max(1, Math.round(Number(dto.proposal_revision) || 1)),
        anchor_interval_index: anchor_interval_index,
        immutable_interval: immutable_interval,
        affected_intervals: Object.freeze(affected_intervals.slice()),
        boundaries: Object.freeze({
          start: Boolean(active_selection.show_start && boundaries.start && boundaries.start.eligible && 'resize_start' === boundaries.start.operation),
          end: Boolean(active_selection.show_end && boundaries.end && boundaries.end.eligible && 'resize_end' === boundaries.end.operation)
        })
      });
    }

    /**
     * Build the safe handle view model.
     *
     * @param {Object} context Immutable resize context.
     * @return {Object|null} Handle view model or null.
     */
    function project_handles(context) {
      if (!context || !context.boundaries.start && !context.boundaries.end) {
        return null;
      }
      return {
        group_label: i18n.group_label || '',
        start: {
          eligible: context.boundaries.start,
          operation: 'resize_start',
          label: i18n.resize_start || ''
        },
        end: {
          eligible: context.boundaries.end,
          operation: 'resize_end',
          label: i18n.resize_end || ''
        }
      };
    }

    /**
     * Determine whether a ready native presentation owns both boundary records.
     *
     * Time Rows forwards a signed proposal into this controller without creating
     * native horizontal handles. A Timeline replacement can reattach that booking
     * card after the external Review has been cancelled, so `state: ready` alone is
     * not sufficient proof that native handle presentation can be rendered.
     *
     * @param {Object|null} handles Candidate handle view model.
     * @return {boolean} True when both native boundary records are present.
     */
    function has_complete_handle_view_model(handles) {
      return Boolean(handles && handles.start && handles.end);
    }

    /**
     * Reset selection-owned eligibility after its authoritative context is stale.
     *
     * The canonical booking identity and replacement card remain selected. A fresh
     * eligibility read must rebuild authority and native handle presentation.
     *
     * @return {void}
     */
    function reset_active_selection_eligibility() {
      if (!active_selection) {
        return;
      }
      active_selection.context = null;
      active_selection.handles = null;
      active_selection.state = 'idle';
      active_selection.request_state = 'idle';
      active_selection.proposal = null;
      active_selection.message = '';
      active_selection.is_external = false;
    }

    /**
     * Render the active loading, ready, denied, or error state.
     *
     * @return {void}
     */
    function render_active_state() {
      var hosts;
      if (!active_selection || !active_selection.card || !active_selection.card.isConnected) {
        return;
      }
      if ('ready' === active_selection.state && !has_complete_handle_view_model(active_selection.handles)) {
        set_presentation_state(active_selection.card, 'idle');
        hosts = get_hosts(active_selection.card);
        clear_host(hosts.visual);
        return;
      }
      set_presentation_state(active_selection.card, active_selection.state);
      hosts = get_hosts(active_selection.card);
      if ('loading' === active_selection.state) {
        render_template(hosts.visual, 'loading', {
          show_start: active_selection.show_start,
          show_end: active_selection.show_end
        });
        announce(active_selection.card, i18n.checking || '');
        return;
      }
      if ('ready' === active_selection.state) {
        render_template(hosts.visual, 'handles', active_selection.handles);
        announce(active_selection.card, !active_selection.handles.start.eligible || !active_selection.handles.end.eligible ? i18n.partially_ready || i18n.ready || '' : i18n.ready || '');
        restore_apply_handle_focus();
        return;
      }
      clear_host(hosts.visual);
      announce(active_selection.card, active_selection.message || '');
    }

    /**
     * Restore logical focus to the applied boundary after canonical refresh.
     *
     * Focus waits for the fresh eligibility response so it can target a newly
     * authorized handle rather than stale pre-save markup.
     *
     * @return {void}
     */
    function restore_apply_handle_focus() {
      var focus_target;
      if (!apply_focus_operation || !active_selection || !active_selection.card) {
        return;
      }
      if ('function' === typeof active_selection.restore_focus && true === active_selection.restore_focus(active_selection.booking_id, apply_focus_operation)) {
        apply_focus_operation = '';
        return;
      }
      focus_target = active_selection.card.querySelector('[data-wpbc-timeline-booking-resize-operation="' + apply_focus_operation + '"]');
      if (!focus_target || focus_target.disabled || 'function' !== typeof focus_target.focus) {
        return;
      }
      apply_focus_operation = '';
      focus_target.focus();
    }

    /**
     * Abort the eligibility request and invalidate its callbacks.
     *
     * @return {void}
     */
    function abort_request() {
      request_generation += 1;
      if (eligibility_request && 'function' === typeof eligibility_request.abort) {
        eligibility_request.abort();
      }
      eligibility_request = null;
    }

    /**
     * Send exactly one eligibility request for this selection generation.
     *
     * @return {void}
     */
    function load_eligibility() {
      var generation;
      if (!active_selection || eligibility_request || 'loading' === active_selection.request_state) {
        return;
      }
      interaction_state = 'eligibility_loading';
      active_selection.state = 'loading';
      active_selection.request_state = 'loading';
      render_active_state();
      generation = request_generation;
      eligibility_request = window.jQuery.ajax({
        url: transport.url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: transport.action,
          nonce: transport.nonce,
          booking_id: active_selection.booking_id,
          source: 'timeline',
          visible_start_at: active_selection.visible_start,
          visible_end_at: active_selection.visible_end
        }
      }).done(function (response) {
        var dto = response && response.success && response.data ? response.data.resize_context : null;
        var context;
        var handles;
        var warning_message;
        var is_explicit_denial;
        if (is_destroyed || generation !== request_generation || !active_selection) {
          return;
        }
        context = normalize_context(response);
        handles = project_handles(context);
        is_explicit_denial = Boolean(dto && false === dto.eligible);
        warning_message = is_explicit_denial || handles ? get_eligibility_warning(dto, context, handles) : '';
        active_selection.request_state = 'complete';
        active_selection.state = handles ? 'ready' : is_explicit_denial ? 'denied' : 'error';
        active_selection.handles = handles;
        active_selection.context = handles ? context : null;
        active_selection.next_proposal_revision = context ? context.proposal_revision_seed : 1;
        active_selection.message = handles ? '' : is_explicit_denial ? warning_message : i18n.error || '';
        interaction_state = handles ? 'ready' : 'idle';
        render_active_state();
        if (warning_message) {
          show_admin_notice(warning_message, 'warning', 3000);
        } else if (!handles) {
          show_admin_notice(active_selection.message, 'error', 10000);
        }
      }).fail(function (failed_request, request_status) {
        if (is_destroyed || generation !== request_generation || 'abort' === request_status || !active_selection) {
          return;
        }
        active_selection.request_state = 'complete';
        active_selection.state = 'error';
        active_selection.context = null;
        active_selection.message = get_request_error_message(failed_request, i18n.error || '');
        interaction_state = 'idle';
        render_active_state();
        show_admin_notice(active_selection.message, 'error', 10000);
      }).always(function () {
        if (generation === request_generation) {
          eligibility_request = null;
        }
      });
    }

    /**
     * Register one freshly rendered segment through the explicit lifecycle.
     *
     * @param {HTMLElement} card Rendered canonical card.
     * @param {Object} segment Authorized compact segment DTO.
     * @return {void}
     */
    function register_segment(card, segment) {
      var record = normalize_segment(card, segment);
      if (!record) {
        return;
      }
      segment_records.set(card, record);
      visible_segments.push(record);
      if (active_selection && (record.key === active_selection.key || !active_selection.card && record.booking_id === active_selection.booking_id && record.segment_id === active_selection.segment_id)) {
        active_selection.card = card;
        active_selection.key = record.key;
        active_selection.visible_start = record.visible_start;
        active_selection.visible_end = record.visible_end;
        active_selection.show_start = record.show_start;
        active_selection.show_end = record.show_end;
      }
    }

    /**
     * Activate the exact segment selected through delegated input.
     *
     * @param {HTMLElement} selection_source Card or selection control.
     * @return {boolean} True when a registered segment was accepted.
     */
    function select(selection_source) {
      var card = selection_source && selection_source.closest ? selection_source.closest('[data-wpbc-timeline-segment-id]') : null;
      var record = card ? segment_records.get(card) : null;
      if (!record) {
        return false;
      }
      if (-1 !== ['apply_pending', 'refresh_pending'].indexOf(interaction_state)) {
        return false;
      }
      if (active_selection && active_selection.key === record.key) {
        active_selection.card = card;
        render_active_state();
        return true;
      }
      cancel_interaction(false, 'selection_replaced');
      if (active_selection) {
        clear_card(active_selection.card);
      }
      abort_request();
      presentation_generation += 1;
      active_selection = {
        card: card,
        booking_id: record.booking_id,
        segment_id: record.segment_id,
        visible_start: record.visible_start,
        visible_end: record.visible_end,
        show_start: record.show_start,
        show_end: record.show_end,
        key: record.key,
        state: 'idle',
        request_state: 'idle',
        handles: null,
        context: null,
        proposal: null,
        next_proposal_revision: 1,
        message: ''
      };
      load_eligibility();
      return true;
    }

    /**
     * Build an immutable physical axis snapshot from the active row only.
     *
     * @param {HTMLElement} card Active card.
     * @return {Object|null} Loaded-axis snapshot or null.
     */
    function create_axis_snapshot(card) {
      var row = card ? card.closest('.wpbc_timeline__canvas_row') : null;
      var canvas = mount.querySelector('[data-wpbc-timeline-canvas]');
      var elements = row ? row.querySelectorAll('.wpbc_timeline__canvas_cell') : [];
      var cells = [];
      var axis = callbacks && 'function' === typeof callbacks.get_axis ? callbacks.get_axis() : {};
      Array.prototype.forEach.call(elements, function (element) {
        var start = String(element.getAttribute('data-wpbc-timeline-cell-start') || '');
        var end = String(element.getAttribute('data-wpbc-timeline-cell-end') || '');
        if (is_exact_instant(start) && is_exact_instant(end) && Date.parse(end) > Date.parse(start)) {
          cells.push({
            element: element,
            start: start,
            end: end,
            start_epoch: Date.parse(start),
            end_epoch: Date.parse(end),
            rectangle: element.getBoundingClientRect()
          });
        }
      });
      if (!canvas || !cells.length) {
        return null;
      }
      return Object.freeze({
        canvas: canvas,
        cells: cells,
        is_rtl: 1 < cells.length ? cells[0].rectangle.left > cells[cells.length - 1].rectangle.left : Boolean(axis.is_rtl),
        cell_minutes: Math.max(1, Math.round(Number(axis.cell_minutes) || 1)),
        timezone: String(axis.timezone || ''),
        generation: presentation_generation,
        min_epoch: cells[0].start_epoch,
        max_epoch: cells[cells.length - 1].end_epoch
      });
    }

    /**
     * Refresh cached cell rectangles after horizontal scrolling.
     *
     * @param {Object} snapshot Axis snapshot.
     * @return {void}
     */
    function refresh_axis_rectangles(snapshot) {
      snapshot.cells.forEach(function (cell) {
        cell.rectangle = cell.element.getBoundingClientRect();
      });
    }

    /**
     * Resolve a physical pointer coordinate on the chronological axis.
     *
     * @param {Object} snapshot Axis snapshot.
     * @param {number} client_x Physical viewport coordinate.
     * @return {Object} Cell, chronological index, ratio, units, and instant.
     */
    function pointer_to_axis_position(snapshot, client_x) {
      var cell = snapshot.cells[0];
      var cell_index = 0;
      var closest_distance = Number.POSITIVE_INFINITY;
      var ratio;
      snapshot.cells.some(function (candidate, candidate_index) {
        var distance;
        if (client_x >= candidate.rectangle.left && client_x <= candidate.rectangle.right) {
          cell = candidate;
          cell_index = candidate_index;
          return true;
        }
        distance = Math.min(Math.abs(client_x - candidate.rectangle.left), Math.abs(client_x - candidate.rectangle.right));
        if (distance < closest_distance) {
          closest_distance = distance;
          cell = candidate;
          cell_index = candidate_index;
        }
        return false;
      });
      ratio = (client_x - cell.rectangle.left) / Math.max(1, cell.rectangle.width);
      ratio = Math.max(0, Math.min(1, snapshot.is_rtl ? 1 - ratio : ratio));
      return {
        cell: cell,
        cell_index: cell_index,
        ratio: ratio,
        units: cell_index + ratio,
        epoch: Math.round((cell.start_epoch + (cell.end_epoch - cell.start_epoch) * ratio) / 60000) * 60000
      };
    }

    /**
     * Project a physical pointer coordinate into a loaded-axis instant.
     *
     * @param {Object} snapshot Axis snapshot.
     * @param {number} client_x Physical viewport coordinate.
     * @param {string} operation Resize operation.
     * @param {boolean} is_full_day Whether whole-day snapping is required.
     * @return {number} Bounded epoch milliseconds.
     */
    function pointer_to_epoch(snapshot, client_x, operation, is_full_day) {
      var position = pointer_to_axis_position(snapshot, client_x);
      if (is_full_day) {
        return 'resize_start' === operation ? position.cell.start_epoch : position.cell.end_epoch;
      }
      return position.epoch;
    }

    /**
     * Convert a fractional chronological axis position into an exact instant.
     *
     * @param {Object} snapshot Loaded-axis geometry snapshot.
     * @param {number} units Fractional cell position from the chronological start.
     * @return {number} Minute-rounded, loaded-axis-bounded epoch milliseconds.
     */
    function axis_units_to_epoch(snapshot, units) {
      var bounded_units = Math.max(0, Math.min(snapshot.cells.length, units));
      var cell_index;
      var cell;
      var ratio;
      if (bounded_units >= snapshot.cells.length) {
        return snapshot.cells[snapshot.cells.length - 1].end_epoch;
      }
      cell_index = Math.min(snapshot.cells.length - 1, Math.floor(bounded_units));
      cell = snapshot.cells[cell_index];
      ratio = bounded_units - cell_index;
      return Math.round((cell.start_epoch + (cell.end_epoch - cell.start_epoch) * ratio) / 60000) * 60000;
    }

    /**
     * Move an exact boundary by the pointer delta from a visual card-edge handle.
     *
     * A semantic day card is wider than its canonical time slot. Its handle is
     * intentionally rendered on the visible card edge, so absolute pointer-to-time
     * projection would jump to midnight as soon as dragging starts. Relative axis
     * movement keeps the immutable saved wall time as the drag origin. Release keeps
     * this minute projection for semantic day cards, while canonical Review remains
     * authoritative.
     *
     * @param {Object} snapshot Loaded-axis geometry snapshot.
     * @param {number} client_x Current physical pointer coordinate.
     * @param {Object} gesture Active pointer gesture.
     * @return {number} Exact presentation boundary after applying pointer movement.
     */
    function pointer_delta_to_epoch(snapshot, client_x, gesture) {
      var current_position = pointer_to_axis_position(snapshot, client_x);
      var anchor_interval = get_gesture_anchor_interval();
      var boundary_epoch = 'resize_start' === gesture.operation ? anchor_interval.start_epoch : anchor_interval.end_epoch;
      var boundary_cell_index = find_axis_cell_index(snapshot, boundary_epoch);
      var boundary_cell;
      var boundary_ratio;
      var boundary_units;
      if (-1 === boundary_cell_index) {
        return boundary_epoch;
      }
      boundary_cell = snapshot.cells[boundary_cell_index];
      boundary_ratio = (boundary_epoch - boundary_cell.start_epoch) / Math.max(1, boundary_cell.end_epoch - boundary_cell.start_epoch);
      boundary_units = boundary_cell_index + Math.max(0, Math.min(1, boundary_ratio));
      return axis_units_to_epoch(snapshot, boundary_units + current_position.units - gesture.start_axis_units);
    }

    /**
     * Round an axis-unit delta symmetrically at half a cell.
     *
     * Native Math.round() maps -0.5 to negative zero, which would make the
     * same physical threshold behave differently for start and end contraction.
     *
     * @param {number} delta Fractional Timeline-cell delta.
     * @return {number} Signed whole-cell delta.
     */
    function round_axis_steps(delta) {
      return 0 > delta ? -Math.round(Math.abs(delta)) : Math.round(delta);
    }

    /**
     * Find the loaded cell containing one exact boundary.
     *
     * @param {Object} snapshot Axis snapshot.
     * @param {number} epoch Exact boundary epoch.
     * @return {number} Chronological cell index, or -1 outside the loaded axis.
     */
    function find_axis_cell_index(snapshot, epoch) {
      var match = -1;
      snapshot.cells.some(function (cell, index) {
        if (epoch >= cell.start_epoch && (epoch < cell.end_epoch || index === snapshot.cells.length - 1 && epoch <= cell.end_epoch)) {
          match = index;
          return true;
        }
        return false;
      });
      return match;
    }

    /**
     * Format one epoch as local numeric parts in the site timezone.
     *
     * @param {number} epoch Exact epoch milliseconds.
     * @param {string} timezone IANA site timezone.
     * @return {Object|null} Numeric local parts, or null without Intl support.
     */
    function get_zoned_parts(epoch, timezone) {
      var intl_api = window.Intl || ('undefined' !== typeof Intl ? Intl : null);
      var formatter;
      var values = {};
      if (!intl_api || !timezone || !intl_api.DateTimeFormat.prototype.formatToParts) {
        return null;
      }
      try {
        formatter = new intl_api.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          hourCycle: 'h23',
          minute: '2-digit',
          second: '2-digit'
        });
        formatter.formatToParts(new Date(epoch)).forEach(function (part) {
          if ('literal' !== part.type) {
            values[part.type] = Number(part.value);
          }
        });
      } catch (error) {
        return null;
      }
      return values.year && values.month && values.day ? values : null;
    }

    /**
     * Pad one non-negative integer for an exact instant.
     *
     * @param {number} value Numeric date or offset part.
     * @param {number} length Required output length.
     * @return {string} Zero-padded integer.
     */
    function pad_instant_part(value, length) {
      return String(Math.abs(Math.round(value))).padStart(length, '0');
    }

    /**
     * Format one epoch as an exact minute in the authoritative site timezone.
     *
     * The canonical server repeats timezone, offset, ambiguity, nonexistent-time,
     * and overnight validation. This browser formatter only preserves the exact
     * bounded instant selected on the Timeline axis.
     *
     * @param {number} epoch Exact boundary epoch in milliseconds.
     * @param {string} timezone IANA site timezone.
     * @return {string} RFC3339 minute instant, or an empty string on failure.
     */
    function format_review_instant(epoch, timezone) {
      var parts = get_zoned_parts(epoch, timezone);
      var represented_epoch;
      var offset_minutes;
      var offset_sign;
      if (!parts) {
        return '';
      }
      represented_epoch = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
      offset_minutes = Math.round((represented_epoch - epoch) / 60000);
      offset_sign = 0 <= offset_minutes ? '+' : '-';
      return [pad_instant_part(parts.year, 4), '-', pad_instant_part(parts.month, 2), '-', pad_instant_part(parts.day, 2), 'T', pad_instant_part(parts.hour, 2), ':', pad_instant_part(parts.minute, 2), ':00', offset_sign, pad_instant_part(Math.floor(Math.abs(offset_minutes) / 60), 2), ':', pad_instant_part(Math.abs(offset_minutes) % 60, 2)].join('');
    }

    /**
     * Resolve local wall-clock parts to an exact instant in the site timezone.
     *
     * The canonical Review service still rejects ambiguous or nonexistent DST
     * results. This bounded projection exists only to preserve the saved clock
     * time while presenting whole-day pointer steps.
     *
     * @param {Object} local_parts Complete local date and time parts.
     * @param {string} timezone IANA site timezone.
     * @return {number|null} Exact epoch milliseconds, or null without support.
     */
    function zoned_parts_to_epoch(local_parts, timezone) {
      var utc_guess = Date.UTC(local_parts.year, local_parts.month - 1, local_parts.day, local_parts.hour, local_parts.minute, local_parts.second, local_parts.millisecond);
      var candidate = utc_guess;
      var iteration;
      var candidate_parts;
      var represented_epoch;
      for (iteration = 0; iteration < 2; iteration += 1) {
        candidate_parts = get_zoned_parts(candidate, timezone);
        if (!candidate_parts) {
          return null;
        }
        represented_epoch = Date.UTC(candidate_parts.year, candidate_parts.month - 1, candidate_parts.day, candidate_parts.hour, candidate_parts.minute, candidate_parts.second, local_parts.millisecond);
        candidate += utc_guess - represented_epoch;
      }
      return candidate;
    }

    /**
     * Move an immutable boundary by whole Timeline cells.
     *
     * Sub-day scales retain the exact offset inside their fixed-size cell. The
     * one-day scale reconstructs the same site-local wall clock on the target
     * date so a 14:00 boundary remains 14:00 across ordinary and DST dates.
     *
     * @param {Object} snapshot Axis snapshot.
     * @param {number} boundary_epoch Immutable boundary epoch.
     * @param {number} step_delta Signed whole-cell delta.
     * @return {number} Exact target boundary within the loaded axis.
     */
    function shift_boundary_by_axis_steps(snapshot, boundary_epoch, step_delta) {
      var source_index = find_axis_cell_index(snapshot, boundary_epoch);
      var target_index;
      var source_cell;
      var target_cell;
      var boundary_parts;
      var target_parts;
      var target_epoch;
      if (-1 === source_index) {
        return boundary_epoch;
      }
      target_index = Math.max(0, Math.min(snapshot.cells.length - 1, source_index + step_delta));
      source_cell = snapshot.cells[source_index];
      target_cell = snapshot.cells[target_index];
      if (1440 === snapshot.cell_minutes && snapshot.timezone) {
        boundary_parts = get_zoned_parts(boundary_epoch, snapshot.timezone);
        target_parts = get_zoned_parts(target_cell.start_epoch, snapshot.timezone);
        if (boundary_parts && target_parts) {
          target_epoch = zoned_parts_to_epoch({
            year: target_parts.year,
            month: target_parts.month,
            day: target_parts.day,
            hour: boundary_parts.hour,
            minute: boundary_parts.minute,
            second: boundary_parts.second,
            millisecond: new Date(boundary_epoch).getUTCMilliseconds()
          }, snapshot.timezone);
          if (null !== target_epoch) {
            return target_epoch;
          }
        }
      }
      return target_cell.start_epoch + (boundary_epoch - source_cell.start_epoch);
    }

    /**
     * Project the pointer as a relative whole-cell movement.
     *
     * @param {Object} snapshot Axis snapshot.
     * @param {number} client_x Physical viewport coordinate.
     * @param {Object} gesture Active pointer gesture.
     * @return {number} Exact immutable-boundary projection.
     */
    function pointer_to_step_epoch(snapshot, client_x, gesture) {
      var current_position = pointer_to_axis_position(snapshot, client_x);
      var step_delta = round_axis_steps(current_position.units - gesture.start_axis_units);
      var anchor_interval = get_gesture_anchor_interval();
      var boundary_epoch = 'resize_start' === gesture.operation ? anchor_interval.start_epoch : anchor_interval.end_epoch;
      return shift_boundary_by_axis_steps(snapshot, boundary_epoch, step_delta);
    }

    /**
     * Determine whether release should replace the live proposal with cell snapping.
     *
     * A same-day timed booking uses the complete day cell as a readable visual card,
     * so its border is not the saved time boundary. Its relative minute projection
     * must therefore survive release; snapping that visual border by whole day cells
     * can collapse a real drag back to the unchanged saved time and skip Review.
     * Ordinary timed and full-day cards retain the configured Timeline-step policy.
     *
     * @param {Object} gesture Active pointer gesture.
     * @return {boolean} True when final release uses Timeline-cell snapping.
     */
    function should_snap_release_to_timeline_step(gesture) {
      return snap_to_timeline_step && !gesture.uses_visual_boundary_handle;
    }

    /**
     * Return the anchor interval at the start of one pointer gesture.
     *
     * The first gesture starts from the immutable server context. A deliberate
     * continuation from either reviewed boundary starts from the frozen local
     * proposal, while canonical Review still derives grouped effects from the
     * verified signed base instead of trusting browser-selected group members.
     *
     * @return {Object} Exact presentation interval for the gesture anchor.
     */
    function get_gesture_anchor_interval() {
      var context = active_selection.context;
      var base_intervals = pointer_gesture && pointer_gesture.base_intervals ? pointer_gesture.base_intervals : context.affected_intervals;
      return base_intervals[context.anchor_interval_index];
    }

    /**
     * Convert one loaded-axis instant to a physical viewport coordinate.
     *
     * @param {Object} snapshot Axis snapshot.
     * @param {number} epoch Exact epoch milliseconds.
     * @return {number} Physical viewport coordinate.
     */
    function epoch_to_x(snapshot, epoch) {
      var cell = snapshot.cells[0];
      var ratio;
      if (epoch <= snapshot.min_epoch) {
        return snapshot.is_rtl ? snapshot.cells[0].rectangle.right : snapshot.cells[0].rectangle.left;
      }
      if (epoch >= snapshot.max_epoch) {
        return snapshot.is_rtl ? snapshot.cells[snapshot.cells.length - 1].rectangle.left : snapshot.cells[snapshot.cells.length - 1].rectangle.right;
      }
      snapshot.cells.some(function (candidate, index) {
        cell = candidate;
        return epoch >= candidate.start_epoch && (epoch < candidate.end_epoch || index === snapshot.cells.length - 1 && epoch <= candidate.end_epoch);
      });
      ratio = Math.max(0, Math.min(1, (epoch - cell.start_epoch) / Math.max(1, cell.end_epoch - cell.start_epoch)));
      return snapshot.is_rtl ? cell.rectangle.right - cell.rectangle.width * ratio : cell.rectangle.left + cell.rectangle.width * ratio;
    }

    /**
     * Construct the mutable proposal from immutable server intervals.
     *
     * The same boundary delta is projected across every recurrent or
     * discontinuous occurrence. Canonical Review will later derive and validate
     * the corresponding wall-clock boundary independently for each occurrence.
     *
     * @param {Object} gesture Active gesture.
     * @param {number} candidate_epoch Projected boundary.
     * @return {Object} Mutable presentation proposal.
     */
    function create_proposal(gesture, candidate_epoch) {
      var context = active_selection.context;
      var base_intervals = gesture.base_intervals || context.affected_intervals;
      var anchor_interval = base_intervals[context.anchor_interval_index];
      // Drag-time full-day candidates may be presentation-only partial days;
      // release projects them back to exact calendar-cell boundaries. A positive
      // instant guard keeps the continuous preview from crossing without rejecting
      // valid 23-hour or 25-hour local days at a daylight-saving transition.
      var minimum_duration = -1 !== full_day_shapes.indexOf(context.saved_shape) ? 1 : 60000;
      var changed_boundaries = {
        start: 'resize_start' === gesture.operation,
        end: 'resize_end' === gesture.operation
      };
      var bounded_epoch;
      var delta;
      var intervals;
      if ('resize_start' === gesture.operation) {
        bounded_epoch = Math.max(gesture.axis.min_epoch, Math.min(candidate_epoch, anchor_interval.end_epoch - minimum_duration));
        delta = bounded_epoch - anchor_interval.start_epoch;
      } else {
        bounded_epoch = Math.min(gesture.axis.max_epoch, Math.max(candidate_epoch, anchor_interval.start_epoch + minimum_duration));
        delta = bounded_epoch - anchor_interval.end_epoch;
      }
      intervals = base_intervals.map(function (interval) {
        return {
          start_epoch: 'resize_start' === gesture.operation ? interval.start_epoch + delta : interval.start_epoch,
          end_epoch: 'resize_end' === gesture.operation ? interval.end_epoch + delta : interval.end_epoch
        };
      });
      return {
        interaction_source: 'resize',
        operation: gesture.operation,
        source_context_token: context.source_context_token,
        proposal_revision: context.proposal_revision_seed,
        boundary_epoch: bounded_epoch,
        boundary_instant: new Date(bounded_epoch).toISOString(),
        intervals: intervals,
        changed_boundaries: changed_boundaries,
        signature: [changed_boundaries.start ? 'start' : '', changed_boundaries.end ? 'end' : '', intervals.map(function (interval) {
          return interval.start_epoch + ':' + interval.end_epoch;
        }).join(',')].join('|')
      };
    }

    /**
     * Freeze the exact browser proposal accepted by canonical Review.
     *
     * Only the gesture-anchor interval is transmitted. The source-context token
     * binds the server-derived resize scope and immutable anchor, while canonical
     * Review reloads the booking and derives every affected grouped occurrence.
     * This prevents the browser from choosing or omitting group members.
     *
     * @param {Object} local_proposal Presentation-only proposal.
     * @param {string} timezone Authoritative Timeline axis timezone.
     * @return {Object|null} Frozen canonical Review proposal or null.
     */
    function freeze_review_proposal(local_proposal, timezone) {
      var context = active_selection ? active_selection.context : null;
      var interval = context && local_proposal ? local_proposal.intervals[context.anchor_interval_index] : null;
      var start;
      var end;
      var revision;
      if (!context || !interval || -1 === operations.indexOf(local_proposal.operation)) {
        return null;
      }
      start = format_review_instant(interval.start_epoch, timezone);
      end = format_review_instant(interval.end_epoch, timezone);
      if (!start || !end || Date.parse(end) <= Date.parse(start)) {
        return null;
      }
      revision = Math.max(context.proposal_revision_seed, active_selection.next_proposal_revision || context.proposal_revision_seed);
      active_selection.next_proposal_revision = revision + 1;
      return Object.freeze({
        schema_version: Math.round(Number(review_transport.schema_version)),
        booking_id: context.booking_id,
        interaction_source: 'resize',
        operation: local_proposal.operation,
        target_resource_id: context.target_resource_id,
        selection_method: 'independent_full_days' === context.saved_shape ? 'individual' : 'policy',
        proposed_intervals: Object.freeze([Object.freeze({
          start: start,
          end: end
        })]),
        proposal_revision: revision,
        source_context_token: context.source_context_token
      });
    }

    /**
     * Create the document-level host for the bounded Review panel.
     *
     * The Timeline canvas must retain horizontal scroll ownership and therefore
     * clips block-axis overflow. Mounting Review in the document body keeps
     * its actions reachable without weakening any Timeline clipping boundary.
     *
     * @return {HTMLElement|null} Dedicated host or null.
     */
    function ensure_review_host() {
      if (review_host && review_host.isConnected !== false) {
        return review_host;
      }
      if (!active_selection || !active_selection.card || !document.body) {
        return null;
      }
      review_host = document.createElement('div');
      review_host.className = 'wpbc_timeline_booking_resize__review_host wpbc_timeline_booking_resize__review_portal';
      review_host.setAttribute('data-wpbc-timeline-booking-resize-review-host', '');
      review_host.addEventListener('click', handle_click);
      document.body.appendChild(review_host);
      return review_host;
    }

    /**
     * Size and reposition the existing Review surface without rebuilding it.
     *
     * @return {void}
     */
    function position_review_popover() {
      var card_rectangle;
      var canvas_rectangle;
      var maximum_inline_size;
      var surface;
      var surface_rectangle;
      var surface_width;
      var surface_height;
      var viewport_width;
      var viewport_height;
      var desired_left;
      var desired_top;
      var minimum_left;
      var maximum_left;
      var minimum_top;
      var maximum_bottom;
      var below_top;
      var above_top;
      var placement = 'below';
      review_position_frame = 0;
      if (!review_host || !active_selection || !active_selection.card || !review_scroll_canvas) {
        return;
      }
      card_rectangle = active_selection.card.getBoundingClientRect();
      canvas_rectangle = review_scroll_canvas.getBoundingClientRect();
      surface = review_host.firstElementChild;
      if (!surface || !surface.getBoundingClientRect) {
        return;
      }
      viewport_width = Math.max(0, Number(window.innerWidth) || document.documentElement.clientWidth || 0);
      viewport_height = Math.max(0, Number(window.innerHeight) || document.documentElement.clientHeight || 0);
      minimum_left = Math.max(review_gap, canvas_rectangle.left + review_gap);
      maximum_inline_size = Math.max(0, Math.min(viewport_width - review_gap, canvas_rectangle.right - review_gap) - minimum_left);
      if (surface.style && 0 < maximum_inline_size) {
        if ('function' === typeof surface.style.setProperty) {
          surface.style.setProperty('--wpbc-timeline-booking-resize-review-max-inline-size', Math.round(maximum_inline_size) + 'px');
        } else {
          surface.style['--wpbc-timeline-booking-resize-review-max-inline-size'] = Math.round(maximum_inline_size) + 'px';
        }
      }
      surface_rectangle = surface.getBoundingClientRect();
      surface_width = surface_rectangle.width;
      surface_height = surface_rectangle.height;
      maximum_left = Math.max(minimum_left, Math.min(viewport_width - review_gap, canvas_rectangle.right - review_gap) - surface_width);
      desired_left = Math.max(minimum_left, Math.min(maximum_left, card_rectangle.left));
      minimum_top = Math.max(review_gap, canvas_rectangle.top + review_gap);
      maximum_bottom = Math.min(viewport_height - review_gap, canvas_rectangle.bottom - review_gap);
      if (maximum_bottom <= minimum_top) {
        minimum_top = review_gap;
        maximum_bottom = viewport_height - review_gap;
      }
      below_top = card_rectangle.bottom + review_gap;
      above_top = card_rectangle.top - surface_height - review_gap;
      if (below_top + surface_height <= maximum_bottom) {
        desired_top = below_top;
      } else if (above_top >= minimum_top) {
        desired_top = above_top;
        placement = 'above';
      } else if (card_rectangle.top - minimum_top > maximum_bottom - card_rectangle.bottom) {
        desired_top = Math.max(minimum_top, above_top);
        placement = 'above';
      } else {
        desired_top = Math.max(minimum_top, Math.min(maximum_bottom - surface_height, below_top));
      }
      review_host.style.left = Math.round(desired_left) + 'px';
      review_host.style.top = Math.round(desired_top) + 'px';
      review_host.setAttribute('data-wpbc-timeline-booking-resize-review-placement', placement);
    }

    /**
     * Coalesce Review-popover positioning during scrolling and viewport changes.
     *
     * @return {void}
     */
    function handle_review_scroll() {
      if (!review_position_frame && review_host) {
        review_position_frame = window.requestAnimationFrame(position_review_popover);
      }
    }

    /**
     * Render one Review state through the fixed domain template.
     *
     * @param {Object} view_model Authorized normalized presentation fields.
     * @return {void}
     */
    function render_review(view_model) {
      var host = ensure_review_host();
      if (!host) {
        return;
      }
      render_template(host, 'review', view_model);
      position_review_popover();
    }

    /**
     * Attach the transient scroll positioner while one Review is visible.
     *
     * @return {void}
     */
    function attach_review_positioning() {
      var canvas = mount.querySelector('[data-wpbc-timeline-canvas]');
      if (!canvas) {
        return;
      }
      if (review_scroll_canvas && canvas !== review_scroll_canvas) {
        review_scroll_canvas.removeEventListener('scroll', handle_review_scroll);
      }
      if (canvas !== review_scroll_canvas) {
        review_scroll_canvas = canvas;
        review_scroll_canvas.addEventListener('scroll', handle_review_scroll, {
          passive: true
        });
        window.addEventListener('scroll', handle_review_scroll, {
          capture: true,
          passive: true
        });
        window.addEventListener('resize', handle_review_scroll, {
          passive: true
        });
      }
      position_review_popover();
    }

    /**
     * Remove Review request, positioning, DOM, and signed in-memory state.
     *
     * @param {boolean} abort_pending Whether to abort an active request.
     * @return {void}
     */
    function clear_review(abort_pending) {
      review_generation += 1;
      if (abort_pending && review_request && 'function' === typeof review_request.abort) {
        review_request.abort();
      }
      review_request = null;
      review_memory = null;
      if (review_position_frame) {
        window.cancelAnimationFrame(review_position_frame);
        review_position_frame = 0;
      }
      if (review_scroll_canvas) {
        review_scroll_canvas.removeEventListener('scroll', handle_review_scroll);
        window.removeEventListener('scroll', handle_review_scroll, true);
        window.removeEventListener('resize', handle_review_scroll);
        review_scroll_canvas = null;
      }
      if (review_host && review_host.parentNode) {
        review_host.removeEventListener('click', handle_click);
        review_host.parentNode.removeChild(review_host);
      }
      review_host = null;
    }

    /**
     * Leave a successful Review so an explicit handle gesture can continue.
     *
     * The reviewed local intervals remain the base for either boundary. The prior
     * signed plan is transferred into this one gesture only, then removed from
     * the visible Review state. On release the server verifies that base Review
     * before authorizing the next one-boundary change as a cumulative proposal.
     *
     * @param {string} operation Requested resize operation.
     * @return {Object} Immutable intervals and signed base Review for the gesture.
     */
    function leave_review_for_pointer(operation) {
      var context = active_selection.context;
      var reviewed_proposal = active_selection.proposal;
      var can_continue = reviewed_proposal && review_memory && -1 !== operations.indexOf(operation);
      var base_intervals = can_continue ? reviewed_proposal.intervals : context.affected_intervals;
      var base_review = can_continue ? Object.freeze({
        plan: review_memory.plan,
        token: review_memory.token,
        expires_at: review_memory.expires_at,
        view_model: review_memory.view_model,
        proposal: reviewed_proposal,
        intervals: Object.freeze(base_intervals.map(function (interval) {
          return Object.freeze({
            start_epoch: interval.start_epoch,
            end_epoch: interval.end_epoch
          });
        }))
      }) : null;
      clear_review(false);
      interaction_state = 'ready';
      review_focus_target = null;
      if (!can_continue) {
        clear_ghosts();
        clear_handle_offsets(active_selection.card);
        active_selection.proposal = null;
      }
      return Object.freeze({
        intervals: Object.freeze(base_intervals.map(function (interval) {
          return Object.freeze({
            start_epoch: interval.start_epoch,
            end_epoch: interval.end_epoch
          });
        })),
        base_review: base_review
      });
    }

    /**
     * Restore the prior successful Review after a release snaps to its boundary.
     *
     * The signed plan never leaves controller memory and no request is sent because
     * the proposed schedule is byte-for-byte unchanged from the reviewed base.
     *
     * @param {Object} base_review Prior successful signed Review state.
     * @return {boolean} True when the Review was restored.
     */
    function restore_base_review(base_review) {
      if (!active_selection || !base_review || !base_review.plan || !base_review.proposal || !base_review.view_model || !/^[a-f0-9]{64}$/i.test(String(base_review.token || ''))) {
        return false;
      }
      active_selection.proposal = base_review.proposal;
      review_memory = Object.freeze({
        plan: base_review.plan,
        token: String(base_review.token),
        expires_at: Number(base_review.expires_at) || 0,
        view_model: base_review.view_model
      });
      review_error_base = null;
      interaction_state = 'review_ready';
      render_review(base_review.view_model);
      attach_review_positioning();
      announce(active_selection.card, i18n.review_ready || '');
      return true;
    }

    /**
     * Leave a failed Review so an eligible boundary can be corrected directly.
     *
     * Reusing the same boundary keeps the rejected local intervals as the next
     * gesture base. When that rejected step followed a successful cumulative
     * Review, the last valid signed base is retained so the server can authorize
     * the protected opposite boundary. Switching boundaries discards only the
     * rejected step and resumes from that last valid base. A first-step failure,
     * which has no signed base, continues to use the immutable saved interval.
     *
     * @param {string} operation Requested resize operation.
     * @return {Object} Immutable intervals and the last valid signed base Review, when available.
     */
    function leave_review_error_for_pointer(operation) {
      var context = active_selection.context;
      var failed_proposal = active_selection.proposal;
      var can_correct = failed_proposal && failed_proposal.operation === operation && -1 !== operations.indexOf(operation);
      var signed_base = review_error_base;
      var has_signed_base = signed_base && signed_base.plan && /^[a-f0-9]{64}$/i.test(String(signed_base.token || '')) && Array.isArray(signed_base.intervals);
      var base_intervals = can_correct ? failed_proposal.intervals : has_signed_base ? signed_base.intervals : context.affected_intervals;
      var base_review = has_signed_base ? signed_base : null;
      clear_review(false);
      review_error_base = null;
      interaction_state = 'ready';
      review_focus_target = null;
      if (!can_correct) {
        clear_ghosts();
        clear_handle_offsets(active_selection.card);
        active_selection.proposal = null;
      }
      return Object.freeze({
        intervals: Object.freeze(base_intervals.map(function (interval) {
          return Object.freeze({
            start_epoch: interval.start_epoch,
            end_epoch: interval.end_epoch
          });
        })),
        base_review: base_review
      });
    }

    /**
     * Read one normalized error record from a failed canonical Review response.
     *
     * @param {Object} failed_request  jQuery request.
     * @param {string} fallback_message Operation-specific safe fallback.
     * @return {Object} Safe code and message.
     */
    function get_review_error(failed_request, fallback_message) {
      var error_data = failed_request && failed_request.responseJSON ? failed_request.responseJSON.data : null;
      return {
        code: error_data && 'string' === typeof error_data.code ? error_data.code : '',
        message: error_data && 'string' === typeof error_data.message && error_data.message ? error_data.message : fallback_message || i18n.review_error || i18n.error || ''
      };
    }

    /**
     * Classify one canonical Review failure for administration feedback.
     *
     * HTTP 409 represents an actionable conflict with current booking policy or
     * state. Authentication, malformed, transport, and server failures remain
     * errors even when the endpoint supplies a safe error code.
     *
     * @param {Object} failed_request Failed jQuery request.
     * @return {string} Standard administration notice type.
     */
    function get_review_notice_type(failed_request) {
      return 409 === Number(failed_request && failed_request.status) ? 'warning' : 'error';
    }

    /**
     * Reload direct-resize eligibility once after a stale source response.
     *
     * Review is never retried automatically. A new gesture requires the newly
     * issued source-context token and a new explicit pointer release.
     *
     * @return {void}
     */
    function reload_stale_eligibility() {
      var card = active_selection ? active_selection.card : null;
      var booking_id = active_selection ? active_selection.booking_id : 0;
      var restore_focus = active_selection ? active_selection.restore_focus : null;
      var on_source_stale = active_selection ? active_selection.on_source_stale : null;
      var is_external = Boolean(active_selection && active_selection.is_external);
      clear_review(false);
      review_error_base = null;
      document.removeEventListener('keydown', handle_interaction_keydown, true);
      clear_ghosts();
      if (!active_selection) {
        return;
      }
      clear_handle_offsets(card);
      if (callbacks && 'function' === typeof callbacks.resume_overview) {
        callbacks.resume_overview();
      }
      active_selection.proposal = null;
      active_selection.context = null;
      active_selection.handles = null;
      active_selection.state = 'idle';
      active_selection.request_state = 'idle';
      active_selection.message = i18n.review_stale || '';
      review_focus_target = null;
      interaction_state = 'idle';
      announce(card, active_selection.message);
      show_admin_notice(active_selection.message, 'warning', 5000);
      if (is_external) {
        active_selection = null;
        interaction_state = 'idle';
        if ('function' === typeof on_source_stale) {
          on_source_stale(booking_id);
        }
        if ('function' === typeof restore_focus) {
          restore_focus(booking_id, '');
        }
        return;
      }
      load_eligibility();
    }

    /**
     * Send exactly one canonical Review request for one frozen pointer release.
     *
     * @param {Object} frozen_proposal Exact immutable Review proposal.
     * @param {Object|null} base_review Prior signed Review for a cumulative adjustment.
     * @return {void}
     */
    function request_review(frozen_proposal, base_review) {
      var generation;
      var request_data;
      if (!active_selection || review_request || !frozen_proposal) {
        return;
      }
      interaction_state = 'review_pending';
      review_memory = null;
      review_error_base = null;
      render_review({
        state: 'busy',
        title: i18n.review_title || '',
        message: i18n.review_pending || '',
        can_cancel: true,
        cancel_label: i18n.cancel || ''
      });
      attach_review_positioning();
      generation = review_generation;
      request_data = {
        action: review_transport.action,
        nonce: review_transport.nonce,
        booking_id: frozen_proposal.booking_id,
        source: review_transport.source,
        proposal: JSON.stringify(frozen_proposal)
      };
      if (base_review && base_review.plan && /^[a-f0-9]{64}$/i.test(String(base_review.token || ''))) {
        request_data.base_plan = JSON.stringify(base_review.plan);
        request_data.base_token = String(base_review.token);
      }
      review_request = window.jQuery.ajax({
        url: review_transport.url,
        method: 'POST',
        dataType: 'json',
        data: request_data
      }).done(function (response) {
        var result = response && response.success ? response.data : null;
        var review = result && result.review ? result.review : null;
        var review_view_model;
        if (is_destroyed || generation !== review_generation || !active_selection) {
          return;
        }
        if (!review || Number(review.booking_id) !== frozen_proposal.booking_id || 'resize' !== review.interaction_source || frozen_proposal.operation !== review.operation || !result.plan || !/^[a-f0-9]{64}$/i.test(String(result.token || '')) || Number(result.expires_at) <= Date.now() / 1000) {
          interaction_state = 'review_error';
          review_memory = null;
          review_error_base = base_review || null;
          render_review({
            state: 'error',
            title: i18n.review_title || '',
            message: i18n.review_error || i18n.error || '',
            cancel_label: i18n.cancel || '',
            show_fallback: Boolean(callbacks && 'function' === typeof callbacks.open_full_reschedule),
            fallback_label: i18n.full_dialog || ''
          });
          show_admin_notice(i18n.review_error || i18n.error || '', 'error', 10000);
          return;
        }
        review_view_model = Object.freeze({
          state: 'ready',
          title: i18n.review_title || '',
          resize_impact: review.resize_impact || {},
          interval_description: '',
          duration_description: review.duration && review.duration.proposed_label ? String(review.duration.proposed_label) : '',
          can_cancel: true,
          cancel_label: i18n.cancel || '',
          apply_label: i18n.apply || ''
        });
        review_memory = Object.freeze({
          plan: result.plan,
          token: String(result.token),
          expires_at: Number(result.expires_at) || 0,
          view_model: review_view_model
        });
        review_error_base = null;
        interaction_state = 'review_ready';
        render_review(review_view_model);
        announce(active_selection.card, i18n.review_ready || '');
      }).fail(function (failed_request, request_status) {
        var error;
        var notice_type;
        if (is_destroyed || generation !== review_generation || 'abort' === request_status || !active_selection) {
          return;
        }
        error = get_review_error(failed_request);
        if ('wpbc_booking_rescheduling_source_stale' === error.code) {
          reload_stale_eligibility();
          return;
        }
        review_memory = null;
        review_error_base = base_review || null;
        interaction_state = 'review_error';
        render_review({
          state: 'error',
          title: i18n.review_title || '',
          message: error.message,
          cancel_label: i18n.cancel || '',
          show_fallback: Boolean(callbacks && 'function' === typeof callbacks.open_full_reschedule),
          fallback_label: i18n.full_dialog || ''
        });
        notice_type = get_review_notice_type(failed_request);
        show_admin_notice(error.message, notice_type, 'warning' === notice_type ? 5000 : 10000);
      }).always(function () {
        if (generation === review_generation) {
          review_request = null;
        }
      });
    }

    /**
     * Start canonical Resize Review for geometry owned by another presentation.
     *
     * The caller supplies no mutation authority. This method accepts only the
     * established `resize_start` or `resize_end` proposal shape and submits it to
     * the existing signed Review endpoint. Apply and readback remain unchanged.
     *
     * @param {Object} proposal Exact executable-free Resize Review proposal.
     * @param {Object} state    Presentation card, focus, and stale-state callbacks.
     * @return {boolean} True when the canonical Review lifecycle started.
     */
    function review_resize_proposal(proposal, state) {
      var interval = proposal && Array.isArray(proposal.proposed_intervals) ? proposal.proposed_intervals[0] : null;
      var operation = String(proposal && proposal.operation || '');
      var card = state && state.card ? state.card : null;
      var frozen_proposal;
      if (is_destroyed || -1 !== ['pointer_candidate', 'dragging', 'review_pending', 'review_ready', 'apply_pending', 'refresh_pending'].indexOf(interaction_state) || !card || false === card.isConnected || Number(proposal && proposal.schema_version) !== Number(review_transport.schema_version) || !Number(proposal && proposal.booking_id) || 'resize' !== String(proposal && proposal.interaction_source || '') || -1 === operations.indexOf(operation) || !Number(proposal && proposal.target_resource_id) || -1 === ['policy', 'individual'].indexOf(String(proposal && proposal.selection_method || '')) || !interval || 1 !== proposal.proposed_intervals.length || !is_exact_instant(interval.start) || !is_exact_instant(interval.end) || Date.parse(interval.end) <= Date.parse(interval.start) || !Number(proposal && proposal.proposal_revision) || !String(proposal && proposal.source_context_token || '')) {
        return false;
      }
      cancel_interaction(false, 'external_replaced');
      if (active_selection && active_selection.card) {
        clear_card(active_selection.card);
      }
      abort_request();
      presentation_generation += 1;
      frozen_proposal = Object.freeze({
        schema_version: Math.round(Number(proposal.schema_version)),
        booking_id: Math.round(Number(proposal.booking_id)),
        interaction_source: 'resize',
        operation: operation,
        target_resource_id: Math.round(Number(proposal.target_resource_id)),
        selection_method: String(proposal.selection_method),
        proposed_intervals: Object.freeze([Object.freeze({
          start: String(interval.start),
          end: String(interval.end)
        })]),
        proposal_revision: Math.round(Number(proposal.proposal_revision)),
        source_context_token: String(proposal.source_context_token)
      });
      active_selection = {
        card: card,
        booking_id: frozen_proposal.booking_id,
        segment_id: String(state.segment_id || ''),
        visible_start: String(state.visible_start || interval.start),
        visible_end: String(state.visible_end || interval.end),
        show_start: 'resize_start' === operation,
        show_end: 'resize_end' === operation,
        key: 'external-resize-' + frozen_proposal.booking_id,
        state: 'ready',
        request_state: 'complete',
        handles: null,
        context: state.resize_context || null,
        proposal: {
          operation: operation,
          intervals: [{
            start_epoch: Date.parse(interval.start),
            end_epoch: Date.parse(interval.end)
          }]
        },
        next_proposal_revision: frozen_proposal.proposal_revision + 1,
        message: '',
        is_external: true,
        restore_focus: 'function' === typeof state.restore_focus ? state.restore_focus : null,
        on_source_stale: 'function' === typeof state.on_source_stale ? state.on_source_stale : null
      };
      review_focus_target = state.focus || null;
      if (callbacks && 'function' === typeof callbacks.suspend_overview) {
        callbacks.suspend_overview(card);
      }
      document.addEventListener('keydown', handle_interaction_keydown, true);
      request_review(frozen_proposal, null);
      return true;
    }

    /**
     * Finish a successful Apply only after every canonical host readback succeeds.
     *
     * @return {void}
     */
    function finish_apply_refresh() {
      var card = active_selection ? active_selection.card : null;
      clear_review(false);
      review_error_base = null;
      pending_apply_result = null;
      document.removeEventListener('keydown', handle_interaction_keydown, true);
      clear_ghosts();
      if (active_selection) {
        clear_handle_offsets(card);
        active_selection.proposal = null;
        interaction_state = active_selection.context ? 'ready' : 'idle';
      }
      if (callbacks && 'function' === typeof callbacks.resume_overview) {
        callbacks.resume_overview();
      }
      restore_apply_handle_focus();
      show_admin_notice(i18n.applied || '', 'success', 3000);
    }

    /**
     * Refresh canonical Timeline and Inspector projections after persistence.
     *
     * The retained Apply result is a success identity, not mutation input. A
     * retry invokes only this readback callback and can never resend Apply.
     *
     * @return {void}
     */
    function refresh_after_apply() {
      var refresh_result;
      if (!pending_apply_result || 'refresh_pending' === interaction_state) {
        return;
      }
      interaction_state = 'refresh_pending';
      render_review({
        state: 'busy',
        title: i18n.review_title || '',
        message: i18n.refreshing || '',
        can_cancel: false,
        cancel_label: i18n.cancel || ''
      });
      attach_review_positioning();
      if (!callbacks || 'function' !== typeof callbacks.refresh_after_apply) {
        interaction_state = 'refresh_error';
        render_review({
          state: 'refresh_error',
          title: i18n.review_title || '',
          message: i18n.refresh_error || '',
          can_cancel: true,
          cancel_label: i18n.close || i18n.cancel || '',
          retry_refresh_label: i18n.retry_refresh || ''
        });
        show_admin_notice(i18n.refresh_error || '', 'warning', 10000);
        return;
      }
      try {
        refresh_result = callbacks.refresh_after_apply(pending_apply_result);
      } catch (refresh_error) {
        refresh_result = window.jQuery.Deferred().reject(refresh_error).promise();
      }
      window.jQuery.when(refresh_result).done(function () {
        if (is_destroyed || !pending_apply_result) {
          return;
        }
        finish_apply_refresh();
      }).fail(function () {
        if (is_destroyed || !pending_apply_result) {
          return;
        }
        interaction_state = 'refresh_error';
        render_review({
          state: 'refresh_error',
          title: i18n.review_title || '',
          message: i18n.refresh_error || '',
          can_cancel: true,
          cancel_label: i18n.close || i18n.cancel || '',
          retry_refresh_label: i18n.retry_refresh || ''
        });
        attach_review_positioning();
        show_admin_notice(i18n.refresh_error || '', 'warning', 10000);
      });
    }

    /**
     * Submit exactly one mutation request for the current signed Review.
     *
     * @return {void}
     */
    function request_apply() {
      var apply_memory;
      var booking_id;
      var generation;
      if ('review_ready' !== interaction_state || apply_request || pending_apply_result || !active_selection || !review_memory || !review_memory.plan || !/^[a-f0-9]{64}$/i.test(String(review_memory.token || ''))) {
        return;
      }
      apply_memory = review_memory;
      booking_id = active_selection.booking_id;
      apply_focus_operation = active_selection.proposal && -1 !== operations.indexOf(active_selection.proposal.operation) ? active_selection.proposal.operation : '';
      interaction_state = 'apply_pending';
      render_review({
        state: 'busy',
        title: i18n.review_title || '',
        message: i18n.applying || '',
        can_cancel: false,
        cancel_label: i18n.cancel || ''
      });
      generation = apply_generation;
      apply_request = window.jQuery.ajax({
        url: apply_transport.url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: apply_transport.action,
          nonce: apply_transport.nonce,
          booking_id: booking_id,
          source: apply_transport.source,
          send_modified_email: get_send_modified_email_intent(),
          plan: JSON.stringify(apply_memory.plan),
          token: apply_memory.token
        }
      }).done(function (response) {
        var result = response && response.success ? response.data : null;
        var identity = result && result.canonical_identity ? result.canonical_identity : null;
        if (is_destroyed || generation !== apply_generation || !active_selection) {
          return;
        }
        if (!result || Number(result.booking_id || 0) !== booking_id || !identity || Number(identity.booking_id || 0) !== booking_id || !String(identity.modification_date || '')) {
          pending_apply_result = result || {
            booking_id: booking_id
          };
          interaction_state = 'refresh_error';
          render_review({
            state: 'refresh_error',
            title: i18n.review_title || '',
            message: i18n.refresh_error || '',
            can_cancel: true,
            cancel_label: i18n.close || i18n.cancel || '',
            retry_refresh_label: i18n.retry_refresh || ''
          });
          show_admin_notice(i18n.refresh_error || '', 'warning', 10000);
          return;
        }
        pending_apply_result = result;
        review_memory = null;
        refresh_after_apply();
      }).fail(function (failed_request, request_status) {
        var error;
        var notice_type;
        if (is_destroyed || generation !== apply_generation || 'abort' === request_status || !active_selection) {
          return;
        }
        error = get_review_error(failed_request, i18n.apply_error || i18n.error || '');
        review_memory = null;
        review_error_base = null;
        interaction_state = 'review_error';
        render_review({
          state: 'error',
          title: i18n.review_title || '',
          message: error.message,
          can_cancel: true,
          cancel_label: i18n.cancel || '',
          show_fallback: Boolean(callbacks && 'function' === typeof callbacks.open_full_reschedule),
          fallback_label: i18n.full_dialog || ''
        });
        notice_type = get_review_notice_type(failed_request);
        show_admin_notice(error.message, notice_type, 'warning' === notice_type ? 5000 : 10000);
      }).always(function () {
        if (generation === apply_generation) {
          apply_request = null;
        }
      });
    }

    /**
     * Read the live Timeline notification preference at mutation time.
     *
     * Review is intentionally non-mutating, so the current toggle value must be
     * read only when Apply is submitted rather than stored in the signed plan.
     *
     * @return {number} One when the Modified email was requested; otherwise zero.
     */
    function get_send_modified_email_intent() {
      var email_toggle;
      if ('undefined' === typeof document || 'function' !== typeof document.querySelector) {
        return 0;
      }
      email_toggle = document.querySelector('[data-wpbc-send-modified-email]');
      return email_toggle && email_toggle.checked ? 1 : 0;
    }

    /**
     * Find an affected interval intersecting one visible segment.
     *
     * @param {Object} record Registered segment.
     * @param {Array<Object>} intervals Immutable intervals.
     * @return {number} Matching index or -1.
     */
    function affected_interval_index(record, intervals) {
      var match = -1;
      intervals.some(function (interval, index) {
        if (record.visible_start_epoch < interval.end_epoch && record.visible_end_epoch > interval.start_epoch) {
          match = index;
          return true;
        }
        return false;
      });
      return match;
    }

    /**
     * Create at most one template-owned ghost per visible occurrence.
     *
     * @return {void}
     */
    function create_ghosts() {
      var renderer = get_template('ghost');
      if (!renderer) {
        return;
      }
      clear_ghosts();
      visible_segments.forEach(function (record) {
        var hosts;
        var interval_index;
        if (record.booking_id !== active_selection.booking_id || !record.card.isConnected) {
          return;
        }
        interval_index = affected_interval_index(record, active_selection.context.affected_intervals);
        if (-1 === interval_index) {
          return;
        }
        hosts = get_hosts(record.card);
        if (!hosts.root) {
          return;
        }
        record.ghost_host = document.createElement('span');
        record.ghost_host.className = 'wpbc_timeline_booking_resize__ghost_host';
        record.ghost_host.innerHTML = renderer({
          duration_label: ''
        });
        hosts.root.appendChild(record.ghost_host);
        record.ghost = record.ghost_host.querySelector('[data-wpbc-timeline-booking-resize-ghost]');
        record.ghost_interval_index = interval_index;
        record.card.classList.toggle('is-booking-resizing', true);
        active_ghost_records.push(record);
      });
    }

    /**
     * Format a localized presentation-only duration in compound units.
     *
     * @param {number} milliseconds Positive duration.
     * @return {string} Compact duration label.
     */
    function format_duration(milliseconds) {
      var total_minutes = Math.max(0, Math.round(milliseconds / 60000));
      var days = Math.floor(total_minutes / 1440);
      var hours = Math.floor(total_minutes % 1440 / 60);
      var minutes = total_minutes % 60;
      var parts = [];
      if (days) {
        parts.push(String(1 === days ? i18n.duration_day || '%s day' : i18n.duration_days || '%s days').replace('%s', days));
      }
      if (hours) {
        parts.push(String(1 === hours ? i18n.duration_hour || '%s hour' : i18n.duration_hours || '%s hours').replace('%s', hours));
      }
      if (minutes || !parts.length) {
        parts.push(String(1 === minutes ? i18n.duration_minute || '%s minute' : i18n.duration_minutes || '%s minutes').replace('%s', minutes));
      }
      return parts.join(' ');
    }

    /**
     * Determine whether one proposal boundary differs from canonical state.
     *
     * A cumulative resize can contain an earlier reviewed change on the boundary
     * opposite the current gesture. Geometry must therefore compare both exact
     * proposal instants with the immutable server interval instead of relying on
     * the current gesture's one-boundary authorization flags.
     *
     * @param {Object|null} proposal_interval  Current presentation interval.
     * @param {Object|null} canonical_interval Immutable server interval.
     * @param {string}      boundary           Start or end boundary key.
     * @return {boolean} True when the exact boundary has changed.
     */
    function has_proposed_boundary_change(proposal_interval, canonical_interval, boundary) {
      var epoch_key = 'start' === boundary ? 'start_epoch' : 'end_epoch';
      return Boolean(proposal_interval && canonical_interval && Number(proposal_interval[epoch_key]) !== Number(canonical_interval[epoch_key]));
    }

    /**
     * Project drag-time handle hit areas to the active proposal boundaries.
     *
     * The canonical booking card and authorized handle DOM remain unchanged.
     * Physical pixel offsets are derived from the same refreshed axis snapshot
     * as the dashed ghost, which keeps LTR, RTL, zoom, and horizontal scrolling
     * geometry consistent without adding a permanent scroll listener.
     *
     * @param {Object} proposal Mutable presentation proposal.
     * @param {Object} snapshot Loaded-axis geometry snapshot.
     * @return {void}
     */
    function update_handle_offsets(proposal, snapshot) {
      var card = active_selection && active_selection.card ? active_selection.card : null;
      var context = active_selection ? active_selection.context : null;
      var interval = context && proposal.intervals ? proposal.intervals[context.anchor_interval_index] : null;
      var canonical_interval = context && context.affected_intervals ? context.affected_intervals[context.anchor_interval_index] : null;
      var card_rectangle;
      var visual_start_x;
      var visual_end_x;
      var proposed_start_x;
      var proposed_end_x;
      var start_offset;
      var end_offset;
      if (!card || !card.style || 'function' !== typeof card.style.setProperty || !interval) {
        return;
      }
      card_rectangle = card.getBoundingClientRect();
      visual_start_x = snapshot.is_rtl ? card_rectangle.right : card_rectangle.left;
      visual_end_x = snapshot.is_rtl ? card_rectangle.left : card_rectangle.right;
      proposed_start_x = has_proposed_boundary_change(interval, canonical_interval, 'start') ? epoch_to_x(snapshot, interval.start_epoch) : visual_start_x;
      proposed_end_x = has_proposed_boundary_change(interval, canonical_interval, 'end') ? epoch_to_x(snapshot, interval.end_epoch) : visual_end_x;
      start_offset = Math.round((proposed_start_x - visual_start_x) * 100) / 100;
      end_offset = Math.round((proposed_end_x - visual_end_x) * 100) / 100;
      card.style.setProperty('--wpbc-timeline-booking-resize-start-offset', start_offset + 'px');
      card.style.setProperty('--wpbc-timeline-booking-resize-end-offset', end_offset + 'px');
    }

    /**
     * Update existing ghost styles only when geometry changed.
     *
     * @param {Object} proposal Mutable proposal.
     * @param {Object} snapshot Axis snapshot.
     * @return {void}
     */
    function update_ghosts(proposal, snapshot) {
      update_handle_offsets(proposal, snapshot);
      active_ghost_records.forEach(function (record) {
        var interval;
        var canonical_interval;
        var card_rectangle;
        var start_x;
        var end_x;
        var left;
        var width;
        var duration;
        var key;
        if (!record.ghost || -1 === record.ghost_interval_index || !proposal.intervals[record.ghost_interval_index]) {
          return;
        }
        interval = proposal.intervals[record.ghost_interval_index];
        canonical_interval = active_selection.context.affected_intervals[record.ghost_interval_index];
        card_rectangle = record.card.getBoundingClientRect();
        start_x = has_proposed_boundary_change(interval, canonical_interval, 'start') ? epoch_to_x(snapshot, interval.start_epoch) : snapshot.is_rtl ? card_rectangle.right : card_rectangle.left;
        end_x = has_proposed_boundary_change(interval, canonical_interval, 'end') ? epoch_to_x(snapshot, interval.end_epoch) : snapshot.is_rtl ? card_rectangle.left : card_rectangle.right;
        left = Math.min(start_x, end_x) - card_rectangle.left;
        width = Math.max(2, Math.abs(end_x - start_x));
        duration = format_duration(interval.end_epoch - interval.start_epoch);
        key = [Math.round(left * 100) / 100, Math.round(width * 100) / 100, duration].join('|');
        if (key === record.ghost_geometry_key) {
          return;
        }
        record.ghost.style.left = left + 'px';
        record.ghost.style.top = '0';
        record.ghost.style.width = width + 'px';
        record.ghost.style.height = Math.max(44, card_rectangle.height) + 'px';
        if (record.ghost.firstElementChild) {
          record.ghost.firstElementChild.textContent = duration;
        }
        record.ghost_geometry_key = key;
      });
    }

    /**
     * Schedule at most one pointer or scroll geometry frame.
     *
     * @return {void}
     */
    function schedule_preview() {
      if (!preview_frame && pointer_gesture && 'dragging' === interaction_state) {
        preview_frame = window.requestAnimationFrame(update_preview);
      }
    }

    /**
     * Auto-scroll only within the already-loaded Timeline axis.
     *
     * @param {Object} gesture Active pointer gesture.
     * @return {void}
     */
    function auto_scroll_loaded_axis(gesture) {
      var rectangle = gesture.axis.canvas.getBoundingClientRect();
      var first_rectangle = gesture.axis.cells[0].rectangle;
      var last_rectangle = gesture.axis.cells[gesture.axis.cells.length - 1].rectangle;
      var loaded_left = Math.min(first_rectangle.left, last_rectangle.left);
      var loaded_right = Math.max(first_rectangle.right, last_rectangle.right);
      var distance = 0;
      if (gesture.client_x < rectangle.left + auto_scroll_edge && loaded_left < rectangle.left - 0.5) {
        distance = -auto_scroll_step * (1 - Math.max(0, gesture.client_x - rectangle.left) / auto_scroll_edge);
      } else if (gesture.client_x > rectangle.right - auto_scroll_edge && loaded_right > rectangle.right + 0.5) {
        distance = auto_scroll_step * (1 - Math.max(0, rectangle.right - gesture.client_x) / auto_scroll_edge);
      }
      if (!distance) {
        return;
      }
      if (gesture.axis.is_rtl) {
        distance *= -1;
      }
      if ('function' === typeof gesture.axis.canvas.scrollBy) {
        gesture.axis.canvas.scrollBy({
          left: distance,
          top: 0,
          behavior: 'auto'
        });
      } else {
        gesture.axis.canvas.scrollLeft += distance;
      }
    }

    /**
     * Project the latest pointer into local proposal presentation.
     *
     * Drag frames follow the minute-level pointer coordinate continuously. Final
     * pointer release applies the configured Timeline-step snap except for a
     * semantic day time-slot card, whose visible edge is not its saved boundary.
     * This keeps movement responsive while retaining deterministic boundaries.
     *
     * @param {boolean} snap_for_release Whether this is the final release projection.
     * @return {void}
     */
    function project_preview(snap_for_release) {
      var gesture = pointer_gesture;
      var candidate_epoch;
      var is_full_day;
      var proposal;
      preview_frame = 0;
      if (!gesture || 'dragging' !== interaction_state || gesture.generation !== presentation_generation) {
        return;
      }
      refresh_axis_rectangles(gesture.axis);
      auto_scroll_loaded_axis(gesture);
      is_full_day = -1 !== full_day_shapes.indexOf(active_selection.context.saved_shape);
      candidate_epoch = snap_for_release && should_snap_release_to_timeline_step(gesture) ? pointer_to_step_epoch(gesture.axis, gesture.client_x, gesture) : gesture.uses_visual_boundary_handle ? pointer_delta_to_epoch(gesture.axis, gesture.client_x, gesture) : pointer_to_epoch(gesture.axis, gesture.client_x, gesture.operation, snap_for_release && is_full_day);
      proposal = create_proposal(gesture, candidate_epoch);
      if (active_selection.proposal && active_selection.proposal.signature === proposal.signature && !gesture.did_scroll) {
        return;
      }
      gesture.did_scroll = false;
      active_selection.proposal = proposal;
      update_ghosts(proposal, gesture.axis);
    }

    /**
     * Recalculate a continuous drag preview from the latest pointer position.
     *
     * @return {void}
     */
    function update_preview() {
      project_preview(false);
    }

    /**
     * Recalculate and snap the final proposal immediately before Review.
     *
     * @return {void}
     */
    function finalize_preview() {
      project_preview(true);
    }

    /**
     * Determine whether the final snapped proposal changed its requested boundary.
     *
     * @param {Object|null} proposal       Final local proposal.
     * @param {Array}       base_intervals Immutable intervals at gesture start.
     * @return {boolean} True when Review must validate a changed schedule.
     */
    function proposal_changes_base_boundary(proposal, base_intervals) {
      var boundary_key;
      if (!proposal || !Array.isArray(proposal.intervals) || !Array.isArray(base_intervals) || proposal.intervals.length !== base_intervals.length) {
        return true;
      }
      boundary_key = 'resize_start' === proposal.operation ? 'start_epoch' : 'end_epoch';
      return proposal.intervals.some(function (interval, interval_index) {
        return Number(interval[boundary_key]) !== Number(base_intervals[interval_index][boundary_key]);
      });
    }

    /**
     * Start drag ownership after the threshold is crossed.
     *
     * @return {boolean} True when the immutable axis snapshot was acquired.
     */
    function begin_dragging() {
      var snapshot;
      if (!pointer_gesture || !active_selection || !active_selection.context) {
        return false;
      }
      snapshot = create_axis_snapshot(active_selection.card);
      if (!snapshot || snapshot.generation !== presentation_generation) {
        cancel_interaction(true, 'stale_axis');
        return false;
      }
      pointer_gesture.axis = snapshot;
      pointer_gesture.start_axis_units = pointer_to_axis_position(snapshot, pointer_gesture.start_x).units;
      interaction_state = 'dragging';
      active_selection.card.classList.toggle('is-booking-resizing', true);
      if (callbacks && 'function' === typeof callbacks.set_axis_window_loading_locked) {
        callbacks.set_axis_window_loading_locked(true);
      }
      transient_scroll_canvas = snapshot.canvas;
      transient_scroll_canvas.addEventListener('scroll', handle_resize_scroll, {
        passive: true
      });
      create_ghosts();
      set_dragging_presentation(true);
      schedule_preview();
      return true;
    }

    /**
     * Resolve an authorized handle from one event.
     *
     * @param {Event} event Browser input event.
     * @return {HTMLElement|null} Active handle or null.
     */
    function get_active_handle(event) {
      var handle = event.target && event.target.closest ? event.target.closest('[data-wpbc-timeline-booking-resize-handle]') : null;
      var operation = handle ? String(handle.getAttribute('data-wpbc-timeline-booking-resize-operation') || '') : '';
      if (-1 === ['ready', 'review_ready', 'review_error'].indexOf(interaction_state) || !handle || !active_selection || !active_selection.context || !active_selection.card || !active_selection.card.contains(handle) || -1 === operations.indexOf(operation)) {
        return null;
      }
      if ('resize_start' === operation && !active_selection.context.boundaries.start || 'resize_end' === operation && !active_selection.context.boundaries.end) {
        return null;
      }
      return handle;
    }

    /**
     * Enter pointer-candidate state through delegated pointer input.
     *
     * @param {PointerEvent} event Pointer-down event.
     * @return {void}
     */
    function handle_pointer_down(event) {
      var handle = get_active_handle(event);
      var operation;
      var base_intervals;
      var continuation_state;
      var corrects_review_error;
      var continues_review;
      if (!handle || pointer_gesture || 'mouse' === event.pointerType && 0 !== event.button || false === event.isPrimary) {
        return;
      }
      operation = String(handle.getAttribute('data-wpbc-timeline-booking-resize-operation'));
      continues_review = 'review_ready' === interaction_state;
      corrects_review_error = 'review_error' === interaction_state;
      continuation_state = continues_review ? leave_review_for_pointer(operation) : corrects_review_error ? leave_review_error_for_pointer(operation) : null;
      base_intervals = continuation_state ? continuation_state.intervals : active_selection.context.affected_intervals;
      if (!continues_review && !corrects_review_error) {
        cancel_interaction(false, 'new_pointer');
      }
      interaction_state = 'pointer_candidate';
      pointer_gesture = {
        handle: handle,
        operation: operation,
        base_intervals: base_intervals,
        base_review: continuation_state ? continuation_state.base_review : null,
        pointer_id: event.pointerId,
        pointer_type: event.pointerType || 'mouse',
        start_x: event.clientX,
        start_y: event.clientY,
        client_x: event.clientX,
        client_y: event.clientY,
        generation: presentation_generation,
        axis: null,
        uses_visual_boundary_handle: active_selection.card.classList.contains('is-day-time-slot'),
        did_scroll: false,
        is_finishing: false
      };
      handle.addEventListener('pointermove', handle_pointer_move);
      handle.addEventListener('pointerup', handle_pointer_up);
      handle.addEventListener('pointercancel', handle_pointer_cancel);
      handle.addEventListener('lostpointercapture', handle_lost_pointer_capture);
      document.addEventListener('keydown', handle_interaction_keydown, true);
      if ('function' === typeof handle.setPointerCapture) {
        handle.setPointerCapture(event.pointerId);
      }
      if (!continues_review && !corrects_review_error && callbacks && 'function' === typeof callbacks.suspend_overview) {
        callbacks.suspend_overview(active_selection.card);
      }
      event.stopPropagation();
    }

    /**
     * Update one candidate or active drag pointer.
     *
     * @param {PointerEvent} event Pointer-move event.
     * @return {void}
     */
    function handle_pointer_move(event) {
      var delta_x;
      var delta_y;
      if (!pointer_gesture || event.pointerId !== pointer_gesture.pointer_id) {
        return;
      }
      pointer_gesture.client_x = event.clientX;
      pointer_gesture.client_y = event.clientY;
      delta_x = event.clientX - pointer_gesture.start_x;
      delta_y = event.clientY - pointer_gesture.start_y;
      if ('pointer_candidate' === interaction_state) {
        if ('touch' === pointer_gesture.pointer_type && Math.abs(delta_y) >= touch_vertical_threshold && Math.abs(delta_y) > Math.abs(delta_x)) {
          cancel_interaction(false, 'touch_scroll');
          return;
        }
        if (Math.sqrt(delta_x * delta_x + delta_y * delta_y) < drag_threshold || !begin_dragging()) {
          return;
        }
      }
      if ('dragging' === interaction_state) {
        event.preventDefault();
        event.stopPropagation();
        schedule_preview();
      }
    }

    /**
     * Finish pointer capture, freeze the proposal, and request Review once.
     *
     * @param {PointerEvent} event Pointer-up event.
     * @return {void}
     */
    function handle_pointer_up(event) {
      var frozen_proposal;
      var base_review;
      var base_intervals;
      var timezone;
      if (!pointer_gesture || event.pointerId !== pointer_gesture.pointer_id) {
        return;
      }
      if ('dragging' !== interaction_state) {
        cancel_interaction(true, 'pointer_click');
        return;
      }
      pointer_gesture.client_x = event.clientX;
      if (preview_frame) {
        window.cancelAnimationFrame(preview_frame);
        preview_frame = 0;
      }
      finalize_preview();
      base_review = pointer_gesture.base_review;
      base_intervals = pointer_gesture.base_intervals;
      if (!proposal_changes_base_boundary(active_selection.proposal, base_intervals)) {
        review_focus_target = pointer_gesture.handle;
        suppress_handle_click = true;
        window.setTimeout(function () {
          suppress_handle_click = false;
        }, 0);
        if (base_review) {
          release_pointer_resources(false);
          if (!restore_base_review(base_review)) {
            cancel_interaction(true, 'no_change');
          }
        } else {
          cancel_interaction(true, 'no_change');
        }
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      timezone = pointer_gesture.axis ? pointer_gesture.axis.timezone : '';
      review_focus_target = pointer_gesture.handle;
      frozen_proposal = freeze_review_proposal(active_selection.proposal, timezone);
      suppress_handle_click = true;
      window.setTimeout(function () {
        suppress_handle_click = false;
      }, 0);
      /* Keep title and Overview tooltips suspended while Review owns attention. */
      release_pointer_resources(false);
      if (frozen_proposal) {
        request_review(frozen_proposal, base_review);
      } else {
        interaction_state = 'review_error';
        render_review({
          state: 'error',
          title: i18n.review_title || '',
          message: i18n.review_error || i18n.error || '',
          cancel_label: i18n.cancel || '',
          show_fallback: Boolean(callbacks && 'function' === typeof callbacks.open_full_reschedule),
          fallback_label: i18n.full_dialog || ''
        });
        attach_review_positioning();
        show_admin_notice(i18n.review_error || i18n.error || '', 'error', 10000);
      }
      event.preventDefault();
      event.stopPropagation();
    }

    /**
     * Cancel from the browser pointer-cancellation path.
     *
     * @param {PointerEvent} event Pointer-cancel event.
     * @return {void}
     */
    function handle_pointer_cancel(event) {
      if (pointer_gesture && event.pointerId === pointer_gesture.pointer_id) {
        cancel_interaction(true, 'pointer_cancel');
      }
    }

    /**
     * Cancel when pointer capture is unexpectedly lost.
     *
     * @param {PointerEvent} event Lost-capture event.
     * @return {void}
     */
    function handle_lost_pointer_capture(event) {
      if (pointer_gesture && event.pointerId === pointer_gesture.pointer_id && !pointer_gesture.is_finishing) {
        cancel_interaction(true, 'lost_capture');
      }
    }

    /**
     * Coalesce transient resize scrolling into the preview frame.
     *
     * @return {void}
     */
    function handle_resize_scroll() {
      if (pointer_gesture && 'dragging' === interaction_state) {
        pointer_gesture.did_scroll = true;
        schedule_preview();
      }
    }

    /**
     * Cancel candidate, drag, or canonical Review with Escape.
     *
     * @param {KeyboardEvent} event Document key event.
     * @return {void}
     */
    function handle_interaction_keydown(event) {
      if ('Escape' === event.key && is_interacting()) {
        event.preventDefault();
        event.stopPropagation();
        cancel_interaction(true, 'escape');
      }
    }

    /**
     * Remove pointer, frame, scroll, Overview, and axis-lock resources.
     *
     * @param {boolean} resume_overview Whether the Overview may resume.
     * @return {void}
     */
    function release_pointer_resources(resume_overview) {
      var gesture = pointer_gesture;
      set_dragging_presentation(false);
      if (preview_frame) {
        window.cancelAnimationFrame(preview_frame);
        preview_frame = 0;
      }
      if (transient_scroll_canvas) {
        transient_scroll_canvas.removeEventListener('scroll', handle_resize_scroll);
        transient_scroll_canvas = null;
      }
      if (callbacks && 'function' === typeof callbacks.set_axis_window_loading_locked) {
        callbacks.set_axis_window_loading_locked(false);
      }
      if (gesture && gesture.handle) {
        gesture.is_finishing = true;
        gesture.handle.removeEventListener('pointermove', handle_pointer_move);
        gesture.handle.removeEventListener('pointerup', handle_pointer_up);
        gesture.handle.removeEventListener('pointercancel', handle_pointer_cancel);
        gesture.handle.removeEventListener('lostpointercapture', handle_lost_pointer_capture);
        if ('function' === typeof gesture.handle.hasPointerCapture && gesture.handle.hasPointerCapture(gesture.pointer_id)) {
          gesture.handle.releasePointerCapture(gesture.pointer_id);
        }
      }
      pointer_gesture = null;
      if (resume_overview && callbacks && 'function' === typeof callbacks.resume_overview) {
        callbacks.resume_overview();
      }
    }

    /**
     * Cancel all pointer-preview state without changing canonical cards.
     *
     * @param {boolean} restore_focus Whether to focus the originating handle.
     * @param {string} reason Internal teardown reason.
     * @return {void}
     */
    function cancel_interaction(restore_focus, reason) {
      var focus_target = pointer_gesture && pointer_gesture.handle ? pointer_gesture.handle : review_focus_target;
      if (-1 !== ['apply_pending', 'refresh_pending'].indexOf(interaction_state)) {
        return;
      }
      if (!is_interacting() && !(active_selection && active_selection.proposal)) {
        return;
      }
      interaction_state = 'cancelled';
      clear_review(true);
      review_error_base = null;
      pending_apply_result = null;
      apply_focus_operation = '';
      release_pointer_resources(true);
      document.removeEventListener('keydown', handle_interaction_keydown, true);
      clear_ghosts();
      if (active_selection) {
        clear_handle_offsets(active_selection.card);
        if (active_selection.card && active_selection.card.classList) {
          active_selection.card.classList.toggle('is-booking-resizing', false);
          active_selection.card.classList.toggle('is-booking-resize-dragging', false);
        }
        active_selection.proposal = null;
      }
      interaction_state = active_selection && active_selection.context ? 'ready' : 'idle';
      review_focus_target = null;
      if (active_selection) {
        announce(active_selection.card, 'escape' === reason ? i18n.cancelled || '' : '');
      }
      if (restore_focus && focus_target && focus_target.isConnected && 'function' === typeof focus_target.focus) {
        focus_target.focus();
      }
    }

    /**
     * Prepare for explicit Timeline replacement without DOM observation.
     *
     * @return {void}
     */
    function begin_refresh() {
      var preserves_apply_success = pending_apply_result && 'refresh_pending' === interaction_state;
      presentation_generation += 1;
      if (!preserves_apply_success) {
        cancel_interaction(false, 'window_replaced');
        if (active_selection && active_selection.is_external) {
          reset_active_selection_eligibility();
        }
      } else {
        release_pointer_resources(false);
        clear_ghosts();
        clear_handle_offsets(active_selection ? active_selection.card : null);
        reset_active_selection_eligibility();
      }
      visible_segments = [];
      segment_records = new WeakMap();
      if (!active_selection) {
        return;
      }
      clear_card(active_selection.card);
      active_selection.card = null;
      if (eligibility_request) {
        abort_request();
        active_selection.state = 'idle';
        active_selection.request_state = 'idle';
      }
    }

    /**
     * Reconcile selected identity after explicit Timeline replacement.
     *
     * @param {Object} selection_state Timeline selection identity.
     * @return {void}
     */
    function complete_refresh(selection_state) {
      var replacement_record = null;
      if (!active_selection || !selection_state) {
        return;
      }
      if (Number(selection_state.booking_id || 0) !== active_selection.booking_id) {
        clear_card(active_selection.card);
        abort_request();
        active_selection = null;
        interaction_state = 'idle';
        return;
      }
      if (!active_selection.card) {
        visible_segments.some(function (record) {
          if (record.booking_id === active_selection.booking_id && record.segment_id === String(selection_state.segment_hint || '')) {
            replacement_record = record;
            return true;
          }
          return false;
        });
        if (!replacement_record) {
          visible_segments.some(function (record) {
            if (record.booking_id === active_selection.booking_id) {
              replacement_record = record;
              return true;
            }
            return false;
          });
        }
        if (replacement_record) {
          active_selection.card = replacement_record.card;
          active_selection.segment_id = replacement_record.segment_id;
          active_selection.key = replacement_record.key;
          active_selection.visible_start = replacement_record.visible_start;
          active_selection.visible_end = replacement_record.visible_end;
          active_selection.show_start = replacement_record.show_start;
          active_selection.show_end = replacement_record.show_end;
          reset_active_selection_eligibility();
        }
      }
      if (!active_selection.card) {
        return;
      }
      if ('ready' === active_selection.state && !has_complete_handle_view_model(active_selection.handles)) {
        reset_active_selection_eligibility();
      }
      if ('idle' === active_selection.request_state) {
        load_eligibility();
        return;
      }
      render_active_state();
    }

    /**
     * Open canonical full Reschedule from keyboard activation only.
     *
     * @param {KeyboardEvent} event Keyboard event.
     * @return {boolean} True when the handle owned the event.
     */
    function activate_handle_from_keyboard(event) {
      var handle = get_active_handle(event);
      if (!handle) {
        return false;
      }
      event.preventDefault();
      event.stopPropagation();
      if (callbacks && 'function' === typeof callbacks.open_full_reschedule) {
        callbacks.open_full_reschedule(active_selection.card, handle);
      }
      return true;
    }

    /**
     * Consume handle clicks so pointer input never opens the dialog.
     *
     * @param {MouseEvent} event Timeline click event.
     * @return {boolean} True when a resize handle owned the event.
     */
    function handle_click(event) {
      var cancel = event.target && event.target.closest ? event.target.closest('[data-wpbc-timeline-booking-resize-cancel]') : null;
      var fallback = event.target && event.target.closest ? event.target.closest('[data-wpbc-timeline-booking-resize-fallback]') : null;
      var apply = event.target && event.target.closest ? event.target.closest('[data-wpbc-timeline-booking-resize-apply]') : null;
      var retry_refresh = event.target && event.target.closest ? event.target.closest('[data-wpbc-timeline-booking-resize-retry-refresh]') : null;
      var handle = event.target && event.target.closest ? event.target.closest('[data-wpbc-timeline-booking-resize-handle]') : null;
      var card;
      var focus_target;
      if (cancel) {
        event.preventDefault();
        event.stopPropagation();
        cancel_interaction(true, 'review_cancel');
        return true;
      }
      if (fallback) {
        event.preventDefault();
        event.stopPropagation();
        card = active_selection ? active_selection.card : null;
        focus_target = review_focus_target;
        cancel_interaction(false, 'review_fallback');
        if (card && callbacks && 'function' === typeof callbacks.open_full_reschedule) {
          callbacks.open_full_reschedule(card, focus_target);
        }
        return true;
      }
      if (apply) {
        event.preventDefault();
        event.stopPropagation();
        request_apply();
        return true;
      }
      if (retry_refresh) {
        event.preventDefault();
        event.stopPropagation();
        refresh_after_apply();
        return true;
      }
      if (!handle) {
        return false;
      }
      event.preventDefault();
      event.stopPropagation();
      if (suppress_handle_click) {
        suppress_handle_click = false;
      }
      return true;
    }

    /**
     * Handle Enter or Space without a keyboard resize mode.
     *
     * @param {KeyboardEvent} event Timeline key event.
     * @return {boolean} True when an active handle owned the event.
     */
    function handle_keydown(event) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || -1 === ['Enter', ' '].indexOf(event.key)) {
        return false;
      }
      return activate_handle_from_keyboard(event);
    }

    /**
     * Report whether pointer-preview state owns interaction attention.
     *
     * @return {boolean} True while pointer preview or Review owns attention.
     */
    function is_interacting() {
      return -1 !== ['pointer_candidate', 'dragging', 'review_pending', 'review_ready', 'review_error', 'apply_pending', 'refresh_pending', 'refresh_error'].indexOf(interaction_state);
    }

    /**
     * Destroy all owned requests, listeners, frames, and presentation.
     *
     * @return {void}
     */
    function destroy() {
      if (is_destroyed) {
        return;
      }
      is_destroyed = true;
      apply_generation += 1;
      mount.removeEventListener('pointerdown', handle_pointer_down, true);
      if (-1 === ['apply_pending', 'refresh_pending'].indexOf(interaction_state)) {
        cancel_interaction(false, 'destroyed');
      } else {
        clear_review(false);
      }
      document.removeEventListener('keydown', handle_interaction_keydown, true);
      if (active_selection) {
        clear_card(active_selection.card);
      }
      clear_ghosts();
      abort_request();
      apply_request = null;
      pending_apply_result = null;
      active_selection = null;
      visible_segments = [];
      interaction_state = 'idle';
    }
    return {
      select: select,
      register_segment: register_segment,
      begin_refresh: begin_refresh,
      complete_refresh: complete_refresh,
      handle_click: handle_click,
      handle_keydown: handle_keydown,
      review_resize_proposal: review_resize_proposal,
      is_interacting: is_interacting,
      destroy: destroy
    };
  }
  window.wpbc_timeline_booking_resizing = window.wpbc_timeline_booking_resizing || {};
  window.wpbc_timeline_booking_resizing.create_controller = create_controller;
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS10aW1lbGluZS9ib29raW5nLXJlc2l6aW5nL19vdXQvYm9va2luZy1yZXNpemluZy5qcyIsIm5hbWVzIjpbIndpbmRvdyIsImRvY3VtZW50IiwidGVtcGxhdGVfa2V5cyIsInN1cHBvcnRlZF9zaGFwZXMiLCJmdWxsX2RheV9zaGFwZXMiLCJvcGVyYXRpb25zIiwiZHJhZ190aHJlc2hvbGQiLCJ0b3VjaF92ZXJ0aWNhbF90aHJlc2hvbGQiLCJhdXRvX3Njcm9sbF9lZGdlIiwiYXV0b19zY3JvbGxfc3RlcCIsInJldmlld19nYXAiLCJjcmVhdGVfY29udHJvbGxlciIsIm1vdW50IiwiY29uZmlndXJhdGlvbiIsImNhbGxiYWNrcyIsInRyYW5zcG9ydCIsInJldmlld190cmFuc3BvcnQiLCJhcHBseV90cmFuc3BvcnQiLCJ0ZW1wbGF0ZXMiLCJwb2ludGVyX2NvbmZpZ3VyYXRpb24iLCJwb2ludGVyIiwiaTE4biIsInNuYXBfdG9fdGltZWxpbmVfc3RlcCIsInNlZ21lbnRfcmVjb3JkcyIsIldlYWtNYXAiLCJ2aXNpYmxlX3NlZ21lbnRzIiwiYWN0aXZlX2dob3N0X3JlY29yZHMiLCJhY3RpdmVfc2VsZWN0aW9uIiwiZWxpZ2liaWxpdHlfcmVxdWVzdCIsInJlcXVlc3RfZ2VuZXJhdGlvbiIsInByZXNlbnRhdGlvbl9nZW5lcmF0aW9uIiwiaW50ZXJhY3Rpb25fc3RhdGUiLCJwb2ludGVyX2dlc3R1cmUiLCJwcmV2aWV3X2ZyYW1lIiwidHJhbnNpZW50X3Njcm9sbF9jYW52YXMiLCJyZXZpZXdfcmVxdWVzdCIsInJldmlld19nZW5lcmF0aW9uIiwicmV2aWV3X2hvc3QiLCJyZXZpZXdfc2Nyb2xsX2NhbnZhcyIsInJldmlld19wb3NpdGlvbl9mcmFtZSIsInJldmlld19mb2N1c190YXJnZXQiLCJyZXZpZXdfbWVtb3J5IiwicmV2aWV3X2Vycm9yX2Jhc2UiLCJhcHBseV9yZXF1ZXN0IiwiYXBwbHlfZ2VuZXJhdGlvbiIsInBlbmRpbmdfYXBwbHlfcmVzdWx0IiwiYXBwbHlfZm9jdXNfb3BlcmF0aW9uIiwic3VwcHJlc3NfaGFuZGxlX2NsaWNrIiwiaXNfZGVzdHJveWVkIiwiaGFzX3JlcXVpcmVkX2NvbnRyYWN0IiwiYWRkRXZlbnRMaXN0ZW5lciIsImhhbmRsZV9wb2ludGVyX2Rvd24iLCJCb29sZWFuIiwialF1ZXJ5Iiwid3AiLCJ0ZW1wbGF0ZSIsInVybCIsImFjdGlvbiIsIm5vbmNlIiwic291cmNlIiwiTnVtYmVyIiwic2NoZW1hX3ZlcnNpb24iLCJldmVyeSIsImtleSIsInRlc3QiLCJnZXRfdGVtcGxhdGUiLCJpbmRleE9mIiwicmVuZGVyX3RlbXBsYXRlIiwiaG9zdCIsInZpZXdfbW9kZWwiLCJyZW5kZXJlciIsIm1hcmt1cCIsImlubmVySFRNTCIsImNsZWFyX2hvc3QiLCJjaGlsZE5vZGVzIiwibGVuZ3RoIiwidGV4dENvbnRlbnQiLCJyZXBsYWNlQ2hpbGRyZW4iLCJnZXRfaG9zdHMiLCJjYXJkIiwicm9vdCIsInF1ZXJ5U2VsZWN0b3IiLCJ2aXN1YWwiLCJsaXZlIiwicmV2aWV3IiwiY2xlYXJfaGFuZGxlX29mZnNldHMiLCJzdHlsZSIsInJlbW92ZVByb3BlcnR5Iiwic2V0X3ByZXNlbnRhdGlvbl9zdGF0ZSIsInN0YXRlIiwiaXNfcmVhZHkiLCJoYW5kbGVzIiwic3RhcnRfaXNfZWxpZ2libGUiLCJzdGFydCIsImVsaWdpYmxlIiwiZW5kX2lzX2VsaWdpYmxlIiwiZW5kIiwic3RhcnRfaXNfdW5hdmFpbGFibGUiLCJlbmRfaXNfdW5hdmFpbGFibGUiLCJjbGFzc0xpc3QiLCJ0b2dnbGUiLCJhbm5vdW5jZSIsIm1lc3NhZ2UiLCJTdHJpbmciLCJzaG93X2FkbWluX25vdGljZSIsIm1lc3NhZ2VfdHlwZSIsImRlbGF5Iiwic2hvd19hZG1pbl9tZXNzYWdlIiwiZ2V0X2VsaWdpYmlsaXR5X3dhcm5pbmciLCJkdG8iLCJjb250ZXh0IiwiZGVuaWFsX3JlYXNvbnMiLCJyZWFzb24iLCJib3VuZGFyaWVzIiwiZmFsbGJhY2siLCJkZW5pZWQiLCJmYWxsYmFja19yZWFzb24iLCJwYXJ0aWFsbHlfcmVhZHkiLCJnZXRfcmVxdWVzdF9lcnJvcl9tZXNzYWdlIiwiZmFpbGVkX3JlcXVlc3QiLCJlcnJvcl9kYXRhIiwicmVzcG9uc2VKU09OIiwiZGF0YSIsImNsZWFyX2dob3N0cyIsImZvckVhY2giLCJyZWNvcmQiLCJnaG9zdF9ob3N0IiwicGFyZW50Tm9kZSIsInJlbW92ZUNoaWxkIiwiZ2hvc3QiLCJnaG9zdF9pbnRlcnZhbF9pbmRleCIsImdob3N0X2dlb21ldHJ5X2tleSIsInNldF9kcmFnZ2luZ19wcmVzZW50YXRpb24iLCJpc19kcmFnZ2luZyIsImFjdGl2ZV9oYW5kbGUiLCJoYW5kbGUiLCJjbGVhcl9jYXJkIiwiaG9zdHMiLCJpc19leGFjdF9pbnN0YW50IiwiaW5zdGFudCIsImlzTmFOIiwiRGF0ZSIsInBhcnNlIiwibm9ybWFsaXplX3NlZ21lbnQiLCJzZWdtZW50IiwiYm9va2luZ19pZCIsIk1hdGgiLCJtYXgiLCJyb3VuZCIsInNlZ21lbnRfaWQiLCJ2aXNpYmxlX3N0YXJ0IiwidmlzaWJsZV9lbmQiLCJ2aXNpYmxlX3N0YXJ0X2Vwb2NoIiwidmlzaWJsZV9lbmRfZXBvY2giLCJzaG93X3N0YXJ0IiwiaXNfY2xpcHBlZF9zdGFydCIsInNob3dfZW5kIiwiaXNfY2xpcHBlZF9lbmQiLCJqb2luIiwibm9ybWFsaXplX2ludGVydmFsIiwiaW50ZXJ2YWwiLCJPYmplY3QiLCJmcmVlemUiLCJzdGFydF9lcG9jaCIsImVuZF9lcG9jaCIsIm5vcm1hbGl6ZV9jb250ZXh0IiwicmVzcG9uc2UiLCJzdWNjZXNzIiwicmVzaXplX2NvbnRleHQiLCJpbW11dGFibGVfaW50ZXJ2YWwiLCJhZmZlY3RlZF9pbnRlcnZhbHMiLCJhbmNob3JfaW50ZXJ2YWxfaW5kZXgiLCJzaGFwZSIsInRhcmdldF9yZXNvdXJjZV9pZCIsImludGVyYWN0aW9uX3NvdXJjZSIsInNvdXJjZV9jb250ZXh0X3Rva2VuIiwic2F2ZWRfc2hhcGUiLCJBcnJheSIsImlzQXJyYXkiLCJtYXAiLCJmaWx0ZXIiLCJhZmZlY3RlZF9pbnRlcnZhbF9jb3VudCIsInNvbWUiLCJpbmRleCIsInJlc2l6ZV9zY29wZSIsInByb3Bvc2FsX3JldmlzaW9uX3NlZWQiLCJwcm9wb3NhbF9yZXZpc2lvbiIsInNsaWNlIiwib3BlcmF0aW9uIiwicHJvamVjdF9oYW5kbGVzIiwiZ3JvdXBfbGFiZWwiLCJsYWJlbCIsInJlc2l6ZV9zdGFydCIsInJlc2l6ZV9lbmQiLCJoYXNfY29tcGxldGVfaGFuZGxlX3ZpZXdfbW9kZWwiLCJyZXNldF9hY3RpdmVfc2VsZWN0aW9uX2VsaWdpYmlsaXR5IiwicmVxdWVzdF9zdGF0ZSIsInByb3Bvc2FsIiwiaXNfZXh0ZXJuYWwiLCJyZW5kZXJfYWN0aXZlX3N0YXRlIiwiaXNDb25uZWN0ZWQiLCJjaGVja2luZyIsInJlYWR5IiwicmVzdG9yZV9hcHBseV9oYW5kbGVfZm9jdXMiLCJmb2N1c190YXJnZXQiLCJyZXN0b3JlX2ZvY3VzIiwiZGlzYWJsZWQiLCJmb2N1cyIsImFib3J0X3JlcXVlc3QiLCJhYm9ydCIsImxvYWRfZWxpZ2liaWxpdHkiLCJnZW5lcmF0aW9uIiwiYWpheCIsIm1ldGhvZCIsImRhdGFUeXBlIiwidmlzaWJsZV9zdGFydF9hdCIsInZpc2libGVfZW5kX2F0IiwiZG9uZSIsIndhcm5pbmdfbWVzc2FnZSIsImlzX2V4cGxpY2l0X2RlbmlhbCIsIm5leHRfcHJvcG9zYWxfcmV2aXNpb24iLCJlcnJvciIsImZhaWwiLCJyZXF1ZXN0X3N0YXR1cyIsImFsd2F5cyIsInJlZ2lzdGVyX3NlZ21lbnQiLCJzZXQiLCJwdXNoIiwic2VsZWN0Iiwic2VsZWN0aW9uX3NvdXJjZSIsImNsb3Nlc3QiLCJnZXQiLCJjYW5jZWxfaW50ZXJhY3Rpb24iLCJjcmVhdGVfYXhpc19zbmFwc2hvdCIsInJvdyIsImNhbnZhcyIsImVsZW1lbnRzIiwicXVlcnlTZWxlY3RvckFsbCIsImNlbGxzIiwiYXhpcyIsImdldF9heGlzIiwicHJvdG90eXBlIiwiY2FsbCIsImVsZW1lbnQiLCJnZXRBdHRyaWJ1dGUiLCJyZWN0YW5nbGUiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJpc19ydGwiLCJsZWZ0IiwiY2VsbF9taW51dGVzIiwidGltZXpvbmUiLCJtaW5fZXBvY2giLCJtYXhfZXBvY2giLCJyZWZyZXNoX2F4aXNfcmVjdGFuZ2xlcyIsInNuYXBzaG90IiwiY2VsbCIsInBvaW50ZXJfdG9fYXhpc19wb3NpdGlvbiIsImNsaWVudF94IiwiY2VsbF9pbmRleCIsImNsb3Nlc3RfZGlzdGFuY2UiLCJQT1NJVElWRV9JTkZJTklUWSIsInJhdGlvIiwiY2FuZGlkYXRlIiwiY2FuZGlkYXRlX2luZGV4IiwiZGlzdGFuY2UiLCJyaWdodCIsIm1pbiIsImFicyIsIndpZHRoIiwidW5pdHMiLCJlcG9jaCIsInBvaW50ZXJfdG9fZXBvY2giLCJpc19mdWxsX2RheSIsInBvc2l0aW9uIiwiYXhpc191bml0c190b19lcG9jaCIsImJvdW5kZWRfdW5pdHMiLCJmbG9vciIsInBvaW50ZXJfZGVsdGFfdG9fZXBvY2giLCJnZXN0dXJlIiwiY3VycmVudF9wb3NpdGlvbiIsImFuY2hvcl9pbnRlcnZhbCIsImdldF9nZXN0dXJlX2FuY2hvcl9pbnRlcnZhbCIsImJvdW5kYXJ5X2Vwb2NoIiwiYm91bmRhcnlfY2VsbF9pbmRleCIsImZpbmRfYXhpc19jZWxsX2luZGV4IiwiYm91bmRhcnlfY2VsbCIsImJvdW5kYXJ5X3JhdGlvIiwiYm91bmRhcnlfdW5pdHMiLCJzdGFydF9heGlzX3VuaXRzIiwicm91bmRfYXhpc19zdGVwcyIsImRlbHRhIiwibWF0Y2giLCJnZXRfem9uZWRfcGFydHMiLCJpbnRsX2FwaSIsIkludGwiLCJmb3JtYXR0ZXIiLCJ2YWx1ZXMiLCJEYXRlVGltZUZvcm1hdCIsImZvcm1hdFRvUGFydHMiLCJ0aW1lWm9uZSIsInllYXIiLCJtb250aCIsImRheSIsImhvdXIiLCJob3VyQ3ljbGUiLCJtaW51dGUiLCJzZWNvbmQiLCJwYXJ0IiwidHlwZSIsInZhbHVlIiwicGFkX2luc3RhbnRfcGFydCIsInBhZFN0YXJ0IiwiZm9ybWF0X3Jldmlld19pbnN0YW50IiwicGFydHMiLCJyZXByZXNlbnRlZF9lcG9jaCIsIm9mZnNldF9taW51dGVzIiwib2Zmc2V0X3NpZ24iLCJVVEMiLCJ6b25lZF9wYXJ0c190b19lcG9jaCIsImxvY2FsX3BhcnRzIiwidXRjX2d1ZXNzIiwibWlsbGlzZWNvbmQiLCJpdGVyYXRpb24iLCJjYW5kaWRhdGVfcGFydHMiLCJzaGlmdF9ib3VuZGFyeV9ieV9heGlzX3N0ZXBzIiwic3RlcF9kZWx0YSIsInNvdXJjZV9pbmRleCIsInRhcmdldF9pbmRleCIsInNvdXJjZV9jZWxsIiwidGFyZ2V0X2NlbGwiLCJib3VuZGFyeV9wYXJ0cyIsInRhcmdldF9wYXJ0cyIsInRhcmdldF9lcG9jaCIsImdldFVUQ01pbGxpc2Vjb25kcyIsInBvaW50ZXJfdG9fc3RlcF9lcG9jaCIsInNob3VsZF9zbmFwX3JlbGVhc2VfdG9fdGltZWxpbmVfc3RlcCIsInVzZXNfdmlzdWFsX2JvdW5kYXJ5X2hhbmRsZSIsImJhc2VfaW50ZXJ2YWxzIiwiZXBvY2hfdG9feCIsImNyZWF0ZV9wcm9wb3NhbCIsImNhbmRpZGF0ZV9lcG9jaCIsIm1pbmltdW1fZHVyYXRpb24iLCJjaGFuZ2VkX2JvdW5kYXJpZXMiLCJib3VuZGVkX2Vwb2NoIiwiaW50ZXJ2YWxzIiwiYm91bmRhcnlfaW5zdGFudCIsInRvSVNPU3RyaW5nIiwic2lnbmF0dXJlIiwiZnJlZXplX3Jldmlld19wcm9wb3NhbCIsImxvY2FsX3Byb3Bvc2FsIiwicmV2aXNpb24iLCJzZWxlY3Rpb25fbWV0aG9kIiwicHJvcG9zZWRfaW50ZXJ2YWxzIiwiZW5zdXJlX3Jldmlld19ob3N0IiwiYm9keSIsImNyZWF0ZUVsZW1lbnQiLCJjbGFzc05hbWUiLCJzZXRBdHRyaWJ1dGUiLCJoYW5kbGVfY2xpY2siLCJhcHBlbmRDaGlsZCIsInBvc2l0aW9uX3Jldmlld19wb3BvdmVyIiwiY2FyZF9yZWN0YW5nbGUiLCJjYW52YXNfcmVjdGFuZ2xlIiwibWF4aW11bV9pbmxpbmVfc2l6ZSIsInN1cmZhY2UiLCJzdXJmYWNlX3JlY3RhbmdsZSIsInN1cmZhY2Vfd2lkdGgiLCJzdXJmYWNlX2hlaWdodCIsInZpZXdwb3J0X3dpZHRoIiwidmlld3BvcnRfaGVpZ2h0IiwiZGVzaXJlZF9sZWZ0IiwiZGVzaXJlZF90b3AiLCJtaW5pbXVtX2xlZnQiLCJtYXhpbXVtX2xlZnQiLCJtaW5pbXVtX3RvcCIsIm1heGltdW1fYm90dG9tIiwiYmVsb3dfdG9wIiwiYWJvdmVfdG9wIiwicGxhY2VtZW50IiwiZmlyc3RFbGVtZW50Q2hpbGQiLCJpbm5lcldpZHRoIiwiZG9jdW1lbnRFbGVtZW50IiwiY2xpZW50V2lkdGgiLCJpbm5lckhlaWdodCIsImNsaWVudEhlaWdodCIsInNldFByb3BlcnR5IiwiaGVpZ2h0IiwidG9wIiwiYm90dG9tIiwiaGFuZGxlX3Jldmlld19zY3JvbGwiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJyZW5kZXJfcmV2aWV3IiwiYXR0YWNoX3Jldmlld19wb3NpdGlvbmluZyIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJwYXNzaXZlIiwiY2FwdHVyZSIsImNsZWFyX3JldmlldyIsImFib3J0X3BlbmRpbmciLCJjYW5jZWxBbmltYXRpb25GcmFtZSIsImxlYXZlX3Jldmlld19mb3JfcG9pbnRlciIsInJldmlld2VkX3Byb3Bvc2FsIiwiY2FuX2NvbnRpbnVlIiwiYmFzZV9yZXZpZXciLCJwbGFuIiwidG9rZW4iLCJleHBpcmVzX2F0IiwicmVzdG9yZV9iYXNlX3JldmlldyIsInJldmlld19yZWFkeSIsImxlYXZlX3Jldmlld19lcnJvcl9mb3JfcG9pbnRlciIsImZhaWxlZF9wcm9wb3NhbCIsImNhbl9jb3JyZWN0Iiwic2lnbmVkX2Jhc2UiLCJoYXNfc2lnbmVkX2Jhc2UiLCJnZXRfcmV2aWV3X2Vycm9yIiwiZmFsbGJhY2tfbWVzc2FnZSIsImNvZGUiLCJyZXZpZXdfZXJyb3IiLCJnZXRfcmV2aWV3X25vdGljZV90eXBlIiwic3RhdHVzIiwicmVsb2FkX3N0YWxlX2VsaWdpYmlsaXR5Iiwib25fc291cmNlX3N0YWxlIiwiaGFuZGxlX2ludGVyYWN0aW9uX2tleWRvd24iLCJyZXN1bWVfb3ZlcnZpZXciLCJyZXZpZXdfc3RhbGUiLCJyZXF1ZXN0X3JldmlldyIsImZyb3plbl9wcm9wb3NhbCIsInJlcXVlc3RfZGF0YSIsInRpdGxlIiwicmV2aWV3X3RpdGxlIiwicmV2aWV3X3BlbmRpbmciLCJjYW5fY2FuY2VsIiwiY2FuY2VsX2xhYmVsIiwiY2FuY2VsIiwiSlNPTiIsInN0cmluZ2lmeSIsImJhc2VfcGxhbiIsImJhc2VfdG9rZW4iLCJyZXN1bHQiLCJyZXZpZXdfdmlld19tb2RlbCIsIm5vdyIsInNob3dfZmFsbGJhY2siLCJvcGVuX2Z1bGxfcmVzY2hlZHVsZSIsImZhbGxiYWNrX2xhYmVsIiwiZnVsbF9kaWFsb2ciLCJyZXNpemVfaW1wYWN0IiwiaW50ZXJ2YWxfZGVzY3JpcHRpb24iLCJkdXJhdGlvbl9kZXNjcmlwdGlvbiIsImR1cmF0aW9uIiwicHJvcG9zZWRfbGFiZWwiLCJhcHBseV9sYWJlbCIsImFwcGx5Iiwibm90aWNlX3R5cGUiLCJyZXZpZXdfcmVzaXplX3Byb3Bvc2FsIiwic3VzcGVuZF9vdmVydmlldyIsImZpbmlzaF9hcHBseV9yZWZyZXNoIiwiYXBwbGllZCIsInJlZnJlc2hfYWZ0ZXJfYXBwbHkiLCJyZWZyZXNoX3Jlc3VsdCIsInJlZnJlc2hpbmciLCJyZWZyZXNoX2Vycm9yIiwiY2xvc2UiLCJyZXRyeV9yZWZyZXNoX2xhYmVsIiwicmV0cnlfcmVmcmVzaCIsIkRlZmVycmVkIiwicmVqZWN0IiwicHJvbWlzZSIsIndoZW4iLCJyZXF1ZXN0X2FwcGx5IiwiYXBwbHlfbWVtb3J5IiwiYXBwbHlpbmciLCJzZW5kX21vZGlmaWVkX2VtYWlsIiwiZ2V0X3NlbmRfbW9kaWZpZWRfZW1haWxfaW50ZW50IiwiaWRlbnRpdHkiLCJjYW5vbmljYWxfaWRlbnRpdHkiLCJtb2RpZmljYXRpb25fZGF0ZSIsImFwcGx5X2Vycm9yIiwiZW1haWxfdG9nZ2xlIiwiY2hlY2tlZCIsImFmZmVjdGVkX2ludGVydmFsX2luZGV4IiwiY3JlYXRlX2dob3N0cyIsImludGVydmFsX2luZGV4IiwiZHVyYXRpb25fbGFiZWwiLCJmb3JtYXRfZHVyYXRpb24iLCJtaWxsaXNlY29uZHMiLCJ0b3RhbF9taW51dGVzIiwiZGF5cyIsImhvdXJzIiwibWludXRlcyIsImR1cmF0aW9uX2RheSIsImR1cmF0aW9uX2RheXMiLCJyZXBsYWNlIiwiZHVyYXRpb25faG91ciIsImR1cmF0aW9uX2hvdXJzIiwiZHVyYXRpb25fbWludXRlIiwiZHVyYXRpb25fbWludXRlcyIsImhhc19wcm9wb3NlZF9ib3VuZGFyeV9jaGFuZ2UiLCJwcm9wb3NhbF9pbnRlcnZhbCIsImNhbm9uaWNhbF9pbnRlcnZhbCIsImJvdW5kYXJ5IiwiZXBvY2hfa2V5IiwidXBkYXRlX2hhbmRsZV9vZmZzZXRzIiwidmlzdWFsX3N0YXJ0X3giLCJ2aXN1YWxfZW5kX3giLCJwcm9wb3NlZF9zdGFydF94IiwicHJvcG9zZWRfZW5kX3giLCJzdGFydF9vZmZzZXQiLCJlbmRfb2Zmc2V0IiwidXBkYXRlX2dob3N0cyIsInN0YXJ0X3giLCJlbmRfeCIsInNjaGVkdWxlX3ByZXZpZXciLCJ1cGRhdGVfcHJldmlldyIsImF1dG9fc2Nyb2xsX2xvYWRlZF9heGlzIiwiZmlyc3RfcmVjdGFuZ2xlIiwibGFzdF9yZWN0YW5nbGUiLCJsb2FkZWRfbGVmdCIsImxvYWRlZF9yaWdodCIsInNjcm9sbEJ5IiwiYmVoYXZpb3IiLCJzY3JvbGxMZWZ0IiwicHJvamVjdF9wcmV2aWV3Iiwic25hcF9mb3JfcmVsZWFzZSIsImRpZF9zY3JvbGwiLCJmaW5hbGl6ZV9wcmV2aWV3IiwicHJvcG9zYWxfY2hhbmdlc19iYXNlX2JvdW5kYXJ5IiwiYm91bmRhcnlfa2V5IiwiYmVnaW5fZHJhZ2dpbmciLCJzZXRfYXhpc193aW5kb3dfbG9hZGluZ19sb2NrZWQiLCJoYW5kbGVfcmVzaXplX3Njcm9sbCIsImdldF9hY3RpdmVfaGFuZGxlIiwiZXZlbnQiLCJ0YXJnZXQiLCJjb250YWlucyIsImNvbnRpbnVhdGlvbl9zdGF0ZSIsImNvcnJlY3RzX3Jldmlld19lcnJvciIsImNvbnRpbnVlc19yZXZpZXciLCJwb2ludGVyVHlwZSIsImJ1dHRvbiIsImlzUHJpbWFyeSIsInBvaW50ZXJfaWQiLCJwb2ludGVySWQiLCJwb2ludGVyX3R5cGUiLCJjbGllbnRYIiwic3RhcnRfeSIsImNsaWVudFkiLCJjbGllbnRfeSIsImlzX2ZpbmlzaGluZyIsImhhbmRsZV9wb2ludGVyX21vdmUiLCJoYW5kbGVfcG9pbnRlcl91cCIsImhhbmRsZV9wb2ludGVyX2NhbmNlbCIsImhhbmRsZV9sb3N0X3BvaW50ZXJfY2FwdHVyZSIsInNldFBvaW50ZXJDYXB0dXJlIiwic3RvcFByb3BhZ2F0aW9uIiwiZGVsdGFfeCIsImRlbHRhX3kiLCJzcXJ0IiwicHJldmVudERlZmF1bHQiLCJzZXRUaW1lb3V0IiwicmVsZWFzZV9wb2ludGVyX3Jlc291cmNlcyIsImlzX2ludGVyYWN0aW5nIiwiaGFzUG9pbnRlckNhcHR1cmUiLCJyZWxlYXNlUG9pbnRlckNhcHR1cmUiLCJjYW5jZWxsZWQiLCJiZWdpbl9yZWZyZXNoIiwicHJlc2VydmVzX2FwcGx5X3N1Y2Nlc3MiLCJjb21wbGV0ZV9yZWZyZXNoIiwic2VsZWN0aW9uX3N0YXRlIiwicmVwbGFjZW1lbnRfcmVjb3JkIiwic2VnbWVudF9oaW50IiwiYWN0aXZhdGVfaGFuZGxlX2Zyb21fa2V5Ym9hcmQiLCJoYW5kbGVfa2V5ZG93biIsImN0cmxLZXkiLCJtZXRhS2V5IiwiYWx0S2V5Iiwic2hpZnRLZXkiLCJkZXN0cm95Iiwid3BiY190aW1lbGluZV9ib29raW5nX3Jlc2l6aW5nIl0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS10aW1lbGluZS9ib29raW5nLXJlc2l6aW5nL19zcmMvYm9va2luZy1yZXNpemluZy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRpbWVsaW5lIGJvb2tpbmctcmVzaXppbmcgcG9pbnRlci1wcmV2aWV3IGNvbnRyb2xsZXIuXG4gKlxuICogVGhlIHNlcnZlciBhdXRob3JpemVzIGFuIGltbXV0YWJsZSByZXNpemUgY29udGV4dC4gVGhpcyBjb250cm9sbGVyIG93bnNcbiAqIHBvaW50ZXIgY2FwdHVyZSwgYm91bmRlZCBsb2FkZWQtYXhpcyBnZW9tZXRyeSwgcHJlc2VudGF0aW9uLW9ubHkgZ2hvc3RzLCBvbmVcbiAqIGNhbm9uaWNhbCBub24tbXV0YXRpbmcgUmV2aWV3IHJlcXVlc3QgYWZ0ZXIgcG9pbnRlciByZWxlYXNlLCBhbmQgb25lIGd1YXJkZWRcbiAqIEFwcGx5IHJlcXVlc3QgZm9yIHRoZSByZXN1bHRpbmcgc2lnbmVkIHBsYW4uIENhbm9uaWNhbCB2YWxpZGF0aW9uLFxuICogcGVyc2lzdGVuY2UsIGFuZCByZWFkYmFjayByZW1haW4gc2VydmVyLW93bmVkLlxuICpcbiAqIEBwYWNrYWdlIEJvb2tpbmcgQ2FsZW5kYXJcbiAqIEBzaW5jZSAgIDEyLjAuMFxuICovXG4oIGZ1bmN0aW9uICggd2luZG93LCBkb2N1bWVudCApIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdHZhciB0ZW1wbGF0ZV9rZXlzID0gWyAnbG9hZGluZycsICdoYW5kbGVzJywgJ2dob3N0JywgJ3JldmlldycsICdsaXZlX3JlZ2lvbicgXTtcblx0dmFyIHN1cHBvcnRlZF9zaGFwZXMgPSBbICdzaW5nbGVfdGltZWRfaW50ZXJ2YWwnLCAnY29udGludW91c19ib3VuZGFyeV9pbnRlcnZhbCcsICdzaW5nbGVfZnVsbF9kYXknLCAnY29udGludW91c19mdWxsX2RheV9yYW5nZScsICdpbmRlcGVuZGVudF9mdWxsX2RheXMnLCAncmVjdXJyZW50X3RpbWVkX2ludGVydmFscycsICdkaXNjb250aW51b3VzX3RpbWVkX2ludGVydmFscycgXTtcblx0dmFyIGZ1bGxfZGF5X3NoYXBlcyA9IFsgJ3NpbmdsZV9mdWxsX2RheScsICdjb250aW51b3VzX2Z1bGxfZGF5X3JhbmdlJywgJ2luZGVwZW5kZW50X2Z1bGxfZGF5cycgXTtcblx0dmFyIG9wZXJhdGlvbnMgPSBbICdyZXNpemVfc3RhcnQnLCAncmVzaXplX2VuZCcgXTtcblx0dmFyIGRyYWdfdGhyZXNob2xkID0gNTtcblx0dmFyIHRvdWNoX3ZlcnRpY2FsX3RocmVzaG9sZCA9IDg7XG5cdHZhciBhdXRvX3Njcm9sbF9lZGdlID0gNTY7XG5cdHZhciBhdXRvX3Njcm9sbF9zdGVwID0gMjI7XG5cdHZhciByZXZpZXdfZ2FwID0gODtcblxuXHQvKipcblx0ICogQ3JlYXRlIG9uZSBjYXJkLXNjb3BlZCByZXNpemUgcHJlc2VudGF0aW9uIGNvbnRyb2xsZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG1vdW50ICAgICAgICAgVGltZWxpbmUgbW91bnQuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGNvbmZpZ3VyYXRpb24gU2VydmVyLW93bmVkIHRyYW5zcG9ydCBhbmQgdGVtcGxhdGUgRFRPLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjYWxsYmFja3MgICAgIEJvdW5kZWQgVGltZWxpbmUgaW50ZWdyYXRpb24gY2FsbGJhY2tzLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gQ29udHJvbGxlciBBUEkgb3IgbnVsbCBmb3IgYW4gaW5jb21wbGV0ZSBjb250cmFjdC5cblx0ICovXG5cdGZ1bmN0aW9uIGNyZWF0ZV9jb250cm9sbGVyKCBtb3VudCwgY29uZmlndXJhdGlvbiwgY2FsbGJhY2tzICkge1xuXHRcdHZhciB0cmFuc3BvcnQgPSBjb25maWd1cmF0aW9uICYmIGNvbmZpZ3VyYXRpb24udHJhbnNwb3J0ID8gY29uZmlndXJhdGlvbi50cmFuc3BvcnQgOiB7fTtcblx0XHR2YXIgcmV2aWV3X3RyYW5zcG9ydCA9IGNvbmZpZ3VyYXRpb24gJiYgY29uZmlndXJhdGlvbi5yZXZpZXdfdHJhbnNwb3J0ID8gY29uZmlndXJhdGlvbi5yZXZpZXdfdHJhbnNwb3J0IDoge307XG5cdFx0dmFyIGFwcGx5X3RyYW5zcG9ydCA9IGNvbmZpZ3VyYXRpb24gJiYgY29uZmlndXJhdGlvbi5hcHBseV90cmFuc3BvcnQgPyBjb25maWd1cmF0aW9uLmFwcGx5X3RyYW5zcG9ydCA6IHt9O1xuXHRcdHZhciB0ZW1wbGF0ZXMgPSBjb25maWd1cmF0aW9uICYmIGNvbmZpZ3VyYXRpb24udGVtcGxhdGVzID8gY29uZmlndXJhdGlvbi50ZW1wbGF0ZXMgOiB7fTtcblx0XHR2YXIgcG9pbnRlcl9jb25maWd1cmF0aW9uID0gY29uZmlndXJhdGlvbiAmJiBjb25maWd1cmF0aW9uLnBvaW50ZXIgPyBjb25maWd1cmF0aW9uLnBvaW50ZXIgOiB7fTtcblx0XHR2YXIgaTE4biA9IGNvbmZpZ3VyYXRpb24gJiYgY29uZmlndXJhdGlvbi5pMThuID8gY29uZmlndXJhdGlvbi5pMThuIDoge307XG5cdFx0dmFyIHNuYXBfdG9fdGltZWxpbmVfc3RlcCA9IGZhbHNlICE9PSBwb2ludGVyX2NvbmZpZ3VyYXRpb24uc25hcF90b190aW1lbGluZV9zdGVwO1xuXHRcdHZhciBzZWdtZW50X3JlY29yZHMgPSBuZXcgV2Vha01hcCgpO1xuXHRcdHZhciB2aXNpYmxlX3NlZ21lbnRzID0gW107XG5cdFx0dmFyIGFjdGl2ZV9naG9zdF9yZWNvcmRzID0gW107XG5cdFx0dmFyIGFjdGl2ZV9zZWxlY3Rpb24gPSBudWxsO1xuXHRcdHZhciBlbGlnaWJpbGl0eV9yZXF1ZXN0ID0gbnVsbDtcblx0XHR2YXIgcmVxdWVzdF9nZW5lcmF0aW9uID0gMDtcblx0XHR2YXIgcHJlc2VudGF0aW9uX2dlbmVyYXRpb24gPSAwO1xuXHRcdHZhciBpbnRlcmFjdGlvbl9zdGF0ZSA9ICdpZGxlJztcblx0XHR2YXIgcG9pbnRlcl9nZXN0dXJlID0gbnVsbDtcblx0XHR2YXIgcHJldmlld19mcmFtZSA9IDA7XG5cdFx0dmFyIHRyYW5zaWVudF9zY3JvbGxfY2FudmFzID0gbnVsbDtcblx0XHR2YXIgcmV2aWV3X3JlcXVlc3QgPSBudWxsO1xuXHRcdHZhciByZXZpZXdfZ2VuZXJhdGlvbiA9IDA7XG5cdFx0dmFyIHJldmlld19ob3N0ID0gbnVsbDtcblx0XHR2YXIgcmV2aWV3X3Njcm9sbF9jYW52YXMgPSBudWxsO1xuXHRcdHZhciByZXZpZXdfcG9zaXRpb25fZnJhbWUgPSAwO1xuXHRcdHZhciByZXZpZXdfZm9jdXNfdGFyZ2V0ID0gbnVsbDtcblx0XHR2YXIgcmV2aWV3X21lbW9yeSA9IG51bGw7XG5cdFx0dmFyIHJldmlld19lcnJvcl9iYXNlID0gbnVsbDtcblx0XHR2YXIgYXBwbHlfcmVxdWVzdCA9IG51bGw7XG5cdFx0dmFyIGFwcGx5X2dlbmVyYXRpb24gPSAwO1xuXHRcdHZhciBwZW5kaW5nX2FwcGx5X3Jlc3VsdCA9IG51bGw7XG5cdFx0dmFyIGFwcGx5X2ZvY3VzX29wZXJhdGlvbiA9ICcnO1xuXHRcdHZhciBzdXBwcmVzc19oYW5kbGVfY2xpY2sgPSBmYWxzZTtcblx0XHR2YXIgaXNfZGVzdHJveWVkID0gZmFsc2U7XG5cblx0XHRpZiAoICEgbW91bnQgfHwgISBoYXNfcmVxdWlyZWRfY29udHJhY3QoKSApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRtb3VudC5hZGRFdmVudExpc3RlbmVyKCAncG9pbnRlcmRvd24nLCBoYW5kbGVfcG9pbnRlcl9kb3duLCB0cnVlICk7XG5cblx0XHQvKipcblx0XHQgKiBWYWxpZGF0ZSB0aGUgZml4ZWQgdHJhbnNwb3J0IGFuZCBhbGxvdy1saXN0ZWQgdGVtcGxhdGVzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBzdGF0aWMgY29udHJhY3QgaXMgdXNhYmxlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhc19yZXF1aXJlZF9jb250cmFjdCgpIHtcblx0XHRcdHJldHVybiBCb29sZWFuKFxuXHRcdFx0XHR3aW5kb3cualF1ZXJ5ICYmIHdpbmRvdy53cCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwLnRlbXBsYXRlXG5cdFx0XHRcdCYmIHRyYW5zcG9ydC51cmwgJiYgdHJhbnNwb3J0LmFjdGlvbiAmJiB0cmFuc3BvcnQubm9uY2UgJiYgJ3RpbWVsaW5lJyA9PT0gdHJhbnNwb3J0LnNvdXJjZVxuXHRcdFx0XHQmJiByZXZpZXdfdHJhbnNwb3J0LnVybCAmJiByZXZpZXdfdHJhbnNwb3J0LmFjdGlvbiAmJiByZXZpZXdfdHJhbnNwb3J0Lm5vbmNlICYmICd0aW1lbGluZScgPT09IHJldmlld190cmFuc3BvcnQuc291cmNlXG5cdFx0XHRcdCYmIDAgPCBOdW1iZXIoIHJldmlld190cmFuc3BvcnQuc2NoZW1hX3ZlcnNpb24gKVxuXHRcdFx0XHQmJiBhcHBseV90cmFuc3BvcnQudXJsICYmIGFwcGx5X3RyYW5zcG9ydC5hY3Rpb24gJiYgYXBwbHlfdHJhbnNwb3J0Lm5vbmNlICYmICd0aW1lbGluZScgPT09IGFwcGx5X3RyYW5zcG9ydC5zb3VyY2Vcblx0XHRcdFx0JiYgdGVtcGxhdGVfa2V5cy5ldmVyeSggZnVuY3Rpb24gKCBrZXkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuICdzdHJpbmcnID09PSB0eXBlb2YgdGVtcGxhdGVzWyBrZXkgXSAmJiAvXlthLXowLTlfLV0rJC8udGVzdCggdGVtcGxhdGVzWyBrZXkgXSApO1xuXHRcdFx0XHR9IClcblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVzb2x2ZSBvbmUgZml4ZWQgdGVtcGxhdGUgdGhyb3VnaCB0aGUgc2VydmVyIGFsbG93IGxpc3QuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30ga2V5IEZpeGVkIHNlbWFudGljIGtleS5cblx0XHQgKiBAcmV0dXJuIHtGdW5jdGlvbnxudWxsfSBXb3JkUHJlc3MgdGVtcGxhdGUgcmVuZGVyZXIgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfdGVtcGxhdGUoIGtleSApIHtcblx0XHRcdHJldHVybiAtMSAhPT0gdGVtcGxhdGVfa2V5cy5pbmRleE9mKCBrZXkgKSAmJiB0ZW1wbGF0ZXNbIGtleSBdID8gd2luZG93LndwLnRlbXBsYXRlKCB0ZW1wbGF0ZXNbIGtleSBdICkgOiBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbmRlciBvbmUgdGVtcGxhdGUgd2l0aG91dCByZXdyaXRpbmcgYW4gdW5jaGFuZ2VkIGhvc3QuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fG51bGx9IGhvc3QgVGFyZ2V0IGhvc3QuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGtleSBUZW1wbGF0ZSBrZXkuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHZpZXdfbW9kZWwgQXV0aG9yaXplZCBwcmVzZW50YXRpb24gdmFsdWVzLlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBtYXJrdXAgY2hhbmdlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZW5kZXJfdGVtcGxhdGUoIGhvc3QsIGtleSwgdmlld19tb2RlbCApIHtcblx0XHRcdHZhciByZW5kZXJlciA9IGdldF90ZW1wbGF0ZSgga2V5ICk7XG5cdFx0XHR2YXIgbWFya3VwO1xuXG5cdFx0XHRpZiAoICEgaG9zdCB8fCAhIHJlbmRlcmVyICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRtYXJrdXAgPSByZW5kZXJlciggdmlld19tb2RlbCB8fCB7fSApO1xuXHRcdFx0aWYgKCBtYXJrdXAgPT09IGhvc3QuaW5uZXJIVE1MICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRob3N0LmlubmVySFRNTCA9IG1hcmt1cDtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENsZWFyIGEgbm9uLWVtcHR5IGRlZGljYXRlZCBob3N0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSBob3N0IERlZGljYXRlZCBob3N0LlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBjb250ZW50IHdhcyByZW1vdmVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNsZWFyX2hvc3QoIGhvc3QgKSB7XG5cdFx0XHRpZiAoICEgaG9zdCB8fCAoICEgaG9zdC5jaGlsZE5vZGVzLmxlbmd0aCAmJiAhIGhvc3QudGV4dENvbnRlbnQgKSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aG9zdC5yZXBsYWNlQ2hpbGRyZW4oKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc29sdmUgZGVkaWNhdGVkIHJlc2l6ZSBob3N0cyB3aXRoaW4gYW4gZXhhY3QgY2FyZC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gY2FyZCBSZWdpc3RlcmVkIGNhcmQuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBSb290LCB2aXN1YWwsIGxpdmUtcmVnaW9uLCBhbmQgcmV2aWV3IGhvc3RzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9ob3N0cyggY2FyZCApIHtcblx0XHRcdHZhciByb290ID0gY2FyZCAmJiBjYXJkLnF1ZXJ5U2VsZWN0b3IgPyBjYXJkLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLWJvb2tpbmctcmVzaXplLWhvc3RdJyApIDogbnVsbDtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHJvb3Q6IHJvb3QsXG5cdFx0XHRcdHZpc3VhbDogcm9vdCA/IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1yZXNpemUtdmlzdWFsLWhvc3RdJyApIDogbnVsbCxcblx0XHRcdFx0bGl2ZTogcm9vdCA/IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1yZXNpemUtbGl2ZS1ob3N0XScgKSA6IG51bGwsXG5cdFx0XHRcdHJldmlldzogcm9vdCA/IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1yZXNpemUtcmV2aWV3LWhvc3RdJyApIDogbnVsbFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW1vdmUgcHJvcG9zYWwtb25seSBoYW5kbGUgb2Zmc2V0cyBmcm9tIG9uZSBjYW5vbmljYWwgY2FyZC5cblx0XHQgKlxuXHRcdCAqIEhhbmRsZXMgYXJlIHJlbmRlcmVkIGluc2lkZSB0aGUgdW5jaGFuZ2VkIGJvb2tpbmcgY2FyZC4gRHJhZ2dpbmcgY2FuXG5cdFx0ICogdGVtcG9yYXJpbHkgcHJvamVjdCB0aGVtIHRvIGRhc2hlZCBib3VuZGFyaWVzLCBzbyBldmVyeSB0ZXJtaW5hbCBwYXRoXG5cdFx0ICogcmVzdG9yZXMgdGhlaXIgY2Fub25pY2FsIENTUyBwb3NpdGlvbnMgYmVmb3JlIFJldmlldyBwcmVzZW50YXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fG51bGx9IGNhcmQgUmVnaXN0ZXJlZCBjYXJkLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2xlYXJfaGFuZGxlX29mZnNldHMoIGNhcmQgKSB7XG5cdFx0XHRpZiAoICEgY2FyZCB8fCAhIGNhcmQuc3R5bGUgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIGNhcmQuc3R5bGUucmVtb3ZlUHJvcGVydHkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNhcmQuc3R5bGUucmVtb3ZlUHJvcGVydHkoICctLXdwYmMtdGltZWxpbmUtYm9va2luZy1yZXNpemUtc3RhcnQtb2Zmc2V0JyApO1xuXHRcdFx0Y2FyZC5zdHlsZS5yZW1vdmVQcm9wZXJ0eSggJy0td3BiYy10aW1lbGluZS1ib29raW5nLXJlc2l6ZS1lbmQtb2Zmc2V0JyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlZmxlY3QgbG9hZGluZywgcmVhZHksIG9yIGRlbmllZCBwcmVzZW50YXRpb24uXG5cdFx0ICpcblx0XHQgKiBBbiBhdXRob3JpemVkIHJlc2l6ZSBoYW5kbGUgb3ducyB0aGUgc2FtZSB2aXN1YWwgYm91bmRhcnkgYXMgVGltZWxpbmUnc1xuXHRcdCAqIG9yZGluYXJ5IHNlbGVjdGlvbiBkb3QuIEJvdW5kYXJ5LXNwZWNpZmljIHJlYWR5IGNsYXNzZXMgbGV0IENTUyByZXBsYWNlXG5cdFx0ICogb25seSB0aGF0IGR1cGxpY2F0ZSBkb3QuIFdoZW4gdGhlIGJvb2tpbmcgcmVtYWlucyBlbGlnaWJsZSBidXQgb25lIGV4YWN0XG5cdFx0ICogYm91bmRhcnkgaXMgdW5hdmFpbGFibGUsIGEgc2VwYXJhdGUgY2xhc3MgY29udmVydHMgdGhhdCBvcmRpbmFyeSBkb3QgaW50b1xuXHRcdCAqIGEgbm9uLWludGVyYWN0aXZlIHVuYXZhaWxhYmxlIG1hcmtlciBpbnN0ZWFkIG9mIGltcGx5aW5nIGl0IGNhbiBiZSBtb3ZlZC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gY2FyZCBBY3RpdmUgY2FyZC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gc3RhdGUgUHJlc2VudGF0aW9uIHN0YXRlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X3ByZXNlbnRhdGlvbl9zdGF0ZSggY2FyZCwgc3RhdGUgKSB7XG5cdFx0XHR2YXIgaXNfcmVhZHkgPSAncmVhZHknID09PSBzdGF0ZTtcblx0XHRcdHZhciBoYW5kbGVzID0gaXNfcmVhZHkgJiYgYWN0aXZlX3NlbGVjdGlvbiAmJiBhY3RpdmVfc2VsZWN0aW9uLmNhcmQgPT09IGNhcmRcblx0XHRcdFx0PyBhY3RpdmVfc2VsZWN0aW9uLmhhbmRsZXNcblx0XHRcdFx0OiBudWxsO1xuXHRcdFx0dmFyIHN0YXJ0X2lzX2VsaWdpYmxlID0gQm9vbGVhbiggaGFuZGxlcyAmJiBoYW5kbGVzLnN0YXJ0ICYmIGhhbmRsZXMuc3RhcnQuZWxpZ2libGUgKTtcblx0XHRcdHZhciBlbmRfaXNfZWxpZ2libGUgPSBCb29sZWFuKCBoYW5kbGVzICYmIGhhbmRsZXMuZW5kICYmIGhhbmRsZXMuZW5kLmVsaWdpYmxlICk7XG5cdFx0XHR2YXIgc3RhcnRfaXNfdW5hdmFpbGFibGUgPSBCb29sZWFuKCBpc19yZWFkeSAmJiBoYW5kbGVzICYmIGhhbmRsZXMuc3RhcnQgJiYgISBzdGFydF9pc19lbGlnaWJsZSApO1xuXHRcdFx0dmFyIGVuZF9pc191bmF2YWlsYWJsZSA9IEJvb2xlYW4oIGlzX3JlYWR5ICYmIGhhbmRsZXMgJiYgaGFuZGxlcy5lbmQgJiYgISBlbmRfaXNfZWxpZ2libGUgKTtcblxuXHRcdFx0aWYgKCBjYXJkICYmIGNhcmQuY2xhc3NMaXN0ICkge1xuXHRcdFx0XHRjYXJkLmNsYXNzTGlzdC50b2dnbGUoICdpcy1ib29raW5nLXJlc2l6ZS1sb2FkaW5nJywgJ2xvYWRpbmcnID09PSBzdGF0ZSApO1xuXHRcdFx0XHRjYXJkLmNsYXNzTGlzdC50b2dnbGUoICdpcy1ib29raW5nLXJlc2l6ZS1yZWFkeScsIGlzX3JlYWR5ICk7XG5cdFx0XHRcdGNhcmQuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWJvb2tpbmctcmVzaXplLXN0YXJ0LXJlYWR5Jywgc3RhcnRfaXNfZWxpZ2libGUgKTtcblx0XHRcdFx0Y2FyZC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtYm9va2luZy1yZXNpemUtZW5kLXJlYWR5JywgZW5kX2lzX2VsaWdpYmxlICk7XG5cdFx0XHRcdGNhcmQuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWJvb2tpbmctcmVzaXplLXN0YXJ0LXVuYXZhaWxhYmxlJywgc3RhcnRfaXNfdW5hdmFpbGFibGUgKTtcblx0XHRcdFx0Y2FyZC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtYm9va2luZy1yZXNpemUtZW5kLXVuYXZhaWxhYmxlJywgZW5kX2lzX3VuYXZhaWxhYmxlICk7XG5cdFx0XHR9XG5cdFx0XHRtb3VudC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtYm9va2luZy1yZXNpemUtZGVuaWVkJywgJ2RlbmllZCcgPT09IHN0YXRlICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQW5ub3VuY2Ugb25lIHN0YXRlIHRocm91Z2ggdGhlIGRvbWFpbiBsaXZlLXJlZ2lvbiB0ZW1wbGF0ZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gY2FyZCBBY3RpdmUgY2FyZC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBMb2NhbGl6ZWQgbWVzc2FnZS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGFubm91bmNlKCBjYXJkLCBtZXNzYWdlICkge1xuXHRcdFx0dmFyIGhvc3QgPSBnZXRfaG9zdHMoIGNhcmQgKS5saXZlO1xuXHRcdFx0aWYgKCBtZXNzYWdlICkge1xuXHRcdFx0XHRyZW5kZXJfdGVtcGxhdGUoIGhvc3QsICdsaXZlX3JlZ2lvbicsIHsgbWVzc2FnZTogU3RyaW5nKCBtZXNzYWdlICkgfSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y2xlYXJfaG9zdCggaG9zdCApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNob3cgb25lIHN0YW5kYXJkIGdsb2JhbCBhZG1pbmlzdHJhdGlvbiBub3RpY2UgZm9yIGFuIGFjdGlvbmFibGUgcmVzdWx0LlxuXHRcdCAqXG5cdFx0ICogTG9hZGluZyBhbmQgc3VjY2Vzc2Z1bCBub24tbXV0YXRpbmcgY2hlY2tzIHJlbWFpbiBjYXJkLWxvY2FsLiBUaGlzIGNhbGxiYWNrXG5cdFx0ICogaXMgcmVzZXJ2ZWQgZm9yIGFuIGV4cGxpY2l0IGRlbmlhbCBvciBmYWlsdXJlIHNvIHBvaW50ZXIgbW92ZW1lbnQgYW5kXG5cdFx0ICogVGltZWxpbmUgc2Nyb2xsaW5nIGNhbiBuZXZlciBwcm9kdWNlIHJlcGVhdGVkIGdsb2JhbCBtZXNzYWdlcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlICAgICAgUGxhaW4tdGV4dCBhdXRob3JpemVkIG1lc3NhZ2UuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2VfdHlwZSBTdGFuZGFyZCBhZG1pbmlzdHJhdGlvbiBub3RpY2UgdHlwZS5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gZGVsYXkgICAgICAgIFZpc2libGUgZHVyYXRpb24gaW4gbWlsbGlzZWNvbmRzLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2hvd19hZG1pbl9ub3RpY2UoIG1lc3NhZ2UsIG1lc3NhZ2VfdHlwZSwgZGVsYXkgKSB7XG5cdFx0XHRpZiAoIG1lc3NhZ2UgJiYgY2FsbGJhY2tzICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBjYWxsYmFja3Muc2hvd19hZG1pbl9tZXNzYWdlICkge1xuXHRcdFx0XHRjYWxsYmFja3Muc2hvd19hZG1pbl9tZXNzYWdlKCBTdHJpbmcoIG1lc3NhZ2UgKSwgbWVzc2FnZV90eXBlLCBkZWxheSApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc29sdmUgYW4gYXV0aG9yaXplZCBlbGlnaWJpbGl0eSByZWFzb24gaW50byB0cmFuc2xhdGVkIHVzZXIgZ3VpZGFuY2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdHxudWxsfSBkdG8gICAgIFJhdyBhdXRob3JpemVkIHJlc2l6ZS1jb250ZXh0IERUTy5cblx0XHQgKiBAcGFyYW0ge09iamVjdHxudWxsfSBjb250ZXh0IFZhbGlkYXRlZCBpbW11dGFibGUgcmVzaXplIGNvbnRleHQuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R8bnVsbH0gaGFuZGxlcyBQcm9qZWN0ZWQgaGFuZGxlIHByZXNlbnRhdGlvbi5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IFRyYW5zbGF0ZWQgd2FybmluZyB0ZXh0LCBvciBhbiBlbXB0eSBzdHJpbmcgd2hlbiBmdWxseSByZWFkeS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfZWxpZ2liaWxpdHlfd2FybmluZyggZHRvLCBjb250ZXh0LCBoYW5kbGVzICkge1xuXHRcdFx0dmFyIGRlbmlhbF9yZWFzb25zID0gaTE4bi5kZW5pYWxfcmVhc29ucyAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIGkxOG4uZGVuaWFsX3JlYXNvbnMgPyBpMThuLmRlbmlhbF9yZWFzb25zIDoge307XG5cdFx0XHR2YXIgcmVhc29uID0gJyc7XG5cdFx0XHR2YXIgYm91bmRhcmllcyA9IGR0byAmJiBkdG8uYm91bmRhcmllcyA/IGR0by5ib3VuZGFyaWVzIDoge307XG5cblx0XHRcdGlmICggISBoYW5kbGVzICkge1xuXHRcdFx0XHRyZWFzb24gPSBkdG8gJiYgZHRvLmZhbGxiYWNrID8gU3RyaW5nKCBkdG8uZmFsbGJhY2sucmVhc29uIHx8ICcnICkgOiAnJztcblx0XHRcdFx0cmV0dXJuIGRlbmlhbF9yZWFzb25zWyByZWFzb24gXSB8fCBpMThuLmRlbmllZCB8fCAnJztcblx0XHRcdH1cblx0XHRcdGlmICggY29udGV4dCAmJiAhIGNvbnRleHQuYm91bmRhcmllcy5zdGFydCAmJiBib3VuZGFyaWVzLnN0YXJ0ICkge1xuXHRcdFx0XHRyZWFzb24gPSBTdHJpbmcoIGJvdW5kYXJpZXMuc3RhcnQuZmFsbGJhY2tfcmVhc29uIHx8ICcnICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgcmVhc29uICYmIGNvbnRleHQgJiYgISBjb250ZXh0LmJvdW5kYXJpZXMuZW5kICYmIGJvdW5kYXJpZXMuZW5kICkge1xuXHRcdFx0XHRyZWFzb24gPSBTdHJpbmcoIGJvdW5kYXJpZXMuZW5kLmZhbGxiYWNrX3JlYXNvbiB8fCAnJyApO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVhc29uID8gKCBkZW5pYWxfcmVhc29uc1sgcmVhc29uIF0gfHwgaTE4bi5wYXJ0aWFsbHlfcmVhZHkgfHwgJycgKSA6ICcnO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlYWQgYSBzYWZlIGVuZHBvaW50IGVycm9yIG1lc3NhZ2Ugd2l0aCBhIHRyYW5zbGF0ZWQgZmFsbGJhY2suXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZmFpbGVkX3JlcXVlc3QgRmFpbGVkIGpRdWVyeSByZXF1ZXN0LlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBmYWxsYmFjayAgICAgICBUcmFuc2xhdGVkIGZhbGxiYWNrIG1lc3NhZ2UuXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBQbGFpbi10ZXh0IGVycm9yIG1lc3NhZ2UuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3JlcXVlc3RfZXJyb3JfbWVzc2FnZSggZmFpbGVkX3JlcXVlc3QsIGZhbGxiYWNrICkge1xuXHRcdFx0dmFyIGVycm9yX2RhdGEgPSBmYWlsZWRfcmVxdWVzdCAmJiBmYWlsZWRfcmVxdWVzdC5yZXNwb25zZUpTT04gPyBmYWlsZWRfcmVxdWVzdC5yZXNwb25zZUpTT04uZGF0YSA6IG51bGw7XG5cblx0XHRcdHJldHVybiBlcnJvcl9kYXRhICYmICdzdHJpbmcnID09PSB0eXBlb2YgZXJyb3JfZGF0YS5tZXNzYWdlICYmIGVycm9yX2RhdGEubWVzc2FnZVxuXHRcdFx0XHQ/IGVycm9yX2RhdGEubWVzc2FnZVxuXHRcdFx0XHQ6IFN0cmluZyggZmFsbGJhY2sgfHwgJycgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW1vdmUgb25seSB0aGUgZ2hvc3RzIGNyZWF0ZWQgZm9yIHRoZSBhY3RpdmUgYWZmZWN0ZWQgb2NjdXJyZW5jZXMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNsZWFyX2dob3N0cygpIHtcblx0XHRcdGFjdGl2ZV9naG9zdF9yZWNvcmRzLmZvckVhY2goIGZ1bmN0aW9uICggcmVjb3JkICkge1xuXHRcdFx0XHRpZiAoIHJlY29yZC5naG9zdF9ob3N0ICYmIHJlY29yZC5naG9zdF9ob3N0LnBhcmVudE5vZGUgKSB7XG5cdFx0XHRcdFx0cmVjb3JkLmdob3N0X2hvc3QucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggcmVjb3JkLmdob3N0X2hvc3QgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZWNvcmQuZ2hvc3RfaG9zdCA9IG51bGw7XG5cdFx0XHRcdHJlY29yZC5naG9zdCA9IG51bGw7XG5cdFx0XHRcdHJlY29yZC5naG9zdF9pbnRlcnZhbF9pbmRleCA9IC0xO1xuXHRcdFx0XHRyZWNvcmQuZ2hvc3RfZ2VvbWV0cnlfa2V5ID0gJyc7XG5cdFx0XHRcdGlmICggcmVjb3JkLmNhcmQgJiYgcmVjb3JkLmNhcmQuY2xhc3NMaXN0ICkge1xuXHRcdFx0XHRcdHJlY29yZC5jYXJkLmNsYXNzTGlzdC50b2dnbGUoICdpcy1ib29raW5nLXJlc2l6aW5nJywgZmFsc2UgKTtcblx0XHRcdFx0XHRyZWNvcmQuY2FyZC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtYm9va2luZy1yZXNpemUtZHJhZ2dpbmcnLCBmYWxzZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRhY3RpdmVfZ2hvc3RfcmVjb3JkcyA9IFtdO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFRvZ2dsZSBhY3RpdmUtZHJhZyBjaHJvbWUgc3VwcHJlc3Npb24gb24gYWZmZWN0ZWQgb2NjdXJyZW5jZSBjYXJkcy5cblx0XHQgKlxuXHRcdCAqIExpdmUgcG9pbnRlciBtb3ZlbWVudCBzdXBwcmVzc2VzIGluYWN0aXZlIGNocm9tZSB3aGlsZSByZXRhaW5pbmcgb25lIHNtYWxsXG5cdFx0ICogYWN0aXZlIGJvdW5kYXJ5IGRvdCBhbmQgYSBzY29wZWQgaG9yaXpvbnRhbC1yZXNpemUgY3Vyc29yLiBDYW5vbmljYWwgUmV2aWV3XG5cdFx0ICogb3ducyBhdHRlbnRpb24gaW1tZWRpYXRlbHkgYWZ0ZXIgcmVsZWFzZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfZHJhZ2dpbmcgV2hldGhlciBwb2ludGVyIG1vdmVtZW50IGlzIGFjdGl2ZS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNldF9kcmFnZ2luZ19wcmVzZW50YXRpb24oIGlzX2RyYWdnaW5nICkge1xuXHRcdFx0dmFyIGFjdGl2ZV9oYW5kbGUgPSBwb2ludGVyX2dlc3R1cmUgJiYgcG9pbnRlcl9nZXN0dXJlLmhhbmRsZSA/IHBvaW50ZXJfZ2VzdHVyZS5oYW5kbGUgOiBudWxsO1xuXG5cdFx0XHRhY3RpdmVfZ2hvc3RfcmVjb3Jkcy5mb3JFYWNoKCBmdW5jdGlvbiAoIHJlY29yZCApIHtcblx0XHRcdFx0aWYgKCByZWNvcmQuY2FyZCAmJiByZWNvcmQuY2FyZC5jbGFzc0xpc3QgKSB7XG5cdFx0XHRcdFx0cmVjb3JkLmNhcmQuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWJvb2tpbmctcmVzaXplLWRyYWdnaW5nJywgaXNfZHJhZ2dpbmcgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCBhY3RpdmVfc2VsZWN0aW9uICYmIGFjdGl2ZV9zZWxlY3Rpb24uY2FyZCAmJiBhY3RpdmVfc2VsZWN0aW9uLmNhcmQuY2xhc3NMaXN0ICkge1xuXHRcdFx0XHRhY3RpdmVfc2VsZWN0aW9uLmNhcmQuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWJvb2tpbmctcmVzaXplLWRyYWdnaW5nJywgaXNfZHJhZ2dpbmcgKTtcblx0XHRcdH1cblx0XHRcdGlmICggYWN0aXZlX2hhbmRsZSAmJiBhY3RpdmVfaGFuZGxlLmNsYXNzTGlzdCApIHtcblx0XHRcdFx0YWN0aXZlX2hhbmRsZS5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtYm9va2luZy1yZXNpemUtYWN0aXZlLWJvdW5kYXJ5JywgaXNfZHJhZ2dpbmcgKTtcblx0XHRcdH1cblx0XHRcdGlmICggbW91bnQgJiYgbW91bnQuY2xhc3NMaXN0ICkge1xuXHRcdFx0XHRtb3VudC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtYm9va2luZy1yZXNpemUtcG9pbnRlci1hY3RpdmUnLCBpc19kcmFnZ2luZyApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENsZWFyIHJlc2l6ZSBwcmVzZW50YXRpb24gZnJvbSBvbmUgY2FyZCBvbmx5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSBjYXJkIFByZXZpb3VzbHkgYWN0aXZlIGNhcmQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjbGVhcl9jYXJkKCBjYXJkICkge1xuXHRcdFx0dmFyIGhvc3RzID0gZ2V0X2hvc3RzKCBjYXJkICk7XG5cdFx0XHRzZXRfcHJlc2VudGF0aW9uX3N0YXRlKCBjYXJkLCAnJyApO1xuXHRcdFx0Y2xlYXJfaGFuZGxlX29mZnNldHMoIGNhcmQgKTtcblx0XHRcdGlmICggY2FyZCAmJiBjYXJkLmNsYXNzTGlzdCApIHtcblx0XHRcdFx0Y2FyZC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtYm9va2luZy1yZXNpemluZycsIGZhbHNlICk7XG5cdFx0XHRcdGNhcmQuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWJvb2tpbmctcmVzaXplLWRyYWdnaW5nJywgZmFsc2UgKTtcblx0XHRcdH1cblx0XHRcdGNsZWFyX2hvc3QoIGhvc3RzLnZpc3VhbCApO1xuXHRcdFx0Y2xlYXJfaG9zdCggaG9zdHMubGl2ZSApO1xuXHRcdFx0aWYgKCBob3N0cy5yZXZpZXcgJiYgaG9zdHMucmV2aWV3LnBhcmVudE5vZGUgKSB7XG5cdFx0XHRcdGhvc3RzLnJldmlldy5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKCBob3N0cy5yZXZpZXcgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBEZXRlcm1pbmUgd2hldGhlciBhIHN0cmluZyBpcyBhbiBleGFjdCBvZmZzZXQtYmVhcmluZyBpbnN0YW50LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGluc3RhbnQgQ2FuZGlkYXRlIGluc3RhbnQuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSBmb3IgYSBwYXJzZWFibGUgZXhhY3QgaW5zdGFudC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpc19leGFjdF9pbnN0YW50KCBpbnN0YW50ICkge1xuXHRcdFx0cmV0dXJuICdzdHJpbmcnID09PSB0eXBlb2YgaW5zdGFudFxuXHRcdFx0XHQmJiAvVFxcZHsyfTpcXGR7Mn06XFxkezJ9KD86XFwuXFxkKyk/KD86WnxbKy1dXFxkezJ9OlxcZHsyfSkkLy50ZXN0KCBpbnN0YW50IClcblx0XHRcdFx0JiYgISBOdW1iZXIuaXNOYU4oIERhdGUucGFyc2UoIGluc3RhbnQgKSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE5vcm1hbGl6ZSBvbmUgZXhwbGljaXRseSByZWdpc3RlcmVkIHNlZ21lbnQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjYXJkIFJlbmRlcmVkIGNhcmQuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNlZ21lbnQgQXV0aG9yaXplZCBjb21wYWN0IHNlZ21lbnQgRFRPLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBCb3VuZGVkIHJlY29yZCBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG5vcm1hbGl6ZV9zZWdtZW50KCBjYXJkLCBzZWdtZW50ICkge1xuXHRcdFx0dmFyIGJvb2tpbmdfaWQgPSBNYXRoLm1heCggMCwgTWF0aC5yb3VuZCggTnVtYmVyKCBzZWdtZW50ICYmIHNlZ21lbnQuYm9va2luZ19pZCApIHx8IDAgKSApO1xuXHRcdFx0dmFyIHNlZ21lbnRfaWQgPSBTdHJpbmcoIHNlZ21lbnQgJiYgc2VnbWVudC5zZWdtZW50X2lkIHx8ICcnICk7XG5cdFx0XHR2YXIgdmlzaWJsZV9zdGFydCA9IFN0cmluZyggc2VnbWVudCAmJiBzZWdtZW50LnZpc2libGVfc3RhcnQgfHwgJycgKTtcblx0XHRcdHZhciB2aXNpYmxlX2VuZCA9IFN0cmluZyggc2VnbWVudCAmJiBzZWdtZW50LnZpc2libGVfZW5kIHx8ICcnICk7XG5cblx0XHRcdGlmICggISBjYXJkIHx8ICEgYm9va2luZ19pZCB8fCAhIHNlZ21lbnRfaWQgfHwgISBpc19leGFjdF9pbnN0YW50KCB2aXNpYmxlX3N0YXJ0ICkgfHwgISBpc19leGFjdF9pbnN0YW50KCB2aXNpYmxlX2VuZCApICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGNhcmQ6IGNhcmQsXG5cdFx0XHRcdGJvb2tpbmdfaWQ6IGJvb2tpbmdfaWQsXG5cdFx0XHRcdHNlZ21lbnRfaWQ6IHNlZ21lbnRfaWQsXG5cdFx0XHRcdHZpc2libGVfc3RhcnQ6IHZpc2libGVfc3RhcnQsXG5cdFx0XHRcdHZpc2libGVfZW5kOiB2aXNpYmxlX2VuZCxcblx0XHRcdFx0dmlzaWJsZV9zdGFydF9lcG9jaDogRGF0ZS5wYXJzZSggdmlzaWJsZV9zdGFydCApLFxuXHRcdFx0XHR2aXNpYmxlX2VuZF9lcG9jaDogRGF0ZS5wYXJzZSggdmlzaWJsZV9lbmQgKSxcblx0XHRcdFx0c2hvd19zdGFydDogISBCb29sZWFuKCBzZWdtZW50LmlzX2NsaXBwZWRfc3RhcnQgKSxcblx0XHRcdFx0c2hvd19lbmQ6ICEgQm9vbGVhbiggc2VnbWVudC5pc19jbGlwcGVkX2VuZCApLFxuXHRcdFx0XHRrZXk6IFsgYm9va2luZ19pZCwgc2VnbWVudF9pZCwgdmlzaWJsZV9zdGFydCwgdmlzaWJsZV9lbmQgXS5qb2luKCAnfCcgKSxcblx0XHRcdFx0Z2hvc3RfaG9zdDogbnVsbCxcblx0XHRcdFx0Z2hvc3Q6IG51bGwsXG5cdFx0XHRcdGdob3N0X2ludGVydmFsX2luZGV4OiAtMSxcblx0XHRcdFx0Z2hvc3RfZ2VvbWV0cnlfa2V5OiAnJ1xuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBOb3JtYWxpemUgYW5kIGZyZWV6ZSBvbmUgZXhhY3QgaW50ZXJ2YWwuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gaW50ZXJ2YWwgU2VydmVyIGludGVydmFsIERUTy5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gSW1tdXRhYmxlIGludGVydmFsIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbm9ybWFsaXplX2ludGVydmFsKCBpbnRlcnZhbCApIHtcblx0XHRcdHZhciBzdGFydCA9IGludGVydmFsID8gU3RyaW5nKCBpbnRlcnZhbC5zdGFydCB8fCAnJyApIDogJyc7XG5cdFx0XHR2YXIgZW5kID0gaW50ZXJ2YWwgPyBTdHJpbmcoIGludGVydmFsLmVuZCB8fCAnJyApIDogJyc7XG5cdFx0XHRpZiAoICEgaXNfZXhhY3RfaW5zdGFudCggc3RhcnQgKSB8fCAhIGlzX2V4YWN0X2luc3RhbnQoIGVuZCApIHx8IERhdGUucGFyc2UoIGVuZCApIDw9IERhdGUucGFyc2UoIHN0YXJ0ICkgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIE9iamVjdC5mcmVlemUoIHsgc3RhcnQ6IHN0YXJ0LCBlbmQ6IGVuZCwgc3RhcnRfZXBvY2g6IERhdGUucGFyc2UoIHN0YXJ0ICksIGVuZF9lcG9jaDogRGF0ZS5wYXJzZSggZW5kICkgfSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFZhbGlkYXRlIGFuZCBmcmVlemUgdGhlIGF1dGhvcml0YXRpdmUgcmVzaXplIGNvbnRleHQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmVzcG9uc2UgQUpBWCByZXNwb25zZS5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gSW1tdXRhYmxlIGNvbnRleHQgb3IgbnVsbCB3aGVuIGZhaWwtY2xvc2VkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG5vcm1hbGl6ZV9jb250ZXh0KCByZXNwb25zZSApIHtcblx0XHRcdHZhciBkdG8gPSByZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzICYmIHJlc3BvbnNlLmRhdGEgPyByZXNwb25zZS5kYXRhLnJlc2l6ZV9jb250ZXh0IDogbnVsbDtcblx0XHRcdHZhciBib3VuZGFyaWVzID0gZHRvICYmIGR0by5ib3VuZGFyaWVzID8gZHRvLmJvdW5kYXJpZXMgOiB7fTtcblx0XHRcdHZhciBpbW11dGFibGVfaW50ZXJ2YWw7XG5cdFx0XHR2YXIgYWZmZWN0ZWRfaW50ZXJ2YWxzO1xuXHRcdFx0dmFyIGFuY2hvcl9pbnRlcnZhbF9pbmRleCA9IC0xO1xuXHRcdFx0dmFyIHNoYXBlO1xuXG5cdFx0XHRpZiAoICEgYWN0aXZlX3NlbGVjdGlvbiB8fCAhIGR0byB8fCAhIGR0by5lbGlnaWJsZSB8fCBOdW1iZXIoIGR0by5zY2hlbWFfdmVyc2lvbiApICE9PSBOdW1iZXIoIGNvbmZpZ3VyYXRpb24uc2NoZW1hX3ZlcnNpb24gKSB8fCBOdW1iZXIoIGR0by5ib29raW5nX2lkICkgIT09IGFjdGl2ZV9zZWxlY3Rpb24uYm9va2luZ19pZCB8fCAhIE51bWJlciggZHRvLnRhcmdldF9yZXNvdXJjZV9pZCApIHx8ICdyZXNpemUnICE9PSBkdG8uaW50ZXJhY3Rpb25fc291cmNlIHx8ICEgU3RyaW5nKCBkdG8uc291cmNlX2NvbnRleHRfdG9rZW4gfHwgJycgKSApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRzaGFwZSA9IFN0cmluZyggZHRvLnNhdmVkX3NoYXBlIHx8ICcnICk7XG5cdFx0XHRpbW11dGFibGVfaW50ZXJ2YWwgPSBub3JtYWxpemVfaW50ZXJ2YWwoIGR0by5pbW11dGFibGVfaW50ZXJ2YWwgKTtcblx0XHRcdGFmZmVjdGVkX2ludGVydmFscyA9IEFycmF5LmlzQXJyYXkoIGR0by5hZmZlY3RlZF9pbnRlcnZhbHMgKSA/IGR0by5hZmZlY3RlZF9pbnRlcnZhbHMubWFwKCBub3JtYWxpemVfaW50ZXJ2YWwgKS5maWx0ZXIoIEJvb2xlYW4gKSA6IFtdO1xuXHRcdFx0aWYgKCAtMSA9PT0gc3VwcG9ydGVkX3NoYXBlcy5pbmRleE9mKCBzaGFwZSApIHx8ICEgaW1tdXRhYmxlX2ludGVydmFsIHx8ICEgYWZmZWN0ZWRfaW50ZXJ2YWxzLmxlbmd0aCB8fCBhZmZlY3RlZF9pbnRlcnZhbHMubGVuZ3RoICE9PSBOdW1iZXIoIGR0by5hZmZlY3RlZF9pbnRlcnZhbF9jb3VudCApICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGFmZmVjdGVkX2ludGVydmFscy5zb21lKCBmdW5jdGlvbiAoIGludGVydmFsLCBpbmRleCApIHtcblx0XHRcdFx0aWYgKCBpbnRlcnZhbC5zdGFydF9lcG9jaCA9PT0gaW1tdXRhYmxlX2ludGVydmFsLnN0YXJ0X2Vwb2NoICYmIGludGVydmFsLmVuZF9lcG9jaCA9PT0gaW1tdXRhYmxlX2ludGVydmFsLmVuZF9lcG9jaCApIHtcblx0XHRcdFx0XHRhbmNob3JfaW50ZXJ2YWxfaW5kZXggPSBpbmRleDtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIC0xID09PSBhbmNob3JfaW50ZXJ2YWxfaW5kZXggKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIE9iamVjdC5mcmVlemUoIHtcblx0XHRcdFx0Ym9va2luZ19pZDogYWN0aXZlX3NlbGVjdGlvbi5ib29raW5nX2lkLFxuXHRcdFx0XHR0YXJnZXRfcmVzb3VyY2VfaWQ6IE1hdGgucm91bmQoIE51bWJlciggZHRvLnRhcmdldF9yZXNvdXJjZV9pZCApICksXG5cdFx0XHRcdHNhdmVkX3NoYXBlOiBzaGFwZSxcblx0XHRcdFx0cmVzaXplX3Njb3BlOiBTdHJpbmcoIGR0by5yZXNpemVfc2NvcGUgfHwgJycgKSxcblx0XHRcdFx0c291cmNlX2NvbnRleHRfdG9rZW46IFN0cmluZyggZHRvLnNvdXJjZV9jb250ZXh0X3Rva2VuICksXG5cdFx0XHRcdHByb3Bvc2FsX3JldmlzaW9uX3NlZWQ6IE1hdGgubWF4KCAxLCBNYXRoLnJvdW5kKCBOdW1iZXIoIGR0by5wcm9wb3NhbF9yZXZpc2lvbiApIHx8IDEgKSApLFxuXHRcdFx0XHRhbmNob3JfaW50ZXJ2YWxfaW5kZXg6IGFuY2hvcl9pbnRlcnZhbF9pbmRleCxcblx0XHRcdFx0aW1tdXRhYmxlX2ludGVydmFsOiBpbW11dGFibGVfaW50ZXJ2YWwsXG5cdFx0XHRcdGFmZmVjdGVkX2ludGVydmFsczogT2JqZWN0LmZyZWV6ZSggYWZmZWN0ZWRfaW50ZXJ2YWxzLnNsaWNlKCkgKSxcblx0XHRcdFx0Ym91bmRhcmllczogT2JqZWN0LmZyZWV6ZSgge1xuXHRcdFx0XHRcdHN0YXJ0OiBCb29sZWFuKCBhY3RpdmVfc2VsZWN0aW9uLnNob3dfc3RhcnQgJiYgYm91bmRhcmllcy5zdGFydCAmJiBib3VuZGFyaWVzLnN0YXJ0LmVsaWdpYmxlICYmICdyZXNpemVfc3RhcnQnID09PSBib3VuZGFyaWVzLnN0YXJ0Lm9wZXJhdGlvbiApLFxuXHRcdFx0XHRcdGVuZDogQm9vbGVhbiggYWN0aXZlX3NlbGVjdGlvbi5zaG93X2VuZCAmJiBib3VuZGFyaWVzLmVuZCAmJiBib3VuZGFyaWVzLmVuZC5lbGlnaWJsZSAmJiAncmVzaXplX2VuZCcgPT09IGJvdW5kYXJpZXMuZW5kLm9wZXJhdGlvbiApXG5cdFx0XHRcdH0gKVxuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEJ1aWxkIHRoZSBzYWZlIGhhbmRsZSB2aWV3IG1vZGVsLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQgSW1tdXRhYmxlIHJlc2l6ZSBjb250ZXh0LlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBIYW5kbGUgdmlldyBtb2RlbCBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHByb2plY3RfaGFuZGxlcyggY29udGV4dCApIHtcblx0XHRcdGlmICggISBjb250ZXh0IHx8ICggISBjb250ZXh0LmJvdW5kYXJpZXMuc3RhcnQgJiYgISBjb250ZXh0LmJvdW5kYXJpZXMuZW5kICkgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Z3JvdXBfbGFiZWw6IGkxOG4uZ3JvdXBfbGFiZWwgfHwgJycsXG5cdFx0XHRcdHN0YXJ0OiB7IGVsaWdpYmxlOiBjb250ZXh0LmJvdW5kYXJpZXMuc3RhcnQsIG9wZXJhdGlvbjogJ3Jlc2l6ZV9zdGFydCcsIGxhYmVsOiBpMThuLnJlc2l6ZV9zdGFydCB8fCAnJyB9LFxuXHRcdFx0XHRlbmQ6IHsgZWxpZ2libGU6IGNvbnRleHQuYm91bmRhcmllcy5lbmQsIG9wZXJhdGlvbjogJ3Jlc2l6ZV9lbmQnLCBsYWJlbDogaTE4bi5yZXNpemVfZW5kIHx8ICcnIH1cblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRGV0ZXJtaW5lIHdoZXRoZXIgYSByZWFkeSBuYXRpdmUgcHJlc2VudGF0aW9uIG93bnMgYm90aCBib3VuZGFyeSByZWNvcmRzLlxuXHRcdCAqXG5cdFx0ICogVGltZSBSb3dzIGZvcndhcmRzIGEgc2lnbmVkIHByb3Bvc2FsIGludG8gdGhpcyBjb250cm9sbGVyIHdpdGhvdXQgY3JlYXRpbmdcblx0XHQgKiBuYXRpdmUgaG9yaXpvbnRhbCBoYW5kbGVzLiBBIFRpbWVsaW5lIHJlcGxhY2VtZW50IGNhbiByZWF0dGFjaCB0aGF0IGJvb2tpbmdcblx0XHQgKiBjYXJkIGFmdGVyIHRoZSBleHRlcm5hbCBSZXZpZXcgaGFzIGJlZW4gY2FuY2VsbGVkLCBzbyBgc3RhdGU6IHJlYWR5YCBhbG9uZSBpc1xuXHRcdCAqIG5vdCBzdWZmaWNpZW50IHByb29mIHRoYXQgbmF0aXZlIGhhbmRsZSBwcmVzZW50YXRpb24gY2FuIGJlIHJlbmRlcmVkLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R8bnVsbH0gaGFuZGxlcyBDYW5kaWRhdGUgaGFuZGxlIHZpZXcgbW9kZWwuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGJvdGggbmF0aXZlIGJvdW5kYXJ5IHJlY29yZHMgYXJlIHByZXNlbnQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFzX2NvbXBsZXRlX2hhbmRsZV92aWV3X21vZGVsKCBoYW5kbGVzICkge1xuXHRcdFx0cmV0dXJuIEJvb2xlYW4oIGhhbmRsZXMgJiYgaGFuZGxlcy5zdGFydCAmJiBoYW5kbGVzLmVuZCApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc2V0IHNlbGVjdGlvbi1vd25lZCBlbGlnaWJpbGl0eSBhZnRlciBpdHMgYXV0aG9yaXRhdGl2ZSBjb250ZXh0IGlzIHN0YWxlLlxuXHRcdCAqXG5cdFx0ICogVGhlIGNhbm9uaWNhbCBib29raW5nIGlkZW50aXR5IGFuZCByZXBsYWNlbWVudCBjYXJkIHJlbWFpbiBzZWxlY3RlZC4gQSBmcmVzaFxuXHRcdCAqIGVsaWdpYmlsaXR5IHJlYWQgbXVzdCByZWJ1aWxkIGF1dGhvcml0eSBhbmQgbmF0aXZlIGhhbmRsZSBwcmVzZW50YXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlc2V0X2FjdGl2ZV9zZWxlY3Rpb25fZWxpZ2liaWxpdHkoKSB7XG5cdFx0XHRpZiAoICEgYWN0aXZlX3NlbGVjdGlvbiApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0YWN0aXZlX3NlbGVjdGlvbi5jb250ZXh0ID0gbnVsbDtcblx0XHRcdGFjdGl2ZV9zZWxlY3Rpb24uaGFuZGxlcyA9IG51bGw7XG5cdFx0XHRhY3RpdmVfc2VsZWN0aW9uLnN0YXRlID0gJ2lkbGUnO1xuXHRcdFx0YWN0aXZlX3NlbGVjdGlvbi5yZXF1ZXN0X3N0YXRlID0gJ2lkbGUnO1xuXHRcdFx0YWN0aXZlX3NlbGVjdGlvbi5wcm9wb3NhbCA9IG51bGw7XG5cdFx0XHRhY3RpdmVfc2VsZWN0aW9uLm1lc3NhZ2UgPSAnJztcblx0XHRcdGFjdGl2ZV9zZWxlY3Rpb24uaXNfZXh0ZXJuYWwgPSBmYWxzZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgdGhlIGFjdGl2ZSBsb2FkaW5nLCByZWFkeSwgZGVuaWVkLCBvciBlcnJvciBzdGF0ZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX2FjdGl2ZV9zdGF0ZSgpIHtcblx0XHRcdHZhciBob3N0cztcblx0XHRcdGlmICggISBhY3RpdmVfc2VsZWN0aW9uIHx8ICEgYWN0aXZlX3NlbGVjdGlvbi5jYXJkIHx8ICEgYWN0aXZlX3NlbGVjdGlvbi5jYXJkLmlzQ29ubmVjdGVkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdyZWFkeScgPT09IGFjdGl2ZV9zZWxlY3Rpb24uc3RhdGUgJiYgISBoYXNfY29tcGxldGVfaGFuZGxlX3ZpZXdfbW9kZWwoIGFjdGl2ZV9zZWxlY3Rpb24uaGFuZGxlcyApICkge1xuXHRcdFx0XHRzZXRfcHJlc2VudGF0aW9uX3N0YXRlKCBhY3RpdmVfc2VsZWN0aW9uLmNhcmQsICdpZGxlJyApO1xuXHRcdFx0XHRob3N0cyA9IGdldF9ob3N0cyggYWN0aXZlX3NlbGVjdGlvbi5jYXJkICk7XG5cdFx0XHRcdGNsZWFyX2hvc3QoIGhvc3RzLnZpc3VhbCApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRzZXRfcHJlc2VudGF0aW9uX3N0YXRlKCBhY3RpdmVfc2VsZWN0aW9uLmNhcmQsIGFjdGl2ZV9zZWxlY3Rpb24uc3RhdGUgKTtcblx0XHRcdGhvc3RzID0gZ2V0X2hvc3RzKCBhY3RpdmVfc2VsZWN0aW9uLmNhcmQgKTtcblx0XHRcdGlmICggJ2xvYWRpbmcnID09PSBhY3RpdmVfc2VsZWN0aW9uLnN0YXRlICkge1xuXHRcdFx0XHRyZW5kZXJfdGVtcGxhdGUoIGhvc3RzLnZpc3VhbCwgJ2xvYWRpbmcnLCB7IHNob3dfc3RhcnQ6IGFjdGl2ZV9zZWxlY3Rpb24uc2hvd19zdGFydCwgc2hvd19lbmQ6IGFjdGl2ZV9zZWxlY3Rpb24uc2hvd19lbmQgfSApO1xuXHRcdFx0XHRhbm5vdW5jZSggYWN0aXZlX3NlbGVjdGlvbi5jYXJkLCBpMThuLmNoZWNraW5nIHx8ICcnICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggJ3JlYWR5JyA9PT0gYWN0aXZlX3NlbGVjdGlvbi5zdGF0ZSApIHtcblx0XHRcdFx0cmVuZGVyX3RlbXBsYXRlKCBob3N0cy52aXN1YWwsICdoYW5kbGVzJywgYWN0aXZlX3NlbGVjdGlvbi5oYW5kbGVzICk7XG5cdFx0XHRcdGFubm91bmNlKFxuXHRcdFx0XHRcdGFjdGl2ZV9zZWxlY3Rpb24uY2FyZCxcblx0XHRcdFx0XHQoICEgYWN0aXZlX3NlbGVjdGlvbi5oYW5kbGVzLnN0YXJ0LmVsaWdpYmxlIHx8ICEgYWN0aXZlX3NlbGVjdGlvbi5oYW5kbGVzLmVuZC5lbGlnaWJsZSApXG5cdFx0XHRcdFx0XHQ/ICggaTE4bi5wYXJ0aWFsbHlfcmVhZHkgfHwgaTE4bi5yZWFkeSB8fCAnJyApXG5cdFx0XHRcdFx0XHQ6ICggaTE4bi5yZWFkeSB8fCAnJyApXG5cdFx0XHRcdCk7XG5cdFx0XHRcdHJlc3RvcmVfYXBwbHlfaGFuZGxlX2ZvY3VzKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNsZWFyX2hvc3QoIGhvc3RzLnZpc3VhbCApO1xuXHRcdFx0YW5ub3VuY2UoIGFjdGl2ZV9zZWxlY3Rpb24uY2FyZCwgYWN0aXZlX3NlbGVjdGlvbi5tZXNzYWdlIHx8ICcnICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVzdG9yZSBsb2dpY2FsIGZvY3VzIHRvIHRoZSBhcHBsaWVkIGJvdW5kYXJ5IGFmdGVyIGNhbm9uaWNhbCByZWZyZXNoLlxuXHRcdCAqXG5cdFx0ICogRm9jdXMgd2FpdHMgZm9yIHRoZSBmcmVzaCBlbGlnaWJpbGl0eSByZXNwb25zZSBzbyBpdCBjYW4gdGFyZ2V0IGEgbmV3bHlcblx0XHQgKiBhdXRob3JpemVkIGhhbmRsZSByYXRoZXIgdGhhbiBzdGFsZSBwcmUtc2F2ZSBtYXJrdXAuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlc3RvcmVfYXBwbHlfaGFuZGxlX2ZvY3VzKCkge1xuXHRcdFx0dmFyIGZvY3VzX3RhcmdldDtcblxuXHRcdFx0aWYgKCAhIGFwcGx5X2ZvY3VzX29wZXJhdGlvbiB8fCAhIGFjdGl2ZV9zZWxlY3Rpb24gfHwgISBhY3RpdmVfc2VsZWN0aW9uLmNhcmQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChcblx0XHRcdFx0J2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGFjdGl2ZV9zZWxlY3Rpb24ucmVzdG9yZV9mb2N1c1xuXHRcdFx0XHQmJiB0cnVlID09PSBhY3RpdmVfc2VsZWN0aW9uLnJlc3RvcmVfZm9jdXMoIGFjdGl2ZV9zZWxlY3Rpb24uYm9va2luZ19pZCwgYXBwbHlfZm9jdXNfb3BlcmF0aW9uIClcblx0XHRcdCkge1xuXHRcdFx0XHRhcHBseV9mb2N1c19vcGVyYXRpb24gPSAnJztcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Zm9jdXNfdGFyZ2V0ID0gYWN0aXZlX3NlbGVjdGlvbi5jYXJkLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLWJvb2tpbmctcmVzaXplLW9wZXJhdGlvbj1cIicgKyBhcHBseV9mb2N1c19vcGVyYXRpb24gKyAnXCJdJyApO1xuXHRcdFx0aWYgKCAhIGZvY3VzX3RhcmdldCB8fCBmb2N1c190YXJnZXQuZGlzYWJsZWQgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIGZvY3VzX3RhcmdldC5mb2N1cyApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0YXBwbHlfZm9jdXNfb3BlcmF0aW9uID0gJyc7XG5cdFx0XHRmb2N1c190YXJnZXQuZm9jdXMoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBYm9ydCB0aGUgZWxpZ2liaWxpdHkgcmVxdWVzdCBhbmQgaW52YWxpZGF0ZSBpdHMgY2FsbGJhY2tzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBhYm9ydF9yZXF1ZXN0KCkge1xuXHRcdFx0cmVxdWVzdF9nZW5lcmF0aW9uICs9IDE7XG5cdFx0XHRpZiAoIGVsaWdpYmlsaXR5X3JlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGVsaWdpYmlsaXR5X3JlcXVlc3QuYWJvcnQgKSB7XG5cdFx0XHRcdGVsaWdpYmlsaXR5X3JlcXVlc3QuYWJvcnQoKTtcblx0XHRcdH1cblx0XHRcdGVsaWdpYmlsaXR5X3JlcXVlc3QgPSBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNlbmQgZXhhY3RseSBvbmUgZWxpZ2liaWxpdHkgcmVxdWVzdCBmb3IgdGhpcyBzZWxlY3Rpb24gZ2VuZXJhdGlvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbG9hZF9lbGlnaWJpbGl0eSgpIHtcblx0XHRcdHZhciBnZW5lcmF0aW9uO1xuXHRcdFx0aWYgKCAhIGFjdGl2ZV9zZWxlY3Rpb24gfHwgZWxpZ2liaWxpdHlfcmVxdWVzdCB8fCAnbG9hZGluZycgPT09IGFjdGl2ZV9zZWxlY3Rpb24ucmVxdWVzdF9zdGF0ZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aW50ZXJhY3Rpb25fc3RhdGUgPSAnZWxpZ2liaWxpdHlfbG9hZGluZyc7XG5cdFx0XHRhY3RpdmVfc2VsZWN0aW9uLnN0YXRlID0gJ2xvYWRpbmcnO1xuXHRcdFx0YWN0aXZlX3NlbGVjdGlvbi5yZXF1ZXN0X3N0YXRlID0gJ2xvYWRpbmcnO1xuXHRcdFx0cmVuZGVyX2FjdGl2ZV9zdGF0ZSgpO1xuXHRcdFx0Z2VuZXJhdGlvbiA9IHJlcXVlc3RfZ2VuZXJhdGlvbjtcblx0XHRcdGVsaWdpYmlsaXR5X3JlcXVlc3QgPSB3aW5kb3cualF1ZXJ5LmFqYXgoIHtcblx0XHRcdFx0dXJsOiB0cmFuc3BvcnQudXJsLFxuXHRcdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdFx0ZGF0YVR5cGU6ICdqc29uJyxcblx0XHRcdFx0ZGF0YToge1xuXHRcdFx0XHRcdGFjdGlvbjogdHJhbnNwb3J0LmFjdGlvbixcblx0XHRcdFx0XHRub25jZTogdHJhbnNwb3J0Lm5vbmNlLFxuXHRcdFx0XHRcdGJvb2tpbmdfaWQ6IGFjdGl2ZV9zZWxlY3Rpb24uYm9va2luZ19pZCxcblx0XHRcdFx0XHRzb3VyY2U6ICd0aW1lbGluZScsXG5cdFx0XHRcdFx0dmlzaWJsZV9zdGFydF9hdDogYWN0aXZlX3NlbGVjdGlvbi52aXNpYmxlX3N0YXJ0LFxuXHRcdFx0XHRcdHZpc2libGVfZW5kX2F0OiBhY3RpdmVfc2VsZWN0aW9uLnZpc2libGVfZW5kXG5cdFx0XHRcdH1cblx0XHRcdH0gKS5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0XHR2YXIgZHRvID0gcmVzcG9uc2UgJiYgcmVzcG9uc2Uuc3VjY2VzcyAmJiByZXNwb25zZS5kYXRhID8gcmVzcG9uc2UuZGF0YS5yZXNpemVfY29udGV4dCA6IG51bGw7XG5cdFx0XHRcdHZhciBjb250ZXh0O1xuXHRcdFx0XHR2YXIgaGFuZGxlcztcblx0XHRcdFx0dmFyIHdhcm5pbmdfbWVzc2FnZTtcblx0XHRcdFx0dmFyIGlzX2V4cGxpY2l0X2RlbmlhbDtcblx0XHRcdFx0aWYgKCBpc19kZXN0cm95ZWQgfHwgZ2VuZXJhdGlvbiAhPT0gcmVxdWVzdF9nZW5lcmF0aW9uIHx8ICEgYWN0aXZlX3NlbGVjdGlvbiApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29udGV4dCA9IG5vcm1hbGl6ZV9jb250ZXh0KCByZXNwb25zZSApO1xuXHRcdFx0XHRoYW5kbGVzID0gcHJvamVjdF9oYW5kbGVzKCBjb250ZXh0ICk7XG5cdFx0XHRcdGlzX2V4cGxpY2l0X2RlbmlhbCA9IEJvb2xlYW4oIGR0byAmJiBmYWxzZSA9PT0gZHRvLmVsaWdpYmxlICk7XG5cdFx0XHRcdHdhcm5pbmdfbWVzc2FnZSA9IGlzX2V4cGxpY2l0X2RlbmlhbCB8fCBoYW5kbGVzID8gZ2V0X2VsaWdpYmlsaXR5X3dhcm5pbmcoIGR0bywgY29udGV4dCwgaGFuZGxlcyApIDogJyc7XG5cdFx0XHRcdGFjdGl2ZV9zZWxlY3Rpb24ucmVxdWVzdF9zdGF0ZSA9ICdjb21wbGV0ZSc7XG5cdFx0XHRcdGFjdGl2ZV9zZWxlY3Rpb24uc3RhdGUgPSBoYW5kbGVzID8gJ3JlYWR5JyA6ICggaXNfZXhwbGljaXRfZGVuaWFsID8gJ2RlbmllZCcgOiAnZXJyb3InICk7XG5cdFx0XHRcdGFjdGl2ZV9zZWxlY3Rpb24uaGFuZGxlcyA9IGhhbmRsZXM7XG5cdFx0XHRcdGFjdGl2ZV9zZWxlY3Rpb24uY29udGV4dCA9IGhhbmRsZXMgPyBjb250ZXh0IDogbnVsbDtcblx0XHRcdFx0YWN0aXZlX3NlbGVjdGlvbi5uZXh0X3Byb3Bvc2FsX3JldmlzaW9uID0gY29udGV4dCA/IGNvbnRleHQucHJvcG9zYWxfcmV2aXNpb25fc2VlZCA6IDE7XG5cdFx0XHRcdGFjdGl2ZV9zZWxlY3Rpb24ubWVzc2FnZSA9IGhhbmRsZXMgPyAnJyA6ICggaXNfZXhwbGljaXRfZGVuaWFsID8gd2FybmluZ19tZXNzYWdlIDogKCBpMThuLmVycm9yIHx8ICcnICkgKTtcblx0XHRcdFx0aW50ZXJhY3Rpb25fc3RhdGUgPSBoYW5kbGVzID8gJ3JlYWR5JyA6ICdpZGxlJztcblx0XHRcdFx0cmVuZGVyX2FjdGl2ZV9zdGF0ZSgpO1xuXHRcdFx0XHRpZiAoIHdhcm5pbmdfbWVzc2FnZSApIHtcblx0XHRcdFx0XHRzaG93X2FkbWluX25vdGljZSggd2FybmluZ19tZXNzYWdlLCAnd2FybmluZycsIDMwMDAgKTtcblx0XHRcdFx0fSBlbHNlIGlmICggISBoYW5kbGVzICkge1xuXHRcdFx0XHRcdHNob3dfYWRtaW5fbm90aWNlKCBhY3RpdmVfc2VsZWN0aW9uLm1lc3NhZ2UsICdlcnJvcicsIDEwMDAwICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIGZhaWxlZF9yZXF1ZXN0LCByZXF1ZXN0X3N0YXR1cyApIHtcblx0XHRcdFx0aWYgKCBpc19kZXN0cm95ZWQgfHwgZ2VuZXJhdGlvbiAhPT0gcmVxdWVzdF9nZW5lcmF0aW9uIHx8ICdhYm9ydCcgPT09IHJlcXVlc3Rfc3RhdHVzIHx8ICEgYWN0aXZlX3NlbGVjdGlvbiApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0YWN0aXZlX3NlbGVjdGlvbi5yZXF1ZXN0X3N0YXRlID0gJ2NvbXBsZXRlJztcblx0XHRcdFx0YWN0aXZlX3NlbGVjdGlvbi5zdGF0ZSA9ICdlcnJvcic7XG5cdFx0XHRcdGFjdGl2ZV9zZWxlY3Rpb24uY29udGV4dCA9IG51bGw7XG5cdFx0XHRcdGFjdGl2ZV9zZWxlY3Rpb24ubWVzc2FnZSA9IGdldF9yZXF1ZXN0X2Vycm9yX21lc3NhZ2UoIGZhaWxlZF9yZXF1ZXN0LCBpMThuLmVycm9yIHx8ICcnICk7XG5cdFx0XHRcdGludGVyYWN0aW9uX3N0YXRlID0gJ2lkbGUnO1xuXHRcdFx0XHRyZW5kZXJfYWN0aXZlX3N0YXRlKCk7XG5cdFx0XHRcdHNob3dfYWRtaW5fbm90aWNlKCBhY3RpdmVfc2VsZWN0aW9uLm1lc3NhZ2UsICdlcnJvcicsIDEwMDAwICk7XG5cdFx0XHR9ICkuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmICggZ2VuZXJhdGlvbiA9PT0gcmVxdWVzdF9nZW5lcmF0aW9uICkge1xuXHRcdFx0XHRcdGVsaWdpYmlsaXR5X3JlcXVlc3QgPSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVnaXN0ZXIgb25lIGZyZXNobHkgcmVuZGVyZWQgc2VnbWVudCB0aHJvdWdoIHRoZSBleHBsaWNpdCBsaWZlY3ljbGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjYXJkIFJlbmRlcmVkIGNhbm9uaWNhbCBjYXJkLlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBzZWdtZW50IEF1dGhvcml6ZWQgY29tcGFjdCBzZWdtZW50IERUTy5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlZ2lzdGVyX3NlZ21lbnQoIGNhcmQsIHNlZ21lbnQgKSB7XG5cdFx0XHR2YXIgcmVjb3JkID0gbm9ybWFsaXplX3NlZ21lbnQoIGNhcmQsIHNlZ21lbnQgKTtcblx0XHRcdGlmICggISByZWNvcmQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHNlZ21lbnRfcmVjb3Jkcy5zZXQoIGNhcmQsIHJlY29yZCApO1xuXHRcdFx0dmlzaWJsZV9zZWdtZW50cy5wdXNoKCByZWNvcmQgKTtcblx0XHRcdGlmIChcblx0XHRcdFx0YWN0aXZlX3NlbGVjdGlvblxuXHRcdFx0XHQmJiAoXG5cdFx0XHRcdFx0cmVjb3JkLmtleSA9PT0gYWN0aXZlX3NlbGVjdGlvbi5rZXlcblx0XHRcdFx0XHR8fCAoICEgYWN0aXZlX3NlbGVjdGlvbi5jYXJkICYmIHJlY29yZC5ib29raW5nX2lkID09PSBhY3RpdmVfc2VsZWN0aW9uLmJvb2tpbmdfaWQgJiYgcmVjb3JkLnNlZ21lbnRfaWQgPT09IGFjdGl2ZV9zZWxlY3Rpb24uc2VnbWVudF9pZCApXG5cdFx0XHRcdClcblx0XHRcdCkge1xuXHRcdFx0XHRhY3RpdmVfc2VsZWN0aW9uLmNhcmQgPSBjYXJkO1xuXHRcdFx0XHRhY3RpdmVfc2VsZWN0aW9uLmtleSA9IHJlY29yZC5rZXk7XG5cdFx0XHRcdGFjdGl2ZV9zZWxlY3Rpb24udmlzaWJsZV9zdGFydCA9IHJlY29yZC52aXNpYmxlX3N0YXJ0O1xuXHRcdFx0XHRhY3RpdmVfc2VsZWN0aW9uLnZpc2libGVfZW5kID0gcmVjb3JkLnZpc2libGVfZW5kO1xuXHRcdFx0XHRhY3RpdmVfc2VsZWN0aW9uLnNob3dfc3RhcnQgPSByZWNvcmQuc2hvd19zdGFydDtcblx0XHRcdFx0YWN0aXZlX3NlbGVjdGlvbi5zaG93X2VuZCA9IHJlY29yZC5zaG93X2VuZDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBY3RpdmF0ZSB0aGUgZXhhY3Qgc2VnbWVudCBzZWxlY3RlZCB0aHJvdWdoIGRlbGVnYXRlZCBpbnB1dC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHNlbGVjdGlvbl9zb3VyY2UgQ2FyZCBvciBzZWxlY3Rpb24gY29udHJvbC5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gYSByZWdpc3RlcmVkIHNlZ21lbnQgd2FzIGFjY2VwdGVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNlbGVjdCggc2VsZWN0aW9uX3NvdXJjZSApIHtcblx0XHRcdHZhciBjYXJkID0gc2VsZWN0aW9uX3NvdXJjZSAmJiBzZWxlY3Rpb25fc291cmNlLmNsb3Nlc3QgPyBzZWxlY3Rpb25fc291cmNlLmNsb3Nlc3QoICdbZGF0YS13cGJjLXRpbWVsaW5lLXNlZ21lbnQtaWRdJyApIDogbnVsbDtcblx0XHRcdHZhciByZWNvcmQgPSBjYXJkID8gc2VnbWVudF9yZWNvcmRzLmdldCggY2FyZCApIDogbnVsbDtcblx0XHRcdGlmICggISByZWNvcmQgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICggLTEgIT09IFsgJ2FwcGx5X3BlbmRpbmcnLCAncmVmcmVzaF9wZW5kaW5nJyBdLmluZGV4T2YoIGludGVyYWN0aW9uX3N0YXRlICkgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICggYWN0aXZlX3NlbGVjdGlvbiAmJiBhY3RpdmVfc2VsZWN0aW9uLmtleSA9PT0gcmVjb3JkLmtleSApIHtcblx0XHRcdFx0YWN0aXZlX3NlbGVjdGlvbi5jYXJkID0gY2FyZDtcblx0XHRcdFx0cmVuZGVyX2FjdGl2ZV9zdGF0ZSgpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGNhbmNlbF9pbnRlcmFjdGlvbiggZmFsc2UsICdzZWxlY3Rpb25fcmVwbGFjZWQnICk7XG5cdFx0XHRpZiAoIGFjdGl2ZV9zZWxlY3Rpb24gKSB7XG5cdFx0XHRcdGNsZWFyX2NhcmQoIGFjdGl2ZV9zZWxlY3Rpb24uY2FyZCApO1xuXHRcdFx0fVxuXHRcdFx0YWJvcnRfcmVxdWVzdCgpO1xuXHRcdFx0cHJlc2VudGF0aW9uX2dlbmVyYXRpb24gKz0gMTtcblx0XHRcdGFjdGl2ZV9zZWxlY3Rpb24gPSB7XG5cdFx0XHRcdGNhcmQ6IGNhcmQsXG5cdFx0XHRcdGJvb2tpbmdfaWQ6IHJlY29yZC5ib29raW5nX2lkLFxuXHRcdFx0XHRzZWdtZW50X2lkOiByZWNvcmQuc2VnbWVudF9pZCxcblx0XHRcdFx0dmlzaWJsZV9zdGFydDogcmVjb3JkLnZpc2libGVfc3RhcnQsXG5cdFx0XHRcdHZpc2libGVfZW5kOiByZWNvcmQudmlzaWJsZV9lbmQsXG5cdFx0XHRcdHNob3dfc3RhcnQ6IHJlY29yZC5zaG93X3N0YXJ0LFxuXHRcdFx0XHRzaG93X2VuZDogcmVjb3JkLnNob3dfZW5kLFxuXHRcdFx0XHRrZXk6IHJlY29yZC5rZXksXG5cdFx0XHRcdHN0YXRlOiAnaWRsZScsXG5cdFx0XHRcdHJlcXVlc3Rfc3RhdGU6ICdpZGxlJyxcblx0XHRcdFx0aGFuZGxlczogbnVsbCxcblx0XHRcdFx0Y29udGV4dDogbnVsbCxcblx0XHRcdFx0cHJvcG9zYWw6IG51bGwsXG5cdFx0XHRcdG5leHRfcHJvcG9zYWxfcmV2aXNpb246IDEsXG5cdFx0XHRcdG1lc3NhZ2U6ICcnXG5cdFx0XHR9O1xuXHRcdFx0bG9hZF9lbGlnaWJpbGl0eSgpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQnVpbGQgYW4gaW1tdXRhYmxlIHBoeXNpY2FsIGF4aXMgc25hcHNob3QgZnJvbSB0aGUgYWN0aXZlIHJvdyBvbmx5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY2FyZCBBY3RpdmUgY2FyZC5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gTG9hZGVkLWF4aXMgc25hcHNob3Qgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjcmVhdGVfYXhpc19zbmFwc2hvdCggY2FyZCApIHtcblx0XHRcdHZhciByb3cgPSBjYXJkID8gY2FyZC5jbG9zZXN0KCAnLndwYmNfdGltZWxpbmVfX2NhbnZhc19yb3cnICkgOiBudWxsO1xuXHRcdFx0dmFyIGNhbnZhcyA9IG1vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLWNhbnZhc10nICk7XG5cdFx0XHR2YXIgZWxlbWVudHMgPSByb3cgPyByb3cucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX3RpbWVsaW5lX19jYW52YXNfY2VsbCcgKSA6IFtdO1xuXHRcdFx0dmFyIGNlbGxzID0gW107XG5cdFx0XHR2YXIgYXhpcyA9IGNhbGxiYWNrcyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgY2FsbGJhY2tzLmdldF9heGlzID8gY2FsbGJhY2tzLmdldF9heGlzKCkgOiB7fTtcblxuXHRcdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCggZWxlbWVudHMsIGZ1bmN0aW9uICggZWxlbWVudCApIHtcblx0XHRcdFx0dmFyIHN0YXJ0ID0gU3RyaW5nKCBlbGVtZW50LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1jZWxsLXN0YXJ0JyApIHx8ICcnICk7XG5cdFx0XHRcdHZhciBlbmQgPSBTdHJpbmcoIGVsZW1lbnQuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLWNlbGwtZW5kJyApIHx8ICcnICk7XG5cdFx0XHRcdGlmICggaXNfZXhhY3RfaW5zdGFudCggc3RhcnQgKSAmJiBpc19leGFjdF9pbnN0YW50KCBlbmQgKSAmJiBEYXRlLnBhcnNlKCBlbmQgKSA+IERhdGUucGFyc2UoIHN0YXJ0ICkgKSB7XG5cdFx0XHRcdFx0Y2VsbHMucHVzaCgge1xuXHRcdFx0XHRcdFx0ZWxlbWVudDogZWxlbWVudCxcblx0XHRcdFx0XHRcdHN0YXJ0OiBzdGFydCxcblx0XHRcdFx0XHRcdGVuZDogZW5kLFxuXHRcdFx0XHRcdFx0c3RhcnRfZXBvY2g6IERhdGUucGFyc2UoIHN0YXJ0ICksXG5cdFx0XHRcdFx0XHRlbmRfZXBvY2g6IERhdGUucGFyc2UoIGVuZCApLFxuXHRcdFx0XHRcdFx0cmVjdGFuZ2xlOiBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpXG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoICEgY2FudmFzIHx8ICEgY2VsbHMubGVuZ3RoICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJldHVybiBPYmplY3QuZnJlZXplKCB7XG5cdFx0XHRcdGNhbnZhczogY2FudmFzLFxuXHRcdFx0XHRjZWxsczogY2VsbHMsXG5cdFx0XHRcdGlzX3J0bDogMSA8IGNlbGxzLmxlbmd0aCA/IGNlbGxzWzBdLnJlY3RhbmdsZS5sZWZ0ID4gY2VsbHNbY2VsbHMubGVuZ3RoIC0gMV0ucmVjdGFuZ2xlLmxlZnQgOiBCb29sZWFuKCBheGlzLmlzX3J0bCApLFxuXHRcdFx0XHRjZWxsX21pbnV0ZXM6IE1hdGgubWF4KCAxLCBNYXRoLnJvdW5kKCBOdW1iZXIoIGF4aXMuY2VsbF9taW51dGVzICkgfHwgMSApICksXG5cdFx0XHRcdHRpbWV6b25lOiBTdHJpbmcoIGF4aXMudGltZXpvbmUgfHwgJycgKSxcblx0XHRcdFx0Z2VuZXJhdGlvbjogcHJlc2VudGF0aW9uX2dlbmVyYXRpb24sXG5cdFx0XHRcdG1pbl9lcG9jaDogY2VsbHNbMF0uc3RhcnRfZXBvY2gsXG5cdFx0XHRcdG1heF9lcG9jaDogY2VsbHNbY2VsbHMubGVuZ3RoIC0gMV0uZW5kX2Vwb2NoXG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVmcmVzaCBjYWNoZWQgY2VsbCByZWN0YW5nbGVzIGFmdGVyIGhvcml6b250YWwgc2Nyb2xsaW5nLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNuYXBzaG90IEF4aXMgc25hcHNob3QuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZWZyZXNoX2F4aXNfcmVjdGFuZ2xlcyggc25hcHNob3QgKSB7XG5cdFx0XHRzbmFwc2hvdC5jZWxscy5mb3JFYWNoKCBmdW5jdGlvbiAoIGNlbGwgKSB7XG5cdFx0XHRcdGNlbGwucmVjdGFuZ2xlID0gY2VsbC5lbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc29sdmUgYSBwaHlzaWNhbCBwb2ludGVyIGNvb3JkaW5hdGUgb24gdGhlIGNocm9ub2xvZ2ljYWwgYXhpcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBzbmFwc2hvdCBBeGlzIHNuYXBzaG90LlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBjbGllbnRfeCBQaHlzaWNhbCB2aWV3cG9ydCBjb29yZGluYXRlLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gQ2VsbCwgY2hyb25vbG9naWNhbCBpbmRleCwgcmF0aW8sIHVuaXRzLCBhbmQgaW5zdGFudC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBwb2ludGVyX3RvX2F4aXNfcG9zaXRpb24oIHNuYXBzaG90LCBjbGllbnRfeCApIHtcblx0XHRcdHZhciBjZWxsID0gc25hcHNob3QuY2VsbHNbMF07XG5cdFx0XHR2YXIgY2VsbF9pbmRleCA9IDA7XG5cdFx0XHR2YXIgY2xvc2VzdF9kaXN0YW5jZSA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcblx0XHRcdHZhciByYXRpbztcblxuXHRcdFx0c25hcHNob3QuY2VsbHMuc29tZSggZnVuY3Rpb24gKCBjYW5kaWRhdGUsIGNhbmRpZGF0ZV9pbmRleCApIHtcblx0XHRcdFx0dmFyIGRpc3RhbmNlO1xuXHRcdFx0XHRpZiAoIGNsaWVudF94ID49IGNhbmRpZGF0ZS5yZWN0YW5nbGUubGVmdCAmJiBjbGllbnRfeCA8PSBjYW5kaWRhdGUucmVjdGFuZ2xlLnJpZ2h0ICkge1xuXHRcdFx0XHRcdGNlbGwgPSBjYW5kaWRhdGU7XG5cdFx0XHRcdFx0Y2VsbF9pbmRleCA9IGNhbmRpZGF0ZV9pbmRleDtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRkaXN0YW5jZSA9IE1hdGgubWluKCBNYXRoLmFicyggY2xpZW50X3ggLSBjYW5kaWRhdGUucmVjdGFuZ2xlLmxlZnQgKSwgTWF0aC5hYnMoIGNsaWVudF94IC0gY2FuZGlkYXRlLnJlY3RhbmdsZS5yaWdodCApICk7XG5cdFx0XHRcdGlmICggZGlzdGFuY2UgPCBjbG9zZXN0X2Rpc3RhbmNlICkge1xuXHRcdFx0XHRcdGNsb3Nlc3RfZGlzdGFuY2UgPSBkaXN0YW5jZTtcblx0XHRcdFx0XHRjZWxsID0gY2FuZGlkYXRlO1xuXHRcdFx0XHRcdGNlbGxfaW5kZXggPSBjYW5kaWRhdGVfaW5kZXg7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSApO1xuXHRcdFx0cmF0aW8gPSAoIGNsaWVudF94IC0gY2VsbC5yZWN0YW5nbGUubGVmdCApIC8gTWF0aC5tYXgoIDEsIGNlbGwucmVjdGFuZ2xlLndpZHRoICk7XG5cdFx0XHRyYXRpbyA9IE1hdGgubWF4KCAwLCBNYXRoLm1pbiggMSwgc25hcHNob3QuaXNfcnRsID8gMSAtIHJhdGlvIDogcmF0aW8gKSApO1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRjZWxsOiBjZWxsLFxuXHRcdFx0XHRjZWxsX2luZGV4OiBjZWxsX2luZGV4LFxuXHRcdFx0XHRyYXRpbzogcmF0aW8sXG5cdFx0XHRcdHVuaXRzOiBjZWxsX2luZGV4ICsgcmF0aW8sXG5cdFx0XHRcdGVwb2NoOiBNYXRoLnJvdW5kKCAoIGNlbGwuc3RhcnRfZXBvY2ggKyAoIGNlbGwuZW5kX2Vwb2NoIC0gY2VsbC5zdGFydF9lcG9jaCApICogcmF0aW8gKSAvIDYwMDAwICkgKiA2MDAwMFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBQcm9qZWN0IGEgcGh5c2ljYWwgcG9pbnRlciBjb29yZGluYXRlIGludG8gYSBsb2FkZWQtYXhpcyBpbnN0YW50LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNuYXBzaG90IEF4aXMgc25hcHNob3QuXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGNsaWVudF94IFBoeXNpY2FsIHZpZXdwb3J0IGNvb3JkaW5hdGUuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG9wZXJhdGlvbiBSZXNpemUgb3BlcmF0aW9uLlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfZnVsbF9kYXkgV2hldGhlciB3aG9sZS1kYXkgc25hcHBpbmcgaXMgcmVxdWlyZWQuXG5cdFx0ICogQHJldHVybiB7bnVtYmVyfSBCb3VuZGVkIGVwb2NoIG1pbGxpc2Vjb25kcy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBwb2ludGVyX3RvX2Vwb2NoKCBzbmFwc2hvdCwgY2xpZW50X3gsIG9wZXJhdGlvbiwgaXNfZnVsbF9kYXkgKSB7XG5cdFx0XHR2YXIgcG9zaXRpb24gPSBwb2ludGVyX3RvX2F4aXNfcG9zaXRpb24oIHNuYXBzaG90LCBjbGllbnRfeCApO1xuXHRcdFx0aWYgKCBpc19mdWxsX2RheSApIHtcblx0XHRcdFx0cmV0dXJuICdyZXNpemVfc3RhcnQnID09PSBvcGVyYXRpb24gPyBwb3NpdGlvbi5jZWxsLnN0YXJ0X2Vwb2NoIDogcG9zaXRpb24uY2VsbC5lbmRfZXBvY2g7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcG9zaXRpb24uZXBvY2g7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29udmVydCBhIGZyYWN0aW9uYWwgY2hyb25vbG9naWNhbCBheGlzIHBvc2l0aW9uIGludG8gYW4gZXhhY3QgaW5zdGFudC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBzbmFwc2hvdCBMb2FkZWQtYXhpcyBnZW9tZXRyeSBzbmFwc2hvdC5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gdW5pdHMgRnJhY3Rpb25hbCBjZWxsIHBvc2l0aW9uIGZyb20gdGhlIGNocm9ub2xvZ2ljYWwgc3RhcnQuXG5cdFx0ICogQHJldHVybiB7bnVtYmVyfSBNaW51dGUtcm91bmRlZCwgbG9hZGVkLWF4aXMtYm91bmRlZCBlcG9jaCBtaWxsaXNlY29uZHMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYXhpc191bml0c190b19lcG9jaCggc25hcHNob3QsIHVuaXRzICkge1xuXHRcdFx0dmFyIGJvdW5kZWRfdW5pdHMgPSBNYXRoLm1heCggMCwgTWF0aC5taW4oIHNuYXBzaG90LmNlbGxzLmxlbmd0aCwgdW5pdHMgKSApO1xuXHRcdFx0dmFyIGNlbGxfaW5kZXg7XG5cdFx0XHR2YXIgY2VsbDtcblx0XHRcdHZhciByYXRpbztcblxuXHRcdFx0aWYgKCBib3VuZGVkX3VuaXRzID49IHNuYXBzaG90LmNlbGxzLmxlbmd0aCApIHtcblx0XHRcdFx0cmV0dXJuIHNuYXBzaG90LmNlbGxzW3NuYXBzaG90LmNlbGxzLmxlbmd0aCAtIDFdLmVuZF9lcG9jaDtcblx0XHRcdH1cblx0XHRcdGNlbGxfaW5kZXggPSBNYXRoLm1pbiggc25hcHNob3QuY2VsbHMubGVuZ3RoIC0gMSwgTWF0aC5mbG9vciggYm91bmRlZF91bml0cyApICk7XG5cdFx0XHRjZWxsID0gc25hcHNob3QuY2VsbHNbY2VsbF9pbmRleF07XG5cdFx0XHRyYXRpbyA9IGJvdW5kZWRfdW5pdHMgLSBjZWxsX2luZGV4O1xuXG5cdFx0XHRyZXR1cm4gTWF0aC5yb3VuZCggKCBjZWxsLnN0YXJ0X2Vwb2NoICsgKCBjZWxsLmVuZF9lcG9jaCAtIGNlbGwuc3RhcnRfZXBvY2ggKSAqIHJhdGlvICkgLyA2MDAwMCApICogNjAwMDA7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTW92ZSBhbiBleGFjdCBib3VuZGFyeSBieSB0aGUgcG9pbnRlciBkZWx0YSBmcm9tIGEgdmlzdWFsIGNhcmQtZWRnZSBoYW5kbGUuXG5cdFx0ICpcblx0XHQgKiBBIHNlbWFudGljIGRheSBjYXJkIGlzIHdpZGVyIHRoYW4gaXRzIGNhbm9uaWNhbCB0aW1lIHNsb3QuIEl0cyBoYW5kbGUgaXNcblx0XHQgKiBpbnRlbnRpb25hbGx5IHJlbmRlcmVkIG9uIHRoZSB2aXNpYmxlIGNhcmQgZWRnZSwgc28gYWJzb2x1dGUgcG9pbnRlci10by10aW1lXG5cdFx0ICogcHJvamVjdGlvbiB3b3VsZCBqdW1wIHRvIG1pZG5pZ2h0IGFzIHNvb24gYXMgZHJhZ2dpbmcgc3RhcnRzLiBSZWxhdGl2ZSBheGlzXG5cdFx0ICogbW92ZW1lbnQga2VlcHMgdGhlIGltbXV0YWJsZSBzYXZlZCB3YWxsIHRpbWUgYXMgdGhlIGRyYWcgb3JpZ2luLiBSZWxlYXNlIGtlZXBzXG5cdFx0ICogdGhpcyBtaW51dGUgcHJvamVjdGlvbiBmb3Igc2VtYW50aWMgZGF5IGNhcmRzLCB3aGlsZSBjYW5vbmljYWwgUmV2aWV3IHJlbWFpbnNcblx0XHQgKiBhdXRob3JpdGF0aXZlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNuYXBzaG90IExvYWRlZC1heGlzIGdlb21ldHJ5IHNuYXBzaG90LlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBjbGllbnRfeCBDdXJyZW50IHBoeXNpY2FsIHBvaW50ZXIgY29vcmRpbmF0ZS5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZ2VzdHVyZSBBY3RpdmUgcG9pbnRlciBnZXN0dXJlLlxuXHRcdCAqIEByZXR1cm4ge251bWJlcn0gRXhhY3QgcHJlc2VudGF0aW9uIGJvdW5kYXJ5IGFmdGVyIGFwcGx5aW5nIHBvaW50ZXIgbW92ZW1lbnQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcG9pbnRlcl9kZWx0YV90b19lcG9jaCggc25hcHNob3QsIGNsaWVudF94LCBnZXN0dXJlICkge1xuXHRcdFx0dmFyIGN1cnJlbnRfcG9zaXRpb24gPSBwb2ludGVyX3RvX2F4aXNfcG9zaXRpb24oIHNuYXBzaG90LCBjbGllbnRfeCApO1xuXHRcdFx0dmFyIGFuY2hvcl9pbnRlcnZhbCA9IGdldF9nZXN0dXJlX2FuY2hvcl9pbnRlcnZhbCgpO1xuXHRcdFx0dmFyIGJvdW5kYXJ5X2Vwb2NoID0gJ3Jlc2l6ZV9zdGFydCcgPT09IGdlc3R1cmUub3BlcmF0aW9uID8gYW5jaG9yX2ludGVydmFsLnN0YXJ0X2Vwb2NoIDogYW5jaG9yX2ludGVydmFsLmVuZF9lcG9jaDtcblx0XHRcdHZhciBib3VuZGFyeV9jZWxsX2luZGV4ID0gZmluZF9heGlzX2NlbGxfaW5kZXgoIHNuYXBzaG90LCBib3VuZGFyeV9lcG9jaCApO1xuXHRcdFx0dmFyIGJvdW5kYXJ5X2NlbGw7XG5cdFx0XHR2YXIgYm91bmRhcnlfcmF0aW87XG5cdFx0XHR2YXIgYm91bmRhcnlfdW5pdHM7XG5cblx0XHRcdGlmICggLTEgPT09IGJvdW5kYXJ5X2NlbGxfaW5kZXggKSB7XG5cdFx0XHRcdHJldHVybiBib3VuZGFyeV9lcG9jaDtcblx0XHRcdH1cblx0XHRcdGJvdW5kYXJ5X2NlbGwgPSBzbmFwc2hvdC5jZWxsc1tib3VuZGFyeV9jZWxsX2luZGV4XTtcblx0XHRcdGJvdW5kYXJ5X3JhdGlvID0gKCBib3VuZGFyeV9lcG9jaCAtIGJvdW5kYXJ5X2NlbGwuc3RhcnRfZXBvY2ggKSAvIE1hdGgubWF4KCAxLCBib3VuZGFyeV9jZWxsLmVuZF9lcG9jaCAtIGJvdW5kYXJ5X2NlbGwuc3RhcnRfZXBvY2ggKTtcblx0XHRcdGJvdW5kYXJ5X3VuaXRzID0gYm91bmRhcnlfY2VsbF9pbmRleCArIE1hdGgubWF4KCAwLCBNYXRoLm1pbiggMSwgYm91bmRhcnlfcmF0aW8gKSApO1xuXG5cdFx0XHRyZXR1cm4gYXhpc191bml0c190b19lcG9jaCggc25hcHNob3QsIGJvdW5kYXJ5X3VuaXRzICsgY3VycmVudF9wb3NpdGlvbi51bml0cyAtIGdlc3R1cmUuc3RhcnRfYXhpc191bml0cyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJvdW5kIGFuIGF4aXMtdW5pdCBkZWx0YSBzeW1tZXRyaWNhbGx5IGF0IGhhbGYgYSBjZWxsLlxuXHRcdCAqXG5cdFx0ICogTmF0aXZlIE1hdGgucm91bmQoKSBtYXBzIC0wLjUgdG8gbmVnYXRpdmUgemVybywgd2hpY2ggd291bGQgbWFrZSB0aGVcblx0XHQgKiBzYW1lIHBoeXNpY2FsIHRocmVzaG9sZCBiZWhhdmUgZGlmZmVyZW50bHkgZm9yIHN0YXJ0IGFuZCBlbmQgY29udHJhY3Rpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gZGVsdGEgRnJhY3Rpb25hbCBUaW1lbGluZS1jZWxsIGRlbHRhLlxuXHRcdCAqIEByZXR1cm4ge251bWJlcn0gU2lnbmVkIHdob2xlLWNlbGwgZGVsdGEuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcm91bmRfYXhpc19zdGVwcyggZGVsdGEgKSB7XG5cdFx0XHRyZXR1cm4gMCA+IGRlbHRhID8gLU1hdGgucm91bmQoIE1hdGguYWJzKCBkZWx0YSApICkgOiBNYXRoLnJvdW5kKCBkZWx0YSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEZpbmQgdGhlIGxvYWRlZCBjZWxsIGNvbnRhaW5pbmcgb25lIGV4YWN0IGJvdW5kYXJ5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNuYXBzaG90IEF4aXMgc25hcHNob3QuXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGVwb2NoIEV4YWN0IGJvdW5kYXJ5IGVwb2NoLlxuXHRcdCAqIEByZXR1cm4ge251bWJlcn0gQ2hyb25vbG9naWNhbCBjZWxsIGluZGV4LCBvciAtMSBvdXRzaWRlIHRoZSBsb2FkZWQgYXhpcy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBmaW5kX2F4aXNfY2VsbF9pbmRleCggc25hcHNob3QsIGVwb2NoICkge1xuXHRcdFx0dmFyIG1hdGNoID0gLTE7XG5cdFx0XHRzbmFwc2hvdC5jZWxscy5zb21lKCBmdW5jdGlvbiAoIGNlbGwsIGluZGV4ICkge1xuXHRcdFx0XHRpZiAoIGVwb2NoID49IGNlbGwuc3RhcnRfZXBvY2ggJiYgKCBlcG9jaCA8IGNlbGwuZW5kX2Vwb2NoIHx8ICggaW5kZXggPT09IHNuYXBzaG90LmNlbGxzLmxlbmd0aCAtIDEgJiYgZXBvY2ggPD0gY2VsbC5lbmRfZXBvY2ggKSApICkge1xuXHRcdFx0XHRcdG1hdGNoID0gaW5kZXg7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gbWF0Y2g7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRm9ybWF0IG9uZSBlcG9jaCBhcyBsb2NhbCBudW1lcmljIHBhcnRzIGluIHRoZSBzaXRlIHRpbWV6b25lLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGVwb2NoIEV4YWN0IGVwb2NoIG1pbGxpc2Vjb25kcy5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdGltZXpvbmUgSUFOQSBzaXRlIHRpbWV6b25lLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBOdW1lcmljIGxvY2FsIHBhcnRzLCBvciBudWxsIHdpdGhvdXQgSW50bCBzdXBwb3J0LlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF96b25lZF9wYXJ0cyggZXBvY2gsIHRpbWV6b25lICkge1xuXHRcdFx0dmFyIGludGxfYXBpID0gd2luZG93LkludGwgfHwgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIEludGwgPyBJbnRsIDogbnVsbCApO1xuXHRcdFx0dmFyIGZvcm1hdHRlcjtcblx0XHRcdHZhciB2YWx1ZXMgPSB7fTtcblxuXHRcdFx0aWYgKCAhIGludGxfYXBpIHx8ICEgdGltZXpvbmUgfHwgISBpbnRsX2FwaS5EYXRlVGltZUZvcm1hdC5wcm90b3R5cGUuZm9ybWF0VG9QYXJ0cyApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRmb3JtYXR0ZXIgPSBuZXcgaW50bF9hcGkuRGF0ZVRpbWVGb3JtYXQoICdlbi1VUycsIHtcblx0XHRcdFx0XHR0aW1lWm9uZTogdGltZXpvbmUsXG5cdFx0XHRcdFx0eWVhcjogJ251bWVyaWMnLFxuXHRcdFx0XHRcdG1vbnRoOiAnMi1kaWdpdCcsXG5cdFx0XHRcdFx0ZGF5OiAnMi1kaWdpdCcsXG5cdFx0XHRcdFx0aG91cjogJzItZGlnaXQnLFxuXHRcdFx0XHRcdGhvdXJDeWNsZTogJ2gyMycsXG5cdFx0XHRcdFx0bWludXRlOiAnMi1kaWdpdCcsXG5cdFx0XHRcdFx0c2Vjb25kOiAnMi1kaWdpdCdcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRmb3JtYXR0ZXIuZm9ybWF0VG9QYXJ0cyggbmV3IERhdGUoIGVwb2NoICkgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHBhcnQgKSB7XG5cdFx0XHRcdFx0aWYgKCAnbGl0ZXJhbCcgIT09IHBhcnQudHlwZSApIHtcblx0XHRcdFx0XHRcdHZhbHVlc1sgcGFydC50eXBlIF0gPSBOdW1iZXIoIHBhcnQudmFsdWUgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB2YWx1ZXMueWVhciAmJiB2YWx1ZXMubW9udGggJiYgdmFsdWVzLmRheSA/IHZhbHVlcyA6IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUGFkIG9uZSBub24tbmVnYXRpdmUgaW50ZWdlciBmb3IgYW4gZXhhY3QgaW5zdGFudC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSB2YWx1ZSBOdW1lcmljIGRhdGUgb3Igb2Zmc2V0IHBhcnQuXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGxlbmd0aCBSZXF1aXJlZCBvdXRwdXQgbGVuZ3RoLlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gWmVyby1wYWRkZWQgaW50ZWdlci5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBwYWRfaW5zdGFudF9wYXJ0KCB2YWx1ZSwgbGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuIFN0cmluZyggTWF0aC5hYnMoIE1hdGgucm91bmQoIHZhbHVlICkgKSApLnBhZFN0YXJ0KCBsZW5ndGgsICcwJyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEZvcm1hdCBvbmUgZXBvY2ggYXMgYW4gZXhhY3QgbWludXRlIGluIHRoZSBhdXRob3JpdGF0aXZlIHNpdGUgdGltZXpvbmUuXG5cdFx0ICpcblx0XHQgKiBUaGUgY2Fub25pY2FsIHNlcnZlciByZXBlYXRzIHRpbWV6b25lLCBvZmZzZXQsIGFtYmlndWl0eSwgbm9uZXhpc3RlbnQtdGltZSxcblx0XHQgKiBhbmQgb3Zlcm5pZ2h0IHZhbGlkYXRpb24uIFRoaXMgYnJvd3NlciBmb3JtYXR0ZXIgb25seSBwcmVzZXJ2ZXMgdGhlIGV4YWN0XG5cdFx0ICogYm91bmRlZCBpbnN0YW50IHNlbGVjdGVkIG9uIHRoZSBUaW1lbGluZSBheGlzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGVwb2NoIEV4YWN0IGJvdW5kYXJ5IGVwb2NoIGluIG1pbGxpc2Vjb25kcy5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdGltZXpvbmUgSUFOQSBzaXRlIHRpbWV6b25lLlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gUkZDMzMzOSBtaW51dGUgaW5zdGFudCwgb3IgYW4gZW1wdHkgc3RyaW5nIG9uIGZhaWx1cmUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZm9ybWF0X3Jldmlld19pbnN0YW50KCBlcG9jaCwgdGltZXpvbmUgKSB7XG5cdFx0XHR2YXIgcGFydHMgPSBnZXRfem9uZWRfcGFydHMoIGVwb2NoLCB0aW1lem9uZSApO1xuXHRcdFx0dmFyIHJlcHJlc2VudGVkX2Vwb2NoO1xuXHRcdFx0dmFyIG9mZnNldF9taW51dGVzO1xuXHRcdFx0dmFyIG9mZnNldF9zaWduO1xuXG5cdFx0XHRpZiAoICEgcGFydHMgKSB7XG5cdFx0XHRcdHJldHVybiAnJztcblx0XHRcdH1cblx0XHRcdHJlcHJlc2VudGVkX2Vwb2NoID0gRGF0ZS5VVEMoIHBhcnRzLnllYXIsIHBhcnRzLm1vbnRoIC0gMSwgcGFydHMuZGF5LCBwYXJ0cy5ob3VyLCBwYXJ0cy5taW51dGUsIHBhcnRzLnNlY29uZCApO1xuXHRcdFx0b2Zmc2V0X21pbnV0ZXMgPSBNYXRoLnJvdW5kKCAoIHJlcHJlc2VudGVkX2Vwb2NoIC0gZXBvY2ggKSAvIDYwMDAwICk7XG5cdFx0XHRvZmZzZXRfc2lnbiA9IDAgPD0gb2Zmc2V0X21pbnV0ZXMgPyAnKycgOiAnLSc7XG5cblx0XHRcdHJldHVybiBbXG5cdFx0XHRcdHBhZF9pbnN0YW50X3BhcnQoIHBhcnRzLnllYXIsIDQgKSwgJy0nLCBwYWRfaW5zdGFudF9wYXJ0KCBwYXJ0cy5tb250aCwgMiApLCAnLScsIHBhZF9pbnN0YW50X3BhcnQoIHBhcnRzLmRheSwgMiApLFxuXHRcdFx0XHQnVCcsIHBhZF9pbnN0YW50X3BhcnQoIHBhcnRzLmhvdXIsIDIgKSwgJzonLCBwYWRfaW5zdGFudF9wYXJ0KCBwYXJ0cy5taW51dGUsIDIgKSwgJzowMCcsXG5cdFx0XHRcdG9mZnNldF9zaWduLCBwYWRfaW5zdGFudF9wYXJ0KCBNYXRoLmZsb29yKCBNYXRoLmFicyggb2Zmc2V0X21pbnV0ZXMgKSAvIDYwICksIDIgKSwgJzonLCBwYWRfaW5zdGFudF9wYXJ0KCBNYXRoLmFicyggb2Zmc2V0X21pbnV0ZXMgKSAlIDYwLCAyIClcblx0XHRcdF0uam9pbiggJycgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXNvbHZlIGxvY2FsIHdhbGwtY2xvY2sgcGFydHMgdG8gYW4gZXhhY3QgaW5zdGFudCBpbiB0aGUgc2l0ZSB0aW1lem9uZS5cblx0XHQgKlxuXHRcdCAqIFRoZSBjYW5vbmljYWwgUmV2aWV3IHNlcnZpY2Ugc3RpbGwgcmVqZWN0cyBhbWJpZ3VvdXMgb3Igbm9uZXhpc3RlbnQgRFNUXG5cdFx0ICogcmVzdWx0cy4gVGhpcyBib3VuZGVkIHByb2plY3Rpb24gZXhpc3RzIG9ubHkgdG8gcHJlc2VydmUgdGhlIHNhdmVkIGNsb2NrXG5cdFx0ICogdGltZSB3aGlsZSBwcmVzZW50aW5nIHdob2xlLWRheSBwb2ludGVyIHN0ZXBzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGxvY2FsX3BhcnRzIENvbXBsZXRlIGxvY2FsIGRhdGUgYW5kIHRpbWUgcGFydHMuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHRpbWV6b25lIElBTkEgc2l0ZSB0aW1lem9uZS5cblx0XHQgKiBAcmV0dXJuIHtudW1iZXJ8bnVsbH0gRXhhY3QgZXBvY2ggbWlsbGlzZWNvbmRzLCBvciBudWxsIHdpdGhvdXQgc3VwcG9ydC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB6b25lZF9wYXJ0c190b19lcG9jaCggbG9jYWxfcGFydHMsIHRpbWV6b25lICkge1xuXHRcdFx0dmFyIHV0Y19ndWVzcyA9IERhdGUuVVRDKCBsb2NhbF9wYXJ0cy55ZWFyLCBsb2NhbF9wYXJ0cy5tb250aCAtIDEsIGxvY2FsX3BhcnRzLmRheSwgbG9jYWxfcGFydHMuaG91ciwgbG9jYWxfcGFydHMubWludXRlLCBsb2NhbF9wYXJ0cy5zZWNvbmQsIGxvY2FsX3BhcnRzLm1pbGxpc2Vjb25kICk7XG5cdFx0XHR2YXIgY2FuZGlkYXRlID0gdXRjX2d1ZXNzO1xuXHRcdFx0dmFyIGl0ZXJhdGlvbjtcblx0XHRcdHZhciBjYW5kaWRhdGVfcGFydHM7XG5cdFx0XHR2YXIgcmVwcmVzZW50ZWRfZXBvY2g7XG5cblx0XHRcdGZvciAoIGl0ZXJhdGlvbiA9IDA7IGl0ZXJhdGlvbiA8IDI7IGl0ZXJhdGlvbiArPSAxICkge1xuXHRcdFx0XHRjYW5kaWRhdGVfcGFydHMgPSBnZXRfem9uZWRfcGFydHMoIGNhbmRpZGF0ZSwgdGltZXpvbmUgKTtcblx0XHRcdFx0aWYgKCAhIGNhbmRpZGF0ZV9wYXJ0cyApIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXByZXNlbnRlZF9lcG9jaCA9IERhdGUuVVRDKCBjYW5kaWRhdGVfcGFydHMueWVhciwgY2FuZGlkYXRlX3BhcnRzLm1vbnRoIC0gMSwgY2FuZGlkYXRlX3BhcnRzLmRheSwgY2FuZGlkYXRlX3BhcnRzLmhvdXIsIGNhbmRpZGF0ZV9wYXJ0cy5taW51dGUsIGNhbmRpZGF0ZV9wYXJ0cy5zZWNvbmQsIGxvY2FsX3BhcnRzLm1pbGxpc2Vjb25kICk7XG5cdFx0XHRcdGNhbmRpZGF0ZSArPSB1dGNfZ3Vlc3MgLSByZXByZXNlbnRlZF9lcG9jaDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGNhbmRpZGF0ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBNb3ZlIGFuIGltbXV0YWJsZSBib3VuZGFyeSBieSB3aG9sZSBUaW1lbGluZSBjZWxscy5cblx0XHQgKlxuXHRcdCAqIFN1Yi1kYXkgc2NhbGVzIHJldGFpbiB0aGUgZXhhY3Qgb2Zmc2V0IGluc2lkZSB0aGVpciBmaXhlZC1zaXplIGNlbGwuIFRoZVxuXHRcdCAqIG9uZS1kYXkgc2NhbGUgcmVjb25zdHJ1Y3RzIHRoZSBzYW1lIHNpdGUtbG9jYWwgd2FsbCBjbG9jayBvbiB0aGUgdGFyZ2V0XG5cdFx0ICogZGF0ZSBzbyBhIDE0OjAwIGJvdW5kYXJ5IHJlbWFpbnMgMTQ6MDAgYWNyb3NzIG9yZGluYXJ5IGFuZCBEU1QgZGF0ZXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc25hcHNob3QgQXhpcyBzbmFwc2hvdC5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gYm91bmRhcnlfZXBvY2ggSW1tdXRhYmxlIGJvdW5kYXJ5IGVwb2NoLlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBzdGVwX2RlbHRhIFNpZ25lZCB3aG9sZS1jZWxsIGRlbHRhLlxuXHRcdCAqIEByZXR1cm4ge251bWJlcn0gRXhhY3QgdGFyZ2V0IGJvdW5kYXJ5IHdpdGhpbiB0aGUgbG9hZGVkIGF4aXMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2hpZnRfYm91bmRhcnlfYnlfYXhpc19zdGVwcyggc25hcHNob3QsIGJvdW5kYXJ5X2Vwb2NoLCBzdGVwX2RlbHRhICkge1xuXHRcdFx0dmFyIHNvdXJjZV9pbmRleCA9IGZpbmRfYXhpc19jZWxsX2luZGV4KCBzbmFwc2hvdCwgYm91bmRhcnlfZXBvY2ggKTtcblx0XHRcdHZhciB0YXJnZXRfaW5kZXg7XG5cdFx0XHR2YXIgc291cmNlX2NlbGw7XG5cdFx0XHR2YXIgdGFyZ2V0X2NlbGw7XG5cdFx0XHR2YXIgYm91bmRhcnlfcGFydHM7XG5cdFx0XHR2YXIgdGFyZ2V0X3BhcnRzO1xuXHRcdFx0dmFyIHRhcmdldF9lcG9jaDtcblxuXHRcdFx0aWYgKCAtMSA9PT0gc291cmNlX2luZGV4ICkge1xuXHRcdFx0XHRyZXR1cm4gYm91bmRhcnlfZXBvY2g7XG5cdFx0XHR9XG5cdFx0XHR0YXJnZXRfaW5kZXggPSBNYXRoLm1heCggMCwgTWF0aC5taW4oIHNuYXBzaG90LmNlbGxzLmxlbmd0aCAtIDEsIHNvdXJjZV9pbmRleCArIHN0ZXBfZGVsdGEgKSApO1xuXHRcdFx0c291cmNlX2NlbGwgPSBzbmFwc2hvdC5jZWxsc1tzb3VyY2VfaW5kZXhdO1xuXHRcdFx0dGFyZ2V0X2NlbGwgPSBzbmFwc2hvdC5jZWxsc1t0YXJnZXRfaW5kZXhdO1xuXG5cdFx0XHRpZiAoIDE0NDAgPT09IHNuYXBzaG90LmNlbGxfbWludXRlcyAmJiBzbmFwc2hvdC50aW1lem9uZSApIHtcblx0XHRcdFx0Ym91bmRhcnlfcGFydHMgPSBnZXRfem9uZWRfcGFydHMoIGJvdW5kYXJ5X2Vwb2NoLCBzbmFwc2hvdC50aW1lem9uZSApO1xuXHRcdFx0XHR0YXJnZXRfcGFydHMgPSBnZXRfem9uZWRfcGFydHMoIHRhcmdldF9jZWxsLnN0YXJ0X2Vwb2NoLCBzbmFwc2hvdC50aW1lem9uZSApO1xuXHRcdFx0XHRpZiAoIGJvdW5kYXJ5X3BhcnRzICYmIHRhcmdldF9wYXJ0cyApIHtcblx0XHRcdFx0XHR0YXJnZXRfZXBvY2ggPSB6b25lZF9wYXJ0c190b19lcG9jaCgge1xuXHRcdFx0XHRcdFx0eWVhcjogdGFyZ2V0X3BhcnRzLnllYXIsXG5cdFx0XHRcdFx0XHRtb250aDogdGFyZ2V0X3BhcnRzLm1vbnRoLFxuXHRcdFx0XHRcdFx0ZGF5OiB0YXJnZXRfcGFydHMuZGF5LFxuXHRcdFx0XHRcdFx0aG91cjogYm91bmRhcnlfcGFydHMuaG91cixcblx0XHRcdFx0XHRcdG1pbnV0ZTogYm91bmRhcnlfcGFydHMubWludXRlLFxuXHRcdFx0XHRcdFx0c2Vjb25kOiBib3VuZGFyeV9wYXJ0cy5zZWNvbmQsXG5cdFx0XHRcdFx0XHRtaWxsaXNlY29uZDogbmV3IERhdGUoIGJvdW5kYXJ5X2Vwb2NoICkuZ2V0VVRDTWlsbGlzZWNvbmRzKClcblx0XHRcdFx0XHR9LCBzbmFwc2hvdC50aW1lem9uZSApO1xuXHRcdFx0XHRcdGlmICggbnVsbCAhPT0gdGFyZ2V0X2Vwb2NoICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRhcmdldF9lcG9jaDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRhcmdldF9jZWxsLnN0YXJ0X2Vwb2NoICsgKCBib3VuZGFyeV9lcG9jaCAtIHNvdXJjZV9jZWxsLnN0YXJ0X2Vwb2NoICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUHJvamVjdCB0aGUgcG9pbnRlciBhcyBhIHJlbGF0aXZlIHdob2xlLWNlbGwgbW92ZW1lbnQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc25hcHNob3QgQXhpcyBzbmFwc2hvdC5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gY2xpZW50X3ggUGh5c2ljYWwgdmlld3BvcnQgY29vcmRpbmF0ZS5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZ2VzdHVyZSBBY3RpdmUgcG9pbnRlciBnZXN0dXJlLlxuXHRcdCAqIEByZXR1cm4ge251bWJlcn0gRXhhY3QgaW1tdXRhYmxlLWJvdW5kYXJ5IHByb2plY3Rpb24uXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcG9pbnRlcl90b19zdGVwX2Vwb2NoKCBzbmFwc2hvdCwgY2xpZW50X3gsIGdlc3R1cmUgKSB7XG5cdFx0XHR2YXIgY3VycmVudF9wb3NpdGlvbiA9IHBvaW50ZXJfdG9fYXhpc19wb3NpdGlvbiggc25hcHNob3QsIGNsaWVudF94ICk7XG5cdFx0XHR2YXIgc3RlcF9kZWx0YSA9IHJvdW5kX2F4aXNfc3RlcHMoIGN1cnJlbnRfcG9zaXRpb24udW5pdHMgLSBnZXN0dXJlLnN0YXJ0X2F4aXNfdW5pdHMgKTtcblx0XHRcdHZhciBhbmNob3JfaW50ZXJ2YWwgPSBnZXRfZ2VzdHVyZV9hbmNob3JfaW50ZXJ2YWwoKTtcblx0XHRcdHZhciBib3VuZGFyeV9lcG9jaCA9ICdyZXNpemVfc3RhcnQnID09PSBnZXN0dXJlLm9wZXJhdGlvbiA/IGFuY2hvcl9pbnRlcnZhbC5zdGFydF9lcG9jaCA6IGFuY2hvcl9pbnRlcnZhbC5lbmRfZXBvY2g7XG5cblx0XHRcdHJldHVybiBzaGlmdF9ib3VuZGFyeV9ieV9heGlzX3N0ZXBzKCBzbmFwc2hvdCwgYm91bmRhcnlfZXBvY2gsIHN0ZXBfZGVsdGEgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBEZXRlcm1pbmUgd2hldGhlciByZWxlYXNlIHNob3VsZCByZXBsYWNlIHRoZSBsaXZlIHByb3Bvc2FsIHdpdGggY2VsbCBzbmFwcGluZy5cblx0XHQgKlxuXHRcdCAqIEEgc2FtZS1kYXkgdGltZWQgYm9va2luZyB1c2VzIHRoZSBjb21wbGV0ZSBkYXkgY2VsbCBhcyBhIHJlYWRhYmxlIHZpc3VhbCBjYXJkLFxuXHRcdCAqIHNvIGl0cyBib3JkZXIgaXMgbm90IHRoZSBzYXZlZCB0aW1lIGJvdW5kYXJ5LiBJdHMgcmVsYXRpdmUgbWludXRlIHByb2plY3Rpb25cblx0XHQgKiBtdXN0IHRoZXJlZm9yZSBzdXJ2aXZlIHJlbGVhc2U7IHNuYXBwaW5nIHRoYXQgdmlzdWFsIGJvcmRlciBieSB3aG9sZSBkYXkgY2VsbHNcblx0XHQgKiBjYW4gY29sbGFwc2UgYSByZWFsIGRyYWcgYmFjayB0byB0aGUgdW5jaGFuZ2VkIHNhdmVkIHRpbWUgYW5kIHNraXAgUmV2aWV3LlxuXHRcdCAqIE9yZGluYXJ5IHRpbWVkIGFuZCBmdWxsLWRheSBjYXJkcyByZXRhaW4gdGhlIGNvbmZpZ3VyZWQgVGltZWxpbmUtc3RlcCBwb2xpY3kuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZ2VzdHVyZSBBY3RpdmUgcG9pbnRlciBnZXN0dXJlLlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBmaW5hbCByZWxlYXNlIHVzZXMgVGltZWxpbmUtY2VsbCBzbmFwcGluZy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzaG91bGRfc25hcF9yZWxlYXNlX3RvX3RpbWVsaW5lX3N0ZXAoIGdlc3R1cmUgKSB7XG5cdFx0XHRyZXR1cm4gc25hcF90b190aW1lbGluZV9zdGVwICYmICEgZ2VzdHVyZS51c2VzX3Zpc3VhbF9ib3VuZGFyeV9oYW5kbGU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBhbmNob3IgaW50ZXJ2YWwgYXQgdGhlIHN0YXJ0IG9mIG9uZSBwb2ludGVyIGdlc3R1cmUuXG5cdFx0ICpcblx0XHQgKiBUaGUgZmlyc3QgZ2VzdHVyZSBzdGFydHMgZnJvbSB0aGUgaW1tdXRhYmxlIHNlcnZlciBjb250ZXh0LiBBIGRlbGliZXJhdGVcblx0XHQgKiBjb250aW51YXRpb24gZnJvbSBlaXRoZXIgcmV2aWV3ZWQgYm91bmRhcnkgc3RhcnRzIGZyb20gdGhlIGZyb3plbiBsb2NhbFxuXHRcdCAqIHByb3Bvc2FsLCB3aGlsZSBjYW5vbmljYWwgUmV2aWV3IHN0aWxsIGRlcml2ZXMgZ3JvdXBlZCBlZmZlY3RzIGZyb20gdGhlXG5cdFx0ICogdmVyaWZpZWQgc2lnbmVkIGJhc2UgaW5zdGVhZCBvZiB0cnVzdGluZyBicm93c2VyLXNlbGVjdGVkIGdyb3VwIG1lbWJlcnMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IEV4YWN0IHByZXNlbnRhdGlvbiBpbnRlcnZhbCBmb3IgdGhlIGdlc3R1cmUgYW5jaG9yLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9nZXN0dXJlX2FuY2hvcl9pbnRlcnZhbCgpIHtcblx0XHRcdHZhciBjb250ZXh0ID0gYWN0aXZlX3NlbGVjdGlvbi5jb250ZXh0O1xuXHRcdFx0dmFyIGJhc2VfaW50ZXJ2YWxzID0gcG9pbnRlcl9nZXN0dXJlICYmIHBvaW50ZXJfZ2VzdHVyZS5iYXNlX2ludGVydmFsc1xuXHRcdFx0XHQ/IHBvaW50ZXJfZ2VzdHVyZS5iYXNlX2ludGVydmFsc1xuXHRcdFx0XHQ6IGNvbnRleHQuYWZmZWN0ZWRfaW50ZXJ2YWxzO1xuXG5cdFx0XHRyZXR1cm4gYmFzZV9pbnRlcnZhbHNbIGNvbnRleHQuYW5jaG9yX2ludGVydmFsX2luZGV4IF07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29udmVydCBvbmUgbG9hZGVkLWF4aXMgaW5zdGFudCB0byBhIHBoeXNpY2FsIHZpZXdwb3J0IGNvb3JkaW5hdGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc25hcHNob3QgQXhpcyBzbmFwc2hvdC5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gZXBvY2ggRXhhY3QgZXBvY2ggbWlsbGlzZWNvbmRzLlxuXHRcdCAqIEByZXR1cm4ge251bWJlcn0gUGh5c2ljYWwgdmlld3BvcnQgY29vcmRpbmF0ZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBlcG9jaF90b194KCBzbmFwc2hvdCwgZXBvY2ggKSB7XG5cdFx0XHR2YXIgY2VsbCA9IHNuYXBzaG90LmNlbGxzWzBdO1xuXHRcdFx0dmFyIHJhdGlvO1xuXHRcdFx0aWYgKCBlcG9jaCA8PSBzbmFwc2hvdC5taW5fZXBvY2ggKSB7XG5cdFx0XHRcdHJldHVybiBzbmFwc2hvdC5pc19ydGwgPyBzbmFwc2hvdC5jZWxsc1swXS5yZWN0YW5nbGUucmlnaHQgOiBzbmFwc2hvdC5jZWxsc1swXS5yZWN0YW5nbGUubGVmdDtcblx0XHRcdH1cblx0XHRcdGlmICggZXBvY2ggPj0gc25hcHNob3QubWF4X2Vwb2NoICkge1xuXHRcdFx0XHRyZXR1cm4gc25hcHNob3QuaXNfcnRsXG5cdFx0XHRcdFx0PyBzbmFwc2hvdC5jZWxsc1tzbmFwc2hvdC5jZWxscy5sZW5ndGggLSAxXS5yZWN0YW5nbGUubGVmdFxuXHRcdFx0XHRcdDogc25hcHNob3QuY2VsbHNbc25hcHNob3QuY2VsbHMubGVuZ3RoIC0gMV0ucmVjdGFuZ2xlLnJpZ2h0O1xuXHRcdFx0fVxuXHRcdFx0c25hcHNob3QuY2VsbHMuc29tZSggZnVuY3Rpb24gKCBjYW5kaWRhdGUsIGluZGV4ICkge1xuXHRcdFx0XHRjZWxsID0gY2FuZGlkYXRlO1xuXHRcdFx0XHRyZXR1cm4gZXBvY2ggPj0gY2FuZGlkYXRlLnN0YXJ0X2Vwb2NoICYmICggZXBvY2ggPCBjYW5kaWRhdGUuZW5kX2Vwb2NoIHx8ICggaW5kZXggPT09IHNuYXBzaG90LmNlbGxzLmxlbmd0aCAtIDEgJiYgZXBvY2ggPD0gY2FuZGlkYXRlLmVuZF9lcG9jaCApICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRyYXRpbyA9IE1hdGgubWF4KCAwLCBNYXRoLm1pbiggMSwgKCBlcG9jaCAtIGNlbGwuc3RhcnRfZXBvY2ggKSAvIE1hdGgubWF4KCAxLCBjZWxsLmVuZF9lcG9jaCAtIGNlbGwuc3RhcnRfZXBvY2ggKSApICk7XG5cdFx0XHRyZXR1cm4gc25hcHNob3QuaXNfcnRsID8gY2VsbC5yZWN0YW5nbGUucmlnaHQgLSBjZWxsLnJlY3RhbmdsZS53aWR0aCAqIHJhdGlvIDogY2VsbC5yZWN0YW5nbGUubGVmdCArIGNlbGwucmVjdGFuZ2xlLndpZHRoICogcmF0aW87XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29uc3RydWN0IHRoZSBtdXRhYmxlIHByb3Bvc2FsIGZyb20gaW1tdXRhYmxlIHNlcnZlciBpbnRlcnZhbHMuXG5cdFx0ICpcblx0XHQgKiBUaGUgc2FtZSBib3VuZGFyeSBkZWx0YSBpcyBwcm9qZWN0ZWQgYWNyb3NzIGV2ZXJ5IHJlY3VycmVudCBvclxuXHRcdCAqIGRpc2NvbnRpbnVvdXMgb2NjdXJyZW5jZS4gQ2Fub25pY2FsIFJldmlldyB3aWxsIGxhdGVyIGRlcml2ZSBhbmQgdmFsaWRhdGVcblx0XHQgKiB0aGUgY29ycmVzcG9uZGluZyB3YWxsLWNsb2NrIGJvdW5kYXJ5IGluZGVwZW5kZW50bHkgZm9yIGVhY2ggb2NjdXJyZW5jZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBnZXN0dXJlIEFjdGl2ZSBnZXN0dXJlLlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBjYW5kaWRhdGVfZXBvY2ggUHJvamVjdGVkIGJvdW5kYXJ5LlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gTXV0YWJsZSBwcmVzZW50YXRpb24gcHJvcG9zYWwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY3JlYXRlX3Byb3Bvc2FsKCBnZXN0dXJlLCBjYW5kaWRhdGVfZXBvY2ggKSB7XG5cdFx0XHR2YXIgY29udGV4dCA9IGFjdGl2ZV9zZWxlY3Rpb24uY29udGV4dDtcblx0XHRcdHZhciBiYXNlX2ludGVydmFscyA9IGdlc3R1cmUuYmFzZV9pbnRlcnZhbHMgfHwgY29udGV4dC5hZmZlY3RlZF9pbnRlcnZhbHM7XG5cdFx0XHR2YXIgYW5jaG9yX2ludGVydmFsID0gYmFzZV9pbnRlcnZhbHNbIGNvbnRleHQuYW5jaG9yX2ludGVydmFsX2luZGV4IF07XG5cdFx0XHQvLyBEcmFnLXRpbWUgZnVsbC1kYXkgY2FuZGlkYXRlcyBtYXkgYmUgcHJlc2VudGF0aW9uLW9ubHkgcGFydGlhbCBkYXlzO1xuXHRcdFx0Ly8gcmVsZWFzZSBwcm9qZWN0cyB0aGVtIGJhY2sgdG8gZXhhY3QgY2FsZW5kYXItY2VsbCBib3VuZGFyaWVzLiBBIHBvc2l0aXZlXG5cdFx0XHQvLyBpbnN0YW50IGd1YXJkIGtlZXBzIHRoZSBjb250aW51b3VzIHByZXZpZXcgZnJvbSBjcm9zc2luZyB3aXRob3V0IHJlamVjdGluZ1xuXHRcdFx0Ly8gdmFsaWQgMjMtaG91ciBvciAyNS1ob3VyIGxvY2FsIGRheXMgYXQgYSBkYXlsaWdodC1zYXZpbmcgdHJhbnNpdGlvbi5cblx0XHRcdHZhciBtaW5pbXVtX2R1cmF0aW9uID0gLTEgIT09IGZ1bGxfZGF5X3NoYXBlcy5pbmRleE9mKCBjb250ZXh0LnNhdmVkX3NoYXBlICkgPyAxIDogNjAwMDA7XG5cdFx0XHR2YXIgY2hhbmdlZF9ib3VuZGFyaWVzID0ge1xuXHRcdFx0XHRzdGFydDogJ3Jlc2l6ZV9zdGFydCcgPT09IGdlc3R1cmUub3BlcmF0aW9uLFxuXHRcdFx0XHRlbmQ6ICdyZXNpemVfZW5kJyA9PT0gZ2VzdHVyZS5vcGVyYXRpb25cblx0XHRcdH07XG5cdFx0XHR2YXIgYm91bmRlZF9lcG9jaDtcblx0XHRcdHZhciBkZWx0YTtcblx0XHRcdHZhciBpbnRlcnZhbHM7XG5cblx0XHRcdGlmICggJ3Jlc2l6ZV9zdGFydCcgPT09IGdlc3R1cmUub3BlcmF0aW9uICkge1xuXHRcdFx0XHRib3VuZGVkX2Vwb2NoID0gTWF0aC5tYXgoIGdlc3R1cmUuYXhpcy5taW5fZXBvY2gsIE1hdGgubWluKCBjYW5kaWRhdGVfZXBvY2gsIGFuY2hvcl9pbnRlcnZhbC5lbmRfZXBvY2ggLSBtaW5pbXVtX2R1cmF0aW9uICkgKTtcblx0XHRcdFx0ZGVsdGEgPSBib3VuZGVkX2Vwb2NoIC0gYW5jaG9yX2ludGVydmFsLnN0YXJ0X2Vwb2NoO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ym91bmRlZF9lcG9jaCA9IE1hdGgubWluKCBnZXN0dXJlLmF4aXMubWF4X2Vwb2NoLCBNYXRoLm1heCggY2FuZGlkYXRlX2Vwb2NoLCBhbmNob3JfaW50ZXJ2YWwuc3RhcnRfZXBvY2ggKyBtaW5pbXVtX2R1cmF0aW9uICkgKTtcblx0XHRcdFx0ZGVsdGEgPSBib3VuZGVkX2Vwb2NoIC0gYW5jaG9yX2ludGVydmFsLmVuZF9lcG9jaDtcblx0XHRcdH1cblx0XHRcdGludGVydmFscyA9IGJhc2VfaW50ZXJ2YWxzLm1hcCggZnVuY3Rpb24gKCBpbnRlcnZhbCApIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRzdGFydF9lcG9jaDogJ3Jlc2l6ZV9zdGFydCcgPT09IGdlc3R1cmUub3BlcmF0aW9uID8gaW50ZXJ2YWwuc3RhcnRfZXBvY2ggKyBkZWx0YSA6IGludGVydmFsLnN0YXJ0X2Vwb2NoLFxuXHRcdFx0XHRcdGVuZF9lcG9jaDogJ3Jlc2l6ZV9lbmQnID09PSBnZXN0dXJlLm9wZXJhdGlvbiA/IGludGVydmFsLmVuZF9lcG9jaCArIGRlbHRhIDogaW50ZXJ2YWwuZW5kX2Vwb2NoXG5cdFx0XHRcdH07XG5cdFx0XHR9ICk7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRpbnRlcmFjdGlvbl9zb3VyY2U6ICdyZXNpemUnLFxuXHRcdFx0XHRvcGVyYXRpb246IGdlc3R1cmUub3BlcmF0aW9uLFxuXHRcdFx0XHRzb3VyY2VfY29udGV4dF90b2tlbjogY29udGV4dC5zb3VyY2VfY29udGV4dF90b2tlbixcblx0XHRcdFx0cHJvcG9zYWxfcmV2aXNpb246IGNvbnRleHQucHJvcG9zYWxfcmV2aXNpb25fc2VlZCxcblx0XHRcdFx0Ym91bmRhcnlfZXBvY2g6IGJvdW5kZWRfZXBvY2gsXG5cdFx0XHRcdGJvdW5kYXJ5X2luc3RhbnQ6IG5ldyBEYXRlKCBib3VuZGVkX2Vwb2NoICkudG9JU09TdHJpbmcoKSxcblx0XHRcdFx0aW50ZXJ2YWxzOiBpbnRlcnZhbHMsXG5cdFx0XHRcdGNoYW5nZWRfYm91bmRhcmllczogY2hhbmdlZF9ib3VuZGFyaWVzLFxuXHRcdFx0XHRzaWduYXR1cmU6IFtcblx0XHRcdFx0XHRjaGFuZ2VkX2JvdW5kYXJpZXMuc3RhcnQgPyAnc3RhcnQnIDogJycsXG5cdFx0XHRcdFx0Y2hhbmdlZF9ib3VuZGFyaWVzLmVuZCA/ICdlbmQnIDogJycsXG5cdFx0XHRcdFx0aW50ZXJ2YWxzLm1hcCggZnVuY3Rpb24gKCBpbnRlcnZhbCApIHtcblx0XHRcdFx0XHRcdHJldHVybiBpbnRlcnZhbC5zdGFydF9lcG9jaCArICc6JyArIGludGVydmFsLmVuZF9lcG9jaDtcblx0XHRcdFx0XHR9ICkuam9pbiggJywnIClcblx0XHRcdFx0XS5qb2luKCAnfCcgKVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBGcmVlemUgdGhlIGV4YWN0IGJyb3dzZXIgcHJvcG9zYWwgYWNjZXB0ZWQgYnkgY2Fub25pY2FsIFJldmlldy5cblx0XHQgKlxuXHRcdCAqIE9ubHkgdGhlIGdlc3R1cmUtYW5jaG9yIGludGVydmFsIGlzIHRyYW5zbWl0dGVkLiBUaGUgc291cmNlLWNvbnRleHQgdG9rZW5cblx0XHQgKiBiaW5kcyB0aGUgc2VydmVyLWRlcml2ZWQgcmVzaXplIHNjb3BlIGFuZCBpbW11dGFibGUgYW5jaG9yLCB3aGlsZSBjYW5vbmljYWxcblx0XHQgKiBSZXZpZXcgcmVsb2FkcyB0aGUgYm9va2luZyBhbmQgZGVyaXZlcyBldmVyeSBhZmZlY3RlZCBncm91cGVkIG9jY3VycmVuY2UuXG5cdFx0ICogVGhpcyBwcmV2ZW50cyB0aGUgYnJvd3NlciBmcm9tIGNob29zaW5nIG9yIG9taXR0aW5nIGdyb3VwIG1lbWJlcnMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gbG9jYWxfcHJvcG9zYWwgUHJlc2VudGF0aW9uLW9ubHkgcHJvcG9zYWwuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHRpbWV6b25lIEF1dGhvcml0YXRpdmUgVGltZWxpbmUgYXhpcyB0aW1lem9uZS5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gRnJvemVuIGNhbm9uaWNhbCBSZXZpZXcgcHJvcG9zYWwgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBmcmVlemVfcmV2aWV3X3Byb3Bvc2FsKCBsb2NhbF9wcm9wb3NhbCwgdGltZXpvbmUgKSB7XG5cdFx0XHR2YXIgY29udGV4dCA9IGFjdGl2ZV9zZWxlY3Rpb24gPyBhY3RpdmVfc2VsZWN0aW9uLmNvbnRleHQgOiBudWxsO1xuXHRcdFx0dmFyIGludGVydmFsID0gY29udGV4dCAmJiBsb2NhbF9wcm9wb3NhbCA/IGxvY2FsX3Byb3Bvc2FsLmludGVydmFsc1sgY29udGV4dC5hbmNob3JfaW50ZXJ2YWxfaW5kZXggXSA6IG51bGw7XG5cdFx0XHR2YXIgc3RhcnQ7XG5cdFx0XHR2YXIgZW5kO1xuXHRcdFx0dmFyIHJldmlzaW9uO1xuXG5cdFx0XHRpZiAoICEgY29udGV4dCB8fCAhIGludGVydmFsIHx8IC0xID09PSBvcGVyYXRpb25zLmluZGV4T2YoIGxvY2FsX3Byb3Bvc2FsLm9wZXJhdGlvbiApICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHN0YXJ0ID0gZm9ybWF0X3Jldmlld19pbnN0YW50KCBpbnRlcnZhbC5zdGFydF9lcG9jaCwgdGltZXpvbmUgKTtcblx0XHRcdGVuZCA9IGZvcm1hdF9yZXZpZXdfaW5zdGFudCggaW50ZXJ2YWwuZW5kX2Vwb2NoLCB0aW1lem9uZSApO1xuXHRcdFx0aWYgKCAhIHN0YXJ0IHx8ICEgZW5kIHx8IERhdGUucGFyc2UoIGVuZCApIDw9IERhdGUucGFyc2UoIHN0YXJ0ICkgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cmV2aXNpb24gPSBNYXRoLm1heCggY29udGV4dC5wcm9wb3NhbF9yZXZpc2lvbl9zZWVkLCBhY3RpdmVfc2VsZWN0aW9uLm5leHRfcHJvcG9zYWxfcmV2aXNpb24gfHwgY29udGV4dC5wcm9wb3NhbF9yZXZpc2lvbl9zZWVkICk7XG5cdFx0XHRhY3RpdmVfc2VsZWN0aW9uLm5leHRfcHJvcG9zYWxfcmV2aXNpb24gPSByZXZpc2lvbiArIDE7XG5cblx0XHRcdHJldHVybiBPYmplY3QuZnJlZXplKCB7XG5cdFx0XHRcdHNjaGVtYV92ZXJzaW9uOiBNYXRoLnJvdW5kKCBOdW1iZXIoIHJldmlld190cmFuc3BvcnQuc2NoZW1hX3ZlcnNpb24gKSApLFxuXHRcdFx0XHRib29raW5nX2lkOiBjb250ZXh0LmJvb2tpbmdfaWQsXG5cdFx0XHRcdGludGVyYWN0aW9uX3NvdXJjZTogJ3Jlc2l6ZScsXG5cdFx0XHRcdG9wZXJhdGlvbjogbG9jYWxfcHJvcG9zYWwub3BlcmF0aW9uLFxuXHRcdFx0XHR0YXJnZXRfcmVzb3VyY2VfaWQ6IGNvbnRleHQudGFyZ2V0X3Jlc291cmNlX2lkLFxuXHRcdFx0XHRzZWxlY3Rpb25fbWV0aG9kOiAnaW5kZXBlbmRlbnRfZnVsbF9kYXlzJyA9PT0gY29udGV4dC5zYXZlZF9zaGFwZSA/ICdpbmRpdmlkdWFsJyA6ICdwb2xpY3knLFxuXHRcdFx0XHRwcm9wb3NlZF9pbnRlcnZhbHM6IE9iamVjdC5mcmVlemUoIFsgT2JqZWN0LmZyZWV6ZSggeyBzdGFydDogc3RhcnQsIGVuZDogZW5kIH0gKSBdICksXG5cdFx0XHRcdHByb3Bvc2FsX3JldmlzaW9uOiByZXZpc2lvbixcblx0XHRcdFx0c291cmNlX2NvbnRleHRfdG9rZW46IGNvbnRleHQuc291cmNlX2NvbnRleHRfdG9rZW5cblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDcmVhdGUgdGhlIGRvY3VtZW50LWxldmVsIGhvc3QgZm9yIHRoZSBib3VuZGVkIFJldmlldyBwYW5lbC5cblx0XHQgKlxuXHRcdCAqIFRoZSBUaW1lbGluZSBjYW52YXMgbXVzdCByZXRhaW4gaG9yaXpvbnRhbCBzY3JvbGwgb3duZXJzaGlwIGFuZCB0aGVyZWZvcmVcblx0XHQgKiBjbGlwcyBibG9jay1heGlzIG92ZXJmbG93LiBNb3VudGluZyBSZXZpZXcgaW4gdGhlIGRvY3VtZW50IGJvZHkga2VlcHNcblx0XHQgKiBpdHMgYWN0aW9ucyByZWFjaGFibGUgd2l0aG91dCB3ZWFrZW5pbmcgYW55IFRpbWVsaW5lIGNsaXBwaW5nIGJvdW5kYXJ5LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR8bnVsbH0gRGVkaWNhdGVkIGhvc3Qgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBlbnN1cmVfcmV2aWV3X2hvc3QoKSB7XG5cdFx0XHRpZiAoIHJldmlld19ob3N0ICYmIHJldmlld19ob3N0LmlzQ29ubmVjdGVkICE9PSBmYWxzZSApIHtcblx0XHRcdFx0cmV0dXJuIHJldmlld19ob3N0O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIGFjdGl2ZV9zZWxlY3Rpb24gfHwgISBhY3RpdmVfc2VsZWN0aW9uLmNhcmQgfHwgISBkb2N1bWVudC5ib2R5ICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJldmlld19ob3N0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0XHRcdHJldmlld19ob3N0LmNsYXNzTmFtZSA9ICd3cGJjX3RpbWVsaW5lX2Jvb2tpbmdfcmVzaXplX19yZXZpZXdfaG9zdCB3cGJjX3RpbWVsaW5lX2Jvb2tpbmdfcmVzaXplX19yZXZpZXdfcG9ydGFsJztcblx0XHRcdHJldmlld19ob3N0LnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLXJlc2l6ZS1yZXZpZXctaG9zdCcsICcnICk7XG5cdFx0XHRyZXZpZXdfaG9zdC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBoYW5kbGVfY2xpY2sgKTtcblx0XHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoIHJldmlld19ob3N0ICk7XG5cblx0XHRcdHJldHVybiByZXZpZXdfaG9zdDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTaXplIGFuZCByZXBvc2l0aW9uIHRoZSBleGlzdGluZyBSZXZpZXcgc3VyZmFjZSB3aXRob3V0IHJlYnVpbGRpbmcgaXQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHBvc2l0aW9uX3Jldmlld19wb3BvdmVyKCkge1xuXHRcdFx0dmFyIGNhcmRfcmVjdGFuZ2xlO1xuXHRcdFx0dmFyIGNhbnZhc19yZWN0YW5nbGU7XG5cdFx0XHR2YXIgbWF4aW11bV9pbmxpbmVfc2l6ZTtcblx0XHRcdHZhciBzdXJmYWNlO1xuXHRcdFx0dmFyIHN1cmZhY2VfcmVjdGFuZ2xlO1xuXHRcdFx0dmFyIHN1cmZhY2Vfd2lkdGg7XG5cdFx0XHR2YXIgc3VyZmFjZV9oZWlnaHQ7XG5cdFx0XHR2YXIgdmlld3BvcnRfd2lkdGg7XG5cdFx0XHR2YXIgdmlld3BvcnRfaGVpZ2h0O1xuXHRcdFx0dmFyIGRlc2lyZWRfbGVmdDtcblx0XHRcdHZhciBkZXNpcmVkX3RvcDtcblx0XHRcdHZhciBtaW5pbXVtX2xlZnQ7XG5cdFx0XHR2YXIgbWF4aW11bV9sZWZ0O1xuXHRcdFx0dmFyIG1pbmltdW1fdG9wO1xuXHRcdFx0dmFyIG1heGltdW1fYm90dG9tO1xuXHRcdFx0dmFyIGJlbG93X3RvcDtcblx0XHRcdHZhciBhYm92ZV90b3A7XG5cdFx0XHR2YXIgcGxhY2VtZW50ID0gJ2JlbG93JztcblxuXHRcdFx0cmV2aWV3X3Bvc2l0aW9uX2ZyYW1lID0gMDtcblx0XHRcdGlmICggISByZXZpZXdfaG9zdCB8fCAhIGFjdGl2ZV9zZWxlY3Rpb24gfHwgISBhY3RpdmVfc2VsZWN0aW9uLmNhcmQgfHwgISByZXZpZXdfc2Nyb2xsX2NhbnZhcyApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y2FyZF9yZWN0YW5nbGUgPSBhY3RpdmVfc2VsZWN0aW9uLmNhcmQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRjYW52YXNfcmVjdGFuZ2xlID0gcmV2aWV3X3Njcm9sbF9jYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRzdXJmYWNlID0gcmV2aWV3X2hvc3QuZmlyc3RFbGVtZW50Q2hpbGQ7XG5cdFx0XHRpZiAoICEgc3VyZmFjZSB8fCAhIHN1cmZhY2UuZ2V0Qm91bmRpbmdDbGllbnRSZWN0ICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR2aWV3cG9ydF93aWR0aCA9IE1hdGgubWF4KCAwLCBOdW1iZXIoIHdpbmRvdy5pbm5lcldpZHRoICkgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudFdpZHRoIHx8IDAgKTtcblx0XHRcdHZpZXdwb3J0X2hlaWdodCA9IE1hdGgubWF4KCAwLCBOdW1iZXIoIHdpbmRvdy5pbm5lckhlaWdodCApIHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQgfHwgMCApO1xuXHRcdFx0bWluaW11bV9sZWZ0ID0gTWF0aC5tYXgoIHJldmlld19nYXAsIGNhbnZhc19yZWN0YW5nbGUubGVmdCArIHJldmlld19nYXAgKTtcblx0XHRcdG1heGltdW1faW5saW5lX3NpemUgPSBNYXRoLm1heCggMCwgTWF0aC5taW4oIHZpZXdwb3J0X3dpZHRoIC0gcmV2aWV3X2dhcCwgY2FudmFzX3JlY3RhbmdsZS5yaWdodCAtIHJldmlld19nYXAgKSAtIG1pbmltdW1fbGVmdCApO1xuXHRcdFx0aWYgKCBzdXJmYWNlLnN0eWxlICYmIDAgPCBtYXhpbXVtX2lubGluZV9zaXplICkge1xuXHRcdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiBzdXJmYWNlLnN0eWxlLnNldFByb3BlcnR5ICkge1xuXHRcdFx0XHRcdHN1cmZhY2Uuc3R5bGUuc2V0UHJvcGVydHkoICctLXdwYmMtdGltZWxpbmUtYm9va2luZy1yZXNpemUtcmV2aWV3LW1heC1pbmxpbmUtc2l6ZScsIE1hdGgucm91bmQoIG1heGltdW1faW5saW5lX3NpemUgKSArICdweCcgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRzdXJmYWNlLnN0eWxlWyAnLS13cGJjLXRpbWVsaW5lLWJvb2tpbmctcmVzaXplLXJldmlldy1tYXgtaW5saW5lLXNpemUnIF0gPSBNYXRoLnJvdW5kKCBtYXhpbXVtX2lubGluZV9zaXplICkgKyAncHgnO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRzdXJmYWNlX3JlY3RhbmdsZSA9IHN1cmZhY2UuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRzdXJmYWNlX3dpZHRoID0gc3VyZmFjZV9yZWN0YW5nbGUud2lkdGg7XG5cdFx0XHRzdXJmYWNlX2hlaWdodCA9IHN1cmZhY2VfcmVjdGFuZ2xlLmhlaWdodDtcblx0XHRcdG1heGltdW1fbGVmdCA9IE1hdGgubWF4KCBtaW5pbXVtX2xlZnQsIE1hdGgubWluKCB2aWV3cG9ydF93aWR0aCAtIHJldmlld19nYXAsIGNhbnZhc19yZWN0YW5nbGUucmlnaHQgLSByZXZpZXdfZ2FwICkgLSBzdXJmYWNlX3dpZHRoICk7XG5cdFx0XHRkZXNpcmVkX2xlZnQgPSBNYXRoLm1heCggbWluaW11bV9sZWZ0LCBNYXRoLm1pbiggbWF4aW11bV9sZWZ0LCBjYXJkX3JlY3RhbmdsZS5sZWZ0ICkgKTtcblx0XHRcdG1pbmltdW1fdG9wID0gTWF0aC5tYXgoIHJldmlld19nYXAsIGNhbnZhc19yZWN0YW5nbGUudG9wICsgcmV2aWV3X2dhcCApO1xuXHRcdFx0bWF4aW11bV9ib3R0b20gPSBNYXRoLm1pbiggdmlld3BvcnRfaGVpZ2h0IC0gcmV2aWV3X2dhcCwgY2FudmFzX3JlY3RhbmdsZS5ib3R0b20gLSByZXZpZXdfZ2FwICk7XG5cdFx0XHRpZiAoIG1heGltdW1fYm90dG9tIDw9IG1pbmltdW1fdG9wICkge1xuXHRcdFx0XHRtaW5pbXVtX3RvcCA9IHJldmlld19nYXA7XG5cdFx0XHRcdG1heGltdW1fYm90dG9tID0gdmlld3BvcnRfaGVpZ2h0IC0gcmV2aWV3X2dhcDtcblx0XHRcdH1cblx0XHRcdGJlbG93X3RvcCA9IGNhcmRfcmVjdGFuZ2xlLmJvdHRvbSArIHJldmlld19nYXA7XG5cdFx0XHRhYm92ZV90b3AgPSBjYXJkX3JlY3RhbmdsZS50b3AgLSBzdXJmYWNlX2hlaWdodCAtIHJldmlld19nYXA7XG5cdFx0XHRpZiAoIGJlbG93X3RvcCArIHN1cmZhY2VfaGVpZ2h0IDw9IG1heGltdW1fYm90dG9tICkge1xuXHRcdFx0XHRkZXNpcmVkX3RvcCA9IGJlbG93X3RvcDtcblx0XHRcdH0gZWxzZSBpZiAoIGFib3ZlX3RvcCA+PSBtaW5pbXVtX3RvcCApIHtcblx0XHRcdFx0ZGVzaXJlZF90b3AgPSBhYm92ZV90b3A7XG5cdFx0XHRcdHBsYWNlbWVudCA9ICdhYm92ZSc7XG5cdFx0XHR9IGVsc2UgaWYgKCBjYXJkX3JlY3RhbmdsZS50b3AgLSBtaW5pbXVtX3RvcCA+IG1heGltdW1fYm90dG9tIC0gY2FyZF9yZWN0YW5nbGUuYm90dG9tICkge1xuXHRcdFx0XHRkZXNpcmVkX3RvcCA9IE1hdGgubWF4KCBtaW5pbXVtX3RvcCwgYWJvdmVfdG9wICk7XG5cdFx0XHRcdHBsYWNlbWVudCA9ICdhYm92ZSc7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRkZXNpcmVkX3RvcCA9IE1hdGgubWF4KCBtaW5pbXVtX3RvcCwgTWF0aC5taW4oIG1heGltdW1fYm90dG9tIC0gc3VyZmFjZV9oZWlnaHQsIGJlbG93X3RvcCApICk7XG5cdFx0XHR9XG5cdFx0XHRyZXZpZXdfaG9zdC5zdHlsZS5sZWZ0ID0gTWF0aC5yb3VuZCggZGVzaXJlZF9sZWZ0ICkgKyAncHgnO1xuXHRcdFx0cmV2aWV3X2hvc3Quc3R5bGUudG9wID0gTWF0aC5yb3VuZCggZGVzaXJlZF90b3AgKSArICdweCc7XG5cdFx0XHRyZXZpZXdfaG9zdC5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1yZXNpemUtcmV2aWV3LXBsYWNlbWVudCcsIHBsYWNlbWVudCApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENvYWxlc2NlIFJldmlldy1wb3BvdmVyIHBvc2l0aW9uaW5nIGR1cmluZyBzY3JvbGxpbmcgYW5kIHZpZXdwb3J0IGNoYW5nZXMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9yZXZpZXdfc2Nyb2xsKCkge1xuXHRcdFx0aWYgKCAhIHJldmlld19wb3NpdGlvbl9mcmFtZSAmJiByZXZpZXdfaG9zdCApIHtcblx0XHRcdFx0cmV2aWV3X3Bvc2l0aW9uX2ZyYW1lID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggcG9zaXRpb25fcmV2aWV3X3BvcG92ZXIgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgb25lIFJldmlldyBzdGF0ZSB0aHJvdWdoIHRoZSBmaXhlZCBkb21haW4gdGVtcGxhdGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gdmlld19tb2RlbCBBdXRob3JpemVkIG5vcm1hbGl6ZWQgcHJlc2VudGF0aW9uIGZpZWxkcy5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9yZXZpZXcoIHZpZXdfbW9kZWwgKSB7XG5cdFx0XHR2YXIgaG9zdCA9IGVuc3VyZV9yZXZpZXdfaG9zdCgpO1xuXHRcdFx0aWYgKCAhIGhvc3QgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHJlbmRlcl90ZW1wbGF0ZSggaG9zdCwgJ3JldmlldycsIHZpZXdfbW9kZWwgKTtcblx0XHRcdHBvc2l0aW9uX3Jldmlld19wb3BvdmVyKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQXR0YWNoIHRoZSB0cmFuc2llbnQgc2Nyb2xsIHBvc2l0aW9uZXIgd2hpbGUgb25lIFJldmlldyBpcyB2aXNpYmxlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBhdHRhY2hfcmV2aWV3X3Bvc2l0aW9uaW5nKCkge1xuXHRcdFx0dmFyIGNhbnZhcyA9IG1vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLWNhbnZhc10nICk7XG5cdFx0XHRpZiAoICEgY2FudmFzICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHJldmlld19zY3JvbGxfY2FudmFzICYmIGNhbnZhcyAhPT0gcmV2aWV3X3Njcm9sbF9jYW52YXMgKSB7XG5cdFx0XHRcdHJldmlld19zY3JvbGxfY2FudmFzLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdzY3JvbGwnLCBoYW5kbGVfcmV2aWV3X3Njcm9sbCApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjYW52YXMgIT09IHJldmlld19zY3JvbGxfY2FudmFzICkge1xuXHRcdFx0XHRyZXZpZXdfc2Nyb2xsX2NhbnZhcyA9IGNhbnZhcztcblx0XHRcdFx0cmV2aWV3X3Njcm9sbF9jYW52YXMuYWRkRXZlbnRMaXN0ZW5lciggJ3Njcm9sbCcsIGhhbmRsZV9yZXZpZXdfc2Nyb2xsLCB7IHBhc3NpdmU6IHRydWUgfSApO1xuXHRcdFx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3Njcm9sbCcsIGhhbmRsZV9yZXZpZXdfc2Nyb2xsLCB7IGNhcHR1cmU6IHRydWUsIHBhc3NpdmU6IHRydWUgfSApO1xuXHRcdFx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3Jlc2l6ZScsIGhhbmRsZV9yZXZpZXdfc2Nyb2xsLCB7IHBhc3NpdmU6IHRydWUgfSApO1xuXHRcdFx0fVxuXHRcdFx0cG9zaXRpb25fcmV2aWV3X3BvcG92ZXIoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW1vdmUgUmV2aWV3IHJlcXVlc3QsIHBvc2l0aW9uaW5nLCBET00sIGFuZCBzaWduZWQgaW4tbWVtb3J5IHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBhYm9ydF9wZW5kaW5nIFdoZXRoZXIgdG8gYWJvcnQgYW4gYWN0aXZlIHJlcXVlc3QuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjbGVhcl9yZXZpZXcoIGFib3J0X3BlbmRpbmcgKSB7XG5cdFx0XHRyZXZpZXdfZ2VuZXJhdGlvbiArPSAxO1xuXHRcdFx0aWYgKCBhYm9ydF9wZW5kaW5nICYmIHJldmlld19yZXF1ZXN0ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiByZXZpZXdfcmVxdWVzdC5hYm9ydCApIHtcblx0XHRcdFx0cmV2aWV3X3JlcXVlc3QuYWJvcnQoKTtcblx0XHRcdH1cblx0XHRcdHJldmlld19yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdHJldmlld19tZW1vcnkgPSBudWxsO1xuXHRcdFx0aWYgKCByZXZpZXdfcG9zaXRpb25fZnJhbWUgKSB7XG5cdFx0XHRcdHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSggcmV2aWV3X3Bvc2l0aW9uX2ZyYW1lICk7XG5cdFx0XHRcdHJldmlld19wb3NpdGlvbl9mcmFtZSA9IDA7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHJldmlld19zY3JvbGxfY2FudmFzICkge1xuXHRcdFx0XHRyZXZpZXdfc2Nyb2xsX2NhbnZhcy5yZW1vdmVFdmVudExpc3RlbmVyKCAnc2Nyb2xsJywgaGFuZGxlX3Jldmlld19zY3JvbGwgKTtcblx0XHRcdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdzY3JvbGwnLCBoYW5kbGVfcmV2aWV3X3Njcm9sbCwgdHJ1ZSApO1xuXHRcdFx0XHR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3Jlc2l6ZScsIGhhbmRsZV9yZXZpZXdfc2Nyb2xsICk7XG5cdFx0XHRcdHJldmlld19zY3JvbGxfY2FudmFzID0gbnVsbDtcblx0XHRcdH1cblx0XHRcdGlmICggcmV2aWV3X2hvc3QgJiYgcmV2aWV3X2hvc3QucGFyZW50Tm9kZSApIHtcblx0XHRcdFx0cmV2aWV3X2hvc3QucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgaGFuZGxlX2NsaWNrICk7XG5cdFx0XHRcdHJldmlld19ob3N0LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoIHJldmlld19ob3N0ICk7XG5cdFx0XHR9XG5cdFx0XHRyZXZpZXdfaG9zdCA9IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTGVhdmUgYSBzdWNjZXNzZnVsIFJldmlldyBzbyBhbiBleHBsaWNpdCBoYW5kbGUgZ2VzdHVyZSBjYW4gY29udGludWUuXG5cdFx0ICpcblx0XHQgKiBUaGUgcmV2aWV3ZWQgbG9jYWwgaW50ZXJ2YWxzIHJlbWFpbiB0aGUgYmFzZSBmb3IgZWl0aGVyIGJvdW5kYXJ5LiBUaGUgcHJpb3Jcblx0XHQgKiBzaWduZWQgcGxhbiBpcyB0cmFuc2ZlcnJlZCBpbnRvIHRoaXMgb25lIGdlc3R1cmUgb25seSwgdGhlbiByZW1vdmVkIGZyb21cblx0XHQgKiB0aGUgdmlzaWJsZSBSZXZpZXcgc3RhdGUuIE9uIHJlbGVhc2UgdGhlIHNlcnZlciB2ZXJpZmllcyB0aGF0IGJhc2UgUmV2aWV3XG5cdFx0ICogYmVmb3JlIGF1dGhvcml6aW5nIHRoZSBuZXh0IG9uZS1ib3VuZGFyeSBjaGFuZ2UgYXMgYSBjdW11bGF0aXZlIHByb3Bvc2FsLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG9wZXJhdGlvbiBSZXF1ZXN0ZWQgcmVzaXplIG9wZXJhdGlvbi5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IEltbXV0YWJsZSBpbnRlcnZhbHMgYW5kIHNpZ25lZCBiYXNlIFJldmlldyBmb3IgdGhlIGdlc3R1cmUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbGVhdmVfcmV2aWV3X2Zvcl9wb2ludGVyKCBvcGVyYXRpb24gKSB7XG5cdFx0XHR2YXIgY29udGV4dCA9IGFjdGl2ZV9zZWxlY3Rpb24uY29udGV4dDtcblx0XHRcdHZhciByZXZpZXdlZF9wcm9wb3NhbCA9IGFjdGl2ZV9zZWxlY3Rpb24ucHJvcG9zYWw7XG5cdFx0XHR2YXIgY2FuX2NvbnRpbnVlID0gcmV2aWV3ZWRfcHJvcG9zYWwgJiYgcmV2aWV3X21lbW9yeSAmJiAtMSAhPT0gb3BlcmF0aW9ucy5pbmRleE9mKCBvcGVyYXRpb24gKTtcblx0XHRcdHZhciBiYXNlX2ludGVydmFscyA9IGNhbl9jb250aW51ZSA/IHJldmlld2VkX3Byb3Bvc2FsLmludGVydmFscyA6IGNvbnRleHQuYWZmZWN0ZWRfaW50ZXJ2YWxzO1xuXHRcdFx0dmFyIGJhc2VfcmV2aWV3ID0gY2FuX2NvbnRpbnVlXG5cdFx0XHRcdD8gT2JqZWN0LmZyZWV6ZSgge1xuXHRcdFx0XHRcdHBsYW46IHJldmlld19tZW1vcnkucGxhbixcblx0XHRcdFx0XHR0b2tlbjogcmV2aWV3X21lbW9yeS50b2tlbixcblx0XHRcdFx0XHRleHBpcmVzX2F0OiByZXZpZXdfbWVtb3J5LmV4cGlyZXNfYXQsXG5cdFx0XHRcdFx0dmlld19tb2RlbDogcmV2aWV3X21lbW9yeS52aWV3X21vZGVsLFxuXHRcdFx0XHRcdHByb3Bvc2FsOiByZXZpZXdlZF9wcm9wb3NhbCxcblx0XHRcdFx0XHRpbnRlcnZhbHM6IE9iamVjdC5mcmVlemUoIGJhc2VfaW50ZXJ2YWxzLm1hcCggZnVuY3Rpb24gKCBpbnRlcnZhbCApIHtcblx0XHRcdFx0XHRcdHJldHVybiBPYmplY3QuZnJlZXplKCB7XG5cdFx0XHRcdFx0XHRcdHN0YXJ0X2Vwb2NoOiBpbnRlcnZhbC5zdGFydF9lcG9jaCxcblx0XHRcdFx0XHRcdFx0ZW5kX2Vwb2NoOiBpbnRlcnZhbC5lbmRfZXBvY2hcblx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR9ICkgKVxuXHRcdFx0XHR9IClcblx0XHRcdFx0OiBudWxsO1xuXG5cdFx0XHRjbGVhcl9yZXZpZXcoIGZhbHNlICk7XG5cdFx0XHRpbnRlcmFjdGlvbl9zdGF0ZSA9ICdyZWFkeSc7XG5cdFx0XHRyZXZpZXdfZm9jdXNfdGFyZ2V0ID0gbnVsbDtcblx0XHRcdGlmICggISBjYW5fY29udGludWUgKSB7XG5cdFx0XHRcdGNsZWFyX2dob3N0cygpO1xuXHRcdFx0XHRjbGVhcl9oYW5kbGVfb2Zmc2V0cyggYWN0aXZlX3NlbGVjdGlvbi5jYXJkICk7XG5cdFx0XHRcdGFjdGl2ZV9zZWxlY3Rpb24ucHJvcG9zYWwgPSBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gT2JqZWN0LmZyZWV6ZSgge1xuXHRcdFx0XHRpbnRlcnZhbHM6IE9iamVjdC5mcmVlemUoIGJhc2VfaW50ZXJ2YWxzLm1hcCggZnVuY3Rpb24gKCBpbnRlcnZhbCApIHtcblx0XHRcdFx0XHRyZXR1cm4gT2JqZWN0LmZyZWV6ZSgge1xuXHRcdFx0XHRcdFx0c3RhcnRfZXBvY2g6IGludGVydmFsLnN0YXJ0X2Vwb2NoLFxuXHRcdFx0XHRcdFx0ZW5kX2Vwb2NoOiBpbnRlcnZhbC5lbmRfZXBvY2hcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdH0gKSApLFxuXHRcdFx0XHRiYXNlX3JldmlldzogYmFzZV9yZXZpZXdcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXN0b3JlIHRoZSBwcmlvciBzdWNjZXNzZnVsIFJldmlldyBhZnRlciBhIHJlbGVhc2Ugc25hcHMgdG8gaXRzIGJvdW5kYXJ5LlxuXHRcdCAqXG5cdFx0ICogVGhlIHNpZ25lZCBwbGFuIG5ldmVyIGxlYXZlcyBjb250cm9sbGVyIG1lbW9yeSBhbmQgbm8gcmVxdWVzdCBpcyBzZW50IGJlY2F1c2Vcblx0XHQgKiB0aGUgcHJvcG9zZWQgc2NoZWR1bGUgaXMgYnl0ZS1mb3ItYnl0ZSB1bmNoYW5nZWQgZnJvbSB0aGUgcmV2aWV3ZWQgYmFzZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBiYXNlX3JldmlldyBQcmlvciBzdWNjZXNzZnVsIHNpZ25lZCBSZXZpZXcgc3RhdGUuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBSZXZpZXcgd2FzIHJlc3RvcmVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlc3RvcmVfYmFzZV9yZXZpZXcoIGJhc2VfcmV2aWV3ICkge1xuXHRcdFx0aWYgKFxuXHRcdFx0XHQhIGFjdGl2ZV9zZWxlY3Rpb24gfHxcblx0XHRcdFx0ISBiYXNlX3JldmlldyB8fFxuXHRcdFx0XHQhIGJhc2VfcmV2aWV3LnBsYW4gfHxcblx0XHRcdFx0ISBiYXNlX3Jldmlldy5wcm9wb3NhbCB8fFxuXHRcdFx0XHQhIGJhc2VfcmV2aWV3LnZpZXdfbW9kZWwgfHxcblx0XHRcdFx0ISAvXlthLWYwLTldezY0fSQvaS50ZXN0KCBTdHJpbmcoIGJhc2VfcmV2aWV3LnRva2VuIHx8ICcnICkgKVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0YWN0aXZlX3NlbGVjdGlvbi5wcm9wb3NhbCA9IGJhc2VfcmV2aWV3LnByb3Bvc2FsO1xuXHRcdFx0cmV2aWV3X21lbW9yeSA9IE9iamVjdC5mcmVlemUoIHtcblx0XHRcdFx0cGxhbjogYmFzZV9yZXZpZXcucGxhbixcblx0XHRcdFx0dG9rZW46IFN0cmluZyggYmFzZV9yZXZpZXcudG9rZW4gKSxcblx0XHRcdFx0ZXhwaXJlc19hdDogTnVtYmVyKCBiYXNlX3Jldmlldy5leHBpcmVzX2F0ICkgfHwgMCxcblx0XHRcdFx0dmlld19tb2RlbDogYmFzZV9yZXZpZXcudmlld19tb2RlbFxuXHRcdFx0fSApO1xuXHRcdFx0cmV2aWV3X2Vycm9yX2Jhc2UgPSBudWxsO1xuXHRcdFx0aW50ZXJhY3Rpb25fc3RhdGUgPSAncmV2aWV3X3JlYWR5Jztcblx0XHRcdHJlbmRlcl9yZXZpZXcoIGJhc2VfcmV2aWV3LnZpZXdfbW9kZWwgKTtcblx0XHRcdGF0dGFjaF9yZXZpZXdfcG9zaXRpb25pbmcoKTtcblx0XHRcdGFubm91bmNlKCBhY3RpdmVfc2VsZWN0aW9uLmNhcmQsIGkxOG4ucmV2aWV3X3JlYWR5IHx8ICcnICk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIExlYXZlIGEgZmFpbGVkIFJldmlldyBzbyBhbiBlbGlnaWJsZSBib3VuZGFyeSBjYW4gYmUgY29ycmVjdGVkIGRpcmVjdGx5LlxuXHRcdCAqXG5cdFx0ICogUmV1c2luZyB0aGUgc2FtZSBib3VuZGFyeSBrZWVwcyB0aGUgcmVqZWN0ZWQgbG9jYWwgaW50ZXJ2YWxzIGFzIHRoZSBuZXh0XG5cdFx0ICogZ2VzdHVyZSBiYXNlLiBXaGVuIHRoYXQgcmVqZWN0ZWQgc3RlcCBmb2xsb3dlZCBhIHN1Y2Nlc3NmdWwgY3VtdWxhdGl2ZVxuXHRcdCAqIFJldmlldywgdGhlIGxhc3QgdmFsaWQgc2lnbmVkIGJhc2UgaXMgcmV0YWluZWQgc28gdGhlIHNlcnZlciBjYW4gYXV0aG9yaXplXG5cdFx0ICogdGhlIHByb3RlY3RlZCBvcHBvc2l0ZSBib3VuZGFyeS4gU3dpdGNoaW5nIGJvdW5kYXJpZXMgZGlzY2FyZHMgb25seSB0aGVcblx0XHQgKiByZWplY3RlZCBzdGVwIGFuZCByZXN1bWVzIGZyb20gdGhhdCBsYXN0IHZhbGlkIGJhc2UuIEEgZmlyc3Qtc3RlcCBmYWlsdXJlLFxuXHRcdCAqIHdoaWNoIGhhcyBubyBzaWduZWQgYmFzZSwgY29udGludWVzIHRvIHVzZSB0aGUgaW1tdXRhYmxlIHNhdmVkIGludGVydmFsLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG9wZXJhdGlvbiBSZXF1ZXN0ZWQgcmVzaXplIG9wZXJhdGlvbi5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IEltbXV0YWJsZSBpbnRlcnZhbHMgYW5kIHRoZSBsYXN0IHZhbGlkIHNpZ25lZCBiYXNlIFJldmlldywgd2hlbiBhdmFpbGFibGUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbGVhdmVfcmV2aWV3X2Vycm9yX2Zvcl9wb2ludGVyKCBvcGVyYXRpb24gKSB7XG5cdFx0XHR2YXIgY29udGV4dCA9IGFjdGl2ZV9zZWxlY3Rpb24uY29udGV4dDtcblx0XHRcdHZhciBmYWlsZWRfcHJvcG9zYWwgPSBhY3RpdmVfc2VsZWN0aW9uLnByb3Bvc2FsO1xuXHRcdFx0dmFyIGNhbl9jb3JyZWN0ID0gZmFpbGVkX3Byb3Bvc2FsICYmIGZhaWxlZF9wcm9wb3NhbC5vcGVyYXRpb24gPT09IG9wZXJhdGlvbiAmJiAtMSAhPT0gb3BlcmF0aW9ucy5pbmRleE9mKCBvcGVyYXRpb24gKTtcblx0XHRcdHZhciBzaWduZWRfYmFzZSA9IHJldmlld19lcnJvcl9iYXNlO1xuXHRcdFx0dmFyIGhhc19zaWduZWRfYmFzZSA9IHNpZ25lZF9iYXNlICYmIHNpZ25lZF9iYXNlLnBsYW4gJiYgL15bYS1mMC05XXs2NH0kL2kudGVzdCggU3RyaW5nKCBzaWduZWRfYmFzZS50b2tlbiB8fCAnJyApICkgJiYgQXJyYXkuaXNBcnJheSggc2lnbmVkX2Jhc2UuaW50ZXJ2YWxzICk7XG5cdFx0XHR2YXIgYmFzZV9pbnRlcnZhbHMgPSBjYW5fY29ycmVjdFxuXHRcdFx0XHQ/IGZhaWxlZF9wcm9wb3NhbC5pbnRlcnZhbHNcblx0XHRcdFx0OiAoIGhhc19zaWduZWRfYmFzZSA/IHNpZ25lZF9iYXNlLmludGVydmFscyA6IGNvbnRleHQuYWZmZWN0ZWRfaW50ZXJ2YWxzICk7XG5cdFx0XHR2YXIgYmFzZV9yZXZpZXcgPSBoYXNfc2lnbmVkX2Jhc2UgPyBzaWduZWRfYmFzZSA6IG51bGw7XG5cblx0XHRcdGNsZWFyX3JldmlldyggZmFsc2UgKTtcblx0XHRcdHJldmlld19lcnJvcl9iYXNlID0gbnVsbDtcblx0XHRcdGludGVyYWN0aW9uX3N0YXRlID0gJ3JlYWR5Jztcblx0XHRcdHJldmlld19mb2N1c190YXJnZXQgPSBudWxsO1xuXHRcdFx0aWYgKCAhIGNhbl9jb3JyZWN0ICkge1xuXHRcdFx0XHRjbGVhcl9naG9zdHMoKTtcblx0XHRcdFx0Y2xlYXJfaGFuZGxlX29mZnNldHMoIGFjdGl2ZV9zZWxlY3Rpb24uY2FyZCApO1xuXHRcdFx0XHRhY3RpdmVfc2VsZWN0aW9uLnByb3Bvc2FsID0gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIE9iamVjdC5mcmVlemUoIHtcblx0XHRcdFx0aW50ZXJ2YWxzOiBPYmplY3QuZnJlZXplKCBiYXNlX2ludGVydmFscy5tYXAoIGZ1bmN0aW9uICggaW50ZXJ2YWwgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIE9iamVjdC5mcmVlemUoIHtcblx0XHRcdFx0XHRcdHN0YXJ0X2Vwb2NoOiBpbnRlcnZhbC5zdGFydF9lcG9jaCxcblx0XHRcdFx0XHRcdGVuZF9lcG9jaDogaW50ZXJ2YWwuZW5kX2Vwb2NoXG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9ICkgKSxcblx0XHRcdFx0YmFzZV9yZXZpZXc6IGJhc2VfcmV2aWV3XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVhZCBvbmUgbm9ybWFsaXplZCBlcnJvciByZWNvcmQgZnJvbSBhIGZhaWxlZCBjYW5vbmljYWwgUmV2aWV3IHJlc3BvbnNlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGZhaWxlZF9yZXF1ZXN0ICBqUXVlcnkgcmVxdWVzdC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZmFsbGJhY2tfbWVzc2FnZSBPcGVyYXRpb24tc3BlY2lmaWMgc2FmZSBmYWxsYmFjay5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IFNhZmUgY29kZSBhbmQgbWVzc2FnZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfcmV2aWV3X2Vycm9yKCBmYWlsZWRfcmVxdWVzdCwgZmFsbGJhY2tfbWVzc2FnZSApIHtcblx0XHRcdHZhciBlcnJvcl9kYXRhID0gZmFpbGVkX3JlcXVlc3QgJiYgZmFpbGVkX3JlcXVlc3QucmVzcG9uc2VKU09OID8gZmFpbGVkX3JlcXVlc3QucmVzcG9uc2VKU09OLmRhdGEgOiBudWxsO1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Y29kZTogZXJyb3JfZGF0YSAmJiAnc3RyaW5nJyA9PT0gdHlwZW9mIGVycm9yX2RhdGEuY29kZSA/IGVycm9yX2RhdGEuY29kZSA6ICcnLFxuXHRcdFx0XHRtZXNzYWdlOiBlcnJvcl9kYXRhICYmICdzdHJpbmcnID09PSB0eXBlb2YgZXJyb3JfZGF0YS5tZXNzYWdlICYmIGVycm9yX2RhdGEubWVzc2FnZVxuXHRcdFx0XHRcdD8gZXJyb3JfZGF0YS5tZXNzYWdlXG5cdFx0XHRcdFx0OiAoIGZhbGxiYWNrX21lc3NhZ2UgfHwgaTE4bi5yZXZpZXdfZXJyb3IgfHwgaTE4bi5lcnJvciB8fCAnJyApXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENsYXNzaWZ5IG9uZSBjYW5vbmljYWwgUmV2aWV3IGZhaWx1cmUgZm9yIGFkbWluaXN0cmF0aW9uIGZlZWRiYWNrLlxuXHRcdCAqXG5cdFx0ICogSFRUUCA0MDkgcmVwcmVzZW50cyBhbiBhY3Rpb25hYmxlIGNvbmZsaWN0IHdpdGggY3VycmVudCBib29raW5nIHBvbGljeSBvclxuXHRcdCAqIHN0YXRlLiBBdXRoZW50aWNhdGlvbiwgbWFsZm9ybWVkLCB0cmFuc3BvcnQsIGFuZCBzZXJ2ZXIgZmFpbHVyZXMgcmVtYWluXG5cdFx0ICogZXJyb3JzIGV2ZW4gd2hlbiB0aGUgZW5kcG9pbnQgc3VwcGxpZXMgYSBzYWZlIGVycm9yIGNvZGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZmFpbGVkX3JlcXVlc3QgRmFpbGVkIGpRdWVyeSByZXF1ZXN0LlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gU3RhbmRhcmQgYWRtaW5pc3RyYXRpb24gbm90aWNlIHR5cGUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3Jldmlld19ub3RpY2VfdHlwZSggZmFpbGVkX3JlcXVlc3QgKSB7XG5cdFx0XHRyZXR1cm4gNDA5ID09PSBOdW1iZXIoIGZhaWxlZF9yZXF1ZXN0ICYmIGZhaWxlZF9yZXF1ZXN0LnN0YXR1cyApID8gJ3dhcm5pbmcnIDogJ2Vycm9yJztcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWxvYWQgZGlyZWN0LXJlc2l6ZSBlbGlnaWJpbGl0eSBvbmNlIGFmdGVyIGEgc3RhbGUgc291cmNlIHJlc3BvbnNlLlxuXHRcdCAqXG5cdFx0ICogUmV2aWV3IGlzIG5ldmVyIHJldHJpZWQgYXV0b21hdGljYWxseS4gQSBuZXcgZ2VzdHVyZSByZXF1aXJlcyB0aGUgbmV3bHlcblx0XHQgKiBpc3N1ZWQgc291cmNlLWNvbnRleHQgdG9rZW4gYW5kIGEgbmV3IGV4cGxpY2l0IHBvaW50ZXIgcmVsZWFzZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVsb2FkX3N0YWxlX2VsaWdpYmlsaXR5KCkge1xuXHRcdFx0dmFyIGNhcmQgPSBhY3RpdmVfc2VsZWN0aW9uID8gYWN0aXZlX3NlbGVjdGlvbi5jYXJkIDogbnVsbDtcblx0XHRcdHZhciBib29raW5nX2lkID0gYWN0aXZlX3NlbGVjdGlvbiA/IGFjdGl2ZV9zZWxlY3Rpb24uYm9va2luZ19pZCA6IDA7XG5cdFx0XHR2YXIgcmVzdG9yZV9mb2N1cyA9IGFjdGl2ZV9zZWxlY3Rpb24gPyBhY3RpdmVfc2VsZWN0aW9uLnJlc3RvcmVfZm9jdXMgOiBudWxsO1xuXHRcdFx0dmFyIG9uX3NvdXJjZV9zdGFsZSA9IGFjdGl2ZV9zZWxlY3Rpb24gPyBhY3RpdmVfc2VsZWN0aW9uLm9uX3NvdXJjZV9zdGFsZSA6IG51bGw7XG5cdFx0XHR2YXIgaXNfZXh0ZXJuYWwgPSBCb29sZWFuKCBhY3RpdmVfc2VsZWN0aW9uICYmIGFjdGl2ZV9zZWxlY3Rpb24uaXNfZXh0ZXJuYWwgKTtcblx0XHRcdGNsZWFyX3JldmlldyggZmFsc2UgKTtcblx0XHRcdHJldmlld19lcnJvcl9iYXNlID0gbnVsbDtcblx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgaGFuZGxlX2ludGVyYWN0aW9uX2tleWRvd24sIHRydWUgKTtcblx0XHRcdGNsZWFyX2dob3N0cygpO1xuXHRcdFx0aWYgKCAhIGFjdGl2ZV9zZWxlY3Rpb24gKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNsZWFyX2hhbmRsZV9vZmZzZXRzKCBjYXJkICk7XG5cdFx0XHRpZiAoIGNhbGxiYWNrcyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgY2FsbGJhY2tzLnJlc3VtZV9vdmVydmlldyApIHtcblx0XHRcdFx0Y2FsbGJhY2tzLnJlc3VtZV9vdmVydmlldygpO1xuXHRcdFx0fVxuXHRcdFx0YWN0aXZlX3NlbGVjdGlvbi5wcm9wb3NhbCA9IG51bGw7XG5cdFx0XHRhY3RpdmVfc2VsZWN0aW9uLmNvbnRleHQgPSBudWxsO1xuXHRcdFx0YWN0aXZlX3NlbGVjdGlvbi5oYW5kbGVzID0gbnVsbDtcblx0XHRcdGFjdGl2ZV9zZWxlY3Rpb24uc3RhdGUgPSAnaWRsZSc7XG5cdFx0XHRhY3RpdmVfc2VsZWN0aW9uLnJlcXVlc3Rfc3RhdGUgPSAnaWRsZSc7XG5cdFx0XHRhY3RpdmVfc2VsZWN0aW9uLm1lc3NhZ2UgPSBpMThuLnJldmlld19zdGFsZSB8fCAnJztcblx0XHRcdHJldmlld19mb2N1c190YXJnZXQgPSBudWxsO1xuXHRcdFx0aW50ZXJhY3Rpb25fc3RhdGUgPSAnaWRsZSc7XG5cdFx0XHRhbm5vdW5jZSggY2FyZCwgYWN0aXZlX3NlbGVjdGlvbi5tZXNzYWdlICk7XG5cdFx0XHRzaG93X2FkbWluX25vdGljZSggYWN0aXZlX3NlbGVjdGlvbi5tZXNzYWdlLCAnd2FybmluZycsIDUwMDAgKTtcblx0XHRcdGlmICggaXNfZXh0ZXJuYWwgKSB7XG5cdFx0XHRcdGFjdGl2ZV9zZWxlY3Rpb24gPSBudWxsO1xuXHRcdFx0XHRpbnRlcmFjdGlvbl9zdGF0ZSA9ICdpZGxlJztcblx0XHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygb25fc291cmNlX3N0YWxlICkge1xuXHRcdFx0XHRcdG9uX3NvdXJjZV9zdGFsZSggYm9va2luZ19pZCApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHJlc3RvcmVfZm9jdXMgKSB7XG5cdFx0XHRcdFx0cmVzdG9yZV9mb2N1cyggYm9va2luZ19pZCwgJycgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRsb2FkX2VsaWdpYmlsaXR5KCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU2VuZCBleGFjdGx5IG9uZSBjYW5vbmljYWwgUmV2aWV3IHJlcXVlc3QgZm9yIG9uZSBmcm96ZW4gcG9pbnRlciByZWxlYXNlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGZyb3plbl9wcm9wb3NhbCBFeGFjdCBpbW11dGFibGUgUmV2aWV3IHByb3Bvc2FsLlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fG51bGx9IGJhc2VfcmV2aWV3IFByaW9yIHNpZ25lZCBSZXZpZXcgZm9yIGEgY3VtdWxhdGl2ZSBhZGp1c3RtZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVxdWVzdF9yZXZpZXcoIGZyb3plbl9wcm9wb3NhbCwgYmFzZV9yZXZpZXcgKSB7XG5cdFx0XHR2YXIgZ2VuZXJhdGlvbjtcblx0XHRcdHZhciByZXF1ZXN0X2RhdGE7XG5cblx0XHRcdGlmICggISBhY3RpdmVfc2VsZWN0aW9uIHx8IHJldmlld19yZXF1ZXN0IHx8ICEgZnJvemVuX3Byb3Bvc2FsICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpbnRlcmFjdGlvbl9zdGF0ZSA9ICdyZXZpZXdfcGVuZGluZyc7XG5cdFx0XHRyZXZpZXdfbWVtb3J5ID0gbnVsbDtcblx0XHRcdHJldmlld19lcnJvcl9iYXNlID0gbnVsbDtcblx0XHRcdHJlbmRlcl9yZXZpZXcoIHtcblx0XHRcdFx0c3RhdGU6ICdidXN5Jyxcblx0XHRcdFx0dGl0bGU6IGkxOG4ucmV2aWV3X3RpdGxlIHx8ICcnLFxuXHRcdFx0XHRtZXNzYWdlOiBpMThuLnJldmlld19wZW5kaW5nIHx8ICcnLFxuXHRcdFx0XHRjYW5fY2FuY2VsOiB0cnVlLFxuXHRcdFx0XHRjYW5jZWxfbGFiZWw6IGkxOG4uY2FuY2VsIHx8ICcnXG5cdFx0XHR9ICk7XG5cdFx0XHRhdHRhY2hfcmV2aWV3X3Bvc2l0aW9uaW5nKCk7XG5cdFx0XHRnZW5lcmF0aW9uID0gcmV2aWV3X2dlbmVyYXRpb247XG5cdFx0XHRyZXF1ZXN0X2RhdGEgPSB7XG5cdFx0XHRcdGFjdGlvbjogcmV2aWV3X3RyYW5zcG9ydC5hY3Rpb24sXG5cdFx0XHRcdG5vbmNlOiByZXZpZXdfdHJhbnNwb3J0Lm5vbmNlLFxuXHRcdFx0XHRib29raW5nX2lkOiBmcm96ZW5fcHJvcG9zYWwuYm9va2luZ19pZCxcblx0XHRcdFx0c291cmNlOiByZXZpZXdfdHJhbnNwb3J0LnNvdXJjZSxcblx0XHRcdFx0cHJvcG9zYWw6IEpTT04uc3RyaW5naWZ5KCBmcm96ZW5fcHJvcG9zYWwgKVxuXHRcdFx0fTtcblx0XHRcdGlmICggYmFzZV9yZXZpZXcgJiYgYmFzZV9yZXZpZXcucGxhbiAmJiAvXlthLWYwLTldezY0fSQvaS50ZXN0KCBTdHJpbmcoIGJhc2VfcmV2aWV3LnRva2VuIHx8ICcnICkgKSApIHtcblx0XHRcdFx0cmVxdWVzdF9kYXRhLmJhc2VfcGxhbiA9IEpTT04uc3RyaW5naWZ5KCBiYXNlX3Jldmlldy5wbGFuICk7XG5cdFx0XHRcdHJlcXVlc3RfZGF0YS5iYXNlX3Rva2VuID0gU3RyaW5nKCBiYXNlX3Jldmlldy50b2tlbiApO1xuXHRcdFx0fVxuXHRcdFx0cmV2aWV3X3JlcXVlc3QgPSB3aW5kb3cualF1ZXJ5LmFqYXgoIHtcblx0XHRcdFx0dXJsOiByZXZpZXdfdHJhbnNwb3J0LnVybCxcblx0XHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRcdGRhdGFUeXBlOiAnanNvbicsXG5cdFx0XHRcdGRhdGE6IHJlcXVlc3RfZGF0YVxuXHRcdFx0fSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRcdHZhciByZXN1bHQgPSByZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzID8gcmVzcG9uc2UuZGF0YSA6IG51bGw7XG5cdFx0XHRcdHZhciByZXZpZXcgPSByZXN1bHQgJiYgcmVzdWx0LnJldmlldyA/IHJlc3VsdC5yZXZpZXcgOiBudWxsO1xuXHRcdFx0XHR2YXIgcmV2aWV3X3ZpZXdfbW9kZWw7XG5cdFx0XHRcdGlmICggaXNfZGVzdHJveWVkIHx8IGdlbmVyYXRpb24gIT09IHJldmlld19nZW5lcmF0aW9uIHx8ICEgYWN0aXZlX3NlbGVjdGlvbiApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhIHJldmlldyB8fCBOdW1iZXIoIHJldmlldy5ib29raW5nX2lkICkgIT09IGZyb3plbl9wcm9wb3NhbC5ib29raW5nX2lkIHx8ICdyZXNpemUnICE9PSByZXZpZXcuaW50ZXJhY3Rpb25fc291cmNlIHx8IGZyb3plbl9wcm9wb3NhbC5vcGVyYXRpb24gIT09IHJldmlldy5vcGVyYXRpb24gfHwgISByZXN1bHQucGxhbiB8fCAhIC9eW2EtZjAtOV17NjR9JC9pLnRlc3QoIFN0cmluZyggcmVzdWx0LnRva2VuIHx8ICcnICkgKSB8fCBOdW1iZXIoIHJlc3VsdC5leHBpcmVzX2F0ICkgPD0gRGF0ZS5ub3coKSAvIDEwMDAgKSB7XG5cdFx0XHRcdFx0aW50ZXJhY3Rpb25fc3RhdGUgPSAncmV2aWV3X2Vycm9yJztcblx0XHRcdFx0XHRyZXZpZXdfbWVtb3J5ID0gbnVsbDtcblx0XHRcdFx0XHRyZXZpZXdfZXJyb3JfYmFzZSA9IGJhc2VfcmV2aWV3IHx8IG51bGw7XG5cdFx0XHRcdFx0cmVuZGVyX3Jldmlldygge1xuXHRcdFx0XHRcdFx0c3RhdGU6ICdlcnJvcicsXG5cdFx0XHRcdFx0XHR0aXRsZTogaTE4bi5yZXZpZXdfdGl0bGUgfHwgJycsXG5cdFx0XHRcdFx0XHRtZXNzYWdlOiBpMThuLnJldmlld19lcnJvciB8fCBpMThuLmVycm9yIHx8ICcnLFxuXHRcdFx0XHRcdFx0Y2FuY2VsX2xhYmVsOiBpMThuLmNhbmNlbCB8fCAnJyxcblx0XHRcdFx0XHRcdHNob3dfZmFsbGJhY2s6IEJvb2xlYW4oIGNhbGxiYWNrcyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgY2FsbGJhY2tzLm9wZW5fZnVsbF9yZXNjaGVkdWxlICksXG5cdFx0XHRcdFx0XHRmYWxsYmFja19sYWJlbDogaTE4bi5mdWxsX2RpYWxvZyB8fCAnJ1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRzaG93X2FkbWluX25vdGljZSggaTE4bi5yZXZpZXdfZXJyb3IgfHwgaTE4bi5lcnJvciB8fCAnJywgJ2Vycm9yJywgMTAwMDAgKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV2aWV3X3ZpZXdfbW9kZWwgPSBPYmplY3QuZnJlZXplKCB7XG5cdFx0XHRcdFx0c3RhdGU6ICdyZWFkeScsXG5cdFx0XHRcdFx0dGl0bGU6IGkxOG4ucmV2aWV3X3RpdGxlIHx8ICcnLFxuXHRcdFx0XHRcdHJlc2l6ZV9pbXBhY3Q6IHJldmlldy5yZXNpemVfaW1wYWN0IHx8IHt9LFxuXHRcdFx0XHRcdGludGVydmFsX2Rlc2NyaXB0aW9uOiAnJyxcblx0XHRcdFx0XHRkdXJhdGlvbl9kZXNjcmlwdGlvbjogcmV2aWV3LmR1cmF0aW9uICYmIHJldmlldy5kdXJhdGlvbi5wcm9wb3NlZF9sYWJlbCA/IFN0cmluZyggcmV2aWV3LmR1cmF0aW9uLnByb3Bvc2VkX2xhYmVsICkgOiAnJyxcblx0XHRcdFx0XHRjYW5fY2FuY2VsOiB0cnVlLFxuXHRcdFx0XHRcdGNhbmNlbF9sYWJlbDogaTE4bi5jYW5jZWwgfHwgJycsXG5cdFx0XHRcdFx0YXBwbHlfbGFiZWw6IGkxOG4uYXBwbHkgfHwgJydcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRyZXZpZXdfbWVtb3J5ID0gT2JqZWN0LmZyZWV6ZSgge1xuXHRcdFx0XHRcdHBsYW46IHJlc3VsdC5wbGFuLFxuXHRcdFx0XHRcdHRva2VuOiBTdHJpbmcoIHJlc3VsdC50b2tlbiApLFxuXHRcdFx0XHRcdGV4cGlyZXNfYXQ6IE51bWJlciggcmVzdWx0LmV4cGlyZXNfYXQgKSB8fCAwLFxuXHRcdFx0XHRcdHZpZXdfbW9kZWw6IHJldmlld192aWV3X21vZGVsXG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0cmV2aWV3X2Vycm9yX2Jhc2UgPSBudWxsO1xuXHRcdFx0XHRpbnRlcmFjdGlvbl9zdGF0ZSA9ICdyZXZpZXdfcmVhZHknO1xuXHRcdFx0XHRyZW5kZXJfcmV2aWV3KCByZXZpZXdfdmlld19tb2RlbCApO1xuXHRcdFx0XHRhbm5vdW5jZSggYWN0aXZlX3NlbGVjdGlvbi5jYXJkLCBpMThuLnJldmlld19yZWFkeSB8fCAnJyApO1xuXHRcdFx0fSApLmZhaWwoIGZ1bmN0aW9uICggZmFpbGVkX3JlcXVlc3QsIHJlcXVlc3Rfc3RhdHVzICkge1xuXHRcdFx0XHR2YXIgZXJyb3I7XG5cdFx0XHRcdHZhciBub3RpY2VfdHlwZTtcblx0XHRcdFx0aWYgKCBpc19kZXN0cm95ZWQgfHwgZ2VuZXJhdGlvbiAhPT0gcmV2aWV3X2dlbmVyYXRpb24gfHwgJ2Fib3J0JyA9PT0gcmVxdWVzdF9zdGF0dXMgfHwgISBhY3RpdmVfc2VsZWN0aW9uICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRlcnJvciA9IGdldF9yZXZpZXdfZXJyb3IoIGZhaWxlZF9yZXF1ZXN0ICk7XG5cdFx0XHRcdGlmICggJ3dwYmNfYm9va2luZ19yZXNjaGVkdWxpbmdfc291cmNlX3N0YWxlJyA9PT0gZXJyb3IuY29kZSApIHtcblx0XHRcdFx0XHRyZWxvYWRfc3RhbGVfZWxpZ2liaWxpdHkoKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV2aWV3X21lbW9yeSA9IG51bGw7XG5cdFx0XHRcdHJldmlld19lcnJvcl9iYXNlID0gYmFzZV9yZXZpZXcgfHwgbnVsbDtcblx0XHRcdFx0aW50ZXJhY3Rpb25fc3RhdGUgPSAncmV2aWV3X2Vycm9yJztcblx0XHRcdFx0cmVuZGVyX3Jldmlldygge1xuXHRcdFx0XHRcdHN0YXRlOiAnZXJyb3InLFxuXHRcdFx0XHRcdHRpdGxlOiBpMThuLnJldmlld190aXRsZSB8fCAnJyxcblx0XHRcdFx0XHRtZXNzYWdlOiBlcnJvci5tZXNzYWdlLFxuXHRcdFx0XHRcdGNhbmNlbF9sYWJlbDogaTE4bi5jYW5jZWwgfHwgJycsXG5cdFx0XHRcdFx0c2hvd19mYWxsYmFjazogQm9vbGVhbiggY2FsbGJhY2tzICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBjYWxsYmFja3Mub3Blbl9mdWxsX3Jlc2NoZWR1bGUgKSxcblx0XHRcdFx0XHRmYWxsYmFja19sYWJlbDogaTE4bi5mdWxsX2RpYWxvZyB8fCAnJ1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdG5vdGljZV90eXBlID0gZ2V0X3Jldmlld19ub3RpY2VfdHlwZSggZmFpbGVkX3JlcXVlc3QgKTtcblx0XHRcdFx0c2hvd19hZG1pbl9ub3RpY2UoIGVycm9yLm1lc3NhZ2UsIG5vdGljZV90eXBlLCAnd2FybmluZycgPT09IG5vdGljZV90eXBlID8gNTAwMCA6IDEwMDAwICk7XG5cdFx0XHR9ICkuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmICggZ2VuZXJhdGlvbiA9PT0gcmV2aWV3X2dlbmVyYXRpb24gKSB7XG5cdFx0XHRcdFx0cmV2aWV3X3JlcXVlc3QgPSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3RhcnQgY2Fub25pY2FsIFJlc2l6ZSBSZXZpZXcgZm9yIGdlb21ldHJ5IG93bmVkIGJ5IGFub3RoZXIgcHJlc2VudGF0aW9uLlxuXHRcdCAqXG5cdFx0ICogVGhlIGNhbGxlciBzdXBwbGllcyBubyBtdXRhdGlvbiBhdXRob3JpdHkuIFRoaXMgbWV0aG9kIGFjY2VwdHMgb25seSB0aGVcblx0XHQgKiBlc3RhYmxpc2hlZCBgcmVzaXplX3N0YXJ0YCBvciBgcmVzaXplX2VuZGAgcHJvcG9zYWwgc2hhcGUgYW5kIHN1Ym1pdHMgaXQgdG9cblx0XHQgKiB0aGUgZXhpc3Rpbmcgc2lnbmVkIFJldmlldyBlbmRwb2ludC4gQXBwbHkgYW5kIHJlYWRiYWNrIHJlbWFpbiB1bmNoYW5nZWQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcHJvcG9zYWwgRXhhY3QgZXhlY3V0YWJsZS1mcmVlIFJlc2l6ZSBSZXZpZXcgcHJvcG9zYWwuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHN0YXRlICAgIFByZXNlbnRhdGlvbiBjYXJkLCBmb2N1cywgYW5kIHN0YWxlLXN0YXRlIGNhbGxiYWNrcy5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGNhbm9uaWNhbCBSZXZpZXcgbGlmZWN5Y2xlIHN0YXJ0ZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmV2aWV3X3Jlc2l6ZV9wcm9wb3NhbCggcHJvcG9zYWwsIHN0YXRlICkge1xuXHRcdFx0dmFyIGludGVydmFsID0gcHJvcG9zYWwgJiYgQXJyYXkuaXNBcnJheSggcHJvcG9zYWwucHJvcG9zZWRfaW50ZXJ2YWxzICkgPyBwcm9wb3NhbC5wcm9wb3NlZF9pbnRlcnZhbHNbIDAgXSA6IG51bGw7XG5cdFx0XHR2YXIgb3BlcmF0aW9uID0gU3RyaW5nKCBwcm9wb3NhbCAmJiBwcm9wb3NhbC5vcGVyYXRpb24gfHwgJycgKTtcblx0XHRcdHZhciBjYXJkID0gc3RhdGUgJiYgc3RhdGUuY2FyZCA/IHN0YXRlLmNhcmQgOiBudWxsO1xuXHRcdFx0dmFyIGZyb3plbl9wcm9wb3NhbDtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHRpc19kZXN0cm95ZWRcblx0XHRcdFx0fHwgLTEgIT09IFsgJ3BvaW50ZXJfY2FuZGlkYXRlJywgJ2RyYWdnaW5nJywgJ3Jldmlld19wZW5kaW5nJywgJ3Jldmlld19yZWFkeScsICdhcHBseV9wZW5kaW5nJywgJ3JlZnJlc2hfcGVuZGluZycgXS5pbmRleE9mKCBpbnRlcmFjdGlvbl9zdGF0ZSApXG5cdFx0XHRcdHx8ICEgY2FyZFxuXHRcdFx0XHR8fCBmYWxzZSA9PT0gY2FyZC5pc0Nvbm5lY3RlZFxuXHRcdFx0XHR8fCBOdW1iZXIoIHByb3Bvc2FsICYmIHByb3Bvc2FsLnNjaGVtYV92ZXJzaW9uICkgIT09IE51bWJlciggcmV2aWV3X3RyYW5zcG9ydC5zY2hlbWFfdmVyc2lvbiApXG5cdFx0XHRcdHx8ICEgTnVtYmVyKCBwcm9wb3NhbCAmJiBwcm9wb3NhbC5ib29raW5nX2lkIClcblx0XHRcdFx0fHwgJ3Jlc2l6ZScgIT09IFN0cmluZyggcHJvcG9zYWwgJiYgcHJvcG9zYWwuaW50ZXJhY3Rpb25fc291cmNlIHx8ICcnIClcblx0XHRcdFx0fHwgLTEgPT09IG9wZXJhdGlvbnMuaW5kZXhPZiggb3BlcmF0aW9uIClcblx0XHRcdFx0fHwgISBOdW1iZXIoIHByb3Bvc2FsICYmIHByb3Bvc2FsLnRhcmdldF9yZXNvdXJjZV9pZCApXG5cdFx0XHRcdHx8IC0xID09PSBbICdwb2xpY3knLCAnaW5kaXZpZHVhbCcgXS5pbmRleE9mKCBTdHJpbmcoIHByb3Bvc2FsICYmIHByb3Bvc2FsLnNlbGVjdGlvbl9tZXRob2QgfHwgJycgKSApXG5cdFx0XHRcdHx8ICEgaW50ZXJ2YWxcblx0XHRcdFx0fHwgMSAhPT0gcHJvcG9zYWwucHJvcG9zZWRfaW50ZXJ2YWxzLmxlbmd0aFxuXHRcdFx0XHR8fCAhIGlzX2V4YWN0X2luc3RhbnQoIGludGVydmFsLnN0YXJ0IClcblx0XHRcdFx0fHwgISBpc19leGFjdF9pbnN0YW50KCBpbnRlcnZhbC5lbmQgKVxuXHRcdFx0XHR8fCBEYXRlLnBhcnNlKCBpbnRlcnZhbC5lbmQgKSA8PSBEYXRlLnBhcnNlKCBpbnRlcnZhbC5zdGFydCApXG5cdFx0XHRcdHx8ICEgTnVtYmVyKCBwcm9wb3NhbCAmJiBwcm9wb3NhbC5wcm9wb3NhbF9yZXZpc2lvbiApXG5cdFx0XHRcdHx8ICEgU3RyaW5nKCBwcm9wb3NhbCAmJiBwcm9wb3NhbC5zb3VyY2VfY29udGV4dF90b2tlbiB8fCAnJyApXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRjYW5jZWxfaW50ZXJhY3Rpb24oIGZhbHNlLCAnZXh0ZXJuYWxfcmVwbGFjZWQnICk7XG5cdFx0XHRpZiAoIGFjdGl2ZV9zZWxlY3Rpb24gJiYgYWN0aXZlX3NlbGVjdGlvbi5jYXJkICkge1xuXHRcdFx0XHRjbGVhcl9jYXJkKCBhY3RpdmVfc2VsZWN0aW9uLmNhcmQgKTtcblx0XHRcdH1cblx0XHRcdGFib3J0X3JlcXVlc3QoKTtcblx0XHRcdHByZXNlbnRhdGlvbl9nZW5lcmF0aW9uICs9IDE7XG5cdFx0XHRmcm96ZW5fcHJvcG9zYWwgPSBPYmplY3QuZnJlZXplKCB7XG5cdFx0XHRcdHNjaGVtYV92ZXJzaW9uOiBNYXRoLnJvdW5kKCBOdW1iZXIoIHByb3Bvc2FsLnNjaGVtYV92ZXJzaW9uICkgKSxcblx0XHRcdFx0Ym9va2luZ19pZDogTWF0aC5yb3VuZCggTnVtYmVyKCBwcm9wb3NhbC5ib29raW5nX2lkICkgKSxcblx0XHRcdFx0aW50ZXJhY3Rpb25fc291cmNlOiAncmVzaXplJyxcblx0XHRcdFx0b3BlcmF0aW9uOiBvcGVyYXRpb24sXG5cdFx0XHRcdHRhcmdldF9yZXNvdXJjZV9pZDogTWF0aC5yb3VuZCggTnVtYmVyKCBwcm9wb3NhbC50YXJnZXRfcmVzb3VyY2VfaWQgKSApLFxuXHRcdFx0XHRzZWxlY3Rpb25fbWV0aG9kOiBTdHJpbmcoIHByb3Bvc2FsLnNlbGVjdGlvbl9tZXRob2QgKSxcblx0XHRcdFx0cHJvcG9zZWRfaW50ZXJ2YWxzOiBPYmplY3QuZnJlZXplKCBbIE9iamVjdC5mcmVlemUoIHtcblx0XHRcdFx0XHRzdGFydDogU3RyaW5nKCBpbnRlcnZhbC5zdGFydCApLFxuXHRcdFx0XHRcdGVuZDogU3RyaW5nKCBpbnRlcnZhbC5lbmQgKVxuXHRcdFx0XHR9ICkgXSApLFxuXHRcdFx0XHRwcm9wb3NhbF9yZXZpc2lvbjogTWF0aC5yb3VuZCggTnVtYmVyKCBwcm9wb3NhbC5wcm9wb3NhbF9yZXZpc2lvbiApICksXG5cdFx0XHRcdHNvdXJjZV9jb250ZXh0X3Rva2VuOiBTdHJpbmcoIHByb3Bvc2FsLnNvdXJjZV9jb250ZXh0X3Rva2VuIClcblx0XHRcdH0gKTtcblx0XHRcdGFjdGl2ZV9zZWxlY3Rpb24gPSB7XG5cdFx0XHRcdGNhcmQ6IGNhcmQsXG5cdFx0XHRcdGJvb2tpbmdfaWQ6IGZyb3plbl9wcm9wb3NhbC5ib29raW5nX2lkLFxuXHRcdFx0XHRzZWdtZW50X2lkOiBTdHJpbmcoIHN0YXRlLnNlZ21lbnRfaWQgfHwgJycgKSxcblx0XHRcdFx0dmlzaWJsZV9zdGFydDogU3RyaW5nKCBzdGF0ZS52aXNpYmxlX3N0YXJ0IHx8IGludGVydmFsLnN0YXJ0ICksXG5cdFx0XHRcdHZpc2libGVfZW5kOiBTdHJpbmcoIHN0YXRlLnZpc2libGVfZW5kIHx8IGludGVydmFsLmVuZCApLFxuXHRcdFx0XHRzaG93X3N0YXJ0OiAncmVzaXplX3N0YXJ0JyA9PT0gb3BlcmF0aW9uLFxuXHRcdFx0XHRzaG93X2VuZDogJ3Jlc2l6ZV9lbmQnID09PSBvcGVyYXRpb24sXG5cdFx0XHRcdGtleTogJ2V4dGVybmFsLXJlc2l6ZS0nICsgZnJvemVuX3Byb3Bvc2FsLmJvb2tpbmdfaWQsXG5cdFx0XHRcdHN0YXRlOiAncmVhZHknLFxuXHRcdFx0XHRyZXF1ZXN0X3N0YXRlOiAnY29tcGxldGUnLFxuXHRcdFx0XHRoYW5kbGVzOiBudWxsLFxuXHRcdFx0XHRjb250ZXh0OiBzdGF0ZS5yZXNpemVfY29udGV4dCB8fCBudWxsLFxuXHRcdFx0XHRwcm9wb3NhbDoge1xuXHRcdFx0XHRcdG9wZXJhdGlvbjogb3BlcmF0aW9uLFxuXHRcdFx0XHRcdGludGVydmFsczogWyB7XG5cdFx0XHRcdFx0XHRzdGFydF9lcG9jaDogRGF0ZS5wYXJzZSggaW50ZXJ2YWwuc3RhcnQgKSxcblx0XHRcdFx0XHRcdGVuZF9lcG9jaDogRGF0ZS5wYXJzZSggaW50ZXJ2YWwuZW5kIClcblx0XHRcdFx0XHR9IF1cblx0XHRcdFx0fSxcblx0XHRcdFx0bmV4dF9wcm9wb3NhbF9yZXZpc2lvbjogZnJvemVuX3Byb3Bvc2FsLnByb3Bvc2FsX3JldmlzaW9uICsgMSxcblx0XHRcdFx0bWVzc2FnZTogJycsXG5cdFx0XHRcdGlzX2V4dGVybmFsOiB0cnVlLFxuXHRcdFx0XHRyZXN0b3JlX2ZvY3VzOiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc3RhdGUucmVzdG9yZV9mb2N1cyA/IHN0YXRlLnJlc3RvcmVfZm9jdXMgOiBudWxsLFxuXHRcdFx0XHRvbl9zb3VyY2Vfc3RhbGU6ICdmdW5jdGlvbicgPT09IHR5cGVvZiBzdGF0ZS5vbl9zb3VyY2Vfc3RhbGUgPyBzdGF0ZS5vbl9zb3VyY2Vfc3RhbGUgOiBudWxsXG5cdFx0XHR9O1xuXHRcdFx0cmV2aWV3X2ZvY3VzX3RhcmdldCA9IHN0YXRlLmZvY3VzIHx8IG51bGw7XG5cdFx0XHRpZiAoIGNhbGxiYWNrcyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgY2FsbGJhY2tzLnN1c3BlbmRfb3ZlcnZpZXcgKSB7XG5cdFx0XHRcdGNhbGxiYWNrcy5zdXNwZW5kX292ZXJ2aWV3KCBjYXJkICk7XG5cdFx0XHR9XG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIGhhbmRsZV9pbnRlcmFjdGlvbl9rZXlkb3duLCB0cnVlICk7XG5cdFx0XHRyZXF1ZXN0X3JldmlldyggZnJvemVuX3Byb3Bvc2FsLCBudWxsICk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEZpbmlzaCBhIHN1Y2Nlc3NmdWwgQXBwbHkgb25seSBhZnRlciBldmVyeSBjYW5vbmljYWwgaG9zdCByZWFkYmFjayBzdWNjZWVkcy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZmluaXNoX2FwcGx5X3JlZnJlc2goKSB7XG5cdFx0XHR2YXIgY2FyZCA9IGFjdGl2ZV9zZWxlY3Rpb24gPyBhY3RpdmVfc2VsZWN0aW9uLmNhcmQgOiBudWxsO1xuXG5cdFx0XHRjbGVhcl9yZXZpZXcoIGZhbHNlICk7XG5cdFx0XHRyZXZpZXdfZXJyb3JfYmFzZSA9IG51bGw7XG5cdFx0XHRwZW5kaW5nX2FwcGx5X3Jlc3VsdCA9IG51bGw7XG5cdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIGhhbmRsZV9pbnRlcmFjdGlvbl9rZXlkb3duLCB0cnVlICk7XG5cdFx0XHRjbGVhcl9naG9zdHMoKTtcblx0XHRcdGlmICggYWN0aXZlX3NlbGVjdGlvbiApIHtcblx0XHRcdFx0Y2xlYXJfaGFuZGxlX29mZnNldHMoIGNhcmQgKTtcblx0XHRcdFx0YWN0aXZlX3NlbGVjdGlvbi5wcm9wb3NhbCA9IG51bGw7XG5cdFx0XHRcdGludGVyYWN0aW9uX3N0YXRlID0gYWN0aXZlX3NlbGVjdGlvbi5jb250ZXh0ID8gJ3JlYWR5JyA6ICdpZGxlJztcblx0XHRcdH1cblx0XHRcdGlmICggY2FsbGJhY2tzICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBjYWxsYmFja3MucmVzdW1lX292ZXJ2aWV3ICkge1xuXHRcdFx0XHRjYWxsYmFja3MucmVzdW1lX292ZXJ2aWV3KCk7XG5cdFx0XHR9XG5cdFx0XHRyZXN0b3JlX2FwcGx5X2hhbmRsZV9mb2N1cygpO1xuXHRcdFx0c2hvd19hZG1pbl9ub3RpY2UoIGkxOG4uYXBwbGllZCB8fCAnJywgJ3N1Y2Nlc3MnLCAzMDAwICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVmcmVzaCBjYW5vbmljYWwgVGltZWxpbmUgYW5kIEluc3BlY3RvciBwcm9qZWN0aW9ucyBhZnRlciBwZXJzaXN0ZW5jZS5cblx0XHQgKlxuXHRcdCAqIFRoZSByZXRhaW5lZCBBcHBseSByZXN1bHQgaXMgYSBzdWNjZXNzIGlkZW50aXR5LCBub3QgbXV0YXRpb24gaW5wdXQuIEFcblx0XHQgKiByZXRyeSBpbnZva2VzIG9ubHkgdGhpcyByZWFkYmFjayBjYWxsYmFjayBhbmQgY2FuIG5ldmVyIHJlc2VuZCBBcHBseS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVmcmVzaF9hZnRlcl9hcHBseSgpIHtcblx0XHRcdHZhciByZWZyZXNoX3Jlc3VsdDtcblxuXHRcdFx0aWYgKCAhIHBlbmRpbmdfYXBwbHlfcmVzdWx0IHx8ICdyZWZyZXNoX3BlbmRpbmcnID09PSBpbnRlcmFjdGlvbl9zdGF0ZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aW50ZXJhY3Rpb25fc3RhdGUgPSAncmVmcmVzaF9wZW5kaW5nJztcblx0XHRcdHJlbmRlcl9yZXZpZXcoIHtcblx0XHRcdFx0c3RhdGU6ICdidXN5Jyxcblx0XHRcdFx0dGl0bGU6IGkxOG4ucmV2aWV3X3RpdGxlIHx8ICcnLFxuXHRcdFx0XHRtZXNzYWdlOiBpMThuLnJlZnJlc2hpbmcgfHwgJycsXG5cdFx0XHRcdGNhbl9jYW5jZWw6IGZhbHNlLFxuXHRcdFx0XHRjYW5jZWxfbGFiZWw6IGkxOG4uY2FuY2VsIHx8ICcnXG5cdFx0XHR9ICk7XG5cdFx0XHRhdHRhY2hfcmV2aWV3X3Bvc2l0aW9uaW5nKCk7XG5cblx0XHRcdGlmICggISBjYWxsYmFja3MgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIGNhbGxiYWNrcy5yZWZyZXNoX2FmdGVyX2FwcGx5ICkge1xuXHRcdFx0XHRpbnRlcmFjdGlvbl9zdGF0ZSA9ICdyZWZyZXNoX2Vycm9yJztcblx0XHRcdFx0cmVuZGVyX3Jldmlldygge1xuXHRcdFx0XHRcdHN0YXRlOiAncmVmcmVzaF9lcnJvcicsXG5cdFx0XHRcdFx0dGl0bGU6IGkxOG4ucmV2aWV3X3RpdGxlIHx8ICcnLFxuXHRcdFx0XHRcdG1lc3NhZ2U6IGkxOG4ucmVmcmVzaF9lcnJvciB8fCAnJyxcblx0XHRcdFx0XHRjYW5fY2FuY2VsOiB0cnVlLFxuXHRcdFx0XHRcdGNhbmNlbF9sYWJlbDogaTE4bi5jbG9zZSB8fCBpMThuLmNhbmNlbCB8fCAnJyxcblx0XHRcdFx0XHRyZXRyeV9yZWZyZXNoX2xhYmVsOiBpMThuLnJldHJ5X3JlZnJlc2ggfHwgJydcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRzaG93X2FkbWluX25vdGljZSggaTE4bi5yZWZyZXNoX2Vycm9yIHx8ICcnLCAnd2FybmluZycsIDEwMDAwICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cmVmcmVzaF9yZXN1bHQgPSBjYWxsYmFja3MucmVmcmVzaF9hZnRlcl9hcHBseSggcGVuZGluZ19hcHBseV9yZXN1bHQgKTtcblx0XHRcdH0gY2F0Y2ggKCByZWZyZXNoX2Vycm9yICkge1xuXHRcdFx0XHRyZWZyZXNoX3Jlc3VsdCA9IHdpbmRvdy5qUXVlcnkuRGVmZXJyZWQoKS5yZWplY3QoIHJlZnJlc2hfZXJyb3IgKS5wcm9taXNlKCk7XG5cdFx0XHR9XG5cdFx0XHR3aW5kb3cualF1ZXJ5LndoZW4oIHJlZnJlc2hfcmVzdWx0ICkuZG9uZSggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRpZiAoIGlzX2Rlc3Ryb3llZCB8fCAhIHBlbmRpbmdfYXBwbHlfcmVzdWx0ICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRmaW5pc2hfYXBwbHlfcmVmcmVzaCgpO1xuXHRcdFx0fSApLmZhaWwoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKCBpc19kZXN0cm95ZWQgfHwgISBwZW5kaW5nX2FwcGx5X3Jlc3VsdCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aW50ZXJhY3Rpb25fc3RhdGUgPSAncmVmcmVzaF9lcnJvcic7XG5cdFx0XHRcdHJlbmRlcl9yZXZpZXcoIHtcblx0XHRcdFx0XHRzdGF0ZTogJ3JlZnJlc2hfZXJyb3InLFxuXHRcdFx0XHRcdHRpdGxlOiBpMThuLnJldmlld190aXRsZSB8fCAnJyxcblx0XHRcdFx0XHRtZXNzYWdlOiBpMThuLnJlZnJlc2hfZXJyb3IgfHwgJycsXG5cdFx0XHRcdFx0Y2FuX2NhbmNlbDogdHJ1ZSxcblx0XHRcdFx0XHRjYW5jZWxfbGFiZWw6IGkxOG4uY2xvc2UgfHwgaTE4bi5jYW5jZWwgfHwgJycsXG5cdFx0XHRcdFx0cmV0cnlfcmVmcmVzaF9sYWJlbDogaTE4bi5yZXRyeV9yZWZyZXNoIHx8ICcnXG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0YXR0YWNoX3Jldmlld19wb3NpdGlvbmluZygpO1xuXHRcdFx0XHRzaG93X2FkbWluX25vdGljZSggaTE4bi5yZWZyZXNoX2Vycm9yIHx8ICcnLCAnd2FybmluZycsIDEwMDAwICk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3VibWl0IGV4YWN0bHkgb25lIG11dGF0aW9uIHJlcXVlc3QgZm9yIHRoZSBjdXJyZW50IHNpZ25lZCBSZXZpZXcuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlcXVlc3RfYXBwbHkoKSB7XG5cdFx0XHR2YXIgYXBwbHlfbWVtb3J5O1xuXHRcdFx0dmFyIGJvb2tpbmdfaWQ7XG5cdFx0XHR2YXIgZ2VuZXJhdGlvbjtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHQncmV2aWV3X3JlYWR5JyAhPT0gaW50ZXJhY3Rpb25fc3RhdGVcblx0XHRcdFx0fHwgYXBwbHlfcmVxdWVzdFxuXHRcdFx0XHR8fCBwZW5kaW5nX2FwcGx5X3Jlc3VsdFxuXHRcdFx0XHR8fCAhIGFjdGl2ZV9zZWxlY3Rpb25cblx0XHRcdFx0fHwgISByZXZpZXdfbWVtb3J5XG5cdFx0XHRcdHx8ICEgcmV2aWV3X21lbW9yeS5wbGFuXG5cdFx0XHRcdHx8ICEgL15bYS1mMC05XXs2NH0kL2kudGVzdCggU3RyaW5nKCByZXZpZXdfbWVtb3J5LnRva2VuIHx8ICcnICkgKVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0YXBwbHlfbWVtb3J5ID0gcmV2aWV3X21lbW9yeTtcblx0XHRcdGJvb2tpbmdfaWQgPSBhY3RpdmVfc2VsZWN0aW9uLmJvb2tpbmdfaWQ7XG5cdFx0XHRhcHBseV9mb2N1c19vcGVyYXRpb24gPSBhY3RpdmVfc2VsZWN0aW9uLnByb3Bvc2FsICYmIC0xICE9PSBvcGVyYXRpb25zLmluZGV4T2YoIGFjdGl2ZV9zZWxlY3Rpb24ucHJvcG9zYWwub3BlcmF0aW9uIClcblx0XHRcdFx0PyBhY3RpdmVfc2VsZWN0aW9uLnByb3Bvc2FsLm9wZXJhdGlvblxuXHRcdFx0XHQ6ICcnO1xuXHRcdFx0aW50ZXJhY3Rpb25fc3RhdGUgPSAnYXBwbHlfcGVuZGluZyc7XG5cdFx0XHRyZW5kZXJfcmV2aWV3KCB7XG5cdFx0XHRcdHN0YXRlOiAnYnVzeScsXG5cdFx0XHRcdHRpdGxlOiBpMThuLnJldmlld190aXRsZSB8fCAnJyxcblx0XHRcdFx0bWVzc2FnZTogaTE4bi5hcHBseWluZyB8fCAnJyxcblx0XHRcdFx0Y2FuX2NhbmNlbDogZmFsc2UsXG5cdFx0XHRcdGNhbmNlbF9sYWJlbDogaTE4bi5jYW5jZWwgfHwgJydcblx0XHRcdH0gKTtcblx0XHRcdGdlbmVyYXRpb24gPSBhcHBseV9nZW5lcmF0aW9uO1xuXHRcdFx0YXBwbHlfcmVxdWVzdCA9IHdpbmRvdy5qUXVlcnkuYWpheCgge1xuXHRcdFx0XHR1cmw6IGFwcGx5X3RyYW5zcG9ydC51cmwsXG5cdFx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0XHRkYXRhVHlwZTogJ2pzb24nLFxuXHRcdFx0XHRkYXRhOiB7XG5cdFx0XHRcdFx0YWN0aW9uOiBhcHBseV90cmFuc3BvcnQuYWN0aW9uLFxuXHRcdFx0XHRcdG5vbmNlOiBhcHBseV90cmFuc3BvcnQubm9uY2UsXG5cdFx0XHRcdFx0Ym9va2luZ19pZDogYm9va2luZ19pZCxcblx0XHRcdFx0XHRzb3VyY2U6IGFwcGx5X3RyYW5zcG9ydC5zb3VyY2UsXG5cdFx0XHRcdFx0c2VuZF9tb2RpZmllZF9lbWFpbDogZ2V0X3NlbmRfbW9kaWZpZWRfZW1haWxfaW50ZW50KCksXG5cdFx0XHRcdFx0cGxhbjogSlNPTi5zdHJpbmdpZnkoIGFwcGx5X21lbW9yeS5wbGFuICksXG5cdFx0XHRcdFx0dG9rZW46IGFwcGx5X21lbW9yeS50b2tlblxuXHRcdFx0XHR9XG5cdFx0XHR9ICkuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdFx0dmFyIHJlc3VsdCA9IHJlc3BvbnNlICYmIHJlc3BvbnNlLnN1Y2Nlc3MgPyByZXNwb25zZS5kYXRhIDogbnVsbDtcblx0XHRcdFx0dmFyIGlkZW50aXR5ID0gcmVzdWx0ICYmIHJlc3VsdC5jYW5vbmljYWxfaWRlbnRpdHkgPyByZXN1bHQuY2Fub25pY2FsX2lkZW50aXR5IDogbnVsbDtcblxuXHRcdFx0XHRpZiAoIGlzX2Rlc3Ryb3llZCB8fCBnZW5lcmF0aW9uICE9PSBhcHBseV9nZW5lcmF0aW9uIHx8ICEgYWN0aXZlX3NlbGVjdGlvbiApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhIHJlc3VsdCB8fCBOdW1iZXIoIHJlc3VsdC5ib29raW5nX2lkIHx8IDAgKSAhPT0gYm9va2luZ19pZCB8fCAhIGlkZW50aXR5IHx8IE51bWJlciggaWRlbnRpdHkuYm9va2luZ19pZCB8fCAwICkgIT09IGJvb2tpbmdfaWQgfHwgISBTdHJpbmcoIGlkZW50aXR5Lm1vZGlmaWNhdGlvbl9kYXRlIHx8ICcnICkgKSB7XG5cdFx0XHRcdFx0cGVuZGluZ19hcHBseV9yZXN1bHQgPSByZXN1bHQgfHwgeyBib29raW5nX2lkOiBib29raW5nX2lkIH07XG5cdFx0XHRcdFx0aW50ZXJhY3Rpb25fc3RhdGUgPSAncmVmcmVzaF9lcnJvcic7XG5cdFx0XHRcdFx0cmVuZGVyX3Jldmlldygge1xuXHRcdFx0XHRcdFx0c3RhdGU6ICdyZWZyZXNoX2Vycm9yJyxcblx0XHRcdFx0XHRcdHRpdGxlOiBpMThuLnJldmlld190aXRsZSB8fCAnJyxcblx0XHRcdFx0XHRcdG1lc3NhZ2U6IGkxOG4ucmVmcmVzaF9lcnJvciB8fCAnJyxcblx0XHRcdFx0XHRcdGNhbl9jYW5jZWw6IHRydWUsXG5cdFx0XHRcdFx0XHRjYW5jZWxfbGFiZWw6IGkxOG4uY2xvc2UgfHwgaTE4bi5jYW5jZWwgfHwgJycsXG5cdFx0XHRcdFx0XHRyZXRyeV9yZWZyZXNoX2xhYmVsOiBpMThuLnJldHJ5X3JlZnJlc2ggfHwgJydcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0c2hvd19hZG1pbl9ub3RpY2UoIGkxOG4ucmVmcmVzaF9lcnJvciB8fCAnJywgJ3dhcm5pbmcnLCAxMDAwMCApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRwZW5kaW5nX2FwcGx5X3Jlc3VsdCA9IHJlc3VsdDtcblx0XHRcdFx0cmV2aWV3X21lbW9yeSA9IG51bGw7XG5cdFx0XHRcdHJlZnJlc2hfYWZ0ZXJfYXBwbHkoKTtcblx0XHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIGZhaWxlZF9yZXF1ZXN0LCByZXF1ZXN0X3N0YXR1cyApIHtcblx0XHRcdFx0dmFyIGVycm9yO1xuXHRcdFx0XHR2YXIgbm90aWNlX3R5cGU7XG5cblx0XHRcdFx0aWYgKCBpc19kZXN0cm95ZWQgfHwgZ2VuZXJhdGlvbiAhPT0gYXBwbHlfZ2VuZXJhdGlvbiB8fCAnYWJvcnQnID09PSByZXF1ZXN0X3N0YXR1cyB8fCAhIGFjdGl2ZV9zZWxlY3Rpb24gKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVycm9yID0gZ2V0X3Jldmlld19lcnJvciggZmFpbGVkX3JlcXVlc3QsIGkxOG4uYXBwbHlfZXJyb3IgfHwgaTE4bi5lcnJvciB8fCAnJyApO1xuXHRcdFx0XHRyZXZpZXdfbWVtb3J5ID0gbnVsbDtcblx0XHRcdFx0cmV2aWV3X2Vycm9yX2Jhc2UgPSBudWxsO1xuXHRcdFx0XHRpbnRlcmFjdGlvbl9zdGF0ZSA9ICdyZXZpZXdfZXJyb3InO1xuXHRcdFx0XHRyZW5kZXJfcmV2aWV3KCB7XG5cdFx0XHRcdFx0c3RhdGU6ICdlcnJvcicsXG5cdFx0XHRcdFx0dGl0bGU6IGkxOG4ucmV2aWV3X3RpdGxlIHx8ICcnLFxuXHRcdFx0XHRcdG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2UsXG5cdFx0XHRcdFx0Y2FuX2NhbmNlbDogdHJ1ZSxcblx0XHRcdFx0XHRjYW5jZWxfbGFiZWw6IGkxOG4uY2FuY2VsIHx8ICcnLFxuXHRcdFx0XHRcdHNob3dfZmFsbGJhY2s6IEJvb2xlYW4oIGNhbGxiYWNrcyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgY2FsbGJhY2tzLm9wZW5fZnVsbF9yZXNjaGVkdWxlICksXG5cdFx0XHRcdFx0ZmFsbGJhY2tfbGFiZWw6IGkxOG4uZnVsbF9kaWFsb2cgfHwgJydcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRub3RpY2VfdHlwZSA9IGdldF9yZXZpZXdfbm90aWNlX3R5cGUoIGZhaWxlZF9yZXF1ZXN0ICk7XG5cdFx0XHRcdHNob3dfYWRtaW5fbm90aWNlKCBlcnJvci5tZXNzYWdlLCBub3RpY2VfdHlwZSwgJ3dhcm5pbmcnID09PSBub3RpY2VfdHlwZSA/IDUwMDAgOiAxMDAwMCApO1xuXHRcdFx0fSApLmFsd2F5cyggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRpZiAoIGdlbmVyYXRpb24gPT09IGFwcGx5X2dlbmVyYXRpb24gKSB7XG5cdFx0XHRcdFx0YXBwbHlfcmVxdWVzdCA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWFkIHRoZSBsaXZlIFRpbWVsaW5lIG5vdGlmaWNhdGlvbiBwcmVmZXJlbmNlIGF0IG11dGF0aW9uIHRpbWUuXG5cdFx0ICpcblx0XHQgKiBSZXZpZXcgaXMgaW50ZW50aW9uYWxseSBub24tbXV0YXRpbmcsIHNvIHRoZSBjdXJyZW50IHRvZ2dsZSB2YWx1ZSBtdXN0IGJlXG5cdFx0ICogcmVhZCBvbmx5IHdoZW4gQXBwbHkgaXMgc3VibWl0dGVkIHJhdGhlciB0aGFuIHN0b3JlZCBpbiB0aGUgc2lnbmVkIHBsYW4uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtudW1iZXJ9IE9uZSB3aGVuIHRoZSBNb2RpZmllZCBlbWFpbCB3YXMgcmVxdWVzdGVkOyBvdGhlcndpc2UgemVyby5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfc2VuZF9tb2RpZmllZF9lbWFpbF9pbnRlbnQoKSB7XG5cdFx0XHR2YXIgZW1haWxfdG9nZ2xlO1xuXG5cdFx0XHRpZiAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgZG9jdW1lbnQgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IgKSB7XG5cdFx0XHRcdHJldHVybiAwO1xuXHRcdFx0fVxuXHRcdFx0ZW1haWxfdG9nZ2xlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2VuZC1tb2RpZmllZC1lbWFpbF0nICk7XG5cblx0XHRcdHJldHVybiBlbWFpbF90b2dnbGUgJiYgZW1haWxfdG9nZ2xlLmNoZWNrZWQgPyAxIDogMDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBGaW5kIGFuIGFmZmVjdGVkIGludGVydmFsIGludGVyc2VjdGluZyBvbmUgdmlzaWJsZSBzZWdtZW50LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJlY29yZCBSZWdpc3RlcmVkIHNlZ21lbnQuXG5cdFx0ICogQHBhcmFtIHtBcnJheTxPYmplY3Q+fSBpbnRlcnZhbHMgSW1tdXRhYmxlIGludGVydmFscy5cblx0XHQgKiBAcmV0dXJuIHtudW1iZXJ9IE1hdGNoaW5nIGluZGV4IG9yIC0xLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGFmZmVjdGVkX2ludGVydmFsX2luZGV4KCByZWNvcmQsIGludGVydmFscyApIHtcblx0XHRcdHZhciBtYXRjaCA9IC0xO1xuXHRcdFx0aW50ZXJ2YWxzLnNvbWUoIGZ1bmN0aW9uICggaW50ZXJ2YWwsIGluZGV4ICkge1xuXHRcdFx0XHRpZiAoIHJlY29yZC52aXNpYmxlX3N0YXJ0X2Vwb2NoIDwgaW50ZXJ2YWwuZW5kX2Vwb2NoICYmIHJlY29yZC52aXNpYmxlX2VuZF9lcG9jaCA+IGludGVydmFsLnN0YXJ0X2Vwb2NoICkge1xuXHRcdFx0XHRcdG1hdGNoID0gaW5kZXg7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSApO1xuXHRcdFx0cmV0dXJuIG1hdGNoO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENyZWF0ZSBhdCBtb3N0IG9uZSB0ZW1wbGF0ZS1vd25lZCBnaG9zdCBwZXIgdmlzaWJsZSBvY2N1cnJlbmNlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjcmVhdGVfZ2hvc3RzKCkge1xuXHRcdFx0dmFyIHJlbmRlcmVyID0gZ2V0X3RlbXBsYXRlKCAnZ2hvc3QnICk7XG5cdFx0XHRpZiAoICEgcmVuZGVyZXIgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNsZWFyX2dob3N0cygpO1xuXHRcdFx0dmlzaWJsZV9zZWdtZW50cy5mb3JFYWNoKCBmdW5jdGlvbiAoIHJlY29yZCApIHtcblx0XHRcdFx0dmFyIGhvc3RzO1xuXHRcdFx0XHR2YXIgaW50ZXJ2YWxfaW5kZXg7XG5cdFx0XHRcdGlmICggcmVjb3JkLmJvb2tpbmdfaWQgIT09IGFjdGl2ZV9zZWxlY3Rpb24uYm9va2luZ19pZCB8fCAhIHJlY29yZC5jYXJkLmlzQ29ubmVjdGVkICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpbnRlcnZhbF9pbmRleCA9IGFmZmVjdGVkX2ludGVydmFsX2luZGV4KCByZWNvcmQsIGFjdGl2ZV9zZWxlY3Rpb24uY29udGV4dC5hZmZlY3RlZF9pbnRlcnZhbHMgKTtcblx0XHRcdFx0aWYgKCAtMSA9PT0gaW50ZXJ2YWxfaW5kZXggKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGhvc3RzID0gZ2V0X2hvc3RzKCByZWNvcmQuY2FyZCApO1xuXHRcdFx0XHRpZiAoICEgaG9zdHMucm9vdCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVjb3JkLmdob3N0X2hvc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKTtcblx0XHRcdFx0cmVjb3JkLmdob3N0X2hvc3QuY2xhc3NOYW1lID0gJ3dwYmNfdGltZWxpbmVfYm9va2luZ19yZXNpemVfX2dob3N0X2hvc3QnO1xuXHRcdFx0XHRyZWNvcmQuZ2hvc3RfaG9zdC5pbm5lckhUTUwgPSByZW5kZXJlciggeyBkdXJhdGlvbl9sYWJlbDogJycgfSApO1xuXHRcdFx0XHRob3N0cy5yb290LmFwcGVuZENoaWxkKCByZWNvcmQuZ2hvc3RfaG9zdCApO1xuXHRcdFx0XHRyZWNvcmQuZ2hvc3QgPSByZWNvcmQuZ2hvc3RfaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLXJlc2l6ZS1naG9zdF0nICk7XG5cdFx0XHRcdHJlY29yZC5naG9zdF9pbnRlcnZhbF9pbmRleCA9IGludGVydmFsX2luZGV4O1xuXHRcdFx0XHRyZWNvcmQuY2FyZC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtYm9va2luZy1yZXNpemluZycsIHRydWUgKTtcblx0XHRcdFx0YWN0aXZlX2dob3N0X3JlY29yZHMucHVzaCggcmVjb3JkICk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRm9ybWF0IGEgbG9jYWxpemVkIHByZXNlbnRhdGlvbi1vbmx5IGR1cmF0aW9uIGluIGNvbXBvdW5kIHVuaXRzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IG1pbGxpc2Vjb25kcyBQb3NpdGl2ZSBkdXJhdGlvbi5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IENvbXBhY3QgZHVyYXRpb24gbGFiZWwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZm9ybWF0X2R1cmF0aW9uKCBtaWxsaXNlY29uZHMgKSB7XG5cdFx0XHR2YXIgdG90YWxfbWludXRlcyA9IE1hdGgubWF4KCAwLCBNYXRoLnJvdW5kKCBtaWxsaXNlY29uZHMgLyA2MDAwMCApICk7XG5cdFx0XHR2YXIgZGF5cyA9IE1hdGguZmxvb3IoIHRvdGFsX21pbnV0ZXMgLyAxNDQwICk7XG5cdFx0XHR2YXIgaG91cnMgPSBNYXRoLmZsb29yKCAoIHRvdGFsX21pbnV0ZXMgJSAxNDQwICkgLyA2MCApO1xuXHRcdFx0dmFyIG1pbnV0ZXMgPSB0b3RhbF9taW51dGVzICUgNjA7XG5cdFx0XHR2YXIgcGFydHMgPSBbXTtcblxuXHRcdFx0aWYgKCBkYXlzICkge1xuXHRcdFx0XHRwYXJ0cy5wdXNoKCBTdHJpbmcoIDEgPT09IGRheXMgPyAoIGkxOG4uZHVyYXRpb25fZGF5IHx8ICclcyBkYXknICkgOiAoIGkxOG4uZHVyYXRpb25fZGF5cyB8fCAnJXMgZGF5cycgKSApLnJlcGxhY2UoICclcycsIGRheXMgKSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBob3VycyApIHtcblx0XHRcdFx0cGFydHMucHVzaCggU3RyaW5nKCAxID09PSBob3VycyA/ICggaTE4bi5kdXJhdGlvbl9ob3VyIHx8ICclcyBob3VyJyApIDogKCBpMThuLmR1cmF0aW9uX2hvdXJzIHx8ICclcyBob3VycycgKSApLnJlcGxhY2UoICclcycsIGhvdXJzICkgKTtcblx0XHRcdH1cblx0XHRcdGlmICggbWludXRlcyB8fCAhIHBhcnRzLmxlbmd0aCApIHtcblx0XHRcdFx0cGFydHMucHVzaCggU3RyaW5nKCAxID09PSBtaW51dGVzID8gKCBpMThuLmR1cmF0aW9uX21pbnV0ZSB8fCAnJXMgbWludXRlJyApIDogKCBpMThuLmR1cmF0aW9uX21pbnV0ZXMgfHwgJyVzIG1pbnV0ZXMnICkgKS5yZXBsYWNlKCAnJXMnLCBtaW51dGVzICkgKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHBhcnRzLmpvaW4oICcgJyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIERldGVybWluZSB3aGV0aGVyIG9uZSBwcm9wb3NhbCBib3VuZGFyeSBkaWZmZXJzIGZyb20gY2Fub25pY2FsIHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQSBjdW11bGF0aXZlIHJlc2l6ZSBjYW4gY29udGFpbiBhbiBlYXJsaWVyIHJldmlld2VkIGNoYW5nZSBvbiB0aGUgYm91bmRhcnlcblx0XHQgKiBvcHBvc2l0ZSB0aGUgY3VycmVudCBnZXN0dXJlLiBHZW9tZXRyeSBtdXN0IHRoZXJlZm9yZSBjb21wYXJlIGJvdGggZXhhY3Rcblx0XHQgKiBwcm9wb3NhbCBpbnN0YW50cyB3aXRoIHRoZSBpbW11dGFibGUgc2VydmVyIGludGVydmFsIGluc3RlYWQgb2YgcmVseWluZyBvblxuXHRcdCAqIHRoZSBjdXJyZW50IGdlc3R1cmUncyBvbmUtYm91bmRhcnkgYXV0aG9yaXphdGlvbiBmbGFncy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fG51bGx9IHByb3Bvc2FsX2ludGVydmFsICBDdXJyZW50IHByZXNlbnRhdGlvbiBpbnRlcnZhbC5cblx0XHQgKiBAcGFyYW0ge09iamVjdHxudWxsfSBjYW5vbmljYWxfaW50ZXJ2YWwgSW1tdXRhYmxlIHNlcnZlciBpbnRlcnZhbC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICBib3VuZGFyeSAgICAgICAgICAgU3RhcnQgb3IgZW5kIGJvdW5kYXJ5IGtleS5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGV4YWN0IGJvdW5kYXJ5IGhhcyBjaGFuZ2VkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhc19wcm9wb3NlZF9ib3VuZGFyeV9jaGFuZ2UoIHByb3Bvc2FsX2ludGVydmFsLCBjYW5vbmljYWxfaW50ZXJ2YWwsIGJvdW5kYXJ5ICkge1xuXHRcdFx0dmFyIGVwb2NoX2tleSA9ICdzdGFydCcgPT09IGJvdW5kYXJ5ID8gJ3N0YXJ0X2Vwb2NoJyA6ICdlbmRfZXBvY2gnO1xuXG5cdFx0XHRyZXR1cm4gQm9vbGVhbihcblx0XHRcdFx0cHJvcG9zYWxfaW50ZXJ2YWwgJiYgY2Fub25pY2FsX2ludGVydmFsXG5cdFx0XHRcdCYmIE51bWJlciggcHJvcG9zYWxfaW50ZXJ2YWxbIGVwb2NoX2tleSBdICkgIT09IE51bWJlciggY2Fub25pY2FsX2ludGVydmFsWyBlcG9jaF9rZXkgXSApXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFByb2plY3QgZHJhZy10aW1lIGhhbmRsZSBoaXQgYXJlYXMgdG8gdGhlIGFjdGl2ZSBwcm9wb3NhbCBib3VuZGFyaWVzLlxuXHRcdCAqXG5cdFx0ICogVGhlIGNhbm9uaWNhbCBib29raW5nIGNhcmQgYW5kIGF1dGhvcml6ZWQgaGFuZGxlIERPTSByZW1haW4gdW5jaGFuZ2VkLlxuXHRcdCAqIFBoeXNpY2FsIHBpeGVsIG9mZnNldHMgYXJlIGRlcml2ZWQgZnJvbSB0aGUgc2FtZSByZWZyZXNoZWQgYXhpcyBzbmFwc2hvdFxuXHRcdCAqIGFzIHRoZSBkYXNoZWQgZ2hvc3QsIHdoaWNoIGtlZXBzIExUUiwgUlRMLCB6b29tLCBhbmQgaG9yaXpvbnRhbCBzY3JvbGxpbmdcblx0XHQgKiBnZW9tZXRyeSBjb25zaXN0ZW50IHdpdGhvdXQgYWRkaW5nIGEgcGVybWFuZW50IHNjcm9sbCBsaXN0ZW5lci5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wb3NhbCBNdXRhYmxlIHByZXNlbnRhdGlvbiBwcm9wb3NhbC5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc25hcHNob3QgTG9hZGVkLWF4aXMgZ2VvbWV0cnkgc25hcHNob3QuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB1cGRhdGVfaGFuZGxlX29mZnNldHMoIHByb3Bvc2FsLCBzbmFwc2hvdCApIHtcblx0XHRcdHZhciBjYXJkID0gYWN0aXZlX3NlbGVjdGlvbiAmJiBhY3RpdmVfc2VsZWN0aW9uLmNhcmQgPyBhY3RpdmVfc2VsZWN0aW9uLmNhcmQgOiBudWxsO1xuXHRcdFx0dmFyIGNvbnRleHQgPSBhY3RpdmVfc2VsZWN0aW9uID8gYWN0aXZlX3NlbGVjdGlvbi5jb250ZXh0IDogbnVsbDtcblx0XHRcdHZhciBpbnRlcnZhbCA9IGNvbnRleHQgJiYgcHJvcG9zYWwuaW50ZXJ2YWxzID8gcHJvcG9zYWwuaW50ZXJ2YWxzWyBjb250ZXh0LmFuY2hvcl9pbnRlcnZhbF9pbmRleCBdIDogbnVsbDtcblx0XHRcdHZhciBjYW5vbmljYWxfaW50ZXJ2YWwgPSBjb250ZXh0ICYmIGNvbnRleHQuYWZmZWN0ZWRfaW50ZXJ2YWxzID8gY29udGV4dC5hZmZlY3RlZF9pbnRlcnZhbHNbIGNvbnRleHQuYW5jaG9yX2ludGVydmFsX2luZGV4IF0gOiBudWxsO1xuXHRcdFx0dmFyIGNhcmRfcmVjdGFuZ2xlO1xuXHRcdFx0dmFyIHZpc3VhbF9zdGFydF94O1xuXHRcdFx0dmFyIHZpc3VhbF9lbmRfeDtcblx0XHRcdHZhciBwcm9wb3NlZF9zdGFydF94O1xuXHRcdFx0dmFyIHByb3Bvc2VkX2VuZF94O1xuXHRcdFx0dmFyIHN0YXJ0X29mZnNldDtcblx0XHRcdHZhciBlbmRfb2Zmc2V0O1xuXG5cdFx0XHRpZiAoICEgY2FyZCB8fCAhIGNhcmQuc3R5bGUgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIGNhcmQuc3R5bGUuc2V0UHJvcGVydHkgfHwgISBpbnRlcnZhbCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y2FyZF9yZWN0YW5nbGUgPSBjYXJkLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0dmlzdWFsX3N0YXJ0X3ggPSBzbmFwc2hvdC5pc19ydGwgPyBjYXJkX3JlY3RhbmdsZS5yaWdodCA6IGNhcmRfcmVjdGFuZ2xlLmxlZnQ7XG5cdFx0XHR2aXN1YWxfZW5kX3ggPSBzbmFwc2hvdC5pc19ydGwgPyBjYXJkX3JlY3RhbmdsZS5sZWZ0IDogY2FyZF9yZWN0YW5nbGUucmlnaHQ7XG5cdFx0XHRwcm9wb3NlZF9zdGFydF94ID0gaGFzX3Byb3Bvc2VkX2JvdW5kYXJ5X2NoYW5nZSggaW50ZXJ2YWwsIGNhbm9uaWNhbF9pbnRlcnZhbCwgJ3N0YXJ0JyApID8gZXBvY2hfdG9feCggc25hcHNob3QsIGludGVydmFsLnN0YXJ0X2Vwb2NoICkgOiB2aXN1YWxfc3RhcnRfeDtcblx0XHRcdHByb3Bvc2VkX2VuZF94ID0gaGFzX3Byb3Bvc2VkX2JvdW5kYXJ5X2NoYW5nZSggaW50ZXJ2YWwsIGNhbm9uaWNhbF9pbnRlcnZhbCwgJ2VuZCcgKSA/IGVwb2NoX3RvX3goIHNuYXBzaG90LCBpbnRlcnZhbC5lbmRfZXBvY2ggKSA6IHZpc3VhbF9lbmRfeDtcblx0XHRcdHN0YXJ0X29mZnNldCA9IE1hdGgucm91bmQoICggcHJvcG9zZWRfc3RhcnRfeCAtIHZpc3VhbF9zdGFydF94ICkgKiAxMDAgKSAvIDEwMDtcblx0XHRcdGVuZF9vZmZzZXQgPSBNYXRoLnJvdW5kKCAoIHByb3Bvc2VkX2VuZF94IC0gdmlzdWFsX2VuZF94ICkgKiAxMDAgKSAvIDEwMDtcblx0XHRcdGNhcmQuc3R5bGUuc2V0UHJvcGVydHkoICctLXdwYmMtdGltZWxpbmUtYm9va2luZy1yZXNpemUtc3RhcnQtb2Zmc2V0Jywgc3RhcnRfb2Zmc2V0ICsgJ3B4JyApO1xuXHRcdFx0Y2FyZC5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiYy10aW1lbGluZS1ib29raW5nLXJlc2l6ZS1lbmQtb2Zmc2V0JywgZW5kX29mZnNldCArICdweCcgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBVcGRhdGUgZXhpc3RpbmcgZ2hvc3Qgc3R5bGVzIG9ubHkgd2hlbiBnZW9tZXRyeSBjaGFuZ2VkLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHByb3Bvc2FsIE11dGFibGUgcHJvcG9zYWwuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNuYXBzaG90IEF4aXMgc25hcHNob3QuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB1cGRhdGVfZ2hvc3RzKCBwcm9wb3NhbCwgc25hcHNob3QgKSB7XG5cdFx0XHR1cGRhdGVfaGFuZGxlX29mZnNldHMoIHByb3Bvc2FsLCBzbmFwc2hvdCApO1xuXHRcdFx0YWN0aXZlX2dob3N0X3JlY29yZHMuZm9yRWFjaCggZnVuY3Rpb24gKCByZWNvcmQgKSB7XG5cdFx0XHRcdHZhciBpbnRlcnZhbDtcblx0XHRcdFx0dmFyIGNhbm9uaWNhbF9pbnRlcnZhbDtcblx0XHRcdFx0dmFyIGNhcmRfcmVjdGFuZ2xlO1xuXHRcdFx0XHR2YXIgc3RhcnRfeDtcblx0XHRcdFx0dmFyIGVuZF94O1xuXHRcdFx0XHR2YXIgbGVmdDtcblx0XHRcdFx0dmFyIHdpZHRoO1xuXHRcdFx0XHR2YXIgZHVyYXRpb247XG5cdFx0XHRcdHZhciBrZXk7XG5cdFx0XHRcdGlmICggISByZWNvcmQuZ2hvc3QgfHwgLTEgPT09IHJlY29yZC5naG9zdF9pbnRlcnZhbF9pbmRleCB8fCAhIHByb3Bvc2FsLmludGVydmFsc1sgcmVjb3JkLmdob3N0X2ludGVydmFsX2luZGV4IF0gKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGludGVydmFsID0gcHJvcG9zYWwuaW50ZXJ2YWxzWyByZWNvcmQuZ2hvc3RfaW50ZXJ2YWxfaW5kZXggXTtcblx0XHRcdFx0Y2Fub25pY2FsX2ludGVydmFsID0gYWN0aXZlX3NlbGVjdGlvbi5jb250ZXh0LmFmZmVjdGVkX2ludGVydmFsc1sgcmVjb3JkLmdob3N0X2ludGVydmFsX2luZGV4IF07XG5cdFx0XHRcdGNhcmRfcmVjdGFuZ2xlID0gcmVjb3JkLmNhcmQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRcdHN0YXJ0X3ggPSBoYXNfcHJvcG9zZWRfYm91bmRhcnlfY2hhbmdlKCBpbnRlcnZhbCwgY2Fub25pY2FsX2ludGVydmFsLCAnc3RhcnQnIClcblx0XHRcdFx0XHQ/IGVwb2NoX3RvX3goIHNuYXBzaG90LCBpbnRlcnZhbC5zdGFydF9lcG9jaCApXG5cdFx0XHRcdFx0OiAoIHNuYXBzaG90LmlzX3J0bCA/IGNhcmRfcmVjdGFuZ2xlLnJpZ2h0IDogY2FyZF9yZWN0YW5nbGUubGVmdCApO1xuXHRcdFx0XHRlbmRfeCA9IGhhc19wcm9wb3NlZF9ib3VuZGFyeV9jaGFuZ2UoIGludGVydmFsLCBjYW5vbmljYWxfaW50ZXJ2YWwsICdlbmQnIClcblx0XHRcdFx0XHQ/IGVwb2NoX3RvX3goIHNuYXBzaG90LCBpbnRlcnZhbC5lbmRfZXBvY2ggKVxuXHRcdFx0XHRcdDogKCBzbmFwc2hvdC5pc19ydGwgPyBjYXJkX3JlY3RhbmdsZS5sZWZ0IDogY2FyZF9yZWN0YW5nbGUucmlnaHQgKTtcblx0XHRcdFx0bGVmdCA9IE1hdGgubWluKCBzdGFydF94LCBlbmRfeCApIC0gY2FyZF9yZWN0YW5nbGUubGVmdDtcblx0XHRcdFx0d2lkdGggPSBNYXRoLm1heCggMiwgTWF0aC5hYnMoIGVuZF94IC0gc3RhcnRfeCApICk7XG5cdFx0XHRcdGR1cmF0aW9uID0gZm9ybWF0X2R1cmF0aW9uKCBpbnRlcnZhbC5lbmRfZXBvY2ggLSBpbnRlcnZhbC5zdGFydF9lcG9jaCApO1xuXHRcdFx0XHRrZXkgPSBbIE1hdGgucm91bmQoIGxlZnQgKiAxMDAgKSAvIDEwMCwgTWF0aC5yb3VuZCggd2lkdGggKiAxMDAgKSAvIDEwMCwgZHVyYXRpb24gXS5qb2luKCAnfCcgKTtcblx0XHRcdFx0aWYgKCBrZXkgPT09IHJlY29yZC5naG9zdF9nZW9tZXRyeV9rZXkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlY29yZC5naG9zdC5zdHlsZS5sZWZ0ID0gbGVmdCArICdweCc7XG5cdFx0XHRcdHJlY29yZC5naG9zdC5zdHlsZS50b3AgPSAnMCc7XG5cdFx0XHRcdHJlY29yZC5naG9zdC5zdHlsZS53aWR0aCA9IHdpZHRoICsgJ3B4Jztcblx0XHRcdFx0cmVjb3JkLmdob3N0LnN0eWxlLmhlaWdodCA9IE1hdGgubWF4KCA0NCwgY2FyZF9yZWN0YW5nbGUuaGVpZ2h0ICkgKyAncHgnO1xuXHRcdFx0XHRpZiAoIHJlY29yZC5naG9zdC5maXJzdEVsZW1lbnRDaGlsZCApIHtcblx0XHRcdFx0XHRyZWNvcmQuZ2hvc3QuZmlyc3RFbGVtZW50Q2hpbGQudGV4dENvbnRlbnQgPSBkdXJhdGlvbjtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZWNvcmQuZ2hvc3RfZ2VvbWV0cnlfa2V5ID0ga2V5O1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNjaGVkdWxlIGF0IG1vc3Qgb25lIHBvaW50ZXIgb3Igc2Nyb2xsIGdlb21ldHJ5IGZyYW1lLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzY2hlZHVsZV9wcmV2aWV3KCkge1xuXHRcdFx0aWYgKCAhIHByZXZpZXdfZnJhbWUgJiYgcG9pbnRlcl9nZXN0dXJlICYmICdkcmFnZ2luZycgPT09IGludGVyYWN0aW9uX3N0YXRlICkge1xuXHRcdFx0XHRwcmV2aWV3X2ZyYW1lID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggdXBkYXRlX3ByZXZpZXcgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBdXRvLXNjcm9sbCBvbmx5IHdpdGhpbiB0aGUgYWxyZWFkeS1sb2FkZWQgVGltZWxpbmUgYXhpcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBnZXN0dXJlIEFjdGl2ZSBwb2ludGVyIGdlc3R1cmUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBhdXRvX3Njcm9sbF9sb2FkZWRfYXhpcyggZ2VzdHVyZSApIHtcblx0XHRcdHZhciByZWN0YW5nbGUgPSBnZXN0dXJlLmF4aXMuY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0dmFyIGZpcnN0X3JlY3RhbmdsZSA9IGdlc3R1cmUuYXhpcy5jZWxsc1swXS5yZWN0YW5nbGU7XG5cdFx0XHR2YXIgbGFzdF9yZWN0YW5nbGUgPSBnZXN0dXJlLmF4aXMuY2VsbHNbZ2VzdHVyZS5heGlzLmNlbGxzLmxlbmd0aCAtIDFdLnJlY3RhbmdsZTtcblx0XHRcdHZhciBsb2FkZWRfbGVmdCA9IE1hdGgubWluKCBmaXJzdF9yZWN0YW5nbGUubGVmdCwgbGFzdF9yZWN0YW5nbGUubGVmdCApO1xuXHRcdFx0dmFyIGxvYWRlZF9yaWdodCA9IE1hdGgubWF4KCBmaXJzdF9yZWN0YW5nbGUucmlnaHQsIGxhc3RfcmVjdGFuZ2xlLnJpZ2h0ICk7XG5cdFx0XHR2YXIgZGlzdGFuY2UgPSAwO1xuXHRcdFx0aWYgKCBnZXN0dXJlLmNsaWVudF94IDwgcmVjdGFuZ2xlLmxlZnQgKyBhdXRvX3Njcm9sbF9lZGdlICYmIGxvYWRlZF9sZWZ0IDwgcmVjdGFuZ2xlLmxlZnQgLSAwLjUgKSB7XG5cdFx0XHRcdGRpc3RhbmNlID0gLWF1dG9fc2Nyb2xsX3N0ZXAgKiAoIDEgLSBNYXRoLm1heCggMCwgZ2VzdHVyZS5jbGllbnRfeCAtIHJlY3RhbmdsZS5sZWZ0ICkgLyBhdXRvX3Njcm9sbF9lZGdlICk7XG5cdFx0XHR9IGVsc2UgaWYgKCBnZXN0dXJlLmNsaWVudF94ID4gcmVjdGFuZ2xlLnJpZ2h0IC0gYXV0b19zY3JvbGxfZWRnZSAmJiBsb2FkZWRfcmlnaHQgPiByZWN0YW5nbGUucmlnaHQgKyAwLjUgKSB7XG5cdFx0XHRcdGRpc3RhbmNlID0gYXV0b19zY3JvbGxfc3RlcCAqICggMSAtIE1hdGgubWF4KCAwLCByZWN0YW5nbGUucmlnaHQgLSBnZXN0dXJlLmNsaWVudF94ICkgLyBhdXRvX3Njcm9sbF9lZGdlICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgZGlzdGFuY2UgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggZ2VzdHVyZS5heGlzLmlzX3J0bCApIHtcblx0XHRcdFx0ZGlzdGFuY2UgKj0gLTE7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiBnZXN0dXJlLmF4aXMuY2FudmFzLnNjcm9sbEJ5ICkge1xuXHRcdFx0XHRnZXN0dXJlLmF4aXMuY2FudmFzLnNjcm9sbEJ5KCB7IGxlZnQ6IGRpc3RhbmNlLCB0b3A6IDAsIGJlaGF2aW9yOiAnYXV0bycgfSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Z2VzdHVyZS5heGlzLmNhbnZhcy5zY3JvbGxMZWZ0ICs9IGRpc3RhbmNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFByb2plY3QgdGhlIGxhdGVzdCBwb2ludGVyIGludG8gbG9jYWwgcHJvcG9zYWwgcHJlc2VudGF0aW9uLlxuXHRcdCAqXG5cdFx0ICogRHJhZyBmcmFtZXMgZm9sbG93IHRoZSBtaW51dGUtbGV2ZWwgcG9pbnRlciBjb29yZGluYXRlIGNvbnRpbnVvdXNseS4gRmluYWxcblx0XHQgKiBwb2ludGVyIHJlbGVhc2UgYXBwbGllcyB0aGUgY29uZmlndXJlZCBUaW1lbGluZS1zdGVwIHNuYXAgZXhjZXB0IGZvciBhXG5cdFx0ICogc2VtYW50aWMgZGF5IHRpbWUtc2xvdCBjYXJkLCB3aG9zZSB2aXNpYmxlIGVkZ2UgaXMgbm90IGl0cyBzYXZlZCBib3VuZGFyeS5cblx0XHQgKiBUaGlzIGtlZXBzIG1vdmVtZW50IHJlc3BvbnNpdmUgd2hpbGUgcmV0YWluaW5nIGRldGVybWluaXN0aWMgYm91bmRhcmllcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gc25hcF9mb3JfcmVsZWFzZSBXaGV0aGVyIHRoaXMgaXMgdGhlIGZpbmFsIHJlbGVhc2UgcHJvamVjdGlvbi5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHByb2plY3RfcHJldmlldyggc25hcF9mb3JfcmVsZWFzZSApIHtcblx0XHRcdHZhciBnZXN0dXJlID0gcG9pbnRlcl9nZXN0dXJlO1xuXHRcdFx0dmFyIGNhbmRpZGF0ZV9lcG9jaDtcblx0XHRcdHZhciBpc19mdWxsX2RheTtcblx0XHRcdHZhciBwcm9wb3NhbDtcblx0XHRcdHByZXZpZXdfZnJhbWUgPSAwO1xuXHRcdFx0aWYgKCAhIGdlc3R1cmUgfHwgJ2RyYWdnaW5nJyAhPT0gaW50ZXJhY3Rpb25fc3RhdGUgfHwgZ2VzdHVyZS5nZW5lcmF0aW9uICE9PSBwcmVzZW50YXRpb25fZ2VuZXJhdGlvbiApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cmVmcmVzaF9heGlzX3JlY3RhbmdsZXMoIGdlc3R1cmUuYXhpcyApO1xuXHRcdFx0YXV0b19zY3JvbGxfbG9hZGVkX2F4aXMoIGdlc3R1cmUgKTtcblx0XHRcdGlzX2Z1bGxfZGF5ID0gLTEgIT09IGZ1bGxfZGF5X3NoYXBlcy5pbmRleE9mKCBhY3RpdmVfc2VsZWN0aW9uLmNvbnRleHQuc2F2ZWRfc2hhcGUgKTtcblx0XHRcdGNhbmRpZGF0ZV9lcG9jaCA9IHNuYXBfZm9yX3JlbGVhc2UgJiYgc2hvdWxkX3NuYXBfcmVsZWFzZV90b190aW1lbGluZV9zdGVwKCBnZXN0dXJlIClcblx0XHRcdFx0PyBwb2ludGVyX3RvX3N0ZXBfZXBvY2goIGdlc3R1cmUuYXhpcywgZ2VzdHVyZS5jbGllbnRfeCwgZ2VzdHVyZSApXG5cdFx0XHRcdDogKCBnZXN0dXJlLnVzZXNfdmlzdWFsX2JvdW5kYXJ5X2hhbmRsZVxuXHRcdFx0XHRcdD8gcG9pbnRlcl9kZWx0YV90b19lcG9jaCggZ2VzdHVyZS5heGlzLCBnZXN0dXJlLmNsaWVudF94LCBnZXN0dXJlIClcblx0XHRcdFx0XHQ6IHBvaW50ZXJfdG9fZXBvY2goXG5cdFx0XHRcdFx0XHRnZXN0dXJlLmF4aXMsXG5cdFx0XHRcdFx0XHRnZXN0dXJlLmNsaWVudF94LFxuXHRcdFx0XHRcdFx0Z2VzdHVyZS5vcGVyYXRpb24sXG5cdFx0XHRcdFx0XHRzbmFwX2Zvcl9yZWxlYXNlICYmIGlzX2Z1bGxfZGF5XG5cdFx0XHRcdFx0KSApO1xuXHRcdFx0cHJvcG9zYWwgPSBjcmVhdGVfcHJvcG9zYWwoIGdlc3R1cmUsIGNhbmRpZGF0ZV9lcG9jaCApO1xuXHRcdFx0aWYgKCBhY3RpdmVfc2VsZWN0aW9uLnByb3Bvc2FsICYmIGFjdGl2ZV9zZWxlY3Rpb24ucHJvcG9zYWwuc2lnbmF0dXJlID09PSBwcm9wb3NhbC5zaWduYXR1cmUgJiYgISBnZXN0dXJlLmRpZF9zY3JvbGwgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGdlc3R1cmUuZGlkX3Njcm9sbCA9IGZhbHNlO1xuXHRcdFx0YWN0aXZlX3NlbGVjdGlvbi5wcm9wb3NhbCA9IHByb3Bvc2FsO1xuXHRcdFx0dXBkYXRlX2dob3N0cyggcHJvcG9zYWwsIGdlc3R1cmUuYXhpcyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlY2FsY3VsYXRlIGEgY29udGludW91cyBkcmFnIHByZXZpZXcgZnJvbSB0aGUgbGF0ZXN0IHBvaW50ZXIgcG9zaXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHVwZGF0ZV9wcmV2aWV3KCkge1xuXHRcdFx0cHJvamVjdF9wcmV2aWV3KCBmYWxzZSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlY2FsY3VsYXRlIGFuZCBzbmFwIHRoZSBmaW5hbCBwcm9wb3NhbCBpbW1lZGlhdGVseSBiZWZvcmUgUmV2aWV3LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBmaW5hbGl6ZV9wcmV2aWV3KCkge1xuXHRcdFx0cHJvamVjdF9wcmV2aWV3KCB0cnVlICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRGV0ZXJtaW5lIHdoZXRoZXIgdGhlIGZpbmFsIHNuYXBwZWQgcHJvcG9zYWwgY2hhbmdlZCBpdHMgcmVxdWVzdGVkIGJvdW5kYXJ5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R8bnVsbH0gcHJvcG9zYWwgICAgICAgRmluYWwgbG9jYWwgcHJvcG9zYWwuXG5cdFx0ICogQHBhcmFtIHtBcnJheX0gICAgICAgYmFzZV9pbnRlcnZhbHMgSW1tdXRhYmxlIGludGVydmFscyBhdCBnZXN0dXJlIHN0YXJ0LlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBSZXZpZXcgbXVzdCB2YWxpZGF0ZSBhIGNoYW5nZWQgc2NoZWR1bGUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcHJvcG9zYWxfY2hhbmdlc19iYXNlX2JvdW5kYXJ5KCBwcm9wb3NhbCwgYmFzZV9pbnRlcnZhbHMgKSB7XG5cdFx0XHR2YXIgYm91bmRhcnlfa2V5O1xuXHRcdFx0aWYgKCAhIHByb3Bvc2FsIHx8ICEgQXJyYXkuaXNBcnJheSggcHJvcG9zYWwuaW50ZXJ2YWxzICkgfHwgISBBcnJheS5pc0FycmF5KCBiYXNlX2ludGVydmFscyApIHx8IHByb3Bvc2FsLmludGVydmFscy5sZW5ndGggIT09IGJhc2VfaW50ZXJ2YWxzLmxlbmd0aCApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRib3VuZGFyeV9rZXkgPSAncmVzaXplX3N0YXJ0JyA9PT0gcHJvcG9zYWwub3BlcmF0aW9uID8gJ3N0YXJ0X2Vwb2NoJyA6ICdlbmRfZXBvY2gnO1xuXG5cdFx0XHRyZXR1cm4gcHJvcG9zYWwuaW50ZXJ2YWxzLnNvbWUoIGZ1bmN0aW9uICggaW50ZXJ2YWwsIGludGVydmFsX2luZGV4ICkge1xuXHRcdFx0XHRyZXR1cm4gTnVtYmVyKCBpbnRlcnZhbFsgYm91bmRhcnlfa2V5IF0gKSAhPT0gTnVtYmVyKCBiYXNlX2ludGVydmFsc1sgaW50ZXJ2YWxfaW5kZXggXVsgYm91bmRhcnlfa2V5IF0gKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTdGFydCBkcmFnIG93bmVyc2hpcCBhZnRlciB0aGUgdGhyZXNob2xkIGlzIGNyb3NzZWQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGltbXV0YWJsZSBheGlzIHNuYXBzaG90IHdhcyBhY3F1aXJlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBiZWdpbl9kcmFnZ2luZygpIHtcblx0XHRcdHZhciBzbmFwc2hvdDtcblx0XHRcdGlmICggISBwb2ludGVyX2dlc3R1cmUgfHwgISBhY3RpdmVfc2VsZWN0aW9uIHx8ICEgYWN0aXZlX3NlbGVjdGlvbi5jb250ZXh0ICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRzbmFwc2hvdCA9IGNyZWF0ZV9heGlzX3NuYXBzaG90KCBhY3RpdmVfc2VsZWN0aW9uLmNhcmQgKTtcblx0XHRcdGlmICggISBzbmFwc2hvdCB8fCBzbmFwc2hvdC5nZW5lcmF0aW9uICE9PSBwcmVzZW50YXRpb25fZ2VuZXJhdGlvbiApIHtcblx0XHRcdFx0Y2FuY2VsX2ludGVyYWN0aW9uKCB0cnVlLCAnc3RhbGVfYXhpcycgKTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0cG9pbnRlcl9nZXN0dXJlLmF4aXMgPSBzbmFwc2hvdDtcblx0XHRcdHBvaW50ZXJfZ2VzdHVyZS5zdGFydF9heGlzX3VuaXRzID0gcG9pbnRlcl90b19heGlzX3Bvc2l0aW9uKCBzbmFwc2hvdCwgcG9pbnRlcl9nZXN0dXJlLnN0YXJ0X3ggKS51bml0cztcblx0XHRcdGludGVyYWN0aW9uX3N0YXRlID0gJ2RyYWdnaW5nJztcblx0XHRcdGFjdGl2ZV9zZWxlY3Rpb24uY2FyZC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtYm9va2luZy1yZXNpemluZycsIHRydWUgKTtcblx0XHRcdGlmICggY2FsbGJhY2tzICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBjYWxsYmFja3Muc2V0X2F4aXNfd2luZG93X2xvYWRpbmdfbG9ja2VkICkge1xuXHRcdFx0XHRjYWxsYmFja3Muc2V0X2F4aXNfd2luZG93X2xvYWRpbmdfbG9ja2VkKCB0cnVlICk7XG5cdFx0XHR9XG5cdFx0XHR0cmFuc2llbnRfc2Nyb2xsX2NhbnZhcyA9IHNuYXBzaG90LmNhbnZhcztcblx0XHRcdHRyYW5zaWVudF9zY3JvbGxfY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoICdzY3JvbGwnLCBoYW5kbGVfcmVzaXplX3Njcm9sbCwgeyBwYXNzaXZlOiB0cnVlIH0gKTtcblx0XHRcdGNyZWF0ZV9naG9zdHMoKTtcblx0XHRcdHNldF9kcmFnZ2luZ19wcmVzZW50YXRpb24oIHRydWUgKTtcblx0XHRcdHNjaGVkdWxlX3ByZXZpZXcoKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc29sdmUgYW4gYXV0aG9yaXplZCBoYW5kbGUgZnJvbSBvbmUgZXZlbnQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCBCcm93c2VyIGlucHV0IGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge0hUTUxFbGVtZW50fG51bGx9IEFjdGl2ZSBoYW5kbGUgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfYWN0aXZlX2hhbmRsZSggZXZlbnQgKSB7XG5cdFx0XHR2YXIgaGFuZGxlID0gZXZlbnQudGFyZ2V0ICYmIGV2ZW50LnRhcmdldC5jbG9zZXN0ID8gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXRpbWVsaW5lLWJvb2tpbmctcmVzaXplLWhhbmRsZV0nICkgOiBudWxsO1xuXHRcdFx0dmFyIG9wZXJhdGlvbiA9IGhhbmRsZSA/IFN0cmluZyggaGFuZGxlLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLXJlc2l6ZS1vcGVyYXRpb24nICkgfHwgJycgKSA6ICcnO1xuXHRcdFx0aWYgKCAtMSA9PT0gWyAncmVhZHknLCAncmV2aWV3X3JlYWR5JywgJ3Jldmlld19lcnJvcicgXS5pbmRleE9mKCBpbnRlcmFjdGlvbl9zdGF0ZSApIHx8ICEgaGFuZGxlIHx8ICEgYWN0aXZlX3NlbGVjdGlvbiB8fCAhIGFjdGl2ZV9zZWxlY3Rpb24uY29udGV4dCB8fCAhIGFjdGl2ZV9zZWxlY3Rpb24uY2FyZCB8fCAhIGFjdGl2ZV9zZWxlY3Rpb24uY2FyZC5jb250YWlucyggaGFuZGxlICkgfHwgLTEgPT09IG9wZXJhdGlvbnMuaW5kZXhPZiggb3BlcmF0aW9uICkgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAoICdyZXNpemVfc3RhcnQnID09PSBvcGVyYXRpb24gJiYgISBhY3RpdmVfc2VsZWN0aW9uLmNvbnRleHQuYm91bmRhcmllcy5zdGFydCApIHx8ICggJ3Jlc2l6ZV9lbmQnID09PSBvcGVyYXRpb24gJiYgISBhY3RpdmVfc2VsZWN0aW9uLmNvbnRleHQuYm91bmRhcmllcy5lbmQgKSApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gaGFuZGxlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEVudGVyIHBvaW50ZXItY2FuZGlkYXRlIHN0YXRlIHRocm91Z2ggZGVsZWdhdGVkIHBvaW50ZXIgaW5wdXQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge1BvaW50ZXJFdmVudH0gZXZlbnQgUG9pbnRlci1kb3duIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX3BvaW50ZXJfZG93biggZXZlbnQgKSB7XG5cdFx0XHR2YXIgaGFuZGxlID0gZ2V0X2FjdGl2ZV9oYW5kbGUoIGV2ZW50ICk7XG5cdFx0XHR2YXIgb3BlcmF0aW9uO1xuXHRcdFx0dmFyIGJhc2VfaW50ZXJ2YWxzO1xuXHRcdFx0dmFyIGNvbnRpbnVhdGlvbl9zdGF0ZTtcblx0XHRcdHZhciBjb3JyZWN0c19yZXZpZXdfZXJyb3I7XG5cdFx0XHR2YXIgY29udGludWVzX3Jldmlldztcblx0XHRcdGlmICggISBoYW5kbGUgfHwgcG9pbnRlcl9nZXN0dXJlIHx8ICggJ21vdXNlJyA9PT0gZXZlbnQucG9pbnRlclR5cGUgJiYgMCAhPT0gZXZlbnQuYnV0dG9uICkgfHwgZmFsc2UgPT09IGV2ZW50LmlzUHJpbWFyeSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0b3BlcmF0aW9uID0gU3RyaW5nKCBoYW5kbGUuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLWJvb2tpbmctcmVzaXplLW9wZXJhdGlvbicgKSApO1xuXHRcdFx0Y29udGludWVzX3JldmlldyA9ICdyZXZpZXdfcmVhZHknID09PSBpbnRlcmFjdGlvbl9zdGF0ZTtcblx0XHRcdGNvcnJlY3RzX3Jldmlld19lcnJvciA9ICdyZXZpZXdfZXJyb3InID09PSBpbnRlcmFjdGlvbl9zdGF0ZTtcblx0XHRcdGNvbnRpbnVhdGlvbl9zdGF0ZSA9IGNvbnRpbnVlc19yZXZpZXdcblx0XHRcdFx0PyBsZWF2ZV9yZXZpZXdfZm9yX3BvaW50ZXIoIG9wZXJhdGlvbiApXG5cdFx0XHRcdDogKCBjb3JyZWN0c19yZXZpZXdfZXJyb3IgPyBsZWF2ZV9yZXZpZXdfZXJyb3JfZm9yX3BvaW50ZXIoIG9wZXJhdGlvbiApIDogbnVsbCApO1xuXHRcdFx0YmFzZV9pbnRlcnZhbHMgPSBjb250aW51YXRpb25fc3RhdGUgPyBjb250aW51YXRpb25fc3RhdGUuaW50ZXJ2YWxzIDogYWN0aXZlX3NlbGVjdGlvbi5jb250ZXh0LmFmZmVjdGVkX2ludGVydmFscztcblx0XHRcdGlmICggISBjb250aW51ZXNfcmV2aWV3ICYmICEgY29ycmVjdHNfcmV2aWV3X2Vycm9yICkge1xuXHRcdFx0XHRjYW5jZWxfaW50ZXJhY3Rpb24oIGZhbHNlLCAnbmV3X3BvaW50ZXInICk7XG5cdFx0XHR9XG5cdFx0XHRpbnRlcmFjdGlvbl9zdGF0ZSA9ICdwb2ludGVyX2NhbmRpZGF0ZSc7XG5cdFx0XHRwb2ludGVyX2dlc3R1cmUgPSB7XG5cdFx0XHRcdGhhbmRsZTogaGFuZGxlLFxuXHRcdFx0XHRvcGVyYXRpb246IG9wZXJhdGlvbixcblx0XHRcdFx0YmFzZV9pbnRlcnZhbHM6IGJhc2VfaW50ZXJ2YWxzLFxuXHRcdFx0XHRiYXNlX3JldmlldzogY29udGludWF0aW9uX3N0YXRlID8gY29udGludWF0aW9uX3N0YXRlLmJhc2VfcmV2aWV3IDogbnVsbCxcblx0XHRcdFx0cG9pbnRlcl9pZDogZXZlbnQucG9pbnRlcklkLFxuXHRcdFx0XHRwb2ludGVyX3R5cGU6IGV2ZW50LnBvaW50ZXJUeXBlIHx8ICdtb3VzZScsXG5cdFx0XHRcdHN0YXJ0X3g6IGV2ZW50LmNsaWVudFgsXG5cdFx0XHRcdHN0YXJ0X3k6IGV2ZW50LmNsaWVudFksXG5cdFx0XHRcdGNsaWVudF94OiBldmVudC5jbGllbnRYLFxuXHRcdFx0XHRjbGllbnRfeTogZXZlbnQuY2xpZW50WSxcblx0XHRcdFx0Z2VuZXJhdGlvbjogcHJlc2VudGF0aW9uX2dlbmVyYXRpb24sXG5cdFx0XHRcdGF4aXM6IG51bGwsXG5cdFx0XHRcdHVzZXNfdmlzdWFsX2JvdW5kYXJ5X2hhbmRsZTogYWN0aXZlX3NlbGVjdGlvbi5jYXJkLmNsYXNzTGlzdC5jb250YWlucyggJ2lzLWRheS10aW1lLXNsb3QnICksXG5cdFx0XHRcdGRpZF9zY3JvbGw6IGZhbHNlLFxuXHRcdFx0XHRpc19maW5pc2hpbmc6IGZhbHNlXG5cdFx0XHR9O1xuXHRcdFx0aGFuZGxlLmFkZEV2ZW50TGlzdGVuZXIoICdwb2ludGVybW92ZScsIGhhbmRsZV9wb2ludGVyX21vdmUgKTtcblx0XHRcdGhhbmRsZS5hZGRFdmVudExpc3RlbmVyKCAncG9pbnRlcnVwJywgaGFuZGxlX3BvaW50ZXJfdXAgKTtcblx0XHRcdGhhbmRsZS5hZGRFdmVudExpc3RlbmVyKCAncG9pbnRlcmNhbmNlbCcsIGhhbmRsZV9wb2ludGVyX2NhbmNlbCApO1xuXHRcdFx0aGFuZGxlLmFkZEV2ZW50TGlzdGVuZXIoICdsb3N0cG9pbnRlcmNhcHR1cmUnLCBoYW5kbGVfbG9zdF9wb2ludGVyX2NhcHR1cmUgKTtcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgaGFuZGxlX2ludGVyYWN0aW9uX2tleWRvd24sIHRydWUgKTtcblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGhhbmRsZS5zZXRQb2ludGVyQ2FwdHVyZSApIHtcblx0XHRcdFx0aGFuZGxlLnNldFBvaW50ZXJDYXB0dXJlKCBldmVudC5wb2ludGVySWQgKTtcblx0XHRcdH1cblx0XHRcdGlmICggISBjb250aW51ZXNfcmV2aWV3ICYmICEgY29ycmVjdHNfcmV2aWV3X2Vycm9yICYmIGNhbGxiYWNrcyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgY2FsbGJhY2tzLnN1c3BlbmRfb3ZlcnZpZXcgKSB7XG5cdFx0XHRcdGNhbGxiYWNrcy5zdXNwZW5kX292ZXJ2aWV3KCBhY3RpdmVfc2VsZWN0aW9uLmNhcmQgKTtcblx0XHRcdH1cblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFVwZGF0ZSBvbmUgY2FuZGlkYXRlIG9yIGFjdGl2ZSBkcmFnIHBvaW50ZXIuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge1BvaW50ZXJFdmVudH0gZXZlbnQgUG9pbnRlci1tb3ZlIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX3BvaW50ZXJfbW92ZSggZXZlbnQgKSB7XG5cdFx0XHR2YXIgZGVsdGFfeDtcblx0XHRcdHZhciBkZWx0YV95O1xuXHRcdFx0aWYgKCAhIHBvaW50ZXJfZ2VzdHVyZSB8fCBldmVudC5wb2ludGVySWQgIT09IHBvaW50ZXJfZ2VzdHVyZS5wb2ludGVyX2lkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRwb2ludGVyX2dlc3R1cmUuY2xpZW50X3ggPSBldmVudC5jbGllbnRYO1xuXHRcdFx0cG9pbnRlcl9nZXN0dXJlLmNsaWVudF95ID0gZXZlbnQuY2xpZW50WTtcblx0XHRcdGRlbHRhX3ggPSBldmVudC5jbGllbnRYIC0gcG9pbnRlcl9nZXN0dXJlLnN0YXJ0X3g7XG5cdFx0XHRkZWx0YV95ID0gZXZlbnQuY2xpZW50WSAtIHBvaW50ZXJfZ2VzdHVyZS5zdGFydF95O1xuXHRcdFx0aWYgKCAncG9pbnRlcl9jYW5kaWRhdGUnID09PSBpbnRlcmFjdGlvbl9zdGF0ZSApIHtcblx0XHRcdFx0aWYgKCAndG91Y2gnID09PSBwb2ludGVyX2dlc3R1cmUucG9pbnRlcl90eXBlICYmIE1hdGguYWJzKCBkZWx0YV95ICkgPj0gdG91Y2hfdmVydGljYWxfdGhyZXNob2xkICYmIE1hdGguYWJzKCBkZWx0YV95ICkgPiBNYXRoLmFicyggZGVsdGFfeCApICkge1xuXHRcdFx0XHRcdGNhbmNlbF9pbnRlcmFjdGlvbiggZmFsc2UsICd0b3VjaF9zY3JvbGwnICk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggTWF0aC5zcXJ0KCBkZWx0YV94ICogZGVsdGFfeCArIGRlbHRhX3kgKiBkZWx0YV95ICkgPCBkcmFnX3RocmVzaG9sZCB8fCAhIGJlZ2luX2RyYWdnaW5nKCkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdkcmFnZ2luZycgPT09IGludGVyYWN0aW9uX3N0YXRlICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0c2NoZWR1bGVfcHJldmlldygpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEZpbmlzaCBwb2ludGVyIGNhcHR1cmUsIGZyZWV6ZSB0aGUgcHJvcG9zYWwsIGFuZCByZXF1ZXN0IFJldmlldyBvbmNlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtQb2ludGVyRXZlbnR9IGV2ZW50IFBvaW50ZXItdXAgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfcG9pbnRlcl91cCggZXZlbnQgKSB7XG5cdFx0XHR2YXIgZnJvemVuX3Byb3Bvc2FsO1xuXHRcdFx0dmFyIGJhc2VfcmV2aWV3O1xuXHRcdFx0dmFyIGJhc2VfaW50ZXJ2YWxzO1xuXHRcdFx0dmFyIHRpbWV6b25lO1xuXHRcdFx0aWYgKCAhIHBvaW50ZXJfZ2VzdHVyZSB8fCBldmVudC5wb2ludGVySWQgIT09IHBvaW50ZXJfZ2VzdHVyZS5wb2ludGVyX2lkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdkcmFnZ2luZycgIT09IGludGVyYWN0aW9uX3N0YXRlICkge1xuXHRcdFx0XHRjYW5jZWxfaW50ZXJhY3Rpb24oIHRydWUsICdwb2ludGVyX2NsaWNrJyApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRwb2ludGVyX2dlc3R1cmUuY2xpZW50X3ggPSBldmVudC5jbGllbnRYO1xuXHRcdFx0aWYgKCBwcmV2aWV3X2ZyYW1lICkge1xuXHRcdFx0XHR3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUoIHByZXZpZXdfZnJhbWUgKTtcblx0XHRcdFx0cHJldmlld19mcmFtZSA9IDA7XG5cdFx0XHR9XG5cdFx0XHRmaW5hbGl6ZV9wcmV2aWV3KCk7XG5cdFx0XHRiYXNlX3JldmlldyA9IHBvaW50ZXJfZ2VzdHVyZS5iYXNlX3Jldmlldztcblx0XHRcdGJhc2VfaW50ZXJ2YWxzID0gcG9pbnRlcl9nZXN0dXJlLmJhc2VfaW50ZXJ2YWxzO1xuXHRcdFx0aWYgKCAhIHByb3Bvc2FsX2NoYW5nZXNfYmFzZV9ib3VuZGFyeSggYWN0aXZlX3NlbGVjdGlvbi5wcm9wb3NhbCwgYmFzZV9pbnRlcnZhbHMgKSApIHtcblx0XHRcdFx0cmV2aWV3X2ZvY3VzX3RhcmdldCA9IHBvaW50ZXJfZ2VzdHVyZS5oYW5kbGU7XG5cdFx0XHRcdHN1cHByZXNzX2hhbmRsZV9jbGljayA9IHRydWU7XG5cdFx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0c3VwcHJlc3NfaGFuZGxlX2NsaWNrID0gZmFsc2U7XG5cdFx0XHRcdH0sIDAgKTtcblx0XHRcdFx0aWYgKCBiYXNlX3JldmlldyApIHtcblx0XHRcdFx0XHRyZWxlYXNlX3BvaW50ZXJfcmVzb3VyY2VzKCBmYWxzZSApO1xuXHRcdFx0XHRcdGlmICggISByZXN0b3JlX2Jhc2VfcmV2aWV3KCBiYXNlX3JldmlldyApICkge1xuXHRcdFx0XHRcdFx0Y2FuY2VsX2ludGVyYWN0aW9uKCB0cnVlLCAnbm9fY2hhbmdlJyApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjYW5jZWxfaW50ZXJhY3Rpb24oIHRydWUsICdub19jaGFuZ2UnICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRpbWV6b25lID0gcG9pbnRlcl9nZXN0dXJlLmF4aXMgPyBwb2ludGVyX2dlc3R1cmUuYXhpcy50aW1lem9uZSA6ICcnO1xuXHRcdFx0cmV2aWV3X2ZvY3VzX3RhcmdldCA9IHBvaW50ZXJfZ2VzdHVyZS5oYW5kbGU7XG5cdFx0XHRmcm96ZW5fcHJvcG9zYWwgPSBmcmVlemVfcmV2aWV3X3Byb3Bvc2FsKCBhY3RpdmVfc2VsZWN0aW9uLnByb3Bvc2FsLCB0aW1lem9uZSApO1xuXHRcdFx0c3VwcHJlc3NfaGFuZGxlX2NsaWNrID0gdHJ1ZTtcblx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHN1cHByZXNzX2hhbmRsZV9jbGljayA9IGZhbHNlO1xuXHRcdFx0fSwgMCApO1xuXHRcdFx0LyogS2VlcCB0aXRsZSBhbmQgT3ZlcnZpZXcgdG9vbHRpcHMgc3VzcGVuZGVkIHdoaWxlIFJldmlldyBvd25zIGF0dGVudGlvbi4gKi9cblx0XHRcdHJlbGVhc2VfcG9pbnRlcl9yZXNvdXJjZXMoIGZhbHNlICk7XG5cdFx0XHRpZiAoIGZyb3plbl9wcm9wb3NhbCApIHtcblx0XHRcdFx0cmVxdWVzdF9yZXZpZXcoIGZyb3plbl9wcm9wb3NhbCwgYmFzZV9yZXZpZXcgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGludGVyYWN0aW9uX3N0YXRlID0gJ3Jldmlld19lcnJvcic7XG5cdFx0XHRcdHJlbmRlcl9yZXZpZXcoIHtcblx0XHRcdFx0XHRzdGF0ZTogJ2Vycm9yJyxcblx0XHRcdFx0XHR0aXRsZTogaTE4bi5yZXZpZXdfdGl0bGUgfHwgJycsXG5cdFx0XHRcdFx0bWVzc2FnZTogaTE4bi5yZXZpZXdfZXJyb3IgfHwgaTE4bi5lcnJvciB8fCAnJyxcblx0XHRcdFx0XHRjYW5jZWxfbGFiZWw6IGkxOG4uY2FuY2VsIHx8ICcnLFxuXHRcdFx0XHRcdHNob3dfZmFsbGJhY2s6IEJvb2xlYW4oIGNhbGxiYWNrcyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgY2FsbGJhY2tzLm9wZW5fZnVsbF9yZXNjaGVkdWxlICksXG5cdFx0XHRcdFx0ZmFsbGJhY2tfbGFiZWw6IGkxOG4uZnVsbF9kaWFsb2cgfHwgJydcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRhdHRhY2hfcmV2aWV3X3Bvc2l0aW9uaW5nKCk7XG5cdFx0XHRcdHNob3dfYWRtaW5fbm90aWNlKCBpMThuLnJldmlld19lcnJvciB8fCBpMThuLmVycm9yIHx8ICcnLCAnZXJyb3InLCAxMDAwMCApO1xuXHRcdFx0fVxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENhbmNlbCBmcm9tIHRoZSBicm93c2VyIHBvaW50ZXItY2FuY2VsbGF0aW9uIHBhdGguXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge1BvaW50ZXJFdmVudH0gZXZlbnQgUG9pbnRlci1jYW5jZWwgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfcG9pbnRlcl9jYW5jZWwoIGV2ZW50ICkge1xuXHRcdFx0aWYgKCBwb2ludGVyX2dlc3R1cmUgJiYgZXZlbnQucG9pbnRlcklkID09PSBwb2ludGVyX2dlc3R1cmUucG9pbnRlcl9pZCApIHtcblx0XHRcdFx0Y2FuY2VsX2ludGVyYWN0aW9uKCB0cnVlLCAncG9pbnRlcl9jYW5jZWwnICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2FuY2VsIHdoZW4gcG9pbnRlciBjYXB0dXJlIGlzIHVuZXhwZWN0ZWRseSBsb3N0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtQb2ludGVyRXZlbnR9IGV2ZW50IExvc3QtY2FwdHVyZSBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9sb3N0X3BvaW50ZXJfY2FwdHVyZSggZXZlbnQgKSB7XG5cdFx0XHRpZiAoIHBvaW50ZXJfZ2VzdHVyZSAmJiBldmVudC5wb2ludGVySWQgPT09IHBvaW50ZXJfZ2VzdHVyZS5wb2ludGVyX2lkICYmICEgcG9pbnRlcl9nZXN0dXJlLmlzX2ZpbmlzaGluZyApIHtcblx0XHRcdFx0Y2FuY2VsX2ludGVyYWN0aW9uKCB0cnVlLCAnbG9zdF9jYXB0dXJlJyApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENvYWxlc2NlIHRyYW5zaWVudCByZXNpemUgc2Nyb2xsaW5nIGludG8gdGhlIHByZXZpZXcgZnJhbWUuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9yZXNpemVfc2Nyb2xsKCkge1xuXHRcdFx0aWYgKCBwb2ludGVyX2dlc3R1cmUgJiYgJ2RyYWdnaW5nJyA9PT0gaW50ZXJhY3Rpb25fc3RhdGUgKSB7XG5cdFx0XHRcdHBvaW50ZXJfZ2VzdHVyZS5kaWRfc2Nyb2xsID0gdHJ1ZTtcblx0XHRcdFx0c2NoZWR1bGVfcHJldmlldygpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENhbmNlbCBjYW5kaWRhdGUsIGRyYWcsIG9yIGNhbm9uaWNhbCBSZXZpZXcgd2l0aCBFc2NhcGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0tleWJvYXJkRXZlbnR9IGV2ZW50IERvY3VtZW50IGtleSBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9pbnRlcmFjdGlvbl9rZXlkb3duKCBldmVudCApIHtcblx0XHRcdGlmICggJ0VzY2FwZScgPT09IGV2ZW50LmtleSAmJiBpc19pbnRlcmFjdGluZygpICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0Y2FuY2VsX2ludGVyYWN0aW9uKCB0cnVlLCAnZXNjYXBlJyApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbW92ZSBwb2ludGVyLCBmcmFtZSwgc2Nyb2xsLCBPdmVydmlldywgYW5kIGF4aXMtbG9jayByZXNvdXJjZXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IHJlc3VtZV9vdmVydmlldyBXaGV0aGVyIHRoZSBPdmVydmlldyBtYXkgcmVzdW1lLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVsZWFzZV9wb2ludGVyX3Jlc291cmNlcyggcmVzdW1lX292ZXJ2aWV3ICkge1xuXHRcdFx0dmFyIGdlc3R1cmUgPSBwb2ludGVyX2dlc3R1cmU7XG5cdFx0XHRzZXRfZHJhZ2dpbmdfcHJlc2VudGF0aW9uKCBmYWxzZSApO1xuXHRcdFx0aWYgKCBwcmV2aWV3X2ZyYW1lICkge1xuXHRcdFx0XHR3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUoIHByZXZpZXdfZnJhbWUgKTtcblx0XHRcdFx0cHJldmlld19mcmFtZSA9IDA7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRyYW5zaWVudF9zY3JvbGxfY2FudmFzICkge1xuXHRcdFx0XHR0cmFuc2llbnRfc2Nyb2xsX2NhbnZhcy5yZW1vdmVFdmVudExpc3RlbmVyKCAnc2Nyb2xsJywgaGFuZGxlX3Jlc2l6ZV9zY3JvbGwgKTtcblx0XHRcdFx0dHJhbnNpZW50X3Njcm9sbF9jYW52YXMgPSBudWxsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjYWxsYmFja3MgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNhbGxiYWNrcy5zZXRfYXhpc193aW5kb3dfbG9hZGluZ19sb2NrZWQgKSB7XG5cdFx0XHRcdGNhbGxiYWNrcy5zZXRfYXhpc193aW5kb3dfbG9hZGluZ19sb2NrZWQoIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGdlc3R1cmUgJiYgZ2VzdHVyZS5oYW5kbGUgKSB7XG5cdFx0XHRcdGdlc3R1cmUuaXNfZmluaXNoaW5nID0gdHJ1ZTtcblx0XHRcdFx0Z2VzdHVyZS5oYW5kbGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJtb3ZlJywgaGFuZGxlX3BvaW50ZXJfbW92ZSApO1xuXHRcdFx0XHRnZXN0dXJlLmhhbmRsZS5yZW1vdmVFdmVudExpc3RlbmVyKCAncG9pbnRlcnVwJywgaGFuZGxlX3BvaW50ZXJfdXAgKTtcblx0XHRcdFx0Z2VzdHVyZS5oYW5kbGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJjYW5jZWwnLCBoYW5kbGVfcG9pbnRlcl9jYW5jZWwgKTtcblx0XHRcdFx0Z2VzdHVyZS5oYW5kbGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2xvc3Rwb2ludGVyY2FwdHVyZScsIGhhbmRsZV9sb3N0X3BvaW50ZXJfY2FwdHVyZSApO1xuXHRcdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiBnZXN0dXJlLmhhbmRsZS5oYXNQb2ludGVyQ2FwdHVyZSAmJiBnZXN0dXJlLmhhbmRsZS5oYXNQb2ludGVyQ2FwdHVyZSggZ2VzdHVyZS5wb2ludGVyX2lkICkgKSB7XG5cdFx0XHRcdFx0Z2VzdHVyZS5oYW5kbGUucmVsZWFzZVBvaW50ZXJDYXB0dXJlKCBnZXN0dXJlLnBvaW50ZXJfaWQgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cG9pbnRlcl9nZXN0dXJlID0gbnVsbDtcblx0XHRcdGlmICggcmVzdW1lX292ZXJ2aWV3ICYmIGNhbGxiYWNrcyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgY2FsbGJhY2tzLnJlc3VtZV9vdmVydmlldyApIHtcblx0XHRcdFx0Y2FsbGJhY2tzLnJlc3VtZV9vdmVydmlldygpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENhbmNlbCBhbGwgcG9pbnRlci1wcmV2aWV3IHN0YXRlIHdpdGhvdXQgY2hhbmdpbmcgY2Fub25pY2FsIGNhcmRzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSByZXN0b3JlX2ZvY3VzIFdoZXRoZXIgdG8gZm9jdXMgdGhlIG9yaWdpbmF0aW5nIGhhbmRsZS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcmVhc29uIEludGVybmFsIHRlYXJkb3duIHJlYXNvbi5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNhbmNlbF9pbnRlcmFjdGlvbiggcmVzdG9yZV9mb2N1cywgcmVhc29uICkge1xuXHRcdFx0dmFyIGZvY3VzX3RhcmdldCA9IHBvaW50ZXJfZ2VzdHVyZSAmJiBwb2ludGVyX2dlc3R1cmUuaGFuZGxlID8gcG9pbnRlcl9nZXN0dXJlLmhhbmRsZSA6IHJldmlld19mb2N1c190YXJnZXQ7XG5cdFx0XHRpZiAoIC0xICE9PSBbICdhcHBseV9wZW5kaW5nJywgJ3JlZnJlc2hfcGVuZGluZycgXS5pbmRleE9mKCBpbnRlcmFjdGlvbl9zdGF0ZSApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgaXNfaW50ZXJhY3RpbmcoKSAmJiAhICggYWN0aXZlX3NlbGVjdGlvbiAmJiBhY3RpdmVfc2VsZWN0aW9uLnByb3Bvc2FsICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGludGVyYWN0aW9uX3N0YXRlID0gJ2NhbmNlbGxlZCc7XG5cdFx0XHRjbGVhcl9yZXZpZXcoIHRydWUgKTtcblx0XHRcdHJldmlld19lcnJvcl9iYXNlID0gbnVsbDtcblx0XHRcdHBlbmRpbmdfYXBwbHlfcmVzdWx0ID0gbnVsbDtcblx0XHRcdGFwcGx5X2ZvY3VzX29wZXJhdGlvbiA9ICcnO1xuXHRcdFx0cmVsZWFzZV9wb2ludGVyX3Jlc291cmNlcyggdHJ1ZSApO1xuXHRcdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCBoYW5kbGVfaW50ZXJhY3Rpb25fa2V5ZG93biwgdHJ1ZSApO1xuXHRcdFx0Y2xlYXJfZ2hvc3RzKCk7XG5cdFx0XHRpZiAoIGFjdGl2ZV9zZWxlY3Rpb24gKSB7XG5cdFx0XHRcdGNsZWFyX2hhbmRsZV9vZmZzZXRzKCBhY3RpdmVfc2VsZWN0aW9uLmNhcmQgKTtcblx0XHRcdFx0aWYgKCBhY3RpdmVfc2VsZWN0aW9uLmNhcmQgJiYgYWN0aXZlX3NlbGVjdGlvbi5jYXJkLmNsYXNzTGlzdCApIHtcblx0XHRcdFx0XHRhY3RpdmVfc2VsZWN0aW9uLmNhcmQuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWJvb2tpbmctcmVzaXppbmcnLCBmYWxzZSApO1xuXHRcdFx0XHRcdGFjdGl2ZV9zZWxlY3Rpb24uY2FyZC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtYm9va2luZy1yZXNpemUtZHJhZ2dpbmcnLCBmYWxzZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGFjdGl2ZV9zZWxlY3Rpb24ucHJvcG9zYWwgPSBudWxsO1xuXHRcdFx0fVxuXHRcdFx0aW50ZXJhY3Rpb25fc3RhdGUgPSBhY3RpdmVfc2VsZWN0aW9uICYmIGFjdGl2ZV9zZWxlY3Rpb24uY29udGV4dCA/ICdyZWFkeScgOiAnaWRsZSc7XG5cdFx0XHRyZXZpZXdfZm9jdXNfdGFyZ2V0ID0gbnVsbDtcblx0XHRcdGlmICggYWN0aXZlX3NlbGVjdGlvbiApIHtcblx0XHRcdFx0YW5ub3VuY2UoIGFjdGl2ZV9zZWxlY3Rpb24uY2FyZCwgJ2VzY2FwZScgPT09IHJlYXNvbiA/ICggaTE4bi5jYW5jZWxsZWQgfHwgJycgKSA6ICcnICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHJlc3RvcmVfZm9jdXMgJiYgZm9jdXNfdGFyZ2V0ICYmIGZvY3VzX3RhcmdldC5pc0Nvbm5lY3RlZCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgZm9jdXNfdGFyZ2V0LmZvY3VzICkge1xuXHRcdFx0XHRmb2N1c190YXJnZXQuZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBQcmVwYXJlIGZvciBleHBsaWNpdCBUaW1lbGluZSByZXBsYWNlbWVudCB3aXRob3V0IERPTSBvYnNlcnZhdGlvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYmVnaW5fcmVmcmVzaCgpIHtcblx0XHRcdHZhciBwcmVzZXJ2ZXNfYXBwbHlfc3VjY2VzcyA9IHBlbmRpbmdfYXBwbHlfcmVzdWx0ICYmICdyZWZyZXNoX3BlbmRpbmcnID09PSBpbnRlcmFjdGlvbl9zdGF0ZTtcblxuXHRcdFx0cHJlc2VudGF0aW9uX2dlbmVyYXRpb24gKz0gMTtcblx0XHRcdGlmICggISBwcmVzZXJ2ZXNfYXBwbHlfc3VjY2VzcyApIHtcblx0XHRcdFx0Y2FuY2VsX2ludGVyYWN0aW9uKCBmYWxzZSwgJ3dpbmRvd19yZXBsYWNlZCcgKTtcblx0XHRcdFx0aWYgKCBhY3RpdmVfc2VsZWN0aW9uICYmIGFjdGl2ZV9zZWxlY3Rpb24uaXNfZXh0ZXJuYWwgKSB7XG5cdFx0XHRcdFx0cmVzZXRfYWN0aXZlX3NlbGVjdGlvbl9lbGlnaWJpbGl0eSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZWxlYXNlX3BvaW50ZXJfcmVzb3VyY2VzKCBmYWxzZSApO1xuXHRcdFx0XHRjbGVhcl9naG9zdHMoKTtcblx0XHRcdFx0Y2xlYXJfaGFuZGxlX29mZnNldHMoIGFjdGl2ZV9zZWxlY3Rpb24gPyBhY3RpdmVfc2VsZWN0aW9uLmNhcmQgOiBudWxsICk7XG5cdFx0XHRcdHJlc2V0X2FjdGl2ZV9zZWxlY3Rpb25fZWxpZ2liaWxpdHkoKTtcblx0XHRcdH1cblx0XHRcdHZpc2libGVfc2VnbWVudHMgPSBbXTtcblx0XHRcdHNlZ21lbnRfcmVjb3JkcyA9IG5ldyBXZWFrTWFwKCk7XG5cdFx0XHRpZiAoICEgYWN0aXZlX3NlbGVjdGlvbiApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y2xlYXJfY2FyZCggYWN0aXZlX3NlbGVjdGlvbi5jYXJkICk7XG5cdFx0XHRhY3RpdmVfc2VsZWN0aW9uLmNhcmQgPSBudWxsO1xuXHRcdFx0aWYgKCBlbGlnaWJpbGl0eV9yZXF1ZXN0ICkge1xuXHRcdFx0XHRhYm9ydF9yZXF1ZXN0KCk7XG5cdFx0XHRcdGFjdGl2ZV9zZWxlY3Rpb24uc3RhdGUgPSAnaWRsZSc7XG5cdFx0XHRcdGFjdGl2ZV9zZWxlY3Rpb24ucmVxdWVzdF9zdGF0ZSA9ICdpZGxlJztcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWNvbmNpbGUgc2VsZWN0ZWQgaWRlbnRpdHkgYWZ0ZXIgZXhwbGljaXQgVGltZWxpbmUgcmVwbGFjZW1lbnQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc2VsZWN0aW9uX3N0YXRlIFRpbWVsaW5lIHNlbGVjdGlvbiBpZGVudGl0eS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNvbXBsZXRlX3JlZnJlc2goIHNlbGVjdGlvbl9zdGF0ZSApIHtcblx0XHRcdHZhciByZXBsYWNlbWVudF9yZWNvcmQgPSBudWxsO1xuXG5cdFx0XHRpZiAoICEgYWN0aXZlX3NlbGVjdGlvbiB8fCAhIHNlbGVjdGlvbl9zdGF0ZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBOdW1iZXIoIHNlbGVjdGlvbl9zdGF0ZS5ib29raW5nX2lkIHx8IDAgKSAhPT0gYWN0aXZlX3NlbGVjdGlvbi5ib29raW5nX2lkICkge1xuXHRcdFx0XHRjbGVhcl9jYXJkKCBhY3RpdmVfc2VsZWN0aW9uLmNhcmQgKTtcblx0XHRcdFx0YWJvcnRfcmVxdWVzdCgpO1xuXHRcdFx0XHRhY3RpdmVfc2VsZWN0aW9uID0gbnVsbDtcblx0XHRcdFx0aW50ZXJhY3Rpb25fc3RhdGUgPSAnaWRsZSc7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISBhY3RpdmVfc2VsZWN0aW9uLmNhcmQgKSB7XG5cdFx0XHRcdHZpc2libGVfc2VnbWVudHMuc29tZSggZnVuY3Rpb24gKCByZWNvcmQgKSB7XG5cdFx0XHRcdFx0aWYgKCByZWNvcmQuYm9va2luZ19pZCA9PT0gYWN0aXZlX3NlbGVjdGlvbi5ib29raW5nX2lkICYmIHJlY29yZC5zZWdtZW50X2lkID09PSBTdHJpbmcoIHNlbGVjdGlvbl9zdGF0ZS5zZWdtZW50X2hpbnQgfHwgJycgKSApIHtcblx0XHRcdFx0XHRcdHJlcGxhY2VtZW50X3JlY29yZCA9IHJlY29yZDtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0aWYgKCAhIHJlcGxhY2VtZW50X3JlY29yZCApIHtcblx0XHRcdFx0XHR2aXNpYmxlX3NlZ21lbnRzLnNvbWUoIGZ1bmN0aW9uICggcmVjb3JkICkge1xuXHRcdFx0XHRcdFx0aWYgKCByZWNvcmQuYm9va2luZ19pZCA9PT0gYWN0aXZlX3NlbGVjdGlvbi5ib29raW5nX2lkICkge1xuXHRcdFx0XHRcdFx0XHRyZXBsYWNlbWVudF9yZWNvcmQgPSByZWNvcmQ7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHJlcGxhY2VtZW50X3JlY29yZCApIHtcblx0XHRcdFx0XHRhY3RpdmVfc2VsZWN0aW9uLmNhcmQgPSByZXBsYWNlbWVudF9yZWNvcmQuY2FyZDtcblx0XHRcdFx0XHRhY3RpdmVfc2VsZWN0aW9uLnNlZ21lbnRfaWQgPSByZXBsYWNlbWVudF9yZWNvcmQuc2VnbWVudF9pZDtcblx0XHRcdFx0XHRhY3RpdmVfc2VsZWN0aW9uLmtleSA9IHJlcGxhY2VtZW50X3JlY29yZC5rZXk7XG5cdFx0XHRcdFx0YWN0aXZlX3NlbGVjdGlvbi52aXNpYmxlX3N0YXJ0ID0gcmVwbGFjZW1lbnRfcmVjb3JkLnZpc2libGVfc3RhcnQ7XG5cdFx0XHRcdFx0YWN0aXZlX3NlbGVjdGlvbi52aXNpYmxlX2VuZCA9IHJlcGxhY2VtZW50X3JlY29yZC52aXNpYmxlX2VuZDtcblx0XHRcdFx0XHRhY3RpdmVfc2VsZWN0aW9uLnNob3dfc3RhcnQgPSByZXBsYWNlbWVudF9yZWNvcmQuc2hvd19zdGFydDtcblx0XHRcdFx0XHRhY3RpdmVfc2VsZWN0aW9uLnNob3dfZW5kID0gcmVwbGFjZW1lbnRfcmVjb3JkLnNob3dfZW5kO1xuXHRcdFx0XHRcdHJlc2V0X2FjdGl2ZV9zZWxlY3Rpb25fZWxpZ2liaWxpdHkoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIGFjdGl2ZV9zZWxlY3Rpb24uY2FyZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAncmVhZHknID09PSBhY3RpdmVfc2VsZWN0aW9uLnN0YXRlICYmICEgaGFzX2NvbXBsZXRlX2hhbmRsZV92aWV3X21vZGVsKCBhY3RpdmVfc2VsZWN0aW9uLmhhbmRsZXMgKSApIHtcblx0XHRcdFx0cmVzZXRfYWN0aXZlX3NlbGVjdGlvbl9lbGlnaWJpbGl0eSgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnaWRsZScgPT09IGFjdGl2ZV9zZWxlY3Rpb24ucmVxdWVzdF9zdGF0ZSApIHtcblx0XHRcdFx0bG9hZF9lbGlnaWJpbGl0eSgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyZW5kZXJfYWN0aXZlX3N0YXRlKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogT3BlbiBjYW5vbmljYWwgZnVsbCBSZXNjaGVkdWxlIGZyb20ga2V5Ym9hcmQgYWN0aXZhdGlvbiBvbmx5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBldmVudCBLZXlib2FyZCBldmVudC5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGhhbmRsZSBvd25lZCB0aGUgZXZlbnQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYWN0aXZhdGVfaGFuZGxlX2Zyb21fa2V5Ym9hcmQoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGhhbmRsZSA9IGdldF9hY3RpdmVfaGFuZGxlKCBldmVudCApO1xuXHRcdFx0aWYgKCAhIGhhbmRsZSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0aWYgKCBjYWxsYmFja3MgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNhbGxiYWNrcy5vcGVuX2Z1bGxfcmVzY2hlZHVsZSApIHtcblx0XHRcdFx0Y2FsbGJhY2tzLm9wZW5fZnVsbF9yZXNjaGVkdWxlKCBhY3RpdmVfc2VsZWN0aW9uLmNhcmQsIGhhbmRsZSApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29uc3VtZSBoYW5kbGUgY2xpY2tzIHNvIHBvaW50ZXIgaW5wdXQgbmV2ZXIgb3BlbnMgdGhlIGRpYWxvZy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7TW91c2VFdmVudH0gZXZlbnQgVGltZWxpbmUgY2xpY2sgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGEgcmVzaXplIGhhbmRsZSBvd25lZCB0aGUgZXZlbnQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2NsaWNrKCBldmVudCApIHtcblx0XHRcdHZhciBjYW5jZWwgPSBldmVudC50YXJnZXQgJiYgZXZlbnQudGFyZ2V0LmNsb3Nlc3QgPyBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1yZXNpemUtY2FuY2VsXScgKSA6IG51bGw7XG5cdFx0XHR2YXIgZmFsbGJhY2sgPSBldmVudC50YXJnZXQgJiYgZXZlbnQudGFyZ2V0LmNsb3Nlc3QgPyBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1yZXNpemUtZmFsbGJhY2tdJyApIDogbnVsbDtcblx0XHRcdHZhciBhcHBseSA9IGV2ZW50LnRhcmdldCAmJiBldmVudC50YXJnZXQuY2xvc2VzdCA/IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLXJlc2l6ZS1hcHBseV0nICkgOiBudWxsO1xuXHRcdFx0dmFyIHJldHJ5X3JlZnJlc2ggPSBldmVudC50YXJnZXQgJiYgZXZlbnQudGFyZ2V0LmNsb3Nlc3QgPyBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1yZXNpemUtcmV0cnktcmVmcmVzaF0nICkgOiBudWxsO1xuXHRcdFx0dmFyIGhhbmRsZSA9IGV2ZW50LnRhcmdldCAmJiBldmVudC50YXJnZXQuY2xvc2VzdCA/IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLXJlc2l6ZS1oYW5kbGVdJyApIDogbnVsbDtcblx0XHRcdHZhciBjYXJkO1xuXHRcdFx0dmFyIGZvY3VzX3RhcmdldDtcblx0XHRcdGlmICggY2FuY2VsICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0Y2FuY2VsX2ludGVyYWN0aW9uKCB0cnVlLCAncmV2aWV3X2NhbmNlbCcgKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGZhbGxiYWNrICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0Y2FyZCA9IGFjdGl2ZV9zZWxlY3Rpb24gPyBhY3RpdmVfc2VsZWN0aW9uLmNhcmQgOiBudWxsO1xuXHRcdFx0XHRmb2N1c190YXJnZXQgPSByZXZpZXdfZm9jdXNfdGFyZ2V0O1xuXHRcdFx0XHRjYW5jZWxfaW50ZXJhY3Rpb24oIGZhbHNlLCAncmV2aWV3X2ZhbGxiYWNrJyApO1xuXHRcdFx0XHRpZiAoIGNhcmQgJiYgY2FsbGJhY2tzICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBjYWxsYmFja3Mub3Blbl9mdWxsX3Jlc2NoZWR1bGUgKSB7XG5cdFx0XHRcdFx0Y2FsbGJhY2tzLm9wZW5fZnVsbF9yZXNjaGVkdWxlKCBjYXJkLCBmb2N1c190YXJnZXQgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggYXBwbHkgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRyZXF1ZXN0X2FwcGx5KCk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCByZXRyeV9yZWZyZXNoICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0cmVmcmVzaF9hZnRlcl9hcHBseSgpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggISBoYW5kbGUgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdGlmICggc3VwcHJlc3NfaGFuZGxlX2NsaWNrICkge1xuXHRcdFx0XHRzdXBwcmVzc19oYW5kbGVfY2xpY2sgPSBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEhhbmRsZSBFbnRlciBvciBTcGFjZSB3aXRob3V0IGEga2V5Ym9hcmQgcmVzaXplIG1vZGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0tleWJvYXJkRXZlbnR9IGV2ZW50IFRpbWVsaW5lIGtleSBldmVudC5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gYW4gYWN0aXZlIGhhbmRsZSBvd25lZCB0aGUgZXZlbnQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2tleWRvd24oIGV2ZW50ICkge1xuXHRcdFx0aWYgKCBldmVudC5jdHJsS2V5IHx8IGV2ZW50Lm1ldGFLZXkgfHwgZXZlbnQuYWx0S2V5IHx8IGV2ZW50LnNoaWZ0S2V5IHx8IC0xID09PSBbICdFbnRlcicsICcgJyBdLmluZGV4T2YoIGV2ZW50LmtleSApICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYWN0aXZhdGVfaGFuZGxlX2Zyb21fa2V5Ym9hcmQoIGV2ZW50ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVwb3J0IHdoZXRoZXIgcG9pbnRlci1wcmV2aWV3IHN0YXRlIG93bnMgaW50ZXJhY3Rpb24gYXR0ZW50aW9uLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGlsZSBwb2ludGVyIHByZXZpZXcgb3IgUmV2aWV3IG93bnMgYXR0ZW50aW9uLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGlzX2ludGVyYWN0aW5nKCkge1xuXHRcdFx0cmV0dXJuIC0xICE9PSBbICdwb2ludGVyX2NhbmRpZGF0ZScsICdkcmFnZ2luZycsICdyZXZpZXdfcGVuZGluZycsICdyZXZpZXdfcmVhZHknLCAncmV2aWV3X2Vycm9yJywgJ2FwcGx5X3BlbmRpbmcnLCAncmVmcmVzaF9wZW5kaW5nJywgJ3JlZnJlc2hfZXJyb3InIF0uaW5kZXhPZiggaW50ZXJhY3Rpb25fc3RhdGUgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBEZXN0cm95IGFsbCBvd25lZCByZXF1ZXN0cywgbGlzdGVuZXJzLCBmcmFtZXMsIGFuZCBwcmVzZW50YXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG5cdFx0XHRpZiAoIGlzX2Rlc3Ryb3llZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aXNfZGVzdHJveWVkID0gdHJ1ZTtcblx0XHRcdGFwcGx5X2dlbmVyYXRpb24gKz0gMTtcblx0XHRcdG1vdW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdwb2ludGVyZG93bicsIGhhbmRsZV9wb2ludGVyX2Rvd24sIHRydWUgKTtcblx0XHRcdGlmICggLTEgPT09IFsgJ2FwcGx5X3BlbmRpbmcnLCAncmVmcmVzaF9wZW5kaW5nJyBdLmluZGV4T2YoIGludGVyYWN0aW9uX3N0YXRlICkgKSB7XG5cdFx0XHRcdGNhbmNlbF9pbnRlcmFjdGlvbiggZmFsc2UsICdkZXN0cm95ZWQnICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjbGVhcl9yZXZpZXcoIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIGhhbmRsZV9pbnRlcmFjdGlvbl9rZXlkb3duLCB0cnVlICk7XG5cdFx0XHRpZiAoIGFjdGl2ZV9zZWxlY3Rpb24gKSB7XG5cdFx0XHRcdGNsZWFyX2NhcmQoIGFjdGl2ZV9zZWxlY3Rpb24uY2FyZCApO1xuXHRcdFx0fVxuXHRcdFx0Y2xlYXJfZ2hvc3RzKCk7XG5cdFx0XHRhYm9ydF9yZXF1ZXN0KCk7XG5cdFx0XHRhcHBseV9yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdHBlbmRpbmdfYXBwbHlfcmVzdWx0ID0gbnVsbDtcblx0XHRcdGFjdGl2ZV9zZWxlY3Rpb24gPSBudWxsO1xuXHRcdFx0dmlzaWJsZV9zZWdtZW50cyA9IFtdO1xuXHRcdFx0aW50ZXJhY3Rpb25fc3RhdGUgPSAnaWRsZSc7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHNlbGVjdDogc2VsZWN0LFxuXHRcdFx0cmVnaXN0ZXJfc2VnbWVudDogcmVnaXN0ZXJfc2VnbWVudCxcblx0XHRcdGJlZ2luX3JlZnJlc2g6IGJlZ2luX3JlZnJlc2gsXG5cdFx0XHRjb21wbGV0ZV9yZWZyZXNoOiBjb21wbGV0ZV9yZWZyZXNoLFxuXHRcdFx0aGFuZGxlX2NsaWNrOiBoYW5kbGVfY2xpY2ssXG5cdFx0XHRoYW5kbGVfa2V5ZG93bjogaGFuZGxlX2tleWRvd24sXG5cdFx0XHRyZXZpZXdfcmVzaXplX3Byb3Bvc2FsOiByZXZpZXdfcmVzaXplX3Byb3Bvc2FsLFxuXHRcdFx0aXNfaW50ZXJhY3Rpbmc6IGlzX2ludGVyYWN0aW5nLFxuXHRcdFx0ZGVzdHJveTogZGVzdHJveVxuXHRcdH07XG5cdH1cblxuXHR3aW5kb3cud3BiY190aW1lbGluZV9ib29raW5nX3Jlc2l6aW5nID0gd2luZG93LndwYmNfdGltZWxpbmVfYm9va2luZ19yZXNpemluZyB8fCB7fTtcblx0d2luZG93LndwYmNfdGltZWxpbmVfYm9va2luZ19yZXNpemluZy5jcmVhdGVfY29udHJvbGxlciA9IGNyZWF0ZV9jb250cm9sbGVyO1xufSggd2luZG93LCBkb2N1bWVudCApICk7XG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0UsV0FBV0EsTUFBTSxFQUFFQyxRQUFRLEVBQUc7RUFDL0IsWUFBWTs7RUFFWixJQUFJQyxhQUFhLEdBQUcsQ0FBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsYUFBYSxDQUFFO0VBQzlFLElBQUlDLGdCQUFnQixHQUFHLENBQUUsdUJBQXVCLEVBQUUsOEJBQThCLEVBQUUsaUJBQWlCLEVBQUUsMkJBQTJCLEVBQUUsdUJBQXVCLEVBQUUs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
