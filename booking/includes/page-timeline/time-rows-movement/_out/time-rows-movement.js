"use strict";

/**
 * Expanded time-row projected-booking eligibility and movement adapter.
 *
 * The adapter resolves presentation fragments only through accepted canonical
 * segment DTOs supplied by the optimized time-row projection index. It reuses
 * existing authoritative movement and resizing context reads. Pointer and
 * keyboard gestures produce proposals through the shared pure geometry kernel;
 * canonical Review, Apply, and readback remain owned by Booking Rescheduling.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
(function (window, document, wp) {
  'use strict';

  var module_id = 'time_rows_movement';
  var module_instance_id = 'wpbc_timeline_time_rows_movement';
  var exact_instant_pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:Z|[+-]\d{2}:\d{2})$/;
  var timed_surface_selector = '.wpbc_timeline_time_rows__timed_surface';
  var all_day_surface_selector = '.wpbc_timeline_time_rows__all_day_surface';
  var date_column_selector = '[data-wpbc-timeline-time-rows-date]';
  var movement_grip_selector = '[data-wpbc-timeline-time-rows-movement-grip]';
  var resize_handle_selector = '[data-wpbc-timeline-time-rows-resize-handle]';
  var supported_timed_resize_shapes = ['single_timed_interval', 'continuous_boundary_interval', 'recurrent_timed_intervals', 'discontinuous_timed_intervals'];
  var supported_full_day_resize_shapes = ['single_full_day', 'continuous_full_day_range', 'independent_full_days'];
  var time_rows_panel_selector = '[data-wpbc-timeline-time-rows-panel="canvas"]';
  var booking_interaction_callbacks = null;

  /**
   * Normalize one positive integer without accepting presentation strings.
   *
   * @param {*} candidate Candidate scalar.
   * @return {number} Positive integer, or zero.
   */
  function normalize_positive_integer(candidate) {
    candidate = Number(candidate);
    return Number.isInteger(candidate) && 0 < candidate ? candidate : 0;
  }

  /**
   * Build one immutable accepted-identity key including local geometry.
   *
   * @param {Object} context Accepted interaction context from time rows.
   * @param {number} selection_step_minutes Server-owned interaction step.
   * @return {string} Stable identity key, or an empty string.
   */
  function build_accepted_identity_key(context, selection_step_minutes) {
    var identity = context && context.accepted_identity ? context.accepted_identity : {};
    var visible_range = context && context.visible_range ? context.visible_range : {};
    var resource_id = normalize_positive_integer(identity.resource_id);
    var window_keys = Array.isArray(identity.accepted_window_keys) ? identity.accepted_window_keys.map(String).filter(Boolean) : [];
    if (!resource_id || !String(context && context.cache_key || '') || !String(identity.resource_fingerprint || '') || !String(identity.timezone || '') || !window_keys.length || !Number.isFinite(Number(visible_range.start_minute)) || !Number.isFinite(Number(visible_range.end_minute)) || Number(visible_range.end_minute) <= Number(visible_range.start_minute) || !Number.isFinite(Number(context.zoom_percent)) || !Number.isInteger(Number(selection_step_minutes)) || 1 > Number(selection_step_minutes)) {
      return '';
    }
    return [resource_id, String(context.cache_key), String(identity.resource_fingerprint), Number(identity.booking_generation || 0), Number(identity.availability_generation || 0), window_keys.join(','), String(identity.timezone), Number(visible_range.start_minute), Number(visible_range.end_minute), Number(context.zoom_percent), Number(selection_step_minutes)].join('|');
  }

  /**
   * Build one canonical segment cache key without presentation identity.
   *
   * @param {string} identity_key Accepted Resource and geometry identity.
   * @param {number} booking_id Canonical booking ID.
   * @param {number} resource_id Canonical Resource ID.
   * @param {string} segment_id Canonical accepted segment ID.
   * @param {string} visible_start Exact offset-qualified visible start.
   * @param {string} visible_end Exact offset-qualified visible end.
   * @return {string} Stable eligibility cache key.
   */
  function build_canonical_key(identity_key, booking_id, resource_id, segment_id, visible_start, visible_end) {
    return [identity_key, booking_id, resource_id, segment_id, visible_start, visible_end].join('|');
  }

  /**
   * Create one page-local projected-booking eligibility controller.
   *
   * @param {Object} context Timeline extension context.
   * @return {Object} Symmetric module lifecycle and neutral bridge API.
   */
  function create_controller(context) {
    var mount = context.mount || null;
    var configuration = context.configuration || {};
    var time_rows_configuration = configuration.time_rows || {};
    var transport = configuration.transport || {};
    var templates = configuration.templates || {};
    var i18n = configuration.i18n || {};
    var optional_gestures = configuration.optional_gestures || {};
    var geometry = window.wpbc_timeline_time_rows_interaction_geometry || null;
    var callbacks = context.callbacks || booking_interaction_callbacks || {};
    var selection_step_minutes = Number(configuration.selection_step_minutes || 0);
    var full_day_movement_enabled = true === optional_gestures.full_day_movement;
    var full_day_resize_enabled = true === optional_gestures.full_day_resize;
    var cross_resource_movement_enabled = true === optional_gestures.cross_resource_movement;
    var registrations_by_render_id = Object.create(null);
    var registration_ids_by_resource = Object.create(null);
    var refresh_identity_by_resource = Object.create(null);
    var eligibility_cache = Object.create(null);
    var active_requests = [];
    var active_request_resource_id = 0;
    var request_generation = 0;
    var reconcile_frame = 0;
    var pending_selection_state = null;
    var selected_booking_id = 0;
    var selected_render_id = '';
    var selected_canonical_key = '';
    var is_request_loading = false;
    var is_initialized = false;
    var active_gesture = null;
    var gesture_frame = 0;

    /**
     * Resolve the current accepted-data controller without retaining it.
     *
     * @return {Object|null} Active time-row instance or null.
     */
    function get_time_rows_controller() {
      var modules = window.wpbc_timeline_modules;
      return modules && 'function' === typeof modules.get_instance ? modules.get_instance(String(time_rows_configuration.instance_id || '')) : null;
    }

    /**
     * Read the current accepted identity directly from its authoritative owner.
     *
     * @param {number} resource_id Authorized open Resource ID.
     * @return {Object|null} Current accepted interaction context or null.
     */
    function get_live_interaction_context(resource_id) {
      var time_rows = get_time_rows_controller();
      if (!time_rows || 'function' !== typeof time_rows.get_interaction_geometry_context) {
        return null;
      }
      return time_rows.get_interaction_geometry_context(resource_id);
    }

    /**
     * Return a fixed allow-listed WordPress template renderer.
     *
     * @param {string} template_slot Server-owned template slot.
     * @return {Function|null} Template renderer or null.
     */
    function get_template(template_slot) {
      var template_id = templates[template_slot];
      return template_id && wp && 'function' === typeof wp.template ? wp.template(template_id) : null;
    }

    /**
     * Remove every pending eligibility read and advance stale-response state.
     *
     * @param {number} resource_id Optional Resource-scoped cancellation.
     * @return {void}
     */
    function abort_requests(resource_id) {
      resource_id = normalize_positive_integer(resource_id);
      if (resource_id && active_request_resource_id && resource_id !== active_request_resource_id) {
        return;
      }
      active_requests.forEach(function (request) {
        if (request && 'function' === typeof request.abort) {
          request.abort();
        }
      });
      active_requests = [];
      active_request_resource_id = 0;
      request_generation += 1;
    }

    /**
     * Cancel one frame-coalesced booking-selection reconciliation.
     *
     * @return {void}
     */
    function cancel_reconcile_selection() {
      if (reconcile_frame && 'function' === typeof window.cancelAnimationFrame) {
        window.cancelAnimationFrame(reconcile_frame);
      }
      reconcile_frame = 0;
      pending_selection_state = null;
    }

    /**
     * Remove module-owned controls from one canonical registration.
     *
     * @param {Object} registration Accepted projected segment registration.
     * @return {void}
     */
    function clear_registration_host(registration) {
      var hosts = registration && registration.card && registration.card.querySelectorAll ? registration.card.querySelectorAll('[data-wpbc-timeline-time-rows-movement-host]') : [];
      Array.prototype.forEach.call(hosts, function (host) {
        host.remove();
      });
    }

    /**
     * Remove module presentation from every retained projected segment.
     *
     * @return {void}
     */
    function clear_all_registration_hosts() {
      Object.keys(registrations_by_render_id).forEach(function (render_id) {
        clear_registration_host(registrations_by_render_id[render_id]);
      });
    }

    /**
     * Invalidate every eligibility record and remove current controls.
     *
     * @return {void}
     */
    function invalidate_all() {
      cancel_gesture(false, '');
      abort_requests();
      cancel_reconcile_selection();
      clear_all_registration_hosts();
      eligibility_cache = Object.create(null);
      selected_canonical_key = '';
    }

    /**
     * Remove all registrations and eligibility owned by one Resource.
     *
     * @param {number}  resource_id          Resource whose projection was replaced.
     * @param {boolean} preserve_eligibility Whether same-identity cache may remain.
     * @return {void}
     */
    function invalidate_resource(resource_id, preserve_eligibility) {
      var render_ids = registration_ids_by_resource[resource_id] || [];
      if (active_gesture && (active_gesture.registration.resource_id === resource_id || active_gesture.target_resource_id === resource_id)) {
        cancel_gesture(false, '');
      }
      abort_requests(resource_id);
      render_ids.forEach(function (render_id) {
        var registration = registrations_by_render_id[render_id];
        clear_registration_host(registration);
        if (!preserve_eligibility && registration && eligibility_cache[registration.canonical_key]) {
          delete eligibility_cache[registration.canonical_key];
        }
        delete registrations_by_render_id[render_id];
      });
      delete registration_ids_by_resource[resource_id];
      delete refresh_identity_by_resource[resource_id];
      if (selected_canonical_key && !Object.keys(registrations_by_render_id).some(function (render_id) {
        return registrations_by_render_id[render_id].canonical_key === selected_canonical_key;
      })) {
        selected_canonical_key = '';
      }
    }

    /**
     * Normalize a canonical projected segment supplied by accepted data.
     *
     * @param {HTMLElement} card Accepted projected card element.
     * @param {Object} segment Canonical accepted segment DTO.
     * @param {Object} presentation_context Presentation-only registration data.
     * @return {Object|null} Canonical registration or null.
     */
    function normalize_registration(card, segment, presentation_context) {
      var resource_id = normalize_positive_integer(segment && segment.resource_id);
      var booking_id = normalize_positive_integer(segment && segment.booking_id);
      var segment_id = String(segment && segment.segment_id || '');
      var visible_start = String(segment && segment.visible_start || '');
      var visible_end = String(segment && segment.visible_end || '');
      var render_id = String(presentation_context && presentation_context.render_segment_id || '');
      var identity_key = refresh_identity_by_resource[resource_id] || '';
      var boundaries = presentation_context && presentation_context.boundary_visibility ? presentation_context.boundary_visibility : {};
      var interaction_axis = 'vertical' === String(presentation_context && presentation_context.interaction_axis || '') ? 'vertical' : 'horizontal';
      if (!card || !card.isConnected || !booking_id || !resource_id || !segment_id || !render_id || !identity_key || !exact_instant_pattern.test(visible_start) || !exact_instant_pattern.test(visible_end)) {
        return null;
      }
      return {
        card: card,
        booking_id: booking_id,
        resource_id: resource_id,
        segment_id: segment_id,
        visible_start: visible_start,
        visible_end: visible_end,
        render_id: render_id,
        identity_key: identity_key,
        canonical_key: build_canonical_key(identity_key, booking_id, resource_id, segment_id, visible_start, visible_end),
        is_overflowed: true === presentation_context.is_overflowed,
        interaction_axis: interaction_axis,
        boundary_start_visible: true === boundaries.start,
        boundary_end_visible: true === boundaries.end
      };
    }

    /**
     * Begin one Resource-local projected refresh from accepted identity.
     *
     * @param {Object} refresh_context Presentation refresh context.
     * @return {void}
     */
    function begin_read_only_refresh(refresh_context) {
      var resource_id = normalize_positive_integer(refresh_context && refresh_context.resource_id);
      var live_context;
      var identity_key;
      var previous_identity_key;
      if (String(refresh_context && refresh_context.presentation_id || '') !== String(time_rows_configuration.presentation_id || '') || !resource_id) {
        return;
      }
      live_context = get_live_interaction_context(resource_id);
      identity_key = build_accepted_identity_key(live_context, selection_step_minutes);
      previous_identity_key = refresh_identity_by_resource[resource_id] || '';
      invalidate_resource(resource_id, Boolean(identity_key && identity_key === previous_identity_key));
      if (identity_key) {
        refresh_identity_by_resource[resource_id] = identity_key;
        registration_ids_by_resource[resource_id] = [];
      }
    }

    /**
     * Register one projected card with its accepted canonical segment.
     *
     * @param {HTMLElement} card Rendered projected booking card.
     * @param {Object} segment Accepted canonical segment DTO.
     * @param {Object} resource_summary Authorized Resource summary, unused here.
     * @param {Object} presentation_context Presentation-only render metadata.
     * @return {void}
     */
    function register_read_only_segment(card, segment, resource_summary, presentation_context) {
      var registration = normalize_registration(card, segment, presentation_context);
      if (!registration) {
        return;
      }
      registrations_by_render_id[registration.render_id] = registration;
      registration_ids_by_resource[registration.resource_id] = registration_ids_by_resource[registration.resource_id] || [];
      registration_ids_by_resource[registration.resource_id].push(registration.render_id);
    }

    /**
     * Normalize an authoritative movement-context response.
     *
     * @param {Object} response AJAX response envelope.
     * @param {Object} registration Requested canonical registration.
     * @return {Object|null} Normalized movement eligibility or null.
     */
    function normalize_movement_response(response, registration) {
      var movement = response && response.success && response.data ? response.data.movement_context : null;
      var availability = movement && movement.gesture_availability ? movement.gesture_availability : {};
      var schedule_seed = movement && movement.schedule_seed ? movement.schedule_seed : {};
      var selected_dates = Array.isArray(schedule_seed.selected_dates) ? schedule_seed.selected_dates.map(String) : [];
      var exact_intervals = Array.isArray(schedule_seed.exact_intervals) ? schedule_seed.exact_intervals.map(function (interval) {
        return Object.freeze({
          start: String(interval && interval.start || ''),
          end: String(interval && interval.end || '')
        });
      }) : [];
      var same_resource = true === availability.same_resource;
      var cross_resource = true === availability.cross_resource;
      var source_context_token = String(movement && movement.source_context_token || '');
      var time_application = String(schedule_seed.time_application || '');
      var selection_method = String(schedule_seed.selection_method || '');
      if (!movement || Number(movement.booking_id) !== registration.booking_id || !normalize_positive_integer(movement.primary_resource_id) || !normalize_positive_integer(movement.proposal_revision) || !selected_dates.length || -1 === ['policy', 'individual'].indexOf(selection_method)) {
        return null;
      }
      if ('full_day' !== time_application && (!exact_intervals.length || exact_intervals.some(function (interval) {
        return !exact_instant_pattern.test(interval.start) || !exact_instant_pattern.test(interval.end) || Date.parse(interval.end) <= Date.parse(interval.start);
      }))) {
        return null;
      }
      if ((same_resource || cross_resource) && !source_context_token) {
        return null;
      }
      return {
        allowed: same_resource || cross_resource,
        same_resource: same_resource,
        cross_resource: cross_resource,
        source_context_token: source_context_token,
        booking_id: registration.booking_id,
        primary_resource_id: normalize_positive_integer(movement.primary_resource_id),
        proposal_revision: normalize_positive_integer(movement.proposal_revision),
        selection_method: selection_method,
        time_application: time_application,
        selected_dates: Object.freeze(selected_dates),
        exact_intervals: Object.freeze(exact_intervals)
      };
    }

    /**
     * Normalize an authoritative resize-context response.
     *
     * @param {Object} response AJAX response envelope.
     * @param {Object} registration Requested canonical registration.
     * @return {Object|null} Normalized boundary eligibility or null.
     */
    function normalize_resize_response(response, registration) {
      var resize = response && response.success && response.data ? response.data.resize_context : null;
      var boundaries = resize && resize.boundaries ? resize.boundaries : {};
      var fallback = resize && resize.fallback ? resize.fallback : {};
      var start = boundaries.start || {};
      var end = boundaries.end || {};
      var start_allowed = true === start.eligible && 'resize_start' === String(start.operation || '');
      var end_allowed = true === end.eligible && 'resize_end' === String(end.operation || '');
      var source_context_token = String(resize && resize.source_context_token || '');
      var saved_shape = String(resize && resize.saved_shape || '');
      var affected_intervals = [];
      var immutable_interval = null;
      var anchor_interval_index = -1;
      if (!resize || Number(resize.schema_version) !== Number(transport.resize && transport.resize.schema_version) || Number(resize.booking_id) !== registration.booking_id || !normalize_positive_integer(resize.target_resource_id) || 'resize' !== String(resize.interaction_source || '') || 'boolean' !== typeof resize.eligible) {
        return null;
      }
      if ((true === resize.eligible || start_allowed || end_allowed) && !source_context_token) {
        return null;
      }
      if (false === resize.eligible && (start_allowed || end_allowed)) {
        return null;
      }
      if (false === resize.eligible) {
        return {
          allowed: false,
          start: false,
          end: false,
          fallback_reason: String(fallback.reason || ''),
          source_context_token: ''
        };
      }
      if (-1 === supported_timed_resize_shapes.indexOf(saved_shape) && (!full_day_resize_enabled || -1 === supported_full_day_resize_shapes.indexOf(saved_shape))) {
        return {
          allowed: false,
          start: false,
          end: false,
          fallback_reason: 'full_reschedule',
          source_context_token: ''
        };
      }
      affected_intervals = Array.isArray(resize.affected_intervals) ? resize.affected_intervals.map(function (interval) {
        var normalized = {
          start: String(interval && interval.start || ''),
          end: String(interval && interval.end || '')
        };
        return exact_instant_pattern.test(normalized.start) && exact_instant_pattern.test(normalized.end) && Date.parse(normalized.end) > Date.parse(normalized.start) ? Object.freeze(normalized) : null;
      }).filter(Boolean) : [];
      immutable_interval = resize.immutable_interval ? {
        start: String(resize.immutable_interval.start || ''),
        end: String(resize.immutable_interval.end || '')
      } : null;
      if (!source_context_token || !normalize_positive_integer(resize.proposal_revision) || !immutable_interval || !exact_instant_pattern.test(immutable_interval.start) || !exact_instant_pattern.test(immutable_interval.end) || Date.parse(immutable_interval.end) <= Date.parse(immutable_interval.start) || !affected_intervals.length || affected_intervals.length !== Number(resize.affected_interval_count)) {
        return null;
      }
      affected_intervals.some(function (interval, index) {
        if (interval.start === immutable_interval.start && interval.end === immutable_interval.end) {
          anchor_interval_index = index;
          return true;
        }
        return false;
      });
      if (-1 === anchor_interval_index || !start_allowed && !end_allowed) {
        return null;
      }
      return {
        allowed: true,
        start: start_allowed,
        end: end_allowed,
        booking_id: registration.booking_id,
        target_resource_id: normalize_positive_integer(resize.target_resource_id),
        saved_shape: saved_shape,
        resize_scope: String(resize.resize_scope || ''),
        proposal_revision: normalize_positive_integer(resize.proposal_revision),
        source_context_token: source_context_token,
        immutable_interval: Object.freeze(immutable_interval),
        affected_intervals: Object.freeze(affected_intervals),
        anchor_interval_index: anchor_interval_index,
        selection_method: 'independent_full_days' === saved_shape ? 'individual' : 'policy',
        fallback_reason: ''
      };
    }

    /**
     * Report whether a registration still belongs to the live accepted identity.
     *
     * @param {Object} registration Canonical projected registration.
     * @return {boolean} True when identity, geometry, and DOM remain current.
     */
    function is_registration_current(registration) {
      var live_context = registration ? get_live_interaction_context(registration.resource_id) : null;
      return Boolean(registration && registration.card && registration.card.isConnected && registration.identity_key === refresh_identity_by_resource[registration.resource_id] && registration.identity_key === build_accepted_identity_key(live_context, selection_step_minutes));
    }

    /**
     * Append one card-owned host rendered only through fixed templates.
     *
     * Keeping the host outside the information rail prevents eligibility
     * controls from displacing Booking Overview and Inspector actions. The
     * explicit presentation axis selects horizontal or vertical chrome without
     * deriving business authority from card markup.
     *
     * @param {Object} registration Canonical projected registration.
     * @return {HTMLElement|null} New host or null.
     */
    function create_control_host(registration) {
      var host;
      if (!registration.card || !registration.card.appendChild || registration.is_overflowed) {
        return null;
      }
      host = document.createElement('span');
      host.className = 'wpbc_timeline_time_rows_movement__host is-' + registration.interaction_axis;
      host.setAttribute('data-wpbc-timeline-time-rows-movement-host', '');
      registration.card.appendChild(host);
      return host;
    }

    /**
     * Render one allow-listed template into a module-owned host.
     *
     * @param {HTMLElement} host Module-owned host.
     * @param {string} template_slot Fixed server template slot.
     * @param {Object} model Executable-free presentation model.
     * @return {boolean} True when a template rendered.
     */
    function render_template(host, template_slot, model) {
      var template = get_template(template_slot);
      if (!host || !template) {
        return false;
      }
      host.insertAdjacentHTML('beforeend', template(model || {}));
      return true;
    }

    /**
     * Return all live fragments resolved to one canonical accepted segment.
     *
     * @param {string} canonical_key Accepted canonical cache key.
     * @return {Array<Object>} Current canonical registrations.
     */
    function get_canonical_registrations(canonical_key) {
      return Object.keys(registrations_by_render_id).map(function (render_id) {
        return registrations_by_render_id[render_id];
      }).filter(function (registration) {
        return registration.canonical_key === canonical_key && is_registration_current(registration);
      });
    }

    /**
     * Measure logical date columns for one gesture-owned geometry snapshot.
     *
     * @param {Element} surface   Expanded all-day or timed surface.
     * @param {string}  direction ltr or rtl.
     * @return {Array<Object>} Ordered logical column DTOs.
     */
    function measure_date_columns(surface, direction) {
      var surface_rect = surface.getBoundingClientRect();
      return Array.prototype.map.call(surface.querySelectorAll(date_column_selector), function (column) {
        var column_rect = column.getBoundingClientRect();
        return {
          date: String(column.getAttribute('data-wpbc-timeline-time-rows-date') || ''),
          logical_start: Math.max(0, 'rtl' === direction ? surface_rect.right - column_rect.right : column_rect.left - surface_rect.left),
          logical_end: Math.max(0, 'rtl' === direction ? surface_rect.right - column_rect.left : column_rect.right - surface_rect.left)
        };
      });
    }

    /**
     * Prepare one immutable accepted and measured surface snapshot.
     *
     * @param {number} resource_id Authorized open Resource ID.
     * @param {Element} surface Expanded all-day or timed surface.
     * @param {string} interaction_axis horizontal or vertical.
     * @return {Object|null} Gesture context or null when identity is stale.
     */
    function prepare_surface_context(resource_id, surface, interaction_axis) {
      var accepted_context = get_live_interaction_context(resource_id);
      var direction;
      var surface_style;
      var surface_rect;
      var booking_column_gutter_px;
      var prepared;
      var identity_key;
      if (!surface || !accepted_context || !geometry || 'function' !== typeof geometry.prepare_geometry || !Number.isInteger(selection_step_minutes) || 1 > selection_step_minutes) {
        return null;
      }
      identity_key = build_accepted_identity_key(accepted_context, selection_step_minutes);
      if (!identity_key || identity_key !== refresh_identity_by_resource[resource_id]) {
        return null;
      }
      surface_style = window.getComputedStyle(surface);
      direction = 'rtl' === surface_style.direction ? 'rtl' : 'ltr';
      booking_column_gutter_px = parseFloat(surface_style.getPropertyValue('--wpbc-time-rows-booking-column-gutter'));
      booking_column_gutter_px = Number.isFinite(booking_column_gutter_px) ? Math.max(0, booking_column_gutter_px) : 0;
      surface_rect = surface.getBoundingClientRect();
      prepared = geometry.prepare_geometry({
        accepted_identity: accepted_context.accepted_identity,
        date_bands: accepted_context.date_bands,
        date_columns: measure_date_columns(surface, direction),
        visible_range: accepted_context.visible_range,
        zoom_percent: accepted_context.zoom_percent,
        hour_height_px: accepted_context.hour_height_px,
        block_extent_px: surface_rect.height,
        selection_step_minutes: selection_step_minutes,
        direction: direction
      });
      if (!prepared || 'ready' !== prepared.status) {
        return null;
      }
      return {
        resource_id: resource_id,
        identity_key: identity_key,
        interaction_axis: interaction_axis,
        surface: surface,
        surface_rect: surface_rect,
        booking_column_gutter_px: booking_column_gutter_px,
        snapshot: prepared.snapshot,
        selection_kind: 'vertical' === interaction_axis ? 'timed' : 'all_day'
      };
    }

    /**
     * Prepare one immutable accepted and measured source snapshot.
     *
     * @param {Object} registration Current canonical projected registration.
     * @return {Object|null} Gesture context or null when identity is stale.
     */
    function prepare_gesture_context(registration) {
      var surface = registration && registration.card && registration.card.closest ? registration.card.closest('vertical' === registration.interaction_axis ? timed_surface_selector : all_day_surface_selector) : null;
      if (!registration || !surface || !is_registration_current(registration)) {
        return null;
      }
      return prepare_surface_context(registration.resource_id, surface, registration.interaction_axis);
    }

    /**
     * Convert one pointer event to a pure geometry coordinate.
     *
     * @param {Object} gesture_context Frozen geometry context.
     * @param {Object} event           Pointer-like event.
     * @return {Object} Geometry coordinate DTO.
     */
    function pointer_coordinate(gesture_context, event) {
      var surface_rect = gesture_context.surface_rect;
      return {
        source: 'pointer',
        selection_kind: gesture_context.selection_kind,
        inline_px: Number(event.clientX) - surface_rect.left,
        block_px: Number(event.clientY) - surface_rect.top
      };
    }

    /**
     * Convert pointer displacement to a relative timed resize wall coordinate.
     *
     * The pointer-down position is the physical origin. Each complete visual
     * step changes the immutable saved wall minute by one server-owned step, so
     * an off-grid boundary retains its minute remainder. Horizontal movement is
     * intentionally ignored because native Timeline remains the date-boundary
     * workflow.
     *
     * @param {Object} gesture Active authorized timed resize gesture.
     * @param {Object} event   Pointer-like event.
     * @return {Object} Pointer geometry coordinate locked to the source date.
     */
    function timed_resize_pointer_coordinate(gesture, event) {
      var snapshot = gesture.context.snapshot;
      var step_height = snapshot.selection_step_minutes * snapshot.pixels_per_minute;
      var pointer_delta = Number(event.clientY) - gesture.pointer_start_client_y;
      var step_delta = 0 > pointer_delta ? -Math.round(Math.abs(pointer_delta / step_height)) : Math.round(pointer_delta / step_height);
      var minimum_step_delta = Math.ceil((snapshot.visible_range.start_minute - gesture.origin.wall_minute) / snapshot.selection_step_minutes);
      var maximum_step_delta = Math.floor((snapshot.visible_range.end_minute - gesture.origin.wall_minute) / snapshot.selection_step_minutes);
      step_delta = Math.max(minimum_step_delta, Math.min(maximum_step_delta, step_delta));
      return {
        source: 'relative_resize',
        selection_kind: 'timed',
        date: gesture.origin.date,
        wall_minute: gesture.origin.wall_minute + step_delta * snapshot.selection_step_minutes
      };
    }

    /**
     * Confirm that a prepared Resource geometry context is still accepted.
     *
     * @param {Object} gesture_context Prepared Resource-local geometry.
     * @return {boolean} True while authorization and geometry identity match.
     */
    function is_gesture_context_current(gesture_context) {
      var accepted_context = gesture_context ? get_live_interaction_context(gesture_context.resource_id) : null;
      return Boolean(gesture_context && gesture_context.surface && gesture_context.surface.isConnected && gesture_context.identity_key === refresh_identity_by_resource[gesture_context.resource_id] && gesture_context.identity_key === build_accepted_identity_key(accepted_context, selection_step_minutes));
    }

    /**
     * Resolve a pointer into one authorized expanded Resource surface.
     *
     * Target hit testing and geometry remain entirely inside this Time Rows
     * adapter. The existing booking-movement module receives only the final
     * presentation-neutral proposal.
     *
     * @param {Object} gesture Active movement gesture.
     * @param {Object} event Pointer-like event.
     * @return {Object|null} Target context, Resource, and coordinate.
     */
    function resolve_pointer_movement_target(gesture, event) {
      var selector = 'vertical' === gesture.registration.interaction_axis ? timed_surface_selector : all_day_surface_selector;
      var client_x = Number(event.clientX);
      var client_y = Number(event.clientY);
      var point_target = document && 'function' === typeof document.elementFromPoint ? document.elementFromPoint(client_x, client_y) : null;
      var matched_surface = null;
      var surfaces;
      var panel;
      var resource_id;
      var is_cross_resource;
      var target_context;
      matched_surface = point_target && point_target.closest ? point_target.closest(selector) : null;
      if (matched_surface && mount && 'function' === typeof mount.contains && !mount.contains(matched_surface)) {
        matched_surface = null;
      }
      if (!matched_surface && !point_target) {
        surfaces = mount && mount.querySelectorAll ? mount.querySelectorAll(selector) : [];
        Array.prototype.some.call(surfaces, function (surface) {
          var rectangle = surface.getBoundingClientRect();
          if (client_x < rectangle.left || client_x > rectangle.right || client_y < rectangle.top || client_y > rectangle.bottom) {
            return false;
          }
          matched_surface = surface;
          return true;
        });
      }
      if (!matched_surface) {
        return null;
      }
      panel = matched_surface.closest ? matched_surface.closest(time_rows_panel_selector) : null;
      resource_id = normalize_positive_integer(panel && panel.getAttribute('data-wpbc-timeline-time-rows-resource-id'));
      is_cross_resource = resource_id && resource_id !== gesture.registration.resource_id;
      if (!resource_id || !is_cross_resource && !gesture.eligibility.movement.same_resource || is_cross_resource && (!cross_resource_movement_enabled || !gesture.eligibility.movement.cross_resource)) {
        return null;
      }
      gesture.target_contexts = gesture.target_contexts || Object.create(null);
      target_context = gesture.target_contexts[resource_id];
      if (!target_context || target_context.surface !== matched_surface || !is_gesture_context_current(target_context)) {
        target_context = prepare_surface_context(resource_id, matched_surface, gesture.registration.interaction_axis);
        if (!target_context) {
          return null;
        }
        gesture.target_contexts[resource_id] = target_context;
      }
      return {
        context: target_context,
        resource_id: resource_id,
        is_cross_resource: is_cross_resource,
        coordinate: pointer_coordinate(target_context, event)
      };
    }

    /**
     * Return a bounded keyboard coordinate.
     *
     * @param {Object} snapshot       Frozen geometry snapshot.
     * @param {string} selection_kind timed or all_day.
     * @param {string} date           Accepted server date.
     * @param {number} snap_index     Candidate step index.
     * @return {Object} Keyboard coordinate DTO.
     */
    function keyboard_coordinate(snapshot, selection_kind, date, snap_index) {
      var maximum_index = 'all_day' === selection_kind ? 0 : Math.max(0, Math.ceil((snapshot.visible_range.end_minute - snapshot.visible_range.start_minute) / snapshot.selection_step_minutes) - 1);
      return {
        source: 'keyboard',
        selection_kind: selection_kind,
        date: String(date || ''),
        snap_index: Math.max(0, Math.min(maximum_index, Number(snap_index) || 0))
      };
    }

    /**
     * Shift one strict ISO date by whole calendar days without local timezone use.
     *
     * @param {string} value ISO date.
     * @param {number} days  Signed calendar-day count.
     * @return {string} Shifted date or an empty string.
     */
    function shift_date(value, days) {
      var match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      var shifted;
      if (!match || !Number.isInteger(days)) {
        return '';
      }
      shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
      return shifted.toISOString().slice(0, 10);
    }

    /**
     * Calculate a civil calendar-day delta without browser-local timezone use.
     *
     * @param {string} start_date ISO source date.
     * @param {string} end_date ISO target date.
     * @return {number|null} Signed whole-day delta, or null for malformed dates.
     */
    function calendar_day_delta(start_date, end_date) {
      var start_match = String(start_date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      var end_match = String(end_date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      var start_epoch;
      var end_epoch;
      if (!start_match || !end_match) {
        return null;
      }
      start_epoch = Date.UTC(Number(start_match[1]), Number(start_match[2]) - 1, Number(start_match[3]));
      end_epoch = Date.UTC(Number(end_match[1]), Number(end_match[2]) - 1, Number(end_match[3]));
      return Math.round((end_epoch - start_epoch) / 86400000);
    }

    /**
     * Resolve one full-day source boundary through accepted server date bands.
     *
     * @param {Object} snapshot Prepared immutable geometry snapshot.
     * @param {string} instant Exact offset-qualified canonical instant.
     * @param {string} operation resize_start or resize_end.
     * @return {Object|null} Exact boundary result or null outside coverage.
     */
    function resolve_full_day_instant_boundary(snapshot, instant, operation) {
      var exact_epoch = Date.parse(instant) / 1000;
      var date_band = null;
      if (!Number.isFinite(exact_epoch)) {
        return null;
      }
      snapshot.date_bands.some(function (candidate) {
        var matches = 'resize_end' === operation ? candidate.end_epoch === exact_epoch : candidate.start_epoch === exact_epoch;
        if (matches) {
          date_band = candidate;
        }
        return matches;
      });
      if (!date_band) {
        return null;
      }
      return {
        status: 'exact',
        date: date_band.date,
        wall_minute: 'resize_end' === operation ? 1440 : 0,
        snap_index: 0,
        epoch: exact_epoch,
        exact_at: String(instant),
        candidates: []
      };
    }

    /**
     * Convert an all-day coordinate into its exact inclusive or exclusive edge.
     *
     * @param {Object} snapshot Prepared immutable geometry snapshot.
     * @param {Object} resolved Exact all-day coordinate result.
     * @param {string} operation resize_start or resize_end.
     * @return {Object|null} Exact server-band boundary.
     */
    function resolve_full_day_target_boundary(snapshot, resolved, operation) {
      var date_band = resolved && snapshot.bands_by_date[resolved.date];
      if (!date_band || 'exact' !== resolved.status) {
        return null;
      }
      return {
        status: 'exact',
        date: date_band.date,
        wall_minute: 'resize_end' === operation ? 1440 : 0,
        snap_index: 0,
        epoch: 'resize_end' === operation ? date_band.end_epoch : date_band.start_epoch,
        exact_at: 'resize_end' === operation ? date_band.end_at : date_band.start_at,
        candidates: []
      };
    }

    /**
     * Format one epoch as an exact RFC3339 minute in the accepted site timezone.
     *
     * @param {number} epoch_seconds Exact epoch seconds.
     * @param {string} timezone      Accepted IANA timezone.
     * @return {string} Offset-qualified instant or an empty string.
     */
    function format_instant(epoch_seconds, timezone) {
      var values = {};
      var formatter;
      var represented;
      var offset_minutes;
      var sign;
      var pad = function (value, length) {
        return String(Math.abs(Math.round(value))).padStart(length, '0');
      };
      try {
        formatter = new window.Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          hourCycle: 'h23',
          minute: '2-digit',
          second: '2-digit'
        });
        formatter.formatToParts(new Date(epoch_seconds * 1000)).forEach(function (part) {
          if ('literal' !== part.type) {
            values[part.type] = Number(part.value);
          }
        });
      } catch (error) {
        return '';
      }
      if (!values.year) {
        return '';
      }
      represented = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second) / 1000;
      offset_minutes = Math.round((represented - epoch_seconds) / 60);
      sign = 0 <= offset_minutes ? '+' : '-';
      return pad(values.year, 4) + '-' + pad(values.month, 2) + '-' + pad(values.day, 2) + 'T' + pad(values.hour, 2) + ':' + pad(values.minute, 2) + ':00' + sign + pad(Math.floor(Math.abs(offset_minutes) / 60), 2) + ':' + pad(Math.abs(offset_minutes) % 60, 2);
    }

    /**
     * Build one same-Resource `drag + shift` proposal from exact cells.
     *
     * @param {Object} gesture Active gesture state.
     * @return {Object|null} Executable-free proposal or null for no movement.
     */
    function build_movement_proposal(gesture) {
      var movement = gesture.eligibility.movement;
      var origin = gesture.origin;
      var current = gesture.current;
      var date_delta = calendar_day_delta(origin.date, current.date);
      var instant_delta = Number(current.epoch) - Number(origin.epoch);
      var target_surface_resource_id = normalize_positive_integer(gesture.target_resource_id) || gesture.registration.resource_id;
      var is_cross_resource = target_surface_resource_id !== gesture.registration.resource_id;
      var target_resource_id = is_cross_resource ? target_surface_resource_id : movement.primary_resource_id;
      var proposal = {
        schema_version: Number(movement.review_schema_version || configuration.review_schema_version || 1),
        booking_id: movement.booking_id,
        interaction_source: is_cross_resource ? 'cross_resource_drag' : 'drag',
        operation: is_cross_resource ? 'change_resource' : 'shift',
        target_resource_id: target_resource_id,
        selection_method: movement.selection_method,
        proposal_revision: movement.proposal_revision,
        source_context_token: movement.source_context_token
      };
      if (is_cross_resource && (!cross_resource_movement_enabled || !movement.cross_resource) || !is_cross_resource && !movement.same_resource) {
        return null;
      }
      if ('full_day' === movement.time_application) {
        if (!full_day_movement_enabled || null === date_delta || !date_delta && !is_cross_resource) {
          return null;
        }
        proposal.proposed_dates = movement.selected_dates.map(function (date) {
          return shift_date(date, date_delta);
        });
        return proposal.proposed_dates.every(Boolean) ? Object.freeze(proposal) : null;
      }
      if (!instant_delta && !is_cross_resource) {
        return null;
      }
      proposal.proposed_intervals = movement.exact_intervals.map(function (interval) {
        var start_epoch = Date.parse(interval.start) / 1000 + instant_delta;
        var end_epoch = Date.parse(interval.end) / 1000 + instant_delta;
        return Object.freeze({
          start: format_instant(start_epoch, gesture.context.snapshot.accepted_identity.timezone),
          end: format_instant(end_epoch, gesture.context.snapshot.accepted_identity.timezone)
        });
      });
      return proposal.proposed_intervals.every(function (interval) {
        return exact_instant_pattern.test(interval.start) && exact_instant_pattern.test(interval.end) && Date.parse(interval.end) - Date.parse(interval.start) > 0;
      }) ? Object.freeze(proposal) : null;
    }

    /**
     * Resolve one server-qualified instant through the prepared DST geometry.
     *
     * Explicit fold offsets are matched back to the server transition candidate;
     * no browser-local timezone conversion selects a repeated occurrence.
     *
     * @param {Object} snapshot Prepared immutable geometry snapshot.
     * @param {string} instant  Exact offset-qualified instant.
     * @return {Object|null} Exact resolved boundary or null outside coverage.
     */
    function resolve_instant_boundary(snapshot, instant) {
      var match = String(instant || '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):00/);
      var wall_minute = match ? Number(match[2]) * 60 + Number(match[3]) : -1;
      var resolved;
      var exact_epoch = Date.parse(instant) / 1000;
      if (!match || !Number.isFinite(exact_epoch) || !snapshot.bands_by_date[match[1]] || wall_minute < snapshot.visible_range.start_minute || wall_minute > snapshot.visible_range.end_minute || !geometry || 'function' !== typeof geometry.resolve_wall_time) {
        return null;
      }
      resolved = geometry.resolve_wall_time(snapshot, match[1], wall_minute, '');
      if (resolved && 'fold' === resolved.status) {
        resolved.candidates.some(function (candidate) {
          if (Number(candidate.epoch) === exact_epoch) {
            resolved = geometry.resolve_wall_time(snapshot, match[1], wall_minute, candidate.occurrence_id);
            return true;
          }
          return false;
        });
      }
      return resolved && 'exact' === resolved.status && Number(resolved.epoch) === exact_epoch ? resolved : null;
    }

    /**
     * Build one local resize projection and its canonical one-boundary proposal.
     *
     * Group members are projected with the same exact delta for presentation.
     * Only the immutable anchor interval is transported; canonical Review derives
     * and validates the complete server-owned group again.
     *
     * @param {Object} gesture Active authorized resize gesture.
     * @return {Object|null} Local intervals and frozen canonical proposal.
     */
    function build_resize_projection(gesture) {
      var resize = gesture.eligibility.resize;
      var operation = gesture.operation;
      var immutable_start = Date.parse(resize.immutable_interval.start) / 1000;
      var immutable_end = Date.parse(resize.immutable_interval.end) / 1000;
      var source_boundary = 'resize_start' === operation ? immutable_start : immutable_end;
      var delta = Number(gesture.current.epoch) - source_boundary;
      var is_full_day = -1 !== supported_full_day_resize_shapes.indexOf(resize.saved_shape);
      var minimum_duration = is_full_day ? 1 : selection_step_minutes * 60;
      var intervals;
      var anchor;
      var anchor_start;
      var anchor_end;
      if (!delta || -1 === ['resize_start', 'resize_end'].indexOf(operation)) {
        return null;
      }
      intervals = resize.affected_intervals.map(function (interval) {
        var start_epoch = Date.parse(interval.start) / 1000;
        var end_epoch = Date.parse(interval.end) / 1000;
        return Object.freeze({
          start_epoch: 'resize_start' === operation ? start_epoch + delta : start_epoch,
          end_epoch: 'resize_end' === operation ? end_epoch + delta : end_epoch
        });
      });
      if (intervals.some(function (interval) {
        return interval.end_epoch - interval.start_epoch < minimum_duration;
      })) {
        return null;
      }
      anchor = intervals[resize.anchor_interval_index];
      if (!anchor) {
        return null;
      }
      anchor_start = 'resize_start' === operation ? String(gesture.current.exact_at || '') : resize.immutable_interval.start;
      anchor_end = 'resize_end' === operation ? String(gesture.current.exact_at || '') : resize.immutable_interval.end;
      if (!exact_instant_pattern.test(anchor_start) || !exact_instant_pattern.test(anchor_end) || Date.parse(anchor_end) - Date.parse(anchor_start) < minimum_duration * 1000) {
        return null;
      }
      return {
        intervals: Object.freeze(intervals),
        proposal: Object.freeze({
          schema_version: Number(configuration.review_schema_version || 1),
          booking_id: resize.booking_id,
          interaction_source: 'resize',
          operation: operation,
          target_resource_id: resize.target_resource_id,
          selection_method: resize.selection_method,
          proposed_intervals: Object.freeze([Object.freeze({
            start: anchor_start,
            end: anchor_end
          })]),
          proposal_revision: resize.proposal_revision,
          source_context_token: resize.source_context_token
        })
      };
    }

    /**
     * Format resize duration in the same compound units as native Timeline.
     *
     * @param {number} seconds Positive elapsed seconds.
     * @return {string} Localized presentation-only duration.
     */
    function format_resize_duration(seconds) {
      var minutes = Math.max(0, Math.round(Number(seconds) / 60));
      var days = Math.floor(minutes / 1440);
      var hours = Math.floor(minutes % 1440 / 60);
      var remaining_minutes = minutes % 60;
      var parts = [];
      if (days) {
        parts.push(String(1 === days ? i18n.resize_duration_day || '%s day' : i18n.resize_duration_days || '%s days').replace('%s', days));
      }
      if (hours) {
        parts.push(String(1 === hours ? i18n.resize_duration_hour || '%s hour' : i18n.resize_duration_hours || '%s hours').replace('%s', hours));
      }
      if (remaining_minutes || !parts.length) {
        parts.push(String(1 === remaining_minutes ? i18n.resize_duration_minute || '%s minute' : i18n.resize_duration_minutes || '%s minutes').replace('%s', remaining_minutes));
      }
      return parts.join(' ');
    }

    /**
     * Format one exact proposed endpoint for a concise visible boundary label.
     *
     * The instant is converted only through the accepted WordPress site timezone
     * and never through the browser timezone. The exact offset remains in the
     * canonical proposal and Review contract, while the visual label intentionally
     * shows only the accepted wall date and time.
     *
     * @param {number} epoch_seconds Exact endpoint epoch in seconds.
     * @param {string} timezone      Accepted IANA timezone.
     * @return {string} Accepted wall date and time.
     */
    function format_resize_visible_endpoint(epoch_seconds, timezone) {
      var instant = format_instant(epoch_seconds, timezone);
      var match = instant.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):00[+-]\d{2}:\d{2}$/);
      return match ? match[1] + ' ' + match[2] : instant;
    }

    /**
     * Build separate presentation labels without changing exact proposal data.
     *
     * @param {Object} interval Accepted local resize projection interval.
     * @param {Object} snapshot Prepared accepted geometry snapshot.
     * @return {Object} Visible start, end, and elapsed-duration labels.
     */
    function build_resize_range_labels(interval, snapshot) {
      var timezone = snapshot && snapshot.accepted_identity ? snapshot.accepted_identity.timezone : '';
      return {
        start: format_resize_visible_endpoint(interval.start_epoch, timezone),
        end: format_resize_visible_endpoint(interval.end_epoch, timezone),
        duration: format_resize_duration(interval.end_epoch - interval.start_epoch)
      };
    }

    /**
     * Convert one exact epoch to bounded logical Time Rows geometry.
     *
     * @param {Object} snapshot Prepared geometry snapshot.
     * @param {number} epoch    Exact epoch seconds.
     * @return {Object|null} Date-column and block-axis point, or null.
     */
    function get_resize_visual_point(snapshot, epoch) {
      var instant = format_instant(epoch, snapshot.accepted_identity.timezone);
      var match = instant.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):00/);
      var column = match && snapshot.date_columns[snapshot.date_order[match[1]]];
      var wall_minute = match ? Number(match[2]) * 60 + Number(match[3]) : 0;
      if (!column) {
        return null;
      }
      return {
        date: match[1],
        left: 'rtl' === snapshot.direction ? snapshot.inline_extent - column.logical_end : column.logical_start,
        width: column.logical_end - column.logical_start,
        top: (wall_minute - snapshot.visible_range.start_minute) * snapshot.pixels_per_minute
      };
    }

    /**
     * Split one exact timed interval into visible per-date column fragments.
     *
     * A multi-day boundary interval must not be rendered as one rectangular
     * bounding box because that fills every hour between its first and last
     * date columns. Each accepted server date band instead receives its own
     * wall-time fragment, clipped to the Resource-local visible range.
     *
     * @param {Object} snapshot    Prepared server-timezone geometry.
     * @param {number} start_epoch Exact inclusive interval start in seconds.
     * @param {number} end_epoch   Exact exclusive interval end in seconds.
     * @return {Array<Object>} Ordered visible timed fragment geometry.
     */
    function get_timed_resize_visual_fragments(snapshot, start_epoch, end_epoch) {
      var timezone = snapshot.accepted_identity.timezone;
      var date_bands = snapshot.date_bands;
      var fragments = [];
      var low = 0;
      var high = date_bands.length;
      var middle;
      var band_index;

      /* Skip non-intersecting earlier windows without scanning every band. */
      while (low < high) {
        middle = Math.floor((low + high) / 2);
        if (Number(date_bands[middle].end_epoch) <= start_epoch) {
          low = middle + 1;
        } else {
          high = middle;
        }
      }
      for (band_index = low; band_index < date_bands.length; band_index++) {
        var date_band = date_bands[band_index];
        var segment_start_epoch = Math.max(start_epoch, Number(date_band.start_epoch));
        var segment_end_epoch = Math.min(end_epoch, Number(date_band.end_epoch));
        var column = snapshot.date_columns[snapshot.date_order[date_band.date]];
        var start_match;
        var end_match;
        var start_wall_minute;
        var end_wall_minute;
        var visible_start_minute;
        var visible_end_minute;
        var left;
        if (Number(date_band.start_epoch) >= end_epoch) {
          break;
        }
        if (!column || segment_end_epoch <= segment_start_epoch) {
          continue;
        }
        start_match = format_instant(segment_start_epoch, timezone).match(/T(\d{2}):(\d{2}):00/);
        end_match = format_instant(segment_end_epoch, timezone).match(/T(\d{2}):(\d{2}):00/);
        start_wall_minute = segment_start_epoch === Number(date_band.start_epoch) ? 0 : start_match ? Number(start_match[1]) * 60 + Number(start_match[2]) : -1;
        end_wall_minute = segment_end_epoch === Number(date_band.end_epoch) ? 1440 : end_match ? Number(end_match[1]) * 60 + Number(end_match[2]) : -1;
        visible_start_minute = Math.max(start_wall_minute, snapshot.visible_range.start_minute);
        visible_end_minute = Math.min(end_wall_minute, snapshot.visible_range.end_minute);
        if (0 > start_wall_minute || 0 > end_wall_minute || visible_end_minute <= visible_start_minute) {
          continue;
        }
        left = 'rtl' === snapshot.direction ? snapshot.inline_extent - column.logical_end : column.logical_start;
        fragments.push({
          date: date_band.date,
          left: left,
          width: column.logical_end - column.logical_start,
          top: (visible_start_minute - snapshot.visible_range.start_minute) * snapshot.pixels_per_minute,
          height: (visible_end_minute - visible_start_minute) * snapshot.pixels_per_minute,
          start_boundary_visible: start_epoch >= Number(date_band.start_epoch) && start_epoch < Number(date_band.end_epoch) && start_wall_minute >= snapshot.visible_range.start_minute && start_wall_minute < snapshot.visible_range.end_minute,
          end_boundary_visible: end_epoch > Number(date_band.start_epoch) && end_epoch <= Number(date_band.end_epoch) && end_wall_minute > snapshot.visible_range.start_minute && end_wall_minute <= snapshot.visible_range.end_minute
        });
      }
      return fragments;
    }

    /**
     * Convert one exact full-day interval to loaded logical date geometry.
     *
     * @param {Object} snapshot Prepared geometry snapshot.
     * @param {number} start_epoch Exact inclusive start epoch in seconds.
     * @param {number} end_epoch Exact exclusive end epoch in seconds.
     * @return {Object|null} Bounded inline range and calendar-day count.
     */
    function get_full_day_visual_range(snapshot, start_epoch, end_epoch) {
      var visible_bands = snapshot.date_bands.filter(function (date_band) {
        return date_band.end_epoch > start_epoch && date_band.start_epoch < end_epoch;
      });
      var left = Number.POSITIVE_INFINITY;
      var right = Number.NEGATIVE_INFINITY;
      visible_bands.forEach(function (date_band) {
        var column = snapshot.date_columns[snapshot.date_order[date_band.date]];
        var physical_left;
        var physical_right;
        if (!column) {
          return;
        }
        physical_left = 'rtl' === snapshot.direction ? snapshot.inline_extent - column.logical_end : column.logical_start;
        physical_right = physical_left + column.logical_end - column.logical_start;
        left = Math.min(left, physical_left);
        right = Math.max(right, physical_right);
      });
      return visible_bands.length && Number.isFinite(left) && Number.isFinite(right) ? {
        left: left,
        right: right,
        day_count: visible_bands.length
      } : null;
    }

    /**
     * Count whole local calendar days without assuming every day is 24 hours.
     *
     * @param {Object} snapshot Prepared server-timezone geometry.
     * @param {number} start_epoch Inclusive start epoch.
     * @param {number} end_epoch Exclusive end epoch.
     * @return {number} Positive civil-day count, or zero for invalid input.
     */
    function get_full_day_interval_count(snapshot, start_epoch, end_epoch) {
      var timezone = snapshot && snapshot.accepted_identity ? snapshot.accepted_identity.timezone : '';
      var start_date = format_instant(start_epoch, timezone).slice(0, 10);
      var end_date = format_instant(end_epoch, timezone).slice(0, 10);
      var day_count = calendar_day_delta(start_date, end_date);
      return null !== day_count && 0 < day_count ? day_count : 0;
    }

    /**
     * Render bounded dashed resize fragments for every server-owned occurrence.
     *
     * Timed boundary intervals are deliberately fragmented by accepted date
     * columns. This preserves the exact wall-time shape and prevents a multi-day
     * interval from becoming one horizontal bounding rectangle.
     *
     * @param {Object} gesture Active resize gesture.
     * @param {Object} resize_projection Local presentation projection.
     * @return {void}
     */
    function render_resize_ghosts(gesture, resize_projection) {
      var renderer = get_template('ghost');
      var snapshot = gesture.context.snapshot;
      var occurrence_count = resize_projection.intervals.length;
      var is_full_day = 'all_day' === gesture.context.selection_kind;
      var booking_column_gutter_px = is_full_day ? 0 : Math.max(0, Number(gesture.context.booking_column_gutter_px) || 0);
      var presentations = [];
      if (!renderer) {
        return;
      }
      gesture.ghosts = gesture.ghosts || [];
      resize_projection.intervals.forEach(function (interval) {
        var full_day_range = is_full_day ? get_full_day_visual_range(snapshot, interval.start_epoch, interval.end_epoch) : null;
        var timed_fragments = is_full_day ? [] : get_timed_resize_visual_fragments(snapshot, interval.start_epoch, interval.end_epoch);
        var labels;
        var largest_height;
        var duration_index;
        var start_index;
        var end_index;
        labels = is_full_day ? {
          start: '',
          end: '',
          duration: String(i18n.resize_duration_days || '%s days').replace('%s', get_full_day_interval_count(snapshot, interval.start_epoch, interval.end_epoch))
        } : build_resize_range_labels(interval, snapshot);
        if (1 < occurrence_count) {
          labels.duration += ' ' + String(i18n.resize_group || '%s occurrences').replace('%s', occurrence_count);
        }
        if (is_full_day) {
          if (full_day_range) {
            presentations.push({
              left: full_day_range.left,
              top: Math.max(0, gesture.card_rect.top - gesture.context.surface.getBoundingClientRect().top),
              width: full_day_range.right - full_day_range.left,
              height: gesture.card_rect.height,
              start_label: '',
              duration_label: labels.duration,
              end_label: '',
              active_boundary: ''
            });
          }
          return;
        }
        start_index = timed_fragments.findIndex(function (candidate) {
          return candidate.start_boundary_visible;
        });
        end_index = timed_fragments.findIndex(function (candidate) {
          return candidate.end_boundary_visible;
        });
        largest_height = timed_fragments.length ? Math.max.apply(null, timed_fragments.map(function (candidate) {
          return candidate.height;
        })) : 0;
        duration_index = timed_fragments.findIndex(function (candidate) {
          return candidate.height === largest_height;
        });
        timed_fragments.forEach(function (fragment, fragment_index) {
          var column_gutter = Math.min(booking_column_gutter_px, Math.max(0, (fragment.width - 2) / 2));
          var active_boundary = 'resize_start' === gesture.operation && fragment.start_boundary_visible ? 'start' : 'resize_end' === gesture.operation && fragment.end_boundary_visible ? 'end' : '';
          presentations.push({
            left: fragment.left + column_gutter,
            top: fragment.top,
            width: Math.max(2, fragment.width - column_gutter * 2),
            height: fragment.height,
            start_label: fragment_index === start_index ? labels.start : '',
            duration_label: fragment_index === duration_index ? labels.duration : '',
            end_label: fragment_index === end_index ? labels.end : '',
            active_boundary: active_boundary
          });
        });
      });
      presentations.forEach(function (presentation, index) {
        var model_key = presentation.active_boundary + '|' + (presentation.start_label ? 'start' : '') + '|' + (presentation.duration_label ? 'duration' : '') + '|' + (presentation.end_label ? 'end' : '');
        var ghost = gesture.ghosts[index];
        var buffer;
        var start_label_element;
        var duration_label_element;
        var end_label_element;
        if (!ghost || ghost.wpbc_model_key !== model_key) {
          if (ghost) {
            ghost.remove();
          }
          buffer = document.createElement('span');
          buffer.innerHTML = renderer({
            start_label: presentation.start_label,
            duration_label: presentation.duration_label,
            end_label: presentation.end_label,
            show_start: 'start' === presentation.active_boundary,
            show_end: 'end' === presentation.active_boundary
          });
          ghost = buffer.firstElementChild;
          if (!ghost) {
            return;
          }
          ghost.classList.add('is-resize');
          ghost.wpbc_model_key = model_key;
          gesture.context.surface.appendChild(ghost);
          gesture.ghosts[index] = ghost;
        }
        start_label_element = ghost.querySelector ? ghost.querySelector('[data-wpbc-timeline-time-rows-resize-start-label]') : null;
        duration_label_element = ghost.querySelector ? ghost.querySelector('[data-wpbc-timeline-time-rows-resize-duration]') : null;
        end_label_element = ghost.querySelector ? ghost.querySelector('[data-wpbc-timeline-time-rows-resize-end-label]') : null;
        if (start_label_element) {
          start_label_element.textContent = presentation.start_label;
        }
        if (duration_label_element) {
          duration_label_element.textContent = presentation.duration_label;
        }
        if (end_label_element) {
          end_label_element.textContent = presentation.end_label;
        }
        ghost.style.left = Math.max(0, presentation.left) + 'px';
        ghost.style.top = Math.max(0, presentation.top) + 'px';
        ghost.style.width = Math.max(2, Math.min(snapshot.inline_extent - Math.max(0, presentation.left), presentation.width)) + 'px';
        ghost.style.height = Math.max(2, Math.min(snapshot.block_extent_px - Math.max(0, presentation.top), presentation.height)) + 'px';
      });
      while (gesture.ghosts.length > presentations.length) {
        gesture.ghosts.pop().remove();
      }
    }

    /**
     * Announce gesture status through the selected card's fixed live region.
     *
     * @param {Object} gesture Active gesture state.
     * @param {string} message Authorized localized message.
     * @return {void}
     */
    function announce_gesture(gesture, message) {
      var status = gesture && gesture.registration && gesture.registration.card ? gesture.registration.card.querySelector('[data-wpbc-timeline-time-rows-movement-status]') : null;
      if (status) {
        status.textContent = String(message || '');
      }
    }

    /**
     * Mark only the currently authorized cross-Resource destination surface.
     *
     * @param {Object} gesture Active movement gesture.
     * @param {Element|null} surface Current accepted target surface.
     * @param {boolean} is_cross_resource Whether the target changes Resource.
     * @return {void}
     */
    function set_gesture_target_surface(gesture, surface, is_cross_resource) {
      if (gesture.target_surface && gesture.target_surface.classList) {
        gesture.target_surface.classList.remove('is-time-rows-movement-target');
      }
      gesture.target_surface = surface || null;
      if (is_cross_resource && surface && surface.classList) {
        surface.classList.add('is-time-rows-movement-target');
      }
    }

    /**
     * Resolve the visual translation between two geometry cells.
     *
     * @param {Object} gesture Active gesture state.
     * @return {Object} Physical inline and block deltas.
     */
    function get_visual_delta(gesture) {
      var origin_snapshot = gesture.context.snapshot;
      var current_snapshot = gesture.current_context ? gesture.current_context.snapshot : origin_snapshot;
      var origin_column = origin_snapshot.date_columns[origin_snapshot.date_order[gesture.origin.date]];
      var current_column = current_snapshot.date_columns[current_snapshot.date_order[gesture.current.date]];
      var logical_delta = current_column.logical_start - origin_column.logical_start;
      return {
        inline: 'rtl' === current_snapshot.direction ? -logical_delta : logical_delta,
        block: 'timed' === gesture.context.selection_kind ? (gesture.current.wall_minute - gesture.origin.wall_minute) * current_snapshot.pixels_per_minute : 0
      };
    }

    /**
     * Position one movement ghost inside a different authorized Resource.
     *
     * @param {Object} gesture Active cross-Resource movement gesture.
     * @return {boolean} True when target geometry was available.
     */
    function position_cross_resource_movement_ghost(gesture) {
      var movement = gesture.eligibility.movement;
      var context = gesture.current_context;
      var snapshot = context.snapshot;
      var point;
      var end_point;
      var duration_seconds;
      var date_delta;
      var shifted_dates;
      var start_band;
      var end_band;
      var full_day_range;
      if ('full_day' === movement.time_application) {
        date_delta = calendar_day_delta(gesture.origin.date, gesture.current.date);
        shifted_dates = null === date_delta ? [] : movement.selected_dates.map(function (date) {
          return shift_date(date, date_delta);
        });
        start_band = shifted_dates.length ? snapshot.bands_by_date[shifted_dates[0]] : null;
        end_band = shifted_dates.length ? snapshot.bands_by_date[shifted_dates[shifted_dates.length - 1]] : null;
        full_day_range = start_band && end_band ? get_full_day_visual_range(snapshot, start_band.start_epoch, end_band.end_epoch) : null;
        if (!full_day_range) {
          return false;
        }
        gesture.ghost.style.left = full_day_range.left + 'px';
        gesture.ghost.style.top = Math.max(0, gesture.card_rect.top - gesture.context.surface.getBoundingClientRect().top) + 'px';
        gesture.ghost.style.width = Math.max(2, full_day_range.right - full_day_range.left) + 'px';
        gesture.ghost.style.height = gesture.card_rect.height + 'px';
        gesture.ghost.style.transform = 'none';
        return true;
      }
      point = get_resize_visual_point(snapshot, gesture.current.epoch);
      duration_seconds = movement.exact_intervals.length ? (Date.parse(movement.exact_intervals[0].end) - Date.parse(movement.exact_intervals[0].start)) / 1000 : 0;
      end_point = 0 < duration_seconds ? get_resize_visual_point(snapshot, gesture.current.epoch + duration_seconds) : null;
      if (!point) {
        return false;
      }
      gesture.ghost.style.left = point.left + 4 + 'px';
      gesture.ghost.style.top = Math.max(0, point.top) + 'px';
      gesture.ghost.style.width = Math.max(2, point.width - 8) + 'px';
      gesture.ghost.style.height = end_point && end_point.date === point.date ? Math.max(2, end_point.top - point.top) + 'px' : gesture.card_rect.height + 'px';
      gesture.ghost.style.transform = 'none';
      return true;
    }

    /**
     * Render or update the presentation-only proposal ghost.
     *
     * @param {Object} gesture Active gesture state.
     * @return {void}
     */
    function render_gesture_ghost(gesture) {
      var renderer = get_template('ghost');
      var buffer;
      var delta;
      var time_label;
      var resize_projection;
      if (!renderer || !gesture.current || 'exact' !== gesture.current.status) {
        return;
      }
      if ('resize' === gesture.gesture_type) {
        resize_projection = build_resize_projection(gesture);
        if (resize_projection) {
          gesture.resize_projection = resize_projection;
          render_resize_ghosts(gesture, resize_projection);
        }
        return;
      }
      if (!gesture.ghost) {
        buffer = document.createElement('span');
        time_label = String(gesture.current.date) + ('timed' === gesture.context.selection_kind ? ' ' + String(Math.floor(gesture.current.wall_minute / 60)).padStart(2, '0') + ':' + String(gesture.current.wall_minute % 60).padStart(2, '0') : '');
        buffer.innerHTML = renderer({
          label: time_label
        });
        gesture.ghost = buffer.firstElementChild;
        if (!gesture.ghost) {
          return;
        }
        gesture.ghost.style.left = gesture.card_rect.left - gesture.context.surface.getBoundingClientRect().left + 'px';
        gesture.ghost.style.top = gesture.card_rect.top - gesture.context.surface.getBoundingClientRect().top + 'px';
        gesture.ghost.style.width = gesture.card_rect.width + 'px';
        gesture.ghost.style.height = gesture.card_rect.height + 'px';
      }
      if (gesture.ghost.parentNode !== gesture.current_context.surface) {
        gesture.current_context.surface.appendChild(gesture.ghost);
      }
      if (gesture.target_resource_id !== gesture.registration.resource_id) {
        position_cross_resource_movement_ghost(gesture);
        return;
      }
      delta = get_visual_delta(gesture);
      gesture.ghost.style.left = gesture.card_rect.left - gesture.context.surface.getBoundingClientRect().left + 'px';
      gesture.ghost.style.top = gesture.card_rect.top - gesture.context.surface.getBoundingClientRect().top + 'px';
      gesture.ghost.style.width = gesture.card_rect.width + 'px';
      gesture.ghost.style.height = gesture.card_rect.height + 'px';
      gesture.ghost.style.transform = 'translate3d(' + delta.inline + 'px, ' + delta.block + 'px, 0)';
    }

    /**
     * Commit one coalesced gesture visual update.
     *
     * @return {void}
     */
    function flush_gesture_frame() {
      var gesture = active_gesture;
      var target_context;
      var target_resource_id;
      var target_is_cross_resource;
      var resolved;
      var proposed_time;
      gesture_frame = 0;
      if (!gesture || !gesture.pending_coordinate || !is_registration_current(gesture.registration)) {
        return;
      }
      target_context = gesture.pending_context || gesture.context;
      target_resource_id = normalize_positive_integer(gesture.pending_target_resource_id) || gesture.registration.resource_id;
      target_is_cross_resource = 'movement' === gesture.gesture_type && target_resource_id !== gesture.registration.resource_id;
      if (!is_gesture_context_current(target_context)) {
        gesture.pending_coordinate = null;
        gesture.pending_context = null;
        set_gesture_target_surface(gesture, null, false);
        announce_gesture(gesture, i18n.outside_unavailable);
        return;
      }
      resolved = 'resize' === gesture.gesture_type && 'timed' === target_context.selection_kind && 'relative_resize' === gesture.pending_coordinate.source && geometry && 'function' === typeof geometry.resolve_wall_time ? geometry.resolve_wall_time(target_context.snapshot, gesture.pending_coordinate.date, gesture.pending_coordinate.wall_minute, '') : geometry.resolve_coordinate(target_context.snapshot, gesture.pending_coordinate);
      if ('resize' === gesture.gesture_type && 'all_day' === target_context.selection_kind) {
        resolved = resolve_full_day_target_boundary(target_context.snapshot, resolved, gesture.operation);
      }
      gesture.current = resolved;
      gesture.current_context = target_context;
      gesture.target_resource_id = target_resource_id;
      gesture.pending_coordinate = null;
      gesture.pending_context = null;
      gesture.pending_target_resource_id = 0;
      if (!gesture.current || 'exact' !== gesture.current.status) {
        set_gesture_target_surface(gesture, null, false);
        announce_gesture(gesture, 'gap' === (gesture.current && gesture.current.status) ? i18n.gap_unavailable : 'fold' === (gesture.current && gesture.current.status) ? i18n.fold_unavailable : i18n.outside_unavailable);
        return;
      }
      set_gesture_target_surface(gesture, target_context.surface, target_is_cross_resource);
      render_gesture_ghost(gesture);
      proposed_time = 'all_day' === target_context.selection_kind ? '' : String(Math.floor(gesture.current.wall_minute / 60)).padStart(2, '0') + ':' + String(gesture.current.wall_minute % 60).padStart(2, '0');
      if ('resize' === gesture.gesture_type) {
        announce_gesture(gesture, String(('all_day' === target_context.selection_kind ? i18n.resize_proposal_changed_all_day : i18n.resize_proposal_changed) || '').replace(/%1?\$?s/, gesture.current.date).replace('%2$s', proposed_time) + (1 < gesture.eligibility.resize.affected_intervals.length ? ' ' + String(i18n.resize_group_explanation || '') : ''));
        return;
      }
      if (target_is_cross_resource) {
        announce_gesture(gesture, String(('all_day' === target_context.selection_kind ? i18n.cross_resource_changed_all_day : i18n.cross_resource_changed) || '').replace('%1$s', String(target_resource_id)).replace('%2$s', gesture.current.date).replace('%3$s', proposed_time));
        return;
      }
      announce_gesture(gesture, String(('all_day' === target_context.selection_kind ? i18n.proposal_changed_all_day : i18n.proposal_changed) || '').replace(/%1?\$?s/, gesture.current.date).replace('%2$s', proposed_time) + (1 < gesture.eligibility.movement.selected_dates.length ? ' ' + String(i18n.group_shift || '') : ''));
    }

    /**
     * Schedule at most one visual update per animation frame.
     *
     * @return {void}
     */
    function schedule_gesture_frame() {
      if (gesture_frame) {
        return;
      }
      if ('function' !== typeof window.requestAnimationFrame) {
        flush_gesture_frame();
        return;
      }
      gesture_frame = window.requestAnimationFrame(flush_gesture_frame);
    }

    /**
     * Release one transient gesture and optionally restore its grip focus.
     *
     * @param {boolean} restore_focus Whether to restore focus to the movement grip.
     * @param {string}  message       Optional localized status announcement.
     * @return {void}
     */
    function cancel_gesture(restore_focus, message) {
      var gesture = active_gesture;
      if (gesture_frame && 'function' === typeof window.cancelAnimationFrame) {
        window.cancelAnimationFrame(gesture_frame);
      }
      gesture_frame = 0;
      active_gesture = null;
      if (!gesture) {
        return;
      }
      if (gesture.pointer_id && gesture.grip && 'function' === typeof gesture.grip.releasePointerCapture) {
        try {
          gesture.grip.releasePointerCapture(gesture.pointer_id);
        } catch (error) {
          // Pointer capture may already be released by the browser.
        }
      }
      if (gesture.ghost) {
        gesture.ghost.remove();
      }
      set_gesture_target_surface(gesture, null, false);
      (gesture.ghosts || []).forEach(function (ghost) {
        if (ghost) {
          ghost.remove();
        }
      });
      gesture.registration.card.classList.remove('is-time-rows-moving');
      gesture.registration.card.classList.remove('is-time-rows-resizing');
      if (callbacks.set_interaction_suspended) {
        callbacks.set_interaction_suspended(false, gesture.registration.card);
      }
      if (callbacks.set_axis_window_loading_locked) {
        callbacks.set_axis_window_loading_locked(false);
      }
      announce_gesture(gesture, message || '');
      if (restore_focus && gesture.grip && gesture.grip.isConnected) {
        gesture.grip.focus();
      }
    }

    /**
     * Find the current projected card and restore accessible focus after Review.
     *
     * @param {number} booking_id Canonical booking ID.
     * @param {string} operation  Optional resize operation to restore.
     * @return {boolean} True when a current projected control received focus.
     */
    function restore_projected_focus(booking_id, operation) {
      var registration = Object.keys(registrations_by_render_id).map(function (render_id) {
        return registrations_by_render_id[render_id];
      }).find(function (candidate) {
        return candidate.booking_id === Number(booking_id) && is_registration_current(candidate) && !candidate.is_overflowed;
      });
      var operation_selector = -1 !== ['resize_start', 'resize_end'].indexOf(String(operation || '')) ? '[data-wpbc-timeline-time-rows-resize-operation="' + String(operation) + '"]' : '';
      var focus_target = registration && registration.card ? registration.card.querySelector(operation_selector || movement_grip_selector + ', [data-wpbc-timeline-booking-select]') : null;
      if (!focus_target) {
        return false;
      }
      focus_target.focus();
      return true;
    }

    /**
     * Finish a valid gesture by handing its proposal to canonical Review.
     *
     * @return {void}
     */
    function complete_gesture() {
      var gesture = active_gesture;
      var proposal;
      var review_state;
      var resize_projection;
      if (!gesture) {
        return;
      }
      if (gesture.pending_coordinate) {
        flush_gesture_frame();
      }
      resize_projection = 'resize' === gesture.gesture_type && gesture.current && 'exact' === gesture.current.status ? build_resize_projection(gesture) : null;
      proposal = 'resize' === gesture.gesture_type ? resize_projection ? resize_projection.proposal : null : gesture.current && 'exact' === gesture.current.status ? build_movement_proposal(gesture) : null;
      review_state = {
        card: gesture.registration.card,
        focus: gesture.grip,
        segment_id: gesture.registration.segment_id,
        visible_start: gesture.registration.visible_start,
        visible_end: gesture.registration.visible_end,
        resize_context: 'resize' === gesture.gesture_type ? gesture.eligibility.resize : null,
        canvas_scroll: gesture.canvas ? gesture.canvas.scrollLeft : 0,
        doc_x: window.scrollX,
        doc_y: window.scrollY,
        restore_focus: restore_projected_focus,
        on_source_stale: reload_selected_eligibility
      };
      cancel_gesture(false, '');
      if (!proposal) {
        if (gesture.grip && gesture.grip.isConnected) {
          gesture.grip.focus();
        }
        announce_gesture(gesture, 'resize' === gesture.gesture_type ? i18n.resize_no_change : i18n.no_change);
        return;
      }
      if ('resize' === gesture.gesture_type) {
        if (!callbacks.review_booking_resize_proposal || !callbacks.review_booking_resize_proposal(proposal, review_state)) {
          announce_gesture(gesture, i18n.resize_review_unavailable);
          if (gesture.grip && gesture.grip.isConnected) {
            gesture.grip.focus();
          }
        }
        return;
      }
      if (!callbacks.review_booking_movement_proposal || !callbacks.review_booking_movement_proposal(proposal, review_state)) {
        announce_gesture(gesture, i18n.review_unavailable);
        if (gesture.grip && gesture.grip.isConnected) {
          gesture.grip.focus();
        }
      }
    }

    /**
     * Begin a pointer or keyboard proposal from fresh accepted eligibility.
     *
     * @param {Object}      registration Canonical projected registration.
     * @param {HTMLElement} grip         Authorized movement grip.
     * @param {string}      input_mode   pointer or keyboard.
     * @param {Object}      coordinate   Initial geometry coordinate.
     * @param {number}      pointer_id   Pointer identifier, or zero.
     * @return {boolean} True when the gesture started.
     */
    function begin_gesture(registration, grip, input_mode, coordinate, pointer_id) {
      var eligibility = eligibility_cache[registration.canonical_key];
      var gesture_context;
      var target_contexts;
      var origin;
      if (active_gesture || !eligibility || eligibility.error || !eligibility.movement.same_resource && (!cross_resource_movement_enabled || !eligibility.movement.cross_resource) || 'horizontal' === registration.interaction_axis && !full_day_movement_enabled || !is_registration_current(registration) || callbacks.can_start_interaction && !callbacks.can_start_interaction()) {
        return false;
      }
      gesture_context = prepare_gesture_context(registration);
      origin = gesture_context ? geometry.resolve_coordinate(gesture_context.snapshot, coordinate) : null;
      if (!origin || 'exact' !== origin.status) {
        return false;
      }
      target_contexts = Object.create(null);
      target_contexts[registration.resource_id] = gesture_context;
      active_gesture = {
        gesture_type: 'movement',
        operation: '',
        registration: registration,
        eligibility: eligibility,
        context: gesture_context,
        current_context: gesture_context,
        target_contexts: target_contexts,
        target_resource_id: registration.resource_id,
        target_surface: gesture_context.surface,
        origin: origin,
        current: origin,
        pending_coordinate: null,
        input_mode: input_mode,
        pointer_id: pointer_id,
        grip: grip,
        ghost: null,
        card_rect: registration.card.getBoundingClientRect(),
        canvas: mount.querySelector ? mount.querySelector('[data-wpbc-timeline-canvas]') : null
      };
      registration.card.classList.add('is-time-rows-moving');
      if (callbacks.set_interaction_suspended) {
        callbacks.set_interaction_suspended(true, registration.card);
      }
      if (callbacks.set_axis_window_loading_locked) {
        callbacks.set_axis_window_loading_locked(true);
      }
      announce_gesture(active_gesture, 'keyboard' === input_mode ? i18n.keyboard_started : !eligibility.movement.same_resource && eligibility.movement.cross_resource ? i18n.cross_resource_started : i18n.gesture_started);
      return true;
    }

    /**
     * Begin a pointer resize from one fresh server-authorized vertical boundary.
     *
     * @param {Object}      registration Canonical projected registration.
     * @param {HTMLElement} handle       Authorized boundary control.
     * @param {string}      operation    resize_start or resize_end.
     * @param {number}      pointer_id   Pointer identifier.
     * @param {number}      pointer_y    Initial physical block-axis coordinate.
     * @return {boolean} True when the resize gesture started.
     */
    function begin_resize_gesture(registration, handle, operation, pointer_id, pointer_y) {
      var eligibility = eligibility_cache[registration.canonical_key];
      var gesture_context;
      var boundary_instant;
      var origin;
      if (active_gesture || 'horizontal' === registration.interaction_axis && !full_day_resize_enabled || !eligibility || eligibility.error || !eligibility.resize.allowed || 'resize_start' === operation && !eligibility.resize.start || 'resize_end' === operation && !eligibility.resize.end || -1 === ['resize_start', 'resize_end'].indexOf(operation) || !Number.isFinite(pointer_y) || !is_registration_current(registration) || callbacks.can_start_interaction && !callbacks.can_start_interaction()) {
        return false;
      }
      gesture_context = prepare_gesture_context(registration);
      boundary_instant = 'resize_start' === operation ? eligibility.resize.immutable_interval.start : eligibility.resize.immutable_interval.end;
      origin = gesture_context ? 'all_day' === gesture_context.selection_kind ? resolve_full_day_instant_boundary(gesture_context.snapshot, boundary_instant, operation) : resolve_instant_boundary(gesture_context.snapshot, boundary_instant) : null;
      if (!origin) {
        return false;
      }
      active_gesture = {
        gesture_type: 'resize',
        operation: operation,
        registration: registration,
        eligibility: eligibility,
        context: gesture_context,
        current_context: gesture_context,
        target_resource_id: registration.resource_id,
        target_surface: gesture_context.surface,
        origin: origin,
        current: origin,
        pending_coordinate: null,
        input_mode: 'pointer',
        pointer_id: pointer_id,
        pointer_start_client_y: pointer_y,
        grip: handle,
        ghost: null,
        ghosts: [],
        resize_projection: null,
        card_rect: registration.card.getBoundingClientRect(),
        canvas: mount.querySelector ? mount.querySelector('[data-wpbc-timeline-canvas]') : null
      };
      registration.card.classList.add('is-time-rows-resizing');
      if (callbacks.set_interaction_suspended) {
        callbacks.set_interaction_suspended(true, registration.card);
      }
      if (callbacks.set_axis_window_loading_locked) {
        callbacks.set_axis_window_loading_locked(true);
      }
      announce_gesture(active_gesture, i18n.resize_gesture_started);
      return true;
    }

    /**
     * Resolve an authorized grip back to its retained canonical registration.
     *
     * @param {Element} grip Movement grip inside a registered projected card.
     * @return {Object|null} Current registration or null.
     */
    function find_registration_for_grip(grip) {
      return Object.keys(registrations_by_render_id).map(function (render_id) {
        return registrations_by_render_id[render_id];
      }).find(function (registration) {
        return registration.card && registration.card.contains && registration.card.contains(grip) && is_registration_current(registration);
      }) || null;
    }

    /**
     * Build the initial keyboard cell from canonical saved schedule context.
     *
     * @param {Object} registration Current canonical registration.
     * @param {Object} eligibility  Fresh accepted eligibility.
     * @return {Object|null} Keyboard coordinate or null outside coverage.
     */
    function get_keyboard_origin_coordinate(registration, eligibility) {
      var gesture_context = prepare_gesture_context(registration);
      var movement = eligibility && eligibility.movement ? eligibility.movement : {};
      var exact_start = movement.exact_intervals && movement.exact_intervals[0] ? movement.exact_intervals[0].start : '';
      var start_match = String(exact_start).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):00/);
      var date = 'full_day' === movement.time_application ? String(movement.selected_dates[0] || '') : start_match ? start_match[1] : '';
      var wall_minute = start_match ? Number(start_match[2]) * 60 + Number(start_match[3]) : 0;
      var snap_index;
      if (!gesture_context || !gesture_context.snapshot.bands_by_date[date]) {
        return null;
      }
      snap_index = 'all_day' === gesture_context.selection_kind ? 0 : Math.round((wall_minute - gesture_context.snapshot.visible_range.start_minute) / gesture_context.snapshot.selection_step_minutes);
      return keyboard_coordinate(gesture_context.snapshot, gesture_context.selection_kind, date, snap_index);
    }

    /**
     * Start Pointer Events movement only from an authorized grip.
     *
     * @param {PointerEvent} event Captured pointerdown event.
     * @return {void}
     */
    function handle_pointer_down(event) {
      var resize_handle = event.target && event.target.closest ? event.target.closest(resize_handle_selector) : null;
      var grip = !resize_handle && event.target && event.target.closest ? event.target.closest(movement_grip_selector) : null;
      var operation = resize_handle ? String(resize_handle.getAttribute('data-wpbc-timeline-time-rows-resize-operation') || '') : '';
      var control = resize_handle || grip;
      var registration = control ? find_registration_for_grip(control) : null;
      var surface;
      var surface_rect;
      var coordinate;
      if (!registration || Number.isFinite(Number(event.button)) && 0 !== Number(event.button)) {
        return;
      }
      if (resize_handle) {
        if (!begin_resize_gesture(registration, resize_handle, operation, Number(event.pointerId) || 0, Number(event.clientY))) {
          return;
        }
        if ('function' === typeof resize_handle.setPointerCapture && event.pointerId) {
          try {
            resize_handle.setPointerCapture(event.pointerId);
          } catch (error) {
            // Document listeners still own completion when capture is unavailable.
          }
        }
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      surface = registration.card.closest('vertical' === registration.interaction_axis ? timed_surface_selector : all_day_surface_selector);
      if (!surface) {
        return;
      }
      surface_rect = surface.getBoundingClientRect();
      coordinate = {
        source: 'pointer',
        selection_kind: 'vertical' === registration.interaction_axis ? 'timed' : 'all_day',
        inline_px: Number(event.clientX) - surface_rect.left,
        block_px: Number(event.clientY) - surface_rect.top
      };
      if (!begin_gesture(registration, grip, 'pointer', coordinate, Number(event.pointerId) || 0)) {
        return;
      }
      if ('function' === typeof grip.setPointerCapture && event.pointerId) {
        try {
          grip.setPointerCapture(event.pointerId);
        } catch (error) {
          // Capture is an optimization; document listeners still own completion.
        }
      }
      event.preventDefault();
      event.stopPropagation();
    }

    /**
     * Update one active pointer gesture through a coalesced visual frame.
     *
     * @param {PointerEvent} event Pointer move event.
     * @return {void}
     */
    function handle_pointer_move(event) {
      var target;
      if (!active_gesture || 'pointer' !== active_gesture.input_mode || Number(event.pointerId) !== active_gesture.pointer_id) {
        return;
      }
      if ('movement' === active_gesture.gesture_type) {
        target = resolve_pointer_movement_target(active_gesture, event);
        active_gesture.pending_coordinate = target ? target.coordinate : null;
        active_gesture.pending_context = target ? target.context : null;
        active_gesture.pending_target_resource_id = target ? target.resource_id : 0;
        if (!target) {
          set_gesture_target_surface(active_gesture, null, false);
          announce_gesture(active_gesture, i18n.outside_unavailable);
        }
      } else {
        active_gesture.pending_coordinate = 'timed' === active_gesture.context.selection_kind ? timed_resize_pointer_coordinate(active_gesture, event) : pointer_coordinate(active_gesture.context, event);
        active_gesture.pending_context = active_gesture.context;
        active_gesture.pending_target_resource_id = active_gesture.registration.resource_id;
      }
      schedule_gesture_frame();
      event.preventDefault();
    }

    /**
     * Complete the active pointer proposal after its final exact coordinate.
     *
     * @param {PointerEvent} event Pointer completion event.
     * @return {void}
     */
    function handle_pointer_up(event) {
      var target;
      if (!active_gesture || 'pointer' !== active_gesture.input_mode || Number(event.pointerId) !== active_gesture.pointer_id) {
        return;
      }
      if ('movement' === active_gesture.gesture_type) {
        target = resolve_pointer_movement_target(active_gesture, event);
        if (!target) {
          event.preventDefault();
          cancel_gesture(true, i18n.cancelled);
          return;
        }
        active_gesture.pending_coordinate = target.coordinate;
        active_gesture.pending_context = target.context;
        active_gesture.pending_target_resource_id = target.resource_id;
      } else {
        active_gesture.pending_coordinate = 'timed' === active_gesture.context.selection_kind ? timed_resize_pointer_coordinate(active_gesture, event) : pointer_coordinate(active_gesture.context, event);
        active_gesture.pending_context = active_gesture.context;
        active_gesture.pending_target_resource_id = active_gesture.registration.resource_id;
      }
      complete_gesture();
      event.preventDefault();
    }

    /**
     * Cancel a pointer whose ownership was lost before canonical Review.
     *
     * @param {PointerEvent} event Pointer cancellation event.
     * @return {void}
     */
    function handle_pointer_cancel(event) {
      if (active_gesture && 'pointer' === active_gesture.input_mode && Number(event.pointerId) === active_gesture.pointer_id) {
        cancel_gesture(true, 'resize' === active_gesture.gesture_type ? i18n.resize_cancelled : i18n.cancelled);
      }
    }

    /**
     * Operate the accessible keyboard movement state machine.
     *
     * @param {KeyboardEvent} event Keydown event.
     * @return {void}
     */
    function handle_keydown(event) {
      var resize_handle = event.target && event.target.closest ? event.target.closest(resize_handle_selector) : null;
      var grip = !resize_handle && event.target && event.target.closest ? event.target.closest(movement_grip_selector) : null;
      var resize_registration = resize_handle ? find_registration_for_grip(resize_handle) : null;
      var registration = grip ? find_registration_for_grip(grip) : null;
      var eligibility;
      var origin_coordinate;
      var snapshot;
      var date_index;
      var date_delta = 0;
      var snap_delta = 0;
      if (active_gesture && 'Escape' === event.key) {
        event.preventDefault();
        cancel_gesture(true, 'resize' === active_gesture.gesture_type ? i18n.resize_cancelled : i18n.cancelled);
        return;
      }
      if (!active_gesture && resize_handle && resize_registration && ('Enter' === event.key || ' ' === event.key)) {
        event.preventDefault();
        event.stopPropagation();
        if (callbacks.open_booking_full_reschedule) {
          callbacks.open_booking_full_reschedule(resize_registration.card, resize_handle);
        }
        return;
      }
      if (active_gesture && 'keyboard' === active_gesture.input_mode) {
        if ('Enter' === event.key || ' ' === event.key) {
          event.preventDefault();
          complete_gesture();
          return;
        }
        if (-1 === ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(event.key)) {
          return;
        }
        event.preventDefault();
        snapshot = active_gesture.context.snapshot;
        date_delta = 'ArrowLeft' === event.key ? -1 : 'ArrowRight' === event.key ? 1 : 0;
        if ('rtl' === snapshot.direction) {
          date_delta *= -1;
        }
        snap_delta = 'ArrowUp' === event.key ? -1 : 'ArrowDown' === event.key ? 1 : 0;
        date_index = Math.max(0, Math.min(snapshot.date_columns.length - 1, snapshot.date_order[active_gesture.current.date] + date_delta));
        active_gesture.pending_coordinate = keyboard_coordinate(snapshot, active_gesture.context.selection_kind, snapshot.date_columns[date_index].date, active_gesture.current.snap_index + snap_delta);
        flush_gesture_frame();
        return;
      }
      if (!registration || 'Enter' !== event.key && ' ' !== event.key) {
        return;
      }
      eligibility = eligibility_cache[registration.canonical_key];
      if (eligibility && !eligibility.error && !eligibility.movement.same_resource) {
        event.preventDefault();
        if (callbacks.open_booking_full_reschedule) {
          callbacks.open_booking_full_reschedule(registration.card, grip);
        }
        return;
      }
      origin_coordinate = get_keyboard_origin_coordinate(registration, eligibility);
      if (!origin_coordinate) {
        return;
      }
      event.preventDefault();
      begin_gesture(registration, grip, 'keyboard', origin_coordinate, 0);
    }

    /**
     * Resolve one server-owned resize denial into visible translated guidance.
     *
     * The fallback reason is presentation data only. Canonical resize policy
     * remains authoritative and no hidden or disabled control grants permission.
     *
     * @param {Object} eligibility Combined accepted eligibility result.
     * @return {string} User guidance or an empty string when resize is available.
     */
    function get_resize_denial_message(eligibility) {
      var reasons = i18n.resize_denial_reasons && 'object' === typeof i18n.resize_denial_reasons ? i18n.resize_denial_reasons : {};
      var resize = eligibility && eligibility.resize ? eligibility.resize : {};
      var reason = String(resize.fallback_reason || '');
      return !resize.allowed && reason ? String(reasons[reason] || i18n.denied || '') : '';
    }

    /**
     * Render controls only for independently enabled, server-authorized gestures.
     *
     * @param {Object} registration Selected canonical anchor registration.
     * @param {Object} eligibility Fresh combined eligibility result.
     * @return {void}
     */
    function render_eligibility(registration, eligibility) {
      var canonical_registrations = get_canonical_registrations(registration.canonical_key);
      var anchor_registration = canonical_registrations.filter(function (candidate) {
        return !candidate.is_overflowed;
      })[0] || registration;
      var status_id = 'wpbc-time-rows-movement-status-' + registration.booking_id + '-' + request_generation;
      var resize_denial_message = get_resize_denial_message(eligibility);
      var status_message = eligibility.error ? i18n.error : resize_denial_message || (eligibility.movement.allowed || eligibility.resize.start || eligibility.resize.end ? i18n.ready : i18n.denied);
      clear_all_registration_hosts();
      canonical_registrations.forEach(function (candidate) {
        var host = create_control_host(candidate);
        var is_anchor = candidate.render_id === anchor_registration.render_id;
        var is_timed_resize = 'vertical' === candidate.interaction_axis && -1 !== supported_timed_resize_shapes.indexOf(eligibility.resize.saved_shape);
        var is_full_day_resize = full_day_resize_enabled && 'horizontal' === candidate.interaction_axis && -1 !== supported_full_day_resize_shapes.indexOf(eligibility.resize.saved_shape);
        var show_start = !eligibility.error && eligibility.resize.allowed && (is_timed_resize || is_full_day_resize) && eligibility.resize.start && candidate.boundary_start_visible;
        var show_end = !eligibility.error && eligibility.resize.allowed && (is_timed_resize || is_full_day_resize) && eligibility.resize.end && candidate.boundary_end_visible;
        if (!host) {
          return;
        }
        if (is_anchor) {
          render_template(host, 'status', {
            status_id: status_id,
            message: status_message
          });
        }
        if (is_anchor && !eligibility.error && (eligibility.movement.same_resource || cross_resource_movement_enabled && eligibility.movement.cross_resource) && ('vertical' === candidate.interaction_axis || full_day_movement_enabled)) {
          render_template(host, 'grip', {
            label: i18n.movement_label,
            status_id: status_id,
            keyboard_instructions: 'horizontal' === candidate.interaction_axis ? i18n.full_day_keyboard_instructions : i18n.keyboard_instructions
          });
        }
        if (show_start || show_end) {
          render_template(host, 'resize_handles', {
            start: show_start,
            end: show_end,
            group_label: i18n.resize_group_label,
            start_label: i18n.resize_start_label,
            end_label: i18n.resize_end_label,
            status_id: status_id,
            keyboard_fallback: i18n.resize_keyboard_fallback
          });
        }
      });
    }

    /**
     * Render request-owned checking markers on true canonical boundaries.
     *
     * Every visible fragment receives only the marker for the canonical boundary
     * it owns. The selected anchor alone exposes the polite checking message, so
     * visual parity does not duplicate assistive announcements.
     *
     * @param {Object} registration Selected canonical registration.
     * @return {void}
     */
    function render_checking_status(registration) {
      var canonical_registrations = get_canonical_registrations(registration.canonical_key);
      var anchor_registration = canonical_registrations.filter(function (candidate) {
        return !candidate.is_overflowed;
      })[0] || registration;
      clear_all_registration_hosts();
      canonical_registrations.forEach(function (candidate) {
        var host = create_control_host(candidate);
        var is_anchor = candidate.render_id === anchor_registration.render_id;
        if (!host) {
          return;
        }
        render_template(host, 'status', {
          is_loading: true,
          show_start: candidate.boundary_start_visible,
          show_end: candidate.boundary_end_visible,
          status_id: is_anchor ? 'wpbc-time-rows-movement-status-' + registration.booking_id + '-' + request_generation : '',
          message: is_anchor ? i18n.checking : ''
        });
      });
    }

    /**
     * Complete two authoritative eligibility reads for one accepted identity.
     *
     * @param {Object} registration Selected canonical registration.
     * @return {void}
     */
    function request_eligibility(registration) {
      var movement_transport = transport.movement || {};
      var resize_transport = transport.resize || {};
      var generation;
      var remaining = 2;
      var movement_result = null;
      var resize_result = null;
      var has_error = false;
      var movement_request;
      var resize_request;
      if (!window.jQuery || !movement_transport.url || !resize_transport.url || !is_registration_current(registration)) {
        return;
      }
      if (eligibility_cache[registration.canonical_key]) {
        render_eligibility(registration, eligibility_cache[registration.canonical_key]);
        return;
      }
      abort_requests();
      generation = request_generation;
      active_request_resource_id = registration.resource_id;
      render_checking_status(registration);

      /**
       * Commit the combined result only while every identity remains current.
       *
       * @return {void}
       */
      function complete_one_request() {
        var eligibility;
        var resize_denial_message;
        remaining -= 1;
        if (remaining || generation !== request_generation || !is_registration_current(registration) || registration.canonical_key !== selected_canonical_key) {
          return;
        }
        active_requests = [];
        active_request_resource_id = 0;
        eligibility = {
          identity_key: registration.identity_key,
          movement: movement_result || {
            allowed: false,
            same_resource: false,
            cross_resource: false,
            source_context_token: ''
          },
          resize: resize_result || {
            start: false,
            end: false,
            source_context_token: ''
          },
          error: has_error || !movement_result || !resize_result
        };
        if (!eligibility.error) {
          eligibility_cache[registration.canonical_key] = eligibility;
        }
        render_eligibility(registration, eligibility);
        resize_denial_message = get_resize_denial_message(eligibility);
        if (resize_denial_message && callbacks.show_admin_message) {
          callbacks.show_admin_message(resize_denial_message, 'warning', 5000);
        }
      }
      movement_request = window.jQuery.ajax({
        url: movement_transport.url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: movement_transport.action,
          nonce: movement_transport.nonce,
          booking_id: registration.booking_id,
          source: 'timeline',
          segment_id: registration.segment_id,
          segment_resource_id: registration.resource_id,
          visible_start_at: registration.visible_start,
          visible_end_at: registration.visible_end,
          proposal_revision: 1
        }
      }).done(function (response) {
        movement_result = normalize_movement_response(response, registration);
        has_error = has_error || !movement_result;
      }).fail(function (request, request_status) {
        if ('abort' !== request_status) {
          has_error = true;
        }
      }).always(complete_one_request);
      resize_request = window.jQuery.ajax({
        url: resize_transport.url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: resize_transport.action,
          nonce: resize_transport.nonce,
          booking_id: registration.booking_id,
          source: 'timeline',
          visible_start_at: registration.visible_start,
          visible_end_at: registration.visible_end,
          source_context_token: ''
        }
      }).done(function (response) {
        resize_result = normalize_resize_response(response, registration);
        has_error = has_error || !resize_result;
      }).fail(function (request, request_status) {
        if ('abort' !== request_status) {
          has_error = true;
        }
      }).always(complete_one_request);
      active_requests = [movement_request, resize_request];
    }

    /**
     * Replace one stale source-context token with a fresh eligibility read.
     *
     * Canonical Review invokes this only after rejecting stale server state. The
     * rejected Review is never retried automatically; a new explicit gesture is
     * required after the fresh controls render.
     *
     * @param {number} booking_id Canonical booking whose source token is stale.
     * @return {void}
     */
    function reload_selected_eligibility(booking_id) {
      var registration = Object.keys(registrations_by_render_id).map(function (render_id) {
        return registrations_by_render_id[render_id];
      }).find(function (candidate) {
        return candidate.booking_id === Number(booking_id) && candidate.canonical_key === selected_canonical_key && is_registration_current(candidate);
      });
      if (!registration) {
        return;
      }
      delete eligibility_cache[registration.canonical_key];
      request_eligibility(registration);
    }

    /**
     * Resolve selected presentation identity to accepted canonical data.
     *
     * @param {Object} selection_state Booking-wide shared selection state.
     * @return {Object|null} Canonical selected registration or null.
     */
    function resolve_selected_registration(selection_state) {
      var render_id = String(selection_state && selection_state.segment_hint || '');
      var booking_id = normalize_positive_integer(selection_state && selection_state.booking_id);
      var registration = registrations_by_render_id[render_id] || null;
      if (!registration || registration.booking_id !== booking_id || !is_registration_current(registration)) {
        return null;
      }
      return registration;
    }

    /**
     * Reconcile one booking-wide selection after a projected refresh.
     *
     * @param {Object} selection_state Shared canonical-booking selection state.
     * @return {void}
     */
    function reconcile_selection(selection_state) {
      var registration = resolve_selected_registration(selection_state);
      selected_booking_id = normalize_positive_integer(selection_state && selection_state.booking_id);
      selected_render_id = String(selection_state && selection_state.segment_hint || '');
      if (!registration || is_request_loading) {
        abort_requests();
        clear_all_registration_hosts();
        selected_canonical_key = '';
        return;
      }
      selected_canonical_key = registration.canonical_key;
      request_eligibility(registration);
    }

    /**
     * Coalesce selection reconciliation across synchronous multi-Resource renders.
     *
     * @param {Object} selection_state Booking-wide shared selection state.
     * @return {void}
     */
    function schedule_selection_reconciliation(selection_state) {
      pending_selection_state = {
        booking_id: normalize_positive_integer(selection_state && selection_state.booking_id),
        segment_hint: String(selection_state && selection_state.segment_hint || '')
      };
      if (reconcile_frame) {
        return;
      }
      if ('function' !== typeof window.requestAnimationFrame) {
        reconcile_selection(pending_selection_state);
        pending_selection_state = null;
        return;
      }
      reconcile_frame = window.requestAnimationFrame(function () {
        var next_selection_state = pending_selection_state;
        reconcile_frame = 0;
        pending_selection_state = null;
        reconcile_selection(next_selection_state);
      });
    }

    /**
     * React to one shared booking selection without reading card authority.
     *
     * @param {HTMLElement} segment_element Selected rendered segment.
     * @param {Object} selection_state Booking-wide shared selection state.
     * @return {void}
     */
    function select_segment(segment_element, selection_state) {
      schedule_selection_reconciliation(selection_state);
    }

    /**
     * Complete one projected Resource refresh and reconcile current selection.
     *
     * @param {Object} refresh_context Accepted presentation refresh context.
     * @param {Object} selection_state Booking-wide shared selection state.
     * @return {void}
     */
    function complete_read_only_refresh(refresh_context, selection_state) {
      if (String(refresh_context && refresh_context.presentation_id || '') !== String(time_rows_configuration.presentation_id || '')) {
        return;
      }
      schedule_selection_reconciliation(selection_state);
    }

    /**
     * Suspend or resume eligibility presentation during canonical loading.
     *
     * @param {boolean} is_loading Whether Timeline replacement is active.
     * @return {void}
     */
    function set_request_loading(is_loading) {
      is_request_loading = true === is_loading;
      if (is_request_loading) {
        invalidate_all();
      }
    }

    /**
     * Refresh retained card registrations after Availability-only identity change.
     *
     * Booking replacement normally rebuilds cards before this listener runs.
     * Availability intentionally keeps booking cards mounted, so their canonical
     * registrations receive the new accepted identity while old eligibility is
     * discarded.
     *
     * @param {number} resource_id Resource with mounted canonical cards.
     * @param {string} identity_key New accepted identity and geometry key.
     * @return {void}
     */
    function refresh_retained_resource_identity(resource_id, identity_key) {
      var render_ids = registration_ids_by_resource[resource_id] || [];
      if (active_gesture && active_gesture.registration.resource_id === resource_id) {
        cancel_gesture(false, '');
      }
      abort_requests(resource_id);
      render_ids.forEach(function (render_id) {
        var registration = registrations_by_render_id[render_id];
        if (!registration) {
          return;
        }
        clear_registration_host(registration);
        delete eligibility_cache[registration.canonical_key];
        registration.identity_key = identity_key;
        registration.canonical_key = build_canonical_key(identity_key, registration.booking_id, registration.resource_id, registration.segment_id, registration.visible_start, registration.visible_end);
      });
      refresh_identity_by_resource[resource_id] = identity_key;
      selected_canonical_key = '';
    }

    /**
     * Invalidate only registrations whose accepted identity is now stale.
     *
     * @return {void}
     */
    function handle_accepted_data_replacement() {
      Object.keys(refresh_identity_by_resource).forEach(function (resource_id) {
        var numeric_resource_id = normalize_positive_integer(resource_id);
        var live_identity_key = build_accepted_identity_key(get_live_interaction_context(numeric_resource_id), selection_step_minutes);
        if (!live_identity_key) {
          invalidate_resource(numeric_resource_id, false);
          return;
        }
        if (live_identity_key !== refresh_identity_by_resource[numeric_resource_id]) {
          refresh_retained_resource_identity(numeric_resource_id, live_identity_key);
        }
      });
      if (selected_booking_id && selected_render_id) {
        schedule_selection_reconciliation({
          booking_id: selected_booking_id,
          segment_hint: selected_render_id
        });
      }
    }

    /**
     * Release one removed or closed Resource projection.
     *
     * @param {CustomEvent} event Presentation lifecycle event.
     * @return {void}
     */
    function handle_presentation_removed(event) {
      var detail = event && event.detail ? event.detail : {};
      var resource_id = normalize_positive_integer(detail.resource_id);
      if (String(detail.presentation_id || '') === String(time_rows_configuration.presentation_id || '') && resource_id) {
        invalidate_resource(resource_id, false);
      }
    }

    /**
     * Cancel a proposal when the document can no longer guarantee completion.
     *
     * @return {void}
     */
    function handle_environment_loss() {
      cancel_gesture(false, '');
    }

    /**
     * Cancel when the document becomes hidden during a gesture.
     *
     * @return {void}
     */
    function handle_visibility_change() {
      if (document.hidden) {
        handle_environment_loss();
      }
    }

    /**
     * Report whether this extension currently owns gesture attention.
     *
     * @return {boolean} True during a pointer or keyboard proposal.
     */
    function is_interacting() {
      return Boolean(active_gesture);
    }

    /**
     * Accept canonical interaction callbacks after either bootstrap order.
     *
     * Booking Interactions initializes before page-level Timeline extensions in
     * production. This setter keeps the isolated adapter independent of Review,
     * Apply, and readback while allowing their neutral bridge to arrive first.
     *
     * @param {Object|null} next_callbacks Canonical interaction bridge callbacks.
     * @return {void}
     */
    function set_interaction_callbacks(next_callbacks) {
      callbacks = next_callbacks && 'object' === typeof next_callbacks ? next_callbacks : {};
    }

    /**
     * Return bounded scalar state for development evidence.
     *
     * @return {Object} Registration, cache, request, and selection counts.
     */
    function get_state_snapshot() {
      return {
        is_initialized: is_initialized,
        registration_count: Object.keys(registrations_by_render_id).length,
        resource_identity_count: Object.keys(refresh_identity_by_resource).length,
        eligibility_cache_count: Object.keys(eligibility_cache).length,
        request_count: active_requests.length,
        request_generation: request_generation,
        selected_booking_id: selected_booking_id,
        selected_render_id: selected_render_id,
        has_selected_canonical_identity: Boolean(selected_canonical_key),
        is_request_loading: is_request_loading,
        has_active_gesture: Boolean(active_gesture)
      };
    }

    /**
     * Attach accepted-data invalidation listeners.
     *
     * @return {void}
     */
    function initialize() {
      if (!mount || is_initialized) {
        return;
      }
      is_initialized = true;
      mount.addEventListener('wpbc:timeline:data:booking-windows-accepted', handle_accepted_data_replacement);
      mount.addEventListener('wpbc:timeline:data:availability-accepted', handle_accepted_data_replacement);
      mount.addEventListener('wpbc:timeline:row-presentation:closed', handle_presentation_removed);
      mount.addEventListener('wpbc:timeline:row-presentation:removed', handle_presentation_removed);
      mount.addEventListener('pointerdown', handle_pointer_down, true);
      document.addEventListener('pointermove', handle_pointer_move, {
        passive: false
      });
      document.addEventListener('pointerup', handle_pointer_up, {
        passive: false
      });
      document.addEventListener('pointercancel', handle_pointer_cancel);
      document.addEventListener('keydown', handle_keydown);
      document.addEventListener('visibilitychange', handle_visibility_change);
      window.addEventListener('blur', handle_environment_loss);
      window.addEventListener('pagehide', handle_environment_loss);
    }

    /**
     * Remove listeners, requests, accepted references, and presentation.
     *
     * @return {void}
     */
    function destroy() {
      if (!mount || !is_initialized) {
        return;
      }
      mount.removeEventListener('wpbc:timeline:data:booking-windows-accepted', handle_accepted_data_replacement);
      mount.removeEventListener('wpbc:timeline:data:availability-accepted', handle_accepted_data_replacement);
      mount.removeEventListener('wpbc:timeline:row-presentation:closed', handle_presentation_removed);
      mount.removeEventListener('wpbc:timeline:row-presentation:removed', handle_presentation_removed);
      mount.removeEventListener('pointerdown', handle_pointer_down, true);
      document.removeEventListener('pointermove', handle_pointer_move, {
        passive: false
      });
      document.removeEventListener('pointerup', handle_pointer_up, {
        passive: false
      });
      document.removeEventListener('pointercancel', handle_pointer_cancel);
      document.removeEventListener('keydown', handle_keydown);
      document.removeEventListener('visibilitychange', handle_visibility_change);
      window.removeEventListener('blur', handle_environment_loss);
      window.removeEventListener('pagehide', handle_environment_loss);
      invalidate_all();
      registrations_by_render_id = Object.create(null);
      registration_ids_by_resource = Object.create(null);
      refresh_identity_by_resource = Object.create(null);
      selected_booking_id = 0;
      selected_render_id = '';
      is_initialized = false;
    }
    return {
      initialize: initialize,
      destroy: destroy,
      begin_read_only_refresh: begin_read_only_refresh,
      register_read_only_segment: register_read_only_segment,
      complete_read_only_refresh: complete_read_only_refresh,
      select_segment: select_segment,
      set_request_loading: set_request_loading,
      invalidate_all: invalidate_all,
      get_state_snapshot: get_state_snapshot,
      is_interacting: is_interacting,
      set_interaction_callbacks: set_interaction_callbacks
    };
  }

  /**
   * Resolve the active page-local module for one neutral interaction callback.
   *
   * @return {Object|null} Current module instance or null.
   */
  function get_active_controller() {
    var modules = window.wpbc_timeline_modules;
    return modules && 'function' === typeof modules.get_instance ? modules.get_instance(module_instance_id) : null;
  }

  /**
   * Invoke one optional method on the active isolated controller.
   *
   * @param {string} method_name Stable controller method.
   * @param {Array} method_arguments Ordered callback arguments.
   * @return {*} Controller result when available.
   */
  function invoke_active_controller(method_name, method_arguments) {
    var controller = get_active_controller();
    if (controller && 'function' === typeof controller[method_name]) {
      return controller[method_name].apply(controller, method_arguments || []);
    }
    return undefined;
  }
  if (window.wpbc_timeline_modules && 'function' === typeof window.wpbc_timeline_modules.register_factory) {
    window.wpbc_timeline_modules.register_factory(module_id, create_controller);
  }
  if (window.wpbc_timeline_booking_interactions && 'function' === typeof window.wpbc_timeline_booking_interactions.register_extension_factory) {
    window.wpbc_timeline_booking_interactions.register_extension_factory(function (interaction_context) {
      var bridge_callbacks = interaction_context && interaction_context.callbacks && 'object' === typeof interaction_context.callbacks ? interaction_context.callbacks : {};
      return {
        initialize: function () {
          booking_interaction_callbacks = bridge_callbacks;
          invoke_active_controller('set_interaction_callbacks', [bridge_callbacks]);
        },
        destroy: function () {
          invoke_active_controller('set_interaction_callbacks', [null]);
          if (booking_interaction_callbacks === bridge_callbacks) {
            booking_interaction_callbacks = null;
          }
        },
        begin_refresh: function () {
          invoke_active_controller('invalidate_all', []);
        },
        begin_read_only_refresh: function (refresh_context) {
          invoke_active_controller('begin_read_only_refresh', [refresh_context]);
        },
        register_read_only_segment: function (card, segment, resource_summary, presentation_context) {
          invoke_active_controller('register_read_only_segment', [card, segment, resource_summary, presentation_context]);
        },
        complete_read_only_refresh: function (refresh_context, selection_state) {
          invoke_active_controller('complete_read_only_refresh', [refresh_context, selection_state]);
        },
        select_segment: function (segment_element, selection_state) {
          invoke_active_controller('select_segment', [segment_element, selection_state]);
        },
        set_request_loading: function (is_loading) {
          invoke_active_controller('set_request_loading', [is_loading]);
        }
      };
    });
  }
})(window, document, window.wp);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS10aW1lbGluZS90aW1lLXJvd3MtbW92ZW1lbnQvX291dC90aW1lLXJvd3MtbW92ZW1lbnQuanMiLCJuYW1lcyI6WyJ3aW5kb3ciLCJkb2N1bWVudCIsIndwIiwibW9kdWxlX2lkIiwibW9kdWxlX2luc3RhbmNlX2lkIiwiZXhhY3RfaW5zdGFudF9wYXR0ZXJuIiwidGltZWRfc3VyZmFjZV9zZWxlY3RvciIsImFsbF9kYXlfc3VyZmFjZV9zZWxlY3RvciIsImRhdGVfY29sdW1uX3NlbGVjdG9yIiwibW92ZW1lbnRfZ3JpcF9zZWxlY3RvciIsInJlc2l6ZV9oYW5kbGVfc2VsZWN0b3IiLCJzdXBwb3J0ZWRfdGltZWRfcmVzaXplX3NoYXBlcyIsInN1cHBvcnRlZF9mdWxsX2RheV9yZXNpemVfc2hhcGVzIiwidGltZV9yb3dzX3BhbmVsX3NlbGVjdG9yIiwiYm9va2luZ19pbnRlcmFjdGlvbl9jYWxsYmFja3MiLCJub3JtYWxpemVfcG9zaXRpdmVfaW50ZWdlciIsImNhbmRpZGF0ZSIsIk51bWJlciIsImlzSW50ZWdlciIsImJ1aWxkX2FjY2VwdGVkX2lkZW50aXR5X2tleSIsImNvbnRleHQiLCJzZWxlY3Rpb25fc3RlcF9taW51dGVzIiwiaWRlbnRpdHkiLCJhY2NlcHRlZF9pZGVudGl0eSIsInZpc2libGVfcmFuZ2UiLCJyZXNvdXJjZV9pZCIsIndpbmRvd19rZXlzIiwiQXJyYXkiLCJpc0FycmF5IiwiYWNjZXB0ZWRfd2luZG93X2tleXMiLCJtYXAiLCJTdHJpbmciLCJmaWx0ZXIiLCJCb29sZWFuIiwiY2FjaGVfa2V5IiwicmVzb3VyY2VfZmluZ2VycHJpbnQiLCJ0aW1lem9uZSIsImxlbmd0aCIsImlzRmluaXRlIiwic3RhcnRfbWludXRlIiwiZW5kX21pbnV0ZSIsInpvb21fcGVyY2VudCIsImJvb2tpbmdfZ2VuZXJhdGlvbiIsImF2YWlsYWJpbGl0eV9nZW5lcmF0aW9uIiwiam9pbiIsImJ1aWxkX2Nhbm9uaWNhbF9rZXkiLCJpZGVudGl0eV9rZXkiLCJib29raW5nX2lkIiwic2VnbWVudF9pZCIsInZpc2libGVfc3RhcnQiLCJ2aXNpYmxlX2VuZCIsImNyZWF0ZV9jb250cm9sbGVyIiwibW91bnQiLCJjb25maWd1cmF0aW9uIiwidGltZV9yb3dzX2NvbmZpZ3VyYXRpb24iLCJ0aW1lX3Jvd3MiLCJ0cmFuc3BvcnQiLCJ0ZW1wbGF0ZXMiLCJpMThuIiwib3B0aW9uYWxfZ2VzdHVyZXMiLCJnZW9tZXRyeSIsIndwYmNfdGltZWxpbmVfdGltZV9yb3dzX2ludGVyYWN0aW9uX2dlb21ldHJ5IiwiY2FsbGJhY2tzIiwiZnVsbF9kYXlfbW92ZW1lbnRfZW5hYmxlZCIsImZ1bGxfZGF5X21vdmVtZW50IiwiZnVsbF9kYXlfcmVzaXplX2VuYWJsZWQiLCJmdWxsX2RheV9yZXNpemUiLCJjcm9zc19yZXNvdXJjZV9tb3ZlbWVudF9lbmFibGVkIiwiY3Jvc3NfcmVzb3VyY2VfbW92ZW1lbnQiLCJyZWdpc3RyYXRpb25zX2J5X3JlbmRlcl9pZCIsIk9iamVjdCIsImNyZWF0ZSIsInJlZ2lzdHJhdGlvbl9pZHNfYnlfcmVzb3VyY2UiLCJyZWZyZXNoX2lkZW50aXR5X2J5X3Jlc291cmNlIiwiZWxpZ2liaWxpdHlfY2FjaGUiLCJhY3RpdmVfcmVxdWVzdHMiLCJhY3RpdmVfcmVxdWVzdF9yZXNvdXJjZV9pZCIsInJlcXVlc3RfZ2VuZXJhdGlvbiIsInJlY29uY2lsZV9mcmFtZSIsInBlbmRpbmdfc2VsZWN0aW9uX3N0YXRlIiwic2VsZWN0ZWRfYm9va2luZ19pZCIsInNlbGVjdGVkX3JlbmRlcl9pZCIsInNlbGVjdGVkX2Nhbm9uaWNhbF9rZXkiLCJpc19yZXF1ZXN0X2xvYWRpbmciLCJpc19pbml0aWFsaXplZCIsImFjdGl2ZV9nZXN0dXJlIiwiZ2VzdHVyZV9mcmFtZSIsImdldF90aW1lX3Jvd3NfY29udHJvbGxlciIsIm1vZHVsZXMiLCJ3cGJjX3RpbWVsaW5lX21vZHVsZXMiLCJnZXRfaW5zdGFuY2UiLCJpbnN0YW5jZV9pZCIsImdldF9saXZlX2ludGVyYWN0aW9uX2NvbnRleHQiLCJnZXRfaW50ZXJhY3Rpb25fZ2VvbWV0cnlfY29udGV4dCIsImdldF90ZW1wbGF0ZSIsInRlbXBsYXRlX3Nsb3QiLCJ0ZW1wbGF0ZV9pZCIsInRlbXBsYXRlIiwiYWJvcnRfcmVxdWVzdHMiLCJmb3JFYWNoIiwicmVxdWVzdCIsImFib3J0IiwiY2FuY2VsX3JlY29uY2lsZV9zZWxlY3Rpb24iLCJjYW5jZWxBbmltYXRpb25GcmFtZSIsImNsZWFyX3JlZ2lzdHJhdGlvbl9ob3N0IiwicmVnaXN0cmF0aW9uIiwiaG9zdHMiLCJjYXJkIiwicXVlcnlTZWxlY3RvckFsbCIsInByb3RvdHlwZSIsImNhbGwiLCJob3N0IiwicmVtb3ZlIiwiY2xlYXJfYWxsX3JlZ2lzdHJhdGlvbl9ob3N0cyIsImtleXMiLCJyZW5kZXJfaWQiLCJpbnZhbGlkYXRlX2FsbCIsImNhbmNlbF9nZXN0dXJlIiwiaW52YWxpZGF0ZV9yZXNvdXJjZSIsInByZXNlcnZlX2VsaWdpYmlsaXR5IiwicmVuZGVyX2lkcyIsInRhcmdldF9yZXNvdXJjZV9pZCIsImNhbm9uaWNhbF9rZXkiLCJzb21lIiwibm9ybWFsaXplX3JlZ2lzdHJhdGlvbiIsInNlZ21lbnQiLCJwcmVzZW50YXRpb25fY29udGV4dCIsInJlbmRlcl9zZWdtZW50X2lkIiwiYm91bmRhcmllcyIsImJvdW5kYXJ5X3Zpc2liaWxpdHkiLCJpbnRlcmFjdGlvbl9heGlzIiwiaXNDb25uZWN0ZWQiLCJ0ZXN0IiwiaXNfb3ZlcmZsb3dlZCIsImJvdW5kYXJ5X3N0YXJ0X3Zpc2libGUiLCJzdGFydCIsImJvdW5kYXJ5X2VuZF92aXNpYmxlIiwiZW5kIiwiYmVnaW5fcmVhZF9vbmx5X3JlZnJlc2giLCJyZWZyZXNoX2NvbnRleHQiLCJsaXZlX2NvbnRleHQiLCJwcmV2aW91c19pZGVudGl0eV9rZXkiLCJwcmVzZW50YXRpb25faWQiLCJyZWdpc3Rlcl9yZWFkX29ubHlfc2VnbWVudCIsInJlc291cmNlX3N1bW1hcnkiLCJwdXNoIiwibm9ybWFsaXplX21vdmVtZW50X3Jlc3BvbnNlIiwicmVzcG9uc2UiLCJtb3ZlbWVudCIsInN1Y2Nlc3MiLCJkYXRhIiwibW92ZW1lbnRfY29udGV4dCIsImF2YWlsYWJpbGl0eSIsImdlc3R1cmVfYXZhaWxhYmlsaXR5Iiwic2NoZWR1bGVfc2VlZCIsInNlbGVjdGVkX2RhdGVzIiwiZXhhY3RfaW50ZXJ2YWxzIiwiaW50ZXJ2YWwiLCJmcmVlemUiLCJzYW1lX3Jlc291cmNlIiwiY3Jvc3NfcmVzb3VyY2UiLCJzb3VyY2VfY29udGV4dF90b2tlbiIsInRpbWVfYXBwbGljYXRpb24iLCJzZWxlY3Rpb25fbWV0aG9kIiwicHJpbWFyeV9yZXNvdXJjZV9pZCIsInByb3Bvc2FsX3JldmlzaW9uIiwiaW5kZXhPZiIsIkRhdGUiLCJwYXJzZSIsImFsbG93ZWQiLCJub3JtYWxpemVfcmVzaXplX3Jlc3BvbnNlIiwicmVzaXplIiwicmVzaXplX2NvbnRleHQiLCJmYWxsYmFjayIsInN0YXJ0X2FsbG93ZWQiLCJlbGlnaWJsZSIsIm9wZXJhdGlvbiIsImVuZF9hbGxvd2VkIiwic2F2ZWRfc2hhcGUiLCJhZmZlY3RlZF9pbnRlcnZhbHMiLCJpbW11dGFibGVfaW50ZXJ2YWwiLCJhbmNob3JfaW50ZXJ2YWxfaW5kZXgiLCJzY2hlbWFfdmVyc2lvbiIsImludGVyYWN0aW9uX3NvdXJjZSIsImZhbGxiYWNrX3JlYXNvbiIsInJlYXNvbiIsIm5vcm1hbGl6ZWQiLCJhZmZlY3RlZF9pbnRlcnZhbF9jb3VudCIsImluZGV4IiwicmVzaXplX3Njb3BlIiwiaXNfcmVnaXN0cmF0aW9uX2N1cnJlbnQiLCJjcmVhdGVfY29udHJvbF9ob3N0IiwiYXBwZW5kQ2hpbGQiLCJjcmVhdGVFbGVtZW50IiwiY2xhc3NOYW1lIiwic2V0QXR0cmlidXRlIiwicmVuZGVyX3RlbXBsYXRlIiwibW9kZWwiLCJpbnNlcnRBZGphY2VudEhUTUwiLCJnZXRfY2Fub25pY2FsX3JlZ2lzdHJhdGlvbnMiLCJtZWFzdXJlX2RhdGVfY29sdW1ucyIsInN1cmZhY2UiLCJkaXJlY3Rpb24iLCJzdXJmYWNlX3JlY3QiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJjb2x1bW4iLCJjb2x1bW5fcmVjdCIsImRhdGUiLCJnZXRBdHRyaWJ1dGUiLCJsb2dpY2FsX3N0YXJ0IiwiTWF0aCIsIm1heCIsInJpZ2h0IiwibGVmdCIsImxvZ2ljYWxfZW5kIiwicHJlcGFyZV9zdXJmYWNlX2NvbnRleHQiLCJhY2NlcHRlZF9jb250ZXh0Iiwic3VyZmFjZV9zdHlsZSIsImJvb2tpbmdfY29sdW1uX2d1dHRlcl9weCIsInByZXBhcmVkIiwicHJlcGFyZV9nZW9tZXRyeSIsImdldENvbXB1dGVkU3R5bGUiLCJwYXJzZUZsb2F0IiwiZ2V0UHJvcGVydHlWYWx1ZSIsImRhdGVfYmFuZHMiLCJkYXRlX2NvbHVtbnMiLCJob3VyX2hlaWdodF9weCIsImJsb2NrX2V4dGVudF9weCIsImhlaWdodCIsInN0YXR1cyIsInNuYXBzaG90Iiwic2VsZWN0aW9uX2tpbmQiLCJwcmVwYXJlX2dlc3R1cmVfY29udGV4dCIsImNsb3Nlc3QiLCJwb2ludGVyX2Nvb3JkaW5hdGUiLCJnZXN0dXJlX2NvbnRleHQiLCJldmVudCIsInNvdXJjZSIsImlubGluZV9weCIsImNsaWVudFgiLCJibG9ja19weCIsImNsaWVudFkiLCJ0b3AiLCJ0aW1lZF9yZXNpemVfcG9pbnRlcl9jb29yZGluYXRlIiwiZ2VzdHVyZSIsInN0ZXBfaGVpZ2h0IiwicGl4ZWxzX3Blcl9taW51dGUiLCJwb2ludGVyX2RlbHRhIiwicG9pbnRlcl9zdGFydF9jbGllbnRfeSIsInN0ZXBfZGVsdGEiLCJyb3VuZCIsImFicyIsIm1pbmltdW1fc3RlcF9kZWx0YSIsImNlaWwiLCJvcmlnaW4iLCJ3YWxsX21pbnV0ZSIsIm1heGltdW1fc3RlcF9kZWx0YSIsImZsb29yIiwibWluIiwiaXNfZ2VzdHVyZV9jb250ZXh0X2N1cnJlbnQiLCJyZXNvbHZlX3BvaW50ZXJfbW92ZW1lbnRfdGFyZ2V0Iiwic2VsZWN0b3IiLCJjbGllbnRfeCIsImNsaWVudF95IiwicG9pbnRfdGFyZ2V0IiwiZWxlbWVudEZyb21Qb2ludCIsIm1hdGNoZWRfc3VyZmFjZSIsInN1cmZhY2VzIiwicGFuZWwiLCJpc19jcm9zc19yZXNvdXJjZSIsInRhcmdldF9jb250ZXh0IiwiY29udGFpbnMiLCJyZWN0YW5nbGUiLCJib3R0b20iLCJlbGlnaWJpbGl0eSIsInRhcmdldF9jb250ZXh0cyIsImNvb3JkaW5hdGUiLCJrZXlib2FyZF9jb29yZGluYXRlIiwic25hcF9pbmRleCIsIm1heGltdW1faW5kZXgiLCJzaGlmdF9kYXRlIiwidmFsdWUiLCJkYXlzIiwibWF0Y2giLCJzaGlmdGVkIiwiVVRDIiwidG9JU09TdHJpbmciLCJzbGljZSIsImNhbGVuZGFyX2RheV9kZWx0YSIsInN0YXJ0X2RhdGUiLCJlbmRfZGF0ZSIsInN0YXJ0X21hdGNoIiwiZW5kX21hdGNoIiwic3RhcnRfZXBvY2giLCJlbmRfZXBvY2giLCJyZXNvbHZlX2Z1bGxfZGF5X2luc3RhbnRfYm91bmRhcnkiLCJpbnN0YW50IiwiZXhhY3RfZXBvY2giLCJkYXRlX2JhbmQiLCJtYXRjaGVzIiwiZXBvY2giLCJleGFjdF9hdCIsImNhbmRpZGF0ZXMiLCJyZXNvbHZlX2Z1bGxfZGF5X3RhcmdldF9ib3VuZGFyeSIsInJlc29sdmVkIiwiYmFuZHNfYnlfZGF0ZSIsImVuZF9hdCIsInN0YXJ0X2F0IiwiZm9ybWF0X2luc3RhbnQiLCJlcG9jaF9zZWNvbmRzIiwidmFsdWVzIiwiZm9ybWF0dGVyIiwicmVwcmVzZW50ZWQiLCJvZmZzZXRfbWludXRlcyIsInNpZ24iLCJwYWQiLCJwYWRTdGFydCIsIkludGwiLCJEYXRlVGltZUZvcm1hdCIsInRpbWVab25lIiwieWVhciIsIm1vbnRoIiwiZGF5IiwiaG91ciIsImhvdXJDeWNsZSIsIm1pbnV0ZSIsInNlY29uZCIsImZvcm1hdFRvUGFydHMiLCJwYXJ0IiwidHlwZSIsImVycm9yIiwiYnVpbGRfbW92ZW1lbnRfcHJvcG9zYWwiLCJjdXJyZW50IiwiZGF0ZV9kZWx0YSIsImluc3RhbnRfZGVsdGEiLCJ0YXJnZXRfc3VyZmFjZV9yZXNvdXJjZV9pZCIsInByb3Bvc2FsIiwicmV2aWV3X3NjaGVtYV92ZXJzaW9uIiwicHJvcG9zZWRfZGF0ZXMiLCJldmVyeSIsInByb3Bvc2VkX2ludGVydmFscyIsInJlc29sdmVfaW5zdGFudF9ib3VuZGFyeSIsInJlc29sdmVfd2FsbF90aW1lIiwib2NjdXJyZW5jZV9pZCIsImJ1aWxkX3Jlc2l6ZV9wcm9qZWN0aW9uIiwiaW1tdXRhYmxlX3N0YXJ0IiwiaW1tdXRhYmxlX2VuZCIsInNvdXJjZV9ib3VuZGFyeSIsImRlbHRhIiwiaXNfZnVsbF9kYXkiLCJtaW5pbXVtX2R1cmF0aW9uIiwiaW50ZXJ2YWxzIiwiYW5jaG9yIiwiYW5jaG9yX3N0YXJ0IiwiYW5jaG9yX2VuZCIsImZvcm1hdF9yZXNpemVfZHVyYXRpb24iLCJzZWNvbmRzIiwibWludXRlcyIsImhvdXJzIiwicmVtYWluaW5nX21pbnV0ZXMiLCJwYXJ0cyIsInJlc2l6ZV9kdXJhdGlvbl9kYXkiLCJyZXNpemVfZHVyYXRpb25fZGF5cyIsInJlcGxhY2UiLCJyZXNpemVfZHVyYXRpb25faG91ciIsInJlc2l6ZV9kdXJhdGlvbl9ob3VycyIsInJlc2l6ZV9kdXJhdGlvbl9taW51dGUiLCJyZXNpemVfZHVyYXRpb25fbWludXRlcyIsImZvcm1hdF9yZXNpemVfdmlzaWJsZV9lbmRwb2ludCIsImJ1aWxkX3Jlc2l6ZV9yYW5nZV9sYWJlbHMiLCJkdXJhdGlvbiIsImdldF9yZXNpemVfdmlzdWFsX3BvaW50IiwiZGF0ZV9vcmRlciIsImlubGluZV9leHRlbnQiLCJ3aWR0aCIsImdldF90aW1lZF9yZXNpemVfdmlzdWFsX2ZyYWdtZW50cyIsImZyYWdtZW50cyIsImxvdyIsImhpZ2giLCJtaWRkbGUiLCJiYW5kX2luZGV4Iiwic2VnbWVudF9zdGFydF9lcG9jaCIsInNlZ21lbnRfZW5kX2Vwb2NoIiwic3RhcnRfd2FsbF9taW51dGUiLCJlbmRfd2FsbF9taW51dGUiLCJ2aXNpYmxlX3N0YXJ0X21pbnV0ZSIsInZpc2libGVfZW5kX21pbnV0ZSIsInN0YXJ0X2JvdW5kYXJ5X3Zpc2libGUiLCJlbmRfYm91bmRhcnlfdmlzaWJsZSIsImdldF9mdWxsX2RheV92aXN1YWxfcmFuZ2UiLCJ2aXNpYmxlX2JhbmRzIiwiUE9TSVRJVkVfSU5GSU5JVFkiLCJORUdBVElWRV9JTkZJTklUWSIsInBoeXNpY2FsX2xlZnQiLCJwaHlzaWNhbF9yaWdodCIsImRheV9jb3VudCIsImdldF9mdWxsX2RheV9pbnRlcnZhbF9jb3VudCIsInJlbmRlcl9yZXNpemVfZ2hvc3RzIiwicmVzaXplX3Byb2plY3Rpb24iLCJyZW5kZXJlciIsIm9jY3VycmVuY2VfY291bnQiLCJwcmVzZW50YXRpb25zIiwiZ2hvc3RzIiwiZnVsbF9kYXlfcmFuZ2UiLCJ0aW1lZF9mcmFnbWVudHMiLCJsYWJlbHMiLCJsYXJnZXN0X2hlaWdodCIsImR1cmF0aW9uX2luZGV4Iiwic3RhcnRfaW5kZXgiLCJlbmRfaW5kZXgiLCJyZXNpemVfZ3JvdXAiLCJjYXJkX3JlY3QiLCJzdGFydF9sYWJlbCIsImR1cmF0aW9uX2xhYmVsIiwiZW5kX2xhYmVsIiwiYWN0aXZlX2JvdW5kYXJ5IiwiZmluZEluZGV4IiwiYXBwbHkiLCJmcmFnbWVudCIsImZyYWdtZW50X2luZGV4IiwiY29sdW1uX2d1dHRlciIsInByZXNlbnRhdGlvbiIsIm1vZGVsX2tleSIsImdob3N0IiwiYnVmZmVyIiwic3RhcnRfbGFiZWxfZWxlbWVudCIsImR1cmF0aW9uX2xhYmVsX2VsZW1lbnQiLCJlbmRfbGFiZWxfZWxlbWVudCIsIndwYmNfbW9kZWxfa2V5IiwiaW5uZXJIVE1MIiwic2hvd19zdGFydCIsInNob3dfZW5kIiwiZmlyc3RFbGVtZW50Q2hpbGQiLCJjbGFzc0xpc3QiLCJhZGQiLCJxdWVyeVNlbGVjdG9yIiwidGV4dENvbnRlbnQiLCJzdHlsZSIsInBvcCIsImFubm91bmNlX2dlc3R1cmUiLCJtZXNzYWdlIiwic2V0X2dlc3R1cmVfdGFyZ2V0X3N1cmZhY2UiLCJ0YXJnZXRfc3VyZmFjZSIsImdldF92aXN1YWxfZGVsdGEiLCJvcmlnaW5fc25hcHNob3QiLCJjdXJyZW50X3NuYXBzaG90IiwiY3VycmVudF9jb250ZXh0Iiwib3JpZ2luX2NvbHVtbiIsImN1cnJlbnRfY29sdW1uIiwibG9naWNhbF9kZWx0YSIsImlubGluZSIsImJsb2NrIiwicG9zaXRpb25fY3Jvc3NfcmVzb3VyY2VfbW92ZW1lbnRfZ2hvc3QiLCJwb2ludCIsImVuZF9wb2ludCIsImR1cmF0aW9uX3NlY29uZHMiLCJzaGlmdGVkX2RhdGVzIiwic3RhcnRfYmFuZCIsImVuZF9iYW5kIiwidHJhbnNmb3JtIiwicmVuZGVyX2dlc3R1cmVfZ2hvc3QiLCJ0aW1lX2xhYmVsIiwiZ2VzdHVyZV90eXBlIiwibGFiZWwiLCJwYXJlbnROb2RlIiwiZmx1c2hfZ2VzdHVyZV9mcmFtZSIsInRhcmdldF9pc19jcm9zc19yZXNvdXJjZSIsInByb3Bvc2VkX3RpbWUiLCJwZW5kaW5nX2Nvb3JkaW5hdGUiLCJwZW5kaW5nX2NvbnRleHQiLCJwZW5kaW5nX3RhcmdldF9yZXNvdXJjZV9pZCIsIm91dHNpZGVfdW5hdmFpbGFibGUiLCJyZXNvbHZlX2Nvb3JkaW5hdGUiLCJnYXBfdW5hdmFpbGFibGUiLCJmb2xkX3VuYXZhaWxhYmxlIiwicmVzaXplX3Byb3Bvc2FsX2NoYW5nZWRfYWxsX2RheSIsInJlc2l6ZV9wcm9wb3NhbF9jaGFuZ2VkIiwicmVzaXplX2dyb3VwX2V4cGxhbmF0aW9uIiwiY3Jvc3NfcmVzb3VyY2VfY2hhbmdlZF9hbGxfZGF5IiwiY3Jvc3NfcmVzb3VyY2VfY2hhbmdlZCIsInByb3Bvc2FsX2NoYW5nZWRfYWxsX2RheSIsInByb3Bvc2FsX2NoYW5nZWQiLCJncm91cF9zaGlmdCIsInNjaGVkdWxlX2dlc3R1cmVfZnJhbWUiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJyZXN0b3JlX2ZvY3VzIiwicG9pbnRlcl9pZCIsImdyaXAiLCJyZWxlYXNlUG9pbnRlckNhcHR1cmUiLCJzZXRfaW50ZXJhY3Rpb25fc3VzcGVuZGVkIiwic2V0X2F4aXNfd2luZG93X2xvYWRpbmdfbG9ja2VkIiwiZm9jdXMiLCJyZXN0b3JlX3Byb2plY3RlZF9mb2N1cyIsImZpbmQiLCJvcGVyYXRpb25fc2VsZWN0b3IiLCJmb2N1c190YXJnZXQiLCJjb21wbGV0ZV9nZXN0dXJlIiwicmV2aWV3X3N0YXRlIiwiY2FudmFzX3Njcm9sbCIsImNhbnZhcyIsInNjcm9sbExlZnQiLCJkb2NfeCIsInNjcm9sbFgiLCJkb2NfeSIsInNjcm9sbFkiLCJvbl9zb3VyY2Vfc3RhbGUiLCJyZWxvYWRfc2VsZWN0ZWRfZWxpZ2liaWxpdHkiLCJyZXNpemVfbm9fY2hhbmdlIiwibm9fY2hhbmdlIiwicmV2aWV3X2Jvb2tpbmdfcmVzaXplX3Byb3Bvc2FsIiwicmVzaXplX3Jldmlld191bmF2YWlsYWJsZSIsInJldmlld19ib29raW5nX21vdmVtZW50X3Byb3Bvc2FsIiwicmV2aWV3X3VuYXZhaWxhYmxlIiwiYmVnaW5fZ2VzdHVyZSIsImlucHV0X21vZGUiLCJjYW5fc3RhcnRfaW50ZXJhY3Rpb24iLCJrZXlib2FyZF9zdGFydGVkIiwiY3Jvc3NfcmVzb3VyY2Vfc3RhcnRlZCIsImdlc3R1cmVfc3RhcnRlZCIsImJlZ2luX3Jlc2l6ZV9nZXN0dXJlIiwiaGFuZGxlIiwicG9pbnRlcl95IiwiYm91bmRhcnlfaW5zdGFudCIsInJlc2l6ZV9nZXN0dXJlX3N0YXJ0ZWQiLCJmaW5kX3JlZ2lzdHJhdGlvbl9mb3JfZ3JpcCIsImdldF9rZXlib2FyZF9vcmlnaW5fY29vcmRpbmF0ZSIsImV4YWN0X3N0YXJ0IiwiaGFuZGxlX3BvaW50ZXJfZG93biIsInJlc2l6ZV9oYW5kbGUiLCJ0YXJnZXQiLCJjb250cm9sIiwiYnV0dG9uIiwicG9pbnRlcklkIiwic2V0UG9pbnRlckNhcHR1cmUiLCJwcmV2ZW50RGVmYXVsdCIsInN0b3BQcm9wYWdhdGlvbiIsImhhbmRsZV9wb2ludGVyX21vdmUiLCJoYW5kbGVfcG9pbnRlcl91cCIsImNhbmNlbGxlZCIsImhhbmRsZV9wb2ludGVyX2NhbmNlbCIsInJlc2l6ZV9jYW5jZWxsZWQiLCJoYW5kbGVfa2V5ZG93biIsInJlc2l6ZV9yZWdpc3RyYXRpb24iLCJvcmlnaW5fY29vcmRpbmF0ZSIsImRhdGVfaW5kZXgiLCJzbmFwX2RlbHRhIiwia2V5Iiwib3Blbl9ib29raW5nX2Z1bGxfcmVzY2hlZHVsZSIsImdldF9yZXNpemVfZGVuaWFsX21lc3NhZ2UiLCJyZWFzb25zIiwicmVzaXplX2RlbmlhbF9yZWFzb25zIiwiZGVuaWVkIiwicmVuZGVyX2VsaWdpYmlsaXR5IiwiY2Fub25pY2FsX3JlZ2lzdHJhdGlvbnMiLCJhbmNob3JfcmVnaXN0cmF0aW9uIiwic3RhdHVzX2lkIiwicmVzaXplX2RlbmlhbF9tZXNzYWdlIiwic3RhdHVzX21lc3NhZ2UiLCJyZWFkeSIsImlzX2FuY2hvciIsImlzX3RpbWVkX3Jlc2l6ZSIsImlzX2Z1bGxfZGF5X3Jlc2l6ZSIsIm1vdmVtZW50X2xhYmVsIiwia2V5Ym9hcmRfaW5zdHJ1Y3Rpb25zIiwiZnVsbF9kYXlfa2V5Ym9hcmRfaW5zdHJ1Y3Rpb25zIiwiZ3JvdXBfbGFiZWwiLCJyZXNpemVfZ3JvdXBfbGFiZWwiLCJyZXNpemVfc3RhcnRfbGFiZWwiLCJyZXNpemVfZW5kX2xhYmVsIiwia2V5Ym9hcmRfZmFsbGJhY2siLCJyZXNpemVfa2V5Ym9hcmRfZmFsbGJhY2siLCJyZW5kZXJfY2hlY2tpbmdfc3RhdHVzIiwiaXNfbG9hZGluZyIsImNoZWNraW5nIiwicmVxdWVzdF9lbGlnaWJpbGl0eSIsIm1vdmVtZW50X3RyYW5zcG9ydCIsInJlc2l6ZV90cmFuc3BvcnQiLCJnZW5lcmF0aW9uIiwicmVtYWluaW5nIiwibW92ZW1lbnRfcmVzdWx0IiwicmVzaXplX3Jlc3VsdCIsImhhc19lcnJvciIsIm1vdmVtZW50X3JlcXVlc3QiLCJyZXNpemVfcmVxdWVzdCIsImpRdWVyeSIsInVybCIsImNvbXBsZXRlX29uZV9yZXF1ZXN0Iiwic2hvd19hZG1pbl9tZXNzYWdlIiwiYWpheCIsIm1ldGhvZCIsImRhdGFUeXBlIiwiYWN0aW9uIiwibm9uY2UiLCJzZWdtZW50X3Jlc291cmNlX2lkIiwidmlzaWJsZV9zdGFydF9hdCIsInZpc2libGVfZW5kX2F0IiwiZG9uZSIsImZhaWwiLCJyZXF1ZXN0X3N0YXR1cyIsImFsd2F5cyIsInJlc29sdmVfc2VsZWN0ZWRfcmVnaXN0cmF0aW9uIiwic2VsZWN0aW9uX3N0YXRlIiwic2VnbWVudF9oaW50IiwicmVjb25jaWxlX3NlbGVjdGlvbiIsInNjaGVkdWxlX3NlbGVjdGlvbl9yZWNvbmNpbGlhdGlvbiIsIm5leHRfc2VsZWN0aW9uX3N0YXRlIiwic2VsZWN0X3NlZ21lbnQiLCJzZWdtZW50X2VsZW1lbnQiLCJjb21wbGV0ZV9yZWFkX29ubHlfcmVmcmVzaCIsInNldF9yZXF1ZXN0X2xvYWRpbmciLCJyZWZyZXNoX3JldGFpbmVkX3Jlc291cmNlX2lkZW50aXR5IiwiaGFuZGxlX2FjY2VwdGVkX2RhdGFfcmVwbGFjZW1lbnQiLCJudW1lcmljX3Jlc291cmNlX2lkIiwibGl2ZV9pZGVudGl0eV9rZXkiLCJoYW5kbGVfcHJlc2VudGF0aW9uX3JlbW92ZWQiLCJkZXRhaWwiLCJoYW5kbGVfZW52aXJvbm1lbnRfbG9zcyIsImhhbmRsZV92aXNpYmlsaXR5X2NoYW5nZSIsImhpZGRlbiIsImlzX2ludGVyYWN0aW5nIiwic2V0X2ludGVyYWN0aW9uX2NhbGxiYWNrcyIsIm5leHRfY2FsbGJhY2tzIiwiZ2V0X3N0YXRlX3NuYXBzaG90IiwicmVnaXN0cmF0aW9uX2NvdW50IiwicmVzb3VyY2VfaWRlbnRpdHlfY291bnQiLCJlbGlnaWJpbGl0eV9jYWNoZV9jb3VudCIsInJlcXVlc3RfY291bnQiLCJoYXNfc2VsZWN0ZWRfY2Fub25pY2FsX2lkZW50aXR5IiwiaGFzX2FjdGl2ZV9nZXN0dXJlIiwiaW5pdGlhbGl6ZSIsImFkZEV2ZW50TGlzdGVuZXIiLCJwYXNzaXZlIiwiZGVzdHJveSIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJnZXRfYWN0aXZlX2NvbnRyb2xsZXIiLCJpbnZva2VfYWN0aXZlX2NvbnRyb2xsZXIiLCJtZXRob2RfbmFtZSIsIm1ldGhvZF9hcmd1bWVudHMiLCJjb250cm9sbGVyIiwidW5kZWZpbmVkIiwicmVnaXN0ZXJfZmFjdG9yeSIsIndwYmNfdGltZWxpbmVfYm9va2luZ19pbnRlcmFjdGlvbnMiLCJyZWdpc3Rlcl9leHRlbnNpb25fZmFjdG9yeSIsImludGVyYWN0aW9uX2NvbnRleHQiLCJicmlkZ2VfY2FsbGJhY2tzIiwiYmVnaW5fcmVmcmVzaCJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtdGltZWxpbmUvdGltZS1yb3dzLW1vdmVtZW50L19zcmMvdGltZS1yb3dzLW1vdmVtZW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogRXhwYW5kZWQgdGltZS1yb3cgcHJvamVjdGVkLWJvb2tpbmcgZWxpZ2liaWxpdHkgYW5kIG1vdmVtZW50IGFkYXB0ZXIuXG4gKlxuICogVGhlIGFkYXB0ZXIgcmVzb2x2ZXMgcHJlc2VudGF0aW9uIGZyYWdtZW50cyBvbmx5IHRocm91Z2ggYWNjZXB0ZWQgY2Fub25pY2FsXG4gKiBzZWdtZW50IERUT3Mgc3VwcGxpZWQgYnkgdGhlIG9wdGltaXplZCB0aW1lLXJvdyBwcm9qZWN0aW9uIGluZGV4LiBJdCByZXVzZXNcbiAqIGV4aXN0aW5nIGF1dGhvcml0YXRpdmUgbW92ZW1lbnQgYW5kIHJlc2l6aW5nIGNvbnRleHQgcmVhZHMuIFBvaW50ZXIgYW5kXG4gKiBrZXlib2FyZCBnZXN0dXJlcyBwcm9kdWNlIHByb3Bvc2FscyB0aHJvdWdoIHRoZSBzaGFyZWQgcHVyZSBnZW9tZXRyeSBrZXJuZWw7XG4gKiBjYW5vbmljYWwgUmV2aWV3LCBBcHBseSwgYW5kIHJlYWRiYWNrIHJlbWFpbiBvd25lZCBieSBCb29raW5nIFJlc2NoZWR1bGluZy5cbiAqXG4gKiBAcGFja2FnZSBCb29raW5nIENhbGVuZGFyXG4gKiBAc2luY2UgICAxMi4wLjBcbiAqL1xuKCBmdW5jdGlvbiAoIHdpbmRvdywgZG9jdW1lbnQsIHdwICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIG1vZHVsZV9pZCA9ICd0aW1lX3Jvd3NfbW92ZW1lbnQnO1xuXHR2YXIgbW9kdWxlX2luc3RhbmNlX2lkID0gJ3dwYmNfdGltZWxpbmVfdGltZV9yb3dzX21vdmVtZW50Jztcblx0dmFyIGV4YWN0X2luc3RhbnRfcGF0dGVybiA9IC9eXFxkezR9LVxcZHsyfS1cXGR7Mn1UXFxkezJ9OlxcZHsyfTowMCg/Olp8WystXVxcZHsyfTpcXGR7Mn0pJC87XG5cdHZhciB0aW1lZF9zdXJmYWNlX3NlbGVjdG9yID0gJy53cGJjX3RpbWVsaW5lX3RpbWVfcm93c19fdGltZWRfc3VyZmFjZSc7XG5cdHZhciBhbGxfZGF5X3N1cmZhY2Vfc2VsZWN0b3IgPSAnLndwYmNfdGltZWxpbmVfdGltZV9yb3dzX19hbGxfZGF5X3N1cmZhY2UnO1xuXHR2YXIgZGF0ZV9jb2x1bW5fc2VsZWN0b3IgPSAnW2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3MtZGF0ZV0nO1xuXHR2YXIgbW92ZW1lbnRfZ3JpcF9zZWxlY3RvciA9ICdbZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1tb3ZlbWVudC1ncmlwXSc7XG5cdHZhciByZXNpemVfaGFuZGxlX3NlbGVjdG9yID0gJ1tkYXRhLXdwYmMtdGltZWxpbmUtdGltZS1yb3dzLXJlc2l6ZS1oYW5kbGVdJztcblx0dmFyIHN1cHBvcnRlZF90aW1lZF9yZXNpemVfc2hhcGVzID0gW1xuXHRcdCdzaW5nbGVfdGltZWRfaW50ZXJ2YWwnLFxuXHRcdCdjb250aW51b3VzX2JvdW5kYXJ5X2ludGVydmFsJyxcblx0XHQncmVjdXJyZW50X3RpbWVkX2ludGVydmFscycsXG5cdFx0J2Rpc2NvbnRpbnVvdXNfdGltZWRfaW50ZXJ2YWxzJ1xuXHRdO1xuXHR2YXIgc3VwcG9ydGVkX2Z1bGxfZGF5X3Jlc2l6ZV9zaGFwZXMgPSBbXG5cdFx0J3NpbmdsZV9mdWxsX2RheScsXG5cdFx0J2NvbnRpbnVvdXNfZnVsbF9kYXlfcmFuZ2UnLFxuXHRcdCdpbmRlcGVuZGVudF9mdWxsX2RheXMnXG5cdF07XG5cdHZhciB0aW1lX3Jvd3NfcGFuZWxfc2VsZWN0b3IgPSAnW2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3MtcGFuZWw9XCJjYW52YXNcIl0nO1xuXHR2YXIgYm9va2luZ19pbnRlcmFjdGlvbl9jYWxsYmFja3MgPSBudWxsO1xuXG5cdC8qKlxuXHQgKiBOb3JtYWxpemUgb25lIHBvc2l0aXZlIGludGVnZXIgd2l0aG91dCBhY2NlcHRpbmcgcHJlc2VudGF0aW9uIHN0cmluZ3MuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gY2FuZGlkYXRlIENhbmRpZGF0ZSBzY2FsYXIuXG5cdCAqIEByZXR1cm4ge251bWJlcn0gUG9zaXRpdmUgaW50ZWdlciwgb3IgemVyby5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9wb3NpdGl2ZV9pbnRlZ2VyKCBjYW5kaWRhdGUgKSB7XG5cdFx0Y2FuZGlkYXRlID0gTnVtYmVyKCBjYW5kaWRhdGUgKTtcblxuXHRcdHJldHVybiBOdW1iZXIuaXNJbnRlZ2VyKCBjYW5kaWRhdGUgKSAmJiAwIDwgY2FuZGlkYXRlID8gY2FuZGlkYXRlIDogMDtcblx0fVxuXG5cdC8qKlxuXHQgKiBCdWlsZCBvbmUgaW1tdXRhYmxlIGFjY2VwdGVkLWlkZW50aXR5IGtleSBpbmNsdWRpbmcgbG9jYWwgZ2VvbWV0cnkuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IEFjY2VwdGVkIGludGVyYWN0aW9uIGNvbnRleHQgZnJvbSB0aW1lIHJvd3MuXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBzZWxlY3Rpb25fc3RlcF9taW51dGVzIFNlcnZlci1vd25lZCBpbnRlcmFjdGlvbiBzdGVwLlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IFN0YWJsZSBpZGVudGl0eSBrZXksIG9yIGFuIGVtcHR5IHN0cmluZy5cblx0ICovXG5cdGZ1bmN0aW9uIGJ1aWxkX2FjY2VwdGVkX2lkZW50aXR5X2tleSggY29udGV4dCwgc2VsZWN0aW9uX3N0ZXBfbWludXRlcyApIHtcblx0XHR2YXIgaWRlbnRpdHkgPSBjb250ZXh0ICYmIGNvbnRleHQuYWNjZXB0ZWRfaWRlbnRpdHkgPyBjb250ZXh0LmFjY2VwdGVkX2lkZW50aXR5IDoge307XG5cdFx0dmFyIHZpc2libGVfcmFuZ2UgPSBjb250ZXh0ICYmIGNvbnRleHQudmlzaWJsZV9yYW5nZSA/IGNvbnRleHQudmlzaWJsZV9yYW5nZSA6IHt9O1xuXHRcdHZhciByZXNvdXJjZV9pZCA9IG5vcm1hbGl6ZV9wb3NpdGl2ZV9pbnRlZ2VyKCBpZGVudGl0eS5yZXNvdXJjZV9pZCApO1xuXHRcdHZhciB3aW5kb3dfa2V5cyA9IEFycmF5LmlzQXJyYXkoIGlkZW50aXR5LmFjY2VwdGVkX3dpbmRvd19rZXlzIClcblx0XHRcdD8gaWRlbnRpdHkuYWNjZXB0ZWRfd2luZG93X2tleXMubWFwKCBTdHJpbmcgKS5maWx0ZXIoIEJvb2xlYW4gKVxuXHRcdFx0OiBbXTtcblxuXHRcdGlmIChcblx0XHRcdCEgcmVzb3VyY2VfaWRcblx0XHRcdHx8ICEgU3RyaW5nKCBjb250ZXh0ICYmIGNvbnRleHQuY2FjaGVfa2V5IHx8ICcnIClcblx0XHRcdHx8ICEgU3RyaW5nKCBpZGVudGl0eS5yZXNvdXJjZV9maW5nZXJwcmludCB8fCAnJyApXG5cdFx0XHR8fCAhIFN0cmluZyggaWRlbnRpdHkudGltZXpvbmUgfHwgJycgKVxuXHRcdFx0fHwgISB3aW5kb3dfa2V5cy5sZW5ndGhcblx0XHRcdHx8ICEgTnVtYmVyLmlzRmluaXRlKCBOdW1iZXIoIHZpc2libGVfcmFuZ2Uuc3RhcnRfbWludXRlICkgKVxuXHRcdFx0fHwgISBOdW1iZXIuaXNGaW5pdGUoIE51bWJlciggdmlzaWJsZV9yYW5nZS5lbmRfbWludXRlICkgKVxuXHRcdFx0fHwgTnVtYmVyKCB2aXNpYmxlX3JhbmdlLmVuZF9taW51dGUgKSA8PSBOdW1iZXIoIHZpc2libGVfcmFuZ2Uuc3RhcnRfbWludXRlIClcblx0XHRcdHx8ICEgTnVtYmVyLmlzRmluaXRlKCBOdW1iZXIoIGNvbnRleHQuem9vbV9wZXJjZW50ICkgKVxuXHRcdFx0fHwgISBOdW1iZXIuaXNJbnRlZ2VyKCBOdW1iZXIoIHNlbGVjdGlvbl9zdGVwX21pbnV0ZXMgKSApXG5cdFx0XHR8fCAxID4gTnVtYmVyKCBzZWxlY3Rpb25fc3RlcF9taW51dGVzIClcblx0XHQpIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cblx0XHRyZXR1cm4gW1xuXHRcdFx0cmVzb3VyY2VfaWQsXG5cdFx0XHRTdHJpbmcoIGNvbnRleHQuY2FjaGVfa2V5ICksXG5cdFx0XHRTdHJpbmcoIGlkZW50aXR5LnJlc291cmNlX2ZpbmdlcnByaW50ICksXG5cdFx0XHROdW1iZXIoIGlkZW50aXR5LmJvb2tpbmdfZ2VuZXJhdGlvbiB8fCAwICksXG5cdFx0XHROdW1iZXIoIGlkZW50aXR5LmF2YWlsYWJpbGl0eV9nZW5lcmF0aW9uIHx8IDAgKSxcblx0XHRcdHdpbmRvd19rZXlzLmpvaW4oICcsJyApLFxuXHRcdFx0U3RyaW5nKCBpZGVudGl0eS50aW1lem9uZSApLFxuXHRcdFx0TnVtYmVyKCB2aXNpYmxlX3JhbmdlLnN0YXJ0X21pbnV0ZSApLFxuXHRcdFx0TnVtYmVyKCB2aXNpYmxlX3JhbmdlLmVuZF9taW51dGUgKSxcblx0XHRcdE51bWJlciggY29udGV4dC56b29tX3BlcmNlbnQgKSxcblx0XHRcdE51bWJlciggc2VsZWN0aW9uX3N0ZXBfbWludXRlcyApXG5cdFx0XS5qb2luKCAnfCcgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBCdWlsZCBvbmUgY2Fub25pY2FsIHNlZ21lbnQgY2FjaGUga2V5IHdpdGhvdXQgcHJlc2VudGF0aW9uIGlkZW50aXR5LlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gaWRlbnRpdHlfa2V5IEFjY2VwdGVkIFJlc291cmNlIGFuZCBnZW9tZXRyeSBpZGVudGl0eS5cblx0ICogQHBhcmFtIHtudW1iZXJ9IGJvb2tpbmdfaWQgQ2Fub25pY2FsIGJvb2tpbmcgSUQuXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBDYW5vbmljYWwgUmVzb3VyY2UgSUQuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBzZWdtZW50X2lkIENhbm9uaWNhbCBhY2NlcHRlZCBzZWdtZW50IElELlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdmlzaWJsZV9zdGFydCBFeGFjdCBvZmZzZXQtcXVhbGlmaWVkIHZpc2libGUgc3RhcnQuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB2aXNpYmxlX2VuZCBFeGFjdCBvZmZzZXQtcXVhbGlmaWVkIHZpc2libGUgZW5kLlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IFN0YWJsZSBlbGlnaWJpbGl0eSBjYWNoZSBrZXkuXG5cdCAqL1xuXHRmdW5jdGlvbiBidWlsZF9jYW5vbmljYWxfa2V5KCBpZGVudGl0eV9rZXksIGJvb2tpbmdfaWQsIHJlc291cmNlX2lkLCBzZWdtZW50X2lkLCB2aXNpYmxlX3N0YXJ0LCB2aXNpYmxlX2VuZCApIHtcblx0XHRyZXR1cm4gWyBpZGVudGl0eV9rZXksIGJvb2tpbmdfaWQsIHJlc291cmNlX2lkLCBzZWdtZW50X2lkLCB2aXNpYmxlX3N0YXJ0LCB2aXNpYmxlX2VuZCBdLmpvaW4oICd8JyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBvbmUgcGFnZS1sb2NhbCBwcm9qZWN0ZWQtYm9va2luZyBlbGlnaWJpbGl0eSBjb250cm9sbGVyLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29udGV4dCBUaW1lbGluZSBleHRlbnNpb24gY29udGV4dC5cblx0ICogQHJldHVybiB7T2JqZWN0fSBTeW1tZXRyaWMgbW9kdWxlIGxpZmVjeWNsZSBhbmQgbmV1dHJhbCBicmlkZ2UgQVBJLlxuXHQgKi9cblx0ZnVuY3Rpb24gY3JlYXRlX2NvbnRyb2xsZXIoIGNvbnRleHQgKSB7XG5cdFx0dmFyIG1vdW50ID0gY29udGV4dC5tb3VudCB8fCBudWxsO1xuXHRcdHZhciBjb25maWd1cmF0aW9uID0gY29udGV4dC5jb25maWd1cmF0aW9uIHx8IHt9O1xuXHRcdHZhciB0aW1lX3Jvd3NfY29uZmlndXJhdGlvbiA9IGNvbmZpZ3VyYXRpb24udGltZV9yb3dzIHx8IHt9O1xuXHRcdHZhciB0cmFuc3BvcnQgPSBjb25maWd1cmF0aW9uLnRyYW5zcG9ydCB8fCB7fTtcblx0XHR2YXIgdGVtcGxhdGVzID0gY29uZmlndXJhdGlvbi50ZW1wbGF0ZXMgfHwge307XG5cdFx0dmFyIGkxOG4gPSBjb25maWd1cmF0aW9uLmkxOG4gfHwge307XG5cdFx0dmFyIG9wdGlvbmFsX2dlc3R1cmVzID0gY29uZmlndXJhdGlvbi5vcHRpb25hbF9nZXN0dXJlcyB8fCB7fTtcblx0XHR2YXIgZ2VvbWV0cnkgPSB3aW5kb3cud3BiY190aW1lbGluZV90aW1lX3Jvd3NfaW50ZXJhY3Rpb25fZ2VvbWV0cnkgfHwgbnVsbDtcblx0XHR2YXIgY2FsbGJhY2tzID0gY29udGV4dC5jYWxsYmFja3MgfHwgYm9va2luZ19pbnRlcmFjdGlvbl9jYWxsYmFja3MgfHwge307XG5cdFx0dmFyIHNlbGVjdGlvbl9zdGVwX21pbnV0ZXMgPSBOdW1iZXIoIGNvbmZpZ3VyYXRpb24uc2VsZWN0aW9uX3N0ZXBfbWludXRlcyB8fCAwICk7XG5cdFx0dmFyIGZ1bGxfZGF5X21vdmVtZW50X2VuYWJsZWQgPSB0cnVlID09PSBvcHRpb25hbF9nZXN0dXJlcy5mdWxsX2RheV9tb3ZlbWVudDtcblx0XHR2YXIgZnVsbF9kYXlfcmVzaXplX2VuYWJsZWQgPSB0cnVlID09PSBvcHRpb25hbF9nZXN0dXJlcy5mdWxsX2RheV9yZXNpemU7XG5cdFx0dmFyIGNyb3NzX3Jlc291cmNlX21vdmVtZW50X2VuYWJsZWQgPSB0cnVlID09PSBvcHRpb25hbF9nZXN0dXJlcy5jcm9zc19yZXNvdXJjZV9tb3ZlbWVudDtcblx0XHR2YXIgcmVnaXN0cmF0aW9uc19ieV9yZW5kZXJfaWQgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0dmFyIHJlZ2lzdHJhdGlvbl9pZHNfYnlfcmVzb3VyY2UgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0dmFyIHJlZnJlc2hfaWRlbnRpdHlfYnlfcmVzb3VyY2UgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0dmFyIGVsaWdpYmlsaXR5X2NhY2hlID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xuXHRcdHZhciBhY3RpdmVfcmVxdWVzdHMgPSBbXTtcblx0XHR2YXIgYWN0aXZlX3JlcXVlc3RfcmVzb3VyY2VfaWQgPSAwO1xuXHRcdHZhciByZXF1ZXN0X2dlbmVyYXRpb24gPSAwO1xuXHRcdHZhciByZWNvbmNpbGVfZnJhbWUgPSAwO1xuXHRcdHZhciBwZW5kaW5nX3NlbGVjdGlvbl9zdGF0ZSA9IG51bGw7XG5cdFx0dmFyIHNlbGVjdGVkX2Jvb2tpbmdfaWQgPSAwO1xuXHRcdHZhciBzZWxlY3RlZF9yZW5kZXJfaWQgPSAnJztcblx0XHR2YXIgc2VsZWN0ZWRfY2Fub25pY2FsX2tleSA9ICcnO1xuXHRcdHZhciBpc19yZXF1ZXN0X2xvYWRpbmcgPSBmYWxzZTtcblx0XHR2YXIgaXNfaW5pdGlhbGl6ZWQgPSBmYWxzZTtcblx0XHR2YXIgYWN0aXZlX2dlc3R1cmUgPSBudWxsO1xuXHRcdHZhciBnZXN0dXJlX2ZyYW1lID0gMDtcblxuXHRcdC8qKlxuXHRcdCAqIFJlc29sdmUgdGhlIGN1cnJlbnQgYWNjZXB0ZWQtZGF0YSBjb250cm9sbGVyIHdpdGhvdXQgcmV0YWluaW5nIGl0LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IEFjdGl2ZSB0aW1lLXJvdyBpbnN0YW5jZSBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF90aW1lX3Jvd3NfY29udHJvbGxlcigpIHtcblx0XHRcdHZhciBtb2R1bGVzID0gd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcztcblxuXHRcdFx0cmV0dXJuIG1vZHVsZXMgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIG1vZHVsZXMuZ2V0X2luc3RhbmNlXG5cdFx0XHRcdD8gbW9kdWxlcy5nZXRfaW5zdGFuY2UoIFN0cmluZyggdGltZV9yb3dzX2NvbmZpZ3VyYXRpb24uaW5zdGFuY2VfaWQgfHwgJycgKSApXG5cdFx0XHRcdDogbnVsbDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWFkIHRoZSBjdXJyZW50IGFjY2VwdGVkIGlkZW50aXR5IGRpcmVjdGx5IGZyb20gaXRzIGF1dGhvcml0YXRpdmUgb3duZXIuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgQXV0aG9yaXplZCBvcGVuIFJlc291cmNlIElELlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBDdXJyZW50IGFjY2VwdGVkIGludGVyYWN0aW9uIGNvbnRleHQgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfbGl2ZV9pbnRlcmFjdGlvbl9jb250ZXh0KCByZXNvdXJjZV9pZCApIHtcblx0XHRcdHZhciB0aW1lX3Jvd3MgPSBnZXRfdGltZV9yb3dzX2NvbnRyb2xsZXIoKTtcblxuXHRcdFx0aWYgKCAhIHRpbWVfcm93cyB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgdGltZV9yb3dzLmdldF9pbnRlcmFjdGlvbl9nZW9tZXRyeV9jb250ZXh0ICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRcdHJldHVybiB0aW1lX3Jvd3MuZ2V0X2ludGVyYWN0aW9uX2dlb21ldHJ5X2NvbnRleHQoIHJlc291cmNlX2lkICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIGEgZml4ZWQgYWxsb3ctbGlzdGVkIFdvcmRQcmVzcyB0ZW1wbGF0ZSByZW5kZXJlci5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZV9zbG90IFNlcnZlci1vd25lZCB0ZW1wbGF0ZSBzbG90LlxuXHRcdCAqIEByZXR1cm4ge0Z1bmN0aW9ufG51bGx9IFRlbXBsYXRlIHJlbmRlcmVyIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3RlbXBsYXRlKCB0ZW1wbGF0ZV9zbG90ICkge1xuXHRcdFx0dmFyIHRlbXBsYXRlX2lkID0gdGVtcGxhdGVzWyB0ZW1wbGF0ZV9zbG90IF07XG5cblx0XHRcdHJldHVybiB0ZW1wbGF0ZV9pZCAmJiB3cCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd3AudGVtcGxhdGUgPyB3cC50ZW1wbGF0ZSggdGVtcGxhdGVfaWQgKSA6IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVtb3ZlIGV2ZXJ5IHBlbmRpbmcgZWxpZ2liaWxpdHkgcmVhZCBhbmQgYWR2YW5jZSBzdGFsZS1yZXNwb25zZSBzdGF0ZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBPcHRpb25hbCBSZXNvdXJjZS1zY29wZWQgY2FuY2VsbGF0aW9uLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYWJvcnRfcmVxdWVzdHMoIHJlc291cmNlX2lkICkge1xuXHRcdFx0cmVzb3VyY2VfaWQgPSBub3JtYWxpemVfcG9zaXRpdmVfaW50ZWdlciggcmVzb3VyY2VfaWQgKTtcblx0XHRcdGlmICggcmVzb3VyY2VfaWQgJiYgYWN0aXZlX3JlcXVlc3RfcmVzb3VyY2VfaWQgJiYgcmVzb3VyY2VfaWQgIT09IGFjdGl2ZV9yZXF1ZXN0X3Jlc291cmNlX2lkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRhY3RpdmVfcmVxdWVzdHMuZm9yRWFjaCggZnVuY3Rpb24gKCByZXF1ZXN0ICkge1xuXHRcdFx0XHRpZiAoIHJlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHJlcXVlc3QuYWJvcnQgKSB7XG5cdFx0XHRcdFx0cmVxdWVzdC5hYm9ydCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRhY3RpdmVfcmVxdWVzdHMgPSBbXTtcblx0XHRcdGFjdGl2ZV9yZXF1ZXN0X3Jlc291cmNlX2lkID0gMDtcblx0XHRcdHJlcXVlc3RfZ2VuZXJhdGlvbiArPSAxO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENhbmNlbCBvbmUgZnJhbWUtY29hbGVzY2VkIGJvb2tpbmctc2VsZWN0aW9uIHJlY29uY2lsaWF0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjYW5jZWxfcmVjb25jaWxlX3NlbGVjdGlvbigpIHtcblx0XHRcdGlmICggcmVjb25jaWxlX2ZyYW1lICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUgKSB7XG5cdFx0XHRcdHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSggcmVjb25jaWxlX2ZyYW1lICk7XG5cdFx0XHR9XG5cdFx0XHRyZWNvbmNpbGVfZnJhbWUgPSAwO1xuXHRcdFx0cGVuZGluZ19zZWxlY3Rpb25fc3RhdGUgPSBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbW92ZSBtb2R1bGUtb3duZWQgY29udHJvbHMgZnJvbSBvbmUgY2Fub25pY2FsIHJlZ2lzdHJhdGlvbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZWdpc3RyYXRpb24gQWNjZXB0ZWQgcHJvamVjdGVkIHNlZ21lbnQgcmVnaXN0cmF0aW9uLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2xlYXJfcmVnaXN0cmF0aW9uX2hvc3QoIHJlZ2lzdHJhdGlvbiApIHtcblx0XHRcdHZhciBob3N0cyA9IHJlZ2lzdHJhdGlvbiAmJiByZWdpc3RyYXRpb24uY2FyZCAmJiByZWdpc3RyYXRpb24uY2FyZC5xdWVyeVNlbGVjdG9yQWxsXG5cdFx0XHRcdD8gcmVnaXN0cmF0aW9uLmNhcmQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtdGltZS1yb3dzLW1vdmVtZW50LWhvc3RdJyApXG5cdFx0XHRcdDogW107XG5cblx0XHRcdEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoIGhvc3RzLCBmdW5jdGlvbiAoIGhvc3QgKSB7XG5cdFx0XHRcdGhvc3QucmVtb3ZlKCk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVtb3ZlIG1vZHVsZSBwcmVzZW50YXRpb24gZnJvbSBldmVyeSByZXRhaW5lZCBwcm9qZWN0ZWQgc2VnbWVudC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2xlYXJfYWxsX3JlZ2lzdHJhdGlvbl9ob3N0cygpIHtcblx0XHRcdE9iamVjdC5rZXlzKCByZWdpc3RyYXRpb25zX2J5X3JlbmRlcl9pZCApLmZvckVhY2goIGZ1bmN0aW9uICggcmVuZGVyX2lkICkge1xuXHRcdFx0XHRjbGVhcl9yZWdpc3RyYXRpb25faG9zdCggcmVnaXN0cmF0aW9uc19ieV9yZW5kZXJfaWRbIHJlbmRlcl9pZCBdICk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSW52YWxpZGF0ZSBldmVyeSBlbGlnaWJpbGl0eSByZWNvcmQgYW5kIHJlbW92ZSBjdXJyZW50IGNvbnRyb2xzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbnZhbGlkYXRlX2FsbCgpIHtcblx0XHRcdGNhbmNlbF9nZXN0dXJlKCBmYWxzZSwgJycgKTtcblx0XHRcdGFib3J0X3JlcXVlc3RzKCk7XG5cdFx0XHRjYW5jZWxfcmVjb25jaWxlX3NlbGVjdGlvbigpO1xuXHRcdFx0Y2xlYXJfYWxsX3JlZ2lzdHJhdGlvbl9ob3N0cygpO1xuXHRcdFx0ZWxpZ2liaWxpdHlfY2FjaGUgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0XHRzZWxlY3RlZF9jYW5vbmljYWxfa2V5ID0gJyc7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVtb3ZlIGFsbCByZWdpc3RyYXRpb25zIGFuZCBlbGlnaWJpbGl0eSBvd25lZCBieSBvbmUgUmVzb3VyY2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gIHJlc291cmNlX2lkICAgICAgICAgIFJlc291cmNlIHdob3NlIHByb2plY3Rpb24gd2FzIHJlcGxhY2VkLlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gcHJlc2VydmVfZWxpZ2liaWxpdHkgV2hldGhlciBzYW1lLWlkZW50aXR5IGNhY2hlIG1heSByZW1haW4uXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbnZhbGlkYXRlX3Jlc291cmNlKCByZXNvdXJjZV9pZCwgcHJlc2VydmVfZWxpZ2liaWxpdHkgKSB7XG5cdFx0XHR2YXIgcmVuZGVyX2lkcyA9IHJlZ2lzdHJhdGlvbl9pZHNfYnlfcmVzb3VyY2VbIHJlc291cmNlX2lkIF0gfHwgW107XG5cblx0XHRcdGlmIChcblx0XHRcdFx0YWN0aXZlX2dlc3R1cmVcblx0XHRcdFx0JiYgKFxuXHRcdFx0XHRcdGFjdGl2ZV9nZXN0dXJlLnJlZ2lzdHJhdGlvbi5yZXNvdXJjZV9pZCA9PT0gcmVzb3VyY2VfaWRcblx0XHRcdFx0XHR8fCBhY3RpdmVfZ2VzdHVyZS50YXJnZXRfcmVzb3VyY2VfaWQgPT09IHJlc291cmNlX2lkXG5cdFx0XHRcdClcblx0XHRcdCkge1xuXHRcdFx0XHRjYW5jZWxfZ2VzdHVyZSggZmFsc2UsICcnICk7XG5cdFx0XHR9XG5cdFx0XHRhYm9ydF9yZXF1ZXN0cyggcmVzb3VyY2VfaWQgKTtcblx0XHRcdHJlbmRlcl9pZHMuZm9yRWFjaCggZnVuY3Rpb24gKCByZW5kZXJfaWQgKSB7XG5cdFx0XHRcdHZhciByZWdpc3RyYXRpb24gPSByZWdpc3RyYXRpb25zX2J5X3JlbmRlcl9pZFsgcmVuZGVyX2lkIF07XG5cblx0XHRcdFx0Y2xlYXJfcmVnaXN0cmF0aW9uX2hvc3QoIHJlZ2lzdHJhdGlvbiApO1xuXHRcdFx0XHRpZiAoICEgcHJlc2VydmVfZWxpZ2liaWxpdHkgJiYgcmVnaXN0cmF0aW9uICYmIGVsaWdpYmlsaXR5X2NhY2hlWyByZWdpc3RyYXRpb24uY2Fub25pY2FsX2tleSBdICkge1xuXHRcdFx0XHRcdGRlbGV0ZSBlbGlnaWJpbGl0eV9jYWNoZVsgcmVnaXN0cmF0aW9uLmNhbm9uaWNhbF9rZXkgXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRkZWxldGUgcmVnaXN0cmF0aW9uc19ieV9yZW5kZXJfaWRbIHJlbmRlcl9pZCBdO1xuXHRcdFx0fSApO1xuXHRcdFx0ZGVsZXRlIHJlZ2lzdHJhdGlvbl9pZHNfYnlfcmVzb3VyY2VbIHJlc291cmNlX2lkIF07XG5cdFx0XHRkZWxldGUgcmVmcmVzaF9pZGVudGl0eV9ieV9yZXNvdXJjZVsgcmVzb3VyY2VfaWQgXTtcblx0XHRcdGlmICggc2VsZWN0ZWRfY2Fub25pY2FsX2tleSAmJiAhIE9iamVjdC5rZXlzKCByZWdpc3RyYXRpb25zX2J5X3JlbmRlcl9pZCApLnNvbWUoIGZ1bmN0aW9uICggcmVuZGVyX2lkICkge1xuXHRcdFx0XHRyZXR1cm4gcmVnaXN0cmF0aW9uc19ieV9yZW5kZXJfaWRbIHJlbmRlcl9pZCBdLmNhbm9uaWNhbF9rZXkgPT09IHNlbGVjdGVkX2Nhbm9uaWNhbF9rZXk7XG5cdFx0XHR9ICkgKSB7XG5cdFx0XHRcdHNlbGVjdGVkX2Nhbm9uaWNhbF9rZXkgPSAnJztcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBOb3JtYWxpemUgYSBjYW5vbmljYWwgcHJvamVjdGVkIHNlZ21lbnQgc3VwcGxpZWQgYnkgYWNjZXB0ZWQgZGF0YS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGNhcmQgQWNjZXB0ZWQgcHJvamVjdGVkIGNhcmQgZWxlbWVudC5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc2VnbWVudCBDYW5vbmljYWwgYWNjZXB0ZWQgc2VnbWVudCBEVE8uXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHByZXNlbnRhdGlvbl9jb250ZXh0IFByZXNlbnRhdGlvbi1vbmx5IHJlZ2lzdHJhdGlvbiBkYXRhLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBDYW5vbmljYWwgcmVnaXN0cmF0aW9uIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbm9ybWFsaXplX3JlZ2lzdHJhdGlvbiggY2FyZCwgc2VnbWVudCwgcHJlc2VudGF0aW9uX2NvbnRleHQgKSB7XG5cdFx0XHR2YXIgcmVzb3VyY2VfaWQgPSBub3JtYWxpemVfcG9zaXRpdmVfaW50ZWdlciggc2VnbWVudCAmJiBzZWdtZW50LnJlc291cmNlX2lkICk7XG5cdFx0XHR2YXIgYm9va2luZ19pZCA9IG5vcm1hbGl6ZV9wb3NpdGl2ZV9pbnRlZ2VyKCBzZWdtZW50ICYmIHNlZ21lbnQuYm9va2luZ19pZCApO1xuXHRcdFx0dmFyIHNlZ21lbnRfaWQgPSBTdHJpbmcoIHNlZ21lbnQgJiYgc2VnbWVudC5zZWdtZW50X2lkIHx8ICcnICk7XG5cdFx0XHR2YXIgdmlzaWJsZV9zdGFydCA9IFN0cmluZyggc2VnbWVudCAmJiBzZWdtZW50LnZpc2libGVfc3RhcnQgfHwgJycgKTtcblx0XHRcdHZhciB2aXNpYmxlX2VuZCA9IFN0cmluZyggc2VnbWVudCAmJiBzZWdtZW50LnZpc2libGVfZW5kIHx8ICcnICk7XG5cdFx0XHR2YXIgcmVuZGVyX2lkID0gU3RyaW5nKCBwcmVzZW50YXRpb25fY29udGV4dCAmJiBwcmVzZW50YXRpb25fY29udGV4dC5yZW5kZXJfc2VnbWVudF9pZCB8fCAnJyApO1xuXHRcdFx0dmFyIGlkZW50aXR5X2tleSA9IHJlZnJlc2hfaWRlbnRpdHlfYnlfcmVzb3VyY2VbIHJlc291cmNlX2lkIF0gfHwgJyc7XG5cdFx0XHR2YXIgYm91bmRhcmllcyA9IHByZXNlbnRhdGlvbl9jb250ZXh0ICYmIHByZXNlbnRhdGlvbl9jb250ZXh0LmJvdW5kYXJ5X3Zpc2liaWxpdHlcblx0XHRcdFx0PyBwcmVzZW50YXRpb25fY29udGV4dC5ib3VuZGFyeV92aXNpYmlsaXR5XG5cdFx0XHRcdDoge307XG5cdFx0XHR2YXIgaW50ZXJhY3Rpb25fYXhpcyA9ICd2ZXJ0aWNhbCcgPT09IFN0cmluZyggcHJlc2VudGF0aW9uX2NvbnRleHQgJiYgcHJlc2VudGF0aW9uX2NvbnRleHQuaW50ZXJhY3Rpb25fYXhpcyB8fCAnJyApXG5cdFx0XHRcdD8gJ3ZlcnRpY2FsJ1xuXHRcdFx0XHQ6ICdob3Jpem9udGFsJztcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHQhIGNhcmRcblx0XHRcdFx0fHwgISBjYXJkLmlzQ29ubmVjdGVkXG5cdFx0XHRcdHx8ICEgYm9va2luZ19pZFxuXHRcdFx0XHR8fCAhIHJlc291cmNlX2lkXG5cdFx0XHRcdHx8ICEgc2VnbWVudF9pZFxuXHRcdFx0XHR8fCAhIHJlbmRlcl9pZFxuXHRcdFx0XHR8fCAhIGlkZW50aXR5X2tleVxuXHRcdFx0XHR8fCAhIGV4YWN0X2luc3RhbnRfcGF0dGVybi50ZXN0KCB2aXNpYmxlX3N0YXJ0IClcblx0XHRcdFx0fHwgISBleGFjdF9pbnN0YW50X3BhdHRlcm4udGVzdCggdmlzaWJsZV9lbmQgKVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRjYXJkOiBjYXJkLFxuXHRcdFx0XHRib29raW5nX2lkOiBib29raW5nX2lkLFxuXHRcdFx0XHRyZXNvdXJjZV9pZDogcmVzb3VyY2VfaWQsXG5cdFx0XHRcdHNlZ21lbnRfaWQ6IHNlZ21lbnRfaWQsXG5cdFx0XHRcdHZpc2libGVfc3RhcnQ6IHZpc2libGVfc3RhcnQsXG5cdFx0XHRcdHZpc2libGVfZW5kOiB2aXNpYmxlX2VuZCxcblx0XHRcdFx0cmVuZGVyX2lkOiByZW5kZXJfaWQsXG5cdFx0XHRcdGlkZW50aXR5X2tleTogaWRlbnRpdHlfa2V5LFxuXHRcdFx0XHRjYW5vbmljYWxfa2V5OiBidWlsZF9jYW5vbmljYWxfa2V5KCBpZGVudGl0eV9rZXksIGJvb2tpbmdfaWQsIHJlc291cmNlX2lkLCBzZWdtZW50X2lkLCB2aXNpYmxlX3N0YXJ0LCB2aXNpYmxlX2VuZCApLFxuXHRcdFx0XHRpc19vdmVyZmxvd2VkOiB0cnVlID09PSBwcmVzZW50YXRpb25fY29udGV4dC5pc19vdmVyZmxvd2VkLFxuXHRcdFx0XHRpbnRlcmFjdGlvbl9heGlzOiBpbnRlcmFjdGlvbl9heGlzLFxuXHRcdFx0XHRib3VuZGFyeV9zdGFydF92aXNpYmxlOiB0cnVlID09PSBib3VuZGFyaWVzLnN0YXJ0LFxuXHRcdFx0XHRib3VuZGFyeV9lbmRfdmlzaWJsZTogdHJ1ZSA9PT0gYm91bmRhcmllcy5lbmRcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQmVnaW4gb25lIFJlc291cmNlLWxvY2FsIHByb2plY3RlZCByZWZyZXNoIGZyb20gYWNjZXB0ZWQgaWRlbnRpdHkuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmVmcmVzaF9jb250ZXh0IFByZXNlbnRhdGlvbiByZWZyZXNoIGNvbnRleHQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBiZWdpbl9yZWFkX29ubHlfcmVmcmVzaCggcmVmcmVzaF9jb250ZXh0ICkge1xuXHRcdFx0dmFyIHJlc291cmNlX2lkID0gbm9ybWFsaXplX3Bvc2l0aXZlX2ludGVnZXIoIHJlZnJlc2hfY29udGV4dCAmJiByZWZyZXNoX2NvbnRleHQucmVzb3VyY2VfaWQgKTtcblx0XHRcdHZhciBsaXZlX2NvbnRleHQ7XG5cdFx0XHR2YXIgaWRlbnRpdHlfa2V5O1xuXHRcdFx0dmFyIHByZXZpb3VzX2lkZW50aXR5X2tleTtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHRTdHJpbmcoIHJlZnJlc2hfY29udGV4dCAmJiByZWZyZXNoX2NvbnRleHQucHJlc2VudGF0aW9uX2lkIHx8ICcnICkgIT09IFN0cmluZyggdGltZV9yb3dzX2NvbmZpZ3VyYXRpb24ucHJlc2VudGF0aW9uX2lkIHx8ICcnIClcblx0XHRcdFx0fHwgISByZXNvdXJjZV9pZFxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGxpdmVfY29udGV4dCA9IGdldF9saXZlX2ludGVyYWN0aW9uX2NvbnRleHQoIHJlc291cmNlX2lkICk7XG5cdFx0XHRpZGVudGl0eV9rZXkgPSBidWlsZF9hY2NlcHRlZF9pZGVudGl0eV9rZXkoIGxpdmVfY29udGV4dCwgc2VsZWN0aW9uX3N0ZXBfbWludXRlcyApO1xuXHRcdFx0cHJldmlvdXNfaWRlbnRpdHlfa2V5ID0gcmVmcmVzaF9pZGVudGl0eV9ieV9yZXNvdXJjZVsgcmVzb3VyY2VfaWQgXSB8fCAnJztcblx0XHRcdGludmFsaWRhdGVfcmVzb3VyY2UoIHJlc291cmNlX2lkLCBCb29sZWFuKCBpZGVudGl0eV9rZXkgJiYgaWRlbnRpdHlfa2V5ID09PSBwcmV2aW91c19pZGVudGl0eV9rZXkgKSApO1xuXHRcdFx0aWYgKCBpZGVudGl0eV9rZXkgKSB7XG5cdFx0XHRcdHJlZnJlc2hfaWRlbnRpdHlfYnlfcmVzb3VyY2VbIHJlc291cmNlX2lkIF0gPSBpZGVudGl0eV9rZXk7XG5cdFx0XHRcdHJlZ2lzdHJhdGlvbl9pZHNfYnlfcmVzb3VyY2VbIHJlc291cmNlX2lkIF0gPSBbXTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWdpc3RlciBvbmUgcHJvamVjdGVkIGNhcmQgd2l0aCBpdHMgYWNjZXB0ZWQgY2Fub25pY2FsIHNlZ21lbnQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjYXJkIFJlbmRlcmVkIHByb2plY3RlZCBib29raW5nIGNhcmQuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNlZ21lbnQgQWNjZXB0ZWQgY2Fub25pY2FsIHNlZ21lbnQgRFRPLlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZXNvdXJjZV9zdW1tYXJ5IEF1dGhvcml6ZWQgUmVzb3VyY2Ugc3VtbWFyeSwgdW51c2VkIGhlcmUuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHByZXNlbnRhdGlvbl9jb250ZXh0IFByZXNlbnRhdGlvbi1vbmx5IHJlbmRlciBtZXRhZGF0YS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlZ2lzdGVyX3JlYWRfb25seV9zZWdtZW50KCBjYXJkLCBzZWdtZW50LCByZXNvdXJjZV9zdW1tYXJ5LCBwcmVzZW50YXRpb25fY29udGV4dCApIHtcblx0XHRcdHZhciByZWdpc3RyYXRpb24gPSBub3JtYWxpemVfcmVnaXN0cmF0aW9uKCBjYXJkLCBzZWdtZW50LCBwcmVzZW50YXRpb25fY29udGV4dCApO1xuXG5cdFx0XHRpZiAoICEgcmVnaXN0cmF0aW9uICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyZWdpc3RyYXRpb25zX2J5X3JlbmRlcl9pZFsgcmVnaXN0cmF0aW9uLnJlbmRlcl9pZCBdID0gcmVnaXN0cmF0aW9uO1xuXHRcdFx0cmVnaXN0cmF0aW9uX2lkc19ieV9yZXNvdXJjZVsgcmVnaXN0cmF0aW9uLnJlc291cmNlX2lkIF0gPSByZWdpc3RyYXRpb25faWRzX2J5X3Jlc291cmNlWyByZWdpc3RyYXRpb24ucmVzb3VyY2VfaWQgXSB8fCBbXTtcblx0XHRcdHJlZ2lzdHJhdGlvbl9pZHNfYnlfcmVzb3VyY2VbIHJlZ2lzdHJhdGlvbi5yZXNvdXJjZV9pZCBdLnB1c2goIHJlZ2lzdHJhdGlvbi5yZW5kZXJfaWQgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBOb3JtYWxpemUgYW4gYXV0aG9yaXRhdGl2ZSBtb3ZlbWVudC1jb250ZXh0IHJlc3BvbnNlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJlc3BvbnNlIEFKQVggcmVzcG9uc2UgZW52ZWxvcGUuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJlZ2lzdHJhdGlvbiBSZXF1ZXN0ZWQgY2Fub25pY2FsIHJlZ2lzdHJhdGlvbi5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gTm9ybWFsaXplZCBtb3ZlbWVudCBlbGlnaWJpbGl0eSBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG5vcm1hbGl6ZV9tb3ZlbWVudF9yZXNwb25zZSggcmVzcG9uc2UsIHJlZ2lzdHJhdGlvbiApIHtcblx0XHRcdHZhciBtb3ZlbWVudCA9IHJlc3BvbnNlICYmIHJlc3BvbnNlLnN1Y2Nlc3MgJiYgcmVzcG9uc2UuZGF0YSA/IHJlc3BvbnNlLmRhdGEubW92ZW1lbnRfY29udGV4dCA6IG51bGw7XG5cdFx0XHR2YXIgYXZhaWxhYmlsaXR5ID0gbW92ZW1lbnQgJiYgbW92ZW1lbnQuZ2VzdHVyZV9hdmFpbGFiaWxpdHkgPyBtb3ZlbWVudC5nZXN0dXJlX2F2YWlsYWJpbGl0eSA6IHt9O1xuXHRcdFx0dmFyIHNjaGVkdWxlX3NlZWQgPSBtb3ZlbWVudCAmJiBtb3ZlbWVudC5zY2hlZHVsZV9zZWVkID8gbW92ZW1lbnQuc2NoZWR1bGVfc2VlZCA6IHt9O1xuXHRcdFx0dmFyIHNlbGVjdGVkX2RhdGVzID0gQXJyYXkuaXNBcnJheSggc2NoZWR1bGVfc2VlZC5zZWxlY3RlZF9kYXRlcyApID8gc2NoZWR1bGVfc2VlZC5zZWxlY3RlZF9kYXRlcy5tYXAoIFN0cmluZyApIDogW107XG5cdFx0XHR2YXIgZXhhY3RfaW50ZXJ2YWxzID0gQXJyYXkuaXNBcnJheSggc2NoZWR1bGVfc2VlZC5leGFjdF9pbnRlcnZhbHMgKSA/IHNjaGVkdWxlX3NlZWQuZXhhY3RfaW50ZXJ2YWxzLm1hcCggZnVuY3Rpb24gKCBpbnRlcnZhbCApIHtcblx0XHRcdFx0cmV0dXJuIE9iamVjdC5mcmVlemUoIHtcblx0XHRcdFx0XHRzdGFydDogU3RyaW5nKCBpbnRlcnZhbCAmJiBpbnRlcnZhbC5zdGFydCB8fCAnJyApLFxuXHRcdFx0XHRcdGVuZDogU3RyaW5nKCBpbnRlcnZhbCAmJiBpbnRlcnZhbC5lbmQgfHwgJycgKVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9ICkgOiBbXTtcblx0XHRcdHZhciBzYW1lX3Jlc291cmNlID0gdHJ1ZSA9PT0gYXZhaWxhYmlsaXR5LnNhbWVfcmVzb3VyY2U7XG5cdFx0XHR2YXIgY3Jvc3NfcmVzb3VyY2UgPSB0cnVlID09PSBhdmFpbGFiaWxpdHkuY3Jvc3NfcmVzb3VyY2U7XG5cdFx0XHR2YXIgc291cmNlX2NvbnRleHRfdG9rZW4gPSBTdHJpbmcoIG1vdmVtZW50ICYmIG1vdmVtZW50LnNvdXJjZV9jb250ZXh0X3Rva2VuIHx8ICcnICk7XG5cdFx0XHR2YXIgdGltZV9hcHBsaWNhdGlvbiA9IFN0cmluZyggc2NoZWR1bGVfc2VlZC50aW1lX2FwcGxpY2F0aW9uIHx8ICcnICk7XG5cdFx0XHR2YXIgc2VsZWN0aW9uX21ldGhvZCA9IFN0cmluZyggc2NoZWR1bGVfc2VlZC5zZWxlY3Rpb25fbWV0aG9kIHx8ICcnICk7XG5cblx0XHRcdGlmIChcblx0XHRcdFx0ISBtb3ZlbWVudFxuXHRcdFx0XHR8fCBOdW1iZXIoIG1vdmVtZW50LmJvb2tpbmdfaWQgKSAhPT0gcmVnaXN0cmF0aW9uLmJvb2tpbmdfaWRcblx0XHRcdFx0fHwgISBub3JtYWxpemVfcG9zaXRpdmVfaW50ZWdlciggbW92ZW1lbnQucHJpbWFyeV9yZXNvdXJjZV9pZCApXG5cdFx0XHRcdHx8ICEgbm9ybWFsaXplX3Bvc2l0aXZlX2ludGVnZXIoIG1vdmVtZW50LnByb3Bvc2FsX3JldmlzaW9uIClcblx0XHRcdFx0fHwgISBzZWxlY3RlZF9kYXRlcy5sZW5ndGhcblx0XHRcdFx0fHwgLTEgPT09IFsgJ3BvbGljeScsICdpbmRpdmlkdWFsJyBdLmluZGV4T2YoIHNlbGVjdGlvbl9tZXRob2QgKVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnZnVsbF9kYXknICE9PSB0aW1lX2FwcGxpY2F0aW9uICYmICggISBleGFjdF9pbnRlcnZhbHMubGVuZ3RoIHx8IGV4YWN0X2ludGVydmFscy5zb21lKCBmdW5jdGlvbiAoIGludGVydmFsICkge1xuXHRcdFx0XHRyZXR1cm4gISBleGFjdF9pbnN0YW50X3BhdHRlcm4udGVzdCggaW50ZXJ2YWwuc3RhcnQgKVxuXHRcdFx0XHRcdHx8ICEgZXhhY3RfaW5zdGFudF9wYXR0ZXJuLnRlc3QoIGludGVydmFsLmVuZCApXG5cdFx0XHRcdFx0fHwgRGF0ZS5wYXJzZSggaW50ZXJ2YWwuZW5kICkgPD0gRGF0ZS5wYXJzZSggaW50ZXJ2YWwuc3RhcnQgKTtcblx0XHRcdH0gKSApICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGlmICggKCBzYW1lX3Jlc291cmNlIHx8IGNyb3NzX3Jlc291cmNlICkgJiYgISBzb3VyY2VfY29udGV4dF90b2tlbiApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGFsbG93ZWQ6IHNhbWVfcmVzb3VyY2UgfHwgY3Jvc3NfcmVzb3VyY2UsXG5cdFx0XHRcdHNhbWVfcmVzb3VyY2U6IHNhbWVfcmVzb3VyY2UsXG5cdFx0XHRcdGNyb3NzX3Jlc291cmNlOiBjcm9zc19yZXNvdXJjZSxcblx0XHRcdFx0c291cmNlX2NvbnRleHRfdG9rZW46IHNvdXJjZV9jb250ZXh0X3Rva2VuLFxuXHRcdFx0XHRib29raW5nX2lkOiByZWdpc3RyYXRpb24uYm9va2luZ19pZCxcblx0XHRcdFx0cHJpbWFyeV9yZXNvdXJjZV9pZDogbm9ybWFsaXplX3Bvc2l0aXZlX2ludGVnZXIoIG1vdmVtZW50LnByaW1hcnlfcmVzb3VyY2VfaWQgKSxcblx0XHRcdFx0cHJvcG9zYWxfcmV2aXNpb246IG5vcm1hbGl6ZV9wb3NpdGl2ZV9pbnRlZ2VyKCBtb3ZlbWVudC5wcm9wb3NhbF9yZXZpc2lvbiApLFxuXHRcdFx0XHRzZWxlY3Rpb25fbWV0aG9kOiBzZWxlY3Rpb25fbWV0aG9kLFxuXHRcdFx0XHR0aW1lX2FwcGxpY2F0aW9uOiB0aW1lX2FwcGxpY2F0aW9uLFxuXHRcdFx0XHRzZWxlY3RlZF9kYXRlczogT2JqZWN0LmZyZWV6ZSggc2VsZWN0ZWRfZGF0ZXMgKSxcblx0XHRcdFx0ZXhhY3RfaW50ZXJ2YWxzOiBPYmplY3QuZnJlZXplKCBleGFjdF9pbnRlcnZhbHMgKVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBOb3JtYWxpemUgYW4gYXV0aG9yaXRhdGl2ZSByZXNpemUtY29udGV4dCByZXNwb25zZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZXNwb25zZSBBSkFYIHJlc3BvbnNlIGVudmVsb3BlLlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZWdpc3RyYXRpb24gUmVxdWVzdGVkIGNhbm9uaWNhbCByZWdpc3RyYXRpb24uXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IE5vcm1hbGl6ZWQgYm91bmRhcnkgZWxpZ2liaWxpdHkgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBub3JtYWxpemVfcmVzaXplX3Jlc3BvbnNlKCByZXNwb25zZSwgcmVnaXN0cmF0aW9uICkge1xuXHRcdFx0dmFyIHJlc2l6ZSA9IHJlc3BvbnNlICYmIHJlc3BvbnNlLnN1Y2Nlc3MgJiYgcmVzcG9uc2UuZGF0YSA/IHJlc3BvbnNlLmRhdGEucmVzaXplX2NvbnRleHQgOiBudWxsO1xuXHRcdFx0dmFyIGJvdW5kYXJpZXMgPSByZXNpemUgJiYgcmVzaXplLmJvdW5kYXJpZXMgPyByZXNpemUuYm91bmRhcmllcyA6IHt9O1xuXHRcdFx0dmFyIGZhbGxiYWNrID0gcmVzaXplICYmIHJlc2l6ZS5mYWxsYmFjayA/IHJlc2l6ZS5mYWxsYmFjayA6IHt9O1xuXHRcdFx0dmFyIHN0YXJ0ID0gYm91bmRhcmllcy5zdGFydCB8fCB7fTtcblx0XHRcdHZhciBlbmQgPSBib3VuZGFyaWVzLmVuZCB8fCB7fTtcblx0XHRcdHZhciBzdGFydF9hbGxvd2VkID0gdHJ1ZSA9PT0gc3RhcnQuZWxpZ2libGUgJiYgJ3Jlc2l6ZV9zdGFydCcgPT09IFN0cmluZyggc3RhcnQub3BlcmF0aW9uIHx8ICcnICk7XG5cdFx0XHR2YXIgZW5kX2FsbG93ZWQgPSB0cnVlID09PSBlbmQuZWxpZ2libGUgJiYgJ3Jlc2l6ZV9lbmQnID09PSBTdHJpbmcoIGVuZC5vcGVyYXRpb24gfHwgJycgKTtcblx0XHRcdHZhciBzb3VyY2VfY29udGV4dF90b2tlbiA9IFN0cmluZyggcmVzaXplICYmIHJlc2l6ZS5zb3VyY2VfY29udGV4dF90b2tlbiB8fCAnJyApO1xuXHRcdFx0dmFyIHNhdmVkX3NoYXBlID0gU3RyaW5nKCByZXNpemUgJiYgcmVzaXplLnNhdmVkX3NoYXBlIHx8ICcnICk7XG5cdFx0XHR2YXIgYWZmZWN0ZWRfaW50ZXJ2YWxzID0gW107XG5cdFx0XHR2YXIgaW1tdXRhYmxlX2ludGVydmFsID0gbnVsbDtcblx0XHRcdHZhciBhbmNob3JfaW50ZXJ2YWxfaW5kZXggPSAtMTtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHQhIHJlc2l6ZVxuXHRcdFx0XHR8fCBOdW1iZXIoIHJlc2l6ZS5zY2hlbWFfdmVyc2lvbiApICE9PSBOdW1iZXIoIHRyYW5zcG9ydC5yZXNpemUgJiYgdHJhbnNwb3J0LnJlc2l6ZS5zY2hlbWFfdmVyc2lvbiApXG5cdFx0XHRcdHx8IE51bWJlciggcmVzaXplLmJvb2tpbmdfaWQgKSAhPT0gcmVnaXN0cmF0aW9uLmJvb2tpbmdfaWRcblx0XHRcdFx0fHwgISBub3JtYWxpemVfcG9zaXRpdmVfaW50ZWdlciggcmVzaXplLnRhcmdldF9yZXNvdXJjZV9pZCApXG5cdFx0XHRcdHx8ICdyZXNpemUnICE9PSBTdHJpbmcoIHJlc2l6ZS5pbnRlcmFjdGlvbl9zb3VyY2UgfHwgJycgKVxuXHRcdFx0XHR8fCAnYm9vbGVhbicgIT09IHR5cGVvZiByZXNpemUuZWxpZ2libGVcblx0XHRcdCkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGlmICggKCB0cnVlID09PSByZXNpemUuZWxpZ2libGUgfHwgc3RhcnRfYWxsb3dlZCB8fCBlbmRfYWxsb3dlZCApICYmICEgc291cmNlX2NvbnRleHRfdG9rZW4gKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBmYWxzZSA9PT0gcmVzaXplLmVsaWdpYmxlICYmICggc3RhcnRfYWxsb3dlZCB8fCBlbmRfYWxsb3dlZCApICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGlmICggZmFsc2UgPT09IHJlc2l6ZS5lbGlnaWJsZSApIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRhbGxvd2VkOiBmYWxzZSxcblx0XHRcdFx0XHRzdGFydDogZmFsc2UsXG5cdFx0XHRcdFx0ZW5kOiBmYWxzZSxcblx0XHRcdFx0XHRmYWxsYmFja19yZWFzb246IFN0cmluZyggZmFsbGJhY2sucmVhc29uIHx8ICcnICksXG5cdFx0XHRcdFx0c291cmNlX2NvbnRleHRfdG9rZW46ICcnXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdGlmIChcblx0XHRcdFx0LTEgPT09IHN1cHBvcnRlZF90aW1lZF9yZXNpemVfc2hhcGVzLmluZGV4T2YoIHNhdmVkX3NoYXBlIClcblx0XHRcdFx0JiYgKCAhIGZ1bGxfZGF5X3Jlc2l6ZV9lbmFibGVkIHx8IC0xID09PSBzdXBwb3J0ZWRfZnVsbF9kYXlfcmVzaXplX3NoYXBlcy5pbmRleE9mKCBzYXZlZF9zaGFwZSApIClcblx0XHRcdCkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGFsbG93ZWQ6IGZhbHNlLFxuXHRcdFx0XHRcdHN0YXJ0OiBmYWxzZSxcblx0XHRcdFx0XHRlbmQ6IGZhbHNlLFxuXHRcdFx0XHRcdGZhbGxiYWNrX3JlYXNvbjogJ2Z1bGxfcmVzY2hlZHVsZScsXG5cdFx0XHRcdFx0c291cmNlX2NvbnRleHRfdG9rZW46ICcnXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRhZmZlY3RlZF9pbnRlcnZhbHMgPSBBcnJheS5pc0FycmF5KCByZXNpemUuYWZmZWN0ZWRfaW50ZXJ2YWxzICkgPyByZXNpemUuYWZmZWN0ZWRfaW50ZXJ2YWxzLm1hcCggZnVuY3Rpb24gKCBpbnRlcnZhbCApIHtcblx0XHRcdFx0dmFyIG5vcm1hbGl6ZWQgPSB7XG5cdFx0XHRcdFx0c3RhcnQ6IFN0cmluZyggaW50ZXJ2YWwgJiYgaW50ZXJ2YWwuc3RhcnQgfHwgJycgKSxcblx0XHRcdFx0XHRlbmQ6IFN0cmluZyggaW50ZXJ2YWwgJiYgaW50ZXJ2YWwuZW5kIHx8ICcnIClcblx0XHRcdFx0fTtcblxuXHRcdFx0XHRyZXR1cm4gZXhhY3RfaW5zdGFudF9wYXR0ZXJuLnRlc3QoIG5vcm1hbGl6ZWQuc3RhcnQgKVxuXHRcdFx0XHRcdCYmIGV4YWN0X2luc3RhbnRfcGF0dGVybi50ZXN0KCBub3JtYWxpemVkLmVuZCApXG5cdFx0XHRcdFx0JiYgRGF0ZS5wYXJzZSggbm9ybWFsaXplZC5lbmQgKSA+IERhdGUucGFyc2UoIG5vcm1hbGl6ZWQuc3RhcnQgKVxuXHRcdFx0XHRcdD8gT2JqZWN0LmZyZWV6ZSggbm9ybWFsaXplZCApXG5cdFx0XHRcdFx0OiBudWxsO1xuXHRcdFx0fSApLmZpbHRlciggQm9vbGVhbiApIDogW107XG5cdFx0XHRpbW11dGFibGVfaW50ZXJ2YWwgPSByZXNpemUuaW1tdXRhYmxlX2ludGVydmFsID8ge1xuXHRcdFx0XHRzdGFydDogU3RyaW5nKCByZXNpemUuaW1tdXRhYmxlX2ludGVydmFsLnN0YXJ0IHx8ICcnICksXG5cdFx0XHRcdGVuZDogU3RyaW5nKCByZXNpemUuaW1tdXRhYmxlX2ludGVydmFsLmVuZCB8fCAnJyApXG5cdFx0XHR9IDogbnVsbDtcblx0XHRcdGlmIChcblx0XHRcdFx0ISBzb3VyY2VfY29udGV4dF90b2tlblxuXHRcdFx0XHR8fCAhIG5vcm1hbGl6ZV9wb3NpdGl2ZV9pbnRlZ2VyKCByZXNpemUucHJvcG9zYWxfcmV2aXNpb24gKVxuXHRcdFx0XHR8fCAhIGltbXV0YWJsZV9pbnRlcnZhbFxuXHRcdFx0XHR8fCAhIGV4YWN0X2luc3RhbnRfcGF0dGVybi50ZXN0KCBpbW11dGFibGVfaW50ZXJ2YWwuc3RhcnQgKVxuXHRcdFx0XHR8fCAhIGV4YWN0X2luc3RhbnRfcGF0dGVybi50ZXN0KCBpbW11dGFibGVfaW50ZXJ2YWwuZW5kIClcblx0XHRcdFx0fHwgRGF0ZS5wYXJzZSggaW1tdXRhYmxlX2ludGVydmFsLmVuZCApIDw9IERhdGUucGFyc2UoIGltbXV0YWJsZV9pbnRlcnZhbC5zdGFydCApXG5cdFx0XHRcdHx8ICEgYWZmZWN0ZWRfaW50ZXJ2YWxzLmxlbmd0aFxuXHRcdFx0XHR8fCBhZmZlY3RlZF9pbnRlcnZhbHMubGVuZ3RoICE9PSBOdW1iZXIoIHJlc2l6ZS5hZmZlY3RlZF9pbnRlcnZhbF9jb3VudCApXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRhZmZlY3RlZF9pbnRlcnZhbHMuc29tZSggZnVuY3Rpb24gKCBpbnRlcnZhbCwgaW5kZXggKSB7XG5cdFx0XHRcdGlmICggaW50ZXJ2YWwuc3RhcnQgPT09IGltbXV0YWJsZV9pbnRlcnZhbC5zdGFydCAmJiBpbnRlcnZhbC5lbmQgPT09IGltbXV0YWJsZV9pbnRlcnZhbC5lbmQgKSB7XG5cdFx0XHRcdFx0YW5jaG9yX2ludGVydmFsX2luZGV4ID0gaW5kZXg7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIC0xID09PSBhbmNob3JfaW50ZXJ2YWxfaW5kZXggfHwgKCAhIHN0YXJ0X2FsbG93ZWQgJiYgISBlbmRfYWxsb3dlZCApICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0YWxsb3dlZDogdHJ1ZSxcblx0XHRcdFx0c3RhcnQ6IHN0YXJ0X2FsbG93ZWQsXG5cdFx0XHRcdGVuZDogZW5kX2FsbG93ZWQsXG5cdFx0XHRcdGJvb2tpbmdfaWQ6IHJlZ2lzdHJhdGlvbi5ib29raW5nX2lkLFxuXHRcdFx0XHR0YXJnZXRfcmVzb3VyY2VfaWQ6IG5vcm1hbGl6ZV9wb3NpdGl2ZV9pbnRlZ2VyKCByZXNpemUudGFyZ2V0X3Jlc291cmNlX2lkICksXG5cdFx0XHRcdHNhdmVkX3NoYXBlOiBzYXZlZF9zaGFwZSxcblx0XHRcdFx0cmVzaXplX3Njb3BlOiBTdHJpbmcoIHJlc2l6ZS5yZXNpemVfc2NvcGUgfHwgJycgKSxcblx0XHRcdFx0cHJvcG9zYWxfcmV2aXNpb246IG5vcm1hbGl6ZV9wb3NpdGl2ZV9pbnRlZ2VyKCByZXNpemUucHJvcG9zYWxfcmV2aXNpb24gKSxcblx0XHRcdFx0c291cmNlX2NvbnRleHRfdG9rZW46IHNvdXJjZV9jb250ZXh0X3Rva2VuLFxuXHRcdFx0XHRpbW11dGFibGVfaW50ZXJ2YWw6IE9iamVjdC5mcmVlemUoIGltbXV0YWJsZV9pbnRlcnZhbCApLFxuXHRcdFx0XHRhZmZlY3RlZF9pbnRlcnZhbHM6IE9iamVjdC5mcmVlemUoIGFmZmVjdGVkX2ludGVydmFscyApLFxuXHRcdFx0XHRhbmNob3JfaW50ZXJ2YWxfaW5kZXg6IGFuY2hvcl9pbnRlcnZhbF9pbmRleCxcblx0XHRcdFx0c2VsZWN0aW9uX21ldGhvZDogJ2luZGVwZW5kZW50X2Z1bGxfZGF5cycgPT09IHNhdmVkX3NoYXBlID8gJ2luZGl2aWR1YWwnIDogJ3BvbGljeScsXG5cdFx0XHRcdGZhbGxiYWNrX3JlYXNvbjogJydcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVwb3J0IHdoZXRoZXIgYSByZWdpc3RyYXRpb24gc3RpbGwgYmVsb25ncyB0byB0aGUgbGl2ZSBhY2NlcHRlZCBpZGVudGl0eS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZWdpc3RyYXRpb24gQ2Fub25pY2FsIHByb2plY3RlZCByZWdpc3RyYXRpb24uXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGlkZW50aXR5LCBnZW9tZXRyeSwgYW5kIERPTSByZW1haW4gY3VycmVudC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpc19yZWdpc3RyYXRpb25fY3VycmVudCggcmVnaXN0cmF0aW9uICkge1xuXHRcdFx0dmFyIGxpdmVfY29udGV4dCA9IHJlZ2lzdHJhdGlvbiA/IGdldF9saXZlX2ludGVyYWN0aW9uX2NvbnRleHQoIHJlZ2lzdHJhdGlvbi5yZXNvdXJjZV9pZCApIDogbnVsbDtcblxuXHRcdFx0cmV0dXJuIEJvb2xlYW4oXG5cdFx0XHRcdHJlZ2lzdHJhdGlvblxuXHRcdFx0XHQmJiByZWdpc3RyYXRpb24uY2FyZFxuXHRcdFx0XHQmJiByZWdpc3RyYXRpb24uY2FyZC5pc0Nvbm5lY3RlZFxuXHRcdFx0XHQmJiByZWdpc3RyYXRpb24uaWRlbnRpdHlfa2V5ID09PSByZWZyZXNoX2lkZW50aXR5X2J5X3Jlc291cmNlWyByZWdpc3RyYXRpb24ucmVzb3VyY2VfaWQgXVxuXHRcdFx0XHQmJiByZWdpc3RyYXRpb24uaWRlbnRpdHlfa2V5ID09PSBidWlsZF9hY2NlcHRlZF9pZGVudGl0eV9rZXkoIGxpdmVfY29udGV4dCwgc2VsZWN0aW9uX3N0ZXBfbWludXRlcyApXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFwcGVuZCBvbmUgY2FyZC1vd25lZCBob3N0IHJlbmRlcmVkIG9ubHkgdGhyb3VnaCBmaXhlZCB0ZW1wbGF0ZXMuXG5cdFx0ICpcblx0XHQgKiBLZWVwaW5nIHRoZSBob3N0IG91dHNpZGUgdGhlIGluZm9ybWF0aW9uIHJhaWwgcHJldmVudHMgZWxpZ2liaWxpdHlcblx0XHQgKiBjb250cm9scyBmcm9tIGRpc3BsYWNpbmcgQm9va2luZyBPdmVydmlldyBhbmQgSW5zcGVjdG9yIGFjdGlvbnMuIFRoZVxuXHRcdCAqIGV4cGxpY2l0IHByZXNlbnRhdGlvbiBheGlzIHNlbGVjdHMgaG9yaXpvbnRhbCBvciB2ZXJ0aWNhbCBjaHJvbWUgd2l0aG91dFxuXHRcdCAqIGRlcml2aW5nIGJ1c2luZXNzIGF1dGhvcml0eSBmcm9tIGNhcmQgbWFya3VwLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJlZ2lzdHJhdGlvbiBDYW5vbmljYWwgcHJvamVjdGVkIHJlZ2lzdHJhdGlvbi5cblx0XHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfSBOZXcgaG9zdCBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNyZWF0ZV9jb250cm9sX2hvc3QoIHJlZ2lzdHJhdGlvbiApIHtcblx0XHRcdHZhciBob3N0O1xuXG5cdFx0XHRpZiAoICEgcmVnaXN0cmF0aW9uLmNhcmQgfHwgISByZWdpc3RyYXRpb24uY2FyZC5hcHBlbmRDaGlsZCB8fCByZWdpc3RyYXRpb24uaXNfb3ZlcmZsb3dlZCApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRob3N0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3NwYW4nICk7XG5cdFx0XHRob3N0LmNsYXNzTmFtZSA9ICd3cGJjX3RpbWVsaW5lX3RpbWVfcm93c19tb3ZlbWVudF9faG9zdCBpcy0nICsgcmVnaXN0cmF0aW9uLmludGVyYWN0aW9uX2F4aXM7XG5cdFx0XHRob3N0LnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3MtbW92ZW1lbnQtaG9zdCcsICcnICk7XG5cdFx0XHRyZWdpc3RyYXRpb24uY2FyZC5hcHBlbmRDaGlsZCggaG9zdCApO1xuXG5cdFx0XHRyZXR1cm4gaG9zdDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgb25lIGFsbG93LWxpc3RlZCB0ZW1wbGF0ZSBpbnRvIGEgbW9kdWxlLW93bmVkIGhvc3QuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBob3N0IE1vZHVsZS1vd25lZCBob3N0LlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZV9zbG90IEZpeGVkIHNlcnZlciB0ZW1wbGF0ZSBzbG90LlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBtb2RlbCBFeGVjdXRhYmxlLWZyZWUgcHJlc2VudGF0aW9uIG1vZGVsLlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBhIHRlbXBsYXRlIHJlbmRlcmVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl90ZW1wbGF0ZSggaG9zdCwgdGVtcGxhdGVfc2xvdCwgbW9kZWwgKSB7XG5cdFx0XHR2YXIgdGVtcGxhdGUgPSBnZXRfdGVtcGxhdGUoIHRlbXBsYXRlX3Nsb3QgKTtcblxuXHRcdFx0aWYgKCAhIGhvc3QgfHwgISB0ZW1wbGF0ZSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aG9zdC5pbnNlcnRBZGphY2VudEhUTUwoICdiZWZvcmVlbmQnLCB0ZW1wbGF0ZSggbW9kZWwgfHwge30gKSApO1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gYWxsIGxpdmUgZnJhZ21lbnRzIHJlc29sdmVkIHRvIG9uZSBjYW5vbmljYWwgYWNjZXB0ZWQgc2VnbWVudC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBjYW5vbmljYWxfa2V5IEFjY2VwdGVkIGNhbm9uaWNhbCBjYWNoZSBrZXkuXG5cdFx0ICogQHJldHVybiB7QXJyYXk8T2JqZWN0Pn0gQ3VycmVudCBjYW5vbmljYWwgcmVnaXN0cmF0aW9ucy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfY2Fub25pY2FsX3JlZ2lzdHJhdGlvbnMoIGNhbm9uaWNhbF9rZXkgKSB7XG5cdFx0XHRyZXR1cm4gT2JqZWN0LmtleXMoIHJlZ2lzdHJhdGlvbnNfYnlfcmVuZGVyX2lkICkubWFwKCBmdW5jdGlvbiAoIHJlbmRlcl9pZCApIHtcblx0XHRcdFx0cmV0dXJuIHJlZ2lzdHJhdGlvbnNfYnlfcmVuZGVyX2lkWyByZW5kZXJfaWQgXTtcblx0XHRcdH0gKS5maWx0ZXIoIGZ1bmN0aW9uICggcmVnaXN0cmF0aW9uICkge1xuXHRcdFx0XHRyZXR1cm4gcmVnaXN0cmF0aW9uLmNhbm9uaWNhbF9rZXkgPT09IGNhbm9uaWNhbF9rZXkgJiYgaXNfcmVnaXN0cmF0aW9uX2N1cnJlbnQoIHJlZ2lzdHJhdGlvbiApO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE1lYXN1cmUgbG9naWNhbCBkYXRlIGNvbHVtbnMgZm9yIG9uZSBnZXN0dXJlLW93bmVkIGdlb21ldHJ5IHNuYXBzaG90LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFbGVtZW50fSBzdXJmYWNlICAgRXhwYW5kZWQgYWxsLWRheSBvciB0aW1lZCBzdXJmYWNlLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgZGlyZWN0aW9uIGx0ciBvciBydGwuXG5cdFx0ICogQHJldHVybiB7QXJyYXk8T2JqZWN0Pn0gT3JkZXJlZCBsb2dpY2FsIGNvbHVtbiBEVE9zLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG1lYXN1cmVfZGF0ZV9jb2x1bW5zKCBzdXJmYWNlLCBkaXJlY3Rpb24gKSB7XG5cdFx0XHR2YXIgc3VyZmFjZV9yZWN0ID0gc3VyZmFjZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuXHRcdFx0cmV0dXJuIEFycmF5LnByb3RvdHlwZS5tYXAuY2FsbCggc3VyZmFjZS5xdWVyeVNlbGVjdG9yQWxsKCBkYXRlX2NvbHVtbl9zZWxlY3RvciApLCBmdW5jdGlvbiAoIGNvbHVtbiApIHtcblx0XHRcdFx0dmFyIGNvbHVtbl9yZWN0ID0gY29sdW1uLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZGF0ZTogU3RyaW5nKCBjb2x1bW4uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1kYXRlJyApIHx8ICcnICksXG5cdFx0XHRcdFx0bG9naWNhbF9zdGFydDogTWF0aC5tYXgoIDAsICdydGwnID09PSBkaXJlY3Rpb24gPyBzdXJmYWNlX3JlY3QucmlnaHQgLSBjb2x1bW5fcmVjdC5yaWdodCA6IGNvbHVtbl9yZWN0LmxlZnQgLSBzdXJmYWNlX3JlY3QubGVmdCApLFxuXHRcdFx0XHRcdGxvZ2ljYWxfZW5kOiBNYXRoLm1heCggMCwgJ3J0bCcgPT09IGRpcmVjdGlvbiA/IHN1cmZhY2VfcmVjdC5yaWdodCAtIGNvbHVtbl9yZWN0LmxlZnQgOiBjb2x1bW5fcmVjdC5yaWdodCAtIHN1cmZhY2VfcmVjdC5sZWZ0IClcblx0XHRcdFx0fTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBQcmVwYXJlIG9uZSBpbW11dGFibGUgYWNjZXB0ZWQgYW5kIG1lYXN1cmVkIHN1cmZhY2Ugc25hcHNob3QuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgQXV0aG9yaXplZCBvcGVuIFJlc291cmNlIElELlxuXHRcdCAqIEBwYXJhbSB7RWxlbWVudH0gc3VyZmFjZSBFeHBhbmRlZCBhbGwtZGF5IG9yIHRpbWVkIHN1cmZhY2UuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGludGVyYWN0aW9uX2F4aXMgaG9yaXpvbnRhbCBvciB2ZXJ0aWNhbC5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gR2VzdHVyZSBjb250ZXh0IG9yIG51bGwgd2hlbiBpZGVudGl0eSBpcyBzdGFsZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBwcmVwYXJlX3N1cmZhY2VfY29udGV4dCggcmVzb3VyY2VfaWQsIHN1cmZhY2UsIGludGVyYWN0aW9uX2F4aXMgKSB7XG5cdFx0XHR2YXIgYWNjZXB0ZWRfY29udGV4dCA9IGdldF9saXZlX2ludGVyYWN0aW9uX2NvbnRleHQoIHJlc291cmNlX2lkICk7XG5cdFx0XHR2YXIgZGlyZWN0aW9uO1xuXHRcdFx0dmFyIHN1cmZhY2Vfc3R5bGU7XG5cdFx0XHR2YXIgc3VyZmFjZV9yZWN0O1xuXHRcdFx0dmFyIGJvb2tpbmdfY29sdW1uX2d1dHRlcl9weDtcblx0XHRcdHZhciBwcmVwYXJlZDtcblx0XHRcdHZhciBpZGVudGl0eV9rZXk7XG5cblx0XHRcdGlmIChcblx0XHRcdFx0ISBzdXJmYWNlXG5cdFx0XHRcdHx8ICEgYWNjZXB0ZWRfY29udGV4dFxuXHRcdFx0XHR8fCAhIGdlb21ldHJ5XG5cdFx0XHRcdHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBnZW9tZXRyeS5wcmVwYXJlX2dlb21ldHJ5XG5cdFx0XHRcdHx8ICEgTnVtYmVyLmlzSW50ZWdlciggc2VsZWN0aW9uX3N0ZXBfbWludXRlcyApXG5cdFx0XHRcdHx8IDEgPiBzZWxlY3Rpb25fc3RlcF9taW51dGVzXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRpZGVudGl0eV9rZXkgPSBidWlsZF9hY2NlcHRlZF9pZGVudGl0eV9rZXkoIGFjY2VwdGVkX2NvbnRleHQsIHNlbGVjdGlvbl9zdGVwX21pbnV0ZXMgKTtcblx0XHRcdGlmICggISBpZGVudGl0eV9rZXkgfHwgaWRlbnRpdHlfa2V5ICE9PSByZWZyZXNoX2lkZW50aXR5X2J5X3Jlc291cmNlWyByZXNvdXJjZV9pZCBdICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHN1cmZhY2Vfc3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSggc3VyZmFjZSApO1xuXHRcdFx0ZGlyZWN0aW9uID0gJ3J0bCcgPT09IHN1cmZhY2Vfc3R5bGUuZGlyZWN0aW9uID8gJ3J0bCcgOiAnbHRyJztcblx0XHRcdGJvb2tpbmdfY29sdW1uX2d1dHRlcl9weCA9IHBhcnNlRmxvYXQoIHN1cmZhY2Vfc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSggJy0td3BiYy10aW1lLXJvd3MtYm9va2luZy1jb2x1bW4tZ3V0dGVyJyApICk7XG5cdFx0XHRib29raW5nX2NvbHVtbl9ndXR0ZXJfcHggPSBOdW1iZXIuaXNGaW5pdGUoIGJvb2tpbmdfY29sdW1uX2d1dHRlcl9weCApID8gTWF0aC5tYXgoIDAsIGJvb2tpbmdfY29sdW1uX2d1dHRlcl9weCApIDogMDtcblx0XHRcdHN1cmZhY2VfcmVjdCA9IHN1cmZhY2UuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRwcmVwYXJlZCA9IGdlb21ldHJ5LnByZXBhcmVfZ2VvbWV0cnkoIHtcblx0XHRcdFx0YWNjZXB0ZWRfaWRlbnRpdHk6IGFjY2VwdGVkX2NvbnRleHQuYWNjZXB0ZWRfaWRlbnRpdHksXG5cdFx0XHRcdGRhdGVfYmFuZHM6IGFjY2VwdGVkX2NvbnRleHQuZGF0ZV9iYW5kcyxcblx0XHRcdFx0ZGF0ZV9jb2x1bW5zOiBtZWFzdXJlX2RhdGVfY29sdW1ucyggc3VyZmFjZSwgZGlyZWN0aW9uICksXG5cdFx0XHRcdHZpc2libGVfcmFuZ2U6IGFjY2VwdGVkX2NvbnRleHQudmlzaWJsZV9yYW5nZSxcblx0XHRcdFx0em9vbV9wZXJjZW50OiBhY2NlcHRlZF9jb250ZXh0Lnpvb21fcGVyY2VudCxcblx0XHRcdFx0aG91cl9oZWlnaHRfcHg6IGFjY2VwdGVkX2NvbnRleHQuaG91cl9oZWlnaHRfcHgsXG5cdFx0XHRcdGJsb2NrX2V4dGVudF9weDogc3VyZmFjZV9yZWN0LmhlaWdodCxcblx0XHRcdFx0c2VsZWN0aW9uX3N0ZXBfbWludXRlczogc2VsZWN0aW9uX3N0ZXBfbWludXRlcyxcblx0XHRcdFx0ZGlyZWN0aW9uOiBkaXJlY3Rpb25cblx0XHRcdH0gKTtcblx0XHRcdGlmICggISBwcmVwYXJlZCB8fCAncmVhZHknICE9PSBwcmVwYXJlZC5zdGF0dXMgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRyZXNvdXJjZV9pZDogcmVzb3VyY2VfaWQsXG5cdFx0XHRcdGlkZW50aXR5X2tleTogaWRlbnRpdHlfa2V5LFxuXHRcdFx0XHRpbnRlcmFjdGlvbl9heGlzOiBpbnRlcmFjdGlvbl9heGlzLFxuXHRcdFx0XHRzdXJmYWNlOiBzdXJmYWNlLFxuXHRcdFx0XHRzdXJmYWNlX3JlY3Q6IHN1cmZhY2VfcmVjdCxcblx0XHRcdFx0Ym9va2luZ19jb2x1bW5fZ3V0dGVyX3B4OiBib29raW5nX2NvbHVtbl9ndXR0ZXJfcHgsXG5cdFx0XHRcdHNuYXBzaG90OiBwcmVwYXJlZC5zbmFwc2hvdCxcblx0XHRcdFx0c2VsZWN0aW9uX2tpbmQ6ICd2ZXJ0aWNhbCcgPT09IGludGVyYWN0aW9uX2F4aXMgPyAndGltZWQnIDogJ2FsbF9kYXknXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFByZXBhcmUgb25lIGltbXV0YWJsZSBhY2NlcHRlZCBhbmQgbWVhc3VyZWQgc291cmNlIHNuYXBzaG90LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJlZ2lzdHJhdGlvbiBDdXJyZW50IGNhbm9uaWNhbCBwcm9qZWN0ZWQgcmVnaXN0cmF0aW9uLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBHZXN0dXJlIGNvbnRleHQgb3IgbnVsbCB3aGVuIGlkZW50aXR5IGlzIHN0YWxlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHByZXBhcmVfZ2VzdHVyZV9jb250ZXh0KCByZWdpc3RyYXRpb24gKSB7XG5cdFx0XHR2YXIgc3VyZmFjZSA9IHJlZ2lzdHJhdGlvbiAmJiByZWdpc3RyYXRpb24uY2FyZCAmJiByZWdpc3RyYXRpb24uY2FyZC5jbG9zZXN0XG5cdFx0XHRcdD8gcmVnaXN0cmF0aW9uLmNhcmQuY2xvc2VzdCggJ3ZlcnRpY2FsJyA9PT0gcmVnaXN0cmF0aW9uLmludGVyYWN0aW9uX2F4aXMgPyB0aW1lZF9zdXJmYWNlX3NlbGVjdG9yIDogYWxsX2RheV9zdXJmYWNlX3NlbGVjdG9yIClcblx0XHRcdFx0OiBudWxsO1xuXG5cdFx0XHRpZiAoICEgcmVnaXN0cmF0aW9uIHx8ICEgc3VyZmFjZSB8fCAhIGlzX3JlZ2lzdHJhdGlvbl9jdXJyZW50KCByZWdpc3RyYXRpb24gKSApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBwcmVwYXJlX3N1cmZhY2VfY29udGV4dCggcmVnaXN0cmF0aW9uLnJlc291cmNlX2lkLCBzdXJmYWNlLCByZWdpc3RyYXRpb24uaW50ZXJhY3Rpb25fYXhpcyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENvbnZlcnQgb25lIHBvaW50ZXIgZXZlbnQgdG8gYSBwdXJlIGdlb21ldHJ5IGNvb3JkaW5hdGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZ2VzdHVyZV9jb250ZXh0IEZyb3plbiBnZW9tZXRyeSBjb250ZXh0LlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBldmVudCAgICAgICAgICAgUG9pbnRlci1saWtlIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gR2VvbWV0cnkgY29vcmRpbmF0ZSBEVE8uXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcG9pbnRlcl9jb29yZGluYXRlKCBnZXN0dXJlX2NvbnRleHQsIGV2ZW50ICkge1xuXHRcdFx0dmFyIHN1cmZhY2VfcmVjdCA9IGdlc3R1cmVfY29udGV4dC5zdXJmYWNlX3JlY3Q7XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHNvdXJjZTogJ3BvaW50ZXInLFxuXHRcdFx0XHRzZWxlY3Rpb25fa2luZDogZ2VzdHVyZV9jb250ZXh0LnNlbGVjdGlvbl9raW5kLFxuXHRcdFx0XHRpbmxpbmVfcHg6IE51bWJlciggZXZlbnQuY2xpZW50WCApIC0gc3VyZmFjZV9yZWN0LmxlZnQsXG5cdFx0XHRcdGJsb2NrX3B4OiBOdW1iZXIoIGV2ZW50LmNsaWVudFkgKSAtIHN1cmZhY2VfcmVjdC50b3Bcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29udmVydCBwb2ludGVyIGRpc3BsYWNlbWVudCB0byBhIHJlbGF0aXZlIHRpbWVkIHJlc2l6ZSB3YWxsIGNvb3JkaW5hdGUuXG5cdFx0ICpcblx0XHQgKiBUaGUgcG9pbnRlci1kb3duIHBvc2l0aW9uIGlzIHRoZSBwaHlzaWNhbCBvcmlnaW4uIEVhY2ggY29tcGxldGUgdmlzdWFsXG5cdFx0ICogc3RlcCBjaGFuZ2VzIHRoZSBpbW11dGFibGUgc2F2ZWQgd2FsbCBtaW51dGUgYnkgb25lIHNlcnZlci1vd25lZCBzdGVwLCBzb1xuXHRcdCAqIGFuIG9mZi1ncmlkIGJvdW5kYXJ5IHJldGFpbnMgaXRzIG1pbnV0ZSByZW1haW5kZXIuIEhvcml6b250YWwgbW92ZW1lbnQgaXNcblx0XHQgKiBpbnRlbnRpb25hbGx5IGlnbm9yZWQgYmVjYXVzZSBuYXRpdmUgVGltZWxpbmUgcmVtYWlucyB0aGUgZGF0ZS1ib3VuZGFyeVxuXHRcdCAqIHdvcmtmbG93LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGdlc3R1cmUgQWN0aXZlIGF1dGhvcml6ZWQgdGltZWQgcmVzaXplIGdlc3R1cmUuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGV2ZW50ICAgUG9pbnRlci1saWtlIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gUG9pbnRlciBnZW9tZXRyeSBjb29yZGluYXRlIGxvY2tlZCB0byB0aGUgc291cmNlIGRhdGUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gdGltZWRfcmVzaXplX3BvaW50ZXJfY29vcmRpbmF0ZSggZ2VzdHVyZSwgZXZlbnQgKSB7XG5cdFx0XHR2YXIgc25hcHNob3QgPSBnZXN0dXJlLmNvbnRleHQuc25hcHNob3Q7XG5cdFx0XHR2YXIgc3RlcF9oZWlnaHQgPSBzbmFwc2hvdC5zZWxlY3Rpb25fc3RlcF9taW51dGVzICogc25hcHNob3QucGl4ZWxzX3Blcl9taW51dGU7XG5cdFx0XHR2YXIgcG9pbnRlcl9kZWx0YSA9IE51bWJlciggZXZlbnQuY2xpZW50WSApIC0gZ2VzdHVyZS5wb2ludGVyX3N0YXJ0X2NsaWVudF95O1xuXHRcdFx0dmFyIHN0ZXBfZGVsdGEgPSAwID4gcG9pbnRlcl9kZWx0YVxuXHRcdFx0XHQ/IC1NYXRoLnJvdW5kKCBNYXRoLmFicyggcG9pbnRlcl9kZWx0YSAvIHN0ZXBfaGVpZ2h0ICkgKVxuXHRcdFx0XHQ6IE1hdGgucm91bmQoIHBvaW50ZXJfZGVsdGEgLyBzdGVwX2hlaWdodCApO1xuXHRcdFx0dmFyIG1pbmltdW1fc3RlcF9kZWx0YSA9IE1hdGguY2VpbChcblx0XHRcdFx0KCBzbmFwc2hvdC52aXNpYmxlX3JhbmdlLnN0YXJ0X21pbnV0ZSAtIGdlc3R1cmUub3JpZ2luLndhbGxfbWludXRlICkgLyBzbmFwc2hvdC5zZWxlY3Rpb25fc3RlcF9taW51dGVzXG5cdFx0XHQpO1xuXHRcdFx0dmFyIG1heGltdW1fc3RlcF9kZWx0YSA9IE1hdGguZmxvb3IoXG5cdFx0XHRcdCggc25hcHNob3QudmlzaWJsZV9yYW5nZS5lbmRfbWludXRlIC0gZ2VzdHVyZS5vcmlnaW4ud2FsbF9taW51dGUgKSAvIHNuYXBzaG90LnNlbGVjdGlvbl9zdGVwX21pbnV0ZXNcblx0XHRcdCk7XG5cblx0XHRcdHN0ZXBfZGVsdGEgPSBNYXRoLm1heCggbWluaW11bV9zdGVwX2RlbHRhLCBNYXRoLm1pbiggbWF4aW11bV9zdGVwX2RlbHRhLCBzdGVwX2RlbHRhICkgKTtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0c291cmNlOiAncmVsYXRpdmVfcmVzaXplJyxcblx0XHRcdFx0c2VsZWN0aW9uX2tpbmQ6ICd0aW1lZCcsXG5cdFx0XHRcdGRhdGU6IGdlc3R1cmUub3JpZ2luLmRhdGUsXG5cdFx0XHRcdHdhbGxfbWludXRlOiBnZXN0dXJlLm9yaWdpbi53YWxsX21pbnV0ZSArIHN0ZXBfZGVsdGEgKiBzbmFwc2hvdC5zZWxlY3Rpb25fc3RlcF9taW51dGVzXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENvbmZpcm0gdGhhdCBhIHByZXBhcmVkIFJlc291cmNlIGdlb21ldHJ5IGNvbnRleHQgaXMgc3RpbGwgYWNjZXB0ZWQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZ2VzdHVyZV9jb250ZXh0IFByZXBhcmVkIFJlc291cmNlLWxvY2FsIGdlb21ldHJ5LlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hpbGUgYXV0aG9yaXphdGlvbiBhbmQgZ2VvbWV0cnkgaWRlbnRpdHkgbWF0Y2guXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaXNfZ2VzdHVyZV9jb250ZXh0X2N1cnJlbnQoIGdlc3R1cmVfY29udGV4dCApIHtcblx0XHRcdHZhciBhY2NlcHRlZF9jb250ZXh0ID0gZ2VzdHVyZV9jb250ZXh0ID8gZ2V0X2xpdmVfaW50ZXJhY3Rpb25fY29udGV4dCggZ2VzdHVyZV9jb250ZXh0LnJlc291cmNlX2lkICkgOiBudWxsO1xuXG5cdFx0XHRyZXR1cm4gQm9vbGVhbihcblx0XHRcdFx0Z2VzdHVyZV9jb250ZXh0XG5cdFx0XHRcdCYmIGdlc3R1cmVfY29udGV4dC5zdXJmYWNlXG5cdFx0XHRcdCYmIGdlc3R1cmVfY29udGV4dC5zdXJmYWNlLmlzQ29ubmVjdGVkXG5cdFx0XHRcdCYmIGdlc3R1cmVfY29udGV4dC5pZGVudGl0eV9rZXkgPT09IHJlZnJlc2hfaWRlbnRpdHlfYnlfcmVzb3VyY2VbIGdlc3R1cmVfY29udGV4dC5yZXNvdXJjZV9pZCBdXG5cdFx0XHRcdCYmIGdlc3R1cmVfY29udGV4dC5pZGVudGl0eV9rZXkgPT09IGJ1aWxkX2FjY2VwdGVkX2lkZW50aXR5X2tleSggYWNjZXB0ZWRfY29udGV4dCwgc2VsZWN0aW9uX3N0ZXBfbWludXRlcyApXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc29sdmUgYSBwb2ludGVyIGludG8gb25lIGF1dGhvcml6ZWQgZXhwYW5kZWQgUmVzb3VyY2Ugc3VyZmFjZS5cblx0XHQgKlxuXHRcdCAqIFRhcmdldCBoaXQgdGVzdGluZyBhbmQgZ2VvbWV0cnkgcmVtYWluIGVudGlyZWx5IGluc2lkZSB0aGlzIFRpbWUgUm93c1xuXHRcdCAqIGFkYXB0ZXIuIFRoZSBleGlzdGluZyBib29raW5nLW1vdmVtZW50IG1vZHVsZSByZWNlaXZlcyBvbmx5IHRoZSBmaW5hbFxuXHRcdCAqIHByZXNlbnRhdGlvbi1uZXV0cmFsIHByb3Bvc2FsLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGdlc3R1cmUgQWN0aXZlIG1vdmVtZW50IGdlc3R1cmUuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGV2ZW50IFBvaW50ZXItbGlrZSBldmVudC5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gVGFyZ2V0IGNvbnRleHQsIFJlc291cmNlLCBhbmQgY29vcmRpbmF0ZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXNvbHZlX3BvaW50ZXJfbW92ZW1lbnRfdGFyZ2V0KCBnZXN0dXJlLCBldmVudCApIHtcblx0XHRcdHZhciBzZWxlY3RvciA9ICd2ZXJ0aWNhbCcgPT09IGdlc3R1cmUucmVnaXN0cmF0aW9uLmludGVyYWN0aW9uX2F4aXMgPyB0aW1lZF9zdXJmYWNlX3NlbGVjdG9yIDogYWxsX2RheV9zdXJmYWNlX3NlbGVjdG9yO1xuXHRcdFx0dmFyIGNsaWVudF94ID0gTnVtYmVyKCBldmVudC5jbGllbnRYICk7XG5cdFx0XHR2YXIgY2xpZW50X3kgPSBOdW1iZXIoIGV2ZW50LmNsaWVudFkgKTtcblx0XHRcdHZhciBwb2ludF90YXJnZXQgPSBkb2N1bWVudCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgZG9jdW1lbnQuZWxlbWVudEZyb21Qb2ludFxuXHRcdFx0XHQ/IGRvY3VtZW50LmVsZW1lbnRGcm9tUG9pbnQoIGNsaWVudF94LCBjbGllbnRfeSApXG5cdFx0XHRcdDogbnVsbDtcblx0XHRcdHZhciBtYXRjaGVkX3N1cmZhY2UgPSBudWxsO1xuXHRcdFx0dmFyIHN1cmZhY2VzO1xuXHRcdFx0dmFyIHBhbmVsO1xuXHRcdFx0dmFyIHJlc291cmNlX2lkO1xuXHRcdFx0dmFyIGlzX2Nyb3NzX3Jlc291cmNlO1xuXHRcdFx0dmFyIHRhcmdldF9jb250ZXh0O1xuXG5cdFx0XHRtYXRjaGVkX3N1cmZhY2UgPSBwb2ludF90YXJnZXQgJiYgcG9pbnRfdGFyZ2V0LmNsb3Nlc3QgPyBwb2ludF90YXJnZXQuY2xvc2VzdCggc2VsZWN0b3IgKSA6IG51bGw7XG5cdFx0XHRpZiAoIG1hdGNoZWRfc3VyZmFjZSAmJiBtb3VudCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgbW91bnQuY29udGFpbnMgJiYgISBtb3VudC5jb250YWlucyggbWF0Y2hlZF9zdXJmYWNlICkgKSB7XG5cdFx0XHRcdG1hdGNoZWRfc3VyZmFjZSA9IG51bGw7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgbWF0Y2hlZF9zdXJmYWNlICYmICEgcG9pbnRfdGFyZ2V0ICkge1xuXHRcdFx0XHRzdXJmYWNlcyA9IG1vdW50ICYmIG1vdW50LnF1ZXJ5U2VsZWN0b3JBbGwgPyBtb3VudC5xdWVyeVNlbGVjdG9yQWxsKCBzZWxlY3RvciApIDogW107XG5cdFx0XHRcdEFycmF5LnByb3RvdHlwZS5zb21lLmNhbGwoIHN1cmZhY2VzLCBmdW5jdGlvbiAoIHN1cmZhY2UgKSB7XG5cdFx0XHRcdFx0dmFyIHJlY3RhbmdsZSA9IHN1cmZhY2UuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cblx0XHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0XHRjbGllbnRfeCA8IHJlY3RhbmdsZS5sZWZ0XG5cdFx0XHRcdFx0XHR8fCBjbGllbnRfeCA+IHJlY3RhbmdsZS5yaWdodFxuXHRcdFx0XHRcdFx0fHwgY2xpZW50X3kgPCByZWN0YW5nbGUudG9wXG5cdFx0XHRcdFx0XHR8fCBjbGllbnRfeSA+IHJlY3RhbmdsZS5ib3R0b21cblx0XHRcdFx0XHQpIHtcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bWF0Y2hlZF9zdXJmYWNlID0gc3VyZmFjZTtcblxuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgbWF0Y2hlZF9zdXJmYWNlICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHBhbmVsID0gbWF0Y2hlZF9zdXJmYWNlLmNsb3Nlc3QgPyBtYXRjaGVkX3N1cmZhY2UuY2xvc2VzdCggdGltZV9yb3dzX3BhbmVsX3NlbGVjdG9yICkgOiBudWxsO1xuXHRcdFx0cmVzb3VyY2VfaWQgPSBub3JtYWxpemVfcG9zaXRpdmVfaW50ZWdlciggcGFuZWwgJiYgcGFuZWwuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1yZXNvdXJjZS1pZCcgKSApO1xuXHRcdFx0aXNfY3Jvc3NfcmVzb3VyY2UgPSByZXNvdXJjZV9pZCAmJiByZXNvdXJjZV9pZCAhPT0gZ2VzdHVyZS5yZWdpc3RyYXRpb24ucmVzb3VyY2VfaWQ7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdCEgcmVzb3VyY2VfaWRcblx0XHRcdFx0fHwgKCAhIGlzX2Nyb3NzX3Jlc291cmNlICYmICEgZ2VzdHVyZS5lbGlnaWJpbGl0eS5tb3ZlbWVudC5zYW1lX3Jlc291cmNlIClcblx0XHRcdFx0fHwgKFxuXHRcdFx0XHRcdGlzX2Nyb3NzX3Jlc291cmNlXG5cdFx0XHRcdFx0JiYgKCAhIGNyb3NzX3Jlc291cmNlX21vdmVtZW50X2VuYWJsZWQgfHwgISBnZXN0dXJlLmVsaWdpYmlsaXR5Lm1vdmVtZW50LmNyb3NzX3Jlc291cmNlIClcblx0XHRcdFx0KVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0Z2VzdHVyZS50YXJnZXRfY29udGV4dHMgPSBnZXN0dXJlLnRhcmdldF9jb250ZXh0cyB8fCBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0XHR0YXJnZXRfY29udGV4dCA9IGdlc3R1cmUudGFyZ2V0X2NvbnRleHRzWyByZXNvdXJjZV9pZCBdO1xuXHRcdFx0aWYgKCAhIHRhcmdldF9jb250ZXh0IHx8IHRhcmdldF9jb250ZXh0LnN1cmZhY2UgIT09IG1hdGNoZWRfc3VyZmFjZSB8fCAhIGlzX2dlc3R1cmVfY29udGV4dF9jdXJyZW50KCB0YXJnZXRfY29udGV4dCApICkge1xuXHRcdFx0XHR0YXJnZXRfY29udGV4dCA9IHByZXBhcmVfc3VyZmFjZV9jb250ZXh0KCByZXNvdXJjZV9pZCwgbWF0Y2hlZF9zdXJmYWNlLCBnZXN0dXJlLnJlZ2lzdHJhdGlvbi5pbnRlcmFjdGlvbl9heGlzICk7XG5cdFx0XHRcdGlmICggISB0YXJnZXRfY29udGV4dCApIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRnZXN0dXJlLnRhcmdldF9jb250ZXh0c1sgcmVzb3VyY2VfaWQgXSA9IHRhcmdldF9jb250ZXh0O1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRjb250ZXh0OiB0YXJnZXRfY29udGV4dCxcblx0XHRcdFx0cmVzb3VyY2VfaWQ6IHJlc291cmNlX2lkLFxuXHRcdFx0XHRpc19jcm9zc19yZXNvdXJjZTogaXNfY3Jvc3NfcmVzb3VyY2UsXG5cdFx0XHRcdGNvb3JkaW5hdGU6IHBvaW50ZXJfY29vcmRpbmF0ZSggdGFyZ2V0X2NvbnRleHQsIGV2ZW50IClcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIGEgYm91bmRlZCBrZXlib2FyZCBjb29yZGluYXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNuYXBzaG90ICAgICAgIEZyb3plbiBnZW9tZXRyeSBzbmFwc2hvdC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gc2VsZWN0aW9uX2tpbmQgdGltZWQgb3IgYWxsX2RheS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZGF0ZSAgICAgICAgICAgQWNjZXB0ZWQgc2VydmVyIGRhdGUuXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHNuYXBfaW5kZXggICAgIENhbmRpZGF0ZSBzdGVwIGluZGV4LlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gS2V5Ym9hcmQgY29vcmRpbmF0ZSBEVE8uXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24ga2V5Ym9hcmRfY29vcmRpbmF0ZSggc25hcHNob3QsIHNlbGVjdGlvbl9raW5kLCBkYXRlLCBzbmFwX2luZGV4ICkge1xuXHRcdFx0dmFyIG1heGltdW1faW5kZXggPSAnYWxsX2RheScgPT09IHNlbGVjdGlvbl9raW5kXG5cdFx0XHRcdD8gMFxuXHRcdFx0XHQ6IE1hdGgubWF4KCAwLCBNYXRoLmNlaWwoICggc25hcHNob3QudmlzaWJsZV9yYW5nZS5lbmRfbWludXRlIC0gc25hcHNob3QudmlzaWJsZV9yYW5nZS5zdGFydF9taW51dGUgKSAvIHNuYXBzaG90LnNlbGVjdGlvbl9zdGVwX21pbnV0ZXMgKSAtIDEgKTtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0c291cmNlOiAna2V5Ym9hcmQnLFxuXHRcdFx0XHRzZWxlY3Rpb25fa2luZDogc2VsZWN0aW9uX2tpbmQsXG5cdFx0XHRcdGRhdGU6IFN0cmluZyggZGF0ZSB8fCAnJyApLFxuXHRcdFx0XHRzbmFwX2luZGV4OiBNYXRoLm1heCggMCwgTWF0aC5taW4oIG1heGltdW1faW5kZXgsIE51bWJlciggc25hcF9pbmRleCApIHx8IDAgKSApXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNoaWZ0IG9uZSBzdHJpY3QgSVNPIGRhdGUgYnkgd2hvbGUgY2FsZW5kYXIgZGF5cyB3aXRob3V0IGxvY2FsIHRpbWV6b25lIHVzZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB2YWx1ZSBJU08gZGF0ZS5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gZGF5cyAgU2lnbmVkIGNhbGVuZGFyLWRheSBjb3VudC5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IFNoaWZ0ZWQgZGF0ZSBvciBhbiBlbXB0eSBzdHJpbmcuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2hpZnRfZGF0ZSggdmFsdWUsIGRheXMgKSB7XG5cdFx0XHR2YXIgbWF0Y2ggPSBTdHJpbmcoIHZhbHVlIHx8ICcnICkubWF0Y2goIC9eKFxcZHs0fSktKFxcZHsyfSktKFxcZHsyfSkkLyApO1xuXHRcdFx0dmFyIHNoaWZ0ZWQ7XG5cblx0XHRcdGlmICggISBtYXRjaCB8fCAhIE51bWJlci5pc0ludGVnZXIoIGRheXMgKSApIHtcblx0XHRcdFx0cmV0dXJuICcnO1xuXHRcdFx0fVxuXHRcdFx0c2hpZnRlZCA9IG5ldyBEYXRlKCBEYXRlLlVUQyggTnVtYmVyKCBtYXRjaFsgMSBdICksIE51bWJlciggbWF0Y2hbIDIgXSApIC0gMSwgTnVtYmVyKCBtYXRjaFsgMyBdICkgKyBkYXlzICkgKTtcblxuXHRcdFx0cmV0dXJuIHNoaWZ0ZWQudG9JU09TdHJpbmcoKS5zbGljZSggMCwgMTAgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDYWxjdWxhdGUgYSBjaXZpbCBjYWxlbmRhci1kYXkgZGVsdGEgd2l0aG91dCBicm93c2VyLWxvY2FsIHRpbWV6b25lIHVzZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBzdGFydF9kYXRlIElTTyBzb3VyY2UgZGF0ZS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZW5kX2RhdGUgSVNPIHRhcmdldCBkYXRlLlxuXHRcdCAqIEByZXR1cm4ge251bWJlcnxudWxsfSBTaWduZWQgd2hvbGUtZGF5IGRlbHRhLCBvciBudWxsIGZvciBtYWxmb3JtZWQgZGF0ZXMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2FsZW5kYXJfZGF5X2RlbHRhKCBzdGFydF9kYXRlLCBlbmRfZGF0ZSApIHtcblx0XHRcdHZhciBzdGFydF9tYXRjaCA9IFN0cmluZyggc3RhcnRfZGF0ZSB8fCAnJyApLm1hdGNoKCAvXihcXGR7NH0pLShcXGR7Mn0pLShcXGR7Mn0pJC8gKTtcblx0XHRcdHZhciBlbmRfbWF0Y2ggPSBTdHJpbmcoIGVuZF9kYXRlIHx8ICcnICkubWF0Y2goIC9eKFxcZHs0fSktKFxcZHsyfSktKFxcZHsyfSkkLyApO1xuXHRcdFx0dmFyIHN0YXJ0X2Vwb2NoO1xuXHRcdFx0dmFyIGVuZF9lcG9jaDtcblxuXHRcdFx0aWYgKCAhIHN0YXJ0X21hdGNoIHx8ICEgZW5kX21hdGNoICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHN0YXJ0X2Vwb2NoID0gRGF0ZS5VVEMoIE51bWJlciggc3RhcnRfbWF0Y2hbIDEgXSApLCBOdW1iZXIoIHN0YXJ0X21hdGNoWyAyIF0gKSAtIDEsIE51bWJlciggc3RhcnRfbWF0Y2hbIDMgXSApICk7XG5cdFx0XHRlbmRfZXBvY2ggPSBEYXRlLlVUQyggTnVtYmVyKCBlbmRfbWF0Y2hbIDEgXSApLCBOdW1iZXIoIGVuZF9tYXRjaFsgMiBdICkgLSAxLCBOdW1iZXIoIGVuZF9tYXRjaFsgMyBdICkgKTtcblxuXHRcdFx0cmV0dXJuIE1hdGgucm91bmQoICggZW5kX2Vwb2NoIC0gc3RhcnRfZXBvY2ggKSAvIDg2NDAwMDAwICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVzb2x2ZSBvbmUgZnVsbC1kYXkgc291cmNlIGJvdW5kYXJ5IHRocm91Z2ggYWNjZXB0ZWQgc2VydmVyIGRhdGUgYmFuZHMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc25hcHNob3QgUHJlcGFyZWQgaW1tdXRhYmxlIGdlb21ldHJ5IHNuYXBzaG90LlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBpbnN0YW50IEV4YWN0IG9mZnNldC1xdWFsaWZpZWQgY2Fub25pY2FsIGluc3RhbnQuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG9wZXJhdGlvbiByZXNpemVfc3RhcnQgb3IgcmVzaXplX2VuZC5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gRXhhY3QgYm91bmRhcnkgcmVzdWx0IG9yIG51bGwgb3V0c2lkZSBjb3ZlcmFnZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXNvbHZlX2Z1bGxfZGF5X2luc3RhbnRfYm91bmRhcnkoIHNuYXBzaG90LCBpbnN0YW50LCBvcGVyYXRpb24gKSB7XG5cdFx0XHR2YXIgZXhhY3RfZXBvY2ggPSBEYXRlLnBhcnNlKCBpbnN0YW50ICkgLyAxMDAwO1xuXHRcdFx0dmFyIGRhdGVfYmFuZCA9IG51bGw7XG5cblx0XHRcdGlmICggISBOdW1iZXIuaXNGaW5pdGUoIGV4YWN0X2Vwb2NoICkgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0c25hcHNob3QuZGF0ZV9iYW5kcy5zb21lKCBmdW5jdGlvbiAoIGNhbmRpZGF0ZSApIHtcblx0XHRcdFx0dmFyIG1hdGNoZXMgPSAncmVzaXplX2VuZCcgPT09IG9wZXJhdGlvblxuXHRcdFx0XHRcdD8gY2FuZGlkYXRlLmVuZF9lcG9jaCA9PT0gZXhhY3RfZXBvY2hcblx0XHRcdFx0XHQ6IGNhbmRpZGF0ZS5zdGFydF9lcG9jaCA9PT0gZXhhY3RfZXBvY2g7XG5cblx0XHRcdFx0aWYgKCBtYXRjaGVzICkge1xuXHRcdFx0XHRcdGRhdGVfYmFuZCA9IGNhbmRpZGF0ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBtYXRjaGVzO1xuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCAhIGRhdGVfYmFuZCApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHN0YXR1czogJ2V4YWN0Jyxcblx0XHRcdFx0ZGF0ZTogZGF0ZV9iYW5kLmRhdGUsXG5cdFx0XHRcdHdhbGxfbWludXRlOiAncmVzaXplX2VuZCcgPT09IG9wZXJhdGlvbiA/IDE0NDAgOiAwLFxuXHRcdFx0XHRzbmFwX2luZGV4OiAwLFxuXHRcdFx0XHRlcG9jaDogZXhhY3RfZXBvY2gsXG5cdFx0XHRcdGV4YWN0X2F0OiBTdHJpbmcoIGluc3RhbnQgKSxcblx0XHRcdFx0Y2FuZGlkYXRlczogW11cblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29udmVydCBhbiBhbGwtZGF5IGNvb3JkaW5hdGUgaW50byBpdHMgZXhhY3QgaW5jbHVzaXZlIG9yIGV4Y2x1c2l2ZSBlZGdlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNuYXBzaG90IFByZXBhcmVkIGltbXV0YWJsZSBnZW9tZXRyeSBzbmFwc2hvdC5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmVzb2x2ZWQgRXhhY3QgYWxsLWRheSBjb29yZGluYXRlIHJlc3VsdC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gb3BlcmF0aW9uIHJlc2l6ZV9zdGFydCBvciByZXNpemVfZW5kLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBFeGFjdCBzZXJ2ZXItYmFuZCBib3VuZGFyeS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXNvbHZlX2Z1bGxfZGF5X3RhcmdldF9ib3VuZGFyeSggc25hcHNob3QsIHJlc29sdmVkLCBvcGVyYXRpb24gKSB7XG5cdFx0XHR2YXIgZGF0ZV9iYW5kID0gcmVzb2x2ZWQgJiYgc25hcHNob3QuYmFuZHNfYnlfZGF0ZVsgcmVzb2x2ZWQuZGF0ZSBdO1xuXG5cdFx0XHRpZiAoICEgZGF0ZV9iYW5kIHx8ICdleGFjdCcgIT09IHJlc29sdmVkLnN0YXR1cyApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHN0YXR1czogJ2V4YWN0Jyxcblx0XHRcdFx0ZGF0ZTogZGF0ZV9iYW5kLmRhdGUsXG5cdFx0XHRcdHdhbGxfbWludXRlOiAncmVzaXplX2VuZCcgPT09IG9wZXJhdGlvbiA/IDE0NDAgOiAwLFxuXHRcdFx0XHRzbmFwX2luZGV4OiAwLFxuXHRcdFx0XHRlcG9jaDogJ3Jlc2l6ZV9lbmQnID09PSBvcGVyYXRpb24gPyBkYXRlX2JhbmQuZW5kX2Vwb2NoIDogZGF0ZV9iYW5kLnN0YXJ0X2Vwb2NoLFxuXHRcdFx0XHRleGFjdF9hdDogJ3Jlc2l6ZV9lbmQnID09PSBvcGVyYXRpb24gPyBkYXRlX2JhbmQuZW5kX2F0IDogZGF0ZV9iYW5kLnN0YXJ0X2F0LFxuXHRcdFx0XHRjYW5kaWRhdGVzOiBbXVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBGb3JtYXQgb25lIGVwb2NoIGFzIGFuIGV4YWN0IFJGQzMzMzkgbWludXRlIGluIHRoZSBhY2NlcHRlZCBzaXRlIHRpbWV6b25lLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGVwb2NoX3NlY29uZHMgRXhhY3QgZXBvY2ggc2Vjb25kcy5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdGltZXpvbmUgICAgICBBY2NlcHRlZCBJQU5BIHRpbWV6b25lLlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gT2Zmc2V0LXF1YWxpZmllZCBpbnN0YW50IG9yIGFuIGVtcHR5IHN0cmluZy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBmb3JtYXRfaW5zdGFudCggZXBvY2hfc2Vjb25kcywgdGltZXpvbmUgKSB7XG5cdFx0XHR2YXIgdmFsdWVzID0ge307XG5cdFx0XHR2YXIgZm9ybWF0dGVyO1xuXHRcdFx0dmFyIHJlcHJlc2VudGVkO1xuXHRcdFx0dmFyIG9mZnNldF9taW51dGVzO1xuXHRcdFx0dmFyIHNpZ247XG5cdFx0XHR2YXIgcGFkID0gZnVuY3Rpb24gKCB2YWx1ZSwgbGVuZ3RoICkge1xuXHRcdFx0XHRyZXR1cm4gU3RyaW5nKCBNYXRoLmFicyggTWF0aC5yb3VuZCggdmFsdWUgKSApICkucGFkU3RhcnQoIGxlbmd0aCwgJzAnICk7XG5cdFx0XHR9O1xuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRmb3JtYXR0ZXIgPSBuZXcgd2luZG93LkludGwuRGF0ZVRpbWVGb3JtYXQoICdlbi1VUycsIHtcblx0XHRcdFx0XHR0aW1lWm9uZTogdGltZXpvbmUsXG5cdFx0XHRcdFx0eWVhcjogJ251bWVyaWMnLFxuXHRcdFx0XHRcdG1vbnRoOiAnMi1kaWdpdCcsXG5cdFx0XHRcdFx0ZGF5OiAnMi1kaWdpdCcsXG5cdFx0XHRcdFx0aG91cjogJzItZGlnaXQnLFxuXHRcdFx0XHRcdGhvdXJDeWNsZTogJ2gyMycsXG5cdFx0XHRcdFx0bWludXRlOiAnMi1kaWdpdCcsXG5cdFx0XHRcdFx0c2Vjb25kOiAnMi1kaWdpdCdcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRmb3JtYXR0ZXIuZm9ybWF0VG9QYXJ0cyggbmV3IERhdGUoIGVwb2NoX3NlY29uZHMgKiAxMDAwICkgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHBhcnQgKSB7XG5cdFx0XHRcdFx0aWYgKCAnbGl0ZXJhbCcgIT09IHBhcnQudHlwZSApIHtcblx0XHRcdFx0XHRcdHZhbHVlc1sgcGFydC50eXBlIF0gPSBOdW1iZXIoIHBhcnQudmFsdWUgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdFx0cmV0dXJuICcnO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHZhbHVlcy55ZWFyICkge1xuXHRcdFx0XHRyZXR1cm4gJyc7XG5cdFx0XHR9XG5cdFx0XHRyZXByZXNlbnRlZCA9IERhdGUuVVRDKCB2YWx1ZXMueWVhciwgdmFsdWVzLm1vbnRoIC0gMSwgdmFsdWVzLmRheSwgdmFsdWVzLmhvdXIsIHZhbHVlcy5taW51dGUsIHZhbHVlcy5zZWNvbmQgKSAvIDEwMDA7XG5cdFx0XHRvZmZzZXRfbWludXRlcyA9IE1hdGgucm91bmQoICggcmVwcmVzZW50ZWQgLSBlcG9jaF9zZWNvbmRzICkgLyA2MCApO1xuXHRcdFx0c2lnbiA9IDAgPD0gb2Zmc2V0X21pbnV0ZXMgPyAnKycgOiAnLSc7XG5cblx0XHRcdHJldHVybiBwYWQoIHZhbHVlcy55ZWFyLCA0ICkgKyAnLScgKyBwYWQoIHZhbHVlcy5tb250aCwgMiApICsgJy0nICsgcGFkKCB2YWx1ZXMuZGF5LCAyIClcblx0XHRcdFx0KyAnVCcgKyBwYWQoIHZhbHVlcy5ob3VyLCAyICkgKyAnOicgKyBwYWQoIHZhbHVlcy5taW51dGUsIDIgKSArICc6MDAnXG5cdFx0XHRcdCsgc2lnbiArIHBhZCggTWF0aC5mbG9vciggTWF0aC5hYnMoIG9mZnNldF9taW51dGVzICkgLyA2MCApLCAyICkgKyAnOicgKyBwYWQoIE1hdGguYWJzKCBvZmZzZXRfbWludXRlcyApICUgNjAsIDIgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBCdWlsZCBvbmUgc2FtZS1SZXNvdXJjZSBgZHJhZyArIHNoaWZ0YCBwcm9wb3NhbCBmcm9tIGV4YWN0IGNlbGxzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGdlc3R1cmUgQWN0aXZlIGdlc3R1cmUgc3RhdGUuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IEV4ZWN1dGFibGUtZnJlZSBwcm9wb3NhbCBvciBudWxsIGZvciBubyBtb3ZlbWVudC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBidWlsZF9tb3ZlbWVudF9wcm9wb3NhbCggZ2VzdHVyZSApIHtcblx0XHRcdHZhciBtb3ZlbWVudCA9IGdlc3R1cmUuZWxpZ2liaWxpdHkubW92ZW1lbnQ7XG5cdFx0XHR2YXIgb3JpZ2luID0gZ2VzdHVyZS5vcmlnaW47XG5cdFx0XHR2YXIgY3VycmVudCA9IGdlc3R1cmUuY3VycmVudDtcblx0XHRcdHZhciBkYXRlX2RlbHRhID0gY2FsZW5kYXJfZGF5X2RlbHRhKCBvcmlnaW4uZGF0ZSwgY3VycmVudC5kYXRlICk7XG5cdFx0XHR2YXIgaW5zdGFudF9kZWx0YSA9IE51bWJlciggY3VycmVudC5lcG9jaCApIC0gTnVtYmVyKCBvcmlnaW4uZXBvY2ggKTtcblx0XHRcdHZhciB0YXJnZXRfc3VyZmFjZV9yZXNvdXJjZV9pZCA9IG5vcm1hbGl6ZV9wb3NpdGl2ZV9pbnRlZ2VyKCBnZXN0dXJlLnRhcmdldF9yZXNvdXJjZV9pZCApIHx8IGdlc3R1cmUucmVnaXN0cmF0aW9uLnJlc291cmNlX2lkO1xuXHRcdFx0dmFyIGlzX2Nyb3NzX3Jlc291cmNlID0gdGFyZ2V0X3N1cmZhY2VfcmVzb3VyY2VfaWQgIT09IGdlc3R1cmUucmVnaXN0cmF0aW9uLnJlc291cmNlX2lkO1xuXHRcdFx0dmFyIHRhcmdldF9yZXNvdXJjZV9pZCA9IGlzX2Nyb3NzX3Jlc291cmNlID8gdGFyZ2V0X3N1cmZhY2VfcmVzb3VyY2VfaWQgOiBtb3ZlbWVudC5wcmltYXJ5X3Jlc291cmNlX2lkO1xuXHRcdFx0dmFyIHByb3Bvc2FsID0ge1xuXHRcdFx0XHRzY2hlbWFfdmVyc2lvbjogTnVtYmVyKCBtb3ZlbWVudC5yZXZpZXdfc2NoZW1hX3ZlcnNpb24gfHwgY29uZmlndXJhdGlvbi5yZXZpZXdfc2NoZW1hX3ZlcnNpb24gfHwgMSApLFxuXHRcdFx0XHRib29raW5nX2lkOiBtb3ZlbWVudC5ib29raW5nX2lkLFxuXHRcdFx0XHRpbnRlcmFjdGlvbl9zb3VyY2U6IGlzX2Nyb3NzX3Jlc291cmNlID8gJ2Nyb3NzX3Jlc291cmNlX2RyYWcnIDogJ2RyYWcnLFxuXHRcdFx0XHRvcGVyYXRpb246IGlzX2Nyb3NzX3Jlc291cmNlID8gJ2NoYW5nZV9yZXNvdXJjZScgOiAnc2hpZnQnLFxuXHRcdFx0XHR0YXJnZXRfcmVzb3VyY2VfaWQ6IHRhcmdldF9yZXNvdXJjZV9pZCxcblx0XHRcdFx0c2VsZWN0aW9uX21ldGhvZDogbW92ZW1lbnQuc2VsZWN0aW9uX21ldGhvZCxcblx0XHRcdFx0cHJvcG9zYWxfcmV2aXNpb246IG1vdmVtZW50LnByb3Bvc2FsX3JldmlzaW9uLFxuXHRcdFx0XHRzb3VyY2VfY29udGV4dF90b2tlbjogbW92ZW1lbnQuc291cmNlX2NvbnRleHRfdG9rZW5cblx0XHRcdH07XG5cblx0XHRcdGlmIChcblx0XHRcdFx0KCBpc19jcm9zc19yZXNvdXJjZSAmJiAoICEgY3Jvc3NfcmVzb3VyY2VfbW92ZW1lbnRfZW5hYmxlZCB8fCAhIG1vdmVtZW50LmNyb3NzX3Jlc291cmNlICkgKVxuXHRcdFx0XHR8fCAoICEgaXNfY3Jvc3NfcmVzb3VyY2UgJiYgISBtb3ZlbWVudC5zYW1lX3Jlc291cmNlIClcblx0XHRcdCkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGlmICggJ2Z1bGxfZGF5JyA9PT0gbW92ZW1lbnQudGltZV9hcHBsaWNhdGlvbiApIHtcblx0XHRcdFx0aWYgKCAhIGZ1bGxfZGF5X21vdmVtZW50X2VuYWJsZWQgfHwgbnVsbCA9PT0gZGF0ZV9kZWx0YSB8fCAoICEgZGF0ZV9kZWx0YSAmJiAhIGlzX2Nyb3NzX3Jlc291cmNlICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0cHJvcG9zYWwucHJvcG9zZWRfZGF0ZXMgPSBtb3ZlbWVudC5zZWxlY3RlZF9kYXRlcy5tYXAoIGZ1bmN0aW9uICggZGF0ZSApIHtcblx0XHRcdFx0XHRyZXR1cm4gc2hpZnRfZGF0ZSggZGF0ZSwgZGF0ZV9kZWx0YSApO1xuXHRcdFx0XHR9ICk7XG5cblx0XHRcdFx0cmV0dXJuIHByb3Bvc2FsLnByb3Bvc2VkX2RhdGVzLmV2ZXJ5KCBCb29sZWFuICkgPyBPYmplY3QuZnJlZXplKCBwcm9wb3NhbCApIDogbnVsbDtcblx0XHRcdH1cblx0XHRcdGlmICggISBpbnN0YW50X2RlbHRhICYmICEgaXNfY3Jvc3NfcmVzb3VyY2UgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cHJvcG9zYWwucHJvcG9zZWRfaW50ZXJ2YWxzID0gbW92ZW1lbnQuZXhhY3RfaW50ZXJ2YWxzLm1hcCggZnVuY3Rpb24gKCBpbnRlcnZhbCApIHtcblx0XHRcdFx0dmFyIHN0YXJ0X2Vwb2NoID0gRGF0ZS5wYXJzZSggaW50ZXJ2YWwuc3RhcnQgKSAvIDEwMDAgKyBpbnN0YW50X2RlbHRhO1xuXHRcdFx0XHR2YXIgZW5kX2Vwb2NoID0gRGF0ZS5wYXJzZSggaW50ZXJ2YWwuZW5kICkgLyAxMDAwICsgaW5zdGFudF9kZWx0YTtcblxuXHRcdFx0XHRyZXR1cm4gT2JqZWN0LmZyZWV6ZSgge1xuXHRcdFx0XHRcdHN0YXJ0OiBmb3JtYXRfaW5zdGFudCggc3RhcnRfZXBvY2gsIGdlc3R1cmUuY29udGV4dC5zbmFwc2hvdC5hY2NlcHRlZF9pZGVudGl0eS50aW1lem9uZSApLFxuXHRcdFx0XHRcdGVuZDogZm9ybWF0X2luc3RhbnQoIGVuZF9lcG9jaCwgZ2VzdHVyZS5jb250ZXh0LnNuYXBzaG90LmFjY2VwdGVkX2lkZW50aXR5LnRpbWV6b25lIClcblx0XHRcdFx0fSApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gcHJvcG9zYWwucHJvcG9zZWRfaW50ZXJ2YWxzLmV2ZXJ5KCBmdW5jdGlvbiAoIGludGVydmFsICkge1xuXHRcdFx0XHRyZXR1cm4gZXhhY3RfaW5zdGFudF9wYXR0ZXJuLnRlc3QoIGludGVydmFsLnN0YXJ0IClcblx0XHRcdFx0XHQmJiBleGFjdF9pbnN0YW50X3BhdHRlcm4udGVzdCggaW50ZXJ2YWwuZW5kIClcblx0XHRcdFx0XHQmJiBEYXRlLnBhcnNlKCBpbnRlcnZhbC5lbmQgKSAtIERhdGUucGFyc2UoIGludGVydmFsLnN0YXJ0ICkgPiAwO1xuXHRcdFx0fSApID8gT2JqZWN0LmZyZWV6ZSggcHJvcG9zYWwgKSA6IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVzb2x2ZSBvbmUgc2VydmVyLXF1YWxpZmllZCBpbnN0YW50IHRocm91Z2ggdGhlIHByZXBhcmVkIERTVCBnZW9tZXRyeS5cblx0XHQgKlxuXHRcdCAqIEV4cGxpY2l0IGZvbGQgb2Zmc2V0cyBhcmUgbWF0Y2hlZCBiYWNrIHRvIHRoZSBzZXJ2ZXIgdHJhbnNpdGlvbiBjYW5kaWRhdGU7XG5cdFx0ICogbm8gYnJvd3Nlci1sb2NhbCB0aW1lem9uZSBjb252ZXJzaW9uIHNlbGVjdHMgYSByZXBlYXRlZCBvY2N1cnJlbmNlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNuYXBzaG90IFByZXBhcmVkIGltbXV0YWJsZSBnZW9tZXRyeSBzbmFwc2hvdC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gaW5zdGFudCAgRXhhY3Qgb2Zmc2V0LXF1YWxpZmllZCBpbnN0YW50LlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBFeGFjdCByZXNvbHZlZCBib3VuZGFyeSBvciBudWxsIG91dHNpZGUgY292ZXJhZ2UuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVzb2x2ZV9pbnN0YW50X2JvdW5kYXJ5KCBzbmFwc2hvdCwgaW5zdGFudCApIHtcblx0XHRcdHZhciBtYXRjaCA9IFN0cmluZyggaW5zdGFudCB8fCAnJyApLm1hdGNoKCAvXihcXGR7NH0tXFxkezJ9LVxcZHsyfSlUKFxcZHsyfSk6KFxcZHsyfSk6MDAvICk7XG5cdFx0XHR2YXIgd2FsbF9taW51dGUgPSBtYXRjaCA/IE51bWJlciggbWF0Y2hbIDIgXSApICogNjAgKyBOdW1iZXIoIG1hdGNoWyAzIF0gKSA6IC0xO1xuXHRcdFx0dmFyIHJlc29sdmVkO1xuXHRcdFx0dmFyIGV4YWN0X2Vwb2NoID0gRGF0ZS5wYXJzZSggaW5zdGFudCApIC8gMTAwMDtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHQhIG1hdGNoXG5cdFx0XHRcdHx8ICEgTnVtYmVyLmlzRmluaXRlKCBleGFjdF9lcG9jaCApXG5cdFx0XHRcdHx8ICEgc25hcHNob3QuYmFuZHNfYnlfZGF0ZVsgbWF0Y2hbIDEgXSBdXG5cdFx0XHRcdHx8IHdhbGxfbWludXRlIDwgc25hcHNob3QudmlzaWJsZV9yYW5nZS5zdGFydF9taW51dGVcblx0XHRcdFx0fHwgd2FsbF9taW51dGUgPiBzbmFwc2hvdC52aXNpYmxlX3JhbmdlLmVuZF9taW51dGVcblx0XHRcdFx0fHwgISBnZW9tZXRyeVxuXHRcdFx0XHR8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgZ2VvbWV0cnkucmVzb2x2ZV93YWxsX3RpbWVcblx0XHRcdCkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJlc29sdmVkID0gZ2VvbWV0cnkucmVzb2x2ZV93YWxsX3RpbWUoIHNuYXBzaG90LCBtYXRjaFsgMSBdLCB3YWxsX21pbnV0ZSwgJycgKTtcblx0XHRcdGlmICggcmVzb2x2ZWQgJiYgJ2ZvbGQnID09PSByZXNvbHZlZC5zdGF0dXMgKSB7XG5cdFx0XHRcdHJlc29sdmVkLmNhbmRpZGF0ZXMuc29tZSggZnVuY3Rpb24gKCBjYW5kaWRhdGUgKSB7XG5cdFx0XHRcdFx0aWYgKCBOdW1iZXIoIGNhbmRpZGF0ZS5lcG9jaCApID09PSBleGFjdF9lcG9jaCApIHtcblx0XHRcdFx0XHRcdHJlc29sdmVkID0gZ2VvbWV0cnkucmVzb2x2ZV93YWxsX3RpbWUoIHNuYXBzaG90LCBtYXRjaFsgMSBdLCB3YWxsX21pbnV0ZSwgY2FuZGlkYXRlLm9jY3VycmVuY2VfaWQgKTtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVzb2x2ZWQgJiYgJ2V4YWN0JyA9PT0gcmVzb2x2ZWQuc3RhdHVzICYmIE51bWJlciggcmVzb2x2ZWQuZXBvY2ggKSA9PT0gZXhhY3RfZXBvY2ggPyByZXNvbHZlZCA6IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQnVpbGQgb25lIGxvY2FsIHJlc2l6ZSBwcm9qZWN0aW9uIGFuZCBpdHMgY2Fub25pY2FsIG9uZS1ib3VuZGFyeSBwcm9wb3NhbC5cblx0XHQgKlxuXHRcdCAqIEdyb3VwIG1lbWJlcnMgYXJlIHByb2plY3RlZCB3aXRoIHRoZSBzYW1lIGV4YWN0IGRlbHRhIGZvciBwcmVzZW50YXRpb24uXG5cdFx0ICogT25seSB0aGUgaW1tdXRhYmxlIGFuY2hvciBpbnRlcnZhbCBpcyB0cmFuc3BvcnRlZDsgY2Fub25pY2FsIFJldmlldyBkZXJpdmVzXG5cdFx0ICogYW5kIHZhbGlkYXRlcyB0aGUgY29tcGxldGUgc2VydmVyLW93bmVkIGdyb3VwIGFnYWluLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGdlc3R1cmUgQWN0aXZlIGF1dGhvcml6ZWQgcmVzaXplIGdlc3R1cmUuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IExvY2FsIGludGVydmFscyBhbmQgZnJvemVuIGNhbm9uaWNhbCBwcm9wb3NhbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBidWlsZF9yZXNpemVfcHJvamVjdGlvbiggZ2VzdHVyZSApIHtcblx0XHRcdHZhciByZXNpemUgPSBnZXN0dXJlLmVsaWdpYmlsaXR5LnJlc2l6ZTtcblx0XHRcdHZhciBvcGVyYXRpb24gPSBnZXN0dXJlLm9wZXJhdGlvbjtcblx0XHRcdHZhciBpbW11dGFibGVfc3RhcnQgPSBEYXRlLnBhcnNlKCByZXNpemUuaW1tdXRhYmxlX2ludGVydmFsLnN0YXJ0ICkgLyAxMDAwO1xuXHRcdFx0dmFyIGltbXV0YWJsZV9lbmQgPSBEYXRlLnBhcnNlKCByZXNpemUuaW1tdXRhYmxlX2ludGVydmFsLmVuZCApIC8gMTAwMDtcblx0XHRcdHZhciBzb3VyY2VfYm91bmRhcnkgPSAncmVzaXplX3N0YXJ0JyA9PT0gb3BlcmF0aW9uID8gaW1tdXRhYmxlX3N0YXJ0IDogaW1tdXRhYmxlX2VuZDtcblx0XHRcdHZhciBkZWx0YSA9IE51bWJlciggZ2VzdHVyZS5jdXJyZW50LmVwb2NoICkgLSBzb3VyY2VfYm91bmRhcnk7XG5cdFx0XHR2YXIgaXNfZnVsbF9kYXkgPSAtMSAhPT0gc3VwcG9ydGVkX2Z1bGxfZGF5X3Jlc2l6ZV9zaGFwZXMuaW5kZXhPZiggcmVzaXplLnNhdmVkX3NoYXBlICk7XG5cdFx0XHR2YXIgbWluaW11bV9kdXJhdGlvbiA9IGlzX2Z1bGxfZGF5ID8gMSA6IHNlbGVjdGlvbl9zdGVwX21pbnV0ZXMgKiA2MDtcblx0XHRcdHZhciBpbnRlcnZhbHM7XG5cdFx0XHR2YXIgYW5jaG9yO1xuXHRcdFx0dmFyIGFuY2hvcl9zdGFydDtcblx0XHRcdHZhciBhbmNob3JfZW5kO1xuXG5cdFx0XHRpZiAoICEgZGVsdGEgfHwgLTEgPT09IFsgJ3Jlc2l6ZV9zdGFydCcsICdyZXNpemVfZW5kJyBdLmluZGV4T2YoIG9wZXJhdGlvbiApICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGludGVydmFscyA9IHJlc2l6ZS5hZmZlY3RlZF9pbnRlcnZhbHMubWFwKCBmdW5jdGlvbiAoIGludGVydmFsICkge1xuXHRcdFx0XHR2YXIgc3RhcnRfZXBvY2ggPSBEYXRlLnBhcnNlKCBpbnRlcnZhbC5zdGFydCApIC8gMTAwMDtcblx0XHRcdFx0dmFyIGVuZF9lcG9jaCA9IERhdGUucGFyc2UoIGludGVydmFsLmVuZCApIC8gMTAwMDtcblxuXHRcdFx0XHRyZXR1cm4gT2JqZWN0LmZyZWV6ZSgge1xuXHRcdFx0XHRcdHN0YXJ0X2Vwb2NoOiAncmVzaXplX3N0YXJ0JyA9PT0gb3BlcmF0aW9uID8gc3RhcnRfZXBvY2ggKyBkZWx0YSA6IHN0YXJ0X2Vwb2NoLFxuXHRcdFx0XHRcdGVuZF9lcG9jaDogJ3Jlc2l6ZV9lbmQnID09PSBvcGVyYXRpb24gPyBlbmRfZXBvY2ggKyBkZWx0YSA6IGVuZF9lcG9jaFxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIGludGVydmFscy5zb21lKCBmdW5jdGlvbiAoIGludGVydmFsICkge1xuXHRcdFx0XHRyZXR1cm4gaW50ZXJ2YWwuZW5kX2Vwb2NoIC0gaW50ZXJ2YWwuc3RhcnRfZXBvY2ggPCBtaW5pbXVtX2R1cmF0aW9uO1xuXHRcdFx0fSApICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGFuY2hvciA9IGludGVydmFsc1sgcmVzaXplLmFuY2hvcl9pbnRlcnZhbF9pbmRleCBdO1xuXHRcdFx0aWYgKCAhIGFuY2hvciApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRhbmNob3Jfc3RhcnQgPSAncmVzaXplX3N0YXJ0JyA9PT0gb3BlcmF0aW9uID8gU3RyaW5nKCBnZXN0dXJlLmN1cnJlbnQuZXhhY3RfYXQgfHwgJycgKSA6IHJlc2l6ZS5pbW11dGFibGVfaW50ZXJ2YWwuc3RhcnQ7XG5cdFx0XHRhbmNob3JfZW5kID0gJ3Jlc2l6ZV9lbmQnID09PSBvcGVyYXRpb24gPyBTdHJpbmcoIGdlc3R1cmUuY3VycmVudC5leGFjdF9hdCB8fCAnJyApIDogcmVzaXplLmltbXV0YWJsZV9pbnRlcnZhbC5lbmQ7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdCEgZXhhY3RfaW5zdGFudF9wYXR0ZXJuLnRlc3QoIGFuY2hvcl9zdGFydCApXG5cdFx0XHRcdHx8ICEgZXhhY3RfaW5zdGFudF9wYXR0ZXJuLnRlc3QoIGFuY2hvcl9lbmQgKVxuXHRcdFx0XHR8fCBEYXRlLnBhcnNlKCBhbmNob3JfZW5kICkgLSBEYXRlLnBhcnNlKCBhbmNob3Jfc3RhcnQgKSA8IG1pbmltdW1fZHVyYXRpb24gKiAxMDAwXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGludGVydmFsczogT2JqZWN0LmZyZWV6ZSggaW50ZXJ2YWxzICksXG5cdFx0XHRcdHByb3Bvc2FsOiBPYmplY3QuZnJlZXplKCB7XG5cdFx0XHRcdFx0c2NoZW1hX3ZlcnNpb246IE51bWJlciggY29uZmlndXJhdGlvbi5yZXZpZXdfc2NoZW1hX3ZlcnNpb24gfHwgMSApLFxuXHRcdFx0XHRcdGJvb2tpbmdfaWQ6IHJlc2l6ZS5ib29raW5nX2lkLFxuXHRcdFx0XHRcdGludGVyYWN0aW9uX3NvdXJjZTogJ3Jlc2l6ZScsXG5cdFx0XHRcdFx0b3BlcmF0aW9uOiBvcGVyYXRpb24sXG5cdFx0XHRcdFx0dGFyZ2V0X3Jlc291cmNlX2lkOiByZXNpemUudGFyZ2V0X3Jlc291cmNlX2lkLFxuXHRcdFx0XHRcdHNlbGVjdGlvbl9tZXRob2Q6IHJlc2l6ZS5zZWxlY3Rpb25fbWV0aG9kLFxuXHRcdFx0XHRcdHByb3Bvc2VkX2ludGVydmFsczogT2JqZWN0LmZyZWV6ZSggWyBPYmplY3QuZnJlZXplKCB7XG5cdFx0XHRcdFx0XHRzdGFydDogYW5jaG9yX3N0YXJ0LFxuXHRcdFx0XHRcdFx0ZW5kOiBhbmNob3JfZW5kXG5cdFx0XHRcdFx0fSApIF0gKSxcblx0XHRcdFx0XHRwcm9wb3NhbF9yZXZpc2lvbjogcmVzaXplLnByb3Bvc2FsX3JldmlzaW9uLFxuXHRcdFx0XHRcdHNvdXJjZV9jb250ZXh0X3Rva2VuOiByZXNpemUuc291cmNlX2NvbnRleHRfdG9rZW5cblx0XHRcdFx0fSApXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEZvcm1hdCByZXNpemUgZHVyYXRpb24gaW4gdGhlIHNhbWUgY29tcG91bmQgdW5pdHMgYXMgbmF0aXZlIFRpbWVsaW5lLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHNlY29uZHMgUG9zaXRpdmUgZWxhcHNlZCBzZWNvbmRzLlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gTG9jYWxpemVkIHByZXNlbnRhdGlvbi1vbmx5IGR1cmF0aW9uLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGZvcm1hdF9yZXNpemVfZHVyYXRpb24oIHNlY29uZHMgKSB7XG5cdFx0XHR2YXIgbWludXRlcyA9IE1hdGgubWF4KCAwLCBNYXRoLnJvdW5kKCBOdW1iZXIoIHNlY29uZHMgKSAvIDYwICkgKTtcblx0XHRcdHZhciBkYXlzID0gTWF0aC5mbG9vciggbWludXRlcyAvIDE0NDAgKTtcblx0XHRcdHZhciBob3VycyA9IE1hdGguZmxvb3IoICggbWludXRlcyAlIDE0NDAgKSAvIDYwICk7XG5cdFx0XHR2YXIgcmVtYWluaW5nX21pbnV0ZXMgPSBtaW51dGVzICUgNjA7XG5cdFx0XHR2YXIgcGFydHMgPSBbXTtcblxuXHRcdFx0aWYgKCBkYXlzICkge1xuXHRcdFx0XHRwYXJ0cy5wdXNoKCBTdHJpbmcoIDEgPT09IGRheXNcblx0XHRcdFx0XHQ/ICggaTE4bi5yZXNpemVfZHVyYXRpb25fZGF5IHx8ICclcyBkYXknIClcblx0XHRcdFx0XHQ6ICggaTE4bi5yZXNpemVfZHVyYXRpb25fZGF5cyB8fCAnJXMgZGF5cycgKSApLnJlcGxhY2UoICclcycsIGRheXMgKSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBob3VycyApIHtcblx0XHRcdFx0cGFydHMucHVzaCggU3RyaW5nKCAxID09PSBob3Vyc1xuXHRcdFx0XHRcdD8gKCBpMThuLnJlc2l6ZV9kdXJhdGlvbl9ob3VyIHx8ICclcyBob3VyJyApXG5cdFx0XHRcdFx0OiAoIGkxOG4ucmVzaXplX2R1cmF0aW9uX2hvdXJzIHx8ICclcyBob3VycycgKSApLnJlcGxhY2UoICclcycsIGhvdXJzICkgKTtcblx0XHRcdH1cblx0XHRcdGlmICggcmVtYWluaW5nX21pbnV0ZXMgfHwgISBwYXJ0cy5sZW5ndGggKSB7XG5cdFx0XHRcdHBhcnRzLnB1c2goIFN0cmluZyggMSA9PT0gcmVtYWluaW5nX21pbnV0ZXNcblx0XHRcdFx0XHQ/ICggaTE4bi5yZXNpemVfZHVyYXRpb25fbWludXRlIHx8ICclcyBtaW51dGUnIClcblx0XHRcdFx0XHQ6ICggaTE4bi5yZXNpemVfZHVyYXRpb25fbWludXRlcyB8fCAnJXMgbWludXRlcycgKSApLnJlcGxhY2UoICclcycsIHJlbWFpbmluZ19taW51dGVzICkgKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHBhcnRzLmpvaW4oICcgJyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEZvcm1hdCBvbmUgZXhhY3QgcHJvcG9zZWQgZW5kcG9pbnQgZm9yIGEgY29uY2lzZSB2aXNpYmxlIGJvdW5kYXJ5IGxhYmVsLlxuXHRcdCAqXG5cdFx0ICogVGhlIGluc3RhbnQgaXMgY29udmVydGVkIG9ubHkgdGhyb3VnaCB0aGUgYWNjZXB0ZWQgV29yZFByZXNzIHNpdGUgdGltZXpvbmVcblx0XHQgKiBhbmQgbmV2ZXIgdGhyb3VnaCB0aGUgYnJvd3NlciB0aW1lem9uZS4gVGhlIGV4YWN0IG9mZnNldCByZW1haW5zIGluIHRoZVxuXHRcdCAqIGNhbm9uaWNhbCBwcm9wb3NhbCBhbmQgUmV2aWV3IGNvbnRyYWN0LCB3aGlsZSB0aGUgdmlzdWFsIGxhYmVsIGludGVudGlvbmFsbHlcblx0XHQgKiBzaG93cyBvbmx5IHRoZSBhY2NlcHRlZCB3YWxsIGRhdGUgYW5kIHRpbWUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gZXBvY2hfc2Vjb25kcyBFeGFjdCBlbmRwb2ludCBlcG9jaCBpbiBzZWNvbmRzLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0aW1lem9uZSAgICAgIEFjY2VwdGVkIElBTkEgdGltZXpvbmUuXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBBY2NlcHRlZCB3YWxsIGRhdGUgYW5kIHRpbWUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZm9ybWF0X3Jlc2l6ZV92aXNpYmxlX2VuZHBvaW50KCBlcG9jaF9zZWNvbmRzLCB0aW1lem9uZSApIHtcblx0XHRcdHZhciBpbnN0YW50ID0gZm9ybWF0X2luc3RhbnQoIGVwb2NoX3NlY29uZHMsIHRpbWV6b25lICk7XG5cdFx0XHR2YXIgbWF0Y2ggPSBpbnN0YW50Lm1hdGNoKCAvXihcXGR7NH0tXFxkezJ9LVxcZHsyfSlUKFxcZHsyfTpcXGR7Mn0pOjAwWystXVxcZHsyfTpcXGR7Mn0kLyApO1xuXG5cdFx0XHRyZXR1cm4gbWF0Y2ggPyBtYXRjaFsgMSBdICsgJyAnICsgbWF0Y2hbIDIgXSA6IGluc3RhbnQ7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQnVpbGQgc2VwYXJhdGUgcHJlc2VudGF0aW9uIGxhYmVscyB3aXRob3V0IGNoYW5naW5nIGV4YWN0IHByb3Bvc2FsIGRhdGEuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gaW50ZXJ2YWwgQWNjZXB0ZWQgbG9jYWwgcmVzaXplIHByb2plY3Rpb24gaW50ZXJ2YWwuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNuYXBzaG90IFByZXBhcmVkIGFjY2VwdGVkIGdlb21ldHJ5IHNuYXBzaG90LlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gVmlzaWJsZSBzdGFydCwgZW5kLCBhbmQgZWxhcHNlZC1kdXJhdGlvbiBsYWJlbHMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYnVpbGRfcmVzaXplX3JhbmdlX2xhYmVscyggaW50ZXJ2YWwsIHNuYXBzaG90ICkge1xuXHRcdFx0dmFyIHRpbWV6b25lID0gc25hcHNob3QgJiYgc25hcHNob3QuYWNjZXB0ZWRfaWRlbnRpdHkgPyBzbmFwc2hvdC5hY2NlcHRlZF9pZGVudGl0eS50aW1lem9uZSA6ICcnO1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRzdGFydDogZm9ybWF0X3Jlc2l6ZV92aXNpYmxlX2VuZHBvaW50KCBpbnRlcnZhbC5zdGFydF9lcG9jaCwgdGltZXpvbmUgKSxcblx0XHRcdFx0ZW5kOiBmb3JtYXRfcmVzaXplX3Zpc2libGVfZW5kcG9pbnQoIGludGVydmFsLmVuZF9lcG9jaCwgdGltZXpvbmUgKSxcblx0XHRcdFx0ZHVyYXRpb246IGZvcm1hdF9yZXNpemVfZHVyYXRpb24oIGludGVydmFsLmVuZF9lcG9jaCAtIGludGVydmFsLnN0YXJ0X2Vwb2NoIClcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29udmVydCBvbmUgZXhhY3QgZXBvY2ggdG8gYm91bmRlZCBsb2dpY2FsIFRpbWUgUm93cyBnZW9tZXRyeS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBzbmFwc2hvdCBQcmVwYXJlZCBnZW9tZXRyeSBzbmFwc2hvdC5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gZXBvY2ggICAgRXhhY3QgZXBvY2ggc2Vjb25kcy5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gRGF0ZS1jb2x1bW4gYW5kIGJsb2NrLWF4aXMgcG9pbnQsIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3Jlc2l6ZV92aXN1YWxfcG9pbnQoIHNuYXBzaG90LCBlcG9jaCApIHtcblx0XHRcdHZhciBpbnN0YW50ID0gZm9ybWF0X2luc3RhbnQoIGVwb2NoLCBzbmFwc2hvdC5hY2NlcHRlZF9pZGVudGl0eS50aW1lem9uZSApO1xuXHRcdFx0dmFyIG1hdGNoID0gaW5zdGFudC5tYXRjaCggL14oXFxkezR9LVxcZHsyfS1cXGR7Mn0pVChcXGR7Mn0pOihcXGR7Mn0pOjAwLyApO1xuXHRcdFx0dmFyIGNvbHVtbiA9IG1hdGNoICYmIHNuYXBzaG90LmRhdGVfY29sdW1uc1sgc25hcHNob3QuZGF0ZV9vcmRlclsgbWF0Y2hbIDEgXSBdIF07XG5cdFx0XHR2YXIgd2FsbF9taW51dGUgPSBtYXRjaCA/IE51bWJlciggbWF0Y2hbIDIgXSApICogNjAgKyBOdW1iZXIoIG1hdGNoWyAzIF0gKSA6IDA7XG5cblx0XHRcdGlmICggISBjb2x1bW4gKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRkYXRlOiBtYXRjaFsgMSBdLFxuXHRcdFx0XHRsZWZ0OiAncnRsJyA9PT0gc25hcHNob3QuZGlyZWN0aW9uID8gc25hcHNob3QuaW5saW5lX2V4dGVudCAtIGNvbHVtbi5sb2dpY2FsX2VuZCA6IGNvbHVtbi5sb2dpY2FsX3N0YXJ0LFxuXHRcdFx0XHR3aWR0aDogY29sdW1uLmxvZ2ljYWxfZW5kIC0gY29sdW1uLmxvZ2ljYWxfc3RhcnQsXG5cdFx0XHRcdHRvcDogKCB3YWxsX21pbnV0ZSAtIHNuYXBzaG90LnZpc2libGVfcmFuZ2Uuc3RhcnRfbWludXRlICkgKiBzbmFwc2hvdC5waXhlbHNfcGVyX21pbnV0ZVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTcGxpdCBvbmUgZXhhY3QgdGltZWQgaW50ZXJ2YWwgaW50byB2aXNpYmxlIHBlci1kYXRlIGNvbHVtbiBmcmFnbWVudHMuXG5cdFx0ICpcblx0XHQgKiBBIG11bHRpLWRheSBib3VuZGFyeSBpbnRlcnZhbCBtdXN0IG5vdCBiZSByZW5kZXJlZCBhcyBvbmUgcmVjdGFuZ3VsYXJcblx0XHQgKiBib3VuZGluZyBib3ggYmVjYXVzZSB0aGF0IGZpbGxzIGV2ZXJ5IGhvdXIgYmV0d2VlbiBpdHMgZmlyc3QgYW5kIGxhc3Rcblx0XHQgKiBkYXRlIGNvbHVtbnMuIEVhY2ggYWNjZXB0ZWQgc2VydmVyIGRhdGUgYmFuZCBpbnN0ZWFkIHJlY2VpdmVzIGl0cyBvd25cblx0XHQgKiB3YWxsLXRpbWUgZnJhZ21lbnQsIGNsaXBwZWQgdG8gdGhlIFJlc291cmNlLWxvY2FsIHZpc2libGUgcmFuZ2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc25hcHNob3QgICAgUHJlcGFyZWQgc2VydmVyLXRpbWV6b25lIGdlb21ldHJ5LlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBzdGFydF9lcG9jaCBFeGFjdCBpbmNsdXNpdmUgaW50ZXJ2YWwgc3RhcnQgaW4gc2Vjb25kcy5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gZW5kX2Vwb2NoICAgRXhhY3QgZXhjbHVzaXZlIGludGVydmFsIGVuZCBpbiBzZWNvbmRzLlxuXHRcdCAqIEByZXR1cm4ge0FycmF5PE9iamVjdD59IE9yZGVyZWQgdmlzaWJsZSB0aW1lZCBmcmFnbWVudCBnZW9tZXRyeS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfdGltZWRfcmVzaXplX3Zpc3VhbF9mcmFnbWVudHMoIHNuYXBzaG90LCBzdGFydF9lcG9jaCwgZW5kX2Vwb2NoICkge1xuXHRcdFx0dmFyIHRpbWV6b25lID0gc25hcHNob3QuYWNjZXB0ZWRfaWRlbnRpdHkudGltZXpvbmU7XG5cdFx0XHR2YXIgZGF0ZV9iYW5kcyA9IHNuYXBzaG90LmRhdGVfYmFuZHM7XG5cdFx0XHR2YXIgZnJhZ21lbnRzID0gW107XG5cdFx0XHR2YXIgbG93ID0gMDtcblx0XHRcdHZhciBoaWdoID0gZGF0ZV9iYW5kcy5sZW5ndGg7XG5cdFx0XHR2YXIgbWlkZGxlO1xuXHRcdFx0dmFyIGJhbmRfaW5kZXg7XG5cblx0XHRcdC8qIFNraXAgbm9uLWludGVyc2VjdGluZyBlYXJsaWVyIHdpbmRvd3Mgd2l0aG91dCBzY2FubmluZyBldmVyeSBiYW5kLiAqL1xuXHRcdFx0d2hpbGUgKCBsb3cgPCBoaWdoICkge1xuXHRcdFx0XHRtaWRkbGUgPSBNYXRoLmZsb29yKCAoIGxvdyArIGhpZ2ggKSAvIDIgKTtcblx0XHRcdFx0aWYgKCBOdW1iZXIoIGRhdGVfYmFuZHNbIG1pZGRsZSBdLmVuZF9lcG9jaCApIDw9IHN0YXJ0X2Vwb2NoICkge1xuXHRcdFx0XHRcdGxvdyA9IG1pZGRsZSArIDE7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aGlnaCA9IG1pZGRsZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKCBiYW5kX2luZGV4ID0gbG93OyBiYW5kX2luZGV4IDwgZGF0ZV9iYW5kcy5sZW5ndGg7IGJhbmRfaW5kZXgrKyApIHtcblx0XHRcdFx0dmFyIGRhdGVfYmFuZCA9IGRhdGVfYmFuZHNbIGJhbmRfaW5kZXggXTtcblx0XHRcdFx0dmFyIHNlZ21lbnRfc3RhcnRfZXBvY2ggPSBNYXRoLm1heCggc3RhcnRfZXBvY2gsIE51bWJlciggZGF0ZV9iYW5kLnN0YXJ0X2Vwb2NoICkgKTtcblx0XHRcdFx0dmFyIHNlZ21lbnRfZW5kX2Vwb2NoID0gTWF0aC5taW4oIGVuZF9lcG9jaCwgTnVtYmVyKCBkYXRlX2JhbmQuZW5kX2Vwb2NoICkgKTtcblx0XHRcdFx0dmFyIGNvbHVtbiA9IHNuYXBzaG90LmRhdGVfY29sdW1uc1sgc25hcHNob3QuZGF0ZV9vcmRlclsgZGF0ZV9iYW5kLmRhdGUgXSBdO1xuXHRcdFx0XHR2YXIgc3RhcnRfbWF0Y2g7XG5cdFx0XHRcdHZhciBlbmRfbWF0Y2g7XG5cdFx0XHRcdHZhciBzdGFydF93YWxsX21pbnV0ZTtcblx0XHRcdFx0dmFyIGVuZF93YWxsX21pbnV0ZTtcblx0XHRcdFx0dmFyIHZpc2libGVfc3RhcnRfbWludXRlO1xuXHRcdFx0XHR2YXIgdmlzaWJsZV9lbmRfbWludXRlO1xuXHRcdFx0XHR2YXIgbGVmdDtcblxuXHRcdFx0XHRpZiAoIE51bWJlciggZGF0ZV9iYW5kLnN0YXJ0X2Vwb2NoICkgPj0gZW5kX2Vwb2NoICkge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggISBjb2x1bW4gfHwgc2VnbWVudF9lbmRfZXBvY2ggPD0gc2VnbWVudF9zdGFydF9lcG9jaCApIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzdGFydF9tYXRjaCA9IGZvcm1hdF9pbnN0YW50KCBzZWdtZW50X3N0YXJ0X2Vwb2NoLCB0aW1lem9uZSApLm1hdGNoKCAvVChcXGR7Mn0pOihcXGR7Mn0pOjAwLyApO1xuXHRcdFx0XHRlbmRfbWF0Y2ggPSBmb3JtYXRfaW5zdGFudCggc2VnbWVudF9lbmRfZXBvY2gsIHRpbWV6b25lICkubWF0Y2goIC9UKFxcZHsyfSk6KFxcZHsyfSk6MDAvICk7XG5cdFx0XHRcdHN0YXJ0X3dhbGxfbWludXRlID0gc2VnbWVudF9zdGFydF9lcG9jaCA9PT0gTnVtYmVyKCBkYXRlX2JhbmQuc3RhcnRfZXBvY2ggKVxuXHRcdFx0XHRcdD8gMFxuXHRcdFx0XHRcdDogKCBzdGFydF9tYXRjaCA/IE51bWJlciggc3RhcnRfbWF0Y2hbIDEgXSApICogNjAgKyBOdW1iZXIoIHN0YXJ0X21hdGNoWyAyIF0gKSA6IC0xICk7XG5cdFx0XHRcdGVuZF93YWxsX21pbnV0ZSA9IHNlZ21lbnRfZW5kX2Vwb2NoID09PSBOdW1iZXIoIGRhdGVfYmFuZC5lbmRfZXBvY2ggKVxuXHRcdFx0XHRcdD8gMTQ0MFxuXHRcdFx0XHRcdDogKCBlbmRfbWF0Y2ggPyBOdW1iZXIoIGVuZF9tYXRjaFsgMSBdICkgKiA2MCArIE51bWJlciggZW5kX21hdGNoWyAyIF0gKSA6IC0xICk7XG5cdFx0XHRcdHZpc2libGVfc3RhcnRfbWludXRlID0gTWF0aC5tYXgoIHN0YXJ0X3dhbGxfbWludXRlLCBzbmFwc2hvdC52aXNpYmxlX3JhbmdlLnN0YXJ0X21pbnV0ZSApO1xuXHRcdFx0XHR2aXNpYmxlX2VuZF9taW51dGUgPSBNYXRoLm1pbiggZW5kX3dhbGxfbWludXRlLCBzbmFwc2hvdC52aXNpYmxlX3JhbmdlLmVuZF9taW51dGUgKTtcblx0XHRcdFx0aWYgKCAwID4gc3RhcnRfd2FsbF9taW51dGUgfHwgMCA+IGVuZF93YWxsX21pbnV0ZSB8fCB2aXNpYmxlX2VuZF9taW51dGUgPD0gdmlzaWJsZV9zdGFydF9taW51dGUgKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0bGVmdCA9ICdydGwnID09PSBzbmFwc2hvdC5kaXJlY3Rpb25cblx0XHRcdFx0XHQ/IHNuYXBzaG90LmlubGluZV9leHRlbnQgLSBjb2x1bW4ubG9naWNhbF9lbmRcblx0XHRcdFx0XHQ6IGNvbHVtbi5sb2dpY2FsX3N0YXJ0O1xuXG5cdFx0XHRcdGZyYWdtZW50cy5wdXNoKCB7XG5cdFx0XHRcdFx0ZGF0ZTogZGF0ZV9iYW5kLmRhdGUsXG5cdFx0XHRcdFx0bGVmdDogbGVmdCxcblx0XHRcdFx0XHR3aWR0aDogY29sdW1uLmxvZ2ljYWxfZW5kIC0gY29sdW1uLmxvZ2ljYWxfc3RhcnQsXG5cdFx0XHRcdFx0dG9wOiAoIHZpc2libGVfc3RhcnRfbWludXRlIC0gc25hcHNob3QudmlzaWJsZV9yYW5nZS5zdGFydF9taW51dGUgKSAqIHNuYXBzaG90LnBpeGVsc19wZXJfbWludXRlLFxuXHRcdFx0XHRcdGhlaWdodDogKCB2aXNpYmxlX2VuZF9taW51dGUgLSB2aXNpYmxlX3N0YXJ0X21pbnV0ZSApICogc25hcHNob3QucGl4ZWxzX3Blcl9taW51dGUsXG5cdFx0XHRcdFx0c3RhcnRfYm91bmRhcnlfdmlzaWJsZTogc3RhcnRfZXBvY2ggPj0gTnVtYmVyKCBkYXRlX2JhbmQuc3RhcnRfZXBvY2ggKVxuXHRcdFx0XHRcdFx0JiYgc3RhcnRfZXBvY2ggPCBOdW1iZXIoIGRhdGVfYmFuZC5lbmRfZXBvY2ggKVxuXHRcdFx0XHRcdFx0JiYgc3RhcnRfd2FsbF9taW51dGUgPj0gc25hcHNob3QudmlzaWJsZV9yYW5nZS5zdGFydF9taW51dGVcblx0XHRcdFx0XHRcdCYmIHN0YXJ0X3dhbGxfbWludXRlIDwgc25hcHNob3QudmlzaWJsZV9yYW5nZS5lbmRfbWludXRlLFxuXHRcdFx0XHRcdGVuZF9ib3VuZGFyeV92aXNpYmxlOiBlbmRfZXBvY2ggPiBOdW1iZXIoIGRhdGVfYmFuZC5zdGFydF9lcG9jaCApXG5cdFx0XHRcdFx0XHQmJiBlbmRfZXBvY2ggPD0gTnVtYmVyKCBkYXRlX2JhbmQuZW5kX2Vwb2NoIClcblx0XHRcdFx0XHRcdCYmIGVuZF93YWxsX21pbnV0ZSA+IHNuYXBzaG90LnZpc2libGVfcmFuZ2Uuc3RhcnRfbWludXRlXG5cdFx0XHRcdFx0XHQmJiBlbmRfd2FsbF9taW51dGUgPD0gc25hcHNob3QudmlzaWJsZV9yYW5nZS5lbmRfbWludXRlXG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGZyYWdtZW50cztcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDb252ZXJ0IG9uZSBleGFjdCBmdWxsLWRheSBpbnRlcnZhbCB0byBsb2FkZWQgbG9naWNhbCBkYXRlIGdlb21ldHJ5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNuYXBzaG90IFByZXBhcmVkIGdlb21ldHJ5IHNuYXBzaG90LlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBzdGFydF9lcG9jaCBFeGFjdCBpbmNsdXNpdmUgc3RhcnQgZXBvY2ggaW4gc2Vjb25kcy5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gZW5kX2Vwb2NoIEV4YWN0IGV4Y2x1c2l2ZSBlbmQgZXBvY2ggaW4gc2Vjb25kcy5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gQm91bmRlZCBpbmxpbmUgcmFuZ2UgYW5kIGNhbGVuZGFyLWRheSBjb3VudC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfZnVsbF9kYXlfdmlzdWFsX3JhbmdlKCBzbmFwc2hvdCwgc3RhcnRfZXBvY2gsIGVuZF9lcG9jaCApIHtcblx0XHRcdHZhciB2aXNpYmxlX2JhbmRzID0gc25hcHNob3QuZGF0ZV9iYW5kcy5maWx0ZXIoIGZ1bmN0aW9uICggZGF0ZV9iYW5kICkge1xuXHRcdFx0XHRyZXR1cm4gZGF0ZV9iYW5kLmVuZF9lcG9jaCA+IHN0YXJ0X2Vwb2NoICYmIGRhdGVfYmFuZC5zdGFydF9lcG9jaCA8IGVuZF9lcG9jaDtcblx0XHRcdH0gKTtcblx0XHRcdHZhciBsZWZ0ID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuXHRcdFx0dmFyIHJpZ2h0ID0gTnVtYmVyLk5FR0FUSVZFX0lORklOSVRZO1xuXG5cdFx0XHR2aXNpYmxlX2JhbmRzLmZvckVhY2goIGZ1bmN0aW9uICggZGF0ZV9iYW5kICkge1xuXHRcdFx0XHR2YXIgY29sdW1uID0gc25hcHNob3QuZGF0ZV9jb2x1bW5zWyBzbmFwc2hvdC5kYXRlX29yZGVyWyBkYXRlX2JhbmQuZGF0ZSBdIF07XG5cdFx0XHRcdHZhciBwaHlzaWNhbF9sZWZ0O1xuXHRcdFx0XHR2YXIgcGh5c2ljYWxfcmlnaHQ7XG5cblx0XHRcdFx0aWYgKCAhIGNvbHVtbiApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cGh5c2ljYWxfbGVmdCA9ICdydGwnID09PSBzbmFwc2hvdC5kaXJlY3Rpb24gPyBzbmFwc2hvdC5pbmxpbmVfZXh0ZW50IC0gY29sdW1uLmxvZ2ljYWxfZW5kIDogY29sdW1uLmxvZ2ljYWxfc3RhcnQ7XG5cdFx0XHRcdHBoeXNpY2FsX3JpZ2h0ID0gcGh5c2ljYWxfbGVmdCArIGNvbHVtbi5sb2dpY2FsX2VuZCAtIGNvbHVtbi5sb2dpY2FsX3N0YXJ0O1xuXHRcdFx0XHRsZWZ0ID0gTWF0aC5taW4oIGxlZnQsIHBoeXNpY2FsX2xlZnQgKTtcblx0XHRcdFx0cmlnaHQgPSBNYXRoLm1heCggcmlnaHQsIHBoeXNpY2FsX3JpZ2h0ICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiB2aXNpYmxlX2JhbmRzLmxlbmd0aCAmJiBOdW1iZXIuaXNGaW5pdGUoIGxlZnQgKSAmJiBOdW1iZXIuaXNGaW5pdGUoIHJpZ2h0IClcblx0XHRcdFx0PyB7IGxlZnQ6IGxlZnQsIHJpZ2h0OiByaWdodCwgZGF5X2NvdW50OiB2aXNpYmxlX2JhbmRzLmxlbmd0aCB9XG5cdFx0XHRcdDogbnVsbDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDb3VudCB3aG9sZSBsb2NhbCBjYWxlbmRhciBkYXlzIHdpdGhvdXQgYXNzdW1pbmcgZXZlcnkgZGF5IGlzIDI0IGhvdXJzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNuYXBzaG90IFByZXBhcmVkIHNlcnZlci10aW1lem9uZSBnZW9tZXRyeS5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gc3RhcnRfZXBvY2ggSW5jbHVzaXZlIHN0YXJ0IGVwb2NoLlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBlbmRfZXBvY2ggRXhjbHVzaXZlIGVuZCBlcG9jaC5cblx0XHQgKiBAcmV0dXJuIHtudW1iZXJ9IFBvc2l0aXZlIGNpdmlsLWRheSBjb3VudCwgb3IgemVybyBmb3IgaW52YWxpZCBpbnB1dC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfZnVsbF9kYXlfaW50ZXJ2YWxfY291bnQoIHNuYXBzaG90LCBzdGFydF9lcG9jaCwgZW5kX2Vwb2NoICkge1xuXHRcdFx0dmFyIHRpbWV6b25lID0gc25hcHNob3QgJiYgc25hcHNob3QuYWNjZXB0ZWRfaWRlbnRpdHkgPyBzbmFwc2hvdC5hY2NlcHRlZF9pZGVudGl0eS50aW1lem9uZSA6ICcnO1xuXHRcdFx0dmFyIHN0YXJ0X2RhdGUgPSBmb3JtYXRfaW5zdGFudCggc3RhcnRfZXBvY2gsIHRpbWV6b25lICkuc2xpY2UoIDAsIDEwICk7XG5cdFx0XHR2YXIgZW5kX2RhdGUgPSBmb3JtYXRfaW5zdGFudCggZW5kX2Vwb2NoLCB0aW1lem9uZSApLnNsaWNlKCAwLCAxMCApO1xuXHRcdFx0dmFyIGRheV9jb3VudCA9IGNhbGVuZGFyX2RheV9kZWx0YSggc3RhcnRfZGF0ZSwgZW5kX2RhdGUgKTtcblxuXHRcdFx0cmV0dXJuIG51bGwgIT09IGRheV9jb3VudCAmJiAwIDwgZGF5X2NvdW50ID8gZGF5X2NvdW50IDogMDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgYm91bmRlZCBkYXNoZWQgcmVzaXplIGZyYWdtZW50cyBmb3IgZXZlcnkgc2VydmVyLW93bmVkIG9jY3VycmVuY2UuXG5cdFx0ICpcblx0XHQgKiBUaW1lZCBib3VuZGFyeSBpbnRlcnZhbHMgYXJlIGRlbGliZXJhdGVseSBmcmFnbWVudGVkIGJ5IGFjY2VwdGVkIGRhdGVcblx0XHQgKiBjb2x1bW5zLiBUaGlzIHByZXNlcnZlcyB0aGUgZXhhY3Qgd2FsbC10aW1lIHNoYXBlIGFuZCBwcmV2ZW50cyBhIG11bHRpLWRheVxuXHRcdCAqIGludGVydmFsIGZyb20gYmVjb21pbmcgb25lIGhvcml6b250YWwgYm91bmRpbmcgcmVjdGFuZ2xlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGdlc3R1cmUgQWN0aXZlIHJlc2l6ZSBnZXN0dXJlLlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZXNpemVfcHJvamVjdGlvbiBMb2NhbCBwcmVzZW50YXRpb24gcHJvamVjdGlvbi5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9yZXNpemVfZ2hvc3RzKCBnZXN0dXJlLCByZXNpemVfcHJvamVjdGlvbiApIHtcblx0XHRcdHZhciByZW5kZXJlciA9IGdldF90ZW1wbGF0ZSggJ2dob3N0JyApO1xuXHRcdFx0dmFyIHNuYXBzaG90ID0gZ2VzdHVyZS5jb250ZXh0LnNuYXBzaG90O1xuXHRcdFx0dmFyIG9jY3VycmVuY2VfY291bnQgPSByZXNpemVfcHJvamVjdGlvbi5pbnRlcnZhbHMubGVuZ3RoO1xuXHRcdFx0dmFyIGlzX2Z1bGxfZGF5ID0gJ2FsbF9kYXknID09PSBnZXN0dXJlLmNvbnRleHQuc2VsZWN0aW9uX2tpbmQ7XG5cdFx0XHR2YXIgYm9va2luZ19jb2x1bW5fZ3V0dGVyX3B4ID0gaXNfZnVsbF9kYXkgPyAwIDogTWF0aC5tYXgoIDAsIE51bWJlciggZ2VzdHVyZS5jb250ZXh0LmJvb2tpbmdfY29sdW1uX2d1dHRlcl9weCApIHx8IDAgKTtcblx0XHRcdHZhciBwcmVzZW50YXRpb25zID0gW107XG5cblx0XHRcdGlmICggISByZW5kZXJlciApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Z2VzdHVyZS5naG9zdHMgPSBnZXN0dXJlLmdob3N0cyB8fCBbXTtcblx0XHRcdHJlc2l6ZV9wcm9qZWN0aW9uLmludGVydmFscy5mb3JFYWNoKCBmdW5jdGlvbiAoIGludGVydmFsICkge1xuXHRcdFx0XHR2YXIgZnVsbF9kYXlfcmFuZ2UgPSBpc19mdWxsX2RheSA/IGdldF9mdWxsX2RheV92aXN1YWxfcmFuZ2UoIHNuYXBzaG90LCBpbnRlcnZhbC5zdGFydF9lcG9jaCwgaW50ZXJ2YWwuZW5kX2Vwb2NoICkgOiBudWxsO1xuXHRcdFx0XHR2YXIgdGltZWRfZnJhZ21lbnRzID0gaXNfZnVsbF9kYXkgPyBbXSA6IGdldF90aW1lZF9yZXNpemVfdmlzdWFsX2ZyYWdtZW50cyggc25hcHNob3QsIGludGVydmFsLnN0YXJ0X2Vwb2NoLCBpbnRlcnZhbC5lbmRfZXBvY2ggKTtcblx0XHRcdFx0dmFyIGxhYmVscztcblx0XHRcdFx0dmFyIGxhcmdlc3RfaGVpZ2h0O1xuXHRcdFx0XHR2YXIgZHVyYXRpb25faW5kZXg7XG5cdFx0XHRcdHZhciBzdGFydF9pbmRleDtcblx0XHRcdFx0dmFyIGVuZF9pbmRleDtcblxuXHRcdFx0XHRsYWJlbHMgPSBpc19mdWxsX2RheVxuXHRcdFx0XHRcdD8geyBzdGFydDogJycsIGVuZDogJycsIGR1cmF0aW9uOiBTdHJpbmcoIGkxOG4ucmVzaXplX2R1cmF0aW9uX2RheXMgfHwgJyVzIGRheXMnICkucmVwbGFjZSggJyVzJywgZ2V0X2Z1bGxfZGF5X2ludGVydmFsX2NvdW50KCBzbmFwc2hvdCwgaW50ZXJ2YWwuc3RhcnRfZXBvY2gsIGludGVydmFsLmVuZF9lcG9jaCApICkgfVxuXHRcdFx0XHRcdDogYnVpbGRfcmVzaXplX3JhbmdlX2xhYmVscyggaW50ZXJ2YWwsIHNuYXBzaG90ICk7XG5cdFx0XHRcdGlmICggMSA8IG9jY3VycmVuY2VfY291bnQgKSB7XG5cdFx0XHRcdFx0bGFiZWxzLmR1cmF0aW9uICs9ICcgJyArIFN0cmluZyggaTE4bi5yZXNpemVfZ3JvdXAgfHwgJyVzIG9jY3VycmVuY2VzJyApLnJlcGxhY2UoICclcycsIG9jY3VycmVuY2VfY291bnQgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGlzX2Z1bGxfZGF5ICkge1xuXHRcdFx0XHRcdGlmICggZnVsbF9kYXlfcmFuZ2UgKSB7XG5cdFx0XHRcdFx0XHRwcmVzZW50YXRpb25zLnB1c2goIHtcblx0XHRcdFx0XHRcdFx0bGVmdDogZnVsbF9kYXlfcmFuZ2UubGVmdCxcblx0XHRcdFx0XHRcdFx0dG9wOiBNYXRoLm1heCggMCwgZ2VzdHVyZS5jYXJkX3JlY3QudG9wIC0gZ2VzdHVyZS5jb250ZXh0LnN1cmZhY2UuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkudG9wICksXG5cdFx0XHRcdFx0XHRcdHdpZHRoOiBmdWxsX2RheV9yYW5nZS5yaWdodCAtIGZ1bGxfZGF5X3JhbmdlLmxlZnQsXG5cdFx0XHRcdFx0XHRcdGhlaWdodDogZ2VzdHVyZS5jYXJkX3JlY3QuaGVpZ2h0LFxuXHRcdFx0XHRcdFx0XHRzdGFydF9sYWJlbDogJycsXG5cdFx0XHRcdFx0XHRcdGR1cmF0aW9uX2xhYmVsOiBsYWJlbHMuZHVyYXRpb24sXG5cdFx0XHRcdFx0XHRcdGVuZF9sYWJlbDogJycsXG5cdFx0XHRcdFx0XHRcdGFjdGl2ZV9ib3VuZGFyeTogJydcblx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHN0YXJ0X2luZGV4ID0gdGltZWRfZnJhZ21lbnRzLmZpbmRJbmRleCggZnVuY3Rpb24gKCBjYW5kaWRhdGUgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGNhbmRpZGF0ZS5zdGFydF9ib3VuZGFyeV92aXNpYmxlO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdGVuZF9pbmRleCA9IHRpbWVkX2ZyYWdtZW50cy5maW5kSW5kZXgoIGZ1bmN0aW9uICggY2FuZGlkYXRlICkge1xuXHRcdFx0XHRcdHJldHVybiBjYW5kaWRhdGUuZW5kX2JvdW5kYXJ5X3Zpc2libGU7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0bGFyZ2VzdF9oZWlnaHQgPSB0aW1lZF9mcmFnbWVudHMubGVuZ3RoID8gTWF0aC5tYXguYXBwbHkoIG51bGwsIHRpbWVkX2ZyYWdtZW50cy5tYXAoIGZ1bmN0aW9uICggY2FuZGlkYXRlICkge1xuXHRcdFx0XHRcdHJldHVybiBjYW5kaWRhdGUuaGVpZ2h0O1xuXHRcdFx0XHR9ICkgKSA6IDA7XG5cdFx0XHRcdGR1cmF0aW9uX2luZGV4ID0gdGltZWRfZnJhZ21lbnRzLmZpbmRJbmRleCggZnVuY3Rpb24gKCBjYW5kaWRhdGUgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGNhbmRpZGF0ZS5oZWlnaHQgPT09IGxhcmdlc3RfaGVpZ2h0O1xuXHRcdFx0XHR9ICk7XG5cblx0XHRcdFx0dGltZWRfZnJhZ21lbnRzLmZvckVhY2goIGZ1bmN0aW9uICggZnJhZ21lbnQsIGZyYWdtZW50X2luZGV4ICkge1xuXHRcdFx0XHRcdHZhciBjb2x1bW5fZ3V0dGVyID0gTWF0aC5taW4oIGJvb2tpbmdfY29sdW1uX2d1dHRlcl9weCwgTWF0aC5tYXgoIDAsICggZnJhZ21lbnQud2lkdGggLSAyICkgLyAyICkgKTtcblx0XHRcdFx0XHR2YXIgYWN0aXZlX2JvdW5kYXJ5ID0gJ3Jlc2l6ZV9zdGFydCcgPT09IGdlc3R1cmUub3BlcmF0aW9uICYmIGZyYWdtZW50LnN0YXJ0X2JvdW5kYXJ5X3Zpc2libGVcblx0XHRcdFx0XHRcdD8gJ3N0YXJ0J1xuXHRcdFx0XHRcdFx0OiAoICdyZXNpemVfZW5kJyA9PT0gZ2VzdHVyZS5vcGVyYXRpb24gJiYgZnJhZ21lbnQuZW5kX2JvdW5kYXJ5X3Zpc2libGUgPyAnZW5kJyA6ICcnICk7XG5cblx0XHRcdFx0XHRwcmVzZW50YXRpb25zLnB1c2goIHtcblx0XHRcdFx0XHRcdGxlZnQ6IGZyYWdtZW50LmxlZnQgKyBjb2x1bW5fZ3V0dGVyLFxuXHRcdFx0XHRcdFx0dG9wOiBmcmFnbWVudC50b3AsXG5cdFx0XHRcdFx0XHR3aWR0aDogTWF0aC5tYXgoIDIsIGZyYWdtZW50LndpZHRoIC0gY29sdW1uX2d1dHRlciAqIDIgKSxcblx0XHRcdFx0XHRcdGhlaWdodDogZnJhZ21lbnQuaGVpZ2h0LFxuXHRcdFx0XHRcdFx0c3RhcnRfbGFiZWw6IGZyYWdtZW50X2luZGV4ID09PSBzdGFydF9pbmRleCA/IGxhYmVscy5zdGFydCA6ICcnLFxuXHRcdFx0XHRcdFx0ZHVyYXRpb25fbGFiZWw6IGZyYWdtZW50X2luZGV4ID09PSBkdXJhdGlvbl9pbmRleCA/IGxhYmVscy5kdXJhdGlvbiA6ICcnLFxuXHRcdFx0XHRcdFx0ZW5kX2xhYmVsOiBmcmFnbWVudF9pbmRleCA9PT0gZW5kX2luZGV4ID8gbGFiZWxzLmVuZCA6ICcnLFxuXHRcdFx0XHRcdFx0YWN0aXZlX2JvdW5kYXJ5OiBhY3RpdmVfYm91bmRhcnlcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gKTtcblx0XHRcdHByZXNlbnRhdGlvbnMuZm9yRWFjaCggZnVuY3Rpb24gKCBwcmVzZW50YXRpb24sIGluZGV4ICkge1xuXHRcdFx0XHR2YXIgbW9kZWxfa2V5ID0gcHJlc2VudGF0aW9uLmFjdGl2ZV9ib3VuZGFyeVxuXHRcdFx0XHRcdCsgJ3wnICsgKCBwcmVzZW50YXRpb24uc3RhcnRfbGFiZWwgPyAnc3RhcnQnIDogJycgKVxuXHRcdFx0XHRcdCsgJ3wnICsgKCBwcmVzZW50YXRpb24uZHVyYXRpb25fbGFiZWwgPyAnZHVyYXRpb24nIDogJycgKVxuXHRcdFx0XHRcdCsgJ3wnICsgKCBwcmVzZW50YXRpb24uZW5kX2xhYmVsID8gJ2VuZCcgOiAnJyApO1xuXHRcdFx0XHR2YXIgZ2hvc3QgPSBnZXN0dXJlLmdob3N0c1sgaW5kZXggXTtcblx0XHRcdFx0dmFyIGJ1ZmZlcjtcblx0XHRcdFx0dmFyIHN0YXJ0X2xhYmVsX2VsZW1lbnQ7XG5cdFx0XHRcdHZhciBkdXJhdGlvbl9sYWJlbF9lbGVtZW50O1xuXHRcdFx0XHR2YXIgZW5kX2xhYmVsX2VsZW1lbnQ7XG5cblx0XHRcdFx0aWYgKCAhIGdob3N0IHx8IGdob3N0LndwYmNfbW9kZWxfa2V5ICE9PSBtb2RlbF9rZXkgKSB7XG5cdFx0XHRcdFx0aWYgKCBnaG9zdCApIHtcblx0XHRcdFx0XHRcdGdob3N0LnJlbW92ZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRidWZmZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKTtcblx0XHRcdFx0XHRidWZmZXIuaW5uZXJIVE1MID0gcmVuZGVyZXIoIHtcblx0XHRcdFx0XHRcdHN0YXJ0X2xhYmVsOiBwcmVzZW50YXRpb24uc3RhcnRfbGFiZWwsXG5cdFx0XHRcdFx0XHRkdXJhdGlvbl9sYWJlbDogcHJlc2VudGF0aW9uLmR1cmF0aW9uX2xhYmVsLFxuXHRcdFx0XHRcdFx0ZW5kX2xhYmVsOiBwcmVzZW50YXRpb24uZW5kX2xhYmVsLFxuXHRcdFx0XHRcdFx0c2hvd19zdGFydDogJ3N0YXJ0JyA9PT0gcHJlc2VudGF0aW9uLmFjdGl2ZV9ib3VuZGFyeSxcblx0XHRcdFx0XHRcdHNob3dfZW5kOiAnZW5kJyA9PT0gcHJlc2VudGF0aW9uLmFjdGl2ZV9ib3VuZGFyeVxuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRnaG9zdCA9IGJ1ZmZlci5maXJzdEVsZW1lbnRDaGlsZDtcblx0XHRcdFx0XHRpZiAoICEgZ2hvc3QgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGdob3N0LmNsYXNzTGlzdC5hZGQoICdpcy1yZXNpemUnICk7XG5cdFx0XHRcdFx0Z2hvc3Qud3BiY19tb2RlbF9rZXkgPSBtb2RlbF9rZXk7XG5cdFx0XHRcdFx0Z2VzdHVyZS5jb250ZXh0LnN1cmZhY2UuYXBwZW5kQ2hpbGQoIGdob3N0ICk7XG5cdFx0XHRcdFx0Z2VzdHVyZS5naG9zdHNbIGluZGV4IF0gPSBnaG9zdDtcblx0XHRcdFx0fVxuXHRcdFx0XHRzdGFydF9sYWJlbF9lbGVtZW50ID0gZ2hvc3QucXVlcnlTZWxlY3RvciA/IGdob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1yZXNpemUtc3RhcnQtbGFiZWxdJyApIDogbnVsbDtcblx0XHRcdFx0ZHVyYXRpb25fbGFiZWxfZWxlbWVudCA9IGdob3N0LnF1ZXJ5U2VsZWN0b3IgPyBnaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3MtcmVzaXplLWR1cmF0aW9uXScgKSA6IG51bGw7XG5cdFx0XHRcdGVuZF9sYWJlbF9lbGVtZW50ID0gZ2hvc3QucXVlcnlTZWxlY3RvciA/IGdob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1yZXNpemUtZW5kLWxhYmVsXScgKSA6IG51bGw7XG5cdFx0XHRcdGlmICggc3RhcnRfbGFiZWxfZWxlbWVudCApIHtcblx0XHRcdFx0XHRzdGFydF9sYWJlbF9lbGVtZW50LnRleHRDb250ZW50ID0gcHJlc2VudGF0aW9uLnN0YXJ0X2xhYmVsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggZHVyYXRpb25fbGFiZWxfZWxlbWVudCApIHtcblx0XHRcdFx0XHRkdXJhdGlvbl9sYWJlbF9lbGVtZW50LnRleHRDb250ZW50ID0gcHJlc2VudGF0aW9uLmR1cmF0aW9uX2xhYmVsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggZW5kX2xhYmVsX2VsZW1lbnQgKSB7XG5cdFx0XHRcdFx0ZW5kX2xhYmVsX2VsZW1lbnQudGV4dENvbnRlbnQgPSBwcmVzZW50YXRpb24uZW5kX2xhYmVsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGdob3N0LnN0eWxlLmxlZnQgPSBNYXRoLm1heCggMCwgcHJlc2VudGF0aW9uLmxlZnQgKSArICdweCc7XG5cdFx0XHRcdGdob3N0LnN0eWxlLnRvcCA9IE1hdGgubWF4KCAwLCBwcmVzZW50YXRpb24udG9wICkgKyAncHgnO1xuXHRcdFx0XHRnaG9zdC5zdHlsZS53aWR0aCA9IE1hdGgubWF4KCAyLCBNYXRoLm1pbiggc25hcHNob3QuaW5saW5lX2V4dGVudCAtIE1hdGgubWF4KCAwLCBwcmVzZW50YXRpb24ubGVmdCApLCBwcmVzZW50YXRpb24ud2lkdGggKSApICsgJ3B4Jztcblx0XHRcdFx0Z2hvc3Quc3R5bGUuaGVpZ2h0ID0gTWF0aC5tYXgoIDIsIE1hdGgubWluKCBzbmFwc2hvdC5ibG9ja19leHRlbnRfcHggLSBNYXRoLm1heCggMCwgcHJlc2VudGF0aW9uLnRvcCApLCBwcmVzZW50YXRpb24uaGVpZ2h0ICkgKSArICdweCc7XG5cdFx0XHR9ICk7XG5cdFx0XHR3aGlsZSAoIGdlc3R1cmUuZ2hvc3RzLmxlbmd0aCA+IHByZXNlbnRhdGlvbnMubGVuZ3RoICkge1xuXHRcdFx0XHRnZXN0dXJlLmdob3N0cy5wb3AoKS5yZW1vdmUoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBbm5vdW5jZSBnZXN0dXJlIHN0YXR1cyB0aHJvdWdoIHRoZSBzZWxlY3RlZCBjYXJkJ3MgZml4ZWQgbGl2ZSByZWdpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZ2VzdHVyZSBBY3RpdmUgZ2VzdHVyZSBzdGF0ZS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBBdXRob3JpemVkIGxvY2FsaXplZCBtZXNzYWdlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYW5ub3VuY2VfZ2VzdHVyZSggZ2VzdHVyZSwgbWVzc2FnZSApIHtcblx0XHRcdHZhciBzdGF0dXMgPSBnZXN0dXJlICYmIGdlc3R1cmUucmVnaXN0cmF0aW9uICYmIGdlc3R1cmUucmVnaXN0cmF0aW9uLmNhcmRcblx0XHRcdFx0PyBnZXN0dXJlLnJlZ2lzdHJhdGlvbi5jYXJkLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1tb3ZlbWVudC1zdGF0dXNdJyApXG5cdFx0XHRcdDogbnVsbDtcblxuXHRcdFx0aWYgKCBzdGF0dXMgKSB7XG5cdFx0XHRcdHN0YXR1cy50ZXh0Q29udGVudCA9IFN0cmluZyggbWVzc2FnZSB8fCAnJyApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE1hcmsgb25seSB0aGUgY3VycmVudGx5IGF1dGhvcml6ZWQgY3Jvc3MtUmVzb3VyY2UgZGVzdGluYXRpb24gc3VyZmFjZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBnZXN0dXJlIEFjdGl2ZSBtb3ZlbWVudCBnZXN0dXJlLlxuXHRcdCAqIEBwYXJhbSB7RWxlbWVudHxudWxsfSBzdXJmYWNlIEN1cnJlbnQgYWNjZXB0ZWQgdGFyZ2V0IHN1cmZhY2UuXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBpc19jcm9zc19yZXNvdXJjZSBXaGV0aGVyIHRoZSB0YXJnZXQgY2hhbmdlcyBSZXNvdXJjZS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNldF9nZXN0dXJlX3RhcmdldF9zdXJmYWNlKCBnZXN0dXJlLCBzdXJmYWNlLCBpc19jcm9zc19yZXNvdXJjZSApIHtcblx0XHRcdGlmICggZ2VzdHVyZS50YXJnZXRfc3VyZmFjZSAmJiBnZXN0dXJlLnRhcmdldF9zdXJmYWNlLmNsYXNzTGlzdCApIHtcblx0XHRcdFx0Z2VzdHVyZS50YXJnZXRfc3VyZmFjZS5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtdGltZS1yb3dzLW1vdmVtZW50LXRhcmdldCcgKTtcblx0XHRcdH1cblx0XHRcdGdlc3R1cmUudGFyZ2V0X3N1cmZhY2UgPSBzdXJmYWNlIHx8IG51bGw7XG5cdFx0XHRpZiAoIGlzX2Nyb3NzX3Jlc291cmNlICYmIHN1cmZhY2UgJiYgc3VyZmFjZS5jbGFzc0xpc3QgKSB7XG5cdFx0XHRcdHN1cmZhY2UuY2xhc3NMaXN0LmFkZCggJ2lzLXRpbWUtcm93cy1tb3ZlbWVudC10YXJnZXQnICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVzb2x2ZSB0aGUgdmlzdWFsIHRyYW5zbGF0aW9uIGJldHdlZW4gdHdvIGdlb21ldHJ5IGNlbGxzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGdlc3R1cmUgQWN0aXZlIGdlc3R1cmUgc3RhdGUuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBQaHlzaWNhbCBpbmxpbmUgYW5kIGJsb2NrIGRlbHRhcy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfdmlzdWFsX2RlbHRhKCBnZXN0dXJlICkge1xuXHRcdFx0dmFyIG9yaWdpbl9zbmFwc2hvdCA9IGdlc3R1cmUuY29udGV4dC5zbmFwc2hvdDtcblx0XHRcdHZhciBjdXJyZW50X3NuYXBzaG90ID0gZ2VzdHVyZS5jdXJyZW50X2NvbnRleHQgPyBnZXN0dXJlLmN1cnJlbnRfY29udGV4dC5zbmFwc2hvdCA6IG9yaWdpbl9zbmFwc2hvdDtcblx0XHRcdHZhciBvcmlnaW5fY29sdW1uID0gb3JpZ2luX3NuYXBzaG90LmRhdGVfY29sdW1uc1sgb3JpZ2luX3NuYXBzaG90LmRhdGVfb3JkZXJbIGdlc3R1cmUub3JpZ2luLmRhdGUgXSBdO1xuXHRcdFx0dmFyIGN1cnJlbnRfY29sdW1uID0gY3VycmVudF9zbmFwc2hvdC5kYXRlX2NvbHVtbnNbIGN1cnJlbnRfc25hcHNob3QuZGF0ZV9vcmRlclsgZ2VzdHVyZS5jdXJyZW50LmRhdGUgXSBdO1xuXHRcdFx0dmFyIGxvZ2ljYWxfZGVsdGEgPSBjdXJyZW50X2NvbHVtbi5sb2dpY2FsX3N0YXJ0IC0gb3JpZ2luX2NvbHVtbi5sb2dpY2FsX3N0YXJ0O1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRpbmxpbmU6ICdydGwnID09PSBjdXJyZW50X3NuYXBzaG90LmRpcmVjdGlvbiA/IC1sb2dpY2FsX2RlbHRhIDogbG9naWNhbF9kZWx0YSxcblx0XHRcdFx0YmxvY2s6ICd0aW1lZCcgPT09IGdlc3R1cmUuY29udGV4dC5zZWxlY3Rpb25fa2luZFxuXHRcdFx0XHRcdD8gKCBnZXN0dXJlLmN1cnJlbnQud2FsbF9taW51dGUgLSBnZXN0dXJlLm9yaWdpbi53YWxsX21pbnV0ZSApICogY3VycmVudF9zbmFwc2hvdC5waXhlbHNfcGVyX21pbnV0ZVxuXHRcdFx0XHRcdDogMFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBQb3NpdGlvbiBvbmUgbW92ZW1lbnQgZ2hvc3QgaW5zaWRlIGEgZGlmZmVyZW50IGF1dGhvcml6ZWQgUmVzb3VyY2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZ2VzdHVyZSBBY3RpdmUgY3Jvc3MtUmVzb3VyY2UgbW92ZW1lbnQgZ2VzdHVyZS5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGFyZ2V0IGdlb21ldHJ5IHdhcyBhdmFpbGFibGUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcG9zaXRpb25fY3Jvc3NfcmVzb3VyY2VfbW92ZW1lbnRfZ2hvc3QoIGdlc3R1cmUgKSB7XG5cdFx0XHR2YXIgbW92ZW1lbnQgPSBnZXN0dXJlLmVsaWdpYmlsaXR5Lm1vdmVtZW50O1xuXHRcdFx0dmFyIGNvbnRleHQgPSBnZXN0dXJlLmN1cnJlbnRfY29udGV4dDtcblx0XHRcdHZhciBzbmFwc2hvdCA9IGNvbnRleHQuc25hcHNob3Q7XG5cdFx0XHR2YXIgcG9pbnQ7XG5cdFx0XHR2YXIgZW5kX3BvaW50O1xuXHRcdFx0dmFyIGR1cmF0aW9uX3NlY29uZHM7XG5cdFx0XHR2YXIgZGF0ZV9kZWx0YTtcblx0XHRcdHZhciBzaGlmdGVkX2RhdGVzO1xuXHRcdFx0dmFyIHN0YXJ0X2JhbmQ7XG5cdFx0XHR2YXIgZW5kX2JhbmQ7XG5cdFx0XHR2YXIgZnVsbF9kYXlfcmFuZ2U7XG5cblx0XHRcdGlmICggJ2Z1bGxfZGF5JyA9PT0gbW92ZW1lbnQudGltZV9hcHBsaWNhdGlvbiApIHtcblx0XHRcdFx0ZGF0ZV9kZWx0YSA9IGNhbGVuZGFyX2RheV9kZWx0YSggZ2VzdHVyZS5vcmlnaW4uZGF0ZSwgZ2VzdHVyZS5jdXJyZW50LmRhdGUgKTtcblx0XHRcdFx0c2hpZnRlZF9kYXRlcyA9IG51bGwgPT09IGRhdGVfZGVsdGEgPyBbXSA6IG1vdmVtZW50LnNlbGVjdGVkX2RhdGVzLm1hcCggZnVuY3Rpb24gKCBkYXRlICkge1xuXHRcdFx0XHRcdHJldHVybiBzaGlmdF9kYXRlKCBkYXRlLCBkYXRlX2RlbHRhICk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0c3RhcnRfYmFuZCA9IHNoaWZ0ZWRfZGF0ZXMubGVuZ3RoID8gc25hcHNob3QuYmFuZHNfYnlfZGF0ZVsgc2hpZnRlZF9kYXRlc1sgMCBdIF0gOiBudWxsO1xuXHRcdFx0XHRlbmRfYmFuZCA9IHNoaWZ0ZWRfZGF0ZXMubGVuZ3RoID8gc25hcHNob3QuYmFuZHNfYnlfZGF0ZVsgc2hpZnRlZF9kYXRlc1sgc2hpZnRlZF9kYXRlcy5sZW5ndGggLSAxIF0gXSA6IG51bGw7XG5cdFx0XHRcdGZ1bGxfZGF5X3JhbmdlID0gc3RhcnRfYmFuZCAmJiBlbmRfYmFuZFxuXHRcdFx0XHRcdD8gZ2V0X2Z1bGxfZGF5X3Zpc3VhbF9yYW5nZSggc25hcHNob3QsIHN0YXJ0X2JhbmQuc3RhcnRfZXBvY2gsIGVuZF9iYW5kLmVuZF9lcG9jaCApXG5cdFx0XHRcdFx0OiBudWxsO1xuXHRcdFx0XHRpZiAoICEgZnVsbF9kYXlfcmFuZ2UgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGdlc3R1cmUuZ2hvc3Quc3R5bGUubGVmdCA9IGZ1bGxfZGF5X3JhbmdlLmxlZnQgKyAncHgnO1xuXHRcdFx0XHRnZXN0dXJlLmdob3N0LnN0eWxlLnRvcCA9IE1hdGgubWF4KCAwLCBnZXN0dXJlLmNhcmRfcmVjdC50b3AgLSBnZXN0dXJlLmNvbnRleHQuc3VyZmFjZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS50b3AgKSArICdweCc7XG5cdFx0XHRcdGdlc3R1cmUuZ2hvc3Quc3R5bGUud2lkdGggPSBNYXRoLm1heCggMiwgZnVsbF9kYXlfcmFuZ2UucmlnaHQgLSBmdWxsX2RheV9yYW5nZS5sZWZ0ICkgKyAncHgnO1xuXHRcdFx0XHRnZXN0dXJlLmdob3N0LnN0eWxlLmhlaWdodCA9IGdlc3R1cmUuY2FyZF9yZWN0LmhlaWdodCArICdweCc7XG5cdFx0XHRcdGdlc3R1cmUuZ2hvc3Quc3R5bGUudHJhbnNmb3JtID0gJ25vbmUnO1xuXG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0cG9pbnQgPSBnZXRfcmVzaXplX3Zpc3VhbF9wb2ludCggc25hcHNob3QsIGdlc3R1cmUuY3VycmVudC5lcG9jaCApO1xuXHRcdFx0ZHVyYXRpb25fc2Vjb25kcyA9IG1vdmVtZW50LmV4YWN0X2ludGVydmFscy5sZW5ndGhcblx0XHRcdFx0PyAoIERhdGUucGFyc2UoIG1vdmVtZW50LmV4YWN0X2ludGVydmFsc1sgMCBdLmVuZCApIC0gRGF0ZS5wYXJzZSggbW92ZW1lbnQuZXhhY3RfaW50ZXJ2YWxzWyAwIF0uc3RhcnQgKSApIC8gMTAwMFxuXHRcdFx0XHQ6IDA7XG5cdFx0XHRlbmRfcG9pbnQgPSAwIDwgZHVyYXRpb25fc2Vjb25kcyA/IGdldF9yZXNpemVfdmlzdWFsX3BvaW50KCBzbmFwc2hvdCwgZ2VzdHVyZS5jdXJyZW50LmVwb2NoICsgZHVyYXRpb25fc2Vjb25kcyApIDogbnVsbDtcblx0XHRcdGlmICggISBwb2ludCApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0Z2VzdHVyZS5naG9zdC5zdHlsZS5sZWZ0ID0gcG9pbnQubGVmdCArIDQgKyAncHgnO1xuXHRcdFx0Z2VzdHVyZS5naG9zdC5zdHlsZS50b3AgPSBNYXRoLm1heCggMCwgcG9pbnQudG9wICkgKyAncHgnO1xuXHRcdFx0Z2VzdHVyZS5naG9zdC5zdHlsZS53aWR0aCA9IE1hdGgubWF4KCAyLCBwb2ludC53aWR0aCAtIDggKSArICdweCc7XG5cdFx0XHRnZXN0dXJlLmdob3N0LnN0eWxlLmhlaWdodCA9IGVuZF9wb2ludCAmJiBlbmRfcG9pbnQuZGF0ZSA9PT0gcG9pbnQuZGF0ZVxuXHRcdFx0XHQ/IE1hdGgubWF4KCAyLCBlbmRfcG9pbnQudG9wIC0gcG9pbnQudG9wICkgKyAncHgnXG5cdFx0XHRcdDogZ2VzdHVyZS5jYXJkX3JlY3QuaGVpZ2h0ICsgJ3B4Jztcblx0XHRcdGdlc3R1cmUuZ2hvc3Quc3R5bGUudHJhbnNmb3JtID0gJ25vbmUnO1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgb3IgdXBkYXRlIHRoZSBwcmVzZW50YXRpb24tb25seSBwcm9wb3NhbCBnaG9zdC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBnZXN0dXJlIEFjdGl2ZSBnZXN0dXJlIHN0YXRlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX2dlc3R1cmVfZ2hvc3QoIGdlc3R1cmUgKSB7XG5cdFx0XHR2YXIgcmVuZGVyZXIgPSBnZXRfdGVtcGxhdGUoICdnaG9zdCcgKTtcblx0XHRcdHZhciBidWZmZXI7XG5cdFx0XHR2YXIgZGVsdGE7XG5cdFx0XHR2YXIgdGltZV9sYWJlbDtcblx0XHRcdHZhciByZXNpemVfcHJvamVjdGlvbjtcblxuXHRcdFx0aWYgKCAhIHJlbmRlcmVyIHx8ICEgZ2VzdHVyZS5jdXJyZW50IHx8ICdleGFjdCcgIT09IGdlc3R1cmUuY3VycmVudC5zdGF0dXMgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggJ3Jlc2l6ZScgPT09IGdlc3R1cmUuZ2VzdHVyZV90eXBlICkge1xuXHRcdFx0XHRyZXNpemVfcHJvamVjdGlvbiA9IGJ1aWxkX3Jlc2l6ZV9wcm9qZWN0aW9uKCBnZXN0dXJlICk7XG5cdFx0XHRcdGlmICggcmVzaXplX3Byb2plY3Rpb24gKSB7XG5cdFx0XHRcdFx0Z2VzdHVyZS5yZXNpemVfcHJvamVjdGlvbiA9IHJlc2l6ZV9wcm9qZWN0aW9uO1xuXHRcdFx0XHRcdHJlbmRlcl9yZXNpemVfZ2hvc3RzKCBnZXN0dXJlLCByZXNpemVfcHJvamVjdGlvbiApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISBnZXN0dXJlLmdob3N0ICkge1xuXHRcdFx0XHRidWZmZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKTtcblx0XHRcdFx0dGltZV9sYWJlbCA9IFN0cmluZyggZ2VzdHVyZS5jdXJyZW50LmRhdGUgKSArICggJ3RpbWVkJyA9PT0gZ2VzdHVyZS5jb250ZXh0LnNlbGVjdGlvbl9raW5kXG5cdFx0XHRcdFx0PyAnICcgKyBTdHJpbmcoIE1hdGguZmxvb3IoIGdlc3R1cmUuY3VycmVudC53YWxsX21pbnV0ZSAvIDYwICkgKS5wYWRTdGFydCggMiwgJzAnICkgKyAnOicgKyBTdHJpbmcoIGdlc3R1cmUuY3VycmVudC53YWxsX21pbnV0ZSAlIDYwICkucGFkU3RhcnQoIDIsICcwJyApXG5cdFx0XHRcdFx0OiAnJyApO1xuXHRcdFx0XHRidWZmZXIuaW5uZXJIVE1MID0gcmVuZGVyZXIoIHsgbGFiZWw6IHRpbWVfbGFiZWwgfSApO1xuXHRcdFx0XHRnZXN0dXJlLmdob3N0ID0gYnVmZmVyLmZpcnN0RWxlbWVudENoaWxkO1xuXHRcdFx0XHRpZiAoICEgZ2VzdHVyZS5naG9zdCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Z2VzdHVyZS5naG9zdC5zdHlsZS5sZWZ0ID0gZ2VzdHVyZS5jYXJkX3JlY3QubGVmdCAtIGdlc3R1cmUuY29udGV4dC5zdXJmYWNlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmxlZnQgKyAncHgnO1xuXHRcdFx0XHRnZXN0dXJlLmdob3N0LnN0eWxlLnRvcCA9IGdlc3R1cmUuY2FyZF9yZWN0LnRvcCAtIGdlc3R1cmUuY29udGV4dC5zdXJmYWNlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLnRvcCArICdweCc7XG5cdFx0XHRcdGdlc3R1cmUuZ2hvc3Quc3R5bGUud2lkdGggPSBnZXN0dXJlLmNhcmRfcmVjdC53aWR0aCArICdweCc7XG5cdFx0XHRcdGdlc3R1cmUuZ2hvc3Quc3R5bGUuaGVpZ2h0ID0gZ2VzdHVyZS5jYXJkX3JlY3QuaGVpZ2h0ICsgJ3B4Jztcblx0XHRcdH1cblx0XHRcdGlmICggZ2VzdHVyZS5naG9zdC5wYXJlbnROb2RlICE9PSBnZXN0dXJlLmN1cnJlbnRfY29udGV4dC5zdXJmYWNlICkge1xuXHRcdFx0XHRnZXN0dXJlLmN1cnJlbnRfY29udGV4dC5zdXJmYWNlLmFwcGVuZENoaWxkKCBnZXN0dXJlLmdob3N0ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGdlc3R1cmUudGFyZ2V0X3Jlc291cmNlX2lkICE9PSBnZXN0dXJlLnJlZ2lzdHJhdGlvbi5yZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0cG9zaXRpb25fY3Jvc3NfcmVzb3VyY2VfbW92ZW1lbnRfZ2hvc3QoIGdlc3R1cmUgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZGVsdGEgPSBnZXRfdmlzdWFsX2RlbHRhKCBnZXN0dXJlICk7XG5cdFx0XHRnZXN0dXJlLmdob3N0LnN0eWxlLmxlZnQgPSBnZXN0dXJlLmNhcmRfcmVjdC5sZWZ0IC0gZ2VzdHVyZS5jb250ZXh0LnN1cmZhY2UuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkubGVmdCArICdweCc7XG5cdFx0XHRnZXN0dXJlLmdob3N0LnN0eWxlLnRvcCA9IGdlc3R1cmUuY2FyZF9yZWN0LnRvcCAtIGdlc3R1cmUuY29udGV4dC5zdXJmYWNlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLnRvcCArICdweCc7XG5cdFx0XHRnZXN0dXJlLmdob3N0LnN0eWxlLndpZHRoID0gZ2VzdHVyZS5jYXJkX3JlY3Qud2lkdGggKyAncHgnO1xuXHRcdFx0Z2VzdHVyZS5naG9zdC5zdHlsZS5oZWlnaHQgPSBnZXN0dXJlLmNhcmRfcmVjdC5oZWlnaHQgKyAncHgnO1xuXHRcdFx0Z2VzdHVyZS5naG9zdC5zdHlsZS50cmFuc2Zvcm0gPSAndHJhbnNsYXRlM2QoJyArIGRlbHRhLmlubGluZSArICdweCwgJyArIGRlbHRhLmJsb2NrICsgJ3B4LCAwKSc7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29tbWl0IG9uZSBjb2FsZXNjZWQgZ2VzdHVyZSB2aXN1YWwgdXBkYXRlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBmbHVzaF9nZXN0dXJlX2ZyYW1lKCkge1xuXHRcdFx0dmFyIGdlc3R1cmUgPSBhY3RpdmVfZ2VzdHVyZTtcblx0XHRcdHZhciB0YXJnZXRfY29udGV4dDtcblx0XHRcdHZhciB0YXJnZXRfcmVzb3VyY2VfaWQ7XG5cdFx0XHR2YXIgdGFyZ2V0X2lzX2Nyb3NzX3Jlc291cmNlO1xuXHRcdFx0dmFyIHJlc29sdmVkO1xuXHRcdFx0dmFyIHByb3Bvc2VkX3RpbWU7XG5cblx0XHRcdGdlc3R1cmVfZnJhbWUgPSAwO1xuXHRcdFx0aWYgKCAhIGdlc3R1cmUgfHwgISBnZXN0dXJlLnBlbmRpbmdfY29vcmRpbmF0ZSB8fCAhIGlzX3JlZ2lzdHJhdGlvbl9jdXJyZW50KCBnZXN0dXJlLnJlZ2lzdHJhdGlvbiApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0YXJnZXRfY29udGV4dCA9IGdlc3R1cmUucGVuZGluZ19jb250ZXh0IHx8IGdlc3R1cmUuY29udGV4dDtcblx0XHRcdHRhcmdldF9yZXNvdXJjZV9pZCA9IG5vcm1hbGl6ZV9wb3NpdGl2ZV9pbnRlZ2VyKCBnZXN0dXJlLnBlbmRpbmdfdGFyZ2V0X3Jlc291cmNlX2lkICkgfHwgZ2VzdHVyZS5yZWdpc3RyYXRpb24ucmVzb3VyY2VfaWQ7XG5cdFx0XHR0YXJnZXRfaXNfY3Jvc3NfcmVzb3VyY2UgPSAnbW92ZW1lbnQnID09PSBnZXN0dXJlLmdlc3R1cmVfdHlwZVxuXHRcdFx0XHQmJiB0YXJnZXRfcmVzb3VyY2VfaWQgIT09IGdlc3R1cmUucmVnaXN0cmF0aW9uLnJlc291cmNlX2lkO1xuXHRcdFx0aWYgKCAhIGlzX2dlc3R1cmVfY29udGV4dF9jdXJyZW50KCB0YXJnZXRfY29udGV4dCApICkge1xuXHRcdFx0XHRnZXN0dXJlLnBlbmRpbmdfY29vcmRpbmF0ZSA9IG51bGw7XG5cdFx0XHRcdGdlc3R1cmUucGVuZGluZ19jb250ZXh0ID0gbnVsbDtcblx0XHRcdFx0c2V0X2dlc3R1cmVfdGFyZ2V0X3N1cmZhY2UoIGdlc3R1cmUsIG51bGwsIGZhbHNlICk7XG5cdFx0XHRcdGFubm91bmNlX2dlc3R1cmUoIGdlc3R1cmUsIGkxOG4ub3V0c2lkZV91bmF2YWlsYWJsZSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyZXNvbHZlZCA9ICdyZXNpemUnID09PSBnZXN0dXJlLmdlc3R1cmVfdHlwZVxuXHRcdFx0XHQmJiAndGltZWQnID09PSB0YXJnZXRfY29udGV4dC5zZWxlY3Rpb25fa2luZFxuXHRcdFx0XHQmJiAncmVsYXRpdmVfcmVzaXplJyA9PT0gZ2VzdHVyZS5wZW5kaW5nX2Nvb3JkaW5hdGUuc291cmNlXG5cdFx0XHRcdCYmIGdlb21ldHJ5XG5cdFx0XHRcdCYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBnZW9tZXRyeS5yZXNvbHZlX3dhbGxfdGltZVxuXHRcdFx0XHQ/IGdlb21ldHJ5LnJlc29sdmVfd2FsbF90aW1lKFxuXHRcdFx0XHRcdHRhcmdldF9jb250ZXh0LnNuYXBzaG90LFxuXHRcdFx0XHRcdGdlc3R1cmUucGVuZGluZ19jb29yZGluYXRlLmRhdGUsXG5cdFx0XHRcdFx0Z2VzdHVyZS5wZW5kaW5nX2Nvb3JkaW5hdGUud2FsbF9taW51dGUsXG5cdFx0XHRcdFx0Jydcblx0XHRcdFx0KVxuXHRcdFx0XHQ6IGdlb21ldHJ5LnJlc29sdmVfY29vcmRpbmF0ZSggdGFyZ2V0X2NvbnRleHQuc25hcHNob3QsIGdlc3R1cmUucGVuZGluZ19jb29yZGluYXRlICk7XG5cdFx0XHRpZiAoICdyZXNpemUnID09PSBnZXN0dXJlLmdlc3R1cmVfdHlwZSAmJiAnYWxsX2RheScgPT09IHRhcmdldF9jb250ZXh0LnNlbGVjdGlvbl9raW5kICkge1xuXHRcdFx0XHRyZXNvbHZlZCA9IHJlc29sdmVfZnVsbF9kYXlfdGFyZ2V0X2JvdW5kYXJ5KCB0YXJnZXRfY29udGV4dC5zbmFwc2hvdCwgcmVzb2x2ZWQsIGdlc3R1cmUub3BlcmF0aW9uICk7XG5cdFx0XHR9XG5cdFx0XHRnZXN0dXJlLmN1cnJlbnQgPSByZXNvbHZlZDtcblx0XHRcdGdlc3R1cmUuY3VycmVudF9jb250ZXh0ID0gdGFyZ2V0X2NvbnRleHQ7XG5cdFx0XHRnZXN0dXJlLnRhcmdldF9yZXNvdXJjZV9pZCA9IHRhcmdldF9yZXNvdXJjZV9pZDtcblx0XHRcdGdlc3R1cmUucGVuZGluZ19jb29yZGluYXRlID0gbnVsbDtcblx0XHRcdGdlc3R1cmUucGVuZGluZ19jb250ZXh0ID0gbnVsbDtcblx0XHRcdGdlc3R1cmUucGVuZGluZ190YXJnZXRfcmVzb3VyY2VfaWQgPSAwO1xuXHRcdFx0aWYgKCAhIGdlc3R1cmUuY3VycmVudCB8fCAnZXhhY3QnICE9PSBnZXN0dXJlLmN1cnJlbnQuc3RhdHVzICkge1xuXHRcdFx0XHRzZXRfZ2VzdHVyZV90YXJnZXRfc3VyZmFjZSggZ2VzdHVyZSwgbnVsbCwgZmFsc2UgKTtcblx0XHRcdFx0YW5ub3VuY2VfZ2VzdHVyZSggZ2VzdHVyZSwgJ2dhcCcgPT09ICggZ2VzdHVyZS5jdXJyZW50ICYmIGdlc3R1cmUuY3VycmVudC5zdGF0dXMgKSA/IGkxOG4uZ2FwX3VuYXZhaWxhYmxlIDogKCAnZm9sZCcgPT09ICggZ2VzdHVyZS5jdXJyZW50ICYmIGdlc3R1cmUuY3VycmVudC5zdGF0dXMgKSA/IGkxOG4uZm9sZF91bmF2YWlsYWJsZSA6IGkxOG4ub3V0c2lkZV91bmF2YWlsYWJsZSApICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHNldF9nZXN0dXJlX3RhcmdldF9zdXJmYWNlKCBnZXN0dXJlLCB0YXJnZXRfY29udGV4dC5zdXJmYWNlLCB0YXJnZXRfaXNfY3Jvc3NfcmVzb3VyY2UgKTtcblx0XHRcdHJlbmRlcl9nZXN0dXJlX2dob3N0KCBnZXN0dXJlICk7XG5cdFx0XHRwcm9wb3NlZF90aW1lID0gJ2FsbF9kYXknID09PSB0YXJnZXRfY29udGV4dC5zZWxlY3Rpb25fa2luZFxuXHRcdFx0XHQ/ICcnXG5cdFx0XHRcdDogU3RyaW5nKCBNYXRoLmZsb29yKCBnZXN0dXJlLmN1cnJlbnQud2FsbF9taW51dGUgLyA2MCApICkucGFkU3RhcnQoIDIsICcwJyApICsgJzonICsgU3RyaW5nKCBnZXN0dXJlLmN1cnJlbnQud2FsbF9taW51dGUgJSA2MCApLnBhZFN0YXJ0KCAyLCAnMCcgKTtcblx0XHRcdGlmICggJ3Jlc2l6ZScgPT09IGdlc3R1cmUuZ2VzdHVyZV90eXBlICkge1xuXHRcdFx0XHRhbm5vdW5jZV9nZXN0dXJlKCBnZXN0dXJlLCBTdHJpbmcoICggJ2FsbF9kYXknID09PSB0YXJnZXRfY29udGV4dC5zZWxlY3Rpb25fa2luZFxuXHRcdFx0XHRcdD8gaTE4bi5yZXNpemVfcHJvcG9zYWxfY2hhbmdlZF9hbGxfZGF5XG5cdFx0XHRcdFx0OiBpMThuLnJlc2l6ZV9wcm9wb3NhbF9jaGFuZ2VkICkgfHwgJycgKVxuXHRcdFx0XHRcdC5yZXBsYWNlKCAvJTE/XFwkP3MvLCBnZXN0dXJlLmN1cnJlbnQuZGF0ZSApXG5cdFx0XHRcdFx0LnJlcGxhY2UoICclMiRzJywgcHJvcG9zZWRfdGltZSApXG5cdFx0XHRcdFx0KyAoIDEgPCBnZXN0dXJlLmVsaWdpYmlsaXR5LnJlc2l6ZS5hZmZlY3RlZF9pbnRlcnZhbHMubGVuZ3RoID8gJyAnICsgU3RyaW5nKCBpMThuLnJlc2l6ZV9ncm91cF9leHBsYW5hdGlvbiB8fCAnJyApIDogJycgKSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRhcmdldF9pc19jcm9zc19yZXNvdXJjZSApIHtcblx0XHRcdFx0YW5ub3VuY2VfZ2VzdHVyZSggZ2VzdHVyZSwgU3RyaW5nKCAoICdhbGxfZGF5JyA9PT0gdGFyZ2V0X2NvbnRleHQuc2VsZWN0aW9uX2tpbmRcblx0XHRcdFx0XHQ/IGkxOG4uY3Jvc3NfcmVzb3VyY2VfY2hhbmdlZF9hbGxfZGF5XG5cdFx0XHRcdFx0OiBpMThuLmNyb3NzX3Jlc291cmNlX2NoYW5nZWQgKSB8fCAnJyApXG5cdFx0XHRcdFx0LnJlcGxhY2UoICclMSRzJywgU3RyaW5nKCB0YXJnZXRfcmVzb3VyY2VfaWQgKSApXG5cdFx0XHRcdFx0LnJlcGxhY2UoICclMiRzJywgZ2VzdHVyZS5jdXJyZW50LmRhdGUgKVxuXHRcdFx0XHRcdC5yZXBsYWNlKCAnJTMkcycsIHByb3Bvc2VkX3RpbWUgKSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRhbm5vdW5jZV9nZXN0dXJlKCBnZXN0dXJlLCBTdHJpbmcoICggJ2FsbF9kYXknID09PSB0YXJnZXRfY29udGV4dC5zZWxlY3Rpb25fa2luZFxuXHRcdFx0XHQ/IGkxOG4ucHJvcG9zYWxfY2hhbmdlZF9hbGxfZGF5XG5cdFx0XHRcdDogaTE4bi5wcm9wb3NhbF9jaGFuZ2VkICkgfHwgJycgKVxuXHRcdFx0XHQucmVwbGFjZSggLyUxP1xcJD9zLywgZ2VzdHVyZS5jdXJyZW50LmRhdGUgKVxuXHRcdFx0XHQucmVwbGFjZSggJyUyJHMnLCBwcm9wb3NlZF90aW1lIClcblx0XHRcdFx0KyAoIDEgPCBnZXN0dXJlLmVsaWdpYmlsaXR5Lm1vdmVtZW50LnNlbGVjdGVkX2RhdGVzLmxlbmd0aCA/ICcgJyArIFN0cmluZyggaTE4bi5ncm91cF9zaGlmdCB8fCAnJyApIDogJycgKSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNjaGVkdWxlIGF0IG1vc3Qgb25lIHZpc3VhbCB1cGRhdGUgcGVyIGFuaW1hdGlvbiBmcmFtZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2NoZWR1bGVfZ2VzdHVyZV9mcmFtZSgpIHtcblx0XHRcdGlmICggZ2VzdHVyZV9mcmFtZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSApIHtcblx0XHRcdFx0Zmx1c2hfZ2VzdHVyZV9mcmFtZSgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRnZXN0dXJlX2ZyYW1lID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZmx1c2hfZ2VzdHVyZV9mcmFtZSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbGVhc2Ugb25lIHRyYW5zaWVudCBnZXN0dXJlIGFuZCBvcHRpb25hbGx5IHJlc3RvcmUgaXRzIGdyaXAgZm9jdXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IHJlc3RvcmVfZm9jdXMgV2hldGhlciB0byByZXN0b3JlIGZvY3VzIHRvIHRoZSBtb3ZlbWVudCBncmlwLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgbWVzc2FnZSAgICAgICBPcHRpb25hbCBsb2NhbGl6ZWQgc3RhdHVzIGFubm91bmNlbWVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNhbmNlbF9nZXN0dXJlKCByZXN0b3JlX2ZvY3VzLCBtZXNzYWdlICkge1xuXHRcdFx0dmFyIGdlc3R1cmUgPSBhY3RpdmVfZ2VzdHVyZTtcblxuXHRcdFx0aWYgKCBnZXN0dXJlX2ZyYW1lICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUgKSB7XG5cdFx0XHRcdHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSggZ2VzdHVyZV9mcmFtZSApO1xuXHRcdFx0fVxuXHRcdFx0Z2VzdHVyZV9mcmFtZSA9IDA7XG5cdFx0XHRhY3RpdmVfZ2VzdHVyZSA9IG51bGw7XG5cdFx0XHRpZiAoICEgZ2VzdHVyZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBnZXN0dXJlLnBvaW50ZXJfaWQgJiYgZ2VzdHVyZS5ncmlwICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBnZXN0dXJlLmdyaXAucmVsZWFzZVBvaW50ZXJDYXB0dXJlICkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGdlc3R1cmUuZ3JpcC5yZWxlYXNlUG9pbnRlckNhcHR1cmUoIGdlc3R1cmUucG9pbnRlcl9pZCApO1xuXHRcdFx0XHR9IGNhdGNoICggZXJyb3IgKSB7XG5cdFx0XHRcdFx0Ly8gUG9pbnRlciBjYXB0dXJlIG1heSBhbHJlYWR5IGJlIHJlbGVhc2VkIGJ5IHRoZSBicm93c2VyLlxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGdlc3R1cmUuZ2hvc3QgKSB7XG5cdFx0XHRcdGdlc3R1cmUuZ2hvc3QucmVtb3ZlKCk7XG5cdFx0XHR9XG5cdFx0XHRzZXRfZ2VzdHVyZV90YXJnZXRfc3VyZmFjZSggZ2VzdHVyZSwgbnVsbCwgZmFsc2UgKTtcblx0XHRcdCggZ2VzdHVyZS5naG9zdHMgfHwgW10gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGdob3N0ICkge1xuXHRcdFx0XHRpZiAoIGdob3N0ICkge1xuXHRcdFx0XHRcdGdob3N0LnJlbW92ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRnZXN0dXJlLnJlZ2lzdHJhdGlvbi5jYXJkLmNsYXNzTGlzdC5yZW1vdmUoICdpcy10aW1lLXJvd3MtbW92aW5nJyApO1xuXHRcdFx0Z2VzdHVyZS5yZWdpc3RyYXRpb24uY2FyZC5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtdGltZS1yb3dzLXJlc2l6aW5nJyApO1xuXHRcdFx0aWYgKCBjYWxsYmFja3Muc2V0X2ludGVyYWN0aW9uX3N1c3BlbmRlZCApIHtcblx0XHRcdFx0Y2FsbGJhY2tzLnNldF9pbnRlcmFjdGlvbl9zdXNwZW5kZWQoIGZhbHNlLCBnZXN0dXJlLnJlZ2lzdHJhdGlvbi5jYXJkICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNhbGxiYWNrcy5zZXRfYXhpc193aW5kb3dfbG9hZGluZ19sb2NrZWQgKSB7XG5cdFx0XHRcdGNhbGxiYWNrcy5zZXRfYXhpc193aW5kb3dfbG9hZGluZ19sb2NrZWQoIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0XHRhbm5vdW5jZV9nZXN0dXJlKCBnZXN0dXJlLCBtZXNzYWdlIHx8ICcnICk7XG5cdFx0XHRpZiAoIHJlc3RvcmVfZm9jdXMgJiYgZ2VzdHVyZS5ncmlwICYmIGdlc3R1cmUuZ3JpcC5pc0Nvbm5lY3RlZCApIHtcblx0XHRcdFx0Z2VzdHVyZS5ncmlwLmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRmluZCB0aGUgY3VycmVudCBwcm9qZWN0ZWQgY2FyZCBhbmQgcmVzdG9yZSBhY2Nlc3NpYmxlIGZvY3VzIGFmdGVyIFJldmlldy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBib29raW5nX2lkIENhbm9uaWNhbCBib29raW5nIElELlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBvcGVyYXRpb24gIE9wdGlvbmFsIHJlc2l6ZSBvcGVyYXRpb24gdG8gcmVzdG9yZS5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gYSBjdXJyZW50IHByb2plY3RlZCBjb250cm9sIHJlY2VpdmVkIGZvY3VzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlc3RvcmVfcHJvamVjdGVkX2ZvY3VzKCBib29raW5nX2lkLCBvcGVyYXRpb24gKSB7XG5cdFx0XHR2YXIgcmVnaXN0cmF0aW9uID0gT2JqZWN0LmtleXMoIHJlZ2lzdHJhdGlvbnNfYnlfcmVuZGVyX2lkICkubWFwKCBmdW5jdGlvbiAoIHJlbmRlcl9pZCApIHtcblx0XHRcdFx0cmV0dXJuIHJlZ2lzdHJhdGlvbnNfYnlfcmVuZGVyX2lkWyByZW5kZXJfaWQgXTtcblx0XHRcdH0gKS5maW5kKCBmdW5jdGlvbiAoIGNhbmRpZGF0ZSApIHtcblx0XHRcdFx0cmV0dXJuIGNhbmRpZGF0ZS5ib29raW5nX2lkID09PSBOdW1iZXIoIGJvb2tpbmdfaWQgKSAmJiBpc19yZWdpc3RyYXRpb25fY3VycmVudCggY2FuZGlkYXRlICkgJiYgISBjYW5kaWRhdGUuaXNfb3ZlcmZsb3dlZDtcblx0XHRcdH0gKTtcblx0XHRcdHZhciBvcGVyYXRpb25fc2VsZWN0b3IgPSAtMSAhPT0gWyAncmVzaXplX3N0YXJ0JywgJ3Jlc2l6ZV9lbmQnIF0uaW5kZXhPZiggU3RyaW5nKCBvcGVyYXRpb24gfHwgJycgKSApXG5cdFx0XHRcdD8gJ1tkYXRhLXdwYmMtdGltZWxpbmUtdGltZS1yb3dzLXJlc2l6ZS1vcGVyYXRpb249XCInICsgU3RyaW5nKCBvcGVyYXRpb24gKSArICdcIl0nXG5cdFx0XHRcdDogJyc7XG5cdFx0XHR2YXIgZm9jdXNfdGFyZ2V0ID0gcmVnaXN0cmF0aW9uICYmIHJlZ2lzdHJhdGlvbi5jYXJkXG5cdFx0XHRcdD8gcmVnaXN0cmF0aW9uLmNhcmQucXVlcnlTZWxlY3Rvciggb3BlcmF0aW9uX3NlbGVjdG9yIHx8ICggbW92ZW1lbnRfZ3JpcF9zZWxlY3RvciArICcsIFtkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1zZWxlY3RdJyApIClcblx0XHRcdFx0OiBudWxsO1xuXG5cdFx0XHRpZiAoICEgZm9jdXNfdGFyZ2V0ICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRmb2N1c190YXJnZXQuZm9jdXMoKTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRmluaXNoIGEgdmFsaWQgZ2VzdHVyZSBieSBoYW5kaW5nIGl0cyBwcm9wb3NhbCB0byBjYW5vbmljYWwgUmV2aWV3LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjb21wbGV0ZV9nZXN0dXJlKCkge1xuXHRcdFx0dmFyIGdlc3R1cmUgPSBhY3RpdmVfZ2VzdHVyZTtcblx0XHRcdHZhciBwcm9wb3NhbDtcblx0XHRcdHZhciByZXZpZXdfc3RhdGU7XG5cdFx0XHR2YXIgcmVzaXplX3Byb2plY3Rpb247XG5cblx0XHRcdGlmICggISBnZXN0dXJlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGdlc3R1cmUucGVuZGluZ19jb29yZGluYXRlICkge1xuXHRcdFx0XHRmbHVzaF9nZXN0dXJlX2ZyYW1lKCk7XG5cdFx0XHR9XG5cdFx0XHRyZXNpemVfcHJvamVjdGlvbiA9ICdyZXNpemUnID09PSBnZXN0dXJlLmdlc3R1cmVfdHlwZSAmJiBnZXN0dXJlLmN1cnJlbnQgJiYgJ2V4YWN0JyA9PT0gZ2VzdHVyZS5jdXJyZW50LnN0YXR1c1xuXHRcdFx0XHQ/IGJ1aWxkX3Jlc2l6ZV9wcm9qZWN0aW9uKCBnZXN0dXJlIClcblx0XHRcdFx0OiBudWxsO1xuXHRcdFx0cHJvcG9zYWwgPSAncmVzaXplJyA9PT0gZ2VzdHVyZS5nZXN0dXJlX3R5cGVcblx0XHRcdFx0PyAoIHJlc2l6ZV9wcm9qZWN0aW9uID8gcmVzaXplX3Byb2plY3Rpb24ucHJvcG9zYWwgOiBudWxsIClcblx0XHRcdFx0OiAoIGdlc3R1cmUuY3VycmVudCAmJiAnZXhhY3QnID09PSBnZXN0dXJlLmN1cnJlbnQuc3RhdHVzID8gYnVpbGRfbW92ZW1lbnRfcHJvcG9zYWwoIGdlc3R1cmUgKSA6IG51bGwgKTtcblx0XHRcdHJldmlld19zdGF0ZSA9IHtcblx0XHRcdFx0Y2FyZDogZ2VzdHVyZS5yZWdpc3RyYXRpb24uY2FyZCxcblx0XHRcdFx0Zm9jdXM6IGdlc3R1cmUuZ3JpcCxcblx0XHRcdFx0c2VnbWVudF9pZDogZ2VzdHVyZS5yZWdpc3RyYXRpb24uc2VnbWVudF9pZCxcblx0XHRcdFx0dmlzaWJsZV9zdGFydDogZ2VzdHVyZS5yZWdpc3RyYXRpb24udmlzaWJsZV9zdGFydCxcblx0XHRcdFx0dmlzaWJsZV9lbmQ6IGdlc3R1cmUucmVnaXN0cmF0aW9uLnZpc2libGVfZW5kLFxuXHRcdFx0XHRyZXNpemVfY29udGV4dDogJ3Jlc2l6ZScgPT09IGdlc3R1cmUuZ2VzdHVyZV90eXBlID8gZ2VzdHVyZS5lbGlnaWJpbGl0eS5yZXNpemUgOiBudWxsLFxuXHRcdFx0XHRjYW52YXNfc2Nyb2xsOiBnZXN0dXJlLmNhbnZhcyA/IGdlc3R1cmUuY2FudmFzLnNjcm9sbExlZnQgOiAwLFxuXHRcdFx0XHRkb2NfeDogd2luZG93LnNjcm9sbFgsXG5cdFx0XHRcdGRvY195OiB3aW5kb3cuc2Nyb2xsWSxcblx0XHRcdFx0cmVzdG9yZV9mb2N1czogcmVzdG9yZV9wcm9qZWN0ZWRfZm9jdXMsXG5cdFx0XHRcdG9uX3NvdXJjZV9zdGFsZTogcmVsb2FkX3NlbGVjdGVkX2VsaWdpYmlsaXR5XG5cdFx0XHR9O1xuXHRcdFx0Y2FuY2VsX2dlc3R1cmUoIGZhbHNlLCAnJyApO1xuXHRcdFx0aWYgKCAhIHByb3Bvc2FsICkge1xuXHRcdFx0XHRpZiAoIGdlc3R1cmUuZ3JpcCAmJiBnZXN0dXJlLmdyaXAuaXNDb25uZWN0ZWQgKSB7XG5cdFx0XHRcdFx0Z2VzdHVyZS5ncmlwLmZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YW5ub3VuY2VfZ2VzdHVyZSggZ2VzdHVyZSwgJ3Jlc2l6ZScgPT09IGdlc3R1cmUuZ2VzdHVyZV90eXBlID8gaTE4bi5yZXNpemVfbm9fY2hhbmdlIDogaTE4bi5ub19jaGFuZ2UgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAncmVzaXplJyA9PT0gZ2VzdHVyZS5nZXN0dXJlX3R5cGUgKSB7XG5cdFx0XHRcdGlmICggISBjYWxsYmFja3MucmV2aWV3X2Jvb2tpbmdfcmVzaXplX3Byb3Bvc2FsIHx8ICEgY2FsbGJhY2tzLnJldmlld19ib29raW5nX3Jlc2l6ZV9wcm9wb3NhbCggcHJvcG9zYWwsIHJldmlld19zdGF0ZSApICkge1xuXHRcdFx0XHRcdGFubm91bmNlX2dlc3R1cmUoIGdlc3R1cmUsIGkxOG4ucmVzaXplX3Jldmlld191bmF2YWlsYWJsZSApO1xuXHRcdFx0XHRcdGlmICggZ2VzdHVyZS5ncmlwICYmIGdlc3R1cmUuZ3JpcC5pc0Nvbm5lY3RlZCApIHtcblx0XHRcdFx0XHRcdGdlc3R1cmUuZ3JpcC5mb2N1cygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgY2FsbGJhY2tzLnJldmlld19ib29raW5nX21vdmVtZW50X3Byb3Bvc2FsIHx8ICEgY2FsbGJhY2tzLnJldmlld19ib29raW5nX21vdmVtZW50X3Byb3Bvc2FsKCBwcm9wb3NhbCwgcmV2aWV3X3N0YXRlICkgKSB7XG5cdFx0XHRcdGFubm91bmNlX2dlc3R1cmUoIGdlc3R1cmUsIGkxOG4ucmV2aWV3X3VuYXZhaWxhYmxlICk7XG5cdFx0XHRcdGlmICggZ2VzdHVyZS5ncmlwICYmIGdlc3R1cmUuZ3JpcC5pc0Nvbm5lY3RlZCApIHtcblx0XHRcdFx0XHRnZXN0dXJlLmdyaXAuZm9jdXMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEJlZ2luIGEgcG9pbnRlciBvciBrZXlib2FyZCBwcm9wb3NhbCBmcm9tIGZyZXNoIGFjY2VwdGVkIGVsaWdpYmlsaXR5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgcmVnaXN0cmF0aW9uIENhbm9uaWNhbCBwcm9qZWN0ZWQgcmVnaXN0cmF0aW9uLlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGdyaXAgICAgICAgICBBdXRob3JpemVkIG1vdmVtZW50IGdyaXAuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9ICAgICAgaW5wdXRfbW9kZSAgIHBvaW50ZXIgb3Iga2V5Ym9hcmQuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgY29vcmRpbmF0ZSAgIEluaXRpYWwgZ2VvbWV0cnkgY29vcmRpbmF0ZS5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gICAgICBwb2ludGVyX2lkICAgUG9pbnRlciBpZGVudGlmaWVyLCBvciB6ZXJvLlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgZ2VzdHVyZSBzdGFydGVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGJlZ2luX2dlc3R1cmUoIHJlZ2lzdHJhdGlvbiwgZ3JpcCwgaW5wdXRfbW9kZSwgY29vcmRpbmF0ZSwgcG9pbnRlcl9pZCApIHtcblx0XHRcdHZhciBlbGlnaWJpbGl0eSA9IGVsaWdpYmlsaXR5X2NhY2hlWyByZWdpc3RyYXRpb24uY2Fub25pY2FsX2tleSBdO1xuXHRcdFx0dmFyIGdlc3R1cmVfY29udGV4dDtcblx0XHRcdHZhciB0YXJnZXRfY29udGV4dHM7XG5cdFx0XHR2YXIgb3JpZ2luO1xuXG5cdFx0XHRpZiAoXG5cdFx0XHRcdGFjdGl2ZV9nZXN0dXJlXG5cdFx0XHRcdHx8ICEgZWxpZ2liaWxpdHlcblx0XHRcdFx0fHwgZWxpZ2liaWxpdHkuZXJyb3Jcblx0XHRcdFx0fHwgKCAhIGVsaWdpYmlsaXR5Lm1vdmVtZW50LnNhbWVfcmVzb3VyY2UgJiYgKCAhIGNyb3NzX3Jlc291cmNlX21vdmVtZW50X2VuYWJsZWQgfHwgISBlbGlnaWJpbGl0eS5tb3ZlbWVudC5jcm9zc19yZXNvdXJjZSApIClcblx0XHRcdFx0fHwgKCAnaG9yaXpvbnRhbCcgPT09IHJlZ2lzdHJhdGlvbi5pbnRlcmFjdGlvbl9heGlzICYmICEgZnVsbF9kYXlfbW92ZW1lbnRfZW5hYmxlZCApXG5cdFx0XHRcdHx8ICEgaXNfcmVnaXN0cmF0aW9uX2N1cnJlbnQoIHJlZ2lzdHJhdGlvbiApXG5cdFx0XHRcdHx8ICggY2FsbGJhY2tzLmNhbl9zdGFydF9pbnRlcmFjdGlvbiAmJiAhIGNhbGxiYWNrcy5jYW5fc3RhcnRfaW50ZXJhY3Rpb24oKSApXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0Z2VzdHVyZV9jb250ZXh0ID0gcHJlcGFyZV9nZXN0dXJlX2NvbnRleHQoIHJlZ2lzdHJhdGlvbiApO1xuXHRcdFx0b3JpZ2luID0gZ2VzdHVyZV9jb250ZXh0ID8gZ2VvbWV0cnkucmVzb2x2ZV9jb29yZGluYXRlKCBnZXN0dXJlX2NvbnRleHQuc25hcHNob3QsIGNvb3JkaW5hdGUgKSA6IG51bGw7XG5cdFx0XHRpZiAoICEgb3JpZ2luIHx8ICdleGFjdCcgIT09IG9yaWdpbi5zdGF0dXMgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHRhcmdldF9jb250ZXh0cyA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblx0XHRcdHRhcmdldF9jb250ZXh0c1sgcmVnaXN0cmF0aW9uLnJlc291cmNlX2lkIF0gPSBnZXN0dXJlX2NvbnRleHQ7XG5cdFx0XHRhY3RpdmVfZ2VzdHVyZSA9IHtcblx0XHRcdFx0Z2VzdHVyZV90eXBlOiAnbW92ZW1lbnQnLFxuXHRcdFx0XHRvcGVyYXRpb246ICcnLFxuXHRcdFx0XHRyZWdpc3RyYXRpb246IHJlZ2lzdHJhdGlvbixcblx0XHRcdFx0ZWxpZ2liaWxpdHk6IGVsaWdpYmlsaXR5LFxuXHRcdFx0XHRjb250ZXh0OiBnZXN0dXJlX2NvbnRleHQsXG5cdFx0XHRcdGN1cnJlbnRfY29udGV4dDogZ2VzdHVyZV9jb250ZXh0LFxuXHRcdFx0XHR0YXJnZXRfY29udGV4dHM6IHRhcmdldF9jb250ZXh0cyxcblx0XHRcdFx0dGFyZ2V0X3Jlc291cmNlX2lkOiByZWdpc3RyYXRpb24ucmVzb3VyY2VfaWQsXG5cdFx0XHRcdHRhcmdldF9zdXJmYWNlOiBnZXN0dXJlX2NvbnRleHQuc3VyZmFjZSxcblx0XHRcdFx0b3JpZ2luOiBvcmlnaW4sXG5cdFx0XHRcdGN1cnJlbnQ6IG9yaWdpbixcblx0XHRcdFx0cGVuZGluZ19jb29yZGluYXRlOiBudWxsLFxuXHRcdFx0XHRpbnB1dF9tb2RlOiBpbnB1dF9tb2RlLFxuXHRcdFx0XHRwb2ludGVyX2lkOiBwb2ludGVyX2lkLFxuXHRcdFx0XHRncmlwOiBncmlwLFxuXHRcdFx0XHRnaG9zdDogbnVsbCxcblx0XHRcdFx0Y2FyZF9yZWN0OiByZWdpc3RyYXRpb24uY2FyZC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSxcblx0XHRcdFx0Y2FudmFzOiBtb3VudC5xdWVyeVNlbGVjdG9yID8gbW91bnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtY2FudmFzXScgKSA6IG51bGxcblx0XHRcdH07XG5cdFx0XHRyZWdpc3RyYXRpb24uY2FyZC5jbGFzc0xpc3QuYWRkKCAnaXMtdGltZS1yb3dzLW1vdmluZycgKTtcblx0XHRcdGlmICggY2FsbGJhY2tzLnNldF9pbnRlcmFjdGlvbl9zdXNwZW5kZWQgKSB7XG5cdFx0XHRcdGNhbGxiYWNrcy5zZXRfaW50ZXJhY3Rpb25fc3VzcGVuZGVkKCB0cnVlLCByZWdpc3RyYXRpb24uY2FyZCApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjYWxsYmFja3Muc2V0X2F4aXNfd2luZG93X2xvYWRpbmdfbG9ja2VkICkge1xuXHRcdFx0XHRjYWxsYmFja3Muc2V0X2F4aXNfd2luZG93X2xvYWRpbmdfbG9ja2VkKCB0cnVlICk7XG5cdFx0XHR9XG5cdFx0XHRhbm5vdW5jZV9nZXN0dXJlKFxuXHRcdFx0XHRhY3RpdmVfZ2VzdHVyZSxcblx0XHRcdFx0J2tleWJvYXJkJyA9PT0gaW5wdXRfbW9kZVxuXHRcdFx0XHRcdD8gaTE4bi5rZXlib2FyZF9zdGFydGVkXG5cdFx0XHRcdFx0OiAoICEgZWxpZ2liaWxpdHkubW92ZW1lbnQuc2FtZV9yZXNvdXJjZSAmJiBlbGlnaWJpbGl0eS5tb3ZlbWVudC5jcm9zc19yZXNvdXJjZSA/IGkxOG4uY3Jvc3NfcmVzb3VyY2Vfc3RhcnRlZCA6IGkxOG4uZ2VzdHVyZV9zdGFydGVkIClcblx0XHRcdCk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEJlZ2luIGEgcG9pbnRlciByZXNpemUgZnJvbSBvbmUgZnJlc2ggc2VydmVyLWF1dGhvcml6ZWQgdmVydGljYWwgYm91bmRhcnkuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gICAgICByZWdpc3RyYXRpb24gQ2Fub25pY2FsIHByb2plY3RlZCByZWdpc3RyYXRpb24uXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gaGFuZGxlICAgICAgIEF1dGhvcml6ZWQgYm91bmRhcnkgY29udHJvbC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICBvcGVyYXRpb24gICAgcmVzaXplX3N0YXJ0IG9yIHJlc2l6ZV9lbmQuXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9ICAgICAgcG9pbnRlcl9pZCAgIFBvaW50ZXIgaWRlbnRpZmllci5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gICAgICBwb2ludGVyX3kgICAgSW5pdGlhbCBwaHlzaWNhbCBibG9jay1heGlzIGNvb3JkaW5hdGUuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSByZXNpemUgZ2VzdHVyZSBzdGFydGVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGJlZ2luX3Jlc2l6ZV9nZXN0dXJlKCByZWdpc3RyYXRpb24sIGhhbmRsZSwgb3BlcmF0aW9uLCBwb2ludGVyX2lkLCBwb2ludGVyX3kgKSB7XG5cdFx0XHR2YXIgZWxpZ2liaWxpdHkgPSBlbGlnaWJpbGl0eV9jYWNoZVsgcmVnaXN0cmF0aW9uLmNhbm9uaWNhbF9rZXkgXTtcblx0XHRcdHZhciBnZXN0dXJlX2NvbnRleHQ7XG5cdFx0XHR2YXIgYm91bmRhcnlfaW5zdGFudDtcblx0XHRcdHZhciBvcmlnaW47XG5cblx0XHRcdGlmIChcblx0XHRcdFx0YWN0aXZlX2dlc3R1cmVcblx0XHRcdFx0fHwgKCAnaG9yaXpvbnRhbCcgPT09IHJlZ2lzdHJhdGlvbi5pbnRlcmFjdGlvbl9heGlzICYmICEgZnVsbF9kYXlfcmVzaXplX2VuYWJsZWQgKVxuXHRcdFx0XHR8fCAhIGVsaWdpYmlsaXR5XG5cdFx0XHRcdHx8IGVsaWdpYmlsaXR5LmVycm9yXG5cdFx0XHRcdHx8ICEgZWxpZ2liaWxpdHkucmVzaXplLmFsbG93ZWRcblx0XHRcdFx0fHwgKCAncmVzaXplX3N0YXJ0JyA9PT0gb3BlcmF0aW9uICYmICEgZWxpZ2liaWxpdHkucmVzaXplLnN0YXJ0IClcblx0XHRcdFx0fHwgKCAncmVzaXplX2VuZCcgPT09IG9wZXJhdGlvbiAmJiAhIGVsaWdpYmlsaXR5LnJlc2l6ZS5lbmQgKVxuXHRcdFx0XHR8fCAtMSA9PT0gWyAncmVzaXplX3N0YXJ0JywgJ3Jlc2l6ZV9lbmQnIF0uaW5kZXhPZiggb3BlcmF0aW9uIClcblx0XHRcdFx0fHwgISBOdW1iZXIuaXNGaW5pdGUoIHBvaW50ZXJfeSApXG5cdFx0XHRcdHx8ICEgaXNfcmVnaXN0cmF0aW9uX2N1cnJlbnQoIHJlZ2lzdHJhdGlvbiApXG5cdFx0XHRcdHx8ICggY2FsbGJhY2tzLmNhbl9zdGFydF9pbnRlcmFjdGlvbiAmJiAhIGNhbGxiYWNrcy5jYW5fc3RhcnRfaW50ZXJhY3Rpb24oKSApXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0Z2VzdHVyZV9jb250ZXh0ID0gcHJlcGFyZV9nZXN0dXJlX2NvbnRleHQoIHJlZ2lzdHJhdGlvbiApO1xuXHRcdFx0Ym91bmRhcnlfaW5zdGFudCA9ICdyZXNpemVfc3RhcnQnID09PSBvcGVyYXRpb25cblx0XHRcdFx0PyBlbGlnaWJpbGl0eS5yZXNpemUuaW1tdXRhYmxlX2ludGVydmFsLnN0YXJ0XG5cdFx0XHRcdDogZWxpZ2liaWxpdHkucmVzaXplLmltbXV0YWJsZV9pbnRlcnZhbC5lbmQ7XG5cdFx0XHRvcmlnaW4gPSBnZXN0dXJlX2NvbnRleHRcblx0XHRcdFx0PyAoICdhbGxfZGF5JyA9PT0gZ2VzdHVyZV9jb250ZXh0LnNlbGVjdGlvbl9raW5kXG5cdFx0XHRcdFx0PyByZXNvbHZlX2Z1bGxfZGF5X2luc3RhbnRfYm91bmRhcnkoIGdlc3R1cmVfY29udGV4dC5zbmFwc2hvdCwgYm91bmRhcnlfaW5zdGFudCwgb3BlcmF0aW9uIClcblx0XHRcdFx0XHQ6IHJlc29sdmVfaW5zdGFudF9ib3VuZGFyeSggZ2VzdHVyZV9jb250ZXh0LnNuYXBzaG90LCBib3VuZGFyeV9pbnN0YW50ICkgKVxuXHRcdFx0XHQ6IG51bGw7XG5cdFx0XHRpZiAoICEgb3JpZ2luICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRhY3RpdmVfZ2VzdHVyZSA9IHtcblx0XHRcdFx0Z2VzdHVyZV90eXBlOiAncmVzaXplJyxcblx0XHRcdFx0b3BlcmF0aW9uOiBvcGVyYXRpb24sXG5cdFx0XHRcdHJlZ2lzdHJhdGlvbjogcmVnaXN0cmF0aW9uLFxuXHRcdFx0XHRlbGlnaWJpbGl0eTogZWxpZ2liaWxpdHksXG5cdFx0XHRcdGNvbnRleHQ6IGdlc3R1cmVfY29udGV4dCxcblx0XHRcdFx0Y3VycmVudF9jb250ZXh0OiBnZXN0dXJlX2NvbnRleHQsXG5cdFx0XHRcdHRhcmdldF9yZXNvdXJjZV9pZDogcmVnaXN0cmF0aW9uLnJlc291cmNlX2lkLFxuXHRcdFx0XHR0YXJnZXRfc3VyZmFjZTogZ2VzdHVyZV9jb250ZXh0LnN1cmZhY2UsXG5cdFx0XHRcdG9yaWdpbjogb3JpZ2luLFxuXHRcdFx0XHRjdXJyZW50OiBvcmlnaW4sXG5cdFx0XHRcdHBlbmRpbmdfY29vcmRpbmF0ZTogbnVsbCxcblx0XHRcdFx0aW5wdXRfbW9kZTogJ3BvaW50ZXInLFxuXHRcdFx0XHRwb2ludGVyX2lkOiBwb2ludGVyX2lkLFxuXHRcdFx0XHRwb2ludGVyX3N0YXJ0X2NsaWVudF95OiBwb2ludGVyX3ksXG5cdFx0XHRcdGdyaXA6IGhhbmRsZSxcblx0XHRcdFx0Z2hvc3Q6IG51bGwsXG5cdFx0XHRcdGdob3N0czogW10sXG5cdFx0XHRcdHJlc2l6ZV9wcm9qZWN0aW9uOiBudWxsLFxuXHRcdFx0XHRjYXJkX3JlY3Q6IHJlZ2lzdHJhdGlvbi5jYXJkLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLFxuXHRcdFx0XHRjYW52YXM6IG1vdW50LnF1ZXJ5U2VsZWN0b3IgPyBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1jYW52YXNdJyApIDogbnVsbFxuXHRcdFx0fTtcblx0XHRcdHJlZ2lzdHJhdGlvbi5jYXJkLmNsYXNzTGlzdC5hZGQoICdpcy10aW1lLXJvd3MtcmVzaXppbmcnICk7XG5cdFx0XHRpZiAoIGNhbGxiYWNrcy5zZXRfaW50ZXJhY3Rpb25fc3VzcGVuZGVkICkge1xuXHRcdFx0XHRjYWxsYmFja3Muc2V0X2ludGVyYWN0aW9uX3N1c3BlbmRlZCggdHJ1ZSwgcmVnaXN0cmF0aW9uLmNhcmQgKTtcblx0XHRcdH1cblx0XHRcdGlmICggY2FsbGJhY2tzLnNldF9heGlzX3dpbmRvd19sb2FkaW5nX2xvY2tlZCApIHtcblx0XHRcdFx0Y2FsbGJhY2tzLnNldF9heGlzX3dpbmRvd19sb2FkaW5nX2xvY2tlZCggdHJ1ZSApO1xuXHRcdFx0fVxuXHRcdFx0YW5ub3VuY2VfZ2VzdHVyZSggYWN0aXZlX2dlc3R1cmUsIGkxOG4ucmVzaXplX2dlc3R1cmVfc3RhcnRlZCApO1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXNvbHZlIGFuIGF1dGhvcml6ZWQgZ3JpcCBiYWNrIHRvIGl0cyByZXRhaW5lZCBjYW5vbmljYWwgcmVnaXN0cmF0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFbGVtZW50fSBncmlwIE1vdmVtZW50IGdyaXAgaW5zaWRlIGEgcmVnaXN0ZXJlZCBwcm9qZWN0ZWQgY2FyZC5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gQ3VycmVudCByZWdpc3RyYXRpb24gb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBmaW5kX3JlZ2lzdHJhdGlvbl9mb3JfZ3JpcCggZ3JpcCApIHtcblx0XHRcdHJldHVybiBPYmplY3Qua2V5cyggcmVnaXN0cmF0aW9uc19ieV9yZW5kZXJfaWQgKS5tYXAoIGZ1bmN0aW9uICggcmVuZGVyX2lkICkge1xuXHRcdFx0XHRyZXR1cm4gcmVnaXN0cmF0aW9uc19ieV9yZW5kZXJfaWRbIHJlbmRlcl9pZCBdO1xuXHRcdFx0fSApLmZpbmQoIGZ1bmN0aW9uICggcmVnaXN0cmF0aW9uICkge1xuXHRcdFx0XHRyZXR1cm4gcmVnaXN0cmF0aW9uLmNhcmQgJiYgcmVnaXN0cmF0aW9uLmNhcmQuY29udGFpbnMgJiYgcmVnaXN0cmF0aW9uLmNhcmQuY29udGFpbnMoIGdyaXAgKSAmJiBpc19yZWdpc3RyYXRpb25fY3VycmVudCggcmVnaXN0cmF0aW9uICk7XG5cdFx0XHR9ICkgfHwgbnVsbDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBCdWlsZCB0aGUgaW5pdGlhbCBrZXlib2FyZCBjZWxsIGZyb20gY2Fub25pY2FsIHNhdmVkIHNjaGVkdWxlIGNvbnRleHQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmVnaXN0cmF0aW9uIEN1cnJlbnQgY2Fub25pY2FsIHJlZ2lzdHJhdGlvbi5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZWxpZ2liaWxpdHkgIEZyZXNoIGFjY2VwdGVkIGVsaWdpYmlsaXR5LlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBLZXlib2FyZCBjb29yZGluYXRlIG9yIG51bGwgb3V0c2lkZSBjb3ZlcmFnZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfa2V5Ym9hcmRfb3JpZ2luX2Nvb3JkaW5hdGUoIHJlZ2lzdHJhdGlvbiwgZWxpZ2liaWxpdHkgKSB7XG5cdFx0XHR2YXIgZ2VzdHVyZV9jb250ZXh0ID0gcHJlcGFyZV9nZXN0dXJlX2NvbnRleHQoIHJlZ2lzdHJhdGlvbiApO1xuXHRcdFx0dmFyIG1vdmVtZW50ID0gZWxpZ2liaWxpdHkgJiYgZWxpZ2liaWxpdHkubW92ZW1lbnQgPyBlbGlnaWJpbGl0eS5tb3ZlbWVudCA6IHt9O1xuXHRcdFx0dmFyIGV4YWN0X3N0YXJ0ID0gbW92ZW1lbnQuZXhhY3RfaW50ZXJ2YWxzICYmIG1vdmVtZW50LmV4YWN0X2ludGVydmFsc1sgMCBdID8gbW92ZW1lbnQuZXhhY3RfaW50ZXJ2YWxzWyAwIF0uc3RhcnQgOiAnJztcblx0XHRcdHZhciBzdGFydF9tYXRjaCA9IFN0cmluZyggZXhhY3Rfc3RhcnQgKS5tYXRjaCggL14oXFxkezR9LVxcZHsyfS1cXGR7Mn0pVChcXGR7Mn0pOihcXGR7Mn0pOjAwLyApO1xuXHRcdFx0dmFyIGRhdGUgPSAnZnVsbF9kYXknID09PSBtb3ZlbWVudC50aW1lX2FwcGxpY2F0aW9uID8gU3RyaW5nKCBtb3ZlbWVudC5zZWxlY3RlZF9kYXRlc1sgMCBdIHx8ICcnICkgOiAoIHN0YXJ0X21hdGNoID8gc3RhcnRfbWF0Y2hbIDEgXSA6ICcnICk7XG5cdFx0XHR2YXIgd2FsbF9taW51dGUgPSBzdGFydF9tYXRjaCA/IE51bWJlciggc3RhcnRfbWF0Y2hbIDIgXSApICogNjAgKyBOdW1iZXIoIHN0YXJ0X21hdGNoWyAzIF0gKSA6IDA7XG5cdFx0XHR2YXIgc25hcF9pbmRleDtcblxuXHRcdFx0aWYgKCAhIGdlc3R1cmVfY29udGV4dCB8fCAhIGdlc3R1cmVfY29udGV4dC5zbmFwc2hvdC5iYW5kc19ieV9kYXRlWyBkYXRlIF0gKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0c25hcF9pbmRleCA9ICdhbGxfZGF5JyA9PT0gZ2VzdHVyZV9jb250ZXh0LnNlbGVjdGlvbl9raW5kXG5cdFx0XHRcdD8gMFxuXHRcdFx0XHQ6IE1hdGgucm91bmQoICggd2FsbF9taW51dGUgLSBnZXN0dXJlX2NvbnRleHQuc25hcHNob3QudmlzaWJsZV9yYW5nZS5zdGFydF9taW51dGUgKSAvIGdlc3R1cmVfY29udGV4dC5zbmFwc2hvdC5zZWxlY3Rpb25fc3RlcF9taW51dGVzICk7XG5cblx0XHRcdHJldHVybiBrZXlib2FyZF9jb29yZGluYXRlKCBnZXN0dXJlX2NvbnRleHQuc25hcHNob3QsIGdlc3R1cmVfY29udGV4dC5zZWxlY3Rpb25fa2luZCwgZGF0ZSwgc25hcF9pbmRleCApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN0YXJ0IFBvaW50ZXIgRXZlbnRzIG1vdmVtZW50IG9ubHkgZnJvbSBhbiBhdXRob3JpemVkIGdyaXAuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge1BvaW50ZXJFdmVudH0gZXZlbnQgQ2FwdHVyZWQgcG9pbnRlcmRvd24gZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfcG9pbnRlcl9kb3duKCBldmVudCApIHtcblx0XHRcdHZhciByZXNpemVfaGFuZGxlID0gZXZlbnQudGFyZ2V0ICYmIGV2ZW50LnRhcmdldC5jbG9zZXN0ID8gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoIHJlc2l6ZV9oYW5kbGVfc2VsZWN0b3IgKSA6IG51bGw7XG5cdFx0XHR2YXIgZ3JpcCA9ICEgcmVzaXplX2hhbmRsZSAmJiBldmVudC50YXJnZXQgJiYgZXZlbnQudGFyZ2V0LmNsb3Nlc3QgPyBldmVudC50YXJnZXQuY2xvc2VzdCggbW92ZW1lbnRfZ3JpcF9zZWxlY3RvciApIDogbnVsbDtcblx0XHRcdHZhciBvcGVyYXRpb24gPSByZXNpemVfaGFuZGxlID8gU3RyaW5nKCByZXNpemVfaGFuZGxlLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3MtcmVzaXplLW9wZXJhdGlvbicgKSB8fCAnJyApIDogJyc7XG5cdFx0XHR2YXIgY29udHJvbCA9IHJlc2l6ZV9oYW5kbGUgfHwgZ3JpcDtcblx0XHRcdHZhciByZWdpc3RyYXRpb24gPSBjb250cm9sID8gZmluZF9yZWdpc3RyYXRpb25fZm9yX2dyaXAoIGNvbnRyb2wgKSA6IG51bGw7XG5cdFx0XHR2YXIgc3VyZmFjZTtcblx0XHRcdHZhciBzdXJmYWNlX3JlY3Q7XG5cdFx0XHR2YXIgY29vcmRpbmF0ZTtcblxuXHRcdFx0aWYgKCAhIHJlZ2lzdHJhdGlvbiB8fCAoIE51bWJlci5pc0Zpbml0ZSggTnVtYmVyKCBldmVudC5idXR0b24gKSApICYmIDAgIT09IE51bWJlciggZXZlbnQuYnV0dG9uICkgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCByZXNpemVfaGFuZGxlICkge1xuXHRcdFx0XHRpZiAoICEgYmVnaW5fcmVzaXplX2dlc3R1cmUoIHJlZ2lzdHJhdGlvbiwgcmVzaXplX2hhbmRsZSwgb3BlcmF0aW9uLCBOdW1iZXIoIGV2ZW50LnBvaW50ZXJJZCApIHx8IDAsIE51bWJlciggZXZlbnQuY2xpZW50WSApICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHJlc2l6ZV9oYW5kbGUuc2V0UG9pbnRlckNhcHR1cmUgJiYgZXZlbnQucG9pbnRlcklkICkge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRyZXNpemVfaGFuZGxlLnNldFBvaW50ZXJDYXB0dXJlKCBldmVudC5wb2ludGVySWQgKTtcblx0XHRcdFx0XHR9IGNhdGNoICggZXJyb3IgKSB7XG5cdFx0XHRcdFx0XHQvLyBEb2N1bWVudCBsaXN0ZW5lcnMgc3RpbGwgb3duIGNvbXBsZXRpb24gd2hlbiBjYXB0dXJlIGlzIHVuYXZhaWxhYmxlLlxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0c3VyZmFjZSA9IHJlZ2lzdHJhdGlvbi5jYXJkLmNsb3Nlc3QoICd2ZXJ0aWNhbCcgPT09IHJlZ2lzdHJhdGlvbi5pbnRlcmFjdGlvbl9heGlzID8gdGltZWRfc3VyZmFjZV9zZWxlY3RvciA6IGFsbF9kYXlfc3VyZmFjZV9zZWxlY3RvciApO1xuXHRcdFx0aWYgKCAhIHN1cmZhY2UgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHN1cmZhY2VfcmVjdCA9IHN1cmZhY2UuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRjb29yZGluYXRlID0ge1xuXHRcdFx0XHRzb3VyY2U6ICdwb2ludGVyJyxcblx0XHRcdFx0c2VsZWN0aW9uX2tpbmQ6ICd2ZXJ0aWNhbCcgPT09IHJlZ2lzdHJhdGlvbi5pbnRlcmFjdGlvbl9heGlzID8gJ3RpbWVkJyA6ICdhbGxfZGF5Jyxcblx0XHRcdFx0aW5saW5lX3B4OiBOdW1iZXIoIGV2ZW50LmNsaWVudFggKSAtIHN1cmZhY2VfcmVjdC5sZWZ0LFxuXHRcdFx0XHRibG9ja19weDogTnVtYmVyKCBldmVudC5jbGllbnRZICkgLSBzdXJmYWNlX3JlY3QudG9wXG5cdFx0XHR9O1xuXHRcdFx0aWYgKCAhIGJlZ2luX2dlc3R1cmUoIHJlZ2lzdHJhdGlvbiwgZ3JpcCwgJ3BvaW50ZXInLCBjb29yZGluYXRlLCBOdW1iZXIoIGV2ZW50LnBvaW50ZXJJZCApIHx8IDAgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgZ3JpcC5zZXRQb2ludGVyQ2FwdHVyZSAmJiBldmVudC5wb2ludGVySWQgKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Z3JpcC5zZXRQb2ludGVyQ2FwdHVyZSggZXZlbnQucG9pbnRlcklkICk7XG5cdFx0XHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdFx0XHQvLyBDYXB0dXJlIGlzIGFuIG9wdGltaXphdGlvbjsgZG9jdW1lbnQgbGlzdGVuZXJzIHN0aWxsIG93biBjb21wbGV0aW9uLlxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogVXBkYXRlIG9uZSBhY3RpdmUgcG9pbnRlciBnZXN0dXJlIHRocm91Z2ggYSBjb2FsZXNjZWQgdmlzdWFsIGZyYW1lLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtQb2ludGVyRXZlbnR9IGV2ZW50IFBvaW50ZXIgbW92ZSBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9wb2ludGVyX21vdmUoIGV2ZW50ICkge1xuXHRcdFx0dmFyIHRhcmdldDtcblxuXHRcdFx0aWYgKCAhIGFjdGl2ZV9nZXN0dXJlIHx8ICdwb2ludGVyJyAhPT0gYWN0aXZlX2dlc3R1cmUuaW5wdXRfbW9kZSB8fCBOdW1iZXIoIGV2ZW50LnBvaW50ZXJJZCApICE9PSBhY3RpdmVfZ2VzdHVyZS5wb2ludGVyX2lkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdtb3ZlbWVudCcgPT09IGFjdGl2ZV9nZXN0dXJlLmdlc3R1cmVfdHlwZSApIHtcblx0XHRcdFx0dGFyZ2V0ID0gcmVzb2x2ZV9wb2ludGVyX21vdmVtZW50X3RhcmdldCggYWN0aXZlX2dlc3R1cmUsIGV2ZW50ICk7XG5cdFx0XHRcdGFjdGl2ZV9nZXN0dXJlLnBlbmRpbmdfY29vcmRpbmF0ZSA9IHRhcmdldCA/IHRhcmdldC5jb29yZGluYXRlIDogbnVsbDtcblx0XHRcdFx0YWN0aXZlX2dlc3R1cmUucGVuZGluZ19jb250ZXh0ID0gdGFyZ2V0ID8gdGFyZ2V0LmNvbnRleHQgOiBudWxsO1xuXHRcdFx0XHRhY3RpdmVfZ2VzdHVyZS5wZW5kaW5nX3RhcmdldF9yZXNvdXJjZV9pZCA9IHRhcmdldCA/IHRhcmdldC5yZXNvdXJjZV9pZCA6IDA7XG5cdFx0XHRcdGlmICggISB0YXJnZXQgKSB7XG5cdFx0XHRcdFx0c2V0X2dlc3R1cmVfdGFyZ2V0X3N1cmZhY2UoIGFjdGl2ZV9nZXN0dXJlLCBudWxsLCBmYWxzZSApO1xuXHRcdFx0XHRcdGFubm91bmNlX2dlc3R1cmUoIGFjdGl2ZV9nZXN0dXJlLCBpMThuLm91dHNpZGVfdW5hdmFpbGFibGUgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YWN0aXZlX2dlc3R1cmUucGVuZGluZ19jb29yZGluYXRlID0gJ3RpbWVkJyA9PT0gYWN0aXZlX2dlc3R1cmUuY29udGV4dC5zZWxlY3Rpb25fa2luZFxuXHRcdFx0XHRcdD8gdGltZWRfcmVzaXplX3BvaW50ZXJfY29vcmRpbmF0ZSggYWN0aXZlX2dlc3R1cmUsIGV2ZW50IClcblx0XHRcdFx0XHQ6IHBvaW50ZXJfY29vcmRpbmF0ZSggYWN0aXZlX2dlc3R1cmUuY29udGV4dCwgZXZlbnQgKTtcblx0XHRcdFx0YWN0aXZlX2dlc3R1cmUucGVuZGluZ19jb250ZXh0ID0gYWN0aXZlX2dlc3R1cmUuY29udGV4dDtcblx0XHRcdFx0YWN0aXZlX2dlc3R1cmUucGVuZGluZ190YXJnZXRfcmVzb3VyY2VfaWQgPSBhY3RpdmVfZ2VzdHVyZS5yZWdpc3RyYXRpb24ucmVzb3VyY2VfaWQ7XG5cdFx0XHR9XG5cdFx0XHRzY2hlZHVsZV9nZXN0dXJlX2ZyYW1lKCk7XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENvbXBsZXRlIHRoZSBhY3RpdmUgcG9pbnRlciBwcm9wb3NhbCBhZnRlciBpdHMgZmluYWwgZXhhY3QgY29vcmRpbmF0ZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7UG9pbnRlckV2ZW50fSBldmVudCBQb2ludGVyIGNvbXBsZXRpb24gZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfcG9pbnRlcl91cCggZXZlbnQgKSB7XG5cdFx0XHR2YXIgdGFyZ2V0O1xuXG5cdFx0XHRpZiAoICEgYWN0aXZlX2dlc3R1cmUgfHwgJ3BvaW50ZXInICE9PSBhY3RpdmVfZ2VzdHVyZS5pbnB1dF9tb2RlIHx8IE51bWJlciggZXZlbnQucG9pbnRlcklkICkgIT09IGFjdGl2ZV9nZXN0dXJlLnBvaW50ZXJfaWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggJ21vdmVtZW50JyA9PT0gYWN0aXZlX2dlc3R1cmUuZ2VzdHVyZV90eXBlICkge1xuXHRcdFx0XHR0YXJnZXQgPSByZXNvbHZlX3BvaW50ZXJfbW92ZW1lbnRfdGFyZ2V0KCBhY3RpdmVfZ2VzdHVyZSwgZXZlbnQgKTtcblx0XHRcdFx0aWYgKCAhIHRhcmdldCApIHtcblx0XHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdGNhbmNlbF9nZXN0dXJlKCB0cnVlLCBpMThuLmNhbmNlbGxlZCApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRhY3RpdmVfZ2VzdHVyZS5wZW5kaW5nX2Nvb3JkaW5hdGUgPSB0YXJnZXQuY29vcmRpbmF0ZTtcblx0XHRcdFx0YWN0aXZlX2dlc3R1cmUucGVuZGluZ19jb250ZXh0ID0gdGFyZ2V0LmNvbnRleHQ7XG5cdFx0XHRcdGFjdGl2ZV9nZXN0dXJlLnBlbmRpbmdfdGFyZ2V0X3Jlc291cmNlX2lkID0gdGFyZ2V0LnJlc291cmNlX2lkO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YWN0aXZlX2dlc3R1cmUucGVuZGluZ19jb29yZGluYXRlID0gJ3RpbWVkJyA9PT0gYWN0aXZlX2dlc3R1cmUuY29udGV4dC5zZWxlY3Rpb25fa2luZFxuXHRcdFx0XHRcdD8gdGltZWRfcmVzaXplX3BvaW50ZXJfY29vcmRpbmF0ZSggYWN0aXZlX2dlc3R1cmUsIGV2ZW50IClcblx0XHRcdFx0XHQ6IHBvaW50ZXJfY29vcmRpbmF0ZSggYWN0aXZlX2dlc3R1cmUuY29udGV4dCwgZXZlbnQgKTtcblx0XHRcdFx0YWN0aXZlX2dlc3R1cmUucGVuZGluZ19jb250ZXh0ID0gYWN0aXZlX2dlc3R1cmUuY29udGV4dDtcblx0XHRcdFx0YWN0aXZlX2dlc3R1cmUucGVuZGluZ190YXJnZXRfcmVzb3VyY2VfaWQgPSBhY3RpdmVfZ2VzdHVyZS5yZWdpc3RyYXRpb24ucmVzb3VyY2VfaWQ7XG5cdFx0XHR9XG5cdFx0XHRjb21wbGV0ZV9nZXN0dXJlKCk7XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENhbmNlbCBhIHBvaW50ZXIgd2hvc2Ugb3duZXJzaGlwIHdhcyBsb3N0IGJlZm9yZSBjYW5vbmljYWwgUmV2aWV3LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtQb2ludGVyRXZlbnR9IGV2ZW50IFBvaW50ZXIgY2FuY2VsbGF0aW9uIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX3BvaW50ZXJfY2FuY2VsKCBldmVudCApIHtcblx0XHRcdGlmICggYWN0aXZlX2dlc3R1cmUgJiYgJ3BvaW50ZXInID09PSBhY3RpdmVfZ2VzdHVyZS5pbnB1dF9tb2RlICYmIE51bWJlciggZXZlbnQucG9pbnRlcklkICkgPT09IGFjdGl2ZV9nZXN0dXJlLnBvaW50ZXJfaWQgKSB7XG5cdFx0XHRcdGNhbmNlbF9nZXN0dXJlKCB0cnVlLCAncmVzaXplJyA9PT0gYWN0aXZlX2dlc3R1cmUuZ2VzdHVyZV90eXBlID8gaTE4bi5yZXNpemVfY2FuY2VsbGVkIDogaTE4bi5jYW5jZWxsZWQgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBPcGVyYXRlIHRoZSBhY2Nlc3NpYmxlIGtleWJvYXJkIG1vdmVtZW50IHN0YXRlIG1hY2hpbmUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0tleWJvYXJkRXZlbnR9IGV2ZW50IEtleWRvd24gZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfa2V5ZG93biggZXZlbnQgKSB7XG5cdFx0XHR2YXIgcmVzaXplX2hhbmRsZSA9IGV2ZW50LnRhcmdldCAmJiBldmVudC50YXJnZXQuY2xvc2VzdCA/IGV2ZW50LnRhcmdldC5jbG9zZXN0KCByZXNpemVfaGFuZGxlX3NlbGVjdG9yICkgOiBudWxsO1xuXHRcdFx0dmFyIGdyaXAgPSAhIHJlc2l6ZV9oYW5kbGUgJiYgZXZlbnQudGFyZ2V0ICYmIGV2ZW50LnRhcmdldC5jbG9zZXN0ID8gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoIG1vdmVtZW50X2dyaXBfc2VsZWN0b3IgKSA6IG51bGw7XG5cdFx0XHR2YXIgcmVzaXplX3JlZ2lzdHJhdGlvbiA9IHJlc2l6ZV9oYW5kbGUgPyBmaW5kX3JlZ2lzdHJhdGlvbl9mb3JfZ3JpcCggcmVzaXplX2hhbmRsZSApIDogbnVsbDtcblx0XHRcdHZhciByZWdpc3RyYXRpb24gPSBncmlwID8gZmluZF9yZWdpc3RyYXRpb25fZm9yX2dyaXAoIGdyaXAgKSA6IG51bGw7XG5cdFx0XHR2YXIgZWxpZ2liaWxpdHk7XG5cdFx0XHR2YXIgb3JpZ2luX2Nvb3JkaW5hdGU7XG5cdFx0XHR2YXIgc25hcHNob3Q7XG5cdFx0XHR2YXIgZGF0ZV9pbmRleDtcblx0XHRcdHZhciBkYXRlX2RlbHRhID0gMDtcblx0XHRcdHZhciBzbmFwX2RlbHRhID0gMDtcblxuXHRcdFx0aWYgKCBhY3RpdmVfZ2VzdHVyZSAmJiAnRXNjYXBlJyA9PT0gZXZlbnQua2V5ICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRjYW5jZWxfZ2VzdHVyZSggdHJ1ZSwgJ3Jlc2l6ZScgPT09IGFjdGl2ZV9nZXN0dXJlLmdlc3R1cmVfdHlwZSA/IGkxOG4ucmVzaXplX2NhbmNlbGxlZCA6IGkxOG4uY2FuY2VsbGVkICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChcblx0XHRcdFx0ISBhY3RpdmVfZ2VzdHVyZVxuXHRcdFx0XHQmJiByZXNpemVfaGFuZGxlXG5cdFx0XHRcdCYmIHJlc2l6ZV9yZWdpc3RyYXRpb25cblx0XHRcdFx0JiYgKCAnRW50ZXInID09PSBldmVudC5rZXkgfHwgJyAnID09PSBldmVudC5rZXkgKVxuXHRcdFx0KSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRpZiAoIGNhbGxiYWNrcy5vcGVuX2Jvb2tpbmdfZnVsbF9yZXNjaGVkdWxlICkge1xuXHRcdFx0XHRcdGNhbGxiYWNrcy5vcGVuX2Jvb2tpbmdfZnVsbF9yZXNjaGVkdWxlKCByZXNpemVfcmVnaXN0cmF0aW9uLmNhcmQsIHJlc2l6ZV9oYW5kbGUgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGFjdGl2ZV9nZXN0dXJlICYmICdrZXlib2FyZCcgPT09IGFjdGl2ZV9nZXN0dXJlLmlucHV0X21vZGUgKSB7XG5cdFx0XHRcdGlmICggJ0VudGVyJyA9PT0gZXZlbnQua2V5IHx8ICcgJyA9PT0gZXZlbnQua2V5ICkge1xuXHRcdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0Y29tcGxldGVfZ2VzdHVyZSgpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIC0xID09PSBbICdBcnJvd0xlZnQnLCAnQXJyb3dSaWdodCcsICdBcnJvd1VwJywgJ0Fycm93RG93bicgXS5pbmRleE9mKCBldmVudC5rZXkgKSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0c25hcHNob3QgPSBhY3RpdmVfZ2VzdHVyZS5jb250ZXh0LnNuYXBzaG90O1xuXHRcdFx0XHRkYXRlX2RlbHRhID0gJ0Fycm93TGVmdCcgPT09IGV2ZW50LmtleSA/IC0xIDogKCAnQXJyb3dSaWdodCcgPT09IGV2ZW50LmtleSA/IDEgOiAwICk7XG5cdFx0XHRcdGlmICggJ3J0bCcgPT09IHNuYXBzaG90LmRpcmVjdGlvbiApIHtcblx0XHRcdFx0XHRkYXRlX2RlbHRhICo9IC0xO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNuYXBfZGVsdGEgPSAnQXJyb3dVcCcgPT09IGV2ZW50LmtleSA/IC0xIDogKCAnQXJyb3dEb3duJyA9PT0gZXZlbnQua2V5ID8gMSA6IDAgKTtcblx0XHRcdFx0ZGF0ZV9pbmRleCA9IE1hdGgubWF4KCAwLCBNYXRoLm1pbiggc25hcHNob3QuZGF0ZV9jb2x1bW5zLmxlbmd0aCAtIDEsIHNuYXBzaG90LmRhdGVfb3JkZXJbIGFjdGl2ZV9nZXN0dXJlLmN1cnJlbnQuZGF0ZSBdICsgZGF0ZV9kZWx0YSApICk7XG5cdFx0XHRcdGFjdGl2ZV9nZXN0dXJlLnBlbmRpbmdfY29vcmRpbmF0ZSA9IGtleWJvYXJkX2Nvb3JkaW5hdGUoXG5cdFx0XHRcdFx0c25hcHNob3QsXG5cdFx0XHRcdFx0YWN0aXZlX2dlc3R1cmUuY29udGV4dC5zZWxlY3Rpb25fa2luZCxcblx0XHRcdFx0XHRzbmFwc2hvdC5kYXRlX2NvbHVtbnNbIGRhdGVfaW5kZXggXS5kYXRlLFxuXHRcdFx0XHRcdGFjdGl2ZV9nZXN0dXJlLmN1cnJlbnQuc25hcF9pbmRleCArIHNuYXBfZGVsdGFcblx0XHRcdFx0KTtcblx0XHRcdFx0Zmx1c2hfZ2VzdHVyZV9mcmFtZSgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgcmVnaXN0cmF0aW9uIHx8ICggJ0VudGVyJyAhPT0gZXZlbnQua2V5ICYmICcgJyAhPT0gZXZlbnQua2V5ICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGVsaWdpYmlsaXR5ID0gZWxpZ2liaWxpdHlfY2FjaGVbIHJlZ2lzdHJhdGlvbi5jYW5vbmljYWxfa2V5IF07XG5cdFx0XHRpZiAoIGVsaWdpYmlsaXR5ICYmICEgZWxpZ2liaWxpdHkuZXJyb3IgJiYgISBlbGlnaWJpbGl0eS5tb3ZlbWVudC5zYW1lX3Jlc291cmNlICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRpZiAoIGNhbGxiYWNrcy5vcGVuX2Jvb2tpbmdfZnVsbF9yZXNjaGVkdWxlICkge1xuXHRcdFx0XHRcdGNhbGxiYWNrcy5vcGVuX2Jvb2tpbmdfZnVsbF9yZXNjaGVkdWxlKCByZWdpc3RyYXRpb24uY2FyZCwgZ3JpcCApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdG9yaWdpbl9jb29yZGluYXRlID0gZ2V0X2tleWJvYXJkX29yaWdpbl9jb29yZGluYXRlKCByZWdpc3RyYXRpb24sIGVsaWdpYmlsaXR5ICk7XG5cdFx0XHRpZiAoICEgb3JpZ2luX2Nvb3JkaW5hdGUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRiZWdpbl9nZXN0dXJlKCByZWdpc3RyYXRpb24sIGdyaXAsICdrZXlib2FyZCcsIG9yaWdpbl9jb29yZGluYXRlLCAwICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVzb2x2ZSBvbmUgc2VydmVyLW93bmVkIHJlc2l6ZSBkZW5pYWwgaW50byB2aXNpYmxlIHRyYW5zbGF0ZWQgZ3VpZGFuY2UuXG5cdFx0ICpcblx0XHQgKiBUaGUgZmFsbGJhY2sgcmVhc29uIGlzIHByZXNlbnRhdGlvbiBkYXRhIG9ubHkuIENhbm9uaWNhbCByZXNpemUgcG9saWN5XG5cdFx0ICogcmVtYWlucyBhdXRob3JpdGF0aXZlIGFuZCBubyBoaWRkZW4gb3IgZGlzYWJsZWQgY29udHJvbCBncmFudHMgcGVybWlzc2lvbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBlbGlnaWJpbGl0eSBDb21iaW5lZCBhY2NlcHRlZCBlbGlnaWJpbGl0eSByZXN1bHQuXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBVc2VyIGd1aWRhbmNlIG9yIGFuIGVtcHR5IHN0cmluZyB3aGVuIHJlc2l6ZSBpcyBhdmFpbGFibGUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3Jlc2l6ZV9kZW5pYWxfbWVzc2FnZSggZWxpZ2liaWxpdHkgKSB7XG5cdFx0XHR2YXIgcmVhc29ucyA9IGkxOG4ucmVzaXplX2RlbmlhbF9yZWFzb25zICYmICdvYmplY3QnID09PSB0eXBlb2YgaTE4bi5yZXNpemVfZGVuaWFsX3JlYXNvbnNcblx0XHRcdFx0PyBpMThuLnJlc2l6ZV9kZW5pYWxfcmVhc29uc1xuXHRcdFx0XHQ6IHt9O1xuXHRcdFx0dmFyIHJlc2l6ZSA9IGVsaWdpYmlsaXR5ICYmIGVsaWdpYmlsaXR5LnJlc2l6ZSA/IGVsaWdpYmlsaXR5LnJlc2l6ZSA6IHt9O1xuXHRcdFx0dmFyIHJlYXNvbiA9IFN0cmluZyggcmVzaXplLmZhbGxiYWNrX3JlYXNvbiB8fCAnJyApO1xuXG5cdFx0XHRyZXR1cm4gISByZXNpemUuYWxsb3dlZCAmJiByZWFzb24gPyBTdHJpbmcoIHJlYXNvbnNbIHJlYXNvbiBdIHx8IGkxOG4uZGVuaWVkIHx8ICcnICkgOiAnJztcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgY29udHJvbHMgb25seSBmb3IgaW5kZXBlbmRlbnRseSBlbmFibGVkLCBzZXJ2ZXItYXV0aG9yaXplZCBnZXN0dXJlcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZWdpc3RyYXRpb24gU2VsZWN0ZWQgY2Fub25pY2FsIGFuY2hvciByZWdpc3RyYXRpb24uXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGVsaWdpYmlsaXR5IEZyZXNoIGNvbWJpbmVkIGVsaWdpYmlsaXR5IHJlc3VsdC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9lbGlnaWJpbGl0eSggcmVnaXN0cmF0aW9uLCBlbGlnaWJpbGl0eSApIHtcblx0XHRcdHZhciBjYW5vbmljYWxfcmVnaXN0cmF0aW9ucyA9IGdldF9jYW5vbmljYWxfcmVnaXN0cmF0aW9ucyggcmVnaXN0cmF0aW9uLmNhbm9uaWNhbF9rZXkgKTtcblx0XHRcdHZhciBhbmNob3JfcmVnaXN0cmF0aW9uID0gY2Fub25pY2FsX3JlZ2lzdHJhdGlvbnMuZmlsdGVyKCBmdW5jdGlvbiAoIGNhbmRpZGF0ZSApIHtcblx0XHRcdFx0cmV0dXJuICEgY2FuZGlkYXRlLmlzX292ZXJmbG93ZWQ7XG5cdFx0XHR9IClbIDAgXSB8fCByZWdpc3RyYXRpb247XG5cdFx0XHR2YXIgc3RhdHVzX2lkID0gJ3dwYmMtdGltZS1yb3dzLW1vdmVtZW50LXN0YXR1cy0nICsgcmVnaXN0cmF0aW9uLmJvb2tpbmdfaWQgKyAnLScgKyByZXF1ZXN0X2dlbmVyYXRpb247XG5cdFx0XHR2YXIgcmVzaXplX2RlbmlhbF9tZXNzYWdlID0gZ2V0X3Jlc2l6ZV9kZW5pYWxfbWVzc2FnZSggZWxpZ2liaWxpdHkgKTtcblx0XHRcdHZhciBzdGF0dXNfbWVzc2FnZSA9IGVsaWdpYmlsaXR5LmVycm9yXG5cdFx0XHRcdD8gaTE4bi5lcnJvclxuXHRcdFx0XHQ6ICggcmVzaXplX2RlbmlhbF9tZXNzYWdlIHx8ICggZWxpZ2liaWxpdHkubW92ZW1lbnQuYWxsb3dlZCB8fCBlbGlnaWJpbGl0eS5yZXNpemUuc3RhcnQgfHwgZWxpZ2liaWxpdHkucmVzaXplLmVuZCA/IGkxOG4ucmVhZHkgOiBpMThuLmRlbmllZCApICk7XG5cblx0XHRcdGNsZWFyX2FsbF9yZWdpc3RyYXRpb25faG9zdHMoKTtcblx0XHRcdGNhbm9uaWNhbF9yZWdpc3RyYXRpb25zLmZvckVhY2goIGZ1bmN0aW9uICggY2FuZGlkYXRlICkge1xuXHRcdFx0XHR2YXIgaG9zdCA9IGNyZWF0ZV9jb250cm9sX2hvc3QoIGNhbmRpZGF0ZSApO1xuXHRcdFx0XHR2YXIgaXNfYW5jaG9yID0gY2FuZGlkYXRlLnJlbmRlcl9pZCA9PT0gYW5jaG9yX3JlZ2lzdHJhdGlvbi5yZW5kZXJfaWQ7XG5cdFx0XHRcdHZhciBpc190aW1lZF9yZXNpemUgPSAndmVydGljYWwnID09PSBjYW5kaWRhdGUuaW50ZXJhY3Rpb25fYXhpc1xuXHRcdFx0XHRcdCYmIC0xICE9PSBzdXBwb3J0ZWRfdGltZWRfcmVzaXplX3NoYXBlcy5pbmRleE9mKCBlbGlnaWJpbGl0eS5yZXNpemUuc2F2ZWRfc2hhcGUgKTtcblx0XHRcdFx0dmFyIGlzX2Z1bGxfZGF5X3Jlc2l6ZSA9IGZ1bGxfZGF5X3Jlc2l6ZV9lbmFibGVkXG5cdFx0XHRcdFx0JiYgJ2hvcml6b250YWwnID09PSBjYW5kaWRhdGUuaW50ZXJhY3Rpb25fYXhpc1xuXHRcdFx0XHRcdCYmIC0xICE9PSBzdXBwb3J0ZWRfZnVsbF9kYXlfcmVzaXplX3NoYXBlcy5pbmRleE9mKCBlbGlnaWJpbGl0eS5yZXNpemUuc2F2ZWRfc2hhcGUgKTtcblx0XHRcdFx0dmFyIHNob3dfc3RhcnQgPSAhIGVsaWdpYmlsaXR5LmVycm9yICYmIGVsaWdpYmlsaXR5LnJlc2l6ZS5hbGxvd2VkICYmICggaXNfdGltZWRfcmVzaXplIHx8IGlzX2Z1bGxfZGF5X3Jlc2l6ZSApICYmIGVsaWdpYmlsaXR5LnJlc2l6ZS5zdGFydCAmJiBjYW5kaWRhdGUuYm91bmRhcnlfc3RhcnRfdmlzaWJsZTtcblx0XHRcdFx0dmFyIHNob3dfZW5kID0gISBlbGlnaWJpbGl0eS5lcnJvciAmJiBlbGlnaWJpbGl0eS5yZXNpemUuYWxsb3dlZCAmJiAoIGlzX3RpbWVkX3Jlc2l6ZSB8fCBpc19mdWxsX2RheV9yZXNpemUgKSAmJiBlbGlnaWJpbGl0eS5yZXNpemUuZW5kICYmIGNhbmRpZGF0ZS5ib3VuZGFyeV9lbmRfdmlzaWJsZTtcblxuXHRcdFx0XHRpZiAoICEgaG9zdCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBpc19hbmNob3IgKSB7XG5cdFx0XHRcdFx0cmVuZGVyX3RlbXBsYXRlKCBob3N0LCAnc3RhdHVzJywge1xuXHRcdFx0XHRcdFx0c3RhdHVzX2lkOiBzdGF0dXNfaWQsXG5cdFx0XHRcdFx0XHRtZXNzYWdlOiBzdGF0dXNfbWVzc2FnZVxuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0aXNfYW5jaG9yXG5cdFx0XHRcdFx0JiYgISBlbGlnaWJpbGl0eS5lcnJvclxuXHRcdFx0XHRcdCYmICggZWxpZ2liaWxpdHkubW92ZW1lbnQuc2FtZV9yZXNvdXJjZSB8fCAoIGNyb3NzX3Jlc291cmNlX21vdmVtZW50X2VuYWJsZWQgJiYgZWxpZ2liaWxpdHkubW92ZW1lbnQuY3Jvc3NfcmVzb3VyY2UgKSApXG5cdFx0XHRcdFx0JiYgKCAndmVydGljYWwnID09PSBjYW5kaWRhdGUuaW50ZXJhY3Rpb25fYXhpcyB8fCBmdWxsX2RheV9tb3ZlbWVudF9lbmFibGVkIClcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0cmVuZGVyX3RlbXBsYXRlKCBob3N0LCAnZ3JpcCcsIHtcblx0XHRcdFx0XHRcdGxhYmVsOiBpMThuLm1vdmVtZW50X2xhYmVsLFxuXHRcdFx0XHRcdFx0c3RhdHVzX2lkOiBzdGF0dXNfaWQsXG5cdFx0XHRcdFx0XHRcdGtleWJvYXJkX2luc3RydWN0aW9uczogJ2hvcml6b250YWwnID09PSBjYW5kaWRhdGUuaW50ZXJhY3Rpb25fYXhpc1xuXHRcdFx0XHRcdFx0XHRcdD8gaTE4bi5mdWxsX2RheV9rZXlib2FyZF9pbnN0cnVjdGlvbnNcblx0XHRcdFx0XHRcdFx0XHQ6IGkxOG4ua2V5Ym9hcmRfaW5zdHJ1Y3Rpb25zXG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggc2hvd19zdGFydCB8fCBzaG93X2VuZCApIHtcblx0XHRcdFx0XHRyZW5kZXJfdGVtcGxhdGUoIGhvc3QsICdyZXNpemVfaGFuZGxlcycsIHtcblx0XHRcdFx0XHRcdHN0YXJ0OiBzaG93X3N0YXJ0LFxuXHRcdFx0XHRcdFx0ZW5kOiBzaG93X2VuZCxcblx0XHRcdFx0XHRcdGdyb3VwX2xhYmVsOiBpMThuLnJlc2l6ZV9ncm91cF9sYWJlbCxcblx0XHRcdFx0XHRcdHN0YXJ0X2xhYmVsOiBpMThuLnJlc2l6ZV9zdGFydF9sYWJlbCxcblx0XHRcdFx0XHRcdGVuZF9sYWJlbDogaTE4bi5yZXNpemVfZW5kX2xhYmVsLFxuXHRcdFx0XHRcdFx0c3RhdHVzX2lkOiBzdGF0dXNfaWQsXG5cdFx0XHRcdFx0XHRrZXlib2FyZF9mYWxsYmFjazogaTE4bi5yZXNpemVfa2V5Ym9hcmRfZmFsbGJhY2tcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgcmVxdWVzdC1vd25lZCBjaGVja2luZyBtYXJrZXJzIG9uIHRydWUgY2Fub25pY2FsIGJvdW5kYXJpZXMuXG5cdFx0ICpcblx0XHQgKiBFdmVyeSB2aXNpYmxlIGZyYWdtZW50IHJlY2VpdmVzIG9ubHkgdGhlIG1hcmtlciBmb3IgdGhlIGNhbm9uaWNhbCBib3VuZGFyeVxuXHRcdCAqIGl0IG93bnMuIFRoZSBzZWxlY3RlZCBhbmNob3IgYWxvbmUgZXhwb3NlcyB0aGUgcG9saXRlIGNoZWNraW5nIG1lc3NhZ2UsIHNvXG5cdFx0ICogdmlzdWFsIHBhcml0eSBkb2VzIG5vdCBkdXBsaWNhdGUgYXNzaXN0aXZlIGFubm91bmNlbWVudHMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmVnaXN0cmF0aW9uIFNlbGVjdGVkIGNhbm9uaWNhbCByZWdpc3RyYXRpb24uXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZW5kZXJfY2hlY2tpbmdfc3RhdHVzKCByZWdpc3RyYXRpb24gKSB7XG5cdFx0XHR2YXIgY2Fub25pY2FsX3JlZ2lzdHJhdGlvbnMgPSBnZXRfY2Fub25pY2FsX3JlZ2lzdHJhdGlvbnMoIHJlZ2lzdHJhdGlvbi5jYW5vbmljYWxfa2V5ICk7XG5cdFx0XHR2YXIgYW5jaG9yX3JlZ2lzdHJhdGlvbiA9IGNhbm9uaWNhbF9yZWdpc3RyYXRpb25zLmZpbHRlciggZnVuY3Rpb24gKCBjYW5kaWRhdGUgKSB7XG5cdFx0XHRcdHJldHVybiAhIGNhbmRpZGF0ZS5pc19vdmVyZmxvd2VkO1xuXHRcdFx0fSApWyAwIF0gfHwgcmVnaXN0cmF0aW9uO1xuXG5cdFx0XHRjbGVhcl9hbGxfcmVnaXN0cmF0aW9uX2hvc3RzKCk7XG5cdFx0XHRjYW5vbmljYWxfcmVnaXN0cmF0aW9ucy5mb3JFYWNoKCBmdW5jdGlvbiAoIGNhbmRpZGF0ZSApIHtcblx0XHRcdFx0dmFyIGhvc3QgPSBjcmVhdGVfY29udHJvbF9ob3N0KCBjYW5kaWRhdGUgKTtcblx0XHRcdFx0dmFyIGlzX2FuY2hvciA9IGNhbmRpZGF0ZS5yZW5kZXJfaWQgPT09IGFuY2hvcl9yZWdpc3RyYXRpb24ucmVuZGVyX2lkO1xuXG5cdFx0XHRcdGlmICggISBob3N0ICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZW5kZXJfdGVtcGxhdGUoIGhvc3QsICdzdGF0dXMnLCB7XG5cdFx0XHRcdFx0aXNfbG9hZGluZzogdHJ1ZSxcblx0XHRcdFx0XHRzaG93X3N0YXJ0OiBjYW5kaWRhdGUuYm91bmRhcnlfc3RhcnRfdmlzaWJsZSxcblx0XHRcdFx0XHRzaG93X2VuZDogY2FuZGlkYXRlLmJvdW5kYXJ5X2VuZF92aXNpYmxlLFxuXHRcdFx0XHRcdHN0YXR1c19pZDogaXNfYW5jaG9yID8gJ3dwYmMtdGltZS1yb3dzLW1vdmVtZW50LXN0YXR1cy0nICsgcmVnaXN0cmF0aW9uLmJvb2tpbmdfaWQgKyAnLScgKyByZXF1ZXN0X2dlbmVyYXRpb24gOiAnJyxcblx0XHRcdFx0XHRtZXNzYWdlOiBpc19hbmNob3IgPyBpMThuLmNoZWNraW5nIDogJydcblx0XHRcdFx0fSApO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENvbXBsZXRlIHR3byBhdXRob3JpdGF0aXZlIGVsaWdpYmlsaXR5IHJlYWRzIGZvciBvbmUgYWNjZXB0ZWQgaWRlbnRpdHkuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmVnaXN0cmF0aW9uIFNlbGVjdGVkIGNhbm9uaWNhbCByZWdpc3RyYXRpb24uXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXF1ZXN0X2VsaWdpYmlsaXR5KCByZWdpc3RyYXRpb24gKSB7XG5cdFx0XHR2YXIgbW92ZW1lbnRfdHJhbnNwb3J0ID0gdHJhbnNwb3J0Lm1vdmVtZW50IHx8IHt9O1xuXHRcdFx0dmFyIHJlc2l6ZV90cmFuc3BvcnQgPSB0cmFuc3BvcnQucmVzaXplIHx8IHt9O1xuXHRcdFx0dmFyIGdlbmVyYXRpb247XG5cdFx0XHR2YXIgcmVtYWluaW5nID0gMjtcblx0XHRcdHZhciBtb3ZlbWVudF9yZXN1bHQgPSBudWxsO1xuXHRcdFx0dmFyIHJlc2l6ZV9yZXN1bHQgPSBudWxsO1xuXHRcdFx0dmFyIGhhc19lcnJvciA9IGZhbHNlO1xuXHRcdFx0dmFyIG1vdmVtZW50X3JlcXVlc3Q7XG5cdFx0XHR2YXIgcmVzaXplX3JlcXVlc3Q7XG5cblx0XHRcdGlmIChcblx0XHRcdFx0ISB3aW5kb3cualF1ZXJ5XG5cdFx0XHRcdHx8ICEgbW92ZW1lbnRfdHJhbnNwb3J0LnVybFxuXHRcdFx0XHR8fCAhIHJlc2l6ZV90cmFuc3BvcnQudXJsXG5cdFx0XHRcdHx8ICEgaXNfcmVnaXN0cmF0aW9uX2N1cnJlbnQoIHJlZ2lzdHJhdGlvbiApXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBlbGlnaWJpbGl0eV9jYWNoZVsgcmVnaXN0cmF0aW9uLmNhbm9uaWNhbF9rZXkgXSApIHtcblx0XHRcdFx0cmVuZGVyX2VsaWdpYmlsaXR5KCByZWdpc3RyYXRpb24sIGVsaWdpYmlsaXR5X2NhY2hlWyByZWdpc3RyYXRpb24uY2Fub25pY2FsX2tleSBdICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGFib3J0X3JlcXVlc3RzKCk7XG5cdFx0XHRnZW5lcmF0aW9uID0gcmVxdWVzdF9nZW5lcmF0aW9uO1xuXHRcdFx0YWN0aXZlX3JlcXVlc3RfcmVzb3VyY2VfaWQgPSByZWdpc3RyYXRpb24ucmVzb3VyY2VfaWQ7XG5cdFx0XHRyZW5kZXJfY2hlY2tpbmdfc3RhdHVzKCByZWdpc3RyYXRpb24gKTtcblxuXHRcdFx0LyoqXG5cdFx0XHQgKiBDb21taXQgdGhlIGNvbWJpbmVkIHJlc3VsdCBvbmx5IHdoaWxlIGV2ZXJ5IGlkZW50aXR5IHJlbWFpbnMgY3VycmVudC5cblx0XHRcdCAqXG5cdFx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdFx0ICovXG5cdFx0XHRmdW5jdGlvbiBjb21wbGV0ZV9vbmVfcmVxdWVzdCgpIHtcblx0XHRcdFx0dmFyIGVsaWdpYmlsaXR5O1xuXHRcdFx0XHR2YXIgcmVzaXplX2RlbmlhbF9tZXNzYWdlO1xuXG5cdFx0XHRcdHJlbWFpbmluZyAtPSAxO1xuXHRcdFx0XHRpZiAoIHJlbWFpbmluZyB8fCBnZW5lcmF0aW9uICE9PSByZXF1ZXN0X2dlbmVyYXRpb24gfHwgISBpc19yZWdpc3RyYXRpb25fY3VycmVudCggcmVnaXN0cmF0aW9uICkgfHwgcmVnaXN0cmF0aW9uLmNhbm9uaWNhbF9rZXkgIT09IHNlbGVjdGVkX2Nhbm9uaWNhbF9rZXkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGFjdGl2ZV9yZXF1ZXN0cyA9IFtdO1xuXHRcdFx0XHRhY3RpdmVfcmVxdWVzdF9yZXNvdXJjZV9pZCA9IDA7XG5cdFx0XHRcdGVsaWdpYmlsaXR5ID0ge1xuXHRcdFx0XHRcdGlkZW50aXR5X2tleTogcmVnaXN0cmF0aW9uLmlkZW50aXR5X2tleSxcblx0XHRcdFx0XHRtb3ZlbWVudDogbW92ZW1lbnRfcmVzdWx0IHx8IHsgYWxsb3dlZDogZmFsc2UsIHNhbWVfcmVzb3VyY2U6IGZhbHNlLCBjcm9zc19yZXNvdXJjZTogZmFsc2UsIHNvdXJjZV9jb250ZXh0X3Rva2VuOiAnJyB9LFxuXHRcdFx0XHRcdHJlc2l6ZTogcmVzaXplX3Jlc3VsdCB8fCB7IHN0YXJ0OiBmYWxzZSwgZW5kOiBmYWxzZSwgc291cmNlX2NvbnRleHRfdG9rZW46ICcnIH0sXG5cdFx0XHRcdFx0ZXJyb3I6IGhhc19lcnJvciB8fCAhIG1vdmVtZW50X3Jlc3VsdCB8fCAhIHJlc2l6ZV9yZXN1bHRcblx0XHRcdFx0fTtcblx0XHRcdFx0aWYgKCAhIGVsaWdpYmlsaXR5LmVycm9yICkge1xuXHRcdFx0XHRcdGVsaWdpYmlsaXR5X2NhY2hlWyByZWdpc3RyYXRpb24uY2Fub25pY2FsX2tleSBdID0gZWxpZ2liaWxpdHk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVuZGVyX2VsaWdpYmlsaXR5KCByZWdpc3RyYXRpb24sIGVsaWdpYmlsaXR5ICk7XG5cdFx0XHRcdHJlc2l6ZV9kZW5pYWxfbWVzc2FnZSA9IGdldF9yZXNpemVfZGVuaWFsX21lc3NhZ2UoIGVsaWdpYmlsaXR5ICk7XG5cdFx0XHRcdGlmICggcmVzaXplX2RlbmlhbF9tZXNzYWdlICYmIGNhbGxiYWNrcy5zaG93X2FkbWluX21lc3NhZ2UgKSB7XG5cdFx0XHRcdFx0Y2FsbGJhY2tzLnNob3dfYWRtaW5fbWVzc2FnZSggcmVzaXplX2RlbmlhbF9tZXNzYWdlLCAnd2FybmluZycsIDUwMDAgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRtb3ZlbWVudF9yZXF1ZXN0ID0gd2luZG93LmpRdWVyeS5hamF4KCB7XG5cdFx0XHRcdHVybDogbW92ZW1lbnRfdHJhbnNwb3J0LnVybCxcblx0XHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRcdGRhdGFUeXBlOiAnanNvbicsXG5cdFx0XHRcdGRhdGE6IHtcblx0XHRcdFx0XHRhY3Rpb246IG1vdmVtZW50X3RyYW5zcG9ydC5hY3Rpb24sXG5cdFx0XHRcdFx0bm9uY2U6IG1vdmVtZW50X3RyYW5zcG9ydC5ub25jZSxcblx0XHRcdFx0XHRib29raW5nX2lkOiByZWdpc3RyYXRpb24uYm9va2luZ19pZCxcblx0XHRcdFx0XHRzb3VyY2U6ICd0aW1lbGluZScsXG5cdFx0XHRcdFx0c2VnbWVudF9pZDogcmVnaXN0cmF0aW9uLnNlZ21lbnRfaWQsXG5cdFx0XHRcdFx0c2VnbWVudF9yZXNvdXJjZV9pZDogcmVnaXN0cmF0aW9uLnJlc291cmNlX2lkLFxuXHRcdFx0XHRcdHZpc2libGVfc3RhcnRfYXQ6IHJlZ2lzdHJhdGlvbi52aXNpYmxlX3N0YXJ0LFxuXHRcdFx0XHRcdHZpc2libGVfZW5kX2F0OiByZWdpc3RyYXRpb24udmlzaWJsZV9lbmQsXG5cdFx0XHRcdFx0cHJvcG9zYWxfcmV2aXNpb246IDFcblx0XHRcdFx0fVxuXHRcdFx0fSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRcdG1vdmVtZW50X3Jlc3VsdCA9IG5vcm1hbGl6ZV9tb3ZlbWVudF9yZXNwb25zZSggcmVzcG9uc2UsIHJlZ2lzdHJhdGlvbiApO1xuXHRcdFx0XHRoYXNfZXJyb3IgPSBoYXNfZXJyb3IgfHwgISBtb3ZlbWVudF9yZXN1bHQ7XG5cdFx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCByZXF1ZXN0LCByZXF1ZXN0X3N0YXR1cyApIHtcblx0XHRcdFx0aWYgKCAnYWJvcnQnICE9PSByZXF1ZXN0X3N0YXR1cyApIHtcblx0XHRcdFx0XHRoYXNfZXJyb3IgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICkuYWx3YXlzKCBjb21wbGV0ZV9vbmVfcmVxdWVzdCApO1xuXG5cdFx0XHRyZXNpemVfcmVxdWVzdCA9IHdpbmRvdy5qUXVlcnkuYWpheCgge1xuXHRcdFx0XHR1cmw6IHJlc2l6ZV90cmFuc3BvcnQudXJsLFxuXHRcdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdFx0ZGF0YVR5cGU6ICdqc29uJyxcblx0XHRcdFx0ZGF0YToge1xuXHRcdFx0XHRcdGFjdGlvbjogcmVzaXplX3RyYW5zcG9ydC5hY3Rpb24sXG5cdFx0XHRcdFx0bm9uY2U6IHJlc2l6ZV90cmFuc3BvcnQubm9uY2UsXG5cdFx0XHRcdFx0Ym9va2luZ19pZDogcmVnaXN0cmF0aW9uLmJvb2tpbmdfaWQsXG5cdFx0XHRcdFx0c291cmNlOiAndGltZWxpbmUnLFxuXHRcdFx0XHRcdHZpc2libGVfc3RhcnRfYXQ6IHJlZ2lzdHJhdGlvbi52aXNpYmxlX3N0YXJ0LFxuXHRcdFx0XHRcdHZpc2libGVfZW5kX2F0OiByZWdpc3RyYXRpb24udmlzaWJsZV9lbmQsXG5cdFx0XHRcdFx0c291cmNlX2NvbnRleHRfdG9rZW46ICcnXG5cdFx0XHRcdH1cblx0XHRcdH0gKS5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0XHRyZXNpemVfcmVzdWx0ID0gbm9ybWFsaXplX3Jlc2l6ZV9yZXNwb25zZSggcmVzcG9uc2UsIHJlZ2lzdHJhdGlvbiApO1xuXHRcdFx0XHRoYXNfZXJyb3IgPSBoYXNfZXJyb3IgfHwgISByZXNpemVfcmVzdWx0O1xuXHRcdFx0fSApLmZhaWwoIGZ1bmN0aW9uICggcmVxdWVzdCwgcmVxdWVzdF9zdGF0dXMgKSB7XG5cdFx0XHRcdGlmICggJ2Fib3J0JyAhPT0gcmVxdWVzdF9zdGF0dXMgKSB7XG5cdFx0XHRcdFx0aGFzX2Vycm9yID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSApLmFsd2F5cyggY29tcGxldGVfb25lX3JlcXVlc3QgKTtcblx0XHRcdGFjdGl2ZV9yZXF1ZXN0cyA9IFsgbW92ZW1lbnRfcmVxdWVzdCwgcmVzaXplX3JlcXVlc3QgXTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXBsYWNlIG9uZSBzdGFsZSBzb3VyY2UtY29udGV4dCB0b2tlbiB3aXRoIGEgZnJlc2ggZWxpZ2liaWxpdHkgcmVhZC5cblx0XHQgKlxuXHRcdCAqIENhbm9uaWNhbCBSZXZpZXcgaW52b2tlcyB0aGlzIG9ubHkgYWZ0ZXIgcmVqZWN0aW5nIHN0YWxlIHNlcnZlciBzdGF0ZS4gVGhlXG5cdFx0ICogcmVqZWN0ZWQgUmV2aWV3IGlzIG5ldmVyIHJldHJpZWQgYXV0b21hdGljYWxseTsgYSBuZXcgZXhwbGljaXQgZ2VzdHVyZSBpc1xuXHRcdCAqIHJlcXVpcmVkIGFmdGVyIHRoZSBmcmVzaCBjb250cm9scyByZW5kZXIuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gYm9va2luZ19pZCBDYW5vbmljYWwgYm9va2luZyB3aG9zZSBzb3VyY2UgdG9rZW4gaXMgc3RhbGUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZWxvYWRfc2VsZWN0ZWRfZWxpZ2liaWxpdHkoIGJvb2tpbmdfaWQgKSB7XG5cdFx0XHR2YXIgcmVnaXN0cmF0aW9uID0gT2JqZWN0LmtleXMoIHJlZ2lzdHJhdGlvbnNfYnlfcmVuZGVyX2lkICkubWFwKCBmdW5jdGlvbiAoIHJlbmRlcl9pZCApIHtcblx0XHRcdFx0cmV0dXJuIHJlZ2lzdHJhdGlvbnNfYnlfcmVuZGVyX2lkWyByZW5kZXJfaWQgXTtcblx0XHRcdH0gKS5maW5kKCBmdW5jdGlvbiAoIGNhbmRpZGF0ZSApIHtcblx0XHRcdFx0cmV0dXJuIGNhbmRpZGF0ZS5ib29raW5nX2lkID09PSBOdW1iZXIoIGJvb2tpbmdfaWQgKSAmJiBjYW5kaWRhdGUuY2Fub25pY2FsX2tleSA9PT0gc2VsZWN0ZWRfY2Fub25pY2FsX2tleSAmJiBpc19yZWdpc3RyYXRpb25fY3VycmVudCggY2FuZGlkYXRlICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdGlmICggISByZWdpc3RyYXRpb24gKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGRlbGV0ZSBlbGlnaWJpbGl0eV9jYWNoZVsgcmVnaXN0cmF0aW9uLmNhbm9uaWNhbF9rZXkgXTtcblx0XHRcdHJlcXVlc3RfZWxpZ2liaWxpdHkoIHJlZ2lzdHJhdGlvbiApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc29sdmUgc2VsZWN0ZWQgcHJlc2VudGF0aW9uIGlkZW50aXR5IHRvIGFjY2VwdGVkIGNhbm9uaWNhbCBkYXRhLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNlbGVjdGlvbl9zdGF0ZSBCb29raW5nLXdpZGUgc2hhcmVkIHNlbGVjdGlvbiBzdGF0ZS5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gQ2Fub25pY2FsIHNlbGVjdGVkIHJlZ2lzdHJhdGlvbiBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlc29sdmVfc2VsZWN0ZWRfcmVnaXN0cmF0aW9uKCBzZWxlY3Rpb25fc3RhdGUgKSB7XG5cdFx0XHR2YXIgcmVuZGVyX2lkID0gU3RyaW5nKCBzZWxlY3Rpb25fc3RhdGUgJiYgc2VsZWN0aW9uX3N0YXRlLnNlZ21lbnRfaGludCB8fCAnJyApO1xuXHRcdFx0dmFyIGJvb2tpbmdfaWQgPSBub3JtYWxpemVfcG9zaXRpdmVfaW50ZWdlciggc2VsZWN0aW9uX3N0YXRlICYmIHNlbGVjdGlvbl9zdGF0ZS5ib29raW5nX2lkICk7XG5cdFx0XHR2YXIgcmVnaXN0cmF0aW9uID0gcmVnaXN0cmF0aW9uc19ieV9yZW5kZXJfaWRbIHJlbmRlcl9pZCBdIHx8IG51bGw7XG5cblx0XHRcdGlmICggISByZWdpc3RyYXRpb24gfHwgcmVnaXN0cmF0aW9uLmJvb2tpbmdfaWQgIT09IGJvb2tpbmdfaWQgfHwgISBpc19yZWdpc3RyYXRpb25fY3VycmVudCggcmVnaXN0cmF0aW9uICkgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVnaXN0cmF0aW9uO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlY29uY2lsZSBvbmUgYm9va2luZy13aWRlIHNlbGVjdGlvbiBhZnRlciBhIHByb2plY3RlZCByZWZyZXNoLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNlbGVjdGlvbl9zdGF0ZSBTaGFyZWQgY2Fub25pY2FsLWJvb2tpbmcgc2VsZWN0aW9uIHN0YXRlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVjb25jaWxlX3NlbGVjdGlvbiggc2VsZWN0aW9uX3N0YXRlICkge1xuXHRcdFx0dmFyIHJlZ2lzdHJhdGlvbiA9IHJlc29sdmVfc2VsZWN0ZWRfcmVnaXN0cmF0aW9uKCBzZWxlY3Rpb25fc3RhdGUgKTtcblxuXHRcdFx0c2VsZWN0ZWRfYm9va2luZ19pZCA9IG5vcm1hbGl6ZV9wb3NpdGl2ZV9pbnRlZ2VyKCBzZWxlY3Rpb25fc3RhdGUgJiYgc2VsZWN0aW9uX3N0YXRlLmJvb2tpbmdfaWQgKTtcblx0XHRcdHNlbGVjdGVkX3JlbmRlcl9pZCA9IFN0cmluZyggc2VsZWN0aW9uX3N0YXRlICYmIHNlbGVjdGlvbl9zdGF0ZS5zZWdtZW50X2hpbnQgfHwgJycgKTtcblx0XHRcdGlmICggISByZWdpc3RyYXRpb24gfHwgaXNfcmVxdWVzdF9sb2FkaW5nICkge1xuXHRcdFx0XHRhYm9ydF9yZXF1ZXN0cygpO1xuXHRcdFx0XHRjbGVhcl9hbGxfcmVnaXN0cmF0aW9uX2hvc3RzKCk7XG5cdFx0XHRcdHNlbGVjdGVkX2Nhbm9uaWNhbF9rZXkgPSAnJztcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0c2VsZWN0ZWRfY2Fub25pY2FsX2tleSA9IHJlZ2lzdHJhdGlvbi5jYW5vbmljYWxfa2V5O1xuXHRcdFx0cmVxdWVzdF9lbGlnaWJpbGl0eSggcmVnaXN0cmF0aW9uICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29hbGVzY2Ugc2VsZWN0aW9uIHJlY29uY2lsaWF0aW9uIGFjcm9zcyBzeW5jaHJvbm91cyBtdWx0aS1SZXNvdXJjZSByZW5kZXJzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNlbGVjdGlvbl9zdGF0ZSBCb29raW5nLXdpZGUgc2hhcmVkIHNlbGVjdGlvbiBzdGF0ZS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNjaGVkdWxlX3NlbGVjdGlvbl9yZWNvbmNpbGlhdGlvbiggc2VsZWN0aW9uX3N0YXRlICkge1xuXHRcdFx0cGVuZGluZ19zZWxlY3Rpb25fc3RhdGUgPSB7XG5cdFx0XHRcdGJvb2tpbmdfaWQ6IG5vcm1hbGl6ZV9wb3NpdGl2ZV9pbnRlZ2VyKCBzZWxlY3Rpb25fc3RhdGUgJiYgc2VsZWN0aW9uX3N0YXRlLmJvb2tpbmdfaWQgKSxcblx0XHRcdFx0c2VnbWVudF9oaW50OiBTdHJpbmcoIHNlbGVjdGlvbl9zdGF0ZSAmJiBzZWxlY3Rpb25fc3RhdGUuc2VnbWVudF9oaW50IHx8ICcnIClcblx0XHRcdH07XG5cdFx0XHRpZiAoIHJlY29uY2lsZV9mcmFtZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSApIHtcblx0XHRcdFx0cmVjb25jaWxlX3NlbGVjdGlvbiggcGVuZGluZ19zZWxlY3Rpb25fc3RhdGUgKTtcblx0XHRcdFx0cGVuZGluZ19zZWxlY3Rpb25fc3RhdGUgPSBudWxsO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyZWNvbmNpbGVfZnJhbWUgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHZhciBuZXh0X3NlbGVjdGlvbl9zdGF0ZSA9IHBlbmRpbmdfc2VsZWN0aW9uX3N0YXRlO1xuXG5cdFx0XHRcdHJlY29uY2lsZV9mcmFtZSA9IDA7XG5cdFx0XHRcdHBlbmRpbmdfc2VsZWN0aW9uX3N0YXRlID0gbnVsbDtcblx0XHRcdFx0cmVjb25jaWxlX3NlbGVjdGlvbiggbmV4dF9zZWxlY3Rpb25fc3RhdGUgKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWFjdCB0byBvbmUgc2hhcmVkIGJvb2tpbmcgc2VsZWN0aW9uIHdpdGhvdXQgcmVhZGluZyBjYXJkIGF1dGhvcml0eS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHNlZ21lbnRfZWxlbWVudCBTZWxlY3RlZCByZW5kZXJlZCBzZWdtZW50LlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBzZWxlY3Rpb25fc3RhdGUgQm9va2luZy13aWRlIHNoYXJlZCBzZWxlY3Rpb24gc3RhdGUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZWxlY3Rfc2VnbWVudCggc2VnbWVudF9lbGVtZW50LCBzZWxlY3Rpb25fc3RhdGUgKSB7XG5cdFx0XHRzY2hlZHVsZV9zZWxlY3Rpb25fcmVjb25jaWxpYXRpb24oIHNlbGVjdGlvbl9zdGF0ZSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENvbXBsZXRlIG9uZSBwcm9qZWN0ZWQgUmVzb3VyY2UgcmVmcmVzaCBhbmQgcmVjb25jaWxlIGN1cnJlbnQgc2VsZWN0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJlZnJlc2hfY29udGV4dCBBY2NlcHRlZCBwcmVzZW50YXRpb24gcmVmcmVzaCBjb250ZXh0LlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBzZWxlY3Rpb25fc3RhdGUgQm9va2luZy13aWRlIHNoYXJlZCBzZWxlY3Rpb24gc3RhdGUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjb21wbGV0ZV9yZWFkX29ubHlfcmVmcmVzaCggcmVmcmVzaF9jb250ZXh0LCBzZWxlY3Rpb25fc3RhdGUgKSB7XG5cdFx0XHRpZiAoIFN0cmluZyggcmVmcmVzaF9jb250ZXh0ICYmIHJlZnJlc2hfY29udGV4dC5wcmVzZW50YXRpb25faWQgfHwgJycgKSAhPT0gU3RyaW5nKCB0aW1lX3Jvd3NfY29uZmlndXJhdGlvbi5wcmVzZW50YXRpb25faWQgfHwgJycgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0c2NoZWR1bGVfc2VsZWN0aW9uX3JlY29uY2lsaWF0aW9uKCBzZWxlY3Rpb25fc3RhdGUgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTdXNwZW5kIG9yIHJlc3VtZSBlbGlnaWJpbGl0eSBwcmVzZW50YXRpb24gZHVyaW5nIGNhbm9uaWNhbCBsb2FkaW5nLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBpc19sb2FkaW5nIFdoZXRoZXIgVGltZWxpbmUgcmVwbGFjZW1lbnQgaXMgYWN0aXZlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X3JlcXVlc3RfbG9hZGluZyggaXNfbG9hZGluZyApIHtcblx0XHRcdGlzX3JlcXVlc3RfbG9hZGluZyA9IHRydWUgPT09IGlzX2xvYWRpbmc7XG5cdFx0XHRpZiAoIGlzX3JlcXVlc3RfbG9hZGluZyApIHtcblx0XHRcdFx0aW52YWxpZGF0ZV9hbGwoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWZyZXNoIHJldGFpbmVkIGNhcmQgcmVnaXN0cmF0aW9ucyBhZnRlciBBdmFpbGFiaWxpdHktb25seSBpZGVudGl0eSBjaGFuZ2UuXG5cdFx0ICpcblx0XHQgKiBCb29raW5nIHJlcGxhY2VtZW50IG5vcm1hbGx5IHJlYnVpbGRzIGNhcmRzIGJlZm9yZSB0aGlzIGxpc3RlbmVyIHJ1bnMuXG5cdFx0ICogQXZhaWxhYmlsaXR5IGludGVudGlvbmFsbHkga2VlcHMgYm9va2luZyBjYXJkcyBtb3VudGVkLCBzbyB0aGVpciBjYW5vbmljYWxcblx0XHQgKiByZWdpc3RyYXRpb25zIHJlY2VpdmUgdGhlIG5ldyBhY2NlcHRlZCBpZGVudGl0eSB3aGlsZSBvbGQgZWxpZ2liaWxpdHkgaXNcblx0XHQgKiBkaXNjYXJkZWQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgUmVzb3VyY2Ugd2l0aCBtb3VudGVkIGNhbm9uaWNhbCBjYXJkcy5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gaWRlbnRpdHlfa2V5IE5ldyBhY2NlcHRlZCBpZGVudGl0eSBhbmQgZ2VvbWV0cnkga2V5LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVmcmVzaF9yZXRhaW5lZF9yZXNvdXJjZV9pZGVudGl0eSggcmVzb3VyY2VfaWQsIGlkZW50aXR5X2tleSApIHtcblx0XHRcdHZhciByZW5kZXJfaWRzID0gcmVnaXN0cmF0aW9uX2lkc19ieV9yZXNvdXJjZVsgcmVzb3VyY2VfaWQgXSB8fCBbXTtcblxuXHRcdFx0aWYgKCBhY3RpdmVfZ2VzdHVyZSAmJiBhY3RpdmVfZ2VzdHVyZS5yZWdpc3RyYXRpb24ucmVzb3VyY2VfaWQgPT09IHJlc291cmNlX2lkICkge1xuXHRcdFx0XHRjYW5jZWxfZ2VzdHVyZSggZmFsc2UsICcnICk7XG5cdFx0XHR9XG5cdFx0XHRhYm9ydF9yZXF1ZXN0cyggcmVzb3VyY2VfaWQgKTtcblx0XHRcdHJlbmRlcl9pZHMuZm9yRWFjaCggZnVuY3Rpb24gKCByZW5kZXJfaWQgKSB7XG5cdFx0XHRcdHZhciByZWdpc3RyYXRpb24gPSByZWdpc3RyYXRpb25zX2J5X3JlbmRlcl9pZFsgcmVuZGVyX2lkIF07XG5cblx0XHRcdFx0aWYgKCAhIHJlZ2lzdHJhdGlvbiApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2xlYXJfcmVnaXN0cmF0aW9uX2hvc3QoIHJlZ2lzdHJhdGlvbiApO1xuXHRcdFx0XHRkZWxldGUgZWxpZ2liaWxpdHlfY2FjaGVbIHJlZ2lzdHJhdGlvbi5jYW5vbmljYWxfa2V5IF07XG5cdFx0XHRcdHJlZ2lzdHJhdGlvbi5pZGVudGl0eV9rZXkgPSBpZGVudGl0eV9rZXk7XG5cdFx0XHRcdHJlZ2lzdHJhdGlvbi5jYW5vbmljYWxfa2V5ID0gYnVpbGRfY2Fub25pY2FsX2tleShcblx0XHRcdFx0XHRpZGVudGl0eV9rZXksXG5cdFx0XHRcdFx0cmVnaXN0cmF0aW9uLmJvb2tpbmdfaWQsXG5cdFx0XHRcdFx0cmVnaXN0cmF0aW9uLnJlc291cmNlX2lkLFxuXHRcdFx0XHRcdHJlZ2lzdHJhdGlvbi5zZWdtZW50X2lkLFxuXHRcdFx0XHRcdHJlZ2lzdHJhdGlvbi52aXNpYmxlX3N0YXJ0LFxuXHRcdFx0XHRcdHJlZ2lzdHJhdGlvbi52aXNpYmxlX2VuZFxuXHRcdFx0XHQpO1xuXHRcdFx0fSApO1xuXHRcdFx0cmVmcmVzaF9pZGVudGl0eV9ieV9yZXNvdXJjZVsgcmVzb3VyY2VfaWQgXSA9IGlkZW50aXR5X2tleTtcblx0XHRcdHNlbGVjdGVkX2Nhbm9uaWNhbF9rZXkgPSAnJztcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBJbnZhbGlkYXRlIG9ubHkgcmVnaXN0cmF0aW9ucyB3aG9zZSBhY2NlcHRlZCBpZGVudGl0eSBpcyBub3cgc3RhbGUuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9hY2NlcHRlZF9kYXRhX3JlcGxhY2VtZW50KCkge1xuXHRcdFx0T2JqZWN0LmtleXMoIHJlZnJlc2hfaWRlbnRpdHlfYnlfcmVzb3VyY2UgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHJlc291cmNlX2lkICkge1xuXHRcdFx0XHR2YXIgbnVtZXJpY19yZXNvdXJjZV9pZCA9IG5vcm1hbGl6ZV9wb3NpdGl2ZV9pbnRlZ2VyKCByZXNvdXJjZV9pZCApO1xuXHRcdFx0XHR2YXIgbGl2ZV9pZGVudGl0eV9rZXkgPSBidWlsZF9hY2NlcHRlZF9pZGVudGl0eV9rZXkoIGdldF9saXZlX2ludGVyYWN0aW9uX2NvbnRleHQoIG51bWVyaWNfcmVzb3VyY2VfaWQgKSwgc2VsZWN0aW9uX3N0ZXBfbWludXRlcyApO1xuXG5cdFx0XHRcdGlmICggISBsaXZlX2lkZW50aXR5X2tleSApIHtcblx0XHRcdFx0XHRpbnZhbGlkYXRlX3Jlc291cmNlKCBudW1lcmljX3Jlc291cmNlX2lkLCBmYWxzZSApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGxpdmVfaWRlbnRpdHlfa2V5ICE9PSByZWZyZXNoX2lkZW50aXR5X2J5X3Jlc291cmNlWyBudW1lcmljX3Jlc291cmNlX2lkIF0gKSB7XG5cdFx0XHRcdFx0cmVmcmVzaF9yZXRhaW5lZF9yZXNvdXJjZV9pZGVudGl0eSggbnVtZXJpY19yZXNvdXJjZV9pZCwgbGl2ZV9pZGVudGl0eV9rZXkgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCBzZWxlY3RlZF9ib29raW5nX2lkICYmIHNlbGVjdGVkX3JlbmRlcl9pZCApIHtcblx0XHRcdFx0c2NoZWR1bGVfc2VsZWN0aW9uX3JlY29uY2lsaWF0aW9uKCB7XG5cdFx0XHRcdFx0Ym9va2luZ19pZDogc2VsZWN0ZWRfYm9va2luZ19pZCxcblx0XHRcdFx0XHRzZWdtZW50X2hpbnQ6IHNlbGVjdGVkX3JlbmRlcl9pZFxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVsZWFzZSBvbmUgcmVtb3ZlZCBvciBjbG9zZWQgUmVzb3VyY2UgcHJvamVjdGlvbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Q3VzdG9tRXZlbnR9IGV2ZW50IFByZXNlbnRhdGlvbiBsaWZlY3ljbGUgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfcHJlc2VudGF0aW9uX3JlbW92ZWQoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGRldGFpbCA9IGV2ZW50ICYmIGV2ZW50LmRldGFpbCA/IGV2ZW50LmRldGFpbCA6IHt9O1xuXHRcdFx0dmFyIHJlc291cmNlX2lkID0gbm9ybWFsaXplX3Bvc2l0aXZlX2ludGVnZXIoIGRldGFpbC5yZXNvdXJjZV9pZCApO1xuXG5cdFx0XHRpZiAoIFN0cmluZyggZGV0YWlsLnByZXNlbnRhdGlvbl9pZCB8fCAnJyApID09PSBTdHJpbmcoIHRpbWVfcm93c19jb25maWd1cmF0aW9uLnByZXNlbnRhdGlvbl9pZCB8fCAnJyApICYmIHJlc291cmNlX2lkICkge1xuXHRcdFx0XHRpbnZhbGlkYXRlX3Jlc291cmNlKCByZXNvdXJjZV9pZCwgZmFsc2UgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDYW5jZWwgYSBwcm9wb3NhbCB3aGVuIHRoZSBkb2N1bWVudCBjYW4gbm8gbG9uZ2VyIGd1YXJhbnRlZSBjb21wbGV0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfZW52aXJvbm1lbnRfbG9zcygpIHtcblx0XHRcdGNhbmNlbF9nZXN0dXJlKCBmYWxzZSwgJycgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDYW5jZWwgd2hlbiB0aGUgZG9jdW1lbnQgYmVjb21lcyBoaWRkZW4gZHVyaW5nIGEgZ2VzdHVyZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX3Zpc2liaWxpdHlfY2hhbmdlKCkge1xuXHRcdFx0aWYgKCBkb2N1bWVudC5oaWRkZW4gKSB7XG5cdFx0XHRcdGhhbmRsZV9lbnZpcm9ubWVudF9sb3NzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVwb3J0IHdoZXRoZXIgdGhpcyBleHRlbnNpb24gY3VycmVudGx5IG93bnMgZ2VzdHVyZSBhdHRlbnRpb24uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIGR1cmluZyBhIHBvaW50ZXIgb3Iga2V5Ym9hcmQgcHJvcG9zYWwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaXNfaW50ZXJhY3RpbmcoKSB7XG5cdFx0XHRyZXR1cm4gQm9vbGVhbiggYWN0aXZlX2dlc3R1cmUgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBY2NlcHQgY2Fub25pY2FsIGludGVyYWN0aW9uIGNhbGxiYWNrcyBhZnRlciBlaXRoZXIgYm9vdHN0cmFwIG9yZGVyLlxuXHRcdCAqXG5cdFx0ICogQm9va2luZyBJbnRlcmFjdGlvbnMgaW5pdGlhbGl6ZXMgYmVmb3JlIHBhZ2UtbGV2ZWwgVGltZWxpbmUgZXh0ZW5zaW9ucyBpblxuXHRcdCAqIHByb2R1Y3Rpb24uIFRoaXMgc2V0dGVyIGtlZXBzIHRoZSBpc29sYXRlZCBhZGFwdGVyIGluZGVwZW5kZW50IG9mIFJldmlldyxcblx0XHQgKiBBcHBseSwgYW5kIHJlYWRiYWNrIHdoaWxlIGFsbG93aW5nIHRoZWlyIG5ldXRyYWwgYnJpZGdlIHRvIGFycml2ZSBmaXJzdC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fG51bGx9IG5leHRfY2FsbGJhY2tzIENhbm9uaWNhbCBpbnRlcmFjdGlvbiBicmlkZ2UgY2FsbGJhY2tzLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X2ludGVyYWN0aW9uX2NhbGxiYWNrcyggbmV4dF9jYWxsYmFja3MgKSB7XG5cdFx0XHRjYWxsYmFja3MgPSBuZXh0X2NhbGxiYWNrcyAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIG5leHRfY2FsbGJhY2tzID8gbmV4dF9jYWxsYmFja3MgOiB7fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gYm91bmRlZCBzY2FsYXIgc3RhdGUgZm9yIGRldmVsb3BtZW50IGV2aWRlbmNlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBSZWdpc3RyYXRpb24sIGNhY2hlLCByZXF1ZXN0LCBhbmQgc2VsZWN0aW9uIGNvdW50cy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfc3RhdGVfc25hcHNob3QoKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRpc19pbml0aWFsaXplZDogaXNfaW5pdGlhbGl6ZWQsXG5cdFx0XHRcdHJlZ2lzdHJhdGlvbl9jb3VudDogT2JqZWN0LmtleXMoIHJlZ2lzdHJhdGlvbnNfYnlfcmVuZGVyX2lkICkubGVuZ3RoLFxuXHRcdFx0XHRyZXNvdXJjZV9pZGVudGl0eV9jb3VudDogT2JqZWN0LmtleXMoIHJlZnJlc2hfaWRlbnRpdHlfYnlfcmVzb3VyY2UgKS5sZW5ndGgsXG5cdFx0XHRcdGVsaWdpYmlsaXR5X2NhY2hlX2NvdW50OiBPYmplY3Qua2V5cyggZWxpZ2liaWxpdHlfY2FjaGUgKS5sZW5ndGgsXG5cdFx0XHRcdHJlcXVlc3RfY291bnQ6IGFjdGl2ZV9yZXF1ZXN0cy5sZW5ndGgsXG5cdFx0XHRcdHJlcXVlc3RfZ2VuZXJhdGlvbjogcmVxdWVzdF9nZW5lcmF0aW9uLFxuXHRcdFx0XHRzZWxlY3RlZF9ib29raW5nX2lkOiBzZWxlY3RlZF9ib29raW5nX2lkLFxuXHRcdFx0XHRzZWxlY3RlZF9yZW5kZXJfaWQ6IHNlbGVjdGVkX3JlbmRlcl9pZCxcblx0XHRcdFx0aGFzX3NlbGVjdGVkX2Nhbm9uaWNhbF9pZGVudGl0eTogQm9vbGVhbiggc2VsZWN0ZWRfY2Fub25pY2FsX2tleSApLFxuXHRcdFx0XHRpc19yZXF1ZXN0X2xvYWRpbmc6IGlzX3JlcXVlc3RfbG9hZGluZyxcblx0XHRcdFx0aGFzX2FjdGl2ZV9nZXN0dXJlOiBCb29sZWFuKCBhY3RpdmVfZ2VzdHVyZSApXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEF0dGFjaCBhY2NlcHRlZC1kYXRhIGludmFsaWRhdGlvbiBsaXN0ZW5lcnMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGluaXRpYWxpemUoKSB7XG5cdFx0XHRpZiAoICEgbW91bnQgfHwgaXNfaW5pdGlhbGl6ZWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlzX2luaXRpYWxpemVkID0gdHJ1ZTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOnRpbWVsaW5lOmRhdGE6Ym9va2luZy13aW5kb3dzLWFjY2VwdGVkJywgaGFuZGxlX2FjY2VwdGVkX2RhdGFfcmVwbGFjZW1lbnQgKTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOnRpbWVsaW5lOmRhdGE6YXZhaWxhYmlsaXR5LWFjY2VwdGVkJywgaGFuZGxlX2FjY2VwdGVkX2RhdGFfcmVwbGFjZW1lbnQgKTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOnRpbWVsaW5lOnJvdy1wcmVzZW50YXRpb246Y2xvc2VkJywgaGFuZGxlX3ByZXNlbnRhdGlvbl9yZW1vdmVkICk7XG5cdFx0XHRtb3VudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzp0aW1lbGluZTpyb3ctcHJlc2VudGF0aW9uOnJlbW92ZWQnLCBoYW5kbGVfcHJlc2VudGF0aW9uX3JlbW92ZWQgKTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICdwb2ludGVyZG93bicsIGhhbmRsZV9wb2ludGVyX2Rvd24sIHRydWUgKTtcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdwb2ludGVybW92ZScsIGhhbmRsZV9wb2ludGVyX21vdmUsIHsgcGFzc2l2ZTogZmFsc2UgfSApO1xuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJ1cCcsIGhhbmRsZV9wb2ludGVyX3VwLCB7IHBhc3NpdmU6IGZhbHNlIH0gKTtcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdwb2ludGVyY2FuY2VsJywgaGFuZGxlX3BvaW50ZXJfY2FuY2VsICk7XG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIGhhbmRsZV9rZXlkb3duICk7XG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAndmlzaWJpbGl0eWNoYW5nZScsIGhhbmRsZV92aXNpYmlsaXR5X2NoYW5nZSApO1xuXHRcdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICdibHVyJywgaGFuZGxlX2Vudmlyb25tZW50X2xvc3MgKTtcblx0XHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAncGFnZWhpZGUnLCBoYW5kbGVfZW52aXJvbm1lbnRfbG9zcyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbW92ZSBsaXN0ZW5lcnMsIHJlcXVlc3RzLCBhY2NlcHRlZCByZWZlcmVuY2VzLCBhbmQgcHJlc2VudGF0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBkZXN0cm95KCkge1xuXHRcdFx0aWYgKCAhIG1vdW50IHx8ICEgaXNfaW5pdGlhbGl6ZWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdG1vdW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICd3cGJjOnRpbWVsaW5lOmRhdGE6Ym9va2luZy13aW5kb3dzLWFjY2VwdGVkJywgaGFuZGxlX2FjY2VwdGVkX2RhdGFfcmVwbGFjZW1lbnQgKTtcblx0XHRcdG1vdW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICd3cGJjOnRpbWVsaW5lOmRhdGE6YXZhaWxhYmlsaXR5LWFjY2VwdGVkJywgaGFuZGxlX2FjY2VwdGVkX2RhdGFfcmVwbGFjZW1lbnQgKTtcblx0XHRcdG1vdW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICd3cGJjOnRpbWVsaW5lOnJvdy1wcmVzZW50YXRpb246Y2xvc2VkJywgaGFuZGxlX3ByZXNlbnRhdGlvbl9yZW1vdmVkICk7XG5cdFx0XHRtb3VudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnd3BiYzp0aW1lbGluZTpyb3ctcHJlc2VudGF0aW9uOnJlbW92ZWQnLCBoYW5kbGVfcHJlc2VudGF0aW9uX3JlbW92ZWQgKTtcblx0XHRcdG1vdW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdwb2ludGVyZG93bicsIGhhbmRsZV9wb2ludGVyX2Rvd24sIHRydWUgKTtcblx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdwb2ludGVybW92ZScsIGhhbmRsZV9wb2ludGVyX21vdmUsIHsgcGFzc2l2ZTogZmFsc2UgfSApO1xuXHRcdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJ1cCcsIGhhbmRsZV9wb2ludGVyX3VwLCB7IHBhc3NpdmU6IGZhbHNlIH0gKTtcblx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdwb2ludGVyY2FuY2VsJywgaGFuZGxlX3BvaW50ZXJfY2FuY2VsICk7XG5cdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIGhhbmRsZV9rZXlkb3duICk7XG5cdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCAndmlzaWJpbGl0eWNoYW5nZScsIGhhbmRsZV92aXNpYmlsaXR5X2NoYW5nZSApO1xuXHRcdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdibHVyJywgaGFuZGxlX2Vudmlyb25tZW50X2xvc3MgKTtcblx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCAncGFnZWhpZGUnLCBoYW5kbGVfZW52aXJvbm1lbnRfbG9zcyApO1xuXHRcdFx0aW52YWxpZGF0ZV9hbGwoKTtcblx0XHRcdHJlZ2lzdHJhdGlvbnNfYnlfcmVuZGVyX2lkID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xuXHRcdFx0cmVnaXN0cmF0aW9uX2lkc19ieV9yZXNvdXJjZSA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblx0XHRcdHJlZnJlc2hfaWRlbnRpdHlfYnlfcmVzb3VyY2UgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0XHRzZWxlY3RlZF9ib29raW5nX2lkID0gMDtcblx0XHRcdHNlbGVjdGVkX3JlbmRlcl9pZCA9ICcnO1xuXHRcdFx0aXNfaW5pdGlhbGl6ZWQgPSBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0aW5pdGlhbGl6ZTogaW5pdGlhbGl6ZSxcblx0XHRcdGRlc3Ryb3k6IGRlc3Ryb3ksXG5cdFx0XHRiZWdpbl9yZWFkX29ubHlfcmVmcmVzaDogYmVnaW5fcmVhZF9vbmx5X3JlZnJlc2gsXG5cdFx0XHRyZWdpc3Rlcl9yZWFkX29ubHlfc2VnbWVudDogcmVnaXN0ZXJfcmVhZF9vbmx5X3NlZ21lbnQsXG5cdFx0XHRjb21wbGV0ZV9yZWFkX29ubHlfcmVmcmVzaDogY29tcGxldGVfcmVhZF9vbmx5X3JlZnJlc2gsXG5cdFx0XHRzZWxlY3Rfc2VnbWVudDogc2VsZWN0X3NlZ21lbnQsXG5cdFx0XHRzZXRfcmVxdWVzdF9sb2FkaW5nOiBzZXRfcmVxdWVzdF9sb2FkaW5nLFxuXHRcdFx0aW52YWxpZGF0ZV9hbGw6IGludmFsaWRhdGVfYWxsLFxuXHRcdFx0Z2V0X3N0YXRlX3NuYXBzaG90OiBnZXRfc3RhdGVfc25hcHNob3QsXG5cdFx0XHRpc19pbnRlcmFjdGluZzogaXNfaW50ZXJhY3RpbmcsXG5cdFx0XHRzZXRfaW50ZXJhY3Rpb25fY2FsbGJhY2tzOiBzZXRfaW50ZXJhY3Rpb25fY2FsbGJhY2tzXG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXNvbHZlIHRoZSBhY3RpdmUgcGFnZS1sb2NhbCBtb2R1bGUgZm9yIG9uZSBuZXV0cmFsIGludGVyYWN0aW9uIGNhbGxiYWNrLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gQ3VycmVudCBtb2R1bGUgaW5zdGFuY2Ugb3IgbnVsbC5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9hY3RpdmVfY29udHJvbGxlcigpIHtcblx0XHR2YXIgbW9kdWxlcyA9IHdpbmRvdy53cGJjX3RpbWVsaW5lX21vZHVsZXM7XG5cblx0XHRyZXR1cm4gbW9kdWxlcyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgbW9kdWxlcy5nZXRfaW5zdGFuY2Vcblx0XHRcdD8gbW9kdWxlcy5nZXRfaW5zdGFuY2UoIG1vZHVsZV9pbnN0YW5jZV9pZCApXG5cdFx0XHQ6IG51bGw7XG5cdH1cblxuXHQvKipcblx0ICogSW52b2tlIG9uZSBvcHRpb25hbCBtZXRob2Qgb24gdGhlIGFjdGl2ZSBpc29sYXRlZCBjb250cm9sbGVyLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gbWV0aG9kX25hbWUgU3RhYmxlIGNvbnRyb2xsZXIgbWV0aG9kLlxuXHQgKiBAcGFyYW0ge0FycmF5fSBtZXRob2RfYXJndW1lbnRzIE9yZGVyZWQgY2FsbGJhY2sgYXJndW1lbnRzLlxuXHQgKiBAcmV0dXJuIHsqfSBDb250cm9sbGVyIHJlc3VsdCB3aGVuIGF2YWlsYWJsZS5cblx0ICovXG5cdGZ1bmN0aW9uIGludm9rZV9hY3RpdmVfY29udHJvbGxlciggbWV0aG9kX25hbWUsIG1ldGhvZF9hcmd1bWVudHMgKSB7XG5cdFx0dmFyIGNvbnRyb2xsZXIgPSBnZXRfYWN0aXZlX2NvbnRyb2xsZXIoKTtcblxuXHRcdGlmICggY29udHJvbGxlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29udHJvbGxlclsgbWV0aG9kX25hbWUgXSApIHtcblx0XHRcdHJldHVybiBjb250cm9sbGVyWyBtZXRob2RfbmFtZSBdLmFwcGx5KCBjb250cm9sbGVyLCBtZXRob2RfYXJndW1lbnRzIHx8IFtdICk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGlmICggd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcy5yZWdpc3Rlcl9mYWN0b3J5ICkge1xuXHRcdHdpbmRvdy53cGJjX3RpbWVsaW5lX21vZHVsZXMucmVnaXN0ZXJfZmFjdG9yeSggbW9kdWxlX2lkLCBjcmVhdGVfY29udHJvbGxlciApO1xuXHR9XG5cblx0aWYgKFxuXHRcdHdpbmRvdy53cGJjX3RpbWVsaW5lX2Jvb2tpbmdfaW50ZXJhY3Rpb25zXG5cdFx0JiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX3RpbWVsaW5lX2Jvb2tpbmdfaW50ZXJhY3Rpb25zLnJlZ2lzdGVyX2V4dGVuc2lvbl9mYWN0b3J5XG5cdCkge1xuXHRcdHdpbmRvdy53cGJjX3RpbWVsaW5lX2Jvb2tpbmdfaW50ZXJhY3Rpb25zLnJlZ2lzdGVyX2V4dGVuc2lvbl9mYWN0b3J5KCBmdW5jdGlvbiAoIGludGVyYWN0aW9uX2NvbnRleHQgKSB7XG5cdFx0XHR2YXIgYnJpZGdlX2NhbGxiYWNrcyA9IGludGVyYWN0aW9uX2NvbnRleHQgJiYgaW50ZXJhY3Rpb25fY29udGV4dC5jYWxsYmFja3MgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBpbnRlcmFjdGlvbl9jb250ZXh0LmNhbGxiYWNrc1xuXHRcdFx0XHQ/IGludGVyYWN0aW9uX2NvbnRleHQuY2FsbGJhY2tzXG5cdFx0XHRcdDoge307XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRib29raW5nX2ludGVyYWN0aW9uX2NhbGxiYWNrcyA9IGJyaWRnZV9jYWxsYmFja3M7XG5cdFx0XHRcdFx0aW52b2tlX2FjdGl2ZV9jb250cm9sbGVyKCAnc2V0X2ludGVyYWN0aW9uX2NhbGxiYWNrcycsIFsgYnJpZGdlX2NhbGxiYWNrcyBdICk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGRlc3Ryb3k6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRpbnZva2VfYWN0aXZlX2NvbnRyb2xsZXIoICdzZXRfaW50ZXJhY3Rpb25fY2FsbGJhY2tzJywgWyBudWxsIF0gKTtcblx0XHRcdFx0XHRpZiAoIGJvb2tpbmdfaW50ZXJhY3Rpb25fY2FsbGJhY2tzID09PSBicmlkZ2VfY2FsbGJhY2tzICkge1xuXHRcdFx0XHRcdFx0Ym9va2luZ19pbnRlcmFjdGlvbl9jYWxsYmFja3MgPSBudWxsO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0YmVnaW5fcmVmcmVzaDogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdGludm9rZV9hY3RpdmVfY29udHJvbGxlciggJ2ludmFsaWRhdGVfYWxsJywgW10gKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0YmVnaW5fcmVhZF9vbmx5X3JlZnJlc2g6IGZ1bmN0aW9uICggcmVmcmVzaF9jb250ZXh0ICkge1xuXHRcdFx0XHRcdGludm9rZV9hY3RpdmVfY29udHJvbGxlciggJ2JlZ2luX3JlYWRfb25seV9yZWZyZXNoJywgWyByZWZyZXNoX2NvbnRleHQgXSApO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRyZWdpc3Rlcl9yZWFkX29ubHlfc2VnbWVudDogZnVuY3Rpb24gKCBjYXJkLCBzZWdtZW50LCByZXNvdXJjZV9zdW1tYXJ5LCBwcmVzZW50YXRpb25fY29udGV4dCApIHtcblx0XHRcdFx0XHRpbnZva2VfYWN0aXZlX2NvbnRyb2xsZXIoICdyZWdpc3Rlcl9yZWFkX29ubHlfc2VnbWVudCcsIFsgY2FyZCwgc2VnbWVudCwgcmVzb3VyY2Vfc3VtbWFyeSwgcHJlc2VudGF0aW9uX2NvbnRleHQgXSApO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRjb21wbGV0ZV9yZWFkX29ubHlfcmVmcmVzaDogZnVuY3Rpb24gKCByZWZyZXNoX2NvbnRleHQsIHNlbGVjdGlvbl9zdGF0ZSApIHtcblx0XHRcdFx0XHRpbnZva2VfYWN0aXZlX2NvbnRyb2xsZXIoICdjb21wbGV0ZV9yZWFkX29ubHlfcmVmcmVzaCcsIFsgcmVmcmVzaF9jb250ZXh0LCBzZWxlY3Rpb25fc3RhdGUgXSApO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRzZWxlY3Rfc2VnbWVudDogZnVuY3Rpb24gKCBzZWdtZW50X2VsZW1lbnQsIHNlbGVjdGlvbl9zdGF0ZSApIHtcblx0XHRcdFx0XHRpbnZva2VfYWN0aXZlX2NvbnRyb2xsZXIoICdzZWxlY3Rfc2VnbWVudCcsIFsgc2VnbWVudF9lbGVtZW50LCBzZWxlY3Rpb25fc3RhdGUgXSApO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRzZXRfcmVxdWVzdF9sb2FkaW5nOiBmdW5jdGlvbiAoIGlzX2xvYWRpbmcgKSB7XG5cdFx0XHRcdFx0aW52b2tlX2FjdGl2ZV9jb250cm9sbGVyKCAnc2V0X3JlcXVlc3RfbG9hZGluZycsIFsgaXNfbG9hZGluZyBdICk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fSApO1xuXHR9XG59KCB3aW5kb3csIGRvY3VtZW50LCB3aW5kb3cud3AgKSApO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFLFdBQVdBLE1BQU0sRUFBRUMsUUFBUSxFQUFFQyxFQUFFLEVBQUc7RUFDbkMsWUFBWTs7RUFFWixJQUFJQyxTQUFTLEdBQUcsb0JBQW9CO0VBQ3BDLElB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
